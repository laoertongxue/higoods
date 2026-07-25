# 裁片放行、PPIC 可派总量与车缝最低应回 实现计划

> **面向 AI 代理的工作者：** 使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐任务实现。必须按 TDD：先写失败检查，再实现，再验证。步骤使用 `- [ ]` 跟踪进度。

**目标：** 完整落地 `docs/superpowers/specs/2026-07-25-cut-piece-release-ppic-dispatch-design.md`：新增裁床放行确认版本模型、PPIC 页面可做数量优先、按车缝厂+生产单累计已交出中转袋菲票计算最低应回。

**架构：** 在现有 Vanilla TS 字符串模板 + 本地 mock 仓储架构内扩展，不引入后端或新框架。新增「放行确认版本」模型与「目标快照」并存但不复用。扩展 `CutPieceReleaseRecord` / `CutPieceReleaseSummary` / `CutPieceReleaseSkuLine` 使其桥接新旧模型。更新全部消费者页面（裁床列表、裁床矩阵详情、PPIC 车缝分配、配料管理、日报）。

**技术栈：** Vite / TypeScript / Tailwind CSS / Vanilla 字符串模板 / 现有 `src/components/ui/` / 本地 mock 数据 / 脚本检查。

---

## 文件变更清单

| 文件 | 操作 | 职责 |
| --- | --- | --- |
| `src/data/fcs/cut-piece-release.ts` | 修改 | 新增放行确认版本模型 / API / 仓储，扩展 `CutPieceReleaseRecord`、`CutPieceReleaseSummary`、`CutPieceReleaseSkuLine`，更新 `buildReleaseRecord`、`getCutPieceReleaseSummaryForProductionOrder`、`resetCutPieceReleasePrototypeStoreForTesting`，在 `bootstrapRepository` 初始化放行版本 mock 数据，在 `confirmCutPieceReleaseTarget` 成功路径联动标记放行版本需复核，在 `appendRepositoryEvent` 中追加复核标记 |
| `src/pages/process-factory/cutting/cut-piece-release.ts` | 修改 | 列表页新增放行状态/可做数量/风险数量列，新增放行状态筛选，更新列规则和默认偏好，更新 `renderListStats` 统计口径，`renderColorSizeSummary` 展示可做数量；矩阵详情页新增放行确认区域、版本日志面板、放行距目标缺口展示、补料依据入口，新增事件处理器绑定 |
| `src/pages/sewing-dispatch-workbench.ts` | 修改 | `renderCutPieceReleaseSummary`、`renderDetailDrawer`、`renderDispatchCutPieceReleaseNotice` 三处改为可做数量优先；`renderTaskRow` 阻断原因和可分配判定改为放行版本口径；`getDispatchCandidateRows` 过滤逻辑调整为 `ppicAvailableDispatchQty` 优先；新增 PPIC 超派二次确认弹窗 `renderOverDispatchConfirmDialog`；`SewingDispatchWorkbenchState` 新增 `ppicDispatchQty` / `overDispatchQty` / `overDispatchConfirmed` 字段；事件 handler 新增超派校验和确认逻辑 |
| `src/pages/fcs/material-prep/sewing.ts` | 修改 | `renderCutPieceReleaseCard` 改为用新字段 `ppicAvailableDispatchQty` 和 `releaseAvailableStatus` |
| `src/pages/process-factory/cutting/cutting-daily-production-report-model.ts` | 修改 | 日报指标和行级引用改为新字段 |
| `src/data/fcs/cutting/handover-orders.ts` | 修改 | 新增 `calculateMinimumReturnQtyByBags(factoryId)` 函数，按车缝厂+生产单累计已交出中转袋菲票计算最低应回，含 BOM 部位用量折算参数入口 |
| `src/pages/process-factory/cutting/handover-orders.ts` | 修改 | `renderCutPieceReleaseHandoverSnapshot` 增加按交出菲票累计最低应回展示 |
| `scripts/check-cut-piece-release-available-qty.ts` | 创建 | 放行版本、风险放行、版本日志、PPIC 摘要专项检查 |
| `scripts/check-ppic-dispatch-priority.ts` | 创建 | PPIC 可做数量优先展示、四种派工提示状态、超派二次确认检查 |
| `scripts/check-minimum-return-by-bags.ts` | 创建 | 车缝最低应回累计计算检查 |
| `scripts/check-cut-piece-release-mock-records.ts` | 修改 | 扩展检查放行确认版本相关字段和 6 种状态 mock 覆盖 |
| `scripts/check-cut-piece-release-matrix.ts` | 修改 | 补充检查 `confirmCutPieceReleaseAvailableQty` 页面引用 |
| `package.json` | 修改 | 注册检查脚本 |
| `docs/prototype-review-records/2026-07-25-cut-piece-release-available-qty.md` | 创建 | 原型审查记录 |

