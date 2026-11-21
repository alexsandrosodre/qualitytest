import { Module } from '@nestjs/common';

import { AuditModule } from '../common/audit/audit.module';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';
import { NotificationQueueModule } from './notification-queue.module';
import { NotificationsAdminController } from './notifications-admin.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/**
 * Módulo de notificações (ETAPA 8).
 *
 * - `NotificationQueueModule`: publicação assíncrona na fila BullMQ.
 * - `NotificationsController`: destinos, regras e histórico por projeto.
 * - `NotificationsAdminController`: reprocessamento administrativo.
 *
 * A autorização por projeto é delegada à `ProjectAccessService` (módulo global).
 */
@Module({
  imports: [AuditModule, NotificationQueueModule],
  controllers: [NotificationsController, NotificationsAdminController],
  providers: [NotificationsService, ProjectAccessGuard],
  exports: [NotificationQueueModule],
})
export class NotificationsModule {}
