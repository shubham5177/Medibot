"use client";

import { HeartPulse, MessageSquare, Plus, Search, Trash2, X } from "lucide-react";
import type { CategorySummary, Conversation } from "@/types/healthcare";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  categories: CategorySummary[];
  activeCategory: string | null;
  search: string;
  saveHistory: boolean;
  open: boolean;
  onSearch: (value: string) => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onCategory: (category: string) => void;
  onToggleSave: () => void;
  onClose: () => void;
}

export function Sidebar(p: Props) {
  return (
    <>
      {p.open && <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={p.onClose} aria-hidden />}
      <aside
        aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-[19rem] max-w-[88vw] flex-col border-r border-line bg-sunk transition-transform duration-200 lg:static lg:z-auto lg:w-72 lg:max-w-none lg:translate-x-0 ${p.open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-on"><HeartPulse className="h-5 w-5" aria-hidden /></span>
            <span className="font-display text-xl font-semibold text-ink">MediBot</span>
          </div>
          <button type="button" onClick={p.onClose} aria-label="Close menu" className="rounded-lg p-2 text-ink hover:bg-line/50 lg:hidden"><X className="h-5 w-5" aria-hidden /></button>
        </div>

        <div className="px-3">
          <button type="button" onClick={p.onNew} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-brand-on hover:opacity-90">
            <Plus className="h-4 w-4" aria-hidden /> New chat
          </button>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor="search-chats" className="sr-only">Search conversations</label>
            <input
              id="search-chats"
              type="search"
              value={p.search}
              onChange={(e) => p.onSearch(e.target.value)}
              placeholder="Search conversations"
              className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
            />
          </div>
        </div>

        <nav className="scroll-thin mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-3" aria-label="Conversations and categories">
          <section aria-labelledby="recent-heading">
            <h2 id="recent-heading" className="mb-1.5 px-2 text-xs font-semibold text-muted">Recent chats</h2>
            {p.conversations.length === 0 ? (
              <p className="px-2 text-sm text-muted">{p.search ? "No chats match your search." : "No chats yet. Ask a question to begin."}</p>
            ) : (
              <ul className="space-y-0.5">
                {p.conversations.map((c) => (
                  <li key={c.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => p.onSelect(c.id)}
                      aria-current={c.id === p.activeId ? "true" : undefined}
                      className={`flex w-full items-center gap-2 rounded-lg py-2 pl-2.5 pr-9 text-left text-sm ${c.id === p.activeId ? "bg-surface font-medium text-ink shadow-sm" : "text-ink hover:bg-line/40"}`}
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                      <span className="truncate">{c.title}</span>
                    </button>
                    <button type="button" onClick={() => p.onDelete(c.id)} aria-label={`Delete chat: ${c.title}`} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted opacity-100 hover:bg-line/60 hover:text-danger lg:opacity-0 lg:focus-visible:opacity-100 lg:group-hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {p.categories.length > 0 && (
            <section aria-labelledby="cat-heading">
              <h2 id="cat-heading" className="mb-1.5 px-2 text-xs font-semibold text-muted">Browse by topic</h2>
              <ul className="space-y-0.5">
                {p.categories.map((c) => (
                  <li key={c.category}>
                    <button
                      type="button"
                      onClick={() => p.onCategory(c.category)}
                      aria-current={p.activeCategory === c.category ? "true" : undefined}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${p.activeCategory === c.category ? "bg-brand-soft font-medium text-brand" : "text-ink hover:bg-line/40"}`}
                    >
                      <span>{c.category}</span>
                      <span className="text-xs tabular-nums text-muted">{c.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </nav>

        <div className="space-y-2 border-t border-line px-4 py-3 text-xs text-muted">
          <label className="flex cursor-pointer items-start gap-2">
            <input type="checkbox" checked={p.saveHistory} onChange={p.onToggleSave} className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]" />
            <span>Keep chats on this device. They are never sent to a server.</span>
          </label>
          {p.conversations.length > 0 && (
            <button type="button" onClick={p.onDeleteAll} className="font-medium text-danger underline-offset-2 hover:underline">Delete all chats</button>
          )}
        </div>
      </aside>
    </>
  );
}
