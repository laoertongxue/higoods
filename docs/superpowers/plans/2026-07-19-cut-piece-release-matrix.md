# 裁片放行管理矩阵实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers-zh:subagent-driven-development（推荐）或 superpowers-zh:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将现有通用人工放行判断改造成生产单级裁片齐套矩阵，并打通目标快照、补料、裁片单冻结、铺布冲销、裁片交接与车缝最低回货展示。

**架构：** 新增纯函数领域模块负责裁片事实、齐套矩阵、目标快照和差异计算；现有裁片放行数据文件负责 Mock 仓储、版本历史和跨页面查询。裁片放行页面按标准列表页重写，详情采用颜色分组矩阵和局部交互；补料、裁片单、唛架、铺布、交接和车缝页面只增加与该事实链直接相关的最小适配。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有标准列表页组件、Node/tsx 检查脚本、Playwright。

---

## 0. 实现前提与执行顺序

- 在专用 `codex/` worktree 中执行，不直接在受保护主工作区实现。
- 开始前运行 `codegraph sync`、`codegraph status` 和 `git status --short`。
- 严格按任务 1 至任务 9 顺序执行；每个任务先写失败检查，再写最小实现，再提交。
- 不引入后端、API、状态管理框架或 React 页面迁移。
- 不修改用户现有的 `docs/product-design/铺布单优化产品需求文档.md`。
- 设计依据：`docs/superpowers/specs/2026-07-19-cut-piece-release-matrix-design.md`。

## 1. 文件结构与职责

### 新建文件

| 文件 | 职责 |
| --- | --- |
| `src/data/fcs/cut-piece-release-domain.ts` | 定义裁片事实、必需部位、矩阵、目标快照、差异和纯计算函数 |
| `scripts/check-cut-piece-release-matrix.ts` | 验证齐套算法、版本幂等、冻结/恢复、冲销、目标快照、补料展开和交接快照 |
| `tests/cut-piece-release-matrix.spec.ts` | 验证列表、矩阵视觉、目标交互、详情抽屉、历史、补料跳转和低分辨率 |
| `docs/prototype-review-records/2026-07-19-cut-piece-release-matrix.md` | 记录印尼裁床文员、页面模式、防错、异常追溯和低分辨率自查 |

### 修改文件

| 文件 | 职责 |
| --- | --- |
| `src/data/fcs/cut-piece-release.ts` | 移除车缝任务比例兜底，改为当前矩阵仓储、版本历史、目标快照和兼容摘要入口 |
| `src/pages/process-factory/cutting/cut-piece-release.ts` | 改为标准生产单列表和已确认样式的矩阵详情，使用局部 DOM 更新 |
| `src/pages/process-factory/cutting/supplement-management.ts` | 保留独立创建，新增裁片放行目标快照创建路径 |
| `src/pages/process-factory/cutting/cut-orders.ts` | 关闭/重新打开时展示矩阵影响，并写入冻结/恢复版本事件 |
| `src/pages/process-factory/cutting/marker-plan.ts` | 统一“删除草稿/作废方案”终态文案和关联铺布阻断提示 |
| `src/pages/process-factory/cutting/marker-spreading-model.ts` | 为铺布作废结果增加明确状态和冲销元数据 |
| `src/pages/process-factory/cutting/marker-spreading.ts` | 增加待铺布作废、铺布中阻断、已完成冲销入口和反馈 |
| `src/data/fcs/cutting/handover-orders.ts` | 在裁片交接快照中保存最低齐套数量、多余裁片和最低回货要求 |
| `src/pages/process-factory/cutting/handover-orders.ts` | 展示放行矩阵来源、最低回货要求与多余裁片 |
| `src/pages/sewing-dispatch-workbench.ts` | 将旧“放行判断”摘要改为当前齐套/目标/数据变化摘要 |
| `tests/supplement-management-list-template.spec.ts` | 增加目标快照进入补料的回归场景，保留独立创建回归 |
| `scripts/check-cutting-marker-spreading-actions.ts` | 检查铺布作废状态规则与页面动作入口 |
| `package.json` | 增加领域检查和页面 E2E 命令，并纳入裁床检查集合 |

## 2. 任务 1：建立纯齐套计算领域

**文件：**
- 创建：`src/data/fcs/cut-piece-release-domain.ts`
- 创建：`scripts/check-cut-piece-release-matrix.ts`

- [ ] **步骤 1：先写 Black 示例和多部位瓶颈失败检查**

在 `scripts/check-cut-piece-release-matrix.ts` 写入首组检查。数据必须包含四种物料以及一个需要前片、后片两个部位的物料：

