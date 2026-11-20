/**
 * Utilidades de configuração de ambiente.
 *
 * Falha com mensagem clara quando uma variável obrigatória está ausente
 * (ver `.env.example` na raiz do monorepo).
 */

const DURATION_UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
};

/** Converte uma duração textual (`900`, `15m`, `7d`) em segundos. */
export function parseDurationToSeconds(value: string | undefined, fallbackSeconds: number): number {
  if (value === undefined) {
    return fallbackSeconds;
  }

  const trimmed = value.trim();

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const match = /^(\d+)([smhd])$/.exec(trimmed);

  if (match === null) {
    return fallbackSeconds;
  }

  const amount = Number(match[1]);
  const unit = DURATION_UNIT_SECONDS[match[2] ?? ''] ?? 1;

  return amount * unit;
}

/** Lê uma variável de ambiente obrigatória ou lança erro com mensagem clara. */
export function requireEnv(key: string): string {
  const value = process.env[key];

  if (value === undefined || value.trim().length === 0) {
    throw new Error(
      `Variável de ambiente obrigatória ausente: ${key}. ` +
        'Defina-a no arquivo .env da raiz do monorepo (veja .env.example).',
    );
  }

  return value;
}

/** Validação aplicada pelo ConfigModule (`validate`). */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const jwtSecret = config['JWT_SECRET'];

  if (typeof jwtSecret !== 'string' || jwtSecret.trim().length === 0) {
    throw new Error(
      'JWT_SECRET é obrigatória e não foi definida. Copie .env.example para .env e ' +
        'informe um segredo forte (em produção: valor aleatório com 32+ bytes).',
    );
  }

  return config;
}
