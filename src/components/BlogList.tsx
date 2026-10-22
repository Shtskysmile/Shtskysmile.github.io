import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, FolderOpen } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import { BLOG_CATEGORIES, BLOG_SHELVES, HIDDEN_CATEGORY_ID } from "@/lib/constants";
import { allPosts } from "@/lib/posts";

const shelfGroups = BLOG_CATEGORIES.filter((category) => category.id !== HIDDEN_CATEGORY_ID)
  .map((category) => ({
    category,
    shelves: (BLOG_SHELVES[category.id] ?? [])
      .map((shelf) => ({
        ...shelf,
        count: allPosts.filter(
          (post) => post.category === category.id && post.shelf === shelf.id,
        ).length,
      }))
      .filter((shelf) => shelf.count > 0),
  }))
  .filter((group) => group.shelves.length > 0);

export default function BlogList() {
  return (
    <Card animate={false}>
      <div className="flex items-start justify-between" data-live2d-hover="article">
        <SectionTitle icon={BookOpen}>博客书架</SectionTitle>
        <Link
          to="/blogs"
          aria-label="查看全部文章"
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:hover:bg-stone-800 dark:hover:text-stone-200"
        >
          <ArrowRight size={14} />
        </Link>
      </div>
      <p className="mb-5 text-sm text-stone-500 dark:text-stone-400">
        按主题浏览文章，选一个书架继续阅读
      </p>

      <div className="space-y-5">
        {shelfGroups.map(({ category, shelves }) => (
          <section key={category.id} aria-labelledby={`home-shelves-${category.id}`}>
            <h3
              id={`home-shelves-${category.id}`}
              className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-200"
            >
              {category.name}
            </h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
              {shelves.map((shelf) => (
                <Link
                  key={shelf.id}
                  to={`/categories/${category.id}?shelf=${encodeURIComponent(shelf.id)}`}
                  className="group rounded-xl border border-stone-200 bg-white/60 p-3 transition-colors hover:border-accent/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-stone-700 dark:bg-stone-900/30 dark:hover:bg-stone-800/70"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-stone-800 dark:text-stone-100">
                      <FolderOpen size={16} className="shrink-0 text-accent" />
                      <span className="truncate">{shelf.name}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-stone-400">
                      {shelf.count} 篇
                    </span>
                  </span>
                  <span className="mt-2 block line-clamp-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                    {shelf.description}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Card>
  );
}
