/**
 * Post-build script: generates static HTML pages for blog routes so that
 * crawlers / share-preview bots see real SEO meta tags instead of the
 * generic 404.html SPA redirect.
 *
 * For each blog post in content/blogs.json it creates:
 *   dist/blogs/<slug>/index.html
 *
 * It also creates dist/blogs/index.html for the blog listing page.
 *
 * The built index.html is a clean shell (no SEO meta). This script
 * replaces <title> and injects all SEO tags before </head>.
 *
 * Additionally, it regenerates dist/sitemap.xml to include all blog URLs.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");

const BASE_URL = "https://shtskysmile.github.io";
const SITE_NAME = "Shtskysmile 的个人主页";
const COVER_IMAGE = `${BASE_URL}/images/covers/cover.jpg`;

// ── Load blog data ──────────────────────────────────────────────────
const blogsJson = readFileSync(resolve(ROOT, "content/blogs.json"), "utf-8");
const posts = JSON.parse(blogsJson);

// ── Read the built index.html as template ───────────────────────────
const indexHtml = readFileSync(resolve(DIST, "index.html"), "utf-8");

/**
 * Escape HTML special characters in user-provided strings to prevent
 * injection inside attribute values / text nodes.
 */
function esc(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Build a full HTML page by injecting SEO meta tags into the clean
 * index.html template. Replaces <title> and inserts all meta/link/script
 * tags right before </head>.
 */
function buildPage({ title, description, url, image, type, extra }) {
  let html = indexHtml;

  // Replace <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);

  // Build SEO tags to inject
  const seoTags = [
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    ``,
    `<!-- Open Graph -->`,
    `<meta property="og:type" content="${esc(type)}" />`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:width" content="1280" />`,
    `<meta property="og:image:height" content="720" />`,
    `<meta property="og:locale" content="zh_CN" />`,
    ``,
    `<!-- Twitter Card -->`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
  ];

  // Add extra head tags (article:published_time, author, keywords, tags)
  if (extra?.headTags) {
    seoTags.push(``, `<!-- Article metadata -->`);
    seoTags.push(extra.headTags);
  }

  // Add JSON-LD structured data
  if (extra?.jsonLd) {
    seoTags.push(
      ``,
      `<!-- JSON-LD Structured Data -->`,
      `<script type="application/ld+json">${JSON.stringify(extra.jsonLd)}</script>`,
    );
  }

  // Indent each line and inject before </head>
  const injection = seoTags.map((line) => (line ? `    ${line}` : "")).join("\n");
  html = html.replace("</head>", `${injection}\n  </head>`);

  return html;
}

// ── Inject SEO into the home page (dist/index.html) ─────────────────
// The source index.html is a clean shell so Helmet can manage tags
// per-page without duplication. But crawlers see the static HTML, so
// we inject the home page SEO here at build time.
{
  const html = buildPage({
    title: "Shtskysmile 的个人主页",
    description: "Shtskysmile 的个人主页 - 记录我的项目、技能与文章。",
    url: `${BASE_URL}/`,
    image: COVER_IMAGE,
    type: "website",
    extra: {
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Person",
        name: "Shtskysmile",
        url: BASE_URL,
        sameAs: ["https://github.com/Shtskysmile"],
      },
    },
  });

  writeFileSync(resolve(DIST, "index.html"), html, "utf-8");
  console.log("  updated: dist/index.html (home page SEO)");
}

// ── Generate blog listing page ──────────────────────────────────────
{
  const dir = resolve(DIST, "blogs");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const html = buildPage({
    title: `全部文章 | ${SITE_NAME}`,
    description: "技术文章、深度分享与开发随笔。",
    url: `${BASE_URL}/blogs`,
    image: COVER_IMAGE,
    type: "website",
    extra: {
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: "Shtskysmile 的博客",
        url: `${BASE_URL}/blogs`,
        description: "技术文章、深度分享与开发随笔。",
        author: {
          "@type": "Person",
          name: "Shtskysmile",
          url: BASE_URL,
        },
      },
    },
  });

  writeFileSync(resolve(dir, "index.html"), html, "utf-8");
  console.log("  created: dist/blogs/index.html");
}

