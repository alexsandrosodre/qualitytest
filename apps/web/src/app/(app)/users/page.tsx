'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  GlobalRole,
  RegistrationStatus,
  type Paginated,
} from '@qualitytest/shared';

import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Pagination,
  RegistrationStatusBadge,
  Select,
  useToast,
  type Column,
} from '@/components';
import { apiGet, apiPatch, apiPost, describeApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { GLOBAL_ROLE_LABELS, REGISTRATION_STATUS_LABELS, formatDateTime } from '@/lib/format';
import type { UserView } from '@/lib/types';

const PAGE_SIZE = 20;

const createSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório.').max(160),
  email: z.string().email('E-mail inválido.').max(200),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.').max(128),
  globalRole: z.nativeEnum(GlobalRole).or(z.literal('')),
  status: z.nativeEnum(RegistrationStatus),
});

type CreateFormValues = z.infer<typeof createSchema>;

function CreateUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      globalRole: '',
      status: RegistrationStatus.ATIVO,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setBusy(true);
    try {
      await apiPost<UserView>('/users', {
        name: values.name,
        email: values.email,
        password: values.password,
        globalRole: values.globalRole === '' ? undefined : values.globalRole,
        status: values.status,
      });
      toast.success('Usuário criado.');
      reset();
      onCreated();
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
      title="Novo usuário"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void onSubmit()} loading={busy}>
            Criar usuário
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Nome" htmlFor="cu-name" required error={errors.name?.message}>
          <Input id="cu-name" invalid={errors.name !== undefined} {...register('name')} />
        </Field>
        <Field label="E-mail" htmlFor="cu-email" required error={errors.email?.message}>
          <Input id="cu-email" type="email" invalid={errors.email !== undefined} {...register('email')} />
        </Field>
        <Field
          label="Senha inicial"
          htmlFor="cu-password"
          required
          error={errors.password?.message}
          hint="Mínimo de 8 caracteres."
        >
          <Input
            id="cu-password"
            type="password"
            autoComplete="new-password"
            invalid={errors.password !== undefined}
            {...register('password')}
          />
        </Field>
        <Field label="Perfil global" htmlFor="cu-role" error={errors.globalRole?.message}>
          <Select id="cu-role" {...register('globalRole')}>
            <option value="">Sem perfil global</option>
            {Object.values(GlobalRole).map((role) => (
              <option key={role} value={role}>
                {GLOBAL_ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="cu-status" required error={errors.status?.message}>
          <Select id="cu-status" {...register('status')}>
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

export default function UsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const isAdmin = user?.globalRole === GlobalRole.ADMINISTRADOR;
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user !== null && !isAdmin) {
      toast.error('Acesso restrito a administradores.');
      router.replace('/dashboard');
    }
  }, [user, isAdmin, router, toast]);

  const usersQuery = useQuery({
    queryKey: ['users', 'list', page],
    enabled: isAdmin,
    queryFn: () => apiGet<Paginated<UserView>>('/users', { query: { page, pageSize: PAGE_SIZE } }),
  });

  const toggleStatus = async (target: UserView): Promise<void> => {
    setBusy(true);
    try {
      const nextStatus =
        target.status === RegistrationStatus.ATIVO
          ? RegistrationStatus.INATIVO
          : RegistrationStatus.ATIVO;
      await apiPatch(`/users/${target.id}/status`, { status: nextStatus });
      toast.success('Status atualizado.');
      await usersQuery.refetch();
    } catch (error) {
      toast.error(describeApiError(error));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<UserView>[] = [
    {
      key: 'name',
      header: 'Nome',
      render: (item) => <span className="font-medium text-slate-900">{item.name}</span>,
    },
    { key: 'email', header: 'E-mail', render: (item) => <span className="text-slate-600">{item.email}</span> },
    {
      key: 'role',
      header: 'Perfil global',
      render: (item) =>
        item.globalRole !== null ? GLOBAL_ROLE_LABELS[item.globalRole] : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <RegistrationStatusBadge status={item.status} />,
    },
    {
      key: 'lastLoginAt',
      header: 'Último acesso',
      render: (item) => (
        <span className="text-slate-500">{formatDateTime(item.lastLoginAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item) => (
        <div className="flex justify-end">
          <Button
            variant={item.status === RegistrationStatus.ATIVO ? 'danger' : 'secondary'}
            size="sm"
            disabled={busy || item.id === user?.id}
            onClick={() => {
              void toggleStatus(item);
            }}
          >
            {item.status === RegistrationStatus.ATIVO ? 'Desativar' : 'Ativar'}
          </Button>
        </div>
      ),
    },
  ];

  if (!isAdmin) {
    return null;
  }

  const result = usersQuery.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Usuários</h1>
          <p className="text-sm text-slate-500">Gestão de usuários da plataforma.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>Novo usuário</Button>
      </div>

      <Card bodyClassName="space-y-4">
        {usersQuery.isError ? (
          <ErrorState
            message={describeApiError(usersQuery.error)}
            onRetry={() => {
              void usersQuery.refetch();
            }}
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={result?.items ?? []}
              rowKey={(item) => item.id}
              loading={usersQuery.isLoading}
              empty={<EmptyState title="Nenhum usuário cadastrado" />}
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

      <CreateUserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          void usersQuery.refetch();
        }}
      />
    </div>
  );
}
