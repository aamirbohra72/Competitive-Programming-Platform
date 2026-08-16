'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useOptionalDashboardSidebar } from '@/contexts/DashboardSidebarContext';
import { getUser, isAdmin } from '@/lib/auth';
import { cn } from '@/lib/cn';

interface SidebarItem {
  label: string;
  href: string;
  icon?: string;
  badge?: string;
  staffOnly?: boolean;
}

const sidebarItems: SidebarItem[] = [
  { label: 'Home', href: '/', icon: '🏠' },
  { label: 'Courses', href: '/learn', icon: '📚' },
  { label: 'Blog', href: '/blog', icon: '✍️' },
  { label: 'Gift a course', href: '/gift', icon: '🎁' },
  { label: 'Become Affiliate', href: '/affiliate', icon: '💵' },
  { label: 'Referral Program', href: '/referral', icon: '🤝' },
  { label: 'Certificates', href: '/certificates', icon: '🏆' },
  { label: 'Billing', href: '/billing', icon: '💳' },
  { label: 'Playground', href: '/practice', icon: '💻' },
  { label: 'Interview (JS)', href: '/interview', icon: '🎙️' },
  { label: 'TA Help', href: '/ta-help', icon: '🧑‍🏫' },
  { label: 'TA Desk', href: '/ta-help/desk', icon: '🎧', staffOnly: true },
  { label: 'Placement Support', href: '/placement', icon: '💼' },
  { label: 'Write a Blog', href: '/blog/write', icon: '✏️' },
  { label: 'DSA Sheet', href: '/dsa-sheet', icon: '📋' },
  { label: 'Visualizer', href: '/visualizer', icon: '▶️' },
  { label: 'Roadmaps', href: '/roadmaps', icon: '🗺️' },
  { label: 'Meeting Comms', href: '/communication', icon: '💬' },
  { label: 'Project Ideas', href: '/projects', icon: '💡' },
];

export function Sidebar() {
  const pathname = usePathname();
  const ctx = useOptionalDashboardSidebar();
  const isOpen = ctx?.isOpen ?? true;
  const isMobile = ctx?.isMobile ?? false;
  const sidebarId = ctx?.sidebarId ?? 'sidebar-panel-static';
  const setOpen = ctx?.setOpen;
  const staff = isAdmin() || getUser()?.role === 'TA';
  const visibleItems = useMemo(
    () => sidebarItems.filter((item) => !item.staffOnly || staff),
    [staff],
  );

  useEffect(() => {
    if (!isMobile || !setOpen) return;
    setOpen(false);
  }, [pathname, isMobile, setOpen]);

  const panelOpen = ctx ? isOpen : true;

  return (
    <aside
      id={sidebarId}
      aria-hidden={!panelOpen}
      className={cn(
        'fixed left-0 z-40 w-[240px] overflow-y-auto border-r border-[#3a3a3a] bg-[#2a2a2a] py-6 text-white transition-transform duration-200 ease-out',
        'top-14 h-[calc(100vh-3.5rem)]',
        panelOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none',
      )}
    >
      <nav aria-label="Dashboard">
        {visibleItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              tabIndex={panelOpen ? undefined : -1}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.5rem',
                color: isActive ? '#fff' : '#b0b0b0',
                background: isActive ? '#3a3a3a' : 'transparent',
                textDecoration: 'none',
                borderLeft: isActive ? '3px solid #22c55e' : '3px solid transparent',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = '#333';
                  e.currentTarget.style.color = '#fff';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#b0b0b0';
                }
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
              <span style={{ fontSize: '0.95rem', fontWeight: isActive ? '600' : '400' }}>{item.label}</span>
              {item.badge && (
                <span
                  style={{
                    marginLeft: 'auto',
                    background: '#22c55e',
                    color: 'white',
                    fontSize: '0.7rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '10px',
                    fontWeight: '600',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
