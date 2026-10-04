import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import Skeleton from "@/components/ui/Skeleton";
import BackToTop from "@/components/BackToTop";
import { articleComponents, remarkNote } from "@/components/ArticleMarkdown";
import ArticleToc, { useArticleToc } from "@/components/ArticleToc";
import CategoryCover from "@/components/CategoryCover";
import ArtCredit from "@/components/ArtCredit";
import AnimeCover from "@/components/AnimeCover";
import { pickArt } from "@/lib/anime";
import { useAnimeArt } from "@/hooks/useAnimeArt";
import { useCoverArt } from "@/hooks/useCoverArt";
import { postIndex } from "@/lib/posts";
import { formatRelativeDate, formatAbsoluteDate, coverSeed } from "@/lib/blog";
import type { BlogPost } from "@/types/content";
import blogsData from "@content/blogs.json";
import { Helmet } from "react-helmet-async";

const allPosts = blogsData as BlogPost[];

export default function BlogArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const { items: tocItems, activeId } = useArticleToc(articleRef, markdown);

  const post = allPosts.find((p) => p.blogUrl.replace(/\.md$/, "") === slug);
  const animeArt = useAnimeArt(allPosts.length + 2);
  const art = post ? pickArt(animeArt, postIndex(post.blogUrl)) : undefined;
  const cover = useCoverArt(art);
  const siteName = "Shtskysmile 的个人主页";
  const baseUrl = "https://shtskysmile.github.io";
  const canonicalUrl = post
    ? `${baseUrl}/blogs/${post.blogUrl.replace(/\.md$/, "")}`
    : `${baseUrl}/blogs`;
  const ogImageUrl = post?.thumbnail
    ? `${baseUrl}/images/blog/${post.thumbnail}`
    : `${baseUrl}/images/covers/cover.jpg`;

  useEffect(() => {
    if (!post) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadMarkdown() {
      const modules = import.meta.glob("/content/blog/*.md", {
        query: "?raw",
        import: "default",
      }) as Record<string, () => Promise<string>>;

      const key = `/content/blog/${post!.blogUrl}`;
      const loader = modules[key];

      if (!loader) {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      try {
        const md = await loader();
        if (!cancelled) {
          setMarkdown(md);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      }
    }

    loadMarkdown();
    return () => {
      cancelled = true;
    };
  }, [post]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  // Reading progress bar — direct DOM mutation, no React re-renders
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = progressRef.current;
    if (!bar) return;

    const header = document.querySelector("header");
    let headerHeight = header ? header.getBoundingClientRect().height : 0;

    const updateBarPosition = () => {
      if (!header) return;
      const isHidden = header.getAttribute("data-header-hidden") === "true";
      if (isHidden) {
        // Header is hidden (translated up) — stick bar to top of viewport
        bar.style.top = "0px";
      } else {
        bar.style.top = `${headerHeight}px`;
      }
    };

    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;
      // Use scaleX transform instead of width to avoid triggering layout / overflow
      bar.style.transform = `scaleX(${progress})`;
      updateBarPosition();
    };

    const onResize = () => {
      if (header) {
        headerHeight = header.getBoundingClientRect().height;
      }
      updateProgress();
    };

    // Watch for header visibility changes via data-header-hidden attribute.
    // React's state update is async — when the header re-renders with a new
    // data-header-hidden value, the scroll handler may have already fired
    // with the stale attribute. The MutationObserver fires synchronously
    // after React commits, so the bar repositions without waiting for
    // the next scroll event.
    let observer: MutationObserver | null = null;
    if (header) {
      observer = new MutationObserver(() => {
        updateBarPosition();
      });
      observer.observe(header, {
        attributes: true,
        attributeFilter: ["data-header-hidden"],
      });
    }

    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", onResize);
    updateProgress();

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
  }, [loading]);

  if (notFound || !post) {
    return (
      <div className="surface-panel mx-auto my-24 flex w-[calc(100%-2rem)] max-w-3xl flex-col items-center justify-center p-10">
        <h1 className="mb-2 font-heading text-2xl text-stone-800 dark:text-stone-100">
          文章不存在
        </h1>
        <p className="mb-6 text-sm text-stone-500 dark:text-stone-400">你找的文章不存在。</p>
        <Link
          to="/blogs"
          className="text-sm text-accent underline-offset-4 transition-colors hover:underline"
        >
          返回全部文章
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* SEO meta tags */}
      <Helmet>
        <title>{post ? `${post.title} | ${siteName}` : `Blogs | ${siteName}`}</title>

        <meta name="description" content={post?.description ?? "技术文章、深度分享与开发随笔。"} />

        <meta name="author" content={post?.author ?? "Shtskysmile"} />
        <meta name="keywords" content={post?.tags?.join(", ") ?? "博客, 编程, 技术"} />

        <link rel="canonical" href={canonicalUrl} />

        <meta property="og:type" content="article" />
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content={post?.title ?? "博客"} />
        <meta
          property="og:description"
          content={post?.description ?? "技术文章、深度分享与开发随笔。"}
        />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={ogImageUrl} />

        <meta property="article:published_time" content={post?.publishDate ?? ""} />
        <meta property="article:author" content={post?.author ?? "Shtskysmile"} />
        {post?.tags?.map((tag) => (
          <meta key={tag} property="article:tag" content={tag} />
        ))}

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post?.title ?? "博客"} />
        <meta
          name="twitter:description"
          content={post?.description ?? "技术文章、深度分享与开发随笔。"}
        />
        <meta name="twitter:image" content={ogImageUrl} />
      </Helmet>

      {/* Reading progress bar — uses scaleX + inset-x to avoid horizontal overflow */}
      <div
        ref={progressRef}
        className="fixed inset-x-0 z-50 h-[3px] max-w-[100vw] origin-left bg-blue-500 transition-[top] duration-300"
        style={{ transform: "scaleX(0)" }}
      />

      <div className="surface-panel mx-auto my-6 w-[calc(100%-2rem)] max-w-3xl p-5 sm:p-8 lg:max-w-7xl">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-12">
          <div className="min-w-0">
            {/* Back button */}
            <button
              onClick={() => window.history.back()}
              className="mb-6 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
            >
              <ArrowLeft size={16} />
              返回
            </button>

            {loading ? (
              <div className="flex flex-col gap-4">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            ) : (
              <>
                {/* Title */}
                <h1 className="mb-4 font-heading text-2xl text-stone-800 dark:text-stone-100 sm:text-3xl">
                  {post.title}
                </h1>

                {/* Meta row */}
                <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-400 dark:text-stone-500">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {formatRelativeDate(post.publishDate)}
                    <span className="text-stone-300 dark:text-stone-600">
                      ({formatAbsoluteDate(post.publishDate)})
                    </span>
                  </span>
                  {post.readingMinutes !== undefined && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {post.readingMinutes} 分钟阅读
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <User size={12} />
                    作者：{post.author}
                  </span>
                </div>

                {/* Tags */}
                <div className="mb-5 flex flex-wrap gap-1.5">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs text-accent dark:bg-accent/20"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* 封面优先级：手动配的图 > 随机二次元图 > 内置 SVG */}
                {post.thumbnail ? (
                  <img
                    src={`/images/blog/${post.thumbnail}`}
                    alt={post.title}
                    width={800}
                    height={400}
                    className="mb-8 w-full rounded-xl object-cover shadow-sm"
                  />
                ) : art === null ? (
                  // 图集还没决定好：先留白，别画一张再换掉
                  <div
                    className="mb-2 aspect-[16/9] w-full rounded-xl bg-stone-200/70 shadow-sm dark:bg-stone-700/40"
                    aria-hidden="true"
                  />
                ) : cover.art ? (
                  <div className="relative mb-2 aspect-[16/9] w-full overflow-hidden rounded-xl shadow-sm">
                    {/* relative 不能省：AnimeCover 的模糊垫底是 absolute inset-0，
                        容器不是定位元素的话它会以视口为参照，盖住整篇文章 */}
                    <AnimeCover art={cover.art} src={cover.art.heroSrc} onError={cover.onError} />
                  </div>
                ) : (
                  <CategoryCover
                    category={post.category}
                    seed={coverSeed(post.blogUrl)}
                    className="mb-8 h-auto w-full rounded-xl shadow-sm"
                  />
                )}
                {!post.thumbnail && cover.art && (
                  <ArtCredit art={cover.art} className="mb-8" />
                )}

                {/* Article content */}
                <article
                  ref={articleRef}
                  className="prose prose-stone max-w-none dark:prose-invert"
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkNote, remarkMath]}
                    rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                    components={articleComponents}
                  >
                    {markdown ?? ""}
                  </ReactMarkdown>
                </article>

                {/* Footer */}
                <div className="mt-12 border-t border-stone-200 pt-6 text-center dark:border-stone-700">
                  <Link
                    to="/blogs"
                    className="text-sm text-accent underline-offset-4 transition-colors hover:underline"
                  >
                    查看全部文章
                  </Link>
                  {/* 深渊区域的线索 */}
                  <p className="mt-3 text-xs text-stone-300 dark:text-stone-600">
                    想看压在最底下的东西的话，试试键盘上的老式秘籍。
                  </p>
                </div>
              </>
            )}
          </div>
          <ArticleToc items={tocItems} activeId={activeId} />
        </div>
      </div>

      <BackToTop />
    </>
  );
}
