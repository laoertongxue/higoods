import {
  getPdaCompletedHeads,
  getPdaHandoutHeads,
  getPdaHandoverRecordsByHead,
  getPdaPickupHeads,
  getPdaPickupRecordsByHead,
  type PdaHandoverHead,
  type PdaHandoverRecord,
  type PdaPickupRecord,
} from './pda-handover-events'
import { processTasks } from './process-tasks'
import { listRuntimeProcessTasks, type RuntimeProcessTask } from './runtime-process-tasks'

export type HandoverLedgerSourceType =
  | 'PICKUP_HEAD'
  | 'PICKUP_RECORD'
  | 'HANDOUT_HEAD'
  | 'HANDOUT_RECORD'
  | 'COMPLETED_HEAD'
  | 'SAME_FACTORY_CONTINUE'
  | 'WAREHOUSE_WORKSHOP'

export type HandoverLedgerStatusGroup = 'PENDING' | 'IN_PROGRESS' | 'EXCEPTION' | 'DONE'

export type HandoverLedgerStatusTone = 'muted' | 'warning' | 'info' | 'success' | 'danger'

export type HandoverLedgerEventTypeCode =
  | 'PICKUP_HEAD'
  | 'PICKUP_RECORD'
  | 'HANDOUT_HEAD'
  | 'HANDOUT_RECORD'
  | 'WAREHOUSE_CONFIRMED'
  | 'HANDOUT_OBJECTION'
  | 'HANDOUT_OBJECTION_PROCESSING'
  | 'HANDOUT_OBJECTION_RESOLVED'
  | 'PICKUP_COMPLETED'
  | 'HANDOUT_COMPLETED'
  | 'SAME_FACTORY_CONTINUE'
  | 'WAREHOUSE_WORKSHOP'

export interface HandoverLedgerRow {
  rowId: string
  sourceType: HandoverLedgerSourceType
  eventTypeCode: HandoverLedgerEventTypeCode
  eventTypeLabel: string
  productionOrderId: string
  taskId: string
  taskNo: string
  processName: string
  directionLabel: string
  qtySummary: string
  statusCode: string
  statusLabel: string
  statusGroup: HandoverLedgerStatusGroup
  statusTone: HandoverLedgerStatusTone
  occurredAt: string
  sourceModuleLabel: string
  nextActionHint: string
  handoverId: string
  recordId?: string
  qtyDiff?: number
}

export interface HandoverPreviewStats {
  pendingPickupHeads: number
  pendingHandoutHeads: number
  pendingWarehouseConfirm: number
  pendingObjections: number
}

export type HandoverTimelineProcessStatusLabel =
  | '暂无事件'
  | '待领料'
  | '已领料待交出'
  | '已交出待仓库确认'
  | '有异议'
  | '异议处理中'
  | '厂内连续流转'
  | '仓内处理'
  | '已完成'

export interface HandoverTimelineProcessSection {
  taskId: string
  taskNo: string
  seq: number
  processName: string
  processStatusLabel: HandoverTimelineProcessStatusLabel
  processStatusTone: HandoverLedgerStatusTone
  nextActionHint: string
  latestOccurredAt: string
  eventCount: number
  events: HandoverLedgerRow[]
}

export interface HandoverOrderTimelineView {
  productionOrderId: string
  productionOrderNo: string
  latestOccurredAt: string
  totalEventCount: number
  pendingCount: number
  objectionCount: number
  currentBottleneckLabel: string
  currentBottleneckHint: string
  processSections: HandoverTimelineProcessSection[]
}

export type HandoverFocus = 'pickup' | 'handout' | 'warehouse-confirm' | 'objection'

export interface HandoverOrderSummary {
  productionOrderId: string
  productionOrderNo: string
  latestOccurredAt: string
  totalEventCount: number
  pendingCount: number
  objectionCount: number
  currentBottleneckLabel: string
  currentBottleneckHint: string
  hasOpenIssue: boolean
  primaryActionHint: string
  recommendedFocus?: HandoverFocus
}

export interface HandoverTaskSummary {
  taskId: string
  taskNo: string
  processName: string
  relatedProductionOrderId: string
  processStatusLabel: HandoverTimelineProcessStatusLabel
  nextActionHint: string
  latestOccurredAt: string
  hasOpenIssue: boolean
  recommendedFocus?: HandoverFocus
}

