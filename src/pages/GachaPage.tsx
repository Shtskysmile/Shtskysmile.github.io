import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Dices } from "lucide-react";
import AnimeCover from "@/components/AnimeCover";
import ArtCredit from "@/components/ArtCredit";
import { drawArt, type AnimeArt } from "@/lib/anime";

const SITE_NAME = "Shtskysmile 的个人主页";

/** 抽卡：每次现抽一张随机二次元插画，绕过缓存所以每抽都是新的 */
export default function GachaPage() {
  const [art, setArt] = useState<AnimeArt | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [count, setCount] = useState(0);

  const draw = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    const next = await drawArt();
    if (next) {
      setArt(next);
      setCount((n) => n + 1);
    } else {
      setFailed(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    draw();
  }, [draw]);

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
          {art ? (
            <AnimeCover art={art} src={art.heroSrc} />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-stone-500 dark:text-stone-400">
              {failed ? "没抽到：插画接口没响应，过会儿再试。" : "正在抽……"}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-4">
          <ArtCredit art={art ?? undefined} className="min-w-0 flex-1" />
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
      </div>
    </>
  );
}
