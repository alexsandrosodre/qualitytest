import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { GlobalRole, ProjectRole, RegistrationStatus, type User } from '@prisma/client';

import { createPrismaMock, type PrismaMock } from '../../test/prisma-mock';
import { AuditService } from '../common/audit/audit.service';
import { PasswordService } from '../common/password/password.service';
import { TokenService } from '../common/tokens/token.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

const PASSWORD = 'Senha@12345';
const NEW_PASSWORD = 'NovaSenha@12345';

function asAuthenticated(user: User): AuthenticatedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    globalRole: user.globalRole,
    status: user.status,
  };
}

describe('AuthService', () => {
  let prisma: PrismaMock;
  let passwordService: PasswordService;
  let tokenService: TokenService;
  let service: AuthService;
  let passwordHash: string;

  beforeAll(async () => {
    passwordService = new PasswordService();
    passwordHash = await passwordService.hash(PASSWORD);
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    const jwtService = new JwtService({ secret: 'unit-secret', signOptions: { expiresIn: 900 } });
    const configService = new ConfigService({ JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL: '7d' });
    tokenService = new TokenService(jwtService, configService);
    const auditService = new AuditService(prisma as unknown as PrismaService);
    service = new AuthService(
      prisma as unknown as PrismaService,
      passwordService,
      tokenService,
      auditService,
    );
  });

  function seedActiveUser(globalRole: GlobalRole | null = null): User {
    return prisma.seedUser({
      name: 'Usuário Teste',
      email: 'usuario@test.local',
      passwordHash,
      globalRole,
    });
  }

  describe('login', () => {
    it('autentica um usuário ativo e emite tokens sem expor o hash da senha', async () => {
      const user = seedActiveUser(GlobalRole.ADMINISTRADOR);

      const result = await service.login({ email: 'Usuario@Test.local', password: PASSWORD });

      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.expiresIn).toBe(900);
      expect(result.user.id).toBe(user.id);
      expect((result.user as unknown as Record<string, unknown>)['passwordHash']).toBeUndefined();
      expect(prisma.state.sessions).toHaveLength(1);
      expect(prisma.state.auditLogs.some((entry) => entry.action === 'AUTH_LOGIN')).toBe(true);
    });

    it('rejeita senha incorreta com 401', async () => {
      seedActiveUser();

      await expect(
        service.login({ email: 'usuario@test.local', password: 'senha-errada' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejeita e-mail desconhecido com 401', async () => {
      await expect(
        service.login({ email: 'nao-existe@test.local', password: PASSWORD }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejeita usuário inativo com 401', async () => {
      prisma.seedUser({
        name: 'Inativo',
        email: 'inativo@test.local',
        passwordHash,
        status: RegistrationStatus.INATIVO,
      });

      await expect(
        service.login({ email: 'inativo@test.local', password: PASSWORD }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('rotaciona o refresh token e revoga o token apresentado', async () => {
      seedActiveUser();
      const login = await service.login({ email: 'usuario@test.local', password: PASSWORD });

      const refreshed = await service.refresh({ refreshToken: login.refreshToken });

      expect(refreshed.refreshToken).not.toBe(login.refreshToken);

      const oldHash = tokenService.hashRefreshToken(login.refreshToken);
      const oldSession = await prisma.refreshSession.findFirst({ where: { tokenHash: oldHash } });
      expect(oldSession?.revokedAt).not.toBeNull();

      await expect(
        service.refresh({ refreshToken: login.refreshToken }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejeita refresh token desconhecido', async () => {
      await expect(
        service.refresh({ refreshToken: 'token-inexistente' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revoga a sessão informada', async () => {
      seedActiveUser();
      const login = await service.login({ email: 'usuario@test.local', password: PASSWORD });

      await expect(service.logout({ refreshToken: login.refreshToken })).resolves.toEqual({
        success: true,
      });

      const session = await prisma.refreshSession.findFirst({
        where: { tokenHash: tokenService.hashRefreshToken(login.refreshToken) },
      });
      expect(session?.revokedAt).not.toBeNull();

      await expect(
        service.refresh({ refreshToken: login.refreshToken }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('me', () => {
    it('lista apenas os vínculos ativos do usuário', async () => {
      const user = seedActiveUser();
      const project = prisma.seedProject({ name: 'Portal', code: 'PORTAL' });
      const otherProject = prisma.seedProject({ name: 'Intranet', code: 'INTRA' });
      prisma.seedMember({ projectId: project.id, userId: user.id, role: ProjectRole.GESTOR });
      prisma.seedMember({
        projectId: otherProject.id,
        userId: user.id,
        role: ProjectRole.TESTADOR,
        status: RegistrationStatus.INATIVO,
      });

      const result = await service.me(asAuthenticated(user));

      expect(result.user.id).toBe(user.id);
      expect(result.projects).toEqual([
        { projectId: project.id, name: 'Portal', code: 'PORTAL', role: ProjectRole.GESTOR },
      ]);
    });
  });

  describe('reset de senha', () => {
    it('forgot-password responde igual para e-mail existente e inexistente', async () => {
      const user = seedActiveUser();

      const existing = await service.forgotPassword({ email: user.email });
      const missing = await service.forgotPassword({ email: 'nao-existe@test.local' });

      expect(existing.message).toBe(missing.message);
      expect(prisma.state.sessions).toHaveLength(1);
      expect(prisma.state.sessions[0]?.tokenHash.startsWith('reset:')).toBe(true);
    });

    it('reset-password redefine a senha e revoga todas as sessões do usuário', async () => {
      const user = seedActiveUser();
      const rawToken = 'reset-token-uso-unico';
      await prisma.refreshSession.create({
        data: {
          userId: user.id,
          tokenHash: `reset:${tokenService.hashRefreshToken(rawToken)}`,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      await prisma.refreshSession.create({
        data: {
          userId: user.id,
          tokenHash: tokenService.hashRefreshToken('sessao-ativa'),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await expect(
        service.resetPassword({ token: rawToken, newPassword: NEW_PASSWORD }),
      ).resolves.toEqual({ success: true });

      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updated).not.toBeNull();
      await expect(
        passwordService.verify(updated?.passwordHash ?? '', NEW_PASSWORD),
      ).resolves.toBe(true);

      const activeSessions = prisma.state.sessions.filter(
        (session) => session.userId === user.id && session.revokedAt === null,
      );
      expect(activeSessions).toHaveLength(0);
    });

    it('reset-password rejeita token inválido', async () => {
      await expect(
        service.resetPassword({ token: 'token-invalido', newPassword: NEW_PASSWORD }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('altera a senha e preserva apenas a sessão atual quando o refresh token é informado', async () => {
      const user = seedActiveUser();
      const keptToken = 'sessao-atual';
      const otherToken = 'outra-sessao';
      await prisma.refreshSession.create({
        data: {
          userId: user.id,
          tokenHash: tokenService.hashRefreshToken(keptToken),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      await prisma.refreshSession.create({
        data: {
          userId: user.id,
          tokenHash: tokenService.hashRefreshToken(otherToken),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await expect(
        service.changePassword(asAuthenticated(user), {
          currentPassword: PASSWORD,
          newPassword: NEW_PASSWORD,
          refreshToken: keptToken,
        }),
      ).resolves.toEqual({ success: true });

      const kept = await prisma.refreshSession.findFirst({
        where: { tokenHash: tokenService.hashRefreshToken(keptToken) },
      });
      const other = await prisma.refreshSession.findFirst({
        where: { tokenHash: tokenService.hashRefreshToken(otherToken) },
      });

      expect(kept?.revokedAt).toBeNull();
      expect(other?.revokedAt).not.toBeNull();
    });

    it('rejeita quando a senha atual está incorreta', async () => {
      const user = seedActiveUser();

      await expect(
        service.changePassword(asAuthenticated(user), {
          currentPassword: 'senha-errada',
          newPassword: NEW_PASSWORD,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
