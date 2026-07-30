# 任务收据指令上下文设计

## 背景

项目当前已经能够把最终 Git 版本、受影响检查、CodeGraph 状态、Superpowers 阶段轨迹、远端交付和接受证据写入同一份任务收据。但是，收据不能回答以下问题：

- 任务执行时适用了哪一份 `AGENTS.md`。
- 本次任务的边界是什么。
- 哪些检查由项目规则和实际改动共同触发。
- 指令文件在验证后发生变化时，原收据是否仍然有效。

因此，现有机制只能证明项目中存在规则，不能证明规则实际进入某个任务的执行闭环。

## 目标

在现有任务收据内增加一份小型、可验证的指令上下文，使真实任务能够恢复：

- 明确的任务边界。
- 适用的项目级 `AGENTS.md` 来源。
- 该来源在验证时的内容哈希。
- 根据最终改动计算出的受影响检查。
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
  triggeredChecks
    derivation
    commands[]
```

字段含义：

- `taskBoundary`：操作者提供的一句话任务范围，去除首尾空白后必须非空。
- `source.path`：固定为仓库根目录的相对 POSIX 路径 `AGENTS.md`。
- `source.algorithm`：固定为 `sha256`。
- `source.contentHash`：对 `AGENTS.md` 原始文件字节计算的 SHA-256，不做换行或字符编码归一化。
- `triggeredChecks.derivation`：固定为 `affected-check-route`，明确检查来自现有受影响检查路由，而不是对 AGENTS 正文做语义解析。
- `triggeredChecks.commands`：从最终 `route.fastChecks`、`route.governanceChecks` 和 `route.fullChecks` 合并、去重后得到的命令集合。

检查按现有路由输出顺序记录，保证结果稳定。

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
3. 确认 `instructionContext`、任务边界、根指令来源、哈希算法、哈希值和触发检查结构完整。
4. 确认其余现有收据字段满足运行时所需的最小结构。
5. 完成解析后才允许进行 Git revision、指令时效或远端 provider 核验。

结构版本 1、缺字段或畸形收据必须在调用 GitHub API 前失败关闭。

## 验证流程

`workflow:verify` 按以下顺序执行：

1. 解析最终变更路径并生成受影响检查路由。
2. 解析任务边界并锁定根 `AGENTS.md`。
3. 通过 `realpath` 校验来源边界，读取原始字节并生成内容哈希。
4. 执行路由要求的检查。
5. 同步并检查 CodeGraph。
6. 重新计算最终 Git revision。
7. 创建任务收据并校验：
   - 任务边界非空。
   - 根 `AGENTS.md` 来源有效且没有通过符号链接逃逸。
   - 来源当前原始字节哈希与记录一致。
   - `triggeredChecks.derivation` 为 `affected-check-route`。
   - `triggeredChecks.commands` 与路由要求的命令集合完全一致。
   - 最终 revision、检查、CodeGraph 和阶段轨迹满足现有规则。

任一条件失败时，收据保持 `implemented` 并写入明确 blocker。

`workflow:deliver` 和 `workflow:accept` 除现有 Git revision 校验外，再次检查指令上下文。指令文件内容发生变化时，即使业务差异未变化，也不能升级状态，必须重新执行 `workflow:verify`。

## 隔离工作树的 CodeGraph 前置条件

任务在 linked worktree 中执行时，最终收据不能复用主工作区的 CodeGraph 索引。实现计划必须在开始最终验证前执行：

```bash
codegraph init -i
codegraph sync
codegraph status
```

只有 `projectPath` 指向当前隔离工作树、`worktreeMismatch` 为 false 且待同步文件为 0 时，才能运行最终 `workflow:verify`。CLI 不自动初始化索引，避免在普通验证命令中隐式创建基础设施。

## 兼容边界

- 新生成的收据一律使用结构版本 2。
- `deliver` 和 `accept` 通过统一运行时解析器对结构版本 1 收据失败关闭，要求重新验证；不静默补造指令证据。
- 不修改 `check:affected` 的路径映射。
- 不复制指令正文到收据。
- 不处理嵌套、用户级、插件级或工作区外的指令文件。
- 不改变现有远端交付和接受证据规则。

## 测试设计

先增加失败测试，再实现生产代码：

1. 当前根 `AGENTS.md`、非空任务边界和准确检查集合可以生成 `verified` 收据。
2. 空任务边界阻止进入 `verified`。
3. 根来源不存在、不可读、路径前缀伪装或符号链接逃逸均失败关闭。
4. 哈希算法不是 `sha256` 或指令原始字节哈希变化会使收据失效。
5. `triggeredChecks.derivation` 不是 `affected-check-route` 时不能通过。
6. `triggeredChecks.commands` 缺失、多出或重复时不能通过。
7. 结构版本 1、缺字段和畸形收据不能升级为 `delivered` 或 `accepted`，且不能触发远端核验。
8. 最终 Git revision 变化仍按现有规则使收据失效。
9. CLI 验证结果包含任务边界、根来源、哈希算法、来源哈希和路由检查。
10. AGENTS 权威命令示例包含必填的 `--task-boundary`。
11. 工作树 CodeGraph 不匹配时仍按现有规则阻止进入 `verified`。

回归验证继续运行：

- `npm run test:workflow-governance`
- `npm run build`
- `codegraph init -i`（仅隔离工作树首次验证）
- `codegraph sync`
- `codegraph status`

## 交付验收

选择本次治理改动自身作为真实受控任务：

- 使用批准后的任务边界和根 `AGENTS.md` 运行 `workflow:verify`。
- 收据必须达到 `verified`，并可恢复任务边界、指令来源、内容哈希、触发检查、CodeGraph 和阶段轨迹。
- 先完成实现、规格审查、代码质量审查及其修复，再执行最终验证；审查收据和最终验证必须绑定同一版本。
- 推送最终验证版本并创建或更新 PR，等待远端必检状态通过。
- GitHub 上的功能分支精确指向验证版本后升级到 `delivered`。
- 授权用户在 PR 中以包含精确 SHA 的评论明确验收后升级到 `accepted`。
- 只有收据达到 `accepted` 后才合并 PR；若合并前发生实质修改，必须从 `workflow:verify` 重新开始。

完成后再执行前向 Better Harness 审计，比较冻结窗口与本次真实任务的证据差异。
