import { useEffect, useRef, useState, useCallback } from "react";
import { init, type L2D } from "l2d";

/** 本地看板娘模型：香风智乃（Chino），银白长直发 */
const MODEL_PATH = "/live2d/chino/model.json";
/** 模型位置偏移 [x, y]，正 x 右移、正 y 上移，范围约 -2 ~ 2 */
const MODEL_POSITION: [number, number] = [0, 0.05];
/** 模型缩放，1 为原始大小 */
const MODEL_SCALE = 0.85;
/** 画布尺寸（CSS 像素） */
const CANVAS_WIDTH = 260;
const CANVAS_HEIGHT = 320;

interface Live2DConfig {
  waifu: {
    console_open_msg: string[];
    copy_message: string[];
    hidden_message: string[];
    motion_message: string[];
    hour_tips: Record<string, string[]>;
    referrer_message: Record<string, string[]>;
    referrer_hostname: Record<string, string[]>;
  };
  mouseover: Array<{ selector: string; text: string[] }>;
  click: Array<{ selector: string; text: string[] }>;
}

function getRandText(arr: string[]): string {
  if (arr.length === 0) return "";
  return arr[Math.floor(Math.random() * arr.length)] ?? "";
}

function getTimeGreeting(tips: Record<string, string[]>): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 7) return getRandText(tips["t5-7"] ?? []);
  if (hour >= 7 && hour < 11) return getRandText(tips["t7-11"] ?? []);
  if (hour >= 11 && hour < 14) return getRandText(tips["t11-14"] ?? []);
  if (hour >= 14 && hour < 17) return getRandText(tips["t14-17"] ?? []);
  if (hour >= 17 && hour < 19) return getRandText(tips["t17-19"] ?? []);
  if (hour >= 19 && hour < 21) return getRandText(tips["t19-21"] ?? []);
  if (hour >= 21 && hour < 23) return getRandText(tips["t21-23"] ?? []);
  if (hour >= 23 || hour < 5) return getRandText(tips["t23-5"] ?? []);
  return getRandText(tips["default"] ?? []);
}

/**
 * Build a referrer-aware welcome message.
 * - Direct visit (no referrer) → referrer_message.none
 * - Same-site navigation       → referrer_message.localhost
 * - Known external hostname    → referrer_hostname[host]
 * - Unknown external referrer  → referrer_message.default
 * Falls back to a time-based greeting when no referrer message matches.
 */
function getWelcomeMessage(config: Live2DConfig): string {
  const { referrer_message, referrer_hostname, hour_tips } = config.waifu;
  const referrer = document.referrer;

  if (!referrer) {
    return getRandText(referrer_message["none"] ?? []) || getTimeGreeting(hour_tips);
  }

  try {
    const refUrl = new URL(referrer);

    if (refUrl.hostname === window.location.hostname) {
      return getRandText(referrer_message["localhost"] ?? []) || getTimeGreeting(hour_tips);
    }

    for (const [hostname, messages] of Object.entries(referrer_hostname)) {
      if (refUrl.hostname === hostname) {
        return getRandText(messages);
      }
    }

    return getRandText(referrer_message["default"] ?? []);
  } catch {
    return getRandText(referrer_message["none"] ?? []) || getTimeGreeting(hour_tips);
  }
}

export interface UseLive2DReturn {
  message: string;
  showMessage: (text: string, duration?: number, priority?: boolean) => void;
  hostRef: React.RefObject<HTMLDivElement | null>;
  dragHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
  };
  isLoaded: boolean;
  changeMotion: () => void;
  getHiddenMessage: () => string;
}

