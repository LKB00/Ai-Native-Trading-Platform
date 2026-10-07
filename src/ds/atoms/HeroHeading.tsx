import { useEffect, useState } from "react";

/** Serif headline that types itself in once. Static for reduced-motion users and screen readers. */
export function HeroHeading({ text, type = true }: { text: string; type?: boolean }) {
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [n, setN] = useState(type && !reduce ? 0 : text.length);
  useEffect(() => {
    if (!type || reduce) return;
    setN(0);
    const t = window.setInterval(() => setN((v) => { if (v >= text.length) { window.clearInterval(t); return v; } return v + 1; }), 28);
    return () => window.clearInterval(t);
  }, [text, type, reduce]);
  return (
    <h2 aria-label={text} className="text-balance text-center text-[26px] leading-9 tracking-[-0.01em] text-fg sm:text-[32px] sm:leading-[44px]">
      <span aria-hidden>{text.slice(0, n)}</span>
    </h2>
  );
}
