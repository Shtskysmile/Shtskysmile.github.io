# LLM Post-Training 岗位知识图谱：训练方法、工程闭环与大厂岗位要求

LLM post-training（后训练）岗位的目标，是把预训练模型调整为能稳定完成具体任务的模型。相关知识应沿着完整链路组织：问题定义 → 数据与监督信号 → 训练目标 → 训练系统 → 离线评测 → 线上反馈。SFT、PPO、DPO、GRPO 是这条链路中的算法组件，不能脱离任务与数据单独理解。

本文面向大模型后训练算法、研究工程和训练工程岗位，整理核心知识，并对照截至 2026 年 10 月可查到的 OpenAI、Anthropic、ByteDance Seed、阿里、腾讯、百度等公开岗位信息归纳能力侧重。招聘页面会更新，岗位样本用于说明职责差异，不代表公司内部面试题库。

现有[大语言模型面试复习资料](/blogs/llm-interview-review)已经系统推导 RLHF、PPO、DPO、GRPO/RLVR 和工具调用训练。本文聚焦岗位侧专项：数据和奖励如何进入训练，推理 RL 算法如何演进，异步训练系统如何排错，以及不同岗位对这些环节的要求。

## 一、先区分岗位：后训练不是单一工作

同一个“LLM post-training”标题，可能对应三类职责。

| 岗位侧重 | 主要问题 | 常见交付物 | 知识重点 |
| --- | --- | --- | --- |
| 后训练算法 / 效果 | 模型怎样更有用、可靠或擅长推理 | 数据配方、训练实验、能力与安全评测 | SFT、偏好学习、RL、奖励设计、实验分析 |
| 训练系统 / RL Infra | 如何稳定、高效地产生 rollout 并完成更新 | 分布式训练与推理链路、吞吐与稳定性改进 | GPU 显存、并行策略、异步架构、性能诊断 |
| 应用 / 垂域后训练 | 如何提升特定产品任务的成功率 | 领域数据、评测集、模型版本与线上指标 | 数据质量、业务定义、错误分析、部署成本 |

投递前应从岗位描述中标记动词：如果强调“研究、奖励建模、推理能力”，重点准备方法和实验；如果强调“训练框架、吞吐、并行”，重点准备系统；如果强调“业务场景、数据闭环”，重点准备任务定义和线上评估。知识准备应与职责对应，后训练也不能被简化为单一的 RL 算法。

## 二、后训练全链路

