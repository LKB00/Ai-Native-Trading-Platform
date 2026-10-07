/**
 * Generated UI spec: a flat list of nodes, so a model can write it a piece at a time and patch it later.
 * Inspired by the flat-list design of A2UI. It has no dependencies and holds no styling: the host owns look and feel.
 */

export interface SpecNode {
  /** Stable id. Other nodes point at it from `children`. The renderer uses it as the React key. */
  id: string;
  /** Name of a catalog component, such as "StatTile". */
  type: string;
  /** Content and options. Never styles. */
  props?: Record<string, unknown>;
  /** Ids of child nodes, in order. A child may arrive after its parent. */
  children?: string[];
}

/** One piece of a stream. Any field may be missing. */
export interface SpecChunk {
  /** Id of the node to render first. */
  root?: string;
  /** New nodes, or new versions of nodes already sent. */
  nodes?: SpecNode[];
  /** Set on the last chunk. Until then missing children are treated as still on their way. */
  done?: boolean;
}

export interface SpecState {
  root: string | null;
  nodes: Record<string, SpecNode>;
  /** Ids in the order they first arrived. */
  order: string[];
  done: boolean;
}

export const emptySpec = (): SpecState => ({ root: null, nodes: {}, order: [], done: false });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Reads one node from unknown input. Returns null when it has no usable id or type. */
export function toNode(v: unknown): SpecNode | null {
  if (!isRecord(v)) return null;
  if (typeof v.id !== "string" || !v.id || typeof v.type !== "string" || !v.type) return null;
  if (["__proto__", "constructor", "prototype"].includes(v.id)) return null;
  const node: SpecNode = { id: v.id, type: v.type };
  if (isRecord(v.props)) node.props = v.props;
  if (Array.isArray(v.children)) node.children = v.children.filter((c): c is string => typeof c === "string");
  return node;
}

/**
 * Merges one streamed chunk into the state. It never mutates and never throws.
 * Nodes may arrive in any order. A node sent again keeps its old props unless the new ones replace them,
 * and its children list is replaced when the new node has one. Bad entries are skipped.
 * Accepts a chunk, a single node, or a list of nodes.
 */
export function applyChunk(state: SpecState, chunk: SpecChunk | SpecNode | SpecNode[] | null | undefined): SpecState {
  if (!chunk) return state;
  const c: SpecChunk = Array.isArray(chunk) ? { nodes: chunk } : "type" in (chunk as object) && "id" in (chunk as object) ? { nodes: [chunk as SpecNode] } : (chunk as SpecChunk);
  const nodes = { ...state.nodes };
  const order = state.order.slice();
  for (const raw of Array.isArray(c.nodes) ? c.nodes : []) {
    const n = toNode(raw);
    if (!n) continue;
    const prev = nodes[n.id];
    if (!prev) order.push(n.id);
    nodes[n.id] = prev ? { id: n.id, type: n.type, props: { ...prev.props, ...n.props }, children: n.children ?? prev.children } : n;
  }
  return {
    root: typeof c.root === "string" && c.root ? c.root : state.root,
    nodes,
    order,
    done: c.done === true ? true : state.done,
  };
}

/** Reads one line of newline-delimited JSON. Returns null for blank or broken lines, so a stream can carry on. */
export function parseChunkLine(line: string): SpecChunk | SpecNode | SpecNode[] | null {
  const t = line.trim();
  if (!t) return null;
  try {
    const v: unknown = JSON.parse(t);
    return Array.isArray(v) || isRecord(v) ? (v as SpecChunk) : null;
  } catch {
    return null;
  }
}

/** Builds a finished state from a complete spec in one step. */
export function specFrom(root: string, nodes: SpecNode[]): SpecState {
  return applyChunk(emptySpec(), { root, nodes, done: true });
}

/** The state as a plain `{ root, nodes }` object, in arrival order. This is what "View spec" shows. */
export function specToJSON(state: SpecState): { root: string | null; nodes: SpecNode[] } {
  return { root: state.root, nodes: state.order.map((id) => state.nodes[id]).filter(Boolean) };
}

/** Ids that some node points at but that have not arrived yet. */
export function missingIds(state: SpecState): string[] {
  const out = new Set<string>();
  if (state.root && !state.nodes[state.root]) out.add(state.root);
  for (const n of Object.values(state.nodes)) for (const c of n.children ?? []) if (!state.nodes[c]) out.add(c);
  return [...out];
}
