import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { GlobalRolesGuard } from './common/guards/global-roles.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { parseDurationToSeconds, validateEnv } from './common/config/env';
import { TokensModule } from './common/tokens/tokens.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectMembersModule } from './project-members/project-members.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Ordem de precedência: .env local do app e, depois, .env da raiz do monorepo.
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: parseDurationToSeconds(configService.get<string>('THROTTLE_TTL'), 60) * 1000,
            limit: Number(configService.get<string>('THROTTLE_LIMIT') ?? '100') || 100,
          },
        ],
      }),
    }),
    PrismaModule,
    TokensModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ProjectMembersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: GlobalRolesGuard },
  ],
})
export class AppModule {}
