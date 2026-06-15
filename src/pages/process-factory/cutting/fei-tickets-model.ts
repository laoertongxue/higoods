import type { CutOrderRow, CutOrderNavigationPayload } from './cut-orders-model.ts'
import type { MaterialPrepRow } from './material-prep-model.ts'
import type { MarkerSpreadingStore } from './marker-spreading-model.ts'
import type { MarkerPlanSourceRecord } from './marker-plan-source-model.ts'
import {
  buildCuttingTraceabilityId,
} from '../../../data/fcs/cutting/qr-codes.ts'
import {
  FEI_TICKET_SOURCE_BASIS,
  FEI_TICKET_SOURCE_BASIS_TYPE,
  FEI_TICKET_WAITING_SOURCE_BASIS_TYPE,
  getGeneratedFeiTicketMapByCutOrderId,
  getFeiTicketById as getGeneratedFeiTicketById,
  listActualCuttingOutputGeneratedFeiTicketsByCutOrderId,
  type GeneratedFeiTicketSourceRecord,
  type FeiTicketSpecialCraft,
  type PieceSequenceRange,
  type FeiTicketSourceBasis,
  type FeiTicketSourceBasisType,
  type WaitingFeiTicketSourceBasisType,
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
    printableUnitId: 'cut-order:CUT-260302-004-01',
    printableUnitNo: 'CUT-260302-004-01',
  },
  CASE_B: {
    printableUnitId: 'marker-plan:MKP-260302-004-MAIN',
    printableUnitNo: 'MKP-260302-004-MAIN',
    batchId: 'MKP-260302-004-MAIN',
    batchNo: 'MKP-260302-004-MAIN',
    sourceCutOrderIds: ['CUT-260302-004-01', 'CUT-260301-005-01', 'CUT-260301-005-01'],
  },
  CASE_C: {
    printableUnitId: 'cut-order:CUT-260301-005-01',
    printableUnitNo: 'CUT-260301-005-01',
    sampleTicketNo: 'FT-CUT-260301-005-01-001',
    sampleTicketId: 'ticket-CUT-260301-005-01-001-v1',
  },
} as const

export type FeiTicketsContextType = 'cut-order' | 'marker-plan'
export type FeiTicketStatusKey =
  | 'NOT_GENERATED'
  | 'DRAFT'
  | 'PARTIAL_PRINTED'
  | 'PRINTED'
  | 'REPRINTED'
  | 'PENDING_SUPPLEMENT'

export type FeiTicketPrintJobStatus = 'PRINTED' | 'REPRINTED'
export type FeiTicketOperationType = 'FIRST_PRINT' | 'REPRINT'

export interface FeiTicketsContext {
  contextType: FeiTicketsContextType
  cutOrderIds: string[]
  cutOrderNos: string[]
  markerPlanId: string
  markerPlanNo: string
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
  cutOrders: Record<string, string | undefined>
  markerPlanSources: Record<string, string | undefined>
  markerSpreading: Record<string, string | undefined>
  summary: Record<string, string | undefined>
  transferBags: Record<string, string | undefined>
}

export interface CutOrderTicketOwner {
  ownerType: 'cut-order'
  id: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  styleName: string
  color: string
  materialSku: string
  materialAlias: string
  materialImageUrl: string
  plannedTicketQty: number
  printedTicketQty: number
  latestPrintJobNo: string
  ticketStatus: FeiTicketStatusKey
  sameCodeValue: string
  qrBaseValue: string
  relatedMarkerPlanIds: string[]
  relatedMarkerPlanNos: string[]
  sourceContextLabel: string
  ticketCountBasisType: FeiTicketSourceBasisType | WaitingFeiTicketSourceBasisType
  ticketCountBasisLabel: string
  ticketCountBasisDetail: string
  currentStageLabel: string
  sourceStageLabel: string
  riskLabels: string[]
  latestActionText: string
  qrReservedPayload: FeiQrReservedPayload
  navigationPayload: FeiNavigationPayload
  keywordIndex: string[]
}

export interface FeiTicketLabelRecord {
  ticketRecordId: string
  ticketNo: string
  sourceOutputLineId?: string
  sourceBasis?: FeiTicketSourceBasis
  sourceBasisType?: FeiTicketSourceBasisType
  sourceSpreadingSessionId?: string
  sourceSpreadingSessionNo?: string
  sourceMarkerId?: string
  sourceMarkerNo?: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  materialSku: string
  materialAlias?: string
  materialImageUrl?: string
  fabricRollId?: string
  fabricRollNo?: string
  fabricColor?: string
  garmentSkuId?: string
  garmentColor?: string
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
  sourceMarkerPlanId: string
  sourceMarkerPlanNo: string
  printableUnitId?: string
  printableUnitNo?: string
  printableUnitType?: PrintableUnitType
  sourceProductionOrderId?: string
  splitDetailId?: string
  partCode?: string
  partName?: string
  partInstanceNo?: string
  size?: string
  bundleNo?: string
  pieceSetNoStart?: number
  pieceSetNoEnd?: number
  pieceSetNoRange?: string
  bundleTicketType?: string
  quantity?: number
  actualCutPieceQty?: number
  printStatus?: 'WAIT_PRINT' | 'PRINTED' | 'REPRINTED' | 'VOIDED'
  processTags?: string[]
  hasSpecialCraft?: boolean
  specialCrafts?: FeiTicketSpecialCraft[]
  specialCraftDisplayLabel?: string
  pieceSequenceRange?: PieceSequenceRange | null
  pieceSequenceLabel?: string
  pieceSequenceCannotGenerateReason?: string
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
  qrSnapshotText?: string
  qrSerializedValue?: string
  reservedProcess?: unknown
  reservedTrace?: unknown
  sourceQrBaseValue?: string
  schemaNote?: string
}

export interface FeiTicketPrintJob {
  printJobId: string
  printJobNo: string
  ownerType: 'cut-order'
  cutOrderIds: string[]
  cutOrderNos: string[]
  sourceContextType: FeiTicketsContextType
  sourceMarkerPlanId: string
  sourceMarkerPlanNo: string
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
  cutOrderId: string
  sourceContextType: FeiTicketsContextType
  sourceMarkerPlanId: string
  sourceMarkerPlanNo: string
  ticketCount: number
  previewLabelRecords: FeiTicketLabelRecord[]
  note: string
  isReprint: boolean
  createdAt: string
  updatedAt: string
}

export interface FeiTicketsPrefilter {
  cutOrderId?: string
  cutOrderNo?: string
  markerPlanId?: string
  markerPlanNo?: string
  productionOrderNo?: string
  spreadingSessionId?: string
  spreadingSessionNo?: string
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
  owners: CutOrderTicketOwner[]
  ownersById: Record<string, CutOrderTicketOwner>
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
  basisType: FeiTicketSourceBasisType | WaitingFeiTicketSourceBasisType
  ticketCount: number
  basisLabel: string
  detailText: string
}

export interface CreateFeiTicketDraftOptions {
  owner: CutOrderTicketOwner
  context: FeiTicketsContext | null
  ticketCount: number
  note: string
  nowText: string
}

export interface CreateFeiTicketPrintJobResult {
  printJob: FeiTicketPrintJob
  nextRecords: FeiTicketLabelRecord[]
}

type MarkerPlanSourceRefLike = {
  relatedMarkerPlanIds?: string[]
  relatedMarkerPlanNos?: string[]
  markerPlanIds?: string[]
  markerPlanNos?: string[]
}

const feiTicketStatusMetaMap: Record<FeiTicketStatusKey, FeiTicketStatusMeta> = {
  NOT_GENERATED: {
    label: '未生成',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    detailText: '当前裁片单尚未生成菲票草稿。',
  },
  DRAFT: {
    label: '草稿中',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    detailText: '当前裁片单已生成打印草稿，尚未执行打印。',
  },
  PARTIAL_PRINTED: {
    label: '需补打',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    detailText: '当前裁片单存在菲票缺口，需要补打。',
  },
  PRINTED: {
    label: '已打印',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前裁片单已完成首轮菲票打印。',
  },
  REPRINTED: {
    label: '已重打',
    className: 'bg-violet-100 text-violet-700 border border-violet-200',
    detailText: '当前裁片单已发生重打，需按打印作业台账追溯。',
  },
  PENDING_SUPPLEMENT: {
    label: '待补录',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
    detailText: '当前票据基础数据不足，需要补录后再生成菲票。',
  },
}

function getMarkerPlanSourceIds(source: MarkerPlanSourceRefLike): string[] {
  if (Array.isArray(source.relatedMarkerPlanIds)) return source.relatedMarkerPlanIds
  if (Array.isArray(source.markerPlanIds)) return source.markerPlanIds
  return []
}

