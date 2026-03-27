import { appStore } from '../../state/store'
import { escapeHtml, formatDateTime } from '../../utils'
import { renderFormDialog, renderConfirmDialog } from '../../components/ui/dialog'
import { productionDemands, type ProductionDemand } from '../../data/fcs/production-demands'
import {
  productionOrders,
  type ProductionOrder,
  type ProductionOrderStatus,
  type AssignmentProgressStatus,
  type AuditLog,
  type RiskFlag,
  productionOrderStatusConfig,
  assignmentProgressStatusConfig,
  riskFlagConfig,
} from '../../data/fcs/production-orders'
import {
  indonesiaFactories,
  type FactoryTier,
  type FactoryType,
  typesByTier,
  tierLabels,
  typeLabels,
} from '../../data/fcs/indonesia-factories'
import { getTechPackBySpuCode } from '../../data/fcs/tech-packs'
import { legalEntities } from '../../data/fcs/legal-entities'
import {
  getRuntimeAssignmentSummaryByOrder,
  getRuntimeBiddingSummaryByOrder,
  getRuntimeTaskById,
  getRuntimeTaskCountByOrder,
  listRuntimeTaskSplitGroupsByOrder,
  listRuntimeTasksByOrder,
  type RuntimeProcessTask,
  type RuntimeTaskSplitGroupSnapshot,
} from '../../data/fcs/runtime-process-tasks'
import { summarizeTaskDetailRows } from '../../data/fcs/task-detail-rows'
import {
  applyQualitySeedBootstrap,
} from '../../data/fcs/store-domain-quality-bootstrap'
import {
  initialDeductionBasisItems,
  initialAllocationByTaskId,
} from '../../data/fcs/store-domain-quality-seeds'
import {
  listLegacyLikeQualityInspectionsForTailPages,
  listLegacyLikeDyePrintOrdersForTailPages,
} from '../../data/fcs/page-adapters/long-tail-pages-adapter'
import {
  initialStatementDrafts,
  initialSettlementBatches,
  initialProductionOrderChanges,
} from '../../data/fcs/store-domain-settlement-seeds'
import type {
  ProductionOrderChange,
  ProductionChangeType,
  ProductionChangeStatus,
} from '../../data/fcs/store-domain-settlement-types'
import {
  addMaterialToDraft,
  confirmMaterialRequestDraft,
  getMaterialDraftIndicatorsByOrder,
  getDraftStatusLabel,
  getMaterialRequestDraftById,
  getMaterialRequestDraftSummaryByOrder,
  listMaterialDraftOperationLogsByOrder,
  getSupplementOptionDisplayRows,
  getTaskTypeLabel,
  listMaterialRequestDraftsByOrder,
  restoreMaterialDraftSuggestion,
  setMaterialDraftLineConfirmedQty,
  setMaterialDraftMode,
  setMaterialDraftNeedMaterial,
  setMaterialDraftRemark,
  toggleMaterialDraftLine,
  type MaterialRequestDraft,
  type MaterialMode,
} from '../../data/fcs/material-request-drafts'

applyQualitySeedBootstrap()

const PAGE_SIZE = 10

type OrderViewMode = 'table' | 'board'
type OrderDetailTab = 'overview' | 'demand-snapshot' | 'tech-pack' | 'assignment' | 'handover' | 'logs'
type AssignmentModeFilter = 'ALL' | 'DIRECT_ONLY' | 'BIDDING_ONLY' | 'MIXED'
type BiddingRiskFilter = 'ALL' | 'OVERDUE' | 'NEAR_DEADLINE' | 'NONE'
type OrderMaterialStageFilter = 'ALL' | 'PREVIEW' | 'ACTUAL_PENDING' | 'ACTUAL_CONFIRMED'
type LifecycleStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'RELEASED'
  | 'IN_PRODUCTION'
  | 'QC_PENDING'
  | 'COMPLETED'
  | 'CLOSED'

type DemandOwnerPartyType = 'FACTORY' | 'LEGAL_ENTITY'

interface PlanForm {
  planStartDate: string
  planEndDate: string
  planQty: string
  planFactoryId: string
  planFactoryName: string
  planRemark: string
}

interface DeliveryForm {
  productionOrderId: string
  deliveryWarehouseId: string
  deliveryWarehouseName: string
  deliveryWarehouseRemark: string
}

interface ChangeCreateForm {
  productionOrderId: string
  changeType: ProductionChangeType | ''
  beforeValue: string
  afterValue: string
  impactScopeZh: string
  reason: string
  remark: string
}

interface ChangeStatusForm {
  nextStatus: ProductionChangeStatus | ''
  remark: string
}

interface ProductionState {
  demands: ProductionDemand[]
  orders: ProductionOrder[]
  changes: ProductionOrderChange[]

  demandKeyword: string
  demandStatusFilter: ProductionDemand['demandStatus'] | 'ALL'
  demandTechPackFilter: ProductionDemand['techPackStatus'] | 'ALL'
  demandHasOrderFilter: 'ALL' | 'YES' | 'NO'
  demandPriorityFilter: ProductionDemand['priority'] | 'ALL'
  demandOnlyUngenerated: boolean
  demandSelectedIds: Set<string>
  demandDetailId: string | null
  demandBatchDialogOpen: boolean
  demandSingleGenerateId: string | null
  demandGenerateConfirmOpen: boolean
  demandSelectedFactoryId: string
  demandTierFilter: FactoryTier | 'ALL'
  demandTypeFilter: FactoryType | 'ALL'
  demandFactorySearch: string
  demandShowAdvanced: boolean
  demandOwnerPartyManual: boolean
  demandOwnerPartyType: DemandOwnerPartyType
  demandOwnerPartyId: string
  demandOwnerReason: string

  ordersKeyword: string
  ordersStatusFilter: ProductionOrderStatus[]
  ordersTechPackFilter: 'ALL' | ProductionDemand['techPackStatus']
  ordersBreakdownFilter: 'ALL' | 'PENDING' | 'ACTIVE'
  ordersAssignmentProgressFilter: 'ALL' | AssignmentProgressStatus
  ordersAssignmentModeFilter: AssignmentModeFilter
  ordersBiddingRiskFilter: BiddingRiskFilter
  ordersTierFilter: FactoryTier | 'ALL'
  ordersHasMaterialDraftFilter: 'ALL' | 'YES' | 'NO'
  ordersHasConfirmedMaterialRequestFilter: 'ALL' | 'YES' | 'NO'
  ordersMaterialStageFilter: OrderMaterialStageFilter
  ordersCurrentPage: number
  ordersSelectedIds: Set<string>
  ordersDemandSnapshotId: string | null
  ordersLogsId: string | null
  ordersActionMenuId: string | null
  ordersFromDemandDialogOpen: boolean
  ordersFromDemandSelectedIds: Set<string>
  materialDraftOrderId: string | null
  materialDraftAddDraftId: string | null
  materialDraftAddSelections: Set<string>
  ordersViewMode: OrderViewMode

  planKeyword: string
  planStatusFilter: 'ALL' | 'UNPLANNED' | 'PLANNED' | 'RELEASED'
  planFactoryFilter: 'ALL' | string
  planEditOrderId: string | null
  planForm: PlanForm

  deliveryKeyword: string
  deliveryStatusFilter: 'ALL' | 'UNSET' | 'SET'
  deliveryEditOrderId: string | null
  deliveryForm: DeliveryForm

