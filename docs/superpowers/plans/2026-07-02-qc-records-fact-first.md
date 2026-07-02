# 质检记录事实优先实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `质检记录` 页面改为质检事实优先，并接入后道工厂质检单的 SKU 级返工事实；扣款/对账只弱化展示对账单号与扣款明细号。

**架构：** 新增一个页面级 `fact-view.ts` 适配器，聚合现有质量链路和后道质检单，不改原始领域模型。列表页和详情页只消费这个事实视图，隐藏财务工作台信息。验证用一个轻量脚本覆盖适配器、列表和详情输出。

**技术栈：** Vite、TypeScript、Vanilla TypeScript 字符串模板、现有 `tsx` 检查脚本。

---

## 文件结构

- 创建：`src/pages/qc-records/fact-view.ts`
  - 职责：只为 `质检记录` 页面提供事实优先的行模型、详情模型和追溯模型。
  - 输入：`listPlatformQcListItems()`、`getPlatformQcDetailViewModelByRouteKey()`、`listPostFinishingQcOrders()`。
  - 输出：`listQcFactRows()`、`getQcFactDetail()`。
- 修改：`src/pages/qc-records/context.ts`
  - 职责：把列表筛选数据源切到事实视图，保留现有 listState，不扩大事件模型。
- 修改：`src/pages/qc-records/list-domain.ts`
  - 职责：移除财务工作台主视图，渲染事实优先列表。
- 修改：`src/pages/qc-records/detail-domain.ts`
  - 职责：优先渲染事实详情；后道质检单详情显示 SKU 级返工、瑕疵、返工接收对象和弱化对账追溯。
- 创建：`scripts/check-qc-records-fact-first.ts`
  - 职责：断言事实适配器、列表页和详情页的关键输出。
- 修改：`package.json`
  - 职责：增加 `check:qc-records-fact-first`。

## 任务 1：新增事实视图检查脚本

**文件：**
- 创建：`scripts/check-qc-records-fact-first.ts`
- 修改：`package.json`

- [ ] **步骤 1：编写失败的检查脚本**

创建 `scripts/check-qc-records-fact-first.ts`：

```ts
#!/usr/bin/env node

import { listPostFinishingQcOrders } from '../src/data/fcs/post-finishing-domain.ts'
import { getQcFactDetail, listQcFactRows } from '../src/pages/qc-records/fact-view.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

const postQc = listPostFinishingQcOrders().find((record) =>
  (record.qcSkuResults ?? []).some((item) => (item.reworkQty ?? 0) > 0 || (item.defectAcceptedQty ?? 0) > 0),
)

assert(postQc, '缺少带返工或瑕疵事实的后道质检单样例')

const rows = listQcFactRows({ includeLegacy: false })
const postRow = rows.find((row) => row.id === postQc!.actionRecordId)

assert(postRow, '质检记录事实列表缺少后道质检单')
assert(postRow!.displayNo === postQc!.actionRecordNo, '后道质检单号未保留')
assert(postRow!.sourceKind === 'POST_FINISHING_QC', '后道质检单来源类型错误')
assert(postRow!.reworkQty > 0, '后道返工数量未进入质检记录事实列表')
assert(postRow!.reworkReceivers !== '—', '返工接收对象未进入质检记录事实列表')
assert(postRow!.defectQty >= 0, '瑕疵数量必须有明确数值')
assert(postRow!.settlementTrace.statusLabel === '待对账引用' || postRow!.settlementTrace.statusLabel === '未进入对账', '后道质检单对账追溯状态错误')

const detail = getQcFactDetail(postQc!.actionRecordId)
assert(detail, '质检记录详情无法通过后道质检单 ID 打开')
assert(detail!.skuResults.length > 0, '后道质检记录详情缺少 SKU 级明细')
assert(detail!.skuResults.some((item) => item.reworkQty > 0), 'SKU 级返工数量未保留')
assert(detail!.skuResults.some((item) => item.reworkReceiveFactoryName !== '—'), 'SKU 级返工接收对象未保留')
assert(detail!.skuResults.some((item) => item.defectReasonSummary !== '—'), 'SKU 级瑕疵原因未保留')

const platformRow = rows.find((row) => row.sourceKind === 'QUALITY_CHAIN')
assert(platformRow, '现有质量链路质检记录被误删')
assert(platformRow!.settlementTrace.statusLabel, '现有质量链路缺少对账追溯状态')

console.log('check:qc-records-fact-first passed')
```

