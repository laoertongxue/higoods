import { listProcessWorkOrders, type ProcessWorkOrder } from './process-work-order-domain.ts'
import {
  getSpecialCraftTaskWorkOrdersByTaskOrderId,
  listSpecialCraftTaskOrders,
  type SpecialCraftTaskOrder,
} from './special-craft-task-orders.ts'
import { applySpecialCraftHandoverDifferenceToFeiTickets } from './cutting/special-craft-fei-ticket-flow.ts'
import { listPostFinishingWorkOrders, type PostFinishingWorkOrder } from './post-finishing-domain.ts'

export type ProcessWarehouseCraftType = 'PRINT' | 'DYE' | 'SPECIAL_CRAFT' | 'POST_FINISHING'
export type ProcessWarehouseRecordType = 'WAIT_PROCESS' | 'WAIT_HANDOVER'
export type ProcessWarehouseObjectType = '面料' | '裁片' | '成衣'
export type ProcessWarehouseHandoverStatus = '待回写' | '已回写' | '有差异' | '平台处理中' | '需重新交出' | '已关闭'
export type ProcessWarehouseDifferenceStatus = '待处理' | '处理中' | '已确认差异' | '需重新交出' | '已关闭'
export type ProcessWarehouseReviewStatus = '待审核' | '审核通过' | '审核驳回' | '数量差异' | '已关闭'
export type ProcessWarehouseDifferenceType = '少收' | '多收' | '破损' | '报废' | '货损' | '错交' | '其他'
export type ProcessWarehouseResponsibilitySide = '待判定' | '交出工厂' | '接收方' | '仓库' | '平台' | '非工厂责任'
export type ProcessWarehouseDifferenceNextAction = '确认差异继续流转' | '要求重新交出' | '关闭记录' | '平台处理'

export interface ProcessWarehouseRecord {
  warehouseRecordId: string
  warehouseRecordNo: string
  recordType: ProcessWarehouseRecordType
  craftType: ProcessWarehouseCraftType
  craftName: string
  sourceWorkOrderId: string
  sourceWorkOrderNo: string
  sourceTaskId: string
  sourceTaskNo: string
  sourceProductionOrderId: string
  sourceProductionOrderNo: string
  sourceDemandId: string
  sourceDemandNo: string
  sourceFactoryId: string
  sourceFactoryName: string
  targetFactoryId: string
  targetFactoryName: string
  targetWarehouseName: string
  warehouseLocation: string
  skuSummary: string
  styleNo: string
  materialSku: string
  materialName: string
  batchNo: string
  objectType: ProcessWarehouseObjectType
  plannedObjectQty: number
  receivedObjectQty: number
  availableObjectQty: number
  handedOverObjectQty: number
  writtenBackObjectQty: number
  diffObjectQty: number
  qtyUnit: string
  currentActionName: string
  status: string
  inboundAt: string
  outboundAt: string
  createdAt: string
  updatedAt: string
  relatedFeiTicketIds: string[]
  relatedHandoverRecordIds: string[]
  relatedReviewRecordIds: string[]
  remark: string
}

export interface ProcessHandoverRecord {
  handoverRecordId: string
  handoverRecordNo: string
  warehouseRecordId: string
  craftType: ProcessWarehouseCraftType
  craftName: string
  sourceWorkOrderId: string
  sourceWorkOrderNo: string
  sourceTaskId: string
  sourceTaskNo: string
  sourceProductionOrderId: string
  sourceProductionOrderNo: string
  handoverFactoryId: string
  handoverFactoryName: string
  receiveFactoryId: string
  receiveFactoryName: string
  receiveWarehouseName: string
  objectType: ProcessWarehouseObjectType
  handoverObjectQty: number
  receiveObjectQty: number
  diffObjectQty: number
  qtyUnit: string
  packageQty: number
  packageUnit: string
  handoverPerson: string
  handoverAt: string
  receivePerson: string
  receiveAt: string
  status: ProcessWarehouseHandoverStatus
  evidenceUrls: string[]
  relatedReviewRecordId: string
  relatedDifferenceRecordId: string
  relatedFeiTicketIds: string[]
  remark: string
}

export interface ProcessHandoverDifferenceRecord {
  differenceRecordId: string
  differenceRecordNo: string
  handoverRecordId: string
  warehouseRecordId: string
  sourceWorkOrderId: string
  sourceWorkOrderNo: string
  sourceProductionOrderId: string
  sourceProductionOrderNo: string
  craftType: ProcessWarehouseCraftType
  craftName: string
  objectType: ProcessWarehouseObjectType
  expectedObjectQty: number
  actualObjectQty: number
  diffObjectQty: number
  qtyUnit: string
  differenceType: ProcessWarehouseDifferenceType
  responsibilitySide: ProcessWarehouseResponsibilitySide
  status: ProcessWarehouseDifferenceStatus
  reportedBy: string
  reportedAt: string
  handledBy: string
  handledAt: string
  evidenceUrls: string[]
  handlingResult: string
  nextAction: ProcessWarehouseDifferenceNextAction
  relatedFeiTicketIds: string[]
  remark: string
}

export interface ProcessWarehouseReviewRecord {
  reviewRecordId: string
  reviewRecordNo: string
  handoverRecordId: string
  warehouseRecordId: string
  sourceWorkOrderId: string
  sourceWorkOrderNo: string
  craftType: ProcessWarehouseCraftType
  craftName: string
  reviewStatus: ProcessWarehouseReviewStatus
  expectedObjectQty: number
  actualObjectQty: number
  diffObjectQty: number
  qtyUnit: string
  reviewerName: string
  reviewedAt: string
  reason: string
  evidenceUrls: string[]
  nextAction: '进入下一环节' | '退回重交' | '平台处理差异' | '关闭'
  relatedDifferenceRecordId: string
  remark: string
}

export interface ProcessWarehouseRecordFilter {
  recordType?: ProcessWarehouseRecordType
  craftType?: ProcessWarehouseCraftType
  craftName?: string
  sourceWorkOrderId?: string
  sourceTaskId?: string
  targetFactoryId?: string
  status?: string
}

export interface ProcessHandoverRecordFilter {
  craftType?: ProcessWarehouseCraftType
  craftName?: string
  sourceWorkOrderId?: string
  warehouseRecordId?: string
  status?: ProcessWarehouseHandoverStatus
}

export interface ProcessWarehouseReviewRecordFilter {
  craftType?: ProcessWarehouseCraftType
  craftName?: string
  sourceWorkOrderId?: string
  handoverRecordId?: string
  reviewStatus?: ProcessWarehouseReviewStatus
}

export interface ProcessHandoverDifferenceRecordFilter {
  craftType?: ProcessWarehouseCraftType
  craftName?: string
  sourceWorkOrderId?: string
  handoverRecordId?: string
  warehouseRecordId?: string
  status?: ProcessWarehouseDifferenceStatus
}

type WarehouseRecordPayload = Partial<ProcessWarehouseRecord> & {
  craftType: ProcessWarehouseCraftType
  craftName: string
  sourceWorkOrderId: string
  sourceWorkOrderNo: string
  sourceTaskId?: string
  sourceTaskNo?: string
  sourceProductionOrderId?: string
  sourceProductionOrderNo?: string
  sourceFactoryId?: string
  sourceFactoryName?: string
  targetFactoryId?: string
  targetFactoryName?: string
  targetWarehouseName?: string
  objectType: ProcessWarehouseObjectType
  qtyUnit: string
  currentActionName: string
}

type ProcessHandoverRecordPayload = Partial<ProcessHandoverRecord> & {
  warehouseRecordId?: string
  craftType: ProcessWarehouseCraftType
  craftName: string
  sourceWorkOrderId: string
  sourceWorkOrderNo: string
  sourceTaskId?: string
  sourceTaskNo?: string
  sourceProductionOrderId?: string
  sourceProductionOrderNo?: string
  handoverFactoryId?: string
  handoverFactoryName?: string
  receiveFactoryId?: string
  receiveFactoryName?: string
  receiveWarehouseName?: string
  objectType: ProcessWarehouseObjectType
  handoverObjectQty: number
  qtyUnit: string
}

type ReviewRecordPayload = Partial<ProcessWarehouseReviewRecord> & {
  handoverRecordId: string
  sourceWorkOrderId: string
  sourceWorkOrderNo: string
  craftType: ProcessWarehouseCraftType
  craftName: string
  expectedObjectQty: number
  actualObjectQty: number
  qtyUnit: string
}

type DifferenceRecordPayload = Partial<ProcessHandoverDifferenceRecord> & {
  handoverRecordId: string
  warehouseRecordId: string
  sourceWorkOrderId: string
  sourceWorkOrderNo: string
  sourceProductionOrderId?: string
  sourceProductionOrderNo?: string
  craftType: ProcessWarehouseCraftType
  craftName: string
  objectType: ProcessWarehouseObjectType
  expectedObjectQty: number
  actualObjectQty: number
  qtyUnit: string
}

function cloneWarehouseRecord(record: ProcessWarehouseRecord): ProcessWarehouseRecord {
  return {
    ...record,
    relatedFeiTicketIds: [...record.relatedFeiTicketIds],
    relatedHandoverRecordIds: [...record.relatedHandoverRecordIds],
    relatedReviewRecordIds: [...record.relatedReviewRecordIds],
  }
}

function cloneHandoverRecord(record: ProcessHandoverRecord): ProcessHandoverRecord {
  return { ...record, evidenceUrls: [...record.evidenceUrls], relatedFeiTicketIds: [...record.relatedFeiTicketIds] }
}

