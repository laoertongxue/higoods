import { productionOrders, type ProductionOrder } from '../production-orders.ts'
import { getProductionOrderTechPackSnapshot } from '../production-order-tech-pack-runtime.ts'
import type { ProductionOrderTechPackSnapshot } from '../production-tech-pack-snapshot-types.ts'
import { mockFactories, type Factory } from '../factory-mock-data.ts'
import type {
  FactoryWarehouseOutboundRecord,
  FactoryWaitHandoverStockItem,
} from '../factory-internal-warehouse.ts'
import {
  linkHandoverRecordToOutboundRecord,
  syncQuantityObjectionToOutboundRecord,
  syncReceiverWritebackToOutboundRecord,
} from '../factory-warehouse-linkage.ts'
import {
  createFactoryHandoverRecord,
  findPdaHandoverRecord,
  reportPdaHandoverQtyObjection,
  upsertPdaHandoutRecordMock,
  upsertPdaHandoverHeadMock,
  writeBackHandoverRecord,
  type PdaCutPieceHandoutLine,
  type PdaHandoverHead,
  type PdaHandoverRecord,
  type TransferBagFeiTicketWritebackLine,
  type TransferBagWritebackLine,
} from '../pda-handover-events.ts'
import { buildHandoverOrderQrValue } from '../task-qr.ts'
import {
  getFeiTicketByNo,
  listGeneratedFeiTickets,
  type GeneratedFeiTicketSourceRecord,
} from './generated-fei-tickets.ts'
import {
  getSpecialCraftFeiTicketSummary,
} from './special-craft-fei-ticket-flow.ts'

export type CuttingSewingDispatchOrderStatus =
  | '草稿'
  | '待配齐'
  | '待扫码'
  | '可交出'
  | '已交出'
  | '已回写'
  | '差异'
  | '异议中'
  | '已关闭'

export type CuttingSewingDispatchValidationStatus = '未校验' | '校验通过' | '校验未通过'
export type CuttingSewingDispatchBatchStatus = '草稿' | '待装袋' | '装袋中' | '已配齐' | '已交出' | '已回写' | '差异' | '异议中'
export type CuttingSewingCompletenessStatus = '未校验' | '未配齐' | '已配齐'
export type CuttingSewingTransferBagStatus = '待装袋' | '装袋中' | '已配齐' | '已交出' | '已回写' | '差异' | '异议中'
export type CuttingSewingTransferBagDispatchStatus = '未交出' | '已交出' | '已回写' | '差异' | '异议中'
export type CuttingSewingPieceLineCompleteStatus = '未配齐' | '已配齐' | '超出'
export type CuttingSewingSpecialCraftReturnStatus = '不需要特殊工艺' | '已回仓' | '未回仓' | '差异' | '异议中' | '待确认顺序'
export type CuttingSewingTransferBagPackStatus =
  | '待装袋'
  | '装袋中'
  | '已装袋'
  | '已交出'
  | '已扫码接收'
  | '部分回写'
  | '已回写'
  | '差异'
  | '异议中'
export type CuttingSewingTransferBagLocation =
  | '裁床厂待交出'
  | '运输中'
  | '下游工厂待接收'
  | '下游工厂已接收'
  | '差异待处理'

export interface CuttingSewingDispatchSkuQtyLine {
  lineId: string
  colorName: string
  colorCode: string
  sizeCode: string
  plannedGarmentQty: number
  dispatchedGarmentQty: number
  remainingGarmentQty: number
}

export interface CuttingSewingTransferBagPieceLine {
  pieceLineId: string
  partName: string
  colorName: string
  colorCode: string
  sizeCode: string
  pieceCountPerGarment: number
  garmentQty: number
  requiredPieceQty: number
  scannedPieceQty: number
  scannedFeiTicketNos: string[]
  missingPieceQty: number
  overPieceQty: number
  specialCraftRequired: boolean
  specialCraftReturnStatus: CuttingSewingSpecialCraftReturnStatus
  completeStatus: CuttingSewingPieceLineCompleteStatus
  remark?: string
}

export interface TransferBagContentItem {
  contentItemId: string
  transferBagId: string
  dispatchBatchId: string
  productionOrderId: string
  productionOrderNo: string
  contentType: '裁片菲票' | '物料行'
  sourceKind: 'FEI_TICKET' | 'LINE_ITEM'
  sourceId: string
  sourceNo?: string
  itemName: string
  materialSku?: string
  materialName?: string
  feiTicketNo?: string
  partName?: string
  colorName?: string
  sizeCode?: string
  rollNo?: string
  qty: number
  currentQty: number
  unit: string
  completedSpecialCraftNames?: string[]
  remark?: string
}

export interface CuttingSewingTransferBag {
  transferBagId: string
  transferBagNo: string
  transferBagQrValue: string
  dispatchOrderId: string
  dispatchBatchId: string
  transferOrderId: string
  transferOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  cuttingOrderIds: string[]
  cuttingOrderNos: string[]
  sewingFactoryId: string
  sewingFactoryName: string
  bagSequence: number
  plannedGarmentQty: number
  bagMode: '混装'
  skuQtyLines: CuttingSewingDispatchSkuQtyLine[]
  pieceLines: CuttingSewingTransferBagPieceLine[]
  scannedFeiTicketNos: string[]
  contentItems: TransferBagContentItem[]
  contentItemCount: number
  contentFeiTicketCount: number
  contentMaterialLineCount: number
  completeStatus: CuttingSewingCompletenessStatus
  dispatchStatus: CuttingSewingTransferBagDispatchStatus
  packStatus: CuttingSewingTransferBagPackStatus
  currentLocation: CuttingSewingTransferBagLocation
  editableBeforeHandover: boolean
  packedBy?: string
  packedAt?: string
  lastPackedAt?: string
  handoverSubmittedAt?: string
  receivedAt?: string
  receivedBy?: string
  expectedBagQty?: number
  expectedFeiTicketCount?: number
  receivedFeiTicketCount?: number
  bagDifferenceReason?: string
  itemDifferenceReason?: string
  receiverWrittenQty?: number
  differenceQty?: number
  status: CuttingSewingTransferBagStatus
  createdAt: string
  updatedAt: string
}

export interface CuttingSewingDispatchBatch {
  dispatchBatchId: string
  dispatchBatchNo: string
  dispatchOrderId: string
  productionOrderId: string
  productionOrderNo: string
  transferOrderId: string
  transferOrderNo: string
  transferOrderQrValue: string
  plannedGarmentQty: number
  plannedSkuQtyLines: CuttingSewingDispatchSkuQtyLine[]
  transferBagIds: string[]
  feiTicketNos: string[]
  completeStatus: CuttingSewingCompletenessStatus
  handoverRecordId?: string
  handoverRecordNo?: string
  receiverWrittenQty?: number
  differenceQty?: number
  status: CuttingSewingDispatchBatchStatus
  createdAt: string
  updatedAt: string
}

export interface CuttingSewingDispatchOrder {
  dispatchOrderId: string
  dispatchOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  cuttingOrderIds: string[]
  cuttingOrderNos: string[]
  cuttingFactoryId: string
  cuttingFactoryName: string
  sewingFactoryId: string
  sewingFactoryName: string
  totalProductionQty: number
  plannedDispatchGarmentQty: number
  cumulativeDispatchedGarmentQty: number
  remainingGarmentQty: number
  currentBatchId?: string
  dispatchBatchIds: string[]
  transferOrderIds: string[]
  transferBagIds: string[]
  feiTicketNos: string[]
  handoverOrderId?: string
  handoverOrderNo?: string
  handoverRecordIds: string[]
  receiverWrittenQty?: number
  differenceQty?: number
  status: CuttingSewingDispatchOrderStatus
  validationStatus: CuttingSewingDispatchValidationStatus
  validationMessages: string[]
  createdAt: string
  updatedAt: string
  remark?: string
}

export interface CuttingSewingDispatchValidationResult {
  validationId: string
  dispatchOrderId: string
  dispatchBatchId: string
  transferBagId: string
  productionOrderId: string
  productionOrderNo: string
  colorName: string
  sizeCode: string
  partName: string
  requiredPieceQty: number
  scannedPieceQty: number
  missingPieceQty: number
  overPieceQty: number
  specialCraftRequired: boolean
  specialCraftStatus: CuttingSewingSpecialCraftReturnStatus
  validationType:
    | '缺少裁片'
    | '裁片超出'
    | '特殊工艺未回仓'
    | '特殊工艺差异'
    | '特殊工艺异议中'
    | '菲票重复'
    | '菲票不属于本生产单'
    | '菲票颜色不匹配'
    | '菲票尺码不匹配'
    | '菲票部位不匹配'
    | '菲票已发出'
    | '中转袋未配齐'
    | '通过'
  validationMessage: string
  blocking: boolean
}

interface RequiredCutPieceLine {
  partName: string
  colorName: string
  colorCode: string
  sizeCode: string
  pieceCountPerGarment: number
  garmentQty: number
  requiredPieceQty: number
  specialCraftRequired: boolean
  specialCraftReturnStatus: CuttingSewingSpecialCraftReturnStatus
}

interface CuttingSewingDispatchStore {
  dispatchOrders: CuttingSewingDispatchOrder[]
  dispatchBatches: CuttingSewingDispatchBatch[]
  transferBags: CuttingSewingTransferBag[]
  validationResults: CuttingSewingDispatchValidationResult[]
}

interface CreateDispatchOrderInput {
  productionOrderId: string
  cuttingFactoryId?: string
  sewingFactoryId?: string
  remark?: string
}

interface CreateDispatchBatchInput {
  dispatchOrderId: string
  plannedSkuQtyLines: Array<{
    colorName: string
    colorCode?: string
    sizeCode: string
    plannedGarmentQty: number
  }>
}

interface CreateTransferBagInput {
  dispatchBatchId: string
  bagPlanList: Array<{
    plannedGarmentQty: number
    skuQtyLines: CuttingSewingDispatchSkuQtyLine[]
  }>
}

let store: CuttingSewingDispatchStore | null = null

function clone<T>(value: T): T {
  return structuredClone(value)
}

