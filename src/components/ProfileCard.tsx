import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { Github, Mail, Send, Twitter, Youtube } from "lucide-react";
import Card from "@/components/ui/Card";
import SocialButton from "@/components/ui/SocialButton";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { GITHUB_AVATAR_URL, SOCIAL_LINKS } from "@/lib/constants";
import profileMd from "@content/profile.md?raw";

const ICON_MAP: Record<string, typeof Github> = {
  GitHub: Github,
  Email: Mail,
  Telegram: Send,
  X: Twitter,
  YouTube: Youtube,
};

// Split at the first blank-line boundaries so the first 3 paragraphs are the preview
const PREVIEW_CUTOFF = 3;

function splitMarkdown(md: string): [string, string] {
  // Normalise CRLF → LF so the blank-line split works on every OS
  const normalised = md.replace(/\r\n/g, "\n");
  const paragraphs = normalised.trim().split(/\n\n+/);
  const preview = paragraphs.slice(0, PREVIEW_CUTOFF).join("\n\n");
  const rest = paragraphs.slice(PREVIEW_CUTOFF).join("\n\n");
  return [preview, rest];
}

export default function ProfileCard() {
  const [expanded, setExpanded] = useState(false);
  const prefersReduced = useReducedMotion();
  const [preview, rest] = splitMarkdown(profileMd);

  return (
    <Card className="overflow-hidden p-0">
      <div className="relative px-4 pb-4 pt-4">
        {/* Avatar */}
        <div className="mb-3">
          <img
            src={GITHUB_AVATAR_URL}
            alt="Shtskysmile 头像"
            width={112}
            height={112}
            loading="eager"
            data-live2d-hover="avatar"
            className="h-28 w-28 rounded-full border-4 border-surface-card-light object-cover shadow-lg dark:border-surface-card-dark"
          />
        </div>

        {/* Name */}
        <h1 className="mb-3 font-heading text-2xl text-stone-800 dark:text-stone-100">
          Shtskysmile
        </h1>

        {/* Bio */}
        <section aria-label="关于我" data-live2d-hover="about">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            关于我
          </h2>

          <div className="prose prose-sm prose-stone max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview}</ReactMarkdown>

            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  key="extended"
                  initial={prefersReduced ? { opacity: 1 } : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={prefersReduced ? { duration: 0 } : { duration: 0.35 }}
                  className="overflow-hidden"
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{rest}</ReactMarkdown>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {rest && (
            <button
              onClick={() => setExpanded((p) => !p)}
              className="mt-2 text-sm text-accent underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              {expanded ? "收起" : "展开更多"}
            </button>
          )}
        </section>

        {/* Social */}
        <div className="mt-5" data-live2d-hover="socials">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            联系我
          </h2>
          <div className="flex gap-2">
            {SOCIAL_LINKS.map((link) => {
              const Icon = ICON_MAP[link.name];
              return Icon ? (
                <SocialButton key={link.name} href={link.url} icon={Icon} label={link.label} />
              ) : null;
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
