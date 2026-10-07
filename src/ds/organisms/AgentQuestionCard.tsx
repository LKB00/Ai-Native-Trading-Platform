import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { cn } from "../lib/cn";
import { useFocusAfter } from "../lib/useFocusAfter";
import { CheckIcon, LockIcon } from "../lib/icons";
import { Badge } from "../atoms/Badge";
import { Button } from "../atoms/Button";

export type QuestionReason = "approach" | "information" | "sign-in" | "risky-step";
export type QuestionAnswerKind = "option" | "text" | "agent-decides" | "skipped";

export interface QuestionOption {
  id: string;
  label: string;
  /** One short line that tells the options apart. */
  description?: string;
}

export interface QuestionAnswer {
  kind: QuestionAnswerKind;
  /** Option id for "option", the typed text for "text", empty otherwise. */
  value: string;
  /** What the summary shows, such as the option label. */
  label: string;
}

export interface AgentQuestionCardLabels {
  reasons?: Partial<Record<QuestionReason, string>>;
  textLabel?: string;
  textPlaceholder?: string;
  send?: string;
  letAgentDecide?: string;
  skip?: string;
  signInHint?: string;
  answeredHeading?: string;
  agentDecided?: string;
  skipped?: string;
  change?: string;
}

export interface AgentQuestionCardProps {
  question: string;
  reason: QuestionReason;
  /** Two to four choices. More are cut to four. */
  options?: QuestionOption[];
  /** Show the free-text answer. Default true, except for sign-in questions, which never ask for a secret in text. */
  allowText?: boolean;
  /** Answer (controlled). Omit while open. */
  answer?: QuestionAnswer | null;
  onAnswer?: (answer: QuestionAnswer) => void;
  /** Called when the person chooses Change on the summary. */
  onReopen?: () => void;
  /** Name of the run that asked. */
  runName?: string;
  labels?: AgentQuestionCardLabels;
  className?: string;
}

const reasonDefaults: Record<QuestionReason, string> = {
  approach: "Choose an approach", information: "Needs information", "sign-in": "Needs a sign-in or secret", "risky-step": "Confirm a risky step",
};

/**
 * The agent asks a question in the middle of a task. A reason chip says why it is asking, option
 * buttons give quick answers, and a text box allows any other answer. "Let the agent decide" and
 * "Skip" are always there. After an answer the card shrinks to a one-line summary. This is a place where
 * amber is allowed, because the agent is waiting for a person.
 */
export function AgentQuestionCard({ question, reason, options = [], allowText, answer, onAnswer, onReopen, runName, labels, className }: AgentQuestionCardProps) {
  const l = {
    textLabel: "Or type your own answer", textPlaceholder: "Type an answer", send: "Send", letAgentDecide: "Let the agent decide", skip: "Skip",
    signInHint: "Never type a password or code here. Sign in in the window the agent opened, then choose an option.",
    answeredHeading: "You answered", agentDecided: "You let the agent decide", skipped: "You skipped this question", change: "Change", ...labels,
  };
  const reasonText = { ...reasonDefaults, ...labels?.reasons }[reason];
  const [inner, setInner] = useState<QuestionAnswer | null>(null);
  const [text, setText] = useState("");
  const uid = useId();
  const current = answer !== undefined ? answer : inner;
  const showText = allowText ?? reason !== "sign-in";
  const shown = options.slice(0, 4);

  const box = useRef<HTMLElement>(null);
  const byUs = useRef(false);
  // The buttons pressed here are replaced (answer becomes a summary, Change brings the question back), so focus moves to the card.
  const arm = useFocusAfter(current, () => box.current);
  useEffect(() => { if (!current) byUs.current = false; }, [current]);
  const give = (a: QuestionAnswer) => { byUs.current = true; arm(); if (answer === undefined) setInner(a); onAnswer?.(a); };
  const reopen = () => { arm(); if (answer === undefined) setInner(null); onReopen?.(); };
  const submit = (e: FormEvent) => { e.preventDefault(); const t = text.trim(); if (t) give({ kind: "text", value: t, label: t }); };

  const summary = !current ? "" : current.kind === "agent-decides" ? l.agentDecided : current.kind === "skipped" ? l.skipped : `${l.answeredHeading}: ${current.label}`;
  // One live region that stays mounted, so an answer given elsewhere is announced. An answer given here is not
  // announced twice: focus moves to the summary instead.
  const live = <p role="status" aria-live="polite" className="sr-only">{current && !byUs.current ? summary : ""}</p>;

  if (current) {
    return (
      <>
        <section ref={box} tabIndex={-1} aria-label={`${question}: ${summary}`} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-line bg-surface px-4 py-3", className)}>
          <CheckIcon className="shrink-0 text-success" />
          <div className="min-w-0 flex-1 basis-48">
            <p className="truncate text-xs text-fg-muted">{question}</p>
            <p className="text-sm font-medium break-words">{summary}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={reopen}>{l.change}</Button>
        </section>
        {live}
      </>
    );
  }

  return (
    <>
    <section ref={box} tabIndex={-1} aria-labelledby={`${uid}-q`} className={cn("rounded-2xl border border-attention bg-surface p-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="warning">{reason === "sign-in" && <LockIcon width={11} height={11} />}{reasonText}</Badge>
        {runName && <span className="text-xs text-fg-muted">{runName}</span>}
      </div>
      <p id={`${uid}-q`} className="mt-2 text-sm font-medium break-words">{question}</p>
      {reason === "sign-in" && <p className="mt-1 text-xs text-fg-muted">{l.signInHint}</p>}

      {shown.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {shown.map((o) => (
            <li key={o.id}>
              <button type="button" onClick={() => give({ kind: "option", value: o.id, label: o.label })}
                className="h-full w-full cursor-pointer rounded-xl border border-line bg-surface px-3 py-2 text-left hover:border-line-strong hover:bg-bg">
                <span className="block text-sm font-medium">{o.label}</span>
                {o.description && <span className="mt-0.5 block text-xs text-fg-muted">{o.description}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showText && (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor={`${uid}-t`} className="w-full text-xs font-medium text-fg-muted">{l.textLabel}</label>
          <input id={`${uid}-t`} value={text} onChange={(e) => setText(e.target.value)} placeholder={l.textPlaceholder}
            className="h-9 min-w-0 flex-1 basis-40 rounded-full border border-line bg-surface px-4 text-sm placeholder:text-fg-subtle" />
          <Button type="submit" disabled={!text.trim()}>{l.send}</Button>
        </form>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => give({ kind: "agent-decides", value: "", label: l.letAgentDecide })}>{l.letAgentDecide}</Button>
        <Button variant="ghost" size="sm" onClick={() => give({ kind: "skipped", value: "", label: l.skip })}>{l.skip}</Button>
      </div>
    </section>
    {live}
    </>
  );
}
