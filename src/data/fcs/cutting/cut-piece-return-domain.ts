import {
  completeSupplementOrder,
  getSupplementOrder,
  registerSupplementOrder,
  type SupplementMaterialDemand,
} from './supplement-order-registry.ts'

export type CutPieceReturnReceiptStatus = '待接收' | '已接收待清点' | '已确认退件'
export type CutPieceReturnDispositionStatus = '待处理' | '补料中' | '待重新齐套' | '已进入待交出仓' | '已关闭'
export type CutPieceReturnInventoryStatus = '退裁片在库' | '补料裁片到齐' | '已占用齐套' | '已报废' | '已进入待交出仓' | '已重新交出'
export type CutPieceReturnTicketPrintStatus = '待打印' | '已打印'

export interface CutPieceReturnPartDefinition {
  partCode: string
  partName: string
  piecesPerGarment: number
  sourceCutOrderId: string
  sourceCutOrderNo: string
  oldFeiTicketNo: string
  oldPhysicalTicketStatus: '有实物票' | '实物票缺失' | '实物票无法识别'
}

export interface CutPieceReturnReceiptPartCount {
  partCode: string
  partName: string
  pieceQty: number
  unit: '片'
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
  sourceType: '三方工厂退回' | '补料裁片'
  sourceRefNo: string
  partCode: string
  partName: string
  pieceQty: number
  allocatedPieceQty: number
  scrappedPieceQty: number
  status: CutPieceReturnInventoryStatus
  warehouseArea: '退裁片库区' | '裁床待交出仓' | '已交出'
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
  status: '进行中' | '已完成'
}

export interface CutPieceReturnSupplementPlan {
  planId: string
  finalMakeupGarmentQty: number
  unit: '件'
  partLines: CutPieceReturnSupplementPartLine[]
  supplementLinks: CutPieceReturnSupplementLink[]
  createdAt: string
  createdBy: string
  completedAt: string
}

export interface CutPieceReturnRekitBatch {
  rekitBatchId: string
  transferBagCode: string
  finalGarmentQty: number
  unit: '件'
  partCounts: CutPieceReturnReceiptPartCount[]
  stage: '待交出仓' | '已正式交出'
  createdAt: string
  createdBy: string
  handedOverAt: string
  handedOverBy: string
  handoverRecordNo: string
}

export interface CutPieceReturnLargeTicket {
  ticketId: string
  ticketNo: string
  partLines: CutPieceReturnReceiptPartCount[]
  printStatus: CutPieceReturnTicketPrintStatus
  createdAt: string
  createdBy: string
  printedAt: string
}

export interface CutPieceReturnResponsibilityEvent {
  eventId: string
  eventType: '首次交出齐套责任' | '确认退件扣减' | '重新交出增加责任'
  garmentQty: number
  occurredAt: string
  businessNo: string
}

export interface CutPieceReturnOperationLog {
  logId: string
  action: '来源责任冻结' | '确认退件' | '报废退裁片' | '创建补料计划' | '补料裁片到齐' | '重新齐套装袋' | '正式重新交出' | '生成退裁片大菲票' | '打印退裁片大菲票'
  businessNo: string
  quantityText: string
  operatedAt: string
  operatedBy: string
  note: string
}

export interface CutPieceReturnCase {
  caseId: string
  returnOrderNo: string
  sourceHandoverOrderId: string
  sourceHandoverOrderNo: string
  sourceHandoverRecordNo: string
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
  rekitBatches: CutPieceReturnRekitBatch[]
  largeTickets: CutPieceReturnLargeTicket[]
  responsibilityEvents: CutPieceReturnResponsibilityEvent[]
  operationLogs: CutPieceReturnOperationLog[]
  createdAt: string
  updatedAt: string
}

export interface CutPieceReturnResponsibilityProjection {
  frozenMinimumReturnQty: number
  confirmedReturnedGarmentQty: number
  rehandedOverGarmentQty: number
  currentExpectedReturnQty: number
  formulaText: string
}

export interface CutPieceReturnCaseProjection extends CutPieceReturnCase {
  responsibility: CutPieceReturnResponsibilityProjection
  returnZoneAvailablePieceQty: number
  waitHandoverPieceQty: number
  scrappedPieceQty: number
  latestSupplementOrderNos: string[]
}

interface CutPieceReturnStore {
  cases: CutPieceReturnCase[]
}

const CUT_PIECE_RETURN_STORAGE_KEY = 'higood:fcs:cutting:cut-piece-return:v1'