  changesKeyword: string
  changesTypeFilter: 'ALL' | ProductionChangeType
  changesStatusFilter: 'ALL' | ProductionChangeStatus
  changesCreateOpen: boolean
  changesCreateForm: ChangeCreateForm
  changesCreateErrors: Record<string, string>
  changesStatusOpen: boolean
  changesStatusTarget: { changeId: string; currentStatus: ProductionChangeStatus } | null
  changesStatusForm: ChangeStatusForm
  changesStatusError: string

  statusKeyword: string
  statusFilter: 'ALL' | LifecycleStatus
  statusDialogOpen: boolean
  statusSelectedOrderId: string | null
  statusNext: '' | LifecycleStatus
  statusRemark: string

  detailCurrentOrderId: string | null
  detailTab: OrderDetailTab
  detailLogsOpen: boolean
  detailSimulateOpen: boolean
  detailSimulateStatus: ProductionOrderStatus
  detailConfirmSimulateOpen: boolean
}

const currentUser = {
  id: 'U001',
  name: 'Budi Santoso',
  role: 'ADMIN' as const,
}

const PLAN_EMPTY_FORM: PlanForm = {
  planStartDate: '',
  planEndDate: '',
  planQty: '',
  planFactoryId: '',
  planFactoryName: '',
  planRemark: '',
}

const DELIVERY_EMPTY_FORM: DeliveryForm = {
  productionOrderId: '',
  deliveryWarehouseId: '',
  deliveryWarehouseName: '',
  deliveryWarehouseRemark: '',
}

const CHANGE_CREATE_EMPTY_FORM: ChangeCreateForm = {
  productionOrderId: '',
  changeType: '',
  beforeValue: '',
  afterValue: '',
  impactScopeZh: '',
  reason: '',
  remark: '',
}

const CHANGE_STATUS_EMPTY_FORM: ChangeStatusForm = {
  nextStatus: '',
  remark: '',
}

const demandStatusConfig: Record<ProductionDemand['demandStatus'], { label: string; className: string }> = {
  PENDING_CONVERT: { label: '待转单', className: 'bg-blue-100 text-blue-700' },
  CONVERTED: { label: '已转单', className: 'bg-green-100 text-green-700' },
  HOLD: { label: '已挂起', className: 'bg-yellow-100 text-yellow-700' },
  CANCELLED: { label: '已取消', className: 'bg-gray-100 text-gray-600' },
}

const demandTechPackStatusConfig: Record<ProductionDemand['techPackStatus'], { label: string; className: string }> = {
  INCOMPLETE: { label: '待完善', className: 'bg-orange-100 text-orange-700' },
  RELEASED: { label: '已发布', className: 'bg-green-100 text-green-700' },
}

const demandPriorityConfig: Record<ProductionDemand['priority'], { label: string; className: string }> = {
  URGENT: { label: '紧急', className: 'bg-red-100 text-red-700' },
  HIGH: { label: '高', className: 'bg-orange-100 text-orange-700' },
  NORMAL: { label: '普通', className: 'bg-blue-100 text-blue-700' },
}

const lifecycleStatusLabel: Record<LifecycleStatus, string> = {
  DRAFT: '草稿',
  PLANNED: '已计划',
  RELEASED: '已下发',
  IN_PRODUCTION: '生产中',
  QC_PENDING: '待质检',
  COMPLETED: '已完成',
  CLOSED: '已关闭',
}

const lifecycleStatusClass: Record<LifecycleStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  PLANNED: 'bg-blue-100 text-blue-700',
  RELEASED: 'bg-indigo-100 text-indigo-700',
  IN_PRODUCTION: 'bg-cyan-100 text-cyan-700',
  QC_PENDING: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
}

const taskStatusLabel: Record<RuntimeProcessTask['status'], string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS: '进行中',
  DONE: '已完成',
  BLOCKED: '当前生产暂停',
  CANCELLED: '已取消',
}

const taskStatusClass: Record<RuntimeProcessTask['status'], string> = {
  NOT_STARTED: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DONE: 'bg-green-100 text-green-700',
  BLOCKED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
}

const changeTypeLabels: Record<ProductionChangeType, string> = {
  QTY_CHANGE: '数量变更',
  DATE_CHANGE: '日期变更',
  FACTORY_CHANGE: '工厂变更',
  STYLE_CHANGE: '款式信息变更',
  OTHER: '其他',
}

const changeStatusLabels: Record<ProductionChangeStatus, string> = {
  DRAFT: '草稿',
  PENDING: '待处理',
  DONE: '已完成',
  CANCELLED: '已取消',
}

const changeStatusClass: Record<ProductionChangeStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  PENDING: 'bg-blue-100 text-blue-700',
  DONE: 'bg-white text-slate-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const changeAllowedNext: Record<ProductionChangeStatus, ProductionChangeStatus[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['DONE', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
}

const lifecycleAllowedNext: Record<LifecycleStatus, LifecycleStatus[]> = {
  DRAFT: ['PLANNED'],
  PLANNED: ['RELEASED'],
  RELEASED: ['IN_PRODUCTION', 'PLANNED'],
  IN_PRODUCTION: ['QC_PENDING', 'RELEASED'],
  QC_PENDING: ['COMPLETED', 'IN_PRODUCTION'],
  COMPLETED: ['CLOSED', 'QC_PENDING'],
  CLOSED: [],
}

const keyProcessKeywords = ['裁剪', '染印', '车缝', '后整', '后道']

function cloneDemand(demand: ProductionDemand): ProductionDemand {
  return {
    ...demand,
    marketScopes: [...demand.marketScopes],
    skuLines: demand.skuLines.map((sku) => ({ ...sku })),
  }
}

function cloneOrder(order: ProductionOrder): ProductionOrder {
  return {
    ...order,
    mainFactorySnapshot: {
      ...order.mainFactorySnapshot,
      tags: [...order.mainFactorySnapshot.tags],
    },
    techPackSnapshot: { ...order.techPackSnapshot },
    demandSnapshot: {
      ...order.demandSnapshot,
      skuLines: order.demandSnapshot.skuLines.map((sku) => ({ ...sku })),
    },
    assignmentSummary: { ...order.assignmentSummary },
    assignmentProgress: { ...order.assignmentProgress },
    biddingSummary: { ...order.biddingSummary },
    directDispatchSummary: { ...order.directDispatchSummary },
    taskBreakdownSummary: {
      ...order.taskBreakdownSummary,
      taskTypesTop3: [...order.taskBreakdownSummary.taskTypesTop3],
    },
    riskFlags: [...order.riskFlags],
    auditLogs: order.auditLogs.map((log) => ({ ...log })),
  }
}

function cloneChange(change: ProductionOrderChange): ProductionOrderChange {
  return {
    ...change,
  }
}

function normalizeSeedChanges(
  seedChanges: ProductionOrderChange[],
  orders: ProductionOrder[],
): ProductionOrderChange[] {
  if (orders.length === 0) return seedChanges.map(cloneChange)

  return seedChanges.map((change, index) => {
    const hasOrder = orders.some((order) => order.productionOrderId === change.productionOrderId)
    if (hasOrder) return cloneChange(change)

    const replacementOrder = orders[index % orders.length]
    return {
      ...cloneChange(change),
      productionOrderId: replacementOrder.productionOrderId,
    }
  })
}

function toTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

let productionCoreLocalSeq = 0

function nextLocalEntityId(prefix: string, width = 6): string {
  productionCoreLocalSeq += 1
  return `${prefix}-${String(productionCoreLocalSeq).padStart(width, '0')}`
}

