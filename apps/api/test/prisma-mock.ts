/**
 * Mock em memória do `PrismaService` para testes que NÃO dependem de banco.
 *
 * Cobre apenas os métodos usados pela ETAPA 3 (usuários, sessões, vínculos e
 * auditoria). É um substituto de teste: não implementa transações nem toda a
 * superfície do Prisma.
 */
import { randomUUID } from 'node:crypto';
import {
  GlobalRole,
  RegistrationStatus,
  type AuditLog,
  type Project,
  type ProjectMember,
  type ProjectRole,
  type RefreshSession,
  type User,
} from '@prisma/client';

export interface SeedUserInput {
  name: string;
  email: string;
  passwordHash: string;
  globalRole?: GlobalRole | null;
  status?: RegistrationStatus;
}

export interface SeedProjectInput {
  name: string;
  code: string;
}

export interface SeedMemberInput {
  projectId: string;
  userId: string;
  role: ProjectRole;
  status?: RegistrationStatus;
  addedBy?: string;
}

export interface PrismaMock {
  user: {
    findUnique(args: { where: { id: string } | { email: string } }): Promise<User | null>;
    create(args: {
      data: {
        name: string;
        email: string;
        passwordHash: string;
        globalRole?: GlobalRole | null;
        status?: RegistrationStatus;
      };
    }): Promise<User>;
    update(args: {
      where: { id: string };
      data: Partial<{
        name: string;
        email: string;
        passwordHash: string;
        status: RegistrationStatus;
        globalRole: GlobalRole | null;
        lastLoginAt: Date;
      }>;
    }): Promise<User>;
    findMany(args: { skip?: number; take?: number }): Promise<User[]>;
    count(): Promise<number>;
  };
  projectMember: {
    findUnique(args: {
      where: { projectId_userId: { projectId: string; userId: string } };
    }): Promise<ProjectMember | null>;
    findMany(args: {
      where: { projectId: string } | { userId: string; status?: RegistrationStatus };
      include?: { user?: boolean; project?: boolean };
    }): Promise<Array<ProjectMember & { user: User; project: Project }>>;
    create(args: {
      data: {
        projectId: string;
        userId: string;
        role: ProjectRole;
        status?: RegistrationStatus;
        addedBy: string;
      };
    }): Promise<ProjectMember>;
    update(args: {
      where: { id: string };
      data: Partial<{ role: ProjectRole; status: RegistrationStatus; addedBy: string }>;
    }): Promise<ProjectMember>;
  };
  refreshSession: {
    create(args: {
      data: { userId: string; tokenHash: string; expiresAt: Date };
    }): Promise<RefreshSession>;
    findFirst(args: { where: { tokenHash: string } }): Promise<RefreshSession | null>;
    update(args: { where: { id: string }; data: { revokedAt: Date } }): Promise<RefreshSession>;
    updateMany(args: {
      where: {
        userId: string;
        revokedAt?: null;
        tokenHash?: { not: string };
      };
      data: { revokedAt: Date };
    }): Promise<{ count: number }>;
  };
  auditLog: {
    create(args: {
      data: {
        actorUserId: string;
        action: string;
        entityType: string;
        entityId: string;
        projectId?: string | null;
        metadata?: unknown;
      };
    }): Promise<AuditLog>;
  };
  $queryRaw: () => Promise<unknown[]>;
  /** Dados brutos para asserções em testes. */
  state: {
    users: User[];
    projects: Project[];
    members: ProjectMember[];
    sessions: RefreshSession[];
    auditLogs: AuditLog[];
  };
  seedUser(input: SeedUserInput): User;
  seedProject(input: SeedProjectInput): Project;
  seedMember(input: SeedMemberInput): ProjectMember;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function matchMemberWhere(
  member: ProjectMember,
  where: { projectId: string } | { userId: string; status?: RegistrationStatus },
): boolean {
  if ('projectId' in where) {
    return member.projectId === where.projectId;
  }

  if (member.userId !== where.userId) {
    return false;
  }

  if (where.status !== undefined && member.status !== where.status) {
    return false;
  }

  return true;
}

export function createPrismaMock(): PrismaMock {
  const users: User[] = [];
  const projects: Project[] = [];
  const members: ProjectMember[] = [];
  const sessions: RefreshSession[] = [];
  const auditLogs: AuditLog[] = [];

  function seedUser(input: SeedUserInput): User {
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      globalRole: input.globalRole ?? null,
      status: input.status ?? RegistrationStatus.ATIVO,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };
    users.push(user);
    return user;
  }

  function seedProject(input: SeedProjectInput): Project {
    const now = new Date();
    const project: Project = {
      id: randomUUID(),
      name: input.name,
      code: input.code,
      description: null,
      status: RegistrationStatus.ATIVO,
      createdAt: now,
      updatedAt: now,
    };
    projects.push(project);
    return project;
  }

