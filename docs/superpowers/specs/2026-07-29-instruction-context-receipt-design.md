# 任务收据指令上下文设计

## 背景

项目当前已经能够把最终 Git 版本、受影响检查、CodeGraph 状态、Superpowers 阶段轨迹、远端交付和接受证据写入同一份任务收据。但是，收据不能回答以下问题：

- 任务执行时适用了哪一份 `AGENTS.md`。
- 本次任务的边界是什么。
- AGENTS 中的适用规则由收据中的哪些现有证据满足。
- 指令文件在验证后发生变化时，原收据是否仍然有效。

因此，现有机制只能证明项目中存在规则，不能证明规则实际进入某个任务的执行闭环。

## 目标

在现有任务收据内增加一份小型、可验证的指令上下文，使真实任务能够恢复：

- 明确的任务边界。
- 适用的项目级 `AGENTS.md` 来源。
- 该来源在验证时的内容哈希。
- AGENTS 适用规则与现有收据证据之间的绑定关系。
- 指令上下文与最终 Git 版本是否仍然同时有效。

本设计不复制 `AGENTS.md` 正文，不新增平行收据，也不引入新的治理命令。

## 方案比较

### 方案一：内嵌到现有任务收据

在 `TaskCompletionReceipt` 中增加 `instructionContext`，由 `workflow:verify` 生成并校验。

优点：

- 与版本、检查、CodeGraph 和交付状态天然处于同一生命周期。
- `deliver` 和 `accept` 可以沿用现有收据时效校验。
- 不增加新的文件协调和状态同步。

缺点：

- 收据结构需要升级版本。

### 方案二：单独生成指令收据

先生成指令收据，再由任务收据引用。

优点：

- 指令采集逻辑表面上更独立。

缺点：

- 形成第二套生命周期。
- 两份收据可能出现版本、路径或更新时间不一致。
- 增加使用成本和故障面。

### 方案三：只写入 Superpowers 阶段轨迹

把 `AGENTS.md` 作为触发阶段的普通证据引用。

优点：

- 改动最小。

缺点：

- 无法验证内容哈希。
- 无法表达任务边界与受影响检查。
- 未要求 Superpowers 的普通任务仍然缺少 AGENTS 执行证据。

选择方案一。它在不增加平行机制的前提下，补齐任务级证据。

## 数据结构

任务收据结构版本升级为 `schemaVersion: 2`，增加：

```text
instructionContext
  taskBoundary
  source
    path
    algorithm
    contentHash
  ruleBindings[]
    ruleRef
    evidenceFields[]
```

字段含义：

- `taskBoundary`：操作者提供的一句话任务范围，去除首尾空白后必须非空。
- `source.path`：固定为仓库根目录的相对 POSIX 路径 `AGENTS.md`。
- `source.algorithm`：固定为 `sha256`。
- `source.contentHash`：对 `AGENTS.md` 原始文件字节计算的 SHA-256，不做换行或字符编码归一化。
- `ruleBindings[].ruleRef`：精确引用当前根 `AGENTS.md` 中的适用章节标题。
- `ruleBindings[].evidenceFields`：引用同一收据中已经存在的证据字段，不复制这些字段的内容。

首版规则绑定固定为：

```text
AGENTS.md::## 12. CodeGraph 使用规则
  -> codegraph

AGENTS.md::### 12.1 任务完成与交付收据
  -> revision, route, checks, codegraph

AGENTS.md::### 12.2 Superpowers 最小阶段轨迹
  -> stageTrace（仅 stageTrace.required 为 true 时）
```

每个 `ruleRef` 对应的章节标题必须存在于当前哈希所代表的 `AGENTS.md` 中。`evidenceFields` 只能使用上述允许值，且对应收据字段必须存在并通过原有校验。规则绑定按 `ruleRef` 排序，证据字段使用上面的固定顺序，保证结果稳定。

`route` 继续作为受影响检查命令的唯一数据来源；`instructionContext` 不重复保存检查命令。

## 命令接口

`workflow:verify` 增加一个参数：

