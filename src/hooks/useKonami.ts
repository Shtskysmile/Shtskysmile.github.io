import { useEffect, useRef } from "react";

/** 魂斗罗秘籍：↑↑↓↓←→←→BA */
const SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
] as const;

/**
 * 监听 Konami 秘籍，按完整个序列时调用 onComplete。
 * 按错时不从头重来：如果按下的键恰是序列开头，从那里接着数（比如按了 ↑↑ 后
 * 又按 ↑，进度退到 1 而不是 0）。字母键不区分大小写。
 */
export function useKonami(onComplete: () => void) {
  const callbackRef = useRef(onComplete);
  callbackRef.current = onComplete;

  useEffect(() => {
    let progress = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === SEQUENCE[progress]) {
        progress += 1;
        if (progress === SEQUENCE.length) {
          progress = 0;
          callbackRef.current();
        }
      } else {
        progress = key === SEQUENCE[0] ? 1 : 0;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