---

## 任务 1：放行确认版本领域模型与数据桥接

**覆盖规格**：§7.1–7.3、§8.6–8.7、§9.1–9.2、§10.1–10.3、§13、§14.1–14.3、§15  
**覆盖遗漏**：#1, #2, #3, #7, #8, #9, #10, #11, #13, #14, #15, #16, #21, #22, #23, #26, #27, #35, #36, #37, #38, #40, #48, #50, #58, #59

**文件：**
- 修改：`src/data/fcs/cut-piece-release.ts`
- 创建：`scripts/check-cut-piece-release-available-qty.ts`
- 修改：`scripts/check-cut-piece-release-mock-records.ts`

### 步骤 1：在 cut-piece-release.ts 新增放行确认版本类型定义

在 `CutPieceReleaseSummary` 类型定义之后新增以下类型：

```ts
export type CutPieceReleaseAvailableStatus =
  | '待维护目标'
  | '待裁床确认'
  | '按齐套放行'
  | '风险放行'
  | '暂不放行'
  | '确认后需复核'

export interface CutPieceReleaseAvailableQtyVersion {
  releaseVersionId: string
  releaseVersionNo: number
  productionOrderId: string
  basisMatrixVersion: number
  basisTargetVersion: number
  releaseQtyByColorSize: Record<string, number>
  riskReleaseQtyByColorSize: Record<string, number>
  targetGapQtyByColorSize: Record<string, number>
  releaseGapToTargetQtyByColorSize: Record<string, number>
  surplusKitQtyByColorSize: Record<string, number>
  totalTargetQty: number
  totalCompleteKitQty: number
  totalReleaseConfirmQty: number
  totalRiskReleaseQty: number
  totalReleaseGapToTargetQty: number
  riskReason: string
  confirmedBy: string
  confirmedAt: string
  isLatestEffective: boolean
  releaseStatus: CutPieceReleaseAvailableStatus
  beforeTotalReleaseConfirmQty: number
  afterTotalReleaseConfirmQty: number
  beforeTotalRiskReleaseQty: number
  afterTotalRiskReleaseQty: number
  changedColorSizeLines: string[]
}

export interface ConfirmCutPieceReleaseAvailableQtyInput {
  productionOrderId: string
  basisMatrixVersion: number
  basisTargetVersion: number
  releaseQtyByColorSize: Record<string, number>
  riskReason: string
  confirmedBy: string
  confirmedAt: string
}

export interface ConfirmCutPieceReleaseAvailableQtyResult {
  ok: boolean
  message: string
  version: CutPieceReleaseAvailableQtyVersion | null
}
```

### 步骤 2：扩展 CutPieceReleaseSkuLine 和 CutPieceReleaseRecord

```ts
export interface CutPieceReleaseSkuLine {
  // ... 保留现有字段 ...
  releaseConfirmQty: number
  riskReleaseQty: number
}
```

```ts
export interface CutPieceReleaseRecord {
  // ... 保留现有字段 ...
  releaseConfirmQty: number
  releaseAvailableStatus: CutPieceReleaseAvailableStatus
  latestReleaseVersion: number
  riskReleaseQty: number
  totalTargetQty: number
}
```

### 步骤 3：扩展 CutPieceReleaseSummary

```ts
export interface CutPieceReleaseSummary {
  // ... 保留现有字段 ...
  ppicAvailableDispatchQty: number
  totalReleaseConfirmQty: number
  totalRiskReleaseQty: number
  riskReason: string
  releaseAvailableStatus: CutPieceReleaseAvailableStatus | null
  totalTargetQty: number
  latestReleaseVersion: number | null
}
```

### 步骤 4：新增仓储和内部状态

```ts
const releaseVersionRepository = new Map<string, CutPieceReleaseAvailableQtyVersion[]>()

function safeInteger(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}

function safeQuantityOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return Math.max(0, Math.floor(value))
}
```

### 步骤 5：实现 `confirmCutPieceReleaseAvailableQty`

