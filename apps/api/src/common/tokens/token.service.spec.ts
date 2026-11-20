import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { GlobalRole } from '@prisma/client';
import { createHash } from 'node:crypto';

import { TokenService } from './token.service';

describe('TokenService', () => {
  const secret = 'unit-test-secret-0123456789';
  let service: TokenService;

  beforeEach(() => {
    const jwtService = new JwtService({ secret, signOptions: { expiresIn: 900 } });
    const configService = new ConfigService({ JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL: '7d' });
    service = new TokenService(jwtService, configService);
  });

  it('gera e valida um access token com sub e perfil global', async () => {
    const token = await service.generateAccessToken({
      sub: 'user-1',
      globalRole: GlobalRole.ADMINISTRADOR,
    });

    const payload = await service.verifyAccessToken(token);

    expect(payload.sub).toBe('user-1');
    expect(payload.globalRole).toBe(GlobalRole.ADMINISTRADOR);
  });

  it('rejeita um access token assinado com outro segredo', async () => {
    const foreign = new JwtService({ secret: 'outro-segredo', signOptions: { expiresIn: 900 } });
    const token = await foreign.signAsync({ sub: 'user-1', globalRole: null });

    await expect(service.verifyAccessToken(token)).rejects.toBeDefined();
  });

  it('gera um refresh token opaco cujo hash é o SHA-256 do token', () => {
    const { token, tokenHash } = service.generateRefreshToken();

    expect(tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(service.hashRefreshToken(token)).toBe(tokenHash);
  });

  it('gera refresh tokens distintos a cada chamada', () => {
    expect(service.generateRefreshToken().token).not.toBe(service.generateRefreshToken().token);
  });

  it('resolve os TTLs a partir da configuração', () => {
    expect(service.getAccessTokenTtlSeconds()).toBe(900);
    expect(service.getRefreshTokenTtlMs()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
