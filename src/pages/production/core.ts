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
  ordersBreakdownFilter: 'ALL' | 'YES' | 'NO'
  ordersAssignmentProgressFilter: 'ALL' | AssignmentProgressStatus
  ordersAssignmentModeFilter: AssignmentModeFilter
  ordersBiddingRiskFilter: BiddingRiskFilter
  ordersTierFilter: FactoryTier | 'ALL'
  ordersHasMaterialDraftFilter: 'ALL' | 'YES' | 'NO'
  ordersHasConfirmedMaterialRequestFilter: 'ALL' | 'YES' | 'NO'
  ordersCurrentPage: number
  ordersSelectedIds: Set<string>
  ordersDemandSnapshotId: string | null
  ordersLogsId: string | null
  ordersActionMenuId: string | null
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
  if (statementCount === 0 && batchCount > 0) return `结算批次 ${batchCount} 条`
  return `对账单 ${statementCount} 条 / 结算批次 ${batchCount} 条`
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

function getLegacyLikeDyePrintOrders() {
  return listLegacyLikeDyePrintOrdersForTailPages()
}

function getLegacyLikeQualityInspections() {
  return listLegacyLikeQualityInspectionsForTailPages()
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

  if (state.ordersTechPackFilter !== 'ALL') {
    result = result.filter(
      (order) =>
        getOrderBusinessTechPackStatus(order.techPackSnapshot.status) === state.ordersTechPackFilter,
    )
  }

  if (state.ordersBreakdownFilter !== 'ALL') {
    const expected = state.ordersBreakdownFilter === 'YES'
    result = result.filter((order) => getOrderTaskBreakdownSnapshot(order).isBrokenDown === expected)
  }

  if (state.ordersAssignmentProgressFilter !== 'ALL') {
    result = result.filter(
      (order) =>
        getOrderRuntimeAssignmentSnapshot(order).assignmentProgress.status ===
        state.ordersAssignmentProgressFilter,
    )
  }

  if (state.ordersAssignmentModeFilter !== 'ALL') {
    result = result.filter((order) => {
      const runtime = getOrderRuntimeAssignmentSnapshot(order)
      const direct = runtime.assignmentSummary.directCount
      const bidding = runtime.assignmentSummary.biddingCount

      if (state.ordersAssignmentModeFilter === 'DIRECT_ONLY') return direct > 0 && bidding === 0
      if (state.ordersAssignmentModeFilter === 'BIDDING_ONLY') return bidding > 0 && direct === 0
      if (state.ordersAssignmentModeFilter === 'MIXED') return bidding > 0 && direct > 0
      return true
    })
  }

  if (state.ordersBiddingRiskFilter !== 'ALL') {
    result = result.filter((order) => {
      const runtime = getOrderRuntimeAssignmentSnapshot(order)
      if (state.ordersBiddingRiskFilter === 'OVERDUE') {
        return runtime.biddingSummary.overdueTenderCount > 0
      }
      if (state.ordersBiddingRiskFilter === 'NEAR_DEADLINE') {
        return order.riskFlags.includes('TENDER_NEAR_DEADLINE')
      }
      if (state.ordersBiddingRiskFilter === 'NONE') {
        return (
          runtime.biddingSummary.activeTenderCount === 0 &&
          runtime.biddingSummary.overdueTenderCount === 0
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
      const indicators = getOrderMaterialIndicators(order)
      return state.ordersHasMaterialDraftFilter === 'YES'
        ? indicators.hasMaterialDraft
        : !indicators.hasMaterialDraft
    })
  }

  if (state.ordersHasConfirmedMaterialRequestFilter !== 'ALL') {
    result = result.filter((order) => {
      const indicators = getOrderMaterialIndicators(order)
      return state.ordersHasConfirmedMaterialRequestFilter === 'YES'
        ? indicators.hasConfirmedMaterialRequest
        : !indicators.hasConfirmedMaterialRequest
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
  ordersCurrentPage: 1,
  ordersSelectedIds: new Set<string>(),
  ordersDemandSnapshotId: null,
  ordersLogsId: null,
  ordersActionMenuId: null,
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
function renderDemandDetailDrawer(): string {
  const demand = getDemandById(state.demandDetailId)
  if (!demand) return ''

  const techPackInfo = getTechPackSnapshotForDemand(demand)

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-demand-detail" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl sm:max-w-[500px]" data-dialog-panel="true">
        <header class="border-b px-5 py-4">
          <h3 class="text-lg font-semibold">需求详情</h3>
        </header>
        <div class="mt-6 space-y-6 overflow-y-auto px-5 pb-8">
          <section>
            <h4 class="mb-3 font-medium">基本信息</h4>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p class="text-xs text-muted-foreground">需求编号</p>
                <p class="font-mono">${escapeHtml(demand.demandId)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">旧单号</p>
                <p class="font-mono">${escapeHtml(demand.legacyOrderNo)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">SPU编码</p>
                <p class="font-mono">${escapeHtml(demand.spuCode)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">SPU名称</p>
                <p>${escapeHtml(demand.spuName)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">需求总量</p>
                <p class="font-medium">${demand.requiredQtyTotal.toLocaleString()}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">交付日期</p>
                <p>${escapeHtml(safeText(demand.requiredDeliveryDate))}</p>
              </div>
            </div>
          </section>

          <div class="h-px bg-border"></div>

          <section>
            <h4 class="mb-3 font-medium">技术包信息</h4>
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                ${renderBadge(
                  demandTechPackStatusConfig[techPackInfo.status].label,
                  demandTechPackStatusConfig[techPackInfo.status].className,
                )}
                <span class="text-sm">版本: ${escapeHtml(techPackInfo.versionLabel || '-')}</span>
              </div>
              ${
                techPackInfo.missingChecklist.length > 0
                  ? `
                    <div>
                      <p class="text-xs text-muted-foreground">缺失项</p>
                      <div class="mt-1 space-y-1">
                        ${techPackInfo.missingChecklist
                          .map(
                            (item) =>
                              `<div class="flex items-center gap-2 text-sm text-orange-600"><i data-lucide="alert-triangle" class="h-3 w-3"></i><span>${escapeHtml(item)}</span></div>`,
                          )
                          .join('')}
                      </div>
                    </div>
                  `
                  : ''
              }
              <button class="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-prod-action="open-tech-pack-from-demand-detail" data-spu-code="${escapeHtml(
                demand.spuCode,
              )}">
                <i data-lucide="external-link" class="mr-2 h-4 w-4"></i>
                完善技术包
              </button>
            </div>
          </section>

          <div class="h-px bg-border"></div>

          <section>
            <h4 class="mb-3 font-medium">SKU明细</h4>
            <div class="rounded-md border">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b">
                    <th class="px-3 py-2 text-left">SKU</th>
                    <th class="px-3 py-2 text-left">尺码</th>
                    <th class="px-3 py-2 text-left">颜色</th>
                    <th class="px-3 py-2 text-right">数量</th>
                  </tr>
                </thead>
                <tbody>
                  ${demand.skuLines
                    .map(
                      (sku) => `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(sku.skuCode)}</td>
                          <td class="px-3 py-2">${escapeHtml(sku.size)}</td>
                          <td class="px-3 py-2">${escapeHtml(sku.color)}</td>
                          <td class="px-3 py-2 text-right">${sku.qty.toLocaleString()}</td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </section>

          ${
            demand.constraintsNote
              ? `
                <div class="h-px bg-border"></div>
                <section>
                  <h4 class="mb-3 font-medium">约束条件</h4>
                  <p class="text-sm text-muted-foreground">${escapeHtml(demand.constraintsNote)}</p>
                </section>
              `
              : ''
          }
        </div>
      </section>
    </div>
  `
}

function renderDemandFactorySelectorFields(): string {
  const factories = getDemandFactoryOptions()
  const availableTypes = getAvailableDemandTypes()

  return `
    <div class="space-y-2">
      <p class="text-sm font-medium">选择主工厂 <span class="text-red-500">*</span></p>
      <div class="grid grid-cols-2 gap-2">
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">组织层级</span>
          <select data-prod-field="demandTierFilter" class="w-full rounded-md border px-3 py-2 text-sm">
            <option value="ALL" ${state.demandTierFilter === 'ALL' ? 'selected' : ''}>全部层级</option>
            ${(Object.keys(tierLabels) as FactoryTier[])
              .map(
                (tier) =>
                  `<option value="${tier}" ${state.demandTierFilter === tier ? 'selected' : ''}>${escapeHtml(
                    tierLabels[tier],
                  )}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">工厂类型</span>
          <select data-prod-field="demandTypeFilter" class="w-full rounded-md border px-3 py-2 text-sm">
            <option value="ALL" ${state.demandTypeFilter === 'ALL' ? 'selected' : ''}>全部类型</option>
            ${availableTypes
              .map(
                (type) =>
                  `<option value="${type}" ${state.demandTypeFilter === type ? 'selected' : ''}>${escapeHtml(
                    typeLabels[type],
                  )}</option>`,
              )
              .join('')}
          </select>
        </label>
      </div>

      <label class="space-y-1">
        <span class="text-xs text-muted-foreground">搜索工厂</span>
        <div class="relative">
          <i data-lucide="search" class="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"></i>
          <input data-prod-field="demandFactorySearch" value="${escapeHtml(
            state.demandFactorySearch,
          )}" class="w-full rounded-md border py-2 pl-8 pr-3 text-sm" placeholder="输入工厂代码或名称搜索" />
        </div>
      </label>

      <select data-prod-field="demandSelectedFactoryId" class="w-full rounded-md border px-3 py-2 text-sm">
        <option value="" ${state.demandSelectedFactoryId ? '' : 'selected'}>请选择主工厂</option>
        ${factories
          .map(
            (factory) =>
              `<option value="${factory.id}" ${
                state.demandSelectedFactoryId === factory.id ? 'selected' : ''
              }>[${escapeHtml(tierLabels[factory.tier])}] ${escapeHtml(factory.code)} - ${escapeHtml(factory.name)}</option>`,
          )
          .join('')}
      </select>
    </div>
  `
}

function renderDemandBatchGenerateDialog(): string {
  if (!state.demandBatchDialogOpen) return ''

  const demandIds = getBatchGeneratableDemandIds()
  const targetDemands = demandIds
    .map((demandId) => state.demands.find((item) => item.demandId === demandId) ?? null)
    .filter((item): item is ProductionDemand => item !== null)
  const ownerPartyTypeValue = state.demandOwnerPartyManual ? state.demandOwnerPartyType : 'FACTORY'

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-demand-generate" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">批量生成生产单</h3>
          <p class="mt-1 text-sm text-muted-foreground">批量为所选需求生成生产单</p>
        </header>

        <div class="max-h-[72vh] space-y-4 overflow-y-auto px-6 py-5">
          <section class="rounded-md border">
            <div class="max-h-[200px] overflow-y-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b">
                    <th class="px-3 py-2 text-left">需求编号</th>
                    <th class="px-3 py-2 text-left">SPU</th>
                    <th class="px-3 py-2 text-left">技术包</th>
                    <th class="px-3 py-2 text-right">数量</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    targetDemands.length === 0
                      ? renderEmptyRow(4, '暂无数据')
                      : targetDemands
                          .map((demand) => {
                            const info = getTechPackSnapshotForDemand(demand)
                            return `
                              <tr class="border-b last:border-0">
                                <td class="px-3 py-2 font-mono text-sm">${escapeHtml(demand.demandId)}</td>
                                <td class="px-3 py-2 font-mono text-sm">${escapeHtml(demand.spuCode)}</td>
                                <td class="px-3 py-2">${renderBadge(
                                  demandTechPackStatusConfig[info.status].label,
                                  demandTechPackStatusConfig[info.status].className,
                                )}</td>
                                <td class="px-3 py-2 text-right">${demand.requiredQtyTotal.toLocaleString()}</td>
                              </tr>
                            `
                          })
                          .join('')
                  }
                </tbody>
              </table>
            </div>
          </section>

          ${renderDemandFactorySelectorFields()}

          <section>
            <button class="rounded-md px-2 py-1 text-xs hover:bg-muted" data-prod-action="toggle-demand-advanced">${
              state.demandShowAdvanced ? '收起高级设置' : '展开高级设置'
            }</button>
            ${
              state.demandShowAdvanced
                ? `
                  <div class="mt-2 space-y-3 rounded border bg-muted/30 p-3">
                    <div class="grid grid-cols-2 gap-3">
                      <label class="space-y-1">
                        <span class="text-xs">货权主体类型</span>
                        <select data-prod-field="demandOwnerPartyType" class="w-full rounded-md border px-3 py-2 text-sm">
                          <option value="FACTORY" ${ownerPartyTypeValue === 'FACTORY' ? 'selected' : ''}>工厂（默认）</option>
                          <option value="LEGAL_ENTITY" ${ownerPartyTypeValue === 'LEGAL_ENTITY' ? 'selected' : ''}>法务主体</option>
                        </select>
                      </label>
                      ${
                        state.demandOwnerPartyManual && state.demandOwnerPartyType === 'LEGAL_ENTITY'
                          ? `
                            <label class="space-y-1">
                              <span class="text-xs">法务主体</span>
                              <select data-prod-field="demandOwnerPartyId" class="w-full rounded-md border px-3 py-2 text-sm">
                                <option value="" ${state.demandOwnerPartyId ? '' : 'selected'}>选择法务主体</option>
                                ${legalEntities
                                  .map(
                                    (entity) =>
                                      `<option value="${entity.id}" ${
                                        state.demandOwnerPartyId === entity.id ? 'selected' : ''
                                      }>${escapeHtml(entity.name)}</option>`,
                                  )
                                  .join('')}
                              </select>
                            </label>
                          `
                          : ''
                      }
                    </div>
                    <label class="space-y-1">
                      <span class="text-xs">变更原因</span>
                      <textarea data-prod-field="demandOwnerReason" rows="2" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="如需变更货权主体，请填写原因">${escapeHtml(
                        state.demandOwnerReason,
                      )}</textarea>
                    </label>
                  </div>
                `
                : ''
            }
          </section>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-demand-generate">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            !state.demandSelectedFactoryId || targetDemands.length === 0 ? 'pointer-events-none opacity-50' : ''
          }" data-prod-action="open-demand-generate-confirm">确认生成</button>
        </footer>
      </section>
    </div>
  `
}

function renderDemandSingleGenerateDialog(singleDemand: ProductionDemand | null): string {
  if (!singleDemand) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-demand-generate" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">生成生产单</h3>
          <p class="mt-1 text-sm text-muted-foreground">为需求 ${escapeHtml(singleDemand.demandId)} (${escapeHtml(singleDemand.spuCode)}) 生成生产单</p>
        </header>

        <div class="space-y-4 px-6 py-5">
          ${renderDemandFactorySelectorFields()}
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-demand-generate">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            !state.demandSelectedFactoryId ? 'pointer-events-none opacity-50' : ''
          }" data-prod-action="open-demand-generate-confirm">确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderDemandConfirmDialog(): string {
  if (!state.demandGenerateConfirmOpen) return ''

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <div class="w-full max-w-md rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">确认生成</h3>
          <p class="mt-1 text-sm text-muted-foreground">仅已发布技术包的需求可生成生产单，待完善技术包请先完善并发布。</p>
        </header>
        <footer class="flex items-center justify-end gap-2 px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-demand-generate-confirm">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="confirm-demand-generate">确认</button>
        </footer>
      </div>
    </div>
  `
}

export function renderProductionDemandInboxPage(): string {
  const filteredDemands = getFilteredDemands()
  const selectedAll = filteredDemands.length > 0 && filteredDemands.every((demand) => state.demandSelectedIds.has(demand.demandId))
  const batchGeneratable = getBatchGeneratableDemandIds()
  const demandDetailDrawer = renderDemandDetailDrawer()
  const singleGenerateDemand = getDemandById(state.demandSingleGenerateId)
  const batchGenerateDialog = renderDemandBatchGenerateDialog()
  const singleGenerateDialog = renderDemandSingleGenerateDialog(singleGenerateDemand)
  const confirmDialog = renderDemandConfirmDialog()

  return `
    <div class="space-y-4">
      <header class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">生产需求接收</h1>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <button
              class="relative inline-flex h-5 w-9 items-center rounded-full border transition-colors ${
                state.demandOnlyUngenerated ? 'border-blue-600 bg-blue-600' : 'bg-muted'
              }"
              data-prod-action="toggle-demand-only-ungenerated"
              aria-pressed="${state.demandOnlyUngenerated ? 'true' : 'false'}"
            >
              <span class="inline-block h-4 w-4 rounded-full bg-background shadow transition-transform ${
                state.demandOnlyUngenerated ? 'translate-x-4' : 'translate-x-0.5'
              }"></span>
            </button>
            <span class="text-sm">只看未生成</span>
          </div>
          <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted ${
            batchGeneratable.length === 0 ? 'pointer-events-none opacity-50' : ''
          }" data-prod-action="open-demand-batch">
            <i data-lucide="plus" class="mr-1 h-4 w-4"></i>
            批量生成 (${batchGeneratable.length})
          </button>
          <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="refresh-demand">
            <i data-lucide="refresh-cw" class="mr-1 h-4 w-4"></i>
            重置
          </button>
        </div>
      </header>

      <section class="grid grid-cols-1 gap-3 md:grid-cols-3">
        ${renderStatCard(
          '待转单',
          state.demands.filter((demand) => demand.demandStatus === 'PENDING_CONVERT').length,
        )}
        ${renderStatCard(
          '已转单',
          state.demands.filter((demand) => demand.demandStatus === 'CONVERTED').length,
        )}
        ${renderStatCard(
          '已挂起',
          state.demands.filter((demand) => demand.demandStatus === 'HOLD').length,
        )}
      </section>

      <section class="rounded-lg border bg-card p-4">
        <div class="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">关键词</span>
            <div class="relative mt-1">
              <i data-lucide="search" class="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"></i>
              <input
                data-prod-field="demandKeyword"
                value="${escapeHtml(state.demandKeyword)}"
                placeholder="需求号/SPU/旧单号"
                class="w-full rounded-md border py-2 pl-8 pr-3 text-sm"
              />
            </div>
          </label>
          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">需求状态</span>
            <select data-prod-field="demandStatusFilter" class="mt-1 w-full rounded-md border px-3 py-2 text-sm">
              <option value="ALL" ${state.demandStatusFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="PENDING_CONVERT" ${
                state.demandStatusFilter === 'PENDING_CONVERT' ? 'selected' : ''
              }>待转单</option>
              <option value="CONVERTED" ${state.demandStatusFilter === 'CONVERTED' ? 'selected' : ''}>已转单</option>
              <option value="HOLD" ${state.demandStatusFilter === 'HOLD' ? 'selected' : ''}>已挂起</option>
              <option value="CANCELLED" ${state.demandStatusFilter === 'CANCELLED' ? 'selected' : ''}>已取消</option>
            </select>
          </label>
          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">技术包状态</span>
            <select data-prod-field="demandTechPackFilter" class="mt-1 w-full rounded-md border px-3 py-2 text-sm">
              <option value="ALL" ${state.demandTechPackFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="INCOMPLETE" ${
                state.demandTechPackFilter === 'INCOMPLETE' ? 'selected' : ''
              }>待完善</option>
              <option value="RELEASED" ${state.demandTechPackFilter === 'RELEASED' ? 'selected' : ''}>已发布</option>
            </select>
          </label>
          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">是否已生成</span>
            <select data-prod-field="demandHasOrderFilter" class="mt-1 w-full rounded-md border px-3 py-2 text-sm">
              <option value="ALL" ${state.demandHasOrderFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="YES" ${state.demandHasOrderFilter === 'YES' ? 'selected' : ''}>已生成</option>
              <option value="NO" ${state.demandHasOrderFilter === 'NO' ? 'selected' : ''}>未生成</option>
            </select>
          </label>
          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">优先级</span>
            <select data-prod-field="demandPriorityFilter" class="mt-1 w-full rounded-md border px-3 py-2 text-sm">
              <option value="ALL" ${state.demandPriorityFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="URGENT" ${state.demandPriorityFilter === 'URGENT' ? 'selected' : ''}>紧急</option>
              <option value="HIGH" ${state.demandPriorityFilter === 'HIGH' ? 'selected' : ''}>高</option>
              <option value="NORMAL" ${state.demandPriorityFilter === 'NORMAL' ? 'selected' : ''}>普通</option>
            </select>
          </label>
          <div class="flex items-end gap-2">
            <button class="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700" data-prod-action="query-demand">查询</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="reset-demand-filters">重置</button>
          </div>
        </div>
      </section>

      ${
        state.demandSelectedIds.size > 0
          ? `<p class="text-sm text-muted-foreground">已选 ${state.demandSelectedIds.size} 项，可生成 ${batchGeneratable.length} 项</p>`
          : ''
      }

      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full min-w-[1200px] text-sm">
          <thead>
            <tr>
              <th class="w-10 bg-muted/50 px-3 py-3 text-left text-xs text-muted-foreground"><input type="checkbox" data-prod-action="toggle-demand-select-all" ${
                selectedAll ? 'checked' : ''
              } /></th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">需求编号</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">来源单号</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">SPU</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">优先级</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">状态</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">技术包</th>
              <th class="bg-muted/50 px-3 py-3 text-right text-xs font-medium text-muted-foreground">数量</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">交付日期</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">生产单</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredDemands.length === 0
                ? `<tr><td colspan="11" class="h-32 px-3 text-center text-muted-foreground">暂无数据</td></tr>`
                : filteredDemands
                    .map((demand) => {
                      const selected = state.demandSelectedIds.has(demand.demandId)
                      const techPack = getTechPackSnapshotForDemand(demand)

                      return `
                        <tr class="border-b last:border-0 ${selected ? 'bg-muted/30' : ''}">
                          <td class="px-3 py-3"><input type="checkbox" data-prod-action="toggle-demand-select" data-demand-id="${
                            demand.demandId
                          }" ${selected ? 'checked' : ''} /></td>
                          <td class="px-3 py-3 font-mono text-sm">${escapeHtml(demand.demandId)}</td>
                          <td class="px-3 py-3 font-mono text-sm">
                            <div class="flex items-center gap-1">
                              <span>${escapeHtml(demand.legacyOrderNo)}</span>
                              <button class="inline-flex h-5 w-5 items-center justify-center rounded opacity-50 hover:bg-muted hover:opacity-100" data-prod-action="copy-demand-legacy" data-legacy-no="${escapeHtml(
                                demand.legacyOrderNo,
                              )}">
                                <i data-lucide="copy" class="h-3 w-3"></i>
                              </button>
                            </div>
                          </td>
                          <td class="px-3 py-3">
                            <p class="font-mono text-xs text-muted-foreground">${escapeHtml(demand.spuCode)}</p>
                            <p class="max-w-[160px] truncate" title="${escapeHtml(demand.spuName)}">${escapeHtml(
                              demand.spuName,
                            )}</p>
                          </td>
                          <td class="px-3 py-3">${renderBadge(
                            demandPriorityConfig[demand.priority].label,
                            demandPriorityConfig[demand.priority].className,
                          )}</td>
                          <td class="px-3 py-3">${renderBadge(
                            demandStatusConfig[demand.demandStatus].label,
                            demandStatusConfig[demand.demandStatus].className,
                          )}</td>
                          <td class="px-3 py-3">
                            <div class="flex items-center gap-1">
                              ${renderBadge(
                                demandTechPackStatusConfig[techPack.status].label,
                                demandTechPackStatusConfig[techPack.status].className,
                              )}
                              <span class="text-xs text-muted-foreground">(${escapeHtml(techPack.versionLabel || '-')})</span>
                            </div>
                          </td>
                          <td class="px-3 py-3 text-right font-mono">${demand.requiredQtyTotal.toLocaleString()}</td>
                          <td class="px-3 py-3">${escapeHtml(safeText(demand.requiredDeliveryDate))}</td>
                          <td class="px-3 py-3">
                            ${
                              demand.productionOrderId
                                ? `<button class="h-auto p-0 font-mono text-sm text-blue-600 hover:underline" data-prod-action="open-order-detail" data-order-id="${
                                    demand.productionOrderId
                                  }">${escapeHtml(demand.productionOrderId)}</button>`
                                : '<span class="text-muted-foreground">—</span>'
                            }
                          </td>
                          <td class="px-3 py-3">
                            <div class="flex flex-wrap items-center gap-1">
                              <button class="rounded px-2 py-1 text-xs hover:bg-muted" data-prod-action="open-demand-detail" data-demand-id="${
                                demand.demandId
                              }">查看详情</button>
                              <button class="inline-flex items-center rounded px-2 py-1 text-xs hover:bg-muted" data-prod-action="open-tech-pack" data-spu-code="${escapeHtml(
                                demand.spuCode,
                              )}">
                                <i data-lucide="file-text" class="mr-1 h-4 w-4"></i>
                                完善技术包
                              </button>
                              ${
                                demand.demandStatus === 'PENDING_CONVERT' &&
                                !demand.hasProductionOrder &&
                                techPack.status === 'RELEASED'
                                  ? `<button class="rounded border px-2 py-1 text-xs hover:bg-muted" data-prod-action="open-demand-single" data-demand-id="${
                                      demand.demandId
                                    }">生成</button>`
                                  : ''
                              }
                              ${
                                demand.demandStatus === 'PENDING_CONVERT'
                                  ? `<button class="rounded px-2 py-1 text-xs hover:bg-muted" data-prod-action="hold-demand" data-demand-id="${
                                      demand.demandId
                                    }">挂起</button>`
                                  : ''
                              }
                              ${
                                demand.demandStatus === 'HOLD'
                                  ? `<button class="rounded px-2 py-1 text-xs hover:bg-muted" data-prod-action="unhold-demand" data-demand-id="${
                                      demand.demandId
                                    }">取消挂起</button>`
                                  : ''
                              }
                              ${
                                demand.demandStatus === 'PENDING_CONVERT' || demand.demandStatus === 'HOLD'
                                  ? `<button class="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50" data-prod-action="cancel-demand" data-demand-id="${
                                      demand.demandId
                                    }">取消</button>`
                                  : ''
                              }
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>

      <p class="text-sm text-muted-foreground">共 ${filteredDemands.length} 条记录</p>

      ${demandDetailDrawer}
      ${batchGenerateDialog}
      ${singleGenerateDialog}
      ${confirmDialog}
    </div>
  `
}
function renderOrderRiskFlags(flags: RiskFlag[]): string {
  if (flags.length === 0) {
    return '<span class="text-muted-foreground">-</span>'
  }

  const primary = flags.slice(0, 3)
  const overflow = flags.length - primary.length

  return `
    <div class="flex flex-wrap gap-1">
      ${primary
        .map((flag) => renderBadge(riskFlagConfig[flag]?.label ?? flag, riskFlagConfig[flag]?.color ?? 'bg-slate-100 text-slate-700'))
        .join('')}
      ${
        overflow > 0
          ? `
            <div class="group relative">
              <span class="inline-flex rounded border px-2 py-0.5 text-xs text-muted-foreground">+${overflow}</span>
              <div class="invisible absolute left-0 top-full z-20 mt-1 min-w-[140px] rounded-md border bg-background p-2 text-xs shadow-lg group-hover:visible">
                ${flags
                  .slice(3)
                  .map((flag) => `<div>${escapeHtml(riskFlagConfig[flag]?.label ?? flag)}</div>`)
                  .join('')}
              </div>
            </div>
          `
          : ''
      }
    </div>
  `
}

function renderOrderAssignmentOverview(order: ProductionOrder): string {
  const runtime = getOrderRuntimeAssignmentSnapshot(order)
  const total = runtime.assignmentSummary.totalTasks
  if (total === 0) return '<span class="text-muted-foreground">-</span>'

  return `
    <div class="space-y-0.5 text-xs">
      <p class="flex items-center gap-1"><i data-lucide="send" class="h-3 w-3 text-blue-500"></i>派单: ${runtime.assignmentSummary.directCount}</p>
      <p class="flex items-center gap-1"><i data-lucide="gavel" class="h-3 w-3 text-purple-500"></i>竞价: ${runtime.assignmentSummary.biddingCount}</p>
      <p class="text-muted-foreground">总计: ${total}</p>
    </div>
  `
}

function renderOrderDemandSnapshotDrawer(): string {
  const order = getOrderById(state.ordersDemandSnapshotId)
  if (!order) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-orders-demand-snapshot" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl sm:max-w-[520px]" data-dialog-panel="true">
        <header class="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-5 py-4">
          <h3 class="text-lg font-semibold">需求快照</h3>
          <button class="rounded-md border px-3 py-1 text-xs hover:bg-muted" data-prod-action="close-orders-demand-snapshot">关闭</button>
        </header>
        <div class="h-full space-y-5 overflow-y-auto px-5 py-4 pb-12">
          <section class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p class="text-xs text-muted-foreground">需求编号</p>
              <p class="font-mono">${escapeHtml(order.demandSnapshot.demandId)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">SPU编码</p>
              <p class="font-mono">${escapeHtml(order.demandSnapshot.spuCode)}</p>
            </div>
            <div class="col-span-2">
              <p class="text-xs text-muted-foreground">SPU名称</p>
              <p>${escapeHtml(order.demandSnapshot.spuName)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">优先级</p>
              <p>${escapeHtml(order.demandSnapshot.priority)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">交付日期</p>
              <p>${escapeHtml(safeText(order.demandSnapshot.requiredDeliveryDate))}</p>
            </div>
          </section>

          <section class="space-y-3 border-t pt-4">
            <h4 class="text-sm font-semibold">SKU明细</h4>
            <div class="overflow-x-auto rounded-md border">
              <table class="w-full text-sm">
                <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th class="px-2 py-2 text-left font-medium">SKU</th>
                    <th class="px-2 py-2 text-left font-medium">尺码</th>
                    <th class="px-2 py-2 text-left font-medium">颜色</th>
                    <th class="px-2 py-2 text-right font-medium">数量</th>
                  </tr>
                </thead>
                <tbody>
                  ${order.demandSnapshot.skuLines
                    .map(
                      (sku) => `
                        <tr class="border-b last:border-0">
                          <td class="px-2 py-2 font-mono text-xs">${escapeHtml(sku.skuCode)}</td>
                          <td class="px-2 py-2">${escapeHtml(sku.size)}</td>
                          <td class="px-2 py-2">${escapeHtml(sku.color)}</td>
                          <td class="px-2 py-2 text-right">${sku.qty.toLocaleString()}</td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </section>

          ${
            order.demandSnapshot.constraintsNote
              ? `<section class="space-y-2 border-t pt-4">
                  <h4 class="text-sm font-semibold">约束条件</h4>
                  <p class="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">${escapeHtml(
                    order.demandSnapshot.constraintsNote,
                  )}</p>
                </section>`
              : ''
          }
        </div>
      </section>
    </div>
  `
}

function renderOrderLogsDialog(): string {
  const order = getOrderById(state.ordersLogsId)
  if (!order) return ''
  const logs = getOrderMergedAuditLogs(order).slice().reverse()

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <div class="w-full max-w-3xl rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="flex items-center justify-between border-b px-6 py-4">
          <h3 class="text-lg font-semibold">操作日志</h3>
          <button class="rounded-md border px-3 py-1 text-xs hover:bg-muted" data-prod-action="close-orders-logs">关闭</button>
        </header>
        <div class="max-h-[60vh] overflow-y-auto px-6 py-4">
          <div class="overflow-x-auto rounded-md border">
            <table class="w-full text-sm">
              <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left font-medium">时间</th>
                  <th class="px-3 py-2 text-left font-medium">操作</th>
                  <th class="px-3 py-2 text-left font-medium">详情</th>
                  <th class="px-3 py-2 text-left font-medium">操作人</th>
                </tr>
              </thead>
              <tbody>
                ${
                  logs.length === 0
                    ? renderEmptyRow(4, '暂无数据')
                    : logs
                        .map(
                          (log) => `
                            <tr class="border-b last:border-0">
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(log.at)}</td>
                              <td class="px-3 py-2">${renderBadge(log.action, 'bg-slate-100 text-slate-700')}</td>
                              <td class="px-3 py-2">${escapeHtml(log.detail)}</td>
                              <td class="px-3 py-2">${escapeHtml(log.by)}</td>
                            </tr>
                          `,
                        )
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
}

function getOrderMaterialIndicators(order: ProductionOrder) {
  return getMaterialDraftIndicatorsByOrder(order.productionOrderId)
}

function getOrderSplitAuditLogs(order: ProductionOrder): AuditLog[] {
  const splitEvents = listRuntimeTaskSplitGroupsByOrder(order.productionOrderId)
  if (splitEvents.length === 0) return []

  return splitEvents.flatMap((event) => {
    const splitLog: AuditLog = {
      id: `LOG-SPLIT-${order.productionOrderId}-${event.splitGroupId}`,
      action: 'TASK_SPLIT',
      detail: `任务 ${event.sourceTaskNo} 按明细分配拆分为 ${event.resultTasks.length} 条平级任务（${event.statusSummary}）`,
      at: event.eventAt,
      by: '系统',
    }

    const resultLog: AuditLog = {
      id: `LOG-SPLIT-RESULT-${order.productionOrderId}-${event.splitGroupId}`,
      action: 'TASK_SPLIT_RESULT',
      detail: `拆分结果：${event.resultTasks.map((task) => `${task.taskNo}(${task.assignedFactoryName || '-'}，${taskStatusLabel[task.status]})`).join('；')}`,
      at: event.eventAt,
      by: '系统',
    }

    return [splitLog, resultLog]
  })
}

function getOrderMergedAuditLogs(order: ProductionOrder): AuditLog[] {
  const materialLogs = listMaterialDraftOperationLogsByOrder(order.productionOrderId).map((log) => ({
    id: log.id,
    action: log.action,
    detail: log.detail,
    at: log.at,
    by: log.by,
  }))
  const splitLogs = getOrderSplitAuditLogs(order)
  return [...order.auditLogs, ...materialLogs, ...splitLogs].sort((a, b) => a.at.localeCompare(b.at))
}

function renderOrderMaterialSummary(order: ProductionOrder): string {
  const summary = getMaterialRequestDraftSummaryByOrder(order.productionOrderId)
  const indicators = getOrderMaterialIndicators(order)

  if (summary.totalDraftCount === 0) {
    return `
      <button
        class="w-full rounded-md border border-transparent px-1 py-1 text-left hover:border-border hover:bg-muted/40"
        data-prod-action="open-material-draft-drawer"
        data-order-id="${order.productionOrderId}"
      >
        ${renderBadge('未建草稿', 'bg-slate-100 text-slate-700')}
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(indicators.materialDraftHintText)}</div>
      </button>
    `
  }

  if (summary.status === 'pending') {
    return `
      <button
        class="w-full rounded-md border border-transparent px-1 py-1 text-left hover:border-border hover:bg-muted/40"
        data-prod-action="open-material-draft-drawer"
        data-order-id="${order.productionOrderId}"
      >
        ${renderBadge('待确认', 'bg-amber-100 text-amber-700')}
        <div class="mt-1 text-xs text-muted-foreground">草稿 ${summary.totalDraftCount} / 待确认 ${summary.pendingCount}</div>
        ${
          summary.notApplicableCount > 0
            ? `<div class="text-xs text-muted-foreground">不涉及 ${summary.notApplicableCount}</div>`
            : ''
        }
      </button>
    `
  }

  if (summary.status === 'partial_created') {
    return `
      <button
        class="w-full rounded-md border border-transparent px-1 py-1 text-left hover:border-border hover:bg-muted/40"
        data-prod-action="open-material-draft-drawer"
        data-order-id="${order.productionOrderId}"
      >
        ${renderBadge('部分确认', 'bg-blue-100 text-blue-700')}
        <div class="mt-1 text-xs text-muted-foreground">已确认 ${summary.createdCount} / 待确认 ${summary.pendingCount}</div>
        ${
          summary.notApplicableCount > 0
            ? `<div class="text-xs text-muted-foreground">不涉及 ${summary.notApplicableCount}</div>`
            : ''
        }
      </button>
    `
  }

  return `
    <button
      class="w-full rounded-md border border-transparent px-1 py-1 text-left hover:border-border hover:bg-muted/40"
      data-prod-action="open-material-draft-drawer"
      data-order-id="${order.productionOrderId}"
    >
      ${renderBadge('已确认', summary.status === 'created' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700')}
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(indicators.materialDraftHintText)}</div>
      ${
        summary.notApplicableCount > 0
          ? `<div class="text-xs text-muted-foreground">不涉及 ${summary.notApplicableCount}</div>`
          : ''
      }
    </button>
  `
}

function renderMaterialDraftTaskCard(draft: MaterialRequestDraft): string {
  const task = getProcessTaskById(draft.taskId)
  const isCreated = draft.draftStatus === 'created'
  const isNotApplicable = draft.draftStatus === 'not_applicable'

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <h4 class="text-sm font-semibold">${escapeHtml(draft.taskName)}</h4>
            ${renderBadge(getTaskTypeLabel(draft.taskType), 'bg-slate-100 text-slate-700')}
            ${renderBadge(getDraftStatusLabel(draft.draftStatus), isCreated ? 'bg-green-100 text-green-700' : isNotApplicable ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-700')}
            ${
              task
                ? renderBadge(taskStatusLabel[task.status], taskStatusClass[task.status])
                : ''
            }
          </div>
          <div class="text-xs text-muted-foreground">
            任务编号：${escapeHtml(draft.taskNo)} · 任务类型：${escapeHtml(getTaskTypeLabel(draft.taskType))}
          </div>
        </div>
      </div>

      <div class="mt-3 grid gap-3 md:grid-cols-3">
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">是否需要领料</span>
          <label class="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              data-prod-action="toggle-material-draft-needed"
              data-draft-id="${escapeHtml(draft.draftId)}"
              ${draft.needMaterial ? 'checked' : ''}
              ${isCreated ? 'disabled' : ''}
            />
            需要领料
          </label>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">领料方式</span>
          <select
            data-prod-field="materialDraftMode:${escapeHtml(draft.draftId)}"
            class="h-9 w-full rounded-md border px-3 text-sm"
            ${isCreated || !draft.needMaterial ? 'disabled' : ''}
          >
            <option value="warehouse_delivery" ${draft.materialMode === 'warehouse_delivery' ? 'selected' : ''}>仓库配送到厂</option>
            <option value="factory_pickup" ${draft.materialMode === 'factory_pickup' ? 'selected' : ''}>工厂到仓自提</option>
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">备注</span>
          <input
            data-prod-field="materialDraftRemark:${escapeHtml(draft.draftId)}"
            value="${escapeHtml(draft.remark)}"
            class="h-9 w-full rounded-md border px-3 text-sm"
            ${isCreated ? 'disabled' : ''}
            placeholder="可填写领料说明"
          />
        </label>
      </div>

      <div class="mt-3 overflow-x-auto rounded-md border">
        <table class="w-full min-w-[920px] text-sm">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">是否领用</th>
              <th class="px-3 py-2 text-left font-medium">物料来源</th>
              <th class="px-3 py-2 text-left font-medium">物料编码</th>
              <th class="px-3 py-2 text-left font-medium">物料名称</th>
              <th class="px-3 py-2 text-left font-medium">规格/属性</th>
              <th class="px-3 py-2 text-right font-medium">建议数量</th>
              <th class="px-3 py-2 text-right font-medium">确认数量</th>
              <th class="px-3 py-2 text-left font-medium">单位</th>
              <th class="px-3 py-2 text-left font-medium">说明/来源说明</th>
            </tr>
          </thead>
          <tbody>
            ${
              draft.lines.length === 0
                ? renderEmptyRow(9, '当前任务暂无自动建议物料，可点击“补充物料”添加')
                : draft.lines
                    .map(
                      (line) => `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2">
                            <input
                              type="checkbox"
                              data-prod-action="toggle-material-draft-line"
                              data-draft-id="${escapeHtml(draft.draftId)}"
                              data-line-id="${escapeHtml(line.lineId)}"
                              ${line.selected ? 'checked' : ''}
                              ${isCreated || !draft.needMaterial ? 'disabled' : ''}
                            />
                          </td>
                          <td class="px-3 py-2">${renderBadge(line.sourceTypeLabel, line.sourceType === 'bom' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700')}</td>
                          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(line.materialCode)}</td>
                          <td class="px-3 py-2">${escapeHtml(line.materialName)}</td>
                          <td class="px-3 py-2">${escapeHtml(line.materialSpec)}</td>
                          <td class="px-3 py-2 text-right">${line.suggestedQty}</td>
                          <td class="px-3 py-2 text-right">
                            <input
                              data-prod-field="materialDraftLineQty:${escapeHtml(draft.draftId)}:${escapeHtml(line.lineId)}"
                              value="${line.confirmedQty}"
                              class="h-8 w-20 rounded-md border px-2 text-right text-sm"
                              ${isCreated || !draft.needMaterial || !line.selected ? 'disabled' : ''}
                            />
                          </td>
                          <td class="px-3 py-2">${escapeHtml(line.unit)}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(line.note)}</td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>

      ${
        isCreated
          ? `
            <div class="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              <div>正式领料需求编号：<span class="font-mono">${escapeHtml(draft.createdMaterialRequestNo)}</span></div>
              <div class="mt-0.5 text-xs">创建人：${escapeHtml(draft.createdBy || '-')} · 创建时间：${escapeHtml(draft.createdAt || '-')}</div>
            </div>
          `
          : `
            <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted"
                data-prod-action="open-add-draft-materials"
                data-draft-id="${escapeHtml(draft.draftId)}"
                ${!draft.needMaterial ? 'disabled' : ''}
              >
                <i data-lucide="plus" class="mr-1 h-4 w-4"></i>
                补充物料
              </button>
              <div class="flex flex-wrap items-center gap-2">
                <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-prod-action="restore-material-draft-suggestion" data-draft-id="${escapeHtml(draft.draftId)}">
                  恢复系统建议
                </button>
                <button
                  class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90"
                  data-prod-action="confirm-material-request-draft"
                  data-draft-id="${escapeHtml(draft.draftId)}"
                >
                  确认创建
                </button>
              </div>
            </div>
          `
      }
    </section>
  `
}

function renderAddDraftMaterialsDialog(): string {
  const draftId = state.materialDraftAddDraftId
  if (!draftId) return ''

  const draft = getMaterialRequestDraftById(draftId)
  if (!draft) return ''

  const candidates = getSupplementOptionDisplayRows(draftId)

  return `
    <div class="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-3xl rounded-lg border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 class="text-base font-semibold">补充物料</h3>
            <p class="text-xs text-muted-foreground">${escapeHtml(draft.taskName)} · ${escapeHtml(draft.taskNo)}</p>
          </div>
          <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-prod-action="close-add-draft-materials" aria-label="关闭">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </header>
        <div class="max-h-[60vh] overflow-y-auto p-4">
          <div class="overflow-x-auto rounded-md border">
            <table class="w-full min-w-[820px] text-sm">
              <thead class="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left font-medium">勾选</th>
                  <th class="px-3 py-2 text-left font-medium">来源类型</th>
                  <th class="px-3 py-2 text-left font-medium">物料编码</th>
                  <th class="px-3 py-2 text-left font-medium">物料名称</th>
                  <th class="px-3 py-2 text-left font-medium">规格</th>
                  <th class="px-3 py-2 text-right font-medium">建议数量</th>
                  <th class="px-3 py-2 text-left font-medium">说明</th>
                </tr>
              </thead>
              <tbody>
                ${
                  candidates.length === 0
                    ? renderEmptyRow(7, '当前无可补充物料')
                    : candidates
                        .map(
                          (option) => `
                            <tr class="border-b last:border-0">
                              <td class="px-3 py-2">
                                <input
                                  type="checkbox"
                                  data-prod-action="toggle-add-draft-material"
                                  data-option-key="${escapeHtml(option.optionKey)}"
                                  ${state.materialDraftAddSelections.has(option.optionKey) ? 'checked' : ''}
                                />
                              </td>
                              <td class="px-3 py-2">${renderBadge(option.sourceTypeLabel, option.sourceTypeLabel === 'BOM物料' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700')}</td>
                              <td class="px-3 py-2 font-mono text-xs">${escapeHtml(option.materialCode)}</td>
                              <td class="px-3 py-2">${escapeHtml(option.materialName)}</td>
                              <td class="px-3 py-2">${escapeHtml(option.materialSpec)}</td>
                              <td class="px-3 py-2 text-right">${option.suggestedQty}${escapeHtml(option.unit)}</td>
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(option.note)}</td>
                            </tr>
                          `,
                        )
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-prod-action="close-add-draft-materials">取消</button>
          <button class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90" data-prod-action="add-draft-materials">加入当前任务</button>
        </footer>
      </section>
    </div>
  `
}

function renderMaterialDraftDrawer(): string {
  const order = getOrderById(state.materialDraftOrderId)
  if (!order) return ''

  const drafts = listMaterialRequestDraftsByOrder(order.productionOrderId)
  const summary = getMaterialRequestDraftSummaryByOrder(order.productionOrderId)
  const techPack = getOrderTechPackInfo(order)
  const runtime = getOrderRuntimeAssignmentSnapshot(order)
  const breakdown = getOrderTaskBreakdownSnapshot(order)

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-material-draft-drawer" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl xl:max-w-[980px]" data-dialog-panel="true">
        <header class="sticky top-0 z-10 border-b bg-background px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold">领料需求草稿</h3>
              <p class="mt-1 text-xs text-muted-foreground">按任务生成系统建议草稿，确认后创建正式领料需求并挂接到任务</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-prod-action="close-material-draft-drawer" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
        </header>
        <div class="h-[calc(100vh-73px)] space-y-4 overflow-y-auto p-5">
          <section class="rounded-lg border bg-card p-4">
            <div class="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              <div>
                <div class="text-xs text-muted-foreground">生产单号</div>
                <div class="font-mono text-sm">${escapeHtml(order.productionOrderId)}</div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">SPU</div>
                <div class="font-mono text-sm">${escapeHtml(order.demandSnapshot.spuCode)}</div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">款名</div>
                <div class="truncate text-sm" title="${escapeHtml(order.demandSnapshot.spuName)}">${escapeHtml(order.demandSnapshot.spuName)}</div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">技术包</div>
                <div class="text-sm">${escapeHtml(techPack.currentVersion)}</div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">拆解状态</div>
                <div class="text-sm">${breakdown.isBrokenDown ? '已拆解' : '未拆解'}</div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">主工厂</div>
                <div class="truncate text-sm" title="${escapeHtml(order.mainFactorySnapshot.name)}">${escapeHtml(order.mainFactorySnapshot.name)}</div>
              </div>
            </div>
          </section>

          <section class="grid gap-3 md:grid-cols-4">
            ${renderStatCard('草稿总数', summary.totalDraftCount)}
            ${renderStatCard('待确认', summary.pendingCount)}
            ${renderStatCard('已创建', summary.createdCount)}
            ${renderStatCard('不涉及', summary.notApplicableCount)}
          </section>

          ${
            drafts.length === 0
              ? `
                <section class="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
                  当前生产单暂无可识别领料任务，任务拆解后会自动生成建议草稿。
                </section>
              `
              : drafts.map((draft) => renderMaterialDraftTaskCard(draft)).join('')
          }
        </div>
      </section>
      ${renderAddDraftMaterialsDialog()}
    </div>
  `
}

export function renderProductionOrdersPage(): string {
  const filteredOrders = getFilteredOrders()
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE))

  if (state.ordersCurrentPage > totalPages) {
    state.ordersCurrentPage = totalPages
  }

  const pagedOrders = getPaginatedOrders(filteredOrders)
  const selectedAll =
    state.ordersSelectedIds.size === pagedOrders.length && pagedOrders.length > 0
  const materialReminderStats = filteredOrders.reduce(
    (acc, order) => {
      const indicators = getOrderMaterialIndicators(order)
      if (!indicators.hasMaterialDraft) acc.noDraft += 1
      if (indicators.hasMaterialDraft && !indicators.hasConfirmedMaterialRequest) acc.pendingOnly += 1
      if (indicators.hasConfirmedMaterialRequest) acc.confirmed += 1
      return acc
    },
    { noDraft: 0, pendingOnly: 0, confirmed: 0 },
  )

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">生产单管理</h1>
        <div class="flex flex-wrap items-center gap-2">
          <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="orders-from-demand">
            <i data-lucide="file-text" class="mr-1 h-4 w-4"></i>
            从需求生成
          </button>
          <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="orders-export">
            <i data-lucide="download" class="mr-1 h-4 w-4"></i>
            导出
          </button>
          <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="orders-refresh">
            <i data-lucide="refresh-cw" class="mr-1 h-4 w-4"></i>
            刷新
          </button>
          <div class="inline-flex overflow-hidden rounded-md border">
            <button
              class="inline-flex items-center px-3 py-2 text-sm ${state.ordersViewMode === 'table' ? 'bg-muted' : 'hover:bg-muted'}"
              data-prod-action="switch-orders-view"
              data-view="table"
              aria-label="表格视图"
            >
              <i data-lucide="table" class="h-4 w-4"></i>
            </button>
            <button
              class="inline-flex items-center px-3 py-2 text-sm ${state.ordersViewMode === 'board' ? 'bg-muted' : 'hover:bg-muted'}"
              data-prod-action="switch-orders-view"
              data-view="board"
              aria-label="看板视图"
            >
              <i data-lucide="layout-grid" class="h-4 w-4"></i>
            </button>
          </div>
        </div>
      </header>

      <section class="rounded-lg border bg-card p-4">
        <div class="grid gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          <div>
            <span class="text-xs text-muted-foreground">关键词</span>
            <div class="relative mt-1">
              <i data-lucide="search" class="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"></i>
              <input
                data-prod-field="ordersKeyword"
                value="${escapeHtml(state.ordersKeyword)}"
                placeholder="单号/旧单号/SPU/工厂"
                class="h-9 w-full rounded-md border pl-8 pr-3 text-sm"
              />
            </div>
          </div>

          <div>
            <span class="text-xs text-muted-foreground">生产单状态</span>
            <select data-prod-field="ordersStatusFilter" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              <option value="ALL" ${state.ordersStatusFilter.length === 0 ? 'selected' : ''}>全部</option>
              ${(Object.keys(productionOrderStatusConfig) as ProductionOrderStatus[])
                .map(
                  (status) =>
                    `<option value="${status}" ${
                      state.ordersStatusFilter.length === 1 && state.ordersStatusFilter[0] === status
                        ? 'selected'
                        : ''
                    }>${escapeHtml(productionOrderStatusConfig[status].label)}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div>
            <span class="text-xs text-muted-foreground">技术包状态</span>
            <select data-prod-field="ordersTechPackFilter" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              <option value="ALL" ${state.ordersTechPackFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="INCOMPLETE" ${state.ordersTechPackFilter === 'INCOMPLETE' ? 'selected' : ''}>待完善</option>
              <option value="RELEASED" ${state.ordersTechPackFilter === 'RELEASED' ? 'selected' : ''}>已发布</option>
            </select>
          </div>

          <div>
            <span class="text-xs text-muted-foreground">是否已拆解</span>
            <select data-prod-field="ordersBreakdownFilter" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              <option value="ALL" ${state.ordersBreakdownFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="YES" ${state.ordersBreakdownFilter === 'YES' ? 'selected' : ''}>已拆解</option>
              <option value="NO" ${state.ordersBreakdownFilter === 'NO' ? 'selected' : ''}>未拆解</option>
            </select>
          </div>

          <div>
            <span class="text-xs text-muted-foreground">分配进度</span>
            <select data-prod-field="ordersAssignmentProgressFilter" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              <option value="ALL" ${state.ordersAssignmentProgressFilter === 'ALL' ? 'selected' : ''}>全部</option>
              ${(Object.keys(assignmentProgressStatusConfig) as AssignmentProgressStatus[])
                .map(
                  (status) =>
                    `<option value="${status}" ${
                      state.ordersAssignmentProgressFilter === status ? 'selected' : ''
                    }>${escapeHtml(assignmentProgressStatusConfig[status].label)}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div>
            <span class="text-xs text-muted-foreground">分配模式</span>
            <select data-prod-field="ordersAssignmentModeFilter" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              <option value="ALL" ${state.ordersAssignmentModeFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="DIRECT_ONLY" ${
                state.ordersAssignmentModeFilter === 'DIRECT_ONLY' ? 'selected' : ''
              }>仅派单</option>
              <option value="BIDDING_ONLY" ${
                state.ordersAssignmentModeFilter === 'BIDDING_ONLY' ? 'selected' : ''
              }>仅竞价</option>
              <option value="MIXED" ${state.ordersAssignmentModeFilter === 'MIXED' ? 'selected' : ''}>混合模式</option>
            </select>
          </div>

          <div>
            <span class="text-xs text-muted-foreground">竞价风险</span>
            <select data-prod-field="ordersBiddingRiskFilter" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              <option value="ALL" ${state.ordersBiddingRiskFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="OVERDUE" ${state.ordersBiddingRiskFilter === 'OVERDUE' ? 'selected' : ''}>有过期</option>
              <option value="NEAR_DEADLINE" ${
                state.ordersBiddingRiskFilter === 'NEAR_DEADLINE' ? 'selected' : ''
              }>临近截止(&lt;24h)</option>
              <option value="NONE" ${state.ordersBiddingRiskFilter === 'NONE' ? 'selected' : ''}>无竞价</option>
            </select>
          </div>

          <div>
            <span class="text-xs text-muted-foreground">主工厂层级</span>
            <select data-prod-field="ordersTierFilter" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              <option value="ALL" ${state.ordersTierFilter === 'ALL' ? 'selected' : ''}>全部</option>
              ${(Object.keys(tierLabels) as FactoryTier[])
                .map(
                  (tier) =>
                    `<option value="${tier}" ${
                      state.ordersTierFilter === tier ? 'selected' : ''
                    }>${escapeHtml(tierLabels[tier])}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div>
            <span class="text-xs text-muted-foreground">是否创建领料草稿</span>
            <select data-prod-field="ordersHasMaterialDraftFilter" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              <option value="ALL" ${state.ordersHasMaterialDraftFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="YES" ${state.ordersHasMaterialDraftFilter === 'YES' ? 'selected' : ''}>是</option>
              <option value="NO" ${state.ordersHasMaterialDraftFilter === 'NO' ? 'selected' : ''}>否</option>
            </select>
          </div>

          <div>
            <span class="text-xs text-muted-foreground">是否确认领料</span>
            <select data-prod-field="ordersHasConfirmedMaterialRequestFilter" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              <option value="ALL" ${state.ordersHasConfirmedMaterialRequestFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="YES" ${state.ordersHasConfirmedMaterialRequestFilter === 'YES' ? 'selected' : ''}>是</option>
              <option value="NO" ${state.ordersHasConfirmedMaterialRequestFilter === 'NO' ? 'selected' : ''}>否</option>
            </select>
          </div>

          <div class="flex items-end gap-2">
            <button class="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90" data-prod-action="query-orders">查询</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="reset-orders-filters">重置</button>
          </div>
        </div>
      </section>

      <section class="rounded-lg border bg-card px-4 py-3">
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span class="text-muted-foreground">领料待处理提示：</span>
          <button
            class="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
            data-prod-action="apply-material-reminder-filter"
            data-target="no_draft"
          >
            未建领料草稿：${materialReminderStats.noDraft} 单
          </button>
          <button
            class="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-100"
            data-prod-action="apply-material-reminder-filter"
            data-target="pending"
          >
            待确认领料草稿：${materialReminderStats.pendingOnly} 单
          </button>
          <button
            class="inline-flex items-center rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs text-green-700 hover:bg-green-100"
            data-prod-action="apply-material-reminder-filter"
            data-target="confirmed"
          >
            已确认领料：${materialReminderStats.confirmed} 单
          </button>
        </div>
      </section>

      <div class="rounded-lg border">
        <div class="overflow-x-auto overflow-y-visible">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-muted/50">
                <th class="w-10 px-3 py-3 text-left">
                  <input type="checkbox" data-prod-action="toggle-orders-select-all" ${
                    selectedAll ? 'checked' : ''
                  } />
                </th>
                <th class="min-w-[140px] px-3 py-3 text-left font-medium">生产单号</th>
                <th class="min-w-[80px] px-3 py-3 text-left font-medium">旧单号</th>
                <th class="min-w-[180px] px-3 py-3 text-left font-medium">SPU</th>
                <th class="min-w-[100px] px-3 py-3 text-left font-medium">状态</th>
                <th class="min-w-[100px] px-3 py-3 text-left font-medium">技术包</th>
                <th class="min-w-[120px] px-3 py-3 text-left font-medium">拆解状态</th>
                <th class="min-w-[100px] px-3 py-3 text-left font-medium">分配概览</th>
                <th class="min-w-[90px] px-3 py-3 text-left font-medium">分配进度</th>
                <th class="min-w-[130px] px-3 py-3 text-left font-medium">竞价情况</th>
                <th class="min-w-[130px] px-3 py-3 text-left font-medium">派单情况</th>
                <th class="min-w-[170px] px-3 py-3 text-left font-medium">领料情况</th>
                <th class="min-w-[180px] px-3 py-3 text-left font-medium">主工厂</th>
                <th class="min-w-[150px] px-3 py-3 text-left font-medium">风险</th>
                <th class="min-w-[100px] px-3 py-3 text-left font-medium">最近更新</th>
                <th class="sticky right-0 z-20 min-w-[160px] bg-muted/50 px-3 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${
                pagedOrders.length === 0
                  ? renderEmptyRow(16, '暂无数据')
                  : pagedOrders
                    .map((order) => {
                        const runtime = getOrderRuntimeAssignmentSnapshot(order)
                        const techPack = getOrderTechPackInfo(order)
                        const breakdown = getOrderTaskBreakdownSnapshot(order)
                        const mergedLogs = getOrderMergedAuditLogs(order)
                        const lastLog = mergedLogs[mergedLogs.length - 1]

                        return `
                          <tr class="cursor-pointer border-b last:border-0 hover:bg-muted/30" data-prod-action="open-order-detail" data-order-id="${order.productionOrderId}">
                            <td class="px-3 py-3" data-prod-action="noop">
                              <input type="checkbox" data-prod-action="toggle-orders-select" data-order-id="${
                                order.productionOrderId
                              }" ${state.ordersSelectedIds.has(order.productionOrderId) ? 'checked' : ''} />
                            </td>
                            <td class="px-3 py-3">
                              <button class="h-auto p-0 font-mono text-sm text-blue-600 hover:underline" data-prod-action="open-order-detail" data-order-id="${
                                order.productionOrderId
                              }">${escapeHtml(order.productionOrderId)}</button>
                            </td>
                            <td class="px-3 py-3 font-mono text-sm text-muted-foreground">${escapeHtml(order.legacyOrderNo)}</td>
                            <td class="px-3 py-3">
                              <div class="text-sm">
                                <div class="font-mono">${escapeHtml(order.demandSnapshot.spuCode)}</div>
                                <div class="max-w-[150px] truncate text-xs text-muted-foreground" title="${escapeHtml(order.demandSnapshot.spuName)}">
                                  ${escapeHtml(order.demandSnapshot.spuName)}
                                </div>
                              </div>
                            </td>
                            <td class="px-3 py-3">
                              ${renderBadge(
                                productionOrderStatusConfig[order.status]?.label ?? order.status,
                                productionOrderStatusConfig[order.status]?.color ?? 'bg-slate-100 text-slate-700',
                              )}
                            </td>
                            <td class="px-3 py-3">
                              <div class="space-y-1">
                                ${renderBadge(
                                  demandTechPackStatusConfig[techPack.currentStatus].label,
                                  demandTechPackStatusConfig[techPack.currentStatus].className,
                                )}
                                <div class="text-xs text-muted-foreground">${escapeHtml(techPack.currentVersion)}</div>
                              </div>
                            </td>
                            <td class="px-3 py-3">
                              <div class="text-sm">
                                ${
                                  breakdown.isBrokenDown
                                    ? `
                                      ${renderBadge('已拆解', 'bg-green-50 text-green-700')}
                                      <div class="mt-0.5 text-xs text-muted-foreground">
                                        ${escapeHtml(safeText(breakdown.lastBreakdownAt.split(' ')[0]))}
                                      </div>
                                    `
                                    : renderBadge('未拆解', 'bg-gray-50 text-gray-700')
                                }
                              </div>
                            </td>
                            <td class="px-3 py-3">${renderOrderAssignmentOverview(order)}</td>
                            <td class="px-3 py-3">
                              ${renderBadge(
                                assignmentProgressStatusConfig[runtime.assignmentProgress.status]?.label ?? runtime.assignmentProgress.status,
                                assignmentProgressStatusConfig[runtime.assignmentProgress.status]?.color ?? 'bg-slate-100 text-slate-700',
                              )}
                            </td>
                            <td class="px-3 py-3">
                              ${
                                runtime.biddingSummary.activeTenderCount > 0 || runtime.biddingSummary.overdueTenderCount > 0
                                  ? `
                                    <div class="space-y-0.5 text-xs">
                                      <div>活跃: ${runtime.biddingSummary.activeTenderCount}</div>
                                      ${
                                        runtime.biddingSummary.nearestDeadline
                                          ? `
                                            <div class="flex items-center gap-1 text-yellow-600">
                                              <i data-lucide="clock" class="h-3 w-3"></i>
                                              ${escapeHtml(runtime.biddingSummary.nearestDeadline.split(' ')[0])}
                                            </div>
                                          `
                                          : ''
                                      }
                                      ${
                                        runtime.biddingSummary.overdueTenderCount > 0
                                          ? `<div class="text-red-600">过期: ${runtime.biddingSummary.overdueTenderCount}</div>`
                                          : ''
                                      }
                                    </div>
                                  `
                                  : '<span class="text-muted-foreground">-</span>'
                              }
                            </td>
                            <td class="px-3 py-3">
                              ${
                                runtime.directDispatchSummary.assignedFactoryCount > 0 ||
                                runtime.directDispatchSummary.rejectedCount > 0 ||
                                runtime.directDispatchSummary.overdueAckCount > 0
                                  ? `
                                    <div class="space-y-0.5 text-xs">
                                      <div>已分配: ${runtime.directDispatchSummary.assignedFactoryCount}</div>
                                      ${
                                        runtime.directDispatchSummary.rejectedCount > 0
                                          ? `<div class="text-orange-600">拒单: ${runtime.directDispatchSummary.rejectedCount}</div>`
                                          : ''
                                      }
                                      ${
                                        runtime.directDispatchSummary.overdueAckCount > 0
                                          ? `<div class="text-red-600">超时: ${runtime.directDispatchSummary.overdueAckCount}</div>`
                                          : ''
                                      }
                                    </div>
                                  `
                                  : '<span class="text-muted-foreground">-</span>'
                              }
                            </td>
                            <td class="px-3 py-3">
                              ${renderOrderMaterialSummary(order)}
                            </td>
                            <td class="px-3 py-3">
                              <div class="text-sm">
                                <div class="max-w-[150px] truncate font-medium" title="${escapeHtml(order.mainFactorySnapshot.name)}">
                                  ${escapeHtml(order.mainFactorySnapshot.name)}
                                </div>
                                <div class="mt-0.5 flex items-center gap-1">
                                  ${renderBadge(tierLabels[order.mainFactorySnapshot.tier as FactoryTier] ?? order.mainFactorySnapshot.tier, 'bg-slate-100 text-slate-700')}
                                  ${renderBadge(typeLabels[order.mainFactorySnapshot.type as FactoryType] ?? order.mainFactorySnapshot.type, 'bg-slate-100 text-slate-700')}
                                </div>
                              </div>
                            </td>
                            <td class="px-3 py-3">${renderOrderRiskFlags(order.riskFlags)}</td>
                            <td class="px-3 py-3 text-sm text-muted-foreground">
                              ${escapeHtml(safeText(lastLog?.at.split(' ')[0] ?? order.updatedAt.split(' ')[0]))}
                            </td>
                            <td class="sticky right-0 ${state.ordersActionMenuId === order.productionOrderId ? 'z-40' : 'z-10'} bg-background px-3 py-3" data-prod-action="noop">
                              <div class="flex items-center gap-1">
                                <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-prod-action="open-order-detail" data-order-id="${order.productionOrderId}">
                                  <i data-lucide="eye" class="h-4 w-4"></i>
                                </button>
                                <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-prod-action="open-orders-demand-snapshot" data-order-id="${order.productionOrderId}">
                                  <i data-lucide="file-text" class="h-4 w-4"></i>
                                </button>
                                <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-prod-action="open-orders-logs" data-order-id="${order.productionOrderId}">
                                  <i data-lucide="history" class="h-4 w-4"></i>
                                </button>
                                <div class="relative" data-prod-orders-menu-root="true">
                                  <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-prod-action="toggle-orders-more-menu" data-order-id="${order.productionOrderId}">
                                    <i data-lucide="more-horizontal" class="h-4 w-4"></i>
                                  </button>
                                  ${
                                    state.ordersActionMenuId === order.productionOrderId
                                      ? `
                                        <div class="absolute right-0 z-50 mt-1 min-w-[150px] rounded-md border bg-background p-1 shadow-lg">
                                          <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-prod-action="open-tech-pack" data-spu-code="${escapeHtml(order.demandSnapshot.spuCode)}">
                                            <i data-lucide="file-text" class="mr-2 h-4 w-4"></i>
                                            完善技术包
                                          </button>
                                          <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-prod-action="open-orders-dispatch-center" data-order-id="${order.productionOrderId}">
                                            <i data-lucide="send" class="mr-2 h-4 w-4"></i>
                                            去分配中心
                                          </button>
                                          <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-prod-action="open-orders-dispatch-board" data-order-id="${order.productionOrderId}">
                                            <i data-lucide="layout-grid" class="mr-2 h-4 w-4"></i>
                                            去分配看板
                                          </button>
                                          <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-prod-action="open-material-draft-drawer" data-order-id="${order.productionOrderId}">
                                            <i data-lucide="boxes" class="mr-2 h-4 w-4"></i>
                                            领料需求草稿
                                          </button>
                                        </div>
                                      `
                                      : ''
                                  }
                                </div>
                              </div>
                            </td>
                          </tr>
                        `
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <footer class="flex items-center justify-between text-sm">
        <p class="text-muted-foreground">共 ${filteredOrders.length} 条记录${
          state.ordersSelectedIds.size > 0 ? `，已选 ${state.ordersSelectedIds.size} 项` : ''
        }</p>
        <div class="flex items-center gap-2">
          <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border ${
            state.ordersCurrentPage === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'
          }" data-prod-action="orders-prev-page" aria-label="上一页">
            <i data-lucide="chevron-left" class="h-4 w-4"></i>
          </button>
          <span>${state.ordersCurrentPage} / ${totalPages || 1}</span>
          <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border ${
            state.ordersCurrentPage >= totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'
          }" data-prod-action="orders-next-page" aria-label="下一页">
            <i data-lucide="chevron-right" class="h-4 w-4"></i>
          </button>
        </div>
      </footer>

      ${renderMaterialDraftDrawer()}
      ${renderOrderDemandSnapshotDrawer()}
      ${renderOrderLogsDialog()}
    </div>
  `
}
function getPlanDownstreamMap(): Map<
  string,
  {
    taskCount: number
    keyProcessCount: number
    hasDyePrint: boolean
    readyStatus: '未准备' | '部分准备' | '已准备'
  }
> {
  const legacyLikeDyePrintOrders = getLegacyLikeDyePrintOrders()
  const map = new Map<
    string,
    {
      taskCount: number
      keyProcessCount: number
      hasDyePrint: boolean
      readyStatus: '未准备' | '部分准备' | '已准备'
    }
  >()

  for (const order of state.orders) {
    const tasks = listRuntimeTasksByOrder(order.productionOrderId)
    const dyes = legacyLikeDyePrintOrders.filter((dye) => dye.productionOrderId === order.productionOrderId)

    const taskCount = tasks.length
    const keyProcessCount = tasks.filter((task) =>
      keyProcessKeywords.some((keyword) => task.processNameZh.includes(keyword)),
    ).length
    const hasDyePrint = dyes.length > 0

    let readyStatus: '未准备' | '部分准备' | '已准备' = '未准备'
    if (taskCount === 0) {
      readyStatus = '未准备'
    } else if (!hasDyePrint) {
      readyStatus = '已准备'
    } else if (dyes.some((dye) => dye.availableQty > 0)) {
      readyStatus = '已准备'
    } else {
      readyStatus = '部分准备'
    }

    map.set(order.productionOrderId, {
      taskCount,
      keyProcessCount,
      hasDyePrint,
      readyStatus,
    })
  }

  return map
}

function renderPlanEditDialog(): string {
  if (!getOrderById(state.planEditOrderId)) return ''

  const factoryOptions = getPlanFactoryOptions()

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-plan-edit" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">编辑生产单计划</h3>
        </header>

        <div class="space-y-4 px-6 py-5">
          <label class="space-y-1">
            <span class="text-sm">计划开始日期 <span class="text-destructive">*</span></span>
            <input type="date" data-prod-field="planFormStartDate" value="${escapeHtml(
              state.planForm.planStartDate,
            )}" class="w-full rounded-md border px-3 py-2 text-sm" />
          </label>

          <label class="space-y-1">
            <span class="text-sm">计划结束日期 <span class="text-destructive">*</span></span>
            <input type="date" data-prod-field="planFormEndDate" value="${escapeHtml(
              state.planForm.planEndDate,
            )}" class="w-full rounded-md border px-3 py-2 text-sm" />
          </label>

          <label class="space-y-1">
            <span class="text-sm">计划数量 <span class="text-destructive">*</span></span>
            <input type="number" min="1" data-prod-field="planFormQty" value="${escapeHtml(
              state.planForm.planQty,
            )}" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="请输入计划数量" />
          </label>

          <label class="space-y-1">
            <span class="text-sm">计划工厂 <span class="text-destructive">*</span></span>
            <select data-prod-field="planFormFactoryId" class="w-full rounded-md border px-3 py-2 text-sm">
              <option value="" ${state.planForm.planFactoryId ? '' : 'selected'}>请选择计划工厂</option>
              ${factoryOptions
                .map(
                  (factory) =>
                    `<option value="${factory.id}" ${
                      state.planForm.planFactoryId === factory.id ? 'selected' : ''
                    }>${escapeHtml(factory.name)}</option>`,
                )
                .join('')}
            </select>
          </label>

          <label class="space-y-1">
            <span class="text-sm">备注</span>
            <input data-prod-field="planFormRemark" value="${escapeHtml(
              state.planForm.planRemark,
            )}" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="可选备注" />
          </label>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-plan-edit">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="save-plan-edit">保存</button>
        </footer>
      </div>
    </div>
  `
}

export function renderProductionPlanPage(): string {
  const downstreamMap = getPlanDownstreamMap()
  const { weekStart, weekEnd } = getPlanWeekRange()

  const filteredOrders = state.orders.filter((order) => {
    const keyword = state.planKeyword.trim().toLowerCase()
    if (keyword) {
      const matched =
        includesKeyword(order.productionOrderId.toLowerCase(), keyword) ||
        includesKeyword(order.demandSnapshot.spuCode.toLowerCase(), keyword) ||
        includesKeyword(order.mainFactorySnapshot.name.toLowerCase(), keyword) ||
        includesKeyword((order.planFactoryName ?? '').toLowerCase(), keyword)
      if (!matched) return false
    }

    const planStatus = order.planStatus ?? 'UNPLANNED'
    if (state.planStatusFilter !== 'ALL' && planStatus !== state.planStatusFilter) {
      return false
    }

    if (state.planFactoryFilter !== 'ALL' && order.planFactoryId !== state.planFactoryFilter) {
      return false
    }

    return true
  })

  const stats = {
    unplanned: state.orders.filter((order) => (order.planStatus ?? 'UNPLANNED') === 'UNPLANNED').length,
    planned: state.orders.filter((order) => (order.planStatus ?? 'UNPLANNED') === 'PLANNED').length,
    released: state.orders.filter((order) => (order.planStatus ?? 'UNPLANNED') === 'RELEASED').length,
    weekQty: filteredOrders
      .filter((order) => order.planStartDate && order.planStartDate >= weekStart && order.planStartDate <= weekEnd)
      .reduce((sum, order) => sum + (order.planQty ?? 0), 0),
    decomposed: state.orders.filter((order) => (downstreamMap.get(order.productionOrderId)?.taskCount ?? 0) > 0)
      .length,
    withDyePrint: state.orders.filter((order) => downstreamMap.get(order.productionOrderId)?.hasDyePrint).length,
    ready: state.orders.filter((order) => downstreamMap.get(order.productionOrderId)?.readyStatus === '已准备').length,
    partialReady: state.orders.filter(
      (order) => downstreamMap.get(order.productionOrderId)?.readyStatus === '部分准备',
    ).length,
  }

  const planFactoryOptions = getPlanFactoryOptions()

  return `
    <div class="flex flex-col gap-6">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">生产单计划</h1>
          <p class="mt-1 text-sm text-muted-foreground">共 ${state.orders.length} 条</p>
        </div>
      </header>

      <div class="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">生产单计划用于明确计划时间、数量与计划工厂；本页同步展示任务拆解、染印需求与下一步准备情况</div>

      <section class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">未计划数</p>
            <p class="text-2xl font-bold">${stats.unplanned}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">已计划数</p>
            <p class="text-2xl font-bold">${stats.planned}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">计划已下发数</p>
            <p class="text-2xl font-bold">${stats.released}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">本周计划数量合计</p>
            <p class="text-2xl font-bold">${stats.weekQty.toLocaleString()}</p>
          </div>
        </article>
      </section>

      <section class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">已拆解生产单数</p>
            <p class="text-2xl font-bold">${stats.decomposed}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">涉及染印生产单数</p>
            <p class="text-2xl font-bold">${stats.withDyePrint}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">已准备生产单数</p>
            <p class="text-2xl font-bold">${stats.ready}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">部分准备生产单数</p>
            <p class="text-2xl font-bold">${stats.partialReady}</p>
          </div>
        </article>
      </section>

      <section class="flex flex-wrap gap-3">
        <input data-prod-field="planKeyword" value="${escapeHtml(
          state.planKeyword,
        )}" class="w-60 rounded-md border px-3 py-2 text-sm" placeholder="关键词（生产单号 / 款号 / 工厂）" />

        <select data-prod-field="planStatusFilter" class="w-40 rounded-md border px-3 py-2 text-sm">
          <option value="ALL" ${state.planStatusFilter === 'ALL' ? 'selected' : ''}>全部状态</option>
          <option value="UNPLANNED" ${state.planStatusFilter === 'UNPLANNED' ? 'selected' : ''}>未计划</option>
          <option value="PLANNED" ${state.planStatusFilter === 'PLANNED' ? 'selected' : ''}>已计划</option>
          <option value="RELEASED" ${state.planStatusFilter === 'RELEASED' ? 'selected' : ''}>计划已下发</option>
        </select>

        <select data-prod-field="planFactoryFilter" class="w-48 rounded-md border px-3 py-2 text-sm">
          <option value="ALL" ${state.planFactoryFilter === 'ALL' ? 'selected' : ''}>全部工厂</option>
          ${planFactoryOptions
            .map(
              (factory) =>
                `<option value="${factory.id}" ${
                  state.planFactoryFilter === factory.id ? 'selected' : ''
                }>${escapeHtml(factory.name)}</option>`,
            )
            .join('')}
        </select>
      </section>

      <section class="overflow-hidden rounded-lg border bg-card">
        ${
          filteredOrders.length === 0
            ? `<div class="flex items-center justify-center py-16 text-sm text-muted-foreground">暂无生产单计划数据</div>`
            : `
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="border-b">
                    <tr>
                      <th class="px-3 py-3 text-left font-medium">生产单号</th>
                      <th class="px-3 py-3 text-left font-medium">商品/款号</th>
                      <th class="px-3 py-3 text-left font-medium">主工厂</th>
                      <th class="px-3 py-3 text-left font-medium">计划工厂</th>
                      <th class="px-3 py-3 text-left font-medium">计划数量</th>
                      <th class="px-3 py-3 text-left font-medium">计划开始</th>
                      <th class="px-3 py-3 text-left font-medium">计划结束</th>
                      <th class="px-3 py-3 text-left font-medium">计划状态</th>
                      <th class="px-3 py-3 text-left font-medium">是否已拆解</th>
                      <th class="px-3 py-3 text-left font-medium">关联任务数</th>
                      <th class="px-3 py-3 text-left font-medium">关键工序数</th>
                      <th class="px-3 py-3 text-left font-medium">染印需求</th>
                      <th class="px-3 py-3 text-left font-medium">下一步准备状态</th>
                      <th class="px-3 py-3 text-left font-medium">更新时间</th>
                      <th class="px-3 py-3 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredOrders
                      .map((order) => {
                        const planStatus = order.planStatus ?? 'UNPLANNED'
                        const downstream = downstreamMap.get(order.productionOrderId)
                        const isBrokenDown = (downstream?.taskCount ?? 0) > 0

                        const planStatusView: Record<'UNPLANNED' | 'PLANNED' | 'RELEASED', string> = {
                          UNPLANNED: 'bg-slate-100 text-slate-700',
                          PLANNED: 'bg-blue-100 text-blue-700',
                          RELEASED: 'bg-white text-slate-700',
                        }

                        const readyClass: Record<'未准备' | '部分准备' | '已准备', string> = {
                          未准备: 'bg-slate-100 text-slate-700',
                          部分准备: 'bg-white text-slate-700',
                          已准备: 'bg-blue-100 text-blue-700',
                        }

                        return `
                          <tr class="border-b last:border-0">
                            <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.productionOrderId)}</td>
                            <td class="px-3 py-3">${escapeHtml(order.demandSnapshot.spuCode)}</td>
                            <td class="px-3 py-3">${escapeHtml(order.mainFactorySnapshot.name)}</td>
                            <td class="px-3 py-3">${escapeHtml(order.planFactoryName ?? '—')}</td>
                            <td class="px-3 py-3">${order.planQty != null ? order.planQty.toLocaleString() : '—'}</td>
                            <td class="px-3 py-3">${escapeHtml(order.planStartDate ?? '—')}</td>
                            <td class="px-3 py-3">${escapeHtml(order.planEndDate ?? '—')}</td>
                            <td class="px-3 py-3">${renderBadge(
                              planStatus === 'UNPLANNED' ? '未计划' : planStatus === 'PLANNED' ? '已计划' : '计划已下发',
                              planStatusView[planStatus],
                            )}</td>
                            <td class="px-3 py-3">${renderBadge(
                              isBrokenDown ? '已拆解' : '未拆解',
                              isBrokenDown ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700',
                            )}</td>
                            <td class="px-3 py-3 text-center">${downstream?.taskCount ?? 0}</td>
                            <td class="px-3 py-3 text-center">${downstream?.keyProcessCount ?? 0}</td>
                            <td class="px-3 py-3">${renderBadge(
                              downstream?.hasDyePrint ? '有' : '无',
                              downstream?.hasDyePrint ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700',
                            )}</td>
                            <td class="px-3 py-3">${renderBadge(
                              downstream?.readyStatus ?? '未准备',
                              readyClass[downstream?.readyStatus ?? '未准备'],
                            )}</td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(order.planUpdatedAt ?? '—')}</td>
                            <td class="px-3 py-3">
                              <div class="flex flex-wrap gap-1">
                                <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-prod-action="open-plan-edit" data-order-id="${
                                  order.productionOrderId
                                }">编辑计划</button>
                                ${
                                  planStatus !== 'RELEASED'
                                    ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-prod-action="release-plan" data-order-id="${
                                        order.productionOrderId
                                      }">下发计划</button>`
                                    : ''
                                }
                                <button class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted" data-prod-action="open-order-detail" data-order-id="${
                                  order.productionOrderId
                                }">查看生产单</button>
                              </div>
                            </td>
                          </tr>
                        `
                      })
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
        }
      </section>

      ${renderPlanEditDialog()}
    </div>
  `
}

