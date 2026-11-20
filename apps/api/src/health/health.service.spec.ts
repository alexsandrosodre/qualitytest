import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  const prismaMock = { $queryRaw: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = moduleRef.get(HealthService);
  });

  it('retorna status ok quando o banco responde', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('qualitytest-api');
    expect(result.checks.database).toBe('up');
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('marca o banco como down e o status como degraded quando a consulta falha', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('sem conexão'));

    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.checks.database).toBe('down');
  });
});