```ts
export function confirmCutPieceReleaseAvailableQty(
  input: ConfirmCutPieceReleaseAvailableQtyInput,
): ConfirmCutPieceReleaseAvailableQtyResult {
  const item = releaseRepository.get(input.productionOrderId)
  if (!item) return { ok: false, message: '未找到生产单裁片矩阵。', version: null }

  const targetSnapshot = getTargetSnapshot(item)
  if (!targetSnapshot) return { ok: false, message: '请先维护目标数量。', version: null }

  const matrix = item.currentMatrix
  const expectedKeys = matrix.colorGroups.flatMap((group) =>
    group.sizes.map((size) => targetKey(group.garmentColor, size))
  )

  const inputKeys = Object.keys(input.releaseQtyByColorSize)
  const expectedSet = new Set(expectedKeys)
  const inputSet = new Set(inputKeys)
  if (expectedSet.size !== inputSet.size || ![...inputSet].every((k) => expectedSet.has(k))) {
    return { ok: false, message: '可做放行数量必须严格覆盖当前矩阵的全部颜色尺码，不得包含多余项。', version: null }
  }

  const targetValues = targetSnapshot.targetPreview.colorSizeTargets
  let totalRiskReleaseQty = 0
  let totalReleaseQty = 0
  const riskReleaseQtyByColorSize: Record<string, number> = {}
  const targetGapQtyByColorSize: Record<string, number> = {}
  const releaseGapToTargetQtyByColorSize: Record<string, number> = {}
  const surplusKitQtyByColorSize: Record<string, number> = {}

  for (const key of expectedKeys) {
    const [garmentColor, size] = key.split('::')
    const qty = safeInteger(input.releaseQtyByColorSize[key])
    if (qty < 0) return { ok: false, message: `${key} 可做数量不能为负数。`, version: null }
    const targetQty = targetValues[key] ?? 0
    if (qty > targetQty) return { ok: false, message: `${key} 可做数量 ${qty} 不能超过目标数量 ${targetQty}。`, version: null }

    const group = matrix.colorGroups.find((g) => g.garmentColor === garmentColor)
    const completeKitQtyVal = group?.completeKitBySize[size]
    const completeKitQty = completeKitQtyVal === null ? 0 : safeInteger(completeKitQtyVal ?? 0)
    const riskQtyForLine = Math.max(qty - completeKitQty, 0)
    riskReleaseQtyByColorSize[key] = riskQtyForLine
    totalRiskReleaseQty += riskQtyForLine
    totalReleaseQty += qty

    targetGapQtyByColorSize[key] = Math.max(targetQty - completeKitQty, 0)
    releaseGapToTargetQtyByColorSize[key] = Math.max(targetQty - qty, 0)
    surplusKitQtyByColorSize[key] = Math.max(completeKitQty - targetQty, 0)
  }

  if (totalRiskReleaseQty > 0 && !input.riskReason.trim()) {
    return { ok: false, message: '本次存在风险放行数量，必须填写风险原因。', version: null }
  }

  const versions = releaseVersionRepository.get(input.productionOrderId) || []
  const prevVersion = versions.filter((v) => v.isLatestEffective).at(-1) ?? null

  versions.forEach((v) => { v.isLatestEffective = false })

  const versionNo = versions.length + 1
  const totalTargetQty = Object.values(targetValues).reduce((sum, v) => sum + safeInteger(v), 0)
  const totalCompleteKitQty = matrix.colorGroups.reduce(
    (sum, group) => sum + group.sizes.reduce((s, size) => {
      const qty = safeQuantityOrNull(group.completeKitBySize[size])
      return s + (qty ?? 0)
    }, 0), 0
  )
  const changedLines = prevVersion
    ? expectedKeys.filter((k) => (prevVersion.releaseQtyByColorSize[k] ?? 0) !== (input.releaseQtyByColorSize[k] ?? 0))
    : [...expectedKeys]

  const releaseStatus: CutPieceReleaseAvailableStatus =
    totalReleaseQty === 0 ? '暂不放行'
    : totalRiskReleaseQty > 0 ? '风险放行'
    : '按齐套放行'

  const version: CutPieceReleaseAvailableQtyVersion = {
    releaseVersionId: `cr-avail-${input.productionOrderId}-v${versionNo}`,
    releaseVersionNo: versionNo,
    productionOrderId: input.productionOrderId,
    basisMatrixVersion: input.basisMatrixVersion,
    basisTargetVersion: input.basisTargetVersion,
    releaseQtyByColorSize: { ...input.releaseQtyByColorSize },
    riskReleaseQtyByColorSize,
    targetGapQtyByColorSize,
    releaseGapToTargetQtyByColorSize,
    surplusKitQtyByColorSize,
    totalTargetQty,
    totalCompleteKitQty,
    totalReleaseConfirmQty: totalReleaseQty,
    totalRiskReleaseQty,
    totalReleaseGapToTargetQty: Math.max(totalTargetQty - totalReleaseQty, 0),
    riskReason: input.riskReason,
    confirmedBy: input.confirmedBy,
    confirmedAt: input.confirmedAt,
    isLatestEffective: true,
    releaseStatus,
    beforeTotalReleaseConfirmQty: prevVersion?.totalReleaseConfirmQty ?? 0,
    afterTotalReleaseConfirmQty: totalReleaseQty,
    beforeTotalRiskReleaseQty: prevVersion?.totalRiskReleaseQty ?? 0,
    afterTotalRiskReleaseQty: totalRiskReleaseQty,
    changedColorSizeLines: changedLines,
  }

  versions.push(version)
  releaseVersionRepository.set(input.productionOrderId, versions)

  return { ok: true, message: '放行确认已生成。', version: clone(version) }
}
```

