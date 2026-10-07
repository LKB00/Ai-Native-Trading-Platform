import { createElement as h, useState, type ReactNode } from "react";
import { Badge } from "../../atoms/Badge";
import { Button } from "../../atoms/Button";
import { Callout } from "../../molecules/Callout";
import { ConfidenceIndicator } from "../../molecules/ConfidenceIndicator";
import { EmptyState } from "../../molecules/EmptyState";
import { StatTile } from "../../molecules/StatTile";
import { DataTable } from "../../molecules/DataTable";
import type { Source } from "../../molecules/SourceCard";
import { BarChart } from "../BarChart";
import { Checklist } from "../Checklist";
import { LineChart } from "../LineChart";
import { ParameterPanel, type ParameterSpec, type ParameterValues } from "../ParameterPanel";
import { PlanCard } from "../PlanCard";
import { SourceList } from "../SourceList";
import { SummaryCard } from "../SummaryCard";
import { VariantGrid } from "../VariantGrid";

/**
 * The allowlist. A model may only ask for the parts listed here, with the props listed here.
 * Everything else is dropped or shown as a quiet fallback. The host owns styling: no part accepts classes or styles.
 */

export type PropType = "string" | "number" | "boolean" | "enum" | "array" | "object";

export interface PropDescriptor {
  name: string;
  type: PropType;
  required?: boolean;
  /** Allowed values when type is "enum". */
  enumValues?: string[];
  description: string;
  /** For arrays and objects: the shape of the contents, written for the model. */
  shape?: string;
}

export type GenUIActionType = "press" | "submit" | "select" | "change";

export interface RenderContext {
  nodeId: string;
  /** True while the host is still handling an action from this node. Controls should be disabled. */
  pending: boolean;
  /** The last action from this node that went out, so a part can show that it was used. */
  sent?: { type: GenUIActionType; value: unknown };
  /** Report something the person did. The renderer decides whether to ask for confirmation first. */
  act: (type: GenUIActionType, value: unknown) => void;
}

export interface CatalogEntry {
  type: string;
  description: string;
  whenToUse: string;
  props: PropDescriptor[];
  canHaveChildren: boolean;
  interactive: boolean;
  /** Props that must be present and not empty, because a person using a screen reader needs them. */
  accessibilityRequires: string[];
  render: (props: Record<string, unknown>, children: ReactNode[], ctx: RenderContext) => ReactNode;
}

/** Props the renderer handles itself on interactive parts. */
export const COMMON_INTERACTIVE_PROPS: PropDescriptor[] = [
  { name: "confirm", type: "boolean", description: "Set to true when pressing this does something that is hard to undo, such as sending, buying or deleting. The person is asked to confirm first." },
  { name: "consequence", type: "string", description: "One plain sentence saying what will happen if the person confirms, for example \"This emails 12 customers.\"" },
];

/** Names that are never accepted anywhere in a node's props. The host owns styling, scripts and handlers. */
const FORBIDDEN = new Set(["classname", "class", "style", "styles", "dangerouslysetinnerhtml", "innerhtml", "css", "sx", "srcdoc", "src", "href"]);
const isForbiddenName = (k: string) => FORBIDDEN.has(k.toLowerCase()) || /^on[A-Z]/.test(k);

/* ---------- small readers, so render never trusts a value ---------- */

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : d);
const optStr = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const recs = (v: unknown): Record<string, unknown>[] => arr(v).filter(isRec);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);

/** Only web addresses are kept. Anything else (javascript:, data:, file:) is dropped. */
export function safeHttpUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

function toSources(v: unknown): Source[] {
  const out: Source[] = [];
  recs(v).forEach((s, i) => {
    const url = safeHttpUrl(s.url);
    if (!url) return;
    out.push({ id: i + 1, title: str(s.title, new URL(url).hostname), url, domain: str(s.domain, new URL(url).hostname.replace(/^www\./, "")), snippet: optStr(s.snippet) });
  });
  return out;
}

const tones = ["info", "success", "warning", "danger"] as const;
const badgeTones = ["neutral", "accent", "lime", "success", "warning", "danger", "info"] as const;

