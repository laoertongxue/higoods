import {
  getSupplementOrder,
  registerSupplementOrder,
  removeSupplementOrderForRollback,
  type SupplementMaterialDemand,
} from './supplement-order-registry.ts'
import {
  registerSupplementMaterialPrepDemand,
  removeSupplementMaterialPrepDemandForRollback,
} from './supplement-material-prep-demand-registry.ts'
import { getGeneratedCutOrderSourceRecordById } from './generated-cut-orders.ts'
import {
  listHandoverOrders,
  listHandoverRecords,
  type HandoverFeiTicketItem,
  type HandoverOrder,
  type HandoverRecord,
} from './handover-orders.ts'

export type CutPieceReturnReceiptStatus = '待接收' | '已确认退件'
export type CutPieceReturnDispositionStatus = '待处理' | '已转补料' | '已报废关闭'
export type CutPieceReturnInventoryStatus = '退裁片在库' | '已报废' | '已转补料'
export type CutPieceReturnTicketPrintStatus = '待打印' | '已打印'
export type CutPieceReturnIdentificationMode = 'SCAN_OLD_TICKET' | 'MANUAL_PART_SELECTION'
export type CutPieceReturnPhysicalTicketStatus = 'PRESENT_AND_SCANNED' | 'MISSING' | 'UNREADABLE'
export type CutPieceReturnSettlementType = 'SUPPLEMENT_CREATED' | 'SCRAPPED' | ''
export type CutPieceReturnLookupMode = 'SEWING_TASK' | 'PRODUCTION_FACTORY' | 'FEI_TICKET'

export interface CutPieceReturnPartDefinition {
  partCode: string
  partName: string
  piecesPerGarment: number
  sourceCutOrderId: string
  sourceCutOrderNo: string
  oldFeiTicketNo: string
  historicalTicketNos: string[]
  historicalTicketExists: boolean
  effectiveHandedPieceQty: number
  sourceMaterialSku: string
  sourceMaterialName: string
  sourceMaterialAlias: string
  sourceMaterialColor: string
  sourceMaterialImageUrl: string
  sourceMaterialImageAlt: string
  sourcePatternId: string
  sourcePatternName: string
}

export interface CutPieceReturnReceiptPartCount {
  partCode: string
  partName: string
  sourceCutOrderId: string
  sourceCutOrderNo: string
  pieceQty: number
  unit: '片'
  identificationMode: CutPieceReturnIdentificationMode
  physicalTicketStatus: CutPieceReturnPhysicalTicketStatus
  scannedTicketNo: string
  identifiedAt: string
  identifiedBy: string
}

export interface CutPieceReturnReceipt {
  receiptId: string
  returnedGarmentQty: number
  unit: '件'
  partCounts: CutPieceReturnReceiptPartCount[]
  differenceSummary: string
  confirmedAt: string
  confirmedBy: string
  sourceFactoryName: string
}

export interface CutPieceReturnInventoryLot {
  lotId: string
  sourceType: '三方工厂退回'
  sourceRefNo: string
  partCode: string
  partName: string
  sourceCutOrderId: string
  sourceCutOrderNo: string
  pieceQty: number
  scrappedPieceQty: number
  transferredPieceQty: number
  status: CutPieceReturnInventoryStatus
  warehouseArea: '退裁片库区' | '补料业务' | '已核销'
  locationCode: string
  receivedAt: string
}

export interface CutPieceReturnSupplementPartLine {
  partCode: string
  partName: string
  supplementPieceQty: number
  sourceCutOrderId: string
  sourceCutOrderNo: string
}

export interface CutPieceReturnSupplementLink {
  supplementOrderId: string
  supplementOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
}

export interface CutPieceReturnSupplementPlan {
  planId: string
  finalMakeupGarmentQty: number
  unit: '件'
  partLines: CutPieceReturnSupplementPartLine[]
  supplementLinks: CutPieceReturnSupplementLink[]
  createdAt: string
  createdBy: string
}

export interface CutPieceReturnLargeTicket {
  ticketId: string
  ticketNo: string
  partLines: Array<{
    partCode: string
    partName: string
    sourceCutOrderId: string
    sourceCutOrderNo: string
    pieceQty: number
    unit: '片'
  }>
  printStatus: CutPieceReturnTicketPrintStatus
  createdAt: string
  createdBy: string
  printedAt: string
}

export interface CutPieceReturnResponsibilityEvent {
  eventId: string
  eventType: '首次交出齐套责任' | '确认退件扣减' | '后续正式交出增加责任'
  garmentQty: number
  occurredAt: string
  businessNo: string
}

export interface CutPieceReturnOperationLog {
  logId: string
  action: '发起退仓' | '来源责任冻结' | '确认退件' | '报废退裁片' | '创建补料单并结算' | '生成退裁片大菲票' | '打印退裁片大菲票'
  businessNo: string
  quantityText: string
  operatedAt: string
  operatedBy: string
  note: string
}

export interface CutPieceReturnCase {
  caseId: string
  returnOrderNo: string
  responsibilityScopeKey: string
  sourceHandoverOrderId: string
  sourceHandoverOrderNo: string
  sourceHandoverRecordId: string
  sourceHandoverRecordNo: string
  sourceHandoverRecordIds: string[]
  sourceHandoverRecordNos: string[]
  sourceFactoryId: string
  sourceFactoryName: string
  productionOrderId: string
  productionOrderNo: string
  sewingTaskId: string
  spuCode: string
  styleName: string
  styleImageUrl: string
  styleImageAlt: string
  materialSku: string
  materialName: string
  materialAlias: string
  materialColor: string
  materialImageUrl: string
  materialImageAlt: string
  garmentColor: string
  size: string
  frozenReleaseSnapshotId: string
  frozenMinimumReturnQty: number
  receiptStatus: CutPieceReturnReceiptStatus
  dispositionStatus: CutPieceReturnDispositionStatus
  parts: CutPieceReturnPartDefinition[]
  receipts: CutPieceReturnReceipt[]
  inventoryLots: CutPieceReturnInventoryLot[]
  supplementPlans: CutPieceReturnSupplementPlan[]
  largeTickets: CutPieceReturnLargeTicket[]
  responsibilityEvents: CutPieceReturnResponsibilityEvent[]
  operationLogs: CutPieceReturnOperationLog[]
  settlementType: CutPieceReturnSettlementType
  settledAt: string
  settledBy: string
  createdAt: string
  updatedAt: string
}

export interface CutPieceReturnResponsibilityProjection {
  frozenMinimumReturnQty: number
  confirmedReturnedGarmentQty: number
  laterFormalHandoverGarmentQty: number
  currentExpectedReturnQty: number
  formulaText: string
}

export interface CutPieceReturnCaseProjection extends CutPieceReturnCase {
  responsibility: CutPieceReturnResponsibilityProjection
  returnZoneAvailablePieceQty: number
  scrappedPieceQty: number
  transferredToSupplementPieceQty: number
  latestSupplementOrderNos: string[]
  latestSupplementStatuses: Array<{ supplementOrderNo: string; status: '未完成' | '已完成' }>
}

export interface CutPieceReturnInitiationCandidate {
  candidateId: string
  responsibilityScopeKey: string
  sourceHandoverOrderId: string
  sourceHandoverOrderNo: string
  sourceHandoverRecordIds: string[]
  sourceHandoverRecordNos: string[]
  sourceFactoryId: string
  sourceFactoryName: string
  productionOrderId: string
  productionOrderNo: string
  sewingTaskId: string
  spuCode: string
  styleName: string
  styleImageUrl: string
  styleImageAlt: string
  garmentColor: string
  size: string
  frozenReleaseSnapshotId: string
  frozenMinimumReturnQty: number
  currentExpectedReturnQty: number
  parts: CutPieceReturnInitiationPartCandidate[]
  eligible: boolean
  blockedReasons: string[]
  matchedFeiTicketNo?: string
}

export interface CutPieceReturnInitiationPartCandidate extends CutPieceReturnPartDefinition {
  confirmedReturnedPieceQty: number
  currentReturnablePieceQty: number
}

export interface CutPieceReturnSourceFactoryOption {
  factoryId: string
  factoryName: string
}

export type CutPieceReturnSourceQuery =
  | { mode: 'SEWING_TASK'; sewingTaskNo: string }
  | { mode: 'PRODUCTION_FACTORY'; productionOrderNo: string; factoryId: string }
  | { mode: 'FEI_TICKET'; feiTicketNo: string }

interface CutPieceReturnStore {
  cases: CutPieceReturnCase[]
}

const CUT_PIECE_RETURN_STORAGE_KEY = 'higood:fcs:cutting:cut-piece-return:v3'
const LEGACY_V2_CUT_PIECE_RETURN_STORAGE_KEY = 'higood:fcs:cutting:cut-piece-return:v2'
const LEGACY_CUT_PIECE_RETURN_STORAGE_KEY = 'higood:fcs:cutting:cut-piece-return:v1'
let store: CutPieceReturnStore = { cases: [] }

function nowText(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function positiveInteger(value: unknown, fieldName: string): number {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) throw new Error(fieldName + '必须是大于 0 的整数。')
  return number
}

function nonNegativeInteger(value: unknown, fieldName: string): number {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0) throw new Error(fieldName + '必须是大于等于 0 的整数。')
  return number
}

function stableToken(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  return Math.abs(hash).toString(36).toUpperCase()
}

function appendOperationLog(record: CutPieceReturnCase, input: Omit<CutPieceReturnOperationLog, 'logId'>): void {
  record.operationLogs.push({
    logId: record.caseId + '-log-' + (record.operationLogs.length + 1),
    ...input,
  })
}

