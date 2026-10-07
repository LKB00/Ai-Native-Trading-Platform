import type { ReactNode } from "react";
import { Callout } from "./Callout";

/** Refusals are not errors: neutral tone, explain the boundary, offer an alternative. */
export function RefusalNotice({ reason, alternative }: { reason: string; alternative?: ReactNode }) {
  return (
    <Callout tone="info" title="I can't help with that">
      <p>{reason}</p>
      {alternative && <p className="mt-1">{alternative}</p>}
    </Callout>
  );
}
