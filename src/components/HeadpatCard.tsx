import { useState } from "react";
import { Heart, Sparkles, Star } from "lucide-react";
import Card from "@/components/ui/Card";

const NOTES = [
  "你来了。这里的位置，给你留着。",
  "嗯……摸摸头，也不是不可以。",
  "今天辛苦了。先休息一下吧。",
  "耳朵有点痒……轻一点。",
  "再待一会儿。我还有东西想给你。",
  "隐藏成就：猫娘的信任。攒下的星星，都给你。",
];

/** 原生按钮同时支持触屏和键盘；彩蛋只保留在这次首页停留中。 */
export default function HeadpatCard() {
  const [pats, setPats] = useState(0);
  const isSecret = pats === 5;

  return (
    <Card className="headpat-card relative overflow-hidden !p-5">
      <section aria-labelledby="headpat-title">
        <div className="flex items-center justify-between gap-2">
          <h2 id="headpat-title" className="text-sm font-medium text-stone-700 dark:text-stone-200">
            香子兰的摸摸头
          </h2>
          <span className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {isSecret ? "今日份快乐已签收" : "今天也在等你"}
          </span>
        </div>

        <button
          type="button"
          aria-label="摸摸香子兰的头"
          aria-describedby="headpat-note"
          className="headpat-button group relative mx-auto mt-3 block w-full max-w-64 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 dark:focus-visible:ring-offset-black"
          onClick={() => setPats((previous) => (previous === 5 ? 1 : previous + 1))}
        >
          <span className="headpat-portrait relative mx-auto mb-3 block">
            <span
              key={pats}
              className={`headpat-character relative block aspect-square overflow-hidden rounded-2xl ${pats > 0 ? "headpat-petted" : ""}`}
            >
              <img
                src="/images/mascot/vanilla-soft.png"
                alt="《NEKOPARA》香子兰 Vanilla：白发猫耳、蓝色蝴蝶结的猫娘"
                width={779}
                height={886}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="relative z-10 h-full w-full select-none object-contain"
              />
              {pats > 0 && (
                <span className="headpat-heart" aria-hidden="true">
                  <Heart size={22} fill="currentColor" />
                </span>
              )}
            </span>
            {isSecret && (
              <span
                className="headpat-secret-stars pointer-events-none absolute inset-0 z-20 text-amber-400"
                aria-hidden="true"
              >
                <Sparkles size={25} className="absolute left-0 top-12" />
                <Heart size={21} className="absolute right-1 top-20 fill-rose-300 text-rose-300" />
                <Star size={17} className="absolute bottom-12 left-2 fill-current" />
                <Sparkles size={20} className="absolute bottom-4 right-4" />
              </span>
            )}
          </span>
          <span className="mb-2 inline-block text-xs text-stone-500 transition-colors group-hover:text-accent dark:text-stone-400">
            {isSecret ? "最喜欢和你待在一起了" : "摸摸头，领一张小纸条"}
          </span>
        </button>

        <p
          id="headpat-note"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="headpat-note mt-3 flex min-h-20 items-center justify-center rounded-xl border border-dashed px-4 py-3 text-center text-sm leading-relaxed text-stone-600 dark:text-stone-300"
        >
          {NOTES[pats]}
        </p>
        <div
          className="mt-4 flex justify-center gap-2"
          role="img"
          aria-label={`已经摸摸头 ${pats} 次，集齐 5 颗星星有惊喜`}
        >
          {Array.from({ length: 5 }, (_, index) => (
            <Star
              key={index}
              size={13}
              aria-hidden="true"
              className={
                index < pats
                  ? "fill-amber-400 text-amber-400"
                  : "text-stone-300 dark:text-stone-600"
              }
            />
          ))}
        </div>
        <p className="mt-3 text-center text-[10px] leading-relaxed text-stone-500 dark:text-stone-400">
          <a
            href="https://www.pngfind.com/mpng/hJiTJwR_art-id-vanilla-nekopara-png-transparent-png/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded underline decoration-stone-300 underline-offset-2 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            立绘来源：PngFind · 香子兰 Vanilla
          </a>
          <br />© NEKO WORKs · 互动台词为本站创作
        </p>
      </section>
    </Card>
  );
}
