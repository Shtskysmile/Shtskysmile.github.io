/**
 * 文章封面用的随机二次元图。
 *
 * 为什么是 nekos.best：公开接口里少有的同时满足两个硬条件——
 * 支持 CORS（纯静态站只能在浏览器里直接请求）、返回画师信息（署名要用）。
 * 它只提供角色图（neko / waifu / husbando / kitsune），没有风景分类。
 *
 * 关于内容分级：这个接口**不提供 NSFW 内容**，所以没有可加的过滤器。
 * 实测（2026-10）——返回字段只有 url / artist_name / artist_href / source_url /
 * dimensions，没有任何 rating 或 tag；/v2/nsfw、/lewd、/hentai、/ero、/ecchi、
 * /r18 全部 404，而 4 个正常分类都是 200。
 * 注意这只是「接口没有该分类」，不等于官方出具了 SFW 承诺，个别图仍可能擦边。
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
/** 接口单次返回的上限（传更大的 amount 也只给 20 张，实测过） */
const API_PAGE = 20;

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

function toArt(r: RawResult & { url: string }): AnimeArt {
  return {
    src: proxied(r.url, 400),
    heroSrc: proxied(r.url, 1200),
    url: r.url,
    artistName: r.artist_name ?? "",
    artistHref: r.artist_href ?? "",
    sourceUrl: r.source_url ?? "",
  };
}

async function request(amount: number): Promise<AnimeArt[]> {
  try {
    const res = await fetch(`${API}?amount=${amount}`);
    if (!res.ok) return [];
    const json: { results?: RawResult[] } = await res.json();
    return (json.results ?? [])
      .filter((r): r is RawResult & { url: string } => Boolean(r.url))
      .map(toArt);
  } catch {
    return [];
  }
}

/** 已经取到的图，供组件做首屏渲染用（不发请求） */
export function peekAnimeArt(count: number): AnimeArt[] {
  return cache.slice(0, count);
}

/** 取形象：同一页多个组件共用一次请求；不够 count 张时会多取几页。失败返回空数组。 */
export async function loadAnimeArt(count: number): Promise<AnimeArt[]> {
  if (cache.length < count) {
    if (!inflight) {
      const pages = Math.max(1, Math.ceil(count / API_PAGE));
      inflight = Promise.all(Array.from({ length: pages }, () => request(API_PAGE)))
        .then((batches) => {
          // 多页是各自随机取的，可能重复，按 url 去重
          const seen = new Set<string>();
          const merged: AnimeArt[] = [];
          for (const art of batches.flat()) {
            if (seen.has(art.url)) continue;
            seen.add(art.url);
            merged.push(art);
          }
          if (merged.length > cache.length) cache = merged;
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

/**
 * 按序号取图（序号来自 lib/posts 的 postIndex，即文章在全局列表里的位置）。
 * 卡片和阅读页用同一个序号，所以同一篇文章两处看到的是同一张图；
 * 序号互不相同，所以只要文章数不超过图片数，列表里就不会出现重复的图。
 * 不用哈希是因为哈希取模必然撞车——15 篇映射到 20 个槽位时至少撞一对的概率
 * 接近 99%，那正是「列表里有两张一样的图」的来源。
 */
export function pickArt(batch: AnimeArt[], index: number): AnimeArt | undefined {
  if (batch.length === 0) return undefined;
  return batch[index % batch.length];
}

/** 抽卡用：绕开缓存，每次现取一张新的随机图 */
export async function drawArt(): Promise<AnimeArt | null> {
  const list = await request(1);
  return list[0] ?? null;
}
