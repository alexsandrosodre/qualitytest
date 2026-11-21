import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GlobalRole,
  Prisma,
  ProjectRole,
  RegistrationStatus,
  type Occurrence,
} from '@prisma/client';
import {
  NotificationEventType,
  OccurrenceHistoryAction,
  type NotificationJobPayload,
  type Paginated,
} from '@qualitytest/shared';
import { randomInt } from 'node:crypto';

import { AuditService } from '../common/audit/audit.service';
import { ProjectAccessService } from '../common/access/project-access.service';
import {
  NOTIFICATION_PUBLISHER,
  type NotificationPublisher,
} from '../notifications/notification-publisher';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../storage/storage.service';
import { AssignOccurrenceDto } from './dto/assign-occurrence.dto';
import { ChangeOccurrenceStatusDto } from './dto/change-occurrence-status.dto';
import { CreateOccurrenceAttachmentDto } from './dto/create-occurrence-attachment.dto';
import { CreateOccurrenceCommentDto } from './dto/create-occurrence-comment.dto';
import { CreateOccurrenceDto } from './dto/create-occurrence.dto';
import { ListOccurrencesQueryDto } from './dto/list-occurrences-query.dto';
import { UpdateOccurrenceCommentDto } from './dto/update-occurrence-comment.dto';
import { UpdateOccurrenceDto } from './dto/update-occurrence.dto';
import {
  toOccurrenceAttachmentView,
  toOccurrenceCommentView,
  toOccurrenceDetailView,
  toOccurrenceHistoryView,
  toOccurrenceSummaryView,
  type OccurrenceAttachmentView,
  type OccurrenceCommentView,
  type OccurrenceDetailView,
  type OccurrenceHistoryView,
  type OccurrenceSummaryView,
  type UserRef,
} from './occurrence.mapper';
import { OCCURRENCE_PERMISSIONS, assertRoleAllowed } from './occurrence-permissions';
import { evaluateStatusTransition } from './occurrence-status.transitions';

/** Resultado da criação: `replayed = true` quando a chave de idempotência já existia. */
export interface CreateOccurrenceResult {
  occurrence: OccurrenceDetailView;
  replayed: boolean;
}

/** Resultado da solicitação de upload de anexo. */
export interface AttachmentUploadView extends OccurrenceAttachmentView {
  uploadUrl: string;
  expiresInSeconds: number;
}

/** Resultado da geração de URL de download. */
export interface AttachmentDownloadView {
  downloadUrl: string;
  expiresInSeconds: number;
}

/**
 * Extensões aceitas por tipo MIME para anexos de ocorrência.
 * A extensão do arquivo precisa ser coerente com o tipo MIME declarado,
 * evitando que um tipo permitido seja usado para trafegar outro formato.
 */
const ALLOWED_ATTACHMENT_EXTENSIONS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['image/png', new Set(['png'])],
  ['image/jpeg', new Set(['jpg', 'jpeg'])],
  ['image/jpg', new Set(['jpg', 'jpeg'])],
  ['image/gif', new Set(['gif'])],
  ['image/webp', new Set(['webp'])],
  ['application/pdf', new Set(['pdf'])],
  ['text/plain', new Set(['txt', 'log'])],
  ['application/zip', new Set(['zip'])],
  ['application/x-zip-compressed', new Set(['zip'])],
]);

/** Extrai a extensão (sem ponto, minúscula) do nome do arquivo, ou `null`. */
function extractFileExtension(fileName: string): string | null {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName.trim());
  return match === null ? null : (match[1] ?? '').toLowerCase();
}

const DEFAULT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const DEFAULT_PRESIGN_TTL_SECONDS = 900;
/** Tentativas de geração de `publicCode` livre de colisão. */
const PUBLIC_CODE_MAX_ATTEMPTS = 8;

@Injectable()
export class OccurrencesService {
  private readonly logger = new Logger(OccurrencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessService: ProjectAccessService,
    private readonly configService: ConfigService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    @Inject(NOTIFICATION_PUBLISHER) private readonly notifications: NotificationPublisher,
  ) {}

  /* ------------------------------------------------------------------ */
  /* Criação                                                             */
  /* ------------------------------------------------------------------ */

