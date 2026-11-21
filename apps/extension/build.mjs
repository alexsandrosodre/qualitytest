import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const rootDir = dirname(fileURLToPath(import.meta.url));
const srcDir = join(rootDir, 'src');
const outDir = join(rootDir, 'dist');

/**
 * URL base da API usada pela extensão. Vem do ambiente no momento do build;
 * o padrão é o backend de desenvolvimento local. O domínio oficial de produção
 * segue PENDENTE DE DEFINIÇÃO (docs/architecture/extensao-chrome.md §11).
 */
const apiBaseUrl = (process.env.QUALITYTEST_API_BASE_URL ?? 'http://localhost:3333/api').trim();

/** Deriva a permissão de host (`origin/*`) da URL base da API. */
function apiHostPermission(baseUrl) {
  try {
    return `${new URL(baseUrl).origin}/*`;
  } catch {
    return null;
  }
}

/**
 * Ajusta o `host_permissions` do manifest para incluir a origem da API usada.
 * Sem isso, a extensão não conseguiria chamar um domínio oficial configurado.
 */
async function patchManifest(targetDir, permission) {
  if (permission === null) {
    console.warn(`[manifest] URL da API inválida; mantendo host_permissions padrão: ${apiBaseUrl}`);
    return;
  }
  const manifestPath = join(targetDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const hosts = new Set(Array.isArray(manifest.host_permissions) ? manifest.host_permissions : []);
  hosts.add(permission);
  manifest.host_permissions = [...hosts];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

/** Opções compartilhadas pelos dois pontos de entrada da extensão. */
const sharedOptions = {
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  sourcemap: true,
  minify: false,
  define: {
    'process.env.NODE_ENV': '"production"',
    QUALITYTEST_API_BASE_URL: JSON.stringify(apiBaseUrl),
  },
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

  await patchManifest(outDir, apiHostPermission(apiBaseUrl));

  const files = (await readdir(outDir)).sort();
  console.log(`\nAPI base URL: ${apiBaseUrl}`);
  console.log('Extensão QUALITY TEST gerada em apps/extension/dist/:');
  for (const file of files) {
    console.log(`  - ${file}`);
  }
}

run().catch((error) => {
  console.error('Falha ao gerar a extensão:', error);
  process.exitCode = 1;
});
