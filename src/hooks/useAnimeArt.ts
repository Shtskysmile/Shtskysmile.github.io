import { useEffect, useState } from "react";
import { fetchRemoteArt, localArt, type AnimeArt } from "@/lib/anime";

/**
 * 优先用在线接口的图；接口取不到（Cloudflare 挑战、断网、超时）就退回本地图集。
 *
 * 初始值直接给本地图集，所以首屏立刻有图，不会先空一下再冒出来。
 * 只有接口拿到的数量够用时才切换——不够的话宁可用本地那份，
 * 否则图片数少于文章数会导致封面重样。
 */
export function useAnimeArt(count: number): AnimeArt[] {
  const [art, setArt] = useState<AnimeArt[]>(localArt);

  useEffect(() => {
    let alive = true;
    fetchRemoteArt(count).then((remote) => {
      if (alive && remote.length >= count) setArt(remote);
    });
    return () => {
      alive = false;
    };
  }, [count]);

  return art;
}