```text
--task-boundary "<任务边界>"
```

规则：

- `--task-boundary` 必填。
- 指令来源固定为当前工作区根目录的 `AGENTS.md`，调用方不能替换或省略。
- 来源必须存在、可读取，且 `realpath` 后仍位于当前工作区内；符号链接不得逃逸到工作区外。
- 本仓库当前只有根级权威指令。嵌套 `AGENTS.md` 的自动发现不在首版范围内，未来出现实际需求时单独设计，不能依赖调用方手工列举。
- 实施时同步更新 AGENTS 第 12.1 节中的权威示例为：

```bash
npm run workflow:verify -- --output <临时目录>/task-receipt.json --task-boundary "<本次任务边界>"
```

`workflow:deliver` 和 `workflow:accept` 不增加参数；它们在升级状态前重新验证收据中的指令来源和内容哈希。

## 运行时解析

新增统一的 `parseTaskCompletionReceipt` 运行时解析入口，`readReceipt`、`deliver` 和 `accept` 不再只依赖 TypeScript 类型断言。

解析顺序：

1. 确认输入是普通 JSON 对象。
2. 确认 `schemaVersion` 精确等于 2。
3. 确认 `instructionContext`、任务边界、根指令来源、哈希算法、哈希值和规则绑定结构完整。
4. 确认其余现有收据字段满足运行时所需的最小结构。
5. 完成解析后才允许进行 Git revision、指令时效或远端 provider 核验。

结构版本 1、缺字段或畸形收据必须在调用 GitHub API 前失败关闭。

## 验证流程

`workflow:verify` 分成前置条件、执行和收口三个阶段。

### 前置条件

在执行任何构建或治理检查前完成：

1. 解析并确认 `--output` 和 `--task-boundary` 非空。
2. 锁定工作区根 `AGENTS.md`。
3. 确认根指令存在、可读取，且 `realpath` 后没有逃逸当前工作区。
4. 确认固定规则绑定所引用的章节标题仍存在。
5. 解析最终变更路径并生成受影响检查路由。

前置条件失败时立即以非零状态退出，不执行检查，也不生成任务收据。

### 执行

1. 采集 `instructionBefore`：根来源路径、算法、原始字节哈希和适用规则绑定。
2. 采集 `revisionBefore`。
3. 执行路由要求的检查。
4. 同步并检查 CodeGraph。
5. 采集 `revisionAfter`。
6. 再次校验根指令来源边界并采集 `instructionAfter`。

### 收口

创建任务收据并校验：

- `instructionBefore` 与 `instructionAfter` 的路径、算法、内容哈希和规则绑定完全一致。
- `ruleBindings` 只引用允许的 AGENTS 章节和收据证据字段。
- 每个被引用的证据字段存在并通过对应的原有校验。
- 最终 revision、检查、CodeGraph 和阶段轨迹满足现有规则。

检查失败、CodeGraph 不健康、最终 revision 变化、指令在执行期间变化或阶段轨迹不完整时，生成状态为 `implemented` 的收据并写入明确 blocker。

前置条件在执行期间失效，例如根 `AGENTS.md` 被删除或变成越界符号链接时，命令以非零状态退出且不得生成结构不完整的收据。

`workflow:deliver` 和 `workflow:accept` 除现有 Git revision 校验外，再次检查指令上下文。指令文件内容或规则章节发生变化时不能升级状态，必须重新执行 `workflow:verify`。

## 隔离工作树的 CodeGraph 前置条件

任务在 linked worktree 中执行时，最终收据不能复用主工作区的 CodeGraph 索引。实现计划必须在开始最终验证前执行：

```bash
codegraph init -i
codegraph sync
codegraph status
```

只有 `projectPath` 指向当前隔离工作树、`worktreeMismatch` 为 false 且待同步文件为 0 时，才能运行最终 `workflow:verify`。CLI 不自动初始化索引，避免在普通验证命令中隐式创建基础设施。

## 能力边界

