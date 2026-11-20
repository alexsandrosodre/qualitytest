import { Injectable, Logger } from '@nestjs/common';
import { API_VERSION, type DependencyStatus, type HealthStatus } from '@qualitytest/shared';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthStatus> {
    const database = await this.checkDatabase();

    return {
      status: database === 'down' ? 'degraded' : 'ok',
      service: 'qualitytest-api',
      version: API_VERSION,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database },
    };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch (error: unknown) {
      this.logger.warn(
        `Checagem do banco falhou: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      );
      return 'down';
    }
  }
}
