import { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { Dices } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { SCHOOL_EMBLEMS, BLOG_CATEGORIES, HIDDEN_CATEGORY_ID } from "@/lib/constants";

/** Minimum downward scroll (px) before hiding. Upward scroll shows immediately. */
const HIDE_DELTA = 10;

function categoryLinkClass({ isActive }: { isActive: boolean }) {
  return `transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
    isActive
      ? "text-accent"
      : "text-stone-500 hover:text-accent dark:text-stone-400 dark:hover:text-accent"
  }`;
}

function Logo() {
  return (
    <span
      className="font-heading text-lg text-stone-800 dark:text-stone-100 sm:text-xl"
      aria-label="Shtskysmile"
    >
      Shtskysmile
    </span>
  );
}

export default function Header() {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    // Tracks the scroll position where the current direction started.
    // Reset every time the direction reverses so the threshold
    // accumulates only for continuous movement in one direction.
    const anchor = { y: 0, direction: 0 }; // direction: -1 up, 0 idle, 1 down

    const handleScroll = () => {
      const currentY = window.scrollY;

      // Only auto-hide on mobile (below md breakpoint)
      if (window.innerWidth >= 768) {
        setHidden(false);
        lastScrollY.current = currentY;
        anchor.y = currentY;
        anchor.direction = 0;
        return;
      }

      const delta = currentY - lastScrollY.current;
      lastScrollY.current = currentY;

      if (delta === 0) return;

      const dir = delta > 0 ? 1 : -1;

      // Direction changed — reset anchor to current position
      if (dir !== anchor.direction) {
        anchor.y = currentY;
        anchor.direction = dir;
      }

      if (dir < 0) {
        // Scrolling UP — show header immediately, no threshold
        setHidden(false);
      } else if (currentY - anchor.y > HIDE_DELTA && currentY > 60) {
        // Scrolling DOWN — only hide after accumulating HIDE_DELTA px
        setHidden(true);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      data-header-hidden={hidden}
      className={`sticky top-0 z-40 border-b border-stone-200 bg-surface-light/80 backdrop-blur-md transition duration-300 dark:border-stone-800 dark:bg-surface-dark/80 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="flex items-center gap-5 px-4 py-3 sm:px-6">
        <div className="flex shrink-0 items-center gap-3">
          <a
            href="/"
            className="flex items-center text-stone-800 transition-colors hover:text-accent dark:text-stone-200"
            aria-label="首页"
          >
            <Logo />
          </a>
          <div className="flex items-center gap-2">
            {SCHOOL_EMBLEMS.map(({ name, src }) => (
              <span
                key={name}
                title={name}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white p-[3px]"
              >
                <img
                  src={src}
                  alt={`${name}校徽`}
                  width={22}
                  height={22}
                  className="h-full w-full"
                />
              </span>
            ))}
          </div>
        </div>

        {/* 分隔线：把站名/校徽和分类导航分开，否则八个元素挤成一排 */}
        <span
          aria-hidden="true"
          className="hidden h-5 w-px shrink-0 bg-stone-200 dark:bg-stone-700 md:block"
        />

        {/* 分类导航：和站名同一行，窄屏放不下就隐藏（分类仍可从 /blogs 进入） */}
        <nav aria-label="文章分类" className="hidden min-w-0 flex-1 md:block">
          <ul className="flex items-center gap-x-3 text-sm lg:gap-x-5">
            <li>
              <NavLink to="/blogs" end className={categoryLinkClass}>
                全部文章
              </NavLink>
            </li>
            {/* 隐藏分类（深渊区域）不进导航，靠 Konami 秘籍进入 */}
            {BLOG_CATEGORIES.filter((category) => category.id !== HIDDEN_CATEGORY_ID).map(
              (category) => (
                <li key={category.id}>
                  <NavLink to={`/categories/${category.id}`} className={categoryLinkClass}>
                    {category.name}
                  </NavLink>
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <NavLink
            to="/gacha"
            aria-label="抽卡"
            title="抽卡"
            className="flex items-center justify-center rounded-full p-2 text-stone-700 transition-colors hover:bg-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            <Dices size={18} />
          </NavLink>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
