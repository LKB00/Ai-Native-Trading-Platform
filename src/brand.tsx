// The product mark: a bold T and the apostrophe from the name, in one flat colour each. No effects, so it reads at 16px
// and survives any background. On light screens it is a dark tile, on dark screens a light one (the colours come from
// --brand-* in index.css), so the tile always stands out from the page. Same drawing as public/favicon.svg (which adapts
// to the system theme by itself) and the app icons; the sources and the grid live in design/brand.

/** The product name, in one place. */
export const BRAND = "Trad'ai"

export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg role="img" aria-label={BRAND} width={size} height={size} viewBox="0 0 1024 1024" fill="none" className={className}>
      <title>{BRAND}</title>
      <rect width="1024" height="1024" rx="230" fill="var(--brand-tile)" />
      <rect x="216" y="272" width="440" height="132" rx="16" fill="var(--brand-ink)" />
      <rect x="366" y="272" width="140" height="480" rx="16" fill="var(--brand-ink)" />
      <path d="M780 286H828L774 486H726Z" fill="var(--brand-mark)" stroke="var(--brand-mark)" strokeWidth="28" strokeLinejoin="round" />
    </svg>
  )
}