在 `package.json` 的 `scripts` 中加入：

```json
"check:qc-records-fact-first": "tsx scripts/check-qc-records-fact-first.ts"
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
npm run check:qc-records-fact-first
```

预期：FAIL，报错包含 `Cannot find module '../src/pages/qc-records/fact-view.ts'`。

- [ ] **步骤 3：提交失败检查**

```bash
git add package.json scripts/check-qc-records-fact-first.ts
git commit -m "test: add qc records fact-first check"
```

## 任务 2：实现页面级事实适配器

**文件：**
- 创建：`src/pages/qc-records/fact-view.ts`
- 测试：`scripts/check-qc-records-fact-first.ts`

- [ ] **步骤 1：实现最小事实模型**

创建 `src/pages/qc-records/fact-view.ts`，保留下面这些导出名称和字段名：

```ts
import {
  getPlatformQcDetailViewModelByRouteKey,
  listPlatformQcListItems,
  type PlatformQcDetailViewModel,
  type PlatformQcListItem,
} from '../../data/fcs/quality-deduction-selectors.ts'
import {
  listPostFinishingQcOrders,
  type PostFinishingActionRecord,
  type PostFinishingEvidenceAsset,
  type PostFinishingQcSkuResult,
} from '../../data/fcs/post-finishing-domain.ts'

export type QcFactSourceKind = 'QUALITY_CHAIN' | 'POST_FINISHING_QC'
export type QcSettlementTraceStatus = '未进入对账' | '待对账引用' | '已进入对账'

export interface QcSettlementTrace {
  statementNo?: string
  deductionLineNo?: string
  statusLabel: QcSettlementTraceStatus
}

export interface QcFactSkuResult {
  skuCode: string
  colorName: string
  sizeName: string
  imageUrl?: string
  inspectedQty: number
  qualifiedQty: number
  reworkQty: number
  defectQty: number
  reworkReceiveFactoryName: string
  defectReasonSummary: string
  postProjectSummary: string
  qtyUnit: string
}

export interface QcFactRow {
  id: string
  displayNo: string
  sourceKind: QcFactSourceKind
  sourceTypeLabel: string
  productionOrderNo: string
  skuSummary: string
  sourceFactoryName: string
  receiverName: string
  inspectedQty: number
  qualifiedQty: number
  reworkQty: number
  defectQty: number
  reworkReceivers: string
  resultLabel: string
  inspectedAt: string
  inspectorName: string
  settlementTrace: QcSettlementTrace
}

export interface QcFactDetail extends QcFactRow {
  qcStationName: string
  skuResults: QcFactSkuResult[]
  evidenceAssets: Array<{ assetId: string; name: string; assetType: 'IMAGE' | 'VIDEO' | 'DOCUMENT'; url?: string }>
  rawFacts: Array<{ label: string; value: string }>
}

export interface QcFactListOptions {
  includeLegacy?: boolean
}

function sumSku(results: PostFinishingQcSkuResult[], key: 'reworkQty' | 'defectAcceptedQty'): number {
  return results.reduce((sum, item) => sum + (Number(item[key]) || 0), 0)
}

function uniqueText(values: Array<string | undefined>): string {
  const text = Array.from(new Set(values.map((item) => item?.trim()).filter(Boolean) as string[])).join('、')
  return text || '—'
}

function summarizeDefectReasons(result: PostFinishingQcSkuResult): string {
  const summary = (result.defectReasonItems ?? [])
    .filter((item) => (Number(item.qty) || 0) > 0)
    .map((item) => `${item.reasonName}${item.qty}`)
    .join('、')
  return summary || '—'
}

function summarizePostProjects(result: PostFinishingQcSkuResult): string {
  const summary = (result.postProjectJudgements ?? [])
    .filter((item) => item.needed)
    .map((item) => item.projectName === '装扣子' && item.buttonAttachMode ? `${item.projectName}（${item.buttonAttachMode}）` : item.projectName)
    .join('、')
  return summary || '—'
}

function hasSourceChargeback(record: PostFinishingActionRecord): boolean {
  return (record.qcSkuResults ?? []).some((item) => item.sourceChargeback || (Number(item.reworkDeductionAmountIdr) || 0) > 0)
}

function platformTrace(row: PlatformQcListItem): QcSettlementTrace {
  if (row.includedSettlementStatementId) {
    return {
      statementNo: row.includedSettlementStatementId,
      deductionLineNo: row.basisId,
      statusLabel: '已进入对账',
    }
  }
  if (row.basisId) {
    return {
      deductionLineNo: row.basisId,
      statusLabel: '待对账引用',
    }
  }
  return { statusLabel: '未进入对账' }
}

function postTrace(record: PostFinishingActionRecord): QcSettlementTrace {
  if (record.qualityDeductionSnapshot?.qcId) {
    return {
      deductionLineNo: record.qualityDeductionSnapshot.qcId,
      statusLabel: '待对账引用',
    }
  }
  return { statusLabel: hasSourceChargeback(record) ? '待对账引用' : '未进入对账' }
}

function mapPlatformRow(row: PlatformQcListItem): QcFactRow {
  return {
    id: row.qcId,
    displayNo: row.qcNo,
    sourceKind: 'QUALITY_CHAIN',
    sourceTypeLabel: row.processLabel,
    productionOrderNo: row.productionOrderId,
    skuSummary: row.batchId || row.sourceTaskId || '—',
    sourceFactoryName: row.returnFactoryName || '—',
    receiverName: row.warehouseName || '—',
    inspectedQty: row.inspectedQty,
    qualifiedQty: row.qualifiedQty,
    reworkQty: 0,
    defectQty: row.unqualifiedQty,
    reworkReceivers: '—',
    resultLabel: row.qcResultLabel,
    inspectedAt: row.inspectedAt,
    inspectorName: row.inspector || '—',
    settlementTrace: platformTrace(row),
  }
}

function mapPostSku(result: PostFinishingQcSkuResult): QcFactSkuResult {
  return {
    skuCode: result.skuCode,
    colorName: result.colorName,
    sizeName: result.sizeName,
    imageUrl: result.skuImageUrl,
    inspectedQty: Number(result.inspectedQty) || 0,
    qualifiedQty: Number(result.qualifiedQty) || 0,
    reworkQty: Number(result.reworkQty) || 0,
    defectQty: Number(result.defectAcceptedQty) || 0,
    reworkReceiveFactoryName: result.reworkReceiveFactoryName || '—',
    defectReasonSummary: summarizeDefectReasons(result),
    postProjectSummary: summarizePostProjects(result),
    qtyUnit: result.qtyUnit || '件',
  }
}

function mapPostRow(record: PostFinishingActionRecord): QcFactRow {
  const skuResults = record.qcSkuResults ?? []
  const reworkQty = Number(record.reworkGarmentQty) || sumSku(skuResults, 'reworkQty')
  const defectQty = Number(record.defectAcceptedGarmentQty) || sumSku(skuResults, 'defectAcceptedQty')
  return {
    id: record.actionRecordId,
    displayNo: record.actionRecordNo,
    sourceKind: 'POST_FINISHING_QC',
    sourceTypeLabel: '后道质检单',
    productionOrderNo: record.warehouseAllocations?.[0]?.productionOrderNo || record.qualityDeductionSnapshot?.productionOrderNo || '—',
    skuSummary: uniqueText(record.skuLines.map((item) => item.skuCode)),
    sourceFactoryName: record.sourceFactoryName || '—',
    receiverName: record.targetFactoryName || '—',
    inspectedQty: Number(record.inspectedGarmentQty ?? record.submittedGarmentQty) || 0,
    qualifiedQty: Number(record.passedGarmentQty ?? record.acceptedGarmentQty) || 0,
    reworkQty,
    defectQty,
    reworkReceivers: uniqueText(skuResults.filter((item) => (Number(item.reworkQty) || 0) > 0).map((item) => item.reworkReceiveFactoryName)),
    resultLabel: record.qcResult || record.status,
    inspectedAt: record.finishedAt || record.startedAt || '—',
    inspectorName: record.operatorName || '—',
    settlementTrace: postTrace(record),
  }
}

function normalizePostEvidenceType(assetType: PostFinishingEvidenceAsset['assetType']): 'IMAGE' | 'VIDEO' | 'DOCUMENT' {
  if (assetType === '图片') return 'IMAGE'
  if (assetType === '视频') return 'VIDEO'
  return 'DOCUMENT'
}

function postEvidence(asset: PostFinishingEvidenceAsset): QcFactDetail['evidenceAssets'][number] {
  return {
    assetId: asset.assetId,
    name: asset.assetName,
    url: asset.url,
    assetType: normalizePostEvidenceType(asset.assetType),
  }
}

function mapPlatformDetail(vm: PlatformQcDetailViewModel): QcFactDetail {
  const row: QcFactRow = {
    id: vm.qcId,
    displayNo: vm.qcNo,
    sourceKind: 'QUALITY_CHAIN',
    sourceTypeLabel: vm.qcRecord.processLabel,
    productionOrderNo: vm.qcRecord.productionOrderNo,
    skuSummary: vm.qcRecord.returnInboundBatchNo || vm.qcRecord.taskId || '—',
    sourceFactoryName: vm.qcRecord.returnFactoryName ?? '—',
    receiverName: vm.qcRecord.receiverName ?? vm.qcRecord.warehouseName ?? '—',
    inspectedQty: vm.qcRecord.inspectedQty,
    qualifiedQty: vm.qcRecord.qualifiedQty,
    reworkQty: 0,
    defectQty: vm.qcRecord.unqualifiedQty,
    reworkReceivers: '—',
    resultLabel: vm.qcResultLabel,
    inspectedAt: vm.qcRecord.inspectedAt,
    inspectorName: vm.qcRecord.inspectorUserName || '—',
    settlementTrace: vm.settlementImpact.includedSettlementStatementId
      ? {
          statementNo: vm.settlementImpact.includedSettlementStatementId,
          deductionLineNo: vm.deductionBasis?.basisId,
          statusLabel: '已进入对账',
        }
      : vm.deductionBasis?.basisId
        ? {
            deductionLineNo: vm.deductionBasis.basisId,
            statusLabel: '待对账引用',
          }
        : { statusLabel: '未进入对账' },
  }
  return {
    ...row,
    qcStationName: vm.qcRecord.receiverName ?? vm.qcRecord.warehouseName ?? '—',
    skuResults: vm.qcRecord.defectItems.map((item) => ({
      skuCode: vm.qcRecord.productionOrderNo,
      colorName: '—',
      sizeName: '—',
      inspectedQty: vm.qcRecord.inspectedQty,
      qualifiedQty: vm.qcRecord.qualifiedQty,
      reworkQty: 0,
      defectQty: item.qty,
      reworkReceiveFactoryName: '—',
      defectReasonSummary: `${item.defectName}${item.qty}`,
      postProjectSummary: '—',
      qtyUnit: '件',
    })),
    evidenceAssets: vm.qcRecord.evidenceAssets.map((item) => ({
      assetId: item.assetId,
      name: item.name,
      url: item.url,
      assetType: item.assetType,
    })),
    rawFacts: [
      { label: '来源批次', value: vm.qcRecord.returnInboundBatchNo || '—' },
      { label: '来源任务', value: vm.qcRecord.taskId || '—' },
      { label: '接收方', value: vm.qcRecord.receiverName ?? vm.qcRecord.warehouseName ?? '—' },
    ],
  }
}

function mapPostDetail(record: PostFinishingActionRecord): QcFactDetail {
  return {
    ...mapPostRow(record),
    qcStationName: record.qcStationName || '—',
    skuResults: (record.qcSkuResults ?? []).map(mapPostSku),
    evidenceAssets: (record.evidenceAssets ?? []).map(postEvidence),
    rawFacts: [
      { label: '来源后道单', value: record.postOrderNo || '—' },
      { label: '上游工厂', value: record.sourceFactoryName || '—' },
      { label: '后道工厂', value: record.targetFactoryName || '—' },
    ],
  }
}

export function listQcFactRows(options: QcFactListOptions = {}): QcFactRow[] {
  const qualityRows = listPlatformQcListItems({ includeLegacy: options.includeLegacy }).map(mapPlatformRow)
  const postRows = listPostFinishingQcOrders().map(mapPostRow)
  return [...postRows, ...qualityRows].sort((left, right) => right.inspectedAt.localeCompare(left.inspectedAt))
}

export function getQcFactDetail(id: string): QcFactDetail | null {
  const postRecord = listPostFinishingQcOrders().find((record) =>
    record.actionRecordId === id || record.actionRecordNo === id || record.linkedQcOrderId === id,
  )
  if (postRecord) return mapPostDetail(postRecord)

  const platformVm = getPlatformQcDetailViewModelByRouteKey(id)
  return platformVm ? mapPlatformDetail(platformVm) : null
}
```

