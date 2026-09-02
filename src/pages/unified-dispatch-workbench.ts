// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../components/ui/list-table-model.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import {
  allocateRuntimeSkuTaskScope,
  applyRuntimeDirectDispatchMeta,
  captureRuntimeDirectDispatchState,
  cancelFixedMergedTask,
  createFixedMergedTask,
  evaluateFixedMergedTask,
  evaluateRuntimeTenderAwardDispatchPolicy,
  getRuntimeTaskById,
  getRuntimeSewingTaskReassignmentScopePreview,
  listRuntimeProcessTasks,
  reassignRuntimeSewingTask,
  restoreRuntimeDirectDispatchState,
  upsertRuntimeTaskTender,
  validateRuntimeIndependentSewingFactoryUniqueness,
  type RuntimeProcessTask,
} from '../data/fcs/runtime-process-tasks.ts'
import {
  captureRuntimeTaskTenderRecordStore,
  getRuntimeTaskTenderRecord,
  listRuntimeTaskTenderRecords,
  resolveRuntimeTaskTenderStatus,
  restoreRuntimeTaskTenderRecordStore,
  runtimeTaskTenderStatusLabel,
  upsertRuntimeTaskTenderRecord,
} from '../data/fcs/runtime-task-tenders.ts'
import {
  getFactoryActivePpicSnapshot,
  listBusinessFactoryMasterRecords,
} from '../data/fcs/factory-master-store.ts'
import type { Factory } from '../data/fcs/factory-types.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC } from '../data/fcs/factory-onboarding-ppic.ts'
import { classifyTaskFulfillmentPolicy } from '../data/fcs/task-fulfillment-policy.ts'
import {
  getMergedProductionTaskDefinition,
  isAssignableProductionExecutionTask,
  normalizeProductionExecutionProcessCode,
} from '../data/fcs/merged-production-task.ts'
import {
  createEffectiveTaskAssignment,
  listCurrentEffectiveTaskAssignments,
  supersedeEffectiveTaskAssignmentsForReassignment,
} from '../data/fcs/effective-task-assignments.ts'
import {
  buildProductionReturnRulePreview,
  createProductionReturnRuleSnapshot,
} from '../data/fcs/production-return-fulfillment.ts'
import {
  assertCutPieceReleaseDispatchAvailable,
  getCutPieceDispatchReadinessForTask,
  requiresCutPieceReleaseForProcessCodes,
} from '../data/fcs/cut-piece-release.ts'
import { getMaterialPrepDispatchReadinessForTask } from '../data/fcs/cutting/production-material-prep.ts'
import {
  addSignedContractScans,
  generateProductionContract,
  getProductionContract,
  listProductionContracts,
  removeSignedContractScan,
  reorderSignedContractScan,
  recordProductionContractGenerationFailure,
  invalidateProductionContractsForTask,
  retryProductionContractGeneration,
} from '../data/fcs/production-contracts.ts'
import { formatOperationLocalWallClock } from '../data/fcs/sewing-delivery-sla.ts'
import { getCurrentSewingTaskResponsibility } from '../data/fcs/sewing-outsourcing-responsibility.ts'
import { productionOrders, type ProductionOrder } from '../data/fcs/production-orders.ts'
import {
  buildDispatchBaggingSnapshot,
  evaluateDispatchBagSelection,
  selectionMatchesRecommendationGroups,
  type DispatchBaggingSnapshot,
} from '../data/fcs/dispatch-bagging-snapshot.ts'
import {
  invalidateUnstartedSpecialCraftTaskOrdersForMergedTask,
  listBlockingSpecialCraftTaskOrdersForMergedTask,
  restoreSpecialCraftTaskOrdersAfterMergedTaskCancellation,
} from '../data/fcs/special-craft-task-orders.ts'
import { escapeHtml } from '../utils.ts'
import {
  isKolGotoFactory,
  isKolGotoWholeOrderTask,
} from '../data/fcs/kol-goto-special-flow.ts'
import {
  POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS,
  type PostFinishingAcceptanceProductionOrder,
} from '../data/fcs/post-finishing-full-flow.ts'

type WorkbenchTaskType = 'ALL' | 'SEWING' | 'NON_SEWING' | 'MERGED'
type DistributionMode = 'BAG_AWARE' | 'FREE'
type AssignMode = 'DIRECT' | 'BIDDING' | 'REASSIGN'

type WorkbenchFilterKey =
  | 'assignmentProgress' | 'assignmentMode' | 'process' | 'craft' | 'factory'
  | 'priceStatus' | 'domesticTracker' | 'indonesiaTracker' | 'dispatchStart' | 'dispatchEnd'

type WorkbenchFilters = Record<WorkbenchFilterKey, string>

interface DispatchDialogState {
  taskId: string
  mode: AssignMode
  distributionMode: DistributionMode
  factoryId: string
  businessAssignedAt: string
  price: string
  tenderMinPrice: string
  tenderDeadline: string
  tenderPoolMode: 'ALL_ELIGIBLE' | 'MANUAL'
  tenderFactoryKeyword: string
  tenderFactoryType: string
  selectedTenderFactoryIds: Set<string>
  checkedTenderCandidateIds: Set<string>
  checkedTenderPoolIds: Set<string>
  reassignReason: string
  selectedSkuCodes: Set<string>
  confirmStage: 1 | 2
  error: string
  baggingNotice: string
}

interface MergeDialogState {
  mode: 'MERGE' | 'CANCEL'
  productionOrderKeyword: string
  productionOrderId: string
  taskIds: string[]
  mergedTaskId?: string
  confirmStage: 1 | 2
  error: string
}

interface AutoDispatchConfig {
  ruleKey: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  enabled: boolean
  factoryId: string
  factoryName: string
  deadlineDays: number
  updatedAt: string
}

interface AutoDispatchPreviewItem {
  task: RuntimeProcessTask
  config: AutoDispatchConfig
  factory: Factory
  price: number
}

interface AutoDispatchDialogState {
  mode: 'CONFIG' | 'EXECUTE'
  confirmStage: 1 | 2
  error: string
}

interface WorkbenchState {
  taskType: WorkbenchTaskType
  keyword: string
  page: number
  detailTaskId: string | null
  detailMode: 'DETAIL' | 'LOG'
  dispatch: DispatchDialogState | null
  merge: MergeDialogState | null
  autoDispatch: AutoDispatchDialogState | null
  feedback: string
  contractPromptId: string | null
  uploadContractId: string | null
  failedUploadNamesByContract: Record<string, string[]>
  filters: WorkbenchFilters
  showAdvancedFilters: boolean
}

const DEFAULT_FILTERS: WorkbenchFilters = {
  assignmentProgress: 'ALL', assignmentMode: 'ALL', process: 'ALL', craft: 'ALL', factory: 'ALL',
  priceStatus: 'ALL', domesticTracker: 'ALL', indonesiaTracker: 'ALL', dispatchStart: '', dispatchEnd: '',
}

const state: WorkbenchState = {
  taskType: 'ALL',
  keyword: '',
  page: 1,
  detailTaskId: null,
  detailMode: 'DETAIL',
  dispatch: null,
  merge: null,
  autoDispatch: null,
  feedback: '',
  contractPromptId: null,
  uploadContractId: null,
  failedUploadNamesByContract: {},
  filters: { ...DEFAULT_FILTERS },
  showAdvancedFilters: false,
}

let appliedQuerySignature = ''
const autoDispatchConfigs = new Map<string, AutoDispatchConfig>()
const automaticDispatchFailures = new Set<string>()

const TASK_IMAGE_BY_INDEX = ['/shirt-sample.jpg', '/dress-sample-1.jpg', '/cardigan-sample.jpg', '/tshirt-sample.jpg']

function isPostFinishingSourceQuery(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('source') === 'post-finishing'
}

function buildPostFinishingWorkbenchTask(order: PostFinishingAcceptanceProductionOrder): RuntimeProcessTask {
  const qty = order.skus.reduce((sum, sku) => sum + sku.plannedQty, 0)
  return {
    taskId: order.executionTaskId,
    taskNo: order.sewingTaskNo,
    rootTaskNo: order.sewingTaskNo,
    baseTaskId: order.executionTaskId,
    baseQty: qty,
    baseDependsOnTaskIds: [],
    dependsOnTaskIds: [],
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    seq: 1,
    processCode: 'POST_FINISHING_QC',
    processNameZh: '后道质检',
    processBusinessCode: 'POST_FINISHING_QC',
    processBusinessName: '后道质检',
    stage: 'POST',
    stageCode: 'POST',
    qty,
    qtyUnit: 'PIECE',
    qtyDisplayUnit: '件',
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTypes: ['FINISHING'] },
    assignedFactoryId: order.managedPostFactoryId,
    assignedFactoryName: order.managedPostFactoryName,
    acceptanceStatus: 'ACCEPTED',
    acceptedAt: '2026-08-01 09:00:00',
    acceptedBy: order.managedPostFactoryName,
    dispatchedAt: '2026-08-01 08:30:00',
    dispatchedBy: '生产计划员',
    businessAssignedAt: '2026-08-01 08:30:00',
    standardPrice: 1200,
    standardPriceCurrency: 'IDR',
    standardPriceUnit: '件',
    dispatchPrice: 1200,
    dispatchPriceCurrency: 'IDR',
    dispatchPriceUnit: '件',
    qcPoints: ['外观', '数量', '包装'],
    attachments: [],
    status: 'NOT_STARTED',
    taskUnitType: 'SINGLE_PROCESS_TASK',
    assignmentGranularity: 'ORDER',
    taskScope: 'EXTERNAL_TASK',
    defaultDocType: 'TASK',
    executionEnabled: true,
    scopeType: 'ORDER',
    scopeKey: order.productionOrderId,
    scopeLabel: order.productionOrderNo,
    scopeQty: qty,
    scopeSkuLines: order.skus.map((sku) => ({ skuCode: sku.skuCode, color: sku.colorName, size: sku.sizeName, qty: sku.plannedQty })),
    scopeDetailRows: [],
    createdAt: '2026-08-01 08:30:00',
    updatedAt: '2026-08-01 09:00:00',
    auditLogs: [{ id: `${order.executionTaskId}-LINK`, action: '任务已派单', detail: `后道质检任务已分配给 ${order.managedPostFactoryName}`, at: '2026-08-01 08:30:00', by: '生产计划员' }],
  }
}

function listWorkbenchSourceTasks(): RuntimeProcessTask[] {
  if (isPostFinishingSourceQuery()) return POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.map(buildPostFinishingWorkbenchTask)
  return listRuntimeProcessTasks().filter(isAssignableProductionExecutionTask)
}

function findPostFinishingOrder(task: RuntimeProcessTask): PostFinishingAcceptanceProductionOrder | null {
  return POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.find((order) =>
    order.executionTaskId === task.taskId
    || order.sewingTaskNo === task.taskNo
    || order.productionOrderNo === task.productionOrderNo,
  ) || null
}

function resolveWorkbenchTask(taskId: string): RuntimeProcessTask | null {
  return getRuntimeTaskById(taskId)
    || (isPostFinishingSourceQuery() ? listWorkbenchSourceTasks().find((task) => task.taskId === taskId) || null : null)
}

function formatDateTimeLocal(value: string): string {
  return value.replace(' ', 'T').slice(0, 16)
}

function toWallClock(value: string): string {
  return value.replace('T', ' ') + (value.length === 16 ? ':00' : '')
}

function getTaskType(task: RuntimeProcessTask): Exclude<WorkbenchTaskType, 'ALL'> {
  const policy = classifyTaskFulfillmentPolicy(task)
  if (policy.mergedTaskType) return 'MERGED'
  if (policy.startsWithSewing) return 'SEWING'
  return 'NON_SEWING'
}

function typeLabel(type: WorkbenchTaskType): string {
  return ({
    ALL: '全部任务',
    SEWING: '独立车缝任务',
    NON_SEWING: '非车缝独立生产任务',
    MERGED: '合并任务',
  })[type]
}

function factoryCanAcceptTask(factory: Factory, task: RuntimeProcessTask): boolean {
  if (isKolGotoFactory(factory.id) || isKolGotoWholeOrderTask(task)) return false
  const policy = classifyTaskFulfillmentPolicy(task)
  const config = factory.taskAcceptanceConfig
  if (!config || factory.status !== 'active' || !factory.eligibility.allowDispatch) return false
  if (policy.involvesSewingOutsourcing && !getFactoryActivePpicSnapshot(factory.id)) return false
  if (policy.mergedTaskType === 'SEWING_IRON_PACK') return config.canAcceptSewingIronPack
  if (policy.mergedTaskType === 'CUTTING_SEWING_IRON_PACK') return config.canAcceptCuttingSewingIronPack
  if (!config.singleProcessEnabled) return false

  const requiredCodes = new Set(policy.normalizedProcessCodes.map((code) => normalizeProductionExecutionProcessCode(code)))
  return factory.processAbilities.some((ability) => {
    if (ability.status === 'DISABLED' || ability.canReceiveTask === false) return false
    const abilityCode = normalizeProductionExecutionProcessCode(ability.processCode)
    if (requiredCodes.has(abilityCode)) return true
    return false
  })
}

function listEligibleFactoriesForTask(task: RuntimeProcessTask): Factory[] {
  return listBusinessFactoryMasterRecords()
    .filter((factory) => factoryCanAcceptTask(factory, task))
}

function listEligibleTenderFactoriesForTask(task: RuntimeProcessTask): Factory[] {
  const evaluatedAt = formatOperationLocalWallClock()
  const referencePrice = Number(task.standardPrice || task.dispatchPrice || 1)
  return listEligibleFactoriesForTask(task).filter((factory) => {
    if (!factory.eligibility.allowBid || !factory.pdaEnabled) return false
    const decision = evaluateRuntimeTenderAwardDispatchPolicy({
      taskId: task.taskId,
      factoryId: factory.id,
      factoryName: factory.name,
      awardedAt: evaluatedAt,
      awardedPrice: referencePrice,
      by: '生产计划员',
      riskConfirmed: true,
      supervisorAssigned: true,
    })
    return decision?.allowed !== false
  })
}

function getTenderFactoryCapabilitySummary(factory: Factory, task: RuntimeProcessTask): string {
  const policy = classifyTaskFulfillmentPolicy(task)
  if (policy.mergedTaskType === 'SEWING_IRON_PACK') return '可承接车缝+烫包'
  if (policy.mergedTaskType === 'CUTTING_SEWING_IRON_PACK') return '可承接裁剪+车缝+烫包'
  const requiredCodes = new Set(policy.normalizedProcessCodes.map((code) => normalizeProductionExecutionProcessCode(code)))
  const matched = factory.processAbilities
    .filter((ability) => requiredCodes.has(normalizeProductionExecutionProcessCode(ability.processCode)))
    .map((ability) => ability.processName || ability.abilityName || ability.processCode)
  return matched.join('、') || policy.taskTypeLabel
}

function isAutoDispatchScopeTask(task: RuntimeProcessTask): boolean {
  const policy = classifyTaskFulfillmentPolicy(task)
  return isAssignableProductionExecutionTask(task)
    && policy.isIndependentTask
    && !policy.startsWithSewing
    && task.taskUnitType === 'SINGLE_PROCESS_TASK'
    && task.allowAutoDispatch !== false
}

function autoDispatchRuleKey(task: RuntimeProcessTask): string {
  const processCode = normalizeProductionExecutionProcessCode(task.processCode || task.processBusinessCode || task.processNameZh)
  return `${processCode}::${task.craftCode || 'NO_CRAFT'}`
}

function autoDispatchDefinitions(): Array<{ ruleKey: string; processCode: string; processName: string; craftCode: string; craftName: string; sampleTask: RuntimeProcessTask; taskCount: number }> {
  const grouped = new Map<string, { ruleKey: string; processCode: string; processName: string; craftCode: string; craftName: string; sampleTask: RuntimeProcessTask; taskCount: number }>()
  listRuntimeProcessTasks().filter(isAutoDispatchScopeTask).forEach((task) => {
    const ruleKey = autoDispatchRuleKey(task)
    const current = grouped.get(ruleKey)
    if (current) current.taskCount += 1
    else grouped.set(ruleKey, { ruleKey, processCode: task.processCode, processName: task.processBusinessName || task.processNameZh, craftCode: task.craftCode || '', craftName: task.craftName || '', sampleTask: task, taskCount: 1 })
  })
  return [...grouped.values()].sort((a, b) => a.processName.localeCompare(b.processName, 'zh-CN'))
}

function ensureAutoDispatchConfigs(): AutoDispatchConfig[] {
  const definitions = autoDispatchDefinitions()
  definitions.forEach((definition, index) => {
    if (autoDispatchConfigs.has(definition.ruleKey)) return
    const factory = listEligibleFactoriesForTask(definition.sampleTask)[0]
    autoDispatchConfigs.set(definition.ruleKey, {
      ruleKey: definition.ruleKey,
      processCode: definition.processCode,
      processName: definition.processName,
      craftCode: definition.craftCode,
      craftName: definition.craftName,
      enabled: index < 2 && Boolean(factory) && Number(definition.sampleTask.standardPrice || 0) > 0,
      factoryId: factory?.id || '',
      factoryName: factory?.name || '',
      deadlineDays: 7,
      updatedAt: '尚未保存',
    })
  })
  return definitions.map((definition) => autoDispatchConfigs.get(definition.ruleKey)!).filter(Boolean)
}

function buildAutoDispatchPreview(): {
  eligible: AutoDispatchPreviewItem[]
  unassignedCount: number
  excludedSewingOrMerged: number
  missingConfig: number
  invalidFactory: number
  invalidPrice: number
} {
  ensureAutoDispatchConfigs()
  const unassigned = listRuntimeProcessTasks().filter(isAssignableProductionExecutionTask).filter((task) => task.assignmentStatus === 'UNASSIGNED')
  const result = { eligible: [] as AutoDispatchPreviewItem[], unassignedCount: unassigned.length, excludedSewingOrMerged: 0, missingConfig: 0, invalidFactory: 0, invalidPrice: 0 }
  unassigned.forEach((task) => {
    if (!isAutoDispatchScopeTask(task)) { result.excludedSewingOrMerged += 1; return }
    const config = autoDispatchConfigs.get(autoDispatchRuleKey(task))
    if (!config?.enabled) { result.missingConfig += 1; return }
    const factory = listEligibleFactoriesForTask(task).find((item) => item.id === config.factoryId)
    if (!factory) { result.invalidFactory += 1; return }
    const price = Number(task.standardPrice || 0)
    if (!Number.isFinite(price) || price <= 0) { result.invalidPrice += 1; return }
    result.eligible.push({ task, config, factory, price })
  })
  return result
}