export interface BuildHandoverPageLinkOptions {
  tab?: 'list' | 'timeline' | 'orders'
  productionOrderId?: string
  taskId?: string
  focus?: HandoverFocus
  source?: string
}

export interface BuildHandoverOrderDetailLinkOptions {
  productionOrderId: string
  tab?: 'time' | 'process'
  taskId?: string
  focus?: HandoverFocus
  source?: string
}

function parseDateMs(value: string | undefined): number {
  if (!value) return Number.NaN
  return new Date(value.replace(' ', 'T')).getTime()
}

function formatQtyDiff(diff: number, unit: string): string {
  if (diff === 0) return `差异 0 ${unit}`
  const sign = diff > 0 ? '-' : '+'
  return `差异 ${sign}${Math.abs(diff)} ${unit}`
}

function buildPickupHeadRow(head: PdaHandoverHead): HandoverLedgerRow {
  let statusCode = 'PICKUP_PENDING'
  let statusLabel = '待领料'
  let statusGroup: HandoverLedgerStatusGroup = 'PENDING'
  let statusTone: HandoverLedgerStatusTone = 'warning'
  let nextActionHint = '去 PDA 领料详情查看记录'

  if (head.summaryStatus === 'SUBMITTED') {
    statusCode = 'PICKUP_SUBMITTED'
    statusLabel = '已发起领料'
    statusGroup = 'IN_PROGRESS'
    statusTone = 'info'
  } else if (head.summaryStatus === 'PARTIAL_WRITTEN_BACK') {
    statusCode = 'PICKUP_PARTIAL'
    statusLabel = '部分已领料'
    statusGroup = 'IN_PROGRESS'
    statusTone = 'info'
  } else if (head.summaryStatus === 'WRITTEN_BACK') {
    statusCode = 'PICKUP_WRITTEN'
    statusLabel = '已领料确认'
    statusGroup = 'DONE'
    statusTone = 'success'
    nextActionHint = '领料记录已满足，等待仓库发起完成'
  }

  return {
    rowId: `PKH-${head.handoverId}`,
    sourceType: 'PICKUP_HEAD',
    eventTypeCode: 'PICKUP_HEAD',
    eventTypeLabel: '领料头',
    productionOrderId: head.productionOrderNo,
    taskId: head.taskId,
    taskNo: head.taskNo,
    processName: head.processName,
    directionLabel: '仓库 → 工厂',
    qtySummary: `应领 ${head.qtyExpectedTotal} ${head.qtyUnit} / 已领 ${head.qtyActualTotal} ${head.qtyUnit}（${formatQtyDiff(head.qtyDiffTotal, head.qtyUnit)}）`,
    statusCode,
    statusLabel,
    statusGroup,
    statusTone,
    occurredAt: head.lastRecordAt || head.completedByWarehouseAt || '',
    sourceModuleLabel: 'PDA 领料',
    nextActionHint,
    handoverId: head.handoverId,
    qtyDiff: head.qtyDiffTotal,
  }
}

function buildPickupRecordRow(head: PdaHandoverHead, record: PdaPickupRecord): HandoverLedgerRow {
  let statusCode = 'PICKUP_RECORD_PENDING_DISPATCH'
  let statusLabel = '待仓库发出'
  let statusGroup: HandoverLedgerStatusGroup = 'PENDING'
  let statusTone: HandoverLedgerStatusTone = 'warning'
  let nextActionHint = '等待仓库发出后可继续领料'

  if (record.status === 'PENDING_FACTORY_PICKUP') {
    statusCode = 'PICKUP_RECORD_PENDING_PICKUP'
    statusLabel = '待自提'
    statusGroup = 'PENDING'
    statusTone = 'info'
    nextActionHint = '工厂可按计划到仓自提'
  } else if (record.status === 'RECEIVED') {
    statusCode = 'PICKUP_RECORD_RECEIVED'
    statusLabel = '已领料确认'
    statusGroup = 'DONE'
    statusTone = 'success'
    nextActionHint = '本次领料已确认'
  }

  const actualText = typeof record.qtyActual === 'number' ? `${record.qtyActual}` : '待确认'

  return {
    rowId: `PKR-${record.recordId}`,
    sourceType: 'PICKUP_RECORD',
    eventTypeCode: 'PICKUP_RECORD',
    eventTypeLabel: '领料记录',
    productionOrderId: head.productionOrderNo,
    taskId: head.taskId,
    taskNo: head.taskNo,
    processName: head.processName,
    directionLabel: '仓库 → 工厂',
    qtySummary: `${actualText}/${record.qtyExpected} ${record.qtyUnit}`,
    statusCode,
    statusLabel,
    statusGroup,
    statusTone,
    occurredAt: record.submittedAt,
    sourceModuleLabel: 'PDA 领料',
    nextActionHint,
    handoverId: head.handoverId,
    recordId: record.recordId,
  }
}

