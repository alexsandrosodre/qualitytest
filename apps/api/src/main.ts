import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { API_PREFIX } from '@qualitytest/shared';

import { createApiApp } from './bootstrap';
import { resolveCorsOrigins } from './common/security/security.middleware';

function resolvePort(): number {
  // `API_PORT` tem precedência; `PORT` é o padrão usado por PaaS (ex.: Render).
  const raw = process.env.API_PORT ?? process.env.PORT ?? '3333';
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 3333 : parsed;
}

async function bootstrap(): Promise<void> {
  const app = await createApiApp();

  const port = resolvePort();
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API disponível em http://localhost:${port}/${API_PREFIX}`);
  logger.log(`Swagger disponível em http://localhost:${port}/${API_PREFIX}/docs`);
  logger.log(`CORS liberado para: ${resolveCorsOrigins().join(', ')}`);
}

bootstrap().catch((error: unknown) => {
  const message: string = error instanceof Error ? error.message : String(error);
  console.error(`Falha ao iniciar a API: ${message}`);
  process.exit(1);
});
