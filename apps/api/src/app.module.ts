import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { AccessModule } from './common/access/access.module';
import { GlobalRolesGuard } from './common/guards/global-roles.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { parseDurationToSeconds, validateEnv } from './common/config/env';
import { TokensModule } from './common/tokens/tokens.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OccurrencesModule } from './occurrences/occurrences.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectDomainsModule } from './project-domains/project-domains.module';
import { ProjectEnvironmentsModule } from './project-environments/project-environments.module';
import { ProjectMembersModule } from './project-members/project-members.module';
import { ProjectsModule } from './projects/projects.module';
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
    AccessModule,
    TokensModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    ProjectMembersModule,
    ProjectEnvironmentsModule,
    ProjectDomainsModule,
    OccurrencesModule,
    NotificationsModule,
    AiModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: GlobalRolesGuard },
  ],
})
export class AppModule {}
