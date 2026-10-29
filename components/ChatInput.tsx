"use client";

import { SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MedicalDisclaimer } from "./MedicalDisclaimer";

const MAX = 500;

export function ChatInput({ onSend, busy }: { onSend: (text: string) => void; busy: boolean }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || busy) return;
    onSend(text);
    setValue("");
  };

  return (
    <div className="border-t border-line bg-canvas px-3 pb-3 pt-3 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm focus-within:border-brand">
          <label htmlFor="chat-input" className="sr-only">Ask a healthcare question</label>
          <textarea
            id="chat-input"
            ref={ref}
            value={value}
            rows={1}
            maxLength={MAX}
            placeholder="Ask about symptoms, nutrition, sleep, first aid…"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-ink placeholder:text-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || value.trim().length === 0}
            aria-label="Send message"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-on transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SendHorizontal className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <MedicalDisclaimer compact />
          {value.length > MAX * 0.8 && (
            <span className="shrink-0 text-xs tabular-nums text-muted" aria-live="polite">{value.length}/{MAX}</span>
          )}
        </div>
      </div>
    </div>
  );
}
