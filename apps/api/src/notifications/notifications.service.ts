import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type NotificationDestination } from '@prisma/client';
import { validateChannelConfig, type Paginated } from '@qualitytest/shared';

import { ProjectAccessService } from '../common/access/project-access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateNotificationDestinationDto } from './dto/create-notification-destination.dto';
import {
  CreateNotificationRuleDto,
  type NotificationRuleFiltersDto,
} from './dto/create-notification-rule.dto';
import { ListNotificationDeliveriesQueryDto } from './dto/list-notification-deliveries-query.dto';
import { UpdateNotificationDestinationDto } from './dto/update-notification-destination.dto';
import {
  toNotificationDeliveryView,
  toNotificationDestinationView,
  toNotificationRuleView,
  type NotificationDeliveryView,
  type NotificationDestinationView,
  type NotificationRuleView,
} from './notification.mapper';
import { NOTIFICATION_PUBLISHER, type NotificationPublisher } from './notification-publisher';

/**
 * Configuração de destinos/regras e consulta do histórico de entregas
 * (seção 7 e contratos-api.md, seção 12).
 *
 * O isolamento por projeto é delegado à `ProjectAccessService` (fonte única).
 * Papéis de gestão (GESTOR/ADMINISTRADOR) são exigidos pela `ProjectAccessGuard`.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: ProjectAccessService,
    private readonly auditService: AuditService,
    @Inject(NOTIFICATION_PUBLISHER) private readonly publisher: NotificationPublisher,
  ) {}

  /* ------------------------------- Destinos ------------------------------- */

  async listDestinations(
    actor: AuthenticatedUser,
    projectId: string,
  ): Promise<NotificationDestinationView[]> {
    await this.assertProjectAccess(actor, projectId);

    const destinations = await this.prisma.notificationDestination.findMany({
      where: { projectId },
      orderBy: { channel: 'asc' },
    });

    return destinations.map(toNotificationDestinationView);
  }

  async createDestination(
    actor: AuthenticatedUser,
    projectId: string,
    dto: CreateNotificationDestinationDto,
  ): Promise<NotificationDestinationView> {
    await this.assertProjectAccess(actor, projectId);
    this.assertValidConfig(dto.channel, dto.destinationConfig);

    const destination = await this.prisma.notificationDestination.create({
      data: {
        projectId,
        channel: dto.channel,
        destinationConfig: dto.destinationConfig as Prisma.InputJsonValue,
        enabled: dto.enabled ?? false,
      },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'NOTIFICATION_DESTINATION_CREATED',
      entityType: 'NotificationDestination',
      entityId: destination.id,
      projectId,
      metadata: { channel: destination.channel, enabled: destination.enabled },
    });

    return toNotificationDestinationView(destination);
  }

  async updateDestination(
    actor: AuthenticatedUser,
    projectId: string,
    destinationId: string,
    dto: UpdateNotificationDestinationDto,
  ): Promise<NotificationDestinationView> {
    await this.assertProjectAccess(actor, projectId);
    const destination = await this.findDestinationOrFail(projectId, destinationId);

    if (dto.destinationConfig !== undefined) {
      this.assertValidConfig(destination.channel, dto.destinationConfig);
    }

    const updated = await this.prisma.notificationDestination.update({
      where: { id: destinationId },
      data: {
        ...(dto.destinationConfig === undefined
          ? {}
          : { destinationConfig: dto.destinationConfig as Prisma.InputJsonValue }),
        ...(dto.enabled === undefined ? {} : { enabled: dto.enabled }),
      },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'NOTIFICATION_DESTINATION_UPDATED',
      entityType: 'NotificationDestination',
      entityId: updated.id,
      projectId,
      metadata: { enabled: updated.enabled },
    });

    return toNotificationDestinationView(updated);
  }

  /* -------------------------------- Regras -------------------------------- */

  async listRules(actor: AuthenticatedUser, projectId: string): Promise<NotificationRuleView[]> {
    await this.assertProjectAccess(actor, projectId);

    const rules = await this.prisma.notificationRule.findMany({
      where: { projectId },
      orderBy: { eventType: 'asc' },
    });

    return rules.map(toNotificationRuleView);
  }

  async createRule(
    actor: AuthenticatedUser,
    projectId: string,
    dto: CreateNotificationRuleDto,
  ): Promise<NotificationRuleView> {
    await this.assertProjectAccess(actor, projectId);
    await this.findDestinationOrFail(projectId, dto.destinationId);

    const filters = this.buildFilters(dto.filters);

    const rule = await this.prisma.notificationRule.create({
      data: {
        projectId,
        eventType: dto.eventType,
        destinationId: dto.destinationId,
        enabled: dto.enabled ?? true,
        ...(filters === undefined ? {} : { filters }),
      },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'NOTIFICATION_RULE_CREATED',
      entityType: 'NotificationRule',
      entityId: rule.id,
      projectId,
      metadata: {
        eventType: rule.eventType,
        destinationId: rule.destinationId,
        enabled: rule.enabled,
      },
    });

    return toNotificationRuleView(rule);
  }

  /* ------------------------------- Entregas ------------------------------- */

  async listDeliveries(
    actor: AuthenticatedUser,
    projectId: string,
    query: ListNotificationDeliveriesQueryDto,
  ): Promise<Paginated<NotificationDeliveryView>> {
    await this.assertProjectAccess(actor, projectId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const destinations = await this.prisma.notificationDestination.findMany({
      where: { projectId },
    });

    if (destinations.length === 0) {
      return { items: [], page, pageSize, total: 0, totalPages: 1 };
    }

    const where: Prisma.NotificationDeliveryWhereInput = {
      destinationId: { in: destinations.map((destination) => destination.id) },
    };
    if (query.status !== undefined) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.notificationDelivery.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notificationDelivery.count({ where }),
    ]);

    return {
      items: items.map(toNotificationDeliveryView),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /**
   * Reprocessamento administrativo (seção 7.2): reenfileira a entrega com uma
   * nova chave de idempotência, gerando uma nova tentativa registrada.
   */
  async reprocessDelivery(
    actor: AuthenticatedUser,
    deliveryId: string,
  ): Promise<NotificationDeliveryView> {
    const delivery = await this.prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (delivery === null) {
      throw new NotFoundException('Entrega de notificação não encontrada.');
    }

    const destination = await this.prisma.notificationDestination.findUnique({
      where: { id: delivery.destinationId },
    });

    if (destination === null) {
      throw new NotFoundException('Destino da entrega não encontrado.');
    }

    const occurrence = await this.prisma.occurrence.findUnique({
      where: { id: delivery.occurrenceId },
    });

    if (occurrence === null) {
      throw new NotFoundException('Ocorrência da entrega não encontrada.');
    }

    await this.publisher.publish({
      occurrenceId: delivery.occurrenceId,
      projectId: destination.projectId,
      destinationId: destination.id,
      idempotencyKey: `${delivery.idempotencyKey}:r${Date.now()}`,
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'NOTIFICATION_DELIVERY_REPROCESSED',
      entityType: 'NotificationDelivery',
      entityId: delivery.id,
      projectId: destination.projectId,
      metadata: { destinationId: destination.id, channel: destination.channel },
    });

    this.logger.log(`Entrega ${delivery.id} reenfileirada para reprocessamento.`);

    return toNotificationDeliveryView(delivery);
  }

  /* -------------------------------- Helpers ------------------------------- */

  private async assertProjectAccess(actor: AuthenticatedUser, projectId: string): Promise<void> {
    await this.accessService.resolveMembership(actor, projectId);
  }

  private async findDestinationOrFail(
    projectId: string,
    destinationId: string,
  ): Promise<NotificationDestination> {
    const destination = await this.prisma.notificationDestination.findUnique({
      where: { id: destinationId },
    });

    if (destination === null || destination.projectId !== projectId) {
      throw new NotFoundException('Destino de notificação não encontrado neste projeto.');
    }

    return destination;
  }

  private assertValidConfig(
    channel: NotificationDestination['channel'],
    config: Record<string, unknown>,
  ): void {
    const validation = validateChannelConfig(channel, config);

    if (!validation.valid) {
      throw new BadRequestException(validation.reason);
    }
  }

  private buildFilters(filters: NotificationRuleFiltersDto | undefined): Prisma.InputJsonValue | undefined {
    if (filters === undefined) {
      return undefined;
    }

    const result: Record<string, unknown> = {};
    if (filters.priorities !== undefined && filters.priorities.length > 0) {
      result.priorities = filters.priorities;
    }
    if (filters.categories !== undefined && filters.categories.length > 0) {
      result.categories = filters.categories;
    }

    return Object.keys(result).length === 0 ? undefined : (result as Prisma.InputJsonValue);
  }
}
