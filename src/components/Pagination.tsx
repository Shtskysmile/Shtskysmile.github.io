import { Link } from "react-router-dom";

interface PaginationProps {
  page: number;
  totalPages: number;
  /** 生成某一页的链接，例如 (p) => `/blogs?page=${p}` */
  hrefFor: (page: number) => string;
}

const LINK =
  "rounded-lg px-3 py-1.5 text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100";
const DISABLED = "rounded-lg px-3 py-1.5 text-stone-300 dark:text-stone-600";

export default function Pagination({ page, totalPages, hrefFor }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="分页" className="mt-8 flex items-center justify-center gap-2 text-sm">
      {page > 1 ? (
        <Link to={hrefFor(page - 1)} className={LINK} rel="prev">
          上一页
        </Link>
      ) : (
        <span className={DISABLED}>上一页</span>
      )}

      <span className="px-1 text-stone-500 dark:text-stone-400">
        第 {page} / {totalPages} 页
      </span>

      {page < totalPages ? (
        <Link to={hrefFor(page + 1)} className={LINK} rel="next">
          下一页
        </Link>
      ) : (
        <span className={DISABLED}>下一页</span>
      )}
    </nav>
  );
}
