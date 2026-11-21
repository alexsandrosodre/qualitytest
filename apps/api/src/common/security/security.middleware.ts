import { type INestApplication } from '@nestjs/common';
import { API_PREFIX } from '@qualitytest/shared';
import { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';

/**
 * Endurecimento de segurança aplicado no bootstrap da API (ETAPA 10).
 *
 * - `helmet`: headers de segurança (CSP, X-Content-Type-Options, X-Frame-Options,
 *   HSTS, Referrer-Policy, etc.) e remoção do header `X-Powered-By`.
 * - A UI do Swagger usa scripts/estilos inline; por isso o CSP é relaxado
 *   **somente** na rota de documentação, mantendo o CSP estrito nas rotas de API.
 * - CORS restrito a uma whitelist de origens (nunca wildcard com credenciais).
 *
 * Mantido em uma função isolada para permitir testes automatizados.
 */

/** Origem padrão de desenvolvimento quando `CORS_ORIGIN` não é informado. */
const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';

/** CSP relaxado, aplicado apenas à página de documentação (Swagger UI). */
const SWAGGER_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
].join('; ');

/** Resolve a whitelist de origens a partir de `CORS_ORIGIN` (CSV). */
export function resolveCorsOrigins(raw: string | undefined = process.env.CORS_ORIGIN): string[] {
  return (raw ?? DEFAULT_CORS_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/** Aplica helmet, o CSP do Swagger e a política de CORS. */
export function applySecurity(app: INestApplication): void {
  app.use(helmet());

  app.use(`/${API_PREFIX}/docs`, (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Security-Policy', SWAGGER_CONTENT_SECURITY_POLICY);
    next();
  });

  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
  });
}
