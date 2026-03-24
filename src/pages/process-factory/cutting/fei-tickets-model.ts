import type { OriginalCutOrderRow, OriginalCutOrderNavigationPayload } from './original-orders-model'
import type { MaterialPrepRow } from './material-prep-model'
import type { MarkerSpreadingStore } from './marker-spreading-model'
import type { MergeBatchRecord } from './merge-batches-model'
import {
  FEI_QR_SCHEMA_NAME,
  FEI_QR_SCHEMA_VERSION,
  buildFeiQrPayload,
  serializeFeiQrPayload,
} from './fei-qr-model'

const numberFormatter = new Intl.NumberFormat('zh-CN')

export const CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY = 'cuttingFeiTicketDrafts'
export const CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY = 'cuttingFeiTicketRecords'
export const CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY = 'cuttingFeiTicketPrintJobs'

export type FeiTicketsContextType = 'original-order' | 'merge-batch'
export type FeiTicketStatusKey =
  | 'NOT_GENERATED'
  | 'DRAFT'
  | 'PARTIAL_PRINTED'
  | 'PRINTED'
  | 'REPRINTED'
  | 'PENDING_SUPPLEMENT'

export type FeiTicketPrintJobStatus = 'PRINTED' | 'REPRINTED' | 'CANCELLED'

export interface FeiTicketsContext {
  contextType: FeiTicketsContextType
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  mergeBatchId: string
  mergeBatchNo: string
  productionOrderNos: string[]
  styleCode: string
  spuCode: string
  styleName: string
  materialSkuSummary: string
}

export interface FeiQrReservedPayload {
  qrBaseValue: string
  reservedProcessFields: Record<string, string>
  reservedVersion: string
}

export interface FeiNavigationPayload {
  originalOrders: Record<string, string | undefined>
  mergeBatches: Record<string, string | undefined>
  markerSpreading: Record<string, string | undefined>
  replenishment: Record<string, string | undefined>
  summary: Record<string, string | undefined>
  transferBags: Record<string, string | undefined>
}

export interface OriginalCutOrderTicketOwner {
  ownerType: 'original-cut-order'
  id: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  styleName: string
  color: string
  materialSku: string
  plannedTicketQty: number
  printedTicketQty: number
  latestPrintJobNo: string
  ticketStatus: FeiTicketStatusKey
  sameCodeValue: string
  qrBaseValue: string
  relatedMergeBatchIds: string[]
  relatedMergeBatchNos: string[]
  sourceContextLabel: string
  ticketCountBasisLabel: string
  ticketCountBasisDetail: string
  currentStageLabel: string
  cuttableStateLabel: string
  riskLabels: string[]
  latestActionText: string
  qrReservedPayload: FeiQrReservedPayload
  navigationPayload: FeiNavigationPayload
  keywordIndex: string[]
}

export interface FeiTicketLabelRecord {
  ticketRecordId: string
  ticketNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  materialSku: string
  color: string
  sequenceNo: number
  status: 'PRINTED'
  qrValue: string
  createdAt: string
  printedAt: string
  printedBy: string
  reprintCount: number
  sourcePrintJobId: string
  sourceContextType: FeiTicketsContextType
  sourceMergeBatchId: string
  sourceMergeBatchNo: string
  schemaName?: string
  schemaVersion?: string
  qrPayloadSnapshot?: string
  qrSerializedValue?: string
  reservedProcess?: unknown
  reservedTrace?: unknown
  legacyQrBaseValue?: string
  compatibilityNote?: string
}

export interface FeiTicketPrintJob {
  printJobId: string
  printJobNo: string
  ownerType: 'original-cut-order'
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  sourceContextType: FeiTicketsContextType
  sourceMergeBatchId: string
  sourceMergeBatchNo: string
  totalTicketCount: number
  status: FeiTicketPrintJobStatus
  printedBy: string
  printedAt: string
  note: string
}

export interface FeiTicketDraft {
  draftId: string
  originalCutOrderId: string
  sourceContextType: FeiTicketsContextType
  sourceMergeBatchId: string
  sourceMergeBatchNo: string
  ticketCount: number
  previewLabelRecords: FeiTicketLabelRecord[]
  note: string
  isReprint: boolean
  createdAt: string
  updatedAt: string
}

export interface FeiTicketsPrefilter {
  originalCutOrderId?: string
  originalCutOrderNo?: string
  mergeBatchId?: string
  mergeBatchNo?: string
  productionOrderNo?: string
  printJobNo?: string
  ticketStatus?: FeiTicketStatusKey
}

export interface FeiTicketOwnerFilters {
  keyword: string
  ticketStatus: 'ALL' | FeiTicketStatusKey
}

export interface FeiTicketJobFilters {
  keyword: string
  status: 'ALL' | FeiTicketPrintJobStatus
  printedBy: string
  printedDate: string
}

export interface FeiTicketsStats {
  ownerCount: number
  generatedTicketCount: number
  printedTicketCount: number
  draftCount: number
  printJobCount: number
  reprintCount: number
}

