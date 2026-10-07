import { useState } from "react";
import { CheckIcon, CopyIcon } from "../lib/icons";

export function CodeBlock({ code, language = "text" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  };
  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-code text-code-fg">
      <figcaption className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-xs text-code-muted">
        <span className="font-mono">{language}</span>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:text-code-fg">
          {copied ? <CheckIcon width={12} height={12} /> : <CopyIcon width={12} height={12} />}
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </button>
      </figcaption>
      <pre tabIndex={0} className="overflow-x-auto p-3 font-mono text-[13px] leading-6"><code>{code}</code></pre>
    </figure>
  );
}
