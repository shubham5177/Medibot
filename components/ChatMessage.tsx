"use client";

import { AlertTriangle, Check, Copy, Phone, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import type { ChatMessageData, Urgency } from "@/types/healthcare";
import { SourceReference } from "./SourceReference";

interface Props {
  message: ChatMessageData;
  onRate: (messageId: string, value: "up" | "down") => void;
  onAsk: (question: string) => void;
  onRetry?: () => void;
  busy: boolean;
}

const URGENCY_LABEL: Record<Urgency, string | null> = {
  routine: null,
  monitor: "Keep an eye on symptoms",
  "see-doctor": "Consider seeing a doctor",
  emergency: "Emergency guidance",
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function ChatMessage({ message, onRate, onAsk, onRetry, busy }: Props) {
  const [copied, setCopied] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[15px] leading-relaxed text-brand-on sm:max-w-[75%]">
          {message.content}
        </p>
      </div>
    );
  }

  const r = message.response;
  const emergency = r?.urgency === "emergency";
  const label = r ? URGENCY_LABEL[r.urgency] : null;

  const handleCopy = async () => {
    if (await copyText(message.content)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="flex justify-start">
      <article
        aria-label="MediBot reply"
        className={`w-full max-w-[92%] rounded-2xl rounded-bl-md border p-4 sm:max-w-[82%] ${
          message.isError ? "border-danger/40 bg-danger-soft" : emergency ? "border-danger/50 bg-danger-soft" : "border-line bg-surface"
        }`}
      >
        {(r?.category || label) && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-medium">
            {emergency && <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />}
            {label && (
              <span className={`rounded-full px-2 py-0.5 ${emergency ? "bg-danger text-brand-on" : r?.urgency === "see-doctor" ? "bg-warn-soft text-warn" : "bg-brand-soft text-brand"}`}>
                {label}
              </span>
            )}
            {r?.category && <span className="rounded-full bg-sunk px-2 py-0.5 text-muted">{r.category}</span>}
          </div>
        )}

        <p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-ink">{message.content}</p>

        {r?.matchType === "ai" && (
          <p className="mt-2 text-xs text-muted">AI-generated general information; not a medical diagnosis or a substitute for professional advice.</p>
        )}

        {emergency && (
          <a href="tel:112" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-brand-on hover:opacity-90">
            <Phone className="h-4 w-4" aria-hidden /> Call 112
          </a>
        )}

        {r && r.matchType === "dataset" && <SourceReference response={r} />}

        {r && r.related.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-semibold text-ink">{r.matchType === "fallback" ? "Did you mean:" : "Related questions"}</p>
            <ul className="flex flex-wrap gap-1.5">
              {r.related.map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAsk(q.question)}
                    className="rounded-full border border-line bg-canvas px-3 py-1 text-left text-xs text-ink hover:border-brand hover:bg-brand-soft disabled:opacity-50"
                  >
                    {q.question}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1 text-muted">
          {message.isError && onRetry ? (
            <button type="button" onClick={onRetry} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-ink hover:bg-sunk disabled:opacity-50">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Try again
            </button>
          ) : (
            <>
              <button type="button" onClick={handleCopy} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs hover:bg-sunk">
                {copied ? <Check className="h-3.5 w-3.5 text-leaf" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                {copied ? "Copied" : "Copy"}
              </button>
              {r && r.matchType !== "safety" && (
                <>
                  <span className="mx-1 h-4 w-px bg-line" aria-hidden />
                  <button type="button" aria-pressed={message.feedback === "up"} onClick={() => onRate(message.id, "up")} className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs hover:bg-sunk ${message.feedback === "up" ? "bg-brand-soft text-brand" : ""}`}>
                    <ThumbsUp className="h-3.5 w-3.5" aria-hidden /> Helpful
                  </button>
                  <button type="button" aria-pressed={message.feedback === "down"} onClick={() => onRate(message.id, "down")} className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs hover:bg-sunk ${message.feedback === "down" ? "bg-warn-soft text-warn" : ""}`}>
                    <ThumbsDown className="h-3.5 w-3.5" aria-hidden /> Not helpful
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </article>
    </div>
  );
}