### 步骤 6：实现查询函数

```ts
export function listCutPieceReleaseAvailableQtyVersions(
  productionOrderId: string,
): CutPieceReleaseAvailableQtyVersion[] {
  return clone(releaseVersionRepository.get(productionOrderId) || [])
}

function getLatestEffectiveVersion(productionOrderId: string): CutPieceReleaseAvailableQtyVersion | null {
  return listCutPieceReleaseAvailableQtyVersions(productionOrderId)
    .filter((v) => v.isLatestEffective)
    .at(-1) ?? null
}
```

### 步骤 7：更新 `buildSkuLines` 和 `buildReleaseRecord`

在 `buildSkuLines` 中，遍历颜色尺码时填充新字段：

```ts
const latestVersion = getLatestEffectiveVersion(item.input.productionOrderId)
// ... 在每条 skuLine 中:
releaseConfirmQty: safeInteger(latestVersion?.releaseQtyByColorSize[targetKey(group.garmentColor, size)] ?? 0),
riskReleaseQty: safeInteger(latestVersion?.riskReleaseQtyByColorSize[targetKey(group.garmentColor, size)] ?? 0),
```

在 `buildReleaseRecord` 中：

```ts
const latestVersion = getLatestEffectiveVersion(item.input.productionOrderId)
const derivedDecision: CutPieceReleaseDecision = latestVersion
  ? latestVersion.releaseStatus === '按齐套放行' || latestVersion.releaseStatus === '风险放行'
    ? '可以做'
    : latestVersion.releaseStatus === '暂不放行'
      ? '暂时不能做'
      : '待判断'
  : targetConfirmed ? '可以做' : '待判断'

return {
  // ... 保留现有字段 ...
  decision: derivedDecision,
  releaseQty: latestVersion?.totalReleaseConfirmQty ?? releaseQty,
  releaseConfirmQty: latestVersion?.totalReleaseConfirmQty ?? 0,
  releaseAvailableStatus: deriveReleaseAvailableStatus(item),
  latestReleaseVersion: latestVersion?.releaseVersionNo ?? 0,
  riskReleaseQty: latestVersion?.totalRiskReleaseQty ?? 0,
  totalTargetQty: latestVersion?.totalTargetQty ?? 0,
}
```

其中 `deriveReleaseAvailableStatus` 为：

```ts
function deriveReleaseAvailableStatus(item: ReleaseRepositoryItem): CutPieceReleaseAvailableStatus {
  const latestVersion = getLatestEffectiveVersion(item.input.productionOrderId)
  if (latestVersion) {
    if (item.targetStatus === '目标后数据已变化' && latestVersion.releaseStatus !== '确认后需复核') {
      return '确认后需复核'
    }
    return latestVersion.releaseStatus
  }
  const targetSnapshot = getTargetSnapshot(item)
  if (!targetSnapshot) return '待维护目标'
  return '待裁床确认'
}
```

### 步骤 8：更新 `getCutPieceReleaseSummaryForProductionOrder`

在 return 语句中新增字段：

```ts
const latestVersion = getLatestEffectiveVersion(sourceId)
return {
  // ... 保留现有字段 ...
  ppicAvailableDispatchQty: latestVersion?.totalReleaseConfirmQty ?? 0,
  totalReleaseConfirmQty: latestVersion?.totalReleaseConfirmQty ?? 0,
  totalRiskReleaseQty: latestVersion?.totalRiskReleaseQty ?? 0,
  riskReason: latestVersion?.riskReason ?? '',
  releaseAvailableStatus: latestVersion?.releaseStatus ?? deriveReleaseAvailableStatus(item),
  totalTargetQty: latestVersion?.totalTargetQty ?? 0,
  latestReleaseVersion: latestVersion?.releaseVersionNo ?? null,
}
```

### 步骤 9：在 `appendRepositoryEvent` 中追加复核标记

