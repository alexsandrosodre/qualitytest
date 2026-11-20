import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GlobalRole, RegistrationStatus, type Prisma } from '@prisma/client';
import type { Paginated } from '@qualitytest/shared';

import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { toProjectView, type ProjectView } from './project.mapper';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** Cria um projeto. Somente ADMINISTRADOR (validado pelo guard). */
  async create(actor: AuthenticatedUser, dto: CreateProjectDto): Promise<ProjectView> {
    const code = dto.code.trim();

    const existing = await this.prisma.project.findUnique({ where: { code } });
    if (existing !== null) {
      throw new ConflictException('Já existe um projeto com este código.');
    }

    const project = await this.prisma.project.create({
      data: {
        name: dto.name.trim(),
        code,
        description: dto.description?.trim() ?? null,
        status: dto.status ?? RegistrationStatus.ATIVO,
      },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: project.id,
      projectId: project.id,
      metadata: { code: project.code, name: project.name, status: project.status },
    });

    return toProjectView(project);
  }

  /**
   * Lista projetos. ADMINISTRADOR vê todos; os demais veem SOMENTE projetos em
   * que possuem vínculo ATIVO (`ProjectMember.status = ATIVO`).
   */
  async findAll(
    actor: AuthenticatedUser,
    query: ListProjectsQueryDto,
  ): Promise<Paginated<ProjectView>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ProjectWhereInput = {};

    if (query.status !== undefined) {
      where.status = query.status;
    }

    if (query.q !== undefined && query.q.trim().length > 0) {
      const term = query.q.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { code: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (actor.globalRole !== GlobalRole.ADMINISTRADOR) {
      where.members = { some: { userId: actor.id, status: RegistrationStatus.ATIVO } };
    }

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      items: items.map(toProjectView),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /** Detalhe do projeto. O vínculo é validado pela `ProjectAccessGuard`. */
  async findOne(projectId: string): Promise<ProjectView> {
    const project = await this.findProjectOrFail(projectId);
    return toProjectView(project);
  }

  /** Atualiza nome/código/descrição (ADMINISTRADOR ou GESTOR do projeto). */
  async update(
    actor: AuthenticatedUser,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectView> {
    const project = await this.findProjectOrFail(projectId);

    const data: Prisma.ProjectUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      data.description = dto.description.trim();
    }

    if (dto.code !== undefined) {
      const code = dto.code.trim();
      if (code !== project.code) {
        const existing = await this.prisma.project.findUnique({ where: { code } });
        if (existing !== null && existing.id !== projectId) {
          throw new ConflictException('Já existe um projeto com este código.');
        }
      }
      data.code = code;
    }

    const updated = await this.prisma.project.update({ where: { id: projectId }, data });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'PROJECT_UPDATED',
      entityType: 'Project',
      entityId: projectId,
      projectId,
      metadata: { fields: Object.keys(data) },
    });

    return toProjectView(updated);
  }

  /** Ativa/desativa o projeto (desativação lógica). Somente ADMINISTRADOR. */
  async setStatus(
    actor: AuthenticatedUser,
    projectId: string,
    status: RegistrationStatus,
  ): Promise<ProjectView> {
    await this.findProjectOrFail(projectId);

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { status },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'PROJECT_STATUS_CHANGED',
      entityType: 'Project',
      entityId: projectId,
      projectId,
      metadata: { status },
    });

    return toProjectView(updated);
  }

  private async findProjectOrFail(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });

    if (project === null) {
      throw new NotFoundException('Projeto não encontrado.');
    }

    return project;
  }
}