function nextChangeId(month: string, existingIds: Set<string>): string {
  const prefix = `CHG-${month}-`
  let max = 0
  existingIds.forEach((id) => {
    if (!id.startsWith(prefix)) return
    const tail = Number(id.slice(prefix.length))
    if (Number.isFinite(tail) && tail > max) max = tail
  })
  const next = max + 1
  return `${prefix}${String(next).padStart(4, '0')}`
}

function showPlanMessage(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'production-plan-toast-root'
  let root = document.getElementById(rootId)

  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-6 top-20 z-[120] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }

  const toast = document.createElement('div')
  toast.className =
    tone === 'error'
      ? 'pointer-events-auto rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-md transition-all duration-200'
      : 'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200'

  toast.textContent = message
  toast.style.opacity = '0'
  toast.style.transform = 'translateY(-6px)'

  root.appendChild(toast)

  window.requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateY(0)'
  })

  window.setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(-6px)'
    window.setTimeout(() => {
      toast.remove()
      if (root && root.childElementCount === 0) {
        root.remove()
      }
    }, 180)
  }, 2200)
}

function includesKeyword(value: string, keyword: string): boolean {
  return value.toLowerCase().includes(keyword)
}

function safeText(value: string | null | undefined): string {
  if (!value) return '-'
  return value
}

function renderBadge(text: string, className: string): string {
  return `<span class="inline-flex rounded border px-2 py-0.5 text-xs ${className}">${escapeHtml(text)}</span>`
}

function renderSplitEventList(events: RuntimeTaskSplitGroupSnapshot[], limit = 3): string {
  if (events.length === 0) {
    return '<p class="text-xs text-muted-foreground">暂无拆分事件</p>'
  }

  return events
    .slice(0, limit)
    .map((event) => {
      const resultText = event.resultTasks
        .map((task) => `${task.taskNo}（${task.assignedFactoryName || '-'}，${taskStatusLabel[task.status]}）`)
        .join('；')
      return `
        <div class="rounded-md border bg-muted/20 px-2.5 py-2 text-xs">
          <p>来源任务：${escapeHtml(event.sourceTaskNo)} · 拆分组：${escapeHtml(event.splitGroupId)}</p>
          <p class="mt-0.5 text-muted-foreground">结果任务：${event.resultTasks.length} 条 · 工厂：${escapeHtml(event.factorySummary)} · 状态：${escapeHtml(event.statusSummary)}</p>
          <p class="mt-0.5 text-muted-foreground">${escapeHtml(resultText || '-')}</p>
        </div>
      `
    })
    .join('')
}

function deriveRuntimeAssignmentProgressStatus(input: {
  totalTasks: number
  unassignedCount: number
  directAssignedCount: number
  biddingLaunchedCount: number
  biddingAwardedCount: number
}): AssignmentProgressStatus {
  if (input.totalTasks === 0) return 'NOT_READY'

  const handledCount =
    input.directAssignedCount + input.biddingLaunchedCount + input.biddingAwardedCount
  if (handledCount === 0) return 'PENDING'

  if (input.unassignedCount === 0 && input.directAssignedCount + input.biddingAwardedCount >= input.totalTasks) {
    return 'DONE'
  }

  return 'IN_PROGRESS'
}

function getOrderRuntimeAssignmentSnapshot(order: ProductionOrder): {
  assignmentSummary: ProductionOrder['assignmentSummary']
  assignmentProgress: ProductionOrder['assignmentProgress']
  biddingSummary: ProductionOrder['biddingSummary']
  directDispatchSummary: ProductionOrder['directDispatchSummary']
} {
  const runtimeTaskCount = getRuntimeTaskCountByOrder(order.productionOrderId)
  if (runtimeTaskCount === 0) {
    const emptySummary = {
      totalTasks: 0,
      directCount: 0,
      biddingCount: 0,
      unassignedCount: 0,
      directAssignedCount: 0,
      biddingLaunchedCount: 0,
      biddingAwardedCount: 0,
      assignedFactoryCount: 0,
      rejectedCount: 0,
      overdueAckCount: 0,
    }
    return {
      assignmentSummary: {
        directCount: 0,
        biddingCount: 0,
        totalTasks: 0,
        unassignedCount: 0,
      },
      assignmentProgress: {
        directAssignedCount: 0,
        biddingLaunchedCount: 0,
        biddingAwardedCount: 0,
        status: deriveRuntimeAssignmentProgressStatus(emptySummary),
      },
      biddingSummary: {
        activeTenderCount: 0,
        nearestDeadline: undefined,
        overdueTenderCount: 0,
      },
      directDispatchSummary: {
        assignedFactoryCount: 0,
        rejectedCount: 0,
        overdueAckCount: 0,
      },
    }
  }

  const assignmentSummary = getRuntimeAssignmentSummaryByOrder(order.productionOrderId)
  const biddingSummary = getRuntimeBiddingSummaryByOrder(order.productionOrderId)
  const assignmentProgress = {
    directAssignedCount: assignmentSummary.directAssignedCount,
    biddingLaunchedCount: assignmentSummary.biddingLaunchedCount,
    biddingAwardedCount: assignmentSummary.biddingAwardedCount,
    status: deriveRuntimeAssignmentProgressStatus({
      totalTasks: assignmentSummary.totalTasks,
      unassignedCount: assignmentSummary.unassignedCount,
      directAssignedCount: assignmentSummary.directAssignedCount,
      biddingLaunchedCount: assignmentSummary.biddingLaunchedCount,
      biddingAwardedCount: assignmentSummary.biddingAwardedCount,
    }),
  }

  const directDispatchSummary = {
    assignedFactoryCount: assignmentSummary.assignedFactoryCount,
    rejectedCount: assignmentSummary.rejectedCount,
    overdueAckCount: assignmentSummary.overdueAckCount,
  }

  return {
    assignmentSummary: {
      directCount: assignmentSummary.directCount,
      biddingCount: assignmentSummary.biddingCount,
      totalTasks: assignmentSummary.totalTasks,
      unassignedCount: assignmentSummary.unassignedCount,
    },
    assignmentProgress,
    biddingSummary,
    directDispatchSummary,
  }
}

interface OrderTaskBreakdownSnapshot {
  isBrokenDown: boolean
  taskTypesTop3: string[]
  detailRowCount: number
  detailRowTotalQty: number
  detailRowPreview: string
  sourceTaskCount: number
  splitSourceCount: number
  splitResultCount: number
  executionTaskCount: number
  splitGroupCount: number
  splitEvents: RuntimeTaskSplitGroupSnapshot[]
  lastBreakdownAt: string
  lastBreakdownBy: string
}

function getRuntimeTaskTypeLabel(task: RuntimeProcessTask): string {
  if (task.taskCategoryZh) return task.taskCategoryZh
  if (task.isSpecialCraft) return task.craftName || task.processBusinessName || task.processNameZh
  return task.processBusinessName || task.processNameZh
}

function getTaskDetailRows(task: RuntimeProcessTask) {
  if (task.scopeDetailRows && task.scopeDetailRows.length > 0) return task.scopeDetailRows
  return task.detailRows ?? []
}

