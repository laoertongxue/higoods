import {
  getFactoryReceivingSource,
  getProcessOrderReceivingFacts,
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

export interface DesignRevisionMaterialTransferPlan {
  planId: string
  processType: DesignRevisionMaterialTransferProcessType
  processOrderId: string
  sourceTaskId: string
  bomItemId: string
  originName: string
  targetName: string
  plannedQty: number
  qtyUnit: string
  stage: 'WAREHOUSE_TO_FACTORY' | 'DYE_FACTORY_TO_PRINT_FACTORY'
  sentQty: number
  status: 'WAIT_ASSIGNMENT' | 'WAIT_UPSTREAM' | 'WAIT_WAREHOUSE_DISPATCH' | 'DISPATCHED'
}

/** 加工单一经创建，稳定 ID 的调拨计划便随单存在；双工艺第二段绝不生成仓库调拨。 */
export function getDesignRevisionMaterialTransferPlan(
  processType: DesignRevisionMaterialTransferProcessType,
  processOrderId: string,
): DesignRevisionMaterialTransferPlan | null {
  const dye = processType === 'DYEING' ? getDyeWorkOrderById(processOrderId) : undefined
  const print = processType === 'PRINTING' ? getPrintWorkOrderById(processOrderId) : undefined
  const order = dye || print
  if (!order || order.sourceSnapshot?.sourceType !== 'DESIGN_REVISION') return null
  const source = order.sourceSnapshot
  const upstream = processType === 'PRINTING' && Boolean(source.upstreamWorkOrderId)
  const upstreamDyeOrder = upstream ? getDyeWorkOrderById(source.upstreamWorkOrderId || '') : undefined
  const receiving = getFactoryReceivingSource(getDesignRevisionProcessMaterialTransferId(processType, processOrderId))
  const upstreamHandouts = upstream
    ? getProcessOrderReceivingFacts(processOrderId, 'print').sources.filter((item) => item.type === 'HANDOUT' && item.origin.kind === 'FACTORY')
    : []
  const upstreamSentQty = upstreamHandouts.reduce((sum, item) => sum + item.lines
    .filter((line) => line.printingOrderId === processOrderId)
    .reduce((lineSum, line) => lineSum + line.sentQty, 0), 0)
  return {
    planId: getDesignRevisionProcessMaterialTransferId(processType, processOrderId),
    processType, processOrderId, sourceTaskId: source.designRevisionTaskId || '', bomItemId: source.bomItemId || '',
    originName: upstream ? upstreamDyeOrder?.dyeFactoryId ? upstreamDyeOrder.dyeFactoryName : '待分配染色厂' : source.materialReceivingKind === 'ACCESSORY' ? '辅料中央仓' : source.materialReceivingKind === 'YARN' ? '纱线中央仓' : '面料中央仓',
    targetName: processType === 'DYEING' ? dye?.dyeFactoryId ? dye.dyeFactoryName : '待分配染色厂' : print?.printFactoryId ? print.printFactoryName : '待分配印花厂',
    plannedQty: order.plannedQty, qtyUnit: order.qtyUnit,
    stage: upstream ? 'DYE_FACTORY_TO_PRINT_FACTORY' : 'WAREHOUSE_TO_FACTORY',
    sentQty: upstream ? upstreamSentQty : receiving?.lines[0]?.sentQty || 0,
    status: upstream ? upstreamSentQty > 0 ? 'DISPATCHED' : 'WAIT_UPSTREAM' : receiving?.lines[0]?.sentQty ? 'DISPATCHED' : dye?.dyeFactoryId || print?.printFactoryId ? 'WAIT_WAREHOUSE_DISPATCH' : 'WAIT_ASSIGNMENT',
  }
}

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
  if (!factoryId) return { ...base, status: 'WAIT_ASSIGNMENT', message: '等待 PPIC 分配加工厂。' }
  return { ...base, status: 'READY', message: '仓库调拨计划已建立，等待仓库确认实发。' }
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

/**
 * 工厂分配时把已由加工单派生的首道计划落实为收货原单；实发量仍为零。
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
      sentQty: 0,
      unit: qtyUnit,
      rolls: [],
      label: `${source.designRevisionTaskNo} / ${workOrderNo} / ${material.sku}`,
      taskNo,
      ...(input.processType === 'DYEING' ? { dyeOrderId: input.processOrderId } : { printingOrderId: input.processOrderId }),
    }],
  }
  registerFactoryReceivingSource(transfer)
  return getFactoryReceivingSource(transferId)!
}

/** 仓库实际发料与计划量分别记录，面料须提供实卷码。 */
export function confirmDesignRevisionWarehouseDispatch(input: {
  processType: DesignRevisionMaterialTransferProcessType
  processOrderId: string
  sentQty: number
  rolls: Array<{ barcode: string; yard: number }>
  operatorName: string
  dispatchedAt: string
}): FactoryReceivingSource {
  const plan = getDesignRevisionMaterialTransferPlan(input.processType, input.processOrderId)
  if (!plan || plan.stage !== 'WAREHOUSE_TO_FACTORY') throw new Error('该加工单没有仓库首道发料计划。')
  if (!input.operatorName.trim() || !input.dispatchedAt.trim()) throw new Error('仓库发料人和时间不能为空。')
  if (!Number.isFinite(input.sentQty) || input.sentQty <= 0 || input.sentQty > plan.plannedQty) throw new Error('实际发料量必须大于零且不得超过 BOM 计划量。')
  const source = getFactoryReceivingSource(plan.planId)
  if (!source) throw new Error('请先分配加工厂，系统才能落实仓库调拨计划。')
  const line = source.lines[0]
  if (!line || line.sentQty > 0) throw new Error('本单已确认实发，不能重复发料。')
  if (line.material.kind === 'FABRIC' && (!input.rolls.length || input.rolls.some((roll) => !roll.barcode.trim() || roll.yard <= 0))) throw new Error('面料实发必须填写原卷码及每卷 Yard。')
  if (line.material.kind === 'FABRIC') {
    const actualYard = input.rolls.reduce((sum, roll) => sum + roll.yard, 0)
    const expectedYard = ['米', 'm', 'M'].includes(line.unit) ? input.sentQty / 0.9144 : input.sentQty
    if (Math.abs(actualYard - expectedYard) > 0.0001) throw new Error('原卷 Yard 合计必须与实发数量一致。')
  }
  const next = { ...source, lines: [{ ...line, sentQty: input.sentQty, rolls: input.rolls.map((roll) => ({ ...roll })) }] }
  registerFactoryReceivingSource(next)
  return getFactoryReceivingSource(plan.planId)!
}