预训练通常优化下一个 token 的似然，模型因此获得语言和知识能力，但不会自动遵守产品的指令格式、安全策略或偏好。后训练利用示范、偏好、可验证结果或环境反馈来调整行为。InstructGPT 的经典配方是先用示范做监督微调，再训练偏好奖励模型，最后用 PPO 优化策略；它也展示了参数更小的指令模型在人工偏好评估中可以胜过更大的基础模型。[InstructGPT 论文](https://arxiv.org/abs/2203.02155)

常见流程可以表示为：

```text
定义目标与约束
    ↓
构造数据 / 标注偏好 / 实现 verifier 或 grader
    ↓
SFT 建立行为基线
    ↓
偏好优化或在线 RL（按监督信号选择）
    ↓
离线评测、人工审查、对抗测试
    ↓
发布候选模型并观察线上指标
    └──────────────→ 失败样本进入下一轮数据与目标设计
```

这不是必须逐级经过的固定配方。任务已有高质量答案示范时，SFT 可能已足够；有稳定的 chosen/rejected 偏好对时可试 DPO；模型需要探索新答案，且输出有可靠奖励判定时，在线 RL 才更有价值。训练方法不能补救一个定义含糊、评测不可信的任务。

## 三、监督微调：数据与 token mask 决定基线

### 3.1 目标函数与损失掩码

SFT 通常对目标回答 token 计算自回归交叉熵：

$$
\mathcal{L}_{\mathrm{SFT}}(\theta) = -\sum_{t \in \mathcal{T}_{\mathrm{target}}} \log \pi_{\theta}(y_t \mid x, y_{<t})
$$

关键实现是确定集合 \(\mathcal{T}_{\mathrm{target}}\)：很多对话训练只对 assistant 的回答部分计算 loss，user、system、padding 等 token 需要正确 mask。模板边界或 mask 错误会让模型学习复述用户消息、输出错误角色标记，或把填充 token 当成目标。多轮对话还要确认是否仅训练 assistant turn、工具调用结构是否进入目标，以及截断发生时是否破坏完整轮次。

### 3.2 数据质量检查

数据量并不等于有效监督量。训练前至少检查：重复与近重复、答案正确性、格式一致性、隐私与许可、长度分布、语言和任务比例、训练验证污染，以及不同来源间的质量差异。拒答、安全、工具调用、多轮上下文等行为应有明确的数据定义；如果同一类输入在不同样本里对应互相冲突的目标，模型收到的梯度也会冲突。

面试回答“数据越多越好吗”时，应先说数据必须与目标相关且质量可控，再说明扩大规模能否继续改善需要通过数据消融或 scaling 实验验证。可比较随机抽样、去重、难例采样、合成数据比例与不同任务配比，并报告每种变更对目标指标和回归指标的影响。

### 3.3 训练后要看什么

除训练 loss 外，应观察验证集 loss、目标任务成功率、格式遵循率、拒答与误拒率、长度变化、重复率、旧能力回归，以及不同子群体/任务切片上的误差。训练 loss 下降只说明目标 token 更可预测，不能单独证明模型更符合用户意图。

## 四、偏好优化：RM、PPO、DPO 与 GRPO

### 4.1 Reward Model 与 RLHF

偏好数据通常为同一 prompt 下的一对答案 \((y^+, y^-)\)，标注其中更好的答案。Bradley–Terry 偏好模型常写为：

$$
P(y^+ \succ y^- \mid x) = \sigma\big(r_{\phi}(x,y^+) - r_{\phi}(x,y^-)\big)
$$

奖励模型学习“哪个更好”，并不天然学到绝对质量。标注规范不一致、偏好对过于简单、位置偏差、长度偏好或领域覆盖不足都会影响模型。RM 还可能把容易识别的表面特征当捷径，例如更长、更有礼貌或格式更完整，却未必事实更准确。

经典 PPO-RLHF 用奖励模型给采样回答打分，策略梯度更新语言模型，并用 reference policy 的 KL 惩罚限制策略漂移。常见实现还训练 critic 估计价值并辅助计算 advantage。面试应能讲清 policy、reference、reward model、critic 分别提供什么信号，KL 系数如何影响“提高奖励”和“保留原有分布”的权衡。

PPO 的主要风险包括奖励过优化、策略更新过大、价值估计偏差、生成采样与训练策略不一致、长序列 token 级 credit assignment 噪声，以及 KL 过大或过小。排查不能只看 reward 曲线：还要看 KL、熵、长度、clip fraction、value loss、reward 分布和人工盲评，并检查高奖励样本是否真的更好。

### 4.2 DPO：用偏好对直接更新策略

DPO 将 KL 约束下的最优策略关系代入偏好目标，把显式的“先训练 RM，再做 PPO”改写为 chosen/rejected 对上的分类式损失。其一个常见写法是：

$$
\mathcal{L}_{\mathrm{DPO}} = -\mathbb{E}_{(x,y^+,y^-)}\left[\log \sigma\left(\beta \left[\log\frac{\pi_\theta(y^+|x)}{\pi_{\mathrm{ref}}(y^+|x)} - \log\frac{\pi_\theta(y^-|x)}{\pi_{\mathrm{ref}}(y^-|x)}\right]\right)\right]
$$

\(\beta\) 控制策略相对 reference 的偏离惩罚强度，具体效果也受数据、实现和训练超参数影响。DPO 不需要独立 reward model，也不需要在线 rollout，训练流程较简洁；代价是优化受离线偏好数据的覆盖与质量限制，模型不会通过当前策略的新采样主动探索未覆盖的回答区域。[DPO 论文](https://arxiv.org/abs/2305.18290)

“DPO 不需要奖励模型”应理解为训练目标不需要单独训练并调用一个 reward model 来提供更新信号，不是说偏好信息或隐含奖励概念消失了。DPO 仍依赖 reference policy 和偏好对。

### 4.3 GRPO 与可验证奖励

GRPO 对同一个 prompt 采样一组回答，按组内奖励相对表现构造 advantage，从而不使用 PPO 中独立的 critic。它由 DeepSeekMath 提出，论文将其描述为 PPO 的变体，并报告了更节省 value model 显存的训练方式。[DeepSeekMath 论文](https://arxiv.org/abs/2402.03300)

若同一组奖励都相同，组内比较就缺少区分信号；若 verifier 有漏洞，模型可能优化判分规则而不是任务本身。生成多个候选也会增加 rollout、奖励计算和长序列训练成本，因此“去掉 critic”不意味着 GRPO 总成本必然低于 PPO。任务是否有可靠可验证奖励，是选择 GRPO/RLVR 的关键前提。

DeepSeek-R1-Zero 展示了不先做 SFT、直接通过大规模 RL 激发推理行为的实验路径；DeepSeek-R1 则加入冷启动数据与多阶段训练，以改善可读性和语言混杂等问题。两者说明训练配方取决于目标，不应总结成“纯 RL 一定优于 SFT”。[DeepSeek-R1 论文](https://arxiv.org/abs/2501.12948)

| 方法 | 主要监督信号 | 需要新 rollout | 独立 RM / critic | 常见适用条件 | 主要风险 |
| --- | --- | --- | --- | --- | --- |
| SFT | 示范答案 | 否 | 否 | 有可靠目标回答，先建立行为基线 | 模仿偏差、数据冲突、能力遗忘 |
| RM + PPO | 偏好训练 RM，再为策略采样打分 | 是 | 通常有 RM 与 critic | 需要策略探索，奖励可覆盖目标质量 | 奖励投机、训练不稳、系统成本高 |
| DPO | chosen / rejected 偏好对 | 否 | 不需要独立 RM | 偏好对覆盖充分，优先简单稳定迭代 | 离线分布限制、偏好噪声 |
| GRPO / RLVR | rollout 结果的 verifier / grader 奖励 | 是，多条候选常按组采样 | 不需要 PPO 式 critic | 数学、代码等结果可判定任务 | 组内奖励无差异、verifier 被利用、采样成本 |

方法选型的完整答法是：先说明能力缺口，再说明可获得的监督信号，接着说明计算预算与失败风险，最后提出对照实验。不要把某种算法讲成普遍最优。

## 五、评测与奖励：闭环中最容易被忽略的部分

### 5.1 评测集必须回答具体决策

一个可用的评测体系通常包括训练集、开发集、冻结测试集和上线观察指标。切分应避免同源题目或模板泄漏。指标要覆盖目标能力与潜在退化，例如准确率、任务完成率、拒答准确性、引用正确性、格式解析成功率、推理成本和延迟。整体均值可能掩盖少数关键场景退化，因此需同时看任务切片、难度切片和错误类型。

自动评测适用于有明确答案或可执行检查的任务；LLM judge 能处理开放式质量比较，但需检查评审模型的偏差、提示敏感性和与人工一致性。人工评测要使用盲评、清晰 rubric 和重复标注来估计一致性。只有当专家在给定上下文下能稳定判断答案优劣，偏好优化的监督目标才清晰。OpenAI 的 RFT 指南也建议先建立 eval，并强调任务需有可判分信号、模型已有一定成功率，且 grader 应防止猜测和 reward hacking。[RFT 指南](https://developers.openai.com/api/docs/guides/reinforcement-fine-tuning) [grader 设计指南](https://developers.openai.com/api/docs/guides/rft-use-cases)

### 5.2 奖励分解与 Goodhart 风险

复合 reward 可以由正确性、安全性、格式、成本等子项组成，但每个权重都编码取舍。若长度惩罚过强，模型可能变得过度简短；若拒答奖励设计不当，模型可能过度拒绝；若格式奖励压过内容正确性，输出可能只学会满足 parser。应记录每个子项分数，并抽查高分与低分样本，测试 reward 与独立人工质量指标是否一致。

诊断 reward hacking 的常见办法包括：构造对抗样本、对 verifier 做变形测试、使用未公开测试集、比较多个独立 grader、定期人工审查高奖励样本，以及做 reward 组件消融。防范重点是让训练奖励、验证指标和实际产品目标尽量一致，同时保留模型行为的独立评估。

### 5.3 实验报告的最低要求

一个可信的改进结论需要给出：基线与候选模型、训练数据版本、方法和关键超参数、评测集与指标定义、重复实验或置信区间、分桶结果、回归结果、样例审查、推理成本，以及适用边界。若只报告一个 benchmark 的单次提升，就无法排除采样方差、数据泄漏或过拟合。

## 六、训练工程与系统设计

系统与算法岗位都需要按层拆解训练资源：模型参数、梯度、优化器状态、激活值、KV cache / rollout 缓存、通信缓冲区，以及数据与 checkpoint 的 I/O。混合精度、梯度累积、梯度检查点、张量/流水线/数据并行、ZeRO/FSDP、序列并行和高效 attention 各自解决不同瓶颈；方法选择应与测得的瓶颈对应。

在线 RL 的系统可抽象为 rollout workers、reward/verifier workers、trainer、队列与编排器。主要问题包括生成与训练速度不匹配、队列积压、策略版本过期、采样分布漂移、长尾序列拖慢 batch、奖励服务成为瓶颈，以及训练失败后的状态恢复。异步系统还要明确 rollout 使用的 policy version、最大滞后、样本去重与过期策略，必要时考虑 off-policy correction。一个系统设计回答应覆盖数据流、背压、故障恢复、可观测指标和安全发布。

建议熟悉一个可运行的开源后训练栈，例如 Hugging Face TRL 的 SFT、DPO、PPO、GRPO 与 RewardTrainer 接口；但需区分论文定义、框架当前实现和具体配置默认值。开源 trainer 文档可用于核对接口与实现行为，不能替代对算法目标的理解。[TRL 文档](https://huggingface.co/docs/trl/main/quickstart) [PPO Trainer](https://huggingface.co/docs/trl/main/ppo_trainer) [GRPO Trainer](https://huggingface.co/docs/trl/main/grpo_trainer)

## 七、各家大厂公开岗位要求的侧重

截至 2026 年 10 月，公开招聘信息呈现出一个共同趋势：后训练岗位覆盖的不只是偏好优化算法，还包括数据生产、奖励与评测、RL 环境、分布式训练系统，以及模型上线后的行为质量。以下归纳依据各公司公开招聘页面，岗位内容和招聘状态会变化。

| 公司 / 岗位样本 | 公开职责或要求 | 对应的知识重点 |
| --- | --- | --- |
| [OpenAI：Post-Training、RL/Reasoning 等岗位](https://openai.com/careers/search/?q=research) | 招聘列表中有 Post-Training、RL/Reasoning、Agent Post-Training 等不同岗位方向；RL/Reasoning 职位强调强化学习研究、模型训练、快速实验、编码和规模化部署。 | RL 算法与推理训练、可信实验、代码实现、模型规模化训练。岗位分工较细，需区分模型行为后训练、推理 RL、Agent 后训练。 |
| [Anthropic：Production Model Post-Training](https://job-boards.greenhouse.io/anthropic/jobs/4613592008) | 覆盖生产模型完整后训练流程，列出 Constitutional AI、RLHF 等方法，并强调训练与评估流水线、性能测量、分布式系统、模型调试和可复现性。 | SFT/RLHF 与安全对齐、生产训练流水线、评测、分布式训练、可靠性。 |
| [Anthropic：RL Engineering](https://job-boards.greenhouse.io/anthropic/jobs/4952051008) | 负责 RL 核心训练系统，横跨编排、环境、训练、推理、评估；强调训练规模行为、受控实验、性能剖析和分布式系统。 | RL 系统架构、rollout 与训练协同、环境和 sandbox、profiling、可复现实验。 |
| [ByteDance Seed：LLM Post-Training 研究方向](https://seed.bytedance.com/en/seedearlycareer) | 公开研究方向包含代码 Agent RL、长程任务、多 Agent RL、RL scaling、推理时 scaling、自我进化训练闭环、奖励反馈，以及基础模型机器学习系统。 | Reasoning RL、Agent/长程环境、数据与反馈闭环、RL scaling 和训练系统。岗位分布在算法研究与 infra 等不同方向。 |
| [阿里巴巴：Qwen 后训练岗位目录](https://campus-talent.alibaba.com/campus/position?batchId=aliStar100000760001) | 官方招聘目录列出 LLM and Multimodal Post-training-AliStar；公开岗位介绍强调数据合成、Reasoning RL、Rubric RL、RLVR、RLHF、多维 verifier / reward model、工具路由、多 Harness 能力和数据飞轮。[岗位职责转载页](https://www.career.zju.edu.cn/jyxt/sczp/zpztgl/ckZpgwXq.zf?zpxxbh=4DE40BFF9E51CB11E0653A68DD0E9B18) | 数据合成、可验证奖励、偏好对齐、工具使用、跨 Harness 稳定行为、日志与数据回流；详细要求以官方投递页面为准。 |
| [腾讯：大模型强化学习框架研发](https://careers.tencent.com/jobdesc.html?postId=2072330929078190080) | 要求熟悉 PPO、GRPO、DPO 及 Verl、ROLL、AReal 等框架；工作覆盖 RL 训练数据、显存、通信、并行和性能优化，并涉及 Agentic RL 基础设施。 | 算法与系统协同、分布式训练、GPU/通信优化、RL 框架实现与调试。 |
| [腾讯：混元 Agent RL 框架工程](https://careers.tencent.com/jobdesc.html?postId=2061654749727600640) | 关注模型与工具调用、上下文管理、任务执行、Trace、结果收集、自动评测及异步并发、集群部署。 | Agent 环境、交互轨迹、任务状态、工具调用、运行可靠性、自动化评测。 |
| [百度：大模型算法工程师](https://talent.baidu.com/jobs/detail/SOCIAL/5fe4aa4c-b626-4659-9bfc-61ec2aa76c39) | 岗位包含多模态微调、垂域奖励规则与 RM、RLHF/RLAIF、Agent 规划和工具调用、推理时 scaling、高效奖励模型与训练推理优化。 | 垂域数据和奖励、RLHF/RLAIF、多模态后训练、Agent 推理、推理效率。百度实习岗位也明确列出 SFT、LoRA、DPO、RLHF、数据质量与 bad case 修复。 |
| [Google DeepMind：Research Engineer 能力定义](https://deepmind.google/careers/) | 官方对 Research Engineer 的概括强调机器学习与深度学习基础、工程与数学能力、实验系统构建、分布式基础设施和新想法的测试评估。该页面是岗位类别介绍，不等同于某一个当前 Post-Training 职位。 | 研究工程能力：把算法假设实现为可扩展实验，测量结果并优化系统。 |

这些岗位样本的差别主要在工作重心，而不是后训练概念完全不同。研究/效果岗位更靠近训练目标、奖励与能力评测；系统岗位更靠近 rollout 服务、并行、吞吐和故障诊断；产品或 Agent 后训练岗位更靠近数据飞轮、环境设计、工具交互和真实任务成功率。一个岗位也可能同时包含多个方向。

## 八、岗位知识地图

### 8.1 数据与监督信号

- **SFT 示范数据**：除对话模板、角色边界与 assistant token loss mask 外，还要确认样本是否包含完整多轮上下文，tool call 与 tool result 的特殊 token 是否保真，packing 是否跨样本污染上下文，截断是否切断答案或工具调用。长推理样本需明确监督完整思维链、最终答案，还是特定可见过程字段。
- **偏好数据**：chosen/rejected 对应同一个 prompt 和相同上下文；两者差异应能代表目标偏好，而非仅有长度、语气或格式差异。数据设计要规定平局、不可比较样本、标注者分歧、位置随机化、多轮历史、拒答、引用和工具轨迹的标注方式。
- **奖励与验证器**：Bradley–Terry RM 学成对排序；规则 grader、代码执行器、数学验证器和 LLM judge 有不同适用域。要分别检查排序准确率、校准、跨领域泛化与对抗稳健性，不能把 RM 分数直接解释为答案质量的绝对刻度。
- 合成数据：教师模型生成后需通过规则筛选、模型交叉评审、抽样人工复核和独立验证集。过滤不能只保留容易题或单一写法，否则训练分布会失去难例、多解和真实用户表达。
- **Agent 轨迹**：记录 observation、action、tool call、tool result、环境状态、错误码、终止原因、策略版本和环境版本。训练数据应区分真实成功轨迹、被修复轨迹、失败轨迹与合成轨迹，避免把不可执行的“理想过程”误当成真实环境反馈。
- 数据配比与课程：按能力、来源、质量、难度和长度分桶，记录每类样本被采样的概率。静态混合比例与动态难度调度会改变梯度来源；提高难例比例的同时，应监控基础指令遵循、语言质量和安全行为是否退化。
- 数据污染与泄漏：评测题、隐藏单测、答案字符串和近重复题要与训练/合成数据隔离。检索式去重、n-gram、语义近邻和来源追踪分别捕捉不同污染形式，必须保留原始来源与过滤记录供审计。

偏好数据和 Reward Model 的训练集常把同一 prompt 下的偏好排序转换为 pairwise loss。工程检查包括：chosen 与 rejected 是否使用相同上下文；偏好证据是否明确；是否通过随机交换展示顺序测量位置偏差；训练与验证是否按 prompt 来源切分；RM 的分数是否在不同领域、长度和难度上校准。

RM 常见失效模式包括：训练集里的偏好差异容易区分，但部署时遇到细微质量差别；RM 学到冗长、礼貌、结构化等表面信号；被策略优化后，RM 评分上涨但盲评下降；同一 RM 在不同长度或领域上系统偏置。可用多 RM 集成、偏好不确定度、拒绝优化低置信区域、独立 verifier 和定期重标注缓解，代价是更多推理与维护成本。

### 8.2 训练目标与算法

| 概念 | 必须掌握的内容 | 主要诊断量 / 失败模式 |
| --- | --- | --- |
| SFT | 自回归 token NLL、assistant loss mask、数据配比与遗忘 | train/eval loss、任务成功率、格式错误、能力回归 |
| Reward Model | 成对偏好概率、margin、采样和标注偏差 | pairwise accuracy、分数校准、长度/位置偏差、reward hacking |
| PPO-RLHF | policy gradient、ratio clipping、advantage/GAE、critic、reference KL | KL、entropy、clip fraction、value loss、reward 与人工质量背离 |
| DPO | reference-relative log-prob ratio、偏好分类目标、温度/β 与数据分布 | chosen/rejected margin、reference drift、过拟合和分布外退化 |
| GRPO / RLVR | 同 prompt 多 rollout、组内相对 advantage、verifier 奖励 | 组内奖励方差、全对/全错、采样成本、格式或 verifier 投机 |
| DAPO | 解耦 clip、动态采样、token-level loss 和超长回答 shaping | 动态采样改变 prompt 分布；检查奖励分布、回答长度和有效样本吞吐 |
| Dr. GRPO | 移除 GRPO 目标中的响应长度归一化和组内 reward 标准差归一化 | 改变长短轨迹和不同难度 prompt 的梯度权重；明确“无偏”对应的目标 |
| GSPO | 将重要性 ratio 和 clipping 从 token 级改为 sequence 级 | 关注 MoE 训练稳定性、序列概率的长度缩放和 ratio 分布 |
| 蒸馏 / rejection sampling | 候选生成、筛选、教师信号和学生拟合 | 选择偏差、教师错误传播、覆盖与多样性损失 |

这些方法不是按发布时间排列的单向替代关系。DAPO 针对长推理 RL 中零梯度组、探索和回答长度问题提出组合改动；Dr. GRPO 针对特定归一化导致的长度及组间偏差；GSPO 采用序列级比率以降低 MoE 场景下 token-level 更新的不稳定。方法效果依赖奖励类型、loss 聚合、长度分布、采样实现和目标任务，复现实验时必须逐项核对配置。[DAPO 论文](https://arxiv.org/abs/2503.14476) [Dr. GRPO 论文](https://arxiv.org/abs/2503.20783) [GSPO 论文](https://arxiv.org/abs/2507.18071)

### 8.3 奖励和 Verifier 设计

#### 奖励来源应与任务可判定性匹配

| 任务特征 | 可用反馈 | 典型训练方式 | 需要重点检查 |
| --- | --- | --- | --- |
| 唯一正确答案，机器可判定 | exact match、解析器、单测、定理验证 | SFT + rejection sampling 或 RLVR | 答案格式、测试覆盖、猜测概率、隐藏测试泄漏 |
| 答案开放但可分项 rubric | 分项规则、专家标签、经过验证的 LLM judge | SFT、DPO、RM + PPO/GRPO | rubric 一致性、评审模型偏差、不同维度权重 |
| 偏好主观且多解 | 人类比较、质量排序、安全标注 | DPO、RM + RLHF、RLAIF | 标注者分歧、文化与领域偏差、目标冲突 |
| 多步交互任务 | 环境状态、工具结果、任务完成度、成本 | Agentic SFT、在线 RL、环境反馈 | 环境保真、奖励延迟、工具错误、策略外轨迹 |

“任务可验证”不等于“奖励无误”。单测可能没覆盖隐藏边界；数学答案解析可能把等价表达判错；grader 可能只检查格式而漏掉内容；LLM judge 可能偏好自身风格。奖励上线前需执行 mutation test：故意改变模型输出或程序行为，确认评分器会对正确性、安全和约束违例作出预期反应。

#### 稀疏结果奖励与过程奖励

**Outcome reward** 只评估最终答案或任务是否完成，信号定义清晰，比较不容易被中间过程的主观评分污染；但长轨迹中的 credit assignment 较弱。**Process reward** 对中间步骤、动作或子目标给反馈，能更早指出偏差，也会引入更多标注成本、奖励偏差和过程投机。

代码任务可将测试分层：语法/静态检查、公开单测、隐藏单测、集成运行、资源限制和安全检查分别记分。数学任务可区分最终答案验证、推理步骤一致性和格式要求。Agent 任务可拆成子目标完成、工具选择、参数正确、环境状态改变、总时长与成本，但需避免各子项重复计算同一结果。

#### 多目标奖励与标度

复合目标常写为加权和 \(R=\sum_k w_k R_k\)，其中正确性、安全、格式、成本、长度和用户偏好可能相互冲突。奖励尺度不匹配时，即便某项权重很小，也可能因数值范围更大而主导总奖励。训练前应查看每个子奖励的范围、分布、相关性和梯度贡献；训练中记录子奖励与综合奖励，独立评估未直接纳入优化的安全和能力指标。

奖励归一化、截断、裁剪和动态权重都会改变优化目标。动态调整权重时需记录调度状态；否则同一 reward 曲线跨阶段不可直接比较。对多个目标可分别报告 Pareto 前沿，避免把单一加权总分当成无价值判断的客观排序。

#### Verifier 的有效学习区间

在线 RL 需要策略既能偶尔成功，也能在采样结果之间产生可区分的奖励。若样本组几乎全错，当前策略可能缺少可强化的成功轨迹；若几乎全对，组内 advantage 接近零，更新信号饱和。可按难度分桶估计 pass@1、组内成功比例、奖励方差和单位 token 的有效梯度样本数，据此调节课程、采样数或 verifier 粒度。

多选题的命中率可能来自随机猜测；短答案可能只给了模型部分奖励捷径。可通过增加干扰类别、要求结构化中间产物、运行隐藏测试、对答案做语义等价检查或使用执行反馈，减少随机猜中带来的虚假梯度。OpenAI 对可编程 grader 的 RFT 指南也强调任务要有可判定性，当前模型应有非零但未饱和的成功空间。[RFT grader 设计](https://developers.openai.com/api/docs/guides/rft-use-cases)

### 8.4 从 GRPO 到 DAPO、Dr. GRPO 与 GSPO

经典 GRPO 与一系列变体的差异，主要落在四个设计轴上：

1. 权重粒度：每 token 独立 ratio，还是整条 response 共享 sequence ratio。
2. 长度聚合：按 response 平均、按所有 token 平均，或不按长度归一化。不同口径会重新分配长短轨迹的梯度权重。
3. 样本筛选：是否过滤同组全对/全错样本、动态重采样或基于难度调度。
4. 截断与奖励 shaping：长度上限附近如何惩罚，截断回答算失败还是部分有效。

Dr. GRPO 的“unbiased”指它针对论文分析的特定策略梯度目标去除了特定归一化偏差，并非所有训练设置都无偏。2026 年的后续理论工作指出，在 outcome-reward 设定下，梯度无偏与轨迹贡献长度不变一般不能同时满足；比较长度归一化时，需要先说明优化目标，而不是只说某公式“正确”。[关于无偏与长度不变性的后续分析](https://arxiv.org/abs/2607.23364)

方法比较应固定模型、prompt 集、奖励、rollout 数、最大长度和生成后端，再做单组件消融。若一次同时换 verifier、length normalization、采样温度、奖励 shaping 和优化器，就无法归因提升来源。

### 8.5 推理与 Agent 后训练

当动作不只是下一个 token，而包含工具调用或多步环境操作时，训练样本扩展为交互轨迹。需要定义环境状态、动作空间、工具结果、部分可观测信息、奖励归因和 episode 终止条件。关键问题包括：环境是否可复现、工具失败如何计分、奖励延迟如何归因、轨迹过长如何截断、策略版本变化后旧轨迹是否仍有效，以及模型是否学会安全地停止或升级给人。

Agent 任务的评测不能只看最终回答文本。应同时记录任务成功率、步骤数、工具调用正确率、无效调用、超时/恢复、安全违规、成本和不同环境版本下的鲁棒性。若环境本身不代表真实任务，策略可能只适配模拟器。

### 8.6 RL 训练系统：从 rollout 到 optimizer step

RL 系统通常分为生成、评分、训练和编排四层：

```text
Prompt / 任务采样
    ↓
Rollout workers ── 记录 token、log-prob、模型版本、终止原因
    ↓
Reward / Verifier workers ── 得分、子分项、错误与超时
    ↓
Trajectory buffer / 去重 / 过滤 / 过期样本策略
    ↓
Learner ── advantage、loss、反向传播、优化器更新
    ↓
权重同步 / checkpoint / 独立评测
    └────────→ 新策略版本返回 rollout workers
```

rollout、reward 和 learner 可以同进程、共置在同一 GPU，也可以拆到不同资源池异步运行。共置减少权重传输和调度复杂度，但生成与训练会争抢显存和算力；分离能独立扩缩容，但会产生权重同步、RPC、队列积压和策略滞后的问题。

#### Rollout 吞吐与异步更新

系统的有效训练速度不是 `tokens/s` 单指标。可拆成：

$$
\text{有效更新吞吐} = \text{生成 token/s} \\times \text{有效轨迹比例} \\times \text{评分可用率} \\times \text{更新利用率}
$$

长尾回答会导致 batch straggler；高难度 prompt 可能反复采样而耗尽预算；verifier timeout 会降低有效样本率；训练端等待 rollout 造成 GPU 空转。应分别测量生成、评分、排队、梯度更新的 p50/p95 时延，并统计 prompt 到有效 optimizer step 的总时长。

异步系统用旧策略采到的数据更新新策略，需为每条 trajectory 记录 behavior policy version。策略滞后越大，采样分布与当前 learner 分布差异越大；过期样本可以丢弃、限制最大滞后、使用重要性比率修正，或用算法专门处理 off-policy 数据。修正会引入方差；裁剪过强则可能丢掉有效梯度。

#### Training-Inference Mismatch

生成后端与训练端对同一模型权重、同一 token 序列计算出的 log-prob，应能在容许误差内对齐。以下差异会破坏策略比率：

- sampler 使用的温度、top-p/top-k 与训练端 log-prob 定义不一致；
- serving 和 learner 的 attention kernel、精度、归一化或 logits 处理不同；
- EOS、stop sequence、截断、padding mask 或 chat template 处理不一致；
- rollout 使用的权重版本与元数据记录不一致；
- MoE routing、专家并行和并发调度引入不同的数值行为。

训练崩溃排查前可运行 no-update parity check：固定权重、prompt、生成 token 和 mask，分别计算 sampler 与 learner 的每 token log-prob，统计最大绝对差、均方差和按 token 位置分布的差异。近期研究指出，训练与推理概率不匹配会独立影响 RL 稳定性，不能一概归结为普通浮点噪声。[Training-Inference Mismatch 研究](https://arxiv.org/abs/2605.14220)

#### 显存和计算预算

在线 RL 的显存要按运行时角色清点，而不是只算 policy 参数：

| 组件 | 常见驻留内容 | 主要优化方向 |
| --- | --- | --- |
| Policy learner | 权重、梯度、optimizer states、activation | FSDP/ZeRO、混合精度、梯度检查点、并行策略 |
| Rollout engine | 推理权重、KV cache、并发序列 | 精度策略、KV cache 管理、动态 batching |
| Reference model | 冻结权重和每 token log-prob | 参数共享/卸载、缓存 log-prob、按目标选择 KL 计算方式 |
| Reward model / judge | RM 权重、打分 batch、judge API 请求 | 独立弹性扩容、批量打分、降低昂贵 judge 调用 |
| Trajectory / buffer | token、mask、log-prob、奖励、元数据 | 压缩、分块、过期回收、只保留训练必需字段 |

多角色共置时，峰值显存往往出现在 rollout KV cache 与 learner optimizer/activation 重叠阶段。性能方案必须说明它降低的是峰值显存、tokens/s、通信时间、端到端 step time，还是单位有效更新成本。

性能分析从瓶颈测量开始：GPU 利用率、MFU、tokens/s、生成延迟、显存峰值、通信等待、队列等待和有效样本比例。数据并行、张量并行、流水线并行、FSDP/ZeRO、序列并行、梯度检查点、混合精度和高效 attention 针对不同瓶颈，需通过 profile 和端到端基准验证。RL 训练还要计算 rollout 与评分成本，单看训练 step 时间不足以反映总样本效率。

### 8.7 训练问题的诊断矩阵

| 现象 | 优先检查 | 可区分问题的证据 |
| --- | --- | --- |
| train reward 上升，独立 eval 不变或下降 | grader 投机、训练测试泄漏、目标分布漂移 | 高奖励样本盲审、隐藏测试、子奖励与外部 eval 相关性 |
| entropy 快速下降、输出模式单一 | clip、采样温度、KL 系数、prompt 多样性 | token entropy 分布、候选去重率、策略/参考 KL |
| completion 长度持续增长 | 长度归一化、过程奖励、截断和 overlong shaping | 按正确/错误轨迹分桶的长度、长度与奖励/成功率关系 |
| 组内大多全对或全错 | 任务难度、采样数、verifier 分辨率 | per-prompt pass fraction、组内 reward std、有效组比例 |
| KL 突增、有效样本骤降 | 学习率、更新 epoch、策略版本滞后、log-prob mismatch | ratio 分布、policy version age、sampler/learner parity |
| GPU 利用率低、step time 方差大 | rollout / reward 等待、长尾 batch、通信和调度 | stage-level utilization、p50/p95 latency、队列长度和 straggler 比例 |
| 训练后原有能力明显退化 | 数据配比、KL 锚定、训练时长、评测切片 | base/SFT/RL 多 checkpoint 对照、通用任务回归和领域切片 |

诊断顺序应先验证数据与实现正确性，再看指标定义和策略优化，再定位分布式性能问题。单个总 reward 或总 tokens/s 无法区分这些原因。

### 8.8 评测与实验方法

- 建立冻结的测试集，隔离训练/开发数据与测试数据，记录数据版本和模型版本。
- 对目标任务做分桶：难度、领域、语言、长度、工具类型、安全风险和长尾样本。
- 将自动指标、规则验证、模型评审和人工盲评组合使用，并抽查高奖励样本与退化样本。
- 做消融和多随机种子复验，报告方差、成本、推理延迟和回归能力。
- 检查指标与产品目标是否一致，识别 reward hacking、benchmark 污染和用户分布漂移。

## 九、目标与训练方法的选型

后训练方法的选择取决于反馈来源、在线采样预算和目标是否可验证。算法名称本身不能决定效果；数据分布、奖励定义、参考策略、生成配置和更新次数共同决定最终优化行为。

| 训练目标 | 优先考虑的方法 | 优势 | 主要边界 |
| --- | --- | --- | --- |
| 补齐能力、格式或工具协议 | SFT | 监督信号直接，训练稳定，适合学习明确行为 | 依赖示范覆盖；模仿错误示范会固化错误模式 |
| 从离线偏好对齐回答风格和质量 | DPO 类目标 | 无需单独在线采样和显式 critic，管线相对简单 | 偏好数据分布外泛化有限；过度训练可能偏离参考策略 |
| 利用人类偏好持续采样优化 | RM + PPO 等 RLHF | 可在线探索并将标量偏好用于策略更新 | RM 误差会被策略放大；训练系统与超参更复杂 |
| 目标有可执行的正确性判定 | SFT / rejection sampling + RLVR | verifier 可低成本批量反馈，支持扩大采样 | verifier 覆盖不足或可被投机时，分数不代表任务能力 |
| 多步工具/环境交互任务 | Agentic SFT + 环境 RL | 直接优化环境中的任务完成行为 | 环境偏差、长时程 credit assignment、旧轨迹策略滞后 |
| 资源有限，先提升候选质量 | 教师蒸馏 / rejection sampling | 可将教师能力转成学生监督，训练简单 | 教师覆盖与筛选造成选择偏差，多样性可能下降 |

#### 离线偏好优化与在线 RL 的区别

DPO 使用固定的偏好对，训练期间不必不断调用当前策略生成新回答；因此，成败很大程度取决于偏好数据对部署分布的覆盖，以及策略更新是否离开数据支持区域。在线 RL 可基于新策略继续生成并评分，能改善分布匹配，但需要可靠 verifier 或 reward、足够的有效 rollout 吞吐和稳定的更新控制。

选择前要明确以下条件：

1. 反馈来源：人类比较、规则判定、环境奖励还是教师答案？
2. 反馈粒度：整条回答一个分数，还是步骤、工具动作和子目标分别打分？
3. 探索价值：新策略采样能否发现训练数据中没有的更好行为？
4. 判定可靠性：评分错误是否能独立审计，错误奖励能否被策略快速放大？
5. 更新成本：生成、评分和训练的总成本，是否换来独立评测上的改善？

若反馈不可靠，增加 rollout 数通常只会更快优化错误目标；若任务由示范即可覆盖，在线 RL 也可能没有足够收益抵偿系统成本。

## 十、实验闭环与结果解释

后训练实验应先把目标、测量方式和回滚条件写清楚，再启动长时间训练。一个可以复现的实验记录至少包括：基座与 tokenizer 版本、数据快照及过滤规则、prompt 模板、loss mask、采样参数、奖励/verifier 版本、policy 与 reference 配置、优化器与学习率、序列长度、并行布局、随机种子、代码 commit、checkpoint 和评测器版本。

#### 消融应隔离变量

实验对照至少保留 base/SFT 起点、当前生产或最强基线、目标方法和必要的消融项。每次改变一个主要因素，例如 verifier、数据混合、KL 系数、response loss 聚合、rollout temperature、采样数或最大长度。需要组合方法时使用小型 factorial 设计，避免把相关因素的效果混在一起。

评测结论应同时展示：

- 目标指标变化及置信区间，报告样本数和评测版本；
- 按难度、领域、语言、长度和工具类型分桶后的变化；
- 通用能力、安全、格式遵循和已有产品任务的回归项；
- 训练 token、rollout 数、GPU 时长、评分调用量与在线推理成本；
- 人工盲评与自动评分的一致性，以及高分失败样本的抽查结果。

对成对模型比较，可固定 prompt 和评测条件，进行盲评或成对胜率比较，并用 bootstrap 估计不确定性。只报告单次平均分会掩盖长尾回归和评测噪声；只报告自动 grader 则会把 grader 的偏差误当作模型提升。

#### 从实验结果到训练决策

- 目标任务上升、通用任务下降：检查数据混合、目标权重、训练步数、KL 和分桶回归；考虑提前停止或回退 checkpoint。
- reward 上升、人工偏好不变：检查 verifier 是否测到代理指标，抽查边际高分样本并扩大独立评测。
- 单个 benchmark 上升、同类任务不变：检查污染、提示词模板依赖和测试集过拟合，使用未见来源的任务复测。
- 平均指标上升、长尾失败恶化：按错误严重性和业务频率重新审视综合分数，不能由平均值覆盖高代价风险。
- 离线评测改善、线上任务不变：检查线上分布、系统提示、工具环境和推理参数是否与训练假设一致。

上线或扩大训练预算的依据应是独立任务质量、回归风险和单位成本的综合变化。遇到目标和副作用冲突时，先明确目标优先级，再调整数据或奖励；仅通过增大某一项奖励权重，可能让冲突更严重。

## 十一、岗位能力映射

公开岗位标题不统一，职责描述比 title 更能说明准备重点。下表将常见要求映射为需要掌握的知识和可展示的工程能力。

| JD 关键词 | 需要理解 | 可验证的实践能力 |
| --- | --- | --- |
| Post-training / Alignment / Preference | SFT、偏好数据、RM、DPO、PPO、KL 和行为评估 | 解释目标函数选择，分析偏好噪声和策略退化 |
| Reasoning / RLVR / Verifier | GRPO 与相关变体、pass@k、奖励饱和、长度效应 | 实现 verifier、分析全对/全错组，设计数据课程与消融 |
| RL systems / Rollout / Distributed | 生成和 learner 的策略版本、异步队列、并行、显存与通信 | profile 端到端吞吐，定位 log-prob mismatch、长尾和资源争用 |
| Agent / Tool use / Environment | 轨迹结构、工具协议、状态转移、延迟奖励、环境可靠性 | 构建可复现环境，分类任务失败和无效调用，评估成本与安全 |
| Data synthesis / Flywheel | 数据来源、教师生成、筛选、标注质量、污染审计 | 设计过滤与抽样复核，追踪训练样本到评测变化的来源 |
| Safety / Reward model / Rubric | 安全目标、偏好分歧、judge 校准、对抗稳健性 | 设计分项 rubric、构造边界案例并评估 false positive/negative |

跨方向的共同要求是把算法假设变成可复现的实验，并用独立评测解释收益、代价和失败条件。若 JD 同时出现算法和 infra 词汇，应优先梳理算法如何依赖系统实现：例如 rollout 时延会影响策略数据新鲜度，生成参数会影响采样分布，verifier 成本会限制探索预算。

## 十二、复习顺序

知识点的依赖关系可以按以下顺序建立：

1. Transformer 自回归建模、交叉熵、概率统计、优化器和 PyTorch 训练基础。
2. SFT 数据管线、模板和 loss mask，建立行为监督与验证集的概念。
3. 偏好建模、Bradley–Terry RM、KL 正则和 PPO-RLHF 的组件关系。
4. DPO 推导与限制；再比较 GRPO、RLVR、rejection sampling 和蒸馏的监督来源与成本。
5. 奖励设计、评测和错误分析，理解训练分数为什么可能与模型质量脱节。
6. 按岗位方向补充分布式 RL、Agent 环境、多模态后训练、生产监控或业务数据闭环。

基础知识与岗位侧重点应结合阅读：SFT/RM/RL 属于算法共同底座；若岗位写到 RL systems、Verl、并行或 NCCL，则需进一步掌握系统剖析；若写到 rubric、verifier、Agent environment 或 data flywheel，则优先补奖励判定、环境和数据回流设计。

## 十三、核心知识点速查

- 后训练目标：把任务行为转化为可优化、可评估的监督信号。
- SFT：目标 token 是什么，哪些 token 应被 mask，数据的覆盖和冲突如何处理。
- RM：偏好排序学到什么，标注与采样偏差怎样传入奖励。
- PPO：policy、reference、reward model、critic、advantage、clipping、KL 的职责。
- DPO：如何从 KL 约束下的最优策略得到偏好分类目标，离线数据的边界是什么。
- GRPO/RLVR：组内比较如何提供更新信号，verifier 失去区分度或被利用时会发生什么。
- Agent RL：环境、动作、轨迹、延迟奖励和终止条件如何定义。
- 系统效率：生成、评分、通信、反向传播、checkpoint 分别占多少成本。
- 评测可信度：数据隔离、分桶、人工复核、方差、成本和回归如何共同支撑结论。

## 参考资料

1. Ouyang et al., [Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155), 2022。
2. Rafailov et al., [Direct Preference Optimization: Your Language Model is Secretly a Reward Model](https://arxiv.org/abs/2305.18290), 2023。
3. Shao et al., [DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models](https://arxiv.org/abs/2402.03300), 2024。
4. DeepSeek-AI et al., [DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/abs/2501.12948), 2025。
5. Hugging Face, [TRL Quickstart](https://huggingface.co/docs/trl/main/quickstart), [PPO Trainer](https://huggingface.co/docs/trl/main/ppo_trainer), [GRPO Trainer](https://huggingface.co/docs/trl/main/grpo_trainer)。文档版本持续更新，具体接口以项目使用的版本为准。
6. OpenAI, [Reinforcement fine-tuning guide](https://developers.openai.com/api/docs/guides/reinforcement-fine-tuning), [RFT use cases and grader design](https://developers.openai.com/api/docs/guides/rft-use-cases)。
7. 方法论文： [DAPO: An Open-Source LLM Reinforcement Learning System at Scale](https://arxiv.org/abs/2503.14476), [Understanding R1-Zero-Like Training: A Critical Perspective](https://arxiv.org/abs/2503.20783), [GSPO: Group Sequence Policy Optimization](https://arxiv.org/abs/2507.18071)。后两项需对照论文具体目标与实现配置阅读。
8. 系统诊断： [Diagnosing Training-Inference Mismatch in LLM Reinforcement Learning](https://arxiv.org/abs/2605.14220), [On the Impossibility of Unbiased and Length-Invariant Policy Optimization with Outcome Rewards](https://arxiv.org/abs/2607.23364)。2026 年工作用于补充理解训练推理一致性和长度归一化的边界。
9. 招聘页面： [OpenAI Careers](https://openai.com/careers/search/?q=research), [Anthropic Production Model Post-Training](https://job-boards.greenhouse.io/anthropic/jobs/4613592008), [Anthropic RL Engineering](https://job-boards.greenhouse.io/anthropic/jobs/4952051008), [ByteDance Seed Foundation Model Campus Recruitment](https://seed.bytedance.com/en/seedearlycareer)。
10. 招聘页面： [阿里巴巴 Qwen 后训练岗位目录](https://campus-talent.alibaba.com/campus/position?batchId=aliStar100000760001), [腾讯大模型强化学习框架研发](https://careers.tencent.com/jobdesc.html?postId=2072330929078190080), [腾讯 Agent RL 框架工程](https://careers.tencent.com/jobdesc.html?postId=2061654749727600640), [百度大模型算法工程师](https://talent.baidu.com/jobs/detail/SOCIAL/5fe4aa4c-b626-4659-9bfc-61ec2aa76c39), [Google DeepMind Careers](https://deepmind.google/careers/)。

后训练知识的主线是监督信号、训练目标、系统实现与评测可信度。大厂岗位的差异主要体现在更偏研究算法、生产后训练、Agent 环境、数据飞轮，还是 RL 训练系统；复习时可先建立共同底座，再按目标岗位补齐专门方向。
