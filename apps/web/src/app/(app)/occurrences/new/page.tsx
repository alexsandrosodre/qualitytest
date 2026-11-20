'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { OCCURRENCE_CATEGORIES, OCCURRENCE_PRIORITIES, OccurrenceCategory, OccurrencePriority } from '@qualitytest/shared';

import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
  useToast,
} from '@/components';
import { useActiveProject } from '@/lib/active-project';
import { apiGet, apiPost, describeApiError } from '@/lib/api-client';
import { OCCURRENCE_CATEGORY_LABELS, OCCURRENCE_PRIORITY_LABELS } from '@/lib/format';
import type { OccurrenceDetailView, ProjectEnvironmentView } from '@/lib/types';

const schema = z.object({
  environmentId: z.string().optional(),
  title: z.string().min(1, 'Título obrigatório.').max(200, 'Máximo de 200 caracteres.'),
  description: z.string().max(20000, 'Máximo de 20000 caracteres.').optional(),
  categoryId: z.nativeEnum(OccurrenceCategory),
  priority: z.nativeEnum(OccurrencePriority),
  pageUrl: z.string().url('URL inválida.').or(z.literal('')).optional(),
  pageTitle: z.string().max(300).optional(),
  browserInfo: z.string().max(300).optional(),
  operatingSystemInfo: z.string().max(300).optional(),
  viewportInfo: z.string().max(120).optional(),
});

type FormValues = z.infer<typeof schema>;

function optionalText(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  return value.trim();
}

export default function NewOccurrencePage() {
  const { activeProject } = useActiveProject();
  const router = useRouter();
  const toast = useToast();
  const projectId = activeProject?.id ?? null;

  const environmentsQuery = useQuery({
    queryKey: ['project-environments', projectId],
    enabled: projectId !== null,
    queryFn: () => apiGet<ProjectEnvironmentView[]>(`/projects/${projectId}/environments`),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      environmentId: '',
      title: '',
      description: '',
      categoryId: OccurrenceCategory.ERRO_FUNCIONAL,
      priority: OccurrencePriority.MEDIA,
      pageUrl: '',
      pageTitle: '',
      browserInfo: '',
      operatingSystemInfo: '',
      viewportInfo: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (projectId === null) {
      return;
    }

    const idempotencyKey =
      typeof window !== 'undefined' && typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    try {
      const occurrence = await apiPost<OccurrenceDetailView>(
        '/occurrences',
        {
          projectId,
          environmentId: optionalText(values.environmentId),
          title: values.title.trim(),
          description: optionalText(values.description),
          categoryId: values.categoryId,
          priority: values.priority,
          pageUrl: optionalText(values.pageUrl),
          pageTitle: optionalText(values.pageTitle),
          browserInfo: optionalText(values.browserInfo),
          operatingSystemInfo: optionalText(values.operatingSystemInfo),
          viewportInfo: optionalText(values.viewportInfo),
        },
        { idempotencyKey },
      );
      toast.success(`Ocorrência ${occurrence.publicCode} registrada.`);
      router.push(`/occurrences/${occurrence.id}`);
    } catch (error) {
      toast.error(describeApiError(error));
    }
  });

  if (activeProject === null) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="Nenhum projeto ativo"
          description="Selecione um projeto para registrar uma nova ocorrência."
        />
      </div>
    );
  }

  const environments = (environmentsQuery.data ?? []).filter(
    (environment) => environment.status === 'ATIVO',
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Nova ocorrência</h1>
        <p className="text-sm text-slate-500">Projeto: {activeProject.name}</p>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Título" htmlFor="o-title" required error={errors.title?.message}>
            <Input id="o-title" invalid={errors.title !== undefined} {...register('title')} />
          </Field>

          <Field label="Descrição" htmlFor="o-description" error={errors.description?.message}>
            <Textarea
              id="o-description"
              rows={5}
              invalid={errors.description !== undefined}
              {...register('description')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria" htmlFor="o-category" required error={errors.categoryId?.message}>
              <Select id="o-category" {...register('categoryId')}>
                {OCCURRENCE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {OCCURRENCE_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Prioridade" htmlFor="o-priority" required error={errors.priority?.message}>
              <Select id="o-priority" {...register('priority')}>
                {OCCURRENCE_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {OCCURRENCE_PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Ambiente (opcional)" htmlFor="o-environment" error={errors.environmentId?.message}>
            <Select id="o-environment" {...register('environmentId')}>
              <option value="">Não informado</option>
              {environments.map((environment) => (
                <option key={environment.id} value={environment.id}>
                  {environment.name}
                </option>
              ))}
            </Select>
          </Field>

          <details className="rounded-md border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Informações de contexto (opcional)
            </summary>
            <div className="mt-3 space-y-4">
              <Field label="URL da página" htmlFor="o-pageUrl" error={errors.pageUrl?.message}>
                <Input
                  id="o-pageUrl"
                  placeholder="https://app.exemplo.com/rota"
                  invalid={errors.pageUrl !== undefined}
                  {...register('pageUrl')}
                />
              </Field>
              <Field label="Título da página" htmlFor="o-pageTitle" error={errors.pageTitle?.message}>
                <Input id="o-pageTitle" invalid={errors.pageTitle !== undefined} {...register('pageTitle')} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Navegador" htmlFor="o-browser" error={errors.browserInfo?.message}>
                  <Input id="o-browser" invalid={errors.browserInfo !== undefined} {...register('browserInfo')} />
                </Field>
                <Field label="Sistema operacional" htmlFor="o-os" error={errors.operatingSystemInfo?.message}>
                  <Input
                    id="o-os"
                    invalid={errors.operatingSystemInfo !== undefined}
                    {...register('operatingSystemInfo')}
                  />
                </Field>
              </div>
              <Field label="Viewport" htmlFor="o-viewport" error={errors.viewportInfo?.message}>
                <Input id="o-viewport" invalid={errors.viewportInfo !== undefined} {...register('viewportInfo')} />
              </Field>
            </div>
          </details>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Registrar ocorrência
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
