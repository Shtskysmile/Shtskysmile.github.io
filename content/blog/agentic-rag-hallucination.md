# Agent实现笔记：从 HTTP 请求到 RAG 幻觉治理与评测

> [!NOTE] 这篇在写什么
> 一天之内从零写的七个脚本，`01` 到 `07`，一条线走到底：**怎么用 Agentic AI 把垂直领域的幻觉摁下去，以及怎么证明真的摁下去了。**
>
> 不装框架，不用 LangChain、LlamaIndex。检索、余弦相似度、Agent 循环全部手写，因为要面试、要笔试，讲不清内部机制的东西等于没写。
>
> 每个脚本都能单独跑，也都对应一个"为什么"。这篇把其中关键的那几行抽出来讲。

## 〇、先说背景，不然后面看不懂我在轴什么

我在准备一个 Agentic AI 岗的笔试，JD 里翻来覆去就一句话：

> use Agentic AI to greatly reduce LLM hallucination in vertical domains

翻译一下：**用 Agentic AI，大幅降低垂直领域的幻觉。** 关键词有两个——"垂直领域"和"大幅"，前者说场景是专业资料问答，后者说降了多少得拿数字说话。

HR 还补了两条约束：这不是提示词工程，也不许 vibe coding（AI 生成的代码不算）。于是这七个脚本就成了我唯一能交出的答卷：每一行我都得能解释，每一个数字我都得能复现。

整条学习路径是这样的：

| 脚本 | 讲什么 | 和幻觉的关系 |
| --- | --- | --- |
| `01` | 裸 HTTP 请求 | 先搞懂一次调用到底是什么 |
| `02` | SDK 调用 | 知道 SDK 只是封装，没魔法 |
| `03` | tool calling | 模型不再"凭记忆说"，改成"调工具查" |
| `04` | agent 循环 | 让模型自己决定查几次 |
| `05` | RAG + 引用校验 | **核心：把闭卷改成开卷** |
| `06` | 记忆 + 迭代检索 | 补上多轮追问、多跳问题这两个漏洞 |
| `07` | 评测 | **证明幻觉真的降了** |

前三步是地基，`05` 到 `07` 才是正菜。着急的话直接跳到第五节。

## 一、第一步：一次 LLM 调用就是个普通 HTTP POST

`01_raw_request.py` 故意不用任何 SDK，就 post 一个 JSON 出去，看看线上的数据结构长什么样。

```python
API_URL = "https://api.deepseek.com/chat/completions"

headers = {"Authorization": f"Bearer {os.environ['DEEPSEEK_API_KEY']}"}

request_body = {
    "model": "deepseek-chat",
    "messages": [
        {"role": "system", "content": "你是一个有帮助的助手。"},
        {"role": "user", "content": "现在是什么年份？"},
    ],
}

resp = requests.post(url=API_URL, json=request_body, timeout=400, headers=headers)
data = resp.json()
print(data["choices"][0]["message"]["content"])
```

拆成三层看：

- **请求头**：认证信息走这儿。`Authorization: Bearer <key>`。token 放错地方（比如塞进 body）是认证失败，不是"模型看到 key"，这点最容易记混。
- **请求体**：真正发给模型的业务内容。核心就一个 `messages` 数组，按时间顺序排，每条带 `role`。`system` 定人设和规则，`user` 是用户说的，`assistant` 是模型说过的。
- **响应体**：也是 JSON。模型的话在 `choices[0].message.content`。

> [!NOTE] 一个容易忽略的点
> `messages` 是个**数组**，而且要把历史全部带上。模型本身没有记忆——它每次回答，都是你把"前面聊过什么"重新贴一遍给它。这一点后面讲记忆的时候会变成一个具体的设计问题。

## 二、第二步：SDK 只是封装，没有魔法

`02_sdk_call.py` 换成官方 SDK。关键是搞明白它和 `01` 是一一对应的：

