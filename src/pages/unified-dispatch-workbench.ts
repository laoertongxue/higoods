// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../components/ui/list-table-model.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import {
  allocateRuntimeSewingTaskScope,
  applyRuntimeDirectDispatchMeta,
  cancelFixedMergedTask,
  createFixedMergedTask,
  evaluateFixedMergedTask,
  getRuntimeTaskById,
  listRuntimeProcessTasks,
  reassignRuntimeSewingTask,
  upsertRuntimeTaskTender,
  type RuntimeProcessTask,
} from '../data/fcs/runtime-process-tasks.ts'
import { listBusinessFactoryMasterRecords } from '../data/fcs/factory-master-store.ts'
import type { Factory } from '../data/fcs/factory-types.ts'
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
import { createProductionReturnRuleSnapshot } from '../data/fcs/production-return-fulfillment.ts'
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

type WorkbenchTaskType = 'ALL' | 'SEWING' | 'NON_SEWING' | 'MERGED'
type DistributionMode = 'BAG_AWARE' | 'FREE'
type AssignMode = 'DIRECT' | 'BIDDING' | 'REASSIGN'

type WorkbenchFilterKey =
  | 'assignmentProgress' | 'assignmentMode' | 'stage' | 'process' | 'craft' | 'factory'
  | 'priceStatus' | 'domesticTracker' | 'indonesiaTracker' | 'dispatchStart' | 'dispatchEnd'
  | 'acceptanceStatus' | 'autoEligibility' | 'autoConfig' | 'autoResult' | 'readinessRisk' | 'baggingStatus'
  | 'mergeMode' | 'contractStatus' | 'quantityMin' | 'quantityMax' | 'skuCountMin' | 'skuCountMax'
  | 'taskDeadlineStart' | 'taskDeadlineEnd' | 'currency' | 'priceUnit'

type WorkbenchFilters = Record<WorkbenchFilterKey, string>

interface DispatchDialogState {
  taskId: string
  mode: AssignMode
  distributionMode: DistributionMode
  factoryId: string
  businessAssignedAt: string
  price: string
  tenderDeadline: string
  reassignReason: string
  selectedSkuCodes: Set<string>
  riskAcknowledged: boolean
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
  assignmentProgress: 'ALL', assignmentMode: 'ALL', stage: 'ALL', process: 'ALL', craft: 'ALL', factory: 'ALL',
  priceStatus: 'ALL', domesticTracker: 'ALL', indonesiaTracker: 'ALL', dispatchStart: '', dispatchEnd: '',
  acceptanceStatus: 'ALL', autoEligibility: 'ALL', autoConfig: 'ALL', autoResult: 'ALL', readinessRisk: 'ALL', baggingStatus: 'ALL',
  mergeMode: 'ALL', contractStatus: 'ALL', quantityMin: '', quantityMax: '', skuCountMin: '', skuCountMax: '',
  taskDeadlineStart: '', taskDeadlineEnd: '', currency: 'ALL', priceUnit: 'ALL',
}

const state: WorkbenchState = {
  taskType: 'ALL',
  keyword: '',
  page: 1,
  detailTaskId: null,
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

let queryTypeInitialized = false
const autoDispatchConfigs = new Map<string, AutoDispatchConfig>()
const automaticDispatchFailures = new Set<string>()

const TASK_IMAGE_BY_INDEX = ['/shirt-sample.jpg', '/dress-sample-1.jpg', '/cardigan-sample.jpg', '/tshirt-sample.jpg']

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
  const policy = classifyTaskFulfillmentPolicy(task)
  const config = factory.taskAcceptanceConfig
  if (!config || factory.status !== 'active' || !factory.eligibility.allowDispatch) return false
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
    .slice(0, 20)
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
  return names
}

