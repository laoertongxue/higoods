import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS,
  confirmPostFinishingFactoryReturn,
  getPostFinishingFactoryReturn,
  listPostFinishingFactoryReturns,
  listPostFinishingReturnConfirmationVersions,
  registerPostFinishingFactoryReturn,
  type PostFinishingAcceptanceProductionOrder,
  type PostFinishingFactoryReturnDelivery,
  type PostFinishingReturnConfirmationVersion,
  type PostFinishingSewingTaskType,
} from './post-finishing-full-flow.ts'
import {
  createEffectiveTaskAssignment,
  getEffectiveTaskAssignment,
  type EffectiveTaskAssignment,
} from './effective-task-assignments.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC } from './factory-onboarding-ppic.ts'
import { getCurrentSewingTaskResponsibility } from './sewing-outsourcing-responsibility.ts'
import {
  getSewingCutPieceResponsibilityProjection,
  initializeSewingCutPieceResponsibility,
  listSewingCutPieceHandoverEvents,
  listSewingReturnResponsibilityVersions,
  recordSewingCutPieceHandover,
  type SewingReturnResponsibilityVersion,
} from './sewing-cut-piece-responsibility.ts'
import {
  createProductionReturnRuleSnapshot,
  listProductionReturnRuleSnapshots,
  projectProductionReturnFulfillment,
  type ProductionReturnProjection,
  type ProductionReturnReceiptFact,
} from './production-return-fulfillment.ts'
import { classifyTaskFulfillmentPolicy } from './task-fulfillment-policy.ts'

export const SEWING_RETURN_TRACKING_DEMO_NOW = '2026-09-01 12:00:00'

export interface SewingOutsourcingReturnTrackingRow {
  assignment: EffectiveTaskAssignment
  productionOrder: PostFinishingAcceptanceProductionOrder
  taskType: PostFinishingSewingTaskType
  ppicId: string
  ppicName: string
  declaredQty: number
  confirmedQty: number
  pendingPostFinishingQty: number
  deliveries: PostFinishingFactoryReturnDelivery[]
  confirmationVersions: PostFinishingReturnConfirmationVersion[]
  responsibilityVersions: SewingReturnResponsibilityVersion[]
  returnProjection: ProductionReturnProjection
}

const TASK_SEEDS: Record<PostFinishingSewingTaskType, {
  processCodes: string[]
  assignedAt: string
  cutPieceResponsibilityQtyPerSku?: number
}> = {
  INDEPENDENT_SEWING: { processCodes: ['SEW'], assignedAt: '2026-08-20 09:00:00', cutPieceResponsibilityQtyPerSku: 40 },
  SEWING_TO_IRON_PACK: { processCodes: ['SEW', 'IRON_PACK'], assignedAt: '2026-08-25 09:00:00', cutPieceResponsibilityQtyPerSku: 80 },
  CUTTING_TO_IRON_PACK: { processCodes: ['CUTTING', 'SEW', 'IRON_PACK'], assignedAt: '2026-08-27 09:00:00' },
}

function policyFor(taskType: PostFinishingSewingTaskType) {
  if (taskType === 'INDEPENDENT_SEWING') {
    return classifyTaskFulfillmentPolicy({
      processCode: 'SEW',
      processBusinessCode: 'SEW',
      processNameZh: '车缝',
      taskUnitType: 'PROCESS_TASK',
      assignmentGranularity: 'SKU',
    })
  }
  return classifyTaskFulfillmentPolicy({
    processCode: taskType === 'SEWING_TO_IRON_PACK' ? 'SEWING_IRON_PACK' : 'CUTTING_SEWING_IRON_PACK',
    processNameZh: taskType === 'SEWING_TO_IRON_PACK' ? '车缝＋烫包' : '裁剪＋车缝＋烫包',
    taskUnitType: 'MERGED_PRODUCTION_TASK',
    mergedTaskType: taskType === 'SEWING_TO_IRON_PACK' ? 'SEWING_IRON_PACK' : 'CUTTING_SEWING_IRON_PACK',
  })
}

function ensureAssignment(order: PostFinishingAcceptanceProductionOrder): EffectiveTaskAssignment {
  const existing = getEffectiveTaskAssignment(order.assignmentId)
  if (existing) return existing
  const seed = TASK_SEEDS[order.sewingTaskType]
  return createEffectiveTaskAssignment({
    assignmentId: order.assignmentId,
    runtimeTaskId: order.executionTaskId,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    taskNo: order.sewingTaskNo,
    factoryId: order.sewingFactoryId,
    factoryName: order.sewingFactoryName,
    source: 'DIRECT_DISPATCH',
    assignedQty: order.skus.reduce((sum, sku) => sum + sku.plannedQty, 0),
    skuLines: order.skus.map((sku) => ({
      skuCode: sku.skuCode,
      color: sku.colorName,
      size: sku.sizeName,
      qty: sku.plannedQty,
    })),
    processCodes: [...seed.processCodes],
    frozenPrice: 1500,
    priceCurrency: 'IDR',
    priceUnit: '件',
    businessAssignedAt: seed.assignedAt,
    operatedAt: seed.assignedAt,
    operatedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
    allocationOperatorPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
    allocationOperatorPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
  })
}