```python
client = OpenAI(
    api_key=os.environ["DEEPSEEK_API_KEY"],
    base_url="https://api.deepseek.com",   # ← 只换了这个和模型名
)

resp = client.chat.completions.create(
    model="deepseek-chat",
    messages=[...],
)
print(resp.choices[0].message.content)
```

| 裸 HTTP（01） | SDK（02） |
| --- | --- |
| `headers` + `API_URL` | `OpenAI(api_key=..., base_url=...)` |
| `request_body` 里的 key | `create()` 的关键字参数 |
| `data["choices"][0]["message"]["content"]` | `resp.choices[0].message.content` |

DeepSeek 完全兼容 OpenAI 协议，所以"换供应商"这件事，在这个层面上就是换个 `base_url` 加个模型名。**SDK 帮你做的是认证头、JSON 序列化、结果解析这些东西，它在网络上发出的请求和 `01` 一模一样。**

顺带一提，`resp.usage.total_tokens` 是能直接拿到的——这个字段后面做评估、算成本都要用。

## 三、第三步：让模型"动手"，而不是"背答案"

前两步模型都只能靠参数里的知识回答，这在垂直领域是灾难。`03_tool_call.py` 引入了 tool calling。

它的核心认知是**分工**：

> 模型只负责"决定调哪个函数、参数填什么"，**真正执行的是你的代码**。

模型不碰汇率表，它只是输出一段 JSON 告诉你"我要调 `convert`，参数是 `USD → CNY`，金额 200"。你的代码去查表、算数，把结果再喂回去。

流程是五步，`03` 完整复现了一遍：

```python
resp = client.chat.completions.create(model="deepseek-chat", messages=messages, tools=tools)

assistant_msg = resp.choices[0].message
if assistant_msg.tool_calls:
    messages.append(assistant_msg.model_dump())      # ① 模型那条含 tool_calls 的消息，原样塞回

    for tc in assistant_msg.tool_calls:
        args = json.loads(tc.function.arguments)     # ② arguments 是「字符串」，必须解析
        try:
            tool_content = str(convert(**args))
        except Exception as e:
            tool_content = f"工具出错:{e}"            # ③ 报错也不崩，喂回错误让模型自纠

        messages.append({
            "role": "tool",
            "tool_call_id": tc.id,                   # ④ 靠 id 对应回是哪次调用
            "content": tool_content,
        })

resp2 = client.chat.completions.create(..., messages=messages, tools=tools)  # ⑤ 再问一次
```

三个坑，全是手写才会踩到的：

1. **`tc.function.arguments` 是字符串，不是 dict。** 模型的输出本质是文本，JSON 只是文本的一种约定格式，所以必须 `json.loads`。
2. **模型那条 `assistant` 消息必须原样塞回历史。** 里面带着 `tool_calls` 结构，丢了它，后面那条 `role: "tool"` 的结果就无处安放。
3. **`tool_call_id` 是配对用的。** 一次可能并行调好几个工具，靠 id 才能知道哪个结果配哪个调用。

工具定义里的 `description` 不是注释，是**给模型看的说明书**。模型靠它判断什么时候该调这个函数。写"把一种货币金额换算成人民币。当用户提到汇率、换算金额时使用"，比写"汇率转换"有效得多——前者既说了干什么，也说了什么时候干。

## 四、第四步：一次工具调用不够，那就循环

`03` 只能调一轮。但真实问题常常要调好几步，比如"200 美元和 100 欧元加起来换人民币是多少"——得调两次 `convert`，再调一次 `calculate` 加法。

`04_agent_loop.py` 把单次往返包成一个循环：

```python
max_steps = 40
for i in range(max_steps):
    resp = client.chat.completions.create(model="deepseek-chat", messages=messages, tools=tools)

    if resp.choices[0].finish_reason != "stop":     # 模型还没说完 → 它在要工具
        assistant_message = resp.choices[0].message
        messages.append(assistant_message.model_dump())
        for tool in assistant_message.tool_calls:
            tool_name = tool.function.name
            if tool_name not in tools_dict:          # 工具注册表，防幻觉调用
                raise NotImplementedError()
            args = json.loads(tool.function.arguments)
            tool_result = tools_dict[tool_name](**args)
            messages.append({"role": "tool", "tool_call_id": tool.id, "content": str(tool_result)})
    else:
        break                                        # finish_reason == "stop" → 说完了，收工
```

