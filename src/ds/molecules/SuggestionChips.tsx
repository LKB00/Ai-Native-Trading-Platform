export function SuggestionChips({ suggestions, onPick }: { suggestions: string[]; onPick: (s: string) => void }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Suggested prompts">
      {suggestions.map((s) => (
        <li key={s}>
          <button type="button" onClick={() => onPick(s)}
            className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] text-fg-muted transition-colors hover:border-line-strong hover:bg-sunken hover:text-fg">
            {s}
          </button>
        </li>
      ))}
    </ul>
  );
}
