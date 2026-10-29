import type { Conversation } from "../types/healthcare.ts";

/** Optional on-device chat history. Nothing here is ever sent to the server. */
const CHATS_KEY = "medibot.chats";
const SAVE_KEY = "medibot.save";
const THEME_KEY = "medibot.theme";

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export const loadSavePreference = (): boolean => safe(() => localStorage.getItem(SAVE_KEY) === "1", false);

export function saveSavePreference(on: boolean): void {
  safe(() => {
    if (on) localStorage.setItem(SAVE_KEY, "1");
    else {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(CHATS_KEY);
    }
  }, undefined);
}

export function loadConversations(): Conversation[] {
  return safe(() => {
    const parsed: unknown = JSON.parse(localStorage.getItem(CHATS_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as Conversation[]).filter((c) => c && typeof c.id === "string" && Array.isArray(c.messages)) : [];
  }, []);
}

export const saveConversations = (list: Conversation[]): void =>
  safe(() => localStorage.setItem(CHATS_KEY, JSON.stringify(list.slice(0, 50))), undefined);

export const clearSavedConversations = (): void => safe(() => localStorage.removeItem(CHATS_KEY), undefined);
export const loadTheme = (): "light" | "dark" => (document.documentElement.classList.contains("dark") ? "dark" : "light");
export const saveTheme = (t: "light" | "dark"): void => safe(() => localStorage.setItem(THEME_KEY, t), undefined);
