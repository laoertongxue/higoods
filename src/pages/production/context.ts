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
  cloneProductionLedgerDetails,
  productionOrderStatusConfig,
  assignmentProgressStatusConfig,
  riskFlagConfig,
  formatProductionOrderMainFactoryName,
  isProductionOrderMainFactoryPending,
} from '../../data/fcs/production-orders'
import {
  indonesiaFactories,
  type FactoryTier,
  type FactoryType,
  typesByTier,
  tierLabels,
  typeLabels,
} from '../../data/fcs/indonesia-factories'
import { legalEntities } from '../../data/fcs/legal-entities'
import {
  cloneProductionOrderTechPackSnapshot,
  getDemandCurrentTechPackInfo,
  listPublishedTechPackVersionOptionsForDemand,
} from '../../data/fcs/production-tech-pack-snapshot-builder'
import {
  getTechnicalDataVersionById,
  listTechnicalDataVersions,
} from '../../data/pcs-technical-data-version-repository'
import {
  getRuntimeAssignmentSummaryByOrder,
  getRuntimeBiddingSummaryByOrder,
  getRuntimeOrderOutputValueTotal,
  getRuntimeTaskById,
  getRuntimeTaskCountByOrder,
  listRuntimeExecutionTasksByOrder,
  listRuntimeTaskSplitGroupsByOrder,
  listRuntimeTasksByOrder,
  type RuntimeProcessTask,
  type RuntimeTaskSplitGroupSnapshot,
} from '../../data/fcs/runtime-process-tasks'
import {
  recordTaskGenerationPreview,
  resolveTaskOutputValueSnapshot,
} from '../../data/fcs/process-tasks'
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
} from '../../data/fcs/store-domain-settlement-seeds'
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
import {
  getMaterialPrepBreakdownReadinessForOrder as getMaterialPrepBreakdownReadinessForOrderRaw,
  type MaterialPrepBreakdownReadiness,
} from '../../data/fcs/cutting/production-material-prep'
import {
  buildBatchTaskGenerationPreview,
  type ProductionTaskGenerationPreview,
} from '../../data/fcs/production-task-generation-rules.ts'
import {
  createEmptyMaterialReplacementDraft,
  type MaterialReplacementDraft,
  type ProductionChangeExecutionStep,
  type ProductionChangeType,
  type QuantityChangeLine,
} from '../../data/fcs/production-order-change-workflow.ts'

applyQualitySeedBootstrap()

const PAGE_SIZE = 10

type OrderViewMode = 'table' | 'board'
type OrderDetailTab = 'overview' | 'demand-snapshot' | 'tech-pack' | 'assignment' | 'post-finishing' | 'handover' | 'logs'
type AssignmentModeFilter = 'ALL' | 'DIRECT_ONLY' | 'BIDDING_ONLY' | 'MIXED'
type BiddingRiskFilter = 'ALL' | 'OVERDUE' | 'NEAR_DEADLINE' | 'NONE'
type OrderMaterialStageFilter = 'ALL' | 'PREVIEW' | 'ACTUAL_PENDING' | 'ACTUAL_CONFIRMED'

type DemandOwnerPartyType = 'FACTORY' | 'LEGAL_ENTITY'

interface TaskGenerationPreviewState {
  mode: 'single' | 'batch'
  orderIds: string[]
  previews: ProductionTaskGenerationPreview[]
}

type TechPackChangeDetailTab =
  | 'relation'
  | 'diff'
  | 'progress'
  | 'restriction'
  | 'module-landing'
  | 'patch'
  | 'notice'
  | 'logs'

type ProductionChangeListTab = 'change-orders' | 'candidate-orders'
type ProductionChangeDetailTab = 'content' | 'impact' | 'documents' | 'cost' | 'timing' | 'records'
type ProductionChangeFormStep = 'order' | 'content' | 'handling' | 'execution'
type ProductionChangeFormType = ProductionChangeType

interface ProductionChangeForm {
  changeType: ProductionChangeFormType
  productionOrderId: string
  reason: string
  quantityLines: QuantityChangeLine[]
  materialReplacement: MaterialReplacementDraft
  decisionValues: Record<string, { value: string; reason: string }>
  advancedAllocationOpen: boolean
  execution: {
    status: 'IDLE' | 'RUNNING' | 'DONE' | 'ROLLED_BACK'
    message: string
    progress: number
    steps: ProductionChangeExecutionStep[]
  }
}

function createIdleExecutionState(): ProductionChangeForm['execution'] {
  return {
    status: 'IDLE',
    message: '',
    progress: 0,
    steps: [],
  }
}

export function createProductionChangeForm(): ProductionChangeForm {
  return {
    changeType: 'QUANTITY_CHANGE',
    productionOrderId: '',
    reason: '',
    quantityLines: [],
    materialReplacement: createEmptyMaterialReplacementDraft(),
    decisionValues: {},
    advancedAllocationOpen: false,
    execution: createIdleExecutionState(),
  }
}

interface TechPackVersionChangeForm {
  targetVersionId: string
  reason: string
  effectiveMode: string
  note: string
  confirmed: boolean
}

