import {
  getDyeWorkOrderById,
  getDyeWorkOrderStatusLabel,
  listDyeExecutionNodeRecords,
} from './dyeing-task-domain.ts'
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
  getRecordDiffQty,
  getRecordReceiverWrittenAt,
  getRecordReceiverWrittenBy,
  getRecordReceiverWrittenQty,
  getHandoverObjectTypeLabel,
  getHandoverOrderStatusLabel,
  getHandoverRecordQrDisplayValue,
  getReceiverDisplayName,
  getRecordSubmittedQty,
} from './task-handover-domain.ts'
import {
  getPrintWorkOrderById,
  getPrintWorkOrderStatusLabel,
  listPrintExecutionNodeRecords,
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
import { getPostFinishingWorkOrderById, type PostFinishingActionRecord } from './post-finishing-domain.ts'
import {
  getCuttingMergeBatchTaskPrintSourceById,
  getCuttingOriginalOrderTaskPrintSourceById,
} from './cutting-task-print-source.ts'

export const TASK_DELIVERY_CARD_NAME = '任务交货卡'
export const TASK_ROUTE_CARD_NAME = '任务流转卡'

export type TaskRouteCardSourceType =
  | 'RUNTIME_TASK'
  | 'PRINTING_WORK_ORDER'
  | 'DYEING_WORK_ORDER'
  | 'SPECIAL_CRAFT_TASK_ORDER'
  | 'POST_FINISHING_WORK_ORDER'
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
  productionOrderId?: string
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
  titleOverride?: string
  summaryRowsOverride?: TaskPrintInfoRow[]
  extraRowsOverride?: TaskPrintInfoRow[]
}

export interface TaskPrintInfoRow {
  label: string
  value: string
}

export interface TaskRouteCardPrintDoc {
  docType: 'TASK_ROUTE_CARD'
  title: string
  sourceType: TaskRouteCardSourceType
  sourceId: string
  taskId?: string
  taskNo?: string
  productionOrderId?: string
  productionOrderNo?: string
  processName: string
  craftName?: string
  factoryName?: string
  statusLabel: string
  plannedQty?: number
  qtyUnit?: string
  dueDate?: string
  qrValue: string
  qrLabel: '任务二维码'
  imageUrl: string
  imageLabel: '商品图片'
  imageSourceLabel: string
  summaryRows: TaskPrintInfoRow[]
  extraRows: TaskPrintInfoRow[]
  nodeRows: TaskRouteCardRecordRow[]
}

