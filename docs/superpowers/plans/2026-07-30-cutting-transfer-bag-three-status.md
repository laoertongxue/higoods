# 裁床中转袋三状态实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将中转袋主状态统一为“空闲、使用中、已报废”，将“菲票已装袋、入仓暂存中、已交出待回收”作为独立流转阶段，并保证 Web、PDA、待交出仓、回收和二维码展示口径一致。

**架构：** 在裁床数据层增加一个小型生命周期判定模块，以已完成的装袋、入仓、交出、回收和报废事实统一派生“主状态＋流转阶段”。现有使用周期内部状态继续承担操作校验和历史兼容，但不能直接作为中转袋主状态展示；所有页面和候选判断统一消费生命周期判定结果。

**技术栈：** Vite、TypeScript、Vanilla TypeScript 字符串模板、Tailwind CSS、本地 Mock/LocalStorage、现有标准列表页组件、Node/tsx 专项检查、Playwright 浏览器验收。

---

## 0. 已确认边界与既有基线

- 设计规格：`docs/superpowers/specs/2026-07-30-cutting-transfer-bag-three-status-design.md`
- 中转袋主状态只有：`空闲`、`使用中`、`已报废`。
- 使用中的流转阶段只有：`菲票已装袋`、`入仓暂存中`、`已交出待回收`。
- 不增加其他中间状态或处理标签。
- 菲票装袋建立袋内菲票事实。
- 中转袋入仓只记录袋号、库区和库位，不再次扫描或绑定菲票。
- 中转袋交出以完整中转袋为最小单位。
- 特殊工艺回仓进入“使用中 / 入仓暂存中”，但保留特殊工艺来源事实。
- 回收差异与报废结论分开；数量或记录差异不得把袋自动判为报废。
- 当前 `npm run check:cutting:all` 存在本任务外基线失败：
  `src/pages/process-factory/cutting/production-order-overview-view.ts` 使用
  `min-w-[2280px]`，被 `check-cutting-clean-mainline` 报告为
  `min-w >= 1600px`。本计划不修改该页面。

## 1. 文件结构与职责

### 创建

- `src/data/fcs/cutting/transfer-bag-lifecycle.ts`
  - 定义唯一的三主状态、三流转阶段、中文元数据和事实派生函数。
  - 提供旧主状态与旧流转文案的兼容归一化，不保存第四种主状态。
- `scripts/check-transfer-bag-three-status.ts`
  - 锁定三主状态、三流转阶段、旧状态兼容、回收差异不报废及跨端文案。
- `docs/prototype-review-records/2026-07-30-cutting-transfer-bag-three-status.md`
  - 记录 Web/PDA 角色、状态、防错、现场动作、分辨率、性能和例外自查。

### 修改

- `package.json`
  - 注册 `check:transfer-bag-three-status`。
- `src/data/fcs/cutting/transfer-bag-runtime.ts`
  - 重点范围：现有运行时阶段与使用周期结构（当前约第 17～120 行）。
  - 在运行时使用周期中保存当前流转阶段；序列化、合并和种子数据统一兼容。
- `src/pages/process-factory/cutting/transfer-bags-model.ts`
  - 重点范围：状态类型、元数据、读取归一化和管理投影（当前约第 134～205、768～877、1080～1270、2718～2965 行）。
  - 把主档类型收口为三个值；投影统一输出 `mainStatus` 与 `flowStage`。
  - 删除管理页面的多状态派生，保留旧值读取兼容。
- `src/pages/process-factory/cutting/transfer-bags-projection.ts`
  - 确保 Web、PDA、二维码及待交出仓共用同一生命周期投影。
- `src/pages/process-factory/cutting/transfer-bag-return-model.ts`
  - 重点范围：回收判定和周期关闭（当前约第 177～238 行）。
  - 回收结果只产生空闲或已报废；差异不再生成报废关闭状态。
- `src/pages/process-factory/cutting/transfer-bags/state.ts`
  - 重点范围：筛选与回收草稿（当前约第 75～223 行）。
  - 列表筛选分成主状态与流转阶段；回收表单去掉多余处理字段。
- `src/pages/process-factory/cutting/transfer-bags/handlers.ts`
  - 重点范围：状态刷新、装袋、入仓、交出与回收动作（当前约第 830～1275、1394～1453 行）。
  - 装袋、入仓、交出、回收分别写入正确事实；主状态由事实统一刷新。
- `src/pages/process-factory/cutting/transfer-bags/list.ts`
  - 重点范围：状态筛选、回收区和列表渲染（当前约第 99～130、1402～1510、1735 行）。
  - 主列表分列展示主状态和流转阶段，筛选项分别只有三个。
