import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import type { Paginated } from '@qualitytest/shared';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireProjectRole } from '../common/decorators/require-project-role.decorator';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateNotificationDestinationDto } from './dto/create-notification-destination.dto';
import { CreateNotificationRuleDto } from './dto/create-notification-rule.dto';
import { ListNotificationDeliveriesQueryDto } from './dto/list-notification-deliveries-query.dto';
import { UpdateNotificationDestinationDto } from './dto/update-notification-destination.dto';
import type {
  NotificationDeliveryView,
  NotificationDestinationView,
  NotificationRuleView,
} from './notification.mapper';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('projects/:projectId/notifications')
@UseGuards(ProjectAccessGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /* ------------------------------- Destinos ------------------------------- */

  @Get('destinations')
  @ApiOperation({ summary: 'Lista destinos de notificação (membro ativo ou ADMINISTRADOR).' })
  @ApiOkResponse({ description: 'Destinos do projeto.' })
  listDestinations(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('projectId') projectId: string,
  ): Promise<NotificationDestinationView[]> {
    return this.notificationsService.listDestinations(actor, projectId);
  }

  @Post('destinations')
  @RequireProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Cria destino de notificação (ADMINISTRADOR ou GESTOR do projeto).' })
  @ApiCreatedResponse({ description: 'Destino criado (inicia desabilitado por padrão).' })
  createDestination(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateNotificationDestinationDto,
  ): Promise<NotificationDestinationView> {
    return this.notificationsService.createDestination(actor, projectId, dto);
  }

  @Patch('destinations/:destinationId')
  @RequireProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Edita/habilita destino (ADMINISTRADOR ou GESTOR do projeto).' })
  @ApiOkResponse({ description: 'Destino atualizado.' })
  updateDestination(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('destinationId') destinationId: string,
    @Body() dto: UpdateNotificationDestinationDto,
  ): Promise<NotificationDestinationView> {
    return this.notificationsService.updateDestination(actor, projectId, destinationId, dto);
  }

  /* -------------------------------- Regras -------------------------------- */

  @Get('rules')
  @ApiOperation({ summary: 'Lista regras de notificação (membro ativo ou ADMINISTRADOR).' })
  @ApiOkResponse({ description: 'Regras do projeto.' })
  listRules(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('projectId') projectId: string,
  ): Promise<NotificationRuleView[]> {
    return this.notificationsService.listRules(actor, projectId);
  }

  @Post('rules')
  @RequireProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Cria regra de notificação (ADMINISTRADOR ou GESTOR do projeto).' })
  @ApiCreatedResponse({ description: 'Regra criada.' })
  createRule(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateNotificationRuleDto,
  ): Promise<NotificationRuleView> {
    return this.notificationsService.createRule(actor, projectId, dto);
  }

  /* ------------------------------- Entregas ------------------------------- */

  @Get('deliveries')
  @ApiOperation({ summary: 'Histórico de entregas de notificação (membro ativo ou ADMINISTRADOR).' })
  @ApiOkResponse({ description: 'Entregas paginadas.' })
  listDeliveries(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Query() query: ListNotificationDeliveriesQueryDto,
  ): Promise<Paginated<NotificationDeliveryView>> {
    return this.notificationsService.listDeliveries(actor, projectId, query);
  }
}
