import type { PdaHandoverRecord } from './pda-handover-events.ts'
import { listRegisteredHandoutRecordVersions } from './pda-handover-handout-registry.ts'
import { formatOperationLocalWallClock, type SewingDeliveryReceiptFact } from './sewing-delivery-sla.ts'
import {
  listPostFinishingFactoryReturns,
  listPostFinishingReturnConfirmationVersions,
} from './post-finishing-full-flow.ts'

export interface SewingDeliverySubmissionFact {
  recordId: string
  sourceDocumentNo: string
  submittedQty: number
  submittedAt: string
}

const CONFIRMED_RECEIPT_STATUSES = new Set([
  'WRITTEN_BACK_MATCHED',
  'WRITTEN_BACK_DIFF',
  'DIFF_ACCEPTED',
])

function rawRecordVersionAt(record: PdaHandoverRecord): string {
  if (record.lifecycleUpdatedAt) return record.lifecycleUpdatedAt
  return [record.receiverWrittenAt, record.factorySubmittedAt]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? ''
}

function lifecycleRank(record: PdaHandoverRecord): number {
  if (record.handoverRecordStatus === 'VOIDED') return 4
  if (CONFIRMED_RECEIPT_STATUSES.has(record.handoverRecordStatus ?? '')) return 3
  if (record.handoverRecordStatus === 'SUBMITTED_WAIT_WRITEBACK') return 2
  return 1
}

function rawRecordStableSignature(record: PdaHandoverRecord): string {
  // Legacy records may lack lifecycleUpdatedAt. This fixed-field signature is
  // only a deterministic final fallback, never a substitute for business time.
  return JSON.stringify({
    recordId: record.handoverRecordId || record.recordId,
    taskId: record.taskId,
    handoverId: record.handoverId,
    handoverRecordStatus: record.handoverRecordStatus ?? '',
    status: record.status,
    factorySubmittedAt: record.factorySubmittedAt,
    submittedQty: record.submittedQty ?? record.plannedQty ?? null,
    receiverWrittenAt: record.receiverWrittenAt ?? '',
    receiverWrittenQty: record.receiverWrittenQty ?? null,
    lifecycleUpdatedAt: record.lifecycleUpdatedAt ?? '',
  })
}

function compareRawRecordVersion(left: PdaHandoverRecord, right: PdaHandoverRecord): number {
  const timeOrder = rawRecordVersionAt(left).localeCompare(rawRecordVersionAt(right))
  if (timeOrder !== 0) return timeOrder
  const rankOrder = lifecycleRank(left) - lifecycleRank(right)
  if (rankOrder !== 0) return rankOrder
  return rawRecordStableSignature(left).localeCompare(rawRecordStableSignature(right))
}

export function selectLatestSewingDeliveryRawRecords(
  records: readonly PdaHandoverRecord[],
  nowAt: string = formatOperationLocalWallClock(),
): PdaHandoverRecord[] {
  const latestByRecordId = new Map<string, PdaHandoverRecord>()
  records.filter((record) => rawRecordVersionAt(record) <= nowAt).forEach((record) => {
    const recordId = record.handoverRecordId || record.recordId
    const current = latestByRecordId.get(recordId)
    if (!current || compareRawRecordVersion(record, current) > 0) {
      latestByRecordId.set(recordId, record)
    }
  })
  return Array.from(latestByRecordId.values()).sort((left, right) =>
    (left.handoverRecordId || left.recordId).localeCompare(right.handoverRecordId || right.recordId),
  )
}

export function listLatestSewingDeliveryRawRecords(
  nowAt: string = formatOperationLocalWallClock(),
  runtimeTaskIds?: readonly string[],
): PdaHandoverRecord[] {
  return selectLatestSewingDeliveryRawRecords(listRegisteredHandoutRecordVersions(runtimeTaskIds), nowAt)
}

export function toConfirmedSewingDeliveryReceiptFact(
  record: PdaHandoverRecord,
  runtimeTaskId: string,
): SewingDeliveryReceiptFact | null {
  // PDA 现场交接只证明“工厂交了、接收方当场点了”，不是 PPIC 正式回货数据。
  // 保留旧导出名称仅防止历史调用方将现场数量静默计入节点。
  void record
  void runtimeTaskId
  return null
}

function toSlaWallClock(value: string): string {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return value
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) throw new Error('后道回货时间无效')
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${parsed.getUTCFullYear()}-${pad(parsed.getUTCMonth() + 1)}-${pad(parsed.getUTCDate())} ${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}:${pad(parsed.getUTCSeconds())}`
}

export function listSewingDeliverySubmissionFacts(
  runtimeTaskId: string,
  nowAt: string = formatOperationLocalWallClock(),
): SewingDeliverySubmissionFact[] {
  return listPostFinishingFactoryReturns()
    .filter((delivery) => delivery.executionTaskId === runtimeTaskId)
    .map((delivery) => ({
      recordId: delivery.deliveryId,
      sourceDocumentNo: delivery.deliveryOrderNo,
      submittedQty: delivery.lines.reduce((sum, line) => sum + line.registeredQty, 0),
      submittedAt: toSlaWallClock(delivery.registeredAt),
    }))
    .filter((fact) => fact.submittedAt <= nowAt)
    .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt) || left.recordId.localeCompare(right.recordId))
}

export function listSewingDeliveryReceiptFacts(
  runtimeTaskId: string,
  nowAt: string = formatOperationLocalWallClock(),
): SewingDeliveryReceiptFact[] {
  const deliveryById = new Map(listPostFinishingFactoryReturns().map((delivery) => [delivery.deliveryId, delivery] as const))
  return listPostFinishingReturnConfirmationVersions({ executionTaskId: runtimeTaskId, activeOnly: true })
    .map((version): SewingDeliveryReceiptFact | null => {
      const delivery = deliveryById.get(version.deliveryId)
      if (!delivery) return null
      return {
        recordId: version.confirmationVersionId,
        submittedQty: version.registeredQty,
        submittedAt: toSlaWallClock(delivery.registeredAt),
        receivedQty: version.confirmedQty,
        receivedAt: toSlaWallClock(version.confirmedAt),
        voided: false,
      }
    })
    .filter((fact): fact is SewingDeliveryReceiptFact => fact !== null && fact.receivedAt <= nowAt)
    .sort((left, right) => left.receivedAt.localeCompare(right.receivedAt) || left.recordId.localeCompare(right.recordId))
}

export function sumSewingDeliveryConfirmedReceiptQty(
  runtimeTaskId: string,
  nowAt: string = formatOperationLocalWallClock(),
): number {
  return listSewingDeliveryReceiptFacts(runtimeTaskId, nowAt).reduce(
    (sum, fact) => sum + (fact.voided ? 0 : fact.receivedQty),
    0,
  )
}
