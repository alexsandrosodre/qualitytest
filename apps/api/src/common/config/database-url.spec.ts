import { applyDatabaseUrlFallback } from './database-url';

describe('applyDatabaseUrlFallback', () => {
  it('usa a URL pooled do Supabase quando DATABASE_URL está ausente', () => {
    const env: Record<string, string | undefined> = {
      DATABASE_POSTGRES_PRISMA_URL: 'postgresql://pooled.example/db',
    };

    applyDatabaseUrlFallback(env);

    expect(env['DATABASE_URL']).toBe('postgresql://pooled.example/db');
  });

  it('preserva DATABASE_URL quando já está configurada', () => {
    const env: Record<string, string | undefined> = {
      DATABASE_URL: 'postgresql://local.example/db',
      DATABASE_POSTGRES_PRISMA_URL: 'postgresql://pooled.example/db',
    };

    applyDatabaseUrlFallback(env);

    expect(env['DATABASE_URL']).toBe('postgresql://local.example/db');
  });

  it('não cria DATABASE_URL se a URL pooled estiver ausente', () => {
    const env: Record<string, string | undefined> = {};

    applyDatabaseUrlFallback(env);

    expect(env['DATABASE_URL']).toBeUndefined();
  });
});