- `src/pages/process-factory/cutting/transfer-bags/detail.ts`
  - 重点范围：详情摘要和当前周期展示（当前约第 145～177、725～1080 行）。
  - 详情头部和当前使用页签分层展示状态、阶段和业务记录。
- `src/pages/process-factory/cutting/transfer-bags/dialogs.ts`
  - 回收确认只保留“可继续使用 / 已报废”结果及必要说明。
- `src/pages/process-factory/cutting/warehouse-hub.ts`
  - 待交出仓的装袋、入仓、交出、特殊工艺回仓记录映射到统一阶段。
- `src/pages/process-factory/cutting/wait-handover-web-actions.ts`
  - Web 工作台动作完成后写入对应流转事实，不产生额外主状态。
- `src/pages/pda-cutting-inbound.ts`
  - 重点范围：PDA 袋状态、业务转换和入仓动作（当前约第 20～320 行）。
  - PDA 装袋和入仓 Mock 账改为“主状态＋流转阶段”判断。
- `src/pages/pda-cutting-handover.ts`
  - 重点范围：候选结构、扫码校验和整袋交出（当前约第 70～390 行）。
  - PDA 整袋交出候选只接受“使用中 / 入仓暂存中”。
- `src/pages/pda-transfer-bag-detail.ts`
  - 二维码详情分开显示主状态和当前流转阶段。
- `src/pages/print/templates/label-print-template.ts`
  - 标签/打印展示使用统一中文状态，不输出旧英文状态码。
- `scripts/check-pda-cutting-inbound-workflow.ts`
  - 更新装袋、入仓状态断言和重复操作防错。
- `scripts/check-pda-cutting-transfer-bag-handover.ts`
  - 更新整袋交出候选、成功结果和重复交出断言。
- `scripts/check-web-cutting-transfer-bag-actions.ts`
  - 更新 Web 三动作完成事实与文案断言。
- `scripts/check-transfer-bag-mobile-closed-loop.ts`
  - 更新跨端闭环状态映射。
- `scripts/check-cutting-wait-handover-transfer-bag-flow.ts`
  - 删除旧多状态期望，断言三状态与三阶段完整闭环。
- `scripts/check-cutting-clean-mainline.ts`
  - 只更新中转袋旧状态禁用词；不得修改既有宽表治理规则。

## 2. 统一数据契约

实现时采用以下唯一公开契约：

```ts
export type TransferBagMainStatusKey = 'IDLE' | 'IN_USE' | 'DISABLED'

export type TransferBagFlowStageKey =
  | 'PACKED'
  | 'INBOUND_STORED'
  | 'HANDED_OVER_WAITING_RETURN'

export interface TransferBagLifecycleView {
  mainStatus: TransferBagMainStatusKey
  mainStatusLabel: '空闲' | '使用中' | '已报废'
  flowStage: TransferBagFlowStageKey | null
  flowStageLabel: '菲票已装袋' | '入仓暂存中' | '已交出待回收' | '—'
}
```

事实优先级固定为：

```ts
已报废 > 已关闭且可复用 > 已交出 > 已入仓 > 已装袋 > 无打开周期
```

旧主状态只在读取边界兼容：

```ts
IDLE / REUSABLE                           -> IDLE
IN_USE / DISPATCHED / WAITING_SIGNOFF
/ WAITING_RETURN / RETURN_INSPECTING
/ WAITING_CLEANING / WAITING_REPAIR       -> 按当前使用周期事实派生
DISABLED                                  -> DISABLED
```

禁止把兼容值重新写回主档。

### 任务 1：建立三状态生命周期模块和红灯测试

**文件：**

- 创建：`src/data/fcs/cutting/transfer-bag-lifecycle.ts`
- 创建：`scripts/check-transfer-bag-three-status.ts`
- 修改：`package.json`

- [ ] **步骤 1：注册专项检查命令**

在 `package.json` 的检查脚本区加入：

```json
"check:transfer-bag-three-status": "tsx scripts/check-transfer-bag-three-status.ts"
```

- [ ] **步骤 2：编写失败的生命周期契约检查**

`scripts/check-transfer-bag-three-status.ts` 先导入尚不存在的公开接口：

