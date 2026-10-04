# 血肉苦弱，智械飞升（二）：用 Command-Code-GO 白嫖 deepseek-flash

> [!NOTE] 这个系列
> 第二篇。第一篇讲的是「用 API 把 coding agent 跑起来」——API / API Key / Base URL 是什么，怎么用 CC Switch 把 DeepSeek 接进 Claude Code。
>
> 这一篇换个供应商：Command-Code-GO。它便宜到不像话，但它**只给 OpenAI 协议**，所以得让 CC Switch 做一层路由转换。

## 一、先说为什么便宜

Command Code 是个专门做「开源模型 coding agent」的服务。它的定价你可以自己去 https://commandcode.ai/pricing 核，这几个数字是我 2026-10-04 从官方页面抓的：

| 套餐 | 月付 | 拿到多少额度 | 倍数 |
| --- | --- | --- | --- |
| Go | \$1 | \$10 | 10× |
| GOAT | \$10 | \$70 | 7× |
| Pro | \$20 | \$80 | 4× |

\$1 换 \$10 额度，这已经不是优惠券级别的了。而且它还有针对单个模型的加成活动，官方页面上挂着：

> deepseek-v4.1-flash boosted usage: \$10 Go, \$60 GOAT, \$70 Pro

翻一下：如果你在 Go 套餐（\$1/月）上整月只跑 `deepseek-v4.1-flash`，这 \$10 的池子能当 **\$10 的 flash 用量**花；GOAT 是 \$60，Pro 是 \$70。也就是说：**\$1 一个月，专门刷 flash，能刷出十美元级的量。**

这就是标题里「大量 token」的来源——不是漏洞，是它自己在做促销。

**价格随时会变。** 上面这些是我写这篇文章当天的截图数据，你下单前一定自己再核一遍，别拿我这篇当合同。

## 二、为什么不能直接把地址填进 Claude Code

第一篇讲的思路是「改 Base URL 就换了一家服务」。这一篇没这么简单，卡点在这儿。

Claude Code 说的是 **Anthropic Messages 协议**。它只认一个路径 `{Base URL}/v1/messages`，请求体长这样：

```json
{
  "model": "...",
  "system": "...",
  "messages": [{ "role": "user", "content": "..." }],
  "max_tokens": 4096,
  "tools": [ ... ]
}
```

而 Command Code 这个网关，是把三种协议分开放的：

| 端点 | 说的是哪种话 |
| --- | --- |
| `https://api.commandcode.ai/provider/v1/chat/completions` | OpenAI Chat Completions |
| `https://api.commandcode.ai/provider/v1/responses` | OpenAI Responses |
| `https://api.commandcode.ai/provider/v1/messages` | Anthropic Messages |

看第三行——**它确实有原生的 Anthropic 端点。** 所以问题不在端点，在**模型**。

我把它的模型列表拉下来看了一眼（`GET https://api.commandcode.ai/provider/v1/models`，这个接口不用鉴权），每个模型都挂着一个 `supported_endpoints` 字段，写着它认哪些端：

```
claude-sonnet-5-5               supported_endpoints=['/messages']
claude-opus-5-5                 supported_endpoints=['/messages']
gpt-6-astra                     supported_endpoints=['/chat/completions', '/responses']
deepseek/deepseek-v4.1-flash    supported_endpoints=['/chat/completions', '/responses']
deepseek/deepseek-v4-pro        supported_endpoints=['/chat/completions', '/responses']
deepseek/deepseek-v4-flash-fast supported_endpoints=['/chat/completions']
moonshotai/Kimi-K3              supported_endpoints=['/chat/completions', '/responses']
```

规律很清楚：

- **`claude-*` 只认 `/messages`**（Anthropic 那一套）
- **`deepseek/*`、`gpt-*`、`moonshotai/*`、`z-ai/*` 只认 `/chat/completions` 和 `/responses`**（OpenAI 那一套）
- 两边**没有交集**

所以你要是直接把 Base URL 填成 `https://api.commandcode.ai/provider/v1`、模型填 `deepseek/deepseek-v4.1-flash`，Claude Code 会往 `/provider/v1/messages` 发一个 Anthropic 格式的请求，网关直接给你退回来：

```
Model "deepseek/deepseek-v4.1-flash" is not supported on this endpoint.
Use /provider/v1/chat/completions for OpenAI and OSS models.
```

这段报错不是我编的。我配这篇教程的时候，我这个会话自己就撞了一次——当时我想压缩一下对话上下文，用的正是 `deepseek/deepseek-v4.1-flash`，结果 `/compact` 直接 400 挂掉，就是上面这句。

**便宜的是 deepseek，而 deepseek 不认 Claude Code 的原生协议。** 这就是必须要路由的原因。

## 三、路由在中间干了什么

CC Switch 会在本机起一个代理。Claude Code 以为自己在跟 Anthropic 说话，其实是在跟 CC Switch 说话，由 CC Switch 负责翻译：

```
Claude Code
    │  发出 Anthropic 格式的请求
    ▼
CC Switch（本地代理）
    │  翻译成 OpenAI 格式
    ▼
https://api.commandcode.ai/provider/v1/chat/completions
```

这就是配置里「**上游格式**」那一栏的用途。你在截图里看到的选项叫：

> **OpenAI Responses API（需开启路由）**

括号里那五个字是重点——**它自己就写明了这个格式必须配合路由才生效。** 光把上游格式选成 OpenAI，但路由没开，CC Switch 会原样透传，Claude Code 的 Anthropic 请求照样打到一个只认 OpenAI 的端点上，还是 400。

