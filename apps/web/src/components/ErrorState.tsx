'use client';

import { Button } from './Button';

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-6 py-8 text-center"
    >
      <p className="text-sm font-semibold text-rose-800">Não foi possível carregar os dados</p>
      <p className="max-w-md text-sm text-rose-700">{message}</p>
      {onRetry !== undefined ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}
