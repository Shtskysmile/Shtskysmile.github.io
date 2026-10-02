import { Compass } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";

const PURPOSES = [
  {
    key: "A",
    title: "介绍一下我自己",
    text: "目前能拿出来的就是学校、专业和大致的兴趣方向。以后攒到实习或者论文，也会补在这一块——现在确实还没有，不是忘了写。",
  },
  {
    key: "B",
    title: "给学弟学妹们提供一些保研的策略",
    text: "把自己走过的那一段整理成能直接用的东西：什么阶段该干什么、材料怎么准备、不同学校各看重什么、哪些坑我踩过。不敢说多权威，至少比道听途说全一点。",
  },
  {
    key: "C",
    title: "引发一些讨论",
    text: "写点我自己也没完全想明白的看法，专门等懂行的人来纠正。被反驳一次，通常比自说自话涨得快——欢迎抬杠，但请带论据。",
  },
  {
    key: "D",
    title: "当作自己的日记或者随想录",
    text: "有些东西写下来才算真想清楚，顺便留个能回头翻的存档。本来没打算给谁看，所以写得随意；如果你在看，就当路过听见我自言自语。",
  },
  {
    key: "E",
    title: "发癫玩",
    text: "前四条多少还得端着点，这条不用。不定期投放不着调的内容，权当给这个正经网站装了个排气阀——点进来看到离谱东西，别惊讶。",
  },
];

/** 首页的「建站目的」——替换了原来的技能区块 */
export default function SitePurpose() {
  return (
    <Card>
      <div data-live2d-hover="purpose">
        <SectionTitle icon={Compass}>建站目的</SectionTitle>
        <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
          这个主页大致是拿来干这几件事的。
        </p>

        <ul className="flex flex-col gap-3.5">
          {PURPOSES.map((item) => (
            <li key={item.key} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-xs font-semibold text-accent dark:bg-accent/20"
              >
                {item.key}
              </span>
              <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                <span className="font-semibold text-stone-800 dark:text-stone-100">
                  {item.title}
                </span>
                <span className="text-stone-400 dark:text-stone-500">：</span>
                {item.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
