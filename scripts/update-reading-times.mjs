/**
 * 把每篇文章的预计阅读时长写回 content/blogs.json。
 *
 * 列表页原先是为了显示「N 分钟阅读」才把每篇正文整篇拉下来，
 * 首页 15 篇合计 312 KB（其中一篇就 161 KB），纯属浪费。
 * 时长是派生数据，算一次存进元数据即可。
 *
 * 用法：node scripts/update-reading-times.mjs
 *
 * 注意：原来的 estimateReadingTime 按空白分词除以 200，中文没有空格，
 * 所以 28000 字的中文文章只算成 50 分钟。这里改成中文按字符计。
 * 代码块里的内容也计入——这些复习资料里 SQL、公式本身就是阅读对象。
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BLOGS_JSON = resolve(ROOT, "content/blogs.json");
const BLOG_DIR = resolve(ROOT, "content/blog");

/** 中文按 350 字/分钟，西文按 200 词/分钟 */
function readingMinutes(markdown) {
  const cjk = (markdown.match(/[㐀-䶿一-鿿]/g) || []).length;
  const latin = (markdown.match(/[A-Za-z0-9]+/g) || []).length;
  return Math.max(1, Math.round(cjk / 350 + latin / 200));
}

const posts = JSON.parse(readFileSync(BLOGS_JSON, "utf-8"));
let source = readFileSync(BLOGS_JSON, "utf-8");
const changed = [];

for (const post of posts) {
  const markdown = readFileSync(resolve(BLOG_DIR, post.blogUrl), "utf-8");
  const minutes = readingMinutes(markdown);

  if (post.readingMinutes === minutes) continue;

  // 定点插入，不用 JSON 重新序列化——那会把 tags 这种单行数组拆成多行
  const anchor = new RegExp(
    `("blogUrl": "${post.blogUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}",\\n\\s*"category": "[a-z]+",\\n)`,
  );
  if (!anchor.test(source)) {
    throw new Error(`找不到插入位置：${post.blogUrl}`);
  }
  source = source.replace(anchor, `$1    "readingMinutes": ${minutes},\n`);

  changed.push(`${post.blogUrl}: ${post.readingMinutes ?? "(无)"} → ${minutes}`);
}

if (changed.length === 0) {
  console.log("阅读时长已是最新，无需改动。");
} else {
  writeFileSync(BLOGS_JSON, source, "utf-8");
  console.log(`已更新 ${changed.length} 篇：`);
  for (const line of changed) console.log(`  ${line}`);
}
