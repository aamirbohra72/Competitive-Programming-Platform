'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { SpeedMultiplier } from '@/hooks/useStepPlayer';

type PlayerControlsProps = {
  currentStepIndex: number;
  stepCount: number;
  isPlaying: boolean;
  speed: SpeedMultiplier;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (i: number) => void;
  onReset: () => void;
  onSpeedChange: (s: SpeedMultiplier) => void;
  className?: string;
};

function IconButton({
  label,
  onClick,
  disabled,
  children,
  primary,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-theme)] transition',
        primary
          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
          : 'bg-green-50 hover:bg-green-100',
        'disabled:cursor-not-allowed disabled:opacity-30',
      )}
    >
      {children}
    </button>
  );
}

export function PlayerControls({
  currentStepIndex,
  stepCount,
  isPlaying,
  speed,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onSeek,
  onReset,
  onSpeedChange,
  className,
}: PlayerControlsProps) {
  const last = Math.max(0, stepCount - 1);
  const progress = last === 0 ? 100 : (currentStepIndex / last) * 100;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 border-t border-[var(--border-theme)] bg-[var(--surface-panel)] px-3 py-2.5',
        className,
      )}
    >
      <div className="flex items-center gap-1">
        <IconButton label="Reset" onClick={onReset}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6a6 6 0 01-9.33 4.96l-1.42 1.42A8 8 0 0012 21a8 8 0 000-16z" />
          </svg>
        </IconButton>
        <IconButton label="Previous step" onClick={onPrev} disabled={currentStepIndex <= 0}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </IconButton>
        <IconButton
          label={isPlaying ? 'Pause' : 'Play'}
          onClick={isPlaying ? onPause : onPlay}
          primary
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </IconButton>
        <IconButton label="Next step" onClick={onNext} disabled={currentStepIndex >= last}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z" />
          </svg>
        </IconButton>
      </div>

      <div className="relative mx-1 min-w-[140px] flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-green-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={currentStepIndex}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Step scrubber"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>

      <button
        type="button"
        onClick={() => {
          const order: SpeedMultiplier[] = [1, 1.5, 2];
          const next = order[(order.indexOf(speed) + 1) % order.length];
          onSpeedChange(next);
        }}
        className="rounded-md border border-[var(--border-theme)] bg-white px-2.5 py-1.5 font-mono text-xs text-[var(--text-theme)] hover:text-green-700"
        aria-label="Cycle playback speed"
      >
        {speed}x
      </button>
    </div>
  );
}