```ts
import assert from 'node:assert/strict'
import {
  TRANSFER_BAG_FLOW_STAGE_META,
  TRANSFER_BAG_MAIN_STATUS_META,
  deriveTransferBagLifecycle,
  normalizeLegacyTransferBagMainStatus,
} from '../src/data/fcs/cutting/transfer-bag-lifecycle.ts'

assert.deepEqual(Object.keys(TRANSFER_BAG_MAIN_STATUS_META), ['IDLE', 'IN_USE', 'DISABLED'])
assert.deepEqual(
  Object.keys(TRANSFER_BAG_FLOW_STAGE_META),
  ['PACKED', 'INBOUND_STORED', 'HANDED_OVER_WAITING_RETURN'],
)
assert.deepEqual(
  deriveTransferBagLifecycle({ hasOpenCycle: false, disabled: false }),
  { mainStatus: 'IDLE', flowStage: null },
)
assert.deepEqual(
  deriveTransferBagLifecycle({ hasOpenCycle: true, disabled: false }),
  { mainStatus: 'IN_USE', flowStage: null },
)
assert.deepEqual(
  deriveTransferBagLifecycle({ hasOpenCycle: true, packedAt: '2026-07-30 09:00', disabled: false }),
  { mainStatus: 'IN_USE', flowStage: 'PACKED' },
)
assert.deepEqual(
  deriveTransferBagLifecycle({
    hasOpenCycle: true,
    packedAt: '2026-07-30 09:00',
    inboundAt: '2026-07-30 09:30',
    disabled: false,
  }),
  { mainStatus: 'IN_USE', flowStage: 'INBOUND_STORED' },
)
assert.deepEqual(
  deriveTransferBagLifecycle({
    hasOpenCycle: true,
    packedAt: '2026-07-30 09:00',
    inboundAt: '2026-07-30 09:30',
    handedOverAt: '2026-07-30 10:00',
    disabled: false,
  }),
  { mainStatus: 'IN_USE', flowStage: 'HANDED_OVER_WAITING_RETURN' },
)
assert.equal(normalizeLegacyTransferBagMainStatus('WAITING_REPAIR'), 'IN_USE')
assert.equal(normalizeLegacyTransferBagMainStatus('DISABLED'), 'DISABLED')
console.log('check:transfer-bag-three-status lifecycle contract passed')
```

- [ ] **步骤 3：运行检查并确认红灯**

运行：

```bash
npm run check:transfer-bag-three-status
```

预期：FAIL，错误为找不到
`src/data/fcs/cutting/transfer-bag-lifecycle.ts` 或缺少导出。

- [ ] **步骤 4：实现最小生命周期模块**

实现：

```ts
export type TransferBagMainStatusKey = 'IDLE' | 'IN_USE' | 'DISABLED'
export type TransferBagFlowStageKey =
  | 'PACKED'
  | 'INBOUND_STORED'
  | 'HANDED_OVER_WAITING_RETURN'

export const TRANSFER_BAG_MAIN_STATUS_META = {
  IDLE: { label: '空闲' },
  IN_USE: { label: '使用中' },
  DISABLED: { label: '已报废' },
} as const

export const TRANSFER_BAG_FLOW_STAGE_META = {
  PACKED: { label: '菲票已装袋' },
  INBOUND_STORED: { label: '入仓暂存中' },
  HANDED_OVER_WAITING_RETURN: { label: '已交出待回收' },
} as const

export interface TransferBagLifecycleFacts {
  hasOpenCycle: boolean
  packedAt?: string
  inboundAt?: string
  handedOverAt?: string
  disabled: boolean
}

export function deriveTransferBagLifecycle(
  facts: TransferBagLifecycleFacts,
): { mainStatus: TransferBagMainStatusKey; flowStage: TransferBagFlowStageKey | null } {
  if (facts.disabled) return { mainStatus: 'DISABLED', flowStage: null }
  if (!facts.hasOpenCycle) return { mainStatus: 'IDLE', flowStage: null }
  if (facts.handedOverAt) return { mainStatus: 'IN_USE', flowStage: 'HANDED_OVER_WAITING_RETURN' }
  if (facts.inboundAt) return { mainStatus: 'IN_USE', flowStage: 'INBOUND_STORED' }
  if (facts.packedAt) return { mainStatus: 'IN_USE', flowStage: 'PACKED' }
  return { mainStatus: 'IN_USE', flowStage: null }
}

export function normalizeLegacyTransferBagMainStatus(
  status: string | undefined,
): TransferBagMainStatusKey {
  const normalized = String(status || 'IDLE').toUpperCase()
  if (normalized === 'DISABLED') return 'DISABLED'
  if (normalized === 'IDLE' || normalized === 'REUSABLE') return 'IDLE'
  return 'IN_USE'
}
```

- [ ] **步骤 5：运行专项检查验证绿灯**

运行：

```bash
npm run check:transfer-bag-three-status
```

预期：PASS，输出
`check:transfer-bag-three-status lifecycle contract passed`。

- [ ] **步骤 6：提交**

```bash
git add package.json scripts/check-transfer-bag-three-status.ts src/data/fcs/cutting/transfer-bag-lifecycle.ts
git commit -m "test: lock transfer bag three-status contract"
```

### 任务 2：收口运行时主档并兼容旧数据