function ensureCutPieceResponsibility(order: PostFinishingAcceptanceProductionOrder, assignment: EffectiveTaskAssignment): void {
  const responsibilityQtyPerSku = TASK_SEEDS[order.sewingTaskType].cutPieceResponsibilityQtyPerSku
  if (!responsibilityQtyPerSku) return
  initializeSewingCutPieceResponsibility({
    assignmentId: assignment.assignmentId,
    requirementSnapshotId: `TECHPACK-${order.productionOrderNo}-V1`,
    requirementSnapshotAt: assignment.businessAssignedAt,
    requirementSnapshotBy: '系统按有效分配冻结',
    requirementLines: assignment.skuLines.flatMap((sku) => [
      { skuCode: sku.skuCode, color: sku.color, size: sku.size, partCode: 'FRONT', partName: '前片', piecesPerGarment: 1, allocatedGarmentQty: sku.qty },
      { skuCode: sku.skuCode, color: sku.color, size: sku.size, partCode: 'BACK', partName: '后片', piecesPerGarment: 1, allocatedGarmentQty: sku.qty },
    ]),
  })
  if (listSewingCutPieceHandoverEvents(assignment.assignmentId).length) return
  recordSewingCutPieceHandover({
    commandId: `CMD-PPIC-RETURN-HANDOVER-${assignment.assignmentId}`,
    assignmentId: assignment.assignmentId,
    handoverRecordId: `HO-PPIC-RETURN-${assignment.assignmentId}`,
    handoverRecordNo: `JCR-${order.productionOrderNo}`,
    dispatchBatchId: `BATCH-${order.productionOrderNo}`,
    handedOverAt: order.sewingTaskType === 'INDEPENDENT_SEWING' ? '2026-08-21 10:00:00' : '2026-08-26 10:00:00',
    handedOverBy: '裁床待交出仓',
    lines: assignment.skuLines.flatMap((sku) => [
      { skuCode: sku.skuCode, color: sku.color, size: sku.size, partCode: 'FRONT', pieceQty: responsibilityQtyPerSku },
      { skuCode: sku.skuCode, color: sku.color, size: sku.size, partCode: 'BACK', pieceQty: responsibilityQtyPerSku },
    ]),
  })
  getSewingCutPieceResponsibilityProjection(assignment.assignmentId)
}

function ensureReturnRule(order: PostFinishingAcceptanceProductionOrder, assignment: EffectiveTaskAssignment): void {
  if (listProductionReturnRuleSnapshots({ assignmentId: assignment.assignmentId, activeOnly: true }).length) return
  createProductionReturnRuleSnapshot({
    assignmentId: assignment.assignmentId,
    runtimeTaskId: assignment.runtimeTaskId,
    productionOrderId: assignment.productionOrderId,
    factoryId: assignment.factoryId,
    factoryName: assignment.factoryName,
    assignedQty: assignment.assignedQty,
    businessAssignedAt: assignment.businessAssignedAt,
    policy: policyFor(order.sewingTaskType),
  })
}

function ensureDelivery(order: PostFinishingAcceptanceProductionOrder, orderIndex: number): void {
  const demoIdempotencyKey = `PPIC-RETURN-DEMO-${order.productionOrderNo}-1`
  let delivery = listPostFinishingFactoryReturns().find((item) => (
    item.productionOrderNo === order.productionOrderNo && item.returnIndex === 1
  ))
  if (!delivery) {
    const qtyPerSku = orderIndex === 0 ? 40 : 60
    delivery = registerPostFinishingFactoryReturn({
      productionOrderNo: order.productionOrderNo,
      returnIndex: 1,
      triggerSource: '公共PDA自助回货',
      idempotencyKey: demoIdempotencyKey,
      quantities: order.skus.map((sku) => ({ skuId: sku.skuId, registeredQty: qtyPerSku })),
      deliveryPersonName: '三方车缝工厂送货员',
      deliveryPersonPhone: '+62-812-0000-0000',
      evidenceImageUrls: [order.skus[0]!.imageUrl],
      actor: POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier,
      nowMs: Date.parse(orderIndex === 0 ? '2026-08-22T10:00:00Z' : orderIndex === 1 ? '2026-08-28T09:00:00Z' : '2026-09-01T09:00:00Z'),
    })
  }
  // 后道 3×5×5 演示可能已先创建同一生产单、同一回货序号的事实。
  // PPIC 工作台只读取该事实，不得用自己的演示数量再次确认或覆盖后道数据。
  if (delivery.idempotencyKey !== demoIdempotencyKey) return
  if (orderIndex > 1 || !['待后道确认', '待二次点数', '差异待授权'].includes(delivery.status)) return
  const confirmed = order.skus.map((sku, skuIndex) => ({
    skuId: sku.skuId,
    actualQty: orderIndex === 0 ? (skuIndex === order.skus.length - 1 ? 38 : 40) : 60,
  }))
  confirmPostFinishingFactoryReturn({
    deliveryId: delivery.deliveryId,
    firstCounts: confirmed,
    actor: POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer,
    nowMs: Date.parse(orderIndex === 0 ? '2026-08-23T11:00:00Z' : '2026-08-28T11:00:00Z'),
  })
}