function getDeliverySummaryMap(): Map<
  string,
  {
    planStatus: string
    lifecycleStatus: string
    taskSummary: string
    deliverableStatus: '未配置交付仓' | '未准备' | '待质检' | '部分可交付' | '可交付'
    deliverableQty: number
  }
> {
  const legacyLikeQualityInspections = getLegacyLikeQualityInspections()
  const map = new Map<
    string,
    {
      planStatus: string
      lifecycleStatus: string
      taskSummary: string
      deliverableStatus: '未配置交付仓' | '未准备' | '待质检' | '部分可交付' | '可交付'
      deliverableQty: number
    }
  >()

  for (const order of state.orders) {
    const orderId = order.productionOrderId
    const tasks = listRuntimeTasksByOrder(order.productionOrderId)

    const doneCount = tasks.filter((task) => task.status === 'DONE').length
    const taskSummary = tasks.length === 0 ? '未拆解' : `已完成 ${doneCount}/${tasks.length}`

    let deliverableStatus: '未配置交付仓' | '未准备' | '待质检' | '部分可交付' | '可交付' =
      '未配置交付仓'

    if (order.deliveryWarehouseStatus === 'SET') {
      if (tasks.length === 0) {
        deliverableStatus = '未准备'
      } else {
        const openQcCount = legacyLikeQualityInspections.filter(
          (inspection) =>
            inspection.productionOrderId === orderId && inspection.status !== 'CLOSED',
        ).length

        if (openQcCount > 0) {
          deliverableStatus = '待质检'
        } else if (tasks.every((task) => task.status === 'DONE')) {
          deliverableStatus = '可交付'
        } else {
          deliverableStatus = '部分可交付'
        }
      }
    }

    const deliverableQty = tasks.reduce((sum, task) => {
      return sum + (initialAllocationByTaskId[task.taskId]?.availableQty ?? 0)
    }, 0)

    const lifecycle = order.lifecycleStatus ?? 'DRAFT'

    map.set(order.productionOrderId, {
      planStatus:
        order.planStatus === 'RELEASED'
          ? '计划已下发'
          : order.planStatus === 'PLANNED'
            ? '已计划'
            : '未计划',
      lifecycleStatus: lifecycleStatusLabel[lifecycle],
      taskSummary,
      deliverableStatus,
      deliverableQty,
    })
  }

  return map
}

