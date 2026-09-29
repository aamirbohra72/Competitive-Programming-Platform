'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { getUser } from '@/lib/auth';
import { cn } from '@/lib/cn';
import {
  REFERRAL_AUDIENCES,
  REFERRAL_FRIEND_DISCOUNT_INR,
  REFERRAL_JOINED_KEY,
  REFERRAL_MAX_CALCULATOR,
  REFERRAL_OLD_REWARD_INR,
  REFERRAL_PROGRAMS,
  REFERRAL_REWARD_INR,
  REFERRAL_STEPS,
  formatInr,
  rewardForReferrals,
  rewardTableRows,
} from '@/data/referral';

const inputClass =
  'w-full rounded-lg border border-[var(--border-theme)] bg-white px-3 py-2.5 text-sm text-[var(--text-theme)] placeholder:text-[var(--text-muted)] outline-none transition focus:border-green-500 focus:ring-1 focus:ring-green-500/40';

const labelClass = 'mb-1.5 block text-xs font-medium text-[var(--text-muted)]';

function scrollToForm() {
  document.getElementById('refer-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function ReferralLanding() {
  const [joined, setJoined] = useState(false);
  const [displayName, setDisplayName] = useState('there');
  const [referrals, setReferrals] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const user = getUser();
    setDisplayName(user?.username?.trim() || 'there');
    setJoined(localStorage.getItem(REFERRAL_JOINED_KEY) === '1');
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const cashReward = useMemo(() => rewardForReferrals(referrals), [referrals]);
  const oldCash = useMemo(
    () => referrals * REFERRAL_OLD_REWARD_INR,
    [referrals],
  );
  const tableRows = useMemo(() => rewardTableRows(5), []);

  const joinProgram = useCallback(() => {
    setJoining(true);
    try {
      localStorage.setItem(REFERRAL_JOINED_KEY, '1');
      setJoined(true);
      setToast({ type: 'ok', text: 'You joined the referral program. Start referring friends below.' });
      window.setTimeout(scrollToForm, 200);
    } finally {
      setJoining(false);
    }
  }, []);

  const onReferSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!joined) {
        setToast({ type: 'err', text: 'Join the referral program first to submit referrals.' });
        return;
      }

      const form = e.currentTarget;
      const fd = new FormData(form);
      const body = {
        friendName: String(fd.get('friendName') ?? '').trim(),
        friendPhone: String(fd.get('friendPhone') ?? '').replace(/\D/g, '').slice(-10),
        friendEmail: String(fd.get('friendEmail') ?? '').trim(),
        graduationYear: String(fd.get('graduationYear') ?? '').trim(),
        programId: String(fd.get('programId') ?? ''),
      };

      setSubmitting(true);
      try {
        const res = await fetch('/api/referral/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
        if (!res.ok) {
          setToast({ type: 'err', text: data.error ?? 'Could not submit referral.' });
          return;
        }
        setToast({ type: 'ok', text: data.message ?? 'Referral submitted.' });
        form.reset();
      } catch {
        setToast({ type: 'err', text: 'Network error. Try again.' });
      } finally {
        setSubmitting(false);
      }
    },
    [joined],
  );

  return (
    <DashboardShell mainClassName="relative min-h-0 overflow-y-auto p-0">
      {/* Promo bar */}
      <div className="border-b border-[var(--border-theme)] bg-[var(--surface-panel)] px-4 py-2.5 text-center text-xs text-[var(--text-muted)] md:text-sm">
        Earn {formatInr(REFERRAL_REWARD_INR)} per successful referral · Friends save{' '}
        {formatInr(REFERRAL_FRIEND_DISCOUNT_INR)} on signup · Track payouts after KYC
      </div>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-8 pb-20 md:px-8">
        {/* Hero + form */}
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <p className="text-sm font-medium text-green-700">Referral Program</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-[var(--text-theme)] md:text-4xl">
              {displayName},{' '}
              <span className="block sm:inline">
                earn{' '}
                <span className="text-sky-700 line-through decoration-2">
                  {formatInr(REFERRAL_OLD_REWARD_INR)}
                </span>{' '}
                <span className="text-green-700">{formatInr(REFERRAL_REWARD_INR)}</span> for
                every friend you refer!
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--text-muted)] md:text-base">
              Invite friends to Codeforces Platform courses. When they enroll, you get cash rewards
              and they get {formatInr(REFERRAL_FRIEND_DISCOUNT_INR)} off.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {!joined ? (
                <button
                  type="button"
                  onClick={joinProgram}
                  disabled={joining}
                  className="rounded-lg bg-orange-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-800 disabled:opacity-70"
                >
                  {joining ? 'Joining…' : 'Join Referral Program'}
                </button>
              ) : (
                <span className="inline-flex items-center rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-800">
                  ✓ You&apos;re in the program
                </span>
              )}
              <button
                type="button"
                onClick={scrollToForm}
                className="rounded-lg border border-[var(--border-theme)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--text-theme)] transition hover:border-green-400 hover:bg-green-50"
              >
                Refer Your Friend
              </button>
              <Link
                href="/affiliate"
                className="rounded-lg border border-[var(--border-theme)] px-5 py-2.5 text-sm font-semibold text-green-700 transition hover:border-green-400 hover:bg-green-50"
              >
                Open Affiliate Dashboard
              </Link>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      Your reward
                    </p>
                    <p className="mt-2 text-2xl font-bold text-green-700">
                      {formatInr(REFERRAL_REWARD_INR)}
                      <span className="text-sm font-medium text-[var(--text-muted)]"> / referral</span>
                    </p>
                  </div>
                  <span className="text-3xl" aria-hidden>
                    💵
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      Their benefit
                    </p>
                    <p className="mt-2 text-2xl font-bold text-green-700">
                      {formatInr(REFERRAL_FRIEND_DISCOUNT_INR)}
                      <span className="text-sm font-medium text-[var(--text-muted)]"> off</span>
                    </p>
                  </div>
                  <span className="text-3xl" aria-hidden>
                    🎁
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Refer form */}
          <div
            id="refer-form"
            className="rounded-lg border border-[var(--border-theme)] bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-bold text-[var(--text-theme)]">
              Know someone who deserves a better career?
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Share their details — we&apos;ll take it from there.
            </p>

            {!joined && (
              <div
                className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                role="status"
              >
                Join the referral program to unlock submissions.
              </div>
            )}

            <form className="mt-5 space-y-4" onSubmit={onReferSubmit}>
              <div>
                <label className={labelClass} htmlFor="friendName">
                  Friend&apos;s name
                </label>
                <input
                  id="friendName"
                  name="friendName"
                  required
                  minLength={2}
                  className={inputClass}
                  placeholder="Full name"
                  disabled={!joined}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="friendPhone">
                  Friend&apos;s phone number
                </label>
                <div className="flex gap-2">
                  <span className="inline-flex items-center rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] px-3 text-sm text-[var(--text-muted)]">
                    +91
                  </span>
                  <input
                    id="friendPhone"
                    name="friendPhone"
                    required
                    inputMode="numeric"
                    pattern="[6-9][0-9]{9}"
                    maxLength={10}
                    className={inputClass}
                    placeholder="10-digit mobile"
                    disabled={!joined}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="friendEmail">
                  Friend&apos;s email
                </label>
                <input
                  id="friendEmail"
                  name="friendEmail"
                  type="email"
                  required
                  className={inputClass}
                  placeholder="name@email.com"
                  disabled={!joined}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="graduationYear">
                  Year of graduation
                </label>
                <input
                  id="graduationYear"
                  name="graduationYear"
                  required
                  inputMode="numeric"
                  pattern="(19|20)\d{2}"
                  maxLength={4}
                  className={inputClass}
                  placeholder="e.g. 2024"
                  disabled={!joined}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="programId">
                  Select program
                </label>
                <select
                  id="programId"
                  name="programId"
                  required
                  className={cn(inputClass, 'disabled:opacity-60')}
                  defaultValue=""
                  disabled={!joined}
                >
                  <option value="" disabled>
                    Choose a course
                  </option>
                  {REFERRAL_PROGRAMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={!joined || submitting}
                className="w-full rounded-lg bg-orange-700 py-3 text-sm font-semibold text-white transition hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Refer your friend'}
              </button>
            </form>
          </div>
        </section>

        {/* How it works */}
        <section>
          <h2 className="text-center text-2xl font-bold text-[var(--text-theme)] md:text-3xl">
            How does it work?
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {REFERRAL_STEPS.map((step, i) => (
              <div
                key={step.id}
                className="rounded-lg border border-[var(--border-theme)] bg-white p-5 text-center"
              >
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl ring-1 ring-green-200">
                  {step.icon}
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                  Step {i + 1}
                </p>
                <h3 className="mt-1 text-base font-semibold text-[var(--text-theme)]">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Rewards table */}
        <section className="border-y border-[var(--border-theme)] bg-[var(--surface-panel)] px-4 py-10 md:px-8">
          <h2 className="text-center text-2xl font-bold text-[var(--text-theme)]">
            Rewards you get for successful referrals
          </h2>
          <div className="mx-auto mt-8 max-w-md overflow-hidden rounded-lg border border-[var(--border-theme)] bg-white">
            <div className="grid grid-cols-2 border-b border-[var(--border-theme)] bg-green-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              <span>Referrals</span>
              <span className="text-right">Cash</span>
            </div>
            {tableRows.map((row) => (
              <div
                key={row.referrals}
                className="grid grid-cols-2 border-b border-[var(--border-theme)] px-4 py-3 text-sm last:border-b-0"
              >
                <span className="text-[var(--text-theme)]">
                  {row.referrals} {row.referrals === 1 ? 'referral' : 'referrals'}
                </span>
                <span className="text-right font-semibold text-green-700">
                  {formatInr(row.cash)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Calculator */}
        <section>
          <h2 className="text-center text-2xl font-bold text-[var(--text-theme)] md:text-3xl">
            Rewards Calculator
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-[var(--text-muted)]">
            See how much you can earn — move the slider to project your cash reward.
          </p>

          <div className="mx-auto mt-8 max-w-3xl rounded-lg border border-[var(--border-theme)] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--text-theme)]">
                Know how much you can earn by referring
              </p>
              <a
                href="#rewards-details"
                className="text-xs font-semibold text-sky-700 hover:text-sky-800"
              >
                View reward details
              </a>
            </div>

            <div className="mt-6">
              <input
                type="range"
                min={1}
                max={REFERRAL_MAX_CALCULATOR}
                step={1}
                value={referrals}
                onChange={(e) => setReferrals(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-green-100 accent-green-700"
                aria-label="Number of referrals"
              />
              <div className="mt-2 flex justify-between text-[10px] text-[var(--text-muted)] sm:text-xs">
                {Array.from({ length: REFERRAL_MAX_CALCULATOR }, (_, i) => (
                  <span key={i + 1} className={cn(referrals === i + 1 && 'font-semibold text-green-700')}>
                    {i + 1}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-center text-sm text-[var(--text-theme)]">
                <span className="font-semibold text-green-700">{referrals}</span>{' '}
                {referrals === 1 ? 'Referral' : 'Referrals'}
              </p>
            </div>

            <div
              id="rewards-details"
              className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] p-5"
            >
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">In cash reward</p>
                <p className="mt-1 text-sm text-sky-700 line-through">{formatInr(oldCash)}</p>
                <p className="text-3xl font-bold text-green-700">{formatInr(cashReward)}</p>
              </div>
              <span className="text-5xl" aria-hidden>
                💰
              </span>
            </div>
          </div>
        </section>

        {/* Who can I refer */}
        <section>
          <h2 className="text-center text-2xl font-bold text-[var(--text-theme)] md:text-3xl">
            <span className="text-green-700">Who</span> can I refer?
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {REFERRAL_AUDIENCES.map((a) => (
              <div
                key={a.id}
                className="flex flex-col items-center rounded-lg border border-[var(--border-theme)] bg-white p-4 text-center"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-xl ring-1 ring-green-200">
                  {a.icon}
                </span>
                <p className="mt-3 text-xs leading-snug text-[var(--text-theme)]">{a.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
            Your friend saves {formatInr(REFERRAL_FRIEND_DISCOUNT_INR)} when they sign up for a
            course on Codeforces Platform.
          </p>
        </section>

        {/* Why refer + CTA */}
        <section className="border-y border-[var(--border-theme)] bg-[var(--surface-panel)] px-6 py-10 text-center md:px-10">
          <h2 className="text-2xl font-bold text-[var(--text-theme)]">
            <span className="text-green-700">Why</span> should I refer?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
            Help friends level up their careers while you earn {formatInr(REFERRAL_REWARD_INR)} per
            successful enrollment. Track commissions and payouts from your Affiliate dashboard after
            a quick KYC.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {!joined ? (
              <button
                type="button"
                onClick={joinProgram}
                className="rounded-lg bg-orange-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-800"
              >
                Join Referral Program
              </button>
            ) : (
              <button
                type="button"
                onClick={scrollToForm}
                className="rounded-lg bg-orange-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-800"
              >
                Refer Your Friend
              </button>
            )}
            <Link
              href="/affiliate"
              className="rounded-lg border border-[var(--border-theme)] bg-white px-6 py-3 text-sm font-semibold text-green-700 transition hover:border-green-400 hover:bg-green-50"
            >
              Manage payouts
            </Link>
          </div>
        </section>
      </div>

      {toast && (
        <div
          role="status"
          className={cn(
            'fixed bottom-6 right-6 z-[1100] max-w-sm rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg',
            toast.type === 'ok' ? 'bg-emerald-700' : 'bg-red-700',
          )}
        >
          {toast.text}
        </div>
      )}
    </DashboardShell>
  );
}
