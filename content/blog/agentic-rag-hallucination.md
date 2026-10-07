# Agent 实现笔记：从 HTTP 请求到 RAG 幻觉治理与评测

> 本文记录七个脚本的阶段性实现，从 `01` 到 `07`，围绕垂直领域问答中的证据使用与评测展开。
>
> 不使用框架，检索、余弦相似度、agent 循环全部手写，以便梳理并解释内部机制。
>
> 七个脚本均可独立运行，各自对应一个设计问题。下文抽取其中的关键实现。

## 〇、学习路径与实现目标

这组脚本依次演示从底层 HTTP 请求到 RAG 与评测的实现过程，目标是理解各组件如何影响回答质量与资料依据。整体结构如下：

| 脚本 | 内容 | 与幻觉的关系 |
| --- | --- | --- |
| `01` | 裸 HTTP 请求 | 先明确一次调用到底是什么 |
| `02` | SDK 调用 | 说明 SDK 只是封装，没有额外机制 |
| `03` | tool calling | 模型不再"凭记忆说"，改为"调工具查" |
| `04` | agent 循环 | 让模型自行决定查询次数 |
| `05` | RAG + 引用校验 | 核心：把闭卷改为开卷 |
| `06` | 记忆 + 迭代检索 | 补上多轮追问、多跳问题两个缺口 |
| `07` | 评测 | 观察回答正确性与资料忠实度 |

前三节是基础，`05` 至 `07` 是核心。

## 一、第一步：一次 LLM 调用即一个普通 HTTP POST

`01_raw_request.py` 不使用任何 SDK，直接发送一个 JSON 请求，观察线上的数据结构。

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

请求可拆为三层：

- 请求头：认证信息在此。`Authorization: Bearer <key>`。token 放错位置（例如置于 body）会导致认证失败，而非「模型看到了 key」，这一点容易混淆。
- 请求体：真正发送给模型的业务内容，核心是 `messages` 数组，按时间顺序排列，每条带 role。system 定义人设与规则，user 是用户输入，assistant 是模型的历史输出。
- 响应体：同样是 JSON，模型输出位于 `choices[0].message.content`。

有一点容易忽略：`messages` 是数组，且必须包含完整历史。模型本身没有记忆，每次回答都是把「此前对话内容」重新附上。这一点在讨论记忆时会转化为一个具体的设计问题。

## 二、第二步：SDK 只是封装

`02_sdk_call.py` 改用官方 SDK，其关键是与 `01` 的一一对应关系：

```python
client = OpenAI(
    api_key=os.environ["DEEPSEEK_API_KEY"],
    base_url="https://api.deepseek.com",   # 只换了这个和模型名
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

DeepSeek 完全兼容 OpenAI 协议，因此在这一层面上「更换供应商」等同于更换 `base_url` 与模型名。SDK 完成的是认证头、JSON 序列化、结果解析等工作，它在网络上发出的请求与 `01` 完全一致。

另需注意，`resp.usage.total_tokens` 可直接获取，该字段在后文评估与成本计算中会用到。

## 三、第三步：让模型调用工具，而非依赖参数记忆

前两步中，模型只能依据参数中的知识作答，这在垂直领域是不可靠的。`03_tool_call.py` 引入 tool calling。

其核心在于分工：模型只负责决定调用哪个函数、参数填什么，实际执行由应用代码完成。

模型不访问汇率表，它只输出一段 JSON，表明「要调用 convert，参数为 USD 到 CNY，金额 200」。应用代码查表、计算，再把结果送回模型。

流程共五步，`03` 完整实现了一遍：

```python
resp = client.chat.completions.create(model="deepseek-chat", messages=messages, tools=tools)

assistant_msg = resp.choices[0].message
if assistant_msg.tool_calls:
    messages.append(assistant_msg.model_dump())      # ① 模型那条含 tool_calls 的消息，原样塞回

    for tc in assistant_msg.tool_calls:
        args = json.loads(tc.function.arguments)     # ② arguments 是字符串，必须解析
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

