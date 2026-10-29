import { ExternalLink, FlaskConical } from "lucide-react";
import type { ChatResponse } from "@/types/healthcare";

export function SourceReference({ response }: { response: ChatResponse }) {
  if (!response.source) return null;
  const { name, url } = response.source;
  return (
    <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-xs text-muted">
      <p className="flex flex-wrap items-center gap-x-1.5">
        <span className="font-semibold text-ink">Source area:</span>
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-sky underline-offset-2 hover:underline">
            {name}
            <ExternalLink className="h-3 w-3" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : (
          <span>{name}</span>
        )}
      </p>
      {response.reviewStatus === "sample-unreviewed" && (
        <p className="flex items-start gap-1.5">
          <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Sample content, not yet clinically reviewed. Check the source before relying on it.</span>
        </p>
      )}
      <p>Dataset match confidence: {Math.round(response.confidence * 100)}%</p>
    </div>
  );
}
