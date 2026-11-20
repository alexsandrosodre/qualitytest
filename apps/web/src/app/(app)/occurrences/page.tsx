'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  OCCURRENCE_CATEGORIES,
  OCCURRENCE_PRIORITIES,
  OCCURRENCE_STATUSES,
  OccurrenceCategory,
  OccurrencePriority,
  OccurrenceStatus,
  type Paginated,
} from '@qualitytest/shared';

import {
  Button,
  Card,
  CategoryBadge,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Pagination,
  PriorityBadge,
  Select,
  StatusBadge,
  type Column,
} from '@/components';
import { useActiveProject } from '@/lib/active-project';
import { apiGet, describeApiError } from '@/lib/api-client';
import {
  OCCURRENCE_CATEGORY_LABELS,
  OCCURRENCE_PRIORITY_LABELS,
  OCCURRENCE_STATUS_LABELS,
  formatDateTime,
} from '@/lib/format';
import type { OccurrenceSummaryView, ProjectMemberListItem } from '@/lib/types';

const PAGE_SIZE = 20;

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'createdAt:desc', label: 'Mais recentes' },
  { value: 'createdAt:asc', label: 'Mais antigas' },
  { value: 'updatedAt:desc', label: 'Atualizadas recentemente' },
  { value: 'updatedAt:asc', label: 'Atualizadas há mais tempo' },
];

export default function OccurrencesPage() {
  const { activeProject } = useActiveProject();
  const router = useRouter();
  const projectId = activeProject?.id ?? null;

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('createdAt:desc');

  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    enabled: projectId !== null,
    queryFn: () => apiGet<ProjectMemberListItem[]>(`/projects/${projectId}/members`),
  });

  const occurrencesQuery = useQuery({
    queryKey: [
      'occurrences',
      'list',
      projectId,
      page,
      status,
      priority,
      category,
      assigneeUserId,
      q,
      from,
      to,
      sort,
    ],
    enabled: projectId !== null,
    queryFn: () =>
      apiGet<Paginated<OccurrenceSummaryView>>('/occurrences', {
        query: {
          projectId,
          page,
          pageSize: PAGE_SIZE,
          status: status === '' ? undefined : status,
          priority: priority === '' ? undefined : priority,
          categoryId: category === '' ? undefined : category,
          assigneeUserId: assigneeUserId === '' ? undefined : assigneeUserId,
          q: q.trim() === '' ? undefined : q.trim(),
          from: from === '' ? undefined : from,
          to: to === '' ? undefined : to,
          sort,
        },
      }),
  });

  const resetPage = (): void => setPage(1);

  const columns: Column<OccurrenceSummaryView>[] = [
    {
      key: 'code',
      header: 'Código',
      render: (occurrence) => (
        <span className="font-mono text-xs text-slate-700">{occurrence.publicCode}</span>
      ),
    },
    {
      key: 'title',
      header: 'Título',
      render: (occurrence) => (
        <span className="font-medium text-slate-900">{occurrence.title}</span>
      ),
    },
    {
      key: 'category',
      header: 'Categoria',
      render: (occurrence) => <CategoryBadge category={occurrence.categoryId} />,
    },
    {
      key: 'priority',
      header: 'Prioridade',
      render: (occurrence) => <PriorityBadge priority={occurrence.priority} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (occurrence) => <StatusBadge status={occurrence.status} />,
    },
    {
      key: 'createdAt',
      header: 'Criada em',
      render: (occurrence) => (
        <span className="text-slate-500">{formatDateTime(occurrence.createdAt)}</span>
      ),
    },
  ];

  if (activeProject === null) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="Nenhum projeto ativo"
          description="Selecione um projeto no topo da página para visualizar as ocorrências."
        />
      </div>
    );
  }

  const result = occurrencesQuery.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Ocorrências</h1>
          <p className="text-sm text-slate-500">Projeto: {activeProject.name}</p>
        </div>
        <Link href="/occurrences/new">
          <Button>Nova ocorrência</Button>
        </Link>
      </div>

      <Card bodyClassName="space-y-4">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <Field label="Busca" htmlFor="f-q">
            <Input
              id="f-q"
              type="search"
              placeholder="Código, título ou descrição"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                resetPage();
              }}
            />
          </Field>

          <Field label="Status" htmlFor="f-status">
            <Select
              id="f-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                resetPage();
              }}
            >
              <option value="">Todos</option>
              {OCCURRENCE_STATUSES.map((item: OccurrenceStatus) => (
                <option key={item} value={item}>
                  {OCCURRENCE_STATUS_LABELS[item]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Prioridade" htmlFor="f-priority">
            <Select
              id="f-priority"
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value);
                resetPage();
              }}
            >
              <option value="">Todas</option>
              {OCCURRENCE_PRIORITIES.map((item: OccurrencePriority) => (
                <option key={item} value={item}>
                  {OCCURRENCE_PRIORITY_LABELS[item]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Categoria" htmlFor="f-category">
            <Select
              id="f-category"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                resetPage();
              }}
            >
              <option value="">Todas</option>
              {OCCURRENCE_CATEGORIES.map((item: OccurrenceCategory) => (
                <option key={item} value={item}>
                  {OCCURRENCE_CATEGORY_LABELS[item]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Responsável" htmlFor="f-assignee">
            <Select
              id="f-assignee"
              value={assigneeUserId}
              onChange={(event) => {
                setAssigneeUserId(event.target.value);
                resetPage();
              }}
            >
              <option value="">Todos</option>
              {(membersQuery.data ?? []).map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.userName}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="De" htmlFor="f-from">
            <Input
              id="f-from"
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                resetPage();
              }}
            />
          </Field>

          <Field label="Até" htmlFor="f-to">
            <Input
              id="f-to"
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                resetPage();
              }}
            />
          </Field>

          <Field label="Ordenação" htmlFor="f-sort">
            <Select
              id="f-sort"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                resetPage();
              }}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {occurrencesQuery.isError ? (
          <ErrorState
            message={describeApiError(occurrencesQuery.error)}
            onRetry={() => {
              void occurrencesQuery.refetch();
            }}
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={result?.items ?? []}
              rowKey={(occurrence) => occurrence.id}
              loading={occurrencesQuery.isLoading}
              onRowClick={(occurrence) => router.push(`/occurrences/${occurrence.id}`)}
              empty={
                <EmptyState
                  title="Nenhuma ocorrência encontrada"
                  description="Ajuste os filtros ou registre uma nova ocorrência."
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
