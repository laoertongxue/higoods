// @page-pattern: pda
import { appStore } from '../state/store'
import { renderRealQrPlaceholder } from '../components/real-qr'
import { escapeHtml } from '../utils'
import { getProcessTaskQtyDisplayMeta, getProcessTaskQtyDisplayUnit, type ExecProofFile, type PauseReasonCode, type ProcessTask, type StartProofFile } from '../data/fcs/process-tasks.ts'
import { formatFactoryDisplayName } from '../data/fcs/factory-mock-data.ts'
import { getFactoryMasterRecordById } from '../data/fcs/factory-master-store.ts'
import {
  ensureHandoverOrderForStartedTask,
  getHandoverOrderById,
  listHandoverOrdersByTaskId,
  type HandoverOrderStatus,
  type HandoverReceiverKind,
  type PdaHandoverHead,
} from '../data/fcs/pda-handover-events.ts'
import {
  getTaskProcessDisplayName,
} from '../data/fcs/page-adapters/task-execution-adapter'
import {
  isCuttingSpecialTask,
} from '../data/fcs/pda-cutting-execution-source.ts'
import {
  listCuttingSpecialCraftFeiTicketBindings,
} from '../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import {
  getSpecialCraftActionRevision,
  getSpecialCraftTaskOrderById,
} from '../data/fcs/special-craft-task-orders.ts'
import {
  getSpecialCraftPdaCandidateByTaskId,
  getSpecialCraftPdaCandidatesByTaskId,
  getSpecialCraftPdaCandidateByWorkOrderId,
} from '../data/fcs/special-craft-pda-scan.ts'
import { getBindingProcessPdaCandidateByWorkOrderId } from '../data/fcs/binding-process-pda-scan.ts'
import {
  getBindingDetailAvailableProcessQty,
  getBindingProcessOrderById,
} from './process-factory/cutting/binding-strip-orders.ts'
import { executeBindingProcessActionWithWarehouse } from '../data/fcs/binding-process-warehouse-linkage-service.ts'
import {
  getDifferenceRecordsByWorkOrderId,
} from '../data/fcs/process-warehouse-domain.ts'
import {
  addPdaPhysicalScanLine,
  commitPdaPhysicalScanBatch,
  listPdaPhysicalScanBatches,
  listPdaPhysicalScanDraftLines,
  removePdaPhysicalScanLine,
  updatePdaPhysicalScanLineQty,
  type PdaPhysicalScanAction,
  type PdaPhysicalScanCandidate,
  type PdaPhysicalScanInputMethod,
  type PdaPhysicalScanSourceType,
} from '../data/fcs/pda-process-physical-scan.ts'
import {
  listFactoryWaitProcessStockItems,
  listFactoryWarehouseInboundRecords,
} from '../data/fcs/factory-internal-warehouse.ts'
import {
  formatRemainingHours,
  formatStartDueSourceText,
  getStartPrerequisite,
  getTaskStartDueInfo,
  getTaskStartRuleState,
  syncPdaStartRiskAndExceptions,
} from '../data/fcs/pda-start-link'
import {
  PAUSE_REASON_OPTIONS,
  getPauseHandleStatus,
  getTaskMilestoneProofHint,
  getTaskMilestoneState,
  isTaskMilestoneProofSatisfied,
  isTaskMilestoneReported,
  reportTaskMilestone,
  reportTaskPause,
  syncMilestoneOverdueExceptions,
} from '../data/fcs/pda-exec-link'
import { buildTaskQrValue } from '../data/fcs/task-qr.ts'
import { TEST_FACTORY_ID } from '../data/fcs/factory-mock-data.ts'
import { isKolGotoWholeOrderTask } from '../data/fcs/kol-goto-special-flow.ts'
import {
  closeKolGotoPdaExecDialogsOnEscape,
  handleKolGotoPdaExecEvent,
  renderKolGotoPdaExecPage,
} from './pda-kol-goto-exec.ts'
import {
  getMergedProductionTaskDefinition,
  type MergedProductionTaskType,
} from '../data/fcs/merged-production-task.ts'
import {
  renderProductionObjectCodeButton,
  type ProductionObjectCodeType,
} from '../data/fcs/production-order-identity.ts'
import { resolveProductionObjectRequest } from '../data/fcs/production-object-overview.ts'
import {
  getPrintExecutionNodeRecord,
  getPrintOrderHandoverSummary,
  getPrintReviewRecordByOrderId,
  getPrintWorkOrderById,
  getPrintWorkOrderByTaskId,
  getPrintWorkOrderStatusLabel,
  listPrintMachineOptions,
  type PrintWorkOrder,
} from '../data/fcs/printing-task-domain.ts'
import { getWoolWorkOrderByTaskId } from '../data/fcs/wool-task-domain.ts'
import {
  executeDyeWaterSolublePdaAction,
  getDyeExecutionNodeRecord,
  getDyeOrderHandoverSummary,
  getDyeReviewRecordByOrderId,
  getDyeWorkOrderById,
  getDyeWorkOrderByTaskId,
  getDyeWorkOrderStatusLabel,
  getSampleWaitTypeLabel,
  listDyeExecutionNodeRecords,
  listDyeVatOptions,
  startDyeing,
  validateDyeStartPrerequisite,
  type DyeWaterSolublePauseDecision,
  type DyeWorkOrder,
} from '../data/fcs/dyeing-task-domain.ts'
import {
  bindSpecialCraftFeiTicket,
  getPostFinishingWorkOrderForMobile,
  startDyeMaterialWaitWriteback,
  startDyeSampleWaitWriteback,
} from '../data/fcs/process-execution-writeback.ts'
import {
  executeMobileProcessAction,
  getProcessActionOperationRecordsBySource,
  getProcessActionOperationRecordsByTask,
  type ProcessActionOperationRecord,
} from '../data/fcs/process-action-writeback-service.ts'
import {
  advanceDyeWorkOrderOnlineStatus,
  assertDyeWorkOrderOnlineActionAllowed,
  getDyeWorkOrderOnlineRecord,
  isDyeWorkOrderOnlineActionAllowed,
} from '../data/fcs/dye-work-order-online-domain.ts'
import {
  formatProcessQuantityWithUnit,
  getQuantityLabel,
} from '../data/fcs/process-quantity-labels.ts'
import type {
  PostFinishingActionType,
  PostFinishingTaskView,
  PostFinishingWorkOrder,
  SewingFactoryPostTask,
} from '../data/fcs/post-finishing-domain.ts'
import {
  completePostFinishingProjectLine,
  getPostFinishingFlowText,
  getPostFinishingSourceLabel,
  getPostFinishingTaskById,
  getSewingFactoryPostTaskById,
  listPostFinishingWorkOrders,
  listSewingFactoryPostTasks,
  finishSewingFactoryPostTask,
  startPostFinishingProjectLine,
  startSewingFactoryPostTask,
  transferSewingFactoryPostTaskToManagedFactory,
} from '../data/fcs/post-finishing-domain.ts'
import {
  buildMobileExecutionListLocatePathForTask,
  getMobileExecutionTaskById,
  getMobileExecutionTaskBySource,
  getMobileExecutionTaskSourceInfo,
  getMobileTaskTabKey,
  isMobileTaskVisibleForFactory,
  MOBILE_EXECUTION_TASK_TAB_LABELS,
} from '../data/fcs/mobile-execution-task-index.ts'
import {
  getMobileTaskProcessType,
  getMobileTaskAccessResult,
  listPdaMobileExecutionTasks,
  validateWoolPdaTaskAccess,
} from '../data/fcs/process-mobile-task-binding.ts'
import { canFactoryAccessSpecialCraftPdaTask } from '../data/fcs/special-craft-pda-scope.ts'
import { findFactoryPdaRoleById, getPdaSession } from '../data/fcs/store-domain-pda.ts'
import {
  getSewingDeliverySlaView,
  type SewingDeliverySlaView,
} from '../data/fcs/sewing-delivery-sla-view.ts'
import { formatOperationLocalWallClock } from '../data/fcs/sewing-delivery-sla.ts'
import {
  executeWaterSolublePdaAction,
  getWaterSolubleCurrentAction,
  getWaterSolubleWorkOrderById,
  getWaterSolubleWorkOrderByTaskId,
  WATER_SOLUBLE_STATUS_LABEL,
  type WaterSolubleSupervisorDecision,
  type WaterSolubleWorkOrder,
} from '../data/fcs/water-soluble-task-domain.ts'
import {
  validateWaterSolublePdaActor,
  type WaterSolublePdaRoleAction,
} from '../data/fcs/water-soluble-pda-actor.ts'
import { renderPdaCuttingTaskDetailPage } from './pda-cutting-task-detail'
import { renderPdaFrame } from './pda-shell'
import {
  handlePdaWoolExecutionEvent,
  renderPdaWoolExecutionContent,
} from './pda-wool-fact-execution.ts'

interface PdaExecDetailState {
  activeTaskId: string
  initializedPathKey: string
  proofTaskId: string
  startProofFiles: StartProofFile[]
  milestoneProofFiles: ExecProofFile[]
  pauseProofFiles: ExecProofFile[]
  startTime: string
  startHeadcount: string
  milestoneTime: string
  pauseReasonCode: PauseReasonCode
  pauseRemark: string
  pauseTime: string
  fromPauseAction: boolean
  specialCraftScrapQty: string
  specialCraftDamageQty: string
  specialCraftButtonLoopQty: string
  specialCraftAccessoryQty: string
  specialCraftHandoverQty: string
  specialCraftHandoverRemark: string
  specialCraftLineHandoverDrafts: Record<string, string>
  bindingDraftWorkOrderId: string
  bindingDetailId: string
  bindingQty: string
  bindingRemark: string
  specialCraftSkuDrafts: Record<string, { outboundQty: string; receivedQty: string; completedQty: string; handoverQty: string; scrapQty: string; damageQty: string }>
  waterCompletionDraft: { taskId: string; orderId: string; completedQty: string; reason: string }
  waterOverlay: null | {
    type: 'completion' | 'completion-overage' | 'supervisor'
    orderId: string
    taskId: string
    expectedStatus: WaterSolubleWorkOrder['status']
    token: string
  }
  dyeWaterDraft: { taskId: string; dyeOrderId: string; outputQty: string; reason: string }
  dyeWaterOverlay: null | {
    type: 'completion' | 'completion-overage' | 'supervisor'
    dyeOrderId: string
    taskId: string
    expectedStatus: DyeWorkOrder['status']
    token: string
  }
}

type TaskWithHandoverFields = ProcessTask & {
  startHeadcount?: number
  startProofFiles?: StartProofFile[]
  taskQrValue?: string
  handoverOrderId?: string
  handoverStatus?: HandoverOrderStatus | 'NOT_CREATED'
  receiverKind?: HandoverReceiverKind
  receiverName?: string
  handoverAutoCreatePolicy?: 'CREATE_ON_START'
}

const detailState: PdaExecDetailState = {
  activeTaskId: '',
  initializedPathKey: '',
  proofTaskId: '',
  startProofFiles: [],
  milestoneProofFiles: [],
  pauseProofFiles: [],
  startTime: '',
  startHeadcount: '',
  milestoneTime: '',
  pauseReasonCode: 'CUTTING_ISSUE',
  pauseRemark: '',
  pauseTime: '',
  fromPauseAction: false,
  specialCraftScrapQty: '0',
  specialCraftDamageQty: '0',
  specialCraftButtonLoopQty: '',
  specialCraftAccessoryQty: '',
  specialCraftHandoverQty: '',
  specialCraftHandoverRemark: '',
  specialCraftLineHandoverDrafts: {},
  bindingDraftWorkOrderId: '',
  bindingDetailId: '',
  bindingQty: '',
  bindingRemark: '',
  specialCraftSkuDrafts: {},
  waterCompletionDraft: { taskId: '', orderId: '', completedQty: '', reason: '' },
  waterOverlay: null,
  dyeWaterDraft: { taskId: '', dyeOrderId: '', outputQty: '', reason: '' },
  dyeWaterOverlay: null,
}

let waterOverlaySequence = 0
const waterPrimaryActionTokens = new Map<string, string>()
const pendingWaterActions = new Set<string>()
let dyeWaterOverlaySequence = 0
let dyeCompletionActionSequence = 0
const dyeWaterPrimaryActionTokens = new Map<string, string>()
const pendingDyeWaterActions = new Set<string>()

function clearWaterActionScope(): void {
  detailState.waterCompletionDraft = { taskId: '', orderId: '', completedQty: '', reason: '' }
  detailState.waterOverlay = null
  detailState.dyeWaterDraft = { taskId: '', dyeOrderId: '', outputQty: '', reason: '' }
  detailState.dyeWaterOverlay = null
  waterPrimaryActionTokens.clear()
  dyeWaterPrimaryActionTokens.clear()
  pendingWaterActions.clear()
  pendingDyeWaterActions.clear()
}

function syncWaterActionScope(taskId: string): void {
  const normalized = taskId.trim()
  if (detailState.activeTaskId === normalized) return
  clearWaterActionScope()
  detailState.activeTaskId = normalized
}

function getCurrentExecDetailTaskId(): string {
  const path = (appStore.getState().pathname || '').split('?')[0].split('#')[0]
  const prefix = '/fcs/pda/exec/'
  return path.startsWith(prefix) ? decodeURIComponent(path.slice(prefix.length).split('/')[0] || '') : ''
}

function mapPostFinishingStatusToTaskStatus(status: string): ProcessTask['status'] {
  if (status.includes('差异')) return 'BLOCKED'
  if (status.includes('中')) return 'IN_PROGRESS'
  if (status.includes('已交出') || status.includes('已收货') || status.includes('已完成')) return 'DONE'
  if (status === '待质检' || status === '待后道' || status === '待复检' || status === '待交出') return 'IN_PROGRESS'
  return 'NOT_STARTED'
}

function mapPostFinishingOrderToTask(order: PostFinishingWorkOrder, seq: number): ProcessTask {
  return {
    taskId: order.sourceTaskId,
    taskNo: order.postOrderNo,
    productionOrderId: order.sourceProductionOrderNo,
    seq,
    processCode: 'POST_FINISHING',
    processNameZh: '后道',
    stage: 'POST',
    qty: order.plannedGarmentQty,
    qtyUnit: 'PIECE',
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTypes: ['FINISHING'] },
    assignedFactoryId: order.managedPostFactoryId,
    assignedFactoryName: order.managedPostFactoryName,
    qcPoints: [],
    attachments: [],
    status: mapPostFinishingStatusToTaskStatus(order.currentStatus),
    acceptanceStatus: 'ACCEPTED',
    acceptedAt: order.createdAt,
    acceptedBy: order.managedPostFactoryName,
    dispatchedAt: order.createdAt,
    dispatchedBy: '系统',
    dispatchRemark: '后道单同步到工厂端移动应用执行',
    taskDeadline: order.updatedAt,
    receiverKind: 'MANAGED_POST_FACTORY',
    receiverId: order.managedPostFactoryId,
    receiverName: order.managedPostFactoryName,
    handoverStatus: order.handoverRecordId ? 'WRITTEN_BACK' : order.waitHandoverWarehouseRecordId ? 'OPEN' : 'NOT_CREATED',
    handoverOrderId: order.handoverRecordId,
  }
}

function mapSewingFactoryPostTaskToProcessTask(task: SewingFactoryPostTask, seq: number): ProcessTask {
  return {
    taskId: task.postTaskId,
    taskNo: task.postTaskNo,
    productionOrderId: task.productionOrderNo,
    seq,
    processCode: 'SEWING_POST',
    processNameZh: '车缝后道',
    stage: 'POST',
    qty: task.plannedGarmentQty,
    qtyUnit: 'PIECE',
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTypes: ['SEWING'] },
    assignedFactoryId: task.sewingFactoryId,
    assignedFactoryName: task.sewingFactoryName,
    qcPoints: [],
    attachments: [],
    status: task.status.includes('中') ? 'IN_PROGRESS' : task.status === '已交后道工厂' || task.status === '后道完成' ? 'DONE' : 'NOT_STARTED',
    acceptanceStatus: 'ACCEPTED',
    acceptedAt: task.postFinishedAt || '2026-04-01 08:30',
    acceptedBy: task.sewingFactoryName,
    dispatchedAt: task.postFinishedAt || '2026-04-01 08:30',
    dispatchedBy: '系统',
    dispatchRemark: '车缝工厂同时完成车缝与后道，完成后交给后道工厂质检和复检',
    taskDeadline: task.handedToManagedPostFactoryAt || '2026-04-25 18:00',
    receiverKind: 'MANAGED_POST_FACTORY',
    receiverId: task.managedPostFactoryId,
    receiverName: task.managedPostFactoryName,
    handoverStatus: task.status === '已交后道工厂' ? 'WRITTEN_BACK' : 'NOT_CREATED',
  }
}

function listTaskFacts(): ProcessTask[] {
  return listPdaMobileExecutionTasks()
}

function getTaskFactById(taskId: string): ProcessTask | null {
  return getMobileExecutionTaskById(taskId)
}

function getTaskDisplayNo(task: ProcessTask): string {
  return task.taskNo || task.taskId
}

function getRootTaskDisplayNo(task: ProcessTask): string {
  return task.rootTaskNo || task.taskNo || task.taskId
}

function canCurrentSessionUseWaterAction(order: WaterSolubleWorkOrder, action: WaterSolublePdaRoleAction): boolean {
  const session = getPdaSession()
  return Boolean(session && !validateWaterSolublePdaActor(session, order.factoryId, action))
}

function createWaterOverlayToken(orderId: string): string {
  waterOverlaySequence += 1
  return `${orderId}:${waterOverlaySequence}`
}

function getWaterPrimaryAction(order: WaterSolubleWorkOrder): { action: string; label: string } | null {
  const currentAction = getWaterSolubleCurrentAction(order)
  if (!currentAction) return null
  if (currentAction.actionCode === 'WAIT_MATERIAL' && canCurrentSessionUseWaterAction(order, 'OPERATE')) return { action: 'water-material-ready', label: currentAction.actionName }
  if (currentAction.actionCode === 'START' && canCurrentSessionUseWaterAction(order, 'OPERATE')) return { action: 'water-start', label: currentAction.actionName }
  if (currentAction.actionCode === 'COMPLETE' && canCurrentSessionUseWaterAction(order, 'OPERATE')) return { action: 'water-complete', label: currentAction.actionName }
  if (currentAction.actionCode === 'SUPERVISOR' && canCurrentSessionUseWaterAction(order, 'SUPERVISE')) return { action: 'water-open-supervisor', label: currentAction.actionName }
  if (currentAction.actionCode === 'HANDOVER' && canCurrentSessionUseWaterAction(order, 'HANDOVER')) return { action: 'water-go-handover', label: currentAction.actionName }
  return null
}

function renderWaterSolublePrimaryAction(order: WaterSolubleWorkOrder): string {
  const primaryAction = getWaterPrimaryAction(order)
  if (!primaryAction) {
    const message = order.status === 'PRODUCTION_PAUSED'
      ? '等待生产主管处理数量不足。'
      : order.status === 'WAIT_HANDOVER'
        ? '等待交接人员去交出。'
        : getWaterSolubleCurrentAction(order)?.message || '当前没有需要操作的动作。'
    return `<div class="rounded-md border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">${escapeHtml(message)}</div>`
  }
  const token = `${order.waterOrderId}:${order.status}:${order.updatedAt}`
  waterPrimaryActionTokens.set(order.waterOrderId, token)
  return `
    <button
      type="button"
      class="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-base font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
      data-pda-execd-action="${primaryAction.action}"
      data-water-primary-action="true"
      data-order-id="${escapeHtml(order.waterOrderId)}"
      data-task-id="${escapeHtml(order.taskId)}"
      data-expected-status="${escapeHtml(order.status)}"
      data-action-token="${escapeHtml(token)}"
    >${escapeHtml(primaryAction.label)}</button>
  `
}

function renderWaterSolubleDetailContent(order: WaterSolubleWorkOrder): string {
  const currentAction = getWaterSolubleCurrentAction(order.waterOrderId)
  return `
    <div class="space-y-4 bg-background p-4 pb-6" data-testid="pda-water-soluble-detail-content">
      <div class="flex items-center gap-2">
        <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-pda-execd-action="back">
          <i data-lucide="arrow-left" class="mr-1 h-4 w-4"></i>
          返回执行列表
        </button>
        <h1 class="text-base font-semibold">水溶任务详情</h1>
      </div>

      <article class="rounded-lg border bg-card">
        <header class="flex items-center justify-between gap-2 border-b px-4 py-3">
          <span class="font-mono text-sm font-semibold">${escapeHtml(order.waterOrderNo)}</span>
          <span class="rounded bg-muted px-2 py-0.5 text-xs">${escapeHtml(WATER_SOLUBLE_STATUS_LABEL[order.status])}</span>
        </header>
        <div class="grid grid-cols-2 gap-x-4 gap-y-2 p-4 text-sm">
          <span class="text-xs text-muted-foreground">生产单号</span>
          <span class="text-xs font-medium">${escapeHtml(order.productionOrderNo)}</span>
          <span class="text-xs text-muted-foreground">物料</span>
          <span class="text-xs font-medium">${escapeHtml(`${order.materialName} / ${order.materialCode}`)}</span>
          <span class="text-xs text-muted-foreground">计划数量</span>
          <span class="text-xs font-medium">${escapeHtml(`${order.plannedQty} ${order.qtyUnit}`)}</span>
          <span class="text-xs text-muted-foreground">完成数量</span>
          <span class="text-xs font-medium">${escapeHtml(`${order.completedQty} ${order.qtyUnit}`)}</span>
          <span class="text-xs text-muted-foreground">当前步骤</span>
          <span class="text-xs font-medium">${escapeHtml(WATER_SOLUBLE_STATUS_LABEL[order.status])}</span>
          <span class="text-xs text-muted-foreground">现在要做</span>
          <span class="text-xs font-medium">${escapeHtml(currentAction?.actionName || '查看任务')}</span>
        </div>
      </article>

      ${order.exceptionReason
        ? `<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${escapeHtml(order.exceptionReason)}</div>`
        : ''}
      <section class="rounded-lg border border-blue-200 bg-blue-50 p-4" data-testid="pda-water-current-action" data-skip-page-rerender="true">
        <p class="mb-3 text-xs font-medium text-blue-800">现在要做：${escapeHtml(currentAction?.actionName || '查看任务')}</p>
        ${renderWaterSolublePrimaryAction(order)}
      </section>
      <details class="rounded-lg border bg-card">
        <summary class="cursor-pointer px-4 py-3 text-sm font-medium">完整执行记录（${order.actionLogs.length} 条）</summary>
        <div class="space-y-2 border-t p-4">${order.actionLogs.map((log) => `<div class="text-xs"><div class="font-medium">${escapeHtml(log.action)}</div><div class="text-muted-foreground">${escapeHtml(log.detail)} · ${escapeHtml(log.at)}</div></div>`).join('')}</div>
      </details>
    </div>
  `
}

function renderPdaWaterSolubleDetail(order: WaterSolubleWorkOrder): string {
  const content = `
    <div data-testid="pda-water-soluble-detail">
      ${renderWaterSolubleDetailContent(order)}
      <div data-testid="pda-water-soluble-overlay" data-skip-page-rerender="true">${renderWaterSolubleOverlay()}</div>
    </div>
  `
  return renderPdaFrame(content, 'exec', { disableTodoAutoOpen: true })
}

function renderWaterSolubleAccessDenied(): string {
  const content = `
    <div class="flex min-h-[760px] flex-col bg-background">
      <div class="p-4">
        <button class="inline-flex items-center rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted" data-pda-execd-action="back">
          <i data-lucide="arrow-left" class="mr-1 h-4 w-4"></i>
          返回
        </button>
      </div>
      <div class="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">当前账号不能查看该工厂任务</div>
    </div>
  `
  return getPdaSession()
    ? renderPdaFrame(content, 'exec', { disableTodoAutoOpen: true })
    : content
}

function renderWaterSolubleOverlay(): string {
  const overlay = detailState.waterOverlay
  if (!overlay || overlay.taskId !== detailState.activeTaskId) return ''
  const actualOrder = getWaterSolubleWorkOrderById(overlay.orderId)
  if (!actualOrder || actualOrder.taskId !== overlay.taskId) return ''
  const sharedAttrs = `data-order-id="${escapeHtml(actualOrder.waterOrderId)}" data-expected-status="${escapeHtml(overlay.expectedStatus)}" data-overlay-token="${escapeHtml(overlay.token)}"`
  if (overlay.type === 'supervisor') {
    return `<div class="fixed inset-0 z-50 flex items-center justify-center"><div class="absolute inset-0 bg-black/45" data-pda-execd-action="water-close-overlay"></div><div class="relative w-[420px] max-w-[90vw] rounded-lg bg-background p-5 shadow-lg"><h2 class="text-lg font-semibold">处理数量不足</h2><p class="mt-1 text-sm text-muted-foreground">实际完成 ${actualOrder.completedQty} ${escapeHtml(actualOrder.qtyUnit)}</p><div class="mt-4 space-y-2">${([
      ['CONTINUE_PROCESSING', '继续补做'],
      ['CONTINUE_WITH_ACTUAL_QTY', '按实际数量继续'],
      ['RETURN_FOR_REWORK', '退回重做'],
    ] as Array<[WaterSolubleSupervisorDecision, string]>).map(([decision, label]) => `<button type="button" class="h-10 w-full rounded-md border px-3 text-sm font-medium hover:bg-muted" data-pda-execd-action="water-resolve-pause" data-decision="${decision}" ${sharedAttrs}>${label}</button>`).join('')}</div><button type="button" class="mt-3 h-9 w-full text-sm text-muted-foreground" data-pda-execd-action="water-close-overlay">取消</button></div></div>`
  }
  const draft = detailState.waterCompletionDraft
  const isOverage = overlay.type === 'completion-overage'
  return `<div class="fixed inset-0 z-50 flex items-center justify-center"><div class="absolute inset-0 bg-black/45" data-pda-execd-action="water-close-overlay"></div><div class="relative w-[420px] max-w-[90vw] rounded-lg bg-background p-5 shadow-lg"><h2 class="text-lg font-semibold">${isOverage ? '确认超出计划数量' : '完成水溶'}</h2><p class="mt-1 text-sm text-muted-foreground">计划 ${actualOrder.plannedQty} ${escapeHtml(actualOrder.qtyUnit)}</p>${isOverage ? `<p class="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">实际数量超过计划，请再次确认。</p>` : `<div class="mt-4 space-y-3"><label class="block text-sm">实际完成数量<input class="mt-1 h-10 w-full rounded-md border px-3" inputmode="decimal" data-pda-execd-field="waterCompletedQty" value="${escapeHtml(draft.completedQty)}"></label><label class="block text-sm">数量不一致原因<textarea class="mt-1 min-h-20 w-full rounded-md border p-3" data-pda-execd-field="waterReason">${escapeHtml(draft.reason)}</textarea></label></div>`}<div class="mt-5 flex gap-2"><button type="button" class="h-10 flex-1 rounded-md border" data-pda-execd-action="${isOverage ? 'water-back-completion' : 'water-close-overlay'}">取消</button><button type="button" class="h-10 flex-1 rounded-md bg-primary text-primary-foreground disabled:opacity-60" data-pda-execd-action="water-confirm-completion" ${sharedAttrs}>${isOverage ? '确认超量完成' : '确认完成'}</button></div></div></div>`
}

function refreshWaterSolubleDetail(orderId: string): void {
  if (typeof document === 'undefined') return
  const order = getWaterSolubleWorkOrderById(orderId)
  const node = document.querySelector<HTMLElement>('[data-testid="pda-water-soluble-detail-content"]')
  if (order && node) node.outerHTML = renderWaterSolubleDetailContent(order)
}

function refreshWaterSolubleOverlay(): void {
  if (typeof document === 'undefined') return
  const node = document.querySelector<HTMLElement>('[data-testid="pda-water-soluble-overlay"]')
  if (node) node.innerHTML = renderWaterSolubleOverlay()
}

function clearWaterSolubleOverlay(): void {
  detailState.waterOverlay = null
  detailState.waterCompletionDraft = { taskId: '', orderId: '', completedQty: '', reason: '' }
  refreshWaterSolubleOverlay()
}

function renderPdaObjectCode({
  objectType,
  objectId,
  label,
  relatedProductionOrderNo,
  className = 'text-left font-mono text-blue-600 hover:underline',
}: {
  objectType: ProductionObjectCodeType
  objectId?: string | null
  label?: string | null
  relatedProductionOrderNo?: string | null
  className?: string
}): string {
  const objectCode = (label || objectId || '').trim()
  const targetId = (objectId || '').trim()
  if (!targetId || !objectCode) return escapeHtml(objectCode || '-')

  const preferred = resolveProductionObjectRequest({ objectType, objectId: targetId, relatedProductionOrderNo })
  const resolved = preferred.status === 'READY' || !relatedProductionOrderNo
    ? preferred
    : resolveProductionObjectRequest({ objectType, objectId: targetId })
  // Only render clickable IDs that open a real overview; unresolved PDA refs stay plain text.
  if (resolved.status !== 'READY') return escapeHtml(objectCode)

  return renderProductionObjectCodeButton({
    objectType: resolved.indexItem.objectType,
    objectId: resolved.indexItem.primaryNo,
    label: objectCode,
    relatedProductionOrderNo: resolved.indexItem.relatedProductionOrderNo,
    defaultTab: resolved.clickedRef.defaultTab,
    highlightKey: resolved.clickedRef.highlightKey,
    className,
  })
}

function getPdaSourceObjectType(sourceInfo: ReturnType<typeof getMobileExecutionTaskSourceInfo>): ProductionObjectCodeType {
  if (sourceInfo.printOrderNo) return 'PRINT_WORK_ORDER'
  if (sourceInfo.dyeOrderNo) return 'DYE_WORK_ORDER'
  if (sourceInfo.cuttingOrderNo) return 'CUT_ORDER'
  if (sourceInfo.sourceType === 'POST_FINISHING_TASK' && sourceInfo.postOrderNo) return 'QC_MASTER_ORDER'
  return 'PROCESS_DOC'
}

function getCoveredProcessSummaryText(task: ProcessTask): string {
  const coveredProcesses = task.coveredProcesses ?? []
  if (coveredProcesses.length === 0) return task.processBusinessName || task.processNameZh || '—'
  return coveredProcesses
    .map((item) => item.craftName ? `${item.processName}/${item.craftName}` : item.processName)
    .join('、')
}

function getQtyUnitLabel(unit: string | undefined): string {
  if (!unit) return '件'
  if (unit === 'PIECE' || unit === '件') return '件'
  if (unit === '片') return '片'
  if (unit === 'ROLL' || unit === '卷') return '卷'
  if (unit === 'LAYER' || unit === '层') return '层'
  return unit
}

function getTaskQrValue(task: TaskWithHandoverFields): string {
  return task.taskQrValue || buildTaskQrValue(task.taskId)
}

function getReceiverKindLabel(kind: HandoverReceiverKind | undefined): string {
  if (kind === 'WAREHOUSE') return '仓库'
  if (kind === 'MANAGED_POST_FACTORY') return '我方后道工厂'
  return ''
}

function getReceiverDisplayText(task: TaskWithHandoverFields): string {
  if (task.receiverName?.trim()) return task.receiverName.trim()
  return getReceiverKindLabel(task.receiverKind) || '未配置'
}

function getHandoverOrderStatusLabel(status: HandoverOrderStatus | undefined): string {
  if (!status) return '未生成'
  const labelMap: Record<HandoverOrderStatus, string> = {
    AUTO_CREATED: '已创建',
    OPEN: '可交出',
    PARTIAL_SUBMITTED: '已部分交出',
    WAIT_RECEIVER_WRITEBACK: '待收货',
    PARTIAL_WRITTEN_BACK: '部分收货',
    WRITTEN_BACK: '已收货',
    DIFF_WAIT_FACTORY_CONFIRM: '差异待确认',
    HAS_OBJECTION: '有异议',
    OBJECTION_PROCESSING: '异议处理中',
    CLOSED: '已关闭',
  }
  return labelMap[status]
}

function canTaskUseHandover(task: TaskWithHandoverFields): boolean {
  return task.handoverAutoCreatePolicy === 'CREATE_ON_START' || Boolean(task.taskQrValue)
}

function syncTaskHandoverFields(task: TaskWithHandoverFields, handoverOrder: PdaHandoverHead | null): void {
  if (!handoverOrder) return
  task.handoverOrderId = handoverOrder.handoverOrderId || handoverOrder.handoverId
  if (handoverOrder.handoverOrderStatus) {
    task.handoverStatus = handoverOrder.handoverOrderStatus
  }
  if (handoverOrder.receiverKind) {
    task.receiverKind = handoverOrder.receiverKind
  }
  if (handoverOrder.receiverName) {
    task.receiverName = handoverOrder.receiverName
  }
}

function getTaskHandoverOrder(task: TaskWithHandoverFields): PdaHandoverHead | null {
  let handoverOrder = task.handoverOrderId ? getHandoverOrderById(task.handoverOrderId) ?? null : null
  if (!handoverOrder) {
    handoverOrder = listHandoverOrdersByTaskId(task.taskId)[0] ?? null
  }

  const started =
    Boolean(task.startedAt)
    || task.status === 'IN_PROGRESS'
    || task.status === 'DONE'
    || task.status === 'BLOCKED'
  if (!handoverOrder && started && canTaskUseHandover(task) && !getDyeWorkOrderByTaskId(task.taskId)) {
    try {
      const ensured = ensureHandoverOrderForStartedTask(task.taskId)
      handoverOrder = getHandoverOrderById(ensured.handoverOrderId) ?? null
    } catch {
      handoverOrder = null
    }
  }

  syncTaskHandoverFields(task, handoverOrder)
  return handoverOrder
}

function renderHandoverOrderCard(handoverOrder: PdaHandoverHead): string {
  const handoverOrderId = handoverOrder.handoverOrderId || handoverOrder.handoverId
  const unitLabel = getQtyUnitLabel(handoverOrder.qtyUnit)
  return `
    <article class="rounded-lg border bg-card">
      <header class="border-b px-4 py-3">
        <h2 class="flex items-center gap-2 text-sm font-semibold">
          <i data-lucide="archive" class="h-4 w-4"></i>
          交出单
        </h2>
      </header>

      <div class="p-4 text-sm">
        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
          <span class="text-xs text-muted-foreground">交出单号</span>
          <span class="text-xs font-medium">${renderPdaObjectCode({
            objectType: 'HANDOVER_ORDER',
            objectId: handoverOrder.handoverOrderNo || handoverOrderId,
            relatedProductionOrderNo: handoverOrder.productionOrderNo,
          })}</span>
          <span class="text-xs text-muted-foreground">状态</span>
          <span class="text-xs font-medium">${escapeHtml(getHandoverOrderStatusLabel(handoverOrder.handoverOrderStatus))}</span>
          <span class="text-xs text-muted-foreground">已交出</span>
          <span class="text-xs">${handoverOrder.submittedQtyTotal ?? 0} ${escapeHtml(unitLabel)}</span>
          <span class="text-xs text-muted-foreground">已收货</span>
          <span class="text-xs">${handoverOrder.writtenBackQtyTotal ?? 0} ${escapeHtml(unitLabel)}</span>
          <span class="text-xs text-muted-foreground">差异</span>
          <span class="text-xs">${handoverOrder.diffQtyTotal ?? 0} ${escapeHtml(unitLabel)}</span>
          <span class="text-xs text-muted-foreground">异议</span>
          <span class="text-xs">${handoverOrder.objectionCount} 条</span>
          <span class="text-xs text-muted-foreground">待收货</span>
          <span class="text-xs">${handoverOrder.pendingWritebackCount} 条</span>
        </div>
      </div>
    </article>
  `
}

function parseSewingDeliveryWallClock(value: string): number {
  return Date.parse(`${value.replace(' ', 'T')}Z`)
}

function formatSewingDeliveryRemaining(deadlineAt: string, nowAt: string): string {
  const remainingHours = (parseSewingDeliveryWallClock(deadlineAt) - parseSewingDeliveryWallClock(nowAt)) / 3_600_000
  if (remainingHours <= 0) return `已超时 ${Math.ceil(Math.abs(remainingHours))} 小时`
  return `${Math.ceil(remainingHours)} 小时`
}

export function renderPdaSewingDeliveryProgress(
  view: SewingDeliverySlaView | undefined | null,
  unit: string,
  nowAt: string = formatOperationLocalWallClock(),
): string {
  if (!view) return ''
  const assignedQty = view.projection.snapshot.assignedQty
  const overQty = Math.max(view.confirmedReceivedQty - assignedQty, 0)
  const nextMilestone = view.projection.milestones.find((milestone) => !milestone.firstReachedAt)
  return `
    <article class="rounded-lg border bg-card" data-pda-sewing-delivery-progress="true">
      <header class="border-b px-4 py-3"><h2 class="text-sm font-semibold">交付进度</h2></header>
      <div class="space-y-3 p-4 text-sm">
        <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <span class="text-muted-foreground">分配量</span><span class="font-medium">${assignedQty} ${escapeHtml(unit)}</span>
          <span class="text-muted-foreground">已交</span><span class="font-medium">${view.submittedQty} ${escapeHtml(unit)}</span>
          <span class="text-muted-foreground">后道最终确认</span><span class="font-medium">${view.confirmedReceivedQty} ${escapeHtml(unit)}</span>
          <span class="text-muted-foreground">还差</span><span class="font-medium">${view.projection.remainingQty} ${escapeHtml(unit)}</span>
          <span class="text-muted-foreground">下一节点</span><span class="font-medium">${nextMilestone ? `${nextMilestone.ratio * 100}% · ${nextMilestone.targetQty} ${escapeHtml(unit)}` : '全部节点已完成'}</span>
          <span class="text-muted-foreground">剩余时间</span><span class="font-medium">${nextMilestone ? escapeHtml(formatSewingDeliveryRemaining(nextMilestone.deadlineAt, nowAt)) : '0 小时'}</span>
        </div>
        ${overQty > 0 ? `<div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">已超收 ${overQty} ${escapeHtml(unit)}</div>` : ''}
      </div>
    </article>
  `
}

function renderPrintingStatusBadge(label: string, tone: 'muted' | 'info' | 'warning' | 'success' | 'danger'): string {
  const className =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'danger'
          ? 'border-red-200 bg-red-50 text-red-700'
          : tone === 'info'
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-slate-50 text-slate-700'

  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function getReceiptStatusMeta(status: string | undefined): { label: string; tone: 'muted' | 'info' | 'warning' | 'success' | 'danger' } {
  if (status === 'FULL_HANDOVER') return { label: '全部交出', tone: 'success' }
  if (status === 'PARTIAL_HANDOVER') return { label: '部分交出', tone: 'warning' }
  if (status === 'HANDOVER_DIFFERENCE') return { label: '收货差异', tone: 'danger' }
  if (status === 'WAIT_RECEIVE' || status === 'HANDOVER_WAIT_RECEIVE') return { label: '交出待收货', tone: 'warning' }
  return { label: '待收货确认', tone: 'muted' }
}

function canOperatePrintingNode(task: ProcessTask): boolean {
  const currentFactoryId = getPdaSession()?.factoryId || task.assignedFactoryId || TEST_FACTORY_ID
  return isMobileTaskVisibleForFactory(task, currentFactoryId) && task.status !== 'NOT_STARTED' && task.status !== 'CANCELLED'
}

function renderPrintingTaskCard(
  task: TaskWithHandoverFields,
  printOrder: PrintWorkOrder,
  handoverOrder: PdaHandoverHead | null,
): string {
  const colorTestNode = getPrintExecutionNodeRecord(printOrder.printOrderId, 'COLOR_TEST')
  const printNode = getPrintExecutionNodeRecord(printOrder.printOrderId, 'PRINT')
  const transferNode = getPrintExecutionNodeRecord(printOrder.printOrderId, 'TRANSFER')
  const review = getPrintReviewRecordByOrderId(printOrder.printOrderId)
  const handoverSummary = getPrintOrderHandoverSummary(printOrder.printOrderId)
  const printMachines = listPrintMachineOptions(printOrder.printFactoryId)
  const canOperate = canOperatePrintingNode(task)
  const printQuantityContext = {
    processType: 'PRINT',
    sourceType: 'PRINTING_WORK_ORDER',
    sourceId: printOrder.printOrderId,
    objectType: printOrder.objectType,
    qtyUnit: printOrder.qtyUnit,
    isPiecePrinting: printOrder.isPiecePrinting,
    isFabricPrinting: printOrder.isFabricPrinting,
  } as const
  const printDoneQtyLabel = getQuantityLabel({
    ...printQuantityContext,
    operationCode: 'PRINT_FINISH_PRINTING',
    qtyPurpose: '已完成',
  })
  const printUsedQtyLabel = printOrder.qtyUnit === '片' || printOrder.objectType === '裁片' ? '投入裁片数量' : '原料使用面料米数'
  const transferDoneQtyLabel = getQuantityLabel({
    ...printQuantityContext,
    operationCode: 'PRINT_FINISH_TRANSFER',
    qtyPurpose: '已完成',
  })
  const receivedQtyLabel = getQuantityLabel({
    ...printQuantityContext,
    qtyPurpose: '实收',
  })
  const diffQtyLabel = getQuantityLabel({
    ...printQuantityContext,
    qtyPurpose: '差异',
  })

  const colorTestBadge = colorTestNode?.finishedAt
    ? renderPrintingStatusBadge('花型测试完成', 'success')
    : colorTestNode?.startedAt
      ? renderPrintingStatusBadge('待调色测试', 'info')
      : renderPrintingStatusBadge('待花型图', 'muted')
  const printBadge = printNode?.finishedAt
    ? renderPrintingStatusBadge('打印完成', 'success')
    : printNode?.startedAt
      ? renderPrintingStatusBadge('打印中', 'info')
      : renderPrintingStatusBadge('等打印', 'muted')
  const transferBadge = transferNode?.finishedAt
    ? renderPrintingStatusBadge('转印完成', 'success')
    : transferNode?.startedAt
      ? renderPrintingStatusBadge('转印中', 'info')
      : renderPrintingStatusBadge('等转印', 'muted')
  const handoverBadge =
    printOrder.status === 'WAIT_HANDOVER'
      ? renderPrintingStatusBadge('待送货', 'warning')
      : renderPrintingStatusBadge(getReceiptStatusMeta(printOrder.status).label, getReceiptStatusMeta(printOrder.status).tone)
  const reviewMeta = getReceiptStatusMeta(review?.reviewStatus)
  const reviewBadge = renderPrintingStatusBadge(reviewMeta.label, reviewMeta.tone)

  return `
    <article class="rounded-lg border bg-card">
      <header class="border-b px-4 py-3">
        <div class="flex items-center justify-between gap-2">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <i data-lucide="palette" class="h-4 w-4"></i>
            印花任务
          </h2>
          ${renderPrintingStatusBadge(getPrintWorkOrderStatusLabel(printOrder.status), printOrder.status === 'FULL_HANDOVER' ? 'success' : printOrder.status === 'HANDOVER_DIFFERENCE' ? 'danger' : printOrder.status === 'WAIT_HANDOVER' || printOrder.status === 'HANDOVER_WAIT_RECEIVE' || printOrder.status === 'PARTIAL_HANDOVER' ? 'warning' : 'info')}
        </div>
      </header>

      <div class="space-y-4 p-4 text-sm">
        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
          <span class="text-xs text-muted-foreground">印花加工单</span>
          <span class="text-xs font-medium">${renderPdaObjectCode({
            objectType: 'PRINT_WORK_ORDER',
            objectId: printOrder.printOrderNo,
            relatedProductionOrderNo: printOrder.sourceProductionOrderNo || printOrder.sourceProductionOrderId || task.productionOrderId,
          })}</span>
          <span class="text-xs text-muted-foreground">花型</span>
          <span class="text-xs">${escapeHtml(printOrder.patternNo)} / ${escapeHtml(printOrder.patternVersion)}</span>
          <span class="text-xs text-muted-foreground">当前状态</span>
          <span class="text-xs">${escapeHtml(getPrintWorkOrderStatusLabel(printOrder.status))}</span>
          <span class="text-xs text-muted-foreground">接收方</span>
          <span class="text-xs">${escapeHtml(printOrder.targetTransferWarehouseName)}</span>
          <span class="text-xs text-muted-foreground">打印机候选</span>
          <span class="text-xs">${printMachines.length > 0 ? escapeHtml(printMachines.map((item) => item.printerNo).join(' / ')) : '未配置'}</span>
        </div>

        <div class="grid gap-3 xl:grid-cols-2">
          <section class="rounded-lg border bg-background p-3">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium">花型测试</h3>
              ${colorTestBadge}
            </div>
            <div class="mt-3 space-y-1 text-xs">
              <div><span class="text-muted-foreground">开始时间：</span>${escapeHtml(colorTestNode?.startedAt || '—')}</div>
              <div><span class="text-muted-foreground">完成时间：</span>${escapeHtml(colorTestNode?.finishedAt || '—')}</div>
              <div><span class="text-muted-foreground">结果：</span>${escapeHtml(colorTestNode?.remark || '待调色测试')}</div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="print-start-color-test"
                data-print-order-id="${escapeHtml(printOrder.printOrderId)}"
                ${!canOperate || Boolean(colorTestNode?.startedAt) ? 'disabled' : ''}
              >
                开始花型测试
              </button>
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="print-complete-color-test"
                data-print-order-id="${escapeHtml(printOrder.printOrderId)}"
                ${!canOperate || !colorTestNode?.startedAt || Boolean(colorTestNode?.finishedAt) ? 'disabled' : ''}
              >
                完成花型测试
              </button>
            </div>
          </section>

          <section class="rounded-lg border bg-background p-3">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium">打印</h3>
              ${printBadge}
            </div>
            <div class="mt-3 space-y-1 text-xs">
              <div><span class="text-muted-foreground">打印机编号：</span>${escapeHtml(printNode?.printerNo || '未开始')}</div>
              <div><span class="text-muted-foreground">打印速度：</span>${printNode?.printerSpeedPerHour ? `${printNode.printerSpeedPerHour} 米/小时` : '—'}</div>
              <div><span class="text-muted-foreground">开始时间：</span>${escapeHtml(printNode?.startedAt || '—')}</div>
              <div><span class="text-muted-foreground">结束时间：</span>${escapeHtml(printNode?.finishedAt || '—')}</div>
              <div><span class="text-muted-foreground">实际完成（${escapeHtml(printDoneQtyLabel)}）：</span>${printNode?.outputQty ?? 0} ${escapeHtml(getQtyUnitLabel(printOrder.qtyUnit))}</div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="print-start-printing"
                data-print-order-id="${escapeHtml(printOrder.printOrderId)}"
                ${!canOperate || !colorTestNode?.finishedAt || Boolean(printNode?.startedAt) ? 'disabled' : ''}
              >
                开始打印
              </button>
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="print-complete-printing"
                data-print-order-id="${escapeHtml(printOrder.printOrderId)}"
                ${!canOperate || !printNode?.startedAt || Boolean(printNode?.finishedAt) ? 'disabled' : ''}
              >
                完成打印
              </button>
            </div>
          </section>

          <section class="rounded-lg border bg-background p-3">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium">转印</h3>
              ${transferBadge}
            </div>
            <div class="mt-3 space-y-1 text-xs">
              <div><span class="text-muted-foreground">开始时间：</span>${escapeHtml(transferNode?.startedAt || '—')}</div>
              <div><span class="text-muted-foreground">结束时间：</span>${escapeHtml(transferNode?.finishedAt || '—')}</div>
              <div><span class="text-muted-foreground">${escapeHtml(printUsedQtyLabel)}：</span>${transferNode?.usedMaterialQty ?? 0} ${escapeHtml(getQtyUnitLabel(printOrder.qtyUnit))}</div>
              <div><span class="text-muted-foreground">实际完成（${escapeHtml(transferDoneQtyLabel)}）：</span>${transferNode?.actualCompletedQty ?? 0} ${escapeHtml(getQtyUnitLabel(printOrder.qtyUnit))}</div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="print-start-transfer"
                data-print-order-id="${escapeHtml(printOrder.printOrderId)}"
                ${!canOperate || !printNode?.finishedAt || Boolean(transferNode?.startedAt) ? 'disabled' : ''}
              >
                开始转印
              </button>
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="print-complete-transfer"
                data-print-order-id="${escapeHtml(printOrder.printOrderId)}"
                ${!canOperate || !transferNode?.startedAt || Boolean(transferNode?.finishedAt) ? 'disabled' : ''}
              >
                完成转印
              </button>
            </div>
          </section>

          <section class="rounded-lg border bg-background p-3">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium">待送货</h3>
              ${handoverBadge}
            </div>
            <div class="mt-3 space-y-1 text-xs">
              <div><span class="text-muted-foreground">交出单：</span>${
                handoverOrder || printOrder.handoverOrderNo || printOrder.handoverOrderId
                  ? renderPdaObjectCode({
                      objectType: 'HANDOVER_ORDER',
                      objectId: handoverOrder?.handoverOrderNo || printOrder.handoverOrderNo || printOrder.handoverOrderId,
                      relatedProductionOrderNo: handoverOrder?.productionOrderNo || printOrder.sourceProductionOrderNo || printOrder.sourceProductionOrderId || task.productionOrderId,
                    })
                  : '未生成'
              }</div>
              <div><span class="text-muted-foreground">交出记录：</span>${handoverSummary.recordCount} 条</div>
              <div><span class="text-muted-foreground">待收货：</span>${handoverSummary.pendingWritebackCount} 条</div>
              <div><span class="text-muted-foreground">${escapeHtml(receivedQtyLabel)}：</span>${handoverSummary.writtenBackQty} ${escapeHtml(getQtyUnitLabel(printOrder.qtyUnit))}</div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="view-handover-order"
                data-handover-order-id="${escapeHtml(handoverOrder?.handoverOrderId || handoverOrder?.handoverId || '')}"
                ${!handoverOrder ? 'disabled' : ''}
              >
                查看交出单
              </button>
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="print-submit-handover"
                data-task-id="${escapeHtml(printOrder.taskId)}"
                data-handover-order-id="${escapeHtml(handoverOrder?.handoverOrderId || handoverOrder?.handoverId || '')}"
                ${!handoverOrder || printOrder.status === 'WAIT_PRINT' || printOrder.status === 'PRINTING' || printOrder.status === 'WAIT_TRANSFER' || printOrder.status === 'TRANSFERRING' ? 'disabled' : ''}
              >
                发起交出
              </button>
            </div>
          </section>

          <section class="rounded-lg border bg-background p-3 xl:col-span-2">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium">收货确认</h3>
              ${reviewBadge}
            </div>
            <div class="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
              <div><span class="text-muted-foreground">接收方：</span>${escapeHtml(printOrder.targetTransferWarehouseName)}</div>
              <div><span class="text-muted-foreground">${escapeHtml(receivedQtyLabel)}：</span>${review?.receivedQty ?? handoverSummary.writtenBackQty} ${escapeHtml(getQtyUnitLabel(printOrder.qtyUnit))}</div>
              <div><span class="text-muted-foreground">${escapeHtml(diffQtyLabel)}：</span>${review?.diffQty ?? handoverSummary.diffQty} ${escapeHtml(getQtyUnitLabel(printOrder.qtyUnit))}</div>
              <div><span class="text-muted-foreground">收货状态：</span>${escapeHtml(reviewMeta.label)}</div>
              <div class="sm:col-span-2"><span class="text-muted-foreground">备注：</span>${escapeHtml(review?.remark || '仓库确认收货后更新状态')}</div>
            </div>
          </section>
        </div>
      </div>
    </article>
  `
}

function canOperateDyeingNode(task: ProcessTask, dyeOrderId: string): boolean {
  const currentFactoryId = getPdaSession()?.factoryId || task.assignedFactoryId || TEST_FACTORY_ID
  return isMobileTaskVisibleForFactory(task, currentFactoryId)
    && task.status !== 'NOT_STARTED'
    && task.status !== 'CANCELLED'
    && getDyeWorkOrderOnlineRecord(dyeOrderId).status !== '取消'
}

function getExecDetailSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, queryString = ''] = pathname.split('?')
  return new URLSearchParams(queryString)
}

type SpecialCraftPdaSurface = 'EXECUTION' | 'HANDOVER_RECEIVE' | 'HANDOVER_HANDOUT'

function getSpecialCraftPdaSurface(): SpecialCraftPdaSurface {
  const searchParams = getExecDetailSearchParams()
  if (searchParams.get('surface') !== 'handover') return 'EXECUTION'
  return searchParams.get('handoverAction') === 'handout' ? 'HANDOVER_HANDOUT' : 'HANDOVER_RECEIVE'
}

function resolveExecDetailBackHref(task?: ProcessTask | null): string {
  const searchParams = getExecDetailSearchParams()
  const returnTo = searchParams.get('returnTo')
  if (returnTo && (returnTo.startsWith('/fcs/pda/exec') || returnTo.startsWith('/fcs/pda/handover'))) {
    return returnTo
  }

  const sourceType = searchParams.get('sourceType') || ''
  const sourceId = searchParams.get('sourceId') || ''
  const sourceTask = sourceType && sourceId ? getMobileExecutionTaskBySource(sourceType, sourceId) : null
  if (sourceTask) {
    return buildMobileExecutionListLocatePathForTask(sourceTask, {
      currentFactoryId: searchParams.get('currentFactoryId') || undefined,
      keyword: searchParams.get('keyword') || undefined,
    })
  }

  if (task) {
    return buildMobileExecutionListLocatePathForTask(task, {
      currentFactoryId: searchParams.get('currentFactoryId') || undefined,
      keyword: searchParams.get('keyword') || undefined,
    })
  }

  return '/fcs/pda/exec'
}

function getExecDetailAccessNotice(access: ReturnType<typeof getMobileTaskAccessResult>): { title: string; lines: string[] } | null {
  if (access.canOpenMobileExecution) return null
  if (access.reasonLabel === '当前工厂无该特殊工艺加工权限') {
    return {
      title: '当前工厂无该特殊工艺加工权限',
      lines: [access.suggestedAction],
    }
  }
  if (access.reasonCode === 'TASK_FACTORY_MISMATCH') {
    return {
      title: '当前任务不属于当前工厂',
      lines: ['请切换到对应工厂账号后查看'],
    }
  }
  if (access.reasonCode === 'TASK_NOT_ACCEPTED') {
    return {
      title: '当前任务尚未接单，不能执行',
      lines: [access.suggestedAction],
    }
  }
  if (access.reasonCode === 'TASK_IN_BIDDING' || access.reasonCode === 'TASK_WAITING_AWARD') {
    return {
      title: '当前任务仍在报价或定标阶段，不能执行',
      lines: [access.suggestedAction],
    }
  }
  if (access.reasonCode === 'TASK_CLOSED') {
    return {
      title: '当前任务已关闭，不能执行',
      lines: [access.suggestedAction],
    }
  }
  return {
    title: '当前任务只允许只读查看',
    lines: [`原因：${access.reasonLabel}`, `建议：${access.suggestedAction}`],
  }
}

function shouldRenderCombinedDyeCurrentAction(order: DyeWorkOrder): boolean {
  const waterNode = getDyeExecutionNodeRecord(order.dyeOrderId, 'WATER_SOLUBLE')
  return order.requiresWaterSoluble && (
    order.status === 'WAIT_WATER_SOLUBLE'
    || order.status === 'WATER_SOLUBLE_IN_PROGRESS'
    || order.status === 'PRODUCTION_PAUSED'
    || order.status === 'DYEING'
    || (order.status === 'WAIT_VAT_PLAN' && Boolean(waterNode?.finishedAt))
  )
}

function getCombinedDyePrimaryAction(order: DyeWorkOrder): { action: string; label: string; role: WaterSolublePdaRoleAction; node: 'WATER_SOLUBLE' | 'DYE' } | null {
  if (order.status === 'WAIT_WATER_SOLUBLE') return { action: 'dye-water-start', label: '开始水溶', role: 'OPERATE', node: 'WATER_SOLUBLE' }
  if (order.status === 'WATER_SOLUBLE_IN_PROGRESS') return { action: 'dye-water-complete', label: '完成水溶', role: 'OPERATE', node: 'WATER_SOLUBLE' }
  if (order.status === 'PRODUCTION_PAUSED') return { action: 'dye-water-open-supervisor', label: '处理数量不足', role: 'SUPERVISE', node: 'WATER_SOLUBLE' }
  if (order.status === 'WAIT_VAT_PLAN' && getDyeExecutionNodeRecord(order.dyeOrderId, 'WATER_SOLUBLE')?.finishedAt) return { action: 'dye-water-start-dye', label: '开始染色', role: 'OPERATE', node: 'DYE' }
  if (order.status === 'DYEING') return { action: 'dye-complete-dye', label: '完成染色', role: 'OPERATE', node: 'DYE' }
  return null
}

function renderCombinedDyeWaterOverlay(): string {
  const overlay = detailState.dyeWaterOverlay
  if (!overlay || overlay.taskId !== detailState.activeTaskId) return ''
  const order = getDyeWorkOrderById(overlay.dyeOrderId)
  if (!order || order.taskId !== overlay.taskId) return ''
  const attrs = `data-skip-page-rerender="true" data-dye-order-id="${escapeHtml(order.dyeOrderId)}" data-task-id="${escapeHtml(order.taskId)}" data-expected-status="${escapeHtml(overlay.expectedStatus)}" data-expected-node="WATER_SOLUBLE" data-overlay-token="${escapeHtml(overlay.token)}"`
  if (overlay.type === 'supervisor') {
    const decisions: Array<[DyeWaterSolublePauseDecision, string]> = [['CONTINUE_PROCESSING', '继续补做'], ['CONTINUE_WITH_ACTUAL_QTY', '按实际数量继续'], ['RETURN_FOR_REWORK', '退回重做']]
    return `<div class="fixed inset-0 z-50 flex items-center justify-center"><div class="absolute inset-0 bg-black/45" data-pda-execd-action="dye-water-close-overlay"></div><div class="relative w-[420px] max-w-[90vw] rounded-lg bg-background p-5 shadow-lg"><h2 class="text-lg font-semibold">处理水溶数量不足</h2><p class="mt-1 text-sm text-muted-foreground">实际完成 ${order.waterSolubleCompletedQty ?? 0} ${escapeHtml(order.waterSolubleQtyUnit || order.qtyUnit)}</p><div class="mt-4 space-y-2">${decisions.map(([decision, label]) => `<button type="button" class="h-10 w-full rounded-md border px-3 text-sm font-medium hover:bg-muted" data-pda-execd-action="dye-water-resolve-pause" data-decision="${decision}" ${attrs}>${label}</button>`).join('')}</div><button type="button" class="mt-3 h-9 w-full text-sm text-muted-foreground" data-pda-execd-action="dye-water-close-overlay">取消</button></div></div>`
  }
  const draft = detailState.dyeWaterDraft
  const overage = overlay.type === 'completion-overage'
  let form = `<div class="mt-4 space-y-3"><label class="block text-sm">实际完成数量<input class="mt-1 h-10 w-full rounded-md border px-3" inputmode="decimal" data-pda-execd-field="dyeWaterOutputQty" value="${escapeHtml(draft.outputQty)}"></label><label class="block text-sm">数量不一致原因<textarea class="mt-1 min-h-20 w-full rounded-md border p-3" data-pda-execd-field="dyeWaterReason">${escapeHtml(draft.reason)}</textarea></label></div>`
  form = form.replace('<div ', '<div data-skip-page-rerender="true" ')
  return `<div class="fixed inset-0 z-50 flex items-center justify-center"><div class="absolute inset-0 bg-black/45" data-pda-execd-action="dye-water-close-overlay"></div><div class="relative w-[420px] max-w-[90vw] rounded-lg bg-background p-5 shadow-lg"><h2 class="text-lg font-semibold">${overage ? '确认超出计划数量' : '完成水溶'}</h2><p class="mt-1 text-sm text-muted-foreground">计划 ${order.waterSolublePlannedQty ?? order.plannedQty} ${escapeHtml(order.waterSolubleQtyUnit || order.qtyUnit)}</p>${overage ? '<p class="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">实际数量超过计划，请再次确认。</p>' : form}<div class="mt-5 flex gap-2"><button type="button" class="h-10 flex-1 rounded-md border" data-pda-execd-action="${overage ? 'dye-water-back-completion' : 'dye-water-close-overlay'}">取消</button><button type="button" class="h-10 flex-1 rounded-md bg-primary text-primary-foreground" data-pda-execd-action="dye-water-confirm-completion" ${attrs}>${overage ? '确认超量完成' : '确认完成'}</button></div></div></div>`
}

function renderCombinedDyeCurrentActionCard(task: TaskWithHandoverFields, order: DyeWorkOrder): string {
  const session = getPdaSession()
  const action = getCombinedDyePrimaryAction(order)
  const onlineStatus = getDyeWorkOrderOnlineRecord(order.dyeOrderId).status
  const onlineAllowed = onlineStatus !== '取消' && (
    action?.node !== 'DYE'
    || (action.action === 'dye-complete-dye'
      ? isDyeWorkOrderOnlineActionAllowed(order.dyeOrderId, '完工')
      : onlineStatus === '染色中' || isDyeWorkOrderOnlineActionAllowed(order.dyeOrderId, '开工'))
  )
  const actorAllowed = Boolean(action && onlineAllowed && session && !validateWaterSolublePdaActor(session, order.dyeFactoryId, action.role))
  const token = action?.action === 'dye-complete-dye'
    ? `${order.dyeOrderId}:COMPLETE_DYE:${++dyeCompletionActionSequence}`
    : `${order.dyeOrderId}:${order.status}:${order.updatedAt}`
  dyeWaterPrimaryActionTokens.set(order.dyeOrderId, token)
  const waterNode = getDyeExecutionNodeRecord(order.dyeOrderId, 'WATER_SOLUBLE')
  const records = listDyeExecutionNodeRecords(order.dyeOrderId)
  const stepLabel = order.status === 'WAIT_VAT_PLAN' && waterNode?.finishedAt ? '待染色' : getDyeWorkOrderStatusLabel(order.status)
  let primary = action && actorAllowed
    ? `<button type="button" class="min-h-11 w-full rounded-lg bg-primary px-4 py-3 text-base font-semibold text-primary-foreground disabled:opacity-60" data-pda-execd-action="${action.action}" data-combined-primary-action="true" data-dye-order-id="${escapeHtml(order.dyeOrderId)}" data-task-id="${escapeHtml(task.taskId)}" data-expected-status="${escapeHtml(order.status)}" data-expected-node="${action.node}" data-action-token="${escapeHtml(token)}">${escapeHtml(action.label)}</button>`
    : `<div class="text-sm text-blue-800">${order.status === 'PRODUCTION_PAUSED' ? '等待生产主管处理数量不足。' : '当前账号不能执行此动作。'}</div>`
  primary = primary.replace('<button ', '<button data-skip-page-rerender="true" ')
  const actionHint = onlineStatus === '取消' ? '加工单已取消，请联系主管。' : action?.label || '等待主管处理'
  return `<article class="rounded-lg border bg-card" data-testid="pda-combined-dye-current-action"><header class="border-b px-4 py-3"><div class="flex items-center justify-between gap-2"><h2 class="text-sm font-semibold">染色加工（含水溶）</h2>${renderPrintingStatusBadge(onlineStatus, onlineStatus === '取消' ? 'danger' : 'info')}</div></header><div class="space-y-4 p-4"><div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs"><span class="text-muted-foreground">当前物料</span><span class="font-medium">${escapeHtml(order.rawMaterialSku)}</span><span class="text-muted-foreground">计划数量</span><span>${order.waterSolublePlannedQty ?? order.plannedQty} ${escapeHtml(order.waterSolubleQtyUnit || order.qtyUnit)}</span><span class="text-muted-foreground">水溶完成</span><span>${order.waterSolubleCompletedQty ?? 0} ${escapeHtml(order.waterSolubleQtyUnit || order.qtyUnit)}</span><span class="text-muted-foreground">当前状态</span><span class="font-medium">${escapeHtml(onlineStatus)}</span><span class="text-muted-foreground">当前步骤</span><span class="font-medium">${escapeHtml(stepLabel)}</span></div><section class="rounded-lg border border-blue-200 bg-blue-50 p-4"><p class="mb-3 text-xs font-medium text-blue-800">现在要做：${escapeHtml(actionHint)}</p>${primary}</section><details class="rounded-lg border bg-background"><summary class="cursor-pointer px-4 py-3 text-sm font-medium">完整执行记录（${records.length} 条）</summary><div class="space-y-2 border-t p-4">${records.map((record) => `<div class="text-xs"><span class="font-medium">${escapeHtml(record.nodeName)}</span><span class="ml-2 text-muted-foreground">${escapeHtml(record.finishedAt ? '已完成' : record.startedAt ? '进行中' : '待开始')}</span></div>`).join('') || '<div class="text-xs text-muted-foreground">暂无执行记录</div>'}</div></details></div><div data-testid="pda-combined-dye-overlay">${renderCombinedDyeWaterOverlay()}</div></article>`
}

function refreshCombinedDyeCurrentAction(dyeOrderId: string): void {
  if (typeof document === 'undefined') return
  const order = getDyeWorkOrderById(dyeOrderId)
  const task = order ? getTaskFactById(order.taskId) : null
  const node = document.querySelector<HTMLElement>('[data-testid="pda-combined-dye-current-action"]')
  if (!node) return
  if (order && task && shouldRenderCombinedDyeCurrentAction(order)) {
    node.outerHTML = renderCombinedDyeCurrentActionCard(task as TaskWithHandoverFields, order)
    return
  }
  node.remove()
}

function refreshCombinedDyeOverlay(): void {
  if (typeof document === 'undefined') return
  const node = document.querySelector<HTMLElement>('[data-testid="pda-combined-dye-overlay"]')
  if (node) node.innerHTML = renderCombinedDyeWaterOverlay()
}

function refreshDyeingTaskCard(dyeOrderId: string): void {
  if (typeof document === 'undefined') return
  const order = getDyeWorkOrderById(dyeOrderId)
  const task = order ? getTaskFactById(order.taskId) as TaskWithHandoverFields | null : null
  const node = document.querySelector<HTMLElement>('[data-testid="pda-dyeing-task-card"]')
  if (!order || !task || !node) return
  node.outerHTML = renderDyeingTaskCard(task, order, getTaskHandoverOrder(task))
}

function renderDyeingTaskCard(
  task: TaskWithHandoverFields,
  dyeOrder: DyeWorkOrder,
  handoverOrder: PdaHandoverHead | null,
): string {
  if (shouldRenderCombinedDyeCurrentAction(dyeOrder)) return renderCombinedDyeCurrentActionCard(task, dyeOrder)
  const sampleNode = getDyeExecutionNodeRecord(dyeOrder.dyeOrderId, 'SAMPLE')
  const materialReadyNode = getDyeExecutionNodeRecord(dyeOrder.dyeOrderId, 'MATERIAL_READY')
  const vatPlanNode = getDyeExecutionNodeRecord(dyeOrder.dyeOrderId, 'VAT_PLAN')
  const dyeNode = getDyeExecutionNodeRecord(dyeOrder.dyeOrderId, 'DYE')
  const dehydrateNode = getDyeExecutionNodeRecord(dyeOrder.dyeOrderId, 'DEHYDRATE')
  const dryNode = getDyeExecutionNodeRecord(dyeOrder.dyeOrderId, 'DRY')
  const setNode = getDyeExecutionNodeRecord(dyeOrder.dyeOrderId, 'SET')
  const rollNode = getDyeExecutionNodeRecord(dyeOrder.dyeOrderId, 'ROLL')
  const packNode = getDyeExecutionNodeRecord(dyeOrder.dyeOrderId, 'PACK')
  const review = getDyeReviewRecordByOrderId(dyeOrder.dyeOrderId)
  const handoverSummary = getDyeOrderHandoverSummary(dyeOrder.dyeOrderId)
  const vatOptions = listDyeVatOptions(dyeOrder.dyeFactoryId)
  const selectedVat = vatOptions.find((item) => item.dyeVatNo === (dyeNode?.dyeVatNo || vatPlanNode?.dyeVatNo))
  const canOperate = canOperateDyeingNode(task, dyeOrder.dyeOrderId)
  const sampleReady = !dyeOrder.isFirstOrder || Boolean(dyeOrder.sampleWaitFinishedAt) || dyeOrder.sampleWaitType === 'NONE'
  const canPlanVat = Boolean(materialReadyNode?.finishedAt) && (dyeOrder.sampleStatus === 'DONE' || dyeOrder.sampleStatus === 'NOT_REQUIRED')
  const onlineStatus = getDyeWorkOrderOnlineRecord(dyeOrder.dyeOrderId).status
  const canStartDye = onlineStatus === '染色中' || isDyeWorkOrderOnlineActionAllowed(dyeOrder.dyeOrderId, '开工')
  const canCompleteDye = isDyeWorkOrderOnlineActionAllowed(dyeOrder.dyeOrderId, '完工')
  const canContinuePostProcess = onlineStatus === '染色中' || onlineStatus === '染色完成'
  const canSubmitHandover = isDyeWorkOrderOnlineActionAllowed(dyeOrder.dyeOrderId, '交出')

  const sampleWaitBadge = dyeOrder.sampleWaitFinishedAt
    ? renderPrintingStatusBadge('等样衣/色样完成', 'success')
    : dyeOrder.sampleWaitStartedAt
      ? renderPrintingStatusBadge('等样衣/色样', 'warning')
      : renderPrintingStatusBadge('等样衣/色样', 'muted')
  const materialWaitBadge = dyeOrder.materialWaitFinishedAt
    ? renderPrintingStatusBadge('等原料完成', 'success')
    : dyeOrder.materialWaitStartedAt
      ? renderPrintingStatusBadge('等原料', 'warning')
      : renderPrintingStatusBadge('等原料', 'muted')
  const sampleTestBadge = sampleNode?.finishedAt
    ? renderPrintingStatusBadge('打样完成', 'success')
    : sampleNode?.startedAt
      ? renderPrintingStatusBadge('打样中', 'info')
      : renderPrintingStatusBadge('待打样', 'muted')
  const materialReadyBadge = materialReadyNode?.finishedAt
    ? renderPrintingStatusBadge('备料完成', 'success')
    : materialReadyNode?.startedAt
      ? renderPrintingStatusBadge('备料中', 'info')
      : renderPrintingStatusBadge('待备料', 'muted')
  const vatBadge = vatPlanNode?.finishedAt
    ? renderPrintingStatusBadge('已排染缸', 'success')
    : renderPrintingStatusBadge('待排染缸', 'warning')
  const dyeBadge = dyeNode?.finishedAt
    ? renderPrintingStatusBadge('染色完成', 'success')
    : dyeNode?.startedAt
      ? renderPrintingStatusBadge('染色中', 'info')
      : renderPrintingStatusBadge('待染色', 'muted')
  const handoverBadge =
    dyeOrder.status === 'WAIT_HANDOVER'
      ? renderPrintingStatusBadge('待送货', 'warning')
      : renderPrintingStatusBadge(getReceiptStatusMeta(dyeOrder.status).label, getReceiptStatusMeta(dyeOrder.status).tone)
  const reviewMeta = getReceiptStatusMeta(review?.reviewStatus)
  const reviewBadge = renderPrintingStatusBadge(reviewMeta.label, reviewMeta.tone)

  const postProcessRows = [
    { label: '脱水', code: 'DEHYDRATE' as const, record: dehydrateNode, requireFinished: Boolean(dyeNode?.finishedAt) },
    { label: '烘干', code: 'DRY' as const, record: dryNode, requireFinished: Boolean(dehydrateNode?.finishedAt) },
    { label: '定型', code: 'SET' as const, record: setNode, requireFinished: Boolean(dryNode?.finishedAt) },
    { label: '打卷', code: 'ROLL' as const, record: rollNode, requireFinished: Boolean(setNode?.finishedAt) },
    { label: '包装', code: 'PACK' as const, record: packNode, requireFinished: Boolean(rollNode?.finishedAt) },
  ]

  return `
    <article class="rounded-lg border bg-card" data-testid="pda-dyeing-task-card" data-skip-page-rerender="true">
      <header class="border-b px-4 py-3">
        <div class="flex items-center justify-between gap-2">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <i data-lucide="droplets" class="h-4 w-4"></i>
            染色任务
          </h2>
          ${renderPrintingStatusBadge(onlineStatus, onlineStatus === '已完成' ? 'success' : onlineStatus === '取消' ? 'danger' : onlineStatus === '待审核' || onlineStatus === '部分入库' ? 'warning' : 'info')}
        </div>
      </header>

      <div class="space-y-4 p-4 text-sm">
        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
          <span class="text-xs text-muted-foreground">染色加工单</span>
          <span class="text-xs font-medium">${renderPdaObjectCode({
            objectType: 'DYE_WORK_ORDER',
            objectId: dyeOrder.dyeOrderNo,
            relatedProductionOrderNo: dyeOrder.sourceProductionOrderNo || dyeOrder.sourceProductionOrderId || task.productionOrderId,
          })}</span>
          <span class="text-xs text-muted-foreground">当前状态</span>
          <span class="text-xs" data-testid="pda-dye-online-status">${escapeHtml(onlineStatus)}</span>
          <span class="text-xs text-muted-foreground">目标颜色</span>
          <span class="text-xs">${escapeHtml(dyeOrder.targetColor)}</span>
          <span class="text-xs text-muted-foreground">色号</span>
          <span class="text-xs">${escapeHtml(dyeOrder.colorNo || '待确认')}</span>
          <span class="text-xs text-muted-foreground">接收方</span>
          <span class="text-xs">${escapeHtml(dyeOrder.targetTransferWarehouseName)}</span>
          <span class="text-xs text-muted-foreground">染缸候选</span>
          <span class="text-xs">${vatOptions.length > 0 ? escapeHtml(vatOptions.map((item) => item.dyeVatNo).join(' / ')) : '未配置'}</span>
        </div>

        <div class="grid gap-3 xl:grid-cols-2">
          <section class="rounded-lg border bg-background p-3">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium">等样衣/色样</h3>
              ${sampleWaitBadge}
            </div>
            <div class="mt-3 space-y-1 text-xs">
              <div><span class="text-muted-foreground">等待类型：</span>${escapeHtml(getSampleWaitTypeLabel(dyeOrder.sampleWaitType))}</div>
              <div><span class="text-muted-foreground">开始时间：</span>${escapeHtml(dyeOrder.sampleWaitStartedAt || '—')}</div>
              <div><span class="text-muted-foreground">完成时间：</span>${escapeHtml(dyeOrder.sampleWaitFinishedAt || '—')}</div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="dye-start-sample-wait"
                data-dye-order-id="${escapeHtml(dyeOrder.dyeOrderId)}"
                ${!canOperate || Boolean(dyeOrder.sampleWaitStartedAt) ? 'disabled' : ''}
              >
                开始等样衣
              </button>
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="dye-complete-sample-wait"
                data-dye-order-id="${escapeHtml(dyeOrder.dyeOrderId)}"
                ${!canOperate || !dyeOrder.sampleWaitStartedAt || Boolean(dyeOrder.sampleWaitFinishedAt) ? 'disabled' : ''}
              >
                确认样衣到位
              </button>
            </div>
          </section>

          <section class="rounded-lg border bg-background p-3">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium">等原料</h3>
              ${materialWaitBadge}
            </div>
            <div class="mt-3 space-y-1 text-xs">
              <div><span class="text-muted-foreground">原料面料：</span>${escapeHtml(dyeOrder.rawMaterialSku)}</div>
              <div><span class="text-muted-foreground">开始时间：</span>${escapeHtml(dyeOrder.materialWaitStartedAt || '—')}</div>
              <div><span class="text-muted-foreground">完成时间：</span>${escapeHtml(dyeOrder.materialWaitFinishedAt || '—')}</div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="dye-start-material-wait"
                data-dye-order-id="${escapeHtml(dyeOrder.dyeOrderId)}"
                ${!canOperate || Boolean(dyeOrder.materialWaitStartedAt) ? 'disabled' : ''}
              >
                开始等原料
              </button>
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="dye-complete-material-wait"
                data-dye-order-id="${escapeHtml(dyeOrder.dyeOrderId)}"
                ${!canOperate || !dyeOrder.materialWaitStartedAt || Boolean(dyeOrder.materialWaitFinishedAt) ? 'disabled' : ''}
              >
                确认原料到位
              </button>
            </div>
          </section>

          <section class="rounded-lg border bg-background p-3">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium">打样</h3>
              ${sampleTestBadge}
            </div>
            <div class="mt-3 space-y-1 text-xs">
              <div><span class="text-muted-foreground">开始时间：</span>${escapeHtml(sampleNode?.startedAt || '—')}</div>
              <div><span class="text-muted-foreground">完成时间：</span>${escapeHtml(sampleNode?.finishedAt || '—')}</div>
              <div><span class="text-muted-foreground">色号：</span>${escapeHtml(dyeOrder.colorNo || '待确认')}</div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="dye-start-sample-test"
                data-dye-order-id="${escapeHtml(dyeOrder.dyeOrderId)}"
                ${!canOperate || !sampleReady || Boolean(sampleNode?.startedAt) ? 'disabled' : ''}
              >
                开始打样
              </button>
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="dye-complete-sample-test"
                data-dye-order-id="${escapeHtml(dyeOrder.dyeOrderId)}"
                ${!canOperate || !sampleNode?.startedAt || Boolean(sampleNode?.finishedAt) ? 'disabled' : ''}
              >
                完成打样
              </button>
            </div>
          </section>

          <section class="rounded-lg border bg-background p-3">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium">备料</h3>
              ${materialReadyBadge}
            </div>
            <div class="mt-3 space-y-1 text-xs">
              <div><span class="text-muted-foreground">开始时间：</span>${escapeHtml(materialReadyNode?.startedAt || '—')}</div>
              <div><span class="text-muted-foreground">完成时间：</span>${escapeHtml(materialReadyNode?.finishedAt || '—')}</div>
              <div><span class="text-muted-foreground">备料面料米数：</span>${materialReadyNode?.outputQty ?? 0} ${escapeHtml(getQtyUnitLabel(dyeOrder.qtyUnit))}</div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="dye-start-material-ready"
                data-dye-order-id="${escapeHtml(dyeOrder.dyeOrderId)}"
                ${!canOperate || !dyeOrder.materialWaitFinishedAt || Boolean(materialReadyNode?.startedAt) ? 'disabled' : ''}
              >
                开始备料
              </button>
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="dye-complete-material-ready"
                data-dye-order-id="${escapeHtml(dyeOrder.dyeOrderId)}"
                ${!canOperate || !materialReadyNode?.startedAt || Boolean(materialReadyNode?.finishedAt) ? 'disabled' : ''}
              >
                完成备料
              </button>
            </div>
          </section>

          <section class="rounded-lg border bg-background p-3">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium">待排染缸</h3>
              ${vatBadge}
            </div>
            <div class="mt-3 space-y-1 text-xs">
              <div><span class="text-muted-foreground">染缸编号：</span>${escapeHtml(vatPlanNode?.dyeVatNo || '未选择')}</div>
              <div><span class="text-muted-foreground">染缸容量：</span>${selectedVat ? `${selectedVat.capacityQty} ${escapeHtml(selectedVat.capacityUnit)}` : '—'}</div>
              <div><span class="text-muted-foreground">可染类型：</span>${selectedVat ? escapeHtml(selectedVat.supportedMaterialTypes.join(' / ')) : '—'}</div>
            </div>
            <div class="mt-3">
              <button
                class="inline-flex h-8 w-full items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="dye-plan-vat"
                data-dye-order-id="${escapeHtml(dyeOrder.dyeOrderId)}"
                ${!canOperate || !canPlanVat ? 'disabled' : ''}
              >
                排染缸
              </button>
            </div>
          </section>

          <section class="rounded-lg border bg-background p-3">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium">染色</h3>
              ${dyeBadge}
            </div>
            <div class="mt-3 space-y-1 text-xs">
              <div><span class="text-muted-foreground">染缸编号：</span>${escapeHtml(dyeNode?.dyeVatNo || vatPlanNode?.dyeVatNo || '未选择')}</div>
              <div><span class="text-muted-foreground">开始时间：</span>${escapeHtml(dyeNode?.startedAt || '—')}</div>
              <div><span class="text-muted-foreground">完成时间：</span>${escapeHtml(dyeNode?.finishedAt || '—')}</div>
              <div><span class="text-muted-foreground">投入面料米数：</span>${dyeNode?.inputQty ?? 0} ${escapeHtml(getQtyUnitLabel(dyeOrder.qtyUnit))}</div>
              <div><span class="text-muted-foreground">染色完成面料米数：</span>${dyeNode?.outputQty ?? 0} ${escapeHtml(getQtyUnitLabel(dyeOrder.qtyUnit))}</div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="dye-start-dye"
                data-dye-order-id="${escapeHtml(dyeOrder.dyeOrderId)}"
                ${!canOperate || !canPlanVat || !canStartDye || Boolean(dyeNode?.startedAt) ? 'disabled' : ''}
              >
                开始染色
              </button>
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="dye-complete-dye"
                data-dye-order-id="${escapeHtml(dyeOrder.dyeOrderId)}"
                ${!canOperate || !canCompleteDye || !dyeNode?.startedAt || Boolean(dyeNode?.finishedAt) ? 'disabled' : ''}
              >
                完成染色
              </button>
            </div>
          </section>

          <section class="rounded-lg border bg-background p-3 xl:col-span-2">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium">后处理</h3>
              ${renderPrintingStatusBadge(packNode?.finishedAt ? '包装完成' : dyeOrder.status === 'WAIT_HANDOVER' || dyeOrder.status === 'HANDOVER_WAIT_RECEIVE' ? '待送货' : '按节点推进', packNode?.finishedAt ? 'success' : 'info')}
            </div>
            <div class="mt-3 space-y-2">
              ${postProcessRows
                .map(
                  ({ label, code, record, requireFinished }) => `
                    <div class="grid grid-cols-[88px_1fr_150px] items-center gap-2 rounded-md border px-3 py-2 text-xs">
                      <div class="font-medium">${escapeHtml(label)}</div>
                      <div class="space-y-1">
                        <div>开始：${escapeHtml(record?.startedAt || '—')}</div>
                        <div>完成：${escapeHtml(record?.finishedAt || '—')}</div>
                      </div>
                      <div class="grid grid-cols-2 gap-2">
                        <button
                          class="inline-flex h-7 items-center justify-center rounded-md border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                          data-pda-execd-action="dye-start-node"
                          data-dye-order-id="${escapeHtml(dyeOrder.dyeOrderId)}"
                          data-node-code="${escapeHtml(code)}"
                          ${!canOperate || !canContinuePostProcess || !requireFinished || Boolean(record?.startedAt) ? 'disabled' : ''}
                        >
                          ${escapeHtml(`开始${label}`)}
                        </button>
                        <button
                          class="inline-flex h-7 items-center justify-center rounded-md border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                          data-pda-execd-action="dye-complete-node"
                          data-dye-order-id="${escapeHtml(dyeOrder.dyeOrderId)}"
                          data-node-code="${escapeHtml(code)}"
                          ${!canOperate || !canContinuePostProcess || !record?.startedAt || Boolean(record?.finishedAt) ? 'disabled' : ''}
                        >
                          ${escapeHtml(`完成${label}`)}
                        </button>
                      </div>
                    </div>
                  `,
                )
                .join('')}
            </div>
          </section>

          <section class="rounded-lg border bg-background p-3">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium">待送货</h3>
              ${handoverBadge}
            </div>
            <div class="mt-3 space-y-1 text-xs">
              <div><span class="text-muted-foreground">交出单：</span>${
                handoverOrder || dyeOrder.handoverOrderNo || dyeOrder.handoverOrderId
                  ? renderPdaObjectCode({
                      objectType: 'HANDOVER_ORDER',
                      objectId: handoverOrder?.handoverOrderNo || dyeOrder.handoverOrderNo || dyeOrder.handoverOrderId,
                      relatedProductionOrderNo: handoverOrder?.productionOrderNo || dyeOrder.sourceProductionOrderNo || dyeOrder.sourceProductionOrderId || task.productionOrderId,
                    })
                  : '未生成'
              }</div>
              <div><span class="text-muted-foreground">交出记录：</span>${handoverSummary.recordCount} 条</div>
              <div><span class="text-muted-foreground">待收货：</span>${handoverSummary.pendingWritebackCount} 条</div>
              <div><span class="text-muted-foreground">实收染色面料米数：</span>${handoverSummary.writtenBackQty} ${escapeHtml(getQtyUnitLabel(dyeOrder.qtyUnit))}</div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="view-handover-order"
                data-handover-order-id="${escapeHtml(handoverOrder?.handoverOrderId || handoverOrder?.handoverId || '')}"
                ${!handoverOrder ? 'disabled' : ''}
              >
                查看交出单
              </button>
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="dye-submit-handover"
                data-task-id="${escapeHtml(dyeOrder.taskId)}"
                ${!canSubmitHandover || !handoverOrder || (dyeOrder.status !== 'WAIT_HANDOVER' && dyeOrder.status !== 'HANDOVER_WAIT_RECEIVE') ? 'disabled' : ''}
              >
                发起交出
              </button>
            </div>
          </section>

          <section class="rounded-lg border bg-background p-3">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium">收货确认</h3>
              ${reviewBadge}
            </div>
            <div class="mt-3 space-y-1 text-xs">
              <div><span class="text-muted-foreground">接收方：</span>${escapeHtml(dyeOrder.targetTransferWarehouseName)}</div>
              <div><span class="text-muted-foreground">实收染色面料米数：</span>${review?.receivedQty ?? handoverSummary.writtenBackQty} ${escapeHtml(getQtyUnitLabel(dyeOrder.qtyUnit))}</div>
              <div><span class="text-muted-foreground">差异面料米数：</span>${review?.diffQty ?? handoverSummary.diffQty} ${escapeHtml(getQtyUnitLabel(dyeOrder.qtyUnit))}</div>
              <div><span class="text-muted-foreground">收货状态：</span>${escapeHtml(reviewMeta.label)}</div>
              <div><span class="text-muted-foreground">备注：</span>${escapeHtml(review?.remark || '仓库确认收货后更新状态')}</div>
            </div>
          </section>
        </div>
      </div>
    </article>
  `
}


function resolveTaskQtyDisplayMeta(task: ProcessTask, displayProcessName = getTaskProcessDisplayName(task)): { label: string; valueText: string } {
  const printOrder = getPrintWorkOrderByTaskId(task.taskId)
  if (printOrder) {
    const context = {
      processType: 'PRINT',
      sourceType: 'PRINT_WORK_ORDER',
      sourceId: printOrder.printOrderId,
      objectType: printOrder.objectType,
      qtyUnit: printOrder.qtyUnit,
      qtyPurpose: '计划' as const,
      isPiecePrinting: printOrder.isPiecePrinting,
      isFabricPrinting: printOrder.isFabricPrinting,
    }
    const label = getQuantityLabel(context)
    return {
      label,
      valueText: `${label}：${formatProcessQuantityWithUnit(printOrder.plannedQty, context)}`,
    }
  }

  const woolOrder = getWoolWorkOrderByTaskId(task.taskId)
  if (woolOrder) {
    const isPartPanel = woolOrder.kind === 'PART_PANEL'
    const label = isPartPanel ? '本单毛织部位片数（片）' : '本单毛织整件数（件）'
    const plannedQty = woolOrder.outputPlanLines.reduce((sum, line) => sum + line.plannedQty, 0)
    const qtyUnit = woolOrder.outputPlanLines[0]?.qtyUnit || (isPartPanel ? '片' : '件')
    return {
      label,
      valueText: `${label}：${plannedQty} ${qtyUnit}`,
    }
  }

  const dyeOrder = getDyeWorkOrderByTaskId(task.taskId)
  if (dyeOrder) {
    const context = {
      processType: 'DYE',
      sourceType: 'DYE_WORK_ORDER',
      sourceId: dyeOrder.dyeOrderId,
      objectType: '面料',
      qtyUnit: dyeOrder.qtyUnit,
      qtyPurpose: '计划' as const,
    }
    const label = getQuantityLabel(context)
    return {
      label,
      valueText: `${label}：${formatProcessQuantityWithUnit(dyeOrder.plannedQty, context)}`,
    }
  }

  const unitLabel = getProcessTaskQtyDisplayUnit(task)
  if (task.qtyDisplayUnit?.trim()) {
    return getProcessTaskQtyDisplayMeta(task)
  }
  if (unitLabel === '卷') {
    return {
      label: '本单布卷数（卷）',
      valueText: `本单布卷数：${task.qty} 卷`,
    }
  }
  if (unitLabel === '层') {
    return {
      label: '本单铺布层数（层）',
      valueText: `本单铺布层数：${task.qty} 层`,
    }
  }

  const shouldUsePieceSemantics =
    unitLabel === '片'
    || (unitLabel === '件' && (isCuttingSpecialTask(task) || /裁片|入仓|交接/.test(displayProcessName)))

  if (shouldUsePieceSemantics) {
    return {
      label: '本单裁片片数（片）',
      valueText: `本单裁片片数：${task.qty} 片`,
    }
  }

  return {
    label: '本单成衣件数（件）',
    valueText: `本单成衣件数：${task.qty} 件`,
  }
}

function getReportedQtyLabel(unitLabel: string | undefined): string {
  if (unitLabel === '卷') return '上报布卷数（卷）'
  if (unitLabel === '层') return '上报铺布层数（层）'
  if (unitLabel === '片') return '上报毛织片数（片）'
  return '上报成衣件数（件）'
}

function getMilestoneDisplayUnitLabel(task: ProcessTask, fallback: string): string {
  const woolOrder = getWoolWorkOrderByTaskId(task.taskId)
  if (woolOrder?.kind === 'PART_PANEL') return '片'
  if (woolOrder?.kind === 'WHOLE_GARMENT') return '件'
  return fallback
}

const MOCK_START_PROOF: Record<string, StartProofFile[]> = {
  'PDA-EXEC-007': [
    { id: 'sp-001', type: 'IMAGE', name: '开工现场_01.jpg', uploadedAt: '2026-03-10 08:05:22' },
    { id: 'sp-002', type: 'IMAGE', name: '物料到位_01.jpg', uploadedAt: '2026-03-10 08:06:10' },
  ],
  'PDA-EXEC-008': [
    { id: 'sp-003', type: 'IMAGE', name: '车缝开工现场.jpg', uploadedAt: '2026-03-09 14:11:00' },
    { id: 'sp-004', type: 'VIDEO', name: '设备状态检查.mp4', uploadedAt: '2026-03-09 14:12:30' },
  ],
  'PDA-EXEC-009': [
    { id: 'sp-005', type: 'IMAGE', name: '烫包区就位.jpg', uploadedAt: '2026-03-08 09:06:00' },
  ],
  'PDA-EXEC-010': [],
}

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  if (query !== undefined) return query
  return typeof window === 'undefined' ? '' : window.location.search.replace(/^\?/, '')
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

function getCurrentPathWithoutSearch(): string {
  const pathname = appStore.getState().pathname || (typeof window === 'undefined' ? '' : window.location.pathname)
  return pathname.split('?')[0] || '/fcs/pda/exec'
}

function navigateExecDetailAction(action: string): void {
  const params = getCurrentSearchParams()
  params.set('action', action)
  appStore.navigate(`${getCurrentPathWithoutSearch()}?${params.toString()}`)
}

function clearExecDetailAction(): void {
  const params = getCurrentSearchParams()
  params.delete('action')
  const query = params.toString()
  appStore.navigate(query ? `${getCurrentPathWithoutSearch()}?${query}` : getCurrentPathWithoutSearch())
}

function toInputDateTime(value: string | undefined): string {
  if (!value) return ''
  return value.replace(' ', 'T').slice(0, 16)
}

function toStoreDateTime(value: string): string {
  if (!value) return ''
  const normalized = value.replace('T', ' ')
  return normalized.length === 16 ? `${normalized}:00` : normalized
}

function syncDialogStateWithQuery(task: ProcessTask): void {
  const taskId = task.taskId
  const pathname = appStore.getState().pathname
  const key = `${taskId}|${pathname}`

  if (detailState.initializedPathKey === key) return
  detailState.initializedPathKey = key

  const action = getCurrentSearchParams().get('action')
  detailState.fromPauseAction = action === 'pause'

  if (detailState.proofTaskId !== taskId) {
    const taskWithStart = task as ProcessTask & {
      startProofFiles?: StartProofFile[]
      startHeadcount?: number
    }

    detailState.proofTaskId = taskId
    detailState.startProofFiles = taskWithStart.startProofFiles
      ? [...taskWithStart.startProofFiles]
      : [...(MOCK_START_PROOF[taskId] || [])]
    detailState.milestoneProofFiles = task.milestoneProofFiles ? [...task.milestoneProofFiles] : []
    detailState.pauseProofFiles = task.pauseProofFiles ? [...task.pauseProofFiles] : []
    detailState.startTime = toInputDateTime(task.startedAt) || toInputDateTime(nowTimestamp())
    detailState.startHeadcount = taskWithStart.startHeadcount ? String(taskWithStart.startHeadcount) : ''
    detailState.milestoneTime = toInputDateTime(task.milestoneReportedAt || nowTimestamp())
    detailState.pauseReasonCode = task.pauseReasonCode || 'CUTTING_ISSUE'
    detailState.pauseRemark = task.pauseRemark || ''
    detailState.pauseTime = toInputDateTime(task.pauseReportedAt || nowTimestamp())
  }
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function parseDateMs(value: string): number {
  return new Date(value.replace(' ', 'T')).getTime()
}

function blockReasonLabel(reason: string | undefined): string {
  if (!reason) return '未知原因'
  const map: Record<string, string> = {
    MATERIAL: '物料',
    CAPACITY: '产能/排期',
    QUALITY: '质量处理',
    TECH: '工艺/技术资料',
    EQUIPMENT: '设备',
    OTHER: '其他',
    ALLOCATION_GATE: '分配开始条件',
  }
  return map[reason] ?? reason
}

function getDeadlineStatus(taskDeadline?: string, finishedAt?: string): { label: string; badgeClass: string } | null {
  if (!taskDeadline || finishedAt) return null
  const diff = parseDateMs(taskDeadline) - Date.now()

  if (diff < 0) {
    return { label: '执行逾期', badgeClass: 'bg-red-100 text-red-700' }
  }

  if (diff < 24 * 3600 * 1000) {
    return { label: '即将逾期', badgeClass: 'bg-amber-100 text-amber-700' }
  }

  return { label: '正常', badgeClass: 'bg-green-100 text-green-700' }
}

function showPdaExecDetailToast(message: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'pda-exec-detail-toast-root'
  let root = document.getElementById(rootId)

  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-6 top-20 z-[130] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }

  const toast = document.createElement('div')
  toast.className =
    'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200'
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

function rejectOfflinePdaMutation(retryFocusSelector?: string): boolean {
  if (typeof navigator === 'undefined' || navigator.onLine !== false) return false
  showPdaExecDetailToast('网络不可用，当前填写内容已保留，请恢复网络后重试。')
  if (retryFocusSelector && typeof document !== 'undefined') {
    document.querySelector<HTMLElement>(retryFocusSelector)?.focus()
  }
  return true
}

function nowDisplayTimestamp(date: Date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

function addProofFile(scope: 'start' | 'milestone' | 'pause', type: 'IMAGE' | 'VIDEO'): void {
  const ext = type === 'IMAGE' ? 'jpg' : 'mp4'
  const label = type === 'IMAGE' ? '图片' : '视频'
  const scopeTitle = scope === 'start' ? '开工' : scope === 'milestone' ? '关键节点' : '暂停上报'
  const currentFiles =
    scope === 'start'
      ? detailState.startProofFiles
      : scope === 'milestone'
        ? detailState.milestoneProofFiles
        : detailState.pauseProofFiles
  const index = currentFiles.length + 1
  const next = [
    ...currentFiles,
    {
      id: `${scope}-proof-${Date.now()}`,
      type,
      name: `${scopeTitle}${label}_${String(index).padStart(2, '0')}.${ext}`,
      uploadedAt: nowDisplayTimestamp(),
    },
  ]

  if (scope === 'start') detailState.startProofFiles = next
  else if (scope === 'milestone') detailState.milestoneProofFiles = next
  else detailState.pauseProofFiles = next
}

function removeProofFile(scope: 'start' | 'milestone' | 'pause', id: string): void {
  const next =
    scope === 'start'
      ? detailState.startProofFiles.filter((item) => item.id !== id)
      : scope === 'milestone'
        ? detailState.milestoneProofFiles.filter((item) => item.id !== id)
        : detailState.pauseProofFiles.filter((item) => item.id !== id)
  if (scope === 'start') detailState.startProofFiles = next
  else if (scope === 'milestone') detailState.milestoneProofFiles = next
  else detailState.pauseProofFiles = next
}

function isProofRequirementSatisfied(requirement: string, proofFiles: Array<StartProofFile | ExecProofFile>): boolean {
  if (requirement === 'NONE') return true
  if (requirement === 'IMAGE') return proofFiles.some((file) => file.type === 'IMAGE')
  if (requirement === 'VIDEO') return proofFiles.some((file) => file.type === 'VIDEO')
  return proofFiles.some((file) => file.type === 'IMAGE' || file.type === 'VIDEO')
}

function renderProofUploadSection(
  files: StartProofFile[],
  scope: 'start' | 'milestone' | 'pause',
  helperText: string,
): string {
  return `
    <div class="space-y-3">
      <p class="text-xs leading-relaxed text-muted-foreground">${escapeHtml(helperText)}</p>
      <div class="flex gap-2">
        <button
          type="button"
          class="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed text-xs hover:bg-muted"
          data-pda-execd-action="add-proof-image"
          data-proof-scope="${scope}"
        >
          <i data-lucide="image" class="h-3.5 w-3.5 text-blue-500"></i>
          上传图片
        </button>
        <button
          type="button"
          class="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed text-xs hover:bg-muted"
          data-pda-execd-action="add-proof-video"
          data-proof-scope="${scope}"
        >
          <i data-lucide="video" class="h-3.5 w-3.5 text-purple-500"></i>
          上传视频
        </button>
      </div>
      ${
        files.length > 0
          ? `
              <div class="space-y-1.5">
                <p class="text-xs font-medium text-muted-foreground">已上传材料（${files.length} 个文件）</p>
                ${files
                  .map(
                    (file) => `
                      <div class="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                        <i data-lucide="${file.type === 'IMAGE' ? 'image' : 'video'}" class="h-4 w-4 shrink-0 ${file.type === 'IMAGE' ? 'text-blue-500' : 'text-purple-500'}"></i>
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-xs font-medium">${escapeHtml(file.name)}</p>
                          <p class="text-[10px] text-muted-foreground">${file.type === 'IMAGE' ? '图片' : '视频'} · ${escapeHtml(file.uploadedAt)}</p>
                        </div>
                        <button
                          class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                          data-pda-execd-action="remove-proof"
                          data-proof-id="${escapeHtml(file.id)}"
                          data-proof-scope="${scope}"
                        >
                          <i data-lucide="trash-2" class="h-3 w-3"></i>
                        </button>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            `
          : `
              <div class="flex items-center gap-1.5 py-0.5 text-xs text-muted-foreground">
                <i data-lucide="paperclip" class="h-3.5 w-3.5"></i>
                暂无凭证
              </div>
            `
      }
    </div>
  `
}

function renderProofViewSection(files: StartProofFile[]): string {
  if (files.length === 0) {
    return `
      <div class="flex items-center gap-1.5 py-1 text-xs text-muted-foreground">
        <i data-lucide="paperclip" class="h-3.5 w-3.5"></i>
        暂无凭证
      </div>
    `
  }

  return `
    <div class="space-y-1.5">
      <p class="text-xs font-medium text-muted-foreground">共 ${files.length} 个文件</p>
      ${files
        .map(
          (file) => `
            <div class="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <i data-lucide="${file.type === 'IMAGE' ? 'image' : 'video'}" class="h-4 w-4 shrink-0 ${file.type === 'IMAGE' ? 'text-blue-500' : 'text-purple-500'}"></i>
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium">${escapeHtml(file.name)}</p>
                <p class="text-[10px] text-muted-foreground">${file.type === 'IMAGE' ? '图片' : '视频'} · ${escapeHtml(file.uploadedAt)}</p>
              </div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function mutateStartTask(
  taskId: string,
  by: string,
  payload: { startTime: string; headcount?: number; proofFiles: StartProofFile[] },
): void {
  const now = nowTimestamp()
  const task = getTaskFactById(taskId)
  if (!task) return

  const writableTask = task as TaskWithHandoverFields

  task.status = 'IN_PROGRESS'
  task.startedAt = payload.startTime
  writableTask.startHeadcount = undefined
  writableTask.startProofFiles = [...payload.proofFiles]
  task.updatedAt = now
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-START-${Date.now()}`,
      action: 'START_TASK',
      detail: `任务开工，开工时间：${payload.startTime}，开工凭证：${payload.proofFiles.length}个`,
      at: now,
      by,
    },
  ]
}

function mutateFinishTask(taskId: string, by: string): void {
  const now = nowTimestamp()
  const task = getTaskFactById(taskId)
  if (!task) return

  task.status = 'DONE'
  task.finishedAt = now
  task.updatedAt = now
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-FINISH-${Date.now()}`,
      action: 'FINISH_TASK',
      detail: '任务完工',
      at: now,
      by,
    },
  ]
}


function isSpecialCraftExecutionTask(task: ProcessTask, displayProcessName = getTaskProcessDisplayName(task)): boolean {
  if (getWoolWorkOrderByTaskId(task.taskId)) return false
  const stage = (task as ProcessTask & { stage?: string; processStage?: string; processCode?: string }).stage
  const processStage = (task as ProcessTask & { processStage?: string; processCode?: string }).processStage
  const processCode = (task as ProcessTask & { processCode?: string }).processCode
  return stage === 'SPECIAL'
    || processStage === 'SPECIAL'
    || processCode === 'SPECIAL_CRAFT'
    || /特殊工艺|辅助工艺|绣花|打揽|打条|烫画|直喷|盘扣|花朵|打褶|烫钻|捆条/.test(displayProcessName)
}

function getSpecialCraftExecBindings(task: ProcessTask, requestedWorkOrderId = '') {
  const workOrderId = requestedWorkOrderId || getSpecialCraftPdaCandidateByTaskId(task.taskId)?.workOrderId || ''
  if (!workOrderId) return []
  return listCuttingSpecialCraftFeiTicketBindings().filter((binding) =>
    binding.taskOrderId === workOrderId || binding.workOrderId === workOrderId,
  )
}

type SpecialCraftPdaObjectMeta = {
  objectType: '面料' | '裁片' | '成衣' | '捆条' | '辅料'
  objectLabel: '面料' | '裁片' | '成衣' | '捆条' | '辅料'
  qtyUnit: '米' | '片' | '件' | '个' | '条'
  requiresFeiTicket: boolean
}

function resolveSpecialCraftPdaObjectMeta(workOrder?: { targetObject?: string } | null): SpecialCraftPdaObjectMeta {
  const targetObject = String(workOrder?.targetObject || '')
  if (targetObject.includes('成衣')) {
    return { objectType: '成衣', objectLabel: '成衣', qtyUnit: '件', requiresFeiTicket: false }
  }
  if (targetObject.includes('面料')) {
    return { objectType: '面料', objectLabel: '面料', qtyUnit: '米', requiresFeiTicket: false }
  }
  if (targetObject.includes('捆条')) {
    return { objectType: '捆条', objectLabel: '捆条', qtyUnit: '个', requiresFeiTicket: true }
  }
  if (targetObject.includes('辅料') || targetObject.includes('橡筋')) {
    return { objectType: '辅料', objectLabel: '辅料', qtyUnit: '条', requiresFeiTicket: false }
  }
  return { objectType: '裁片', objectLabel: '裁片', qtyUnit: '片', requiresFeiTicket: true }
}

type PdaPhysicalScanContext = {
  sourceType: PdaPhysicalScanSourceType
  workOrderId: string
  action: PdaPhysicalScanAction
  objectName: string
  candidates: PdaPhysicalScanCandidate[]
}

function roundPhysicalQty(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 1_000_000) / 1_000_000
}

function splitPhysicalQty(totalQty: number, maxPackages = 2): number[] {
  const total = roundPhysicalQty(totalQty)
  if (!Number.isFinite(total) || total <= 0) return []
  if (maxPackages <= 1 || total <= 1) return [total]
  const integerUnit = Number.isInteger(total)
  const first = integerUnit ? Math.max(1, Math.floor(total / 2)) : roundPhysicalQty(total / 2)
  const second = roundPhysicalQty(total - first)
  return second > 0 ? [first, second] : [total]
}

function buildPackagedPhysicalCandidates(input: {
  codePrefix: string
  objectKeyPrefix: string
  objectType: PdaPhysicalScanCandidate['objectType']
  objectLabel: string
  totalQty: number
  consumedQty: number
  unit: string
  scope: Pick<PdaPhysicalScanContext, 'sourceType' | 'workOrderId' | 'action'>
  detailId?: string
  lineProgressKey?: string
  feiTicketNo?: string
  skuCode?: string
}): PdaPhysicalScanCandidate[] {
  const packages = splitPhysicalQty(input.totalQty)
  const committedLines = listPdaPhysicalScanBatches(input.scope)
    .flatMap((batch) => batch.lines)
    .filter((line) => line.objectKey.startsWith(`${input.objectKeyPrefix}::`))
  const committedTotal = roundPhysicalQty(committedLines.reduce((sum, line) => sum + line.qty, 0))
  let baselineConsumed = Math.max(roundPhysicalQty(input.consumedQty - committedTotal), 0)
  return packages.flatMap((packageQty, index) => {
    const objectKey = `${input.objectKeyPrefix}::${index + 1}`
    const baselineUsed = Math.min(packageQty, baselineConsumed)
    baselineConsumed = roundPhysicalQty(Math.max(baselineConsumed - baselineUsed, 0))
    const committedUsed = roundPhysicalQty(committedLines
      .filter((line) => line.objectKey === objectKey)
      .reduce((sum, line) => sum + line.qty, 0))
    const availableQty = roundPhysicalQty(packageQty - baselineUsed - committedUsed)
    if (availableQty <= 0) return []
    return [{
      code: `${input.codePrefix}-${String(index + 1).padStart(2, '0')}`,
      objectKey,
      objectType: input.objectType,
      objectLabel: input.objectLabel,
      qty: availableQty,
      maxQty: availableQty,
      unit: input.unit,
      detailId: input.detailId,
      lineProgressKey: input.lineProgressKey,
      feiTicketNo: input.feiTicketNo,
      skuCode: input.skuCode,
    }]
  })
}

function buildSpecialCraftPhysicalScanCandidates(
  workOrder: NonNullable<ReturnType<typeof getSpecialCraftWorkOrderForPdaTask>>,
  action: PdaPhysicalScanAction,
  bindings: ReturnType<typeof getSpecialCraftExecBindings> = [],
): PdaPhysicalScanCandidate[] {
  const objectMeta = resolveSpecialCraftPdaObjectMeta(workOrder)
  const isButtonLoop = workOrder.quantityMode === 'TICKET_INPUT_OUTPUT'
  if (isButtonLoop && action === 'RECEIVE') {
    return (workOrder.buttonLoopInputLines || [])
      .filter((line) => !line.received)
      .map((line) => ({
        code: line.feiTicketNo,
        objectKey: `BUTTON_LOOP_INPUT::${line.inputLineId}`,
        objectType: 'FEI_TICKET' as const,
        objectLabel: `捆条菲票 · ${line.bindingStripName}`,
        qty: 1,
        maxQty: 1,
        unit: '张',
        feiTicketNo: line.feiTicketNo,
      }))
  }

  if (objectMeta.requiresFeiTicket && !isButtonLoop) {
    const rows = (workOrder.lineProgress || []).filter((row) => row.feiTicketNo)
    if (rows.length > 0) {
      return rows.flatMap((row) => {
        const availableQty = action === 'RECEIVE'
          ? Math.max(row.planQty - row.receivedQty, 0)
          : action === 'PROCESS_REPORT'
            ? Math.max(row.receivedQty - row.completedQty, 0)
            : Math.max(row.completedQty - row.returnedQty, 0)
        if (availableQty <= 0) return []
        return [{
          code: row.feiTicketNo!,
          objectKey: `${action}::FEI::${row.lineProgressKey}`,
          objectType: 'FEI_TICKET' as const,
          objectLabel: `${row.partName || '裁片'} · ${row.colorName || '—'} / ${row.sizeCode || '—'}`,
          qty: availableQty,
          maxQty: availableQty,
          unit: objectMeta.qtyUnit,
          lineProgressKey: row.lineProgressKey,
          feiTicketNo: row.feiTicketNo,
        }]
      })
    }
    return bindings.flatMap((binding) => {
      const availableQty = action === 'RECEIVE'
        ? Math.max(binding.currentQty || binding.openingQty || binding.qty || 0, 0)
        : action === 'PROCESS_REPORT'
          ? Math.max((binding.receivedQty || binding.currentQty || binding.openingQty || 0) - (binding.completedQty || 0), 0)
          : Math.max((binding.currentQty || binding.closingQty || 0) - (binding.returnedQty || 0), 0)
      if (availableQty <= 0) return []
      return [{
        code: binding.feiTicketNo,
        objectKey: `${action}::FEI::${binding.bindingId}`,
        objectType: 'FEI_TICKET' as const,
        objectLabel: `${binding.partName || '裁片'} · ${binding.colorName || '—'} / ${binding.sizeCode || '—'}`,
        qty: availableQty,
        maxQty: availableQty,
        unit: objectMeta.qtyUnit,
        feiTicketNo: binding.feiTicketNo,
      }]
    })
  }

  if (objectMeta.objectType === '成衣') {
    return (workOrder.lineProgress || []).filter((row) => row.skuCode).flatMap((row) => {
      const availableQty = action === 'RECEIVE'
        ? Math.max(row.planQty - row.receivedQty, 0)
        : Math.max(row.completedQty - row.returnedQty, 0)
      if (availableQty <= 0) return []
      const code = row.skuCode!
      return [{
        code,
        aliases: [`GAR-${code}`],
        objectKey: `${action}::SKU::${row.lineProgressKey}`,
        objectType: 'GARMENT_LABEL' as const,
        objectLabel: `${row.colorName || '成衣'} / ${row.sizeCode || '均码'}`,
        qty: availableQty,
        maxQty: availableQty,
        unit: '件',
        lineProgressKey: row.lineProgressKey,
        skuCode: code,
      }]
    })
  }

  const isReceive = action === 'RECEIVE'
  const isProcessReport = action === 'PROCESS_REPORT'
  const totalQty = isReceive
    ? workOrder.inputPlannedQty || workOrder.planQty || 0
    : isProcessReport
      ? workOrder.receivedQty || workOrder.currentQty || workOrder.planQty || 0
      : isButtonLoop
        ? workOrder.outputQty || 0
        : workOrder.completedQty || 0
  const consumedQty = isReceive
    ? workOrder.inputReceivedQty || workOrder.receivedQty || 0
    : isProcessReport
      ? workOrder.completedQty || 0
      : isButtonLoop
        ? workOrder.handedOverQty || 0
        : workOrder.returnedQty || 0
  const unit = isReceive ? workOrder.inputUnit || objectMeta.qtyUnit : isButtonLoop ? '个' : workOrder.outputUnit || workOrder.unit || objectMeta.qtyUnit
  const prefix = isReceive ? 'MAT' : isProcessReport ? 'PRC' : 'OUT'
  const objectLabel = isReceive
    ? `${objectMeta.objectType === '辅料' ? '辅料' : '面料'}标签 · ${workOrder.materialSku || workOrder.operationName}`
    : isProcessReport
      ? `${objectMeta.objectLabel}加工对象`
      : `${isButtonLoop ? '盘扣' : objectMeta.objectLabel}成品标签`
  return buildPackagedPhysicalCandidates({
    codePrefix: `${prefix}-${workOrder.taskOrderNo}`,
    objectKeyPrefix: `${action}::${prefix}::${workOrder.taskOrderId}`,
    objectType: isReceive ? 'MATERIAL_LABEL' : 'OUTPUT_LABEL',
    objectLabel,
    totalQty,
    consumedQty,
    unit,
    scope: { sourceType: 'SPECIAL_CRAFT', workOrderId: workOrder.taskOrderId, action },
  })
}

function buildBindingPhysicalScanCandidates(
  order: NonNullable<ReturnType<typeof getBindingProcessOrderById>>,
  action: PdaPhysicalScanAction,
): PdaPhysicalScanCandidate[] {
  if (action === 'RECEIVE') {
    return order.bindingDetails.flatMap((detail) => {
      const remainingQty = Math.max(detail.requiredLength - detail.receivedMaterialLength, 0)
      if (remainingQty <= 0) return []
      return buildPackagedPhysicalCandidates({
        codePrefix: `MAT-${order.bindingOrderNo}-${detail.bindingStripNo}`,
        objectKeyPrefix: `RECEIVE::MAT::${detail.detailId}`,
        objectType: 'MATERIAL_LABEL',
        objectLabel: `${order.materialIdentity.materialName} · ${detail.bindingStripName}`,
        totalQty: detail.requiredLength,
        consumedQty: detail.receivedMaterialLength,
        unit: order.materialIdentity.materialUnit || '米',
        scope: { sourceType: 'BINDING_PROCESS_ORDER', workOrderId: order.bindingOrderId, action },
        detailId: detail.detailId,
      })
    })
  }
  return buildPackagedPhysicalCandidates({
    codePrefix: `OUT-${order.bindingOrderNo}`,
    objectKeyPrefix: `HANDOUT::OUT::${order.bindingOrderId}`,
    objectType: 'OUTPUT_LABEL',
    objectLabel: '加工后捆条标签',
    totalQty: order.actualOutputQty,
    consumedQty: order.handedOverQty || 0,
    unit: order.unit || '米',
    scope: { sourceType: 'BINDING_PROCESS_ORDER', workOrderId: order.bindingOrderId, action },
  })
}

function getPdaPhysicalScanContext(
  sourceType: PdaPhysicalScanSourceType,
  workOrderId: string,
  action: PdaPhysicalScanAction,
): PdaPhysicalScanContext | null {
  if (sourceType === 'BINDING_PROCESS_ORDER') {
    const order = getBindingProcessOrderById(workOrderId)
    return order ? {
      sourceType,
      workOrderId,
      action,
      objectName: action === 'RECEIVE' ? '面料标签' : '加工后捆条标签',
      candidates: buildBindingPhysicalScanCandidates(order, action),
    } : null
  }
  const order = getSpecialCraftTaskOrderById(workOrderId)
  if (!order || !order.sourceTaskId) return null
  const task = getTaskFactById(order.sourceTaskId)
  if (!task) return null
  const bindings = getSpecialCraftExecBindings(task, workOrderId)
  const objectMeta = resolveSpecialCraftPdaObjectMeta(order)
  const isButtonLoop = order.quantityMode === 'TICKET_INPUT_OUTPUT'
  const objectName = action === 'RECEIVE'
    ? isButtonLoop ? '捆条菲票' : objectMeta.requiresFeiTicket ? '裁片菲票' : objectMeta.objectType === '成衣' ? '成衣标签' : '面料／辅料标签'
    : action === 'PROCESS_REPORT'
      ? objectMeta.requiresFeiTicket && !isButtonLoop ? '裁片菲票' : '加工对象标签'
      : objectMeta.requiresFeiTicket && !isButtonLoop ? '加工后裁片菲票' : '加工后成品标签'
  return {
    sourceType,
    workOrderId,
    action,
    objectName,
    candidates: buildSpecialCraftPhysicalScanCandidates(order, action, bindings),
  }
}

function summarizePhysicalScanLines(lines: ReturnType<typeof listPdaPhysicalScanDraftLines>): { totalQty: number; unit: string } {
  return {
    totalQty: roundPhysicalQty(lines.reduce((sum, line) => sum + line.qty, 0)),
    unit: lines[0]?.unit || '',
  }
}

function refreshPdaPhysicalScanSummary(panel: HTMLElement, context: PdaPhysicalScanContext): void {
  const lines = listPdaPhysicalScanDraftLines(context)
  const summary = summarizePhysicalScanLines(lines)
  const countNode = panel.querySelector<HTMLElement>('[data-pda-physical-scan-count]')
  const totalNode = panel.querySelector<HTMLElement>('[data-pda-physical-scan-total]')
  if (countNode) countNode.textContent = `本批已加入 ${lines.length} 张`
  if (totalNode) totalNode.textContent = `合计 ${summary.totalQty} ${summary.unit}`
}

function setPdaPhysicalScanSubmitState(
  panel: HTMLElement,
  context: PdaPhysicalScanContext,
  invalidMessage = '',
): void {
  const detailRoot = panel.closest<HTMLElement>('[data-pda-special-craft-detail], [data-pda-binding-detail]')
  const actionName = context.sourceType === 'BINDING_PROCESS_ORDER'
    ? context.action === 'RECEIVE' ? 'binding-confirm-receive' : 'binding-submit-handover'
    : context.action === 'RECEIVE'
      ? 'special-confirm-receive'
      : context.action === 'PROCESS_REPORT'
        ? 'special-process-report'
        : 'special-submit-handover'
  const submit = detailRoot?.querySelector<HTMLButtonElement>(`[data-pda-execd-action="${actionName}"]`)
  if (!submit) return
  submit.disabled = Boolean(invalidMessage) || listPdaPhysicalScanDraftLines(context).length === 0
  submit.title = invalidMessage || (submit.disabled ? '请先扫描或输入本批实物' : '')
}

function renderPdaPhysicalScanPanel(context: PdaPhysicalScanContext): string {
  const lines = listPdaPhysicalScanDraftLines(context)
  const summary = summarizePhysicalScanLines(lines)
  const actionLabel = context.action === 'RECEIVE' ? '接收' : context.action === 'PROCESS_REPORT' ? '加工填报' : '交出'
  const scanPlaceholder = `扫描或输入${context.objectName}`
  return `<section class="space-y-3 rounded-lg border-2 border-blue-300 bg-blue-50 p-3" data-pda-physical-scan-panel data-source-type="${context.sourceType}" data-work-order-id="${escapeHtml(context.workOrderId)}" data-scan-action="${context.action}">
    <div class="flex items-start gap-2"><i data-lucide="scan-line" class="mt-0.5 h-5 w-5 shrink-0 text-blue-700"></i><div><div class="text-sm font-semibold text-blue-950">逐张扫描或输入本批${escapeHtml(context.objectName)}</div><div class="mt-0.5 text-xs text-blue-800">扫码枪回车自动加入，也可输入完整码后点“加入本批”。</div></div></div>
    <div class="flex gap-2">
      <input autofocus autocomplete="off" class="h-12 min-w-0 flex-1 rounded-md border-2 border-blue-500 bg-white px-3 text-base" placeholder="${escapeHtml(scanPlaceholder)}" aria-label="${escapeHtml(scanPlaceholder)}" data-pda-physical-code-input data-pda-scan-enter="true" data-pda-execd-action="physical-scan-add" data-physical-input-method="SCANNER" />
      <button type="button" class="h-12 shrink-0 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground" data-pda-execd-action="physical-scan-add" data-physical-input-method="MANUAL">加入本批</button>
    </div>
    ${lines.length ? `<div class="space-y-2" data-pda-physical-scan-lines>${lines.map((line) => `<div class="rounded-md border border-blue-200 bg-white p-2" data-pda-physical-scan-line="${escapeHtml(line.scanLineId)}"><div class="flex items-start justify-between gap-2"><div class="min-w-0"><div class="break-all text-xs font-semibold">${escapeHtml(line.code)}</div><div class="mt-0.5 text-[11px] text-muted-foreground">${escapeHtml(line.objectLabel)} · ${line.inputMethod === 'SCANNER' ? '扫码' : '手动录入'}</div></div><button type="button" class="shrink-0 rounded border px-2 py-1 text-xs text-muted-foreground" data-pda-execd-action="physical-scan-remove" data-scan-line-id="${escapeHtml(line.scanLineId)}">移除</button></div><label class="mt-2 flex items-center gap-2 text-xs"><span>本次数量</span><input class="h-9 min-w-0 flex-1 rounded border px-2 text-sm" type="number" min="0.01" max="${line.maxQty}" step="${Number.isInteger(line.maxQty) ? 1 : 0.01}" inputmode="decimal" value="${line.qty}" data-pda-physical-scan-line-qty="${escapeHtml(line.scanLineId)}" aria-label="${escapeHtml(`${line.code}本次数量`)}"><strong>${escapeHtml(line.unit)}</strong></label></div>`).join('')}</div><div class="flex items-center justify-between rounded-md bg-blue-100 px-3 py-2 text-sm text-blue-950"><span data-pda-physical-scan-count>本批已加入 ${lines.length} 张</span><strong data-pda-physical-scan-total>合计 ${summary.totalQty} ${escapeHtml(summary.unit)}</strong></div>` : '<div class="rounded-md border border-dashed border-blue-300 bg-white/70 px-3 py-4 text-center text-xs text-blue-800">尚未加入，不能确认本批。</div>'}
    ${context.candidates.length === 0 ? `<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">当前没有可${actionLabel}的标签或菲票，请刷新加工单；仍不一致时叫主管处理。</div>` : ''}
  </section>`
}

function getSpecialCraftWorkOrderForPdaTask(
  task: ProcessTask,
  bindings = getSpecialCraftExecBindings(task),
  requestedWorkOrderId = '',
) {
  if (requestedWorkOrderId) {
    const requested = getSpecialCraftTaskOrderById(requestedWorkOrderId)
    return requested?.sourceTaskId === task.taskId ? requested : undefined
  }
  const params = getExecDetailSearchParams()
  const querySourceType = params.get('sourceType') || ''
  const querySourceId = params.get('sourceId') || ''
  if (querySourceId && ['SPECIAL_CRAFT', 'SPECIAL_CRAFT_TASK_ORDER', 'SPECIAL_CRAFT_ORDER'].includes(querySourceType)) {
    const queryWorkOrder = getSpecialCraftTaskOrderById(querySourceId)
    return queryWorkOrder?.sourceTaskId === task.taskId ? queryWorkOrder : undefined
  }

  const sourceInfo = getMobileExecutionTaskSourceInfo(task)
  if (sourceInfo.sourceId) {
    const sourceWorkOrder = getSpecialCraftTaskOrderById(sourceInfo.sourceId)
    if (sourceWorkOrder) return sourceWorkOrder
  }
  if (sourceInfo.taskOrderId) {
    const sourceWorkOrder = getSpecialCraftTaskOrderById(sourceInfo.taskOrderId)
    if (sourceWorkOrder) return sourceWorkOrder
  }

  const bindingWorkOrderIds = Array.from(new Set(bindings.map((binding) => binding.taskOrderId || binding.workOrderId).filter(Boolean)))
  if (bindingWorkOrderIds.length === 1) return getSpecialCraftTaskOrderById(bindingWorkOrderIds[0])
  return getSpecialCraftPdaCandidateByTaskId(task.taskId)?.order
}

function getSpecialCraftPdaBaseQty(
  task: ProcessTask,
  workOrder: ReturnType<typeof getSpecialCraftWorkOrderForPdaTask>,
  binding: ReturnType<typeof getSpecialCraftExecBindings>[number] | undefined,
  objectMeta: SpecialCraftPdaObjectMeta,
): number {
  if (objectMeta.requiresFeiTicket) {
    return binding?.receivedQty || binding?.currentQty || binding?.openingQty || workOrder?.receivedQty || workOrder?.currentQty || workOrder?.planQty || task.qty || 0
  }
  return workOrder?.receivedQty || workOrder?.currentQty || workOrder?.planQty || task.qty || 0
}

function getSpecialCraftPdaAllowedActions(input: {
  status: string
  workOrderStatus?: string
  objectLabel: string
  requiresFeiTicket: boolean
  bindingCount: number
  completedQty: number
  returnedQty: number
  canGarmentWarehouseOutbound?: boolean
  surface: SpecialCraftPdaSurface
}): Array<{ action: string; label: string; primary?: boolean }> {
  const currentStatus = input.workOrderStatus || input.status
  const actions: Array<{ action: string; label: string; primary?: boolean }> = []
  if (input.requiresFeiTicket && input.bindingCount === 0) {
    actions.push({ action: 'special-confirm-receive', label: '确认接收', primary: true })
  } else if (['WAITING', 'TODO', '待接收'].includes(currentStatus)) {
    if (input.objectLabel === '成衣' && currentStatus === '待接收') {
      if (input.canGarmentWarehouseOutbound) {
        actions.push({ action: 'special-confirm-receive', label: '逐 SKU 确认接收', primary: true })
      }
    } else {
      actions.push({ action: 'special-confirm-receive', label: `确认接收${input.objectLabel}`, primary: true })
    }
  } else if (currentStatus === '成衣仓已出库待收货') {
    actions.push({ action: 'special-confirm-receive', label: '逐 SKU 确认接收成衣', primary: true })
  } else if (['已接收', '待加工', '已入待加工仓'].includes(currentStatus)) {
    actions.push({ action: 'special-confirm-receive', label: '确认接收', primary: true })
  } else if (currentStatus === 'IN_PROGRESS' || currentStatus === '加工中') {
    actions.push({ action: 'special-process-report', label: '加工填报', primary: true })
    actions.push({ action: 'special-submit-handover', label: '发起交出' })
    if (input.completedQty > 0) actions.push({ action: 'special-complete-order', label: '完成加工单' })
  } else if (currentStatus === '已完结' && input.completedQty > input.returnedQty) {
    actions.push({ action: 'special-submit-handover', label: '发起交出', primary: true })
  }

  if (input.canGarmentWarehouseOutbound && input.surface === 'EXECUTION') return actions
  if (input.surface === 'HANDOVER_RECEIVE') {
    return actions.filter((action) => action.action === 'special-confirm-receive')
  }
  if (input.surface === 'HANDOVER_HANDOUT') {
    return actions.filter((action) => action.action === 'special-submit-handover')
  }
  return actions.filter((action) =>
    action.action === 'special-process-report' || action.action === 'special-complete-order',
  )
}

function canCurrentPdaSessionExecuteGarmentWarehouseOutbound(task: ProcessTask, requestedWorkOrderId = ''): boolean {
  const session = getPdaSession()
  if (!session) return false
  const factory = getFactoryMasterRecordById(session.factoryId)
  const role = findFactoryPdaRoleById(session.roleId, session.factoryId)
  const bindings = getSpecialCraftExecBindings(task, requestedWorkOrderId)
  const workOrder = getSpecialCraftWorkOrderForPdaTask(task, bindings, requestedWorkOrderId)
  return factory?.factoryType === 'CENTRAL_GARMENT'
    && role?.status === 'ACTIVE'
    && role.permissionKeys.includes('HANDOUT_CREATE')
    && workOrder?.targetObject === '成衣'
    && workOrder.status === '待接收'
}

function isSpecialCraftActionAllowedOnCurrentSurface(action: string, allowGarmentWarehouseOutbound: boolean): boolean {
  if (allowGarmentWarehouseOutbound && getSpecialCraftPdaSurface() === 'EXECUTION') return true
  const surface = getSpecialCraftPdaSurface()
  if (surface === 'HANDOVER_RECEIVE') return action === 'special-confirm-receive'
  if (surface === 'HANDOVER_HANDOUT') return action === 'special-submit-handover'
  return action === 'special-process-report' || action === 'special-complete-order'
}

function getCurrentPdaProcessActionAudit() {
  const session = getPdaSession()
  if (!session) throw new Error('当前账号未登录，不能执行移动端动作。')
  const role = findFactoryPdaRoleById(session.roleId, session.factoryId)
  if (!role || role.status !== 'ACTIVE') throw new Error('当前账号角色不可用，不能执行移动端动作。')
  return {
    operatorName: session.userName,
    operatorUserId: session.userId,
    operatorFactoryId: session.factoryId,
    operatorRoleId: session.roleId,
    operatorRoleName: role.roleName,
  }
}

function buildSpecialCraftGarmentSkuDraftKey(workOrderId: string, status: string, skuCode: string): string {
  return `${workOrderId}::${status}::${skuCode}`
}

function getSpecialCraftGarmentSkuDrafts(workOrderId: string, status: string) {
  const taskOrder = getSpecialCraftTaskOrderById(workOrderId)
  const lines = taskOrder?.demandLines || []
  const progressBySkuCode = new Map((taskOrder?.lineProgress || [])
    .filter((row) => row.lineType === 'sku' && row.skuCode)
    .map((row) => [row.skuCode!, row]))
  const inboundBySkuCode = new Map(
    listFactoryWarehouseInboundRecords()
      .filter((record) => record.taskId === workOrderId && record.itemKind === '成衣' && record.sourceObjectName === '成衣仓')
      .map((record) => [record.materialSku || '', record.receivedQty]),
  )
  const availableBySkuCode = new Map(
    listFactoryWaitProcessStockItems()
      .filter((item) => item.taskId === workOrderId && item.itemKind === '成衣' && item.sourceObjectKind === '成衣仓')
      .map((item) => [item.materialSku || '', item.receivedQty]),
  )
  lines.forEach((line) => {
    const skuCode = line.skuCode || `${line.colorName || '成衣'}-${line.sizeCode || '均码'}`
    const draftKey = buildSpecialCraftGarmentSkuDraftKey(workOrderId, status, skuCode)
    const progress = progressBySkuCode.get(skuCode)
    const receivedQty = inboundBySkuCode.get(skuCode) ?? 0
    const availableQty = availableBySkuCode.get(skuCode) ?? receivedQty
    if (!detailState.specialCraftSkuDrafts[draftKey]) {
      detailState.specialCraftSkuDrafts[draftKey] = {
        outboundQty: String(line.planPieceQty),
        receivedQty: String(Math.max(line.planPieceQty - (progress?.receivedQty ?? receivedQty), 0)),
        completedQty: String(Math.max((progress?.receivedQty ?? availableQty) - (progress?.completedQty ?? 0), 0)),
        handoverQty: String(Math.max((progress?.completedQty ?? 0) - (progress?.returnedQty ?? 0), 0)),
        scrapQty: String(line.scrapQty || 0),
        damageQty: String(line.damageQty || 0),
      }
    }
  })
  return {
    lines: lines.map((line) => {
      const skuCode = line.skuCode || `${line.colorName || '成衣'}-${line.sizeCode || '均码'}`
      const receivedQty = inboundBySkuCode.get(skuCode) ?? 0
      const progress = progressBySkuCode.get(skuCode)
      return {
        ...line,
        skuCode,
        draftKey: buildSpecialCraftGarmentSkuDraftKey(workOrderId, status, skuCode),
        expectedQty: line.planPieceQty,
        warehouseReceivedQty: receivedQty,
        warehouseAvailableQty: availableBySkuCode.get(line.skuCode) ?? receivedQty,
        progressReceivedQty: progress?.receivedQty ?? receivedQty,
        progressCompletedQty: progress?.completedQty ?? 0,
        progressReturnedQty: progress?.returnedQty ?? 0,
        hasWarehouseReceipt: inboundBySkuCode.has(line.skuCode),
        receiptDifferenceQty: line.planPieceQty - receivedQty,
      }
    }),
    drafts: detailState.specialCraftSkuDrafts,
  }
}

function renderSpecialCraftGarmentSkuExecution(workOrderId: string, status: string, canGarmentWarehouseOutbound: boolean): string {
  const { lines, drafts } = getSpecialCraftGarmentSkuDrafts(workOrderId, status)
  if (!lines.length) return '<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">暂无成衣 SKU 明细</div>'
  const surface = getSpecialCraftPdaSurface()
  const canOutbound = status === '待接收' && canGarmentWarehouseOutbound
  const canReceive = status === '成衣仓已出库待收货'
  const canFinish = status === '加工中' && surface === 'EXECUTION'
  const canHandover = status === '加工中' && surface === 'HANDOVER_HANDOUT'
  return `
    <div class="space-y-2" data-special-craft-garment-sku-list>
      ${canOutbound ? '<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">待出库：成衣仓按 SKU 确认实出后，辅助工艺才可收货。</div>' : ''}
      ${lines.map((line) => {
        const draft = drafts[line.draftKey]
        return `
          <section class="rounded-md border bg-muted/20 p-3 text-xs" data-special-craft-garment-sku="${escapeHtml(line.skuCode)}">
            <div class="font-medium">SKU：${escapeHtml(line.skuCode)} · ${escapeHtml(line.colorName)} / ${escapeHtml(line.sizeCode)}</div>
            <div class="mt-2 grid grid-cols-3 gap-2">
              <span>计划：${line.planPieceQty} 件</span>
              <span>应收：${line.expectedQty} 件</span>
              <span>累计实收：${line.progressReceivedQty} 件</span>
              <span>累计完工：${line.progressCompletedQty} 件</span>
              <span>累计交出：${line.progressReturnedQty} 件</span>
              <span>剩余可完工：${Math.max(line.progressReceivedQty - line.progressCompletedQty, 0)} 件</span>
              <span>剩余可交出：${Math.max(line.progressCompletedQty - line.progressReturnedQty, 0)} 件</span>
              ${line.hasWarehouseReceipt ? `<span>差异：${line.receiptDifferenceQty} 件</span>` : ''}
              <span>可加工：${line.warehouseAvailableQty} 件</span>
              ${canOutbound ? `<label>实出：<input class="w-16 rounded border px-1 py-0.5" type="number" min="0" max="${line.planPieceQty}" step="1" data-pda-execd-sku-field="outboundQty" data-draft-key="${escapeHtml(line.draftKey)}" value="${escapeHtml(draft.outboundQty)}" /></label>` : ''}
              ${canReceive ? `<label>本次实收：<input class="w-16 rounded border px-1 py-0.5" type="number" min="0" max="${line.expectedQty}" step="1" data-pda-execd-sku-field="receivedQty" data-draft-key="${escapeHtml(line.draftKey)}" value="${escapeHtml(draft.receivedQty)}" /></label>` : ''}
              ${canFinish ? `<label>本次完工：<input class="w-16 rounded border px-1 py-0.5" type="number" min="0" max="${Math.max(line.progressReceivedQty - line.progressCompletedQty, 0)}" step="1" data-pda-execd-sku-field="completedQty" data-draft-key="${escapeHtml(line.draftKey)}" value="${escapeHtml(draft.completedQty)}" /></label>
                <label>报废数量：<input class="w-16 rounded border px-1 py-0.5" type="number" min="0" max="${line.warehouseReceivedQty}" step="1" data-pda-execd-sku-field="scrapQty" data-draft-key="${escapeHtml(line.draftKey)}" value="${escapeHtml(draft.scrapQty)}" /></label>
                <label>货损数量：<input class="w-16 rounded border px-1 py-0.5" type="number" min="0" max="${line.warehouseReceivedQty}" step="1" data-pda-execd-sku-field="damageQty" data-draft-key="${escapeHtml(line.draftKey)}" value="${escapeHtml(draft.damageQty)}" /></label>` : ''}
              ${canHandover ? `<label class="col-span-3 rounded-md border border-blue-200 bg-white px-2 py-2 text-sm">本次交出：<span class="mt-1 flex items-center gap-2"><input class="h-10 min-w-0 flex-1 rounded border px-2 text-base" type="number" min="0" max="${Math.max(line.progressCompletedQty - line.progressReturnedQty, 0)}" step="1" inputmode="numeric" data-pda-execd-sku-field="handoverQty" data-draft-key="${escapeHtml(line.draftKey)}" value="${escapeHtml(draft.handoverQty)}" /><strong>件</strong></span></label>` : ''}
            </div>
            <div class="mt-1 text-muted-foreground">应收来自成衣仓实出；已收和可加工来自辅助工艺仓记录；汇总不允许单独填写。</div>
          </section>
        `
      }).join('')}
    </div>
  `
}

function buildSpecialCraftLineHandoverDraftKey(workOrderId: string, lineProgressKey: string): string {
  return `${workOrderId}::handover::${lineProgressKey}`
}

function clearSpecialCraftHandoverDrafts(workOrderId: string): void {
  const linePrefix = `${workOrderId}::handover::`
  Object.keys(detailState.specialCraftLineHandoverDrafts).forEach((key) => {
    if (key.startsWith(linePrefix)) delete detailState.specialCraftLineHandoverDrafts[key]
  })
  const skuPrefix = `${workOrderId}::`
  Object.keys(detailState.specialCraftSkuDrafts).forEach((key) => {
    if (key.startsWith(skuPrefix)) delete detailState.specialCraftSkuDrafts[key]
  })
  detailState.specialCraftHandoverQty = ''
  detailState.specialCraftHandoverRemark = ''
}

function renderSpecialCraftLineProgressSummary(
  workOrder: ReturnType<typeof getSpecialCraftWorkOrderForPdaTask>,
  unit: string,
  surface: SpecialCraftPdaSurface,
): string {
  const rows = workOrder?.lineProgress || []
  if (!rows.length) return ''
  const showHandoverInput = surface === 'HANDOVER_HANDOUT'
  const step = ['米', '码', '公斤'].includes(unit) ? '0.01' : '1'
  return `
    <div class="space-y-2" data-special-craft-line-progress-summary>
      ${showHandoverInput ? '<div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">按本次实际交出的菲票／明细填写数量；默认带出当前全部可交数量，可改小后分批交出。</div>' : ''}
      ${rows.map((row) => {
        const remainingHandoverQty = Math.max(row.completedQty - row.returnedQty, 0)
        const draftKey = buildSpecialCraftLineHandoverDraftKey(workOrder?.taskOrderId || '', row.lineProgressKey)
        if (showHandoverInput && detailState.specialCraftLineHandoverDrafts[draftKey] === undefined) {
          detailState.specialCraftLineHandoverDrafts[draftKey] = String(remainingHandoverQty)
        }
        return `
        <section class="rounded-md border bg-muted/20 px-3 py-2 text-xs" data-line-progress-key="${escapeHtml(row.lineProgressKey)}">
          <div class="font-medium">${escapeHtml(row.lineType === 'sku' ? row.skuCode || 'SKU' : row.lineType === 'material' ? row.partName || '辅料' : row.feiTicketNo || '菲票')} · ${escapeHtml(row.colorName)} / ${escapeHtml(row.sizeCode)}</div>
          <div class="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
            <span>计划：${row.planQty} ${escapeHtml(unit)}</span>
            <span>累计实收：${row.receivedQty} ${escapeHtml(unit)}</span>
            <span>累计完工：${row.completedQty} ${escapeHtml(unit)}</span>
            <span>累计交出：${row.returnedQty} ${escapeHtml(unit)}</span>
            <span>完工后数量：${row.completedQty} ${escapeHtml(unit)}</span>
            <span>剩余可完工：${Math.max(row.receivedQty - row.completedQty, 0)} ${escapeHtml(unit)}</span>
            <span>剩余可交出：${Math.max(row.completedQty - row.returnedQty, 0)} ${escapeHtml(unit)}</span>
          </div>
          ${showHandoverInput ? `<label class="mt-2 block rounded-md border border-blue-200 bg-white px-2 py-2 text-sm">
            <span class="font-medium">本次交出数量</span>
            <span class="mt-1 flex items-center gap-2">
              <input type="number" min="0" max="${remainingHandoverQty}" step="${step}" inputmode="decimal" class="h-10 min-w-0 flex-1 rounded-md border px-3 text-base" data-pda-execd-handover-line-key="${escapeHtml(draftKey)}" value="${escapeHtml(detailState.specialCraftLineHandoverDrafts[draftKey])}" aria-label="${escapeHtml(`${row.feiTicketNo || row.skuCode || row.partName || '明细'}本次交出数量`)}">
              <strong>${escapeHtml(unit)}</strong>
            </span>
          </label>` : ''}
        </section>
      `}).join('')}
    </div>
  `
}

function renderSpecialCraftExecutionPanel(task: ProcessTask, status: string, displayProcessName: string, requestedWorkOrderId = ''): string {
  const bindings = getSpecialCraftExecBindings(task, requestedWorkOrderId)
  if (!isSpecialCraftExecutionTask(task, displayProcessName) && bindings.length === 0) return ''

  const workOrder = getSpecialCraftWorkOrderForPdaTask(task, bindings, requestedWorkOrderId)
  const objectMeta = resolveSpecialCraftPdaObjectMeta(workOrder)
  const isButtonLoop = workOrder?.quantityMode === 'TICKET_INPUT_OUTPUT'
  const firstBinding = objectMeta.requiresFeiTicket ? bindings[0] : undefined
  const workOrderId = workOrder?.taskOrderId || firstBinding?.taskOrderId || firstBinding?.workOrderId || ''
  const canGarmentWarehouseOutbound = canCurrentPdaSessionExecuteGarmentWarehouseOutbound(task, requestedWorkOrderId)
  const surface = getSpecialCraftPdaSurface()
  const physicalScanAction: PdaPhysicalScanAction | null = surface === 'HANDOVER_RECEIVE'
    ? 'RECEIVE'
    : surface === 'HANDOVER_HANDOUT'
      ? 'HANDOUT'
      : workOrder?.status === '加工中' && objectMeta.requiresFeiTicket && !isButtonLoop
        ? 'PROCESS_REPORT'
        : null
  const physicalScanContext = physicalScanAction && workOrderId
    ? getPdaPhysicalScanContext('SPECIAL_CRAFT', workOrderId, physicalScanAction)
    : null
  const physicalScanLines = physicalScanContext ? listPdaPhysicalScanDraftLines(physicalScanContext) : []
  const allowedActions = getSpecialCraftPdaAllowedActions({
    status,
    workOrderStatus: workOrder?.status,
    objectLabel: objectMeta.objectLabel,
    requiresFeiTicket: objectMeta.requiresFeiTicket,
    bindingCount: isButtonLoop ? workOrder?.buttonLoopInputLines?.length || 0 : bindings.length,
    completedQty: workOrder?.completedQty || 0,
    returnedQty: workOrder?.returnedQty || 0,
    canGarmentWarehouseOutbound,
    surface,
  })
  const garmentSkuExecution = objectMeta.objectType === '成衣' && workOrderId && surface === 'EXECUTION'
    ? renderSpecialCraftGarmentSkuExecution(workOrderId, workOrder?.status || status, canGarmentWarehouseOutbound)
    : ''
  const lineProgressSummary = surface !== 'EXECUTION' || workOrder?.status !== '加工中' || isButtonLoop || objectMeta.objectType === '辅料' || physicalScanContext
    ? ''
    : renderSpecialCraftLineProgressSummary(workOrder, objectMeta.qtyUnit, surface)
  const buttonLoopQtyInput = isButtonLoop && surface === 'EXECUTION'
    ? `<label class="block rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
        <span class="font-medium">${surface === 'HANDOVER_HANDOUT' ? '本次交出盘扣数量' : '本次盘扣产出／交出数量'}</span>
        <span class="mt-1 flex items-center gap-2"><input type="number" min="1" step="1" inputmode="numeric" class="h-10 min-w-0 flex-1 rounded-md border bg-white px-3" data-pda-execd-field="specialCraftButtonLoopQty" value="${escapeHtml(detailState.specialCraftButtonLoopQty)}" placeholder="填写正整数"><strong>个</strong></span>
        <span class="mt-1 block text-xs text-muted-foreground">投入捆条按菲票逐张接收；这里只填写本次产出或交出的盘扣个数。</span>
      </label>`
    : ''
  const isAccessoryReceive = objectMeta.objectType === '辅料' && ['WAITING', 'TODO', '待接收', '已接收', '待加工', '已入待加工仓'].includes(workOrder?.status || status)
  const accessoryQtyUnit = isAccessoryReceive ? workOrder?.inputUnit || '米' : workOrder?.outputUnit || workOrder?.unit || '条'
  const accessoryQtyStep = isAccessoryReceive ? '0.01' : '1'
  const accessoryQtyInput = objectMeta.objectType === '辅料' && surface === 'EXECUTION'
    ? `<label class="block rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
        <span class="font-medium">${surface === 'HANDOVER_HANDOUT' ? '本次交出数量' : '本次加工／交出数量'}</span>
        <span class="mt-1 flex items-center gap-2"><input type="number" min="${accessoryQtyStep}" step="${accessoryQtyStep}" inputmode="decimal" class="h-10 min-w-0 flex-1 rounded-md border bg-white px-3" data-pda-execd-field="specialCraftAccessoryQty" value="${escapeHtml(detailState.specialCraftAccessoryQty)}" placeholder="填写本次数量"><strong>${escapeHtml(accessoryQtyUnit)}</strong></span>
        <span class="mt-1 block text-xs text-muted-foreground">接收按 BOM 投入单位；加工和交出按定长产出单位。系统会阻断超投入、超产出和超交出。</span>
      </label>`
    : ''
  return `
    <section class="space-y-3 text-sm" data-testid="pda-work-order-action-panel" data-writeback-link="linkSpecialCraftCompletionToReturnWaitHandoverStock">
        ${physicalScanContext ? renderPdaPhysicalScanPanel(physicalScanContext) : ''}
        ${garmentSkuExecution}
        ${lineProgressSummary}
        ${buttonLoopQtyInput}
        ${accessoryQtyInput}
        <div class="grid grid-cols-2 gap-2">
          ${
            allowedActions.length
              ? allowedActions.map((action) => {
                const physicalAction = physicalScanContext?.action === 'RECEIVE'
                  ? 'special-confirm-receive'
                  : physicalScanContext?.action === 'PROCESS_REPORT'
                    ? 'special-process-report'
                    : physicalScanContext?.action === 'HANDOUT'
                      ? 'special-submit-handover'
                      : ''
                const usesPhysicalScan = action.action === physicalAction
                const physicalActionLabel = physicalScanContext?.action === 'RECEIVE' ? '接收' : physicalScanContext?.action === 'PROCESS_REPORT' ? '加工填报' : '交出'
                return `
                <button type="button" class="inline-flex ${allowedActions.length === 1 ? 'col-span-2 h-11' : 'h-11'} items-center justify-center rounded-md ${action.primary || surface === 'HANDOVER_HANDOUT' ? 'bg-primary text-primary-foreground' : 'border'} text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-pda-execd-action="${action.action}" data-source-type="SPECIAL_CRAFT" data-work-order-id="${escapeHtml(workOrderId)}" data-source-task-id="${escapeHtml(task.taskId)}" data-confirmation-key="${escapeHtml(`PDA:${workOrderId}:${action.action}:${getSpecialCraftActionRevision(workOrder)}`)}" ${usesPhysicalScan && physicalScanLines.length === 0 ? 'disabled title="请先扫描或输入本批实物"' : ''}>${escapeHtml(usesPhysicalScan ? `确认本批${physicalActionLabel}（${physicalScanLines.length} 张）` : action.label)}</button>
              `}).join('')
              : workOrder?.status === '已完结'
                ? '<div class="col-span-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">加工单已完成</div>'
                : '<div class="col-span-2 rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">当前状态暂无可执行动作</div>'
          }
        </div>
    </section>
  `
}

function getPostFinishingActionLabel(actionType: PostFinishingActionType, phase: 'start' | 'finish'): string {
  if (actionType === '扫码收货') return phase === 'start' ? '开始扫码收货' : '确认收货入库'
  if (actionType === '质检') return '质检仅在 Web“质检任务”执行'
  if (phase === 'start') {
    return actionType === '后道' ? '开始实际工序' : '开始复检'
  }
  return actionType === '后道' ? '完成实际工序' : '完成复检'
}

function getPostFinishingActionCode(actionType: PostFinishingActionType, phase: 'start' | 'finish'): string {
  if (actionType === '扫码收货') return phase === 'start' ? 'POST_RECEIVE_START' : 'POST_RECEIVE_FINISH'
  if (actionType === '质检') return 'POST_QC_WEB_ONLY'
  if (actionType === '后道') return phase === 'start' ? 'POST_PROCESS_START' : 'POST_PROCESS_FINISH'
  return phase === 'start' ? 'POST_RECHECK_START' : 'POST_RECHECK_FINISH'
}

function renderPostFinishingActionButton(
  order: PostFinishingWorkOrder,
  actionType: PostFinishingActionType,
  phase: 'start' | 'finish',
  disabled = false,
): string {
  return `
    <button
      type="button"
      class="inline-flex h-10 items-center justify-center rounded-md ${phase === 'start' ? 'border' : 'bg-primary text-primary-foreground'} px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      data-pda-execd-action="post-${phase}-action"
      data-post-order-id="${escapeHtml(order.postOrderId)}"
      data-task-id="${escapeHtml(order.sourceTaskId)}"
      data-post-action-type="${escapeHtml(actionType)}"
      data-post-action-code="${escapeHtml(getPostFinishingActionCode(actionType, phase))}"
      ${disabled ? 'disabled' : ''}
    >
      ${escapeHtml(getPostFinishingActionLabel(actionType, phase))}
    </button>
  `
}

function renderSkuThumb(imageUrl: string | undefined, label: string): string {
  return imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(label)}" class="h-14 w-14 rounded-md border object-cover">`
    : `<div class="flex h-14 w-14 items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">无图</div>`
}

function canPostFinishingManagedFactoryOperate(order: PostFinishingWorkOrder): boolean {
  return order.isDedicatedPostFactory
}

function renderPostFinishingActionPanel(order: PostFinishingWorkOrder): string {
  const actions: string[] = []
  const receivedStatuses = ['已入库', '已接收']

  if (!receivedStatuses.includes(order.receiveAction.status)) {
    return `
      <div class="grid gap-2">
        <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
          当前后道单还未完成上游来货接收，请先到交接模块确认收货；收货入库后再执行质检、后道和复检。
        </div>
        <button type="button" class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-execd-action="post-go-handover" data-post-task-id="${escapeHtml(order.postTaskId || '')}">
          去交接接收
        </button>
      </div>
    `
  }

  if (!order.isPostDoneBySewingFactory && order.currentStatus === '待后道') {
    const projectLines = order.postProjectLines.filter((line) => line.status === '待开始')
    if (projectLines.length) {
      actions.push(...projectLines.map((line) => `
        <article class="rounded-md border bg-card p-3">
          <div class="flex items-start gap-3">
            ${renderSkuThumb(line.skuImageUrl, line.skuCode)}
            <div class="min-w-0 flex-1 text-xs">
              <div class="truncate text-sm font-semibold">${escapeHtml(line.projectName)}｜${escapeHtml(line.skuCode)}</div>
              <div class="mt-0.5 text-muted-foreground">${escapeHtml(line.colorName)} / ${escapeHtml(line.sizeName)}</div>
              <div class="mt-2 grid grid-cols-3 gap-2 text-center">
                <div class="rounded bg-muted px-2 py-1"><div class="text-muted-foreground">计划</div><div class="font-semibold">${line.plannedQty}</div></div>
                <div class="rounded bg-muted px-2 py-1"><div class="text-muted-foreground">完成</div><div class="font-semibold">${line.completedQty}</div></div>
                <div class="rounded bg-muted px-2 py-1"><div class="text-muted-foreground">状态</div><div class="font-semibold">${escapeHtml(line.status)}</div></div>
              </div>
            </div>
          </div>
          <button type="button" class="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-execd-action="post-project-start" data-post-order-id="${escapeHtml(order.postOrderId)}" data-project-line-id="${escapeHtml(line.projectLineId)}">
            开始实际工序
          </button>
        </article>
      `))
    } else {
      actions.push(renderPostFinishingActionButton(order, '后道', 'start'))
    }
  }
  if (!order.isPostDoneBySewingFactory && order.currentStatus === '后道中') {
    const projectLines = order.postProjectLines.filter((line) => line.status !== '已完成')
    if (projectLines.length) {
      actions.push(...projectLines.map((line) => `
        <article class="rounded-md border bg-card p-3">
          <div class="flex items-start gap-3">
            ${renderSkuThumb(line.skuImageUrl, line.skuCode)}
            <div class="min-w-0 flex-1 text-xs">
              <div class="truncate text-sm font-semibold">${escapeHtml(line.projectName)}｜${escapeHtml(line.skuCode)}</div>
              <div class="mt-0.5 text-muted-foreground">${escapeHtml(line.colorName)} / ${escapeHtml(line.sizeName)}</div>
              <div class="mt-2 grid grid-cols-3 gap-2 text-center">
                <div class="rounded bg-muted px-2 py-1"><div class="text-muted-foreground">计划</div><div class="font-semibold">${line.plannedQty}</div></div>
                <div class="rounded bg-muted px-2 py-1"><div class="text-muted-foreground">完成</div><div class="font-semibold">${line.completedQty}</div></div>
                <div class="rounded bg-muted px-2 py-1"><div class="text-muted-foreground">状态</div><div class="font-semibold">${escapeHtml(line.status)}</div></div>
              </div>
            </div>
          </div>
          ${line.status === '待开始' ? `
            <button type="button" class="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md border px-3 text-sm font-medium" data-pda-execd-action="post-project-start" data-post-order-id="${escapeHtml(order.postOrderId)}" data-project-line-id="${escapeHtml(line.projectLineId)}">
              开始实际工序
            </button>
          ` : `
            <button type="button" class="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-execd-action="post-project-complete" data-post-order-id="${escapeHtml(order.postOrderId)}" data-project-line-id="${escapeHtml(line.projectLineId)}" data-project-planned-qty="${line.plannedQty}">
              完成实际工序
            </button>
          `}
        </article>
      `))
    } else {
      actions.push(renderPostFinishingActionButton(order, '后道', 'finish'))
    }
    actions.push(`
      <button type="button" class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted" data-pda-execd-action="post-report-difference" data-post-order-id="${escapeHtml(order.postOrderId)}" data-task-id="${escapeHtml(order.sourceTaskId)}">
        上报差异
      </button>
    `)
  }

  if (canPostFinishingManagedFactoryOperate(order)) {
    if (order.currentStatus === '复检中') {
      actions.push(`<a class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" href="/fcs/pda/post-finishing/recheck">扫描复检单进入新复检流程</a>`)
    } else if (order.currentStatus === '待复检') {
      actions.push(`<a class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" href="/fcs/pda/post-finishing/recheck">扫描复检单</a>`)
    }
  }

  if (actions.length === 0) {
    return '<div class="rounded-md border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">当前没有可执行动作</div>'
  }

  return `<div class="grid gap-2">${actions.join('')}</div>`
}

function listUnifiedPostFinishingMobileOperationRecords(order: PostFinishingWorkOrder): ProcessActionOperationRecord[] {
  const bySource = getProcessActionOperationRecordsBySource('POST_FINISHING', order.postOrderId)
  const byTask = order.sourceTaskId ? getProcessActionOperationRecordsByTask(order.sourceTaskId) : []
  return Array.from(new Map([...bySource, ...byTask].map((record) => [record.operationRecordId, record])).values())
    .sort((a, b) => b.operatedAt.localeCompare(a.operatedAt))
}

function renderPostFinishingMobileOperationRecords(order: PostFinishingWorkOrder): string {
  const rows = listUnifiedPostFinishingMobileOperationRecords(order)
  if (rows.length === 0) {
    return '<div class="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">暂无操作记录</div>'
  }

  return `
    <div class="overflow-x-auto">
      <table class="min-w-[720px] text-left text-xs">
        <thead class="bg-muted text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">操作动作</th>
            <th class="px-3 py-2 font-medium">状态变化</th>
            <th class="px-3 py-2 font-medium">操作人</th>
            <th class="px-3 py-2 font-medium">成衣件数</th>
            <th class="px-3 py-2 font-medium">来源</th>
            <th class="px-3 py-2 font-medium">备注</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${rows.map((record) => `
            <tr data-testid="operation-record-row">
              <td class="px-3 py-2 font-medium">${escapeHtml(record.actionLabel)}</td>
              <td class="px-3 py-2">${escapeHtml(record.previousStatus)} -> ${escapeHtml(record.nextStatus)}</td>
              <td class="px-3 py-2">${escapeHtml(record.operatorName)}</td>
              <td class="px-3 py-2">${record.objectQty} ${escapeHtml(record.qtyUnit)}</td>
              <td class="px-3 py-2">${escapeHtml(record.sourceChannel)}</td>
              <td class="px-3 py-2">${escapeHtml(record.remark || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderPdaPostFinishingTaskPage(execId: string, task: PostFinishingTaskView): string {
  const postOrders = listPostFinishingWorkOrders().filter((item) => item.postTaskId === task.postTaskId || item.sourceProductionOrderNo === task.productionOrderNo)
  const waitQcQty = task.waitQcQty + task.qcInProgressQty
  const shouldGoHandover = task.currentStatus === '待上游交出' || task.currentStatus === '待收货'
  const isAccepted = task.acceptanceStatus === 'ACCEPTED'
  const currentActions = [
    !isAccepted
      ? `<a class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted" href="/fcs/pda/task-receive/${encodeURIComponent(task.postTaskId)}?returnTo=/fcs/pda/exec">去接单</a>`
      : '',
    isAccepted && shouldGoHandover
      ? `<button type="button" class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-execd-action="post-go-handover" data-post-task-id="${escapeHtml(task.postTaskId)}">去交接接收</button>`
      : '',
    task.waitQcQty > 0
      ? `<a class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium" href="/fcs/craft/post-finishing/qc-orders">前往 Web 质检任务</a>`
      : '',
    postOrders[0]
      ? `<button type="button" class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted" data-pda-execd-action="post-task-open-order" data-post-order-id="${escapeHtml(postOrders[0].postOrderId)}">处理后道单</button>`
      : '',
  ].filter(Boolean).join('')
  const postRows = postOrders.map((item) => `
    <tr>
      <td class="px-3 py-2 font-mono">${renderPdaObjectCode({
        objectType: 'PROCESS_DOC',
        objectId: item.postOrderNo,
        relatedProductionOrderNo: item.sourceProductionOrderNo,
      })}</td>
      <td class="px-3 py-2">${escapeHtml(item.postProcessItems.join('、') || '无后道单')}</td>
      <td class="px-3 py-2">${escapeHtml(item.postStatus)}</td>
    </tr>
  `).join('')

  const content = `
    <div class="space-y-4 bg-background p-4 pb-6">
      <div class="flex items-center gap-2">
        <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-pda-execd-action="back">
          <i data-lucide="arrow-left" class="mr-1 h-4 w-4"></i>
          返回
        </button>
        <h1 class="text-base font-semibold">后道任务</h1>
      </div>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-semibold">${renderPdaObjectCode({
              objectType: 'QC_MASTER_ORDER',
              objectId: task.postTaskId,
              label: task.postTaskNo,
              relatedProductionOrderNo: task.productionOrderNo,
            })}</span>
            <span class="inline-flex rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">${escapeHtml(task.currentStatus)}</span>
          </div>
        </header>
        <div class="grid gap-3 p-4 text-xs">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <span class="text-muted-foreground">生产单</span>
            <span class="font-medium">${renderPdaObjectCode({
              objectType: 'PRODUCTION_ORDER',
              objectId: task.productionOrderNo,
            })}</span>
            <span class="text-muted-foreground">款式</span>
            <span>${escapeHtml(task.spuName)}</span>
            <span class="text-muted-foreground">后道工厂</span>
            <span>${escapeHtml(task.managedPostFactoryName)}</span>
            <span class="text-muted-foreground">上游来源</span>
            <span>${escapeHtml(task.sourceFactoryNames.join('、') || '待上游交出')}</span>
            <span class="text-muted-foreground">当前节点</span>
            <span>${escapeHtml(task.currentNode)}</span>
            <span class="text-muted-foreground">计划数量</span>
            <span>${task.plannedGarmentQty} ${escapeHtml(task.qtyUnit)}</span>
            <span class="text-muted-foreground">未质检数量</span>
            <span>${waitQcQty} ${escapeHtml(task.qtyUnit)}</span>
            <span class="text-muted-foreground">待交出数量</span>
            <span>${task.waitHandoverQty} ${escapeHtml(task.qtyUnit)}</span>
          </div>
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3"><h2 class="text-sm font-semibold">当前可执行动作</h2></header>
        <div class="grid gap-2 p-4">
          ${currentActions || '<div class="rounded-md border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">当前没有可执行动作</div>'}
        </div>
      </article>

      <article class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        质检已经收口为 Web 专属操作；此 PDA 页面不再创建、领取或完成质检任务。
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3"><h2 class="text-sm font-semibold">后道与复检入口</h2></header>
        <div class="space-y-3 p-4">
          <div class="overflow-x-auto"><table class="min-w-[520px] text-left text-xs"><thead class="bg-muted text-muted-foreground"><tr><th class="px-3 py-2">后道单</th><th class="px-3 py-2">后道项目</th><th class="px-3 py-2">状态</th></tr></thead><tbody class="divide-y">${postRows || '<tr><td colspan="3" class="px-3 py-4 text-center text-muted-foreground">暂无后道单</td></tr>'}</tbody></table></div>
          <div class="grid grid-cols-2 gap-2"><a class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium" href="/fcs/pda/post-finishing/execute">扫描后道任务</a><a class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" href="/fcs/pda/post-finishing/recheck">扫描复检单</a></div>
        </div>
      </article>
    </div>
  `
  void execId
  return renderPdaFrame(content, 'exec', { disableTodoAutoOpen: true })
}

function renderPdaPostFinishingExecutionPage(execId: string, order: PostFinishingWorkOrder): string {
  const actionRows = [order.receiveAction, order.qcAction, order.postAction, order.recheckAction]
    .filter(Boolean)
    .map((action) => `
      <tr>
        <td class="px-3 py-2">${escapeHtml(action!.actionType)}</td>
        <td class="px-3 py-2">${escapeHtml(action!.status)}</td>
        <td class="px-3 py-2">${action!.acceptedGarmentQty} ${escapeHtml(action!.qtyUnit)}</td>
        <td class="px-3 py-2">${escapeHtml(action!.operatorName || '—')}</td>
      </tr>
    `)
    .join('')

  const content = `
    <div class="space-y-4 bg-background p-4 pb-6">
      <div class="flex items-center gap-2">
        <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-pda-execd-action="back">
          <i data-lucide="arrow-left" class="mr-1 h-4 w-4"></i>
          返回
        </button>
        <h1 class="text-base font-semibold">实际工序执行</h1>
      </div>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-semibold">${renderPdaObjectCode({
              objectType: 'PROCESS_DOC',
              objectId: order.postOrderNo,
              relatedProductionOrderNo: order.sourceProductionOrderNo,
            })}</span>
            <span class="inline-flex rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">${escapeHtml(order.currentStatus)}</span>
          </div>
        </header>
        <div class="grid gap-3 p-4 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span class="text-muted-foreground">生产单</span>
            <span class="font-medium">${renderPdaObjectCode({
              objectType: 'PRODUCTION_ORDER',
              objectId: order.sourceProductionOrderNo,
            })}</span>
            <span class="text-muted-foreground">来源任务</span>
            <span class="font-medium">${renderPdaObjectCode({
              objectType: 'PROCESS_DOC',
              objectId: order.sourceTaskNo,
              relatedProductionOrderNo: order.sourceProductionOrderNo,
            })}</span>
            <span class="text-muted-foreground">来源车缝任务</span>
            <span class="font-medium">${renderPdaObjectCode({
              objectType: 'PROCESS_DOC',
              objectId: order.sourceSewingTaskNo,
              relatedProductionOrderNo: order.sourceProductionOrderNo,
            })}</span>
            <span class="text-muted-foreground">当前工厂</span>
            <span>${escapeHtml(formatFactoryDisplayName(order.currentFactoryName, order.currentFactoryId))}</span>
            <span class="text-muted-foreground">后道工厂</span>
            <span>${escapeHtml(formatFactoryDisplayName(order.managedPostFactoryName, order.managedPostFactoryId))}</span>
            <span class="text-muted-foreground">后道来源</span>
            <span>${escapeHtml(getPostFinishingSourceLabel(order))}</span>
            <span class="text-muted-foreground">当前流程</span>
            <span>${escapeHtml(getPostFinishingFlowText(order))}</span>
            <span class="text-muted-foreground">计划成衣件数</span>
            <span>${order.plannedGarmentQty} ${escapeHtml(order.plannedGarmentQtyUnit)}</span>
            <span class="text-muted-foreground">接收成衣件数</span>
            <span>${order.receiveAction.acceptedGarmentQty} ${escapeHtml(order.receiveAction.qtyUnit)}</span>
            <span class="text-muted-foreground">已完成实际工序成衣件数</span>
            <span>${order.postAction.acceptedGarmentQty} ${escapeHtml(order.postAction.qtyUnit)}</span>
            <span class="text-muted-foreground">当前状态</span>
            <span>${escapeHtml(order.currentStatus)}</span>
            <span class="text-muted-foreground">任务模式</span>
            <span>${escapeHtml(order.routeMode)}</span>
            <span class="text-muted-foreground">是否需要质检</span>
            <span>${order.requiresQc ? '需要' : '不需要'}</span>
            <span class="text-muted-foreground">是否需要后道</span>
            <span>${order.requiresPostFinishing ? '需要' : '后道已由车缝厂完成'}</span>
            <span class="text-muted-foreground">是否需要复检</span>
            <span>${order.requiresRecheck ? '需要' : '不需要'}</span>
          </div>
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">当前可执行动作</h2>
        </header>
        <div class="space-y-3 p-4">
          ${renderPostFinishingActionPanel(order)}
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">收货、质检、后道、复检记录</h2>
        </header>
        <div class="overflow-x-auto p-4">
          <table class="min-w-[640px] text-left text-xs">
            <thead class="bg-muted text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">动作</th>
                <th class="px-3 py-2 font-medium">状态</th>
                <th class="px-3 py-2 font-medium">确认成衣件数</th>
                <th class="px-3 py-2 font-medium">操作人</th>
              </tr>
            </thead>
            <tbody class="divide-y">${actionRows}</tbody>
          </table>
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">操作记录</h2>
        </header>
        <div class="p-4">
          ${renderPostFinishingMobileOperationRecords(order)}
        </div>
      </article>
    </div>
  `
  void execId
  return renderPdaFrame(content, 'exec', { disableTodoAutoOpen: true })
}

function renderPdaSewingPostTaskPage(taskId: string, task: SewingFactoryPostTask): string {
  const canStartPost = task.status === '待后道'
  const canFinishPost = task.status === '后道中'
  const canTransfer = task.status === '后道完成' || task.status === '待交后道工厂'
  const plannedGarmentQty = task.skuLines.reduce((sum, line) => sum + line.plannedQty, 0)
  const qtyUnit = task.skuLines[0]?.qtyUnit || '件'
  const completedSewingGarmentQty = ['车缝完成', '待后道', '后道中', '后道完成', '待交后道工厂', '已交后道工厂'].includes(task.status) ? plannedGarmentQty : 0
  const completedPostGarmentQty = ['后道完成', '待交后道工厂', '已交后道工厂'].includes(task.status) ? plannedGarmentQty : 0
  const statusLabel = task.status === '待后道' ? '待实际工序' : task.status === '后道中' ? '实际工序中' : task.status === '后道完成' ? '实际工序完成' : task.status
  const content = `
    <div class="space-y-4 bg-background p-4 pb-6">
      <div class="flex items-center gap-2">
        <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-pda-execd-action="back">
          <i data-lucide="arrow-left" class="mr-1 h-4 w-4"></i>
          返回
        </button>
        <h1 class="text-base font-semibold">车缝及后道任务</h1>
      </div>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-semibold">${renderPdaObjectCode({
              objectType: 'PROCESS_DOC',
              objectId: task.postTaskNo,
              relatedProductionOrderNo: task.productionOrderNo,
            })}</span>
            <span class="inline-flex rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">${escapeHtml(statusLabel)}</span>
          </div>
        </header>
        <div class="grid gap-3 p-4 text-xs">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <span class="text-muted-foreground">车缝任务号</span>
            <span class="font-medium">${renderPdaObjectCode({
              objectType: 'PROCESS_DOC',
              objectId: task.taskNo,
              relatedProductionOrderNo: task.productionOrderNo,
            })}</span>
            <span class="text-muted-foreground">生产单</span>
            <span>${renderPdaObjectCode({
              objectType: 'PRODUCTION_ORDER',
              objectId: task.productionOrderNo,
            })}</span>
            <span class="text-muted-foreground">车缝工厂</span>
            <span>${escapeHtml(task.sourceFactoryName)}</span>
            <span class="text-muted-foreground">计划成衣件数</span>
            <span>${plannedGarmentQty} ${escapeHtml(qtyUnit)}</span>
            <span class="text-muted-foreground">已完成车缝成衣件数</span>
            <span>${completedSewingGarmentQty} ${escapeHtml(qtyUnit)}</span>
            <span class="text-muted-foreground">是否需要本厂完成实际工序</span>
            <span>${task.needFactoryPostFinishing ? '是' : '否'}</span>
            <span class="text-muted-foreground">实际工序完成成衣件数</span>
            <span>${completedPostGarmentQty} ${escapeHtml(qtyUnit)}</span>
            <span class="text-muted-foreground">实际工序后流向</span>
            <span>交给${escapeHtml(task.managedPostFactoryName)}质检和复检</span>
            <span class="text-muted-foreground">关联后道单号</span>
            <span>${renderPdaObjectCode({
              objectType: 'PROCESS_DOC',
              objectId: task.relatedPostOrderNo,
              relatedProductionOrderNo: task.productionOrderNo,
            })}</span>
          </div>
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">当前可执行动作</h2>
        </header>
        <div class="grid gap-2 p-4">
          <button type="button" class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-pda-execd-action="sewing-post-start" data-sewing-post-task-id="${escapeHtml(task.postTaskId)}" ${canStartPost ? '' : 'disabled'}>开始实际工序</button>
          <button type="button" class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50" data-pda-execd-action="sewing-post-finish" data-sewing-post-task-id="${escapeHtml(task.postTaskId)}" ${canFinishPost ? '' : 'disabled'}>完成实际工序</button>
          <button type="button" class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-pda-execd-action="sewing-post-transfer" data-sewing-post-task-id="${escapeHtml(task.postTaskId)}" ${canTransfer ? '' : 'disabled'}>交给后道工厂</button>
          <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">车缝工厂只执行任务链中的车缝及开扣眼、装扣子、烫包，不执行后道工厂质检和复检。</div>
        </div>
      </article>
    </div>
  `
  void taskId
  return renderPdaFrame(content, 'exec', { disableTodoAutoOpen: true })
}

type FixedMergedPdaTask = ProcessTask & {
  mergedTaskType?: MergedProductionTaskType
  mergeSourceTaskIds?: string[]
  scopeSkuLines?: Array<{ skuCode: string; color: string; size: string; qty: number }>
  mockExecutionSummary?: string
}

function renderPdaFixedMergedTaskPage(task: FixedMergedPdaTask, currentFactoryId: string): string {
  const mergedTaskType = task.mergedTaskType || (task.processBusinessCode as MergedProductionTaskType | undefined)
  if (!mergedTaskType || !['SEWING_IRON_PACK', 'CUTTING_SEWING_IRON_PACK'].includes(mergedTaskType)) {
    return renderPdaFrame('<div class="p-6 text-sm text-red-700">合并任务类型无效，请联系生产计划员。</div>', 'exec', { disableTodoAutoOpen: true })
  }
  const definition = getMergedProductionTaskDefinition(mergedTaskType)
  const access = getMobileTaskAccessResult(task, currentFactoryId)
  const handoverOrder = getTaskHandoverOrder(task as TaskWithHandoverFields)
  const handoverOrderId = handoverOrder?.handoverOrderId || handoverOrder?.handoverId || ''
  const skuLines = task.scopeSkuLines || []
  const statusLabel = task.status === 'NOT_STARTED'
    ? '待开始'
    : task.status === 'IN_PROGRESS'
      ? '生产中，待交出'
      : task.status === 'DONE'
        ? '已交出，任务结束'
        : task.status === 'BLOCKED'
          ? '异常待处理'
          : '已取消'
  const sourceTasks = task.mergeSourceTaskIds || []
  const canStart = access.canExecuteInMobile && task.acceptanceStatus === 'ACCEPTED' && task.status === 'NOT_STARTED'

  const primaryAction = task.status === 'NOT_STARTED'
    ? `<button class="h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground disabled:opacity-50" data-pda-execd-action="start-fixed-merged-task" data-task-id="${escapeHtml(task.taskId)}" ${canStart ? '' : 'disabled'}>开始生产</button>`
    : task.status === 'IN_PROGRESS'
      ? `<button class="h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground disabled:opacity-50" data-pda-execd-action="view-handover-order" data-handover-order-id="${escapeHtml(handoverOrderId)}" ${handoverOrderId ? '' : 'disabled'}>交出并结束</button>`
      : '<div class="rounded-lg border border-green-200 bg-green-50 p-3 text-center text-sm font-medium text-green-700">本任务已交出结束，无需其他执行步骤</div>'

  const content = `
    <div class="min-h-[760px] bg-slate-50 p-4">
      <button class="mb-3 inline-flex items-center text-sm text-muted-foreground" data-pda-execd-action="back"><i data-lucide="arrow-left" class="mr-1 h-4 w-4"></i>返回任务</button>
      <article class="rounded-xl border bg-white p-4 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div><p class="text-xs text-muted-foreground">${escapeHtml(task.productionOrderNo || task.productionOrderId || '')}</p><h1 class="mt-1 text-lg font-semibold">${escapeHtml(definition.label)}</h1><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.taskNo || task.taskId)}</p></div>
          <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">${escapeHtml(statusLabel)}</span>
        </div>
        <div class="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900"><b>本厂责任范围</b><p class="mt-1">${escapeHtml(definition.responsibilityLabel)}</p></div>
        <dl class="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">任务数量</dt><dd class="mt-1 font-semibold">${task.qty.toLocaleString()} ${escapeHtml(getProcessTaskQtyDisplayUnit(task))}</dd></div><div><dt class="text-xs text-muted-foreground">分配颗粒度</dt><dd class="mt-1 font-semibold">完整 SKU</dd></div><div class="col-span-2"><dt class="text-xs text-muted-foreground">源任务</dt><dd class="mt-1 break-all">${escapeHtml(sourceTasks.join('、') || '由平台合并生成')}</dd></div></dl>
      </article>
      ${skuLines.length ? `<article class="mt-3 rounded-xl border bg-white p-4"><h2 class="text-sm font-semibold">本次承接 SKU</h2><div class="mt-3 space-y-2">${skuLines.map((line) => `<div class="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm"><span>${escapeHtml(line.skuCode)} · ${escapeHtml(line.color)} · ${escapeHtml(line.size)}</span><b>${line.qty}件</b></div>`).join('')}</div></article>` : ''}
      <article class="mt-3 rounded-xl border bg-white p-4"><h2 class="text-sm font-semibold">现场操作</h2><p class="mt-1 text-xs text-muted-foreground">PDA 只负责接单、开始和交出；不设置执行步骤、关键节点或单独完工。</p><div class="mt-4">${primaryAction}</div>${!access.canExecuteInMobile ? `<p class="mt-2 text-xs text-amber-700">${escapeHtml(access.reasonLabel)}</p>` : ''}</article>
    </div>`
  return renderPdaFrame(content, 'exec', { disableTodoAutoOpen: true })
}

function renderSpecialCraftFocusedDetailPage(task: ProcessTask, requestedWorkOrderId = ''): string {
  const session = getPdaSession()
  const candidate = requestedWorkOrderId
    ? getSpecialCraftPdaCandidateByWorkOrderId(requestedWorkOrderId)
    : getSpecialCraftPdaCandidateByTaskId(task.taskId)
  const surface = getSpecialCraftPdaSurface()
  const canGarmentWarehouseOutbound = surface === 'EXECUTION' && canCurrentPdaSessionExecuteGarmentWarehouseOutbound(task, requestedWorkOrderId)
  const canOpen = Boolean(
    session
    && candidate
    && candidate.sourceTaskId === task.taskId
    && (
      (candidate.order.factoryId === session.factoryId && canFactoryAccessSpecialCraftPdaTask(session.factoryId, task))
      || canGarmentWarehouseOutbound
    ),
  )
  const isExecution = surface === 'EXECUTION'
  const actionLabel = surface === 'HANDOVER_HANDOUT' ? '发起交出' : surface === 'HANDOVER_RECEIVE' ? '确认接收' : '加工单执行'
  const backLabel = isExecution ? '返回执行' : '返回交接'
  const imageTitle = candidate ? `${candidate.styleNo} · ${candidate.styleName}` : '款式图片'
  const detailObjectMeta = resolveSpecialCraftPdaObjectMeta(candidate?.order)
  const quantityDetails = candidate?.order.quantityMode === 'TICKET_INPUT_OUTPUT'
    ? `<span>投入菲票：${candidate.order.receivedTicketCount || 0} / ${candidate.order.inputTicketCount || 0} 张</span><span>累计产出：${candidate.order.outputQty || 0} 个</span><span>累计交出：${candidate.order.handedOverQty || 0} 个</span><span>待交出：${candidate.order.waitHandoverQty || 0} 个</span>`
    : detailObjectMeta.objectType === '辅料'
      ? `<span>计划投入：${candidate?.order.inputPlannedQty || 0} ${escapeHtml(candidate?.order.inputUnit || '米')}</span><span>累计实收：${candidate?.order.inputReceivedQty || 0} ${escapeHtml(candidate?.order.inputUnit || '米')}</span><span>累计完工：${candidate?.order.completedQty || 0} ${escapeHtml(candidate?.order.outputUnit || candidate?.order.unit || '条')}</span><span>累计交出：${candidate?.order.returnedQty || 0} ${escapeHtml(candidate?.order.outputUnit || candidate?.order.unit || '条')}</span>`
      : `<span>计划：${candidate?.order.planQty || 0} ${escapeHtml(detailObjectMeta.qtyUnit)}</span><span>累计接收：${candidate?.order.receivedQty || 0} ${escapeHtml(detailObjectMeta.qtyUnit)}</span><span>累计完工：${candidate?.order.completedQty || 0} ${escapeHtml(detailObjectMeta.qtyUnit)}</span><span>累计交出：${candidate?.order.returnedQty || 0} ${escapeHtml(detailObjectMeta.qtyUnit)}</span>`
  const workOrderDetails = candidate ? `
    <details class="rounded-lg border bg-card" data-testid="pda-work-order-details">
      <summary class="cursor-pointer px-3 py-3 text-sm font-semibold">加工单详情</summary>
      <div class="space-y-3 border-t p-3">
        <div class="flex gap-3">
          ${candidate.styleImageUrl ? `<button type="button" class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30" data-pda-image-preview-url="${escapeHtml(candidate.styleImageUrl)}" data-pda-image-preview-title="${escapeHtml(imageTitle)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(imageTitle)}大图"><img class="h-full w-full object-cover" src="${escapeHtml(candidate.styleImageUrl)}" alt="${escapeHtml(imageTitle)}款式图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>` : '<div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border bg-muted/30"><span class="px-1 text-center text-xs text-muted-foreground">款式图缺失</span></div>'}
          <div class="min-w-0 flex-1 text-xs">
            <div class="text-sm font-semibold">${escapeHtml(candidate.order.taskOrderNo)}</div>
            <div class="mt-1">${escapeHtml(candidate.styleNo)} · ${escapeHtml(candidate.styleName)}</div>
            <div class="mt-1">${escapeHtml(candidate.order.operationName)} · ${escapeHtml(candidate.order.targetObject)}</div>
            <div class="mt-1 text-muted-foreground">${escapeHtml(candidate.order.factoryName)} · ${escapeHtml(candidate.order.status)}</div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <span>生产单：${escapeHtml(candidate.order.productionOrderNo)}</span>
          <span class="break-all">加工单 ID：${escapeHtml(candidate.order.taskOrderId)}</span>
          <span>来源任务：${escapeHtml(candidate.sourceTaskNo)}</span>
          <span class="break-all">来源任务 ID：${escapeHtml(candidate.sourceTaskId)}</span>
          ${quantityDetails}
        </div>
      </div>
    </details>
  ` : ''
  const content = `
    <div class="space-y-4 bg-background p-4 pb-6" data-pda-special-craft-detail>
      <div class="flex items-center gap-2">
        <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-pda-execd-action="back">
          <i data-lucide="arrow-left" class="mr-1 h-4 w-4"></i>
          ${escapeHtml(backLabel)}
        </button>
        <h1 class="text-base font-semibold">${escapeHtml(actionLabel)}</h1>
      </div>
      ${canOpen
        ? renderSpecialCraftExecutionPanel(task, task.status || 'NOT_STARTED', getTaskProcessDisplayName(task), candidate?.workOrderId || requestedWorkOrderId)
        : '<section class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">该加工单不属于当前登录工厂，不能操作。</section>'}
      ${workOrderDetails}
    </div>
  `
  return renderPdaFrame(content, isExecution ? 'exec' : 'handover', { headerTitle: actionLabel, disableTodoAutoOpen: true })
}

function renderBindingFocusedDetailPage(workOrderId: string): string {
  const candidate = getBindingProcessPdaCandidateByWorkOrderId(workOrderId)
  const order = candidate?.order || null
  const session = getPdaSession()
  const surface = getSpecialCraftPdaSurface()
  const isExecution = surface === 'EXECUTION'
  const canOpen = Boolean(order && session && order.factoryId === session.factoryId)
  if (order && detailState.bindingDraftWorkOrderId !== order.bindingOrderId) {
    detailState.bindingDraftWorkOrderId = order.bindingOrderId
    detailState.bindingDetailId = order.bindingDetails[0]?.detailId || ''
    detailState.bindingQty = ''
    detailState.bindingRemark = ''
  }
  const selectedDetail = order?.bindingDetails.find((detail) => detail.detailId === detailState.bindingDetailId)
    || order?.bindingDetails[0]
  const availableHandoverQty = order ? Math.max(order.actualOutputQty - (order.handedOverQty || 0), 0) : 0
  const remainingReceiveQty = order ? Math.max(order.requiredMaterialLength - order.receivedMaterialLength, 0) : 0
  const detailRemainingProcessQty = selectedDetail ? getBindingDetailAvailableProcessQty(selectedDetail) : 0
  const physicalScanAction: PdaPhysicalScanAction | null = surface === 'HANDOVER_RECEIVE'
    ? 'RECEIVE'
    : surface === 'HANDOVER_HANDOUT'
      ? 'HANDOUT'
      : null
  const physicalScanContext = order && physicalScanAction
    ? getPdaPhysicalScanContext('BINDING_PROCESS_ORDER', order.bindingOrderId, physicalScanAction)
    : null
  const physicalScanLines = physicalScanContext ? listPdaPhysicalScanDraftLines(physicalScanContext) : []
  const actionButtons = !order || !canOpen
    ? ''
    : surface === 'HANDOVER_RECEIVE'
      ? (order.status === '待加工' || order.status === '加工中') && remainingReceiveQty > 0
        ? `<button type="button" class="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50" data-pda-execd-action="binding-confirm-receive" data-work-order-id="${escapeHtml(order.bindingOrderId)}" data-confirmation-key="${escapeHtml(`PDA:${order.bindingOrderId}:receive:${order.actionRecords?.length || 0}`)}" ${physicalScanLines.length ? '' : 'disabled title="请先扫描或输入本批面料标签"'}>确认本批接收（${physicalScanLines.length} 张）</button>`
        : '<div class="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">当前没有可接收数量</div>'
      : surface === 'HANDOVER_HANDOUT'
        ? availableHandoverQty > 0
          ? `<button type="button" class="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50" data-pda-execd-action="binding-submit-handover" data-work-order-id="${escapeHtml(order.bindingOrderId)}" data-confirmation-key="${escapeHtml(`PDA:${order.bindingOrderId}:handover:${order.actionRecords?.length || 0}`)}" ${physicalScanLines.length ? '' : 'disabled title="请先扫描或输入本批捆条标签"'}>确认本批交出（${physicalScanLines.length} 张）</button>`
          : '<div class="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">当前没有已加工未交出的捆条</div>'
        : order.status === '加工中'
          ? `<div class="grid ${order.actualOutputQty > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-2"><button type="button" class="h-11 rounded-md bg-primary text-sm font-semibold text-primary-foreground" data-pda-execd-action="binding-process-report" data-work-order-id="${escapeHtml(order.bindingOrderId)}" data-confirmation-key="${escapeHtml(`PDA:${order.bindingOrderId}:process:${order.actionRecords?.length || 0}`)}">加工填报</button>${order.actualOutputQty > 0 ? `<button type="button" class="h-11 rounded-md border text-sm font-semibold" data-pda-execd-action="binding-complete-order" data-work-order-id="${escapeHtml(order.bindingOrderId)}" data-confirmation-key="${escapeHtml(`PDA:${order.bindingOrderId}:complete:${order.actionRecords?.length || 0}`)}">完成加工单</button>` : ''}</div>`
          : order.status === '已完成'
            ? '<div class="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">该捆条加工单已完成</div>'
            : '<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">请先到交接模块确认接收面料</div>'
  const qtyLabel = surface === 'HANDOVER_RECEIVE'
    ? `本次实收面料（剩余 ${remainingReceiveQty} 米）`
    : surface === 'HANDOVER_HANDOUT'
      ? `本次交出捆条（可交 ${availableHandoverQty} 米）`
      : `本次加工／交出米数（本规格可加工 ${detailRemainingProcessQty} 米）`
  const title = surface === 'HANDOVER_RECEIVE' ? '捆条 · 确认接收' : surface === 'HANDOVER_HANDOUT' ? '捆条 · 发起交出' : '捆条加工单执行'
  const imageUrl = order?.materialIdentity.materialImageUrl || ''
  const imageTitle = order ? `${order.materialIdentity.materialSku} · ${order.materialIdentity.materialName}` : '捆条面料'
  const content = `<div class="space-y-4 bg-background p-4 pb-6" data-pda-binding-detail>
    <div class="flex items-center gap-2"><button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-pda-execd-action="back"><i data-lucide="arrow-left" class="mr-1 h-4 w-4"></i>返回${isExecution ? '执行' : '交接'}</button><h1 class="text-base font-semibold">${escapeHtml(title)}</h1></div>
    ${canOpen && order ? `<section class="space-y-3" data-testid="pda-work-order-action-panel">
      ${physicalScanContext ? renderPdaPhysicalScanPanel(physicalScanContext) : ''}
      ${isExecution ? `<label class="block text-sm"><span class="font-medium">捆条规格</span><select class="mt-1 h-10 w-full rounded-md border bg-background px-3" data-pda-execd-field="bindingDetailId">${order.bindingDetails.map((detail) => `<option value="${escapeHtml(detail.detailId)}" ${detail.detailId === selectedDetail?.detailId ? 'selected' : ''}>${escapeHtml(detail.bindingStripName)} · ${detail.bindingWidth} cm · ${escapeHtml(detail.cuttingMethod)}</option>`).join('')}</select></label><label class="block text-sm"><span class="font-medium">${escapeHtml(qtyLabel)}</span><span class="mt-1 flex items-center gap-2"><input type="number" min="0.01" step="0.01" inputmode="decimal" class="h-10 min-w-0 flex-1 rounded-md border bg-background px-3" data-pda-execd-field="bindingQty" value="${escapeHtml(detailState.bindingQty)}" placeholder="填写本次数量"><strong>米</strong></span></label>` : ''}
      ${isExecution ? `<label class="block text-sm"><span class="font-medium">短裁原因</span><textarea class="mt-1 min-h-16 w-full rounded-md border bg-background px-3 py-2" data-pda-execd-field="bindingRemark" placeholder="仅短裁完成时填写">${escapeHtml(detailState.bindingRemark)}</textarea></label>` : ''}
      ${actionButtons}
    </section>` : '<section class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">加工单不存在或不属于当前登录裁床工厂，已阻断操作。</section>'}
    ${order ? `<details class="rounded-lg border bg-card" data-testid="pda-work-order-details"><summary class="cursor-pointer px-3 py-3 text-sm font-semibold">加工单详情</summary><div class="space-y-3 border-t p-3"><div class="flex gap-3">${imageUrl ? `<button type="button" class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30" data-pda-image-preview-url="${escapeHtml(imageUrl)}" data-pda-image-preview-title="${escapeHtml(imageTitle)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(imageTitle)}大图"><img class="h-full w-full object-cover" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageTitle)}物料图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>` : '<div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border bg-muted/30"><span class="px-1 text-center text-xs text-muted-foreground">物料图缺失</span></div>'}<div class="min-w-0 flex-1 text-xs"><div class="text-sm font-semibold">${escapeHtml(order.bindingOrderNo)}</div><div class="mt-1">${escapeHtml(order.sourceProductionOrderNo)} · ${escapeHtml(order.materialIdentity.materialSku)}</div><div class="mt-1">${escapeHtml(order.factoryName)} · ${escapeHtml(order.status)}</div><div class="mt-1 break-all text-muted-foreground">加工单 ID：${escapeHtml(order.bindingOrderId)}</div><div class="mt-1 break-all text-muted-foreground">来源任务 ID：${escapeHtml(order.sourceTaskId)}</div></div></div><div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs"><span>计划：${order.plannedOutputQty} 米</span><span>面料实收：${order.receivedMaterialLength} 米</span><span>累计加工：${order.actualOutputQty} 米</span><span>累计交出：${order.handedOverQty || 0} 米</span><span>规格：${order.bindingSpecificationCount} 个</span><span>差异：${order.differenceStatus}</span></div><div class="space-y-2">${order.bindingDetails.map((detail) => `<div class="rounded border bg-background px-2 py-2 text-xs"><div class="font-medium">${escapeHtml(detail.bindingStripName)} · ${detail.bindingWidth} cm · ${escapeHtml(detail.cuttingMethod)}</div><div class="mt-1">菲票：${escapeHtml(detail.feiTicketNo)}；计划 ${detail.plannedBindingLength} 米；实收 ${detail.receivedMaterialLength} 米；已加工 ${detail.actualLength} 米</div></div>`).join('')}</div><a class="inline-flex text-xs text-blue-700 underline" href="/fcs/craft/cutting/binding-fei-tickets" data-nav="/fcs/craft/cutting/binding-fei-tickets">查看／打印捆条菲票</a></div></details>` : ''}
  </div>`
  return renderPdaFrame(content, isExecution ? 'exec' : 'handover', { headerTitle: title, disableTodoAutoOpen: true })
}

export function renderPdaWorkOrderExecDetailPage(sourceType: string, workOrderId: string): string {
  if (sourceType === 'BINDING_PROCESS_ORDER') {
    return renderBindingFocusedDetailPage(workOrderId)
  }
  if (sourceType !== 'SPECIAL_CRAFT') {
    return renderPdaFrame(
      '<section class="m-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">不支持的加工单类型，请重新扫码。</section>',
      'exec',
      { disableTodoAutoOpen: true },
    )
  }
  const candidate = getSpecialCraftPdaCandidateByWorkOrderId(workOrderId)
  const task = candidate?.sourceTaskId ? getTaskFactById(candidate.sourceTaskId) : null
  if (!candidate || !task || candidate.order.sourceTaskId !== task.taskId) {
    return renderPdaFrame(
      '<section class="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">加工单不存在，或加工单与来源任务关系不完整；已阻断操作。</section>',
      'exec',
      { disableTodoAutoOpen: true },
    )
  }
  return renderSpecialCraftFocusedDetailPage(task, workOrderId)
}

export function renderPdaExecDetailPage(taskId: string): string {
  syncWaterActionScope(taskId)
  syncPdaStartRiskAndExceptions()
  syncMilestoneOverdueExceptions()

  const task = getTaskFactById(taskId)
  if (task && getMobileTaskProcessType(task) === 'WOOL') {
    const session = getPdaSession()
    const woolAccess = validateWoolPdaTaskAccess({
      taskId: task.taskId,
      currentFactoryId: session?.factoryId,
    })
    return renderPdaFrame(
      renderPdaWoolExecutionContent(task.taskId, woolAccess),
      'exec',
      { disableTodoAutoOpen: true },
    )
  }

  if (task && getMobileTaskProcessType(task) === 'SPECIAL_CRAFT') {
    const candidates = getSpecialCraftPdaCandidatesByTaskId(task.taskId)
    if (candidates.length === 1) {
      const targetPath = `/fcs/pda/exec/${candidates[0].sourceType}/${encodeURIComponent(candidates[0].workOrderId)}`
      queueMicrotask(() => appStore.navigate(targetPath))
      return renderPdaFrame('<section class="m-4 rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">正在进入具体加工单…</section>', 'exec', { disableTodoAutoOpen: true })
    }
    return renderPdaFrame('<section class="m-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">该任务包含多张加工单，请返回列表或重新扫描具体加工单；系统不会代选第一张。</section>', 'exec', { disableTodoAutoOpen: true })
  }

  const waterSolubleOrder = task ? getWaterSolubleWorkOrderByTaskId(task.taskId) : null
  if (task && waterSolubleOrder) {
    const session = getPdaSession()
    if (
      !session
      || !task.assignedFactoryId
      || session.factoryId !== task.assignedFactoryId
      || session.factoryId !== waterSolubleOrder.factoryId
    ) {
      return renderWaterSolubleAccessDenied()
    }
    return renderPdaWaterSolubleDetail(waterSolubleOrder)
  }

  if (task && isCuttingSpecialTask(task)) {
    return renderPdaCuttingTaskDetailPage(taskId, { backHref: resolveExecDetailBackHref(task) })
  }

  if (task?.processCode === 'SEWING_POST') {
    const sewingPostTask = getSewingFactoryPostTaskById(task.taskId)
    if (sewingPostTask) {
      return renderPdaSewingPostTaskPage(taskId, sewingPostTask)
    }
  }

  if (task?.processCode === 'POST_FINISHING') {
    const postTask = getPostFinishingTaskById(task.taskId)
    if (postTask) {
      return renderPdaPostFinishingTaskPage(taskId, postTask)
    }
    const postOrder = getPostFinishingWorkOrderForMobile(task.taskId)
    if (postOrder) {
      return renderPdaPostFinishingExecutionPage(taskId, postOrder)
    }
  }

  if (!task) {
    const sewingPostTask = getSewingFactoryPostTaskById(taskId)
    if (sewingPostTask) {
      return renderPdaSewingPostTaskPage(taskId, sewingPostTask)
    }
    const postTask = getPostFinishingTaskById(taskId)
    if (postTask) {
      return renderPdaPostFinishingTaskPage(taskId, postTask)
    }
    const postOrder = getPostFinishingWorkOrderForMobile(taskId)
    if (postOrder) {
      return renderPdaPostFinishingExecutionPage(taskId, postOrder)
    }
    const content = `
      <div class="flex min-h-[760px] flex-col bg-background">
        <div class="p-4">
          <button class="inline-flex items-center rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted" data-pda-execd-action="back">
            <i data-lucide="arrow-left" class="mr-1 h-4 w-4"></i>
            返回
          </button>
        </div>
        <div class="flex flex-1 items-center justify-center text-sm text-muted-foreground">任务不存在</div>
      </div>
    `

    return renderPdaFrame(content, 'exec', { disableTodoAutoOpen: true })
  }

  const currentPdaSession = getPdaSession()
  const currentFactoryId = currentPdaSession?.factoryId || task.assignedFactoryId || TEST_FACTORY_ID

  if (isKolGotoWholeOrderTask(task)) {
    return renderKolGotoPdaExecPage(task.taskId)
  }

  if (task.taskUnitType === 'MERGED_PRODUCTION_TASK') {
    return renderPdaFixedMergedTaskPage(task as FixedMergedPdaTask, currentFactoryId)
  }

  syncDialogStateWithQuery(task)

  const status = task.status || 'NOT_STARTED'
  const prereq = getStartPrerequisite(task)
  const deadline = getDeadlineStatus(
    (task as ProcessTask & { taskDeadline?: string }).taskDeadline,
    task.finishedAt,
  )

  let mobileTaskAccess = getMobileTaskAccessResult(task, currentFactoryId)
  const canExecuteGarmentWarehouseOutbound = canCurrentPdaSessionExecuteGarmentWarehouseOutbound(task)
  if (canExecuteGarmentWarehouseOutbound) {
    mobileTaskAccess = {
      ...mobileTaskAccess,
      canOpenMobileExecution: true,
      canExecuteInMobile: true,
      reasonLabel: '成衣仓账号可执行逐 SKU 出库',
      suggestedAction: '',
    }
  } else if (
    getMobileTaskProcessType(task) === 'SPECIAL_CRAFT'
    && (!currentPdaSession || !canFactoryAccessSpecialCraftPdaTask(currentFactoryId, task))
  ) {
    mobileTaskAccess = {
      ...mobileTaskAccess,
      canOpenMobileExecution: false,
      canExecuteInMobile: false,
      reasonCode: 'TASK_NOT_VISIBLE_IN_MOBILE_LIST',
      reasonLabel: currentPdaSession ? '当前工厂无该特殊工艺加工权限' : '请先登录工厂端移动应用',
      suggestedAction: currentPdaSession ? '请切换到对应辅助工艺或特种工艺工厂账号后查看' : '登录后再执行任务',
    }
  }
  const mobileProcessType = getMobileTaskProcessType(task)
  const isPreparationExecutionTask = mobileProcessType === 'PRINT' || mobileProcessType === 'DYE' || mobileProcessType === 'WATER_SOLUBLE'
  const canStart = status === 'NOT_STARTED'
    && prereq.met
    && mobileTaskAccess.canExecuteInMobile
    && !isPreparationExecutionTask
  const canFinish = status === 'IN_PROGRESS' && mobileTaskAccess.canExecuteInMobile
  const startRule = getTaskStartRuleState(task)
  const startDueInfo = getTaskStartDueInfo(task)
  const milestone = getTaskMilestoneState(task)
  const milestoneDisplayUnitLabel = getMilestoneDisplayUnitLabel(task, milestone.targetUnitLabel)
  const pauseHandleStatus = getPauseHandleStatus(task)
  const startDueAt = startDueInfo.startDueAt || '—'
  const startSourceText = formatStartDueSourceText(startDueInfo.startDueSource, startRule.dueHours)
  const milestoneProofTitle =
    milestone.proofRequirement === 'NONE'
      ? '关键节点凭证（当前配置：不要求凭证）'
      : `关键节点凭证（当前配置：${milestone.proofRequirementLabel}）`
  const startProofTitle =
    startRule.proofRequirement === 'NONE'
      ? '开工凭证（当前配置：不要求凭证）'
      : `开工凭证（当前配置：${startRule.proofRequirementLabel}）`
  const startProofHint =
    startRule.proofRequirement === 'NONE'
      ? '当前配置不要求开工凭证，可按现场需要补充上传'
      : `当前开工配置要求：${startRule.proofRequirementLabel}`
  const startRiskText =
    startDueInfo.startRiskStatus === 'OVERDUE'
      ? '开工已逾期'
      : startDueInfo.startRiskStatus === 'DUE_SOON' && typeof startDueInfo.remainingMs === 'number'
        ? `距开工时限不足 ${formatRemainingHours(startDueInfo.remainingMs)} 小时`
        : '开工时限正常'

  const statusLabelMap: Record<string, string> = {
    NOT_STARTED: '待开工',
    IN_PROGRESS: '进行中',
    BLOCKED: '生产暂停',
    DONE: '已完工',
    CANCELLED: '已取消',
  }

  const statusColorMap: Record<string, string> = {
    NOT_STARTED: 'bg-gray-100 text-gray-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    BLOCKED: 'bg-red-100 text-red-700',
    DONE: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
  }

  const assignedFactory = task.assignedFactoryId
    ? getFactoryMasterRecordById(task.assignedFactoryId)
    : undefined
  const pauseReasonLabel = (task as ProcessTask & { pauseReasonLabel?: string | null }).pauseReasonLabel || ''
  const pauseReportedAt = (task as ProcessTask & { pauseReportedAt?: string | null }).pauseReportedAt || ''
  const displayProcessName = getTaskProcessDisplayName(task)
  const isSpecialCraftTaskForPda = isSpecialCraftExecutionTask(task, displayProcessName)
  const sourceInfo = getMobileExecutionTaskSourceInfo(task)
  const taskTabKey = getMobileTaskTabKey(task)
  const taskTabLabel = MOBILE_EXECUTION_TASK_TAB_LABELS[taskTabKey]
  const qtyDisplayMeta = resolveTaskQtyDisplayMeta(task, displayProcessName)
  const handoverOrder = getTaskHandoverOrder(task as TaskWithHandoverFields)
  const printWorkOrder = getPrintWorkOrderByTaskId(task.taskId)
  const dyeWorkOrder = getDyeWorkOrderByTaskId(task.taskId)
  const activeDetailDialog = getCurrentSearchParams().get('action')
  const isStartDialogOpen = activeDetailDialog === 'start'
  const isMilestoneDialogOpen = activeDetailDialog === 'milestone'
  const isPauseDialogOpen = activeDetailDialog === 'pause'
  const taskQrValue = getTaskQrValue(task as TaskWithHandoverFields)
  const receiverDisplayText = getReceiverDisplayText(task as TaskWithHandoverFields)
  const currentFactoryDisplay = assignedFactory
    ? formatFactoryDisplayName(assignedFactory.name, assignedFactory.code || assignedFactory.id)
    : sourceInfo.factoryDisplayName
  const specialCraftExecutionPanel = mobileTaskAccess.canOpenMobileExecution && getMobileTaskProcessType(task) === 'SPECIAL_CRAFT'
    ? renderSpecialCraftExecutionPanel(task, status, displayProcessName)
    : ''
  const accessNoticeMeta = getExecDetailAccessNotice(mobileTaskAccess)
  const accessNotice = accessNoticeMeta
    ? `
        <section class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <div class="font-medium">${escapeHtml(accessNoticeMeta.title)}</div>
          ${accessNoticeMeta.lines.map((line) => `<div class="mt-1">${escapeHtml(line)}</div>`).join('')}
        </section>
      `
    : ''
  const renderStartInfoBody = (): string => `
    <div class="space-y-3 p-4 text-sm">
      <div class="grid grid-cols-2 gap-x-4 gap-y-1">
        <span class="text-xs text-muted-foreground">当前状态</span>
        <span class="inline-flex w-fit items-center rounded px-2 py-0.5 text-xs ${statusColorMap[status] ?? 'bg-muted text-muted-foreground'}">${escapeHtml(statusLabelMap[status] ?? status)}</span>
        <span class="text-xs text-muted-foreground">开工要求</span>
        <span class="text-xs font-medium">${escapeHtml(startRule.ruleLabel)}</span>
        <span class="text-xs text-muted-foreground">开工凭证要求</span>
        <span class="text-xs">${escapeHtml(startRule.proofRequirementLabel)}</span>
        <span class="text-xs text-muted-foreground">开工时限</span>
        <span class="text-xs font-medium ${startDueInfo.startRiskStatus === 'OVERDUE' ? 'text-red-700' : startDueInfo.startRiskStatus === 'DUE_SOON' ? 'text-amber-700' : ''}">${escapeHtml(startDueAt)}</span>
        <span class="text-xs text-muted-foreground">起算依据</span>
        <span class="text-xs">${escapeHtml(startSourceText)}</span>
        <span class="text-xs text-muted-foreground">时限状态</span>
        <span class="text-xs font-medium ${startDueInfo.startRiskStatus === 'OVERDUE' ? 'text-red-700' : startDueInfo.startRiskStatus === 'DUE_SOON' ? 'text-amber-700' : 'text-foreground'}">${escapeHtml(startRiskText)}</span>
        <span class="text-xs text-muted-foreground">开工时间</span>
        <span class="text-xs">${escapeHtml(task.startedAt || toStoreDateTime(detailState.startTime) || '—')}</span>
        <span class="text-xs text-muted-foreground">完工时间</span>
        <span class="text-xs">${escapeHtml(task.finishedAt || '—')}</span>
        ${
          handoverOrder
            ? `
                <span class="text-xs text-muted-foreground">交出状态</span>
                <span class="text-xs font-medium">${escapeHtml(getHandoverOrderStatusLabel(handoverOrder.handoverOrderStatus))}</span>
              `
            : ''
        }
      </div>

      ${
        startDueInfo.startRiskStatus === 'OVERDUE'
          ? '<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">开工已逾期，请立即补录开工信息</div>'
          : ''
      }

      ${
        task.blockReason
          ? `
              <div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs">
                <div class="flex items-center gap-1.5 font-medium text-red-700">
                  <i data-lucide="alert-triangle" class="h-3.5 w-3.5"></i>
                  已上报暂停：${escapeHtml((task as ProcessTask & { pauseReasonLabel?: string | null }).pauseReasonLabel || blockReasonLabel(task.blockReason))}
                </div>
                ${task.blockRemark ? `<p class="mt-1 pl-5 text-red-600">${escapeHtml(task.blockRemark)}</p>` : ''}
                <p class="mt-1 pl-5 text-muted-foreground">平台允许继续前，当前任务不可继续操作</p>
              </div>
            `
          : ''
      }

      ${
        status === 'NOT_STARTED'
          ? `
              <div class="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div class="grid grid-cols-1 gap-3">
                  <label class="space-y-1">
                    <span class="text-xs text-muted-foreground">开工时间 *</span>
                    <input
                      type="datetime-local"
                      class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      data-pda-execd-field="startTime"
                      value="${escapeHtml(detailState.startTime)}"
                    />
                  </label>
                </div>
              </div>
              <div class="rounded-lg border">
                <div class="border-b px-3 py-2 text-sm font-medium">${escapeHtml(startProofTitle)}</div>
                <div class="p-3">
                  ${renderProofUploadSection(detailState.startProofFiles, 'start', startProofHint)}
                </div>
              </div>
            `
          : `
              <div class="rounded-lg border">
                <div class="border-b px-3 py-2 text-sm font-medium">开工凭证</div>
                <div class="p-3">
                  ${renderProofViewSection(detailState.startProofFiles)}
                </div>
              </div>
            `
      }
    </div>
  `
  const renderStartInfoDialog = (): string => `
    <div class="fixed inset-0 z-[130] flex items-end bg-black/40 p-0 sm:items-center sm:p-4">
      <section class="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border bg-background shadow-2xl sm:mx-auto sm:max-w-2xl sm:rounded-lg">
        <header class="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <i data-lucide="clock" class="h-4 w-4"></i>
            开工信息
          </h2>
          <button type="button" class="rounded-md border px-2 py-1 text-xs" data-pda-execd-action="close-detail-dialog">关闭</button>
        </header>
        ${renderStartInfoBody()}
        ${
          status === 'NOT_STARTED'
            ? `
                <footer class="sticky bottom-0 z-10 flex gap-2 border-t bg-background p-4">
                  <button type="button" class="h-9 flex-1 rounded-md border text-sm" data-pda-execd-action="close-detail-dialog">取消</button>
                  <button
                    type="button"
                    class="h-9 flex-1 rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                    data-pda-execd-action="confirm-start"
                    data-task-id="${escapeHtml(task.taskId)}"
                    ${canStart ? '' : 'disabled'}
                  >
                    确认开工
                  </button>
                </footer>
              `
            : `
                <footer class="sticky bottom-0 z-10 flex justify-end border-t bg-background p-4">
                  <button type="button" class="h-9 rounded-md border px-4 text-sm" data-pda-execd-action="close-detail-dialog">关闭</button>
                </footer>
              `
        }
      </section>
    </div>
  `
  const renderDetailAuxiliaryButtons = (): string => {
    const buttons: string[] = []

    if (status !== 'NOT_STARTED') {
      buttons.push(`
        <button
          type="button"
          class="inline-flex h-9 items-center justify-center rounded-md border text-sm hover:bg-muted"
          data-pda-execd-action="open-start-dialog"
        >
          <i data-lucide="clock" class="mr-2 h-4 w-4"></i>
          开工信息
        </button>
      `)
    }

    if (milestone.required && (status === 'IN_PROGRESS' || milestone.status === 'REPORTED')) {
      buttons.push(`
        <button
          type="button"
          class="inline-flex h-9 items-center justify-center rounded-md border text-sm hover:bg-muted"
          data-pda-execd-action="open-milestone-dialog"
        >
          <i data-lucide="flag" class="mr-2 h-4 w-4"></i>
          ${milestone.status === 'REPORTED' ? '查看关键节点' : '关键节点上报'}
        </button>
      `)
    }

    if (status === 'IN_PROGRESS' || status === 'BLOCKED') {
      buttons.push(`
        <button
          type="button"
          class="inline-flex h-9 items-center justify-center rounded-md border text-sm hover:bg-muted"
          data-pda-execd-action="open-pause-dialog"
        >
          <i data-lucide="pause-circle" class="mr-2 h-4 w-4"></i>
          ${status === 'BLOCKED' ? '查看暂停' : '上报暂停'}
        </button>
      `)
    }

    if (buttons.length === 0) return ''

    return `
      <div class="${buttons.length > 1 ? 'grid grid-cols-2 gap-2' : 'space-y-2'}">
        ${buttons.join('')}
      </div>
    `
  }

  const taskDisplayNo = getTaskDisplayNo(task)
  const sourceObjectNo = sourceInfo.sourceWorkOrderNo
    || sourceInfo.workOrderNo
    || sourceInfo.printOrderNo
    || sourceInfo.dyeOrderNo
    || sourceInfo.cuttingOrderNo
    || sourceInfo.postOrderNo
    || sourceInfo.taskOrderNo
  const sourceObjectType = getPdaSourceObjectType(sourceInfo)

  const content = `
    <div class="space-y-4 bg-background p-4 pb-6">
      ${accessNotice}
      <div class="flex items-center gap-2">
        <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-pda-execd-action="back">
          <i data-lucide="arrow-left" class="mr-1 h-4 w-4"></i>
          返回执行列表
        </button>
        <h1 class="text-base font-semibold">任务详情</h1>
      </div>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <div class="flex items-center justify-between gap-2 text-sm">
            <span class="font-semibold">${renderPdaObjectCode({
              objectType: 'PROCESS_DOC',
              objectId: taskDisplayNo,
              relatedProductionOrderNo: task.productionOrderId,
              className: 'text-left font-mono text-blue-600 hover:underline',
            })}</span>
            <span class="inline-flex items-center rounded px-2 py-0.5 text-xs ${statusColorMap[status] ?? 'bg-muted text-muted-foreground'}">${escapeHtml(statusLabelMap[status] ?? status)}</span>
          </div>
        </header>

        <div class="space-y-3 p-4 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <span class="text-xs text-muted-foreground">生产单号</span>
            <span class="text-xs font-medium">${renderPdaObjectCode({
              objectType: 'PRODUCTION_ORDER',
              objectId: task.productionOrderId,
            })}</span>
            <span class="text-xs text-muted-foreground">加工单 / 来源单号</span>
            <span class="text-xs font-medium">${
              sourceObjectNo
                ? renderPdaObjectCode({
                    objectType: sourceObjectType,
                    objectId: sourceObjectNo,
                    relatedProductionOrderNo: task.productionOrderId,
                  })
                : '—'
            }</span>
            <span class="text-xs text-muted-foreground">原始任务</span>
            <span class="text-xs font-medium">${renderPdaObjectCode({
              objectType: 'PROCESS_DOC',
              objectId: getRootTaskDisplayNo(task),
              relatedProductionOrderNo: task.productionOrderId,
            })}</span>
            <span class="text-xs text-muted-foreground">当前工序</span>
            <span class="text-xs font-medium">${escapeHtml(displayProcessName)}</span>
            <span class="text-xs text-muted-foreground">覆盖工序</span>
            <span class="text-xs font-medium">${escapeHtml(getCoveredProcessSummaryText(task))}</span>
            <span class="text-xs text-muted-foreground">所在列表</span>
            <span class="text-xs font-medium">${escapeHtml(taskTabLabel)}</span>
            <span class="text-xs text-muted-foreground">${escapeHtml(qtyDisplayMeta.label)}</span>
            <span class="text-xs font-medium">${escapeHtml(qtyDisplayMeta.valueText)}</span>
            ${
              currentFactoryDisplay
                ? `
                    <span class="text-xs text-muted-foreground">当前工厂</span>
                    <span class="text-xs font-medium">${escapeHtml(currentFactoryDisplay)}</span>
                  `
                : ''
            }
            <span class="text-xs text-muted-foreground">派发方式</span>
            <span class="text-xs">${task.assignmentMode === 'DIRECT' ? '直接派发' : '分配接收'}</span>
            <span class="text-xs text-muted-foreground">接收方</span>
            <span class="text-xs">${escapeHtml(receiverDisplayText)}</span>
            ${
              (task as ProcessTask & { taskDeadline?: string }).taskDeadline
                ? `
                    <span class="text-xs text-muted-foreground">任务截止时间</span>
                    <span class="text-xs font-medium ${
                      deadline?.label === '执行逾期'
                        ? 'text-red-700'
                        : deadline?.label === '即将逾期'
                          ? 'text-amber-700'
                          : ''
                    }">${escapeHtml((task as ProcessTask & { taskDeadline?: string }).taskDeadline || '')}</span>
                  `
                : ''
            }
          </div>

          ${
            deadline
              ? `
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-muted-foreground">时限状态:</span>
                    <span class="inline-flex items-center rounded px-2 py-0.5 text-xs ${deadline.badgeClass}">${escapeHtml(deadline.label)}</span>
                  </div>
                `
              : ''
          }

          <div class="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-3">
            <div class="space-y-1">
              <div class="text-xs font-medium">任务二维码</div>
              <div class="text-[11px] text-muted-foreground">${escapeHtml(getTaskDisplayNo(task))}</div>
            </div>
            ${renderRealQrPlaceholder({
              value: taskQrValue,
              size: 96,
              title: `任务二维码 ${getTaskDisplayNo(task)}`,
              label: `任务 ${getTaskDisplayNo(task)} 二维码`,
              className: 'rounded-md border bg-white p-1.5 shadow-sm',
            })}
          </div>
        </div>
      </article>

      ${handoverOrder ? renderHandoverOrderCard(handoverOrder) : ''}
      ${renderPdaSewingDeliveryProgress(getSewingDeliverySlaView(task.taskId), getQtyUnitLabel(task.qtyUnit))}
      ${mobileTaskAccess.canOpenMobileExecution && printWorkOrder ? renderPrintingTaskCard(task as TaskWithHandoverFields, printWorkOrder, handoverOrder) : ''}
      ${mobileTaskAccess.canOpenMobileExecution && dyeWorkOrder ? renderDyeingTaskCard(task as TaskWithHandoverFields, dyeWorkOrder, handoverOrder) : ''}
      ${specialCraftExecutionPanel}

      ${
        isMilestoneDialogOpen
          ? `
              <div class="fixed inset-0 z-[130] flex items-end bg-black/40 p-0 sm:items-center sm:p-4">
                <section class="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border bg-background shadow-2xl sm:mx-auto sm:max-w-2xl sm:rounded-lg">
                  <header class="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3">
                    <h2 class="flex items-center gap-2 text-sm font-semibold">
                      <i data-lucide="flag" class="h-4 w-4"></i>
                      关键节点上报
                    </h2>
                    <button type="button" class="rounded-md border px-2 py-1 text-xs" data-pda-execd-action="close-detail-dialog">关闭</button>
                  </header>
                <div class="space-y-3 p-4 text-sm">
                  <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span class="text-xs text-muted-foreground">规则名称</span>
                    <span class="text-xs font-medium">${escapeHtml(milestone.ruleLabel)}</span>
                    <span class="text-xs text-muted-foreground">当前状态</span>
                    <span class="text-xs font-medium ${milestone.status === 'REPORTED' ? 'text-green-700' : 'text-amber-700'}">${milestone.status === 'REPORTED' ? '已上报' : '待上报'}</span>
                    <span class="text-xs text-muted-foreground">${escapeHtml(getReportedQtyLabel(milestoneDisplayUnitLabel))}</span>
                    <span class="text-xs">${escapeHtml(String(milestone.status === 'REPORTED' ? (milestone.reportedQty ?? milestone.targetQty) : milestone.targetQty))} ${escapeHtml(milestoneDisplayUnitLabel)}</span>
                    <span class="text-xs text-muted-foreground">上报时间</span>
                    <span class="text-xs">${escapeHtml(milestone.reportedAt || toStoreDateTime(detailState.milestoneTime) || '—')}</span>
                  </div>

                  ${
                    milestone.status === 'REPORTED'
                      ? `
                          <div class="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">关键节点已上报，可继续执行后续动作</div>
                          <div class="rounded-lg border">
                            <div class="border-b px-3 py-2 text-sm font-medium">关键节点凭证</div>
                            <div class="p-3">
                              ${renderProofViewSection(task.milestoneProofFiles || detailState.milestoneProofFiles)}
                            </div>
                          </div>
                        `
                      : status === 'IN_PROGRESS'
                        ? `
                            <div class="rounded-md border border-slate-200 bg-slate-50 p-3">
                              <label class="space-y-1">
                                <span class="text-xs text-muted-foreground">上报时间 *</span>
                                <input
                                  type="datetime-local"
                                  class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                                  data-pda-execd-field="milestoneTime"
                                  value="${escapeHtml(detailState.milestoneTime)}"
                                />
                              </label>
                              <p class="mt-2 text-xs text-muted-foreground">上报数量按规则固定为 ${milestone.targetQty} ${escapeHtml(milestoneDisplayUnitLabel)}</p>
                            </div>
                            <div class="rounded-lg border">
                              <div class="border-b px-3 py-2 text-sm font-medium">${escapeHtml(milestoneProofTitle)}</div>
                              <div class="p-3">
                                ${renderProofUploadSection(detailState.milestoneProofFiles, 'milestone', getTaskMilestoneProofHint(task))}
                              </div>
                            </div>
                            <button
                              class="inline-flex h-9 w-full items-center justify-center rounded-md border bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
                              data-pda-execd-action="report-milestone"
                              data-task-id="${escapeHtml(task.taskId)}"
                            >
                              确认上报
                            </button>
                          `
                        : '<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">任务不在进行中，暂不可上报关键节点</div>'
                  }
                </div>
                </section>
              </div>
            `
          : ''
      }

      ${
        isPauseDialogOpen
          ? `
            <div class="fixed inset-0 z-[130] flex items-end bg-black/40 p-0 sm:items-center sm:p-4">
              <section class="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border bg-background shadow-2xl sm:mx-auto sm:max-w-2xl sm:rounded-lg">
                <header class="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3">
                  <h2 class="flex items-center gap-2 text-sm font-semibold">
                    <i data-lucide="pause-circle" class="h-4 w-4"></i>
                    上报暂停
                  </h2>
                  <button type="button" class="rounded-md border px-2 py-1 text-xs" data-pda-execd-action="close-detail-dialog">关闭</button>
                </header>

              <div class="space-y-3 p-4 text-sm">
                ${
                  status === 'BLOCKED'
                    ? `
                        <div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs">
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="font-medium text-red-700">${escapeHtml(pauseReasonLabel || '已上报暂停')}</span>
                            <span class="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] ${pauseHandleStatus.className}">${pauseHandleStatus.label}</span>
                          </div>
                          ${task.pauseRemark ? `<p class="mt-1 text-red-600">${escapeHtml(task.pauseRemark)}</p>` : ''}
                          ${pauseReportedAt ? `<p class="mt-1 text-muted-foreground">上报时间：${escapeHtml(pauseReportedAt)}</p>` : ''}
                          <p class="mt-1 text-muted-foreground">平台允许继续前，当前任务不可继续操作</p>
                        </div>
                        <div class="rounded-lg border">
                          <div class="border-b px-3 py-2 text-sm font-medium">暂停凭证</div>
                          <div class="p-3">
                            ${renderProofViewSection(task.pauseProofFiles || detailState.pauseProofFiles)}
                          </div>
                        </div>
                      `
                    : status === 'IN_PROGRESS'
                      ? `
                          ${
                            detailState.fromPauseAction
                              ? '<div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">已定位到上报暂停，请补充信息后提交</div>'
                              : ''
                          }
                          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label class="space-y-1">
                              <span class="text-xs text-muted-foreground">暂停原因 *</span>
                              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pda-execd-field="pauseReasonCode">
                                ${PAUSE_REASON_OPTIONS.map((item) => `<option value="${item.code}" ${detailState.pauseReasonCode === item.code ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
                              </select>
                            </label>
                            <label class="space-y-1">
                              <span class="text-xs text-muted-foreground">上报时间 *</span>
                              <input
                                type="datetime-local"
                                class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                                data-pda-execd-field="pauseTime"
                                value="${escapeHtml(detailState.pauseTime)}"
                              />
                            </label>
                          </div>
                          <label class="space-y-1">
                            <span class="text-xs text-muted-foreground">暂停说明</span>
                            <textarea
                              class="min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                              placeholder="建议填写现场情况，便于平台快速跟进"
                              data-pda-execd-field="pauseRemark"
                            >${escapeHtml(detailState.pauseRemark)}</textarea>
                          </label>
                          <div class="rounded-lg border">
                            <div class="border-b px-3 py-2 text-sm font-medium">相关凭证（至少 1 项）</div>
                            <div class="p-3">
                              ${renderProofUploadSection(detailState.pauseProofFiles, 'pause', '请上传现场凭证，图片或视频至少 1 项')}
                            </div>
                          </div>
                          <button
                            class="inline-flex h-9 w-full items-center justify-center rounded-md border bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
                            data-pda-execd-action="report-pause"
                            data-task-id="${escapeHtml(task.taskId)}"
                          >
                            确认上报暂停
                          </button>
                        `
                      : '<div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-muted-foreground">当前状态不支持上报暂停</div>'
                }
              </div>
              </section>
            </div>
          `
          : ''
      }
      ${isStartDialogOpen ? renderStartInfoDialog() : ''}

      <article class="${isSpecialCraftTaskForPda ? 'hidden' : ''} rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">操作</h2>
        </header>

        <div class="space-y-2 p-4">
          ${
            !mobileTaskAccess.canOpenMobileExecution
              ? '<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">当前任务只允许查看，不显示开始、完工、交出等执行按钮。</div>'
              : ''
          }
          ${
            mobileTaskAccess.canOpenMobileExecution
              && !isPreparationExecutionTask
              && !isSpecialCraftTaskForPda
              ? renderDetailAuxiliaryButtons()
              : ''
          }
          ${
            mobileTaskAccess.canOpenMobileExecution && !isPreparationExecutionTask && !isSpecialCraftTaskForPda && status === 'NOT_STARTED'
              ? prereq.met
                ? `
                    <button
                      class="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      data-pda-execd-action="open-start-dialog"
                      data-task-id="${escapeHtml(task.taskId)}"
                      ${canStart ? '' : 'disabled'}
                    >
                      <i data-lucide="play" class="mr-2 h-4 w-4"></i>
                      开工
                    </button>
                  `
                : `
                    <button class="inline-flex h-9 w-full items-center justify-center rounded-md border border-amber-300 text-sm text-amber-700 hover:bg-amber-50" data-pda-execd-action="go-warehouse">
                      <i data-lucide="arrow-left-right" class="mr-2 h-4 w-4"></i>
                      查看来料状态（来料到仓后即可开工）
                    </button>
                  `
              : ''
          }

          ${
            mobileTaskAccess.canOpenMobileExecution && !isSpecialCraftTaskForPda && status === 'IN_PROGRESS'
              ? `
                  ${
                    printWorkOrder || dyeWorkOrder
                      ? `
                          <button
                            class="inline-flex h-9 w-full items-center justify-center rounded-md border text-sm text-muted-foreground"
                            disabled
                          >
                            ${printWorkOrder ? '印花加工单全部交出后完成' : '染色加工单全部交出后完成'}
                          </button>
                        `
                      : `
                          <button
                            class="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                            data-pda-execd-action="finish-task"
                            data-task-id="${escapeHtml(task.taskId)}"
                            ${canFinish ? '' : 'disabled'}
                          >
                            <i data-lucide="check-circle" class="mr-2 h-4 w-4"></i>
                            完工
                          </button>
                        `
                  }
                  ${
                    handoverOrder
                      ? `
                          ${
                            (printWorkOrder && printWorkOrder.status === 'WAIT_HANDOVER')
                            || (dyeWorkOrder && dyeWorkOrder.status === 'WAIT_HANDOVER')
                              ? `
                                  <div class="grid grid-cols-2 gap-2">
                                    <button
                                      class="inline-flex h-9 items-center justify-center rounded-md border text-sm hover:bg-muted"
                                      data-pda-execd-action="view-handover-order"
                                      data-handover-order-id="${escapeHtml(handoverOrder.handoverOrderId || handoverOrder.handoverId)}"
                                    >
                                      <i data-lucide="arrow-left-right" class="mr-2 h-4 w-4"></i>
                                      查看交出单
                                    </button>
                                    <button
                                      class="inline-flex h-9 items-center justify-center rounded-md border text-sm hover:bg-muted"
                                      data-pda-execd-action="${printWorkOrder ? 'print-submit-handover' : 'dye-submit-handover'}"
                                      data-task-id="${escapeHtml(task.taskId)}"
                                    >
                                      <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
                                      发起交出
                                    </button>
                                  </div>
                                `
                              : `
                                  <button
                                    class="inline-flex h-9 w-full items-center justify-center rounded-md border text-sm hover:bg-muted"
                                    data-pda-execd-action="view-handover-order"
                                    data-handover-order-id="${escapeHtml(handoverOrder.handoverOrderId || handoverOrder.handoverId)}"
                                  >
                                    <i data-lucide="arrow-left-right" class="mr-2 h-4 w-4"></i>
                                    查看交出单
                                  </button>
                                `
                          }
                        `
                      : ''
                  }
                `
              : ''
          }

          ${
            mobileTaskAccess.canOpenMobileExecution && status === 'BLOCKED'
              ? `
                  <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">已上报暂停，待平台处理。平台允许继续后任务将自动恢复进行中。</div>
                  ${
                    handoverOrder
                      ? `
                          <button
                            class="inline-flex h-9 w-full items-center justify-center rounded-md border text-sm hover:bg-muted"
                            data-pda-execd-action="view-handover-order"
                            data-handover-order-id="${escapeHtml(handoverOrder.handoverOrderId || handoverOrder.handoverId)}"
                          >
                            <i data-lucide="arrow-left-right" class="mr-2 h-4 w-4"></i>
                            查看交出单
                          </button>
                        `
                      : ''
                  }
                `
              : ''
          }

          ${
            mobileTaskAccess.canOpenMobileExecution && status === 'DONE'
              ? `
                  ${
                    handoverOrder
                      ? `
                          <div class="grid grid-cols-2 gap-2">
                            <button
                              class="inline-flex h-9 items-center justify-center rounded-md border text-sm hover:bg-muted"
                              data-pda-execd-action="view-handover-order"
                              data-handover-order-id="${escapeHtml(handoverOrder.handoverOrderId || handoverOrder.handoverId)}"
                            >
                              <i data-lucide="arrow-left-right" class="mr-2 h-4 w-4"></i>
                              查看交出单
                            </button>
                            <button
                              class="inline-flex h-9 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
                              data-pda-execd-action="new-handover-record"
                              data-handover-order-id="${escapeHtml(handoverOrder.handoverOrderId || handoverOrder.handoverId)}"
                            >
                              <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
                              新增交出记录
                            </button>
                          </div>
                        `
                      : '<button class="inline-flex h-9 w-full items-center justify-center rounded-md border text-sm text-muted-foreground" disabled>交出单未生成</button>'
                  }
                `
              : ''
          }
        </div>
      </article>

      ${
        task.auditLogs.length > 0
          ? `
              <article class="rounded-lg border bg-card">
                <header class="border-b px-4 py-3">
                  <h2 class="flex items-center gap-2 text-sm font-semibold">
                    <i data-lucide="file-text" class="h-4 w-4"></i>
                    操作日志
                  </h2>
                </header>

                <div class="p-4">
                  <div class="max-h-[160px] space-y-2 overflow-y-auto">
                    ${task.auditLogs
                      .slice(-8)
                      .reverse()
                      .map(
                        (log) => `
                          <article class="border-b pb-1.5 text-xs last:border-b-0">
                            <div class="flex items-center justify-between">
                              <span class="font-medium">${escapeHtml(log.action)}</span>
                              <span class="text-muted-foreground">${escapeHtml(log.at)}</span>
                            </div>
                            ${log.detail ? `<p class="text-muted-foreground">${escapeHtml(log.detail)}</p>` : ''}
                          </article>
                        `,
                      )
                      .join('')}
                  </div>
                </div>
              </article>
            `
          : ''
      }
    </div>
  `

  return renderPdaFrame(content, 'exec', { disableTodoAutoOpen: true })
}

export function handlePdaExecDetailEvent(target: HTMLElement, event?: Event): boolean {
  if (handleKolGotoPdaExecEvent(target)) return true
  if (handlePdaWoolExecutionEvent(target)) return true
  syncWaterActionScope(getCurrentExecDetailTaskId())
  const physicalQtyNode = target.closest<HTMLInputElement>('[data-pda-physical-scan-line-qty]')
  if (physicalQtyNode instanceof HTMLInputElement) {
    const panel = physicalQtyNode.closest<HTMLElement>('[data-pda-physical-scan-panel]')
    const sourceType = panel?.dataset.sourceType as PdaPhysicalScanSourceType | undefined
    const workOrderId = panel?.dataset.workOrderId || ''
    const scanAction = panel?.dataset.scanAction as PdaPhysicalScanAction | undefined
    const scanLineId = physicalQtyNode.dataset.pdaPhysicalScanLineQty || ''
    const qty = Number(physicalQtyNode.value)
    if (sourceType && workOrderId && scanAction && scanLineId) {
      const context = getPdaPhysicalScanContext(sourceType, workOrderId, scanAction)
      if (!context || !panel) return false
      if (!Number.isFinite(qty) || qty <= 0) {
        const message = physicalQtyNode.value ? '本次数量必须大于 0。' : '请填写本次数量。'
        physicalQtyNode.setCustomValidity(message)
        physicalQtyNode.setAttribute('aria-invalid', 'true')
        physicalQtyNode.classList.add('border-red-500')
        setPdaPhysicalScanSubmitState(panel, context, message)
        if (physicalQtyNode.value || event?.type === 'change') showPdaExecDetailToast(message)
        return false
      }
      try {
        updatePdaPhysicalScanLineQty({ sourceType, workOrderId, action: scanAction, scanLineId, qty })
        physicalQtyNode.setCustomValidity('')
        physicalQtyNode.removeAttribute('aria-invalid')
        physicalQtyNode.classList.remove('border-red-500')
        refreshPdaPhysicalScanSummary(panel, context)
        setPdaPhysicalScanSubmitState(panel, context)
      } catch (error) {
        const message = error instanceof Error ? error.message : '本次数量无效'
        physicalQtyNode.setCustomValidity(message)
        physicalQtyNode.setAttribute('aria-invalid', 'true')
        physicalQtyNode.classList.add('border-red-500')
        setPdaPhysicalScanSubmitState(panel, context, message)
        showPdaExecDetailToast(message)
      }
    }
    return false
  }
  const handoverLineNode = target.closest<HTMLInputElement>('[data-pda-execd-handover-line-key]')
  if (handoverLineNode instanceof HTMLInputElement) {
    const draftKey = handoverLineNode.dataset.pdaExecdHandoverLineKey || ''
    if (draftKey) detailState.specialCraftLineHandoverDrafts[draftKey] = handoverLineNode.value
    return true
  }
  const skuFieldNode = target.closest<HTMLInputElement>('[data-pda-execd-sku-field]')
  if (skuFieldNode instanceof HTMLInputElement) {
    const draftKey = skuFieldNode.dataset.draftKey || ''
    const field = skuFieldNode.dataset.pdaExecdSkuField as keyof PdaExecDetailState['specialCraftSkuDrafts'][string] | undefined
    if (draftKey && field) {
      const draft = detailState.specialCraftSkuDrafts[draftKey] || { outboundQty: '0', receivedQty: '0', completedQty: '0', handoverQty: '0', scrapQty: '0', damageQty: '0' }
      draft[field] = skuFieldNode.value
      detailState.specialCraftSkuDrafts[draftKey] = draft
    }
    return true
  }
  const fieldNode = target.closest<HTMLElement>('[data-pda-execd-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.pdaExecdField
    if (!field) return true

    if (field === 'waterCompletedQty') {
      detailState.waterCompletionDraft.completedQty = fieldNode.value
      return true
    }

    if (field === 'waterReason') {
      detailState.waterCompletionDraft.reason = fieldNode.value
      return true
    }

    if (field === 'dyeWaterOutputQty') {
      detailState.dyeWaterDraft.outputQty = fieldNode.value
      return true
    }

    if (field === 'dyeWaterReason') {
      detailState.dyeWaterDraft.reason = fieldNode.value
      return true
    }

    if (field === 'startTime' && fieldNode instanceof HTMLInputElement) {
      detailState.startTime = fieldNode.value
      return true
    }

    if (field === 'startHeadcount' && fieldNode instanceof HTMLInputElement) {
      detailState.startHeadcount = fieldNode.value
      return true
    }

    if (field === 'milestoneTime' && fieldNode instanceof HTMLInputElement) {
      detailState.milestoneTime = fieldNode.value
      return true
    }

    if (field === 'pauseReasonCode' && fieldNode instanceof HTMLSelectElement) {
      detailState.pauseReasonCode = fieldNode.value as PauseReasonCode
      return true
    }

    if (field === 'pauseRemark') {
      detailState.pauseRemark = fieldNode.value
      return true
    }

    if (field === 'pauseTime' && fieldNode instanceof HTMLInputElement) {
      detailState.pauseTime = fieldNode.value
      return true
    }

    if (field === 'specialCraftScrapQty' && fieldNode instanceof HTMLInputElement) {
      detailState.specialCraftScrapQty = fieldNode.value
      return true
    }

    if (field === 'specialCraftDamageQty' && fieldNode instanceof HTMLInputElement) {
      detailState.specialCraftDamageQty = fieldNode.value
      return true
    }

    if (field === 'specialCraftButtonLoopQty' && fieldNode instanceof HTMLInputElement) {
      detailState.specialCraftButtonLoopQty = fieldNode.value
      return true
    }

    if (field === 'specialCraftAccessoryQty' && fieldNode instanceof HTMLInputElement) {
      detailState.specialCraftAccessoryQty = fieldNode.value
      return true
    }

    if (field === 'specialCraftHandoverQty' && fieldNode instanceof HTMLInputElement) {
      detailState.specialCraftHandoverQty = fieldNode.value
      return true
    }

    if (field === 'specialCraftHandoverRemark') {
      detailState.specialCraftHandoverRemark = fieldNode.value
      return true
    }

    if (field === 'bindingDetailId' && fieldNode instanceof HTMLSelectElement) {
      detailState.bindingDetailId = fieldNode.value
      return true
    }

    if (field === 'bindingQty' && fieldNode instanceof HTMLInputElement) {
      detailState.bindingQty = fieldNode.value
      return true
    }

    if (field === 'bindingRemark') {
      detailState.bindingRemark = fieldNode.value
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-execd-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaExecdAction
  if (!action) return false

  if (action === 'back') {
    appStore.navigate(resolveExecDetailBackHref())
    return true
  }

  if (action === 'physical-scan-add') {
    const isEnterKey = event?.type === 'keydown' && (event as KeyboardEvent).key === 'Enter'
    if (actionNode instanceof HTMLInputElement && !isEnterKey) return false
    if (!(actionNode instanceof HTMLInputElement) && event?.type !== 'click') return false
    const panel = actionNode.closest<HTMLElement>('[data-pda-physical-scan-panel]')
    const sourceType = panel?.dataset.sourceType as PdaPhysicalScanSourceType | undefined
    const workOrderId = panel?.dataset.workOrderId || ''
    const scanAction = panel?.dataset.scanAction as PdaPhysicalScanAction | undefined
    const inputMethod = (actionNode.dataset.physicalInputMethod || 'SCANNER') as PdaPhysicalScanInputMethod
    const input = actionNode instanceof HTMLInputElement
      ? actionNode
      : panel?.querySelector<HTMLInputElement>('[data-pda-physical-code-input]')
    if (!sourceType || !workOrderId || !scanAction) {
      showPdaExecDetailToast('加工单扫码上下文已失效，请返回后重新进入。')
      return true
    }
    const context = getPdaPhysicalScanContext(sourceType, workOrderId, scanAction)
    if (!context) {
      showPdaExecDetailToast('加工单不存在或不属于当前操作范围。')
      return true
    }
    try {
      const line = addPdaPhysicalScanLine({
        ...context,
        rawCode: input?.value || '',
        inputMethod,
        scannedAt: nowTimestamp(),
      })
      showPdaExecDetailToast(`已加入：${line.code} · ${line.qty} ${line.unit}`)
      return true
    } catch (error) {
      showPdaExecDetailToast(error instanceof Error ? error.message : '标签识别失败')
      return true
    }
  }

  if (action === 'physical-scan-remove') {
    const panel = actionNode.closest<HTMLElement>('[data-pda-physical-scan-panel]')
    const sourceType = panel?.dataset.sourceType as PdaPhysicalScanSourceType | undefined
    const workOrderId = panel?.dataset.workOrderId || ''
    const scanAction = panel?.dataset.scanAction as PdaPhysicalScanAction | undefined
    const scanLineId = actionNode.dataset.scanLineId || ''
    if (sourceType && workOrderId && scanAction && scanLineId) {
      removePdaPhysicalScanLine({ sourceType, workOrderId, action: scanAction, scanLineId })
    }
    return true
  }

  if (action === 'start-fixed-merged-task') {
    const taskId = actionNode.dataset.taskId || ''
    const task = getTaskFactById(taskId)
    if (!task || task.taskUnitType !== 'MERGED_PRODUCTION_TASK') return true
    const currentFactoryId = getPdaSession()?.factoryId || task.assignedFactoryId || TEST_FACTORY_ID
    const access = getMobileTaskAccessResult(task, currentFactoryId)
    if (!access.canExecuteInMobile || task.acceptanceStatus !== 'ACCEPTED') {
      showPdaExecDetailToast('请先由当前承接工厂完成接单')
      return true
    }
    if (task.status !== 'NOT_STARTED') {
      showPdaExecDetailToast('任务已开始，无需重复操作')
      return true
    }
    const startedAt = nowTimestamp()
    mutateStartTask(taskId, getPdaSession()?.userName || '现场操作员', { startTime: startedAt, proofFiles: [] })
    try {
      ensureHandoverOrderForStartedTask(taskId)
      showPdaExecDetailToast('已开始生产，交出单已生成')
    } catch {
      showPdaExecDetailToast('已开始生产，交出单生成失败，请联系主管')
    }
    syncPdaStartRiskAndExceptions()
    return true
  }

  if (action.startsWith('water-')) {
    if (action === 'water-close-overlay') {
      clearWaterSolubleOverlay()
      return true
    }
    if (action === 'water-back-completion') {
      const overlay = detailState.waterOverlay
      if (!overlay || overlay.type !== 'completion-overage') {
        showPdaExecDetailToast('当前确认已失效，请重新打开。')
        return true
      }
      detailState.waterOverlay = { ...overlay, type: 'completion' }
      refreshWaterSolubleOverlay()
      return true
    }

    const orderId = actionNode.dataset.orderId || ''
    const order = getWaterSolubleWorkOrderById(orderId)
    const session = getPdaSession()
    if (!order || !session || order.taskId !== detailState.activeTaskId) {
      showPdaExecDetailToast('当前任务或登录信息已失效，请重新进入。')
      return true
    }
    const expectedStatus = actionNode.dataset.expectedStatus || ''
    if (order.status !== expectedStatus) {
      showPdaExecDetailToast(`当前步骤已更新为“${WATER_SOLUBLE_STATUS_LABEL[order.status]}”，请按最新页面操作。`)
      refreshWaterSolubleDetail(orderId)
      return true
    }

    const isOverlayAction = action === 'water-confirm-completion' || action === 'water-resolve-pause'
    if (isOverlayAction) {
      const overlay = detailState.waterOverlay
      if (!overlay || overlay.taskId !== detailState.activeTaskId || overlay.taskId !== order.taskId || overlay.orderId !== orderId || overlay.expectedStatus !== order.status || overlay.token !== actionNode.dataset.overlayToken) {
        showPdaExecDetailToast('当前确认已失效，请重新打开。')
        return true
      }
    } else if (waterPrimaryActionTokens.get(orderId) !== actionNode.dataset.actionToken) {
      showPdaExecDetailToast('当前操作已失效，请按最新页面操作。')
      return true
    }

    const taskId = actionNode.dataset.taskId
    if (taskId && taskId !== order.taskId) {
      showPdaExecDetailToast('当前任务与水溶加工单不一致，不能操作。')
      return true
    }
    const roleAction: WaterSolublePdaRoleAction = action === 'water-open-supervisor' || action === 'water-resolve-pause'
      ? 'SUPERVISE'
      : action === 'water-go-handover'
        ? 'HANDOVER'
        : 'OPERATE'
    const actorError = validateWaterSolublePdaActor(session, order.factoryId, roleAction)
    if (actorError) {
      showPdaExecDetailToast(actorError)
      return true
    }

    if (action === 'water-complete') {
      detailState.waterCompletionDraft = { taskId: order.taskId, orderId, completedQty: String(order.plannedQty), reason: '' }
      detailState.waterOverlay = { type: 'completion', orderId, taskId: order.taskId, expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS', token: createWaterOverlayToken(orderId) }
      refreshWaterSolubleOverlay()
      return true
    }
    if (action === 'water-open-supervisor') {
      detailState.waterOverlay = { type: 'supervisor', orderId, taskId: order.taskId, expectedStatus: 'PRODUCTION_PAUSED', token: createWaterOverlayToken(orderId) }
      refreshWaterSolubleOverlay()
      return true
    }
    if (action === 'water-go-handover') {
      if (rejectOfflinePdaMutation()) return true
      try {
        const ensured = ensureHandoverOrderForStartedTask(order.taskId)
        appStore.navigate(`/fcs/pda/handover/${encodeURIComponent(ensured.handoverOrderId)}?action=new-record`)
      } catch (error) {
        showPdaExecDetailToast(error instanceof Error ? error.message : '交出单创建失败，请重试。')
      }
      return true
    }

    if (action === 'water-confirm-completion') {
      if (detailState.waterCompletionDraft.taskId !== order.taskId || detailState.waterCompletionDraft.orderId !== orderId) {
        showPdaExecDetailToast('当前填写内容已失效，请重新打开。')
        return true
      }
      const completedQtyText = detailState.waterCompletionDraft.completedQty.trim()
      if (!completedQtyText) {
        showPdaExecDetailToast('请填写实际完成数量。')
        return true
      }
      const completedQty = Number(completedQtyText)
      if (!Number.isFinite(completedQty) || completedQty < 0) {
        showPdaExecDetailToast('请输入大于或等于 0 的有效完成数量。')
        return true
      }
      const reason = detailState.waterCompletionDraft.reason.trim()
      if (completedQty !== order.plannedQty && !reason) {
        showPdaExecDetailToast(completedQty < order.plannedQty ? '完成数量少于计划，请填写原因。' : '完成数量超过计划，请填写原因。')
        return true
      }
      if (completedQty > order.plannedQty && detailState.waterOverlay?.type === 'completion') {
        detailState.waterOverlay = { ...detailState.waterOverlay, type: 'completion-overage' }
        refreshWaterSolubleOverlay()
        return true
      }
      if (rejectOfflinePdaMutation('[data-pda-execd-field="waterReason"]')) return true
      const actionKey = `${orderId}:COMPLETE:${order.status}`
      if (pendingWaterActions.has(actionKey)) return true
      pendingWaterActions.add(actionKey)
      const button = actionNode as HTMLButtonElement
      const oldText = button.textContent || '确认完成'
      button.disabled = true
      button.textContent = '处理中…'
      const result = executeWaterSolublePdaAction({ action: 'COMPLETE', orderId, taskId: order.taskId, expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS', expectedNode: 'COMPLETE', completedQty, reason, actor: session })
      pendingWaterActions.delete(actionKey)
      showPdaExecDetailToast(result.message)
      if (result.ok) {
        detailState.waterOverlay = null
        detailState.waterCompletionDraft = { taskId: '', orderId: '', completedQty: '', reason: '' }
        refreshWaterSolubleOverlay()
        refreshWaterSolubleDetail(orderId)
      } else if (button.isConnected) {
        button.disabled = false
        button.textContent = oldText
      }
      return true
    }

    if (action === 'water-resolve-pause') {
      const decision = actionNode.dataset.decision as WaterSolubleSupervisorDecision | undefined
      if (!decision || !['CONTINUE_PROCESSING', 'CONTINUE_WITH_ACTUAL_QTY', 'RETURN_FOR_REWORK'].includes(decision)) {
        showPdaExecDetailToast('请选择有效的主管处理方式。')
        return true
      }
      if (rejectOfflinePdaMutation()) return true
      const actionKey = `${orderId}:RESOLVE_PAUSE:${order.status}`
      if (pendingWaterActions.has(actionKey)) return true
      pendingWaterActions.add(actionKey)
      const button = actionNode as HTMLButtonElement
      const oldText = button.textContent || '确认处理'
      button.disabled = true
      button.textContent = '处理中…'
      const result = executeWaterSolublePdaAction({ action: 'RESOLVE_PAUSE', orderId, taskId: order.taskId, expectedStatus: 'PRODUCTION_PAUSED', expectedNode: 'SUPERVISOR', decision, actor: session })
      pendingWaterActions.delete(actionKey)
      showPdaExecDetailToast(result.message)
      if (result.ok) {
        detailState.waterOverlay = null
        refreshWaterSolubleOverlay()
        refreshWaterSolubleDetail(orderId)
      } else if (button.isConnected) {
        button.disabled = false
        button.textContent = oldText
      }
      return true
    }

    if (rejectOfflinePdaMutation()) return true
    const actionKey = `${orderId}:${action}:${order.status}`
    if (pendingWaterActions.has(actionKey)) return true
    pendingWaterActions.add(actionKey)
    const button = actionNode as HTMLButtonElement
    const oldText = button.textContent || ''
    button.disabled = true
    button.textContent = '处理中…'
    const result = action === 'water-material-ready'
      ? executeWaterSolublePdaAction({ action: 'MATERIAL_READY', orderId, taskId: order.taskId, expectedStatus: 'WAIT_MATERIAL', expectedNode: 'WAIT_MATERIAL', actor: session })
      : executeWaterSolublePdaAction({ action: 'START', orderId, taskId: order.taskId, expectedStatus: 'WAIT_WATER_SOLUBLE', expectedNode: 'START', actor: session })
    pendingWaterActions.delete(actionKey)
    showPdaExecDetailToast(result.message)
    if (result.ok) refreshWaterSolubleDetail(orderId)
    else if (button.isConnected) {
      button.disabled = false
      button.textContent = oldText
    }
    return true
  }

  if (action.startsWith('dye-water-')) {
    if (action === 'dye-water-close-overlay') {
      detailState.dyeWaterOverlay = null
      detailState.dyeWaterDraft = { taskId: '', dyeOrderId: '', outputQty: '', reason: '' }
      refreshCombinedDyeOverlay()
      return true
    }
    if (action === 'dye-water-back-completion') {
      if (!detailState.dyeWaterOverlay || detailState.dyeWaterOverlay.type !== 'completion-overage') {
        showPdaExecDetailToast('当前确认已失效，请重新打开。')
        return true
      }
      detailState.dyeWaterOverlay = { ...detailState.dyeWaterOverlay, type: 'completion' }
      refreshCombinedDyeOverlay()
      return true
    }
    const dyeOrderId = actionNode.dataset.dyeOrderId || ''
    const order = getDyeWorkOrderById(dyeOrderId)
    const session = getPdaSession()
    if (!order || !session || !order.requiresWaterSoluble || order.taskId !== detailState.activeTaskId) {
      showPdaExecDetailToast('当前任务或登录信息已失效，请重新进入。')
      return true
    }
    const expectedNode = action === 'dye-water-start-dye' ? 'DYE' : 'WATER_SOLUBLE'
    if (actionNode.dataset.taskId !== order.taskId || actionNode.dataset.expectedNode !== expectedNode) {
      showPdaExecDetailToast('当前任务或步骤不一致，不能操作。')
      return true
    }
    if (actionNode.dataset.expectedStatus !== order.status) {
      showPdaExecDetailToast(`当前步骤已更新为“${getDyeWorkOrderStatusLabel(order.status)}”，请按最新页面操作。`)
      refreshCombinedDyeCurrentAction(dyeOrderId)
      return true
    }
    const overlayAction = action === 'dye-water-confirm-completion' || action === 'dye-water-resolve-pause'
    if (overlayAction) {
      const overlay = detailState.dyeWaterOverlay
      if (!overlay || overlay.taskId !== detailState.activeTaskId || overlay.dyeOrderId !== dyeOrderId || overlay.taskId !== order.taskId || overlay.expectedStatus !== order.status || overlay.token !== actionNode.dataset.overlayToken) {
        showPdaExecDetailToast('当前确认已失效，请重新打开。')
        return true
      }
    } else if (dyeWaterPrimaryActionTokens.get(dyeOrderId) !== actionNode.dataset.actionToken) {
      showPdaExecDetailToast('当前操作已失效，请按最新页面操作。')
      return true
    }
    const roleAction: WaterSolublePdaRoleAction = action === 'dye-water-open-supervisor' || action === 'dye-water-resolve-pause' ? 'SUPERVISE' : 'OPERATE'
    const actorError = validateWaterSolublePdaActor(session, order.dyeFactoryId, roleAction)
    if (actorError) {
      showPdaExecDetailToast(actorError)
      return true
    }
    if (action === 'dye-water-complete') {
      detailState.dyeWaterDraft = { taskId: order.taskId, dyeOrderId, outputQty: String(order.waterSolublePlannedQty ?? order.plannedQty), reason: '' }
      detailState.dyeWaterOverlay = { type: 'completion', dyeOrderId, taskId: order.taskId, expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS', token: `${dyeOrderId}:${++dyeWaterOverlaySequence}` }
      refreshCombinedDyeOverlay()
      return true
    }
    if (action === 'dye-water-open-supervisor') {
      detailState.dyeWaterOverlay = { type: 'supervisor', dyeOrderId, taskId: order.taskId, expectedStatus: 'PRODUCTION_PAUSED', token: `${dyeOrderId}:${++dyeWaterOverlaySequence}` }
      refreshCombinedDyeOverlay()
      return true
    }
    if (action === 'dye-water-confirm-completion') {
      if (detailState.dyeWaterDraft.taskId !== order.taskId || detailState.dyeWaterDraft.dyeOrderId !== dyeOrderId) {
        showPdaExecDetailToast('当前填写内容已失效，请重新打开。')
        return true
      }
      const outputQtyText = detailState.dyeWaterDraft.outputQty.trim()
      if (!outputQtyText) {
        showPdaExecDetailToast('请填写实际完成数量。')
        return true
      }
      const outputQty = Number(outputQtyText)
      const plannedQty = order.waterSolublePlannedQty ?? order.plannedQty
      const reason = detailState.dyeWaterDraft.reason.trim()
      if (!Number.isFinite(outputQty) || outputQty < 0) {
        showPdaExecDetailToast('请输入大于或等于 0 的有效完成数量。')
        return true
      }
      if (outputQty !== plannedQty && !reason) {
        showPdaExecDetailToast(outputQty < plannedQty ? '完成数量少于计划，请填写原因。' : '完成数量超过计划，请填写原因。')
        return true
      }
      if (outputQty > plannedQty && detailState.dyeWaterOverlay?.type === 'completion') {
        detailState.dyeWaterOverlay = { ...detailState.dyeWaterOverlay, type: 'completion-overage' }
        refreshCombinedDyeOverlay()
        return true
      }
      if (rejectOfflinePdaMutation('[data-pda-execd-field="dyeWaterReason"]')) return true
      const key = `${dyeOrderId}:COMPLETE:${order.status}`
      if (pendingDyeWaterActions.has(key)) return true
      pendingDyeWaterActions.add(key)
      const button = actionNode as HTMLButtonElement
      const oldText = button.textContent || '确认完成'
      button.disabled = true
      button.textContent = '处理中…'
      const result = executeDyeWaterSolublePdaAction({ action: 'COMPLETE', dyeOrderId, taskId: order.taskId, expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS', expectedNode: 'WATER_SOLUBLE', outputQty, reason, actor: session })
      pendingDyeWaterActions.delete(key)
      showPdaExecDetailToast(result.ok ? '水溶完成已记录' : result.message)
      if (result.ok) {
        detailState.dyeWaterOverlay = null
        detailState.dyeWaterDraft = { taskId: '', dyeOrderId: '', outputQty: '', reason: '' }
        refreshCombinedDyeCurrentAction(dyeOrderId)
      } else if (button.isConnected) {
        button.disabled = false
        button.textContent = oldText
      }
      return true
    }
    if (action === 'dye-water-resolve-pause') {
      const decision = actionNode.dataset.decision as DyeWaterSolublePauseDecision | undefined
      if (!decision || !['CONTINUE_PROCESSING', 'CONTINUE_WITH_ACTUAL_QTY', 'RETURN_FOR_REWORK'].includes(decision)) {
        showPdaExecDetailToast('请选择有效的主管处理方式。')
        return true
      }
      if (rejectOfflinePdaMutation()) return true
      const key = `${dyeOrderId}:RESOLVE_PAUSE:${order.status}`
      if (pendingDyeWaterActions.has(key)) return true
      pendingDyeWaterActions.add(key)
      const button = actionNode as HTMLButtonElement
      const oldText = button.textContent || '确认处理'
      button.disabled = true
      button.textContent = '处理中…'
      const result = executeDyeWaterSolublePdaAction({ action: 'RESOLVE_PAUSE', dyeOrderId, taskId: order.taskId, expectedStatus: 'PRODUCTION_PAUSED', expectedNode: 'WATER_SOLUBLE', decision, actor: session })
      pendingDyeWaterActions.delete(key)
      showPdaExecDetailToast(result.ok ? '主管处理已记录' : result.message)
      if (result.ok) {
        detailState.dyeWaterOverlay = null
        refreshCombinedDyeCurrentAction(dyeOrderId)
      } else if (button.isConnected) {
        button.disabled = false
        button.textContent = oldText
      }
      return true
    }
    if (action === 'dye-water-start-dye') {
      if (rejectOfflinePdaMutation()) return true
      const key = `${dyeOrderId}:START_DYE:${order.status}`
      if (pendingDyeWaterActions.has(key)) return true
      pendingDyeWaterActions.add(key)
      const button = actionNode as HTMLButtonElement
      const oldText = button.textContent || '开始染色'
      button.disabled = true
      button.textContent = '处理中…'
      const inputText = window.prompt(`请输入染色投入数量（${order.qtyUnit}）`, String(order.waterSolubleCompletedQty ?? order.plannedQty))
      if (inputText === null) {
        pendingDyeWaterActions.delete(key)
        button.disabled = false
        button.textContent = oldText
        return true
      }
      const inputQty = Number(inputText.trim())
      const prerequisite = validateDyeStartPrerequisite(dyeOrderId, inputQty)
      if (!prerequisite.ok) {
        pendingDyeWaterActions.delete(key)
        button.disabled = false
        button.textContent = oldText
        showPdaExecDetailToast(prerequisite.message)
        return true
      }
      const dyeVatNo = getDyeExecutionNodeRecord(dyeOrderId, 'VAT_PLAN')?.dyeVatNo || listDyeVatOptions(order.dyeFactoryId)[0]?.dyeVatNo || ''
      try {
        const online = getDyeWorkOrderOnlineRecord(dyeOrderId)
        if (online.status !== '染色中') {
          assertDyeWorkOrderOnlineActionAllowed(dyeOrderId, '开工')
        }
        startDyeing(dyeOrderId, { dyeVatNo, inputQty, operatorName: session.userName })
        if (online.status !== '染色中') {
          advanceDyeWorkOrderOnlineStatus(dyeOrderId, {
            action: '开工', operatorName: session.userName, operatedAt: nowTimestamp(), source: 'PDA',
          })
        }
        pendingDyeWaterActions.delete(key)
        showPdaExecDetailToast('染色开始已记录')
        refreshCombinedDyeCurrentAction(dyeOrderId)
      } catch (error) {
        pendingDyeWaterActions.delete(key)
        if (button.isConnected) {
          button.disabled = false
          button.textContent = oldText
        }
        showPdaExecDetailToast(error instanceof Error ? error.message : '无法开始染色')
      }
      return true
    }
    if (rejectOfflinePdaMutation()) return true
    const key = `${dyeOrderId}:START:${order.status}`
    if (pendingDyeWaterActions.has(key)) return true
    pendingDyeWaterActions.add(key)
    const button = actionNode as HTMLButtonElement
    const oldText = button.textContent || '开始水溶'
    button.disabled = true
    button.textContent = '处理中…'
    const result = executeDyeWaterSolublePdaAction({ action: 'START', dyeOrderId, taskId: order.taskId, expectedStatus: 'WAIT_WATER_SOLUBLE', expectedNode: 'WATER_SOLUBLE', actor: session })
    pendingDyeWaterActions.delete(key)
    showPdaExecDetailToast(result.ok ? '水溶已开始' : result.message)
    if (result.ok) refreshCombinedDyeCurrentAction(dyeOrderId)
    else if (button.isConnected) {
      button.disabled = false
      button.textContent = oldText
    }
    return true
  }

  if (action === 'go-handover') {
    const tab = actionNode.dataset.tab || 'pickup'
    appStore.navigate(`/fcs/pda/handover?tab=${tab}`)
    return true
  }

  if (action === 'go-warehouse') {
    appStore.navigate('/fcs/pda/warehouse/wait-process')
    return true
  }

  if (action === 'print-submit-handover' || action === 'dye-submit-handover') {
    const handoverSession = getPdaSession()
    if (!handoverSession) {
      showPdaExecDetailToast('登录状态已失效，请重新登录后交出')
      return true
    }
    const taskId = actionNode.dataset.taskId
    if (!taskId) {
      showPdaExecDetailToast('任务未关联')
      return true
    }
    const handoverTask = getMobileExecutionTaskById(taskId)
    if (!handoverTask?.assignedFactoryId || handoverTask.assignedFactoryId !== handoverSession.factoryId) {
      showPdaExecDetailToast('当前加工单不属于登录工厂，不能交出')
      return true
    }
    const printOrderForQty = action === 'print-submit-handover' ? getPrintWorkOrderByTaskId(taskId) : undefined
    const dyeOrderForQty = action === 'dye-submit-handover' ? getDyeWorkOrderByTaskId(taskId) : undefined
    if (dyeOrderForQty && !isDyeWorkOrderOnlineActionAllowed(dyeOrderForQty.dyeOrderId, '交出')) {
      const latestStatus = getDyeWorkOrderOnlineRecord(dyeOrderForQty.dyeOrderId).status
      showPdaExecDetailToast(latestStatus === '取消' ? '加工单已取消，不能交出' : `当前状态为“${latestStatus}”，请按最新页面操作`)
      refreshDyeingTaskCard(dyeOrderForQty.dyeOrderId)
      return true
    }
    const qtyLabel = printOrderForQty
      ? getQuantityLabel({
          processType: 'PRINT',
          sourceId: printOrderForQty.printOrderId,
          objectType: printOrderForQty.objectType,
          qtyUnit: printOrderForQty.qtyUnit,
          operationCode: 'PRINT_SUBMIT_HANDOVER',
          qtyPurpose: '已交出',
          isPiecePrinting: printOrderForQty.isPiecePrinting,
          isFabricPrinting: printOrderForQty.isFabricPrinting,
        })
      : getQuantityLabel({
          processType: 'DYE',
          sourceId: dyeOrderForQty?.dyeOrderId,
          objectType: '面料',
          qtyUnit: dyeOrderForQty?.qtyUnit,
          operationCode: 'DYE_SUBMIT_HANDOVER',
          qtyPurpose: '已交出',
        })
    const dyeCompletedQty = dyeOrderForQty
      ? getDyeExecutionNodeRecord(dyeOrderForQty.dyeOrderId, 'PACK')?.outputQty
        || getDyeExecutionNodeRecord(dyeOrderForQty.dyeOrderId, 'ROLL')?.outputQty
        || getDyeExecutionNodeRecord(dyeOrderForQty.dyeOrderId, 'DYE')?.outputQty
        || 0
      : 0
    const defaultQty = printOrderForQty?.actualCompletedQty || printOrderForQty?.plannedQty || dyeCompletedQty || 0
    const qtyText = window.prompt(`请输入${qtyLabel}`, String(defaultQty || ''))?.trim() || ''
    const submittedQty = Number(qtyText)
    if (!Number.isFinite(submittedQty) || submittedQty <= 0) {
      showPdaExecDetailToast(`请填写有效${qtyLabel}`)
      return true
    }
    try {
      if (action === 'print-submit-handover') {
        const printOrder = getPrintWorkOrderByTaskId(taskId)
        if (!printOrder) {
          showPdaExecDetailToast('印花加工单未关联')
          return true
        }
        executeMobileProcessAction({
          sourceType: 'PRINT',
          sourceId: printOrder.printOrderId,
          taskId,
          actionCode: 'PRINT_SUBMIT_HANDOVER',
          operatorName: handoverSession.userName,
          operatorFactoryId: handoverSession.factoryId,
          operatedAt: nowTimestamp(),
          objectType: printOrder.objectType || (printOrder.qtyUnit === '片' ? '裁片' : '面料'),
          objectQty: submittedQty,
          qtyUnit: printOrder.qtyUnit,
          qtyLabel,
          remark: '移动端发起交出',
          confirmationKey: `PDA-HANDOVER:${taskId}`,
        })
      } else {
        const dyeOrder = getDyeWorkOrderByTaskId(taskId)
        if (!dyeOrder) {
          showPdaExecDetailToast('染色加工单未关联')
          return true
        }
        executeMobileProcessAction({
          sourceType: 'DYE',
          sourceId: dyeOrder.dyeOrderId,
          taskId,
          actionCode: 'DYE_SUBMIT_HANDOVER',
          operatorName: handoverSession.userName,
          operatorFactoryId: handoverSession.factoryId,
          operatedAt: nowTimestamp(),
          objectType: '面料',
          objectQty: submittedQty,
          qtyUnit: dyeOrder.qtyUnit,
          qtyLabel,
          remark: '移动端发起交出',
          confirmationKey: `PDA-HANDOVER:${taskId}`,
        })
      }
      showPdaExecDetailToast('交出记录已生成，Web 端交出与仓库待收货记录已同步')
      if (dyeOrderForQty) refreshDyeingTaskCard(dyeOrderForQty.dyeOrderId)
    } catch (error) {
      showPdaExecDetailToast(error instanceof Error ? error.message : '交出失败')
    }
    return true
  }

  if (action === 'view-handover-order' || action === 'new-handover-record') {
    const handoverOrderId = actionNode.dataset.handoverOrderId
    if (!handoverOrderId) {
      showPdaExecDetailToast('交出单未生成')
      return true
    }
    appStore.navigate(
      action === 'new-handover-record'
        ? `/fcs/pda/handover/${handoverOrderId}?action=new-record`
        : `/fcs/pda/handover/${handoverOrderId}`,
    )
    return true
  }

  if (
    action === 'print-start-color-test'
    || action === 'print-complete-color-test'
    || action === 'print-start-printing'
    || action === 'print-complete-printing'
    || action === 'print-start-transfer'
    || action === 'print-complete-transfer'
  ) {
    const printOrderId = actionNode.dataset.printOrderId
    if (!printOrderId) return true

    const printOrder = getPrintWorkOrderById(printOrderId)
    if (!printOrder) return true

    const task = getTaskFactById(printOrder.taskId)
    if (!task) return true
    if (!canOperatePrintingNode(task)) {
      showPdaExecDetailToast('请先开工')
      return true
    }

    try {
      if (action === 'print-start-color-test') {
        executeMobileProcessAction({
          sourceType: 'PRINT',
          sourceId: printOrder.printOrderId,
          taskId: printOrder.taskId,
          actionCode: 'PRINT_PATTERN_READY',
          operatorName: '印花工厂',
          operatedAt: nowTimestamp(),
          remark: '移动端确认花型到位',
        })
        showPdaExecDetailToast('花型测试已开始')
        return true
      }

      if (action === 'print-complete-color-test') {
        const passed = window.confirm('花型测试是否通过？')
        const remark = window.prompt('请填写结果说明（可选）') || undefined
        if (!passed) {
          showPdaExecDetailToast('花型测试未通过，请在 Web 端按驳回流程处理')
          return true
        }
        executeMobileProcessAction({
          sourceType: 'PRINT',
          sourceId: printOrder.printOrderId,
          taskId: printOrder.taskId,
          actionCode: 'PRINT_COLOR_TEST_DONE',
          operatorName: '印花工厂',
          operatedAt: nowTimestamp(),
          remark,
          formData: { 调色结果: '通过' },
        })
        showPdaExecDetailToast(passed ? '花型测试已完成，已进入等打印' : '花型测试未通过，已回到待花型图')
        return true
      }

      if (action === 'print-start-printing') {
        const defaultPrinterNo = listPrintMachineOptions(printOrder.printFactoryId)[0]?.printerNo || ''
        const printerNo = window.prompt('请输入打印机编号', defaultPrinterNo)?.trim() || ''
        if (!printerNo) {
          showPdaExecDetailToast('请填写打印机编号')
          return true
        }
        executeMobileProcessAction({
          sourceType: 'PRINT',
          sourceId: printOrder.printOrderId,
          taskId: printOrder.taskId,
          actionCode: 'PRINT_START_PRINTING',
          operatorName: '印花工厂',
          operatedAt: nowTimestamp(),
          objectType: printOrder.qtyUnit === '片' ? '裁片' : '面料',
          objectQty: printOrder.plannedQty,
          qtyUnit: printOrder.qtyUnit,
          formData: { printerNo, 打印机编号: printerNo },
        })
        showPdaExecDetailToast('打印开始已记录')
        return true
      }

      if (action === 'print-complete-printing') {
        const outputLabel = getQuantityLabel({
          processType: 'PRINT',
          sourceId: printOrder.printOrderId,
          objectType: printOrder.objectType,
          qtyUnit: printOrder.qtyUnit,
          operationCode: 'PRINT_FINISH_PRINTING',
          qtyPurpose: '已完成',
          isPiecePrinting: printOrder.isPiecePrinting,
          isFabricPrinting: printOrder.isFabricPrinting,
        })
        const outputQtyText = window.prompt(`请输入${outputLabel}`, String(printOrder.plannedQty))?.trim() || ''
        const wasteQtyText = window.prompt(`请输入损耗${printOrder.qtyUnit === '片' ? '裁片数量' : '面料米数'}（可选）`, '0')?.trim() || '0'
        executeMobileProcessAction({
          sourceType: 'PRINT',
          sourceId: printOrder.printOrderId,
          taskId: printOrder.taskId,
          actionCode: 'PRINT_FINISH_PRINTING',
          operatorName: '印花工厂',
          operatedAt: nowTimestamp(),
          objectType: printOrder.objectType || (printOrder.qtyUnit === '片' ? '裁片' : '面料'),
          objectQty: Number(outputQtyText),
          qtyUnit: printOrder.qtyUnit,
          qtyLabel: outputLabel,
          remark: `损耗${Number(wasteQtyText)} ${printOrder.qtyUnit}`,
        })
        showPdaExecDetailToast('打印完成已记录')
        return true
      }

      if (action === 'print-start-transfer') {
        executeMobileProcessAction({
          sourceType: 'PRINT',
          sourceId: printOrder.printOrderId,
          taskId: printOrder.taskId,
          actionCode: 'PRINT_START_TRANSFER',
          operatorName: '印花工厂',
          operatedAt: nowTimestamp(),
          objectType: printOrder.qtyUnit === '片' ? '裁片' : '面料',
          objectQty: printOrder.plannedQty,
          qtyUnit: printOrder.qtyUnit,
        })
        showPdaExecDetailToast('转印开始已记录')
        return true
      }

      const transferLabel = getQuantityLabel({
        processType: 'PRINT',
        sourceId: printOrder.printOrderId,
        objectType: printOrder.objectType,
        qtyUnit: printOrder.qtyUnit,
        operationCode: 'PRINT_FINISH_TRANSFER',
        qtyPurpose: '已完成',
        isPiecePrinting: printOrder.isPiecePrinting,
        isFabricPrinting: printOrder.isFabricPrinting,
      })
      const usedMaterialQtyText = window.prompt(`请输入实际使用${printOrder.qtyUnit === '片' ? '裁片数量' : '原料面料米数'}`, String(printOrder.plannedQty))?.trim() || ''
      const actualCompletedQtyText = window.prompt(`请输入${transferLabel}`, String(printOrder.plannedQty))?.trim() || ''
      const rollCountText = window.prompt('请输入转印完成卷数', String(printOrder.plannedRollCount || 1))?.trim() || ''
      const rollLengthText = window.prompt('请输入每卷长度（多卷可用逗号分隔）')?.trim() || ''
      executeMobileProcessAction({
        sourceType: 'PRINT',
        sourceId: printOrder.printOrderId,
        taskId: printOrder.taskId,
        actionCode: 'PRINT_FINISH_TRANSFER',
        operatorName: '印花工厂',
        operatedAt: nowTimestamp(),
        objectType: printOrder.objectType || (printOrder.qtyUnit === '片' ? '裁片' : '面料'),
        objectQty: Number(actualCompletedQtyText),
        qtyUnit: printOrder.qtyUnit,
        qtyLabel: transferLabel,
        formData: {
          [printOrder.qtyUnit === '片' ? '实际使用原料裁片数量' : '实际使用原料面料米数']: Number(usedMaterialQtyText),
          转印完成卷数: Number(rollCountText),
          每卷长度: rollLengthText,
        },
        remark: `实际使用原料${Number(usedMaterialQtyText)} ${printOrder.qtyUnit}`,
      })
      showPdaExecDetailToast('转印完成，已进入待交出')
      return true
    } catch (error) {
      showPdaExecDetailToast(error instanceof Error ? error.message : '保存失败')
      return true
    }
  }

  if (
    action === 'dye-start-sample-wait'
    || action === 'dye-complete-sample-wait'
    || action === 'dye-start-material-wait'
    || action === 'dye-complete-material-wait'
    || action === 'dye-start-sample-test'
    || action === 'dye-complete-sample-test'
    || action === 'dye-start-material-ready'
    || action === 'dye-complete-material-ready'
    || action === 'dye-plan-vat'
    || action === 'dye-start-dye'
    || action === 'dye-complete-dye'
    || action === 'dye-start-node'
    || action === 'dye-complete-node'
  ) {
    const dyeOrderId = actionNode.dataset.dyeOrderId
    if (!dyeOrderId) return true

    const dyeOrder = getDyeWorkOrderById(dyeOrderId)
    if (!dyeOrder) return true

    const task = getTaskFactById(dyeOrder.taskId)
    if (!task) return true
    if (!canOperateDyeingNode(task, dyeOrderId)) {
      showPdaExecDetailToast('请先开工')
      return true
    }
    if (dyeOrder.requiresWaterSoluble && action === 'dye-complete-dye') {
      const session = getPdaSession()
      const dyeNode = getDyeExecutionNodeRecord(dyeOrderId, 'DYE')
      if (!session || dyeOrder.taskId !== detailState.activeTaskId || actionNode.dataset.taskId !== dyeOrder.taskId) {
        showPdaExecDetailToast('当前任务或登录信息已失效，请重新进入。')
        return true
      }
      if (
        actionNode.dataset.expectedStatus !== 'DYEING'
        || actionNode.dataset.expectedNode !== 'DYE'
        || dyeOrder.status !== 'DYEING'
        || !dyeNode?.startedAt
        || Boolean(dyeNode.finishedAt)
      ) {
        showPdaExecDetailToast(`当前步骤已更新为“${getDyeWorkOrderStatusLabel(dyeOrder.status)}”，请按最新页面操作。`)
        refreshCombinedDyeCurrentAction(dyeOrderId)
        return true
      }
      if (dyeWaterPrimaryActionTokens.get(dyeOrderId) !== actionNode.dataset.actionToken) {
        showPdaExecDetailToast('当前操作已失效，请按最新页面操作。')
        return true
      }
      const actorError = validateWaterSolublePdaActor(session, dyeOrder.dyeFactoryId, 'OPERATE')
      if (actorError) {
        showPdaExecDetailToast(actorError)
        return true
      }
      if (rejectOfflinePdaMutation()) return true

      const actualInputQty = Number(dyeNode.inputQty)
      const inputQtyText = window.prompt(`确认染色投入数量（${dyeOrder.qtyUnit}）`, String(actualInputQty))
      if (inputQtyText === null) return true
      const confirmedInputQty = Number(inputQtyText.trim())
      if (!Number.isFinite(confirmedInputQty) || confirmedInputQty !== actualInputQty) {
        showPdaExecDetailToast(`染色投入必须保持为水溶后实际数量 ${actualInputQty} ${dyeOrder.qtyUnit}。`)
        return true
      }
      const outputQtyText = window.prompt(`请输入染色完成数量（${dyeOrder.qtyUnit}）`, String(actualInputQty))
      if (outputQtyText === null) return true
      const normalizedOutputQtyText = outputQtyText.trim()
      if (!normalizedOutputQtyText) {
        showPdaExecDetailToast('请填写染色完成数量。')
        return true
      }
      const outputQty = Number(normalizedOutputQtyText)
      if (!Number.isFinite(outputQty) || outputQty < 0) {
        showPdaExecDetailToast('请输入大于或等于 0 的有效染色完成数量。')
        return true
      }

      const key = `${dyeOrderId}:COMPLETE_DYE:DYEING`
      if (pendingDyeWaterActions.has(key)) return true
      pendingDyeWaterActions.add(key)
      const button = actionNode as HTMLButtonElement
      const oldText = button.textContent || '完成染色'
      button.disabled = true
      button.textContent = '处理中…'
      try {
        executeMobileProcessAction({
          sourceType: 'DYE',
          sourceId: dyeOrder.dyeOrderId,
          taskId: dyeOrder.taskId,
          actionCode: 'DYE_FINISH_DYEING',
          operatorName: session.userName,
          operatedAt: nowTimestamp(),
          objectType: '面料',
          objectQty: outputQty,
          qtyUnit: dyeOrder.qtyUnit,
          actor: session,
        })
        dyeWaterPrimaryActionTokens.delete(dyeOrderId)
        showPdaExecDetailToast('染色完成，已进入脱水')
        refreshCombinedDyeCurrentAction(dyeOrderId)
      } catch (error) {
        if (button.isConnected) {
          button.disabled = false
          button.textContent = oldText
        }
        showPdaExecDetailToast(error instanceof Error ? error.message : '无法完成染色')
      } finally {
        pendingDyeWaterActions.delete(key)
      }
      return true
    }

    try {
      if (action === 'dye-start-sample-wait') {
        const waitTypeText = window.prompt(
          '请输入等待类型：样衣 / 色样',
          dyeOrder.sampleWaitType === 'WAIT_COLOR_CARD' ? '色样' : '样衣',
        )?.trim() || ''
        const waitType = waitTypeText.includes('色') ? 'WAIT_COLOR_CARD' : 'WAIT_SAMPLE_GARMENT'
        startDyeSampleWaitWriteback(dyeOrder.taskId, { waitType, operatorName: '染色工厂' })
        showPdaExecDetailToast('等样衣/色样已开始')
        return true
      }

      if (action === 'dye-complete-sample-wait') {
        executeMobileProcessAction({
          sourceType: 'DYE',
          sourceId: dyeOrder.dyeOrderId,
          taskId: dyeOrder.taskId,
          actionCode: 'DYE_SAMPLE_RECEIVED',
          operatorName: '染色工厂',
          operatedAt: nowTimestamp(),
          objectType: '面料',
          objectQty: dyeOrder.plannedQty,
          qtyUnit: dyeOrder.qtyUnit,
          remark: '移动端确认样衣到位',
        })
        showPdaExecDetailToast('等样衣/色样已完成')
        return true
      }

      if (action === 'dye-start-material-wait') {
        startDyeMaterialWaitWriteback(dyeOrder.taskId, { operatorName: '染色工厂' })
        showPdaExecDetailToast('等原料已开始')
        return true
      }

      if (action === 'dye-complete-material-wait') {
        executeMobileProcessAction({
          sourceType: 'DYE',
          sourceId: dyeOrder.dyeOrderId,
          taskId: dyeOrder.taskId,
          actionCode: 'DYE_MATERIAL_RECEIVED',
          operatorName: '染色工厂',
          operatedAt: nowTimestamp(),
          objectType: '面料',
          objectQty: dyeOrder.plannedQty,
          qtyUnit: dyeOrder.qtyUnit,
          remark: '移动端确认原料到位',
        })
        showPdaExecDetailToast('等原料已完成')
        return true
      }

      if (action === 'dye-start-sample-test') {
        executeMobileProcessAction({
          sourceType: 'DYE',
          sourceId: dyeOrder.dyeOrderId,
          taskId: dyeOrder.taskId,
          actionCode: 'DYE_START_SAMPLE',
          operatorName: '染色工厂',
          operatedAt: nowTimestamp(),
          objectType: '面料',
          objectQty: dyeOrder.plannedQty,
          qtyUnit: dyeOrder.qtyUnit,
        })
        showPdaExecDetailToast('打样开始已记录')
        return true
      }

      if (action === 'dye-complete-sample-test') {
        const colorNo = window.prompt('请输入色号', dyeOrder.colorNo || '')?.trim() || ''
        if (!colorNo) {
          showPdaExecDetailToast('请填写色号')
          return true
        }
        executeMobileProcessAction({
          sourceType: 'DYE',
          sourceId: dyeOrder.dyeOrderId,
          taskId: dyeOrder.taskId,
          actionCode: 'DYE_FINISH_SAMPLE',
          operatorName: '染色工厂',
          operatedAt: nowTimestamp(),
          objectType: '面料',
          objectQty: dyeOrder.plannedQty,
          qtyUnit: dyeOrder.qtyUnit,
          formData: { colorNo, 色号: colorNo, 打样结果: '通过' },
        })
        showPdaExecDetailToast('打样完成已记录')
        return true
      }

      if (action === 'dye-start-material-ready') {
        executeMobileProcessAction({
          sourceType: 'DYE',
          sourceId: dyeOrder.dyeOrderId,
          taskId: dyeOrder.taskId,
          actionCode: 'DYE_FINISH_PREPARE',
          operatorName: '染色工厂',
          operatedAt: nowTimestamp(),
          objectType: '面料',
          objectQty: dyeOrder.plannedQty,
          qtyUnit: dyeOrder.qtyUnit,
          remark: '移动端备料记录',
        })
        showPdaExecDetailToast('备料已记录')
        return true
      }

      if (action === 'dye-complete-material-ready') {
        const outputQtyText = window.prompt('请输入备料面料米数（可选）', String(dyeOrder.plannedQty))?.trim() || ''
        executeMobileProcessAction({
          sourceType: 'DYE',
          sourceId: dyeOrder.dyeOrderId,
          taskId: dyeOrder.taskId,
          actionCode: 'DYE_FINISH_PREPARE',
          operatorName: '染色工厂',
          operatedAt: nowTimestamp(),
          objectType: '面料',
          objectQty: outputQtyText ? Number(outputQtyText) : dyeOrder.plannedQty,
          qtyUnit: dyeOrder.qtyUnit,
        })
        showPdaExecDetailToast('备料完成已记录')
        return true
      }

      if (action === 'dye-plan-vat') {
        const defaultVatNo = getDyeExecutionNodeRecord(dyeOrderId, 'VAT_PLAN')?.dyeVatNo || listDyeVatOptions(dyeOrder.dyeFactoryId)[0]?.dyeVatNo || ''
        const dyeVatNo = window.prompt('请输入染缸编号', defaultVatNo)?.trim() || ''
        if (!dyeVatNo) {
          showPdaExecDetailToast('请填写染缸编号')
          return true
        }
        executeMobileProcessAction({
          sourceType: 'DYE',
          sourceId: dyeOrder.dyeOrderId,
          taskId: dyeOrder.taskId,
          actionCode: 'DYE_SCHEDULE_VAT',
          operatorName: '染色工厂',
          operatedAt: nowTimestamp(),
          objectType: '面料',
          objectQty: dyeOrder.plannedQty,
          qtyUnit: dyeOrder.qtyUnit,
          formData: { dyeVatNo, 染缸号: dyeVatNo },
        })
        showPdaExecDetailToast('染缸已排入计划')
        return true
      }

      if (action === 'dye-start-dye') {
        const defaultVatNo = getDyeExecutionNodeRecord(dyeOrderId, 'DYE')?.dyeVatNo || getDyeExecutionNodeRecord(dyeOrderId, 'VAT_PLAN')?.dyeVatNo || listDyeVatOptions(dyeOrder.dyeFactoryId)[0]?.dyeVatNo || ''
        const dyeVatNo = window.prompt('请输入染缸编号', defaultVatNo)?.trim() || ''
        if (!dyeVatNo) {
          showPdaExecDetailToast('请填写染缸编号')
          return true
        }
        executeMobileProcessAction({
          sourceType: 'DYE',
          sourceId: dyeOrder.dyeOrderId,
          taskId: dyeOrder.taskId,
          actionCode: 'DYE_START_DYEING',
          operatorName: '染色工厂',
          operatedAt: nowTimestamp(),
          objectType: '面料',
          objectQty: dyeOrder.plannedQty,
          qtyUnit: dyeOrder.qtyUnit,
          formData: { dyeVatNo, 染缸号: dyeVatNo },
        })
        showPdaExecDetailToast('染色开始已记录')
        refreshDyeingTaskCard(dyeOrderId)
        return true
      }

      if (action === 'dye-complete-dye') {
        const inputQtyText = window.prompt('请输入投入面料米数（可选）', String(dyeOrder.plannedQty))?.trim() || ''
        const outputQtyText = window.prompt('请输入染色完成面料米数（可选）', String(dyeOrder.plannedQty))?.trim() || ''
        executeMobileProcessAction({
          sourceType: 'DYE',
          sourceId: dyeOrder.dyeOrderId,
          taskId: dyeOrder.taskId,
          actionCode: 'DYE_FINISH_DYEING',
          operatorName: '染色工厂',
          operatedAt: nowTimestamp(),
          objectType: '面料',
          objectQty: outputQtyText ? Number(outputQtyText) : dyeOrder.plannedQty,
          qtyUnit: dyeOrder.qtyUnit,
          remark: inputQtyText ? `投入面料米数${Number(inputQtyText)} ${dyeOrder.qtyUnit}` : undefined,
        })
        showPdaExecDetailToast('染色完成，已进入脱水')
        refreshDyeingTaskCard(dyeOrderId)
        return true
      }

      const nodeCode = actionNode.dataset.nodeCode as 'DEHYDRATE' | 'DRY' | 'SET' | 'ROLL' | 'PACK' | undefined
      if (!nodeCode) return true

      const nodeLabelMap: Record<'DEHYDRATE' | 'DRY' | 'SET' | 'ROLL' | 'PACK', string> = {
        DEHYDRATE: '脱水',
        DRY: '烘干',
        SET: '定型',
        ROLL: '打卷',
        PACK: '包装',
      }

      if (action === 'dye-start-node') {
        showPdaExecDetailToast(`${nodeLabelMap[nodeCode]}开始按统一写回口径由完成节点记录`)
        return true
      }

      const outputQtyText = window.prompt(`请输入${nodeCode === 'PACK' ? '包装完成面料米数' : '完成面料米数'}（${nodeLabelMap[nodeCode]}）`, String(dyeOrder.plannedQty))?.trim() || ''
      const packRollCountText = nodeCode === 'PACK'
        ? window.prompt('请输入包装卷数', String(dyeOrder.plannedRollCount || 1))?.trim() || ''
        : ''
      const packRollLengthText = nodeCode === 'PACK'
        ? window.prompt('请输入每卷长度（多卷可用逗号分隔）')?.trim() || ''
        : ''
      const finishActionCodeMap: Record<'DEHYDRATE' | 'DRY' | 'SET' | 'ROLL' | 'PACK', string> = {
        DEHYDRATE: 'DYE_FINISH_DEHYDRATION',
        DRY: 'DYE_FINISH_DRYING',
        SET: 'DYE_FINISH_SETTING',
        ROLL: 'DYE_FINISH_ROLLING',
        PACK: 'DYE_FINISH_PACKING',
      }
      executeMobileProcessAction({
        sourceType: 'DYE',
        sourceId: dyeOrder.dyeOrderId,
        taskId: dyeOrder.taskId,
        actionCode: finishActionCodeMap[nodeCode],
        operatorName: '染色工厂',
        operatedAt: nowTimestamp(),
        objectType: '面料',
        objectQty: outputQtyText ? Number(outputQtyText) : dyeOrder.plannedQty,
        qtyUnit: dyeOrder.qtyUnit,
        formData: nodeCode === 'PACK'
          ? {
              包装卷数: Number(packRollCountText),
              每卷长度: packRollLengthText,
            }
          : undefined,
      })
      showPdaExecDetailToast(nodeCode === 'PACK' ? '包装完成，已进入待交出' : `${nodeLabelMap[nodeCode]}完成已记录`)
      return true
    } catch (error) {
      showPdaExecDetailToast(error instanceof Error ? error.message : '保存失败')
      return true
    }
  }

  if (
    action === 'binding-confirm-receive'
    || action === 'binding-process-report'
    || action === 'binding-submit-handover'
    || action === 'binding-complete-order'
  ) {
    try {
      const workOrderId = actionNode.dataset.workOrderId || ''
      const confirmationKey = actionNode.dataset.confirmationKey || ''
      const order = getBindingProcessOrderById(workOrderId)
      const session = getPdaSession()
      if (!order || !session || order.factoryId !== session.factoryId) {
        throw new Error('捆条加工单不存在或不属于当前登录裁床工厂。')
      }
      if (!confirmationKey) throw new Error('缺少本次操作确认号，请重新扫码进入。')
      const actionCodeMap = {
        'binding-confirm-receive': 'BINDING_CONFIRM_RECEIVE',
        'binding-process-report': 'BINDING_PROCESS_REPORT',
        'binding-submit-handover': 'BINDING_SUBMIT_HANDOVER',
        'binding-complete-order': 'BINDING_COMPLETE_ORDER',
      } as const
      const actionLabelMap = {
        'binding-confirm-receive': '确认接收',
        'binding-process-report': '加工填报',
        'binding-submit-handover': '发起交出',
        'binding-complete-order': '完成加工单',
      } as const
      const actionCode = actionCodeMap[action as keyof typeof actionCodeMap]
      const actionLabel = actionLabelMap[action as keyof typeof actionLabelMap]
      if (!actionCode || !actionLabel) throw new Error('捆条加工单动作不正确。')
      const physicalScanAction: PdaPhysicalScanAction | null = action === 'binding-confirm-receive'
        ? 'RECEIVE'
        : action === 'binding-submit-handover'
          ? 'HANDOUT'
          : null
      const physicalScanContext = physicalScanAction
        ? getPdaPhysicalScanContext('BINDING_PROCESS_ORDER', order.bindingOrderId, physicalScanAction)
        : null
      const physicalScanLines = physicalScanContext ? listPdaPhysicalScanDraftLines(physicalScanContext) : []
      if (physicalScanContext && physicalScanLines.length === 0) {
        throw new Error(physicalScanAction === 'RECEIVE'
          ? '请先扫描或输入本批接收的面料标签。'
          : '请先扫描或输入本批交出的捆条标签。')
      }
      const physicalQty = physicalScanLines.length
        ? roundPhysicalQty(physicalScanLines.reduce((sum, line) => sum + line.qty, 0))
        : undefined
      const qty = physicalQty ?? Number(detailState.bindingQty)
      if (action !== 'binding-complete-order' && (!Number.isFinite(qty) || qty <= 0)) {
        throw new Error('请填写本次实际米数。')
      }
      const operatedAt = nowTimestamp()
      const scanRemark = physicalScanLines.length ? `实物码：${physicalScanLines.map((line) => line.code).join('、')}` : ''
      const businessRecordIds: string[] = []
      if (action === 'binding-confirm-receive' && physicalScanLines.length) {
        const qtyByDetailId = physicalScanLines.reduce<Record<string, number>>((result, line) => {
          if (!line.detailId) throw new Error('面料标签缺少捆条规格归属，已阻断接收。')
          result[line.detailId] = roundPhysicalQty((result[line.detailId] || 0) + line.qty)
          return result
        }, {})
        Object.entries(qtyByDetailId).forEach(([detailId, detailQty], index) => {
          const detailConfirmationKey = `${confirmationKey}:${index + 1}:${detailId}`
          const updated = executeBindingProcessActionWithWarehouse({
            bindingOrderId: order.bindingOrderId,
            actionCode,
            qty: detailQty,
            detailId,
            confirmationKey: detailConfirmationKey,
            operatorName: session.userName,
            operatedAt,
            remark: [detailState.bindingRemark.trim(), scanRemark].filter(Boolean).join('；'),
          })
          const recordId = updated.actionRecords?.find((record) => record.confirmationKey === detailConfirmationKey)?.actionRecordId
          if (recordId) businessRecordIds.push(recordId)
        })
      } else {
        const updated = executeBindingProcessActionWithWarehouse({
          bindingOrderId: order.bindingOrderId,
          actionCode,
          qty: action === 'binding-complete-order' ? undefined : qty,
          detailId: action === 'binding-process-report' ? detailState.bindingDetailId : undefined,
          confirmationKey,
          operatorName: session.userName,
          operatedAt,
          remark: [detailState.bindingRemark.trim(), scanRemark].filter(Boolean).join('；'),
        })
        const recordId = updated.actionRecords?.find((record) => record.confirmationKey === confirmationKey)?.actionRecordId
        if (recordId) businessRecordIds.push(recordId)
      }
      const scanBatch = physicalScanContext
        ? commitPdaPhysicalScanBatch({
            ...physicalScanContext,
            businessRecordIds,
            operatorName: session.userName,
            committedAt: operatedAt,
          })
        : null
      detailState.bindingQty = ''
      if (action !== 'binding-complete-order') detailState.bindingRemark = ''
      showPdaExecDetailToast(`捆条加工单${actionLabel}已记录${scanBatch ? `（${scanBatch.scanBatchId}）` : ''}`)
      window.dispatchEvent(new CustomEvent('higood:request-render'))
      return true
    } catch (error) {
      showPdaExecDetailToast(error instanceof Error ? error.message : '捆条加工单写回失败')
      return true
    }
  }

  if (
    action === 'special-confirm-receive' ||
    action === 'special-process-report' ||
    action === 'special-submit-handover' ||
    action === 'special-complete-order'
  ) {
    try {
      const workOrderId = actionNode.dataset.workOrderId || ''
      const sourceTaskId = actionNode.dataset.sourceTaskId || ''
      const confirmationKey = actionNode.dataset.confirmationKey || ''
      if (!workOrderId || !sourceTaskId || !confirmationKey) {
        throw new Error('加工单执行身份不完整，请重新扫码进入。')
      }
      const strictWorkOrder = getSpecialCraftTaskOrderById(workOrderId)
      if (!strictWorkOrder || strictWorkOrder.sourceTaskId !== sourceTaskId) {
        throw new Error('加工单与来源任务不一致，已阻断操作。')
      }
      const actionTask = getTaskFactById(sourceTaskId)
      const actionSession = getPdaSession()
      const actionFactoryId = actionSession?.factoryId || ''
      const canGarmentWarehouseOperate = actionTask ? canCurrentPdaSessionExecuteGarmentWarehouseOutbound(actionTask, workOrderId) : false
      const canExecuteCurrentAction = Boolean(
        actionSession
        && actionTask
        && (
          (strictWorkOrder.factoryId === actionFactoryId && canFactoryAccessSpecialCraftPdaTask(actionFactoryId, actionTask))
          || canGarmentWarehouseOperate
        ),
      )
      if (!canExecuteCurrentAction) {
        throw new Error('当前账号无权执行该特殊工艺加工单。')
      }
      if (!actionTask) throw new Error('来源任务不存在，已阻断加工单操作。')
      if (!isSpecialCraftActionAllowedOnCurrentSurface(action, canGarmentWarehouseOperate)) {
        throw new Error('该动作不属于当前页，请从“执行”或“交接”对应入口操作。')
      }
      const actionAudit = getCurrentPdaProcessActionAudit()

      const task = actionTask
      const bindings = getSpecialCraftExecBindings(task, workOrderId)
      const workOrder = getSpecialCraftWorkOrderForPdaTask(task, bindings, workOrderId)
      if (!workOrder) {
        showPdaExecDetailToast('特殊工艺加工单未关联，不能执行')
        return true
      }
      const objectMeta = resolveSpecialCraftPdaObjectMeta(workOrder)
      const isButtonLoop = workOrder.quantityMode === 'TICKET_INPUT_OUTPUT'
      const sourceId = workOrder.taskOrderId
      if (!sourceId) {
        showPdaExecDetailToast('特殊工艺加工单未关联')
        return true
      }
      const actionCodeMap: Record<string, string> = {
        'special-confirm-receive': 'SPECIAL_CRAFT_CONFIRM_RECEIVE',
        'special-process-report': 'SPECIAL_CRAFT_PROCESS_REPORT',
        'special-submit-handover': 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
        'special-complete-order': 'SPECIAL_CRAFT_COMPLETE_ORDER',
      }
      const actionLabelMap: Record<string, string> = {
        'special-confirm-receive': '确认接收',
        'special-process-report': '加工填报',
        'special-submit-handover': '发起交出',
        'special-complete-order': '完成加工单',
      }
      if (!actionCodeMap[action] || !actionLabelMap[action]) {
        showPdaExecDetailToast('特殊工艺动作不正确，请刷新后重试')
        return true
      }
      const physicalScanAction: PdaPhysicalScanAction | null = action === 'special-confirm-receive'
        ? 'RECEIVE'
        : action === 'special-process-report' && objectMeta.requiresFeiTicket && !isButtonLoop
          ? 'PROCESS_REPORT'
          : action === 'special-submit-handover'
            ? 'HANDOUT'
            : null
      const physicalScanContext = physicalScanAction
        ? getPdaPhysicalScanContext('SPECIAL_CRAFT', workOrder.taskOrderId, physicalScanAction)
        : null
      const physicalScanLines = physicalScanContext ? listPdaPhysicalScanDraftLines(physicalScanContext) : []
      if (physicalScanContext && physicalScanLines.length === 0) {
        throw new Error(physicalScanAction === 'RECEIVE'
          ? '请先扫描或输入本批接收的标签或菲票。'
          : physicalScanAction === 'PROCESS_REPORT'
            ? '请先扫描或输入本批加工填报的菲票。'
            : '请先扫描或输入本批交出的标签或菲票。')
      }
      const physicalScanQty = physicalScanLines.length
        ? roundPhysicalQty(physicalScanLines.reduce((sum, line) => sum + line.qty, 0))
        : undefined
      const physicalSkuQtyBySkuCode = physicalScanLines.some((line) => line.skuCode)
        ? physicalScanLines.reduce<Record<string, number>>((result, line) => {
            if (line.skuCode) result[line.skuCode] = roundPhysicalQty((result[line.skuCode] || 0) + line.qty)
            return result
          }, {})
        : undefined
      const physicalFeiQtyByTicketNo = physicalScanLines.some((line) => line.feiTicketNo)
        ? physicalScanLines.reduce<Record<string, number>>((result, line) => {
            if (line.feiTicketNo) result[line.feiTicketNo] = roundPhysicalQty((result[line.feiTicketNo] || 0) + line.qty)
            return result
          }, {})
        : undefined
      const baseQty = getSpecialCraftPdaBaseQty(task as ProcessTask, workOrder, undefined, objectMeta) || 1
      const garmentSkuDraft = objectMeta.objectType === '成衣' && workOrder
        ? getSpecialCraftGarmentSkuDrafts(workOrder.taskOrderId, workOrder.status)
        : undefined
      const skuQtyField = action === 'special-confirm-receive'
        ? 'receivedQty'
        : action === 'special-process-report'
          ? 'completedQty'
          : action === 'special-submit-handover'
            ? 'handoverQty'
          : ''
      const garmentSkuQtyBySkuCode = garmentSkuDraft && skuQtyField
        ? Object.fromEntries(garmentSkuDraft.lines.map((line) => [line.skuCode, Number(garmentSkuDraft.drafts[line.draftKey][skuQtyField as 'receivedQty' | 'completedQty' | 'handoverQty'])]))
        : undefined
      const lineHandoverRows = action === 'special-submit-handover'
        && !isButtonLoop
        && objectMeta.objectType !== '成衣'
        && objectMeta.objectType !== '辅料'
        ? workOrder.lineProgress || []
        : []
      const lineHandoverQtyEntries = lineHandoverRows.map((row) => {
        const remainingQty = Math.max(row.completedQty - row.returnedQty, 0)
        const draftKey = buildSpecialCraftLineHandoverDraftKey(workOrder.taskOrderId, row.lineProgressKey)
        const rawQty = detailState.specialCraftLineHandoverDrafts[draftKey] ?? String(remainingQty)
        const qty = Number(rawQty)
        if (!Number.isFinite(qty) || qty < 0) throw new Error(`${row.feiTicketNo || row.skuCode || row.partName || '加工明细'}的本次交出数量无效。`)
        if (qty > remainingQty) throw new Error(`${row.feiTicketNo || row.skuCode || row.partName || '加工明细'}的交出数量不能超过剩余可交数量。`)
        return { row, qty }
      })
      const lineHandoverSkuQtyBySkuCode = lineHandoverQtyEntries.some(({ row }) => Boolean(row.skuCode))
        ? Object.fromEntries(lineHandoverQtyEntries.filter(({ row }) => row.skuCode).map(({ row, qty }) => [row.skuCode!, qty]))
        : undefined
      const lineHandoverFeiQtyByTicketNo = lineHandoverQtyEntries.some(({ row }) => Boolean(row.feiTicketNo))
        ? Object.fromEntries(lineHandoverQtyEntries.filter(({ row }) => row.feiTicketNo).map(({ row, qty }) => [row.feiTicketNo!, qty]))
        : undefined
      const skuQtyBySkuCode = physicalSkuQtyBySkuCode || garmentSkuQtyBySkuCode || lineHandoverSkuQtyBySkuCode
      const feiQtyByTicketNo = physicalFeiQtyByTicketNo || lineHandoverFeiQtyByTicketNo || (objectMeta.objectType !== '成衣'
        && action !== 'special-complete-order'
        && (!isButtonLoop || action === 'special-confirm-receive')
        ? Object.fromEntries((workOrder.lineProgress || [])
            .filter((row) => row.lineType === 'fei-ticket' && row.feiTicketNo)
            .map((row) => [
              row.feiTicketNo!,
              action === 'special-confirm-receive'
                ? Math.max(row.planQty - row.receivedQty, 0)
                : action === 'special-process-report'
                  ? Math.max(row.receivedQty - row.completedQty, 0)
                  : Math.max(row.completedQty - row.returnedQty, 0),
            ]))
        : undefined)
      const skuScrapQtyBySkuCode = garmentSkuDraft && action === 'special-process-report'
        ? Object.fromEntries(garmentSkuDraft.lines.map((line) => [line.skuCode, Number(garmentSkuDraft.drafts[line.draftKey].scrapQty)]))
        : undefined
      const skuDamageQtyBySkuCode = garmentSkuDraft && action === 'special-process-report'
        ? Object.fromEntries(garmentSkuDraft.lines.map((line) => [line.skuCode, Number(garmentSkuDraft.drafts[line.draftKey].damageQty)]))
        : undefined
      const skuActionQty = skuQtyBySkuCode ? Object.values(skuQtyBySkuCode).reduce((sum, qty) => sum + qty, 0) : undefined
      const feiActionQty = feiQtyByTicketNo ? Object.values(feiQtyByTicketNo).reduce((sum, qty) => sum + qty, 0) : undefined
      const genericHandoverQty = physicalScanQty ?? Number(detailState.specialCraftHandoverQty)
      if (action === 'special-submit-handover'
        && objectMeta.objectType !== '成衣'
        && objectMeta.objectType !== '辅料'
        && !isButtonLoop) {
        const handoverQty = skuActionQty ?? feiActionQty ?? genericHandoverQty
        if (!Number.isFinite(handoverQty) || handoverQty <= 0) {
          throw new Error('请填写至少一条大于 0 的本次交出数量。')
        }
      }
      const buttonLoopQty = action === 'special-submit-handover' && physicalScanQty !== undefined
        ? physicalScanQty
        : Number(detailState.specialCraftButtonLoopQty)
      if (isButtonLoop && (action === 'special-process-report' || action === 'special-submit-handover')) {
        if (!Number.isInteger(buttonLoopQty) || buttonLoopQty <= 0) {
          throw new Error('请填写本次盘扣产出或交出的正整数个数。')
        }
      }
      const accessoryQty = physicalScanQty ?? Number(detailState.specialCraftAccessoryQty)
      if (objectMeta.objectType === '辅料' && action !== 'special-complete-order') {
        if (!Number.isFinite(accessoryQty) || accessoryQty <= 0) {
          throw new Error('请填写本次实际数量。')
        }
        if (action !== 'special-confirm-receive' && !Number.isInteger(accessoryQty)) {
          throw new Error('定长橡筋产出和交出数量必须为整数条。')
        }
      }
      const finishQty = skuActionQty ?? Math.max(
          baseQty - Number(detailState.specialCraftScrapQty || 0) - Number(detailState.specialCraftDamageQty || 0),
          0,
        )
      const operatedAt = nowTimestamp()
      const scanEvidenceText = physicalScanLines.length
        ? `；实物码：${physicalScanLines.map((line) => line.code).join('、')}`
        : ''
      const actionResult = executeMobileProcessAction({
        sourceType: 'SPECIAL_CRAFT',
        sourceId,
        taskId: sourceTaskId,
        actionCode: actionCodeMap[action],
        confirmationKey,
        ...actionAudit,
        operatedAt,
        objectType: isButtonLoop && action !== 'special-confirm-receive' ? '盘扣' : objectMeta.objectType,
        objectQty: physicalScanQty ?? (objectMeta.objectType === '辅料' && action !== 'special-complete-order'
          ? accessoryQty
          : isButtonLoop && (action === 'special-process-report' || action === 'special-submit-handover')
          ? buttonLoopQty
          : action === 'special-submit-handover' && skuActionQty === undefined && feiActionQty === undefined
            ? genericHandoverQty
          : skuActionQty ?? feiActionQty ?? (action === 'special-process-report' ? finishQty || baseQty : baseQty)),
        qtyUnit: physicalScanLines[0]?.unit || (objectMeta.objectType === '辅料'
          ? action === 'special-confirm-receive' ? workOrder.inputUnit || '米' : workOrder.outputUnit || workOrder.unit || '条'
          : isButtonLoop && action === 'special-confirm-receive' ? '张' : objectMeta.qtyUnit),
        skuQtyBySkuCode,
        feiQtyByTicketNo,
        skuScrapQtyBySkuCode,
        skuDamageQtyBySkuCode,
        remark: `${action === 'special-submit-handover'
          ? detailState.specialCraftHandoverRemark.trim() || '移动端发起交出'
          : `移动端${actionLabelMap[action]}`}${scanEvidenceText}`,
      })
      const scanBatch = physicalScanContext
        ? commitPdaPhysicalScanBatch({
            ...physicalScanContext,
            businessRecordIds: [actionResult.operationRecordId, actionResult.affectedHandoverRecordId || ''],
            operatorName: actionAudit.operatorName,
            committedAt: operatedAt,
          })
        : null
      if (isButtonLoop && (action === 'special-process-report' || action === 'special-submit-handover')) {
        detailState.specialCraftButtonLoopQty = ''
      }
      if (objectMeta.objectType === '辅料' && action !== 'special-complete-order') {
        detailState.specialCraftAccessoryQty = ''
      }
      if (action === 'special-submit-handover') clearSpecialCraftHandoverDrafts(workOrder.taskOrderId)
      showPdaExecDetailToast(`特殊工艺${actionLabelMap[action]}已记录（${actionResult.operationRecordId}${scanBatch ? ` / ${scanBatch.scanBatchId}` : ''}）`)
      window.dispatchEvent(new CustomEvent('higood:request-render'))
      return true
    } catch (error) {
      showPdaExecDetailToast(error instanceof Error ? error.message : '特殊工艺写回失败')
      return true
    }
  }

  if (
    action === 'post-project-start'
    || action === 'post-project-complete'
  ) {
    try {
      const postOrderId = actionNode.dataset.postOrderId
      const projectLineId = actionNode.dataset.projectLineId
      if (!postOrderId || !projectLineId) return true
      if (action === 'post-project-start') {
        startPostFinishingProjectLine({
          postOrderId,
          projectLineId,
          operatorName: getPdaSession()?.userName || '现场操作员',
        })
        showPdaExecDetailToast('后道项目已开始')
        return true
      }
      completePostFinishingProjectLine({
        postOrderId,
        projectLineId,
        operatorName: getPdaSession()?.userName || '现场操作员',
        completedQty: Number(actionNode.dataset.projectPlannedQty || '0'),
      })
      showPdaExecDetailToast('后道项目已完成')
      return true
    } catch (error) {
      showPdaExecDetailToast(error instanceof Error ? error.message : 'PDA 后道操作失败')
      return true
    }
  }

  if (
    action === 'post-start-action'
    || action === 'post-finish-action'
    || action === 'post-report-difference'
  ) {
    const postOrderId = actionNode.dataset.postOrderId
    const postTaskId = actionNode.dataset.taskId
    const actionType = actionNode.dataset.postActionType as PostFinishingActionType | undefined
    if (!postOrderId) return true

    try {
      if (action === 'post-report-difference') {
        const expectedText = window.prompt('请输入应收成衣件数', '0')?.trim() || ''
        const actualText = window.prompt('请输入实收成衣件数', '0')?.trim() || ''
        const diffText = window.prompt('请输入差异成衣件数', '0')?.trim() || ''
        const expectedQty = Number(expectedText)
        const actualQty = Number(actualText)
        const diffQty = Number(diffText)
        if (!Number.isFinite(expectedQty) || !Number.isFinite(actualQty) || !Number.isFinite(diffQty) || diffQty <= 0) {
          showPdaExecDetailToast('请填写有效差异成衣件数')
          return true
        }
        executeMobileProcessAction({
          sourceType: 'POST_FINISHING',
          sourceId: postOrderId,
          taskId: postTaskId,
          actionCode: 'POST_REPORT_DIFFERENCE',
          operatorName: getPdaSession()?.userName || '现场操作员',
          operatedAt: nowTimestamp(),
          objectType: '成衣',
          objectQty: diffQty,
          qtyUnit: '件',
          formData: {
            应收成衣件数: expectedQty,
            实收成衣件数: actualQty,
            差异成衣件数: diffQty,
            差异类型: '数量差异',
            原因: '移动端上报后道差异',
          },
          remark: '移动端上报后道差异',
        })
        showPdaExecDetailToast('后道差异已通过统一写回上报')
        return true
      }

      if (!actionType) return true

      if (actionType === '质检') {
        showPdaExecDetailToast('后道质检仅在 Web“质检任务”执行')
        return true
      }

      if (actionType === '复检') {
        appStore.navigate('/fcs/pda/post-finishing/recheck')
        return true
      }

      if (action === 'post-start-action') {
        executeMobileProcessAction({
          sourceType: 'POST_FINISHING',
          sourceId: postOrderId,
          taskId: postTaskId,
          actionCode: actionNode.dataset.postActionCode || getPostFinishingActionCode(actionType, 'start'),
          operatorName: getPdaSession()?.userName || '现场操作员',
          operatedAt: nowTimestamp(),
          objectType: '成衣',
          objectQty: getPostFinishingWorkOrderForMobile(postOrderId)?.plannedGarmentQty || 1,
          qtyUnit: '件',
          remark: `移动端${getPostFinishingActionLabel(actionType, 'start')}`,
        })
        showPdaExecDetailToast(`${getPostFinishingActionLabel(actionType, 'start')}已通过统一写回记录`)
        return true
      }

      const qtyPrompt = '请输入完成成衣件数'
      const qtyText = window.prompt(qtyPrompt, '0')?.trim() || ''
      const submittedQty = Number(qtyText)
      if (!Number.isFinite(submittedQty) || submittedQty <= 0) {
        showPdaExecDetailToast(qtyPrompt)
        return true
      }
      const acceptedQty = submittedQty
      executeMobileProcessAction({
        sourceType: 'POST_FINISHING',
        sourceId: postOrderId,
        taskId: postTaskId,
        actionCode: actionNode.dataset.postActionCode || getPostFinishingActionCode(actionType, 'finish'),
        operatorName: getPdaSession()?.userName || '现场操作员',
        operatedAt: nowTimestamp(),
        objectType: '成衣',
        objectQty: submittedQty,
        qtyUnit: '件',
        remark: `移动端${getPostFinishingActionLabel(actionType, 'finish')}，确认 ${acceptedQty} 件`,
      })
      showPdaExecDetailToast(`${getPostFinishingActionLabel(actionType, 'finish')}已通过统一写回同步 Web`)
      return true
    } catch (error) {
      showPdaExecDetailToast(error instanceof Error ? error.message : '后道写回失败')
      return true
    }
  }

  if (action === 'post-go-handover') {
    appStore.navigate('/fcs/pda/handover?tab=pickup')
    return true
  }

  if (action === 'post-task-open-order') {
    const postOrderId = actionNode.dataset.postOrderId
    if (!postOrderId) return true
    appStore.navigate(`/fcs/pda/exec/${encodeURIComponent(postOrderId)}`)
    return true
  }

  if (action === 'sewing-post-start' || action === 'sewing-post-finish' || action === 'sewing-post-transfer') {
    const taskId = actionNode.dataset.sewingPostTaskId
    if (!taskId) return true
    try {
      if (action === 'sewing-post-start') {
        startSewingFactoryPostTask(taskId)
        showPdaExecDetailToast('车缝工厂后道已开始')
        return true
      }
      if (action === 'sewing-post-finish') {
        const qtyText = window.prompt('请输入实际工序完成成衣件数', '0')?.trim() || ''
        const completedQty = Number(qtyText)
        if (!Number.isFinite(completedQty) || completedQty <= 0) {
          showPdaExecDetailToast('请填写有效实际工序完成成衣件数')
          return true
        }
        finishSewingFactoryPostTask(taskId, completedQty)
        showPdaExecDetailToast('车缝工厂后道完成，待交给后道工厂')
        return true
      }
      transferSewingFactoryPostTaskToManagedFactory(taskId)
      showPdaExecDetailToast('已交给后道工厂，后道工厂将扫码收货后质检和复检')
      return true
    } catch (error) {
      showPdaExecDetailToast(error instanceof Error ? error.message : '车缝后道写回失败')
      return true
    }
  }

  if (action === 'add-proof-image') {
    const scope = (actionNode.dataset.proofScope as 'start' | 'milestone' | 'pause' | undefined) || 'start'
    addProofFile(scope, 'IMAGE')
    showPdaExecDetailToast('图片已添加')
    return true
  }

  if (action === 'add-proof-video') {
    const scope = (actionNode.dataset.proofScope as 'start' | 'milestone' | 'pause' | undefined) || 'start'
    addProofFile(scope, 'VIDEO')
    showPdaExecDetailToast('视频已添加')
    return true
  }

  if (action === 'remove-proof') {
    const proofId = actionNode.dataset.proofId
    const scope = (actionNode.dataset.proofScope as 'start' | 'milestone' | 'pause' | undefined) || 'start'
    if (proofId) {
      removeProofFile(scope, proofId)
    }
    return true
  }

  if (action === 'open-start-dialog') {
    navigateExecDetailAction('start')
    return true
  }

  if (action === 'open-milestone-dialog') {
    navigateExecDetailAction('milestone')
    return true
  }

  if (action === 'open-pause-dialog') {
    detailState.fromPauseAction = true
    navigateExecDetailAction('pause')
    return true
  }

  if (action === 'close-detail-dialog' || action === 'close-start-dialog') {
    clearExecDetailAction()
    return true
  }

  if (action === 'confirm-start') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    const task = getTaskFactById(taskId)
    if (!task) return true
    if (isKolGotoWholeOrderTask(task)) {
      showPdaExecDetailToast('KOL 整单任务不能手工开工；首次加工领料后系统自动开工。')
      return true
    }
    const processType = getMobileTaskProcessType(task)
    if (processType === 'PRINT' || processType === 'DYE' || processType === 'WATER_SOLUBLE') {
      showPdaExecDetailToast('请在加工单当前节点中执行操作，不能使用通用任务开工。')
      return true
    }
    const access = getMobileTaskAccessResult(task, getPdaSession()?.factoryId || task.assignedFactoryId || TEST_FACTORY_ID)
    if (!access.canExecuteInMobile) {
      showPdaExecDetailToast(`当前任务不可执行：${access.reasonLabel}`)
      return true
    }

    const prereq = getStartPrerequisite(task)

    if (!prereq.met) {
      showPdaExecDetailToast(`无法开工：${prereq.blocker}`)
      return true
    }

    if (!detailState.startTime) {
      showPdaExecDetailToast('请填写开工时间')
      return true
    }

    const startTime = toStoreDateTime(detailState.startTime)
    const startMs = parseDateMs(startTime)
    if (Number.isNaN(startMs) || startMs > Date.now()) {
      showPdaExecDetailToast('开工时间不能晚于当前时间')
      return true
    }

    const startRule = getTaskStartRuleState(task)
    if (startRule.required && !isProofRequirementSatisfied(startRule.proofRequirement, detailState.startProofFiles)) {
      showPdaExecDetailToast(`请按配置补充开工凭证：${startRule.proofRequirementLabel}`)
      return true
    }

    const headcount = undefined
    mutateStartTask(taskId, 'PDA', {
      startTime,
      headcount,
      proofFiles: detailState.startProofFiles,
    })
    let startToast = '开工成功'
    try {
      if (getDyeWorkOrderByTaskId(taskId)) {
        startToast = '开工成功'
      } else {
        const ensured = ensureHandoverOrderForStartedTask(taskId)
        const updatedTask = getTaskFactById(taskId) as TaskWithHandoverFields | null
        const handoverOrder = getHandoverOrderById(ensured.handoverOrderId) ?? null
        if (updatedTask) {
          syncTaskHandoverFields(updatedTask, handoverOrder)
        }
        startToast = ensured.created ? '开工成功，交出单已生成' : '开工成功，交出单已就绪'
      }
    } catch {
      startToast = '开工成功'
    }
    syncPdaStartRiskAndExceptions()
    syncMilestoneOverdueExceptions()
    showPdaExecDetailToast(startToast)
    return true
  }

  if (action === 'report-milestone') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    const task = getTaskFactById(taskId)
    if (!task) return true
    if (isKolGotoWholeOrderTask(task)) {
      showPdaExecDetailToast('KOL 整单任务不使用关键节点上报。')
      return true
    }

    if (!detailState.milestoneTime) {
      showPdaExecDetailToast('请填写关键节点上报时间')
      return true
    }

    const reportAt = toStoreDateTime(detailState.milestoneTime)
    const reportMs = parseDateMs(reportAt)
    if (Number.isNaN(reportMs) || reportMs > Date.now()) {
      showPdaExecDetailToast('上报时间不能晚于当前时间')
      return true
    }

    if (!isTaskMilestoneProofSatisfied(task, detailState.milestoneProofFiles)) {
      const milestone = getTaskMilestoneState(task)
      const proofHint =
        milestone.proofRequirement === 'IMAGE'
          ? '请至少上传 1 项关键节点图片凭证'
          : milestone.proofRequirement === 'VIDEO'
            ? '请至少上传 1 项关键节点视频凭证'
            : '请至少上传 1 项关键节点凭证（图片或视频任选其一）'
      showPdaExecDetailToast(proofHint)
      return true
    }

    const result = reportTaskMilestone(taskId, {
      reportedAt: reportAt,
      proofFiles: detailState.milestoneProofFiles,
      by: 'PDA',
    })
    showPdaExecDetailToast(result.message)
    return true
  }

  if (action === 'report-pause-entry') {
    detailState.fromPauseAction = true
    navigateExecDetailAction('pause')
    return true
  }

  if (action === 'report-pause') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true
    const task = getTaskFactById(taskId)
    if (!task) return true
    if (isKolGotoWholeOrderTask(task)) {
      showPdaExecDetailToast('KOL 整单任务不使用暂停上报。')
      return true
    }

    if (!detailState.pauseTime) {
      showPdaExecDetailToast('请填写暂停上报时间')
      return true
    }

    const reportAt = toStoreDateTime(detailState.pauseTime)
    const reportMs = parseDateMs(reportAt)
    if (Number.isNaN(reportMs) || reportMs > Date.now()) {
      showPdaExecDetailToast('上报时间不能晚于当前时间')
      return true
    }

    if (detailState.pauseProofFiles.length < 1) {
      showPdaExecDetailToast('请至少上传 1 项暂停凭证')
      return true
    }

    const result = reportTaskPause(taskId, {
      reasonCode: detailState.pauseReasonCode,
      remark: detailState.pauseRemark.trim(),
      reportedAt: reportAt,
      proofFiles: detailState.pauseProofFiles,
      by: 'PDA',
    })
    if (result.ok) {
      detailState.fromPauseAction = false
    }
    showPdaExecDetailToast(result.message)
    return true
  }

  if (action === 'finish-task') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    const task = getTaskFactById(taskId)
    if (!task) return true
    if (isKolGotoWholeOrderTask(task)) {
      showPdaExecDetailToast('KOL 整单任务只能通过“完成”入口结束。')
      return true
    }
    if (getWaterSolubleWorkOrderByTaskId(task.taskId)) {
      showPdaExecDetailToast('请使用页面上的当前水溶动作，不要使用通用完工')
      return true
    }
    const access = getMobileTaskAccessResult(task, getPdaSession()?.factoryId || task.assignedFactoryId || TEST_FACTORY_ID)
    if (!access.canExecuteInMobile) {
      showPdaExecDetailToast(`当前任务不可执行：${access.reasonLabel}`)
      return true
    }
    if (!isTaskMilestoneReported(task)) {
      showPdaExecDetailToast('请先完成关键节点上报')
      return true
    }

    const displayProcessName = getTaskProcessDisplayName(task)
    const specialCraftBindings = getSpecialCraftExecBindings(task)
    const specialCraftWorkOrder = getSpecialCraftWorkOrderForPdaTask(task, specialCraftBindings)
    if (isSpecialCraftExecutionTask(task, displayProcessName) && specialCraftWorkOrder) {
      if (specialCraftWorkOrder.quantityMode === 'TICKET_INPUT_OUTPUT') {
        showPdaExecDetailToast('盘扣加工请使用“加工填报”填写产出个数，再从“交接”发起交出；不要使用通用完工。')
        return true
      }
      const scrapQty = Number(detailState.specialCraftScrapQty || 0)
      const damageQty = Number(detailState.specialCraftDamageQty || 0)
      if (!Number.isFinite(scrapQty) || scrapQty < 0 || !Number.isFinite(damageQty) || damageQty < 0) {
        showPdaExecDetailToast('请填写有效报废和货损数量')
          return true
      }
      const objectMeta = resolveSpecialCraftPdaObjectMeta(specialCraftWorkOrder)
      const sourceBinding = objectMeta.requiresFeiTicket ? specialCraftBindings[0] : undefined
      const baseQty = getSpecialCraftPdaBaseQty(task, specialCraftWorkOrder, sourceBinding, objectMeta)
      const garmentSkuDraft = objectMeta.objectType === '成衣'
        ? getSpecialCraftGarmentSkuDrafts(specialCraftWorkOrder.taskOrderId, specialCraftWorkOrder.status)
        : undefined
      const skuQtyBySkuCode = garmentSkuDraft
        ? Object.fromEntries(garmentSkuDraft.lines.map((line) => [line.skuCode, Number(garmentSkuDraft.drafts[line.draftKey].completedQty)]))
        : undefined
      const skuScrapQtyBySkuCode = garmentSkuDraft
        ? Object.fromEntries(garmentSkuDraft.lines.map((line) => [line.skuCode, Number(garmentSkuDraft.drafts[line.draftKey].scrapQty)]))
        : undefined
      const skuDamageQtyBySkuCode = garmentSkuDraft
        ? Object.fromEntries(garmentSkuDraft.lines.map((line) => [line.skuCode, Number(garmentSkuDraft.drafts[line.draftKey].damageQty)]))
        : undefined
      const garmentCompletedQty = skuQtyBySkuCode ? Object.values(skuQtyBySkuCode).reduce((sum, qty) => sum + qty, 0) : undefined
      const actionAudit = getCurrentPdaProcessActionAudit()
      executeMobileProcessAction({
        sourceType: 'SPECIAL_CRAFT',
        sourceId: specialCraftWorkOrder.taskOrderId,
        taskId,
        actionCode: 'SPECIAL_CRAFT_PROCESS_REPORT',
        ...actionAudit,
        operatedAt: nowTimestamp(),
        objectType: objectMeta.objectType,
        objectQty: garmentCompletedQty ?? Math.max(baseQty - scrapQty - damageQty, 0),
        qtyUnit: objectMeta.qtyUnit,
        skuQtyBySkuCode,
        skuScrapQtyBySkuCode,
        skuDamageQtyBySkuCode,
        remark: `移动端加工填报，完成${objectMeta.objectLabel}数量${garmentCompletedQty ?? Math.max(baseQty - scrapQty - damageQty, 0)}${objectMeta.qtyUnit}`,
      })
      detailState.specialCraftScrapQty = '0'
      detailState.specialCraftDamageQty = '0'
      showPdaExecDetailToast('特殊工艺加工填报已同步，请继续发起交出或完成加工单')
      return true
    }

    mutateFinishTask(taskId, 'PDA')
    showPdaExecDetailToast('完工成功')
    return true
  }

  return false
}

export function closePdaExecDetailDialogsOnEscape(): boolean {
  return closeKolGotoPdaExecDialogsOnEscape()
}
