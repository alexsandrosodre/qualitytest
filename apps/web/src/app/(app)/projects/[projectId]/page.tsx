'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  ENVIRONMENT_TYPES,
  EnvironmentType,
  GlobalRole,
  PROJECT_ROLES,
  ProjectRole,
  RegistrationStatus,
  projectCodeSchema,
} from '@qualitytest/shared';
import type { Paginated } from '@qualitytest/shared';

import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  EnvironmentTypeBadge,
  ErrorState,
  Field,
  FullPageSpinner,
  Input,
  Modal,
  RegistrationStatusBadge,
  RoleBadge,
  Select,
  Textarea,
  useToast,
  type Column,
} from '@/components';
import { useActiveProject } from '@/lib/active-project';
import { apiDelete, apiGet, apiPatch, apiPost, describeApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import {
  ENVIRONMENT_TYPE_LABELS,
  PROJECT_ROLE_LABELS,
  REGISTRATION_STATUS_LABELS,
  formatDateTime,
} from '@/lib/format';
import type {
  ProjectDomainMappingView,
  ProjectEnvironmentView,
  ProjectMemberListItem,
  ProjectView,
  UserView,
} from '@/lib/types';

type Tab = 'dados' | 'membros' | 'ambientes' | 'dominios';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'dados', label: 'Dados' },
  { id: 'membros', label: 'Membros' },
  { id: 'ambientes', label: 'Ambientes' },
  { id: 'dominios', label: 'Domínios' },
];

/* ------------------------------- Dados ---------------------------------- */

const projectSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório.').max(160),
  code: projectCodeSchema,
  description: z.string().max(2000).optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

