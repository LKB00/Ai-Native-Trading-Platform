import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";
import { spaceValue, type Space } from "./Stack";

export type Cols = 1 | 2 | 3 | 4 | 6 | 8 | 12;

const base: Record<Cols, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 6: "grid-cols-6", 8: "grid-cols-8", 12: "grid-cols-12" };
const md: Record<Cols, string> = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 6: "md:grid-cols-6", 8: "md:grid-cols-8", 12: "md:grid-cols-12" };
const lg: Record<Cols, string> = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 6: "lg:grid-cols-6", 8: "lg:grid-cols-8", 12: "lg:grid-cols-12" };

export interface GridCols {
  /** Columns below md. Default 4. */
  base?: Cols;
  /** Columns from md (840px). Default 8. */
  md?: Cols;
  /** Columns from lg (1200px). Default 12. */
  lg?: Cols;
}

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  /** Column counts per window class. Defaults follow the 4, 8, 12 column system. */
  cols?: GridCols;
  /** Minimum item width as a CSS length such as "16rem". When set, the grid auto-fits and `cols` is ignored. */
  min?: string;
  /** Gap step from 1 to 8, scaled by --density. Omit to use the --gutter token. */
  gap?: Space;
  children?: ReactNode;
}

/** Responsive grid. Items span columns with Tailwind col-span utilities. */
export function Grid({ cols, min, gap, className, style, children, ...rest }: GridProps) {
  const c = { base: 4 as Cols, md: 8 as Cols, lg: 12 as Cols, ...cols };
  const s: CSSProperties = {
    gap: gap ? spaceValue(gap) : "var(--gutter)",
    ...(min ? { gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}), 1fr))` } : null),
    ...style,
  };
  return <div {...rest} className={cn("grid", !min && [base[c.base], md[c.md], lg[c.lg]].join(" "), className)} style={s}>{children}</div>;
}
