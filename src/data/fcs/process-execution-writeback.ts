import {
  completeColorTest,
  completePrinting,
  completeTransfer,
  getPrintExecutionNodeRecord,
  getPrintWorkOrderById,
  getPrintWorkOrderByTaskId,
  listPrintMachineOptions,
  startColorTest,
  startPrinting,
  startTransfer,
  type PrintExecutionNodeCode,
  type PrintWorkOrder,
} from './printing-task-domain.ts'
import {
  completeDyeMaterialReady,
  completeDyeMaterialWait,
  completeDyeNode,
  completeDyeSampleTest,
  completeDyeSampleWait,
  completeDyeing,
  getDyeExecutionNodeRecord,
  getDyeWorkOrderById,
  getDyeWorkOrderByTaskId,
  listDyeVatOptions,
  planDyeVat,
  startDyeMaterialReady,
  startDyeMaterialWait,
  startDyeNode as startDyeExecutionNode,
  startDyeSampleTest,
  startDyeSampleWait,
  startDyeing,
  type DyeExecutionNodeCode,
  type DyeWorkOrder,
} from './dyeing-task-domain.ts'
import {
  createFactoryHandoverRecord,
  ensureHandoverOrderForStartedTask,
  writeBackHandoverRecord,
  type PdaHandoverRecord,
} from './pda-handover-events.ts'
import {
  createSpecialCraftReturnHandover,
  getSpecialCraftBindingsByTaskOrderId,
  linkSpecialCraftCompletionToReturnWaitHandoverStock,
  listCuttingSpecialCraftFeiTicketBindings,
  recordSpecialCraftFeiTicketLossAndDamage,
  type CuttingSpecialCraftFeiTicketBinding,
  type SpecialCraftQtyDifferenceReport,
} from './cutting/special-craft-fei-ticket-flow.ts'
import {
  getSpecialCraftTaskOrderById,
  getSpecialCraftTaskWorkOrdersByTaskOrderId,
  listSpecialCraftTaskOrders,
  type SpecialCraftTaskOrder,
} from './special-craft-task-orders.ts'
import {
  applyPostFinishingActionFinish,
  applyPostFinishingActionStart,
  ensurePostFinishingHandoverWarehouseRecord,
  getPostFinishingWorkOrderById,
  getPostFinishingWorkOrderBySourceTaskId,
  receivePostFinishingAtManagedFactory,
  submitPostFinishingHandoverRecord,
  transferPostFinishingToManagedFactory,
  type PostFinishingActionType,
  type PostFinishingWaitHandoverWarehouseRecord,
  type PostFinishingWorkOrder,
} from './post-finishing-domain.ts'
import {
  createProcessHandoverRecord,
  createWaitHandoverWarehouseRecord,
  createWaitProcessWarehouseRecord,
  writeBackProcessHandoverRecord,
} from './process-warehouse-domain.ts'

export interface ExecutionWritebackPayload {
  operatorName?: string
  operatedAt?: string
  remark?: string
}

