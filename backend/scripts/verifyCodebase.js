/**
 * @module scripts/verifyCodebase
 * @description Ultra-fast parallel static syntax compiler checking all backend files with node --check.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SRC_DIR = path.resolve('src');

/**
 * Recursively crawls a directory for all .js files.
 * @function discoverJsFiles
 * @param {string} dir - Root directory path.
 * @returns {Promise<string[]>} List of absolute file paths.
 */
const discoverJsFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const res = path.resolve(dir, entry.name);
      if (entry.isDirectory()) {
        return discoverJsFiles(res);
      }
      return entry.isFile() && entry.name.endsWith('.js') ? [res] : [];
    })
  );
  return files.flat();
};

/**
 * Main verification runner executing parallel node --check validations.
 * @function runVerification
 * @returns {Promise<void>}
 */
const runVerification = async () => {
  const startTime = Date.now();
  console.log('⚡ Starting ultra-fast backend static syntax compilation...');

  try {
    const files = await discoverJsFiles(SRC_DIR);
    if (files.length === 0) {
      console.warn('⚠️ No JavaScript files found in src directory.');
      process.exit(0);
    }

    let failureCount = 0;
    const failureDetails = [];

    // Parallel execution across all discovered files
    await Promise.all(
      files.map(async (file) => {
        try {
          await execFileAsync(process.execPath, ['--check', file]);
        } catch (err) {
          failureCount += 1;
          failureDetails.push({
            file: path.relative(process.cwd(), file),
            error: err.stderr || err.message,
          });
        }
      })
    );

    const duration = Date.now() - startTime;

    if (failureCount === 0) {
      console.log(`✅ [PASS] 100% of backend codebase compiled successfully (${files.length} files in ${duration}ms).`);
      process.exit(0);
    } else {
      console.error(`❌ [FAIL] Syntax compilation failed in ${failureCount} file(s) (${duration}ms):\n`);
      failureDetails.forEach(({ file, error }) => {
        console.error(`  - ${file}:`);
        console.error(`    ${error.trim().split('\n').join('\n    ')}\n`);
      });
      process.exit(1);
    }
  } catch (fatalError) {
    console.error('Fatal error during verification run:', fatalError);
    process.exit(1);
  }
};

runVerification();
