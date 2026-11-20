import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GlobalRole, RegistrationStatus, type Prisma } from '@prisma/client';
import type { Paginated } from '@qualitytest/shared';

import { AuditService } from '../common/audit/audit.service';
import { PasswordService } from '../common/password/password.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { toUserView, type UserView } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly auditService: AuditService,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateUserDto): Promise<UserView> {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing !== null) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        passwordHash,
        globalRole: dto.globalRole ?? null,
        status: dto.status ?? RegistrationStatus.ATIVO,
      },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email, globalRole: user.globalRole, status: user.status },
    });

    return toUserView(user);
  }

  async findAll(query: ListUsersQueryDto): Promise<Paginated<UserView>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return {
      items: items.map(toUserView),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<UserView> {
    this.assertSelfOrAdmin(actor, id);

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (user === null) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return toUserView(user);
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateUserDto): Promise<UserView> {
    const isAdmin = actor.globalRole === GlobalRole.ADMINISTRADOR;
    if (actor.id !== id && !isAdmin) {
      throw new ForbiddenException('Você só pode editar o próprio perfil.');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (user === null) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const data: Prisma.UserUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.email !== undefined) {
      if (!isAdmin) {
        throw new ForbiddenException('Somente administradores podem alterar o e-mail.');
      }

      const email = dto.email.trim().toLowerCase();

      if (email !== user.email) {
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing !== null && existing.id !== id) {
          throw new ConflictException('Já existe um usuário com este e-mail.');
        }
      }

      data.email = email;
    }

    const updated = await this.prisma.user.update({ where: { id }, data });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: id,
      metadata: { fields: Object.keys(data) },
    });

    return toUserView(updated);
  }

  async setStatus(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateUserStatusDto,
  ): Promise<UserView> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (user === null) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
    });

    // Desativação lógica: revoga todas as sessões ativas do usuário.
    if (dto.status === RegistrationStatus.INATIVO) {
      await this.prisma.refreshSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'USER_STATUS_CHANGED',
      entityType: 'User',
      entityId: id,
      metadata: { status: dto.status },
    });

    return toUserView(updated);
  }

  private assertSelfOrAdmin(actor: AuthenticatedUser, id: string): void {
    if (actor.id !== id && actor.globalRole !== GlobalRole.ADMINISTRADOR) {
      throw new ForbiddenException('Você só pode consultar o próprio perfil.');
    }
  }
}
