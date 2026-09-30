import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorker, type Worker } from 'tesseract.js';

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve('tesseract.js'));
const coreRoot = dirname(require.resolve('tesseract.js-core'));
const languageFile = fileURLToPath(new URL('../eng.traineddata', import.meta.url));
const workerPath = join(packageRoot, 'worker-script', 'node', 'index.js');

/** OCR assets are packaged with the API; no CDN or language download is used at runtime. */
export function hasLocalOcrAssets() {
  const fs = require('node:fs') as typeof import('node:fs');
  return [
    languageFile,
    workerPath,
    join(coreRoot, 'tesseract-core-lstm.wasm.js'),
    join(coreRoot, 'tesseract-core-lstm.wasm'),
  ].every((path) => fs.existsSync(path));
}

export function createLocalOcrWorker(): Promise<Worker> {
  if (!hasLocalOcrAssets()) return Promise.reject(new Error('Packaged local Tesseract OCR assets are unavailable.'));
  return createWorker('eng', undefined, {
    workerPath,
    corePath: coreRoot,
    langPath: dirname(languageFile),
    gzip: false,
    cacheMethod: 'none',
  });
}