- [ ] **步骤 2：运行事实视图检查**

运行：

```bash
npm run check:qc-records-fact-first
```

预期：PASS，输出 `check:qc-records-fact-first passed`。

- [ ] **步骤 3：提交事实适配器**

```bash
git add src/pages/qc-records/fact-view.ts
git commit -m "feat: add qc records fact view"
```

## 任务 3：列表页改成事实优先

**文件：**
- 修改：`src/pages/qc-records/context.ts`
- 修改：`src/pages/qc-records/list-domain.ts`
- 修改：`scripts/check-qc-records-fact-first.ts`

- [ ] **步骤 1：扩展检查脚本验证列表输出**

在 `scripts/check-qc-records-fact-first.ts` 增加导入：

```ts
import { renderQcRecordsPage } from '../src/pages/qc-records/list-domain.ts'
```

在 `console.log` 前增加：

```ts
const listHtml = renderQcRecordsPage()

assert(listHtml.includes('质检事实优先查看回货质检、后道质检和后道复检。'), '列表页说明文案仍偏财务工作台')
assert(listHtml.includes('返工数量'), '列表页缺少返工数量列')
assert(listHtml.includes('返工接收对象'), '列表页缺少返工接收对象列')
assert(listHtml.includes('对账追溯'), '列表页缺少弱化对账追溯列')
assert(listHtml.includes(postQc!.actionRecordNo), '列表页缺少后道质检单号')
assert(!listHtml.includes('工厂响应'), '列表页不应把工厂响应作为主视图')
assert(!listHtml.includes('异议状态'), '列表页不应把异议状态作为主视图')
assert(!listHtml.includes('来源反扣金额'), '列表页不应显示来源反扣金额')
assert(!listHtml.includes('对账提示状态'), '列表页不应显示对账提示状态')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
npm run check:qc-records-fact-first
```

