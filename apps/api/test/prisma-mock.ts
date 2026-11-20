/**
 * Mock em memória do `PrismaService` para testes que NÃO dependem de banco.
 *
 * Cobre apenas os métodos usados pela ETAPA 3 (usuários, sessões, vínculos e
 * auditoria). É um substituto de teste: não implementa transações nem toda a
 * superfície do Prisma.
 */
import { randomUUID } from 'node:crypto';
import {
  EnvironmentType,
  GlobalRole,
  RegistrationStatus,
  type AuditLog,
  type Project,
  type ProjectDomainMapping,
  type ProjectEnvironment,
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

export interface SeedEnvironmentInput {
  projectId: string;
  name: string;
  baseUrl: string;
  type?: EnvironmentType;
  status?: RegistrationStatus;
}

export interface SeedDomainMappingInput {
  projectId: string;
  domainPattern: string;
  environmentId: string;
  enabled?: boolean;
}

/** Filtro simplificado de `Project` usado pelos serviços da Etapa 4. */
interface ProjectWhere {
  status?: RegistrationStatus;
  members?: { some: { userId: string; status?: RegistrationStatus } };
  OR?: Array<{ name?: { contains: string }; code?: { contains: string } }>;
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
  project: {
    findUnique(args: { where: { id: string } | { code: string } }): Promise<Project | null>;
    findMany(args: {
      where?: ProjectWhere;
      skip?: number;
      take?: number;
      orderBy?: { createdAt?: 'asc' | 'desc' };
    }): Promise<Project[]>;
    count(args?: { where?: ProjectWhere }): Promise<number>;
    create(args: {
      data: {
        name: string;
        code: string;
        description?: string | null;
        status?: RegistrationStatus;
      };
    }): Promise<Project>;
    update(args: {
      where: { id: string };
      data: Partial<{
        name: string;
        code: string;
        description: string | null;
        status: RegistrationStatus;
      }>;
    }): Promise<Project>;
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
  projectEnvironment: {
    findUnique(args: { where: { id: string } }): Promise<ProjectEnvironment | null>;
    findMany(args: {
      where?: { projectId?: string };
      orderBy?: { name?: 'asc' | 'desc' };
    }): Promise<ProjectEnvironment[]>;
    create(args: {
      data: {
        projectId: string;
        name: string;
        baseUrl: string;
        type: EnvironmentType;
        status?: RegistrationStatus;
      };
    }): Promise<ProjectEnvironment>;
    update(args: {
      where: { id: string };
      data: Partial<{
        name: string;
        baseUrl: string;
        type: EnvironmentType;
        status: RegistrationStatus;
      }>;
    }): Promise<ProjectEnvironment>;
  };
  projectDomainMapping: {
    findUnique(args: { where: { id: string } }): Promise<ProjectDomainMapping | null>;
    findMany(args: {
      where?: { projectId?: string };
      orderBy?: { domainPattern?: 'asc' | 'desc' };
    }): Promise<ProjectDomainMapping[]>;
    create(args: {
      data: {
        projectId: string;
        domainPattern: string;
        environmentId: string;
        enabled?: boolean;
      };
    }): Promise<ProjectDomainMapping>;
    update(args: {
      where: { id: string };
      data: Partial<{
        domainPattern: string;
        environmentId: string;
        enabled: boolean;
      }>;
    }): Promise<ProjectDomainMapping>;
    delete(args: { where: { id: string } }): Promise<ProjectDomainMapping>;
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
    environments: ProjectEnvironment[];
    domains: ProjectDomainMapping[];
    sessions: RefreshSession[];
    auditLogs: AuditLog[];
  };
  seedUser(input: SeedUserInput): User;
  seedProject(input: SeedProjectInput): Project;
  seedMember(input: SeedMemberInput): ProjectMember;
  seedEnvironment(input: SeedEnvironmentInput): ProjectEnvironment;
  seedDomainMapping(input: SeedDomainMappingInput): ProjectDomainMapping;
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

function matchProjectWhere(
  project: Project,
  members: ProjectMember[],
  where: ProjectWhere | undefined,
): boolean {
  if (where === undefined) {
    return true;
  }

  if (where.status !== undefined && project.status !== where.status) {
    return false;
  }

  if (where.members !== undefined) {
    const { userId, status } = where.members.some;
    const hasMembership = members.some(
      (member) =>
        member.projectId === project.id &&
        member.userId === userId &&
        (status === undefined || member.status === status),
    );

    if (!hasMembership) {
      return false;
    }
  }

  if (where.OR !== undefined) {
    const matchesText = where.OR.some((condition) => {
      const nameTerm = condition.name?.contains;
      const codeTerm = condition.code?.contains;

      return (
        (nameTerm !== undefined &&
          project.name.toLowerCase().includes(nameTerm.toLowerCase())) ||
        (codeTerm !== undefined && project.code.toLowerCase().includes(codeTerm.toLowerCase()))
      );
    });

    if (!matchesText) {
      return false;
    }
  }

  return true;
}

export function createPrismaMock(): PrismaMock {
  const users: User[] = [];
  const projects: Project[] = [];
  const members: ProjectMember[] = [];
  const environments: ProjectEnvironment[] = [];
  const domains: ProjectDomainMapping[] = [];
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

  function seedEnvironment(input: SeedEnvironmentInput): ProjectEnvironment {
    const environment: ProjectEnvironment = {
      id: randomUUID(),
      projectId: input.projectId,
      name: input.name,
      baseUrl: input.baseUrl,
      type: input.type ?? EnvironmentType.TESTING,
      status: input.status ?? RegistrationStatus.ATIVO,
    };
    environments.push(environment);
    return environment;
  }

  function seedDomainMapping(input: SeedDomainMappingInput): ProjectDomainMapping {
    const mapping: ProjectDomainMapping = {
      id: randomUUID(),
      projectId: input.projectId,
      domainPattern: input.domainPattern,
      environmentId: input.environmentId,
      enabled: input.enabled ?? true,
    };
    domains.push(mapping);
    return mapping;
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

    project: {
      async findUnique(args) {
        const where = args.where;
        const project =
          'id' in where
            ? projects.find((candidate) => candidate.id === where.id)
            : projects.find((candidate) => candidate.code === where.code);
        return project === undefined ? null : clone(project);
      },

      async findMany(args) {
        const filtered = projects.filter((project) =>
          matchProjectWhere(project, members, args.where),
        );
        const sorted = [...filtered].sort((a, b) => {
          const direction = args.orderBy?.createdAt ?? 'asc';
          return direction === 'desc'
            ? b.createdAt.getTime() - a.createdAt.getTime()
            : a.createdAt.getTime() - b.createdAt.getTime();
        });
        const skip = args.skip ?? 0;
        const take = args.take ?? sorted.length;
        return clone(sorted.slice(skip, skip + take));
      },

      async count(args) {
        return projects.filter((project) => matchProjectWhere(project, members, args?.where)).length;
      },

      async create(args) {
        const now = new Date();
        const project: Project = {
          id: randomUUID(),
          name: args.data.name,
          code: args.data.code,
          description: args.data.description ?? null,
          status: args.data.status ?? RegistrationStatus.ATIVO,
          createdAt: now,
          updatedAt: now,
        };
        projects.push(project);
        return clone(project);
      },

      async update(args) {
        const index = projects.findIndex((candidate) => candidate.id === args.where.id);
        const current = projects[index];
        if (index === -1 || current === undefined) {
          throw new Error(`Projeto não encontrado no mock: ${args.where.id}`);
        }
        const updated: Project = { ...current, ...args.data, updatedAt: new Date() };
        projects[index] = updated;
        return clone(updated);
      },
    },

    projectEnvironment: {
      async findUnique(args) {
        const environment = environments.find((candidate) => candidate.id === args.where.id);
        return environment === undefined ? null : clone(environment);
      },

      async findMany(args) {
        const filtered = environments.filter(
          (environment) =>
            args.where?.projectId === undefined || environment.projectId === args.where.projectId,
        );
        const sorted = [...filtered].sort((a, b) => {
          const direction = args.orderBy?.name ?? 'asc';
          return direction === 'desc'
            ? b.name.localeCompare(a.name)
            : a.name.localeCompare(b.name);
        });
        return clone(sorted);
      },

      async create(args) {
        const environment: ProjectEnvironment = {
          id: randomUUID(),
          projectId: args.data.projectId,
          name: args.data.name,
          baseUrl: args.data.baseUrl,
          type: args.data.type,
          status: args.data.status ?? RegistrationStatus.ATIVO,
        };
        environments.push(environment);
        return clone(environment);
      },

      async update(args) {
        const index = environments.findIndex((candidate) => candidate.id === args.where.id);
        const current = environments[index];
        if (index === -1 || current === undefined) {
          throw new Error(`Ambiente não encontrado no mock: ${args.where.id}`);
        }
        const updated: ProjectEnvironment = { ...current, ...args.data };
        environments[index] = updated;
        return clone(updated);
      },
    },

    projectDomainMapping: {
      async findUnique(args) {
        const mapping = domains.find((candidate) => candidate.id === args.where.id);
        return mapping === undefined ? null : clone(mapping);
      },

      async findMany(args) {
        const filtered = domains.filter(
          (mapping) => args.where?.projectId === undefined || mapping.projectId === args.where.projectId,
        );
        const sorted = [...filtered].sort((a, b) => {
          const direction = args.orderBy?.domainPattern ?? 'asc';
          return direction === 'desc'
            ? b.domainPattern.localeCompare(a.domainPattern)
            : a.domainPattern.localeCompare(b.domainPattern);
        });
        return clone(sorted);
      },

      async create(args) {
        const mapping: ProjectDomainMapping = {
          id: randomUUID(),
          projectId: args.data.projectId,
          domainPattern: args.data.domainPattern,
          environmentId: args.data.environmentId,
          enabled: args.data.enabled ?? true,
        };
        domains.push(mapping);
        return clone(mapping);
      },

      async update(args) {
        const index = domains.findIndex((candidate) => candidate.id === args.where.id);
        const current = domains[index];
        if (index === -1 || current === undefined) {
          throw new Error(`Mapeamento de domínio não encontrado no mock: ${args.where.id}`);
        }
        const updated: ProjectDomainMapping = { ...current, ...args.data };
        domains[index] = updated;
        return clone(updated);
      },

      async delete(args) {
        const index = domains.findIndex((candidate) => candidate.id === args.where.id);
        const current = domains[index];
        if (index === -1 || current === undefined) {
          throw new Error(`Mapeamento de domínio não encontrado no mock: ${args.where.id}`);
        }
        domains.splice(index, 1);
        return clone(current);
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

    state: { users, projects, members, environments, domains, sessions, auditLogs },

    seedUser,
    seedProject,
    seedMember,
    seedEnvironment,
    seedDomainMapping,
  };

  return mock;
}
