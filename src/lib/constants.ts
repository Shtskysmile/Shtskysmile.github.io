// Social links, GitHub config, and shared constants

export const GITHUB_USERNAME = "Shtskysmile";
export const GITHUB_AVATAR_URL = `https://avatars.githubusercontent.com/${GITHUB_USERNAME}`;
export const GITHUB_REPOS_API = `https://api.github.com/users/${GITHUB_USERNAME}/repos`;

// 想加更多社交链接时，按下面格式追加即可。
// 可用图标（见 ProfileCard.tsx 的 ICON_MAP）：GitHub / Telegram / X / YouTube
export const SOCIAL_LINKS = [
  {
    name: "GitHub",
    url: `https://github.com/${GITHUB_USERNAME}`,
    label: "GitHub",
  },
] as const;

export const THEME_STORAGE_KEY = "theme";
export const SCROLL_TOP_THRESHOLD = 300;
