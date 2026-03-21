# FCS 统一事实源最终验收报告（最终收口轮）

- 验收时间：2026-03-20
- 审计脚本：`scripts/check-fcs-truth-sources.mjs`
- 冻结规则：`docs/fcs-truth-source-rules.md`、`src/data/fcs/frozen-rules.ts`

## 1. 最终审计概况

- 扫描文件数：69
- 发现问题数：44
- 高风险：0
- 中风险：0
- 低风险：44
- 旧 seed 命中：5（均为兼容快照/兼容导入低风险）
- 自猜逻辑命中：0
- 不稳定 ID 命中：39（均为页面层时间比较/临时 UI 场景低风险）

> 结论：当前 FCS 主链路已达到“可收口状态”。

## 2. 本轮修复项

### 2.1 旧真相源命名与残留收口

- `src/data/fcs/store-domain-progress.ts`
  - 移除 `initialExceptions` 旧命名，统一为 `progressExceptionCases` 内部事实集合。
- `src/data/fcs/store-domain-dispatch-process.ts`
  - 移除 `initialMaterialIssueSheets` 旧命名主导，改为 `legacyMaterialIssueSheetsSnapshot` 兼容快照。
- `src/data/fcs/store-domain-quality-seeds.ts`
  - 移除 `initialDyePrintOrders` 旧命名主导，改为 `legacyDyePrintOrdersSnapshot` 兼容快照。

### 2.2 清理异常链路 fallback / 旧数组直改

- `src/data/fcs/pda-exec-link.ts`
  - 不再直接读写旧异常数组。
  - 改为通过 `listProgressExceptions / getProgressExceptionById / upsertProgressExceptionCase` 统一操作异常事实。

### 2.3 业务对象不稳定 ID 压缩

- `src/data/fcs/progress-exception-lifecycle.ts`
  - `EA/EAL` 事件 ID 从 `Date.now()+Math.random` 改为基于 `caseId + 序号` 的稳定生成。
- `src/data/fcs/material-request-drafts.ts`
  - 物料草稿日志 ID 改为固定前缀 + 顺序号。
- `src/data/fcs/indonesia-factories.ts`
  - 工厂编码生成从随机改为顺序号生成。
- `src/data/fcs/milestone-configs.ts`
  - 节点配置 ID 从时间戳改为稳定顺序号。
- `src/data/fcs/return-inbound-workflow.ts`
  - 入仓流程对象 ID 从随机后缀改为顺序号。
- `src/data/fcs/settlement-change-requests.ts`
  - 变更日志 ID 从随机改为顺序号。

### 2.4 页面低风险收口（不改 UI）

- `src/pages/process-print-orders.ts`
- `src/pages/process-dye-orders.ts`
  - 将状态统计分组改为状态集合映射，移除直接中文状态等值判断命中。
- `src/pages/progress-board.ts`
  - 催办、异常、任务写回审计日志 ID 改为稳定序列（不再使用 `Date.now()` 拼业务日志 ID）。
- `src/pages/progress-urge.ts`
  - 催办审计日志 ID 改为稳定序列（不再使用 `Date.now()` 拼业务日志 ID）。
- `src/pages/production/core.ts`
  - 本地业务日志 ID 改为顺序号形式，减少不稳定业务对象 ID。
  - 染印兼容数据改为按需读取 adapter，避免模块加载期固化旧快照。
- `src/pages/task-breakdown.ts`
  - 清理 `PROC_QC` 旧编码判断残留，统一按任务事实字段判断质检挂接。

## 3. 冻结规则固化结果

已固化并可见：

- `docs/fcs-truth-source-rules.md`
- `src/data/fcs/frozen-rules.ts`
- 核心事实域文件头注释（如 `store-domain-progress.ts`、`store-domain-dispatch-process.ts`）

规则明确：

- 统一事实源类任务只能改数据源、映射层、查询层、状态来源、兼容层、字段绑定。
- 禁止顺手修改页面 UI 与交互。
- 若必须改 UI/交互，必须单独任务提出。

## 4. 仍保留的低风险项（可接受）

- 页面层 `Date.now()` 主要用于：
  - 倒计时/逾期比较
  - 与业务 identity 无关的临时判断
- 兼容层仍保留少量 legacy 命名快照（非主真相源），用于旧 shape 过渡读取。

以上不影响主流程统一事实源，不会把页面回退到旧 seed 主链路。

## 5. 最终结论

- FCS 任务链路、进度/异常链路、兼容层主线已统一到新事实源。
- 高风险和中风险项已清零。
- 剩余低风险项为可控兼容/页面临时逻辑，不影响统一事实源主链路。
- 当前仓库已达到“可收口状态”。

## 6. 任务拆分最终口径（第 6 步收口）

- 执行主体统一为“当前实际执行任务”：未拆分时为原任务，已拆分时为拆分后的平级任务。
- 进度事实、执行异常、领料台账、仓库执行单、PDA 头单与记录均按 execution task 挂载。
- 原始任务在拆分后只用于来源追溯与聚合展示，不再作为执行链路主体。
- `rootTaskNo/splitGroupId/splitFromTaskNo/isSplitResult` 已在进度与台账兼容输出中保留，页面可读拆分来源关系。
