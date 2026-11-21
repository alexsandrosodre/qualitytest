import type { INestApplication } from '@nestjs/common';
import type { Request, Response } from 'express';

import { createApiApp } from '../src/bootstrap';

let appPromise: Promise<INestApplication> | undefined;

function getApiApp(): Promise<INestApplication> {
  appPromise ??= createApiApp().catch((error: unknown) => {
    appPromise = undefined;
    throw error;
  });

  return appPromise;
}

export default async function handler(request: Request, response: Response): Promise<void> {
  try {
    const app = await getApiApp();
    const expressApp = app.getHttpAdapter().getInstance() as (
      request: Request,
      response: Response,
    ) => void;

    expressApp(request, response);
  } catch (error: unknown) {
    console.error(
      'Falha ao inicializar a API serverless:',
      error instanceof Error ? error.message : 'erro desconhecido',
    );

    if (!response.headersSent) {
      response.status(500).json({ statusCode: 500, message: 'Internal server error' });
    }
  }
}
