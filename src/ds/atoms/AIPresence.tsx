import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

export type AIPresenceState = "idle" | "listening" | "thinking" | "speaking" | "error";
export type AIPresenceSize = "sm" | "md" | "lg";

export interface AIPresenceProps {
  /** What the assistant is doing. Changes are announced once in a polite status region. */
  state?: AIPresenceState;
  size?: AIPresenceSize;
  /**
   * Optional audio amplitude from 0 to 1, for example from a microphone analyser.
   * The component smooths it over several frames, so pass the raw value. It is ignored under reduced motion.
   */
  level?: number;
  /** Show the state as visible text beside the orb. The status region for assistive technology is always present. */
  showLabel?: boolean;
  /** Override the text for each state, for localisation. */
  labels?: Partial<Record<AIPresenceState, string>>;
  className?: string;
}

const DEFAULT_LABELS: Record<AIPresenceState, string> = {
  idle: "Ready", listening: "Listening", thinking: "Thinking", speaking: "Speaking", error: "Something went wrong",
};

/**
 * One continuous parameter set. Each state is a row of targets the animation eases toward, so moving between
 * states never restarts anything: the light just changes how it behaves.
 */
interface Params {
  breathHz: number; breathAmp: number; // slow swell of the whole orb
  core: number;      // size of the lit centre
  glow: number;      // strength of the light inside the glass
  halo: number;      // strength of the glow outside the glass
  drift: number;     // how far the inner lights wander from the centre
  swirl: number;     // how fast they circle, degrees per second
  comet: number;     // opacity of the arc that circles while thinking
  ripple: number;    // opacity of the rings that spread while listening
  gain: number;      // how much the audio level moves things
  warm: number;      // 0 lime, 1 the error colour
}
const TARGETS: Record<AIPresenceState, Params> = {
  idle:      { breathHz: 0.22, breathAmp: 0.025, core: 0.9,  glow: 0.75, halo: 0.35, drift: 6,  swirl: 18,  comet: 0, ripple: 0,   gain: 0,    warm: 0 },
  listening: { breathHz: 0.7,  breathAmp: 0.03,  core: 1,    glow: 0.9,  halo: 0.55, drift: 7,  swirl: 30,  comet: 0, ripple: 0.9, gain: 0.35, warm: 0 },
  thinking:  { breathHz: 0.45, breathAmp: 0.02,  core: 0.75, glow: 0.8,  halo: 0.45, drift: 11, swirl: 140, comet: 1, ripple: 0,   gain: 0,    warm: 0 },
  speaking:  { breathHz: 1.5,  breathAmp: 0.05,  core: 1.15, glow: 1,    halo: 0.8,  drift: 8,  swirl: 60,  comet: 0, ripple: 0,   gain: 0.6,  warm: 0 },
  error:     { breathHz: 0,    breathAmp: 0,     core: 0.7,  glow: 0.55, halo: 0.15, drift: 3,  swirl: 0,   comet: 0, ripple: 0,   gain: 0,    warm: 1 },
};

const DIM: Record<AIPresenceSize, string> = { sm: "size-8", md: "size-16", lg: "size-28" };

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

const R = 34; // radius of the glass sphere, in a 100 x 100 box

/**
 * Animated presence orb: a small dark glass sphere with lime light living inside it and the AI mark at its heart. A soft core glows at the
 * centre, two smaller lights drift and circle inside the glass, a halo breathes outside it, and a highlight and a
 * bright rim give it depth. Listening sends rings outward, thinking sends a comet of light round the rim, speaking
 * pulses with the audio level, and an error dims the light to the danger colour.
 * A single frame loop eases one set of parameters toward the current state, so changing state never restarts an
 * animation. Under prefers-reduced-motion no frames are scheduled: each state is a still drawing plus its label.
 * Place a labelled Stop button beside it. The orb is not a control.
 */
