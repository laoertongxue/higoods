import { getDyeExecutionNodeRecord, getDyeWorkOrderById, getDyeWorkOrderStatusLabel } from './dyeing-task-domain.ts'
import {
  findPdaHandoverRecord,
  getHandoverOrderById,
  getPdaHandoverRecordsByHead,
  getPdaPickupRecordsByHead,
  listPdaHandoverHeads,
  type HandoverObjectType,
  type HandoverRecordLine,
  type PdaHandoverHead,
  type PdaHandoverRecord,
} from './pda-handover-events.ts'
import { listPdaGenericProcessTasks, type PdaGenericTaskMock } from './pda-task-mock-factory.ts'
import {
  getHandoverObjectTypeLabel,
  getHandoverOrderStatusLabel,
  getHandoverRecordQrDisplayValue,
  getReceiverDisplayName,
  getRecordSubmittedQty,
} from './task-handover-domain.ts'
import {
  getPrintExecutionNodeRecord,
  getPrintWorkOrderById,
  getPrintWorkOrderStatusLabel,
} from './printing-task-domain.ts'
import {
  buildProductionConfirmationSnapshot,
  type ProductionConfirmationImage,
  type ProductionConfirmationSnapshot,
} from './production-confirmation.ts'
import { buildTaskQrValue } from './task-qr.ts'
import {
  getRuntimeTaskById,
  listRuntimeExecutionTasksByOrder,
  type RuntimeProcessTask,
} from './runtime-process-tasks.ts'
import {
  getSpecialCraftTaskOrderById,
  type SpecialCraftTaskNodeRecord,
} from './special-craft-task-orders.ts'

export const TASK_DELIVERY_CARD_NAME = '任务交货卡'
export const TASK_ROUTE_CARD_NAME = '任务流转卡'

export type TaskRouteCardSourceType =
  | 'RUNTIME_TASK'
  | 'PRINTING_WORK_ORDER'
  | 'DYEING_WORK_ORDER'
  | 'SPECIAL_CRAFT_TASK_ORDER'
  | 'CUTTING_ORIGINAL_ORDER'
  | 'CUTTING_MERGE_BATCH'

export interface TaskPrintImage {
  title: string
  url: string
  sourceLabel: string
}

export interface TaskDeliveryCardLine {
  lineId: string
  objectTypeLabel: string
  itemName: string
  materialOrSku: string
  color: string
  size: string
  partName: string
  carrierNo: string
  submittedQty: number
  qtyUnit: string
}

export interface TaskDeliveryCardModel {
  cardName: typeof TASK_DELIVERY_CARD_NAME
  handoverOrderId: string
  handoverOrderNo: string
  handoverRecordId: string
  handoverRecordNo: string
  deliverySequenceNo: number
  deliverySequenceLabel: string
  taskId: string
  taskNo: string
  productionOrderNo: string
  processName: string
  craftName: string
  upstreamFactoryName: string
  downstreamFactoryName: string
  submittedQty: number
  qtyUnit: string
  submittedAt: string
  submittedBy: string
  statusLabel: string
  remark: string
  qrValue: string
  image: TaskPrintImage
  lines: TaskDeliveryCardLine[]
}

export interface TaskRouteCardRecordRow {
  rowId: string
  node: string
  startedAt: string
  finishedAt: string
  completedQty: string
  exceptionQty: string
  station: string
  operator: string
  remark: string
}

export interface TaskRouteCardModel {
  cardName: typeof TASK_ROUTE_CARD_NAME
  sourceType: TaskRouteCardSourceType
  sourceId: string
  sourceLabel: string
  taskId: string
  taskNo: string
  productionOrderNo: string
  processName: string
  craftName: string
  factoryName: string
  statusLabel: string
  plannedQty: number
  qtyUnit: string
  dueAt: string
  qrValue: string
  image: TaskPrintImage
  summaryRemark: string
  supplementalItems: Array<{ label: string; value: string }>
  routeRecords: TaskRouteCardRecordRow[]
}

export interface TaskPrintBuildFailure {
  ok: false
  title: string
  message: string
}

export type TaskDeliveryCardBuildResult =
  | { ok: true; card: TaskDeliveryCardModel }
  | TaskPrintBuildFailure

