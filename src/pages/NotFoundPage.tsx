import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, BookOpen, Dices } from "lucide-react";
import AnimeCover from "@/components/AnimeCover";
import ArtCredit from "@/components/ArtCredit";
import { pickArt } from "@/lib/anime";
import { useAnimeArt } from "@/hooks/useAnimeArt";
import { allPosts } from "@/lib/posts";

const LINK_BASE =
  "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

export default function NotFoundPage() {
  const location = useLocation();
  // 下标避开文章卡片（0..len-1）和分类页头图（len），拿一张别人没用到的当看板娘
  const animeArt = useAnimeArt(allPosts.length + 2);
  const mascot = pickArt(animeArt, allPosts.length + 1);

  return (
    <div className="surface-panel mx-auto my-10 w-[calc(100%-2rem)] max-w-2xl p-6 sm:p-10">
      <p className="text-center font-heading text-xs uppercase tracking-[0.3em] text-accent">404</p>

      {/* 看板娘 + 对话框 */}
      <div className="mt-5 flex flex-col items-center">
        <div className="relative max-w-md rounded-2xl border border-accent/30 bg-accent/10 px-5 py-3 text-sm leading-relaxed text-stone-700 dark:text-stone-200">
          抱歉……这个页面我找不到了。
          {/* 气泡尖角 */}
          <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-accent/30 bg-accent/10" />
        </div>

        {/* relative 不能省：AnimeCover 的模糊垫底是 absolute inset-0 */}
        <div className="relative mt-6 aspect-[3/4] w-full max-w-[16rem] overflow-hidden rounded-2xl border border-stone-200 shadow-sm dark:border-stone-700">
          {mascot ? (
            <AnimeCover art={mascot} src={mascot.heroSrc} />
          ) : (
            <img
              src="/images/fallback/sorry.jpg"
              alt="看板娘：抱歉，这个页面不存在"
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <div className="mt-2 text-center">
          {mascot ? (
            <ArtCredit art={mascot} />
          ) : (
            <p className="text-[11px] text-stone-400 dark:text-stone-500">
              插画 by David Revoy（CC BY 4.0）
            </p>
          )}
        </div>
      </div>

      <h1 className="mt-7 text-center font-heading text-2xl text-stone-800 dark:text-stone-100">
        页面不存在
      </h1>
      <p className="mt-3 text-center text-sm leading-relaxed text-stone-600 dark:text-stone-300">
        没有找到{" "}
        <code className="break-all rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-700 dark:bg-stone-800 dark:text-stone-300">
          {location.pathname}
        </code>
        ，它可能被移除、改了名字，或者只是你手滑了。
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className={`${LINK_BASE} border-accent/40 bg-accent/10 font-medium text-accent hover:bg-accent/20`}
        >
          <ArrowLeft size={16} />
          回首页
        </Link>
        <Link
          to="/blogs"
          className={`${LINK_BASE} border-stone-200 text-stone-600 hover:border-accent/50 hover:text-accent dark:border-stone-700 dark:text-stone-300`}
        >
          <BookOpen size={16} />
          看看文章
        </Link>
        <Link
          to="/gacha"
          className={`${LINK_BASE} border-stone-200 text-stone-600 hover:border-accent/50 hover:text-accent dark:border-stone-700 dark:text-stone-300`}
        >
          <Dices size={16} />
          抽张图压压惊
        </Link>
      </div>
    </div>
  );
}
