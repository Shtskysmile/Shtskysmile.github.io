import { lazy, Suspense } from "react";
import { Helmet } from "react-helmet-async";
import Grid from "@/components/layout/Grid";
import ProfileCard from "@/components/ProfileCard";
import CertificateCard from "@/components/CertificateCard";
import SkillsSection from "@/components/SkillsSection";
import BackToTop from "@/components/BackToTop";
import Skeleton from "@/components/ui/Skeleton";
import { useLenis } from "@/hooks/useLenis";

const ProjectList = lazy(() => import("@/components/ProjectList"));
const BlogList = lazy(() => import("@/components/BlogList"));
const Live2DWidget = lazy(() => import("@/components/Live2DWidget"));

function ProjectListFallback() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
  );
}

function BlogListFallback() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-32" />
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}

export default function HomePage() {
  // Smooth scroll only on the home page – blog pages don't need it
  useLenis();

  return (
    <>
      <Helmet>
        <title>Shtskysmile 的个人主页</title>
        <meta
          name="description"
          content="Shtskysmile 的个人主页 - 记录我的项目、技能与文章。"
        />
        <link rel="canonical" href="https://shtskysmile.github.io/" />

        <meta property="og:type" content="website" />
        <meta property="og:title" content="Shtskysmile 的个人主页" />
        <meta property="og:description" content="记录我的项目、技能与文章。" />
        <meta property="og:url" content="https://shtskysmile.github.io/" />
        <meta property="og:image" content="https://shtskysmile.github.io/images/covers/cover.jpg" />
        <meta property="og:image:width" content="1280" />
        <meta property="og:image:height" content="720" />
        <meta property="og:locale" content="zh_CN" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Shtskysmile 的个人主页" />
        <meta name="twitter:description" content="记录我的项目、技能与文章。" />
        <meta name="twitter:image" content="https://shtskysmile.github.io/images/covers/cover.jpg" />

        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: "Shtskysmile",
            url: "https://shtskysmile.github.io",
            sameAs: ["https://github.com/Shtskysmile"],
          })}
        </script>
      </Helmet>

      <Grid
        left={
          <>
            <ProfileCard />
            <CertificateCard />
          </>
        }
        right={
          <>
            <SkillsSection />
            <Suspense fallback={<ProjectListFallback />}>
              <ProjectList />
            </Suspense>
            <Suspense fallback={<BlogListFallback />}>
              <BlogList />
            </Suspense>
          </>
        }
      />
      <BackToTop />
      <Suspense fallback={null}>
        <Live2DWidget />
      </Suspense>
    </>
  );
}