```ts
import assert from 'node:assert/strict'
import {
  buildReleaseMatrix,
  type CutPieceFact,
  type CutPieceRequirement,
} from '../src/data/fcs/cut-piece-release-domain.ts'

const requirements: CutPieceRequirement[] = [
  { requirementId: 'a-front', productionOrderId: 'po-14671', garmentColor: 'Black', size: 'M', materialId: 'A', materialName: '面料 A · 净色', partId: 'front', partName: '前片', piecesPerGarment: 2 },
  { requirementId: 'a-back', productionOrderId: 'po-14671', garmentColor: 'Black', size: 'M', materialId: 'A', materialName: '面料 A · 净色', partId: 'back', partName: '后片', piecesPerGarment: 1 },
  { requirementId: 'b-front', productionOrderId: 'po-14671', garmentColor: 'Black', size: 'M', materialId: 'B', materialName: '面料 B · 白色条', partId: 'front', partName: '前片', piecesPerGarment: 2 },
  { requirementId: 'c-front', productionOrderId: 'po-14671', garmentColor: 'Black', size: 'M', materialId: 'C', materialName: '面料 C · 兰色条', partId: 'front', partName: '前片', piecesPerGarment: 2 },
  { requirementId: 'd-front', productionOrderId: 'po-14671', garmentColor: 'Black', size: 'M', materialId: 'D', materialName: '面料 D · 灰色条', partId: 'front', partName: '前片', piecesPerGarment: 2 },
]

const facts: CutPieceFact[] = [
  { factId: 'f-a-front', sourceEventId: 'spread-a', productionOrderId: 'po-14671', cutOrderId: 'cut-1', cutOrderNo: 'CUT-01', spreadingOrderNo: 'PB-01', garmentColor: 'Black', size: 'M', materialId: 'A', partId: 'front', actualPieceQty: 440, direction: 1, sourceStatus: '持续更新', occurredAt: '2026-07-19 08:00' },
  { factId: 'f-a-back', sourceEventId: 'spread-a', productionOrderId: 'po-14671', cutOrderId: 'cut-1', cutOrderNo: 'CUT-01', spreadingOrderNo: 'PB-01', garmentColor: 'Black', size: 'M', materialId: 'A', partId: 'back', actualPieceQty: 240, direction: 1, sourceStatus: '持续更新', occurredAt: '2026-07-19 08:00' },
  { factId: 'f-b-front', sourceEventId: 'spread-b', productionOrderId: 'po-14671', cutOrderId: 'cut-2', cutOrderNo: 'CUT-02', spreadingOrderNo: 'PB-02', garmentColor: 'Black', size: 'M', materialId: 'B', partId: 'front', actualPieceQty: 400, direction: 1, sourceStatus: '已冻结', occurredAt: '2026-07-19 09:00' },
  { factId: 'f-c-front', sourceEventId: 'spread-c', productionOrderId: 'po-14671', cutOrderId: 'cut-3', cutOrderNo: 'CUT-03', spreadingOrderNo: 'PB-03', garmentColor: 'Black', size: 'M', materialId: 'C', partId: 'front', actualPieceQty: 416, direction: 1, sourceStatus: '持续更新', occurredAt: '2026-07-19 10:00' },
  { factId: 'f-d-front', sourceEventId: 'spread-d', productionOrderId: 'po-14671', cutOrderId: 'cut-4', cutOrderNo: 'CUT-04', spreadingOrderNo: 'PB-04', garmentColor: 'Black', size: 'M', materialId: 'D', partId: 'front', actualPieceQty: 400, direction: 1, sourceStatus: '持续更新', occurredAt: '2026-07-19 11:00' },
]

const matrix = buildReleaseMatrix({
  productionOrderId: 'po-14671',
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { 'Black::M': 215 },
  requirements,
  facts,
})

assert.deepEqual(matrix.colorGroups[0].materialRows.map((row) => row.cells.M.availableGarmentQty), [220, 200, 208, 200])
assert.equal(matrix.colorGroups[0].completeKitBySize.M, 200)
console.log('cut piece release matrix check passed')
```

- [ ] **步骤 2：运行检查，确认领域文件尚不存在而失败**

运行：

```bash
npx tsx scripts/check-cut-piece-release-matrix.ts
```

预期：FAIL，错误指出无法找到 `src/data/fcs/cut-piece-release-domain.ts` 或导出函数不存在。

- [ ] **步骤 3：实现类型和纯函数**

在 `src/data/fcs/cut-piece-release-domain.ts` 定义以下公开类型：

```ts
export type ReleaseSourceStatus = '持续更新' | '已冻结' | '已冲销'
export type MatrixCalculationStatus = '可计算' | '数据不完整' | '暂无有效裁片'
export type MatrixTargetStatus = '待确认' | '已确认' | '目标后数据已变化'

export interface CutPieceRequirement {
  requirementId: string
  productionOrderId: string
  garmentColor: string
  size: string
  materialId: string
  materialName: string
  partId: string
  partName: string
  piecesPerGarment: number
}

export interface CutPieceFact {
  factId: string
  sourceEventId: string
  productionOrderId: string
  cutOrderId: string
  cutOrderNo: string
  spreadingOrderNo: string
  garmentColor: string
  size: string
  materialId: string
  partId: string
  actualPieceQty: number
  direction: 1 | -1
  sourceStatus: ReleaseSourceStatus
  occurredAt: string
}

export interface ReleasePartCalculation {
  partId: string
  partName: string
  actualPieceQty: number
  piecesPerGarment: number
  availableGarmentQty: number
  sourceFactIds: string[]
}

export interface ReleaseMatrixCell {
  size: string
  availableGarmentQty: number | null
  calculationStatus: MatrixCalculationStatus
  partCalculations: ReleasePartCalculation[]
  sourceStatus: Exclude<ReleaseSourceStatus, '已冲销'>
}

export interface ReleaseMaterialRow {
  materialId: string
  materialName: string
  cells: Record<string, ReleaseMatrixCell>
}

export interface ReleaseColorGroup {
  garmentColor: string
  sizes: string[]
  planQtyBySize: Record<string, number>
  materialRows: ReleaseMaterialRow[]
  completeKitBySize: Record<string, number | null>
}

export interface CutPieceReleaseMatrix {
  productionOrderId: string
  productionOrderNo: string
  spuCode: string
  calculationStatus: MatrixCalculationStatus
  colorGroups: ReleaseColorGroup[]
}
```

实现数量聚合时，按 `sourceEventId + garmentColor + size + materialId + partId + direction` 去重，并将正向与反向事实相加；结果不得小于 0。不能只按 `factId` 去重，因为重复送达的同一业务事件可能生成不同本地标识。实现单元格与齐套最小值函数：

```ts
function calculatePartAvailable(actualPieceQty: number, piecesPerGarment: number): number | null {
  if (!Number.isFinite(piecesPerGarment) || piecesPerGarment <= 0) return null
  return Math.floor(Math.max(actualPieceQty, 0) / piecesPerGarment)
}

function calculateCell(parts: ReleasePartCalculation[]): number | null {
  if (!parts.length || parts.some((part) => part.availableGarmentQty < 0)) return null
  return Math.min(...parts.map((part) => part.availableGarmentQty))
}

function calculateCompleteKit(rows: ReleaseMaterialRow[], size: string): number | null {
  const values = rows.map((row) => row.cells[size]?.availableGarmentQty ?? null)
  if (!values.length || values.some((value) => value === null)) return null
  return Math.min(...values.map((value) => Number(value)))
}
```

`buildReleaseMatrix()` 必须按 `garmentColor::size::materialId::partId` 聚合事实，缺少必需部位时返回“数据不完整”，没有任何有效事实时返回“暂无有效裁片”。

- [ ] **步骤 4：运行检查确认齐套算法通过**

