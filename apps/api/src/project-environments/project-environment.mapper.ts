import type { EnvironmentType, ProjectEnvironment, RegistrationStatus } from '@prisma/client';

/** Visão pública do ambiente de projeto. */
export interface ProjectEnvironmentView {
  id: string;
  projectId: string;
  name: string;
  baseUrl: string;
  type: EnvironmentType;
  status: RegistrationStatus;
}

export function toProjectEnvironmentView(
  environment: ProjectEnvironment,
): ProjectEnvironmentView {
  return {
    id: environment.id,
    projectId: environment.projectId,
    name: environment.name,
    baseUrl: environment.baseUrl,
    type: environment.type,
    status: environment.status,
  };
}