顺序是：**先开路由，再设上游格式。**

## 四、填供应商

![CC Switch 新增供应商表单：供应商名称 Command-Code-GO，官网链接 https://api.commandcode.ai，API Key 已填，请求地址 https://api.commandcode.ai/provider/v1](/images/blog/command-code/01-provider.png)

先到 Command Code 官网注册、订阅、然后在 Studio 里生成一个 API Key。然后回 CC Switch 新增一个供应商，归属还是选 **Claude Code**（跟第一篇一样）：

| 字段 | 填什么 |
| --- | --- |
| 供应商名称 | 随便，认得出就行，比如 `Command-Code-GO` |
| 官网链接 | `https://api.commandcode.ai` |
| API Key | Studio 里生成的那个 |
| 请求地址 | `https://api.commandcode.ai/provider/v1` |

**请求地址填到 `/provider/v1` 为止**，别画蛇添足加上 `/responses` 或 `/chat/completions`，也**不要留尾斜杠**（截图里那行黄色提示就是在说这个）。CC Switch 会按上游格式自己把后面的路径补上。

对照一下第一篇：DeepSeek 官方的 `https://api.deepseek.com/anthropic` 是**原生 Anthropic** 端点，CC Switch 直接透传就行，压根不需要路由。这一篇的供应商不是，所以多了一步。

## 五、配模型映射

![CC Switch 模型映射面板：上游格式选了 OpenAI Responses API（需开启路由），Sonnet/Opus/Fable/Haiku 四档分别填了显示名和实际请求模型](/images/blog/command-code/02-model-mapping.png)

这张图信息量比第一篇那张大，因为有路由了。逐列拆开看：

**上游格式**：选 `OpenAI Responses API（需开启路由）`。

**模型角色 → 菜单显示名 → 实际请求模型**，这三列是这张表的核心，也是最容易看错的地方：

| 模型角色 | 菜单显示名 | 实际请求模型 |
| --- | --- | --- |
| Sonnet | `deepseek/deepseek-v4.1-flash` | `deepseek/deepseek-v4.1-flash` |
| Opus | `deepseek/deepseek-v4-pro` | `gpt-6-sol` |
| Fable | `gpt-6-astra` | `gpt-6-astra` |
| Haiku | `deepseek/deepseek-v4.1-flash` | `deepseek/deepseek-v4.1-flash` |

**左边那个「菜单显示名」只是给你自己看的**，就是 Claude Code 里 `/model` 菜单上显示的那行字；**右边「实际请求模型」才是真正发出去的字符串。**

所以你看 Opus 那一行：菜单上它显示成 `deepseek/deepseek-v4-pro`，但实际请求的是 `gpt-6-sol`。这是个刻意的「挡位伪装」——你可以在菜单上把它标成任何顺眼的名字，真实调用的是另一个模型。想改成什么样都行，两列本来就是解耦的。

**留空的档位**会自动沿用 Sonnet 档（或第一个填了的档）。这一点很重要：Claude Code 吃完饭后要让子 agent 去干活，子 agent 走的是 Haiku 档。要是 Haiku 档空着又没兜底，子 agent 一调就挂。图上把 Haiku 也显式填了，等于双保险。

**「声明支持 1M」**：模型支持 100 万 token 上下文就勾上。`deepseek/deepseek-v4.1-flash` 的 `context_length` 确实是 `1000000`，但图上四档**都没勾**——不勾只是客户端会按更保守的上下文窗口来管，不影响能不能跑通。

## 六、启动

跟第一篇一模一样，不分供应商：

```bash
claude
```

起来之后随便问一句，能正常回话就说明路由通了。如果还是 400，大概率是这两种情况之一：上游格式选了 OpenAI 但**路由没开**；或者请求地址多写了 `/responses` 之类的尾巴。

## 七、这套玩法的边界

**一个供应商配不了两套协议。** 这是最需要注意的。上面这四条映射全都在走「OpenAI 格式 → 路由翻译」这条路。如果你想用这个网关里的 `claude-sonnet-5-5`（它只认 `/messages`），就不能走路由——得直接透传。CC Switch 里一个供应商条目对应一套上游格式，所以想同时用 Claude 系和 deepseek 系，**开两个供应商条目**，按需切换。

**路由多一层，就多一层可能出问题的地方。** 协议转换是照着一个映射表硬翻的，边缘情况上可能会丢东西——比如某些形态的工具调用、思考块、图片输入。遇到某个功能莫名不生效，先怀疑路由，把上游格式切回原生试一次对比。

**便宜有便宜的原因。** 这类聚合网关的额度、模型可用性、促销活动都是它单方面说了算，随时能改。别一次充很多，用多少充多少。第一篇第二节讲的那些风险——prompt 会经过对方服务器、不符合上游厂家的服务条款、小站跑路——在这里**同样适用**。

## 八、下面几篇

- **（三）用订阅账号登录**：如果你手上已经有 Claude Pro 或 ChatGPT Plus，其实不用 API 也不用中转站，直接登录官方客户端就行，额度算在订阅里。这篇还没写。
- 也许还会写写同一个网关里怎么用 Kimi、GLM 这些，思路跟这篇完全一样，换模型名就行。

---

**最后再说一遍**：文里的价格、套餐、模型名、加成活动，都是 2026-10-04 从 https://commandcode.ai 抓的，会变。真要花钱之前，自己去官网核对一遍。