/* ---------- small stateful wrappers (the model never sees these) ---------- */

function ParametersNode({ props, ctx }: { props: Record<string, unknown>; ctx: RenderContext }) {
  const kinds = ["segmented", "aspect", "presets", "number", "seed"];
  const parameters = recs(props.parameters)
    .filter((p) => typeof p.id === "string" && typeof p.label === "string" && kinds.includes(str(p.kind)))
    .map((p) => ({ ...p, options: recs(p.options).map((o) => ({ value: str(o.value), label: str(o.label, str(o.value)) })) })) as unknown as ParameterSpec[];
  const [values, setValues] = useState<ParameterValues>(() => {
    const init: ParameterValues = {};
    for (const p of recs(props.parameters)) {
      if (typeof p.id !== "string") continue;
      const d = p.default;
      init[p.id] = typeof d === "string" || typeof d === "number" || typeof d === "boolean" ? d : p.kind === "number" ? num(p.min, 0) : recs(p.options)[0] ? str(recs(p.options)[0].value) : null;
    }
    return init;
  });
  return h(ParameterPanel, { parameters, values, onChange: setValues, onGenerate: (v) => ctx.act("submit", v), title: str(props.title, "Settings"), generateLabel: str(props.submitLabel, "Apply"), busy: ctx.pending });
}

function VariantsNode({ props, ctx }: { props: Record<string, unknown>; ctx: RenderContext }) {
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const variants = recs(props.variants).filter((v) => typeof v.id === "string").map((v) => ({
    id: str(v.id), label: str(v.label, str(v.id)),
    node: h("span", { className: "flex size-full items-center justify-center p-3 text-center text-sm text-fg" }, str(v.text, str(v.label))),
  }));
  return h("div", { className: "space-y-2" },
    optStr(props.title) ? h("p", { className: "text-sm font-medium" }, str(props.title)) : null,
    h(VariantGrid, { variants, selectedId: selected, onSelect: (id: string) => { setSelected(id); ctx.act("select", id); } }));
}

function PlanNode({ props, ctx }: { props: Record<string, unknown>; ctx: RenderContext }) {
  const steps = recs(props.steps).map((s, i) => ({ id: str(s.id, String(i + 1)), title: str(s.title), description: optStr(s.description) }));
  const sent = ctx.sent?.value;
  const state = sent === "approve" ? "approved" : sent === "revise" ? "revised" : "awaiting";
  return h(PlanCard, { title: str(props.title, "Plan"), steps, estimate: optStr(props.estimate), state, onApprove: () => ctx.act("press", "approve"), onRevise: () => ctx.act("press", "revise"), readOnlyLabel: null });
}

/* ---------- the catalog ---------- */