预期：FAIL，报错包含 `列表页说明文案仍偏财务工作台` 或 `列表页缺少返工数量列`。

- [ ] **步骤 3：改 `context.ts` 使用事实视图**

在 `src/pages/qc-records/context.ts` 中新增导入：

```ts
import {
  listQcFactRows,
  type QcFactRow,
} from './fact-view'
```

把 `getQcViewRows()` 改为：

```ts
function getQcViewRows(): QcFactRow[] {
  return listQcFactRows({ includeLegacy: listState.showLegacy })
}
```

把 `getFilteredQcRows()` 中仍然适用的筛选保留为：

```ts
function getFilteredQcRows(): QcFactRow[] {
  const keyword = listState.keyword.trim().toLowerCase()

  return getQcViewRows()
    .filter((row) => {
      if (listState.filterInspector !== 'ALL' && row.inspectorName !== listState.filterInspector) return false
      if (listState.filterFactory !== 'ALL' && row.sourceFactoryName !== listState.filterFactory) return false
      if (listState.filterWarehouse !== 'ALL' && row.receiverName !== listState.filterWarehouse) return false

      if (keyword) {
        const haystack = [
          row.id,
          row.displayNo,
          row.productionOrderNo,
          row.skuSummary,
          row.sourceFactoryName,
          row.receiverName,
          row.reworkReceivers,
          row.settlementTrace.statementNo ?? '',
          row.settlementTrace.deductionLineNo ?? '',
        ].join(' ').toLowerCase()
        if (!haystack.includes(keyword)) return false
      }

      return true
    })
    .sort((left, right) => right.inspectedAt.localeCompare(left.inspectedAt))
}
```