interface TaskListContext {
  order: ProductionOrder | null
  spuCode: string
  spuName: string
  domesticTracker: string
  indonesiaTracker: string
  stageCode: string
  stageLabel: string
  processCode: string
  processLabel: string
  craftCode: string
  craftLabel: string
  priceStatus: string
  contractStatus: string
  autoConfigured: boolean
  baggingStatus: string
  readinessRisk: string
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

function taskContractStatus(task: RuntimeProcessTask): string {
  const policy = classifyTaskFulfillmentPolicy(task)
  if (!policy.contractRequired) return 'NOT_REQUIRED'
  const contracts = listProductionContracts({ runtimeTaskId: task.taskId })
  if (contracts.some((item) => item.status === 'GENERATION_FAILED')) return 'FAILED'
  const effective = contracts.find((item) => item.status === 'EFFECTIVE')
  if (!effective) return task.assignedFactoryId ? 'PENDING' : 'WAIT_FACTORY'
  return effective.scans.length ? 'SIGNED_SCAN_UPLOADED' : 'EFFECTIVE'
}

function taskListContext(task: RuntimeProcessTask): TaskListContext {
  const order = findProductionOrder(task)
  const policy = classifyTaskFulfillmentPolicy(task)
  const stageCode = String(task.stageCode || task.stage || 'PROD')
  const stageLabel = stageCode === 'POST' ? '后道阶段' : '生产阶段'
  const processCode = normalizeProductionExecutionProcessCode(task.processBusinessCode || task.processCode || task.processNameZh)
  const processLabel = task.processBusinessName || task.processNameZh
  const craftCode = task.craftCode || 'NO_CRAFT'
  const craftLabel = task.craftName || '无独立工艺'
  const trackerIndex = deterministicIndex(task.productionOrderId || task.taskId)
  let baggingStatus = 'NOT_APPLICABLE'
  let readinessRisk = 'NOT_APPLICABLE'
  if (policy.requiresSewingReadinessContext) {
    const snapshot = buildDispatchBaggingSnapshot(task)
    if (snapshot.bags.some((bag) => bag.mixedProductionOrders)) baggingStatus = 'MIXED'
    else if (!snapshot.bags.length) baggingStatus = 'NONE'
    else if (snapshot.unbaggedQty == null || snapshot.unbaggedQty > 0) baggingStatus = 'PARTIAL'
    else baggingStatus = 'COVERED'
    readinessRisk = snapshot.warnings.length ? 'RISK' : 'NORMAL'
  }
  return {
    order,
    spuCode: order?.demandSnapshot.spuCode || task.productionOrderNo || '待关联款式',
    spuName: order?.demandSnapshot.spuName || '款式信息待同步',
    domesticTracker: order?.demandSnapshot.merchandiserName || '未分配',
    indonesiaTracker: trackerIndex % 5 === 0 ? '未分配' : INDONESIA_TRACKERS[trackerIndex % INDONESIA_TRACKERS.length],
    stageCode,
    stageLabel,
    processCode,
    processLabel,
    craftCode,
    craftLabel,
    priceStatus: taskPriceStatus(task),
    contractStatus: taskContractStatus(task),
    autoConfigured: Boolean(autoDispatchConfigs.get(autoDispatchRuleKey(task))?.enabled),
    baggingStatus,
    readinessRisk,
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
  return listRuntimeProcessTasks()
    .filter(isAssignableProductionExecutionTask)
    .filter((task) => state.taskType === 'ALL' || getTaskType(task) === state.taskType)
    .filter((task) => {
      const context = taskListContext(task)
      const filters = state.filters
      const assignment = listCurrentEffectiveTaskAssignments(task.taskId)[0]
      const skuCount = task.scopeSkuLines.length || 1
      if (keyword && ![
        context.spuCode, context.spuName, task.taskNo, task.taskId, task.productionOrderNo, task.productionOrderId,
        context.processLabel, context.craftLabel, task.assignedFactoryName, context.domesticTracker, context.indonesiaTracker,
      ].some((value) => String(value || '').toLowerCase().includes(keyword))) return false
      if (filters.assignmentProgress !== 'ALL' && task.assignmentStatus !== filters.assignmentProgress) return false
      if (filters.assignmentMode !== 'ALL' && assignmentModeValue(task) !== filters.assignmentMode) return false
      if (filters.stage !== 'ALL' && context.stageCode !== filters.stage) return false
      if (filters.process !== 'ALL' && context.processCode !== filters.process) return false
      if (filters.craft !== 'ALL' && context.craftCode !== filters.craft) return false
      if (filters.factory !== 'ALL' && String(task.assignedFactoryId || '') !== filters.factory) return false
      if (filters.priceStatus !== 'ALL' && context.priceStatus !== filters.priceStatus) return false
      if (filters.domesticTracker !== 'ALL' && context.domesticTracker !== filters.domesticTracker) return false
      if (filters.indonesiaTracker !== 'ALL' && context.indonesiaTracker !== filters.indonesiaTracker) return false
      if (!dateInRange(task.businessAssignedAt || task.dispatchedAt, filters.dispatchStart, filters.dispatchEnd)) return false
      if (filters.acceptanceStatus !== 'ALL' && String(task.acceptanceStatus || 'NOT_ACCEPTED') !== filters.acceptanceStatus) return false
      if (filters.autoEligibility !== 'ALL' && (isAutoDispatchScopeTask(task) ? 'ELIGIBLE' : 'INELIGIBLE') !== filters.autoEligibility) return false
      if (filters.autoConfig !== 'ALL' && (context.autoConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED') !== filters.autoConfig) return false
      if (filters.autoResult !== 'ALL') {
        const autoAssigned = Boolean(assignment?.operatedBy.includes('自动分配'))
        const autoResult = automaticDispatchFailures.has(task.taskId) ? 'FAILED' : autoAssigned ? 'SUCCEEDED' : 'NOT_EXECUTED'
        if (autoResult !== filters.autoResult) return false
      }
      if (filters.readinessRisk !== 'ALL' && context.readinessRisk !== filters.readinessRisk) return false
      if (filters.baggingStatus !== 'ALL' && context.baggingStatus !== filters.baggingStatus) return false
      if (filters.mergeMode !== 'ALL' && String(task.mergedTaskType || 'INDEPENDENT') !== filters.mergeMode) return false
      if (filters.contractStatus !== 'ALL' && context.contractStatus !== filters.contractStatus) return false
      if (filters.quantityMin && task.scopeQty < Number(filters.quantityMin)) return false
      if (filters.quantityMax && task.scopeQty > Number(filters.quantityMax)) return false
      if (filters.skuCountMin && skuCount < Number(filters.skuCountMin)) return false
      if (filters.skuCountMax && skuCount > Number(filters.skuCountMax)) return false
      if (!dateInRange(task.taskDeadline, filters.taskDeadlineStart, filters.taskDeadlineEnd)) return false
      if (filters.currency !== 'ALL' && String(task.dispatchPriceCurrency || task.standardPriceCurrency || 'IDR') !== filters.currency) return false
      if (filters.priceUnit !== 'ALL' && String(task.dispatchPriceUnit || task.standardPriceUnit || '件') !== filters.priceUnit) return false
      return true
    })
}

function taskImage(task: RuntimeProcessTask): string {
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

const columns: StandardListColumn<RuntimeProcessTask>[] = [
  {
    key: 'style', title: '款式 / SPU', width: 230, required: true, freezeable: true,
    render: (task) => { const context = taskListContext(task); return `<div class="flex gap-3"><button data-unified-action="preview-image" data-image="${taskImage(task)}" data-label="${escapeHtml(context.spuCode)}"><img src="${taskImage(task)}" alt="${escapeHtml(context.spuCode)}款式实拍图" class="h-14 w-12 rounded border object-cover"/></button><div><b>${escapeHtml(context.spuCode)}</b><p class="mt-1 max-w-[150px] truncate text-xs text-muted-foreground">${escapeHtml(context.spuName)}</p></div></div>` },
  },
  {
    key: 'identity', title: '生产单 / 任务', width: 220, required: true, freezeable: true,
    render: (task) => `<b>${escapeHtml(task.productionOrderNo || task.productionOrderId || '未关联生产单')}</b><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.taskNo || task.taskId)}</p>`,
  },
  {
    key: 'stage', title: '阶段', width: 110,
    render: (task) => `<span class="rounded bg-slate-100 px-2 py-1 text-xs">${escapeHtml(taskListContext(task).stageLabel)}</span>`,
  },
  {
    key: 'type', title: '任务类型 / 工序 / 工艺', width: 250, required: true,
    render: (task) => { const context = taskListContext(task); return `<b>${escapeHtml(typeLabel(getTaskType(task)))}</b><p class="mt-1 text-xs">${escapeHtml(processNames(task).join(' → '))}</p><p class="text-xs text-muted-foreground">工艺：${escapeHtml(context.craftLabel)}</p>${task.mergeSourceTaskIds?.length ? `<span class="mt-1 inline-flex rounded bg-violet-50 px-2 py-0.5 text-xs text-violet-700">固定责任范围 · 已合并 ${task.mergeSourceTaskIds.length} 个任务</span>` : ''}` },
  },
  {
    key: 'scope', title: '数量 / 分配颗粒度', width: 175,
    render: (task) => {
      const policy = classifyTaskFulfillmentPolicy(task)
      return `<b>${policy.assignmentGranularity === 'SKU' ? 'SKU（不可拆数量）' : '整任务'}</b><p class="mt-1 text-xs text-muted-foreground">${task.scopeSkuLines.length || 1} 个SKU · ${task.scopeQty.toLocaleString()}件</p>`
    },
  },
  {
    key: 'readiness', title: '生产准备', width: 230,
    render: (task) => classifyTaskFulfillmentPolicy(task).requiresSewingReadinessContext
      ? '<span class="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">可派单 · 准备事实仅作风险提示</span><p class="mt-2 text-xs">点击“准备情况”查看车缝辅料、裁片齐套/放行/目标数量</p>'
      : '<span class="rounded bg-slate-100 px-2 py-1 text-xs">无车缝准备弹窗</span>',
  },
  {
    key: 'tracking', title: '跟单责任', width: 150,
    render: (task) => { const context = taskListContext(task); return `<b>国内：${escapeHtml(context.domesticTracker)}</b><p class="mt-1 text-xs text-muted-foreground">印尼：${escapeHtml(context.indonesiaTracker)}</p>` },
  },
  {
    key: 'assignmentMode', title: '分配方式', width: 130,
    render: (task) => { const assignment = listCurrentEffectiveTaskAssignments(task.taskId)[0]; const auto = assignment?.operatedBy.includes('自动分配'); return `<b>${assignmentModeValue(task) === 'BIDDING' ? '竞价' : '直接派单'}</b><p class="mt-1 text-xs text-muted-foreground">${auto ? '自动分配' : '人工处理'}</p>` },
  },
  {
    key: 'factory', title: '承接工厂', width: 150,
    render: (task) => `<b>${escapeHtml(task.assignedFactoryName || '尚未确定')}</b><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.acceptanceStatus === 'ACCEPTED' ? '已接单' : task.acceptanceStatus === 'REJECTED' ? '已拒绝' : task.assignedFactoryName ? '待接单' : '—')}</p>`,
  },
  {
    key: 'price', title: '价格', width: 210,
    render: (task) => { const status = taskPriceStatus(task); const currency = task.dispatchPriceCurrency || task.standardPriceCurrency || 'IDR'; const unit = task.dispatchPriceUnit || task.standardPriceUnit || '件'; const labels: Record<string, string> = { NO_STANDARD: '无标准价', PENDING: '待确认', ABOVE: '高于标准', BELOW: '低于标准', MATCH: '符合标准' }; return `<p>标准价：${task.standardPrice != null ? `${task.standardPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}` : '—'}</p><p class="mt-1">派单价：${task.dispatchPrice != null ? `${task.dispatchPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}` : '—'}</p><span class="mt-1 inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs">${escapeHtml(labels[status])}${task.dispatchPrice != null ? ' · 已冻结' : ''}</span>` },
  },
  {
    key: 'status', title: '任务状态', width: 150,
    render: (task) => { const context = taskListContext(task); const contractLabels: Record<string, string> = { NOT_REQUIRED: '无需合同', WAIT_FACTORY: '待分配后生成', PENDING: '合同待生成', EFFECTIVE: '合同已生成', SIGNED_SCAN_UPLOADED: '已上传签订扫描图', FAILED: '合同生成失败' }; return `<b>${escapeHtml(statusLabel(task))}</b><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(contractLabels[context.contractStatus] || context.contractStatus)}</p>` },
  },
  {
    key: 'actions', title: '操作', width: 270, required: true, actionColumn: true,
    render: (task) => {
      const contract = currentContract(task.taskId)
      return `<div class="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        <button class="text-blue-600" data-unified-action="open-detail" data-task-id="${escapeHtml(task.taskId)}">${classifyTaskFulfillmentPolicy(task).requiresSewingReadinessContext ? '准备情况' : '详情'}</button>
        ${task.assignmentStatus === 'UNASSIGNED' ? `<button class="text-blue-600" data-unified-action="open-direct" data-task-id="${escapeHtml(task.taskId)}">直接派单</button><button class="text-blue-600" data-unified-action="open-bidding" data-task-id="${escapeHtml(task.taskId)}">发起竞价</button>` : ''}
        ${['ASSIGNED', 'AWARDED'].includes(task.assignmentStatus) && classifyTaskFulfillmentPolicy(task).startsWithSewing ? `<button class="text-amber-700" data-unified-action="open-reassign" data-task-id="${escapeHtml(task.taskId)}">改派</button>` : ''}
        ${task.mergeSourceTaskIds?.length && task.assignmentStatus === 'UNASSIGNED' ? `<button class="text-red-600" data-unified-action="open-cancel-merge" data-task-id="${escapeHtml(task.taskId)}">撤销合并</button>` : ''}
        ${contract ? `<a class="text-blue-600" href="/fcs/contracts/print?contractId=${encodeURIComponent(contract.contractId)}" target="_blank">查看/打印合同</a><button class="text-blue-600" data-unified-action="open-upload" data-contract-id="${escapeHtml(contract.contractId)}">上传签订扫描图</button>` : ''}
      </div>`
    },
  },
]

const preferences: StandardListColumnPreferences = {
  order: columns.filter((column) => !column.actionColumn).map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: ['style', 'identity'],
  pageSize: 20,
}

function renderTaskTabs(rows: RuntimeProcessTask[]): string {
  const all = listRuntimeProcessTasks().filter(isAssignableProductionExecutionTask)
  const types: WorkbenchTaskType[] = ['ALL', 'SEWING', 'NON_SEWING', 'MERGED']
  return types.map((type) => {
    const count = type === 'ALL' ? all.length : all.filter((task) => getTaskType(task) === type).length
    return `<button class="rounded-md border px-3 py-2 text-sm ${state.taskType === type ? 'border-blue-600 bg-blue-50 text-blue-700' : 'bg-white'}" data-unified-action="switch-type" data-task-type="${type}">${typeLabel(type)} ${count}</button>`
  }).join('') + `<span class="ml-auto text-xs text-muted-foreground">当前筛选 ${rows.length} 条，每页20条</span>`
}

function filterSelect(key: WorkbenchFilterKey, label: string, options: Array<[string, string]>): string {
  return `<label class="min-w-[148px] flex-1 text-xs text-muted-foreground"><span>${escapeHtml(label)}</span><select class="mt-1 h-9 w-full rounded border bg-white px-2 text-sm text-foreground" data-unified-filter="${key}">${options.map(([value, text]) => `<option value="${escapeHtml(value)}" ${state.filters[key] === value ? 'selected' : ''}>${escapeHtml(text)}</option>`).join('')}</select></label>`
}

function filterInput(key: WorkbenchFilterKey, label: string, type: 'date' | 'number', placeholder = ''): string {
  return `<label class="min-w-[140px] flex-1 text-xs text-muted-foreground"><span>${escapeHtml(label)}</span><input type="${type}" min="0" class="mt-1 h-9 w-full rounded border px-2 text-sm text-foreground" data-unified-filter="${key}" value="${escapeHtml(state.filters[key])}" placeholder="${escapeHtml(placeholder)}"/></label>`
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
  assignmentProgress: '分配进度', assignmentMode: '分配方式', stage: '阶段', process: '工序', craft: '工艺', factory: '承接工厂',
  priceStatus: '价格状态', domesticTracker: '国内跟单', indonesiaTracker: '印尼跟单', dispatchStart: '派单开始', dispatchEnd: '派单结束',
  acceptanceStatus: '工厂接单状态', autoEligibility: '自动分配资格', autoConfig: '自动分配配置', autoResult: '自动分配结果', readinessRisk: '车缝准备风险',
  baggingStatus: '菲票装袋', mergeMode: '合并模式', contractStatus: '合同状态', quantityMin: '最小数量', quantityMax: '最大数量',
  skuCountMin: '最少SKU', skuCountMax: '最多SKU', taskDeadlineStart: '任务截止开始', taskDeadlineEnd: '任务截止结束', currency: '币种', priceUnit: '计价单位',
}

const FILTER_VALUE_LABELS: Partial<Record<WorkbenchFilterKey, Record<string, string>>> = {
  assignmentProgress: { UNASSIGNED: '待分配', ASSIGNING: '分配中', BIDDING: '竞价中', AWARDED: '已定标', ASSIGNED: '已直接派单' },
  assignmentMode: { DIRECT: '人工直接派单', BIDDING: '竞价', AUTO: '自动分配' },
  stage: { PROD: '生产阶段', POST: '后道阶段' },
  priceStatus: { NO_STANDARD: '无标准价', PENDING: '派单价待确认', MATCH: '符合标准', ABOVE: '高于标准', BELOW: '低于标准' },
  acceptanceStatus: { NOT_ACCEPTED: '尚未进入接单', PENDING: '待接单', ACCEPTED: '已接单', REJECTED: '已拒绝' },
  autoEligibility: { ELIGIBLE: '可自动分配', INELIGIBLE: '不参与自动分配' },
  autoConfig: { CONFIGURED: '已启用配置', NOT_CONFIGURED: '未启用配置' },
  autoResult: { NOT_EXECUTED: '未自动执行', SUCCEEDED: '自动派单成功', FAILED: '自动派单失败' },
  readinessRisk: { NORMAL: '无提示', RISK: '有风险提示', NOT_APPLICABLE: '不适用' },
  baggingStatus: { NONE: '暂无装袋记录', PARTIAL: '部分覆盖/待换算', COVERED: '已覆盖', MIXED: '跨生产单混装异常', NOT_APPLICABLE: '不适用' },
  mergeMode: { INDEPENDENT: '独立任务', SEWING_IRON_PACK: '车缝+烫包', CUTTING_SEWING_IRON_PACK: '裁剪+车缝+烫包' },
  contractStatus: { NOT_REQUIRED: '无需合同', WAIT_FACTORY: '待分配后生成', PENDING: '待生成', EFFECTIVE: '合同已生成', SIGNED_SCAN_UPLOADED: '已上传签订扫描图', FAILED: '生成失败' },
}

function activeFilterValueLabel(key: WorkbenchFilterKey, value: string): string {
  const fixedLabel = FILTER_VALUE_LABELS[key]?.[value]
  if (fixedLabel) return fixedLabel
  const contexts = listRuntimeProcessTasks().filter(isAssignableProductionExecutionTask).map((task) => ({ task, context: taskListContext(task) }))
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
  const sourceTasks = listRuntimeProcessTasks().filter(isAssignableProductionExecutionTask)
  const sourceContexts = sourceTasks.map((task) => ({ task, context: taskListContext(task) }))
  const stageScoped = sourceContexts.filter(({ context }) => state.filters.stage === 'ALL' || context.stageCode === state.filters.stage)
  const processScoped = stageScoped.filter(({ context }) => state.filters.process === 'ALL' || context.processCode === state.filters.process)
  const processOptions = uniqueOptions(stageScoped.map(({ context }) => [context.processCode, context.processLabel]))
  const craftOptions = uniqueOptions(processScoped.map(({ context }) => [context.craftCode, context.craftLabel]))
  const factoryOptions = uniqueOptions(sourceTasks.filter((task) => task.assignedFactoryId).map((task) => [task.assignedFactoryId || '', task.assignedFactoryName || task.assignedFactoryId || '']))
  const domesticOptions = uniqueOptions(sourceContexts.map(({ context }) => [context.domesticTracker, context.domesticTracker]))
  const indonesiaOptions = uniqueOptions(sourceContexts.map(({ context }) => [context.indonesiaTracker, context.indonesiaTracker]))
  const currencyOptions = uniqueOptions(sourceTasks.map((task) => [task.dispatchPriceCurrency || task.standardPriceCurrency || 'IDR', task.dispatchPriceCurrency || task.standardPriceCurrency || 'IDR']))
  const unitOptions = uniqueOptions(sourceTasks.map((task) => [task.dispatchPriceUnit || task.standardPriceUnit || '件', task.dispatchPriceUnit || task.standardPriceUnit || '件']))
  const highFrequency = `<div class="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
    <label class="text-xs text-muted-foreground xl:col-span-2"><span>综合搜索</span><input class="mt-1 h-9 w-full rounded border px-3 text-sm text-foreground" placeholder="SPU / 生产单 / 任务 / 工序 / 工艺 / 工厂 / 跟单" data-unified-field="keyword" value="${escapeHtml(state.keyword)}"/></label>
    ${filterSelect('assignmentProgress', '分配进度', [['ALL', '全部'], ['UNASSIGNED', '待分配'], ['ASSIGNING', '分配中'], ['BIDDING', '竞价中'], ['AWARDED', '已定标'], ['ASSIGNED', '已直接派单']])}
    ${filterSelect('assignmentMode', '分配方式', [['ALL', '全部'], ['DIRECT', '人工直接派单'], ['BIDDING', '竞价'], ['AUTO', '自动分配']])}
    ${filterSelect('stage', '阶段', [['ALL', '全部'], ['PROD', '生产阶段'], ['POST', '后道阶段']])}
    ${filterSelect('process', '工序', [['ALL', '全部'], ...processOptions])}
    ${filterSelect('craft', '工艺', [['ALL', '全部'], ...craftOptions])}
    ${filterSelect('factory', '承接工厂', [['ALL', '全部'], ...factoryOptions])}
    ${filterSelect('priceStatus', '价格状态', [['ALL', '全部'], ['NO_STANDARD', '无标准价'], ['PENDING', '派单价待确认'], ['MATCH', '符合标准'], ['ABOVE', '高于标准'], ['BELOW', '低于标准']])}
    ${filterSelect('domesticTracker', '国内跟单', [['ALL', '全部'], ...domesticOptions])}
    ${filterSelect('indonesiaTracker', '印尼跟单', [['ALL', '全部'], ...indonesiaOptions])}
    ${filterInput('dispatchStart', '派单日期（起）', 'date')}
    ${filterInput('dispatchEnd', '派单日期（止）', 'date')}
  </div>`
  const advanced = state.showAdvancedFilters ? `<div class="grid gap-2 border-t pt-3 md:grid-cols-2 xl:grid-cols-5" data-unified-advanced-filters>
    ${filterSelect('acceptanceStatus', '工厂接单状态', [['ALL', '全部'], ['NOT_ACCEPTED', '尚未进入接单'], ['PENDING', '待接单'], ['ACCEPTED', '已接单'], ['REJECTED', '已拒绝']])}
    ${filterSelect('autoEligibility', '自动分配资格', [['ALL', '全部'], ['ELIGIBLE', '可自动分配'], ['INELIGIBLE', '不参与自动分配']])}
    ${filterSelect('autoConfig', '自动分配配置', [['ALL', '全部'], ['CONFIGURED', '已启用配置'], ['NOT_CONFIGURED', '未启用配置']])}
    ${filterSelect('autoResult', '自动分配结果', [['ALL', '全部'], ['NOT_EXECUTED', '未自动执行'], ['SUCCEEDED', '自动派单成功'], ['FAILED', '自动派单失败']])}
    ${filterSelect('readinessRisk', '车缝准备风险', [['ALL', '全部'], ['NORMAL', '无提示'], ['RISK', '有风险提示'], ['NOT_APPLICABLE', '不适用']])}
    ${filterSelect('baggingStatus', '菲票装袋情况', [['ALL', '全部'], ['NONE', '暂无装袋记录'], ['PARTIAL', '部分覆盖/待换算'], ['COVERED', '已覆盖'], ['MIXED', '跨生产单混装异常'], ['NOT_APPLICABLE', '不适用']])}
    ${filterSelect('mergeMode', '合并模式', [['ALL', '全部'], ['INDEPENDENT', '独立任务'], ['SEWING_IRON_PACK', '车缝+烫包'], ['CUTTING_SEWING_IRON_PACK', '裁剪+车缝+烫包']])}
    ${filterSelect('contractStatus', '合同状态', [['ALL', '全部'], ['NOT_REQUIRED', '无需合同'], ['WAIT_FACTORY', '待分配后生成'], ['PENDING', '待生成'], ['EFFECTIVE', '合同已生成'], ['SIGNED_SCAN_UPLOADED', '已上传签订扫描图'], ['FAILED', '生成失败']])}
    ${filterInput('quantityMin', '任务数量下限（件）', 'number', '0')}${filterInput('quantityMax', '任务数量上限（件）', 'number', '不限')}
    ${filterInput('skuCountMin', 'SKU数下限', 'number', '0')}${filterInput('skuCountMax', 'SKU数上限', 'number', '不限')}
    ${filterInput('taskDeadlineStart', '任务截止（起）', 'date')}${filterInput('taskDeadlineEnd', '任务截止（止）', 'date')}
    ${filterSelect('currency', '币种', [['ALL', '全部'], ...currencyOptions])}${filterSelect('priceUnit', '计价单位', [['ALL', '全部'], ...unitOptions])}
  </div>` : ''
  return `<div class="space-y-3 rounded-lg border bg-card p-3"><div class="flex flex-wrap gap-2">${renderTaskTabs(rows)}</div>${highFrequency}<div class="flex items-center justify-between gap-3"><button class="rounded border px-3 py-2 text-sm text-blue-700" data-unified-action="toggle-advanced-filters">${state.showAdvancedFilters ? '收起更多筛选' : '更多筛选'}</button><button class="text-sm text-blue-600" data-unified-action="reset-filters">重置筛选</button></div>${advanced}${renderActiveFilters()}</div>`
}

function renderReadinessDialog(): string {
  const task = state.detailTaskId ? getRuntimeTaskById(state.detailTaskId) : null
  if (!task) return ''
  const sewing = classifyTaskFulfillmentPolicy(task).requiresSewingReadinessContext
  const bagging = buildDispatchBaggingSnapshot(task)
  const skuRows = (task.scopeSkuLines.length ? task.scopeSkuLines : [{ skuCode: task.skuCode || 'SKU-ALL', color: task.skuColor || '混色', size: task.skuSize || '混码', qty: task.scopeQty }]).map((line, index) => `
    <tr><td>${escapeHtml(line.skuCode)}</td><td>${escapeHtml(line.color)}</td><td>${escapeHtml(line.size)}</td><td>${line.qty}件</td><td>${index % 2 ? Math.ceil(line.qty * 0.7) : line.qty}件</td><td>${index % 2 ? '部分放行' : '已放行'}</td></tr>`).join('')
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-unified-action="close-detail"></button><section class="relative z-10 max-h-[90vh] w-full max-w-5xl overflow-auto rounded-lg bg-white shadow-xl"><header class="flex items-center justify-between border-b p-5"><div><h2 class="text-lg font-semibold">${sewing ? '车缝生产准备情况' : '任务详情'}</h2><p class="text-xs text-muted-foreground">${escapeHtml(task.taskNo || task.taskId)} · 信息不完善只提示风险，不阻断生产分配</p></div><button data-unified-action="close-detail">关闭</button></header>
    <div class="grid gap-4 p-5 md:grid-cols-2">
      <section class="rounded-lg border p-4"><h3 class="font-semibold">车缝的辅料配料情况以及库存情况</h3><div class="mt-3 grid grid-cols-3 gap-3 text-sm"><div><img src="/materials/accessory-button.jpg" alt="纽扣真实物料图" class="h-20 w-full rounded object-cover"/><p>纽扣：已配 ${Math.round(task.scopeQty * .8)}套</p><p>库存 ${task.scopeQty * 3}粒</p></div><div><img src="/materials/accessory-zipper.jpg" alt="拉链真实物料图" class="h-20 w-full rounded object-cover"/><p>拉链：已配 ${task.scopeQty}条</p><p>库存 ${task.scopeQty * 2}条</p></div><div><img src="/materials/accessory-label.jpg" alt="洗水标真实物料图" class="h-20 w-full rounded object-cover"/><p>洗水标：待补 ${Math.ceil(task.scopeQty * .1)}件</p><p>库存 ${task.scopeQty}件</p></div></div></section>
      <section class="rounded-lg border p-4"><h3 class="font-semibold">裁片与菲票装袋</h3><dl class="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt class="text-muted-foreground">普通裁片齐套</dt><dd>${Math.ceil(task.scopeQty * .78)}件</dd></div><div><dt class="text-muted-foreground">辅助工艺裁片</dt><dd>${Math.ceil(task.scopeQty * .4)}件</dd></div><div><dt class="text-muted-foreground">特种工艺裁片</dt><dd>${Math.ceil(task.scopeQty * .25)}件</dd></div><div><dt class="text-muted-foreground">毛织片</dt><dd>${Math.ceil(task.scopeQty * .1)}件</dd></div><div><dt class="text-muted-foreground">裁床放行数量</dt><dd>${Math.ceil(task.scopeQty * .7)}件</dd></div><div><dt class="text-muted-foreground">裁床确认目标数量</dt><dd>${task.scopeQty}件</dd></div></dl><div class="mt-3 rounded bg-blue-50 p-2 text-xs text-blue-800"><b>${escapeHtml(bagging.source)}</b> · ${bagging.validBagCount} 个当前有效袋 · 已装 ${bagging.baggedPieceQty.toLocaleString()}片 · 未覆盖任务 ${bagging.unbaggedQty == null ? '待齐套换算' : `${bagging.unbaggedQty.toLocaleString()}件`}<br/>更新时间：${escapeHtml(bagging.updatedAt)}</div></section>
    </div><div class="px-5 pb-5"><table class="w-full border-collapse text-sm"><thead><tr><th>SKU</th><th>颜色</th><th>尺码</th><th>目标</th><th>齐套</th><th>放行</th></tr></thead><tbody>${skuRows}</tbody></table></div></section></div>`
}

function renderBaggingOverview(snapshot: DispatchBaggingSnapshot): string {
  return `<section class="rounded-lg border border-blue-200 bg-blue-50/40 p-4" data-unified-bagging-overview>
    <div class="flex flex-wrap items-start justify-between gap-2"><div><h3 class="font-semibold">当前菲票装袋情况 <span class="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">${escapeHtml(snapshot.source)}</span></h3><p class="mt-1 text-xs text-muted-foreground">更新时间：${escapeHtml(snapshot.updatedAt)}。任务数量按件、菲票装袋数量按裁片“片”分别展示，不互相替代。</p></div><button class="rounded border bg-white px-3 py-1.5 text-xs text-blue-700" data-unified-action="refresh-bagging">刷新装袋情况</button></div>
    <dl class="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4"><div><dt class="text-muted-foreground">任务范围</dt><dd class="font-semibold">${snapshot.taskSkuCount} SKU / ${snapshot.taskQty.toLocaleString()}件</dd></div><div><dt class="text-muted-foreground">当前有效袋</dt><dd class="font-semibold">${snapshot.validBagCount}袋</dd></div><div><dt class="text-muted-foreground">已装袋裁片</dt><dd class="font-semibold">${snapshot.baggedPieceQty.toLocaleString()}片</dd></div><div><dt class="text-muted-foreground">未覆盖任务</dt><dd class="font-semibold">${snapshot.unbaggedQty == null ? '待齐套换算' : `${snapshot.unbaggedQty.toLocaleString()}件`}</dd></div><div><dt class="text-muted-foreground">可保持整袋</dt><dd>${snapshot.intactBagCount}袋</dd></div><div><dt class="text-muted-foreground">跨袋SKU</dt><dd>${snapshot.crossBagSkuCount}个</dd></div></dl>
    ${snapshot.warnings.map((warning) => `<p class="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">${escapeHtml(warning)}</p>`).join('')}
    <details class="mt-3"><summary class="cursor-pointer text-sm font-medium text-blue-700">查看 ${snapshot.bags.length} 个袋及菲票明细</summary><div class="mt-2 space-y-2">${snapshot.bags.map((bag) => `<article class="rounded border bg-white p-3 text-xs"><div class="flex flex-wrap justify-between gap-2"><b>${escapeHtml(bag.bagCode)} · ${escapeHtml(bag.status)}</b><span>${escapeHtml(bag.location)} · ${escapeHtml(bag.updatedAt)}</span></div>${bag.mixedProductionOrders ? '<p class="mt-1 font-semibold text-red-700">异常：跨生产单混装，已从推荐中排除</p>' : ''}${bag.handedOver ? '<p class="mt-1 font-semibold text-amber-700">已交出，不作为当前推荐依据</p>' : ''}<div class="mt-2 overflow-auto"><table class="w-full min-w-[640px] text-left"><thead><tr><th>菲票号</th><th>SKU</th><th>颜色/尺码</th><th>裁片</th><th>任务范围</th></tr></thead><tbody>${bag.tickets.map((ticket) => `<tr><td>${escapeHtml(ticket.feiTicketNo)}</td><td>${escapeHtml(ticket.skuCode || '未匹配')}</td><td>${escapeHtml(ticket.color)} / ${escapeHtml(ticket.size)}</td><td>${ticket.pieceQty.toLocaleString()}片</td><td>${ticket.inTaskScope ? '是' : '否'}</td></tr>`).join('')}</tbody></table></div></article>`).join('') || '<p class="rounded border bg-white p-3 text-xs text-muted-foreground">当前没有菲票装袋记录。</p>'}</div></details>
  </section>`
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

function baggingDecisionSummary(task: RuntimeProcessTask, dialog: DispatchDialogState): string {
  const snapshot = buildDispatchBaggingSnapshot(task)
  const impact = evaluateDispatchBagSelection(snapshot, dialog.selectedSkuCodes)
  return `${dialog.distributionMode === 'BAG_AWARE' ? '按菲票装袋推荐' : '自由分配'}；快照${snapshot.updatedAt}；保持整袋${impact.intactBagCodes.length}袋；受影响${impact.affectedBagCodes.length}袋`
}

function renderDispatchDialog(): string {
  const dialog = state.dispatch
  const task = dialog ? getRuntimeTaskById(dialog.taskId) : null
  if (!dialog || !task) return ''
  const policy = classifyTaskFulfillmentPolicy(task)
  const factories = listEligibleFactoriesForTask(task)
  const skuLines = task.scopeSkuLines.length ? task.scopeSkuLines : [{ skuCode: task.skuCode || 'SKU-ALL', color: task.skuColor || '混色', size: task.skuSize || '混码', qty: task.scopeQty }]
  const bagging = buildDispatchBaggingSnapshot(task)
  const impact = evaluateDispatchBagSelection(bagging, dialog.selectedSkuCodes)
  const selectedQty = skuLines.filter((line) => dialog.selectedSkuCodes.has(line.skuCode)).reduce((sum, line) => sum + line.qty, 0)
  const isSecond = dialog.confirmStage === 2
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-unified-action="close-dispatch"></button><section class="relative z-10 max-h-[92vh] w-full max-w-6xl overflow-auto rounded-lg bg-white shadow-xl"><header class="border-b p-5"><h2 class="text-lg font-semibold">${dialog.mode === 'DIRECT' ? '直接派单' : dialog.mode === 'REASSIGN' ? '车缝任务改派' : '发起竞价'} · ${escapeHtml(task.taskNo || task.taskId)}</h2><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(policy.taskTypeLabel)} · 分配最小颗粒度：${policy.assignmentGranularity === 'SKU' ? 'SKU（不可拆数量）' : policy.assignmentGranularity}</p></header><div class="space-y-4 p-5">
    ${dialog.error ? `<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(dialog.error)}</div>` : ''}
    ${isSecond && dialog.mode !== 'BIDDING' ? `<div class="rounded-lg border-2 border-amber-400 bg-amber-50 p-4"><h3 class="font-bold text-amber-900">二次确认${dialog.mode === 'REASSIGN' ? '改派' : '派单'}价格</h3><p class="mt-2 text-base font-semibold text-red-700">谨慎确认价格，一经提交确认不得修改。</p><p class="mt-3 text-sm">工厂：${escapeHtml(factories.find((item) => item.id === dialog.factoryId)?.name || '未选择')} · 数量：${selectedQty}件 · 派单价：${escapeHtml(dialog.price)} IDR/件</p>${policy.startsWithSewing ? `<p class="mt-2 text-sm">分配方式：${dialog.distributionMode === 'BAG_AWARE' ? '按菲票装袋推荐' : '自由分配'} · 可保持整袋 ${impact.intactBagCodes.length} 袋 · 受影响 ${impact.affectedBagCodes.length} 袋</p>` : ''}${dialog.mode === 'REASSIGN' ? `<p class="mt-2 text-sm">改派原因：${escapeHtml(dialog.reassignReason)}</p>` : ''}<p class="mt-2 text-xs text-amber-800">提交后价格冻结，结算只能读取本次有效分配的冻结价。</p></div>` : `
      ${policy.startsWithSewing ? `<fieldset><legend class="text-sm font-semibold">分配方式</legend><label class="mr-5 text-sm"><input type="radio" name="distributionMode" data-unified-field="distributionMode" value="BAG_AWARE" ${dialog.distributionMode === 'BAG_AWARE' ? 'checked' : ''}/> 按菲票装袋情况分配（默认）</label><label class="text-sm"><input type="radio" name="distributionMode" data-unified-field="distributionMode" value="FREE" ${dialog.distributionMode === 'FREE' ? 'checked' : ''}/> 自由分配</label><p class="mt-1 text-xs text-muted-foreground">自由分配不生成拆袋重装待办；PPIC实际领料时，裁床待交出仓读取最新车缝任务再决定是否拆袋重装。</p></fieldset>` : ''}
      ${policy.startsWithSewing ? renderBaggingOverview(bagging) : ''}
      ${dialog.baggingNotice ? `<div class="rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">${escapeHtml(dialog.baggingNotice)}</div>` : ''}
      ${policy.startsWithSewing ? (dialog.distributionMode === 'BAG_AWARE' ? renderBagAwareSelection(bagging, dialog) : renderFreeSelection(bagging, dialog)) : renderPlainSkuSelection(task, dialog)}
      <p class="text-xs">已选 ${dialog.selectedSkuCodes.size} 个SKU，共 ${selectedQty.toLocaleString()}件</p>
      ${dialog.mode !== 'BIDDING' ? `<label class="block text-sm">承接工厂<select class="mt-1 h-9 w-full rounded border px-3" data-unified-field="factoryId"><option value="">请选择工厂</option>${factories.map((factory) => `<option value="${escapeHtml(factory.id)}" ${dialog.factoryId === factory.id ? 'selected' : ''} ${dialog.mode === 'REASSIGN' && factory.id === task.assignedFactoryId ? 'disabled' : ''}>${escapeHtml(factory.name)}</option>`).join('')}</select></label><label class="block text-sm">派单价（IDR/件）<input type="number" min="1" class="mt-1 h-9 w-full rounded border px-3" data-unified-field="price" value="${escapeHtml(dialog.price)}"/></label>${dialog.mode === 'REASSIGN' ? `<label class="block text-sm">改派原因<textarea class="mt-1 min-h-20 w-full rounded border p-3" data-unified-field="reassignReason" placeholder="必填，说明本次改派原因">${escapeHtml(dialog.reassignReason)}</textarea></label>` : ''}` : `<label class="block text-sm">竞价截止时间<input type="datetime-local" class="mt-1 h-9 w-full rounded border px-3" data-unified-field="tenderDeadline" value="${escapeHtml(dialog.tenderDeadline)}"/></label>`}
      <label class="block text-sm">业务分配日期/时间<input type="datetime-local" class="mt-1 h-9 w-full rounded border px-3" data-unified-field="businessAssignedAt" value="${escapeHtml(dialog.businessAssignedAt)}"/><span class="mt-1 block text-xs text-muted-foreground">回货规则按日期计算，分配日期为第1个自然日；合同只打印日期，不打印具体时间。</span></label>
      <div class="rounded bg-amber-50 p-3 text-sm text-amber-800">本次分配可能包含未完全齐套SKU、辅料库存风险和多个来源袋。以上信息不阻断派单。</div>${policy.startsWithSewing ? `<label class="flex items-start gap-2 rounded border p-3 text-sm"><input type="checkbox" data-unified-field="riskAcknowledged" ${dialog.riskAcknowledged ? 'checked' : ''}/><span><b>我已知悉上述生产准备风险</b><br/><span class="text-xs text-muted-foreground">风险知悉确认与价格二次确认相互独立。</span></span></label>` : ''}`}
    </div><footer class="flex justify-end gap-2 border-t p-4"><button class="rounded border px-4 py-2 text-sm" data-unified-action="${isSecond ? 'back-dispatch' : 'close-dispatch'}">${isSecond ? '返回修改' : '取消'}</button><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-unified-action="confirm-dispatch">${isSecond ? '确认提交并冻结价格' : dialog.mode === 'BIDDING' ? '确认发起竞价' : '下一步：二次确认价格'}</button></footer></section></div>`
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
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-unified-action="close-contract-prompt"></button><section class="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-xl"><h2 class="text-lg font-semibold">生产合同已生成</h2><p class="mt-3 text-sm">${escapeHtml(contract.contractNo)} · ${escapeHtml(contract.factoryName)} · ${contract.assignedQty}件</p><p class="mt-2 text-xs text-muted-foreground">是否立即打印合同？未上传签订扫描图不会阻断生产，但会进入“待上传合同扫描图”待办。</p><div class="mt-5 flex justify-end gap-2"><button class="rounded border px-4 py-2" data-unified-action="close-contract-prompt">稍后打印</button><a class="rounded bg-blue-600 px-4 py-2 text-white" target="_blank" href="/fcs/contracts/print?contractId=${encodeURIComponent(contract.contractId)}">立即打印</a></div></section></div>`
}

function renderUploadDialog(): string {
  const contract = state.uploadContractId ? getProductionContract(state.uploadContractId) : undefined
  if (!contract) return ''
  const failedNames = state.failedUploadNamesByContract[contract.contractId] || []
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-unified-action="close-upload"></button><section class="relative z-10 max-h-[88vh] w-full max-w-2xl overflow-auto rounded-lg bg-white shadow-xl"><header class="border-b p-5"><h2 class="text-lg font-semibold">签订合同扫描图</h2><p class="text-xs text-muted-foreground">${escapeHtml(contract.contractNo)} · 支持多张JPG/PNG，可预览、排序和删除</p></header><div class="p-5"><label class="block rounded-lg border-2 border-dashed p-5 text-center text-sm">选择扫描图片<input type="file" accept="image/jpeg,image/png" multiple class="mt-3 block w-full" data-unified-contract-files="${escapeHtml(contract.contractId)}"/></label>${failedNames.length ? `<div class="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"><b>${failedNames.length}张上传失败，其他成功图片已保留：</b>${failedNames.map(escapeHtml).join('、')}<button class="ml-3 text-blue-700 underline" data-unified-action="retry-failed-scan" data-contract-id="${escapeHtml(contract.contractId)}">只重试失败图片</button></div>` : ''}<div class="mt-4 grid gap-3 sm:grid-cols-2">${contract.scans.map((scan) => `<article class="rounded border p-2"><button data-unified-action="preview-image" data-image="${escapeHtml(scan.dataUrl)}" data-label="${escapeHtml(scan.fileName)}"><img src="${escapeHtml(scan.dataUrl)}" alt="合同扫描图${scan.sortOrder}" class="h-40 w-full object-contain"/></button><div class="mt-2 flex items-center justify-between gap-2 text-xs"><span>${scan.sortOrder}. ${escapeHtml(scan.fileName)}</span><span class="flex gap-2"><button class="text-blue-600" data-unified-action="reorder-scan" data-direction="UP" data-contract-id="${escapeHtml(contract.contractId)}" data-scan-id="${escapeHtml(scan.scanId)}">上移</button><button class="text-blue-600" data-unified-action="reorder-scan" data-direction="DOWN" data-contract-id="${escapeHtml(contract.contractId)}" data-scan-id="${escapeHtml(scan.scanId)}">下移</button><button class="text-red-600" data-unified-action="remove-scan" data-contract-id="${escapeHtml(contract.contractId)}" data-scan-id="${escapeHtml(scan.scanId)}">删除</button></span></div></article>`).join('') || '<p class="col-span-2 py-8 text-center text-sm text-muted-foreground">尚未上传签订扫描图</p>'}</div></div><footer class="flex justify-end border-t p-4"><button class="rounded bg-blue-600 px-4 py-2 text-white" data-unified-action="close-upload">完成</button></footer></section></div>`
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
  if (!queryTypeInitialized && typeof window !== 'undefined') {
    const queryType = new URLSearchParams(window.location.search).get('type') as WorkbenchTaskType | null
    if (queryType && ['ALL', 'SEWING', 'NON_SEWING', 'MERGED'].includes(queryType)) state.taskType = queryType
    const contractId = new URLSearchParams(window.location.search).get('contractId')
    if (contractId && getProductionContract(contractId)?.status === 'EFFECTIVE') state.uploadContractId = contractId
    queryTypeInitialized = true
  }
  const rows = taskRows()
  const pageSize = 20
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  state.page = Math.min(Math.max(1, state.page), pageCount)
  const pageRows = rows.slice((state.page - 1) * pageSize, state.page * pageSize)
  const all = listRuntimeProcessTasks().filter(isAssignableProductionExecutionTask)
  const assigned = all.filter((task) => ['ASSIGNED', 'AWARDED'].includes(task.assignmentStatus)).length
  const contractCount = listProductionContracts().filter((item) => item.status === 'EFFECTIVE').length
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
      { label: '有效生产合同', value: contractCount },
    ]),
    listTitle: '统一任务列表',
    listActionsHtml: '<span class="text-xs text-muted-foreground">直接派单与竞价共用同一任务口径；价格在直接派单提交或竞价定标时二次确认并冻结</span>',
    tableHtml: renderStandardListTable({ columns, rows: pageRows, preferences, sort: null, eventPrefix: 'unified-dispatch', emptyText: '当前筛选下暂无任务' }),
    paginationHtml: renderTablePagination({ total: rows.length, from: rows.length ? (state.page - 1) * pageSize + 1 : 0, to: Math.min(state.page * pageSize, rows.length), currentPage: state.page, totalPages: pageCount, pageSize, actionPrefix: 'unified', fieldPrefix: 'unified', pageSizeOptions: [20] }),
    overlaysHtml: `${renderReadinessDialog()}${renderDispatchDialog()}${renderMergeDialog()}${renderAutoDispatchDialog()}${renderContractPrompt()}${renderUploadDialog()}${renderImagePreview()}`,
  })
  return `<div data-unified-dispatch-page data-skip-page-rerender="true">${content}</div>`
}

