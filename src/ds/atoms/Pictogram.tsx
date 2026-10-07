import type { ReactNode } from "react";

export type PictogramName =
  | "chat" | "agent" | "document" | "image" | "code" | "data"
  | "search" | "shield" | "memory" | "voice" | "plan" | "tools";

export type PictogramSize = 32 | 48 | 64;

/** Gallery data: every pictogram name. */
export const pictogramNames: PictogramName[] = [
  "chat", "agent", "document", "image", "code", "data", "search", "shield", "memory", "voice", "plan", "tools",
];

export interface PictogramProps {
  name: PictogramName;
  /** Rendered size in px. */
  size?: PictogramSize;
  /** Accessible name. Leave it out for decorative use. */
  title?: string;
  className?: string;
}

/**
 * Drawn on a 32 x 32 grid with 1px of padding, so art stays inside 30 x 30.
 * Every shape is a stroke, never a filled outline. Color is currentColor.
 */
const art: Record<PictogramName, ReactNode> = {
  chat: <><path d="M5 5H27a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H15L9 28V22H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /><path d="M9 11H23M9 16H18" /></>,
  agent: <><circle cx="8" cy="8" r="4" /><rect x="20" y="20" width="8" height="8" rx="2" /><path d="M12 8H20a4 4 0 0 1 4 4V20" /></>,
  document: <><path d="M7 3H19L25 9V29H7Z" /><path d="M19 3V9H25M11 16H21M11 21H21M11 26H16" /></>,
  image: <><rect x="3" y="5" width="26" height="22" rx="3" /><circle cx="11" cy="12" r="3" /><path d="M3 23L11 17L17 22L22 18L29 24" /></>,
  code: <><path d="M10 9L3 16L10 23M22 9L29 16L22 23M18 6L14 26" /></>,
  data: <><path d="M3 28H29" /><rect x="5" y="16" width="5" height="12" rx="1" /><rect x="13" y="9" width="5" height="19" rx="1" /><rect x="21" y="4" width="5" height="24" rx="1" /></>,
  search: <><circle cx="14" cy="14" r="10" /><path d="M21 21L29 29" /></>,
  shield: <><path d="M16 3L27 7V15C27 22 22 27 16 29C10 27 5 22 5 15V7Z" /><path d="M11 16L15 20L22 12" /></>,
  memory: <><path d="M3 10L16 4L29 10L16 16Z" /><path d="M3 16L16 22L29 16M3 22L16 28L29 22" /></>,
  voice: <><rect x="11" y="3" width="10" height="16" rx="5" /><path d="M6 15a10 10 0 0 0 20 0M16 25V29M11 29H21" /></>,
  plan: <><path d="M4 8L7 11L12 5M4 17L7 20L12 14" /><path d="M17 8H28M17 17H28M17 26H25" /><circle cx="8" cy="26" r="3" /></>,
  tools: <><path d="M20 4a7 7 0 0 0-6 10L4 24a2.8 2.8 0 0 0 4 4L18 18a7 7 0 0 0 10-6L23 17L19 16L18 12L23 8Z" /></>,
};

/**
 * Single-color pictogram for headings, feature lists and small empty areas. It is a stroke drawing on a 32 grid
 * and takes its color from the surrounding text color.
 *
 * Stroke rule: the stroke is 1.5 units in the 32 unit artwork and scales with the artwork, so it renders
 * 1.5px at 32, 2.25px at 48 and 3px at 64. Proportions stay the same at every size.
 * Decorative by default. Pass `title` to give it an accessible name.
 */
export function Pictogram({ name, size = 32, title, className }: PictogramProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {art[name]}
    </svg>
  );
}