**文件：**

- 修改：`src/data/fcs/cutting/transfer-bag-runtime.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags-model.ts`
- 修改：`scripts/check-transfer-bag-three-status.ts`

- [ ] **步骤 1：补充旧状态迁移失败用例**

在专项检查中加入旧主档和旧使用周期样例，断言：

```ts
assert.deepEqual(
  deriveTransferBagLifecycle({
    hasOpenCycle: true,
    packedAt: '2026-07-30 09:00',
    inboundAt: '2026-07-30 09:30',
    handedOverAt: '2026-07-30 10:00',
    disabled: false,
  }),
  { mainStatus: 'IN_USE', flowStage: 'HANDED_OVER_WAITING_RETURN' },
)
```

并扫描源文件，禁止公开主状态类型再次包含：

```ts
for (const legacy of [
  'DISPATCHED',
  'WAITING_SIGNOFF',
  'WAITING_RETURN',
  'RETURN_INSPECTING',
  'REUSABLE',
  'WAITING_CLEANING',
  'WAITING_REPAIR',
]) {
  assert(!masterStatusTypeSource.includes(`| '${legacy}'`))
}
```

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:transfer-bag-three-status
```

预期：FAIL，指出 `TransferBagMasterStatusKey` 仍包含旧值。

- [ ] **步骤 3：扩展运行时使用周期字段**

在 `TransferCarrierCycleRecord` 与创建、合并、序列化路径加入：

```ts
flowStage?: TransferBagFlowStageKey
packedAt?: string
inboundAt?: string
handedOverAt?: string
```

读取旧数据时按事实补齐：

```ts
flowStage:
  cycle.flowStage
  ?? (cycle.dispatchAt
    ? 'HANDED_OVER_WAITING_RETURN'
    : cycle.warehouseArea && cycle.locationCode
      ? 'INBOUND_STORED'
      : cycle.finishedPackingAt
        ? 'PACKED'
        : undefined)
```

- [ ] **步骤 4：收口页面模型类型**

将 `TransferBagMasterStatusKey` 改为数据层类型别名：

```ts
export type TransferBagMasterStatusKey = TransferBagMainStatusKey
```

将管理投影改为：

```ts
export type TransferBagCarrierCurrentStatus = '空闲' | '使用中' | '已报废'
export type TransferBagCarrierUseStage = '无' | '菲票已装袋' | '入仓暂存中' | '已交出待回收'
```

`toPageMasterStatus()` 只能返回 `IDLE | IN_USE | DISABLED`；旧状态通过
`normalizeLegacyTransferBagMainStatus()` 归一化。

- [ ] **步骤 5：用统一事实替换管理投影多分支**

删除 `deriveCarrierManagementStatus()`、
`deriveCarrierManagementStatusFromUsage()` 和
`deriveCurrentStatusForDisplay()` 中的旧文案分支，新增一个转换入口：

```ts
function buildLifecycleView(
  master: TransferBagMasterItem,
  usage: TransferBagUsageItem | null | undefined,
): TransferBagLifecycleView {
  const lifecycle = deriveTransferBagLifecycle({
    hasOpenCycle: Boolean(usage && !['CLOSED', 'SCRAP_CLOSED'].includes(usage.usageStatus)),
    packedAt: usage?.packedAt || usage?.finishedPackingAt,
    inboundAt: usage?.inboundAt || (usage?.warehouseArea && usage?.locationCode ? usage.finishedPackingAt : ''),
    handedOverAt: usage?.handedOverAt || usage?.dispatchAt,
    disabled: master.currentStatus === 'DISABLED',
  })
  return toTransferBagLifecycleView(lifecycle)
}
```

- [ ] **步骤 6：验证模型与旧数据兼容**

运行：

```bash
npm run check:transfer-bag-three-status
npm run check:transfer-bag-mobile-closed-loop
```

预期：两个命令均 PASS；旧数据能读取，但新投影只输出三个主状态。

- [ ] **步骤 7：提交**

```bash
git add src/data/fcs/cutting/transfer-bag-runtime.ts src/pages/process-factory/cutting/transfer-bags-model.ts scripts/check-transfer-bag-three-status.ts
git commit -m "refactor: unify transfer bag lifecycle vocabulary"
```

### 任务 3：按业务事实拆开装袋、入仓、交出和回收

**文件：**

- 修改：`src/data/fcs/cutting/transfer-bag-runtime.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags/handlers.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bag-return-model.ts`
- 修改：`src/pages/process-factory/cutting/wait-handover-web-actions.ts`
- 修改：`src/pages/process-factory/cutting/warehouse-hub.ts`
- 修改：`scripts/check-transfer-bag-three-status.ts`
- 修改：`scripts/check-web-cutting-transfer-bag-actions.ts`

- [ ] **步骤 1：编写动作转换失败用例**

专项检查至少覆盖：

```ts
assert.equal(afterBagging.mainStatus, 'IN_USE')
assert.equal(afterBagging.flowStage, 'PACKED')
assert.equal(afterInbound.mainStatus, 'IN_USE')
assert.equal(afterInbound.flowStage, 'INBOUND_STORED')
assert.equal(afterHandover.mainStatus, 'IN_USE')
assert.equal(afterHandover.flowStage, 'HANDED_OVER_WAITING_RETURN')
assert.equal(afterReusableReturn.mainStatus, 'IDLE')
assert.equal(afterReusableReturn.flowStage, null)
assert.equal(afterScrap.mainStatus, 'DISABLED')
assert.equal(afterScrap.flowStage, null)
assert.equal(afterDiscrepancyOnly.mainStatus, 'IDLE')
```

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:transfer-bag-three-status
npm run check:web-cutting-transfer-bag-actions
```

