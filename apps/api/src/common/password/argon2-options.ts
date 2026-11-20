import { argon2id, type HashOptions } from 'argon2';

/**
 * Parâmetros do argon2id alinhados às recomendações atuais da OWASP
 * (19 MiB de memória, 2 iterações, paralelismo 1).
 *
 * Exportado para ser reutilizado por qualquer ponto que gere hash de senha
 * (serviço da API e seed de desenvolvimento), evitando divergência de formato.
 */
export const ARGON2_OPTIONS: HashOptions = {
  type: argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};
