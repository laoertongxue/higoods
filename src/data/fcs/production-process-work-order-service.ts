import { registerFormalProductionOrderDyeWorkOrder } from './dyeing-task-domain.ts'
import {
  issueProcessWorkOrderIdentity,
  listProcessWorkOrders,
  type FormalProductionOrderProcessSnapshot,
  type ProcessWorkOrderType,
} from './process-work-order-domain.ts'
import { registerFormalProductionOrderPrintWorkOrder } from './printing-task-domain.ts'
import type { ProductionOrder } from './production-orders.ts'

export type { FormalProductionOrderProcessSnapshot } from './process-work-order-domain.ts'

export interface EnsuredProductionProcessWorkOrders {
  dyeWorkOrderId?: string
  printWorkOrderId?: string
}

function findExistingWorkOrderId(
  productionOrderId: string,
  processType: Extract<ProcessWorkOrderType, 'DYE' | 'PRINT'>,
): string | undefined {
  return listProcessWorkOrders(processType)
    .find((order) => order.sourceProductionOrderId === productionOrderId)
    ?.workOrderId
}

function validateSnapshot(snapshot: FormalProductionOrderProcessSnapshot): void {
  if (!snapshot.productionOrderId.trim()) throw new Error('正式生产单 ID 不能为空')
  if (!snapshot.productionOrderNo.trim()) throw new Error('正式生产单号不能为空')
  if (!snapshot.techPackVersionId.trim() || !snapshot.techPackVersionLabel.trim()) {
    throw new Error('正式生产单必须携带已发布技术包版本快照')
  }
  if (!snapshot.materialId.trim() || !snapshot.materialName.trim()) {
    throw new Error('正式生产单必须携带 BOM 面料快照')
  }
  if (!Number.isFinite(snapshot.plannedQty) || snapshot.plannedQty <= 0 || !snapshot.qtyUnit.trim()) {
    throw new Error('正式生产单加工数量和单位必须有效')
  }
  if (snapshot.processCodes.length === 0) throw new Error('正式生产单加工工艺不能为空')
  const unsupportedProcessCodes = snapshot.processCodes
    .map((code) => String(code).trim().toUpperCase())
    .filter((code) => code !== 'DYE' && code !== 'PRINT')
  if (unsupportedProcessCodes.length > 0) {
    throw new Error(`不支持的生产工艺：${[...new Set(unsupportedProcessCodes)].join('、')}`)
  }
}

function roundPlannedQty(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

export function buildFormalProductionOrderProcessSnapshots(
  order: ProductionOrder,
): FormalProductionOrderProcessSnapshot[] {
  const techPackSnapshot = order.techPackSnapshot
  if (!techPackSnapshot) return []
  const productionQty = order.demandSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0)
  const processCodes = (['DYE', 'PRINT'] as const)
    .filter((processCode) => techPackSnapshot.processEntries.some((entry) => entry.processCode === processCode))

  return processCodes.map((processCode) => {
    const entries = techPackSnapshot.processEntries.filter((entry) => entry.processCode === processCode)
    const linkedBomItemIds = [...new Set(entries.flatMap((entry) => entry.linkedBomItemIds || []))]
    const processLabel = processCode === 'DYE' ? '染色' : '印花'
    if (linkedBomItemIds.length === 0) {
      throw new Error(`生产单 ${order.productionOrderNo} 的${processLabel}工艺未绑定 BOM 物料`)
    }
    const bomItems = linkedBomItemIds.map((bomItemId) => {
      const bomItem = techPackSnapshot.bomItems.find((item) => item.id === bomItemId)
      if (!bomItem) throw new Error(`生产单 ${order.productionOrderNo} 的${processLabel}工艺绑定了不存在的 BOM：${bomItemId}`)
      return bomItem
    })
    const units = [...new Set(bomItems.map((item) => item.unit?.trim()).filter((unit): unit is string => Boolean(unit)))]
    if (units.length !== 1 || bomItems.some((item) => !item.unit?.trim())) {
      throw new Error(`生产单 ${order.productionOrderNo} 的${processLabel}工艺绑定多种或缺失数量单位，无法合并为一张加工单`)
    }
    const plannedQty = roundPlannedQty(bomItems.reduce(
      (sum, item) => sum + productionQty * item.unitConsumption * (1 + item.lossRate),
      0,
    ))
    const materialNames = bomItems.map((item) => `${item.name}${item.spec ? ` / ${item.spec}` : ''}`)
    const targetColors = [...new Set(bomItems.map((item) => item.colorLabel).filter((color): color is string => Boolean(color)))]
    const processName = [...new Set(entries.map((entry) => entry.processName).filter(Boolean))].join('、') || processLabel
    return {
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
      orderedAt: order.createdAt,
      techPackVersionId: techPackSnapshot.sourceTechPackVersionId,
      techPackVersionLabel: techPackSnapshot.sourceTechPackVersionLabel || techPackSnapshot.versionLabel,
      materialId: bomItems.map((item) => item.id).join('+'),
      materialName: materialNames.join('、'),
      targetColor: targetColors.join('、') || order.demandSnapshot.skuLines[0]?.color || '按技术包配色',
      plannedQty,
      qtyUnit: units[0],
      processCodes: [processCode],
      dyeProcessName: processCode === 'DYE' ? processName : undefined,
      printProcessName: processCode === 'PRINT' ? processName : undefined,
      spuCode: order.demandSnapshot.spuCode,
      spuName: order.demandSnapshot.spuName,
      requiredDeliveryDate: order.demandSnapshot.requiredDeliveryDate || '',
    }
  })
}

