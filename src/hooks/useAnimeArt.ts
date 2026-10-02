import { useEffect, useState } from "react";
import { loadAnimeArt, peekAnimeArt, type AnimeArt } from "@/lib/anime";

/**
 * 取 count 张随机二次元封面。
 * 同一页里多个组件调用只会发一次请求（lib/anime.ts 里做了批量和缓存），
 * 取到之前先给已经缓存的部分，避免封面闪一下。
 */
export function useAnimeArt(count: number): AnimeArt[] {
  const [art, setArt] = useState<AnimeArt[]>(() => peekAnimeArt(count));

  useEffect(() => {
    let alive = true;
    loadAnimeArt(count).then((list) => {
      if (alive) setArt(list);
    });
    return () => {
      alive = false;
    };
  }, [count]);

  return art;
}
