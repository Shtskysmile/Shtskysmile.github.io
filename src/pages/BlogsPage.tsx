import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpDown, BookOpen } from "lucide-react";
import { Helmet } from "react-helmet-async";
import BlogCard from "@/components/BlogCard";
import Skeleton from "@/components/ui/Skeleton";
import type { BlogPost } from "@/types/content";
import blogsData from "@content/blogs.json";

const allPosts = blogsData as BlogPost[];

export default function BlogsPage() {
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [markdownMap, setMarkdownMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      const modules = import.meta.glob("/content/blog/*.md", {
        query: "?raw",
        import: "default",
      }) as Record<string, () => Promise<string>>;

      const entries: [string, string][] = [];

      for (const post of allPosts) {
        const key = `/content/blog/${post.blogUrl}`;
        const loader = modules[key];
        if (loader) {
          try {
            const md = await loader();
            entries.push([post.blogUrl, md]);
          } catch {
            // skip
          }
        }
      }

      if (!cancelled) {
        setMarkdownMap(Object.fromEntries(entries));
        setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = [...allPosts].sort((a, b) => {
    const diff = new Date(a.publishDate).getTime() - new Date(b.publishDate).getTime();
    return sortOrder === "desc" ? -diff : diff;
  });

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
        <meta name="twitter:image" content="https://shtskysmile.github.io/images/covers/cover.jpg" />
      </Helmet>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
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
            onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
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
            全部文章
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            共 {allPosts.length} 篇文章
          </p>
        </div>

        {/* List */}
        {loading && (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-stone-200 p-4 dark:border-stone-700">
                <div className="flex gap-4">
                  <Skeleton className="hidden h-20 w-40 shrink-0 sm:block" />
                  <div className="flex-1">
                    <Skeleton className="mb-2 h-5 w-3/4" />
                    <Skeleton className="mb-2 h-4 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <div className="flex flex-col gap-4">
            {sorted.map((post, i) => (
              <BlogCard
                key={post.blogUrl}
                post={post}
                index={i}
                markdown={markdownMap[post.blogUrl] ?? null}
              />
            ))}
          </div>
        )}

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