function addNaturalDays(value: string, days: number): string {
  const [datePart, timePart = '18:00:00'] = value.split(' ')
  const [year, month, day] = datePart.split('-').map(Number)
  const date = new Date(year, month - 1, day + days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d} ${timePart}`
}

function processNames(task: RuntimeProcessTask): string[] {
  const names = task.coveredProcesses?.length
    ? task.coveredProcesses.map((item) => item.processName)
    : [task.processNameZh]
  return Array.from(new Set(names.filter(Boolean)))
}

interface TaskListContext {
  order: ProductionOrder | null
  spuCode: string
  spuName: string
  domesticTracker: string
  indonesiaTracker: string
  processCode: string
  processLabel: string
  craftCode: string
  craftLabel: string
  priceStatus: string
}

const INDONESIA_TRACKERS = ['Ayu', 'Dewi', 'Rina', 'Sari']

function findProductionOrder(task: RuntimeProcessTask): ProductionOrder | null {
  return productionOrders.find((order) =>
    order.productionOrderId === task.productionOrderId
    || order.productionOrderNo === task.productionOrderNo
    || order.productionOrderId === task.productionOrderNo,
  ) || null
}

function deterministicIndex(value: string): number {
  return Math.abs([...value].reduce((sum, char) => sum + char.charCodeAt(0), 0))
}

function taskPriceStatus(task: RuntimeProcessTask): string {
  const standard = Number(task.standardPrice || 0)
  const dispatch = Number(task.dispatchPrice || 0)
  if (standard <= 0) return 'NO_STANDARD'
  if (dispatch <= 0) return 'PENDING'
  if (dispatch > standard) return 'ABOVE'
  if (dispatch < standard) return 'BELOW'
  return 'MATCH'
}

function taskListContext(task: RuntimeProcessTask): TaskListContext {
  const order = findProductionOrder(task)
  const postFinishingOrder = findPostFinishingOrder(task)
  const processCode = normalizeProductionExecutionProcessCode(task.processBusinessCode || task.processCode || task.processNameZh)
  const processLabel = task.processBusinessName || task.processNameZh
  const craftCode = task.craftCode || 'NO_CRAFT'
  const craftLabel = task.craftName || '无独立工艺'
  const trackerIndex = deterministicIndex(task.productionOrderId || task.taskId)
  const policy = classifyTaskFulfillmentPolicy(task)
  const currentPpic = policy.involvesSewingOutsourcing ? getCurrentSewingTaskResponsibility(task.taskId) : null
  return {
    order,
    spuCode: order?.demandSnapshot.spuCode || postFinishingOrder?.styleNo || task.productionOrderNo || '待关联款式',
    spuName: order?.demandSnapshot.spuName || postFinishingOrder?.styleName || '款式信息待同步',
    domesticTracker: order?.demandSnapshot.merchandiserName || '未分配',
    indonesiaTracker: policy.involvesSewingOutsourcing
      ? currentPpic?.ppicName || '待选厂后确定'
      : trackerIndex % 5 === 0 ? '未分配' : INDONESIA_TRACKERS[trackerIndex % INDONESIA_TRACKERS.length],
    processCode,
    processLabel,
    craftCode,
    craftLabel,
    priceStatus: taskPriceStatus(task),
  }
}

function dateInRange(value: string | undefined, start: string, end: string): boolean {
  const date = String(value || '').slice(0, 10)
  if (start && (!date || date < start)) return false
  if (end && (!date || date > end)) return false
  return true
}

function assignmentModeValue(task: RuntimeProcessTask): string {
  if (listCurrentEffectiveTaskAssignments(task.taskId)[0]?.operatedBy.includes('自动分配')) return 'AUTO'
  if (task.assignmentStatus === 'BIDDING' || task.assignmentMode === 'BIDDING') return 'BIDDING'
  return 'DIRECT'
}

function taskRows(): RuntimeProcessTask[] {
  ensureAutoDispatchConfigs()
  const keyword = state.keyword.trim().toLowerCase()
  return listWorkbenchSourceTasks()
    .filter((task) => state.taskType === 'ALL' || getTaskType(task) === state.taskType)
    .filter((task) => {
      const context = taskListContext(task)
      const filters = state.filters
      if (keyword && ![
        context.spuCode, context.spuName, task.taskNo, task.taskId, task.productionOrderNo, task.productionOrderId,
        context.processLabel, context.craftLabel, task.assignedFactoryName, context.domesticTracker, context.indonesiaTracker,
      ].some((value) => String(value || '').toLowerCase().includes(keyword))) return false
      if (filters.assignmentProgress !== 'ALL' && task.assignmentStatus !== filters.assignmentProgress) return false
      if (filters.assignmentMode !== 'ALL' && assignmentModeValue(task) !== filters.assignmentMode) return false
      if (filters.process !== 'ALL' && context.processCode !== filters.process) return false
      if (filters.craft !== 'ALL' && context.craftCode !== filters.craft) return false
      if (filters.factory !== 'ALL' && String(task.assignedFactoryId || '') !== filters.factory) return false
      if (filters.priceStatus !== 'ALL' && context.priceStatus !== filters.priceStatus) return false
      if (filters.domesticTracker !== 'ALL' && context.domesticTracker !== filters.domesticTracker) return false
      if (filters.indonesiaTracker !== 'ALL' && context.indonesiaTracker !== filters.indonesiaTracker) return false
      if (!dateInRange(task.businessAssignedAt || task.dispatchedAt, filters.dispatchStart, filters.dispatchEnd)) return false
      return true
    })
}

function taskImage(task: RuntimeProcessTask): string {
  const postFinishingOrder = findPostFinishingOrder(task)
  if (postFinishingOrder?.skus[0]?.imageUrl) return postFinishingOrder.skus[0].imageUrl
  const index = Math.abs([...task.taskId].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % TASK_IMAGE_BY_INDEX.length
  return TASK_IMAGE_BY_INDEX[index]
}

function statusLabel(task: RuntimeProcessTask): string {
  if (task.assignmentStatus === 'AWARDED') return '已定标'
  if (task.assignmentStatus === 'ASSIGNED') return '已直接派单'
  if (task.assignmentStatus === 'ASSIGNING') return '分配中'
  if (task.assignmentStatus === 'BIDDING') return '竞价中'
  return '待分配'
}

function currentContract(taskId: string) {
  return listProductionContracts({ runtimeTaskId: taskId }).find((item) => item.status === 'EFFECTIVE')
}

function tenderRemainingLabel(deadline: string): string {
  const diff = new Date(deadline.replace(' ', 'T')).getTime() - Date.now()
  if (!Number.isFinite(diff) || diff <= 0) return '已截止'
  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  return hours >= 24 ? `${Math.floor(hours / 24)}天${hours % 24}小时` : `${hours}小时${minutes}分`
}

const columns: StandardListColumn<RuntimeProcessTask>[] = [
  {
    key: 'taskObject', title: '任务对象', width: 300, required: true, freezeable: true,
    render: (task) => {
      if (isKolGotoWholeOrderTask(task)) {
        return '<b>系统固定分配</b><p class="mt-1 text-xs">KOL 整单任务</p><p class="text-xs text-muted-foreground">KOL-GOTO · 已自动接收</p>'
      }
      const context = taskListContext(task)
      return `<div class="flex gap-3"><button class="relative flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden rounded border bg-slate-50" aria-label="查看${escapeHtml(context.spuCode)}高清款式图" data-unified-action="preview-image" data-image="${escapeHtml(taskImage(task))}" data-label="${escapeHtml(context.spuCode)}"><img src="${escapeHtml(taskImage(task))}" alt="${escapeHtml(context.spuCode)}款式实拍图" class="h-full w-full object-cover" onerror="this.hidden=true;this.nextElementSibling.hidden=false"/><span hidden class="px-1 text-center text-[10px] text-red-600">图片加载失败</span></button><div class="min-w-0"><b>${escapeHtml(context.spuCode)}</b><p class="max-w-[190px] truncate text-xs text-muted-foreground">${escapeHtml(context.spuName)}</p><p class="mt-1 text-xs">生产单：${escapeHtml(task.productionOrderNo || task.productionOrderId || '未关联')}</p><p class="text-xs text-muted-foreground">任务：${escapeHtml(task.taskNo || task.taskId)}</p></div></div>`
    },
  },
  {
    key: 'taskContent', title: '任务内容', width: 250, required: true,
    render: (task) => {
      if (isKolGotoWholeOrderTask(task)) {
        return `<p class="font-medium">固定总价：${Number(task.fixedTotalPrice || 0).toLocaleString()} ${escapeHtml(task.fixedTotalPriceCurrency || 'IDR')}/${escapeHtml(task.fixedTotalPriceUnit || '整单')}</p><span class="mt-1 inline-flex rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">生成时冻结</span>`
      }
      const context = taskListContext(task)
      const responsibility = task.mergedTaskType ? getMergedProductionTaskDefinition(task.mergedTaskType).label : ''
      return `<b>${escapeHtml(typeLabel(getTaskType(task)))}</b><p class="mt-1 text-xs">工序：${escapeHtml(processNames(task).join(' + '))}</p><p class="text-xs text-muted-foreground">工艺：${escapeHtml(context.craftLabel)}</p>${responsibility ? `<span class="mt-1 inline-flex rounded bg-violet-50 px-2 py-0.5 text-xs text-violet-700">固定责任范围：${escapeHtml(responsibility)}</span>` : ''}`
    },
  },
  {
    key: 'quantity', title: '数量', width: 130,
    render: (task) => `<b>${(task.scopeSkuLines.length || 1).toLocaleString()} 个SKU</b><p class="mt-1 text-xs text-muted-foreground">${task.scopeQty.toLocaleString()}件</p>`,
  },
  {
    key: 'tracking', title: '跟单责任', width: 150,
    render: (task) => { const context = taskListContext(task); const isSewingOutsourcing = classifyTaskFulfillmentPolicy(task).involvesSewingOutsourcing; return `<b>国内：${escapeHtml(context.domesticTracker)}</b><p class="mt-1 text-xs text-muted-foreground">${isSewingOutsourcing ? '任务PPIC' : '印尼'}：${escapeHtml(context.indonesiaTracker)}</p>` },
  },
  {
    key: 'assignment', title: '分配信息', width: 190,
    render: (task) => {
      const tender = getRuntimeTaskTenderRecord(task.taskId)
      const tenderStatus = tender ? resolveRuntimeTaskTenderStatus(tender) : null
      if (tender && tenderStatus && ['BIDDING', 'AWAIT_AWARD', 'NO_QUOTE'].includes(tenderStatus)) {
        const lowest = tender.quotes.length ? Math.min(...tender.quotes.map((quote) => quote.quotePrice)) : null
        return `<b>${escapeHtml(runtimeTaskTenderStatusLabel[tenderStatus])} · ${escapeHtml(tender.tenderId)}</b><p class="mt-1 text-xs">本次竞价工厂池 ${tender.factoryPool.length} 家</p><p class="text-xs text-muted-foreground">已报价 ${tender.quotes.length}/${tender.factoryPool.length} · ${lowest == null ? '暂无报价' : `当前最低 ${lowest.toLocaleString()} ${escapeHtml(tender.currency)}/${escapeHtml(tender.unit)}`}</p><p class="text-xs text-orange-700">${escapeHtml(tender.biddingDeadline.slice(0, 16))} · ${escapeHtml(tenderRemainingLabel(tender.biddingDeadline))}</p>`
      }
      const assignment = listCurrentEffectiveTaskAssignments(task.taskId)[0]
      const mode = assignmentModeValue(task) === 'BIDDING' ? '竞价' : assignment?.operatedBy.includes('自动分配') ? '自动直接派单' : '人工直接派单'
      const acceptance = task.acceptanceStatus === 'ACCEPTED' ? '已接单' : task.acceptanceStatus === 'REJECTED' ? '已拒绝' : task.assignedFactoryName ? '待接单' : '尚未进入接单'
      return `<b>${escapeHtml(statusLabel(task))}</b><p class="mt-1 text-xs">${escapeHtml(mode)}</p><p class="text-xs text-muted-foreground">${escapeHtml(task.assignedFactoryName || '工厂未确定')} · ${escapeHtml(acceptance)}</p>`
    },
  },
  {
    key: 'price', title: '价格', width: 210,
    render: (task) => {
      const tender = getRuntimeTaskTenderRecord(task.taskId)
      const status = taskPriceStatus(task)
      const currency = task.dispatchPriceCurrency || task.standardPriceCurrency || tender?.currency || 'IDR'
      const unit = task.dispatchPriceUnit || task.standardPriceUnit || tender?.unit || '件'
      const labels: Record<string, string> = { NO_STANDARD: '无标准价', PENDING: '待确认', ABOVE: '高于标准', BELOW: '低于标准', MATCH: '符合标准' }
      const tenderStatus = tender ? resolveRuntimeTaskTenderStatus(tender) : null
      if (tender && tenderStatus && ['BIDDING', 'AWAIT_AWARD', 'NO_QUOTE'].includes(tenderStatus)) return `<p>标准价：${tender.standardPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}</p><p class="mt-1 font-medium text-amber-700">最低允许报价：${tender.minPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}</p><span class="mt-1 inline-flex rounded bg-orange-50 px-2 py-0.5 text-xs text-orange-700">工厂池与最低价已冻结</span>`
      return `<p>标准价：${task.standardPrice != null ? `${task.standardPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}` : '—'}</p><p class="mt-1">派单价：${task.dispatchPrice != null ? `${task.dispatchPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}` : '—'}</p><span class="mt-1 inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs">${escapeHtml(labels[status])}${task.dispatchPrice != null ? ' · 已冻结' : ''}</span>`
    },
  },
  {
    key: 'actions', title: '操作', width: 250, required: true, actionColumn: true,
    render: (task) => {
      const contract = currentContract(task.taskId)
      const kolGotoWholeOrder = isKolGotoWholeOrderTask(task)
      return `<div class="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        <button class="text-blue-600" data-unified-action="open-detail" data-task-id="${escapeHtml(task.taskId)}">详情</button>
        ${!kolGotoWholeOrder && task.assignmentStatus === 'UNASSIGNED' ? `<button class="text-blue-600" data-unified-action="open-direct" data-task-id="${escapeHtml(task.taskId)}">直接派单</button><button class="text-blue-600" data-unified-action="open-bidding" data-task-id="${escapeHtml(task.taskId)}">发起竞价</button>` : ''}
        ${!kolGotoWholeOrder && task.assignmentStatus === 'BIDDING' && getRuntimeTaskTenderRecord(task.taskId) ? `<a class="text-blue-600" href="/fcs/dispatch/tenders?tenderId=${encodeURIComponent(getRuntimeTaskTenderRecord(task.taskId)!.tenderId)}" data-nav="/fcs/dispatch/tenders?tenderId=${encodeURIComponent(getRuntimeTaskTenderRecord(task.taskId)!.tenderId)}">查看竞价</a>` : ''}
        ${!kolGotoWholeOrder && ['ASSIGNED', 'AWARDED'].includes(task.assignmentStatus) && classifyTaskFulfillmentPolicy(task).involvesSewingOutsourcing ? `<button class="text-amber-700" data-unified-action="open-reassign" data-task-id="${escapeHtml(task.taskId)}">改派</button>` : ''}
        ${task.mergeSourceTaskIds?.length && task.assignmentStatus === 'UNASSIGNED' ? `<button class="text-red-600" data-unified-action="open-cancel-merge" data-task-id="${escapeHtml(task.taskId)}">撤销合并</button>` : ''}
        ${contract ? `<button class="text-blue-600" data-unified-action="open-contract" data-contract-id="${escapeHtml(contract.contractId)}">合同</button>` : ''}
        <button class="text-slate-600" data-unified-action="open-log" data-task-id="${escapeHtml(task.taskId)}">日志</button>
      </div>`
    },
  },
]

const preferences: StandardListColumnPreferences = {
  order: columns.filter((column) => !column.actionColumn).map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: ['taskObject'],
  pageSize: 20,
}

function renderTaskTabs(rows: RuntimeProcessTask[]): string {
  const all = listWorkbenchSourceTasks()
  const types: WorkbenchTaskType[] = ['ALL', 'SEWING', 'NON_SEWING', 'MERGED']
  return types.map((type) => {
    const count = type === 'ALL' ? all.length : all.filter((task) => getTaskType(task) === type).length
    return `<button class="rounded-md border px-3 py-2 text-sm ${state.taskType === type ? 'border-blue-600 bg-blue-50 text-blue-700' : 'bg-white'}" data-unified-action="switch-type" data-task-type="${type}">${typeLabel(type)} ${count}</button>`
  }).join('') + `<span class="ml-auto text-xs text-muted-foreground">当前筛选 ${rows.length} 条，每页20条</span>`
}

function filterSelect(key: WorkbenchFilterKey, label: string, options: Array<[string, string]>): string {
  return `<label class="min-w-[148px] flex-1 text-xs text-muted-foreground"><span>${escapeHtml(label)}</span><select class="mt-1 h-9 w-full rounded border bg-white px-2 text-sm text-foreground" data-unified-filter="${key}">${options.map(([value, text]) => `<option value="${escapeHtml(value)}" ${state.filters[key] === value ? 'selected' : ''}>${escapeHtml(text)}</option>`).join('')}</select></label>`
}

function filterDateInput(key: 'dispatchStart' | 'dispatchEnd', label: string): string {
  return `<label class="min-w-[140px] flex-1 text-xs text-muted-foreground"><span>${escapeHtml(label)}</span><input type="date" class="mt-1 h-9 w-full rounded border px-2 text-sm text-foreground" data-unified-filter="${key}" value="${escapeHtml(state.filters[key])}"/></label>`
}

function uniqueOptions(values: Array<[string, string]>): Array<[string, string]> {
  const unique = [...new Map(values.filter(([value]) => value).map((item) => [item[0], item])).values()]
  const labelCounts = new Map<string, number>()
  unique.forEach(([, label]) => labelCounts.set(label, (labelCounts.get(label) || 0) + 1))
  return unique
    .map(([value, label]) => [value, (labelCounts.get(label) || 0) > 1 ? `${label}（${value}）` : label] as [string, string])
    .sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'))
}

const FILTER_LABELS: Partial<Record<WorkbenchFilterKey, string>> = {
  assignmentProgress: '分配进度', assignmentMode: '分配方式', process: '工序', craft: '工艺', factory: '承接工厂',
  priceStatus: '价格状态', domesticTracker: '国内跟单', indonesiaTracker: '印尼跟单', dispatchStart: '派单开始', dispatchEnd: '派单结束',
}

const FILTER_VALUE_LABELS: Partial<Record<WorkbenchFilterKey, Record<string, string>>> = {
  assignmentProgress: { UNASSIGNED: '待分配', ASSIGNING: '分配中', BIDDING: '竞价中', AWARDED: '已定标', ASSIGNED: '已直接派单' },
  assignmentMode: { DIRECT: '人工直接派单', BIDDING: '竞价', AUTO: '自动分配' },
  priceStatus: { NO_STANDARD: '无标准价', PENDING: '派单价待确认', MATCH: '符合标准', ABOVE: '高于标准', BELOW: '低于标准' },
}

function activeFilterValueLabel(key: WorkbenchFilterKey, value: string): string {
  const fixedLabel = FILTER_VALUE_LABELS[key]?.[value]
  if (fixedLabel) return fixedLabel
  const contexts = listWorkbenchSourceTasks().map((task) => ({ task, context: taskListContext(task) }))
  if (key === 'process') return contexts.find(({ context }) => context.processCode === value)?.context.processLabel || value
  if (key === 'craft') return contexts.find(({ context }) => context.craftCode === value)?.context.craftLabel || value
  if (key === 'factory') return contexts.find(({ task }) => task.assignedFactoryId === value)?.task.assignedFactoryName || value
  return value
}

function renderActiveFilters(): string {
  const chips: string[] = []
  if (state.keyword.trim()) chips.push(`<button class="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700" data-unified-action="clear-keyword">关键词：${escapeHtml(state.keyword)} ×</button>`)
  Object.entries(state.filters).forEach(([key, value]) => {
    if (!value || value === 'ALL') return
    const filterKey = key as WorkbenchFilterKey
    chips.push(`<button class="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700" data-unified-action="clear-filter" data-filter-key="${escapeHtml(key)}">${escapeHtml(FILTER_LABELS[filterKey] || key)}：${escapeHtml(activeFilterValueLabel(filterKey, value))} ×</button>`)
  })
  return chips.length ? `<div class="flex flex-wrap items-center gap-2"><span class="text-xs text-muted-foreground">已选条件</span>${chips.join('')}<button class="text-xs text-blue-600" data-unified-action="reset-filters">重置全部</button></div>` : ''
}

function renderTaskFilters(rows: RuntimeProcessTask[]): string {
  const sourceTasks = listWorkbenchSourceTasks()
  const sourceContexts = sourceTasks.map((task) => ({ task, context: taskListContext(task) }))
  const processScoped = sourceContexts.filter(({ context }) => state.filters.process === 'ALL' || context.processCode === state.filters.process)
  const processOptions = uniqueOptions(sourceContexts.map(({ context }) => [context.processCode, context.processLabel]))
  const craftOptions = uniqueOptions(processScoped.map(({ context }) => [context.craftCode, context.craftLabel]))
  const factoryOptions = uniqueOptions(sourceTasks.filter((task) => task.assignedFactoryId).map((task) => [task.assignedFactoryId || '', task.assignedFactoryName || task.assignedFactoryId || '']))
  const domesticOptions = uniqueOptions(sourceContexts.map(({ context }) => [context.domesticTracker, context.domesticTracker]))
  const indonesiaOptions = uniqueOptions(sourceContexts.map(({ context }) => [context.indonesiaTracker, context.indonesiaTracker]))
  const highFrequency = `<div class="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
    <label class="text-xs text-muted-foreground xl:col-span-2"><span>综合搜索</span><input class="mt-1 h-9 w-full rounded border px-3 text-sm text-foreground" placeholder="SPU / 生产单 / 任务 / 工序 / 工艺 / 工厂 / 跟单" data-unified-field="keyword" value="${escapeHtml(state.keyword)}"/></label>
    ${filterSelect('assignmentProgress', '分配进度', [['ALL', '全部'], ['UNASSIGNED', '待分配'], ['ASSIGNING', '分配中'], ['BIDDING', '竞价中'], ['AWARDED', '已定标'], ['ASSIGNED', '已直接派单']])}
    ${filterSelect('assignmentMode', '分配方式', [['ALL', '全部'], ['DIRECT', '人工直接派单'], ['BIDDING', '竞价'], ['AUTO', '自动分配']])}
    ${filterSelect('process', '工序', [['ALL', '全部'], ...processOptions])}
    ${filterSelect('factory', '承接工厂', [['ALL', '全部'], ...factoryOptions])}
    ${filterDateInput('dispatchStart', '派单日期（起）')}
    ${filterDateInput('dispatchEnd', '派单日期（止）')}
    <div class="flex items-end gap-2 xl:col-span-2" data-unified-filter-actions>
      <button class="h-9 rounded border px-3 text-sm text-blue-700" data-unified-action="toggle-advanced-filters">${state.showAdvancedFilters ? '收起更多筛选' : '更多筛选'}</button>
      <button class="h-9 px-3 text-sm text-blue-600" data-unified-action="reset-filters">重置筛选</button>
    </div>
  </div>`
  const advanced = state.showAdvancedFilters ? `<div class="grid gap-2 border-t pt-3 md:grid-cols-2 xl:grid-cols-4" data-unified-advanced-filters>
    ${state.filters.process !== 'ALL' ? filterSelect('craft', '工艺', [['ALL', '全部'], ...craftOptions]) : ''}
    ${filterSelect('domesticTracker', '国内跟单', [['ALL', '全部'], ...domesticOptions])}
    ${filterSelect('indonesiaTracker', '任务PPIC／印尼跟单', [['ALL', '全部'], ...indonesiaOptions])}
    ${filterSelect('priceStatus', '价格状态', [['ALL', '全部'], ['NO_STANDARD', '无标准价'], ['PENDING', '派单价待确认'], ['MATCH', '符合标准'], ['ABOVE', '高于标准'], ['BELOW', '低于标准']])}
  </div>` : ''
  return `<div class="space-y-3 rounded-lg border bg-card p-3"><div class="flex flex-wrap gap-2">${renderTaskTabs(rows)}</div>${highFrequency}${advanced}${renderActiveFilters()}</div>`
}

function renderTaskDetailDialog(): string {
  const task = state.detailTaskId ? resolveWorkbenchTask(state.detailTaskId) : null
  if (!task) return ''
  const context = taskListContext(task)
  const skuRows = (task.scopeSkuLines.length ? task.scopeSkuLines : [{ skuCode: task.skuCode || 'SKU-ALL', color: task.skuColor || '混色', size: task.skuSize || '混码', qty: task.scopeQty }])
  const logMode = state.detailMode === 'LOG'
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-unified-action="close-detail"></button><section class="relative z-10 max-h-[90vh] w-full max-w-4xl overflow-auto rounded-lg bg-white shadow-xl"><header class="flex items-center justify-between border-b p-5"><div><h2 class="text-lg font-semibold">${logMode ? '任务日志' : '任务详情'}</h2><p class="text-xs text-muted-foreground">${escapeHtml(task.productionOrderNo || task.productionOrderId)} · ${escapeHtml(task.taskNo || task.taskId)}</p></div><button data-unified-action="close-detail">关闭</button></header>${logMode ? `<div class="space-y-2 p-5">${[...(task.auditLogs || [])].reverse().map((log) => `<article class="rounded border p-3 text-sm"><div class="flex justify-between gap-3"><b>${escapeHtml(log.action)}</b><span class="text-xs text-muted-foreground">${escapeHtml(log.at)} · ${escapeHtml(log.by)}</span></div><p class="mt-1 text-muted-foreground">${escapeHtml(log.detail)}</p></article>`).join('') || '<p class="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">暂无任务操作日志</p>'}</div>` : `<div class="grid gap-4 p-5 md:grid-cols-2"><section class="rounded border p-4 text-sm"><h3 class="font-semibold">任务对象</h3><dl class="mt-3 grid grid-cols-2 gap-3"><div><dt class="text-muted-foreground">SPU</dt><dd>${escapeHtml(context.spuCode)}</dd></div><div><dt class="text-muted-foreground">款式</dt><dd>${escapeHtml(context.spuName)}</dd></div><div><dt class="text-muted-foreground">任务类型</dt><dd>${escapeHtml(typeLabel(getTaskType(task)))}</dd></div><div><dt class="text-muted-foreground">工序/工艺</dt><dd>${escapeHtml(processNames(task).join(' + '))} / ${escapeHtml(context.craftLabel)}</dd></div></dl></section><section class="rounded border p-4 text-sm"><h3 class="font-semibold">当前分配</h3><dl class="mt-3 grid grid-cols-2 gap-3"><div><dt class="text-muted-foreground">分配进度</dt><dd>${escapeHtml(statusLabel(task))}</dd></div><div><dt class="text-muted-foreground">承接工厂</dt><dd>${escapeHtml(task.assignedFactoryName || '未确定')}</dd></div><div><dt class="text-muted-foreground">国内跟单</dt><dd>${escapeHtml(context.domesticTracker)}</dd></div><div><dt class="text-muted-foreground">印尼跟单</dt><dd>${escapeHtml(context.indonesiaTracker)}</dd></div></dl></section></div><div class="px-5 pb-5"><table class="w-full text-left text-sm"><thead class="bg-slate-50"><tr><th class="p-2">SKU</th><th class="p-2">颜色</th><th class="p-2">尺码</th><th class="p-2">数量</th></tr></thead><tbody>${skuRows.map((line) => `<tr class="border-t"><td class="p-2">${escapeHtml(line.skuCode)}</td><td class="p-2">${escapeHtml(line.color)}</td><td class="p-2">${escapeHtml(line.size)}</td><td class="p-2">${line.qty.toLocaleString()}件</td></tr>`).join('')}</tbody></table></div>`}</section></div>`
}

