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
  type PdaCuttingHandoverRecordSummary,
  type PdaCutPieceHandoutLine,
  type PdaHandoverHead,
  type PdaHandoverRecord,
  type TransferBagFeiTicketWritebackLine,
  type TransferBagWritebackLine,
} from '../pda-handover-events.ts'
import { buildHandoverOrderQrValue } from '../task-qr.ts'
import {
  getFeiTicketByNo,
  listSpreadingResultGeneratedFeiTickets,
  type GeneratedFeiTicketSourceRecord,
} from './generated-fei-tickets.ts'
import {
  getSpecialCraftFeiTicketSummary,
  listCuttingSpecialCraftFeiTicketBindingsForProjection,
  type CuttingSpecialCraftFeiTicketBinding,
} from './special-craft-fei-ticket-flow.ts'

export type CuttingSewingDispatchOrderStatus =
  | '草稿'
  | '待核对'
  | '待扫码'
  | '可交出'
  | '已交出'
  | '已回写'
  | '差异'
  | '异议中'
  | '已关闭'

export type CuttingSewingDispatchValidationStatus = '未校验' | '校验通过' | '校验未通过'
export type CuttingSewingDispatchBatchStatus = '草稿' | '待装袋' | '装袋中' | '已核对' | '已交出' | '已回写' | '差异' | '异议中'
export type CuttingSewingCompletenessStatus = '未校验' | '有缺口' | '已核对'
export type CuttingSewingTransferBagStatus = '待装袋' | '装袋中' | '已核对' | '已交出' | '已回写' | '差异' | '异议中'
export type CuttingSewingTransferBagDispatchStatus = '未交出' | '已交出' | '已回写' | '差异' | '异议中'
export type CuttingSewingPieceLineCompleteStatus = '有缺口' | '已核对' | '超出'
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
    | '中转袋待核对'
    | '通过'
  validationMessage: string
  blocking: boolean
}

export interface CuttingSewingDispatchInventoryPieceLine {
  productionOrderId: string
  productionOrderNo: string
  cutOrderIds: string[]
  cutOrderNos: string[]
  colorName: string
  colorCode: string
  sizeCode: string
  partName: string
  materialSku: string
  feiTicketNos: string[]
  availableFeiTicketCount: number
  availablePieceQty: number
  availableGarmentQty: number
}

export interface CuttingSewingDispatchInventorySkuLine {
  productionOrderId: string
  productionOrderNo: string
  colorName: string
  colorCode: string
  sizeCode: string
  partNames: string[]
  cutOrderNos: string[]
  availableFeiTicketCount: number
  availablePieceQty: number
  availableGarmentQty: number
}

export interface SewingTaskAllocationInventoryRecord {
  inventoryRecordId: string
  feiTicketId: string
  feiTicketNo: string
  cutOrderId: string
  cutOrderNo?: string
  productionOrderId: string
  productionOrderNo?: string
  spuCode: string
  color: string
  size: string
  partName: string
  pieceQty: number
  pieceSequenceLabel: string
  hasSpecialCraft?: boolean
  specialCraftDisplay?: string
  receiverFactoryDisplay?: string
  printStatus?: string
  voidStatus?: string
  tempBagCode: string
  warehouseArea: string
  locationCode: string
  inboundAt: string
  inventoryStatus: string
}

export interface SewingTaskAllocationItem {
  allocationItemId: string
  feiTicketId: string
  feiTicketNo: string
  inventoryRecordId: string
  productionOrderNo: string
  cutOrderNo: string
  size: string
  partCode: string
  partName: string
  pieceQty: number
  pieceSequenceLabel: string
  tempBagCode: string
  inventoryLocation: string
  hasSpecialCraft: boolean
  specialCraftReturnStatus: CuttingSewingSpecialCraftReturnStatus
}

export interface SewingTaskAllocationShortageItem {
  size: string
  partCode: string
  partName: string
  requiredQty: number
  allocatedQty: number
  shortageQty: number
  unit: '片'
  shortageReason: string
}

export interface SewingTaskAllocationSpecialCraftPendingItem {
  feiTicketId: string
  feiTicketNo?: string
  partName: string
  specialCraftType: string
  receiverFactoryName: string
  expectedReturnStatus: CuttingSewingSpecialCraftReturnStatus
  pendingQty: number
}

export interface InventoryReservation {
  reservationId: string
  inventoryRecordId: string
  sewingTaskId: string
  feiTicketId: string
  reservedQty: number
  unit: '片'
  reservedAt: string
  reservedBy: string
  reservationStatus: '有效' | '已释放' | '已占用'
}

export interface SewingTaskAllocation {
  sewingTaskId: string
  sewingTaskNo: string
  sourceType: '裁床待交出仓库存'
  sourceWarehouseId: string
  sourceWarehouseName: string
  productionOrderIds: string[]
  cutOrderIds: string[]
  spuCode: string
  styleName: string
  color: string
  receiverFactoryId: string
  receiverFactoryCode: string
  receiverFactoryName: string
  allocationBasis: '基于裁床待交出仓已有菲票 / 裁片库存'
  allocationStatus: '候选' | '已占用' | '已取消'
  allocatedItems: SewingTaskAllocationItem[]
  shortageItems: SewingTaskAllocationShortageItem[]
  specialCraftPendingItems: SewingTaskAllocationSpecialCraftPendingItem[]
  inventoryReservationIds: string[]
  createdAt: string
  createdBy: string
  remark: string
}

export interface SewingTaskAllocationExcludedInventoryItem {
  inventoryRecordId: string
  feiTicketNo: string
  exclusionReason: string
}

export interface SewingTaskAllocationProjection {
  allocations: SewingTaskAllocation[]
  reservations: InventoryReservation[]
  releasedReservations: InventoryReservation[]
  excludedItems: SewingTaskAllocationExcludedInventoryItem[]
  specialCraftPendingItems: SewingTaskAllocationSpecialCraftPendingItem[]
  availableInventoryCount: number
  availablePieceQty: number
  reservedInventoryCount: number
  reservedPieceQty: number
  shortageCount: number
  specialCraftPendingCount: number
  cancelledAllocationCount: number
  ruleNotes: string[]
}

export type HandoverPickingTaskStatus =
  | '待分拣'
  | '分拣中'
  | '已分拣待装袋'
  | '已装袋待交出'
  | '已关闭'

export interface HandoverPickingRequiredItem {
  size: string
  partCode: string
  partName: string
  requiredQty: number
  unit: '片'
}

export interface HandoverPickingAllocatedInventoryItem {
  inventoryRecordId: string
  feiTicketId: string
  feiTicketNo: string
  tempBagCode: string
  locationCode: string
  size: string
  partCode: string
  partName: string
  pieceQty: number
  pieceSequenceLabel: string
  specialCraftReturnStatus: CuttingSewingSpecialCraftReturnStatus
}

export interface HandoverPickingPickedItem {
  feiTicketId: string
  feiTicketNo: string
  scannedAt: string
  scannedBy: string
  sourceTempBagCode: string
  targetTransferBagCode: string
  size: string
  partCode: string
  partName: string
  pickedQty: number
  checkResult: '通过' | '拒绝' | '提示'
}

export interface HandoverPickingShortageItem {
  size: string
  partCode: string
  partName: string
  requiredQty: number
  pickedQty: number
  shortageQty: number
  shortageReason: string
}

export interface HandoverPickingTempBagSource {
  tempBagCode: string
  feiTicketCount: number
  pieceQty: number
  locationCode: string
}

export interface TargetTransferBagUse {
  bagUseId: string
  bagCode: string
  bagMasterId: string
  useStage: '交出装袋'
  sewingTaskId: string
  sewingTaskNo: string
  pickingTaskId: string
  containedFeiTickets: Array<{
    feiTicketId: string
    feiTicketNo: string
    pieceQty: number
  }>
  totalPieceQty: number
  packedAt: string
  packedBy: string
  bagStatus: '装袋中' | '已装袋待交出' | '异常'
}

export interface HandoverPickingTask {
  pickingTaskId: string
  pickingTaskNo: string
  sewingTaskId: string
  sewingTaskNo: string
  receiverFactoryId: string
  receiverFactoryCode: string
  receiverFactoryName: string
  sourceWarehouseId: string
  sourceWarehouseName: string
  taskStatus: HandoverPickingTaskStatus
  requiredItems: HandoverPickingRequiredItem[]
  allocatedInventoryItems: HandoverPickingAllocatedInventoryItem[]
  pickedItems: HandoverPickingPickedItem[]
  shortageItems: HandoverPickingShortageItem[]
  tempBagSources: HandoverPickingTempBagSource[]
  targetTransferBags: TargetTransferBagUse[]
  createdAt: string
  createdBy: string
  updatedAt: string
}

export interface HandoverPickingScanCheck {
  checkId: string
  pickingTaskNo: string
  scanObject: '配料任务码' | '来源入仓暂存袋' | '菲票' | '目标中转袋'
  scannedValue: string
  checkResult: '通过' | '拒绝' | '提示'
  reason: string
  syncStatus: '已同步' | '待同步' | '同步失败'
}

