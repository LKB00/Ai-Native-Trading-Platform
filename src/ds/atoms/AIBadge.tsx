import { SparkleIcon } from "../lib/icons";
import { Badge } from "./Badge";

/** Label for any content produced by AI. Use on generated images, summaries, and drafts. */
/** Set `solid` when the badge sits on an image or another busy background. */
export function AIBadge({ label = "AI-generated", solid = false }: { label?: string; solid?: boolean }) {
  return <Badge tone={solid ? "lime" : "accent"}><SparkleIcon width={10} height={10} />{label}</Badge>;
}
