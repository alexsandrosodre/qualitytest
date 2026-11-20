import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard de autenticação global. Valida o access token JWT via Passport
 * (estratégia `jwt`) e resolve o usuário autenticado, exceto em rotas `@Public()`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic === true) {
      return true;
    }

    return super.canActivate(context);
  }

  override handleRequest<TUser>(err: unknown, user: TUser): TUser {
    if (err !== null && err !== undefined) {
      throw err as Error;
    }

    // O Passport devolve `false` (não apenas null/undefined) quando não há
    // token válido; por isso a checagem de veracidade é necessária.
    if (!user) {
      throw new UnauthorizedException('Sessão inválida ou ausente.');
    }

    return user;
  }
}