function renderBaggingOverview(snapshot: DispatchBaggingSnapshot): string {
  return `<section class="rounded-lg border border-blue-200 bg-blue-50/40 p-4" data-unified-bagging-overview>
    <div class="flex flex-wrap items-start justify-between gap-2"><div><h3 class="font-semibold">当前菲票装袋情况 <span class="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">${escapeHtml(snapshot.source)}</span></h3><p class="mt-1 text-xs text-muted-foreground">更新时间：${escapeHtml(snapshot.updatedAt)}。任务数量按件、菲票装袋数量按裁片“片”分别展示，不互相替代。</p></div><button class="rounded border bg-white px-3 py-1.5 text-xs text-blue-700" data-unified-action="refresh-bagging">刷新装袋情况</button></div>
    <dl class="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4"><div><dt class="text-muted-foreground">任务范围</dt><dd class="font-semibold">${snapshot.taskSkuCount} SKU / ${snapshot.taskQty.toLocaleString()}件</dd></div><div><dt class="text-muted-foreground">当前有效袋</dt><dd class="font-semibold">${snapshot.validBagCount}袋</dd></div><div><dt class="text-muted-foreground">已装袋裁片</dt><dd class="font-semibold">${snapshot.baggedPieceQty.toLocaleString()}片</dd></div><div><dt class="text-muted-foreground">未覆盖任务</dt><dd class="font-semibold">${snapshot.unbaggedQty == null ? '待齐套换算' : `${snapshot.unbaggedQty.toLocaleString()}件`}</dd></div><div><dt class="text-muted-foreground">可保持整袋</dt><dd>${snapshot.intactBagCount}袋</dd></div><div><dt class="text-muted-foreground">跨袋SKU</dt><dd>${snapshot.crossBagSkuCount}个</dd></div></dl>
    ${snapshot.warnings.map((warning) => `<p class="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">${escapeHtml(warning)}</p>`).join('')}
    <details class="mt-3"><summary class="cursor-pointer text-sm font-medium text-blue-700">查看 ${snapshot.bags.length} 个袋及菲票明细</summary><div class="mt-2 space-y-2">${snapshot.bags.map((bag) => `<article class="rounded border bg-white p-3 text-xs"><div class="flex flex-wrap justify-between gap-2"><b>${escapeHtml(bag.bagCode)} · ${escapeHtml(bag.status)}</b><span>${escapeHtml(bag.location)} · ${escapeHtml(bag.updatedAt)}</span></div>${bag.mixedProductionOrders ? '<p class="mt-1 font-semibold text-red-700">异常：跨生产单混装，已从推荐中排除</p>' : ''}${bag.handedOver ? '<p class="mt-1 font-semibold text-amber-700">已交出，不作为当前推荐依据</p>' : ''}<div class="mt-2 overflow-auto"><table class="w-full min-w-[640px] text-left"><thead><tr><th>菲票号</th><th>SKU</th><th>颜色/尺码</th><th>裁片</th><th>任务范围</th></tr></thead><tbody>${bag.tickets.map((ticket) => `<tr><td>${escapeHtml(ticket.feiTicketNo)}</td><td>${escapeHtml(ticket.skuCode || '未匹配')}</td><td>${escapeHtml(ticket.color)} / ${escapeHtml(ticket.size)}</td><td>${ticket.pieceQty.toLocaleString()}片</td><td>${ticket.inTaskScope ? '是' : '否'}</td></tr>`).join('')}</tbody></table></div></article>`).join('') || '<p class="rounded border bg-white p-3 text-xs text-muted-foreground">当前没有菲票装袋记录。</p>'}</div></details>
  </section>`
}

function formatPreparationQty(value: number | null, unit = '件'): string {
  if (value == null) return '-'
  return `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}${unit}`
}

function renderSewingPreparationOverview(task: RuntimeProcessTask, selectedSkuCodes: Set<string>): string {
  const sourceLines = task.scopeSkuLines.length
    ? task.scopeSkuLines
    : [{ skuCode: task.skuCode || 'SKU-ALL', color: task.skuColor || '混色', size: task.skuSize || '混码', qty: task.scopeQty }]
  const selectedLines = sourceLines.filter((line) => selectedSkuCodes.has(line.skuCode))
  const policy = classifyTaskFulfillmentPolicy(task)
  const requiresCutPieceRelease = requiresCutPieceReleaseForProcessCodes(policy.normalizedProcessCodes)
  const cutPieceReadiness = getCutPieceDispatchReadinessForTask({
    productionOrderId: task.productionOrderId,
    productionOrderNo: task.productionOrderNo,
    skuLines: selectedLines,
  })
  const materialReadiness = getMaterialPrepDispatchReadinessForTask(task)
  const cutStatusClass = (status: string, dispatchAllowed: boolean) => !dispatchAllowed
    ? 'bg-red-50 text-red-700'
    : status === '已满足'
    ? 'bg-emerald-50 text-emerald-700'
    : status === '待同步' || status === '待维护目标'
      ? 'bg-slate-100 text-slate-600'
      : 'bg-amber-50 text-amber-800'
  const cutRows = cutPieceReadiness.lines.map((line) => `<tr class="border-t align-top">
    <td class="p-2"><b>${escapeHtml(line.skuCode)}</b></td>
    <td class="p-2">${escapeHtml(line.color)} / ${escapeHtml(line.size)}</td>
    <td class="p-2 text-right">${formatPreparationQty(line.taskQty)}</td>
    <td class="p-2 text-right">${formatPreparationQty(line.targetQty)}</td>
    <td class="p-2 text-right">${formatPreparationQty(line.completeKitQty)}</td>
    <td class="p-2 text-right">${formatPreparationQty(line.releaseConfirmQty)}</td>
    <td class="p-2 text-right">${formatPreparationQty(line.allocatedQty)}</td>
    <td class="p-2 text-right font-semibold">${formatPreparationQty(line.availableQty)}</td>
    <td class="p-2 text-right">${formatPreparationQty(line.riskReleaseQty)}</td>
    <td class="p-2"><span class="rounded px-2 py-1 text-xs ${cutStatusClass(line.status, line.dispatchAllowed)}">${escapeHtml(line.dispatchAllowed ? line.status : '阻断')}</span><p class="mt-1 max-w-[300px] text-xs text-muted-foreground">${escapeHtml(line.reason)}</p>${line.allocationTaskIds.length ? `<p class="mt-1 text-[11px] text-blue-700">占用任务：${line.allocationTaskIds.map(escapeHtml).join('、')}</p>` : ''}</td>
  </tr>`).join('')
  const materialRows = materialReadiness.lines.map((line) => `<tr class="border-t align-top">
    <td class="p-2"><div class="flex min-w-[220px] gap-2"><button class="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border bg-slate-50" aria-label="查看${escapeHtml(line.materialName)}高清物料图" data-unified-action="preview-image" data-image="${escapeHtml(line.materialImageUrl)}" data-label="${escapeHtml(line.materialName)}"><img src="${escapeHtml(line.materialImageUrl)}" alt="${escapeHtml(line.materialName)}真实物料图" class="h-full w-full object-cover" onerror="this.hidden=true;this.nextElementSibling.hidden=false"/><span hidden class="px-1 text-center text-[10px] text-red-600">物料图加载失败</span></button><div><b>${escapeHtml(line.materialName)}</b><p class="text-xs text-muted-foreground">${escapeHtml(line.materialSku)}</p><p class="text-xs text-muted-foreground">${escapeHtml(line.color)} · ${escapeHtml(line.spec)}</p></div></div></td>
    <td class="p-2 text-right">${formatPreparationQty(line.requiredQty, line.unit)}</td>
    <td class="p-2 text-right">${formatPreparationQty(line.confirmedPrepQty, line.unit)}</td>
    <td class="p-2 text-right">${formatPreparationQty(line.remainingPrepQty, line.unit)}</td>
    <td class="p-2 text-right">${formatPreparationQty(line.availableStockQty, line.unit)}</td>
    <td class="p-2"><span class="rounded px-2 py-1 text-xs ${line.ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}">${escapeHtml(line.linePrepStatus)}</span><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.upstreamProgressStatus)}${line.upstreamDocumentNo ? ` · ${escapeHtml(line.upstreamDocumentNo)}` : ''}</p></td>
  </tr>`).join('')
  return `<section class="space-y-3" data-unified-sewing-preparation>
    ${requiresCutPieceRelease ? `<article class="rounded-lg border ${cutPieceReadiness.canDispatch ? '' : 'border-red-300 bg-red-50/30'} p-4" data-unified-cut-piece-readiness data-dispatch-allowed="${cutPieceReadiness.canDispatch}">
      <div class="flex flex-wrap items-start justify-between gap-2"><div><h3 class="font-semibold">裁片放行与分配占用（SKU 维度）</h3><p class="mt-1 text-xs ${cutPieceReadiness.canDispatch ? 'text-muted-foreground' : 'font-semibold text-red-700'}">${cutPieceReadiness.canDispatch ? '只有裁床已确认的可分配余量才能分配；风险放行保留风险提示。' : '当前存在无放行或可分配余量不足，本次提交将被阻断。'}</p></div><p class="text-xs text-muted-foreground">${cutPieceReadiness.hasRecord ? `${escapeHtml(cutPieceReadiness.recordNo)} · 更新 ${escapeHtml(cutPieceReadiness.latestUpdatedAt)}` : '尚未读取到裁片放行记录'}</p></div>
      <div class="mt-3 overflow-auto"><table class="w-full min-w-[1120px] text-left text-xs"><thead class="bg-slate-50"><tr><th class="p-2">SKU</th><th class="p-2">颜色/尺码</th><th class="p-2 text-right">本次任务</th><th class="p-2 text-right">裁床目标</th><th class="p-2 text-right">当前齐套</th><th class="p-2 text-right">已确认放行</th><th class="p-2 text-right">已分配占用</th><th class="p-2 text-right">可分配余量</th><th class="p-2 text-right">其中风险放行</th><th class="p-2">状态/说明</th></tr></thead><tbody>${cutRows || '<tr><td colspan="10" class="p-6 text-center text-muted-foreground">当前未选择 SKU。</td></tr>'}</tbody></table></div>
    </article>` : `<article class="rounded-lg border border-blue-200 bg-blue-50/40 p-4" data-unified-material-only-boundary><h3 class="font-semibold">本任务不产生裁片放行或欠片</h3><p class="mt-1 text-xs text-blue-800">裁剪＋车缝＋烫包由承接工厂完成裁剪，PPIC交出的是面料和辅料；系统不会套用裁片放行门禁。</p></article>`}
    <article class="rounded-lg border p-4" data-unified-material-prep-readiness>
      <div class="flex flex-wrap items-start justify-between gap-2"><div><h3 class="font-semibold">本生产单车缝所需辅料的库存与配料情况</h3><p class="mt-1 text-xs text-muted-foreground">数量来自生产单配料事实，不根据任务数量在页面内估算。</p></div><p class="text-xs ${materialReadiness.ready ? 'text-emerald-700' : 'text-amber-700'}">${escapeHtml(materialReadiness.summaryText)}</p></div>
      <div class="mt-3 overflow-auto"><table class="w-full min-w-[900px] text-left text-xs"><thead class="bg-slate-50"><tr><th class="p-2">辅料/物料</th><th class="p-2 text-right">生产单所需</th><th class="p-2 text-right">已确认配料</th><th class="p-2 text-right">未配数量</th><th class="p-2 text-right">当前库存</th><th class="p-2">配料/上游状态</th></tr></thead><tbody>${materialRows || '<tr><td colspan="6" class="p-6 text-center text-muted-foreground">尚未读取到该生产单的车缝辅料配料明细；可继续分配，由 PPIC 按实际情况确认。</td></tr>'}</tbody></table></div>
    </article>
  </section>`
}

function renderReturnRulePreview(
  policy: ReturnType<typeof classifyTaskFulfillmentPolicy>,
  assignedQty: number,
  businessAssignedAt: string,
  mode: AssignMode,
): string {
  if (policy.fulfillmentRuleCode === 'NO_STAGED_RETURN_RULE') return ''
  try {
    const preview = buildProductionReturnRulePreview({ assignedQty, businessAssignedAt, policy })
    if (!preview) return ''
    return `<section class="rounded-lg border border-blue-200 bg-blue-50/40 p-4" data-unified-return-rule-preview>
      <div class="flex flex-wrap items-start justify-between gap-2"><div><h3 class="font-semibold">回货规则预览（自然日）</h3><p class="mt-1 text-xs text-muted-foreground">分配日 ${escapeHtml(preview.assignmentDate)} 为第 1 个自然日；数量为截止当日的累计应回货数量，合同只打印日期，不打印具体时间。</p></div><b class="text-sm">当前计算数量：${preview.assignedQty.toLocaleString()}件</b></div>
      <div class="mt-3 grid gap-2 md:grid-cols-3">${preview.milestones.map((milestone) => `<article class="rounded border bg-white p-3" data-return-ratio="${milestone.ratio}"><p class="text-sm font-semibold">${Math.round(milestone.ratio * 100)}% 回货节点</p><p class="mt-1 text-xs text-muted-foreground">第 ${milestone.naturalDay} 个自然日 · ${escapeHtml(milestone.deadlineDate)}</p><p class="mt-2 text-base font-bold">累计≥ ${milestone.targetQty.toLocaleString()}件</p></article>`).join('')}</div>
      ${mode === 'BIDDING' ? '<p class="mt-2 text-xs text-blue-800">竞价阶段仅预览；定标时使用本次业务分配日期与最终定标任务数量生成有效回货快照。</p>' : ''}
    </section>`
  } catch (error) {
    return `<div class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" data-unified-return-rule-preview-error>${escapeHtml(error instanceof Error ? error.message : '回货规则暂时无法计算')}</div>`
  }
}

