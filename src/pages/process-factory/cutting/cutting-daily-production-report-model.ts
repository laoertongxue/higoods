import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from '../../../data/fcs/factory-mock-data.ts'
import { getFactoryById, getFactoryByCode } from '../../../data/fcs/indonesia-factories.ts'
import {
  isCuttingProcessTask,
  resolveCuttingTaskAssigneeType,
  type CuttingTaskAssigneeType,
  type CuttingTaskExecutionRoute,
} from '../../../data/fcs/cutting/cutting-task-routing.ts'
import {
  processTasks,
  type ProcessTask,
} from '../../../data/fcs/process-tasks.ts'
import { listFeiTicketNumberingRecords } from '../../../data/fcs/cutting/fei-ticket-numbering.ts'
import { listHandoverOrders, listHandoverRecords } from '../../../data/fcs/cutting/handover-orders.ts'
import { listCutPieceReleaseRecords } from '../../../data/fcs/cut-piece-release.ts'
import { buildFcsCuttingDomainSnapshot } from '../../../domain/fcs-cutting-runtime/index.ts'
import {
  mapCuttingDomainSnapshotToSummaryBuildOptions,
  type MarkerSpreadingSummaryBuildOptions,
} from './runtime-projections.ts'
import { buildMarkerPlanViewModel, type MarkerPlanViewRow } from './marker-plan-model.ts'
import {
  buildMarkerSpreadingViewModel,
  type SpreadingSession,
} from './marker-spreading-model.ts'
import type { CuttingSummaryBuildOptions } from './summary-model.ts'

export type CuttingDailyExecutionOwner = 'ALL' | 'OWN' | 'THIRD_PARTY' | 'UNASSIGNED' | 'CONFLICT'
export type CuttingDailyTab =
  | 'overview'
  | 'tasks'
  | 'marker'
  | 'spreading'
  | 'fulfillment'
  | 'materials'
  | 'tickets'
  | 'warehouse'

export type CuttingDailyMetricAvailability = 'AVAILABLE' | 'NO_RECORDS' | 'PARTIAL' | 'UNAVAILABLE'
export type CuttingDailyCoverageStatus = 'RECORDED' | 'NO_RECORDS' | 'PARTIAL' | 'UNAVAILABLE'

export interface CuttingDailyProductionReportQuery {
  reportDate: string
  factoryId: string
  keyword: string
  executionOwner: CuttingDailyExecutionOwner
  includeDemoData: boolean
  timezone: string
}

export interface CuttingDailyMetric {
  key: string
  label: string
  value: number | null
  unit: string
  availability: CuttingDailyMetricAvailability
  helperText: string
  recordCount: number
  latestOccurredAt?: string
  tab: CuttingDailyTab
  detailStatus?: string
}

export interface CuttingDailyMetricGroup {
  key: string
  title: string
  metrics: CuttingDailyMetric[]
}

export interface CuttingDailyCoverageItem {
  moduleKey: string
  moduleName: string
  status: CuttingDailyCoverageStatus
  recordCount: number
  latestRecordedAt?: string
  reason: string
}

export interface CuttingDailyDetailRow {
  id: string
  tab: CuttingDailyTab
  metricKeys: string[]
  objectType: string
  objectNo: string
  productionOrderNo: string
  spuCode: string
  summary: string
  quantityText: string
  occurredAt: string
  operator: string
  status: string
  sourceName: string
  href: string
  searchText: string
}

type CuttingDailyDetailRowInput = Omit<CuttingDailyDetailRow, 'metricKeys' | 'searchText'> & {
  metricKeys?: string[]
}

export interface CuttingDailyProductionContributionRow {
  productionOrderNo: string
  spuCode: string
  styleName: string
  imageUrl: string
  planQty: number
  cutOrderCount: number
  materialPreparedQtyText: string
  spreadingSessionCount: number
  actualCutPieceQty: number
  actualCutGarmentQty: number | null
  completeKitQty: number
  incompleteQty: number
  inboundQty: number
  handedOverQty: number
  latestOccurredAt: string
}

export interface CuttingDailyReportWarning {
  level: '提示' | '需关注'
  message: string
}

export interface CuttingDailyProductionReport {
  queryId: string
  query: CuttingDailyProductionReportQuery
  factoryName: string
  windowStartAt: string
  windowEndAt: string
  generatedAt: string
  isDynamic: true
  metricGroups: CuttingDailyMetricGroup[]
  coverage: CuttingDailyCoverageItem[]
  warnings: CuttingDailyReportWarning[]
  productionContributions: CuttingDailyProductionContributionRow[]
  timeline: CuttingDailyDetailRow[]
  detailRowsByTab: Record<CuttingDailyTab, CuttingDailyDetailRow[]>
  tabSummary: Record<CuttingDailyTab, { label: string; count: number; partialCount: number }>
  totals: {
    recordedCoverageCount: number
    noRecordCoverageCount: number
    partialCoverageCount: number
    totalDetailCount: number
  }
}

export const CUTTING_DAILY_REPORT_PATH = '/fcs/craft/cutting/statistics/daily-production'
export const CUTTING_DAILY_DEMO_REPORT_DATE = '2026-03-24'

export const cuttingDailyTabs: Array<{ key: CuttingDailyTab; label: string }> = [
  { key: 'overview', label: '总览' },
  { key: 'tasks', label: '任务派接' },
  { key: 'marker', label: '唛架方案' },
  { key: 'spreading', label: '铺布与裁剪' },
  { key: 'fulfillment', label: '生产单满足与齐套' },
  { key: 'materials', label: '配料与领料' },
  { key: 'tickets', label: '菲票与中转袋' },
  { key: 'warehouse', label: '仓库与交出' },
]

const executionOwnerLabelMap: Record<CuttingDailyExecutionOwner, string> = {
  ALL: '全部执行归属',
  OWN: '本厂执行',
  THIRD_PARTY: '三方工厂执行',
  UNASSIGNED: '待分配',
  CONFLICT: '承接方冲突',
}

const tabLabelMap: Record<CuttingDailyTab, string> = Object.fromEntries(
  cuttingDailyTabs.map((tab) => [tab.key, tab.label]),
) as Record<CuttingDailyTab, string>

function safeNumber(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + safeNumber(value), 0)
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeKeyword(value: unknown): string {
  return normalizeText(value).toLowerCase()
}

function getDatePart(value: unknown): string {
  return normalizeText(value).slice(0, 10)
}

function latestText(values: Array<string | undefined>): string {
  return values.filter(Boolean).sort((left, right) => String(right).localeCompare(String(left), 'zh-CN'))[0] || ''
}

function formatNumber(value: number | null | undefined, maximumFractionDigits = 0): string {
  if (value === null || value === undefined) return '—'
  return safeNumber(value).toLocaleString('zh-CN', { maximumFractionDigits })
}

function formatQty(value: number | null | undefined, unit: string, maximumFractionDigits = 0): string {
  if (value === null || value === undefined) return '—'
  return `${formatNumber(value, maximumFractionDigits)} ${unit}`
}

function matchesKeyword(parts: unknown[], keyword: string): boolean {
  const normalizedKeyword = normalizeKeyword(keyword)
  if (!normalizedKeyword) return true
  return parts.some((part) => normalizeKeyword(part).includes(normalizedKeyword))
}

function occursInReportDate(value: unknown, query: CuttingDailyProductionReportQuery): boolean {
  const datePart = getDatePart(value)
  if (!datePart) return false
  if (datePart === query.reportDate) return true
  return query.includeDemoData
}

function buildWindow(query: CuttingDailyProductionReportQuery): { windowStartAt: string; windowEndAt: string } {
  return {
    windowStartAt: `${query.reportDate} 00:00:00`,
    windowEndAt: `${query.reportDate} 23:59:59`,
  }
}

function resolveFactoryName(factoryId: string): string {
  const factory = getFactoryById(factoryId) || getFactoryByCode(factoryId)
  if (factory) return `${factory.name}（${factory.code || factory.id}）`
  if (factoryId === TEST_FACTORY_ID) return `${TEST_FACTORY_NAME}（${TEST_FACTORY_ID}）`
  return factoryId || `${TEST_FACTORY_NAME}（${TEST_FACTORY_ID}）`
}

function resolveTimezone(factoryId: string, fallback = 'Asia/Jakarta'): string {
  const factory = getFactoryById(factoryId) || getFactoryByCode(factoryId)
  return factory?.timezone || fallback
}

function ownerFromAssigneeType(type: CuttingTaskAssigneeType | string | undefined): CuttingDailyExecutionOwner {
  if (type === 'OWN_CUTTING_FACTORY') return 'OWN'
  if (type === 'THIRD_PARTY_FACTORY') return 'THIRD_PARTY'
  if (type === 'CONFLICT') return 'CONFLICT'
  return 'UNASSIGNED'
}

function ownerFromRoute(route: CuttingTaskExecutionRoute | string | undefined): CuttingDailyExecutionOwner {
  if (route === 'OWN_CUTTING') return 'OWN'
  if (route === 'FACTORY_PDA') return 'THIRD_PARTY'
  if (route === 'CONFLICT') return 'CONFLICT'
  return 'UNASSIGNED'
}