三个易错点，均在手写实现时才会遇到：

1. `tc.function.arguments` 是字符串而非 dict。模型的输出本质是文本，JSON 只是文本的一种约定格式，因此必须 `json.loads`。
2. 模型那条 assistant 消息必须原样放回历史。其中带有 `tool_calls` 结构，丢弃它之后，随后的 `role: "tool"` 结果便无处安放。
3. `tool_call_id` 用于配对。一次可能并行调用多个工具，依靠 id 才能确定哪个结果对应哪次调用。

工具定义中的 description 不是注释，而是提供给模型的说明书，模型据此判断何时调用该函数。写「把一种货币金额换算成人民币。当用户提到汇率、换算金额时使用」比写「汇率转换」有效得多：前者既说明功能，也说明调用时机。

## 四、第四步：单次工具调用不足，需要循环

`03` 只能调用一轮。但实际问题常需多步，例如「200 美元和 100 欧元加起来换人民币是多少」，需要调用两次 `convert`，再调用一次 `calculate` 完成加法。

`04_agent_loop.py` 将单次往返封装为循环：

```python
max_steps = 40
for i in range(max_steps):
    resp = client.chat.completions.create(model="deepseek-chat", messages=messages, tools=tools)

    if resp.choices[0].finish_reason != "stop":     # 模型还没说完，它在要工具
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
        break                                        # finish_reason == "stop"，说完了，收工
```

四个设计点：

- `finish_reason` 是循环的刹车信号。等于 `"stop"` 表示模型给出了最终回答，其他值（例如 `"tool_calls"`）表示它仍需调用工具。
- `max_steps` 是死循环保险。模型可能反复调用同一工具而无法停止；步数上限是最后一道闸，同时也是成本闸，每多一步即多一次 API 调用。
- `tools_dict` 是工具注册表，即名字到函数的映射。收到模型报出的工具名后先检查是否在表中，不在则直接报错。看似多余，实际用于防范「模型编造不存在的工具名」。
- 错误也是有效信息。`03` 中工具抛异常时不崩溃，而是把错误信息作为 content 送回。模型看到「不支持的货币对」后，下一轮通常自行调整参数。

至此，一个能自行决定查询次数与方式的 agent 已成型。但工具调用本身不解决幻觉：`convert` 返回的是真实汇率，模型在总结时仍可能编造数字。核心问题在下一步。

## 五、第五步（核心）：把闭卷改为开卷

`05_rag.py` 是整条线的重心。其目标可概括为一句话：不问模型「你记得吗」，而是把原文交给它，模型只负责阅读。

流水线共五层，每层均可单独打印观察：

```
文档 → ①切块 → ②向量化 → ③检索 → ④生成（带引用）→ ⑤校验
```

### ① 切块：为什么不能等长硬切

```python
def chunk_markdown(text, max_chars, overlap):
    sections = re.split(r"\n(?=## )", text)   # 先按 ## 标题切
    ...
```

中文没有空格分词，等长硬切会把一个规格参数从中间劈开，`"供电：DC 12~"` 和 `"36V 宽压"` 成为两块。即使检索命中，也读不出答案。

因此采用三级策略：先按 `##` 标题切分，标题是天然的语义边界；某节过长时，再按空行切段、贪心装箱；开新块时带上上一块的尾部（overlap 字符），防止关键句恰好落在切点上。

另有一个细节：每块都携带其所属的标题（代码中称为 heading propagation）。若不携带，从第二个 chunk 起就丢失了「这是哪一节」的上下文，检索质量会明显下降。

### ② 向量化：查询与文档可以不对称

使用本地句向量模型 `BAAI/bge-small-zh-v1.5`。模型首次使用时需下载，之后在本地编码，不调用 embedding API：

