export interface Certificate {
  title: string;
  issuer: string;
  date: string;
  pdfUrl: string | null;
}

export interface Skill {
  name: string;
  icon: string;
  description: string;
}

export interface Technology {
  name: string;
  icon: string;
}

export interface OperatingSystem {
  name: string;
  icon: string;
}

export interface SkillsData {
  skills: Skill[];
  technologies: Technology[];
  operatingSystems: OperatingSystem[];
}

/** 博客分类，与 constants.ts 的 BLOG_CATEGORIES 一一对应 */
export type BlogCategoryId = "study" | "life" | "games" | "abyss";

export interface BlogPost {
  title: string;
  description: string;
  tags: string[];
  author: string;
  publishDate: string;
  blogUrl: string;
  category: BlogCategoryId;
  /**
   * 预计阅读时长（分钟）。派生数据，由 scripts/update-reading-times.mjs 写入。
   * 放在元数据里是为了让列表页不必为了显示时长去下载整篇正文。
   */
  readingMinutes?: number;
  /** 文件名（位于 public/images/blog/）。留空则卡片与文章页都不渲染缩略图。 */
  thumbnail?: string;
  highlight?: boolean;
}
