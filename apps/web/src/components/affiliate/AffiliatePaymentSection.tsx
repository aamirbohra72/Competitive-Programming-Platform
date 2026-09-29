export function AffiliatePaymentSection() {
  return (
    <section className="rounded-lg border border-[var(--border-theme)] bg-white p-6">
      <h2 className="text-lg font-semibold text-[var(--text-theme)]">Payment methods</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Manage your payout details.</p>
      <div className="mt-6 flex min-h-[140px] items-center justify-center rounded-lg border border-dashed border-[var(--border-theme)] bg-[var(--surface-panel)]">
        <button
          type="button"
          className="rounded-lg border border-[var(--border-theme)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text-theme)] transition hover:bg-green-50"
          disabled
          title="Coming soon"
        >
          + Add payment method
        </button>
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">Payout method onboarding will be available after your affiliate account is approved.</p>
    </section>
  );
}
