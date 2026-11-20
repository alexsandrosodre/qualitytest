'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/format';

export interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function Card({ title, description, actions, className, bodyClassName, children }: CardProps) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {title !== undefined || actions !== undefined ? (
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="space-y-0.5">
            {title !== undefined ? (
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            ) : null}
            {description !== undefined ? (
              <p className="text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          {actions !== undefined ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn('px-5 py-4', bodyClassName)}>{children}</div>
    </section>
  );
}