function buildHandoutHeadRow(head: PdaHandoverHead): HandoverLedgerRow {
  let statusCode = 'HANDOUT_PENDING'
  let statusLabel = '待交出'
  let statusGroup: HandoverLedgerStatusGroup = 'PENDING'
  let statusTone: HandoverLedgerStatusTone = 'warning'
  let nextActionHint = '去 PDA 交出详情发起记录'

  if (head.summaryStatus === 'SUBMITTED') {
    statusCode = 'HANDOUT_SUBMITTED'
    statusLabel = '已发起交出'
    statusGroup = 'IN_PROGRESS'
    statusTone = 'info'
  } else if (head.summaryStatus === 'PARTIAL_WRITTEN_BACK') {
    statusCode = 'HANDOUT_PARTIAL_WRITTEN'
    statusLabel = '部分已回写'
    statusGroup = 'IN_PROGRESS'
    statusTone = 'info'
    nextActionHint = '等待仓库完成剩余回写'
  } else if (head.summaryStatus === 'WRITTEN_BACK') {
    statusCode = 'HANDOUT_WRITTEN'
    statusLabel = '已回写待完成'
    statusGroup = 'IN_PROGRESS'
    statusTone = 'success'
    nextActionHint = '可由仓库发起交出完成'
  } else if (head.summaryStatus === 'HAS_OBJECTION') {
    statusCode = 'HANDOUT_HAS_OBJECTION'
    statusLabel = '存在数量异议'
    statusGroup = 'EXCEPTION'
    statusTone = 'danger'
    nextActionHint = '先处理数量异议后再完成'
  }

  return {
    rowId: `HOH-${head.handoverId}`,
    sourceType: 'HANDOUT_HEAD',
    eventTypeCode: 'HANDOUT_HEAD',
    eventTypeLabel: '交出头',
    productionOrderId: head.productionOrderNo,
    taskId: head.taskId,
    taskNo: head.taskNo,
    processName: head.processName,
    directionLabel: '工厂 → 仓库',
    qtySummary: `应交 ${head.qtyExpectedTotal} ${head.qtyUnit} / 回写 ${head.qtyActualTotal} ${head.qtyUnit}（${formatQtyDiff(head.qtyDiffTotal, head.qtyUnit)}）`,
    statusCode,
    statusLabel,
    statusGroup,
    statusTone,
    occurredAt: head.lastRecordAt || head.completedByWarehouseAt || '',
    sourceModuleLabel: 'PDA 交出',
    nextActionHint,
    handoverId: head.handoverId,
    qtyDiff: head.qtyDiffTotal,
  }
}