function resolveStyleImageUrl(spuCode: string, styleName: string): string {
  const text = (spuCode + ' ' + styleName).toLowerCase()
  if (text.includes('2024-010') || text.includes('jogger') || text.includes('celana') || text.includes('裤')) return '/pants-sample.jpg'
  if (text.includes('tee') || text.includes('t-shirt') || text.includes('短袖')) return '/tshirt-sample.jpg'
  return ''
}

function buildResponsibilityScopeKey(input: {
  sewingTaskId: string
  sourceFactoryId: string
  productionOrderNo: string
  color: string
  size: string
  sourceCutOrderNos: string[]
}): string {
  return [
    input.sewingTaskId,
    input.sourceFactoryId,
    input.productionOrderNo,
    input.color,
    input.size,
    [...new Set(input.sourceCutOrderNos)].sort().join(','),
  ].join('::')
}

function groupFormalSewingTickets(): Array<{
  order: HandoverOrder
  records: HandoverRecord[]
  tickets: HandoverFeiTicketItem[]
  receivedItems: HandoverRecord['receivedItems']
  sewingTaskId: string
  sourceFactoryId: string
  sourceFactoryName: string
  productionOrderNo: string
  spuCode: string
  color: string
  size: string
}> {
  const orders = listHandoverOrders().filter((order) =>
    order.handoverType === '车缝交出'
    && order.receiverType === '车缝厂'
    && !['草稿', '待交出', '已取消'].includes(order.status)
  )
  const records = listHandoverRecords().filter((record) =>
    record.receiverType === '车缝厂'
    && ['已接收', '差异处理中', '已关闭'].includes(record.recordStatus)
    && record.receivedItems.some((item) => item.pieceQty > 0)
  )
  const groups = new Map<string, {
    order: HandoverOrder
    records: HandoverRecord[]
    tickets: HandoverFeiTicketItem[]
    receivedItems: HandoverRecord['receivedItems']
    sewingTaskId: string
    sourceFactoryId: string
    sourceFactoryName: string
    productionOrderNo: string
    spuCode: string
    color: string
    size: string
  }>()
  orders.forEach((order) => {
    records.filter((record) => record.handoverOrderId === order.handoverOrderId).forEach((record) => {
      record.receivedItems.forEach((receivedItem) => {
        const matchingTickets = record.feiTicketItems.filter((ticket) =>
          ticket.productionOrderNo === receivedItem.productionOrderNo
          && ticket.cutOrderNo === receivedItem.cutOrderNo
          && ticket.color === receivedItem.color
          && ticket.size === receivedItem.size
          && ticket.partCode === receivedItem.partCode
        )
        const ticket = matchingTickets[0]
        if (!ticket) return
        const sewingTaskId = record.relatedSewingTaskId ?? ''
        const key = [sewingTaskId, record.receiverId, ticket.productionOrderNo, ticket.spuCode, ticket.color, ticket.size].join('::')
        const group = groups.get(key) ?? {
          order,
          records: [],
          tickets: [],
          receivedItems: [],
          sewingTaskId,
          sourceFactoryId: record.receiverId,
          sourceFactoryName: record.receiverName,
          productionOrderNo: ticket.productionOrderNo,
          spuCode: ticket.spuCode,
          color: ticket.color,
          size: ticket.size,
        }
        if (!group.records.some((item) => item.handoverRecordId === record.handoverRecordId)) group.records.push(record)
        matchingTickets.forEach((matchedTicket) => {
          if (!group.tickets.some((item) => item.feiTicketId === matchedTicket.feiTicketId)) group.tickets.push(matchedTicket)
        })
        group.receivedItems.push({ ...receivedItem })
        groups.set(key, group)
      })
    })
  })
  return [...groups.values()]
}

function buildRawInitiationCandidates(): CutPieceReturnInitiationCandidate[] {
  return groupFormalSewingTickets().map((group) => {
    const blockedReasons: string[] = []
    const minimumKey = group.color + '::' + group.size
    const frozenMinimumReturnQty = group.records.reduce((maximum, record) => Math.max(
      maximum,
      Number(record.cutPieceReturnResponsibilitySnapshot?.completeKitQtyByColorSize?.[minimumKey] ?? 0),
    ), 0)
    if (!group.sewingTaskId) blockedReasons.push('有效交出记录缺少车缝任务号')
    if (frozenMinimumReturnQty <= 0) blockedReasons.push('缺少该车缝任务颜色尺码的首次正式交出齐套责任快照')
    const sourceRecords = new Map<string, ReturnType<typeof getGeneratedCutOrderSourceRecordById>>()
    group.tickets.forEach((ticket) => {
      if (!sourceRecords.has(ticket.cutOrderNo)) sourceRecords.set(ticket.cutOrderNo, getGeneratedCutOrderSourceRecordById(ticket.cutOrderNo))
    })
    sourceRecords.forEach((source, cutOrderNo) => {
      if (!source) blockedReasons.push('来源裁片单 ' + cutOrderNo + ' 当前不可用，不能冻结补料归属')
      else if (!source.materialImageUrl) blockedReasons.push('来源裁片单 ' + cutOrderNo + ' 缺少正式物料图')
    })
    const firstSource = [...sourceRecords.values()].find(Boolean) ?? null
    const styleName = firstSource?.styleName ?? group.spuCode
    const styleImageUrl = resolveStyleImageUrl(group.spuCode, styleName)
    if (!styleImageUrl) blockedReasons.push('来源款式缺少正式款式图')
    const partMap = new Map<string, CutPieceReturnPartDefinition>()
    group.receivedItems.forEach((receivedItem) => {
      const matchingTickets = group.tickets.filter((ticket) =>
        ticket.productionOrderNo === receivedItem.productionOrderNo
        && ticket.cutOrderNo === receivedItem.cutOrderNo
        && ticket.color === receivedItem.color
        && ticket.size === receivedItem.size
        && ticket.partCode === receivedItem.partCode
      )
      const ticket = matchingTickets[0]
      if (!ticket) return
      const source = sourceRecords.get(receivedItem.cutOrderNo)
      if (!source) return
      const pieceRow = source.pieceRows.find((row) => row.partCode === receivedItem.partCode)
      const key = receivedItem.cutOrderNo + '::' + receivedItem.partCode
      const previous = partMap.get(key)
      const historicalTicketNos = [...new Set([...(previous?.historicalTicketNos ?? []), ...matchingTickets.map((item) => item.feiTicketNo)])]
      partMap.set(key, {
        partCode: receivedItem.partCode,
        partName: receivedItem.partName,
        piecesPerGarment: Math.max(Number(pieceRow?.pieceCountPerUnit ?? 1), 1),
        sourceCutOrderId: source.cutOrderId,
        sourceCutOrderNo: source.cutOrderNo,
        oldFeiTicketNo: historicalTicketNos[0] ?? '',
        historicalTicketNos,
        historicalTicketExists: historicalTicketNos.length > 0,
        effectiveHandedPieceQty: (previous?.effectiveHandedPieceQty ?? 0) + Math.max(Number(receivedItem.pieceQty), 0),
        sourceMaterialSku: source.materialSku,
        sourceMaterialName: source.materialName,
        sourceMaterialAlias: source.materialAlias,
        sourceMaterialColor: source.materialColor || group.color,
        sourceMaterialImageUrl: source.materialImageUrl,
        sourceMaterialImageAlt: source.materialName + '（' + source.materialSku + '）正式物料图',
        sourcePatternId: source.patternIdentity.patternFileId,
        sourcePatternName: source.patternIdentity.patternFileName,
      })
    })
    if (!partMap.size) blockedReasons.push('来源交出记录没有可识别的裁片部位')
    const firstRecord = group.records[0]
    const productionOrderId = firstSource?.productionOrderId ?? firstRecord?.relatedProductionOrderIds[0] ?? group.productionOrderNo
    const responsibilityScopeKey = buildResponsibilityScopeKey({
      sewingTaskId: group.sewingTaskId,
      sourceFactoryId: group.sourceFactoryId,
      productionOrderNo: group.productionOrderNo,
      color: group.color,
      size: group.size,
      sourceCutOrderNos: [...partMap.values()].map((part) => part.sourceCutOrderNo),
    })
    return {
      candidateId: 'RETURN-SOURCE-' + stableToken(responsibilityScopeKey),
      responsibilityScopeKey,
      sourceHandoverOrderId: group.order.handoverOrderId,
      sourceHandoverOrderNo: group.order.handoverOrderNo,
      sourceHandoverRecordIds: group.records.map((record) => record.handoverRecordId),
      sourceHandoverRecordNos: group.records.map((record) => record.handoverRecordNo),
      sourceFactoryId: group.sourceFactoryId,
      sourceFactoryName: group.sourceFactoryName,
      productionOrderId,
      productionOrderNo: group.productionOrderNo,
      sewingTaskId: group.sewingTaskId,
      spuCode: group.spuCode,
      styleName,
      styleImageUrl,
      styleImageAlt: group.spuCode + ' ' + styleName + '款式图',
      garmentColor: group.color,
      size: group.size,
      frozenReleaseSnapshotId: group.order.cutPieceReleaseSnapshot?.releaseTargetSnapshotId ?? '',
      frozenMinimumReturnQty,
      currentExpectedReturnQty: frozenMinimumReturnQty,
      parts: [...partMap.values()].map((part) => ({
        ...part,
        confirmedReturnedPieceQty: 0,
        currentReturnablePieceQty: part.effectiveHandedPieceQty,
      })),
      eligible: blockedReasons.length === 0,
      blockedReasons,
    }
  }).sort((left, right) => left.sourceHandoverOrderNo.localeCompare(right.sourceHandoverOrderNo)
    || left.productionOrderNo.localeCompare(right.productionOrderNo)
    || left.garmentColor.localeCompare(right.garmentColor)
    || left.size.localeCompare(right.size))
}

