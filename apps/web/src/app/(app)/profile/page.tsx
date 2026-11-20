'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { GlobalRole } from '@qualitytest/shared';

import { Button, Card, Field, Input, RegistrationStatusBadge, useToast } from '@/components';
import { apiPatch, apiPost, describeApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { GLOBAL_ROLE_LABELS } from '@/lib/format';
import type { UserView } from '@/lib/types';

const profileSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório.').max(160),
  email: z.string().email('E-mail inválido.').max(200),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: z.string().min(8, 'A nova senha deve ter ao menos 8 caracteres.').max(128),
    confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { user, refreshToken, refreshMe } = useAuth();
  const toast = useToast();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const isAdmin = user?.globalRole === GlobalRole.ADMINISTRADOR;

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '' },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSaveProfile = profileForm.handleSubmit(async (values) => {
    if (user === null) {
      return;
    }
    setSavingProfile(true);
    try {
      await apiPatch<UserView>(`/users/${user.id}`, {
        name: values.name,
        ...(isAdmin ? { email: values.email } : {}),
      });
      await refreshMe();
      toast.success('Perfil atualizado.');
    } catch (error) {
      toast.error(describeApiError(error));
    } finally {
      setSavingProfile(false);
    }
  });

  const onChangePassword = passwordForm.handleSubmit(async (values) => {
    setSavingPassword(true);
    try {
      await apiPost('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        ...(refreshToken !== null ? { refreshToken } : {}),
      });
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Senha alterada com sucesso.');
    } catch (error) {
      toast.error(describeApiError(error));
    } finally {
      setSavingPassword(false);
    }
  });

  if (user === null) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Perfil</h1>
        <p className="text-sm text-slate-500">Gerencie seus dados e sua senha.</p>
      </div>

      <Card title="Dados do usuário" bodyClassName="space-y-4">
        <div className="flex items-center gap-3">
          <RegistrationStatusBadge status={user.status} />
          {user.globalRole !== null ? (
            <span className="text-sm text-slate-600">{GLOBAL_ROLE_LABELS[user.globalRole]}</span>
          ) : null}
        </div>

        <form onSubmit={onSaveProfile} className="space-y-4" noValidate>
          <Field label="Nome" htmlFor="u-name" required error={profileForm.formState.errors.name?.message}>
            <Input
              id="u-name"
              invalid={profileForm.formState.errors.name !== undefined}
              {...profileForm.register('name')}
            />
          </Field>

          <Field
            label="E-mail"
            htmlFor="u-email"
            required
            error={profileForm.formState.errors.email?.message}
            hint={isAdmin ? undefined : 'Somente administradores podem alterar o e-mail.'}
          >
            <Input
              id="u-email"
              type="email"
              disabled={!isAdmin}
              invalid={profileForm.formState.errors.email !== undefined}
              {...profileForm.register('email')}
            />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" loading={savingProfile}>
              Salvar perfil
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Alterar senha" bodyClassName="space-y-4">
        <form onSubmit={onChangePassword} className="space-y-4" noValidate>
          <Field
            label="Senha atual"
            htmlFor="u-current"
            required
            error={passwordForm.formState.errors.currentPassword?.message}
          >
            <Input
              id="u-current"
              type="password"
              autoComplete="current-password"
              invalid={passwordForm.formState.errors.currentPassword !== undefined}
              {...passwordForm.register('currentPassword')}
            />
          </Field>

          <Field
            label="Nova senha"
            htmlFor="u-new"
            required
            error={passwordForm.formState.errors.newPassword?.message}
          >
            <Input
              id="u-new"
              type="password"
              autoComplete="new-password"
              invalid={passwordForm.formState.errors.newPassword !== undefined}
              {...passwordForm.register('newPassword')}
            />
          </Field>

          <Field
            label="Confirmar nova senha"
            htmlFor="u-confirm"
            required
            error={passwordForm.formState.errors.confirmPassword?.message}
          >
            <Input
              id="u-confirm"
              type="password"
              autoComplete="new-password"
              invalid={passwordForm.formState.errors.confirmPassword !== undefined}
              {...passwordForm.register('confirmPassword')}
            />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" loading={savingPassword}>
              Alterar senha
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
