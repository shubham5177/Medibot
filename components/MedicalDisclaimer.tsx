import { Info } from "lucide-react";
import { DISCLAIMER } from "@/lib/safety";

export function MedicalDisclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="flex items-start gap-1.5 text-xs leading-snug text-muted" role="note">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          {DISCLAIMER} In India, call <a className="font-semibold underline" href="tel:112">112</a>.
          Questions that the dataset cannot answer are sent to OpenAI when that optional service is configured.
        </span>
      </p>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm leading-relaxed text-muted" role="note">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
      <p>{DISCLAIMER} Questions that the dataset cannot answer are sent to OpenAI when that optional service is configured.</p>
    </div>
  );
}
