import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const rootDir = dirname(fileURLToPath(import.meta.url));
const srcDir = join(rootDir, 'src');
const outDir = join(rootDir, 'dist');

/** Opções compartilhadas pelos dois pontos de entrada da extensão. */
const sharedOptions = {
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  sourcemap: true,
  minify: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
};

/**
 * Empacota os pontos de entrada (popup + service worker) e copia os arquivos
 * estáticos (manifest, HTML e CSS) para `dist/`.
 */
async function run() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  await Promise.all([
    build({
      ...sharedOptions,
      entryPoints: [join(srcDir, 'popup', 'main.tsx')],
      outfile: join(outDir, 'popup.js'),
    }),
    build({
      ...sharedOptions,
      entryPoints: [join(srcDir, 'background.ts')],
      outfile: join(outDir, 'background.js'),
    }),
  ]);

  await Promise.all([
    cp(join(srcDir, 'manifest.json'), join(outDir, 'manifest.json')),
    cp(join(srcDir, 'popup', 'popup.html'), join(outDir, 'popup.html')),
    cp(join(srcDir, 'popup', 'styles.css'), join(outDir, 'styles.css')),
  ]);

  const files = (await readdir(outDir)).sort();
  console.log('\nExtensão QUALITY TEST gerada em apps/extension/dist/:');
  for (const file of files) {
    console.log(`  - ${file}`);
  }
}

run().catch((error) => {
  console.error('Falha ao gerar a extensão:', error);
  process.exitCode = 1;
});
