// Social links, GitHub config, and shared constants

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
    name: "游戏",
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
