'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  GlobalRole,
  RegistrationStatus,
  projectCodeSchema,
} from '@qualitytest/shared';

import { Button, Card, Field, Input, Select, Textarea, useToast } from '@/components';
import { useActiveProject } from '@/lib/active-project';
import { apiPost, describeApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { REGISTRATION_STATUS_LABELS } from '@/lib/format';
import type { ProjectView } from '@/lib/types';

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório.').max(160, 'Máximo de 160 caracteres.'),
  code: projectCodeSchema,
  description: z.string().max(2000, 'Máximo de 2000 caracteres.').optional(),
  status: z.nativeEnum(RegistrationStatus),
});

type FormValues = z.infer<typeof schema>;

export default function NewProjectPage() {
  const { user } = useAuth();
  const { setActiveProject } = useActiveProject();
  const router = useRouter();
  const toast = useToast();
  const isAdmin = user?.globalRole === GlobalRole.ADMINISTRADOR;

  useEffect(() => {
    if (user !== null && !isAdmin) {
      toast.error('Apenas administradores podem criar projetos.');
      router.replace('/dashboard');
    }
  }, [user, isAdmin, router, toast]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', code: '', description: '', status: RegistrationStatus.ATIVO },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const project = await apiPost<ProjectView>('/projects', {
        name: values.name,
        code: values.code,
        description:
          values.description !== undefined && values.description.trim() !== ''
            ? values.description.trim()
            : undefined,
        status: values.status,
      });
      toast.success(`Projeto ${project.code} criado com sucesso.`);
      setActiveProject(project.id);
      router.push(`/projects/${project.id}`);
    } catch (error) {
      toast.error(describeApiError(error));
    }
  });

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Novo projeto</h1>
        <p className="text-sm text-slate-500">Cadastre um novo projeto na plataforma.</p>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Nome" htmlFor="name" required error={errors.name?.message}>
            <Input id="name" invalid={errors.name !== undefined} {...register('name')} />
          </Field>

          <Field
            label="Código"
            htmlFor="code"
            required
            error={errors.code?.message}
            hint="Somente letras maiúsculas, números e hífen (ex.: INTRANET-MARICA)."
          >
            <Input id="code" invalid={errors.code !== undefined} {...register('code')} />
          </Field>

          <Field label="Descrição" htmlFor="description" error={errors.description?.message}>
            <Textarea
              id="description"
              invalid={errors.description !== undefined}
              {...register('description')}
            />
          </Field>

          <Field label="Status" htmlFor="status" required error={errors.status?.message}>
            <Select id="status" {...register('status')}>
              {Object.values(RegistrationStatus).map((status) => (
                <option key={status} value={status}>
                  {REGISTRATION_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Criar projeto
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