function buildHandoutRecordRow(head: PdaHandoverHead, record: PdaHandoverRecord): HandoverLedgerRow {
  let eventTypeCode: HandoverLedgerEventTypeCode = 'HANDOUT_RECORD'
  let eventTypeLabel = '交出记录'
  let statusCode = 'HANDOUT_RECORD_PENDING_WRITEBACK'
  let statusLabel = '待仓库确认'
  let statusGroup: HandoverLedgerStatusGroup = 'PENDING'
  let statusTone: HandoverLedgerStatusTone = 'warning'
  let nextActionHint = '等待仓库回写数量'

  if (record.status === 'WRITTEN_BACK') {
    eventTypeCode = 'WAREHOUSE_CONFIRMED'
    eventTypeLabel = '仓库确认'
    statusCode = 'HANDOUT_RECORD_WRITTEN'
    statusLabel = '已回写'
    statusGroup = 'DONE'
    statusTone = 'success'
    nextActionHint = '已完成仓库回写'
  } else if (record.status === 'OBJECTION_REPORTED') {
    eventTypeCode = 'HANDOUT_OBJECTION'
    eventTypeLabel = '数量异议'
    statusCode = 'HANDOUT_OBJECTION_REPORTED'
    statusLabel = '已发起异议'
    statusGroup = 'EXCEPTION'
    statusTone = 'danger'
    nextActionHint = '等待平台跟进处理异议'
  } else if (record.status === 'OBJECTION_PROCESSING') {
    eventTypeCode = 'HANDOUT_OBJECTION_PROCESSING'
    eventTypeLabel = '异议跟进'
    statusCode = 'HANDOUT_OBJECTION_PROCESSING'
    statusLabel = '异议处理中'
    statusGroup = 'EXCEPTION'
    statusTone = 'danger'
    nextActionHint = '平台处理中，待结论'
  } else if (record.status === 'OBJECTION_RESOLVED') {
    eventTypeCode = 'HANDOUT_OBJECTION_RESOLVED'
    eventTypeLabel = '异议处理'
    statusCode = 'HANDOUT_OBJECTION_RESOLVED'
    statusLabel = '异议已处理'
    statusGroup = 'DONE'
    statusTone = 'success'
    nextActionHint = '异议已处理，可继续跟踪完成态'
  }

  const writtenText = typeof record.warehouseWrittenQty === 'number' ? `${record.warehouseWrittenQty} ${head.qtyUnit}` : '待仓库确认'

  return {
    rowId: `HOR-${record.recordId}`,
    sourceType: 'HANDOUT_RECORD',
    eventTypeCode,
    eventTypeLabel,
    productionOrderId: head.productionOrderNo,
    taskId: head.taskId,
    taskNo: head.taskNo,
    processName: head.processName,
    directionLabel: '工厂 → 仓库',
    qtySummary: writtenText,
    statusCode,
    statusLabel,
    statusGroup,
    statusTone,
    occurredAt: record.warehouseWrittenAt || record.factorySubmittedAt,
    sourceModuleLabel: 'PDA 交出',
    nextActionHint,
    handoverId: head.handoverId,
    recordId: record.recordId,
  }
}

function buildCompletedHeadRow(head: PdaHandoverHead): HandoverLedgerRow {
  return {
    rowId: `CMP-${head.handoverId}`,
    sourceType: 'COMPLETED_HEAD',
    eventTypeCode: head.headType === 'PICKUP' ? 'PICKUP_COMPLETED' : 'HANDOUT_COMPLETED',
    eventTypeLabel: head.headType === 'PICKUP' ? '领料完成' : '交出完成',
    productionOrderId: head.productionOrderNo,
    taskId: head.taskId,
    taskNo: head.taskNo,
    processName: head.processName,
    directionLabel: head.headType === 'PICKUP' ? '仓库 → 工厂' : '工厂 → 仓库',
    qtySummary: `应交 ${head.qtyExpectedTotal} ${head.qtyUnit} / 实际 ${head.qtyActualTotal} ${head.qtyUnit}（${formatQtyDiff(head.qtyDiffTotal, head.qtyUnit)}）`,
    statusCode: 'HEAD_COMPLETED',
    statusLabel: '已完成',
    statusGroup: 'DONE',
    statusTone: 'success',
    occurredAt: head.completedByWarehouseAt || head.lastRecordAt || '',
    sourceModuleLabel: '仓库完成回传',
    nextActionHint: '由仓库侧发起完成',
    handoverId: head.handoverId,
    qtyDiff: head.qtyDiffTotal,
  }
}

function buildSameFactoryContinueRow(task: RuntimeProcessTask): HandoverLedgerRow {
  return {
    rowId: `RTC-${task.taskId}`,
    sourceType: 'SAME_FACTORY_CONTINUE',
    eventTypeCode: 'SAME_FACTORY_CONTINUE',
    eventTypeLabel: '厂内连续流转',
    productionOrderId: task.productionOrderId,
    taskId: task.baseTaskId,
    taskNo: task.taskId,
    processName: task.processNameZh,
    directionLabel: '同厂连续',
    qtySummary: `${task.scopeLabel} / ${task.scopeQty} ${task.qtyUnit}`,
    statusCode: task.status === 'DONE' ? 'SAME_FACTORY_DONE' : 'SAME_FACTORY_CONTINUE',
    statusLabel: task.status === 'DONE' ? '厂内连续已完成' : '厂内连续流转',
    statusGroup: task.status === 'DONE' ? 'DONE' : 'IN_PROGRESS',
    statusTone: task.status === 'DONE' ? 'success' : 'info',
    occurredAt: task.updatedAt,
    sourceModuleLabel: '运行时任务流转',
    nextActionHint:
      task.status === 'DONE'
        ? '连续工序已完成，按后续工序流转'
        : '同厂同 SKU 连续工序，中间无需回仓再领料',
    handoverId: `RTC-${task.taskId}`,
  }
}

