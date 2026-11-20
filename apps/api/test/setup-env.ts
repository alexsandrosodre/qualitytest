/**
 * Variáveis de ambiente de teste. Executado pelo Jest (`setupFiles`) ANTES
 * de qualquer import de módulo, garantindo que `JWT_SECRET` exista quando o
 * `AppModule` (e o `ConfigModule`) forem avaliados.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-only-secret-do-not-use-in-production-0123456789';
process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? '15m';
process.env.JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? '7d';
process.env.THROTTLE_TTL = process.env.THROTTLE_TTL ?? '60';
// Limite alto nos testes para não sofrer bloqueio de rate limit ao chamar
// vários endpoints no mesmo cenário.
process.env.THROTTLE_LIMIT = process.env.THROTTLE_LIMIT ?? '10000';