export const catalog: CatalogEntry[] = [
  {
    type: "Group",
    description: "A container that lays its children out in a column or a grid.",
    whenToUse: "Use it to put several parts together under an optional heading. Keep it to one level of nesting.",
    props: [
      { name: "title", type: "string", description: "Optional heading above the group." },
      { name: "layout", type: "enum", enumValues: ["stack", "grid"], description: "stack puts children in one column. grid puts them side by side when there is room. Default stack." },
    ],
    canHaveChildren: true, interactive: false, accessibilityRequires: [],
    render: (p, children) => h("section", { "aria-label": optStr(p.title), className: "space-y-3" },
      optStr(p.title) ? h("h3", { className: "text-base" }, str(p.title)) : null,
      h("div", { className: p.layout === "grid" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0" : "space-y-3 [&>*]:min-w-0" }, ...children)),
  },
  {
    type: "Text",
    description: "A short paragraph of plain text.",
    whenToUse: "Use it for a sentence or two of explanation. Do not use it for long answers; reply in text instead.",
    props: [
      { name: "text", type: "string", required: true, description: "The words to show. Plain text only." },
      { name: "tone", type: "enum", enumValues: ["normal", "muted"], description: "muted is for small side notes. Default normal." },
    ],
    canHaveChildren: false, interactive: false, accessibilityRequires: ["text"],
    render: (p) => h("p", { className: p.tone === "muted" ? "text-sm text-fg-muted" : "text-sm text-fg" }, str(p.text)),
  },
  {
    type: "Callout",
    description: "A highlighted note with a short title and a sentence of detail.",
    whenToUse: "Use it for one thing the person should notice: a result, a warning or a tip. Only use warning when a person has to act.",
    props: [
      { name: "tone", type: "enum", enumValues: [...tones], description: "info, success, warning or danger. Default info." },
      { name: "title", type: "string", description: "Short heading." },
      { name: "text", type: "string", required: true, description: "The note itself." },
    ],
    canHaveChildren: false, interactive: false, accessibilityRequires: ["text"],
    render: (p) => h(Callout, { tone: oneOf(p.tone, tones, "info"), title: optStr(p.title) }, str(p.text)),
  },
  {
    type: "StatTile",
    description: "One headline number with a label and an optional change.",
    whenToUse: "Use it for the two to four numbers that answer the question, such as orders this week. Put them in a grid Group.",
    props: [
      { name: "label", type: "string", required: true, description: "What the number measures, in sentence case." },
      { name: "value", type: "string", required: true, description: "The number, already formatted, for example \"1,240\" or \"$4.2K\"." },
      { name: "delta", type: "object", description: "Change since before.", shape: "{ text: string (for example \"+4.2%\"), direction: \"up\" | \"down\" | \"flat\", versus?: string }" },
      { name: "goodDirection", type: "enum", enumValues: ["up", "down", "neutral"], description: "Which way counts as better. Default up." },
      { name: "detail", type: "string", description: "A small line under the number." },
    ],
    canHaveChildren: false, interactive: false, accessibilityRequires: ["label", "value"],
    render: (p) => {
      const d = isRec(p.delta) && typeof p.delta.text === "string" ? { text: str(p.delta.text), direction: oneOf(p.delta.direction, ["up", "down", "flat"] as const, "flat"), versus: optStr(p.delta.versus) } : undefined;
      return h(StatTile, { label: str(p.label), value: str(p.value), delta: d, goodDirection: oneOf(p.goodDirection, ["up", "down", "neutral"] as const, "up"), detail: optStr(p.detail) });
    },
  },
  {
    type: "LineChart",
    description: "A line chart of one to five series over a list of labels such as days.",
    whenToUse: "Use it to show how something changed over time. For comparing categories use BarChart.",
    props: [
      { name: "ariaLabel", type: "string", required: true, description: "A name that says what the chart shows, for example \"Orders per day\"." },
      { name: "x", type: "array", required: true, description: "Labels along the bottom.", shape: "string[]" },
      { name: "series", type: "array", required: true, description: "The lines.", shape: "{ id: string, label: string, data: (number | null)[] }[] with one value per label" },
      { name: "unit", type: "string", description: "Unit word read aloud after each value, for example \"orders\"." },
    ],
    canHaveChildren: false, interactive: false, accessibilityRequires: ["ariaLabel"],
    render: (p) => h(LineChart, {
      ariaLabel: str(p.ariaLabel), x: arr(p.x).map((v) => str(v)), unit: str(p.unit),
      series: recs(p.series).map((s, i) => ({ id: str(s.id, `s${i}`), label: str(s.label, `Series ${i + 1}`), data: arr(s.data).map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null)) })),
    }),
  },
  {
    type: "BarChart",
    description: "A bar chart that compares categories.",
    whenToUse: "Use it to compare a handful of categories, such as sales by product. Keep it under about ten bars.",
    props: [
      { name: "ariaLabel", type: "string", required: true, description: "A name that says what the chart shows, for example \"Orders by product\"." },
      { name: "data", type: "array", required: true, description: "The bars, in order.", shape: "{ label: string, value: number (zero or more) }[]" },
      { name: "orientation", type: "enum", enumValues: ["horizontal", "vertical"], description: "Default horizontal." },
      { name: "measure", type: "string", description: "Name of what is measured, for example \"Orders\"." },
      { name: "unit", type: "string", description: "Unit word read aloud after each value." },
      { name: "highlight", type: "string", description: "Label of one bar to emphasize." },
    ],
    canHaveChildren: false, interactive: false, accessibilityRequires: ["ariaLabel"],
    render: (p) => h(BarChart, {
      ariaLabel: str(p.ariaLabel), orientation: oneOf(p.orientation, ["horizontal", "vertical"] as const, "horizontal"), measure: str(p.measure, "Value"), unit: str(p.unit), highlight: optStr(p.highlight),
      data: recs(p.data).map((d) => ({ label: str(d.label), value: Math.max(0, num(d.value)) })),
    }),
  },
  {
    type: "DataTable",
    description: "A table of rows and columns.",
    whenToUse: "Use it when the person needs exact values or many attributes. For two or three numbers use StatTile instead.",
    props: [
      { name: "caption", type: "string", required: true, description: "Says what the table holds, for example \"Orders this week by day\"." },
      { name: "columns", type: "array", required: true, description: "Column definitions in order. The first column is the row header.", shape: "{ key: string, header: string, numeric?: boolean }[]" },
      { name: "rows", type: "array", required: true, description: "One object per row, keyed by column key.", shape: "Record<string, string | number>[]" },
    ],
    canHaveChildren: false, interactive: false, accessibilityRequires: ["caption"],
    render: (p) => h(DataTable, {
      caption: str(p.caption),
      columns: recs(p.columns).filter((c) => typeof c.key === "string").map((c) => ({ key: str(c.key), header: str(c.header, str(c.key)), numeric: c.numeric === true })),
      rows: recs(p.rows).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "string" || typeof v === "number" ? String(v) : ""]))),
    }),
  },
  {
    type: "SourceList",
    description: "A numbered list of the web pages an answer is based on.",
    whenToUse: "Use it under a summary or claim so the person can check where it came from. Only list pages you really used.",
    props: [
      { name: "sources", type: "array", required: true, description: "The pages.", shape: "{ title: string, url: string (https only), domain?: string, snippet?: string }[]" },
    ],
    canHaveChildren: false, interactive: false, accessibilityRequires: ["sources"],
    render: (p) => h(SourceList, { sources: toSources(p.sources) }),
  },
  {
    type: "SummaryCard",
    description: "A short written summary with an AI label, optional extra detail and sources.",
    whenToUse: "Use it for a short overview of something that was looked up or worked out. Add sources when the content is factual.",
    props: [
      { name: "title", type: "string", description: "Heading. Default Overview." },
      { name: "text", type: "string", required: true, description: "The summary, plain text." },
      { name: "detail", type: "string", description: "Longer detail the person can open." },
      { name: "sources", type: "array", description: "Pages the summary is based on.", shape: "{ title: string, url: string (https only) }[]" },
    ],
    canHaveChildren: false, interactive: false, accessibilityRequires: ["text"],
    render: (p) => h(SummaryCard, { title: str(p.title, "Overview"), detail: optStr(p.detail) ? h("p", null, str(p.detail)) : undefined, sources: toSources(p.sources).length ? toSources(p.sources) : undefined, children: h("p", null, str(p.text)) }),
  },
  {
    type: "PlanCard",
    description: "A plan with numbered steps that the person can approve or ask to change.",
    whenToUse: "Use it before doing work with several steps. Set confirm to true when approving starts something that is hard to undo.",
    props: [
      { name: "title", type: "string", required: true, description: "Name of the plan." },
      { name: "steps", type: "array", required: true, description: "Steps in order.", shape: "{ id: string, title: string, description?: string }[]" },
      { name: "estimate", type: "string", description: "Time or cost, for example \"About 6 minutes\"." },
      ...COMMON_INTERACTIVE_PROPS,
    ],
    canHaveChildren: false, interactive: true, accessibilityRequires: ["title", "steps"],
    render: (p, _c, ctx) => h(PlanNode, { props: p, ctx }),
  },
  {
    type: "ParameterPanel",
    description: "A small form of choices and numbers with an Apply button.",
    whenToUse: "Use it when the person should set a few options before you continue, such as size or style. Never invent other input types.",
    props: [
      { name: "title", type: "string", required: true, description: "Name of the panel." },
      { name: "parameters", type: "array", required: true, description: "The controls, in order.", shape: "{ id: string, label: string, kind: \"segmented\" | \"presets\" | \"number\", options?: { value: string, label: string }[], min?: number, max?: number, step?: number, unit?: string, default?: string | number }[]" },
      { name: "submitLabel", type: "string", description: "Text of the button. Default Apply." },
      ...COMMON_INTERACTIVE_PROPS,
    ],
    canHaveChildren: false, interactive: true, accessibilityRequires: ["title", "parameters"],
    render: (p, _c, ctx) => h(ParametersNode, { props: p, ctx }),
  },
  {
    type: "VariantGrid",
    description: "A set of options the person picks one from.",
    whenToUse: "Use it to offer two to eight alternatives, such as draft titles. Each option needs a label.",
    props: [
      { name: "title", type: "string", description: "Question above the options, for example \"Pick a title\"." },
      { name: "variants", type: "array", required: true, description: "The options.", shape: "{ id: string, label: string, text?: string }[]" },
      ...COMMON_INTERACTIVE_PROPS,
    ],
    canHaveChildren: false, interactive: true, accessibilityRequires: ["variants"],
    render: (p, _c, ctx) => h(VariantsNode, { props: p, ctx }),
  },
  {
    type: "Checklist",
    description: "A list of tasks with a short status next to each.",
    whenToUse: "Use it to show progress on a few steps. Mark an item attention only when a person has to act.",
    props: [
      { name: "items", type: "array", required: true, description: "The tasks.", shape: "{ id: string, title: string, status?: string, attention?: boolean }[]" },
      { name: "doneSummary", type: "string", description: "One line for work that is finished, for example \"3 steps done\"." },
    ],
    canHaveChildren: false, interactive: false, accessibilityRequires: ["items"],
    render: (p) => h(Checklist, { doneSummary: optStr(p.doneSummary), items: recs(p.items).map((i, n) => ({ id: str(i.id, String(n)), title: str(i.title), status: optStr(i.status), attention: i.attention === true })) }),
  },
  {
    type: "ConfidenceIndicator",
    description: "Shows how sure the answer is: low, medium or high.",
    whenToUse: "Use it next to a claim you are not fully sure about. Do not use it to decorate answers you are sure of.",
    props: [{ name: "level", type: "enum", required: true, enumValues: ["low", "medium", "high"], description: "How sure you are." }],
    canHaveChildren: false, interactive: false, accessibilityRequires: ["level"],
    render: (p) => h(ConfidenceIndicator, { level: oneOf(p.level, ["low", "medium", "high"] as const, "medium") }),
  },
  {
    type: "Badge",
    description: "A small label such as a status.",
    whenToUse: "Use it for one or two words, like \"Shipped\" or \"Late\". Do not use it for sentences.",
    props: [
      { name: "text", type: "string", required: true, description: "One or two words." },
      { name: "tone", type: "enum", enumValues: [...badgeTones], description: "Default neutral. Use warning only when a person has to act." },
    ],
    canHaveChildren: false, interactive: false, accessibilityRequires: ["text"],
    render: (p) => h(Badge, { tone: oneOf(p.tone, badgeTones, "neutral") }, str(p.text)),
  },
  {
    type: "EmptyState",
    description: "A message for when there is nothing to show, with a reason and a next step.",
    whenToUse: "Use it when a search or list came back empty or something could not be loaded. Say why, and what to try.",
    props: [
      { name: "variant", type: "enum", enumValues: ["first-use", "no-results", "cleared", "error", "offline"], description: "Sets the picture and default words. Default no-results." },
      { name: "title", type: "string", required: true, description: "What happened." },
      { name: "text", type: "string", description: "The next step, in one sentence." },
    ],
    canHaveChildren: false, interactive: false, accessibilityRequires: ["title"],
    render: (p) => h(EmptyState, { variant: oneOf(p.variant, ["first-use", "no-results", "cleared", "error", "offline"] as const, "no-results"), title: str(p.title), compact: true }, optStr(p.text)),
  },
  {
    type: "Button",
    description: "A button that sends the person's choice back to you.",
    whenToUse: "Use it for one clear next step. Use at most two buttons together. Set confirm to true for anything hard to undo.",
    props: [
      { name: "label", type: "string", required: true, description: "What the button does, as a short verb phrase, for example \"Send reminders\"." },
      { name: "variant", type: "enum", enumValues: ["primary", "secondary", "ghost", "danger"], description: "Default primary. danger always asks the person to confirm." },
      { name: "value", type: "string", description: "A word you will recognise when the press comes back to you. Defaults to the label." },
      ...COMMON_INTERACTIVE_PROPS,
    ],
    canHaveChildren: false, interactive: true, accessibilityRequires: ["label"],
    render: (p, _c, ctx) => h(Button, { variant: oneOf(p.variant, ["primary", "secondary", "ghost", "danger"] as const, "primary"), disabled: ctx.pending, "aria-busy": ctx.pending || undefined, onClick: () => ctx.act("press", optStr(p.value) ?? str(p.label)) }, str(p.label)),
  },
];

