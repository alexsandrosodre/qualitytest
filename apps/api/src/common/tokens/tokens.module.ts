import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { parseDurationToSeconds, requireEnv } from '../config/env';
import { TokenService } from './token.service';

/**
 * Módulo global de tokens. Configura o `JwtModule` com o segredo
 * (`JWT_SECRET`) e a expiração do access token (`JWT_ACCESS_TTL`).
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: requireEnv('JWT_SECRET'),
        signOptions: {
          expiresIn: parseDurationToSeconds(configService.get<string>('JWT_ACCESS_TTL'), 900),
        },
      }),
    }),
  ],
  providers: [TokenService],
  exports: [TokenService, JwtModule],
})
export class TokensModule {}