function getOrderTaskBreakdownSnapshot(order: ProductionOrder): OrderTaskBreakdownSnapshot {
  const runtimeTasks = listRuntimeTasksByOrder(order.productionOrderId)
  const splitEvents = listRuntimeTaskSplitGroupsByOrder(order.productionOrderId)
  if (runtimeTasks.length === 0) {
    return {
      isBrokenDown: false,
      taskTypesTop3: [],
      detailRowCount: 0,
      detailRowTotalQty: 0,
      detailRowPreview: '-',
      sourceTaskCount: 0,
      splitSourceCount: 0,
      splitResultCount: 0,
      executionTaskCount: 0,
      splitGroupCount: 0,
      splitEvents: [],
      lastBreakdownAt: '-',
      lastBreakdownBy: '-',
    }
  }

  const typeCounter = new Map<string, number>()
  for (const task of runtimeTasks) {
    const label = getRuntimeTaskTypeLabel(task)
    typeCounter.set(label, (typeCounter.get(label) ?? 0) + 1)
  }

  const taskTypesTop3 = [...typeCounter.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].localeCompare(b[0])
    })
    .slice(0, 3)
    .map(([label]) => label)

  const lastBreakdownAt = runtimeTasks
    .map((task) => task.updatedAt || task.createdAt)
    .sort((a, b) => b.localeCompare(a))[0] || '-'
  const lastBreakdownBy = '系统'
  const detailRowMap = new Map<string, ReturnType<typeof getTaskDetailRows>[number]>()

  for (const task of runtimeTasks) {
    for (const row of getTaskDetailRows(task)) {
      if (!detailRowMap.has(row.rowKey)) detailRowMap.set(row.rowKey, row)
    }
  }
  const detailRowSummary = summarizeTaskDetailRows([...detailRowMap.values()], 2)
  const splitResultCount = runtimeTasks.filter((task) => task.isSplitResult).length
  const splitSourceCount = runtimeTasks.filter((task) => task.isSplitSource).length
  const executionTaskCount = runtimeTasks.filter((task) => task.executionEnabled !== false && task.isSplitSource !== true).length
  const sourceTaskCount = runtimeTasks.filter((task) => !task.isSplitResult).length

  return {
    isBrokenDown: true,
    taskTypesTop3,
    detailRowCount: detailRowSummary.count,
    detailRowTotalQty: detailRowSummary.totalQty,
    detailRowPreview: detailRowSummary.previewText || '-',
    sourceTaskCount,
    splitSourceCount,
    splitResultCount,
    executionTaskCount,
    splitGroupCount: splitEvents.length,
    splitEvents,
    lastBreakdownAt,
    lastBreakdownBy,
  }
}

function renderStatCard(label: string, value: string | number, valueClass = ''): string {
  return `
    <article class="rounded-lg border bg-card">
      <div class="px-4 pb-4 pt-4">
        <p class="text-xs font-medium leading-snug text-muted-foreground">${escapeHtml(label)}</p>
        <p class="mt-1 text-2xl font-bold ${valueClass}">${typeof value === 'number' ? value.toLocaleString() : escapeHtml(value)}</p>
      </div>
    </article>
  `
}

function renderEmptyRow(colspan: number, text: string): string {
  return `<tr><td colspan="${colspan}" class="h-24 px-4 text-center text-sm text-muted-foreground">${escapeHtml(text)}</td></tr>`
}

function parseOrderSuffix(orderId: string): number {
  const matched = /PO-202603-(\d+)/.exec(orderId)
  if (!matched) return 0
  return Number(matched[1] ?? '0')
}

function nextProductionOrderId(orders: ProductionOrder[]): string {
  let max = 0
  for (const order of orders) {
    max = Math.max(max, parseOrderSuffix(order.productionOrderId))
  }
  return `PO-202603-${String(max + 1).padStart(4, '0')}`
}

function toDemandTechPackStatus(status: 'MISSING' | 'BETA' | 'RELEASED'): ProductionDemand['techPackStatus'] {
  return status === 'RELEASED' ? 'RELEASED' : 'INCOMPLETE'
}

function toOrderTechPackStatus(status: ProductionDemand['techPackStatus']): 'MISSING' | 'BETA' | 'RELEASED' {
  if (status === 'RELEASED') return 'RELEASED'
  return 'BETA'
}

function normalizeTechPackVersionLabel(
  status: ProductionDemand['techPackStatus'],
  versionLabel: string | null | undefined,
): string {
  if (status === 'INCOMPLETE') return 'beta'
  if (!versionLabel || !versionLabel.trim()) return '-'
  return versionLabel
}

function getOrderBusinessTechPackStatus(status: 'MISSING' | 'BETA' | 'RELEASED'): ProductionDemand['techPackStatus'] {
  return toDemandTechPackStatus(status)
}

function deriveLifecycleStatus(order: ProductionOrder): LifecycleStatus {
  if (order.lifecycleStatus) return order.lifecycleStatus

  if (order.status === 'DRAFT' || order.status === 'WAIT_TECH_PACK_RELEASE') return 'DRAFT'
  if (order.status === 'READY_FOR_BREAKDOWN' || order.status === 'WAIT_ASSIGNMENT') return 'PLANNED'
  if (order.status === 'ASSIGNING') return 'RELEASED'
  if (order.status === 'EXECUTING') return 'IN_PRODUCTION'
  if (order.status === 'COMPLETED') return 'COMPLETED'
  return 'CLOSED'
}

function buildSettlementSummary(statementCount: number, batchCount: number): string {
  if (statementCount === 0 && batchCount === 0) return '无结算影响'
  if (statementCount > 0 && batchCount === 0) return `对账单 ${statementCount} 条`
  if (statementCount === 0 && batchCount > 0) return `预付款批次 ${batchCount} 条`
  return `对账单 ${statementCount} 条 / 预付款批次 ${batchCount} 条`
}

function getTechPackSnapshotForDemand(demand: ProductionDemand): {
  status: ProductionDemand['techPackStatus']
  versionLabel: string
  missingChecklist: string[]
} {
  const forceReleased =
    demand.demandStatus === 'CONVERTED' || demand.hasProductionOrder || demand.productionOrderId !== null
  const demandStatus: ProductionDemand['techPackStatus'] = forceReleased ? 'RELEASED' : demand.techPackStatus
  const demandVersionLabel = normalizeTechPackVersionLabel(demandStatus, demand.techPackVersionLabel)

  // 已转单或已绑定生产单的需求在该业务线视为“已发布快照”，避免出现“待完善但已转单”口径冲突。
  if (forceReleased) {
    return {
      status: 'RELEASED',
      versionLabel: demandVersionLabel === '-' ? 'v1.0' : demandVersionLabel,
      missingChecklist: [],
    }
  }

  const techPack = getTechPackBySpuCode(demand.spuCode)
  if (!techPack) {
    return {
      status: demandStatus,
      versionLabel: demandVersionLabel,
      missingChecklist: [],
    }
  }

  const mappedStatus = toDemandTechPackStatus(techPack.status)

  return {
    status: mappedStatus,
    versionLabel: normalizeTechPackVersionLabel(mappedStatus, techPack.versionLabel),
    missingChecklist: [...techPack.missingChecklist],
  }
}

type DemandOperation = 'VIEW_DETAIL' | 'GENERATE' | 'HOLD' | 'UNHOLD' | 'CANCEL'

function listDemandOperationsByStatus(status: ProductionDemand['demandStatus']): DemandOperation[] {
  if (status === 'PENDING_CONVERT') return ['VIEW_DETAIL', 'GENERATE', 'HOLD', 'CANCEL']
  if (status === 'CONVERTED') return ['VIEW_DETAIL']
  if (status === 'HOLD') return ['UNHOLD', 'CANCEL']
  return ['VIEW_DETAIL']
}

function getTechPackOperationLabel(status: ProductionDemand['techPackStatus']): string {
  return status === 'RELEASED' ? '查看技术包' : '完善技术包'
}

