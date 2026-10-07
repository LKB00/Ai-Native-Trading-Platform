import type { ReactNode } from "react";
import { Button } from "../atoms/Button";
import { Callout } from "./Callout";

/** Recoverable failure: say what happened, whether the user's input is safe, and offer a next step. */
export function ErrorState({ title = "Something went wrong", message, onRetry }: { title?: string; message: ReactNode; onRetry?: () => void }) {
  return <Callout tone="danger" title={title} action={onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Try again</Button>}>{message}</Callout>;
}
