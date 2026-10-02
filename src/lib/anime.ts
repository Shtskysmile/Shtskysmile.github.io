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
  /** 卡片封面用（2:1），可直接作为 img src */
  src: string;
  /** 分类页那种很宽的头图用（4:1） */
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
 * 用 fit=fill 把图**缩放**到目标尺寸，而不是 fit=cover 那样裁切。
 *
 * 原图是竖版的角色插画（1152×2048 这类），裁切方案（哪怕靠顶部对齐）仍会切掉
 * 头部；改成非等比缩放后整张图都保留——竖版图相当于把宽度拉伸，
 * 横版图相当于把高度压缩。代价是画面会变形，换来的是构图完整。
 */
function proxied(url: string, width: number, height: number): string {
  return (
    `https://wsrv.nl/?url=${encodeURIComponent(url)}` +
    `&w=${width}&h=${height}&fit=fill&output=webp&q=80`
  );
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
        src: proxied(r.url, 640, 320),
        heroSrc: proxied(r.url, 1200, 300),
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
