// The product mark: a bold "P" and a green dot, the live dot every market screen carries, set like a full stop. It is
// a rounded square so it never gets mistaken for the round AI avatar. Same drawing as public/favicon.svg, the browser
// tab and home-screen icon.
import { useId } from 'react'

export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  const id = useId()
  return (
    <svg role="img" aria-label="Prompt Terminal" width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <title>Prompt Terminal</title>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a2b45" /><stop offset="1" stopColor="#121218" /></linearGradient></defs>
      <rect width="32" height="32" rx="8" fill={`url(#${id})`} />
      <rect x=".5" y=".5" width="31" height="31" rx="7.5" stroke="#fff" strokeOpacity=".1" />
      <g transform="translate(-1.5 .5)">
        <path fill="#eceeff" fillRule="evenodd" d="M10 7h7.5a6 6 0 0 1 0 12H15v6h-5zM15 11.2v3.6h2.5a1.8 1.8 0 0 0 0-3.6z" />
        <circle cx="24.4" cy="22.9" r="2.1" fill="#2dd4a7" />
      </g>
    </svg>
  )
}
