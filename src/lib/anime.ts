/**
 * 文章封面用的随机二次元图。
 *
 * 为什么是 nekos.best：公开接口里少有的同时满足两个硬条件——
 * 支持 CORS（纯静态站只能在浏览器里直接请求）、返回画师信息（署名要用）。
 * 它只提供角色图（neko / waifu / husbando / kitsune），没有风景分类。
 *
 * 原图是 1–3 MB 的 PNG（1152×2048 这种），直接当封面会让一页拉十几 MB，
 * 所以统一过一层 wsrv.nl 缩到 640px 的 WebP，约 60 KB。
 *
 * 接口和代理都是第三方运行时依赖。任一出问题就返回空数组，
 * 上层会退回内置的 SVG 封面（CategoryCover），不会留下破图。
 */
export interface AnimeArt {
  /** 卡片封面用（宽 400，等比） */
  src: string;
  /** 阅读页/分类页那种大图用（宽 1200，等比） */
  heroSrc: string;
  /** 原图地址（nekos.best 的 CDN） */
  url: string;
  artistName: string;
  artistHref: string;
  sourceUrl: string;
}

const API = "https://nekos.best/api/v2/neko";
const BATCH = 20;

interface RawResult {
  url?: string;
  artist_name?: string;
  artist_href?: string;
  source_url?: string;
}

/**
 * 只按宽度等比缩放，不指定高度、也不裁切——所以只传 w，高度由原图比例决定。
 *
 * 前面试过两种裁切方案（居中裁、靠顶裁）都会把头切掉，而非等比拉伸又会让人物变形，
 * 所以这里保留完整原图，显示时用 object-contain 等比放进框里，
 * 空出来的部分由同一张图的模糊放大版垫底（见 AnimeCover），既不变形也不留死白。
 */
function proxied(url: string, width: number): string {
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&output=webp&q=80`;
}

let cache: AnimeArt[] = [];
let inflight: Promise<AnimeArt[]> | null = null;

async function fetchBatch(): Promise<AnimeArt[]> {
  try {
    const res = await fetch(`${API}?amount=${BATCH}`);
    if (!res.ok) return [];
    const json: { results?: RawResult[] } = await res.json();
    return (json.results ?? [])
      .filter((r): r is RawResult & { url: string } => Boolean(r.url))
      .map((r) => ({
        src: proxied(r.url, 400),
        heroSrc: proxied(r.url, 1200),
        url: r.url,
        artistName: r.artist_name ?? "",
        artistHref: r.artist_href ?? "",
        sourceUrl: r.source_url ?? "",
      }));
  } catch {
    return [];
  }
}

/** 已经取到的图，供组件做首屏渲染用（不发请求） */
export function peekAnimeArt(count: number): AnimeArt[] {
  return cache.slice(0, count);
}

/** 取一批图；同一页多个组件共用一次请求。失败返回空数组。 */
export async function loadAnimeArt(count: number): Promise<AnimeArt[]> {
  if (cache.length < count) {
    if (!inflight) {
      inflight = fetchBatch()
        .then((list) => {
          if (list.length > cache.length) cache = list;
          return cache;
        })
        .finally(() => {
          inflight = null;
        });
    }
    await inflight;
  }
  return cache.slice(0, count);
}
