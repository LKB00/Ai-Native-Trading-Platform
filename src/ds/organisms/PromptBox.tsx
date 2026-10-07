import { useId, useState } from "react";
import { SparkleIcon } from "../lib/icons";
import { Button } from "../atoms/Button";
import { Spinner } from "../atoms/Spinner";

export function PromptBox({ onGenerate, busy, placeholder = "Describe what you want to create…", examples = [] }: { onGenerate: (prompt: string) => void; busy?: boolean; placeholder?: string; examples?: string[] }) {
  const [v, setV] = useState("");
  const inputId = useId();
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.trim() && !busy) onGenerate(v.trim()); }} className="space-y-2">
      <div className="rounded-2xl border border-line-strong bg-surface p-2.5 shadow-sm focus-within:border-fg-subtle has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-[var(--focus-ring)]">
        <label htmlFor={inputId} className="sr-only">Prompt</label>
        <textarea id={inputId} rows={3} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder}
          className="block w-full resize-none bg-transparent p-2 text-[15px] outline-none placeholder:text-fg-subtle" />
        <div className="flex items-center justify-between px-1 pt-1">
          <span className="text-xs text-fg-subtle">{v.length} characters</span>
          <Button type="submit" variant="lime" size="sm" disabled={!v.trim() || busy} leading={busy ? <Spinner size={14} /> : <SparkleIcon width={14} height={14} />}>{busy ? "Generating…" : "Generate"}</Button>
        </div>
      </div>
      {examples.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">Try:
          {examples.map((x) => <button key={x} type="button" onClick={() => setV(x)} className="rounded-full border border-line px-2 py-0.5 hover:bg-hover">{x}</button>)}
        </p>
      )}
    </form>
  );
}
