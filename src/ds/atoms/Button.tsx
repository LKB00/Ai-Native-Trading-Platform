import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export type ButtonVariant = "primary" | "lime" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  lime: "bg-lime text-on-lime hover:bg-lime-hover",
  secondary: "bg-surface text-fg border border-line hover:bg-bg hover:border-line-strong",
  ghost: "text-fg-muted hover:bg-hover hover:text-fg",
  danger: "bg-danger text-on-danger hover:opacity-90",
  success: "bg-success text-on-danger hover:opacity-90",
};
const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 max-md:h-10 max-md:px-3.5 max-md:text-[13px]",
  md: "h-9 px-4 text-[13px] gap-2 max-md:h-11 max-md:text-[14px]",
  lg: "h-11 px-6 text-sm gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function Button({ variant = "primary", size = "md", leading, trailing, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap select-none cursor-pointer",
        "transition-colors duration-[var(--dur-fast)] disabled:opacity-50 disabled:pointer-events-none",
        variants[variant], sizes[size], className,
      )}
      {...rest}
    >
      {leading}{children}{trailing}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only controls must have an accessible name. */
  label: string;
  variant?: "ghost" | "secondary" | "primary" | "lime";
  size?: "sm" | "md";
  active?: boolean;
}

export function IconButton({ label, variant = "ghost", size = "md", active, className, children, type = "button", ...rest }: IconButtonProps) {
  const v = { ghost: "text-fg-subtle hover:bg-hover hover:text-fg", secondary: "border border-line bg-surface text-fg-muted hover:bg-bg hover:text-fg", primary: "bg-accent text-on-accent hover:bg-accent-hover", lime: "bg-lime text-on-lime hover:bg-lime-hover disabled:opacity-100 disabled:bg-lime/40 disabled:text-on-lime/50" }[variant];
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center justify-center rounded-md cursor-pointer transition-colors duration-[var(--dur-fast)] disabled:pointer-events-none",
        variant !== "lime" && "disabled:opacity-50",
        size === "sm" ? "size-7 max-md:size-10" : "size-9 max-md:size-11", v, active && "bg-hover text-fg", className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
