'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { Paginated } from '@qualitytest/shared';

import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  RegistrationStatusBadge,
  type Column,
} from '@/components';
import { useActiveProject } from '@/lib/active-project';
import { apiGet, describeApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import type { ProjectView } from '@/lib/types';

const PAGE_SIZE = 20;

export default function ProjectsPage() {
  const { isAdmin, setActiveProject } = useActiveProject();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');

  const projectsQuery = useQuery({
    queryKey: ['projects', 'list', page, q],
    queryFn: () =>
      apiGet<Paginated<ProjectView>>('/projects', {
        query: { page, pageSize: PAGE_SIZE, q: q.trim() === '' ? undefined : q.trim() },
      }),
  });

  const columns: Column<ProjectView>[] = [
    {
      key: 'name',
      header: 'Projeto',
      render: (project) => (
        <div>
          <p className="font-medium text-slate-900">{project.name}</p>
          <p className="font-mono text-xs text-slate-500">{project.code}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (project) => <RegistrationStatusBadge status={project.status} />,
    },
    {
      key: 'description',
      header: 'Descrição',
      render: (project) => (
        <span className="line-clamp-2 text-slate-600">{project.description ?? '—'}</span>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Atualizado em',
      render: (project) => <span className="text-slate-500">{formatDateTime(project.updatedAt)}</span>,
    },
  ];

  const handleSelect = (project: ProjectView): void => {
    setActiveProject(project.id);
    router.push(`/projects/${project.id}`);
  };

  const result = projectsQuery.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Projetos</h1>
          <p className="text-sm text-slate-500">
            Selecione um projeto para definir o escopo ativo.
          </p>
        </div>
        {isAdmin ? (
          <Link href="/projects/new">
            <Button>Novo projeto</Button>
          </Link>
        ) : null}
      </div>

      <Card bodyClassName="space-y-4">
        <div className="max-w-md">
          <label htmlFor="q" className="mb-1 block text-sm font-medium text-slate-700">
            Buscar por nome ou código
          </label>
          <Input
            id="q"
            type="search"
            value={q}
            placeholder="Ex.: Intranet"
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
          />
        </div>

        {projectsQuery.isError ? (
          <ErrorState
            message={describeApiError(projectsQuery.error)}
            onRetry={() => {
              void projectsQuery.refetch();
            }}
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={result?.items ?? []}
              rowKey={(project) => project.id}
              loading={projectsQuery.isLoading}
              onRowClick={handleSelect}
              empty={
                <EmptyState
                  title="Nenhum projeto encontrado"
                  description="Ajuste a busca ou verifique seus vínculos de acesso."
                />
              }
            />

            {result !== undefined ? (
              <Pagination
                page={result.page}
                totalPages={result.totalPages}
                total={result.total}
                onChange={setPage}
              />
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}