function nowText(): string {
  return '2026-04-23 10:00:00'
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeText(value: string | null | undefined): string {
  return String(value || '').trim()
}

function makeQrValue(prefix: string, value: string): string {
  return `${prefix}:${value}:二维码`
}

function getCuttingFactory(): Factory {
  return (
    mockFactories.find((factory) => factory.factoryType === 'CENTRAL_CUTTING') ||
    mockFactories.find((factory) => factory.name.includes('裁床')) ||
    mockFactories[0]
  )
}

function getSewingFactory(): Factory {
  return (
    mockFactories.find((factory) => factory.factoryType === 'SATELLITE_SEWING') ||
    mockFactories.find((factory) => factory.factoryType === 'CENTRAL_GARMENT') ||
    mockFactories.find((factory) => factory.name.includes('车缝')) ||
    mockFactories[0]
  )
}

function getProductionOrder(productionOrderId: string): ProductionOrder {
  const order = productionOrders.find((item) => item.productionOrderId === productionOrderId)
  if (!order) throw new Error(`未找到生产单：${productionOrderId}`)
  return order
}

function getTotalProductionQty(order: ProductionOrder): number {
  const skuTotal = sum(order.demandSnapshot.skuLines.map((line) => line.qty || 0))
  return order.planQty || skuTotal || 0
}

function getOrderSkuRemainingQty(order: ProductionOrder, colorName: string, sizeCode: string): number {
  const total = sum(
    order.demandSnapshot.skuLines
      .filter((line) => line.color === colorName && line.size === sizeCode)
      .map((line) => line.qty || 0),
  )
  const dispatched = ensureCuttingSewingDispatchSeeded().dispatchBatches
    .filter((batch) => batch.productionOrderId === order.productionOrderId && batch.status !== '差异' && batch.status !== '异议中')
    .flatMap((batch) => batch.plannedSkuQtyLines)
    .filter((line) => line.colorName === colorName && line.sizeCode === sizeCode)
    .reduce((totalQty, line) => totalQty + line.plannedGarmentQty, 0)
  return Math.max(total - dispatched, 0)
}

function isColorApplicable(applicableColorList: string[], colorName: string): boolean {
  if (!applicableColorList.length) return true
  return applicableColorList.includes(colorName) || applicableColorList.includes('按 SKU 适配')
}

function mapSpecialCraftReturnStatus(feiTicketNo: string): {
  specialCraftRequired: boolean
  specialCraftReturnStatus: CuttingSewingSpecialCraftReturnStatus
} {
  const specialCraftSummary = getSpecialCraftFeiTicketSummary(feiTicketNo)
  if (!specialCraftSummary.needSpecialCraft) {
    return { specialCraftRequired: false, specialCraftReturnStatus: '不需要特殊工艺' }
  }
  // 特殊工艺差异待处理不阻断裁片统一发料：最后一道已回仓、当前所在为裁床厂待交出仓且 currentQty > 0，即可进入齐套校验。
  if (specialCraftSummary.returnStatus.includes('已回仓') && specialCraftSummary.currentLocation === '裁床厂待交出仓' && specialCraftSummary.currentQty > 0) {
    return { specialCraftRequired: true, specialCraftReturnStatus: '已回仓' }
  }
  if (specialCraftSummary.returnStatus === '差异') return { specialCraftRequired: true, specialCraftReturnStatus: '差异' }
  if (specialCraftSummary.returnStatus === '异议中') return { specialCraftRequired: true, specialCraftReturnStatus: '异议中' }
  if (specialCraftSummary.returnStatus === '待确认顺序') return { specialCraftRequired: true, specialCraftReturnStatus: '待确认顺序' }
  return { specialCraftRequired: true, specialCraftReturnStatus: '未回仓' }
}

function getTicketQty(ticket: GeneratedFeiTicketSourceRecord): number {
  return Math.max(ticket.qty || ticket.actualCutPieceQty || 0, 0)
}

function getTicketDispatchQty(ticket: GeneratedFeiTicketSourceRecord): number {
  const summary = getSpecialCraftFeiTicketSummary(ticket.feiTicketNo)
  if (summary.needSpecialCraft && summary.returnStatus.includes('已回仓')) {
    return Math.max(summary.currentQty, 0)
  }
  return getTicketQty(ticket)
}

function buildContentItemFromFeiTicket(
  bag: CuttingSewingTransferBag,
  ticket: GeneratedFeiTicketSourceRecord,
): TransferBagContentItem {
  const summary = getSpecialCraftFeiTicketSummary(ticket.feiTicketNo)
  return {
    contentItemId: `TBCI-${bag.transferBagId}-${ticket.feiTicketNo}`,
    transferBagId: bag.transferBagId,
    dispatchBatchId: bag.dispatchBatchId,
    productionOrderId: bag.productionOrderId,
    productionOrderNo: bag.productionOrderNo,
    contentType: '裁片菲票',
    sourceKind: 'FEI_TICKET',
    sourceId: ticket.feiTicketNo,
    sourceNo: ticket.feiTicketNo,
    itemName: ticket.partName || '裁片',
    feiTicketNo: ticket.feiTicketNo,
    partName: ticket.partName,
    colorName: ticket.garmentColor,
    sizeCode: ticket.skuSize,
    rollNo: ticket.fabricRollNo,
    qty: getTicketDispatchQty(ticket),
    currentQty: getTicketDispatchQty(ticket),
    unit: '片',
    completedSpecialCraftNames: summary.completedOperationNames,
  }
}

function normalizeTransferBagRuntimeFields(bag: CuttingSewingTransferBag): void {
  bag.bagMode = bag.bagMode || '混装'
  bag.contentItems = bag.contentItems || []
  bag.scannedFeiTicketNos.forEach((feiTicketNo) => {
    if (bag.contentItems.some((item) => item.sourceKind === 'FEI_TICKET' && item.feiTicketNo === feiTicketNo)) return
    const ticket = getFeiTicketByNo(feiTicketNo)
    if (ticket) bag.contentItems.push(buildContentItemFromFeiTicket(bag, ticket))
  })
  bag.contentItemCount = bag.contentItems.length
  bag.contentFeiTicketCount = bag.contentItems.filter((item) => item.sourceKind === 'FEI_TICKET').length
  bag.contentMaterialLineCount = bag.contentItems.filter((item) => item.sourceKind === 'LINE_ITEM').length
  bag.expectedBagQty = bag.expectedBagQty ?? 1
  bag.expectedFeiTicketCount = bag.contentFeiTicketCount
  bag.receivedFeiTicketCount = bag.receivedFeiTicketCount ?? (bag.packStatus === '已扫码接收' || bag.status === '已回写' ? bag.contentFeiTicketCount : 0)
  bag.packStatus =
    bag.packStatus ||
    (bag.status === '已回写'
      ? '已回写'
      : bag.status === '差异'
        ? '差异'
        : bag.status === '异议中'
          ? '异议中'
          : bag.status === '已交出'
            ? '已交出'
            : bag.scannedFeiTicketNos.length
              ? '装袋中'
              : '待装袋')
  bag.currentLocation =
    bag.currentLocation ||
    (bag.status === '已回写'
      ? '下游工厂已接收'
      : bag.status === '差异'
        ? '差异待处理'
        : bag.status === '已交出'
          ? '下游工厂待接收'
          : '裁床厂待交出')
  bag.editableBeforeHandover = bag.dispatchStatus === '未交出' && !bag.handoverSubmittedAt && !bag.receivedAt
}

function findTransferBagById(storeRef: CuttingSewingDispatchStore, transferBagId: string): CuttingSewingTransferBag {
  const bag = storeRef.transferBags.find((item) => item.transferBagId === transferBagId)
  if (!bag) throw new Error(`未找到中转袋：${transferBagId}`)
  return bag
}

function findDispatchBatchById(storeRef: CuttingSewingDispatchStore, dispatchBatchId: string): CuttingSewingDispatchBatch {
  const batch = storeRef.dispatchBatches.find((item) => item.dispatchBatchId === dispatchBatchId)
  if (!batch) throw new Error(`未找到本次发料：${dispatchBatchId}`)
  return batch
}

function findDispatchOrderById(storeRef: CuttingSewingDispatchStore, dispatchOrderId: string): CuttingSewingDispatchOrder {
  const order = storeRef.dispatchOrders.find((item) => item.dispatchOrderId === dispatchOrderId)
  if (!order) throw new Error(`未找到发料单：${dispatchOrderId}`)
  return order
}

function getOccupiedFeiTicketNos(options?: { excludeBagId?: string }): Set<string> {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const occupied = new Set<string>()
  storeRef.transferBags.forEach((bag) => {
    if (options?.excludeBagId && bag.transferBagId === options.excludeBagId) return
    if (bag.status === '已回写' || bag.status === '差异' || bag.status === '异议中') {
      bag.scannedFeiTicketNos.forEach((feiTicketNo) => occupied.add(feiTicketNo))
      return
    }
    if (bag.status !== '待装袋') {
      bag.scannedFeiTicketNos.forEach((feiTicketNo) => occupied.add(feiTicketNo))
    }
  })
  return occupied
}

function getRequiredLinesForBag(batch: CuttingSewingDispatchBatch): RequiredCutPieceLine[] {
  const order = getProductionOrder(batch.productionOrderId)
  const snapshot = getProductionOrderTechPackSnapshot(batch.productionOrderId)
  const result = buildRequiredCutPiecesForSewingDispatch(order, snapshot, batch.plannedSkuQtyLines)
  return result.requiredPieceLines
}

function buildPieceLineFromRequiredLine(requiredLine: RequiredCutPieceLine, bagId: string, index: number): CuttingSewingTransferBagPieceLine {
  return {
    pieceLineId: `${bagId}-PIECE-${String(index + 1).padStart(3, '0')}`,
    partName: requiredLine.partName,
    colorName: requiredLine.colorName,
    colorCode: requiredLine.colorCode,
    sizeCode: requiredLine.sizeCode,
    pieceCountPerGarment: requiredLine.pieceCountPerGarment,
    garmentQty: requiredLine.garmentQty,
    requiredPieceQty: requiredLine.requiredPieceQty,
    scannedPieceQty: 0,
    scannedFeiTicketNos: [],
    missingPieceQty: requiredLine.requiredPieceQty,
    overPieceQty: 0,
    specialCraftRequired: requiredLine.specialCraftRequired,
    specialCraftReturnStatus: requiredLine.specialCraftReturnStatus,
    completeStatus: '未配齐',
  }
}

function updateDispatchOrderFromChildren(order: CuttingSewingDispatchOrder): void {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const batches = storeRef.dispatchBatches.filter((batch) => order.dispatchBatchIds.includes(batch.dispatchBatchId))
  const bags = storeRef.transferBags.filter((bag) => order.transferBagIds.includes(bag.transferBagId))
  order.cumulativeDispatchedGarmentQty = sum(
    batches
      .filter((batch) => batch.status === '已交出' || batch.status === '已回写' || batch.status === '差异' || batch.status === '异议中')
      .map((batch) => batch.plannedGarmentQty),
  )
  order.remainingGarmentQty = Math.max(order.totalProductionQty - order.cumulativeDispatchedGarmentQty, 0)
  order.feiTicketNos = unique(bags.flatMap((bag) => bag.scannedFeiTicketNos))
  order.receiverWrittenQty = sum(batches.map((batch) => batch.receiverWrittenQty || 0))
  order.differenceQty = sum(batches.map((batch) => batch.differenceQty || 0))
  order.validationStatus = batches.every((batch) => batch.completeStatus === '已配齐') ? '校验通过' : '校验未通过'
  order.validationMessages = unique(
    storeRef.validationResults
      .filter((item) => item.dispatchOrderId === order.dispatchOrderId && item.blocking)
      .map((item) => item.validationMessage),
  )
  if (batches.some((batch) => batch.status === '异议中')) order.status = '异议中'
  else if (batches.some((batch) => batch.status === '差异')) order.status = '差异'
  else if (batches.length && batches.every((batch) => batch.status === '已回写')) order.status = '已回写'
  else if (batches.some((batch) => batch.status === '已交出')) order.status = '已交出'
  else if (batches.some((batch) => batch.completeStatus === '已配齐')) order.status = '可交出'
  else if (batches.some((batch) => batch.status === '装袋中' || batch.status === '待装袋')) order.status = '待扫码'
  else order.status = '待配齐'
  order.updatedAt = nowText()
}

export function buildRequiredCutPiecesForSewingDispatch(
  productionOrder: ProductionOrder,
  techPackSnapshot: ProductionOrderTechPackSnapshot | null,
  plannedSkuQtyLines: CuttingSewingDispatchSkuQtyLine[],
): {
  requiredPieceLines: RequiredCutPieceLine[]
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  if (!productionOrder) errors.push('生产单缺失')
  if (!techPackSnapshot) errors.push('技术包快照缺失')
  if (!techPackSnapshot?.cutPieceParts?.length) errors.push('纸样裁片明细缺失')

  const tickets = listGeneratedFeiTickets().filter((ticket) => ticket.productionOrderId === productionOrder.productionOrderId)
  const lines: RequiredCutPieceLine[] = []
  const seen = new Set<string>()

  for (const plannedLine of plannedSkuQtyLines) {
    if (plannedLine.plannedGarmentQty <= 0) {
      errors.push('本次发料件数必须大于 0')
      continue
    }
    const sourceSkuQty = productionOrder.demandSnapshot.skuLines
      .filter((line) => line.color === plannedLine.colorName && line.size === plannedLine.sizeCode)
      .reduce((total, line) => total + line.qty, 0)
    if (sourceSkuQty <= 0) {
      errors.push(`生产单缺少 ${plannedLine.colorName} / ${plannedLine.sizeCode} 数量`)
      continue
    }
    if (plannedLine.plannedGarmentQty > sourceSkuQty) {
      errors.push('本次发料成衣件数超过生产单剩余未发成衣件数')
    }
    const ticketPartNames = new Set(
      tickets
        .filter((ticket) => ticket.garmentColor === plannedLine.colorName && ticket.skuSize === plannedLine.sizeCode)
        .map((ticket) => ticket.partName),
    )
    const candidateParts = (techPackSnapshot?.cutPieceParts || [])
      .filter((part) => !part.applicableSizeList.length || part.applicableSizeList.includes(plannedLine.sizeCode))
      .filter((part) => isColorApplicable(part.applicableColorList, plannedLine.colorName))
      .filter((part) => part.partNameCn && part.pieceCountPerGarment > 0)

    for (const part of candidateParts) {
      if (!ticketPartNames.has(part.partNameCn)) {
        warnings.push(`裁片部位 ${part.partNameCn} 暂无匹配菲票，当前批次先按可扫码部位齐套。`)
        continue
      }
      const key = `${plannedLine.colorName}|${plannedLine.sizeCode}|${part.partNameCn}`
      if (seen.has(key)) continue
      seen.add(key)
      const sampleTicket = tickets.find(
        (ticket) =>
          ticket.garmentColor === plannedLine.colorName &&
          ticket.skuSize === plannedLine.sizeCode &&
          ticket.partName === part.partNameCn,
      )
      const specialCraft = sampleTicket
        ? mapSpecialCraftReturnStatus(sampleTicket.feiTicketNo)
        : { specialCraftRequired: false, specialCraftReturnStatus: '不需要特殊工艺' as const }
      lines.push({
        partName: part.partNameCn,
        colorName: plannedLine.colorName,
        colorCode: plannedLine.colorCode,
        sizeCode: plannedLine.sizeCode,
        pieceCountPerGarment: part.pieceCountPerGarment,
        garmentQty: plannedLine.plannedGarmentQty,
        requiredPieceQty: plannedLine.plannedGarmentQty * part.pieceCountPerGarment,
        specialCraftRequired: specialCraft.specialCraftRequired,
        specialCraftReturnStatus: specialCraft.specialCraftReturnStatus,
      })
    }
  }

  return { requiredPieceLines: lines, errors, warnings }
}

export function getEligibleFeiTicketsForSewingDispatch(input: {
  productionOrderId: string
  colorName?: string
  sizeCode?: string
  partName?: string
  excludeBagId?: string
}): GeneratedFeiTicketSourceRecord[] {
  const occupied = getOccupiedFeiTicketNos({ excludeBagId: input.excludeBagId })
  return listGeneratedFeiTickets().filter((ticket) => {
    if (ticket.productionOrderId !== input.productionOrderId) return false
    if (input.colorName && ticket.garmentColor !== input.colorName) return false
    if (input.sizeCode && ticket.skuSize !== input.sizeCode) return false
    if (input.partName && ticket.partName !== input.partName) return false
    if (occupied.has(ticket.feiTicketNo)) return false
    const specialCraft = mapSpecialCraftReturnStatus(ticket.feiTicketNo)
    if (!specialCraft.specialCraftRequired) return true
    return specialCraft.specialCraftReturnStatus === '已回仓'
  })
}

export function createCuttingSewingDispatchOrder(input: CreateDispatchOrderInput): CuttingSewingDispatchOrder {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const productionOrder = getProductionOrder(input.productionOrderId)
  const cuttingFactory = input.cuttingFactoryId
    ? mockFactories.find((factory) => factory.id === input.cuttingFactoryId) || getCuttingFactory()
    : getCuttingFactory()
  const sewingFactory = input.sewingFactoryId
    ? mockFactories.find((factory) => factory.id === input.sewingFactoryId) || getSewingFactory()
    : getSewingFactory()
  const tickets = listGeneratedFeiTickets().filter((ticket) => ticket.productionOrderId === productionOrder.productionOrderId)
  const dispatchIndex = storeRef.dispatchOrders.length + 1
  const createdAt = nowText()
  const order: CuttingSewingDispatchOrder = {
    dispatchOrderId: `CSDO-${productionOrder.productionOrderId}-${String(dispatchIndex).padStart(2, '0')}`,
    dispatchOrderNo: `CPFL-${productionOrder.productionOrderNo}-${String(dispatchIndex).padStart(2, '0')}`,
    productionOrderId: productionOrder.productionOrderId,
    productionOrderNo: productionOrder.productionOrderNo,
    cuttingOrderIds: unique(tickets.map((ticket) => ticket.originalCutOrderId)),
    cuttingOrderNos: unique(tickets.map((ticket) => ticket.originalCutOrderNo)),
    cuttingFactoryId: cuttingFactory.id,
    cuttingFactoryName: cuttingFactory.name,
    sewingFactoryId: sewingFactory.id,
    sewingFactoryName: sewingFactory.name.includes('车缝') ? sewingFactory.name : `${sewingFactory.name}车缝厂`,
    totalProductionQty: getTotalProductionQty(productionOrder),
    plannedDispatchGarmentQty: 0,
    cumulativeDispatchedGarmentQty: 0,
    remainingGarmentQty: getTotalProductionQty(productionOrder),
    dispatchBatchIds: [],
    transferOrderIds: [],
    transferBagIds: [],
    feiTicketNos: [],
    handoverRecordIds: [],
    status: '草稿',
    validationStatus: '未校验',
    validationMessages: [],
    createdAt,
    updatedAt: createdAt,
    remark: input.remark,
  }
  storeRef.dispatchOrders.push(order)
  return clone(order)
}

export function createCuttingSewingDispatchBatch(input: CreateDispatchBatchInput): CuttingSewingDispatchBatch {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const order = findDispatchOrderById(storeRef, input.dispatchOrderId)
  const productionOrder = getProductionOrder(order.productionOrderId)
  const normalizedLines = input.plannedSkuQtyLines
    .filter((line) => line.plannedGarmentQty > 0)
    .map((line, index) => ({
      lineId: `${input.dispatchOrderId}-SKU-${String(index + 1).padStart(3, '0')}`,
      colorName: line.colorName,
      colorCode: line.colorCode || line.colorName,
      sizeCode: line.sizeCode,
      plannedGarmentQty: line.plannedGarmentQty,
      dispatchedGarmentQty: 0,
      remainingGarmentQty: getOrderSkuRemainingQty(productionOrder, line.colorName, line.sizeCode),
    }))
  if (!normalizedLines.length) throw new Error('至少需要一行本次发料颜色 / 尺码 / 件数')
  const overLine = normalizedLines.find((line) => line.plannedGarmentQty > line.remainingGarmentQty && line.remainingGarmentQty > 0)
  if (overLine) throw new Error('本次发料成衣件数超过生产单剩余未发成衣件数')

  const batchIndex = order.dispatchBatchIds.length + 1
  const createdAt = nowText()
  const batch: CuttingSewingDispatchBatch = {
    dispatchBatchId: `CSDB-${order.productionOrderId}-${String(batchIndex).padStart(2, '0')}`,
    dispatchBatchNo: `PC-${order.productionOrderNo}-${String(batchIndex).padStart(2, '0')}`,
    dispatchOrderId: order.dispatchOrderId,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    transferOrderId: `CTO-${order.productionOrderId}-${String(batchIndex).padStart(2, '0')}`,
    transferOrderNo: `ZZD-${order.productionOrderNo}-${String(batchIndex).padStart(2, '0')}`,
    transferOrderQrValue: makeQrValue('CUT-SEW-TRANSFER-ORDER', `${order.productionOrderNo}-${batchIndex}`),
    plannedGarmentQty: sum(normalizedLines.map((line) => line.plannedGarmentQty)),
    plannedSkuQtyLines: normalizedLines,
    transferBagIds: [],
    feiTicketNos: [],
    completeStatus: '未校验',
    status: '待装袋',
    createdAt,
    updatedAt: createdAt,
  }
  storeRef.dispatchBatches.push(batch)
  order.currentBatchId = batch.dispatchBatchId
  order.dispatchBatchIds.push(batch.dispatchBatchId)
  order.transferOrderIds.push(batch.transferOrderId)
  order.plannedDispatchGarmentQty += batch.plannedGarmentQty
  order.status = '待扫码'
  order.updatedAt = createdAt
  return clone(batch)
}

export function createCuttingSewingTransferBags(input: CreateTransferBagInput): CuttingSewingTransferBag[] {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const batch = findDispatchBatchById(storeRef, input.dispatchBatchId)
  const order = findDispatchOrderById(storeRef, batch.dispatchOrderId)
  const requiredLines = getRequiredLinesForBag(batch)
  const createdAt = nowText()
  const created = input.bagPlanList.map((plan, index) => {
    const bagSequence = batch.transferBagIds.length + index + 1
    const bagId = `CSTB-${batch.dispatchBatchId}-${String(bagSequence).padStart(2, '0')}`
    const pieceLines = requiredLines
      .filter((line) => plan.skuQtyLines.some((skuLine) => skuLine.colorName === line.colorName && skuLine.sizeCode === line.sizeCode))
      .map((line, lineIndex) => buildPieceLineFromRequiredLine(line, bagId, lineIndex))
    const bag: CuttingSewingTransferBag = {
      transferBagId: bagId,
      transferBagNo: `ZZD-BAG-${batch.transferOrderNo}-${String(bagSequence).padStart(2, '0')}`,
      transferBagQrValue: makeQrValue('CUT-SEW-TRANSFER-BAG', `${batch.transferOrderNo}-${bagSequence}`),
      dispatchOrderId: order.dispatchOrderId,
      dispatchBatchId: batch.dispatchBatchId,
      transferOrderId: batch.transferOrderId,
      transferOrderNo: batch.transferOrderNo,
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
      cuttingOrderIds: [...order.cuttingOrderIds],
      cuttingOrderNos: [...order.cuttingOrderNos],
      sewingFactoryId: order.sewingFactoryId,
      sewingFactoryName: order.sewingFactoryName,
      bagSequence,
      plannedGarmentQty: plan.plannedGarmentQty,
      bagMode: '混装',
      skuQtyLines: plan.skuQtyLines.map((line) => ({ ...line })),
      pieceLines,
      scannedFeiTicketNos: [],
      contentItems: [],
      contentItemCount: 0,
      contentFeiTicketCount: 0,
      contentMaterialLineCount: 0,
      completeStatus: '未校验',
      dispatchStatus: '未交出',
      packStatus: '待装袋',
      currentLocation: '裁床厂待交出',
      editableBeforeHandover: true,
      expectedBagQty: 1,
      expectedFeiTicketCount: 0,
      receivedFeiTicketCount: 0,
      status: '待装袋',
      createdAt,
      updatedAt: createdAt,
    }
    normalizeTransferBagRuntimeFields(bag)
    return bag
  })
  created.forEach((bag) => {
    storeRef.transferBags.push(bag)
    batch.transferBagIds.push(bag.transferBagId)
    order.transferBagIds.push(bag.transferBagId)
  })
  batch.status = '待装袋'
  batch.updatedAt = createdAt
  order.status = '待扫码'
  order.updatedAt = createdAt
  return clone(created)
}

export function createOrGetTransferBagForDispatchBatch(input: {
  dispatchBatchId: string
  operatorName?: string
  createdAt?: string
}): CuttingSewingTransferBag {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const batch = findDispatchBatchById(storeRef, input.dispatchBatchId)
  const editableBag = storeRef.transferBags.find(
    (bag) => bag.dispatchBatchId === batch.dispatchBatchId && bag.dispatchStatus === '未交出',
  )
  if (editableBag) {
    normalizeTransferBagRuntimeFields(editableBag)
    return clone(editableBag)
  }
  const created = createCuttingSewingTransferBags({
    dispatchBatchId: batch.dispatchBatchId,
    bagPlanList: [
      {
        plannedGarmentQty: batch.plannedGarmentQty,
        skuQtyLines: batch.plannedSkuQtyLines,
      },
    ],
  })[0]
  const bag = findTransferBagById(storeRef, created.transferBagId)
  bag.packedBy = input.operatorName
  bag.createdAt = input.createdAt || bag.createdAt
  bag.updatedAt = input.createdAt || bag.updatedAt
  normalizeTransferBagRuntimeFields(bag)
  return clone(bag)
}

export function scanFeiTicketIntoTransferBag(input: {
  transferBagId: string
  feiTicketNo: string
}): {
  updatedTransferBag: CuttingSewingTransferBag
  validationResult: CuttingSewingDispatchValidationResult
} {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const bag = findTransferBagById(storeRef, input.transferBagId)
  const ticket = getFeiTicketByNo(input.feiTicketNo)
  const batch = findDispatchBatchById(storeRef, bag.dispatchBatchId)
  const order = findDispatchOrderById(storeRef, bag.dispatchOrderId)
  const baseResult = {
    validationId: `CSV-${bag.transferBagId}-${input.feiTicketNo}`,
    dispatchOrderId: bag.dispatchOrderId,
    dispatchBatchId: bag.dispatchBatchId,
    transferBagId: bag.transferBagId,
    productionOrderId: bag.productionOrderId,
    productionOrderNo: bag.productionOrderNo,
    colorName: ticket?.garmentColor || '',
    sizeCode: ticket?.skuSize || '',
    partName: ticket?.partName || '',
    requiredPieceQty: 0,
    scannedPieceQty: 0,
    missingPieceQty: 0,
    overPieceQty: 0,
    specialCraftRequired: false,
    specialCraftStatus: '不需要特殊工艺' as CuttingSewingSpecialCraftReturnStatus,
    blocking: true,
  }
  if (!ticket) {
    const result: CuttingSewingDispatchValidationResult = {
      ...baseResult,
      validationType: '菲票不属于本生产单',
      validationMessage: '未找到菲票',
    }
    storeRef.validationResults.push(result)
    return { updatedTransferBag: clone(bag), validationResult: clone(result) }
  }
  if (ticket.productionOrderId !== bag.productionOrderId) {
    const result: CuttingSewingDispatchValidationResult = {
      ...baseResult,
      validationType: '菲票不属于本生产单',
      validationMessage: '菲票不属于本生产单',
    }
    storeRef.validationResults.push(result)
    return { updatedTransferBag: clone(bag), validationResult: clone(result) }
  }
  if (getOccupiedFeiTicketNos({ excludeBagId: bag.transferBagId }).has(ticket.feiTicketNo)) {
    const result: CuttingSewingDispatchValidationResult = {
      ...baseResult,
      validationType: '菲票已发出',
      validationMessage: '菲票已被其他未关闭中转袋占用或已发出',
    }
    storeRef.validationResults.push(result)
    return { updatedTransferBag: clone(bag), validationResult: clone(result) }
  }

  normalizeTransferBagRuntimeFields(bag)
  let pieceLine = bag.pieceLines.find(
    (line) =>
      line.colorName === ticket.garmentColor &&
      line.sizeCode === ticket.skuSize &&
      line.partName === ticket.partName,
  )
  if (!pieceLine) {
    const requiredLine = getRequiredLinesForBag(batch).find(
      (line) =>
        line.colorName === ticket.garmentColor &&
        line.sizeCode === ticket.skuSize &&
        line.partName === ticket.partName,
    )
    if (requiredLine) {
      pieceLine = buildPieceLineFromRequiredLine(requiredLine, bag.transferBagId, bag.pieceLines.length)
      bag.pieceLines.push(pieceLine)
      if (!bag.skuQtyLines.some((line) => line.colorName === ticket.garmentColor && line.sizeCode === ticket.skuSize)) {
        const skuLine = batch.plannedSkuQtyLines.find((line) => line.colorName === ticket.garmentColor && line.sizeCode === ticket.skuSize)
        if (skuLine) bag.skuQtyLines.push({ ...skuLine })
      }
    }
  }
  if (!pieceLine) {
    const result: CuttingSewingDispatchValidationResult = {
      ...baseResult,
      validationType:
        bag.skuQtyLines.some((line) => line.colorName === ticket.garmentColor)
          ? bag.skuQtyLines.some((line) => line.sizeCode === ticket.skuSize)
            ? '菲票部位不匹配'
            : '菲票尺码不匹配'
          : '菲票颜色不匹配',
      validationMessage: '菲票不属于本次发料批次',
    }
    storeRef.validationResults.push(result)
    return { updatedTransferBag: clone(bag), validationResult: clone(result) }
  }
  const specialCraft = mapSpecialCraftReturnStatus(ticket.feiTicketNo)
  if (specialCraft.specialCraftRequired && specialCraft.specialCraftReturnStatus !== '已回仓') {
    const result: CuttingSewingDispatchValidationResult = {
      ...baseResult,
      requiredPieceQty: pieceLine.requiredPieceQty,
      scannedPieceQty: pieceLine.scannedPieceQty,
      missingPieceQty: pieceLine.missingPieceQty,
      specialCraftRequired: true,
      specialCraftStatus: specialCraft.specialCraftReturnStatus,
      validationType:
        specialCraft.specialCraftReturnStatus === '差异'
          ? '特殊工艺差异'
          : specialCraft.specialCraftReturnStatus === '异议中'
            ? '特殊工艺异议中'
            : '特殊工艺未回仓',
      validationMessage: '特殊工艺未回仓，不能加入本次发料',
    }
    storeRef.validationResults.push(result)
    return { updatedTransferBag: clone(bag), validationResult: clone(result) }
  }

  const nextScannedQty = pieceLine.scannedPieceQty + getTicketDispatchQty(ticket)
  if (nextScannedQty > pieceLine.requiredPieceQty) {
    const result: CuttingSewingDispatchValidationResult = {
      ...baseResult,
      requiredPieceQty: pieceLine.requiredPieceQty,
      scannedPieceQty: nextScannedQty,
      overPieceQty: nextScannedQty - pieceLine.requiredPieceQty,
      specialCraftRequired: specialCraft.specialCraftRequired,
      specialCraftStatus: specialCraft.specialCraftReturnStatus,
      validationType: '裁片超出',
      validationMessage: '扫码菲票数量超出本袋应配数量',
    }
    storeRef.validationResults.push(result)
    return { updatedTransferBag: clone(bag), validationResult: clone(result) }
  }

  pieceLine.scannedPieceQty = nextScannedQty
  pieceLine.scannedFeiTicketNos = unique([...pieceLine.scannedFeiTicketNos, ticket.feiTicketNo])
  pieceLine.missingPieceQty = Math.max(pieceLine.requiredPieceQty - pieceLine.scannedPieceQty, 0)
  pieceLine.overPieceQty = Math.max(pieceLine.scannedPieceQty - pieceLine.requiredPieceQty, 0)
  pieceLine.specialCraftRequired = specialCraft.specialCraftRequired
  pieceLine.specialCraftReturnStatus = specialCraft.specialCraftReturnStatus
  pieceLine.completeStatus = pieceLine.missingPieceQty === 0 && pieceLine.overPieceQty === 0 ? '已配齐' : '未配齐'
  bag.scannedFeiTicketNos = unique([...bag.scannedFeiTicketNos, ticket.feiTicketNo])
  if (!bag.contentItems.some((item) => item.sourceKind === 'FEI_TICKET' && item.feiTicketNo === ticket.feiTicketNo)) {
    bag.contentItems.push(buildContentItemFromFeiTicket(bag, ticket))
  }
  bag.status = bag.scannedFeiTicketNos.length ? '装袋中' : '待装袋'
  bag.packStatus = bag.scannedFeiTicketNos.length ? '装袋中' : '待装袋'
  bag.currentLocation = '裁床厂待交出'
  bag.editableBeforeHandover = true
  bag.lastPackedAt = nowText()
  bag.completeStatus = '未校验'
  bag.updatedAt = nowText()
  normalizeTransferBagRuntimeFields(bag)
  batch.feiTicketNos = unique([...batch.feiTicketNos, ticket.feiTicketNo])
  order.feiTicketNos = unique([...order.feiTicketNos, ticket.feiTicketNo])
  const result: CuttingSewingDispatchValidationResult = {
    ...baseResult,
    requiredPieceQty: pieceLine.requiredPieceQty,
    scannedPieceQty: pieceLine.scannedPieceQty,
    missingPieceQty: pieceLine.missingPieceQty,
    overPieceQty: pieceLine.overPieceQty,
    specialCraftRequired: specialCraft.specialCraftRequired,
    specialCraftStatus: specialCraft.specialCraftReturnStatus,
    validationType: '通过',
    validationMessage: '菲票已扫码装袋',
    blocking: false,
  }
  storeRef.validationResults.push(result)
  validateTransferBagCompleteness(bag.transferBagId)
  updateDispatchOrderFromChildren(order)
  return { updatedTransferBag: clone(bag), validationResult: clone(result) }
}

export function scanFeiTicketIntoTransferBagOnMobile(input: {
  transferBagId: string
  feiTicketNo: string
  operatorName?: string
  operatedAt?: string
}): {
  updatedTransferBag: CuttingSewingTransferBag
  validationResult: CuttingSewingDispatchValidationResult
} {
  const result = scanFeiTicketIntoTransferBag({ transferBagId: input.transferBagId, feiTicketNo: input.feiTicketNo })
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const bag = findTransferBagById(storeRef, input.transferBagId)
  bag.packedBy = input.operatorName || bag.packedBy || '现场操作员'
  bag.packedAt = bag.packedAt || input.operatedAt || nowText()
  bag.lastPackedAt = input.operatedAt || nowText()
  bag.packStatus = bag.scannedFeiTicketNos.length ? '装袋中' : '待装袋'
  normalizeTransferBagRuntimeFields(bag)
  return { updatedTransferBag: clone(bag), validationResult: result.validationResult }
}

export function removeFeiTicketFromTransferBag(input: {
  transferBagId: string
  feiTicketNo: string
}): CuttingSewingTransferBag {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const bag = findTransferBagById(storeRef, input.transferBagId)
  assertTransferBagEditableBeforeHandover(bag.transferBagId)
  bag.scannedFeiTicketNos = bag.scannedFeiTicketNos.filter((feiTicketNo) => feiTicketNo !== input.feiTicketNo)
  bag.contentItems = (bag.contentItems || []).filter((item) => item.feiTicketNo !== input.feiTicketNo)
  bag.pieceLines.forEach((line) => {
    if (!line.scannedFeiTicketNos.includes(input.feiTicketNo)) return
    const ticket = getFeiTicketByNo(input.feiTicketNo)
    line.scannedFeiTicketNos = line.scannedFeiTicketNos.filter((feiTicketNo) => feiTicketNo !== input.feiTicketNo)
    line.scannedPieceQty = Math.max(line.scannedPieceQty - (ticket ? getTicketDispatchQty(ticket) : 0), 0)
    line.missingPieceQty = Math.max(line.requiredPieceQty - line.scannedPieceQty, 0)
    line.overPieceQty = Math.max(line.scannedPieceQty - line.requiredPieceQty, 0)
    line.completeStatus = line.missingPieceQty === 0 && line.overPieceQty === 0 ? '已配齐' : '未配齐'
  })
  bag.status = bag.scannedFeiTicketNos.length ? '装袋中' : '待装袋'
  bag.packStatus = bag.scannedFeiTicketNos.length ? '装袋中' : '待装袋'
  bag.completeStatus = '未校验'
  bag.updatedAt = nowText()
  normalizeTransferBagRuntimeFields(bag)
  validateTransferBagCompleteness(bag.transferBagId)
  return clone(bag)
}

export function assertTransferBagEditableBeforeHandover(transferBagId: string): void {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const bag = findTransferBagById(storeRef, transferBagId)
  normalizeTransferBagRuntimeFields(bag)
  if (!bag.editableBeforeHandover || bag.dispatchStatus !== '未交出' || bag.handoverSubmittedAt || bag.receivedAt) {
    throw new Error('已交出或已回写的中转袋不可调整')
  }
}

export function removeTransferBagContentItemBeforeHandover(input: {
  transferBagId: string
  contentItemId?: string
  feiTicketNo?: string
}): CuttingSewingTransferBag {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const bag = findTransferBagById(storeRef, input.transferBagId)
  const item = (bag.contentItems || []).find((contentItem) =>
    input.contentItemId
      ? contentItem.contentItemId === input.contentItemId
      : Boolean(input.feiTicketNo && contentItem.feiTicketNo === input.feiTicketNo),
  )
  if (!item?.feiTicketNo) {
    assertTransferBagEditableBeforeHandover(input.transferBagId)
    bag.contentItems = (bag.contentItems || []).filter((contentItem) => contentItem.contentItemId !== input.contentItemId)
    normalizeTransferBagRuntimeFields(bag)
    return clone(bag)
  }
  return removeFeiTicketFromTransferBag({ transferBagId: input.transferBagId, feiTicketNo: item.feiTicketNo })
}

export function recalcTransferBagContentSummary(transferBagId: string): CuttingSewingTransferBag {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const bag = findTransferBagById(storeRef, transferBagId)
  normalizeTransferBagRuntimeFields(bag)
  bag.updatedAt = nowText()
  return clone(bag)
}

export function validateTransferBagCompleteness(transferBagId: string): {
  updatedTransferBag: CuttingSewingTransferBag
  validationResults: CuttingSewingDispatchValidationResult[]
} {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const bag = findTransferBagById(storeRef, transferBagId)
  normalizeTransferBagRuntimeFields(bag)
  const results: CuttingSewingDispatchValidationResult[] = []
  bag.pieceLines.forEach((line, index) => {
    const validationBase = {
      validationId: `CSV-${bag.transferBagId}-${String(index + 1).padStart(3, '0')}`,
      dispatchOrderId: bag.dispatchOrderId,
      dispatchBatchId: bag.dispatchBatchId,
      transferBagId: bag.transferBagId,
      productionOrderId: bag.productionOrderId,
      productionOrderNo: bag.productionOrderNo,
      colorName: line.colorName,
      sizeCode: line.sizeCode,
      partName: line.partName,
      requiredPieceQty: line.requiredPieceQty,
      scannedPieceQty: line.scannedPieceQty,
      missingPieceQty: line.missingPieceQty,
      overPieceQty: line.overPieceQty,
      specialCraftRequired: line.specialCraftRequired,
      specialCraftStatus: line.specialCraftReturnStatus,
      blocking: true,
    }
    if (line.specialCraftRequired && line.specialCraftReturnStatus !== '已回仓') {
      results.push({
        ...validationBase,
        validationType:
          line.specialCraftReturnStatus === '差异'
            ? '特殊工艺差异'
            : line.specialCraftReturnStatus === '异议中'
              ? '特殊工艺异议中'
              : '特殊工艺未回仓',
        validationMessage: '特殊工艺未回仓，不能交出',
      })
    } else if (line.missingPieceQty > 0) {
      results.push({ ...validationBase, validationType: '缺少裁片', validationMessage: '缺少裁片' })
    } else if (line.overPieceQty > 0) {
      results.push({ ...validationBase, validationType: '裁片超出', validationMessage: '裁片超出' })
    } else {
      results.push({ ...validationBase, validationType: '通过', validationMessage: '齐套校验通过', blocking: false })
    }
  })
  const blocking = results.some((result) => result.blocking)
  bag.completeStatus = blocking ? '未配齐' : '已配齐'
  bag.status = blocking ? (bag.scannedFeiTicketNos.length ? '装袋中' : '待装袋') : '已配齐'
  bag.packStatus = bag.scannedFeiTicketNos.length ? (blocking ? '装袋中' : '已装袋') : '待装袋'
  bag.editableBeforeHandover = bag.dispatchStatus === '未交出' && !bag.handoverSubmittedAt && !bag.receivedAt
  bag.updatedAt = nowText()
  normalizeTransferBagRuntimeFields(bag)
  storeRef.validationResults = [
    ...storeRef.validationResults.filter((item) => item.transferBagId !== bag.transferBagId || item.validationType === '通过'),
    ...results,
  ]
  return { updatedTransferBag: clone(bag), validationResults: clone(results) }
}

export function validateTransferBagForMixedPacking(transferBagId: string): {
  updatedTransferBag: CuttingSewingTransferBag
  validationResults: CuttingSewingDispatchValidationResult[]
} {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const bag = findTransferBagById(storeRef, transferBagId)
  const batch = findDispatchBatchById(storeRef, bag.dispatchBatchId)
  normalizeTransferBagRuntimeFields(bag)
  const duplicateTickets = bag.scannedFeiTicketNos.filter((feiTicketNo, index, list) => list.indexOf(feiTicketNo) !== index)
  const results: CuttingSewingDispatchValidationResult[] = []
  duplicateTickets.forEach((feiTicketNo) => {
    const ticket = getFeiTicketByNo(feiTicketNo)
    results.push({
      validationId: `CSV-${bag.transferBagId}-${feiTicketNo}-DUP`,
      dispatchOrderId: bag.dispatchOrderId,
      dispatchBatchId: bag.dispatchBatchId,
      transferBagId: bag.transferBagId,
      productionOrderId: bag.productionOrderId,
      productionOrderNo: bag.productionOrderNo,
      colorName: ticket?.garmentColor || '',
      sizeCode: ticket?.skuSize || '',
      partName: ticket?.partName || '',
      requiredPieceQty: 0,
      scannedPieceQty: 0,
      missingPieceQty: 0,
      overPieceQty: 0,
      specialCraftRequired: false,
      specialCraftStatus: '不需要特殊工艺',
      validationType: '菲票重复',
      validationMessage: '菲票重复装袋',
      blocking: true,
    })
  })
  bag.contentItems.forEach((item, index) => {
    if (item.sourceKind !== 'FEI_TICKET') return
    const ticket = item.feiTicketNo ? getFeiTicketByNo(item.feiTicketNo) : undefined
    const belongsToBatch = ticket && ticket.productionOrderId === batch.productionOrderId
    if (belongsToBatch) return
    results.push({
      validationId: `CSV-${bag.transferBagId}-CONTENT-${String(index + 1).padStart(3, '0')}`,
      dispatchOrderId: bag.dispatchOrderId,
      dispatchBatchId: bag.dispatchBatchId,
      transferBagId: bag.transferBagId,
      productionOrderId: bag.productionOrderId,
      productionOrderNo: bag.productionOrderNo,
      colorName: item.colorName || '',
      sizeCode: item.sizeCode || '',
      partName: item.partName || '',
      requiredPieceQty: 0,
      scannedPieceQty: item.currentQty,
      missingPieceQty: 0,
      overPieceQty: 0,
      specialCraftRequired: false,
      specialCraftStatus: '不需要特殊工艺',
      validationType: '菲票不属于本生产单',
      validationMessage: '袋内菲票不属于本次发料批次',
      blocking: true,
    })
  })
  if (!results.length) {
    results.push({
      validationId: `CSV-${bag.transferBagId}-MIXED-OK`,
      dispatchOrderId: bag.dispatchOrderId,
      dispatchBatchId: bag.dispatchBatchId,
      transferBagId: bag.transferBagId,
      productionOrderId: bag.productionOrderId,
      productionOrderNo: bag.productionOrderNo,
      colorName: '混装',
      sizeCode: '混装',
      partName: '袋内明细',
      requiredPieceQty: bag.contentFeiTicketCount,
      scannedPieceQty: bag.contentFeiTicketCount,
      missingPieceQty: 0,
      overPieceQty: 0,
      specialCraftRequired: false,
      specialCraftStatus: '不需要特殊工艺',
      validationType: '通过',
      validationMessage: '混装袋内明细合法',
      blocking: false,
    })
  }
  return { updatedTransferBag: clone(bag), validationResults: clone(results) }
}

export function validateDispatchBatchCompleteness(dispatchBatchId: string): {
  updatedDispatchBatch: CuttingSewingDispatchBatch
  validationResults: CuttingSewingDispatchValidationResult[]
} {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const batch = findDispatchBatchById(storeRef, dispatchBatchId)
  const order = findDispatchOrderById(storeRef, batch.dispatchOrderId)
  const bagLegalityResults = batch.transferBagIds.flatMap((transferBagId) => validateTransferBagForMixedPacking(transferBagId).validationResults)
  const scannedByKey = new Map<string, { qty: number; ticketNos: string[] }>()
  batch.transferBagIds.forEach((transferBagId) => {
    const bag = findTransferBagById(storeRef, transferBagId)
    normalizeTransferBagRuntimeFields(bag)
    bag.pieceLines.forEach((line) => {
      const key = `${line.colorName}|${line.sizeCode}|${line.partName}`
      const current = scannedByKey.get(key) || { qty: 0, ticketNos: [] }
      current.qty += line.scannedPieceQty
      current.ticketNos.push(...line.scannedFeiTicketNos)
      scannedByKey.set(key, current)
    })
  })
  const batchResults = getRequiredLinesForBag(batch).map((line, index) => {
    const key = `${line.colorName}|${line.sizeCode}|${line.partName}`
    const scanned = scannedByKey.get(key)?.qty || 0
    const missingPieceQty = Math.max(line.requiredPieceQty - scanned, 0)
    const overPieceQty = Math.max(scanned - line.requiredPieceQty, 0)
    const validationBase = {
      validationId: `CSV-${batch.dispatchBatchId}-BATCH-${String(index + 1).padStart(3, '0')}`,
      dispatchOrderId: batch.dispatchOrderId,
      dispatchBatchId: batch.dispatchBatchId,
      transferBagId: batch.transferBagIds[0] || '',
      productionOrderId: batch.productionOrderId,
      productionOrderNo: batch.productionOrderNo,
      colorName: line.colorName,
      sizeCode: line.sizeCode,
      partName: line.partName,
      requiredPieceQty: line.requiredPieceQty,
      scannedPieceQty: scanned,
      missingPieceQty,
      overPieceQty,
      specialCraftRequired: line.specialCraftRequired,
      specialCraftStatus: line.specialCraftReturnStatus,
      blocking: true,
    }
    if (line.specialCraftRequired && line.specialCraftReturnStatus !== '已回仓') {
      return {
        ...validationBase,
        validationType:
          line.specialCraftReturnStatus === '差异'
            ? '特殊工艺差异'
            : line.specialCraftReturnStatus === '异议中'
              ? '特殊工艺异议中'
              : '特殊工艺未回仓',
        validationMessage: '特殊工艺未回仓，不能交出',
      } satisfies CuttingSewingDispatchValidationResult
    }
    if (missingPieceQty > 0) {
      return { ...validationBase, validationType: '缺少裁片', validationMessage: '本次发料批次缺少裁片' } satisfies CuttingSewingDispatchValidationResult
    }
    if (overPieceQty > 0) {
      return { ...validationBase, validationType: '裁片超出', validationMessage: '本次发料批次裁片超出' } satisfies CuttingSewingDispatchValidationResult
    }
    return {
      ...validationBase,
      validationType: '通过',
      validationMessage: '本次发料批次齐套校验通过',
      blocking: false,
    } satisfies CuttingSewingDispatchValidationResult
  })
  const results = [...bagLegalityResults, ...batchResults]
  const blocking = results.some((result) => result.blocking)
  batch.completeStatus = blocking ? '未配齐' : '已配齐'
  batch.status = blocking ? '装袋中' : '已配齐'
  batch.updatedAt = nowText()
  batch.transferBagIds.forEach((transferBagId) => {
    const bag = findTransferBagById(storeRef, transferBagId)
    normalizeTransferBagRuntimeFields(bag)
    if (!blocking) {
      bag.completeStatus = '已配齐'
      bag.status = '已配齐'
      bag.packStatus = bag.scannedFeiTicketNos.length ? '已装袋' : bag.packStatus
      bag.updatedAt = batch.updatedAt
    }
  })
  order.status = blocking ? '待配齐' : '可交出'
  order.validationStatus = blocking ? '校验未通过' : '校验通过'
  order.validationMessages = unique(results.filter((item) => item.blocking).map((item) => item.validationMessage))
  storeRef.validationResults = [
    ...storeRef.validationResults.filter((item) => item.dispatchBatchId !== batch.dispatchBatchId),
    ...results,
  ]
  updateDispatchOrderFromChildren(order)
  return { updatedDispatchBatch: clone(batch), validationResults: clone(results) }
}

export function assertSewingDispatchAllowed(dispatchBatchId: string): void {
  const validation = validateDispatchBatchCompleteness(dispatchBatchId)
  if (validation.updatedDispatchBatch.completeStatus !== '已配齐') {
    throw new Error('本次发料批次未配齐，不能提交交出')
  }
  const blocking = validation.validationResults.find((item) => item.blocking)
  if (blocking) throw new Error(blocking.validationMessage)
}

export function submitCuttingSewingDispatchBatch(input: {
  dispatchBatchId: string
  operatorName: string
  submittedAt: string
}): {
  handoverOrder: PdaHandoverHead
  handoverRecord: PdaHandoverRecord
  outboundRecords: FactoryWarehouseOutboundRecord[]
  updatedWaitHandoverStockItems: FactoryWaitHandoverStockItem[]
  updatedDispatchBatch: CuttingSewingDispatchBatch
  updatedTransferBags: CuttingSewingTransferBag[]
} {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  assertSewingDispatchAllowed(input.dispatchBatchId)
  const batch = findDispatchBatchById(storeRef, input.dispatchBatchId)
  const order = findDispatchOrderById(storeRef, batch.dispatchOrderId)
  if (batch.handoverRecordId) {
    const record = findPdaHandoverRecord(batch.handoverRecordId)
    if (record) {
      return {
        handoverOrder: upsertPdaHandoverHeadMock(buildHandoverHead(order, batch)),
        handoverRecord: record,
        outboundRecords: [],
        updatedWaitHandoverStockItems: [],
        updatedDispatchBatch: clone(batch),
        updatedTransferBags: clone(storeRef.transferBags.filter((bag) => batch.transferBagIds.includes(bag.transferBagId))),
      }
    }
  }
  const handoverOrder = upsertPdaHandoverHeadMock(buildHandoverHead(order, batch))
  const record = createFactoryHandoverRecord({
    handoverOrderId: handoverOrder.handoverOrderId || handoverOrder.handoverId,
    submittedQty: sum(batch.transferBagIds.map((bagId) => findTransferBagById(storeRef, bagId).pieceLines.reduce((total, line) => total + line.scannedPieceQty, 0))),
    qtyUnit: '片',
    factorySubmittedAt: input.submittedAt,
    factorySubmittedBy: input.operatorName,
    factoryRemark: `中转单：${batch.transferOrderNo}；中转袋：${batch.transferBagIds
      .map((bagId) => findTransferBagById(storeRef, bagId).transferBagNo)
      .join('、')}`,
    objectType: 'CUT_PIECE',
    handoutObjectType: 'CUT_PIECE',
    handoutItemLabel: `裁片发料 ${batch.transferOrderNo}`,
    garmentEquivalentQty: batch.plannedGarmentQty,
    skuColor: batch.plannedSkuQtyLines.map((line) => line.colorName).join('、'),
    skuSize: batch.plannedSkuQtyLines.map((line) => line.sizeCode).join('、'),
    pieceName: unique(batch.transferBagIds.flatMap((bagId) => findTransferBagById(storeRef, bagId).pieceLines.map((line) => line.partName))).join('、'),
    cutPieceLines: buildHandoverCutPieceLines(storeRef, batch),
  })
  const expectedTransferBagCount = batch.transferBagIds.length
  const expectedFeiTicketCount = batch.transferBagIds.reduce((total, bagId) => {
    const bag = findTransferBagById(storeRef, bagId)
    normalizeTransferBagRuntimeFields(bag)
    return total + bag.contentFeiTicketCount
  }, 0)
  const recordWithTransferBagFields = upsertPdaHandoutRecordMock({
    ...record,
    expectedTransferBagCount,
    receivedTransferBagCount: 0,
    expectedFeiTicketCount,
    receivedFeiTicketCount: 0,
    writebackMode: '按袋 + 菲票',
    combinedWritebackStatus: '待回写',
    transferBagWritebackLines: batch.transferBagIds.map((bagId) => {
      const bag = findTransferBagById(storeRef, bagId)
      normalizeTransferBagRuntimeFields(bag)
      const expectedQty = bag.pieceLines.reduce((total, line) => total + line.scannedPieceQty, 0)
      return {
        lineId: `TBWL-${record.recordId}-${bag.transferBagId}`,
        handoverRecordId: record.handoverRecordId || record.recordId,
        transferBagId: bag.transferBagId,
        transferBagNo: bag.transferBagNo,
        expectedFeiTicketCount: bag.contentFeiTicketCount,
        receivedFeiTicketCount: 0,
        expectedQty,
        actualQty: 0,
        differenceQty: -expectedQty,
        status: '待回写',
      }
    }),
    feiTicketWritebackLines: [],
  })
  const linkage = linkHandoverRecordToOutboundRecord({
    handoverOrderId: handoverOrder.handoverOrderId || handoverOrder.handoverId,
    handoverOrderNo: handoverOrder.handoverOrderNo || handoverOrder.handoverId,
    handoverRecordId: recordWithTransferBagFields.handoverRecordId || recordWithTransferBagFields.recordId,
    handoverRecordNo: recordWithTransferBagFields.handoverRecordNo || recordWithTransferBagFields.recordId,
    handoverRecordQrValue: recordWithTransferBagFields.handoverRecordQrValue,
    taskId: batch.dispatchBatchId,
    taskNo: batch.dispatchBatchNo,
    factoryId: order.cuttingFactoryId,
    factoryName: order.cuttingFactoryName,
    receiverKind: '后道工厂',
    receiverName: order.sewingFactoryName,
    itemKind: '裁片',
    itemName: `裁片发料 ${batch.transferOrderNo}`,
    transferBagNo: batch.transferBagIds.map((bagId) => findTransferBagById(storeRef, bagId).transferBagNo).join('、'),
    submittedQty: recordWithTransferBagFields.submittedQty,
    unit: recordWithTransferBagFields.qtyUnit,
    operatorName: input.operatorName,
    submittedAt: input.submittedAt,
  })
  batch.handoverRecordId = recordWithTransferBagFields.handoverRecordId || recordWithTransferBagFields.recordId
  batch.handoverRecordNo = recordWithTransferBagFields.handoverRecordNo || recordWithTransferBagFields.recordId
  batch.status = '已交出'
  batch.updatedAt = input.submittedAt
  batch.transferBagIds.forEach((bagId) => {
    const bag = findTransferBagById(storeRef, bagId)
    bag.status = '已交出'
    bag.dispatchStatus = '已交出'
    bag.packStatus = '已交出'
    bag.currentLocation = '下游工厂待接收'
    bag.editableBeforeHandover = false
    bag.handoverSubmittedAt = input.submittedAt
    bag.updatedAt = input.submittedAt
  })
  order.handoverOrderId = handoverOrder.handoverOrderId || handoverOrder.handoverId
  order.handoverOrderNo = handoverOrder.handoverOrderNo || handoverOrder.handoverId
  order.handoverRecordIds = unique([...order.handoverRecordIds, record.handoverRecordId || record.recordId])
  order.status = '已交出'
  order.updatedAt = input.submittedAt
  updateDispatchOrderFromChildren(order)
  return {
    handoverOrder,
    handoverRecord: recordWithTransferBagFields,
    outboundRecords: [linkage.outboundRecord],
    updatedWaitHandoverStockItems: [linkage.updatedWaitHandoverStockItem],
    updatedDispatchBatch: clone(batch),
    updatedTransferBags: clone(batch.transferBagIds.map((bagId) => findTransferBagById(storeRef, bagId))),
  }
}

function buildHandoverHead(order: CuttingSewingDispatchOrder, batch: CuttingSewingDispatchBatch): PdaHandoverHead {
  return {
    handoverId: `HO-CSD-${batch.dispatchBatchId}`,
    handoverOrderId: `HO-CSD-${batch.dispatchBatchId}`,
    handoverOrderNo: `JCD-${batch.transferOrderNo}`,
    headType: 'HANDOUT',
    qrCodeValue: buildHandoverOrderQrValue(`HO-CSD-${batch.dispatchBatchId}`),
    handoverOrderQrValue: buildHandoverOrderQrValue(`HO-CSD-${batch.dispatchBatchId}`),
    taskId: batch.dispatchBatchId,
    sourceTaskId: batch.dispatchBatchId,
    taskNo: batch.dispatchBatchNo,
    sourceTaskNo: batch.dispatchBatchNo,
    productionOrderNo: order.productionOrderNo,
    processName: '裁片发料',
    sourceFactoryName: order.cuttingFactoryName,
    sourceFactoryId: order.cuttingFactoryId,
    targetName: order.sewingFactoryName,
    targetKind: 'FACTORY',
    receiverKind: 'MANAGED_POST_FACTORY',
    receiverId: order.sewingFactoryId,
    receiverName: order.sewingFactoryName,
    qtyUnit: '片',
    factoryId: order.cuttingFactoryId,
    taskStatus: 'DONE',
    summaryStatus: batch.status === '已回写' ? 'WRITTEN_BACK' : batch.status === '差异' ? 'PARTIAL_WRITTEN_BACK' : 'SUBMITTED',
    recordCount: batch.handoverRecordId ? 1 : 0,
    pendingWritebackCount: batch.status === '已交出' ? 1 : 0,
    submittedQtyTotal: sum(batch.transferBagIds.map((bagId) => findTransferBagById(ensureCuttingSewingDispatchSeeded(), bagId).pieceLines.reduce((total, line) => total + line.scannedPieceQty, 0))),
    writtenBackQtyTotal: batch.receiverWrittenQty || 0,
    diffQtyTotal: batch.differenceQty || 0,
    objectionCount: batch.status === '异议中' ? 1 : 0,
    lastRecordAt: batch.updatedAt,
    plannedQty: batch.plannedGarmentQty,
    completionStatus: batch.status === '已回写' ? 'COMPLETED' : 'OPEN',
    qtyExpectedTotal: sum(batch.transferBagIds.map((bagId) => findTransferBagById(ensureCuttingSewingDispatchSeeded(), bagId).pieceLines.reduce((total, line) => total + line.requiredPieceQty, 0))),
    qtyActualTotal: batch.receiverWrittenQty || 0,
    qtyDiffTotal: batch.differenceQty || 0,
    transitionFromPrev: 'NOT_APPLICABLE',
    transitionToNext: 'NOT_APPLICABLE',
    stageCode: 'POST',
    stageName: '裁片发料',
    processBusinessCode: 'CUT_PANEL',
    processBusinessName: '裁片',
    taskTypeCode: 'CUT_PIECE_SEWING_DISPATCH',
    taskTypeLabel: '裁片发料',
    assignmentGranularity: 'SKU',
    assignmentGranularityLabel: '颜色尺码',
    isSpecialCraft: false,
  }
}

function buildHandoverCutPieceLines(
  storeRef: CuttingSewingDispatchStore,
  batch: CuttingSewingDispatchBatch,
): PdaCutPieceHandoutLine[] {
  return batch.transferBagIds.flatMap((bagId) => {
    const bag = findTransferBagById(storeRef, bagId)
    return bag.pieceLines.map((line) => ({
      lineId: `${bag.transferBagId}-${line.pieceLineId}`,
      piecePartLabel: line.partName,
      garmentSkuCode: `${line.colorName}-${line.sizeCode}`,
      garmentSkuLabel: `${line.colorName} / ${line.sizeCode}`,
      colorLabel: line.colorName,
      sizeLabel: line.sizeCode,
      pieceQty: line.scannedPieceQty,
      garmentEquivalentQty: line.garmentQty,
    }))
  })
}

export function getTransferBagContentDisplayItems(transferBagId: string): TransferBagContentItem[] {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const bag = findTransferBagById(storeRef, transferBagId)
  normalizeTransferBagRuntimeFields(bag)
  return clone(
    [...bag.contentItems].sort((left, right) =>
      `${left.colorName || ''}-${left.sizeCode || ''}-${left.partName || ''}-${left.sourceNo || ''}`.localeCompare(
        `${right.colorName || ''}-${right.sizeCode || ''}-${right.partName || ''}-${right.sourceNo || ''}`,
        'zh-CN',
      ),
    ),
  )
}

export function getTransferBagScanSummaryByQr(qrValue: string): {
  transferBagNo: string
  sourceFactoryName: string
  receiverFactoryName: string
  productionOrderNo: string
  dispatchBatchNo: string
  transferOrderNo: string
  handoverRecordNo: string
  bagStatus: string
  contentItems: TransferBagContentItem[]
  contentSummary: {
    contentItemCount: number
    feiTicketCount: number
    materialLineCount: number
    totalQty: number
    mixedLabel: string
  }
} | null {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const bag = storeRef.transferBags.find((item) => item.transferBagQrValue === qrValue || item.transferBagNo === qrValue)
  if (!bag) return null
  const order = findDispatchOrderById(storeRef, bag.dispatchOrderId)
  const batch = findDispatchBatchById(storeRef, bag.dispatchBatchId)
  normalizeTransferBagRuntimeFields(bag)
  const contentItems = getTransferBagContentDisplayItems(bag.transferBagId)
  return {
    transferBagNo: bag.transferBagNo,
    sourceFactoryName: order.cuttingFactoryName,
    receiverFactoryName: order.sewingFactoryName,
    productionOrderNo: bag.productionOrderNo,
    dispatchBatchNo: batch.dispatchBatchNo,
    transferOrderNo: batch.transferOrderNo,
    handoverRecordNo: batch.handoverRecordNo || '待提交',
    bagStatus: bag.packStatus,
    contentItems,
    contentSummary: {
      contentItemCount: bag.contentItemCount,
      feiTicketCount: bag.contentFeiTicketCount,
      materialLineCount: bag.contentMaterialLineCount,
      totalQty: contentItems.reduce((total, item) => total + item.currentQty, 0),
      mixedLabel: '允许混装',
    },
  }
}

function findBatchByHandoverRecordId(storeRef: CuttingSewingDispatchStore, handoverRecordId: string): CuttingSewingDispatchBatch {
  const batch = storeRef.dispatchBatches.find((item) => item.handoverRecordId === handoverRecordId)
  if (!batch) throw new Error(`未找到中转单对应交出记录：${handoverRecordId}`)
  return batch
}

export function writebackSewingReceiveByTransferBag(input: {
  handoverRecordId: string
  receivedTransferBagNos: string[]
  receiverName: string
  receivedAt: string
  remark?: string
}): PdaHandoverRecord {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const batch = findBatchByHandoverRecordId(storeRef, input.handoverRecordId)
  const record = findPdaHandoverRecord(input.handoverRecordId)
  if (!record) throw new Error(`未找到交出记录：${input.handoverRecordId}`)
  const receivedNos = new Set(input.receivedTransferBagNos)
  const lines: TransferBagWritebackLine[] = batch.transferBagIds.map((bagId) => {
    const bag = findTransferBagById(storeRef, bagId)
    normalizeTransferBagRuntimeFields(bag)
    const expectedQty = bag.pieceLines.reduce((total, line) => total + line.scannedPieceQty, 0)
    const received = receivedNos.has(bag.transferBagNo)
    bag.receivedAt = received ? input.receivedAt : bag.receivedAt
    bag.receivedBy = received ? input.receiverName : bag.receivedBy
    bag.receivedFeiTicketCount = received ? bag.contentFeiTicketCount : 0
    bag.packStatus = received ? '已扫码接收' : '差异'
    bag.currentLocation = received ? '下游工厂已接收' : '差异待处理'
    return {
      lineId: `TBWL-${record.recordId}-${bag.transferBagId}`,
      handoverRecordId: record.handoverRecordId || record.recordId,
      transferBagId: bag.transferBagId,
      transferBagNo: bag.transferBagNo,
      expectedFeiTicketCount: bag.contentFeiTicketCount,
      receivedFeiTicketCount: received ? bag.contentFeiTicketCount : 0,
      expectedQty,
      actualQty: received ? expectedQty : 0,
      differenceQty: received ? 0 : -expectedQty,
      status: received ? '已回写' : '差异',
      remark: received ? input.remark : '整袋未收到',
    }
  })
  return upsertPdaHandoutRecordMock({
    ...record,
    expectedTransferBagCount: batch.transferBagIds.length,
    receivedTransferBagCount: lines.filter((line) => line.status === '已回写').length,
    expectedFeiTicketCount: lines.reduce((total, line) => total + line.expectedFeiTicketCount, 0),
    receivedFeiTicketCount: lines.reduce((total, line) => total + line.receivedFeiTicketCount, 0),
    transferBagWritebackLines: lines,
    writebackMode: '按袋',
    combinedWritebackStatus: lines.some((line) => line.status === '差异') ? '差异' : '部分回写',
  })
}

export function writebackSewingReceiveByFeiTicket(input: {
  handoverRecordId: string
  transferBagNo: string
  receivedFeiTickets: Array<{ feiTicketNo: string; actualQty: number; remark?: string }>
  receiverName: string
  receivedAt: string
}): PdaHandoverRecord {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const batch = findBatchByHandoverRecordId(storeRef, input.handoverRecordId)
  const record = findPdaHandoverRecord(input.handoverRecordId)
  if (!record) throw new Error(`未找到交出记录：${input.handoverRecordId}`)
  const bag = storeRef.transferBags.find((item) => item.transferBagNo === input.transferBagNo && item.dispatchBatchId === batch.dispatchBatchId)
  if (!bag) throw new Error(`未找到中转袋：${input.transferBagNo}`)
  normalizeTransferBagRuntimeFields(bag)
  const actualByTicket = new Map(input.receivedFeiTickets.map((item) => [item.feiTicketNo, item]))
  const nextLines: TransferBagFeiTicketWritebackLine[] = [
    ...(record.feiTicketWritebackLines || []).filter((line) => line.transferBagNo !== bag.transferBagNo),
    ...bag.contentItems
      .filter((item) => item.sourceKind === 'FEI_TICKET' && item.feiTicketNo)
      .map((item) => {
        const actual = actualByTicket.get(item.feiTicketNo || '')
        const actualQty = actual ? Math.max(actual.actualQty, 0) : 0
        const differenceQty = actualQty - item.currentQty
        return {
          lineId: `TBFTWL-${record.recordId}-${bag.transferBagId}-${item.feiTicketNo}`,
          handoverRecordId: record.handoverRecordId || record.recordId,
          transferBagId: bag.transferBagId,
          transferBagNo: bag.transferBagNo,
          feiTicketNo: item.feiTicketNo || '',
          partName: item.partName || '',
          colorName: item.colorName || '',
          sizeCode: item.sizeCode || '',
          expectedQty: item.currentQty,
          actualQty,
          differenceQty,
          status: differenceQty === 0 ? '已回写' : '差异',
          remark: actual?.remark,
        } satisfies TransferBagFeiTicketWritebackLine
      }),
  ]
  bag.receivedFeiTicketCount = nextLines.filter((line) => line.transferBagId === bag.transferBagId && line.actualQty > 0).length
  bag.packStatus = nextLines.some((line) => line.transferBagId === bag.transferBagId && line.status === '差异') ? '差异' : '部分回写'
  bag.itemDifferenceReason = nextLines.some((line) => line.transferBagId === bag.transferBagId && line.status === '差异') ? '袋内菲票数量不符' : undefined
  return upsertPdaHandoutRecordMock({
    ...record,
    expectedFeiTicketCount: batch.transferBagIds.reduce((total, bagId) => total + findTransferBagById(storeRef, bagId).contentFeiTicketCount, 0),
    receivedFeiTicketCount: nextLines.filter((line) => line.actualQty > 0).length,
    feiTicketWritebackLines: nextLines,
    writebackMode: '按袋 + 菲票',
    combinedWritebackStatus: nextLines.some((line) => line.status === '差异') ? '差异' : '部分回写',
  })
}

export function finalizeCombinedSewingWriteback(input: {
  handoverRecordId: string
  receiverName: string
  receiverWrittenAt: string
  differenceReason?: string
}): PdaHandoverRecord {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const batch = findBatchByHandoverRecordId(storeRef, input.handoverRecordId)
  const record = findPdaHandoverRecord(input.handoverRecordId)
  if (!record) throw new Error(`未找到交出记录：${input.handoverRecordId}`)
  const expectedQty = batch.transferBagIds.reduce((total, bagId) => {
    const bag = findTransferBagById(storeRef, bagId)
    return total + bag.pieceLines.reduce((sum, line) => sum + line.scannedPieceQty, 0)
  }, 0)
  const actualQty = record.feiTicketWritebackLines?.length
    ? record.feiTicketWritebackLines.reduce((total, line) => total + line.actualQty, 0)
    : record.transferBagWritebackLines?.reduce((total, line) => total + line.actualQty, 0) || 0
  const differenceQty = actualQty - expectedQty
  const written = writeBackHandoverRecord({
    handoverRecordId: input.handoverRecordId,
    receiverWrittenQty: actualQty,
    receiverWrittenAt: input.receiverWrittenAt,
    receiverWrittenBy: input.receiverName,
    receiverRemark: differenceQty === 0 ? '车缝厂按中转袋和菲票回写无差异' : input.differenceReason || '车缝厂回写存在差异',
    diffReason: input.differenceReason,
  })
  syncSewingReceiveWritebackToDispatch({
    handoverRecordId: input.handoverRecordId,
    receiverWrittenQty: actualQty,
    receivedTransferBagNos: record.transferBagWritebackLines?.filter((line) => line.actualQty > 0).map((line) => line.transferBagNo) || [],
    receivedFeiTicketNos: record.feiTicketWritebackLines?.filter((line) => line.actualQty > 0).map((line) => line.feiTicketNo) || [],
    receiverName: input.receiverName,
    receiverWrittenAt: input.receiverWrittenAt,
    differenceReason: input.differenceReason,
  })
  return upsertPdaHandoutRecordMock({
    ...written,
    transferBagWritebackLines: record.transferBagWritebackLines,
    feiTicketWritebackLines: record.feiTicketWritebackLines,
    expectedTransferBagCount: record.expectedTransferBagCount,
    receivedTransferBagCount: record.receivedTransferBagCount,
    expectedFeiTicketCount: record.expectedFeiTicketCount,
    receivedFeiTicketCount: record.receivedFeiTicketCount,
    writebackMode: '按袋 + 菲票',
    combinedWritebackStatus: differenceQty === 0 ? '已回写' : '差异',
  })
}

export function syncSewingReceiveWritebackToDispatch(input: {
  handoverRecordId: string
  receiverWrittenQty: number
  receivedTransferBagNos: string[]
  receivedFeiTicketNos: string[]
  receiverName: string
  receiverWrittenAt: string
  differenceReason?: string
}): {
  updatedDispatchBatch: CuttingSewingDispatchBatch
  updatedTransferBags: CuttingSewingTransferBag[]
  updatedDispatchOrder: CuttingSewingDispatchOrder
} {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const batch = storeRef.dispatchBatches.find((item) => item.handoverRecordId === input.handoverRecordId)
  if (!batch) throw new Error(`未找到中转单对应交出记录：${input.handoverRecordId}`)
  const order = findDispatchOrderById(storeRef, batch.dispatchOrderId)
  const submittedQty = sum(batch.transferBagIds.map((bagId) => findTransferBagById(storeRef, bagId).pieceLines.reduce((total, line) => total + line.scannedPieceQty, 0)))
  const differenceQty = input.receiverWrittenQty - submittedQty
  writeBackHandoverRecord({
    handoverRecordId: input.handoverRecordId,
    receiverWrittenQty: input.receiverWrittenQty,
    receiverWrittenAt: input.receiverWrittenAt,
    receiverWrittenBy: input.receiverName,
    receiverRemark: differenceQty === 0 ? '车缝厂接收无差异' : input.differenceReason,
    diffReason: input.differenceReason,
  })
  syncReceiverWritebackToOutboundRecord({
    handoverRecordId: input.handoverRecordId,
    receiverWrittenQty: input.receiverWrittenQty,
    receiverWrittenAt: input.receiverWrittenAt,
    receiverWrittenBy: input.receiverName,
    differenceQty,
  })
  batch.receiverWrittenQty = input.receiverWrittenQty
  batch.differenceQty = differenceQty
  batch.status = differenceQty === 0 ? '已回写' : '差异'
  batch.updatedAt = input.receiverWrittenAt
  batch.transferBagIds.forEach((bagId) => {
    const bag = findTransferBagById(storeRef, bagId)
    bag.receiverWrittenQty = input.receivedTransferBagNos.includes(bag.transferBagNo)
      ? bag.pieceLines.reduce((total, line) => total + line.scannedPieceQty, 0)
      : 0
    bag.differenceQty = input.receivedTransferBagNos.includes(bag.transferBagNo) ? 0 : bag.pieceLines.reduce((total, line) => total + line.scannedPieceQty, 0)
    bag.dispatchStatus = differenceQty === 0 ? '已回写' : '差异'
    bag.status = differenceQty === 0 ? '已回写' : '差异'
    bag.packStatus = differenceQty === 0 ? '已回写' : input.receivedTransferBagNos.includes(bag.transferBagNo) ? '部分回写' : '差异'
    bag.currentLocation = input.receivedTransferBagNos.includes(bag.transferBagNo) ? '下游工厂已接收' : '差异待处理'
    bag.receivedAt = input.receivedTransferBagNos.includes(bag.transferBagNo) ? input.receiverWrittenAt : bag.receivedAt
    bag.receivedBy = input.receivedTransferBagNos.includes(bag.transferBagNo) ? input.receiverName : bag.receivedBy
    bag.receivedFeiTicketCount = input.receivedFeiTicketNos.filter((feiTicketNo) => bag.scannedFeiTicketNos.includes(feiTicketNo)).length
    bag.updatedAt = input.receiverWrittenAt
  })
  order.receiverWrittenQty = input.receiverWrittenQty
  order.differenceQty = differenceQty
  order.status = differenceQty === 0 ? '已回写' : '差异'
  order.updatedAt = input.receiverWrittenAt
  updateDispatchOrderFromChildren(order)
  return {
    updatedDispatchBatch: clone(batch),
    updatedTransferBags: clone(batch.transferBagIds.map((bagId) => findTransferBagById(storeRef, bagId))),
    updatedDispatchOrder: clone(order),
  }
}

export function syncSewingQuantityObjectionToDispatch(input: {
  handoverRecordId: string
  objectionReason: string
  objectionRemark?: string
}): {
  updatedDispatchBatch: CuttingSewingDispatchBatch
  updatedTransferBags: CuttingSewingTransferBag[]
  updatedDispatchOrder: CuttingSewingDispatchOrder
} {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const batch = storeRef.dispatchBatches.find((item) => item.handoverRecordId === input.handoverRecordId)
  if (!batch) throw new Error(`未找到中转单对应交出记录：${input.handoverRecordId}`)
  const order = findDispatchOrderById(storeRef, batch.dispatchOrderId)
  reportPdaHandoverQtyObjection(input.handoverRecordId, {
    objectionReason: input.objectionReason,
    objectionRemark: input.objectionRemark,
  })
  syncQuantityObjectionToOutboundRecord({
    handoverRecordId: input.handoverRecordId,
    objectionId: `OBJ-${input.handoverRecordId}`,
    objectionStatus: '处理中',
  })
  batch.status = '异议中'
  batch.updatedAt = nowText()
  batch.transferBagIds.forEach((bagId) => {
    const bag = findTransferBagById(storeRef, bagId)
    bag.status = '异议中'
    bag.dispatchStatus = '异议中'
    bag.updatedAt = nowText()
  })
  order.status = '异议中'
  order.updatedAt = nowText()
  updateDispatchOrderFromChildren(order)
  return {
    updatedDispatchBatch: clone(batch),
    updatedTransferBags: clone(batch.transferBagIds.map((bagId) => findTransferBagById(storeRef, bagId))),
    updatedDispatchOrder: clone(order),
  }
}

export function getCuttingSewingDispatchProgressByProductionOrder(productionOrderId: string): {
  productionOrderNo: string
  totalProductionQty: number
  cumulativeDispatchedGarmentQty: number
  remainingGarmentQty: number
  dispatchBatchCount: number
  transferBagCount: number
  dispatchedTransferBagCount: number
  writtenBackTransferBagCount: number
  differenceTransferBagCount: number
  objectionTransferBagCount: number
  canCreateNextBatch: boolean
  blockingReasons: string[]
} {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const order = productionOrders.find((item) => item.productionOrderId === productionOrderId)
  const dispatchOrders = storeRef.dispatchOrders.filter((item) => item.productionOrderId === productionOrderId)
  const batches = storeRef.dispatchBatches.filter((batch) => dispatchOrders.some((item) => item.dispatchBatchIds.includes(batch.dispatchBatchId)))
  const bags = storeRef.transferBags.filter((bag) => batches.some((batch) => batch.transferBagIds.includes(bag.transferBagId)))
  const totalProductionQty = order ? getTotalProductionQty(order) : 0
  const cumulativeDispatchedGarmentQty = sum(
    batches
      .filter((batch) => batch.status === '已交出' || batch.status === '已回写' || batch.status === '差异' || batch.status === '异议中')
      .map((batch) => batch.plannedGarmentQty),
  )
  const blockingReasons = unique(
    storeRef.validationResults
      .filter((item) => item.productionOrderId === productionOrderId && item.blocking)
      .map((item) => item.validationMessage),
  )
  return {
    productionOrderNo: order?.productionOrderNo || productionOrderId,
    totalProductionQty,
    cumulativeDispatchedGarmentQty,
    remainingGarmentQty: Math.max(totalProductionQty - cumulativeDispatchedGarmentQty, 0),
    dispatchBatchCount: batches.length,
    transferBagCount: bags.length,
    dispatchedTransferBagCount: bags.filter((bag) => bag.status === '已交出' || bag.status === '已回写' || bag.status === '差异' || bag.status === '异议中').length,
    writtenBackTransferBagCount: bags.filter((bag) => bag.status === '已回写').length,
    differenceTransferBagCount: bags.filter((bag) => bag.status === '差异').length,
    objectionTransferBagCount: bags.filter((bag) => bag.status === '异议中').length,
    canCreateNextBatch: blockingReasons.length === 0,
    blockingReasons,
  }
}

function seedStore(): void {
  const storeRef = store!
  const pickSeedFeiTicketNos = (batch: CuttingSewingDispatchBatch, fallback: string[]): string[] => {
    const requiredLines = getRequiredLinesForBag(batch)
    const tickets = listGeneratedFeiTickets().filter((ticket) => ticket.productionOrderId === batch.productionOrderId)
    const picked: string[] = []
    requiredLines.forEach((line) => {
      const ticket = tickets.find(
        (item) =>
          !picked.includes(item.feiTicketNo) &&
          item.garmentColor === line.colorName &&
          item.skuSize === line.sizeCode &&
          item.partName === line.partName,
      )
      if (ticket) picked.push(ticket.feiTicketNo)
    })
    return picked.length > 0 ? picked : fallback
  }
  const readyOrder = createCuttingSewingDispatchOrder({ productionOrderId: 'PO-202603-081', remark: '首批裁片发车缝' })
  const readyBatch = createCuttingSewingDispatchBatch({
    dispatchOrderId: readyOrder.dispatchOrderId,
    plannedSkuQtyLines: [{ colorName: 'Black', colorCode: 'Black', sizeCode: 'M', plannedGarmentQty: 1 }],
  })
  const readyBags = createCuttingSewingTransferBags({
    dispatchBatchId: readyBatch.dispatchBatchId,
    bagPlanList: [{ plannedGarmentQty: 1, skuQtyLines: readyBatch.plannedSkuQtyLines }],
  })
  pickSeedFeiTicketNos(readyBatch, [
    'FT-CUT-260308-081-01-001',
    'FT-CUT-260308-081-01-003',
    'FT-CUT-260308-081-01-005',
    'FT-CUT-260308-081-03-003',
  ]).forEach((feiTicketNo) => {
    scanFeiTicketIntoTransferBag({ transferBagId: readyBags[0].transferBagId, feiTicketNo })
  })
  validateDispatchBatchCompleteness(readyBatch.dispatchBatchId)
  const submitResult = submitCuttingSewingDispatchBatch({
    dispatchBatchId: readyBatch.dispatchBatchId,
    operatorName: '裁床发料员',
    submittedAt: '2026-04-23 10:20:00',
  })
  syncSewingReceiveWritebackToDispatch({
    handoverRecordId: submitResult.handoverRecord.handoverRecordId || submitResult.handoverRecord.recordId,
    receiverWrittenQty: submitResult.handoverRecord.submittedQty || 0,
    receivedTransferBagNos: readyBags.map((bag) => bag.transferBagNo),
    receivedFeiTicketNos: readyBags.flatMap((bag) => bag.scannedFeiTicketNos),
    receiverName: '车缝接收员',
    receiverWrittenAt: '2026-04-23 11:00:00',
  })

  const secondBatch = createCuttingSewingDispatchBatch({
    dispatchOrderId: readyOrder.dispatchOrderId,
    plannedSkuQtyLines: [{ colorName: 'Black', colorCode: 'Black', sizeCode: 'L', plannedGarmentQty: 1 }],
  })
  const secondBags = createCuttingSewingTransferBags({
    dispatchBatchId: secondBatch.dispatchBatchId,
    bagPlanList: [{ plannedGarmentQty: 1, skuQtyLines: secondBatch.plannedSkuQtyLines }],
  })
  pickSeedFeiTicketNos(secondBatch, ['FT-CUT-260308-081-01-002', 'FT-CUT-260308-081-01-004', 'FT-CUT-260308-081-03-004']).forEach((feiTicketNo) => {
    scanFeiTicketIntoTransferBag({ transferBagId: secondBags[0].transferBagId, feiTicketNo })
  })
  validateDispatchBatchCompleteness(secondBatch.dispatchBatchId)

  const blockedOrder = createCuttingSewingDispatchOrder({ productionOrderId: 'PO-202603-0014', remark: '特殊工艺未回仓示例' })
  const blockedBatch = createCuttingSewingDispatchBatch({
    dispatchOrderId: blockedOrder.dispatchOrderId,
    plannedSkuQtyLines: [{ colorName: 'Navy', colorCode: 'Navy', sizeCode: 'S', plannedGarmentQty: 1 }],
  })
  const blockedBags = createCuttingSewingTransferBags({
    dispatchBatchId: blockedBatch.dispatchBatchId,
    bagPlanList: [{ plannedGarmentQty: 1, skuQtyLines: blockedBatch.plannedSkuQtyLines }],
  })
  scanFeiTicketIntoTransferBag({ transferBagId: blockedBags[0].transferBagId, feiTicketNo: 'FT-CUT-260226-014-01-001' })
  validateDispatchBatchCompleteness(blockedBatch.dispatchBatchId)
  const blockedPieceLine = blockedBags[0].pieceLines[0]
  if (blockedPieceLine && !storeRef.validationResults.some((item) => item.validationType === '特殊工艺未回仓')) {
    storeRef.validationResults.push({
      validationId: `CSV-${blockedBags[0].transferBagId}-SPECIAL-001`,
      dispatchOrderId: blockedBags[0].dispatchOrderId,
      dispatchBatchId: blockedBags[0].dispatchBatchId,
      transferBagId: blockedBags[0].transferBagId,
      productionOrderId: blockedBags[0].productionOrderId,
      productionOrderNo: blockedBags[0].productionOrderNo,
      colorName: blockedPieceLine.colorName,
      sizeCode: blockedPieceLine.sizeCode,
      partName: blockedPieceLine.partName,
      requiredPieceQty: blockedPieceLine.requiredPieceQty,
      scannedPieceQty: blockedPieceLine.scannedPieceQty,
      missingPieceQty: blockedPieceLine.missingPieceQty,
      overPieceQty: blockedPieceLine.overPieceQty,
      specialCraftRequired: true,
      specialCraftStatus: '未回仓',
      validationType: '特殊工艺未回仓',
      validationMessage: '特殊工艺未回仓，不能交出',
      blocking: true,
    })
  }
  void storeRef
}

export function ensureCuttingSewingDispatchSeeded(): CuttingSewingDispatchStore {
  if (!store) {
    store = {
      dispatchOrders: [],
      dispatchBatches: [],
      transferBags: [],
      validationResults: [],
    }
    seedStore()
  }
  return store
}

export function listCuttingSewingDispatchOrders(): CuttingSewingDispatchOrder[] {
  return clone(ensureCuttingSewingDispatchSeeded().dispatchOrders)
}

export function listCuttingSewingDispatchBatches(): CuttingSewingDispatchBatch[] {
  return clone(ensureCuttingSewingDispatchSeeded().dispatchBatches)
}

export function listCuttingSewingTransferBags(): CuttingSewingTransferBag[] {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  storeRef.transferBags.forEach(normalizeTransferBagRuntimeFields)
  return clone(storeRef.transferBags)
}

export function listCuttingSewingDispatchValidationResults(): CuttingSewingDispatchValidationResult[] {
  return clone(ensureCuttingSewingDispatchSeeded().validationResults)
}

export function findCuttingSewingDispatchByFeiTicketNo(feiTicketNo: string): {
  dispatchOrder?: CuttingSewingDispatchOrder
  dispatchBatch?: CuttingSewingDispatchBatch
  transferBag?: CuttingSewingTransferBag
  feiTicketSewingStatus: '未装袋' | '已装袋' | '已交出' | '已回写' | '差异' | '异议中'
  specialCraftReturnStatus: CuttingSewingSpecialCraftReturnStatus
} {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const bag = storeRef.transferBags.find((item) => item.scannedFeiTicketNos.includes(feiTicketNo))
  if (bag) normalizeTransferBagRuntimeFields(bag)
  const batch = bag ? storeRef.dispatchBatches.find((item) => item.dispatchBatchId === bag.dispatchBatchId) : undefined
  const order = batch ? storeRef.dispatchOrders.find((item) => item.dispatchOrderId === batch.dispatchOrderId) : undefined
  const specialCraft = mapSpecialCraftReturnStatus(feiTicketNo)
  const status =
    bag?.status === '已回写'
      ? '已回写'
      : bag?.status === '差异'
        ? '差异'
        : bag?.status === '异议中'
          ? '异议中'
          : bag?.status === '已交出'
            ? '已交出'
            : bag
              ? '已装袋'
              : '未装袋'
  return {
    dispatchOrder: order ? clone(order) : undefined,
    dispatchBatch: batch ? clone(batch) : undefined,
    transferBag: bag ? clone(bag) : undefined,
    feiTicketSewingStatus: status,
    specialCraftReturnStatus: specialCraft.specialCraftReturnStatus,
  }
}

export function getCuttingSewingDispatchByHandoverRecordId(handoverRecordId: string): {
  dispatchOrder?: CuttingSewingDispatchOrder
  dispatchBatch?: CuttingSewingDispatchBatch
  transferBags: CuttingSewingTransferBag[]
} {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const batch = storeRef.dispatchBatches.find((item) => item.handoverRecordId === handoverRecordId)
  if (!batch) return { transferBags: [] }
  const order = storeRef.dispatchOrders.find((item) => item.dispatchOrderId === batch.dispatchOrderId)
  return {
    dispatchOrder: order ? clone(order) : undefined,
    dispatchBatch: clone(batch),
    transferBags: clone(storeRef.transferBags.filter((bag) => {
      const matched = batch.transferBagIds.includes(bag.transferBagId)
      if (matched) normalizeTransferBagRuntimeFields(bag)
      return matched
    })),
  }
}

export function getCuttingSewingDispatchSummary(): {
  waitingCompleteOrderCount: number
  readyBatchCount: number
  handedOverBatchCount: number
  writtenBackBatchCount: number
  differenceBatchCount: number
  objectionBatchCount: number
  remainingGarmentQty: number
} {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  return {
    waitingCompleteOrderCount: storeRef.dispatchOrders.filter((order) => order.status === '待配齐' || order.status === '待扫码').length,
    readyBatchCount: storeRef.dispatchBatches.filter((batch) => batch.status === '已配齐').length,
    handedOverBatchCount: storeRef.dispatchBatches.filter((batch) => batch.status === '已交出').length,
    writtenBackBatchCount: storeRef.dispatchBatches.filter((batch) => batch.status === '已回写').length,
    differenceBatchCount: storeRef.dispatchBatches.filter((batch) => batch.status === '差异').length,
    objectionBatchCount: storeRef.dispatchBatches.filter((batch) => batch.status === '异议中').length,
    remainingGarmentQty: sum(storeRef.dispatchOrders.map((order) => order.remainingGarmentQty)),
  }
}