四个设计点：

- **`finish_reason` 是循环的刹车信号。** 它等于 `"stop"` 表示模型给出了最终回答；其他值（比如 `"tool_calls"`）表示它还想调工具。用这个判断比猜内容靠谱。
- **`max_steps` 是死循环保险。** 模型有可能反复调同一个工具停不下来，步数上限是最后一道闸。同时也是成本闸——每多一步就多一次 API 调用。
- **`tools_dict` 是工具注册表。** 名字→函数的映射。收到模型报的工具名，先查它在不在表里，不在就直接报错。这一步看似多余，其实是在防"模型编了一个不存在的工具名"。
- **错误也是有效信息。** `03` 里工具抛异常时没有崩，而是把错误信息作为 `content` 喂回去。模型看到"不支持的货币对"，下一轮往往就自己改参数了。这比程序直接崩掉健壮得多。

到这里，一个能自己决定"查几次、怎么查"的 Agent 就成型了。但**注意：工具调得再溜，也不解决幻觉问题**——`convert` 返回的是真汇率，可模型在总结的时候照样可能给你编一个数字。真正的重头戏在下一步。

## 五、第五步（核心）：把闭卷考试改成开卷考试

`05_rag.py` 是整条线的重心。它要解决的根本问题是一句话：

> 不要问模型"你记得吗"，把**原文**喂给它，让它只负责读。

一条完整流水线有五层，每层都能单独 print 出来看：

```
文档 → ①切块 → ②向量化 → ③检索 → ④生成（带引用）→ ⑤校验
```

### ① 切块：为什么不能等长硬切

```python
def chunk_markdown(text, max_chars, overlap):
    sections = re.split(r"\n(?=## )", text)   # 先按 ## 标题切
    ...
```

中文没有空格分词，等长硬切会把一个规格参数从中间劈开——`"供电：DC 12~"` | `"36V 宽压"`。检索命中了也读不出答案。

所以策略是三级：

1. **优先按 `##` 标题切**，天然语义边界。
2. 某节太长，**再按空行切段，贪心装箱**（尽量塞满一个 chunk 再开新的）。
3. 开新块时**带上上一块的尾巴（`overlap` 字符）**，防止关键句恰好跨在切点上。

还有一个细节：每块都**带上它所属的标题**（代码里叫 heading propagation）。不带的话，第二个 chunk 开始就丢了"这是哪一节"的上下文，检索质量明显下降。

### ② 向量化：查询和文档可以不对称

用本地句向量模型 `BAAI/bge-small-zh-v1.5`（约 95MB，不花钱不联网跑推理）：

```python
QUERY_PREFIX = "为这个句子生成表示以用于检索相关文章："

def embed(self, texts, is_query=False):
    if is_query:
        texts = [QUERY_PREFIX + t for t in texts]
    return self.model.encode(texts, normalize_embeddings=True)
```

这里有个真实的工程细节：**bge 官方建议给"查询"加指令前缀，给"文档"不加。** 同一个模型，查询侧和文档侧的预处理方式可以不对称。这事不看书是想不到的。

`normalize_embeddings=True` 让向量长度变成 1，余弦相似度就退化成点积，后面能省一次除法——只是优化，不改变结果。

还写了个降级方案 `CharNgramEmbedder`：字符 2-gram 的 TF-IDF，纯 numpy，零下载断网可用。它不是语义向量，只是字面统计，但能保证流程在考场断网时照样跑起来，也顺便让人对比出"语义检索到底比字面匹配强在哪"。

### ③ 检索：为什么是余弦不是欧氏距离

