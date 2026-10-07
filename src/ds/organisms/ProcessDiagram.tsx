import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DiagramFigure } from "../molecules/DiagramFigure";

export type ProcessNodeKind = "start" | "step" | "decision" | "end" | "attention";

export interface ProcessNode {
  id: string;
  label: string;
  /** Shape and meaning. start is a pill, step a rounded box, decision a hexagon, end a box with a double outline, attention a dashed box with a "!" marker. Default step. */
  kind?: ProcessNodeKind;
  /** One sentence shown under the diagram when the node is focused or clicked. */
  detail?: string;
}

export interface ProcessEdge {
  from: string;
  to: string;
  /** Short label such as "yes" or "no". */
  label?: string;
}

export interface ProcessDiagramProps {
  nodes: ProcessNode[];
  /** Arrows. Omit to connect the nodes in order. Arrows run between neighbouring nodes in the layout. */
  edges?: ProcessEdge[];
  /** Short alt for the figure. Name the diagram and say that the full description follows. */
  label: string;
  caption: string;
  /** Long description, visible to everyone. */
  description?: ReactNode;
  /** Override the generated textual definition shown by "View source". */
  source?: string;
}

const KIND_NAME: Record<ProcessNodeKind, string> = { start: "Start", step: "Step", decision: "Decision", end: "End", attention: "Needs a person" };
const W = 132, H = 56, GAP = 44, PAD = 4;