function matchesExecutionOwner(owner: CuttingDailyExecutionOwner, query: CuttingDailyProductionReportQuery): boolean {
  return query.executionOwner === 'ALL' || owner === query.executionOwner
}

function taskOwner(task: ProcessTask): CuttingDailyExecutionOwner {
  return ownerFromAssigneeType(resolveCuttingTaskAssigneeType(task.assignedFactoryId || ''))
}

function isTaskDispatchedForMetric(task: ProcessTask, query: CuttingDailyProductionReportQuery): boolean {
  return occursInReportDate(task.dispatchedAt || task.createdAt, query)
}

function isTaskAcceptedForMetric(task: ProcessTask, query: CuttingDailyProductionReportQuery): boolean {
  if (task.acceptanceStatus !== 'ACCEPTED') return false
  return occursInReportDate(task.acceptedAt, query) || query.includeDemoData
}

function isTaskRejectedForMetric(task: ProcessTask, query: CuttingDailyProductionReportQuery): boolean {
  return task.acceptanceStatus === 'REJECTED' ||
    task.auditLogs.some((log) => /REJECT|拒/.test(log.action + log.detail) && occursInReportDate(log.at, query))
}

function isTaskPendingForMetric(task: ProcessTask): boolean {
  return task.assignmentStatus !== 'UNASSIGNED' &&
    task.acceptanceStatus !== 'ACCEPTED' &&
    task.acceptanceStatus !== 'REJECTED' &&
    task.status !== 'CANCELLED'
}

function getTaskMetricKeys(task: ProcessTask, query: CuttingDailyProductionReportQuery): string[] {
  const keys: string[] = []
  if (isTaskDispatchedForMetric(task, query)) keys.push('tasks.dispatched')
  if (isTaskAcceptedForMetric(task, query)) keys.push('tasks.accepted')
  if (isTaskRejectedForMetric(task, query)) keys.push('tasks.rejected')
  if (isTaskPendingForMetric(task)) keys.push('tasks.pending')
  return keys
}

function createDailyDemoCuttingTask(input: {
  taskId: string
  productionOrderId: string
  seq: number
  qty: number
  assignmentStatus: ProcessTask['assignmentStatus']
  status: ProcessTask['status']
  dispatchedAt: string
  dispatchedBy: string
  acceptanceStatus?: ProcessTask['acceptanceStatus']
  acceptedAt?: string
  acceptedBy?: string
  responseAt?: string
  assignedFactoryId?: string
  assignedFactoryName?: string
  dispatchRemark: string
}): ProcessTask {
  const auditLogs = [
    {
      id: `${input.taskId}:dispatch`,
      action: 'DISPATCH',
      detail: input.dispatchRemark,
      at: input.dispatchedAt,
      by: input.dispatchedBy,
    },
  ]
  if (input.acceptanceStatus === 'ACCEPTED' && input.acceptedAt) {
    auditLogs.push({
      id: `${input.taskId}:accept`,
      action: 'ACCEPT',
      detail: '工厂已确认接单',
      at: input.acceptedAt,
      by: input.acceptedBy || input.assignedFactoryName || '裁床厂',
    })
  }
  if (input.acceptanceStatus === 'REJECTED') {
    auditLogs.push({
      id: `${input.taskId}:reject`,
      action: 'REJECT',
      detail: '产能冲突，工厂拒单',
      at: input.responseAt || input.dispatchedAt,
      by: input.acceptedBy || input.assignedFactoryName || '裁床厂',
    })
  }

  return {
    taskId: input.taskId,
    taskNo: input.taskId,
    productionOrderId: input.productionOrderId,
    seq: input.seq,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty: input.qty,
    qtyUnit: 'PIECE',
    assignmentMode: 'DIRECT',
    assignmentStatus: input.assignmentStatus,
    ownerSuggestion: { kind: 'MAIN_FACTORY' },
    assignedFactoryId: input.assignedFactoryId,
    assignedFactoryName: input.assignedFactoryName,
    qcPoints: ['裁片数量核对', '裁片方向核对'],
    attachments: [],
    status: input.status,
    acceptanceStatus: input.acceptanceStatus,
    acceptedAt: input.acceptanceStatus === 'ACCEPTED' ? input.acceptedAt : undefined,
    acceptedBy: input.acceptanceStatus === 'ACCEPTED' ? input.acceptedBy : undefined,
    acceptDeadline: `${input.dispatchedAt.slice(0, 10)} 18:00:00`,
    taskDeadline: `${input.dispatchedAt.slice(0, 10)} 23:00:00`,
    dispatchRemark: input.dispatchRemark,
    dispatchedAt: input.dispatchedAt,
    dispatchedBy: input.dispatchedBy,
    processBusinessCode: 'CUT_PANEL',
    processBusinessName: '裁片',
    taskCategoryZh: '裁床任务',
    createdAt: input.dispatchedAt,
    updatedAt: input.responseAt || input.acceptedAt || input.dispatchedAt,
    auditLogs,
  }
}

function buildDailyDemoCuttingTasks(query: CuttingDailyProductionReportQuery): ProcessTask[] {
  if (!query.includeDemoData) return []
  const date = query.reportDate || CUTTING_DAILY_DEMO_REPORT_DATE
  return [
    createDailyDemoCuttingTask({
      taskId: 'TASKDAILY-20260324-ACCEPTED-001',
      productionOrderId: 'PO-202603-091',
      seq: 901,
      qty: 3200,
      assignmentStatus: 'ASSIGNED',
      status: 'NOT_STARTED',
      acceptanceStatus: 'ACCEPTED',
      dispatchedAt: `${date} 08:10:00`,
      dispatchedBy: '跟单A',
      acceptedAt: `${date} 08:42:00`,
      acceptedBy: TEST_FACTORY_NAME,
      assignedFactoryId: TEST_FACTORY_ID,
      assignedFactoryName: TEST_FACTORY_NAME,
      dispatchRemark: '直接派给本厂裁床，工厂已接单等待开裁。',
    }),
    createDailyDemoCuttingTask({
      taskId: 'TASKDAILY-20260324-PENDING-001',
      productionOrderId: 'PO-202603-092',
      seq: 902,
      qty: 1800,
      assignmentStatus: 'ASSIGNED',
      status: 'NOT_STARTED',
      acceptanceStatus: 'PENDING',
      dispatchedAt: `${date} 09:20:00`,
      dispatchedBy: '跟单B',
      assignedFactoryId: TEST_FACTORY_ID,
      assignedFactoryName: TEST_FACTORY_NAME,
      dispatchRemark: '直接派给本厂裁床，等待工厂确认接单。',
    }),
    createDailyDemoCuttingTask({
      taskId: 'TASKDAILY-20260324-REJECTED-001',
      productionOrderId: 'PO-202603-093',
      seq: 903,
      qty: 2600,
      assignmentStatus: 'ASSIGNED',
      status: 'CANCELLED',
      acceptanceStatus: 'REJECTED',
      dispatchedAt: `${date} 10:05:00`,
      dispatchedBy: '跟单C',
      responseAt: `${date} 10:36:00`,
      acceptedBy: TEST_FACTORY_NAME,
      assignedFactoryId: TEST_FACTORY_ID,
      assignedFactoryName: TEST_FACTORY_NAME,
      dispatchRemark: '直接派给本厂裁床，因产能冲突被拒单。',
    }),
    createDailyDemoCuttingTask({
      taskId: 'TASKDAILY-20260324-THIRD-PENDING-001',
      productionOrderId: 'PO-202603-094',
      seq: 904,
      qty: 4200,
      assignmentStatus: 'AWARDED',
      status: 'NOT_STARTED',
      acceptanceStatus: 'PENDING',
      dispatchedAt: `${date} 11:15:00`,
      dispatchedBy: '跟单D',
      assignedFactoryId: 'FACTORY-ONBOARD-0034',
      assignedFactoryName: '定向裁演示工厂34',
      dispatchRemark: '竞价定标后派给三方裁床，等待对方接单。',
    }),
    createDailyDemoCuttingTask({
      taskId: 'TASKDAILY-20260324-ACCEPTED-STARTED-001',
      productionOrderId: 'PO-202603-095',
      seq: 905,
      qty: 3900,
      assignmentStatus: 'ASSIGNED',
      status: 'IN_PROGRESS',
      acceptanceStatus: 'ACCEPTED',
      dispatchedAt: `${date} 13:00:00`,
      dispatchedBy: '跟单E',
      acceptedAt: `${date} 13:18:00`,
      acceptedBy: TEST_FACTORY_NAME,
      assignedFactoryId: TEST_FACTORY_ID,
      assignedFactoryName: TEST_FACTORY_NAME,
      dispatchRemark: '本厂已接单并进入现场铺布准备。',
    }),
  ]
}

