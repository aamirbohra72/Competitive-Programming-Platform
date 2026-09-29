export function AffiliateChartPlaceholder() {
  return (
    <section className="rounded-lg border border-[var(--border-theme)] bg-white p-6">
      <h2 className="text-lg font-semibold text-[var(--text-theme)]">Month-wise course sales</h2>
      <div
        className="mt-4 flex h-48 items-center justify-center rounded-lg bg-[var(--surface-panel)] text-center text-sm text-[var(--text-muted)]"
        role="img"
        aria-label="Chart placeholder — connect analytics to render sales over time"
      >
        Chart will load when sales data is available.
      </div>
    </section>
  );
}
