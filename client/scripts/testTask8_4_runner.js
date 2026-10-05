/**
 * @module scripts/testTask8_4_runner
 * @description Test runner executing testTask8_4.js within Vite SSR environment.
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import { createServer } from 'vite';

const clientRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const server = await createServer({
  root: clientRoot,
  server: { port: 3001 },
  logLevel: 'error',
});

try {
  await server.ssrLoadModule('/scripts/testTask8_4.js');
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await server.close();
}