```python
QUERY_PREFIX = "为这个句子生成表示以用于检索相关文章："

def embed(self, texts, is_query=False):
    if is_query:
        texts = [QUERY_PREFIX + t for t in texts]
    return self.model.encode(texts, normalize_embeddings=True)
```

一个容易被忽略的工程细节：bge 官方建议为「查询」添加指令前缀，而「文档」不加。同一模型，查询侧与文档侧的预处理方式可以不对称。

`normalize_embeddings=True` 使向量长度变为 1，余弦相似度退化为点积，减少一次除法。这只是优化，不改变结果。

为便于手写和解释，脚本只保留一个 embedding 后端：`BgeEmbedder`。主流程直接实例化它，对文档块编码一次，再逐个编码查询并计算 top-k。运行前需要安装 `sentence-transformers`，并确保模型已下载。

### ③ 检索：为什么使用余弦而非欧氏距离

```python
def cosine_topk(query_vec, doc_vecs, k):
    sims = doc_vecs @ query_vec       # 归一化后，点积就是余弦相似度
    order = np.argsort(-sims)[:k]     # 从大到小取前 k 个
    return [(int(i), float(sims[i])) for i in order]
```

使用余弦而非欧氏距离，是因为向量长度受文本长度影响。一个长 chunk 与一个短 chunk，即使语义一致，向量模长也不同，欧氏距离会因此失真。余弦只看方向，衡量语义取向，与长度无关。

### ④ 生成：强制标注出处

system prompt 是关键，它将模型的角色从「答题者」限定为「阅读理解者」：

```
你是一个严格的资料问答助手。你只能依据【资料】回答问题。

规则：
1. 只使用【资料】中出现的信息，不得使用你自己的知识补充任何细节。
2. 【资料】不足以回答时，answer 必须写成"资料中没有相关信息"，citations 留空数组。
3. 每个结论都要在 citations 里标出它来自哪几段资料（用方括号里的编号）。
4. 资料里没有提到的数字、型号、参数，绝对不许出现。
5. 只输出 JSON：{"answer": "...", "citations": [1, 2]}
```

再配合 `response_format={"type": "json_object"}`，由 API 保证返回合法 JSON，省去解析失败的兜底代码。

### ⑤ 校验：仅要求模型标注出处并不足够

这一层是整条流水线中最关键的部分，原因在于：

> 即便要求模型标注出处，它同样可能编造出处，引用编号可能凭空生成。

因此必须由程序回查。`verify()` 完成两件事：

```python
label_to_chunk = {label_of(idx): idx for idx, _ in hits}
cited = answer_obj.get("citations") or []

for c in cited:
    if c not in label_to_chunk:
        problems.append(f"引用了不存在的编号 [{c}]")   # a) 防凭空编号

cited_text = "".join(chunks[label_to_chunk[c]] for c in cited if c in label_to_chunk)
# b) 防编造参数：回答里的每个数字，能否在被引用的原文里找到
```

- a) 检查引用编号是否确实在本次检索结果中，防止凭空编号。
- b) 检查回答中的数字能否在被引用的片段中找到，防止编造参数。

此处有一处容易出错的细节：不能拿回答的整段文字去比对原文，必须先抽出两边的「数字 token」，再做集合匹配。

```python
supported = set()
for seg in re.findall(r"\d+(?:\.\d+)*", cited_text):   # 原文里的数字段
    for piece in [seg] + re.split(r"\.", seg):         # "192.168.1.200" 拆成 192/168/1/200
        supported.add(piece)

unsupported = [n for n in re.findall(r"\d+(?:\.\d+)?", answer) if n not in supported]
```

原文中的 `12~36V` 抽出来是 `{"12", "36"}`，回答写 36 即可命中。`192.168.1.200` 这类带点的数字靠 `re.split(r"\.")` 拆开，使回答引用整串或其中一段都算有出处。若不拆 token 而直接查子串，`"36"` 反而会因 `"12~36"` 这一整体对不上而被误报。

