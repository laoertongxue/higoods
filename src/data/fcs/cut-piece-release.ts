import { cuttingOrderProgressRecords } from './cutting/order-progress.ts'
import { listGeneratedCutOrderSourceRecords } from './cutting/generated-cut-orders.ts'
import {
  listSewingDispatchWorkbenchTasks,
  type SewingDispatchWorkbenchTask,
  type SewingDispatchWorkbenchRow,
} from './sewing-dispatch-workbench.ts'

export type CutPieceReleaseDecision = '待判断' | '可以做' | '部分可以做' | '暂时不能做'

export interface CutPieceReleaseSkuLine {
  lineId: string
  skuCode: string
  colorName: string
  sizeCode: string
  demandQty: number
  remainingQty: number
  cutCompletedQty: number
  completeKitQty: number
  accessoryReadyQty: number
  releaseQty: number
  reason: string
}

export interface CutPieceReleaseRecord {
  recordId: string
  recordNo: string
  productionOrderId: string
  productionOrderNo: string
  taskId: string
  taskNo: string
  spuCode: string
  spuName: string
  styleImageUrl?: string
  triggerCutOrderNo: string
  sourceCutOrderNos: string[]
  triggerAction: string
  triggerAt: string
  triggerOperator: string
  checkerRole: string
  decision: CutPieceReleaseDecision
  releaseQty: number
  reason: string
  riskNote: string
  judgedBy: string
  judgedAt: string
  skuLines: CutPieceReleaseSkuLine[]
}

export interface CutPieceReleaseSummary {
  recordId: string
  recordNo: string
  productionOrderId: string
  productionOrderNo: string
  decision: CutPieceReleaseDecision
  releaseQty: number
  reason: string
  riskNote: string
  judgedBy: string
  judgedAt: string
}

export interface SaveCutPieceReleaseDecisionInput {
  recordId: string
  decision: CutPieceReleaseDecision
  releaseQty: number
  reason: string
  riskNote: string
  judgedBy: string
}

interface CutPieceReleaseOverride {
  decision: CutPieceReleaseDecision
  releaseQty: number
  reason: string
  riskNote: string
  judgedBy: string
  judgedAt: string
}

const releaseOverrides: Record<string, CutPieceReleaseOverride> = {}

const checkerNames = ['裁床主管 王敏', '裁床主管 林涛', '裁床主管 Sari', '裁床主管 陈佳']
const operatorNames = ['铺布操作员 阿迪', '裁剪操作员 Dimas', '裁剪操作员 小周', '铺布操作员 Rini']

const decisionProfiles: Array<{
  decision: CutPieceReleaseDecision
  ratio: number
  reason: string
  riskNote: string
}> = [
  {
    decision: '部分可以做',
    ratio: 0.62,
    reason: '大身、前后片已完成裁剪并装袋，可先安排基础车缝；袖片仍在补裁，后续批次再交出。',
    riskNote: '跟单需同步车缝厂先做大身工序，等待袖片到位后再合流。',
  },
  {
    decision: '可以做',
    ratio: 1,
    reason: '本生产单当前待分配 SKU 的主要裁片均已有铺布完成裁剪记录，现场核对无明显错码错色。',
    riskNote: '按现有齐套和辅料库存节奏安排即可。',
  },
  {
    decision: '暂时不能做',
    ratio: 0,
    reason: '已裁片中存在颜色混包和尺码标识不清，裁床需要先复核菲票与中转袋。',
    riskNote: '暂缓车缝分配，避免车缝厂收片后返工清点。',
  },
  {
    decision: '待判断',
    ratio: 0,
    reason: '已满足铺布完成裁剪触发条件，等待裁床主管判断是否可以交给车缝做货。',
    riskNote: '跟单暂不依据裁床判断推进车缝分配。',
  },
  {
    decision: '部分可以做',
    ratio: 0.45,
    reason: '基础片可先做一批，口袋、贴布等小部件需要裁床二次清点后补交。',
    riskNote: '只建议先启动首批车缝，剩余数量等待裁床补充确认。',
  },
]

function roundQty(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value)
}

