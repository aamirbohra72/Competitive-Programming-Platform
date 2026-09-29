'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AffiliateChartPlaceholder } from '@/components/affiliate/AffiliateChartPlaceholder';
import { AffiliateCopyField } from '@/components/affiliate/AffiliateCopyField';
import { AffiliateCourseTable, type AffiliateCourseTableRow } from '@/components/affiliate/AffiliateCourseTable';
import { AffiliateInstructions } from '@/components/affiliate/AffiliateInstructions';
import { AffiliateKycForm } from '@/components/affiliate/AffiliateKycForm';
import { AffiliateMetricCard } from '@/components/affiliate/AffiliateMetricCard';
import { AffiliatePaymentSection } from '@/components/affiliate/AffiliatePaymentSection';
import { AffiliateStudentsTable } from '@/components/affiliate/AffiliateStudentsTable';
import { AffiliateTransactionsCard } from '@/components/affiliate/AffiliateTransactionsCard';
import { DashboardShell } from '@/components/DashboardShell';
import { AFFILIATE_QUERY_KEY } from '@/data/affiliate';
import { affiliateRefFromUserId } from '@/lib/affiliate-ref';
import { getToken, getUser } from '@/lib/auth';

type OverviewCourse = {
  id: string;
  name: string;
  path: string;
  commissionPercent: number;
  soldCount: number;
};

type OverviewPayload = {
  userId: string | null;
  metrics: {
    studentsRegistered: number;
    redeemedInr: number;
    pendingInr: number;
    lockedInr: number;
    earnedInrTillDate: number;
  };
  courses: OverviewCourse[];
  siteOrigin: string;
  queryKey: string;
};

function formatInr(n: number) {
  return `${n.toLocaleString('en-IN')} INR`;
}

function approxUsd(inr: number) {
  const usd = Math.round(inr * 0.012 * 100) / 100;
  return `~$${usd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function buildCourseRows(
  courses: OverviewCourse[],
  origin: string,
  queryKey: string,
  ref: string
): AffiliateCourseTableRow[] {
  const base = origin.replace(/\/$/, '');
  return courses.map((c) => {
    const path = c.path.startsWith('/') ? c.path : `/${c.path}`;
    const url = new URL(path, base);
    url.searchParams.set(queryKey, ref);
    return {
      id: c.id,
      name: c.name,
      commissionPercent: c.commissionPercent,
      fullUrl: url.toString(),
      soldCount: c.soldCount,
    };
  });
}

export function AffiliateDashboard() {
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const token = getToken();
    const headers: HeadersInit = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      const res = await fetch('/api/affiliate/overview', { headers, cache: 'no-store' });
      if (!res.ok) {
        setLoadError('Could not load affiliate data.');
        return;
      }
      const data = (await res.json()) as OverviewPayload;
      setOverview(data);
    } catch {
      setLoadError('Network error loading affiliate data.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const user = getUser();
  const displayName = user?.username?.trim() || 'there';
  const ref = affiliateRefFromUserId(user?.id);

  const origin = useMemo(() => {
    if (typeof window !== 'undefined' && overview?.siteOrigin) {
      try {
        const u = new URL(overview.siteOrigin);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
          return window.location.origin;
        }
      } catch {
        /* fall through */
      }
    }
    if (overview?.siteOrigin) return overview.siteOrigin;
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  }, [overview?.siteOrigin]);

  const queryKey = overview?.queryKey ?? AFFILIATE_QUERY_KEY;

  const generalLink = useMemo(() => {
    if (!origin) return '';
    const u = new URL('/', origin);
    u.searchParams.set(queryKey, ref);
    return u.toString();
  }, [origin, queryKey, ref]);

  const clientFallbackLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?${queryKey}=${ref}`
      : '';

  const tableRows = useMemo(() => {
    if (!overview?.courses?.length || !origin) return [];
    return buildCourseRows(overview.courses, origin, queryKey, ref);
  }, [overview?.courses, origin, queryKey, ref]);

  const m = overview?.metrics;

  return (
    <DashboardShell mainClassName="p-4 pb-16 md:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <h1 className="text-2xl font-bold text-[var(--text-theme)] md:text-3xl">Hello, {displayName}</h1>
          <p className="mt-2 text-[var(--text-muted)]">
            You&apos;ve earned{' '}
            <span className="font-semibold text-green-700">
              {formatInr(m?.earnedInrTillDate ?? 0)}
            </span>{' '}
            to date ({approxUsd(m?.earnedInrTillDate ?? 0)}).
          </p>
          {loadError ? <p className="mt-2 text-sm text-amber-800">{loadError}</p> : null}
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Looking to invite friends?{' '}
            <Link href="/referral" className="font-semibold text-orange-700 hover:text-orange-800">
              Join the Referral Program →
            </Link>
          </p>
        </header>

        <section className="rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-theme)]">Commission you will earn</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Share tracked links — commission applies to qualifying purchases.</p>
          <div className="mt-4 max-w-2xl">
            <AffiliateCopyField
              label="General site link"
              value={generalLink || clientFallbackLink || '…'}
            />
          </div>
          <div className="mt-6">
            <AffiliateCourseTable rows={tableRows} errorMessage={loadError} />
          </div>
        </section>

        <AffiliateInstructions />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AffiliateMetricCard
            title="Total students registered"
            value={`${m?.studentsRegistered ?? 0} students`}
            valueClassName="text-sky-700"
          />
          <AffiliateMetricCard
            title="Total redeemed amount"
            value={formatInr(m?.redeemedInr ?? 0)}
            subtitle={`Converted value in USD is ${approxUsd(m?.redeemedInr ?? 0)}`}
            valueClassName="text-green-700"
          />
          <AffiliateMetricCard
            title="Total pending amount"
            value={formatInr(m?.pendingInr ?? 0)}
            subtitle={`Converted value in USD is ${approxUsd(m?.pendingInr ?? 0)}`}
            valueClassName="text-pink-700"
          />
          <AffiliateMetricCard
            title="Total locked amount"
            value={`${formatInr(m?.lockedInr ?? 0)} (${approxUsd(m?.lockedInr ?? 0)})`}
            subtitle="Locked commissions clear after refund windows close."
            valueClassName="text-amber-700"
          />
        </div>

        <AffiliateChartPlaceholder />

        <AffiliateKycForm />

        <AffiliatePaymentSection />

        <div className="grid gap-6 lg:grid-cols-2">
          <AffiliateStudentsTable />
          <AffiliateTransactionsCard />
        </div>
      </div>
    </DashboardShell>
  );
}
