'use client';

import { useActiveProject } from '@/lib/active-project';

export function ProjectSelector() {
  const { projects, activeProject, setActiveProject, isLoading } = useActiveProject();

  if (isLoading) {
    return <span className="text-sm text-slate-400">Carregando projetos...</span>;
  }

  if (projects.length === 0) {
    return <span className="text-sm text-slate-500">Nenhum projeto disponível</span>;
  }

  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <span className="hidden sm:inline">Projeto ativo</span>
      <select
        aria-label="Projeto ativo"
        className="max-w-[240px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
        value={activeProject?.id ?? ''}
        onChange={(event) => setActiveProject(event.target.value)}
      >
        {activeProject === null ? <option value="">Selecione...</option> : null}
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name} ({project.code})
          </option>
        ))}
      </select>
    </label>
  );
}
