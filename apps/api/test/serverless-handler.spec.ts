import type { INestApplication } from '@nestjs/common';
import type { Request, Response } from 'express';

import handler from '../api/[...path]';
import { createApiApp } from '../src/bootstrap';

jest.mock('../src/bootstrap', () => ({ createApiApp: jest.fn() }));

describe('Vercel API handler', () => {
  it('encaminha as requisições ao Express e reutiliza a aplicação inicializada', async () => {
    const expressHandler = jest.fn();
    const app = {
      getHttpAdapter: () => ({ getInstance: () => expressHandler }),
    } as unknown as INestApplication;

    jest.mocked(createApiApp).mockResolvedValue(app);

    const request = {} as Request;
    const response = {} as Response;

    await handler(request, response);
    await handler(request, response);

    expect(createApiApp).toHaveBeenCalledTimes(1);
    expect(expressHandler).toHaveBeenCalledTimes(2);
    expect(expressHandler).toHaveBeenNthCalledWith(1, request, response);
    expect(expressHandler).toHaveBeenNthCalledWith(2, request, response);
  });
});
