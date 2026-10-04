# 血肉苦弱，智械飞升（一）：用中转站配置 Claude Code + DeepSeek

> [!NOTE] 这个系列
> 「血肉苦弱，智械飞升」第一篇，讲怎么把 coding agent 跑起来：用 API 的方式配置，以 Claude Code + DeepSeek 为例。
>
> 第二篇会写怎么用 **Claude Pro / GPT Plus 官方订阅账号**直接登录。那部分还在施工，先占个位。

## 一、先弄明白三样东西

### API

平时用 ChatGPT、Claude，是打开网页跟它聊。API 就是把同一条通道开给你自己的程序：不用网页，代码直接把问题发过去、把回答收回来。网页版是堂食，API 是外卖——同一个厨房，换了个取餐方式。

你在终端里敲 `claude`，它不会偷偷打开浏览器替你点按钮。它就是拿着你的 API Key，一次一次地调 API。

### API Key

你的身份凭据，长这样：`sk-xxxxxxxx`。它同时也是**钱包**——拿到它的人能直接花你的额度，账单记在你头上。所以：

- 不要贴进截图、GitHub、聊天记录；
- 不要写进会提交到 git 的配置文件；
- 泄露了立刻去后台吊销，重新发一个。

### Base URL

**这是整篇文章的关键。** 一个 API 请求大致长这样：

```
POST {Base URL}/v1/messages
Authorization: Bearer {API Key}

{ "model": "...", "messages": [...] }
```

Base URL 就是"这个请求发给哪台服务器"。官方 Claude 的 Base URL 是 `https://api.anthropic.com`，但**协议不变，换个域名就是换了一家服务**。DeepSeek 也提供 Anthropic 兼容端点，把 Base URL 改成 `https://api.deepseek.com/anthropic`，同一个 Claude Code 就在跟 DeepSeek 说话了。

所有"中转站"的魔法，本质就是这个：给你一个域名和一个 Key，让你拿官方客户端去连它。

## 二、中转站是什么，以及它的代价

国内直连官方 API 有几道坎：网络不通、要外币信用卡、风控封号。于是有人把额度包一层，对外给出统一的 Base URL + API Key，你填进客户端就能用。

> [!NOTE] 用之前先知道这几件事
> 下面几条不是废话，是真会踩的坑：
>
> - **你的 prompt 和代码会全部经过对方的服务器。** 链路上的人理论上能看、能存、能记日志。别拿它跑公司代码、密钥、隐私数据。
> - **中转站基本都不符合 Anthropic / OpenAI 的服务条款**（官方不允许转售额度）。账号被封、额度清零、Key 失效都可能发生，而且没有申诉的地方。
> - **小站跑路是常态。** 用多少充多少，别一次充一年的量。
> - 别碰"共享账号""拼车名额"这类东西，把主账号密码交出去，风险和收益完全不成比例。
> - 下文出现的具体站点是**我在用的**，不是推荐，我也没法替它们担保。

## 三、要装什么

| 工具 | 干什么用的 | 从哪来 |
| --- | --- | --- |
| Node.js（含 npm） | 后面几个 CLI 都靠 npm 安装，先装它 | https://nodejs.org |
| CC Switch | 图形化配置切换器，负责把 Base URL 和 Key 写进各个 agent 的配置文件 | https://ccswitch.io/zh/ |
| Claude Code | Anthropic 的 coding agent | `npm i -g @anthropic-ai/claude-code` |
| GPT Codex | OpenAI 的 coding agent | `npm i -g @openai/codex` |
| Claude Desktop | Anthropic 的桌面客户端 | https://claude.ai/download |
| ChatGPT Desktop | OpenAI 的桌面客户端 | <https://developer.aliyun.com/article/1754654> |

ChatGPT Desktop 这一栏要单独说一句：**官方只走微软商城，国内打不开**，所以上面给的是第三方转载的安装包。从非官方渠道下安装包，装之前自己核对一下来源，别随手双击。

CC Switch 是这个流程的枢纽。Claude Code、Codex 这些 CLI 的配置散落在各自的文件里（`~/.claude/settings.json`、`~/.codex/config.toml`），手改容易写错，换供应商时还要改好几处。CC Switch 把它们收进一个界面：配一次，一键切。

## 四、装 Node.js

官网下 LTS 版，一路下一步。装完在终端验证：

```bash
node -v
npm -v
```

两个都能打印版本号就行。npm 是随 Node 一起装上的包管理器，不用单独装。

## 五、装 CC Switch

去 https://ccswitch.io/zh/ 下对应系统的安装包，装好打开。它是个本地配置管理工具，不需要注册什么账号。

