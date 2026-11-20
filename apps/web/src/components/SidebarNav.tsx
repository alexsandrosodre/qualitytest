'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { GlobalRole } from '@qualitytest/shared';

import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/format';

interface NavItem {
  href: string;
  label: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/projects', label: 'Projetos' },
  { href: '/occurrences', label: 'Ocorrências' },
  { href: '/profile', label: 'Perfil' },
  { href: '/users', label: 'Usuários', adminOnly: true },
];

export interface SidebarNavProps {
  open: boolean;
  onClose: () => void;
}

export function SidebarNav({ open, onClose }: SidebarNavProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const isAdmin = user?.globalRole === GlobalRole.ADMINISTRADOR;

  const items = NAV_ITEMS.filter((item) => item.adminOnly !== true || isAdmin);

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 md:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={cn(
          'z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform',
          'fixed inset-y-0 left-0 md:static md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center border-b border-slate-100 px-5">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight text-slate-900">
            QUALITY TEST
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navegação principal">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-sky-50 text-sky-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
