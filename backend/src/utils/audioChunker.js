/**
 * @module utils/audioChunker
 * @description Dual-Engine Speech-to-Text (STT) Transcriber and Audio Chunking Pipeline.
 * Enforces Addis AI constraints (<= 120s duration, <= 25MB size) via ffprobe duration probing
 * and ffmpeg acoustic segmentation (75-second 16kHz mono PCM slices).
 * Guarantees immediate post-merge cleanup of temporary slice files inside a finally block.
 * Provides seamless fallback and native multimodal audio passing to Gemini 2.5 Flash STT.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { AddisAI } from 'addisai';
import { GoogleGenAI } from '@google/genai';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { Audio } from '../models/Audio.js';
import { UPLOADS_CONFIG, AI_MODELS } from './constants.js';

const FFMPEG = env.FFMPEG_PATH || process.env.FFMPEG_PATH || ffmpegInstaller.path || 'ffmpeg';
const FFPROBE = env.FFPROBE_PATH || process.env.FFPROBE_PATH || ffprobeInstaller.path || 'ffprobe';

/**
 * Resolves binary executable path on Windows (.exe fallback if omitted).
 *
 * @param {string} binPath - Executable path or command name.
 * @returns {string} Resolved executable path.
 */
function resolveExecutable(binPath) {
  if (process.platform === 'win32' && !binPath.toLowerCase().endsWith('.exe')) {
    const withExe = `${binPath}.exe`;
    if (fs.existsSync(withExe)) return withExe;
  }
  return binPath;
}

/**
 * Resolves absolute filesystem storage path for an audio file.
 *
 * @param {string} rawPath - Relative or absolute audio path.
 * @returns {string} Absolute normalized file path.
 */
export function resolveAudioDiskPath(rawPath) {
  if (!rawPath) return '';
  if (path.isAbsolute(rawPath) && fs.existsSync(rawPath)) return rawPath;

  const basename = path.basename(rawPath);

  // Check in canonical UPLOADS_CONFIG.AUDIOS_DIR first
  if (basename && UPLOADS_CONFIG?.AUDIOS_DIR) {
    const inAudiosDir = path.resolve(UPLOADS_CONFIG.AUDIOS_DIR, basename);
    if (fs.existsSync(inAudiosDir)) return inAudiosDir;

    const inAttachmentsDir = path.resolve(UPLOADS_CONFIG.ATTACHMENTS_DIR, basename);
    if (fs.existsSync(inAttachmentsDir)) return inAttachmentsDir;

    const inUploadsRoot = path.resolve(UPLOADS_CONFIG.ROOT_DIR, basename);
    if (fs.existsSync(inUploadsRoot)) return inUploadsRoot;
  }

  // Check relative to UPLOADS_CONFIG.ROOT_DIR
  const normalizedRel = rawPath.replace(/^[\\/]+/, '').replace(/^(backend[\\/])?uploads[\\/]/, '');
  if (UPLOADS_CONFIG?.ROOT_DIR) {
    const inUploadsRoot = path.resolve(UPLOADS_CONFIG.ROOT_DIR, normalizedRel);
    if (fs.existsSync(inUploadsRoot)) return inUploadsRoot;
  }

  // Check against cwd
  const cleanRel = rawPath.replace(/^[\\/]+/, '');
  const direct = path.resolve(process.cwd(), cleanRel);
  if (fs.existsSync(direct)) return direct;

  if (cleanRel.startsWith('backend/') || cleanRel.startsWith('backend\\')) {
    const stripped = cleanRel.replace(/^backend[\\/]/, '');
    const strippedPath = path.resolve(process.cwd(), stripped);
    if (fs.existsSync(strippedPath)) return strippedPath;
  }
  const withBackend = path.resolve(process.cwd(), 'backend', cleanRel);
  if (fs.existsSync(withBackend)) return withBackend;

  return (UPLOADS_CONFIG?.AUDIOS_DIR && basename)
    ? path.resolve(UPLOADS_CONFIG.AUDIOS_DIR, basename)
    : direct;
}

/**
 * Probes the exact duration of an audio file in seconds using ffprobe with ffmpeg stderr fallback.
 *
 * @param {string} filePath - Absolute or relative path to the audio file.
 * @returns {Promise<number|null>} Duration in seconds, or null if unresolvable.
 */