function cloneDifferenceRecord(record: ProcessHandoverDifferenceRecord): ProcessHandoverDifferenceRecord {
  return { ...record, evidenceUrls: [...record.evidenceUrls], relatedFeiTicketIds: [...record.relatedFeiTicketIds] }
}

function cloneReviewRecord(record: ProcessWarehouseReviewRecord): ProcessWarehouseReviewRecord {
  return { ...record, evidenceUrls: [...record.evidenceUrls] }
}

function nowText(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function roundQty(value: number | undefined): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function createRecordNo(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(4, '0')}`
}

function normalizeStatus(recordType: ProcessWarehouseRecordType, status?: string): string {
  if (status) return status
  return recordType === 'WAIT_PROCESS' ? '已入仓' : '待交出'
}

function buildWarehouseRecord(
  payload: WarehouseRecordPayload,
  recordType: ProcessWarehouseRecordType,
  index: number,
): ProcessWarehouseRecord {
  const createdAt = payload.createdAt || nowText()
  const recordNoPrefix = recordType === 'WAIT_PROCESS' ? 'GC-RK' : 'GC-CK'
  return {
    warehouseRecordId: payload.warehouseRecordId || `PWH-${recordType}-${payload.craftType}-${index}`,
    warehouseRecordNo: payload.warehouseRecordNo || createRecordNo(recordNoPrefix, index),
    recordType,
    craftType: payload.craftType,
    craftName: payload.craftName,
    sourceWorkOrderId: payload.sourceWorkOrderId,
    sourceWorkOrderNo: payload.sourceWorkOrderNo,
    sourceTaskId: payload.sourceTaskId || '',
    sourceTaskNo: payload.sourceTaskNo || '',
    sourceProductionOrderId: payload.sourceProductionOrderId || '',
    sourceProductionOrderNo: payload.sourceProductionOrderNo || '',
    sourceDemandId: payload.sourceDemandId || '',
    sourceDemandNo: payload.sourceDemandNo || payload.sourceDemandId || '',
    sourceFactoryId: payload.sourceFactoryId || payload.targetFactoryId || '',
    sourceFactoryName: payload.sourceFactoryName || payload.targetFactoryName || '',
    targetFactoryId: payload.targetFactoryId || payload.sourceFactoryId || '',
    targetFactoryName: payload.targetFactoryName || payload.sourceFactoryName || '',
    targetWarehouseName: payload.targetWarehouseName || (recordType === 'WAIT_PROCESS' ? '待加工仓' : '待交出仓'),
    warehouseLocation: payload.warehouseLocation || `${payload.craftName}-A-${(index % 9) + 1}`,
    skuSummary: payload.skuSummary || payload.materialSku || payload.sourceWorkOrderNo,
    styleNo: payload.styleNo || '',
    materialSku: payload.materialSku || '',
    materialName: payload.materialName || payload.materialSku || '',
    batchNo: payload.batchNo || '',
    objectType: payload.objectType,
    plannedObjectQty: roundQty(payload.plannedObjectQty),
    receivedObjectQty: roundQty(payload.receivedObjectQty ?? payload.plannedObjectQty),
    availableObjectQty: roundQty(payload.availableObjectQty ?? payload.receivedObjectQty ?? payload.plannedObjectQty),
    handedOverObjectQty: roundQty(payload.handedOverObjectQty),
    writtenBackObjectQty: roundQty(payload.writtenBackObjectQty),
    diffObjectQty: roundQty(payload.diffObjectQty),
    qtyUnit: payload.qtyUnit,
    currentActionName: payload.currentActionName,
    status: normalizeStatus(recordType, payload.status),
    inboundAt: payload.inboundAt || createdAt,
    outboundAt: payload.outboundAt || '',
    createdAt,
    updatedAt: payload.updatedAt || createdAt,
    relatedFeiTicketIds: [...(payload.relatedFeiTicketIds || [])],
    relatedHandoverRecordIds: [...(payload.relatedHandoverRecordIds || [])],
    relatedReviewRecordIds: [...(payload.relatedReviewRecordIds || [])],
    remark: payload.remark || '',
  }
}

function getObjectQtyLabel(objectType: ProcessWarehouseObjectType): string {
  if (objectType === '面料') return '面料米数'
  if (objectType === '裁片') return '裁片数量'
  return '成衣件数'
}

export function formatProcessObjectQty(qty: number | undefined, unit: string): string {
  return `${roundQty(qty)} ${unit}`
}

export function getProcessWarehouseQtyLabel(prefix: string, objectType: ProcessWarehouseObjectType): string {
  return `${prefix}${getObjectQtyLabel(objectType)}`
}

function printWaitAction(order: ProcessWorkOrder): string {
  if (order.statusLabel.includes('转印') || order.statusLabel.includes('打印完成')) return '待转印'
  return '待打印'
}

function dyeWaitAction(order: ProcessWorkOrder): string {
  if (order.statusLabel.includes('排缸')) return '待排缸'
  if (order.statusLabel.includes('染色')) return '待染色'
  if (order.statusLabel.includes('备料') || order.statusLabel.includes('原料')) return '待备料'
  return '待打样'
}

function isPrintWaitProcess(order: ProcessWorkOrder): boolean {
  return ['WAIT_PRINT', 'PRINTING', 'PRINT_DONE', 'WAIT_TRANSFER', 'TRANSFERRING'].includes(String(order.status))
}

function isPrintWaitHandover(order: ProcessWorkOrder): boolean {
  return ['WAIT_HANDOVER', 'HANDOVER_SUBMITTED', 'WAIT_REVIEW', 'COMPLETED', 'REJECTED'].includes(String(order.status))
}

function isDyeWaitProcess(order: ProcessWorkOrder): boolean {
  return [
    'WAIT_SAMPLE',
    'SAMPLE_TESTING',
    'SAMPLE_DONE',
    'WAIT_MATERIAL',
    'MATERIAL_READY',
    'WAIT_VAT_PLAN',
    'VAT_PLANNED',
    'DYEING',
    'DEHYDRATING',
    'DRYING',
    'SETTING',
    'ROLLING',
    'PACKING',
  ].includes(String(order.status))
}

function isDyeWaitHandover(order: ProcessWorkOrder): boolean {
  return ['WAIT_HANDOVER', 'HANDOVER_SUBMITTED', 'WAIT_REVIEW', 'COMPLETED', 'REJECTED'].includes(String(order.status))
}

function buildProcessWorkOrderWarehouseRecords(orders: ProcessWorkOrder[]): ProcessWarehouseRecord[] {
  const records: ProcessWarehouseRecord[] = []
  orders.forEach((order, index) => {
    const isPrint = order.processType === 'PRINT'
    const waitProcess = isPrint ? isPrintWaitProcess(order) : isDyeWaitProcess(order)
    const waitHandover = isPrint ? isPrintWaitHandover(order) : isDyeWaitHandover(order)
    const craftType: ProcessWarehouseCraftType = isPrint ? 'PRINT' : 'DYE'
    const craftName = isPrint ? '印花' : '染色'
    const qtyUnit = order.plannedUnit === '片' ? '米' : order.plannedUnit
    const targetWarehouseName = isPrint
      ? order.printPayload?.targetTransferWarehouseName || '印花待交出仓'
      : order.dyePayload?.targetTransferWarehouseName || '染色待交出仓'

    if (waitProcess) {
      records.push(
        buildWarehouseRecord(
          {
            craftType,
            craftName,
            sourceWorkOrderId: order.workOrderId,
            sourceWorkOrderNo: order.workOrderNo,
            sourceTaskId: order.taskId,
            sourceTaskNo: order.taskNo,
            sourceProductionOrderId: order.productionOrderIds[0] || '',
            sourceProductionOrderNo: order.productionOrderIds[0] || '',
            sourceDemandId: order.sourceDemandIds[0] || '',
            sourceDemandNo: order.sourceDemandIds[0] || '',
            sourceFactoryId: order.factoryId,
            sourceFactoryName: order.factoryName,
            targetFactoryId: order.factoryId,
            targetFactoryName: order.factoryName,
            targetWarehouseName: `${craftName}待加工仓`,
            skuSummary: order.materialName,
            materialSku: order.materialSku,
            materialName: order.materialName,
            batchNo: order.materialBatchNos[0] || '',
            objectType: '面料',
            plannedObjectQty: order.plannedQty,
            receivedObjectQty: order.plannedQty,
            availableObjectQty: order.plannedQty,
            qtyUnit,
            currentActionName: isPrint ? printWaitAction(order) : dyeWaitAction(order),
            status: order.statusLabel.includes('中') ? '加工中' : '已入仓',
            inboundAt: order.createdAt,
            updatedAt: order.updatedAt,
            remark: `${craftName}加工单进入统一待加工仓`,
          },
          'WAIT_PROCESS',
          records.length + 1,
        ),
      )
    }

    if (waitHandover) {
      const handedOverQty = order.handoverRecords.reduce((sum, record) => sum + (record.submittedQty || 0), 0)
      const writtenBackQty = order.handoverRecords.reduce((sum, record) => sum + (record.receiverWrittenQty || 0), 0)
      records.push(
        buildWarehouseRecord(
          {
            craftType,
            craftName,
            sourceWorkOrderId: order.workOrderId,
            sourceWorkOrderNo: order.workOrderNo,
            sourceTaskId: order.taskId,
            sourceTaskNo: order.taskNo,
            sourceProductionOrderId: order.productionOrderIds[0] || '',
            sourceProductionOrderNo: order.productionOrderIds[0] || '',
            sourceDemandId: order.sourceDemandIds[0] || '',
            sourceDemandNo: order.sourceDemandIds[0] || '',
            sourceFactoryId: order.factoryId,
            sourceFactoryName: order.factoryName,
            targetFactoryId: order.factoryId,
            targetFactoryName: order.factoryName,
            targetWarehouseName,
            skuSummary: order.materialName,
            materialSku: order.materialSku,
            materialName: order.materialName,
            batchNo: order.materialBatchNos[0] || '',
            objectType: '面料',
            plannedObjectQty: order.plannedQty,
            receivedObjectQty: order.plannedQty,
            availableObjectQty: order.plannedQty,
            handedOverObjectQty: handedOverQty,
            writtenBackObjectQty: writtenBackQty,
            diffObjectQty: Math.max(handedOverQty - writtenBackQty, 0),
            qtyUnit,
            currentActionName: `${craftName}待交出`,
            status: order.statusLabel.includes('差异') || handedOverQty > writtenBackQty ? '有差异' : order.statusLabel.includes('回写') || writtenBackQty > 0 ? '已回写' : '待交出',
            inboundAt: order.updatedAt,
            updatedAt: order.updatedAt,
            remark: `${craftName}加工完成进入统一待交出仓`,
          },
          'WAIT_HANDOVER',
          records.length + 1,
        ),
      )
    }
  })
  return records
}

function buildSpecialCraftWarehouseRecords(taskOrders: SpecialCraftTaskOrder[]): ProcessWarehouseRecord[] {
  const records: ProcessWarehouseRecord[] = []
  taskOrders.forEach((taskOrder) => {
    const workOrder = getSpecialCraftTaskWorkOrdersByTaskOrderId(taskOrder.taskOrderId)[0]
    const sourceWorkOrderId = workOrder?.workOrderId || taskOrder.taskOrderId
    const sourceWorkOrderNo = workOrder?.workOrderNo || taskOrder.taskOrderNo
    const common: Omit<WarehouseRecordPayload, 'currentActionName' | 'recordType'> = {
      craftType: 'SPECIAL_CRAFT',
      craftName: taskOrder.operationName,
      sourceWorkOrderId,
      sourceWorkOrderNo,
      sourceTaskId: taskOrder.taskOrderId,
      sourceTaskNo: taskOrder.taskOrderNo,
      sourceProductionOrderId: taskOrder.productionOrderId,
      sourceProductionOrderNo: taskOrder.productionOrderNo,
      sourceDemandId: taskOrder.sourceTaskId || taskOrder.taskOrderId,
      sourceDemandNo: taskOrder.sourceTaskNo || taskOrder.taskOrderNo,
      sourceFactoryId: taskOrder.factoryId,
      sourceFactoryName: taskOrder.factoryName,
      targetFactoryId: taskOrder.factoryId,
      targetFactoryName: taskOrder.factoryName,
      skuSummary: [taskOrder.partName, taskOrder.fabricColor, taskOrder.sizeCode].filter(Boolean).join(' / ') || taskOrder.operationName,
      styleNo: taskOrder.productionOrderNo,
      materialSku: taskOrder.materialSku || '',
      materialName: taskOrder.partName || taskOrder.operationName,
      batchNo: taskOrder.transferBagNos[0] || '',
      objectType: '裁片',
      plannedObjectQty: taskOrder.planQty,
      receivedObjectQty: taskOrder.receivedQty,
      availableObjectQty: taskOrder.currentQty || taskOrder.completedQty || taskOrder.receivedQty || taskOrder.planQty,
      qtyUnit: taskOrder.unit || '片',
      relatedFeiTicketIds: taskOrder.feiTicketNos,
      inboundAt: taskOrder.createdAt,
      updatedAt: taskOrder.updatedAt || taskOrder.createdAt,
    }
    if (taskOrder.status === '待领料' || taskOrder.status === '已入待加工仓' || taskOrder.status === '加工中') {
      records.push(
        buildWarehouseRecord(
          {
            ...common,
            targetWarehouseName: `${taskOrder.operationName}待加工仓`,
            currentActionName: `待${taskOrder.operationName}`,
            status: taskOrder.status === '加工中' ? '加工中' : '已入仓',
            remark: '特殊工艺单进入统一待加工仓',
          },
          'WAIT_PROCESS',
          records.length + 1,
        ),
      )
    }
    if (taskOrder.waitHandoverQty > 0 || ['待交出', '已交出', '已回写', '差异', '异议中'].includes(taskOrder.status)) {
      records.push(
        buildWarehouseRecord(
          {
            ...common,
            targetWarehouseName: `${taskOrder.operationName}待交出仓`,
            availableObjectQty: taskOrder.waitHandoverQty || taskOrder.completedQty,
            handedOverObjectQty: taskOrder.status === '已交出' || taskOrder.status === '已回写' ? taskOrder.waitHandoverQty : 0,
            writtenBackObjectQty: taskOrder.status === '已回写' ? taskOrder.returnedQty || taskOrder.waitHandoverQty : 0,
            diffObjectQty: Math.max((taskOrder.waitHandoverQty || 0) - (taskOrder.returnedQty || 0), 0),
            currentActionName: '特殊工艺待交出',
            status: taskOrder.status === '已回写' ? '已回写' : taskOrder.status === '已交出' ? '已全部交出' : '待交出',
            remark: '特殊工艺完成后进入统一待交出仓',
          },
          'WAIT_HANDOVER',
          records.length + 1,
        ),
      )
    }
  })
  return records
}

function postWaitAction(order: PostFinishingWorkOrder): '待接收领料' | '待质检' | '待后道' | '待复检' {
  if (order.currentStatus.includes('接收')) return '待接收领料'
  if (order.currentStatus.includes('复检')) return '待复检'
  if (order.currentStatus.includes('质检')) return '待质检'
  if (!order.isPostDoneBySewingFactory && order.currentStatus.includes('后道')) return '待后道'
  if (order.currentStatus === '待交出' || order.currentStatus.includes('已')) return '待复检'
  return '待接收领料'
}

function buildPostFinishingWarehouseRecords(orders: PostFinishingWorkOrder[]): ProcessWarehouseRecord[] {
  const records: ProcessWarehouseRecord[] = []
  orders.forEach((order) => {
    const actionName = postWaitAction(order)
    records.push(
      buildWarehouseRecord(
        {
          warehouseRecordId: order.waitProcessWarehouseRecordId,
          craftType: 'POST_FINISHING',
          craftName: '后道',
          sourceWorkOrderId: order.postOrderId,
          sourceWorkOrderNo: order.postOrderNo,
          sourceTaskId: order.sourceTaskId,
          sourceTaskNo: order.sourceSewingTaskNo,
          sourceProductionOrderId: order.sourceProductionOrderId,
          sourceProductionOrderNo: order.sourceProductionOrderNo,
          sourceDemandId: order.sourceTaskId,
          sourceDemandNo: order.sourceTaskNo,
          sourceFactoryId: order.sourceSewingFactoryId,
          sourceFactoryName: order.sourceSewingFactoryName,
          targetFactoryId: order.managedPostFactoryId,
          targetFactoryName: order.managedPostFactoryName,
          targetWarehouseName: '后道待加工仓',
          skuSummary: order.skuSummary,
          styleNo: order.styleNo,
          objectType: '成衣',
          plannedObjectQty: order.plannedGarmentQty,
          receivedObjectQty: order.plannedGarmentQty,
          availableObjectQty: order.plannedGarmentQty,
          qtyUnit: order.plannedGarmentQtyUnit,
          currentActionName: actionName,
          status: order.currentStatus,
          inboundAt: order.createdAt,
          updatedAt: order.updatedAt,
          remark: order.isPostDoneBySewingFactory
            ? '车缝厂已完成该环节，接收领料后只做质检和复检'
            : '完整流程进入待加工仓：接收领料、质检、后道、复检',
        },
        'WAIT_PROCESS',
        records.length + 1,
      ),
    )
    if (order.waitHandoverWarehouseRecordId && order.recheckAction) {
      records.push(
        buildWarehouseRecord(
          {
            warehouseRecordId: order.waitHandoverWarehouseRecordId,
            craftType: 'POST_FINISHING',
            craftName: '后道',
            sourceWorkOrderId: order.postOrderId,
            sourceWorkOrderNo: order.postOrderNo,
            sourceTaskId: order.sourceTaskId,
            sourceTaskNo: order.sourceSewingTaskNo,
            sourceProductionOrderId: order.sourceProductionOrderId,
            sourceProductionOrderNo: order.sourceProductionOrderNo,
            sourceDemandId: order.sourceTaskId,
            sourceDemandNo: order.sourceTaskNo,
            sourceFactoryId: order.managedPostFactoryId,
            sourceFactoryName: order.managedPostFactoryName,
            targetFactoryId: order.managedPostFactoryId,
            targetFactoryName: order.managedPostFactoryName,
            targetWarehouseName: '后道交出仓',
            skuSummary: order.skuSummary,
            styleNo: order.styleNo,
            objectType: '成衣',
            plannedObjectQty: order.plannedGarmentQty,
            receivedObjectQty: order.recheckAction.acceptedGarmentQty,
            availableObjectQty: order.recheckAction.acceptedGarmentQty,
            handedOverObjectQty: order.handoverRecordId ? order.recheckAction.acceptedGarmentQty : 0,
            writtenBackObjectQty: order.currentStatus === '已回写' ? order.recheckAction.acceptedGarmentQty - order.recheckAction.diffGarmentQty : 0,
            diffObjectQty: order.recheckAction.diffGarmentQty,
            qtyUnit: order.plannedGarmentQtyUnit,
            currentActionName: '后道待交出',
            status: order.currentStatus === '复检完成' ? '待交出' : order.currentStatus,
            inboundAt: order.updatedAt,
            updatedAt: order.updatedAt,
            remark: '复检完成后生成后道交出仓记录',
          },
          'WAIT_HANDOVER',
          records.length + 1,
        ),
      )
    }
  })
  return records
}

function buildInitialWarehouseRecords(): ProcessWarehouseRecord[] {
  return [
    ...buildProcessWorkOrderWarehouseRecords(listProcessWorkOrders()),
    ...buildSpecialCraftWarehouseRecords(listSpecialCraftTaskOrders()),
    ...buildPostFinishingWarehouseRecords(listPostFinishingWorkOrders()),
  ].map((record, index) => ({
    ...record,
    warehouseRecordNo: record.warehouseRecordNo || createRecordNo(record.recordType === 'WAIT_PROCESS' ? 'GC-RK' : 'GC-CK', index + 1),
  }))
}

function buildInitialHandoverRecords(warehouseRecords: ProcessWarehouseRecord[]): ProcessHandoverRecord[] {
  const records: ProcessHandoverRecord[] = []
  const workOrderHandoverRows = listProcessWorkOrders().flatMap((order) =>
    order.handoverRecords.map((record) => ({ order, record })),
  )
  workOrderHandoverRows.forEach(({ order, record }) => {
    const warehouseRecord = warehouseRecords.find((item) =>
      item.recordType === 'WAIT_HANDOVER' && item.sourceWorkOrderId === order.workOrderId,
    )
    if (!warehouseRecord) return
    records.push({
      handoverRecordId: record.handoverRecordId,
      handoverRecordNo: record.handoverRecordNo || record.handoverRecordId,
      warehouseRecordId: warehouseRecord.warehouseRecordId,
      craftType: warehouseRecord.craftType,
      craftName: warehouseRecord.craftName,
      sourceWorkOrderId: order.workOrderId,
      sourceWorkOrderNo: order.workOrderNo,
      sourceTaskId: order.taskId,
      sourceTaskNo: order.taskNo,
      sourceProductionOrderId: order.productionOrderIds[0] || '',
      sourceProductionOrderNo: order.productionOrderIds[0] || '',
      handoverFactoryId: order.factoryId,
      handoverFactoryName: order.factoryName,
      receiveFactoryId: warehouseRecord.targetFactoryId,
      receiveFactoryName: warehouseRecord.targetFactoryName,
      receiveWarehouseName: warehouseRecord.targetWarehouseName,
      objectType: '面料',
      handoverObjectQty: roundQty(record.submittedQty),
      receiveObjectQty: roundQty(record.receiverWrittenQty),
      diffObjectQty: record.receiverWrittenAt ? roundQty((record.receiverWrittenQty || 0) - (record.submittedQty || 0)) : 0,
      qtyUnit: record.qtyUnit || order.plannedUnit,
      packageQty: record.expectedTransferBagCount || record.expectedFeiTicketCount || 1,
      packageUnit: '卷',
      handoverPerson: record.factorySubmittedBy || '工厂操作员',
      handoverAt: record.factorySubmittedAt || order.updatedAt,
      receivePerson: record.receiverWrittenBy || '',
      receiveAt: record.receiverWrittenAt || '',
      status: record.receiverWrittenAt
        ? Math.abs((record.submittedQty || 0) - (record.receiverWrittenQty || 0)) > 0
          ? '有差异'
          : '已回写'
        : '待回写',
      evidenceUrls: [],
      relatedReviewRecordId: '',
      relatedDifferenceRecordId: '',
      relatedFeiTicketIds: [...warehouseRecord.relatedFeiTicketIds],
      remark: record.factoryRemark || record.diffReason || '',
    })
  })

  warehouseRecords
    .filter((record) => record.recordType === 'WAIT_HANDOVER' && record.craftType !== 'PRINT' && record.craftType !== 'DYE')
    .forEach((record) => {
      const handoverQty = record.handedOverObjectQty || record.availableObjectQty
      const writtenQty = record.writtenBackObjectQty || (record.status === '已回写' ? handoverQty : 0)
      records.push({
        handoverRecordId: `PHR-${record.warehouseRecordId}`,
        handoverRecordNo: `JH-${record.warehouseRecordNo}`,
        warehouseRecordId: record.warehouseRecordId,
        craftType: record.craftType,
        craftName: record.craftName,
        sourceWorkOrderId: record.sourceWorkOrderId,
        sourceWorkOrderNo: record.sourceWorkOrderNo,
        sourceTaskId: record.sourceTaskId,
        sourceTaskNo: record.sourceTaskNo,
        sourceProductionOrderId: record.sourceProductionOrderId,
        sourceProductionOrderNo: record.sourceProductionOrderNo,
        handoverFactoryId: record.sourceFactoryId,
        handoverFactoryName: record.sourceFactoryName,
        receiveFactoryId: record.targetFactoryId,
        receiveFactoryName: record.targetFactoryName,
        receiveWarehouseName: record.targetWarehouseName,
        objectType: record.objectType,
        handoverObjectQty: roundQty(handoverQty),
        receiveObjectQty: roundQty(writtenQty),
        diffObjectQty: record.status === '待交出' || record.status === '已全部交出' ? 0 : roundQty(writtenQty - handoverQty),
        qtyUnit: record.qtyUnit,
        packageQty: record.relatedFeiTicketIds.length || 1,
        packageUnit: record.objectType === '裁片' ? '包' : '箱',
        handoverPerson: `${record.craftName}操作员`,
        handoverAt: record.updatedAt,
        receivePerson: record.status === '已回写' ? '接收方仓管' : '',
        receiveAt: record.status === '已回写' ? record.updatedAt : '',
        status: record.status === '已回写' ? '已回写' : record.diffObjectQty > 0 ? '有差异' : '待回写',
        evidenceUrls: [],
        relatedReviewRecordId: '',
        relatedDifferenceRecordId: '',
        relatedFeiTicketIds: [...record.relatedFeiTicketIds],
        remark: record.remark,
      })
    })

  const ensureDemoCoverage = (craftType: ProcessWarehouseCraftType, craftName?: string) => {
    const warehouses = warehouseRecords.filter((record) =>
      record.recordType === 'WAIT_HANDOVER'
      && record.craftType === craftType
      && (!craftName || record.craftName === craftName),
    )
    if (!warehouses.length) return
    ;(['待回写', '已回写', '有差异'] as ProcessWarehouseHandoverStatus[]).forEach((status) => {
      let existedCount = records.filter((record) =>
        record.craftType === craftType
        && (!craftName || record.craftName === craftName)
        && record.status === status,
      ).length
      while (existedCount < 3) {
        const warehouse = warehouses[(records.length + existedCount) % warehouses.length]
        const handoverQty = roundQty(Math.max(warehouse.availableObjectQty || warehouse.plannedObjectQty || 1, 1))
        const receiveQty = status === '待回写'
          ? 0
          : status === '已回写'
            ? handoverQty
            : roundQty(handoverQty + (existedCount % 2 === 0 ? -Math.min(5, handoverQty) : 3))
        records.push({
          handoverRecordId: `PHR-DEMO-${warehouse.warehouseRecordId}-${status}-${existedCount + 1}`,
          handoverRecordNo: `JH-DEMO-${warehouse.warehouseRecordNo}-${existedCount + 1}`,
          warehouseRecordId: warehouse.warehouseRecordId,
          craftType: warehouse.craftType,
          craftName: warehouse.craftName,
          sourceWorkOrderId: warehouse.sourceWorkOrderId,
          sourceWorkOrderNo: warehouse.sourceWorkOrderNo,
          sourceTaskId: warehouse.sourceTaskId,
          sourceTaskNo: warehouse.sourceTaskNo,
          sourceProductionOrderId: warehouse.sourceProductionOrderId,
          sourceProductionOrderNo: warehouse.sourceProductionOrderNo,
          handoverFactoryId: warehouse.sourceFactoryId,
          handoverFactoryName: warehouse.sourceFactoryName,
          receiveFactoryId: warehouse.targetFactoryId,
          receiveFactoryName: warehouse.targetFactoryName,
          receiveWarehouseName: warehouse.targetWarehouseName,
          objectType: warehouse.objectType,
          handoverObjectQty: handoverQty,
          receiveObjectQty: receiveQty,
          diffObjectQty: status === '待回写' ? 0 : roundQty(receiveQty - handoverQty),
          qtyUnit: warehouse.qtyUnit,
          packageQty: warehouse.relatedFeiTicketIds.length || 1,
          packageUnit: warehouse.objectType === '面料' ? '卷' : warehouse.objectType === '裁片' ? '包' : '箱',
          handoverPerson: `${warehouse.craftName}交出员`,
          handoverAt: warehouse.updatedAt,
          receivePerson: status === '待回写' ? '' : '接收方仓管',
          receiveAt: status === '待回写' ? '' : warehouse.updatedAt,
          status,
          evidenceUrls: [],
          relatedReviewRecordId: '',
          relatedDifferenceRecordId: '',
          relatedFeiTicketIds: [...warehouse.relatedFeiTicketIds],
          remark: status === '有差异' ? `${warehouse.objectType}回写数量存在差异` : warehouse.remark,
        })
        existedCount += 1
      }
    })
  }

  ensureDemoCoverage('PRINT', '印花')
  ensureDemoCoverage('DYE', '染色')
  ;['打揽', '打条', '捆条'].forEach((craftName) => ensureDemoCoverage('SPECIAL_CRAFT', craftName))
  ensureDemoCoverage('POST_FINISHING', '后道')

  records.forEach((handover) => {
    const warehouse = warehouseRecords.find((record) => record.warehouseRecordId === handover.warehouseRecordId)
    if (warehouse && !warehouse.relatedHandoverRecordIds.includes(handover.handoverRecordId)) {
      warehouse.relatedHandoverRecordIds.push(handover.handoverRecordId)
    }
  })
  return records
}

function buildInitialReviewRecords(handoverRecords: ProcessHandoverRecord[]): ProcessWarehouseReviewRecord[] {
  return handoverRecords.map((record, index) => ({
    reviewRecordId: `PWR-${String(index + 1).padStart(4, '0')}`,
    reviewRecordNo: `SH-${String(index + 1).padStart(4, '0')}`,
    handoverRecordId: record.handoverRecordId,
    warehouseRecordId: record.warehouseRecordId,
    sourceWorkOrderId: record.sourceWorkOrderId,
    sourceWorkOrderNo: record.sourceWorkOrderNo,
    craftType: record.craftType,
    craftName: record.craftName,
    reviewStatus: record.status === '有差异' ? '数量差异' : record.status === '已回写' ? '审核通过' : '待审核',
    expectedObjectQty: record.handoverObjectQty,
    actualObjectQty: record.receiveObjectQty,
    diffObjectQty: record.diffObjectQty,
    qtyUnit: record.qtyUnit,
    reviewerName: record.status === '待回写' ? '' : '平台审核员',
    reviewedAt: record.status === '待回写' ? '' : record.receiveAt || record.handoverAt,
    reason: Math.abs(record.diffObjectQty) > 0 ? '接收回写数量与交出数量不一致' : '交出回写数量一致',
    evidenceUrls: [],
    nextAction: Math.abs(record.diffObjectQty) > 0 ? '平台处理差异' : '进入下一环节',
    relatedDifferenceRecordId: '',
    remark: Math.abs(record.diffObjectQty) > 0 ? '等待平台处理交出差异' : '交出回写数量一致',
  }))
}

function resolveDifferenceType(record: Pick<ProcessHandoverDifferenceRecord, 'craftType' | 'diffObjectQty'> & { remark?: string }): ProcessWarehouseDifferenceType {
  if (record.remark?.includes('报废')) return '报废'
  if (record.remark?.includes('货损')) return '货损'
  if (record.remark?.includes('破损')) return '破损'
  if (record.diffObjectQty < 0) return '少收'
  if (record.diffObjectQty > 0) return '多收'
  return '其他'
}

function buildDifferenceRecordFromHandover(record: ProcessHandoverRecord, index: number): ProcessHandoverDifferenceRecord {
  const status: ProcessWarehouseDifferenceStatus = index % 3 === 0 ? '待处理' : index % 3 === 1 ? '处理中' : '已确认差异'
  const nextAction: ProcessWarehouseDifferenceNextAction = status === '处理中'
    ? '平台处理'
    : status === '已确认差异'
      ? '确认差异继续流转'
      : '要求重新交出'
  const specialCraftDifferenceTypes: ProcessWarehouseDifferenceType[] = ['报废', '货损', '少收', '多收']
  return {
    differenceRecordId: `PHD-${String(index + 1).padStart(4, '0')}`,
    differenceRecordNo: `CY-${String(index + 1).padStart(4, '0')}`,
    handoverRecordId: record.handoverRecordId,
    warehouseRecordId: record.warehouseRecordId,
    sourceWorkOrderId: record.sourceWorkOrderId,
    sourceWorkOrderNo: record.sourceWorkOrderNo,
    sourceProductionOrderId: record.sourceProductionOrderId,
    sourceProductionOrderNo: record.sourceProductionOrderNo,
    craftType: record.craftType,
    craftName: record.craftName,
    objectType: record.objectType,
    expectedObjectQty: record.handoverObjectQty,
    actualObjectQty: record.receiveObjectQty,
    diffObjectQty: record.diffObjectQty,
    qtyUnit: record.qtyUnit,
    differenceType: record.craftType === 'SPECIAL_CRAFT'
      ? specialCraftDifferenceTypes[index % specialCraftDifferenceTypes.length]
      : resolveDifferenceType(record),
    responsibilitySide: index % 2 === 0 ? '待判定' : '交出工厂',
    status,
    reportedBy: record.receivePerson || '接收方仓管',
    reportedAt: record.receiveAt || record.handoverAt,
    handledBy: status === '待处理' ? '' : '平台处理员',
    handledAt: status === '待处理' ? '' : record.receiveAt || record.handoverAt,
    evidenceUrls: [...record.evidenceUrls],
    handlingResult: status === '待处理' ? '' : nextAction,
    nextAction,
    relatedFeiTicketIds: [...record.relatedFeiTicketIds],
    remark: record.remark || '接收方回写数量与交出数量不一致',
  }
}

function buildInitialDifferenceRecords(handoverRecords: ProcessHandoverRecord[]): ProcessHandoverDifferenceRecord[] {
  return handoverRecords
    .filter((record) => record.status === '有差异' || Math.abs(record.diffObjectQty) > 0)
    .map(buildDifferenceRecordFromHandover)
}

const processWarehouseRecords: ProcessWarehouseRecord[] = buildInitialWarehouseRecords()
const processHandoverRecords: ProcessHandoverRecord[] = buildInitialHandoverRecords(processWarehouseRecords)
const processHandoverDifferenceRecords: ProcessHandoverDifferenceRecord[] = buildInitialDifferenceRecords(processHandoverRecords)
const processWarehouseReviewRecords: ProcessWarehouseReviewRecord[] = buildInitialReviewRecords(processHandoverRecords)

processHandoverDifferenceRecords.forEach((difference) => {
  const handover = processHandoverRecords.find((record) => record.handoverRecordId === difference.handoverRecordId)
  if (handover) handover.relatedDifferenceRecordId = difference.differenceRecordId
})

processWarehouseReviewRecords.forEach((review) => {
  const handover = processHandoverRecords.find((record) => record.handoverRecordId === review.handoverRecordId)
  if (handover) handover.relatedReviewRecordId = review.reviewRecordId
  const difference = processHandoverDifferenceRecords.find((record) => record.handoverRecordId === review.handoverRecordId)
  if (difference) review.relatedDifferenceRecordId = difference.differenceRecordId
  const warehouse = processWarehouseRecords.find((record) => record.warehouseRecordId === handover?.warehouseRecordId)
  if (warehouse && !warehouse.relatedReviewRecordIds.includes(review.reviewRecordId)) {
    warehouse.relatedReviewRecordIds.push(review.reviewRecordId)
  }
})

function matchesWarehouseFilter(record: ProcessWarehouseRecord, filter: ProcessWarehouseRecordFilter = {}): boolean {
  if (filter.recordType && record.recordType !== filter.recordType) return false
  if (filter.craftType && record.craftType !== filter.craftType) return false
  if (filter.craftName && record.craftName !== filter.craftName) return false
  if (filter.sourceWorkOrderId && record.sourceWorkOrderId !== filter.sourceWorkOrderId) return false
  if (filter.sourceTaskId && record.sourceTaskId !== filter.sourceTaskId) return false
  if (filter.targetFactoryId && record.targetFactoryId !== filter.targetFactoryId) return false
  if (filter.status && record.status !== filter.status) return false
  return true
}

function matchesHandoverFilter(record: ProcessHandoverRecord, filter: ProcessHandoverRecordFilter = {}): boolean {
  if (filter.craftType && record.craftType !== filter.craftType) return false
  if (filter.craftName && record.craftName !== filter.craftName) return false
  if (filter.sourceWorkOrderId && record.sourceWorkOrderId !== filter.sourceWorkOrderId) return false
  if (filter.warehouseRecordId && record.warehouseRecordId !== filter.warehouseRecordId) return false
  if (filter.status && record.status !== filter.status) return false
  return true
}

function matchesReviewFilter(record: ProcessWarehouseReviewRecord, filter: ProcessWarehouseReviewRecordFilter = {}): boolean {
  if (filter.craftType && record.craftType !== filter.craftType) return false
  if (filter.craftName && record.craftName !== filter.craftName) return false
  if (filter.sourceWorkOrderId && record.sourceWorkOrderId !== filter.sourceWorkOrderId) return false
  if (filter.handoverRecordId && record.handoverRecordId !== filter.handoverRecordId) return false
  if (filter.reviewStatus && record.reviewStatus !== filter.reviewStatus) return false
  return true
}

function matchesDifferenceFilter(record: ProcessHandoverDifferenceRecord, filter: ProcessHandoverDifferenceRecordFilter = {}): boolean {
  if (filter.craftType && record.craftType !== filter.craftType) return false
  if (filter.craftName && record.craftName !== filter.craftName) return false
  if (filter.sourceWorkOrderId && record.sourceWorkOrderId !== filter.sourceWorkOrderId) return false
  if (filter.handoverRecordId && record.handoverRecordId !== filter.handoverRecordId) return false
  if (filter.warehouseRecordId && record.warehouseRecordId !== filter.warehouseRecordId) return false
  if (filter.status && record.status !== filter.status) return false
  return true
}

export function listProcessWarehouseRecords(filter: ProcessWarehouseRecordFilter = {}): ProcessWarehouseRecord[] {
  return processWarehouseRecords.filter((record) => matchesWarehouseFilter(record, filter)).map(cloneWarehouseRecord)
}

export function listWaitProcessWarehouseRecords(filter: Omit<ProcessWarehouseRecordFilter, 'recordType'> = {}): ProcessWarehouseRecord[] {
  return listProcessWarehouseRecords({ ...filter, recordType: 'WAIT_PROCESS' })
}

export function listWaitHandoverWarehouseRecords(filter: Omit<ProcessWarehouseRecordFilter, 'recordType'> = {}): ProcessWarehouseRecord[] {
  return listProcessWarehouseRecords({ ...filter, recordType: 'WAIT_HANDOVER' })
}

export function listProcessHandoverRecords(filter: ProcessHandoverRecordFilter = {}): ProcessHandoverRecord[] {
  return processHandoverRecords.filter((record) => matchesHandoverFilter(record, filter)).map(cloneHandoverRecord)
}

export function listProcessWarehouseReviewRecords(filter: ProcessWarehouseReviewRecordFilter = {}): ProcessWarehouseReviewRecord[] {
  return processWarehouseReviewRecords.filter((record) => matchesReviewFilter(record, filter)).map(cloneReviewRecord)
}

export function listProcessHandoverDifferenceRecords(filter: ProcessHandoverDifferenceRecordFilter = {}): ProcessHandoverDifferenceRecord[] {
  return processHandoverDifferenceRecords.filter((record) => matchesDifferenceFilter(record, filter)).map(cloneDifferenceRecord)
}

export function getProcessWarehouseRecordById(recordId: string): ProcessWarehouseRecord | undefined {
  const record = processWarehouseRecords.find((item) => item.warehouseRecordId === recordId)
  return record ? cloneWarehouseRecord(record) : undefined
}

export function getProcessHandoverRecordById(recordId: string): ProcessHandoverRecord | undefined {
  const record = processHandoverRecords.find((item) => item.handoverRecordId === recordId)
  return record ? cloneHandoverRecord(record) : undefined
}

export function getProcessHandoverDifferenceRecordById(differenceRecordId: string): ProcessHandoverDifferenceRecord | undefined {
  const record = processHandoverDifferenceRecords.find((item) => item.differenceRecordId === differenceRecordId)
  return record ? cloneDifferenceRecord(record) : undefined
}

export function getProcessWarehouseReviewRecordById(reviewRecordId: string): ProcessWarehouseReviewRecord | undefined {
  const record = processWarehouseReviewRecords.find((item) => item.reviewRecordId === reviewRecordId)
  return record ? cloneReviewRecord(record) : undefined
}

export function getWarehouseRecordsByWorkOrderId(workOrderId: string): ProcessWarehouseRecord[] {
  return listProcessWarehouseRecords({ sourceWorkOrderId: workOrderId })
}

export function getHandoverRecordsByWorkOrderId(workOrderId: string): ProcessHandoverRecord[] {
  return listProcessHandoverRecords({ sourceWorkOrderId: workOrderId })
}

export function getReviewRecordsByWorkOrderId(workOrderId: string): ProcessWarehouseReviewRecord[] {
  return listProcessWarehouseReviewRecords({ sourceWorkOrderId: workOrderId })
}

export function getDifferenceRecordsByWorkOrderId(workOrderId: string): ProcessHandoverDifferenceRecord[] {
  return listProcessHandoverDifferenceRecords({ sourceWorkOrderId: workOrderId })
}

export function getHandoverRecordsByWarehouseRecordId(warehouseRecordId: string): ProcessHandoverRecord[] {
  return listProcessHandoverRecords({ warehouseRecordId })
}

export function getDifferenceRecordsByHandoverRecordId(handoverRecordId: string): ProcessHandoverDifferenceRecord[] {
  return listProcessHandoverDifferenceRecords({ handoverRecordId })
}

function upsertWarehouseRecord(payload: WarehouseRecordPayload, recordType: ProcessWarehouseRecordType): ProcessWarehouseRecord {
  if (recordType === 'WAIT_HANDOVER' && payload.craftType === 'POST_FINISHING' && !['后道待交出', '复检完成'].includes(payload.currentActionName)) {
    throw new Error('后道待交出仓只能由复检完成生成。')
  }

  const existed = processWarehouseRecords.find((record) =>
    record.recordType === recordType
    && record.craftType === payload.craftType
    && record.sourceWorkOrderId === payload.sourceWorkOrderId
    && record.currentActionName === payload.currentActionName,
  )
  const next = buildWarehouseRecord(payload, recordType, processWarehouseRecords.length + 1)
  if (existed) {
    Object.assign(existed, {
      ...existed,
      ...next,
      warehouseRecordId: existed.warehouseRecordId,
      warehouseRecordNo: existed.warehouseRecordNo,
      relatedFeiTicketIds: [...new Set([...existed.relatedFeiTicketIds, ...next.relatedFeiTicketIds])],
      relatedHandoverRecordIds: [...new Set([...existed.relatedHandoverRecordIds, ...next.relatedHandoverRecordIds])],
      relatedReviewRecordIds: [...new Set([...existed.relatedReviewRecordIds, ...next.relatedReviewRecordIds])],
    })
    return cloneWarehouseRecord(existed)
  }
  processWarehouseRecords.unshift(next)
  return cloneWarehouseRecord(next)
}

export function createWaitProcessWarehouseRecord(payload: WarehouseRecordPayload): ProcessWarehouseRecord {
  return upsertWarehouseRecord(payload, 'WAIT_PROCESS')
}

export function createWaitHandoverWarehouseRecord(payload: WarehouseRecordPayload): ProcessWarehouseRecord {
  return upsertWarehouseRecord(payload, 'WAIT_HANDOVER')
}

export function updateWarehouseRecordQty(
  recordId: string,
  payload: Partial<Pick<ProcessWarehouseRecord, 'plannedObjectQty' | 'receivedObjectQty' | 'availableObjectQty' | 'handedOverObjectQty' | 'writtenBackObjectQty' | 'diffObjectQty' | 'status' | 'updatedAt'>>,
): ProcessWarehouseRecord | undefined {
  const record = processWarehouseRecords.find((item) => item.warehouseRecordId === recordId)
  if (!record) return undefined
  Object.assign(record, {
    ...payload,
    plannedObjectQty: payload.plannedObjectQty === undefined ? record.plannedObjectQty : roundQty(payload.plannedObjectQty),
    receivedObjectQty: payload.receivedObjectQty === undefined ? record.receivedObjectQty : roundQty(payload.receivedObjectQty),
    availableObjectQty: payload.availableObjectQty === undefined ? record.availableObjectQty : roundQty(payload.availableObjectQty),
    handedOverObjectQty: payload.handedOverObjectQty === undefined ? record.handedOverObjectQty : roundQty(payload.handedOverObjectQty),
    writtenBackObjectQty: payload.writtenBackObjectQty === undefined ? record.writtenBackObjectQty : roundQty(payload.writtenBackObjectQty),
    diffObjectQty: payload.diffObjectQty === undefined ? record.diffObjectQty : roundQty(payload.diffObjectQty),
    updatedAt: payload.updatedAt || nowText(),
  })
  return cloneWarehouseRecord(record)
}

export function markWarehouseRecordInProcess(recordId: string, payload: { operatorName?: string; operatedAt?: string; remark?: string } = {}): ProcessWarehouseRecord | undefined {
  const record = processWarehouseRecords.find((item) => item.warehouseRecordId === recordId)
  if (!record) return undefined
  record.status = '加工中'
  record.updatedAt = payload.operatedAt || nowText()
  record.remark = payload.remark || record.remark
  return cloneWarehouseRecord(record)
}

export function markWarehouseRecordReadyToHandover(recordId: string, payload: { operatedAt?: string; remark?: string } = {}): ProcessWarehouseRecord | undefined {
  const record = processWarehouseRecords.find((item) => item.warehouseRecordId === recordId)
  if (!record) return undefined
  record.status = '待交出'
  record.updatedAt = payload.operatedAt || nowText()
  record.remark = payload.remark || record.remark
  return cloneWarehouseRecord(record)
}

export function closeWarehouseRecord(recordId: string, payload: { closedAt?: string; remark?: string } = {}): ProcessWarehouseRecord | undefined {
  const record = processWarehouseRecords.find((item) => item.warehouseRecordId === recordId)
  if (!record) return undefined
  record.status = '已关闭'
  record.updatedAt = payload.closedAt || nowText()
  record.remark = payload.remark || record.remark
  return cloneWarehouseRecord(record)
}

export function createProcessHandoverRecord(payload: ProcessHandoverRecordPayload): ProcessHandoverRecord {
  const warehouse = payload.warehouseRecordId
    ? processWarehouseRecords.find((record) => record.warehouseRecordId === payload.warehouseRecordId)
    : processWarehouseRecords.find((record) =>
        record.recordType === 'WAIT_HANDOVER'
        && record.craftType === payload.craftType
        && record.sourceWorkOrderId === payload.sourceWorkOrderId,
      )
  const id = payload.handoverRecordId || `PHR-${String(processHandoverRecords.length + 1).padStart(4, '0')}`
  const handoverAt = payload.handoverAt || nowText()
  const record: ProcessHandoverRecord = {
    handoverRecordId: id,
    handoverRecordNo: payload.handoverRecordNo || `JH-${String(processHandoverRecords.length + 1).padStart(4, '0')}`,
    warehouseRecordId: warehouse?.warehouseRecordId || payload.warehouseRecordId || '',
    craftType: payload.craftType,
    craftName: payload.craftName,
    sourceWorkOrderId: payload.sourceWorkOrderId,
    sourceWorkOrderNo: payload.sourceWorkOrderNo,
    sourceTaskId: payload.sourceTaskId || warehouse?.sourceTaskId || '',
    sourceTaskNo: payload.sourceTaskNo || warehouse?.sourceTaskNo || '',
    sourceProductionOrderId: payload.sourceProductionOrderId || warehouse?.sourceProductionOrderId || '',
    sourceProductionOrderNo: payload.sourceProductionOrderNo || warehouse?.sourceProductionOrderNo || '',
    handoverFactoryId: payload.handoverFactoryId || warehouse?.sourceFactoryId || '',
    handoverFactoryName: payload.handoverFactoryName || warehouse?.sourceFactoryName || '',
    receiveFactoryId: payload.receiveFactoryId || warehouse?.targetFactoryId || '',
    receiveFactoryName: payload.receiveFactoryName || warehouse?.targetFactoryName || '',
    receiveWarehouseName: payload.receiveWarehouseName || warehouse?.targetWarehouseName || '',
    objectType: payload.objectType,
    handoverObjectQty: roundQty(payload.handoverObjectQty),
    receiveObjectQty: roundQty(payload.receiveObjectQty),
    diffObjectQty: roundQty(payload.diffObjectQty),
    qtyUnit: payload.qtyUnit,
    packageQty: payload.packageQty || 1,
    packageUnit: payload.packageUnit || (payload.objectType === '面料' ? '卷' : payload.objectType === '裁片' ? '包' : '箱'),
    handoverPerson: payload.handoverPerson || '工厂操作员',
    handoverAt,
    receivePerson: payload.receivePerson || '',
    receiveAt: payload.receiveAt || '',
    status: payload.status || '待回写',
    evidenceUrls: [...(payload.evidenceUrls || [])],
    relatedReviewRecordId: payload.relatedReviewRecordId || '',
    relatedDifferenceRecordId: payload.relatedDifferenceRecordId || '',
    relatedFeiTicketIds: [...(payload.relatedFeiTicketIds || warehouse?.relatedFeiTicketIds || [])],
    remark: payload.remark || '',
  }
  processHandoverRecords.unshift(record)
  if (warehouse) {
    warehouse.handedOverObjectQty = roundQty(warehouse.handedOverObjectQty + record.handoverObjectQty)
    warehouse.availableObjectQty = roundQty(Math.max(warehouse.availableObjectQty - record.handoverObjectQty, 0))
    warehouse.status = warehouse.availableObjectQty > 0 ? '已部分交出' : '已全部交出'
    warehouse.outboundAt = handoverAt
    warehouse.updatedAt = handoverAt
    if (!warehouse.relatedHandoverRecordIds.includes(record.handoverRecordId)) {
      warehouse.relatedHandoverRecordIds.push(record.handoverRecordId)
    }
  }
  return cloneHandoverRecord(record)
}

export function createProcessHandoverDifferenceRecord(payload: DifferenceRecordPayload): ProcessHandoverDifferenceRecord {
  const existed = processHandoverDifferenceRecords.find((record) => record.handoverRecordId === payload.handoverRecordId)
  const diffQty = roundQty(payload.diffObjectQty ?? (payload.actualObjectQty - payload.expectedObjectQty))
  const next: ProcessHandoverDifferenceRecord = {
    differenceRecordId: payload.differenceRecordId || existed?.differenceRecordId || `PHD-${String(processHandoverDifferenceRecords.length + 1).padStart(4, '0')}`,
    differenceRecordNo: payload.differenceRecordNo || existed?.differenceRecordNo || `CY-${String(processHandoverDifferenceRecords.length + 1).padStart(4, '0')}`,
    handoverRecordId: payload.handoverRecordId,
    warehouseRecordId: payload.warehouseRecordId,
    sourceWorkOrderId: payload.sourceWorkOrderId,
    sourceWorkOrderNo: payload.sourceWorkOrderNo,
    sourceProductionOrderId: payload.sourceProductionOrderId || '',
    sourceProductionOrderNo: payload.sourceProductionOrderNo || '',
    craftType: payload.craftType,
    craftName: payload.craftName,
    objectType: payload.objectType,
    expectedObjectQty: roundQty(payload.expectedObjectQty),
    actualObjectQty: roundQty(payload.actualObjectQty),
    diffObjectQty: diffQty,
    qtyUnit: payload.qtyUnit,
    differenceType: payload.differenceType || resolveDifferenceType({ craftType: payload.craftType, diffObjectQty: diffQty, remark: payload.remark }),
    responsibilitySide: payload.responsibilitySide || '待判定',
    status: payload.status || '待处理',
    reportedBy: payload.reportedBy || '接收方仓管',
    reportedAt: payload.reportedAt || nowText(),
    handledBy: payload.handledBy || '',
    handledAt: payload.handledAt || '',
    evidenceUrls: [...(payload.evidenceUrls || [])],
    handlingResult: payload.handlingResult || '',
    nextAction: payload.nextAction || '平台处理',
    relatedFeiTicketIds: [...(payload.relatedFeiTicketIds || [])],
    remark: payload.remark || '接收方回写数量与交出数量不一致',
  }
  if (existed) {
    Object.assign(existed, next)
    return cloneDifferenceRecord(existed)
  }
  processHandoverDifferenceRecords.unshift(next)
  const handover = processHandoverRecords.find((record) => record.handoverRecordId === next.handoverRecordId)
  if (handover) {
    handover.relatedDifferenceRecordId = next.differenceRecordId
    handover.status = '有差异'
  }
  return cloneDifferenceRecord(next)
}

export function writeBackProcessHandoverRecord(
  handoverRecordId: string,
  payload: {
    receiveObjectQty: number
    receivePerson: string
    receiveAt?: string
    evidenceUrls?: string[]
    remark?: string
  },
): ProcessHandoverRecord | undefined {
  const handover = processHandoverRecords.find((record) => record.handoverRecordId === handoverRecordId)
  if (!handover) return undefined
  const receiveAt = payload.receiveAt || nowText()
  handover.receiveObjectQty = roundQty(payload.receiveObjectQty)
  handover.diffObjectQty = roundQty(handover.receiveObjectQty - handover.handoverObjectQty)
  handover.receivePerson = payload.receivePerson
  handover.receiveAt = receiveAt
  handover.status = Math.abs(handover.diffObjectQty) > 0 ? '有差异' : '已回写'
  handover.evidenceUrls = [...(payload.evidenceUrls || handover.evidenceUrls)]
  handover.remark = payload.remark || handover.remark

  const warehouse = processWarehouseRecords.find((record) => record.warehouseRecordId === handover.warehouseRecordId)
  if (warehouse) {
    warehouse.writtenBackObjectQty = roundQty(warehouse.writtenBackObjectQty + handover.receiveObjectQty)
    warehouse.diffObjectQty = roundQty(warehouse.writtenBackObjectQty - warehouse.handedOverObjectQty)
    warehouse.status = Math.abs(warehouse.diffObjectQty) > 0 ? '有差异' : '已回写'
    warehouse.updatedAt = receiveAt
  }

  const difference = Math.abs(handover.diffObjectQty) > 0
    ? createProcessHandoverDifferenceRecord({
        handoverRecordId: handover.handoverRecordId,
        warehouseRecordId: handover.warehouseRecordId,
        sourceWorkOrderId: handover.sourceWorkOrderId,
        sourceWorkOrderNo: handover.sourceWorkOrderNo,
        sourceProductionOrderId: handover.sourceProductionOrderId,
        sourceProductionOrderNo: handover.sourceProductionOrderNo,
        craftType: handover.craftType,
        craftName: handover.craftName,
        objectType: handover.objectType,
        expectedObjectQty: handover.handoverObjectQty,
        actualObjectQty: handover.receiveObjectQty,
        diffObjectQty: handover.diffObjectQty,
        qtyUnit: handover.qtyUnit,
        reportedBy: payload.receivePerson,
        reportedAt: receiveAt,
        evidenceUrls: payload.evidenceUrls,
        relatedFeiTicketIds: handover.relatedFeiTicketIds,
        remark: payload.remark || '接收方回写数量存在差异',
      })
    : undefined

  const review = createProcessWarehouseReviewRecord({
    handoverRecordId: handover.handoverRecordId,
    warehouseRecordId: handover.warehouseRecordId,
    sourceWorkOrderId: handover.sourceWorkOrderId,
    sourceWorkOrderNo: handover.sourceWorkOrderNo,
    craftType: handover.craftType,
    craftName: handover.craftName,
    reviewStatus: handover.status === '有差异' ? '数量差异' : '待审核',
    expectedObjectQty: handover.handoverObjectQty,
    actualObjectQty: handover.receiveObjectQty,
    qtyUnit: handover.qtyUnit,
    reviewerName: '',
    reviewedAt: '',
    reason: handover.status === '有差异' ? '接收方回写数量存在差异' : '接收方已回写，等待平台审核',
    nextAction: handover.status === '有差异' ? '平台处理差异' : '进入下一环节',
    relatedDifferenceRecordId: difference?.differenceRecordId || '',
  })
  handover.relatedReviewRecordId = review.reviewRecordId
  if (difference) {
    handover.relatedDifferenceRecordId = difference.differenceRecordId
    if (handover.craftType === 'SPECIAL_CRAFT') {
      applySpecialCraftDifferenceToFeiTickets(difference.differenceRecordId, {
        operatorName: payload.receivePerson,
        operatedAt: receiveAt,
        reason: payload.remark || '特殊工艺交出回写差异',
      })
    }
  }
  return cloneHandoverRecord(handover)
}

export function createProcessWarehouseReviewRecord(payload: ReviewRecordPayload): ProcessWarehouseReviewRecord {
  const existed = processWarehouseReviewRecords.find((record) => record.handoverRecordId === payload.handoverRecordId)
  const diffQty = roundQty(payload.diffObjectQty ?? (payload.expectedObjectQty - payload.actualObjectQty))
  const next: ProcessWarehouseReviewRecord = {
    reviewRecordId: payload.reviewRecordId || existed?.reviewRecordId || `PWR-${String(processWarehouseReviewRecords.length + 1).padStart(4, '0')}`,
    reviewRecordNo: payload.reviewRecordNo || existed?.reviewRecordNo || `SH-${String(processWarehouseReviewRecords.length + 1).padStart(4, '0')}`,
    handoverRecordId: payload.handoverRecordId,
    warehouseRecordId: payload.warehouseRecordId || '',
    sourceWorkOrderId: payload.sourceWorkOrderId,
    sourceWorkOrderNo: payload.sourceWorkOrderNo,
    craftType: payload.craftType,
    craftName: payload.craftName,
    reviewStatus: payload.reviewStatus || (Math.abs(diffQty) > 0 ? '数量差异' : '待审核'),
    expectedObjectQty: roundQty(payload.expectedObjectQty),
    actualObjectQty: roundQty(payload.actualObjectQty),
    diffObjectQty: diffQty,
    qtyUnit: payload.qtyUnit,
    reviewerName: payload.reviewerName || '',
    reviewedAt: payload.reviewedAt || '',
    reason: payload.reason || '',
    evidenceUrls: [...(payload.evidenceUrls || [])],
    nextAction: payload.nextAction || (Math.abs(diffQty) > 0 ? '平台处理差异' : '进入下一环节'),
    relatedDifferenceRecordId: payload.relatedDifferenceRecordId || '',
    remark: payload.remark || '',
  }
  if (existed) {
    Object.assign(existed, next)
    return cloneReviewRecord(existed)
  }
  processWarehouseReviewRecords.unshift(next)
  const handover = processHandoverRecords.find((record) => record.handoverRecordId === next.handoverRecordId)
  if (handover) handover.relatedReviewRecordId = next.reviewRecordId
  const warehouse = processWarehouseRecords.find((record) => record.warehouseRecordId === handover?.warehouseRecordId)
  if (warehouse && !warehouse.relatedReviewRecordIds.includes(next.reviewRecordId)) {
    warehouse.relatedReviewRecordIds.push(next.reviewRecordId)
  }
  return cloneReviewRecord(next)
}

export function handleProcessHandoverDifference(
  differenceRecordId: string,
  payload: {
    handlingResult: string
    responsibilitySide: ProcessWarehouseResponsibilitySide
    nextAction: ProcessWarehouseDifferenceNextAction
    handledBy: string
    handledAt?: string
    evidenceUrls?: string[]
    remark?: string
  },
): ProcessHandoverDifferenceRecord | undefined {
  const difference = processHandoverDifferenceRecords.find((record) => record.differenceRecordId === differenceRecordId)
  if (!difference) return undefined
  const handledAt = payload.handledAt || nowText()
  difference.handlingResult = payload.handlingResult
  difference.responsibilitySide = payload.responsibilitySide
  difference.nextAction = payload.nextAction
  difference.handledBy = payload.handledBy
  difference.handledAt = handledAt
  difference.evidenceUrls = [...(payload.evidenceUrls || difference.evidenceUrls)]
  difference.remark = payload.remark || difference.remark

  const handover = processHandoverRecords.find((record) => record.handoverRecordId === difference.handoverRecordId)
  const warehouse = processWarehouseRecords.find((record) => record.warehouseRecordId === difference.warehouseRecordId)
  const review = processWarehouseReviewRecords.find((record) => record.handoverRecordId === difference.handoverRecordId)

  if (payload.nextAction === '确认差异继续流转') {
    difference.status = '已确认差异'
    if (handover) handover.status = '已回写'
    if (warehouse) {
      warehouse.status = '已回写'
      warehouse.updatedAt = handledAt
    }
    if (review) {
      review.reviewStatus = '审核通过'
      review.nextAction = '进入下一环节'
      review.reviewerName = payload.handledBy
      review.reviewedAt = handledAt
      review.reason = payload.handlingResult
      review.remark = payload.remark || review.remark
    }
  } else if (payload.nextAction === '要求重新交出') {
    difference.status = '需重新交出'
    if (handover) handover.status = '需重新交出'
    if (warehouse) {
      warehouse.status = '待交出'
      warehouse.availableObjectQty = roundQty(warehouse.availableObjectQty + Math.abs(difference.diffObjectQty))
      warehouse.updatedAt = handledAt
    }
    if (review) {
      review.reviewStatus = '审核驳回'
      review.nextAction = '退回重交'
      review.reviewerName = payload.handledBy
      review.reviewedAt = handledAt
      review.reason = payload.handlingResult
      review.remark = payload.remark || review.remark
    }
  } else if (payload.nextAction === '关闭记录') {
    difference.status = '已关闭'
    if (handover) handover.status = '已关闭'
    if (warehouse) {
      warehouse.status = '已关闭'
      warehouse.updatedAt = handledAt
    }
    if (review) {
      review.reviewStatus = '已关闭'
      review.nextAction = '关闭'
      review.reviewerName = payload.handledBy
      review.reviewedAt = handledAt
      review.reason = payload.handlingResult
      review.remark = payload.remark || review.remark
    }
  } else {
    difference.status = '处理中'
    if (handover) handover.status = '平台处理中'
    if (warehouse) {
      warehouse.status = '平台处理中'
      warehouse.updatedAt = handledAt
    }
    if (review) {
      review.reviewStatus = '数量差异'
      review.nextAction = '平台处理差异'
      review.reviewerName = payload.handledBy
      review.reviewedAt = handledAt
      review.reason = payload.handlingResult
      review.remark = payload.remark || review.remark
    }
  }

  return cloneDifferenceRecord(difference)
}

export function applySpecialCraftDifferenceToFeiTickets(
  differenceRecordId: string,
  payload: {
    operatorName: string
    operatedAt?: string
    reason?: string
  },
): ProcessHandoverDifferenceRecord | undefined {
  const difference = processHandoverDifferenceRecords.find((record) => record.differenceRecordId === differenceRecordId)
  if (!difference || difference.craftType !== 'SPECIAL_CRAFT') return difference ? cloneDifferenceRecord(difference) : undefined
  applySpecialCraftHandoverDifferenceToFeiTickets({
    workOrderId: difference.sourceWorkOrderId,
    feiTicketNos: difference.relatedFeiTicketIds,
    differenceType: difference.differenceType,
    expectedQty: difference.expectedObjectQty,
    actualQty: difference.actualObjectQty,
    diffQty: difference.diffObjectQty,
    sourceRecordId: difference.differenceRecordId,
    sourceRecordNo: difference.differenceRecordNo,
    operatorName: payload.operatorName,
    operatedAt: payload.operatedAt || nowText(),
    reason: payload.reason || difference.remark,
  })
  difference.status = '已确认差异'
  difference.handlingResult = '特殊工艺菲票数量已同步'
  difference.nextAction = '确认差异继续流转'
  difference.handledBy = payload.operatorName
  difference.handledAt = payload.operatedAt || nowText()
  difference.remark = payload.reason || difference.remark || '已同步特殊工艺菲票数量变化'
  return cloneDifferenceRecord(difference)
}

export function getProcessWarehouseSummary(filter: ProcessWarehouseRecordFilter = {}) {
  const waitProcess = listWaitProcessWarehouseRecords(filter)
  const waitHandover = listWaitHandoverWarehouseRecords(filter)
  const handovers = listProcessHandoverRecords({
    craftType: filter.craftType,
    craftName: filter.craftName,
    sourceWorkOrderId: filter.sourceWorkOrderId,
  })
  const reviews = listProcessWarehouseReviewRecords({
    craftType: filter.craftType,
    craftName: filter.craftName,
    sourceWorkOrderId: filter.sourceWorkOrderId,
  })
  const differences = listProcessHandoverDifferenceRecords({
    craftType: filter.craftType,
    craftName: filter.craftName,
    sourceWorkOrderId: filter.sourceWorkOrderId,
  })
  return {
    waitProcessQty: roundQty(waitProcess.reduce((sum, record) => sum + record.availableObjectQty, 0)),
    waitHandoverQty: roundQty(waitHandover.reduce((sum, record) => sum + record.availableObjectQty, 0)),
    handedOverQty: roundQty(handovers.reduce((sum, record) => sum + record.handoverObjectQty, 0)),
    writtenBackQty: roundQty(handovers.reduce((sum, record) => sum + record.receiveObjectQty, 0)),
    diffQty: roundQty(handovers.reduce((sum, record) => sum + Math.abs(record.diffObjectQty), 0)),
    waitWritebackHandoverCount: handovers.filter((record) => record.status === '待回写').length,
    writtenBackHandoverCount: handovers.filter((record) => record.status === '已回写').length,
    differenceHandoverCount: handovers.filter((record) => record.status === '有差异' || record.status === '平台处理中' || record.status === '需重新交出').length,
    differenceRecordCount: differences.length,
    scrapQty: roundQty(differences.filter((record) => record.differenceType === '报废').reduce((sum, record) => sum + Math.abs(record.diffObjectQty), 0)),
    damageQty: roundQty(differences.filter((record) => record.differenceType === '货损' || record.differenceType === '破损').reduce((sum, record) => sum + Math.abs(record.diffObjectQty), 0)),
    waitReviewCount: reviews.filter((record) => record.reviewStatus === '待审核' || record.reviewStatus === '数量差异').length,
    feiTicketCount: new Set([...waitProcess, ...waitHandover].flatMap((record) => record.relatedFeiTicketIds)).size,
  }
}