function buildWarehouseWorkshopRow(task: RuntimeProcessTask): HandoverLedgerRow {
  return {
    rowId: `WHW-${task.taskId}`,
    sourceType: 'WAREHOUSE_WORKSHOP',
    eventTypeCode: 'WAREHOUSE_WORKSHOP',
    eventTypeLabel: '仓内处理',
    productionOrderId: task.productionOrderId,
    taskId: task.baseTaskId,
    taskNo: task.taskId,
    processName: task.processNameZh,
    directionLabel: '仓库内流转',
    qtySummary: `${task.scopeLabel} / ${task.scopeQty} ${task.qtyUnit}`,
    statusCode: task.status === 'DONE' ? 'WAREHOUSE_WORKSHOP_DONE' : 'WAREHOUSE_WORKSHOP_PENDING',
    statusLabel: task.status === 'DONE' ? '仓内处理已完成' : '仓内处理',
    statusGroup: task.status === 'DONE' ? 'DONE' : 'IN_PROGRESS',
    statusTone: task.status === 'DONE' ? 'success' : 'info',
    occurredAt: task.updatedAt,
    sourceModuleLabel: '仓内流转',
    nextActionHint:
      task.status === 'DONE'
        ? '仓内后道处理已完成'
        : '仓内后道不走外部工厂 PDA，等待仓内流转到位',
    handoverId: `WHW-${task.taskId}`,
  }
}

export function getHandoverLedgerRows(): HandoverLedgerRow[] {
  const rows: HandoverLedgerRow[] = []
  const pickupHeads = getPdaPickupHeads()
  const handoutHeads = getPdaHandoutHeads()
  const completedHeads = getPdaCompletedHeads()

  pickupHeads.forEach((head) => {
    rows.push(buildPickupHeadRow(head))
    getPdaPickupRecordsByHead(head.handoverId).forEach((record) => {
      rows.push(buildPickupRecordRow(head, record))
    })
  })

  handoutHeads.forEach((head) => {
    rows.push(buildHandoutHeadRow(head))
    getPdaHandoverRecordsByHead(head.handoverId).forEach((record) => {
      rows.push(buildHandoutRecordRow(head, record))
    })
  })

  completedHeads.forEach((head) => {
    rows.push(buildCompletedHeadRow(head))
    if (head.headType === 'PICKUP') {
      getPdaPickupRecordsByHead(head.handoverId).forEach((record) => {
        rows.push(buildPickupRecordRow(head, record))
      })
      return
    }
    getPdaHandoverRecordsByHead(head.handoverId).forEach((record) => {
      rows.push(buildHandoutRecordRow(head, record))
    })
  })

  const runtimeRows = listRuntimeProcessTasks()
    .filter((task) => task.executorKind === 'WAREHOUSE_WORKSHOP' || task.transitionFromPrev === 'SAME_FACTORY_CONTINUE')
    .map((task) =>
      task.executorKind === 'WAREHOUSE_WORKSHOP'
        ? buildWarehouseWorkshopRow(task)
        : buildSameFactoryContinueRow(task),
    )
  rows.push(...runtimeRows)

  return rows.sort((a, b) => {
    const bTime = parseDateMs(b.occurredAt)
    const aTime = parseDateMs(a.occurredAt)
    const safeB = Number.isFinite(bTime) ? bTime : 0
    const safeA = Number.isFinite(aTime) ? aTime : 0
    return safeB - safeA
  })
}

export function getHandoverPreviewStats(rows: HandoverLedgerRow[]): HandoverPreviewStats {
  return {
    pendingPickupHeads: rows.filter((row) => row.sourceType === 'PICKUP_HEAD' && row.statusCode !== 'HEAD_COMPLETED').length,
    pendingHandoutHeads: rows.filter((row) => row.sourceType === 'HANDOUT_HEAD' && row.statusCode !== 'HEAD_COMPLETED').length,
    pendingWarehouseConfirm: rows.filter(
      (row) => row.sourceType === 'HANDOUT_RECORD' && row.statusCode === 'HANDOUT_RECORD_PENDING_WRITEBACK',
    ).length,
    pendingObjections: rows.filter(
      (row) =>
        row.sourceType === 'HANDOUT_RECORD' &&
        (row.statusCode === 'HANDOUT_OBJECTION_REPORTED' || row.statusCode === 'HANDOUT_OBJECTION_PROCESSING'),
    ).length,
  }
}

