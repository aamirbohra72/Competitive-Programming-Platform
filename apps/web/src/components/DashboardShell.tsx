'use client';

import type { ReactNode } from 'react';
import { AppNavbar } from '@/components/AppNavbar';
import { Sidebar } from '@/components/Sidebar';
import { SidebarBackdrop } from '@/components/SidebarBackdrop';
import { DashboardSidebarProvider, useDashboardSidebar } from '@/contexts/DashboardSidebarContext';
import { cn } from '@/lib/cn';

export type DashboardShellProps = {
  children: ReactNode;
  /** Classes merged onto the scrollable `<main>` region (padding, flex, etc.). */
  mainClassName?: string;
  /** Classes for the outer `<nav>` from AppNavbar (e.g. sticky). */
  navClassName?: string;
};

function DashboardShellMain({ children, mainClassName }: Pick<DashboardShellProps, 'children' | 'mainClassName'>) {
  const { isOpen, isMobile } = useDashboardSidebar();
  const showOffset = isOpen && !isMobile;

  return (
    <main
      className={cn(
        'min-h-[calc(100vh-3.5rem)] min-w-0 flex-1 bg-[var(--surface-page)] text-[var(--text-theme)] antialiased',
        showOffset && 'lg:ml-[240px]',
        mainClassName,
      )}
    >
      {children}
    </main>
  );
}

/**
 * Shared layout: dark AppNavbar + fixed sidebar + main content area.
 * Matches the `/learn` dashboard chrome (theme from product screenshots).
 */
export function DashboardShell({ children, mainClassName, navClassName }: DashboardShellProps) {
  return (
    <DashboardSidebarProvider>
      <AppNavbar className={cn('sticky top-0 z-50 shrink-0', navClassName)} />
      <div className="relative flex w-full min-h-[calc(100vh-3.5rem)]">
        <SidebarBackdrop />
        <Sidebar />
        <DashboardShellMain mainClassName={mainClassName}>{children}</DashboardShellMain>
      </div>
    </DashboardSidebarProvider>
  );
}
