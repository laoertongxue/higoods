import type { ProductionOrder } from '../production-orders.ts'
import { TEST_FACTORY_NAME } from '../factory-mock-data.ts'
import {
  listCuttingProductionOrdersWithFormalTechPack,
  listGeneratedOriginalCutOrderSourceRecords,
  type GeneratedOriginalCutOrderPieceRow,
  type GeneratedOriginalCutOrderSourceRecord,
} from './generated-original-cut-orders.ts'
import type {
  CuttingConfigStatus,
  CuttingMaterialLine,
  CuttingOrderProgressRecord,
  CuttingPieceProgressLine,
  CuttingPrintSlipStatus,
  CuttingQrStatus,
  CuttingReceiveStatus,
  CuttingReviewStatus,
  CuttingRiskFlag,
  CuttingSkuRequirementLine,
  CuttingUrgencyLevel,
} from './types'

interface CuttingDemoStageProfile {
  stageLabel: string
  reviewStatus: CuttingReviewStatus
  configStatus: CuttingConfigStatus
  receiveStatus: CuttingReceiveStatus
  printSlipStatus: CuttingPrintSlipStatus
  qrStatus: CuttingQrStatus
  hasSpreadingRecord: boolean
  hasInboundRecord: boolean
  cutRatio: number
  inboundRatio: number
  riskFlags: CuttingRiskFlag[]
  latestActionText: string
  lastOperatorName: string
}

const DEMO_STAGE_PROFILES: CuttingDemoStageProfile[] = [
  {
    stageLabel: 'WMS 待来料',
    reviewStatus: 'NOT_REQUIRED',
    configStatus: 'NOT_CONFIGURED',
    receiveStatus: 'NOT_RECEIVED',
    printSlipStatus: 'NOT_PRINTED',
    qrStatus: 'NOT_GENERATED',
    hasSpreadingRecord: false,
    hasInboundRecord: false,
    cutRatio: 0,
    inboundRatio: 0,
    riskFlags: [],
    latestActionText: '等待 WMS 完成来料接收后进入裁床待加工仓。',
    lastOperatorName: 'WMS',
  },
  {
    stageLabel: '待排唛架方案',
    reviewStatus: 'APPROVED',
    configStatus: 'CONFIGURED',
    receiveStatus: 'RECEIVED',
    printSlipStatus: 'NOT_PRINTED',
    qrStatus: 'GENERATED',
    hasSpreadingRecord: false,
    hasInboundRecord: false,
    cutRatio: 0,
    inboundRatio: 0,
    riskFlags: [],
    latestActionText: 'WMS 来料已进入裁床待加工仓，可新建排唛架方案。',
    lastOperatorName: 'WMS',
  },
  {
    stageLabel: '待铺布',
    reviewStatus: 'APPROVED',
    configStatus: 'CONFIGURED',
    receiveStatus: 'RECEIVED',
    printSlipStatus: 'NOT_PRINTED',
    qrStatus: 'GENERATED',
    hasSpreadingRecord: false,
    hasInboundRecord: false,
    cutRatio: 0,
    inboundRatio: 0,
    riskFlags: [],
    latestActionText: '排唛架方案已生成，等待选择唛架编号并安排裁床。',
    lastOperatorName: '裁床计划员',
  },
  {
    stageLabel: '铺布中',
    reviewStatus: 'APPROVED',
    configStatus: 'CONFIGURED',
    receiveStatus: 'RECEIVED',
    printSlipStatus: 'NOT_PRINTED',
    qrStatus: 'GENERATED',
    hasSpreadingRecord: true,
    hasInboundRecord: false,
    cutRatio: 0.55,
    inboundRatio: 0,
    riskFlags: [],
    latestActionText: '已按唛架编号开始铺布，裁床执行中。',
    lastOperatorName: '裁床 A 组',
  },
  {
    stageLabel: '待打印菲票',
    reviewStatus: 'APPROVED',
    configStatus: 'CONFIGURED',
    receiveStatus: 'RECEIVED',
    printSlipStatus: 'NOT_PRINTED',
    qrStatus: 'GENERATED',
    hasSpreadingRecord: true,
    hasInboundRecord: false,
    cutRatio: 1,
    inboundRatio: 0,
    riskFlags: [],
    latestActionText: '铺布裁剪已完成，等待按裁片结果打印菲票。',
    lastOperatorName: '裁床 A 组',
  },
  {
    stageLabel: '待交出仓',
    reviewStatus: 'APPROVED',
    configStatus: 'CONFIGURED',
    receiveStatus: 'RECEIVED',
    printSlipStatus: 'PRINTED',
    qrStatus: 'GENERATED',
    hasSpreadingRecord: true,
    hasInboundRecord: true,
    cutRatio: 1,
    inboundRatio: 1,
    riskFlags: [],
    latestActionText: '菲票已打印，裁片已进入待交出仓。',
    lastOperatorName: '裁床仓管',
  },
]

