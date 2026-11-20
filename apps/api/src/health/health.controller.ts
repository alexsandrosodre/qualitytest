import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { HealthStatus } from '@qualitytest/shared';

import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Status da API e checagem simples de dependências' })
  @ApiOkResponse({ description: 'Status atual do serviço.' })
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
