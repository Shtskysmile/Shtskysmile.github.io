import type { LucideIcon } from "lucide-react";

interface SocialButtonProps {
  href: string;
  icon: LucideIcon;
  label: string;
}

export default function SocialButton({ href, icon: Icon, label }: SocialButtonProps) {
  // mailto: 走系统邮件客户端，加 target="_blank" 只会多弹一个空白标签
  const isExternal = !href.startsWith("mailto:");

  return (
    <a
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 text-stone-600 transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:border-stone-600 dark:text-stone-400 dark:hover:border-accent dark:hover:text-accent"
    >
      <Icon size={16} />
    </a>
  );
}
