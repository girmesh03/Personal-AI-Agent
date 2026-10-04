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
import env from '../config/env.js';
import logger from '../config/logger.js';
import { Audio } from '../models/Audio.js';

const FFMPEG = env.FFMPEG_PATH || process.env.FFMPEG_PATH || 'C:/ffmpeg/ffmpeg';
const FFPROBE = env.FFPROBE_PATH || process.env.FFPROBE_PATH || 'C:/ffmpeg/ffprobe';

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
  const direct = path.resolve(process.cwd(), rawPath);
  if (fs.existsSync(direct)) return direct;
  if (rawPath.startsWith('backend/') || rawPath.startsWith('backend\\')) {
    const stripped = rawPath.replace(/^backend[\\/]/, '');
    const strippedPath = path.resolve(process.cwd(), stripped);
    if (fs.existsSync(strippedPath)) return strippedPath;
  }
  const withBackend = path.resolve(process.cwd(), 'backend', rawPath);
  if (fs.existsSync(withBackend)) return withBackend;
  if (rawPath.includes('uploads/audio/') || rawPath.includes('uploads\\audio\\')) {
    const swapped = rawPath.replace(/uploads[\\/]audio[\\/]/, 'uploads/audios/');
    const swappedPath = path.resolve(process.cwd(), swapped);
    if (fs.existsSync(swappedPath)) return swappedPath;
    const swappedBackend = path.resolve(process.cwd(), 'backend', swapped);
    if (fs.existsSync(swappedBackend)) return swappedBackend;
  }
  if (rawPath.includes('uploads/audios/') || rawPath.includes('uploads\\audios\\')) {
    const swapped = rawPath.replace(/uploads[\\/]audios[\\/]/, 'uploads/audio/');
    const swappedPath = path.resolve(process.cwd(), swapped);
    if (fs.existsSync(swappedPath)) return swappedPath;
    const swappedBackend = path.resolve(process.cwd(), 'backend', swapped);
    if (fs.existsSync(swappedBackend)) return swappedBackend;
  }
  return direct;
}

/**
 * Probes the exact duration of an audio file in seconds using ffprobe.
 *
 * @param {string} filePath - Absolute or relative path to the audio file.
 * @returns {Promise<number|null>} Duration in seconds, or null if unresolvable.
 */
export function probeAudioDuration(filePath) {
  return new Promise((resolve) => {
    const resolvedPath = resolveAudioDiskPath(filePath);
    if (!fs.existsSync(resolvedPath)) {
      logger.warn(`[audioChunker] File not found for ffprobe: ${resolvedPath || filePath}`);
      return resolve(null);
    }

    const ffprobeBin = resolveExecutable(FFPROBE);
    const proc = spawn(ffprobeBin, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      resolvedPath,
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        const val = parseFloat(stdout.trim());
        if (!isNaN(val) && val >= 0) {
          return resolve(val);
        }
      }
      logger.warn(`[audioChunker] ffprobe returned code ${code}: ${stderr}`);
      resolve(null);
    });

    proc.on('error', (err) => {
      logger.warn(`[audioChunker] Failed to spawn ffprobe (${ffprobeBin}): ${err.message}`);
      resolve(null);
    });
  });
}

/**
 * Slices an audio file into uniform duration segments (default 75s) using ffmpeg.
 * Transcodes slices into 16kHz mono PCM WAV for maximum acoustic fidelity.
 *
 * @param {string} filePath - Source audio file path.
 * @param {number} [chunkDurationSec=75] - Segment duration in seconds.
 * @param {string} [tempDir=null] - Directory for temporary slices.
 * @returns {Promise<string[]>} List of generated chunk file paths.
 */
