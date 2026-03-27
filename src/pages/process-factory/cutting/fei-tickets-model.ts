import type { OriginalCutOrderRow, OriginalCutOrderNavigationPayload } from './original-orders-model'
import type { MaterialPrepRow } from './material-prep-model'
import type { MarkerSpreadingStore } from './marker-spreading-model'
import type { MergeBatchRecord } from './merge-batches-model'
import {
  buildCuttingTraceabilityId,
} from '../../../data/fcs/cutting/qr-codes.ts'
import {
  getGeneratedFeiTicketMapByOriginalCutOrderId,
  getFeiTicketById as getGeneratedFeiTicketById,
  listGeneratedFeiTickets,
  listGeneratedFeiTicketsByOriginalCutOrderId,
  type GeneratedFeiTicketSourceRecord,
} from '../../../data/fcs/cutting/generated-fei-tickets.ts'
import {
  FEI_QR_SCHEMA_NAME,
  FEI_QR_SCHEMA_VERSION,
  buildFeiQrPayload,
  serializeFeiQrPayload,
} from './fei-qr-model.ts'

const numberFormatter = new Intl.NumberFormat('zh-CN')

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

export const CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY = 'cuttingFeiTicketDrafts'
export const CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY = 'cuttingFeiTicketRecords'
export const CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY = 'cuttingFeiTicketPrintJobs'

export const FEI_TICKET_DEMO_CASE_IDS = {
  CASE_A: {
    printableUnitId: 'cut-order:CUT-260313-086-02',
    printableUnitNo: 'CUT-260313-086-02',
  },
  CASE_B: {
    printableUnitId: 'batch:demo-batch-fei-081',
    printableUnitNo: 'MB-DEMO-PRINT-081',
    batchId: 'demo-batch-fei-081',
    batchNo: 'MB-DEMO-PRINT-081',
    sourceCutOrderIds: ['CUT-260308-081-01', 'CUT-260314-087-01', 'CUT-260315-088-01'],
  },
  CASE_C: {
    printableUnitId: 'cut-order:CUT-260310-083-01',
    printableUnitNo: 'CUT-260310-083-01',
    sampleTicketNo: 'FT-CUT-260310-083-01-001',
    sampleTicketId: 'ticket-CUT-260310-083-01-001-v1',
  },
  CASE_D: {
    printableUnitId: 'cut-order:CUT-260313-086-01',
    printableUnitNo: 'CUT-260313-086-01',
    voidedTicketNo: 'FT-CUT-260313-086-01-001',
    voidedTicketId: 'ticket-CUT-260313-086-01-001-v1',
  },
  CASE_E: {
    printableUnitId: 'cut-order:CUT-260310-083-02',
    printableUnitNo: 'CUT-260310-083-02',
    originalTicketNo: 'FT-CUT-260310-083-02-001',
    originalTicketId: 'ticket-CUT-260310-083-02-001-v1',
    replacementTicketNo: 'FT-CUT-260310-083-02-001-V2',
    replacementTicketId: 'ticket-CUT-260310-083-02-001-v2',
  },
} as const

export type FeiTicketsContextType = 'original-order' | 'merge-batch'
export type FeiTicketStatusKey =
  | 'NOT_GENERATED'
  | 'DRAFT'
  | 'PARTIAL_PRINTED'
  | 'PRINTED'
  | 'REPRINTED'
  | 'PENDING_SUPPLEMENT'

export type FeiTicketPrintJobStatus = 'PRINTED' | 'REPRINTED' | 'CANCELLED'
export type FeiTicketOperationType = 'FIRST_PRINT' | 'CONTINUE_PRINT' | 'REPRINT' | 'VOID'