function refreshRoot(): void {
  const root = document.querySelector<HTMLElement>('[data-unified-dispatch-page]')
  if (root) root.outerHTML = renderUnifiedDispatchWorkbenchPage()
}

function openDispatch(taskId: string, mode: AssignMode): void {
  const task = getRuntimeTaskById(taskId)
  if (!task) return
  const now = formatOperationLocalWallClock()
  const skuCodes = (task.scopeSkuLines.length ? task.scopeSkuLines : [{ skuCode: task.skuCode || 'SKU-ALL' }]).map((line) => line.skuCode)
  state.dispatch = {
    taskId,
    mode,
    distributionMode: 'BAG_AWARE',
    factoryId: '',
    businessAssignedAt: formatDateTimeLocal(now),
    price: String(task.standardPrice || task.dispatchPrice || 1200),
    tenderDeadline: formatDateTimeLocal(now.slice(0, 10) + ' 18:00:00'),
    reassignReason: '',
    selectedSkuCodes: new Set(skuCodes),
    riskAcknowledged: false,
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
    by: '生产计划员',
    mainFactoryId: factory.id,
    riskConfirmed: dialog.riskAcknowledged,
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
    operatedBy: '生产计划员',
    replaceReason: `${dialog.reassignReason.trim()}；${baggingDecisionSummary(sourceTask, dialog)}`,
  })
  supersedeEffectiveTaskAssignmentsForReassignment({
    sourceRuntimeTaskId: sourceTask.taskId,
    replacementAssignmentId: assignment.assignmentId,
    reason: `任务改派：${dialog.reassignReason.trim()}`,
    operatedAt,
    operatedBy: '生产计划员',
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
    generatedBy: '生产计划员',
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
  const selectedLines = sourceLines.filter((line) => dialog.selectedSkuCodes.has(line.skuCode))
  if (selectedLines.length === 0) throw new Error('请至少选择一个完整SKU')
  const policy = classifyTaskFulfillmentPolicy(sourceTask)
  let task = sourceTask
  if (policy.startsWithSewing && selectedLines.length < sourceLines.length) {
    task = allocateRuntimeSewingTaskScope({ taskId: sourceTask.taskId, lines: selectedLines.map((line) => ({ skuCode: line.skuCode, qty: line.qty })), by: '生产计划员' })
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
    by: '生产计划员',
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
    operatedBy: '生产计划员',
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
    contract = generateProductionContract({ assignment, policy, returnRuleSnapshot: returnSnapshot, processNames: processNames(updated), generatedAt: operatedAt, generatedBy: '生产计划员' })
  } catch (error) {
    if (policy.contractRequired && returnSnapshot) {
      contract = recordProductionContractGenerationFailure({
        assignment,
        policy,
        returnRuleSnapshot: returnSnapshot,
        processNames: processNames(updated),
        generatedAt: operatedAt,
        generatedBy: '生产计划员',
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
    if (key === 'stage') { state.filters.process = 'ALL'; state.filters.craft = 'ALL' }
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
      state.dispatch.confirmStage = 1
      state.dispatch.error = ''
      refreshRoot()
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
    state.detailTaskId = null; state.dispatch = null; state.merge = null; state.autoDispatch = null; state.contractPromptId = null; state.uploadContractId = null
    const imagePreview = document.querySelector<HTMLElement>('[data-unified-image-preview]')
    if (imagePreview) imagePreview.innerHTML = ''
    refreshRoot(); return true
  }
  if (action === 'toggle-advanced-filters') { state.showAdvancedFilters = !state.showAdvancedFilters; refreshRoot(); return true }
  if (action === 'reset-filters') { state.keyword = ''; state.filters = { ...DEFAULT_FILTERS }; state.page = 1; refreshRoot(); return true }
  if (action === 'clear-keyword') { state.keyword = ''; state.page = 1; refreshRoot(); return true }
  if (action === 'clear-filter') {
    const key = actionNode.dataset.filterKey as WorkbenchFilterKey | undefined
    if (key && key in state.filters) state.filters[key] = DEFAULT_FILTERS[key]
    if (key === 'stage') { state.filters.process = 'ALL'; state.filters.craft = 'ALL' }
    if (key === 'process') state.filters.craft = 'ALL'
    state.page = 1
    refreshRoot(); return true
  }
  if (action === 'switch-type') { state.taskType = actionNode.dataset.taskType as WorkbenchTaskType; state.page = 1; refreshRoot(); return true }
  if (action === 'previous-page' || action === 'prev-page') { state.page = Math.max(1, state.page - 1); refreshRoot(); return true }
  if (action === 'next-page') { state.page += 1; refreshRoot(); return true }
  if (action === 'open-detail') { state.detailTaskId = taskId; refreshRoot(); return true }
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
      if (state.dispatch.mode !== 'BIDDING' && state.dispatch.confirmStage === 1) {
        if (!state.dispatch.factoryId) throw new Error('请选择承接工厂')
        if (state.dispatch.selectedSkuCodes.size === 0) throw new Error('请至少选择一个完整SKU')
        const task = getRuntimeTaskById(state.dispatch.taskId)
        if (task && classifyTaskFulfillmentPolicy(task).startsWithSewing && state.dispatch.distributionMode === 'BAG_AWARE' && !selectionMatchesRecommendationGroups(buildDispatchBaggingSnapshot(task), state.dispatch.selectedSkuCodes)) throw new Error('按菲票装袋分配时必须整组选择；如需拆开组内SKU，请切换“自由分配”。')
        if (task && classifyTaskFulfillmentPolicy(task).startsWithSewing && !state.dispatch.riskAcknowledged) throw new Error('请先确认已知悉生产准备风险')
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
        const selectedLines = sourceLines.filter((line) => state.dispatch?.selectedSkuCodes.has(line.skuCode))
        if (selectedLines.length === 0) throw new Error('请至少选择一个完整SKU')
        if (policy.startsWithSewing && state.dispatch.distributionMode === 'BAG_AWARE' && !selectionMatchesRecommendationGroups(buildDispatchBaggingSnapshot(sourceTask), state.dispatch.selectedSkuCodes)) throw new Error('按菲票装袋分配时必须整组选择；如需拆开组内SKU，请切换“自由分配”。')
        if (policy.startsWithSewing && !state.dispatch.riskAcknowledged) throw new Error('请先确认已知悉生产准备风险')
        const tenderTask = policy.startsWithSewing && selectedLines.length < sourceLines.length
          ? allocateRuntimeSewingTaskScope({
              taskId: sourceTask.taskId,
              lines: selectedLines.map((line) => ({ skuCode: line.skuCode, qty: line.qty })),
              by: '生产计划员',
            })
          : sourceTask
        upsertRuntimeTaskTender(tenderTask.taskId, {
          tenderId: `TD-${Date.now()}`,
          biddingDeadline: toWallClock(state.dispatch.tenderDeadline),
          taskDeadline: '',
          businessAssignedAt: toWallClock(state.dispatch.businessAssignedAt),
          assignmentOperatedAt: formatOperationLocalWallClock(),
          distributionMode: policy.startsWithSewing ? state.dispatch.distributionMode : 'FREE',
        }, '生产计划员')
        state.feedback = `${policy.startsWithSewing ? `已按${state.dispatch.distributionMode === 'BAG_AWARE' ? '菲票装袋情况' : '自由分配'}` : '已'}为${tenderTask.taskNo || tenderTask.taskId}发起竞价；未确定工厂前不生成合同。定标时须二次确认中标价并冻结。`
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
  if (action === 'retry-contract') {
    try {
      const contract = retryProductionContractGeneration(actionNode.dataset.contractId || '', formatOperationLocalWallClock(), '生产计划员')
      state.feedback = `合同${contract.contractNo}重试生成成功。`
      state.contractPromptId = contract.contractId
    } catch (error) { state.feedback = error instanceof Error ? error.message : '合同重试失败' }
    refreshRoot(); return true
  }
  if (action === 'open-upload') { state.uploadContractId = actionNode.dataset.contractId || null; refreshRoot(); return true }
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
    if (host) host.innerHTML = `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-6" data-unified-action="close-image"><button class="absolute right-6 top-6 rounded bg-white px-3 py-2">关闭</button><img src="${escapeHtml(actionNode.dataset.image || '')}" alt="${escapeHtml(actionNode.dataset.label || '高清预览')}" class="max-h-full max-w-full object-contain"/></div>`
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
