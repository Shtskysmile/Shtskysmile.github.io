// Social links, GitHub config, and shared constants
import type { BlogCategoryId } from "@/types/content";

export const GITHUB_USERNAME = "Shtskysmile";
export const GITHUB_AVATAR_URL = `https://avatars.githubusercontent.com/${GITHUB_USERNAME}`;
export const GITHUB_REPOS_API = `https://api.github.com/users/${GITHUB_USERNAME}/repos`;

// 想加更多社交链接时，按下面格式追加即可。
// 可用图标（见 ProfileCard.tsx 的 ICON_MAP）：GitHub / Email / Telegram / X / YouTube
export const SOCIAL_LINKS = [
  {
    name: "GitHub",
    url: `https://github.com/${GITHUB_USERNAME}`,
    label: "GitHub",
  },
  {
    name: "Email",
    url: "mailto:shtskysmile@gmail.com",
    label: "邮箱",
  },
] as const;

export const THEME_STORAGE_KEY = "theme";
export const SCROLL_TOP_THRESHOLD = 300;

// 导航栏里的院校校徽，数组顺序即展示顺序。
// 两个徽标都含白色元素（北大是深红印章），在纯黑的深色导航栏上会糊掉，
// 所以 Header 里给它们垫了一层白色圆底——浅色模式导航栏本身是纯白，那层底不可见。
export const SCHOOL_EMBLEMS = [
  { name: "电子科技大学", src: "/images/logos/uestc.svg" },
  { name: "北京大学", src: "/images/logos/pku.svg" },
] as const;

/**
 * 博客分类。`id` 是 URL 里用的英文 slug（/categories/<id>），`name` 是显示名。
 * `colors` 给 CategoryCover 生成封面渐变：每个分类一套色调，同一分类下按
 * 文章序号变化构图，所以列表里看着不重样，整体色调仍然统一。
 */
export const BLOG_CATEGORIES = [
  {
    id: "study",
    name: "学习",
    description: "专业课复习、面试与笔试的整理",
    colors: ["#6b7fb3", "#39466b"],
  },
  {
    id: "life",
    name: "日常生活",
    description: "随笔与记录",
    colors: ["#d99a63", "#96543c"],
  },
  {
    id: "games",
    name: "娱乐天堂",
    description: "玩过的、在玩的",
    colors: ["#8f7ec4", "#463572"],
  },
  {
    id: "abyss",
    name: "深渊区域",
    description: "压在底下的东西",
    colors: ["#4c4c66", "#12121a"],
  },
  {
    id: "uestc",
    name: "电子科大专区",
    description: "成电相关的记录与经验",
    colors: ["#3a6ea8", "#1c3d63"],
  },
] as const;

/** 分类缺省值。blogs.json 是 JSON 断言成类型的，字段漏写不会被 TS 拦下。 */
export const DEFAULT_BLOG_CATEGORY = "study";

/**
 * 深渊区域：不进导航栏，藏成 Konami 秘籍（↑↑↓↓←→←→BA）的彩蛋。
 * Header 渲染分类时跳过它，但分类页 /categories/abyss 与 SEO 静态页照常可用，
 * 所以分类本身仍保留在 BLOG_CATEGORIES 里。
 */
export const HIDDEN_CATEGORY_ID = "abyss";

/** 分类内部的小书架。深渊书架仍只在隐藏分类页内展示。 */
export const BLOG_SHELVES: Record<
  BlogCategoryId,
  { id: string; name: string; description: string; sort: "fixed" | "selectable" }[]
> = {
  study: [
    {
      id: "interview",
      name: "面试复习",
      description: "计算机基础、算法与人工智能方向的复习资料",
      sort: "selectable",
    },
    {
      id: "interesting-questions",
      name: "有意思的问题",
      description: "值得多想一步的算法与计算机问题",
      sort: "selectable",
    },
    {
      id: "ai-agents",
      name: "AI 与智能体",
      description: "大模型应用、智能体开发与工程实践",
      sort: "selectable",
    },
    {
      id: "ai-tools",
      name: "工具与配置",
      description: "AI 编程工具、模型服务与账号配置指南",
      sort: "fixed",
    },
  ],
  life: [
    {
      id: "memories",
      name: "随笔与回忆",
      description: "生活片段、日常记录与童年回忆",
      sort: "selectable",
    },
  ],
  games: [
    {
      id: "pc-games",
      name: "游戏与联机",
      description: "PC 游戏、联机体验与服务器记录",
      sort: "selectable",
    },
  ],
  abyss: [
    {
      id: "beyond-wall",
      name: "长城之外",
      description: "循着荒原上的古老传闻，走入关隘之外的秘境",
      sort: "fixed",
    },
    {
      id: "beyond-wall-extras",
      name: "外传",
      description: "从王城、蓝窗与守夜人的另一面，听几段不入正卷的故事",
      sort: "fixed",
    },
  ],
  uestc: [
    {
      id: "campus-life",
      name: "校园生活",
      description: "校园周边生活与新生选购指南",
      sort: "selectable",
    },
    {
      id: "course-resources",
      name: "课程资源",
      description: "课程复习资料与学习资源指引",
      sort: "selectable",
    },
  ],
};