export interface FeiTicketsContext {
  contextType: FeiTicketsContextType
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  mergeBatchId: string
  mergeBatchNo: string
  productionOrderIds: string[]
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
  status: 'PRINTED' | 'VOIDED'
  qrValue: string
  createdAt: string
  printedAt: string
  printedBy: string
  reprintCount: number
  sourcePrintJobId: string
  sourceContextType: FeiTicketsContextType
  sourceMergeBatchId: string
  sourceMergeBatchNo: string
  printableUnitId?: string
  printableUnitNo?: string
  printableUnitType?: PrintableUnitType
  sourceProductionOrderId?: string
  splitDetailId?: string
  partName?: string
  size?: string
  quantity?: number
  processTags?: string[]
  version?: number
  voidedAt?: string
  voidedBy?: string
  voidReason?: string
  replacementTicketId?: string
  replacementTicketNo?: string
  downstreamLocked?: boolean
  downstreamLockedReason?: string
  boundPocketNo?: string
  boundUsageNo?: string
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
  printableUnitId?: string
  printableUnitNo?: string
  printableUnitType?: PrintableUnitType
  operationType?: FeiTicketOperationType
  reason?: string
  printerName?: string
  templateName?: string
  ticketRecordIds?: string[]
  fromTicketId?: string
  toTicketId?: string
  remark?: string
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

function getGeneratedFeiRecordsByOriginalCutOrderId(originalCutOrderId: string): GeneratedFeiTicketSourceRecord[] {
  return listGeneratedFeiTicketsByOriginalCutOrderId(originalCutOrderId)
}

function getGeneratedFeiRecordBySequence(
  originalCutOrderId: string,
  sequenceNo: number,
): GeneratedFeiTicketSourceRecord | null {
  return getGeneratedFeiRecordsByOriginalCutOrderId(originalCutOrderId)[sequenceNo - 1] || null
}

function buildFeiPrintJobId(nowText: string, originalCutOrderId: string, actionType: string): string {
  return buildCuttingTraceabilityId('print-job', nowText, originalCutOrderId, actionType)
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
  const generated = getGeneratedFeiRecordBySequence(owner.originalCutOrderId, sequenceNo)
  return {
    ticketRecordId: generated?.feiTicketId || `${owner.originalCutOrderId}-${sequenceNo}`,
    ticketNo: generated?.feiTicketNo || buildFeiTicketNo(owner.originalCutOrderNo, sequenceNo),
    originalCutOrderId: owner.originalCutOrderId,
    originalCutOrderNo: owner.originalCutOrderNo,
    productionOrderNo: owner.productionOrderNo,
    styleCode: owner.styleCode,
    spuCode: owner.spuCode,
    materialSku: owner.materialSku,
    color: generated?.skuColor || owner.color,
    sequenceNo,
    status: 'PRINTED',
    qrValue: generated?.qrValue || `${owner.qrBaseValue}-${String(sequenceNo).padStart(3, '0')}`,
    createdAt: '',
    printedAt: '',
    printedBy: '',
    reprintCount: 0,
    sourcePrintJobId: '',
    sourceContextType,
    sourceMergeBatchId,
    sourceMergeBatchNo,
    partName: generated?.partName || '',
    size: generated?.skuSize || '',
    quantity: generated?.qty ?? 1,
    processTags: generated?.secondaryCrafts || [],
  }
}

function createSeedOwnerFromRow(options: {
  row: OriginalCutOrderRow
  materialRow: MaterialPrepRow | undefined
  plannedTicketQty: number
}): OriginalCutOrderTicketOwner {
  const mergeBatchIds = Array.isArray(options.row.mergeBatchIds) ? options.row.mergeBatchIds : []
  const mergeBatchNos = Array.isArray(options.row.mergeBatchNos) ? options.row.mergeBatchNos : []

  return {
    ownerType: 'original-cut-order',
    id: options.row.id,
    originalCutOrderId: options.row.originalCutOrderId,
    originalCutOrderNo: options.row.originalCutOrderNo,
    productionOrderId: options.row.productionOrderId,
    productionOrderNo: options.row.productionOrderNo,
    styleCode: options.row.styleCode,
    spuCode: options.row.spuCode,
    styleName: options.row.styleName,
    color: options.row.color,
    materialSku: options.row.materialSku,
    plannedTicketQty: options.plannedTicketQty,
    printedTicketQty: 0,
    latestPrintJobNo: '',
    ticketStatus: 'NOT_GENERATED',
    sameCodeValue: options.materialRow?.sameCodeValue || options.row.originalCutOrderNo,
    qrBaseValue: options.materialRow?.qrCodeValue || `QR-${options.row.originalCutOrderNo}`,
    relatedMergeBatchIds: mergeBatchIds,
    relatedMergeBatchNos: mergeBatchNos,
    sourceContextLabel: mergeBatchNos[0] ? `来自批次 ${mergeBatchNos[0]}` : '原始单上下文',
    ticketCountBasisLabel: '演示票数',
    ticketCountBasisDetail: '当前 seed 仅用于打印模块人工验收，不影响其它业务口径。',
    currentStageLabel: options.row.currentStage.label,
    cuttableStateLabel: options.row.cuttableState.label,
    riskLabels: options.row.riskTags.map((tag) => tag.label),
    latestActionText: options.row.latestActionText,
    qrReservedPayload: {
      qrBaseValue: options.materialRow?.qrCodeValue || `QR-${options.row.originalCutOrderNo}`,
      reservedProcessFields: {},
      reservedVersion: 'v-next',
    },
    navigationPayload: buildFeiNavigationPayload(
      {
        originalCutOrderId: options.row.originalCutOrderId,
        originalCutOrderNo: options.row.originalCutOrderNo,
        productionOrderNo: options.row.productionOrderNo,
        mergeBatchIds,
        mergeBatchNos,
      },
      null,
    ),
    keywordIndex: buildKeywordIndex([
      options.row.originalCutOrderNo,
      options.row.productionOrderNo,
      options.row.styleCode,
      options.row.spuCode,
      options.row.styleName,
      options.row.materialSku,
      options.materialRow?.sameCodeValue,
      ...mergeBatchNos,
    ]),
  }
}

function createSeedTicketRecord(options: {
  owner: OriginalCutOrderTicketOwner
  sequenceNo: number
  version: number
  printedAt: string
  printedBy: string
  printJobId: string
  printableUnitId: string
  printableUnitNo: string
  printableUnitType: PrintableUnitType
  sourceContextType: FeiTicketsContextType
  sourceMergeBatchId: string
  sourceMergeBatchNo: string
  quantity?: number
  partName?: string
  size?: string
  processTags?: string[]
}): FeiTicketLabelRecord {
  const generated = getGeneratedFeiRecordBySequence(options.owner.originalCutOrderId, options.sequenceNo)
  return attachQrSnapshotToRecord(
    {
      ...createEmptyPreviewRecord(
        options.owner,
        options.sequenceNo,
        options.sourceContextType,
        options.sourceMergeBatchId,
        options.sourceMergeBatchNo,
      ),
      ticketRecordId:
        options.version <= 1
          ? generated?.feiTicketId || buildTicketRecordId(options.owner.originalCutOrderId, options.sequenceNo, options.version)
          : buildTicketRecordId(options.owner.originalCutOrderId, options.sequenceNo, options.version),
      ticketNo:
        options.version <= 1
          ? generated?.feiTicketNo || buildVersionedTicketNo(options.owner.originalCutOrderNo, options.sequenceNo, options.version)
          : buildVersionedTicketNo(options.owner.originalCutOrderNo, options.sequenceNo, options.version),
      printableUnitId: options.printableUnitId,
      printableUnitNo: options.printableUnitNo,
      printableUnitType: options.printableUnitType,
      sourceProductionOrderId: options.owner.productionOrderId,
      splitDetailId: `${options.owner.originalCutOrderId}-${options.sequenceNo}`,
      createdAt: options.printedAt,
      printedAt: options.printedAt,
      printedBy: options.printedBy,
      reprintCount: Math.max(options.version - 1, 0),
      sourcePrintJobId: options.printJobId,
      status: 'PRINTED',
      partName: options.partName || generated?.partName || printablePartCycle[(options.sequenceNo - 1) % printablePartCycle.length],
      size: options.size || generated?.skuSize || printableSizeCycle[(options.sequenceNo - 1) % printableSizeCycle.length],
      quantity: options.quantity ?? generated?.qty ?? 1,
      processTags: options.processTags || generated?.secondaryCrafts || [],
      version: options.version,
    },
    options.owner,
    {
      printJobId: options.printJobId,
      printJobNo: '',
    },
  )
}

function createSeedPrintJob(options: {
  printJobId: string
  printJobNo: string
  owner: OriginalCutOrderTicketOwner
  printableUnitId: string
  printableUnitNo: string
  printableUnitType: PrintableUnitType
  sourceContextType: FeiTicketsContextType
  sourceMergeBatchId: string
  sourceMergeBatchNo: string
  operationType: FeiTicketOperationType
  status: FeiTicketPrintJobStatus
  printedBy: string
  printedAt: string
  ticketRecordIds: string[]
  reason?: string
  fromTicketId?: string
  toTicketId?: string
  note?: string
}): FeiTicketPrintJob {
  return {
    printJobId: options.printJobId,
    printJobNo: options.printJobNo,
    ownerType: 'original-cut-order',
    originalCutOrderIds: [options.owner.originalCutOrderId],
    originalCutOrderNos: [options.owner.originalCutOrderNo],
    sourceContextType: options.sourceContextType,
    sourceMergeBatchId: options.sourceMergeBatchId,
    sourceMergeBatchNo: options.sourceMergeBatchNo,
    totalTicketCount: options.ticketRecordIds.length,
    status: options.status,
    printedBy: options.printedBy,
    printedAt: options.printedAt,
    note: options.note || '',
    printableUnitId: options.printableUnitId,
    printableUnitNo: options.printableUnitNo,
    printableUnitType: options.printableUnitType,
    operationType: options.operationType,
    reason: options.reason || '',
    printerName: options.operationType === 'VOID' ? '' : 'Zebra ZT411',
    templateName: options.operationType === 'VOID' ? '' : '裁片菲票标准模板',
    ticketRecordIds: options.ticketRecordIds,
    fromTicketId: options.fromTicketId || '',
    toTicketId: options.toTicketId || '',
    remark: options.note || '',
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

type PrintableUnitScope = Pick<
  PrintableUnit,
  'printableUnitId' | 'printableUnitNo' | 'printableUnitType' | 'batchId' | 'batchNo' | 'cutOrderId' | 'sourceCutOrderIds'
>

function normalizeRecordPrintableUnit(record: FeiTicketLabelRecord): FeiTicketLabelRecord {
  if (record.printableUnitId && record.printableUnitNo && record.printableUnitType) return record

  if (record.sourceContextType === 'merge-batch' && record.sourceMergeBatchId) {
    return {
      ...record,
      printableUnitId: record.printableUnitId || `batch:${record.sourceMergeBatchId}`,
      printableUnitNo: record.printableUnitNo || record.sourceMergeBatchNo,
      printableUnitType: record.printableUnitType || 'BATCH',
    }
  }

  return {
    ...record,
    printableUnitId: record.printableUnitId || `cut-order:${record.originalCutOrderId}`,
    printableUnitNo: record.printableUnitNo || record.originalCutOrderNo,
    printableUnitType: record.printableUnitType || 'CUT_ORDER',
  }
}

function normalizePrintJobPrintableUnit(printJob: FeiTicketPrintJob): FeiTicketPrintJob {
  if (printJob.printableUnitId && printJob.printableUnitNo && printJob.printableUnitType) return printJob

  if (printJob.sourceContextType === 'merge-batch' && printJob.sourceMergeBatchId) {
    return {
      ...printJob,
      printableUnitId: printJob.printableUnitId || `batch:${printJob.sourceMergeBatchId}`,
      printableUnitNo: printJob.printableUnitNo || printJob.sourceMergeBatchNo,
      printableUnitType: printJob.printableUnitType || 'BATCH',
    }
  }

  const fallbackCutOrderId = printJob.originalCutOrderIds[0] || ''
  const fallbackCutOrderNo = printJob.originalCutOrderNos[0] || ''
  return {
    ...printJob,
    printableUnitId: printJob.printableUnitId || (fallbackCutOrderId ? `cut-order:${fallbackCutOrderId}` : ''),
    printableUnitNo: printJob.printableUnitNo || fallbackCutOrderNo,
    printableUnitType: printJob.printableUnitType || 'CUT_ORDER',
  }
}

function matchesPrintableUnitRecord(scope: PrintableUnitScope, record: FeiTicketLabelRecord): boolean {
  if (record.printableUnitId) return record.printableUnitId === scope.printableUnitId

  if (scope.printableUnitType === 'BATCH') {
    return Boolean(scope.batchId) && record.sourceContextType === 'merge-batch' && record.sourceMergeBatchId === scope.batchId
  }

  return record.originalCutOrderId === scope.cutOrderId
}

function matchesPrintableUnitPrintJob(scope: PrintableUnitScope, printJob: FeiTicketPrintJob): boolean {
  if (printJob.printableUnitId) return printJob.printableUnitId === scope.printableUnitId

  if (scope.printableUnitType === 'BATCH') {
    return Boolean(scope.batchId) && printJob.sourceContextType === 'merge-batch' && printJob.sourceMergeBatchId === scope.batchId
  }

  return Boolean(scope.cutOrderId) && printJob.originalCutOrderIds.includes(scope.cutOrderId)
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
      productionOrderIds: uniqueStrings(batchOwners.map((owner) => owner.productionOrderId)),
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
    productionOrderIds: [owner.productionOrderId],
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
  const printJobId = buildFeiPrintJobId(options.nowText, options.owner.originalCutOrderId, hasReprint ? 'reprint' : 'first')
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
    printableUnitId: `cut-order:${options.owner.originalCutOrderId}`,
    printableUnitNo: options.owner.originalCutOrderNo,
    printableUnitType: 'CUT_ORDER',
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
          printableUnitId: printJob.printableUnitId,
          printableUnitNo: printJob.printableUnitNo,
          printableUnitType: printJob.printableUnitType,
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
          printableUnitId: printJob.printableUnitId,
          printableUnitNo: printJob.printableUnitNo,
          printableUnitType: printJob.printableUnitType,
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
  const generatedTicketMap = getGeneratedFeiTicketMapByOriginalCutOrderId()

  const owners = options.originalRows.map((row) => {
    const mergeBatchIds = Array.isArray(row.mergeBatchIds) ? row.mergeBatchIds : []
    const mergeBatchNos = Array.isArray(row.mergeBatchNos) ? row.mergeBatchNos : []
    const materialRow = materialRowsById[row.originalCutOrderId]
    const generatedTickets = generatedTicketMap[row.originalCutOrderId] || []
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
    const plannedTicketQty = generatedTickets.length || ticketCountBasis.ticketCount
    const ownerRecords = options.ticketRecords.filter((record) => record.originalCutOrderId === row.originalCutOrderId)
    const latestPrintJob = options.printJobs
      .filter((job) => job.originalCutOrderIds.includes(row.originalCutOrderId))
      .sort((left, right) => right.printedAt.localeCompare(left.printedAt, 'zh-CN'))[0]
    const printedTicketQty = ownerRecords.length
    const reprintCount = ownerRecords.reduce((sum, record) => sum + record.reprintCount, 0)
    const hasDraft = Boolean(options.drafts[row.originalCutOrderId])
    const statusMeta = deriveFeiTicketStatus({
      plannedTicketQty,
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
      plannedTicketQty,
      printedTicketQty,
      latestPrintJobNo: latestPrintJob?.printJobNo || '',
      ticketStatus: statusMeta.key,
      sameCodeValue: materialRow?.sameCodeValue || row.originalCutOrderNo,
      qrBaseValue: materialRow?.qrCodeValue || `QR-${row.originalCutOrderNo}`,
      relatedMergeBatchIds: mergeBatchIds,
      relatedMergeBatchNos: mergeBatchNos,
      sourceContextLabel: '原始裁片单上下文',
      ticketCountBasisLabel: generatedTickets.length ? '正式菲票拆分' : ticketCountBasis.basisLabel,
      ticketCountBasisDetail: generatedTickets.length
        ? `当前建议票数来自正式菲票拆分 ${formatQty(generatedTickets.length)} 张，已绑定原始裁片单 / 部位 / 尺码 / 二级工艺。`
        : ticketCountBasis.detailText,
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
    return Array.isArray(parsed) ? parsed.map((item) => normalizeRecordPrintableUnit(item as FeiTicketLabelRecord)) : []
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
    return Array.isArray(parsed) ? parsed.map((item) => normalizePrintJobPrintableUnit(item as FeiTicketPrintJob)) : []
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
  void options.markerStore
  void options.mergeBatches
  const materialRowsById = Object.fromEntries(options.materialPrepRows.map((row) => [row.originalCutOrderId, row]))
  const generatedTicketMap = getGeneratedFeiTicketMapByOriginalCutOrderId()
  const owners = options.originalRows
    .map((row) => {
      const generated = generatedTicketMap[row.originalCutOrderId] || []
      if (!generated.length) return null
      return createSeedOwnerFromRow({
        row,
        materialRow: materialRowsById[row.originalCutOrderId],
        plannedTicketQty: generated.length,
      })
    })
    .filter((owner): owner is OriginalCutOrderTicketOwner => Boolean(owner))
    .sort((left, right) => left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN'))

  const ticketRecords: FeiTicketLabelRecord[] = []
  const printJobs: FeiTicketPrintJob[] = []

  const resolveScope = (owner: OriginalCutOrderTicketOwner) => {
    const mergeBatchId = owner.relatedMergeBatchIds[0] || ''
    const mergeBatchNo = owner.relatedMergeBatchNos[0] || ''
    const sourceContextType: FeiTicketsContextType = mergeBatchId || mergeBatchNo ? 'merge-batch' : 'original-order'
    return {
      sourceContextType,
      sourceMergeBatchId: sourceContextType === 'merge-batch' ? mergeBatchId : '',
      sourceMergeBatchNo: sourceContextType === 'merge-batch' ? mergeBatchNo : '',
      printableUnitId: sourceContextType === 'merge-batch' ? `batch:${mergeBatchId}` : `cut-order:${owner.originalCutOrderId}`,
      printableUnitNo: sourceContextType === 'merge-batch' ? mergeBatchNo : owner.originalCutOrderNo,
      printableUnitType: sourceContextType === 'merge-batch' ? 'BATCH' as const : 'CUT_ORDER' as const,
    }
  }

  const firstOwner = owners[0]
  const secondOwner = owners[1]
  const thirdOwner = owners[2]
  const fourthOwner = owners[3]

  if (firstOwner) {
    const scope = resolveScope(firstOwner)
    const printedAt = '2026-03-23 10:15'
    const ticketSeeds = getGeneratedFeiRecordsByOriginalCutOrderId(firstOwner.originalCutOrderId).slice(0, 2)
    const printJob = createSeedPrintJob({
      printJobId: buildFeiPrintJobId(printedAt, firstOwner.originalCutOrderId, 'first'),
      printJobNo: 'FEI-PJ-DEMO-A-001',
      owner: firstOwner,
      ...scope,
      operationType: 'FIRST_PRINT',
      status: 'PRINTED',
      printedBy: '打票员-陈耀',
      printedAt,
      ticketRecordIds: ticketSeeds.map((item) => item.feiTicketId),
      note: '正式菲票主源首打演示。',
    })
    ticketSeeds.forEach((seed, index) => {
      ticketRecords.push(
        createSeedTicketRecord({
          owner: firstOwner,
          sequenceNo: index + 1,
          version: 1,
          printedAt,
          printedBy: printJob.printedBy,
          printJobId: printJob.printJobId,
          ...scope,
          quantity: seed.qty,
          partName: seed.partName,
          size: seed.skuSize,
          processTags: seed.secondaryCrafts,
        }),
      )
    })
    printJobs.push(printJob)
  }

  if (secondOwner) {
    const scope = resolveScope(secondOwner)
    const printedAt = '2026-03-23 11:20'
    const seed = getGeneratedFeiRecordBySequence(secondOwner.originalCutOrderId, 1)
    if (seed) {
      const printJob = createSeedPrintJob({
        printJobId: buildFeiPrintJobId(printedAt, secondOwner.originalCutOrderId, 'partial'),
        printJobNo: 'FEI-PJ-DEMO-B-001',
        owner: secondOwner,
        ...scope,
        operationType: 'FIRST_PRINT',
        status: 'PRINTED',
        printedBy: '打票员-周莉',
        printedAt,
        ticketRecordIds: [seed.feiTicketId],
        note: '正式菲票主源部分打印演示。',
      })
      ticketRecords.push(
        createSeedTicketRecord({
          owner: secondOwner,
          sequenceNo: 1,
          version: 1,
          printedAt,
          printedBy: printJob.printedBy,
          printJobId: printJob.printJobId,
          ...scope,
          quantity: seed.qty,
          partName: seed.partName,
          size: seed.skuSize,
          processTags: seed.secondaryCrafts,
        }),
      )
      printJobs.push(printJob)
    }
  }

  if (thirdOwner) {
    const scope = resolveScope(thirdOwner)
    const printedAt = '2026-03-23 14:10'
    const seedRecords = getGeneratedFeiRecordsByOriginalCutOrderId(thirdOwner.originalCutOrderId).slice(0, 2)
    if (seedRecords.length) {
      const printJob = createSeedPrintJob({
        printJobId: buildFeiPrintJobId(printedAt, thirdOwner.originalCutOrderId, 'void-base'),
        printJobNo: 'FEI-PJ-DEMO-C-001',
        owner: thirdOwner,
        ...scope,
        operationType: 'FIRST_PRINT',
        status: 'PRINTED',
        printedBy: '打票员-赵宁',
        printedAt,
        ticketRecordIds: seedRecords.map((item) => item.feiTicketId),
        note: '正式菲票主源作废演示。',
      })
      const firstRecord = createSeedTicketRecord({
        owner: thirdOwner,
        sequenceNo: 1,
        version: 1,
        printedAt,
        printedBy: printJob.printedBy,
        printJobId: printJob.printJobId,
        ...scope,
        quantity: seedRecords[0].qty,
        partName: seedRecords[0].partName,
        size: seedRecords[0].skuSize,
        processTags: seedRecords[0].secondaryCrafts,
      })
      ticketRecords.push(
        {
          ...firstRecord,
          status: 'VOIDED',
          voidedAt: '2026-03-24 08:45',
          voidedBy: '打票员-赵宁',
          voidReason: '二维码污损，待补打。',
        },
        ...seedRecords.slice(1).map((seed, index) =>
          createSeedTicketRecord({
            owner: thirdOwner,
            sequenceNo: index + 2,
            version: 1,
            printedAt,
            printedBy: printJob.printedBy,
            printJobId: printJob.printJobId,
            ...scope,
            quantity: seed.qty,
            partName: seed.partName,
            size: seed.skuSize,
            processTags: seed.secondaryCrafts,
          }),
        ),
      )
      printJobs.push(
        printJob,
        createSeedPrintJob({
          printJobId: buildFeiPrintJobId('2026-03-24 08:45', thirdOwner.originalCutOrderId, 'void'),
          printJobNo: 'FEI-PJ-DEMO-C-002',
          owner: thirdOwner,
          ...scope,
          operationType: 'VOID',
          status: 'CANCELLED',
          printedBy: '打票员-赵宁',
          printedAt: '2026-03-24 08:45',
          ticketRecordIds: [seedRecords[0].feiTicketId],
          fromTicketId: seedRecords[0].feiTicketId,
          reason: '二维码污损，待补打。',
          note: '正式菲票对象作废后仍保留主归属。',
        }),
      )
    }
  }

  if (fourthOwner) {
    const scope = resolveScope(fourthOwner)
    const firstPrintedAt = '2026-03-24 09:10'
    const replacementAt = '2026-03-24 09:25'
    const seedRecords = getGeneratedFeiRecordsByOriginalCutOrderId(fourthOwner.originalCutOrderId).slice(0, 2)
    if (seedRecords.length) {
      const firstPrintJob = createSeedPrintJob({
        printJobId: buildFeiPrintJobId(firstPrintedAt, fourthOwner.originalCutOrderId, 'replace-base'),
        printJobNo: 'FEI-PJ-DEMO-D-001',
        owner: fourthOwner,
        ...scope,
        operationType: 'FIRST_PRINT',
        status: 'PRINTED',
        printedBy: '打票员-刘芸',
        printedAt: firstPrintedAt,
        ticketRecordIds: seedRecords.map((item) => item.feiTicketId),
        note: '正式菲票补打替代演示。',
      })
      const originalRecord = createSeedTicketRecord({
        owner: fourthOwner,
        sequenceNo: 1,
        version: 1,
        printedAt: firstPrintedAt,
        printedBy: firstPrintJob.printedBy,
        printJobId: firstPrintJob.printJobId,
        ...scope,
        quantity: seedRecords[0].qty,
        partName: seedRecords[0].partName,
        size: seedRecords[0].skuSize,
        processTags: seedRecords[0].secondaryCrafts,
      })
      const replacementRecord = createSeedTicketRecord({
        owner: fourthOwner,
        sequenceNo: 1,
        version: 2,
        printedAt: replacementAt,
        printedBy: '打票员-刘芸',
        printJobId: buildFeiPrintJobId(replacementAt, fourthOwner.originalCutOrderId, 'replace'),
        ...scope,
        quantity: seedRecords[0].qty,
        partName: seedRecords[0].partName,
        size: seedRecords[0].skuSize,
        processTags: unique([...seedRecords[0].secondaryCrafts, '替代票']),
      })
      ticketRecords.push(
        {
          ...originalRecord,
          status: 'VOIDED',
          voidedAt: replacementAt,
          voidedBy: '打票员-刘芸',
          voidReason: '原票污损，已补打替代。',
          replacementTicketId: replacementRecord.ticketRecordId,
          replacementTicketNo: replacementRecord.ticketNo,
        },
        ...seedRecords.slice(1).map((seed, index) =>
          createSeedTicketRecord({
            owner: fourthOwner,
            sequenceNo: index + 2,
            version: 1,
            printedAt: firstPrintedAt,
            printedBy: firstPrintJob.printedBy,
            printJobId: firstPrintJob.printJobId,
            ...scope,
            quantity: seed.qty,
            partName: seed.partName,
            size: seed.skuSize,
            processTags: seed.secondaryCrafts,
          }),
        ),
        replacementRecord,
      )
      printJobs.push(
        firstPrintJob,
        createSeedPrintJob({
          printJobId: buildFeiPrintJobId(replacementAt, fourthOwner.originalCutOrderId, 'replace-void'),
          printJobNo: 'FEI-PJ-DEMO-D-002',
          owner: fourthOwner,
          ...scope,
          operationType: 'VOID',
          status: 'CANCELLED',
          printedBy: '打票员-刘芸',
          printedAt: replacementAt,
          ticketRecordIds: [originalRecord.ticketRecordId],
          fromTicketId: originalRecord.ticketRecordId,
          reason: '原票污损，为替代票让位。',
          note: '正式菲票对象作废动作。',
        }),
        createSeedPrintJob({
          printJobId: buildFeiPrintJobId(replacementAt, fourthOwner.originalCutOrderId, 'replace-reprint'),
          printJobNo: 'FEI-PJ-DEMO-D-003',
          owner: fourthOwner,
          ...scope,
          operationType: 'REPRINT',
          status: 'REPRINTED',
          printedBy: '打票员-刘芸',
          printedAt: replacementAt,
          ticketRecordIds: [replacementRecord.ticketRecordId],
          fromTicketId: originalRecord.ticketRecordId,
          toTicketId: replacementRecord.ticketRecordId,
          reason: '补打一张替代票。',
          note: '正式菲票对象替代关系。',
        }),
      )
    }
  }

  return {
    ticketRecords: ticketRecords.sort((left, right) => {
      const unitDiff = (left.printableUnitNo || '').localeCompare(right.printableUnitNo || '', 'zh-CN')
      if (unitDiff !== 0) return unitDiff
      if (left.sequenceNo !== right.sequenceNo) return left.sequenceNo - right.sequenceNo
      const leftVersion = left.version ?? left.reprintCount + 1
      const rightVersion = right.version ?? right.reprintCount + 1
      return leftVersion - rightVersion
    }),
    printJobs: printJobs.sort((left, right) => comparePrintedAtDesc(left.printedAt, right.printedAt)),
  }
}

export type PrintableUnitType = 'BATCH' | 'CUT_ORDER'
export type PrintableUnitStatus = 'WAITING_PRINT' | 'PARTIAL_PRINTED' | 'PRINTED' | 'NEED_REPRINT'

export interface PrintableUnitNavigationPayload {
  printableUnitId: string
  printableUnitNo: string
  printableUnitType: PrintableUnitType
  batchId?: string
  batchNo?: string
  cutOrderId?: string
  cutOrderNo?: string
  sourceProductionOrderNo?: string
}

export interface PrintableUnit {
  printableUnitId: string
  printableUnitNo: string
  printableUnitType: PrintableUnitType
  batchId: string
  batchNo: string
  cutOrderId: string
  cutOrderNo: string
  styleCode: string
  fabricSku: string
  sourceProductionOrderIds: string[]
  sourceProductionOrderNos: string[]
  sourceCutOrderIds: string[]
  sourceCutOrderNos: string[]
  sourceProductionOrderCount: number
  sourceCutOrderCount: number
  requiredTicketCount: number
  validPrintedTicketCount: number
  voidedTicketCount: number
  missingTicketCount: number
  printableUnitStatus: PrintableUnitStatus
  lastPrintedAt: string
  lastPrintedBy: string
  keywordIndex: string[]
  navigationPayload: PrintableUnitNavigationPayload
}

export interface PrintableUnitFilters {
  keyword: string
  printableUnitType: 'ALL' | PrintableUnitType
  styleCode: string
  fabricSku: string
  productionOrderNo: string
  printableUnitStatus: 'ALL' | PrintableUnitStatus
  printedFrom: string
  printedTo: string
}

export interface PrintableUnitStatusMeta {
  label: string
  className: string
  detailText: string
}

export interface PrintableUnitViewModel {
  units: PrintableUnit[]
  unitsById: Record<string, PrintableUnit>
  statusCounts: Record<PrintableUnitStatus, number>
}

export type TicketCardStatus = 'VALID' | 'VOIDED'

export interface TicketSplitDetail {
  detailId: string
  printableUnitId: string
  sourceCutOrderId: string
  sourceCutOrderNo: string
  sourceProductionOrderId: string
  sourceProductionOrderNo: string
  batchNo: string
  styleCode: string
  color: string
  size: string
  partName: string
  quantity: number
  requiredTicketCount: number
  validPrintedTicketCount: number
  gapCount: number
  sequenceNo: number
}

export interface TicketCard {
  ticketId: string
  ticketNo: string
  printableUnitId: string
  printableUnitNo: string
  printableUnitType: PrintableUnitType
  batchNo: string
  sourceCutOrderId: string
  sourceCutOrderNo: string
  sourceProductionOrderId: string
  sourceProductionOrderNo: string
  styleCode: string
  color: string
  size: string
  partName: string
  quantity: number
  processTags: string[]
  qrPayload: string
  version: number
  status: TicketCardStatus
  printedAt: string
  printedBy: string
  voidedAt: string
  voidedBy: string
  voidReason: string
  replacementTicketId: string
  replacementTicketNo: string
  downstreamLocked: boolean
  downstreamLockedReason: string
  boundPocketNo: string
  boundUsageNo: string
}

export interface TicketPrintRecord {
  recordId: string
  printableUnitId: string
  operationType: FeiTicketOperationType
  ticketIds: string[]
  operator: string
  operatedAt: string
  reason: string
  printerName: string
  templateName: string
  fromTicketId: string
  toTicketId: string
  remark: string
  printableUnitNo: string
  relatedTicketCount: number
}

export interface PrintableUnitDetailViewModel {
  unit: PrintableUnit
  statusMeta: PrintableUnitStatusMeta
  splitDetails: TicketSplitDetail[]
  ticketCards: TicketCard[]
  printRecords: TicketPrintRecord[]
  missingSplitDetails: TicketSplitDetail[]
}

export interface ExecutePrintableUnitPrintResult {
  printJob: FeiTicketPrintJob
  nextRecords: FeiTicketLabelRecord[]
  nextJobs: FeiTicketPrintJob[]
}

export interface VoidTicketCardResult {
  voidJob: FeiTicketPrintJob
  nextRecords: FeiTicketLabelRecord[]
  nextJobs: FeiTicketPrintJob[]
}

interface PrintableUnitSourceOwner {
  owner: OriginalCutOrderTicketOwner
  row: OriginalCutOrderRow
}

const printableUnitStatusMetaMap: Record<PrintableUnitStatus, PrintableUnitStatusMeta> = {
  WAITING_PRINT: {
    label: '待打印',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    detailText: '已完成裁片，但当前还没有有效菲票。',
  },
  PARTIAL_PRINTED: {
    label: '部分打印',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    detailText: '已有部分有效菲票，当前仍存在未打印缺口。',
  },
  PRINTED: {
    label: '已打印',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '有效菲票数已达到应打数量，当前没有补打缺口。',
  },
  NEED_REPRINT: {
    label: '需补打',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
    detailText: '曾发生作废或替换，当前有效菲票数不足，需要补打。',
  },
}

function isFeiTicketRecordVoided(record: FeiTicketLabelRecord): boolean {
  return record.status === 'VOIDED'
}

function isPrintableSourceRow(row: OriginalCutOrderRow): boolean {
  if (row.currentStage.key === 'WAITING_INBOUND' || row.currentStage.key === 'DONE') return true
  return /待入仓|已完成|已入仓/.test(row.currentStage.label)
}

function comparePrintedAtDesc(left: string, right: string): number {
  return right.localeCompare(left, 'zh-CN')
}

function derivePrintableUnitSortPriority(status: PrintableUnitStatus): number {
  switch (status) {
    case 'WAITING_PRINT':
      return 0
    case 'NEED_REPRINT':
      return 1
    case 'PARTIAL_PRINTED':
      return 2
    case 'PRINTED':
    default:
      return 3
  }
}

function collectTicketStats(
  scope: PrintableUnitScope,
  ticketRecords: FeiTicketLabelRecord[],
  printJobs: FeiTicketPrintJob[],
): {
  validPrintedTicketCount: number
  voidedTicketCount: number
  lastPrintedAt: string
  lastPrintedBy: string
} {
  const relatedRecords = ticketRecords.filter((record) => matchesPrintableUnitRecord(scope, record))
  const relatedJobs = printJobs
    .filter((job) => matchesPrintableUnitPrintJob(scope, job))
    .sort((left, right) => comparePrintedAtDesc(left.printedAt, right.printedAt))

  const validPrintedRecords = relatedRecords.filter((record) => !isFeiTicketRecordVoided(record))
  const voidedRecords = relatedRecords.filter((record) => isFeiTicketRecordVoided(record))
  const latestRecord = [...relatedRecords].sort((left, right) => comparePrintedAtDesc(left.printedAt, right.printedAt))[0]
  const latestJob = relatedJobs[0]

  return {
    validPrintedTicketCount: validPrintedRecords.length,
    voidedTicketCount: voidedRecords.length,
    lastPrintedAt: latestJob?.printedAt || latestRecord?.printedAt || '',
    lastPrintedBy: latestJob?.printedBy || latestRecord?.printedBy || '',
  }
}

export function derivePrintableUnitStatus(options: {
  requiredTicketCount: number
  validPrintedTicketCount: number
  voidedTicketCount: number
  hasPrintedHistory: boolean
}): PrintableUnitStatus {
  if (options.requiredTicketCount > 0 && options.validPrintedTicketCount === 0 && options.voidedTicketCount === 0) {
    return 'WAITING_PRINT'
  }

  if (options.requiredTicketCount > 0 && options.validPrintedTicketCount >= options.requiredTicketCount) {
    return 'PRINTED'
  }

  if (
    options.hasPrintedHistory &&
    options.validPrintedTicketCount < options.requiredTicketCount &&
    options.voidedTicketCount > 0
  ) {
    return 'NEED_REPRINT'
  }

  return 'PARTIAL_PRINTED'
}

export function getPrintableUnitStatusMeta(status: PrintableUnitStatus): PrintableUnitStatusMeta {
  return printableUnitStatusMetaMap[status]
}

export function buildPrintableUnitNavigationPayload(unit: PrintableUnit): PrintableUnitNavigationPayload {
  return {
    printableUnitId: unit.printableUnitId,
    printableUnitNo: unit.printableUnitNo,
    printableUnitType: unit.printableUnitType,
    batchId: unit.batchId || undefined,
    batchNo: unit.batchNo || undefined,
    cutOrderId: unit.cutOrderId || undefined,
    cutOrderNo: unit.cutOrderNo || undefined,
    sourceProductionOrderNo: unit.sourceProductionOrderNos[0] || undefined,
  }
}

function buildPrintableUnitFromCutOrder(options: {
  owner: OriginalCutOrderTicketOwner
  row: OriginalCutOrderRow
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
}): PrintableUnit {
  const scope: PrintableUnitScope = {
    printableUnitId: `cut-order:${options.owner.originalCutOrderId}`,
    printableUnitNo: options.owner.originalCutOrderNo,
    printableUnitType: 'CUT_ORDER',
    batchId: '',
    batchNo: '',
    cutOrderId: options.owner.originalCutOrderId,
    sourceCutOrderIds: [options.owner.originalCutOrderId],
  }
  const stats = collectTicketStats(scope, options.ticketRecords, options.printJobs)
  const requiredTicketCount = Math.max(options.owner.plannedTicketQty, 0)
  const missingTicketCount = Math.max(requiredTicketCount - stats.validPrintedTicketCount, 0)
  const printableUnitStatus = derivePrintableUnitStatus({
    requiredTicketCount,
    validPrintedTicketCount: stats.validPrintedTicketCount,
    voidedTicketCount: stats.voidedTicketCount,
    hasPrintedHistory: stats.validPrintedTicketCount + stats.voidedTicketCount > 0,
  })

  const unit: PrintableUnit = {
    printableUnitId: `cut-order:${options.owner.originalCutOrderId}`,
    printableUnitNo: options.owner.originalCutOrderNo,
    printableUnitType: 'CUT_ORDER',
    batchId: '',
    batchNo: '',
    cutOrderId: options.owner.originalCutOrderId,
    cutOrderNo: options.owner.originalCutOrderNo,
    styleCode: options.owner.styleCode || options.owner.spuCode || '',
    fabricSku: options.owner.materialSku,
    sourceProductionOrderIds: [options.owner.productionOrderId],
    sourceProductionOrderNos: [options.owner.productionOrderNo],
    sourceCutOrderIds: [options.owner.originalCutOrderId],
    sourceCutOrderNos: [options.owner.originalCutOrderNo],
    sourceProductionOrderCount: 1,
    sourceCutOrderCount: 1,
    requiredTicketCount,
    validPrintedTicketCount: stats.validPrintedTicketCount,
    voidedTicketCount: stats.voidedTicketCount,
    missingTicketCount,
    printableUnitStatus,
    lastPrintedAt: stats.lastPrintedAt,
    lastPrintedBy: stats.lastPrintedBy,
    keywordIndex: buildKeywordIndex([
      options.owner.originalCutOrderNo,
      options.owner.productionOrderNo,
      options.owner.styleCode,
      options.owner.spuCode,
      options.owner.materialSku,
      options.row.latestMergeBatchNo,
    ]),
    navigationPayload: {
      printableUnitId: '',
      printableUnitNo: '',
      printableUnitType: 'CUT_ORDER',
    },
  }

  unit.navigationPayload = buildPrintableUnitNavigationPayload(unit)
  return unit
}

function buildPrintableUnitFromBatch(options: {
  batch: MergeBatchRecord
  owners: OriginalCutOrderTicketOwner[]
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
}): PrintableUnit {
  const sourceProductionOrderIds = uniqueStrings(options.batch.items.map((item) => item.productionOrderId))
  const sourceProductionOrderNos = uniqueStrings(options.batch.items.map((item) => item.productionOrderNo))
  const sourceCutOrderIds = uniqueStrings(options.owners.map((owner) => owner.originalCutOrderId))
  const sourceCutOrderNos = uniqueStrings(options.owners.map((owner) => owner.originalCutOrderNo))
  const scope: PrintableUnitScope = {
    printableUnitId: `batch:${options.batch.mergeBatchId}`,
    printableUnitNo: options.batch.mergeBatchNo,
    printableUnitType: 'BATCH',
    batchId: options.batch.mergeBatchId,
    batchNo: options.batch.mergeBatchNo,
    cutOrderId: '',
    sourceCutOrderIds,
  }
  const stats = collectTicketStats(scope, options.ticketRecords, options.printJobs)
  const requiredTicketCount = options.owners.reduce((sum, owner) => sum + Math.max(owner.plannedTicketQty, 0), 0)
  const missingTicketCount = Math.max(requiredTicketCount - stats.validPrintedTicketCount, 0)
  const printableUnitStatus = derivePrintableUnitStatus({
    requiredTicketCount,
    validPrintedTicketCount: stats.validPrintedTicketCount,
    voidedTicketCount: stats.voidedTicketCount,
    hasPrintedHistory: stats.validPrintedTicketCount + stats.voidedTicketCount > 0,
  })

  const unit: PrintableUnit = {
    printableUnitId: `batch:${options.batch.mergeBatchId}`,
    printableUnitNo: options.batch.mergeBatchNo,
    printableUnitType: 'BATCH',
    batchId: options.batch.mergeBatchId,
    batchNo: options.batch.mergeBatchNo,
    cutOrderId: '',
    cutOrderNo: '',
    styleCode: options.batch.styleCode || options.owners[0]?.styleCode || options.batch.spuCode || '',
    fabricSku: options.batch.materialSkuSummary || uniqueStrings(options.owners.map((owner) => owner.materialSku)).join(' / '),
    sourceProductionOrderIds,
    sourceProductionOrderNos,
    sourceCutOrderIds,
    sourceCutOrderNos,
    sourceProductionOrderCount: sourceProductionOrderNos.length,
    sourceCutOrderCount: sourceCutOrderNos.length,
    requiredTicketCount,
    validPrintedTicketCount: stats.validPrintedTicketCount,
    voidedTicketCount: stats.voidedTicketCount,
    missingTicketCount,
    printableUnitStatus,
    lastPrintedAt: stats.lastPrintedAt,
    lastPrintedBy: stats.lastPrintedBy,
    keywordIndex: buildKeywordIndex([
      options.batch.mergeBatchNo,
      options.batch.styleCode,
      options.batch.spuCode,
      options.batch.materialSkuSummary,
      ...sourceProductionOrderNos,
      ...sourceCutOrderNos,
    ]),
    navigationPayload: {
      printableUnitId: '',
      printableUnitNo: '',
      printableUnitType: 'BATCH',
    },
  }

  unit.navigationPayload = buildPrintableUnitNavigationPayload(unit)
  return unit
}

function filterUnitsByContext(
  units: PrintableUnit[],
  prefilter: FeiTicketsPrefilter | null,
): PrintableUnit[] {
  if (!prefilter) return units
  return units.filter((unit) => {
    if (prefilter.mergeBatchId && unit.batchId !== prefilter.mergeBatchId) return false
    if (prefilter.mergeBatchNo && unit.batchNo !== prefilter.mergeBatchNo) return false
    if (prefilter.originalCutOrderId && !unit.sourceCutOrderIds.includes(prefilter.originalCutOrderId)) return false
    if (prefilter.originalCutOrderNo && !unit.sourceCutOrderNos.includes(prefilter.originalCutOrderNo)) return false
    if (prefilter.productionOrderNo && !unit.sourceProductionOrderNos.includes(prefilter.productionOrderNo)) return false
    return true
  })
}

export function filterPrintableUnits(units: PrintableUnit[], filters: PrintableUnitFilters): PrintableUnit[] {
  const keyword = filters.keyword.trim().toLowerCase()
  const styleCode = filters.styleCode.trim().toLowerCase()
  const fabricSku = filters.fabricSku.trim().toLowerCase()
  const productionOrderNo = filters.productionOrderNo.trim().toLowerCase()

  return units.filter((unit) => {
    if (filters.printableUnitType !== 'ALL' && unit.printableUnitType !== filters.printableUnitType) return false
    if (filters.printableUnitStatus !== 'ALL' && unit.printableUnitStatus !== filters.printableUnitStatus) return false
    if (styleCode && !unit.styleCode.toLowerCase().includes(styleCode)) return false
    if (fabricSku && !unit.fabricSku.toLowerCase().includes(fabricSku)) return false
    if (productionOrderNo && !unit.sourceProductionOrderNos.some((value) => value.toLowerCase().includes(productionOrderNo))) {
      return false
    }
    if (filters.printedFrom && (!unit.lastPrintedAt || unit.lastPrintedAt.slice(0, 10) < filters.printedFrom)) return false
    if (filters.printedTo && (!unit.lastPrintedAt || unit.lastPrintedAt.slice(0, 10) > filters.printedTo)) return false
    if (!keyword) return true
    return unit.keywordIndex.some((value) => value.includes(keyword))
  })
}

export function buildPrintableUnitViewModel(options: {
  originalRows: OriginalCutOrderRow[]
  materialPrepRows: MaterialPrepRow[]
  mergeBatches: MergeBatchRecord[]
  markerStore: MarkerSpreadingStore
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
  prefilter: FeiTicketsPrefilter | null
}): PrintableUnitViewModel {
  const ownerView = buildFeiTicketsViewModel({
    originalRows: options.originalRows,
    materialPrepRows: options.materialPrepRows,
    mergeBatches: options.mergeBatches,
    markerStore: options.markerStore,
    ticketRecords: options.ticketRecords,
    printJobs: options.printJobs,
    drafts: {},
    prefilter: null,
  })

  const ownersByCutOrderId = Object.fromEntries(ownerView.owners.map((owner) => [owner.originalCutOrderId, owner]))
  const rowsByCutOrderId = Object.fromEntries(options.originalRows.map((row) => [row.originalCutOrderId, row]))
  const units: PrintableUnit[] = []
  const coveredCutOrderIds = new Set<string>()

  options.mergeBatches.forEach((batch) => {
    const memberOwners = batch.items
      .map((item) => ownersByCutOrderId[item.originalCutOrderId])
      .filter((owner): owner is OriginalCutOrderTicketOwner => Boolean(owner))
    if (!memberOwners.length) return

    const memberRows = memberOwners
      .map((owner) => rowsByCutOrderId[owner.originalCutOrderId])
      .filter((row): row is OriginalCutOrderRow => Boolean(row))
    if (!memberRows.length || !memberRows.every(isPrintableSourceRow)) return

    memberRows.forEach((row) => coveredCutOrderIds.add(row.originalCutOrderId))
    units.push(
      buildPrintableUnitFromBatch({
        batch,
        owners: memberOwners,
        ticketRecords: options.ticketRecords,
        printJobs: options.printJobs,
      }),
    )
  })

  ownerView.owners.forEach((owner) => {
    const row = rowsByCutOrderId[owner.originalCutOrderId]
    if (!row || !isPrintableSourceRow(row)) return
    if (coveredCutOrderIds.has(owner.originalCutOrderId)) return
    if (owner.relatedMergeBatchIds.length || owner.relatedMergeBatchNos.length || row.latestMergeBatchNo) return
    units.push(
      buildPrintableUnitFromCutOrder({
        owner,
        row,
        ticketRecords: options.ticketRecords,
        printJobs: options.printJobs,
      }),
    )
  })

  const contextualUnits = filterUnitsByContext(units, options.prefilter)
    .filter((unit) => unit.requiredTicketCount > 0)
    .sort((left, right) => {
      const priorityDiff = derivePrintableUnitSortPriority(left.printableUnitStatus) - derivePrintableUnitSortPriority(right.printableUnitStatus)
      if (priorityDiff !== 0) return priorityDiff
      const printedDiff = comparePrintedAtDesc(left.lastPrintedAt, right.lastPrintedAt)
      if (printedDiff !== 0) return printedDiff
      return left.printableUnitNo.localeCompare(right.printableUnitNo, 'zh-CN')
    })

  return {
    units: contextualUnits,
    unitsById: Object.fromEntries(contextualUnits.map((unit) => [unit.printableUnitId, unit])),
    statusCounts: {
      WAITING_PRINT: contextualUnits.filter((unit) => unit.printableUnitStatus === 'WAITING_PRINT').length,
      PARTIAL_PRINTED: contextualUnits.filter((unit) => unit.printableUnitStatus === 'PARTIAL_PRINTED').length,
      PRINTED: contextualUnits.filter((unit) => unit.printableUnitStatus === 'PRINTED').length,
      NEED_REPRINT: contextualUnits.filter((unit) => unit.printableUnitStatus === 'NEED_REPRINT').length,
    },
  }
}

const printablePartCycle = ['左前片', '右前片', '左袖', '右袖', '后片', '领口']
const printableSizeCycle = ['M', 'L', 'XL', 'S', '2XL', '均码']

function buildOwnerMaps(options: {
  originalRows: OriginalCutOrderRow[]
  materialPrepRows: MaterialPrepRow[]
  mergeBatches: MergeBatchRecord[]
  markerStore: MarkerSpreadingStore
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
}): {
  ownersByCutOrderId: Record<string, OriginalCutOrderTicketOwner>
  rowsByCutOrderId: Record<string, OriginalCutOrderRow>
} {
  const ownerView = buildFeiTicketsViewModel({
    originalRows: options.originalRows,
    materialPrepRows: options.materialPrepRows,
    mergeBatches: options.mergeBatches,
    markerStore: options.markerStore,
    ticketRecords: options.ticketRecords,
    printJobs: options.printJobs,
    drafts: {},
    prefilter: null,
  })

  return {
    ownersByCutOrderId: Object.fromEntries(ownerView.owners.map((owner) => [owner.originalCutOrderId, owner])),
    rowsByCutOrderId: Object.fromEntries(options.originalRows.map((row) => [row.originalCutOrderId, row])),
  }
}

function collectPrintableUnitOwners(
  unit: PrintableUnit,
  ownersByCutOrderId: Record<string, OriginalCutOrderTicketOwner>,
  rowsByCutOrderId: Record<string, OriginalCutOrderRow>,
): PrintableUnitSourceOwner[] {
  return unit.sourceCutOrderIds
    .map((cutOrderId) => {
      const owner = ownersByCutOrderId[cutOrderId]
      const row = rowsByCutOrderId[cutOrderId]
      if (!owner || !row) return null
      return { owner, row }
    })
    .filter((item): item is PrintableUnitSourceOwner => Boolean(item))
}

function findDetailSourceRecord(
  detail: TicketSplitDetail,
  ticketRecords: FeiTicketLabelRecord[],
): FeiTicketLabelRecord[] {
  return ticketRecords
    .filter(
      (record) =>
        record.printableUnitId === detail.printableUnitId &&
        record.originalCutOrderId === detail.sourceCutOrderId &&
        record.sequenceNo === detail.sequenceNo,
    )
    .sort((left, right) => {
      const leftVersion = left.version ?? left.reprintCount + 1
      const rightVersion = right.version ?? right.reprintCount + 1
      if (leftVersion !== rightVersion) return rightVersion - leftVersion
      return comparePrintedAtDesc(left.printedAt, right.printedAt)
    })
}

function buildSplitDetailsFromOwner(
  unit: PrintableUnit,
  source: PrintableUnitSourceOwner,
  ticketRecords: FeiTicketLabelRecord[],
): TicketSplitDetail[] {
  const generatedFeiRecords = getGeneratedFeiRecordsByOriginalCutOrderId(source.owner.originalCutOrderId)
  const detailSeeds = generatedFeiRecords.length
    ? generatedFeiRecords.map((record, index) => ({
        sequenceNo: index + 1,
        detailId: `${source.owner.originalCutOrderId}-${index + 1}`,
        color: record.skuColor || source.owner.color,
        size: record.skuSize || printableSizeCycle[index % printableSizeCycle.length],
        partName: record.partName || printablePartCycle[index % printablePartCycle.length],
        quantity: Math.max(record.qty, 1),
      }))
    : Array.from({ length: Math.max(source.owner.plannedTicketQty, 0) }, (_, index) => ({
        sequenceNo: index + 1,
        detailId: `${source.owner.originalCutOrderId}-${index + 1}`,
        color: source.owner.color,
        size: printableSizeCycle[index % printableSizeCycle.length],
        partName: printablePartCycle[index % printablePartCycle.length],
        quantity: 1,
      }))

  return detailSeeds.map((seed) => {
    const relatedRecords = findDetailSourceRecord(
      {
        detailId: seed.detailId,
        printableUnitId: unit.printableUnitId,
        sourceCutOrderId: source.owner.originalCutOrderId,
        sourceCutOrderNo: source.owner.originalCutOrderNo,
        sourceProductionOrderId: source.owner.productionOrderId,
        sourceProductionOrderNo: source.owner.productionOrderNo,
        batchNo: unit.batchNo || source.owner.relatedMergeBatchNos[0] || '',
        styleCode: source.owner.styleCode,
        color: seed.color,
        size: seed.size,
        partName: seed.partName,
        quantity: seed.quantity,
        requiredTicketCount: 1,
        validPrintedTicketCount: 0,
        gapCount: 0,
        sequenceNo: seed.sequenceNo,
      },
      ticketRecords,
    ).filter((record) => !isFeiTicketRecordVoided(record))
    const validPrintedTicketCount = relatedRecords.length
    return {
      detailId: seed.detailId,
      printableUnitId: unit.printableUnitId,
      sourceCutOrderId: source.owner.originalCutOrderId,
      sourceCutOrderNo: source.owner.originalCutOrderNo,
      sourceProductionOrderId: source.owner.productionOrderId,
      sourceProductionOrderNo: source.owner.productionOrderNo,
      batchNo: unit.batchNo || source.owner.relatedMergeBatchNos[0] || '',
      styleCode: source.owner.styleCode,
      color: seed.color,
      size: seed.size,
      partName: seed.partName,
      quantity: seed.quantity,
      requiredTicketCount: 1,
      validPrintedTicketCount,
      gapCount: Math.max(1 - validPrintedTicketCount, 0),
      sequenceNo: seed.sequenceNo,
    }
  })
}

export function buildTicketSplitDetails(options: {
  unit: PrintableUnit
  originalRows: OriginalCutOrderRow[]
  materialPrepRows: MaterialPrepRow[]
  mergeBatches: MergeBatchRecord[]
  markerStore: MarkerSpreadingStore
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
}): TicketSplitDetail[] {
  const { ownersByCutOrderId, rowsByCutOrderId } = buildOwnerMaps(options)
  const sources = collectPrintableUnitOwners(options.unit, ownersByCutOrderId, rowsByCutOrderId)
  return sources.flatMap((source) => buildSplitDetailsFromOwner(options.unit, source, options.ticketRecords))
}

export function buildTicketCards(options: {
  unit: PrintableUnit
  splitDetails: TicketSplitDetail[]
  ticketRecords: FeiTicketLabelRecord[]
}): TicketCard[] {
  const detailMap = new Map(options.splitDetails.map((detail) => [`${detail.sourceCutOrderId}:${detail.sequenceNo}`, detail]))

  return options.ticketRecords
    .filter((record) => matchesPrintableUnitRecord(options.unit, record))
    .map((record) => {
      const detail =
        detailMap.get(`${record.originalCutOrderId}:${record.sequenceNo}`) ||
        options.splitDetails.find((item) => item.detailId === record.splitDetailId) ||
        null
      return {
        ticketId: record.ticketRecordId,
        ticketNo: record.ticketNo,
        printableUnitId: options.unit.printableUnitId,
        printableUnitNo: options.unit.printableUnitNo,
        printableUnitType: options.unit.printableUnitType,
        batchNo: record.sourceMergeBatchNo || options.unit.batchNo,
        sourceCutOrderId: record.originalCutOrderId,
        sourceCutOrderNo: record.originalCutOrderNo,
        sourceProductionOrderId: record.sourceProductionOrderId || '',
        sourceProductionOrderNo: record.productionOrderNo,
        styleCode: record.styleCode,
        color: record.color || detail?.color || '',
        size: record.size || detail?.size || '待补尺码',
        partName: record.partName || detail?.partName || '待补部位',
        quantity: record.quantity ?? detail?.quantity ?? 1,
        processTags: record.processTags || [],
        qrPayload: record.qrSerializedValue || record.qrValue,
        version: record.version ?? record.reprintCount + 1,
        status: isFeiTicketRecordVoided(record) ? 'VOIDED' : 'VALID',
        printedAt: record.printedAt,
        printedBy: record.printedBy,
        voidedAt: record.voidedAt || '',
        voidedBy: record.voidedBy || '',
        voidReason: record.voidReason || '',
        replacementTicketId: record.replacementTicketId || '',
        replacementTicketNo: record.replacementTicketNo || '',
        downstreamLocked: Boolean(record.downstreamLocked),
        downstreamLockedReason: record.downstreamLockedReason || '',
        boundPocketNo: record.boundPocketNo || '',
        boundUsageNo: record.boundUsageNo || '',
      }
    })
    .sort((left, right) => comparePrintedAtDesc(left.printedAt, right.printedAt))
}

export function buildTicketPrintRecords(options: {
  unit: PrintableUnit
  printJobs: FeiTicketPrintJob[]
}): TicketPrintRecord[] {
  return options.printJobs
    .filter((job) => matchesPrintableUnitPrintJob(options.unit, job))
    .map((job) => ({
      recordId: job.printJobId,
      printableUnitId: options.unit.printableUnitId,
      operationType: job.operationType || (job.status === 'REPRINTED' ? 'REPRINT' : 'FIRST_PRINT'),
      ticketIds: job.ticketRecordIds || [],
      operator: job.printedBy,
      operatedAt: job.printedAt,
      reason: job.reason || '',
      printerName: job.printerName || '待补打印机',
      templateName: job.templateName || '裁片菲票标准模板',
      fromTicketId: job.fromTicketId || '',
      toTicketId: job.toTicketId || '',
      remark: job.remark || job.note || '',
      printableUnitNo: job.printableUnitNo || options.unit.printableUnitNo,
      relatedTicketCount: job.ticketRecordIds?.length || job.totalTicketCount || 0,
    }))
    .sort((left, right) => comparePrintedAtDesc(left.operatedAt, right.operatedAt))
}

export function buildPrintableUnitDetailViewModel(options: {
  unit: PrintableUnit
  originalRows: OriginalCutOrderRow[]
  materialPrepRows: MaterialPrepRow[]
  mergeBatches: MergeBatchRecord[]
  markerStore: MarkerSpreadingStore
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
}): PrintableUnitDetailViewModel {
  const splitDetails = buildTicketSplitDetails(options)
  const ticketCards = buildTicketCards({
    unit: options.unit,
    splitDetails,
    ticketRecords: options.ticketRecords,
  })
  const printRecords = buildTicketPrintRecords({
    unit: options.unit,
    printJobs: options.printJobs,
  })

  return {
    unit: options.unit,
    statusMeta: getPrintableUnitStatusMeta(options.unit.printableUnitStatus),
    splitDetails,
    ticketCards,
    printRecords,
    missingSplitDetails: splitDetails.filter((detail) => detail.gapCount > 0),
  }
}

function buildTicketRecordId(originalCutOrderId: string, sequenceNo: number, version: number): string {
  return `ticket-${originalCutOrderId}-${String(sequenceNo).padStart(3, '0')}-v${version}`
}

function buildVersionedTicketNo(originalCutOrderNo: string, sequenceNo: number, version: number): string {
  const baseNo = buildFeiTicketNo(originalCutOrderNo, sequenceNo)
  return version <= 1 ? baseNo : `${baseNo}-V${version}`
}

function nextPrintJobNo(existingJobs: FeiTicketPrintJob[], nowText: string): string {
  return buildPrintJobNo(existingJobs, nowText)
}

function selectVoidSourceRecord(
  detail: TicketSplitDetail,
  ticketRecords: FeiTicketLabelRecord[],
  explicitFromTicketId?: string,
): FeiTicketLabelRecord | null {
  if (explicitFromTicketId) {
    return (
      ticketRecords.find(
        (record) =>
          record.ticketRecordId === explicitFromTicketId &&
          record.originalCutOrderId === detail.sourceCutOrderId,
      ) || null
    )
  }

  return (
    findDetailSourceRecord(detail, ticketRecords).find(
      (record) => isFeiTicketRecordVoided(record) && !record.replacementTicketId,
    ) || null
  )
}

function operationTypeToStatus(operationType: FeiTicketOperationType): FeiTicketPrintJobStatus {
  if (operationType === 'VOID') return 'CANCELLED'
  if (operationType === 'REPRINT') return 'REPRINTED'
  return 'PRINTED'
}

export function executePrintableUnitPrint(options: {
  unit: PrintableUnit
  splitDetails: TicketSplitDetail[]
  originalRows: OriginalCutOrderRow[]
  materialPrepRows: MaterialPrepRow[]
  mergeBatches: MergeBatchRecord[]
  markerStore: MarkerSpreadingStore
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
  operationType: Extract<FeiTicketOperationType, 'FIRST_PRINT' | 'CONTINUE_PRINT' | 'REPRINT'>
  operator: string
  operatedAt: string
  printerName: string
  templateName: string
  reason: string
  remark: string
  fromTicketId?: string
}): ExecutePrintableUnitPrintResult {
  const { ownersByCutOrderId } = buildOwnerMaps(options)
  const nextRecordsMap = new Map(options.ticketRecords.map((record) => [record.ticketRecordId, record]))
  const targetDetails =
    options.operationType === 'REPRINT'
      ? options.splitDetails.filter((detail) => detail.gapCount > 0)
      : options.splitDetails.filter((detail) => detail.gapCount > 0)

  const printJobId = buildFeiPrintJobId(
    options.operatedAt,
    uniqueStrings(options.splitDetails.map((detail) => detail.sourceCutOrderId))[0] || options.unit.printableUnitId,
    options.operationType.toLowerCase(),
  )
  const createdRecords: FeiTicketLabelRecord[] = []

  targetDetails.forEach((detail) => {
    const owner = ownersByCutOrderId[detail.sourceCutOrderId]
    if (!owner) return

    const relatedRecords = findDetailSourceRecord(detail, Array.from(nextRecordsMap.values()))
    const currentVersion = Math.max(0, ...relatedRecords.map((record) => record.version ?? record.reprintCount + 1))
    const nextVersion = currentVersion + 1
    const ticketRecordId = buildTicketRecordId(detail.sourceCutOrderId, detail.sequenceNo, nextVersion)
    const fromRecord = selectVoidSourceRecord(detail, Array.from(nextRecordsMap.values()), options.fromTicketId)
    const nextRecord = attachQrSnapshotToRecord(
      {
        ...createEmptyPreviewRecord(
          owner,
          detail.sequenceNo,
          options.unit.printableUnitType === 'BATCH' ? 'merge-batch' : 'original-order',
          options.unit.batchId,
          options.unit.batchNo,
        ),
        ticketRecordId,
        ticketNo: buildVersionedTicketNo(detail.sourceCutOrderNo, detail.sequenceNo, nextVersion),
        printableUnitId: options.unit.printableUnitId,
        printableUnitNo: options.unit.printableUnitNo,
        printableUnitType: options.unit.printableUnitType,
        quantity: detail.quantity,
        partName: detail.partName,
        size: detail.size,
        processTags: [],
        version: nextVersion,
        createdAt: options.operatedAt,
        printedAt: options.operatedAt,
        printedBy: options.operator,
        reprintCount: Math.max(nextVersion - 1, 0),
        sourcePrintJobId: printJobId,
        status: 'PRINTED',
        splitDetailId: detail.detailId,
        sourceProductionOrderId: detail.sourceProductionOrderId,
      },
      owner,
      {
        printJobId,
        printJobNo: '',
      },
    )
    createdRecords.push(nextRecord)
    nextRecordsMap.set(ticketRecordId, nextRecord)

    if (fromRecord && fromRecord.ticketRecordId !== ticketRecordId) {
      nextRecordsMap.set(fromRecord.ticketRecordId, {
        ...fromRecord,
        replacementTicketId: ticketRecordId,
        replacementTicketNo: nextRecord.ticketNo,
      })
    }
  })

  const printJobNo = nextPrintJobNo(options.printJobs, options.operatedAt)
  const printJob: FeiTicketPrintJob = {
    printJobId,
    printJobNo,
    ownerType: 'original-cut-order',
    originalCutOrderIds: uniqueStrings(targetDetails.map((detail) => detail.sourceCutOrderId)),
    originalCutOrderNos: uniqueStrings(targetDetails.map((detail) => detail.sourceCutOrderNo)),
    sourceContextType: options.unit.printableUnitType === 'BATCH' ? 'merge-batch' : 'original-order',
    sourceMergeBatchId: options.unit.batchId,
    sourceMergeBatchNo: options.unit.batchNo,
    totalTicketCount: createdRecords.length,
    status: operationTypeToStatus(options.operationType),
    printedBy: options.operator,
    printedAt: options.operatedAt,
    note: options.remark || options.reason || '',
    printableUnitId: options.unit.printableUnitId,
    printableUnitNo: options.unit.printableUnitNo,
    printableUnitType: options.unit.printableUnitType,
    operationType: options.operationType,
    reason: options.reason,
    printerName: options.printerName,
    templateName: options.templateName,
    ticketRecordIds: createdRecords.map((record) => record.ticketRecordId),
    fromTicketId: options.fromTicketId || '',
    toTicketId: createdRecords.length === 1 ? createdRecords[0].ticketRecordId : '',
    remark: options.remark,
  }

  createdRecords.forEach((record) => {
    nextRecordsMap.set(
      record.ticketRecordId,
      attachQrSnapshotToRecord(
        {
          ...record,
          sourcePrintJobId: printJob.printJobId,
        },
        ownersByCutOrderId[record.originalCutOrderId],
        printJob,
      ),
    )
  })

  return {
    printJob,
    nextRecords: Array.from(nextRecordsMap.values()).sort((left, right) => {
      const byOrder = left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN')
      if (byOrder !== 0) return byOrder
      if (left.sequenceNo !== right.sequenceNo) return left.sequenceNo - right.sequenceNo
      const leftVersion = left.version ?? left.reprintCount + 1
      const rightVersion = right.version ?? right.reprintCount + 1
      return leftVersion - rightVersion
    }),
    nextJobs: [printJob, ...options.printJobs].sort((left, right) => comparePrintedAtDesc(left.printedAt, right.printedAt)),
  }
}

export function canVoidTicketCard(record: FeiTicketLabelRecord | null): {
  allowed: boolean
  reason: string
} {
  if (!record) return { allowed: false, reason: '未找到目标菲票。' }
  if (isFeiTicketRecordVoided(record)) return { allowed: false, reason: '该菲票已作废，不能重复作废。' }
  if (record.downstreamLocked) return { allowed: false, reason: record.downstreamLockedReason || '该菲票已被下游引用，当前禁止作废。' }
  return { allowed: true, reason: '' }
}

export function voidTicketCard(options: {
  recordId: string
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
  operator: string
  operatedAt: string
  reason: string
  remark: string
  printableUnit?: PrintableUnit | null
}): VoidTicketCardResult | null {
  const target = options.ticketRecords.find((record) => record.ticketRecordId === options.recordId) || null
  const validation = canVoidTicketCard(target)
  if (!target || !validation.allowed) return null

  const nextRecords = options.ticketRecords.map((record) =>
    record.ticketRecordId === options.recordId
      ? {
          ...record,
          status: 'VOIDED' as const,
          voidedAt: options.operatedAt,
          voidedBy: options.operator,
          voidReason: options.reason,
        }
      : record,
  )

  const voidJob: FeiTicketPrintJob = {
    printJobId: buildFeiPrintJobId(options.operatedAt, target.originalCutOrderId, 'void'),
    printJobNo: nextPrintJobNo(options.printJobs, options.operatedAt),
    ownerType: 'original-cut-order',
    originalCutOrderIds: [target.originalCutOrderId],
    originalCutOrderNos: [target.originalCutOrderNo],
    sourceContextType: target.sourceContextType,
    sourceMergeBatchId: target.sourceMergeBatchId,
    sourceMergeBatchNo: target.sourceMergeBatchNo,
    totalTicketCount: 1,
    status: 'CANCELLED',
    printedBy: options.operator,
    printedAt: options.operatedAt,
    note: options.remark || options.reason,
    printableUnitId: options.printableUnit?.printableUnitId,
    printableUnitNo: options.printableUnit?.printableUnitNo,
    printableUnitType: options.printableUnit?.printableUnitType,
    operationType: 'VOID',
    reason: options.reason,
    printerName: '',
    templateName: '',
    ticketRecordIds: [target.ticketRecordId],
    fromTicketId: target.ticketRecordId,
    toTicketId: '',
    remark: options.remark,
  }

  return {
    voidJob,
    nextRecords,
    nextJobs: [voidJob, ...options.printJobs].sort((left, right) => comparePrintedAtDesc(left.printedAt, right.printedAt)),
  }
}