export interface TaskDeliveryCardPrintDoc {
  docType: 'TASK_DELIVERY_CARD'
  title: string
  handoverOrderId: string
  handoverOrderNo: string
  handoverRecordId: string
  handoverRecordNo: string
  sequenceNo: number
  deliverySequenceLabel: string
  taskId?: string
  taskNo?: string
  productionOrderId?: string
  productionOrderNo?: string
  processName: string
  craftName?: string
  sourceFactoryName: string
  receiverName: string
  submittedQty: number
  qtyUnit: string
  submittedAt?: string
  qrValue: string
  qrLabel: '任务交货二维码'
  imageUrl: string
  imageLabel: '商品图片'
  imageSourceLabel: string
  summaryRows: TaskPrintInfoRow[]
  lineRows: TaskDeliveryCardLine[]
  writebackRows?: TaskPrintInfoRow[]
  remarkRows?: TaskPrintInfoRow[]
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

function formatQtyText(value: number | undefined | null, unit: string | undefined, fallback = '—'): string {
  if (!Number.isFinite(value)) return fallback
  const formatted = Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
  return `${formatted} ${unit || ''}`.trim()
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

export function resolveTaskPrintImage(input: {
  productionOrderId?: string
  processName?: string
  craftName?: string
}): TaskPrintImage {
  return resolvePrintImage({
    productionOrderId: input.productionOrderId || '',
    processName: input.processName || '',
    craftName: input.craftName,
  })
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

function findHandoutRecordContext(handoverRecordId: string): {
  head: PdaHandoverHead
  record: PdaHandoverRecord
} | null {
  for (const head of listPdaHandoverHeads().filter((item) => item.headType === 'HANDOUT')) {
    const record = getPdaHandoverRecordsByHead(head.handoverId).find((item) =>
      item.recordId === handoverRecordId
      || item.handoverRecordId === handoverRecordId
      || item.handoverRecordNo === handoverRecordId,
    )
    if (record) return { head, record }
  }
  return null
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

export function buildTaskDeliveryCardByRecordId(handoverRecordId: string): TaskDeliveryCardBuildResult {
  const context = findHandoutRecordContext(handoverRecordId)
  if (!context) {
    return {
      ok: false,
      title: TASK_DELIVERY_CARD_NAME,
      message: `未找到交出记录：${handoverRecordId}`,
    }
  }

  return buildTaskDeliveryCardByRecord(
    context.head.handoverOrderId || context.head.handoverId,
    context.record.handoverRecordId || context.record.recordId,
  )
}

function buildCardTitle(processName: string, cardName: string): string {
  const normalized = processName.trim()
  if (!normalized || normalized === '待确认') return cardName
  return `${normalized}${cardName}`
}

function mapDeliveryCardToPrintDoc(card: TaskDeliveryCardModel, record?: PdaHandoverRecord): TaskDeliveryCardPrintDoc {
  const productionOrderId = getRuntimeTaskProductionOrderId(card.taskId, card.productionOrderNo)
  const writebackRows: TaskPrintInfoRow[] = []
  const writtenQty = record ? getRecordReceiverWrittenQty(record) : undefined
  const writtenAt = record ? getRecordReceiverWrittenAt(record) : undefined
  const writtenBy = record ? getRecordReceiverWrittenBy(record) : undefined
  const diffQty = record ? getRecordDiffQty(record) : undefined

  if (typeof writtenQty === 'number') writebackRows.push({ label: '接收方回写数量', value: `${writtenQty} ${card.qtyUnit}` })
  if (writtenAt) writebackRows.push({ label: '回写时间', value: writtenAt })
  if (writtenBy) writebackRows.push({ label: '回写人', value: writtenBy })
  if (typeof diffQty === 'number') writebackRows.push({ label: '差异数量', value: `${diffQty} ${card.qtyUnit}` })
  if (record?.handoverRecordStatus) writebackRows.push({ label: '异议状态', value: getHandoverRecordStatusLabel(record) })

  const remarkRows = [
    { label: '工厂备注', value: record?.factoryRemark || card.remark || '无' },
    { label: '接收方备注', value: record?.receiverRemark || '无' },
  ]

  const summaryRows = [
    { label: '交出单号', value: card.handoverOrderNo },
    { label: '交货记录号', value: card.handoverRecordNo },
    { label: '第几次交货', value: card.deliverySequenceLabel },
    { label: '任务编号', value: card.taskNo },
    { label: '生产单号', value: card.productionOrderNo },
    { label: '工序', value: card.processName },
    { label: '工艺', value: card.craftName },
    { label: '上游工厂', value: card.upstreamFactoryName },
    { label: '下游工厂', value: card.downstreamFactoryName },
    { label: '本次交货数量', value: `${card.submittedQty} ${card.qtyUnit}` },
    { label: '单位', value: card.qtyUnit },
    { label: '提交时间', value: card.submittedAt },
  ]

  return {
    docType: 'TASK_DELIVERY_CARD',
    title: buildCardTitle(card.processName, TASK_DELIVERY_CARD_NAME),
    handoverOrderId: card.handoverOrderId,
    handoverOrderNo: card.handoverOrderNo,
    handoverRecordId: card.handoverRecordId,
    handoverRecordNo: card.handoverRecordNo,
    sequenceNo: card.deliverySequenceNo,
    deliverySequenceLabel: card.deliverySequenceLabel,
    taskId: card.taskId,
    taskNo: card.taskNo,
    productionOrderId,
    productionOrderNo: card.productionOrderNo,
    processName: card.processName,
    craftName: card.craftName,
    sourceFactoryName: card.upstreamFactoryName,
    receiverName: card.downstreamFactoryName,
    submittedQty: card.submittedQty,
    qtyUnit: card.qtyUnit,
    submittedAt: card.submittedAt,
    qrValue: card.qrValue,
    qrLabel: '任务交货二维码',
    imageUrl: card.image.url,
    imageLabel: '商品图片',
    imageSourceLabel: card.image.sourceLabel,
    summaryRows,
    lineRows: card.lines,
    writebackRows,
    remarkRows,
  }
}

export function buildTaskDeliveryCardPrintDocByRecordId(handoverRecordId: string): TaskDeliveryCardPrintDoc {
  const context = findHandoutRecordContext(handoverRecordId)
  const result = context
    ? buildTaskDeliveryCardByRecord(
        context.head.handoverOrderId || context.head.handoverId,
        context.record.handoverRecordId || context.record.recordId,
      )
    : buildTaskDeliveryCardByRecordId(handoverRecordId)

  if (!result.ok) {
    throw new Error(result.message)
  }

  return mapDeliveryCardToPrintDoc(result.card, context?.record)
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
  const nodeRecords = listPrintExecutionNodeRecords(order.printOrderId)

  return {
    ok: true,
    card: {
      cardName: TASK_ROUTE_CARD_NAME,
      sourceType: 'PRINTING_WORK_ORDER',
      sourceId,
      sourceLabel: '印花加工单',
      taskId: order.taskId,
      taskNo: order.taskNo,
      productionOrderId: order.productionOrderIds[0],
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
      titleOverride: '印花任务流转卡',
      summaryRowsOverride: [
        { label: '印花单号', value: order.printOrderNo },
        { label: '印花任务号', value: order.taskNo },
        { label: '花型号/版本', value: `${order.patternNo} / ${order.patternVersion}` },
        { label: '面料 SKU', value: order.materialSku },
        { label: '面料颜色', value: order.materialColor || '—' },
        { label: '印花工厂', value: order.printFactoryName },
        { label: '计划数量', value: formatQtyText(order.plannedQty, order.qtyUnit) },
        { label: '单位', value: order.qtyUnit },
        { label: '交出单号', value: order.handoverOrderNo || '—' },
        { label: '接收方', value: order.receiverName || '—' },
        { label: '状态', value: getPrintWorkOrderStatusLabel(order.status) },
      ],
      supplementalItems: [
        { label: '来源类型', value: '印花加工单' },
        { label: '任务二维码', value: '任务二维码' },
        { label: '原料使用量', value: formatQtyText(nodeRecords.find((record) => typeof record.usedMaterialQty === 'number')?.usedMaterialQty, order.qtyUnit) },
        { label: '备注', value: order.remark || '—' },
      ],
      routeRecords: nodeRecords.map((record) => ({
        rowId: record.nodeRecordId,
        node: record.nodeName || '—',
        startedAt: record.startedAt || '—',
        finishedAt: record.finishedAt || '—',
        completedQty: formatQtyText(record.outputQty ?? record.actualCompletedQty, record.qtyUnit),
        exceptionQty: formatQtyText(record.wasteQty, record.qtyUnit),
        station: record.printerNo || record.deviceId || '—',
        operator: record.operatorName || '—',
        remark: [
          record.usedMaterialQty !== undefined ? `原料使用量：${formatQtyText(record.usedMaterialQty, record.qtyUnit)}` : '',
          record.remark || '',
        ].filter(Boolean).join('；') || '—',
      })),
    },
  }
}

function buildRouteCardFromDyeWorkOrder(sourceId: string): TaskRouteCardBuildResult {
  const order = getDyeWorkOrderById(sourceId)
  if (!order) return { ok: false, title: TASK_ROUTE_CARD_NAME, message: `未找到染色加工单：${sourceId}` }
  const nodeRecords = listDyeExecutionNodeRecords(order.dyeOrderId)
  const firstVatNo = nodeRecords.find((record) => record.dyeVatNo)?.dyeVatNo

  return {
    ok: true,
    card: {
      cardName: TASK_ROUTE_CARD_NAME,
      sourceType: 'DYEING_WORK_ORDER',
      sourceId,
      sourceLabel: '染色加工单',
      taskId: order.taskId,
      taskNo: order.taskNo,
      productionOrderId: order.productionOrderIds?.[0],
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
      titleOverride: '染色任务流转卡',
      summaryRowsOverride: [
        { label: '染色单号', value: order.dyeOrderNo },
        { label: '染色任务号', value: order.taskNo },
        { label: '首单/翻单', value: order.isFirstOrder ? '首单' : '翻单' },
        { label: '原料面料', value: order.rawMaterialSku },
        { label: '目标颜色', value: order.targetColor },
        { label: '色号', value: order.colorNo || '—' },
        { label: '染色工厂', value: order.dyeFactoryName },
        { label: '计划数量', value: formatQtyText(order.plannedQty, order.qtyUnit) },
        { label: '单位', value: order.qtyUnit },
        { label: '交出单号', value: order.handoverOrderNo || '—' },
        { label: '接收方', value: order.receiverName || '—' },
        { label: '状态', value: getDyeWorkOrderStatusLabel(order.status) },
      ],
      supplementalItems: [
        { label: '成分', value: order.composition || '—' },
        { label: '幅宽', value: order.width || '—' },
        { label: '克重', value: order.weightGsm ? `${order.weightGsm} g/m2` : '—' },
        { label: '打样等待类型', value: order.sampleWaitType === 'WAIT_SAMPLE_GARMENT' ? '等待样衣' : order.sampleWaitType === 'WAIT_COLOR_CARD' ? '等待色卡' : '无' },
        { label: '打样状态', value: order.sampleStatus === 'WAITING' ? '等待中' : order.sampleStatus === 'TESTING' ? '打样中' : order.sampleStatus === 'DONE' ? '已完成' : '无需打样' },
        { label: '染缸号', value: firstVatNo || '—' },
        { label: '等待原因', value: order.waitingReason || '—' },
      ],
      routeRecords: nodeRecords.map((record) => ({
        rowId: record.nodeRecordId,
        node: record.nodeName || '—',
        startedAt: record.startedAt || '—',
        finishedAt: record.finishedAt || '—',
        completedQty: formatQtyText(record.outputQty, record.qtyUnit),
        exceptionQty: formatQtyText(record.lossQty, record.qtyUnit),
        station: record.dyeVatNo || record.deviceId || '—',
        operator: record.operatorName || '—',
        remark: [
          record.inputQty !== undefined ? `输入：${formatQtyText(record.inputQty, record.qtyUnit)}` : '',
          record.outputQty !== undefined ? `输出：${formatQtyText(record.outputQty, record.qtyUnit)}` : '',
          record.lossQty !== undefined ? `损耗：${formatQtyText(record.lossQty, record.qtyUnit)}` : '',
          record.remark || '',
        ].filter(Boolean).join('；') || '—',
      })),
    },
  }
}

function mapSpecialCraftNodeRecord(record: SpecialCraftTaskNodeRecord): TaskRouteCardRecordRow {
  return {
    rowId: record.nodeRecordId,
    node: record.nodeName,
    startedAt: record.operatedAt || '—',
    finishedAt: record.afterStatus === '已完成' || record.afterStatus === '已交出' ? record.operatedAt : '—',
    completedQty: `${record.qty} ${record.unit}`,
    exceptionQty: record.afterStatus.includes('差异') || record.afterStatus.includes('异议') ? `${record.qty} ${record.unit}` : '—',
    station: record.relatedRecordNo || record.relatedRecordType || '—',
    operator: record.operatorName,
    remark: [record.actionName, record.relatedRecordNo, record.remark].filter(Boolean).join(' / ') || '—',
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
      productionOrderId: order.productionOrderId,
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
      titleOverride: `${order.operationName}任务流转卡`,
      summaryRowsOverride: [
        { label: '任务号', value: order.taskOrderNo },
        { label: '生产单号', value: order.productionOrderNo || order.productionOrderId },
        { label: '特殊工艺名称', value: order.operationName },
        { label: '执行工厂', value: order.factoryName },
        { label: '作用对象', value: order.targetObject },
        { label: '裁片部位 / 面料 SKU', value: `${order.partName || '—'} / ${order.materialSku || '—'}` },
        { label: '颜色', value: order.fabricColor || '—' },
        { label: '尺码', value: order.sizeCode || '—' },
        { label: '计划数量', value: formatQtyText(order.planQty, order.unit) },
        { label: '已接收数量', value: formatQtyText(order.receivedQty, order.unit) },
        { label: '已完成数量', value: formatQtyText(order.completedQty, order.unit) },
        { label: '待交出数量', value: formatQtyText(order.waitHandoverQty, order.unit) },
        { label: '状态', value: order.status },
        { label: '异常状态', value: order.abnormalStatus },
        { label: '交期', value: order.dueAt },
      ],
      supplementalItems: [
        { label: '技术包版本', value: order.techPackVersion || '—' },
        { label: '来源', value: order.generationSourceLabel || '—' },
        { label: '菲票号', value: order.feiTicketNos.join('、') || '—' },
        { label: '中转袋号', value: order.transferBagNos.join('、') || '—' },
      ],
      routeRecords: order.nodeRecords.map(mapSpecialCraftNodeRecord),
    },
  }
}

function mapPostFinishingActionRecord(record: PostFinishingActionRecord): TaskRouteCardRecordRow {
  return {
    rowId: record.actionId,
    node: record.actionType,
    startedAt: record.startedAt || '—',
    finishedAt: record.finishedAt || '—',
    completedQty: formatQtyText(record.acceptedGarmentQty, record.qtyUnit),
    exceptionQty: formatQtyText(record.rejectedGarmentQty + record.diffGarmentQty, record.qtyUnit),
    station: record.factoryName || '—',
    operator: record.operatorName || '—',
    remark: record.remark || '—',
  }
}

function buildRouteCardFromPostFinishingWorkOrder(sourceId: string): TaskRouteCardBuildResult {
  const order = getPostFinishingWorkOrderById(sourceId)
  if (!order) return { ok: false, title: TASK_ROUTE_CARD_NAME, message: `未找到后道单：${sourceId}` }
  const actionRecords = [order.receiveAction, order.qcAction, order.postAction, order.recheckAction].filter(Boolean) as PostFinishingActionRecord[]

  return {
    ok: true,
    card: {
      cardName: TASK_ROUTE_CARD_NAME,
      sourceType: 'POST_FINISHING_WORK_ORDER',
      sourceId,
      sourceLabel: '后道单',
      taskId: order.sourceTaskId,
      taskNo: order.postOrderNo,
      productionOrderId: order.sourceProductionOrderId,
      productionOrderNo: order.sourceProductionOrderNo,
      processName: '后道',
      craftName: '后道',
      factoryName: order.currentFactoryName,
      statusLabel: order.currentStatus,
      plannedQty: order.plannedGarmentQty,
      qtyUnit: order.plannedGarmentQtyUnit,
      dueAt: order.updatedAt,
      qrValue: buildTaskQrValue(order.sourceTaskId || order.postOrderId),
      image: resolvePrintImage({ productionOrderId: order.sourceProductionOrderNo, processName: '后道', craftName: '后道' }),
      summaryRemark: '后道单按接收领料、质检、后道、复检节点生成任务流转卡',
      titleOverride: '后道任务流转卡',
      summaryRowsOverride: [
        { label: '后道单号', value: order.postOrderNo },
        { label: '生产单号', value: order.sourceProductionOrderNo },
        { label: '来源任务', value: order.sourceTaskNo },
        { label: '来源车缝任务', value: order.sourceSewingTaskNo },
        { label: '当前工厂', value: order.currentFactoryName },
        { label: '后道工厂', value: order.managedPostFactoryName },
        { label: '计划成衣件数', value: formatQtyText(order.plannedGarmentQty, order.plannedGarmentQtyUnit) },
        { label: '已完成后道成衣件数', value: formatQtyText(order.postAction.acceptedGarmentQty, order.postAction.qtyUnit) },
        { label: '当前状态', value: order.currentStatus },
      ],
      supplementalItems: [
        { label: '任务模式', value: order.routeMode },
        { label: '当前流程', value: order.isPostDoneBySewingFactory ? '接收领料 -> 质检 -> 复检 -> 交出' : '接收领料 -> 质检 -> 后道 -> 复检 -> 交出' },
        { label: '接收领料节点', value: `${order.receiveAction.status} / ${formatQtyText(order.receiveAction.acceptedGarmentQty, order.receiveAction.qtyUnit)}` },
        { label: '质检节点', value: `${order.qcAction.status} / ${formatQtyText(order.qcAction.acceptedGarmentQty, order.qcAction.qtyUnit)}` },
        { label: '复检节点', value: `${order.recheckAction.status} / ${formatQtyText(order.recheckAction.acceptedGarmentQty, order.recheckAction.qtyUnit)}` },
        { label: '待加工仓记录', value: order.waitProcessWarehouseRecordId },
        { label: '交出记录', value: order.handoverRecordId || order.waitHandoverWarehouseRecordId || '暂无交出记录' },
      ],
      routeRecords: actionRecords.map(mapPostFinishingActionRecord),
    },
  }
}

function buildRouteCardFromCuttingOriginalOrder(sourceId: string): TaskRouteCardBuildResult {
  const source = getCuttingOriginalOrderTaskPrintSourceById(sourceId)
  if (!source) return { ok: false, title: TASK_ROUTE_CARD_NAME, message: `未找到原始裁片单：${sourceId}` }

  return {
    ok: true,
    card: {
      cardName: TASK_ROUTE_CARD_NAME,
      sourceType: 'CUTTING_ORIGINAL_ORDER',
      sourceId,
      sourceLabel: '原始裁片单',
      taskId: source.originalCutOrderId,
      taskNo: source.originalCutOrderNo,
      productionOrderId: source.productionOrderId,
      productionOrderNo: source.productionOrderNo,
      processName: '裁床',
      craftName: '原始裁片单',
      factoryName: '裁床',
      statusLabel: source.currentStageLabel,
      plannedQty: source.plannedQty,
      qtyUnit: '件',
      dueAt: source.plannedShipDate,
      qrValue: buildTaskQrValue(source.originalCutOrderId),
      image: resolvePrintImage({ productionOrderId: source.productionOrderId, processName: '裁床', craftName: '原始裁片单' }),
      summaryRemark: source.latestActionText,
      titleOverride: '原始裁片单任务流转卡',
      summaryRowsOverride: [
        { label: '原始裁片单号', value: source.originalCutOrderNo },
        { label: '生产单号', value: source.productionOrderNo },
        { label: '款号 / SPU', value: `${source.styleCode || '—'} / ${source.spuCode || '—'}` },
        { label: '面料 SKU', value: source.materialSku },
        { label: '面料标签', value: source.materialLabel },
        { label: '面料类别', value: source.materialCategory },
        { label: '订单数量', value: formatQtyText(source.orderQty, '件') },
        { label: '计划数量', value: formatQtyText(source.plannedQty, '件') },
        { label: '发货日期', value: source.plannedShipDate || '—' },
        { label: '紧急程度', value: source.urgencyLabel },
        { label: '配料状态', value: source.prepStatusLabel },
        { label: '领料状态', value: source.claimStatusLabel },
        { label: '当前阶段', value: source.currentStageLabel },
        { label: '最新裁片批次号', value: source.latestMergeBatchNo },
      ],
      supplementalItems: [
        { label: '状态摘要', value: source.statusSummary },
        { label: '关联摘要', value: source.relationSummary },
        { label: '最近动作', value: source.latestActionText },
      ],
      routeRecords: source.nodeRows,
    },
  }
}

function buildRouteCardFromCuttingMergeBatch(sourceId: string): TaskRouteCardBuildResult {
  const source = getCuttingMergeBatchTaskPrintSourceById(sourceId)
  if (!source) return { ok: false, title: TASK_ROUTE_CARD_NAME, message: `未找到裁片批次：${sourceId}` }

  return {
    ok: true,
    card: {
      cardName: TASK_ROUTE_CARD_NAME,
      sourceType: 'CUTTING_MERGE_BATCH',
      sourceId,
      sourceLabel: '裁片批次',
      taskId: source.mergeBatchId,
      taskNo: source.mergeBatchNo,
      productionOrderId: source.firstProductionOrderId,
      productionOrderNo: source.firstProductionOrderNo || `${source.sourceProductionOrderCount} 个生产单`,
      processName: '裁床',
      craftName: '裁片批次',
      factoryName: source.plannedCuttingGroup || '裁床',
      statusLabel: source.statusLabel,
      plannedQty: source.sourceOriginalCutOrderCount,
      qtyUnit: '单',
      dueAt: source.plannedCuttingDate || source.updatedAt || '—',
      qrValue: buildTaskQrValue(source.mergeBatchId),
      image: resolvePrintImage({ productionOrderId: source.firstProductionOrderId, processName: '裁床', craftName: '裁片批次' }),
      summaryRemark: source.note || '按裁片批次当前台账生成',
      titleOverride: '裁片批次任务流转卡',
      summaryRowsOverride: [
        { label: '裁片批次号', value: source.mergeBatchNo },
        { label: '当前状态', value: source.statusLabel },
        { label: '款号 / SPU', value: `${source.styleCode || '—'} / ${source.spuCode || '—'}` },
        { label: '面料 SKU 摘要', value: source.materialSkuSummary || '—' },
        { label: '来源生产单数', value: `${source.sourceProductionOrderCount} 个` },
        { label: '来源原始裁片单数', value: `${source.sourceOriginalCutOrderCount} 个` },
        { label: '计划裁床组', value: source.plannedCuttingGroup || '—' },
        { label: '计划裁剪日期', value: source.plannedCuttingDate || '—' },
        { label: '备注', value: source.note || '—' },
      ],
      supplementalItems: [
        { label: '创建时间', value: source.createdAt || '—' },
        { label: '更新时间', value: source.updatedAt || '—' },
        { label: '来源类型', value: '裁片批次' },
      ],
      routeRecords: source.nodeRows,
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
    case 'POST_FINISHING_WORK_ORDER':
      return buildRouteCardFromPostFinishingWorkOrder(sourceId)
    case 'CUTTING_ORIGINAL_ORDER':
      return buildRouteCardFromCuttingOriginalOrder(sourceId)
    case 'CUTTING_MERGE_BATCH':
      return buildRouteCardFromCuttingMergeBatch(sourceId)
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
    || value === 'POST_FINISHING_WORK_ORDER'
    || value === 'CUTTING_ORIGINAL_ORDER'
    || value === 'CUTTING_MERGE_BATCH'
  )
}

function mapRouteCardToPrintDoc(card: TaskRouteCardModel): TaskRouteCardPrintDoc {
  const productionOrderId = card.productionOrderId || getRuntimeTaskProductionOrderId(card.taskId, card.productionOrderNo)
  const summaryRows = card.summaryRowsOverride || [
    { label: '任务编号', value: card.taskNo },
    { label: '生产单号', value: card.productionOrderNo },
    { label: '工序', value: card.processName },
    { label: '工艺', value: card.craftName },
    { label: '工厂', value: card.factoryName },
    { label: '状态', value: card.statusLabel },
    { label: '计划数量', value: `${card.plannedQty} ${card.qtyUnit}` },
    { label: '单位', value: card.qtyUnit },
    { label: '交期', value: card.dueAt },
    { label: '二维码', value: '任务二维码' },
  ]

  return {
    docType: 'TASK_ROUTE_CARD',
    title: card.titleOverride || buildCardTitle(card.processName, TASK_ROUTE_CARD_NAME),
    sourceType: card.sourceType,
    sourceId: card.sourceId,
    taskId: card.taskId,
    taskNo: card.taskNo,
    productionOrderId,
    productionOrderNo: card.productionOrderNo,
    processName: card.processName,
    craftName: card.craftName,
    factoryName: card.factoryName,
    statusLabel: card.statusLabel,
    plannedQty: card.plannedQty,
    qtyUnit: card.qtyUnit,
    dueDate: card.dueAt,
    qrValue: card.qrValue,
    qrLabel: '任务二维码',
    imageUrl: card.image.url,
    imageLabel: '商品图片',
    imageSourceLabel: card.image.sourceLabel,
    summaryRows,
    extraRows: card.extraRowsOverride || card.supplementalItems,
    nodeRows: card.routeRecords,
  }
}

export function buildTaskRouteCardPrintDoc(input: {
  sourceType: TaskRouteCardSourceType
  sourceId: string
}): TaskRouteCardPrintDoc {
  const result = buildTaskRouteCardBySource(input.sourceType, input.sourceId)
  if (!result.ok) {
    throw new Error(result.message)
  }
  return mapRouteCardToPrintDoc(result.card)
}