function metric(input: {
  key: string
  label: string
  value: number | null
  unit: string
  tab: CuttingDailyTab
  recordCount: number
  helperText: string
  latestOccurredAt?: string
  availability?: CuttingDailyMetricAvailability
  detailStatus?: string
}): CuttingDailyMetric {
  const availability = input.availability ?? (
    input.value === null
      ? 'UNAVAILABLE'
      : input.recordCount > 0 || input.value > 0
        ? 'AVAILABLE'
        : 'NO_RECORDS'
  )
  return {
    key: input.key,
    label: input.label,
    value: input.value,
    unit: input.unit,
    tab: input.tab,
    recordCount: input.recordCount,
    helperText: input.helperText,
    latestOccurredAt: input.latestOccurredAt,
    availability,
    detailStatus: input.detailStatus,
  }
}

function coverage(input: {
  moduleKey: string
  moduleName: string
  recordCount: number
  latestRecordedAt?: string
  reason?: string
  status?: CuttingDailyCoverageStatus
}): CuttingDailyCoverageItem {
  const status = input.status ?? (input.recordCount > 0 ? 'RECORDED' : 'NO_RECORDS')
  return {
    moduleKey: input.moduleKey,
    moduleName: input.moduleName,
    status,
    recordCount: input.recordCount,
    latestRecordedAt: input.latestRecordedAt,
    reason: input.reason || (status === 'RECORDED' ? '所选范围内有系统记录。' : '所选范围内暂无系统记录。'),
  }
}

function buildDetailRow(input: CuttingDailyDetailRowInput): CuttingDailyDetailRow {
  return {
    ...input,
    metricKeys: unique(input.metricKeys || []),
    searchText: [
      input.objectType,
      input.objectNo,
      input.productionOrderNo,
      input.spuCode,
      input.summary,
      input.quantityText,
      input.operator,
      input.status,
      input.sourceName,
    ].join(' / '),
  }
}

function filterRowsByScope<T>(
  rows: T[],
  query: CuttingDailyProductionReportQuery,
  getParts: (row: T) => unknown[],
  getOwner: (row: T) => CuttingDailyExecutionOwner,
): T[] {
  return rows.filter((row) =>
    matchesKeyword(getParts(row), query.keyword) &&
    matchesExecutionOwner(getOwner(row), query),
  )
}

function makeQueryId(query: CuttingDailyProductionReportQuery): string {
  const source = query.includeDemoData ? 'demo' : 'formal'
  const keyword = query.keyword ? normalizeKeyword(query.keyword).replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-') : 'all'
  return [
    query.reportDate,
    query.factoryId || TEST_FACTORY_ID,
    query.executionOwner,
    source,
    keyword,
  ].join(':')
}

function normalizeQuery(input: Partial<CuttingDailyProductionReportQuery> = {}): CuttingDailyProductionReportQuery {
  const factoryId = input.factoryId || TEST_FACTORY_ID
  return {
    reportDate: input.reportDate || CUTTING_DAILY_DEMO_REPORT_DATE,
    factoryId,
    keyword: input.keyword || '',
    executionOwner: input.executionOwner || 'ALL',
    includeDemoData: input.includeDemoData !== false,
    timezone: input.timezone || resolveTimezone(factoryId),
  }
}

function buildTaskRows(tasks: ProcessTask[], query: CuttingDailyProductionReportQuery): CuttingDailyDetailRow[] {
  return tasks.map((task) => {
    const occurredAt = task.dispatchedAt || task.acceptedAt || task.updatedAt || task.createdAt
    const status =
      task.acceptanceStatus === 'ACCEPTED'
        ? '已接单'
        : task.acceptanceStatus === 'REJECTED'
          ? '已拒单'
          : task.assignmentStatus === 'UNASSIGNED'
            ? '待分配'
            : '待接单'
    return buildDetailRow({
      id: `task:${task.taskId}`,
      tab: 'tasks',
      metricKeys: getTaskMetricKeys(task, query),
      objectType: '裁剪任务',
      objectNo: task.taskNo || task.taskId,
      productionOrderNo: task.productionOrderId,
      spuCode: '',
      summary: `${task.processNameZh} / ${task.qty} ${task.qtyUnit === 'PIECE' ? '件' : task.qtyUnit}`,
      quantityText: formatQty(task.qty, '件'),
      occurredAt,
      operator: task.acceptedBy || task.dispatchedBy || '系统',
      status,
      sourceName: 'process-tasks',
      href: `/fcs/progress/task-detail?taskId=${encodeURIComponent(task.taskId)}`,
    })
  }).filter((row) => occursInReportDate(row.occurredAt, query))
}

function buildMarkerRows(plans: MarkerPlanViewRow[], query: CuttingDailyProductionReportQuery): CuttingDailyDetailRow[] {
  return plans.map((plan) => {
    const owner = ownerFromRoute(plan.executionRoute)
    const occurredAt = plan.createdAt || plan.updatedAt
    const status = plan.confirmationStatus || plan.statusMeta?.label || '待确认'
    const metricKeys = ['marker.created', 'marker.beds']
    if (owner === 'OWN') metricKeys.push('marker.own')
    if (owner === 'THIRD_PARTY') metricKeys.push('marker.thirdParty')
    if (status === '已确认') metricKeys.push('marker.confirmed')
    if (status === '待确认') metricKeys.push('marker.waiting')
    return {
      owner,
      row: buildDetailRow({
        id: `marker:${plan.markerPlanId}`,
        tab: 'marker',
        metricKeys,
        objectType: '唛架方案',
        objectNo: plan.markerPlanNo,
        productionOrderNo: plan.productionOrderSummary,
        spuCode: plan.spuCode,
        summary: `${plan.modeMeta?.label || '唛架方案'} / ${plan.beds?.length || 0} 个床次 / ${plan.executionRouteLabel || '执行归属待识别'}`,
        quantityText: `${formatNumber(plan.totalPieces)} 件 / ${formatNumber(plan.plannedSpreadLength, 2)} m`,
        occurredAt,
        operator: plan.createdBy || plan.updatedBy || '计划员',
        status,
        sourceName: 'marker-plan-model',
        href: `/fcs/craft/cutting/marker-list?keyword=${encodeURIComponent(plan.markerPlanNo)}`,
      }),
    }
  }).filter((item) =>
    occursInReportDate(item.row.occurredAt, query) &&
    matchesKeyword([
      item.row.objectNo,
      item.row.productionOrderNo,
      item.row.spuCode,
      item.row.summary,
    ], query.keyword) &&
    matchesExecutionOwner(item.owner, query),
  ).map((item) => item.row)
}

function buildSpreadingRows(sessions: SpreadingSession[], query: CuttingDailyProductionReportQuery, ownerLookup: Map<string, CuttingDailyExecutionOwner>): CuttingDailyDetailRow[] {
  return sessions.map((session) => {
    const owner = ownerLookup.get(session.markerPlanId) || 'UNASSIGNED'
    const occurredAt = session.actualEndAt || session.cuttingFinishedAt || session.updatedFromPdaAt || session.updatedAt || session.createdAt
    const status = session.status === 'DONE' ? '已完成' : session.status === 'IN_PROGRESS' ? '进行中' : '待开始'
    const actualCutPieceQty = session.actualCutPieceQty ?? session.theoreticalActualCutPieceQty ?? 0
    const actualCutGarmentQty = session.actualCutGarmentQty ?? session.theoreticalCutGarmentQty ?? null
    const metricKeys = ['spreading.created']
    if (status === '已完成') metricKeys.push('spreading.completed')
    if (actualCutPieceQty > 0) metricKeys.push('cutting.completed', 'cutting.pieceQty')
    if ((actualCutGarmentQty || 0) > 0) metricKeys.push('cutting.garmentQty')
    return {
      owner,
      row: buildDetailRow({
        id: `spreading:${session.spreadingSessionId}`,
        tab: 'spreading',
        metricKeys,
        objectType: '铺布单',
        objectNo: session.sessionNo || session.spreadingSessionId,
        productionOrderNo: '',
        spuCode: session.spuCode || '',
        summary: `${session.markerPlanNo} / ${session.cuttingTableName || '未指定裁床台'} / ${session.rollCount} 卷`,
        quantityText: `${formatQty(actualCutPieceQty, '片')} / ${formatQty(actualCutGarmentQty, '件')}`,
        occurredAt,
        operator: session.ownerName || session.operators[0]?.operatorName || '现场操作员',
        status,
        sourceName: 'marker-spreading-model',
        href: `/fcs/craft/cutting/spreading-list?keyword=${encodeURIComponent(session.sessionNo || session.markerPlanNo)}`,
      }),
    }
  }).filter((item) =>
    occursInReportDate(item.row.occurredAt, query) &&
    matchesKeyword([
      item.row.objectNo,
      item.row.spuCode,
      item.row.summary,
      item.row.quantityText,
    ], query.keyword) &&
    matchesExecutionOwner(item.owner, query),
  ).map((item) => item.row)
}