export interface QtyWritebackPayload extends ExecutionWritebackPayload {
  submittedQty?: number
  receiverWrittenQty?: number
  qtyUnit?: string
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function requirePrintOrderByTaskId(taskId: string): PrintWorkOrder {
  const order = getPrintWorkOrderByTaskId(taskId)
  if (!order) throw new Error(`未找到印花加工单：${taskId}`)
  return order
}

function requireDyeOrderByTaskId(taskId: string): DyeWorkOrder {
  const order = getDyeWorkOrderByTaskId(taskId)
  if (!order) throw new Error(`未找到染色加工单：${taskId}`)
  return order
}

function ensurePrintHandoverOrderId(order: PrintWorkOrder): string {
  if (order.handoverOrderId) return order.handoverOrderId
  return ensureHandoverOrderForStartedTask(order.taskId).handoverOrderId
}

function ensureDyeHandoverOrderId(order: DyeWorkOrder): string {
  if (order.handoverOrderId) return order.handoverOrderId
  return ensureHandoverOrderForStartedTask(order.taskId).handoverOrderId
}

function buildProductionOrderNo(ids: string[] | undefined): string {
  return ids?.[0] || ''
}

function createPrintWaitHandoverRecord(order: PrintWorkOrder, qty: number, operatedAt?: string) {
  return createWaitHandoverWarehouseRecord({
    craftType: 'PRINT',
    craftName: '印花',
    sourceWorkOrderId: order.printOrderId,
    sourceWorkOrderNo: order.printOrderNo,
    sourceTaskId: order.taskId,
    sourceTaskNo: order.taskNo,
    sourceProductionOrderId: buildProductionOrderNo(order.productionOrderIds),
    sourceProductionOrderNo: buildProductionOrderNo(order.productionOrderIds),
    sourceDemandId: order.sourceDemandIds[0] || '',
    sourceDemandNo: order.sourceDemandIds[0] || '',
    sourceFactoryId: order.printFactoryId,
    sourceFactoryName: order.printFactoryName,
    targetFactoryId: order.targetTransferWarehouseId,
    targetFactoryName: order.targetTransferWarehouseName,
    targetWarehouseName: '印花待交出仓',
    warehouseLocation: '印花待交出仓-A01',
    skuSummary: order.materialSku,
    materialSku: order.materialSku,
    materialName: '印花面料',
    objectType: '面料',
    plannedObjectQty: order.plannedQty,
    receivedObjectQty: qty,
    availableObjectQty: qty,
    qtyUnit: '米',
    currentActionName: '印花待交出',
    status: '待交出',
    inboundAt: operatedAt || nowTimestamp(),
    remark: '移动端完成转印后生成待交出仓记录',
  })
}

function createDyeWaitHandoverRecord(order: DyeWorkOrder, qty: number, operatedAt?: string) {
  return createWaitHandoverWarehouseRecord({
    craftType: 'DYE',
    craftName: '染色',
    sourceWorkOrderId: order.dyeOrderId,
    sourceWorkOrderNo: order.dyeOrderNo,
    sourceTaskId: order.taskId,
    sourceTaskNo: order.taskNo,
    sourceProductionOrderId: buildProductionOrderNo(order.productionOrderIds),
    sourceProductionOrderNo: buildProductionOrderNo(order.productionOrderIds),
    sourceDemandId: order.sourceDemandIds[0] || '',
    sourceDemandNo: order.sourceDemandIds[0] || '',
    sourceFactoryId: order.dyeFactoryId,
    sourceFactoryName: order.dyeFactoryName,
    targetFactoryId: order.targetTransferWarehouseId,
    targetFactoryName: order.targetTransferWarehouseName,
    targetWarehouseName: '染色待交出仓',
    warehouseLocation: '染色待交出仓-B01',
    skuSummary: order.rawMaterialSku,
    materialSku: order.rawMaterialSku,
    materialName: '染色面料',
    objectType: '面料',
    plannedObjectQty: order.plannedQty,
    receivedObjectQty: qty,
    availableObjectQty: qty,
    qtyUnit: '米',
    currentActionName: '染色待交出',
    status: '待交出',
    inboundAt: operatedAt || nowTimestamp(),
    remark: '移动端包装完成后生成待交出仓记录',
  })
}

function resolveSpecialCraftWorkOrderId(taskOrder: SpecialCraftTaskOrder): string {
  return getSpecialCraftTaskWorkOrdersByTaskOrderId(taskOrder.taskOrderId)[0]?.workOrderId || taskOrder.taskOrderId
}

export function startPrintNode(taskId: string, nodeCode: PrintExecutionNodeCode, payload: ExecutionWritebackPayload = {}) {
  const order = requirePrintOrderByTaskId(taskId)
  if (nodeCode === 'COLOR_TEST') {
    const nodeRecord = startColorTest(order.printOrderId, payload.operatorName || '印花工厂')
    return { workOrder: getPrintWorkOrderById(order.printOrderId), nodeRecord }
  }
  if (nodeCode === 'PRINT') {
    const printerNo = (payload as ExecutionWritebackPayload & { printerNo?: string }).printerNo
      || getPrintExecutionNodeRecord(order.printOrderId, 'PRINT')?.printerNo
      || listPrintMachineOptions(order.printFactoryId)[0]?.printerNo
      || ''
    const nodeRecord = startPrinting(order.printOrderId, { printerNo, operatorName: payload.operatorName || '印花工厂' })
    return { workOrder: getPrintWorkOrderById(order.printOrderId), nodeRecord }
  }
  if (nodeCode === 'TRANSFER') {
    const nodeRecord = startTransfer(order.printOrderId, payload.operatorName || '印花工厂')
    return { workOrder: getPrintWorkOrderById(order.printOrderId), nodeRecord }
  }
  throw new Error(`印花移动端暂不支持直接开始节点：${nodeCode}`)
}

export function finishPrintNode(taskId: string, nodeCode: PrintExecutionNodeCode, payload: ExecutionWritebackPayload & {
  passed?: boolean
  outputQty?: number
  wasteQty?: number
  usedMaterialQty?: number
  actualCompletedQty?: number
} = {}) {
  const order = requirePrintOrderByTaskId(taskId)
  if (nodeCode === 'COLOR_TEST') {
    const nodeRecord = completeColorTest(order.printOrderId, {
      passed: payload.passed ?? true,
      operatorName: payload.operatorName || '印花工厂',
      remark: payload.remark,
    })
    return { workOrder: getPrintWorkOrderById(order.printOrderId), nodeRecord }
  }
  if (nodeCode === 'PRINT') {
    const nodeRecord = completePrinting(order.printOrderId, {
      outputQty: payload.outputQty ?? order.plannedQty,
      wasteQty: payload.wasteQty ?? 0,
      operatorName: payload.operatorName || '印花工厂',
    })
    return { workOrder: getPrintWorkOrderById(order.printOrderId), nodeRecord }
  }
  if (nodeCode === 'TRANSFER') {
    const nodeRecord = completeTransfer(order.printOrderId, {
      usedMaterialQty: payload.usedMaterialQty ?? order.plannedQty,
      actualCompletedQty: payload.actualCompletedQty ?? order.plannedQty,
      operatorName: payload.operatorName || '印花工厂',
    })
    createPrintWaitHandoverRecord(order, payload.actualCompletedQty ?? order.plannedQty, payload.operatedAt)
    return { workOrder: getPrintWorkOrderById(order.printOrderId), nodeRecord }
  }
  throw new Error(`印花移动端暂不支持直接完成节点：${nodeCode}`)
}

export function submitPrintDelivery(taskId: string, payload: ExecutionWritebackPayload = {}) {
  const order = requirePrintOrderByTaskId(taskId)
  const handoverOrderId = ensurePrintHandoverOrderId(order)
  return {
    workOrder: getPrintWorkOrderById(order.printOrderId),
    handoverOrderId,
    deliveryRemark: payload.remark || '印花转印完成，进入待送货',
  }
}

export function submitPrintHandover(taskId: string, payload: QtyWritebackPayload = {}): {
  workOrder?: PrintWorkOrder
  handoverRecord: PdaHandoverRecord
} {
  const order = requirePrintOrderByTaskId(taskId)
  const handoverOrderId = ensurePrintHandoverOrderId(order)
  const submittedQty = payload.submittedQty ?? getPrintExecutionNodeRecord(order.printOrderId, 'TRANSFER')?.actualCompletedQty ?? order.plannedQty
  const submittedAt = payload.operatedAt || nowTimestamp()
  const created = createFactoryHandoverRecord({
    handoverOrderId,
    submittedQty,
    qtyUnit: payload.qtyUnit || order.qtyUnit,
    factorySubmittedAt: submittedAt,
    factorySubmittedBy: payload.operatorName || '印花工厂',
    factoryRemark: payload.remark || `交出面料米数：${submittedQty} ${order.qtyUnit}`,
    objectType: 'FABRIC',
    handoutObjectType: 'FABRIC',
    handoutItemLabel: `${order.patternNo} / ${order.materialColor || order.materialSku}`,
    materialCode: order.materialSku,
    materialName: '印花面料',
    materialSpec: order.materialColor,
  })
  const handoverRecord = writeBackHandoverRecord({
    handoverRecordId: created.handoverRecordId || created.recordId,
    receiverWrittenQty: payload.receiverWrittenQty ?? submittedQty,
    receiverWrittenAt: submittedAt,
    receiverWrittenBy: order.targetTransferWarehouseName,
    receiverRemark: '移动端交出后接收方回写',
  })
  const unified = createProcessHandoverRecord({
    craftType: 'PRINT',
    craftName: '印花',
    sourceWorkOrderId: order.printOrderId,
    sourceWorkOrderNo: order.printOrderNo,
    sourceTaskId: order.taskId,
    sourceTaskNo: order.taskNo,
    sourceProductionOrderId: buildProductionOrderNo(order.productionOrderIds),
    sourceProductionOrderNo: buildProductionOrderNo(order.productionOrderIds),
    handoverFactoryId: order.printFactoryId,
    handoverFactoryName: order.printFactoryName,
    receiveFactoryId: order.targetTransferWarehouseId,
    receiveFactoryName: order.targetTransferWarehouseName,
    receiveWarehouseName: order.targetTransferWarehouseName,
    objectType: '面料',
    handoverObjectQty: submittedQty,
    receiveObjectQty: payload.receiverWrittenQty ?? submittedQty,
    diffObjectQty: submittedQty - (payload.receiverWrittenQty ?? submittedQty),
    qtyUnit: '米',
    packageQty: order.plannedRollCount || 1,
    packageUnit: '卷',
    handoverPerson: payload.operatorName || '印花工厂',
    handoverAt: submittedAt,
    status: '待回写',
    remark: payload.remark || '移动端发起印花交出',
  })
  writeBackProcessHandoverRecord(unified.handoverRecordId, {
    receiveObjectQty: payload.receiverWrittenQty ?? submittedQty,
    receivePerson: order.targetTransferWarehouseName,
    receiveAt: submittedAt,
    remark: '移动端交出后接收方回写',
  })
  return { workOrder: getPrintWorkOrderById(order.printOrderId), handoverRecord }
}

export function createPrintReviewRecord(taskId: string, payload: QtyWritebackPayload = {}) {
  return submitPrintHandover(taskId, payload)
}

export function startDyeNode(taskId: string, nodeCode: DyeExecutionNodeCode, payload: ExecutionWritebackPayload & {
  waitType?: 'WAIT_SAMPLE_GARMENT' | 'WAIT_COLOR_CARD'
  dyeVatNo?: string
} = {}) {
  const order = requireDyeOrderByTaskId(taskId)
  if (nodeCode === 'SAMPLE') {
    const nodeRecord = startDyeSampleTest(order.dyeOrderId, payload.operatorName || '染色工厂')
    return { workOrder: getDyeWorkOrderById(order.dyeOrderId), nodeRecord }
  }
  if (nodeCode === 'MATERIAL_READY') {
    const nodeRecord = startDyeMaterialReady(order.dyeOrderId, payload.operatorName || '染色工厂')
    return { workOrder: getDyeWorkOrderById(order.dyeOrderId), nodeRecord }
  }
  if (nodeCode === 'VAT_PLAN') {
    const dyeVatNo = payload.dyeVatNo || getDyeExecutionNodeRecord(order.dyeOrderId, 'VAT_PLAN')?.dyeVatNo || listDyeVatOptions(order.dyeFactoryId)[0]?.dyeVatNo || ''
    const nodeRecord = planDyeVat(order.dyeOrderId, { dyeVatNo, operatorName: payload.operatorName || '染色工厂' })
    return { workOrder: getDyeWorkOrderById(order.dyeOrderId), nodeRecord }
  }
  if (nodeCode === 'DYE') {
    const dyeVatNo = payload.dyeVatNo || getDyeExecutionNodeRecord(order.dyeOrderId, 'DYE')?.dyeVatNo || getDyeExecutionNodeRecord(order.dyeOrderId, 'VAT_PLAN')?.dyeVatNo || listDyeVatOptions(order.dyeFactoryId)[0]?.dyeVatNo || ''
    const nodeRecord = startDyeing(order.dyeOrderId, { dyeVatNo, operatorName: payload.operatorName || '染色工厂' })
    return { workOrder: getDyeWorkOrderById(order.dyeOrderId), nodeRecord }
  }
  if (nodeCode === 'DEHYDRATE' || nodeCode === 'DRY' || nodeCode === 'SET' || nodeCode === 'ROLL' || nodeCode === 'PACK') {
    const nodeRecord = startDyeExecutionNode(order.dyeOrderId, nodeCode, payload.operatorName || '染色工厂')
    return { workOrder: getDyeWorkOrderById(order.dyeOrderId), nodeRecord }
  }
  throw new Error(`染色移动端暂不支持直接开始节点：${nodeCode}`)
}

export function finishDyeNode(taskId: string, nodeCode: DyeExecutionNodeCode, payload: ExecutionWritebackPayload & {
  colorNo?: string
  outputQty?: number
  inputQty?: number
} = {}) {
  const order = requireDyeOrderByTaskId(taskId)
  if (nodeCode === 'SAMPLE') {
    const nodeRecord = completeDyeSampleTest(order.dyeOrderId, {
      colorNo: payload.colorNo || order.colorNo || '移动端色号',
      operatorName: payload.operatorName || '染色工厂',
    })
    return { workOrder: getDyeWorkOrderById(order.dyeOrderId), nodeRecord }
  }
  if (nodeCode === 'MATERIAL_READY') {
    const nodeRecord = completeDyeMaterialReady(order.dyeOrderId, {
      outputQty: payload.outputQty ?? order.plannedQty,
      operatorName: payload.operatorName || '染色工厂',
    })
    return { workOrder: getDyeWorkOrderById(order.dyeOrderId), nodeRecord }
  }
  if (nodeCode === 'DYE') {
    const nodeRecord = completeDyeing(order.dyeOrderId, {
      inputQty: payload.inputQty ?? order.plannedQty,
      outputQty: payload.outputQty ?? order.plannedQty,
      operatorName: payload.operatorName || '染色工厂',
    })
    return { workOrder: getDyeWorkOrderById(order.dyeOrderId), nodeRecord }
  }
  if (nodeCode === 'DEHYDRATE' || nodeCode === 'DRY' || nodeCode === 'SET' || nodeCode === 'ROLL' || nodeCode === 'PACK') {
    const nodeRecord = completeDyeNode(order.dyeOrderId, nodeCode, {
      outputQty: payload.outputQty ?? order.plannedQty,
      operatorName: payload.operatorName || '染色工厂',
    })
    if (nodeCode === 'PACK') {
      createDyeWaitHandoverRecord(order, payload.outputQty ?? order.plannedQty, payload.operatedAt)
    }
    return { workOrder: getDyeWorkOrderById(order.dyeOrderId), nodeRecord }
  }
  throw new Error(`染色移动端暂不支持直接完成节点：${nodeCode}`)
}

export function submitDyeDelivery(taskId: string, payload: ExecutionWritebackPayload = {}) {
  const order = requireDyeOrderByTaskId(taskId)
  const handoverOrderId = ensureDyeHandoverOrderId(order)
  return {
    workOrder: getDyeWorkOrderById(order.dyeOrderId),
    handoverOrderId,
    deliveryRemark: payload.remark || '染色包装完成，进入待送货',
  }
}

export function submitDyeHandover(taskId: string, payload: QtyWritebackPayload = {}): {
  workOrder?: DyeWorkOrder
  handoverRecord: PdaHandoverRecord
} {
  const order = requireDyeOrderByTaskId(taskId)
  const handoverOrderId = ensureDyeHandoverOrderId(order)
  const submittedQty = payload.submittedQty ?? getDyeExecutionNodeRecord(order.dyeOrderId, 'PACK')?.outputQty ?? order.plannedQty
  const submittedAt = payload.operatedAt || nowTimestamp()
  const created = createFactoryHandoverRecord({
    handoverOrderId,
    submittedQty,
    qtyUnit: payload.qtyUnit || order.qtyUnit,
    factorySubmittedAt: submittedAt,
    factorySubmittedBy: payload.operatorName || '染色工厂',
    factoryRemark: payload.remark || `交出面料米数：${submittedQty} ${order.qtyUnit}`,
    objectType: 'FABRIC',
    handoutObjectType: 'FABRIC',
    handoutItemLabel: `${order.targetColor} / ${order.colorNo || '待确认色号'}`,
    materialCode: order.rawMaterialSku,
    materialName: '染色面料',
    materialSpec: order.targetColor,
  })
  const handoverRecord = writeBackHandoverRecord({
    handoverRecordId: created.handoverRecordId || created.recordId,
    receiverWrittenQty: payload.receiverWrittenQty ?? submittedQty,
    receiverWrittenAt: submittedAt,
    receiverWrittenBy: order.targetTransferWarehouseName,
    receiverRemark: '移动端交出后接收方回写',
  })
  const unified = createProcessHandoverRecord({
    craftType: 'DYE',
    craftName: '染色',
    sourceWorkOrderId: order.dyeOrderId,
    sourceWorkOrderNo: order.dyeOrderNo,
    sourceTaskId: order.taskId,
    sourceTaskNo: order.taskNo,
    sourceProductionOrderId: buildProductionOrderNo(order.productionOrderIds),
    sourceProductionOrderNo: buildProductionOrderNo(order.productionOrderIds),
    handoverFactoryId: order.dyeFactoryId,
    handoverFactoryName: order.dyeFactoryName,
    receiveFactoryId: order.targetTransferWarehouseId,
    receiveFactoryName: order.targetTransferWarehouseName,
    receiveWarehouseName: order.targetTransferWarehouseName,
    objectType: '面料',
    handoverObjectQty: submittedQty,
    receiveObjectQty: payload.receiverWrittenQty ?? submittedQty,
    diffObjectQty: submittedQty - (payload.receiverWrittenQty ?? submittedQty),
    qtyUnit: '米',
    packageQty: order.plannedRollCount || 1,
    packageUnit: '卷',
    handoverPerson: payload.operatorName || '染色工厂',
    handoverAt: submittedAt,
    status: '待回写',
    remark: payload.remark || '移动端发起染色交出',
  })
  writeBackProcessHandoverRecord(unified.handoverRecordId, {
    receiveObjectQty: payload.receiverWrittenQty ?? submittedQty,
    receivePerson: order.targetTransferWarehouseName,
    receiveAt: submittedAt,
    remark: '移动端交出后接收方回写',
  })
  return { workOrder: getDyeWorkOrderById(order.dyeOrderId), handoverRecord }
}

export function createDyeReviewRecord(taskId: string, payload: QtyWritebackPayload = {}) {
  return submitDyeHandover(taskId, payload)
}

export function startDyeSampleWaitWriteback(taskId: string, payload: ExecutionWritebackPayload & { waitType?: 'WAIT_SAMPLE_GARMENT' | 'WAIT_COLOR_CARD' } = {}) {
  const order = requireDyeOrderByTaskId(taskId)
  startDyeSampleWait(order.dyeOrderId, {
    waitType: payload.waitType || order.sampleWaitType || 'WAIT_SAMPLE_GARMENT',
    operatorName: payload.operatorName || '染色工厂',
  })
  return { workOrder: getDyeWorkOrderById(order.dyeOrderId) }
}

export function finishDyeSampleWaitWriteback(taskId: string, payload: ExecutionWritebackPayload = {}) {
  const order = requireDyeOrderByTaskId(taskId)
  completeDyeSampleWait(order.dyeOrderId, payload.operatorName || '染色工厂')
  return { workOrder: getDyeWorkOrderById(order.dyeOrderId) }
}

export function startDyeMaterialWaitWriteback(taskId: string, payload: ExecutionWritebackPayload = {}) {
  const order = requireDyeOrderByTaskId(taskId)
  startDyeMaterialWait(order.dyeOrderId, payload.operatorName || '染色工厂')
  return { workOrder: getDyeWorkOrderById(order.dyeOrderId) }
}

export function finishDyeMaterialWaitWriteback(taskId: string, payload: ExecutionWritebackPayload = {}) {
  const order = requireDyeOrderByTaskId(taskId)
  completeDyeMaterialWait(order.dyeOrderId, payload.operatorName || '染色工厂')
  return { workOrder: getDyeWorkOrderById(order.dyeOrderId) }
}

function findSpecialCraftTaskOrder(taskId: string): SpecialCraftTaskOrder | undefined {
  const direct = getSpecialCraftTaskOrderById(taskId)
    || listSpecialCraftTaskOrders().find((taskOrder) => taskOrder.taskOrderNo === taskId || taskOrder.taskOrderId === taskId)
  if (direct) return direct
  const binding = listCuttingSpecialCraftFeiTicketBindings().find((item) => item.taskOrderId === taskId || item.workOrderId === taskId)
  return binding ? getSpecialCraftTaskOrderById(binding.taskOrderId) : undefined
}

function getSpecialCraftBindings(taskId: string): CuttingSpecialCraftFeiTicketBinding[] {
  const taskOrder = findSpecialCraftTaskOrder(taskId)
  if (!taskOrder) return []
  return getSpecialCraftBindingsByTaskOrderId(taskOrder.taskOrderId)
}

export function startSpecialCraftTask(taskId: string, payload: ExecutionWritebackPayload = {}) {
  const taskOrder = findSpecialCraftTaskOrder(taskId)
  if (!taskOrder) throw new Error(`未找到特殊工艺任务：${taskId}`)
  const workOrderId = resolveSpecialCraftWorkOrderId(taskOrder)
  createWaitProcessWarehouseRecord({
    craftType: 'SPECIAL_CRAFT',
    craftName: taskOrder.operationName,
    sourceWorkOrderId: workOrderId,
    sourceWorkOrderNo: taskOrder.taskOrderNo,
    sourceTaskId: taskOrder.taskOrderId,
    sourceTaskNo: taskOrder.taskOrderNo,
    sourceProductionOrderId: taskOrder.productionOrderId,
    sourceProductionOrderNo: taskOrder.productionOrderNo,
    sourceFactoryId: taskOrder.sourceFactoryId,
    sourceFactoryName: taskOrder.sourceFactoryName,
    targetFactoryId: taskOrder.factoryId,
    targetFactoryName: taskOrder.factoryName,
    targetWarehouseName: `${taskOrder.operationName}待加工仓`,
    warehouseLocation: `${taskOrder.operationName}待加工仓-A01`,
    skuSummary: taskOrder.partName || taskOrder.materialSku || taskOrder.operationName,
    materialSku: taskOrder.materialSku || '',
    materialName: taskOrder.partName || taskOrder.operationName,
    objectType: '裁片',
    plannedObjectQty: taskOrder.planQty,
    receivedObjectQty: taskOrder.receivedQty,
    availableObjectQty: taskOrder.receivedQty,
    qtyUnit: '片',
    currentActionName: `待${taskOrder.operationName}`,
    status: '加工中',
    inboundAt: payload.operatedAt || nowTimestamp(),
    relatedFeiTicketIds: getSpecialCraftBindings(taskOrder.taskOrderId).map((binding) => binding.feiTicketNo),
    remark: payload.remark || '移动端接收裁片并开始特殊工艺',
  })
  return {
    taskOrder,
    event: {
      eventType: '开工',
      operatorName: payload.operatorName || '现场操作员',
      operatedAt: payload.operatedAt || nowTimestamp(),
      remark: payload.remark || '移动端开始特殊工艺',
    },
  }
}

export function bindSpecialCraftFeiTicket(taskId: string, payload: ExecutionWritebackPayload & { feiTicketNo?: string } = {}) {
  const bindings = getSpecialCraftBindings(taskId)
  const binding = payload.feiTicketNo ? bindings.find((item) => item.feiTicketNo === payload.feiTicketNo) : bindings[0]
  if (!binding) throw new Error('未找到可绑定菲票')
  return { binding }
}

export function reportSpecialCraftDifference(taskId: string, payload: ExecutionWritebackPayload & {
  bindingId?: string
  feiTicketNo?: string
  scrapQty?: number
  damageQty?: number
  reason?: string
}): { binding: CuttingSpecialCraftFeiTicketBinding; report?: SpecialCraftQtyDifferenceReport } {
  const bindings = getSpecialCraftBindings(taskId)
  const binding = payload.bindingId
    ? bindings.find((item) => item.bindingId === payload.bindingId)
    : payload.feiTicketNo
      ? bindings.find((item) => item.feiTicketNo === payload.feiTicketNo)
      : bindings[0]
  if (!binding) throw new Error('未找到可上报差异的特殊工艺菲票')
  const updated = recordSpecialCraftFeiTicketLossAndDamage({
    bindingId: binding.bindingId,
    scrapQty: payload.scrapQty ?? 0,
    damageQty: payload.damageQty ?? 0,
    reason: payload.reason || payload.remark || '移动端上报差异',
    operatorName: payload.operatorName || '现场操作员',
    operatedAt: payload.operatedAt || nowTimestamp(),
  })
  return { binding: updated }
}

export function finishSpecialCraftTask(taskId: string, payload: ExecutionWritebackPayload & {
  completedQty?: number
  scrapQty?: number
  damageQty?: number
  feiTicketNos?: string[]
} = {}) {
  const taskOrder = findSpecialCraftTaskOrder(taskId)
  if (!taskOrder) throw new Error(`未找到特殊工艺任务：${taskId}`)
  const bindings = getSpecialCraftBindings(taskOrder.taskOrderId)
  const targetFeiTicketNos = payload.feiTicketNos?.length ? payload.feiTicketNos : bindings.map((binding) => binding.feiTicketNo)
  const firstBinding = bindings.find((binding) => targetFeiTicketNos.includes(binding.feiTicketNo))
  const sourceQty = firstBinding?.receivedQty || firstBinding?.currentQty || firstBinding?.openingQty || taskOrder.completedQty || taskOrder.planQty
  const completed = payload.completedQty ?? Math.max(sourceQty - (payload.scrapQty ?? 0) - (payload.damageQty ?? 0), 0)
  const linked = linkSpecialCraftCompletionToReturnWaitHandoverStock({
    taskOrderId: taskOrder.taskOrderId,
    completedFeiTicketNos: targetFeiTicketNos,
    completedQty: completed,
    scrapQty: payload.scrapQty,
    damageQty: payload.damageQty,
    operatorName: payload.operatorName || '现场操作员',
    completedAt: payload.operatedAt || nowTimestamp(),
  })
  const workOrderId = resolveSpecialCraftWorkOrderId(taskOrder)
  createWaitHandoverWarehouseRecord({
    craftType: 'SPECIAL_CRAFT',
    craftName: taskOrder.operationName,
    sourceWorkOrderId: workOrderId,
    sourceWorkOrderNo: taskOrder.taskOrderNo,
    sourceTaskId: taskOrder.taskOrderId,
    sourceTaskNo: taskOrder.taskOrderNo,
    sourceProductionOrderId: taskOrder.productionOrderId,
    sourceProductionOrderNo: taskOrder.productionOrderNo,
    sourceFactoryId: taskOrder.factoryId,
    sourceFactoryName: taskOrder.factoryName,
    targetFactoryId: taskOrder.sourceFactoryId,
    targetFactoryName: taskOrder.sourceFactoryName,
    targetWarehouseName: `${taskOrder.operationName}待交出仓`,
    warehouseLocation: `${taskOrder.operationName}待交出仓-B01`,
    skuSummary: taskOrder.partName || taskOrder.materialSku || taskOrder.operationName,
    materialSku: taskOrder.materialSku || '',
    materialName: taskOrder.partName || taskOrder.operationName,
    objectType: '裁片',
    plannedObjectQty: taskOrder.planQty,
    receivedObjectQty: completed,
    availableObjectQty: completed,
    qtyUnit: '片',
    currentActionName: '特殊工艺待交出',
    status: '待交出',
    inboundAt: payload.operatedAt || nowTimestamp(),
    relatedFeiTicketIds: targetFeiTicketNos,
    remark: '移动端完成特殊工艺后生成待交出仓记录',
  })
  return linked
}

export function submitSpecialCraftHandover(taskId: string, payload: ExecutionWritebackPayload & {
  feiTicketNos?: string[]
} = {}) {
  const taskOrder = findSpecialCraftTaskOrder(taskId)
  if (!taskOrder) throw new Error(`未找到特殊工艺任务：${taskId}`)
  const bindings = getSpecialCraftBindings(taskOrder.taskOrderId).filter((binding) => binding.specialCraftFlowStatus === '待回仓' || binding.returnHandoverRecordId)
  const selectedFeiTicketNos = payload.feiTicketNos?.length ? payload.feiTicketNos : bindings.map((binding) => binding.feiTicketNo)
  const firstBinding = bindings.find((binding) => selectedFeiTicketNos.includes(binding.feiTicketNo))
  if (!firstBinding) throw new Error('没有可交出的特殊工艺菲票')
  const handover = createSpecialCraftReturnHandover({
    specialCraftFactoryId: firstBinding.targetFactoryId,
    specialCraftFactoryName: firstBinding.targetFactoryName,
    cuttingFactoryId: 'ID-F001',
    cuttingFactoryName: '裁床厂待交出仓',
    operationId: firstBinding.operationId,
    operationName: firstBinding.operationName,
    selectedFeiTicketNos,
    operatorName: payload.operatorName || '现场操作员',
    submittedAt: payload.operatedAt || nowTimestamp(),
  })
  const workOrderId = resolveSpecialCraftWorkOrderId(taskOrder)
  const submittedQty = selectedFeiTicketNos.reduce((sum, feiTicketNo) => {
    const binding = bindings.find((item) => item.feiTicketNo === feiTicketNo)
    return sum + (binding?.currentQty || binding?.receivedQty || 0)
  }, 0)
  const unified = createProcessHandoverRecord({
    craftType: 'SPECIAL_CRAFT',
    craftName: taskOrder.operationName,
    sourceWorkOrderId: workOrderId,
    sourceWorkOrderNo: taskOrder.taskOrderNo,
    sourceTaskId: taskOrder.taskOrderId,
    sourceTaskNo: taskOrder.taskOrderNo,
    sourceProductionOrderId: taskOrder.productionOrderId,
    sourceProductionOrderNo: taskOrder.productionOrderNo,
    handoverFactoryId: firstBinding.targetFactoryId,
    handoverFactoryName: firstBinding.targetFactoryName,
    receiveFactoryId: 'ID-F001',
    receiveFactoryName: '裁床厂待交出仓',
    receiveWarehouseName: '裁床厂待交出仓',
    objectType: '裁片',
    handoverObjectQty: submittedQty,
    receiveObjectQty: submittedQty,
    diffObjectQty: 0,
    qtyUnit: '片',
    packageQty: selectedFeiTicketNos.length,
    packageUnit: '包',
    handoverPerson: payload.operatorName || '现场操作员',
    handoverAt: payload.operatedAt || nowTimestamp(),
    status: '待回写',
    remark: '移动端发起特殊工艺交出',
  })
  writeBackProcessHandoverRecord(unified.handoverRecordId, {
    receiveObjectQty: submittedQty,
    receivePerson: '裁床厂待交出仓',
    receiveAt: payload.operatedAt || nowTimestamp(),
    remark: '特殊工艺交出同步回写',
  })
  return handover
}

export function startPostFinishingAction(postOrderId: string, actionType: PostFinishingActionType, payload: ExecutionWritebackPayload = {}): PostFinishingWorkOrder {
  return applyPostFinishingActionStart({
    postOrderId,
    actionType,
    operatorName: payload.operatorName || '移动端操作员',
    startedAt: payload.operatedAt,
  })
}

export function finishPostFinishingAction(postOrderId: string, actionType: PostFinishingActionType, payload: ExecutionWritebackPayload & {
  submittedGarmentQty?: number
  acceptedGarmentQty?: number
  rejectedGarmentQty?: number
  diffGarmentQty?: number
} = {}): PostFinishingWorkOrder {
  const order = applyPostFinishingActionFinish({
    postOrderId,
    actionType,
    operatorName: payload.operatorName || '移动端操作员',
    finishedAt: payload.operatedAt,
    submittedGarmentQty: payload.submittedGarmentQty,
    acceptedGarmentQty: payload.acceptedGarmentQty,
    rejectedGarmentQty: payload.rejectedGarmentQty,
    diffGarmentQty: payload.diffGarmentQty,
    remark: payload.remark,
  })
  if (actionType === '复检') {
    createWaitHandoverWarehouseRecord({
      craftType: 'POST_FINISHING',
      craftName: '后道',
      sourceWorkOrderId: order.postOrderId,
      sourceWorkOrderNo: order.postOrderNo,
      sourceTaskId: order.sourceTaskId,
      sourceTaskNo: order.sourceTaskNo,
      sourceProductionOrderId: order.sourceProductionOrderId,
      sourceProductionOrderNo: order.sourceProductionOrderNo,
      sourceFactoryId: order.managedPostFactoryId,
      sourceFactoryName: order.managedPostFactoryName,
      targetFactoryId: order.managedPostFactoryId,
      targetFactoryName: order.managedPostFactoryName,
      targetWarehouseName: '后道交出仓',
      warehouseLocation: '后道交出仓-C01',
      skuSummary: order.skuSummary,
      styleNo: order.styleNo,
      objectType: '成衣',
      plannedObjectQty: order.plannedGarmentQty,
      receivedObjectQty: payload.acceptedGarmentQty ?? payload.submittedGarmentQty ?? order.plannedGarmentQty,
      availableObjectQty: payload.acceptedGarmentQty ?? payload.submittedGarmentQty ?? order.plannedGarmentQty,
      qtyUnit: '件',
      currentActionName: '后道待交出',
      status: '待交出',
      inboundAt: payload.operatedAt || nowTimestamp(),
      remark: '移动端复检完成后生成后道交出仓记录',
    })
  } else if (actionType === '后道' && order.routeMode === '非专门工厂含后道') {
    createWaitProcessWarehouseRecord({
      craftType: 'POST_FINISHING',
      craftName: '后道',
      sourceWorkOrderId: order.postOrderId,
      sourceWorkOrderNo: order.postOrderNo,
      sourceTaskId: order.sourceTaskId,
      sourceTaskNo: order.sourceTaskNo,
      sourceProductionOrderId: order.sourceProductionOrderId,
      sourceProductionOrderNo: order.sourceProductionOrderNo,
      sourceFactoryId: order.currentFactoryId,
      sourceFactoryName: order.currentFactoryName,
      targetFactoryId: order.managedPostFactoryId,
      targetFactoryName: order.managedPostFactoryName,
      targetWarehouseName: '后道待加工仓',
      warehouseLocation: '后道待加工仓-QC01',
      skuSummary: order.skuSummary,
      styleNo: order.styleNo,
      objectType: '成衣',
      plannedObjectQty: order.plannedGarmentQty,
      receivedObjectQty: payload.acceptedGarmentQty ?? payload.submittedGarmentQty ?? order.plannedGarmentQty,
      availableObjectQty: payload.acceptedGarmentQty ?? payload.submittedGarmentQty ?? order.plannedGarmentQty,
      qtyUnit: '件',
      currentActionName: '待质检',
      status: '已入仓',
      inboundAt: payload.operatedAt || nowTimestamp(),
      remark: '非专门工厂完成后道后转入后道工厂质检',
    })
  }
  return order
}

export function transferPostFinishedGarmentsToManagedPostFactory(postOrderId: string, payload: ExecutionWritebackPayload = {}): PostFinishingWorkOrder {
  return transferPostFinishingToManagedFactory({
    postOrderId,
    operatorName: payload.operatorName || '移动端操作员',
    transferredAt: payload.operatedAt,
    remark: payload.remark,
  })
}

export function receivePostFinishedGarmentsAtManagedPostFactory(postOrderId: string, payload: ExecutionWritebackPayload = {}): PostFinishingWorkOrder {
  return receivePostFinishingAtManagedFactory({
    postOrderId,
    operatorName: payload.operatorName || '后道工厂收货员',
    receivedAt: payload.operatedAt,
  })
}

export function createPostFinishingHandoverWarehouseRecord(postOrderId: string, payload: ExecutionWritebackPayload = {}): PostFinishingWaitHandoverWarehouseRecord {
  const record = ensurePostFinishingHandoverWarehouseRecord({
    postOrderId,
    createdAt: payload.operatedAt,
  })
  const order = getPostFinishingWorkOrderById(postOrderId)
  if (order) {
    createWaitHandoverWarehouseRecord({
      craftType: 'POST_FINISHING',
      craftName: '后道',
      sourceWorkOrderId: order.postOrderId,
      sourceWorkOrderNo: order.postOrderNo,
      sourceTaskId: order.sourceTaskId,
      sourceTaskNo: order.sourceTaskNo,
      sourceProductionOrderId: order.sourceProductionOrderId,
      sourceProductionOrderNo: order.sourceProductionOrderNo,
      sourceFactoryId: order.managedPostFactoryId,
      sourceFactoryName: order.managedPostFactoryName,
      targetFactoryId: order.managedPostFactoryId,
      targetFactoryName: order.managedPostFactoryName,
      targetWarehouseName: '后道交出仓',
      warehouseLocation: '后道交出仓-C01',
      skuSummary: order.skuSummary,
      styleNo: order.styleNo,
      objectType: '成衣',
      plannedObjectQty: order.plannedGarmentQty,
      receivedObjectQty: record.availableHandoverGarmentQty,
      availableObjectQty: record.availableHandoverGarmentQty,
      qtyUnit: '件',
      currentActionName: '后道待交出',
      status: '待交出',
      inboundAt: payload.operatedAt || nowTimestamp(),
      remark: '复检完成后生成后道交出仓记录',
    })
  }
  return record
}

export function submitPostFinishingHandover(postOrderId: string, payload: ExecutionWritebackPayload & {
  submittedGarmentQty?: number
  writtenBackGarmentQty?: number
} = {}): PostFinishingWorkOrder {
  const order = submitPostFinishingHandoverRecord({
    postOrderId,
    operatorName: payload.operatorName || '移动端操作员',
    submittedAt: payload.operatedAt,
    submittedGarmentQty: payload.submittedGarmentQty,
    writtenBackGarmentQty: payload.writtenBackGarmentQty,
  })
  const submittedQty = payload.submittedGarmentQty ?? order.recheckAction?.acceptedGarmentQty ?? order.plannedGarmentQty
  const unified = createProcessHandoverRecord({
    craftType: 'POST_FINISHING',
    craftName: '后道',
    sourceWorkOrderId: order.postOrderId,
    sourceWorkOrderNo: order.postOrderNo,
    sourceTaskId: order.sourceTaskId,
    sourceTaskNo: order.sourceTaskNo,
    sourceProductionOrderId: order.sourceProductionOrderId,
    sourceProductionOrderNo: order.sourceProductionOrderNo,
    handoverFactoryId: order.managedPostFactoryId,
    handoverFactoryName: order.managedPostFactoryName,
    receiveFactoryId: order.managedPostFactoryId,
    receiveFactoryName: order.managedPostFactoryName,
    receiveWarehouseName: '后道交出仓',
    objectType: '成衣',
    handoverObjectQty: submittedQty,
    receiveObjectQty: payload.writtenBackGarmentQty ?? submittedQty,
    diffObjectQty: submittedQty - (payload.writtenBackGarmentQty ?? submittedQty),
    qtyUnit: '件',
    packageQty: 1,
    packageUnit: '箱',
    handoverPerson: payload.operatorName || '移动端操作员',
    handoverAt: payload.operatedAt || nowTimestamp(),
    status: '待回写',
    remark: '移动端发起后道交出',
  })
  writeBackProcessHandoverRecord(unified.handoverRecordId, {
    receiveObjectQty: payload.writtenBackGarmentQty ?? submittedQty,
    receivePerson: order.managedPostFactoryName,
    receiveAt: payload.operatedAt || nowTimestamp(),
    remark: '后道交出同步回写',
  })
  return order
}

export function getPostFinishingWorkOrderForMobile(execId: string): PostFinishingWorkOrder | undefined {
  return getPostFinishingWorkOrderById(execId) || getPostFinishingWorkOrderBySourceTaskId(execId)
}