function renderDemandOperations(
  demand: ProductionDemand,
  techPackStatus: ProductionDemand['techPackStatus'],
  options?: {
    compact?: boolean
    techPackAction?: 'open-tech-pack' | 'open-tech-pack-from-demand-detail'
  },
): string {
  const compact = options?.compact ?? true
  const techPackAction = options?.techPackAction ?? 'open-tech-pack'
  const baseClass = compact
    ? 'rounded px-2 py-1 text-xs hover:bg-muted'
    : 'inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted'
  const generateClass = compact
    ? 'rounded border px-2 py-1 text-xs hover:bg-muted'
    : 'inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted'
  const dangerClass = compact
    ? 'rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50'
    : 'inline-flex items-center rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50'

  const ops = listDemandOperationsByStatus(demand.demandStatus)
  const demandOpButtons = ops
    .map((op) => {
      if (op === 'VIEW_DETAIL') {
        return `<button class="${baseClass}" data-prod-action="open-demand-detail" data-demand-id="${demand.demandId}">查看详情</button>`
      }
      if (op === 'GENERATE') {
        return `<button class="${generateClass}" data-prod-action="open-demand-single" data-demand-id="${demand.demandId}">生成</button>`
      }
      if (op === 'HOLD') {
        return `<button class="${baseClass}" data-prod-action="hold-demand" data-demand-id="${demand.demandId}">挂起</button>`
      }
      if (op === 'UNHOLD') {
        return `<button class="${baseClass}" data-prod-action="unhold-demand" data-demand-id="${demand.demandId}">取消挂起</button>`
      }
      return `<button class="${dangerClass}" data-prod-action="cancel-demand" data-demand-id="${demand.demandId}">取消</button>`
    })
    .join('')

  const techPackButton = compact
    ? `<button class="inline-flex items-center rounded px-2 py-1 text-xs hover:bg-muted" data-prod-action="${techPackAction}" data-spu-code="${escapeHtml(
        demand.spuCode,
      )}">
           <i data-lucide="file-text" class="mr-1 h-4 w-4"></i>
           ${getTechPackOperationLabel(techPackStatus)}
         </button>`
    : `<button class="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-prod-action="${techPackAction}" data-spu-code="${escapeHtml(
        demand.spuCode,
      )}">
           <i data-lucide="external-link" class="mr-2 h-4 w-4"></i>
           ${getTechPackOperationLabel(techPackStatus)}
         </button>`

  return `${demandOpButtons}${techPackButton}`
}

function getLegacyLikeDyePrintOrders() {
  return listLegacyLikeDyePrintOrdersForTailPages()
}

function getLegacyLikeQualityInspections() {
  return listLegacyLikeQualityInspectionsForTailPages()
}

function getOrderMaterialIndicators(order: ProductionOrder) {
  return getMaterialDraftIndicatorsByOrder(order.productionOrderId)
}

function getOrderDisplayBreakdownSnapshot(order: ProductionOrder): {
  isBrokenDown: boolean
  phase: 'INITIAL_TASK' | 'WAIT_ASSIGNMENT' | 'ASSIGNING' | 'ASSIGNED'
  label: string
  detailText: string
  badgeClassName: string
  lastBreakdownAt: string
  lastBreakdownBy: string
  isPendingAssignment: boolean
  hasEnteredAssignment: boolean
} {
  const assignment = getOrderDisplayAssignmentSnapshot(order)
  const initialTaskCount =
    order.status === 'DRAFT' || order.status === 'WAIT_TECH_PACK_RELEASE' ? 0 : Math.max(order.assignmentSummary.totalTasks, 1)
  const lastAt =
    assignment.assignmentProgress.status === 'IN_PROGRESS' || assignment.assignmentProgress.status === 'DONE'
      ? order.taskBreakdownSummary.lastBreakdownAt ?? order.updatedAt ?? order.createdAt
      : order.updatedAt ?? order.createdAt
  const lastBy =
    assignment.assignmentProgress.status === 'IN_PROGRESS' || assignment.assignmentProgress.status === 'DONE'
      ? order.taskBreakdownSummary.lastBreakdownBy ?? '系统'
      : order.auditLogs[order.auditLogs.length - 1]?.by ?? '系统'

  if (assignment.assignmentProgress.status === 'DONE') {
    return {
      isBrokenDown: true,
      phase: 'ASSIGNED',
      label: '已分配',
      detailText: `任务 ${Math.max(assignment.assignmentSummary.totalTasks, initialTaskCount)} / 已分配`,
      badgeClassName: 'bg-green-50 text-green-700',
      lastBreakdownAt: lastAt,
      lastBreakdownBy: lastBy,
      isPendingAssignment: false,
      hasEnteredAssignment: true,
    }
  }

  if (assignment.assignmentProgress.status === 'IN_PROGRESS') {
    return {
      isBrokenDown: true,
      phase: 'ASSIGNING',
      label: '分配中',
      detailText: `任务 ${Math.max(assignment.assignmentSummary.totalTasks, initialTaskCount)} / 分配中`,
      badgeClassName: 'bg-blue-50 text-blue-700',
      lastBreakdownAt: lastAt,
      lastBreakdownBy: lastBy,
      isPendingAssignment: false,
      hasEnteredAssignment: true,
    }
  }

  if (assignment.assignmentProgress.status === 'PENDING') {
    return {
      isBrokenDown: false,
      phase: 'WAIT_ASSIGNMENT',
      label: '待分配',
      detailText: `任务 ${Math.max(assignment.assignmentSummary.totalTasks, initialTaskCount)} / 待分配`,
      badgeClassName: 'bg-yellow-50 text-yellow-700',
      lastBreakdownAt: lastAt,
      lastBreakdownBy: lastBy,
      isPendingAssignment: true,
      hasEnteredAssignment: false,
    }
  }

  return {
    isBrokenDown: false,
    phase: 'INITIAL_TASK',
    label: initialTaskCount > 0 ? '已生成任务' : '未建任务',
    detailText: initialTaskCount > 0 ? `初始任务 ${initialTaskCount}` : '尚未生成任务',
    badgeClassName: initialTaskCount > 0 ? 'bg-slate-100 text-slate-700' : 'bg-gray-100 text-gray-600',
    lastBreakdownAt: lastAt,
    lastBreakdownBy: lastBy,
    isPendingAssignment: true,
    hasEnteredAssignment: false,
  }
}

function getOrderDisplayAssignmentSnapshot(order: ProductionOrder): {
  assignmentSummary: ProductionOrder['assignmentSummary']
  assignmentProgress: ProductionOrder['assignmentProgress']
  biddingSummary: ProductionOrder['biddingSummary']
  directDispatchSummary: ProductionOrder['directDispatchSummary']
} {
  return {
    assignmentSummary: { ...order.assignmentSummary },
    assignmentProgress: { ...order.assignmentProgress },
    biddingSummary: { ...order.biddingSummary },
    directDispatchSummary: { ...order.directDispatchSummary },
  }
}