function renderDeliveryEditDialog(): string {
  if (!getOrderById(state.deliveryEditOrderId)) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-delivery-edit" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">配置交付仓</h3>
        </header>

        <div class="space-y-4 px-6 py-5">
          <label class="space-y-1">
            <span class="text-sm">生产单号</span>
            <input value="${escapeHtml(
              state.deliveryForm.productionOrderId,
            )}" disabled class="w-full rounded-md border px-3 py-2 font-mono text-sm" />
          </label>

          <label class="space-y-1">
            <span class="text-sm">交付仓ID <span class="text-destructive">*</span></span>
            <input data-prod-field="deliveryFormWarehouseId" value="${escapeHtml(
              state.deliveryForm.deliveryWarehouseId,
            )}" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="请输入交付仓ID" />
          </label>

          <label class="space-y-1">
            <span class="text-sm">交付仓名称</span>
            <input data-prod-field="deliveryFormWarehouseName" value="${escapeHtml(
              state.deliveryForm.deliveryWarehouseName,
            )}" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="可选，留空则以仓库ID显示" />
          </label>

          <label class="space-y-1">
            <span class="text-sm">配置说明</span>
            <textarea data-prod-field="deliveryFormWarehouseRemark" rows="3" class="min-h-[80px] w-full rounded-md border px-3 py-2 text-sm" placeholder="可选备注">${escapeHtml(
              state.deliveryForm.deliveryWarehouseRemark,
            )}</textarea>
          </label>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-delivery-edit">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="save-delivery-edit">保存</button>
        </footer>
      </div>
    </div>
  `
}

export function renderProductionDeliveryWarehousePage(): string {
  const summaryMap = getDeliverySummaryMap()

  const rows = state.orders.filter((order) => {
    if (state.deliveryStatusFilter !== 'ALL') {
      const status = order.deliveryWarehouseStatus ?? 'UNSET'
      if (status !== state.deliveryStatusFilter) return false
    }

    const keyword = state.deliveryKeyword.trim().toLowerCase()
    if (!keyword) return true

    const styleCode =
      (order as unknown as { styleCode?: string }).styleCode ?? order.demandSnapshot.spuCode

    return (
      order.productionOrderId.toLowerCase().includes(keyword) ||
      styleCode.toLowerCase().includes(keyword) ||
      (order.deliveryWarehouseName ?? '').toLowerCase().includes(keyword) ||
      (order.deliveryWarehouseId ?? '').toLowerCase().includes(keyword)
    )
  })

  const today = new Date().toISOString().slice(0, 10)
  const stats = {
    unset: state.orders.filter(
      (order) => !order.deliveryWarehouseStatus || order.deliveryWarehouseStatus === 'UNSET',
    ).length,
    set: state.orders.filter((order) => order.deliveryWarehouseStatus === 'SET').length,
    updatedToday: state.orders.filter((order) => order.deliveryWarehouseUpdatedAt?.slice(0, 10) === today)
      .length,
    planned: state.orders.filter((order) => (order.planStatus ?? 'UNPLANNED') !== 'UNPLANNED').length,
    deliverable: state.orders.filter(
      (order) => summaryMap.get(order.productionOrderId)?.deliverableStatus === '可交付',
    ).length,
    deliverableQtyTotal: state.orders.reduce(
      (sum, order) => sum + (summaryMap.get(order.productionOrderId)?.deliverableQty ?? 0),
      0,
    ),
  }

  const statusClass: Record<'UNSET' | 'SET', string> = {
    UNSET: 'bg-slate-100 text-slate-700',
    SET: 'bg-blue-100 text-blue-700',
  }

  const deliverableClass: Record<'未配置交付仓' | '未准备' | '待质检' | '部分可交付' | '可交付', string> = {
    未配置交付仓: 'bg-slate-100 text-slate-700',
    未准备: 'bg-slate-100 text-slate-700',
    待质检: 'bg-white text-slate-700',
    部分可交付: 'bg-white text-slate-700',
    可交付: 'bg-blue-100 text-blue-700',
  }

  const planClass: Record<'未计划' | '已计划' | '计划已下发', string> = {
    未计划: 'bg-slate-100 text-slate-700',
    已计划: 'bg-white text-slate-700',
    计划已下发: 'bg-blue-100 text-blue-700',
  }

  const lifecycleClass: Record<string, string> = {
    草稿: 'bg-slate-100 text-slate-700',
    已计划: 'bg-slate-100 text-slate-700',
    已下发: 'bg-white text-slate-700',
    生产中: 'bg-blue-100 text-blue-700',
    待质检: 'bg-white text-slate-700',
    已完成: 'bg-blue-100 text-blue-700',
    已关闭: 'bg-slate-100 text-slate-700',
  }

  return `
    <div class="flex flex-col gap-6">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">交付仓配置</h1>
          <p class="mt-1 text-sm text-muted-foreground">共 ${state.orders.length} 条</p>
        </div>
      </header>

      <div class="rounded-md border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">交付仓配置用于明确生产单成品交付去向；本页同步展示计划状态、任务完成度与交付承接情况</div>

      <section class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">未配置数</p>
            <p class="text-3xl font-bold">${stats.unset}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">已配置数</p>
            <p class="text-3xl font-bold">${stats.set}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">今日更新数</p>
            <p class="text-3xl font-bold">${stats.updatedToday}</p>
          </div>
        </article>
      </section>

      <section class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">已计划数</p>
            <p class="text-3xl font-bold">${stats.planned}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">已配置交付仓数</p>
            <p class="text-3xl font-bold">${stats.set}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">可交付生产单数</p>
            <p class="text-3xl font-bold">${stats.deliverable}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">可交付数量合计</p>
            <p class="text-3xl font-bold">${stats.deliverableQtyTotal.toLocaleString()}</p>
          </div>
        </article>
      </section>

      <section class="flex flex-wrap items-center gap-3">
        <input data-prod-field="deliveryKeyword" value="${escapeHtml(
          state.deliveryKeyword,
        )}" class="w-72 rounded-md border px-3 py-2 text-sm" placeholder="关键词（生产单号 / 款号 / 仓库名称）" />

        <select data-prod-field="deliveryStatusFilter" class="w-36 rounded-md border px-3 py-2 text-sm">
          <option value="ALL" ${state.deliveryStatusFilter === 'ALL' ? 'selected' : ''}>全部</option>
          <option value="UNSET" ${state.deliveryStatusFilter === 'UNSET' ? 'selected' : ''}>未配置</option>
          <option value="SET" ${state.deliveryStatusFilter === 'SET' ? 'selected' : ''}>已配置</option>
        </select>
      </section>

      <section class="rounded-lg border bg-card">
        ${
          rows.length === 0
            ? `<div class="flex h-40 items-center justify-center text-sm text-muted-foreground">暂无交付仓配置数据</div>`
            : `
              <div class="overflow-x-auto">
                <table class="w-full min-w-[1450px] text-sm">
                  <thead>
                    <tr class="border-b">
                      <th class="px-3 py-3 text-left font-medium">生产单号</th>
                      <th class="px-3 py-3 text-left font-medium">商品/款号</th>
                      <th class="px-3 py-3 text-left font-medium">主工厂</th>
                      <th class="px-3 py-3 text-left font-medium">交付仓</th>
                      <th class="px-3 py-3 text-left font-medium">配置状态</th>
                      <th class="px-3 py-3 text-left font-medium">计划状态</th>
                      <th class="px-3 py-3 text-left font-medium">生产单状态</th>
                      <th class="px-3 py-3 text-left font-medium">任务完成度</th>
                      <th class="px-3 py-3 text-left font-medium">可交付状态</th>
                      <th class="px-3 py-3 text-right font-medium">可交付数量</th>
                      <th class="px-3 py-3 text-left font-medium">配置说明</th>
                      <th class="px-3 py-3 text-left font-medium">更新时间</th>
                      <th class="px-3 py-3 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows
                      .map((order) => {
                        const styleCode =
                          (order as unknown as { styleCode?: string }).styleCode ?? order.demandSnapshot.spuCode
                        const factoryName =
                          (order as unknown as { factoryName?: string }).factoryName ??
                          (order as unknown as { factoryId?: string }).factoryId ??
                          order.mainFactorySnapshot.name

                        const status = order.deliveryWarehouseStatus ?? 'UNSET'
                        const summary = summaryMap.get(order.productionOrderId)
                        const planStatus = (summary?.planStatus ?? '未计划') as '未计划' | '已计划' | '计划已下发'
                        const lifecycleStatus = summary?.lifecycleStatus ?? '草稿'

                        return `
                          <tr class="border-b last:border-0">
                            <td class="whitespace-nowrap px-3 py-3 font-mono text-sm">${escapeHtml(order.productionOrderId)}</td>
                            <td class="px-3 py-3 text-sm">${escapeHtml(styleCode ?? '—')}</td>
                            <td class="whitespace-nowrap px-3 py-3 text-sm">${escapeHtml(factoryName ?? '—')}</td>
                            <td class="whitespace-nowrap px-3 py-3 text-sm">
                              ${
                                order.deliveryWarehouseName
                                  ? `${escapeHtml(order.deliveryWarehouseName)}${
                                      order.deliveryWarehouseId ? ` (${escapeHtml(order.deliveryWarehouseId)})` : ''
                                    }`
                                  : order.deliveryWarehouseId
                                    ? escapeHtml(order.deliveryWarehouseId)
                                    : '—'
                              }
                            </td>
                            <td class="px-3 py-3">${renderBadge(status === 'SET' ? '已配置' : '未配置', statusClass[status])}</td>
                            <td class="px-3 py-3">${renderBadge(planStatus, planClass[planStatus])}</td>
                            <td class="px-3 py-3">${renderBadge(
                              lifecycleStatus,
                              lifecycleClass[lifecycleStatus] ?? 'bg-slate-100 text-slate-700',
                            )}</td>
                            <td class="whitespace-nowrap px-3 py-3 text-sm">${escapeHtml(summary?.taskSummary ?? '未拆解')}</td>
                            <td class="px-3 py-3">${renderBadge(
                              summary?.deliverableStatus ?? '未配置交付仓',
                              deliverableClass[summary?.deliverableStatus ?? '未配置交付仓'],
                            )}</td>
                            <td class="px-3 py-3 text-right text-sm">${(summary?.deliverableQty ?? 0).toLocaleString()}</td>
                            <td class="max-w-40 truncate px-3 py-3 text-sm text-muted-foreground" title="${escapeHtml(
                              safeText(order.deliveryWarehouseRemark),
                            )}">${escapeHtml(safeText(order.deliveryWarehouseRemark))}</td>
                            <td class="whitespace-nowrap px-3 py-3 text-sm text-muted-foreground">${escapeHtml(
                              safeText(order.deliveryWarehouseUpdatedAt),
                            )}</td>
                            <td class="px-3 py-3">
                              <div class="flex gap-2 whitespace-nowrap">
                                <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-prod-action="open-delivery-edit" data-order-id="${
                                  order.productionOrderId
                                }">配置交付仓</button>
                                <button class="inline-flex h-8 items-center rounded-md px-3 text-sm hover:bg-muted" data-prod-action="open-order-detail" data-order-id="${
                                  order.productionOrderId
                                }">查看生产单</button>
                                <button class="inline-flex h-8 items-center rounded-md px-3 text-sm hover:bg-muted" data-nav="/fcs/production/plan">查看计划</button>
                              </div>
                            </td>
                          </tr>
                        `
                      })
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
        }
      </section>

      ${renderDeliveryEditDialog()}
    </div>
  `
}
function getChangeSummaryMap(): Map<
  string,
  {
    taskCount: number
    dyePrintCount: number
    openQcCount: number
    basisCount: number
    statementCount: number
    batchCount: number
  }