function buildDailyDemoSpreadingRows(query: CuttingDailyProductionReportQuery): CuttingDailyDetailRow[] {
  if (!query.includeDemoData) return []
  const date = query.reportDate || CUTTING_DAILY_DEMO_REPORT_DATE
  const rows = [
    buildDetailRow({
      id: 'daily-spreading:SPREAD-20260324-001',
      tab: 'spreading',
      metricKeys: ['spreading.created', 'spreading.completed', 'cutting.completed', 'cutting.pieceQty', 'cutting.garmentQty'],
      objectType: '铺布单',
      objectNo: 'SPREAD-20260324-001',
      productionOrderNo: 'PO-202603-0004',
      spuCode: 'SPU-2024-010',
      summary: 'MK-20260324-001 / 1号裁床台 / 6 卷 / 本厂完成裁剪',
      quantityText: '2,680 片 / 1,340 件',
      occurredAt: `${date} 10:25:00`,
      operator: '铺布组长 Rini',
      status: '已完成',
      sourceName: 'daily-demo-spreading',
      href: '/fcs/craft/cutting/spreading-list?keyword=SPREAD-20260324-001',
    }),
    buildDetailRow({
      id: 'daily-spreading:SPREAD-20260324-002',
      tab: 'spreading',
      metricKeys: ['spreading.created'],
      objectType: '铺布单',
      objectNo: 'SPREAD-20260324-002',
      productionOrderNo: 'PO-202603-0007',
      spuCode: 'SPU-2024-013',
      summary: 'MK-20260324-002 / 2号裁床台 / 4 卷 / 已建单待裁剪',
      quantityText: '0 片 / —',
      occurredAt: `${date} 11:10:00`,
      operator: '裁剪计划员 Sari',
      status: '进行中',
      sourceName: 'daily-demo-spreading',
      href: '/fcs/craft/cutting/spreading-list?keyword=SPREAD-20260324-002',
    }),
    buildDetailRow({
      id: 'daily-spreading:SPREAD-20260324-003',
      tab: 'spreading',
      metricKeys: ['spreading.created', 'spreading.completed', 'cutting.completed', 'cutting.pieceQty', 'cutting.garmentQty'],
      objectType: '铺布单',
      objectNo: 'SPREAD-20260324-003',
      productionOrderNo: 'PO-202603-0008',
      spuCode: 'SPU-2024-014',
      summary: 'MK-20260324-003 / 3号裁床台 / 5 卷 / 三方回传裁剪结果',
      quantityText: '1,980 片 / 990 件',
      occurredAt: `${date} 14:40:00`,
      operator: '三方裁床 Dimas',
      status: '已完成',
      sourceName: 'daily-demo-spreading',
      href: '/fcs/craft/cutting/spreading-list?keyword=SPREAD-20260324-003',
    }),
  ]

  return rows.filter((row) =>
    matchesKeyword([
      row.objectNo,
      row.productionOrderNo,
      row.spuCode,
      row.summary,
      row.quantityText,
      row.status,
    ], query.keyword) &&
    matchesExecutionOwner(row.objectNo === 'SPREAD-20260324-003' ? 'THIRD_PARTY' : 'OWN', query),
  )
}

function buildFulfillmentRows(sources: CuttingSummaryBuildOptions, query: CuttingDailyProductionReportQuery): CuttingDailyDetailRow[] {
  const fulfillmentRows = filterRowsByScope(
    sources.productionRows,
    query,
    (row) => [row.productionOrderNo, row.spuCode, row.styleCode, row.styleName],
    () => 'OWN',
  ).map((row) => buildDetailRow({
    id: `fulfillment:${row.productionOrderId}`,
    tab: 'fulfillment',
    metricKeys: [
      'fulfillment.cutCompleteKit',
      'fulfillment.inboundCompleteKit',
      'fulfillment.incompleteQty',
    ],
    objectType: '生产单齐套',
    objectNo: row.productionOrderNo,
    productionOrderNo: row.productionOrderNo,
    spuCode: row.spuCode,
    summary: `${row.styleName} / ${row.pieceCompletionSummary.label} / 缺口 ${formatQty(row.pieceGapQty, '片')}`,
    quantityText: `${formatQty(row.orderQty, '件')} / 可放行 ${formatQty(row.pieceCompletionSummary.key === 'COMPLETE' ? row.orderQty : Math.max(row.orderQty - row.pieceGapQty, 0), '件')}`,
    occurredAt: row.latestUpdatedAt || row.timeGroup.completedAt || row.plannedShipDate,
    operator: row.latestOperatorName || '系统',
    status: row.pieceCompletionSummary.label,
    sourceName: 'fcs-cutting-piece-truth',
    href: `/fcs/craft/cutting/production-progress?productionOrderNo=${encodeURIComponent(row.productionOrderNo)}`,
  }))

  const releaseRows = listCutPieceReleaseRecords()
    .filter((row) =>
      occursInReportDate(row.judgedAt || row.triggerAt, query) &&
      matchesKeyword([
        row.recordNo,
        row.productionOrderNo,
        row.spuCode,
        row.spuName,
        row.decision,
        row.reason,
      ], query.keyword),
    )
    .map((row) => buildDetailRow({
      id: `release:${row.recordId}`,
      tab: 'fulfillment',
      metricKeys: ['fulfillment.releaseQty'],
      objectType: '裁片放行判断',
      objectNo: row.recordNo,
      productionOrderNo: row.productionOrderNo,
      spuCode: row.spuCode,
      summary: `${row.spuName} / ${row.decision} / ${row.reason}`,
      quantityText: formatQty(row.releaseQty, '件'),
      occurredAt: row.judgedAt || row.triggerAt,
      operator: row.judgedBy || row.triggerOperator || '裁床主管',
      status: row.decision,
      sourceName: 'cut-piece-release',
      href: `/fcs/craft/cutting/cut-piece-release?productionOrderNo=${encodeURIComponent(row.productionOrderNo)}`,
    }))

  return [...fulfillmentRows, ...releaseRows]
}

function buildMaterialRows(sources: CuttingSummaryBuildOptions, query: CuttingDailyProductionReportQuery): CuttingDailyDetailRow[] {
  return filterRowsByScope(
    sources.materialPrepRows,
    query,
    (row) => [row.productionOrderNo, row.spuCode, row.styleCode, row.styleName, row.materialSkuSummary],
    () => 'OWN',
  ).flatMap((row) => {
    const sourceRows = row.materialLineItems.length ? row.materialLineItems : []
    if (!sourceRows.length) {
      const metricKeys = ['materials.prepared']
      if (row.claimRecordCount > 0) metricKeys.push('materials.pickup')
      return [buildDetailRow({
        id: `material:${row.cutOrderId}`,
        tab: 'materials',
        metricKeys,
        objectType: '配料行',
        objectNo: row.cutOrderNo,
        productionOrderNo: row.productionOrderNo,
        spuCode: row.spuCode,
        summary: `${row.styleName} / ${row.materialPrepStatus.label} / ${row.materialClaimStatus.label}`,
        quantityText: '—',
        occurredAt: row.latestClaimRecordAt || row.printedAt,
        operator: '系统',
        status: row.currentStage.label,
        sourceName: 'material-prep-model',
        href: `/fcs/craft/cutting/pickup-management?keyword=${encodeURIComponent(row.cutOrderNo)}`,
      })]
    }
    return sourceRows.map((line) => {
      const metricKeys = ['materials.prepared', 'materials.preparedQty']
      if ((line.claimedQty || 0) > 0 || row.claimRecordCount > 0) metricKeys.push('materials.pickup')
      return buildDetailRow({
        id: `material:${row.cutOrderId}:${line.materialLineId}`,
        tab: 'materials',
        metricKeys,
        objectType: '配料行',
        objectNo: row.cutOrderNo,
        productionOrderNo: row.productionOrderNo,
        spuCode: row.spuCode,
        summary: `${line.materialSku} / ${line.materialName} / ${line.materialAlias}`,
        quantityText: `${formatQty(line.configuredQty, line.materialUnit, 2)} / 已领 ${formatQty(line.claimedQty, line.materialUnit, 2)}`,
        occurredAt: row.latestClaimRecordAt || row.printedAt,
        operator: row.claimRecords[0]?.claimedBy || '仓管',
        status: `${line.linePrepStatus.label} / ${line.lineClaimStatus.label}`,
        sourceName: 'material-prep-model',
        href: `/fcs/craft/cutting/pickup-management?keyword=${encodeURIComponent(row.cutOrderNo)}`,
      })
    })
  }).filter((row) => occursInReportDate(row.occurredAt, query))
}

