'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { GLOBAL_ROLE_LABELS } from '@/lib/format';
import { useAuth } from '@/lib/auth';

import { ProjectSelector } from './ProjectSelector';

export interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async (): Promise<void> => {
    setMenuOpen(false);
    await logout();
    router.replace('/login');
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 md:hidden"
        >
          <span aria-hidden="true" className="block h-0.5 w-5 bg-current" />
          <span aria-hidden="true" className="mt-1 block h-0.5 w-5 bg-current" />
          <span aria-hidden="true" className="mt-1 block h-0.5 w-5 bg-current" />
        </button>
        <ProjectSelector />
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
            {(user?.name ?? '?').charAt(0).toUpperCase()}
          </span>
          <span className="hidden flex-col sm:flex">
            <span className="text-sm font-medium text-slate-800">{user?.name ?? '—'}</span>
            <span className="text-xs text-slate-500">
              {user?.globalRole !== null && user?.globalRole !== undefined
                ? GLOBAL_ROLE_LABELS[user.globalRole]
                : 'Usuário'}
            </span>
          </span>
        </button>

        {menuOpen ? (
          <>
            <div
              className="fixed inset-0 z-10"
              aria-hidden="true"
              onClick={() => setMenuOpen(false)}
            />
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            >
              <div className="border-b border-slate-100 px-4 py-2">
                <p className="text-sm font-medium text-slate-800">{user?.name ?? '—'}</p>
                <p className="truncate text-xs text-slate-500">{user?.email ?? '—'}</p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  void handleLogout();
                }}
                className="block w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
              >
                Sair
              </button>
            </div>
          </>
        ) : null}
      </div>
    </header>
  );
}