```python
def cosine_topk(query_vec, doc_vecs, k):
    sims = doc_vecs @ query_vec       # 归一化后，点积就是余弦相似度
    order = np.argsort(-sims)[:k]     # 从大到小取前 k 个
    return [(int(i), float(sims[i])) for i in order]
```

**用余弦不用欧氏距离，是因为向量长度会受文本长短影响。** 一个长 chunk 和一个短 chunk，哪怕语义一致，向量模长也不同，欧氏距离会因此失真。余弦只看方向，衡量语义取向是否一致，与长度无关。

### ④ 生成：强制标出处

system prompt 是关键，它把模型从"答题者"降级成"阅读理解者"：

```
你是一个严格的资料问答助手。你只能依据【资料】回答问题。

规则：
1. 只使用【资料】中出现的信息，不得使用你自己的知识补充任何细节。
2. 【资料】不足以回答时，answer 必须写成"资料中没有相关信息"，citations 留空数组。
3. 每个结论都要在 citations 里标出它来自哪几段资料（用方括号里的编号）。
4. 资料里没有提到的数字、型号、参数，绝对不许出现。
5. 只输出 JSON：{"answer": "...", "citations": [1, 2]}
```

配套用 `response_format={"type": "json_object"}` 让 API 保证返回合法 JSON，省掉解析失败的兜底代码。

### ⑤ 校验：光让模型标出处是不够的

**这是整个脚本我认为最值得讲的一层。** 因为——

> 你让模型标出处，它也会**编出处**。引用的编号可能是凭空写的。

所以必须用程序回查。`verify()` 做两件事：

```python
label_to_chunk = {label_of(idx): idx for idx, _ in hits}
cited = answer_obj.get("citations") or []

for c in cited:
    if c not in label_to_chunk:
        problems.append(f"引用了不存在的编号 [{c}]")   # a) 防凭空编号

cited_text = "".join(chunks[label_to_chunk[c]] for c in cited if c in label_to_chunk)
# b) 防编造参数：回答里的每个数字，能否在被引用的原文里找到
```

- **a) 引用的编号是否真的在本次检索结果里**——防凭空编号。
- **b) 回答里出现的数字，是否真的能在被引用的片段里找到**——防编造参数。

这里有个**反直觉的坑**：不能拿回答的整段文字去比对原文，得**先把两边的"数字 token"分别抽出来，再做集合匹配**。

```python
supported = set()
for seg in re.findall(r"\d+(?:\.\d+)*", cited_text):   # 原文里的数字段
    for piece in [seg] + re.split(r"\.", seg):         # "192.168.1.200" 拆成 192/168/1/200
        supported.add(piece)

unsupported = [n for n in re.findall(r"\d+(?:\.\d+)?", answer) if n not in supported]
```

原文里 `12~36V` 抽出来是 `{"12", "36"}`，回答写 `36` 就能命中。而 `192.168.1.200` 这种带点的，靠 `re.split(r"\.")` 拆开，让回答引用整串或引用其中一段都算有出处。**如果不拆 token 而是直接查子串，`"36"` 反而会因为 `"12~36"` 这个整体对不上而被误报。**

### 还有一道闸门：证据不足就直接拒答

```python
SCORE_FLOOR = 0.45   # 相似度低于这个值就拒答

top_score = hits[0][1] if hits else 0.0
if top_score < SCORE_FLOOR:
    print("证据不足，不调用模型")
    print("回答：资料中没有相关信息。")
    continue
```

**最高相似度低于阈值，根本不调模型。** 模型没机会编，也就不会编。这是降幻觉最粗暴也最有效的一招。

> [!NOTE] 一个会把正确引用误判成编造的坑
> `label_of(chunk_idx) = chunk_idx + 1`，看着不起眼，但它保证了 **prompt 里给模型看的编号**和**校验时回查用的编号是同一套**。
>
> 如果模型老老实实引用了 `[2]`，而你校验时按"第 2 个检索结果"去查，就会把正确引用判成编造——**这是自己给自己制造的假警报**，比不校验还糟，因为它会让你去修一个不存在的问题。

