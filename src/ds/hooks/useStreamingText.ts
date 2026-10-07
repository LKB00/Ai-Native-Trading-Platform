import { useCallback, useEffect, useRef, useState } from "react";

/** Simulates token streaming for demos and tests. Swap for your real stream. */
export function useStreamingText(full: string, { speed = 18, auto = true }: { speed?: number; auto?: boolean } = {}) {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const stop = useCallback(() => { window.clearInterval(timer.current); setStreaming(false); }, []);
  const start = useCallback(() => {
    window.clearInterval(timer.current);
    setText(""); setStreaming(true);
    let i = 0;
    timer.current = window.setInterval(() => {
      i += 2;
      setText(full.slice(0, i));
      if (i >= full.length) { window.clearInterval(timer.current); setStreaming(false); }
    }, speed);
  }, [full, speed]);

  useEffect(() => { if (auto) start(); return () => window.clearInterval(timer.current); }, [auto, start]);
  return { text, streaming, start, stop };
}
