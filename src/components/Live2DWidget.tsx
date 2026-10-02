import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Home, Sparkles, X } from "lucide-react";
import { useLive2D } from "@/hooks/useLive2D";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const MOBILE_BREAKPOINT = 768;
const MOBILE_SCALE = 0.55;

export default function Live2DWidget() {
  const { message, showMessage, hostRef, dragHandlers, isLoaded, changeMotion, getHiddenMessage } =
    useLive2D();
  const [hidden, setHidden] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const prefersReduced = useReducedMotion();

  // Detect mobile viewport and listen for resize
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleScrollTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleClose = () => {
    const msg = getHiddenMessage();
    if (msg) {
      showMessage(msg, 1300, true);
      setTimeout(() => setHidden(true), 1300);
    } else {
      setHidden(true);
    }
  };

  if (hidden) return null;

  return (
    <div
      className="waifu-container fixed bottom-0 right-0 z-30 select-none"
      style={{
        touchAction: "none",
        transformOrigin: "bottom right",
        transform: isMobile ? `scale(${MOBILE_SCALE})` : undefined,
      }}
    >
      {/* Tooltip */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.2 }}
            className="absolute -top-2 right-3 z-40 max-w-[220px] -translate-y-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700 shadow-md dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tool buttons (visible on hover, z-50 to sit above the canvas) */}
      <div className="absolute right-2 top-12 z-50 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100 [.waifu-container:hover_&]:opacity-100">
        <button
          onClick={handleScrollTop}
          aria-label="回到顶部"
          className="flex h-6 w-6 items-center justify-center rounded text-stone-400 transition-colors hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:hover:text-stone-200"
        >
          <Home size={14} />
        </button>
        <button
          onClick={changeMotion}
          aria-label="换个动作"
          className="flex h-6 w-6 items-center justify-center rounded text-stone-400 transition-colors hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:hover:text-stone-200"
        >
          <Sparkles size={14} />
        </button>
        <button
          onClick={handleClose}
          aria-label="隐藏看板娘"
          className="flex h-6 w-6 items-center justify-center rounded text-stone-400 transition-colors hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:hover:text-stone-200"
        >
          <X size={14} />
        </button>
      </div>

      {/* Canvas host — useLive2D 会在这里插入并管理 <canvas> */}
      <div
        ref={hostRef}
        onPointerDown={dragHandlers.onPointerDown}
        className={`transition-opacity ${isLoaded ? "opacity-100" : "opacity-0"}`}
        style={{ touchAction: "none" }}
      />
    </div>
  );
}
