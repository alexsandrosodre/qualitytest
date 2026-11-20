import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { RegistrationStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { requireEnv } from '../../common/config/env';
import { PrismaService } from '../../prisma/prisma.service';
import type { AccessTokenPayload, AuthenticatedUser } from '../../common/types/authenticated-user';

/**
 * Estratégia Passport JWT. Valida o access token e resolve o usuário
 * autenticado a partir do banco (status ATIVO obrigatório).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireEnv('JWT_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (user === null || user.status !== RegistrationStatus.ATIVO) {
      throw new UnauthorizedException('Sessão inválida ou usuário inativo.');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      globalRole: user.globalRole,
      status: user.status,
    };
  }
}