export interface HandoverPickingTaskProjection {
  tasks: HandoverPickingTask[]
  targetTransferBags: TargetTransferBagUse[]
  scanChecks: HandoverPickingScanCheck[]
  taskCount: number
  pendingCount: number
  sortingCount: number
  packedCount: number
  shortageCount: number
  targetTransferBagCount: number
  syncFailedCount: number
  ruleNotes: string[]
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

function isHandoverGapResult(result: Pick<CuttingSewingDispatchValidationResult, 'blocking' | 'validationType'>): boolean {
  return !result.blocking && result.validationType !== '通过'
}

function formatDispatchGapLine(result: CuttingSewingDispatchValidationResult): string {
  const subject = [result.colorName, result.sizeCode, result.partName].filter(Boolean).join('/')
  if (result.validationType === '缺少裁片') {
    return `${subject || '裁片'}缺 ${result.missingPieceQty} 片`
  }
  if (result.validationType === '裁片超出') {
    return `${subject || '裁片'}多 ${result.overPieceQty} 片`
  }
  if (
    result.validationType === '特殊工艺未回仓' ||
    result.validationType === '特殊工艺差异' ||
    result.validationType === '特殊工艺异议中'
  ) {
    return `${subject || '裁片'}${result.validationMessage}`
  }
  return `${subject || '裁片'}${result.validationMessage}`
}

function buildDispatchGapSummary(results: CuttingSewingDispatchValidationResult[]): string {
  const gaps = results.filter(isHandoverGapResult)
  if (!gaps.length) return ''
  const preview = gaps.slice(0, 4).map(formatDispatchGapLine)
  const restCount = Math.max(gaps.length - preview.length, 0)
  return `交出后缺口：${preview.join('；')}${restCount > 0 ? `；另 ${restCount} 项` : ''}`
}

function makeCutPieceLineKey(line: Pick<RequiredCutPieceLine, 'colorName' | 'sizeCode' | 'partName'>): string {
  return `${line.colorName}|${line.sizeCode}|${line.partName}`
}

function buildCuttingHandoverRecordSummary(
  storeRef: CuttingSewingDispatchStore,
  order: CuttingSewingDispatchOrder,
  currentBatch: CuttingSewingDispatchBatch,
  currentSubmittedPieceQty: number,
): PdaCuttingHandoverRecordSummary {
  const previousBatches = storeRef.dispatchBatches.filter(
    (batch) =>
      batch.dispatchOrderId === order.dispatchOrderId &&
      batch.dispatchBatchId !== currentBatch.dispatchBatchId &&
      Boolean(batch.handoverRecordId),
  )
  const involvedBatches = [...previousBatches, currentBatch]
  const requiredByKey = new Map<
    string,
    {
      skuCode: string
      colorName: string
      sizeCode: string
      partName: string
      requiredPieceQty: number
      specialCraftRequired: boolean
      specialCraftStatus: CuttingSewingSpecialCraftReturnStatus
    }
  >()
  const submittedByKey = new Map<string, number>()

  involvedBatches.forEach((batch) => {
    getRequiredLinesForBag(batch).forEach((line) => {
      const key = makeCutPieceLineKey(line)
      const current = requiredByKey.get(key) || {
        skuCode: `${line.colorName}-${line.sizeCode}`,
        colorName: line.colorName,
        sizeCode: line.sizeCode,
        partName: line.partName,
        requiredPieceQty: 0,
        specialCraftRequired: false,
        specialCraftStatus: '不需要特殊工艺' as CuttingSewingSpecialCraftReturnStatus,
      }
      current.requiredPieceQty += line.requiredPieceQty
      current.specialCraftRequired = current.specialCraftRequired || line.specialCraftRequired
      if (line.specialCraftRequired && line.specialCraftReturnStatus !== '已回仓') {
        current.specialCraftStatus = line.specialCraftReturnStatus
      } else if (line.specialCraftRequired && current.specialCraftStatus === '不需要特殊工艺') {
        current.specialCraftStatus = line.specialCraftReturnStatus
      }
      requiredByKey.set(key, current)
    })
    batch.transferBagIds.forEach((bagId) => {
      const bag = findTransferBagById(storeRef, bagId)
      normalizeTransferBagRuntimeFields(bag)
      bag.pieceLines.forEach((line) => {
        const key = makeCutPieceLineKey(line)
        submittedByKey.set(key, (submittedByKey.get(key) || 0) + line.scannedPieceQty)
        if (!requiredByKey.has(key)) {
          requiredByKey.set(key, {
            skuCode: `${line.colorName}-${line.sizeCode}`,
            colorName: line.colorName,
            sizeCode: line.sizeCode,
            partName: line.partName,
            requiredPieceQty: 0,
            specialCraftRequired: line.specialCraftRequired,
            specialCraftStatus: line.specialCraftReturnStatus,
          })
        }
      })
    })
  })

  const gapLines = Array.from(requiredByKey.entries())
    .map(([key, line]) => {
      const cumulativeSubmittedPieceQty = submittedByKey.get(key) || 0
      const missingPieceQty = Math.max(line.requiredPieceQty - cumulativeSubmittedPieceQty, 0)
      const overPieceQty = Math.max(cumulativeSubmittedPieceQty - line.requiredPieceQty, 0)
      const hasSpecialCraftGap = line.specialCraftRequired && line.specialCraftStatus !== '已回仓'
      const statusLabel =
        hasSpecialCraftGap
          ? line.specialCraftStatus === '差异'
            ? '特殊工艺差异'
            : line.specialCraftStatus === '异议中'
              ? '特殊工艺异议中'
              : '特殊工艺未回仓'
          : missingPieceQty > 0
            ? '缺少裁片'
            : overPieceQty > 0
              ? '裁片超出'
              : ''
      return {
        lineId: `CUT-GAP-${order.dispatchOrderId}-${key}`,
        skuCode: line.skuCode,
        colorName: line.colorName,
        sizeCode: line.sizeCode,
        partName: line.partName,
        requiredPieceQty: line.requiredPieceQty,
        cumulativeSubmittedPieceQty,
        missingPieceQty,
        overPieceQty,
        specialCraftRequired: line.specialCraftRequired,
        specialCraftStatus: line.specialCraftStatus,
        statusLabel,
      }
    })
    .filter((line) => line.missingPieceQty > 0 || line.overPieceQty > 0 || line.statusLabel.includes('特殊工艺'))
    .sort((left, right) =>
      `${left.colorName}-${left.sizeCode}-${left.partName}`.localeCompare(
        `${right.colorName}-${right.sizeCode}-${right.partName}`,
        'zh-CN',
      ),
    )

  const previousSubmittedPieceQty = sum(previousBatches.map((batch) => getDispatchBatchPieceQty(storeRef, batch)))
  const gapPieceQtyTotal = sum(gapLines.map((line) => line.missingPieceQty))
  const overPieceQtyTotal = sum(gapLines.map((line) => line.overPieceQty))
  return {
    previousSubmittedPieceQty,
    currentSubmittedPieceQty,
    cumulativeSubmittedPieceQty: previousSubmittedPieceQty + currentSubmittedPieceQty,
    completeAfterSubmit: gapPieceQtyTotal === 0 && !gapLines.some((line) => line.statusLabel.includes('特殊工艺')),
    gapPieceQtyTotal,
    overPieceQtyTotal,
    gapLines,
  }
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
  // 特殊工艺差异待处理不阻断裁片交出：最后一道已回仓、当前所在为裁床厂待交出仓且 currentQty > 0，即可进入交出缺口核对。
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

function buildReturnedSpecialCraftFeiTicketSource(binding: CuttingSpecialCraftFeiTicketBinding): GeneratedFeiTicketSourceRecord {
  const qty = Math.max(binding.currentQty || binding.returnedQty || binding.qty || 0, 0)
  const issuedAt = binding.updatedAt || nowText()
  const feiTicketId = binding.feiTicketId || `SC-RET-${binding.bindingId}`
  const pieceScope = unique([binding.colorName, binding.sizeCode, binding.partName, binding.operationName])
  const sourceOutputLineId = `SC-RET-${binding.bindingId}`
  const qrPayload = {
    codeType: 'FEI_TICKET' as const,
    version: '2.0.0',
    issuedAt,
    feiTicketId,
    feiTicketNo: binding.feiTicketNo,
    cutOrderId: binding.cuttingOrderId,
    cutOrderNo: binding.cuttingOrderNo,
    productionOrderId: binding.productionOrderId,
    productionOrderNo: binding.productionOrderNo,
    sourceOutputLineId,
    fabricRollId: `SC-RET-${binding.operationId}`,
    fabricRollNo: `${binding.operationName}回仓`,
    fabricColor: binding.colorName,
    materialSku: `SPECIAL-CRAFT-${binding.operationId}`,
    garmentSkuId: `${binding.colorName}-${binding.sizeCode}`,
    garmentColor: binding.colorName,
    pieceScope,
    pieceGroup: binding.partName,
    bundleScope: `${binding.colorName}-${binding.sizeCode}-${binding.partName}`,
    skuColor: binding.colorName,
    skuSize: binding.sizeCode,
    partCode: binding.partName,
    partName: binding.partName,
    bundleNo: binding.feiTicketNo,
    bundleQty: qty,
    pieceSetNoStart: 1,
    pieceSetNoEnd: qty,
    pieceSetNoRange: `1-${qty}`,
    bundleTicketType: '特殊工艺回仓',
    actualCutPieceQty: qty,
    qty,
    secondaryCrafts: [binding.operationName],
    craftSequenceVersion: `${binding.operationId}:returned`,
    currentCraftStage: '已回仓',
  }
  return {
    feiTicketId,
    feiTicketNo: binding.feiTicketNo,
    sourceOutputLineId,
    sourceSpreadingSessionId: binding.returnHandoverRecordId || binding.bindingId,
    sourceSpreadingSessionNo: binding.returnHandoverRecordNo || binding.taskOrderNo,
    sourceMarkerId: binding.workOrderId,
    sourceMarkerNo: binding.workOrderNo,
    cutOrderId: binding.cuttingOrderId,
    cutOrderNo: binding.cuttingOrderNo,
    productionOrderId: binding.productionOrderId,
    productionOrderNo: binding.productionOrderNo,
    sourceMarkerPlanId: binding.taskOrderId,
    sourceMarkerPlanNo: binding.taskOrderNo,
    fabricRollId: qrPayload.fabricRollId,
    fabricRollNo: qrPayload.fabricRollNo,
    fabricColor: binding.colorName,
    materialSku: qrPayload.materialSku,
    garmentSkuId: qrPayload.garmentSkuId,
    garmentColor: binding.colorName,
    pieceScope,
    pieceGroup: binding.partName,
    bundleScope: qrPayload.bundleScope,
    skuCode: `${binding.colorName}-${binding.sizeCode}`,
    skuColor: binding.colorName,
    skuSize: binding.sizeCode,
    partCode: binding.partName,
    partName: binding.partName,
    bundleNo: binding.feiTicketNo,
    bundleQty: qty,
    pieceSetNoStart: 1,
    pieceSetNoEnd: qty,
    pieceSetNoRange: `1-${qty}`,
    bundleTicketType: '特殊工艺回仓',
    actualCutPieceQty: qty,
    printStatus: 'PRINTED',
    qty,
    garmentQty: qty,
    sourceTraceCompleteness: 'COMPLETE',
    secondaryCrafts: [binding.operationName],
    craftSequenceVersion: `${binding.operationId}:returned`,
    currentCraftStage: '已回仓',
    sourceTechPackSpuCode: binding.productionOrderNo,
    sourceBasisType: 'SPREADING_RESULT',
    issuedAt,
    qrPayload,
    qrValue: `SPECIAL-CRAFT-RETURN:${binding.feiTicketNo}`,
  }
}

function listReturnedSpecialCraftFeiTicketSourcesForSewingDispatch(): GeneratedFeiTicketSourceRecord[] {
  const byFeiTicketNo = new Map<string, CuttingSpecialCraftFeiTicketBinding>()
  listCuttingSpecialCraftFeiTicketBindingsForProjection().forEach((binding) => {
    const summary = getSpecialCraftFeiTicketSummary(binding.feiTicketNo)
    if (!summary.needSpecialCraft) return
    if (!summary.returnStatus.includes('已回仓')) return
    if (summary.currentLocation !== '裁床厂待交出仓') return
    if (summary.currentQty <= 0) return
    if (binding.specialCraftFlowStatus !== '已回仓') return
    const current = byFeiTicketNo.get(binding.feiTicketNo)
    if (!current || binding.updatedAt.localeCompare(current.updatedAt) >= 0) {
      byFeiTicketNo.set(binding.feiTicketNo, binding)
    }
  })
  return [...byFeiTicketNo.values()].map(buildReturnedSpecialCraftFeiTicketSource)
}

function listSewingDispatchFeiTicketSources(): GeneratedFeiTicketSourceRecord[] {
  const byNo = new Map<string, GeneratedFeiTicketSourceRecord>()
  listSpreadingResultGeneratedFeiTickets().forEach((ticket) => byNo.set(ticket.feiTicketNo, ticket))
  listReturnedSpecialCraftFeiTicketSourcesForSewingDispatch().forEach((ticket) => byNo.set(ticket.feiTicketNo, ticket))
  return [...byNo.values()]
}

function resolveFeiTicketForSewingDispatch(feiTicketNo: string): GeneratedFeiTicketSourceRecord | null {
  return getFeiTicketByNo(feiTicketNo) || listReturnedSpecialCraftFeiTicketSourcesForSewingDispatch().find((ticket) => ticket.feiTicketNo === feiTicketNo) || null
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
    const ticket = resolveFeiTicketForSewingDispatch(feiTicketNo)
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
  if (!batch) throw new Error(`未找到本次交出记录：${dispatchBatchId}`)
  return batch
}

function findDispatchOrderById(storeRef: CuttingSewingDispatchStore, dispatchOrderId: string): CuttingSewingDispatchOrder {
  const order = storeRef.dispatchOrders.find((item) => item.dispatchOrderId === dispatchOrderId)
  if (!order) throw new Error(`未找到交出单：${dispatchOrderId}`)
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
    completeStatus: '有缺口',
  }
}

function updateDispatchOrderFromChildren(order: CuttingSewingDispatchOrder): void {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const batches = storeRef.dispatchBatches.filter((batch) => order.dispatchBatchIds.includes(batch.dispatchBatchId))
  const bags = storeRef.transferBags.filter((bag) => order.transferBagIds.includes(bag.transferBagId))
  order.cumulativeDispatchedGarmentQty = sum(
    batches
      .filter((batch) => batch.status === '已交出' || batch.status === '已回写' || batch.status === '差异' || batch.status === '异议中')
      .map((batch) => getDispatchBatchSubmittedGarmentQty(storeRef, batch)),
  )
  order.remainingGarmentQty = Math.max(order.totalProductionQty - order.cumulativeDispatchedGarmentQty, 0)
  order.feiTicketNos = unique(bags.flatMap((bag) => bag.scannedFeiTicketNos))
  order.receiverWrittenQty = sum(batches.map((batch) => batch.receiverWrittenQty || 0))
  order.differenceQty = sum(batches.map((batch) => batch.differenceQty || 0))
  order.validationStatus = batches.every((batch) => batch.completeStatus === '已核对') ? '校验通过' : '校验未通过'
  order.validationMessages = unique(
    storeRef.validationResults
      .filter((item) => item.dispatchOrderId === order.dispatchOrderId && item.blocking)
      .map((item) => item.validationMessage),
  )
  if (batches.some((batch) => batch.status === '异议中')) order.status = '异议中'
  else if (batches.some((batch) => batch.status === '差异')) order.status = '差异'
  else if (batches.length && batches.every((batch) => batch.status === '已回写')) order.status = '已回写'
  else if (batches.some((batch) => batch.status === '已交出')) order.status = '已交出'
  else if (batches.some((batch) => batch.completeStatus === '已核对')) order.status = '可交出'
  else if (batches.some((batch) => batch.status === '装袋中' || batch.status === '待装袋')) order.status = '待扫码'
  else order.status = '待核对'
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

  const tickets = listReadyFeiTicketSourcesForSewingDispatch({ productionOrderId: productionOrder.productionOrderId })
  const lines: RequiredCutPieceLine[] = []
  const seen = new Set<string>()

  for (const plannedLine of plannedSkuQtyLines) {
    if (plannedLine.plannedGarmentQty <= 0) {
      errors.push('本次交出件数必须大于 0')
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
      warnings.push('本次交出数量高于生产单需求数量，请按实际裁片库存继续核对缺口。')
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
    const candidatePartNames = new Set(candidateParts.map((part) => part.partNameCn))

    for (const part of candidateParts) {
      if (!ticketPartNames.has(part.partNameCn)) {
        warnings.push(`裁片部位 ${part.partNameCn} 暂无匹配菲票，当前交出先按可扫码部位核对。`)
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

    ticketPartNames.forEach((partName) => {
      if (candidatePartNames.has(partName)) return
      const key = `${plannedLine.colorName}|${plannedLine.sizeCode}|${partName}`
      if (seen.has(key)) return
      seen.add(key)
      const sampleTicket = tickets.find(
        (ticket) =>
          ticket.garmentColor === plannedLine.colorName &&
          ticket.skuSize === plannedLine.sizeCode &&
          ticket.partName === partName,
      )
      const specialCraft = sampleTicket
        ? mapSpecialCraftReturnStatus(sampleTicket.feiTicketNo)
        : { specialCraftRequired: false, specialCraftReturnStatus: '不需要特殊工艺' as const }
      warnings.push(`裁片部位 ${partName} 来自裁床待交出仓菲票，技术包未配置该部位，当前交出按 1:1 核对。`)
      lines.push({
        partName,
        colorName: plannedLine.colorName,
        colorCode: plannedLine.colorCode,
        sizeCode: plannedLine.sizeCode,
        pieceCountPerGarment: 1,
        garmentQty: plannedLine.plannedGarmentQty,
        requiredPieceQty: plannedLine.plannedGarmentQty,
        specialCraftRequired: specialCraft.specialCraftRequired,
        specialCraftReturnStatus: specialCraft.specialCraftReturnStatus,
      })
    })
  }

  return { requiredPieceLines: lines, errors, warnings }
}

function listReadyFeiTicketSourcesForSewingDispatch(input: {
  productionOrderId?: string
  colorName?: string
  sizeCode?: string
  partName?: string
  excludeBagId?: string
} = {}): GeneratedFeiTicketSourceRecord[] {
  return listSewingDispatchFeiTicketSources().filter((ticket) => {
    if (input.productionOrderId && ticket.productionOrderId !== input.productionOrderId) return false
    if (input.colorName && ticket.garmentColor !== input.colorName) return false
    if (input.sizeCode && ticket.skuSize !== input.sizeCode) return false
    if (input.partName && ticket.partName !== input.partName) return false
    const specialCraft = mapSpecialCraftReturnStatus(ticket.feiTicketNo)
    if (!specialCraft.specialCraftRequired) return true
    return specialCraft.specialCraftReturnStatus === '已回仓'
  })
}

function listAvailableFeiTicketsForSewingDispatchInternal(input: {
  productionOrderId?: string
  colorName?: string
  sizeCode?: string
  partName?: string
  excludeBagId?: string
} = {}): GeneratedFeiTicketSourceRecord[] {
  const occupied = getOccupiedFeiTicketNos({ excludeBagId: input.excludeBagId })
  return listReadyFeiTicketSourcesForSewingDispatch(input).filter((ticket) => !occupied.has(ticket.feiTicketNo))
}

function getAvailablePieceQtyForSkuLine(productionOrderId: string, colorName: string, sizeCode: string): number {
  return sum(
    listAvailableFeiTicketsForSewingDispatchInternal({ productionOrderId, colorName, sizeCode })
      .map((ticket) => getTicketDispatchQty(ticket)),
  )
}

export function getEligibleFeiTicketsForSewingDispatch(input: {
  productionOrderId: string
  colorName?: string
  sizeCode?: string
  partName?: string
  excludeBagId?: string
}): GeneratedFeiTicketSourceRecord[] {
  return clone(listAvailableFeiTicketsForSewingDispatchInternal(input))
}

export function listAvailableFeiTicketsForSewingDispatch(input: {
  productionOrderId?: string
  colorName?: string
  sizeCode?: string
  partName?: string
  excludeBagId?: string
} = {}): GeneratedFeiTicketSourceRecord[] {
  return clone(listAvailableFeiTicketsForSewingDispatchInternal(input))
}

export function listAvailableCutPieceInventoryForSewingDispatch(input: {
  productionOrderId?: string
  colorName?: string
  sizeCode?: string
  partName?: string
  excludeBagId?: string
} = {}): CuttingSewingDispatchInventoryPieceLine[] {
  const grouped = new Map<string, CuttingSewingDispatchInventoryPieceLine>()
  listAvailableFeiTicketsForSewingDispatchInternal(input).forEach((ticket) => {
    const key = `${ticket.productionOrderId}|${ticket.garmentColor}|${ticket.skuSize}|${ticket.partName}|${ticket.materialSku}`
    const current = grouped.get(key) || {
      productionOrderId: ticket.productionOrderId,
      productionOrderNo: ticket.productionOrderNo,
      cutOrderIds: [],
      cutOrderNos: [],
      colorName: ticket.garmentColor,
      colorCode: ticket.skuColor || ticket.garmentColor,
      sizeCode: ticket.skuSize,
      partName: ticket.partName,
      materialSku: ticket.materialSku,
      feiTicketNos: [],
      availableFeiTicketCount: 0,
      availablePieceQty: 0,
      availableGarmentQty: 0,
    }
    current.cutOrderIds = unique([...current.cutOrderIds, ticket.cutOrderId])
    current.cutOrderNos = unique([...current.cutOrderNos, ticket.cutOrderNo])
    current.feiTicketNos = unique([...current.feiTicketNos, ticket.feiTicketNo])
    current.availableFeiTicketCount = current.feiTicketNos.length
    current.availablePieceQty += getTicketDispatchQty(ticket)
    current.availableGarmentQty += Math.max(ticket.garmentQty || 0, 0)
    grouped.set(key, current)
  })
  return clone([...grouped.values()].sort((left, right) =>
    `${left.productionOrderNo}-${left.colorName}-${left.sizeCode}-${left.partName}`.localeCompare(
      `${right.productionOrderNo}-${right.colorName}-${right.sizeCode}-${right.partName}`,
      'zh-CN',
    ),
  ))
}

export function listAvailableSkuInventoryForSewingDispatch(input: {
  productionOrderId?: string
  colorName?: string
  sizeCode?: string
  excludeBagId?: string
} = {}): CuttingSewingDispatchInventorySkuLine[] {
  const grouped = new Map<string, CuttingSewingDispatchInventorySkuLine>()
  listAvailableCutPieceInventoryForSewingDispatch(input).forEach((line) => {
    const key = `${line.productionOrderId}|${line.colorName}|${line.sizeCode}`
    const current = grouped.get(key) || {
      productionOrderId: line.productionOrderId,
      productionOrderNo: line.productionOrderNo,
      colorName: line.colorName,
      colorCode: line.colorCode,
      sizeCode: line.sizeCode,
      partNames: [],
      cutOrderNos: [],
      availableFeiTicketCount: 0,
      availablePieceQty: 0,
      availableGarmentQty: 0,
    }
    current.partNames = unique([...current.partNames, line.partName])
    current.cutOrderNos = unique([...current.cutOrderNos, ...line.cutOrderNos])
    current.availableFeiTicketCount += line.availableFeiTicketCount
    current.availablePieceQty += line.availablePieceQty
    current.availableGarmentQty += line.availableGarmentQty
    grouped.set(key, current)
  })
  return clone([...grouped.values()].sort((left, right) =>
    `${left.productionOrderNo}-${left.colorName}-${left.sizeCode}`.localeCompare(
      `${right.productionOrderNo}-${right.colorName}-${right.sizeCode}`,
      'zh-CN',
    ),
  ))
}

function pickSewingAllocationReceiverFactory(color: string, index: number): Factory {
  const candidates = mockFactories.filter((factory) =>
    factory.factoryType === 'SATELLITE_SEWING' ||
    factory.factoryType === 'THIRD_SEWING' ||
    factory.factoryType === 'CENTRAL_GARMENT' ||
    factory.name.includes('车缝'),
  )
  if (color.includes('Khaki') && candidates[1]) return candidates[1]
  return candidates[index % Math.max(candidates.length, 1)] || getSewingFactory()
}

function getAllocationSpecialCraftDisplay(ticket: GeneratedFeiTicketSourceRecord | null, record?: SewingTaskAllocationInventoryRecord): string {
  if (!ticket && record?.hasSpecialCraft) return record.specialCraftDisplay || '特殊工艺'
  if (!ticket) return '无'
  if (!ticket.hasSpecialCraft || !ticket.specialCrafts.length) return '无'
  return unique(ticket.specialCrafts.map((craft) => craft.craftType || craft.craftName || '特殊工艺')).join('、') || '特殊工艺'
}

function getAllocationSpecialCraftReceiverDisplay(ticket: GeneratedFeiTicketSourceRecord | null, record?: SewingTaskAllocationInventoryRecord): string {
  if (!ticket && record?.hasSpecialCraft) return record.receiverFactoryDisplay || '承接工厂待补充'
  if (!ticket) return '无'
  if (!ticket.hasSpecialCraft || !ticket.specialCrafts.length) return '无'
  return unique(ticket.specialCrafts.map((craft) => craft.receiverFactoryName || '承接工厂待补充')).join('、') || '承接工厂待补充'
}

function buildAllocationShortageItems(
  allocatedItems: SewingTaskAllocationItem[],
  pendingItems: SewingTaskAllocationSpecialCraftPendingItem[],
): SewingTaskAllocationShortageItem[] {
  const shortageItems: SewingTaskAllocationShortageItem[] = []
  const allocatedBySize = new Map<string, SewingTaskAllocationItem[]>()
  allocatedItems.forEach((item) => {
    const list = allocatedBySize.get(item.size) || []
    list.push(item)
    allocatedBySize.set(item.size, list)
  })
  pendingItems.forEach((item) => {
    shortageItems.push({
      size: allocatedItems.find((allocated) => allocated.feiTicketId === item.feiTicketId)?.size || '按菲票尺码',
      partCode: item.partName,
      partName: item.partName,
      requiredQty: item.pendingQty,
      allocatedQty: 0,
      shortageQty: item.pendingQty,
      unit: '片',
      shortageReason: '特殊工艺未回仓',
    })
  })
  allocatedBySize.forEach((items, size) => {
    const partNames = unique(items.map((item) => item.partName))
    if (partNames.length > 1) return
    const allocatedQty = sum(items.map((item) => item.pieceQty))
    shortageItems.push({
      size,
      partCode: '其他部位',
      partName: '其他部位',
      requiredQty: allocatedQty,
      allocatedQty: 0,
      shortageQty: allocatedQty,
      unit: '片',
      shortageReason: '当前库存仅覆盖部分部位，分配后继续展示缺口',
    })
  })
  return shortageItems
}

export function buildSewingTaskAllocationProjectionFromInventory(
  inventoryRecords: SewingTaskAllocationInventoryRecord[],
): SewingTaskAllocationProjection {
  const occupiedFeiTicketNos = getOccupiedFeiTicketNos()
  const excludedItems: SewingTaskAllocationExcludedInventoryItem[] = []
  const reservations: InventoryReservation[] = []
  const releasedReservations: InventoryReservation[] = []
  const allocatableRecords: Array<{
    record: SewingTaskAllocationInventoryRecord
    ticket: GeneratedFeiTicketSourceRecord | null
    specialCraft: ReturnType<typeof mapSpecialCraftReturnStatus>
  }> = []
  const pendingSpecialCraftRecords: Array<{
    record: SewingTaskAllocationInventoryRecord
    ticket: GeneratedFeiTicketSourceRecord | null
    specialCraft: ReturnType<typeof mapSpecialCraftReturnStatus>
  }> = []

  inventoryRecords.forEach((record) => {
    const ticket = resolveFeiTicketForSewingDispatch(record.feiTicketNo)
    if (record.voidStatus === '已作废' || ticket?.printStatus === 'VOIDED') {
      excludedItems.push({ inventoryRecordId: record.inventoryRecordId, feiTicketNo: record.feiTicketNo, exclusionReason: '菲票已作废' })
      return
    }
    if (record.printStatus === '未打印' || record.printStatus === '待打印') {
      excludedItems.push({ inventoryRecordId: record.inventoryRecordId, feiTicketNo: record.feiTicketNo, exclusionReason: '菲票未打印' })
      return
    }
    if (record.pieceQty <= 0) {
      excludedItems.push({ inventoryRecordId: record.inventoryRecordId, feiTicketNo: record.feiTicketNo, exclusionReason: '库存数量为 0' })
      return
    }
    if (record.inventoryStatus !== '待分配') {
      excludedItems.push({ inventoryRecordId: record.inventoryRecordId, feiTicketNo: record.feiTicketNo, exclusionReason: `库存状态为${record.inventoryStatus}` })
      return
    }
    if (occupiedFeiTicketNos.has(record.feiTicketNo)) {
      excludedItems.push({ inventoryRecordId: record.inventoryRecordId, feiTicketNo: record.feiTicketNo, exclusionReason: '库存已被其他车缝任务占用' })
      reservations.push({
        reservationId: `RES-OCCUPIED-${record.inventoryRecordId}`,
        inventoryRecordId: record.inventoryRecordId,
        sewingTaskId: 'SEWING-TASK-EXISTING',
        feiTicketId: record.feiTicketId,
        reservedQty: record.pieceQty,
        unit: '片',
        reservedAt: '2026-05-20 10:00:00',
        reservedBy: '裁片仓分配员',
        reservationStatus: '已占用',
      })
      return
    }
    const mappedSpecialCraft = ticket
      ? mapSpecialCraftReturnStatus(record.feiTicketNo)
      : { specialCraftRequired: false, specialCraftReturnStatus: '不需要特殊工艺' as const }
    const specialCraft = {
      specialCraftRequired: mappedSpecialCraft.specialCraftRequired || Boolean(record.hasSpecialCraft),
      specialCraftReturnStatus:
        mappedSpecialCraft.specialCraftRequired
          ? mappedSpecialCraft.specialCraftReturnStatus
          : record.hasSpecialCraft
            ? '未回仓'
            : mappedSpecialCraft.specialCraftReturnStatus,
    } satisfies ReturnType<typeof mapSpecialCraftReturnStatus>
    if (specialCraft.specialCraftRequired && specialCraft.specialCraftReturnStatus !== '已回仓') {
      pendingSpecialCraftRecords.push({ record, ticket, specialCraft })
      return
    }
    allocatableRecords.push({ record, ticket, specialCraft })
  })

  if (allocatableRecords[0]) {
    releasedReservations.push({
      reservationId: `RES-RELEASED-${allocatableRecords[0].record.inventoryRecordId}`,
      inventoryRecordId: allocatableRecords[0].record.inventoryRecordId,
      sewingTaskId: 'SEWING-TASK-CANCELLED-001',
      feiTicketId: allocatableRecords[0].record.feiTicketId,
      reservedQty: allocatableRecords[0].record.pieceQty,
      unit: '片',
      reservedAt: '2026-05-21 15:30:00',
      reservedBy: '裁片仓分配员',
      reservationStatus: '已释放',
    })
  }

  const grouped = new Map<string, Array<{ record: SewingTaskAllocationInventoryRecord; ticket: GeneratedFeiTicketSourceRecord | null; specialCraft: ReturnType<typeof mapSpecialCraftReturnStatus> }>>()
  allocatableRecords.forEach((entry) => {
    const key = `${entry.record.productionOrderId}|${entry.record.spuCode || entry.ticket?.sourceTechPackSpuCode || entry.ticket?.skuCode}|${entry.record.color}`
    const list = grouped.get(key) || []
    list.push(entry)
    grouped.set(key, list)
  })
  const globalSpecialCraftPendingItems = pendingSpecialCraftRecords.map(({ record, ticket, specialCraft }) => ({
    feiTicketId: record.feiTicketId,
    feiTicketNo: record.feiTicketNo,
    partName: record.partName || ticket?.partName || '未标记部位',
    specialCraftType: getAllocationSpecialCraftDisplay(ticket, record),
    receiverFactoryName: getAllocationSpecialCraftReceiverDisplay(ticket, record),
    expectedReturnStatus: specialCraft.specialCraftReturnStatus,
    pendingQty: record.pieceQty,
  } satisfies SewingTaskAllocationSpecialCraftPendingItem))

  const allocations: SewingTaskAllocation[] = [...grouped.values()].map((entries, index) => {
    const first = entries[0]
    const receiverFactory = pickSewingAllocationReceiverFactory(first.record.color || first.ticket?.garmentColor || '', index)
    const allocatedItems: SewingTaskAllocationItem[] = entries.map(({ record, ticket, specialCraft }) => ({
      allocationItemId: `ALLOC-ITEM-${record.inventoryRecordId}`,
      feiTicketId: record.feiTicketId,
      feiTicketNo: record.feiTicketNo,
      inventoryRecordId: record.inventoryRecordId,
      productionOrderNo: ticket?.productionOrderNo || record.productionOrderNo || record.productionOrderId,
      cutOrderNo: ticket?.cutOrderNo || record.cutOrderNo || record.cutOrderId,
      size: record.size || ticket?.skuSize || '未标记',
      partCode: ticket?.partCode || record.partName,
      partName: record.partName || ticket?.partName || '未标记部位',
      pieceQty: record.pieceQty,
      pieceSequenceLabel: record.pieceSequenceLabel || ticket?.pieceSequenceLabel || '按菲票追踪',
      tempBagCode: record.tempBagCode,
      inventoryLocation: `${record.warehouseArea}/${record.locationCode}`,
      hasSpecialCraft: specialCraft.specialCraftRequired,
      specialCraftReturnStatus: specialCraft.specialCraftReturnStatus,
    }))
    const relatedPendingItems = pendingSpecialCraftRecords
      .filter(({ record }) => record.productionOrderId === first.record.productionOrderId && record.color === first.record.color)
      .map(({ record, ticket, specialCraft }) => ({
        feiTicketId: record.feiTicketId,
        feiTicketNo: record.feiTicketNo,
        partName: record.partName || ticket?.partName || '未标记部位',
        specialCraftType: getAllocationSpecialCraftDisplay(ticket, record),
        receiverFactoryName: getAllocationSpecialCraftReceiverDisplay(ticket, record),
        expectedReturnStatus: specialCraft.specialCraftReturnStatus,
        pendingQty: record.pieceQty,
      } satisfies SewingTaskAllocationSpecialCraftPendingItem))
    const allocationId = `SEW-ALLOC-${first.record.productionOrderId}-${first.record.color || 'COLOR'}-${String(index + 1).padStart(2, '0')}`
    const allocationReservations = allocatedItems.map((item) => {
      const reservation: InventoryReservation = {
        reservationId: `RES-${allocationId}-${item.inventoryRecordId}`,
        inventoryRecordId: item.inventoryRecordId,
        sewingTaskId: allocationId,
        feiTicketId: item.feiTicketId,
        reservedQty: item.pieceQty,
        unit: '片',
        reservedAt: '2026-05-23 09:20:00',
        reservedBy: '裁片仓分配员',
        reservationStatus: '有效',
      }
      reservations.push(reservation)
      return reservation
    })
    const shortageItems = buildAllocationShortageItems(allocatedItems, relatedPendingItems)
    return {
      sewingTaskId: allocationId,
      sewingTaskNo: `CFRW-${first.ticket?.productionOrderNo || first.record.productionOrderNo || first.record.productionOrderId}-${String(index + 1).padStart(2, '0')}`,
      sourceType: '裁床待交出仓库存',
      sourceWarehouseId: 'cutting-wait-handover',
      sourceWarehouseName: '裁床待交出仓',
      productionOrderIds: unique(entries.map((entry) => entry.record.productionOrderId)),
      cutOrderIds: unique(entries.map((entry) => entry.record.cutOrderId)),
      spuCode: first.record.spuCode || first.ticket?.sourceTechPackSpuCode || first.ticket?.skuCode || '未关联 SPU',
      styleName: first.ticket?.sourceTechPackSpuCode || first.ticket?.skuCode || first.record.spuCode || '未关联款式',
      color: first.record.color || first.ticket?.garmentColor || '未标记颜色',
      receiverFactoryId: receiverFactory.id,
      receiverFactoryCode: receiverFactory.code || receiverFactory.id,
      receiverFactoryName: receiverFactory.name.includes('车缝') ? receiverFactory.name : `${receiverFactory.name}车缝厂`,
      allocationBasis: '基于裁床待交出仓已有菲票 / 裁片库存',
      allocationStatus: '候选',
      allocatedItems,
      shortageItems,
      specialCraftPendingItems: relatedPendingItems,
      inventoryReservationIds: allocationReservations.map((reservation) => reservation.reservationId),
      createdAt: '2026-05-23 09:20:00',
      createdBy: '裁片仓分配员',
      remark: '不齐套也可生成车缝任务候选；缺口在分配结果中展示。',
    }
  })

  const availablePieceQty = allocations.reduce((total, allocation) => total + sum(allocation.allocatedItems.map((item) => item.pieceQty)), 0)
  const reservedPieceQty = reservations.filter((reservation) => reservation.reservationStatus !== '已释放').reduce((total, reservation) => total + reservation.reservedQty, 0)
  return {
    allocations,
    reservations,
    releasedReservations,
    excludedItems,
    specialCraftPendingItems: globalSpecialCraftPendingItems,
    availableInventoryCount: allocations.reduce((total, allocation) => total + allocation.allocatedItems.length, 0),
    availablePieceQty,
    reservedInventoryCount: reservations.filter((reservation) => reservation.reservationStatus !== '已释放').length,
    reservedPieceQty,
    shortageCount: allocations.reduce((total, allocation) => total + allocation.shortageItems.length, 0),
    specialCraftPendingCount: pendingSpecialCraftRecords.length,
    cancelledAllocationCount: releasedReservations.length,
    ruleNotes: [
      '车缝任务分配只读取裁床待交出仓已入仓菲票 / 裁片库存。',
      '未入仓菲票不参与分配；已作废菲票不参与分配。',
      '不齐套也可以生成车缝任务候选，分配后缺口作为结果展示。',
      '特殊工艺未回仓的部位暂不参与本次可分配库存，其他部位仍可分配。',
      '库存占用不等于交出；交出单和交出记录留给后续流程。',
    ],
  }
}

function buildPickingRequiredItems(allocation: SewingTaskAllocation): HandoverPickingRequiredItem[] {
  const rows = new Map<string, HandoverPickingRequiredItem>()
  const append = (input: { size: string; partCode: string; partName: string; qty: number }) => {
    const key = `${input.size}|${input.partCode}|${input.partName}`
    const current = rows.get(key)
    if (current) {
      current.requiredQty += input.qty
      return
    }
    rows.set(key, {
      size: input.size,
      partCode: input.partCode,
      partName: input.partName,
      requiredQty: input.qty,
      unit: '片',
    })
  }

  allocation.allocatedItems.forEach((item) => {
    append({
      size: item.size,
      partCode: item.partCode,
      partName: item.partName,
      qty: item.pieceQty,
    })
  })
  allocation.shortageItems.forEach((item) => {
    append({
      size: item.size,
      partCode: item.partCode,
      partName: item.partName,
      qty: item.shortageQty,
    })
  })
  return [...rows.values()]
}

function buildPickingShortageItems(
  requiredItems: HandoverPickingRequiredItem[],
  pickedItems: HandoverPickingPickedItem[],
): HandoverPickingShortageItem[] {
  return requiredItems
    .map((item) => {
      const pickedQty = sum(
        pickedItems
          .filter((picked) => picked.checkResult === '通过' && picked.feiTicketNo && picked.sourceTempBagCode)
          .filter((picked) => picked.size === item.size && picked.partCode === item.partCode && picked.partName === item.partName)
          .map((picked) => picked.pickedQty),
      )
      const shortageQty = Math.max(0, item.requiredQty - pickedQty)
      return {
        size: item.size,
        partCode: item.partCode,
        partName: item.partName,
        requiredQty: item.requiredQty,
        pickedQty,
        shortageQty,
        shortageReason: shortageQty > 0 ? '本次部分分拣，缺口继续展示' : '已分拣',
      } satisfies HandoverPickingShortageItem
    })
    .filter((item) => item.shortageQty > 0)
}

function buildPickingTempBagSources(items: HandoverPickingAllocatedInventoryItem[]): HandoverPickingTempBagSource[] {
  const byBag = new Map<string, HandoverPickingTempBagSource>()
  items.forEach((item) => {
    const current = byBag.get(item.tempBagCode) || {
      tempBagCode: item.tempBagCode,
      feiTicketCount: 0,
      pieceQty: 0,
      locationCode: item.locationCode,
    }
    current.feiTicketCount += 1
    current.pieceQty += item.pieceQty
    byBag.set(item.tempBagCode, current)
  })
  return [...byBag.values()]
}

function buildTargetTransferBagUse(
  allocation: SewingTaskAllocation,
  pickingTaskId: string,
  bagCode: string,
  items: HandoverPickingPickedItem[],
  sequence: number,
): TargetTransferBagUse {
  return {
    bagUseId: `TB-USE-${pickingTaskId}-${String(sequence).padStart(2, '0')}`,
    bagCode,
    bagMasterId: `carrier-${bagCode.toLowerCase()}`,
    useStage: '交出装袋',
    sewingTaskId: allocation.sewingTaskId,
    sewingTaskNo: allocation.sewingTaskNo,
    pickingTaskId,
    containedFeiTickets: items.map((item) => ({
      feiTicketId: item.feiTicketId,
      feiTicketNo: item.feiTicketNo,
      pieceQty: item.pickedQty,
    })),
    totalPieceQty: sum(items.map((item) => item.pickedQty)),
    packedAt: items[0]?.scannedAt || '2026-05-23 11:00:00',
    packedBy: items[0]?.scannedBy || '裁片仓分拣员',
    bagStatus: items.length ? '已装袋待交出' : '装袋中',
  }
}

function buildPickedItemsForAllocation(
  allocation: SewingTaskAllocation,
  allocatedInventoryItems: HandoverPickingAllocatedInventoryItem[],
  allocationIndex: number,
): HandoverPickingPickedItem[] {
  const selectedItems = allocationIndex === 0
    ? []
    : allocatedInventoryItems
  return selectedItems.map((item, index) => ({
    feiTicketId: item.feiTicketId,
    feiTicketNo: item.feiTicketNo,
    scannedAt: `2026-05-23 11:${String(10 + allocationIndex * 10 + index).padStart(2, '0')}:00`,
    scannedBy: '裁片仓分拣员',
    sourceTempBagCode: item.tempBagCode,
    targetTransferBagCode:
      allocationIndex === 0
        ? 'BAG-PICK-001'
        : index % 2 === 0
          ? 'BAG-PICK-002'
          : 'BAG-PICK-003',
    size: item.size,
    partCode: item.partCode,
    partName: item.partName,
    pickedQty: item.pieceQty,
    checkResult: '通过',
  }))
}

function buildTargetBagsForPickingTask(
  allocation: SewingTaskAllocation,
  pickingTaskId: string,
  pickedItems: HandoverPickingPickedItem[],
): TargetTransferBagUse[] {
  const byBag = new Map<string, HandoverPickingPickedItem[]>()
  pickedItems.forEach((item) => {
    const rows = byBag.get(item.targetTransferBagCode) || []
    rows.push(item)
    byBag.set(item.targetTransferBagCode, rows)
  })
  return [...byBag.entries()].map(([bagCode, items], index) =>
    buildTargetTransferBagUse(allocation, pickingTaskId, bagCode, items, index + 1),
  )
}

function buildPickingScanChecks(tasks: HandoverPickingTask[], projection: SewingTaskAllocationProjection): HandoverPickingScanCheck[] {
  const firstTask = tasks[0]
  const secondTask = tasks[1]
  const firstPicked = firstTask?.pickedItems[0]
  const firstAllocated = firstTask?.allocatedInventoryItems[0]
  const secondAllocated = secondTask?.allocatedInventoryItems[0]
  const pendingSpecialCraft = projection.specialCraftPendingItems[0]
  const checks: HandoverPickingScanCheck[] = []

  if (firstTask) {
    checks.push(
      {
        checkId: 'PICK-CHECK-TASK-OK',
        pickingTaskNo: firstTask.pickingTaskNo,
        scanObject: '配料任务码',
        scannedValue: firstTask.pickingTaskNo,
        checkResult: '通过',
        reason: '已进入当前待交出仓裁片配料任务',
        syncStatus: '已同步',
      },
      {
        checkId: 'PICK-CHECK-SOURCE-BAG-OK',
        pickingTaskNo: firstTask.pickingTaskNo,
        scanObject: '来源入仓暂存袋',
        scannedValue: firstTask.tempBagSources[0]?.tempBagCode || 'BAG-B-003',
        checkResult: '通过',
        reason: '来源袋内存在当前任务已分配菲票',
        syncStatus: '已同步',
      },
    )
  }
  if (firstAllocated && firstTask) {
    checks.push({
      checkId: 'PICK-CHECK-FEI-OK',
      pickingTaskNo: firstTask.pickingTaskNo,
      scanObject: '菲票',
      scannedValue: firstAllocated.feiTicketNo,
      checkResult: '通过',
      reason: '菲票属于当前车缝任务分配结果',
      syncStatus: '已同步',
    })
  }
  if (secondAllocated && firstTask) {
    checks.push({
      checkId: 'PICK-CHECK-FEI-WRONG-TASK',
      pickingTaskNo: firstTask.pickingTaskNo,
      scanObject: '菲票',
      scannedValue: secondAllocated.feiTicketNo,
      checkResult: '拒绝',
      reason: '菲票不属于当前配料任务',
      syncStatus: '已同步',
    })
  }
  if (firstTask) {
    checks.push(
      {
        checkId: 'PICK-CHECK-FEI-VOID',
        pickingTaskNo: firstTask.pickingTaskNo,
        scanObject: '菲票',
        scannedValue: 'FT-VOID-PICKING-DEMO',
        checkResult: '拒绝',
        reason: '作废菲票不能分拣',
        syncStatus: '已同步',
      },
      {
        checkId: 'PICK-CHECK-BAG-CONFLICT',
        pickingTaskNo: firstTask.pickingTaskNo,
        scanObject: '目标中转袋',
        scannedValue: 'BAG-PICK-LOCKED-001',
        checkResult: '拒绝',
        reason: '目标中转袋已绑定其他车缝任务',
        syncStatus: '已同步',
      },
      {
        checkId: 'PICK-CHECK-FEI-OTHER-PICKED',
        pickingTaskNo: firstTask.pickingTaskNo,
        scanObject: '菲票',
        scannedValue: 'FT-OTHER-TASK-PICKED-DEMO',
        checkResult: '拒绝',
        reason: '菲票已被其他配料任务分拣',
        syncStatus: '已同步',
      },
    )
  }
  if (pendingSpecialCraft && firstTask) {
    checks.push({
      checkId: 'PICK-CHECK-SPECIAL-PENDING',
      pickingTaskNo: firstTask.pickingTaskNo,
      scanObject: '菲票',
      scannedValue: pendingSpecialCraft.feiTicketNo || pendingSpecialCraft.feiTicketId,
      checkResult: '拒绝',
      reason: '特殊工艺未回仓，暂不分拣给车缝任务',
      syncStatus: '已同步',
    })
  }
  if (firstPicked && firstTask) {
    checks.push(
      {
        checkId: 'PICK-CHECK-DUPLICATE',
        pickingTaskNo: firstTask.pickingTaskNo,
        scanObject: '菲票',
        scannedValue: firstPicked.feiTicketNo,
        checkResult: '提示',
        reason: '菲票已在当前任务完成分拣，避免重复分拣',
        syncStatus: '已同步',
      },
      {
        checkId: 'PICK-CHECK-SYNC-FAILED',
        pickingTaskNo: firstTask.pickingTaskNo,
        scanObject: '目标中转袋',
        scannedValue: firstPicked.targetTransferBagCode,
        checkResult: '提示',
        reason: 'PDA 分拣提交已记录，等待重新同步',
        syncStatus: '同步失败',
      },
    )
  }
  if (!firstPicked && firstTask) {
    checks.push({
      checkId: 'PICK-CHECK-SYNC-FAILED-DEMO',
      pickingTaskNo: firstTask.pickingTaskNo,
      scanObject: '目标中转袋',
      scannedValue: firstTask.targetTransferBags[0]?.bagCode || 'BAG-PICK-SYNC-DEMO',
      checkResult: '提示',
      reason: 'PDA 分拣提交已记录，等待重新同步',
      syncStatus: '同步失败',
    })
  }
  return checks
}

export function buildHandoverPickingTaskProjectionFromAllocationProjection(
  allocationProjection: SewingTaskAllocationProjection,
): HandoverPickingTaskProjection {
  const tasks: HandoverPickingTask[] = allocationProjection.allocations.map((allocation, index) => {
    const pickingTaskId = `PICK-${allocation.sewingTaskId}`
    const requiredItems = buildPickingRequiredItems(allocation)
    const allocatedInventoryItems = allocation.allocatedItems.map((item) => ({
      inventoryRecordId: item.inventoryRecordId,
      feiTicketId: item.feiTicketId,
      feiTicketNo: item.feiTicketNo,
      tempBagCode: item.tempBagCode,
      locationCode: item.inventoryLocation,
      size: item.size,
      partCode: item.partCode,
      partName: item.partName,
      pieceQty: item.pieceQty,
      pieceSequenceLabel: item.pieceSequenceLabel,
      specialCraftReturnStatus: item.specialCraftReturnStatus,
    } satisfies HandoverPickingAllocatedInventoryItem))
    const pickedItems = buildPickedItemsForAllocation(allocation, allocatedInventoryItems, index)
    const shortageItems = buildPickingShortageItems(requiredItems, pickedItems)
    const targetTransferBags = buildTargetBagsForPickingTask(allocation, pickingTaskId, pickedItems)
    const taskStatus: HandoverPickingTaskStatus =
      targetTransferBags.length > 1 && shortageItems.length === 0
        ? '已装袋待交出'
        : pickedItems.length > 0
          ? '分拣中'
          : '待分拣'

    return {
      pickingTaskId,
      pickingTaskNo: `CPT-${allocation.sewingTaskNo}`,
      sewingTaskId: allocation.sewingTaskId,
      sewingTaskNo: allocation.sewingTaskNo,
      receiverFactoryId: allocation.receiverFactoryId,
      receiverFactoryCode: allocation.receiverFactoryCode,
      receiverFactoryName: allocation.receiverFactoryName,
      sourceWarehouseId: allocation.sourceWarehouseId,
      sourceWarehouseName: allocation.sourceWarehouseName,
      taskStatus,
      requiredItems,
      allocatedInventoryItems,
      pickedItems,
      shortageItems,
      tempBagSources: buildPickingTempBagSources(allocatedInventoryItems),
      targetTransferBags,
      createdAt: allocation.createdAt,
      createdBy: allocation.createdBy,
      updatedAt: index === 0 ? '2026-05-23 11:18:00' : '2026-05-23 11:38:00',
    }
  })
  const targetTransferBags = tasks.flatMap((task) => task.targetTransferBags)
  const scanChecks = buildPickingScanChecks(tasks, allocationProjection)
  return {
    tasks,
    targetTransferBags,
    scanChecks,
    taskCount: tasks.length,
    pendingCount: tasks.filter((task) => task.taskStatus === '待分拣').length,
    sortingCount: tasks.filter((task) => task.taskStatus === '分拣中' || task.taskStatus === '已分拣待装袋').length,
    packedCount: tasks.filter((task) => task.taskStatus === '已装袋待交出').length,
    shortageCount: tasks.reduce((total, task) => total + task.shortageItems.length, 0),
    targetTransferBagCount: targetTransferBags.length,
    syncFailedCount: scanChecks.filter((check) => check.syncStatus === '同步失败').length,
    ruleNotes: [
      '待交出仓裁片配料只从车缝任务分配后的菲票 / 裁片库存拣选。',
      '这里是裁片配料，不是前段中转仓给裁床准备面料。',
      '入仓暂存袋可混装；二次分拣开始按车缝任务组织裁片。',
      '交出装袋阶段一个中转袋只对应一个车缝任务，一个车缝任务可对应多个中转袋。',
      '允许部分分拣提交，缺口作为分拣结果展示。',
    ],
  }
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
  const tickets = listAvailableFeiTicketsForSewingDispatchInternal({ productionOrderId: productionOrder.productionOrderId })
  if (!tickets.length) throw new Error('当前生产单暂无裁床待交出仓菲票库存，不能分配车缝任务')
  const dispatchIndex = storeRef.dispatchOrders.length + 1
  const createdAt = nowText()
  const order: CuttingSewingDispatchOrder = {
    dispatchOrderId: `CSDO-${productionOrder.productionOrderId}-${String(dispatchIndex).padStart(2, '0')}`,
    dispatchOrderNo: `CPFL-${productionOrder.productionOrderNo}-${String(dispatchIndex).padStart(2, '0')}`,
    productionOrderId: productionOrder.productionOrderId,
    productionOrderNo: productionOrder.productionOrderNo,
    cuttingOrderIds: unique(tickets.map((ticket) => ticket.cutOrderId)),
    cuttingOrderNos: unique(tickets.map((ticket) => ticket.cutOrderNo)),
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
  const normalizedLines = input.plannedSkuQtyLines
    .filter((line) => line.plannedGarmentQty > 0)
    .map((line, index) => ({
      lineId: `${input.dispatchOrderId}-SKU-${String(index + 1).padStart(3, '0')}`,
      colorName: line.colorName,
      colorCode: line.colorCode || line.colorName,
      sizeCode: line.sizeCode,
      plannedGarmentQty: line.plannedGarmentQty,
      dispatchedGarmentQty: 0,
      remainingGarmentQty: getAvailablePieceQtyForSkuLine(order.productionOrderId, line.colorName, line.sizeCode),
    }))
  if (!normalizedLines.length) throw new Error('至少需要一行本次交出颜色 / 尺码 / 件数')
  const noStockLine = normalizedLines.find((line) => line.remainingGarmentQty <= 0)
  if (noStockLine) throw new Error(`待交出仓没有 ${noStockLine.colorName} / ${noStockLine.sizeCode} 的可分配菲票，不能创建车缝任务分配`)
  const overStockLine = normalizedLines.find((line) => line.plannedGarmentQty > line.remainingGarmentQty)
  if (overStockLine) throw new Error(`本次分配数量超过待交出仓 ${overStockLine.colorName} / ${overStockLine.sizeCode} 可用裁片数量`)

  const batchIndex = storeRef.dispatchBatches.filter((batch) => batch.productionOrderId === order.productionOrderId).length + 1
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
  const noStockLine = input.bagPlanList
    .flatMap((plan) => plan.skuQtyLines)
    .find((line) => getAvailablePieceQtyForSkuLine(order.productionOrderId, line.colorName, line.sizeCode) <= 0)
  if (noStockLine) throw new Error(`待交出仓没有 ${noStockLine.colorName} / ${noStockLine.sizeCode} 的可装袋菲票`)
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
  const ticket = resolveFeiTicketForSewingDispatch(input.feiTicketNo)
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
      validationMessage: '菲票不属于本次交出记录',
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
      validationMessage: '特殊工艺未回仓，暂不加入本次车缝交出；不影响其他已裁出部位提交交出记录',
      blocking: false,
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
  pieceLine.completeStatus = pieceLine.missingPieceQty === 0 && pieceLine.overPieceQty === 0 ? '已核对' : '有缺口'
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
    const ticket = resolveFeiTicketForSewingDispatch(input.feiTicketNo)
    line.scannedFeiTicketNos = line.scannedFeiTicketNos.filter((feiTicketNo) => feiTicketNo !== input.feiTicketNo)
    line.scannedPieceQty = Math.max(line.scannedPieceQty - (ticket ? getTicketDispatchQty(ticket) : 0), 0)
    line.missingPieceQty = Math.max(line.requiredPieceQty - line.scannedPieceQty, 0)
    line.overPieceQty = Math.max(line.scannedPieceQty - line.requiredPieceQty, 0)
    line.completeStatus = line.missingPieceQty === 0 && line.overPieceQty === 0 ? '已核对' : '有缺口'
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
        validationMessage: '特殊工艺未回仓，交出后将形成缺口',
        blocking: false,
      })
    } else if (line.missingPieceQty > 0) {
      results.push({ ...validationBase, validationType: '缺少裁片', validationMessage: '缺少裁片，交出后将形成缺口', blocking: false })
    } else if (line.overPieceQty > 0) {
      results.push({ ...validationBase, validationType: '裁片超出', validationMessage: '裁片超出，按本次交出记录追踪', blocking: false })
    } else {
      results.push({ ...validationBase, validationType: '通过', validationMessage: '缺口核对通过', blocking: false })
    }
  })
  const hasGap = results.some(isHandoverGapResult)
  bag.completeStatus = hasGap ? '有缺口' : '已核对'
  bag.status = bag.scannedFeiTicketNos.length ? '已核对' : '待装袋'
  bag.packStatus = bag.scannedFeiTicketNos.length ? '已装袋' : '待装袋'
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
    const ticket = resolveFeiTicketForSewingDispatch(feiTicketNo)
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
    const ticket = item.feiTicketNo ? resolveFeiTicketForSewingDispatch(item.feiTicketNo) : undefined
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
      validationMessage: '袋内菲票不属于本次交出记录',
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
        validationMessage: '特殊工艺未回仓，交出后将形成缺口',
        blocking: false,
      } satisfies CuttingSewingDispatchValidationResult
    }
    if (missingPieceQty > 0) {
      return { ...validationBase, validationType: '缺少裁片', validationMessage: '本次交出记录缺少裁片，交出后展示缺口', blocking: false } satisfies CuttingSewingDispatchValidationResult
    }
    if (overPieceQty > 0) {
      return { ...validationBase, validationType: '裁片超出', validationMessage: '本次交出记录裁片超出，按差异追踪', blocking: false } satisfies CuttingSewingDispatchValidationResult
    }
    return {
      ...validationBase,
      validationType: '通过',
      validationMessage: '本次交出记录缺口核对通过',
      blocking: false,
    } satisfies CuttingSewingDispatchValidationResult
  })
  const results = [...bagLegalityResults, ...batchResults]
  const blocking = results.some((result) => result.blocking)
  const hasGap = results.some(isHandoverGapResult)
  batch.completeStatus = blocking || hasGap ? '有缺口' : '已核对'
  batch.status = blocking ? '装袋中' : '已核对'
  batch.updatedAt = nowText()
  batch.transferBagIds.forEach((transferBagId) => {
    const bag = findTransferBagById(storeRef, transferBagId)
    normalizeTransferBagRuntimeFields(bag)
    if (!blocking) {
      const hasBagGap = results.some((result) => result.transferBagId === transferBagId && isHandoverGapResult(result))
      bag.completeStatus = hasBagGap ? '有缺口' : '已核对'
      bag.status = '已核对'
      bag.packStatus = bag.scannedFeiTicketNos.length ? '已装袋' : bag.packStatus
      bag.updatedAt = batch.updatedAt
    }
  })
  order.status = blocking ? '待核对' : '可交出'
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
  const validation = validateDispatchBatchCompleteness(input.dispatchBatchId)
  const blocking = validation.validationResults.find((item) => item.blocking)
  if (blocking) throw new Error(blocking.validationMessage)
  const batch = findDispatchBatchById(storeRef, input.dispatchBatchId)
  const order = findDispatchOrderById(storeRef, batch.dispatchOrderId)
  const submittedPieceQty = getDispatchBatchPieceQty(storeRef, batch)
  if (submittedPieceQty <= 0) throw new Error('当前没有可交出裁片，不能新增交出记录')
  const gapSummary = buildDispatchGapSummary(validation.validationResults)
  const cuttingHandoverSummary = buildCuttingHandoverRecordSummary(storeRef, order, batch, submittedPieceQty)
  if (batch.handoverRecordId) {
    const record = findPdaHandoverRecord(batch.handoverRecordId)
    if (record) {
      return {
        handoverOrder: upsertPdaHandoverHeadMock(buildHandoverHead(order)),
        handoverRecord: record,
        outboundRecords: [],
        updatedWaitHandoverStockItems: [],
        updatedDispatchBatch: clone(batch),
        updatedTransferBags: clone(storeRef.transferBags.filter((bag) => batch.transferBagIds.includes(bag.transferBagId))),
      }
    }
  }
  const handoverOrder = upsertPdaHandoverHeadMock(buildHandoverHead(order))
  const record = createFactoryHandoverRecord({
    handoverOrderId: handoverOrder.handoverOrderId || handoverOrder.handoverId,
    submittedQty: submittedPieceQty,
    qtyUnit: '片',
    factorySubmittedAt: input.submittedAt,
    factorySubmittedBy: input.operatorName,
    factoryRemark: [
      `中转单：${batch.transferOrderNo}`,
      `中转袋：${batch.transferBagIds
        .map((bagId) => findTransferBagById(storeRef, bagId).transferBagNo)
        .join('、')}`,
      gapSummary,
    ].filter(Boolean).join('；'),
    objectType: 'CUT_PIECE',
    handoutObjectType: 'CUT_PIECE',
    handoutItemLabel: `交出单 ${batch.transferOrderNo}`,
    garmentEquivalentQty: getDispatchBatchSubmittedGarmentQty(storeRef, batch),
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
    cuttingHandoverSummary,
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
    itemName: `交出单 ${batch.transferOrderNo}`,
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
  order.handoverRecordIds = unique([...order.handoverRecordIds, recordWithTransferBagFields.handoverRecordId || recordWithTransferBagFields.recordId])
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

function getDispatchBatchPieceQty(storeRef: CuttingSewingDispatchStore, batch: CuttingSewingDispatchBatch): number {
  return sum(
    batch.transferBagIds.map((bagId) =>
      findTransferBagById(storeRef, bagId).pieceLines.reduce((total, line) => total + line.scannedPieceQty, 0),
    ),
  )
}

function getDispatchBatchSubmittedGarmentQty(storeRef: CuttingSewingDispatchStore, batch: CuttingSewingDispatchBatch): number {
  const garmentQtyBySku = new Map<string, number>()
  batch.transferBagIds.forEach((bagId) => {
    const bag = findTransferBagById(storeRef, bagId)
    bag.pieceLines.forEach((line) => {
      const pieceCountPerGarment = Math.max(line.pieceCountPerGarment || 1, 1)
      const garmentQty = Math.floor(Math.max(line.scannedPieceQty || 0, 0) / pieceCountPerGarment)
      if (garmentQty <= 0) return
      const skuKey = `${line.colorName}|${line.sizeCode}`
      garmentQtyBySku.set(skuKey, Math.max(garmentQtyBySku.get(skuKey) || 0, garmentQty))
    })
  })
  return sum([...garmentQtyBySku.values()])
}

function getDispatchBatchRequiredPieceQty(storeRef: CuttingSewingDispatchStore, batch: CuttingSewingDispatchBatch): number {
  return sum(
    batch.transferBagIds.map((bagId) =>
      findTransferBagById(storeRef, bagId).pieceLines.reduce((total, line) => total + line.requiredPieceQty, 0),
    ),
  )
}

function buildHandoverHead(order: CuttingSewingDispatchOrder): PdaHandoverHead {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const batches = storeRef.dispatchBatches.filter((batch) => batch.dispatchOrderId === order.dispatchOrderId)
  const submittedBatches = batches.filter((batch) => Boolean(batch.handoverRecordId))
  const hasObjection = submittedBatches.some((batch) => batch.status === '异议中')
  const hasDifference = submittedBatches.some((batch) => batch.status === '差异')
  const pendingWritebackCount = submittedBatches.filter((batch) => batch.status === '已交出').length
  const allWrittenBack = submittedBatches.length > 0 && submittedBatches.every((batch) => batch.status === '已回写')
  const handoverId = order.handoverOrderId || `HO-CSD-${order.dispatchOrderId}`
  const submittedQtyTotal = sum(submittedBatches.map((batch) => getDispatchBatchPieceQty(storeRef, batch)))
  const expectedQtyTotal = sum(batches.map((batch) => getDispatchBatchRequiredPieceQty(storeRef, batch)))
  const writtenBackQtyTotal = sum(submittedBatches.map((batch) => batch.receiverWrittenQty || 0))
  const diffQtyTotal = sum(submittedBatches.map((batch) => batch.differenceQty || 0))
  return {
    handoverId,
    handoverOrderId: handoverId,
    handoverOrderNo: order.handoverOrderNo || `JCD-${order.productionOrderNo}-${order.dispatchOrderId.replace(/[^0-9A-Za-z]/g, '').slice(-4)}`,
    headType: 'HANDOUT',
    qrCodeValue: buildHandoverOrderQrValue(handoverId),
    handoverOrderQrValue: buildHandoverOrderQrValue(handoverId),
    taskId: order.dispatchOrderId,
    sourceTaskId: order.dispatchOrderId,
    taskNo: order.dispatchOrderNo,
    sourceTaskNo: order.dispatchOrderNo,
    productionOrderNo: order.productionOrderNo,
    processName: '交出单',
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
    summaryStatus: hasObjection
      ? 'HAS_OBJECTION'
      : allWrittenBack
        ? 'WRITTEN_BACK'
        : hasDifference || writtenBackQtyTotal > 0
          ? 'PARTIAL_WRITTEN_BACK'
          : submittedBatches.length
            ? 'SUBMITTED'
            : 'NONE',
    recordCount: submittedBatches.length,
    pendingWritebackCount,
    submittedQtyTotal,
    writtenBackQtyTotal,
    diffQtyTotal,
    objectionCount: submittedBatches.filter((batch) => batch.status === '异议中').length,
    lastRecordAt: submittedBatches.map((batch) => batch.updatedAt).sort((a, b) => b.localeCompare(a))[0] || order.updatedAt,
    plannedQty: order.plannedDispatchGarmentQty,
    completionStatus: order.status === '已回写' || allWrittenBack ? 'COMPLETED' : 'OPEN',
    qtyExpectedTotal: expectedQtyTotal || submittedQtyTotal || order.plannedDispatchGarmentQty,
    qtyActualTotal: writtenBackQtyTotal,
    qtyDiffTotal: (expectedQtyTotal || submittedQtyTotal || order.plannedDispatchGarmentQty) - writtenBackQtyTotal,
    transitionFromPrev: 'NOT_APPLICABLE',
    transitionToNext: 'NOT_APPLICABLE',
    stageCode: 'POST',
    stageName: '交出单',
    processBusinessCode: 'CUT_PANEL',
    processBusinessName: '裁片',
    taskTypeCode: 'CUT_PIECE_SEWING_DISPATCH',
    taskTypeLabel: '交出单',
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
      garmentEquivalentQty: Math.floor(Math.max(line.scannedPieceQty || 0, 0) / Math.max(line.pieceCountPerGarment || 1, 1)),
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
      .map((batch) => getDispatchBatchSubmittedGarmentQty(storeRef, batch)),
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
  const pickSeedFeiTicketNos = (batch: CuttingSewingDispatchBatch): string[] => {
    const requiredLines = getRequiredLinesForBag(batch)
    const tickets = listAvailableFeiTicketsForSewingDispatchInternal({ productionOrderId: batch.productionOrderId })
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
    return picked
  }
  const markSeedBagAsSortingSample = (transferBagId: string, operatedAt: string): void => {
    const bag = storeRef.transferBags.find((item) => item.transferBagId === transferBagId)
    if (!bag) return
    bag.packedBy = '裁片仓分拣员'
    bag.packedAt = operatedAt
    bag.lastPackedAt = operatedAt
    bag.packStatus = bag.scannedFeiTicketNos.length ? '装袋中' : '待装袋'
    bag.status = bag.scannedFeiTicketNos.length ? '装袋中' : '待装袋'
    bag.currentLocation = '裁床厂待交出'
    bag.contentItems.forEach((item) => {
      item.remark = item.remark || '二次分拣样例：从入仓暂存袋重新拣出后装入本交出记录。'
    })
    bag.updatedAt = operatedAt
  }
  const seedAvailableTickets = listAvailableFeiTicketsForSewingDispatchInternal()
  const seedTicket =
    seedAvailableTickets.find((ticket) => ticket.productionOrderId === 'PO-202603-0102') || seedAvailableTickets[0]
  if (!seedTicket) return
  const seedProductionOrderId = seedTicket.productionOrderId
  const getSeedSkuLine = (index: number, fallbackQty: number): CuttingSewingDispatchSkuQtyLine => {
    const tickets = listAvailableFeiTicketsForSewingDispatchInternal({ productionOrderId: seedProductionOrderId })
    const ticket = tickets[index] || tickets[0] || seedTicket
    return {
      colorName: ticket.garmentColor,
      colorCode: ticket.garmentColor,
      sizeCode: ticket.skuSize,
      plannedGarmentQty: Math.max(ticket.garmentQty || fallbackQty, 1),
    }
  }
  const readyOrder = createCuttingSewingDispatchOrder({ productionOrderId: seedProductionOrderId, remark: '车缝任务分配：按待交出仓实际库存分批交出。' })
  const readyBatch = createCuttingSewingDispatchBatch({
    dispatchOrderId: readyOrder.dispatchOrderId,
    plannedSkuQtyLines: [getSeedSkuLine(0, 356)],
  })
  const readyBags = createCuttingSewingTransferBags({
    dispatchBatchId: readyBatch.dispatchBatchId,
    bagPlanList: [{ plannedGarmentQty: 356, skuQtyLines: readyBatch.plannedSkuQtyLines }],
  })
  pickSeedFeiTicketNos(readyBatch).forEach((feiTicketNo) => {
    scanFeiTicketIntoTransferBag({ transferBagId: readyBags[0].transferBagId, feiTicketNo })
  })
  validateDispatchBatchCompleteness(readyBatch.dispatchBatchId)
  const submitResult = submitCuttingSewingDispatchBatch({
    dispatchBatchId: readyBatch.dispatchBatchId,
    operatorName: '裁床交出员',
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
    plannedSkuQtyLines: [getSeedSkuLine(1, 368)],
  })
  const secondBags = createCuttingSewingTransferBags({
    dispatchBatchId: secondBatch.dispatchBatchId,
    bagPlanList: [{ plannedGarmentQty: 368, skuQtyLines: secondBatch.plannedSkuQtyLines }],
  })
  pickSeedFeiTicketNos(secondBatch).forEach((feiTicketNo) => {
    scanFeiTicketIntoTransferBag({ transferBagId: secondBags[0].transferBagId, feiTicketNo })
  })
  validateDispatchBatchCompleteness(secondBatch.dispatchBatchId)
  submitCuttingSewingDispatchBatch({
    dispatchBatchId: secondBatch.dispatchBatchId,
    operatorName: '裁床交出员',
    submittedAt: '2026-04-24 09:30:00',
  })

  const pendingBatch = createCuttingSewingDispatchBatch({
    dispatchOrderId: readyOrder.dispatchOrderId,
    plannedSkuQtyLines: [getSeedSkuLine(2, 201)],
  })
  const pendingBags = createCuttingSewingTransferBags({
    dispatchBatchId: pendingBatch.dispatchBatchId,
    bagPlanList: [{ plannedGarmentQty: 201, skuQtyLines: pendingBatch.plannedSkuQtyLines }],
  })
  pickSeedFeiTicketNos(pendingBatch).slice(0, 1).forEach((feiTicketNo) => {
    scanFeiTicketIntoTransferBag({ transferBagId: pendingBags[0].transferBagId, feiTicketNo })
  })
  validateDispatchBatchCompleteness(pendingBatch.dispatchBatchId)
  markSeedBagAsSortingSample(pendingBags[0].transferBagId, '2026-04-24 14:20:00')

  const partialSource = listAvailableFeiTicketsForSewingDispatchInternal({ productionOrderId: seedProductionOrderId })[0]
  if (partialSource) {
    const partialBatch = createCuttingSewingDispatchBatch({
      dispatchOrderId: readyOrder.dispatchOrderId,
      plannedSkuQtyLines: [
        {
          colorName: partialSource.garmentColor,
          colorCode: partialSource.garmentColor,
          sizeCode: partialSource.skuSize,
          plannedGarmentQty: Math.max(partialSource.garmentQty || 1, 1),
        },
      ],
    })
    const partialBags = createCuttingSewingTransferBags({
      dispatchBatchId: partialBatch.dispatchBatchId,
      bagPlanList: [{ plannedGarmentQty: partialBatch.plannedGarmentQty, skuQtyLines: partialBatch.plannedSkuQtyLines }],
    })
    scanFeiTicketIntoTransferBag({ transferBagId: partialBags[0].transferBagId, feiTicketNo: partialSource.feiTicketNo })
    validateDispatchBatchCompleteness(partialBatch.dispatchBatchId)
    const partialBag = storeRef.transferBags.find((item) => item.transferBagId === partialBags[0].transferBagId)
    if (partialBag?.scannedFeiTicketNos.length) {
      partialBag.contentItems.forEach((item) => {
        item.remark = item.remark || '部分交出样例：本次只交出已裁出裁片，提交后继续展示缺口。'
      })
      submitCuttingSewingDispatchBatch({
        dispatchBatchId: partialBatch.dispatchBatchId,
        operatorName: '裁床交出员',
        submittedAt: '2026-04-25 09:10:00',
      })
    }
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

export function getCuttingSewingDispatchBatchHandoverSummary(
  dispatchBatchId: string,
): PdaCuttingHandoverRecordSummary | null {
  const storeRef = ensureCuttingSewingDispatchSeeded()
  const batch = storeRef.dispatchBatches.find((item) => item.dispatchBatchId === dispatchBatchId)
  if (!batch) return null
  const order = storeRef.dispatchOrders.find((item) => item.dispatchOrderId === batch.dispatchOrderId)
  if (!order) return null
  const submittedPieceQty = getDispatchBatchPieceQty(storeRef, batch)
  return clone(buildCuttingHandoverRecordSummary(storeRef, order, batch, submittedPieceQty))
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
    waitingCompleteOrderCount: storeRef.dispatchOrders.filter((order) => order.status === '待核对' || order.status === '待扫码').length,
    readyBatchCount: storeRef.dispatchBatches.filter((batch) => batch.status === '已核对').length,
    handedOverBatchCount: storeRef.dispatchBatches.filter((batch) => batch.status === '已交出').length,
    writtenBackBatchCount: storeRef.dispatchBatches.filter((batch) => batch.status === '已回写').length,
    differenceBatchCount: storeRef.dispatchBatches.filter((batch) => batch.status === '差异').length,
    objectionBatchCount: storeRef.dispatchBatches.filter((batch) => batch.status === '异议中').length,
    remainingGarmentQty: sum(storeRef.dispatchOrders.map((order) => order.remainingGarmentQty)),
  }
}
