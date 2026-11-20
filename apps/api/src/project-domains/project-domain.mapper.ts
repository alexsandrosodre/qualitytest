import type { ProjectDomainMapping } from '@prisma/client';

/** Visão pública do mapeamento de domínio do projeto. */
export interface ProjectDomainMappingView {
  id: string;
  projectId: string;
  domainPattern: string;
  environmentId: string;
  enabled: boolean;
}

export function toProjectDomainMappingView(
  mapping: ProjectDomainMapping,
): ProjectDomainMappingView {
  return {
    id: mapping.id,
    projectId: mapping.projectId,
    domainPattern: mapping.domainPattern,
    environmentId: mapping.environmentId,
    enabled: mapping.enabled,
  };
}