export function sliceAudioFile(filePath, chunkDurationSec = 75, tempDir = null) {
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

    const proc = spawn(ffmpegBin, [
      '-y',
      '-i', resolvedPath,
      '-f', 'segment',
      '-segment_time', String(chunkDurationSec),
      '-c:a', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      outputPattern,
    ]);

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
 * Handles Addis AI hard limits (<= 120s, <= 25MB) by slicing when duration or size exceeds bounds.
 * Guarantees immediate cleanup of all temporary chunk slice files inside a finally block.
 *
 * @param {string} filePath - Audio file path on disk.
 * @param {string} [language='am'] - Spoken language code ('am' for Amharic).
 * @returns {Promise<{ text: string, duration: number|null, engine: string, chunks: number }>}
 */
export async function transcribeWithAddisAi(filePath, language = 'am') {
  const apiKey = env.ADDIS_API_KEY || process.env.ADDIS_API_KEY;
  if (!apiKey) {
    throw new Error('ADDIS_API_KEY is not configured in environment settings.');
  }

  const resolvedPath = resolveAudioDiskPath(filePath);
  const addis = new AddisAI({ apiKey });
  const duration = await probeAudioDuration(resolvedPath);
  const stats = fs.statSync(resolvedPath);
  const maxBytes = 25 * 1024 * 1024; // 25MB

  // Path A: Short Audio (<= 120s and <= 25MB) -> direct single transcription
  if (duration !== null && duration <= 120 && stats.size <= maxBytes) {
    const audioBuffer = fs.readFileSync(resolvedPath);
    const result = await addis.speech.transcribe({
      audio: audioBuffer,
      language: language || 'am',
    });

    return {
      text: (result.text || '').trim(),
      duration,
      engine: 'addis_ai',
      chunks: 1,
    };
  }

  // Path B: Long Audio (> 120s or > 25MB) -> chunking into 75s slices
  const chunkFiles = await sliceAudioFile(resolvedPath, 75);
  try {
    const textSegments = [];
    for (const chunkPath of chunkFiles) {
      const chunkBuffer = fs.readFileSync(chunkPath);
      const res = await addis.speech.transcribe({
        audio: chunkBuffer,
        language: language || 'am',
      });
      if (res && res.text) {
        textSegments.push(res.text.trim());
      }
    }

    const mergedText = textSegments.join(' ');
    return {
      text: mergedText,
      duration: duration || null,
      engine: 'addis_ai',
      chunks: chunkFiles.length,
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
 * @returns {Promise<{ text: string, duration: number|null, engine: string, chunks: number }>}
 */
export async function transcribeWithGemini(filePath, mimeType = 'audio/wav') {
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment settings.');
  }

  const resolvedPath = resolveAudioDiskPath(filePath);
  const ai = new GoogleGenAI({ apiKey });
  const duration = await probeAudioDuration(resolvedPath);
  const audioBuffer = fs.readFileSync(resolvedPath);
  const base64Data = audioBuffer.toString('base64');

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
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
            text: 'Please transcribe this Amharic audio recording verbatim. Provide only the verbatim Amharic transcript without translation, conversational preamble, or explanation.',
          },
        ],
      },
    ],
  });

  const text = (response.text || '').trim();
  return {
    text,
    duration: duration || null,
    engine: 'gemini-3.8-flash',
    chunks: 1,
  };
}

/**
 * Unified Speech-to-Text orchestrator.
 * Routes to user's selected engine ('addis_ai' or 'gemini-3.5-flash' / 'gemini-2.5-flash').
 * Features fail-safe fallback: if Addis AI fails, automatically falls back to Gemini 3.5 Flash.
 *
 * @param {string} filePath - Audio path.
 * @param {object} [options={}] - Options { sttEngine, language, mimeType }.
 * @returns {Promise<{ text: string, duration: number|null, engine: string, chunks: number }>}
 */
export async function transcribeAudio(
  filePath,
  { sttEngine = 'addis_ai', language = 'am', mimeType = 'audio/wav' } = {}
) {
  if (sttEngine === 'gemini-3.5-flash' || sttEngine === 'gemini-2.5-flash') {
    return transcribeWithGemini(filePath, mimeType);
  }

  // Addis AI mode (default) with fail-safe fallback
  try {
    return await transcribeWithAddisAi(filePath, language);
  } catch (addisErr) {
    logger.warn(
      `[audioChunker] Addis AI STT failed (${addisErr.message}). Failing over to Gemini 2.5 Flash STT...`
    );
    return transcribeWithGemini(filePath, mimeType);
  }
}

/**
 * Processes and transcribes a stored Audio document in MongoDB.
 * Synchronizes audio.transcription, audio.duration, audio.sttEngine, and audio.status.
 *
 * @param {string|import('mongoose').Types.ObjectId} audioId - Audio document ObjectId.
 * @param {object} [options={}] - Options { sttEngine, language }.
 * @returns {Promise<import('../models/Audio.js').IAudio>} Updated Audio document.
 */
export async function transcribeAudioDocument(audioId, { sttEngine = null, language = 'am' } = {}) {
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
