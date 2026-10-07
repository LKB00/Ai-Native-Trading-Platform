import { Fragment, type ReactNode } from "react";
import { CitationMarker } from "../atoms/CitationMarker";
import { CodeBlock } from "../molecules/CodeBlock";

/**
 * Small, dependency-free Markdown renderer for assistant output.
 * - Builds React elements only (no innerHTML), so model output cannot inject markup.
 * - Tolerates partial input: an unclosed code fence renders as code while streaming.
 * - Links are limited to http(s)/mailto. `[1]` becomes a CitationMarker.
 * - Lists nest up to 3 levels by leading-space indentation (2 or 4 spaces per level, or tabs). Each list is ordered or not by its own first item.
 * Supports: headings, paragraphs, bold, italic, inline code, links, lists, blockquotes, tables, hr, fenced code.
 */

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

function inline(text: string, keyBase = ""): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[([^\]]+)\]\(([^)\s]+)\))|(\[(\d{1,2})\])/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${keyBase}${i++}`;
    if (m[1]) out.push(<code key={k} className="rounded bg-sunken px-1 py-0.5 font-mono text-[0.9em]">{m[1].slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k} className="font-semibold">{inline(m[2].slice(2, -2), k)}</strong>);
    else if (m[3]) out.push(<em key={k}>{inline(m[3].slice(1, -1), k)}</em>);
    else if (m[4]) {
      out.push(SAFE_URL.test(m[6])
        ? <a key={k} href={m[6]} target="_blank" rel="noreferrer noopener" className="text-accent-fg underline underline-offset-2 hover:text-accent">{m[5]}</a>
        : <Fragment key={k}>{m[5]}</Fragment>);
    } else if (m[7]) out.push(<CitationMarker key={k} n={Number(m[8])} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const isTableSep = (l?: string) => !!l && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

const LIST_RE = /^([ \t]*)([-*+]|\d+\.)\s+(.*)$/;
const MAX_DEPTH = 3;
interface ListItem { depth: number; ordered: boolean; text: string }

/** Turn consecutive list lines into items with a depth of 0 to 2, from leading whitespace. Tabs count as 4 spaces. */
function listItems(raw: string[]): ListItem[] {
  const stack: number[] = [];
  return raw.map((line) => {
    const m = line.match(LIST_RE)!;
    const indent = m[1].replace(/\t/g, "    ").length;
    while (stack.length && indent < stack[stack.length - 1]) stack.pop();
    if (!stack.length || indent > stack[stack.length - 1]) { if (stack.length < MAX_DEPTH) stack.push(indent); }
    return { depth: stack.length - 1, ordered: /\d/.test(m[2]), text: m[3] };
  });
}

/** Render items from `from` as one list at `depth`. The list is ordered or not by its first item and ends when a sibling of the other type starts. */
function renderList(items: ListItem[], from: number, depth: number, key: string | number): [ReactNode, number] {
  const ordered = items[from].ordered;
  const Tag = ordered ? "ol" : "ul";
  const lis: ReactNode[] = [];
  let i = from;
  while (i < items.length && items[i].depth >= depth) {
    const it = items[i];
    if (it.depth === depth && it.ordered !== ordered) break;
    if (it.depth > depth) break;
    i++;
    let nested: ReactNode = null;
    if (i < items.length && items[i].depth > depth) {
      const nestedNodes: ReactNode[] = [];
      while (i < items.length && items[i].depth > depth) {
        const [node, next] = renderList(items, i, depth + 1, nestedNodes.length);
        nestedNodes.push(node); i = next;
      }
      nested = nestedNodes;
    }
    lis.push(<li key={lis.length}>{inline(it.text)}{nested}</li>);
  }
  return [<Tag key={key} className={`space-y-1 pl-5 ${depth > 0 ? "mt-1 " : ""}${ordered ? "list-decimal" : "list-disc"} marker:text-fg-subtle`}>{lis}</Tag>, i];
}

export function Markdown({ children }: { children: string }) {
  const lines = children.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0, k = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const fence = line.match(/^```\s*([\w+-]*)/);
    if (fence) {
      const buf: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++; // closing fence (may be missing while streaming)
      blocks.push(<CodeBlock key={k++} language={fence[1] || "text"} code={buf.join("\n")} />);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const size = ["text-xl", "text-lg", "text-base", "text-[15px]"][h[1].length - 1];
      blocks.push(<p key={k++} role="heading" aria-level={h[1].length + 1} className={`${size} mt-2 font-semibold tracking-tight`}>{inline(h[2])}</p>);
      i++; continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { blocks.push(<hr key={k++} className="border-line" />); i++; continue; }
    if (line.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) buf.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={k++} className="border-l-2 border-accent-line pl-4 text-fg-muted">{inline(buf.join(" "))}</blockquote>);
      continue;
    }
    if (line.includes("|") && isTableSep(lines[i + 1])) {
      const head = cells(line); i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={k++} tabIndex={0} className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-sunken text-fg-muted"><tr>{head.map((c, j) => <th key={j} scope="col" className="px-3 py-2 font-medium">{inline(c)}</th>)}</tr></thead>
            <tbody>{rows.map((r, a) => <tr key={a} className="border-t border-line">{r.map((c, j) => <td key={j} className="px-3 py-2">{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (LIST_RE.test(line)) {
      const raw: string[] = [];
      while (i < lines.length && LIST_RE.test(lines[i])) raw.push(lines[i++]);
      const items = listItems(raw);
      let at = 0;
      while (at < items.length) {
        // A list that starts indented is still a top-level list, so shift everything up to depth 0.
        const [node, next] = renderList(items, at, 0, k++);
        blocks.push(node); at = next;
      }
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|>|[ \t]*([-*+]|\d+\.)\s)/.test(lines[i]) && !(lines[i].includes("|") && isTableSep(lines[i + 1]))) buf.push(lines[i++]);
    blocks.push(<p key={k++}>{inline(buf.join(" "))}</p>);
  }
  return <>{blocks}</>;
}
