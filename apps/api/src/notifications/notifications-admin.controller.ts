import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GlobalRole } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireGlobalRole } from '../common/decorators/require-global-role.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import type { NotificationDeliveryView } from './notification.mapper';
import { NotificationsService } from './notifications.service';

/**
 * Operações administrativas de notificação (contratos-api.md, seção 12).
 * O `GlobalRolesGuard` global aplica o `@RequireGlobalRole`.
 */
@ApiTags('notifications-admin')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsAdminController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('deliveries/:deliveryId/reprocess')
  @HttpCode(200)
  @RequireGlobalRole(GlobalRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Reprocessa uma entrega de notificação (somente ADMINISTRADOR).' })
  @ApiOkResponse({ description: 'Entrega reenfileirada para reprocessamento.' })
  reprocessDelivery(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('deliveryId') deliveryId: string,
  ): Promise<NotificationDeliveryView> {
    return this.notificationsService.reprocessDelivery(actor, deliveryId);
  }
}