把 `getFactoryOptions()`、`getWarehouseOptions()`、`getInspectorOptions()` 内部字段改为：

```ts
if (row.sourceFactoryName && row.sourceFactoryName !== '-') options.add(row.sourceFactoryName)
if (row.receiverName && row.receiverName !== '-') options.add(row.receiverName)
if (row.inspectorName && row.inspectorName !== '-') options.add(row.inspectorName)
```

- [ ] **步骤 4：改 `list-domain.ts` 渲染事实列**

在 `src/pages/qc-records/list-domain.ts` 中移除质量扣款工作台相关导入，保留 UI 组件导入。把 `buildTableColumns()` 替换为事实列：

```ts
function traceText(row: QcRow): string {
  if (row.settlementTrace.statusLabel === '已进入对账') {
    return `对账单：${row.settlementTrace.statementNo ?? '—'} / 扣款明细：${row.settlementTrace.deductionLineNo ?? '—'}`
  }
  if (row.settlementTrace.statusLabel === '待对账引用') {
    return row.settlementTrace.deductionLineNo ? `待对账引用 / 扣款明细：${row.settlementTrace.deductionLineNo}` : '待对账引用'
  }
  return '未进入对账'
}

function buildTableColumns(): TableColumn<QcRow>[] {
  return [
    {
      key: 'qcNo',
      title: '质检单号',
      className: 'align-top',
      render: (row) => `<button type="button" class="font-mono text-xs font-semibold text-primary hover:underline" data-qcr-action="open-detail" data-qcr-href="${escapeHtml(buildQcDetailHref(row.id))}">${escapeHtml(row.displayNo)}</button>`,
    },
    { key: 'source', title: '来源类型', className: 'align-top', render: (row) => escapeHtml(row.sourceTypeLabel) },
    {
      key: 'object',
      title: '生产单 / SKU',
      className: 'align-top',
      render: (row) => `<div class="space-y-1">${renderProductionOrderIdentityCell(row.productionOrderNo || '—')}<div class="break-words text-xs text-muted-foreground">${escapeHtml(row.skuSummary || '—')}</div></div>`,
    },
    { key: 'inspected', title: '质检数量', className: 'align-top', render: (row) => String(row.inspectedQty) },
    { key: 'qualified', title: '合格数量', className: 'align-top', render: (row) => String(row.qualifiedQty) },
    { key: 'rework', title: '返工数量', className: 'align-top', render: (row) => String(row.reworkQty) },
    { key: 'defect', title: '瑕疵数量', className: 'align-top', render: (row) => String(row.defectQty) },
    { key: 'receiver', title: '返工接收对象', className: 'align-top', render: (row) => escapeHtml(row.reworkReceivers) },
    { key: 'result', title: '质检结果', className: 'align-top', render: (row) => renderBadge(row.resultLabel, row.reworkQty > 0 || row.defectQty > 0 ? 'warning' : 'success') },
    {
      key: 'time',
      title: '质检时间',
      className: 'align-top',
      render: (row) => `<div>${escapeHtml(formatDateTime(row.inspectedAt))}</div><div class="text-xs text-muted-foreground">${escapeHtml(row.inspectorName)}</div>`,
    },
    {
      key: 'trace',
      title: '对账追溯',
      className: 'align-top',
      render: (row) => `<span class="text-xs text-muted-foreground">${escapeHtml(traceText(row))}</span>`,
    },
    {
      key: 'actions',
      title: '操作',
      className: 'align-top',
      render: (row) => `<button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(buildQcDetailHref(row.id))}">查看详情</button>`,
    },
  ]
}
```

把 `renderFilters()` 缩减为关键词、来源工厂、接收方、质检人、显示旧记录和重置。

把 `renderQcRecordsPage()` 的说明和主体改为：

```ts
export function renderQcRecordsPage(): string {
  const rows = getFilteredQcRows()

  return `
    <div class="flex flex-col gap-6 p-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">质检记录</h1>
        <p class="mt-1 text-sm text-muted-foreground">质检事实优先查看回货质检、后道质检和后道复检。</p>
      </div>

      ${renderFilters()}

      <section class="rounded-md border bg-card">
        ${renderTable(buildTableColumns(), rows, { emptyText: '当前筛选下暂无质检记录', striped: true })}
      </section>
    </div>`
}
```

- [ ] **步骤 5：运行检查验证通过**

运行：

```bash
npm run check:qc-records-fact-first
```

预期：PASS，输出 `check:qc-records-fact-first passed`。

- [ ] **步骤 6：提交列表改造**

```bash
git add src/pages/qc-records/context.ts src/pages/qc-records/list-domain.ts scripts/check-qc-records-fact-first.ts
git commit -m "feat: make qc records list fact first"
```

## 任务 4：详情页改成事实优先

**文件：**
- 修改：`src/pages/qc-records/detail-domain.ts`
- 修改：`scripts/check-qc-records-fact-first.ts`

- [ ] **步骤 1：扩展检查脚本验证详情输出**

在 `scripts/check-qc-records-fact-first.ts` 增加导入：

```ts
import { renderQcRecordDetailPage } from '../src/pages/qc-records/detail-domain.ts'
```

在 `console.log` 前增加：

```ts
const detailHtml = renderQcRecordDetailPage(postQc!.actionRecordId)

