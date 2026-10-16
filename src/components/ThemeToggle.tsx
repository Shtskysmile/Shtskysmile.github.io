import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useEffect, useRef } from "react";
import { useThemeContext } from "@/context/ThemeContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const ABYSS_TAP_WINDOW_MS = 2000;
const ABYSS_TAP_COUNT = 7;

export default function ThemeToggle({ onAbyssShortcut }: { onAbyssShortcut?: () => void }) {
  const { theme, toggleTheme } = useThemeContext();
  const prefersReduced = useReducedMotion();
  const isDark = theme === "dark";
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );

  const handleClick = () => {
    toggleTheme();

    if (!window.matchMedia("(max-width: 767px)").matches) return;

    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);

    if (tapCount.current >= ABYSS_TAP_COUNT) {
      tapCount.current = 0;
      tapTimer.current = null;
      onAbyssShortcut?.();
      return;
    }

    tapTimer.current = setTimeout(() => {
      tapCount.current = 0;
      tapTimer.current = null;
    }, ABYSS_TAP_WINDOW_MS);
  };

  return (
    <button
      onClick={handleClick}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      data-live2d-hover="theme"
      className="flex items-center justify-center rounded-full p-2 text-stone-700 transition-colors hover:bg-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:text-stone-300 dark:hover:bg-stone-800"
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="sun"
            initial={prefersReduced ? false : { rotate: -90, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={prefersReduced ? undefined : { rotate: 90, scale: 0, opacity: 0 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.25 }}
          >
            <Sun size={20} />
          </motion.span>
        ) : (
          <motion.span
            key="moon"
            initial={prefersReduced ? false : { rotate: 90, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={prefersReduced ? undefined : { rotate: -90, scale: 0, opacity: 0 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.25 }}
          >
            <Moon size={20} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
