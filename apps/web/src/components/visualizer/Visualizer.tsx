'use client';

import { useEffect, useMemo, useState } from 'react';
import { getScriptForPattern } from '@/data/visual-scripts';
import {
  getDsaPattern,
  getDefaultDsaPatternId,
  patternIdForScript,
  type DsaPattern,
} from '@/data/dsa-pattern-catalog';
import {
  getDefaultLldPatternId,
  getLldPattern,
  patternIdForLldScript,
  type LldPattern,
} from '@/data/lld-pattern-catalog';
import { useNarration } from '@/hooks/useNarration';
import { useStepPlayer } from '@/hooks/useStepPlayer';
import type { VisualScript } from '@/types/visual-script';
import {
  approachPlayerKey,
  getDefaultApproach,
} from '@/types/visual-script';
import { ApproachTabs } from './ApproachTabs';
import { CaptionBar } from './CaptionBar';
import { DiagramRenderer } from './DiagramRenderer';
import { DsaPatternNav } from './DsaPatternNav';
import { LldPatternNav } from './LldPatternNav';
import { PlayerControls } from './PlayerControls';
import { SolutionPanel } from './SolutionPanel';
import { PatternPlaceholder } from './PatternPlaceholder';
import { cn } from '@/lib/cn';
import type { PlayableTrackId } from '@/data/visualizer-tracks';

type VisualizerProps = {
  track: PlayableTrackId;
  initialScriptId?: string;
  initialPatternId?: string;
  className?: string;
};

function DifficultyBadge({ level }: { level: string }) {
  const styles =
    level === 'EASY' || level === 'Easy'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : level === 'MEDIUM' || level === 'Medium'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        : 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  return (
    <span className={cn('rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase', styles)}>
      {level}
    </span>
  );
}

function HideSolutionToggle({
  hidden,
  onToggle,
}: {
  hidden: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition',
        hidden
          ? 'border-green-300 bg-green-50 text-green-800'
          : 'border-[var(--border-theme)] bg-white text-[var(--text-muted)] hover:text-green-700',
      )}
      aria-pressed={hidden}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
        {hidden ? (
          <path d="M12 7a5 5 0 100 10 5 5 0 000-10zm0-5C7 2 2.73 5.11 1 9.5 2.73 13.89 7 17 12 17s9.27-3.11 11-7.5C21.27 5.11 17 2 12 2zm0 12a5 5 0 110-10 5 5 0 010 10z" />
        ) : (
          <path d="M12 5C7 5 2.73 8.11 1 12.5c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5zm0 10a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z" />
        )}
      </svg>
      {hidden ? 'Solutions hidden' : 'Hide solution'}
    </button>
  );
}

function ScriptPlayer({
  script,
  solutionHidden,
  onSolutionHiddenChange,
}: {
  script: VisualScript;
  solutionHidden: boolean;
  onSolutionHiddenChange: (hidden: boolean) => void;
}) {
  const [approachId, setApproachId] = useState(() => getDefaultApproach(script).id);
  const [trackedScriptId, setTrackedScriptId] = useState(script.id);

  useEffect(() => {
    if (script.id !== trackedScriptId) {
      setTrackedScriptId(script.id);
      setApproachId(getDefaultApproach(script).id);
      onSolutionHiddenChange(false);
    }
  }, [script, trackedScriptId, onSolutionHiddenChange]);

  const approach = useMemo(
    () => script.approaches.find((a) => a.id === approachId) ?? getDefaultApproach(script),
    [script, approachId],
  );

  const player = useStepPlayer({
    key: approachPlayerKey(script.id, approach.id),
    steps: approach.steps,
  });

  const { caption, loading } = useNarration(
    script.id,
    approach.id,
    player.currentStepIndex,
    player.currentStep.captionSeed,
    player.currentStep.state,
  );

  const { meta } = script;

  return (
    <>
      <header className="shrink-0 border-b border-[var(--border-theme)] bg-[var(--surface-panel)] px-3 py-3 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {meta.eyebrow}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-[var(--text-theme)] sm:text-2xl">
                {script.title}
              </h1>
              {meta.leetcode ? (
                <span className="rounded-md border border-[var(--border-theme)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                  {meta.leetcode}
                </span>
              ) : null}
              {meta.difficulty ? <DifficultyBadge level={meta.difficulty} /> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums text-[var(--text-muted)]">
              step {player.currentStepIndex + 1} / {player.stepCount}
            </span>
            <HideSolutionToggle
              hidden={solutionHidden}
              onToggle={() => onSolutionHiddenChange(!solutionHidden)}
            />
          </div>
        </div>

        <div className="mt-2.5 max-w-3xl rounded-lg border border-[var(--border-theme)] bg-white px-3 py-2.5">
          <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">{meta.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {meta.companies.map((c) => (
              <span
                key={c}
                className="rounded-md border border-[var(--border-theme)] bg-[var(--surface-panel)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]"
              >
                {c}
              </span>
            ))}
          </div>
          <ApproachTabs
            approaches={script.approaches}
            activeId={approach.id}
            onSelect={(id) => {
              setApproachId(id);
              onSolutionHiddenChange(false);
            }}
            className="mt-3 border-t border-[var(--border-theme)] pt-3"
          />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-2 overflow-hidden p-3 sm:gap-3 sm:p-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(240px,0.85fr)]">
        <DiagramRenderer step={player.currentStep} className="min-h-[160px]" />
        <SolutionPanel
          approach={approach}
          step={player.currentStep}
          stepIndex={player.currentStepIndex}
          stepCount={player.stepCount}
          solutionHidden={solutionHidden}
          onRevealSolution={() => onSolutionHiddenChange(false)}
        />
      </div>

      <div className="shrink-0 px-4 pb-0 md:px-5">
        <CaptionBar
          caption={caption}
          loading={loading}
          activeLine={player.currentStep.activeLine}
          className="mb-3"
        />
      </div>
      <PlayerControls
        currentStepIndex={player.currentStepIndex}
        stepCount={player.stepCount}
        isPlaying={player.isPlaying}
        speed={player.speed}
        onPlay={player.play}
        onPause={player.pause}
        onNext={player.next}
        onPrev={player.prev}
        onSeek={player.seek}
        onReset={player.reset}
        onSpeedChange={player.setSpeed}
      />
    </>
  );
}