function pickProfile(orderIndex: number): CuttingDemoStageProfile {
  return DEMO_STAGE_PROFILES[orderIndex % DEMO_STAGE_PROFILES.length]
}

function buildSkuRequirementLines(order: ProductionOrder): CuttingSkuRequirementLine[] {
  return order.demandSnapshot.skuLines.map((line) => ({
    skuCode: line.skuCode,
    color: line.color,
    size: line.size,
    plannedQty: line.qty,
  }))
}

function deriveUrgencyLevel(requiredDeliveryDate: string | null): CuttingUrgencyLevel {
  if (!requiredDeliveryDate) return 'C'
  if (requiredDeliveryDate <= '2026-03-24') return 'AA'
  if (requiredDeliveryDate <= '2026-03-28') return 'A'
  if (requiredDeliveryDate <= '2026-04-05') return 'B'
  return 'C'
}

function estimateLength(requiredQty: number): number {
  return Number(Math.max(requiredQty * 0.42, 1).toFixed(2))
}

function estimateRollCount(requiredQty: number): number {
  return Math.max(Math.ceil(requiredQty / 1800), 1)
}

function buildPieceProgressLines(
  generated: GeneratedOriginalCutOrderSourceRecord,
  profile: CuttingDemoStageProfile,
): CuttingPieceProgressLine[] | undefined {
  if (!profile.hasSpreadingRecord) return undefined
  const pieces = generated.pieceRows.length
    ? generated.pieceRows
    : [{ partCode: 'piece-main', partName: '裁片', pieceCountPerUnit: 1 } as GeneratedOriginalCutOrderPieceRow]

  return generated.skuScopeLines.flatMap((skuLine) =>
    pieces.map((piece) => {
      const plannedPieceQty = Math.round(skuLine.plannedQty * Math.max(piece.pieceCountPerUnit, 1))
      const actualCutQty = Math.round(plannedPieceQty * profile.cutRatio)
      return {
        skuCode: skuLine.skuCode,
        color: skuLine.color,
        size: skuLine.size,
        partCode: piece.partCode,
        partName: piece.partName,
        actualCutQty,
        inboundQty: Math.round(actualCutQty * profile.inboundRatio),
        feiPrintedQty: profile.printSlipStatus === 'PRINTED' ? actualCutQty : 0,
        latestUpdatedAt: '2026-03-18 16:00',
        latestOperatorName: profile.lastOperatorName,
      }
    }),
  )
}

function buildProjectedMaterialLine(
  generated: GeneratedOriginalCutOrderSourceRecord,
  profile: CuttingDemoStageProfile,
): CuttingMaterialLine {
  const estimatedLength = estimateLength(generated.requiredQty)
  const rollCount = estimateRollCount(generated.requiredQty)
  const isReceived = profile.receiveStatus === 'RECEIVED'

  return {
    originalCutOrderId: generated.originalCutOrderId,
    originalCutOrderNo: generated.originalCutOrderNo,
    cutPieceOrderNo: generated.originalCutOrderNo,
    mergeBatchId: generated.mergeBatchId,
    mergeBatchNo: generated.mergeBatchNo,
    materialSku: generated.materialSku,
    materialType: generated.materialType,
    materialLabel: generated.materialLabel,
    color: generated.colorScope[0] || '待补',
    materialCategory: generated.materialCategory,
    reviewStatus: profile.reviewStatus,
    configStatus: profile.configStatus,
    receiveStatus: profile.receiveStatus,
    configuredRollCount: profile.configStatus === 'NOT_CONFIGURED' ? 0 : rollCount,
    configuredLength: profile.configStatus === 'NOT_CONFIGURED' ? 0 : estimatedLength,
    receivedRollCount: isReceived ? rollCount : 0,
    receivedLength: isReceived ? estimatedLength : 0,
    printSlipStatus: profile.printSlipStatus,
    qrStatus: profile.qrStatus,
    batchOccupancyStatus: generated.mergeBatchNo ? 'IN_BATCH' : 'AVAILABLE',
    skuScopeLines: generated.skuScopeLines.map((line) => ({ ...line })),
    pieceProgressLines: buildPieceProgressLines(generated, profile),
    issueFlags: [...profile.riskFlags],
    latestActionText: profile.latestActionText,
  }
}

