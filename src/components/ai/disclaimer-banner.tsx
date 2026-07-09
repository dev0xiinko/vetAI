import { AI_ADVISORY_DISCLAIMER } from "@/lib/ai/disclaimer";

/**
 * The mandatory advisory disclaimer for every AI-facing surface. AI output is
 * decision support for a licensed vet — never a diagnosis. See ai-features.md.
 */
export function DisclaimerBanner() {
  return (
    <div
      role="note"
      className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300"
    >
      <span className="font-medium">Advisory only. </span>
      {AI_ADVISORY_DISCLAIMER}
    </div>
  );
}