## 六、第六步：补上记忆和"答一半"

`06_memory_research.py` 干两件事，看着无关，其实都在对付同一类幻觉。

### A. 记忆：没有记忆的多轮对话全是幻觉温床

**短期记忆**负责对话历史。没有它，多轮追问会被当成孤立问题——「那它的防护等级呢？」里的"它"是谁？模型只能猜，**猜就是幻觉的开始**。

它有压缩机制：只保留最近 `max_turns` 轮原文，更老的压成一段摘要。

```python
def _compress(self):
    if len(self.turns) <= self.max_turns:
        return
    cut = len(self.turns) - self.max_turns
    old, self.turns = self.turns[:cut], self.turns[cut:]
    # 把 old 压成一段摘要，保留"讨论的对象是什么、问过哪些点、结论是什么"
```

为什么不无限保留？上下文窗口有限，越长越贵，而且越长越容易"中间遗忘"（模型对长上下文中间部分的注意力会下降）。摘要是有损的，但比丢掉整段历史强——这是工程取舍。

**长期记忆**是跨会话的稳定事实，存 JSON：

```json
{
  "facts": [
    "用户是深圳的系统集成商",
    "用户的客户主要是食品厂",
    "用户计划将设备安装在海边潮湿的车间里"
  ]
}
```

它只记"稳定"的事实，不记一次性的提问。这个筛选本身就是防幻觉的一环：**如果把用户随口说的话都记下来，记忆库会变成噪音，下次检索到无关的"事实"反而会污染回答。** 抽取还是让模型做，但给了明确的取舍规则：值得记的是身份/行业/长期偏好/明确纠正，不值得记的是一次性提问、寒暄、通用知识能答的东西。

不会被记的一次性提问，追问时模型就会反问而不是瞎猜。「滤网单独买一个多少钱」这种没有答案的问题，也就不会因为"上次好像聊过设备"而被编出价格。

### B. 迭代检索：让模型有机会说"还不够"

单轮 top-k 只能覆盖"答案在一段话里"的问题。真实问题常是两种：

- **多跳**：答案分散在两处，要先查到 A 才知道该去查 B。
- **线索式**：先找到线索（"防护等级 IP30"），再顺着线索深入（"不防水"→"那保修呢"）。

为什么"答一半"是幻觉高发区？

> **模型不会说"我只查到一半"，它会用查到的那一半，补出一个听起来完整的答案。**

所以迭代检索的关键**不是"多查几次"，而是让模型有机会说"还不够"**——把"承认信息不足"变成一个显式的、程序可执行的动作。

循环长这样：查 → 自评够不够 → 不够就换角度改写检索词 → 再查 → 够了才回答。

```python
verdict = assess(question, collected, chunks, tried)   # 让模型判断"资料够不够"
if verdict.get("irrelevant"):   # 资料里根本没这个主题 → 别再试了
    break
if verdict.get("sufficient"):   # 够了 → 收工
    break
nxt = verdict.get("next_query", "").strip()
if not nxt or nxt in tried:     # 改写失败或原地打转 → 别浪费轮次
    break
query = nxt
```

自评 prompt 里藏着一条很实用的约束：**改写检索词时"用资料里出现过的术语，不要用问题里的口语说法"**。这本质上是在做 query 侧的同义改写，把用户的口语映射到文档的专业术语上。

### 最难的一个判断：三种信号，谁优先

`06` 里这段注释我改了三四遍，因为顺序定错了就会"误杀"：

```python
if irrelevant:
    ...  # 1) 自评说"资料里没这主题" —— 最可靠，直接拒答
elif not hits or not sufficient and top < rag.SCORE_FLOOR:
    ...  # 3) 自评说不够 + 分数也低 —— 才是真的没检索到
else:
    ...  # 2) 自评说"够了" —— 就算分数不高也信它
```

三档信号的可靠性是不一样的：

