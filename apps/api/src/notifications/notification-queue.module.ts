import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  BullMqNotificationPublisher,
  NOTIFICATION_PUBLISHER,
  NOTIFICATIONS_QUEUE,
  NoopNotificationPublisher,
  type NotificationPublisher,
} from './notification-publisher';

/**
 * Módulo de infraestrutura de fila (seção 7.2).
 *
 * Seleciona o publicador em runtime:
 * - BullMQ quando `NOTIFICATIONS_ENABLED` não é `false` (padrão);
 * - no-op caso contrário (testes/execução sem Redis).
 *
 * A ausência do Redis NÃO impede a inicialização da API: a publicação é
 * assíncrona e nunca bloqueia a operação de negócio.
 */
@Module({
  providers: [
    {
      provide: NOTIFICATION_PUBLISHER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): NotificationPublisher => {
        const logger = new Logger('NotificationQueueModule');
        const flag = (config.get<string>('NOTIFICATIONS_ENABLED') ?? 'true').trim().toLowerCase();

        if (flag === 'false' || flag === '0' || flag === 'off') {
          logger.warn(
            'Notificações desabilitadas (NOTIFICATIONS_ENABLED=false): nenhum evento será enfileirado.',
          );
          return new NoopNotificationPublisher();
        }

        const host = config.get<string>('REDIS_HOST') ?? 'localhost';
        const parsedPort = Number.parseInt(config.get<string>('REDIS_PORT') ?? '6379', 10);
        const parsedDb = Number.parseInt(config.get<string>('REDIS_DB') ?? '0', 10);
        const password = config.get<string>('REDIS_PASSWORD');

        logger.log(
          `Notificações habilitadas: fila "${NOTIFICATIONS_QUEUE}" em ${host}:${
            Number.isNaN(parsedPort) ? 6379 : parsedPort
          }.`,
        );

        return new BullMqNotificationPublisher({
          host,
          port: Number.isNaN(parsedPort) ? 6379 : parsedPort,
          db: Number.isNaN(parsedDb) ? 0 : parsedDb,
          ...(password !== undefined && password.length > 0 ? { password } : {}),
        });
      },
    },
  ],
  exports: [NOTIFICATION_PUBLISHER],
})
export class NotificationQueueModule {}
