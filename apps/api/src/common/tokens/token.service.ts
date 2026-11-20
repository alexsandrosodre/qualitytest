import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';

import { parseDurationToSeconds } from '../config/env';
import type { AccessTokenPayload } from '../types/authenticated-user';

export interface GeneratedRefreshToken {
  /** Token opaco (retornado ao cliente apenas uma vez). */
  token: string;
  /** Hash SHA-256 persistido em `RefreshSession.tokenHash`. */
  tokenHash: string;
}

/**
 * Emissão/validação de tokens de sessão.
 *
 * - Access token: JWT de vida curta assinado com `JWT_SECRET`.
 * - Refresh token: string aleatória opaca; apenas o hash SHA-256 é persistido.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  generateAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwtService.signAsync({ sub: payload.sub, globalRole: payload.globalRole });
  }

  verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwtService.verifyAsync<AccessTokenPayload>(token);
  }

  /** Gera um refresh token opaco e o hash correspondente. */
  generateRefreshToken(): GeneratedRefreshToken {
    const token = randomBytes(48).toString('base64url');
    return { token, tokenHash: this.hashRefreshToken(token) };
  }

  /** SHA-256 hex do token (usado para persistir e localizar a sessão). */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  getAccessTokenTtlSeconds(): number {
    return parseDurationToSeconds(this.configService.get<string>('JWT_ACCESS_TTL'), 900);
  }

  getRefreshTokenTtlMs(): number {
    return parseDurationToSeconds(this.configService.get<string>('JWT_REFRESH_TTL'), 604800) * 1000;
  }
}