> {
  const legacyLikeQualityInspections = getLegacyLikeQualityInspections()
  const legacyLikeDyePrintOrders = getLegacyLikeDyePrintOrders()
  const map = new Map<
    string,
    {
      taskCount: number
      dyePrintCount: number
      openQcCount: number
      basisCount: number
      statementCount: number
      batchCount: number
    }
  >()

  for (const change of state.changes) {
    const orderId = change.productionOrderId

    const taskCount = listRuntimeTasksByOrder(orderId).length
    const dyePrintCount = legacyLikeDyePrintOrders.filter((dye) => dye.productionOrderId === orderId).length
    const openQcCount = legacyLikeQualityInspections.filter(
      (inspection) => inspection.productionOrderId === orderId && inspection.status !== 'CLOSED',
    ).length
    const basisCount = initialDeductionBasisItems.filter(
      (basis) => basis.productionOrderId === orderId || basis.sourceOrderId === orderId,
    ).length

    const relatedStatements = initialStatementDrafts.filter((statement) => {
      return statement.items.some(
        (item) => item.productionOrderId === orderId || item.sourceOrderId === orderId,
      )
    })

    const statementCount = relatedStatements.length
    const statementIds = new Set(relatedStatements.map((statement) => statement.statementId))

    const batchCount = initialSettlementBatches.filter((batch) =>
      batch.statementIds.some((statementId) => statementIds.has(statementId)),
    ).length

    map.set(change.changeId, {
      taskCount,
      dyePrintCount,
      openQcCount,
      basisCount,
      statementCount,
      batchCount,
    })
  }

  return map
}