function ProjectDataForm({
  project,
  canManage,
  onSaved,
}: {
  project: ProjectView;
  canManage: boolean;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: project.name,
      code: project.code,
      description: project.description ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setBusy(true);
    try {
      await apiPatch<ProjectView>(`/projects/${project.id}`, {
        name: values.name,
        code: values.code,
        description:
          values.description !== undefined && values.description.trim() !== ''
            ? values.description.trim()
            : undefined,
      });
      toast.success('Projeto atualizado.');
      onSaved();
    } catch (error) {
      toast.error(describeApiError(error));
    } finally {
      setBusy(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Nome" htmlFor="p-name" required error={errors.name?.message}>
        <Input
          id="p-name"
          invalid={errors.name !== undefined}
          disabled={!canManage}
          {...register('name')}
        />
      </Field>
      <Field label="Código" htmlFor="p-code" required error={errors.code?.message}>
        <Input
          id="p-code"
          invalid={errors.code !== undefined}
          disabled={!canManage}
          {...register('code')}
        />
      </Field>
      <Field label="Descrição" htmlFor="p-description" error={errors.description?.message}>
        <Textarea
          id="p-description"
          invalid={errors.description !== undefined}
          disabled={!canManage}
          {...register('description')}
        />
      </Field>
      {canManage ? (
        <div className="flex justify-end">
          <Button type="submit" loading={busy}>
            Salvar alterações
          </Button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Somente gestores ou administradores podem editar.</p>
      )}
    </form>
  );
}

/* ------------------------------ Membros --------------------------------- */

const memberSchema = z.object({
  userId: z.string().min(1, 'Informe o usuário.'),
  role: z.nativeEnum(ProjectRole),
});

type MemberFormValues = z.infer<typeof memberSchema>;

function AddMemberForm({
  projectId,
  isAdmin,
  users,
  onAdded,
}: {
  projectId: string;
  isAdmin: boolean;
  users: UserView[];
  onAdded: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: { userId: '', role: ProjectRole.TESTADOR },
  });

  const onSubmit = handleSubmit(async (values) => {
    setBusy(true);
    try {
      await apiPost(`/projects/${projectId}/members`, {
        userId: values.userId,
        role: values.role,
      });
      toast.success('Membro adicionado.');
      reset({ userId: '', role: ProjectRole.TESTADOR });
      onAdded();
    } catch (error) {
      toast.error(describeApiError(error));
    } finally {
      setBusy(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3" noValidate>
      <Field
        label="Usuário"
        htmlFor="m-user"
        required
        error={errors.userId?.message}
        className="min-w-[220px] flex-1"
      >
        {isAdmin ? (
          <Select id="m-user" invalid={errors.userId !== undefined} {...register('userId')}>
            <option value="">Selecione um usuário...</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </Select>
        ) : (
          <Input
            id="m-user"
            placeholder="Identificador (UUID) do usuário"
            invalid={errors.userId !== undefined}
            {...register('userId')}
          />
        )}
      </Field>

      <Field label="Papel" htmlFor="m-role" required error={errors.role?.message} className="w-48">
        <Select id="m-role" {...register('role')}>
          {PROJECT_ROLES.map((role) => (
            <option key={role} value={role}>
              {PROJECT_ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
      </Field>

      <Button type="submit" loading={busy}>
        Adicionar
      </Button>
    </form>
  );
}

/* ---------------------------- Ambientes --------------------------------- */

const environmentSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório.').max(120),
  baseUrl: z.string().url('URL inválida (inclua o protocolo).').max(2048),
  type: z.nativeEnum(EnvironmentType),
  status: z.nativeEnum(RegistrationStatus),
});

type EnvironmentFormValues = z.infer<typeof environmentSchema>;

function EnvironmentModal({
  projectId,
  editing,
  open,
  onClose,
  onSaved,
}: {
  projectId: string;
  editing: ProjectEnvironmentView | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EnvironmentFormValues>({
    resolver: zodResolver(environmentSchema),
    values: {
      name: editing?.name ?? '',
      baseUrl: editing?.baseUrl ?? '',
      type: editing?.type ?? EnvironmentType.TESTING,
      status: editing?.status ?? RegistrationStatus.ATIVO,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setBusy(true);
    try {
      if (editing === null) {
        await apiPost(`/projects/${projectId}/environments`, values);
        toast.success('Ambiente criado.');
      } else {
        await apiPatch(`/projects/${projectId}/environments/${editing.id}`, values);
        toast.success('Ambiente atualizado.');
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(describeApiError(error));
    } finally {
      setBusy(false);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing === null ? 'Novo ambiente' : 'Editar ambiente'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void onSubmit()} loading={busy}>
            Salvar
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Nome" htmlFor="e-name" required error={errors.name?.message}>
          <Input id="e-name" invalid={errors.name !== undefined} {...register('name')} />
        </Field>
        <Field label="URL base" htmlFor="e-url" required error={errors.baseUrl?.message}>
          <Input
            id="e-url"
            placeholder="https://homolog.exemplo.com"
            invalid={errors.baseUrl !== undefined}
            {...register('baseUrl')}
          />
        </Field>
        <Field label="Tipo" htmlFor="e-type" required error={errors.type?.message}>
          <Select id="e-type" {...register('type')}>
            {ENVIRONMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {ENVIRONMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="e-status" required error={errors.status?.message}>
          <Select id="e-status" {...register('status')}>
            {Object.values(RegistrationStatus).map((status) => (
              <option key={status} value={status}>
                {REGISTRATION_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

/* ----------------------------- Domínios --------------------------------- */

const domainSchema = z.object({
  domainPattern: z.string().min(1, 'Informe o domínio.').max(300),
  environmentId: z.string().min(1, 'Selecione o ambiente.'),
  enabled: z.boolean(),
});

type DomainFormValues = z.infer<typeof domainSchema>;

function DomainModal({
  projectId,
  editing,
  environments,
  open,
  onClose,
  onSaved,
}: {
  projectId: string;
  editing: ProjectDomainMappingView | null;
  environments: ProjectEnvironmentView[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DomainFormValues>({
    resolver: zodResolver(domainSchema),
    values: {
      domainPattern: editing?.domainPattern ?? '',
      environmentId: editing?.environmentId ?? environments[0]?.id ?? '',
      enabled: editing?.enabled ?? true,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setBusy(true);
    try {
      if (editing === null) {
        await apiPost(`/projects/${projectId}/domains`, values);
        toast.success('Domínio criado.');
      } else {
        await apiPatch(`/projects/${projectId}/domains/${editing.id}`, values);
        toast.success('Domínio atualizado.');
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(describeApiError(error));
    } finally {
      setBusy(false);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing === null ? 'Novo domínio' : 'Editar domínio'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void onSubmit()} loading={busy}>
            Salvar
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Domínio / padrão" htmlFor="d-pattern" required error={errors.domainPattern?.message}>
          <Input
            id="d-pattern"
            placeholder="homolog.exemplo.com"
            invalid={errors.domainPattern !== undefined}
            {...register('domainPattern')}
          />
        </Field>
        <Field label="Ambiente" htmlFor="d-env" required error={errors.environmentId?.message}>
          <Select id="d-env" {...register('environmentId')}>
            <option value="">Selecione...</option>
            {environments.map((environment) => (
              <option key={environment.id} value={environment.id}>
                {environment.name}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            {...register('enabled')}
          />
          Habilitado
        </label>
      </form>
    </Modal>
  );
}

/* ------------------------------- Página --------------------------------- */

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();
  const toast = useToast();
  const { user, memberships } = useAuth();
  const { setActiveProject } = useActiveProject();
  const [tab, setTab] = useState<Tab>('dados');
  const [busy, setBusy] = useState(false);

  const [envModalOpen, setEnvModalOpen] = useState(false);
  const [envEditing, setEnvEditing] = useState<ProjectEnvironmentView | null>(null);
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [domainEditing, setDomainEditing] = useState<ProjectDomainMappingView | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; action: () => Promise<void> } | null>(
    null,
  );

  const isAdmin = user?.globalRole === GlobalRole.ADMINISTRADOR;
  const membershipRole = useMemo<ProjectRole | null>(
    () => memberships.find((membership) => membership.projectId === projectId)?.role ?? null,
    [memberships, projectId],
  );
  const canManage = isAdmin || membershipRole === ProjectRole.GESTOR;

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => apiGet<ProjectView>(`/projects/${projectId}`),
  });

  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => apiGet<ProjectMemberListItem[]>(`/projects/${projectId}/members`),
  });

  const environmentsQuery = useQuery({
    queryKey: ['project-environments', projectId],
    queryFn: () => apiGet<ProjectEnvironmentView[]>(`/projects/${projectId}/environments`),
  });

  const domainsQuery = useQuery({
    queryKey: ['project-domains', projectId],
    queryFn: () => apiGet<ProjectDomainMappingView[]>(`/projects/${projectId}/domains`),
  });

  const usersQuery = useQuery({
    queryKey: ['users', 'all'],
    enabled: isAdmin,
    queryFn: () => apiGet<Paginated<UserView>>('/users', { query: { page: 1, pageSize: 100 } }),
  });

  const refetchProject = projectQuery.refetch;
  const refetchMembers = membersQuery.refetch;
  const refetchEnvironments = environmentsQuery.refetch;
  const refetchDomains = domainsQuery.refetch;

  const refetchAll = useCallback(async (): Promise<void> => {
    await Promise.all([
      refetchProject(),
      refetchMembers(),
      refetchEnvironments(),
      refetchDomains(),
    ]);
  }, [refetchProject, refetchMembers, refetchEnvironments, refetchDomains]);

  const runAction = useCallback(
    async (action: () => Promise<void>, successMessage: string): Promise<void> => {
      setBusy(true);
      try {
        await action();
        toast.success(successMessage);
        await refetchAll();
      } catch (error) {
        toast.error(describeApiError(error));
      } finally {
        setBusy(false);
      }
    },
    [refetchAll, toast],
  );

  const memberColumns: Column<ProjectMemberListItem>[] = [
    {
      key: 'user',
      header: 'Usuário',
      render: (member) => (
        <div>
          <p className="font-medium text-slate-900">{member.userName}</p>
          <p className="text-xs text-slate-500">{member.userEmail}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Papel',
      render: (member) =>
        canManage ? (
          <Select
            aria-label={`Papel de ${member.userName}`}
            value={member.role}
            disabled={busy}
            onChange={(event) =>
              void runAction(
                () =>
                  apiPatch(`/projects/${projectId}/members/${member.userId}`, {
                    role: event.target.value,
                  }),
                'Papel atualizado.',
              )
            }
          >
            {PROJECT_ROLES.map((role) => (
              <option key={role} value={role}>
                {PROJECT_ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        ) : (
          <RoleBadge role={member.role} />
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (member) => <RegistrationStatusBadge status={member.status} />,
    },
    {
      key: 'actions',
      header: '',
      render: (member) =>
        canManage ? (
          <Button
            variant="danger"
            size="sm"
            disabled={busy}
            onClick={() =>
              setConfirm({
                message: `Desativar o vínculo de ${member.userName} neste projeto?`,
                action: () =>
                  apiDelete(`/projects/${projectId}/members/${member.userId}`).then(() => undefined),
              })
            }
          >
            Desativar
          </Button>
        ) : null,
    },
  ];

  const environmentColumns: Column<ProjectEnvironmentView>[] = [
    {
      key: 'name',
      header: 'Nome',
      render: (environment) => <span className="font-medium text-slate-900">{environment.name}</span>,
    },
    {
      key: 'baseUrl',
      header: 'URL base',
      render: (environment) => (
        <span className="font-mono text-xs text-slate-600">{environment.baseUrl}</span>
      ),
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (environment) => <EnvironmentTypeBadge type={environment.type} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (environment) => <RegistrationStatusBadge status={environment.status} />,
    },
    {
      key: 'actions',
      header: '',
      render: (environment) =>
        canManage ? (
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => {
                setEnvEditing(environment);
                setEnvModalOpen(true);
              }}
            >
              Editar
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() =>
                setConfirm({
                  message: `Desativar o ambiente "${environment.name}"?`,
                  action: () =>
                    apiDelete(`/projects/${projectId}/environments/${environment.id}`).then(
                      () => undefined,
                    ),
                })
              }
            >
              Desativar
            </Button>
          </div>
        ) : null,
    },
  ];

  const domainColumns: Column<ProjectDomainMappingView>[] = [
    {
      key: 'pattern',
      header: 'Domínio',
      render: (domain) => <span className="font-mono text-xs text-slate-700">{domain.domainPattern}</span>,
    },
    {
      key: 'environment',
      header: 'Ambiente',
      render: (domain) =>
        environmentsQuery.data?.find((environment) => environment.id === domain.environmentId)
          ?.name ?? domain.environmentId,
    },
    {
      key: 'enabled',
      header: 'Habilitado',
      render: (domain) => (
        <RegistrationStatusBadge
          status={domain.enabled ? RegistrationStatus.ATIVO : RegistrationStatus.INATIVO}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (domain) =>
        canManage ? (
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => {
                setDomainEditing(domain);
                setDomainModalOpen(true);
              }}
            >
              Editar
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() =>
                setConfirm({
                  message: `Remover o domínio "${domain.domainPattern}"?`,
                  action: () =>
                    apiDelete(`/projects/${projectId}/domains/${domain.id}`).then(() => undefined),
                })
              }
            >
              Remover
            </Button>
          </div>
        ) : null,
    },
  ];

  if (projectQuery.isLoading) {
    return <FullPageSpinner label="Carregando projeto..." />;
  }

  if (projectQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState
          message={describeApiError(projectQuery.error)}
          onRetry={() => {
            void projectQuery.refetch();
          }}
        />
      </div>
    );
  }

  const project = projectQuery.data;
  if (project === undefined) {
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            className="text-sm text-sky-600 hover:underline"
            onClick={() => router.push('/projects')}
          >
            ← Voltar para projetos
          </button>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{project.name}</h1>
          <p className="font-mono text-xs text-slate-500">{project.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <RegistrationStatusBadge status={project.status} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setActiveProject(project.id);
              toast.success('Projeto ativo definido.');
            }}
          >
            Definir como ativo
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-current={tab === item.id ? 'page' : undefined}
            className={
              tab === item.id
                ? 'border-b-2 border-sky-600 px-3 py-2 text-sm font-medium text-sky-700'
                : 'border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800'
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'dados' ? (
        <Card
          title="Dados do projeto"
          description={
            canManage
              ? 'Edite as informações do projeto.'
              : 'Visualização somente leitura.'
          }
        >
          <ProjectDataForm
            project={project}
            canManage={canManage}
            onSaved={() => {
              void projectQuery.refetch();
            }}
          />
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm">
            <div>
              <dt className="text-slate-500">Criado em</dt>
              <dd className="text-slate-800">{formatDateTime(project.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Atualizado em</dt>
              <dd className="text-slate-800">{formatDateTime(project.updatedAt)}</dd>
            </div>
          </dl>
        </Card>
      ) : null}

      {tab === 'membros' ? (
        <Card title="Membros" description="Vínculos de usuários neste projeto." bodyClassName="space-y-4">
          {canManage ? (
            <AddMemberForm
              projectId={projectId}
              isAdmin={isAdmin}
              users={usersQuery.data?.items ?? []}
              onAdded={() => {
                void membersQuery.refetch();
              }}
            />
          ) : null}

          {membersQuery.isError ? (
            <ErrorState
              message={describeApiError(membersQuery.error)}
              onRetry={() => {
                void membersQuery.refetch();
              }}
            />
          ) : (
            <DataTable
              columns={memberColumns}
              rows={membersQuery.data ?? []}
              rowKey={(member) => member.id}
              loading={membersQuery.isLoading}
              empty={<EmptyState title="Nenhum membro cadastrado" />}
            />
          )}
        </Card>
      ) : null}

      {tab === 'ambientes' ? (
        <Card
          title="Ambientes"
          description="Ambientes de teste vinculados ao projeto."
          bodyClassName="space-y-4"
          actions={
            canManage ? (
              <Button
                size="sm"
                onClick={() => {
                  setEnvEditing(null);
                  setEnvModalOpen(true);
                }}
              >
                Novo ambiente
              </Button>
            ) : undefined
          }
        >
          {environmentsQuery.isError ? (
            <ErrorState
              message={describeApiError(environmentsQuery.error)}
              onRetry={() => {
                void environmentsQuery.refetch();
              }}
            />
          ) : (
            <DataTable
              columns={environmentColumns}
              rows={environmentsQuery.data ?? []}
              rowKey={(environment) => environment.id}
              loading={environmentsQuery.isLoading}
              empty={<EmptyState title="Nenhum ambiente cadastrado" />}
            />
          )}
        </Card>
      ) : null}

      {tab === 'dominios' ? (
        <Card
          title="Domínios"
          description="Mapeamento de domínios para os ambientes do projeto."
          bodyClassName="space-y-4"
          actions={
            canManage ? (
              <Button
                size="sm"
                onClick={() => {
                  setDomainEditing(null);
                  setDomainModalOpen(true);
                }}
              >
                Novo domínio
              </Button>
            ) : undefined
          }
        >
          {domainsQuery.isError ? (
            <ErrorState
              message={describeApiError(domainsQuery.error)}
              onRetry={() => {
                void domainsQuery.refetch();
              }}
            />
          ) : (
            <DataTable
              columns={domainColumns}
              rows={domainsQuery.data ?? []}
              rowKey={(domain) => domain.id}
              loading={domainsQuery.isLoading}
              empty={<EmptyState title="Nenhum domínio cadastrado" />}
            />
          )}
        </Card>
      ) : null}

      <EnvironmentModal
        projectId={projectId}
        editing={envEditing}
        open={envModalOpen}
        onClose={() => setEnvModalOpen(false)}
        onSaved={() => {
          void environmentsQuery.refetch();
        }}
      />

      <DomainModal
        projectId={projectId}
        editing={domainEditing}
        environments={environmentsQuery.data ?? []}
        open={domainModalOpen}
        onClose={() => setDomainModalOpen(false)}
        onSaved={() => {
          void domainsQuery.refetch();
        }}
      />

      <ConfirmDialog
        open={confirm !== null}
        title="Confirmar ação"
        description={confirm?.message ?? ''}
        confirmLabel="Confirmar"
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const current = confirm;
          setConfirm(null);
          if (current !== null) {
            void runAction(current.action, 'Ação concluída.');
          }
        }}
      />
    </div>
  );
}
