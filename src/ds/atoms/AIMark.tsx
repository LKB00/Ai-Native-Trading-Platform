import { Sparkles } from "lucide-react";
import type { SVGProps } from "react";

export interface AIMarkProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height" | "title"> {
  /** Pixel size. Use 16 beside 12px text, 18 beside 14px text, 22 beside 16px text, 24 and 32 for standalone use. */
  size?: 16 | 18 | 22 | 24 | 32;
  /** Accessible name. Omit for a decorative mark that sits next to text. When set, the mark becomes an image with this name. */
  title?: string;
}

/**
 * The AI mark: Lucide's sparkles, the same family as every other icon in the product.
 * Pair it with text when the action is specific; on its own it only says "made by AI".
 */
export function AIMark({ size = 18, title, ...rest }: AIMarkProps) {
  return (
    <Sparkles
      size={size} strokeWidth={1.5}
      role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false"
      {...(rest as object)}
    />
  );
}
