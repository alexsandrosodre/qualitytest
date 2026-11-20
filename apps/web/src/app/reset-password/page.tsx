'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button, Field, Input, Spinner } from '@/components';
import { apiPost, describeApiError } from '@/lib/api-client';

const schema = z
  .object({
    newPassword: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.').max(128),
    confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (token === null || token === '') {
      setFormError('Token de redefinição ausente na URL.');
      return;
    }
    setFormError(null);
    try {
      await apiPost(
        '/auth/reset-password',
        { token, newPassword: values.newPassword },
        { authenticated: false },
      );
      setSuccess(true);
    } catch (error) {
      setFormError(describeApiError(error));
    }
  });

  if (token === null || token === '') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Token de redefinição ausente na URL. Solicite um novo link em{' '}
        <Link href="/forgot-password" className="font-medium underline">
          esqueci minha senha
        </Link>
        .
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-800">
        Senha redefinida com sucesso.{' '}
        <Link href="/login" className="font-medium underline">
          Ir para o login
        </Link>
        .
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Nova senha" htmlFor="newPassword" required error={errors.newPassword?.message}>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          invalid={errors.newPassword !== undefined}
          {...register('newPassword')}
        />
      </Field>

      <Field
        label="Confirmar nova senha"
        htmlFor="confirmPassword"
        required
        error={errors.confirmPassword?.message}
      >
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          invalid={errors.confirmPassword !== undefined}
          {...register('confirmPassword')}
        />
      </Field>

      {formError !== null ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {formError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" loading={isSubmitting}>
        Redefinir senha
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-center text-2xl font-bold tracking-tight text-slate-900">
          Definir nova senha
        </h1>
        <p className="mb-6 text-center text-sm text-slate-500">
          O link de redefinição é de uso único.
        </p>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <Suspense fallback={<Spinner label="Carregando..." />}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