function createCaseFromCandidate(input: {
  candidate: CutPieceReturnInitiationCandidate
  caseId: string
  returnOrderNo: string
  createdAt: string
  createdBy: string
}): CutPieceReturnCase {
  const primaryPart = input.candidate.parts[0]
  const record: CutPieceReturnCase = {
    caseId: input.caseId,
    returnOrderNo: input.returnOrderNo,
    responsibilityScopeKey: input.candidate.responsibilityScopeKey,
    sourceHandoverOrderId: input.candidate.sourceHandoverOrderId,
    sourceHandoverOrderNo: input.candidate.sourceHandoverOrderNo,
    sourceHandoverRecordId: input.candidate.sourceHandoverRecordIds[0] ?? '',
    sourceHandoverRecordNo: input.candidate.sourceHandoverRecordNos[0] ?? '',
    sourceHandoverRecordIds: [...input.candidate.sourceHandoverRecordIds],
    sourceHandoverRecordNos: [...input.candidate.sourceHandoverRecordNos],
    sourceFactoryId: input.candidate.sourceFactoryId,
    sourceFactoryName: input.candidate.sourceFactoryName,
    productionOrderId: input.candidate.productionOrderId,
    productionOrderNo: input.candidate.productionOrderNo,
    sewingTaskId: input.candidate.sewingTaskId,
    spuCode: input.candidate.spuCode,
    styleName: input.candidate.styleName,
    styleImageUrl: input.candidate.styleImageUrl,
    styleImageAlt: input.candidate.styleImageAlt,
    materialSku: primaryPart?.sourceMaterialSku ?? '',
    materialName: primaryPart?.sourceMaterialName ?? '',
    materialAlias: primaryPart?.sourceMaterialAlias ?? '',
    materialColor: primaryPart?.sourceMaterialColor ?? input.candidate.garmentColor,
    materialImageUrl: primaryPart?.sourceMaterialImageUrl ?? '',
    materialImageAlt: primaryPart?.sourceMaterialImageAlt ?? '',
    garmentColor: input.candidate.garmentColor,
    size: input.candidate.size,
    frozenReleaseSnapshotId: input.candidate.frozenReleaseSnapshotId,
    frozenMinimumReturnQty: input.candidate.frozenMinimumReturnQty,
    receiptStatus: '待接收',
    dispositionStatus: '待处理',
    parts: clone(input.candidate.parts),
    receipts: [],
    inventoryLots: [],
    supplementPlans: [],
    largeTickets: [],
    responsibilityEvents: [{
      eventId: input.caseId + '-basis',
      eventType: '首次交出齐套责任',
      garmentQty: input.candidate.frozenMinimumReturnQty,
      occurredAt: input.createdAt,
      businessNo: input.candidate.sourceHandoverOrderNo,
    }],
    operationLogs: [],
    settlementType: '',
    settledAt: '',
    settledBy: '',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  }
  appendOperationLog(record, {
    action: '发起退仓',
    businessNo: input.returnOrderNo,
    quantityText: '来源已冻结',
    operatedAt: input.createdAt,
    operatedBy: input.createdBy,
    note: '从正式车缝交出记录发起，冻结工厂、生产单、颜色尺码、部位、裁片单和首次齐套责任。',
  })
  appendOperationLog(record, {
    action: '来源责任冻结',
    businessNo: input.candidate.sourceHandoverRecordNos.join('、'),
    quantityText: input.candidate.frozenMinimumReturnQty + ' 件',
    operatedAt: input.createdAt,
    operatedBy: input.createdBy,
    note: '仅冻结责任依据；发起退仓不扣减车缝工厂当前应回。',
  })
  return record
}

function seedStore(): CutPieceReturnStore {
  const candidate = buildRawInitiationCandidates().find((item) => item.eligible)
  if (!candidate) return { cases: [] }
  const record = createCaseFromCandidate({
    candidate,
    caseId: 'cut-return-history-001',
    returnOrderNo: 'TH-260812-001',
    createdAt: '2026-08-12 09:00:00',
    createdBy: '裁床退仓员',
  })
  const confirmedAt = '2026-08-12 09:40:00'
  const partCounts = record.parts.map((part): CutPieceReturnReceiptPartCount => ({
    partCode: part.partCode,
    partName: part.partName,
    sourceCutOrderId: part.sourceCutOrderId,
    sourceCutOrderNo: part.sourceCutOrderNo,
    pieceQty: 12,
    unit: '片',
    identificationMode: 'MANUAL_PART_SELECTION',
    physicalTicketStatus: 'MISSING',
    scannedTicketNo: '',
    identifiedAt: confirmedAt,
    identifiedBy: '裁床退仓员',
  }))
  const receiptId = record.caseId + '-receipt-1'
  record.receipts.push({
    receiptId,
    returnedGarmentQty: 12,
    unit: '件',
    partCounts,
    differenceSummary: '按件确认 12 件；旧实物票缺失，按系统冻结部位手动清点。',
    confirmedAt,
    confirmedBy: '裁床退仓员',
    sourceFactoryName: record.sourceFactoryName,
  })
  record.receiptStatus = '已确认退件'
  record.responsibilityEvents.push({
    eventId: receiptId + '-responsibility',
    eventType: '确认退件扣减',
    garmentQty: 12,
    occurredAt: confirmedAt,
    businessNo: receiptId,
  })
  record.inventoryLots = partCounts.map((item, index) => ({
    lotId: receiptId + '-lot-' + (index + 1),
    sourceType: '三方工厂退回',
    sourceRefNo: receiptId,
    partCode: item.partCode,
    partName: item.partName,
    sourceCutOrderId: item.sourceCutOrderId,
    sourceCutOrderNo: item.sourceCutOrderNo,
    pieceQty: item.pieceQty,
    scrappedPieceQty: 0,
    transferredPieceQty: item.pieceQty,
    status: '已转补料',
    warehouseArea: '补料业务',
    locationCode: 'RETURN-A-' + String(index + 1).padStart(2, '0'),
    receivedAt: confirmedAt,
  }))
  const part = record.parts[0]
  const planId = record.caseId + '-supplement-1'
  record.supplementPlans = [{
    planId,
    finalMakeupGarmentQty: 20,
    unit: '件',
    partLines: [{
      partCode: part.partCode,
      partName: part.partName,
      supplementPieceQty: 8,
      sourceCutOrderId: part.sourceCutOrderId,
      sourceCutOrderNo: part.sourceCutOrderNo,
    }],
    supplementLinks: [{
      supplementOrderId: planId + '-' + stableToken(part.sourceCutOrderNo),
      supplementOrderNo: 'SUP-RETURN-260812-001',
      originalCutOrderId: part.sourceCutOrderId,
      originalCutOrderNo: part.sourceCutOrderNo,
    }],
    createdAt: '2026-08-12 10:10:00',
    createdBy: '裁床主管',
  }]
  record.dispositionStatus = '已转补料'
  record.settlementType = 'SUPPLEMENT_CREATED'
  record.settledAt = '2026-08-12 10:10:00'
  record.settledBy = '裁床主管'
  record.updatedAt = record.settledAt
  appendOperationLog(record, {
    action: '确认退件',
    businessNo: receiptId,
    quantityText: '12 件 / ' + partCounts.reduce((sum, item) => sum + item.pieceQty, 0) + ' 片',
    operatedAt: confirmedAt,
    operatedBy: '裁床退仓员',
    note: record.receipts[0].differenceSummary,
  })
  appendOperationLog(record, {
    action: '创建补料单并结算',
    businessNo: 'SUP-RETURN-260812-001',
    quantityText: '最终补 20 件 / 新补裁 8 片',
    operatedAt: record.settledAt,
    operatedBy: record.settledBy,
    note: '非报废退裁片已转入补料业务；退仓处理在补料单创建后结算。',
  })
  return { cases: [record] }
}

