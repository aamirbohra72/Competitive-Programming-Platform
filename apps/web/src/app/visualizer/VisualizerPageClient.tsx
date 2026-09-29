'use client';

import { AppNavbar } from '@/components/AppNavbar';
import { VisualizerLanding } from '@/components/visualizer/VisualizerLanding';

export function VisualizerPageClient() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-[var(--surface-page)]">
      <AppNavbar className="sticky top-0 z-50 shrink-0" />
      <VisualizerLanding />
    </div>
  );
}
