import { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Dices } from "lucide-react";
import AnimeCover from "@/components/AnimeCover";
import ArtCredit from "@/components/ArtCredit";
import { useAnimeArt } from "@/hooks/useAnimeArt";
import { useCoverArt } from "@/hooks/useCoverArt";
import type { AnimeArt } from "@/lib/anime";
import { allPosts } from "@/lib/posts";

const SITE_NAME = "Shtskysmile 的个人主页";

/** Fisher–Yates 洗牌，不改原数组 */
function shuffled<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** 抽卡：从当前图集里随机抽一张（能连上接口时就是接口那批，否则用本地兜底图集） */
export default function GachaPage() {
  const batch = useAnimeArt(allPosts.length + 2);
  const [art, setArt] = useState<AnimeArt | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [count, setCount] = useState(0);
  const cover = useCoverArt(art);
  /**
   * 牌堆：洗好后抽一张少一张，抽空了才重洗。
   * 图集只有二十来张，直接 Math.random() 是有放回抽取，抽几次就会撞重复。
   */
  const deckRef = useRef<AnimeArt[]>([]);

  const draw = useCallback(() => {
    // 图集还没决定好：先不抽，等它到了再由下面的 effect 补抽一次
    if (!batch) return;
    setLoading(true);
    setFailed(false);

    if (deckRef.current.length === 0) {
      const cards = shuffled(batch);
      const top = cards.length - 1;
      // 重洗后的第一张不能还是刚抽到的那张，否则整轮的第一抽看着像没反应
      if (art && top > 0 && cards[top] === art) {
        const head = cards[0]!;
        cards[0] = cards[top]!;
        cards[top] = head;
      }
      deckRef.current = cards;
    }

    const next = deckRef.current.pop();
    if (next) {
      setArt(next);
      setCount((n) => n + 1);
    } else {
      setFailed(true);
    }
    setLoading(false);
  }, [batch, art]);

  // 图集决定好了才自动抽一次，且只抽一次：batch 变化会让 draw 重建，
  // 不守一下的话会再自动抽一次，计数器莫名跳一格
  const drawnOnce = useRef(false);
  useEffect(() => {
    if (drawnOnce.current || !batch) return;
    drawnOnce.current = true;
    draw();
  }, [batch, draw]);

  return (
    <>
      <Helmet>
        <title>{`抽卡 | ${SITE_NAME}`}</title>
        <meta name="description" content="随机抽一张二次元插画，附画师与原画链接。" />
        <link rel="canonical" href="https://shtskysmile.github.io/gacha" />
      </Helmet>

      <div className="surface-panel mx-auto my-6 w-[calc(100%-2rem)] max-w-2xl p-5 sm:p-8">
        <h1 className="flex items-center gap-2 font-heading text-2xl text-stone-800 dark:text-stone-100">
          <Dices size={24} className="text-accent" />
          抽卡
        </h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          随机抽一张二次元插画。看到喜欢的，可以点署名里的「原画」去画师那边收藏。
        </p>

        <div className="relative mt-5 aspect-[3/4] w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-sm dark:border-stone-700 dark:bg-stone-900">
          {cover.art ? (
            <AnimeCover art={cover.art} src={cover.art.heroSrc} onError={cover.onError} />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-stone-500 dark:text-stone-400">
              {failed ? "图集里还没有图。" : "正在抽……"}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-4">
          <ArtCredit art={cover.art} className="min-w-0 flex-1" />
          <span className="shrink-0 text-xs text-stone-400 dark:text-stone-500">
            已抽 {count} 次
          </span>
        </div>

        <div className="mt-5 flex justify-center">
          <button
            onClick={draw}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-stone-900"
          >
            <Dices size={16} />
            {loading ? "抽卡中……" : "再抽一次"}
          </button>
        </div>

        {/* 深渊区域的线索 */}
        <p className="mt-6 text-center text-xs text-stone-300 dark:text-stone-600">
          顺带一提：这个站还有更深的一层。老掌机时代的一串按键能打开它。
        </p>
      </div>
    </>
  );
}