export type TaskRouteCardBuildResult =
  | { ok: true; card: TaskRouteCardModel }
  | TaskPrintBuildFailure

const TASK_STATUS_LABEL: Record<RuntimeProcessTask['status'], string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS: '进行中',
  DONE: '已完成',
  BLOCKED: '已暂停',
  CANCELLED: '已取消',
}

const ASSIGNMENT_STATUS_LABEL: Record<RuntimeProcessTask['assignmentStatus'], string> = {
  UNASSIGNED: '待分配',
  ASSIGNING: '分配中',
  ASSIGNED: '已分配',
  BIDDING: '竞价中',
  AWARDED: '已中标',
}

function toText(value: string | number | undefined | null, fallback = '待确认'): string {
  if (value === undefined || value === null) return fallback
  const text = String(value).trim()
  return text || fallback
}

function toNumber(value: number | undefined | null): number {
  return Number.isFinite(value) ? Number(value) : 0
}

function buildSystemPlaceholderImage(title = '系统占位图'): TaskPrintImage {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
      <rect width="640" height="420" fill="#f8fafc"/>
      <rect x="36" y="36" width="568" height="348" rx="20" fill="#ffffff" stroke="#cbd5e1" stroke-width="3" stroke-dasharray="14 12"/>
      <circle cx="190" cy="156" r="44" fill="#dbeafe"/>
      <path d="M96 320 232 214l84 72 78-58 150 92H96Z" fill="#bfdbfe"/>
      <text x="320" y="156" text-anchor="middle" font-size="34" font-family="Arial, sans-serif" font-weight="700" fill="#334155">${title}</text>
      <text x="320" y="204" text-anchor="middle" font-size="22" font-family="Arial, sans-serif" fill="#64748b">打印图片区</text>
    </svg>
  `

  return {
    title,
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    sourceLabel: '系统占位图',
  }
}

function safeBuildProductionSnapshot(productionOrderId: string): ProductionConfirmationSnapshot | null {
  try {
    return buildProductionConfirmationSnapshot(productionOrderId)
  } catch {
    return null
  }
}

function firstImage(title: string, images: ProductionConfirmationImage[] | undefined, sourceLabel: string): TaskPrintImage | null {
  const image = images?.find((item) => item.url.trim().length > 0)
  if (!image) return null
  return {
    title: image.label || title,
    url: image.url,
    sourceLabel,
  }
}

function resolveTaskSpecificImage(
  snapshot: ProductionConfirmationSnapshot | null,
  processName: string,
  craftName: string,
): TaskPrintImage | null {
  const text = `${processName} ${craftName}`
  if (text.includes('印花') || text.toLowerCase().includes('print')) {
    return firstImage('花型图', snapshot?.imageSnapshot.artworkImages, '任务特有图：花型图')
  }
  if (text.includes('染色') || text.toLowerCase().includes('dye')) {
    return firstImage('色样图', snapshot?.imageSnapshot.sampleImages, '任务特有图：色样图')
  }
  if (text.includes('裁') || text.toLowerCase().includes('cut')) {
    return firstImage('唛架图', snapshot?.imageSnapshot.markerImages, '任务特有图：唛架图')
  }
  if (text.includes('特殊') || text.includes('绣') || text.includes('洗') || text.includes('烫')) {
    return (
      firstImage('工艺参考图', snapshot?.imageSnapshot.artworkImages, '任务特有图：工艺参考图')
      || firstImage('工艺参考图', snapshot?.imageSnapshot.patternImages, '任务特有图：工艺参考图')
    )
  }
  return null
}

function resolvePrintImage(input: {
  productionOrderId: string
  processName: string
  craftName?: string
}): TaskPrintImage {
  const snapshot = safeBuildProductionSnapshot(input.productionOrderId)
  return (
    firstImage('商品图片', snapshot?.imageSnapshot.productImages, '商品主图')
    || firstImage('款图', snapshot?.imageSnapshot.styleImages, '款图')
    || resolveTaskSpecificImage(snapshot, input.processName, input.craftName || '')
    || buildSystemPlaceholderImage()
  )
}

function getRuntimeTaskProductionOrderId(taskId: string, fallbackOrderNo: string): string {
  const task = getRuntimeTaskById(taskId)
  return task?.productionOrderId || fallbackOrderNo
}

function getHandoverRecordStatusLabel(record: PdaHandoverRecord): string {
  if (record.handoverRecordStatus === 'SUBMITTED_WAIT_WRITEBACK' || record.status === 'PENDING_WRITEBACK') return '待回写'
  if (record.handoverRecordStatus === 'WRITTEN_BACK_MATCHED' || record.status === 'WRITTEN_BACK') return '已回写'
  if (record.handoverRecordStatus === 'WRITTEN_BACK_DIFF') return '差异待确认'
  if (record.handoverRecordStatus === 'DIFF_ACCEPTED') return '已接受差异'
  if (record.handoverRecordStatus === 'OBJECTION_REPORTED' || record.status === 'OBJECTION_REPORTED') return '已发起异议'
  if (record.handoverRecordStatus === 'OBJECTION_PROCESSING' || record.status === 'OBJECTION_PROCESSING') return '异议处理中'
  if (record.handoverRecordStatus === 'OBJECTION_RESOLVED' || record.status === 'OBJECTION_RESOLVED') return '异议已处理'
  return '待回写'
}

function getHandoverSummaryStatusLabel(status: PdaHandoverHead['summaryStatus']): string {
  if (status === 'NONE') return '暂无记录'
  if (status === 'SUBMITTED') return '已提交'
  if (status === 'PARTIAL_WRITTEN_BACK') return '部分回写'
  if (status === 'WRITTEN_BACK') return '已回写'
  if (status === 'HAS_OBJECTION') return '存在异议'
  return '待确认'
}

function findRecordInHead(head: PdaHandoverHead, handoverRecordId: string): PdaHandoverRecord | undefined {
  return getPdaHandoverRecordsByHead(head.handoverId).find((record) =>
    record.recordId === handoverRecordId
    || record.handoverRecordId === handoverRecordId
    || record.handoverRecordNo === handoverRecordId,
  )
}

function fallbackRecordLine(record: PdaHandoverRecord): HandoverRecordLine {
  return {
    lineId: `${record.recordId}-LINE-001`,
    handoverRecordId: record.handoverRecordId || record.recordId,
    objectType: (record.objectType || 'FINISHED_GARMENT') as HandoverObjectType,
    materialSku: record.materialCode,
    garmentSkuCode: record.skuCode,
    garmentColor: record.skuColor,
    sizeCode: record.skuSize,
    partName: record.pieceName,
    submittedQty: getRecordSubmittedQty(record),
    qtyUnit: record.qtyUnit || '件',
  }
}

function buildDeliveryCardLines(record: PdaHandoverRecord): TaskDeliveryCardLine[] {
  const lines = record.recordLines && record.recordLines.length > 0 ? record.recordLines : [fallbackRecordLine(record)]
  return lines.map((line) => ({
    lineId: line.lineId,
    objectTypeLabel: getHandoverObjectTypeLabel(line.objectType),
    itemName: line.partName || record.materialName || record.handoutItemLabel || '交出明细',
    materialOrSku: line.materialSku || line.garmentSkuCode || record.materialCode || record.skuCode || '待确认',
    color: line.fabricColor || line.garmentColor || record.skuColor || '待确认',
    size: line.sizeCode || record.skuSize || '待确认',
    partName: line.partName || record.pieceName || '待确认',
    carrierNo: line.fabricRollNo || line.feiTicketNo || line.bundleNo || '待确认',
    submittedQty: toNumber(line.submittedQty),
    qtyUnit: line.qtyUnit || record.qtyUnit || '件',
  }))
}

export function buildTaskDeliveryCardByRecord(
  handoverOrderId: string,
  handoverRecordId: string,
): TaskDeliveryCardBuildResult {
  const head = getHandoverOrderById(handoverOrderId)
  if (!head || head.headType !== 'HANDOUT') {
    return {
      ok: false,
      title: TASK_DELIVERY_CARD_NAME,
      message: `未找到交出单：${handoverOrderId}`,
    }
  }

  const record = findRecordInHead(head, handoverRecordId) || findPdaHandoverRecord(handoverRecordId)
  if (!record || record.handoverId !== head.handoverId) {
    return {
      ok: false,
      title: TASK_DELIVERY_CARD_NAME,
      message: `未找到交出记录：${handoverRecordId}`,
    }
  }

  const productionOrderId = getRuntimeTaskProductionOrderId(head.taskId, head.productionOrderNo)
  const submittedQty = getRecordSubmittedQty(record)

  return {
    ok: true,
    card: {
      cardName: TASK_DELIVERY_CARD_NAME,
      handoverOrderId: head.handoverOrderId || head.handoverId,
      handoverOrderNo: head.handoverOrderNo || head.handoverOrderId || head.handoverId,
      handoverRecordId: record.handoverRecordId || record.recordId,
      handoverRecordNo: record.handoverRecordNo || record.handoverRecordId || record.recordId,
      deliverySequenceNo: record.sequenceNo,
      deliverySequenceLabel: `第 ${record.sequenceNo} 次交货`,
      taskId: head.taskId,
      taskNo: head.taskNo || head.taskId,
      productionOrderNo: head.productionOrderNo,
      processName: head.processBusinessName || head.processName,
      craftName: head.craftName || head.taskTypeLabel || '待确认',
      upstreamFactoryName: head.sourceFactoryName,
      downstreamFactoryName: getReceiverDisplayName(head),
      submittedQty,
      qtyUnit: record.qtyUnit || head.qtyUnit || '件',
      submittedAt: record.factorySubmittedAt,
      submittedBy: record.factorySubmittedBy || '工厂操作员',
      statusLabel: getHandoverRecordStatusLabel(record),
      remark: record.factoryRemark || record.receiverRemark || record.diffReason || '无',
      qrValue: getHandoverRecordQrDisplayValue(record),
      image: resolvePrintImage({
        productionOrderId,
        processName: head.processBusinessName || head.processName,
        craftName: head.craftName,
      }),
      lines: buildDeliveryCardLines(record),
    },
  }
}

function buildRuntimeRouteRows(task: RuntimeProcessTask): TaskRouteCardRecordRow[] {
  const tasks = listRuntimeExecutionTasksByOrder(task.productionOrderId)
    .sort((left, right) => left.seq - right.seq || left.taskId.localeCompare(right.taskId))

  return tasks.map((row) => ({
    rowId: row.taskId,
    node: row.craftName || row.processBusinessName || row.processNameZh,
    startedAt: row.startedAt || '',
    finishedAt: row.finishedAt || '',
    completedQty: row.status === 'DONE' ? `${row.qty} ${row.qtyUnit === 'PIECE' ? '件' : row.qtyUnit}` : '',
    exceptionQty: row.status === 'BLOCKED' ? `${row.qty} ${row.qtyUnit === 'PIECE' ? '件' : row.qtyUnit}` : '0',
    station: row.assignedFactoryName || row.assignedFactoryId || '',
    operator: row.acceptedBy || row.dispatchedBy || '',
    remark: row.blockRemark || row.dispatchRemark || (row.taskId === task.taskId ? '当前打印任务' : ''),
  }))
}

function buildHandoverRouteRows(taskId: string): TaskRouteCardRecordRow[] {
  return listPdaHandoverHeads()
    .filter((head) => head.taskId === taskId)
    .flatMap((head) => {
      if (head.headType === 'PICKUP') {
        return getPdaPickupRecordsByHead(head.handoverId).map((record) => ({
          rowId: record.recordId,
          node: `领料第 ${record.sequenceNo} 次`,
          startedAt: record.submittedAt,
          finishedAt: record.receivedAt || record.factoryConfirmedAt || record.finalResolvedAt || '',
          completedQty: typeof record.factoryConfirmedQty === 'number' || typeof record.finalResolvedQty === 'number'
            ? `${record.factoryConfirmedQty ?? record.finalResolvedQty} ${record.qtyUnit}`
            : '',
          exceptionQty: record.objectionReason ? `${record.factoryReportedQty ?? record.qtyActual ?? 0} ${record.qtyUnit}` : '0',
          station: record.pickupModeLabel,
          operator: record.warehouseHandedBy || '',
          remark: record.remark || record.objectionRemark || '',
        }))
      }

      return getPdaHandoverRecordsByHead(head.handoverId).map((record) => ({
        rowId: record.recordId,
        node: `交出第 ${record.sequenceNo} 次`,
        startedAt: record.factorySubmittedAt,
        finishedAt: record.receiverWrittenAt || record.warehouseWrittenAt || '',
        completedQty: `${record.submittedQty ?? record.plannedQty ?? 0} ${record.qtyUnit || head.qtyUnit}`,
        exceptionQty: typeof record.diffQty === 'number' && record.diffQty !== 0 ? `${Math.abs(record.diffQty)} ${record.qtyUnit || head.qtyUnit}` : '0',
        station: getReceiverDisplayName(head),
        operator: record.factorySubmittedBy || record.receiverWrittenBy || '',
        remark: record.factoryRemark || record.receiverRemark || record.diffReason || '',
      }))
    })
}

function buildRouteCardFromGenericTask(task: PdaGenericTaskMock): TaskRouteCardBuildResult {
  return {
    ok: true,
    card: {
      cardName: TASK_ROUTE_CARD_NAME,
      sourceType: 'RUNTIME_TASK',
      sourceId: task.taskId,
      sourceLabel: '任务进度看板',
      taskId: task.taskId,
      taskNo: task.taskNo || task.taskId,
      productionOrderNo: task.productionOrderNo || task.productionOrderId,
      processName: task.processBusinessName || task.processNameZh,
      craftName: task.craftName || task.taskTypeLabel || task.taskCategoryZh || '待确认',
      factoryName: task.assignedFactoryName || task.assignedFactoryId || '待确认',
      statusLabel: TASK_STATUS_LABEL[task.status],
      plannedQty: task.qty,
      qtyUnit: task.qtyUnit === 'PIECE' ? '件' : task.qtyUnit,
      dueAt: task.taskDeadline || task.requiredDeliveryDate || '待确认',
      qrValue: task.taskQrValue || buildTaskQrValue(task.taskId),
      image: resolvePrintImage({
        productionOrderId: task.productionOrderId || task.productionOrderNo,
        processName: task.processBusinessName || task.processNameZh,
        craftName: task.craftName,
      }),
      summaryRemark: task.mockExecutionSummary || task.dispatchRemark || '按任务进度看板当前数据生成',
      supplementalItems: [
        { label: '来源类型', value: '任务进度看板任务' },
        { label: '任务范围', value: task.scopeLabel || task.stageName || '整单任务' },
        { label: '分配状态', value: ASSIGNMENT_STATUS_LABEL[task.assignmentStatus] },
        { label: '分配方式', value: task.assignmentMode === 'DIRECT' ? '派单' : '竞价' },
        { label: '交接摘要', value: task.mockHandoverSummary || '待确认' },
        { label: '接收状态', value: task.mockReceiveSummary || '待确认' },
      ],
      routeRecords: buildHandoverRouteRows(task.taskId),
    },
  }
}

function buildRouteCardFromHandoverTask(head: PdaHandoverHead): TaskRouteCardBuildResult {
  return {
    ok: true,
    card: {
      cardName: TASK_ROUTE_CARD_NAME,
      sourceType: 'RUNTIME_TASK',
      sourceId: head.taskId,
      sourceLabel: '任务进度看板',
      taskId: head.taskId,
      taskNo: head.taskNo || head.taskId,
      productionOrderNo: head.productionOrderNo,
      processName: head.processBusinessName || head.processName,
      craftName: head.craftName || head.taskTypeLabel || '待确认',
      factoryName: head.sourceFactoryName,
      statusLabel: head.taskStatus === 'DONE' ? '已完成' : '进行中',
      plannedQty: head.plannedQty ?? head.qtyExpectedTotal,
      qtyUnit: head.qtyUnit,
      dueAt: head.lastRecordAt || head.completedByWarehouseAt || '待确认',
      qrValue: buildTaskQrValue(head.taskId),
      image: resolvePrintImage({
        productionOrderId: head.productionOrderNo,
        processName: head.processBusinessName || head.processName,
        craftName: head.craftName,
      }),
      summaryRemark: head.scopeLabel || '按交接链路任务数据生成',
      supplementalItems: [
        { label: '来源类型', value: '任务进度看板任务' },
        { label: '任务范围', value: head.scopeLabel || head.stageName || '整单任务' },
        { label: '接收方', value: getReceiverDisplayName(head) },
        { label: '交出单状态', value: head.handoverOrderStatus ? getHandoverOrderStatusLabel(head.handoverOrderStatus) : getHandoverSummaryStatusLabel(head.summaryStatus) },
        { label: '累计交出', value: `${head.submittedQtyTotal ?? 0} ${head.qtyUnit}` },
        { label: '累计回写', value: `${head.writtenBackQtyTotal ?? 0} ${head.qtyUnit}` },
      ],
      routeRecords: buildHandoverRouteRows(head.taskId),
    },
  }
}

function buildRouteCardFromRuntimeTask(sourceId: string): TaskRouteCardBuildResult {
  const task = getRuntimeTaskById(sourceId)
  if (!task) {
    const genericTask = listPdaGenericProcessTasks().find((item) => item.taskId === sourceId)
    if (genericTask) return buildRouteCardFromGenericTask(genericTask)

    const handoverHead = listPdaHandoverHeads().find((head) => head.taskId === sourceId)
    if (handoverHead) return buildRouteCardFromHandoverTask(handoverHead)

    return {
      ok: false,
      title: TASK_ROUTE_CARD_NAME,
      message: `未找到任务：${sourceId}`,
    }
  }

  return {
    ok: true,
    card: {
      cardName: TASK_ROUTE_CARD_NAME,
      sourceType: 'RUNTIME_TASK',
      sourceId,
      sourceLabel: '任务进度看板',
      taskId: task.taskId,
      taskNo: task.taskNo || task.taskId,
      productionOrderNo: task.productionOrderId,
      processName: task.processBusinessName || task.processNameZh,
      craftName: task.craftName || task.taskCategoryZh || '待确认',
      factoryName: task.assignedFactoryName || task.assignedFactoryId || '待确认',
      statusLabel: TASK_STATUS_LABEL[task.status],
      plannedQty: task.qty,
      qtyUnit: task.qtyUnit === 'PIECE' ? '件' : task.qtyUnit,
      dueAt: task.taskDeadline || task.acceptDeadline || '待确认',
      qrValue: task.taskQrValue || buildTaskQrValue(task.taskId),
      image: resolvePrintImage({
        productionOrderId: task.productionOrderId,
        processName: task.processBusinessName || task.processNameZh,
        craftName: task.craftName,
      }),
      summaryRemark: task.dispatchRemark || task.blockRemark || '按任务进度看板当前数据生成',
      supplementalItems: [
        { label: '来源类型', value: '任务进度看板任务' },
        { label: '任务范围', value: task.scopeLabel || task.stageName || '整单任务' },
        { label: '分配状态', value: ASSIGNMENT_STATUS_LABEL[task.assignmentStatus] },
        { label: '分配方式', value: task.assignmentMode === 'DIRECT' ? '派单' : '竞价' },
        { label: '上游衔接', value: task.transitionFromPrev === 'SAME_FACTORY_CONTINUE' ? '同厂连续加工' : task.transitionFromPrev === 'RETURN_TO_WAREHOUSE' ? '先回仓再流转' : '无上游要求' },
        { label: '下游衔接', value: task.transitionToNext === 'SAME_FACTORY_CONTINUE' ? '同厂连续加工' : task.transitionToNext === 'RETURN_TO_WAREHOUSE' ? '完成后回仓' : '无下游要求' },
      ],
      routeRecords: buildRuntimeRouteRows(task),
    },
  }
}

function buildRouteCardFromPrintWorkOrder(sourceId: string): TaskRouteCardBuildResult {
  const order = getPrintWorkOrderById(sourceId)
  if (!order) return { ok: false, title: TASK_ROUTE_CARD_NAME, message: `未找到印花加工单：${sourceId}` }
  const nodes = ['COLOR_TEST', 'PRINT', 'TRANSFER', 'HANDOVER', 'REVIEW'] as const

  return {
    ok: true,
    card: {
      cardName: TASK_ROUTE_CARD_NAME,
      sourceType: 'PRINTING_WORK_ORDER',
      sourceId,
      sourceLabel: '印花加工单',
      taskId: order.taskId,
      taskNo: order.taskNo,
      productionOrderNo: order.productionOrderIds[0] || '待确认',
      processName: '印花',
      craftName: order.patternNo,
      factoryName: order.printFactoryName,
      statusLabel: getPrintWorkOrderStatusLabel(order.status),
      plannedQty: order.plannedQty,
      qtyUnit: order.qtyUnit,
      dueAt: order.updatedAt,
      qrValue: order.taskQrValue || buildTaskQrValue(order.taskId),
      image: resolvePrintImage({ productionOrderId: order.productionOrderIds[0] || '', processName: '印花', craftName: order.patternNo }),
      summaryRemark: order.remark || '印花加工单生成',
      supplementalItems: [
        { label: '来源类型', value: '印花加工单' },
        { label: '加工单号', value: order.printOrderNo },
        { label: '花型版本', value: `${order.patternNo} / ${order.patternVersion}` },
        { label: '接收方', value: order.receiverName },
      ],
      routeRecords: nodes.map((node) => {
        const record = getPrintExecutionNodeRecord(order.printOrderId, node)
        return {
          rowId: `${order.printOrderId}-${node}`,
          node: record?.nodeName || node,
          startedAt: record?.startedAt || '',
          finishedAt: record?.finishedAt || '',
          completedQty: typeof record?.outputQty === 'number' ? `${record.outputQty} ${record.qtyUnit}` : '',
          exceptionQty: typeof record?.wasteQty === 'number' ? `${record.wasteQty} ${record.qtyUnit}` : '0',
          station: record?.printerNo || record?.deviceId || '',
          operator: record?.operatorName || '',
          remark: record?.remark || '',
        }
      }),
    },
  }
}

function buildRouteCardFromDyeWorkOrder(sourceId: string): TaskRouteCardBuildResult {
  const order = getDyeWorkOrderById(sourceId)
  if (!order) return { ok: false, title: TASK_ROUTE_CARD_NAME, message: `未找到染色加工单：${sourceId}` }
  const nodes = ['SAMPLE', 'MATERIAL_READY', 'VAT_PLAN', 'DYE', 'DEHYDRATE', 'DRY', 'SET', 'ROLL', 'PACK', 'HANDOVER', 'REVIEW'] as const

  return {
    ok: true,
    card: {
      cardName: TASK_ROUTE_CARD_NAME,
      sourceType: 'DYEING_WORK_ORDER',
      sourceId,
      sourceLabel: '染色加工单',
      taskId: order.taskId,
      taskNo: order.taskNo,
      productionOrderNo: order.productionOrderIds?.[0] || '待确认',
      processName: '染色',
      craftName: order.targetColor,
      factoryName: order.dyeFactoryName,
      statusLabel: getDyeWorkOrderStatusLabel(order.status),
      plannedQty: order.plannedQty,
      qtyUnit: order.qtyUnit,
      dueAt: order.updatedAt,
      qrValue: order.taskQrValue || buildTaskQrValue(order.taskId),
      image: resolvePrintImage({ productionOrderId: order.productionOrderIds?.[0] || '', processName: '染色', craftName: order.targetColor }),
      summaryRemark: order.remark || order.waitingReason || '染色加工单生成',
      supplementalItems: [
        { label: '来源类型', value: '染色加工单' },
        { label: '加工单号', value: order.dyeOrderNo },
        { label: '目标颜色', value: order.targetColor },
        { label: '接收方', value: order.receiverName },
      ],
      routeRecords: nodes.map((node) => {
        const record = getDyeExecutionNodeRecord(order.dyeOrderId, node)
        return {
          rowId: `${order.dyeOrderId}-${node}`,
          node: record?.nodeName || node,
          startedAt: record?.startedAt || '',
          finishedAt: record?.finishedAt || '',
          completedQty: typeof record?.outputQty === 'number' ? `${record.outputQty} ${record.qtyUnit}` : '',
          exceptionQty: typeof record?.lossQty === 'number' ? `${record.lossQty} ${record.qtyUnit}` : '0',
          station: record?.dyeVatNo || record?.deviceId || '',
          operator: record?.operatorName || '',
          remark: record?.remark || '',
        }
      }),
    },
  }
}

function mapSpecialCraftNodeRecord(record: SpecialCraftTaskNodeRecord): TaskRouteCardRecordRow {
  return {
    rowId: record.nodeRecordId,
    node: record.nodeName,
    startedAt: record.operatedAt,
    finishedAt: record.afterStatus === '已完成' || record.afterStatus === '已交出' ? record.operatedAt : '',
    completedQty: `${record.qty} ${record.unit}`,
    exceptionQty: record.afterStatus.includes('差异') || record.afterStatus.includes('异议') ? `${record.qty} ${record.unit}` : '0',
    station: record.relatedRecordType || '',
    operator: record.operatorName,
    remark: record.remark || record.actionName,
  }
}

function buildRouteCardFromSpecialCraftTaskOrder(sourceId: string): TaskRouteCardBuildResult {
  const order = getSpecialCraftTaskOrderById(sourceId)
  if (!order) return { ok: false, title: TASK_ROUTE_CARD_NAME, message: `未找到特殊工艺任务单：${sourceId}` }

  return {
    ok: true,
    card: {
      cardName: TASK_ROUTE_CARD_NAME,
      sourceType: 'SPECIAL_CRAFT_TASK_ORDER',
      sourceId,
      sourceLabel: '特殊工艺任务单',
      taskId: order.sourceTaskId || order.taskOrderId,
      taskNo: order.sourceTaskNo || order.taskOrderNo,
      productionOrderNo: order.productionOrderNo || order.productionOrderId,
      processName: order.processName,
      craftName: order.craftName || order.operationName,
      factoryName: order.factoryName,
      statusLabel: order.executionStatusLabel || order.status,
      plannedQty: order.planQty,
      qtyUnit: order.unit,
      dueAt: order.dueAt,
      qrValue: buildTaskQrValue(order.sourceTaskId || order.taskOrderId),
      image: resolvePrintImage({ productionOrderId: order.productionOrderId, processName: order.processName, craftName: order.craftName }),
      summaryRemark: order.remark || '特殊工艺任务单生成',
      supplementalItems: [
        { label: '来源类型', value: '特殊工艺任务单' },
        { label: '任务单号', value: order.taskOrderNo },
        { label: '作用对象', value: order.targetObject },
        { label: '部位', value: order.partName || '待确认' },
      ],
      routeRecords: order.nodeRecords.map(mapSpecialCraftNodeRecord),
    },
  }
}

export function buildTaskRouteCardBySource(
  sourceType: TaskRouteCardSourceType,
  sourceId: string,
): TaskRouteCardBuildResult {
  switch (sourceType) {
    case 'RUNTIME_TASK':
      return buildRouteCardFromRuntimeTask(sourceId)
    case 'PRINTING_WORK_ORDER':
      return buildRouteCardFromPrintWorkOrder(sourceId)
    case 'DYEING_WORK_ORDER':
      return buildRouteCardFromDyeWorkOrder(sourceId)
    case 'SPECIAL_CRAFT_TASK_ORDER':
      return buildRouteCardFromSpecialCraftTaskOrder(sourceId)
    case 'CUTTING_ORIGINAL_ORDER':
    case 'CUTTING_MERGE_BATCH':
      return {
        ok: false,
        title: TASK_ROUTE_CARD_NAME,
        message: '当前来源类型已预留，入口将在后续步骤接入。',
      }
    default: {
      const _exhaustive: never = sourceType
      return _exhaustive
    }
  }
}

export function isTaskRouteCardSourceType(value: string): value is TaskRouteCardSourceType {
  return (
    value === 'RUNTIME_TASK'
    || value === 'PRINTING_WORK_ORDER'
    || value === 'DYEING_WORK_ORDER'
    || value === 'SPECIAL_CRAFT_TASK_ORDER'
    || value === 'CUTTING_ORIGINAL_ORDER'
    || value === 'CUTTING_MERGE_BATCH'
  )
}