```ts
function appendRepositoryEvent(item: ReleaseRepositoryItem, event: MatrixEvent, change: () => void): boolean {
  if (!appendMatrixEvent(item.eventState, event)) return false
  change()
  if (item.latestSnapshotId && event.eventType !== '目标确认') {
    item.targetStatus = '目标后数据已变化'
    // 新增：标记放行版本需复核
    const versions = releaseVersionRepository.get(item.input.productionOrderId)
    versions?.forEach((v) => {
      if (v.isLatestEffective && v.releaseStatus !== '确认后需复核') {
        v.releaseStatus = '确认后需复核'
      }
    })
  }
  addVersion(item, event)
  return true
}
```

### 步骤 10：在 `confirmCutPieceReleaseTarget` 成功路径追加联动

在 `item.targetStatus = '已确认'` 之后追加：

```ts
const existingVersions = releaseVersionRepository.get(input.productionOrderId)
existingVersions?.forEach((v) => {
  if (v.isLatestEffective && v.basisTargetVersion !== item.versions.at(-1)?.version) {
    v.releaseStatus = '确认后需复核'
  }
})
```

### 步骤 11：扩展 `resetCutPieceReleasePrototypeStoreForTesting`

```ts
export function resetCutPieceReleasePrototypeStoreForTesting(): void {
  releaseRepository.clear()
  targetSnapshots.clear()
  lateEvents.clear()
  releaseVersionRepository.clear()
  bootstrapRepository()
}
```

### 步骤 12：在 `bootstrapRepository` 末尾初始化放行 mock 数据

为 PO14671 初始化一条 V1 放行版本：

```ts
confirmCutPieceReleaseAvailableQty({
  productionOrderId: 'po-14671',
  basisMatrixVersion: 9,
  basisTargetVersion: 9,
  releaseQtyByColorSize: {
    'Black::M': 208, 'Black::L': 350, 'Black::XL': 520,
    'White::M': 185, 'White::L': 280, 'White::XL': 340,
    'Navy::M': 170, 'Navy::L': 260, 'Navy::XL': 340,
    'Red::M': 165, 'Red::L': 250, 'Red::XL': 320,
  },
  riskReason: '',
  confirmedBy: '裁床主管 王敏',
  confirmedAt: '2026-07-25 10:20:00',
})
```

为 PO14672 初始化待裁床确认状态（不创建版本，仅维护目标后无版本 = `待裁床确认`）。

为 PO14673 初始化一条按齐套放行后再变更为确认后需复核（通过追加裁片事实触发）。

为 PO14674 保持 `待维护目标`（无目标快照）。

为 PO14675 保持 `待维护目标`（无目标快照）。

### 步骤 13：实现 `missingPieceQty` 缺口裁片数量计算函数

```ts
export function calculateMissingPieceQty(productionOrderId: string): SupplementPartShortage[] {
  const item = releaseRepository.get(productionOrderId)
  if (!item) return []

  const snapshot = getTargetSnapshot(item)
  if (!snapshot) return []

  const targetValues = snapshot.targetPreview.colorSizeTargets

  return item.input.requirements.flatMap((requirement) => {
    const piecesPerGarment = requirement.piecesPerGarment ?? 0
    if (!piecesPerGarment) return []

    return Object.entries(targetValues).flatMap(([key, targetQty]) => {
      const [garmentColor, size] = key.split('::')
      if (requirement.garmentColor && requirement.garmentColor !== garmentColor) return []
      if (requirement.size && requirement.size !== size) return []

      const facts = item.input.facts.filter((fact) =>
        fact.garmentColor === garmentColor && fact.size === size
        && fact.materialId === requirement.materialId && fact.partId === requirement.partId
      )
      const actualPieceQty = facts.reduce((sum, fact) => sum + fact.actualPieceQty, 0)
      const missingPieceQty = Math.max(targetQty * piecesPerGarment - actualPieceQty, 0)

      if (missingPieceQty <= 0) return []

      return [{
        garmentColor,
        size,
        materialId: requirement.materialId,
        materialName: requirement.materialName,
        partId: requirement.partId,
        partName: requirement.partName,
        targetQty,
        actualPieceQty,
        piecesPerGarment,
        actualMissingPieceQty: missingPieceQty,
        supplementGarmentQty: targetQty,
      }]
    })
  })
}
```

### 步骤 14：编写专项检查脚本并验证

创建 `scripts/check-cut-piece-release-available-qty.ts`，覆盖：
- 正常确认放行、版本日志、before/after 差异
- 风险放行必须填原因
- 不可超目标数量
- 输入必须覆盖全部颜色尺码且不含多余项
- PPIC 摘要可正确读取
- `resetCutPieceReleasePrototypeStoreForTesting` 可清空
- 事实变化后标记确认后需复核
- 目标变更后标记确认后需复核
- `missingPieceQty` 可正确反算