  async create(
    actor: AuthenticatedUser,
    dto: CreateOccurrenceDto,
    idempotencyKey: string | undefined,
  ): Promise<CreateOccurrenceResult> {
    const key = (idempotencyKey ?? '').trim();

    if (key.length === 0) {
      throw new BadRequestException('O header Idempotency-Key é obrigatório.');
    }

    const role = await this.assertProjectAccess(actor, dto.projectId);
    assertRoleAllowed(
      role,
      OCCURRENCE_PERMISSIONS.create,
      'Sem permissão para registrar ocorrências neste projeto.',
    );

    // Idempotência: reenvio com a mesma chave devolve a ocorrência já criada.
    const existing = await this.prisma.occurrence.findUnique({ where: { idempotencyKey: key } });
    if (existing !== null) {
      await this.assertProjectAccess(actor, existing.projectId);
      return { occurrence: await this.buildDetailView(existing), replayed: true };
    }

    if (dto.environmentId !== undefined) {
      await this.assertEnvironmentInProject(dto.projectId, dto.environmentId);
    }

    const publicCode = await this.generatePublicCode();

    let occurrence: Occurrence;
    try {
      occurrence = await this.prisma.occurrence.create({
        data: {
          publicCode,
          idempotencyKey: key,
          projectId: dto.projectId,
          environmentId: dto.environmentId ?? null,
          title: dto.title.trim(),
          description: dto.description?.trim() ?? null,
          categoryId: dto.categoryId,
          priority: dto.priority,
          reporterUserId: actor.id,
          assigneeUserId: null,
          pageUrl: dto.pageUrl ?? null,
          pageTitle: dto.pageTitle?.trim() ?? null,
          browserInfo: dto.browserInfo ?? null,
          operatingSystemInfo: dto.operatingSystemInfo ?? null,
          viewportInfo: dto.viewportInfo ?? null,
        },
      });
    } catch (error: unknown) {
      // Corrida: outra requisição com a mesma chave venceu → devolve o existente.
      if (isUniqueConstraintOn(error, 'idempotencyKey')) {
        const winner = await this.prisma.occurrence.findUnique({ where: { idempotencyKey: key } });
        if (winner !== null) {
          return { occurrence: await this.buildDetailView(winner), replayed: true };
        }
      }
      throw error;
    }

    await this.recordHistory({
      occurrenceId: occurrence.id,
      actorUserId: actor.id,
      action: OccurrenceHistoryAction.CREATED,
      previousValue: null,
      newValue: occurrence.status,
    });

    await this.audit(actor, 'OCCURRENCE_CREATED', occurrence.id, occurrence.projectId, {
      publicCode: occurrence.publicCode,
      priority: occurrence.priority,
      categoryId: occurrence.categoryId,
    });

    this.publishNotification({
      eventType: NotificationEventType.OCCURRENCE_CREATED,
      occurrenceId: occurrence.id,
      projectId: occurrence.projectId,
      idempotencyKey: `occurrence-created:${occurrence.id}`,
    });

    return { occurrence: await this.buildDetailView(occurrence), replayed: false };
  }

  /* ------------------------------------------------------------------ */
  /* Leitura                                                             */
  /* ------------------------------------------------------------------ */

