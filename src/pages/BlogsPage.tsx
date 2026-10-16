import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowUpDown, BookOpen, FolderOpen } from "lucide-react";
import { Helmet } from "react-helmet-async";
import BlogCard from "@/components/BlogCard";
import Pagination from "@/components/Pagination";
import { pickArt } from "@/lib/anime";
import { useAnimeArt } from "@/hooks/useAnimeArt";
import { postIndex } from "@/lib/posts";
import { BLOG_CATEGORIES, DEFAULT_BLOG_CATEGORY } from "@/lib/constants";
import type { BlogPost } from "@/types/content";
import blogsData from "@content/blogs.json";

/**
 * 全量文章，仅用于封面图集容量。
 *
 * useAnimeArt 的图集是全站记忆一次的，谁先挂载谁定容量；而封面按全局 postIndex
 * （见 lib/posts）取图，下标最大到全量长度。所以这里必须用过滤前的数量，
 * 否则列表页和其他页报的数对不上，图集会被截短、封面开始重样。
 */
const allPosts = blogsData as BlogPost[];

const visiblePosts = allPosts;
const visibleCategories = BLOG_CATEGORIES;

/** 每页条数 */
const PAGE_SIZE = 8;

function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export default function BlogsPage() {
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get("page"));
  const selectedCategoryId = searchParams.get("category");
  const selectedCategory = visibleCategories.find((category) => category.id === selectedCategoryId);
  const selectedPosts = selectedCategory
    ? visiblePosts.filter(
        (post) => (post.category ?? DEFAULT_BLOG_CATEGORY) === selectedCategory.id,
      )
    : visiblePosts;
  const animeArt = useAnimeArt(allPosts.length + 2);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page, selectedCategoryId]);

  const sorted = [...selectedPosts].sort((a, b) => {
    const diff = new Date(a.publishDate).getTime() - new Date(b.publishDate).getTime();
    return sortOrder === "desc" ? -diff : diff;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hrefForPage = (nextPage: number): string => {
    const params = new URLSearchParams();
    if (selectedCategory) params.set("category", selectedCategory.id);
    if (nextPage > 1) params.set("page", String(nextPage));
    const query = params.toString();
    return query ? `/blogs?${query}` : "/blogs";
  };

  const selectCategory = (categoryId: string | null) => {
    const params = new URLSearchParams(searchParams);
    params.delete("page");
    if (categoryId) params.set("category", categoryId);
    else params.delete("category");
    setSearchParams(params);
  };

  return (
    <>
      <Helmet>
        <title>全部文章 | Shtskysmile 的个人主页</title>
        <meta name="description" content="技术文章、深度分享与开发随笔。" />
        <link rel="canonical" href="https://shtskysmile.github.io/blogs" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Shtskysmile 的个人主页" />
        <meta property="og:title" content="全部文章 | Shtskysmile 的个人主页" />
        <meta property="og:description" content="技术文章、深度分享与开发随笔。" />
        <meta property="og:url" content="https://shtskysmile.github.io/blogs" />
        <meta property="og:image" content="https://shtskysmile.github.io/images/covers/cover.jpg" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="全部文章 | Shtskysmile 的个人主页" />
        <meta name="twitter:description" content="技术文章、深度分享与开发随笔。" />
        <meta
          name="twitter:image"
          content="https://shtskysmile.github.io/images/covers/cover.jpg"
        />
      </Helmet>

      <div className="surface-panel mx-auto my-6 w-[calc(100%-2rem)] max-w-6xl p-5 sm:p-8">
        {/* Navigation */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            <ArrowLeft size={16} />
            返回
          </button>

          <button
            onClick={() => {
              setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
              const params = new URLSearchParams(searchParams);
              params.delete("page");
              setSearchParams(params, { replace: true });
            }}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
            aria-label={`按日期${sortOrder === "desc" ? "升序" : "降序"}排序`}
          >
            <ArrowUpDown size={16} />
            {sortOrder === "desc" ? "最新优先" : "最早优先"}
          </button>
        </div>

        {/* Title */}
        <div className="mb-6">
          <h1 className="flex items-center gap-2 font-heading text-2xl text-stone-800 dark:text-stone-100">
            <BookOpen size={24} className="text-accent" />
            {selectedCategory?.name ?? "全部文章"}
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {selectedCategory?.description ?? "按主题收纳的文章与随笔"} · 共 {sorted.length} 篇
          </p>
        </div>

        {/* Topic shelves */}
        <section className="mb-8" aria-labelledby="blog-shelves-heading">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2
                id="blog-shelves-heading"
                className="flex items-center gap-2 font-heading text-lg text-stone-800 dark:text-stone-100"
              >
                <FolderOpen size={19} className="text-accent" />
                主题书架
              </h2>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                选一个抽屉，看看里面收好的文章
              </p>
            </div>
            {selectedCategory && (
              <button
                type="button"
                onClick={() => selectCategory(null)}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                查看全部
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <button
              type="button"
              onClick={() => selectCategory(null)}
              aria-pressed={!selectedCategory}
              className={`group rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                !selectedCategory
                  ? "border-accent/50 bg-accent/10 shadow-sm"
                  : "border-stone-200 bg-white/60 hover:border-accent/30 hover:bg-white dark:border-stone-700 dark:bg-stone-900/30 dark:hover:bg-stone-800/70"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium text-stone-800 dark:text-stone-100">
                  <BookOpen size={16} className="shrink-0 text-accent" />
                  全部文章
                </span>
                <span className="text-xs tabular-nums text-stone-400">{visiblePosts.length}</span>
              </span>
              <span className="mt-2 block text-xs text-stone-500 dark:text-stone-400">
                所有主题，一页浏览
              </span>
            </button>

            {visibleCategories.map((category) => {
              const count = visiblePosts.filter(
                (post) => (post.category ?? DEFAULT_BLOG_CATEGORY) === category.id,
              ).length;
              const isSelected = selectedCategory?.id === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => selectCategory(category.id)}
                  aria-pressed={isSelected}
                  className={`group rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isSelected
                      ? "border-accent/50 bg-accent/10 shadow-sm"
                      : "border-stone-200 bg-white/60 hover:border-accent/30 hover:bg-white dark:border-stone-700 dark:bg-stone-900/30 dark:hover:bg-stone-800/70"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-stone-800 dark:text-stone-100">
                      <FolderOpen size={16} className="shrink-0 text-accent" />
                      <span className="truncate">{category.name}</span>
                    </span>
                    <span className="text-xs tabular-nums text-stone-400">{count}</span>
                  </span>
                  <span className="mt-2 block line-clamp-1 text-xs text-stone-500 dark:text-stone-400">
                    {category.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* List */}
        {visible.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
            {visible.map((post, i) => (
              <BlogCard
                key={post.blogUrl}
                post={post}
                index={i}
                art={pickArt(animeArt, postIndex(post.blogUrl))}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-stone-200 px-4 py-10 text-center text-sm text-stone-500 dark:border-stone-700 dark:text-stone-400">
            这个书架暂时还没有文章。
          </p>
        )}

        <Pagination page={currentPage} totalPages={totalPages} hrefFor={hrefForPage} />

        {/* Footer link */}
        <div className="mt-8 text-center">
          <Link
            to="/"
            className="text-sm text-accent underline-offset-4 transition-colors hover:underline"
          >
            返回主页
          </Link>
        </div>
      </div>
    </>
  );
}