## 六、拿一个 API Key

以 DeepSeek 为例：

1. 打开 https://platform.deepseek.com
2. 注册登录（这是官方平台，走的是正经渠道，不是中转站）
3. 进「API Keys」，新建一个，复制出来

**这个 Key 只显示一次**，关掉页面就再也看不到了，先粘到安全的地方。

## 七、在 CC Switch 里填供应商

在 CC Switch 里新增一个供应商。**新增的时候要选一个归属**：这篇配的是 Claude Code，就填到 **Claude Code** 那一栏；如果是给 Codex 用，就填到 **GPT** 那边。两份配置各自独立，互不影响。

几个字段这么填：

![CC Switch 的新增供应商表单，依次是供应商名称、备注、官网链接、API Key、请求地址](/images/blog/ai-master/01-provider.png)

- **供应商名称**：随便写，自己认得出就行，比如 `DeepSeek`
- **备注**：随手记一句，以后切供应商的时候不至于搞混
- **官网链接**：`https://platform.deepseek.com`
- **API Key**：上一步复制的那个
- **请求地址**：`https://api.deepseek.com/anthropic`

最后一行就是前面说的 Base URL。注意末尾**没有** `/v1`，客户端会自己补上路径。

## 八、配模型映射

Claude Code 内部是按档位请求模型的：日常干活走 Sonnet 档，轻活（比如子 agent）走 Haiku 档，重活切 Opus。DeepSeek 没有这些名字，所以要在 CC Switch 里做一层**映射**，把 Claude 的档位翻译成 DeepSeek 实际的模型名。

![CC Switch 的模型映射面板，按 Sonnet / Opus / Fable / Haiku 四档分别填实际请求模型](/images/blog/ai-master/02-model-mapping.png)

- **上游格式**：选「Anthropic Messages（原生）」，意思是这个供应商说的是 Anthropic 的原生协议
- **模型角色 / 菜单显示名 / 实际请求模型**：左边是 Claude Code 要用的档位，右边填 DeepSeek 这边对应的模型名；菜单显示名可以写成 `DeepSeek` 这类品牌名，方便自己认
- **声明支持 1M**：这个模型支持 100 万 token 上下文的话就勾上，客户端才会放开限制

留空的档位会自动沿用 Sonnet 档（或第一个填了的档），这样至少保证 Haiku 档不会因为没配而挂掉——Claude Code 的子 agent 是走 Haiku 的。

### Codex 也一样

上面这套流程对 GPT Codex 完全适用，操作和配 Claude Code 基本一致，**同样都能在 CC Switch 里完成**：新增一个供应商（这次填到 **GPT** 那边）、填请求地址和 Key、再做一次模型映射。差别只在档位名字——Codex 用的是它自己那套模型档位，按同样的思路填上 DeepSeek 对应的模型就行。

两份配置在 CC Switch 里各存一份，互不影响，随时切。

## 九、启动

配好之后回终端，直接用 bash 启动：

```bash
claude
```

就这一条命令，没有别的步骤。第一次启动它会问你工作目录和权限档位，先把权限收着点，确认它没在乱改文件，再放开。

给 Codex 配的话同理，命令换成 `codex`。

## 十、如果要走中转站

上面走的是 DeepSeek 官方平台。如果想用 Claude / GPT 本身、又不想开官方订阅，可以走中转站。**填的位置完全一样**——还是 CC Switch 里那个「请求地址」，换成中转站给的 Base URL 和 Key 就行。模型映射那步可以删掉，本来就是 Anthropic 的模型，不用翻译。

| 中转站 | 说明 |
| --- | --- |
| <https://ne.aineapi.com> | Claude 中转，**需要科学上网**才能打开 |
| <https://crs.ruinique.com> | ChatGPT 中转 |

充值是去 <https://catfk.com/shop/BAGD1TL7>。

**再说一遍**：这几个地址是我自己在用，不是推荐。第二节讲的稳定性、跑路、数据经手风险，在这里同样适用，建议小额试水。

## 十一、下一篇：用订阅账号登录（施工中）

这一篇讲的是"用 API 跑起来"。如果你手上已经有 **Claude Pro** 或 **ChatGPT Plus** 订阅，其实不需要 API，也不需要中转站——直接用订阅账号登录官方客户端就行，额度算在订阅里，不用另外按量计费。

「血肉苦弱，智械飞升（二）」就写这个，还没写完。买 GPT Plus 的话，我目前知道的是 <https://www.aivora.cn>，我自己没在那儿买过，不做担保。等我真的走通一遍再补上来。
