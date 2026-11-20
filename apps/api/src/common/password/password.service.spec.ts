import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('gera um hash argon2id e verifica a senha correta', async () => {
    const hash = await service.hash('Senha@12345');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(service.verify(hash, 'Senha@12345')).resolves.toBe(true);
  });

  it('rejeita uma senha incorreta', async () => {
    const hash = await service.hash('Senha@12345');

    await expect(service.verify(hash, 'outra-senha')).resolves.toBe(false);
  });

  it('não lança ao verificar um hash malformado', async () => {
    await expect(service.verify('nao-e-um-hash-argon2', 'Senha@12345')).resolves.toBe(false);
  });

  it('gera hashes diferentes (salt aleatório) para a mesma senha', async () => {
    const [first, second] = await Promise.all([
      service.hash('Senha@12345'),
      service.hash('Senha@12345'),
    ]);

    expect(first).not.toBe(second);
  });
});