预期：FAIL，现有处理仍把装袋、入仓或交出过程写成主状态，或把差异写成
`SCRAP_CLOSED`。

- [ ] **步骤 3：装袋只写袋内事实**

在装袋确认成功路径写入：

```ts
usage.flowStage = 'PACKED'
usage.packedAt = now
usage.finishedPackingAt = now
master.currentStatus = 'IN_USE'
```

不得在装袋动作写入库区、库位、接收任务或交出时间。

- [ ] **步骤 4：入仓只写仓位事实**

入仓动作必须复用已有打开周期，并要求：

```ts
usage.flowStage === 'PACKED'
```

成功后只写：

```ts
usage.flowStage = 'INBOUND_STORED'
usage.inboundAt = now
usage.warehouseArea = selectedArea
usage.locationCode = selectedLocation
```

不得新建第二个袋内关系或重新扫描菲票。

- [ ] **步骤 5：交出只处理完整中转袋**

交出动作只接受：

```ts
usage.flowStage === 'INBOUND_STORED'
```

成功后写：

```ts
usage.flowStage = 'HANDED_OVER_WAITING_RETURN'
usage.handedOverAt = now
usage.dispatchAt = now
usage.receiverId = task.sewingFactoryId
usage.receiverName = task.sewingFactoryName
```

不得增加菲票选择、数量输入或部分交出路径。

- [ ] **步骤 6：特殊工艺回仓恢复入仓阶段**

特殊工艺回仓完成时：

```ts
usage.flowStage = 'INBOUND_STORED'
usage.inboundAt = now
usage.sourceType = 'SPECIAL_CRAFT_RETURN'
usage.sourceHandoverRecordId = event.sourceHandoverRecordId
```

如果现有类型没有 `sourceType` 或 `sourceHandoverRecordId`，在运行时使用周期上增加可选字段，并在投影保留，不把来源类型作为主状态。

- [ ] **步骤 7：修正回收与报废**

`closeTransferBagUsageCycle()` 必须始终关闭使用周期：

```ts
closureStatus: 'CLOSED'
```

并把袋处理结果独立为：

```ts
nextBagStatus: decision.reusableDecision === 'DISABLED' ? 'DISABLED' : 'IDLE'
```

差异只加入 `warningMessages`，不得改变 `closureStatus` 或
`nextBagStatus`。

- [ ] **步骤 8：运行专项检查**

运行：

```bash
npm run check:transfer-bag-three-status
npm run check:web-cutting-transfer-bag-actions
npx tsx scripts/check-cutting-wait-handover-transfer-bag-flow.ts
```

预期：三状态专项检查和 Web 检查 PASS；完整流转脚本不再出现旧状态口径失败。

- [ ] **步骤 9：提交**

```bash
git add src/data/fcs/cutting/transfer-bag-runtime.ts src/pages/process-factory/cutting/transfer-bags/handlers.ts src/pages/process-factory/cutting/transfer-bag-return-model.ts src/pages/process-factory/cutting/wait-handover-web-actions.ts src/pages/process-factory/cutting/warehouse-hub.ts scripts/check-transfer-bag-three-status.ts scripts/check-web-cutting-transfer-bag-actions.ts
git commit -m "fix: separate transfer bag flow facts from main status"
```

### 任务 4：调整中转袋 Web 列表、详情和回收确认

**文件：**

- 修改：`src/pages/process-factory/cutting/transfer-bags/state.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags/list.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags/detail.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags/dialogs.ts`
- 修改：`scripts/check-transfer-bag-three-status.ts`

- [ ] **步骤 1：增加 Web 渲染红灯断言**

专项脚本读取页面源文件并断言：

