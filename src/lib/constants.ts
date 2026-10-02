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
