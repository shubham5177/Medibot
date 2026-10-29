"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearSavedConversations, loadConversations, loadSavePreference, loadTheme, saveConversations, saveSavePreference, saveTheme,
} from "@/lib/storage";
import type { ApiError, CategorySummary, ChatMessageData, ChatResponse, Conversation } from "@/types/healthcare";
import { ChatWindow } from "./ChatWindow";
import { Sidebar } from "./Sidebar";

const uid = () => crypto.randomUUID();

interface Props {
  categories: CategorySummary[];
  datasetReady: boolean;
}

export function ChatApp({ categories, datasetReady }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [saveHistory, setSaveHistory] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const hydrated = useRef(false);

  // Restore theme and (opt-in) on-device history after mount.
  useEffect(() => {
    setTheme(loadTheme());
    const save = loadSavePreference();
    setSaveHistory(save);
    if (save) setConversations(loadConversations());
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (hydrated.current && saveHistory) saveConversations(conversations);
  }, [conversations, saveHistory]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const messages = active?.messages ?? [];
  const busy = busyId !== null && busyId === activeId;

  const updateConversation = useCallback((id: string, fn: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));
  }, []);

  const append = useCallback((id: string, msg: ChatMessageData) => {
    updateConversation(id, (c) => ({ ...c, messages: [...c.messages, msg], updatedAt: Date.now() }));
  }, [updateConversation]);

  const ask = useCallback(async (convId: string, text: string) => {
    setBusyId(convId);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
      const data = (await res.json()) as ChatResponse | ApiError;
      if (!res.ok || "error" in data) {
        const msg = "error" in data ? data.error : "Something went wrong.";
        append(convId, { id: uid(), role: "assistant", content: msg, createdAt: Date.now(), isError: true });
      } else {
        append(convId, { id: data.id, role: "assistant", content: data.answer, createdAt: Date.now(), response: data });
      }
    } catch {
      append(convId, {
        id: uid(), role: "assistant", createdAt: Date.now(), isError: true,
        content: "I couldn't reach the server. Check your connection and try again. If this could be an emergency, call 112.",
      });
    } finally {
      setBusyId(null);
    }
  }, [append]);

  const send = useCallback((text: string) => {
    const content = text.trim();
    if (!content || busyId) return;
    const now = Date.now();
    const userMsg: ChatMessageData = { id: uid(), role: "user", content, createdAt: now };
    const convId = activeId ?? uid();
    if (!activeId) setActiveId(convId);
    setConversations((prev) =>
      prev.some((c) => c.id === convId)
        ? prev.map((c) => (c.id === convId ? { ...c, messages: [...c.messages, userMsg], updatedAt: now } : c))
        : [{ id: convId, title: content.length > 42 ? `${content.slice(0, 42)}…` : content, messages: [userMsg], updatedAt: now }, ...prev],
    );
    setSidebarOpen(false);
    void ask(convId, content);
  }, [activeId, ask, busyId]);

  const retry = useCallback(() => {
    if (!active || busyId) return;
    const lastUser = [...active.messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    updateConversation(active.id, (c) => ({ ...c, messages: c.messages.filter((m, i) => !(m.isError && i === c.messages.length - 1)) }));
    void ask(active.id, lastUser.content);
  }, [active, ask, busyId, updateConversation]);

  const rate = useCallback((messageId: string, value: "up" | "down") => {
    if (!activeId) return;
    const target = messages.find((m) => m.id === messageId);
    const recordId = target?.response?.recordId ?? null;
    updateConversation(activeId, (c) => ({
      ...c,
      messages: c.messages.map((m) => (m.id === messageId ? { ...m, feedback: m.feedback === value ? undefined : value } : m)),
    }));
    // Anonymous: only the message id, the dataset record id and the vote are sent.
    void fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId, recordId, helpful: value === "up" }) }).catch(() => undefined);
  }, [activeId, messages, updateConversation]);

  const newChat = () => { setActiveId(null); setActiveCategory(null); setSidebarOpen(false); };
  const openCategory = (category: string) => { setActiveId(null); setActiveCategory(category); setSidebarOpen(false); };
  const clearChat = () => { if (activeId) updateConversation(activeId, (c) => ({ ...c, messages: [], updatedAt: Date.now() })); };

  const deleteChat = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === activeId) setActiveId(null);
  };

  const deleteAll = () => {
    if (!window.confirm("Delete all chats? This cannot be undone.")) return;
    setConversations([]);
    setActiveId(null);
    clearSavedConversations();
  };

  const toggleSave = () => {
    const next = !saveHistory;
    setSaveHistory(next);
    saveSavePreference(next);
    if (next) saveConversations(conversations);
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    saveTheme(next);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return list;
    return list.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)));
  }, [conversations, search]);

  const categoryDetail = categories.find((c) => c.category === activeCategory) ?? null;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-canvas">
      <Sidebar
        conversations={filtered}
        activeId={activeId}
        categories={categories}
        activeCategory={activeCategory}
        search={search}
        saveHistory={saveHistory}
        open={sidebarOpen}
        onSearch={setSearch}
        onNew={newChat}
        onSelect={(id) => { setActiveId(id); setActiveCategory(null); setSidebarOpen(false); }}
        onDelete={deleteChat}
        onDeleteAll={deleteAll}
        onCategory={openCategory}
        onToggleSave={toggleSave}
        onClose={() => setSidebarOpen(false)}
      />
      <ChatWindow
        messages={messages}
        busy={busy}
        datasetReady={datasetReady}
        activeCategory={categoryDetail}
        theme={theme}
        onSend={send}
        onRate={rate}
        onRetry={retry}
        onClear={clearChat}
        onToggleTheme={toggleTheme}
        onOpenSidebar={() => setSidebarOpen(true)}
      />
    </div>
  );
}
