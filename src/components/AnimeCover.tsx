import type { AnimeArt } from "@/lib/anime";

interface AnimeCoverProps {
  art: AnimeArt;
  /** 默认用卡片尺寸的图；大图传 art.heroSrc */
  src?: string;
  /** 前景图的附加类名（例如卡片悬停时的放大） */
  imgClassName?: string;
}

/**
 * 等比显示插画：前景用 object-contain 完整显示，不变形也不裁切；
 * 空出来的部分由同一张图的模糊放大版垫底，所以不会留下难看的空白。
 *
 * 两张图是同一个 URL，浏览器只会下载一次。
 * 外层容器需要有 relative + overflow-hidden。
 */
export default function AnimeCover({ art, src, imgClassName = "" }: AnimeCoverProps) {
  const url = src ?? art.src;

  return (
    <>
      <img
        src={url}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-125 object-cover blur-xl"
      />
      <img src={url} alt="" className={`relative h-full w-full object-contain ${imgClassName}`} />
    </>
  );
}
