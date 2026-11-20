import type { Project, RegistrationStatus } from '@prisma/client';

/** Visão pública do projeto (serialização explícita). */
export interface ProjectView {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: RegistrationStatus;
  createdAt: string;
  updatedAt: string;
}

export function toProjectView(project: Project): ProjectView {
  return {
    id: project.id,
    name: project.name,
    code: project.code,
    description: project.description,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
