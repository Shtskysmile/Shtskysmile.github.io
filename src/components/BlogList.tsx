import { Link } from "react-router-dom";
import { BookOpen, ArrowRight } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import BlogCard from "@/components/BlogCard";
import { useAnimeArt } from "@/hooks/useAnimeArt";
import type { BlogPost } from "@/types/content";
import blogsData from "@content/blogs.json";

const allPosts = blogsData as BlogPost[];

/** 首页只列精选，并且硬性截断——避免以后又把首页撑成一长串 */
const HOME_POST_LIMIT = 4;

/** Highlighted posts, sorted newest-first */
const highlightedPosts = allPosts
  .filter((p) => p.highlight)
  .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
  .slice(0, HOME_POST_LIMIT);

export default function BlogList() {
  const animeArt = useAnimeArt(HOME_POST_LIMIT);
  return (
    <Card animate={false}>
      <div className="flex items-start justify-between" data-live2d-hover="article">
        <SectionTitle icon={BookOpen}>博客</SectionTitle>
        <Link
          to="/blogs"
          aria-label="查看全部文章"
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:hover:bg-stone-800 dark:hover:text-stone-200"
        >
          <ArrowRight size={14} />
        </Link>
      </div>
      <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">精选文章与随笔</p>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
        {highlightedPosts.map((post, i) => (
          <BlogCard key={post.blogUrl} post={post} index={i} art={animeArt[i]} />
        ))}
      </div>
    </Card>
  );
}