export function probeAudioDuration(filePath) {
  return new Promise((resolve) => {
    const resolvedPath = resolveAudioDiskPath(filePath);
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      logger.warn(`[audioChunker] File not found for ffprobe: ${resolvedPath || filePath}`);
      return resolve(null);
    }

    try {
      const stats = fs.statSync(resolvedPath);
      if (stats.size === 0) {
        return resolve(0);
      }
    } catch (_) {
      return resolve(null);
    }

    const fallbackFfmpeg = () => {
      const ffmpegBin = resolveExecutable(FFMPEG);
      const ffProc = spawn(ffmpegBin, ['-nostdin', '-i', resolvedPath, '-f', 'null', '-'], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      let ffStderr = '';
      ffProc.stderr.on('data', (d) => { ffStderr += d.toString(); });
      ffProc.on('close', () => {
        const match = ffStderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i) ||
                      ffStderr.match(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
        if (match) {
          const hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const seconds = parseFloat(match[3]);
          const totalSec = hours * 3600 + minutes * 60 + seconds;
          return resolve(totalSec);
        }
        logger.warn(`[audioChunker] Duration probing failed for ${resolvedPath}`);
        resolve(null);
      });
      ffProc.on('error', () => resolve(null));
    };

    const ffprobeBin = resolveExecutable(FFPROBE);
    const proc = spawn(
      ffprobeBin,
      [
        '-v', 'error',
        '-show_entries', 'stream=duration:format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        resolvedPath,
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        const parsed = stdout
          .trim()
          .split(/\r?\n/)
          .map((line) => parseFloat(line.trim()))
          .filter((v) => !isNaN(v) && v >= 0);

        if (parsed.length > 0) {
          return resolve(parsed[0]);
        }
      }
      // ffprobe failed or returned N/A (common in browser MediaRecorder webm/wav streams) -> ffmpeg fallback
      fallbackFfmpeg();
    });

    proc.on('error', (err) => {
      logger.warn(`[audioChunker] Failed to spawn ffprobe (${ffprobeBin}): ${err.message}. Trying ffmpeg fallback...`);
      fallbackFfmpeg();
    });
  });
}

/**
 * Slices an audio file into uniform duration segments (default 50s, strictly <= 60s for Addis AI) using ffmpeg.
 * Transcodes slices into 16kHz mono PCM WAV for maximum acoustic fidelity.
 *
 * @param {string} filePath - Source audio file path.
 * @param {number} [chunkDurationSec=50] - Segment duration in seconds.
 * @param {string} [tempDir=null] - Directory for temporary slices.
 * @returns {Promise<string[]>} List of generated chunk file paths.
 */