export function ensureProcessWorkOrdersForFormalProductionOrder(
  snapshot: FormalProductionOrderProcessSnapshot,
): EnsuredProductionProcessWorkOrders {
  validateSnapshot(snapshot)
  const processCodes = new Set(snapshot.processCodes)
  const result: EnsuredProductionProcessWorkOrders = {}

  if (processCodes.has('DYE')) {
    const existingId = findExistingWorkOrderId(snapshot.productionOrderId, 'DYE')
    if (existingId) {
      result.dyeWorkOrderId = existingId
    } else {
      const identity = issueProcessWorkOrderIdentity('DYE', snapshot.orderedAt)
      result.dyeWorkOrderId = registerFormalProductionOrderDyeWorkOrder({
        ...identity,
        productionOrderId: snapshot.productionOrderId,
        productionOrderNo: snapshot.productionOrderNo,
        orderedAt: snapshot.orderedAt,
        techPackVersionId: snapshot.techPackVersionId,
        techPackVersionLabel: snapshot.techPackVersionLabel,
        materialId: snapshot.materialId,
        materialName: snapshot.materialName,
        targetColor: snapshot.targetColor,
        plannedQty: snapshot.plannedQty,
        qtyUnit: snapshot.qtyUnit,
        processCodes: [...snapshot.processCodes],
        processName: snapshot.dyeProcessName || '染色',
        factoryId: snapshot.factoryId,
        factoryName: snapshot.factoryId ? (snapshot.factoryName || snapshot.factoryId) : undefined,
        spuCode: snapshot.spuCode,
        spuName: snapshot.spuName,
        requiredDeliveryDate: snapshot.requiredDeliveryDate,
      }).dyeOrderId
    }
  }

  if (processCodes.has('PRINT')) {
    const existingId = findExistingWorkOrderId(snapshot.productionOrderId, 'PRINT')
    if (existingId) {
      result.printWorkOrderId = existingId
    } else {
      const identity = issueProcessWorkOrderIdentity('PRINT', snapshot.orderedAt)
      result.printWorkOrderId = registerFormalProductionOrderPrintWorkOrder({
        ...identity,
        productionOrderId: snapshot.productionOrderId,
        productionOrderNo: snapshot.productionOrderNo,
        orderedAt: snapshot.orderedAt,
        techPackVersionId: snapshot.techPackVersionId,
        techPackVersionLabel: snapshot.techPackVersionLabel,
        materialId: snapshot.materialId,
        materialName: snapshot.materialName,
        targetColor: snapshot.targetColor,
        plannedQty: snapshot.plannedQty,
        qtyUnit: snapshot.qtyUnit,
        processCodes: [...snapshot.processCodes],
        processName: snapshot.printProcessName || '印花',
        factoryId: snapshot.factoryId,
        factoryName: snapshot.factoryId ? (snapshot.factoryName || snapshot.factoryId) : undefined,
        spuCode: snapshot.spuCode,
        spuName: snapshot.spuName,
        requiredDeliveryDate: snapshot.requiredDeliveryDate,
      }).printOrderId
    }
  }

  return result
}
