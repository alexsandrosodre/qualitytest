'use client';

/**
 * Provedor do "projeto ativo".
 *
 * Resolve a lista de projetos visíveis a partir dos vínculos (`memberships`) e,
 * para ADMINISTRADOR, complementa com `GET /projects`. O projeto selecionado é
 * lembrado por usuário em `localStorage`.
 */
import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { GlobalRole, type ProjectRole } from '@qualitytest/shared';

import { apiGet } from './api-client';
import { useAuth } from './auth';
import type { Paginated } from '@qualitytest/shared';
import type { ProjectView } from './types';

export interface ProjectOption {
  id: string;
  name: string;
  code: string;
  role: ProjectRole | null;
}

interface ActiveProjectContextValue {
  activeProject: ProjectOption | null;
  setActiveProject: (projectId: string) => void;
  projects: ProjectOption[];
  isLoading: boolean;
  isAdmin: boolean;
}

const ActiveProjectContext = createContext<ActiveProjectContextValue | null>(null);

function storageKey(userId: string): string {
  return `qualitytest.activeProject.${userId}`;
}

async function fetchAllProjects(): Promise<ProjectView[]> {
  const first = await apiGet<Paginated<ProjectView>>('/projects', {
    query: { page: 1, pageSize: 100 },
  });
  const items = [...first.items];

  for (let page = 2; page <= first.totalPages; page += 1) {
    const next = await apiGet<Paginated<ProjectView>>('/projects', {
      query: { page, pageSize: 100 },
    });
    items.push(...next.items);
  }

  return items;
}

export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const { user, memberships, isAuthenticated } = useAuth();
  const isAdmin = user?.globalRole === GlobalRole.ADMINISTRADOR;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const adminQuery = useQuery({
    queryKey: ['projects', 'all'],
    queryFn: fetchAllProjects,
    enabled: isAuthenticated && isAdmin,
  });

  const projects = useMemo<ProjectOption[]>(() => {
    const membershipRoleById = new Map<string, ProjectRole>(
      memberships.map((membership) => [membership.projectId, membership.role]),
    );

    if (isAdmin) {
      return (adminQuery.data ?? []).map((project) => ({
        id: project.id,
        name: project.name,
        code: project.code,
        role: membershipRoleById.get(project.id) ?? null,
      }));
    }

    return memberships.map((membership) => ({
      id: membership.projectId,
      name: membership.name,
      code: membership.code,
      role: membership.role,
    }));
  }, [isAdmin, adminQuery.data, memberships]);

  // Restaura a seleção persistida por usuário.
  useEffect(() => {
    if (user === null || typeof window === 'undefined') {
      return;
    }
    const stored = window.localStorage.getItem(storageKey(user.id));
    if (stored !== null) {
      setSelectedId(stored);
    }
  }, [user]);

  const activeProject = useMemo<ProjectOption | null>(() => {
    if (projects.length === 0) {
      return null;
    }
    const found = projects.find((project) => project.id === selectedId);
    return found ?? projects[0] ?? null;
  }, [projects, selectedId]);

  // Garante que a seleção aponte para um projeto válido e persiste o default.
  useEffect(() => {
    if (activeProject === null || user === null || typeof window === 'undefined') {
      return;
    }
    if (selectedId !== activeProject.id) {
      setSelectedId(activeProject.id);
      window.localStorage.setItem(storageKey(user.id), activeProject.id);
    }
  }, [activeProject, selectedId, user]);

  const setActiveProject = useCallback(
    (projectId: string): void => {
      setSelectedId(projectId);
      if (user !== null && typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey(user.id), projectId);
      }
    },
    [user],
  );

  const isLoading = isAuthenticated && isAdmin && adminQuery.isLoading;

  const value = useMemo<ActiveProjectContextValue>(
    () => ({ activeProject, setActiveProject, projects, isLoading, isAdmin }),
    [activeProject, setActiveProject, projects, isLoading, isAdmin],
  );

  return (
    <ActiveProjectContext.Provider value={value}>{children}</ActiveProjectContext.Provider>
  );
}

export function useActiveProject(): ActiveProjectContextValue {
  const context = useContext(ActiveProjectContext);
  if (context === null) {
    throw new Error('useActiveProject deve ser usado dentro de <ActiveProjectProvider>.');
  }
  return context;
}