export function ensureSewingOutsourcingReturnTrackingDemo(): void {
  POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.forEach((order, orderIndex) => {
    const assignment = ensureAssignment(order)
    ensureCutPieceResponsibility(order, assignment)
    ensureReturnRule(order, assignment)
    ensureDelivery(order, orderIndex)
  })
}

function receiptFacts(versions: PostFinishingReturnConfirmationVersion[]): ProductionReturnReceiptFact[] {
  return versions.filter((version) => version.status === 'ACTIVE').map((version) => ({
    receiptId: version.confirmationVersionId,
    assignmentId: version.assignmentId,
    executionTaskId: version.executionTaskId,
    productionOrderId: version.productionOrderId,
    factoryId: version.factoryId,
    declaredQty: version.registeredQty,
    confirmedQty: version.confirmedQty,
    confirmedDate: version.confirmedAt.slice(0, 10),
    confirmedAt: version.confirmedAt,
    confirmed: true,
    sourceType: 'POST_FINISHING_FINAL_CONFIRMATION',
    sourceDocumentNo: version.deliveryOrderNo,
    confirmationVersionId: version.confirmationVersionId,
    skuCodes: version.lines.map((line) => line.skuCode),
  }))
}

export function listSewingOutsourcingReturnTrackingRows(
  nowAt: string = SEWING_RETURN_TRACKING_DEMO_NOW,
): SewingOutsourcingReturnTrackingRow[] {
  ensureSewingOutsourcingReturnTrackingDemo()
  return POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.map((productionOrder) => {
    const assignment = getEffectiveTaskAssignment(productionOrder.assignmentId)!
    const responsibility = getCurrentSewingTaskResponsibility(assignment.runtimeTaskId)
    const deliveries = listPostFinishingFactoryReturns().filter((delivery) => delivery.assignmentId === assignment.assignmentId)
    const confirmationVersions = listPostFinishingReturnConfirmationVersions({ assignmentId: assignment.assignmentId })
    const activeConfirmationVersions = confirmationVersions.filter((version) => version.status === 'ACTIVE')
    const responsibilityVersions = productionOrder.sewingTaskType === 'CUTTING_TO_IRON_PACK'
      ? []
      : listSewingReturnResponsibilityVersions(assignment.assignmentId)
    const snapshot = listProductionReturnRuleSnapshots({ assignmentId: assignment.assignmentId, activeOnly: true })[0]!
    const returnProjection = projectProductionReturnFulfillment({
      snapshot,
      receipts: receiptFacts(activeConfirmationVersions),
      today: nowAt.slice(0, 10),
      nowAt,
      usesCutPieceResponsibility: productionOrder.sewingTaskType !== 'CUTTING_TO_IRON_PACK',
      responsibilityVersions,
    })
    const declaredQty = deliveries.reduce((sum, delivery) => sum + delivery.lines.reduce((lineSum, line) => lineSum + line.registeredQty, 0), 0)
    const confirmedQty = activeConfirmationVersions.reduce((sum, version) => sum + version.confirmedQty, 0)
    return {
      assignment,
      productionOrder,
      taskType: productionOrder.sewingTaskType,
      ppicId: responsibility?.ppicId || assignment.ppicId || '',
      ppicName: responsibility?.ppicName || assignment.ppicName || '',
      declaredQty,
      confirmedQty,
      pendingPostFinishingQty: Math.max(0, declaredQty - confirmedQty),
      deliveries,
      confirmationVersions,
      responsibilityVersions,
      returnProjection,
    }
  })
}

export function getSewingOutsourcingReturnTrackingRow(assignmentId: string): SewingOutsourcingReturnTrackingRow | undefined {
  return listSewingOutsourcingReturnTrackingRows().find((row) => row.assignment.assignmentId === assignmentId)
}

export function getSewingOutsourcingReturnDelivery(deliveryId: string): PostFinishingFactoryReturnDelivery | undefined {
  return getPostFinishingFactoryReturn(deliveryId)
}