function migrateLegacyStore(raw: string): CutPieceReturnStore | null {
  try {
    const parsed = JSON.parse(raw) as { cases?: Array<Record<string, any>> }
    if (!Array.isArray(parsed.cases)) return null
    const cases = parsed.cases.map((legacy, caseIndex): CutPieceReturnCase => {
      const liveCandidate = buildRawInitiationCandidates().find((candidate) =>
        candidate.sewingTaskId === String(legacy.sewingTaskId || '')
        && candidate.sourceFactoryId === String(legacy.sourceFactoryId || '')
        && candidate.productionOrderNo === String(legacy.productionOrderNo || '')
        && candidate.garmentColor === String(legacy.garmentColor || legacy.materialColor || '')
        && candidate.size === String(legacy.size || '')
      )
      const rawParts = Array.isArray(legacy.parts) ? legacy.parts : []
      const parts = rawParts.map((item: Record<string, any>): CutPieceReturnPartDefinition => {
        const source = getGeneratedCutOrderSourceRecordById(String(item.sourceCutOrderId || item.sourceCutOrderNo || ''))
        const livePart = liveCandidate?.parts.find((part) =>
          part.partCode === String(item.partCode || '')
          && (part.sourceCutOrderId === String(source?.cutOrderId || item.sourceCutOrderId || '')
            || part.sourceCutOrderNo === String(source?.cutOrderNo || item.sourceCutOrderNo || ''))
        )
        const historicalTicketNos = Array.isArray(item.historicalTicketNos)
          ? item.historicalTicketNos.map(String).filter(Boolean)
          : [String(item.oldFeiTicketNo || '')].filter(Boolean)
        return {
          partCode: String(item.partCode || ''),
          partName: String(item.partName || item.partCode || ''),
          piecesPerGarment: Math.max(Number(item.piecesPerGarment || 1), 1),
          sourceCutOrderId: String(source?.cutOrderId || item.sourceCutOrderId || ''),
          sourceCutOrderNo: String(source?.cutOrderNo || item.sourceCutOrderNo || ''),
          oldFeiTicketNo: String(item.oldFeiTicketNo || ''),
          historicalTicketNos: livePart?.historicalTicketNos ?? historicalTicketNos,
          historicalTicketExists: Boolean(livePart?.historicalTicketExists ?? historicalTicketNos.length),
          effectiveHandedPieceQty: Number(livePart?.effectiveHandedPieceQty ?? item.effectiveHandedPieceQty ?? 0),
          sourceMaterialSku: String(source?.materialSku || legacy.materialSku || ''),
          sourceMaterialName: String(source?.materialName || legacy.materialName || ''),
          sourceMaterialAlias: String(source?.materialAlias || legacy.materialAlias || ''),
          sourceMaterialColor: String(source?.materialColor || legacy.materialColor || legacy.garmentColor || ''),
          sourceMaterialImageUrl: String(source?.materialImageUrl || legacy.materialImageUrl || ''),
          sourceMaterialImageAlt: String(legacy.materialImageAlt || ((source?.materialName || legacy.materialName || '') + '正式物料图')),
          sourcePatternId: String(source?.patternIdentity.patternFileId || ''),
          sourcePatternName: String(source?.patternIdentity.patternFileName || ''),
        }
      })
      const receipts = (Array.isArray(legacy.receipts) ? legacy.receipts : []).map((receipt: Record<string, any>): CutPieceReturnReceipt => ({
        receiptId: String(receipt.receiptId || ''),
        returnedGarmentQty: Number(receipt.returnedGarmentQty || 0),
        unit: '件',
        partCounts: (Array.isArray(receipt.partCounts) ? receipt.partCounts : []).map((item: Record<string, any>): CutPieceReturnReceiptPartCount => ({
          partCode: String(item.partCode || ''),
          partName: String(item.partName || item.partCode || ''),
          sourceCutOrderId: String(item.sourceCutOrderId || parts.find((part) => part.partCode === item.partCode)?.sourceCutOrderId || ''),
          sourceCutOrderNo: String(item.sourceCutOrderNo || parts.find((part) => part.partCode === item.partCode)?.sourceCutOrderNo || ''),
          pieceQty: Number(item.pieceQty || 0),
          unit: '片',
          identificationMode: 'MANUAL_PART_SELECTION',
          physicalTicketStatus: 'MISSING',
          scannedTicketNo: '',
          identifiedAt: String(receipt.confirmedAt || legacy.updatedAt || ''),
          identifiedBy: String(receipt.confirmedBy || '裁床退仓员'),
        })),
        differenceSummary: String(receipt.differenceSummary || ''),
        confirmedAt: String(receipt.confirmedAt || ''),
        confirmedBy: String(receipt.confirmedBy || ''),
        sourceFactoryName: String(receipt.sourceFactoryName || legacy.sourceFactoryName || ''),
      }))
      const legacyPlans = Array.isArray(legacy.supplementPlans) ? legacy.supplementPlans : []
      const hasSupplement = legacyPlans.length > 0
      const inventoryLots = (Array.isArray(legacy.inventoryLots) ? legacy.inventoryLots : [])
        .filter((lot: Record<string, any>) => lot.sourceType !== '补料裁片')
        .map((lot: Record<string, any>): CutPieceReturnInventoryLot => {
          const pieceQty = Math.max(Number(lot.pieceQty || 0), 0)
          const scrappedPieceQty = Math.min(Math.max(Number(lot.scrappedPieceQty || 0), 0), pieceQty)
          const transferredPieceQty = hasSupplement ? Math.max(pieceQty - scrappedPieceQty, 0) : 0
          return {
            lotId: String(lot.lotId || 'legacy-return-lot'),
            sourceType: '三方工厂退回',
            sourceRefNo: String(lot.sourceRefNo || ''),
            partCode: String(lot.partCode || ''),
            partName: String(lot.partName || lot.partCode || ''),
            sourceCutOrderId: String(lot.sourceCutOrderId || parts.find((part) => part.partCode === lot.partCode)?.sourceCutOrderId || ''),
            sourceCutOrderNo: String(lot.sourceCutOrderNo || parts.find((part) => part.partCode === lot.partCode)?.sourceCutOrderNo || ''),
            pieceQty,
            scrappedPieceQty,
            transferredPieceQty,
            status: transferredPieceQty > 0 ? '已转补料' : scrappedPieceQty >= pieceQty ? '已报废' : '退裁片在库',
            warehouseArea: transferredPieceQty > 0 ? '补料业务' : scrappedPieceQty >= pieceQty ? '已核销' : '退裁片库区',
            locationCode: String(lot.locationCode || ''),
            receivedAt: String(lot.receivedAt || ''),
          }
        })
      const supplementPlans = legacyPlans.map((plan: Record<string, any>): CutPieceReturnSupplementPlan => ({
        planId: String(plan.planId || ''),
        finalMakeupGarmentQty: Number(plan.finalMakeupGarmentQty || 0),
        unit: '件',
        partLines: Array.isArray(plan.partLines) ? plan.partLines.map((line: Record<string, any>) => ({
          partCode: String(line.partCode || ''),
          partName: String(line.partName || line.partCode || ''),
          supplementPieceQty: Number(line.supplementPieceQty || 0),
          sourceCutOrderId: String(line.sourceCutOrderId || ''),
          sourceCutOrderNo: String(line.sourceCutOrderNo || ''),
        })) : [],
        supplementLinks: Array.isArray(plan.supplementLinks) ? plan.supplementLinks.map((link: Record<string, any>) => ({
          supplementOrderId: String(link.supplementOrderId || ''),
          supplementOrderNo: String(link.supplementOrderNo || ''),
          originalCutOrderId: String(link.originalCutOrderId || ''),
          originalCutOrderNo: String(link.originalCutOrderNo || ''),
        })) : [],
        createdAt: String(plan.createdAt || legacy.updatedAt || ''),
        createdBy: String(plan.createdBy || '裁床主管'),
      }))
      const responsibilityScopeKey = liveCandidate?.responsibilityScopeKey ?? buildResponsibilityScopeKey({
        sewingTaskId: String(legacy.sewingTaskId || ''),
        sourceFactoryId: String(legacy.sourceFactoryId || ''),
        productionOrderNo: String(legacy.productionOrderNo || ''),
        color: String(legacy.garmentColor || legacy.materialColor || ''),
        size: String(legacy.size || ''),
        sourceCutOrderNos: parts.map((part) => part.sourceCutOrderNo),
      })
      const allScrapped = inventoryLots.length > 0 && inventoryLots.every((lot) => lot.scrappedPieceQty >= lot.pieceQty)
      const sourceRecordNo = String(legacy.sourceHandoverRecordNo || '')
      return {
        caseId: String(legacy.caseId || 'legacy-return-' + (caseIndex + 1)),
        returnOrderNo: String(legacy.returnOrderNo || '历史退仓单-' + (caseIndex + 1)),
        responsibilityScopeKey,
        sourceHandoverOrderId: String(legacy.sourceHandoverOrderId || ''),
        sourceHandoverOrderNo: String(legacy.sourceHandoverOrderNo || ''),
        sourceHandoverRecordId: sourceRecordNo,
        sourceHandoverRecordNo: sourceRecordNo,
        sourceHandoverRecordIds: sourceRecordNo ? [sourceRecordNo] : [],
        sourceHandoverRecordNos: sourceRecordNo ? [sourceRecordNo] : [],
        sourceFactoryId: String(legacy.sourceFactoryId || ''),
        sourceFactoryName: String(legacy.sourceFactoryName || ''),
        productionOrderId: String(legacy.productionOrderId || legacy.productionOrderNo || ''),
        productionOrderNo: String(legacy.productionOrderNo || ''),
        sewingTaskId: String(legacy.sewingTaskId || ''),
        spuCode: String(legacy.spuCode || ''),
        styleName: String(legacy.styleName || ''),
        styleImageUrl: String(legacy.styleImageUrl || ''),
        styleImageAlt: String(legacy.styleImageAlt || ''),
        materialSku: String(legacy.materialSku || ''),
        materialName: String(legacy.materialName || ''),
        materialAlias: String(legacy.materialAlias || ''),
        materialColor: String(legacy.materialColor || ''),
        materialImageUrl: String(legacy.materialImageUrl || ''),
        materialImageAlt: String(legacy.materialImageAlt || ''),
        garmentColor: String(legacy.garmentColor || legacy.materialColor || ''),
        size: String(legacy.size || ''),
        frozenReleaseSnapshotId: String(legacy.frozenReleaseSnapshotId || ''),
        frozenMinimumReturnQty: Number(legacy.frozenMinimumReturnQty || 0),
        receiptStatus: receipts.length ? '已确认退件' : '待接收',
        dispositionStatus: hasSupplement ? '已转补料' : allScrapped ? '已报废关闭' : '待处理',
        parts,
        receipts,
        inventoryLots,
        supplementPlans,
        largeTickets: Array.isArray(legacy.largeTickets) ? legacy.largeTickets : [],
        responsibilityEvents: (Array.isArray(legacy.responsibilityEvents) ? legacy.responsibilityEvents : [])
          .filter((event: Record<string, any>) => event.eventType === '首次交出齐套责任' || event.eventType === '确认退件扣减')
          .map((event: Record<string, any>) => ({ ...event })),
        operationLogs: [{
          logId: String(legacy.caseId || 'legacy-return') + '-migration',
          action: '来源责任冻结',
          businessNo: String(legacy.sourceHandoverOrderNo || ''),
          quantityText: Number(legacy.frozenMinimumReturnQty || 0) + ' 件',
          operatedAt: String(legacy.updatedAt || legacy.createdAt || ''),
          operatedBy: '系统迁移',
          note: '旧版补料后齐套、装袋和再次交出步骤已收口；非报废退仓以补料单创建作为结算点。',
        }],
        settlementType: hasSupplement ? 'SUPPLEMENT_CREATED' : allScrapped ? 'SCRAPPED' : '',
        settledAt: hasSupplement || allScrapped ? String(legacy.updatedAt || '') : '',
        settledBy: hasSupplement || allScrapped ? '系统迁移' : '',
        createdAt: String(legacy.createdAt || ''),
        updatedAt: String(legacy.updatedAt || legacy.createdAt || ''),
      }
    })
    return { cases }
  } catch {
    return null
  }
}

