import blogsData from "@content/blogs.json";
import type { BlogPost } from "@/types/content";

/**
 * 全部文章。blogs.json 里的顺序既决定展示顺序，也是封面配图的依据，
 * 所以不要随意调整数组顺序——那会让每篇文章的封面图全部换一轮。
 */
export const allPosts = blogsData as BlogPost[];

const indexByUrl = new Map(allPosts.map((post, i) => [post.blogUrl, i]));

/**
 * 文章在全局列表里的序号。
 * 封面图按序号分配而不是哈希：哈希取模必然撞车——15 篇映射到 20 个槽位时，
 * 至少撞一对的概率接近 99%，表现就是列表里出现两张相同的图；
 * 序号则保证只要文章数不超过图片数，每篇都不重样。
 * 卡片和阅读页都用同一个序号，所以同一篇文章两处显示的是同一张图。
 */
export function postIndex(blogUrl: string): number {
  return indexByUrl.get(blogUrl) ?? 0;
}