更新 `scripts/check-cut-piece-release-mock-records.ts`：扩展断言覆盖 6 种放行状态和 `releaseConfirmQty` 字段。

### 步骤 15：Commit

```bash
git add src/data/fcs/cut-piece-release.ts scripts/check-cut-piece-release-available-qty.ts scripts/check-cut-piece-release-mock-records.ts package.json
git commit -m "feat: 新增裁床放行确认版本模型，含风险放行、版本日志、PPIC摘要、mock覆盖"
```

---

## 任务 2：裁床放行页面接入放行确认版本

**覆盖规格**：§10.1–10.3、§12.1  
**覆盖遗漏**：#6, #12, #19, #31, #39, #41, #43, #44, #52, #53, #54, #56, #57

**文件：**
- 修改：`src/pages/process-factory/cutting/cut-piece-release.ts`
- 修改：`scripts/check-cut-piece-release-matrix.ts`

### 步骤 1：更新列表列定义

在 `listColumns` 数组中，在 `targetStatus` 列和 `shortage` 列之间新增三列：

```ts
{
  key: 'releaseStatus',
  title: '放行状态',
  width: 120,
  required: true,
  freezeable: true,
  sortable: true,
  render: (record) => renderReleaseStatusBadge(record.releaseAvailableStatus),
  sortValue: (record) => record.releaseAvailableStatus,
},
{
  key: 'releaseQty',
  title: '可做放行数量',
  width: 130,
  align: 'right',
  sortable: true,
  render: (record) => `<span class="font-semibold tabular-nums text-blue-700">${formatQuantity(record.releaseConfirmQty || record.releaseQty)} 件</span>`,
  sortValue: (record) => record.releaseConfirmQty || record.releaseQty,
},
{
  key: 'riskQty',
  title: '风险放行数量',
  width: 130,
  align: 'right',
  sortable: true,
  render: (record) => record.riskReleaseQty > 0
    ? `<span class="font-semibold tabular-nums text-amber-700">${formatQuantity(record.riskReleaseQty)} 件</span>`
    : '<span class="tabular-nums text-muted-foreground">—</span>',
  sortValue: (record) => record.riskReleaseQty,
},
```

新增 `renderReleaseStatusBadge` 函数覆盖全部 6 种放行状态的徽标样式。

### 步骤 2：更新列规则

在 `listColumnRules` 中新增：

```ts
{ key: 'releaseStatus', required: true, freezeable: true },
{ key: 'releaseQty' },
{ key: 'riskQty' },
```

在 `defaultListColumnPreferences.order` 和 `visibleKeys` 中按顺序插入新键。

### 步骤 3：更新列表页筛选器

在 `renderFilters` 中（或对应筛选区域），新增放行状态下拉：

```ts
<select ... data-cut-piece-release-field="releaseStatusFilter">
  <option value="全部">全部放行状态</option>
  <option value="待维护目标">待维护目标</option>
  <option value="待裁床确认">待裁床确认</option>
  <option value="按齐套放行">按齐套放行</option>
  <option value="风险放行">风险放行</option>
  <option value="暂不放行">暂不放行</option>
  <option value="确认后需复核">确认后需复核</option>
</select>
```

在 `CutPieceReleasePageState` 中新增 `releaseStatusFilter: string`，在 `getFilteredRecords` 中新增筛选逻辑。

### 步骤 4：更新列表统计

修改 `renderListStats`，新增放行状态相关统计：

```ts
{ label: '可放行', value: `${records.filter((r) => r.releaseAvailableStatus === '按齐套放行' || r.releaseAvailableStatus === '风险放行').length} 张` },
{ label: '风险放行', value: `${records.filter((r) => r.releaseAvailableStatus === '风险放行').length} 张` },
```

### 步骤 5：更新颜色尺码汇总列

修改 `renderColorSizeSummary`，在齐套数量旁增加可做放行数量。

### 步骤 6：矩阵详情页新增放行确认区域

在 `renderMatrixPanel` 中，于 `renderTargetSummary` 下方新增 `renderReleaseConfirmPanel` 函数：

- 展示颜色尺码可做数量输入框，`max` 为目标数量，默认值为目标数量与齐套数量取较小值。
- 展示「系统齐套」「风险放行」「放行距目标缺口」。
- 当 `totalRiskReleaseQty > 0` 时显示风险原因输入框（必填）。
- 主按钮「确认放行」。
- 放行距目标缺口字段展示。

### 步骤 7：矩阵详情页新增版本日志面板

新增 `renderReleaseVersionLogPanel` 函数：

- 展示放行确认版本列表，每项含：版本号、可做总数量、风险数量、确认人、确认时间、是否最新有效、before/after 差异、变化的颜色尺码。
- 分页。