function readStore(): CutPieceReturnStore {
  try {
    const raw = globalThis.localStorage?.getItem(CUT_PIECE_RETURN_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CutPieceReturnStore>
      if (Array.isArray(parsed.cases)) return { cases: parsed.cases }
    }
    const legacyV2Raw = globalThis.localStorage?.getItem(LEGACY_V2_CUT_PIECE_RETURN_STORAGE_KEY)
    const migratedV2 = legacyV2Raw ? migrateLegacyStore(legacyV2Raw) : null
    if (migratedV2) return migratedV2
    const legacyRaw = globalThis.localStorage?.getItem(LEGACY_CUT_PIECE_RETURN_STORAGE_KEY)
    const migrated = legacyRaw ? migrateLegacyStore(legacyRaw) : null
    return migrated ?? seedStore()
  } catch {
    return seedStore()
  }
}

store = readStore()

function persistStore(): void {
  try {
    globalThis.localStorage?.setItem(CUT_PIECE_RETURN_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // 原型环境禁用 localStorage 时仍保留当前会话内存事实。
  }
}

function findCaseMutable(caseId: string): CutPieceReturnCase {
  const record = store.cases.find((item) => item.caseId === caseId || item.returnOrderNo === caseId)
  if (!record) throw new Error('未找到裁片退仓单，请刷新后重试。')
  return record
}

export function calculateCutPieceReturnResponsibility(record: CutPieceReturnCase): CutPieceReturnResponsibilityProjection {
  const scopeCases = store.cases.filter((item) => item.responsibilityScopeKey === record.responsibilityScopeKey)
  const confirmedReturnedGarmentQty = scopeCases.flatMap((item) => item.responsibilityEvents)
    .filter((event) => event.eventType === '确认退件扣减')
    .reduce((sum, event) => sum + event.garmentQty, 0)
  const laterFormalHandoverGarmentQty = scopeCases.flatMap((item) => item.responsibilityEvents)
    .filter((event) => event.eventType === '后续正式交出增加责任')
    .reduce((sum, event) => sum + event.garmentQty, 0)
  const currentExpectedReturnQty = Math.max(record.frozenMinimumReturnQty + laterFormalHandoverGarmentQty - confirmedReturnedGarmentQty, 0)
  return {
    frozenMinimumReturnQty: record.frozenMinimumReturnQty,
    confirmedReturnedGarmentQty,
    laterFormalHandoverGarmentQty,
    currentExpectedReturnQty,
    formulaText: record.frozenMinimumReturnQty + ' 件（首次正式交出齐套责任） + '
      + laterFormalHandoverGarmentQty + ' 件（后来正式再交出） - '
      + confirmedReturnedGarmentQty + ' 件（已确认退件） = ' + currentExpectedReturnQty + ' 件',
  }
}

function availableLotQty(lot: CutPieceReturnInventoryLot): number {
  return Math.max(lot.pieceQty - lot.scrappedPieceQty - lot.transferredPieceQty, 0)
}

function projectCase(record: CutPieceReturnCase): CutPieceReturnCaseProjection {
  return {
    ...clone(record),
    responsibility: calculateCutPieceReturnResponsibility(record),
    returnZoneAvailablePieceQty: record.inventoryLots
      .filter((lot) => lot.warehouseArea === '退裁片库区')
      .reduce((sum, lot) => sum + availableLotQty(lot), 0),
    scrappedPieceQty: record.inventoryLots.reduce((sum, lot) => sum + lot.scrappedPieceQty, 0),
    transferredToSupplementPieceQty: record.inventoryLots.reduce((sum, lot) => sum + lot.transferredPieceQty, 0),
    latestSupplementOrderNos: record.supplementPlans.flatMap((plan) => plan.supplementLinks.map((link) => link.supplementOrderNo)),
    latestSupplementStatuses: record.supplementPlans.flatMap((plan) => plan.supplementLinks.map((link) => ({
      supplementOrderNo: link.supplementOrderNo,
      status: getSupplementOrder(link.supplementOrderId)?.status ?? '未完成',
    }))),
  }
}

function getConfirmedReturnedPartQty(
  responsibilityScopeKey: string,
  sourceCutOrderId: string,
  partCode: string,
): number {
  return store.cases
    .filter((record) => record.responsibilityScopeKey === responsibilityScopeKey)
    .flatMap((record) => record.receipts)
    .flatMap((receipt) => receipt.partCounts)
    .filter((item) => item.sourceCutOrderId === sourceCutOrderId && item.partCode === partCode)
    .reduce((sum, item) => sum + item.pieceQty, 0)
}

export function listCutPieceReturnInitiationCandidates(): CutPieceReturnInitiationCandidate[] {
  return buildRawInitiationCandidates().map((candidate) => {
    const scopeCases = store.cases.filter((record) => record.responsibilityScopeKey === candidate.responsibilityScopeKey)
    const confirmedReturnedGarmentQty = scopeCases.flatMap((record) => record.responsibilityEvents)
      .filter((event) => event.eventType === '确认退件扣减')
      .reduce((sum, event) => sum + event.garmentQty, 0)
    const laterFormalHandoverGarmentQty = scopeCases.flatMap((record) => record.responsibilityEvents)
      .filter((event) => event.eventType === '后续正式交出增加责任')
      .reduce((sum, event) => sum + event.garmentQty, 0)
    const currentExpectedReturnQty = Math.max(candidate.frozenMinimumReturnQty + laterFormalHandoverGarmentQty - confirmedReturnedGarmentQty, 0)
    const blockedReasons = [...candidate.blockedReasons]
    if (scopeCases.some((record) => !record.settlementType)) blockedReasons.push('该责任范围已有未结算退仓单')
    if (currentExpectedReturnQty <= 0) blockedReasons.push('该责任范围当前应回已结清')
    const parts = candidate.parts.map((part) => {
      const confirmedReturnedPieceQty = getConfirmedReturnedPartQty(
        candidate.responsibilityScopeKey,
        part.sourceCutOrderId,
        part.partCode,
      )
      return {
        ...part,
        confirmedReturnedPieceQty,
        currentReturnablePieceQty: Math.max(part.effectiveHandedPieceQty - confirmedReturnedPieceQty, 0),
      }
    })
    if (!parts.some((part) => part.currentReturnablePieceQty > 0)) blockedReasons.push('该责任范围的部位裁片已全部退清')
    return {
      ...clone(candidate),
      currentExpectedReturnQty,
      parts,
      eligible: blockedReasons.length === 0,
      blockedReasons,
    }
  })
}

function exactMatch(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase()
}

export function listCutPieceReturnFactoriesByProductionOrder(productionOrderNo: string): CutPieceReturnSourceFactoryOption[] {
  const normalized = productionOrderNo.trim()
  if (!normalized) return []
  const factories = new Map<string, CutPieceReturnSourceFactoryOption>()
  buildRawInitiationCandidates()
    .filter((candidate) => exactMatch(candidate.productionOrderNo, normalized))
    .forEach((candidate) => factories.set(candidate.sourceFactoryId, {
      factoryId: candidate.sourceFactoryId,
      factoryName: candidate.sourceFactoryName,
    }))
  return [...factories.values()].sort((left, right) => left.factoryName.localeCompare(right.factoryName))
}

export function findCutPieceReturnSources(query: CutPieceReturnSourceQuery): CutPieceReturnInitiationCandidate[] {
  const candidates = listCutPieceReturnInitiationCandidates()
  if (query.mode === 'SEWING_TASK') {
    const sewingTaskNo = query.sewingTaskNo.trim()
    if (!sewingTaskNo) throw new Error('请输入车缝任务单号。')
    return candidates.filter((candidate) => exactMatch(candidate.sewingTaskId, sewingTaskNo))
  }
  if (query.mode === 'PRODUCTION_FACTORY') {
    const productionOrderNo = query.productionOrderNo.trim()
    if (!productionOrderNo) throw new Error('请输入生产单号。')
    if (!query.factoryId.trim()) throw new Error('请选择该生产单实际承接的车缝工厂。')
    return candidates.filter((candidate) =>
      exactMatch(candidate.productionOrderNo, productionOrderNo)
      && candidate.sourceFactoryId === query.factoryId
    )
  }
  const feiTicketNo = query.feiTicketNo.trim()
  if (!feiTicketNo) throw new Error('请输入菲票号。')
  const matched = candidates.filter((candidate) => candidate.parts.some((part) =>
    part.historicalTicketNos.some((ticketNo) => exactMatch(ticketNo, feiTicketNo))
  ))
  if (matched.length > 1) {
    return matched.map((candidate) => ({
      ...candidate,
      matchedFeiTicketNo: feiTicketNo,
      eligible: false,
      blockedReasons: [...candidate.blockedReasons, '该菲票同时匹配多个车缝任务责任范围，请由主管处理'],
    }))
  }
  return matched.map((candidate) => ({ ...candidate, matchedFeiTicketNo: feiTicketNo }))
}

function nextReturnOrderNo(createdAt: string): string {
  const dateToken = createdAt.slice(2, 10).replace(/-/g, '')
  const prefix = 'TH-' + dateToken + '-'
  const next = store.cases
    .map((record) => record.returnOrderNo)
    .filter((orderNo) => orderNo.startsWith(prefix))
    .map((orderNo) => Number(orderNo.slice(prefix.length)))
    .filter(Number.isFinite)
    .reduce((maximum, value) => Math.max(maximum, value), 0) + 1
  return prefix + String(next).padStart(3, '0')
}

export function listCutPieceReturnCases(): CutPieceReturnCaseProjection[] {
  store.cases.forEach(ensureSupplementRegistryLinks)
  return store.cases.map(projectCase).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export function getCutPieceReturnCase(caseId: string): CutPieceReturnCaseProjection | null {
  const record = store.cases.find((item) => item.caseId === caseId || item.returnOrderNo === caseId)
  if (record) ensureSupplementRegistryLinks(record)
  return record ? projectCase(record) : null
}

export interface CutPieceReturnReceiptConfirmationInput {
  caseId: string
  returnedGarmentQty: number
  partCounts: Array<{
    partCode: string
    sourceCutOrderId: string
    pieceQty: number
    identificationMode: CutPieceReturnIdentificationMode
    physicalTicketStatus: CutPieceReturnPhysicalTicketStatus
    scannedTicketNo?: string
    identifiedAt?: string
    identifiedBy?: string
  }>
  confirmedBy: string
  confirmedAt?: string
}

function applyCutPieceReturnReceipt(
  record: CutPieceReturnCase,
  input: Omit<CutPieceReturnReceiptConfirmationInput, 'caseId'>,
): void {
  if (record.settlementType) throw new Error('该退仓单已结算，不能再次确认退件。')
  if (record.receipts.length) throw new Error('该退仓单已经确认过退件，不能重复确认。')
  const returnedGarmentQty = positiveInteger(input.returnedGarmentQty, '确认退件数量')
  const responsibility = calculateCutPieceReturnResponsibility(record)
  if (returnedGarmentQty > responsibility.currentExpectedReturnQty) {
    throw new Error('本次确认退件 ' + returnedGarmentQty + ' 件，超过当前应回 ' + responsibility.currentExpectedReturnQty + ' 件，必须由主管处理。')
  }
  const partKey = (partCode: string, sourceCutOrderId: string) => sourceCutOrderId + '::' + partCode
  const inputMap = new Map<string, typeof input.partCounts[number]>()
  input.partCounts.forEach((item) => {
    const key = partKey(item.partCode, item.sourceCutOrderId)
    if (inputMap.has(key)) throw new Error('同一裁片单的同一部位不能重复录入。')
    inputMap.set(key, item)
  })
  const confirmedAt = input.confirmedAt || nowText()
  const confirmedBy = input.confirmedBy.trim() || '裁床退仓员'
  const usedScannedTickets = new Set(store.cases.flatMap((item) => item.receipts)
    .flatMap((receipt) => receipt.partCounts)
    .map((item) => item.scannedTicketNo)
    .filter(Boolean))
  const partCounts = record.parts.map((part): CutPieceReturnReceiptPartCount => {
    const item = inputMap.get(partKey(part.partCode, part.sourceCutOrderId))
    if (!item) throw new Error('请完成 ' + part.sourceCutOrderNo + ' / ' + part.partName + ' 的识别与清点。')
    const scannedTicketNo = item.scannedTicketNo?.trim() ?? ''
    if (item.identificationMode === 'SCAN_OLD_TICKET') {
      if (!part.historicalTicketExists) throw new Error(part.partName + '没有可供匹配的历史来源菲票。')
      if (item.physicalTicketStatus !== 'PRESENT_AND_SCANNED') throw new Error(part.partName + '扫码识别必须记录为“实物票在场且已扫码”。')
      if (!scannedTicketNo || !part.historicalTicketNos.some((ticketNo) => exactMatch(ticketNo, scannedTicketNo))) {
        throw new Error(part.partName + '扫描的菲票与冻结来源不匹配。')
      }
      if (usedScannedTickets.has(scannedTicketNo)) throw new Error('菲票 ' + scannedTicketNo + ' 已用于其他退仓清点，禁止重复扫描。')
      usedScannedTickets.add(scannedTicketNo)
    } else {
      if (item.physicalTicketStatus === 'PRESENT_AND_SCANNED' || scannedTicketNo) {
        throw new Error(part.partName + '选择手动部位时，实物票状态只能是“缺失”或“无法识别”。')
      }
    }
    const pieceQty = nonNegativeInteger(item.pieceQty, part.partName + '清点数量')
    const confirmedReturnedPieceQty = getConfirmedReturnedPartQty(
      record.responsibilityScopeKey,
      part.sourceCutOrderId,
      part.partCode,
    )
    const currentReturnablePieceQty = Math.max(part.effectiveHandedPieceQty - confirmedReturnedPieceQty, 0)
    if (pieceQty > currentReturnablePieceQty) {
      throw new Error(part.sourceCutOrderNo + ' / ' + part.partName + '本次退回 ' + pieceQty
        + ' 片，超过当前可退 ' + currentReturnablePieceQty + ' 片。')
    }
    return {
      partCode: part.partCode,
      partName: part.partName,
      sourceCutOrderId: part.sourceCutOrderId,
      sourceCutOrderNo: part.sourceCutOrderNo,
      pieceQty,
      unit: '片',
      identificationMode: item.identificationMode,
      physicalTicketStatus: item.physicalTicketStatus,
      scannedTicketNo,
      identifiedAt: item.identifiedAt?.trim() || confirmedAt,
      identifiedBy: item.identifiedBy?.trim() || confirmedBy,
    }
  })
  if (!partCounts.some((item) => item.pieceQty > 0)) throw new Error('至少需要清点到一个部位裁片。')
  const differenceParts = partCounts
    .map((item) => ({
      ...item,
      expected: returnedGarmentQty * (record.parts.find((part) =>
        part.partCode === item.partCode && part.sourceCutOrderId === item.sourceCutOrderId
      )?.piecesPerGarment || 1),
    }))
    .filter((item) => item.pieceQty !== item.expected)
  const receiptId = record.caseId + '-receipt-1'
  const receipt: CutPieceReturnReceipt = {
    receiptId,
    returnedGarmentQty,
    unit: '件',
    partCounts,
    differenceSummary: differenceParts.length
      ? '按件确认 ' + returnedGarmentQty + ' 件；' + differenceParts.map((item) =>
          item.partName + (item.pieceQty < item.expected ? '少' : '多') + ' ' + Math.abs(item.pieceQty - item.expected) + ' 片'
        ).join('，') + '，差异仅进入报废或补料处理。'
      : '按件数量和各部位清点一致；后续仍按报废或补料处理。',
    confirmedAt,
    confirmedBy,
    sourceFactoryName: record.sourceFactoryName,
  }
  record.receipts.push(receipt)
  partCounts.filter((item) => item.pieceQty > 0).forEach((item, index) => {
    record.inventoryLots.push({
      lotId: receiptId + '-lot-' + (index + 1),
      sourceType: '三方工厂退回',
      sourceRefNo: receiptId,
      partCode: item.partCode,
      partName: item.partName,
      sourceCutOrderId: item.sourceCutOrderId,
      sourceCutOrderNo: item.sourceCutOrderNo,
      pieceQty: item.pieceQty,
      scrappedPieceQty: 0,
      transferredPieceQty: 0,
      status: '退裁片在库',
      warehouseArea: '退裁片库区',
      locationCode: 'RETURN-A-' + String((record.inventoryLots.length % 8) + 1).padStart(2, '0'),
      receivedAt: confirmedAt,
    })
  })
  record.responsibilityEvents.push({
    eventId: receiptId + '-responsibility',
    eventType: '确认退件扣减',
    garmentQty: returnedGarmentQty,
    occurredAt: confirmedAt,
    businessNo: receiptId,
  })
  appendOperationLog(record, {
    action: '确认退件',
    businessNo: receiptId,
    quantityText: returnedGarmentQty + ' 件 / ' + partCounts.reduce((sum, item) => sum + item.pieceQty, 0) + ' 片',
    operatedAt: confirmedAt,
    operatedBy: receipt.confirmedBy,
    note: receipt.differenceSummary,
  })
  record.receiptStatus = '已确认退件'
  record.dispositionStatus = '待处理'
  record.updatedAt = confirmedAt
}

export function confirmCutPieceReturnReceipt(input: CutPieceReturnReceiptConfirmationInput): CutPieceReturnCaseProjection {
  const record = findCaseMutable(input.caseId)
  applyCutPieceReturnReceipt(record, input)
  persistStore()
  return projectCase(record)
}

export function createAndConfirmCutPieceReturn(input: {
  candidateId: string
  returnedGarmentQty: number
  partCounts: CutPieceReturnReceiptConfirmationInput['partCounts']
  confirmedBy: string
  confirmedAt?: string
}): CutPieceReturnCaseProjection {
  const candidate = listCutPieceReturnInitiationCandidates().find((item) => item.candidateId === input.candidateId)
  if (!candidate) throw new Error('未找到已选的车缝任务退仓责任范围。')
  if (!candidate.eligible) throw new Error('该责任范围暂不能退仓：' + candidate.blockedReasons.join('；') + '。')
  const confirmedAt = input.confirmedAt || nowText()
  const confirmedBy = input.confirmedBy.trim() || '裁床退仓员'
  const returnOrderNo = nextReturnOrderNo(confirmedAt)
  const record = createCaseFromCandidate({
    candidate,
    caseId: 'cut-return-' + stableToken(returnOrderNo + ':' + candidate.candidateId),
    returnOrderNo,
    createdAt: confirmedAt,
    createdBy: confirmedBy,
  })
  applyCutPieceReturnReceipt(record, {
    returnedGarmentQty: input.returnedGarmentQty,
    partCounts: input.partCounts,
    confirmedBy,
    confirmedAt,
  })
  store.cases.push(record)
  persistStore()
  return projectCase(record)
}

export function scrapCutPieceReturnInventory(input: {
  caseId: string
  partCode: string
  sourceCutOrderId?: string
  pieceQty: number
  reason: string
  operatedBy: string
  operatedAt?: string
}): CutPieceReturnCaseProjection {
  const record = findCaseMutable(input.caseId)
  if (record.receiptStatus !== '已确认退件') throw new Error('必须先确认退件，才能报废退裁片。')
  if (record.settlementType) throw new Error('该退仓单已结算，不能再次报废。')
  const reason = input.reason.trim()
  if (!reason) throw new Error('报废必须填写原因。')
  let remaining = positiveInteger(input.pieceQty, '报废数量')
  const candidates = record.inventoryLots.filter((lot) =>
    lot.partCode === input.partCode
    && (!input.sourceCutOrderId || lot.sourceCutOrderId === input.sourceCutOrderId)
    && lot.warehouseArea === '退裁片库区'
    && availableLotQty(lot) > 0
  )
  const available = candidates.reduce((sum, lot) => sum + availableLotQty(lot), 0)
  if (remaining > available) throw new Error('退裁片库区该部位仅有 ' + available + ' 片可报废。')
  candidates.forEach((lot) => {
    if (!remaining) return
    const quantity = Math.min(remaining, availableLotQty(lot))
    lot.scrappedPieceQty += quantity
    remaining -= quantity
    if (!availableLotQty(lot)) {
      lot.status = '已报废'
      lot.warehouseArea = '已核销'
    }
  })
  const operatedAt = input.operatedAt || nowText()
  appendOperationLog(record, {
    action: '报废退裁片',
    businessNo: record.returnOrderNo,
    quantityText: input.pieceQty + ' 片',
    operatedAt,
    operatedBy: input.operatedBy.trim() || '裁床主管',
    note: (record.parts.find((part) => part.partCode === input.partCode)?.partName || input.partCode)
      + '从退裁片库区永久核销；原因：' + reason + '。报废不二次扣减车缝工厂应回责任。',
  })
  record.updatedAt = operatedAt
  if (record.inventoryLots.length && record.inventoryLots.every((lot) => !availableLotQty(lot))) {
    record.dispositionStatus = '已报废关闭'
    record.settlementType = 'SCRAPPED'
    record.settledAt = operatedAt
    record.settledBy = input.operatedBy.trim() || '裁床主管'
  }
  persistStore()
  return projectCase(record)
}

function buildSupplementMaterialDemand(
  record: CutPieceReturnCase,
  link: CutPieceReturnSupplementLink,
  pieceQty: number,
): SupplementMaterialDemand {
  const part = record.parts.find((item) => item.sourceCutOrderId === link.originalCutOrderId)
  if (!part) throw new Error('补料单 ' + link.supplementOrderNo + ' 缺少原裁片单物料与纸样快照。')
  const alias = part.sourceMaterialAlias
  const materialRole: SupplementMaterialDemand['materialRole'] = alias.includes('面kainB') || alias.includes('面料B')
    ? '面料B'
    : alias.includes('面kainC') || alias.includes('面料C')
      ? '面料C'
      : alias.includes('衬')
        ? '衬'
        : alias.includes('里')
          ? '里布'
          : alias.includes('罗纹') || alias.includes('螺纹')
            ? '罗纹'
            : '面料A'
  return {
    key: link.supplementOrderId + '-material-main',
    materialPatternMappingId: part.sourcePatternId + ':' + part.sourceMaterialSku,
    sourceBomItemId: part.sourceMaterialSku,
    techPackVersionId: record.frozenReleaseSnapshotId,
    materialSku: part.sourceMaterialSku,
    materialName: part.sourceMaterialName,
    materialTypeLabel: '主面料',
    materialImageUrl: part.sourceMaterialImageUrl,
    materialImageAlt: part.sourceMaterialImageAlt,
    materialAlias: part.sourceMaterialAlias,
    materialRole,
    roleSource: '退仓补裁按原裁片单冻结技术包展开',
    roleConfirmStatus: '已确认',
    patternId: part.sourcePatternId,
    patternName: part.sourcePatternName,
    requiredQty: Number(Math.max(pieceQty * 0.45, 0.1).toFixed(2)),
    unit: 'M',
    printRequired: false,
    dyeRequired: false,
    processNote: '退仓补裁关联原裁片单；实际领料仍按冻结 BOM、纸样排版和损耗在补料流程确认。',
    originalCutOrderId: link.originalCutOrderId,
    originalCutOrderNo: link.originalCutOrderNo,
    color: part.sourceMaterialColor,
    spec: part.sourceMaterialAlias,
    patternPart: '按补裁部位展开',
  }
}

function buildReturnPieceSnapshot(record: CutPieceReturnCase, link: CutPieceReturnSupplementLink) {
  return record.inventoryLots
    .filter((lot) => lot.sourceCutOrderId === link.originalCutOrderId)
    .map((lot) => ({
      inventoryLotId: lot.lotId,
      partCode: lot.partCode,
      partName: lot.partName,
      reusablePieceQty: Math.max(lot.transferredPieceQty || availableLotQty(lot), 0),
    }))
    .filter((item) => item.reusablePieceQty > 0)
}

function registerSupplementLink(
  record: CutPieceReturnCase,
  plan: CutPieceReturnSupplementPlan,
  link: CutPieceReturnSupplementLink,
): { orderId: string; confirmationKey: string } {
  const lines = plan.partLines.filter((line) => line.sourceCutOrderId === link.originalCutOrderId)
  const totalPieceQty = lines.reduce((sum, line) => sum + line.supplementPieceQty, 0)
  const confirmationKey = 'CUT_RETURN:' + record.caseId + ':' + plan.planId + ':' + link.originalCutOrderId
  const order = registerSupplementOrder({
    id: link.supplementOrderId,
    recordNo: link.supplementOrderNo,
    cutOrderId: link.originalCutOrderId,
    cutOrderNo: link.originalCutOrderNo,
    productionOrderId: record.productionOrderId,
    productionOrderNo: record.productionOrderNo,
    businessSourceType: 'SEWING_RETURN',
    sourceReturnCaseId: record.caseId,
    sourceReturnOrderNo: record.returnOrderNo,
    sourceHandoverRecordId: record.sourceHandoverRecordId,
    sourceHandoverRecordIds: record.sourceHandoverRecordIds,
    sourceReturnPieceSnapshot: buildReturnPieceSnapshot(record, link),
    reason: '车缝退仓补料',
    reasonDetail: '退仓单 ' + record.returnOrderNo + '；最终补 ' + plan.finalMakeupGarmentQty + ' 件；'
      + lines.map((line) => line.partName + ' ' + line.supplementPieceQty + ' 片').join('、')
      + '。新补裁数量由操作人确认，不受退回部位清点数量上限约束。',
    totalQty: plan.finalMakeupGarmentQty,
    lineSummary: record.garmentColor + '/' + record.size + '/' + plan.finalMakeupGarmentQty + '件；'
      + lines.map((line) => line.partName + line.supplementPieceQty + '片').join('、'),
    lines: [{ color: record.garmentColor, size: record.size, supplementQty: plan.finalMakeupGarmentQty }],
    materialDemands: [buildSupplementMaterialDemand(record, link, totalPieceQty)],
    confirmationKey,
    requestFingerprint: plan.finalMakeupGarmentQty + ':' + lines.map((line) => line.partCode + ':' + line.supplementPieceQty).join('|'),
    draftMeta: {
      candidateId: record.caseId,
      sourceType: 'cut-order',
      sourceNo: link.originalCutOrderNo,
      styleName: record.styleName,
      spuCode: record.spuCode,
      styleImageUrl: record.styleImageUrl,
      styleImageAlt: record.styleImageAlt,
    },
    materialPrepDemandId: 'SUP-PREP:' + link.supplementOrderId,
    supplyDecisionSnapshots: [],
    processWorkOrderRefs: [],
    createdPurchaseOrderRefs: [],
    createdAt: plan.createdAt,
    createdBy: plan.createdBy,
  })
  registerSupplementMaterialPrepDemand({
    supplementOrderId: order.id,
    supplementOrderNo: order.recordNo,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    cutOrderId: order.cutOrderId,
    cutOrderNo: order.cutOrderNo,
    sequenceNo: order.sequenceNo,
    reason: order.reason + '：' + order.reasonDetail,
    materialDemands: order.materialDemands,
    supplyDecisionSnapshots: order.supplyDecisionSnapshots,
    createdPurchaseOrderRefs: order.createdPurchaseOrderRefs,
    createdAt: order.createdAt,
  })
  return { orderId: order.id, confirmationKey }
}

function ensureSupplementRegistryLinks(record: CutPieceReturnCase): void {
  record.supplementPlans.forEach((plan) => {
    plan.supplementLinks.forEach((link) => {
      if (!getSupplementOrder(link.supplementOrderId)) registerSupplementLink(record, plan, link)
    })
  })
}

export function createCutPieceReturnSupplementPlan(input: {
  caseId: string
  finalMakeupGarmentQty: number
  partLines: Array<{ partCode: string; sourceCutOrderId: string; supplementPieceQty: number }>
  createdBy: string
  createdAt?: string
}): CutPieceReturnCaseProjection {
  const record = findCaseMutable(input.caseId)
  if (record.receiptStatus !== '已确认退件') throw new Error('必须先确认退件件数和部位清点结果，才能创建补料。')
  if (record.settlementType) throw new Error('该退仓单已结算，不能重复创建补料单。')
  if (!record.inventoryLots.some((lot) => availableLotQty(lot) > 0)) throw new Error('退裁片库区没有可转入补料业务的裁片。')
  const finalMakeupGarmentQty = positiveInteger(input.finalMakeupGarmentQty, '最终补齐件数')
  const partLines = input.partLines
    .map((line) => {
      const part = record.parts.find((item) => item.partCode === line.partCode && item.sourceCutOrderId === line.sourceCutOrderId)
      if (!part) throw new Error('部位 ' + line.partCode + ' 不属于所选原裁片单。')
      return {
        partCode: part.partCode,
        partName: part.partName,
        supplementPieceQty: nonNegativeInteger(line.supplementPieceQty, part.partName + '补裁数量'),
        sourceCutOrderId: part.sourceCutOrderId,
        sourceCutOrderNo: part.sourceCutOrderNo,
      }
    })
    .filter((line) => line.supplementPieceQty > 0)
  if (!partLines.length) throw new Error('至少需要填写一个补裁部位及数量。')
  const availableSourceCutOrderIds = new Set(record.inventoryLots.filter((lot) => availableLotQty(lot) > 0).map((lot) => lot.sourceCutOrderId))
  const plannedSourceCutOrderIds = new Set(partLines.map((line) => line.sourceCutOrderId))
  const unboundSource = [...availableSourceCutOrderIds].filter((cutOrderId) => !plannedSourceCutOrderIds.has(cutOrderId))
  if (unboundSource.length) {
    const orderNos = unboundSource.map((cutOrderId) =>
      record.parts.find((part) => part.sourceCutOrderId === cutOrderId)?.sourceCutOrderNo || cutOrderId
    )
    throw new Error('退裁片仍涉及原裁片单 ' + orderNos.join('、') + '；请为其填写至少一个补裁部位，或先报废该裁片单下剩余退裁片。')
  }
  plannedSourceCutOrderIds.forEach((cutOrderId) => {
    const source = getGeneratedCutOrderSourceRecordById(cutOrderId)
    if (!source) throw new Error('原裁片单 ' + cutOrderId + ' 当前不可用，不能创建补料单。')
    if (!source.materialImageUrl) throw new Error('原裁片单 ' + source.cutOrderNo + ' 缺少正式物料图，不能创建补料单。')
  })
  const createdAt = input.createdAt || nowText()
  const createdBy = input.createdBy.trim() || '裁床主管'
  const planId = record.caseId + '-supplement-' + (record.supplementPlans.length + 1)
  const groups = new Map<string, CutPieceReturnSupplementPartLine[]>()
  partLines.forEach((line) => groups.set(line.sourceCutOrderId, [...(groups.get(line.sourceCutOrderId) || []), line]))
  const supplementLinks = [...groups.entries()].map(([cutOrderId, lines], index): CutPieceReturnSupplementLink => {
    const cutOrderNo = lines[0].sourceCutOrderNo
    const originalCutOrderId = lines[0].sourceCutOrderId
    return {
      supplementOrderId: planId + '-' + stableToken(cutOrderId),
      supplementOrderNo: 'SUP-RETURN-' + record.returnOrderNo.replace(/[^0-9]/g, '').slice(-6) + '-' + String(index + 1).padStart(2, '0'),
      originalCutOrderId,
      originalCutOrderNo: cutOrderNo,
    }
  })
  const plan: CutPieceReturnSupplementPlan = {
    planId,
    finalMakeupGarmentQty,
    unit: '件',
    partLines,
    supplementLinks,
    createdAt,
    createdBy,
  }
  const registered: Array<{ orderId: string; confirmationKey: string }> = []
  try {
    supplementLinks.forEach((link) => registered.push(registerSupplementLink(record, plan, link)))
  } catch (error) {
    registered.reverse().forEach((item) => {
      removeSupplementMaterialPrepDemandForRollback(item.orderId)
      removeSupplementOrderForRollback(item.orderId, item.confirmationKey)
    })
    throw error
  }
  record.inventoryLots.filter((lot) => availableLotQty(lot) > 0).forEach((lot) => {
    lot.transferredPieceQty += availableLotQty(lot)
    lot.status = '已转补料'
    lot.warehouseArea = '补料业务'
  })
  record.supplementPlans.push(plan)
  appendOperationLog(record, {
    action: '创建补料单并结算',
    businessNo: supplementLinks.map((link) => link.supplementOrderNo).join('、'),
    quantityText: '最终补 ' + finalMakeupGarmentQty + ' 件 / 新补裁 ' + partLines.reduce((sum, line) => sum + line.supplementPieceQty, 0) + ' 片',
    operatedAt: createdAt,
    operatedBy: createdBy,
    note: '新补裁部位与数量由本次人工确认；按 ' + supplementLinks.length
      + ' 个原裁片单原子拆分补料单。剩余退裁片已转入补料业务，退仓处理立即结算。',
  })
  record.dispositionStatus = '已转补料'
  record.settlementType = 'SUPPLEMENT_CREATED'
  record.settledAt = createdAt
  record.settledBy = createdBy
  record.updatedAt = createdAt
  persistStore()
  return projectCase(record)
}

export function createCutPieceReturnLargeTicket(input: {
  caseId: string
  partKeys?: string[]
  partCodes?: string[]
  createdBy: string
  createdAt?: string
}): CutPieceReturnCaseProjection {
  const record = findCaseMutable(input.caseId)
  const selectedKeys = new Set(input.partKeys ?? [])
  const selectedCodes = new Set(input.partCodes ?? [])
  const partLines = record.parts
    .filter((part) => selectedKeys.has(part.sourceCutOrderId + '::' + part.partCode) || selectedCodes.has(part.partCode))
    .map((part) => ({
      partCode: part.partCode,
      partName: part.partName,
      sourceCutOrderId: part.sourceCutOrderId,
      sourceCutOrderNo: part.sourceCutOrderNo,
      pieceQty: record.inventoryLots
        .filter((lot) =>
          lot.partCode === part.partCode
          && lot.sourceCutOrderId === part.sourceCutOrderId
          && lot.warehouseArea === '退裁片库区'
        )
        .reduce((sum, lot) => sum + availableLotQty(lot), 0),
      unit: '片' as const,
    }))
    .filter((line) => line.pieceQty > 0)
  if (!partLines.length) throw new Error('请至少选择一个退裁片库区有可用数量的部位。')
  const createdAt = input.createdAt || nowText()
  const sequence = record.largeTickets.length + 1
  const ticketId = `${record.caseId}-large-ticket-${sequence}`
  const ticketNo = `TR-${record.returnOrderNo.replace(/[^0-9]/g, '').slice(-6)}-${String(sequence).padStart(2, '0')}`
  record.largeTickets.push({
    ticketId,
    ticketNo,
    partLines,
    printStatus: '待打印',
    createdAt,
    createdBy: input.createdBy.trim() || '裁床退仓员',
    printedAt: '',
  })
  appendOperationLog(record, {
    action: '生成退裁片大菲票',
    businessNo: ticketNo,
    quantityText: `${partLines.length} 个部位 / ${partLines.reduce((sum, line) => sum + line.pieceQty, 0)} 片`,
    operatedAt: createdAt,
    operatedBy: input.createdBy.trim() || '裁床退仓员',
    note: '基于退仓单已知部位生成，不要求旧实物菲票仍然存在。',
  })
  record.updatedAt = createdAt
  persistStore()
  return projectCase(record)
}

export function markCutPieceReturnLargeTicketPrinted(input: {
  caseId: string
  ticketId: string
  printedAt?: string
}): CutPieceReturnCaseProjection {
  const record = findCaseMutable(input.caseId)
  const ticket = record.largeTickets.find((item) => item.ticketId === input.ticketId)
  if (!ticket) throw new Error('未找到退裁片大菲票。')
  ticket.printStatus = '已打印'
  ticket.printedAt = input.printedAt || nowText()
  appendOperationLog(record, {
    action: '打印退裁片大菲票',
    businessNo: ticket.ticketNo,
    quantityText: `${ticket.partLines.length} 个部位 / ${ticket.partLines.reduce((sum, line) => sum + line.pieceQty, 0)} 片`,
    operatedAt: ticket.printedAt,
    operatedBy: ticket.createdBy,
    note: '固定 100mm × 100mm 退裁片大菲票已打印。',
  })
  record.updatedAt = ticket.printedAt
  persistStore()
  return projectCase(record)
}

export function resetCutPieceReturnDomainForTesting(): void {
  store.cases.flatMap((record) => record.supplementPlans).flatMap((plan) => plan.supplementLinks).forEach((link) => {
    const confirmationKey = 'CUT_RETURN:' + link.supplementOrderId.split('-supplement-')[0]
    removeSupplementMaterialPrepDemandForRollback(link.supplementOrderId)
    const order = getSupplementOrder(link.supplementOrderId)
    if (order) removeSupplementOrderForRollback(link.supplementOrderId, order.confirmationKey || confirmationKey)
  })
  store = seedStore()
  try {
    globalThis.localStorage?.removeItem(CUT_PIECE_RETURN_STORAGE_KEY)
    globalThis.localStorage?.removeItem(LEGACY_V2_CUT_PIECE_RETURN_STORAGE_KEY)
    globalThis.localStorage?.removeItem(LEGACY_CUT_PIECE_RETURN_STORAGE_KEY)
  } catch {
    // ignore
  }
}
