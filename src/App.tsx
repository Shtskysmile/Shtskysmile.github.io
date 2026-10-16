import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ThemeContext } from "@/context/ThemeContext";
import { useTheme } from "@/hooks/useTheme";
import Header from "@/components/layout/Header";
import NotFoundPage from "@/pages/NotFoundPage";
import PageBoundary from "@/components/PageBoundary";
import Skeleton from "@/components/ui/Skeleton";

const HomePage = lazy(() => import("@/pages/HomePage"));
const BlogsPage = lazy(() => import("@/pages/BlogsPage"));
const BlogArticlePage = lazy(() => import("@/pages/BlogArticlePage"));
const CategoryPage = lazy(() => import("@/pages/CategoryPage"));
const GachaPage = lazy(() => import("@/pages/GachaPage"));

function PageFallback() {
  return (
    <div className="mx-auto flex max-w-3xl flex-1 flex-col gap-4 px-4 py-12">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}

export default function App() {
  const themeState = useTheme();
  const location = useLocation();

  return (
    <ThemeContext.Provider value={themeState}>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          {/* key 跟随路由：某个页面 chunk 加载失败后，切到别的路由能自动恢复，
              不必强制刷新（刷新只是兜底手段之一） */}
          <PageBoundary key={location.pathname}>
            <Routes>
              <Route
                path="/"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <HomePage />
                  </Suspense>
                }
              />
              <Route
                path="/blogs"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <BlogsPage />
                  </Suspense>
                }
              />
              <Route
                path="/blogs/:slug"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <BlogArticlePage />
                  </Suspense>
                }
              />
              <Route
                path="/categories/:categoryId"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <CategoryPage />
                  </Suspense>
                }
              />
              <Route
                path="/gacha"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <GachaPage />
                  </Suspense>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </PageBoundary>
        </main>
      </div>
    </ThemeContext.Provider>
  );
}