assert(detailHtml.includes('基本事实'), '详情页缺少基本事实区')
assert(detailHtml.includes('数量事实'), '详情页缺少数量事实区')
assert(detailHtml.includes('SKU 级明细'), '详情页缺少 SKU 级明细区')
assert(detailHtml.includes('对账追溯'), '详情页缺少弱化对账追溯区')
assert(detailHtml.includes('返工数量'), '详情页缺少返工数量')
assert(detailHtml.includes('返工接收对象'), '详情页缺少返工接收对象')
assert(detailHtml.includes('瑕疵原因'), '详情页缺少瑕疵原因')
assert(!detailHtml.includes('工厂响应与异议'), '详情页不应把工厂响应与异议作为主区块')
assert(!detailHtml.includes('来源反扣金额'), '详情页不应显示来源反扣金额')
assert(!detailHtml.includes('裁决意见'), '详情页不应显示裁决过程')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
npm run check:qc-records-fact-first
```

预期：FAIL，报错包含 `详情页缺少基本事实区` 或 `质检记录详情无法通过后道质检单 ID 打开`。

- [ ] **步骤 3：新增事实详情渲染函数**

在 `src/pages/qc-records/detail-domain.ts` 增加导入：

```ts
import {
  getQcFactDetail,
  type QcFactDetail,
  type QcFactSkuResult,
} from './fact-view'
```

新增详情辅助函数：

```ts
function renderFactField(label: string, value: string): string {
  return `<div class="rounded-lg border bg-slate-50 px-3 py-2"><div class="text-xs text-muted-foreground">${escapeHtml(label)}</div><div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(value || '—')}</div></div>`
}