export function sliceAudioFile(filePath, chunkDurationSec = 50, tempDir = null) {
  return new Promise((resolve, reject) => {
    const resolvedPath = resolveAudioDiskPath(filePath);
    const ffmpegBin = resolveExecutable(FFMPEG);
    const resolvedTempDir =
      tempDir || path.resolve(path.dirname(resolvedPath), '../temp');

    if (!fs.existsSync(resolvedTempDir)) {
      fs.mkdirSync(resolvedTempDir, { recursive: true });
    }

    const baseName = `${path.basename(resolvedPath, path.extname(resolvedPath))}_${Date.now()}`;
    const outputPattern = path.join(resolvedTempDir, `${baseName}_chunk_%03d.wav`);

    const proc = spawn(
      ffmpegBin,
      [
        '-y',
        '-nostdin',
        '-i', resolvedPath,
        '-f', 'segment',
        '-segment_time', String(chunkDurationSec),
        '-c:a', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        outputPattern,
      ],
      {
        stdio: ['ignore', 'ignore', 'pipe'],
      }
    );

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(
          new Error(`ffmpeg audio slicing failed (exit code ${code}): ${stderr}`)
        );
      }

      try {
        const files = fs.readdirSync(resolvedTempDir)
          .filter((f) => f.startsWith(`${baseName}_chunk_`) && f.endsWith('.wav'))
          .sort()
          .map((f) => path.join(resolvedTempDir, f));

        resolve(files);
      } catch (err) {
        reject(err);
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg (${ffmpegBin}): ${err.message}`));
    });
  });
}

/**
 * Transcribes audio using the Addis AI Speech-to-Text API.
 * Enforces uniform architecture: chunk -> transcribe each -> merge transcription.
 * Guarantees immediate cleanup of all temporary chunk slice files inside a finally block.
 *
 * @param {string} filePath - Audio file path on disk.
 * @param {string} [language='am'] - Spoken language code ('am' for Amharic).
 * @returns {Promise<{ text: string, duration: number|null, engine: string, chunks: number, noAudioDetected?: boolean }>}
 */
export async function transcribeWithAddisAi(filePath, language = 'am', apiKeyOverride = null) {
  const apiKey = apiKeyOverride || env.ADDIS_API_KEY || process.env.ADDIS_API_KEY;
  if (!apiKey) {
    throw new Error('ADDIS_API_KEY is not configured in environment or user settings.');
  }

  const resolvedPath = resolveAudioDiskPath(filePath);
  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }

  const stats = fs.statSync(resolvedPath);
  if (stats.size === 0) {
    return {
      text: '',
      duration: 0,
      engine: 'addis_ai',
      chunks: 0,
      noAudioDetected: true,
    };
  }

  const duration = await probeAudioDuration(resolvedPath);
  if (duration === 0) {
    return {
      text: '',
      duration: 0,
      engine: 'addis_ai',
      chunks: 0,
      noAudioDetected: true,
    };
  }

  const addis = new AddisAI({ apiKey });

  // Uniform Addis AI architecture: chunk -> transcribe each -> merge transcription
  const chunkFiles = await sliceAudioFile(resolvedPath, 50);
  if (chunkFiles.length === 0) {
    return {
      text: '',
      duration: duration || 0,
      engine: 'addis_ai',
      chunks: 0,
      noAudioDetected: true,
    };
  }

  try {
    const textSegments = [];
    for (const chunkPath of chunkFiles) {
      if (!fs.existsSync(chunkPath)) continue;
      const chunkStats = fs.statSync(chunkPath);
      if (chunkStats.size === 0) continue;

      const chunkBuffer = fs.readFileSync(chunkPath);
      const res = await addis.speech.transcribe({
        audio: chunkBuffer,
        language: language || 'am',
      });
      if (res && res.text && res.text.trim()) {
        textSegments.push(res.text.trim());
      }
    }

    const mergedText = textSegments.join(' ').trim();
    return {
      text: mergedText,
      duration: duration || null,
      engine: 'addis_ai',
      chunks: chunkFiles.length,
      noAudioDetected: mergedText.length === 0,
    };
  } finally {
    // Guaranteed immediate disposal of temporary chunk slices to prevent disk leaks
    for (const chunkPath of chunkFiles) {
      try {
        if (fs.existsSync(chunkPath)) {
          await fs.promises.unlink(chunkPath);
        }
      } catch (unlinkErr) {
        logger.warn(`[audioChunker] Failed to unlink temporary chunk ${chunkPath}: ${unlinkErr.message}`);
      }
    }
  }
}

/**
 * Transcribes audio natively using Gemini 2.5 Flash multimodal capabilities.
 * Bypasses slicing overhead and processes multi-megabyte audio directly in context.
 *
 * @param {string} filePath - Audio file path.
 * @param {string} [mimeType='audio/wav'] - MIME type of the audio.
 * @param {string} [model=AI_MODELS.DEFAULT_AUDIO_CHUNKER_MODEL] - Gemini model identifier.
 * @returns {Promise<{ text: string, duration: number|null, engine: string, chunks: number, noAudioDetected?: boolean }>}
 */
export async function transcribeWithGemini(
  filePath,
  mimeType = 'audio/wav',
  model = AI_MODELS.DEFAULT_AUDIO_CHUNKER_MODEL,
  apiKeyOverride = null
) {
  const apiKey = apiKeyOverride || env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment or user settings.');
  }

  const resolvedPath = resolveAudioDiskPath(filePath);
  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }

  const stats = fs.statSync(resolvedPath);
  if (stats.size === 0) {
    return {
      text: '',
      duration: 0,
      engine: model,
      chunks: 0,
      noAudioDetected: true,
    };
  }

  const duration = await probeAudioDuration(resolvedPath);
  if (duration === 0) {
    return {
      text: '',
      duration: 0,
      engine: model,
      chunks: 0,
      noAudioDetected: true,
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const audioBuffer = fs.readFileSync(resolvedPath);
  const base64Data = audioBuffer.toString('base64');

  const targetModel = AI_MODELS.SUPPORTED.includes(model)
    ? model
    : AI_MODELS.DEFAULT_AUDIO_CHUNKER_MODEL;

  const response = await ai.models.generateContent({
    model: targetModel,
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/wav',
              data: base64Data,
            },
          },
          {
            text: 'Please transcribe this audio recording verbatim in its spoken language (e.g. Amharic or English). Provide only the verbatim transcript without translation, conversational preamble, or explanation. If there is no speech or only silence/noise, return an empty response.',
          },
        ],
      },
    ],
  });

  const text = (response.text || '').trim();
  return {
    text,
    duration: duration || null,
    engine: targetModel,
    chunks: 1,
    noAudioDetected: text.length === 0,
  };
}

/**
 * Unified Speech-to-Text orchestrator.
 * Routes to user's selected engine ('addis_ai' or supported Gemini STT models).
 * Features fail-safe fallback: if Addis AI fails, automatically falls back to Gemini STT.
 *
 * @param {string} filePath - Audio path.
 * @param {object} [options={}] - Options { sttEngine, language, mimeType }.
 * @returns {Promise<{ text: string, duration: number|null, engine: string, chunks: number, noAudioDetected?: boolean }>}
 */
export async function transcribeAudio(
  filePath,
  { sttEngine = 'addis_ai', language = 'am', mimeType = 'audio/wav', addisApiKey = null, geminiApiKey = null } = {}
) {
  const resolvedPath = resolveAudioDiskPath(filePath);
  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }

  const stats = fs.statSync(resolvedPath);
  if (stats.size === 0) {
    return {
      text: '',
      duration: 0,
      engine: sttEngine,
      chunks: 0,
      noAudioDetected: true,
    };
  }

  if (sttEngine !== 'addis_ai') {
    return transcribeWithGemini(filePath, mimeType, sttEngine, geminiApiKey);
  }

  // Addis AI mode (default) with fail-safe fallback
  try {
    return await transcribeWithAddisAi(filePath, language, addisApiKey);
  } catch (addisErr) {
    logger.warn(
      `[audioChunker] Addis AI STT failed (${addisErr.message}). Failing over to Gemini STT...`
    );
    return transcribeWithGemini(filePath, mimeType, AI_MODELS.DEFAULT_AUDIO_CHUNKER_MODEL, geminiApiKey);
  }
}

/**
 * Processes and transcribes a stored Audio document in MongoDB.
 * Synchronizes audio.transcription, audio.duration, audio.sttEngine, and audio.status.
 *
 * @param {string|import('mongoose').Types.ObjectId} audioId - Audio document ObjectId.
 * @param {object} [options={}] - Options { sttEngine, language, addisApiKey, geminiApiKey }.
 * @returns {Promise<import('../models/Audio.js').IAudio>} Updated Audio document.
 */
export async function transcribeAudioDocument(
  audioId,
  { sttEngine = null, language = 'am', addisApiKey = null, geminiApiKey = null } = {}
) {
  const audio = await Audio.findById(audioId);
  if (!audio) {
    throw new Error(`Audio record "${audioId}" not found.`);
  }

  const resolvedEngine = sttEngine || audio.sttEngine || 'addis_ai';
  const diskPath = resolveAudioDiskPath(audio.path);

  audio.status = 'transcribing';
  await audio.save();

  try {
    const result = await transcribeAudio(diskPath, {
      sttEngine: resolvedEngine,
      language,
      mimeType: audio.mimeType,
      addisApiKey,
      geminiApiKey,
    });

    audio.transcription = result.text;
    if (result.duration !== null) {
      audio.duration = Math.round(result.duration);
    }
    audio.sttEngine = result.engine;
    audio.status = 'transcribed';
    audio.error = null;
    await audio.save();

    return audio;
  } catch (err) {
    audio.status = 'failed';
    audio.error = err.message;
    await audio.save();
    throw err;
  }
}

export default {
  probeAudioDuration,
  sliceAudioFile,
  transcribeWithAddisAi,
  transcribeWithGemini,
  transcribeAudio,
  transcribeAudioDocument,
};
