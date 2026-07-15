import { registerFormalProductionOrderDyeWorkOrder } from './dyeing-task-domain.ts'
import {
  issueProcessWorkOrderIdentity,
  listProcessWorkOrders,
  type ProcessWorkOrderType,
} from './process-work-order-domain.ts'
import { registerFormalProductionOrderPrintWorkOrder } from './printing-task-domain.ts'

export interface FormalProductionOrderProcessSnapshot {
  productionOrderId: string
  productionOrderNo: string
  orderedAt: string
  techPackVersionId: string
  techPackVersionLabel: string
  materialId: string
  materialName: string
  targetColor: string
  plannedQty: number
  qtyUnit: string
  processCodes: string[]
  dyeProcessName?: string
  printProcessName?: string
  factoryId?: string
  factoryName?: string
}

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
}

export function ensureProcessWorkOrdersForFormalProductionOrder(
  snapshot: FormalProductionOrderProcessSnapshot,
): EnsuredProductionProcessWorkOrders {
  validateSnapshot(snapshot)
  const processCodes = new Set(snapshot.processCodes.map((code) => code.trim().toUpperCase()))
  const result: EnsuredProductionProcessWorkOrders = {}

  if (processCodes.has('DYE')) {
    const existingId = findExistingWorkOrderId(snapshot.productionOrderId, 'DYE')
    if (existingId) {
      result.dyeWorkOrderId = existingId
    } else {
      const identity = issueProcessWorkOrderIdentity('DYE', snapshot.orderedAt)
      result.dyeWorkOrderId = registerFormalProductionOrderDyeWorkOrder({
        ...identity,
        sourceProductionOrderId: snapshot.productionOrderId,
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
        sourceProductionOrderId: snapshot.productionOrderId,
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
      }).printOrderId
    }
  }

  return result
}