function renderTrace(trace: QcFactDetail['settlementTrace']): string {
  if (trace.statusLabel === '已进入对账') {
    return `对账单：${trace.statementNo ?? '—'} / 扣款明细：${trace.deductionLineNo ?? '—'}`
  }
  if (trace.statusLabel === '待对账引用') {
    return trace.deductionLineNo ? `待对账引用 / 扣款明细：${trace.deductionLineNo}` : '待对账引用'
  }
  return '未进入对账'
}

function renderFactSkuCard(item: QcFactSkuResult): string {
  return `
    <article class="rounded-xl border p-4">
      <div class="flex min-w-0 gap-3">
        <img class="h-12 w-12 rounded border object-cover" src="${escapeHtml(item.imageUrl || 'https://placehold.co/96x96?text=SKU')}" alt="${escapeHtml(item.skuCode)}" />
        <div class="min-w-0">
          <div class="font-medium text-sm">${escapeHtml(item.skuCode)}</div>
          <div class="text-xs text-muted-foreground">${escapeHtml(item.colorName)} / ${escapeHtml(item.sizeName)}</div>
        </div>
      </div>
      <div class="mt-3 grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderFactField('质检数量', `${item.inspectedQty} ${item.qtyUnit}`)}
        ${renderFactField('合格数量', `${item.qualifiedQty} ${item.qtyUnit}`)}
        ${renderFactField('返工数量', `${item.reworkQty} ${item.qtyUnit}`)}
        ${renderFactField('返工接收对象', item.reworkReceiveFactoryName)}
        ${renderFactField('瑕疵数量', `${item.defectQty} ${item.qtyUnit}`)}
        ${renderFactField('瑕疵原因', item.defectReasonSummary)}
        ${renderFactField('后道项目', item.postProjectSummary)}
      </div>
    </article>
  `
}

function renderFactDetailPage(fact: QcFactDetail): string {
  return `
    <div class="flex flex-col gap-6 p-6">
      <header class="rounded-lg border bg-card px-5 py-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-semibold leading-tight">质检记录 ${escapeHtml(fact.displayNo)}</h1>
            <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(fact.sourceTypeLabel)} · ${escapeHtml(fact.productionOrderNo)} · ${escapeHtml(fact.resultLabel)}</p>
          </div>
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-qcd-action="back-list">返回列表</button>
        </div>
      </header>

      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-sm font-semibold">基本事实</h2>
        <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          ${renderFactField('质检单号', fact.displayNo)}
          ${renderFactField('来源类型', fact.sourceTypeLabel)}
          ${renderFactField('生产单', fact.productionOrderNo)}
          ${renderFactField('SKU', fact.skuSummary)}
          ${renderFactField('来源工厂', fact.sourceFactoryName)}
          ${renderFactField('接收方', fact.receiverName)}
          ${renderFactField('质检台', fact.qcStationName)}
          ${renderFactField('质检人 / 时间', `${fact.inspectorName} / ${formatDateTime(fact.inspectedAt)}`)}
        </div>
      </section>

      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-sm font-semibold">数量事实</h2>
        <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          ${renderFactField('质检数量', String(fact.inspectedQty))}
          ${renderFactField('合格数量', String(fact.qualifiedQty))}
          ${renderFactField('返工数量', String(fact.reworkQty))}
          ${renderFactField('瑕疵数量', String(fact.defectQty))}
          ${renderFactField('返工接收对象', fact.reworkReceivers)}
          ${renderFactField('质检结果', fact.resultLabel)}
        </div>
      </section>

      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-sm font-semibold">SKU 级明细</h2>
        <div class="mt-3 space-y-3">${fact.skuResults.length ? fact.skuResults.map(renderFactSkuCard).join('') : '<div class="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">当前记录无 SKU 级明细。</div>'}</div>
      </section>

      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-sm font-semibold">质检证据</h2>
        <div class="mt-3">${fact.evidenceAssets.length ? renderEvidenceAssets(fact.evidenceAssets, '当前暂无检查证据素材。') : '<div class="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">当前暂无检查证据素材。</div>'}</div>
      </section>

      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-sm font-semibold">对账追溯</h2>
        <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(renderTrace(fact.settlementTrace))}</p>
      </section>

      <details class="rounded-lg border bg-card p-4">
        <summary class="cursor-pointer text-sm font-semibold">原始链路信息</summary>
        <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          ${fact.rawFacts.map((item) => renderFactField(item.label, item.value)).join('')}
        </div>
      </details>
    </div>
  `
}
```

- [ ] **步骤 4：让详情入口优先走事实详情**

在 `renderQcRecordDetailPageByVariant()` 开头插入：

```ts
  if (qcId !== 'new') {
    const fact = getQcFactDetail(qcId)
    if (fact) return renderFactDetailPage(fact)
  }