function getOrderMaterialDisplaySummary(order: ProductionOrder): {
  stage: 'NOT_READY' | 'PREVIEW' | 'ACTUAL_PENDING' | 'ACTUAL_PARTIAL' | 'ACTUAL_CONFIRMED'
  previewCount: number
  summaryText: string
  badgeLabel: string
  badgeClassName: string
  hasActualDraft: boolean
  hasConfirmedDraft: boolean
} {
  const breakdown = getOrderDisplayBreakdownSnapshot(order)
  const assignment = getOrderDisplayAssignmentSnapshot(order)
  const materialSummary = getMaterialRequestDraftSummaryByOrder(order.productionOrderId)

  if (breakdown.phase === 'INITIAL_TASK') {
    return {
      stage: 'NOT_READY',
      previewCount: 0,
      summaryText: '待进入分配后生成',
      badgeLabel: '待生成',
      badgeClassName: 'bg-slate-100 text-slate-700',
      hasActualDraft: false,
      hasConfirmedDraft: false,
    }
  }

  if (breakdown.phase === 'WAIT_ASSIGNMENT') {
    const previewCount = Math.max(
      materialSummary.totalDraftCount,
      order.assignmentSummary.totalTasks,
      1,
    )
    return {
      stage: 'PREVIEW',
      previewCount,
      summaryText: `预览 ${previewCount} / 待分配后确认`,
      badgeLabel: '预览草稿',
      badgeClassName: 'bg-blue-100 text-blue-700',
      hasActualDraft: false,
      hasConfirmedDraft: false,
    }
  }

  if (materialSummary.totalDraftCount === 0) {
    return {
      stage: 'ACTUAL_PENDING',
      previewCount: 0,
      summaryText: '实际分配后待生成',
      badgeLabel: '未建草稿',
      badgeClassName: 'bg-slate-100 text-slate-700',
      hasActualDraft: false,
      hasConfirmedDraft: false,
    }
  }

  if (materialSummary.createdCount === 0) {
    return {
      stage: 'ACTUAL_PENDING',
      previewCount: 0,
      summaryText: `草稿 ${materialSummary.totalDraftCount} / 待确认 ${materialSummary.pendingCount}`,
      badgeLabel: '待确认草稿',
      badgeClassName: 'bg-amber-100 text-amber-700',
      hasActualDraft: true,
      hasConfirmedDraft: false,
    }
  }

  if (materialSummary.pendingCount > 0) {
    return {
      stage: 'ACTUAL_PARTIAL',
      previewCount: 0,
      summaryText: `草稿 ${materialSummary.totalDraftCount} / 已确认 ${materialSummary.createdCount} / 待确认 ${materialSummary.pendingCount}`,
      badgeLabel: '部分确认',
      badgeClassName: 'bg-blue-100 text-blue-700',
      hasActualDraft: true,
      hasConfirmedDraft: true,
    }
  }

  return {
    stage: 'ACTUAL_CONFIRMED',
    previewCount: 0,
    summaryText: `草稿 ${materialSummary.totalDraftCount} / 已确认 ${materialSummary.createdCount}`,
    badgeLabel: '已确认草稿',
    badgeClassName: 'bg-green-100 text-green-700',
    hasActualDraft: true,
    hasConfirmedDraft: true,
  }
}

function getOrderTechPackInfo(order: ProductionOrder): {
  snapshotStatus: ProductionDemand['techPackStatus']
  snapshotVersion: string
  currentStatus: ProductionDemand['techPackStatus']
  currentVersion: string
  completenessScore: number
  missingChecklist: string[]
  isOutOfSync: boolean
} {
  const techPack = getTechPackBySpuCode(order.demandSnapshot.spuCode)
  const snapshotStatus = getOrderBusinessTechPackStatus(order.techPackSnapshot.status)
  const snapshotVersion = normalizeTechPackVersionLabel(snapshotStatus, order.techPackSnapshot.versionLabel)
  const currentRawStatus = techPack?.status ?? order.techPackSnapshot.status
  const currentStatus = getOrderBusinessTechPackStatus(currentRawStatus)
  const currentVersion = normalizeTechPackVersionLabel(currentStatus, techPack?.versionLabel ?? order.techPackSnapshot.versionLabel)

  return {
    snapshotStatus,
    snapshotVersion,
    currentStatus,
    currentVersion,
    completenessScore: techPack?.completenessScore ?? 0,
    missingChecklist: [...(techPack?.missingChecklist ?? [])],
    isOutOfSync:
      currentStatus !== snapshotStatus ||
      currentVersion !== snapshotVersion,
  }
}

function getDemandById(demandId: string | null): ProductionDemand | null {
  if (!demandId) return null
  return state.demands.find((demand) => demand.demandId === demandId) ?? null
}

function getOrderById(orderId: string | null): ProductionOrder | null {
  if (!orderId) return null
  return state.orders.find((order) => order.productionOrderId === orderId) ?? null
}

function getProcessTaskById(taskId: string): RuntimeProcessTask | null {
  return getRuntimeTaskById(taskId)
}

function getChangeById(changeId: string | null): ProductionOrderChange | null {
  if (!changeId) return null
  return state.changes.find((change) => change.changeId === changeId) ?? null
}

function openAppRoute(pathname: string, key?: string, title?: string): void {
  if (key && title) {
    appStore.openTab({
      key,
      title,
      href: pathname,
      closable: true,
    })
    return
  }

  appStore.navigate(pathname)
}

function getDemandFactoryOptions(): typeof indonesiaFactories {
  let factories = indonesiaFactories.filter((factory) => factory.status === 'ACTIVE')

  if (state.demandTierFilter !== 'ALL') {
    factories = factories.filter((factory) => factory.tier === state.demandTierFilter)
  }

  if (state.demandTypeFilter !== 'ALL') {
    factories = factories.filter((factory) => factory.type === state.demandTypeFilter)
  }

  const keyword = state.demandFactorySearch.trim().toLowerCase()
  if (keyword) {
    factories = factories.filter((factory) => {
      return (
        factory.code.toLowerCase().includes(keyword) ||
        factory.name.toLowerCase().includes(keyword)
      )
    })
  }

  const tierWeight: Record<FactoryTier, number> = {
    SATELLITE: 0,
    THIRD_PARTY: 1,
    CENTRAL: 2,
  }

  factories.sort((a, b) => {
    const byTier = tierWeight[a.tier] - tierWeight[b.tier]
    if (byTier !== 0) return byTier
    return a.code.localeCompare(b.code)
  })

  return factories
}

function getAvailableDemandTypes(): FactoryType[] {
  if (state.demandTierFilter === 'ALL') {
    return (Object.keys(typeLabels) as FactoryType[])
  }

  return typesByTier[state.demandTierFilter] ?? []
}

function getFilteredDemands(): ProductionDemand[] {
  let result = [...state.demands]

  const keyword = state.demandKeyword.trim().toLowerCase()
  if (keyword) {
    result = result.filter((demand) => {
      return (
        demand.demandId.toLowerCase().includes(keyword) ||
        demand.spuCode.toLowerCase().includes(keyword) ||
        demand.spuName.toLowerCase().includes(keyword) ||
        demand.legacyOrderNo.toLowerCase().includes(keyword)
      )
    })
  }

  if (state.demandStatusFilter !== 'ALL') {
    result = result.filter((demand) => demand.demandStatus === state.demandStatusFilter)
  }

  if (state.demandTechPackFilter !== 'ALL') {
    result = result.filter((demand) => getTechPackSnapshotForDemand(demand).status === state.demandTechPackFilter)
  }

  if (state.demandHasOrderFilter === 'YES') {
    result = result.filter((demand) => demand.hasProductionOrder)
  }

  if (state.demandHasOrderFilter === 'NO') {
    result = result.filter((demand) => !demand.hasProductionOrder)
  }

  if (state.demandPriorityFilter !== 'ALL') {
    result = result.filter((demand) => demand.priority === state.demandPriorityFilter)
  }

  if (state.demandOnlyUngenerated) {
    result = result.filter((demand) => !demand.hasProductionOrder)
  }

  return result
}