function renderBagAwareSelection(snapshot: DispatchBaggingSnapshot, dialog: DispatchDialogState): string {
  return `<section><h3 class="text-sm font-semibold">按装袋关系推荐（整组选择）</h3><p class="mt-1 text-xs text-muted-foreground">同袋或跨袋关联的 SKU 组成一个推荐组。需要拆开组内 SKU 时，请切换“自由分配”。</p><div class="mt-2 space-y-2">${snapshot.recommendationGroups.map((group) => {
    const checked = group.skuCodes.every((skuCode) => dialog.selectedSkuCodes.has(skuCode))
    return `<label class="block rounded-lg border p-3 text-sm ${checked ? 'border-blue-300 bg-blue-50/40' : ''}"><div class="flex items-start gap-2"><input type="checkbox" data-unified-bag-group="${escapeHtml(group.groupId)}" data-sku-codes="${escapeHtml(group.skuCodes.join(','))}" ${checked ? 'checked' : ''}/><div class="min-w-0 flex-1"><div class="flex flex-wrap justify-between gap-2"><b>${escapeHtml(group.groupId)} · ${group.skuCodes.length} 个SKU</b><span>${group.taskQty.toLocaleString()}件</span></div><p class="mt-1">${group.skuCodes.map(escapeHtml).join('、')}</p><p class="mt-1 text-xs text-muted-foreground">关联袋：${group.bagCodes.map(escapeHtml).join('、') || '暂无'} · 已装 ${group.baggedPieceQty.toLocaleString()}片 · 未覆盖任务 ${group.unbaggedQty == null ? '待齐套换算' : `${group.unbaggedQty.toLocaleString()}件`}</p><p class="mt-1 text-xs text-blue-700">${escapeHtml(group.note)}</p></div></div></label>`
  }).join('')}</div></section>`
}

function renderFreeSelection(snapshot: DispatchBaggingSnapshot, dialog: DispatchDialogState): string {
  const impact = evaluateDispatchBagSelection(snapshot, dialog.selectedSkuCodes)
  return `<section><h3 class="text-sm font-semibold">自由选择SKU（同一SKU不能拆数量）</h3><div class="mt-2 grid gap-2 md:grid-cols-2">${snapshot.skuViews.map((line) => `<label class="flex items-start justify-between gap-2 rounded border p-3 text-sm"><span><input type="checkbox" data-unified-sku="${escapeHtml(line.skuCode)}" ${dialog.selectedSkuCodes.has(line.skuCode) ? 'checked' : ''}/> ${escapeHtml(line.skuCode)} · ${escapeHtml(line.color)} · ${escapeHtml(line.size)}<small class="mt-1 block text-muted-foreground">袋：${line.bagCodes.map(escapeHtml).join('、') || '暂无'} · 已装${line.baggedPieceQty.toLocaleString()}片</small></span><b>${line.qty.toLocaleString()}件</b></label>`).join('')}</div><div class="mt-2 rounded bg-slate-50 p-3 text-xs"><b>选择影响：</b>可保持整袋 ${impact.intactBagCodes.length} 袋；受影响 ${impact.affectedBagCodes.length} 袋${impact.affectedBagCodes.length ? `（${impact.affectedBagCodes.map(escapeHtml).join('、')}）` : ''}。不会立即生成拆袋重装待办。</div></section>`
}

function renderPlainSkuSelection(task: RuntimeProcessTask, dialog: DispatchDialogState): string {
  const lines = task.scopeSkuLines.length ? task.scopeSkuLines : [{ skuCode: task.skuCode || 'SKU-ALL', color: task.skuColor || '混色', size: task.skuSize || '混码', qty: task.scopeQty }]
  return `<section><h3 class="text-sm font-semibold">本次分配SKU（同一SKU不能拆数量）</h3><div class="mt-2 grid gap-2 md:grid-cols-2">${lines.map((line) => `<label class="flex items-start justify-between gap-2 rounded border p-3 text-sm"><span><input type="checkbox" data-unified-sku="${escapeHtml(line.skuCode)}" ${dialog.selectedSkuCodes.has(line.skuCode) ? 'checked' : ''}/> ${escapeHtml(line.skuCode)} · ${escapeHtml(line.color)} · ${escapeHtml(line.size)}</span><b>${line.qty.toLocaleString()}件</b></label>`).join('')}</div></section>`
}

function renderWholeTaskDirectDispatchScope(task: RuntimeProcessTask): string {
  const lines = task.scopeSkuLines.length
    ? task.scopeSkuLines
    : [{ skuCode: task.skuCode || 'SKU-ALL', color: task.skuColor || '混色', size: task.skuSize || '混码', qty: task.scopeQty }]
  return `<section class="rounded-lg border border-blue-200 bg-blue-50/30 p-4" data-unified-whole-task-direct-scope><div class="flex flex-wrap items-center justify-between gap-2"><div><h3 class="text-sm font-semibold text-blue-900">本次派单为整个任务</h3><p class="mt-1 text-xs text-blue-800">该任务不按 SKU 拆分；所选工厂承接当前任务的全部范围。</p></div><b class="text-sm text-blue-900">${lines.length} 个SKU，共 ${task.scopeQty.toLocaleString()}件</b></div><details class="mt-3"><summary class="cursor-pointer text-xs font-medium text-blue-800">展开查看任务包含的 SKU 明细</summary><div class="mt-2 grid gap-2 md:grid-cols-2">${lines.map((line) => `<div class="flex items-center justify-between rounded border bg-white p-3 text-sm"><span>${escapeHtml(line.skuCode)} · ${escapeHtml(line.color)} · ${escapeHtml(line.size)}</span><b>${line.qty.toLocaleString()}件</b></div>`).join('')}</div></details></section>`
}

function renderWholeTaskTenderScope(task: RuntimeProcessTask): string {
  const lines = task.scopeSkuLines.length
    ? task.scopeSkuLines
    : [{ skuCode: task.skuCode || 'SKU-ALL', color: task.skuColor || '混色', size: task.skuSize || '混码', qty: task.scopeQty }]
  return `<section class="rounded-lg border border-blue-200 bg-blue-50/30 p-4" data-unified-whole-task-tender-scope><div class="flex flex-wrap items-center justify-between gap-2"><div><h3 class="text-sm font-semibold text-blue-900">本次竞价为整个任务</h3><p class="mt-1 text-xs text-blue-800">不选择、不拆分 SKU；中标工厂承接当前任务的全部范围。</p></div><b class="text-sm text-blue-900">${lines.length} 个SKU，共 ${task.scopeQty.toLocaleString()}件</b></div><details class="mt-3"><summary class="cursor-pointer text-xs font-medium text-blue-800">展开查看完整 SKU 明细</summary><div class="mt-2 grid gap-2 md:grid-cols-2">${lines.map((line) => `<div class="flex items-center justify-between rounded border bg-white p-3 text-sm"><span>${escapeHtml(line.skuCode)} · ${escapeHtml(line.color)} · ${escapeHtml(line.size)}</span><b>${line.qty.toLocaleString()}件</b></div>`).join('')}</div></details></section>`
}

function listVisibleTenderFactoryCandidates(task: RuntimeProcessTask, dialog: DispatchDialogState): Factory[] {
  const keyword = dialog.tenderFactoryKeyword.trim().toLowerCase()
  return listEligibleTenderFactoriesForTask(task)
    .filter((factory) => !dialog.selectedTenderFactoryIds.has(factory.id))
    .filter((factory) => dialog.tenderFactoryType === 'ALL' || factory.factoryType === dialog.tenderFactoryType)
    .filter((factory) => !keyword || [factory.name, factory.code, factory.address, getTenderFactoryCapabilitySummary(factory, task)]
      .some((value) => String(value || '').toLowerCase().includes(keyword)))
}

function renderTenderFactoryCard(factory: Factory, task: RuntimeProcessTask, side: 'CANDIDATE' | 'POOL', checked: boolean): string {
  const inputAttr = side === 'CANDIDATE' ? 'data-unified-tender-candidate' : 'data-unified-tender-pool-factory'
  return `<label class="flex items-start gap-3 rounded border p-3 text-sm ${checked ? 'border-blue-400 bg-blue-50' : 'bg-white'}"><input class="mt-1" type="checkbox" ${inputAttr}="${escapeHtml(factory.id)}" data-unified-tender-selection-field="${side}" data-skip-page-rerender="true" ${checked ? 'checked' : ''}/><span class="min-w-0 flex-1"><b>${escapeHtml(factory.name)}</b><small class="mt-1 block text-muted-foreground">${escapeHtml(factory.code)} · ${escapeHtml(factory.address || '地址未维护')}</small><small class="mt-1 block text-blue-700">${escapeHtml(getTenderFactoryCapabilitySummary(factory, task))} · PDA已启用</small></span></label>`
}

function renderTenderFactoryPool(task: RuntimeProcessTask, dialog: DispatchDialogState): string {
  const allFactories = listEligibleTenderFactoriesForTask(task)
  const visibleCandidates = listVisibleTenderFactoryCandidates(task, dialog)
  const selectedFactories = allFactories.filter((factory) => dialog.selectedTenderFactoryIds.has(factory.id))
  const factoryTypes = Array.from(new Set(allFactories.map((factory) => factory.factoryType))).sort()
  const excludedCount = listBusinessFactoryMasterRecords().length - allFactories.length
  return `<section class="space-y-3 rounded-lg border p-4" data-unified-tender-pool>
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 class="text-sm font-semibold">本次竞价工厂池</h3>
        <p class="mt-1 text-xs text-muted-foreground">候选工厂已同时通过任务能力、允许竞价及 PDA 启用校验。发起后工厂池冻结。</p>
      </div>
      <span class="rounded bg-slate-100 px-2 py-1 text-xs">符合条件 ${allFactories.length} 家 · 排除 ${Math.max(0, excludedCount)} 家</span>
    </div>
    <fieldset class="flex flex-wrap gap-5 text-sm">
      <label><input type="radio" name="tenderPoolMode" data-unified-field="tenderPoolMode" data-skip-page-rerender="true" value="ALL_ELIGIBLE" ${dialog.tenderPoolMode === 'ALL_ELIGIBLE' ? 'checked' : ''}/> 全部符合竞价条件的工厂</label>
      <label><input type="radio" name="tenderPoolMode" data-unified-field="tenderPoolMode" data-skip-page-rerender="true" value="MANUAL" ${dialog.tenderPoolMode === 'MANUAL' ? 'checked' : ''}/> 手动选择部分工厂</label>
    </fieldset>
    ${dialog.tenderPoolMode === 'MANUAL'
      ? `<div class="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)]" data-unified-tender-transfer>
          <section class="flex min-h-80 min-w-0 flex-col overflow-hidden rounded-lg border bg-slate-50/50" data-unified-tender-candidates>
            <header class="border-b bg-white p-3"><div class="flex items-center justify-between gap-2"><b class="text-sm">候选工厂</b><span class="text-xs text-muted-foreground">${visibleCandidates.length} 家可选</span></div><p class="mt-1 text-xs text-muted-foreground">仅展示尚未加入本次工厂池的合格工厂</p></header>
            <div class="grid gap-2 border-b bg-white p-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <label class="text-xs text-muted-foreground">搜索工厂<input class="mt-1 h-9 w-full rounded border px-3 text-sm" data-unified-field="tenderFactoryKeyword" data-skip-page-rerender="true" placeholder="名称 / 编码 / 地址 / 能力" value="${escapeHtml(dialog.tenderFactoryKeyword)}"/></label>
              <label class="text-xs text-muted-foreground">工厂类型<select class="mt-1 h-9 w-full rounded border px-3 text-sm" data-unified-field="tenderFactoryType" data-skip-page-rerender="true"><option value="ALL">全部类型</option>${factoryTypes.map((type) => `<option value="${escapeHtml(type)}" ${dialog.tenderFactoryType === type ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('')}</select></label>
            </div>
            <div class="max-h-80 flex-1 space-y-2 overflow-auto p-2">${visibleCandidates.length
              ? visibleCandidates.map((factory) => renderTenderFactoryCard(factory, task, 'CANDIDATE', dialog.checkedTenderCandidateIds.has(factory.id))).join('')
              : `<p class="p-6 text-center text-sm text-muted-foreground">${selectedFactories.length === allFactories.length && allFactories.length ? '全部符合条件的工厂均已进入右侧工厂池' : '当前筛选条件下没有可选工厂'}</p>`}</div>
          </section>
          <div class="flex items-center justify-center gap-2 lg:flex-col" aria-label="工厂池穿梭操作">
            <button type="button" class="min-w-24 rounded border border-blue-300 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50" data-unified-action="add-checked-tender-factories" title="将左侧勾选工厂加入本次竞价工厂池">加入 &gt;</button>
            <button type="button" class="min-w-24 rounded border px-3 py-2 text-xs hover:bg-slate-50" data-unified-action="add-visible-tender-factories" title="将当前筛选结果全部加入本次竞价工厂池">全部加入 &gt;&gt;</button>
            <button type="button" class="min-w-24 rounded border border-blue-300 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50" data-unified-action="remove-checked-tender-factories" title="将右侧勾选工厂移出本次竞价工厂池">&lt; 移除</button>
            <button type="button" class="min-w-24 rounded border px-3 py-2 text-xs hover:bg-slate-50" data-unified-action="clear-tender-factories" title="清空本次竞价工厂池">&lt;&lt; 全部移除</button>
          </div>
          <section class="flex min-h-80 min-w-0 flex-col overflow-hidden rounded-lg border border-blue-200 bg-blue-50/20" data-unified-tender-selected-pool>
            <header class="border-b border-blue-200 bg-blue-50 p-3"><div class="flex items-center justify-between gap-2"><b class="text-sm text-blue-900">本次竞价工厂池</b><span class="rounded bg-white px-2 py-1 text-xs font-medium text-blue-800">已选 ${selectedFactories.length} 家</span></div><p class="mt-1 text-xs text-blue-800">右侧工厂是本次提交与二次确认的唯一工厂池</p></header>
            <div class="max-h-[25.5rem] flex-1 space-y-2 overflow-auto p-2">${selectedFactories.length
              ? selectedFactories.map((factory) => renderTenderFactoryCard(factory, task, 'POOL', dialog.checkedTenderPoolIds.has(factory.id))).join('')
              : '<p class="p-6 text-center text-sm text-muted-foreground">尚未选择工厂，请从左侧勾选并加入</p>'}</div>
          </section>
        </div>`
      : `<section class="overflow-hidden rounded-lg border border-blue-200 bg-blue-50/20" data-unified-tender-selected-pool><header class="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200 bg-blue-50 p-3"><div><b class="text-sm text-blue-900">本次竞价工厂池（全部符合条件）</b><p class="mt-1 text-xs text-blue-800">系统自动纳入全部合格工厂，切换到手动模式后才能自行增减。</p></div><span class="rounded bg-white px-2 py-1 text-xs font-medium text-blue-800">${allFactories.length} 家</span></header><div class="grid max-h-64 gap-2 overflow-auto p-2 md:grid-cols-2">${allFactories.map((factory) => `<div class="rounded border bg-white p-3 text-sm"><b>${escapeHtml(factory.name)}</b><small class="mt-1 block text-muted-foreground">${escapeHtml(factory.code)} · ${escapeHtml(factory.address || '地址未维护')}</small><small class="mt-1 block text-blue-700">${escapeHtml(getTenderFactoryCapabilitySummary(factory, task))} · PDA已启用</small></div>`).join('') || '<p class="p-6 text-center text-sm text-muted-foreground">当前没有符合条件的工厂</p>'}</div><p class="border-t border-blue-200 p-3 text-xs text-blue-800">页面完整展示全部工厂，提交时不会截断本次工厂池。</p></section>`}
  </section>`
}

function renderReassignmentScope(task: RuntimeProcessTask): string {
  const preview = getRuntimeSewingTaskReassignmentScopePreview(task.taskId)
  if (!preview) return '<section class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">当前任务没有可用的生效车缝分配快照，不能改派。</section>'
  return `<section class="rounded-lg border p-4" data-unified-reassignment-scope><h3 class="text-sm font-semibold">本次改派范围</h3><p class="mt-1 text-xs text-muted-foreground">改派以原有效分配减去截至当前已确认实收数量为准，不在页面内另外勾选 SKU 或修改数量。</p><dl class="mt-3 grid gap-2 text-sm sm:grid-cols-3"><div class="rounded bg-slate-50 p-3"><dt class="text-muted-foreground">原分配数量</dt><dd class="font-semibold">${preview.originalAssignedQty.toLocaleString()}件</dd></div><div class="rounded bg-slate-50 p-3"><dt class="text-muted-foreground">已确认实收</dt><dd class="font-semibold">${preview.confirmedReceivedQty.toLocaleString()}件</dd></div><div class="rounded bg-blue-50 p-3"><dt class="text-blue-700">本次改派数量</dt><dd class="font-bold text-blue-800">${preview.remainingQty.toLocaleString()}件</dd></div></dl></section>`
}

function baggingDecisionSummary(task: RuntimeProcessTask, dialog: DispatchDialogState): string {
  const snapshot = buildDispatchBaggingSnapshot(task)
  const impact = evaluateDispatchBagSelection(snapshot, dialog.selectedSkuCodes)
  return `${dialog.distributionMode === 'BAG_AWARE' ? '按菲票装袋推荐' : '自由分配'}；快照${snapshot.updatedAt}；保持整袋${impact.intactBagCodes.length}袋；受影响${impact.affectedBagCodes.length}袋`
}

function renderTenderPriceSettings(task: RuntimeProcessTask, dialog: DispatchDialogState): string {
  const currency = task.standardPriceCurrency || 'IDR'
  const unit = task.standardPriceUnit || task.qtyUnit || '件'
  return `<section class="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"><div><p class="text-sm text-muted-foreground">工序标准价（平台内部）</p><b>${task.standardPrice != null && task.standardPrice > 0 ? `${task.standardPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}` : '未维护，不能发起竞价'}</b></div><label class="block text-sm">最低允许报价（${escapeHtml(currency)}/${escapeHtml(unit)}）<input type="number" min="1" class="mt-1 h-9 w-full rounded border px-3" data-unified-field="tenderMinPrice" value="${escapeHtml(dialog.tenderMinPrice)}" placeholder="必填；不得高于工序标准价"/><span class="mt-1 block text-xs text-muted-foreground">由计划人员本次手动设定，发起后冻结；达到该价格即可报价，高于标准价时定标需说明原因。</span></label></section>`
}

function renderTenderLaunchConfirmation(task: RuntimeProcessTask, dialog: DispatchDialogState): string {
  const eligible = listEligibleTenderFactoriesForTask(task)
  const poolFactories = dialog.tenderPoolMode === 'ALL_ELIGIBLE'
    ? eligible
    : eligible.filter((factory) => dialog.selectedTenderFactoryIds.has(factory.id))
  const currency = task.standardPriceCurrency || 'IDR'
  const unit = task.standardPriceUnit || task.qtyUnit || '件'
  return `<section class="rounded-lg border-2 border-amber-400 bg-amber-50 p-4" data-unified-tender-second-confirm><h3 class="font-bold text-amber-900">二次确认发起竞价</h3><p class="mt-2 text-sm">任务：${escapeHtml(task.taskNo || task.taskId)} · ${task.scopeSkuLines.length || 1} 个SKU · ${task.scopeQty.toLocaleString()}件</p><p class="mt-1 text-sm">工厂池：${dialog.tenderPoolMode === 'ALL_ELIGIBLE' ? '全部符合条件工厂' : '手动选择部分工厂'} · ${poolFactories.length} 家</p><div class="mt-2 flex flex-wrap gap-2" data-unified-tender-confirmed-factories>${poolFactories.map((factory) => `<span class="rounded border border-amber-300 bg-white px-2 py-1 text-xs">${escapeHtml(factory.name)}</span>`).join('')}</div><p class="mt-2 text-sm">最低允许报价：${escapeHtml(dialog.tenderMinPrice)} ${escapeHtml(currency)}/${escapeHtml(unit)} · 截止：${escapeHtml(dialog.tenderDeadline.replace('T', ' '))}</p><p class="mt-1 text-sm">业务分配时间：${escapeHtml(dialog.businessAssignedAt.replace('T', ' '))}</p><p class="mt-2 font-semibold text-red-700">确认后整个任务进入竞价，本次工厂池、最低允许报价与任务范围全部冻结。</p></section>`
}

function renderDispatchDialog(): string {
  const dialog = state.dispatch
  const task = dialog ? getRuntimeTaskById(dialog.taskId) : null
  if (!dialog || !task) return ''
  const policy = classifyTaskFulfillmentPolicy(task)
  const allowsSkuAssignment = policy.assignmentGranularity === 'SKU'
  const factories = listEligibleFactoriesForTask(task)
  const skuLines = task.scopeSkuLines.length ? task.scopeSkuLines : [{ skuCode: task.skuCode || 'SKU-ALL', color: task.skuColor || '混色', size: task.skuSize || '混码', qty: task.scopeQty }]
  const bagging = buildDispatchBaggingSnapshot(task)
  const impact = evaluateDispatchBagSelection(bagging, dialog.selectedSkuCodes)
  const selectedQty = skuLines.filter((line) => dialog.selectedSkuCodes.has(line.skuCode)).reduce((sum, line) => sum + line.qty, 0)
  const reassignmentScope = dialog.mode === 'REASSIGN' ? getRuntimeSewingTaskReassignmentScopePreview(task.taskId) : null
  const effectiveAssignedQty = dialog.mode === 'REASSIGN'
    ? (reassignmentScope?.remainingQty ?? 0)
    : dialog.mode === 'BIDDING'
      ? task.scopeQty
      : allowsSkuAssignment ? selectedQty : task.scopeQty
  const isSecond = dialog.confirmStage === 2
  const selectedPpic = dialog.factoryId ? getFactoryActivePpicSnapshot(dialog.factoryId) : null
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-unified-action="close-dispatch"></button><section class="relative z-10 max-h-[92vh] w-full max-w-6xl overflow-auto rounded-lg bg-white shadow-xl"><header class="border-b p-5"><h2 class="text-lg font-semibold">${dialog.mode === 'DIRECT' ? '直接派单' : dialog.mode === 'REASSIGN' ? '车缝任务改派' : '发起竞价'} · ${escapeHtml(task.taskNo || task.taskId)}</h2><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(policy.taskTypeLabel)}</p></header><div class="space-y-4 p-5">
    ${dialog.error ? `<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(dialog.error)}</div>` : ''}
    ${isSecond && dialog.mode === 'BIDDING' ? renderTenderLaunchConfirmation(task, dialog) : ''}
    ${isSecond && dialog.mode !== 'BIDDING' ? `<div class="rounded-lg border-2 border-amber-400 bg-amber-50 p-4"><h3 class="font-bold text-amber-900">二次确认${dialog.mode === 'REASSIGN' ? '改派' : '派单'}价格</h3><p class="mt-2 text-base font-semibold text-red-700">谨慎确认价格，一经提交确认不得修改。</p><p class="mt-3 text-sm">工厂：${escapeHtml(factories.find((item) => item.id === dialog.factoryId)?.name || '未选择')} · 数量：${effectiveAssignedQty.toLocaleString()}件 · 派单价：${escapeHtml(dialog.price)} IDR/件</p>${policy.involvesSewingOutsourcing ? `<p class="mt-2 text-sm">本次分配操作人：${escapeHtml(SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName)}（PPIC）</p><p class="mt-2 text-sm">任务PPIC：${escapeHtml(selectedPpic?.ppicName || '工厂归属无效')}（提交后冻结）</p>${policy.startsWithSewing ? `<p class="mt-2 text-sm">分配方式：${dialog.distributionMode === 'BAG_AWARE' ? '按菲票装袋推荐' : '自由分配'} · 可保持整袋 ${impact.intactBagCodes.length} 袋 · 受影响 ${impact.affectedBagCodes.length} 袋</p>` : ''}` : ''}${dialog.mode === 'REASSIGN' ? `<p class="mt-2 text-sm">改派原因：${escapeHtml(dialog.reassignReason)}</p>` : ''}<p class="mt-2 text-xs text-amber-800">提交后价格、分配操作PPIC和任务PPIC均写入本次有效分配；工厂档案后续换人不会静默覆盖当前任务。</p></div>${renderReturnRulePreview(policy, effectiveAssignedQty, dialog.businessAssignedAt, dialog.mode)}` : `
      ${policy.startsWithSewing && dialog.mode !== 'BIDDING' ? `<fieldset><legend class="text-sm font-semibold">分配方式</legend><label class="mr-5 text-sm"><input type="radio" name="distributionMode" data-unified-field="distributionMode" value="BAG_AWARE" ${dialog.distributionMode === 'BAG_AWARE' ? 'checked' : ''}/> 按菲票装袋情况分配（默认）</label><label class="text-sm"><input type="radio" name="distributionMode" data-unified-field="distributionMode" value="FREE" ${dialog.distributionMode === 'FREE' ? 'checked' : ''}/> 自由分配</label><p class="mt-1 text-xs text-muted-foreground">自由分配不生成拆袋重装待办；PPIC实际接收时，裁床待交出仓读取最新车缝任务再决定是否拆袋重装。</p></fieldset>` : ''}
      ${policy.requiresSewingReadinessContext ? `<p class="rounded bg-blue-50 p-2 text-xs text-blue-800">${requiresCutPieceReleaseForProcessCodes(policy.normalizedProcessCodes) ? '裁片类任务必须先有足够放行余量；面辅料准备和风险信息按实际来源展示。' : '本任务由承接工厂完成裁剪；PPIC只交出面料和辅料，不形成裁片欠片。'}</p>${renderSewingPreparationOverview(task, dialog.selectedSkuCodes)}` : ''}
      ${policy.startsWithSewing ? renderBaggingOverview(bagging) : ''}
      ${dialog.baggingNotice ? `<div class="rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">${escapeHtml(dialog.baggingNotice)}</div>` : ''}
      ${dialog.mode === 'BIDDING' ? renderWholeTaskTenderScope(task) : dialog.mode === 'REASSIGN' ? renderReassignmentScope(task) : allowsSkuAssignment ? (policy.startsWithSewing && dialog.distributionMode === 'BAG_AWARE' ? renderBagAwareSelection(bagging, dialog) : policy.startsWithSewing ? renderFreeSelection(bagging, dialog) : renderPlainSkuSelection(task, dialog)) : renderWholeTaskDirectDispatchScope(task)}
      <p class="text-xs">${dialog.mode === 'REASSIGN' ? `本次改派 ${effectiveAssignedQty.toLocaleString()}件` : dialog.mode === 'BIDDING' ? `本次竞价 ${skuLines.length} 个SKU，共 ${task.scopeQty.toLocaleString()}件；不允许拆分` : allowsSkuAssignment ? `已选 ${dialog.selectedSkuCodes.size} 个SKU，共 ${selectedQty.toLocaleString()}件` : `本次整任务分配 ${skuLines.length} 个SKU，共 ${task.scopeQty.toLocaleString()}件；不允许拆分`}</p>
      ${dialog.mode !== 'BIDDING' ? `<label class="block text-sm">承接工厂<select class="mt-1 h-9 w-full rounded border px-3" data-unified-field="factoryId"><option value="">请选择工厂</option>${factories.map((factory) => { const ppic = policy.involvesSewingOutsourcing ? getFactoryActivePpicSnapshot(factory.id) : null; return `<option value="${escapeHtml(factory.id)}" ${dialog.factoryId === factory.id ? 'selected' : ''} ${dialog.mode === 'REASSIGN' && factory.id === task.assignedFactoryId ? 'disabled' : ''}>${escapeHtml(factory.name)}${ppic ? ` · PPIC ${escapeHtml(ppic.ppicName)}` : ''}</option>` }).join('')}</select>${policy.involvesSewingOutsourcing ? `<span class="mt-1 block text-xs ${selectedPpic ? 'text-blue-700' : 'text-muted-foreground'}">${selectedPpic ? `选厂后确定任务PPIC：${escapeHtml(selectedPpic.ppicName)}；提交后冻结。` : '任务PPIC将在选定工厂后确定。'}</span>` : ''}</label><label class="block text-sm">派单价（IDR/件）<input type="number" min="1" class="mt-1 h-9 w-full rounded border px-3" data-unified-field="price" value="${escapeHtml(dialog.price)}"/></label>${dialog.mode === 'REASSIGN' ? `<label class="block text-sm">改派原因<textarea class="mt-1 min-h-20 w-full rounded border p-3" data-unified-field="reassignReason" placeholder="必填，说明本次改派原因">${escapeHtml(dialog.reassignReason)}</textarea></label>` : ''}` : `${renderTenderFactoryPool(task, dialog)}<label class="block text-sm">竞价截止时间<input type="datetime-local" class="mt-1 h-9 w-full rounded border px-3" data-unified-field="tenderDeadline" value="${escapeHtml(dialog.tenderDeadline)}"/></label>`}
      ${dialog.mode === 'BIDDING' ? renderTenderPriceSettings(task, dialog) : ''}
      <label class="block text-sm">业务分配日期/时间<input type="datetime-local" class="mt-1 h-9 w-full rounded border px-3" data-unified-field="businessAssignedAt" value="${escapeHtml(dialog.businessAssignedAt)}"/><span class="mt-1 block text-xs text-muted-foreground">回货规则按日期计算，分配日期为第1个自然日；合同只打印日期，不打印具体时间。</span></label>
      ${renderReturnRulePreview(policy, effectiveAssignedQty, dialog.businessAssignedAt, dialog.mode)}
      ${policy.startsWithSewing ? `<div class="rounded bg-amber-50 p-3 text-sm text-amber-800">准备数据、库存风险、多个来源袋及混装袋只用于提示，不阻断派单或竞价。${dialog.mode === 'BIDDING' ? '竞价为整个任务，装袋事实不用于拆分竞价范围。' : ''}</div>` : ''}`}
    </div><footer class="flex justify-end gap-2 border-t p-4"><button class="rounded border px-4 py-2 text-sm" data-unified-action="${isSecond ? 'back-dispatch' : 'close-dispatch'}">${isSecond ? '返回修改' : '取消'}</button><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-unified-action="confirm-dispatch">${isSecond ? dialog.mode === 'BIDDING' ? '确认发起竞价并冻结工厂池与最低价' : '确认提交并冻结价格' : dialog.mode === 'BIDDING' ? '下一步：二次确认竞价' : '下一步：二次确认价格'}</button></footer></section></div>`
}

