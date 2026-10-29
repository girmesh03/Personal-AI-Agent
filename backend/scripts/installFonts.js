#!/usr/bin/env node

/**
 * @file installFonts.js
 * @description Automated user-space font installer for headless Linux environments (Render / Docker).
 * Copies TrueType Ethiopic fonts into Fontconfig user directory (~/.local/share/fonts)
 * and refreshes the font cache with fc-cache.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FONTS_SRC = path.resolve(__dirname, '../src/assets/fonts');

function installFonts() {
  console.log('[installFonts] Checking font installation environment...');

  if (process.platform !== 'linux') {
    console.log(`[installFonts] Platform is ${process.platform}. Linux fontconfig installation skipped.`);
    return;
  }

  try {
    const homedir = os.homedir();
    const targetDir = path.join(homedir, '.local', 'share', 'fonts', 'noto-sans-ethiopic');
    const legacyDir = path.join(homedir, '.fonts', 'noto-sans-ethiopic');

    fs.mkdirSync(targetDir, { recursive: true });
    fs.mkdirSync(legacyDir, { recursive: true });

    if (!fs.existsSync(FONTS_SRC)) {
      console.warn(`[installFonts] Warning: Source fonts directory not found at ${FONTS_SRC}`);
      return;
    }

    const fontFiles = fs.readdirSync(FONTS_SRC).filter((f) => f.endsWith('.ttf') || f.endsWith('.otf'));
    console.log(`[installFonts] Found ${fontFiles.length} font binaries in ${FONTS_SRC}`);

    for (const font of fontFiles) {
      const srcPath = path.join(FONTS_SRC, font);
      const dstPath1 = path.join(targetDir, font);
      const dstPath2 = path.join(legacyDir, font);

      fs.copyFileSync(srcPath, dstPath1);
      fs.copyFileSync(srcPath, dstPath2);
      console.log(`[installFonts] Installed ${font} to ~/.local/share/fonts/`);
    }

    // Attempt to refresh fontconfig cache
    try {
      execSync('fc-cache -f ~/.local/share/fonts/ 2>/dev/null || fc-cache -f 2>/dev/null', {
        stdio: 'inherit',
        timeout: 10000,
      });
      console.log('[installFonts] Fontconfig cache refreshed successfully via fc-cache.');
    } catch (cacheErr) {
      console.log('[installFonts] Note: fc-cache returned non-zero or not found; relying on runtime FONTCONFIG_PATH.');
    }

    console.log('[installFonts] Linux font installation complete.');
  } catch (err) {
    console.warn('[installFonts] Non-fatal font installation error:', err.message);
  }
}

installFonts();