- 指令上下文证明权威规则来源、任务声明和机器证据之间建立了可恢复绑定，不证明 AI 在认知层面“理解了”指令。
- 规则绑定只引用已有收据证据，不自动判断业务实现是否满足全部语义要求；规格审查、代码质量审查和相关测试仍然必需。
- 现有 Git HEAD、差异指纹和变更路径已经能够发现大多数验证后文件变化。AGENTS 内容哈希的新增价值是明确记录验证时适用的规则版本，并提供直接的指令时效错误，不替代 Git revision 校验。
- 新机制只能为后续真实任务提供前向证据，不能改写冻结窗口里的历史事实。

## 兼容边界

- 新生成的收据一律使用结构版本 2。
- `deliver` 和 `accept` 通过统一运行时解析器对结构版本 1 收据失败关闭，要求重新验证；不静默补造指令证据。
- 不修改 `check:affected` 的路径映射。
- 不复制指令正文到收据。
- 不处理嵌套、用户级、插件级或工作区外的指令文件。
- 不改变现有远端交付和接受证据规则。

## 测试设计

自动测试和真实受控验收分层执行。

### 自动测试

先增加失败测试，再实现生产代码：

1. 非空任务边界、有效根 `AGENTS.md` 和完整规则绑定可以生成 `verified` 收据。
2. 缺少任务边界时在执行任何检查前失败，并且不生成收据。
3. 根来源不存在、不可读、路径前缀伪装或符号链接逃逸时快速失败。
4. 哈希算法不是 `sha256` 或指令原始字节哈希变化会使收据失效。
5. `instructionBefore` 与 `instructionAfter` 不一致时只能生成 `implemented` 收据。
6. 缺少规则绑定、引用不存在章节、绑定未知证据字段或遗漏必需证据字段时不能通过。
7. 未要求阶段轨迹时不生成第 12.2 节绑定；要求阶段轨迹时必须绑定并验证 `stageTrace`。
8. `route` 仍是检查命令的唯一数据来源，指令上下文不复制检查列表。
9. 结构版本 1、缺字段和畸形收据不能升级为 `delivered` 或 `accepted`，且不能触发远端核验。
10. 最终 Git revision 变化仍按现有规则使收据失效。
11. AGENTS 权威命令示例包含必填的 `--task-boundary`。
12. 工作树 CodeGraph 不匹配时仍按现有规则阻止进入 `verified`。

自动测试不启动真实构建、CodeGraph 或 GitHub API；远端核验继续通过注入的 provider probe 测试。

### 真实受控验收

完整 CLI、实际检查、CodeGraph、GitHub 分支和接受评论只在本次真实任务中验证：

- `workflow:verify` 的实际输出包含任务边界、根来源、哈希算法、来源哈希和规则绑定。
- 收据原有 `route` 和 `checks` 包含实际执行的受影响检查。
- 工作树独立 CodeGraph 索引健康。
- `delivered` 和 `accepted` 由真实 GitHub 证据逐级升级。

回归验证继续运行：

- `npm run test:workflow-governance`
- `npm run build`
- `codegraph init -i`（仅隔离工作树首次验证）
- `codegraph sync`
- `codegraph status`

## 交付验收

选择本次治理改动自身作为真实受控任务：

- 使用批准后的任务边界和根 `AGENTS.md` 运行 `workflow:verify`。
- 收据必须达到 `verified`，并可恢复任务边界、指令来源、内容哈希、规则绑定、受影响检查、CodeGraph 和阶段轨迹。
- 先完成实现、规格审查、代码质量审查及其修复，再执行最终验证；审查收据和最终验证必须绑定同一版本。
- 推送最终验证版本并创建或更新 PR，等待远端必检状态通过。
- GitHub 上的功能分支精确指向验证版本后升级到 `delivered`。
- 授权用户在 PR 中以包含精确 SHA 的评论明确验收后升级到 `accepted`。
- 只有收据达到 `accepted` 后才合并 PR；若合并前发生实质修改，必须从 `workflow:verify` 重新开始。

完成后再执行前向 Better Harness 审计，比较冻结窗口与本次真实任务的证据差异。