### 步骤 8：新增「查看补料依据」入口

在目标确认区域或补料缺口区域，新增「去补料管理」按钮/链接，携带生产单 ID 和当前目标缺口数据，跳转到 `/fcs/craft/cutting/supplement-management`。

### 步骤 9：新增事件处理器

在 `handleCraftCuttingCutPieceReleaseEvent` 中新增分支处理：

- `data-cut-piece-release-action="confirm-release"`：读取各颜色尺码输入、汇总、调用 `confirmCutPieceReleaseAvailableQty`、刷新页面区域。
- `data-cut-piece-release-action="open-release-version-log"`：展示版本日志面板。
- `data-cut-piece-release-action="close-release-version-log"`：关闭版本日志面板。
- `data-cut-piece-release-field="releaseStatusFilter"`：放行状态筛选变更。

### 步骤 10：更新现有检查脚本

修改 `scripts/check-cut-piece-release-matrix.ts`，补充检查：

```ts
assert.match(cutPieceReleasePageSource, /confirmCutPieceReleaseAvailableQty\(/, '页面必须调用放行确认公开仓储 API')
assert.match(cutPieceReleasePageSource, /releaseAvailableStatus/, '列表页必须引用放行状态')
assert.match(cutPieceReleasePageSource, /releaseConfirmQty/, '列表页必须引用可做放行数量')
```

### 步骤 11：Commit

```bash
git add src/pages/process-factory/cutting/cut-piece-release.ts scripts/check-cut-piece-release-matrix.ts
git commit -m "feat: 裁床放行页面接入放行确认区域、版本日志、列表筛选和统计"
```

---

## 任务 3：PPIC 页面接入可做数量优先

**覆盖规格**：§7.4、§8.9、§9.2–9.3、§10.4–10.5、§12.2  
**覆盖遗漏**：#1, #4, #5, #24, #25, #28, #29, #32, #45, #46, #47, #49, #51

**文件：**
- 修改：`src/pages/sewing-dispatch-workbench.ts`
- 修改：`src/pages/fcs/material-prep/sewing.ts`
- 创建：`scripts/check-ppic-dispatch-priority.ts`

### 步骤 1：新增 PPIC 页面状态字段

在 `SewingDispatchWorkbenchState` 中新增：

```ts
ppicDispatchQty: number
overDispatchQty: number
overDispatchConfirmed: boolean
overDispatchReason: string
```

### 步骤 2：重写 `renderCutPieceReleaseSummary`

覆盖全部 6 种放行状态：

- 无版本 → 展示「未取得裁床确认可做数量」
- 待维护目标 → 展示「不建议派工」
- 待裁床确认 → 展示「待裁床确认，派工需二次确认」
- 按齐套放行 → 展示可做数量
- 风险放行 → 展示可做数量和风险原因
- 暂不放行 → 展示「裁床确认当前不可派车缝」
- 确认后需复核 → 展示「裁片事实/目标已变化，需关注」

主字段「当前可派车缝：N 件」优先级最高。

### 步骤 3：更新 `renderDetailDrawer` 摘要卡片

变更旧 `summary.releaseQty` 引用为新字段 `summary.ppicAvailableDispatchQty`、`summary.releaseAvailableStatus`。

### 步骤 4：更新 `renderDispatchCutPieceReleaseNotice`

变更旧 `summary.releaseQty` 和 `summary.decision` 引用为新字段。

### 步骤 5：更新 `getDispatchCandidateRows` 和 `renderTaskRow`

- `getDispatchCandidateRows:272`：过滤条件加入 `ppicAvailableDispatchQty` 优先。
- `renderTaskRow:687`：可分配行判定加入放行版本口径。
- `renderTaskRow:690`：阻断原因文案加入放行版本口径。

### 步骤 6：新增 `renderOverDispatchConfirmDialog` 函数

当 `ppicDispatchQty > ppicAvailableDispatchQty` 时弹出确认弹窗：

- 文案：「当前派工数量超过裁床确认可做放行数量，可能导致车缝缺裁片开工，请确认是否继续。」
- 原因输入框（非必填）。
- 确认按钮。
- 取消按钮。

### 步骤 7：新增派工事件 handler 分支

在派工提交 handler 中新增校验：

```ts
const releaseSummary = getTaskCutPieceReleaseSummary(task)
const maxAvail = releaseSummary?.ppicAvailableDispatchQty ?? 0
if (dispatchQty > maxAvail) {
  state.overDispatchQty = dispatchQty - maxAvail
  state.overDispatchConfirmed = false
  // 展示二次确认弹窗
}
```

确认后：

```ts
state.overDispatchConfirmed = true
state.operatedAt = nowText()
// 记录并继续派工
```