function nowText(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function positiveInteger(value: unknown, fieldName: string): number {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${fieldName}必须是大于 0 的整数。`)
  return number
}

function nonNegativeInteger(value: unknown, fieldName: string): number {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0) throw new Error(`${fieldName}必须是大于等于 0 的整数。`)
  return number
}

function stableToken(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  return Math.abs(hash).toString(36).toUpperCase()
}

function appendOperationLog(record: CutPieceReturnCase, input: Omit<CutPieceReturnOperationLog, 'logId'>): void {
  record.operationLogs.push({
    logId: `${record.caseId}-log-${record.operationLogs.length + 1}`,
    ...input,
  })
}

function seedPart(
  partCode: string,
  partName: string,
  sourceCutOrderNo: string,
  oldPhysicalTicketStatus: CutPieceReturnPartDefinition['oldPhysicalTicketStatus'],
): CutPieceReturnPartDefinition {
  return {
    partCode,
    partName,
    piecesPerGarment: 1,
    sourceCutOrderId: sourceCutOrderNo.toLowerCase(),
    sourceCutOrderNo,
    oldFeiTicketNo: `FT-${sourceCutOrderNo.replace(/[^0-9]/g, '').slice(-6)}-${partCode}`,
    oldPhysicalTicketStatus,
  }
}

function seedCase(options: {
  caseId: string
  returnOrderNo: string
  color: string
  size: string
  frozenMinimumReturnQty: number
  receipt?: { garmentQty: number; front: number; back: number; sleeve: number }
  readySupplement?: boolean
}): CutPieceReturnCase {
  const parts = [
    seedPart('FRONT', '前片', 'CUT-260306-101-01', options.receipt ? '实物票缺失' : '有实物票'),
    seedPart('BACK', '后片', 'CUT-260306-101-01', options.receipt ? '实物票无法识别' : '有实物票'),
    seedPart('SLEEVE', '袖片', 'CUT-260306-101-02', options.receipt ? '实物票缺失' : '有实物票'),
  ]
  const receivedAt = '2026-08-12 09:40:00'
  const receipt = options.receipt
    ? [{
        receiptId: `${options.caseId}-receipt-1`,
        returnedGarmentQty: options.receipt.garmentQty,
        unit: '件' as const,
        partCounts: [
          { partCode: 'FRONT', partName: '前片', pieceQty: options.receipt.front, unit: '片' as const },
          { partCode: 'BACK', partName: '后片', pieceQty: options.receipt.back, unit: '片' as const },
          { partCode: 'SLEEVE', partName: '袖片', pieceQty: options.receipt.sleeve, unit: '片' as const },
        ],
        differenceSummary: options.receipt.front === options.receipt.back && options.receipt.back === options.receipt.sleeve
          ? '部位数量一致'
          : `按件确认 ${options.receipt.garmentQty} 件；后片较确认退件数少 ${Math.max(options.receipt.garmentQty - options.receipt.back, 0)} 片，差异进入后续处理。`,
        confirmedAt: receivedAt,
        confirmedBy: '裁床退仓员',
        sourceFactoryName: 'PT Indo Sewing Center',
      }]
    : []
  const hasReceipt = receipt.length > 0
  const inventoryLots: CutPieceReturnInventoryLot[] = hasReceipt
    ? receipt[0].partCounts.filter((item) => item.pieceQty > 0).map((item, index) => ({
        lotId: `${options.caseId}-return-${index + 1}`,
        sourceType: '三方工厂退回',
        sourceRefNo: receipt[0].receiptId,
        partCode: item.partCode,
        partName: item.partName,
        pieceQty: item.pieceQty,
        allocatedPieceQty: 0,
        scrappedPieceQty: 0,
        status: '退裁片在库',
        warehouseArea: '退裁片库区',
        locationCode: `RETURN-A-${String(index + 1).padStart(2, '0')}`,
        receivedAt,
      }))
    : []
  const responsibilityEvents: CutPieceReturnResponsibilityEvent[] = [
    {
      eventId: `${options.caseId}-basis`,
      eventType: '首次交出齐套责任',
      garmentQty: options.frozenMinimumReturnQty,
      occurredAt: '2026-04-24 16:20:00',
      businessNo: 'JCD-260324-001',
    },
    ...(hasReceipt ? [{
      eventId: `${options.caseId}-return-1`,
      eventType: '确认退件扣减' as const,
      garmentQty: receipt[0].returnedGarmentQty,
      occurredAt: receivedAt,
      businessNo: receipt[0].receiptId,
    }] : []),
  ]
  const supplementPlans: CutPieceReturnSupplementPlan[] = options.readySupplement
    ? [{
        planId: `${options.caseId}-supplement-1`,
        finalMakeupGarmentQty: 18,
        unit: '件',
        partLines: [{
          partCode: 'BACK',
          partName: '后片',
          supplementPieceQty: 6,
          sourceCutOrderId: 'cut-260306-101-01',
          sourceCutOrderNo: 'CUT-260306-101-01',
        }],
        supplementLinks: [{
          supplementOrderId: `${options.caseId}-SUP-01`,
          supplementOrderNo: `BL-${options.returnOrderNo.slice(-6)}-01`,
          originalCutOrderId: 'cut-260306-101-01',
          originalCutOrderNo: 'CUT-260306-101-01',
          status: '已完成',
        }],
        createdAt: '2026-08-12 10:10:00',
        createdBy: '裁床主管',
        completedAt: '2026-08-12 13:30:00',
      }]
    : []
  if (options.readySupplement) {
    inventoryLots.push({
      lotId: `${options.caseId}-supplement-back`,
      sourceType: '补料裁片',
      sourceRefNo: supplementPlans[0].supplementLinks[0].supplementOrderNo,
      partCode: 'BACK',
      partName: '后片',
      pieceQty: 6,
      allocatedPieceQty: 0,
      scrappedPieceQty: 0,
      status: '补料裁片到齐',
      warehouseArea: '退裁片库区',
      locationCode: 'RETURN-A-02',
      receivedAt: '2026-08-12 13:30:00',
    })
  }
  const operationLogs: CutPieceReturnOperationLog[] = [{
    logId: `${options.caseId}-log-1`,
    action: '来源责任冻结',
    businessNo: 'JCR-260324-001-003',
    quantityText: `${options.frozenMinimumReturnQty} 件`,
    operatedAt: '2026-04-24 16:20:00',
    operatedBy: '裁床交出仓管',
    note: '以首次正式交出齐套数量冻结车缝工厂应回责任基数。',
  }]
  if (hasReceipt) {
    operationLogs.push({
      logId: `${options.caseId}-log-${operationLogs.length + 1}`,
      action: '确认退件',
      businessNo: receipt[0].receiptId,
      quantityText: `${receipt[0].returnedGarmentQty} 件 / ${receipt[0].partCounts.reduce((sum, item) => sum + item.pieceQty, 0)} 片`,
      operatedAt: receipt[0].confirmedAt,
      operatedBy: receipt[0].confirmedBy,
      note: receipt[0].differenceSummary,
    })
  }
  if (options.readySupplement) {
    operationLogs.push(
      {
        logId: `${options.caseId}-log-${operationLogs.length + 1}`,
        action: '创建补料计划',
        businessNo: supplementPlans[0].supplementLinks[0].supplementOrderNo,
        quantityText: '最终补齐 18 件 / 补裁 6 片',
        operatedAt: supplementPlans[0].createdAt,
        operatedBy: supplementPlans[0].createdBy,
        note: '后片补裁数量由裁床主管确认。',
      },
      {
        logId: `${options.caseId}-log-${operationLogs.length + 2}`,
        action: '补料裁片到齐',
        businessNo: supplementPlans[0].supplementLinks[0].supplementOrderNo,
        quantityText: '6 片',
        operatedAt: supplementPlans[0].completedAt,
        operatedBy: '补料完成员',
        note: '补料裁片进入退裁片库区，等待重新齐套。',
      },
    )
  }
  return {
    caseId: options.caseId,
    returnOrderNo: options.returnOrderNo,
    sourceHandoverOrderId: 'HO-CUT-SEW-260324-001',
    sourceHandoverOrderNo: 'JCD-260324-001',
    sourceHandoverRecordNo: 'JCR-260324-001-003',
    sourceFactoryId: 'sew-factory-01',
    sourceFactoryName: 'PT Indo Sewing Center',
    productionOrderId: 'po-202603-0102',
    productionOrderNo: 'PO-202603-0102',
    sewingTaskId: 'ST-260324-002',
    spuCode: 'SPU-2024-010',
    styleName: '弹力斜纹束脚裤',
    styleImageUrl: '/pants-sample.jpg',
    styleImageAlt: 'SPU-2024-010 弹力斜纹束脚裤款式图',
    materialSku: 'SPU_2024_010_MAIN',
    materialName: '弹力斜纹主面料',
    materialAlias: '面kainA',
    materialColor: options.color,
    materialImageUrl: options.color === 'Charcoal'
      ? '/materials/fei-ticket/charcoal-stretch-twill.png'
      : '/materials/fei-ticket/black-stretch-twill.png',
    materialImageAlt: `${options.color} 弹力斜纹主面料正式物料图`,
    garmentColor: options.color,
    size: options.size,
    frozenReleaseSnapshotId: 'cpr-target-po14671-v1',
    frozenMinimumReturnQty: options.frozenMinimumReturnQty,
    receiptStatus: hasReceipt ? '已确认退件' : '待接收',
    dispositionStatus: options.readySupplement ? '待重新齐套' : '待处理',
    parts,
    receipts: receipt,
    inventoryLots,
    supplementPlans,
    rekitBatches: [],
    largeTickets: [],
    responsibilityEvents,
    operationLogs,
    createdAt: '2026-08-12 09:00:00',
    updatedAt: options.readySupplement ? '2026-08-12 13:30:00' : hasReceipt ? receivedAt : '2026-08-12 09:00:00',
  }
}

function seedStore(): CutPieceReturnStore {
  return {
    cases: [
      seedCase({ caseId: 'cut-return-001', returnOrderNo: 'TH-260812-001', color: 'Black', size: 'M', frozenMinimumReturnQty: 200 }),
      seedCase({ caseId: 'cut-return-002', returnOrderNo: 'TH-260812-002', color: 'Black', size: 'L', frozenMinimumReturnQty: 350, receipt: { garmentQty: 12, front: 12, back: 10, sleeve: 12 } }),
      seedCase({ caseId: 'cut-return-003', returnOrderNo: 'TH-260812-003', color: 'Charcoal', size: 'XL', frozenMinimumReturnQty: 500, receipt: { garmentQty: 20, front: 20, back: 18, sleeve: 20 }, readySupplement: true }),
    ],
  }
}

function readStore(): CutPieceReturnStore {
  try {
    const raw = globalThis.localStorage?.getItem(CUT_PIECE_RETURN_STORAGE_KEY)
    if (!raw) return seedStore()
    const parsed = JSON.parse(raw) as Partial<CutPieceReturnStore>
    return Array.isArray(parsed.cases)
      ? {
          cases: parsed.cases.map((record) => ({
            ...record,
            operationLogs: Array.isArray(record.operationLogs) ? record.operationLogs : [],
          })),
        }
      : seedStore()
  } catch {
    return seedStore()
  }
}

let store = readStore()

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
  const confirmedReturnedGarmentQty = record.responsibilityEvents
    .filter((event) => event.eventType === '确认退件扣减')
    .reduce((sum, event) => sum + event.garmentQty, 0)
  const rehandedOverGarmentQty = record.responsibilityEvents
    .filter((event) => event.eventType === '重新交出增加责任')
    .reduce((sum, event) => sum + event.garmentQty, 0)
  const currentExpectedReturnQty = Math.max(record.frozenMinimumReturnQty + rehandedOverGarmentQty - confirmedReturnedGarmentQty, 0)
  return {
    frozenMinimumReturnQty: record.frozenMinimumReturnQty,
    confirmedReturnedGarmentQty,
    rehandedOverGarmentQty,
    currentExpectedReturnQty,
    formulaText: `${record.frozenMinimumReturnQty} 件（首次正式交出齐套责任） + ${rehandedOverGarmentQty} 件（后来正式再交出） - ${confirmedReturnedGarmentQty} 件（已确认退件） = ${currentExpectedReturnQty} 件`,
  }
}

function availableLotQty(lot: CutPieceReturnInventoryLot): number {
  return Math.max(lot.pieceQty - lot.allocatedPieceQty - lot.scrappedPieceQty, 0)
}

function projectCase(record: CutPieceReturnCase): CutPieceReturnCaseProjection {
  return {
    ...clone(record),
    responsibility: calculateCutPieceReturnResponsibility(record),
    returnZoneAvailablePieceQty: record.inventoryLots
      .filter((lot) => lot.warehouseArea === '退裁片库区')
      .reduce((sum, lot) => sum + availableLotQty(lot), 0),
    waitHandoverPieceQty: record.rekitBatches
      .filter((batch) => batch.stage === '待交出仓')
      .reduce((sum, batch) => sum + batch.partCounts.reduce((partSum, item) => partSum + item.pieceQty, 0), 0),
    scrappedPieceQty: record.inventoryLots.reduce((sum, lot) => sum + lot.scrappedPieceQty, 0),
    latestSupplementOrderNos: record.supplementPlans.flatMap((plan) => plan.supplementLinks.map((link) => link.supplementOrderNo)),
  }
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

export function confirmCutPieceReturnReceipt(input: {
  caseId: string
  returnedGarmentQty: number
  partCounts: Array<{ partCode: string; pieceQty: number }>
  confirmedBy: string
  confirmedAt?: string
}): CutPieceReturnCaseProjection {
  const record = findCaseMutable(input.caseId)
  const returnedGarmentQty = positiveInteger(input.returnedGarmentQty, '确认退件数量')
  const responsibility = calculateCutPieceReturnResponsibility(record)
  if (returnedGarmentQty > responsibility.currentExpectedReturnQty) {
    throw new Error(`本次确认退件 ${returnedGarmentQty} 件，超过当前应回 ${responsibility.currentExpectedReturnQty} 件，必须由主管处理。`)
  }
  const knownParts = new Map(record.parts.map((part) => [part.partCode, part]))
  const partCounts = input.partCounts.map((item) => {
    const part = knownParts.get(item.partCode)
    if (!part) throw new Error(`部位 ${item.partCode} 不属于本退仓单。`)
    return { partCode: part.partCode, partName: part.partName, pieceQty: nonNegativeInteger(item.pieceQty, `${part.partName}清点数量`), unit: '片' as const }
  })
  if (!partCounts.some((item) => item.pieceQty > 0)) throw new Error('至少需要清点到一个部位裁片。')
  const confirmedAt = input.confirmedAt || nowText()
  const receiptId = `${record.caseId}-receipt-${record.receipts.length + 1}`
  const differenceParts = partCounts
    .map((item) => ({ ...item, expected: returnedGarmentQty * (knownParts.get(item.partCode)?.piecesPerGarment || 1) }))
    .filter((item) => item.pieceQty !== item.expected)
  const receipt: CutPieceReturnReceipt = {
    receiptId,
    returnedGarmentQty,
    unit: '件',
    partCounts,
    differenceSummary: differenceParts.length
      ? `按件确认 ${returnedGarmentQty} 件；${differenceParts.map((item) => `${item.partName}${item.pieceQty < item.expected ? '少' : '多'} ${Math.abs(item.pieceQty - item.expected)} 片`).join('，')}，差异进入后续处理。`
      : '按件数量和各部位清点一致。',
    confirmedAt,
    confirmedBy: input.confirmedBy.trim() || '裁床退仓员',
    sourceFactoryName: record.sourceFactoryName,
  }
  record.receipts.push(receipt)
  partCounts.filter((item) => item.pieceQty > 0).forEach((item, index) => {
    record.inventoryLots.push({
      lotId: `${receiptId}-lot-${index + 1}`,
      sourceType: '三方工厂退回',
      sourceRefNo: receiptId,
      partCode: item.partCode,
      partName: item.partName,
      pieceQty: item.pieceQty,
      allocatedPieceQty: 0,
      scrappedPieceQty: 0,
      status: '退裁片在库',
      warehouseArea: '退裁片库区',
      locationCode: `RETURN-A-${String((record.inventoryLots.length % 8) + 1).padStart(2, '0')}`,
      receivedAt: confirmedAt,
    })
  })
  record.responsibilityEvents.push({
    eventId: `${receiptId}-responsibility`,
    eventType: '确认退件扣减',
    garmentQty: returnedGarmentQty,
    occurredAt: confirmedAt,
    businessNo: receiptId,
  })
  appendOperationLog(record, {
    action: '确认退件',
    businessNo: receiptId,
    quantityText: `${returnedGarmentQty} 件 / ${partCounts.reduce((sum, item) => sum + item.pieceQty, 0)} 片`,
    operatedAt: confirmedAt,
    operatedBy: receipt.confirmedBy,
    note: receipt.differenceSummary,
  })
  record.receiptStatus = '已确认退件'
  record.dispositionStatus = '待处理'
  record.updatedAt = confirmedAt
  persistStore()
  return projectCase(record)
}

export function scrapCutPieceReturnInventory(input: {
  caseId: string
  partCode: string
  pieceQty: number
  operatedBy: string
  operatedAt?: string
}): CutPieceReturnCaseProjection {
  const record = findCaseMutable(input.caseId)
  let remaining = positiveInteger(input.pieceQty, '报废数量')
  const candidates = record.inventoryLots.filter((lot) => lot.partCode === input.partCode && lot.warehouseArea === '退裁片库区' && availableLotQty(lot) > 0)
  const available = candidates.reduce((sum, lot) => sum + availableLotQty(lot), 0)
  if (remaining > available) throw new Error(`退裁片库区该部位仅有 ${available} 片可报废。`)
  candidates.forEach((lot) => {
    if (!remaining) return
    const quantity = Math.min(remaining, availableLotQty(lot))
    lot.scrappedPieceQty += quantity
    remaining -= quantity
    if (!availableLotQty(lot)) lot.status = '已报废'
  })
  const operatedAt = input.operatedAt || nowText()
  appendOperationLog(record, {
    action: '报废退裁片',
    businessNo: record.returnOrderNo,
    quantityText: `${input.pieceQty} 片`,
    operatedAt,
    operatedBy: input.operatedBy.trim() || '裁床主管',
    note: `${record.parts.find((part) => part.partCode === input.partCode)?.partName || input.partCode}从退裁片库区永久核销；不二次扣减车缝工厂应回责任。`,
  })
  record.updatedAt = operatedAt
  if (record.inventoryLots.every((lot) => !availableLotQty(lot))) record.dispositionStatus = '已关闭'
  persistStore()
  return projectCase(record)
}

function buildSupplementMaterialDemand(
  record: CutPieceReturnCase,
  link: CutPieceReturnSupplementLink,
  pieceQty: number,
): SupplementMaterialDemand {
  return {
    key: `${link.supplementOrderId}-material-main`,
    materialPatternMappingId: `${record.spuCode}-main-pattern`,
    sourceBomItemId: `${record.spuCode}-bom-main`,
    techPackVersionId: `${record.spuCode}-formal-v1`,
    materialSku: record.materialSku,
    materialName: record.materialName,
    materialTypeLabel: '主面料',
    materialImageUrl: record.materialImageUrl,
    materialImageAlt: record.materialImageAlt,
    materialAlias: record.materialAlias,
    materialRole: '面料A',
    roleSource: '退仓补裁按原裁片单冻结技术包展开',
    roleConfirmStatus: '已确认',
    patternId: `${record.spuCode}-pattern`,
    patternName: `${record.spuCode} 正式纸样`,
    requiredQty: Number(Math.max(pieceQty * 0.45, 0.1).toFixed(2)),
    unit: 'M',
    printRequired: false,
    dyeRequired: false,
    processNote: '退仓补裁关联原裁片单；实际领料仍按冻结 BOM、纸样排版和损耗在补料流程确认。',
    originalCutOrderId: link.originalCutOrderId,
    originalCutOrderNo: link.originalCutOrderNo,
    color: record.materialColor,
    spec: record.materialAlias,
    patternPart: '按补裁部位展开',
  }
}

function ensureSupplementRegistryLinks(record: CutPieceReturnCase): void {
  record.supplementPlans.forEach((plan) => {
    plan.supplementLinks.forEach((link) => {
      const lines = plan.partLines.filter((line) => line.sourceCutOrderNo === link.originalCutOrderNo)
      const totalPieceQty = lines.reduce((sum, line) => sum + line.supplementPieceQty, 0)
      if (!getSupplementOrder(link.supplementOrderId)) {
        registerSupplementOrder({
          id: link.supplementOrderId,
          recordNo: link.supplementOrderNo,
          cutOrderId: link.originalCutOrderId,
          cutOrderNo: link.originalCutOrderNo,
          productionOrderId: record.productionOrderId,
          productionOrderNo: record.productionOrderNo,
          reason: '裁片退仓后补裁',
          reasonDetail: `退仓单 ${record.returnOrderNo}；最终补齐 ${plan.finalMakeupGarmentQty} 件；${lines.map((line) => `${line.partName} ${line.supplementPieceQty} 片`).join('、')}。`,
          totalQty: plan.finalMakeupGarmentQty,
          lineSummary: `${record.garmentColor}/${record.size}/${plan.finalMakeupGarmentQty}件；${lines.map((line) => `${line.partName}${line.supplementPieceQty}片`).join('、')}`,
          lines: [{ color: record.garmentColor, size: record.size, supplementQty: plan.finalMakeupGarmentQty }],
          materialDemands: [buildSupplementMaterialDemand(record, link, totalPieceQty)],
          confirmationKey: `CUT_RETURN:${record.caseId}:${plan.planId}:${link.originalCutOrderNo}`,
          requestFingerprint: `${plan.finalMakeupGarmentQty}:${lines.map((line) => `${line.partCode}:${line.supplementPieceQty}`).join('|')}`,
          draftMeta: {
            candidateId: record.caseId,
            sourceType: 'cut-order',
            sourceNo: link.originalCutOrderNo,
            styleName: record.styleName,
            spuCode: record.spuCode,
            styleImageUrl: record.styleImageUrl,
            styleImageAlt: record.styleImageAlt,
          },
          materialPrepDemandId: `SUP-PREP:${link.supplementOrderId}`,
          supplyDecisionSnapshots: [],
          processWorkOrderRefs: [],
          createdPurchaseOrderRefs: [],
          createdAt: plan.createdAt,
          createdBy: plan.createdBy,
        })
      }
      if (plan.completedAt && getSupplementOrder(link.supplementOrderId)?.status === '未完成') {
        completeSupplementOrder({ id: link.supplementOrderId, completedAt: plan.completedAt, completedBy: '补料完成员' })
      }
    })
  })
}

export function createCutPieceReturnSupplementPlan(input: {
  caseId: string
  finalMakeupGarmentQty: number
  partLines: Array<{ partCode: string; supplementPieceQty: number }>
  createdBy: string
  createdAt?: string
}): CutPieceReturnCaseProjection {
  const record = findCaseMutable(input.caseId)
  if (record.receiptStatus !== '已确认退件') throw new Error('必须先确认退件件数和部位清点结果，才能创建补料。')
  const finalMakeupGarmentQty = positiveInteger(input.finalMakeupGarmentQty, '最终补齐件数')
  const partByCode = new Map(record.parts.map((part) => [part.partCode, part]))
  const partLines = input.partLines
    .map((line) => {
      const part = partByCode.get(line.partCode)
      if (!part) throw new Error(`部位 ${line.partCode} 不属于本退仓单。`)
      return {
        partCode: part.partCode,
        partName: part.partName,
        supplementPieceQty: nonNegativeInteger(line.supplementPieceQty, `${part.partName}补裁数量`),
        sourceCutOrderId: part.sourceCutOrderId,
        sourceCutOrderNo: part.sourceCutOrderNo,
      }
    })
    .filter((line) => line.supplementPieceQty > 0)
  if (!partLines.length) throw new Error('至少需要填写一个补裁部位及数量。')
  const createdAt = input.createdAt || nowText()
  const planId = `${record.caseId}-supplement-${record.supplementPlans.length + 1}`
  const groups = new Map<string, CutPieceReturnSupplementPartLine[]>()
  partLines.forEach((line) => groups.set(line.sourceCutOrderNo, [...(groups.get(line.sourceCutOrderNo) || []), line]))
  const supplementLinks = [...groups.entries()].map(([cutOrderNo, lines], index): CutPieceReturnSupplementLink => {
    const originalCutOrderId = lines[0].sourceCutOrderId
    const supplementOrderId = `${planId}-${stableToken(cutOrderNo)}`
    const supplementOrderNo = `BL-${record.returnOrderNo.replace(/[^0-9]/g, '').slice(-6)}-${String(index + 1).padStart(2, '0')}`
    const link: CutPieceReturnSupplementLink = {
      supplementOrderId,
      supplementOrderNo,
      originalCutOrderId,
      originalCutOrderNo: cutOrderNo,
      status: '进行中',
    }
    const totalPieceQty = lines.reduce((sum, line) => sum + line.supplementPieceQty, 0)
    registerSupplementOrder({
      id: supplementOrderId,
      recordNo: supplementOrderNo,
      cutOrderId: originalCutOrderId,
      cutOrderNo,
      productionOrderId: record.productionOrderId,
      productionOrderNo: record.productionOrderNo,
      reason: '裁片退仓后补裁',
      reasonDetail: `退仓单 ${record.returnOrderNo}；最终补齐 ${finalMakeupGarmentQty} 件；${lines.map((line) => `${line.partName} ${line.supplementPieceQty} 片`).join('、')}。补裁数量由操作人确认，不受退回部位清点数量上限约束。`,
      totalQty: finalMakeupGarmentQty,
      lineSummary: `${record.garmentColor}/${record.size}/${finalMakeupGarmentQty}件；${lines.map((line) => `${line.partName}${line.supplementPieceQty}片`).join('、')}`,
      lines: [{ color: record.garmentColor, size: record.size, supplementQty: finalMakeupGarmentQty }],
      materialDemands: [buildSupplementMaterialDemand(record, link, totalPieceQty)],
      confirmationKey: `CUT_RETURN:${record.caseId}:${planId}:${cutOrderNo}`,
      requestFingerprint: `${finalMakeupGarmentQty}:${lines.map((line) => `${line.partCode}:${line.supplementPieceQty}`).join('|')}`,
      draftMeta: {
        candidateId: record.caseId,
        sourceType: 'cut-order',
        sourceNo: cutOrderNo,
        styleName: record.styleName,
        spuCode: record.spuCode,
        styleImageUrl: record.styleImageUrl,
        styleImageAlt: record.styleImageAlt,
      },
      materialPrepDemandId: `SUP-PREP:${supplementOrderId}`,
      supplyDecisionSnapshots: [],
      processWorkOrderRefs: [],
      createdPurchaseOrderRefs: [],
      createdAt,
      createdBy: input.createdBy.trim() || '裁床主管',
    })
    return link
  })
  record.supplementPlans.push({
    planId,
    finalMakeupGarmentQty,
    unit: '件',
    partLines,
    supplementLinks,
    createdAt,
    createdBy: input.createdBy.trim() || '裁床主管',
    completedAt: '',
  })
  appendOperationLog(record, {
    action: '创建补料计划',
    businessNo: supplementLinks.map((link) => link.supplementOrderNo).join('、'),
    quantityText: `最终补齐 ${finalMakeupGarmentQty} 件 / 补裁 ${partLines.reduce((sum, line) => sum + line.supplementPieceQty, 0)} 片`,
    operatedAt: createdAt,
    operatedBy: input.createdBy.trim() || '裁床主管',
    note: `补裁部位与数量由本次人工确认；按 ${supplementLinks.length} 个原裁片单拆分补料单。`,
  })
  record.dispositionStatus = '补料中'
  record.updatedAt = createdAt
  persistStore()
  return projectCase(record)
}

export function completeCutPieceReturnSupplement(input: {
  caseId: string
  planId: string
  completedBy: string
  completedAt?: string
}): CutPieceReturnCaseProjection {
  const record = findCaseMutable(input.caseId)
  const plan = record.supplementPlans.find((item) => item.planId === input.planId)
  if (!plan) throw new Error('未找到对应补料计划。')
  if (plan.completedAt) return projectCase(record)
  const completedAt = input.completedAt || nowText()
  plan.supplementLinks.forEach((link) => {
    if (getSupplementOrder(link.supplementOrderId)?.status === '未完成') {
      completeSupplementOrder({ id: link.supplementOrderId, completedAt, completedBy: input.completedBy.trim() || '补料完成员' })
    }
    link.status = '已完成'
  })
  plan.partLines.forEach((line, index) => {
    record.inventoryLots.push({
      lotId: `${plan.planId}-lot-${index + 1}`,
      sourceType: '补料裁片',
      sourceRefNo: plan.supplementLinks.find((link) => link.originalCutOrderNo === line.sourceCutOrderNo)?.supplementOrderNo || plan.planId,
      partCode: line.partCode,
      partName: line.partName,
      pieceQty: line.supplementPieceQty,
      allocatedPieceQty: 0,
      scrappedPieceQty: 0,
      status: '补料裁片到齐',
      warehouseArea: '退裁片库区',
      locationCode: 'RETURN-A-08',
      receivedAt: completedAt,
    })
  })
  plan.completedAt = completedAt
  appendOperationLog(record, {
    action: '补料裁片到齐',
    businessNo: plan.supplementLinks.map((link) => link.supplementOrderNo).join('、'),
    quantityText: `${plan.partLines.reduce((sum, line) => sum + line.supplementPieceQty, 0)} 片`,
    operatedAt: completedAt,
    operatedBy: input.completedBy.trim() || '补料完成员',
    note: '补料裁片进入退裁片库区，等待与原退回裁片重新齐套。',
  })
  record.dispositionStatus = '待重新齐套'
  record.updatedAt = completedAt
  persistStore()
  return projectCase(record)
}

export function createCutPieceReturnRekitBatch(input: {
  caseId: string
  finalGarmentQty: number
  transferBagCode: string
  createdBy: string
  createdAt?: string
}): CutPieceReturnCaseProjection {
  const record = findCaseMutable(input.caseId)
  const finalGarmentQty = positiveInteger(input.finalGarmentQty, '本次重新齐套件数')
  const latestCompletedPlan = record.supplementPlans.filter((plan) => Boolean(plan.completedAt)).at(-1)
  if (latestCompletedPlan && finalGarmentQty !== latestCompletedPlan.finalMakeupGarmentQty) {
    throw new Error(`本次齐套 ${finalGarmentQty} 件与已确认补料计划的最终补齐 ${latestCompletedPlan.finalMakeupGarmentQty} 件不一致，请先重新确认补料计划。`)
  }
  if (!record.supplementPlans.some((plan) => Boolean(plan.completedAt)) && record.receipts.some((receipt) => receipt.differenceSummary !== '按件数量和各部位清点一致。')) {
    throw new Error('当前部位存在差异且补料尚未完成，不能重新齐套。')
  }
  const partCounts = record.parts.map((part) => ({
    partCode: part.partCode,
    partName: part.partName,
    pieceQty: finalGarmentQty * part.piecesPerGarment,
    unit: '片' as const,
  }))
  partCounts.forEach((required) => {
    const available = record.inventoryLots
      .filter((lot) => lot.partCode === required.partCode && lot.warehouseArea === '退裁片库区')
      .reduce((sum, lot) => sum + availableLotQty(lot), 0)
    if (available < required.pieceQty) throw new Error(`${required.partName}需要 ${required.pieceQty} 片，退裁片库区和已到齐补料合计仅 ${available} 片。`)
  })
  partCounts.forEach((required) => {
    let remaining = required.pieceQty
    record.inventoryLots
      .filter((lot) => lot.partCode === required.partCode && lot.warehouseArea === '退裁片库区' && availableLotQty(lot) > 0)
      .forEach((lot) => {
        if (!remaining) return
        const quantity = Math.min(remaining, availableLotQty(lot))
        lot.allocatedPieceQty += quantity
        lot.status = '已占用齐套'
        remaining -= quantity
      })
  })
  const createdAt = input.createdAt || nowText()
  const rekitBatchId = `${record.caseId}-rekit-${record.rekitBatches.length + 1}`
  const transferBagCode = input.transferBagCode.trim() || `BAG-RETURN-${record.returnOrderNo.slice(-3)}`
  record.rekitBatches.push({
    rekitBatchId,
    transferBagCode,
    finalGarmentQty,
    unit: '件',
    partCounts,
    stage: '待交出仓',
    createdAt,
    createdBy: input.createdBy.trim() || '裁片齐套员',
    handedOverAt: '',
    handedOverBy: '',
    handoverRecordNo: '',
  })
  appendOperationLog(record, {
    action: '重新齐套装袋',
    businessNo: transferBagCode,
    quantityText: `${finalGarmentQty} 件 / ${partCounts.reduce((sum, item) => sum + item.pieceQty, 0)} 片`,
    operatedAt: createdAt,
    operatedBy: input.createdBy.trim() || '裁片齐套员',
    note: '退回裁片与补料裁片按部位齐套后装入同一新中转袋，并转入裁床待交出仓；尚未增加工厂应回责任。',
  })
  record.dispositionStatus = '已进入待交出仓'
  record.updatedAt = createdAt
  persistStore()
  return projectCase(record)
}

export function confirmCutPieceReturnRehandover(input: {
  caseId: string
  rekitBatchId: string
  handedOverBy: string
  handedOverAt?: string
}): CutPieceReturnCaseProjection {
  const record = findCaseMutable(input.caseId)
  const batch = record.rekitBatches.find((item) => item.rekitBatchId === input.rekitBatchId)
  if (!batch) throw new Error('未找到待交出仓齐套批次。')
  if (batch.stage === '已正式交出') return projectCase(record)
  const handedOverAt = input.handedOverAt || nowText()
  const handoverRecordNo = `JCR-RETURN-${record.returnOrderNo.replace(/[^0-9]/g, '').slice(-6)}-${String(record.rekitBatches.filter((item) => item.stage === '已正式交出').length + 1).padStart(2, '0')}`
  batch.stage = '已正式交出'
  batch.handedOverAt = handedOverAt
  batch.handedOverBy = input.handedOverBy.trim() || '交出仓管'
  batch.handoverRecordNo = handoverRecordNo
  record.responsibilityEvents.push({
    eventId: `${batch.rekitBatchId}-responsibility`,
    eventType: '重新交出增加责任',
    garmentQty: batch.finalGarmentQty,
    occurredAt: handedOverAt,
    businessNo: handoverRecordNo,
  })
  appendOperationLog(record, {
    action: '正式重新交出',
    businessNo: handoverRecordNo,
    quantityText: `${batch.finalGarmentQty} 件`,
    operatedAt: handedOverAt,
    operatedBy: batch.handedOverBy,
    note: `中转袋 ${batch.transferBagCode} 已正式交给 ${record.sourceFactoryName}，本次件数加回车缝工厂应回责任。`,
  })
  record.dispositionStatus = record.rekitBatches.some((item) => item.stage === '待交出仓') ? '已进入待交出仓' : '已关闭'
  record.updatedAt = handedOverAt
  persistStore()
  return projectCase(record)
}

export function createCutPieceReturnLargeTicket(input: {
  caseId: string
  partCodes: string[]
  createdBy: string
  createdAt?: string
}): CutPieceReturnCaseProjection {
  const record = findCaseMutable(input.caseId)
  const selected = new Set(input.partCodes)
  const partLines = record.parts
    .filter((part) => selected.has(part.partCode))
    .map((part) => ({
      partCode: part.partCode,
      partName: part.partName,
      pieceQty: record.inventoryLots
        .filter((lot) => lot.partCode === part.partCode && lot.warehouseArea === '退裁片库区')
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
  store = seedStore()
  try {
    globalThis.localStorage?.removeItem(CUT_PIECE_RETURN_STORAGE_KEY)
  } catch {
    // ignore
  }
}