export const catalogByType: Record<string, CatalogEntry> = Object.fromEntries(catalog.map((e) => [e.type, e]));

/* ---------- validation ---------- */

export interface ValidationResult {
  ok: boolean;
  /** Props with unknown ones removed. Only meaningful when ok is true. */
  props: Record<string, unknown>;
  /** Reasons the node cannot be shown. */
  errors: string[];
  /** Things that were dropped but did not stop the node from showing. */
  warnings: string[];
}

function matchesType(d: PropDescriptor, v: unknown): boolean {
  switch (d.type) {
    case "string": return typeof v === "string";
    case "number": return typeof v === "number" && Number.isFinite(v);
    case "boolean": return typeof v === "boolean";
    case "enum": return typeof v === "string" && (d.enumValues ?? []).includes(v);
    case "array": return Array.isArray(v);
    case "object": return isRec(v);
  }
}

function findForbidden(v: unknown, path: string, depth = 0): string | null {
  if (depth > 5 || typeof v !== "object" || v === null) return null;
  if (Array.isArray(v)) {
    for (let i = 0; i < Math.min(v.length, 200); i++) { const f = findForbidden(v[i], `${path}[${i}]`, depth + 1); if (f) return f; }
    return null;
  }
  for (const [k, val] of Object.entries(v)) {
    if (isForbiddenName(k)) return `${path}.${k}`;
    const f = findForbidden(val, `${path}.${k}`, depth + 1);
    if (f) return f;
  }
  return null;
}

