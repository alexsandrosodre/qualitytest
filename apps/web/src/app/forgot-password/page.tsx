'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button, Field, Input } from '@/components';
import { apiPost, describeApiError } from '@/lib/api-client';

const schema = z.object({
  email: z.string().email('E-mail inválido.'),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setMessage(null);
    try {
      const response = await apiPost<{ message: string }>(
        '/auth/forgot-password',
        { email: values.email },
        { authenticated: false },
      );
      setMessage(response.message);
    } catch (error) {
      setFormError(describeApiError(error));
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-center text-2xl font-bold tracking-tight text-slate-900">
          Redefinir senha
        </h1>
        <p className="mb-6 text-center text-sm text-slate-500">
          Informe seu e-mail para receber as instruções de redefinição.
        </p>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="E-mail" htmlFor="email" required error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="usuario@exemplo.com"
                invalid={errors.email !== undefined}
                {...register('email')}
              />
            </Field>

            {message !== null ? (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
                {message}
              </p>
            ) : null}

            {formError !== null ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                {formError}
              </p>
            ) : null}

            <Button type="submit" className="w-full" loading={isSubmitting}>
              Solicitar redefinição
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/login" className="text-sm text-sky-600 hover:underline">
              Voltar ao login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
