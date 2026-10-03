import { useEffect, useState } from "react";
import { fetchRemoteArt, localArt, withLocalFallback, type AnimeArt } from "@/lib/anime";

/**
 * 整站共用的一批图，只决定一次。
 *
 * 必须是「一次」：卡片页和阅读页各自取一批的话，同一篇文章在两处会显示不同的图。
 * 决定完成之前 useAnimeArt 返回 null，封面留白——先画本地图、等接口图到齐再整批换掉，
 * 视觉上就是「图片中途变了一张」，所以宁可晚一点点，只画一次。
 *
 * 批次不落盘，每次刷新页面重新决定，所以拿到的接口图一定是在**当前这台设备**上验过的。
 */
let batchPromise: Promise<AnimeArt[]> | null = null;

function resolveBatch(count: number): Promise<AnimeArt[]> {
  batchPromise ??= fetchRemoteArt(count).then((remote) =>
    // 数量不够就不用：图片数少于文章数会导致封面重样
    remote.length >= count ? withLocalFallback(remote) : localArt,
  );
  return batchPromise;
}

/**
 * 优先用在线接口的图；接口取不到（被拦、断网、超时）就退回本地图集。
 * 单张接口图挂掉由 AnimeCover 换成本地图，不再整批回退。
 *
 * @returns null 表示还没决定好，调用方应该留白而不是先画一张
 */
export function useAnimeArt(count: number): AnimeArt[] | null {
  const [art, setArt] = useState<AnimeArt[] | null>(null);

  useEffect(() => {
    let alive = true;
    resolveBatch(count).then((batch) => {
      if (alive) setArt(batch);
    });
    return () => {
      alive = false;
    };
  }, [count]);

  return art;
}