  function seedMember(input: SeedMemberInput): ProjectMember {
    const member: ProjectMember = {
      id: randomUUID(),
      projectId: input.projectId,
      userId: input.userId,
      role: input.role,
      status: input.status ?? RegistrationStatus.ATIVO,
      addedBy: input.addedBy ?? input.userId,
      createdAt: new Date(),
    };
    members.push(member);
    return member;
  }

  const mock: PrismaMock = {
    user: {
      async findUnique(args) {
        const where = args.where;
        const user =
          'id' in where
            ? users.find((candidate) => candidate.id === where.id)
            : users.find((candidate) => candidate.email === where.email.toLowerCase());
        return user === undefined ? null : clone(user);
      },

      async create(args) {
        const now = new Date();
        const user: User = {
          id: randomUUID(),
          name: args.data.name,
          email: args.data.email.toLowerCase(),
          passwordHash: args.data.passwordHash,
          globalRole: args.data.globalRole ?? null,
          status: args.data.status ?? RegistrationStatus.ATIVO,
          createdAt: now,
          updatedAt: now,
          lastLoginAt: null,
        };
        users.push(user);
        return clone(user);
      },

      async update(args) {
        const index = users.findIndex((candidate) => candidate.id === args.where.id);
        const current = users[index];
        if (index === -1 || current === undefined) {
          throw new Error(`Usuário não encontrado no mock: ${args.where.id}`);
        }
        const updated: User = { ...current, ...args.data, updatedAt: new Date() };
        users[index] = updated;
        return clone(updated);
      },

      async findMany(args) {
        const sorted = [...users].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const skip = args.skip ?? 0;
        const take = args.take ?? sorted.length;
        return clone(sorted.slice(skip, skip + take));
      },

      async count() {
        return users.length;
      },
    },

    projectMember: {
      async findUnique(args) {
        const { projectId, userId } = args.where.projectId_userId;
        const member = members.find(
          (candidate) => candidate.projectId === projectId && candidate.userId === userId,
        );
        return member === undefined ? null : clone(member);
      },

      async findMany(args) {
        const filtered = members.filter((member) => matchMemberWhere(member, args.where));

        return clone(
          filtered.map((member) => ({
            ...member,
            user: users.find((candidate) => candidate.id === member.userId) as User,
            project: projects.find((candidate) => candidate.id === member.projectId) as Project,
          })),
        );
      },

      async create(args) {
        const member: ProjectMember = {
          id: randomUUID(),
          projectId: args.data.projectId,
          userId: args.data.userId,
          role: args.data.role,
          status: args.data.status ?? RegistrationStatus.ATIVO,
          addedBy: args.data.addedBy,
          createdAt: new Date(),
        };
        members.push(member);
        return clone(member);
      },

      async update(args) {
        const index = members.findIndex((candidate) => candidate.id === args.where.id);
        const current = members[index];
        if (index === -1 || current === undefined) {
          throw new Error(`Vínculo não encontrado no mock: ${args.where.id}`);
        }
        const updated: ProjectMember = { ...current, ...args.data };
        members[index] = updated;
        return clone(updated);
      },
    },

    refreshSession: {
      async create(args) {
        const session: RefreshSession = {
          id: randomUUID(),
          userId: args.data.userId,
          tokenHash: args.data.tokenHash,
          expiresAt: args.data.expiresAt,
          revokedAt: null,
          createdAt: new Date(),
        };
        sessions.push(session);
        return clone(session);
      },

      async findFirst(args) {
        const session = sessions.find((candidate) => candidate.tokenHash === args.where.tokenHash);
        return session === undefined ? null : clone(session);
      },

      async update(args) {
        const index = sessions.findIndex((candidate) => candidate.id === args.where.id);
        const current = sessions[index];
        if (index === -1 || current === undefined) {
          throw new Error(`Sessão não encontrada no mock: ${args.where.id}`);
        }
        const updated: RefreshSession = { ...current, revokedAt: args.data.revokedAt };
        sessions[index] = updated;
        return clone(updated);
      },

      async updateMany(args) {
        let count = 0;
        sessions.forEach((session, index) => {
          if (session.userId !== args.where.userId) {
            return;
          }
          if (args.where.revokedAt === null && session.revokedAt !== null) {
            return;
          }
          if (args.where.tokenHash !== undefined && session.tokenHash === args.where.tokenHash.not) {
            return;
          }
          sessions[index] = { ...session, revokedAt: args.data.revokedAt };
          count += 1;
        });
        return { count };
      },
    },

    auditLog: {
      async create(args) {
        const entry: AuditLog = {
          id: randomUUID(),
          actorUserId: args.data.actorUserId,
          projectId: args.data.projectId ?? null,
          action: args.data.action,
          entityType: args.data.entityType,
          entityId: args.data.entityId,
          metadata: (args.data.metadata ?? null) as AuditLog['metadata'],
          createdAt: new Date(),
        };
        auditLogs.push(entry);
        return clone(entry);
      },
    },

    async $queryRaw() {
      return [{ '?column?': 1 }];
    },

    state: { users, projects, members, sessions, auditLogs },

    seedUser,
    seedProject,
    seedMember,
  };

  return mock;
}
