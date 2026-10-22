# LLM Post-Training 岗位知识图谱：训练方法、工程闭环与大厂岗位要求

LLM post-training（后训练）岗位的目标，是把预训练模型调整为能稳定完成具体任务的模型。相关知识应沿着完整链路组织：问题定义 → 数据与监督信号 → 训练目标 → 训练系统 → 离线评测 → 线上反馈。SFT、PPO、DPO、GRPO 是这条链路中的算法组件，不能脱离任务与数据单独理解。

本文面向大模型后训练算法、研究工程和训练工程岗位，整理核心知识，并对照截至 2026 年 10 月可查到的 OpenAI、Anthropic、ByteDance Seed、阿里、腾讯、百度等公开岗位信息归纳能力侧重。招聘页面会更新，岗位样本用于说明职责差异，不代表公司内部面试题库。

本文将[大语言模型面试复习资料](/blogs/llm-interview-review)中的后训练内容独立整理并扩展，覆盖监督微调、偏好建模、策略优化、可验证奖励、工具交互与训练系统。通用面经保留模型结构、预训练、检索等主题；本专题集中解释后训练的目标、公式、实现选择和实验诊断。

## 一、后训练的目标与完整链路

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

### 1.1 岗位方向

同一个“LLM post-training”标题，可能对应三类职责。

| 岗位侧重 | 主要问题 | 常见交付物 | 知识重点 |
| --- | --- | --- | --- |
| 后训练算法 / 效果 | 模型怎样更有用、可靠或擅长推理 | 数据配方、训练实验、能力与安全评测 | SFT、偏好学习、RL、奖励设计、实验分析 |
| 训练系统 / RL Infra | 如何稳定、高效地产生 rollout 并完成更新 | 分布式训练与推理链路、吞吐与稳定性改进 | GPU 显存、并行策略、异步架构、性能诊断 |
| 应用 / 垂域后训练 | 如何提升特定产品任务的成功率 | 领域数据、评测集、模型版本与线上指标 | 数据质量、业务定义、错误分析、部署成本 |

投递前应从岗位描述中标记动词：如果强调“研究、奖励建模、推理能力”，重点准备方法和实验；如果强调“训练框架、吞吐、并行”，重点准备系统；如果强调“业务场景、数据闭环”，重点准备任务定义和线上评估。知识准备应与职责对应，后训练也不能被简化为单一的 RL 算法。

### 1.2 训练方法与监督信号的匹配

后训练方法的选择取决于反馈来源、在线采样预算和目标是否可验证。算法名称本身不能决定效果；数据分布、奖励定义、参考策略、生成配置和更新次数共同决定最终优化行为。

| 训练目标 | 优先考虑的方法 | 优势 | 主要边界 |
| --- | --- | --- | --- |
| 补齐能力、格式或工具协议 | SFT | 监督信号直接，训练稳定，适合学习明确行为 | 依赖示范覆盖；模仿错误示范会固化错误模式 |
| 从离线偏好对齐回答风格和质量 | DPO 类目标 | 无需单独在线采样和显式 critic，管线相对简单 | 偏好数据分布外泛化有限；过度训练可能偏离参考策略 |
| 利用人类偏好持续采样优化 | RM + PPO 等 RLHF | 可在线探索并将标量偏好用于策略更新 | RM 误差会被策略放大；训练系统与超参更复杂 |
| 目标有可执行的正确性判定 | SFT / rejection sampling + RLVR | verifier 可低成本批量反馈，支持扩大采样 | verifier 覆盖不足或可被投机时，分数不代表任务能力 |
| 多步工具/环境交互任务 | Agentic SFT + 环境 RL | 直接优化环境中的任务完成行为 | 环境偏差、长时程 credit assignment、旧轨迹策略滞后 |
| 资源有限，先提升候选质量 | 教师蒸馏 / rejection sampling | 可将教师能力转成学生监督，训练简单 | 教师覆盖与筛选造成选择偏差，多样性可能下降 |

## 二、监督微调：建立行为基线

### 2.1 目标函数与损失掩码

SFT 通常对目标回答 token 计算自回归交叉熵：

$$
\mathcal{L}_{\mathrm{SFT}}(\theta) = -\sum_{t \in \mathcal{T}_{\mathrm{target}}} \log \pi_{\theta}(y_t \mid x, y_{<t})
$$

关键实现是确定集合 $\mathcal{T}_{\mathrm{target}}$：很多对话训练只对 assistant 的回答部分计算 loss，user、system、padding 等 token 需要正确 mask。模板边界或 mask 错误会让模型学习复述用户消息、输出错误角色标记，或把填充 token 当成目标。多轮对话还要确认是否仅训练 assistant turn、工具调用结构是否进入目标，以及截断发生时是否破坏完整轮次。

### 2.2 数据质量检查

数据量并不等于有效监督量。训练前至少检查：重复与近重复、答案正确性、格式一致性、隐私与许可、长度分布、语言和任务比例、训练验证污染，以及不同来源间的质量差异。拒答、安全、工具调用、多轮上下文等行为应有明确的数据定义；如果同一类输入在不同样本里对应互相冲突的目标，模型收到的梯度也会冲突。

数据规模效应取决于样本相关性与质量；扩大规模能否继续改善，应通过数据消融或 scaling 实验验证。可比较随机抽样、去重、难例采样、合成数据比例与不同任务配比，并报告每种变更对目标指标和回归指标的影响。

数据治理还应覆盖多轮上下文、工具协议、合成数据和训练分布：

- 确认 packing 不会跨样本泄漏上下文，截断不会切断答案或工具调用，tool call 与 tool result 的特殊 token 保持原样。
- 长推理样本要明确监督完整推理文本、最终答案，还是特定过程字段；监督目标应与部署时可见行为一致。
- 合成样本经规则筛选、模型交叉评审、抽样人工复核和独立验证。过滤不能只保留容易题或单一写法，否则难例、多解和真实用户表达会被削弱。
- 按能力、来源、质量、难度和长度分桶并记录采样概率。静态混合比例和动态难度调度都会改变梯度来源；同时监控基础指令遵循、语言质量和安全行为是否退化。
- 隔离评测题、隐藏单测、答案字符串和近重复题。n-gram、语义近邻、检索式去重和来源追踪捕捉不同污染形式，应保留来源与过滤记录以便审计。

### 2.3 训练后要看什么

除训练 loss 外，应观察验证集 loss、目标任务成功率、格式遵循率、拒答与误拒率、长度变化、重复率、旧能力回归，以及不同子群体/任务切片上的误差。训练 loss 下降只说明目标 token 更可预测，不能单独证明模型更符合用户意图。




## 三、偏好对齐：Reward Model、PPO 与 DPO

### 3.1 Reward Model 与 RLHF

偏好数据通常为同一 prompt 下的一对答案 $(y^+, y^-)$，标注其中更好的答案。Bradley–Terry 偏好模型常写为：

$$
P(y^+ \succ y^- \mid x) = \sigma\big(r_{\phi}(x,y^+) - r_{\phi}(x,y^-)\big)
$$

奖励模型学习“哪个更好”，并不天然学到绝对质量。标注规范不一致、偏好对过于简单、位置偏差、长度偏好或领域覆盖不足都会影响模型。RM 还可能把容易识别的表面特征当捷径，例如更长、更有礼貌或格式更完整，却未必事实更准确。

