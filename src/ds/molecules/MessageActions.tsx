import { useState } from "react";
import { CheckIcon, CopyIcon, RefreshIcon } from "../lib/icons";
import { IconButton } from "../atoms/Button";

export function MessageActions({ text, onRegenerate }: { text: string; onRegenerate?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="-ml-1.5 flex items-center gap-0.5">
      <IconButton size="sm" label={copied ? "Copied" : "Copy response"} onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
      }}>{copied ? <CheckIcon /> : <CopyIcon />}</IconButton>
      {onRegenerate && <IconButton size="sm" label="Regenerate response" onClick={onRegenerate}><RefreshIcon /></IconButton>}
    </div>
  );
}
