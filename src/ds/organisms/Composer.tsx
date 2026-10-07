import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { PaperclipIcon, SendIcon, StopIcon } from "../lib/icons";
import { IconButton } from "../atoms/Button";

export interface ComposerProps {
  onSend: (text: string) => void;
  /** While true the send button becomes Stop and calls onStop. */
  generating?: boolean;
  onStop?: () => void;
  placeholder?: string;
  maxLength?: number;
  /** Called when Attach file is pressed. The attach button renders only when this is provided. */
  onAttach?: () => void;
  /** Extra controls (model picker, tools toggle) rendered left of the send button. */
  tools?: ReactNode;
  disabled?: boolean;
}

export function Composer({ onSend, generating, onStop, onAttach, placeholder = "Message the assistant…", maxLength = 4000, tools, disabled }: ComposerProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  const canSend = value.trim().length > 0 && !disabled;

  const submit = () => {
    if (!canSend || generating) return;
    onSend(value.trim());
    setValue("");
    if (ref.current) ref.current.style.height = "auto";
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter newline. Never send mid IME composition.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
  };
  const grow = (el: HTMLTextAreaElement) => { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 200)}px`; };
  const nearLimit = value.length > maxLength * 0.9;

  return (
    <div className={cn("rounded-2xl border border-line-strong bg-surface shadow-sm transition-shadow focus-within:border-fg-subtle focus-within:shadow-md has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-[var(--focus-ring)]", disabled && "opacity-60")}>
      <label htmlFor={inputId} className="sr-only">Message</label>
      <textarea
        id={inputId} ref={ref} rows={1} value={value} maxLength={maxLength} disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => { setValue(e.target.value); grow(e.target); }}
        onKeyDown={onKey}
        className="block w-full resize-none bg-transparent px-5 pt-4 pb-1 text-[15px] leading-relaxed outline-none placeholder:text-fg-subtle"
      />
      <div className="flex flex-wrap items-center gap-1.5 px-2.5 pb-2.5">
        {onAttach && <IconButton label="Attach file" size="sm" variant="secondary" onClick={onAttach}><PaperclipIcon /></IconButton>}
        {tools}
        <span className="ml-auto flex items-center gap-1.5">
        {nearLimit && <span className="mr-2 text-xs text-warning-fg" aria-live="polite">{value.length}/{maxLength}</span>}
        {generating
          ? <IconButton label="Stop generating" variant="secondary" onClick={onStop}><StopIcon /></IconButton>
          : <IconButton label="Send message" variant="lime" disabled={!canSend} onClick={submit}><SendIcon /></IconButton>}
        </span>
      </div>
    </div>
  );
}
