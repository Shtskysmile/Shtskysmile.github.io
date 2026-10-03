import creditsData from "@content/anime.json";

/**
 * 插画来源分两层：
 *
 * 1. **优先走在线接口**（nekos.best + wsrv.nl 缩放），能拿到更多随机图。
 * 2. **取不到就用本地图集兜底**。本地这份是编译期就在仓库里的，
 *    所以任何网络环境下都有图可显示，不会出现空白或色块。
 *
 * 之所以必须有兜底：nekos.best 及其图片 CDN 对浏览器 User-Agent 会返回
 * Cloudflare 的 403 挑战页（实测 iPhone / Android / 桌面 Chrome 全部 403，
 * 只有脚本类 UA 能过），命中与否还取决于出口 IP——手机和部分桌面环境会直接拿不到图。
 */
export interface AnimeArt {
  /** 卡片封面用 */
  src: string;
  /** 阅读页/分类页那种大图用 */
  heroSrc: string;
  artistName: string;
  artistHref: string;
  sourceUrl: string;
  /**
   * 同一槽位的本地图。接口图加载失败时整张换掉它（连署名一起换），
   * 否则会拿接口图的画师名去署一张本地图。
   * 本地图集自己身上没有这个字段——它已经是最后一层了。
   */
  fallback?: AnimeArt;
}

interface CreditRow {
  file: string;
  artistName?: string;
  artistHref?: string;
  sourceUrl?: string;
}

interface RawResult {
  url?: string;
  artist_name?: string;
  artist_href?: string;
  source_url?: string;
}

const API = "https://nekos.best/api/v2/neko";
/** 接口单次返回上限（传更大的 amount 也只给 20 张，实测过） */
const API_PAGE = 20;
const RESIZE_WIDTH = 800;
/** 接口卡住时的上限：超过就当取不到，直接退回本地图集，不能让封面一直空着 */
const FETCH_TIMEOUT_MS = 8000;

/** 本地兜底图集：public/images/anime/<序号>.webp，署名在 content/anime.json */
export const localArt: AnimeArt[] = (creditsData as CreditRow[]).map((row) => {
  const url = `/images/anime/${row.file}`;
  return {
    src: url,
    heroSrc: url,
    artistName: row.artistName ?? "",
    artistHref: row.artistHref ?? "",
    sourceUrl: row.sourceUrl ?? "",
  };
});

function proxied(url: string): string {
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${RESIZE_WIDTH}&output=webp&q=80`;
}

function toArt(r: RawResult & { url: string }): AnimeArt {
  const src = proxied(r.url);
  return {
    src,
    heroSrc: src,
    artistName: r.artist_name ?? "",
    artistHref: r.artist_href ?? "",
    sourceUrl: r.source_url ?? "",
  };
}

/** 调接口取一批图；任何失败（含 Cloudflare 403、断网、超时）都返回空数组 */
export async function fetchRemoteArt(count: number): Promise<AnimeArt[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const pages = Math.max(1, Math.ceil(count / API_PAGE));
    const batches = await Promise.all(
      Array.from({ length: pages }, () =>
        fetch(`${API}?amount=${API_PAGE}`, { signal: controller.signal })
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
      ),
    );

    const seen = new Set<string>();
    const out: AnimeArt[] = [];
    for (const json of batches as Array<{ results?: RawResult[] } | null>) {
      for (const r of json?.results ?? []) {
        if (!r.url || seen.has(r.url)) continue;
        seen.add(r.url);
        out.push(toArt(r as RawResult & { url: string }));
      }
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 给整批接口图各配一张同槽位的本地图。
 * 单张接口图挂掉只退那一张，不会连累整批——预加载校验要 8 秒，拿它挡首屏太慢。
 */
export function withLocalFallback(batch: AnimeArt[]): AnimeArt[] {
  return batch.map((art, i) => ({ ...art, fallback: localArt[i % localArt.length] }));
}

/**
 * 按序号取图（序号来自 lib/posts 的 postIndex，即文章在全局列表里的位置）。
 * 卡片和阅读页用同一个序号，所以同一篇文章两处看到的是同一张图；
 * 序号互不相同，所以只要文章数不超过图片数，列表里就不会出现重复的图。
 *
 * 返回值是三态：null = 图集还没决定好，调用方留白（先画一张再换掉就是「图片中途变」，
 * 正是要避免的）；undefined = 图集是空的，调用方退回内置 SVG；其余就是那张图。
 */
export function pickArt(batch: AnimeArt[] | null, index: number): AnimeArt | null | undefined {
  if (!batch) return null;
  if (batch.length === 0) return undefined;
  return batch[index % batch.length] ?? null;
}
