import { cn } from "../lib/cn";
import { PlusIcon } from "../lib/icons";
import { Button } from "../atoms/Button";

export interface ConversationItem { id: string; title: string; group?: string }

export function ConversationList({ items, activeId, onSelect, onNew }: { items: ConversationItem[]; activeId?: string; onSelect: (id: string) => void; onNew: () => void }) {
  const groups = [...new Set(items.map((i) => i.group ?? "Recent"))];
  return (
    <nav aria-label="Conversations" className="flex flex-col gap-4">
      <Button variant="secondary" leading={<PlusIcon />} onClick={onNew} className="w-full justify-start">New chat</Button>
      {groups.map((g) => (
        <div key={g}>
          <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-fg-subtle">{g}</p>
          <ul>
            {items.filter((i) => (i.group ?? "Recent") === g).map((i) => (
              <li key={i.id}>
                <button type="button" aria-current={i.id === activeId ? "page" : undefined} onClick={() => onSelect(i.id)}
                  className={cn("w-full rounded-full [overflow-wrap:anywhere] px-3 py-1.5 text-left text-xs hover:bg-hover", i.id === activeId ? "bg-hover text-fg" : "text-fg-muted")}>
                  {i.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
