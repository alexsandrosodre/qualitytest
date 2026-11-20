import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { RegistrationStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';

import { AuditService } from '../common/audit/audit.service';
import { PasswordService } from '../common/password/password.service';
import { TokenService } from '../common/tokens/token.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { toUserView, type UserView } from '../users/user.mapper';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

/**
 * Prefixo aplicado ao `tokenHash` dos tokens de redefinição de senha.
 * Permite distinguir, sem alterar o schema, um token de redefinição de um
 * refresh token (ambos são persistidos como hash em `RefreshSession`).
 */
const PASSWORD_RESET_TOKEN_PREFIX = 'reset:';

/** TTL do token de redefinição de senha (1 hora). */
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResult extends SessionTokens {
  user: UserView;
}

export interface MeResult {
  user: {
    id: string;
    name: string;
    email: string;
    globalRole: string | null;
    status: RegistrationStatus;
  };
  projects: Array<{ projectId: string; name: string; code: string; role: string }>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    const passwordValid =
      user === null ? false : await this.passwordService.verify(user.passwordHash, dto.password);

    // Mensagem genérica: não revela se o e-mail existe nem se a conta está inativa.
    if (user === null || !passwordValid || user.status !== RegistrationStatus.ATIVO) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const tokens = await this.issueSession(user.id, user.globalRole);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.record({
      actorUserId: user.id,
      action: 'AUTH_LOGIN',
      entityType: 'User',
      entityId: user.id,
    });

    return { ...tokens, user: toUserView(updated) };
  }

  async refresh(dto: RefreshTokenDto): Promise<LoginResult> {
    const tokenHash = this.tokenService.hashRefreshToken(dto.refreshToken);
    const session = await this.prisma.refreshSession.findFirst({ where: { tokenHash } });

    if (
      session === null ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });

    if (user === null || user.status !== RegistrationStatus.ATIVO) {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    // Rotação: revoga o token apresentado e emite um novo par de tokens.
    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueSession(user.id, user.globalRole);

    return { ...tokens, user: toUserView(user) };
  }

  async logout(dto: RefreshTokenDto): Promise<{ success: true }> {
    const tokenHash = this.tokenService.hashRefreshToken(dto.refreshToken);
    const session = await this.prisma.refreshSession.findFirst({ where: { tokenHash } });

    if (session !== null && session.revokedAt === null) {
      await this.prisma.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      await this.auditService.record({
        actorUserId: session.userId,
        action: 'AUTH_LOGOUT',
        entityType: 'RefreshSession',
        entityId: session.id,
      });
    }

    return { success: true };
  }

  async me(user: AuthenticatedUser): Promise<MeResult> {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId: user.id, status: RegistrationStatus.ATIVO },
      include: { project: true },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        globalRole: user.globalRole,
        status: user.status,
      },
      projects: memberships.map((membership) => ({
        projectId: membership.projectId,
        name: membership.project.name,
        code: membership.project.code,
        role: membership.role,
      })),
    };
  }

  /**
   * Solicita redefinição de senha. SEMPRE retorna a mesma mensagem,
   * independentemente de o e-mail existir. Não há provedor de e-mail
   * configurado nesta etapa: apenas o evento é auditado (sem enviar e-mail).
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user !== null && user.status === RegistrationStatus.ATIVO) {
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = `${PASSWORD_RESET_TOKEN_PREFIX}${this.tokenService.hashRefreshToken(rawToken)}`;
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

      // O hash é persistido; o token em claro nunca é retornado nem registrado.
      await this.prisma.refreshSession.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      await this.auditService.record({
        actorUserId: user.id,
        action: 'AUTH_PASSWORD_RESET_REQUESTED',
        entityType: 'User',
        entityId: user.id,
        metadata: {
          channel: 'none',
          note: 'Sem provedor de e-mail configurado; token não enviado.',
        },
      });
    }

    return {
      message: 'Se o e-mail informado existir, as instruções de redefinição serão processadas.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    const expectedHash = `${PASSWORD_RESET_TOKEN_PREFIX}${this.tokenService.hashRefreshToken(dto.token)}`;
    const session = await this.prisma.refreshSession.findFirst({
      where: { tokenHash: expectedHash },
    });

    if (
      session === null ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Token de redefinição inválido ou expirado.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (user === null) {
      throw new BadRequestException('Token de redefinição inválido ou expirado.');
    }

    const passwordHash = await this.passwordService.hash(dto.newPassword);

    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    // Uso único: revoga o token e todas as sessões ativas do usuário.
    await this.prisma.refreshSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.auditService.record({
      actorUserId: user.id,
      action: 'AUTH_PASSWORD_RESET',
      entityType: 'User',
      entityId: user.id,
    });

    return { success: true };
  }

  async changePassword(
    user: AuthenticatedUser,
    dto: ChangePasswordDto,
  ): Promise<{ success: true }> {
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (dbUser === null) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const currentValid = await this.passwordService.verify(dbUser.passwordHash, dto.currentPassword);
    if (!currentValid) {
      throw new BadRequestException('Senha atual incorreta.');
    }

    const passwordHash = await this.passwordService.hash(dto.newPassword);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    // Revoga as demais sessões; preserva a sessão atual quando o refresh token é informado.
    const keptTokenHash =
      dto.refreshToken !== undefined ? this.tokenService.hashRefreshToken(dto.refreshToken) : null;

    await this.prisma.refreshSession.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
        ...(keptTokenHash === null ? {} : { tokenHash: { not: keptTokenHash } }),
      },
      data: { revokedAt: new Date() },
    });

    await this.auditService.record({
      actorUserId: user.id,
      action: 'AUTH_PASSWORD_CHANGED',
      entityType: 'User',
      entityId: user.id,
    });

    return { success: true };
  }

  private async issueSession(
    userId: string,
    globalRole: AuthenticatedUser['globalRole'],
  ): Promise<SessionTokens> {
    const accessToken = await this.tokenService.generateAccessToken({ sub: userId, globalRole });
    const refreshToken = this.tokenService.generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.tokenService.getRefreshTokenTtlMs());

    await this.prisma.refreshSession.create({
      data: { userId, tokenHash: refreshToken.tokenHash, expiresAt },
    });

    return {
      accessToken,
      refreshToken: refreshToken.token,
      expiresIn: this.tokenService.getAccessTokenTtlSeconds(),
    };
  }
}
