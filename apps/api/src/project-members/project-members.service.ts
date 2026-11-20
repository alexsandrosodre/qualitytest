import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RegistrationStatus, type ProjectMember, type ProjectRole } from '@prisma/client';

import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AddProjectMemberDto } from './dto/add-project-member.dto';

export interface ProjectMemberView {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  status: RegistrationStatus;
  addedBy: string;
  createdAt: string;
}

export interface ProjectMemberListItem extends ProjectMemberView {
  userName: string;
  userEmail: string;
}

function toProjectMemberView(member: ProjectMember): ProjectMemberView {
  return {
    id: member.id,
    projectId: member.projectId,
    userId: member.userId,
    role: member.role,
    status: member.status,
    addedBy: member.addedBy,
    createdAt: member.createdAt.toISOString(),
  };
}

@Injectable()
export class ProjectMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** Adiciona ou reativa o vínculo (respeita `@@unique([projectId, userId])`). */
  async add(
    actor: AuthenticatedUser,
    projectId: string,
    dto: AddProjectMemberDto,
  ): Promise<ProjectMemberView> {
    const target = await this.prisma.user.findUnique({ where: { id: dto.userId } });

    if (target === null) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (target.status !== RegistrationStatus.ATIVO) {
      throw new BadRequestException('Não é possível vincular um usuário inativo.');
    }

    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: dto.userId } },
    });

    const member =
      existing === null
        ? await this.prisma.projectMember.create({
            data: {
              projectId,
              userId: dto.userId,
              role: dto.role,
              status: RegistrationStatus.ATIVO,
              addedBy: actor.id,
            },
          })
        : await this.prisma.projectMember.update({
            where: { id: existing.id },
            data: {
              role: dto.role,
              status: RegistrationStatus.ATIVO,
              addedBy: actor.id,
            },
          });

    await this.auditService.record({
      actorUserId: actor.id,
      action: existing === null ? 'PROJECT_MEMBER_ADDED' : 'PROJECT_MEMBER_REACTIVATED',
      entityType: 'ProjectMember',
      entityId: member.id,
      projectId,
      metadata: { userId: dto.userId, role: dto.role },
    });

    return toProjectMemberView(member);
  }

  async list(projectId: string): Promise<ProjectMemberListItem[]> {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((member) => ({
      ...toProjectMemberView(member),
      userName: member.user.name,
      userEmail: member.user.email,
    }));
  }

  async updateRole(
    actor: AuthenticatedUser,
    projectId: string,
    userId: string,
    role: ProjectRole,
  ): Promise<ProjectMemberView> {
    const member = await this.findMembership(projectId, userId);

    const updated = await this.prisma.projectMember.update({
      where: { id: member.id },
      data: { role },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'PROJECT_MEMBER_ROLE_CHANGED',
      entityType: 'ProjectMember',
      entityId: member.id,
      projectId,
      metadata: { userId, role },
    });

    return toProjectMemberView(updated);
  }

  /** Desativação lógica do vínculo (não remove o histórico). */
  async remove(
    actor: AuthenticatedUser,
    projectId: string,
    userId: string,
  ): Promise<ProjectMemberView> {
    const member = await this.findMembership(projectId, userId);

    const updated = await this.prisma.projectMember.update({
      where: { id: member.id },
      data: { status: RegistrationStatus.INATIVO },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'PROJECT_MEMBER_DEACTIVATED',
      entityType: 'ProjectMember',
      entityId: member.id,
      projectId,
      metadata: { userId },
    });

    return toProjectMemberView(updated);
  }

  private async findMembership(projectId: string, userId: string) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (member === null) {
      throw new NotFoundException('Vínculo não encontrado.');
    }

    return member;
  }
}