function renderChangeCreateDialog(): string {
  if (!state.changesCreateOpen) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-changes-create" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">新建生产单变更</h3>
        </header>

        <div class="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          <label class="space-y-1">
            <span class="text-sm">生产单 <span class="text-destructive">*</span></span>
            <select data-prod-field="changesCreateProductionOrderId" class="w-full rounded-md border px-3 py-2 text-sm">
              <option value="" ${state.changesCreateForm.productionOrderId ? '' : 'selected'}>请选择生产单</option>
              ${state.orders
                .map((order) => {
                  const styleNo = (order as unknown as { styleNo?: string }).styleNo
                  return `<option value="${order.productionOrderId}" ${
                    state.changesCreateForm.productionOrderId === order.productionOrderId
                      ? 'selected'
                      : ''
                  }>${escapeHtml(order.productionOrderId)}${
                    styleNo ? ` · ${escapeHtml(styleNo)}` : ''
                  }</option>`
                })
                .join('')}
            </select>
            ${
              state.changesCreateErrors.productionOrderId
                ? `<p class="text-xs text-red-600">${escapeHtml(state.changesCreateErrors.productionOrderId)}</p>`
                : ''
            }
          </label>

          <label class="space-y-1">
            <span class="text-sm">变更类型 <span class="text-destructive">*</span></span>
            <select data-prod-field="changesCreateType" class="w-full rounded-md border px-3 py-2 text-sm">
              <option value="" ${state.changesCreateForm.changeType ? '' : 'selected'}>请选择变更类型</option>
              ${(Object.keys(changeTypeLabels) as ProductionChangeType[])
                .map(
                  (type) =>
                    `<option value="${type}" ${
                      state.changesCreateForm.changeType === type ? 'selected' : ''
                    }>${escapeHtml(changeTypeLabels[type])}</option>`,
                )
                .join('')}
            </select>
            ${
              state.changesCreateErrors.changeType
                ? `<p class="text-xs text-red-600">${escapeHtml(state.changesCreateErrors.changeType)}</p>`
                : ''
            }
          </label>

          <div class="grid grid-cols-2 gap-3">
            <label class="space-y-1">
              <span class="text-sm">变更前</span>
              <input data-prod-field="changesCreateBeforeValue" value="${escapeHtml(
                state.changesCreateForm.beforeValue,
              )}" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="可选" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">变更后</span>
              <input data-prod-field="changesCreateAfterValue" value="${escapeHtml(
                state.changesCreateForm.afterValue,
              )}" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="可选" />
            </label>
          </div>

          <label class="space-y-1">
            <span class="text-sm">影响范围</span>
            <input data-prod-field="changesCreateImpactScope" value="${escapeHtml(
              state.changesCreateForm.impactScopeZh,
            )}" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="可选，如：生产排程、结算对象" />
          </label>

          <label class="space-y-1">
            <span class="text-sm">变更原因 <span class="text-destructive">*</span></span>
            <textarea data-prod-field="changesCreateReason" class="min-h-[72px] w-full rounded-md border px-3 py-2 text-sm" placeholder="请填写变更原因">${escapeHtml(
              state.changesCreateForm.reason,
            )}</textarea>
            ${
              state.changesCreateErrors.reason
                ? `<p class="text-xs text-red-600">${escapeHtml(state.changesCreateErrors.reason)}</p>`
                : ''
            }
          </label>

          <label class="space-y-1">
            <span class="text-sm">备注</span>
            <textarea data-prod-field="changesCreateRemark" class="min-h-[72px] w-full rounded-md border px-3 py-2 text-sm" placeholder="可选">${escapeHtml(
              state.changesCreateForm.remark,
            )}</textarea>
          </label>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-changes-create">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="save-changes-create">保存草稿</button>
        </footer>
      </div>
    </div>
  `
}

function renderChangeStatusDialog(): string {
  if (!state.changesStatusOpen || !state.changesStatusTarget) return ''

  const currentStatus = state.changesStatusTarget.currentStatus

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-changes-status" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">变更状态</h3>
        </header>

        <div class="space-y-4 px-6 py-5">
          <label class="space-y-1">
            <span class="text-sm">当前状态</span>
            <div class="rounded-md border bg-muted/40 px-3 py-2 text-sm">${escapeHtml(
              changeStatusLabels[currentStatus],
            )}</div>
          </label>

          <label class="space-y-1">
            <span class="text-sm">目标状态 <span class="text-destructive">*</span></span>
            <select data-prod-field="changesStatusNext" class="w-full rounded-md border px-3 py-2 text-sm">
              <option value="" ${state.changesStatusForm.nextStatus ? '' : 'selected'}>请选择目标状态</option>
              ${changeAllowedNext[currentStatus]
                .map(
                  (status) =>
                    `<option value="${status}" ${
                      state.changesStatusForm.nextStatus === status ? 'selected' : ''
                    }>${escapeHtml(changeStatusLabels[status])}</option>`,
                )
                .join('')}
            </select>
            ${
              state.changesStatusError
                ? `<p class="text-xs text-red-600">${escapeHtml(state.changesStatusError)}</p>`
                : ''
            }
          </label>

          <label class="space-y-1">
            <span class="text-sm">备注</span>
            <textarea data-prod-field="changesStatusRemark" class="min-h-[70px] w-full rounded-md border px-3 py-2 text-sm" placeholder="可选">${escapeHtml(
              state.changesStatusForm.remark,
            )}</textarea>
          </label>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-changes-status">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="save-changes-status">确认变更</button>
        </footer>
      </div>
    </div>
  `
}