export interface FeiTicketsViewModel {
  context: FeiTicketsContext | null
  owners: OriginalCutOrderTicketOwner[]
  ownersById: Record<string, OriginalCutOrderTicketOwner>
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
  stats: FeiTicketsStats
}

export interface FeiTicketSeedLedger {
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
}

export interface FeiTicketStatusMeta {
  label: string
  className: string
  detailText: string
}

export interface TicketCountBasisResult {
  ticketCount: number
  basisLabel: string
  detailText: string
}

export interface CreateFeiTicketDraftOptions {
  owner: OriginalCutOrderTicketOwner
  context: FeiTicketsContext | null
  ticketCount: number
  note: string
  nowText: string
}

export interface CreateFeiTicketPrintJobResult {
  printJob: FeiTicketPrintJob
  nextRecords: FeiTicketLabelRecord[]
}

type MergeBatchRefLike = {
  relatedMergeBatchIds?: string[]
  relatedMergeBatchNos?: string[]
  mergeBatchIds?: string[]
  mergeBatchNos?: string[]
}

const feiTicketStatusMetaMap: Record<FeiTicketStatusKey, FeiTicketStatusMeta> = {
  NOT_GENERATED: {
    label: '未生成',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    detailText: '当前原始裁片单尚未生成菲票草稿。',
  },
  DRAFT: {
    label: '草稿中',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    detailText: '当前原始裁片单已生成打印草稿，尚未执行打印。',
  },
  PARTIAL_PRINTED: {
    label: '部分已打印',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    detailText: '当前原始裁片单仅完成部分菲票打印。',
  },
  PRINTED: {
    label: '已打印',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前原始裁片单已完成首轮菲票打印。',
  },
  REPRINTED: {
    label: '已重打',
    className: 'bg-violet-100 text-violet-700 border border-violet-200',
    detailText: '当前原始裁片单已发生重打，需按打印作业台账追溯。',
  },
  PENDING_SUPPLEMENT: {
    label: '待补录',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
    detailText: '当前票据基础数据不足，需要补录后再生成菲票。',
  },
}

function getMergeBatchIds(source: MergeBatchRefLike): string[] {
  if (Array.isArray(source.relatedMergeBatchIds)) return source.relatedMergeBatchIds
  if (Array.isArray(source.mergeBatchIds)) return source.mergeBatchIds
  return []
}

