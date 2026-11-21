import { validateEnv } from './env';

const STRONG_SECRET = 'a'.repeat(40);
const DEV_EXAMPLE_SECRET = 'dev-only-insecure-secret-change-me-0123456789abcdef';

describe('validateEnv', () => {
  it('lança quando JWT_SECRET está ausente ou vazia', () => {
    expect(() => validateEnv({})).toThrow(/JWT_SECRET/);
    expect(() => validateEnv({ JWT_SECRET: '   ' })).toThrow(/JWT_SECRET/);
  });

  it('lança quando JWT_SECRET é mais curta que o mínimo exigido', () => {
    expect(() => validateEnv({ JWT_SECRET: 'curta' })).toThrow(/muito curta/);
  });

  it('aceita um segredo forte fora de produção', () => {
    const config = { JWT_SECRET: STRONG_SECRET, NODE_ENV: 'development' };
    expect(validateEnv(config)).toBe(config);
  });

  it('aceita o valor de exemplo fora de produção (uso local)', () => {
    expect(() =>
      validateEnv({ JWT_SECRET: DEV_EXAMPLE_SECRET, NODE_ENV: 'development' }),
    ).not.toThrow();
  });

  it('rejeita o valor de exemplo público em produção', () => {
    expect(() =>
      validateEnv({ JWT_SECRET: DEV_EXAMPLE_SECRET, NODE_ENV: 'production' }),
    ).toThrow(/produção/);
  });

  it('aceita um segredo forte em produção', () => {
    const config = { JWT_SECRET: STRONG_SECRET, NODE_ENV: 'production' };
    expect(validateEnv(config)).toBe(config);
  });
});