```

保持 `qcId === 'new'` 的新建表单路径不变。

- [ ] **步骤 5：运行检查验证通过**

运行：

```bash
npm run check:qc-records-fact-first
```

预期：PASS，输出 `check:qc-records-fact-first passed`。

- [ ] **步骤 6：提交详情改造**

```bash
git add src/pages/qc-records/detail-domain.ts scripts/check-qc-records-fact-first.ts
git commit -m "feat: make qc records detail fact first"
```

## 任务 5：验证与收口

**文件：**
- 修改：`scripts/check-factory-settlement-qc-boundary.ts`
- 运行验证：`package.json` 中已有命令

- [ ] **步骤 1：更新旧边界检查中的文案断言**

`scripts/check-factory-settlement-qc-boundary.ts` 当前允许 `qcList` 出现 `来源反扣`、`对账待确认`。改为断言 `质检记录` 列表只保留事实与弱追溯：

```ts
assert(qcList.includes('质检事实优先查看回货质检、后道质检和后道复检。'))
assert(qcList.includes('返工数量'))
assert(qcList.includes('返工接收对象'))
assert(qcList.includes('对账追溯'))
assert(!qcList.includes('工厂响应'))
assert(!qcList.includes('异议状态'))
assert(!qcList.includes('来源反扣金额'))
```

- [ ] **步骤 2：运行目标检查**

运行：

```bash
npm run check:qc-records-fact-first
npm run check:post-finishing-qc-result-buckets
npm run check:factory-settlement-qc-boundary
```

预期：三个命令均 PASS。

- [ ] **步骤 3：运行构建**

运行：

```bash
npm run build
```

预期：PASS，Vite 构建完成。

- [ ] **步骤 4：浏览器验证**

启动本地服务：

```bash
npm run dev -- --host 0.0.0.0 --port 63176
```

打开：

```text
http://localhost:63176/fcs/quality/qc-records
```

核对：

- 列表首屏不再显示 `工厂响应`、`异议状态`、`来源反扣金额`。
- 列表能看到后道质检单号 `QC-POST-...`。
- 列表能看到 `返工数量`、`瑕疵数量`、`返工接收对象`。
- 点击后道质检单详情，能看到 `SKU 级明细`、`返工数量`、`返工接收对象`、`瑕疵原因`。
- `对账追溯` 区只显示对账单号和扣款明细号或明确空态，不显示金额和裁决过程。

- [ ] **步骤 5：同步 CodeGraph**

运行：

```bash
codegraph sync && codegraph status
```

预期：`Index is up to date`。

- [ ] **步骤 6：提交验证收口**

```bash
git add scripts/check-factory-settlement-qc-boundary.ts
git commit -m "test: align qc records fact first boundary"
```

## 最终验收命令

实现完成后运行：

```bash
npm run check:qc-records-fact-first
npm run check:post-finishing-qc-result-buckets
npm run check:factory-settlement-qc-boundary
npm run build
codegraph sync && codegraph status
```

全部通过后，再进入代码审查与合并收口。