/** Hand-written light check of one node against the catalog. It never throws. */
export function validateNode(node: { type?: unknown; props?: unknown; children?: unknown }): ValidationResult {
  const res: ValidationResult = { ok: false, props: {}, errors: [], warnings: [] };
  try {
    const entry = typeof node.type === "string" && Object.prototype.hasOwnProperty.call(catalogByType, node.type) ? catalogByType[node.type] : undefined;
    if (!entry) { res.errors.push(`"${String(node.type)}" is not in the catalog`); return res; }
    const raw = isRec(node.props) ? node.props : {};
    for (const k of Object.keys(raw)) if (isForbiddenName(k)) res.errors.push(`"${k}" is not allowed: the host owns styling and behavior`);
    const deep = findForbidden(raw, "props");
    if (deep && !res.errors.length) res.errors.push(`"${deep}" is not allowed: the host owns styling and behavior`);
    const known = new Map<string, PropDescriptor>(entry.props.map((d) => [d.name, d]));
    for (const d of entry.props) {
      const v = raw[d.name];
      if (v === undefined || v === null) { if (d.required) res.errors.push(`missing required "${d.name}"`); continue; }
      if (!matchesType(d, v)) { res.errors.push(`"${d.name}" should be ${d.type === "enum" ? `one of ${(d.enumValues ?? []).join(", ")}` : `a ${d.type}`}`); continue; }
      res.props[d.name] = v;
    }
    for (const k of Object.keys(raw)) if (!known.has(k) && !isForbiddenName(k)) res.warnings.push(`ignored unknown prop "${k}"`);
    for (const name of entry.accessibilityRequires) {
      const v = res.props[name];
      const empty = v === undefined || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && v.length === 0);
      if (empty && !res.errors.some((e) => e.includes(`"${name}"`))) res.errors.push(`needs "${name}" so everyone can use it`);
    }
    if (!entry.canHaveChildren && Array.isArray(node.children) && node.children.length) res.warnings.push("this component cannot have children; they were ignored");
    res.ok = res.errors.length === 0;
    return res;
  } catch {
    res.errors.push("could not be checked");
    return res;
  }
}

