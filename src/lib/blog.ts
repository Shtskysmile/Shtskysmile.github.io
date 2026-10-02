/** Shared blog utilities – date formatting, reading time, slug extraction */

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays} 天前`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} 周前`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} 个月前`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years} 年前`;
}

export function formatAbsoluteDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function estimateReadingTime(markdown: string | null): string {
  if (!markdown) return "1 分钟阅读";
  const words = markdown.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} 分钟阅读`;
}

/** Extract slug from blogUrl, e.g. "getting-started.md" → "getting-started" */
export function blogSlug(blogUrl: string): string {
  return blogUrl.replace(/\.md$/, "");
}

/**
 * 封面构图的确定性 seed。由 slug 推出而不是取列表下标——同一篇文章
 * 在「全部文章」和分类页里的下标不同，用下标会让两处封面不一致。
 */
export function coverSeed(blogUrl: string): number {
  let hash = 0;
  for (const ch of blogUrl) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return hash;
}