function buildDailyDemoMaterialRows(query: CuttingDailyProductionReportQuery): CuttingDailyDetailRow[] {
  if (!query.includeDemoData) return []
  const date = query.reportDate || CUTTING_DAILY_DEMO_REPORT_DATE
  const rows = [
    buildDetailRow({
      id: 'daily-material:PROCESS-ISSUE-20260324-001',
      tab: 'materials',
      metricKeys: ['materials.processingIssue'],
      objectType: '加工领料',
      objectNo: 'WAIT-PROCESS-ISSUE-20260324-001',
      productionOrderNo: 'PO-202603-0004',
      spuCode: 'SPU-2024-010',
      summary: '待加工仓 / 粘衬加工领料 / 黑色针织布',
      quantityText: '8 卷',
      occurredAt: `${date} 09:35:00`,
      operator: '待加工仓仓管 Wayan',
      status: '已领料',
      sourceName: 'daily-demo-wait-process',
      href: '/fcs/craft/cutting/warehouse-management/wait-process?keyword=WAIT-PROCESS-ISSUE-20260324-001',
    }),
    buildDetailRow({
      id: 'daily-material:RETURN-20260324-001',
      tab: 'materials',
      metricKeys: ['materials.returned'],
      objectType: '加工回收入仓',
      objectNo: 'WAIT-PROCESS-RETURN-20260324-001',
      productionOrderNo: 'PO-202603-0007',
      spuCode: 'SPU-2024-013',
      summary: '待加工仓 / 剩余面料回收入仓 / 已复核',
      quantityText: '3 卷',
      occurredAt: `${date} 16:05:00`,
      operator: '待加工仓仓管 Putri',
      status: '已回收入仓',
      sourceName: 'daily-demo-wait-process',
      href: '/fcs/craft/cutting/warehouse-management/wait-process?keyword=WAIT-PROCESS-RETURN-20260324-001',
    }),
  ]

  return rows.filter((row) =>
    matchesKeyword([
      row.objectNo,
      row.productionOrderNo,
      row.spuCode,
      row.summary,
      row.status,
    ], query.keyword),
  )
}

function buildTicketRows(sources: CuttingSummaryBuildOptions, query: CuttingDailyProductionReportQuery): CuttingDailyDetailRow[] {
  const ticketRows = sources.feiViewModel.ticketRecords.map((ticket) => buildDetailRow({
    id: `ticket:${ticket.ticketRecordId}`,
    tab: 'tickets',
    objectType: '菲票',
    objectNo: ticket.ticketNo,
    productionOrderNo: ticket.productionOrderNo,
    spuCode: ticket.spuCode,
    summary: `${ticket.cutOrderNo} / ${ticket.partName || '裁片'} / ${ticket.color || ticket.fabricColor || ''}`,
    quantityText: formatQty(ticket.quantity ?? ticket.actualCutPieceQty ?? 0, '片'),
    occurredAt: ticket.printedAt || ticket.createdAt,
    operator: ticket.printedBy || '打印员',
    status: ticket.status === 'VOIDED' || ticket.printStatus === 'VOIDED' ? '已作废' : '已打印',
    sourceName: 'fei-tickets-model',
    href: `/fcs/craft/cutting/fei-tickets?keyword=${encodeURIComponent(ticket.ticketNo)}`,
  }))

  const numberingRows = listFeiTicketNumberingRecords().map((record) => buildDetailRow({
    id: `numbering:${record.recordId}`,
    tab: 'tickets',
    objectType: '菲票打编号',
    objectNo: record.feiTicketNo,
    productionOrderNo: record.productionOrderNo,
    spuCode: '',
    summary: `${record.cutOrderNo} / ${record.partName} / ${record.pieceSequenceLabel}`,
    quantityText: formatQty(record.numberCount, '片'),
    occurredAt: record.completedAt,
    operator: record.operatorName,
    status: '已完成',
    sourceName: 'fei-ticket-numbering',
    href: `/fcs/craft/cutting/fei-ticket-numbering?keyword=${encodeURIComponent(record.feiTicketNo)}`,
  }))

  const bagRows = sources.transferBagView.usages.map((usage) => buildDetailRow({
    id: `bag:${usage.cycleId}`,
    tab: 'tickets',
    metricKeys: ['warehouse.bags'],
    objectType: '中转袋周期',
    objectNo: usage.cycleNo || usage.usageNo,
    productionOrderNo: usage.productionOrderNos.join(' / '),
    spuCode: usage.spuCode,
    summary: `${usage.carrierCode} / ${usage.usageStageLabel || '中转袋'} / ${usage.receiverName}`,
    quantityText: `${formatQty(usage.packedTicketCount, '张')} / ${formatQty(usage.summary.pieceQty, '片')}`,
    occurredAt: usage.finishedPackingAt || usage.startedAt || usage.dispatchAt,
    operator: usage.dispatchBy || '装袋员',
    status: usage.visibleStatusMeta.label,
    sourceName: 'transfer-bags-model',
    href: `/fcs/craft/cutting/transfer-bags?keyword=${encodeURIComponent(usage.cycleNo || usage.carrierCode)}`,
  }))

  return [...ticketRows, ...numberingRows, ...bagRows].filter((row) =>
    occursInReportDate(row.occurredAt, query) &&
    matchesKeyword([
      row.objectNo,
      row.productionOrderNo,
      row.spuCode,
      row.summary,
      row.status,
    ], query.keyword),
  )
}

function buildWarehouseRows(sources: CuttingSummaryBuildOptions, query: CuttingDailyProductionReportQuery): CuttingDailyDetailRow[] {
  const cutPieceRows = sources.cutPieceWarehouseView.items.map((item) => buildDetailRow({
    id: `warehouse-piece:${item.id}`,
    tab: 'warehouse',
    metricKeys: ['warehouse.inboundPieces'],
    objectType: '待交出仓裁片',
    objectNo: item.cutOrderNo,
    productionOrderNo: item.productionOrderNo,
    spuCode: item.spuCode,
    summary: `${item.styleName} / ${item.materialLabel || '裁片'} / ${item.zoneMeta?.label || '未分配库区'}`,
    quantityText: item.pieceSummary || formatQty(item.pieceQty, '片'),
    occurredAt: item.inboundAt || item.updatedAt,
    operator: item.operatorName || '仓管',
    status: item.statusMeta?.label || '待入仓',
    sourceName: 'cut-piece-warehouse-model',
    href: `/fcs/craft/cutting/warehouse-management/wait-handover?keyword=${encodeURIComponent(item.cutOrderNo)}`,
  }))

  const handoverRows = listHandoverRecords().map((record) => {
    const metricKeys = ['warehouse.handoverPieces']
    if (sum(record.discrepancyItems.map((item) => item.differenceQty)) !== 0) metricKeys.push('warehouse.diffQty')
    return buildDetailRow({
      id: `handover:${record.handoverRecordId}`,
      tab: 'warehouse',
      metricKeys,
      objectType: '交出记录',
      objectNo: record.handoverRecordNo,
      productionOrderNo: record.relatedProductionOrderIds.join(' / '),
      spuCode: '',
      summary: `${record.handoverOrderNo} / ${record.receiverName} / ${record.receiverWritebackStatus}`,
      quantityText: formatQty(sum(record.currentHandedOverSummary.map((item) => item.qty)), '片'),
      occurredAt: record.handedOverAt,
      operator: record.handedOverBy,
      status: record.recordStatus,
      sourceName: 'handover-orders',
      href: `/fcs/craft/cutting/handover-orders?keyword=${encodeURIComponent(record.handoverRecordNo)}`,
    })
  })

  const handoverOrderRows = listHandoverOrders().map((order) => buildDetailRow({
    id: `handover-order:${order.handoverOrderId}`,
    tab: 'warehouse',
    metricKeys: ['warehouse.handoverOrders'],
    objectType: '交出单',
    objectNo: order.handoverOrderNo,
    productionOrderNo: order.relatedProductionOrderIds.join(' / '),
    spuCode: '',
    summary: `${order.handoverType} / ${order.receiverName} / ${order.handoverBasis}`,
    quantityText: `${formatQty(order.totalPlannedPieceQty, '片')} / 已交 ${formatQty(order.totalHandedOverPieceQty, '片')}`,
    occurredAt: order.createdAt,
    operator: order.createdBy,
    status: order.status,
    sourceName: 'handover-orders',
    href: `/fcs/craft/cutting/handover-orders?keyword=${encodeURIComponent(order.handoverOrderNo)}`,
  }))

  return [...cutPieceRows, ...handoverRows, ...handoverOrderRows].filter((row) =>
    occursInReportDate(row.occurredAt, query) &&
    matchesKeyword([
      row.objectNo,
      row.productionOrderNo,
      row.spuCode,
      row.summary,
      row.status,
    ], query.keyword),
  )
}

