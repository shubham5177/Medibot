import { MessageCircleQuestion } from "lucide-react";

interface Props {
  questions: string[];
  onPick: (question: string) => void;
  disabled?: boolean;
  heading?: string;
}

export function SuggestedQuestions({ questions, onPick, disabled, heading }: Props) {
  if (questions.length === 0) return null;
  return (
    <section aria-label={heading ?? "Suggested questions"}>
      {heading && <h2 className="mb-2 text-sm font-semibold text-ink">{heading}</h2>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {questions.map((q) => (
          <li key={q}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(q)}
              className="flex w-full items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-left text-sm text-ink transition-colors hover:border-brand hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
              <span>{q}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
