export function AffiliateStudentsTable() {
  return (
    <section className="rounded-lg border border-[var(--border-theme)] bg-white p-6">
      <h2 className="text-lg font-semibold text-[var(--text-theme)]">Enrolled students</h2>
      <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border-theme)]">
        <table className="w-full min-w-[480px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-theme)] bg-green-50">
              <th className="px-3 py-2 font-semibold uppercase tracking-wide text-[var(--text-muted)]">Student</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wide text-[var(--text-muted)]">Status</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wide text-[var(--text-muted)]">Earned</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wide text-[var(--text-muted)]">Commission</th>
            </tr>
          </thead>
        </table>
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-[var(--text-muted)]">
          <span className="text-2xl" aria-hidden>
            🔒
          </span>
          <p className="max-w-sm text-sm">
            No referrals yet. Share your links — when students enroll, they will show up here.
          </p>
        </div>
      </div>
    </section>
  );
}