经典 PPO-RLHF 用奖励模型给采样回答打分，策略梯度更新语言模型，并用 reference policy 的 KL 惩罚限制策略漂移。常见实现还训练 critic 估计价值并辅助计算 advantage。需区分 policy、reference、reward model、critic 分别提供的信号，以及 KL 系数对奖励提升和策略漂移的约束。

PPO 的主要风险包括奖励过优化、策略更新过大、价值估计偏差、生成采样与训练策略不一致、长序列 token 级 credit assignment 噪声，以及 KL 过大或过小。排查不能只看 reward 曲线：还要看 KL、熵、长度、clip fraction、value loss、reward 分布和人工盲评，并检查高奖励样本是否真的更好。

#### 3.1.1 KL 约束：限制策略追逐奖励的范围

令 $pi_{\mathrm{ref}}$ 为冻结的参考策略，$pi_\theta$ 为待优化策略。带 KL 约束的目标可写为：

$$
\max_{\pi_\theta}\;\mathbb{E}_{x}\left[\mathbb{E}_{y\sim\pi_\theta(\cdot|x)}[r_\phi(x,y)]-\beta\,\mathrm{KL}\!\left(\pi_\theta(\cdot|x)\,\|\,\pi_{\mathrm{ref}}(\cdot|x)\right)\right]
$$

对自回归回答，序列对数概率可拆为 token 对数概率之和，因此序列级 log-ratio 也可分解到每个生成位置。实践中常用采样估计：

$$
\log\frac{\pi_\theta(y|x)}{\pi_{\mathrm{ref}}(y|x)}=\sum_{t=1}^{|y|}\log\frac{\pi_\theta(y_t|x,y_{<t})}{\pi_{\mathrm{ref}}(y_t|x,y_{<t})}
$$

$\beta$ 越大，策略越被约束在参考模型附近；越小，奖励提升空间更大，但过优化和行为漂移风险也更高。KL 既可以作为优化目标中的独立项，也可以转换成逐 token 惩罚并并入奖励。两种写法的具体估计方式、归一化和调度会影响训练，不能只凭配置名判断是否等价。KL 是非对称散度，不是距离；这里关注的是策略相对参考策略的偏移成本，而不是对称比较两个模型。

#### 3.1.2 从期望奖励到策略梯度

先固定 prompt $x$，目标是最大化当前策略采样回答的期望奖励：

$$
J(\theta)=\mathbb{E}_{y\sim\pi_\theta(\cdot|x)}[r(x,y)]
=\int \pi_\theta(y|x)r(x,y)\,dy
$$

奖励对策略参数求导时视为固定函数。利用 $\nabla_\theta\pi_\theta=\pi_\theta\nabla_\theta\log\pi_\theta$，可把梯度写成从策略采样的期望：

$$
\nabla_\theta J(\theta)=\mathbb{E}_{y\sim\pi_\theta}\left[r(x,y)\nabla_\theta\log\pi_\theta(y|x)\right]
$$

语言模型的回答概率是各 token 条件概率的乘积，所以 $\log\pi_\theta(y|x)=\sum_t\log\pi_\theta(y_t|x,y_{<t})$。这使序列奖励能通过每个 token 的 log-prob 梯度回传。减去与动作无关的基线 $b(x)$ 不改变梯度期望，却可降低方差：

$$
\nabla_\theta J(\theta)=\mathbb{E}_{y\sim\pi_\theta}\left[(r(x,y)-b(x))\nabla_\theta\log\pi_\theta(y|x)\right]
$$

括号内的相对信号就是 advantage 的基本形式。PPO 用 critic 估计状态价值作为基线；GRPO 用同 prompt 的回答组构造相对基线。二者的区别首先是 advantage 的估计方式，而不是是否使用语言模型。

log-derivative 技巧的作用是把对采样分布的梯度转换成可由模型反向传播的 log-prob 梯度。直接对 $y\sim\pi_\theta$ 求样本平均 $\nabla_\theta\pi_\theta(y)r(y)$ 并不等于原积分，因为采样期望会额外乘上一次 $\pi_\theta(y)$；改写为 $\pi_\theta\nabla\log\pi_\theta$ 后，采样密度正好与积分中的策略分布一致。再减去与动作无关的 baseline，可以降低方差而不改变期望梯度。

#### 3.1.3 PPO、重要性比率与 GAE

采样策略 $\pi_{\theta_{\mathrm{old}}}$ 与当前待更新策略 $\pi_\theta$ 不同。PPO 使用重要性比率修正这批旧策略样本，并通过 clipped surrogate 限制单次更新：

$$
\rho_t(\theta)=\frac{\pi_\theta(a_t|s_t)}{\pi_{\theta_{\mathrm{old}}}(a_t|s_t)},\qquad
\mathcal{J}_{\mathrm{PPO}}=\mathbb{E}_t\left[\min\left(\rho_t\hat A_t,\,\mathrm{clip}(\rho_t,1-\epsilon,1+\epsilon)\hat A_t\right)\right]
$$

当 $\hat A_t>0$ 时目标提高该动作概率；当 $\hat A_t<0$ 时降低该动作概率。clip 限制有利方向上的过大更新，避免一次更新过度偏离采样策略。$\rho$ 负责校正策略版本差异，clip 控制更新幅度；它们并不解决奖励定义错误。

语言模型常只有回答末尾的结果奖励。PPO 的 critic $V_\psi(s_t)$ 为每个生成前缀估值，TD 残差和 GAE 将延迟奖励分配到 token：

$$
\delta_t=r_t+\gamma V_\psi(s_{t+1})-V_\psi(s_t),\qquad
\hat A_t^{\mathrm{GAE}(\gamma,\lambda)}=\sum_{l=0}^{\infty}(\gamma\lambda)^l\delta_{t+l}
$$

$\lambda$ 在短视的 TD 估计与高方差的整条轨迹回报之间调节偏差—方差。critic 通常用回报或 GAE 构造的 value target 做回归；它与 reward model 不同：RM 在 RL 前训练并冻结，回答级别打分；critic 在 RL 阶段更新，估计状态后续回报并提供逐 token 基线。

例如两步回答轨迹中，第一步无即时奖励，第二步得到终局奖励 1。若 $V(s_0)=0.5$、$V(s_1)=0.6$、终止状态 $V(s_2)=0$，且 $\gamma=0.9,\lambda=0.95$，则 $\delta_0=0+0.9(0.6)-0.5=0.04$，$\delta_1=1-0.6=0.4$，第一步的优势为 $\hat A_0=\delta_0+\gamma\lambda\delta_1\approx0.382$。GAE 让终局奖励以折扣形式传回前面的 token；实际实现还需明确 EOS、终止态、截断和 bootstrap value 的处理。

因此，PPO-RLHF 常同时涉及 policy、reference、RM 和 critic 四种角色。省掉 critic 会减少价值模型的训练开销，但不等于 rollout、reference log-prob 或 reward 计算成本消失。长回答的信用分配、RM 过优化和生成—训练概率不一致仍需独立诊断。

### 3.2 DPO：用偏好对直接更新策略