运行：`npx tsx scripts/check-cut-piece-release-matrix.ts`

预期：PASS，且进程退出码为 0。

- [ ] **步骤 5：提交纯领域实现**

```bash
git add src/data/fcs/cut-piece-release-domain.ts scripts/check-cut-piece-release-matrix.ts
git commit -m "feat: 建立裁片齐套矩阵计算"
```

## 3. 任务 2：建立版本历史、目标快照与补料缺口展开

**文件：**
- 修改：`src/data/fcs/cut-piece-release-domain.ts`
- 修改：`src/data/fcs/cut-piece-release.ts`
- 修改：`scripts/check-cut-piece-release-matrix.ts`

- [ ] **步骤 1：增加目标、幂等、冻结、冲销和补料展开失败检查**

在检查脚本的领域导入中增加 `buildTargetPreview`、`buildSupplementPartShortages`、`createMatrixEventState` 和 `appendMatrixEvent`，再追加以下断言：

```ts
const target = buildTargetPreview(matrix, { 'Black::M': 208 })
assert.equal(target.colorSizeTargets['Black::M'], 208)
assert.equal(target.differences.find((row) => row.materialId === 'B')?.differenceQty, -8)
assert.equal(target.differences.find((row) => row.materialId === 'C')?.differenceQty, 0)
assert.equal(target.differences.find((row) => row.materialId === 'A')?.differenceQty, 12)

const shortageParts = buildSupplementPartShortages(matrix, target)
assert.deepEqual(
  shortageParts.filter((row) => row.materialId === 'B').map((row) => ({ actualMissingPieceQty: row.actualMissingPieceQty, supplementGarmentQty: row.supplementGarmentQty })),
  [{ actualMissingPieceQty: 16, supplementGarmentQty: 8 }],
)

const eventState = createMatrixEventState()
appendMatrixEvent(eventState, { eventId: 'spread-b', eventType: '铺布完成', productionOrderId: 'po-14671', occurredAt: '2026-07-19 09:00', operator: 'Rini' })
appendMatrixEvent(eventState, { eventId: 'spread-b', eventType: '铺布完成', productionOrderId: 'po-14671', occurredAt: '2026-07-19 09:00', operator: 'Rini' })
assert.equal(eventState.events.length, 1)
```

再覆盖冻结、恢复和冲销：同一裁片单冻结后仍计入数量，来源状态变为“已冻结”；恢复后变回“持续更新”；加入方向为 `-1` 的冲销事实后数量下降但原事实仍存在。

- [ ] **步骤 2：运行检查确认新导出尚不存在**

运行：`npx tsx scripts/check-cut-piece-release-matrix.ts`

预期：FAIL，错误指出 `buildTargetPreview`、`buildSupplementPartShortages` 或事件仓储函数未导出。

- [ ] **步骤 3：实现目标与差异类型**

在领域文件增加：

```ts
export type TargetDifferenceStatus = '需补' | '刚好' | '多余'

export interface ReleaseTargetDifference {
  garmentColor: string
  size: string
  materialId: string
  materialName: string
  availableGarmentQty: number
  targetQty: number
  differenceQty: number
  status: TargetDifferenceStatus
}

export interface ReleaseTargetPreview {
  colorSizeTargets: Record<string, number>
  differences: ReleaseTargetDifference[]
}

export interface SupplementPartShortage {
  garmentColor: string
  size: string
  materialId: string
  materialName: string
  partId: string
  partName: string
  targetQty: number
  actualPieceQty: number
  piecesPerGarment: number
  actualMissingPieceQty: number
  supplementGarmentQty: number
}
```

`buildTargetPreview()` 必须先验证目标值存在于同一颜色尺码列的候选集合，否则抛出中文业务错误。差异状态由 `availableGarmentQty - targetQty` 唯一决定。`buildSupplementPartShortages()` 使用：

```ts
const actualMissingPieceQty = Math.max(targetQty * part.piecesPerGarment - part.actualPieceQty, 0)
const supplementGarmentQty = actualMissingPieceQty > 0
  ? Math.ceil(actualMissingPieceQty / part.piecesPerGarment)
  : 0
```

领域文件同时定义并导出幂等事件仓储：

```ts
export type MatrixEventType = '铺布完成' | '裁片单冻结' | '裁片单恢复' | '铺布冲销' | '目标确认'

export interface MatrixEvent {
  eventId: string
  eventType: MatrixEventType
  productionOrderId: string
  occurredAt: string
  operator: string
}

export interface MatrixEventState {
  events: MatrixEvent[]
}

export function createMatrixEventState(): MatrixEventState {
  return { events: [] }
}

export function appendMatrixEvent(state: MatrixEventState, event: MatrixEvent): boolean {
  if (state.events.some((item) => item.eventId === event.eventId)) return false
  state.events.push({ ...event })
  return true
}
```

- [ ] **步骤 4：将现有数据文件改为生产单矩阵仓储**

移除 `decisionProfiles`、`getCutCompletedQty()`、`clampReleaseQty()` 和默认比例计算。保留文件路径作为跨页面入口。仓储输入输出类型固定为：

```ts
export interface ConfirmReleaseTargetInput {
  productionOrderId: string
  matrixVersion: number
  colorSizeTargets: Record<string, number>
  confirmedBy: string
}

export interface ConfirmReleaseTargetResult {
  ok: boolean
  message: string
  snapshot: CutPieceReleaseTargetSnapshot | null
}

export interface CutPieceReleaseRecord {
  recordId: string
  productionOrderId: string
  productionOrderNo: string
  spuCode: string
  spuName: string
  matrixStatus: MatrixCalculationStatus
  targetStatus: MatrixTargetStatus
  frozenCutOrderCount: number
  shortageCellCount: number
  latestUpdateAt: string
  matrix: CutPieceReleaseMatrix
}

export interface CutPieceReleaseMatrixVersion {
  version: number
  productionOrderId: string
  eventId: string
  eventType: MatrixEventType
  occurredAt: string
  operator: string
  matrixSnapshot: CutPieceReleaseMatrix
}

export interface CutPieceReleaseTargetSnapshot {
  snapshotId: string
  productionOrderId: string
  matrixVersion: number
  confirmedAt: string
  confirmedBy: string
  matrixSnapshot: CutPieceReleaseMatrix
  targetPreview: ReleaseTargetPreview
}

export interface CutOrderReleaseStatusChangeInput {
  cutOrderId: string
  cutOrderNo: string
  status: '已冻结' | '持续更新'
  occurredAt: string
  operator: string
  reason: string
}

export interface SpreadingReleaseAdjustmentInput {
  adjustmentEventId: string
  spreadingOrderNo: string
  productionOrderId: string
  direction: -1
  occurredAt: string
  operator: string
  reason: string
}
```

