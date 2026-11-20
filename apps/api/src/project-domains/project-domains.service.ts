import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, ProjectDomainMapping } from '@prisma/client';

import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateProjectDomainMappingDto } from './dto/create-project-domain.dto';
import { UpdateProjectDomainMappingDto } from './dto/update-project-domain.dto';
import {
  toProjectDomainMappingView,
  type ProjectDomainMappingView,
} from './project-domain.mapper';

@Injectable()
export class ProjectDomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    actor: AuthenticatedUser,
    projectId: string,
    dto: CreateProjectDomainMappingDto,
  ): Promise<ProjectDomainMappingView> {
    await this.assertEnvironmentBelongsToProject(projectId, dto.environmentId);

    const mapping = await this.prisma.projectDomainMapping.create({
      data: {
        projectId,
        domainPattern: dto.domainPattern.trim(),
        environmentId: dto.environmentId,
        enabled: dto.enabled ?? true,
      },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'PROJECT_DOMAIN_MAPPING_CREATED',
      entityType: 'ProjectDomainMapping',
      entityId: mapping.id,
      projectId,
      metadata: { domainPattern: mapping.domainPattern, environmentId: mapping.environmentId },
    });

    return toProjectDomainMappingView(mapping);
  }

  async list(projectId: string): Promise<ProjectDomainMappingView[]> {
    const mappings = await this.prisma.projectDomainMapping.findMany({
      where: { projectId },
      orderBy: { domainPattern: 'asc' },
    });

    return mappings.map(toProjectDomainMappingView);
  }

  async update(
    actor: AuthenticatedUser,
    projectId: string,
    mappingId: string,
    dto: UpdateProjectDomainMappingDto,
  ): Promise<ProjectDomainMappingView> {
    await this.findMappingOrFail(projectId, mappingId);

    const data: Prisma.ProjectDomainMappingUncheckedUpdateInput = {};

    if (dto.domainPattern !== undefined) {
      data.domainPattern = dto.domainPattern.trim();
    }
    if (dto.environmentId !== undefined) {
      await this.assertEnvironmentBelongsToProject(projectId, dto.environmentId);
      data.environmentId = dto.environmentId;
    }
    if (dto.enabled !== undefined) {
      data.enabled = dto.enabled;
    }

    const updated = await this.prisma.projectDomainMapping.update({
      where: { id: mappingId },
      data,
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'PROJECT_DOMAIN_MAPPING_UPDATED',
      entityType: 'ProjectDomainMapping',
      entityId: mappingId,
      projectId,
      metadata: { fields: Object.keys(data) },
    });

    return toProjectDomainMappingView(updated);
  }

  async remove(
    actor: AuthenticatedUser,
    projectId: string,
    mappingId: string,
  ): Promise<ProjectDomainMappingView> {
    await this.findMappingOrFail(projectId, mappingId);

    const removed = await this.prisma.projectDomainMapping.delete({ where: { id: mappingId } });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'PROJECT_DOMAIN_MAPPING_DELETED',
      entityType: 'ProjectDomainMapping',
      entityId: mappingId,
      projectId,
    });

    return toProjectDomainMappingView(removed);
  }

  /**
   * Garante que o ambiente referenciado pertence ao MESMO projeto do path.
   * Caso contrário (inexistente ou de outro projeto) rejeita sem vazar dados.
   */
  private async assertEnvironmentBelongsToProject(
    projectId: string,
    environmentId: string,
  ): Promise<void> {
    const environment = await this.prisma.projectEnvironment.findUnique({
      where: { id: environmentId },
    });

    if (environment === null || environment.projectId !== projectId) {
      throw new BadRequestException('Ambiente informado não pertence a este projeto.');
    }
  }

  private async findMappingOrFail(
    projectId: string,
    mappingId: string,
  ): Promise<ProjectDomainMapping> {
    const mapping = await this.prisma.projectDomainMapping.findUnique({ where: { id: mappingId } });

    if (mapping === null || mapping.projectId !== projectId) {
      throw new NotFoundException('Mapeamento de domínio não encontrado neste projeto.');
    }

    return mapping;
  }
}