function DsaVisualizer({
  initialPatternId,
  className,
}: {
  initialPatternId?: string;
  className?: string;
}) {
  const [patternId, setPatternId] = useState(
    () => initialPatternId ?? getDefaultDsaPatternId(),
  );
  const [solutionHidden, setSolutionHidden] = useState(false);

  const pattern = getDsaPattern(patternId) ?? getDsaPattern(getDefaultDsaPatternId());
  const script = pattern ? getScriptForPattern(pattern) : undefined;

  const handleSelectPattern = (next: DsaPattern) => {
    setPatternId(next.id);
    setSolutionHidden(false);
  };

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full flex-row overflow-hidden bg-[var(--surface-page)] text-[var(--text-theme)]',
        className,
      )}
    >
      <DsaPatternNav activePatternId={patternId} onSelect={handleSelectPattern} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {script ? (
          <ScriptPlayer
            key={script.id}
            script={script}
            solutionHidden={solutionHidden}
            onSolutionHiddenChange={setSolutionHidden}
          />
        ) : pattern ? (
          <PatternPlaceholder pattern={pattern} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-muted)]">
            Pattern not found
          </div>
        )}
      </div>
    </div>
  );
}

function LldVisualizer({
  initialScriptId,
  initialPatternId,
  className,
}: {
  initialScriptId?: string;
  initialPatternId?: string;
  className?: string;
}) {
  const [patternId, setPatternId] = useState(() => {
    if (initialPatternId) return initialPatternId;
    if (initialScriptId) {
      const fromScript = patternIdForLldScript(initialScriptId);
      if (fromScript) return fromScript;
    }
    return getDefaultLldPatternId();
  });
  const [solutionHidden, setSolutionHidden] = useState(false);

  const pattern =
    getLldPattern(patternId) ??
    getLldPattern(getDefaultLldPatternId());
  const script = pattern ? getScriptForPattern(pattern) : undefined;

  const handleSelectPattern = (next: LldPattern) => {
    setPatternId(next.id);
    setSolutionHidden(false);
  };

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full flex-row overflow-hidden bg-[var(--surface-page)] text-[var(--text-theme)]',
        className,
      )}
    >
      <LldPatternNav activePatternId={patternId} onSelect={handleSelectPattern} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {script ? (
          <ScriptPlayer
            key={script.id}
            script={script}
            solutionHidden={solutionHidden}
            onSolutionHiddenChange={setSolutionHidden}
          />
        ) : pattern ? (
          <PatternPlaceholder pattern={pattern} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-muted)]">
            Pattern not found
          </div>
        )}
      </div>
    </div>
  );
}

export function Visualizer({
  track,
  initialScriptId,
  initialPatternId,
  className,
}: VisualizerProps) {
  if (track === 'dsa') {
    const fromScript = initialScriptId ? patternIdForScript(initialScriptId) : undefined;
    return (
      <DsaVisualizer
        initialPatternId={initialPatternId ?? fromScript}
        className={className}
      />
    );
  }
  return <LldVisualizer initialScriptId={initialScriptId} initialPatternId={initialPatternId} className={className} />;
}