function getLatestOccurredAt(rows: HandoverLedgerRow[]): string {
  return rows
    .map((row) => row.occurredAt)
    .filter(Boolean)
    .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0] || ''
}

function deriveProcessSectionStatus(events: HandoverLedgerRow[]): {
  label: HandoverTimelineProcessStatusLabel
  tone: HandoverLedgerStatusTone
  nextActionHint: string
} {
  if (events.length === 0) {
    return {
      label: '暂无事件',
      tone: 'muted',
      nextActionHint: '当前工序暂无领料或交出事件',
    }
  }

  const statusCodes = new Set(events.map((event) => event.statusCode))
  const statusGroups = new Set(events.map((event) => event.statusGroup))

  if (statusCodes.has('WAREHOUSE_WORKSHOP_PENDING') || statusCodes.has('WAREHOUSE_WORKSHOP_DONE')) {
    return {
      label: '仓内处理',
      tone: statusCodes.has('WAREHOUSE_WORKSHOP_DONE') ? 'success' : 'info',
      nextActionHint: statusCodes.has('WAREHOUSE_WORKSHOP_DONE')
        ? '仓内后道处理完成'
        : '当前由仓内后道处理，不走外部工厂交接',
    }
  }

  if (statusCodes.has('SAME_FACTORY_CONTINUE') || statusCodes.has('SAME_FACTORY_DONE')) {
    return {
      label: '厂内连续流转',
      tone: statusCodes.has('SAME_FACTORY_DONE') ? 'success' : 'info',
      nextActionHint: statusCodes.has('SAME_FACTORY_DONE')
        ? '同厂连续工序已完成'
        : '同厂同 SKU 连续工序，中间无需回仓',
    }
  }

  if (statusCodes.has('HANDOUT_OBJECTION_REPORTED') || statusCodes.has('HANDOUT_HAS_OBJECTION')) {
    return {
      label: '有异议',
      tone: 'danger',
      nextActionHint: '当前需要继续跟进异议',
    }
  }

  if (statusCodes.has('HANDOUT_OBJECTION_PROCESSING')) {
    return {
      label: '异议处理中',
      tone: 'danger',
      nextActionHint: '当前异议处理中，等待处理结论',
    }
  }

  if (
    statusCodes.has('HANDOUT_RECORD_PENDING_WRITEBACK') ||
    statusCodes.has('HANDOUT_PARTIAL_WRITTEN') ||
    statusCodes.has('HANDOUT_WRITTEN') ||
    statusCodes.has('HANDOUT_RECORD_WRITTEN')
  ) {
    return {
      label: '已交出待仓库确认',
      tone: 'warning',
      nextActionHint: '当前等待仓库确认',
    }
  }

  if (statusCodes.has('HANDOUT_PENDING') || statusCodes.has('HANDOUT_SUBMITTED')) {
    return {
      label: '已领料待交出',
      tone: 'info',
      nextActionHint: '当前等待工厂交出',
    }
  }

  if (
    statusCodes.has('PICKUP_PENDING') ||
    statusCodes.has('PICKUP_RECORD_PENDING_DISPATCH') ||
    statusCodes.has('PICKUP_RECORD_PENDING_PICKUP')
  ) {
    return {
      label: '待领料',
      tone: 'warning',
      nextActionHint: '当前等待工厂领料',
    }
  }

  if (statusGroups.has('DONE')) {
    return {
      label: '已完成',
      tone: 'success',
      nextActionHint: '当前已完成，无需额外处理',
    }
  }

  return {
    label: '已领料待交出',
    tone: 'info',
    nextActionHint: '当前等待工厂交出',
  }
}

function getSectionPriority(label: HandoverTimelineProcessStatusLabel): number {
  switch (label) {
    case '有异议':
      return 1
    case '异议处理中':
      return 2
    case '已交出待仓库确认':
      return 3
    case '已领料待交出':
      return 4
    case '待领料':
      return 5
    case '仓内处理':
      return 5
    case '厂内连续流转':
      return 5
    case '暂无事件':
      return 6
    case '已完成':
      return 99
    default:
      return 99
  }
}

