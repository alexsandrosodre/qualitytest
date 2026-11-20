'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/format';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
        {required === true ? <span className="ml-0.5 text-rose-600">*</span> : null}
      </label>
      {children}
      {error !== undefined && error !== '' ? (
        <p className="text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
      {error === undefined && hint !== undefined ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
