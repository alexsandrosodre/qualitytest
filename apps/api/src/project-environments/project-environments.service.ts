import { Injectable, NotFoundException } from '@nestjs/common';
import { RegistrationStatus, type Prisma, type ProjectEnvironment } from '@prisma/client';

import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateProjectEnvironmentDto } from './dto/create-project-environment.dto';
import { UpdateProjectEnvironmentDto } from './dto/update-project-environment.dto';
import {
  toProjectEnvironmentView,
  type ProjectEnvironmentView,
} from './project-environment.mapper';

@Injectable()
export class ProjectEnvironmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    actor: AuthenticatedUser,
    projectId: string,
    dto: CreateProjectEnvironmentDto,
  ): Promise<ProjectEnvironmentView> {
    const environment = await this.prisma.projectEnvironment.create({
      data: {
        projectId,
        name: dto.name.trim(),
        baseUrl: dto.baseUrl.trim(),
        type: dto.type,
        status: dto.status ?? RegistrationStatus.ATIVO,
      },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'PROJECT_ENVIRONMENT_CREATED',
      entityType: 'ProjectEnvironment',
      entityId: environment.id,
      projectId,
      metadata: { name: environment.name, type: environment.type },
    });

    return toProjectEnvironmentView(environment);
  }

  async list(projectId: string): Promise<ProjectEnvironmentView[]> {
    const environments = await this.prisma.projectEnvironment.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    });

    return environments.map(toProjectEnvironmentView);
  }

  async findOne(projectId: string, environmentId: string): Promise<ProjectEnvironmentView> {
    const environment = await this.findEnvironmentOrFail(projectId, environmentId);
    return toProjectEnvironmentView(environment);
  }

  async update(
    actor: AuthenticatedUser,
    projectId: string,
    environmentId: string,
    dto: UpdateProjectEnvironmentDto,
  ): Promise<ProjectEnvironmentView> {
    await this.findEnvironmentOrFail(projectId, environmentId);

    const data: Prisma.ProjectEnvironmentUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.baseUrl !== undefined) {
      data.baseUrl = dto.baseUrl.trim();
    }
    if (dto.type !== undefined) {
      data.type = dto.type;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    const updated = await this.prisma.projectEnvironment.update({
      where: { id: environmentId },
      data,
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'PROJECT_ENVIRONMENT_UPDATED',
      entityType: 'ProjectEnvironment',
      entityId: environmentId,
      projectId,
      metadata: { fields: Object.keys(data) },
    });

    return toProjectEnvironmentView(updated);
  }

  /** Desativação lógica do ambiente (não remove o registro). */
  async deactivate(
    actor: AuthenticatedUser,
    projectId: string,
    environmentId: string,
  ): Promise<ProjectEnvironmentView> {
    await this.findEnvironmentOrFail(projectId, environmentId);

    const updated = await this.prisma.projectEnvironment.update({
      where: { id: environmentId },
      data: { status: RegistrationStatus.INATIVO },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'PROJECT_ENVIRONMENT_DEACTIVATED',
      entityType: 'ProjectEnvironment',
      entityId: environmentId,
      projectId,
    });

    return toProjectEnvironmentView(updated);
  }

  /**
   * Resolve o ambiente SEMPRE por `id` + pertencimento ao `projectId` do path.
   * Ambiente de outro projeto é tratado como inexistente (404), sem vazar dados.
   */
  private async findEnvironmentOrFail(
    projectId: string,
    environmentId: string,
  ): Promise<ProjectEnvironment> {
    const environment = await this.prisma.projectEnvironment.findUnique({
      where: { id: environmentId },
    });

    if (environment === null || environment.projectId !== projectId) {
      throw new NotFoundException('Ambiente não encontrado neste projeto.');
    }

    return environment;
  }
}