function getMarkerPlanSourceNos(source: MarkerPlanSourceRefLike): string[] {
  if (Array.isArray(source.relatedMarkerPlanNos)) return source.relatedMarkerPlanNos
  if (Array.isArray(source.markerPlanNos)) return source.markerPlanNos
  return []
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function getGeneratedFeiRecordsByCutOrderId(cutOrderId: string): GeneratedFeiTicketSourceRecord[] {
  return listActualCuttingOutputGeneratedFeiTicketsByCutOrderId(cutOrderId)
}

function getGeneratedFeiRecordBySequence(
  cutOrderId: string,
  sequenceNo: number,
): GeneratedFeiTicketSourceRecord | null {
  return getGeneratedFeiRecordsByCutOrderId(cutOrderId)[sequenceNo - 1] || null
}

function buildFeiPrintJobId(nowText: string, cutOrderId: string, actionType: string): string {
  return buildCuttingTraceabilityId('print-job', nowText, cutOrderId, actionType)
}

function formatQty(value: number): string {
  return numberFormatter.format(Math.max(value, 0))
}

export function isFeiTicketFiveDimComplete(record: Pick<
  FeiTicketLabelRecord | TicketCard | TicketSplitDetail,
  'fabricRollNo' | 'fabricColor' | 'size' | 'partName' | 'quantity'
>): boolean {
  return Boolean(
    String(record.fabricRollNo || '').trim()
    && String(record.fabricColor || '').trim()
    && String(record.size || '').trim()
    && String(record.partName || '').trim()
    && Number(record.quantity || 0) > 0,
  )
}

export function buildFeiTicketFiveDimTitle(record: Pick<
  FeiTicketLabelRecord | TicketCard | TicketSplitDetail,
  'fabricRollNo' | 'fabricColor' | 'size' | 'partName' | 'quantity' | 'pieceSetNoRange' | 'bundleNo'
>): string {
  if (!isFeiTicketFiveDimComplete(record)) return '暂无数据'
  const pieceSetText = record.pieceSetNoRange ? `配套${record.pieceSetNoRange}` : record.bundleNo
  return `${record.fabricRollNo} - ${record.fabricColor} - ${record.size} - ${record.partName} - ${pieceSetText || '待补扎号'} - ${formatQty(record.quantity)}`
}

function createEmptyPreviewRecord(
  owner: CutOrderTicketOwner,
  sequenceNo: number,
  sourceContextType: FeiTicketsContextType,
  sourceMarkerPlanId: string,
  sourceMarkerPlanNo: string,
): FeiTicketLabelRecord {
  const generated = getGeneratedFeiRecordBySequence(owner.cutOrderId, sequenceNo)
  return {
    ticketRecordId: generated?.feiTicketId || `${owner.cutOrderId}-${sequenceNo}`,
    ticketNo: generated?.feiTicketNo || buildFeiTicketNo(owner.cutOrderNo, sequenceNo),
    sourceOutputLineId: generated?.sourceOutputLineId || '',
    sourceBasis: generated?.sourceBasis || FEI_TICKET_SOURCE_BASIS,
    sourceBasisType: generated?.sourceBasisType || FEI_TICKET_SOURCE_BASIS_TYPE,
    sourceSpreadingSessionId: generated?.sourceSpreadingSessionId || '',
    sourceSpreadingSessionNo: generated?.sourceSpreadingSessionNo || '',
    sourceMarkerId: generated?.sourceMarkerId || '',
    sourceMarkerNo: generated?.sourceMarkerNo || '',
    cutOrderId: owner.cutOrderId,
    cutOrderNo: owner.cutOrderNo,
    productionOrderNo: owner.productionOrderNo,
    styleCode: owner.styleCode,
    spuCode: owner.spuCode,
    materialSku: owner.materialSku,
    materialAlias: owner.materialAlias || '',
    materialImageUrl: owner.materialImageUrl || '',
    fabricRollId: generated?.fabricRollId || '',
    fabricRollNo: generated?.fabricRollNo || '',
    fabricColor: generated?.fabricColor || generated?.skuColor || owner.color,
    garmentSkuId: generated?.garmentSkuId || '',
    garmentColor: generated?.garmentColor || generated?.skuColor || owner.color,
    color: generated?.fabricColor || generated?.skuColor || owner.color,
    sequenceNo,
    status: 'PRINTED',
    qrValue: generated?.qrValue || `${owner.qrBaseValue}-${String(sequenceNo).padStart(3, '0')}`,
    createdAt: '',
    printedAt: '',
    printedBy: '',
    reprintCount: 0,
    sourcePrintJobId: '',
    sourceContextType,
    sourceMarkerPlanId,
    sourceMarkerPlanNo,
    partCode: generated?.partCode || '',
    partName: generated?.partName || '',
    size: generated?.skuSize || '',
    bundleNo: generated?.bundleNo || `BUNDLE-${String(sequenceNo).padStart(3, '0')}`,
    pieceSetNoStart: generated?.pieceSetNoStart || 1,
    pieceSetNoEnd: generated?.pieceSetNoEnd || generated?.bundleQty || 1,
    pieceSetNoRange: generated?.pieceSetNoRange || `1-${Math.max(generated?.bundleQty || 1, 1)}`,
    bundleTicketType: generated?.bundleTicketType || '扎束菲票',
    quantity: generated?.bundleQty ?? generated?.qty ?? 1,
    actualCutPieceQty: generated?.actualCutPieceQty ?? generated?.qty ?? 1,
    printStatus: generated?.printStatus || 'WAIT_PRINT',
    processTags: generated?.secondaryCrafts || [],
    hasSpecialCraft: generated?.hasSpecialCraft || false,
    specialCrafts: generated?.specialCrafts ? generated.specialCrafts.map((craft) => ({ ...craft })) : [],
    specialCraftDisplayLabel: generated?.specialCraftDisplayLabel || '无',
    pieceSequenceRange: generated?.pieceSequenceRange ? { ...generated.pieceSequenceRange } : null,
    pieceSequenceLabel: generated?.pieceSequenceLabel || '不可生成',
    pieceSequenceCannotGenerateReason: generated?.pieceSequenceCannotGenerateReason || '',
  }
}

function createSeedOwnerFromRow(options: {
  row: CutOrderRow
  materialRow: MaterialPrepRow | undefined
  plannedTicketQty: number
}): CutOrderTicketOwner {
  const markerPlanIds = Array.isArray(options.row.markerPlanIds) ? options.row.markerPlanIds : []
  const markerPlanNos = Array.isArray(options.row.markerPlanNos) ? options.row.markerPlanNos : []

  return {
    ownerType: 'cut-order',
    id: options.row.id,
    cutOrderId: options.row.cutOrderId,
    cutOrderNo: options.row.cutOrderNo,
    productionOrderId: options.row.productionOrderId,
    productionOrderNo: options.row.productionOrderNo,
    styleCode: options.row.styleCode,
    spuCode: options.row.spuCode,
    styleName: options.row.styleName,
    color: options.row.color,
    materialSku: options.row.materialSku,
    materialAlias: options.row.materialAlias || '',
    materialImageUrl: options.row.materialImageUrl || '',
    plannedTicketQty: options.plannedTicketQty,
    printedTicketQty: 0,
    latestPrintJobNo: '',
    ticketStatus: 'NOT_GENERATED',
    sameCodeValue: options.materialRow?.sameCodeValue || options.row.cutOrderNo,
    qrBaseValue: options.materialRow?.qrCodeValue || `QR-${options.row.cutOrderNo}`,
    relatedMarkerPlanIds: markerPlanIds,
    relatedMarkerPlanNos: markerPlanNos,
    sourceContextLabel: markerPlanNos[0] ? `来自唛架方案 ${markerPlanNos[0]}` : '裁片单上下文',
    ticketCountBasisType: FEI_TICKET_WAITING_SOURCE_BASIS_TYPE,
    ticketCountBasisLabel: '待实际裁剪产出',
    ticketCountBasisDetail: '当前尚未形成实际裁剪产出，不能生成菲票。',
    currentStageLabel: options.row.currentStage.label,
    sourceStageLabel: options.row.currentStage.label,
    riskLabels: options.row.riskTags.map((tag) => tag.label),
    latestActionText: options.row.latestActionText,
    qrReservedPayload: {
      qrBaseValue: options.materialRow?.qrCodeValue || `QR-${options.row.cutOrderNo}`,
      reservedProcessFields: {},
      reservedVersion: 'v-next',
    },
    navigationPayload: buildFeiNavigationPayload(
      {
        cutOrderId: options.row.cutOrderId,
        cutOrderNo: options.row.cutOrderNo,
        productionOrderNo: options.row.productionOrderNo,
        markerPlanIds,
        markerPlanNos,
      },
      null,
    ),
    keywordIndex: buildKeywordIndex([
      options.row.cutOrderNo,
      options.row.productionOrderNo,
      options.row.styleCode,
      options.row.spuCode,
      options.row.styleName,
      options.row.materialSku,
      options.materialRow?.sameCodeValue,
      ...markerPlanNos,
    ]),
  }
}

function createSeedTicketRecord(options: {
  owner: CutOrderTicketOwner
  sequenceNo: number
  version: number
  printedAt: string
  printedBy: string
  printJobId: string
  printableUnitId: string
  printableUnitNo: string
  printableUnitType: PrintableUnitType
  sourceContextType: FeiTicketsContextType
  sourceMarkerPlanId: string
  sourceMarkerPlanNo: string
  quantity?: number
  partName?: string
  size?: string
  processTags?: string[]
}): FeiTicketLabelRecord {
  const generated = getGeneratedFeiRecordBySequence(options.owner.cutOrderId, options.sequenceNo)
  return attachQrSnapshotToRecord(
    {
      ...createEmptyPreviewRecord(
        options.owner,
        options.sequenceNo,
        options.sourceContextType,
        options.sourceMarkerPlanId,
        options.sourceMarkerPlanNo,
      ),
      ticketRecordId:
        options.version <= 1
          ? generated?.feiTicketId || buildTicketRecordId(options.owner.cutOrderId, options.sequenceNo, options.version)
          : buildTicketRecordId(options.owner.cutOrderId, options.sequenceNo, options.version),
      ticketNo:
        options.version <= 1
          ? generated?.feiTicketNo || buildVersionedTicketNo(options.owner.cutOrderNo, options.sequenceNo, options.version)
          : buildVersionedTicketNo(options.owner.cutOrderNo, options.sequenceNo, options.version),
      printableUnitId: options.printableUnitId,
      printableUnitNo: options.printableUnitNo,
      printableUnitType: options.printableUnitType,
      sourceProductionOrderId: options.owner.productionOrderId,
      splitDetailId: `${options.owner.cutOrderId}-${options.sequenceNo}`,
      createdAt: options.printedAt,
      printedAt: options.printedAt,
      printedBy: options.printedBy,
      reprintCount: Math.max(options.version - 1, 0),
      sourcePrintJobId: options.printJobId,
      status: 'PRINTED',
      partCode: generated?.partCode || '',
      partName: options.partName || generated?.partName || printablePartCycle[(options.sequenceNo - 1) % printablePartCycle.length],
      size: options.size || generated?.skuSize || printableSizeCycle[(options.sequenceNo - 1) % printableSizeCycle.length],
      bundleNo: generated?.bundleNo || `BUNDLE-${String(options.sequenceNo).padStart(3, '0')}`,
      pieceSetNoStart: generated?.pieceSetNoStart || 1,
      pieceSetNoEnd: generated?.pieceSetNoEnd || generated?.bundleQty || options.quantity || 1,
      pieceSetNoRange: generated?.pieceSetNoRange || `1-${Math.max(generated?.bundleQty || options.quantity || 1, 1)}`,
      bundleTicketType: generated?.bundleTicketType || '扎束菲票',
      quantity: options.quantity ?? generated?.bundleQty ?? generated?.qty ?? 1,
      actualCutPieceQty: generated?.actualCutPieceQty ?? options.quantity ?? generated?.qty ?? 1,
      printStatus: options.version > 1 ? 'REPRINTED' : generated?.printStatus || 'PRINTED',
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
  owner: CutOrderTicketOwner
  printableUnitId: string
  printableUnitNo: string
  printableUnitType: PrintableUnitType
  sourceContextType: FeiTicketsContextType
  sourceMarkerPlanId: string
  sourceMarkerPlanNo: string
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
    ownerType: 'cut-order',
    cutOrderIds: [options.owner.cutOrderId],
    cutOrderNos: [options.owner.cutOrderNo],
    sourceContextType: options.sourceContextType,
    sourceMarkerPlanId: options.sourceMarkerPlanId,
    sourceMarkerPlanNo: options.sourceMarkerPlanNo,
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
    printerName: 'Zebra ZT411',
    templateName: '裁片菲票标准模板',
    ticketRecordIds: options.ticketRecordIds,
    fromTicketId: options.fromTicketId || '',
    toTicketId: options.toTicketId || '',
    remark: options.note || '',
  }
}

function attachQrSnapshotToRecord(
  record: FeiTicketLabelRecord,
  owner: Pick<
    CutOrderTicketOwner,
    | 'cutOrderId'
    | 'cutOrderNo'
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
    qrSnapshotText: JSON['stringify'](payload),
    qrSerializedValue: serializeFeiQrPayload(payload),
    reservedProcess: payload.reservedProcess,
    reservedTrace: payload.reservedTrace,
    sourceQrBaseValue: owner.qrBaseValue,
    schemaNote: '',
  }
}

type PrintableUnitScope = Pick<
  PrintableUnit,
  'printableUnitId' | 'printableUnitNo' | 'printableUnitType' | 'batchId' | 'batchNo' | 'cutOrderId' | 'sourceCutOrderIds'
>

function normalizeRecordPrintableUnit(record: FeiTicketLabelRecord): FeiTicketLabelRecord {
  const normalizedRecord: FeiTicketLabelRecord = {
    ...record,
    sourceSpreadingSessionId: record.sourceSpreadingSessionId || '',
    sourceSpreadingSessionNo: record.sourceSpreadingSessionNo || '',
    sourceMarkerId: record.sourceMarkerId || '',
    sourceMarkerNo: record.sourceMarkerNo || '',
  }

  if (normalizedRecord.printableUnitId && normalizedRecord.printableUnitNo && normalizedRecord.printableUnitType) return normalizedRecord

  if (normalizedRecord.sourceContextType === 'marker-plan' && normalizedRecord.sourceMarkerPlanId) {
    return {
      ...normalizedRecord,
      printableUnitId: normalizedRecord.printableUnitId || `marker-plan:${normalizedRecord.sourceMarkerPlanId}`,
      printableUnitNo: normalizedRecord.printableUnitNo || normalizedRecord.sourceMarkerPlanNo,
      printableUnitType: normalizedRecord.printableUnitType || 'MARKER_PLAN',
    }
  }

  return {
    ...normalizedRecord,
    printableUnitId: normalizedRecord.printableUnitId || `cut-order:${normalizedRecord.cutOrderId}`,
    printableUnitNo: normalizedRecord.printableUnitNo || normalizedRecord.cutOrderNo,
    printableUnitType: normalizedRecord.printableUnitType || 'CUT_ORDER',
  }
}

function normalizePrintJobPrintableUnit(printJob: FeiTicketPrintJob): FeiTicketPrintJob {
  if (printJob.printableUnitId && printJob.printableUnitNo && printJob.printableUnitType) return printJob

  if (printJob.sourceContextType === 'marker-plan' && printJob.sourceMarkerPlanId) {
    return {
      ...printJob,
      printableUnitId: printJob.printableUnitId || `marker-plan:${printJob.sourceMarkerPlanId}`,
      printableUnitNo: printJob.printableUnitNo || printJob.sourceMarkerPlanNo,
      printableUnitType: printJob.printableUnitType || 'MARKER_PLAN',
    }
  }

  const sourceCutOrderId = printJob.cutOrderIds[0] || ''
  const sourceCutOrderNo = printJob.cutOrderNos[0] || ''
  return {
    ...printJob,
    printableUnitId: printJob.printableUnitId || (sourceCutOrderId ? `cut-order:${sourceCutOrderId}` : ''),
    printableUnitNo: printJob.printableUnitNo || sourceCutOrderNo,
    printableUnitType: printJob.printableUnitType || 'CUT_ORDER',
  }
}

function matchesPrintableUnitRecord(scope: PrintableUnitScope, record: FeiTicketLabelRecord): boolean {
  if (record.printableUnitId) return record.printableUnitId === scope.printableUnitId

  if (scope.printableUnitType === 'MARKER_PLAN') {
    return Boolean(scope.batchId) && record.sourceContextType === 'marker-plan' && record.sourceMarkerPlanId === scope.batchId
  }

  return record.cutOrderId === scope.cutOrderId
}

function matchesPrintableUnitPrintJob(scope: PrintableUnitScope, printJob: FeiTicketPrintJob): boolean {
  if (printJob.printableUnitId) return printJob.printableUnitId === scope.printableUnitId

  if (scope.printableUnitType === 'MARKER_PLAN') {
    return Boolean(scope.batchId) && printJob.sourceContextType === 'marker-plan' && printJob.sourceMarkerPlanId === scope.batchId
  }

  return Boolean(scope.cutOrderId) && printJob.cutOrderIds.includes(scope.cutOrderId)
}

function findMatchingMarkerPlanSource(
  markerPlanSources: MarkerPlanSourceRecord[],
  prefilter: FeiTicketsPrefilter | null,
): MarkerPlanSourceRecord | null {
  if (!prefilter) return null
  return (
    (prefilter.markerPlanId && markerPlanSources.find((batch) => batch.markerPlanId === prefilter.markerPlanId)) ||
    (prefilter.markerPlanNo && markerPlanSources.find((batch) => batch.markerPlanNo === prefilter.markerPlanNo)) ||
    null
  )
}

function buildContext(
  owners: CutOrderTicketOwner[],
  markerPlanSources: MarkerPlanSourceRecord[],
  prefilter: FeiTicketsPrefilter | null,
): FeiTicketsContext | null {
  const batch = findMatchingMarkerPlanSource(markerPlanSources, prefilter)
  if (batch) {
    const batchOwners = owners.filter((owner) => batch.items.some((item) => item.cutOrderId === owner.cutOrderId))
    if (!batchOwners.length) return null
    return {
      contextType: 'marker-plan',
      cutOrderIds: batchOwners.map((owner) => owner.cutOrderId),
      cutOrderNos: batchOwners.map((owner) => owner.cutOrderNo),
      markerPlanId: batch.markerPlanId,
      markerPlanNo: batch.markerPlanNo,
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
    (prefilter.cutOrderId && owners.find((item) => item.cutOrderId === prefilter.cutOrderId)) ||
    (prefilter.cutOrderNo && owners.find((item) => item.cutOrderNo === prefilter.cutOrderNo)) ||
    null

  if (!owner) return null
  const markerPlanIds = getMarkerPlanSourceIds(owner)
  const markerPlanNos = getMarkerPlanSourceNos(owner)
  return {
    contextType: 'cut-order',
    cutOrderIds: [owner.cutOrderId],
    cutOrderNos: [owner.cutOrderNo],
    markerPlanId: markerPlanIds[0] || '',
    markerPlanNo: markerPlanNos[0] || '',
    productionOrderIds: [owner.productionOrderId],
    productionOrderNos: [owner.productionOrderNo],
    styleCode: owner.styleCode,
    spuCode: owner.spuCode,
    styleName: owner.styleName,
    materialSkuSummary: owner.materialSku,
  }
}

function findRelevantMarkerPieceCount(
  owner: Pick<CutOrderTicketOwner, 'cutOrderId' | 'relatedMarkerPlanIds' | 'relatedMarkerPlanNos'>,
  markerStore: MarkerSpreadingStore,
  context: FeiTicketsContext | null,
): number | null {
  const originalMarker = markerStore.markers.find(
    (marker) => marker.contextType === 'cut-order' && marker.cutOrderIds.includes(owner.cutOrderId),
  )
  if (originalMarker?.totalPieces) return originalMarker.totalPieces

  const ownerMarkerPlanSourceIds = getMarkerPlanSourceIds(owner)
  const ownerMarkerPlanSourceNos = getMarkerPlanSourceNos(owner)
  const targetBatchId = context?.contextType === 'marker-plan' ? context.markerPlanId : ownerMarkerPlanSourceIds[0]
  const targetBatchNo = context?.contextType === 'marker-plan' ? context.markerPlanNo : ownerMarkerPlanSourceNos[0]
  const mergeMarker = markerStore.markers.find((marker) => {
    if (marker.contextType !== 'marker-plan') return false
    return (targetBatchId && marker.markerPlanId === targetBatchId) || (targetBatchNo && marker.markerPlanNo === targetBatchNo)
  })
  return mergeMarker?.totalPieces ?? null
}

export function resolveTicketCountBasis(
  owner: Pick<CutOrderTicketOwner, 'cutOrderId' | 'relatedMarkerPlanIds' | 'relatedMarkerPlanNos'> & { orderQtyHint: number },
  markerStore: MarkerSpreadingStore,
  context: FeiTicketsContext | null,
  actualOutputTicketCount = 0,
): TicketCountBasisResult {
  if (actualOutputTicketCount > 0) {
    return {
      basisType: FEI_TICKET_SOURCE_BASIS_TYPE,
      ticketCount: actualOutputTicketCount,
      basisLabel: FEI_TICKET_SOURCE_BASIS,
      detailText: `当前按实际裁剪产出生成，按实际裁片数量拆分 ${formatQty(actualOutputTicketCount)} 张。`,
    }
  }

  const markerPieces = findRelevantMarkerPieceCount(owner, markerStore, context)
  if (markerPieces && markerPieces > 0) {
    return {
      basisType: FEI_TICKET_WAITING_SOURCE_BASIS_TYPE,
      ticketCount: 0,
      basisLabel: '待实际裁剪产出',
      detailText: '已维护唛架方案，但尚未形成实际裁剪产出，不能生成菲票。',
    }
  }

  void owner.orderQtyHint
  return {
    basisType: FEI_TICKET_WAITING_SOURCE_BASIS_TYPE,
    ticketCount: 0,
    basisLabel: '待实际裁剪产出',
    detailText: '当前尚未形成实际裁剪产出，不能生成菲票。',
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

export function buildFeiTicketNo(cutOrderNo: string, sequenceNo: number): string {
  return `FT-${cutOrderNo}-${String(sequenceNo).padStart(3, '0')}`
}

export function buildFeiTicketPreview(
  owner: CutOrderTicketOwner,
  sourceContextType: FeiTicketsContextType,
  sourceMarkerPlanId: string,
  sourceMarkerPlanNo: string,
  ticketCount: number,
  sequenceNos?: number[],
): FeiTicketLabelRecord[] {
  const sequences = sequenceNos?.length
    ? Array.from(new Set(sequenceNos.filter((value) => value > 0))).sort((left, right) => left - right)
    : Array.from({ length: Math.max(ticketCount, 0) }, (_, index) => index + 1)

  return sequences.map((sequenceNo) =>
    createEmptyPreviewRecord(owner, sequenceNo, sourceContextType, sourceMarkerPlanId, sourceMarkerPlanNo),
  )
}

export function createFeiTicketDraft(options: CreateFeiTicketDraftOptions): FeiTicketDraft {
  const previewLabelRecords = buildFeiTicketPreview(
    options.owner,
    options.context?.contextType || 'cut-order',
    options.context?.markerPlanId || '',
    options.context?.markerPlanNo || '',
    options.ticketCount,
  )

  return {
    draftId: `draft-${options.owner.cutOrderId}`,
    cutOrderId: options.owner.cutOrderId,
    sourceContextType: options.context?.contextType || 'cut-order',
    sourceMarkerPlanId: options.context?.markerPlanId || '',
    sourceMarkerPlanNo: options.context?.markerPlanNo || '',
    ticketCount: options.ticketCount,
    previewLabelRecords,
    note: options.note,
    isReprint: false,
    createdAt: options.nowText,
    updatedAt: options.nowText,
  }
}

export function buildReprintDraft(
  owner: CutOrderTicketOwner,
  ticketRecords: FeiTicketLabelRecord[],
  context: FeiTicketsContext | null,
  nowText: string,
): FeiTicketDraft | null {
  const ownedRecords = ticketRecords
    .filter((record) => record.cutOrderId === owner.cutOrderId)
    .sort((left, right) => left.sequenceNo - right.sequenceNo)

  if (!ownedRecords.length) return null

  const previewLabelRecords = buildFeiTicketPreview(
    owner,
    context?.contextType || ownedRecords[0].sourceContextType || 'cut-order',
    context?.markerPlanId || ownedRecords[0].sourceMarkerPlanId || '',
    context?.markerPlanNo || ownedRecords[0].sourceMarkerPlanNo || '',
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
    draftId: `draft-${owner.cutOrderId}`,
    cutOrderId: owner.cutOrderId,
    sourceContextType: context?.contextType || ownedRecords[0].sourceContextType || 'cut-order',
    sourceMarkerPlanId: context?.markerPlanId || ownedRecords[0].sourceMarkerPlanId || '',
    sourceMarkerPlanNo: context?.markerPlanNo || ownedRecords[0].sourceMarkerPlanNo || '',
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
  owner: CutOrderTicketOwner
  existingRecords: FeiTicketLabelRecord[]
  existingJobs: FeiTicketPrintJob[]
  printedBy: string
  nowText: string
}): CreateFeiTicketPrintJobResult {
  const existingBySequence = new Map(
    options.existingRecords
      .filter((record) => record.cutOrderId === options.owner.cutOrderId)
      .map((record) => [record.sequenceNo, record] as const),
  )
  const hasReprint = options.draft.previewLabelRecords.some((preview) => existingBySequence.has(preview.sequenceNo))
  const printJobId = buildFeiPrintJobId(options.nowText, options.owner.cutOrderId, hasReprint ? 'reprint' : 'first')
  const printJobNo = buildPrintJobNo(options.existingJobs, options.nowText)
  const printJob: FeiTicketPrintJob = {
    printJobId,
    printJobNo,
    ownerType: 'cut-order',
    cutOrderIds: [options.owner.cutOrderId],
    cutOrderNos: [options.owner.cutOrderNo],
    sourceContextType: options.draft.sourceContextType,
    sourceMarkerPlanId: options.draft.sourceMarkerPlanId,
    sourceMarkerPlanNo: options.draft.sourceMarkerPlanNo,
    totalTicketCount: options.draft.previewLabelRecords.length,
    status: hasReprint ? 'REPRINTED' : 'PRINTED',
    printedBy: options.printedBy,
    printedAt: options.nowText,
    note: options.draft.note,
    printableUnitId: `cut-order:${options.owner.cutOrderId}`,
    printableUnitNo: options.owner.cutOrderNo,
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
          sourceMarkerPlanId: options.draft.sourceMarkerPlanId,
          sourceMarkerPlanNo: options.draft.sourceMarkerPlanNo,
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

    const ticketRecordId = `ticket-${options.owner.cutOrderId}-${String(preview.sequenceNo).padStart(3, '0')}`
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
      left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN') || left.sequenceNo - right.sequenceNo,
    ),
  }
}

export function buildFeiNavigationPayload(
  owner: Pick<CutOrderTicketOwner, 'cutOrderId' | 'cutOrderNo' | 'productionOrderNo'> &
    MarkerPlanSourceRefLike,
  context: FeiTicketsContext | null,
): FeiNavigationPayload {
  const markerPlanNos = getMarkerPlanSourceNos(owner)
  const markerPlanNo = context?.contextType === 'marker-plan' ? context.markerPlanNo || undefined : markerPlanNos[0] || undefined

  return {
    cutOrders: {
      cutOrderId: owner.cutOrderId,
      cutOrderNo: owner.cutOrderNo,
      productionOrderNo: owner.productionOrderNo,
    },
    markerPlanSources: {
      markerPlanNo,
      cutOrderNo: owner.cutOrderNo,
    },
    markerSpreading: {
      markerPlanNo,
      cutOrderNo: owner.cutOrderNo,
      cutOrderId: owner.cutOrderId,
    },
    summary: {
      markerPlanNo,
      cutOrderNo: owner.cutOrderNo,
      productionOrderNo: owner.productionOrderNo,
    },
    transferBags: {
      markerPlanNo,
      cutOrderNo: owner.cutOrderNo,
    },
  }
}

export function buildTicketOwnerGroupsFromContext(
  context: FeiTicketsContext | null,
  owners: CutOrderTicketOwner[],
): CutOrderTicketOwner[] {
  if (!context) return owners
  if (context.contextType === 'marker-plan') {
    const allowedIds = new Set(context.cutOrderIds)
    return owners.filter((owner) => allowedIds.has(owner.cutOrderId))
  }
  return owners.filter((owner) => owner.cutOrderId === context.cutOrderIds[0])
}

export function buildFeiTicketsViewModel(options: {
  cutOrderRows: CutOrderRow[]
  materialPrepRows: MaterialPrepRow[]
  markerPlanSources: MarkerPlanSourceRecord[]
  markerStore: MarkerSpreadingStore
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
  drafts: Record<string, FeiTicketDraft>
  prefilter: FeiTicketsPrefilter | null
}): FeiTicketsViewModel {
  const materialRowsById = Object.fromEntries(options.materialPrepRows.map((row) => [row.cutOrderId, row]))
  const generatedTicketMap = getGeneratedFeiTicketMapByCutOrderId()
  const printableCutOrderIds = new Set(options.cutOrderRows.filter(isPrintableSourceRow).map((row) => row.cutOrderId))

  const owners = options.cutOrderRows.map((row) => {
    const printable = isPrintableSourceRow(row)
    const markerPlanIds = Array.isArray(row.markerPlanIds) ? row.markerPlanIds : []
    const markerPlanNos = Array.isArray(row.markerPlanNos) ? row.markerPlanNos : []
    const materialRow = materialRowsById[row.cutOrderId]
    const generatedTickets = printable ? generatedTicketMap[row.cutOrderId] || [] : []
    const actualOutputTicketCount = generatedTickets.filter((ticket) => ticket.sourceBasisType === FEI_TICKET_SOURCE_BASIS_TYPE).length
    const ticketCountBasis = printable
      ? resolveTicketCountBasis(
          {
            cutOrderId: row.cutOrderId,
            relatedMarkerPlanIds: markerPlanIds,
            relatedMarkerPlanNos: markerPlanNos,
            orderQtyHint: row.orderQty,
          },
          options.markerStore,
          null,
          actualOutputTicketCount,
        )
      : {
          basisType: FEI_TICKET_WAITING_SOURCE_BASIS_TYPE,
          ticketCount: 0,
          basisLabel: '未进入打印环节',
          detailText: '当前仍未形成实际裁剪产出，不能生成菲票。',
        }
    const plannedTicketQty = ticketCountBasis.ticketCount
    const ownerRecords = printable ? options.ticketRecords.filter((record) => record.cutOrderId === row.cutOrderId) : []
    const latestPrintJob = printable
      ? options.printJobs
          .filter((job) => job.cutOrderIds.includes(row.cutOrderId))
          .sort((left, right) => right.printedAt.localeCompare(left.printedAt, 'zh-CN'))[0]
      : undefined
    const printedTicketQty = ownerRecords.length
    const reprintCount = ownerRecords.reduce((sum, record) => sum + record.reprintCount, 0)
    const hasDraft = printable && Boolean(options.drafts[row.cutOrderId])
    const statusMeta = deriveFeiTicketStatus({
      plannedTicketQty,
      printedTicketQty,
      hasDraft,
      reprintCount,
      needsSupplement: printable && !materialRow,
    })

    return {
      ownerType: 'cut-order' as const,
      id: row.id,
      cutOrderId: row.cutOrderId,
      cutOrderNo: row.cutOrderNo,
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
      styleCode: row.styleCode,
      spuCode: row.spuCode,
      styleName: row.styleName,
      color: row.color,
      materialSku: row.materialSku,
      materialAlias: row.materialAlias || '',
      materialImageUrl: row.materialImageUrl || '',
      plannedTicketQty,
      printedTicketQty,
      latestPrintJobNo: latestPrintJob?.printJobNo || '',
      ticketStatus: statusMeta.key,
      sameCodeValue: materialRow?.sameCodeValue || row.cutOrderNo,
      qrBaseValue: materialRow?.qrCodeValue || `QR-${row.cutOrderNo}`,
      relatedMarkerPlanIds: markerPlanIds,
      relatedMarkerPlanNos: markerPlanNos,
      sourceContextLabel: '裁片单上下文',
      ticketCountBasisType: ticketCountBasis.basisType,
      ticketCountBasisLabel: ticketCountBasis.basisLabel,
      ticketCountBasisDetail: ticketCountBasis.detailText,
      currentStageLabel: row.currentStage.label,
      sourceStageLabel: row.currentStage.label,
      riskLabels: row.riskTags.map((tag) => tag.label),
      latestActionText: row.latestActionText,
      qrReservedPayload: {
        qrBaseValue: materialRow?.qrCodeValue || `QR-${row.cutOrderNo}`,
        reservedProcessFields: {},
        reservedVersion: 'v-next',
      },
      navigationPayload: buildFeiNavigationPayload(row, null),
      keywordIndex: buildKeywordIndex([
        row.cutOrderNo,
        row.productionOrderNo,
        row.styleCode,
        row.spuCode,
        row.styleName,
        row.materialSku,
        materialRow?.sameCodeValue,
        latestPrintJob?.printJobNo,
        ...row.markerPlanNos,
      ]),
    }
  })

  const context = buildContext(owners, options.markerPlanSources, options.prefilter)
  const contextualOwners = buildTicketOwnerGroupsFromContext(context, owners).map((owner) => ({
    ...owner,
    sourceContextLabel: context?.contextType === 'marker-plan' ? `来源唛架方案 ${context.markerPlanNo || '待补唛架方案号'}` : '裁片单上下文',
    navigationPayload: buildFeiNavigationPayload(owner, context),
  }))

  const contextualIds = new Set(contextualOwners.map((owner) => owner.cutOrderId))
  const ticketRecords = options.ticketRecords
    .filter((record) => printableCutOrderIds.has(record.cutOrderId))
    .filter((record) => (contextualIds.size ? contextualIds.has(record.cutOrderId) : true))
    .sort(
      (left, right) =>
        right.printedAt.localeCompare(left.printedAt, 'zh-CN') ||
        left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN') ||
        left.sequenceNo - right.sequenceNo,
    )
  const printJobs = options.printJobs
    .filter((job) => job.cutOrderIds.some((id) => printableCutOrderIds.has(id)))
    .filter((job) => (contextualIds.size ? job.cutOrderIds.some((id) => contextualIds.has(id)) : true))
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
  owners: CutOrderTicketOwner[],
  filters: FeiTicketOwnerFilters,
  prefilter: FeiTicketsPrefilter | null,
): CutOrderTicketOwner[] {
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
      job.cutOrderNos.join(' / '),
      job.printedBy,
      job.note,
      job.sourceMarkerPlanNo,
    ]
      .filter(Boolean)
      .map((value) => value.toLowerCase())
    return keywordValues.some((value) => value.includes(keyword))
  })
}

export function buildFeiTicketStats(
  owners: CutOrderTicketOwner[],
  ticketRecords: FeiTicketLabelRecord[],
  printJobs: FeiTicketPrintJob[],
  drafts: Record<string, FeiTicketDraft>,
): FeiTicketsStats {
  const contextualIds = new Set(owners.map((owner) => owner.cutOrderId))
  const contextualDraftCount = Object.values(drafts).filter((draft) => contextualIds.has(draft.cutOrderId)).length

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
  return JSON['stringify'](drafts)
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
  return JSON['stringify'](records)
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
  return JSON['stringify'](printJobs)
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
  cutOrderRows: CutOrderRow[]
  materialPrepRows: MaterialPrepRow[]
  markerPlanSources: MarkerPlanSourceRecord[]
  markerStore: MarkerSpreadingStore
}): FeiTicketSeedLedger {
  void options.markerStore
  void options.markerPlanSources
  const materialRowsById = Object.fromEntries(options.materialPrepRows.map((row) => [row.cutOrderId, row]))
  const generatedTicketMap = getGeneratedFeiTicketMapByCutOrderId()
  const owners = options.cutOrderRows
    .filter(isPrintableSourceRow)
    .map((row) => {
      const generated = generatedTicketMap[row.cutOrderId] || []
      if (!generated.length) return null
      return createSeedOwnerFromRow({
        row,
        materialRow: materialRowsById[row.cutOrderId],
        plannedTicketQty: generated.length,
      })
    })
    .filter((owner): owner is CutOrderTicketOwner => Boolean(owner))
    .sort((left, right) => left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN'))

  const ticketRecords: FeiTicketLabelRecord[] = []
  const printJobs: FeiTicketPrintJob[] = []

  const resolveScope = (owner: CutOrderTicketOwner) => {
    const markerPlanId = owner.relatedMarkerPlanIds[0] || ''
    const markerPlanNo = owner.relatedMarkerPlanNos[0] || ''
    const sourceContextType: FeiTicketsContextType = markerPlanId || markerPlanNo ? 'marker-plan' : 'cut-order'
    return {
      sourceContextType,
      sourceMarkerPlanId: sourceContextType === 'marker-plan' ? markerPlanId : '',
      sourceMarkerPlanNo: sourceContextType === 'marker-plan' ? markerPlanNo : '',
      printableUnitId: sourceContextType === 'marker-plan' ? `marker-plan:${markerPlanId}` : `cut-order:${owner.cutOrderId}`,
      printableUnitNo: sourceContextType === 'marker-plan' ? markerPlanNo : owner.cutOrderNo,
      printableUnitType: sourceContextType === 'marker-plan' ? 'MARKER_PLAN' as const : 'CUT_ORDER' as const,
    }
  }

  const firstOwner = owners[0]
  const secondOwner = owners[1]
  const thirdOwner = owners[2]
  const fourthOwner = owners[3]

  if (firstOwner) {
    const scope = resolveScope(firstOwner)
    const printedAt = '2026-03-23 10:15'
    const ticketSeeds = getGeneratedFeiRecordsByCutOrderId(firstOwner.cutOrderId).slice(0, 2)
    const printJob = createSeedPrintJob({
      printJobId: buildFeiPrintJobId(printedAt, firstOwner.cutOrderId, 'first'),
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
    const seed = getGeneratedFeiRecordBySequence(secondOwner.cutOrderId, 1)
    if (seed) {
      const printJob = createSeedPrintJob({
      printJobId: buildFeiPrintJobId(printedAt, secondOwner.cutOrderId, 'reprint-gap'),
        printJobNo: 'FEI-PJ-DEMO-B-001',
        owner: secondOwner,
        ...scope,
        operationType: 'FIRST_PRINT',
        status: 'PRINTED',
        printedBy: '打票员-周莉',
        printedAt,
        ticketRecordIds: [seed.feiTicketId],
        note: '正式菲票主源补打缺口演示。',
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
    const seedRecords = getGeneratedFeiRecordsByCutOrderId(thirdOwner.cutOrderId).slice(0, 2)
    if (seedRecords.length) {
      const printJob = createSeedPrintJob({
        printJobId: buildFeiPrintJobId(printedAt, thirdOwner.cutOrderId, 'printed-base'),
        printJobNo: 'FEI-PJ-DEMO-C-001',
        owner: thirdOwner,
        ...scope,
        operationType: 'FIRST_PRINT',
        status: 'PRINTED',
        printedBy: '打票员-赵宁',
        printedAt,
        ticketRecordIds: seedRecords.map((item) => item.feiTicketId),
        note: '正式菲票首次打印演示。',
      })
      ticketRecords.push(
        ...seedRecords.map((seed, index) =>
          createSeedTicketRecord({
            owner: thirdOwner,
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
        ),
      )
      printJobs.push(printJob)
    }
  }

  if (fourthOwner) {
    const scope = resolveScope(fourthOwner)
    const firstPrintedAt = '2026-03-24 09:10'
    const replacementAt = '2026-03-24 09:25'
    const seedRecords = getGeneratedFeiRecordsByCutOrderId(fourthOwner.cutOrderId).slice(0, 2)
    if (seedRecords.length) {
      const firstPrintJob = createSeedPrintJob({
        printJobId: buildFeiPrintJobId(firstPrintedAt, fourthOwner.cutOrderId, 'replace-base'),
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
        printJobId: buildFeiPrintJobId(replacementAt, fourthOwner.cutOrderId, 'replace'),
        ...scope,
        quantity: seedRecords[0].qty,
        partName: seedRecords[0].partName,
        size: seedRecords[0].skuSize,
        processTags: unique([...seedRecords[0].secondaryCrafts, '替代票']),
      })
      ticketRecords.push(
        originalRecord,
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
          printJobId: buildFeiPrintJobId(replacementAt, fourthOwner.cutOrderId, 'replace-reprint'),
          printJobNo: 'FEI-PJ-DEMO-D-002',
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

export type PrintableUnitType = 'MARKER_PLAN' | 'CUT_ORDER'
export type PrintableUnitStatus = 'WAITING_PRINT' | 'PRINTED' | 'NEED_REPRINT'

export interface PrintableUnitNavigationPayload {
  printableUnitId: string
  printableUnitNo: string
  printableUnitType: PrintableUnitType
  spreadingSessionId?: string
  spreadingSessionNo?: string
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
  materialAlias: string
  materialImageUrl: string
  sourceProductionOrderIds: string[]
  sourceProductionOrderNos: string[]
  sourceCutOrderIds: string[]
  sourceCutOrderNos: string[]
  sourceSpreadingSessionIds: string[]
  sourceSpreadingSessionNos: string[]
  sourceMarkerIds: string[]
  sourceMarkerNos: string[]
  sourceProductionOrderCount: number
  sourceCutOrderCount: number
  requiredTicketCount: number
  garmentQtyTotal: number
  ticketCountBasisType: FeiTicketSourceBasisType | WaitingFeiTicketSourceBasisType
  ticketCountBasisLabel: string
  ticketCountBasisDetail: string
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
  sourceOutputLineId: string
  printableUnitId: string
  sourceSpreadingSessionId: string
  sourceSpreadingSessionNo: string
  sourceCutOrderId: string
  sourceCutOrderNo: string
  sourceProductionOrderId: string
  sourceProductionOrderNo: string
  batchNo: string
  styleCode: string
  fabricRollNo: string
  fabricColor: string
  color: string
  size: string
  partCode: string
  partName: string
  partInstanceNo: string
  bundleNo: string
  pieceSetNoStart: number
  pieceSetNoEnd: number
  pieceSetNoRange: string
  bundleTicketType: string
  quantity: number
  actualCutPieceQty: number
  garmentQty: number
  requiredTicketCount: number
  validPrintedTicketCount: number
  gapCount: number
  sequenceNo: number
  hasSpecialCraft: boolean
  specialCrafts: FeiTicketSpecialCraft[]
  specialCraftDisplayLabel: string
  pieceSequenceRange: PieceSequenceRange | null
  pieceSequenceLabel: string
  pieceSequenceCannotGenerateReason: string
}

export interface TicketCard {
  ticketId: string
  ticketNo: string
  sourceOutputLineId: string
  printableUnitId: string
  printableUnitNo: string
  printableUnitType: PrintableUnitType
  batchNo: string
  sourceCutOrderId: string
  sourceCutOrderNo: string
  sourceProductionOrderId: string
  sourceProductionOrderNo: string
  styleCode: string
  fabricRollNo: string
  fabricColor: string
  color: string
  size: string
  partCode: string
  partName: string
  partInstanceNo: string
  bundleNo: string
  pieceSetNoStart: number
  pieceSetNoEnd: number
  pieceSetNoRange: string
  bundleTicketType: string
  quantity: number
  actualCutPieceQty: number
  printStatus: 'WAIT_PRINT' | 'PRINTED' | 'REPRINTED' | 'VOIDED'
  garmentQty: number
  processTags: string[]
  hasSpecialCraft: boolean
  specialCrafts: FeiTicketSpecialCraft[]
  specialCraftDisplayLabel: string
  pieceSequenceRange: PieceSequenceRange | null
  pieceSequenceLabel: string
  pieceSequenceCannotGenerateReason: string
  qrContentText: string
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

interface PrintableUnitSourceOwner {
  owner: CutOrderTicketOwner
  row: CutOrderRow
}

const printableUnitStatusMetaMap: Record<PrintableUnitStatus, PrintableUnitStatusMeta> = {
  WAITING_PRINT: {
    label: '待打印',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    detailText: '铺布裁剪已完成，但当前还没有有效菲票。',
  },
  PRINTED: {
    label: '已打印',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '有效菲票数已达到应打数量，当前没有补打缺口。',
  },
  NEED_REPRINT: {
    label: '需补打',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
    detailText: '当前有效菲票数不足，需要补打。',
  },
}

function isFeiTicketRecordVoided(record: FeiTicketLabelRecord): boolean {
  return record.status === 'VOIDED'
}

export function isPrintableSourceRow(row: CutOrderRow): boolean {
  return getGeneratedFeiRecordsByCutOrderId(row.cutOrderId).some((record) => record.sourceBasisType === FEI_TICKET_SOURCE_BASIS_TYPE)
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
    case 'PRINTED':
    default:
      return 2
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

  if (options.hasPrintedHistory && options.validPrintedTicketCount < options.requiredTicketCount) {
    return 'NEED_REPRINT'
  }

  return 'NEED_REPRINT'
}

export function getPrintableUnitStatusMeta(status: PrintableUnitStatus): PrintableUnitStatusMeta {
  return printableUnitStatusMetaMap[status]
}

export function buildPrintableUnitNavigationPayload(unit: PrintableUnit): PrintableUnitNavigationPayload {
  return {
    printableUnitId: unit.printableUnitId,
    printableUnitNo: unit.printableUnitNo,
    printableUnitType: unit.printableUnitType,
    spreadingSessionId: unit.sourceSpreadingSessionIds[0] || undefined,
    spreadingSessionNo: unit.sourceSpreadingSessionNos[0] || undefined,
    batchId: unit.batchId || undefined,
    batchNo: unit.batchNo || undefined,
    cutOrderId: unit.cutOrderId || undefined,
    cutOrderNo: unit.cutOrderNo || undefined,
    sourceProductionOrderNo: unit.sourceProductionOrderNos[0] || undefined,
  }
}

function collectGeneratedRecordTrace(records: GeneratedFeiTicketSourceRecord[]): {
  sourceSpreadingSessionIds: string[]
  sourceSpreadingSessionNos: string[]
  sourceMarkerIds: string[]
  sourceMarkerNos: string[]
} {
  return {
    sourceSpreadingSessionIds: uniqueStrings(records.map((record) => record.sourceSpreadingSessionId)),
    sourceSpreadingSessionNos: uniqueStrings(records.map((record) => record.sourceSpreadingSessionNo)),
    sourceMarkerIds: uniqueStrings(records.map((record) => record.sourceMarkerId)),
    sourceMarkerNos: uniqueStrings(records.map((record) => record.sourceMarkerNo)),
  }
}

function buildPrintableUnitFromCutOrder(options: {
  owner: CutOrderTicketOwner
  row: CutOrderRow
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
}): PrintableUnit {
  const generatedRecords = getGeneratedFeiRecordsByCutOrderId(options.owner.cutOrderId)
  const traceMeta = collectGeneratedRecordTrace(generatedRecords)
  const scope: PrintableUnitScope = {
    printableUnitId: `cut-order:${options.owner.cutOrderId}`,
    printableUnitNo: options.owner.cutOrderNo,
    printableUnitType: 'CUT_ORDER',
    batchId: '',
    batchNo: '',
    cutOrderId: options.owner.cutOrderId,
    sourceCutOrderIds: [options.owner.cutOrderId],
  }
  const stats = collectTicketStats(scope, options.ticketRecords, options.printJobs)
  const requiredTicketCount = Math.max(options.owner.plannedTicketQty, generatedRecords.length, 0)
  const missingTicketCount = Math.max(requiredTicketCount - stats.validPrintedTicketCount, 0)
  const printableUnitStatus = derivePrintableUnitStatus({
    requiredTicketCount,
    validPrintedTicketCount: stats.validPrintedTicketCount,
    voidedTicketCount: stats.voidedTicketCount,
    hasPrintedHistory: stats.validPrintedTicketCount + stats.voidedTicketCount > 0,
  })

  const unit: PrintableUnit = {
    printableUnitId: `cut-order:${options.owner.cutOrderId}`,
    printableUnitNo: options.owner.cutOrderNo,
    printableUnitType: 'CUT_ORDER',
    batchId: '',
    batchNo: '',
    cutOrderId: options.owner.cutOrderId,
    cutOrderNo: options.owner.cutOrderNo,
    styleCode: options.owner.styleCode || options.owner.spuCode || '',
    fabricSku: options.owner.materialSku,
    materialAlias: options.owner.materialAlias || '',
    materialImageUrl: options.owner.materialImageUrl || '',
    sourceProductionOrderIds: [options.owner.productionOrderId],
    sourceProductionOrderNos: [options.owner.productionOrderNo],
    sourceCutOrderIds: [options.owner.cutOrderId],
    sourceCutOrderNos: [options.owner.cutOrderNo],
    sourceSpreadingSessionIds: traceMeta.sourceSpreadingSessionIds,
    sourceSpreadingSessionNos: traceMeta.sourceSpreadingSessionNos,
    sourceMarkerIds: traceMeta.sourceMarkerIds,
    sourceMarkerNos: traceMeta.sourceMarkerNos,
    sourceProductionOrderCount: 1,
    sourceCutOrderCount: 1,
    requiredTicketCount,
    garmentQtyTotal: Math.max(generatedRecords.reduce((sum, record) => sum + Math.max(record.qty || 0, 0), 0), requiredTicketCount),
    ticketCountBasisType: options.owner.ticketCountBasisType,
    ticketCountBasisLabel: options.owner.ticketCountBasisLabel,
    ticketCountBasisDetail: options.owner.ticketCountBasisDetail,
    validPrintedTicketCount: stats.validPrintedTicketCount,
    voidedTicketCount: stats.voidedTicketCount,
    missingTicketCount,
    printableUnitStatus,
    lastPrintedAt: stats.lastPrintedAt,
    lastPrintedBy: stats.lastPrintedBy,
    keywordIndex: buildKeywordIndex([
      options.owner.cutOrderNo,
      options.owner.productionOrderNo,
      options.owner.styleCode,
      options.owner.spuCode,
      options.owner.materialSku,
      options.row.latestMarkerPlanNo,
      ...traceMeta.sourceSpreadingSessionNos,
      ...traceMeta.sourceMarkerNos,
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

function buildPrintableUnitFromMarkerPlanSource(options: {
  markerPlanSource: MarkerPlanSourceRecord
  owners: CutOrderTicketOwner[]
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
}): PrintableUnit {
  const generatedRecords = options.owners.flatMap((owner) => getGeneratedFeiRecordsByCutOrderId(owner.cutOrderId))
  const traceMeta = collectGeneratedRecordTrace(generatedRecords)
  const sourceProductionOrderIds = uniqueStrings(options.markerPlanSource.items.map((item) => item.productionOrderId))
  const sourceProductionOrderNos = uniqueStrings(options.markerPlanSource.items.map((item) => item.productionOrderNo))
  const sourceCutOrderIds = uniqueStrings(options.owners.map((owner) => owner.cutOrderId))
  const sourceCutOrderNos = uniqueStrings(options.owners.map((owner) => owner.cutOrderNo))
  const scope: PrintableUnitScope = {
    printableUnitId: `marker-plan:${options.markerPlanSource.markerPlanId}`,
    printableUnitNo: options.markerPlanSource.markerPlanNo,
    printableUnitType: 'MARKER_PLAN',
    batchId: options.markerPlanSource.markerPlanId,
    batchNo: options.markerPlanSource.markerPlanNo,
    cutOrderId: '',
    sourceCutOrderIds,
  }
  const stats = collectTicketStats(scope, options.ticketRecords, options.printJobs)
  const requiredTicketCount = Math.max(
    options.owners.reduce((sum, owner) => sum + Math.max(owner.plannedTicketQty, 0), 0),
    generatedRecords.length,
  )
  const ownerBasisTypes = unique(options.owners.map((owner) => owner.ticketCountBasisType))
  const ticketCountBasisType =
    ownerBasisTypes.length === 1 && ownerBasisTypes[0] === FEI_TICKET_SOURCE_BASIS_TYPE
      ? FEI_TICKET_SOURCE_BASIS_TYPE
      : FEI_TICKET_WAITING_SOURCE_BASIS_TYPE
  const ticketCountBasisLabel = ticketCountBasisType === FEI_TICKET_SOURCE_BASIS_TYPE ? FEI_TICKET_SOURCE_BASIS : '待实际裁剪产出'
  const ticketCountBasisDetail =
    ticketCountBasisType === FEI_TICKET_SOURCE_BASIS_TYPE
      ? `当前按实际裁剪产出汇总，按实际裁片数量拆分 ${formatQty(generatedRecords.length)} 张。`
      : '当前尚未形成实际裁剪产出，不能生成菲票。'
  const missingTicketCount = Math.max(requiredTicketCount - stats.validPrintedTicketCount, 0)
  const printableUnitStatus = derivePrintableUnitStatus({
    requiredTicketCount,
    validPrintedTicketCount: stats.validPrintedTicketCount,
    voidedTicketCount: stats.voidedTicketCount,
    hasPrintedHistory: stats.validPrintedTicketCount + stats.voidedTicketCount > 0,
  })

  const unit: PrintableUnit = {
    printableUnitId: `marker-plan:${options.markerPlanSource.markerPlanId}`,
    printableUnitNo: options.markerPlanSource.markerPlanNo,
    printableUnitType: 'MARKER_PLAN',
    batchId: options.markerPlanSource.markerPlanId,
    batchNo: options.markerPlanSource.markerPlanNo,
    cutOrderId: '',
    cutOrderNo: '',
    styleCode: options.markerPlanSource.styleCode || options.owners[0]?.styleCode || options.markerPlanSource.spuCode || '',
    fabricSku: options.markerPlanSource.materialSkuSummary || uniqueStrings(options.owners.map((owner) => owner.materialSku)).join(' / '),
    materialAlias: uniqueStrings(options.owners.map((owner) => owner.materialAlias)).join(' / '),
    materialImageUrl: options.owners.find((owner) => owner.materialImageUrl)?.materialImageUrl || '',
    sourceProductionOrderIds,
    sourceProductionOrderNos,
    sourceCutOrderIds,
    sourceCutOrderNos,
    sourceSpreadingSessionIds: traceMeta.sourceSpreadingSessionIds,
    sourceSpreadingSessionNos: traceMeta.sourceSpreadingSessionNos,
    sourceMarkerIds: traceMeta.sourceMarkerIds,
    sourceMarkerNos: traceMeta.sourceMarkerNos,
    sourceProductionOrderCount: sourceProductionOrderNos.length,
    sourceCutOrderCount: sourceCutOrderNos.length,
    requiredTicketCount,
    garmentQtyTotal: Math.max(generatedRecords.reduce((sum, record) => sum + Math.max(record.qty || 0, 0), 0), requiredTicketCount),
    ticketCountBasisType,
    ticketCountBasisLabel,
    ticketCountBasisDetail,
    validPrintedTicketCount: stats.validPrintedTicketCount,
    voidedTicketCount: stats.voidedTicketCount,
    missingTicketCount,
    printableUnitStatus,
    lastPrintedAt: stats.lastPrintedAt,
    lastPrintedBy: stats.lastPrintedBy,
    keywordIndex: buildKeywordIndex([
      options.markerPlanSource.markerPlanNo,
      options.markerPlanSource.styleCode,
      options.markerPlanSource.spuCode,
      options.markerPlanSource.materialSkuSummary,
      ...sourceProductionOrderNos,
      ...sourceCutOrderNos,
      ...traceMeta.sourceSpreadingSessionNos,
      ...traceMeta.sourceMarkerNos,
    ]),
    navigationPayload: {
      printableUnitId: '',
      printableUnitNo: '',
      printableUnitType: 'MARKER_PLAN',
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
  const hasSpreadingSessionAnchor = Boolean(prefilter.spreadingSessionId || prefilter.spreadingSessionNo)
  return units.filter((unit) => {
    if (prefilter.spreadingSessionId && !unit.sourceSpreadingSessionIds.includes(prefilter.spreadingSessionId)) return false
    if (prefilter.spreadingSessionNo && !unit.sourceSpreadingSessionNos.includes(prefilter.spreadingSessionNo)) return false
    if (hasSpreadingSessionAnchor) return true
    if (prefilter.markerPlanId && unit.batchId !== prefilter.markerPlanId) return false
    if (prefilter.markerPlanNo && unit.batchNo !== prefilter.markerPlanNo) return false
    if (prefilter.cutOrderId && !unit.sourceCutOrderIds.includes(prefilter.cutOrderId)) return false
    if (prefilter.cutOrderNo && !unit.sourceCutOrderNos.includes(prefilter.cutOrderNo)) return false
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
    if (
      fabricSku &&
      ![unit.fabricSku, unit.materialAlias].some((value) => value.toLowerCase().includes(fabricSku))
    ) return false
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
  cutOrderRows: CutOrderRow[]
  materialPrepRows: MaterialPrepRow[]
  markerPlanSources: MarkerPlanSourceRecord[]
  markerStore: MarkerSpreadingStore
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
  prefilter: FeiTicketsPrefilter | null
}): PrintableUnitViewModel {
  const ownerView = buildFeiTicketsViewModel({
    cutOrderRows: options.cutOrderRows,
    materialPrepRows: options.materialPrepRows,
    markerPlanSources: options.markerPlanSources,
    markerStore: options.markerStore,
    ticketRecords: options.ticketRecords,
    printJobs: options.printJobs,
    drafts: {},
    prefilter: null,
  })

  const ownersByCutOrderId = Object.fromEntries(ownerView.owners.map((owner) => [owner.cutOrderId, owner]))
  const rowsByCutOrderId = Object.fromEntries(options.cutOrderRows.map((row) => [row.cutOrderId, row]))
  const units: PrintableUnit[] = []
  const coveredCutOrderIds = new Set<string>()

  options.markerPlanSources.forEach((batch) => {
    const memberOwners = batch.items
      .map((item) => ownersByCutOrderId[item.cutOrderId])
      .filter((owner): owner is CutOrderTicketOwner => Boolean(owner))
    if (!memberOwners.length) return

    const memberRows = memberOwners
      .map((owner) => rowsByCutOrderId[owner.cutOrderId])
      .filter((row): row is CutOrderRow => Boolean(row))
    if (!memberRows.length || !memberRows.every(isPrintableSourceRow)) return

    memberRows.forEach((row) => coveredCutOrderIds.add(row.cutOrderId))
    units.push(
      buildPrintableUnitFromMarkerPlanSource({
        markerPlanSource: batch,
        owners: memberOwners,
        ticketRecords: options.ticketRecords,
        printJobs: options.printJobs,
      }),
    )
  })

  ownerView.owners.forEach((owner) => {
    const row = rowsByCutOrderId[owner.cutOrderId]
    if (!row || !isPrintableSourceRow(row)) return
    if (coveredCutOrderIds.has(owner.cutOrderId)) return
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
    .filter((unit) => unit.requiredTicketCount > 0 && unit.ticketCountBasisType === FEI_TICKET_SOURCE_BASIS_TYPE)
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
      PRINTED: contextualUnits.filter((unit) => unit.printableUnitStatus === 'PRINTED').length,
      NEED_REPRINT: contextualUnits.filter((unit) => unit.printableUnitStatus === 'NEED_REPRINT').length,
    },
  }
}

const printablePartCycle = ['左前片', '右前片', '左袖', '右袖', '后片', '领口']
const printableSizeCycle = ['M', 'L', 'XL', 'S', '2XL', '均码']

function buildOwnerMaps(options: {
  cutOrderRows: CutOrderRow[]
  materialPrepRows: MaterialPrepRow[]
  markerPlanSources: MarkerPlanSourceRecord[]
  markerStore: MarkerSpreadingStore
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
}): {
  ownersByCutOrderId: Record<string, CutOrderTicketOwner>
  rowsByCutOrderId: Record<string, CutOrderRow>
} {
  const ownerView = buildFeiTicketsViewModel({
    cutOrderRows: options.cutOrderRows,
    materialPrepRows: options.materialPrepRows,
    markerPlanSources: options.markerPlanSources,
    markerStore: options.markerStore,
    ticketRecords: options.ticketRecords,
    printJobs: options.printJobs,
    drafts: {},
    prefilter: null,
  })

  return {
    ownersByCutOrderId: Object.fromEntries(ownerView.owners.map((owner) => [owner.cutOrderId, owner])),
    rowsByCutOrderId: Object.fromEntries(options.cutOrderRows.map((row) => [row.cutOrderId, row])),
  }
}

function collectPrintableUnitOwners(
  unit: PrintableUnit,
  ownersByCutOrderId: Record<string, CutOrderTicketOwner>,
  rowsByCutOrderId: Record<string, CutOrderRow>,
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
        record.cutOrderId === detail.sourceCutOrderId &&
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
  const generatedFeiRecords = getGeneratedFeiRecordsByCutOrderId(source.owner.cutOrderId)
  const detailSeeds = generatedFeiRecords.length
    ? generatedFeiRecords.map((record, index) => ({
        sequenceNo: index + 1,
        detailId: record.sourceOutputLineId || `${source.owner.cutOrderId}-${index + 1}`,
        sourceOutputLineId: record.sourceOutputLineId || '',
        fabricRollNo: record.fabricRollNo || '',
        fabricColor: record.fabricColor || record.skuColor || source.owner.color,
        color: record.fabricColor || record.skuColor || source.owner.color,
        size: record.skuSize || printableSizeCycle[index % printableSizeCycle.length],
        partCode: record.partCode || '',
        partName: record.partName || printablePartCycle[index % printablePartCycle.length],
        partInstanceNo: record.partInstanceNo || '',
        bundleNo: record.bundleNo || `BUNDLE-${String(index + 1).padStart(3, '0')}`,
        pieceSetNoStart: record.pieceSetNoStart || 1,
        pieceSetNoEnd: record.pieceSetNoEnd || record.bundleQty || record.qty || 1,
        pieceSetNoRange: record.pieceSetNoRange || `1-${Math.max(record.bundleQty || record.qty || 1, 1)}`,
        bundleTicketType: record.bundleTicketType || '扎束菲票',
        quantity: Math.max(record.bundleQty || record.qty, 1),
        actualCutPieceQty: Math.max(record.actualCutPieceQty || record.qty, 1),
        garmentQty: Math.max(record.garmentQty || record.bundleQty || record.qty, 1),
        hasSpecialCraft: record.hasSpecialCraft,
        specialCrafts: record.specialCrafts.map((craft) => ({ ...craft })),
        specialCraftDisplayLabel: record.specialCraftDisplayLabel,
        pieceSequenceRange: record.pieceSequenceRange ? { ...record.pieceSequenceRange } : null,
        pieceSequenceLabel: record.pieceSequenceLabel,
        pieceSequenceCannotGenerateReason: record.pieceSequenceCannotGenerateReason,
      }))
    : Array.from({ length: Math.max(source.owner.plannedTicketQty, 0) }, (_, index) => ({
        sequenceNo: index + 1,
        detailId: `${source.owner.cutOrderId}-${index + 1}`,
        sourceOutputLineId: '',
        fabricRollNo: '',
        fabricColor: source.owner.color,
        color: source.owner.color,
        size: printableSizeCycle[index % printableSizeCycle.length],
        partCode: '',
        partName: printablePartCycle[index % printablePartCycle.length],
        partInstanceNo: '',
        bundleNo: `BUNDLE-${String(index + 1).padStart(3, '0')}`,
        pieceSetNoStart: 1,
        pieceSetNoEnd: 1,
        pieceSetNoRange: '1',
        bundleTicketType: '扎束菲票',
        quantity: 1,
        actualCutPieceQty: 1,
        garmentQty: 1,
        hasSpecialCraft: false,
        specialCrafts: [],
        specialCraftDisplayLabel: '无',
        pieceSequenceRange: null,
        pieceSequenceLabel: '不可生成',
        pieceSequenceCannotGenerateReason: '缺少实际裁剪产出',
      }))

  return detailSeeds.map((seed) => {
    const relatedRecords = findDetailSourceRecord(
      {
        detailId: seed.detailId,
        sourceOutputLineId: seed.sourceOutputLineId,
        printableUnitId: unit.printableUnitId,
        sourceCutOrderId: source.owner.cutOrderId,
        sourceCutOrderNo: source.owner.cutOrderNo,
        sourceProductionOrderId: source.owner.productionOrderId,
        sourceProductionOrderNo: source.owner.productionOrderNo,
        batchNo: unit.batchNo || source.owner.relatedMarkerPlanNos[0] || '',
        styleCode: source.owner.styleCode,
        fabricRollNo: seed.fabricRollNo,
        fabricColor: seed.fabricColor,
        color: seed.color,
        size: seed.size,
        partCode: seed.partCode,
        partName: seed.partName,
        partInstanceNo: seed.partInstanceNo,
        bundleNo: seed.bundleNo,
        pieceSetNoStart: seed.pieceSetNoStart,
        pieceSetNoEnd: seed.pieceSetNoEnd,
        pieceSetNoRange: seed.pieceSetNoRange,
        bundleTicketType: seed.bundleTicketType,
        quantity: seed.quantity,
        actualCutPieceQty: seed.actualCutPieceQty,
        requiredTicketCount: 1,
        validPrintedTicketCount: 0,
        gapCount: 0,
        sequenceNo: seed.sequenceNo,
        hasSpecialCraft: seed.hasSpecialCraft,
        specialCrafts: seed.specialCrafts,
        specialCraftDisplayLabel: seed.specialCraftDisplayLabel,
        pieceSequenceRange: seed.pieceSequenceRange,
        pieceSequenceLabel: seed.pieceSequenceLabel,
        pieceSequenceCannotGenerateReason: seed.pieceSequenceCannotGenerateReason,
      },
      ticketRecords,
    ).filter((record) => !isFeiTicketRecordVoided(record))
    const validPrintedTicketCount = relatedRecords.length
    return {
      detailId: seed.detailId,
      printableUnitId: unit.printableUnitId,
      sourceSpreadingSessionId:
        relatedRecords[0]?.sourceSpreadingSessionId || generatedFeiRecords[seed.sequenceNo - 1]?.sourceSpreadingSessionId || '',
      sourceSpreadingSessionNo:
        relatedRecords[0]?.sourceSpreadingSessionNo || generatedFeiRecords[seed.sequenceNo - 1]?.sourceSpreadingSessionNo || '',
      sourceCutOrderId: source.owner.cutOrderId,
      sourceCutOrderNo: source.owner.cutOrderNo,
      sourceProductionOrderId: source.owner.productionOrderId,
      sourceProductionOrderNo: source.owner.productionOrderNo,
      batchNo: unit.batchNo || source.owner.relatedMarkerPlanNos[0] || '',
      styleCode: source.owner.styleCode,
      sourceOutputLineId: seed.sourceOutputLineId,
      fabricRollNo: seed.fabricRollNo,
      fabricColor: seed.fabricColor,
      color: seed.color,
      size: seed.size,
      partCode: seed.partCode,
      partName: seed.partName,
      partInstanceNo: seed.partInstanceNo,
      bundleNo: seed.bundleNo,
      pieceSetNoStart: seed.pieceSetNoStart,
      pieceSetNoEnd: seed.pieceSetNoEnd,
      pieceSetNoRange: seed.pieceSetNoRange,
      bundleTicketType: seed.bundleTicketType,
      quantity: seed.quantity,
      actualCutPieceQty: seed.actualCutPieceQty,
      garmentQty: seed.garmentQty,
      requiredTicketCount: 1,
      validPrintedTicketCount,
      gapCount: Math.max(1 - validPrintedTicketCount, 0),
      sequenceNo: seed.sequenceNo,
      hasSpecialCraft: relatedRecords[0]?.hasSpecialCraft ?? seed.hasSpecialCraft,
      specialCrafts: relatedRecords[0]?.specialCrafts
        ? relatedRecords[0].specialCrafts.map((craft) => ({ ...craft }))
        : seed.specialCrafts.map((craft) => ({ ...craft })),
      specialCraftDisplayLabel: relatedRecords[0]?.specialCraftDisplayLabel || seed.specialCraftDisplayLabel || '无',
      pieceSequenceRange: relatedRecords[0]?.pieceSequenceRange
        ? { ...relatedRecords[0].pieceSequenceRange }
        : seed.pieceSequenceRange ? { ...seed.pieceSequenceRange } : null,
      pieceSequenceLabel: relatedRecords[0]?.pieceSequenceLabel || seed.pieceSequenceLabel || '不可生成',
      pieceSequenceCannotGenerateReason: relatedRecords[0]?.pieceSequenceCannotGenerateReason || seed.pieceSequenceCannotGenerateReason || '',
    }
  })
}

export function buildTicketSplitDetails(options: {
  unit: PrintableUnit
  cutOrderRows: CutOrderRow[]
  materialPrepRows: MaterialPrepRow[]
  markerPlanSources: MarkerPlanSourceRecord[]
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
        detailMap.get(`${record.cutOrderId}:${record.sequenceNo}`) ||
        options.splitDetails.find((item) => item.detailId === record.splitDetailId) ||
        null
      return {
        ticketId: record.ticketRecordId,
        ticketNo: record.ticketNo,
        sourceOutputLineId: record.sourceOutputLineId || detail?.sourceOutputLineId || '',
        printableUnitId: options.unit.printableUnitId,
        printableUnitNo: options.unit.printableUnitNo,
        printableUnitType: options.unit.printableUnitType,
        batchNo: record.sourceMarkerPlanNo || options.unit.batchNo,
        sourceCutOrderId: record.cutOrderId,
        sourceCutOrderNo: record.cutOrderNo,
        sourceProductionOrderId: record.sourceProductionOrderId || '',
        sourceProductionOrderNo: record.productionOrderNo,
        styleCode: record.styleCode,
        fabricRollNo: record.fabricRollNo || detail?.fabricRollNo || '',
        fabricColor: record.fabricColor || detail?.fabricColor || record.color || detail?.color || '',
        color: record.fabricColor || detail?.fabricColor || record.color || detail?.color || '',
        size: record.size || detail?.size || '待补尺码',
        partCode: record.partCode || detail?.partCode || '',
        partName: record.partName || detail?.partName || '待补部位',
        partInstanceNo: record.partInstanceNo || detail?.partInstanceNo || '',
        bundleNo: record.bundleNo || detail?.bundleNo || '',
        pieceSetNoStart: record.pieceSetNoStart || detail?.pieceSetNoStart || 1,
        pieceSetNoEnd: record.pieceSetNoEnd || detail?.pieceSetNoEnd || record.quantity || detail?.quantity || 1,
        pieceSetNoRange: record.pieceSetNoRange || detail?.pieceSetNoRange || `1-${Math.max(record.quantity || detail?.quantity || 1, 1)}`,
        bundleTicketType: record.bundleTicketType || detail?.bundleTicketType || '扎束菲票',
        quantity: record.quantity ?? detail?.quantity ?? 1,
        actualCutPieceQty: record.actualCutPieceQty ?? detail?.actualCutPieceQty ?? record.quantity ?? 1,
        printStatus: record.printStatus || 'PRINTED',
        garmentQty: record.quantity ?? detail?.garmentQty ?? detail?.quantity ?? 1,
        processTags: record.processTags || [],
        hasSpecialCraft: record.hasSpecialCraft ?? detail?.hasSpecialCraft ?? false,
        specialCrafts: record.specialCrafts
          ? record.specialCrafts.map((craft) => ({ ...craft }))
          : (detail?.specialCrafts || []).map((craft) => ({ ...craft })),
        specialCraftDisplayLabel: record.specialCraftDisplayLabel || detail?.specialCraftDisplayLabel || '无',
        pieceSequenceRange: record.pieceSequenceRange
          ? { ...record.pieceSequenceRange }
          : detail?.pieceSequenceRange ? { ...detail.pieceSequenceRange } : null,
        pieceSequenceLabel: record.pieceSequenceLabel || detail?.pieceSequenceLabel || '不可生成',
        pieceSequenceCannotGenerateReason: record.pieceSequenceCannotGenerateReason || detail?.pieceSequenceCannotGenerateReason || '',
        qrContentText: record.qrSerializedValue || record.qrValue,
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
      operationType: job.operationType === 'REPRINT' || job.status === 'REPRINTED'
          ? 'REPRINT'
          : 'FIRST_PRINT',
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
  cutOrderRows: CutOrderRow[]
  materialPrepRows: MaterialPrepRow[]
  markerPlanSources: MarkerPlanSourceRecord[]
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

function buildTicketRecordId(cutOrderId: string, sequenceNo: number, version: number): string {
  return `ticket-${cutOrderId}-${String(sequenceNo).padStart(3, '0')}-v${version}`
}

function buildVersionedTicketNo(cutOrderNo: string, sequenceNo: number, version: number): string {
  const baseNo = buildFeiTicketNo(cutOrderNo, sequenceNo)
  return version <= 1 ? baseNo : `${baseNo}-V${version}`
}

function nextPrintJobNo(existingJobs: FeiTicketPrintJob[], nowText: string): string {
  return buildPrintJobNo(existingJobs, nowText)
}

function selectReprintSourceRecord(
  detail: TicketSplitDetail,
  ticketRecords: FeiTicketLabelRecord[],
  explicitFromTicketId?: string,
): FeiTicketLabelRecord | null {
  if (explicitFromTicketId) {
    return (
      ticketRecords.find(
        (record) =>
          record.ticketRecordId === explicitFromTicketId &&
          record.cutOrderId === detail.sourceCutOrderId,
      ) || null
    )
  }

  return (
    findDetailSourceRecord(detail, ticketRecords).find(
      (record) => !isFeiTicketRecordVoided(record) && !record.replacementTicketId,
    ) || null
  )
}

function operationTypeToStatus(operationType: FeiTicketOperationType): FeiTicketPrintJobStatus {
  if (operationType === 'REPRINT') return 'REPRINTED'
  return 'PRINTED'
}

export function executePrintableUnitPrint(options: {
  unit: PrintableUnit
  splitDetails: TicketSplitDetail[]
  cutOrderRows: CutOrderRow[]
  materialPrepRows: MaterialPrepRow[]
  markerPlanSources: MarkerPlanSourceRecord[]
  markerStore: MarkerSpreadingStore
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
  operationType: Extract<FeiTicketOperationType, 'FIRST_PRINT' | 'REPRINT'>
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
    const fromRecord = selectReprintSourceRecord(detail, Array.from(nextRecordsMap.values()), options.fromTicketId)
    const nextRecord = attachQrSnapshotToRecord(
      {
        ...createEmptyPreviewRecord(
          owner,
          detail.sequenceNo,
          options.unit.printableUnitType === 'MARKER_PLAN' ? 'marker-plan' : 'cut-order',
          options.unit.batchId,
          options.unit.batchNo,
        ),
        ticketRecordId,
        ticketNo: buildVersionedTicketNo(detail.sourceCutOrderNo, detail.sequenceNo, nextVersion),
        sourceOutputLineId: detail.sourceOutputLineId,
        sourceBasis: FEI_TICKET_SOURCE_BASIS,
        sourceBasisType: FEI_TICKET_SOURCE_BASIS_TYPE,
        sourceSpreadingSessionId: detail.sourceSpreadingSessionId,
        sourceSpreadingSessionNo: detail.sourceSpreadingSessionNo,
        printableUnitId: options.unit.printableUnitId,
        printableUnitNo: options.unit.printableUnitNo,
        printableUnitType: options.unit.printableUnitType,
        quantity: detail.quantity,
        partName: detail.partName,
        partInstanceNo: detail.partInstanceNo,
        size: detail.size,
        bundleNo: detail.bundleNo,
        pieceSetNoStart: detail.pieceSetNoStart,
        pieceSetNoEnd: detail.pieceSetNoEnd,
        pieceSetNoRange: detail.pieceSetNoRange,
        bundleTicketType: detail.bundleTicketType,
        processTags: detail.specialCrafts.map((craft) => craft.craftName),
        hasSpecialCraft: detail.hasSpecialCraft,
        specialCrafts: detail.specialCrafts.map((craft) => ({ ...craft })),
        specialCraftDisplayLabel: detail.specialCraftDisplayLabel,
        pieceSequenceRange: detail.pieceSequenceRange ? { ...detail.pieceSequenceRange } : null,
        pieceSequenceLabel: detail.pieceSequenceLabel,
        pieceSequenceCannotGenerateReason: detail.pieceSequenceCannotGenerateReason,
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
    ownerType: 'cut-order',
    cutOrderIds: uniqueStrings(targetDetails.map((detail) => detail.sourceCutOrderId)),
    cutOrderNos: uniqueStrings(targetDetails.map((detail) => detail.sourceCutOrderNo)),
    sourceContextType: options.unit.printableUnitType === 'MARKER_PLAN' ? 'marker-plan' : 'cut-order',
    sourceMarkerPlanId: options.unit.batchId,
    sourceMarkerPlanNo: options.unit.batchNo,
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
        ownersByCutOrderId[record.cutOrderId],
        printJob,
      ),
    )
  })

  return {
    printJob,
    nextRecords: Array.from(nextRecordsMap.values()).sort((left, right) => {
      const byOrder = left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN')
      if (byOrder !== 0) return byOrder
      if (left.sequenceNo !== right.sequenceNo) return left.sequenceNo - right.sequenceNo
      const leftVersion = left.version ?? left.reprintCount + 1
      const rightVersion = right.version ?? right.reprintCount + 1
      return leftVersion - rightVersion
    }),
    nextJobs: [printJob, ...options.printJobs].sort((left, right) => comparePrintedAtDesc(left.printedAt, right.printedAt)),
  }
}