function renderMergeDialog(): string {
  const dialog = state.merge
  if (!dialog) return ''
  const tasks = dialog.taskIds.map((id) => getRuntimeTaskById(id)).filter((item): item is RuntimeProcessTask => Boolean(item))
  if (dialog.mode === 'CANCEL') {
    const task = tasks[0]
    return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-unified-action="close-merge"></button><section class="relative z-10 w-full max-w-xl rounded-lg bg-white shadow-xl"><header class="border-b p-5"><h2 class="text-lg font-semibold">撤销合并任务</h2></header><div class="space-y-3 p-5">${dialog.error ? `<div class="rounded bg-red-50 p-3 text-sm text-red-700">${escapeHtml(dialog.error)}</div>` : ''}<p class="text-sm">撤销后恢复原源任务；创建和撤销记录都会保留。</p><div class="rounded border p-3 text-sm">${escapeHtml(task?.productionOrderNo || task?.productionOrderId || '')} · ${escapeHtml(task?.taskNo || task?.taskId || '')} · ${escapeHtml(task?.processNameZh || '')}</div>${dialog.confirmStage === 2 ? '<div class="rounded border-2 border-amber-400 bg-amber-50 p-3 font-semibold">请再次确认撤销。只有尚未分配、未开工的合并任务可以撤销。</div>' : ''}</div><footer class="flex justify-end gap-2 border-t p-4"><button class="rounded border px-4 py-2" data-unified-action="close-merge">取消</button><button class="rounded bg-red-600 px-4 py-2 text-white" data-unified-action="confirm-merge">${dialog.confirmStage === 1 ? '下一步确认' : '确认撤销'}</button></footer></section></div>`
  }

  const keyword = dialog.productionOrderKeyword.trim().toLowerCase()
  const orderCandidates = Array.from(new Map(
    listRuntimeProcessTasks()
      .filter((task) => isAssignableProductionExecutionTask(task) && task.taskUnitType === 'SINGLE_PROCESS_TASK')
      .filter((task) => ['CUTTING', 'SEWING', 'IRON_PACK'].includes(normalizeProductionExecutionProcessCode(task.processBusinessCode || task.processCode, task.processNameZh)))
      .filter((task) => !keyword || [task.productionOrderNo, task.productionOrderId].some((value) => String(value || '').toLowerCase().includes(keyword)))
      .map((task) => [task.productionOrderId, task]),
  ).values()).slice(0, 8)
  const orderTasks = dialog.productionOrderId
    ? listRuntimeProcessTasks()
        .filter((task) => task.productionOrderId === dialog.productionOrderId)
        .filter((task) => task.taskUnitType === 'SINGLE_PROCESS_TASK')
        .filter((task) => ['CUTTING', 'SEWING', 'IRON_PACK'].includes(normalizeProductionExecutionProcessCode(task.processBusinessCode || task.processCode, task.processNameZh)))
    : []
  const evaluation = evaluateFixedMergedTask(dialog.taskIds)
  const definition = evaluation.mergedTaskType ? getMergedProductionTaskDefinition(evaluation.mergedTaskType) : null
  const blockingSpecialCraftOrders = definition?.type === 'CUTTING_SEWING_IRON_PACK' && tasks[0]
    ? listBlockingSpecialCraftTaskOrdersForMergedTask(tasks[0].productionOrderId)
    : []
  const mergeAllowed = evaluation.ok && blockingSpecialCraftOrders.length === 0
  const evaluationMessage = blockingSpecialCraftOrders.length > 0
    ? `已有${blockingSpecialCraftOrders.length}张中央辅助/特种工艺加工单开始执行，不能再创建裁剪+车缝+烫包。`
    : evaluation.message

  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-unified-action="close-merge"></button><section class="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-auto rounded-lg bg-white shadow-xl"><header class="border-b p-5"><h2 class="text-lg font-semibold">创建合并任务</h2><p class="mt-1 text-xs text-muted-foreground">只允许“车缝+烫包”和“裁剪+车缝+烫包”两种固定模式。</p></header><div class="space-y-4 p-5">
    <section><label class="text-sm font-medium">1. 搜索生产单</label><input class="mt-2 h-10 w-full rounded border px-3 text-sm" placeholder="输入生产单号或SPU" data-unified-merge-field="productionOrderKeyword" value="${escapeHtml(dialog.productionOrderKeyword)}"/><div class="mt-2 grid gap-2 sm:grid-cols-2">${orderCandidates.map((task) => `<button class="rounded border p-3 text-left text-sm ${dialog.productionOrderId === task.productionOrderId ? 'border-blue-600 bg-blue-50' : ''}" data-unified-action="select-merge-order" data-production-order-id="${escapeHtml(task.productionOrderId)}"><b>${escapeHtml(task.productionOrderNo || task.productionOrderId)}</b><p class="text-xs text-muted-foreground">${escapeHtml(task.productionOrderId)}</p></button>`).join('') || '<p class="text-sm text-muted-foreground">没有匹配的生产单</p>'}</div></section>
    <section><h3 class="text-sm font-medium">2. 选择该生产单下的源任务</h3><div class="mt-2 overflow-hidden rounded border"><table class="w-full text-sm"><thead class="bg-slate-50"><tr><th class="p-2 text-left">选择</th><th class="p-2 text-left">任务</th><th class="p-2 text-left">工序</th><th class="p-2 text-left">数量</th><th class="p-2 text-left">状态</th></tr></thead><tbody>${orderTasks.map((task) => { const selectable = isAssignableProductionExecutionTask(task) && task.assignmentStatus === 'UNASSIGNED' && task.status === 'NOT_STARTED' && !task.isSplitSource && !task.isSplitResult && !task.mergedIntoTaskId; const reason = selectable ? '可选择' : task.mergedIntoTaskId ? '已并入其他合并任务' : task.assignmentStatus !== 'UNASSIGNED' ? '已进入分配' : task.status !== 'NOT_STARTED' ? '已开工' : '任务不可合并'; return `<tr class="border-t"><td class="p-2"><input type="checkbox" data-unified-merge-source="${escapeHtml(task.taskId)}" ${dialog.taskIds.includes(task.taskId) ? 'checked' : ''} ${selectable ? '' : 'disabled'}/></td><td class="p-2">${escapeHtml(task.taskNo || task.taskId)}</td><td class="p-2">${escapeHtml(task.processNameZh)}</td><td class="p-2">${task.scopeQty.toLocaleString()}件</td><td class="p-2 ${selectable ? 'text-green-700' : 'text-amber-700'}">${escapeHtml(reason)}</td></tr>` }).join('') || '<tr><td colspan="5" class="p-6 text-center text-muted-foreground">请先选择生产单</td></tr>'}</tbody></table></div></section>
    <section><h3 class="text-sm font-medium">3. 系统识别与责任影响</h3>${dialog.taskIds.length ? `<div class="mt-2 rounded ${mergeAllowed ? 'border border-green-300 bg-green-50 text-green-800' : 'border border-red-200 bg-red-50 text-red-700'} p-3 text-sm"><b>${escapeHtml(mergeAllowed && definition ? `已识别：${definition.label}` : '不能创建')}</b><p class="mt-1">${escapeHtml(evaluationMessage)}</p>${definition ? `<p class="mt-2">辅助工艺、特种工艺：${definition.auxiliarySpecialExecutorMode === 'CENTRAL_FACTORY' ? '仍由中央工厂执行并继续生成加工单' : '随本合并任务交给三方工厂，不生成中央加工单'}</p><p>分配颗粒度：${definition.assignmentGranularity === 'SKU' ? '完整SKU' : '整张合并任务'}</p>` : ''}</div>` : '<p class="mt-2 rounded bg-slate-50 p-3 text-sm text-muted-foreground">请选择完整源任务集合。</p>'}</section>
    ${dialog.error ? `<div class="rounded bg-red-50 p-3 text-sm text-red-700">${escapeHtml(dialog.error)}</div>` : ''}
    ${dialog.confirmStage === 2 && definition ? `<div class="rounded border-2 border-amber-400 bg-amber-50 p-3 font-semibold">请再次确认：将生产单 ${escapeHtml(tasks[0]?.productionOrderNo || tasks[0]?.productionOrderId || dialog.productionOrderId)} 的 ${escapeHtml(tasks.map((task) => task.processNameZh).join('任务、'))}任务合并为“${escapeHtml(definition.label)}”。原任务保留历史，但不能再单独分配。</div>` : ''}
    </div><footer class="flex justify-end gap-2 border-t p-4"><button class="rounded border px-4 py-2" data-unified-action="close-merge">取消</button><button class="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50" data-unified-action="confirm-merge" ${mergeAllowed ? '' : 'disabled'}>${dialog.confirmStage === 1 ? '下一步确认' : '确认创建'}</button></footer></section></div>`
}

function renderContractPrompt(): string {
  const contract = state.contractPromptId ? getProductionContract(state.contractPromptId) : undefined
  if (!contract) return ''
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-unified-action="close-contract-prompt"></button><section class="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-xl"><h2 class="text-lg font-semibold">生产合同已生成</h2><p class="mt-3 text-sm">${escapeHtml(contract.contractNo)} · ${escapeHtml(contract.factoryName)} · ${contract.assignedQty}件</p><p class="mt-2 text-xs text-muted-foreground">是否立即打印合同？合同可查看/打印，也可上传签订后的合同扫描图；未上传扫描图不阻断生产。</p><div class="mt-5 flex flex-wrap justify-end gap-2"><button class="rounded border px-4 py-2" data-unified-action="close-contract-prompt">关闭</button><button class="rounded border border-blue-300 px-4 py-2 text-blue-700" data-unified-action="open-upload" data-contract-id="${escapeHtml(contract.contractId)}">上传扫描图</button><a class="rounded bg-blue-600 px-4 py-2 text-white" target="_blank" href="/fcs/contracts/print?contractId=${encodeURIComponent(contract.contractId)}">查看/打印合同</a></div></section></div>`
}

function renderUploadDialog(): string {
  const contract = state.uploadContractId ? getProductionContract(state.uploadContractId) : undefined
  if (!contract) return ''
  const failedNames = state.failedUploadNamesByContract[contract.contractId] || []
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-unified-action="close-upload"></button><section class="relative z-10 max-h-[88vh] w-full max-w-2xl overflow-auto rounded-lg bg-white shadow-xl"><header class="border-b p-5"><h2 class="text-lg font-semibold">签订合同扫描图</h2><p class="text-xs text-muted-foreground">${escapeHtml(contract.contractNo)} · 支持多张JPG/PNG，可预览、排序和删除</p></header><div class="p-5"><label class="block rounded-lg border-2 border-dashed p-5 text-center text-sm">选择扫描图片<input type="file" accept="image/jpeg,image/png" multiple class="mt-3 block w-full" data-unified-contract-files="${escapeHtml(contract.contractId)}"/></label>${failedNames.length ? `<div class="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"><b>${failedNames.length}张上传失败，其他成功图片已保留：</b>${failedNames.map(escapeHtml).join('、')}<button class="ml-3 text-blue-700 underline" data-unified-action="retry-failed-scan" data-contract-id="${escapeHtml(contract.contractId)}">只重试失败图片</button></div>` : ''}<div class="mt-4 grid gap-3 sm:grid-cols-2">${contract.scans.map((scan) => `<article class="rounded border p-2"><button class="relative flex h-40 w-full items-center justify-center overflow-hidden bg-slate-50" data-unified-action="preview-image" data-image="${escapeHtml(scan.dataUrl)}" data-label="${escapeHtml(scan.fileName)}"><img src="${escapeHtml(scan.dataUrl)}" alt="合同扫描图${scan.sortOrder}" class="h-full w-full object-contain" onerror="this.hidden=true;this.nextElementSibling.hidden=false"/><span hidden class="text-sm text-red-600">扫描图加载失败</span></button><div class="mt-2 flex items-center justify-between gap-2 text-xs"><span>${scan.sortOrder}. ${escapeHtml(scan.fileName)}</span><span class="flex gap-2"><button class="text-blue-600" data-unified-action="reorder-scan" data-direction="UP" data-contract-id="${escapeHtml(contract.contractId)}" data-scan-id="${escapeHtml(scan.scanId)}">上移</button><button class="text-blue-600" data-unified-action="reorder-scan" data-direction="DOWN" data-contract-id="${escapeHtml(contract.contractId)}" data-scan-id="${escapeHtml(scan.scanId)}">下移</button><button class="text-red-600" data-unified-action="remove-scan" data-contract-id="${escapeHtml(contract.contractId)}" data-scan-id="${escapeHtml(scan.scanId)}">删除</button></span></div></article>`).join('') || '<p class="col-span-2 py-8 text-center text-sm text-muted-foreground">尚未上传签订扫描图</p>'}</div></div><footer class="flex justify-end border-t p-4"><button class="rounded bg-blue-600 px-4 py-2 text-white" data-unified-action="close-upload">完成</button></footer></section></div>`
}

function renderAutoDispatchDialog(): string {
  const dialog = state.autoDispatch
  if (!dialog) return ''
  if (dialog.mode === 'CONFIG') {
    const definitions = autoDispatchDefinitions()
    const configs = new Map(ensureAutoDispatchConfigs().map((item) => [item.ruleKey, item]))
    return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-unified-action="close-auto-dispatch"></button><section class="relative z-10 max-h-[92vh] w-full max-w-6xl overflow-auto rounded-lg bg-white shadow-xl"><header class="border-b p-5"><h2 class="text-lg font-semibold">自动分配配置</h2><p class="mt-1 text-sm text-muted-foreground">车缝、合并任务、整单任务和生产准备加工单不参与自动分配。非车缝独立生产任务命中配置后，按任务标准价直接派单。</p></header><div class="p-5">${dialog.error ? `<div class="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(dialog.error)}</div>` : ''}<div class="overflow-auto rounded-lg border"><table class="w-full min-w-[1050px] text-left text-sm"><thead class="bg-slate-50"><tr><th class="p-3">启用</th><th class="p-3">工序工艺</th><th class="p-3">分配方式</th><th class="p-3">分配粒度</th><th class="p-3">价格来源</th><th class="p-3">默认承接工厂</th><th class="p-3">任务截止天数</th><th class="p-3">更新</th></tr></thead><tbody>${definitions.map((definition) => {
      const config = configs.get(definition.ruleKey)!
      const factories = listEligibleFactoriesForTask(definition.sampleTask)
      const granularity = classifyTaskFulfillmentPolicy(definition.sampleTask).assignmentGranularity === 'SKU' ? 'SKU（不拆数量）' : '整任务'
      return `<tr class="border-t"><td class="p-3"><input type="checkbox" data-auto-config-field="enabled" data-rule-key="${escapeHtml(config.ruleKey)}" ${config.enabled ? 'checked' : ''}/></td><td class="p-3"><b>${escapeHtml(config.processName)}${config.craftName ? ` / ${escapeHtml(config.craftName)}` : ''}</b><p class="text-xs text-muted-foreground">${escapeHtml(config.processCode)}${config.craftCode ? ` / ${escapeHtml(config.craftCode)}` : ''} · ${definition.taskCount}个任务</p></td><td class="p-3">直接派单</td><td class="p-3">${granularity}</td><td class="p-3">任务/技术包标准价</td><td class="p-3"><select class="h-9 min-w-52 rounded border px-2" data-auto-config-field="factoryId" data-rule-key="${escapeHtml(config.ruleKey)}"><option value="">请选择</option>${factories.map((factory) => `<option value="${escapeHtml(factory.id)}" ${factory.id === config.factoryId ? 'selected' : ''}>${escapeHtml(factory.name)}</option>`).join('')}</select></td><td class="p-3"><input type="number" min="1" max="90" class="h-9 w-24 rounded border px-2" data-auto-config-field="deadlineDays" data-rule-key="${escapeHtml(config.ruleKey)}" value="${config.deadlineDays}"/> 自然日</td><td class="p-3 text-xs text-muted-foreground">${escapeHtml(config.updatedAt)}</td></tr>`
    }).join('') || '<tr><td colspan="8" class="p-8 text-center text-muted-foreground">当前没有可配置的非车缝独立生产任务</td></tr>'}</tbody></table></div></div><footer class="flex justify-end gap-2 border-t p-4"><button class="rounded border px-4 py-2" data-unified-action="close-auto-dispatch">关闭</button><button class="rounded bg-blue-600 px-4 py-2 text-white" data-unified-action="save-auto-config">保存自动分配配置</button></footer></section></div>`
  }
  const preview = buildAutoDispatchPreview()
  const totalAmount = preview.eligible.reduce((sum, item) => sum + item.task.scopeQty * item.price, 0)
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-unified-action="close-auto-dispatch"></button><section class="relative z-10 max-h-[92vh] w-full max-w-5xl overflow-auto rounded-lg bg-white shadow-xl"><header class="border-b p-5"><h2 class="text-lg font-semibold">执行自动分配</h2><p class="mt-1 text-sm text-muted-foreground">仅处理待分配、允许自动分配、已启用工序配置的非车缝独立生产任务。</p></header><div class="space-y-4 p-5">${dialog.error ? `<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(dialog.error)}</div>` : ''}<dl class="grid grid-cols-2 gap-3 md:grid-cols-5"><div class="rounded border p-3"><dt class="text-xs text-muted-foreground">扫描待分配</dt><dd class="mt-1 text-xl font-bold">${preview.unassignedCount}</dd></div><div class="rounded border border-green-200 bg-green-50 p-3"><dt class="text-xs text-green-700">本次可自动派单</dt><dd class="mt-1 text-xl font-bold text-green-700">${preview.eligible.length}</dd></div><div class="rounded border p-3"><dt class="text-xs text-muted-foreground">车缝/合并/不可自动</dt><dd class="mt-1 text-xl font-bold">${preview.excludedSewingOrMerged}</dd></div><div class="rounded border p-3"><dt class="text-xs text-muted-foreground">未启用配置</dt><dd class="mt-1 text-xl font-bold">${preview.missingConfig}</dd></div><div class="rounded border p-3"><dt class="text-xs text-muted-foreground">工厂/价格异常</dt><dd class="mt-1 text-xl font-bold">${preview.invalidFactory + preview.invalidPrice}</dd></div></dl>${dialog.confirmStage === 2 ? `<div class="rounded-lg border-2 border-amber-400 bg-amber-50 p-4"><h3 class="font-bold text-amber-900">二次确认批量自动派单</h3><p class="mt-2 font-semibold text-red-700">谨慎确认价格，一经提交确认不得修改。</p><p class="mt-2 text-sm">将一次性派单 ${preview.eligible.length} 个任务，共 ${preview.eligible.reduce((sum, item) => sum + item.task.scopeQty, 0).toLocaleString()}件，预计加工费 ${totalAmount.toLocaleString()} IDR。每个任务的工厂、价格和截止日期将写入派单记录。</p></div>` : ''}<div class="overflow-auto rounded border"><table class="w-full min-w-[800px] text-left text-sm"><thead class="bg-slate-50"><tr><th class="p-3">生产单/任务</th><th class="p-3">工序</th><th class="p-3">数量</th><th class="p-3">工厂</th><th class="p-3">冻结价</th><th class="p-3">截止规则</th></tr></thead><tbody>${preview.eligible.slice(0, 20).map((item) => `<tr class="border-t"><td class="p-3"><b>${escapeHtml(item.task.productionOrderNo || item.task.productionOrderId)}</b><p class="text-xs text-muted-foreground">${escapeHtml(item.task.taskNo || item.task.taskId)}</p></td><td class="p-3">${escapeHtml(item.task.processNameZh)}</td><td class="p-3">${item.task.scopeQty.toLocaleString()}件</td><td class="p-3">${escapeHtml(item.factory.name)}</td><td class="p-3">${item.price.toLocaleString()} ${escapeHtml(item.task.standardPriceCurrency || 'IDR')}/${escapeHtml(item.task.standardPriceUnit || '件')}</td><td class="p-3">分配后第${item.config.deadlineDays}个自然日</td></tr>`).join('') || '<tr><td colspan="6" class="p-8 text-center text-muted-foreground">当前没有可执行的自动分配任务，请先完成配置或处理价格/工厂异常。</td></tr>'}</tbody></table></div>${preview.eligible.length > 20 ? `<p class="text-xs text-muted-foreground">仅展示前20项，确认后将处理全部 ${preview.eligible.length} 项。</p>` : ''}</div><footer class="flex justify-end gap-2 border-t p-4"><button class="rounded border px-4 py-2" data-unified-action="${dialog.confirmStage === 2 ? 'back-auto-execute' : 'close-auto-dispatch'}">${dialog.confirmStage === 2 ? '返回预览' : '取消'}</button><button class="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50" data-unified-action="confirm-auto-execute" ${preview.eligible.length ? '' : 'disabled'}>${dialog.confirmStage === 1 ? '下一步：二次确认' : '确认执行并冻结价格'}</button></footer></section></div>`
}

function executeAutomaticDispatch(): { succeeded: number; failed: string[] } {
  const preview = buildAutoDispatchPreview()
  const operatedAt = formatOperationLocalWallClock()
  const failed: string[] = []
  let succeeded = 0
  preview.eligible.forEach(({ task, config, factory, price }) => {
    try {
      const updated = applyRuntimeDirectDispatchMeta({
        taskId: task.taskId,
        factoryId: factory.id,
        factoryName: factory.name,
        acceptDeadline: '',
        taskDeadline: addNaturalDays(operatedAt, config.deadlineDays),
        remark: `按自动分配配置${config.ruleKey}直接派单；价格来源：任务/技术包标准价`,
        by: '生产计划员（自动分配）',
        dispatchPrice: price,
        dispatchPriceCurrency: task.standardPriceCurrency || 'IDR',
        dispatchPriceUnit: task.standardPriceUnit || '件',
        priceDiffReason: '',
        businessAssignedAt: operatedAt,
        operatedAt,
        autoAccept: false,
      })
      if (!updated) throw new Error('派单状态写入失败')
      const skuLines = updated.scopeSkuLines.length ? updated.scopeSkuLines : [{ skuCode: updated.skuCode || 'SKU-ALL', color: updated.skuColor || '混色', size: updated.skuSize || '混码', qty: updated.scopeQty }]
      createEffectiveTaskAssignment({
        runtimeTaskId: updated.taskId,
        productionOrderId: updated.productionOrderId || 'UNKNOWN-PO',
        productionOrderNo: updated.productionOrderNo,
        taskNo: updated.taskNo,
        factoryId: factory.id,
        factoryName: factory.name,
        source: 'DIRECT_DISPATCH',
        assignedQty: updated.scopeQty,
        skuLines: skuLines.map((line) => ({ ...line })),
        processCodes: classifyTaskFulfillmentPolicy(updated).normalizedProcessCodes,
        frozenPrice: price,
        priceCurrency: updated.standardPriceCurrency || 'IDR',
        priceUnit: updated.standardPriceUnit || '件',
        businessAssignedAt: operatedAt,
        operatedAt,
        operatedBy: '生产计划员（自动分配）',
      })
      succeeded += 1
    } catch (error) {
      automaticDispatchFailures.add(task.taskId)
      failed.push(`${task.taskNo || task.taskId}：${error instanceof Error ? error.message : '执行失败'}`)
    }
  })
  return { succeeded, failed }
}

function renderImagePreview(): string { return '<div data-unified-image-preview></div>' }

export function renderUnifiedDispatchWorkbenchPage(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const querySignature = `${window.location.pathname}?${params.toString()}`
    const workbenchMounted = Boolean(document.querySelector('[data-unified-dispatch-page]'))
    const shouldApplyQuery = !workbenchMounted || appliedQuerySignature !== querySignature
    const queryType = params.get('type') as WorkbenchTaskType | null
    if (shouldApplyQuery) {
      if (params.get('source') === 'post-finishing') state.taskType = 'ALL'
      if (queryType && ['ALL', 'SEWING', 'NON_SEWING', 'MERGED'].includes(queryType)) state.taskType = queryType
      state.keyword = params.get('keyword') || ''
      state.page = 1
      const contractId = params.get('contractId')
      if (contractId && getProductionContract(contractId)?.status === 'EFFECTIVE') state.uploadContractId = contractId
      appliedQuerySignature = querySignature
    }
  }
  const rows = taskRows()
  const pageSize = 20
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  state.page = Math.min(Math.max(1, state.page), pageCount)
  const pageRows = rows.slice((state.page - 1) * pageSize, state.page * pageSize)
  const all = listWorkbenchSourceTasks()
  const assigned = all.filter((task) => ['ASSIGNED', 'AWARDED'].includes(task.assignmentStatus)).length
  const failedContracts = listProductionContracts().filter((item) => item.status === 'GENERATION_FAILED')
  const content = renderStandardListPage({
    title: '任务分配工作台',
    primaryActionsHtml: `<div class="flex flex-wrap gap-2">${failedContracts.map((contract) => `<button class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700" data-unified-action="retry-contract" data-contract-id="${contract.contractId}">重试合同 ${escapeHtml(contract.contractNo)}</button>`).join('')}<button class="rounded border px-4 py-2 text-sm" data-unified-action="open-auto-config">自动分配配置</button><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-unified-action="open-auto-execute">执行自动分配</button><button class="rounded bg-violet-600 px-4 py-2 text-sm text-white" data-unified-action="open-merge">合并任务</button></div>`,
    feedbackHtml: state.feedback ? `<div class="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">${escapeHtml(state.feedback)}</div>` : '',
    filtersHtml: renderTaskFilters(rows),
    statsHtml: renderStandardListStats([
      { label: '全部可执行任务', value: all.length },
      { label: '待分配 / 竞价中', value: all.length - assigned },
      { label: '已确认工厂', value: assigned },
    ]),
    listTitle: '统一任务列表',
    listActionsHtml: '<span class="text-xs text-muted-foreground">直接派单与竞价共用同一任务口径；价格在直接派单提交或竞价定标时二次确认并冻结</span>',
    tableHtml: renderStandardListTable({ columns, rows: pageRows, preferences, sort: null, eventPrefix: 'unified-dispatch', emptyText: '当前筛选下暂无任务' }),
    paginationHtml: renderTablePagination({ total: rows.length, from: rows.length ? (state.page - 1) * pageSize + 1 : 0, to: Math.min(state.page * pageSize, rows.length), currentPage: state.page, totalPages: pageCount, pageSize, actionPrefix: 'unified', fieldPrefix: 'unified', pageSizeOptions: [20] }),
    overlaysHtml: `${renderTaskDetailDialog()}${renderDispatchDialog()}${renderMergeDialog()}${renderAutoDispatchDialog()}${renderContractPrompt()}${renderUploadDialog()}${renderImagePreview()}`,
  })
  return `<div data-unified-dispatch-page data-skip-page-rerender="true">${content}</div>`
}

