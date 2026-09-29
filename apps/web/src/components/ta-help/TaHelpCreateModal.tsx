'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  TA_HELP_LANGUAGES,
  TA_HELP_TOPICS,
  type TaHelpType,
} from '@/data/ta-help';

const inputClass =
  'w-full rounded-lg border border-[var(--border-theme)] bg-white px-3 py-2.5 text-sm text-[var(--text-theme)] placeholder:text-[var(--text-muted)] outline-none transition focus:border-green-500 focus:ring-1 focus:ring-green-500/40';

const labelClass = 'mb-1.5 block text-xs font-medium text-[var(--text-muted)]';

export type TaHelpCreatePayload = {
  title: string;
  type: TaHelpType;
  problem: string;
  topic: string;
  language: string;
  description: string;
  preferredSlot?: string;
};

type TaHelpCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: TaHelpCreatePayload) => void;
  /** Prefill request type (e.g. video for "Request a Call"). */
  defaultType?: TaHelpType;
  defaults?: Partial<{
    title: string;
    problem: string;
    topic: string;
    language: string;
    description: string;
  }>;
  heading?: string;
};

const CALL_SLOTS = [
  'ASAP (next available TA)',
  'Within 1 hour',
  'Today evening',
  'Tomorrow morning',
] as const;

export function TaHelpCreateModal({
  open,
  onClose,
  onSubmit,
  defaultType = 'text',
  defaults,
  heading,
}: TaHelpCreateModalProps) {
  const [type, setType] = useState<TaHelpType>(defaultType);
  const [slot, setSlot] = useState<string>(CALL_SLOTS[0]);

  useEffect(() => {
    if (open) {
      setType(defaultType);
      setSlot(CALL_SLOTS[0]);
    }
  }, [open, defaultType]);

  if (!open) return null;

  const isCall = type === 'video';

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-green-950/45 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-[var(--border-theme)] bg-white text-[var(--text-theme)] shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ta-help-create-title"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border-theme)] bg-[var(--surface-panel)] px-5 py-4">
          <h2 id="ta-help-create-title" className="text-lg font-bold text-[var(--text-theme)]">
            {heading || (isCall ? 'Request a TA video call' : 'Ask a Teaching Assistant')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 text-xl text-[var(--text-muted)] hover:bg-green-100 hover:text-green-800"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const description = String(fd.get('description') ?? '');
            const withSlot =
              type === 'video'
                ? `${description.trim()}\n\nPreferred call slot: ${slot}`
                : description;
            onSubmit({
              title: String(fd.get('title') ?? ''),
              type,
              problem: String(fd.get('problem') ?? ''),
              topic: String(fd.get('topic') ?? ''),
              language: String(fd.get('language') ?? ''),
              description: withSlot,
              preferredSlot: type === 'video' ? slot : undefined,
            });
            e.currentTarget.reset();
            setType(defaultType);
            setSlot(CALL_SLOTS[0]);
          }}
        >
          <div>
            <span className={labelClass}>Request type</span>
            <div className="flex gap-2">
              {(
                [
                  { id: 'text' as const, label: 'Text help' },
                  { id: 'video' as const, label: 'Video call' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setType(opt.id)}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition',
                    type === opt.id
                      ? 'border-green-500 bg-green-50 text-green-800'
                      : 'border-[var(--border-theme)] bg-white text-[var(--text-muted)] hover:border-green-400 hover:text-[var(--text-theme)]',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {isCall ? (
            <div>
              <span className={labelClass}>When should we call?</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {CALL_SLOTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left text-xs font-medium transition',
                      slot === s
                        ? 'border-sky-400 bg-sky-50 text-sky-800'
                        : 'border-[var(--border-theme)] bg-white text-[var(--text-muted)] hover:border-sky-400',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <label className={labelClass} htmlFor="ta-title">
              Title
            </label>
            <input
              id="ta-title"
              name="title"
              required
              minLength={4}
              defaultValue={defaults?.title || (isCall ? 'Request a TA video call' : '')}
              key={`title-${open}-${defaults?.title || ''}-${isCall}`}
              className={inputClass}
              placeholder="e.g. Facing compilation error"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="ta-problem">
              Problem / assignment
            </label>
            <input
              id="ta-problem"
              name="problem"
              required
              minLength={2}
              defaultValue={defaults?.problem || 'General support'}
              key={`problem-${open}-${defaults?.problem || ''}`}
              className={inputClass}
              placeholder="Problem name"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="ta-topic">
                Topic
              </label>
              <select
                id="ta-topic"
                name="topic"
                required
                className={inputClass}
                defaultValue={defaults?.topic || ''}
                key={`topic-${open}-${defaults?.topic || ''}`}
              >
                <option value="" disabled>
                  Select topic
                </option>
                {TA_HELP_TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="ta-language">
                Language
              </label>
              <select
                id="ta-language"
                name="language"
                required
                className={inputClass}
                defaultValue={defaults?.language || ''}
                key={`lang-${open}-${defaults?.language || ''}`}
              >
                <option value="" disabled>
                  Select language
                </option>
                {TA_HELP_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="ta-description">
              {isCall ? 'What should the TA cover on the call?' : 'Describe your issue'}
            </label>
            <textarea
              id="ta-description"
              name="description"
              required
              minLength={20}
              rows={4}
              defaultValue={defaults?.description || ''}
              key={`desc-${open}-${defaults?.description || ''}`}
              className={cn(inputClass, 'resize-y')}
              placeholder="What have you tried? Where are you stuck?"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--border-theme)] bg-white py-2.5 text-sm font-semibold text-[var(--text-theme)] hover:border-green-400 hover:bg-green-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-green-700 py-2.5 text-sm font-semibold text-white hover:bg-green-800"
            >
              {isCall ? 'Request call' : 'Submit request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
