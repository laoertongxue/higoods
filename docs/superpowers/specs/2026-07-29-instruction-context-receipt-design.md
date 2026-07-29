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
- 每个来源在验证时的内容哈希。
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
  sources[]
    path
    contentHash
  triggeredChecks[]
```

字段含义：

- `taskBoundary`：操作者提供的一句话任务范围，去除首尾空白后必须非空。
- `sources[].path`：相对工作区的 POSIX 路径。首版只接受名称为 `AGENTS.md` 的项目内文件。
- `sources[].contentHash`：对应文件内容的 SHA-256。
- `triggeredChecks`：从最终 `route.fastChecks`、`route.governanceChecks` 和 `route.fullChecks` 合并、去重后得到的命令集合。

来源按路径排序，检查按现有路由输出顺序记录，保证结果稳定。

## 命令接口

`workflow:verify` 增加两个参数：

```text
--task-boundary "<任务边界>"
--instruction-sources "AGENTS.md[,子目录/AGENTS.md]"
```

规则：

- `--task-boundary` 必填。
- `--instruction-sources` 默认值为仓库根目录的 `AGENTS.md`。
- 显式来源使用英文逗号分隔。
- 每个来源必须存在、可读取、位于当前工作区内且文件名为 `AGENTS.md`。
- 首版不自动向父目录递归发现指令，避免把未确认的文件错误纳入权威范围。

`workflow:deliver` 和 `workflow:accept` 不增加参数；它们在升级状态前重新验证收据中的指令来源和内容哈希。

## 验证流程

`workflow:verify` 按以下顺序执行：

1. 解析最终变更路径并生成受影响检查路由。
2. 解析任务边界与指令来源。
3. 读取指令文件并生成内容哈希。
4. 执行路由要求的检查。
5. 同步并检查 CodeGraph。
6. 重新计算最终 Git revision。
7. 创建任务收据并校验：
   - 任务边界非空。
   - 至少有一个有效的 `AGENTS.md` 来源。
   - 来源仍位于工作区且当前哈希与记录一致。
   - `triggeredChecks` 与路由要求的命令集合完全一致。
   - 最终 revision、检查、CodeGraph 和阶段轨迹满足现有规则。

任一条件失败时，收据保持 `implemented` 并写入明确 blocker。

`workflow:deliver` 和 `workflow:accept` 除现有 Git revision 校验外，再次检查指令上下文。指令文件内容发生变化时，即使业务差异未变化，也不能升级状态，必须重新执行 `workflow:verify`。

## 兼容边界

- 新生成的收据一律使用结构版本 2。
- `deliver` 和 `accept` 对结构版本 1 收据失败关闭，要求重新验证；不静默补造指令证据。
- 不修改 `check:affected` 的路径映射。
- 不复制指令正文到收据。
- 不处理用户级、插件级或工作区外的指令文件。
- 不改变现有远端交付和接受证据规则。

## 测试设计

先增加失败测试，再实现生产代码：

1. 当前 `AGENTS.md`、非空任务边界和准确检查集合可以生成 `verified` 收据。
2. 空任务边界阻止进入 `verified`。
3. 缺少来源、来源越界、非 `AGENTS.md` 来源或不存在来源均失败关闭。
4. 指令内容哈希变化会使收据失效。
5. `triggeredChecks` 缺失、多出或顺序之外的重复内容不能通过。
6. 结构版本 1 收据不能升级为 `delivered` 或 `accepted`。
7. 最终 Git revision 变化仍按现有规则使收据失效。
8. CLI 验证结果包含任务边界、来源哈希和路由检查。

回归验证继续运行：

- `npm run test:workflow-governance`
- `npm run build`
- `codegraph sync`
- `codegraph status`

## 交付验收

选择本次治理改动自身作为真实受控任务：

- 使用批准后的任务边界和根 `AGENTS.md` 运行 `workflow:verify`。
- 收据必须达到 `verified`，并可恢复任务边界、指令来源、内容哈希、触发检查、CodeGraph 和阶段轨迹。
- 创建 PR，经规格审查和代码质量审查后合并。
- 远端目标引用精确指向验证版本后升级到 `delivered`。
- 授权用户以包含精确 SHA 的评论明确验收后升级到 `accepted`。

完成后再执行前向 Better Harness 审计，比较冻结窗口与本次真实任务的证据差异。