interface ProductionPatchForm {
  patchType: string
  color: string
  targetColor: string
  size: string
  material: string
  targetMaterial: string
  usageValue: string
  targetUsageValue: string
  part: string
  processNode: string
  processFrom: string
  processTo: string
  factory: string
  cutOrder: string
  markerPlan: string
  spreadingOrder: string
  processOrder: string
  patternFile: string
  targetPatternFile: string
  sizeRule: string
  targetSizeRule: string
  colorMaterialMapping: string
  targetColorMaterialMapping: string
  costItem: string
  targetCostValue: string
  artworkFile: string
  targetArtworkFile: string
  effectivePoint: string
  reason: string
  contentText: string
}

interface ProductionState {
  demands: ProductionDemand[]
  orders: ProductionOrder[]

  demandKeyword: string
  demandStatusFilter: ProductionDemand['demandStatus'] | 'ALL'
  demandTechPackFilter: ProductionDemand['techPackStatus'] | 'ALL'
  demandHasOrderFilter: 'ALL' | 'YES' | 'NO'
  demandPriorityFilter: ProductionDemand['priority'] | 'ALL'
  demandOnlyUngenerated: boolean
  demandCurrentPage: number
  demandSelectedIds: Set<string>
  demandDetailId: string | null
  demandBatchDialogOpen: boolean
  demandBatchGenerateMode: 'batch' | 'merge'
  demandSingleGenerateId: string | null
  demandGenerateConfirmOpen: boolean
  demandGenerateTechPackVersionId: string
  demandGenerateTechPackVersionIds: Record<string, string>
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
  ordersTechPackSnapshotDialogId: string | null
  ordersLogsId: string | null
  ordersActionMenuId: string | null
  ordersBreakdownReadinessOrderId: string | null
  taskGenerationPreview: TaskGenerationPreviewState | null
  ordersFromDemandDialogOpen: boolean
  ordersFromDemandSelectedIds: Set<string>
  materialDraftOrderId: string | null
  materialDraftAddDraftId: string | null
  materialDraftAddSelections: Set<string>
  ordersViewMode: OrderViewMode

  techPackChangeKeyword: string
  techPackChangeCurrentVersionFilter: 'ALL' | string
  techPackChangeNewVersionFilter: 'ALL' | 'YES' | 'NO'
  techPackChangePatchFilter: 'ALL' | 'ACTIVE' | 'PENDING' | 'NONE'
  techPackChangeStatusFilter: 'ALL' | string
  techPackChangeModuleFilter: 'ALL' | string
  techPackChangeProgressFilter: 'ALL' | string
  techPackChangeOwnerFilter: 'ALL' | string
  productionChangeOrderPage: number
  productionChangeSelectedOrderId: string
  productionChangeListTab: ProductionChangeListTab
  productionChangeDetailTab: ProductionChangeDetailTab
  productionChangeFormStep: ProductionChangeFormStep
  productionChangeForm: ProductionChangeForm
  productionChangeFormError: string
  techPackChangeDetailTab: TechPackChangeDetailTab
  techPackChangeVersionDialogOrderId: string | null
  techPackChangeVersionForm: TechPackVersionChangeForm
  techPackChangeVersionError: string
  productionPatchDialogOrderId: string | null
  productionPatchForm: ProductionPatchForm
  productionPatchError: string
  techPackChangePublishGuideOpen: boolean
  techPackChangePublishGuideBatchId: string
  techPackChangePublishIgnoreReason: string
  techPackChangeModuleLandingId: string

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

const TECH_PACK_VERSION_CHANGE_EMPTY_FORM: TechPackVersionChangeForm = {
  targetVersionId: '',
  reason: '',
  effectiveMode: 'IMMEDIATE_AFTER_APPROVAL',
  note: '',
  confirmed: false,
}

const PRODUCTION_PATCH_EMPTY_FORM: ProductionPatchForm = {
  patchType: 'MATERIAL_REPLACEMENT',
  color: '',
  targetColor: '',
  size: '',
  material: '',
  targetMaterial: '',
  usageValue: '',
  targetUsageValue: '',
  part: '',
  processNode: '',
  processFrom: '',
  processTo: '',
  factory: '',
  cutOrder: '',
  markerPlan: '',
  spreadingOrder: '',
  processOrder: '',
  patternFile: '',
  targetPatternFile: '',
  sizeRule: '',
  targetSizeRule: '',
  colorMaterialMapping: '',
  targetColorMaterialMapping: '',
  costItem: '',
  targetCostValue: '',
  artworkFile: '',
  targetArtworkFile: '',
  effectivePoint: 'FROM_NOW',
  reason: '',
  contentText: '',
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
    mainFactorySnapshots: order.mainFactorySnapshots?.map((factory) => ({
      ...factory,
      tags: [...factory.tags],
    })),
    techPackSnapshot: cloneProductionOrderTechPackSnapshot(order.techPackSnapshot),
    demandSnapshot: {
      ...order.demandSnapshot,
      skuLines: order.demandSnapshot.skuLines.map((sku) => ({ ...sku })),
    },
    sourceDemandIds: [...(order.sourceDemandIds ?? [order.demandId])],
    sourceDemandSnapshots: (order.sourceDemandSnapshots ?? [order.demandSnapshot]).map((snapshot) => ({
      ...snapshot,
      skuLines: snapshot.skuLines.map((sku) => ({ ...sku })),
    })),
    assignmentSummary: { ...order.assignmentSummary },
    assignmentProgress: { ...order.assignmentProgress },
    biddingSummary: { ...order.biddingSummary },
    directDispatchSummary: { ...order.directDispatchSummary },
    taskBreakdownSummary: {
      ...order.taskBreakdownSummary,
      taskTypesTop3: [...order.taskBreakdownSummary.taskTypesTop3],
    },
    ledgerDetails: cloneProductionLedgerDetails(order.ledgerDetails),
    riskFlags: [...order.riskFlags],
    auditLogs: order.auditLogs.map((log) => ({ ...log })),
  }
}

function toTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

let productionCoreLocalSeq = 0
const materialPrepBreakdownReadinessCache = new Map<string, MaterialPrepBreakdownReadiness>()

function nextLocalEntityId(prefix: string, width = 6): string {
  productionCoreLocalSeq += 1
  return `${prefix}-${String(productionCoreLocalSeq).padStart(width, '0')}`
}

function getMaterialPrepBreakdownReadinessForOrder(productionOrderIdOrNo: string): MaterialPrepBreakdownReadiness {
  const cached = materialPrepBreakdownReadinessCache.get(productionOrderIdOrNo)
  if (cached) return cached
  const readiness = getMaterialPrepBreakdownReadinessForOrderRaw(productionOrderIdOrNo)
  materialPrepBreakdownReadinessCache.set(productionOrderIdOrNo, readiness)
  return readiness
}

function clearMaterialPrepBreakdownReadinessCache(): void {
  materialPrepBreakdownReadinessCache.clear()
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

const spuImageFallbacks: Array<{ keywords: string[]; url: string }> = [
  { keywords: ['jacket', 'hoodie', 'blazer', 'jaket', 'outerwear', '夹克', '外套', '卫衣', '西装'], url: '/jacket-sample.jpg' },
  { keywords: ['dress', 'skirt', 'rok', '裙', '连衣裙'], url: '/dress-sample-1.jpg' },
  { keywords: ['pants', 'celana', 'jogger', 'shorts', '裤'], url: '/pants-sample.jpg' },
  { keywords: ['cardigan', 'knit', 'sweater', '针织', '开衫', '毛衣'], url: '/cardigan-sample.jpg' },
  { keywords: ['shirt', 'kemeja', 'polo', 't-shirt', 'tshirt', 'kaos', '衬衫', '短袖', 't 恤', 't恤'], url: '/tshirt-sample.jpg' },
]

const spuImageByCode: Record<string, string> = {
  'SPU-2024-001': '/shirt-sample.jpg',
  'SPU-2024-002': '/dress-sample-1.jpg',
  'SPU-2024-003': '/pants-sample.jpg',
  'SPU-2024-004': '/tshirt-sample.jpg',
  'SPU-2024-005': '/jacket-sample.jpg',
  'SPU-2024-006': '/dress-sample-1.jpg',
  'SPU-2024-007': '/jacket-sample.jpg',
  'SPU-2024-008': '/shirt-sample.jpg',
  'SPU-2024-009': '/tshirt-sample.jpg',
  'SPU-2024-010': '/pants-sample.jpg',
  'SPU-2024-011': '/denim-shorts-sample.jpg',
  'SPU-2024-012': '/cardigan-sample.jpg',
  'SPU-2024-013': '/dress-sample-1.jpg',
  'SPU-2024-014': '/lace-dress-sample.jpg',
  'SPU-TSHIRT-081': '/tshirt-sample.jpg',
}

function isRenderableBusinessImageUrl(url: string | null | undefined): url is string {
  const normalized = String(url || '').trim()
  if (!normalized || normalized === '#') return false
  return !normalized.includes('/placeholder.svg')
}

function resolveProductionSpuImageUrl(input: {
  spuCode: string
  spuName?: string
  imageUrl?: string | null
}): string {
  if (isRenderableBusinessImageUrl(input.imageUrl)) return input.imageUrl
  if (spuImageByCode[input.spuCode]) return spuImageByCode[input.spuCode]

  const searchText = `${input.spuCode} ${input.spuName || ''}`.toLowerCase()
  return spuImageFallbacks.find((item) => item.keywords.some((keyword) => searchText.includes(keyword)))?.url || '/tshirt-sample.jpg'
}

function resolveMaterialImageUrl(input: {
  materialName?: string
  materialSku?: string
  materialCode?: string
  materialCategory?: string
  materialImageUrl?: string | null
}): string {
  if (isRenderableBusinessImageUrl(input.materialImageUrl)) return input.materialImageUrl
  const text = [
    input.materialName,
    input.materialSku,
    input.materialCode,
    input.materialCategory,
  ].filter(Boolean).join(' ').toLowerCase()

  if (text.includes('zipper') || text.includes('拉链')) return '/materials/accessory-zipper.jpg'
  if (text.includes('button') || text.includes('纽扣') || text.includes('扣')) return '/materials/accessory-button.jpg'
  if (text.includes('label') || text.includes('唛') || text.includes('标签')) return '/materials/accessory-label.jpg'
  if (text.includes('thread') || text.includes('yarn') || text.includes('线') || text.includes('纱')) return '/materials/yarn-stitching.jpg'
  if (text.includes('packing') || text.includes('bag') || text.includes('包装') || text.includes('吊牌')) return '/materials/packing-bag.jpg'
  if (text.includes('lining') || text.includes('里布')) return '/materials/fabric-lining.jpg'
  if (text.includes('contrast') || text.includes('拼接') || text.includes('配色')) return '/materials/fabric-contrast.jpg'
  return '/materials/fabric-main.jpg'
}

function renderProductionImageThumb(
  imageUrl: string,
  label: string,
  className = 'h-14 w-14',
): string {
  return `
    <img
      src="${escapeHtml(imageUrl)}"
      alt="${escapeHtml(label)}"
      loading="lazy"
      class="${className} shrink-0 rounded-md border bg-muted object-cover"
      onerror="this.onerror=null;this.src='/placeholder.svg'"
    />
  `
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

interface OrderOutputValueBreakdownRow {
  taskId: string
  taskNo: string
  taskLabel: string
  processLabel: string
  qty: number
  detailRowCount: number
  outputValuePerUnit?: number
  outputValueUnit?: string
  totalOutputValue?: number
  isSplitResult: boolean
}

interface OrderOutputValueSnapshot {
  totalOutputValue?: number
  taskCount: number
  breakdownRows: OrderOutputValueBreakdownRow[]
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

function formatOutputValue(value: number | undefined): string {
  if (!Number.isFinite(value) || Number(value) <= 0) return '--'
  return `${Number(value).toLocaleString()} 产值`
}

function formatOutputValuePerUnit(value: number | undefined): string {
  if (!Number.isFinite(value) || Number(value) <= 0) return '--'
  return Number(value).toLocaleString()
}

function getOrderOutputValueSnapshot(order: ProductionOrder): OrderOutputValueSnapshot {
  const runtimeTasks = listRuntimeExecutionTasksByOrder(order.productionOrderId)
    .sort((a, b) => {
      if (a.seq !== b.seq) return a.seq - b.seq
      return (a.taskNo || a.taskId).localeCompare(b.taskNo || b.taskId)
    })

  const breakdownRows = runtimeTasks.map<OrderOutputValueBreakdownRow>((task) => {
    const outputValue = resolveTaskOutputValueSnapshot(task)
    const processLabel = task.isSpecialCraft && task.craftName
      ? `${task.processBusinessName || task.processNameZh} / ${task.craftName}`
      : task.processBusinessName || task.processNameZh || task.processCode

    return {
      taskId: task.taskId,
      taskNo: task.taskNo || task.taskId,
      taskLabel: getRuntimeTaskTypeLabel(task),
      processLabel,
      qty: task.scopeQty || task.qty,
      detailRowCount: getTaskDetailRows(task).length,
      outputValuePerUnit: outputValue.outputValuePerUnit,
      outputValueUnit: outputValue.outputValueUnit,
      totalOutputValue: outputValue.totalOutputValue,
      isSplitResult: Boolean(task.isSplitResult),
    }
  })

  return {
    totalOutputValue: getRuntimeOrderOutputValueTotal(order.productionOrderId),
    taskCount: breakdownRows.length,
    breakdownRows,
  }
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
  if (status === 'INCOMPLETE') return '待启用'
  if (!versionLabel || !versionLabel.trim()) return '-'
  return versionLabel
}

function getDemandTechPackDisplayMeta(input: {
  styleId: string
  currentTechPackVersionId: string
  publishedAt: string
  canConvertToProductionOrder: boolean
}): { label: string; className: string } {
  if (input.canConvertToProductionOrder) {
    return { label: '已启用', className: 'bg-green-100 text-green-700' }
  }
  if (!input.styleId) {
    return { label: '未建档', className: 'bg-red-100 text-red-700' }
  }
  if (!input.currentTechPackVersionId) {
    return { label: '未启用', className: 'bg-orange-100 text-orange-700' }
  }
  if (!input.publishedAt) {
    return { label: '未发布', className: 'bg-orange-100 text-orange-700' }
  }
  return { label: '待补齐', className: 'bg-yellow-100 text-yellow-700' }
}

function getOrderBusinessTechPackStatus(
  status: 'MISSING' | 'BETA' | 'RELEASED' | ProductionOrder['techPackSnapshot'] | null,
): ProductionDemand['techPackStatus'] {
  if (status && typeof status === 'object') return 'RELEASED'
  if (!status) return 'INCOMPLETE'
  return toDemandTechPackStatus(status)
}

function canOrderStartTaskBreakdown(order: ProductionOrder): boolean {
  const statusAllowsBreakdown = order.status === 'READY_FOR_BREAKDOWN' || order.status === 'WAIT_ASSIGNMENT'
  return (
    getOrderBusinessTechPackStatus(order.techPackSnapshot) === 'RELEASED' &&
    statusAllowsBreakdown &&
    !order.taskBreakdownSummary.isBrokenDown &&
    getMaterialPrepBreakdownReadinessForOrder(order.productionOrderId).ready
  )
}

function getOrderTaskBreakdownDisabledReason(order: ProductionOrder): string {
  if (getOrderBusinessTechPackStatus(order.techPackSnapshot) !== 'RELEASED') {
    return '技术包快照缺失，无法拆解'
  }
  if (order.taskBreakdownSummary.isBrokenDown) return '已拆解任务'
  if (order.status !== 'READY_FOR_BREAKDOWN' && order.status !== 'WAIT_ASSIGNMENT') return '当前状态不支持拆解'
  const breakdownReadiness = getMaterialPrepBreakdownReadinessForOrder(order.productionOrderId)
  if (!breakdownReadiness.ready) return breakdownReadiness.summaryText
  return ''
}

function openTaskGenerationPreview(orderIds: string[]): number {
  const previews = buildBatchTaskGenerationPreview(orderIds)
  const visiblePreviews = previews.filter((preview) => preview.status !== 'BLOCKED' || preview.blockedReasons.length > 0)
  if (visiblePreviews.length === 0) return 0
  state.taskGenerationPreview = {
    mode: orderIds.length > 1 ? 'batch' : 'single',
    orderIds: [...orderIds],
    previews: visiblePreviews,
  }
  return visiblePreviews.length
}

function closeTaskGenerationPreview(): void {
  state.taskGenerationPreview = null
}

function applyOrderTaskBreakdown(orderIds: string[]): number {
  const targetIds = new Set(orderIds)
  if (targetIds.size === 0) return 0

  const now = toTimestamp()
  let changedCount = 0
  const previewByOrderId = new Map(
    buildBatchTaskGenerationPreview([...targetIds]).map((preview) => [preview.productionOrderId, preview]),
  )

  state.orders = state.orders.map((order) => {
    if (!targetIds.has(order.productionOrderId) || !canOrderStartTaskBreakdown(order)) {
      return order
    }
    const preview = previewByOrderId.get(order.productionOrderId)
    if (!preview || preview.status === 'BLOCKED') return order

    const runtimeRecord = recordTaskGenerationPreview(preview)
    changedCount += 1
    const totalTasks = preview.generatedUnits.length
    const directCount = preview.generatedUnits.filter((unit) => !unit.allowAutoDispatch || unit.taskUnitType === 'SINGLE_PROCESS_TASK').length
    const biddingCount = Math.max(0, totalTasks - directCount)
    const coveredProcessNames = Array.from(new Set(preview.generatedUnits.flatMap((unit) => unit.coveredProcesses.map((item) => item.craftName || item.processName))))

    return {
      ...order,
      status: 'WAIT_ASSIGNMENT',
      assignmentSummary: {
        directCount,
        biddingCount,
        totalTasks,
        unassignedCount: totalTasks,
      },
      assignmentProgress: {
        status: 'PENDING',
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
        isBrokenDown: true,
        taskTypesTop3: preview.generatedUnits.slice(0, 3).map((unit) => unit.taskName),
        lastBreakdownAt: now,
        lastBreakdownBy: currentUser.name,
        generationRuleId: preview.matchedRuleId,
        generationRuleName: preview.matchedRuleName,
        generatedTaskUnitCount: preview.generatedUnits.length,
        singleProcessTaskCount: preview.generatedUnits.filter((unit) => unit.taskUnitType === 'SINGLE_PROCESS_TASK').length,
        independentWorkOrderTaskCount: runtimeRecord.independentWorkOrderCount,
        independentRequirementCount: runtimeRecord.independentRequirementCount,
        independentWorkOrderCount: runtimeRecord.independentWorkOrderCount,
        combinedProcessTaskCount: preview.generatedUnits.filter((unit) => unit.taskUnitType === 'COMBINED_PROCESS_TASK').length,
        wholeOrderTaskCount: preview.generatedUnits.filter((unit) => unit.taskUnitType === 'WHOLE_ORDER_TASK').length,
        coveredProcessNames,
        previewStatus: preview.status,
      },
      auditLogs: [
        ...order.auditLogs,
        {
          id: nextLocalEntityId('LOG'),
          action: 'TASK_BREAKDOWN',
          detail: `按${preview.matchedRuleName || '默认规则'}确认拆解任务，生成 ${preview.generatedUnits.length} 条任务单元、${preview.independentDemandObjects.length} 个独立需求对象`,
          at: now,
          by: currentUser.name,
        },
      ],
      updatedAt: now,
    }
  })

  return changedCount
}

function confirmTaskGenerationPreview(): number {
  const orderIds = state.taskGenerationPreview?.previews
    .filter((preview) => preview.status === 'READY' || preview.status === 'NEED_CONFIRM' || preview.status === 'NO_MATCH_USE_DEFAULT')
    .map((preview) => preview.productionOrderId) ?? []
  const changed = applyOrderTaskBreakdown(orderIds)
  if (changed > 0) closeTaskGenerationPreview()
  return changed
}

function buildSettlementSummary(statementCount: number, batchCount: number): string {
  if (statementCount === 0 && batchCount === 0) return '无结算影响'
  if (statementCount > 0 && batchCount === 0) return `对账单 ${statementCount} 条`
  if (statementCount === 0 && batchCount > 0) return `预付款批次 ${batchCount} 条`
  return `对账单 ${statementCount} 条 / 预付款批次 ${batchCount} 条`
}

function getTechPackSnapshotForDemand(demand: ProductionDemand): {
  status: ProductionDemand['techPackStatus']
  versionCode: string
  versionLabel: string
  displayStatusLabel: string
  displayStatusClassName: string
  publishedAt: string
  canGenerate: boolean
  blockReason: string
  completenessScore: number
} {
  const current = getDemandCurrentTechPackInfo(demand)
  const publishedOptions = listPublishedTechPackVersionOptionsForDemand(demand)
  const defaultOption = publishedOptions[0] ?? null
  const hasPublishedVersion = publishedOptions.length > 0
  const mappedStatus: ProductionDemand['techPackStatus'] = hasPublishedVersion ? 'RELEASED' : 'INCOMPLETE'
  const display = hasPublishedVersion
    ? { label: '已发布可选', className: 'bg-green-100 text-green-700' }
    : getDemandTechPackDisplayMeta(current)

  return {
    status: mappedStatus,
    versionCode: defaultOption?.technicalVersionCode || current.currentTechPackVersionCode,
    versionLabel: defaultOption?.versionLabel || current.currentTechPackVersionLabel || '',
    displayStatusLabel: display.label,
    displayStatusClassName: display.className,
    publishedAt: defaultOption?.publishedAt || current.publishedAt,
    canGenerate:
      hasPublishedVersion &&
      !demand.hasProductionOrder &&
      demand.productionOrderId === null &&
      demand.demandStatus === 'PENDING_CONVERT',
    blockReason: hasPublishedVersion ? '' : current.blockReason || '该款式暂无已发布技术包版本',
    completenessScore: defaultOption?.completenessScore ?? current.completenessScore,
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
  return '查看当前生效技术包'
}

function renderDemandOperations(
  demand: ProductionDemand,
  techPackStatus: ProductionDemand['techPackStatus'],
  options?: {
    compact?: boolean
    techPackAction?: 'open-current-tech-pack' | 'open-current-tech-pack-from-demand-detail'
    allowGenerate?: boolean
  },
): string {
  const compact = options?.compact ?? true
  const techPackAction = options?.techPackAction ?? 'open-current-tech-pack'
  const allowGenerate = options?.allowGenerate ?? techPackStatus === 'RELEASED'
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
        if (!allowGenerate) return ''
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
  if (!order.taskBreakdownSummary.isBrokenDown) {
    return {
      isBrokenDown: false,
      phase: 'INITIAL_TASK',
      label: '未拆解',
      detailText: '待手动拆解任务',
      badgeClassName: 'bg-gray-100 text-gray-600',
      lastBreakdownAt: order.updatedAt ?? order.createdAt,
      lastBreakdownBy: order.auditLogs[order.auditLogs.length - 1]?.by ?? '系统',
      isPendingAssignment: true,
      hasEnteredAssignment: false,
    }
  }

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
    label: initialTaskCount > 0 ? '已有任务' : '未建任务',
    detailText: initialTaskCount > 0 ? `初始任务 ${initialTaskCount}` : '尚未建任务',
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
  snapshotVersionCode: string
  snapshotVersion: string
  snapshotReadyStatus: '已冻结' | '缺失'
  snapshotReadyClassName: string
  currentStatus: ProductionDemand['techPackStatus']
  currentVersionCode: string
  currentVersion: string
  currentPublishedAt: string
  completenessScore: number
  sourceTaskText: string
  isOutOfSync: boolean
} {
  const current = getDemandCurrentTechPackInfo(order.demandSnapshot)
  const snapshotStatus: ProductionDemand['techPackStatus'] = order.techPackSnapshot ? 'RELEASED' : 'INCOMPLETE'
  const snapshotVersionCode = order.techPackSnapshot?.sourceTechPackVersionCode || ''
  const snapshotVersion = normalizeTechPackVersionLabel(
    snapshotStatus,
    order.techPackSnapshot?.sourceTechPackVersionLabel || '',
  )
  const hasFrozenSnapshot = Boolean(
    order.techPackSnapshot &&
      String(order.techPackSnapshot.sourceTechPackVersionId || '').trim() &&
      String(order.techPackSnapshot.sourcePublishedAt || '').trim(),
  )
  const snapshotReadyStatus: '已冻结' | '缺失' = hasFrozenSnapshot ? '已冻结' : '缺失'
  const snapshotReadyClassName =
    snapshotReadyStatus === '已冻结'
      ? 'bg-green-100 text-green-700'
      : 'bg-red-100 text-red-700'
  const currentStatus: ProductionDemand['techPackStatus'] = current.canConvertToProductionOrder ? 'RELEASED' : 'INCOMPLETE'
  const currentVersionCode = current.currentTechPackVersionCode
  const currentVersion = normalizeTechPackVersionLabel(currentStatus, current.currentTechPackVersionLabel)
  const sourceTaskText = (() => {
    if (!order.techPackSnapshot) return '暂无来源任务链'
    const parts: string[] = []
    if (order.techPackSnapshot.linkedRevisionTaskIds.length > 0) parts.push(`改版任务 ${order.techPackSnapshot.linkedRevisionTaskIds.length}`)
    if (order.techPackSnapshot.linkedPatternTaskIds.length > 0) parts.push(`制版任务 ${order.techPackSnapshot.linkedPatternTaskIds.length}`)
    if (order.techPackSnapshot.linkedArtworkTaskIds.length > 0) parts.push(`花型任务 ${order.techPackSnapshot.linkedArtworkTaskIds.length}`)
    return parts.length > 0 ? parts.join(' / ') : '暂无来源任务链'
  })()

  return {
    snapshotStatus,
    snapshotVersionCode,
    snapshotVersion,
    snapshotReadyStatus,
    snapshotReadyClassName,
    currentStatus,
    currentVersionCode,
    currentVersion,
    currentPublishedAt: current.publishedAt,
    completenessScore: order.techPackSnapshot?.completenessScore ?? 0,
    sourceTaskText,
    isOutOfSync:
      currentStatus !== snapshotStatus ||
      currentVersionCode !== snapshotVersionCode ||
      currentVersion !== snapshotVersion,
  }
}

function getOrderTechPackSnapshotDisplay(order: ProductionOrder): {
  techPackVersionLabelText: string
  techPackVersionText: string
  techPackSnapshotAt: string
  garmentDifficultyGrade: string
  techPackReadyStatus: '已冻结' | '缺失'
  techPackReadyClassName: string
} {
  const info = getOrderTechPackInfo(order)
  const sourceTechPackRecord = order.techPackSnapshot?.sourceTechPackVersionId
    ? getTechnicalDataVersionById(order.techPackSnapshot.sourceTechPackVersionId)
    : null
  const sourceTechPackRecordByCode = !sourceTechPackRecord && order.techPackSnapshot?.sourceTechPackVersionCode
    ? listTechnicalDataVersions().find((record) => record.technicalVersionCode === order.techPackSnapshot?.sourceTechPackVersionCode) ?? null
    : null
  const techPackVersionCodeText = order.techPackSnapshot?.sourceTechPackVersionCode || '-'
  const techPackVersionLabelText = order.techPackSnapshot?.sourceTechPackVersionLabel || '-'
  return {
    techPackVersionLabelText: order.techPackSnapshot ? techPackVersionLabelText : '-',
    techPackVersionText: order.techPackSnapshot
      ? `${techPackVersionCodeText} / ${techPackVersionLabelText}`
      : '暂无技术包快照',
    techPackSnapshotAt: order.techPackSnapshot?.snapshotAt || '-',
    garmentDifficultyGrade:
      order.techPackSnapshot?.garmentDifficultyGrade
      || sourceTechPackRecord?.garmentDifficultyGrade
      || sourceTechPackRecordByCode?.garmentDifficultyGrade
      || (order.techPackSnapshot ? 'B' : '-'),
    techPackReadyStatus: info.snapshotReadyStatus,
    techPackReadyClassName: info.snapshotReadyClassName,
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
        demand.legacyOrderNo.toLowerCase().includes(keyword) ||
        demand.saleType.toLowerCase().includes(keyword)
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

function getPaginatedDemands(filteredDemands: ProductionDemand[]): ProductionDemand[] {
  const start = (state.demandCurrentPage - 1) * PAGE_SIZE
  return filteredDemands.slice(start, start + PAGE_SIZE)
}

function getBatchGeneratableDemandIds(): string[] {
  return getBatchSelectedDemandIds().filter((demandId) => {
    const demand = state.demands.find((item) => item.demandId === demandId)
    if (!demand) return false
    return (
      demand.demandStatus === 'PENDING_CONVERT' &&
      !demand.hasProductionOrder &&
      getTechPackSnapshotForDemand(demand).canGenerate
    )
  })
}

function getBatchSelectedDemandIds(): string[] {
  const visibleDemandIds = new Set(getFilteredDemands().map((demand) => demand.demandId))
  return [...state.demandSelectedIds].filter((demandId) => visibleDemandIds.has(demandId))
}

function listOrdersFromDemandGeneratableDemands(): ProductionDemand[] {
  return state.demands.filter((demand) => {
    if (demand.demandStatus !== 'PENDING_CONVERT') return false
    if (demand.hasProductionOrder) return false
    if (demand.productionOrderId !== null) return false
    return getTechPackSnapshotForDemand(demand).canGenerate
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
        order.demandSnapshot.demandId.toLowerCase().includes(keyword) ||
        order.demandSnapshot.saleType.toLowerCase().includes(keyword) ||
        order.demandSnapshot.spuCode.toLowerCase().includes(keyword) ||
        order.demandSnapshot.spuName.toLowerCase().includes(keyword) ||
        formatProductionOrderMainFactoryName(order).toLowerCase().includes(keyword)
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
    result = result.filter(
      (order) =>
        !isProductionOrderMainFactoryPending(order) &&
        order.mainFactorySnapshot.tier === state.ordersTierFilter,
    )
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
  state.demandBatchGenerateMode = 'batch'
  state.demandSingleGenerateId = null
  state.demandGenerateConfirmOpen = false
  state.demandGenerateTechPackVersionId = ''
  state.demandGenerateTechPackVersionIds = {}
  state.ordersDemandSnapshotId = null
  state.ordersTechPackSnapshotDialogId = null
  state.ordersLogsId = null
  state.ordersBreakdownReadinessOrderId = null
  state.taskGenerationPreview = null
  state.ordersFromDemandDialogOpen = false
  state.ordersFromDemandSelectedIds = new Set<string>()
  state.materialDraftOrderId = null
  state.materialDraftAddDraftId = null
  state.materialDraftAddSelections = new Set<string>()
  state.techPackChangeVersionDialogOrderId = null
  state.productionPatchDialogOrderId = null
  state.techPackChangePublishGuideOpen = false
  state.techPackChangePublishGuideBatchId = ''
  state.techPackChangePublishIgnoreReason = ''
  state.techPackChangeModuleLandingId = ''
  state.detailLogsOpen = false
  state.detailSimulateOpen = false
  state.detailConfirmSimulateOpen = false
  state.ordersActionMenuId = null
}

const state: ProductionState = {
  demands: productionDemands.map(cloneDemand),
  orders: productionOrders.map(cloneOrder),

  demandKeyword: '',
  demandStatusFilter: 'ALL',
  demandTechPackFilter: 'ALL',
  demandHasOrderFilter: 'ALL',
  demandPriorityFilter: 'ALL',
  demandOnlyUngenerated: false,
  demandCurrentPage: 1,
  demandSelectedIds: new Set<string>(),
  demandDetailId: null,
  demandBatchDialogOpen: false,
  demandBatchGenerateMode: 'batch',
  demandSingleGenerateId: null,
  demandGenerateConfirmOpen: false,
  demandGenerateTechPackVersionId: '',
  demandGenerateTechPackVersionIds: {},
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
  ordersTechPackSnapshotDialogId: null,
  ordersLogsId: null,
  ordersActionMenuId: null,
  ordersBreakdownReadinessOrderId: null,
  taskGenerationPreview: null,
  ordersFromDemandDialogOpen: false,
  ordersFromDemandSelectedIds: new Set<string>(),
  materialDraftOrderId: null,
  materialDraftAddDraftId: null,
  materialDraftAddSelections: new Set<string>(),
  ordersViewMode: 'table',

  techPackChangeKeyword: '',
  techPackChangeCurrentVersionFilter: 'ALL',
  techPackChangeNewVersionFilter: 'ALL',
  techPackChangePatchFilter: 'ALL',
  techPackChangeStatusFilter: 'ALL',
  techPackChangeModuleFilter: 'ALL',
  techPackChangeProgressFilter: 'ALL',
  techPackChangeOwnerFilter: 'ALL',
  productionChangeOrderPage: 1,
  productionChangeSelectedOrderId: '',
  productionChangeListTab: 'change-orders',
  productionChangeDetailTab: 'content',
  productionChangeFormStep: 'order',
  productionChangeForm: createProductionChangeForm(),
  productionChangeFormError: '',
  techPackChangeDetailTab: 'relation',
  techPackChangeVersionDialogOrderId: null,
  techPackChangeVersionForm: { ...TECH_PACK_VERSION_CHANGE_EMPTY_FORM },
  techPackChangeVersionError: '',
  productionPatchDialogOrderId: null,
  productionPatchForm: { ...PRODUCTION_PATCH_EMPTY_FORM },
  productionPatchError: '',
  techPackChangePublishGuideOpen: false,
  techPackChangePublishGuideBatchId: '',
  techPackChangePublishIgnoreReason: '',
  techPackChangeModuleLandingId: '',

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
  DemandOwnerPartyType,
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
  MaterialRequestDraft,
  MaterialMode,
  TechPackChangeDetailTab,
  ProductionChangeForm,
  ProductionChangeFormType,
  ProductionChangeFormStep,
  ProductionChangeDetailTab,
  ProductionChangeListTab,
  TechPackVersionChangeForm,
  ProductionPatchForm,
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
  formatProductionOrderMainFactoryName,
  isProductionOrderMainFactoryPending,
  indonesiaFactories,
  typesByTier,
  tierLabels,
  typeLabels,
  legalEntities,
  getRuntimeAssignmentSummaryByOrder,
  getRuntimeBiddingSummaryByOrder,
  getRuntimeOrderOutputValueTotal,
  getRuntimeTaskById,
  getRuntimeTaskCountByOrder,
  listRuntimeExecutionTasksByOrder,
  listRuntimeTaskSplitGroupsByOrder,
  listRuntimeTasksByOrder,
  summarizeTaskDetailRows,
  resolveTaskOutputValueSnapshot,
  initialDeductionBasisItems,
  initialAllocationByTaskId,
  initialStatementDrafts,
  initialSettlementBatches,
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
  TECH_PACK_VERSION_CHANGE_EMPTY_FORM,
  PRODUCTION_PATCH_EMPTY_FORM,
  demandStatusConfig,
  demandTechPackStatusConfig,
  demandPriorityConfig,
  taskStatusLabel,
  taskStatusClass,
  keyProcessKeywords,
  cloneDemand,
  cloneOrder,
  toTimestamp,
  nextLocalEntityId,
  showPlanMessage,
  includesKeyword,
  safeText,
  resolveProductionSpuImageUrl,
  resolveMaterialImageUrl,
  renderProductionImageThumb,
  renderBadge,
  renderSplitEventList,
  deriveRuntimeAssignmentProgressStatus,
  getOrderRuntimeAssignmentSnapshot,
  getRuntimeTaskTypeLabel,
  getTaskDetailRows,
  getOrderTaskBreakdownSnapshot,
  formatOutputValue,
  formatOutputValuePerUnit,
  getOrderOutputValueSnapshot,
  renderStatCard,
  renderEmptyRow,
  parseOrderSuffix,
  nextProductionOrderId,
  toDemandTechPackStatus,
  toOrderTechPackStatus,
  normalizeTechPackVersionLabel,
  getOrderBusinessTechPackStatus,
  canOrderStartTaskBreakdown,
  getOrderTaskBreakdownDisabledReason,
  openTaskGenerationPreview,
  closeTaskGenerationPreview,
  confirmTaskGenerationPreview,
  applyOrderTaskBreakdown,
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
  getOrderTechPackSnapshotDisplay,
  getDemandById,
  getOrderById,
  getProcessTaskById,
  openAppRoute,
  getDemandFactoryOptions,
  getAvailableDemandTypes,
  getFilteredDemands,
  getPaginatedDemands,
  getBatchSelectedDemandIds,
  getBatchGeneratableDemandIds,
  listOrdersFromDemandGeneratableDemands,
  getOrdersFromDemandSelectedIds,
  listPublishedTechPackVersionOptionsForDemand,
  getFilteredOrders,
  getPaginatedOrders,
  getMaterialPrepBreakdownReadinessForOrder,
  clearMaterialPrepBreakdownReadinessCache,
  getPlanWeekRange,
  closeAllProductionDialogs,
  state,
}