// ── Generate gacha page ─────────────────────────────────────────────
// 内容是随机插画、没法预渲染，但需要这个静态壳，否则直接访问 /gacha
// 会返回 404 状态码（SPA 的 404 兜底能显示页面，但状态码是错的）。
{
  const dir = resolve(DIST, "gacha");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const html = buildPage({
    title: `抽卡 | ${SITE_NAME}`,
    description: "随机抽一张二次元插画，附画师与原画链接。",
    url: `${BASE_URL}/gacha`,
    image: COVER_IMAGE,
    type: "website",
  });

  writeFileSync(resolve(dir, "index.html"), html, "utf-8");
  console.log("  created: dist/gacha/index.html");
}

// ── Generate category pages ─────────────────────────────────────────
// 分类表和 src/lib/constants.ts 里的 BLOG_CATEGORIES 是一份数据的两个副本，
// 改了那边记得同步这里（与 SITE_NAME / BASE_URL 同类的重复）。
const CATEGORIES = [
  { id: "study", name: "保研学习", description: "专业课复习、面试与笔试的整理" },
  { id: "life", name: "日常生活", description: "随笔与记录" },
  { id: "games", name: "游戏", description: "玩过的、在玩的" },
  { id: "abyss", name: "深渊区域", description: "压在底下的东西" },
  { id: "uestc", name: "电子科大专区", description: "成电相关的记录与经验" },
];

for (const category of CATEGORIES) {
  const dir = resolve(DIST, "categories", category.id);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const html = buildPage({
    title: `${category.name} | ${SITE_NAME}`,
    description: `${category.name}：${category.description}`,
    url: `${BASE_URL}/categories/${category.id}`,
    image: COVER_IMAGE,
    type: "website",
  });

  writeFileSync(resolve(dir, "index.html"), html, "utf-8");
  console.log(`  created: dist/categories/${category.id}/index.html`);
}

// ── Generate individual article pages ───────────────────────────────
for (const post of posts) {
  const slug = post.blogUrl.replace(/\.md$/, "");
  const dir = resolve(DIST, "blogs", slug);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const articleUrl = `${BASE_URL}/blogs/${slug}`;
  const imageUrl = post.thumbnail
    ? `${BASE_URL}/images/blog/${post.thumbnail}`
    : `${BASE_URL}/images/covers/cover.jpg`;

  const tagsMeta = (post.tags || [])
    .map((tag) => `<meta property="article:tag" content="${esc(tag)}" />`)
    .join("\n");

  const html = buildPage({
    title: `${post.title} | ${SITE_NAME}`,
    description: post.description,
    url: articleUrl,
    image: imageUrl,
    type: "article",
    extra: {
      headTags: [
        `<meta property="article:published_time" content="${esc(post.publishDate)}" />`,
        `<meta property="article:author" content="${esc(post.author)}" />`,
        `<meta name="author" content="${esc(post.author)}" />`,
        `<meta name="keywords" content="${esc((post.tags || []).join(", "))}" />`,
        tagsMeta,
      ].join("\n"),
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        image: imageUrl,
        url: articleUrl,
        datePublished: post.publishDate,
        author: {
          "@type": "Person",
          name: post.author,
          url: BASE_URL,
        },
        publisher: {
          "@type": "Person",
          name: "Shtskysmile",
          url: BASE_URL,
        },
        keywords: (post.tags || []).join(", "),
      },
    },
  });

  writeFileSync(resolve(dir, "index.html"), html, "utf-8");
  console.log(`  created: dist/blogs/${slug}/index.html`);
}

// ── Regenerate sitemap.xml with blog URLs ───────────────────────────
{
  const today = new Date().toISOString().split("T")[0];

  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${BASE_URL}/blogs</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;

  for (const category of CATEGORIES) {
    sitemap += `  <url>
    <loc>${BASE_URL}/categories/${category.id}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
`;
  }

  for (const post of posts) {
    const slug = post.blogUrl.replace(/\.md$/, "");
    sitemap += `  <url>
    <loc>${BASE_URL}/blogs/${slug}</loc>
    <lastmod>${post.publishDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
  }

  sitemap += `</urlset>\n`;

  writeFileSync(resolve(DIST, "sitemap.xml"), sitemap, "utf-8");
  console.log("  created: dist/sitemap.xml (with blog URLs)");
}

console.log(`\n  Done! Generated pages for ${posts.length} blog articles.`);