公开以下查询和写入函数：

```ts
export function listCutPieceReleaseRecords(): CutPieceReleaseRecord[]
export function getCutPieceReleaseRecord(recordId: string): CutPieceReleaseRecord | null
export function getCutPieceReleaseMatrix(productionOrderId: string): CutPieceReleaseMatrix | null
export function listCutPieceReleaseMatrixVersions(productionOrderId: string): CutPieceReleaseMatrixVersion[]
export function confirmCutPieceReleaseTarget(input: ConfirmReleaseTargetInput): ConfirmReleaseTargetResult
export function getCutPieceReleaseTargetSnapshot(snapshotId: string): CutPieceReleaseTargetSnapshot | null
export function recordCutOrderReleaseStatusChange(input: CutOrderReleaseStatusChangeInput): void
export function recordSpreadingReleaseAdjustment(input: SpreadingReleaseAdjustmentInput): void
export function getCutPieceReleaseSummaryForProductionOrder(productionOrderId: string): CutPieceReleaseSummary | null
```

Mock 主场景必须直接形成 Black 的 `220/358/532`、`200/350/500`、`208/364/520`、`200/350/500` 四行，并包含两个不同物料共享 L=350 的场景。仓储以 `sourceEventId` 幂等；目标快照复制完整矩阵，不持有可变引用。

- [ ] **步骤 5：运行领域检查**

运行：`npx tsx scripts/check-cut-piece-release-matrix.ts`

预期：PASS；输出包含 `cut piece release matrix check passed`。

- [ ] **步骤 6：提交版本和快照仓储**

```bash
git add src/data/fcs/cut-piece-release-domain.ts src/data/fcs/cut-piece-release.ts scripts/check-cut-piece-release-matrix.ts
git commit -m "feat: 增加裁片矩阵版本与目标快照"
```

## 4. 任务 3：将裁片放行列表改为标准列表页

**文件：**
- 修改：`src/pages/process-factory/cutting/cut-piece-release.ts:1-496`
- 修改：`scripts/check-cut-piece-release-matrix.ts`

- [ ] **步骤 1：添加标准列表契约失败检查**

检查脚本顶部增加 `readFileSync` 和 `resolve` 导入，然后检查页面源码必须包含：

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const releasePageSource = readFileSync(resolve('src/pages/process-factory/cutting/cut-piece-release.ts'), 'utf8')
for (const token of [
  '// @page-pattern: list',
  'renderStandardListPage',
  'renderStandardListTable',
  'renderTablePagination',
  'higood:list-page:/fcs/craft/cutting/cut-piece-release',
  'data-cut-piece-release-action="open-matrix"',
]) {
  assert.ok(releasePageSource.includes(token), `裁片放行列表缺少标准契约：${token}`)
}
```

- [ ] **步骤 2：运行检查确认失败**

运行：`npx tsx scripts/check-cut-piece-release-matrix.ts`

预期：FAIL，指出缺少标准列表页契约。

- [ ] **步骤 3：重写列表状态与渲染骨架**

文件首行加入 `// @page-pattern: list`。列表状态固定为：

```ts
interface CutPieceReleasePageState {
  keywordDraft: string
  keyword: string
  matrixStatus: '全部' | MatrixCalculationStatus
  targetStatus: '全部' | MatrixTargetStatus
  page: number
  sort: StandardListSortState | null
  columnPreferences: StandardListColumnPreferences
  columnSettingsOpen: boolean
  draggedColumnKey: string
  activeRecordId: string
  activeColor: string
  targetMode: boolean
  targetDraft: Record<string, number>
  activeCell: { materialId: string; size: string } | null
  historyOpen: boolean
  feedback: { tone: 'success' | 'warning'; message: string } | null
}
```

列固定为：生产单、SPU/款式、颜色/尺码、矩阵状态、目标状态、补料缺口、冻结裁片单、最近更新、操作。生产单、矩阵状态和操作为必需列；操作列固定右侧。使用 `renderStandardListPage()`、`renderStandardListTable()`、`renderTablePagination()`，列偏好存储键为 `higood:list-page:/fcs/craft/cutting/cut-piece-release`。

筛选输入仅更新 `keywordDraft`；点击查询或按 Enter 后更新 `keyword` 并局部刷新统计、表格和分页。分页尺寸为 10、20、50。

- [ ] **步骤 4：运行标准治理与领域检查**

运行：

```bash
npx tsx scripts/check-cut-piece-release-matrix.ts
npm run check:list-page-governance
```

预期：两个命令均 PASS，裁片放行页面不进入历史基线豁免。

- [ ] **步骤 5：提交标准列表页**

```bash
git add src/pages/process-factory/cutting/cut-piece-release.ts scripts/check-cut-piece-release-matrix.ts
git commit -m "feat: 重做裁片放行标准列表"
```

## 5. 任务 4：实现已确认样式的矩阵详情和局部交互

**文件：**
- 修改：`src/pages/process-factory/cutting/cut-piece-release.ts`
- 创建：`tests/cut-piece-release-matrix.spec.ts`

- [ ] **步骤 1：编写矩阵视觉和目标交互 E2E 失败测试**

创建 Playwright 测试，使用实际页面路由：

