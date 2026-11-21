/**
 * Usa a URL pooled da integração Supabase quando DATABASE_URL não foi definida.
 * DATABASE_URL continua tendo precedência para desenvolvimento e containers.
 */
export function applyDatabaseUrlFallback(
  env: Record<string, string | undefined> = process.env,
): void {
  if (env['DATABASE_URL']?.trim()) {
    return;
  }

  const pooledUrl = env['DATABASE_POSTGRES_PRISMA_URL']?.trim();
  if (pooledUrl) {
    env['DATABASE_URL'] = pooledUrl;
  }
}
