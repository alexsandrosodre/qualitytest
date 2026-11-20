import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Ordem de precedência: .env local do app e, depois, .env da raiz do monorepo.
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