```ts
import { expect, test } from '@playwright/test'

test('按已确认样式展示 Black 矩阵并选择目标', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/cut-piece-release')
  await page.getByRole('button', { name: '查看矩阵' }).first().click()

  const matrix = page.getByTestId('cut-piece-release-color-matrix').filter({ hasText: 'Black' })
  await expect(matrix.getByText('面料 A · 净色')).toBeVisible()
  await expect(matrix.getByText('面料 B · 白色条')).toBeVisible()
  await expect(matrix.getByText('当前齐套数量')).toBeVisible()
  await expect(matrix.getByTestId('complete-kit-Black-M')).toHaveText('200')
  await expect(matrix.getByTestId('complete-kit-Black-L')).toHaveText('350')
  await expect(matrix.getByTestId('complete-kit-Black-XL')).toHaveText('500')

  await page.getByRole('button', { name: '选择目标' }).click()
  await matrix.getByTestId('candidate-Black-M-C').click()
  await matrix.getByTestId('candidate-Black-L-B').click()
  await matrix.getByTestId('candidate-Black-XL-C').click()

  await expect(matrix.getByTestId('cell-Black-M-B')).toContainText('需补 8 件')
  await expect(matrix.getByTestId('cell-Black-L-D')).toContainText('刚好')
  await expect(matrix.getByTestId('cell-Black-XL-A')).toContainText('多 12 件')
  await page.getByRole('button', { name: '保存目标' }).click()
  await expect(page.getByText('目标已按当前矩阵版本保存')).toBeVisible()
})

test('单元格详情不展开为主表行', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/cut-piece-release')
  await page.getByRole('button', { name: '查看矩阵' }).first().click()
  await page.getByTestId('cell-Black-M-B').click()
  await expect(page.getByTestId('cut-piece-release-cell-drawer')).toContainText('400 片 ÷ 2 片/件 = 200 件')
  await expect(page.getByTestId('cut-piece-release-cell-drawer')).toContainText('CUT-02')
})
```

- [ ] **步骤 2：运行单文件 E2E 确认失败**

运行：`npx playwright test tests/cut-piece-release-matrix.spec.ts`

预期：FAIL，页面尚无 `cut-piece-release-color-matrix` 和候选单元格。

- [ ] **步骤 3：实现固定矩阵结构**

为每个颜色组渲染：计划数量行、各物料行、当前齐套数量表尾、来源状态列。测试标识遵循：

```ts
function releaseCellTestId(color: string, size: string, materialId: string): string {
  return `cell-${color}-${size}-${materialId}`
}

function releaseCandidateTestId(color: string, size: string, materialId: string): string {
  return `candidate-${color}-${size}-${materialId}`
}
```

视觉类名固定语义：

```ts
const differenceTone: Record<TargetDifferenceStatus, string> = {
  需补: 'text-rose-600',
  刚好: 'border-2 border-yellow-400 bg-yellow-100 text-yellow-900',
  多余: 'text-emerald-600',
}
```

计划行使用浅蓝背景；当前齐套表尾加粗；冻结来源显示“已冻结，不再更新”。不得渲染手工放行数量输入框和通用判断下拉框。

- [ ] **步骤 4：实现局部刷新函数**

页面只允许以下区域局部更新：

```ts
function setReleaseRegion(name: 'feedback' | 'list' | 'pagination' | 'matrix' | 'overlay', html: string): void {
  const host = document.querySelector<HTMLElement>(`[data-cut-piece-release-region="${name}"]`)
  if (host) host.innerHTML = html
}

function refreshTargetMatrix(): void {
  setReleaseRegion('matrix', renderActiveMatrix())
}

function refreshReleaseOverlay(): void {
  setReleaseRegion('overlay', renderReleaseOverlay())
}
```

候选点击只更新矩阵区域；打开单元格详情只更新右侧抽屉容器；关闭抽屉保留颜色分组和横向滚动位置。键盘聚焦候选单元格后按 Enter 执行相同动作。

- [ ] **步骤 5：实现目标保存与历史抽屉**

保存前显示颜色尺码目标、缺口数、刚好数、多余数和当前版本。保存调用 `confirmCutPieceReleaseTarget()`；历史抽屉分页展示铺布完成、冻结、恢复、冲销和目标确认版本。

- [ ] **步骤 6：运行领域检查和 E2E**

运行：

```bash
npx tsx scripts/check-cut-piece-release-matrix.ts
npx playwright test tests/cut-piece-release-matrix.spec.ts
```

预期：两个命令均 PASS。

- [ ] **步骤 7：提交矩阵详情**

```bash
git add src/pages/process-factory/cutting/cut-piece-release.ts tests/cut-piece-release-matrix.spec.ts
git commit -m "feat: 实现裁片放行目标矩阵"
```

## 6. 任务 5：增加目标快照补料入口，同时保留独立创建

**文件：**
- 修改：`src/pages/process-factory/cutting/supplement-management.ts:49-272, 687-920, 1860-2025, 2157-2390`
- 修改：`src/pages/process-factory/cutting/cut-piece-release.ts`
- 修改：`tests/supplement-management-list-template.spec.ts`
- 修改：`tests/cut-piece-release-matrix.spec.ts`

- [ ] **步骤 1：先写快照跳转和独立创建并存测试**

在裁片放行 E2E 中保存目标后点击“去补料管理”，断言 URL 包含 `mode=create` 和 `releaseSnapshotId`。在补料 E2E 中增加：

```ts
test('目标快照预填缺口且独立创建入口仍可用', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/cut-piece-release')
  await page.getByRole('button', { name: '查看矩阵' }).first().click()
  await page.getByRole('button', { name: '选择目标' }).click()
  await page.getByTestId('candidate-Black-M-C').click()
  await page.getByTestId('candidate-Black-L-B').click()
  await page.getByTestId('candidate-Black-XL-C').click()
  await page.getByRole('button', { name: '保存目标' }).click()
  await page.getByRole('button', { name: '去补料管理' }).click()

  await expect(page).toHaveURL(/supplement-management\?mode=create&releaseSnapshotId=/)
  await expect(page.getByText('来源：裁片放行目标快照')).toBeVisible()
  await expect(page.getByText('面料 B · 白色条')).toBeVisible()
  await expect(page.getByText('实际缺片 16 片')).toBeVisible()
  await expect(page.getByText('建议补料 8 件')).toBeVisible()

  await page.goto('/fcs/craft/cutting/supplement-management?mode=create')
  await expect(page.getByRole('button', { name: '按生产单选择' })).toBeVisible()
  await expect(page.getByRole('button', { name: '按裁片单选择' })).toBeVisible()
})
```

- [ ] **步骤 2：运行两个 E2E 文件确认失败**

运行：