DPO 从 KL 约束下的最优策略推导隐式奖励，再把它代入偏好模型，使奖励差转为策略与 reference 的对数概率差。给定固定 prompt $x$，KL 正则化奖励最大化问题的最优策略具有形式：

$$
\pi^*(y|x)=\frac{1}{Z(x)}\pi_{\mathrm{ref}}(y|x)\exp\!\left(\frac{r(x,y)}{\beta}\right)
$$

取对数并整理，可将奖励表示为最优策略相对 reference 的 log-ratio（加上只依赖 prompt 的归一化常数）。同一 prompt 的 chosen $y_w$ 与 rejected $y_l$ 做奖励差时，常数相消；代入 Bradley–Terry 偏好概率后得到：

$$
\mathcal{L}_{\mathrm{DPO}} = -\mathbb{E}_{(x,y_w,y_l)}\left[\log \sigma\!\left(\beta\left[\log\frac{\pi_\theta(y_w|x)}{\pi_{\mathrm{ref}}(y_w|x)}-\log\frac{\pi_\theta(y_l|x)}{\pi_{\mathrm{ref}}(y_l|x)}\right]\right)\right]
$$

当模型提高 chosen 相对 reference 的概率、同时降低 rejected 的相对概率时，括号内的偏好 logit 增大，损失下降。$\beta$ 控制偏好 logit 对策略偏移的敏感程度；它与 PPO 中 KL 系数的实现位置不同，数值不能直接互换。DPO 不需要单独训练 RM，也不需要训练期间在线 rollout；代价是策略更新受离线偏好数据覆盖限制，模型无法从当前策略的新采样中主动发现未出现在固定偏好对中的行为。[DPO 论文](https://arxiv.org/abs/2305.18290)

“DPO 不需要奖励模型”应理解为训练目标不需要单独训练并调用一个 reward model 来提供更新信号，不是说偏好信息或隐含奖励概念消失了。DPO 仍依赖 reference policy 和偏好对。

偏好优化的相关变体通常改变数据需求、reference 使用方式或目标约束：IPO 调整偏好目标以减轻某些过度优化行为；KTO 可使用单条回答的 desirable / undesirable 标签而非严格配对；ORPO 将监督似然与偏好项合到一个训练目标；SimPO 使用无 reference 的隐式奖励构造；R-DPO 一类方法显式处理回答长度偏差。名称相近不代表等价，比较时要对照论文的目标、数据标签与 loss reduction，并在同一数据和解码配置下验证。

### 3.3 偏好数据的质量控制

chosen 与 rejected 必须对应相同 prompt 和上下文，且差异应代表目标偏好，而不是只反映长度、语气或格式。标注规范应规定平局、不可比较样本、标注者分歧、多轮历史、拒答、引用和工具轨迹的处理。通过随机交换候选展示顺序测量位置偏差，并按 prompt 来源切分训练集与验证集。

RM 需要检查排序准确率、分数校准、跨领域泛化与对抗稳健性，不能把 RM 分数当作答案质量的绝对刻度。常见失效包括偏好差异过于简单、模型依赖冗长或礼貌等表面信号、优化后 RM 分数上涨而盲评下降，以及不同领域或长度上的系统偏差。多 RM 集成、不确定度估计、独立 verifier 和定期重标注可降低风险，但会增加推理和维护成本。

### 3.4 离线偏好优化与在线 RL 的区别

DPO 使用固定的偏好对，训练期间不必不断调用当前策略生成新回答；因此，成败很大程度取决于偏好数据对部署分布的覆盖，以及策略更新是否离开数据支持区域。在线 RL 可基于新策略继续生成并评分，能改善分布匹配，但需要可靠 verifier 或 reward、足够的有效 rollout 吞吐和稳定的更新控制。

方法选择应明确以下条件：

1. 反馈来源：人类比较、规则判定、环境奖励还是教师答案？
2. 反馈粒度：整条回答一个分数，还是步骤、工具动作和子目标分别打分？
3. 探索价值：新策略采样能否发现训练数据中没有的更好行为？
4. 判定可靠性：评分错误是否能独立审计，错误奖励能否被策略快速放大？
5. 更新成本：生成、评分和训练的总成本，是否换来独立评测上的改善？

若反馈不可靠，增加 rollout 数通常只会更快优化错误目标；若任务由示范即可覆盖，在线 RL 也可能没有足够收益抵偿系统成本。

## 四、推理训练与 RLVR

### 4.1 GRPO 与可验证奖励

GRPO 对同一个 prompt $x$ 从旧策略采样 $G$ 条回答 $y_1,\ldots,y_G$，由 verifier 或 reward model 得到整条回答的回报 $R_i$。组内相对 advantage 常写为：

$$
\bar R=\frac{1}{G}\sum_{j=1}^{G}R_j,\qquad
\hat A_i=\frac{R_i-\bar R}{\mathrm{std}(R_1,\ldots,R_G)+\varepsilon}
$$

同一回答中的 token 共用 $\hat A_i$。令 $\rho_{i,t}(\theta)$ 为新旧策略在第 $t$ 个 token 上的概率比，典型 clipped 目标为：

$$
\mathcal{J}_{\mathrm{GRPO}}(\theta)=\mathbb{E}\left[\frac{1}{G}\sum_{i=1}^{G}\frac{1}{|y_i|}\sum_{t=1}^{|y_i|}\min\!\left(\rho_{i,t}\hat A_i,\,\mathrm{clip}(\rho_{i,t},1-\epsilon,1+\epsilon)\hat A_i\right)\right]
$$

GRPO 以组内比较替代独立 critic 的价值估计，因此省去一套需要反向训练的价值模型；但每个 prompt 要采样多条回答，rollout、奖励计算和长回答的 token 成本仍然存在。GRPO 由 DeepSeekMath 提出，原论文将其描述为 PPO 变体。[DeepSeekMath 论文](https://arxiv.org/abs/2402.03300)

若某个 prompt 的回答奖励全相同，中心化后该组 advantage 都为零（标准差接近零时还要处理数值稳定性），组内比较就没有学习信号。对于二值正确性奖励，整组全对和整组全错都属于这种饱和组。相反，若 verifier 有漏洞，组内相对排名也会强化投机行为。因此，GRPO 的有效性既取决于优化目标，也取决于组内奖励是否有区分度。

一个二值奖励例子：对同一题采样 4 条回答，奖励为 $(1,0,1,0)$，均值为 $0.5$、标准差为 $0.5$，标准化后的 advantage 为 $(+1,-1,+1,-1)$。正 advantage 提高两条正确回答中的生成 token 概率，负 advantage 降低两条错误回答的 token 概率。若组内奖励为 $(0,0,0,0)$，则标准差为零且没有可区分方向；加数值 epsilon 只能避免除零，不能创造学习信号。

### 4.1.1 GRPO 与 RLVR 是两个不同维度

GRPO 说明如何使用一组回答构造更新信号；RLVR（Reinforcement Learning with Verifiable Rewards）说明奖励如何获得。数学答案解析、代码测试、定理证明器、结构化约束校验都可作为 verifier。评分器需要对正确性或任务完成有足够覆盖，且错误判分能够被独立审计。规则可执行不代表规则完整：漏掉边界条件的单测仍可能奖励错误程序，答案解析器也可能拒绝数学等价形式。

| 任务 | 常见 verifier | 主要盲点 |
| --- | --- | --- |
| 数学 | 符号化简、答案解析、数值等价检查 | 表达等价、单位、格式、猜测命中 |
| 代码 | 编译、公开/隐藏单测、资源与安全限制 | 测试覆盖不足、硬编码、环境差异 |
| 工具或 Agent | 环境状态变化、任务完成条件、结果校验 | 模拟器偏差、外部状态不稳定、奖励延迟 |
| 开放文本 | rubric、人工比较、校准后的 LLM judge | 主观分歧、评审偏差、风格投机 |

结果奖励（ORM）只评估最终答案，判据直接但长轨迹的信用分配较弱；过程奖励（PRM）对中间步骤或动作评分，反馈更密集，却增加标注成本和过程投机风险。选择粒度时应验证新增反馈能否提高独立任务成功率，而不是只提高 reward model 分数。

DeepSeek-R1-Zero 展示了不先做 SFT、直接通过大规模 RL 激发推理行为的实验路径；DeepSeek-R1 则加入冷启动数据与多阶段训练，以改善可读性和语言混杂等问题。报告中的配方包括冷启动示范、推理 RL、拒绝采样后的 SFT，以及面向其他行为目标的后续 RL 阶段。它说明训练可在监督与在线 RL 间往返，不代表“纯 RL 一定优于 SFT”。[DeepSeek-R1 论文](https://arxiv.org/abs/2501.12948)

可以把该类推理模型流程概括为：冷启动示范先提供可读的推理格式；可验证任务上的 RL 提升解题策略；拒绝采样筛选较好轨迹并做 SFT，把行为扩展到更多领域；后续 RL 再优化有帮助性、安全性和语言一致性等目标。之后可用强教师的回答或推理轨迹蒸馏小模型。每一步都改变数据分布和监督来源，因此要保留各阶段 checkpoint、数据版本和独立评测，不能只看最终 RL reward。

### 4.2 DAPO、Dr. GRPO 与 GSPO

这三种方法针对不同失效机制改动 GRPO 类目标。为便于比较，令 $\rho_{i,t}=\pi_\theta(y_{i,t}|x,y_{i,<t})/\pi_{\theta_{\mathrm{old}}}(y_{i,t}|x,y_{i,<t})$。$\hat A_i$ 是基于组内回报的回答级优势；每篇论文对 advantage 标准化、loss reduction 和 clipping 的定义要结合公式与代码核对。

#### DAPO：探索、有效样本与长回答的组合改动

DAPO（Decoupled Clip and Dynamic Sampling Policy Optimization）在长 CoT、可验证奖励任务中提出四项主要机制，并开放训练代码与数据。其基础目标对组内所有有效回答 token 做全局 token 平均，而非先对每条回答取均值再平均：

$$
\mathcal{J}_{\mathrm{DAPO}}(\theta)=\mathbb{E}\!\left[\frac{1}{\sum_i|y_i|}\sum_{i=1}^{G}\sum_{t=1}^{|y_i|}\min\!\left(\rho_{i,t}\hat A_i,\,\mathrm{clip}(\rho_{i,t},1-\epsilon_{\mathrm{low}},1+\epsilon_{\mathrm{high}})\hat A_i\right)\right]
$$

相对 GRPO 的回答级平均，这种 reduction 让 token 整体等权，长回答包含的 token 对总更新贡献更大。该选择有利于学习长正确轨迹中的推理模式，也会让长低质量轨迹的 token 对梯度产生更大影响，因此需要与奖励质量、长度分布及截断策略一起分析。

1. **Clip-Higher：上下限解耦。** 普通对称 clipping 会同样限制正向概率比上界。DAPO 将 $\epsilon_{\mathrm{low}}$ 与 $\epsilon_{\mathrm{high}}$ 分开，并适当放宽上界，使低概率但有正 advantage 的探索 token 有更大上升空间；下界保持约束以避免负 advantage 轨迹被过度压低。它处理的是探索受限与熵过早下降，不保证熵永远维持在高位。
2. **Dynamic Sampling：过滤无区分组并补足有效 batch。** 对二值验证奖励，全对组和全错组的组内 advantage 都缺少区分信号。训练系统过采样 prompt，过滤正确率为 0 或 1 的组，再继续生成直到有效 batch 填满。它提升有效梯度样本比例，但会改变参与更新的 prompt 分布；若题目难度、重试次数或超时样本分布不同，应记录采样概率与成本。
3. **Token-Level Policy Gradient Loss：改为全局 token 平均。** 其核心是把分母从“回答数 × 每条回答内 token 平均”改为 batch 中有效 response token 总数。结果是不同长度轨迹对梯度的权重不同于 sample-level GRPO；比较实验必须固定分母、mask 和回答长度处理。
4. **Overlong Reward Shaping：区分截断与接近上限。** 直接把所有被截断的回答都判错，会将“推理正确但超过预算”和“推理错误”混为一谈。DAPO 报告了对截断样本过滤 loss，以及在最大长度附近逐渐增加惩罚的 Soft Overlong Punishment。以回答长度 $|y|$、最大长度 $L_{\max}$ 和惩罚缓冲区 $L_{\mathrm{cache}}$ 表示，其长度项为：

$$
R_{\mathrm{length}}(y)=\begin{cases}
0,&|y|\le L_{\max}-L_{\mathrm{cache}}\\
\dfrac{(L_{\max}-L_{\mathrm{cache}})-|y|}{L_{\mathrm{cache}}},&L_{\max}-L_{\mathrm{cache}}<|y|\le L_{\max}\\
-1,&|y|>L_{\max}
\end{cases}
$$

中间区间的惩罚从 0 线性下降到 -1，再与任务奖励组合；这给模型一个接近预算上限时逐步收束的信号。奖励符号、tokenization 后的长度定义、超长样本 mask 和终止 token 处理都属于复现配置。[DAPO 论文](https://arxiv.org/abs/2503.14476)

#### Dr. GRPO：去除两类特定归一化偏差

Dr. GRPO（Group Relative Policy Optimization Done Right）分析了常见 GRPO 实现中的两项 response/question 权重。其基线目标含有每个回答的 $1/|y_i|$，并用组内奖励标准差归一化 advantage：

$$
\hat A_i^{\mathrm{GRPO}}=\frac{R_i-\bar R}{\mathrm{std}(R_1,\ldots,R_G)},\qquad
\mathcal{J}_{\mathrm{GRPO}}\propto\frac{1}{G}\sum_i\frac{1}{|y_i|}\sum_t \ell_{i,t}
$$

第一项按回答长度给 token 梯度重新加权：正 advantage 下，较短回答的每 token 权重更大；负 advantage 下，较长错误回答的惩罚被稀释。第二项让不同 prompt 的组内标准差成为权重：奖励方差较小的题可能被放大，题目难度也会影响更新贡献。

Dr. GRPO 移除这两个随回答或 prompt 变化的归一化项，使用中心化回报作为 advantage，并用固定常数（例如生成预算 $L$）归一化 token loss：

$$
\hat A_i^{\mathrm{Dr}}=R_i-\bar R,\qquad
\mathcal{J}_{\mathrm{Dr.GRPO}}(\theta)=\mathbb{E}\!\left[\frac{1}{G L}\sum_{i=1}^{G}\sum_{t=1}^{|y_i|}\min\!\left(\rho_{i,t}\hat A_i^{\mathrm{Dr}},\,\mathrm{clip}(\rho_{i,t},1-\epsilon,1+\epsilon)\hat A_i^{\mathrm{Dr}}\right)\right]
$$

$L$ 是固定尺度，不随每条回答的实际长度改变；实现时仍须定义 padding mask、被截断序列和有效 token 的处理。论文所谓“unbiased”针对其分析的策略梯度目标与估计方式，不等于所有数据、奖励、裁剪和 loss 聚合下都无偏，也不代表所有 prompt 得到完全相同的任务价值。该方法旨在避免特定归一化带来的长度和组间偏差，并观察回答 token 效率与错误答案长度变化。[Dr. GRPO 论文](https://arxiv.org/abs/2503.20783)

#### GSPO：以回答为单位做重要性校正和裁剪

GRPO 常用 token-level importance ratio，而结果奖励通常作用于整条回答。GSPO（Group Sequence Policy Optimization）据此把 ratio 与 clipping 单位改为序列。序列概率是 token 概率的乘积；论文使用其长度归一化的几何平均比率，避免长序列的乘积数值极端：

$$
s_i(\theta)=\left(\frac{\pi_\theta(y_i|x)}{\pi_{\theta_{\mathrm{old}}}(y_i|x)}\right)^{1/|y_i|}
=\exp\!\left(\frac{1}{|y_i|}\sum_{t=1}^{|y_i|}\log\rho_{i,t}\right)
$$

随后对每条回答只计算一个 clipped surrogate：

$$
\mathcal{J}_{\mathrm{GSPO}}(\theta)=\mathbb{E}\!\left[\frac{1}{G}\sum_{i=1}^{G}\min\!\left(s_i(\theta)\hat A_i,\,\mathrm{clip}(s_i(\theta),1-\epsilon,1+\epsilon)\hat A_i\right)\right]
$$

在不考虑 clipping 分段的梯度表达式中，序列比率的对数导数是 token log-prob 梯度的平均。因此一个回答的 token 共享序列级权重；GRPO 则分别用每个 token 的 ratio 加权。GSPO 的归一化 ratio 和 token ratio 的取值尺度不同，clip 范围也可能相差多个数量级，不能复用 GRPO 的 clipping 超参。

论文重点讨论 MoE：训练更新后专家路由可能变化，逐 token 概率比会受 token 路由变化影响而波动；序列级 ratio 汇总 token log-prob 变化，实证上改善了 MoE RL 稳定性，并减少对 Routing Replay 等额外路由回放机制的依赖。它仍需要检查 sequence ratio 分布、长度分桶下的 clipping 比例、策略滞后及奖励质量。论文还给出 GSPO-token 变体：保持 sequence-level ratio 数值，同时允许 token-specific advantage，适用于多轮任务需要细粒度 credit assignment 的情况。[GSPO 论文](https://arxiv.org/abs/2507.18071)

| 维度 | DAPO | Dr. GRPO | GSPO |
| --- | --- | --- | --- |
| 主要诊断 | 探索受限、无效组、长回答 loss 权重与超长截断噪声 | 回答长度归一化和组标准差归一化带来的特定偏差 | token ratio 在长回答及 MoE 路由变化下不稳定 |
| ratio / 聚合 | token ratio；batch 有效 token 全局平均 | token ratio；固定预算尺度，不按实际回答长度除 | 长度归一化 sequence ratio；按序列裁剪 |
| 数据处理 | 可过滤全对/全错组并动态补样 | 不以动态采样为核心机制 | 不以动态采样为核心机制 |
| 关键监控 | 有效组比例、长度、熵、超长率、样本来源 | 正确/错误回答长度、各 prompt 梯度权重与 token 效率 | sequence ratio、裁剪率、MoE expert/routing 稳定性 |

这些方法不是按发布时间排列的单向替代关系。DAPO 是一组配合长推理 RL 的数据采样与优化选择；Dr. GRPO 针对 GRPO 具体归一化项分析长度和组间权重；GSPO 改变 importance correction 与 clipping 粒度。效果取决于奖励类型、loss reduction、长度分布、生成后端和任务。比较时应固定基座、prompt、奖励、采样数、最大长度和 learner 配置，再分别消融每个改动。

### 4.3 变体比较的设计轴

不同 RLVR 变体的差异主要落在四个设计轴上：

1. 权重粒度：每 token 独立 ratio，还是整条 response 共享 sequence ratio。
2. 长度聚合：按 response 平均、按所有 token 平均，或不按长度归一化。不同口径会重新分配长短轨迹的梯度权重。
3. 样本筛选：是否过滤同组全对/全错样本、动态重采样或基于难度调度。
4. 截断与奖励 shaping：长度上限附近如何惩罚，截断回答算失败还是部分有效。

Dr. GRPO 的“unbiased”指其论文所分析目标下移除特定归一化偏差，并非所有训练设置都无偏。后续理论分析也指出，在 outcome-reward 设定下，梯度无偏与轨迹贡献长度不变一般不能同时满足；比较长度归一化时，需要先说明优化目标，而不是仅凭“无偏”标签判断优劣。[关于无偏与长度不变性的后续分析](https://arxiv.org/abs/2607.23364)

方法比较应固定模型、prompt 集、奖励、rollout 数、最大长度和生成后端，再做单组件消融。若一次同时换 verifier、length normalization、采样温度、奖励 shaping 和优化器，就无法归因提升来源。

## 五、Agent 后训练：工具交互与环境轨迹

### 5.1 轨迹与环境定义

工具使用至少包含三种可分开评估的能力：**格式**——按工具协议产生合法调用；**时机与选择**——判断是否需要调用、选哪一个工具、参数填什么；**结果利用**——读取工具返回，决定回答、修正参数、重试或继续调用。格式通常可用 SFT 学习；调用决策依赖正反例和任务成本；结果利用需要真实、完整的交互轨迹。

轨迹需保存 prompt、工具 schema、assistant 消息、结构化 action、工具 observation、环境状态、时间戳、策略版本、错误码和终止原因。工具调用是模型 action，工具返回是环境 observation；若只保存最终答案，就丢失了学习多步决策与错误恢复所需的监督。环境应定义动作空间、可见状态、超时和失败规则、奖励归因以及 episode 终止条件。

工具协议可采用 JSON/JSON Schema、XML 或专用控制 token。训练时必须固定 chat template 和 token 边界，确保工具定义与调用历史进入上下文；推理时可用 grammar 或 schema constrained decoding mask 掉不合法 token。SFT 学会“会输出”，受约束解码负责在指定语法下保证“输出合法”，二者作用不同。工具 description 是模型判断工具用途、选择接口和填写参数的重要上下文，描述含混会直接转化成调用错误。

受约束解码在每个生成步维护当前语法状态，把无法到达合法终态的 token logits 置为 $-\infty$，再仅在合法 token 集合中采样。正则可编译为 DFA，CFG 可由解析器维护状态栈，JSON Schema 可转成相应文法；工程上需要处理字符与 tokenizer token 边界，并缓存每种状态下允许的 token。它能强制语法合法，不能保证工具选择正确、参数语义正确或任务成功。

一条代码修复轨迹应记录“运行测试 → 读取错误 → 检查源码 → 修改 → 重跑测试 → 汇报结果”。每次工具调用都需要环境结果支撑下一步，而不是把理想化的工具调用过程当成真实成功轨迹。

### 5.2 调用时机、奖励与轨迹数据

调用时机是决策问题：过少调用会在缺少实时信息或执行能力时猜测；过多调用增加延迟、成本和失败面。训练集要同时包含需要调用与可直接回答的任务，也要构造“看起来像需要工具，但答案已在上下文中”的负样本，避免模型学到逢问必调。

可对最终任务成功、工具选择、参数正确、结果利用、无效调用次数和成本分别计分。对多余调用施加成本项时，可将目标写成：

$$
R(\tau)=R_{\mathrm{task}}(\tau)-\lambda_{\mathrm{call}}N_{\mathrm{unnecessary}}(\tau)-\lambda_{\mathrm{cost}}C(\tau)
$$

该式表达取舍而非通用奖励配方：调用惩罚过大可能使模型漏调，过小则容易 over-calling；参数错误、工具超时、权限拒绝与环境不可用也应区分，避免把系统故障都归咎于策略。

训练数据来源包括人工轨迹、教师模型建议后经真实执行验证的合成轨迹、在线成功轨迹和带错误恢复的失败轨迹。保留前至少做 schema 校验、真实执行、结果利用检查和抽样人工审查；对同一 prompt 的正确轨迹、漏调轨迹和多余调用轨迹，可构造 DPO 偏好对。在线 RL 则可对多步完成结果给稀疏 outcome reward，并使用经过验证的工具步骤信号做辅助奖励。

公开数据构造路线可作方法参考：Toolformer 通过候选 API 调用、真实执行和样本筛选来形成自监督工具数据；API 文档驱动的数据集把自然语言任务映射到接口与参数；多步 Agent 数据则强调在环境中执行并筛选轨迹。自建数据同样应按“任务生成 → 工具真实执行 → 结果检查 → 轨迹清洗 → 版本化”闭环，不应仅靠语言模型判断自己生成的调用是否可用。

失败重试应依赖 observation：将编译错误、HTTP 状态或参数错误放回上下文，训练模型基于信息修正，而非无依据重复调用。异步环境还要记录工具版本、外部数据时间和幂等键，避免重放轨迹时副作用不一致。

### 5.3 任务评测

Agent 任务的评测不能只看最终回答文本。至少应分别报告 schema 合法率、工具选择准确率、参数正确率、必要调用召回率、多余调用率、工具结果利用率、多步任务完成率、无效重试、超时/恢复、安全违规、调用成本和延迟。工具基准可对参数做 AST 或语义比较；代码 Agent 还需真实仓库测试和隐藏测试。结果应按任务难度、工具类型、环境版本与失败原因分桶；若环境不代表真实任务，模型可能只适配模拟器。公开 benchmark 还需排查题目、仓库和测试样例的预训练污染。

### 5.4 轨迹数据质量

Agent 轨迹应记录 observation、action、tool call、tool result、环境状态、错误码、终止原因、策略版本和环境版本。数据要区分真实成功轨迹、修复轨迹、失败轨迹与合成轨迹，避免把不可执行的理想过程误当成真实环境反馈。并行调用、拒绝调用、权限错误和安全停止也要出现在训练分布中。

训练系统可分层兜底：SFT 学轨迹与协议；偏好优化或 RL 学何时调用、如何选择与是否成功；路由器可在高风险场景限制模型可见工具；constrained decoding 保证结构合法；执行器负责权限、超时、重试上限和审计。任何一层都不能代替其余层的评测。

训练工具能力时可按课程逐步增加难度：先学单工具和确定参数，再混入无需调用的任务与相似工具选择，之后训练多轮执行、并行调用、错误恢复和权限拒绝。工具样本占比过高会让模型过度调用或损害直接问答能力，因此应混合通用对话与明确的“不调用”轨迹，并用实际调用成本评估收益。

## 六、奖励设计、评测与实验方法

### 6.1 评测集必须回答具体决策

一个可用的评测体系通常包括训练集、开发集、冻结测试集和上线观察指标。切分应避免同源题目或模板泄漏。指标要覆盖目标能力与潜在退化，例如准确率、任务完成率、拒答准确性、引用正确性、格式解析成功率、推理成本和延迟。整体均值可能掩盖少数关键场景退化，因此需同时看任务切片、难度切片和错误类型。

自动评测适用于有明确答案或可执行检查的任务；LLM judge 能处理开放式质量比较，但需检查评审模型的偏差、提示敏感性和与人工一致性。人工评测要使用盲评、清晰 rubric 和重复标注来估计一致性。只有当专家在给定上下文下能稳定判断答案优劣，偏好优化的监督目标才清晰。OpenAI 的 RFT 指南也建议先建立 eval，并强调任务需有可判分信号、模型已有一定成功率，且 grader 应防止猜测和 reward hacking。[RFT 指南](https://developers.openai.com/api/docs/guides/reinforcement-fine-tuning) [grader 设计指南](https://developers.openai.com/api/docs/guides/rft-use-cases)

### 6.2 奖励分解与 Goodhart 风险

复合 reward 可以由正确性、安全性、格式、成本等子项组成，但每个权重都编码取舍。若长度惩罚过强，模型可能变得过度简短；若拒答奖励设计不当，模型可能过度拒绝；若格式奖励压过内容正确性，输出可能只学会满足 parser。应记录每个子项分数，并抽查高分与低分样本，测试 reward 与独立人工质量指标是否一致。

诊断 reward hacking 的常见办法包括：构造对抗样本、对 verifier 做变形测试、使用未公开测试集、比较多个独立 grader、定期人工审查高奖励样本，以及做 reward 组件消融。防范重点是让训练奖励、验证指标和实际产品目标尽量一致，同时保留模型行为的独立评估。

### 6.3 奖励来源应与任务可判定性匹配

| 任务特征 | 可用反馈 | 典型训练方式 | 需要重点检查 |
| --- | --- | --- | --- |
| 唯一正确答案，机器可判定 | exact match、解析器、单测、定理验证 | SFT + rejection sampling 或 RLVR | 答案格式、测试覆盖、猜测概率、隐藏测试泄漏 |
| 答案开放但可分项 rubric | 分项规则、专家标签、经过验证的 LLM judge | SFT、DPO、RM + PPO/GRPO | rubric 一致性、评审模型偏差、不同维度权重 |
| 偏好主观且多解 | 人类比较、质量排序、安全标注 | DPO、RM + RLHF、RLAIF | 标注者分歧、文化与领域偏差、目标冲突 |
| 多步交互任务 | 环境状态、工具结果、任务完成度、成本 | Agentic SFT、在线 RL、环境反馈 | 环境保真、奖励延迟、工具错误、策略外轨迹 |

“任务可验证”不等于“奖励无误”。单测可能没覆盖隐藏边界；数学答案解析可能把等价表达判错；grader 可能只检查格式而漏掉内容；LLM judge 可能偏好自身风格。奖励上线前需执行 mutation test：故意改变模型输出或程序行为，确认评分器会对正确性、安全和约束违例作出预期反应。

### 6.4 稀疏结果奖励与过程奖励

**Outcome reward** 只评估最终答案或任务是否完成，信号定义清晰，比较不容易被中间过程的主观评分污染；但长轨迹中的 credit assignment 较弱。**Process reward** 对中间步骤、动作或子目标给反馈，能更早指出偏差，也会引入更多标注成本、奖励偏差和过程投机。

代码任务可将测试分层：语法/静态检查、公开单测、隐藏单测、集成运行、资源限制和安全检查分别记分。数学任务可区分最终答案验证、推理步骤一致性和格式要求。Agent 任务可拆成子目标完成、工具选择、参数正确、环境状态改变、总时长与成本，但需避免各子项重复计算同一结果。

### 6.5 多目标奖励与标度

复合目标常写为加权和 $R=\sum_k w_k R_k$，其中正确性、安全、格式、成本、长度和用户偏好可能相互冲突。奖励尺度不匹配时，即便某项权重很小，也可能因数值范围更大而主导总奖励。训练前应查看每个子奖励的范围、分布、相关性和梯度贡献；训练中记录子奖励与综合奖励，独立评估未直接纳入优化的安全和能力指标。

奖励归一化、截断、裁剪和动态权重都会改变优化目标。动态调整权重时需记录调度状态；否则同一 reward 曲线跨阶段不可直接比较。对多个目标可分别报告 Pareto 前沿，避免把单一加权总分当成无价值判断的客观排序。

### 6.6 Verifier 的有效学习区间

在线 RL 需要策略既能偶尔成功，也能在采样结果之间产生可区分的奖励。若样本组几乎全错，当前策略可能缺少可强化的成功轨迹；若几乎全对，组内 advantage 接近零，更新信号饱和。可按难度分桶估计 pass@1、组内成功比例、奖励方差和单位 token 的有效梯度样本数，据此调节课程、采样数或 verifier 粒度。

多选题的命中率可能来自随机猜测；短答案可能只给了模型部分奖励捷径。可通过增加干扰类别、要求结构化中间产物、运行隐藏测试、对答案做语义等价检查或使用执行反馈，减少随机猜中带来的虚假梯度。OpenAI 对可编程 grader 的 RFT 指南也强调任务要有可判定性，当前模型应有非零但未饱和的成功空间。[RFT grader 设计](https://developers.openai.com/api/docs/guides/rft-use-cases)

后训练实验应先把目标、测量方式和回滚条件写清楚，再启动长时间训练。一个可以复现的实验记录至少包括：基座与 tokenizer 版本、数据快照及过滤规则、prompt 模板、loss mask、采样参数、奖励/verifier 版本、policy 与 reference 配置、优化器与学习率、序列长度、并行布局、随机种子、代码 commit、checkpoint 和评测器版本。

### 6.7 实验报告的最低要求

一个可信的改进结论需要给出：基线与候选模型、训练数据版本、方法和关键超参数、评测集与指标定义、重复实验或置信区间、分桶结果、回归结果、样例审查、推理成本，以及适用边界。若只报告一个 benchmark 的单次提升，就无法排除采样方差、数据泄漏或过拟合。

### 6.8 消融应隔离变量

实验对照至少保留 base/SFT 起点、当前生产或最强基线、目标方法和必要的消融项。每次改变一个主要因素，例如 verifier、数据混合、KL 系数、response loss 聚合、rollout temperature、采样数或最大长度。需要组合方法时使用小型 factorial 设计，避免把相关因素的效果混在一起。

评测结论应同时展示：

- 目标指标变化及置信区间，报告样本数和评测版本；
- 按难度、领域、语言、长度和工具类型分桶后的变化；
- 通用能力、安全、格式遵循和已有产品任务的回归项；
- 训练 token、rollout 数、GPU 时长、评分调用量与在线推理成本；
- 人工盲评与自动评分的一致性，以及高分失败样本的抽查结果。

对成对模型比较，可固定 prompt 和评测条件，进行盲评或成对胜率比较，并用 bootstrap 估计不确定性。只报告单次平均分会掩盖长尾回归和评测噪声；只报告自动 grader 则会把 grader 的偏差误当作模型提升。

### 6.9 从实验结果到训练决策

- 目标任务上升、通用任务下降：检查数据混合、目标权重、训练步数、KL 和分桶回归；考虑提前停止或回退 checkpoint。
- reward 上升、人工偏好不变：检查 verifier 是否测到代理指标，抽查边际高分样本并扩大独立评测。
- 单个 benchmark 上升、同类任务不变：检查污染、提示词模板依赖和测试集过拟合，使用未见来源的任务复测。
- 平均指标上升、长尾失败恶化：按错误严重性和业务频率重新审视综合分数，不能由平均值覆盖高代价风险。
- 离线评测改善、线上任务不变：检查线上分布、系统提示、工具环境和推理参数是否与训练假设一致。

上线或扩大训练预算的依据应是独立任务质量、回归风险和单位成本的综合变化。遇到目标和副作用冲突时，先明确目标优先级，再调整数据或奖励；仅通过增大某一项奖励权重，可能让冲突更严重。

## 七、训练系统与稳定性

系统与算法岗位都需要按层拆解训练资源：模型参数、梯度、优化器状态、激活值、KV cache / rollout 缓存、通信缓冲区，以及数据与 checkpoint 的 I/O。混合精度、梯度累积、梯度检查点、张量/流水线/数据并行、ZeRO/FSDP、序列并行和高效 attention 各自解决不同瓶颈；方法选择应与测得的瓶颈对应。

在线 RL 的系统可抽象为 rollout workers、reward/verifier workers、trainer、队列与编排器。主要问题包括生成与训练速度不匹配、队列积压、策略版本过期、采样分布漂移、长尾序列拖慢 batch、奖励服务成为瓶颈，以及训练失败后的状态恢复。异步系统还要明确 rollout 使用的 policy version、最大滞后、样本去重与过期策略，必要时考虑 off-policy correction。系统设计需明确数据流、背压、故障恢复、可观测指标和安全发布。

建议熟悉一个可运行的开源后训练栈，例如 Hugging Face TRL 的 SFT、DPO、PPO、GRPO 与 RewardTrainer 接口；但需区分论文定义、框架当前实现和具体配置默认值。开源 trainer 文档可用于核对接口与实现行为，不能替代对算法目标的理解。[TRL 文档](https://huggingface.co/docs/trl/main/quickstart) [PPO Trainer](https://huggingface.co/docs/trl/main/ppo_trainer) [GRPO Trainer](https://huggingface.co/docs/trl/main/grpo_trainer)

### 7.1 在线 RL 的数据流与策略版本

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

### 7.2 Rollout 吞吐与异步更新

系统的有效训练速度不是 `tokens/s` 单指标。可拆成：

$$
\text{有效更新吞吐} = \text{生成 token/s} \times \text{有效轨迹比例} \times \text{评分可用率} \times \text{更新利用率}
$$

长尾回答会导致 batch straggler；高难度 prompt 可能反复采样而耗尽预算；verifier timeout 会降低有效样本率；训练端等待 rollout 造成 GPU 空转。应分别测量生成、评分、排队、梯度更新的 p50/p95 时延，并统计 prompt 到有效 optimizer step 的总时长。

异步系统用旧策略采到的数据更新新策略，需为每条 trajectory 记录 behavior policy version。策略滞后越大，采样分布与当前 learner 分布差异越大；过期样本可以丢弃、限制最大滞后、使用重要性比率修正，或用算法专门处理 off-policy 数据。修正会引入方差；裁剪过强则可能丢掉有效梯度。

### 7.3 Training-Inference Mismatch

生成后端与训练端对同一模型权重、同一 token 序列计算出的 log-prob，应能在容许误差内对齐。以下差异会破坏策略比率：

- sampler 使用的温度、top-p/top-k 与训练端 log-prob 定义不一致；
- serving 和 learner 的 attention kernel、精度、归一化或 logits 处理不同；
- EOS、stop sequence、截断、padding mask 或 chat template 处理不一致；
- rollout 使用的权重版本与元数据记录不一致；
- MoE routing、专家并行和并发调度引入不同的数值行为。

训练崩溃排查前可运行 no-update parity check：固定权重、prompt、生成 token 和 mask，分别计算 sampler 与 learner 的每 token log-prob，统计最大绝对差、均方差和按 token 位置分布的差异。近期研究指出，训练与推理概率不匹配会独立影响 RL 稳定性，不能一概归结为普通浮点噪声。[Training-Inference Mismatch 研究](https://arxiv.org/abs/2605.14220)

### 7.4 显存和计算预算

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

### 7.5 训练问题诊断

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

### 7.6 参数高效微调与能力沉淀

全量微调会更新基座全部参数，优化器状态和梯度开销较高。LoRA 将权重增量限制在低秩分解中：

$$
W'=W+\Delta W=W+BA,\qquad A\in\mathbb{R}^{r\times k},\;B\in\mathbb{R}^{d\times r},\;r\ll\min(d,k)
$$

冻结 $W$，只训练 $A,B$；一些实现用 $\alpha/r$ 缩放增量。训练后可以将 $BA$ 合并到 $W$，因此基础推理结构无需增加 adapter 路径。秩、目标层、学习率、数据量和模块覆盖决定适配能力；LoRA 降低可训练参数，不保证可注入任意新知识，也不自动解决数据偏差和灾难性遗忘。

| 方法 | 改变的对象 | 主要取舍 |
| --- | --- | --- |
| LoRA / Adapter / Prefix tuning | 可训练参数或附加模块 | 降低微调成本；容量与推理结构各有差异 |
| QLoRA | 量化基座加 LoRA 参数更新 | 降低基座权重显存；需关注量化误差和训练稳定性 |
| 拒绝采样微调（RFT） | 先采多个回答，再筛选高质量结果做 SFT | 比在线策略优化简单；筛选器会引入选择偏差 |
| 蒸馏 | 用教师 logits 或生成轨迹监督学生 | 将教师能力转移到小模型；受教师覆盖与轨迹质量限制 |
| 量化 / 剪枝 | 推理权重精度或模型结构 | 主要为部署压缩，需要评估质量、速度和硬件支持 |

蒸馏既可以用硬目标做交叉熵，也可以让学生拟合教师的温度软分布。量化、剪枝和蒸馏更接近模型交付与压缩，不应和 SFT、偏好优化、RL 的监督信号混为同一类算法；但后训练岗位常需要评估训练收益能否在部署预算下保留。

LoRA 的秩 $r$ 控制可表达的增量子空间大小；缩放 $\alpha/r$ 控制注入强度，target modules 决定适配范围，常见选择包括 attention 的 Q/V 或更广的线性层。低秩假设是工程取舍，不保证所有任务的最优更新天然低秩。QLoRA 冻结量化基座并训练 LoRA adapter，显存需求可降，但需记录量化格式、计算精度、梯度检查点与优化器设置。部署压缩时还要区分：量化改变数值精度，剪枝删去参数或结构，蒸馏训练另一个学生模型；可组合使用，但质量损失和硬件加速效果必须实测。

常见辅助方法也应与主目标区分：RFT 先采样并筛选回答，再转成 SFT 数据；RLAIF 用模型或规则生成偏好监督；PRM 为中间推理步骤提供分数，ORM 只给最终结果；拒绝采样和蒸馏将高质量策略行为转为静态训练样本。它们可以出现在同一训练配方中，但各自的监督来源和失败模式不同。

## 八、各家大厂公开岗位要求的侧重

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

## 九、岗位能力地图与复习路径

### 9.1 按职责映射知识点

公开岗位标题不统一，职责描述比 title 更能说明准备重点。下表将常见要求映射为需要掌握的知识和实践能力。

| JD 关键词 | 需要理解 | 可验证的实践能力 |
| --- | --- | --- |
| Post-training / Alignment / Preference | SFT、偏好数据、RM、DPO、PPO、KL 和行为评估 | 解释目标函数选择，分析偏好噪声和策略退化 |
| Reasoning / RLVR / Verifier | GRPO 与相关变体、pass@k、奖励饱和、长度效应 | 实现 verifier、分析全对/全错组，设计数据课程与消融 |
| RL systems / Rollout / Distributed | 生成和 learner 的策略版本、异步队列、并行、显存与通信 | profile 端到端吞吐，定位 log-prob mismatch、长尾和资源争用 |
| Agent / Tool use / Environment | 轨迹结构、工具协议、状态转移、延迟奖励、环境可靠性 | 构建可复现环境，分类任务失败和无效调用，评估成本与安全 |
| Data synthesis / Flywheel | 数据来源、教师生成、筛选、标注质量、污染审计 | 设计过滤与抽样复核，追踪训练样本到评测变化的来源 |
| Safety / Reward model / Rubric | 安全目标、偏好分歧、judge 校准、对抗稳健性 | 设计分项 rubric、构造边界案例并评估 false positive/negative |

跨方向的共同要求是把算法假设变成可复现的实验，并用独立评测解释收益、代价和失败条件。若 JD 同时出现算法和 infra 词汇，应优先梳理算法如何依赖系统实现：例如 rollout 时延会影响策略数据新鲜度，生成参数会影响采样分布，verifier 成本会限制探索预算。

### 9.2 复习顺序

知识点的依赖关系可以按以下顺序建立：

1. Transformer 自回归建模、交叉熵、概率统计、优化器和 PyTorch 训练基础。
2. SFT 数据管线、模板和 loss mask，建立行为监督与验证集的概念。
3. 偏好建模、Bradley–Terry RM、KL 正则和 PPO-RLHF 的组件关系。
4. DPO 推导与限制；再比较 GRPO、RLVR、rejection sampling 和蒸馏的监督来源与成本。
5. 奖励设计、评测和错误分析，理解训练分数为什么可能与模型质量脱节。
6. 按岗位方向补充分布式 RL、Agent 环境、多模态后训练、生产监控或业务数据闭环。

基础知识与岗位侧重点应结合阅读：SFT/RM/RL 属于算法共同底座；若岗位写到 RL systems、Verl、并行或 NCCL，则需进一步掌握系统剖析；若写到 rubric、verifier、Agent environment 或 data flywheel，则优先补奖励判定、环境和数据回流设计。

### 9.3 核心知识点速查

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