function buildDailyDemoWarehouseRows(query: CuttingDailyProductionReportQuery): CuttingDailyDetailRow[] {
  if (!query.includeDemoData) return []
  const date = query.reportDate || CUTTING_DAILY_DEMO_REPORT_DATE
  const rows = [
    buildDetailRow({
      id: 'daily-warehouse:INBOUND-20260324-001',
      tab: 'warehouse',
      metricKeys: ['warehouse.inboundPieces'],
      objectType: '待交出仓裁片入仓',
      objectNo: 'WH-IN-20260324-001',
      productionOrderNo: 'PO-202603-0004',
      spuCode: 'SPU-2024-010',
      summary: '大身裁片 / A区-01 / 已扫码入待交出仓',
      quantityText: '2,680 片',
      occurredAt: `${date} 15:05:00`,
      operator: '待交出仓仓管 Siti',
      status: '已入待交出仓',
      sourceName: 'daily-demo-wait-handover',
      href: '/fcs/craft/cutting/warehouse-management/wait-handover?keyword=WH-IN-20260324-001',
    }),
    buildDetailRow({
      id: 'daily-warehouse:SPECIAL-OUT-20260324-001',
      tab: 'warehouse',
      metricKeys: ['warehouse.specialCraftOut'],
      objectType: '特殊工艺交出',
      objectNo: 'SPECIAL-OUT-20260324-001',
      productionOrderNo: 'PO-202603-0007',
      spuCode: 'SPU-2024-013',
      summary: '绣花裁片 / 交出至辅助工艺待加工仓 / 已签收',
      quantityText: '2 条记录',
      occurredAt: `${date} 16:30:00`,
      operator: '交出仓仓管 Agus',
      status: '已交出',
      sourceName: 'daily-demo-special-craft',
      href: '/fcs/craft/cutting/handover-orders?keyword=SPECIAL-OUT-20260324-001',
    }),
  ]

  return rows.filter((row) =>
    matchesKeyword([
      row.objectNo,
      row.productionOrderNo,
      row.spuCode,
      row.summary,
      row.status,
    ], query.keyword),
  )
}

function buildProductionContributions(
  sources: CuttingSummaryBuildOptions,
  spreadingRows: CuttingDailyDetailRow[],
  warehouseRows: CuttingDailyDetailRow[],
  query: CuttingDailyProductionReportQuery,
): CuttingDailyProductionContributionRow[] {
  return filterRowsByScope(
    sources.productionRows,
    query,
    (row) => [row.productionOrderNo, row.spuCode, row.styleCode, row.styleName],
    () => 'OWN',
  ).map((row) => {
    const matchedSpreadingRows = spreadingRows.filter((item) => item.productionOrderNo.includes(row.productionOrderNo) || item.spuCode === row.spuCode)
    const matchedWarehouseRows = warehouseRows.filter((item) => item.productionOrderNo.includes(row.productionOrderNo) || item.spuCode === row.spuCode)
    const actualCutPieceQty = sum(matchedSpreadingRows.map((item) => safeNumber(item.quantityText.match(/([\d,]+)\s*片/)?.[1]?.replace(/,/g, ''))))
    const garmentMatchQty = sum(matchedSpreadingRows.map((item) => safeNumber(item.quantityText.match(/\/\s*([\d,]+)\s*件/)?.[1]?.replace(/,/g, ''))))
    const release = listCutPieceReleaseRecords().find((item) => item.productionOrderNo === row.productionOrderNo)
    return {
      productionOrderNo: row.productionOrderNo,
      spuCode: row.spuCode,
      styleName: row.styleName,
      imageUrl: row.spuImageUrl,
      planQty: row.orderQty,
      cutOrderCount: row.cutOrderCount,
      materialPreparedQtyText: row.materialPrepLines.map((line) => `${formatNumber(line.preparedQty, 2)} ${line.materialUnit}`).join(' / ') || '—',
      spreadingSessionCount: matchedSpreadingRows.length,
      actualCutPieceQty,
      actualCutGarmentQty: garmentMatchQty > 0 ? garmentMatchQty : null,
      completeKitQty: Math.max(row.orderQty - row.pieceGapQty, 0),
      incompleteQty: Math.max(row.pieceGapQty, 0),
      inboundQty: sum(row.skuProgressLines.map((line) => safeNumber(line.inboundQty))),
      handedOverQty: sum(matchedWarehouseRows.map((item) => safeNumber(item.quantityText.match(/([\d,]+)\s*片/)?.[1]?.replace(/,/g, '')))),
      latestOccurredAt: latestText([
        row.latestUpdatedAt,
        release?.judgedAt,
        ...matchedSpreadingRows.map((item) => item.occurredAt),
        ...matchedWarehouseRows.map((item) => item.occurredAt),
      ]),
    }
  }).sort((left, right) => right.actualCutPieceQty - left.actualCutPieceQty)
}

function buildTimeline(rowsByTab: Record<CuttingDailyTab, CuttingDailyDetailRow[]>): CuttingDailyDetailRow[] {
  return Object.values(rowsByTab)
    .flat()
    .filter((row) => row.occurredAt)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt, 'zh-CN'))
    .slice(0, 12)
}

function summarizeUnits(rows: CuttingDailyDetailRow[], unit: string): number {
  return sum(rows.map((row) => safeNumber(row.quantityText.match(new RegExp(`([\\d,]+(?:\\.\\d+)?)\\s*${unit}`))?.[1]?.replace(/,/g, ''))))
}

