import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { useReducedMotion } from "./useReducedMotion";

export function useLenis() {
  const lenisRef = useRef<Lenis | null>(null);
  const scheduleRafRef = useRef<(() => void) | null>(null);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (prefersReduced) {
      lenisRef.current?.destroy();
      lenisRef.current = null;
      return;
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 2,
    });

    lenisRef.current = lenis;
    let frame = 0;

    const scheduleRaf = () => {
      if (frame) return;
      frame = requestAnimationFrame(raf);
    };

    function raf(time: number) {
      frame = 0;
      lenis.raf(time);
      if (lenis.isScrolling) scheduleRaf();
    }

    const unsubscribe = lenis.on("virtual-scroll", scheduleRaf);
    scheduleRafRef.current = scheduleRaf;

    return () => {
      scheduleRafRef.current = null;
      unsubscribe();
      if (frame) cancelAnimationFrame(frame);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [prefersReduced]);

  const scrollTo = (target: number | string | HTMLElement) => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target);
      // Programmatic scrolls do not emit virtual-scroll, so start the frame loop here.
      scheduleRafRef.current?.();
    } else {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  };

  return { scrollTo };
}