```ts
assert(source.includes(\"['空闲', '使用中', '已报废']\"))
assert(source.includes(\"['菲票已装袋', '入仓暂存中', '已交出待回收']\"))
assert(!source.includes(\"'交出装袋中'\"))
```

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:transfer-bag-three-status
```

预期：FAIL，现有列表仍展示七个“当前状态”选项。

- [ ] **步骤 3：拆分列表筛选**

`MasterStatusFilter` 只允许：

```ts
type MasterStatusFilter = 'ALL' | '空闲' | '使用中' | '已报废'
```

`MasterUseStageFilter` 只允许：

```ts
type MasterUseStageFilter =
  | 'ALL'
  | '菲票已装袋'
  | '入仓暂存中'
  | '已交出待回收'
```

筛选栏分别显示“中转袋状态”和“当前流转阶段”。

- [ ] **步骤 4：拆分表格列与摘要**

主列表保持 `renderStandardListPage`、
`renderStandardListTable` 和 `renderTablePagination`，新增两个独立列：

```ts
{ key: 'mainStatus', label: '中转袋状态', required: true, sortable: true }
{ key: 'flowStage', label: '当前流转阶段', required: true, sortable: true }
```

空闲和已报废的阶段统一显示 `—`。摘要卡只统计三个主状态，不把阶段重复计入袋总数。

- [ ] **步骤 5：调整详情头部**

详情头部固定显示：

```text
中转袋编号
中转袋状态
当前流转阶段
当前库区库位 / 接收方
```

历史周期仍展示内部过程和业务记录，但不得用历史过程覆盖当前主状态。

- [ ] **步骤 6：简化回收确认表单**

`conditionDraft` 收口为：

```ts
{
  reusableDecision: 'REUSABLE' | 'DISABLED'
  damageType: string
  note: string
}
```

界面只保留：

- 回收结果：可继续使用 / 已报废。
- 报废说明：仅选择已报废时必填。
- 备注。

删除现有附加处理字段和其他中间结果。

- [ ] **步骤 7：验证列表治理与局部交互**

运行：

```bash
npm run check:transfer-bag-three-status
npm run check:list-page-governance
npm run check:web-cutting-transfer-bag-actions
```

预期：全部 PASS；筛选、详情和弹窗不触发不必要整页重绘。

- [ ] **步骤 8：提交**

```bash
git add src/pages/process-factory/cutting/transfer-bags/state.ts src/pages/process-factory/cutting/transfer-bags/list.ts src/pages/process-factory/cutting/transfer-bags/detail.ts src/pages/process-factory/cutting/transfer-bags/dialogs.ts scripts/check-transfer-bag-three-status.ts
git commit -m "feat: show transfer bag status and flow stage separately"
```

### 任务 5：对齐 PDA、整袋交出和二维码展示

**文件：**

- 修改：`src/pages/pda-cutting-inbound.ts`
- 修改：`src/pages/pda-cutting-handover.ts`
- 修改：`src/pages/pda-transfer-bag-detail.ts`
- 修改：`src/pages/print/templates/label-print-template.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags-projection.ts`
- 修改：`scripts/check-pda-cutting-inbound-workflow.ts`
- 修改：`scripts/check-pda-cutting-transfer-bag-handover.ts`
- 修改：`scripts/check-transfer-bag-mobile-closed-loop.ts`

- [ ] **步骤 1：先改 PDA 检查为新契约**

装袋/入仓 Mock 账袋结构改为：

```ts
{
  bagCode: string
  mainStatus: TransferBagMainStatusKey
  flowStage: TransferBagFlowStageKey | null
  ticketNos: string[]
  locationLabel: string
}
```

检查断言：

```ts
assert.equal(validBagging.ledger.bags[bagCode].mainStatus, 'IN_USE')
assert.equal(validBagging.ledger.bags[bagCode].flowStage, 'PACKED')
assert.equal(validInbound.ledger.bags[bagCode].flowStage, 'INBOUND_STORED')
```

交出检查断言：

```ts
const handedOverBag = candidates.bags.find((bag) => bag.bagCode === bagCode)
assert.equal(handedOverBag?.mainStatus, 'IN_USE')
assert.equal(handedOverBag?.flowStage, 'HANDED_OVER_WAITING_RETURN')
assert.equal(submitResult.resultMessage, '整袋交出成功')
```

- [ ] **步骤 2：运行 PDA 检查确认失败**

运行：

```bash
npm run check:pda-cutting-inbound-workflow
npm run check:pda-cutting-transfer-bag-handover
```

预期：FAIL，现有 PDA 仍使用
`EMPTY_READY / BAGGED_WAIT_INBOUND / INBOUNDED / HANDED_OVER / VOIDED`
或“待交出 / 已交出”作为单一状态。

- [ ] **步骤 3：改装袋和入仓候选判断**

装袋只接受：

```ts
bag.mainStatus === 'IDLE' && bag.flowStage === null
```

入仓只接受：

```ts
bag.mainStatus === 'IN_USE' && bag.flowStage === 'PACKED'
```

页面成功反馈保持动作化：

```text
菲票已装袋
入仓成功
```

员工不选择主状态或流转阶段。

- [ ] **步骤 4：改整袋交出候选判断**

交出只接受：

```ts
bag.mainStatus === 'IN_USE' && bag.flowStage === 'INBOUND_STORED'
```

成功后写入 `HANDED_OVER_WAITING_RETURN`，反馈为“整袋交出成功”。保留生产单、车缝任务和接收工厂一致性校验。

- [ ] **步骤 5：统一二维码和打印展示**

二维码详情和标签模板必须分别展示：

```text
中转袋状态：使用中
当前流转阶段：入仓暂存中
```

不得显示 `IN_USE`、`READY_TO_DISPATCH` 或其他英文过程码。

- [ ] **步骤 6：验证跨端闭环**

运行：

```bash
npm run check:pda-cutting-inbound-workflow
npm run check:pda-cutting-transfer-bag-handover
npm run check:transfer-bag-mobile-closed-loop
npm run check:transfer-bag-three-status
```

预期：全部 PASS。

- [ ] **步骤 7：提交**

```bash
git add src/pages/pda-cutting-inbound.ts src/pages/pda-cutting-handover.ts src/pages/pda-transfer-bag-detail.ts src/pages/print/templates/label-print-template.ts src/pages/process-factory/cutting/transfer-bags-projection.ts scripts/check-pda-cutting-inbound-workflow.ts scripts/check-pda-cutting-transfer-bag-handover.ts scripts/check-transfer-bag-mobile-closed-loop.ts
git commit -m "feat: align transfer bag PDA and QR lifecycle"
```

### 任务 6：收口旧状态治理与完整流转门禁

**文件：**

- 修改：`scripts/check-cutting-wait-handover-transfer-bag-flow.ts`
- 修改：`scripts/check-cutting-clean-mainline.ts`
- 修改：`scripts/check-transfer-bag-three-status.ts`
- 修改：`scripts/check-web-cutting-transfer-bag-actions.ts`

- [ ] **步骤 1：删除旧多状态正向期望**

完整流转脚本不再要求以下值作为主状态：

```text
可用
入仓装袋中
交出装袋中
待交出
已交出待回收
报废
```

改为分别断言：

```text
主状态：空闲、使用中、已报废
流转阶段：菲票已装袋、入仓暂存中、已交出待回收
```

- [ ] **步骤 2：增加旧口径禁用检查**

`check-cutting-clean-mainline.ts` 对中转袋相关文件新增禁用项：

```ts
[
  'WAITING_CLEANING',
  'WAITING_REPAIR',
  \"currentStatus: '待交出'\",
  \"currentStatus: '交出装袋中'\",
]
```

兼容读取函数允许出现旧英文值，但必须限制在明确的迁移映射代码块；检查脚本应按文件和上下文白名单，不得全局放宽。

- [ ] **步骤 3：运行专项与完整流转检查**

运行：

```bash
npm run check:transfer-bag-three-status
npm run check:web-cutting-transfer-bag-actions
npm run check:pda-cutting-inbound-workflow
npm run check:pda-cutting-transfer-bag-handover
npm run check:transfer-bag-mobile-closed-loop
npx tsx scripts/check-cutting-wait-handover-transfer-bag-flow.ts
```

预期：全部 PASS，完整流转脚本为 0 个失败。

- [ ] **步骤 4：运行裁床全量检查并区分既有失败**

运行：

```bash
npm run check:cutting:all
```

预期：

- 本任务涉及的中转袋、PDA、Web 检查全部通过。
- 如果仍只剩
  `production-order-overview-view.ts: min-w >= 1600px`，记录为既有基线阻塞。
- 如果出现任何新的失败，停止并修复后重跑。

- [ ] **步骤 5：提交**

```bash
git add scripts/check-cutting-wait-handover-transfer-bag-flow.ts scripts/check-cutting-clean-mainline.ts scripts/check-transfer-bag-three-status.ts scripts/check-web-cutting-transfer-bag-actions.ts
git commit -m "test: enforce transfer bag three-status flow"
```

### 任务 7：原型治理、浏览器验收与任务收据

**文件：**

- 创建：`docs/prototype-review-records/2026-07-30-cutting-transfer-bag-three-status.md`
- 修改：仅在自查发现本需求内问题时修改任务 1～6 已列文件。

- [ ] **步骤 1：填写原型审查记录**

必须覆盖：

```text
角色匹配
Web / PDA 端类型
任务清晰度
主状态与流转阶段分层
装袋 / 入仓 / 整袋交出 / 特殊工艺回仓边界
重复操作、防错和失败反馈
1366×768 与 1280×720
弹窗局部刷新和 200ms 响应
既有 production-order-overview-view.ts 宽表基线例外
```

- [ ] **步骤 2：运行治理检查**

运行：

```bash
npm run check:list-page-governance
npm run check:prototype-design-governance
```

预期：两个命令均 PASS。

- [ ] **步骤 3：启动局域网开发服务**

运行：

```bash
npm run dev -- --host 0.0.0.0 --port 61011
```

如果端口占用，换用一个明确的空闲端口，并在验收记录中写明。

- [ ] **步骤 4：执行浏览器验收**

在 1366×768 和 1280×720 验证：

1. `/fcs/craft/cutting/transfer-bags`
   - 状态筛选只有空闲、使用中、已报废。
   - 阶段筛选只有三个阶段。
   - 空闲和已报废阶段显示 `—`。
   - 操作列固定，表格在容器内滚动。
2. Web 待交出仓
   - 菲票装袋后为“使用中 / 菲票已装袋”。
   - 入仓只扫袋和库位，完成后为“使用中 / 入仓暂存中”。
   - 交出只扫袋和任务，完成后为“使用中 / 已交出待回收”。
3. PDA
   - 每页一个主动作。
   - 成功反馈分别为“菲票已装袋”“入仓成功”“整袋交出成功”。
4. 回收
   - 可继续使用变为空闲。
   - 不可继续使用变为已报废。
   - 数量差异不会自动报废。
5. 二维码详情
   - 主状态和流转阶段分开显示。
   - 无英文状态码。

- [ ] **步骤 5：运行构建和最终 CodeGraph 同步**

运行：

```bash
npm run build
codegraph sync
codegraph status
```

预期：构建成功；CodeGraph 无待同步文件且工作树匹配。

- [ ] **步骤 6：提交审查记录**

```bash
git add docs/prototype-review-records/2026-07-30-cutting-transfer-bag-three-status.md
git commit -m "docs: record transfer bag three-status review"
```

- [ ] **步骤 7：生成任务收据**

运行：

```bash
receipt_dir=$(mktemp -d /tmp/higoods-transfer-bag-three-status-XXXXXX)
npm run workflow:verify -- \
  --output "$receipt_dir/task-receipt.json" \
  --task-boundary "将中转袋主状态收口为空闲、使用中、已报废，并统一装袋、入仓、整袋交出、特殊工艺回仓、回收、Web、PDA和二维码流转阶段"
