import { Layers, RefreshCw } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Skeleton from "@/components/ui/Skeleton";
import ErrorFallback from "@/components/ui/ErrorFallback";
import ProjectCard from "@/components/ProjectCard";
import { useGitHubRepos } from "@/hooks/useGitHubRepos";
import { useInView } from "@/hooks/useInView";
import type { GitHubError } from "@/lib/github";

function getErrorMessage(error: GitHubError): string {
  switch (error.type) {
    case "rate_limit": {
      if (error.resetAt) {
        const date = new Date(error.resetAt);
        return `GitHub API 请求次数已达上限，将于 ${date.toLocaleTimeString("zh-CN")} 恢复。`;
      }
      return "GitHub API 请求次数已达上限，请稍后再试。";
    }
    case "network":
      return "无法连接网络，请检查后重试。";
    case "empty":
      return "没有找到仓库。";
    case "invalid":
      return "加载项目时出错了。";
  }
}

function ProjectSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-stone-200 p-4 dark:border-stone-700"
        >
          <Skeleton className="mb-3 h-5 w-32" />
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="mt-3 flex gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProjectList() {
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: "200px" });
  const { data, isLoading, error, retry, forceRefresh } = useGitHubRepos(inView);

  return (
    <Card animate={false}>
      <div ref={ref}>
        <div className="flex items-start justify-between" data-live2d-hover="projects">
          <SectionTitle icon={Layers}>项目</SectionTitle>
          <button
            onClick={forceRefresh}
            disabled={isLoading}
            aria-label="刷新项目列表"
            className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-40 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
        <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
          最近更新的公开仓库
        </p>

        {isLoading && <ProjectSkeleton />}

        {error && error.type !== "empty" && (
          <ErrorFallback message={getErrorMessage(error)} onRetry={retry} />
        )}

        {error && error.type === "empty" && (
          <p className="py-6 text-center text-sm text-stone-500 dark:text-stone-400">
            {getErrorMessage(error)}
          </p>
        )}

        {data && (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.map((repo, i) => (
              <ProjectCard key={repo.name} repo={repo} index={i} />
            ))}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-stone-400 dark:text-stone-500">
          数据来自 GitHub API（缓存 1 小时）
        </p>
      </div>
    </Card>
  );
}
