'use client';

import { AppNavbar } from '@/components/AppNavbar';
import { Visualizer } from '@/components/visualizer';
import type { PlayableTrackId } from '@/data/visualizer-tracks';

export function TrackPageClient({ track }: { track: PlayableTrackId }) {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[var(--surface-page)]">
      <AppNavbar className="z-50 shrink-0" />
      <Visualizer track={track} className="min-h-0 flex-1" />
    </div>
  );
}
