import { useCallback, useEffect, useState } from "react";
import type { AnimeArt } from "@/lib/anime";

/**
 * 接口图加载失败时换成它自带的本地兜底图。
 *
 * 必须返回整张 art 而不是只换 src：署名组件拿的是同一个 art，
 * 只换图不换署名的话，会拿接口图的画师去署一张本地图。
 */
export function useCoverArt(art?: AnimeArt | null) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = art?.src;

  // 换图时清掉失败记录。批次整站只决定一次，所以这里实际只在「还没决定 → 决定好」时跑一次
  useEffect(() => {
    setFailedSrc(null);
  }, [src]);

  const resolved = art?.fallback && failedSrc === art.src ? art.fallback : art;

  return {
    art: resolved ?? undefined,
    onError: useCallback(() => setFailedSrc(src ?? null), [src]),
  };
}
