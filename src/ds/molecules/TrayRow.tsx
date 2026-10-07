import type { ReactNode } from "react";
import { AttentionDot } from "../atoms/AttentionDot";

export interface TrayRowProps {
  title: string;
  detail?: string;
  /** Amber dot + detail in the foreground colour: this one needs you. */
  attention?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
}

export function TrayRow({ title, detail, attention, icon, trailing, onClick }: TrayRowProps) {
  return (
    <li>
      <button type="button" onClick={onClick}
        className="group flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-left sm:rounded-full sm:py-1.5 pointer-coarse:min-h-11 text-[13px] transition-colors hover:bg-hover cursor-pointer">
        {attention ? <AttentionDot /> : icon && <span className="text-fg-subtle">{icon}</span>}
        <span className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-2.5">
          <span className="font-medium text-fg">{title}</span>
          {detail && <span className="min-w-0 text-fg-subtle sm:truncate">{detail}</span>}
        </span>
        <span className="flex-1" />
        {trailing && <span className="text-xs text-fg-subtle shrink-0 opacity-0 transition-opacity pointer-coarse:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100">{trailing}</span>}
      </button>
    </li>
  );
}