1. **自评 `irrelevant` 最可靠。** 这是语义判断，能识别"讲的是别的主题"。
2. **自评 `sufficient` 次可靠。** 它已经看过资料原文，说"够了"就该信。
3. **分数只是兜底。** 余弦分只看向量相似程度，**看不懂"资料里确实有答案但用词不同"**。

第二档的例子上文提过：用户问「海边潮湿影响保修吗」，资料里写的是「进水或受潮不在保修范围」。**余弦分不会高**（用词完全不同），但答案确确实实在那儿。如果只卡分数，这类问题全被误杀。

> [!NOTE] 过度保守也是失败
> 「该答的拒答」和「该拒答的硬答」**都是失败**。只堵一头（比如把阈值拉到 0.9，一律说不知道）是刷分作弊，不是解决问题。这是评估里必须双向量化的原因——见下一节。

## 七、第七步：怎么证明幻觉真的降了

JD 那句话的后半截是 "greatly reduce"。前六个脚本回答了 how，`07_eval.py` 回答 **and how do you prove it**。没有这一步，前面全是主观感受。

核心方法是**金标集（golden set）+ 可自动判定的指标**：

> golden set = 一批 `(问题, 标准答案要点, 正确出处)` 三元组，人工标注。
> 它是一次性投入，之后每次改代码都能重跑，**这就是"可回归"**。

```python
GOLDEN = [
    {"q": "LS-200 的工作温度范围是多少？", "expect": "answer",
     "keywords": ["-20", "70"], "must_not": [], "cite_any": [1]},
    ...
    {"q": "LS-200 支持 4G 联网吗？", "expect": "refuse",   # 手册只提 Wi-Fi 和以太网
     "keywords": [], "must_not": [], "cite_any": []},
]
```

四个指标，每个直接对应一种失败：

| 指标 | 衡量什么 | 对应哪种失败 |
| --- | --- | --- |
| 准确率 accuracy | 该答对的是否答对 | 检索质量 |
| 幻觉率 hallucination | 资料里没有却说有 | 生成是否守规矩（最严重） |
| 拒答正确率 refusal | 该说"不知道"的是否说了 | 闸门是否有效 |
| 引用正确率 citation | 引的出处是否真支持结论 | 可核对性 |

关键：**幻觉率是程序自动判定的，不是让模型自评。** 做法是把回答里的所有数字回查到被引原文——和 `05` 的 `verify()` 同一个思路，只是扩展成统计。

> 模型自评不可信：**它编的时候自己也不知道在编。**

### 最有用的一个开关：`--no-rag`

```bash
python 07_eval.py            # 开卷（RAG）
python 07_eval.py --no-rag   # 对照组：闭卷作答
```

同一批问题，闭卷 vs 开卷，就是 A/B 对照。我实测跑出来：

| 指标 | 闭卷（不用检索） | 开卷（RAG） |
| --- | --- | --- |
| 准确率 accuracy | 25.0% (1/4) | **100.0% (4/4)** |
| 幻觉率 hallucination | 25.0% (1/4) | **0.0% (0/4)** |
| 拒答正确 refusal | 0.0% (0/3) | **100.0% (3/3)** |
| 引用正确 citation | 0.0% (0/4) | **100.0% (4/4)** |
| └ 无资料却作答 | 100.0% (3/3) | **0.0% (0/3)** |

模型是 `deepseek-chat`，语料是一份 LS-200 工业网关产品手册，7 道题（4 道该答 + 3 道该拒答）。

**闭卷组的 0/3 最值得看。** 那三道"资料里没有"的题，模型全都给出了回答：

- 「滤网单独买一个多少钱？」→ 一本正经解释"价格会因品牌、型号、渠道而异，建议联系客服"。它不知道滤网，但知道**报价这件事通常怎么答**。
- 「LS-200 支持 4G 联网吗？」→ 干脆利落地答"不支持 4G 联网"。这个答案**看起来甚至是对的**，但它是"编得像真的"，不是"查到的"。

