/** Shared types for MediBot. Kept dependency-free so they can be used on client and server. */

export const CATEGORIES = [
  "General healthcare",
  "Common symptoms",
  "Nutrition and hydration",
  "Preventive healthcare",
  "Mental wellness information",
  "First aid",
  "Sleep and fitness",
  "Medication information and precautions",
  "Chronic-condition education",
  "Emergency guidance",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type Urgency = "routine" | "monitor" | "see-doctor" | "emergency";
export type ReviewStatus = "sample-unreviewed" | "reviewed";

export const URGENCIES: readonly Urgency[] = ["routine", "monitor", "see-doctor", "emergency"];

export interface HealthcareRecord {
  id: string;
  question: string;
  symptoms: string[];
  keywords: string[];
  category: Category;
  answer: string;
  source: string;
  sourceUrl?: string;
  urgency: Urgency;
  /** ISO date (YYYY-MM-DD) of the last clinical review, or null if never reviewed. */
  lastReviewed: string | null;
  reviewStatus: ReviewStatus;
}

export interface DatasetIssue {
  index: number;
  id?: string;
  severity: "error" | "warning";
  message: string;
}

export interface LoadedDataset {
  records: HealthcareRecord[];
  issues: DatasetIssue[];
  version: string;
  origin: "file" | "database";
}

export interface SourceInfo {
  name: string;
  url?: string;
}

export interface RelatedQuestion {
  id: string;
  question: string;
}

/** Consistent response from POST /api/chat. */
export interface ChatResponse {
  id: string;
  answer: string;
  category: Category | null;
  source: SourceInfo | null;
  /** 0–1. Safety responses report 1; fallbacks report the best (rejected) score. */
  confidence: number;
  urgency: Urgency;
  needsProfessionalCare: boolean;
  matchType: "dataset" | "ai" | "safety" | "fallback";
  reviewStatus: ReviewStatus | null;
  recordId: string | null;
  related: RelatedQuestion[];
}

export interface ApiError {
  error: string;
}

// ---- Client-side chat state ----
export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  response?: ChatResponse;
  isError?: boolean;
  feedback?: "up" | "down";
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessageData[];
  updatedAt: number;
}

export interface CategorySummary {
  category: Category;
  count: number;
  questions: string[];
}
