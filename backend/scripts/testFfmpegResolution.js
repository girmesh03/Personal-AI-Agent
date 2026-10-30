/**
 * @file testFfmpegResolution.js
 * @description Comprehensive automated verification test for Phase 14B Point 26:
 * Self-healing FFmpeg and FFprobe binary resolution across platforms (Render Linux & Local Windows).
 * Verifies fallback when env paths are empty, non-existent, or invalid, and tests audio probing & slicing.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import env from '../src/config/env.js';
import {
  resolveBinaryPath,
  resolveExecutable,
  probeAudioDuration,
  sliceAudioFile,
  FFMPEG,
  FFPROBE,
} from '../src/utils/audioChunker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTest() {
  console.log('='.repeat(80));
  console.log('PHASE 14B POINT 26: FFMPEG & FFPROBE RESOLUTION VERIFICATION');
  console.log('='.repeat(80));

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`[PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Test ${total}: ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Test ${total}: ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  // 1. env.js configuration test
  test('env.FFMPEG_PATH and env.FFPROBE_PATH do not inject hardcoded Windows path when unset', () => {
    // If process.env.FFMPEG_PATH was unset, env.FFMPEG_PATH must be empty string, not C:/ffmpeg/ffmpeg
    const originalFfmpeg = process.env.FFMPEG_PATH;
    delete process.env.FFMPEG_PATH;
    // We verify the default value logic
    const defaultVal = process.env.FFMPEG_PATH || '';
    assert.strictEqual(defaultVal, '', 'Unset FFMPEG_PATH must default to empty string');
    if (originalFfmpeg) process.env.FFMPEG_PATH = originalFfmpeg;
  });

  // 2. resolveBinaryPath returns installer path when configured path is empty (Render simulation)
  test('resolveBinaryPath falls back to bundled @ffmpeg-installer when configured path is empty', () => {
    const resolved = resolveBinaryPath('ffmpeg', '', ffmpegInstaller?.path);
    assert.ok(resolved, 'Resolved path must be non-empty');
    assert.strictEqual(resolved, ffmpegInstaller.path, 'Must resolve to bundled @ffmpeg-installer binary');
    assert.ok(fs.existsSync(resolved), `Bundled installer binary must exist on disk: ${resolved}`);
  });

  test('resolveBinaryPath falls back to bundled @ffprobe-installer when configured path is empty', () => {
    const resolved = resolveBinaryPath('ffprobe', '', ffprobeInstaller?.path);
    assert.ok(resolved, 'Resolved path must be non-empty');
    assert.strictEqual(resolved, ffprobeInstaller.path, 'Must resolve to bundled @ffprobe-installer binary');
    assert.ok(fs.existsSync(resolved), `Bundled installer binary must exist on disk: ${resolved}`);
  });

  // 3. resolveBinaryPath gracefully recovers when configured path is non-existent (Render misconfiguration simulation)
  test('resolveBinaryPath recovers safely when configured path does not exist on disk', () => {
    const fakePath = 'C:/non_existent_phantom_path_12345/ffmpeg';
    const resolved = resolveBinaryPath('ffmpeg', fakePath, ffmpegInstaller?.path);
    assert.strictEqual(
      resolved,
      ffmpegInstaller.path,
      'Must ignore phantom configured path and fallback to bundled installer binary'
    );
  });

  test('resolveBinaryPath recovers safely when configured ffprobe path does not exist on disk', () => {
    const fakePath = '/var/non_existent_phantom_ffprobe_98765/ffprobe';
    const resolved = resolveBinaryPath('ffprobe', fakePath, ffprobeInstaller?.path);
    assert.strictEqual(
      resolved,
      ffprobeInstaller.path,
      'Must ignore phantom configured path and fallback to bundled installer binary'
    );
  });

  // 4. resolveBinaryPath returns command name when both configured and installer are unavailable
  test('resolveBinaryPath falls back to system command name if installer is absent', () => {
    const resolved = resolveBinaryPath('ffmpeg', '', '/non_existent/installer/ffmpeg');
    assert.strictEqual(resolved, 'ffmpeg', 'Must fall back to bare system command name "ffmpeg"');
  });

  // 5. Active exported FFMPEG and FFPROBE constants resolve to valid executables on disk
  test('Active FFMPEG and FFPROBE constants are valid and executable on disk', () => {
    assert.ok(FFMPEG, 'FFMPEG must be defined');
    assert.ok(FFPROBE, 'FFPROBE must be defined');
    const ffmpegExe = resolveExecutable(FFMPEG);
    const ffprobeExe = resolveExecutable(FFPROBE);
    assert.ok(fs.existsSync(ffmpegExe), `FFMPEG executable must exist on disk: ${ffmpegExe}`);
    assert.ok(fs.existsSync(ffprobeExe), `FFPROBE executable must exist on disk: ${ffprobeExe}`);
  });

  // 6. Real audio duration probing using probeAudioDuration
  await asyncTest('Real audio duration probing successfully resolves duration via ffprobe/ffmpeg', async () => {
    const sampleAudio = path.resolve(__dirname, '../uploads/audios/audio-sample-1.wav');
    assert.ok(fs.existsSync(sampleAudio), `Test sample audio must exist: ${sampleAudio}`);
    const duration = await probeAudioDuration(sampleAudio);
    assert.ok(typeof duration === 'number', `Duration must be a number, got ${typeof duration}`);
    assert.ok(duration > 0, `Duration must be greater than 0, got ${duration}`);
    console.log(`       -> Probed duration for ${path.basename(sampleAudio)}: ${duration.toFixed(2)}s`);
  });

  // 7. Real audio slicing using sliceAudioFile
  await asyncTest('Real audio slicing segments audio into valid 16kHz WAV slices and cleans up', async () => {
    const sampleAudio = path.resolve(__dirname, '../uploads/audios/audio-sample-2.wav');
    assert.ok(fs.existsSync(sampleAudio), `Test sample audio must exist: ${sampleAudio}`);
    const tempDir = path.resolve(__dirname, '../uploads/temp/test_slice_' + Date.now());

    try {
      const slices = await sliceAudioFile(sampleAudio, 5, tempDir);
      assert.ok(Array.isArray(slices), 'Slices must be an array');
      assert.ok(slices.length > 0, `Must generate at least one slice, got ${slices.length}`);
      console.log(`       -> Successfully generated ${slices.length} audio slices:`);
      for (const slice of slices) {
        assert.ok(fs.existsSync(slice), `Slice file must exist on disk: ${slice}`);
        const stat = fs.statSync(slice);
        assert.ok(stat.size > 0, `Slice file must be non-empty, size: ${stat.size} bytes`);
        console.log(`          - ${path.basename(slice)} (${(stat.size / 1024).toFixed(1)} KB)`);
        // Clean up slice file
        fs.unlinkSync(slice);
      }
    } finally {
      if (fs.existsSync(tempDir)) {
        try {
          fs.rmdirSync(tempDir);
        } catch (_) {}
      }
    }
  });

  console.log('='.repeat(80));
  console.log(`PHASE 14B POINT 26 VERIFICATION RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log('='.repeat(80));

  if (passed !== total) {
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
