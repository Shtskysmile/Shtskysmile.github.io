import { useId } from "react";
import { BLOG_CATEGORIES, DEFAULT_BLOG_CATEGORY } from "@/lib/constants";
import type { BlogCategoryId } from "@/types/content";

interface CategoryCoverProps {
  category?: BlogCategoryId;
  /** 决定构图变化，通常传文章在列表里的序号 */
  seed: number;
  className?: string;
}

/**
 * 分类封面：内联 SVG 而不是图片文件——不用准备素材、没有版权问题、
 * 不产生额外请求，也不用担心随机图会让列表每次刷新都变样。
 * 同一分类共用一套色调，用 seed 变化构图。
 */
export default function CategoryCover({ category, seed, className }: CategoryCoverProps) {
  const uid = useId();
  const meta =
    BLOG_CATEGORIES.find((c) => c.id === (category ?? DEFAULT_BLOG_CATEGORY)) ?? BLOG_CATEGORIES[0];
  const [from, to] = meta.colors;

  const gradientId = `${uid}-bg`;
  const glowId = `${uid}-glow`;

  const x2 = [0.2, 0.5, 0.8, 1][seed % 4] ?? 0.5;
  const glowX = 18 + ((seed * 37) % 110);
  const glowY = 14 + ((seed * 23) % 46);
  const glowR = 26 + ((seed * 13) % 18);
  const stripeOffset = (seed * 17) % 40;

  return (
    <svg viewBox="0 0 160 80" preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2={x2} y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <radialGradient id={glowId}>
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="160" height="80" fill={`url(#${gradientId})`} />

      <g stroke="#ffffff" strokeOpacity="0.1" strokeWidth="1">
        {[0, 1, 2, 3, 4].map((i) => {
          const x = i * 40 + stripeOffset - 40;
          return <line key={i} x1={x} y1="80" x2={x + 40} y2="0" />;
        })}
      </g>

      <circle cx={glowX} cy={glowY} r={glowR} fill={`url(#${glowId})`} />
      <circle cx={160 - glowX} cy={80 - glowY * 0.7} r={glowR * 0.7} fill={`url(#${glowId})`} />
    </svg>
  );
}
