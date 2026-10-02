import { useEffect, useState, type MouseEvent, type RefObject } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * 目录的 id 在渲染后按 DOM 分配，而不是从 Markdown 源文本推。
 * 源文本里的 `**加粗**`、反引号在渲染后已经变成纯文本，两边分别推导必然对不上；
 * 从同一批 DOM 节点同时生成 id 和目录，锚点才不会错位。
 */
function slugify(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      // 保留字母数字（含中文），去掉标点
      .replace(/[^\p{L}\p{N}-]/gu, "")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "") || "section"
  );
}

const HEADING_SELECTOR = "h2, h3";
/** 判定「当前读到哪里」时，滚动位置相对视口顶部下移的量（吸顶 header 的高度 + 余量） */
const ACTIVE_OFFSET = 112;

/** 给正文标题分配锚点 id，并返回目录条目与当前高亮项 */
export function useArticleToc(articleRef: RefObject<HTMLElement | null>, ready: unknown) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const root = articleRef.current;
    if (!root) return;

    const headings = [...root.querySelectorAll<HTMLElement>(HEADING_SELECTOR)];
    const seen = new Map<string, number>();
    const next = headings.map((heading) => {
      const base = slugify(heading.textContent ?? "");
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);

      const id = n === 0 ? base : `${base}-${n}`;
      heading.id = id;
      heading.classList.add("scroll-mt-28");

      return {
        id,
        text: heading.textContent ?? "",
        level: heading.tagName === "H2" ? (2 as const) : (3 as const),
      };
    });

    setItems(next);
  }, [articleRef, ready]);

  useEffect(() => {
    if (items.length === 0) return;

    let frame = 0;
    const update = () => {
      const last = items[items.length - 1];
      // 到底时直接高亮最后一项：文末内容不够长，最后一节滚不到顶部，
      // 否则点了「拔高」却会因为它在判定线下方而高亮成上一节
      const scrolledToBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (scrolledToBottom && last) {
        setActiveId(last.id);
        return;
      }

      let current = items[0]?.id ?? "";
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= ACTIVE_OFFSET) current = item.id;
        else break;
      }
      setActiveId(current);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items]);

  return { items, activeId };
}

export default function ArticleToc({ items, activeId }: { items: TocItem[]; activeId: string }) {
  const prefersReduced = useReducedMotion();

  if (items.length === 0) return null;

  // 不能只靠 href 的默认跳转：hash 没变时（重复点同一项，或滚开后再点回当前节）
  // 浏览器不会重新滚动，看起来像点了没反应。这里自己滚，并把 hash 换成
  // replaceState，避免每跳一节就多一条历史记录。
  const jump = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <nav
      aria-label="目录"
      className="sticky top-28 hidden max-h-[calc(100vh-9rem)] overflow-y-auto pb-8 lg:block"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
        目录
      </p>
      <ul>
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(e) => jump(e, item.id)}
                aria-current={isActive ? "location" : undefined}
                className={`-ml-px block border-l-2 py-1 pr-2 text-sm leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  item.level === 3 ? "pl-6" : "pl-3"
                } ${
                  isActive
                    ? "border-accent text-accent"
                    : "border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-500 dark:hover:text-stone-200"
                }`}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