function lines(label: string, max = 16): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of label.split(" ")) {
    if (cur && (cur + " " + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
  }
  if (cur) out.push(cur);
  return out.slice(0, 3);
}

const ids = (s: string) => s.replace(/[^A-Za-z0-9_]/g, "_");
function mermaid(nodes: ProcessNode[], edges: ProcessEdge[]) {
  const shape = (n: ProcessNode) => {
    const t = n.label.replace(/"/g, "'");
    switch (n.kind) { case "start": return `${ids(n.id)}([${t}])`; case "decision": return `${ids(n.id)}{{${t}}}`; case "end": return `${ids(n.id)}[[${t}]]`; case "attention": return `${ids(n.id)}[/${t}/]`; default: return `${ids(n.id)}[${t}]`; }
  };
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return ["flowchart LR", ...edges.map((e) => `  ${shape(byId.get(e.from)!)} -->${e.label ? `|${e.label}|` : ""} ${shape(byId.get(e.to)!)}`)].join("\n");
}

/**
 * Flow of nodes and arrows drawn as SVG, left to right, switching to a vertical column when the width is too small.
 * Meaning is carried by shape and label. Nodes are keyboard focusable and describe themselves under the diagram.
 * It renders inside a DiagramFigure with a short aria-label, a visible long description, an ordered-list text alternative and a view-source toggle.
 */
export function ProcessDiagram({ nodes, edges, label, caption, description, source }: ProcessDiagramProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const links = useMemo<ProcessEdge[]>(() => edges ?? nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })), [edges, nodes]);
  const horizontal = width === 0 || width >= nodes.length * W + (nodes.length - 1) * GAP + PAD * 2;
  const pos = nodes.map((_, i) => horizontal ? { x: PAD + i * (W + GAP), y: PAD } : { x: PAD, y: PAD + i * (H + GAP) });
  const vbW = horizontal ? PAD * 2 + nodes.length * W + (nodes.length - 1) * GAP : PAD * 2 + W;
  const vbH = horizontal ? PAD * 2 + H : PAD * 2 + nodes.length * H + (nodes.length - 1) * GAP;
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const act = nodes.find((n) => n.id === active);

  const shapeOf = (n: ProcessNode) => {
    const common = { strokeWidth: 1.5 } as const;
    const stroke = n.kind === "attention" ? "var(--attention)" : "var(--border-strong)";
    const fill = n.kind === "attention" ? "var(--attention-soft)" : n.kind === "end" ? "var(--lime)" : "var(--surface)";
    const on = active === n.id ? "var(--fg)" : stroke;
    switch (n.kind) {
      case "start": return <rect width={W} height={H} rx={H / 2} fill={fill} stroke={on} {...common} />;
      case "decision": return <polygon points={`16,0 ${W - 16},0 ${W},${H / 2} ${W - 16},${H} 16,${H} 0,${H / 2}`} fill={fill} stroke={on} {...common} />;
      case "end": return <><rect width={W} height={H} rx={12} fill={fill} stroke={on} {...common} /><rect x={4} y={4} width={W - 8} height={H - 8} rx={9} fill="none" stroke="var(--on-lime)" strokeWidth={1} /></>;
      case "attention": return <rect width={W} height={H} rx={12} fill={fill} stroke={on} strokeDasharray="5 3" {...common} />;
      default: return <rect width={W} height={H} rx={12} fill={fill} stroke={on} {...common} />;
    }
  };

  const svg = (
    <div ref={wrap} className="w-full">
      <svg role="list" aria-label={label} viewBox={`0 0 ${vbW} ${vbH}`} width={vbW} height={vbH} style={{ maxWidth: "100%", height: "auto", display: "block", margin: "0 auto" }}>
        <defs>
          <marker id="pd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 z" fill="var(--fg-subtle)" /></marker>
        </defs>
        {links.map((e, i) => {
          const a = index.get(e.from), b = index.get(e.to);
          if (a === undefined || b === undefined) return null;
          const pa = pos[a], pb = pos[b];
          const [x1, y1, x2, y2] = horizontal ? [pa.x + W, pa.y + H / 2, pb.x, pb.y + H / 2] : [pa.x + W / 2, pa.y + H, pb.x + W / 2, pb.y];
          return (
            <g key={i} aria-hidden>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--fg-subtle)" strokeWidth={1.5} markerEnd="url(#pd-arrow)" />
              {e.label && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize={11} fill="var(--fg-muted)">{e.label}</text>}
            </g>
          );
        })}
        {nodes.map((n, i) => {
          const ls = lines(n.label);
          const kind = n.kind ?? "step";
          return (
            <g key={n.id} role="listitem" tabIndex={0} aria-label={`${i + 1}. ${KIND_NAME[kind]}: ${n.label}`} transform={`translate(${pos[i].x} ${pos[i].y})`}
              style={{ cursor: "pointer", outline: "none" }} onFocus={() => setActive(n.id)} onBlur={() => setActive((c) => (c === n.id ? null : c))} onClick={() => setActive(n.id)}>
              {shapeOf(n)}
              <text textAnchor="middle" fontSize={12} fill={kind === "end" ? "var(--on-lime)" : "var(--fg)"}>
                {ls.map((l, k) => <tspan key={k} x={W / 2} y={H / 2 + 4 + (k - (ls.length - 1) / 2) * 14}>{l}</tspan>)}
              </text>
              {kind === "attention" && <text x={W - 12} y={14} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--attention-fg)">!</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );

  const alternative = (
    <>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-fg-muted">Text alternative</p>
      <ol className="m-0 list-decimal space-y-1 pl-5">
        {nodes.map((n) => {
          const out = links.filter((e) => e.from === n.id).map((e) => `${e.label ? `${e.label}: ` : ""}${nodes.find((x) => x.id === e.to)?.label ?? e.to}`);
          return <li key={n.id}><span className="font-medium text-fg">{KIND_NAME[n.kind ?? "step"]}: {n.label}.</span>{n.detail ? ` ${n.detail}` : ""}{out.length > 0 ? ` Leads to ${out.join(", ")}.` : ""}</li>;
        })}
      </ol>
    </>
  );

  return (
    <DiagramFigure label={label} caption={caption} description={description} alternative={<>
      <div role="status" className="mb-3 min-h-6 text-[13px] text-fg">{act ? <><span className="font-medium">{KIND_NAME[act.kind ?? "step"]}: {act.label}.</span> <span className="text-fg-muted">{act.detail}</span></> : <span className="text-fg-subtle">Focus or select a node to read its detail.</span>}</div>
      <ul className="m-0 mb-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[11.5px] text-fg-muted">
        {(["start", "step", "decision", "end", "attention"] as const).filter((k) => nodes.some((n) => (n.kind ?? "step") === k)).map((k) => <li key={k}>{{ start: "Pill", step: "Rounded box", decision: "Hexagon", end: "Double outline", attention: "Dashed box with !" }[k]} is {KIND_NAME[k].toLowerCase()}</li>)}
      </ul>
      {alternative}
    </>}
      source={source ?? mermaid(nodes, links)} sourceLanguage="mermaid">
      {svg}
    </DiagramFigure>
  );
}
