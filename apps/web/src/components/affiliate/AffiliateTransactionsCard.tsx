export function AffiliateTransactionsCard() {
  return (
    <section className="rounded-lg border border-[var(--border-theme)] bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-theme)]">Transaction history</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Payouts and commission releases.</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-100"
          disabled
          title="Available when balance exceeds threshold"
        >
          Ask for payout
        </button>
      </div>
      <div className="mt-8 flex flex-col items-center justify-center py-10 text-center text-sm text-[var(--text-muted)]">
        <p className="max-w-md">
          No payout history yet. Share courses with your network — your commission timeline will appear here.
        </p>
      </div>
    </section>
  );
}
