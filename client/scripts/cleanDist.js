/**
 * @module scripts/cleanDist
 * @description Mandatory post-build dist/ directory cleaner.
 */
import fs from 'node:fs';
import path from 'node:path';

const distPath = path.resolve('dist');
if (fs.existsSync(distPath)) {
  fs.rmSync(distPath, { recursive: true, force: true });
  console.log('🧹 client/dist/ cleaned up successfully. Working tree preserved.');
}