function getBatchGeneratableDemandIds(): string[] {
  return [...state.demandSelectedIds].filter((demandId) => {
    const demand = state.demands.find((item) => item.demandId === demandId)
    if (!demand) return false
    return (
      demand.demandStatus === 'PENDING_CONVERT' &&
      !demand.hasProductionOrder &&
      getTechPackSnapshotForDemand(demand).status === 'RELEASED'
    )
  })
}

function listOrdersFromDemandGeneratableDemands(): ProductionDemand[] {
  return state.demands.filter((demand) => {
    if (demand.demandStatus !== 'PENDING_CONVERT') return false
    if (demand.hasProductionOrder) return false
    if (demand.productionOrderId !== null) return false
    return getTechPackSnapshotForDemand(demand).status === 'RELEASED'
  })
}

function getOrdersFromDemandSelectedIds(): string[] {
  const available = new Set(listOrdersFromDemandGeneratableDemands().map((item) => item.demandId))
  return [...state.ordersFromDemandSelectedIds].filter((demandId) => available.has(demandId))
}

function getFilteredOrders(): ProductionOrder[] {
  let result = [...state.orders]

  const keyword = state.ordersKeyword.trim().toLowerCase()
  if (keyword) {
    result = result.filter((order) => {
      return (
        order.productionOrderId.toLowerCase().includes(keyword) ||
        order.legacyOrderNo.toLowerCase().includes(keyword) ||
        order.demandSnapshot.spuCode.toLowerCase().includes(keyword) ||
        order.demandSnapshot.spuName.toLowerCase().includes(keyword) ||
        order.mainFactorySnapshot.name.toLowerCase().includes(keyword)
      )
    })
  }

  if (state.ordersStatusFilter.length > 0) {
    result = result.filter((order) => state.ordersStatusFilter.includes(order.status))
  }

  if (state.ordersBreakdownFilter !== 'ALL') {
    result = result.filter((order) => {
      const snapshot = getOrderDisplayBreakdownSnapshot(order)
      if (state.ordersBreakdownFilter === 'PENDING') return snapshot.isPendingAssignment
      return snapshot.hasEnteredAssignment
    })
  }

  if (state.ordersAssignmentProgressFilter !== 'ALL') {
    result = result.filter(
      (order) =>
        getOrderDisplayAssignmentSnapshot(order).assignmentProgress.status ===
        state.ordersAssignmentProgressFilter,
    )
  }

  if (state.ordersAssignmentModeFilter !== 'ALL') {
    result = result.filter((order) => {
      const assignment = getOrderDisplayAssignmentSnapshot(order)
      const direct = assignment.assignmentSummary.directCount
      const bidding = assignment.assignmentSummary.biddingCount

      if (state.ordersAssignmentModeFilter === 'DIRECT_ONLY') return direct > 0 && bidding === 0
      if (state.ordersAssignmentModeFilter === 'BIDDING_ONLY') return bidding > 0 && direct === 0
      if (state.ordersAssignmentModeFilter === 'MIXED') return bidding > 0 && direct > 0
      return true
    })
  }

  if (state.ordersBiddingRiskFilter !== 'ALL') {
    result = result.filter((order) => {
      const assignment = getOrderDisplayAssignmentSnapshot(order)
      if (state.ordersBiddingRiskFilter === 'OVERDUE') {
        return assignment.biddingSummary.overdueTenderCount > 0
      }
      if (state.ordersBiddingRiskFilter === 'NEAR_DEADLINE') {
        return order.riskFlags.includes('TENDER_NEAR_DEADLINE')
      }
      if (state.ordersBiddingRiskFilter === 'NONE') {
        return (
          assignment.biddingSummary.activeTenderCount === 0 &&
          assignment.biddingSummary.overdueTenderCount === 0
        )
      }
      return true
    })
  }

  if (state.ordersTierFilter !== 'ALL') {
    result = result.filter((order) => order.mainFactorySnapshot.tier === state.ordersTierFilter)
  }

  if (state.ordersHasMaterialDraftFilter !== 'ALL') {
    result = result.filter((order) => {
      const indicators = getOrderMaterialDisplaySummary(order)
      return state.ordersHasMaterialDraftFilter === 'YES'
        ? indicators.hasActualDraft
        : !indicators.hasActualDraft
    })
  }

  if (state.ordersHasConfirmedMaterialRequestFilter !== 'ALL') {
    result = result.filter((order) => {
      const indicators = getOrderMaterialDisplaySummary(order)
      return state.ordersHasConfirmedMaterialRequestFilter === 'YES'
        ? indicators.hasConfirmedDraft
        : !indicators.hasConfirmedDraft
    })
  }

  if (state.ordersMaterialStageFilter !== 'ALL') {
    result = result.filter((order) => {
      const indicators = getOrderMaterialDisplaySummary(order)
      if (state.ordersMaterialStageFilter === 'PREVIEW') return indicators.stage === 'PREVIEW'
      if (state.ordersMaterialStageFilter === 'ACTUAL_PENDING') {
        return indicators.stage === 'ACTUAL_PENDING' || indicators.stage === 'ACTUAL_PARTIAL'
      }
      return indicators.stage === 'ACTUAL_CONFIRMED'
    })
  }

  return result
}

function getPaginatedOrders(filteredOrders: ProductionOrder[]): ProductionOrder[] {
  const start = (state.ordersCurrentPage - 1) * PAGE_SIZE
  return filteredOrders.slice(start, start + PAGE_SIZE)
}

function getPlanFactoryOptions(): Array<{ id: string; name: string }> {
  const map = new Map<string, string>()

  for (const factory of indonesiaFactories) {
    map.set(factory.id, factory.name)
  }

  for (const order of state.orders) {
    if (order.planFactoryId) {
      map.set(order.planFactoryId, order.planFactoryName ?? order.planFactoryId)
    }
  }

  return [...map.entries()].map(([id, name]) => ({ id, name }))
}

function getPlanWeekRange(): { weekStart: string; weekEnd: string } {
  const date = new Date()
  const day = date.getDay() === 0 ? 6 : date.getDay() - 1
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - day)
  const weekStart = date.toISOString().slice(0, 10)

  const weekEndDate = new Date(weekStart)
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const weekEnd = weekEndDate.toISOString().slice(0, 10)

  return { weekStart, weekEnd }
}

function closeAllProductionDialogs(): void {
  state.demandDetailId = null
  state.demandBatchDialogOpen = false
  state.demandSingleGenerateId = null
  state.demandGenerateConfirmOpen = false
  state.ordersDemandSnapshotId = null
  state.ordersLogsId = null
  state.ordersFromDemandDialogOpen = false
  state.ordersFromDemandSelectedIds = new Set<string>()
  state.materialDraftOrderId = null
  state.materialDraftAddDraftId = null
  state.materialDraftAddSelections = new Set<string>()
  state.planEditOrderId = null
  state.deliveryEditOrderId = null
  state.changesCreateOpen = false
  state.changesStatusOpen = false
  state.statusDialogOpen = false
  state.detailLogsOpen = false
  state.detailSimulateOpen = false
  state.detailConfirmSimulateOpen = false
  state.ordersActionMenuId = null
}

