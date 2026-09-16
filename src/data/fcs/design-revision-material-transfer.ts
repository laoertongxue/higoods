import {
  getFactoryReceivingSource,
  registerFactoryReceivingSource,
  type FactoryReceivingSource,
  type ReceivingMaterial,
} from './factory-receiving.ts'
import { getDyeWorkOrderById } from './dyeing-task-domain.ts'
import { getPrintWorkOrderById } from './printing-task-domain.ts'
import type { ProcessWorkOrderSourceSnapshot } from './process-work-order-domain.ts'

export type DesignRevisionMaterialTransferProcessType = 'DYEING' | 'PRINTING'

export type DesignRevisionMaterialTransferReadinessStatus =
  | 'NOT_FOUND'
  | 'NOT_DESIGN_REVISION'
  | 'WAIT_PROFESSIONAL_RESULT'
  | 'WAIT_ASSIGNMENT'
  | 'WAIT_ACCEPTANCE'
  | 'WAIT_UPSTREAM'
  | 'READY'
  | 'EXISTING'

export interface DesignRevisionMaterialTransferReadiness {
  status: DesignRevisionMaterialTransferReadinessStatus
  message: string
  sourceId: string
  workOrderNo: string
  materialName: string
  plannedQty: number
  qtyUnit: string
  factoryId: string
  factoryName: string
}

export function getDesignRevisionProcessMaterialTransferId(
  processType: DesignRevisionMaterialTransferProcessType,
  processOrderId: string,
): string {
  return `DR-MATERIAL-${processType}-${processOrderId}`
}

export function getDesignRevisionProcessMaterialTransferReadiness(
  processType: DesignRevisionMaterialTransferProcessType,
  processOrderId: string,
): DesignRevisionMaterialTransferReadiness {
  const dyeOrder = processType === 'DYEING' ? getDyeWorkOrderById(processOrderId) : undefined
  const printOrder = processType === 'PRINTING' ? getPrintWorkOrderById(processOrderId) : undefined
  const source = dyeOrder?.sourceSnapshot || printOrder?.sourceSnapshot
  const sourceId = getDesignRevisionProcessMaterialTransferId(processType, processOrderId)
  const workOrderNo = dyeOrder?.dyeOrderNo || printOrder?.printOrderNo || processOrderId
  const factoryId = dyeOrder?.dyeFactoryId || printOrder?.printFactoryId || ''
  const factoryName = dyeOrder?.dyeFactoryName || printOrder?.printFactoryName || ''
  const base = {
    sourceId,
    workOrderNo,
    materialName: source?.materialName?.trim() || '',
    plannedQty: dyeOrder?.plannedQty || printOrder?.plannedQty || 0,
    qtyUnit: dyeOrder?.qtyUnit || printOrder?.qtyUnit || '',
    factoryId,
    factoryName,
  }
  if (!dyeOrder && !printOrder) return { ...base, status: 'NOT_FOUND', message: '未找到对应加工单。' }
  if (source?.sourceType !== 'DESIGN_REVISION') return { ...base, status: 'NOT_DESIGN_REVISION', message: '该加工单不是设计改款来源。' }
  const existing = getFactoryReceivingSource(sourceId)
  if (existing) return { ...base, status: 'EXISTING', message: '备料调拨已生成。' }
  if (processType === 'PRINTING' && source.upstreamWorkOrderId) return { ...base, status: 'WAIT_UPSTREAM', message: '等待前序染色加工单交出并由印花厂接收。' }
  if (!source.professionalResultId || !source.professionalResultAttachments?.length) {
    return { ...base, status: 'WAIT_PROFESSIONAL_RESULT', message: `等待买手审核${processType === 'PRINTING' ? '花型' : '调色'}成果。` }
  }
  if (!factoryId) return { ...base, status: 'WAIT_ASSIGNMENT', message: '等待 PPIC 分配加工厂。' }
  const acceptanceStatus = dyeOrder?.acceptanceStatus || printOrder?.acceptanceStatus
  if (acceptanceStatus !== 'ACCEPTED') return { ...base, status: 'WAIT_ACCEPTANCE', message: '等待加工厂接单。' }
  return { ...base, status: 'READY', message: '可生成备料调拨。' }
}

function requireDesignRevisionMaterial(source: ProcessWorkOrderSourceSnapshot | undefined): ReceivingMaterial {
  if (source?.sourceType !== 'DESIGN_REVISION') throw new Error('该加工单不是设计改款来源，不能生成设计改款备料调拨。')
  if (!source.materialReceivingKind || !source.materialSkuCode?.trim() || !source.materialName?.trim()
    || !source.materialImageUrl?.trim() || !source.materialColor?.trim() || !source.materialComposition?.trim()
    || !source.materialSpecification?.trim()) {
    throw new Error('设计改款 BOM 物料的编码、名称、真实图片、颜色、成分和规格必须完整。')
  }
  return {
    sku: source.materialSkuCode.trim(),
    name: source.materialName.trim(),
    kind: source.materialReceivingKind,
    imageUrl: source.materialImageUrl.trim(),
    color: source.materialColor.trim(),
    composition: source.materialComposition.trim(),
    specification: source.materialSpecification.trim(),
    batchNo: `DR-${source.designRevisionTaskNo}-${source.bomItemId}`,
  }
}

