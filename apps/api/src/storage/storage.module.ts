import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { S3StorageService } from './s3-storage.service';
import { InMemoryStorageService, STORAGE_SERVICE, type StorageService } from './storage.service';

/**
 * Seleciona o adaptador de storage em runtime:
 * - S3 quando `S3_ENDPOINT` e `S3_BUCKET` estão configurados;
 * - in-memory caso contrário (dev/testes), com aviso claro no log.
 *
 * A ausência de S3 NÃO impede a inicialização da API (seção 5/12/14).
 */
@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StorageService => {
        const logger = new Logger('StorageModule');
        const endpoint = config.get<string>('S3_ENDPOINT');
        const bucket = config.get<string>('S3_BUCKET');

        if (endpoint !== undefined && endpoint.length > 0 && bucket !== undefined && bucket.length > 0) {
          const region = config.get<string>('S3_REGION') ?? 'us-east-1';
          logger.log(`Storage S3 habilitado (endpoint="${endpoint}", bucket="${bucket}", região="${region}").`);

          return new S3StorageService({
            endpoint,
            region,
            bucket,
            accessKeyId: config.get<string>('S3_ACCESS_KEY') ?? '',
            secretAccessKey: config.get<string>('S3_SECRET_KEY') ?? '',
            forcePathStyle: true,
          });
        }

        logger.warn(
          'S3 não configurado (S3_ENDPOINT/S3_BUCKET ausentes). ' +
            'Usando armazenamento em memória — NÃO usar em produção.',
        );

        return new InMemoryStorageService();
      },
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