function resolveFocusByStatusLabel(label: string): HandoverFocus | undefined {
  if (label === '待领料') return 'pickup'
  if (label === '已领料待交出') return 'handout'
  if (label === '已交出待仓库确认') return 'warehouse-confirm'
  if (label === '有异议' || label === '异议处理中') return 'objection'
  return undefined
}

function buildOrderProcessSections(orderId: string, orderRows: HandoverLedgerRow[]): HandoverTimelineProcessSection[] {
  const taskRows = processTasks
    .filter((task) => task.productionOrderId === orderId)
    .sort((a, b) => a.seq - b.seq)

  const knownTaskIds = new Set(taskRows.map((task) => task.taskId))
  const unknownTaskIds = Array.from(new Set(orderRows.map((row) => row.taskId).filter((taskId) => !knownTaskIds.has(taskId))))

  const baseSections = taskRows.map((task) => ({
    taskId: task.taskId,
    taskNo: task.taskId,
    seq: task.seq,
    processName: task.processNameZh,
  }))

  const extraSections = unknownTaskIds.map((taskId, index) => {
    const firstRow = orderRows.find((row) => row.taskId === taskId)
    return {
      taskId,
      taskNo: firstRow?.taskNo || taskId,
      seq: 1000 + index,
      processName: firstRow?.processName || '未识别工序',
    }
  })

  return [...baseSections, ...extraSections]
    .sort((a, b) => a.seq - b.seq)
    .map((sectionBase) => {
      const sectionEvents = orderRows
        .filter((row) => row.taskId === sectionBase.taskId)
        .sort((a, b) => parseDateMs(a.occurredAt) - parseDateMs(b.occurredAt))

      const derivedStatus = deriveProcessSectionStatus(sectionEvents)
      return {
        ...sectionBase,
        processStatusLabel: derivedStatus.label,
        processStatusTone: derivedStatus.tone,
        nextActionHint: derivedStatus.nextActionHint,
        latestOccurredAt: getLatestOccurredAt(sectionEvents),
        eventCount: sectionEvents.length,
        events: sectionEvents,
      }
    })
}

function deriveOrderBottleneck(sections: HandoverTimelineProcessSection[]): { label: string; hint: string } {
  const sorted = [...sections].sort(
    (a, b) =>
      getSectionPriority(a.processStatusLabel) - getSectionPriority(b.processStatusLabel) ||
      a.seq - b.seq,
  )

  const target = sorted.find((section) => section.processStatusLabel !== '已完成') || sorted[0]
  if (!target) {
    return {
      label: '全部完成',
      hint: '当前生产单暂无可跟进的交接事项',
    }
  }

  if (target.processStatusLabel === '已完成') {
    return {
      label: '全部完成',
      hint: '当前生产单交接事项已完成',
    }
  }

  return {
    label: target.processStatusLabel,
    hint: target.nextActionHint,
  }
}

export function getHandoverOrderTimelineViews(rows: HandoverLedgerRow[]): HandoverOrderTimelineView[] {
  const orderIds = Array.from(new Set(rows.map((row) => row.productionOrderId)))

  return orderIds
    .map((orderId) => {
      const orderRows = rows.filter((row) => row.productionOrderId === orderId)
      const processSections = buildOrderProcessSections(orderId, orderRows)
      const bottleneck = deriveOrderBottleneck(processSections)

      return {
        productionOrderId: orderId,
        productionOrderNo: orderId,
        latestOccurredAt: getLatestOccurredAt(orderRows),
        totalEventCount: orderRows.length,
        pendingCount: processSections.filter(
          (section) => section.processStatusLabel !== '已完成' && section.processStatusLabel !== '暂无事件',
        ).length,
        objectionCount: processSections.filter(
          (section) =>
            section.processStatusLabel === '有异议' ||
            section.processStatusLabel === '异议处理中',
        ).length,
        currentBottleneckLabel: bottleneck.label,
        currentBottleneckHint: bottleneck.hint,
        processSections,
      }
    })
    .sort((a, b) => {
      const aRank = a.currentBottleneckLabel === '全部完成' ? 1 : 0
      const bRank = b.currentBottleneckLabel === '全部完成' ? 1 : 0
      if (aRank !== bRank) return aRank - bRank
      return parseDateMs(b.latestOccurredAt) - parseDateMs(a.latestOccurredAt)
    })
}

