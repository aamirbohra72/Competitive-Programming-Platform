import { AFFILIATE_INSTRUCTIONS } from '@/data/affiliate';

export function AffiliateInstructions() {
  return (
    <section className="rounded-lg border border-[var(--border-theme)] bg-white p-6">
      <h2 className="text-lg font-semibold text-[var(--text-theme)]">Instructions for affiliate partners</h2>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[var(--text-muted)]">
        {AFFILIATE_INSTRUCTIONS.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
    </section>
  );
}