```

预期：

- 如果既有 `min-w-[2280px]` 已由其他任务修复，收据状态为 `verified`。
- 如果该既有基线仍拦截 `check:cutting:all`，如实报告状态为
  `implemented`，附上唯一既有阻塞；不得宣称全部验证通过。

## 3. 规格覆盖自检矩阵

| 规格要求 | 实现任务 |
| --- | --- |
| 主状态只保留空闲、使用中、已报废 | 任务 1、2、4、6 |
| 三个流转阶段独立表达 | 任务 1、2、3、4 |
| 菲票装袋只建立袋内事实 | 任务 3、5 |
| 入仓只记录袋号、库区和库位 | 任务 3、5 |
| 整袋交出 | 任务 3、5 |
| 特殊工艺回仓保留来源并回到入仓阶段 | 任务 3 |
| 回收只进入空闲或已报废 | 任务 3、4 |
| 差异不得导致自动报废 | 任务 3、6 |
| Web 状态列与阶段列分离 | 任务 4 |
| PDA 单动作、员工不选状态 | 任务 5、7 |
| 二维码跨端一致 | 任务 5、7 |
| 历史旧状态兼容但不再写回 | 任务 2、6 |
| 标准列表、原型治理、分辨率、性能 | 任务 4、7 |
| CodeGraph 与任务收据 | 任务 7 |

## 4. 计划自检结论

- 规格覆盖度：设计规格第 2～14 节均已映射到任务和验收步骤。
- 占位符扫描：计划没有未完成占位项；所有代码任务均给出具体类型、字段、命令和预期结果。
- 类型一致性：统一使用
  `TransferBagMainStatusKey`、
  `TransferBagFlowStageKey` 和
  `TransferBagLifecycleView`。
- 范围控制：不修改无关菜单、全局布局、技术栈、状态管理体系或
  `production-order-overview-view.ts`。
- 实施策略：先专项红灯，再最小实现，按模型、动作、Web、PDA、治理逐步提交。