### 另一道闸门：证据不足直接拒答

```python
SCORE_FLOOR = 0.45   # 相似度低于这个值就拒答

top_score = hits[0][1] if hits else 0.0
if top_score < SCORE_FLOOR:
    print("证据不足，不调用模型")
    print("回答：资料中没有相关信息。")
    continue
```

最高相似度低于阈值时，完全不调用模型。模型没有机会编造，也就不会编造。这是抑制幻觉最直接有效的手段。

此处另有一处易错点。`label_of(chunk_idx) = chunk_idx + 1` 看似不起眼，但它保证 prompt 中提供给模型的编号与校验时回查所用的编号是同一套。若模型正确引用了 `[2]`，而校验时按「第 2 个检索结果」去查，就会把正确引用判定为编造。这属于自制的假报警，其危害大于不做校验，因为它会导致去修复一个并不存在的问题。

## 六、第六步：补上记忆与「答一半」

`06_memory_research.py` 处理两件事，表面无关，实际都对应同一类幻觉。

文档索引复用 `05` 的切块、向量化和余弦 top-k 函数。`build_index()` 先对整份语料编码一次；迭代检索时只编码当前查询词，不在每一轮重新编码文档。

### A. 记忆：无记忆的多轮对话是幻觉的高发区

短期记忆负责对话历史。没有它，多轮追问会被当作孤立问题——「那它的防护等级呢？」中的「它」指代什么？模型只能猜测，而猜测是幻觉的起点。

短期记忆配有压缩机制：只保留最近 `max_turns` 轮的原文，更早的内容压缩为一段摘要。

```python
def _compress(self):
    if len(self.turns) <= self.max_turns:
        return
    cut = len(self.turns) - self.max_turns
    old, self.turns = self.turns[:cut], self.turns[cut:]
    # 把 old 压成一段摘要，保留"讨论的对象是什么、问过哪些点、结论是什么"
```

不无限保留的原因是：上下文窗口有限，越长越贵，且越长越容易出现「中间遗忘」。摘要有损，但优于丢弃整段历史，这是工程取舍。

长期记忆是跨会话的稳定事实，以 JSON 存储：

```json
{
  "facts": [
    "用户是深圳的系统集成商",
    "用户的客户主要是食品厂",
    "用户计划将设备安装在海边潮湿的车间里"
  ]
}
```

它只记录「稳定」的事实，不记录一次性提问。这一筛选本身即是抑制幻觉的一环：若把用户的随意发言全部记录，记忆库会变为噪音，下次检索到无关「事实」反而污染回答。抽取仍由模型完成，但给出了明确的取舍规则——值得记录的是身份、行业、长期偏好、明确纠正；不值得记录的是一次性提问、寒暄、模型自身知识即可回答的内容。

那些不会被记录的一次性提问，在追问时模型会反问而非猜测。「滤网单独买一个多少钱」这类无答案的问题，也就不会因为「上次似乎聊过设备」而被编出一个价格。

### B. 迭代检索：让模型有机会表达「不够」

单轮 top-k 只能覆盖「答案位于一段话内」的问题。实际问题常有两类：多跳，答案分散在两处，需先查到 A 才能确定该查 B；线索式，先找到线索（「防护等级 IP30」），再顺着线索深入。

「答一半」之所以是幻觉高发区，原因在于：

> 模型不会说「我只查到一半」，它会用查到的那一半补出一个听起来完整的答案。

因此迭代检索的关键不是「多查几次」，而是让模型有机会表达「不够」——把「承认信息不足」变成一个显式的、程序可执行的动作。

循环结构为：查询 → 自评是否充分 → 不充分则换角度改写检索词 → 再查询 → 充分后作答。