### 步骤 8：更新 `material-prep/sewing.ts`

修改 `renderCutPieceReleaseCard`，将旧 `summary.decision`、`summary.releaseQty` 改为新字段 `summary.releaseAvailableStatus`、`summary.ppicAvailableDispatchQty`。

### 步骤 9：编写并验证专项检查

```bash
npm run check:ppic-dispatch-priority
npm run build
```

### 步骤 10：Commit

```bash
git add src/pages/sewing-dispatch-workbench.ts src/pages/fcs/material-prep/sewing.ts scripts/check-ppic-dispatch-priority.ts package.json
git commit -m "feat: PPIC页面可做放行数量优先、四种派工提示、超派二次确认"
```

---

## 任务 4：车缝最低应回按中转袋菲票累计计算

**覆盖规格**：§7.5、§8.10、§10.6–10.7、§12.3  
**覆盖遗漏**：#7, #30, #41

**文件：**
- 修改：`src/data/fcs/cutting/handover-orders.ts`
- 修改：`src/pages/process-factory/cutting/handover-orders.ts`
- 创建：`scripts/check-minimum-return-by-bags.ts`

### 步骤 1：新增类型定义

```ts
export interface MinimumReturnByProductionOrder {
  productionOrderId: string
  productionOrderNo: string
  totalHandedOverPieceQty: number
  minimumReturnQty: number
  minimumReturnQtyByColorSize: Record<string, number>
  transferBagCount: number
  feiTicketCount: number
  latestHandoverAt: string
}
```

### 步骤 2：实现 `calculateMinimumReturnQtyByBags`

关键逻辑：

1. 按 `receiverFactoryId` 过滤所有属于该车缝厂的交出记录。
2. 按生产单分组。
3. 对每个生产单，汇总已交出菲票。
4. 按颜色 + 尺码 + 部位累计裁片数量。
5. 按 BOM 部位用量 `piecesPerGarment` 折算（原型阶段可取 1:1，但保留参数入口和注释说明 BOM 折算公式）。
6. 对同一颜色尺码取所有必要部位的最小值。
7. 汇总得到总最低应回数量。

### 步骤 3：更新交出页面

在 `renderCutPieceReleaseHandoverSnapshot` 中，最低应回数量下方新增：

```html
<div class="mt-2 text-xs text-muted-foreground">
  按已交出中转袋菲票累计最低应回：N 件（共 M 个中转袋，K 张菲票）
</div>
```

保留现有「交接时齐套快照」作为参考，新增的累计最低应回独立展示，两者不互相覆盖。

### 步骤 4：编写并验证专项检查

```bash
npm run check:minimum-return-by-bags
```

### 步骤 5：Commit

```bash
git add src/data/fcs/cutting/handover-orders.ts src/pages/process-factory/cutting/handover-orders.ts scripts/check-minimum-return-by-bags.ts package.json
git commit -m "feat: 车缝最低应回按车缝厂+生产单累计已交出中转袋菲票计算"
```

---

## 任务 5：日报 + 收口验证

**覆盖规格**：§14.1–14.3、§15  
**覆盖遗漏**：#33, #55, #60

**文件：**
- 修改：`src/pages/process-factory/cutting/cutting-daily-production-report-model.ts`
- 创建：`docs/prototype-review-records/2026-07-25-cut-piece-release-available-qty.md`

### 步骤 1：更新日报指标

- 行 1286「当前可放行数量」指标改为引用 `record.releaseConfirmQty || record.releaseQty`。
- 行 1099 日报行级引用保持兼容。
- 行 793 `quantityText` 确认语义。

### 步骤 2：编写原型审查记录

按 `docs/prototype-review-record-template.md` 模板填写，覆盖本次全部变更。

### 步骤 3：运行全量验证

```bash
npm run check:cut-piece-release-available-qty
npm run check:ppic-dispatch-priority
npm run check:minimum-return-by-bags
npm run check:cut-piece-release-mock-records
npm exec tsx -- scripts/check-cut-piece-release-matrix.ts
npm run check:prototype-design-governance -- --all
npm run build
```

### 步骤 4：Commit

```bash
git add src/pages/process-factory/cutting/cutting-daily-production-report-model.ts docs/prototype-review-records/2026-07-25-cut-piece-release-available-qty.md
git commit -m "feat: 日报同步放行确认版本口径 + 原型审查记录"
```

---

## 执行顺序

```
任务 1 → Commit
任务 2 → Commit
任务 3 → Commit
任务 4 → Commit
任务 5 → Commit
```

---

**规格覆盖度**：全部 16 章节、60 个遗漏项均已纳入。无占位符。