  async list(
    actor: AuthenticatedUser,
    query: ListOccurrencesQueryDto,
  ): Promise<Paginated<OccurrenceSummaryView>> {
    await this.assertProjectAccess(actor, query.projectId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.OccurrenceWhereInput = { projectId: query.projectId };

    if (query.environmentId !== undefined) {
      where.environmentId = query.environmentId;
    }
    if (query.categoryId !== undefined) {
      where.categoryId = query.categoryId;
    }
    if (query.priority !== undefined) {
      where.priority = query.priority;
    }
    if (query.status !== undefined) {
      where.status = query.status;
    }
    if (query.assigneeUserId !== undefined) {
      where.assigneeUserId = query.assigneeUserId;
    }
    if (query.reporterUserId !== undefined) {
      where.reporterUserId = query.reporterUserId;
    }
    if (query.from !== undefined || query.to !== undefined) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.from !== undefined) {
        createdAt.gte = new Date(query.from);
      }
      if (query.to !== undefined) {
        createdAt.lte = new Date(query.to);
      }
      where.createdAt = createdAt;
    }
    if (query.q !== undefined && query.q.trim().length > 0) {
      const term = query.q.trim();
      where.OR = [
        { publicCode: { contains: term, mode: 'insensitive' } },
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.occurrence.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: this.resolveOrderBy(query.sort),
      }),
      this.prisma.occurrence.count({ where }),
    ]);

    return {
      items: items.map(toOccurrenceSummaryView),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOne(actor: AuthenticatedUser, occurrenceId: string): Promise<OccurrenceDetailView> {
    const occurrence = await this.resolveOccurrenceOrFail(occurrenceId);
    await this.assertProjectAccess(actor, occurrence.projectId);
    return this.buildDetailView(occurrence);
  }

  async listHistory(
    actor: AuthenticatedUser,
    occurrenceId: string,
  ): Promise<OccurrenceHistoryView[]> {
    const occurrence = await this.resolveOccurrenceOrFail(occurrenceId);
    await this.assertProjectAccess(actor, occurrence.projectId);
    return this.loadHistory(occurrence.id);
  }

  /* ------------------------------------------------------------------ */
  /* Edição                                                              */
  /* ------------------------------------------------------------------ */

  async update(
    actor: AuthenticatedUser,
    occurrenceId: string,
    dto: UpdateOccurrenceDto,
  ): Promise<OccurrenceDetailView> {
    const occurrence = await this.resolveOccurrenceOrFail(occurrenceId);
    const role = await this.assertProjectAccess(actor, occurrence.projectId);

    assertRoleAllowed(
      role,
      OCCURRENCE_PERMISSIONS.edit,
      'Sem permissão para editar esta ocorrência.',
    );

    if (dto.priority !== undefined && dto.priority !== occurrence.priority) {
      assertRoleAllowed(
        role,
        OCCURRENCE_PERMISSIONS.editPriority,
        'Sem permissão para alterar a prioridade da ocorrência.',
      );
    }

    if (dto.environmentId !== undefined && dto.environmentId !== occurrence.environmentId) {
      await this.assertEnvironmentInProject(occurrence.projectId, dto.environmentId);
    }

    const data: Prisma.OccurrenceUncheckedUpdateInput = {};
    const changes: Array<{
      field: string;
      previousValue: string | null;
      newValue: string | null;
      action: OccurrenceHistoryAction;
    }> = [];

    const track = (
      field: keyof UpdateOccurrenceDto,
      previousValue: string | null,
      newValue: string | null,
      action: OccurrenceHistoryAction,
    ): void => {
      if (previousValue !== newValue) {
        changes.push({ field, previousValue, newValue, action });
      }
    };

    if (dto.title !== undefined) {
      const next = dto.title.trim();
      data.title = next;
      track('title', occurrence.title, next, OccurrenceHistoryAction.UPDATED);
    }
    if (dto.description !== undefined) {
      const next = dto.description.trim();
      data.description = next;
      track('description', occurrence.description, next, OccurrenceHistoryAction.UPDATED);
    }
    if (dto.categoryId !== undefined) {
      data.categoryId = dto.categoryId;
      track(
        'categoryId',
        occurrence.categoryId,
        dto.categoryId,
        OccurrenceHistoryAction.UPDATED,
      );
    }
    if (dto.priority !== undefined) {
      data.priority = dto.priority;
      track(
        'priority',
        occurrence.priority,
        dto.priority,
        OccurrenceHistoryAction.PRIORITY_CHANGED,
      );
    }
    if (dto.environmentId !== undefined) {
      data.environmentId = dto.environmentId;
      track(
        'environmentId',
        occurrence.environmentId,
        dto.environmentId,
        OccurrenceHistoryAction.UPDATED,
      );
    }
    if (dto.pageUrl !== undefined) {
      data.pageUrl = dto.pageUrl;
      track('pageUrl', occurrence.pageUrl, dto.pageUrl, OccurrenceHistoryAction.UPDATED);
    }
    if (dto.pageTitle !== undefined) {
      const next = dto.pageTitle.trim();
      data.pageTitle = next;
      track('pageTitle', occurrence.pageTitle, next, OccurrenceHistoryAction.UPDATED);
    }
    if (dto.browserInfo !== undefined) {
      data.browserInfo = dto.browserInfo;
      track('browserInfo', occurrence.browserInfo, dto.browserInfo, OccurrenceHistoryAction.UPDATED);
    }
    if (dto.operatingSystemInfo !== undefined) {
      data.operatingSystemInfo = dto.operatingSystemInfo;
      track(
        'operatingSystemInfo',
        occurrence.operatingSystemInfo,
        dto.operatingSystemInfo,
        OccurrenceHistoryAction.UPDATED,
      );
    }
    if (dto.viewportInfo !== undefined) {
      data.viewportInfo = dto.viewportInfo;
      track('viewportInfo', occurrence.viewportInfo, dto.viewportInfo, OccurrenceHistoryAction.UPDATED);
    }

    if (changes.length === 0) {
      return this.buildDetailView(occurrence);
    }

    const updated = await this.prisma.occurrence.update({
      where: { id: occurrenceId },
      data,
    });

    for (const change of changes) {
      await this.recordHistory({
        occurrenceId,
        actorUserId: actor.id,
        action: change.action,
        previousValue: change.previousValue,
        newValue: change.newValue,
      });
    }

    await this.audit(actor, 'OCCURRENCE_UPDATED', occurrenceId, occurrence.projectId, {
      fields: changes.map((change) => change.field),
    });

    this.publishNotification({
      eventType: NotificationEventType.OCCURRENCE_UPDATED,
      occurrenceId,
      projectId: occurrence.projectId,
      idempotencyKey: `occurrence-updated:${occurrenceId}:${updated.updatedAt.getTime()}`,
    });

    return this.buildDetailView(updated);
  }

  async assign(
    actor: AuthenticatedUser,
    occurrenceId: string,
    dto: AssignOccurrenceDto,
  ): Promise<OccurrenceDetailView> {
    const occurrence = await this.resolveOccurrenceOrFail(occurrenceId);
    const role = await this.assertProjectAccess(actor, occurrence.projectId);

    assertRoleAllowed(
      role,
      OCCURRENCE_PERMISSIONS.assign,
      'Sem permissão para atribuir responsável.',
    );

    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId: occurrence.projectId, userId: dto.assigneeUserId },
      },
    });

    if (member === null || member.status !== RegistrationStatus.ATIVO) {
      throw new BadRequestException(
        'O responsável deve ser um membro ATIVO do mesmo projeto da ocorrência.',
      );
    }

    if (occurrence.assigneeUserId === dto.assigneeUserId) {
      return this.buildDetailView(occurrence);
    }

    const previous = occurrence.assigneeUserId;
    const updated = await this.prisma.occurrence.update({
      where: { id: occurrenceId },
      data: { assigneeUserId: dto.assigneeUserId },
    });

    await this.recordHistory({
      occurrenceId,
      actorUserId: actor.id,
      action: OccurrenceHistoryAction.ASSIGNEE_CHANGED,
      previousValue: previous,
      newValue: dto.assigneeUserId,
    });

    await this.audit(actor, 'OCCURRENCE_ASSIGNEE_CHANGED', occurrenceId, occurrence.projectId, {
      previousAssigneeUserId: previous,
      assigneeUserId: dto.assigneeUserId,
    });

    return this.buildDetailView(updated);
  }

  async changeStatus(
    actor: AuthenticatedUser,
    occurrenceId: string,
    dto: ChangeOccurrenceStatusDto,
  ): Promise<OccurrenceDetailView> {
    const occurrence = await this.resolveOccurrenceOrFail(occurrenceId);
    const role = await this.assertProjectAccess(actor, occurrence.projectId);

    assertRoleAllowed(
      role,
      OCCURRENCE_PERMISSIONS.changeStatus,
      'Sem permissão para alterar o status da ocorrência.',
    );

    const decision = evaluateStatusTransition({
      from: occurrence.status,
      to: dto.status,
      actorProjectRole: role,
      justification: dto.justification,
    });

    if (!decision.allowed) {
      switch (decision.code) {
        case 'FORBIDDEN':
          throw new ForbiddenException(decision.reason);
        case 'SAME_STATUS':
        case 'JUSTIFICATION_REQUIRED':
          throw new BadRequestException(decision.reason);
        case 'NOT_ALLOWED':
        default:
          throw new UnprocessableEntityException(decision.reason);
      }
    }

    const previous = occurrence.status;
    const updated = await this.prisma.occurrence.update({
      where: { id: occurrenceId },
      data: { status: dto.status },
    });

    await this.recordHistory({
      occurrenceId,
      actorUserId: actor.id,
      action: OccurrenceHistoryAction.STATUS_CHANGED,
      previousValue: previous,
      newValue: dto.status,
    });

    await this.audit(actor, 'OCCURRENCE_STATUS_CHANGED', occurrenceId, occurrence.projectId, {
      from: previous,
      to: dto.status,
      justification: dto.justification ?? null,
    });

    this.publishNotification({
      eventType: NotificationEventType.OCCURRENCE_STATUS_CHANGED,
      occurrenceId,
      projectId: occurrence.projectId,
      idempotencyKey: `occurrence-status:${occurrenceId}:${dto.status}`,
    });

    return this.buildDetailView(updated);
  }

  /* ------------------------------------------------------------------ */
  /* Comentários                                                         */
  /* ------------------------------------------------------------------ */

  async listComments(
    actor: AuthenticatedUser,
    occurrenceId: string,
  ): Promise<OccurrenceCommentView[]> {
    const occurrence = await this.resolveOccurrenceOrFail(occurrenceId);
    await this.assertProjectAccess(actor, occurrence.projectId);
    return this.loadComments(occurrence.id);
  }

  async addComment(
    actor: AuthenticatedUser,
    occurrenceId: string,
    dto: CreateOccurrenceCommentDto,
  ): Promise<OccurrenceCommentView> {
    const occurrence = await this.resolveOccurrenceOrFail(occurrenceId);
    const role = await this.assertProjectAccess(actor, occurrence.projectId);

    assertRoleAllowed(
      role,
      OCCURRENCE_PERMISSIONS.comment,
      'Sem permissão para comentar nesta ocorrência.',
    );

    const comment = await this.prisma.occurrenceComment.create({
      data: {
        occurrenceId,
        userId: actor.id,
        content: dto.content.trim(),
      },
    });

    await this.recordHistory({
      occurrenceId,
      actorUserId: actor.id,
      action: OccurrenceHistoryAction.COMMENT_ADDED,
      previousValue: null,
      newValue: comment.id,
    });

    await this.audit(actor, 'OCCURRENCE_COMMENT_ADDED', occurrenceId, occurrence.projectId, {
      commentId: comment.id,
    });

    return toOccurrenceCommentView(comment, { id: actor.id, name: actor.name });
  }

  async updateComment(
    actor: AuthenticatedUser,
    occurrenceId: string,
    commentId: string,
    dto: UpdateOccurrenceCommentDto,
  ): Promise<OccurrenceCommentView> {
    const occurrence = await this.resolveOccurrenceOrFail(occurrenceId);
    const role = await this.assertProjectAccess(actor, occurrence.projectId);

    const comment = await this.findCommentOrFail(occurrenceId, commentId);
    this.assertCommentOwnership(actor, role, comment.userId);

    const updated = await this.prisma.occurrenceComment.update({
      where: { id: commentId },
      data: { content: dto.content.trim() },
    });

    await this.audit(actor, 'OCCURRENCE_COMMENT_UPDATED', occurrenceId, occurrence.projectId, {
      commentId,
    });

    return toOccurrenceCommentView(updated, await this.loadUserRef(updated.userId));
  }

  async deleteComment(
    actor: AuthenticatedUser,
    occurrenceId: string,
    commentId: string,
  ): Promise<void> {
    const occurrence = await this.resolveOccurrenceOrFail(occurrenceId);
    const role = await this.assertProjectAccess(actor, occurrence.projectId);

    const comment = await this.findCommentOrFail(occurrenceId, commentId);
    this.assertCommentOwnership(actor, role, comment.userId);

    await this.prisma.occurrenceComment.delete({ where: { id: commentId } });

    await this.audit(actor, 'OCCURRENCE_COMMENT_DELETED', occurrenceId, occurrence.projectId, {
      commentId,
    });
  }

  /* ------------------------------------------------------------------ */
  /* Anexos                                                              */
  /* ------------------------------------------------------------------ */

  async listAttachments(
    actor: AuthenticatedUser,
    occurrenceId: string,
  ): Promise<OccurrenceAttachmentView[]> {
    const occurrence = await this.resolveOccurrenceOrFail(occurrenceId);
    await this.assertProjectAccess(actor, occurrence.projectId);

    const attachments = await this.prisma.occurrenceAttachment.findMany({
      where: { occurrenceId },
      orderBy: { createdAt: 'asc' },
    });

    return attachments.map(toOccurrenceAttachmentView);
  }

  async createAttachment(
    actor: AuthenticatedUser,
    occurrenceId: string,
    dto: CreateOccurrenceAttachmentDto,
  ): Promise<AttachmentUploadView> {
    const occurrence = await this.resolveOccurrenceOrFail(occurrenceId);
    const role = await this.assertProjectAccess(actor, occurrence.projectId);

    assertRoleAllowed(
      role,
      OCCURRENCE_PERMISSIONS.attach,
      'Sem permissão para anexar evidências nesta ocorrência.',
    );

    this.assertValidAttachment(dto);

    const storageKey = this.storage.buildStorageKey(occurrenceId, dto.fileName);

    const attachment = await this.prisma.occurrenceAttachment.create({
      data: {
        occurrenceId,
        storageKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        size: dto.size,
        uploadedBy: actor.id,
      },
    });

    const ttl = this.presignTtlSeconds();
    const target = await this.storage.createUploadUrl({
      storageKey,
      mimeType: dto.mimeType,
      expiresInSeconds: ttl,
    });

    await this.recordHistory({
      occurrenceId,
      actorUserId: actor.id,
      action: OccurrenceHistoryAction.ATTACHMENT_ADDED,
      previousValue: null,
      newValue: attachment.id,
    });

    await this.audit(actor, 'OCCURRENCE_ATTACHMENT_ADDED', occurrenceId, occurrence.projectId, {
      attachmentId: attachment.id,
      fileName: attachment.fileName,
    });

    return {
      ...toOccurrenceAttachmentView(attachment),
      uploadUrl: target.uploadUrl,
      expiresInSeconds: target.expiresInSeconds,
    };
  }

  async getAttachmentDownloadUrl(
    actor: AuthenticatedUser,
    occurrenceId: string,
    attachmentId: string,
  ): Promise<AttachmentDownloadView> {
    const occurrence = await this.resolveOccurrenceOrFail(occurrenceId);
    await this.assertProjectAccess(actor, occurrence.projectId);

    const attachment = await this.findAttachmentOrFail(occurrenceId, attachmentId);
    const target = await this.storage.createDownloadUrl({
      storageKey: attachment.storageKey,
      expiresInSeconds: this.presignTtlSeconds(),
    });

    return { downloadUrl: target.downloadUrl, expiresInSeconds: target.expiresInSeconds };
  }

  async deleteAttachment(
    actor: AuthenticatedUser,
    occurrenceId: string,
    attachmentId: string,
  ): Promise<void> {
    const occurrence = await this.resolveOccurrenceOrFail(occurrenceId);
    const role = await this.assertProjectAccess(actor, occurrence.projectId);

    const attachment = await this.findAttachmentOrFail(occurrenceId, attachmentId);

    const isOwner = attachment.uploadedBy === actor.id;
    const isPrivileged =
      actor.globalRole === GlobalRole.ADMINISTRADOR || role === ProjectRole.GESTOR;

    if (!isOwner && !isPrivileged) {
      throw new ForbiddenException(
        'Apenas o autor do anexo, um GESTOR ou ADMINISTRADOR pode removê-lo.',
      );
    }

    await this.prisma.occurrenceAttachment.delete({ where: { id: attachmentId } });

    await this.audit(actor, 'OCCURRENCE_ATTACHMENT_DELETED', occurrenceId, occurrence.projectId, {
      attachmentId,
    });
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Valida o vínculo do ator com o projeto (fonte única: `ProjectAccessService`).
   * Retorna o papel no projeto; `null` = ADMINISTRADOR global.
   */
  private async assertProjectAccess(
    actor: AuthenticatedUser,
    projectId: string,
  ): Promise<ProjectRole | null> {
    const membership = await this.accessService.resolveMembership(actor, projectId);
    return membership === null ? null : membership.role;
  }

  private async resolveOccurrenceOrFail(occurrenceId: string): Promise<Occurrence> {
    const occurrence = await this.prisma.occurrence.findUnique({ where: { id: occurrenceId } });

    if (occurrence === null) {
      throw new NotFoundException('Ocorrência não encontrada.');
    }

    return occurrence;
  }

  private async assertEnvironmentInProject(projectId: string, environmentId: string): Promise<void> {
    const environment = await this.prisma.projectEnvironment.findUnique({
      where: { id: environmentId },
    });

    if (environment === null || environment.projectId !== projectId) {
      throw new BadRequestException('Ambiente inválido para este projeto.');
    }
  }

  private async findCommentOrFail(occurrenceId: string, commentId: string) {
    const comment = await this.prisma.occurrenceComment.findUnique({ where: { id: commentId } });

    if (comment === null || comment.occurrenceId !== occurrenceId) {
      throw new NotFoundException('Comentário não encontrado nesta ocorrência.');
    }

    return comment;
  }

  private async findAttachmentOrFail(occurrenceId: string, attachmentId: string) {
    const attachment = await this.prisma.occurrenceAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (attachment === null || attachment.occurrenceId !== occurrenceId) {
      throw new NotFoundException('Anexo não encontrado nesta ocorrência.');
    }

    return attachment;
  }

  /** Autor do comentário, ADMINISTRADOR global ou GESTOR do projeto podem editar/remover. */
  private assertCommentOwnership(
    actor: AuthenticatedUser,
    role: ProjectRole | null,
    commentAuthorId: string,
  ): void {
    const isAuthor = commentAuthorId === actor.id;
    const isPrivileged =
      actor.globalRole === GlobalRole.ADMINISTRADOR || role === ProjectRole.GESTOR;

    if (!isAuthor && !isPrivileged) {
      throw new ForbiddenException(
        'Apenas o autor do comentário, um GESTOR ou ADMINISTRADOR pode alterá-lo.',
      );
    }
  }

  private assertValidAttachment(dto: CreateOccurrenceAttachmentDto): void {
    const allowedExtensions = ALLOWED_ATTACHMENT_EXTENSIONS.get(dto.mimeType.toLowerCase());

    if (allowedExtensions === undefined) {
      throw new UnprocessableEntityException(
        `Tipo de arquivo não permitido: ${dto.mimeType}.`,
      );
    }

    const extension = extractFileExtension(dto.fileName);

    if (extension === null || !allowedExtensions.has(extension)) {
      throw new UnprocessableEntityException(
        `A extensão do arquivo "${dto.fileName}" não corresponde ao tipo ${dto.mimeType}. ` +
          `Extensões aceitas: ${[...allowedExtensions].join(', ')}.`,
      );
    }

    const maxBytes = this.configService.get<string>('ATTACHMENT_MAX_SIZE_BYTES');
    const limit = maxBytes === undefined ? DEFAULT_MAX_ATTACHMENT_BYTES : Number(maxBytes);

    if (dto.size > limit) {
      throw new UnprocessableEntityException(
        `Anexo excede o tamanho máximo permitido (${limit} bytes).`,
      );
    }
  }

  private presignTtlSeconds(): number {
    const configured = this.configService.get<string>('S3_PRESIGN_TTL_SECONDS');
    const value = configured === undefined ? DEFAULT_PRESIGN_TTL_SECONDS : Number(configured);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_PRESIGN_TTL_SECONDS;
  }

  private async generatePublicCode(): Promise<string> {
    for (let attempt = 0; attempt < PUBLIC_CODE_MAX_ATTEMPTS; attempt += 1) {
      const candidate = `QT-${String(randomInt(1, 1_000_000)).padStart(6, '0')}`;
      const existing = await this.prisma.occurrence.findUnique({
        where: { publicCode: candidate },
      });
      if (existing === null) {
        return candidate;
      }
    }

    // Colisões repetidas indicam esgotamento da faixa; a unicidade real é
    // garantida pela constraint do banco (retry do cliente/erro único).
    throw new ServiceUnavailableException(
      'Não foi possível gerar um código público único para a ocorrência.',
    );
  }

  private resolveOrderBy(sort?: string): Prisma.OccurrenceOrderByWithRelationInput {
    if (sort !== undefined && sort.trim().length > 0) {
      const [field, direction] = sort.split(':');
      const dir: Prisma.SortOrder = direction === 'asc' ? 'asc' : 'desc';
      if (field === 'updatedAt' || field === 'createdAt') {
        return { [field]: dir };
      }
    }
    return { createdAt: 'desc' };
  }

  private async buildDetailView(occurrence: Occurrence): Promise<OccurrenceDetailView> {
    const [reporter, assignee, project, environment, attachments, comments, history] =
      await Promise.all([
        this.loadUserRef(occurrence.reporterUserId),
        occurrence.assigneeUserId === null
          ? Promise.resolve(null)
          : this.loadUserRef(occurrence.assigneeUserId),
        this.prisma.project.findUnique({ where: { id: occurrence.projectId } }),
        occurrence.environmentId === null
          ? Promise.resolve(null)
          : this.prisma.projectEnvironment.findUnique({ where: { id: occurrence.environmentId } }),
        this.prisma.occurrenceAttachment.findMany({
          where: { occurrenceId: occurrence.id },
          orderBy: { createdAt: 'asc' },
        }),
        this.loadComments(occurrence.id),
        this.loadHistory(occurrence.id),
      ]);

    return toOccurrenceDetailView({
      occurrence,
      reporter,
      assignee,
      project:
        project === null ? null : { id: project.id, name: project.name, code: project.code },
      environment: environment === null ? null : { id: environment.id, name: environment.name },
      attachments: attachments.map(toOccurrenceAttachmentView),
      comments,
      history,
    });
  }

  private async loadComments(occurrenceId: string): Promise<OccurrenceCommentView[]> {
    const comments = await this.prisma.occurrenceComment.findMany({
      where: { occurrenceId },
      orderBy: { createdAt: 'asc' },
    });

    const authorIds = [...new Set(comments.map((comment) => comment.userId))];
    const authors = await Promise.all(authorIds.map((id) => this.loadUserRef(id)));
    const authorById = new Map(authorIds.map((id, index) => [id, authors[index] ?? null]));

    return comments.map((comment) =>
      toOccurrenceCommentView(comment, authorById.get(comment.userId) ?? null),
    );
  }

  private async loadHistory(occurrenceId: string): Promise<OccurrenceHistoryView[]> {
    const entries = await this.prisma.occurrenceHistory.findMany({
      where: { occurrenceId },
      orderBy: { createdAt: 'asc' },
    });

    const actorIds = [...new Set(entries.map((entry) => entry.actorUserId))];
    const actors = await Promise.all(actorIds.map((id) => this.loadUserRef(id)));
    const actorById = new Map(actorIds.map((id, index) => [id, actors[index] ?? null]));

    return entries.map((entry) =>
      toOccurrenceHistoryView(entry, actorById.get(entry.actorUserId) ?? null),
    );
  }

  private async loadUserRef(userId: string): Promise<UserRef | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user === null ? null : { id: user.id, name: user.name };
  }

  private async recordHistory(input: {
    occurrenceId: string;
    actorUserId: string;
    action: OccurrenceHistoryAction;
    previousValue: string | null;
    newValue: string | null;
  }): Promise<void> {
    await this.prisma.occurrenceHistory.create({
      data: {
        occurrenceId: input.occurrenceId,
        actorUserId: input.actorUserId,
        action: input.action,
        previousValue: input.previousValue,
        newValue: input.newValue,
      },
    });
  }

  private async audit(
    actor: AuthenticatedUser,
    action: string,
    entityId: string,
    projectId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record({
      actorUserId: actor.id,
      action,
      entityType: 'Occurrence',
      entityId,
      projectId,
      metadata,
    });
  }

  /**
   * Publica o evento de notificação sem bloquear a operação de negócio
   * (`notificacoes-whatsapp.md`, seção 7.2): indisponibilidade da fila não
   * impede a criação/edição da ocorrência nem expõe dados sensíveis no log.
   */
  private publishNotification(payload: NotificationJobPayload): void {
    void this.notifications.publish(payload).catch((error: unknown) => {
      this.logger.warn(
        `Falha ao enfileirar notificação (${payload.eventType ?? 'manual'}, ` +
          `ocorrência=${payload.occurrenceId}): ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }
}

function isUniqueConstraintOn(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    String(error.meta?.['target'] ?? '').includes(field)
  );
}
