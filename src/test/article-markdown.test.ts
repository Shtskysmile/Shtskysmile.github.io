import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Blockquote, Root } from "mdast";
import { remarkNote } from "@/components/ArticleMarkdown";

function run(md: string): Blockquote | undefined {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md) as Root;
  const transformer = remarkNote() as unknown as (t: Root) => void;
  transformer(tree);
  return tree.children.find((n): n is Blockquote => n.type === "blockquote");
}

describe("remarkNote", () => {
  it("标记行单独成段时：摘掉标记段并挂上标题", () => {
    const bq = run("> [!NOTE] 作者的话\n>\n> 正文内容\n");
    expect(bq?.children).toHaveLength(1);
    expect(bq?.children[0]?.type).toBe("paragraph");
    expect(bq?.data?.hProperties).toEqual({ "data-note": "作者的话" });
    const para = bq?.children[0];
    expect(para?.type === "paragraph" && para.children[0]?.type === "text"
      ? para.children[0].value
      : "").toBe("正文内容");
  });

  it("标题留空时回退为「注意」", () => {
    const bq = run("> [!NOTE]\n>\n> 正文\n");
    expect(bq?.data?.hProperties).toEqual({ "data-note": "注意" });
  });

  it("漏写空行时不吞正文：整块原样保留，不打标记", () => {
    const bq = run("> [!NOTE] 作者的话\n> 正文内容\n");
    expect(bq?.data?.hProperties).toBeUndefined();
    expect(bq?.children).toHaveLength(1);
    const para = bq?.children[0];
    const text = para?.type === "paragraph" && para.children[0]?.type === "text"
      ? para.children[0].value
      : "";
    expect(text).toContain("正文内容");
  });

  it("普通引用块不受影响", () => {
    const bq = run("> **用途说明**：一些内容\n");
    expect(bq?.data?.hProperties).toBeUndefined();
    expect(bq?.children).toHaveLength(1);
  });

  it("嵌套在别处的引用块也能识别", () => {
    const tree = unified().use(remarkParse).use(remarkGfm).parse(
      "- 列表项\n\n  > [!NOTE] 嵌套\n  >\n  > 正文\n",
    ) as Root;
    (remarkNote() as unknown as (t: Root) => void)(tree);
    const found: string[] = [];
    (function walk(n: unknown) {
      const node = n as { type?: string; children?: unknown[]; data?: { hProperties?: unknown } };
      if (node.type === "blockquote" && node.data?.hProperties) found.push("hit");
      node.children?.forEach(walk);
    })(tree);
    expect(found).toHaveLength(1);
  });
});