export function useLive2D(): UseLive2DReturn {
  const [message, setMessage] = useState("");
  const [config, setConfig] = useState<Live2DConfig | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const l2dRef = useRef<L2D | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const priorityRef = useRef(false);
  const lastHoverRef = useRef<Element | null>(null);
  const dragRef = useRef({ dragging: false, startX: 0, offsetRight: 0 });
  const containerRef = useRef<HTMLElement | null>(null);

  // ── showMessage with priority ──────────────────────────────────────
  // If a priority message is active, non-priority messages are silently
  // dropped – this prevents casual mouseover tips from overriding
  // important messages (welcome, copy, hidden, etc.).
  const showMessage = useCallback((text: string, duration = 5000, priority = false) => {
    if (!text) return;
    if (priorityRef.current && !priority) return;

    setMessage(text);
    priorityRef.current = priority;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setMessage("");
      priorityRef.current = false;
    }, duration);
  }, []);

  /** 模型没有动作文件时，用 CSS 动画让画布轻微晃一下作为反馈 */
  const wiggleCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.classList.remove("live2d-wiggle");
    void canvas.offsetWidth; // 强制重排，让动画能被连续触发
    canvas.classList.add("live2d-wiggle");
  }, []);

  // ── Play a random motion group ─────────────────────────────────────
  // 香风智乃模型没有 .mtn 动作文件，getMotions() 会返回空对象，
  // 这时退回画布晃动，保证按钮始终有反馈。
  const changeMotion = useCallback(() => {
    const l2d = l2dRef.current;
    if (!l2d) return;

    let groups: string[] = [];
    try {
      groups = Object.keys(l2d.getMotions());
    } catch {
      groups = [];
    }

    if (groups.length === 0) {
      wiggleCanvas();
    } else {
      const group = groups[Math.floor(Math.random() * groups.length)] ?? "Idle";
      l2d.playMotion(group);
    }

    if (config) {
      showMessage(getRandText(config.waifu.motion_message), 3000, true);
    }
  }, [config, showMessage, wiggleCanvas]);

  const getHiddenMessage = useCallback(() => {
    return config ? getRandText(config.waifu.hidden_message) : "";
  }, [config]);

  // ── Load config ────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/live2d-config.json")
      .then((r) => r.json())
      .then((data: Live2DConfig) => setConfig(data))
      .catch(() => {
        // Config failed to load – widget renders without messages
      });
  }, []);

  // ── Init l2d and load the local model ──────────────────────────────
  // The canvas is created imperatively and removed on cleanup, so every
  // mount gets a fresh canvas. This avoids reusing a canvas that still
  // holds a WebGL context (which happens under React StrictMode's
  // double-mount in development) and keeps destroy/init clean.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas = document.createElement("canvas");
    canvas.id = "live2d";
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    canvas.style.width = `${CANVAS_WIDTH}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;
    canvas.style.maxWidth = "100%";
    canvas.style.position = "relative";
    canvas.style.touchAction = "none";
    canvas.style.transition = "opacity 0.3s ease";
    canvas.style.opacity = "0";
    host.appendChild(canvas);
    canvasRef.current = canvas;

    const l2d = init(canvas);
    if (!l2d) {
      canvas.remove();
      canvasRef.current = null;
      return;
    }
    l2dRef.current = l2d;

    let disposed = false;

    l2d.on("loaded", () => {
      if (disposed) return;
      setIsLoaded(true);
      canvas.style.opacity = "1";
    });

    // Tapping the character plays a reaction motion; chino 没有动作文件，
    // 于是退回画布晃动，点一下也有回应。
    l2d.on("tap", () => {
      let groups: string[] = [];
      try {
        groups = Object.keys(l2d.getMotions());
      } catch {
        groups = [];
      }
      if (groups.length === 0) {
        wiggleCanvas();
        return;
      }
      if (groups.includes("Taphead")) {
        l2d.playMotion("Taphead");
      } else if (groups.includes("Tap")) {
        l2d.playMotion("Tap");
      } else {
        l2d.playMotion(groups[Math.floor(Math.random() * groups.length)] ?? "Idle");
      }
    });

    l2d
      .load({
        path: MODEL_PATH,
        position: MODEL_POSITION,
        scale: MODEL_SCALE,
        logLevel: "warn",
      })
      .catch((err) => {
        console.error("[live2d] 模型加载失败：", err);
      });

    return () => {
      disposed = true;
      l2dRef.current?.destroy();
      l2dRef.current = null;
      canvasRef.current = null;
      canvas.remove();
      setIsLoaded(false);
    };
  }, [wiggleCanvas]);

  // ── Welcome message (referrer-aware, replaces plain hour greeting) ─
  useEffect(() => {
    if (!config || !isLoaded) return;
    const welcome = getWelcomeMessage(config);
    if (welcome) {
      showMessage(welcome, 6000, true);
    }
  }, [config, isLoaded, showMessage]);

  // ── Event-delegated mouseover & click handlers ─────────────────────
  // Uses document-level delegation so dynamically-loaded elements
  // (e.g. lazy ProjectList) are handled automatically.
  useEffect(() => {
    if (!config) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as Element;
      for (const entry of config.mouseover) {
        const matched = target.closest(entry.selector);
        if (matched) {
          if (matched !== lastHoverRef.current) {
            lastHoverRef.current = matched;
            showMessage(getRandText(entry.text), 3000);
          }
          return;
        }
      }
      lastHoverRef.current = null;
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      for (const entry of config.click) {
        if (target.closest(entry.selector)) {
          showMessage(getRandText(entry.text), 3000, true);
          return;
        }
      }
    };

    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("click", handleClick);
    };
  }, [config, showMessage]);

  // ── Copy event ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!config) return;
    const handler = () => {
      showMessage(getRandText(config.waifu.copy_message), 5000, true);
    };
    document.addEventListener("copy", handler);
    return () => document.removeEventListener("copy", handler);
  }, [config, showMessage]);

  // ── Visibility change – greet when tab refocused ───────────────────
  useEffect(() => {
    if (!config || !isLoaded) return;
    const handler = () => {
      if (document.visibilityState === "visible") {
        const greeting = getTimeGreeting(config.waifu.hour_tips);
        if (greeting) showMessage(greeting, 5000);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [config, isLoaded, showMessage]);

  // ── Console / DevTools detection (Easter egg) ──────────────────────
  // The regex's toString is lazily invoked when DevTools renders the
  // logged value, so the message appears when the user opens the console.
  useEffect(() => {
    if (!config || !isLoaded) return;
    const re = /live2d/;
    const msgs = config.waifu.console_open_msg;
    re.toString = () => {
      showMessage(getRandText(msgs), 5000, true);
      return "";
    };
    console.log(re);
  }, [config, isLoaded, showMessage]);

  // ── Drag handlers (x-axis only, snaps back to the right edge) ───────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const container = (e.currentTarget as HTMLElement).closest(".waifu-container");
    if (!container) return;
    containerRef.current = container as HTMLElement;

    const rect = container.getBoundingClientRect();
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      offsetRight: window.innerWidth - rect.right,
    };

    (container as HTMLElement).style.transition = "none";

    const onPointerMove = (ev: PointerEvent) => {
      if (!dragRef.current.dragging || !containerRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      containerRef.current.style.right = `${dragRef.current.offsetRight - dx}px`;
      containerRef.current.style.left = "auto";
    };

    const onPointerUp = () => {
      dragRef.current.dragging = false;
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);

      if (containerRef.current) {
        containerRef.current.style.transition = "right 0.4s ease";
        containerRef.current.style.right = "0px";
        containerRef.current.style.left = "auto";
      }
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }, []);

  return {
    message,
    showMessage,
    hostRef,
    dragHandlers: { onPointerDown },
    isLoaded,
    changeMotion,
    getHiddenMessage,
  };
}