const state: ProductionState = {
  demands: productionDemands.map(cloneDemand),
  orders: productionOrders.map(cloneOrder),
  changes: normalizeSeedChanges(initialProductionOrderChanges, productionOrders),

  demandKeyword: '',
  demandStatusFilter: 'ALL',
  demandTechPackFilter: 'ALL',
  demandHasOrderFilter: 'ALL',
  demandPriorityFilter: 'ALL',
  demandOnlyUngenerated: false,
  demandSelectedIds: new Set<string>(),
  demandDetailId: null,
  demandBatchDialogOpen: false,
  demandSingleGenerateId: null,
  demandGenerateConfirmOpen: false,
  demandSelectedFactoryId: '',
  demandTierFilter: 'ALL',
  demandTypeFilter: 'ALL',
  demandFactorySearch: '',
  demandShowAdvanced: false,
  demandOwnerPartyManual: false,
  demandOwnerPartyType: 'FACTORY',
  demandOwnerPartyId: '',
  demandOwnerReason: '',

  ordersKeyword: '',
  ordersStatusFilter: [],
  ordersTechPackFilter: 'ALL',
  ordersBreakdownFilter: 'ALL',
  ordersAssignmentProgressFilter: 'ALL',
  ordersAssignmentModeFilter: 'ALL',
  ordersBiddingRiskFilter: 'ALL',
  ordersTierFilter: 'ALL',
  ordersHasMaterialDraftFilter: 'ALL',
  ordersHasConfirmedMaterialRequestFilter: 'ALL',
  ordersMaterialStageFilter: 'ALL',
  ordersCurrentPage: 1,
  ordersSelectedIds: new Set<string>(),
  ordersDemandSnapshotId: null,
  ordersLogsId: null,
  ordersActionMenuId: null,
  ordersFromDemandDialogOpen: false,
  ordersFromDemandSelectedIds: new Set<string>(),
  materialDraftOrderId: null,
  materialDraftAddDraftId: null,
  materialDraftAddSelections: new Set<string>(),
  ordersViewMode: 'table',

  planKeyword: '',
  planStatusFilter: 'ALL',
  planFactoryFilter: 'ALL',
  planEditOrderId: null,
  planForm: { ...PLAN_EMPTY_FORM },

  deliveryKeyword: '',
  deliveryStatusFilter: 'ALL',
  deliveryEditOrderId: null,
  deliveryForm: { ...DELIVERY_EMPTY_FORM },

  changesKeyword: '',
  changesTypeFilter: 'ALL',
  changesStatusFilter: 'ALL',
  changesCreateOpen: false,
  changesCreateForm: { ...CHANGE_CREATE_EMPTY_FORM },
  changesCreateErrors: {},
  changesStatusOpen: false,
  changesStatusTarget: null,
  changesStatusForm: { ...CHANGE_STATUS_EMPTY_FORM },
  changesStatusError: '',

  statusKeyword: '',
  statusFilter: 'ALL',
  statusDialogOpen: false,
  statusSelectedOrderId: null,
  statusNext: '',
  statusRemark: '',

  detailCurrentOrderId: null,
  detailTab: 'overview',
  detailLogsOpen: false,
  detailSimulateOpen: false,
  detailSimulateStatus: 'DRAFT',
  detailConfirmSimulateOpen: false,
}

export type {
  OrderViewMode,
  OrderDetailTab,
  AssignmentModeFilter,
  BiddingRiskFilter,
  OrderMaterialStageFilter,
  LifecycleStatus,
  DemandOwnerPartyType,
  PlanForm,
  DeliveryForm,
  ChangeCreateForm,
  ChangeStatusForm,
  ProductionState,
  OrderTaskBreakdownSnapshot,
  DemandOperation,
  ProductionDemand,
  ProductionOrder,
  ProductionOrderStatus,
  AssignmentProgressStatus,
  AuditLog,
  RiskFlag,
  FactoryTier,
  FactoryType,
  RuntimeProcessTask,
  RuntimeTaskSplitGroupSnapshot,
  ProductionOrderChange,
  ProductionChangeType,
  ProductionChangeStatus,
  MaterialRequestDraft,
  MaterialMode,
}

export {
  appStore,
  escapeHtml,
  formatDateTime,
  renderFormDialog,
  renderConfirmDialog,
  productionDemands,
  productionOrders,
  productionOrderStatusConfig,
  assignmentProgressStatusConfig,
  riskFlagConfig,
  indonesiaFactories,
  typesByTier,
  tierLabels,
  typeLabels,
  getTechPackBySpuCode,
  legalEntities,
  getRuntimeAssignmentSummaryByOrder,
  getRuntimeBiddingSummaryByOrder,
  getRuntimeTaskById,
  getRuntimeTaskCountByOrder,
  listRuntimeTaskSplitGroupsByOrder,
  listRuntimeTasksByOrder,
  summarizeTaskDetailRows,
  initialDeductionBasisItems,
  initialAllocationByTaskId,
  initialStatementDrafts,
  initialSettlementBatches,
  initialProductionOrderChanges,
  addMaterialToDraft,
  confirmMaterialRequestDraft,
  getMaterialDraftIndicatorsByOrder,
  getDraftStatusLabel,
  getMaterialRequestDraftById,
  getMaterialRequestDraftSummaryByOrder,
  listMaterialDraftOperationLogsByOrder,
  getSupplementOptionDisplayRows,
  getTaskTypeLabel,
  listMaterialRequestDraftsByOrder,
  restoreMaterialDraftSuggestion,
  setMaterialDraftLineConfirmedQty,
  setMaterialDraftMode,
  setMaterialDraftNeedMaterial,
  setMaterialDraftRemark,
  toggleMaterialDraftLine,
  PAGE_SIZE,
  currentUser,
  PLAN_EMPTY_FORM,
  DELIVERY_EMPTY_FORM,
  CHANGE_CREATE_EMPTY_FORM,
  CHANGE_STATUS_EMPTY_FORM,
  demandStatusConfig,
  demandTechPackStatusConfig,
  demandPriorityConfig,
  lifecycleStatusLabel,
  lifecycleStatusClass,
  taskStatusLabel,
  taskStatusClass,
  changeTypeLabels,
  changeStatusLabels,
  changeStatusClass,
  changeAllowedNext,
  lifecycleAllowedNext,
  keyProcessKeywords,
  cloneDemand,
  cloneOrder,
  cloneChange,
  normalizeSeedChanges,
  toTimestamp,
  nextLocalEntityId,
  nextChangeId,
  showPlanMessage,
  includesKeyword,
  safeText,
  renderBadge,
  renderSplitEventList,
  deriveRuntimeAssignmentProgressStatus,
  getOrderRuntimeAssignmentSnapshot,
  getRuntimeTaskTypeLabel,
  getTaskDetailRows,
  getOrderTaskBreakdownSnapshot,
  renderStatCard,
  renderEmptyRow,
  parseOrderSuffix,
  nextProductionOrderId,
  toDemandTechPackStatus,
  toOrderTechPackStatus,
  normalizeTechPackVersionLabel,
  getOrderBusinessTechPackStatus,
  deriveLifecycleStatus,
  buildSettlementSummary,
  getTechPackSnapshotForDemand,
  listDemandOperationsByStatus,
  getTechPackOperationLabel,
  renderDemandOperations,
  getLegacyLikeDyePrintOrders,
  getLegacyLikeQualityInspections,
  getOrderMaterialIndicators,
  getOrderDisplayBreakdownSnapshot,
  getOrderDisplayAssignmentSnapshot,
  getOrderMaterialDisplaySummary,
  getOrderTechPackInfo,
  getDemandById,
  getOrderById,
  getProcessTaskById,
  getChangeById,
  openAppRoute,
  getDemandFactoryOptions,
  getAvailableDemandTypes,
  getFilteredDemands,
  getBatchGeneratableDemandIds,
  listOrdersFromDemandGeneratableDemands,
  getOrdersFromDemandSelectedIds,
  getFilteredOrders,
  getPaginatedOrders,
  getPlanFactoryOptions,
  getPlanWeekRange,
  closeAllProductionDialogs,
  state,
}
