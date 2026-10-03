import { useState } from "react";
import type { AnimeArt } from "@/lib/anime";

interface AnimeCoverProps {
  art: AnimeArt;
  /** 默认用卡片尺寸的图；大图传 art.heroSrc */
  src?: string;
  /** 前景图的附加类名（例如卡片悬停时的放大） */
  imgClassName?: string;
  /**
   * 图加载失败时通知外层。外层通常换成 art.fallback（本地图）并同步署名；
   * 外层换来的图再挂，才轮到本组件内部的兜底图。
   */
  onError?: () => void;
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
 * 外层换成兜底图后 URL 会变，所以失败要按 URL 记（记成布尔的话，
 * 换上新图也翻不回正常状态，卡片会一直卡在兜底图上）。
 * 外层没接住（没传 onError，或者兜底图本身也挂了）才用 FALLBACK_SRC。
 * 外层容器需要有 relative + overflow-hidden。
 */
export default function AnimeCover({ art, src, imgClassName = "", onError }: AnimeCoverProps) {
  const url = src ?? art.src;
  const [deadSrc, setDeadSrc] = useState<string | null>(null);

  const fail = () => {
    setDeadSrc(url);
    onError?.();
  };

  if (deadSrc === url) {
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
        onError={fail}
        className="absolute inset-0 h-full w-full scale-125 object-cover blur-xl"
      />
      <img
        src={url}
        alt=""
        onError={fail}
        className={`relative h-full w-full object-contain ${imgClassName}`}
      />
    </>
  );
}