function getMergeBatchNos(source: MergeBatchRefLike): string[] {
  if (Array.isArray(source.relatedMergeBatchNos)) return source.relatedMergeBatchNos
  if (Array.isArray(source.mergeBatchNos)) return source.mergeBatchNos
  return []
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function formatQty(value: number): string {
  return numberFormatter.format(Math.max(value, 0))
}

function createEmptyPreviewRecord(
  owner: OriginalCutOrderTicketOwner,
  sequenceNo: number,
  sourceContextType: FeiTicketsContextType,
  sourceMergeBatchId: string,
  sourceMergeBatchNo: string,
): FeiTicketLabelRecord {
  return {
    ticketRecordId: `${owner.originalCutOrderId}-${sequenceNo}`,
    ticketNo: buildFeiTicketNo(owner.originalCutOrderNo, sequenceNo),
    originalCutOrderId: owner.originalCutOrderId,
    originalCutOrderNo: owner.originalCutOrderNo,
    productionOrderNo: owner.productionOrderNo,
    styleCode: owner.styleCode,
    spuCode: owner.spuCode,
    materialSku: owner.materialSku,
    color: owner.color,
    sequenceNo,
    status: 'PRINTED',
    qrValue: `${owner.qrBaseValue}-${String(sequenceNo).padStart(3, '0')}`,
    createdAt: '',
    printedAt: '',
    printedBy: '',
    reprintCount: 0,
    sourcePrintJobId: '',
    sourceContextType,
    sourceMergeBatchId,
    sourceMergeBatchNo,
  }
}

function attachQrSnapshotToRecord(
  record: FeiTicketLabelRecord,
  owner: Pick<
    OriginalCutOrderTicketOwner,
    | 'originalCutOrderId'
    | 'originalCutOrderNo'
    | 'productionOrderId'
    | 'productionOrderNo'
    | 'styleCode'
    | 'spuCode'
    | 'color'
    | 'materialSku'
    | 'sameCodeValue'
    | 'qrBaseValue'
  >,
  printJob?: Pick<FeiTicketPrintJob, 'printJobId' | 'printJobNo'> | null,
): FeiTicketLabelRecord {
  const payload = buildFeiQrPayload({
    ticketRecord: record,
    owner,
    printJob,
  })

  return {
    ...record,
    schemaName: FEI_QR_SCHEMA_NAME,
    schemaVersion: FEI_QR_SCHEMA_VERSION,
    qrPayloadSnapshot: JSON.stringify(payload),
    qrSerializedValue: serializeFeiQrPayload(payload),
    reservedProcess: payload.reservedProcess,
    reservedTrace: payload.reservedTrace,
    legacyQrBaseValue: owner.qrBaseValue,
    compatibilityNote: '',
  }
}

function findMatchingMergeBatch(
  mergeBatches: MergeBatchRecord[],
  prefilter: FeiTicketsPrefilter | null,
): MergeBatchRecord | null {
  if (!prefilter) return null
  return (
    (prefilter.mergeBatchId && mergeBatches.find((batch) => batch.mergeBatchId === prefilter.mergeBatchId)) ||
    (prefilter.mergeBatchNo && mergeBatches.find((batch) => batch.mergeBatchNo === prefilter.mergeBatchNo)) ||
    null
  )
}

function buildContext(
  owners: OriginalCutOrderTicketOwner[],
  mergeBatches: MergeBatchRecord[],
  prefilter: FeiTicketsPrefilter | null,
): FeiTicketsContext | null {
  const batch = findMatchingMergeBatch(mergeBatches, prefilter)
  if (batch) {
    const batchOwners = owners.filter((owner) => batch.items.some((item) => item.originalCutOrderId === owner.originalCutOrderId))
    if (!batchOwners.length) return null
    return {
      contextType: 'merge-batch',
      originalCutOrderIds: batchOwners.map((owner) => owner.originalCutOrderId),
      originalCutOrderNos: batchOwners.map((owner) => owner.originalCutOrderNo),
      mergeBatchId: batch.mergeBatchId,
      mergeBatchNo: batch.mergeBatchNo,
      productionOrderNos: uniqueStrings(batchOwners.map((owner) => owner.productionOrderNo)),
      styleCode: batch.styleCode || batchOwners[0]?.styleCode || '',
      spuCode: batch.spuCode || batchOwners[0]?.spuCode || '',
      styleName: batch.styleName || batchOwners[0]?.styleName || '',
      materialSkuSummary: batch.materialSkuSummary || uniqueStrings(batchOwners.map((owner) => owner.materialSku)).join(' / '),
    }
  }

  if (!prefilter) return null
  const owner =
    (prefilter.originalCutOrderId && owners.find((item) => item.originalCutOrderId === prefilter.originalCutOrderId)) ||
    (prefilter.originalCutOrderNo && owners.find((item) => item.originalCutOrderNo === prefilter.originalCutOrderNo)) ||
    null

  if (!owner) return null
  const mergeBatchIds = getMergeBatchIds(owner)
  const mergeBatchNos = getMergeBatchNos(owner)
  return {
    contextType: 'original-order',
    originalCutOrderIds: [owner.originalCutOrderId],
    originalCutOrderNos: [owner.originalCutOrderNo],
    mergeBatchId: mergeBatchIds[0] || '',
    mergeBatchNo: mergeBatchNos[0] || '',
    productionOrderNos: [owner.productionOrderNo],
    styleCode: owner.styleCode,
    spuCode: owner.spuCode,
    styleName: owner.styleName,
    materialSkuSummary: owner.materialSku,
  }
}

function findRelevantMarkerPieceCount(
  owner: Pick<OriginalCutOrderTicketOwner, 'originalCutOrderId' | 'relatedMergeBatchIds' | 'relatedMergeBatchNos'>,
  markerStore: MarkerSpreadingStore,
  context: FeiTicketsContext | null,
): number | null {
  const originalMarker = markerStore.markers.find(
    (marker) => marker.contextType === 'original-order' && marker.originalCutOrderIds.includes(owner.originalCutOrderId),
  )
  if (originalMarker?.totalPieces) return originalMarker.totalPieces

  const ownerMergeBatchIds = getMergeBatchIds(owner)
  const ownerMergeBatchNos = getMergeBatchNos(owner)
  const targetBatchId = context?.contextType === 'merge-batch' ? context.mergeBatchId : ownerMergeBatchIds[0]
  const targetBatchNo = context?.contextType === 'merge-batch' ? context.mergeBatchNo : ownerMergeBatchNos[0]
  const mergeMarker = markerStore.markers.find((marker) => {
    if (marker.contextType !== 'merge-batch') return false
    return (targetBatchId && marker.mergeBatchId === targetBatchId) || (targetBatchNo && marker.mergeBatchNo === targetBatchNo)
  })
  return mergeMarker?.totalPieces ?? null
}

export function resolveTicketCountBasis(
  owner: Pick<OriginalCutOrderTicketOwner, 'originalCutOrderId' | 'relatedMergeBatchIds' | 'relatedMergeBatchNos'> & { orderQtyHint: number },
  markerStore: MarkerSpreadingStore,
  context: FeiTicketsContext | null,
): TicketCountBasisResult {
  const markerPieces = findRelevantMarkerPieceCount(owner, markerStore, context)
  if (markerPieces && markerPieces > 0) {
    return {
      ticketCount: markerPieces,
      basisLabel: '唛架总件数',
      detailText: `当前建议票数来自唛架总件数 ${formatQty(markerPieces)}。`,
    }
  }

  const fallback = Math.max(1, Math.min(120, Math.round(Math.max(owner.orderQtyHint, 1) / 100)))
  return {
    ticketCount: fallback,
    basisLabel: '订单数量折算',
    detailText: '当前未命中唛架总件数，按试运行折算规则生成建议票数。',
  }
}

function buildKeywordIndex(values: Array<string | number | undefined | null>): string[] {
  return values
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .map((value) => String(value).toLowerCase())
}

export function deriveFeiTicketStatus(options: {
  plannedTicketQty: number
  printedTicketQty: number
  hasDraft: boolean
  reprintCount: number
  needsSupplement?: boolean
}): FeiTicketStatusMeta & { key: FeiTicketStatusKey } {
  if (options.needsSupplement) {
    return { key: 'PENDING_SUPPLEMENT', ...feiTicketStatusMetaMap.PENDING_SUPPLEMENT }
  }
  if (options.hasDraft && options.printedTicketQty === 0) {
    return { key: 'DRAFT', ...feiTicketStatusMetaMap.DRAFT }
  }
  if (options.printedTicketQty <= 0) {
    return { key: 'NOT_GENERATED', ...feiTicketStatusMetaMap.NOT_GENERATED }
  }
  if (options.reprintCount > 0) {
    return { key: 'REPRINTED', ...feiTicketStatusMetaMap.REPRINTED }
  }
  if (options.printedTicketQty < options.plannedTicketQty) {
    return { key: 'PARTIAL_PRINTED', ...feiTicketStatusMetaMap.PARTIAL_PRINTED }
  }
  return { key: 'PRINTED', ...feiTicketStatusMetaMap.PRINTED }
}

export function buildFeiTicketNo(originalCutOrderNo: string, sequenceNo: number): string {
  return `FT-${originalCutOrderNo}-${String(sequenceNo).padStart(3, '0')}`
}

export function buildFeiTicketPreview(
  owner: OriginalCutOrderTicketOwner,
  sourceContextType: FeiTicketsContextType,
  sourceMergeBatchId: string,
  sourceMergeBatchNo: string,
  ticketCount: number,
  sequenceNos?: number[],
): FeiTicketLabelRecord[] {
  const sequences = sequenceNos?.length
    ? Array.from(new Set(sequenceNos.filter((value) => value > 0))).sort((left, right) => left - right)
    : Array.from({ length: Math.max(ticketCount, 0) }, (_, index) => index + 1)

  return sequences.map((sequenceNo) =>
    createEmptyPreviewRecord(owner, sequenceNo, sourceContextType, sourceMergeBatchId, sourceMergeBatchNo),
  )
}

export function createFeiTicketDraft(options: CreateFeiTicketDraftOptions): FeiTicketDraft {
  const previewLabelRecords = buildFeiTicketPreview(
    options.owner,
    options.context?.contextType || 'original-order',
    options.context?.mergeBatchId || '',
    options.context?.mergeBatchNo || '',
    options.ticketCount,
  )

  return {
    draftId: `draft-${options.owner.originalCutOrderId}`,
    originalCutOrderId: options.owner.originalCutOrderId,
    sourceContextType: options.context?.contextType || 'original-order',
    sourceMergeBatchId: options.context?.mergeBatchId || '',
    sourceMergeBatchNo: options.context?.mergeBatchNo || '',
    ticketCount: options.ticketCount,
    previewLabelRecords,
    note: options.note,
    isReprint: false,
    createdAt: options.nowText,
    updatedAt: options.nowText,
  }
}

export function buildReprintDraft(
  owner: OriginalCutOrderTicketOwner,
  ticketRecords: FeiTicketLabelRecord[],
  context: FeiTicketsContext | null,
  nowText: string,
): FeiTicketDraft | null {
  const ownedRecords = ticketRecords
    .filter((record) => record.originalCutOrderId === owner.originalCutOrderId)
    .sort((left, right) => left.sequenceNo - right.sequenceNo)

  if (!ownedRecords.length) return null

  const previewLabelRecords = buildFeiTicketPreview(
    owner,
    context?.contextType || ownedRecords[0].sourceContextType || 'original-order',
    context?.mergeBatchId || ownedRecords[0].sourceMergeBatchId || '',
    context?.mergeBatchNo || ownedRecords[0].sourceMergeBatchNo || '',
    ownedRecords.length,
    ownedRecords.map((record) => record.sequenceNo),
  )

  previewLabelRecords.forEach((preview) => {
    const matched = ownedRecords.find((record) => record.sequenceNo === preview.sequenceNo)
    if (matched) {
      preview.ticketNo = matched.ticketNo
      preview.qrValue = matched.qrValue
      preview.reprintCount = matched.reprintCount
    }
  })

  return {
    draftId: `draft-${owner.originalCutOrderId}`,
    originalCutOrderId: owner.originalCutOrderId,
    sourceContextType: context?.contextType || ownedRecords[0].sourceContextType || 'original-order',
    sourceMergeBatchId: context?.mergeBatchId || ownedRecords[0].sourceMergeBatchId || '',
    sourceMergeBatchNo: context?.mergeBatchNo || ownedRecords[0].sourceMergeBatchNo || '',
    ticketCount: ownedRecords.length,
    previewLabelRecords,
    note: `重打 ${ownedRecords.length} 张菲票。`,
    isReprint: true,
    createdAt: nowText,
    updatedAt: nowText,
  }
}

function buildPrintJobNo(existingJobs: FeiTicketPrintJob[], nowText: string): string {
  const dateKey = nowText.slice(2, 10).replace(/-/g, '')
  const sameDayCount = existingJobs.filter((job) => job.printJobNo.includes(dateKey)).length + 1
  return `FEI-PJ-${dateKey}-${String(sameDayCount).padStart(3, '0')}`
}

export function createFeiTicketPrintJob(options: {
  draft: FeiTicketDraft
  owner: OriginalCutOrderTicketOwner
  existingRecords: FeiTicketLabelRecord[]
  existingJobs: FeiTicketPrintJob[]
  printedBy: string
  nowText: string
}): CreateFeiTicketPrintJobResult {
  const existingBySequence = new Map(
    options.existingRecords
      .filter((record) => record.originalCutOrderId === options.owner.originalCutOrderId)
      .map((record) => [record.sequenceNo, record] as const),
  )
  const hasReprint = options.draft.previewLabelRecords.some((preview) => existingBySequence.has(preview.sequenceNo))
  const printJobId = `print-job-${Date.now()}`
  const printJobNo = buildPrintJobNo(options.existingJobs, options.nowText)
  const printJob: FeiTicketPrintJob = {
    printJobId,
    printJobNo,
    ownerType: 'original-cut-order',
    originalCutOrderIds: [options.owner.originalCutOrderId],
    originalCutOrderNos: [options.owner.originalCutOrderNo],
    sourceContextType: options.draft.sourceContextType,
    sourceMergeBatchId: options.draft.sourceMergeBatchId,
    sourceMergeBatchNo: options.draft.sourceMergeBatchNo,
    totalTicketCount: options.draft.previewLabelRecords.length,
    status: hasReprint ? 'REPRINTED' : 'PRINTED',
    printedBy: options.printedBy,
    printedAt: options.nowText,
    note: options.draft.note,
  }

  const nextRecordsMap = new Map(options.existingRecords.map((record) => [record.ticketRecordId, record]))

  options.draft.previewLabelRecords.forEach((preview) => {
    const existing = existingBySequence.get(preview.sequenceNo)
    if (existing) {
      const nextRecord = attachQrSnapshotToRecord(
        {
        ...existing,
        printedAt: options.nowText,
        printedBy: options.printedBy,
        reprintCount: existing.reprintCount + 1,
        sourcePrintJobId: printJobId,
        sourceContextType: options.draft.sourceContextType,
        sourceMergeBatchId: options.draft.sourceMergeBatchId,
        sourceMergeBatchNo: options.draft.sourceMergeBatchNo,
        },
        options.owner,
        printJob,
      )
      nextRecordsMap.set(existing.ticketRecordId, nextRecord)
      return
    }

    const ticketRecordId = `ticket-${options.owner.originalCutOrderId}-${String(preview.sequenceNo).padStart(3, '0')}`
    nextRecordsMap.set(
      ticketRecordId,
      attachQrSnapshotToRecord(
        {
          ...preview,
          ticketRecordId,
          createdAt: options.nowText,
          printedAt: options.nowText,
          printedBy: options.printedBy,
          reprintCount: 0,
          sourcePrintJobId: printJobId,
        },
        options.owner,
        printJob,
      ),
    )
  })

  return {
    printJob,
    nextRecords: Array.from(nextRecordsMap.values()).sort((left, right) =>
      left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN') || left.sequenceNo - right.sequenceNo,
    ),
  }
}

export function buildFeiNavigationPayload(
  owner: Pick<OriginalCutOrderTicketOwner, 'originalCutOrderId' | 'originalCutOrderNo' | 'productionOrderNo'> &
    MergeBatchRefLike,
  context: FeiTicketsContext | null,
): FeiNavigationPayload {
  const mergeBatchNos = getMergeBatchNos(owner)
  const mergeBatchNo = context?.contextType === 'merge-batch' ? context.mergeBatchNo || undefined : mergeBatchNos[0] || undefined

  return {
    originalOrders: {
      originalCutOrderId: owner.originalCutOrderId,
      originalCutOrderNo: owner.originalCutOrderNo,
      productionOrderNo: owner.productionOrderNo,
    },
    mergeBatches: {
      mergeBatchNo,
      originalCutOrderNo: owner.originalCutOrderNo,
    },
    markerSpreading: {
      mergeBatchNo,
      originalCutOrderNo: owner.originalCutOrderNo,
      originalCutOrderId: owner.originalCutOrderId,
    },
    replenishment: {
      mergeBatchNo,
      originalCutOrderNo: owner.originalCutOrderNo,
      productionOrderNo: owner.productionOrderNo,
    },
    summary: {
      mergeBatchNo,
      originalCutOrderNo: owner.originalCutOrderNo,
      productionOrderNo: owner.productionOrderNo,
    },
    transferBags: {
      mergeBatchNo,
      originalCutOrderNo: owner.originalCutOrderNo,
    },
  }
}

export function buildTicketOwnerGroupsFromContext(
  context: FeiTicketsContext | null,
  owners: OriginalCutOrderTicketOwner[],
): OriginalCutOrderTicketOwner[] {
  if (!context) return owners
  if (context.contextType === 'merge-batch') {
    const allowedIds = new Set(context.originalCutOrderIds)
    return owners.filter((owner) => allowedIds.has(owner.originalCutOrderId))
  }
  return owners.filter((owner) => owner.originalCutOrderId === context.originalCutOrderIds[0])
}

export function buildFeiTicketsViewModel(options: {
  originalRows: OriginalCutOrderRow[]
  materialPrepRows: MaterialPrepRow[]
  mergeBatches: MergeBatchRecord[]
  markerStore: MarkerSpreadingStore
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
  drafts: Record<string, FeiTicketDraft>
  prefilter: FeiTicketsPrefilter | null
}): FeiTicketsViewModel {
  const materialRowsById = Object.fromEntries(options.materialPrepRows.map((row) => [row.originalCutOrderId, row]))

  const owners = options.originalRows.map((row) => {
    const mergeBatchIds = Array.isArray(row.mergeBatchIds) ? row.mergeBatchIds : []
    const mergeBatchNos = Array.isArray(row.mergeBatchNos) ? row.mergeBatchNos : []
    const materialRow = materialRowsById[row.originalCutOrderId]
    const ticketCountBasis = resolveTicketCountBasis(
      {
        originalCutOrderId: row.originalCutOrderId,
        relatedMergeBatchIds: mergeBatchIds,
        relatedMergeBatchNos: mergeBatchNos,
        orderQtyHint: row.orderQty,
      },
      options.markerStore,
      null,
    )
    const ownerRecords = options.ticketRecords.filter((record) => record.originalCutOrderId === row.originalCutOrderId)
    const latestPrintJob = options.printJobs
      .filter((job) => job.originalCutOrderIds.includes(row.originalCutOrderId))
      .sort((left, right) => right.printedAt.localeCompare(left.printedAt, 'zh-CN'))[0]
    const printedTicketQty = ownerRecords.length
    const reprintCount = ownerRecords.reduce((sum, record) => sum + record.reprintCount, 0)
    const hasDraft = Boolean(options.drafts[row.originalCutOrderId])
    const statusMeta = deriveFeiTicketStatus({
      plannedTicketQty: ticketCountBasis.ticketCount,
      printedTicketQty,
      hasDraft,
      reprintCount,
      needsSupplement: !materialRow,
    })

    return {
      ownerType: 'original-cut-order' as const,
      id: row.id,
      originalCutOrderId: row.originalCutOrderId,
      originalCutOrderNo: row.originalCutOrderNo,
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
      styleCode: row.styleCode,
      spuCode: row.spuCode,
      styleName: row.styleName,
      color: row.color,
      materialSku: row.materialSku,
      plannedTicketQty: ticketCountBasis.ticketCount,
      printedTicketQty,
      latestPrintJobNo: latestPrintJob?.printJobNo || '',
      ticketStatus: statusMeta.key,
      sameCodeValue: materialRow?.sameCodeValue || row.originalCutOrderNo,
      qrBaseValue: materialRow?.qrCodeValue || `QR-${row.originalCutOrderNo}`,
      relatedMergeBatchIds: mergeBatchIds,
      relatedMergeBatchNos: mergeBatchNos,
      sourceContextLabel: '原始裁片单上下文',
      ticketCountBasisLabel: ticketCountBasis.basisLabel,
      ticketCountBasisDetail: ticketCountBasis.detailText,
      currentStageLabel: row.currentStage.label,
      cuttableStateLabel: row.cuttableState.label,
      riskLabels: row.riskTags.map((tag) => tag.label),
      latestActionText: row.latestActionText,
      qrReservedPayload: {
        qrBaseValue: materialRow?.qrCodeValue || `QR-${row.originalCutOrderNo}`,
        reservedProcessFields: {},
        reservedVersion: 'v-next',
      },
      navigationPayload: buildFeiNavigationPayload(row, null),
      keywordIndex: buildKeywordIndex([
        row.originalCutOrderNo,
        row.productionOrderNo,
        row.styleCode,
        row.spuCode,
        row.styleName,
        row.materialSku,
        materialRow?.sameCodeValue,
        latestPrintJob?.printJobNo,
        ...row.mergeBatchNos,
      ]),
    }
  })

  const context = buildContext(owners, options.mergeBatches, options.prefilter)
  const contextualOwners = buildTicketOwnerGroupsFromContext(context, owners).map((owner) => ({
    ...owner,
    sourceContextLabel: context?.contextType === 'merge-batch' ? `来自批次 ${context.mergeBatchNo || '待补批次号'}` : '原始单上下文',
    navigationPayload: buildFeiNavigationPayload(owner, context),
  }))

  const contextualIds = new Set(contextualOwners.map((owner) => owner.originalCutOrderId))
  const ticketRecords = options.ticketRecords
    .filter((record) => (contextualIds.size ? contextualIds.has(record.originalCutOrderId) : true))
    .sort(
      (left, right) =>
        right.printedAt.localeCompare(left.printedAt, 'zh-CN') ||
        left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN') ||
        left.sequenceNo - right.sequenceNo,
    )
  const printJobs = options.printJobs
    .filter((job) => (contextualIds.size ? job.originalCutOrderIds.some((id) => contextualIds.has(id)) : true))
    .sort((left, right) => right.printedAt.localeCompare(left.printedAt, 'zh-CN'))

  return {
    context,
    owners: contextualOwners,
    ownersById: Object.fromEntries(contextualOwners.map((owner) => [owner.id, owner])),
    ticketRecords,
    printJobs,
    stats: buildFeiTicketStats(contextualOwners, ticketRecords, printJobs, options.drafts),
  }
}

export function filterFeiTicketOwners(
  owners: OriginalCutOrderTicketOwner[],
  filters: FeiTicketOwnerFilters,
  prefilter: FeiTicketsPrefilter | null,
): OriginalCutOrderTicketOwner[] {
  const keyword = filters.keyword.trim().toLowerCase()

  return owners.filter((owner) => {
    if (prefilter?.productionOrderNo && owner.productionOrderNo !== prefilter.productionOrderNo) return false
    if (prefilter?.ticketStatus && owner.ticketStatus !== prefilter.ticketStatus) return false
    if (filters.ticketStatus !== 'ALL' && owner.ticketStatus !== filters.ticketStatus) return false
    if (!keyword) return true
    return owner.keywordIndex.some((value) => value.includes(keyword))
  })
}

export function filterFeiPrintJobs(
  printJobs: FeiTicketPrintJob[],
  filters: FeiTicketJobFilters,
): FeiTicketPrintJob[] {
  const keyword = filters.keyword.trim().toLowerCase()
  const printedBy = filters.printedBy.trim().toLowerCase()

  return printJobs.filter((job) => {
    if (filters.status !== 'ALL' && job.status !== filters.status) return false
    if (filters.printedDate && !job.printedAt.startsWith(filters.printedDate)) return false
    if (printedBy && !job.printedBy.toLowerCase().includes(printedBy)) return false
    if (!keyword) return true

    const keywordValues = [
      job.printJobNo,
      job.originalCutOrderNos.join(' / '),
      job.printedBy,
      job.note,
      job.sourceMergeBatchNo,
    ]
      .filter(Boolean)
      .map((value) => value.toLowerCase())
    return keywordValues.some((value) => value.includes(keyword))
  })
}

export function buildFeiTicketStats(
  owners: OriginalCutOrderTicketOwner[],
  ticketRecords: FeiTicketLabelRecord[],
  printJobs: FeiTicketPrintJob[],
  drafts: Record<string, FeiTicketDraft>,
): FeiTicketsStats {
  const contextualIds = new Set(owners.map((owner) => owner.originalCutOrderId))
  const contextualDraftCount = Object.values(drafts).filter((draft) => contextualIds.has(draft.originalCutOrderId)).length

  return {
    ownerCount: owners.length,
    generatedTicketCount: owners.reduce((sum, owner) => sum + owner.plannedTicketQty, 0),
    printedTicketCount: ticketRecords.length,
    draftCount: contextualDraftCount,
    printJobCount: printJobs.length,
    reprintCount: ticketRecords.reduce((sum, record) => sum + record.reprintCount, 0),
  }
}

export function serializeFeiTicketDraftsStorage(drafts: Record<string, FeiTicketDraft>): string {
  return JSON.stringify(drafts)
}

export function deserializeFeiTicketDraftsStorage(raw: string | null): Record<string, FeiTicketDraft> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function serializeFeiTicketRecordsStorage(records: FeiTicketLabelRecord[]): string {
  return JSON.stringify(records)
}

export function deserializeFeiTicketRecordsStorage(raw: string | null): FeiTicketLabelRecord[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function serializeFeiTicketPrintJobsStorage(printJobs: FeiTicketPrintJob[]): string {
  return JSON.stringify(printJobs)
}

export function deserializeFeiTicketPrintJobsStorage(raw: string | null): FeiTicketPrintJob[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function getFeiTicketStatusMeta(status: FeiTicketStatusKey): FeiTicketStatusMeta {
  return feiTicketStatusMetaMap[status]
}

export function buildSystemSeedFeiTicketLedger(options: {
  originalRows: OriginalCutOrderRow[]
  materialPrepRows: MaterialPrepRow[]
  mergeBatches: MergeBatchRecord[]
  markerStore: MarkerSpreadingStore
}): FeiTicketSeedLedger {
  const materialRowsById = Object.fromEntries(options.materialPrepRows.map((row) => [row.originalCutOrderId, row]))

  const seedOwners: Array<{
    owner: OriginalCutOrderTicketOwner
    sourceContextType: FeiTicketsContextType
    sourceMergeBatchId: string
    sourceMergeBatchNo: string
  }> = options.originalRows
    .slice(0, 2)
    .map((row) => {
      const mergeBatchIds = Array.isArray(row.mergeBatchIds) ? row.mergeBatchIds : []
      const mergeBatchNos = Array.isArray(row.mergeBatchNos) ? row.mergeBatchNos : []
      const materialRow = materialRowsById[row.originalCutOrderId]
      const ticketCountBasis = resolveTicketCountBasis(
        {
          originalCutOrderId: row.originalCutOrderId,
          relatedMergeBatchIds: mergeBatchIds,
          relatedMergeBatchNos: mergeBatchNos,
          orderQtyHint: row.orderQty,
        },
        options.markerStore,
        null,
      )

      const sourceContextType: FeiTicketsContextType = row.latestMergeBatchNo ? 'merge-batch' : 'original-order'

      return {
        owner: {
          ownerType: 'original-cut-order' as const,
          id: row.id,
          originalCutOrderId: row.originalCutOrderId,
          originalCutOrderNo: row.originalCutOrderNo,
          productionOrderId: row.productionOrderId,
          productionOrderNo: row.productionOrderNo,
          styleCode: row.styleCode,
          spuCode: row.spuCode,
          styleName: row.styleName,
          color: row.color,
          materialSku: row.materialSku,
          plannedTicketQty: Math.max(1, Math.min(ticketCountBasis.ticketCount, row.latestMergeBatchNo ? 3 : 2)),
          printedTicketQty: 0,
          latestPrintJobNo: '',
          ticketStatus: 'NOT_GENERATED' as FeiTicketStatusKey,
          sameCodeValue: materialRow?.sameCodeValue || row.originalCutOrderNo,
          qrBaseValue: materialRow?.qrCodeValue || `QR-${row.originalCutOrderNo}`,
          relatedMergeBatchIds: mergeBatchIds,
          relatedMergeBatchNos: mergeBatchNos,
          sourceContextLabel: sourceContextType === 'merge-batch' ? `来自批次 ${row.latestMergeBatchNo}` : '原始单上下文',
          ticketCountBasisLabel: ticketCountBasis.basisLabel,
          ticketCountBasisDetail: ticketCountBasis.detailText,
          currentStageLabel: row.currentStage.label,
          cuttableStateLabel: row.cuttableState.label,
          riskLabels: row.riskTags.map((tag) => tag.label),
          latestActionText: row.latestActionText,
          qrReservedPayload: {
            qrBaseValue: materialRow?.qrCodeValue || `QR-${row.originalCutOrderNo}`,
            reservedProcessFields: {},
            reservedVersion: 'v-next',
          },
          navigationPayload: buildFeiNavigationPayload(
            {
              originalCutOrderId: row.originalCutOrderId,
              originalCutOrderNo: row.originalCutOrderNo,
              productionOrderNo: row.productionOrderNo,
              mergeBatchIds,
              mergeBatchNos,
            },
            null,
          ),
          keywordIndex: [],
        },
        sourceContextType,
        sourceMergeBatchId: mergeBatchIds[0] || '',
        sourceMergeBatchNo: mergeBatchNos[0] || '',
      }
    })

  const ticketRecords: FeiTicketLabelRecord[] = []
  const printJobs: FeiTicketPrintJob[] = []

  seedOwners.forEach((entry, index) => {
    const { owner, sourceContextType, sourceMergeBatchId, sourceMergeBatchNo } = entry
    const ticketCount = index === 0 ? owner.plannedTicketQty : Math.max(1, owner.plannedTicketQty - 1)
    const previewRecordsRaw = buildFeiTicketPreview(
      owner,
      sourceContextType,
      sourceMergeBatchId,
      sourceMergeBatchNo,
      ticketCount,
    )

    const printJob: FeiTicketPrintJob = {
      printJobId: `seed-job-${index + 1}`,
      printJobNo: `FEI-PJ-26032${index + 2}-00${index + 1}`,
      ownerType: 'original-cut-order',
      originalCutOrderIds: [owner.originalCutOrderId],
      originalCutOrderNos: [owner.originalCutOrderNo],
      sourceContextType,
      sourceMergeBatchId,
      sourceMergeBatchNo,
      totalTicketCount: previewRecordsRaw.length,
      status: index === 0 ? 'REPRINTED' : 'PRINTED',
      printedBy: index === 0 ? '打票员-周莉' : '打票员-陈耀',
      printedAt: index === 0 ? '2026-03-22 09:15' : '2026-03-23 11:40',
      note: index === 0 ? '首张因条码污损已重打一轮。' : '按原始裁片单完成首轮打印。',
    }

    const previewRecords = previewRecordsRaw.map((record) =>
      attachQrSnapshotToRecord(
        {
          ...record,
          ticketRecordId: `seed-${record.ticketNo}`,
          createdAt: index === 0 ? '2026-03-22 09:10' : '2026-03-23 11:30',
          printedAt: index === 0 ? '2026-03-22 09:15' : '2026-03-23 11:40',
          printedBy: index === 0 ? '打票员-周莉' : '打票员-陈耀',
          reprintCount: index === 0 && record.sequenceNo === 1 ? 1 : 0,
          sourcePrintJobId: printJob.printJobId,
        },
        owner,
        printJob,
      ),
    )

    ticketRecords.push(...previewRecords)
    printJobs.push(printJob)
  })

  return {
    ticketRecords,
    printJobs,
  }
}