export function renderProductionChangesPage(): string {
  const summaryMap = getChangeSummaryMap()

  const filteredChanges = state.changes.filter((change) => {
    if (state.changesTypeFilter !== 'ALL' && change.changeType !== state.changesTypeFilter) return false
    if (state.changesStatusFilter !== 'ALL' && change.status !== state.changesStatusFilter) return false

    const keyword = state.changesKeyword.trim().toLowerCase()
    if (!keyword) return true

    return [change.changeId, change.productionOrderId, change.reason]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })

  const stats = {
    draft: state.changes.filter((change) => change.status === 'DRAFT').length,
    pending: state.changes.filter((change) => change.status === 'PENDING').length,
    done: state.changes.filter((change) => change.status === 'DONE').length,
    cancelled: state.changes.filter((change) => change.status === 'CANCELLED').length,
    withTask: state.changes.filter((change) => (summaryMap.get(change.changeId)?.taskCount ?? 0) > 0).length,
    withDyePrint: state.changes.filter(
      (change) => (summaryMap.get(change.changeId)?.dyePrintCount ?? 0) > 0,
    ).length,
    withOpenQc: state.changes.filter(
      (change) => (summaryMap.get(change.changeId)?.openQcCount ?? 0) > 0,
    ).length,
    withSettlement: state.changes.filter((change) => {
      const summary = summaryMap.get(change.changeId)
      return (summary?.statementCount ?? 0) > 0 || (summary?.batchCount ?? 0) > 0
    }).length,
  }

  const statusStats: Array<{ label: string; value: number }> = [
    { label: '草稿变更数', value: stats.draft },
    { label: '待处理变更数', value: stats.pending },
    { label: '已完成变更数', value: stats.done },
    { label: '已取消变更数', value: stats.cancelled },
  ]

  const impactStats: Array<{ label: string; value: number }> = [
    { label: '涉及任务变更数', value: stats.withTask },
    { label: '涉及染印变更数', value: stats.withDyePrint },
    { label: '涉及未结案 QC 变更数', value: stats.withOpenQc },
    { label: '涉及结算变更数', value: stats.withSettlement },
  ]

  return `
    <div class="flex flex-col gap-6">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">生产单变更管理</h1>
          <p class="mt-1 text-sm text-muted-foreground">共 ${state.changes.length} 条</p>
        </div>
        <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="open-changes-create">新建变更</button>
      </header>

      <div class="rounded-md border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">生产单变更用于记录数量、日期、工厂等关键信息调整；本页同步展示该变更对任务、染印、质检、扣款与结算影响范围</div>

      <section class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        ${statusStats
          .map(
            (item) => `
              <article class="rounded-lg border bg-card">
                <div class="px-4 pb-4 pt-4">
                  <p class="text-xs font-normal text-muted-foreground">${escapeHtml(item.label)}</p>
                  <p class="text-2xl font-semibold">${item.value}</p>
                </div>
              </article>
            `,
          )
          .join('')}
      </section>

      <section class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        ${impactStats
          .map(
            (item) => `
              <article class="rounded-lg border bg-card">
                <div class="px-4 pb-4 pt-4">
                  <p class="text-xs font-normal text-muted-foreground">${escapeHtml(item.label)}</p>
                  <p class="text-2xl font-semibold">${item.value}</p>
                </div>
              </article>
            `,
          )
          .join('')}
      </section>

      <section class="flex flex-wrap gap-3">
        <input data-prod-field="changesKeyword" value="${escapeHtml(
          state.changesKeyword,
        )}" class="w-72 rounded-md border px-3 py-2 text-sm" placeholder="关键词（变更单号 / 生产单号 / 变更原因）" />

        <select data-prod-field="changesTypeFilter" class="w-40 rounded-md border px-3 py-2 text-sm">
          <option value="ALL" ${state.changesTypeFilter === 'ALL' ? 'selected' : ''}>全部类型</option>
          ${(Object.keys(changeTypeLabels) as ProductionChangeType[])
            .map(
              (type) =>
                `<option value="${type}" ${
                  state.changesTypeFilter === type ? 'selected' : ''
                }>${escapeHtml(changeTypeLabels[type])}</option>`,
            )
            .join('')}
        </select>

        <select data-prod-field="changesStatusFilter" class="w-36 rounded-md border px-3 py-2 text-sm">
          <option value="ALL" ${state.changesStatusFilter === 'ALL' ? 'selected' : ''}>全部状态</option>
          ${(Object.keys(changeStatusLabels) as ProductionChangeStatus[])
            .map(
              (status) =>
                `<option value="${status}" ${
                  state.changesStatusFilter === status ? 'selected' : ''
                }>${escapeHtml(changeStatusLabels[status])}</option>`,
            )
            .join('')}
        </select>
      </section>

      <section class="rounded-lg border bg-card">
        ${
          filteredChanges.length === 0
            ? `<div class="flex items-center justify-center py-16 text-sm text-muted-foreground">暂无生产单变更数据</div>`
            : `
              <div class="overflow-x-auto">
                <table class="w-full min-w-[1700px] text-sm">
                  <thead>
                    <tr class="border-b">
                      <th class="px-3 py-3 text-left font-medium">变更单号</th>
                      <th class="px-3 py-3 text-left font-medium">生产单号</th>
                      <th class="px-3 py-3 text-left font-medium">变更类型</th>
                      <th class="px-3 py-3 text-left font-medium">变更前</th>
                      <th class="px-3 py-3 text-left font-medium">变更后</th>
                      <th class="px-3 py-3 text-left font-medium">影响范围</th>
                      <th class="px-3 py-3 text-left font-medium">变更原因</th>
                      <th class="px-3 py-3 text-left font-medium">状态</th>
                      <th class="px-3 py-3 text-center font-medium">影响任务数</th>
                      <th class="px-3 py-3 text-center font-medium">影响染印工单数</th>
                      <th class="px-3 py-3 text-center font-medium">影响未结案 QC 数</th>
                      <th class="px-3 py-3 text-center font-medium">影响扣款依据数</th>
                      <th class="px-3 py-3 text-left font-medium">结算影响</th>
                      <th class="px-3 py-3 text-left font-medium">更新时间</th>
                      <th class="px-3 py-3 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredChanges
                      .map((change) => {
                        const summary = summaryMap.get(change.changeId) ?? {
                          taskCount: 0,
                          dyePrintCount: 0,
                          openQcCount: 0,
                          basisCount: 0,
                          statementCount: 0,
                          batchCount: 0,
                        }

                        return `
                          <tr class="border-b last:border-0">
                            <td class="whitespace-nowrap px-3 py-3 font-mono text-xs">${escapeHtml(change.changeId)}</td>
                            <td class="whitespace-nowrap px-3 py-3 font-mono text-xs">${escapeHtml(change.productionOrderId)}</td>
                            <td class="whitespace-nowrap px-3 py-3">${escapeHtml(changeTypeLabels[change.changeType])}</td>
                            <td class="max-w-[100px] truncate px-3 py-3" title="${escapeHtml(
                              safeText(change.beforeValue),
                            )}">${escapeHtml(safeText(change.beforeValue))}</td>
                            <td class="max-w-[100px] truncate px-3 py-3" title="${escapeHtml(
                              safeText(change.afterValue),
                            )}">${escapeHtml(safeText(change.afterValue))}</td>
                            <td class="max-w-[120px] truncate px-3 py-3" title="${escapeHtml(
                              safeText(change.impactScopeZh),
                            )}">${escapeHtml(safeText(change.impactScopeZh))}</td>
                            <td class="max-w-[140px] truncate px-3 py-3" title="${escapeHtml(change.reason)}">${escapeHtml(
                              change.reason,
                            )}</td>
                            <td class="px-3 py-3">${renderBadge(
                              changeStatusLabels[change.status],
                              changeStatusClass[change.status],
                            )}</td>
                            <td class="px-3 py-3 text-center tabular-nums">${summary.taskCount}</td>
                            <td class="px-3 py-3 text-center tabular-nums">${summary.dyePrintCount}</td>
                            <td class="px-3 py-3 text-center tabular-nums">${summary.openQcCount}</td>
                            <td class="px-3 py-3 text-center tabular-nums">${summary.basisCount}</td>
                            <td class="whitespace-nowrap px-3 py-3 text-sm text-muted-foreground">${escapeHtml(
                              buildSettlementSummary(summary.statementCount, summary.batchCount),
                            )}</td>
                            <td class="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">${escapeHtml(
                              safeText(change.updatedAt ?? change.createdAt),
                            )}</td>
                            <td class="px-3 py-3">
                              <div class="flex items-center gap-1 flex-wrap">
                                ${
                                  changeAllowedNext[change.status].length > 0
                                    ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-prod-action="open-changes-status" data-change-id="${
                                        change.changeId
                                      }" data-current-status="${change.status}">状态变更</button>`
                                    : ''
                                }
                                <button class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted" data-prod-action="open-order-detail" data-order-id="${
                                  change.productionOrderId
                                }">查看生产单</button>
                                <button class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted" data-nav="/fcs/production/plan">查看计划</button>
                              </div>
                            </td>
                          </tr>
                        `
                      })
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
        }
      </section>

      ${renderChangeCreateDialog()}
      ${renderChangeStatusDialog()}
    </div>
  `
}

function getOrdersWithLifecycleSummary(): Array<
  ProductionOrder & {
    _lifecycleStatus: LifecycleStatus
    _planStatusZh: string
    _deliveryStatusZh: string
    _taskCount: number
    _blockedTaskCount: number
    _dyePrintStatusZh: string
    _settlementStatusZh: string
  }
> {
  const legacyLikeQualityInspections = getLegacyLikeQualityInspections()
  const legacyLikeDyePrintOrders = getLegacyLikeDyePrintOrders()
  const basisToStatement = new Map<string, string>()
  for (const statement of initialStatementDrafts) {
    for (const basisId of statement.itemBasisIds) {
      basisToStatement.set(basisId, statement.statementId)
    }
  }

  const statementToBatch = new Map<string, string>()
  for (const batch of initialSettlementBatches) {
    for (const statementId of batch.statementIds) {
      statementToBatch.set(statementId, batch.batchId)
    }
  }

  return state.orders.map((order) => {
    const lifecycle = deriveLifecycleStatus(order)
    const planStatus =
      order.planStatus === 'RELEASED'
        ? '计划已下发'
        : order.planStatus === 'PLANNED'
          ? '已计划'
          : '未计划'

    const deliveryStatus = order.deliveryWarehouseStatus === 'SET' ? '已配置' : '未配置'

    const tasks = listRuntimeTasksByOrder(order.productionOrderId)
    const blockedTaskCount = tasks.filter((task) => task.status === 'BLOCKED').length

    const relatedDyes = legacyLikeDyePrintOrders.filter(
      (dye) => dye.productionOrderId === order.productionOrderId,
    )

    let dyeStatus = '无染印'
    if (relatedDyes.length > 0) {
      const hasFailInProcess = relatedDyes.some((dye) => {
        const failBatches = dye.returnBatches.filter((batch) => {
          const linkedQcId = batch.qcId ?? (batch as { linkedQcId?: string }).linkedQcId
          return batch.result === 'FAIL' && Boolean(linkedQcId)
        })

        return failBatches.some((batch) => {
          const linkedQcId = batch.qcId ?? (batch as { linkedQcId?: string }).linkedQcId
          if (!linkedQcId) return false
          const qc = legacyLikeQualityInspections.find((inspection) => inspection.qcId === linkedQcId)
          return Boolean(qc && qc.status !== 'CLOSED')
        })
      })

      if (hasFailInProcess) {
        dyeStatus = '不合格处理中'
      } else if (relatedDyes.some((dye) => dye.availableQty > 0)) {
        dyeStatus = '可继续'
      } else {
        dyeStatus = '生产暂停'
      }
    }

    const basisItems = initialDeductionBasisItems.filter(
      (basis) => basis.productionOrderId === order.productionOrderId,
    )

    let settlement = '无扣款'
    if (basisItems.length > 0) {
      const hasInBatch = basisItems.some((basis) => {
        const statementId = basisToStatement.get(basis.basisId)
        if (!statementId) return false
        return statementToBatch.has(statementId)
      })

      const hasReady = basisItems.some((basis) => basis.status === 'CONFIRMED')
      const hasFrozen = basisItems.some((basis) => basis.status === 'DISPUTED')

      if (hasInBatch) {
        settlement = '已进入批次'
      } else if (hasReady) {
        settlement = '可进入结算'
      } else if (hasFrozen) {
        settlement = '冻结中'
      } else {
        settlement = '有扣款依据'
      }
    }

    return {
      ...order,
      _lifecycleStatus: lifecycle,
      _planStatusZh: planStatus,
      _deliveryStatusZh: deliveryStatus,
      _taskCount: tasks.length,
      _blockedTaskCount: blockedTaskCount,
      _dyePrintStatusZh: dyeStatus,
      _settlementStatusZh: settlement,
    }
  })
}

function renderStatusChangeDialog(): string {
  const order = getOrderById(state.statusSelectedOrderId)
  if (!state.statusDialogOpen || !order) return ''

  const currentStatus = deriveLifecycleStatus(order)
  const nextStatuses = lifecycleAllowedNext[currentStatus]

  const formContent = `
    <div class="space-y-4">
      <div class="space-y-1">
        <span class="text-sm font-medium">当前状态</span>
        <div class="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">${escapeHtml(lifecycleStatusLabel[currentStatus])}</div>
      </div>
      <div class="space-y-1">
        <span class="text-sm font-medium">目标状态 <span class="text-destructive">*</span></span>
        ${
          nextStatuses.length === 0
            ? `<p class="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">已关闭，不可变更</p>`
            : `<select data-prod-field="statusNext" class="w-full rounded-md border px-3 py-2 text-sm">
                 <option value="" ${state.statusNext ? '' : 'selected'}>请选择目标状态</option>
                 ${nextStatuses.map((status) => `<option value="${status}" ${state.statusNext === status ? 'selected' : ''}>${escapeHtml(lifecycleStatusLabel[status])}</option>`).join('')}
               </select>`
        }
      </div>
      <div class="space-y-1">
        <span class="text-sm font-medium">说明（可选）</span>
        <textarea data-prod-field="statusRemark" class="min-h-[72px] w-full rounded-md border px-3 py-2 text-sm" placeholder="请输入状态变更说明">${escapeHtml(state.statusRemark)}</textarea>
      </div>
    </div>
  `

  return renderFormDialog(
    {
      title: '变更生产单状态',
      closeAction: { prefix: 'prod', action: 'close-status-change' },
      submitAction: { prefix: 'prod', action: 'save-status-change', label: '保存' },
      width: 'sm',
      submitDisabled: !state.statusNext,
    },
    formContent
  )
}

export function renderProductionStatusPage(): string {
  const summarizedOrders = getOrdersWithLifecycleSummary()

  const filteredOrders = summarizedOrders.filter((order) => {
    const keyword = state.statusKeyword.trim().toLowerCase()
    if (keyword) {
      const matched =
        includesKeyword(order.productionOrderId.toLowerCase(), keyword) ||
        includesKeyword(order.demandSnapshot.spuCode.toLowerCase(), keyword) ||
        includesKeyword(order.mainFactorySnapshot.name.toLowerCase(), keyword)
      if (!matched) return false
    }

    if (state.statusFilter !== 'ALL' && order._lifecycleStatus !== state.statusFilter) return false

    return true
  })

  const countBy = (status: LifecycleStatus) =>
    summarizedOrders.filter((order) => order._lifecycleStatus === status).length

  const stats = {
    draft: countBy('DRAFT'),
    planned: countBy('PLANNED'),
    released: countBy('RELEASED'),
    inProduction: countBy('IN_PRODUCTION'),
    qcPending: countBy('QC_PENDING'),
    doneClosed: countBy('COMPLETED') + countBy('CLOSED'),
    hasPlanned: summarizedOrders.filter((order) => order._planStatusZh !== '未计划').length,
    hasDelivery: summarizedOrders.filter((order) => order._deliveryStatusZh === '已配置').length,
    hasBlocked: summarizedOrders.filter((order) => order._blockedTaskCount > 0).length,
    settlementReady: summarizedOrders.filter((order) =>
      ['可进入结算', '已进入批次'].includes(order._settlementStatusZh),
    ).length,
  }

  const lifecycleClass = (status: LifecycleStatus): string => {
    if (status === 'DRAFT' || status === 'CLOSED') return 'bg-white text-slate-700'
    if (status === 'PLANNED' || status === 'RELEASED') return 'bg-slate-100 text-slate-700'
    return 'bg-blue-100 text-blue-700'
  }

  const planClass = (value: string): string =>
    value === '未计划' ? 'bg-white text-slate-700' : 'bg-slate-100 text-slate-700'

  const deliveryClass = (value: string): string =>
    value === '已配置' ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-700'

  const dyeStatusClass = (value: string): string => {
    if (value === '可继续') return 'bg-blue-100 text-blue-700'
    if (value === '不合格处理中') return 'bg-red-100 text-red-700'
    if (value === '生产暂停') return 'bg-slate-100 text-slate-700'
    return 'bg-white text-slate-700'
  }

  const settlementClass = (value: string): string => {
    if (value === '已进入批次' || value === '可进入结算') return 'bg-blue-100 text-blue-700'
    if (value === '冻结中') return 'bg-red-100 text-red-700'
    if (value === '有扣款依据') return 'bg-slate-100 text-slate-700'
    return 'bg-white text-slate-700'
  }

  return `
    <div class="flex flex-col gap-6">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">生产单当前生产流程状态总览</h1>
          <p class="mt-1 text-sm text-muted-foreground">汇总每张生产单的执行状态、计划、交付仓配置、任务、染印与结算情况；原型阶段支持人工状态推进与有限回退</p>
        </div>
        <span class="text-sm text-muted-foreground">共 ${filteredOrders.length} 条</span>
      </header>

      <section class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        ${renderStatCard('草稿数', stats.draft)}
        ${renderStatCard('已计划数', stats.planned)}
        ${renderStatCard('已下发数', stats.released)}
        ${renderStatCard('生产中数', stats.inProduction)}
        ${renderStatCard('待质检数', stats.qcPending)}
        ${renderStatCard('已完成/已关闭', stats.doneClosed)}
      </section>

      <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        ${[
          { label: '已计划数', value: stats.hasPlanned, desc: '计划状态 != 未计划' },
          { label: '已配置交付仓数', value: stats.hasDelivery, desc: '交付仓状态 = 已配置' },
          { label: '有生产暂停任务的生产单数', value: stats.hasBlocked, desc: '存在生产暂停任务' },
          { label: '可结算/已进入批次数', value: stats.settlementReady, desc: '可进入结算或已进入批次' },
        ]
          .map(
            (item) => `
              <article class="rounded-lg border bg-card">
                <div class="px-4 pb-1 pt-4">
                  <p class="text-xs font-medium leading-snug text-muted-foreground">${escapeHtml(
                    item.label,
                  )}</p>
                  <p class="mt-1 text-2xl font-bold">${item.value}</p>
                </div>
                <div class="px-4 pb-4 text-xs text-muted-foreground">${escapeHtml(item.desc)}</div>
              </article>
            `,
          )
          .join('')}
      </section>

      <section class="flex flex-wrap gap-3">
        <input data-prod-field="statusKeyword" value="${escapeHtml(
          state.statusKeyword,
        )}" class="w-64 rounded-md border px-3 py-2 text-sm" placeholder="关键词（生产单号 / 款号 / 工厂）" />
        <select data-prod-field="statusFilter" class="w-40 rounded-md border px-3 py-2 text-sm">
          <option value="ALL" ${state.statusFilter === 'ALL' ? 'selected' : ''}>全部</option>
          ${(Object.keys(lifecycleStatusLabel) as LifecycleStatus[])
            .map(
              (status) =>
                `<option value="${status}" ${
                  state.statusFilter === status ? 'selected' : ''
                }>${escapeHtml(lifecycleStatusLabel[status])}</option>`,
            )
            .join('')}
        </select>
      </section>

      ${
        filteredOrders.length === 0
          ? `<div class="flex h-40 items-center justify-center text-sm text-muted-foreground">暂无生产单状态数据</div>`
          : `
            <div class="rounded-md border overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th class="px-3 py-3 text-left font-medium">生产单号</th>
                    <th class="px-3 py-3 text-left font-medium">商品/款号</th>
                    <th class="px-3 py-3 text-left font-medium">主工厂</th>
                    <th class="px-3 py-3 text-left font-medium">当前状态</th>
                    <th class="px-3 py-3 text-left font-medium">计划状态</th>
                    <th class="px-3 py-3 text-left font-medium">交付仓</th>
                    <th class="px-3 py-3 text-left font-medium">关联任务</th>
                    <th class="px-3 py-3 text-left font-medium">生产暂停任务</th>
                    <th class="px-3 py-3 text-left font-medium">染印状态</th>
                    <th class="px-3 py-3 text-left font-medium">结算情况</th>
                    <th class="px-3 py-3 text-left font-medium">状态说明</th>
                    <th class="px-3 py-3 text-left font-medium">状态更新时间</th>
                    <th class="px-3 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredOrders
                    .map((order) => {
                      const remarkText = order.lifecycleStatusRemark ?? '—'
                      const updatedAt = order.lifecycleUpdatedAt ?? '—'

                      return `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.productionOrderId)}</td>
                          <td class="px-3 py-3">${escapeHtml(order.demandSnapshot.spuCode)}</td>
                          <td class="px-3 py-3">${escapeHtml(order.mainFactorySnapshot.name)}</td>
                          <td class="px-3 py-3">${renderBadge(
                            lifecycleStatusLabel[order._lifecycleStatus],
                            lifecycleClass(order._lifecycleStatus),
                          )}</td>
                          <td class="px-3 py-3">${renderBadge(order._planStatusZh, planClass(order._planStatusZh))}</td>
                          <td class="px-3 py-3">${renderBadge(
                            order._deliveryStatusZh,
                            deliveryClass(order._deliveryStatusZh),
                          )}</td>
                          <td class="px-3 py-3 text-center">${order._taskCount > 0 ? order._taskCount : '—'}</td>
                          <td class="px-3 py-3 text-center">${
                            order._blockedTaskCount > 0
                              ? renderBadge(String(order._blockedTaskCount), 'bg-red-100 text-red-700')
                              : '—'
                          }</td>
                          <td class="px-3 py-3">${renderBadge(
                            order._dyePrintStatusZh,
                            dyeStatusClass(order._dyePrintStatusZh),
                          )}</td>
                          <td class="px-3 py-3">${renderBadge(
                            order._settlementStatusZh,
                            settlementClass(order._settlementStatusZh),
                          )}</td>
                          <td class="max-w-[140px] truncate px-3 py-3 text-xs text-muted-foreground" title="${escapeHtml(
                            remarkText,
                          )}">${escapeHtml(remarkText)}</td>
                          <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(updatedAt)}</td>
                          <td class="px-3 py-3 text-right">
                            <div class="flex justify-end gap-1 flex-wrap">
                              <button class="rounded border px-2 py-1 text-xs hover:bg-muted ${
                                order._lifecycleStatus === 'CLOSED' ? 'pointer-events-none opacity-50' : ''
                              }" data-prod-action="open-status-change" data-order-id="${order.productionOrderId}">状态变更</button>
                              <button class="rounded px-2 py-1 text-xs hover:bg-muted" data-prod-action="open-order-detail" data-order-id="${
                                order.productionOrderId
                              }">生产单</button>
                              <button class="rounded px-2 py-1 text-xs hover:bg-muted" data-nav="/fcs/production/plan">计划</button>
                              <button class="rounded px-2 py-1 text-xs hover:bg-muted" data-nav="/fcs/process/task-breakdown">任务</button>
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          `
      }

      ${renderStatusChangeDialog()}
    </div>
  `
}
function renderDetailLogsDialog(order: ProductionOrder): string {
  if (!state.detailLogsOpen) return ''

  const logs = [...order.auditLogs].reverse()

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <div class="w-full max-w-3xl rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="flex items-center justify-between border-b px-6 py-4">
          <h3 class="text-lg font-semibold">操作日志</h3>
          <button class="rounded-md border px-3 py-1 text-xs hover:bg-muted" data-prod-action="detail-close-logs">关闭</button>
        </header>
        <div class="max-h-[60vh] overflow-y-auto px-6 py-4">
          <div class="overflow-x-auto rounded-md border">
            <table class="w-full text-sm">
              <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left font-medium">时间</th>
                  <th class="px-3 py-2 text-left font-medium">操作</th>
                  <th class="px-3 py-2 text-left font-medium">详情</th>
                  <th class="px-3 py-2 text-left font-medium">操作人</th>
                </tr>
              </thead>
              <tbody>
                ${
                  logs.length === 0
                    ? renderEmptyRow(4, '暂无日志')
                    : logs
                        .map(
                          (log) => `
                            <tr class="border-b last:border-0">
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(log.at)}</td>
                              <td class="px-3 py-2">${renderBadge(log.action, 'bg-slate-100 text-slate-700')}</td>
                              <td class="px-3 py-2">${escapeHtml(log.detail)}</td>
                              <td class="px-3 py-2">${escapeHtml(log.by)}</td>
                            </tr>
                          `,
                        )
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
}

function renderDetailSimulateDialog(order: ProductionOrder): string {
  if (!state.detailSimulateOpen) return ''

  const formContent = `
    <div class="space-y-3">
      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">选择目标状态</span>
        <select data-prod-field="detailSimulateStatus" class="w-full rounded-md border px-3 py-2 text-sm">
          ${(Object.keys(productionOrderStatusConfig) as ProductionOrderStatus[]).map((status) => `<option value="${status}" ${state.detailSimulateStatus === status ? 'selected' : ''}>${escapeHtml(productionOrderStatusConfig[status].label)}</option>`).join('')}
        </select>
      </div>
      <p class="text-xs text-muted-foreground">当状态为 生产执行中/已完成/已取消 时，订单将被锁定</p>
    </div>
  `

  return renderFormDialog(
    {
      title: '模拟状态流转',
      description: '仅限管理员使用，用于测试不同状态下的页面表现',
      closeAction: { prefix: 'prod', action: 'detail-close-simulate' },
      submitAction: { prefix: 'prod', action: 'detail-open-simulate-confirm', label: '确认变更' },
      width: 'md',
    },
    formContent
  )
}

function renderDetailSimulateConfirmDialog(order: ProductionOrder): string {
  if (!state.detailConfirmSimulateOpen) return ''

  const description = `确定将状态从「${escapeHtml(productionOrderStatusConfig[order.status].label)}」变更为「${escapeHtml(productionOrderStatusConfig[state.detailSimulateStatus].label)}」吗？此操作将记录到审计日志。`

  return renderConfirmDialog(
    {
      title: '确认状态变更',
      closeAction: { prefix: 'prod', action: 'detail-close-simulate-confirm' },
      confirmAction: { prefix: 'prod', action: 'detail-apply-simulate', label: '确认' },
      width: 'sm',
    },
    `<p class="text-sm text-muted-foreground">${description}</p>`
  )
}

function renderOrderDetailTabButtons(activeTab: OrderDetailTab): string {
  const tabs: Array<{ key: OrderDetailTab; label: string }> = [
    { key: 'overview', label: '概览' },
    { key: 'demand-snapshot', label: '需求快照' },
    { key: 'tech-pack', label: '技术包' },
    { key: 'assignment', label: '分配概览' },
    { key: 'handover', label: '交接链路' },
    { key: 'logs', label: '日志' },
  ]

  return `
    <div class="inline-flex rounded-md border bg-muted/30 p-1">
      ${tabs
        .map(
          (tab) => `
            <button class="rounded px-3 py-1.5 text-sm ${
              tab.key === activeTab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }" data-prod-action="detail-switch-tab" data-tab="${tab.key}">${tab.label}</button>
          `,
        )
        .join('')}
    </div>
  `
}

function getOrderMaterialStatusDisplay(order: ProductionOrder): {
  label: '未建草稿' | '待确认' | '部分确认' | '已确认'
  badgeClass: string
  hint: string
} {
  const indicators = getOrderMaterialIndicators(order)
  if (indicators.materialDraftSummaryStatus === 'pending') {
    return {
      label: '待确认',
      badgeClass: 'bg-amber-100 text-amber-700',
      hint: indicators.materialDraftHintText,
    }
  }
  if (indicators.materialDraftSummaryStatus === 'partial_confirmed') {
    return {
      label: '部分确认',
      badgeClass: 'bg-blue-100 text-blue-700',
      hint: indicators.materialDraftHintText,
    }
  }
  if (indicators.materialDraftSummaryStatus === 'confirmed') {
    return {
      label: '已确认',
      badgeClass: 'bg-green-100 text-green-700',
      hint: indicators.materialDraftHintText,
    }
  }
  if (indicators.hasMaterialDraft) {
    return {
      label: '已确认',
      badgeClass: 'bg-slate-100 text-slate-700',
      hint: indicators.materialDraftHintText,
    }
  }
  return {
    label: '未建草稿',
    badgeClass: 'bg-slate-100 text-slate-700',
    hint: indicators.materialDraftHintText,
  }
}

function renderOrderMaterialInfoSection(order: ProductionOrder): string {
  const summary = getMaterialRequestDraftSummaryByOrder(order.productionOrderId)
  const drafts = listMaterialRequestDraftsByOrder(order.productionOrderId)
  const statusDisplay = getOrderMaterialStatusDisplay(order)
  const actionLabel =
    summary.pendingCount > 0
      ? '去确认领料'
      : summary.createdCount > 0
        ? '查看领料详情'
        : '查看领料草稿'

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-base font-semibold">领料信息</h3>
          <p class="mt-1 text-xs text-muted-foreground">按任务查看领料草稿与确认创建情况</p>
        </div>
        <button
          class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted"
          data-prod-action="open-material-draft-drawer"
          data-order-id="${escapeHtml(order.productionOrderId)}"
        >${actionLabel}</button>
      </div>

      <div class="mt-3 grid gap-3 md:grid-cols-5">
        <article class="rounded-md border bg-muted/20 px-3 py-2">
          <p class="text-xs text-muted-foreground">领料状态</p>
          <div class="mt-1">${renderBadge(statusDisplay.label, statusDisplay.badgeClass)}</div>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(statusDisplay.hint)}</p>
        </article>
        <article class="rounded-md border bg-muted/20 px-3 py-2"><p class="text-xs text-muted-foreground">草稿数</p><p class="mt-1 text-lg font-semibold">${summary.totalDraftCount}</p></article>
        <article class="rounded-md border bg-muted/20 px-3 py-2"><p class="text-xs text-muted-foreground">已确认需求数</p><p class="mt-1 text-lg font-semibold">${summary.createdCount}</p></article>
        <article class="rounded-md border bg-muted/20 px-3 py-2"><p class="text-xs text-muted-foreground">待确认数</p><p class="mt-1 text-lg font-semibold">${summary.pendingCount}</p></article>
        <article class="rounded-md border bg-muted/20 px-3 py-2"><p class="text-xs text-muted-foreground">不涉及数</p><p class="mt-1 text-lg font-semibold">${summary.notApplicableCount}</p></article>
      </div>

      <div class="mt-3 overflow-x-auto rounded-md border">
        <table class="w-full text-sm">
          <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">任务名称</th>
              <th class="px-3 py-2 text-left font-medium">任务类型</th>
              <th class="px-3 py-2 text-left font-medium">草稿状态</th>
              <th class="px-3 py-2 text-left font-medium">确认状态</th>
              <th class="px-3 py-2 text-left font-medium">领料方式</th>
              <th class="px-3 py-2 text-left font-medium">领料需求编号</th>
              <th class="px-3 py-2 text-left font-medium">最近操作时间</th>
            </tr>
          </thead>
          <tbody>
            ${
              drafts.length === 0
                ? renderEmptyRow(7, '未建草稿，可进入领料需求草稿处理视图')
                : drafts
                    .map((draft) => {
                      const isConfirmed = draft.draftStatus === 'created'
                      const draftStatusLabel =
                        draft.draftStatus === 'created'
                          ? '已建草稿'
                          : draft.draftStatus === 'not_applicable'
                            ? '不涉及'
                            : '待确认'

                      return `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2">${escapeHtml(draft.taskName)}</td>
                          <td class="px-3 py-2">${renderBadge(getTaskTypeLabel(draft.taskType), 'bg-slate-100 text-slate-700')}</td>
                          <td class="px-3 py-2">${renderBadge(
                            draftStatusLabel,
                            draft.draftStatus === 'created'
                              ? 'bg-green-100 text-green-700'
                              : draft.draftStatus === 'not_applicable'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-amber-100 text-amber-700',
                          )}</td>
                          <td class="px-3 py-2">${renderBadge(
                            isConfirmed ? '已确认' : draft.draftStatus === 'not_applicable' ? '不涉及' : '待确认',
                            isConfirmed
                              ? 'bg-green-100 text-green-700'
                              : draft.draftStatus === 'not_applicable'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-amber-100 text-amber-700',
                          )}</td>
                          <td class="px-3 py-2">${escapeHtml(isConfirmed ? draft.materialModeLabel : '-')}</td>
                          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(isConfirmed ? draft.createdMaterialRequestNo : '-')}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(draft.updatedAt || draft.createdAt || '-')}</td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderOrderDetailTabContent(order: ProductionOrder): string {
  const techPack = getOrderTechPackInfo(order)
  const totalQty = order.demandSnapshot.skuLines.reduce((sum, sku) => sum + sku.qty, 0)

  if (state.detailTab === 'overview') {
    const ownerDisplay = (() => {
      if (order.ownerPartyType === 'FACTORY') {
        if (order.ownerPartyId === order.mainFactoryId) {
          return { text: '主工厂', detail: order.mainFactorySnapshot.name, adjusted: false }
        }
        return { text: '工厂（已调整）', detail: order.ownerPartyId, adjusted: true }
      }

      const entity = legalEntities.find((item) => item.id === order.ownerPartyId)
      return {
        text: entity?.name ?? '法人实体',
        detail: order.ownerReason ?? '',
        adjusted: true,
      }
    })()

    return `
      <div class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        <section class="rounded-lg border bg-card p-4">
          <h3 class="mb-3 text-base font-semibold">基本信息</h3>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div><p class="text-xs text-muted-foreground">生产单号</p><p class="font-mono">${escapeHtml(
              order.productionOrderId,
            )}</p></div>
            <div><p class="text-xs text-muted-foreground">需求编号</p><p class="font-mono">${escapeHtml(
              order.demandId,
            )}</p></div>
            <div><p class="text-xs text-muted-foreground">旧单号</p><p class="font-mono">${escapeHtml(
              order.legacyOrderNo,
            )}</p></div>
            <div><p class="text-xs text-muted-foreground">SPU编码</p><p class="font-mono">${escapeHtml(
              order.demandSnapshot.spuCode,
            )}</p></div>
            <div class="col-span-2"><p class="text-xs text-muted-foreground">SPU名称</p><p>${escapeHtml(
              order.demandSnapshot.spuName,
            )}</p></div>
            <div><p class="text-xs text-muted-foreground">总数量</p><p>${totalQty.toLocaleString()}</p></div>
            <div><p class="text-xs text-muted-foreground">交付日期</p><p>${escapeHtml(
              safeText(order.demandSnapshot.requiredDeliveryDate),
            )}</p></div>
            <div><p class="text-xs text-muted-foreground">创建时间</p><p>${escapeHtml(order.createdAt)}</p></div>
            <div><p class="text-xs text-muted-foreground">最后更新</p><p>${escapeHtml(order.updatedAt)}</p></div>
          </div>
        </section>

        <section class="rounded-lg border bg-card p-4">
          <h3 class="mb-3 text-base font-semibold">货权与工厂</h3>
          <div class="space-y-3 text-sm">
            <div>
              <p class="text-xs text-muted-foreground">货权主体</p>
              <p class="${ownerDisplay.adjusted ? 'font-medium text-orange-700' : ''}">${escapeHtml(
                ownerDisplay.text,
              )}</p>
              ${ownerDisplay.detail ? `<p class="text-xs text-muted-foreground">${escapeHtml(ownerDisplay.detail)}</p>` : ''}
              ${order.ownerReason ? `<p class="text-xs text-muted-foreground">原因：${escapeHtml(order.ownerReason)}</p>` : ''}
            </div>
            <div class="grid grid-cols-2 gap-3 border-t pt-3">
              <div><p class="text-xs text-muted-foreground">工厂名称</p><p>${escapeHtml(order.mainFactorySnapshot.name)}</p></div>
              <div><p class="text-xs text-muted-foreground">工厂编码</p><p class="font-mono">${escapeHtml(
                order.mainFactorySnapshot.code,
              )}</p></div>
              <div><p class="text-xs text-muted-foreground">层级</p><p>${escapeHtml(
                tierLabels[order.mainFactorySnapshot.tier as FactoryTier] ?? order.mainFactorySnapshot.tier,
              )}</p></div>
              <div><p class="text-xs text-muted-foreground">类型</p><p>${escapeHtml(
                typeLabels[order.mainFactorySnapshot.type as FactoryType] ?? order.mainFactorySnapshot.type,
              )}</p></div>
              <div><p class="text-xs text-muted-foreground">位置</p><p>${escapeHtml(
                `${order.mainFactorySnapshot.city}, ${order.mainFactorySnapshot.province}`,
              )}</p></div>
              <div><p class="text-xs text-muted-foreground">状态</p><p>${renderBadge(
                order.mainFactorySnapshot.status,
                'bg-slate-100 text-slate-700',
              )}</p></div>
            </div>
          </div>
        </section>
      </div>
      ${renderOrderMaterialInfoSection(order)}
      </div>
    `
  }

  if (state.detailTab === 'demand-snapshot') {
    return `
      <section class="rounded-lg border bg-card p-4 space-y-4">
        <h3 class="text-base font-semibold">需求快照</h3>
        <div class="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div><p class="text-xs text-muted-foreground">需求编号</p><p class="font-mono">${escapeHtml(
            order.demandSnapshot.demandId,
          )}</p></div>
          <div><p class="text-xs text-muted-foreground">SPU编码</p><p class="font-mono">${escapeHtml(
            order.demandSnapshot.spuCode,
          )}</p></div>
          <div><p class="text-xs text-muted-foreground">优先级</p><p>${escapeHtml(
            order.demandSnapshot.priority,
          )}</p></div>
          <div><p class="text-xs text-muted-foreground">交付日期</p><p>${escapeHtml(
            safeText(order.demandSnapshot.requiredDeliveryDate),
          )}</p></div>
        </div>

        <div class="overflow-x-auto rounded-md border">
          <table class="w-full text-sm">
            <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left font-medium">SKU编码</th>
                <th class="px-3 py-2 text-left font-medium">尺码</th>
                <th class="px-3 py-2 text-left font-medium">颜色</th>
                <th class="px-3 py-2 text-right font-medium">数量</th>
              </tr>
            </thead>
            <tbody>
              ${order.demandSnapshot.skuLines
                .map(
                  (sku) => `
                    <tr class="border-b last:border-0">
                      <td class="px-3 py-2 font-mono text-xs">${escapeHtml(sku.skuCode)}</td>
                      <td class="px-3 py-2">${escapeHtml(sku.size)}</td>
                      <td class="px-3 py-2">${escapeHtml(sku.color)}</td>
                      <td class="px-3 py-2 text-right">${sku.qty.toLocaleString()}</td>
                    </tr>
                  `,
                )
                .join('')}
              <tr>
                <td colspan="3" class="px-3 py-2 font-medium">合计</td>
                <td class="px-3 py-2 text-right font-medium">${totalQty.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${
          order.demandSnapshot.constraintsNote
            ? `<div class="border-t pt-3"><p class="text-xs text-muted-foreground">约束条件</p><p class="text-sm">${escapeHtml(
                order.demandSnapshot.constraintsNote,
              )}</p></div>`
            : ''
        }
      </section>
    `
  }

  if (state.detailTab === 'tech-pack') {
    return `
      <section class="rounded-lg border bg-card p-4 space-y-4">
        <h3 class="text-base font-semibold">技术包信息</h3>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <h4 class="text-sm font-medium">快照信息</h4>
            <p class="text-xs text-muted-foreground">状态</p>
            <div>${renderBadge(
              demandTechPackStatusConfig[techPack.snapshotStatus].label,
              demandTechPackStatusConfig[techPack.snapshotStatus].className,
            )}</div>
            <p class="text-xs text-muted-foreground">版本 ${escapeHtml(techPack.snapshotVersion)}</p>
            <p class="text-xs text-muted-foreground">快照时间 ${escapeHtml(order.techPackSnapshot.snapshotAt)}</p>
          </div>

          <div class="space-y-2">
            <h4 class="text-sm font-medium">当前信息</h4>
            <p class="text-xs text-muted-foreground">状态</p>
            <div class="flex items-center gap-2">
              ${renderBadge(
                demandTechPackStatusConfig[techPack.currentStatus].label,
                demandTechPackStatusConfig[techPack.currentStatus].className,
              )}
              ${techPack.isOutOfSync ? renderBadge('不一致', 'bg-orange-100 text-orange-700') : ''}
            </div>
            <p class="text-xs text-muted-foreground">版本 ${escapeHtml(techPack.currentVersion)}</p>
            <p class="text-xs text-muted-foreground">完整度 ${techPack.completenessScore}%</p>
          </div>
        </div>

        ${
          techPack.missingChecklist.length > 0
            ? `<div class="space-y-2 border-t pt-3"><p class="text-sm font-medium">缺口清单</p>${techPack.missingChecklist
                .map(
                  (item) => `<p class="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">${escapeHtml(item)}</p>`,
                )
                .join('')}</div>`
            : ''
        }

        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="open-tech-pack" data-spu-code="${escapeHtml(
          order.demandSnapshot.spuCode,
        )}">完善技术包</button>
      </section>
    `
  }

  if (state.detailTab === 'assignment') {
    const runtime = getOrderRuntimeAssignmentSnapshot(order)
    const breakdown = getOrderTaskBreakdownSnapshot(order)
    return `
      <div class="space-y-4">
        <div class="grid gap-4 md:grid-cols-3">
          <section class="rounded-lg border bg-card p-4 space-y-2">
            <h3 class="text-base font-semibold">分配情况</h3>
            <p class="text-sm">派单任务: ${runtime.assignmentSummary.directCount}</p>
            <p class="text-sm">竞价任务: ${runtime.assignmentSummary.biddingCount}</p>
            <p class="text-sm">总任务数: ${runtime.assignmentSummary.totalTasks}</p>
            <p class="text-sm text-orange-700">未分配: ${runtime.assignmentSummary.unassignedCount}</p>
            <p class="text-sm text-muted-foreground">任务明细行: ${breakdown.detailRowCount} 条</p>
            <p class="text-xs text-muted-foreground">原始任务 ${breakdown.sourceTaskCount} · 执行任务 ${breakdown.executionTaskCount}</p>
            <p class="text-xs text-muted-foreground">拆分来源 ${breakdown.splitSourceCount} · 拆分结果 ${breakdown.splitResultCount} · 拆分组 ${breakdown.splitGroupCount}</p>
          </section>

          <section class="rounded-lg border bg-card p-4 space-y-2">
            <h3 class="text-base font-semibold">竞价情况</h3>
            <p class="text-sm">活跃竞价: ${runtime.biddingSummary.activeTenderCount}</p>
            <p class="text-sm">最近截止: ${escapeHtml(safeText(runtime.biddingSummary.nearestDeadline?.slice(0, 10)))}</p>
            <p class="text-sm text-red-700">已过期: ${runtime.biddingSummary.overdueTenderCount}</p>
          </section>

          <section class="rounded-lg border bg-card p-4 space-y-2">
            <h3 class="text-base font-semibold">派单情况</h3>
            <p class="text-sm">已分配工厂: ${runtime.directDispatchSummary.assignedFactoryCount}</p>
            <p class="text-sm text-orange-700">拒单数: ${runtime.directDispatchSummary.rejectedCount}</p>
            <p class="text-sm text-red-700">确认超时: ${runtime.directDispatchSummary.overdueAckCount}</p>
          </section>
        </div>

        <section class="rounded-lg border bg-card p-4 space-y-2">
          <h3 class="text-base font-semibold">拆分事件与结果</h3>
          ${renderSplitEventList(breakdown.splitEvents, 6)}
        </section>
      </div>
    `
  }

  if (state.detailTab === 'handover') {
    return `
      <section class="rounded-lg border bg-card p-4 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold">交接链路</h3>
          <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-nav="/fcs/progress/handover?po=${escapeHtml(
            order.productionOrderId,
          )}">打开交接页面</button>
        </div>

        <div class="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          <p>待确认: -</p>
          <p>争议/差异: -</p>
          <p>已确认: -</p>
        </div>

        ${
          order.riskFlags.includes('HANDOVER_DIFF')
            ? `<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">该生产单存在交接差异异常，请查看交接链路追踪处理。</div>`
            : ''
        }

        <div class="flex flex-wrap gap-2">
          <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-nav="/fcs/progress/handover?po=${escapeHtml(
            order.productionOrderId,
          )}">查看完整交接链路</button>
          <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-nav="/fcs/progress/exceptions?po=${escapeHtml(
            order.productionOrderId,
          )}&reasonCode=HANDOVER_DIFF">查看交接异常</button>
        </div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="mb-3 text-base font-semibold">操作日志</h3>
      ${
        (() => {
          const mergedLogs = getOrderMergedAuditLogs(order).slice().reverse()
          return `
      <div class="overflow-x-auto rounded-md border">
        <table class="w-full text-sm">
          <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">时间</th>
              <th class="px-3 py-2 text-left font-medium">操作</th>
              <th class="px-3 py-2 text-left font-medium">详情</th>
              <th class="px-3 py-2 text-left font-medium">操作人</th>
            </tr>
          </thead>
          <tbody>
            ${
              mergedLogs.length === 0
                ? renderEmptyRow(4, '暂无日志')
                : mergedLogs
                    .map(
                      (log) => `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(log.at)}</td>
                          <td class="px-3 py-2">${renderBadge(log.action, 'bg-slate-100 text-slate-700')}</td>
                          <td class="px-3 py-2">${escapeHtml(log.detail)}</td>
                          <td class="px-3 py-2">${escapeHtml(log.by)}</td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
          `
        })()
      }
    </section>
  `
}

export function renderProductionOrderDetailPage(orderId: string): string {
  if (state.detailCurrentOrderId !== orderId) {
    state.detailCurrentOrderId = orderId
    state.detailTab = 'overview'
    state.detailLogsOpen = false
    state.detailSimulateOpen = false
    state.detailConfirmSimulateOpen = false
  }

  const order = state.orders.find((item) => item.productionOrderId === orderId) ?? null

  if (!order) {
    return `
      <div class="flex min-h-[240px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>未找到生产单：${escapeHtml(orderId)}</p>
        <button class="rounded-md border px-4 py-2 hover:bg-muted" data-nav="/fcs/production/orders">返回生产单台账</button>
      </div>
    `
  }

  const techPack = getOrderTechPackInfo(order)
  const runtime = getOrderRuntimeAssignmentSnapshot(order)
  const breakdown = getOrderTaskBreakdownSnapshot(order)

  const canBreakdown =
    getOrderBusinessTechPackStatus(order.techPackSnapshot.status) === 'RELEASED' &&
    order.status === 'READY_FOR_BREAKDOWN'
  const canAssign =
    breakdown.isBrokenDown &&
    (order.status === 'WAIT_ASSIGNMENT' || order.status === 'ASSIGNING')

  const breakdownDisabledReason =
    getOrderBusinessTechPackStatus(order.techPackSnapshot.status) !== 'RELEASED'
      ? '技术包未发布，无法拆解'
      : order.status !== 'READY_FOR_BREAKDOWN'
        ? '当前状态不支持拆解'
        : ''

  const assignDisabledReason =
    !breakdown.isBrokenDown
      ? '请先完成工艺任务拆解'
      : order.status !== 'WAIT_ASSIGNMENT' && order.status !== 'ASSIGNING'
        ? '当前状态不支持分配'
        : ''
  const detailMaterialSummary = getMaterialRequestDraftSummaryByOrder(order.productionOrderId)
  const detailMaterialStatus = getOrderMaterialStatusDisplay(order)

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="mb-1 flex items-center gap-2">
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="/fcs/production/orders">返回</button>
            <h1 class="font-mono text-xl font-semibold">${escapeHtml(order.productionOrderId)}</h1>
            ${renderBadge(
              productionOrderStatusConfig[order.status].label,
              productionOrderStatusConfig[order.status].color,
            )}
            ${order.lockedLegacy ? renderBadge('已锁单', 'bg-red-100 text-red-700') : ''}
          </div>
          <p class="text-sm text-muted-foreground">关联需求：${escapeHtml(order.demandId)} | 旧单号：${escapeHtml(
            order.legacyOrderNo,
          )}</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button class="rounded-md border px-3 py-2 text-sm ${
            canBreakdown ? 'hover:bg-muted' : 'pointer-events-none opacity-50'
          }" title="${escapeHtml(breakdownDisabledReason)}" data-nav="/fcs/process/task-breakdown?po=${escapeHtml(
            order.productionOrderId,
          )}">拆解任务</button>
          <button class="rounded-md border px-3 py-2 text-sm ${
            canAssign ? 'hover:bg-muted' : 'pointer-events-none opacity-50'
          }" title="${escapeHtml(assignDisabledReason)}" data-nav="/fcs/dispatch/board?po=${escapeHtml(
            order.productionOrderId,
          )}">去分配</button>
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="open-tech-pack" data-spu-code="${escapeHtml(
            order.demandSnapshot.spuCode,
          )}">完善技术包</button>
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="detail-open-logs">查看日志</button>
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/progress/urge?po=${escapeHtml(
            order.productionOrderId,
          )}">催办通知</button>
          <button class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="detail-open-simulate">模拟状态流转</button>
        </div>
      </header>

      ${
        techPack.isOutOfSync
          ? `<section class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
               <p class="font-medium">技术包快照与当前版本不一致</p>
               <p class="mt-1">快照版本：${escapeHtml(techPack.snapshotVersion)} (${escapeHtml(
                 demandTechPackStatusConfig[techPack.snapshotStatus].label,
               )}) | 当前版本：${escapeHtml(techPack.currentVersion)} (${escapeHtml(
                 demandTechPackStatusConfig[techPack.currentStatus].label,
               )})</p>
             </section>`
          : ''
      }

      ${
        getOrderBusinessTechPackStatus(order.techPackSnapshot.status) !== 'RELEASED'
          ? `<section class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
               <p class="font-medium">技术包未发布，无法拆解</p>
               <p class="mt-1">当前技术包状态为 ${escapeHtml(
                 demandTechPackStatusConfig[getOrderBusinessTechPackStatus(order.techPackSnapshot.status)].label,
               )}，请先完善并发布。</p>
             </section>`
          : ''
      }

      ${
        order.riskFlags.length > 0
          ? `<section class="rounded-lg border border-orange-200 bg-orange-50 p-4">
               <h3 class="mb-2 text-sm font-semibold text-orange-800">风险提示</h3>
               <div class="flex flex-wrap gap-2">
                 ${order.riskFlags
                   .map((flag) => renderBadge(riskFlagConfig[flag].label, riskFlagConfig[flag].color))
                   .join('')}
               </div>
             </section>`
          : ''
      }

      <section class="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <article class="rounded-lg border bg-card p-4">
          <h3 class="mb-2 text-sm font-medium text-muted-foreground">主工厂</h3>
          <p class="font-medium">${escapeHtml(order.mainFactorySnapshot.name)}</p>
          <p class="text-xs text-muted-foreground">${escapeHtml(order.mainFactorySnapshot.code)}</p>
          <div class="mt-2 flex flex-wrap gap-1">
            ${renderBadge(tierLabels[order.mainFactorySnapshot.tier as FactoryTier] ?? order.mainFactorySnapshot.tier, 'bg-slate-100 text-slate-700')}
            ${renderBadge(typeLabels[order.mainFactorySnapshot.type as FactoryType] ?? order.mainFactorySnapshot.type, 'bg-slate-100 text-slate-700')}
          </div>
        </article>

        <article class="rounded-lg border bg-card p-4">
          <h3 class="mb-2 text-sm font-medium text-muted-foreground">拆解结果</h3>
          ${
            breakdown.isBrokenDown
              ? `${renderBadge('已拆解', 'bg-green-100 text-green-700')}
                 <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(
                   breakdown.taskTypesTop3.join('、') || '-',
                 )}</p>
                 <p class="text-xs text-muted-foreground">任务明细行 ${breakdown.detailRowCount} 条 · 合计 ${breakdown.detailRowTotalQty}件</p>
                 <p class="text-xs text-muted-foreground">原始任务 ${breakdown.sourceTaskCount} · 执行任务 ${breakdown.executionTaskCount}</p>
                 <p class="text-xs text-muted-foreground">拆分来源 ${breakdown.splitSourceCount} · 拆分结果 ${breakdown.splitResultCount} · 拆分组 ${breakdown.splitGroupCount}</p>
                 <p class="text-xs text-muted-foreground">${escapeHtml(breakdown.detailRowPreview)}</p>
                 <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(
                   safeText(breakdown.lastBreakdownAt),
                 )} by ${escapeHtml(safeText(breakdown.lastBreakdownBy))}</p>
                 ${
                   breakdown.splitEvents.length > 0
                     ? `<div class="mt-2">${renderSplitEventList(breakdown.splitEvents, 1)}</div>`
                     : ''
                 }`
              : renderBadge('未拆解', 'bg-slate-100 text-slate-700')
          }
        </article>

        <article class="rounded-lg border bg-card p-4">
          <h3 class="mb-2 text-sm font-medium text-muted-foreground">分配情况</h3>
          <p class="text-sm">派单: ${runtime.assignmentSummary.directCount}</p>
          <p class="text-sm">竞价: ${runtime.assignmentSummary.biddingCount}</p>
          <p class="text-sm">总任务: ${runtime.assignmentSummary.totalTasks}</p>
          <p class="text-sm text-orange-700">未分配: ${runtime.assignmentSummary.unassignedCount}</p>
        </article>

        <article class="rounded-lg border bg-card p-4">
          <h3 class="mb-2 text-sm font-medium text-muted-foreground">分配进度</h3>
          ${renderBadge(
            assignmentProgressStatusConfig[runtime.assignmentProgress.status].label,
            assignmentProgressStatusConfig[runtime.assignmentProgress.status].color,
          )}
          <p class="mt-2 text-xs text-muted-foreground">已派单: ${runtime.assignmentProgress.directAssignedCount}</p>
          <p class="text-xs text-muted-foreground">已发起竞价: ${runtime.assignmentProgress.biddingLaunchedCount}</p>
          <p class="text-xs text-muted-foreground">已中标: ${runtime.assignmentProgress.biddingAwardedCount}</p>
        </article>

        <article class="rounded-lg border bg-card p-4">
          <h3 class="mb-2 text-sm font-medium text-muted-foreground">领料状态</h3>
          ${renderBadge(detailMaterialStatus.label, detailMaterialStatus.badgeClass)}
          <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(detailMaterialStatus.hint)}</p>
          <p class="text-xs text-muted-foreground">草稿 ${detailMaterialSummary.totalDraftCount} · 已确认 ${detailMaterialSummary.createdCount}</p>
          <button
            class="mt-2 inline-flex h-7 items-center rounded-md border px-2.5 text-xs hover:bg-muted"
            data-prod-action="open-material-draft-drawer"
            data-order-id="${escapeHtml(order.productionOrderId)}"
          >${detailMaterialSummary.pendingCount > 0 ? '去确认领料' : '查看领料草稿'}</button>
        </article>
      </section>

      ${renderOrderDetailTabButtons(state.detailTab)}
      ${renderOrderDetailTabContent(order)}

      ${renderMaterialDraftDrawer()}
      ${renderDetailLogsDialog(order)}
      ${renderDetailSimulateDialog(order)}
      ${renderDetailSimulateConfirmDialog(order)}
    </div>
  `
}
function resetDemandGenerateForm(): void {
  state.demandSelectedFactoryId = ''
  state.demandTierFilter = 'ALL'
  state.demandTypeFilter = 'ALL'
  state.demandFactorySearch = ''
  state.demandShowAdvanced = false
  state.demandOwnerPartyManual = false
  state.demandOwnerPartyType = 'FACTORY'
  state.demandOwnerPartyId = ''
  state.demandOwnerReason = ''
}

function openDemandBatchGenerate(): void {
  resetDemandGenerateForm()
  state.demandBatchDialogOpen = true
  state.demandSingleGenerateId = null
}

function openDemandSingleGenerate(demandId: string): void {
  resetDemandGenerateForm()
  state.demandSingleGenerateId = demandId
  state.demandBatchDialogOpen = false
}

function performDemandGenerate(): void {
  const factory = indonesiaFactories.find((item) => item.id === state.demandSelectedFactoryId)
  if (!factory) return

  const demandIds = state.demandSingleGenerateId
    ? [state.demandSingleGenerateId]
    : getBatchGeneratableDemandIds()

  if (demandIds.length === 0) {
    state.demandGenerateConfirmOpen = false
    return
  }

  const now = toTimestamp()
  const newOrders: ProductionOrder[] = []

  for (const demandId of demandIds) {
    const demand = state.demands.find((item) => item.demandId === demandId)
    if (!demand) continue
    const techPack = getTechPackSnapshotForDemand(demand)
    if (
      demand.hasProductionOrder ||
      demand.demandStatus !== 'PENDING_CONVERT' ||
      techPack.status !== 'RELEASED'
    ) {
      continue
    }

    const orderId = nextProductionOrderId([...state.orders, ...newOrders])
    const initialStatus: ProductionOrderStatus = 'READY_FOR_BREAKDOWN'

    const ownerPartyType: DemandOwnerPartyType = state.demandOwnerPartyManual
      ? state.demandOwnerPartyType
      : 'FACTORY'

    const ownerPartyId =
      state.demandOwnerPartyManual && state.demandOwnerPartyType === 'LEGAL_ENTITY'
        ? state.demandOwnerPartyId
        : factory.id

    const riskFlags: RiskFlag[] = []
    if (ownerPartyType !== 'FACTORY' || ownerPartyId !== factory.id) {
      riskFlags.push('OWNER_ADJUSTED')
    }

    const auditLogs: AuditLog[] = [
      {
        id: nextLocalEntityId('LOG'),
        action: 'CREATE',
        detail: `从需求 ${demand.demandId} 生成生产单`,
        at: now,
        by: currentUser.name,
      },
    ]

    const order: ProductionOrder = {
      productionOrderId: orderId,
      demandId: demand.demandId,
      legacyOrderNo: demand.legacyOrderNo,
      status: initialStatus,
      lockedLegacy: false,
      mainFactoryId: factory.id,
      mainFactorySnapshot: {
        id: factory.id,
        code: factory.code,
        name: factory.name,
        tier: factory.tier,
        type: factory.type,
        status: factory.status,
        province: factory.province,
        city: factory.city,
        tags: [...factory.tags],
      },
      ownerPartyType,
      ownerPartyId: ownerPartyId || factory.id,
      ownerReason: state.demandOwnerReason.trim() || undefined,
      techPackSnapshot: {
        status: toOrderTechPackStatus(techPack.status),
        versionLabel: normalizeTechPackVersionLabel(techPack.status, techPack.versionLabel),
        snapshotAt: now,
      },
      demandSnapshot: {
        demandId: demand.demandId,
        spuCode: demand.spuCode,
        spuName: demand.spuName,
        priority: demand.priority,
        requiredDeliveryDate: demand.requiredDeliveryDate,
        constraintsNote: demand.constraintsNote,
        skuLines: demand.skuLines.map((sku) => ({ ...sku })),
      },
      assignmentSummary: {
        directCount: 0,
        biddingCount: 0,
        totalTasks: 0,
        unassignedCount: 0,
      },
      assignmentProgress: {
        status: 'NOT_READY',
        directAssignedCount: 0,
        biddingLaunchedCount: 0,
        biddingAwardedCount: 0,
      },
      biddingSummary: {
        activeTenderCount: 0,
        overdueTenderCount: 0,
      },
      directDispatchSummary: {
        assignedFactoryCount: 0,
        rejectedCount: 0,
        overdueAckCount: 0,
      },
      taskBreakdownSummary: {
        isBrokenDown: false,
        taskTypesTop3: [],
      },
      riskFlags,
      planStatus: 'UNPLANNED',
      deliveryWarehouseStatus: 'UNSET',
      lifecycleStatus: deriveLifecycleStatus({
        ...productionOrders[0],
        status: initialStatus,
        lifecycleStatus: undefined,
      }),
      lifecycleUpdatedAt: now,
      lifecycleUpdatedBy: currentUser.name,
      auditLogs,
      createdAt: now,
      updatedAt: now,
    }

    newOrders.push(order)
  }

  if (newOrders.length === 0) {
    state.demandGenerateConfirmOpen = false
    return
  }

  const generatedMap = new Map(newOrders.map((order) => [order.demandId, order.productionOrderId]))

  state.orders = [...state.orders, ...newOrders]
  state.demands = state.demands.map((demand) => {
    const orderId = generatedMap.get(demand.demandId)
    if (!orderId) return demand

    return {
      ...demand,
      hasProductionOrder: true,
      productionOrderId: orderId,
      demandStatus: 'CONVERTED',
      updatedAt: now,
    }
  })

  state.demandSelectedIds = new Set()
  state.demandGenerateConfirmOpen = false
  state.demandBatchDialogOpen = false
  state.demandSingleGenerateId = null
  resetDemandGenerateForm()

  if (newOrders.length === 1) {
    const created = newOrders[0]
    openAppRoute(
      `/fcs/production/orders/${created.productionOrderId}`,
      `po-${created.productionOrderId}`,
      `生产单管理 ${created.productionOrderId}`,
    )
  }
}

function updateProductionField(
  field: string,
  node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): void {
  const value = node.value
  const checked = node instanceof HTMLInputElement ? node.checked : false

  if (field.startsWith('materialDraftMode:')) {
    const [, draftId] = field.split(':')
    if (draftId && (value === 'warehouse_delivery' || value === 'factory_pickup')) {
      setMaterialDraftMode(draftId, value as MaterialMode, currentUser.name)
    }
    return
  }

  if (field.startsWith('materialDraftRemark:')) {
    const [, draftId] = field.split(':')
    if (draftId) {
      setMaterialDraftRemark(draftId, value, currentUser.name)
    }
    return
  }

  if (field.startsWith('materialDraftLineQty:')) {
    const [, draftId, lineId] = field.split(':')
    if (draftId && lineId) {
      const qty = Number(value)
      setMaterialDraftLineConfirmedQty(draftId, lineId, Number.isFinite(qty) ? qty : 0, currentUser.name)
    }
    return
  }

  if (field === 'demandKeyword') {
    state.demandKeyword = value
    return
  }

  if (field === 'demandStatusFilter') {
    state.demandStatusFilter = value as ProductionDemand['demandStatus'] | 'ALL'
    return
  }

  if (field === 'demandTechPackFilter') {
    state.demandTechPackFilter = value as ProductionDemand['techPackStatus'] | 'ALL'
    return
  }

  if (field === 'demandHasOrderFilter') {
    state.demandHasOrderFilter = value as 'ALL' | 'YES' | 'NO'
    return
  }

  if (field === 'demandPriorityFilter') {
    state.demandPriorityFilter = value as ProductionDemand['priority'] | 'ALL'
    return
  }

  if (field === 'demandOnlyUngenerated') {
    state.demandOnlyUngenerated = checked
    return
  }

  if (field === 'demandTierFilter') {
    state.demandTierFilter = value as FactoryTier | 'ALL'
    state.demandTypeFilter = 'ALL'
    state.demandSelectedFactoryId = ''
    return
  }

  if (field === 'demandTypeFilter') {
    state.demandTypeFilter = value as FactoryType | 'ALL'
    state.demandSelectedFactoryId = ''
    return
  }

  if (field === 'demandFactorySearch') {
    state.demandFactorySearch = value
    return
  }

  if (field === 'demandSelectedFactoryId') {
    state.demandSelectedFactoryId = value
    return
  }

  if (field === 'demandOwnerPartyManual') {
    state.demandOwnerPartyManual = checked
    return
  }

  if (field === 'demandOwnerPartyType') {
    state.demandOwnerPartyManual = true
    state.demandOwnerPartyType = value as DemandOwnerPartyType
    return
  }

  if (field === 'demandOwnerPartyId') {
    state.demandOwnerPartyId = value
    return
  }

  if (field === 'demandOwnerReason') {
    state.demandOwnerReason = value
    return
  }

  if (field === 'ordersKeyword') {
    state.ordersKeyword = value
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersStatusFilter') {
    state.ordersStatusFilter = value === 'ALL' ? [] : [value as ProductionOrderStatus]
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersTechPackFilter') {
    state.ordersTechPackFilter = value as ProductionState['ordersTechPackFilter']
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersBreakdownFilter') {
    state.ordersBreakdownFilter = value as ProductionState['ordersBreakdownFilter']
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersAssignmentProgressFilter') {
    state.ordersAssignmentProgressFilter = value as ProductionState['ordersAssignmentProgressFilter']
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersAssignmentModeFilter') {
    state.ordersAssignmentModeFilter = value as AssignmentModeFilter
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersBiddingRiskFilter') {
    state.ordersBiddingRiskFilter = value as BiddingRiskFilter
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersTierFilter') {
    state.ordersTierFilter = value as FactoryTier | 'ALL'
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersHasMaterialDraftFilter') {
    state.ordersHasMaterialDraftFilter = value as 'ALL' | 'YES' | 'NO'
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersHasConfirmedMaterialRequestFilter') {
    state.ordersHasConfirmedMaterialRequestFilter = value as 'ALL' | 'YES' | 'NO'
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'planKeyword') {
    state.planKeyword = value
    return
  }

  if (field === 'planStatusFilter') {
    state.planStatusFilter = value as ProductionState['planStatusFilter']
    return
  }

  if (field === 'planFactoryFilter') {
    state.planFactoryFilter = value
    return
  }

  if (field === 'planFormStartDate') {
    state.planForm.planStartDate = value
    return
  }

  if (field === 'planFormEndDate') {
    state.planForm.planEndDate = value
    return
  }

  if (field === 'planFormQty') {
    state.planForm.planQty = value
    return
  }

  if (field === 'planFormFactoryId') {
    state.planForm.planFactoryId = value
    const option = getPlanFactoryOptions().find((item) => item.id === value)
    state.planForm.planFactoryName = option?.name ?? ''
    return
  }

  if (field === 'planFormRemark') {
    state.planForm.planRemark = value
    return
  }

  if (field === 'deliveryKeyword') {
    state.deliveryKeyword = value
    return
  }

  if (field === 'deliveryStatusFilter') {
    state.deliveryStatusFilter = value as ProductionState['deliveryStatusFilter']
    return
  }

  if (field === 'deliveryFormWarehouseId') {
    state.deliveryForm.deliveryWarehouseId = value
    return
  }

  if (field === 'deliveryFormWarehouseName') {
    state.deliveryForm.deliveryWarehouseName = value
    return
  }

  if (field === 'deliveryFormWarehouseRemark') {
    state.deliveryForm.deliveryWarehouseRemark = value
    return
  }

  if (field === 'changesKeyword') {
    state.changesKeyword = value
    return
  }

  if (field === 'changesTypeFilter') {
    state.changesTypeFilter = value as 'ALL' | ProductionChangeType
    return
  }

  if (field === 'changesStatusFilter') {
    state.changesStatusFilter = value as 'ALL' | ProductionChangeStatus
    return
  }

  if (field === 'changesCreateProductionOrderId') {
    state.changesCreateForm.productionOrderId = value
    return
  }

  if (field === 'changesCreateType') {
    state.changesCreateForm.changeType = value as ProductionChangeType | ''
    return
  }

  if (field === 'changesCreateBeforeValue') {
    state.changesCreateForm.beforeValue = value
    return
  }

  if (field === 'changesCreateAfterValue') {
    state.changesCreateForm.afterValue = value
    return
  }

  if (field === 'changesCreateImpactScope') {
    state.changesCreateForm.impactScopeZh = value
    return
  }

  if (field === 'changesCreateReason') {
    state.changesCreateForm.reason = value
    return
  }

  if (field === 'changesCreateRemark') {
    state.changesCreateForm.remark = value
    return
  }

  if (field === 'changesStatusNext') {
    state.changesStatusForm.nextStatus = value as ProductionChangeStatus | ''
    state.changesStatusError = ''
    return
  }

  if (field === 'changesStatusRemark') {
    state.changesStatusForm.remark = value
    return
  }

  if (field === 'statusKeyword') {
    state.statusKeyword = value
    return
  }

  if (field === 'statusFilter') {
    state.statusFilter = value as 'ALL' | LifecycleStatus
    return
  }

  if (field === 'statusNext') {
    state.statusNext = value as '' | LifecycleStatus
    return
  }

  if (field === 'statusRemark') {
    state.statusRemark = value
    return
  }

  if (field === 'detailSimulateStatus') {
    state.detailSimulateStatus = value as ProductionOrderStatus
  }
}

export function handleProductionEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-prod-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.prodField
    if (!field) return true
    updateProductionField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-prod-action]')
  if (!actionNode) {
    if (state.ordersActionMenuId && !target.closest('[data-prod-orders-menu-root]')) {
      state.ordersActionMenuId = null
      return true
    }
    return false
  }

  const action = actionNode.dataset.prodAction
  if (!action) return false

  if (action === 'close-dialog') {
    closeAllProductionDialogs()
    return true
  }

  if (action === 'noop') {
    return true
  }

  if (action === 'open-tech-pack') {
    const spuCode = actionNode.dataset.spuCode
    if (!spuCode) return true

    state.ordersActionMenuId = null
    openAppRoute(`/fcs/tech-pack/${spuCode}`, `tech-pack-${spuCode}`, `技术包 - ${spuCode}`)
    return true
  }

  if (action === 'open-tech-pack-from-demand-detail') {
    const spuCode = actionNode.dataset.spuCode
    if (!spuCode) return true

    openAppRoute(`/fcs/tech-pack/${spuCode}`, `tech-pack-${spuCode}`, `技术包 - ${spuCode}`)
    state.demandDetailId = null
    return true
  }

  if (action === 'open-order-detail') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    state.ordersActionMenuId = null
    openAppRoute(`/fcs/production/orders/${orderId}`, `po-${orderId}`, `生产单管理 ${orderId}`)
    return true
  }

  if (action === 'open-material-draft-drawer') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId = null
    state.materialDraftOrderId = orderId
    state.materialDraftAddDraftId = null
    state.materialDraftAddSelections = new Set<string>()
    return true
  }

  if (action === 'close-material-draft-drawer') {
    state.materialDraftOrderId = null
    state.materialDraftAddDraftId = null
    state.materialDraftAddSelections = new Set<string>()
    return true
  }

  if (action === 'toggle-material-draft-needed') {
    const draftId = actionNode.dataset.draftId
    if (!draftId || !(actionNode instanceof HTMLInputElement)) return true
    setMaterialDraftNeedMaterial(draftId, actionNode.checked, currentUser.name)
    return true
  }

  if (action === 'toggle-material-draft-line') {
    const draftId = actionNode.dataset.draftId
    const lineId = actionNode.dataset.lineId
    if (!draftId || !lineId || !(actionNode instanceof HTMLInputElement)) return true
    toggleMaterialDraftLine(draftId, lineId, actionNode.checked, currentUser.name)
    return true
  }

  if (action === 'open-add-draft-materials') {
    const draftId = actionNode.dataset.draftId
    if (!draftId) return true
    state.materialDraftAddDraftId = draftId
    state.materialDraftAddSelections = new Set<string>()
    return true
  }

  if (action === 'close-add-draft-materials') {
    state.materialDraftAddDraftId = null
    state.materialDraftAddSelections = new Set<string>()
    return true
  }

  if (action === 'toggle-add-draft-material') {
    const optionKey = actionNode.dataset.optionKey
    if (!optionKey) return true
    const next = new Set(state.materialDraftAddSelections)
    if (next.has(optionKey)) {
      next.delete(optionKey)
    } else {
      next.add(optionKey)
    }
    state.materialDraftAddSelections = next
    return true
  }

  if (action === 'add-draft-materials') {
    const draftId = state.materialDraftAddDraftId
    if (!draftId) return true
    const added = addMaterialToDraft(draftId, [...state.materialDraftAddSelections], currentUser.name)
    if (added <= 0) {
      showPlanMessage('未选择可补充物料', 'error')
      return true
    }
    showPlanMessage(`已补充 ${added} 条物料`)
    state.materialDraftAddDraftId = null
    state.materialDraftAddSelections = new Set<string>()
    return true
  }

  if (action === 'restore-material-draft-suggestion') {
    const draftId = actionNode.dataset.draftId
    if (!draftId) return true
    restoreMaterialDraftSuggestion(draftId, currentUser.name)
    showPlanMessage('已恢复系统建议')
    return true
  }

  if (action === 'confirm-material-request-draft') {
    const draftId = actionNode.dataset.draftId
    if (!draftId) return true

    const result = confirmMaterialRequestDraft(draftId, { id: currentUser.id, name: currentUser.name })
    if (!result.ok) {
      showPlanMessage(`创建失败：${result.reason}`, 'error')
      return true
    }

    showPlanMessage(`领料需求已创建：${result.request.materialRequestNo}`)
    return true
  }

  if (action === 'copy-demand-legacy') {
    const legacyNo = actionNode.dataset.legacyNo
    if (!legacyNo) return true

    try {
      if (navigator?.clipboard?.writeText) {
        void navigator.clipboard.writeText(legacyNo)
      }
    } catch {
      // ignore clipboard errors
    }

    return true
  }

  if (action === 'toggle-demand-only-ungenerated') {
    state.demandOnlyUngenerated = !state.demandOnlyUngenerated
    return true
  }

  if (action === 'query-demand') {
    return true
  }

  if (action === 'toggle-demand-select-all') {
    const filteredDemands = getFilteredDemands()
    const shouldClear =
      filteredDemands.length > 0 &&
      filteredDemands.every((demand) => state.demandSelectedIds.has(demand.demandId))

    if (shouldClear) {
      state.demandSelectedIds = new Set()
    } else {
      state.demandSelectedIds = new Set(filteredDemands.map((demand) => demand.demandId))
    }
    return true
  }

  if (action === 'toggle-demand-select') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true

    const next = new Set(state.demandSelectedIds)
    if (next.has(demandId)) {
      next.delete(demandId)
    } else {
      next.add(demandId)
    }
    state.demandSelectedIds = next
    return true
  }

  if (action === 'open-demand-detail') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true
    state.demandDetailId = demandId
    return true
  }

  if (action === 'close-demand-detail') {
    state.demandDetailId = null
    return true
  }

  if (action === 'open-demand-batch') {
    openDemandBatchGenerate()
    return true
  }

  if (action === 'open-demand-single') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true
    openDemandSingleGenerate(demandId)
    return true
  }

  if (action === 'close-demand-generate') {
    state.demandBatchDialogOpen = false
    state.demandSingleGenerateId = null
    state.demandGenerateConfirmOpen = false
    return true
  }

  if (action === 'toggle-demand-advanced') {
    state.demandShowAdvanced = !state.demandShowAdvanced
    return true
  }

  if (action === 'open-demand-generate-confirm') {
    state.demandGenerateConfirmOpen = true
    return true
  }

  if (action === 'close-demand-generate-confirm') {
    state.demandGenerateConfirmOpen = false
    return true
  }

  if (action === 'confirm-demand-generate') {
    performDemandGenerate()
    return true
  }

  if (action === 'reset-demand-filters') {
    state.demandKeyword = ''
    state.demandStatusFilter = 'ALL'
    state.demandTechPackFilter = 'ALL'
    state.demandHasOrderFilter = 'ALL'
    state.demandPriorityFilter = 'ALL'
    state.demandOnlyUngenerated = false
    return true
  }

  if (action === 'hold-demand' || action === 'unhold-demand' || action === 'cancel-demand') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true

    const targetStatus: ProductionDemand['demandStatus'] =
      action === 'hold-demand' ? 'HOLD' : action === 'unhold-demand' ? 'PENDING_CONVERT' : 'CANCELLED'

    state.demands = state.demands.map((demand) => {
      if (demand.demandId !== demandId) return demand
      return {
        ...demand,
        demandStatus: targetStatus,
        updatedAt: toTimestamp(),
      }
    })

    return true
  }

  if (action === 'refresh-demand') {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
    return true
  }

  if (action === 'reset-orders-filters') {
    state.ordersKeyword = ''
    state.ordersStatusFilter = []
    state.ordersTechPackFilter = 'ALL'
    state.ordersBreakdownFilter = 'ALL'
    state.ordersAssignmentProgressFilter = 'ALL'
    state.ordersAssignmentModeFilter = 'ALL'
    state.ordersBiddingRiskFilter = 'ALL'
    state.ordersTierFilter = 'ALL'
    state.ordersHasMaterialDraftFilter = 'ALL'
    state.ordersHasConfirmedMaterialRequestFilter = 'ALL'
    state.ordersCurrentPage = 1
    state.ordersSelectedIds = new Set()
    state.ordersActionMenuId = null
    return true
  }

  if (action === 'query-orders') {
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return true
  }

  if (action === 'apply-material-reminder-filter') {
    const targetFilter = actionNode.dataset.target
    if (targetFilter === 'no_draft') {
      state.ordersHasMaterialDraftFilter = 'NO'
      state.ordersHasConfirmedMaterialRequestFilter = 'ALL'
    } else if (targetFilter === 'pending') {
      state.ordersHasMaterialDraftFilter = 'YES'
      state.ordersHasConfirmedMaterialRequestFilter = 'NO'
    } else if (targetFilter === 'confirmed') {
      state.ordersHasMaterialDraftFilter = 'ALL'
      state.ordersHasConfirmedMaterialRequestFilter = 'YES'
    }
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return true
  }

  if (action === 'switch-orders-view') {
    const view = actionNode.dataset.view as OrderViewMode | undefined
    if (view === 'table' || view === 'board') {
      state.ordersViewMode = view
      state.ordersActionMenuId = null

      if (view === 'board' && typeof window !== 'undefined') {
        window.alert('Board视图 - 占位')
      }
    }
    return true
  }

  if (action === 'toggle-orders-more-menu') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId =
      state.ordersActionMenuId === orderId ? null : orderId
    return true
  }

  if (action === 'orders-prev-page') {
    state.ordersCurrentPage = Math.max(1, state.ordersCurrentPage - 1)
    state.ordersActionMenuId = null
    return true
  }

  if (action === 'orders-next-page') {
    const totalPages = Math.max(1, Math.ceil(getFilteredOrders().length / PAGE_SIZE))
    state.ordersCurrentPage = Math.min(totalPages, state.ordersCurrentPage + 1)
    state.ordersActionMenuId = null
    return true
  }

  if (action === 'toggle-orders-select-all') {
    const paged = getPaginatedOrders(getFilteredOrders())
    const shouldClear = paged.length > 0 && paged.every((order) => state.ordersSelectedIds.has(order.productionOrderId))

    if (shouldClear) {
      state.ordersSelectedIds = new Set()
    } else {
      state.ordersSelectedIds = new Set(paged.map((order) => order.productionOrderId))
    }

    return true
  }

  if (action === 'toggle-orders-select') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    const next = new Set(state.ordersSelectedIds)
    if (next.has(orderId)) next.delete(orderId)
    else next.add(orderId)
    state.ordersSelectedIds = next
    return true
  }

  if (action === 'open-orders-demand-snapshot') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId = null
    state.ordersDemandSnapshotId = orderId
    return true
  }

  if (action === 'close-orders-demand-snapshot') {
    state.ordersDemandSnapshotId = null
    return true
  }

  if (action === 'open-orders-logs') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId = null
    state.ordersLogsId = orderId
    return true
  }

  if (action === 'close-orders-logs') {
    state.ordersLogsId = null
    return true
  }

  if (action === 'open-orders-dispatch-center') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId = null
    openAppRoute(`/fcs/dispatch/board?po=${orderId}`, `dispatch-center-${orderId}`, '任务分配')
    return true
  }

  if (action === 'open-orders-dispatch-board') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId = null
    openAppRoute(`/fcs/dispatch/board?po=${orderId}`, `dispatch-board-${orderId}`, '分配看板')
    return true
  }

  if (action === 'orders-refresh') {
    state.ordersActionMenuId = null
    if (typeof window !== 'undefined') window.location.reload()
    return true
  }

  if (action === 'orders-export') {
    state.ordersActionMenuId = null
    if (typeof window !== 'undefined') window.alert('导出 - 占位')
    return true
  }

  if (action === 'orders-from-demand') {
    state.ordersActionMenuId = null
    if (typeof window !== 'undefined') window.alert('从需求生成 - 占位')
    return true
  }

  if (action === 'open-plan-edit') {
    const orderId = actionNode.dataset.orderId
    const order = state.orders.find((item) => item.productionOrderId === orderId)
    if (!order) return true

    state.planEditOrderId = order.productionOrderId
    state.planForm = {
      planStartDate: order.planStartDate ?? '',
      planEndDate: order.planEndDate ?? '',
      planQty: order.planQty != null ? String(order.planQty) : '',
      planFactoryId: order.planFactoryId ?? '',
      planFactoryName: order.planFactoryName ?? '',
      planRemark: order.planRemark ?? '',
    }

    return true
  }

  if (action === 'close-plan-edit') {
    state.planEditOrderId = null
    state.planForm = { ...PLAN_EMPTY_FORM }
    return true
  }

  if (action === 'save-plan-edit') {
    const orderId = state.planEditOrderId
    if (!orderId) return true

    if (!state.planForm.planStartDate) {
      showPlanMessage('保存失败：计划开始日期不能为空', 'error')
      return true
    }

    if (!state.planForm.planEndDate) {
      showPlanMessage('保存失败：计划结束日期不能为空', 'error')
      return true
    }

    const qty = Number(state.planForm.planQty)
    if (!Number.isFinite(qty) || qty <= 0) {
      showPlanMessage('保存失败：计划数量必须大于 0', 'error')
      return true
    }

    if (!state.planForm.planFactoryId) {
      showPlanMessage('保存失败：计划工厂不能为空', 'error')
      return true
    }

    if (state.planForm.planEndDate < state.planForm.planStartDate) {
      showPlanMessage('保存失败：计划结束日期不能早于开始日期', 'error')
      return true
    }

    const now = toTimestamp()

    state.orders = state.orders.map((order) => {
      if (order.productionOrderId !== orderId) return order
      const selectedFactory = getPlanFactoryOptions().find((item) => item.id === state.planForm.planFactoryId)
      return {
        ...order,
        planStartDate: state.planForm.planStartDate,
        planEndDate: state.planForm.planEndDate,
        planQty: qty,
        planFactoryId: state.planForm.planFactoryId,
        planFactoryName: state.planForm.planFactoryName || selectedFactory?.name || state.planForm.planFactoryId,
        planRemark: state.planForm.planRemark || undefined,
        planStatus: 'PLANNED',
        planUpdatedAt: now,
        planUpdatedBy: currentUser.name,
        updatedAt: now,
      }
    })

    state.planEditOrderId = null
    state.planForm = { ...PLAN_EMPTY_FORM }
    showPlanMessage('生产单计划已保存')
    return true
  }

  if (action === 'release-plan') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    const order = state.orders.find((item) => item.productionOrderId === orderId)
    if (!order) {
      showPlanMessage(`下发失败：生产单 ${orderId} 不存在`, 'error')
      return true
    }

    if (!order.planStartDate || !order.planEndDate || !order.planQty || !order.planFactoryId) {
      showPlanMessage('下发失败：请先完成生产单计划后再下发', 'error')
      return true
    }

    const now = toTimestamp()
    state.orders = state.orders.map((order) => {
      if (order.productionOrderId !== orderId) return order

      return {
        ...order,
        planStatus: 'RELEASED',
        planUpdatedAt: now,
        planUpdatedBy: currentUser.name,
        updatedAt: now,
      }
    })

    showPlanMessage('生产单计划已下发')
    return true
  }

  if (action === 'open-delivery-edit') {
    const orderId = actionNode.dataset.orderId
    const order = state.orders.find((item) => item.productionOrderId === orderId)
    if (!order) return true

    state.deliveryEditOrderId = order.productionOrderId
    state.deliveryForm = {
      productionOrderId: order.productionOrderId,
      deliveryWarehouseId: order.deliveryWarehouseId ?? '',
      deliveryWarehouseName: order.deliveryWarehouseName ?? '',
      deliveryWarehouseRemark: order.deliveryWarehouseRemark ?? '',
    }

    return true
  }

  if (action === 'close-delivery-edit') {
    state.deliveryEditOrderId = null
    state.deliveryForm = { ...DELIVERY_EMPTY_FORM }
    return true
  }

  if (action === 'save-delivery-edit') {
    const orderId = state.deliveryEditOrderId
    if (!orderId) return true

    const warehouseId = state.deliveryForm.deliveryWarehouseId.trim()
    if (!warehouseId) {
      showPlanMessage('交付仓ID不能为空', 'error')
      return true
    }

    const targetOrder = state.orders.find((item) => item.productionOrderId === orderId)
    if (!targetOrder) {
      showPlanMessage(`保存失败：生产单 ${orderId} 不存在`, 'error')
      return true
    }

    const now = toTimestamp()
    const warehouseName = state.deliveryForm.deliveryWarehouseName.trim() || warehouseId
    const warehouseRemark = state.deliveryForm.deliveryWarehouseRemark.trim() || undefined

    state.orders = state.orders.map((order) => {
      if (order.productionOrderId !== orderId) return order
      return {
        ...order,
        deliveryWarehouseId: warehouseId,
        deliveryWarehouseName: warehouseName,
        deliveryWarehouseRemark: warehouseRemark,
        deliveryWarehouseStatus: 'SET',
        deliveryWarehouseUpdatedAt: now,
        deliveryWarehouseUpdatedBy: currentUser.name,
        updatedAt: now,
      }
    })

    state.deliveryEditOrderId = null
    state.deliveryForm = { ...DELIVERY_EMPTY_FORM }
    showPlanMessage('交付仓配置已保存')
    return true
  }

  if (action === 'open-changes-create') {
    state.changesCreateOpen = true
    return true
  }

  if (action === 'close-changes-create') {
    state.changesCreateOpen = false
    return true
  }

  if (action === 'save-changes-create') {
    const errors: Record<string, string> = {}

    if (!state.changesCreateForm.productionOrderId) {
      errors.productionOrderId = '请选择生产单'
    }
    if (!state.changesCreateForm.changeType) {
      errors.changeType = '请选择变更类型'
    }
    if (!state.changesCreateForm.reason.trim()) {
      errors.reason = '变更原因不能为空'
    }

    state.changesCreateErrors = errors
    if (Object.keys(errors).length > 0) return true

    const targetOrder = state.orders.find(
      (order) => order.productionOrderId === state.changesCreateForm.productionOrderId,
    )
    if (!targetOrder) {
      showPlanMessage(`创建失败：生产单 ${state.changesCreateForm.productionOrderId} 不存在`, 'error')
      return true
    }

    const now = toTimestamp()
    const month = now.slice(0, 7).replace('-', '')
    const existingIds = new Set(state.changes.map((change) => change.changeId))
    const changeId = nextChangeId(month, existingIds)

    const changeType = state.changesCreateForm.changeType as ProductionChangeType

    const newChange: ProductionOrderChange = {
      changeId,
      productionOrderId: state.changesCreateForm.productionOrderId,
      changeType,
      beforeValue: state.changesCreateForm.beforeValue || undefined,
      afterValue: state.changesCreateForm.afterValue || undefined,
      impactScopeZh: state.changesCreateForm.impactScopeZh || undefined,
      reason: state.changesCreateForm.reason,
      remark: state.changesCreateForm.remark || undefined,
      status: 'DRAFT',
      createdAt: now,
      createdBy: currentUser.name,
    }

    state.changes = [...state.changes, newChange]
    state.changesCreateOpen = false
    state.changesCreateForm = { ...CHANGE_CREATE_EMPTY_FORM }
    state.changesCreateErrors = {}
    showPlanMessage(`生产单变更已创建：${changeId}`)
    return true
  }

  if (action === 'open-changes-status') {
    const changeId = actionNode.dataset.changeId
    const currentStatus = actionNode.dataset.currentStatus as ProductionChangeStatus | undefined

    if (!changeId || !currentStatus) return true

    state.changesStatusOpen = true
    state.changesStatusTarget = { changeId, currentStatus }
    state.changesStatusForm = { ...CHANGE_STATUS_EMPTY_FORM }
    state.changesStatusError = ''
    return true
  }

  if (action === 'close-changes-status') {
    state.changesStatusOpen = false
    return true
  }

  if (action === 'save-changes-status') {
    if (!state.changesStatusTarget || !state.changesStatusForm.nextStatus) {
      state.changesStatusError = '请选择目标状态'
      return true
    }

    const target = state.changes.find((change) => change.changeId === state.changesStatusTarget?.changeId)
    if (!target) {
      state.changesStatusError = `变更单 ${state.changesStatusTarget.changeId} 不存在`
      return true
    }

    const allowed = changeAllowedNext[target.status]
    if (!allowed.includes(state.changesStatusForm.nextStatus)) {
      state.changesStatusError = '当前变更状态不允许切换到目标状态'
      return true
    }

    const now = toTimestamp()

    state.changes = state.changes.map((change) => {
      if (change.changeId !== state.changesStatusTarget?.changeId) return change
      return {
        ...change,
        status: state.changesStatusForm.nextStatus as ProductionChangeStatus,
        remark: state.changesStatusForm.remark || change.remark,
        updatedAt: now,
        updatedBy: currentUser.name,
      }
    })

    state.changesStatusOpen = false
    state.changesStatusTarget = null
    state.changesStatusForm = { ...CHANGE_STATUS_EMPTY_FORM }
    state.changesStatusError = ''
    showPlanMessage('变更状态已更新')
    return true
  }

  if (action === 'open-status-change') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    state.statusDialogOpen = true
    state.statusSelectedOrderId = orderId
    state.statusNext = ''
    state.statusRemark = ''
    return true
  }

  if (action === 'close-status-change') {
    state.statusDialogOpen = false
    state.statusSelectedOrderId = null
    state.statusNext = ''
    state.statusRemark = ''
    return true
  }

  if (action === 'save-status-change') {
    if (!state.statusSelectedOrderId || !state.statusNext) {
      showPlanMessage('请选择目标状态', 'error')
      return true
    }

    const order = state.orders.find((item) => item.productionOrderId === state.statusSelectedOrderId)
    if (!order) {
      showPlanMessage(`变更失败：生产单 ${state.statusSelectedOrderId} 不存在`, 'error')
      return true
    }

    const currentLifecycle = deriveLifecycleStatus(order)
    if (!lifecycleAllowedNext[currentLifecycle].includes(state.statusNext)) {
      showPlanMessage('当前状态不允许切换到目标状态', 'error')
      return true
    }

    const now = toTimestamp()
    const nextStatus = state.statusNext as LifecycleStatus

    state.orders = state.orders.map((item) => {
      if (item.productionOrderId !== state.statusSelectedOrderId) return item

      return {
        ...item,
        lifecycleStatus: nextStatus,
        lifecycleStatusRemark: state.statusRemark.trim() || undefined,
        lifecycleUpdatedAt: now,
        lifecycleUpdatedBy: currentUser.name,
        updatedAt: now,
      }
    })

    state.statusDialogOpen = false
    state.statusSelectedOrderId = null
    state.statusNext = ''
    state.statusRemark = ''
    showPlanMessage('生产单状态已更新')
    return true
  }

  if (action === 'detail-switch-tab') {
    const tab = actionNode.dataset.tab as OrderDetailTab | undefined
    if (!tab) return true
    state.detailTab = tab
    return true
  }

  if (action === 'detail-open-logs') {
    state.detailLogsOpen = true
    return true
  }

  if (action === 'detail-close-logs') {
    state.detailLogsOpen = false
    return true
  }

  if (action === 'detail-open-simulate') {
    const order = getOrderById(state.detailCurrentOrderId)
    if (!order) return true
    state.detailSimulateStatus = order.status
    state.detailSimulateOpen = true
    return true
  }

  if (action === 'detail-close-simulate') {
    state.detailSimulateOpen = false
    return true
  }

  if (action === 'detail-open-simulate-confirm') {
    state.detailConfirmSimulateOpen = true
    return true
  }

  if (action === 'detail-close-simulate-confirm') {
    state.detailConfirmSimulateOpen = false
    return true
  }

  if (action === 'detail-apply-simulate') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    const now = toTimestamp()
    const targetStatus = state.detailSimulateStatus
    const lockedStatuses: ProductionOrderStatus[] = ['EXECUTING', 'COMPLETED', 'CANCELLED']

    state.orders = state.orders.map((order) => {
      if (order.productionOrderId !== orderId) return order

      const auditLog: AuditLog = {
        id: nextLocalEntityId('LOG', 4),
        action: 'STATUS_SIMULATE',
        detail: `状态模拟从 ${productionOrderStatusConfig[order.status].label} 变更为 ${productionOrderStatusConfig[targetStatus].label}`,
        at: now,
        by: currentUser.name,
      }

      return {
        ...order,
        status: targetStatus,
        lockedLegacy: lockedStatuses.includes(targetStatus),
        updatedAt: now,
        auditLogs: [...order.auditLogs, auditLog],
      }
    })

    state.detailConfirmSimulateOpen = false
    state.detailSimulateOpen = false
    return true
  }

  return false
}

export function handleProductionSubmit(_form: HTMLFormElement): boolean {
  return false
}

export function isProductionDialogOpen(): boolean {
  return (
    state.demandDetailId !== null ||
    state.demandBatchDialogOpen ||
    state.demandSingleGenerateId !== null ||
    state.demandGenerateConfirmOpen ||
    state.ordersDemandSnapshotId !== null ||
    state.ordersLogsId !== null ||
    state.materialDraftOrderId !== null ||
    state.materialDraftAddDraftId !== null ||
    state.planEditOrderId !== null ||
    state.deliveryEditOrderId !== null ||
    state.changesCreateOpen ||
    state.changesStatusOpen ||
    state.statusDialogOpen ||
    state.detailLogsOpen ||
    state.detailSimulateOpen ||
    state.detailConfirmSimulateOpen
  )
}
