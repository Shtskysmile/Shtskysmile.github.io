import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Calendar, Clock, User } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useCoverArt } from "@/hooks/useCoverArt";
import CategoryCover from "@/components/CategoryCover";
import AnimeCover from "@/components/AnimeCover";
import ArtCredit from "@/components/ArtCredit";
import { formatRelativeDate, formatAbsoluteDate, blogSlug, coverSeed } from "@/lib/blog";
import type { AnimeArt } from "@/lib/anime";
import type { BlogPost } from "@/types/content";

interface BlogCardProps {
  post: BlogPost;
  index: number;
  /**
   * 随机二次元封面。null = 图集还没决定好，封面留白；
   * undefined = 图集是空的，退回内置 SVG 封面。
   */
  art?: AnimeArt | null;
}

/**
 * 竖向卡片：封面在上、信息在下，整张卡可点。
 * 布局参考 mypixiv-new：封面 2:1 定高、悬停放大，卡片上浮 + 阴影 + 描边变色；
 * 整卡可点用的是「标题链接 + after 铺满」的写法，保证一张卡只有一个链接
 * （把封面也包成链接会让读屏软件读两遍）。
 */
export default function BlogCard({ post, index, art }: BlogCardProps) {
  const prefersReduced = useReducedMotion();
  const cover = useCoverArt(art);
  const href = `/blogs/${blogSlug(post.blogUrl)}`;

  return (
    <motion.article
      initial={prefersReduced ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={prefersReduced ? { duration: 0 } : { duration: 0.35, delay: index * 0.06 }}
      className="article-card group relative flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-surface-card-light shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg dark:border-stone-700 dark:bg-surface-card-dark dark:hover:border-accent/40"
      data-live2d-hover="article-card"
    >
      {/* 封面优先级：手动配的图 > 随机二次元图 > 内置 SVG */}
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        {post.thumbnail ? (
          <img
            src={`/images/blog/${post.thumbnail}`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : art === null ? (
          // 图集还没决定好：留白，等决定好了再画，避免先画一张再换掉
          <div className="h-full w-full bg-stone-200/70 dark:bg-stone-700/40" aria-hidden="true" />
        ) : cover.art ? (
          <AnimeCover
            art={cover.art}
            onError={cover.onError}
            imgClassName="transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <CategoryCover
            category={post.category}
            seed={coverSeed(post.blogUrl)}
            className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          />
        )}

        {!post.thumbnail && cover.art && (
          <ArtCredit
            art={cover.art}
            variant="overlay"
            className="absolute bottom-1.5 right-1.5"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <Link
          to={href}
          className="font-heading text-base text-stone-800 transition-colors after:absolute after:inset-0 after:content-[''] hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:text-stone-100 dark:hover:text-accent"
        >
          {post.title}
        </Link>

        <p className="mt-1.5 line-clamp-2 text-sm text-stone-500 dark:text-stone-400">
          {post.description}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-stone-400 dark:text-stone-500">
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            <span title={formatAbsoluteDate(post.publishDate)}>
              {formatRelativeDate(post.publishDate)}
            </span>
          </span>
          {post.readingMinutes !== undefined && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {post.readingMinutes} 分钟
            </span>
          )}
          <span className="flex items-center gap-1">
            <User size={12} />
            {post.author}
          </span>
        </div>
      </div>
    </motion.article>
  );
}