```python
verdict = assess(question, collected, chunks, tried)   # 让模型判断"资料够不够"
if verdict.get("irrelevant"):   # 资料里根本没这个主题，别再试了
    break
if verdict.get("sufficient"):   # 够了，收工
    break
nxt = verdict.get("next_query", "").strip()
if not nxt or nxt in tried:     # 改写失败或原地打转，别浪费轮次
    break
query = nxt
```

自评 prompt 中包含一条实用约束：改写检索词时「用资料里出现过的术语，不要用问题里的口语说法」。这实质上是查询侧的同义改写，把用户的口语映射到文档的专业术语。

### 三种信号的优先级判定

`06` 中这一段的顺序若出错会造成误杀：

```python
if irrelevant:
    ...  # 1) 自评说"资料里没这主题"，最可靠，直接拒答
elif not hits or not sufficient and top < rag.SCORE_FLOOR:
    ...  # 3) 自评说不够 + 分数也低，才是真的没检索到
else:
    ...  # 2) 自评说"够了"，就算分数不高也信它
```

三档信号的可靠性不同：

1. 自评 `irrelevant` 最可靠。这是语义判断，能识别「讲的是别的主题」。
2. 自评 `sufficient` 次可靠。模型已经看过资料原文，判定「够了」可以采信。
3. 分数仅作兜底。余弦分只看向量相似程度，无法识别「资料里确实有答案但用词不同」的情况。

第二档的示例如前所述：用户问「海边潮湿影响保修吗」，资料中写的是「进水或受潮不在保修范围」。余弦分不会高（用词完全不同），但答案确实存在。仅依赖分数会将这类问题全部误杀。

反之，过度保守同样是失败。「该答的拒答」与「该拒答的硬答」都是失败。只堵一头（例如把阈值提到 0.9，一律回答不知道）属于针对指标的取巧，不是解决问题。这也是评估必须双向观察的原因。

## 七、第七步：如何证明幻觉确实降低

JD 中的表述是 "greatly reduce"。前六个脚本回答了 how，`07_eval.py` 回答 and how do you prove it。没有这一步，前面的结论都只是主观感受。

核心方法是金标集（golden set）配合可自动判定的指标。金标集是一批 `(问题, 标准答案要点, 正确出处)` 三元组，人工标注。它是一次性投入，之后每次修改代码都能重跑，即「可回归」。

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

关键一点：幻觉率由程序自动判定，不由模型自评。做法是把回答中的所有数字回查到被引原文，与 `05` 的 `verify()` 思路一致，只是扩展为统计。

模型自评不可信：它编造时并不知道自己在编造。

### 最有用的一个开关：`--no-rag`

```bash
python 07_eval.py            # 开卷（RAG）
python 07_eval.py --no-rag   # 对照组：闭卷作答
```

同一批问题，闭卷与开卷构成 A/B 对照。实测结果：

| 指标 | 闭卷（不用检索） | 开卷（RAG） |
| --- | --- | --- |
| 准确率 accuracy | 25.0% (1/4) | 100.0% (4/4) |
| 幻觉率 hallucination | 25.0% (1/4) | 0.0% (0/4) |
| 拒答正确 refusal | 0.0% (0/3) | 100.0% (3/3) |
| 引用正确 citation | 0.0% (0/4) | 100.0% (4/4) |
| └ 无资料却作答 | 100.0% (3/3) | 0.0% (0/3) |

模型为 `deepseek-chat`，语料是一份 LS-200 工业网关产品手册，共 7 道题（4 道应作答 + 3 道应拒答）。

闭卷组的 0/3 最值得注意。那三道「资料里没有」的题，模型全部给出了回答：

- 「滤网单独买一个多少钱？」→ 一本正经解释「价格会因品牌、型号、渠道而异，建议联系客服」。它不知道滤网，但知道报价这件事通常怎么答。
- 「LS-200 支持 4G 联网吗？」→ 直接回答「不支持 4G 联网」。该答案看起来甚至是对的，但它是「编得像真的」，不是「查到的」。

