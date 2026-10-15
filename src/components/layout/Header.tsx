import { useState, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Dices, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "@/components/ThemeToggle";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SCHOOL_EMBLEMS, BLOG_CATEGORIES, HIDDEN_CATEGORY_ID } from "@/lib/constants";

/** Minimum downward scroll (px) before hiding. Upward scroll shows immediately. */
const HIDE_DELTA = 10;

/** 隐藏分类（深渊区域）不进导航，靠 Konami 秘籍进入 */
const NAV_CATEGORIES = BLOG_CATEGORIES.filter((category) => category.id !== HIDDEN_CATEGORY_ID);

const MOBILE_MENU_ID = "mobile-category-menu";

function categoryLinkClass({ isActive }: { isActive: boolean }) {
  return `transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
    isActive
      ? "text-accent"
      : "text-stone-500 hover:text-accent dark:text-stone-400 dark:hover:text-accent"
  }`;
}

function mobileCategoryLinkClass({ isActive }: { isActive: boolean }) {
  return `block rounded-lg px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
    isActive
      ? "bg-stone-100 font-medium text-accent dark:bg-stone-800"
      : "text-stone-600 hover:bg-stone-100 hover:text-accent dark:text-stone-300 dark:hover:bg-stone-800"
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
  const [menuOpen, setMenuOpen] = useState(false);
  const lastScrollY = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    // 菜单开着时不参与滚动隐藏：面板跟着 header 一起滑走会很突兀
    if (menuOpen) {
      setHidden(false);
      return;
    }

    // 重新挂监听时以当前滚动位置为基准，避免把菜单开关期间的位移算成一次滚动方向
    lastScrollY.current = window.scrollY;

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
  }, [menuOpen]);

  // 点分类跳转后菜单不应留在屏幕上（同一分类重复点击时 pathname 不变，所以也在链接上关）
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // 视口回到 md 以上时收起：那时汉堡按钮已隐藏，菜单会挂在一个没有开关的布局上
  useEffect(() => {
    if (!menuOpen) return;
    const query = window.matchMedia("(min-width: 768px)");
    const handleChange = () => {
      if (query.matches) setMenuOpen(false);
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, [menuOpen]);

  // Esc 收起并把焦点还给开关；点击面板和开关之外的地方也收起
  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [menuOpen]);

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

        {/* 分类导航：和站名同一行，窄屏放不下，改由汉堡菜单承载（见下方面板） */}
        <nav aria-label="文章分类" className="hidden min-w-0 flex-1 md:block">
          <ul className="flex items-center gap-x-3 text-sm lg:gap-x-5">
            <li>
              <NavLink to="/blogs" end className={categoryLinkClass}>
                全部文章
              </NavLink>
            </li>
            {NAV_CATEGORIES.map((category) => (
              <li key={category.id}>
                <NavLink to={`/categories/${category.id}`} className={categoryLinkClass}>
                  {category.name}
                </NavLink>
              </li>
            ))}
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
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => {
              setMenuOpen((open) => !open);
              setHidden(false);
            }}
            aria-label={menuOpen ? "关闭分类菜单" : "打开分类菜单"}
            aria-expanded={menuOpen}
            aria-controls={MOBILE_MENU_ID}
            className="flex items-center justify-center rounded-full p-2 text-stone-700 transition-colors hover:bg-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 md:hidden dark:text-stone-300 dark:hover:bg-stone-800"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* 手机端分类抽屉：绝对定位悬浮在内容之上，避免展开时把页面往下推 */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            ref={menuRef}
            initial={prefersReduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? undefined : { opacity: 0, y: -8 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.18 }}
            className="absolute inset-x-0 top-full border-b border-stone-200 bg-surface-light shadow-lg md:hidden dark:border-stone-800 dark:bg-surface-dark"
          >
            <nav id={MOBILE_MENU_ID} aria-label="文章分类">
              <ul className="flex flex-col gap-1 px-4 py-3 text-sm sm:px-6">
                <li>
                  <NavLink
                    to="/blogs"
                    end
                    onClick={() => setMenuOpen(false)}
                    className={mobileCategoryLinkClass}
                  >
                    全部文章
                  </NavLink>
                </li>
                {NAV_CATEGORIES.map((category) => (
                  <li key={category.id}>
                    <NavLink
                      to={`/categories/${category.id}`}
                      onClick={() => setMenuOpen(false)}
                      className={mobileCategoryLinkClass}
                    >
                      {category.name}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