function refreshRoot(): void {
  const root = document.querySelector<HTMLElement>('[data-unified-dispatch-page]')
  if (root) root.outerHTML = renderUnifiedDispatchWorkbenchPage()
}

function refreshTenderFactoryPool(focusField = ''): void {
  const task = state.dispatch ? getRuntimeTaskById(state.dispatch.taskId) : null
  const current = document.querySelector<HTMLElement>('[data-unified-tender-pool]')
  if (!state.dispatch || state.dispatch.mode !== 'BIDDING' || !task || !current) {
    refreshRoot()
    return
  }
  current.outerHTML = renderTenderFactoryPool(task, state.dispatch)
  if (!focusField) return
  const next = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-unified-field="${focusField}"]`)
  next?.focus()
  if (next instanceof HTMLInputElement) next.setSelectionRange(next.value.length, next.value.length)
}

function openDispatch(taskId: string, mode: AssignMode): void {
  const task = getRuntimeTaskById(taskId)
  if (!task) return
  if (isKolGotoWholeOrderTask(task)) {
    state.feedback = 'KOL-GOTO 整单任务已由系统固定分配并自动接收，仅可查看。'
    return
  }
  const nowDate = new Date()
  const now = formatOperationLocalWallClock(nowDate)
  const tenderDeadlineDate = new Date(nowDate)
  if (tenderDeadlineDate.getHours() >= 18) tenderDeadlineDate.setDate(tenderDeadlineDate.getDate() + 1)
  tenderDeadlineDate.setHours(18, 0, 0, 0)
  const skuCodes = (task.scopeSkuLines.length ? task.scopeSkuLines : [{ skuCode: task.skuCode || 'SKU-ALL' }]).map((line) => line.skuCode)
  state.dispatch = {
    taskId,
    mode,
    distributionMode: 'BAG_AWARE',
    factoryId: '',
    businessAssignedAt: formatDateTimeLocal(now),
    price: String(task.standardPrice || task.dispatchPrice || 1200),
    tenderMinPrice: '',
    tenderDeadline: formatDateTimeLocal(formatOperationLocalWallClock(tenderDeadlineDate)),
    tenderPoolMode: 'ALL_ELIGIBLE',
    tenderFactoryKeyword: '',
    tenderFactoryType: 'ALL',
    selectedTenderFactoryIds: new Set(),
    checkedTenderCandidateIds: new Set(),
    checkedTenderPoolIds: new Set(),
    reassignReason: '',
    selectedSkuCodes: new Set(skuCodes),
    confirmStage: 1,
    error: '',
    baggingNotice: '',
  }
}

function commitReassignment(dialog: DispatchDialogState): void {
  const sourceTask = getRuntimeTaskById(dialog.taskId)
  if (!sourceTask) throw new Error('原任务已变化，请刷新后重试')
  const factory = listEligibleFactoriesForTask(sourceTask).find((item) => item.id === dialog.factoryId)
  if (!factory) throw new Error('所选工厂不具备该任务的有效承接能力，请重新选择')
  const operatedAt = formatOperationLocalWallClock()
  const businessAssignedAt = toWallClock(dialog.businessAssignedAt)
  const price = Number(dialog.price)
  if (!Number.isFinite(price) || price <= 0) throw new Error('请输入大于0的有效改派价格')
  if (!dialog.reassignReason.trim()) throw new Error('请填写改派原因')
  const result = reassignRuntimeSewingTask({
    sourceTaskId: sourceTask.taskId,
    targetFactoryId: factory.id,
    targetFactoryName: factory.name,
    businessAssignedAt,
    operatedAt,
    reason: dialog.reassignReason.trim(),
    by: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
    mainFactoryId: factory.id,
    riskConfirmed: dialog.confirmStage === 2,
    supervisorAssigned: true,
    dispatchPrice: price,
    dispatchPriceCurrency: sourceTask.standardPriceCurrency || sourceTask.dispatchPriceCurrency || 'IDR',
    dispatchPriceUnit: sourceTask.standardPriceUnit || sourceTask.dispatchPriceUnit || '件',
  })
  if (!result.ok || !result.taskId || !result.assignedQty) throw new Error(result.message || '改派失败')
  const updated = getRuntimeTaskById(result.taskId)
  if (!updated) throw new Error('改派结果未形成新任务')
  const policy = classifyTaskFulfillmentPolicy(updated)
  const sourceLines = updated.scopeSkuLines.length ? updated.scopeSkuLines : [{ skuCode: updated.skuCode || 'SKU-ALL', color: updated.skuColor || '混色', size: updated.skuSize || '混码', qty: result.assignedQty }]
  const sourceTotal = sourceLines.reduce((sum, line) => sum + line.qty, 0)
  const assignedLines = sourceLines.map((line, index) => ({
    skuCode: line.skuCode,
    color: line.color,
    size: line.size,
    qty: index === sourceLines.length - 1
      ? Math.max(1, result.assignedQty - sourceLines.slice(0, -1).reduce((sum, item) => sum + Math.max(1, Math.floor(item.qty * result.assignedQty / Math.max(1, sourceTotal))), 0))
      : Math.max(1, Math.floor(line.qty * result.assignedQty / Math.max(1, sourceTotal))),
  }))
  const assignment = createEffectiveTaskAssignment({
    runtimeTaskId: updated.taskId,
    productionOrderId: updated.productionOrderId || 'UNKNOWN-PO',
    productionOrderNo: updated.productionOrderNo,
    taskNo: updated.taskNo,
    factoryId: factory.id,
    factoryName: factory.name,
    source: 'REASSIGNMENT',
    assignedQty: result.assignedQty,
    skuLines: assignedLines,
    processCodes: policy.normalizedProcessCodes,
    frozenPrice: price,
    priceCurrency: updated.dispatchPriceCurrency || 'IDR',
    priceUnit: updated.dispatchPriceUnit || '件',
    businessAssignedAt,
    operatedAt,
    operatedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
    allocationOperatorPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
    allocationOperatorPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
    replaceReason: `${dialog.reassignReason.trim()}；${baggingDecisionSummary(sourceTask, dialog)}`,
  })
  supersedeEffectiveTaskAssignmentsForReassignment({
    sourceRuntimeTaskId: sourceTask.taskId,
    replacementAssignmentId: assignment.assignmentId,
    reason: `任务改派：${dialog.reassignReason.trim()}`,
    operatedAt,
    operatedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
  })
  const returnSnapshot = createProductionReturnRuleSnapshot({
    assignmentId: assignment.assignmentId,
    runtimeTaskId: assignment.runtimeTaskId,
    productionOrderId: assignment.productionOrderId,
    factoryId: assignment.factoryId,
    factoryName: assignment.factoryName,
    assignedQty: assignment.assignedQty,
    businessAssignedAt,
    policy,
  })
  invalidateProductionContractsForTask({ runtimeTaskId: sourceTask.taskId, invalidatedAt: operatedAt, reason: `任务改派：${dialog.reassignReason.trim()}；旧合同失效留痕` })
  const contract = generateProductionContract({
    assignment,
    policy,
    returnRuleSnapshot: returnSnapshot,
    processNames: processNames(updated),
    generatedAt: operatedAt,
    generatedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
    lineageRuntimeTaskId: sourceTask.taskId,
  })
  state.feedback = `${sourceTask.taskNo || sourceTask.taskId}已改派至${factory.name}；旧分配和旧合同已失效留痕，新价格已冻结。${contract ? `新合同${contract.contractNo}已生成。` : ''}`
  state.contractPromptId = contract?.contractId || null
}

function commitDirectDispatch(dialog: DispatchDialogState): void {
  const sourceTask = getRuntimeTaskById(dialog.taskId)
  if (!sourceTask) throw new Error('任务已变化，请刷新后重试')
  const factory = listEligibleFactoriesForTask(sourceTask).find((item) => item.id === dialog.factoryId)
  if (!factory) throw new Error('所选工厂不具备该任务的有效承接能力，请重新选择')
  const sourceLines = sourceTask.scopeSkuLines.length ? sourceTask.scopeSkuLines : [{ skuCode: sourceTask.skuCode || 'SKU-ALL', color: sourceTask.skuColor || '混色', size: sourceTask.skuSize || '混码', qty: sourceTask.scopeQty }]
  const policy = classifyTaskFulfillmentPolicy(sourceTask)
  const operatedBy = policy.involvesSewingOutsourcing
    ? SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName
    : '生产计划员'
  const allowsSkuAssignment = policy.assignmentGranularity === 'SKU'
  const selectedLines = allowsSkuAssignment
    ? sourceLines.filter((line) => dialog.selectedSkuCodes.has(line.skuCode))
    : sourceLines
  if (allowsSkuAssignment && selectedLines.length === 0) throw new Error('请至少选择一个完整SKU')
  const factoryUniqueness = validateRuntimeIndependentSewingFactoryUniqueness(sourceTask.taskId, factory.id)
  if (!factoryUniqueness.valid) throw new Error(factoryUniqueness.reason)
  if (requiresCutPieceReleaseForProcessCodes(policy.normalizedProcessCodes)) {
    assertCutPieceReleaseDispatchAvailable({
      productionOrderId: sourceTask.productionOrderId,
      productionOrderNo: sourceTask.productionOrderNo,
      skuLines: selectedLines,
    })
  }
  let task = sourceTask
  if (allowsSkuAssignment && selectedLines.length < sourceLines.length) {
    task = allocateRuntimeSkuTaskScope({ taskId: sourceTask.taskId, lines: selectedLines.map((line) => ({ skuCode: line.skuCode, qty: line.qty })), by: operatedBy })
  }
  const operatedAt = formatOperationLocalWallClock()
  const businessAssignedAt = toWallClock(dialog.businessAssignedAt)
  const price = Number(dialog.price)
  if (!Number.isFinite(price) || price <= 0) throw new Error('请输入大于0的有效派单价')
  const updated = applyRuntimeDirectDispatchMeta({
    taskId: task.taskId,
    factoryId: factory.id,
    factoryName: factory.name,
    acceptDeadline: '',
    taskDeadline: '',
    remark: policy.startsWithSewing ? `${baggingDecisionSummary(task, dialog)}${dialog.distributionMode === 'FREE' ? '；不生成拆袋重装待办' : ''}` : '按完整任务范围直接派单',
    by: operatedBy,
    dispatchPrice: price,
    dispatchPriceCurrency: task.standardPriceCurrency || 'IDR',
    dispatchPriceUnit: task.standardPriceUnit || '件',
    priceDiffReason: '',
    businessAssignedAt,
    operatedAt,
    autoAccept: policy.startsWithSewing,
  })
  if (!updated) throw new Error('直接派单失败')
  const assignedLines = (updated.scopeSkuLines.length ? updated.scopeSkuLines : selectedLines).map((line) => ({ skuCode: line.skuCode, color: line.color, size: line.size, qty: line.qty }))
  const assignment = createEffectiveTaskAssignment({
    runtimeTaskId: updated.taskId,
    productionOrderId: updated.productionOrderId || 'UNKNOWN-PO',
    productionOrderNo: updated.productionOrderNo,
    taskNo: updated.taskNo,
    factoryId: factory.id,
    factoryName: factory.name,
    source: 'DIRECT_DISPATCH',
    assignedQty: assignedLines.reduce((sum, line) => sum + line.qty, 0),
    skuLines: assignedLines,
    processCodes: policy.normalizedProcessCodes,
    frozenPrice: price,
    priceCurrency: updated.standardPriceCurrency || 'IDR',
    priceUnit: updated.standardPriceUnit || '件',
    businessAssignedAt,
    operatedAt,
    operatedBy,
    allocationOperatorPpicId: policy.involvesSewingOutsourcing ? SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId : undefined,
    allocationOperatorPpicName: policy.involvesSewingOutsourcing ? SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName : undefined,
  })
  const returnSnapshot = createProductionReturnRuleSnapshot({
    assignmentId: assignment.assignmentId,
    runtimeTaskId: assignment.runtimeTaskId,
    productionOrderId: assignment.productionOrderId,
    factoryId: assignment.factoryId,
    factoryName: assignment.factoryName,
    assignedQty: assignment.assignedQty,
    businessAssignedAt,
    policy,
  })
  let contract = null
  try {
    contract = generateProductionContract({ assignment, policy, returnRuleSnapshot: returnSnapshot, processNames: processNames(updated), generatedAt: operatedAt, generatedBy: operatedBy })
  } catch (error) {
    if (policy.contractRequired && returnSnapshot) {
      contract = recordProductionContractGenerationFailure({
        assignment,
        policy,
        returnRuleSnapshot: returnSnapshot,
        processNames: processNames(updated),
        generatedAt: operatedAt,
        generatedBy: operatedBy,
        error: error instanceof Error ? error.message : '合同生成失败',
      })
    }
  }
  state.feedback = `已将${updated.taskNo || updated.taskId}分配给${factory.name}；价格已冻结。${contract?.status === 'GENERATION_FAILED' ? '派单成功，但合同生成失败，已形成可重试待办。' : contract ? `合同${contract.contractNo}已生成。` : '该任务无需生产合同。'}`
  state.contractPromptId = contract?.status === 'EFFECTIVE' ? contract.contractId : null
}

async function readContractFiles(input: HTMLInputElement, contractId: string): Promise<void> {
  const files = [...(input.files || [])]
  if (!files.length) return
  const uploadedAt = formatOperationLocalWallClock()
  const settled = await Promise.allSettled(files.map(async (file) => {
    if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error(`${file.name}格式不支持`)
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file) })
    return { fileName: file.name, mimeType: file.type as 'image/jpeg' | 'image/png', size: file.size, dataUrl, uploadedAt, uploadedBy: '生产计划员' }
  }))
  const records = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
  const failed = settled.flatMap((result, index) => result.status === 'rejected' ? [files[index].name] : [])
  if (records.length) addSignedContractScans(contractId, records)
  state.failedUploadNamesByContract[contractId] = failed
  state.feedback = `扫描图上传完成：成功${records.length}张，失败${failed.length}张。成功图片不会因单图失败而丢失。`
  refreshRoot()
}

export function handleUnifiedDispatchWorkbenchEvent(target: HTMLElement, event?: Event): boolean {
  const fileInput = target.closest<HTMLInputElement>('[data-unified-contract-files]')
  if (fileInput && event?.type === 'change') {
    void readContractFiles(fileInput, fileInput.dataset.unifiedContractFiles || '').catch((error) => { state.feedback = error instanceof Error ? error.message : '上传失败'; refreshRoot() })
    return true
  }
  const autoConfigField = target.closest<HTMLInputElement | HTMLSelectElement>('[data-auto-config-field]')
  if (autoConfigField && state.autoDispatch?.mode === 'CONFIG') {
    const config = autoDispatchConfigs.get(autoConfigField.dataset.ruleKey || '')
    if (!config) return true
    const fieldName = autoConfigField.dataset.autoConfigField
    if (fieldName === 'enabled' && autoConfigField instanceof HTMLInputElement) config.enabled = autoConfigField.checked
    if (fieldName === 'factoryId') {
      config.factoryId = autoConfigField.value
      config.factoryName = listBusinessFactoryMasterRecords().find((factory) => factory.id === autoConfigField.value)?.name || ''
    }
    if (fieldName === 'deadlineDays') config.deadlineDays = Number(autoConfigField.value)
    state.autoDispatch.error = ''
    refreshRoot()
    return true
  }
  const filterField = target.closest<HTMLInputElement | HTMLSelectElement>('[data-unified-filter]')
  if (filterField) {
    const key = filterField.dataset.unifiedFilter as WorkbenchFilterKey | undefined
    if (!key || !(key in state.filters)) return true
    state.filters[key] = filterField.value
    if (key === 'process') state.filters.craft = 'ALL'
    state.page = 1
    refreshRoot()
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-unified-field]')
  if (field) {
    const name = field.dataset.unifiedField
    if (state.dispatch && name && name in state.dispatch) {
      ;(state.dispatch as unknown as Record<string, unknown>)[name] = field instanceof HTMLInputElement && field.type === 'checkbox' ? field.checked : field.value
      if (name === 'distributionMode' && field.value === 'BAG_AWARE') {
        const task = getRuntimeTaskById(state.dispatch.taskId)
        if (task) {
          const snapshot = buildDispatchBaggingSnapshot(task)
          snapshot.recommendationGroups.forEach((group) => {
            if (group.skuCodes.some((skuCode) => state.dispatch?.selectedSkuCodes.has(skuCode))) group.skuCodes.forEach((skuCode) => state.dispatch?.selectedSkuCodes.add(skuCode))
          })
        }
      }
      if (name === 'tenderPoolMode') {
        state.dispatch.checkedTenderCandidateIds = new Set()
        state.dispatch.checkedTenderPoolIds = new Set()
      }
      if (name === 'tenderFactoryKeyword' || name === 'tenderFactoryType') state.dispatch.checkedTenderCandidateIds = new Set()
      state.dispatch.confirmStage = 1
      state.dispatch.error = ''
      if (name === 'tenderPoolMode' || name === 'tenderFactoryKeyword' || name === 'tenderFactoryType') refreshTenderFactoryPool(name === 'tenderFactoryKeyword' ? name : '')
      else refreshRoot()
    } else if (name === 'keyword') {
      state.keyword = field.value
      state.page = 1
      refreshRoot()
    }
    return true
  }
  const mergeField = target.closest<HTMLInputElement>('[data-unified-merge-field]')
  if (mergeField && state.merge?.mode === 'MERGE') {
    state.merge.productionOrderKeyword = mergeField.value
    state.merge.confirmStage = 1
    state.merge.error = ''
    refreshRoot()
    return true
  }
  const mergeSource = target.closest<HTMLInputElement>('[data-unified-merge-source]')
  if (mergeSource && state.merge?.mode === 'MERGE') {
    const sourceTaskId = mergeSource.dataset.unifiedMergeSource || ''
    const next = new Set(state.merge.taskIds)
    if (mergeSource.checked) next.add(sourceTaskId); else next.delete(sourceTaskId)
    state.merge.taskIds = [...next]
    state.merge.confirmStage = 1
    state.merge.error = ''
    refreshRoot()
    return true
  }
  const sku = target.closest<HTMLInputElement>('[data-unified-sku]')
  if (sku && state.dispatch) {
    if (sku.checked) state.dispatch.selectedSkuCodes.add(sku.dataset.unifiedSku || '')
    else state.dispatch.selectedSkuCodes.delete(sku.dataset.unifiedSku || '')
    state.dispatch.confirmStage = 1
    refreshRoot()
    return true
  }
  const tenderCandidate = target.closest<HTMLInputElement>('[data-unified-tender-candidate]')
  if (tenderCandidate && state.dispatch?.mode === 'BIDDING' && state.dispatch.tenderPoolMode === 'MANUAL') {
    const factoryId = tenderCandidate.dataset.unifiedTenderCandidate || ''
    if (tenderCandidate.checked) state.dispatch.checkedTenderCandidateIds.add(factoryId)
    else state.dispatch.checkedTenderCandidateIds.delete(factoryId)
    state.dispatch.confirmStage = 1
    state.dispatch.error = ''
    return true
  }
  const tenderPoolFactory = target.closest<HTMLInputElement>('[data-unified-tender-pool-factory]')
  if (tenderPoolFactory && state.dispatch?.mode === 'BIDDING' && state.dispatch.tenderPoolMode === 'MANUAL') {
    const factoryId = tenderPoolFactory.dataset.unifiedTenderPoolFactory || ''
    if (tenderPoolFactory.checked) state.dispatch.checkedTenderPoolIds.add(factoryId)
    else state.dispatch.checkedTenderPoolIds.delete(factoryId)
    state.dispatch.confirmStage = 1
    state.dispatch.error = ''
    return true
  }
  const bagGroup = target.closest<HTMLInputElement>('[data-unified-bag-group]')
  if (bagGroup && state.dispatch) {
    const skuCodes = (bagGroup.dataset.skuCodes || '').split(',').filter(Boolean)
    skuCodes.forEach((skuCode) => bagGroup.checked ? state.dispatch?.selectedSkuCodes.add(skuCode) : state.dispatch?.selectedSkuCodes.delete(skuCode))
    state.dispatch.confirmStage = 1
    state.dispatch.error = ''
    refreshRoot()
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-unified-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.unifiedAction
  const taskId = actionNode.dataset.taskId || ''
  if (action === 'close-all') {
    const imagePreview = document.querySelector<HTMLElement>('[data-unified-image-preview]')
    if (imagePreview?.innerHTML.trim()) {
      imagePreview.innerHTML = ''
      return true
    }
    state.detailTaskId = null; state.dispatch = null; state.merge = null; state.autoDispatch = null; state.contractPromptId = null; state.uploadContractId = null
    if (imagePreview) imagePreview.innerHTML = ''
    refreshRoot(); return true
  }
  if (action === 'toggle-advanced-filters') { state.showAdvancedFilters = !state.showAdvancedFilters; refreshRoot(); return true }
  if (action === 'reset-filters') { state.keyword = ''; state.filters = { ...DEFAULT_FILTERS }; state.page = 1; refreshRoot(); return true }
  if (action === 'clear-keyword') { state.keyword = ''; state.page = 1; refreshRoot(); return true }
  if (action === 'clear-filter') {
    const key = actionNode.dataset.filterKey as WorkbenchFilterKey | undefined
    if (key && key in state.filters) state.filters[key] = DEFAULT_FILTERS[key]
    if (key === 'process') state.filters.craft = 'ALL'
    state.page = 1
    refreshRoot(); return true
  }
  if (action === 'switch-type') {
    state.taskType = actionNode.dataset.taskType as WorkbenchTaskType
    state.page = 1; refreshRoot(); return true
  }
  if (action === 'previous-page' || action === 'prev-page') { state.page = Math.max(1, state.page - 1); refreshRoot(); return true }
  if (action === 'next-page') { state.page += 1; refreshRoot(); return true }
  if (action === 'open-detail') { state.detailTaskId = taskId; state.detailMode = 'DETAIL'; refreshRoot(); return true }
  if (action === 'open-log') { state.detailTaskId = taskId; state.detailMode = 'LOG'; refreshRoot(); return true }
  if (action === 'close-detail') { state.detailTaskId = null; refreshRoot(); return true }
  if (action === 'open-direct' || action === 'open-bidding' || action === 'open-reassign') { openDispatch(taskId, action === 'open-direct' ? 'DIRECT' : action === 'open-reassign' ? 'REASSIGN' : 'BIDDING'); refreshRoot(); return true }
  if (action === 'close-dispatch') { state.dispatch = null; refreshRoot(); return true }
  if (action === 'back-dispatch' && state.dispatch) { state.dispatch.confirmStage = 1; refreshRoot(); return true }
  if (action === 'refresh-bagging' && state.dispatch) {
    const task = getRuntimeTaskById(state.dispatch.taskId)
    const snapshot = task ? buildDispatchBaggingSnapshot(task) : null
    state.dispatch.baggingNotice = snapshot ? `已重新读取${snapshot.source}，当前快照更新时间 ${snapshot.updatedAt}，推荐组合和袋影响已重新计算。` : '任务已变化，请关闭后重试。'
    state.dispatch.confirmStage = 1
    refreshRoot(); return true
  }
  if (action === 'add-checked-tender-factories' && state.dispatch?.mode === 'BIDDING' && state.dispatch.tenderPoolMode === 'MANUAL') {
    const task = getRuntimeTaskById(state.dispatch.taskId)
    if (task) {
      const eligibleIds = new Set(listEligibleTenderFactoriesForTask(task).map((factory) => factory.id))
      state.dispatch.checkedTenderCandidateIds.forEach((factoryId) => {
        if (eligibleIds.has(factoryId)) state.dispatch?.selectedTenderFactoryIds.add(factoryId)
      })
    }
    state.dispatch.checkedTenderCandidateIds = new Set()
    state.dispatch.checkedTenderPoolIds = new Set()
    state.dispatch.confirmStage = 1
    state.dispatch.error = ''
    refreshTenderFactoryPool(); return true
  }
  if (action === 'add-visible-tender-factories' && state.dispatch?.mode === 'BIDDING' && state.dispatch.tenderPoolMode === 'MANUAL') {
    const task = getRuntimeTaskById(state.dispatch.taskId)
    if (task) listVisibleTenderFactoryCandidates(task, state.dispatch).forEach((factory) => state.dispatch?.selectedTenderFactoryIds.add(factory.id))
    state.dispatch.checkedTenderCandidateIds = new Set()
    state.dispatch.checkedTenderPoolIds = new Set()
    state.dispatch.confirmStage = 1
    state.dispatch.error = ''
    refreshTenderFactoryPool(); return true
  }
  if (action === 'remove-checked-tender-factories' && state.dispatch?.mode === 'BIDDING' && state.dispatch.tenderPoolMode === 'MANUAL') {
    state.dispatch.checkedTenderPoolIds.forEach((factoryId) => state.dispatch?.selectedTenderFactoryIds.delete(factoryId))
    state.dispatch.checkedTenderCandidateIds = new Set()
    state.dispatch.checkedTenderPoolIds = new Set()
    state.dispatch.confirmStage = 1
    state.dispatch.error = ''
    refreshTenderFactoryPool(); return true
  }
  if (action === 'clear-tender-factories' && state.dispatch?.mode === 'BIDDING' && state.dispatch.tenderPoolMode === 'MANUAL') {
    state.dispatch.selectedTenderFactoryIds = new Set()
    state.dispatch.checkedTenderCandidateIds = new Set()
    state.dispatch.checkedTenderPoolIds = new Set()
    state.dispatch.confirmStage = 1
    state.dispatch.error = ''
    refreshTenderFactoryPool(); return true
  }
  if (action === 'open-auto-config') { ensureAutoDispatchConfigs(); state.autoDispatch = { mode: 'CONFIG', confirmStage: 1, error: '' }; refreshRoot(); return true }
  if (action === 'open-auto-execute') { ensureAutoDispatchConfigs(); state.autoDispatch = { mode: 'EXECUTE', confirmStage: 1, error: '' }; refreshRoot(); return true }
  if (action === 'close-auto-dispatch') { state.autoDispatch = null; refreshRoot(); return true }
  if (action === 'save-auto-config' && state.autoDispatch?.mode === 'CONFIG') {
    const invalid = ensureAutoDispatchConfigs().find((config) => config.enabled && (!config.factoryId || !Number.isInteger(config.deadlineDays) || config.deadlineDays < 1 || config.deadlineDays > 90))
    if (invalid) state.autoDispatch.error = `${invalid.processName}已启用，请选择默认承接工厂并设置1至90个自然日的任务截止天数。`
    else {
      const updatedAt = formatOperationLocalWallClock()
      autoDispatchConfigs.forEach((config) => { config.updatedAt = `${updatedAt} 生产计划员` })
      state.feedback = `自动分配配置已保存：已启用${[...autoDispatchConfigs.values()].filter((config) => config.enabled).length}项工序配置。`
      state.autoDispatch = null
    }
    refreshRoot(); return true
  }
  if (action === 'back-auto-execute' && state.autoDispatch?.mode === 'EXECUTE') { state.autoDispatch.confirmStage = 1; state.autoDispatch.error = ''; refreshRoot(); return true }
  if (action === 'confirm-auto-execute' && state.autoDispatch?.mode === 'EXECUTE') {
    const preview = buildAutoDispatchPreview()
    if (!preview.eligible.length) state.autoDispatch.error = '当前没有可执行的自动分配任务。'
    else if (state.autoDispatch.confirmStage === 1) state.autoDispatch.confirmStage = 2
    else {
      const result = executeAutomaticDispatch()
      state.feedback = `自动分配已执行：成功${result.succeeded}个，失败${result.failed.length}个。${result.failed.length ? ` 失败明细：${result.failed.slice(0, 3).join('；')}` : ' 成功任务的工厂、价格和截止日期已写入派单记录。'}`
      state.autoDispatch = null
    }
    refreshRoot(); return true
  }
  if (action === 'confirm-dispatch' && state.dispatch) {
    try {
      if (state.dispatch.mode === 'BIDDING' && state.dispatch.confirmStage === 1) {
        const task = getRuntimeTaskById(state.dispatch.taskId)
        if (!task) throw new Error('任务已变化，请刷新')
        if (!task.standardPrice || task.standardPrice <= 0) throw new Error('当前任务未维护有效工序标准价，不能发起竞价')
        const minPrice = Number(state.dispatch.tenderMinPrice)
        if (!Number.isFinite(minPrice) || minPrice <= 0) throw new Error('请填写有效的最低允许报价')
        if (minPrice > task.standardPrice) throw new Error('最低允许报价不能高于工序标准价')
        if (!state.dispatch.tenderDeadline) throw new Error('请填写竞价截止时间')
        const eligible = listEligibleTenderFactoriesForTask(task)
        const selectedCount = state.dispatch.tenderPoolMode === 'ALL_ELIGIBLE'
          ? eligible.length
          : [...state.dispatch.selectedTenderFactoryIds].filter((factoryId) => eligible.some((factory) => factory.id === factoryId)).length
        if (selectedCount === 0) throw new Error('本次竞价工厂池至少需要一家符合条件的工厂')
        state.dispatch.confirmStage = 2
      } else if (state.dispatch.mode !== 'BIDDING' && state.dispatch.confirmStage === 1) {
        if (!state.dispatch.factoryId) throw new Error('请选择承接工厂')
        const task = getRuntimeTaskById(state.dispatch.taskId)
        if (state.dispatch.mode !== 'REASSIGN' && task && classifyTaskFulfillmentPolicy(task).assignmentGranularity === 'SKU' && state.dispatch.selectedSkuCodes.size === 0) throw new Error('请至少选择一个完整SKU')
        if (state.dispatch.mode !== 'REASSIGN' && task && classifyTaskFulfillmentPolicy(task).startsWithSewing && state.dispatch.distributionMode === 'BAG_AWARE' && !selectionMatchesRecommendationGroups(buildDispatchBaggingSnapshot(task), state.dispatch.selectedSkuCodes)) throw new Error('按菲票装袋分配时必须整组选择；如需拆开组内SKU，请切换“自由分配”。')
        if (state.dispatch.mode !== 'REASSIGN' && task) {
          const policy = classifyTaskFulfillmentPolicy(task)
          if (requiresCutPieceReleaseForProcessCodes(policy.normalizedProcessCodes)) {
            const taskLines = task.scopeSkuLines.length
              ? task.scopeSkuLines
              : [{ skuCode: task.skuCode || 'SKU-ALL', color: task.skuColor || '混色', size: task.skuSize || '混码', qty: task.scopeQty }]
            assertCutPieceReleaseDispatchAvailable({
              productionOrderId: task.productionOrderId,
              productionOrderNo: task.productionOrderNo,
              skuLines: policy.assignmentGranularity === 'SKU'
                ? taskLines.filter((line) => state.dispatch?.selectedSkuCodes.has(line.skuCode))
                : taskLines,
            })
          }
        }
        state.dispatch.confirmStage = 2
        if (state.dispatch.mode === 'REASSIGN' && !state.dispatch.reassignReason.trim()) throw new Error('请填写改派原因')
      } else if (state.dispatch.mode !== 'BIDDING') {
        if (state.dispatch.mode === 'REASSIGN') commitReassignment(state.dispatch)
        else commitDirectDispatch(state.dispatch)
        state.dispatch = null
      } else {
        const sourceTask = getRuntimeTaskById(state.dispatch.taskId)
        if (!sourceTask) throw new Error('任务已变化，请刷新')
        if (!state.dispatch.tenderDeadline) throw new Error('请填写竞价截止时间')
        const policy = classifyTaskFulfillmentPolicy(sourceTask)
        const sourceLines = sourceTask.scopeSkuLines.length
          ? sourceTask.scopeSkuLines
          : [{ skuCode: sourceTask.skuCode || 'SKU-ALL', color: sourceTask.skuColor || '混色', size: sourceTask.skuSize || '混码', qty: sourceTask.scopeQty }]
        const sourceQty = sourceLines.reduce((sum, line) => sum + line.qty, 0)
        if (sourceLines.length === 0 || sourceQty !== sourceTask.scopeQty) throw new Error('任务完整范围已变化，请刷新后重新发起竞价')
        const tenderTask = sourceTask
        const tenderIdBase = `TD-${Date.now()}`
        const existingTenderIds = new Set(listRuntimeTaskTenderRecords().map((record) => record.tenderId))
        let tenderId = tenderIdBase
        let tenderIdSeq = 2
        while (existingTenderIds.has(tenderId)) {
          tenderId = `${tenderIdBase}-${tenderIdSeq}`
          tenderIdSeq += 1
        }
        const assignmentOperatedAt = formatOperationLocalWallClock()
        const businessAssignedAt = toWallClock(state.dispatch.businessAssignedAt)
        const biddingDeadline = toWallClock(state.dispatch.tenderDeadline)
        if (new Date(biddingDeadline.replace(' ', 'T')).getTime() <= new Date(assignmentOperatedAt.replace(' ', 'T')).getTime()) throw new Error('竞价截止时间必须晚于当前操作时间')
        const eligibleTenderFactories = listEligibleTenderFactoriesForTask(tenderTask)
        if (eligibleTenderFactories.length === 0) throw new Error('当前没有同时满足任务能力、允许竞价及PDA启用条件的工厂，不能发起竞价')
        const eligibleById = new Map(eligibleTenderFactories.map((factory) => [factory.id, factory] as const))
        if (state.dispatch.tenderPoolMode === 'MANUAL') {
          const invalidIds = [...state.dispatch.selectedTenderFactoryIds].filter((factoryId) => !eligibleById.has(factoryId))
          if (invalidIds.length) {
            const masters = listBusinessFactoryMasterRecords()
            const names = invalidIds.map((factoryId) => masters.find((factory) => factory.id === factoryId)?.name || factoryId)
            throw new Error(`已选工厂资格发生变化：${names.join('、')}。请返回重新选择；系统不会静默移除。`)
          }
        }
        const selectedPool = state.dispatch.tenderPoolMode === 'ALL_ELIGIBLE'
          ? eligibleTenderFactories
          : [...state.dispatch.selectedTenderFactoryIds].flatMap((factoryId) => {
              const factory = eligibleById.get(factoryId)
              return factory ? [factory] : []
            })
        if (selectedPool.length === 0) throw new Error('手动选择工厂池时，至少选择一家符合条件的工厂')
        const standardPrice = Number(tenderTask.standardPrice)
        if (!Number.isFinite(standardPrice) || standardPrice <= 0) throw new Error('当前任务未维护有效工序标准价，不能发起竞价')
        const minPrice = Number(state.dispatch.tenderMinPrice)
        if (!Number.isFinite(minPrice) || minPrice <= 0) throw new Error('请填写有效的最低允许报价')
        if (minPrice > standardPrice) throw new Error('最低允许报价不能高于工序标准价')
        const runtimeSnapshot = captureRuntimeDirectDispatchState()
        const tenderSnapshot = captureRuntimeTaskTenderRecordStore()
        try {
          upsertRuntimeTaskTender(tenderTask.taskId, {
            tenderId,
            biddingDeadline,
            taskDeadline: '',
            businessAssignedAt,
            assignmentOperatedAt,
            distributionMode: 'FREE',
          }, '生产计划员')
          upsertRuntimeTaskTenderRecord({
            tenderId,
            taskId: tenderTask.taskId,
            businessAssignedAt,
            assignmentOperatedAt,
            biddingDeadline,
            taskDeadline: '',
            poolMode: state.dispatch.tenderPoolMode,
            taskSnapshot: {
              taskNo: tenderTask.taskNo || tenderTask.taskId,
              productionOrderId: tenderTask.productionOrderId || tenderTask.productionOrderNo || tenderTask.taskId,
              productionOrderNo: tenderTask.productionOrderNo,
              processName: tenderTask.processNameZh,
              taskTypeLabel: policy.taskTypeLabel,
              qty: tenderTask.scopeQty,
              qtyUnit: '件',
              skuLines: sourceLines.map((line) => ({ skuCode: line.skuCode, color: line.color, size: line.size, qty: line.qty })),
            },
            factoryPool: selectedPool.map((factory) => ({
              factoryId: factory.id,
              factoryName: factory.name,
              factoryCode: factory.code,
              factoryAddress: factory.address,
              factoryType: factory.factoryType,
              capabilitySummary: getTenderFactoryCapabilitySummary(factory, tenderTask),
              notifiedAt: assignmentOperatedAt,
            })),
            standardPrice,
            minPrice,
            currency: tenderTask.standardPriceCurrency || 'IDR',
            unit: tenderTask.standardPriceUnit || tenderTask.qtyUnit || '件',
            remark: '由任务分配工作台按整个任务范围发起竞价；不拆分SKU',
            createdBy: '生产计划员',
          })
        } catch (error) {
          restoreRuntimeDirectDispatchState(runtimeSnapshot)
          restoreRuntimeTaskTenderRecordStore(tenderSnapshot)
          throw error
        }
        state.feedback = `已为${tenderTask.taskNo || tenderTask.taskId}的完整范围（${sourceLines.length}个SKU、${tenderTask.scopeQty.toLocaleString()}件）发起竞价，工厂池${selectedPool.length}家；未确定工厂前不生成合同。定标时须二次确认中标价并冻结。`
        state.dispatch = null
      }
    } catch (error) { if (state.dispatch) state.dispatch.error = error instanceof Error ? error.message : '提交失败' }
    refreshRoot(); return true
  }
  if (action === 'open-merge') {
    state.merge = { mode: 'MERGE', productionOrderKeyword: '', productionOrderId: '', taskIds: [], confirmStage: 1, error: '' }
    refreshRoot(); return true
  }
  if (action === 'select-merge-order' && state.merge?.mode === 'MERGE') {
    state.merge.productionOrderId = actionNode.dataset.productionOrderId || ''
    state.merge.taskIds = []
    state.merge.confirmStage = 1
    state.merge.error = ''
    refreshRoot(); return true
  }
  if (action === 'open-cancel-merge') { state.merge = { mode: 'CANCEL', productionOrderKeyword: '', productionOrderId: '', taskIds: [taskId], mergedTaskId: taskId, confirmStage: 1, error: '' }; refreshRoot(); return true }
  if (action === 'close-merge') { state.merge = null; refreshRoot(); return true }
  if (action === 'confirm-merge' && state.merge) {
    if (state.merge.error) { refreshRoot(); return true }
    const evaluation = state.merge.mode === 'MERGE' ? evaluateFixedMergedTask(state.merge.taskIds) : null
    if (state.merge.mode === 'MERGE' && !evaluation?.ok) { state.merge.error = evaluation?.message || '请选择正确的源任务'; refreshRoot(); return true }
    if (state.merge.mode === 'MERGE' && evaluation?.mergedTaskType === 'CUTTING_SEWING_IRON_PACK') {
      const productionOrderId = evaluation.tasks[0]?.productionOrderId || ''
      const blockingOrders = listBlockingSpecialCraftTaskOrdersForMergedTask(productionOrderId)
      if (blockingOrders.length > 0) {
        state.merge.error = `已有${blockingOrders.length}张中央辅助/特种工艺加工单开始执行，不能再创建裁剪+车缝+烫包。`
        refreshRoot(); return true
      }
    }
    if (state.merge.confirmStage === 1) state.merge.confirmStage = 2
    else if (state.merge.mode === 'MERGE') {
      const merged = createFixedMergedTask(state.merge.taskIds, '生产计划员')
      if (!merged) state.merge.error = '合并失败，请核对源任务是否仍符合固定模式'
      else {
        if (merged.mergedTaskType === 'CUTTING_SEWING_IRON_PACK') {
          invalidateUnstartedSpecialCraftTaskOrdersForMergedTask({
            productionOrderId: merged.productionOrderId,
            mergedTaskId: merged.taskId,
            invalidatedAt: formatOperationLocalWallClock(),
            invalidatedBy: '生产计划员',
            reason: '辅助工艺、特种工艺随裁剪+车缝+烫包交由三方工厂执行',
          })
        }
        state.feedback = `生产单${merged.productionOrderNo || merged.productionOrderId}的${merged.mergeSourceTaskIds?.length === 2 ? '车缝任务与烫包任务' : '裁剪任务、车缝任务与烫包任务'}已合并为“${merged.processNameZh}”任务。`
        state.merge = null
      }
    } else {
      const mergedTaskId = state.merge.mergedTaskId || ''
      const mergedTask = getRuntimeTaskById(mergedTaskId)
      const result = cancelFixedMergedTask(state.merge.mergedTaskId || '', '生产计划员')
      if (!result.ok) state.merge.error = result.message
      else {
        if (mergedTask?.mergedTaskType === 'CUTTING_SEWING_IRON_PACK') {
          restoreSpecialCraftTaskOrdersAfterMergedTaskCancellation({
            mergedTaskId,
            restoredAt: formatOperationLocalWallClock(),
            restoredBy: '生产计划员',
            reason: '合并任务撤销，恢复中央辅助/特种工艺加工单',
          })
        }
        state.feedback = result.message
        state.merge = null
      }
    }
    refreshRoot(); return true
  }
  if (action === 'close-contract-prompt') { state.contractPromptId = null; refreshRoot(); return true }
  if (action === 'open-contract') { state.contractPromptId = actionNode.dataset.contractId || null; refreshRoot(); return true }
  if (action === 'retry-contract') {
    try {
      const contract = retryProductionContractGeneration(actionNode.dataset.contractId || '', formatOperationLocalWallClock(), '生产计划员')
      state.feedback = `合同${contract.contractNo}重试生成成功。`
      state.contractPromptId = contract.contractId
    } catch (error) { state.feedback = error instanceof Error ? error.message : '合同重试失败' }
    refreshRoot(); return true
  }
  if (action === 'open-upload') { state.contractPromptId = null; state.uploadContractId = actionNode.dataset.contractId || null; refreshRoot(); return true }
  if (action === 'close-upload') { state.uploadContractId = null; refreshRoot(); return true }
  if (action === 'remove-scan') {
    if (!confirm('删除扫描图片将改变合同证据，请再次确认。')) return true
    removeSignedContractScan(actionNode.dataset.contractId || '', actionNode.dataset.scanId || '')
    refreshRoot(); return true
  }
  if (action === 'reorder-scan') {
    reorderSignedContractScan(actionNode.dataset.contractId || '', actionNode.dataset.scanId || '', actionNode.dataset.direction === 'UP' ? 'UP' : 'DOWN')
    refreshRoot(); return true
  }
  if (action === 'retry-failed-scan') {
    const contractId = actionNode.dataset.contractId || ''
    document.querySelector<HTMLInputElement>(`[data-unified-contract-files="${CSS.escape(contractId)}"]`)?.click()
    return true
  }
  if (action === 'preview-image') {
    const host = document.querySelector<HTMLElement>('[data-unified-image-preview]')
    if (host) host.innerHTML = `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-6" data-unified-action="close-image"><button class="absolute right-6 top-6 rounded bg-white px-3 py-2">关闭</button><img src="${escapeHtml(actionNode.dataset.image || '')}" alt="${escapeHtml(actionNode.dataset.label || '高清预览')}" class="max-h-full max-w-full object-contain" onerror="this.hidden=true;this.nextElementSibling.hidden=false"/><p hidden class="rounded bg-white p-8 text-sm text-red-600">图片加载失败，请检查原图地址。</p></div>`
    return true
  }
  if (action === 'close-image') { document.querySelector<HTMLElement>('[data-unified-image-preview]')!.innerHTML = ''; return true }
  return false
}

export function isUnifiedDispatchWorkbenchDialogOpen(): boolean {
  const imagePreviewOpen = Boolean(document.querySelector<HTMLElement>('[data-unified-image-preview]')?.firstElementChild)
  return Boolean(state.detailTaskId || state.dispatch || state.merge || state.autoDispatch || state.contractPromptId || state.uploadContractId || imagePreviewOpen)
}

export function listUnifiedDispatchCurrentAssignments(taskId: string) {
  return listCurrentEffectiveTaskAssignments(taskId)
}
