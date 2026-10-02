import { useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Helmet } from "react-helmet-async";
import BlogCard from "@/components/BlogCard";
import CategoryCover from "@/components/CategoryCover";
import ArtCredit from "@/components/ArtCredit";
import AnimeCover from "@/components/AnimeCover";
import { useAnimeArt } from "@/hooks/useAnimeArt";
import Pagination from "@/components/Pagination";
import { BLOG_CATEGORIES, DEFAULT_BLOG_CATEGORY } from "@/lib/constants";
import type { BlogPost } from "@/types/content";
import blogsData from "@content/blogs.json";

const allPosts = blogsData as BlogPost[];
const SITE_NAME = "Shtskysmile 的个人主页";
const BASE_URL = "https://shtskysmile.github.io";

/** 每页条数 */
const PAGE_SIZE = 8;

function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export default function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const category = BLOG_CATEGORIES.find((c) => c.id === categoryId);
  const [searchParams] = useSearchParams();
  const page = parsePage(searchParams.get("page"));

  // category 取自常量数组，同一个 id 每次渲染都是同一个引用，
  // 所以 posts 的引用是稳定的
  const posts = useMemo(
    () =>
      category ? allPosts.filter((p) => (p.category ?? DEFAULT_BLOG_CATEGORY) === category.id) : [],
    [category],
  );

  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = posts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const animeArt = useAnimeArt(PAGE_SIZE);
  const [heroArt] = useAnimeArt(1);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [categoryId, page]);

  // 顶栏的分类链接是裸链接，切换分类时 page 自然被清掉
  const hrefForPage = (p: number) =>
    p === 1 ? `/categories/${categoryId}` : `/categories/${categoryId}?page=${p}`;

  if (!category) {
    return (
      <div className="surface-panel mx-auto my-24 flex w-[calc(100%-2rem)] max-w-3xl flex-col items-center justify-center p-10">
        <h1 className="mb-2 font-heading text-2xl text-stone-800 dark:text-stone-100">
          分类不存在
        </h1>
        <p className="mb-6 text-sm text-stone-500 dark:text-stone-400">你找的分类不存在。</p>
        <Link
          to="/blogs"
          className="text-sm text-accent underline-offset-4 transition-colors hover:underline"
        >
          返回全部文章
        </Link>
      </div>
    );
  }

  const canonical = `${BASE_URL}/categories/${category.id}`;

  return (
    <>
      <Helmet>
        <title>{`${category.name} | ${SITE_NAME}`}</title>
        <meta name="description" content={`${category.name}：${category.description}`} />
        <link rel="canonical" href={canonical} />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={`${category.name} | ${SITE_NAME}`} />
        <meta property="og:description" content={`${category.name}：${category.description}`} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={`${BASE_URL}/images/covers/cover.jpg`} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${category.name} | ${SITE_NAME}`} />
        <meta name="twitter:description" content={`${category.name}：${category.description}`} />
        <meta name="twitter:image" content={`${BASE_URL}/images/covers/cover.jpg`} />
      </Helmet>

      <div className="surface-panel mx-auto my-6 w-[calc(100%-2rem)] max-w-6xl p-5 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            <ArrowLeft size={16} />
            返回
          </button>
        </div>

        {/* 分类头图：随机二次元图，取不到时退回内置 SVG */}
        {heroArt ? (
          <div className="relative mb-2 aspect-[3/1] w-full overflow-hidden rounded-xl shadow-sm">
            <AnimeCover art={heroArt} src={heroArt.heroSrc} />
            <ArtCredit art={heroArt} variant="overlay" className="absolute bottom-1.5 right-1.5" />
          </div>
        ) : (
          <CategoryCover
            category={category.id}
            seed={BLOG_CATEGORIES.findIndex((c) => c.id === category.id)}
            className="mb-5 h-28 w-full rounded-xl shadow-sm"
          />
        )}

        <div className="mb-6">
          <h1 className="font-heading text-2xl text-stone-800 dark:text-stone-100">
            {category.name}
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {category.description}
            {posts.length > 0 && ` · 共 ${posts.length} 篇`}
          </p>
        </div>

        {posts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-200 px-4 py-10 text-center text-sm text-stone-500 dark:border-stone-700 dark:text-stone-400">
            我太懒了，还没写完
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
              {visible.map((post, i) => (
                <BlogCard key={post.blogUrl} post={post} index={i} art={animeArt[i]} />
              ))}
            </div>
            <Pagination page={currentPage} totalPages={totalPages} hrefFor={hrefForPage} />
          </>
        )}

        <div className="mt-12 border-t border-stone-200 pt-6 text-center dark:border-stone-700">
          <Link
            to="/blogs"
            className="text-sm text-accent underline-offset-4 transition-colors hover:underline"
          >
            查看全部文章
          </Link>
        </div>
      </div>
    </>
  );
}