```bash
npx playwright test tests/cut-piece-release-matrix.spec.ts tests/supplement-management-list-template.spec.ts
```

预期：FAIL，快照参数和预填明细尚未实现。

- [ ] **步骤 3：增加快照来源类型与 URL 解析**

将补料记录来源扩展为三类，但人工来源选择器继续只允许生产单和裁片单：

```ts
type SupplementManualSourceType = 'production-order' | 'cut-order'
type SupplementSourceType = SupplementManualSourceType | 'release-snapshot'

interface SupplementSourcePickerState {
  sourceType: SupplementManualSourceType
  keyword: string
  selectedCandidateId: string
}

const sourceTypeLabels: Record<SupplementSourceType, string> = {
  'production-order': '生产单',
  'cut-order': '裁片单',
  'release-snapshot': '裁片放行目标快照',
}

function getReleaseSnapshotIdFromRoute(): string {
  const storePath = appStore.getState().pathname || ''
  const browserPath = typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search}`
    : ''
  const query = (browserPath || storePath).split('?')[1] || ''
  return new URLSearchParams(query).get('releaseSnapshotId') || ''
}
```

快照入口不得走现有 A/B 基准分析；直接读取 `getCutPieceReleaseTargetSnapshot()` 和 `buildSupplementPartShortages()`，按颜色、尺码、物料、纸样/部位生成 `SupplementLine`。独立生产单和裁片单入口保持现有交互与确认链。

- [ ] **步骤 4：补充草稿来源追溯字段**

`SupplementDraft` 增加可选字段：

```ts
releaseSnapshotId?: string
releaseMatrixVersion?: number
releaseTargetConfirmedAt?: string
```

确认补料后保留这些字段；后续矩阵变化不修改已经创建的 `SupplementRecord`。矩阵只回显关联状态，不把补料数量计入有效裁片。

- [ ] **步骤 5：实现放行页跳转**

保存目标成功后生成：

```ts
const path = `/fcs/craft/cutting/supplement-management?mode=create&releaseSnapshotId=${encodeURIComponent(snapshot.snapshotId)}`
appStore.navigate(path)
```

没有缺口时不显示主操作“去补料管理”。

- [ ] **步骤 6：运行回归**

运行：

```bash
npx tsx scripts/check-cut-piece-release-matrix.ts
npx playwright test tests/cut-piece-release-matrix.spec.ts tests/supplement-management-list-template.spec.ts
npm run check:standard-list-page-template
```

预期：全部 PASS；独立创建和快照创建同时可用。

- [ ] **步骤 7：提交补料快照入口**

```bash
git add src/pages/process-factory/cutting/supplement-management.ts src/pages/process-factory/cutting/cut-piece-release.ts tests/cut-piece-release-matrix.spec.ts tests/supplement-management-list-template.spec.ts
git commit -m "feat: 打通放行快照补料入口"
```

## 7. 任务 6：打通裁片单冻结、恢复和迟到数据提示

**文件：**
- 修改：`src/pages/process-factory/cutting/cut-orders.ts:906-1005, 2648-2705`
- 修改：`src/data/fcs/cut-piece-release.ts`
- 修改：`scripts/check-cut-piece-release-matrix.ts`
- 修改：`tests/cut-piece-release-matrix.spec.ts`

- [ ] **步骤 1：增加关闭影响与恢复检查**

领域检查验证：关闭裁片单后既有数量仍计入矩阵，单元格来源状态为“已冻结”；重复关闭不生成新版本；恢复后生成新版本并允许继续追加铺布事实；关闭时间之后到达且未批准的事实进入 `lateEvents`，不进入当前数量。

E2E 验证关闭页面出现“放行矩阵影响”，列出冻结颜色尺码和最后有效数量。

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npx tsx scripts/check-cut-piece-release-matrix.ts
npx playwright test tests/cut-piece-release-matrix.spec.ts
```

预期：FAIL，冻结版本事件和关闭影响摘要尚未实现。

- [ ] **步骤 3：实现关闭影响查询和事件写入**

数据仓储公开：

```ts
export interface CutOrderReleaseImpactSummary {
  cutOrderId: string
  cutOrderNo: string
  affectedCells: Array<{
    garmentColor: string
    size: string
    materialName: string
    availableGarmentQty: number
  }>
  activeSpreadingOrderNos: string[]
}

export function getCutOrderReleaseImpactSummary(cutOrderId: string): CutOrderReleaseImpactSummary
```

关闭页面在提交按钮上方展示影响摘要。存在进行中铺布时阻断提交，并显示具体铺布单号。关闭成功后调用：

```ts
recordCutOrderReleaseStatusChange({
  cutOrderId: row.cutOrderId,
  cutOrderNo: row.cutOrderNo,
  status: '已冻结',
  occurredAt: closedAt,
  operator: state.closeDraft.closedBy,
  reason: state.closeDraft.closeDescription,
})
```

重新打开时以 `status: '持续更新'` 写入恢复版本。保持现有关闭记录与重新打开记录，不建立第二套关闭账。

- [ ] **步骤 4：实现迟到数据异常展示**

矩阵详情顶部显示“关闭后收到 N 条待处理铺布数据”，历史抽屉列出来源铺布单、到达时间和未计入原因。只有重新打开或经冲销/修正确认的新事件才能进入当前矩阵。

- [ ] **步骤 5：运行检查并提交**

运行：

```bash
npx tsx scripts/check-cut-piece-release-matrix.ts
npx playwright test tests/cut-piece-release-matrix.spec.ts
```

预期：PASS。

```bash
git add src/pages/process-factory/cutting/cut-orders.ts src/data/fcs/cut-piece-release.ts scripts/check-cut-piece-release-matrix.ts tests/cut-piece-release-matrix.spec.ts
git commit -m "feat: 联动裁片单冻结与放行矩阵"
```

## 8. 任务 7：统一唛架作废和铺布作废冲销

**文件：**
- 修改：`src/pages/process-factory/cutting/marker-plan.ts:1613-1650, 4808-4868`
- 修改：`src/pages/process-factory/cutting/marker-spreading-model.ts:17-25, 531-795, 3387-3415`
- 修改：`src/pages/process-factory/cutting/marker-spreading.ts`
- 修改：`src/data/fcs/cut-piece-release.ts`
- 修改：`scripts/check-cutting-marker-spreading-actions.ts`
- 修改：`scripts/check-cut-piece-release-matrix.ts`