function buildProjectedRecord(
  order: ProductionOrder,
  generatedOriginals: GeneratedOriginalCutOrderSourceRecord[],
  orderIndex: number,
): CuttingOrderProgressRecord {
  const profile = pickProfile(orderIndex)
  const skuRequirementLines = buildSkuRequirementLines(order)
  const materialLines = generatedOriginals.map((generated) => buildProjectedMaterialLine(generated, profile))
  const updatedAt = order.updatedAt || order.createdAt

  return {
    id: `cutting-op:${order.productionOrderId}`,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderId,
    actualOrderDate: order.createdAt.slice(0, 10),
    purchaseDate: order.createdAt.slice(0, 10),
    orderQty: skuRequirementLines.reduce((sum, line) => sum + line.plannedQty, 0),
    plannedShipDate: order.demandSnapshot.requiredDeliveryDate || '',
    spuCode: order.demandSnapshot.spuCode,
    techPackSpuCode: order.demandSnapshot.spuCode,
    styleCode: order.demandSnapshot.spuCode,
    styleName: order.demandSnapshot.spuName,
    sellingPrice: undefined,
    urgencyLevel: deriveUrgencyLevel(order.demandSnapshot.requiredDeliveryDate),
    cuttingTaskNo: `CUT-TASK-${order.productionOrderId.replace(/\D/g, '').slice(-6)}`,
    assignedFactoryName: order.mainFactorySnapshot?.name || TEST_FACTORY_NAME,
    cuttingStage: profile.stageLabel,
    riskFlags: [...profile.riskFlags],
    lastPickupScanAt: profile.receiveStatus === 'RECEIVED' ? updatedAt : '',
    lastFieldUpdateAt: updatedAt,
    lastOperatorName: profile.lastOperatorName,
    hasSpreadingRecord: profile.hasSpreadingRecord,
    hasInboundRecord: profile.hasInboundRecord,
    skuRequirementLines,
    materialLines,
  }
}

const generatedOriginalCutOrders = listGeneratedOriginalCutOrderSourceRecords()
const formalCuttingProductionOrders = listCuttingProductionOrdersWithFormalTechPack()

export const cuttingOrderProgressRecords: CuttingOrderProgressRecord[] = formalCuttingProductionOrders
  .map((order, orderIndex) => {
    const generatedOriginals = generatedOriginalCutOrders.filter(
      (item) => item.productionOrderId === order.productionOrderId,
    )
    if (generatedOriginals.length === 0) return null
    return buildProjectedRecord(order, generatedOriginals, orderIndex)
  })
  .filter((record): record is CuttingOrderProgressRecord => record !== null)

export function updateCuttingOrderProgressWebStage(
  originalCutOrderId: string,
  payload: { cuttingStage: string; operatorName?: string; operatedAt?: string },
): CuttingOrderProgressRecord | undefined {
  const record = cuttingOrderProgressRecords.find((item) =>
    item.materialLines.some(
      (line) =>
        line.originalCutOrderId === originalCutOrderId ||
        line.originalCutOrderNo === originalCutOrderId ||
        line.cutPieceOrderNo === originalCutOrderId,
    ),
  )
  if (!record) return undefined

  record.cuttingStage = payload.cuttingStage
  record.lastOperatorName = payload.operatorName?.trim() || record.lastOperatorName
  record.lastFieldUpdateAt = payload.operatedAt?.trim() || record.lastFieldUpdateAt
  if (payload.cuttingStage === '铺布中' || payload.cuttingStage === '待裁剪' || payload.cuttingStage === '裁剪中') {
    record.hasSpreadingRecord = true
  }
  if (payload.cuttingStage === '待交出仓' || payload.cuttingStage === '已入仓') {
    record.hasInboundRecord = true
  }
  return record
}
