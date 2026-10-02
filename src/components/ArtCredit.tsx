import type { AnimeArt } from "@/lib/anime";

interface ArtCreditProps {
  art?: AnimeArt;
  /** overlay 用于卡片封面上的角标，full 用于阅读页/分类页的说明行 */
  variant?: "full" | "overlay";
  className?: string;
}

const LINK = "underline-offset-4 transition-colors hover:text-accent hover:underline";

/**
 * 插画署名 + 原画链接。
 * overlay 变体在卡片上：卡片本身是「标题链接铺满整张卡」，所以这里要
 * relative + z-index 抬到那层遮罩之上，否则点不到。
 */
export default function ArtCredit({ art, variant = "full", className = "" }: ArtCreditProps) {
  if (!art) return null;

  const name = art.artistName || "画师未标注";
  const artHref = art.sourceUrl || art.artistHref;

  if (variant === "overlay") {
    return (
      <a
        href={artHref || undefined}
        target="_blank"
        rel="noopener noreferrer"
        title={art.sourceUrl ? `原画：${art.sourceUrl}` : undefined}
        className={`relative z-10 rounded-full bg-black/45 px-2 py-0.5 text-[10px] leading-tight text-white/90 transition-colors hover:bg-black/65 hover:text-white ${className}`}
      >
        插画：{name}
      </a>
    );
  }

  return (
    <p className={`text-xs text-stone-500 dark:text-stone-400 ${className}`}>
      插画：
      {art.artistHref ? (
        <a href={art.artistHref} target="_blank" rel="noopener noreferrer" className={LINK}>
          {name}
        </a>
      ) : (
        name
      )}
      {art.sourceUrl && (
        <>
          {" · "}
          <a href={art.sourceUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
            原画
          </a>
        </>
      )}
    </p>
  );
}
