import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { useFocusAfter } from "../lib/useFocusAfter";
import { CheckIcon, ShieldIcon, XIcon } from "../lib/icons";
import { Badge } from "../atoms/Badge";
import { Button } from "../atoms/Button";
import { KeyHint } from "../atoms/KeyHint";

export type PermissionChoice = "once" | "session" | "always" | "deny";
export type PermissionState = "pending" | "allowed-once" | "allowed-session" | "allowed-rule" | "denied";

export interface PermissionDecision {
  choice: PermissionChoice;
  /** The optional note the person added, trimmed. Empty when none. */
  note: string;
}

export interface PermissionPromptLabels {
  once?: string;
  /** Text of the session choice. */
  session?: string;
  /** Receives the rule scope, such as `npm test *`. */
  always?: (scope: string) => ReactNode;
  deny?: string;
  confirm?: string;
  addNote?: string;
  noteHint?: string;
  notePlaceholder?: string;
  scopeHeading?: string;
}

export interface PermissionPromptProps {
  /** Kind of action, such as "Bash command" or "Fetch a web page". Also the dialog name. */
  tool: string;
  /** Plain description of what the action does. */
  description: string;
  /** The literal command or target. Pass an array to list each subcommand of a compound command. */
  target: string | string[];
  /** Why the person is being asked. */
  reason?: string;
  /** Name of the subagent that asked, shown when the request comes from a background task. */
  requestedBy?: string;
  /** Scope of the rule saved by "Allow always", such as `npm test *`. Omit to offer only a one-time approval. */
  ruleScope?: string;
  /** What "Allow for this session" covers, such as `Emails to team@example.com`. Adds a middle choice that lasts until the session ends. Omit to hide it. */
  sessionScope?: string;
  /** Exactly what a saved rule covers, one entry per rule. Shown while the always option is selected. */
  ruleCovers?: string[];
  /** Where and how long a saved rule lasts, such as "Saved for this repository". */
  ruleLifetime?: string;
  /** Explains why only a one-time approval is offered. Shown when ruleScope is omitted. */
  onceOnlyReason?: string;
  /** State (controlled). */
  state?: PermissionState;
  onStateChange?: (state: PermissionState) => void;
  onDecide?: (decision: PermissionDecision) => void;
  /** Move focus to the options when the prompt mounts. Use only when the agent is blocked until the person answers. */
  autoFocus?: boolean;
  labels?: PermissionPromptLabels;
  className?: string;
}

const fromChoice: Record<PermissionChoice, PermissionState> = { once: "allowed-once", session: "allowed-session", always: "allowed-rule", deny: "denied" };

/**
 * Permission request for one tool action. It shows the literal command, a reason, and three choices:
 * allow once, allow always for a named scope, or deny. A saved rule lists exactly what it covers, and
 * the person can add a note to the decision. Unlike ApprovalPrompt it offers scoped persistence and amendment.
 * While focus is inside the prompt, Escape denies and N opens the note field. Tab keeps its normal focus meaning.
 */
