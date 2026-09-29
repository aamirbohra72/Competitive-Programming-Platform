'use client';

import { AffiliateCopyField } from '@/components/affiliate/AffiliateCopyField';

export type AffiliateCourseTableRow = {
  id: string;
  name: string;
  commissionPercent: number;
  fullUrl: string;
  soldCount: number;
};

export type AffiliateCourseTableProps = {
  rows: AffiliateCourseTableRow[];
  /** When set, empty rows show this instead of the loading state. */
  errorMessage?: string | null;
};

export function AffiliateCourseTable({ rows, errorMessage }: AffiliateCourseTableProps) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-[var(--border-theme)] bg-white px-4 py-10 text-center text-sm text-[var(--text-muted)]">
        {errorMessage ?? 'Loading affiliate links…'}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-theme)]">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border-theme)] bg-green-50">
            <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">Course</th>
            <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">Commission</th>
            <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">Link</th>
            <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">Sold</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[var(--border-theme)] last:border-0">
              <td className="px-4 py-3 font-medium text-[var(--text-theme)]">{row.name}</td>
              <td className="px-4 py-3 text-green-700">{row.commissionPercent}% of final price</td>
              <td className="px-4 py-3">
                <AffiliateCopyField label="" value={row.fullUrl} className="border-green-200 bg-green-50 p-2" />
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  {row.soldCount} sold
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