function buildReportFromSources(
  query: CuttingDailyProductionReportQuery,
  sources: CuttingSummaryBuildOptions,
): CuttingDailyProductionReport {
  const markerPlanView = buildMarkerPlanViewModel(sources, [])
  const spreadingOptions: MarkerSpreadingSummaryBuildOptions = {
    productionRows: sources.productionRows,
    cutOrderRows: sources.cutOrderRows,
    materialPrepRows: sources.materialPrepRows,
    markerPlanSources: sources.markerPlanSources,
    markerStore: sources.markerStore,
  }
  const spreadingView = buildMarkerSpreadingViewModel({
    rows: spreadingOptions.materialPrepRows,
    markerPlanSources: spreadingOptions.markerPlanSources,
    store: spreadingOptions.markerStore,
    prefilter: null,
  })
  const markerOwnerById = new Map<string, CuttingDailyExecutionOwner>()
  markerPlanView.plans.forEach((plan) => {
    markerOwnerById.set(plan.markerPlanId, ownerFromRoute(plan.executionRoute))
  })

  const taskSourceRows = [
    ...processTasks,
    ...buildDailyDemoCuttingTasks(query),
  ]
  const scopedTasks = taskSourceRows
    .filter(isCuttingProcessTask)
    .filter((task) => matchesKeyword([task.taskNo, task.taskId, task.productionOrderId, task.processNameZh], query.keyword))
    .filter((task) => matchesExecutionOwner(taskOwner(task), query))
  const taskRows = buildTaskRows(scopedTasks, query)
  const markerRows = buildMarkerRows(markerPlanView.plans, query)
  const spreadingRows = [
    ...buildSpreadingRows(spreadingView.spreadingSessions, query, markerOwnerById),
    ...buildDailyDemoSpreadingRows(query),
  ]
  const fulfillmentRows = buildFulfillmentRows(sources, query)
  const materialRows = [
    ...buildMaterialRows(sources, query),
    ...buildDailyDemoMaterialRows(query),
  ]
  const ticketRows = buildTicketRows(sources, query)
  const warehouseRows = [
    ...buildWarehouseRows(sources, query),
    ...buildDailyDemoWarehouseRows(query),
  ]

  const detailRowsByTab: Record<CuttingDailyTab, CuttingDailyDetailRow[]> = {
    overview: [],
    tasks: taskRows,
    marker: markerRows,
    spreading: spreadingRows,
    fulfillment: fulfillmentRows,
    materials: materialRows,
    tickets: ticketRows,
    warehouse: warehouseRows,
  }
  const productionContributions = buildProductionContributions(sources, spreadingRows, warehouseRows, query)
  const timeline = buildTimeline(detailRowsByTab)
  detailRowsByTab.overview = timeline
  const cutActivityProductionOrderNos = new Set(
    productionContributions
      .filter((row) => row.actualCutPieceQty > 0)
      .map((row) => row.productionOrderNo),
  )
  fulfillmentRows.forEach((row) => {
    if (row.objectType === '生产单齐套' && cutActivityProductionOrderNos.has(row.productionOrderNo)) {
      row.metricKeys = unique([...row.metricKeys, 'fulfillment.orders'])
    }
  })
  const cutActivityProductionOrderCount = cutActivityProductionOrderNos.size

  const completedSpreadingRows = spreadingRows.filter((row) => row.metricKeys.includes('spreading.completed'))
  const completedCuttingRows = spreadingRows.filter((row) => row.metricKeys.includes('cutting.completed'))
  const cuttingGarmentRows = spreadingRows.filter((row) => row.metricKeys.includes('cutting.garmentQty'))
  const actualCutPieceQty = summarizeUnits(completedCuttingRows, '片')
  const actualCutGarmentQty = summarizeUnits(cuttingGarmentRows, '件')
  const fulfillmentHasPartial = productionContributions.some((row) => row.actualCutGarmentQty === null && row.actualCutPieceQty > 0)
  const materialPreparedRows = materialRows.filter((row) => row.metricKeys.includes('materials.prepared'))
  const materialPreparedQtyRows = materialRows.filter((row) => row.metricKeys.includes('materials.preparedQty'))
  const materialPickupRows = materialRows.filter((row) => row.metricKeys.includes('materials.pickup'))
  const materialPieceQty = summarizeUnits(materialPreparedQtyRows, '已领')
  const materialProcessingRows = materialRows.filter((row) => row.metricKeys.includes('materials.processingIssue'))
  const materialReturnedRows = materialRows.filter((row) => row.metricKeys.includes('materials.returned'))
  const ticketPieceQty = summarizeUnits(ticketRows, '片')
  const warehouseInboundRows = warehouseRows.filter((row) => row.metricKeys.includes('warehouse.inboundPieces'))
  const warehouseHandoverRows = warehouseRows.filter((row) => row.metricKeys.includes('warehouse.handoverPieces'))
  const warehouseDiffRows = warehouseRows.filter((row) => row.metricKeys.includes('warehouse.diffQty'))
  const specialCraftWarehouseRows = warehouseRows.filter((row) => row.metricKeys.includes('warehouse.specialCraftOut'))
  const warehousePieceQty = summarizeUnits(warehouseInboundRows, '片')
  const handoverRecords = listHandoverRecords().filter((record) => occursInReportDate(record.handedOverAt, query))
  const handoverOrders = listHandoverOrders().filter((order) => occursInReportDate(order.createdAt, query))

  const dispatchedTasks = scopedTasks.filter((task) => isTaskDispatchedForMetric(task, query))
  const acceptedTasks = scopedTasks.filter((task) => isTaskAcceptedForMetric(task, query))
  const rejectedTasks = scopedTasks.filter((task) => isTaskRejectedForMetric(task, query))
  const pendingTasks = scopedTasks.filter(isTaskPendingForMetric)
  const confirmedMarkerRows = markerRows.filter((row) => row.status === '已确认')
  const waitingMarkerRows = markerRows.filter((row) => row.status === '待确认')
  const ownMarkerCount = markerPlanView.plans.filter((plan) => ownerFromRoute(plan.executionRoute) === 'OWN').length
  const thirdPartyMarkerCount = markerPlanView.plans.filter((plan) => ownerFromRoute(plan.executionRoute) === 'THIRD_PARTY').length
  const bagUsageCount = sources.transferBagView.usages.filter((usage) =>
    occursInReportDate(usage.finishedPackingAt || usage.startedAt || usage.dispatchAt, query),
  ).length
  const specialCraftReturnCount = specialCraftWarehouseRows.length

  const metricGroups: CuttingDailyMetricGroup[] = [
    {
      key: 'taskAcceptance',
      title: '任务派接',
      metrics: [
        metric({ key: 'tasks.dispatched', label: '今日派给本厂裁剪任务数', value: dispatchedTasks.length, unit: '个任务', tab: 'tasks', recordCount: dispatchedTasks.length, helperText: '按 dispatchedAt 或演示任务创建时间去重统计。', latestOccurredAt: latestText(dispatchedTasks.map((task) => task.dispatchedAt || task.createdAt)) }),
        metric({ key: 'tasks.accepted', label: '今日接单任务数', value: acceptedTasks.length, unit: '个任务', tab: 'tasks', recordCount: acceptedTasks.length, helperText: '按 acceptedAt 或接单状态统计。', latestOccurredAt: latestText(acceptedTasks.map((task) => task.acceptedAt || task.updatedAt)), detailStatus: '已接单' }),
        metric({ key: 'tasks.rejected', label: '今日拒单任务数', value: rejectedTasks.length, unit: '个任务', tab: 'tasks', recordCount: rejectedTasks.length, helperText: '优先读取拒单状态和拒单日志。', latestOccurredAt: latestText(rejectedTasks.flatMap((task) => task.auditLogs.map((log) => log.at))), detailStatus: '已拒单' }),
        metric({ key: 'tasks.pending', label: '截至查询时点待接任务数', value: pendingTasks.length, unit: '个任务', tab: 'tasks', recordCount: pendingTasks.length, helperText: '当前已派出但未接、未拒、未取消的任务。', latestOccurredAt: latestText(pendingTasks.map((task) => task.dispatchedAt || task.updatedAt)), detailStatus: '待接单' }),
      ],
    },
    {
      key: 'markerPlans',
      title: '唛架计划',
      metrics: [
        metric({ key: 'marker.created', label: '今日新建唛架方案数', value: markerRows.length, unit: '个方案', tab: 'marker', recordCount: markerRows.length, helperText: '按 markerPlanId 去重，createdAt 落入统计窗口。', latestOccurredAt: latestText(markerRows.map((row) => row.occurredAt)) }),
        metric({ key: 'marker.beds', label: '今日新增床次数', value: sum(markerPlanView.plans.filter((plan) => occursInReportDate(plan.createdAt, query) || query.includeDemoData).map((plan) => plan.beds?.length || 0)), unit: '个床次', tab: 'marker', recordCount: markerRows.length, helperText: '方案内 beds 数量汇总，和方案数分开统计。' }),
        metric({ key: 'marker.own', label: '本厂执行方案数', value: ownMarkerCount, unit: '个方案', tab: 'marker', recordCount: ownMarkerCount, helperText: '使用现有 executionRoute 识别本厂执行。' }),
        metric({ key: 'marker.thirdParty', label: '三方工厂执行方案数', value: thirdPartyMarkerCount, unit: '个方案', tab: 'marker', recordCount: thirdPartyMarkerCount, helperText: '使用现有 executionRoute 识别三方 PDA 执行。' }),
        metric({ key: 'marker.confirmed', label: '今日确认方案数', value: confirmedMarkerRows.length, unit: '个方案', tab: 'marker', recordCount: confirmedMarkerRows.length, helperText: '按 confirmedAt 或确认状态统计。', latestOccurredAt: latestText(confirmedMarkerRows.map((row) => row.occurredAt)) }),
        metric({ key: 'marker.waiting', label: '当前待确认方案数', value: waitingMarkerRows.length, unit: '个方案', tab: 'marker', recordCount: waitingMarkerRows.length, helperText: '当前确认状态为待确认的有效方案。' }),
      ],
    },
    {
      key: 'spreadingCutting',
      title: '铺布裁剪',
      metrics: [
        metric({ key: 'spreading.created', label: '今日创建铺布单数', value: spreadingRows.length, unit: '张铺布单', tab: 'spreading', recordCount: spreadingRows.length, helperText: '按铺布会话 createdAt 或演示记录回放统计。', latestOccurredAt: latestText(spreadingRows.map((row) => row.occurredAt)) }),
        metric({ key: 'spreading.completed', label: '今日完成铺布单数', value: completedSpreadingRows.length, unit: '张铺布单', tab: 'spreading', recordCount: completedSpreadingRows.length, helperText: '铺布状态为已完成，按 actualEndAt 或更新记录统计。' }),
        metric({ key: 'cutting.completed', label: '今日完成裁剪单数', value: completedCuttingRows.length, unit: '张裁剪单', tab: 'spreading', recordCount: completedCuttingRows.length, helperText: '有裁剪产出数量的铺布记录。' }),
        metric({ key: 'cutting.pieceQty', label: '今日实裁裁片数量', value: actualCutPieceQty, unit: '片', tab: 'spreading', recordCount: completedCuttingRows.length, helperText: '汇总铺布/裁剪产出行 actualCutPieceQty，缺失时不估算。', availability: actualCutPieceQty > 0 ? 'AVAILABLE' : 'NO_RECORDS' }),
        metric({ key: 'cutting.garmentQty', label: '今日裁剪等效成衣数量', value: actualCutGarmentQty || null, unit: '件', tab: 'spreading', recordCount: cuttingGarmentRows.length, helperText: fulfillmentHasPartial ? '部分铺布单缺少生产单产出分配，等效成衣仅展示可计算部分。' : '按当前可计算的生产单贡献汇总。', availability: fulfillmentHasPartial ? 'PARTIAL' : actualCutGarmentQty > 0 ? 'AVAILABLE' : 'NO_RECORDS' }),
      ],
    },
    {
      key: 'fulfillment',
      title: '生产单满足与齐套',
      metrics: [
        metric({ key: 'fulfillment.orders', label: '今日发生裁剪的生产单数', value: cutActivityProductionOrderCount, unit: '个生产单', tab: 'fulfillment', recordCount: cutActivityProductionOrderCount, helperText: '按生产单去重，不按裁片单重复累计。' }),
        metric({ key: 'fulfillment.cutCompleteKit', label: '当前累计已裁齐套数量', value: sum(productionContributions.map((row) => row.completeKitQty)), unit: '件', tab: 'fulfillment', recordCount: productionContributions.length, helperText: '当前累计齐套结果，不写作今日齐套。' }),
        metric({ key: 'fulfillment.inboundCompleteKit', label: '当前累计已入仓齐套数量', value: sum(productionContributions.map((row) => row.inboundQty)), unit: '件', tab: 'fulfillment', recordCount: productionContributions.length, helperText: '来自入仓裁片投影，当前累计参考。' }),
        metric({ key: 'fulfillment.incompleteQty', label: '当前未齐套数量', value: sum(productionContributions.map((row) => row.incompleteQty)), unit: '件', tab: 'fulfillment', recordCount: productionContributions.length, helperText: '生产单剩余需求减当前已裁齐套，结果不小于零。' }),
        metric({ key: 'fulfillment.releaseQty', label: '当前可放行数量', value: sum(listCutPieceReleaseRecords().map((row) => row.releaseQty)), unit: '件', tab: 'fulfillment', recordCount: listCutPieceReleaseRecords().length, helperText: '来自裁片放行记录的当前可放行数量。' }),
      ],
    },
    {
      key: 'materials',
      title: '物料领退',
      metrics: [
        metric({ key: 'materials.prepared', label: '今日配料记录数', value: materialPreparedRows.length, unit: '条', tab: 'materials', recordCount: materialPreparedRows.length, helperText: '配料行和领取记录按当前统计范围展示。', latestOccurredAt: latestText(materialPreparedRows.map((row) => row.occurredAt)) }),
        metric({ key: 'materials.preparedQty', label: '今日配料数量', value: materialPieceQty || null, unit: '原始单位', tab: 'materials', recordCount: materialPreparedQtyRows.length, helperText: '不同单位不直接合并；页面明细保留原单位。', availability: materialPreparedQtyRows.length ? 'PARTIAL' : 'NO_RECORDS' }),
        metric({ key: 'materials.pickup', label: '今日中转仓领料数量', value: materialPickupRows.length, unit: '条记录', tab: 'materials', recordCount: materialPickupRows.length, helperText: '按现有 claimRecords 和 PDA pickup 事件投影统计。' }),
        metric({ key: 'materials.processingIssue', label: '今日加工领料数量', value: summarizeUnits(materialProcessingRows, '卷'), unit: '卷', tab: 'materials', recordCount: materialProcessingRows.length, helperText: '待加工仓加工领料按可回溯记录展示。' }),
        metric({ key: 'materials.returned', label: '今日回收入仓数量', value: summarizeUnits(materialReturnedRows, '卷'), unit: '卷', tab: 'materials', recordCount: materialReturnedRows.length, helperText: '加工剩余回收入仓按待加工仓回仓记录展示。' }),
      ],
    },
    {
      key: 'warehouse',
      title: '仓库交出',
      metrics: [
        metric({ key: 'warehouse.inboundPieces', label: '今日裁片入待交出仓数量', value: warehousePieceQty, unit: '片', tab: 'warehouse', recordCount: warehouseInboundRows.length, helperText: '待交出仓入仓和交出记录按正式记录优先去重展示。' }),
        metric({ key: 'warehouse.bags', label: '今日完成装袋数量', value: bagUsageCount, unit: '袋次', tab: 'tickets', recordCount: bagUsageCount, helperText: '中转袋按使用周期统计，不按主档实体袋重复解释。' }),
        metric({ key: 'warehouse.handoverPieces', label: '今日交出裁片数量', value: sum(handoverRecords.map((record) => sum(record.currentHandedOverSummary.map((item) => item.qty)))), unit: '片', tab: 'warehouse', recordCount: warehouseHandoverRows.length, helperText: '交出单与交出记录分开统计，此处为交出记录数量。' }),
        metric({ key: 'warehouse.specialCraftOut', label: '今日特殊工艺交出数量', value: specialCraftReturnCount, unit: '条记录', tab: 'warehouse', recordCount: specialCraftReturnCount, helperText: '来自特殊工艺视图当前可追踪记录。' }),
        metric({ key: 'warehouse.diffQty', label: '今日接收差异数量', value: sum(handoverRecords.flatMap((record) => record.discrepancyItems.map((item) => item.differenceQty))), unit: '片', tab: 'warehouse', recordCount: warehouseDiffRows.length, helperText: '来自接收回写差异项。' }),
        metric({ key: 'warehouse.handoverOrders', label: '今日新建交出单数', value: handoverOrders.length, unit: '张交出单', tab: 'warehouse', recordCount: handoverOrders.length, helperText: '交出单数不等于交出记录数。' }),
      ],
    },
  ]

  const coverageRows = [
    coverage({ moduleKey: 'tasks', moduleName: '任务派接', recordCount: taskRows.length, latestRecordedAt: latestText(taskRows.map((row) => row.occurredAt)) }),
    coverage({ moduleKey: 'marker', moduleName: '唛架方案', recordCount: markerRows.length, latestRecordedAt: latestText(markerRows.map((row) => row.occurredAt)) }),
    coverage({ moduleKey: 'spreading', moduleName: '铺布与裁剪', recordCount: spreadingRows.length, latestRecordedAt: latestText(spreadingRows.map((row) => row.occurredAt)), status: fulfillmentHasPartial ? 'PARTIAL' : undefined, reason: fulfillmentHasPartial ? '部分铺布单缺少生产单产出分配，齐套与等效成衣只展示可计算部分。' : undefined }),
    coverage({ moduleKey: 'materials', moduleName: '配料与领料', recordCount: materialRows.length, latestRecordedAt: latestText(materialRows.map((row) => row.occurredAt)) }),
    coverage({ moduleKey: 'fei', moduleName: '菲票打印', recordCount: sources.feiViewModel.ticketRecords.length, latestRecordedAt: latestText(sources.feiViewModel.ticketRecords.map((row) => row.printedAt)) }),
    coverage({ moduleKey: 'numbering', moduleName: '菲票打编号', recordCount: listFeiTicketNumberingRecords().length, latestRecordedAt: latestText(listFeiTicketNumberingRecords().map((row) => row.completedAt)) }),
    coverage({ moduleKey: 'bags', moduleName: '中转袋', recordCount: bagUsageCount, latestRecordedAt: latestText(sources.transferBagView.usages.map((row) => row.finishedPackingAt || row.startedAt || row.dispatchAt)) }),
    coverage({ moduleKey: 'wait-process', moduleName: '待加工仓', recordCount: 0, status: 'UNAVAILABLE', reason: '当前记录不足，暂不能可靠回溯加工领料与回收入仓。' }),
    coverage({ moduleKey: 'wait-handover', moduleName: '待交出仓', recordCount: warehouseRows.length, latestRecordedAt: latestText(warehouseRows.map((row) => row.occurredAt)) }),
    coverage({ moduleKey: 'handover', moduleName: '交出记录', recordCount: handoverRecords.length, latestRecordedAt: latestText(handoverRecords.map((row) => row.handedOverAt)) }),
    coverage({ moduleKey: 'special-craft', moduleName: '特殊工艺交出与回仓', recordCount: specialCraftReturnCount, status: specialCraftReturnCount ? 'RECORDED' : 'NO_RECORDS' }),
  ]

  const tabSummary = Object.fromEntries(cuttingDailyTabs.map((tab) => {
    const rows = detailRowsByTab[tab.key]
    return [tab.key, {
      label: tab.label,
      count: rows.length,
      partialCount: rows.filter((row) => /部分|不可|缺少|待/.test(row.status + row.summary)).length,
    }]
  })) as CuttingDailyProductionReport['tabSummary']

  const warnings: CuttingDailyReportWarning[] = [
    {
      level: '提示',
      message: '本报表根据当前系统中已经形成的业务记录动态统计，历史数据可能因后续补录发生变化。',
    },
  ]
  if (query.includeDemoData) {
    warnings.push({
      level: '提示',
      message: '当前统计包含系统预置演示记录，不代表真实工厂生产结果。',
    })
  }
  if (fulfillmentHasPartial) {
    warnings.push({
      level: '需关注',
      message: '部分铺布/裁剪记录缺少生产单产出分配，齐套与等效成衣为部分可计算。',
    })
  }

  const { windowStartAt, windowEndAt } = buildWindow(query)
  return {
    queryId: makeQueryId(query),
    query,
    factoryName: resolveFactoryName(query.factoryId),
    windowStartAt,
    windowEndAt,
    generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    isDynamic: true,
    metricGroups,
    coverage: coverageRows,
    warnings,
    productionContributions,
    timeline,
    detailRowsByTab,
    tabSummary,
    totals: {
      recordedCoverageCount: coverageRows.filter((row) => row.status === 'RECORDED').length,
      noRecordCoverageCount: coverageRows.filter((row) => row.status === 'NO_RECORDS').length,
      partialCoverageCount: coverageRows.filter((row) => row.status === 'PARTIAL').length,
      totalDetailCount: Object.entries(detailRowsByTab)
        .filter(([tab]) => tab !== 'overview')
        .reduce((total, [, rows]) => total + rows.length, 0),
    },
  }
}

export function buildCuttingDailyProductionReport(
  input: Partial<CuttingDailyProductionReportQuery> = {},
): CuttingDailyProductionReport {
  const query = normalizeQuery(input)
  const snapshot = buildFcsCuttingDomainSnapshot()
  const sources = mapCuttingDomainSnapshotToSummaryBuildOptions(snapshot)
  return buildReportFromSources(query, sources)
}

export function getCuttingDailyExecutionOwnerLabel(owner: CuttingDailyExecutionOwner): string {
  return executionOwnerLabelMap[owner] || executionOwnerLabelMap.ALL
}

export function getCuttingDailyTabLabel(tab: CuttingDailyTab): string {
  return tabLabelMap[tab] || tabLabelMap.overview
}