export function PermissionPrompt({
  tool, description, target, reason = "This command requires approval", requestedBy, sessionScope, ruleScope, ruleCovers, ruleLifetime, onceOnlyReason,
  state, onStateChange, onDecide, autoFocus = false, labels, className,
}: PermissionPromptProps) {
  const l = {
    once: "Allow once", session: "Allow for this session", deny: "Deny", confirm: "Confirm", addNote: "Add a note",
    noteHint: "Optional. Your note is sent with this decision.", notePlaceholder: "For example: run it in the staging folder only",
    scopeHeading: "A saved rule covers", ...labels,
  };
  const [inner, setInner] = useState<PermissionState>("pending");
  const [choice, setChoice] = useState<PermissionChoice>("once");
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [decided, setDecided] = useState<PermissionDecision | null>(null);
  const current = state ?? inner;
  const uid = useId();
  const firstRadio = useRef<HTMLInputElement>(null);
  const noteInput = useRef<HTMLInputElement>(null);
  const focusNote = useRef(false);
  const targets = Array.isArray(target) ? target : [target];
  const resultBox = useRef<HTMLElement>(null);
  const byUs = useRef(false);
  // The options disappear once a choice is confirmed. Focus moves to the result, which names the decision.
  const arm = useFocusAfter(current, () => resultBox.current);
  useEffect(() => { if (current === "pending") byUs.current = false; }, [current]);

  useEffect(() => { if (autoFocus) firstRadio.current?.focus(); }, [autoFocus]);
  useEffect(() => { if (noteOpen && focusNote.current) { focusNote.current = false; noteInput.current?.focus(); } }, [noteOpen]);

  const options: { value: PermissionChoice; label: ReactNode }[] = [
    { value: "once", label: l.once },
    ...(sessionScope ? [{ value: "session" as const, label: l.session }] : []),
    ...(ruleScope ? [{ value: "always" as const, label: l.always ? l.always(ruleScope) : <>Allow always for <code className="font-mono text-[13px]">{ruleScope}</code></> }] : []),
    { value: "deny", label: l.deny },
  ];

  const submit = (picked: PermissionChoice = choice) => {
    const d = { choice: picked, note: note.trim() };
    byUs.current = true;
    arm();
    setDecided(d);
    const s = fromChoice[picked];
    if (state === undefined) setInner(s);
    onStateChange?.(s);
    onDecide?.(d);
  };

  /** Escape is the same as choosing Deny and confirming. N opens the note field unless the person is typing. */
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.defaultPrevented || e.nativeEvent.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "Escape") { e.preventDefault(); setChoice("deny"); submit("deny"); return; }
    if (e.key.toLowerCase() === "n" && !e.shiftKey) {
      const t = e.target as HTMLElement;
      if (t.tagName === "TEXTAREA" || t.isContentEditable || (t.tagName === "INPUT" && (t as HTMLInputElement).type !== "radio")) return;
      e.preventDefault();
      focusNote.current = true;
      if (noteOpen) { focusNote.current = false; noteInput.current?.focus(); } else setNoteOpen(true);
    }
  };

  const resultText: Record<Exclude<PermissionState, "pending">, string> = {
    "allowed-once": "Allowed once",
    "allowed-session": "Allowed for this session",
    "allowed-rule": ruleScope ? `Allowed with a saved rule for ${ruleScope}` : "Allowed with a saved rule",
    denied: "Denied",
  };

  // One live region that stays mounted, so a decision made elsewhere is announced when its text arrives.
  // A decision made here is not announced twice: focus moves to the result instead.
  const live = <p role="status" aria-live="polite" className="sr-only">{current !== "pending" && !byUs.current ? resultText[current] : ""}</p>;

  if (current !== "pending") {
    const ok = current !== "denied";
    return (
      <>
        <section ref={resultBox} tabIndex={-1} aria-label={`${tool}: ${resultText[current]}`} className={cn("rounded-2xl border border-line bg-surface p-4", className)}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={ok ? "success" : "danger"}>{ok ? <CheckIcon width={11} height={11} /> : <XIcon width={11} height={11} />}{resultText[current]}</Badge>
            <span className="text-sm font-medium">{tool}</span>
          </div>
          <p className="mt-2 text-sm text-fg-muted">{description}</p>
          <pre tabIndex={0} className="mt-2 overflow-x-auto rounded-xl bg-code p-3 font-mono text-xs leading-5 text-code-fg">{targets.join("\n")}</pre>
          {decided?.note && <p className="mt-2 text-xs text-fg-muted">Your note: {decided.note}</p>}
        </section>
        {live}
      </>
    );
  }

  return (
    <>
    <section aria-label={`Permission needed: ${tool}`} onKeyDown={onKeyDown} className={cn("rounded-2xl border border-line bg-surface p-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <ShieldIcon className="text-fg-muted" />
        <p className="font-sans text-sm font-medium">{tool}</p>
        {requestedBy && <Badge>From {requestedBy}</Badge>}
      </div>
      <p className="mt-1.5 text-sm text-fg-muted">{description}</p>
      <div className="mt-3 space-y-1.5">
        {targets.map((t, i) => (
          <pre key={i} tabIndex={0} className="overflow-x-auto rounded-xl bg-code p-3 font-mono text-xs leading-5 text-code-fg"><code>{t}</code></pre>
        ))}
      </div>
      <p className="mt-2 text-xs font-medium text-fg" id={`${uid}-reason`}>{reason}</p>

      <fieldset className="mt-3" aria-describedby={`${uid}-reason`}>
        <legend className="sr-only">Choose how to respond to this request</legend>
        <div className="space-y-1">
          {options.map((o, i) => (
            <label key={o.value} className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-[1.5px]", choice === o.value ? "border-line-strong bg-sunken" : "border-transparent hover:bg-hover")}>
              <input ref={i === 0 ? firstRadio : undefined} type="radio" name={`${uid}-choice`} value={o.value} checked={choice === o.value}
                onChange={() => setChoice(o.value)} aria-keyshortcuts={o.value === "deny" ? "Escape" : undefined} className="size-4 shrink-0 accent-[var(--accent)]" />
              <span className="flex-1">{o.label}</span>
              {o.value === "deny" && <span aria-hidden><KeyHint>Esc</KeyHint></span>}
            </label>
          ))}
        </div>
        {!ruleScope && onceOnlyReason && <p className="mt-1.5 px-3 text-xs text-fg-subtle">{onceOnlyReason}</p>}
      </fieldset>

      {choice === "session" && sessionScope && (
        <div className="mt-2 rounded-xl border border-line bg-sunken p-3" id={`${uid}-session`}>
          <p className="text-xs font-medium">Covers until this session ends</p>
          <p className="mt-1.5"><code className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-xs">{sessionScope}</code></p>
        </div>
      )}

      {choice === "always" && ruleScope && (
        <div className="mt-2 rounded-xl border border-line bg-sunken p-3" id={`${uid}-scope`}>
          <p className="text-xs font-medium">{l.scopeHeading}{ruleLifetime ? `. ${ruleLifetime}` : ""}</p>
          <ul className="mt-1.5 space-y-1">
            {(ruleCovers?.length ? ruleCovers : [ruleScope]).map((c) => (
              <li key={c}><code className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-xs">{c}</code></li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <button type="button" aria-expanded={noteOpen} aria-controls={`${uid}-note`} onClick={() => setNoteOpen(!noteOpen)} aria-keyshortcuts="N"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-1 text-xs font-medium text-fg-muted hover:text-fg"><span className="underline underline-offset-2">{l.addNote}</span><span aria-hidden><KeyHint>N</KeyHint></span></button>
        {noteOpen && (
          <div id={`${uid}-note`} className="mt-1.5">
            <label className="sr-only" htmlFor={`${uid}-note-input`}>{l.addNote}</label>
            <input ref={noteInput} id={`${uid}-note-input`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={l.notePlaceholder} aria-describedby={`${uid}-note-hint`}
              className="h-9 w-full rounded-full border border-line bg-surface px-4 text-sm placeholder:text-fg-subtle" />
            <p id={`${uid}-note-hint`} className="mt-1 px-3 text-xs text-fg-subtle">{l.noteHint}</p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <Button onClick={() => submit()}>{l.confirm}</Button>
      </div>
    </section>
    {live}
    </>
  );
}
