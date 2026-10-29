"use client";

import { Eraser, Menu, Moon, Sun, TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import type { CategorySummary, ChatMessageData } from "@/types/healthcare";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";
import { MedicalDisclaimer } from "./MedicalDisclaimer";
import { SuggestedQuestions } from "./SuggestedQuestions";

export const DEFAULT_PROMPTS = [
  "What are common causes of headaches?",
  "How can I maintain healthy hydration?",
  "What are some healthy sleep habits?",
  "How can I prevent dehydration?",
  "When should I seek medical attention?",
];

interface Props {
  messages: ChatMessageData[];
  busy: boolean;
  datasetReady: boolean;
  activeCategory: CategorySummary | null;
  theme: "light" | "dark";
  onSend: (text: string) => void;
  onRate: (messageId: string, value: "up" | "down") => void;
  onRetry: () => void;
  onClear: () => void;
  onToggleTheme: () => void;
  onOpenSidebar: () => void;
}

function EcgLine() {
  return (
    <svg viewBox="0 0 320 40" className="mt-3 h-8 w-64 text-brand" fill="none" aria-hidden>
      <path className="ecg-line" d="M0 22 H96 L106 22 L116 6 L128 36 L138 14 L146 22 H320" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChatWindow(p: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const empty = p.messages.length === 0;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [p.messages.length, p.busy]);

  const lastUser = [...p.messages].reverse().find((m) => m.role === "user");

  return (
    <main className="flex min-w-0 flex-1 flex-col" aria-label="Chat">
      <header className="flex items-center justify-between gap-2 border-b border-line bg-canvas px-3 py-2.5 sm:px-6">
        <div className="flex items-center gap-2">
          <button type="button" onClick={p.onOpenSidebar} aria-label="Open menu" className="rounded-lg p-2 text-ink hover:bg-sunk lg:hidden">
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <h1 className="text-sm font-semibold text-ink">{p.activeCategory ? p.activeCategory.category : "MediBot"}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={p.onClear} disabled={empty} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-ink hover:bg-sunk disabled:opacity-40">
            <Eraser className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Clear chat</span>
            <span className="sr-only sm:hidden">Clear chat</span>
          </button>
          <button type="button" onClick={p.onToggleTheme} aria-label={p.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} className="rounded-lg p-2 text-ink hover:bg-sunk">
            {p.theme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </header>

      <div className="scroll-thin flex-1 overflow-y-auto px-3 py-6 sm:px-6" aria-live="polite" aria-relevant="additions">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {!p.datasetReady && (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm text-ink">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
              <p>The health dataset could not be loaded, so MediBot can&apos;t answer questions right now. Emergency guidance still works. If this could be an emergency, call 112.</p>
            </div>
          )}

          {empty ? (
            <div className="space-y-8 py-4 sm:py-10">
              <div>
                <h2 className="font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">Hello! I&apos;m MediBot.</h2>
                <EcgLine />
                <p className="mt-4 text-lg text-ink">Your healthcare information assistant.</p>
                <p className="mt-1 max-w-xl text-muted">Ask me about general health, common symptoms, nutrition, preventive care, or first aid.</p>
              </div>
              <SuggestedQuestions
                heading={p.activeCategory ? `${p.activeCategory.category}: try asking` : "Try asking"}
                questions={p.activeCategory ? p.activeCategory.questions : DEFAULT_PROMPTS}
                onPick={p.onSend}
                disabled={p.busy || !p.datasetReady}
              />
              <MedicalDisclaimer />
            </div>
          ) : (
            p.messages.map((m, i) => (
              <ChatMessage
                key={m.id}
                message={m}
                busy={p.busy}
                onRate={p.onRate}
                onAsk={p.onSend}
                onRetry={m.isError && i === p.messages.length - 1 && lastUser ? p.onRetry : undefined}
              />
            ))
          )}

          {p.busy && (
            <div className="flex justify-start" role="status" aria-label="MediBot is searching the dataset">
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3">
                <span className="typing-dot h-2 w-2 rounded-full bg-brand" />
                <span className="typing-dot h-2 w-2 rounded-full bg-brand" />
                <span className="typing-dot h-2 w-2 rounded-full bg-brand" />
                <span className="ml-2 text-xs text-muted">Searching the dataset…</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <ChatInput onSend={p.onSend} busy={p.busy} />
    </main>
  );
}
