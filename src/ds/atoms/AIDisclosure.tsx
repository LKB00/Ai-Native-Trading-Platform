import type { ReactNode } from "react";

export function AIDisclosure({ children }: { children?: ReactNode }) {
  return <p className="text-center text-xs text-fg-subtle">{children ?? "AI can make mistakes. Check important information."}</p>;
}