这属于最危险的一类幻觉：不是胡言乱语，而是格式工整、措辞专业、错误难以察觉。在垂直领域，这类答案一旦采用即构成事故。

开卷组将这 0/3 变为 3/3。机制在于：资料中没有该主题，模型的注意力找不到落点，只能回答不知道。

### 评测集本身的缺陷

`must_not` 用于防止「说了不该说的事」，但存在一处易错点：

```python
# 资料写「不支持 5GHz」，回答也写「不支持 5GHz」
# 用子串匹配，会被判成"说了支持 5GHz"，假幻觉
NEGATIONS = ["不", "无", "未", "非", "没", "否"]

def contains_positive(text, phrase):
    """phrase 出现且前面没有否定词，才算真的说了 phrase。"""
```

用于判定幻觉的代码本身也会产生幻觉，这是该环节最值得警惕之处。评测集误判会直接欺骗自身——表面上指标在报警，实际是度量工具出错。

## 八、七个脚本的整体结构

整条线上有六个抓手，每一个对应一种具体的幻觉成因：

| 抓手 | 靠哪个脚本 | 打的是什么幻觉 |
| --- | --- | --- |
| 证据进上下文 | `05` | 不问"你记得吗"，只让它读原文 |
| 结构化出处 | `03` `05` | 强制 citations，结论要能指回片段 |
| 程序回查引用 | `05` `07` | 模型会编出处，必须用程序验 |
| 允许说不知道 | `05` `06` | 证据不足直接拒答，压根不调模型 |
| 记忆补全指代 | `06` | 别让模型猜"它"是谁 |
| 迭代检索 | `06` | 别让模型用查到的一半补出完整答案 |

而这六个抓手能否成立，取决于 `07` 的四个数字。

面试或笔试中实际会涉及的提问大致如下：

- 「你的方案怎么降幻觉？」——列出六个抓手。
- 「怎么证明降了？」——报 A/B 对照的数字：同一批题，闭卷 1/4、开卷 4/4，无资料编造率由 100% 降至 0%。
- 「你这个评估本身可信吗？」——这一问题最能体现水平。回答要点：幻觉率由程序按数字回查明文原文判定，不用模型自评；评测集的否定词处理也有专门规避。能指出自身指标的边界，比报出一个漂亮数字更有说服力。

## 九、几处刻意的取舍

以下几处是刻意的设计选择，而非顺手写成：

- 不使用框架。LangChain 能把 RAG 压到十行，但被追问「切块为什么这么切」「余弦为什么不用欧氏距离」时无法回答。手写一遍，每个可调参数的位置与影响都掌握在手中。
- embedding 后端保持单一。`BgeEmbedder` 是运行前需要准备的依赖；索引一次建立后，迭代检索只需重复编码查询词，流程更容易手写和说明。
- 阈值是调出来的，不是设定的。`SCORE_FLOOR` 与 `MAX_CHARS` 均可通过 `--floor` / `--max-chars` 覆盖，专门用于消融实验。取值优劣由指标决定。
- 拒答与作答都需量化。只优化幻觉率会走向「一律说不知道」，只优化准确率会走向「什么都敢编」。四个指标需同时观察，才能堵住两端。

## 十、结语

若只取一句话，是这句：

> 幻觉的本质不是模型有意欺骗，而是它被问到了自己不知道的事，又不倾向于承认不知道。

因此这七个脚本完成的工作可归结为两条：要么把答案递到模型面前（RAG、工具、记忆），要么给它一条体面地说「不知道」的路径（阈值闸门、自评、结构化拒答）。还有第三条，也是最容易被跳过的——用一组可复现的数字，证明前两条确实生效。

脚本不依赖 LangChain 等 Agent 框架，语料是一份自造的工业网关手册。`05` 与 `06` 运行前需安装 `sentence-transformers`，首次使用会下载 BGE 模型。复现时按脚本顺序从 `01` 到 `07` 执行，每一步均可单独打印中间结果。
