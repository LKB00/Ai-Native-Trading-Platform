import type { ReactNode } from "react";
import { ShimmerText } from "../atoms/ShimmerText";
import { Collapsible } from "./Collapsible";

/** Collapsed-by-default reasoning. Shimmers while active, shows duration when done. */
export function ThinkingBlock({ active, seconds, children }: { active?: boolean; seconds?: number; children: ReactNode }) {
  return (
    <Collapsible
      defaultOpen={false}
      header={active ? <ShimmerText>Thinking…</ShimmerText> : <span className="text-sm text-fg-muted">Thought for {seconds ?? 0}s</span>}
    >
      <div className="mt-2 ml-2 border-l-2 border-line pl-4 text-sm leading-relaxed text-fg-muted">{children}</div>
    </Collapsible>
  );
}
