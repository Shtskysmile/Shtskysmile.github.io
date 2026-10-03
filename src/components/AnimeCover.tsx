import { useState } from "react";
import type { AnimeArt } from "@/lib/anime";

interface AnimeCoverProps {
  art: AnimeArt;
  /** 默认用卡片尺寸的图；大图传 art.heroSrc */
  src?: string;
  /** 前景图的附加类名（例如卡片悬停时的放大） */
  imgClassName?: string;
}

/**
 * 接口或代理挂掉、图片 403 时的兜底图。
 * 作者 David Revoy，许可 CC BY 4.0（要求署名），原图：
 * https://commons.wikimedia.org/wiki/File:2021-05-20_Erreur-404_illustration_by-David-Revoy.jpg
 * 之所以自托管而不外链——兜底图本身要是在网络上取不到，就等于没有兜底。
 */
const FALLBACK_SRC = "/images/fallback/sorry.jpg";

/**
 * 等比显示插画：前景用 object-contain 完整显示，不变形也不裁切；
 * 空出来的部分由同一张图的模糊放大版垫底，所以不会留下难看的空白。
 *
 * 两张图是同一个 URL，浏览器只会下载一次。
 * 任意一张加载失败就整体换成兜底图（避免出现破图）。
 * 外层容器需要有 relative + overflow-hidden。
 */
export default function AnimeCover({ art, src, imgClassName = "" }: AnimeCoverProps) {
  const [failed, setFailed] = useState(false);
  const url = src ?? art.src;

  if (failed) {
    return (
      <img
        src={FALLBACK_SRC}
        alt="插画加载失败"
        title="插画加载失败 · 兜底插画 by David Revoy（CC BY 4.0）"
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <>
      <img
        src={url}
        alt=""
        aria-hidden="true"
        onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full scale-125 object-cover blur-xl"
      />
      <img
        src={url}
        alt=""
        onError={() => setFailed(true)}
        className={`relative h-full w-full object-contain ${imgClassName}`}
      />
    </>
  );
}