export function getHandoverOrderTimelineViewById(
  rows: HandoverLedgerRow[],
  productionOrderId: string,
): HandoverOrderTimelineView | undefined {
  return getHandoverOrderTimelineViews(rows).find((item) => item.productionOrderId === productionOrderId)
}

export function getProductionOrderHandoverSummary(
  productionOrderId: string,
  rows: HandoverLedgerRow[] = getHandoverLedgerRows(),
): HandoverOrderSummary {
  const view = getHandoverOrderTimelineViewById(rows, productionOrderId)
  if (!view) {
    return {
      productionOrderId,
      productionOrderNo: productionOrderId,
      latestOccurredAt: '',
      totalEventCount: 0,
      pendingCount: 0,
      objectionCount: 0,
      currentBottleneckLabel: '暂无事件',
      currentBottleneckHint: '当前生产单暂无交接事件，可先查看任务进度',
      hasOpenIssue: false,
      primaryActionHint: '当前暂无交接事项',
    }
  }

  return {
    productionOrderId: view.productionOrderId,
    productionOrderNo: view.productionOrderNo,
    latestOccurredAt: view.latestOccurredAt,
    totalEventCount: view.totalEventCount,
    pendingCount: view.pendingCount,
    objectionCount: view.objectionCount,
    currentBottleneckLabel: view.currentBottleneckLabel,
    currentBottleneckHint: view.currentBottleneckHint,
    hasOpenIssue: view.currentBottleneckLabel !== '全部完成',
    primaryActionHint: view.currentBottleneckHint,
    recommendedFocus: resolveFocusByStatusLabel(view.currentBottleneckLabel),
  }
}

export function getTaskHandoverSummary(
  taskId: string,
  rows: HandoverLedgerRow[] = getHandoverLedgerRows(),
): HandoverTaskSummary {
  const task = processTasks.find((item) => item.taskId === taskId)
  if (!task) {
    return {
      taskId,
      taskNo: taskId,
      processName: '未识别工序',
      relatedProductionOrderId: '',
      processStatusLabel: '暂无事件',
      nextActionHint: '当前任务暂无交接记录，请先查看领料与交出',
      latestOccurredAt: '',
      hasOpenIssue: false,
    }
  }

  const view = getHandoverOrderTimelineViewById(rows, task.productionOrderId)
  const section = view?.processSections.find((item) => item.taskId === taskId)

  if (!section) {
    return {
      taskId,
      taskNo: task.taskId,
      processName: task.processNameZh,
      relatedProductionOrderId: task.productionOrderId,
      processStatusLabel: '暂无事件',
      nextActionHint: '当前工序暂无交接记录，请先推进领料或交出',
      latestOccurredAt: '',
      hasOpenIssue: false,
    }
  }

  return {
    taskId: section.taskId,
    taskNo: section.taskNo,
    processName: section.processName,
    relatedProductionOrderId: task.productionOrderId,
    processStatusLabel: section.processStatusLabel,
    nextActionHint: section.nextActionHint,
    latestOccurredAt: section.latestOccurredAt,
    hasOpenIssue: section.processStatusLabel !== '已完成',
    recommendedFocus: resolveFocusByStatusLabel(section.processStatusLabel),
  }
}

export function buildHandoverPageLink(options: BuildHandoverPageLinkOptions = {}): string {
  const params = new URLSearchParams()
  if (options.tab) params.set('tab', options.tab)
  if (options.productionOrderId) params.set('po', options.productionOrderId)
  if (options.taskId) params.set('taskId', options.taskId)
  if (options.focus) params.set('focus', options.focus)
  if (options.source) params.set('source', options.source)

  const query = params.toString()
  return query ? `/fcs/progress/handover?${query}` : '/fcs/progress/handover'
}

export function buildHandoverOrderDetailLink(options: BuildHandoverOrderDetailLinkOptions): string {
  const params = new URLSearchParams()
  if (options.tab) params.set('tab', options.tab)
  if (options.taskId) params.set('taskId', options.taskId)
  if (options.focus) params.set('focus', options.focus)
  if (options.source) params.set('source', options.source)

  const query = params.toString()
  const basePath = `/fcs/progress/handover/order/${encodeURIComponent(options.productionOrderId)}`
  return query ? `${basePath}?${query}` : basePath
}
