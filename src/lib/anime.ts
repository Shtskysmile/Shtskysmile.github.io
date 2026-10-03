import creditsData from "@content/anime.json";

/**
 * 自托管的二次元插画集。
 *
 * 为什么不用在线接口：nekos.best 及其图片 CDN 对**浏览器** User-Agent 会返回
 * Cloudflare 的 403 挑战页（实测 iPhone / Android / 桌面 Chrome 都是 403，
 * 只有脚本类的 UA 能过），表现就是手机和桌面都可能拿不到图、封面退化成渐变色块；
 * 再加一层 wsrv.nl 代理又多一个不确定的第三方。
 * 现在图片和署名都在仓库里，运行时零请求，任何网络环境都能显示。
 *
 * 图片是 public/images/anime/<序号>.webp（800px 宽），署名在 content/anime.json。
 * 想换图就把文件替换掉、并同步 content/anime.json 里的对应条目。
 */
export interface AnimeArt {
  /** 卡片封面用 */
  src: string;
  /** 阅读页/分类页那种大图用（同一份文件，不做二次裁剪） */
  heroSrc: string;
  artistName: string;
  artistHref: string;
  sourceUrl: string;
}

interface CreditRow {
  file: string;
  artistName?: string;
  artistHref?: string;
  sourceUrl?: string;
}

export const animeArt: AnimeArt[] = (creditsData as CreditRow[]).map((row) => {
  const url = `/images/anime/${row.file}`;
  return {
    src: url,
    heroSrc: url,
    artistName: row.artistName ?? "",
    artistHref: row.artistHref ?? "",
    sourceUrl: row.sourceUrl ?? "",
  };
});

/**
 * 按序号取图（序号来自 lib/posts 的 postIndex，即文章在全局列表里的位置）。
 * 卡片和阅读页用同一个序号，所以同一篇文章两处看到的是同一张图；
 * 序号互不相同，所以只要文章数不超过图片数，列表里就不会出现重复的图。
 */
export function pickArt(batch: AnimeArt[], index: number): AnimeArt | undefined {
  if (batch.length === 0) return undefined;
  return batch[index % batch.length];
}

/** 抽卡：从图集里随机取一张 */
export function drawArt(): AnimeArt | null {
  if (animeArt.length === 0) return null;
  return animeArt[Math.floor(Math.random() * animeArt.length)] ?? null;
}
