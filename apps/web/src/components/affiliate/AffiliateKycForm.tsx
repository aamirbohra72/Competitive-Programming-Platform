'use client';

import { useCallback, useState } from 'react';
import { INDIAN_STATES } from '@/data/affiliate';
import { cn } from '@/lib/cn';

type Region = 'india' | 'international';

const fieldClass = 'w-full rounded-lg border border-[var(--border-theme)] bg-white px-3 py-2 text-[var(--text-theme)] placeholder:text-[var(--text-muted)] focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500';

export function AffiliateKycForm() {
  const [region, setRegion] = useState<Region>('india');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setMessage(null);
      const form = e.currentTarget;
      const fd = new FormData(form);

      const base = { phone: String(fd.get('phone') ?? '').trim() };

      const body =
        region === 'india'
          ? {
              region: 'india' as const,
              ...base,
              panNumber: String(fd.get('panNumber') ?? '').trim().toUpperCase(),
              nameOnPan: String(fd.get('nameOnPan') ?? '').trim(),
              aadharNumber: String(fd.get('aadharNumber') ?? '').replace(/\s/g, ''),
              state: String(fd.get('state') ?? ''),
            }
          : {
              region: 'international' as const,
              ...base,
              fullName: String(fd.get('fullName') ?? '').trim(),
              country: String(fd.get('country') ?? '').trim(),
              taxId: String(fd.get('taxId') ?? '').trim() || undefined,
            };

      setSubmitting(true);
      try {
        const res = await fetch('/api/affiliate/application', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
        if (!res.ok) {
          setMessage({ type: 'err', text: data.error ?? 'Something went wrong' });
          return;
        }
        setMessage({ type: 'ok', text: data.message ?? 'Submitted successfully.' });
        form.reset();
      } catch {
        setMessage({ type: 'err', text: 'Network error. Try again.' });
      } finally {
        setSubmitting(false);
      }
    },
    [region]
  );

  return (
    <section className="rounded-lg border border-[var(--border-theme)] bg-white p-6">
      <h2 className="text-lg font-semibold text-[var(--text-theme)]">Affiliate verification (KYC)</h2>
      <div
        className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900"
        role="note"
      >
        <p className="font-medium text-sky-800">Before you submit</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>Use details exactly as on your government ID.</li>
          <li>Keep ID images under 150KB when uploads are enabled.</li>
          <li>Documents must be legible; blurry photos may delay approval.</li>
        </ol>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-sm text-[var(--text-muted)]">Where are you from?</span>
        <div className="flex rounded-lg border border-[var(--border-theme)] p-0.5">
          {(
            [
              { id: 'international' as const, label: 'Outside India' },
              { id: 'india' as const, label: 'India' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRegion(opt.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                region === opt.id ? 'bg-green-700 text-white' : 'text-[var(--text-muted)] hover:bg-green-50 hover:text-green-800'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        {region === 'india' ? (
          <>
            <Field label="PAN number" required>
              <input
                name="panNumber"
                required
                maxLength={10}
                placeholder="ABCDE1234F"
                className={fieldClass}
                autoComplete="off"
              />
            </Field>
            <Field label="Name on PAN" required>
              <input
                name="nameOnPan"
                required
                placeholder="Full name as on PAN"
                className={fieldClass}
              />
            </Field>
            <Field label="Aadhaar number" required>
              <input
                name="aadharNumber"
                required
                inputMode="numeric"
                pattern="[0-9]{12}"
                maxLength={12}
                placeholder="12-digit Aadhaar"
                className={fieldClass}
              />
            </Field>
            <Field label="State" required>
              <select
                name="state"
                required
                defaultValue=""
                className={fieldClass}
              >
                <option value="" disabled>
                  Select state
                </option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : (
          <>
            <Field label="Full legal name" required>
              <input
                name="fullName"
                required
                className={fieldClass}
              />
            </Field>
            <Field label="Country" required>
              <input
                name="country"
                required
                className={fieldClass}
              />
            </Field>
            <Field label="Tax ID (optional)">
              <input
                name="taxId"
                className={fieldClass}
              />
            </Field>
          </>
        )}

        <Field label="Phone number" required>
          <input
            name="phone"
            required
            inputMode="tel"
            placeholder={region === 'india' ? '10-digit mobile' : 'Include country code if applicable'}
            className={fieldClass}
          />
        </Field>

        <p className="text-xs text-[var(--text-muted)]">
          Identity document uploads will attach to this application when file storage is enabled for your account.
        </p>

        {message ? (
          <p
            className={cn('text-sm', message.type === 'ok' ? 'text-green-700' : 'text-red-700')}
            role="status"
          >
            {message.text}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit application'}
        </button>
      </form>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-[var(--text-muted)]">
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