- [ ] **步骤 1：增加状态规则失败检查**

在 `scripts/check-cutting-marker-spreading-actions.ts` 检查以下动作和文案存在：

```ts
for (const token of [
  'data-cutting-marker-action="void-spreading"',
  'data-cutting-marker-action="reverse-completed-spreading"',
  '铺布中不能直接作废，请先停止执行并核对实际裁片',
  '已完成铺布只能通过冲销或数据修正处理',
]) {
  assert.ok(pageSource.includes(token), `铺布作废规则缺少：${token}`)
}
assert.ok(!pageSource.includes('关闭唛架'), '页面不得出现“关闭唛架”终态')
```

领域检查验证待铺布作废不改变数量、已完成铺布冲销写入反向事实且矩阵下降、重复冲销不重复扣减。

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:cutting-marker-spreading-actions
npx tsx scripts/check-cut-piece-release-matrix.ts
```

预期：FAIL，铺布作废和冲销动作尚未齐备。

- [ ] **步骤 3：收紧唛架方案终态**

保留草稿“删除草稿”、已确认“作废方案”。`cancelDraftPlan()` 继续阻断所有非 `CANCELED` 关联铺布，但提示按状态区分：待铺布可先作废，铺布中需停止核对，已完成需冲销或修正。页面源码和业务文案均不得出现“关闭唛架”。

- [ ] **步骤 4：实现铺布状态动作**

铺布状态规则固定为：

```ts
function getSpreadingVoidAction(status: SpreadingOrderStatusKey): '直接作废' | '阻断' | '冲销' | '只读' {
  if (status === 'WAITING_SPREADING') return '直接作废'
  if (status === 'SPREADING') return '阻断'
  if (status === 'SPREAD_DONE' || status === 'WAITING_CUTTING' || status === 'CUTTING' || status === 'CUT_DONE') return '冲销'
  return '只读'
}
```

待铺布作废记录原因、时间、操作人，状态变为 `CANCELED`，不生成裁片反向事实。铺布中点击作废只显示阻断反馈。已完成点击“冲销完成数据”要求填写原因，调用 `recordSpreadingReleaseAdjustment()` 生成与原事实数量相反的调整事实，并在铺布详情展示原数量和冲销数量。

- [ ] **步骤 5：运行裁床规则检查**

运行：

```bash
npm run check:cutting-marker-spreading-actions
npm run check:cutting-spreading-create-single-step
npx tsx scripts/check-cut-piece-release-matrix.ts
```

预期：全部 PASS。

- [ ] **步骤 6：提交终态与冲销**

```bash
git add src/pages/process-factory/cutting/marker-plan.ts src/pages/process-factory/cutting/marker-spreading-model.ts src/pages/process-factory/cutting/marker-spreading.ts src/data/fcs/cut-piece-release.ts scripts/check-cutting-marker-spreading-actions.ts scripts/check-cut-piece-release-matrix.ts
git commit -m "feat: 统一唛架与铺布作废规则"
```

## 9. 任务 8：补齐交接快照和车缝摘要

**文件：**
- 修改：`src/data/fcs/cutting/handover-orders.ts`
- 修改：`src/pages/process-factory/cutting/handover-orders.ts`
- 修改：`src/pages/sewing-dispatch-workbench.ts:323-333, 689-705`
- 修改：`src/data/fcs/cut-piece-release.ts`
- 修改：`scripts/check-cut-piece-release-matrix.ts`
- 修改：`tests/cut-piece-release-matrix.spec.ts`

- [ ] **步骤 1：增加交接和摘要失败检查**

领域检查创建交接快照并断言：

```ts
const handover = buildCutPieceReleaseHandoverSnapshot({
  snapshotId: 'target-po14671-v12',
  productionOrderId: 'po-14671',
  batchNo: 'HO-PO14671-01',
  completeKitQtyByColorSize: { 'Black::M': 200, 'Black::L': 350, 'Black::XL': 500 },
  surplusPieces: [
    { garmentColor: 'Black', size: 'M', materialId: 'A', partId: 'front', pieceQty: 24, sourceCutOrderNos: ['CUT-01'], sourceSpreadingOrderNos: ['PB-01'] },
  ],
})
assert.deepEqual(handover.minimumReturnQtyByColorSize, { 'Black::M': 200, 'Black::L': 350, 'Black::XL': 500 })
assert.equal(handover.surplusPieces[0].pieceQty, 24)
```

E2E 断言交接详情同时显示“最低应回”和“多余裁片”，车缝派工摘要显示“当前齐套”而非旧“可以做/部分可以做”。

- [ ] **步骤 2：运行检查确认失败**

运行：`npx tsx scripts/check-cut-piece-release-matrix.ts`

预期：FAIL，交接快照构造函数尚未实现。

- [ ] **步骤 3：扩展交接快照**

在交接数据中增加：

```ts
export interface CutPieceReleaseHandoverSnapshot {
  releaseTargetSnapshotId: string
  productionOrderId: string
  batchNo: string
  completeKitQtyByColorSize: Record<string, number>
  minimumReturnQtyByColorSize: Record<string, number>
  surplusPieces: Array<{
    garmentColor: string
    size: string
    materialId: string
    partId: string
    pieceQty: number
    sourceCutOrderNos: string[]
    sourceSpreadingOrderNos: string[]
  }>
}
```

在同一数据文件实现并导出：

```ts
export function buildCutPieceReleaseHandoverSnapshot(input: Omit<CutPieceReleaseHandoverSnapshot, 'releaseTargetSnapshotId' | 'minimumReturnQtyByColorSize'> & { snapshotId: string }): CutPieceReleaseHandoverSnapshot {
  return {
    releaseTargetSnapshotId: input.snapshotId,
    productionOrderId: input.productionOrderId,
    batchNo: input.batchNo,
    completeKitQtyByColorSize: { ...input.completeKitQtyByColorSize },
    minimumReturnQtyByColorSize: { ...input.completeKitQtyByColorSize },
    surplusPieces: input.surplusPieces.map((item) => ({
      ...item,
      sourceCutOrderNos: [...item.sourceCutOrderNos],
      sourceSpreadingOrderNos: [...item.sourceSpreadingOrderNos],
    })),
  }
}
```

最低回货要求复制交接时实际齐套数量，不复制目标数量。多余裁片单独保存，不能相加到最低回货要求。

- [ ] **步骤 4：更新交接和车缝页面**

交接详情增加“裁片放行依据”“最低应回数量”“多余裁片”三个区块。车缝派工摘要使用以下兼容摘要，不显示旧通用决策徽标：

```ts
export interface CutPieceReleaseSummary {
  productionOrderId: string
  productionOrderNo: string
  matrixStatus: MatrixCalculationStatus
  targetStatus: MatrixTargetStatus
  currentCompleteKitQtyByColorSize: Record<string, number | null>
  targetQtyByColorSize: Record<string, number>
  shortageCellCount: number
  latestMatrixVersion: number
  latestUpdatedAt: string
}
```

若目标后数据变化，明确提示重新确认；摘要中的当前齐套始终来自当前矩阵，目标数量始终来自最近一次不可变目标快照。

- [ ] **步骤 5：运行检查和 E2E**

运行：

```bash
npx tsx scripts/check-cut-piece-release-matrix.ts
npx playwright test tests/cut-piece-release-matrix.spec.ts
npm run check:cutting-sewing-dispatch
```

预期：全部 PASS。

- [ ] **步骤 6：提交下游展示**

```bash
git add src/data/fcs/cutting/handover-orders.ts src/pages/process-factory/cutting/handover-orders.ts src/pages/sewing-dispatch-workbench.ts src/data/fcs/cut-piece-release.ts scripts/check-cut-piece-release-matrix.ts tests/cut-piece-release-matrix.spec.ts
git commit -m "feat: 记录裁片交接最低回货与余片"
```

## 10. 任务 9：治理、自查和完整验收

**文件：**
- 修改：`package.json`
- 创建：`docs/prototype-review-records/2026-07-19-cut-piece-release-matrix.md`
- 修改：`tests/cut-piece-release-matrix.spec.ts`

- [ ] **步骤 1：增加 package 命令**

加入：

```json
{
  "check:cut-piece-release-matrix": "tsx scripts/check-cut-piece-release-matrix.ts",
  "test:cut-piece-release-matrix:e2e": "PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=$(node -e \"const net=require('node:net');const server=net.createServer();server.listen(0,'127.0.0.1',()=>{console.log(server.address().port);server.close()})\") playwright test tests/cut-piece-release-matrix.spec.ts"
}
```

将 `npm run check:cut-piece-release-matrix` 加入 `check:cutting:all`，不删除现有裁床检查。

- [ ] **步骤 2：补充低分辨率与局部交互 E2E**

在 E2E 中分别设置 `1366 × 768`、`1280 × 720`，断言页面主体无横向溢出，矩阵容器可以横向滚动，操作列保持可见。输入搜索、打开抽屉、选择目标前后记录 `window.scrollY`，断言没有整页跳动。

- [ ] **步骤 3：填写原型审查记录**

按模板填写：

- 角色：印尼裁床办公室文员、裁床主管。
- 端类型：管理端 Web。
- 主任务：查看实际齐套、选择目标、识别补料并追溯冻结/冲销。
- 重点标签：`算不准`、`选不对`、`状态抽象`、`追溯不足`。
- 逐项记录矩阵颜色语义、中文状态、目标候选限制、补料独立边界、低分辨率、分页、固定操作列和局部更新。
- 最终结论只有在浏览器验收完成后填写“通过”。

- [ ] **步骤 4：运行全部相关检查**

按顺序运行：

```bash
npm run check:cut-piece-release-matrix
npm run check:list-page-governance
npm run check:standard-list-page-template
npm run check:cutting-marker-spreading-actions
npm run check:cutting-spreading-create-single-step
npm run check:cutting-sewing-dispatch
npm run check:prototype-design-governance
npm run test:cut-piece-release-matrix:e2e
npm run test:supplement-management-list-template:e2e
npm run build
```

预期：所有命令退出码为 0，Playwright 无失败用例，构建成功。

- [ ] **步骤 5：在真实浏览器完成视觉验收**

启动：

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

依次检查：

- `/fcs/craft/cutting/cut-piece-release`
- `/fcs/craft/cutting/supplement-management`
- `/fcs/craft/cutting/cut-orders`
- `/fcs/craft/cutting/marker-list`
- `/fcs/craft/cutting/spreading`

重点核对 Black 矩阵必须与规格第 7.3 节一致；不得接受仅有数字正确但页面结构、黄色目标、红色缺口、绿色余量或灰色冻结不一致的结果。

- [ ] **步骤 6：同步 CodeGraph 并审查改动范围**

运行：

```bash
codegraph sync
codegraph status
git diff --check
git status --short
```

预期：CodeGraph 显示索引最新；不存在与本需求无关的改动；用户原有未跟踪文档不被暂存。

- [ ] **步骤 7：提交治理和验收材料**

```bash
git add package.json tests/cut-piece-release-matrix.spec.ts docs/prototype-review-records/2026-07-19-cut-piece-release-matrix.md
git commit -m "test: 完成裁片放行矩阵验收"
```

## 11. 最终完成定义

只有同时满足以下条件才可报告实现完成：

- Black 示例矩阵的齐套、目标、缺口、刚好和多余结果全部正确。
- 目标只能从同列物料候选值选择，不能手工输入。
- 当前矩阵一张、历史多版本、目标快照不可变。
- 裁片单关闭冻结、重新打开恢复、迟到数据阻断可演示。
- 唛架方案只有删除草稿和作废方案两种终止表达，不出现“关闭唛架”。
- 待铺布、铺布中、已完成铺布的作废/冲销规则各自正确。
- 补料快照入口与生产单、裁片单独立创建同时可用。
- 补料单创建不增加矩阵数量，只有有效补裁事实更新矩阵。
- 交接最低回货与多余裁片分别记录，车缝摘要不再使用旧通用判断。
- 列表页治理、原型治理、相关领域检查、Playwright 和构建全部通过。
- 1366 × 768 与 1280 × 720 的真实浏览器样式符合已确认矩阵基准。