function transferOrigin(kind: ReceivingMaterial['kind']) {
  if (kind === 'YARN') return { kind: 'WAREHOUSE' as const, id: 'WH-MAOSHA-001', name: '纱线中央仓', warehouseAttribute: '纱线中央仓' as const }
  if (kind === 'ACCESSORY') return { kind: 'WAREHOUSE' as const, id: 'WH-FITTING-001', name: '辅料中央仓', warehouseAttribute: '辅料中央仓' as const }
  return { kind: 'WAREHOUSE' as const, id: 'WH-FABRIC-001', name: '面料中央仓', warehouseAttribute: '面料中央仓' as const }
}

function fabricRolls(material: ReceivingMaterial, workOrderNo: string, plannedQty: number, qtyUnit: string) {
  if (material.kind !== 'FABRIC') return []
  const yard = ['米', 'm', 'M'].includes(qtyUnit) ? plannedQty / 0.9144 : plannedQty
  return [{ barcode: `${workOrderNo}-RAW-001`, yard: Number(yard.toFixed(4)) }]
}

/**
 * BOM 与价格方案确认后，加工厂接单；仓库据此建立首道真实备料调拨。
 * 该动作只生成待审核原单，仍需仓库使用 approveFactoryTransfer 后才可收货。
 */
export function createDesignRevisionProcessMaterialTransfer(input: {
  processType: DesignRevisionMaterialTransferProcessType
  processOrderId: string
  issuedBy: string
  issuedAt: string
}): FactoryReceivingSource {
  if (!input.processOrderId.trim() || !input.issuedBy.trim() || !input.issuedAt.trim()) throw new Error('加工单、发料人和发料时间必须完整。')
  const readiness = getDesignRevisionProcessMaterialTransferReadiness(input.processType, input.processOrderId)
  if (readiness.status === 'EXISTING') return getFactoryReceivingSource(readiness.sourceId)!
  if (readiness.status === 'WAIT_UPSTREAM') throw new Error('该印花加工单应接收前序染色交出物，不能重复从仓库发料。')
  if (readiness.status !== 'READY') throw new Error(readiness.message)
  const dyeOrder = input.processType === 'DYEING' ? getDyeWorkOrderById(input.processOrderId) : undefined
  const printOrder = input.processType === 'PRINTING' ? getPrintWorkOrderById(input.processOrderId) : undefined
  const source = dyeOrder?.sourceSnapshot || printOrder?.sourceSnapshot
  if (source?.sourceType !== 'DESIGN_REVISION') throw new Error('该加工单不是设计改款来源，不能生成设计改款备料调拨。')

  const factoryId = readiness.factoryId
  const factoryName = readiness.factoryName

  const workOrderNo = dyeOrder?.dyeOrderNo || printOrder?.printOrderNo || input.processOrderId
  const taskNo = dyeOrder?.taskNo || printOrder?.taskNo || input.processOrderId
  const plannedQty = dyeOrder?.plannedQty || printOrder?.plannedQty || 0
  const qtyUnit = dyeOrder?.qtyUnit || printOrder?.qtyUnit || ''
  const sourceMaterial = requireDesignRevisionMaterial(source)
  const material: ReceivingMaterial = {
    ...sourceMaterial,
    sku: dyeOrder?.rawMaterialSku || printOrder?.materialSku || sourceMaterial.sku,
  }
  const transferId = readiness.sourceId
  const existing = getFactoryReceivingSource(transferId)
  if (existing) return existing
  const transfer: FactoryReceivingSource = {
    id: transferId,
    documentNo: `DB-${workOrderNo}`,
    type: 'TRANSFER',
    origin: transferOrigin(material.kind),
    targetFactoryId: factoryId,
    targetFactoryName: factoryName,
    createdAt: input.issuedAt,
    createdBy: input.issuedBy,
    workOrderNo,
    ...(input.processType === 'PRINTING' ? { processCode: 'PRINT' as const } : {}),
    lines: [{
      id: `${transferId}-L1`,
      material,
      plannedQty,
      sentQty: plannedQty,
      unit: qtyUnit,
      rolls: fabricRolls(material, workOrderNo, plannedQty, qtyUnit),
      label: `${source.designRevisionTaskNo} / ${workOrderNo} / ${material.sku}`,
      taskNo,
      ...(input.processType === 'DYEING' ? { dyeOrderId: input.processOrderId } : { printingOrderId: input.processOrderId }),
    }],
  }
  registerFactoryReceivingSource(transfer)
  return getFactoryReceivingSource(transferId)!
}