这就是最危险的一类幻觉：**不是胡言乱语，而是格式工整、措辞专业、错误难以察觉。** 在垂直领域里，这种答案拿去用是事故。

开卷组把这 0/3 变成了 3/3。机制很简单——**资料里根本没有这个主题，模型的注意力找不到落点，它就只能说不知道。**

### 连评测集自己都有坑

`must_not` 用来防"说了不该说的事"。但有个反直觉的坑：

```python
# 资料写「不支持 5GHz」，回答也写「不支持 5GHz」
# 用子串匹配，会被判成"说了支持 5GHz" → 假幻觉
NEGATIONS = ["不", "无", "未", "非", "没", "否"]

def contains_positive(text, phrase):
    """phrase 出现且前面没有否定词，才算真的说了 phrase。"""
```

**你用来判断幻觉的代码本身会幻觉，这才是最讽刺的。** 评估集误判会直接骗过自己——你以为指标在报警，其实是尺子坏了。

## 八、把七个脚本串起来：这套东西到底怎么降幻觉

回头看，整条线上有**六个抓手**，每一个都对应一种具体的幻觉成因：

| 抓手 | 靠哪个脚本 | 打的是什么幻觉 |
| --- | --- | --- |
| 证据进上下文 | `05` | 不问"你记得吗"，只让它读原文 |
| 结构化出处 | `03` `05` | 强制 citations，结论要能指回片段 |
| 程序回查引用 | `05` `07` | 模型会编出处，必须用程序验 |
| 允许说不知道 | `05` `06` | 证据不足直接拒答，压根不调模型 |
| 记忆补全指代 | `06` | 别让模型猜"它"是谁 |
| 迭代检索 | `06` | 别让模型用查到的一半补出完整答案 |

而这六个抓手能被相信，全靠 `07` 的四个数字。

> [!NOTE] 面试/笔试里真正会被问的
> "你的方案怎么降幻觉？"——列六个抓手。
>
> "怎么证明降了？"——**报 A/B 对照的数字**：同一批题，闭卷 1/4、开卷 4/4；无资料编造 100% → 0%。
>
> "你这个评估本身可信吗？"——这一问最见水平。答：幻觉率由程序按数字回查明文原文判定，不用模型自评；评测集的否定词处理也有专门规避。**能指出自己指标的边界，比报一个漂亮数字更有说服力。**

## 九、几个真实的取舍

写完回头看，有几处是刻意选的路，不是顺手写的：

- **不用框架。** LangChain 能把 RAG 压成十行，但被追问"切块为什么这么切""余弦为什么不是欧氏距离"就答不上来了。手写一遍，每个旋钮在哪、拧了会怎样，全在手上。
- **降级方案不是可选装饰。** `CharNgramEmbedder` 让整个流程在断网、没下模型时也能跑。**演示的确定性**比"效果好时很好"重要。
- **阈值是调出来的，不是拍出来的。** `SCORE_FLOOR` 和 `MAX_CHARS` 都能通过 `--floor` / `--max-chars` 覆盖，专门用来做消融实验。哪个值好，让指标说话。
- **拒答和作答都要量化。** 只优化幻觉率会走向"一律说不知道"，只优化准确率会走向"什么都敢编"。四个指标一起看，才能两边都堵住。

## 十、结语

源码如果只挑一句带走，是这句：

> **幻觉的本质不是模型想骗你，而是它被问了它不知道的事，又不好意思说不知道。**

所以这七个脚本做的所有事，归根结底是两条：**要么把答案递到它眼前（RAG、工具、记忆），要么给它一条体面地说"不知道"的路（阈值闸门、自评、结构化拒答）。**

然后是第三条，也是最容易被跳过的一条：**用一组能复现的数字，证明前两条真的起作用了。**

代码全部手写，用 `conda activate agentic` 就能跑，语料是一份自造的工业网关手册。有想复现的，直接照脚本顺序从 `01` 敲到 `07` 就行——每一步都能单独 print 出中间结果看。
