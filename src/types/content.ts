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

export interface BlogPost {
  title: string;
  description: string;
  tags: string[];
  author: string;
  publishDate: string;
  blogUrl: string;
  /** 文件名（位于 public/images/blog/）。留空则卡片与文章页都不渲染缩略图。 */
  thumbnail?: string;
  highlight?: boolean;
}