export function AIPresence({ state = "idle", size = "md", level = 0, showLabel = true, labels, className }: AIPresenceProps) {
  const reduced = usePrefersReducedMotion();
  const text = { ...DEFAULT_LABELS, ...labels }[state];
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const id = (n: string) => `${uid}-${n}`;
  const halo = useRef<SVGCircleElement>(null);
  const core = useRef<SVGCircleElement>(null);
  const b1 = useRef<SVGCircleElement>(null);
  const b2 = useRef<SVGCircleElement>(null);
  const lights = useRef<SVGGElement>(null);
  const comet = useRef<SVGGElement>(null);
  const rip1 = useRef<SVGCircleElement>(null);
  const rip2 = useRef<SVGCircleElement>(null);
  const sphere = useRef<SVGGElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const mark = useRef<SVGGElement>(null);
  const fres = useRef<SVGCircleElement>(null);
  const cur = useRef<Params>({ ...TARGETS[state] });
  const target = useRef<Params>(TARGETS[state]);
  const lvlIn = useRef(0);
  lvlIn.current = Math.min(1, Math.max(0, level));

  const draw = (t: number, lvl: number, angle: number) => {
    const c = cur.current;
    const breath = Math.sin(2 * Math.PI * c.breathHz * t) * c.breathAmp;
    const push = lvl * c.gain;
    sphere.current?.setAttribute("transform", `translate(50 50) scale(${1 + breath + push * 0.04}) translate(-50 -50)`);
    halo.current?.setAttribute("opacity", String(Math.min(1, c.halo + push * 0.5)));
    halo.current?.setAttribute("r", String(R + 10 + push * 8));
    core.current?.setAttribute("r", String(17 * c.core * (1 + breath * 2 + push * 0.5)));
    lights.current?.setAttribute("opacity", String(c.glow));
    fres.current?.setAttribute("opacity", String(Math.min(1, c.glow * 0.7 + push * 0.3)));
    const a = (angle * Math.PI) / 180;
    const d = c.drift * (1 + push);
    b1.current?.setAttribute("cx", String(50 + Math.cos(a) * d));
    b1.current?.setAttribute("cy", String(50 + Math.sin(a * 1.3) * d * 0.8));
    b2.current?.setAttribute("cx", String(50 + Math.cos(a + 2.4) * d * 0.9));
    b2.current?.setAttribute("cy", String(50 + Math.sin(a * 0.8 + 2.4) * d));
    // The AI mark at the heart: turns with the light, swells with the core.
    const ms = 0.74 * c.core * (1 + breath * 2 + push * 0.35);
    mark.current?.setAttribute("transform", `translate(50 50) rotate(${angle * 0.35}) scale(${ms}) translate(-12 -12)`);
    comet.current?.setAttribute("opacity", String(c.comet));
    comet.current?.setAttribute("transform", `rotate(${angle * 2.2} 50 50)`);
    // Two rings spread out of the glass and fade, half a cycle apart.
    const p1 = (t * 0.6) % 1, p2 = (t * 0.6 + 0.5) % 1;
    rip1.current?.setAttribute("r", String(R + p1 * 14));
    rip1.current?.setAttribute("opacity", String(c.ripple * (1 - p1)));
    rip2.current?.setAttribute("r", String(R + p2 * 14));
    rip2.current?.setAttribute("opacity", String(c.ripple * (1 - p2)));
    // The light turns toward the danger colour on error.
    svg.current?.style.setProperty("--orb-light", c.warm > 0.5 ? "var(--danger)" : "var(--ref-lime)");
  };

  useLayoutEffect(() => {
    target.current = TARGETS[state];
    if (reduced) { cur.current = { ...TARGETS[state] }; draw(0, 0, state === "thinking" ? 40 : 0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reduced]);

  useEffect(() => {
    if (reduced) return;
    let raf = 0, last = performance.now(), t = 0, angle = 0, lvl = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      const ease = 1 - Math.exp(-dt / 0.18);
      const c = cur.current, g = target.current;
      (Object.keys(g) as (keyof Params)[]).forEach((k) => { c[k] += (g[k] - c[k]) * ease; });
      const rate = lvlIn.current > lvl ? 0.35 : 0.12; // fast attack, slow release, per 60fps frame
      lvl += (lvlIn.current - lvl) * (1 - Math.pow(1 - rate, dt * 60));
      angle = (angle + c.swirl * dt) % 3600;
      draw(t, lvl, angle);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const init = TARGETS[state];
  const light = state === "error" ? "var(--danger)" : "var(--ref-lime)";
  const lightStyle = { ["--orb-light" as string]: light } as React.CSSProperties;
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <svg ref={svg} viewBox="0 0 100 100" aria-hidden="true" focusable="false" style={lightStyle} className={cn("shrink-0 overflow-visible", DIM[size])}>
        <defs>
          {/* The glass: lighter at the top left, falling to near black at the edge. */}
          <radialGradient id={id("glass")} cx="38%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#40474e" />
            <stop offset="50%" stopColor="var(--ref-charcoal)" />
            <stop offset="100%" stopColor="#0c0e10" />
          </radialGradient>
          {/* A light: bright centre fading to nothing, in the current light colour. */}
          <radialGradient id={id("light")}>
            <stop offset="0%" style={{ stopColor: "color-mix(in oklab, var(--orb-light) 60%, white)" }} />
            <stop offset="45%" style={{ stopColor: "var(--orb-light)" }} stopOpacity="0.85" />
            <stop offset="100%" style={{ stopColor: "var(--orb-light)" }} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={id("halo")}>
            <stop offset="40%" style={{ stopColor: "var(--orb-light)" }} stopOpacity="0.5" />
            <stop offset="100%" style={{ stopColor: "var(--orb-light)" }} stopOpacity="0" />
          </radialGradient>
          {/* The rim: bright at the top, gone by the bottom. */}
          <linearGradient id={id("rim")} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.7" />
            <stop offset="40%" stopColor="white" stopOpacity="0.06" />
            <stop offset="75%" style={{ stopColor: "var(--orb-light)" }} stopOpacity="0.1" />
            <stop offset="100%" style={{ stopColor: "var(--orb-light)" }} stopOpacity="0.5" />
          </linearGradient>
          {/* The bezel: a fine metal ring, bright where the light falls (top left), dark on the far side. */}
          <linearGradient id={id("bezel")} x1="0.15" y1="0.05" x2="0.85" y2="0.95">
            <stop offset="0%" stopColor="#f3f2ee" />
            <stop offset="45%" stopColor="#9a9d9f" />
            <stop offset="100%" stopColor="#3b3f43" />
          </linearGradient>
          {/* Light bouncing on the lower inside edge of the glass. */}
          <linearGradient id={id("fresnel")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="35%" style={{ stopColor: "var(--orb-light)" }} stopOpacity="0" />
            <stop offset="100%" style={{ stopColor: "var(--orb-light)" }} stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id={id("comet")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" style={{ stopColor: "var(--orb-light)" }} stopOpacity="0" />
            <stop offset="100%" style={{ stopColor: "var(--orb-light)" }} />
          </linearGradient>
          <clipPath id={id("clip")}><circle cx="50" cy="50" r={R} /></clipPath>
          <filter id={id("soft")} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.6" /></filter>
          <filter id={id("haze")} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" /></filter>
          <filter id={id("sheen")} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" /></filter>
          {/* The reflection: a soft band of light that fades downward. */}
          <linearGradient id={id("refl")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.32" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Outside the glass: the halo, and the rings that spread while listening. */}
        <circle ref={halo} cx="50" cy="50" r={R + 10} fill={`url(#${id("halo")})`} opacity={init.halo} filter={`url(#${id("haze")})`} />
        <circle ref={rip1} cx="50" cy="50" r={R} fill="none" strokeWidth="1.2" opacity="0" style={{ stroke: "var(--orb-light)" }} />
        <circle ref={rip2} cx="50" cy="50" r={R} fill="none" strokeWidth="1.2" opacity="0" style={{ stroke: "var(--orb-light)" }} />

        <g ref={sphere}>
          {/* The setting: a fine bezel and a dark seat, so the glass sits in something rather than floating. */}
          <circle cx="50" cy="50" r={R + 3.2} fill="#0b0d0f" stroke={`url(#${id("bezel")})`} strokeWidth="1.3" />
          <circle cx="50" cy="50" r={R} fill={`url(#${id("glass")})`} />
          {/* Inside the glass: the core and two drifting lights, softened and kept inside the sphere. */}
          <g clipPath={`url(#${id("clip")})`}>
            <g ref={lights} opacity={init.glow} filter={`url(#${id("soft")})`}>
              <ellipse cx="50" cy="74" rx="30" ry="16" fill={`url(#${id("light")})`} opacity="0.35" />
              <circle ref={b1} cx="54" cy="47" r="17" fill={`url(#${id("light")})`} opacity="0.9" />
              <circle ref={b2} cx="45" cy="54" r="15" fill={`url(#${id("light")})`} opacity="0.8" />
              <circle ref={core} cx="50" cy="50" r={17 * init.core} fill={`url(#${id("light")})`} />
            </g>
            {/* The AI mark, crisp at the centre of the light: a soft glow under it, the shape on top. */}
            <g ref={mark} transform={`translate(50 50) scale(${0.74 * init.core}) translate(-12 -12)`}>
              <path d="M12.4 1.5Q14.2 9.8 21.5 11.4Q13.8 14.4 11.4 22.5Q9.6 14 2.5 12.6Q9.8 9.8 12.4 1.5Z" style={{ fill: "var(--orb-light)" }} filter={`url(#${id("sheen")})`} opacity="0.9" />
              <path d="M12.4 1.5Q14.2 9.8 21.5 11.4Q13.8 14.4 11.4 22.5Q9.6 14 2.5 12.6Q9.8 9.8 12.4 1.5Z" style={{ fill: "color-mix(in oklab, var(--orb-light) 55%, white)" }} />
            </g>
            {/* The comet that circles inside the rim while thinking. */}
            <g ref={comet} opacity={init.comet}>
              <path d={`M50 ${50 - R + 4} A ${R - 4} ${R - 4} 0 0 1 ${50 + (R - 4)} 50`} fill="none" stroke={`url(#${id("comet")})`} strokeWidth="2.5" strokeLinecap="round" />
            </g>
            <circle ref={fres} cx="50" cy="50" r={R - 1.2} fill="none" stroke={`url(#${id("fresnel")})`} strokeWidth="3" filter={`url(#${id("sheen")})`} opacity={init.glow * 0.7} />
            {/* A soft reflection on the upper left. */}
            <path d="M27 40 C 30 25, 50 18, 66 24 C 56 23, 38 27, 27 40 Z" fill={`url(#${id("refl")})`} filter={`url(#${id("sheen")})`} />
          </g>
          <circle cx="50" cy="50" r={R - 0.5} fill="none" stroke={`url(#${id("rim")})`} strokeWidth="1" />
          {/* A sharp glint: the small bright point that makes it read as glass. */}
          <ellipse cx="36.5" cy="30.5" rx="2.1" ry="1.2" fill="white" opacity="0.7" transform="rotate(-35 36.5 30.5)" style={{ filter: "blur(0.25px)" }} />
        </g>
      </svg>
      {showLabel && <span aria-hidden="true" className={cn("text-xs", state === "error" ? "text-danger-fg" : "text-fg-muted")}>{text}</span>}
      <span role="status" className="sr-only">{text}</span>
    </div>
  );
}
