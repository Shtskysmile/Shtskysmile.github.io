import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from "react";
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

    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((heading): heading is HTMLElement => heading !== null);
    const updateAtBottom = () => {
      const last = items[items.length - 1];
      const scrolledToBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (scrolledToBottom && last) {
        setActiveId(last.id);
      }
    };

    let observer: IntersectionObserver | null = null;
    const observeHeadings = () => {
      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          const crossingHeading = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
          if (crossingHeading) setActiveId((crossingHeading.target as HTMLElement).id);
          updateAtBottom();
        },
        {
          // Observe a one-pixel band at the old active-heading threshold.
          rootMargin: `-${ACTIVE_OFFSET}px 0px -${Math.max(0, window.innerHeight - ACTIVE_OFFSET - 1)}px 0px`,
          threshold: 0,
        },
      );
      headings.forEach((heading) => observer?.observe(heading));
    };
    observeHeadings();

    const first = items[0];
    if (first) setActiveId(first.id);
    updateAtBottom();

    window.addEventListener("scroll", updateAtBottom, { passive: true });
    window.addEventListener("resize", observeHeadings);
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", updateAtBottom);
      window.removeEventListener("resize", observeHeadings);
    };
  }, [items]);

  return { items, activeId };
}

export default function ArticleToc({ items, activeId }: { items: TocItem[]; activeId: string }) {
  const prefersReduced = useReducedMotion();
  const navRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [thumb, setThumb] = useState({ height: 100, top: 0, value: 0 });

  const syncThumb = useCallback(() => {
    const nav = navRef.current;
    const track = trackRef.current;
    if (!nav || !track) return;

    const trackHeight = track.clientHeight;
    const maxScroll = nav.scrollHeight - nav.clientHeight;
    const height = Math.min(
      trackHeight,
      Math.max(28, trackHeight * (nav.clientHeight / nav.scrollHeight)),
    );
    const maxTop = trackHeight - height;
    const value = maxScroll > 0 ? nav.scrollTop / maxScroll : 0;

    setThumb({ height, top: maxTop * value, value: Math.round(value * 100) });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const nav = navRef.current;
    if (!container || !nav) return;

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;

      const multiplier =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? nav.clientHeight
            : 1;
      nav.scrollTop += event.deltaY * multiplier;
      event.preventDefault();
    };

    syncThumb();
    // React delegates wheel events through a passive listener in some browsers.
    // A native non-passive listener lets the TOC own wheel gestures reliably.
    container.addEventListener("wheel", onWheel, { passive: false });
    nav.addEventListener("scroll", syncThumb, { passive: true });
    const observer = new ResizeObserver(syncThumb);
    observer.observe(nav);
    const list = nav.querySelector("ul");
    if (list) observer.observe(list);
    window.addEventListener("resize", syncThumb);

    return () => {
      container.removeEventListener("wheel", onWheel);
      nav.removeEventListener("scroll", syncThumb);
      observer.disconnect();
      window.removeEventListener("resize", syncThumb);
    };
  }, [items, syncThumb]);

  const scrollToPointer = (clientY: number) => {
    const nav = navRef.current;
    const track = trackRef.current;
    if (!nav || !track) return;

    const maxTop = track.clientHeight - thumb.height;
    const top = Math.min(
      maxTop,
      Math.max(0, clientY - track.getBoundingClientRect().top - thumb.height / 2),
    );
    const maxScroll = nav.scrollHeight - nav.clientHeight;
    nav.scrollTop = maxTop > 0 ? (top / maxTop) * maxScroll : 0;
  };

  const onScrollbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nav = navRef.current;
    if (!nav) return;

    const page = nav.clientHeight * 0.9;
    switch (event.key) {
      case "ArrowDown":
        nav.scrollTop += 40;
        break;
      case "ArrowUp":
        nav.scrollTop -= 40;
        break;
      case "PageDown":
        nav.scrollTop += page;
        break;
      case "PageUp":
        nav.scrollTop -= page;
        break;
      case "Home":
        nav.scrollTop = 0;
        break;
      case "End":
        nav.scrollTop = nav.scrollHeight;
        break;
      default:
        return;
    }
    event.preventDefault();
  };

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
    <div
      ref={containerRef}
      className="sticky top-28 hidden h-[calc(100vh-9rem)] min-h-0 gap-2 lg:flex"
    >
      <nav
        ref={navRef}
        id="article-toc"
        aria-label="目录"
        className="toc-scroll-container min-h-0 flex-1 overscroll-contain overflow-y-auto pb-8 pr-1"
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
      <div
        ref={trackRef}
        role="scrollbar"
        aria-label="目录滚动条"
        aria-controls="article-toc"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={thumb.value}
        tabIndex={0}
        onKeyDown={onScrollbarKeyDown}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragging.current = true;
          scrollToPointer(event.clientY);
        }}
        onPointerMove={(event) => {
          if (dragging.current) scrollToPointer(event.clientY);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        className="relative my-1 w-1.5 shrink-0 touch-none rounded-full bg-stone-200 outline-none focus-visible:ring-2 focus-visible:ring-accent dark:bg-stone-800"
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 rounded-full bg-blue-400 dark:bg-blue-500"
          style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
        />
      </div>
    </div>
  );
}
