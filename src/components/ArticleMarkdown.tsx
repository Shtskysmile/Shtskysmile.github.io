import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import type { Blockquote, Root, RootContent } from "mdast";
import { ExternalLink as ExternalLinkIcon, Info } from "lucide-react";
import CodeBlock from "@/components/CodeBlock";

/**
 * Custom react-markdown component overrides for article pages.
 * - Code blocks: syntax highlighting, line numbers, copy button
 * - Blockquotes: `> [!NOTE] 标题` renders as a callout box
 * - Links: external icon for http(s) links, styled with accent color
 */

/**
 * `> [!NOTE] 标题` 渲染成提示框。正文另起一段、或紧跟标题的下一行，两种都认
 * （与 GitHub 原生一致，不强制空行）：
 *
 *     > [!NOTE] 作者的话
 *     > 正文……
 *
 * 判定放在 mdast 层：到 hast 阶段，每个块级子节点之间会被插进 "\n" 文本节点，
 * 那时按索引找段落已经不可靠了。这里把标记行从首段摘掉（首段只剩标题就整段删除），
 * 标题挂到 data-note。首段不以纯文本 [!NOTE] 开头时原样留作普通引用块。
 */
const NOTE_MARKER = /^\[!NOTE\][ \t]*([^\n]*)(?:\n|$)/;

function takeNoteMarker(node: Blockquote): string | null {
  const first = node.children[0];
  if (first?.type !== "paragraph" || first.children.length !== 1) return null;
  const text = first.children[0];
  if (text?.type !== "text") return null;

  const match = NOTE_MARKER.exec(text.value);
  if (!match) return null;

  const rest = text.value.slice(match[0].length);
  if (rest === "") node.children.shift();
  else text.value = rest;

  return match[1]?.trim() || "注意";
}

function visit(node: Root | RootContent): void {
  if (node.type === "blockquote") {
    const title = takeNoteMarker(node);
    if (title) node.data = { ...node.data, hProperties: { "data-note": title } };
  }
  if ("children" in node) {
    for (const child of node.children) visit(child);
  }
}

/** remark 插件：把 `> [!NOTE] 标题` 变成带 data-note 的引用块 */
export function remarkNote() {
  return (tree: Root) => visit(tree);
}

function NoteBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="my-6 rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3 dark:border-blue-900/60 dark:bg-blue-950/30">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-300">
        <Info size={14} className="shrink-0" />
        {title}
      </p>
      <div className="text-stone-700 dark:text-stone-300 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}

export const articleComponents: Components = {
  table: ({ children }) => (
    <div className="my-6 w-full overflow-x-auto">
      <table className="w-full table-auto border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="break-words border px-3 py-2 text-left">{children}</th>,
  td: ({ children }) => <td className="break-words border px-3 py-2 align-top">{children}</td>,
  code({ className, children, ...props }) {
    // Fenced block: has a className like "language-python". An unlabelled fence
    // has no className at all, so fall back to the content — a fence's text
    // always ends with a newline, and inline code never spans lines.
    const match = /language-(\w+)/.exec(className || "");
    const text = String(children);
    const isInline = !match && !text.includes("\n");

    if (isInline) {
      return (
        <code
          className="whitespace-pre-wrap break-all rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[13px] text-stone-800 dark:bg-stone-800 dark:text-stone-200"
          {...props}
        >
          {children}
        </code>
      );
    }

    return <CodeBlock language={match?.[1]}>{text.replace(/\n$/, "")}</CodeBlock>;
  },

  blockquote({ children, node }) {
    // 标题由 remarkNote 插件挂在 data-note 上，标记行在 mdast 层就已摘除
    const title = node?.properties?.["data-note"];
    if (typeof title === "string") return <NoteBox title={title}>{children}</NoteBox>;

    return <blockquote>{children}</blockquote>;
  },

  pre({ children }) {
    // Let the <code> handler above handle everything —
    // just pass children through without the default <pre> wrapper.
    return <>{children}</>;
  },

  a({ href, children, ...props }) {
    const isExternal = href?.startsWith("http");

    const className =
      "text-accent underline decoration-accent/30 underline-offset-4 transition-colors hover:decoration-accent break-words [overflow-wrap:anywhere]";

    if (!isExternal) {
      return (
        <a href={href} className={className} {...props}>
          {children as ReactNode}
        </a>
      );
    }

    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} {...props}>
        {children as ReactNode}{" "}
        <ExternalLinkIcon size={12} className="inline-block align-text-top" />
      </a>
    );
  },
};
