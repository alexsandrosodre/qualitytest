'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import {
  OCCURRENCE_CATEGORIES,
  OCCURRENCE_PRIORITIES,
  OCCURRENCE_STATUSES,
  type Paginated,
} from '@qualitytest/shared';

import { Card, EmptyState, ErrorState, FullPageSpinner } from '@/components';
import { useActiveProject } from '@/lib/active-project';
import { apiGet, describeApiError } from '@/lib/api-client';
import {
  OCCURRENCE_CATEGORY_LABELS,
  OCCURRENCE_PRIORITY_LABELS,
  OCCURRENCE_STATUS_LABELS,
  cn,
} from '@/lib/format';
import type { OccurrenceSummaryView } from '@/lib/types';

async function fetchAllOccurrences(projectId: string): Promise<OccurrenceSummaryView[]> {
  const first = await apiGet<Paginated<OccurrenceSummaryView>>('/occurrences', {
    query: { projectId, page: 1, pageSize: 100 },
  });
  const items = [...first.items];

  for (let page = 2; page <= first.totalPages; page += 1) {
    const next = await apiGet<Paginated<OccurrenceSummaryView>>('/occurrences', {
      query: { projectId, page, pageSize: 100 },
    });
    items.push(...next.items);
  }

  return items;
}

interface CountBarProps {
  label: string;
  count: number;
  total: number;
  barClass: string;
}

function CountBar({ label, count, total, barClass }: CountBarProps) {
  const percentage = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-800">{count}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
        <div className={cn('h-2 rounded', barClass)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { activeProject, projects, isAdmin } = useActiveProject();
  const [aggregate, setAggregate] = useState(false);

  const scopeProjectIds = useMemo<string[]>(() => {
    if (isAdmin && aggregate) {
      return projects.map((project) => project.id);
    }
    return activeProject === null ? [] : [activeProject.id];
  }, [isAdmin, aggregate, projects, activeProject]);

  const scopeKey = scopeProjectIds.join(',');

  const occurrencesQuery = useQuery({
    queryKey: ['occurrences', 'stats', scopeKey],
    enabled: scopeProjectIds.length > 0,
    queryFn: async (): Promise<OccurrenceSummaryView[]> => {
      const groups = await Promise.all(scopeProjectIds.map((id) => fetchAllOccurrences(id)));
      return groups.flat();
    },
  });

  const occurrences = useMemo(
    () => occurrencesQuery.data ?? [],
    [occurrencesQuery.data],
  );

  const byStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const occurrence of occurrences) {
      map.set(occurrence.status, (map.get(occurrence.status) ?? 0) + 1);
    }
    return map;
  }, [occurrences]);

  const byPriority = useMemo(() => {
    const map = new Map<string, number>();
    for (const occurrence of occurrences) {
      map.set(occurrence.priority, (map.get(occurrence.priority) ?? 0) + 1);
    }
    return map;
  }, [occurrences]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const occurrence of occurrences) {
      map.set(occurrence.categoryId, (map.get(occurrence.categoryId) ?? 0) + 1);
    }
    return map;
  }, [occurrences]);

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <EmptyState
          title="Nenhum projeto disponível"
          description="Você ainda não possui vínculo com nenhum projeto. Solicite acesso a um administrador."
        />
      </div>
    );
  }

  const total = occurrences.length;
  const scopeLabel =
    isAdmin && aggregate
      ? 'Todos os projetos visíveis'
      : (activeProject?.name ?? 'Projeto ativo');

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Escopo: {scopeLabel}</p>
        </div>

        {isAdmin ? (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              checked={aggregate}
              onChange={(event) => setAggregate(event.target.checked)}
            />
            Agregar todos os projetos visíveis
          </label>
        ) : null}
      </div>

      {occurrencesQuery.isLoading ? (
        <FullPageSpinner label="Carregando indicadores..." />
      ) : occurrencesQuery.isError ? (
        <ErrorState
          message={describeApiError(occurrencesQuery.error)}
          onRetry={() => {
            void occurrencesQuery.refetch();
          }}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-sm text-slate-500">Total de ocorrências</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{total}</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500">Abertas</p>
              <p className="mt-1 text-3xl font-bold text-sky-700">{byStatus.get('ABERTO') ?? 0}</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500">Em desenvolvimento</p>
              <p className="mt-1 text-3xl font-bold text-amber-700">
                {byStatus.get('EM_DESENVOLVIMENTO') ?? 0}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500">Concluídas</p>
              <p className="mt-1 text-3xl font-bold text-emerald-700">
                {byStatus.get('CONCLUIDO') ?? 0}
              </p>
            </Card>
          </div>

          {total === 0 ? (
            <EmptyState
              title="Sem ocorrências no escopo selecionado"
              description="Nenhuma ocorrência foi registrada para os projetos selecionados."
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              <Card title="Por status">
                <div className="space-y-3">
                  {OCCURRENCE_STATUSES.map((status) => (
                    <CountBar
                      key={status}
                      label={OCCURRENCE_STATUS_LABELS[status]}
                      count={byStatus.get(status) ?? 0}
                      total={total}
                      barClass="bg-sky-500"
                    />
                  ))}
                </div>
              </Card>

              <Card title="Por prioridade">
                <div className="space-y-3">
                  {OCCURRENCE_PRIORITIES.map((priority) => (
                    <CountBar
                      key={priority}
                      label={OCCURRENCE_PRIORITY_LABELS[priority]}
                      count={byPriority.get(priority) ?? 0}
                      total={total}
                      barClass="bg-amber-500"
                    />
                  ))}
                </div>
              </Card>

              <Card title="Por categoria">
                <div className="space-y-3">
                  {OCCURRENCE_CATEGORIES.map((category) => (
                    <CountBar
                      key={category}
                      label={OCCURRENCE_CATEGORY_LABELS[category]}
                      count={byCategory.get(category) ?? 0}
                      total={total}
                      barClass="bg-violet-500"
                    />
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