/** True when this node's actions should ask first: confirm is set, or it is a danger button. */
export function needsConfirmation(type: string, props: Record<string, unknown>): boolean {
  const entry = catalogByType[type];
  if (!entry?.interactive) return false;
  return props.confirm === true || (type === "Button" && props.variant === "danger");
}

/** The catalog as plain JSON, without render functions. */
export function catalogToJSON() {
  return catalog.map(({ render: _render, ...rest }) => rest);
}

/** A system prompt that tells a model exactly what it may build. */
export function buildSystemPrompt(): string {
  const parts = catalog.map((e) => {
    const props = e.props.map((p) => `  - ${p.name} (${p.type === "enum" ? `one of: ${(p.enumValues ?? []).join(" | ")}` : p.type}${p.required ? ", required" : ""}): ${p.description}${p.shape ? ` Shape: ${p.shape}` : ""}`).join("\n");
    return `### ${e.type}\n${e.description}\nWhen to use: ${e.whenToUse}\nChildren: ${e.canHaveChildren ? "yes (list child ids in \"children\")" : "no"}. Interactive: ${e.interactive ? "yes" : "no"}.\nMust always have: ${e.accessibilityRequires.length ? e.accessibilityRequires.join(", ") : "nothing extra"}.\nProps:\n${props}`;
  });
  return `# Building screens with the Sandstone catalog

You can answer with a small screen instead of plain text when a screen helps the person: numbers to compare, a plan to approve, options to pick. You only propose the screen. The app checks it and draws it using its own design. If something is wrong, the app shows a quiet text fallback.

## Format

Reply with a JSON object, or several lines of JSON (one object per line) if you are writing as you go:

{ "root": "page", "nodes": [ { "id": "page", "type": "Group", "props": { "title": "Orders this week" }, "children": ["orders", "chart"] }, { "id": "orders", "type": "StatTile", "props": { "label": "Orders", "value": "1,240" } } ], "done": true }

- A screen is a flat list of nodes. Each node has "id" (unique, short), "type" (a component below), "props", and, for containers, "children" (a list of node ids).
- "root" is the id of the first node to draw.
- Nodes can be sent in any order and in several pieces. A node sent again with the same id updates its props. Send "done": true in the last piece.
- Every value you show must come from data you really have. Do not make up numbers.

## Rules

1. Never invent components or props. Use only the components below. Anything else is dropped.
2. Never set styles, classes, colors, sizes, HTML, scripts or event handlers. The app owns how things look. Props named className, style, class, dangerouslySetInnerHTML or starting with "on" are rejected and the whole node is replaced by a fallback.
3. Always give the accessible words: every component lists what it must always have (for example ariaLabel for charts, caption for tables, label for buttons). Write them so a person who cannot see the screen understands.
4. Ask before anything that is hard to undo (sending, buying, deleting, publishing). Set "confirm": true and write a plain "consequence" sentence on that control. Never hide a consequence behind a vague label.
5. Keep it small. Prefer 2 to 8 nodes. At most two buttons together. Do not nest groups more than one level.
6. Use plain words a smart person who has never used AI would understand. No jargon.
7. Do not build a screen for a simple answer. If a sentence does the job, reply with text.
8. Links must start with https://. Never ask for passwords, payment details or other secrets in a screen.
9. When the person presses something, you will receive an event: { nodeId, type, value }. Reply to it. Do not assume it worked until you are told.

## Components

${parts.join("\n\n")}

### Interactive parts and confirmation
Interactive parts also accept "confirm" (boolean) and "consequence" (string). With confirm true, the app shows "Are you sure?" with your consequence sentence and only sends the press if the person agrees.
`;
}