function nowTimestamp(date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function addHours(value: string, hours: number): string {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value || nowTimestamp()
  date.setHours(date.getHours() + hours)
  return nowTimestamp(date)
}

function clampReleaseQty(decision: CutPieceReleaseDecision, baseQty: number, ratio: number): number {
  if (decision === '待判断' || decision === '暂时不能做') return 0
  return Math.min(baseQty, Math.max(1, roundQty(baseQty * ratio)))
}

function getAccessoryReadyQty(row: SewingDispatchWorkbenchRow): number {
  if (row.accessories.statusLabel === '不涉及') return row.remainingQty
  return Math.min(row.remainingQty, row.accessories.completeQty)
}

function getCutCompletedQty(row: SewingDispatchWorkbenchRow, ratio: number): number {
  const knownReadyQty = Math.max(row.completeKitQty, row.normalPieces.completeQty, row.auxiliaryPieces.completeQty)
  if (knownReadyQty > 0) return Math.min(row.remainingQty, knownReadyQty)
  return Math.min(row.remainingQty, Math.max(1, roundQty(row.remainingQty * Math.max(ratio, 0.35))))
}

function buildReleaseSkuLines(task: SewingDispatchWorkbenchTask, decision: CutPieceReleaseDecision, ratio: number): CutPieceReleaseSkuLine[] {
  return task.skuRows.map((row) => {
    const cutCompletedQty = getCutCompletedQty(row, ratio)
    const baseQty = Math.min(row.remainingQty, cutCompletedQty)
    const releaseQty = clampReleaseQty(decision, baseQty, ratio)
    return {
      lineId: `${task.productionOrderId}:${row.skuCode}:${row.colorName}:${row.sizeCode}`,
      skuCode: row.skuCode,
      colorName: row.colorName,
      sizeCode: row.sizeCode,
      demandQty: row.demandQty,
      remainingQty: row.remainingQty,
      cutCompletedQty,
      completeKitQty: row.completeKitQty,
      accessoryReadyQty: getAccessoryReadyQty(row),
      releaseQty,
      reason: releaseQty > 0
        ? '当前裁片实物可支持先做货'
        : decision === '暂时不能做'
          ? '裁床判断暂不交给车缝'
          : '等待裁床主管判断',
    }
  })
}

function getSourceCutOrderNos(task: SewingDispatchWorkbenchTask): string[] {
  return Array.from(new Set([
    ...task.cutOrderClosure.items.map((item) => item.cutOrderNo),
    ...listGeneratedCutOrderSourceRecords()
      .filter((record) => record.productionOrderId === task.productionOrderId)
      .map((record) => record.cutOrderNo),
  ].filter(Boolean)))
}

function getTriggerContext(task: SewingDispatchWorkbenchTask, index: number): Pick<CutPieceReleaseRecord, 'triggerCutOrderNo' | 'sourceCutOrderNos' | 'triggerAction' | 'triggerAt' | 'triggerOperator'> {
  const sourceCutOrderNos = getSourceCutOrderNos(task)
  const progress = cuttingOrderProgressRecords.find((record) => record.productionOrderId === task.productionOrderId)
  const baseAt = progress?.spreadingStartedAt || progress?.lastFieldUpdateAt || '2026-03-18 14:00:00'
  return {
    triggerCutOrderNo: sourceCutOrderNos[0] || '未关联裁片单',
    sourceCutOrderNos,
    triggerAction: '铺布完成裁剪',
    triggerAt: addHours(baseAt, 2 + index),
    triggerOperator: operatorNames[index % operatorNames.length],
  }
}

function applyOverride(record: CutPieceReleaseRecord): CutPieceReleaseRecord {
  const override = releaseOverrides[record.recordId]
  if (!override) return record
  const totalRemainingQty = record.skuLines.reduce((sum, line) => sum + line.remainingQty, 0)
  const releaseQty = Math.min(totalRemainingQty, Math.max(0, roundQty(override.releaseQty)))
  const ratio = totalRemainingQty > 0 ? releaseQty / totalRemainingQty : 0
  return {
    ...record,
    decision: override.decision,
    releaseQty,
    reason: override.reason,
    riskNote: override.riskNote,
    judgedBy: override.judgedBy,
    judgedAt: override.judgedAt,
    skuLines: record.skuLines.map((line) => ({
      ...line,
      releaseQty: clampReleaseQty(override.decision, line.remainingQty, ratio),
      reason: override.decision === '待判断'
        ? '等待裁床主管判断'
        : override.decision === '暂时不能做'
          ? '裁床判断暂不交给车缝'
          : '当前裁片实物可支持先做货',
    })),
  }
}

function buildBaseReleaseRecord(task: SewingDispatchWorkbenchTask, index: number): CutPieceReleaseRecord {
  const profile = decisionProfiles[index % decisionProfiles.length]
  const skuLines = buildReleaseSkuLines(task, profile.decision, profile.ratio)
  const releaseQty = skuLines.reduce((sum, line) => sum + line.releaseQty, 0)
  const trigger = getTriggerContext(task, index)
  const judgedAt = profile.decision === '待判断' ? '' : addHours(trigger.triggerAt, 1)

  return {
    recordId: `cpr-${task.productionOrderId}`,
    recordNo: `CPR-${String(index + 1).padStart(4, '0')}`,
    productionOrderId: task.productionOrderId,
    productionOrderNo: task.productionOrderNo,
    taskId: task.taskId,
    taskNo: task.taskNo,
    spuCode: task.spuCode,
    spuName: task.spuName,
    styleImageUrl: task.styleImageUrl,
    ...trigger,
    checkerRole: '裁床主管',
    decision: profile.decision,
    releaseQty,
    reason: profile.reason,
    riskNote: profile.riskNote,
    judgedBy: profile.decision === '待判断' ? '' : checkerNames[index % checkerNames.length],
    judgedAt,
    skuLines,
  }
}

export function listCutPieceReleaseRecords(): CutPieceReleaseRecord[] {
  return listSewingDispatchWorkbenchTasks()
    .map((task, index) => applyOverride(buildBaseReleaseRecord(task, index)))
}

export function getCutPieceReleaseRecord(recordId: string): CutPieceReleaseRecord | null {
  return listCutPieceReleaseRecords().find((record) => record.recordId === recordId) ?? null
}

export function getCutPieceReleaseSummaryForProductionOrder(productionOrderId: string): CutPieceReleaseSummary | null {
  const record = listCutPieceReleaseRecords().find((item) => item.productionOrderId === productionOrderId)
  if (!record) return null
  return {
    recordId: record.recordId,
    recordNo: record.recordNo,
    productionOrderId: record.productionOrderId,
    productionOrderNo: record.productionOrderNo,
    decision: record.decision,
    releaseQty: record.releaseQty,
    reason: record.reason,
    riskNote: record.riskNote,
    judgedBy: record.judgedBy,
    judgedAt: record.judgedAt,
  }
}

export function saveCutPieceReleaseDecision(input: SaveCutPieceReleaseDecisionInput): { ok: boolean; message: string } {
  const record = getCutPieceReleaseRecord(input.recordId)
  if (!record) return { ok: false, message: '未找到裁片放行记录。' }
  const decision = input.decision
  const releaseQty = roundQty(input.releaseQty)
  const reason = input.reason.trim()
  const riskNote = input.riskNote.trim()
  const judgedBy = input.judgedBy.trim() || '裁床主管'

  if (!reason) return { ok: false, message: '请填写裁床判断原因。' }
  if ((decision === '可以做' || decision === '部分可以做') && releaseQty <= 0) {
    return { ok: false, message: '判断为可以做或部分可以做时，可做数量必须大于 0。' }
  }
  if (decision === '暂时不能做' && releaseQty > 0) {
    return { ok: false, message: '判断为暂时不能做时，可做数量必须为 0。' }
  }

  releaseOverrides[input.recordId] = {
    decision,
    releaseQty: decision === '暂时不能做' || decision === '待判断' ? 0 : releaseQty,
    reason,
    riskNote,
    judgedBy,
    judgedAt: nowTimestamp(),
  }

  return { ok: true, message: `${record.recordNo} 已更新裁片放行判断。` }
}
