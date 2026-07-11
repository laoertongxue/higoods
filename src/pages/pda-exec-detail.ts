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
  getSpecialCraftFeiTicketScanSummary,
  listCuttingSpecialCraftFeiTicketBindings,
} from '../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import { getSpecialCraftTaskWorkOrderById } from '../data/fcs/special-craft-task-orders.ts'
import {
  getDifferenceRecordsByWorkOrderId,
  getHandoverRecordsByWorkOrderId,
  getWarehouseRecordsByWorkOrderId,
} from '../data/fcs/process-warehouse-domain.ts'
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
import {
  acceptWoolWorkOrder,
  completeWoolPickupHead,
  confirmWoolHandoverReceipt,
  confirmWoolPickupRecord,
  getWoolAllowedActions,
  getWoolWorkOrderByTaskId,
  getWoolWorkOrderKindLabel,
  getWoolWorkOrderStatusLabel,
  getWoolYarnUsageSummary,
  markWoolFeiTicketsPrinted,
  scheduleWoolMachines,
  submitWoolHandover,
  updateWoolWorkOrderNodeStatus,
  type WoolNodeStatus,
  type WoolWorkOrder,
} from '../data/fcs/wool-task-domain.ts'
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
  formatProcessQuantityWithUnit,
  getQuantityLabel,
} from '../data/fcs/process-quantity-labels.ts'
import type {
  PostFinishingActionType,
  PostFinishingQcPostProjectJudgement,
  PostFinishingQcSkuResult,
  PostFinishingRecheckSkuResult,
  PostFinishingTaskView,
  PostFinishingWaitQcSkuItem,
  PostFinishingWorkOrder,
  SewingFactoryPostTask,
} from '../data/fcs/post-finishing-domain.ts'
import {
  completePostFinishingProjectLine,
  completePostFinishingQcOrder,
  completePostFinishingRecheckOrder,
  createPostFinishingQcOrder,
  getPostFinishingFlowText,
  getPostFinishingSourceLabel,
  getPostFinishingTaskById,
  getSewingFactoryPostTaskById,
  listPostFinishingQcOrderEntities,
  listPostFinishingRecheckOrderEntities,
  listPostFinishingWaitQcSkuItems,
  listPostFinishingWorkOrders,
  listSewingFactoryPostTasks,
  finishSewingFactoryPostTask,
  startPostFinishingProjectLine,
  startSewingFactoryPostTask,
  submitPostFinishingPdaQcResult,
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
} from '../data/fcs/process-mobile-task-binding.ts'
import { canFactoryAccessSpecialCraftPdaTask } from '../data/fcs/special-craft-pda-scope.ts'
import { getPdaSession } from '../data/fcs/store-domain-pda.ts'
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

interface PdaExecDetailState {
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
  waterCompletionDraft: { orderId: string; completedQty: string; reason: string }
  waterOverlay: null | {
    type: 'completion' | 'completion-overage' | 'supervisor'
    orderId: string
    expectedStatus: WaterSolubleWorkOrder['status']
    token: string
  }
  dyeWaterDraft: { dyeOrderId: string; outputQty: string; reason: string }
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
  waterCompletionDraft: { orderId: '', completedQty: '', reason: '' },
  waterOverlay: null,
  dyeWaterDraft: { dyeOrderId: '', outputQty: '', reason: '' },
  dyeWaterOverlay: null,
}

let waterOverlaySequence = 0
const waterPrimaryActionTokens = new Map<string, string>()
const pendingWaterActions = new Set<string>()
let dyeWaterOverlaySequence = 0
const dyeWaterPrimaryActionTokens = new Map<string, string>()
const pendingDyeWaterActions = new Set<string>()

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

function renderWaterSolubleOverlay(): string {
  const overlay = detailState.waterOverlay
  if (!overlay) return ''
  const actualOrder = getWaterSolubleWorkOrderById(overlay.orderId)
  if (!actualOrder) return ''
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
  detailState.waterCompletionDraft = { orderId: '', completedQty: '', reason: '' }
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
  if (!handoverOrder && started && canTaskUseHandover(task)) {
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
            relatedProductionOrderNo: printOrder.productionOrderIds?.[0] || task.productionOrderId,
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
                      relatedProductionOrderNo: handoverOrder?.productionOrderNo || printOrder.productionOrderIds?.[0] || task.productionOrderId,
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

function canOperateDyeingNode(task: ProcessTask): boolean {
  const currentFactoryId = getPdaSession()?.factoryId || task.assignedFactoryId || TEST_FACTORY_ID
  return isMobileTaskVisibleForFactory(task, currentFactoryId) && task.status !== 'NOT_STARTED' && task.status !== 'CANCELLED'
}

function getExecDetailSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, queryString = ''] = pathname.split('?')
  return new URLSearchParams(queryString)
}

function resolveExecDetailBackHref(task?: ProcessTask | null): string {
  const searchParams = getExecDetailSearchParams()
  const returnTo = searchParams.get('returnTo')
  if (returnTo && returnTo.startsWith('/fcs/pda/exec')) {
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
    || (order.status === 'WAIT_VAT_PLAN' && Boolean(waterNode?.finishedAt))
  )
}

function getCombinedDyePrimaryAction(order: DyeWorkOrder): { action: string; label: string; role: WaterSolublePdaRoleAction; node: 'WATER_SOLUBLE' | 'DYE' } | null {
  if (order.status === 'WAIT_WATER_SOLUBLE') return { action: 'dye-water-start', label: '开始水溶', role: 'OPERATE', node: 'WATER_SOLUBLE' }
  if (order.status === 'WATER_SOLUBLE_IN_PROGRESS') return { action: 'dye-water-complete', label: '完成水溶', role: 'OPERATE', node: 'WATER_SOLUBLE' }
  if (order.status === 'PRODUCTION_PAUSED') return { action: 'dye-water-open-supervisor', label: '处理数量不足', role: 'SUPERVISE', node: 'WATER_SOLUBLE' }
  if (order.status === 'WAIT_VAT_PLAN' && getDyeExecutionNodeRecord(order.dyeOrderId, 'WATER_SOLUBLE')?.finishedAt) return { action: 'dye-water-start-dye', label: '开始染色', role: 'OPERATE', node: 'DYE' }
  return null
}

function renderCombinedDyeWaterOverlay(): string {
  const overlay = detailState.dyeWaterOverlay
  if (!overlay) return ''
  const order = getDyeWorkOrderById(overlay.dyeOrderId)
  if (!order) return ''
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
  const actorAllowed = Boolean(action && session && !validateWaterSolublePdaActor(session, order.dyeFactoryId, action.role))
  const token = `${order.dyeOrderId}:${order.status}:${order.updatedAt}`
  dyeWaterPrimaryActionTokens.set(order.dyeOrderId, token)
  const waterNode = getDyeExecutionNodeRecord(order.dyeOrderId, 'WATER_SOLUBLE')
  const records = listDyeExecutionNodeRecords(order.dyeOrderId)
  const stepLabel = order.status === 'WAIT_VAT_PLAN' && waterNode?.finishedAt ? '待染色' : getDyeWorkOrderStatusLabel(order.status)
  let primary = action && actorAllowed
    ? `<button type="button" class="min-h-11 w-full rounded-lg bg-primary px-4 py-3 text-base font-semibold text-primary-foreground disabled:opacity-60" data-pda-execd-action="${action.action}" data-combined-primary-action="true" data-dye-order-id="${escapeHtml(order.dyeOrderId)}" data-task-id="${escapeHtml(task.taskId)}" data-expected-status="${escapeHtml(order.status)}" data-expected-node="${action.node}" data-action-token="${escapeHtml(token)}">${escapeHtml(action.label)}</button>`
    : `<div class="text-sm text-blue-800">${order.status === 'PRODUCTION_PAUSED' ? '等待生产主管处理数量不足。' : '当前账号不能执行此动作。'}</div>`
  primary = primary.replace('<button ', '<button data-skip-page-rerender="true" ')
  return `<article class="rounded-lg border bg-card" data-testid="pda-combined-dye-current-action"><header class="border-b px-4 py-3"><div class="flex items-center justify-between gap-2"><h2 class="text-sm font-semibold">染色加工（含水溶）</h2>${renderPrintingStatusBadge(stepLabel, order.status === 'PRODUCTION_PAUSED' ? 'danger' : 'info')}</div></header><div class="space-y-4 p-4"><div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs"><span class="text-muted-foreground">当前物料</span><span class="font-medium">${escapeHtml(order.rawMaterialSku)}</span><span class="text-muted-foreground">计划数量</span><span>${order.waterSolublePlannedQty ?? order.plannedQty} ${escapeHtml(order.waterSolubleQtyUnit || order.qtyUnit)}</span><span class="text-muted-foreground">水溶完成</span><span>${order.waterSolubleCompletedQty ?? 0} ${escapeHtml(order.waterSolubleQtyUnit || order.qtyUnit)}</span><span class="text-muted-foreground">当前步骤</span><span class="font-medium">${escapeHtml(stepLabel)}</span></div><section class="rounded-lg border border-blue-200 bg-blue-50 p-4"><p class="mb-3 text-xs font-medium text-blue-800">现在要做：${escapeHtml(action?.label || '等待主管处理')}</p>${primary}</section><details class="rounded-lg border bg-background"><summary class="cursor-pointer px-4 py-3 text-sm font-medium">完整执行记录（${records.length} 条）</summary><div class="space-y-2 border-t p-4">${records.map((record) => `<div class="text-xs"><span class="font-medium">${escapeHtml(record.nodeName)}</span><span class="ml-2 text-muted-foreground">${escapeHtml(record.finishedAt ? '已完成' : record.startedAt ? '进行中' : '待开始')}</span></div>`).join('') || '<div class="text-xs text-muted-foreground">暂无执行记录</div>'}</div></details></div><div data-testid="pda-combined-dye-overlay">${renderCombinedDyeWaterOverlay()}</div></article>`
}

function refreshCombinedDyeCurrentAction(dyeOrderId: string): void {
  if (typeof document === 'undefined') return
  const order = getDyeWorkOrderById(dyeOrderId)
  const task = order ? getTaskFactById(order.taskId) : null
  const node = document.querySelector<HTMLElement>('[data-testid="pda-combined-dye-current-action"]')
  if (order && task && node && shouldRenderCombinedDyeCurrentAction(order)) node.outerHTML = renderCombinedDyeCurrentActionCard(task as TaskWithHandoverFields, order)
}

function refreshCombinedDyeOverlay(): void {
  if (typeof document === 'undefined') return
  const node = document.querySelector<HTMLElement>('[data-testid="pda-combined-dye-overlay"]')
  if (node) node.innerHTML = renderCombinedDyeWaterOverlay()
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
  const canOperate = canOperateDyeingNode(task)
  const sampleReady = !dyeOrder.isFirstOrder || Boolean(dyeOrder.sampleWaitFinishedAt) || dyeOrder.sampleWaitType === 'NONE'
  const canPlanVat = Boolean(materialReadyNode?.finishedAt) && (dyeOrder.sampleStatus === 'DONE' || dyeOrder.sampleStatus === 'NOT_REQUIRED')

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
    <article class="rounded-lg border bg-card">
      <header class="border-b px-4 py-3">
        <div class="flex items-center justify-between gap-2">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <i data-lucide="droplets" class="h-4 w-4"></i>
            染色任务
          </h2>
          ${renderPrintingStatusBadge(getDyeWorkOrderStatusLabel(dyeOrder.status), dyeOrder.status === 'FULL_HANDOVER' ? 'success' : dyeOrder.status === 'HANDOVER_DIFFERENCE' ? 'danger' : dyeOrder.status === 'WAIT_HANDOVER' || dyeOrder.status === 'HANDOVER_WAIT_RECEIVE' || dyeOrder.status === 'PARTIAL_HANDOVER' ? 'warning' : 'info')}
        </div>
      </header>

      <div class="space-y-4 p-4 text-sm">
        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
          <span class="text-xs text-muted-foreground">染色加工单</span>
          <span class="text-xs font-medium">${renderPdaObjectCode({
            objectType: 'DYE_WORK_ORDER',
            objectId: dyeOrder.dyeOrderNo,
            relatedProductionOrderNo: dyeOrder.productionOrderIds?.[0] || task.productionOrderId,
          })}</span>
          <span class="text-xs text-muted-foreground">当前状态</span>
          <span class="text-xs">${escapeHtml(getDyeWorkOrderStatusLabel(dyeOrder.status))}</span>
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
                ${!canOperate || !canPlanVat || Boolean(dyeNode?.startedAt) ? 'disabled' : ''}
              >
                开始染色
              </button>
              <button
                class="inline-flex h-8 items-center justify-center rounded-md border text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                data-pda-execd-action="dye-complete-dye"
                data-dye-order-id="${escapeHtml(dyeOrder.dyeOrderId)}"
                ${!canOperate || !dyeNode?.startedAt || Boolean(dyeNode?.finishedAt) ? 'disabled' : ''}
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
                          ${!canOperate || !requireFinished || Boolean(record?.startedAt) ? 'disabled' : ''}
                        >
                          ${escapeHtml(`开始${label}`)}
                        </button>
                        <button
                          class="inline-flex h-7 items-center justify-center rounded-md border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                          data-pda-execd-action="dye-complete-node"
                          data-dye-order-id="${escapeHtml(dyeOrder.dyeOrderId)}"
                          data-node-code="${escapeHtml(code)}"
                          ${!canOperate || !record?.startedAt || Boolean(record?.finishedAt) ? 'disabled' : ''}
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
                      relatedProductionOrderNo: handoverOrder?.productionOrderNo || dyeOrder.productionOrderIds?.[0] || task.productionOrderId,
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
                ${!handoverOrder || (dyeOrder.status !== 'WAIT_HANDOVER' && dyeOrder.status !== 'HANDOVER_WAIT_RECEIVE') ? 'disabled' : ''}
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

function renderWoolTaskCard(
  task: TaskWithHandoverFields,
  woolOrder: WoolWorkOrder,
  handoverOrder: PdaHandoverHead | null,
): string {
  const isPartPanel = woolOrder.kind === 'PART_PANEL'
  const milestone = getTaskMilestoneState(task)
  const allowedActions = getWoolAllowedActions(woolOrder)
  const preStartStatus = ['WAIT_ACCEPT', 'WAIT_PICKUP', 'PICKUP_IN_PROGRESS', 'WAIT_MACHINE_SCHEDULE', 'MACHINE_SCHEDULED'].includes(woolOrder.status)
  const showPickupSection = woolOrder.status !== 'WAIT_ACCEPT'
  const showNodeSection = !preStartStatus
  const showExecutionMeta = !preStartStatus
  const showPartPanelSection = isPartPanel && ['WAIT_FEI_TICKET', 'FEI_TICKET_PRINTED', 'WAIT_HANDOVER', 'HANDOVER_SUBMITTED', 'COMPLETED'].includes(woolOrder.status)
  const renderAllowedActionButton = (action: ReturnType<typeof getWoolAllowedActions>[number]) => `
    <button
      type="button"
      class="rounded-full ${action.tone === 'primary' ? 'border-primary bg-primary px-3 py-1 text-xs text-primary-foreground' : 'border px-3 py-1 text-xs'}"
      data-pda-execd-action="wool-workflow"
      data-wool-workflow-action="${escapeHtml(action.code)}"
      data-wool-order-id="${escapeHtml(woolOrder.woolOrderId)}"
      ${action.nodeName ? `data-node-name="${escapeHtml(action.nodeName)}"` : ''}
    >${escapeHtml(action.label)}</button>
  `
  const yarnDiff = woolOrder.yarnReceipt.differenceWeightKg
  const yarnStatusTone = woolOrder.yarnReceipt.receivedWeightKg <= 0
    ? 'warning'
    : yarnDiff !== 0
      ? 'danger'
      : 'success'
  const yarnStatusText = woolOrder.yarnReceipt.receivedWeightKg <= 0
    ? '待领料'
    : yarnDiff !== 0
      ? '领料有差异'
      : '已领料'
  const visibleNodes = woolOrder.nodes.filter((node) =>
    node.status !== '未开始'
    || allowedActions.some((action) => action.nodeName === node.nodeName),
  )
  const nodeRows = visibleNodes
    .map(
      (node) => `
        <div class="grid grid-cols-[88px_1fr] gap-2 rounded-md border px-3 py-2 text-xs">
          <div class="font-medium">${escapeHtml(node.nodeName)}</div>
          <div class="space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span>${escapeHtml(node.status)}</span>
              <span>${node.completedQty} / ${node.plannedQty} ${escapeHtml(node.unit)}</span>
            </div>
            <div class="text-muted-foreground">开始：${escapeHtml(node.startedAt || '—')}；完成：${escapeHtml(node.finishedAt || '—')}</div>
            ${
              node.machineNos?.length
                ? `<div class="text-muted-foreground">横机：${escapeHtml(node.machineNos.join(' / '))}</div>`
                : ''
            }
            ${node.remark ? `<div class="text-muted-foreground">${escapeHtml(node.remark)}</div>` : ''}
            <div class="mt-2 flex flex-wrap gap-2">
              ${allowedActions.filter((action) => action.nodeName === node.nodeName).map(renderAllowedActionButton).join('') || '<span class="text-muted-foreground">当前节点不可操作</span>'}
            </div>
          </div>
        </div>
      `,
    )
    .join('')
  const currentActionBar = ''
  const partPanelRows = isPartPanel
    ? woolOrder.partPanels
        .map(
          (panel) => `
            <div class="rounded-md border px-3 py-2 text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="font-medium">${escapeHtml(panel.partName)} / ${escapeHtml(panel.sizeCode)}</span>
                <span>${escapeHtml(panel.feiTicketStatus)}</span>
              </div>
              <div class="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
                <span>颜色：${escapeHtml(panel.colorName)}</span>
                <span>完成：${panel.completedPieces} / ${panel.plannedPieces} 片</span>
                <span class="col-span-2">菲票：${escapeHtml(panel.feiTicketNo || '待打印')}</span>
              </div>
            </div>
          `,
        )
        .join('')
    : ''
  const processNote = isPartPanel
    ? '部位毛织只走横机成片和菲票流转，不进入缝盘、熨烫、包装；完成后交裁床待交出仓。'
    : `整件毛织包含缝盘、熨烫；包装${woolOrder.needsPackaging ? '按本单要求执行' : '本单暂不要求'}，完成后交后道工厂。`
  const handoverTargetText = isPartPanel ? '裁床待交出仓' : '后道工厂'
  const yarnUsage = getWoolYarnUsageSummary(woolOrder)

  return `
    <article class="rounded-lg border bg-card">
      <header class="border-b px-4 py-3">
        <div class="flex items-center justify-between gap-2">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <i data-lucide="factory" class="h-4 w-4"></i>
            毛织任务
          </h2>
          ${renderPrintingStatusBadge(getWoolWorkOrderStatusLabel(woolOrder.status), woolOrder.status === 'COMPLETED' ? 'success' : woolOrder.status === 'WAIT_PICKUP' || woolOrder.status === 'PICKUP_IN_PROGRESS' || woolOrder.status === 'WAIT_MACHINE_SCHEDULE' || woolOrder.status === 'MACHINE_SCHEDULED' || woolOrder.status === 'WAIT_HANDOVER' || woolOrder.status === 'HANDOVER_SUBMITTED' ? 'warning' : 'info')}
        </div>
      </header>

      <div class="space-y-4 p-4 text-sm">
        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
          <span class="text-xs text-muted-foreground">毛织加工单</span>
          <span class="text-xs font-medium">${escapeHtml(woolOrder.woolOrderNo)}</span>
          <span class="text-xs text-muted-foreground">任务类型</span>
          <span class="text-xs font-medium">${escapeHtml(getWoolWorkOrderKindLabel(woolOrder.kind))}</span>
          <span class="text-xs text-muted-foreground">款式</span>
          <span class="text-xs">${escapeHtml(woolOrder.styleNo)} / ${escapeHtml(woolOrder.styleName)}</span>
          <span class="text-xs text-muted-foreground">颜色尺码</span>
          <span class="text-xs">${escapeHtml(woolOrder.colorName)} / ${escapeHtml(woolOrder.sizeRange)}</span>
          <span class="text-xs text-muted-foreground">计划数量</span>
          <span class="text-xs">${woolOrder.plannedQty} ${escapeHtml(woolOrder.qtyUnit)}</span>
          <span class="text-xs text-muted-foreground">开工领用纱线</span>
          <span class="text-xs font-medium">${yarnUsage.processingUsageWeightKg} kg</span>
          <span class="text-xs text-muted-foreground">缝盘损耗纱线</span>
          <span class="text-xs font-medium">${yarnUsage.linkingLossWeightKg} kg</span>
          <span class="text-xs text-muted-foreground">回收入仓纱线</span>
          <span class="text-xs font-medium">${yarnUsage.recoveredWeightKg} kg</span>
          <span class="text-xs text-muted-foreground">已完成</span>
          <span class="text-xs">${woolOrder.completedQty} ${escapeHtml(woolOrder.qtyUnit)}</span>
          <span class="text-xs text-muted-foreground">交出对象</span>
          <span class="text-xs font-medium">${escapeHtml(handoverTargetText)}</span>
          <span class="text-xs text-muted-foreground">交出单</span>
          <span class="text-xs">${escapeHtml(handoverOrder?.handoverOrderNo || woolOrder.handoverOrderNo || '未生成')}</span>
          ${
            showExecutionMeta
              ? `
                <span class="text-xs text-muted-foreground">开工状态</span>
                <span class="text-xs font-medium ${task.startedAt ? 'text-green-700' : 'text-amber-700'}">${task.startedAt ? `已开工 ${escapeHtml(task.startedAt)}` : '待开工'}</span>
                <span class="text-xs text-muted-foreground">关键节点</span>
                <span class="text-xs font-medium ${milestone.status === 'REPORTED' ? 'text-green-700' : 'text-amber-700'}">${milestone.status === 'REPORTED' ? '已上报' : '待上报'}</span>
              `
              : `
                <span class="text-xs text-muted-foreground">当前动作</span>
                <span class="text-xs font-medium">${escapeHtml(getWoolWorkOrderStatusLabel(woolOrder.status))}</span>
              `
          }
        </div>
        ${currentActionBar}

        ${
          showPickupSection
            ? `
              <section class="rounded-lg border bg-background p-3">
                <div class="flex items-center justify-between gap-2">
                  <h3 class="text-sm font-medium">领料确认</h3>
                  ${renderPrintingStatusBadge(yarnStatusText, yarnStatusTone)}
                </div>
                <div class="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                  <div><span class="text-muted-foreground">来源：</span>染厂/面料仓送料到厂</div>
                  <div><span class="text-muted-foreground">纱线：</span>${escapeHtml(woolOrder.yarnReceipt.yarnSku)}</div>
                  <div><span class="text-muted-foreground">计划重量：</span>${woolOrder.yarnReceipt.plannedWeightKg} kg</div>
                  <div><span class="text-muted-foreground">实收重量：</span>${woolOrder.yarnReceipt.receivedWeightKg} kg</div>
                  <div><span class="text-muted-foreground">差异重量：</span>${yarnDiff} kg</div>
                  <div><span class="text-muted-foreground">确认人：</span>${escapeHtml(woolOrder.yarnReceipt.receiverName)}</div>
                  <div class="sm:col-span-2"><span class="text-muted-foreground">照片视频：</span>${escapeHtml(woolOrder.yarnReceipt.evidenceText || (woolOrder.yarnReceipt.receivedWeightKg > 0 ? '已按领料记录留存' : '待毛织厂上传称重照片和到货视频'))}</div>
                </div>
              </section>
            `
            : ''
        }

        ${
          preStartStatus && woolOrder.status !== 'WAIT_ACCEPT'
            ? `
              <section class="rounded-lg border bg-background p-3">
                <h3 class="text-sm font-medium">开工前信息</h3>
                <div class="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                  <div><span class="text-muted-foreground">横机排产：</span>${escapeHtml(woolOrder.machineScheduleId ? '已排机' : '待排机')}</div>
                  <div><span class="text-muted-foreground">计划机台：</span>${woolOrder.plannedMachineCount} 台</div>
                  <div><span class="text-muted-foreground">计划开始：</span>${escapeHtml(woolOrder.scheduledStartAt)}</div>
                  <div><span class="text-muted-foreground">计划完成：</span>${escapeHtml(woolOrder.scheduledEndAt)}</div>
                </div>
              </section>
            `
            : ''
        }

        ${
          showNodeSection
            ? `
              <section class="rounded-lg border bg-background p-3">
                <div class="flex items-center justify-between gap-2">
                  <h3 class="text-sm font-medium">当前节点</h3>
                  <span class="text-xs text-muted-foreground">${escapeHtml(processNote)}</span>
                </div>
                <div class="mt-3 space-y-2">${nodeRows || '<div class="text-xs text-muted-foreground">暂无当前可操作节点。</div>'}</div>
              </section>
            `
            : ''
        }

        ${
          showPartPanelSection
            ? `
                <section class="rounded-lg border bg-background p-3">
                  <div class="flex items-center justify-between gap-2">
                    <h3 class="text-sm font-medium">部位菲票</h3>
                    <span class="text-xs text-muted-foreground">完成后按菲票交裁床待交出仓</span>
                  </div>
                  <div class="mt-3 space-y-2">${partPanelRows}</div>
                </section>
              `
            : ''
        }
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
    return {
      label,
      valueText: `${label}：${woolOrder.plannedQty} ${woolOrder.qtyUnit}`,
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
    { id: 'sp-005', type: 'IMAGE', name: '整烫区就位.jpg', uploadedAt: '2026-03-08 09:06:00' },
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

function getWoolOrderForTask(task: ProcessTask | null | undefined): WoolWorkOrder | undefined {
  if (!task) return undefined
  return getWoolWorkOrderByTaskId(task.taskId)
}

function promptWoolKgValue(label: string, currentValue = 0, allowZero = true): number | null {
  const value = window.prompt(label, String(currentValue))?.trim()
  if (value === undefined) return null
  const qty = Number(value.replace(/kg|公斤/g, '').trim())
  if (!Number.isFinite(qty) || qty < 0 || (!allowZero && qty <= 0)) {
    showPdaExecDetailToast(allowZero ? '请输入大于或等于 0 的重量' : '请输入大于 0 的重量')
    return null
  }
  return Math.round(qty * 100) / 100
}

function startWoolOrderFromMobile(task: ProcessTask, startTime: string, yarnUsageWeightKg?: number): boolean {
  const woolOrder = getWoolOrderForTask(task)
  if (!woolOrder) return false
  updateWoolWorkOrderNodeStatus(woolOrder.woolOrderId, '横机成片', '进行中', '工厂端操作员', startTime, { yarnUsageWeightKg })
  return true
}

function reportWoolMilestoneFromMobile(task: ProcessTask, reportAt: string): boolean {
  const woolOrder = getWoolOrderForTask(task)
  if (!woolOrder) return false
  updateWoolWorkOrderNodeStatus(woolOrder.woolOrderId, '横机成片', '进行中', '工厂端操作员', reportAt)
  return true
}

function finishWoolOrderFromMobile(task: ProcessTask): boolean {
  const woolOrder = getWoolOrderForTask(task)
  if (!woolOrder) return false
  const operatedAt = nowTimestamp()
  if (woolOrder.kind === 'PART_PANEL') {
    updateWoolWorkOrderNodeStatus(woolOrder.woolOrderId, '横机成片', '已完成', '工厂端操作员', operatedAt)
    return true
  }
  const linkingNode = woolOrder.nodes.find((node) => node.nodeName === '缝盘')
  const yarnLossWeightKg = linkingNode && linkingNode.status !== '已完成'
    ? promptWoolKgValue('请输入缝盘损耗纱线数量（kg）', getWoolYarnUsageSummary(woolOrder).linkingLossWeightKg, true)
    : undefined
  if (yarnLossWeightKg === null) return true
  woolOrder.nodes.forEach((node) => {
    if (node.nodeName === '包装' && !woolOrder.needsPackaging) {
      updateWoolWorkOrderNodeStatus(woolOrder.woolOrderId, node.nodeName, '已跳过', '工厂端操作员', operatedAt)
      return
    }
    if (node.status !== '已跳过') {
      updateWoolWorkOrderNodeStatus(
        woolOrder.woolOrderId,
        node.nodeName,
        '已完成',
        '工厂端操作员',
        operatedAt,
        node.nodeName === '缝盘' ? { yarnLossWeightKg } : {},
      )
    }
  })
  return true
}

function isSpecialCraftExecutionTask(task: ProcessTask, displayProcessName = getTaskProcessDisplayName(task)): boolean {
  if (getWoolWorkOrderByTaskId(task.taskId)) return false
  const stage = (task as ProcessTask & { stage?: string; processStage?: string; processCode?: string }).stage
  const processStage = (task as ProcessTask & { processStage?: string; processCode?: string }).processStage
  const processCode = (task as ProcessTask & { processCode?: string }).processCode
  return stage === 'SPECIAL'
    || processStage === 'SPECIAL'
    || processCode === 'SPECIAL_CRAFT'
    || /特殊工艺|绣花|打揽|打条|激光切|烫画|直喷|捆条/.test(displayProcessName)
}

function getSpecialCraftExecBindings(task: ProcessTask) {
  const taskNo = task.taskNo || task.taskId
  const rootTaskNo = task.rootTaskNo || ''
  return listCuttingSpecialCraftFeiTicketBindings().filter((binding) =>
    binding.taskOrderId === task.taskId
    || binding.taskOrderNo === taskNo
    || binding.workOrderId === task.taskId
    || binding.workOrderNo === taskNo
    || binding.taskOrderNo === rootTaskNo
    || binding.workOrderNo === rootTaskNo
    || binding.productionOrderId === task.productionOrderId
    || binding.productionOrderNo === task.productionOrderId,
  )
}

type SpecialCraftPdaObjectMeta = {
  objectType: '面料' | '裁片' | '成衣'
  objectLabel: '面料' | '裁片' | '成衣'
  qtyUnit: '米' | '片' | '件'
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
  return { objectType: '裁片', objectLabel: '裁片', qtyUnit: '片', requiresFeiTicket: true }
}

function getSpecialCraftWorkOrderForPdaTask(task: ProcessTask, bindings = getSpecialCraftExecBindings(task)) {
  const params = getExecDetailSearchParams()
  const querySourceType = params.get('sourceType') || ''
  const querySourceId = params.get('sourceId') || ''
  if (querySourceId && ['SPECIAL_CRAFT', 'SPECIAL_CRAFT_WORK_ORDER'].includes(querySourceType)) {
    const queryWorkOrder = getSpecialCraftTaskWorkOrderById(querySourceId)
    if (queryWorkOrder) return queryWorkOrder
  }

  const sourceInfo = getMobileExecutionTaskSourceInfo(task)
  if (sourceInfo.sourceId) {
    const sourceWorkOrder = getSpecialCraftTaskWorkOrderById(sourceInfo.sourceId)
    if (sourceWorkOrder) return sourceWorkOrder
  }
  if (sourceInfo.sourceWorkOrderId) {
    const sourceWorkOrder = getSpecialCraftTaskWorkOrderById(sourceInfo.sourceWorkOrderId)
    if (sourceWorkOrder) return sourceWorkOrder
  }

  const bindingWorkOrderId = bindings[0]?.workOrderId
  return bindingWorkOrderId ? getSpecialCraftTaskWorkOrderById(bindingWorkOrderId) : undefined
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
}): Array<{ action: string; label: string; primary?: boolean }> {
  const currentStatus = input.workOrderStatus || input.status
  const actions: Array<{ action: string; label: string; primary?: boolean }> = []
  if (input.requiresFeiTicket && input.bindingCount === 0) {
    actions.push({ action: 'special-bind-fei-ticket', label: '绑定菲票', primary: true })
    return actions
  }
  if (['WAITING', 'TODO', '待接收', '待领料'].includes(currentStatus)) {
    actions.push({ action: 'special-receive-cut-pieces', label: `确认接收${input.objectLabel}`, primary: true })
    return actions
  }
  if (['已接收', '待加工', '已入待加工仓'].includes(currentStatus)) {
    actions.push({ action: 'special-start-process', label: '开始加工', primary: true })
    actions.push({ action: 'special-report-difference', label: '上报差异' })
    return actions
  }
  if (currentStatus === 'IN_PROGRESS' || currentStatus === '加工中') {
    actions.push({ action: 'special-finish-process', label: '完成加工', primary: true })
    actions.push({ action: 'special-report-difference', label: '上报差异' })
    return actions
  }
  if (['加工完成', '已完成', '待交出'].includes(currentStatus)) {
    actions.push({ action: 'special-submit-handover', label: '发起交出', primary: true })
    actions.push({ action: 'special-report-difference', label: '上报差异' })
    return actions
  }
  if (['差异', '异议中', '异常', '交出待收货', '收货差异', '需重新交出'].includes(currentStatus)) {
    actions.push({ action: 'special-rework-after-reject', label: '驳回后重交', primary: true })
    actions.push({ action: 'special-report-difference', label: '上报差异' })
  }
  return actions
}

function renderSpecialCraftExecutionPanel(task: ProcessTask, status: string, displayProcessName: string): string {
  const bindings = getSpecialCraftExecBindings(task)
  if (!isSpecialCraftExecutionTask(task, displayProcessName) && bindings.length === 0) return ''

  const workOrder = getSpecialCraftWorkOrderForPdaTask(task, bindings)
  const objectMeta = resolveSpecialCraftPdaObjectMeta(workOrder)
  const firstBinding = objectMeta.requiresFeiTicket ? bindings[0] : undefined
  const summaries = bindings.map((binding) => getSpecialCraftFeiTicketScanSummary(binding.feiTicketNo))
  const ticketRows = !objectMeta.requiresFeiTicket
    ? `<div class="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">目标对象为${escapeHtml(objectMeta.objectLabel)}，无需绑定菲票，按${escapeHtml(objectMeta.qtyUnit)}记录数量。</div>`
    : summaries.length > 0
    ? summaries
        .map(
          (summary) => `
            <div class="rounded-md border bg-muted/20 px-3 py-2 text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="font-medium">${escapeHtml(summary.feiTicketNo)}</span>
                <span>${escapeHtml(summary.currentFlowStatus)}</span>
              </div>
              <div class="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                <span>当前特殊工艺：${escapeHtml(summary.currentOperationName || '—')}</span>
                <span>已完成特殊工艺：${escapeHtml(summary.completedOperationNames.join('、') || '无')}</span>
                <span data-field-label="原数量">原${escapeHtml(objectMeta.objectLabel)}数量：${summary.originalQty} ${escapeHtml(objectMeta.qtyUnit)}</span>
                <span data-field-label="当前数量">当前${escapeHtml(objectMeta.objectLabel)}数量：${summary.currentQty} ${escapeHtml(objectMeta.qtyUnit)}</span>
                <span>累计报废${escapeHtml(objectMeta.objectLabel)}数量：${summary.cumulativeScrapQty} ${escapeHtml(objectMeta.qtyUnit)}</span>
                <span>累计货损${escapeHtml(objectMeta.objectLabel)}数量：${summary.cumulativeDamageQty} ${escapeHtml(objectMeta.qtyUnit)}</span>
              </div>
            </div>
          `,
        )
        .join('')
    : '<div class="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">暂无绑定菲票</div>'

  const receivedQty = getSpecialCraftPdaBaseQty(task, workOrder, firstBinding, objectMeta)
  const scrapQty = Number(detailState.specialCraftScrapQty || 0)
  const damageQty = Number(detailState.specialCraftDamageQty || 0)
  const completedQty = Math.max(receivedQty - (Number.isFinite(scrapQty) ? scrapQty : 0) - (Number.isFinite(damageQty) ? damageQty : 0), 0)
  const workOrderId = workOrder?.workOrderId || firstBinding?.workOrderId || ''
  const operationRecords = workOrderId
    ? [
        ...getProcessActionOperationRecordsBySource('SPECIAL_CRAFT', workOrderId),
        ...getProcessActionOperationRecordsByTask(task.taskId).filter((record) => record.sourceType === 'SPECIAL_CRAFT'),
      ]
        .filter((record, index, records) => records.findIndex((item) => item.operationRecordId === record.operationRecordId) === index)
        .sort((left, right) => right.operatedAt.localeCompare(left.operatedAt))
        .slice(0, 4)
    : []
  const warehouseRecords = workOrderId ? getWarehouseRecordsByWorkOrderId(workOrderId) : []
  const handoverRecords = workOrderId ? getHandoverRecordsByWorkOrderId(workOrderId) : []
  const differenceRecords = workOrderId ? getDifferenceRecordsByWorkOrderId(workOrderId) : []
  const operationRows = operationRecords.length
    ? operationRecords
        .map((record) => `
          <div class="rounded-md border bg-muted/20 px-3 py-2 text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">${escapeHtml(record.actionLabel)}</span>
              <span>${escapeHtml(record.sourceChannel)}</span>
            </div>
            <div class="mt-1 text-muted-foreground">${escapeHtml(record.previousStatus)} -> ${escapeHtml(record.nextStatus)}，${escapeHtml(record.operatorName)}，${escapeHtml(record.operatedAt)}</div>
          </div>
        `)
        .join('')
    : '<div class="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">暂无操作记录</div>'
  const warehouseSummary = warehouseRecords.length
    ? warehouseRecords.map((record) => `${record.currentActionName}：${record.availableObjectQty}${record.qtyUnit}`).join('；')
    : '暂无待加工仓或待交出仓记录'
  const handoverSummary = handoverRecords.length
    ? handoverRecords.map((record) => `${record.handoverRecordNo}：${record.handoverObjectQty}${record.qtyUnit}`).join('；')
    : '暂无交出记录'
  const differenceSummary = differenceRecords.length
    ? differenceRecords.map((record) => `${record.differenceRecordNo}：差异${objectMeta.objectLabel}数量${record.diffObjectQty}${record.qtyUnit}`).join('；')
    : '暂无差异记录'
  const allowedActions = getSpecialCraftPdaAllowedActions({
    status,
    workOrderStatus: workOrder?.status,
    objectLabel: objectMeta.objectLabel,
    requiresFeiTicket: objectMeta.requiresFeiTicket,
    bindingCount: bindings.length,
  })

  return `
    <article class="rounded-lg border bg-card">
      <header class="border-b px-4 py-3">
        <h2 class="flex items-center gap-2 text-sm font-semibold">
          <i data-lucide="scan-line" class="h-4 w-4"></i>
          特殊工艺${objectMeta.requiresFeiTicket ? '菲票' : '执行'}
        </h2>
      </header>
      <div class="space-y-3 p-4 text-sm" data-writeback-link="linkSpecialCraftCompletionToReturnWaitHandoverStock">
        <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <span>加工单号：${renderPdaObjectCode({
            objectType: 'PROCESS_DOC',
            objectId: workOrder?.workOrderNo || firstBinding?.workOrderNo || task.taskNo || task.taskId,
            relatedProductionOrderNo: task.productionOrderId,
          })}</span>
          <span>特殊工艺：${escapeHtml(workOrder?.operationName || displayProcessName)}</span>
          <span>工艺工厂：${escapeHtml(workOrder?.factoryName || task.assignedFactoryName || '—')}</span>
          <span>当前状态：${escapeHtml(workOrder?.status || status)}</span>
          <span>当前${escapeHtml(objectMeta.objectLabel)}数量：${completedQty || workOrder?.currentQty || task.qty} ${escapeHtml(objectMeta.qtyUnit)}</span>
          <span>${objectMeta.requiresFeiTicket ? `绑定菲票数量：${bindings.length} 张` : `目标对象：${escapeHtml(objectMeta.objectLabel)}`}</span>
        </div>
        ${
          status === 'IN_PROGRESS'
            ? `
                <div class="grid gap-3 sm:grid-cols-3">
                  <label class="space-y-1">
                    <span class="text-xs text-muted-foreground" data-field-label="报废数量">报废${escapeHtml(objectMeta.objectLabel)}数量</span>
                    <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="number" min="0" data-pda-execd-field="specialCraftScrapQty" value="${escapeHtml(detailState.specialCraftScrapQty)}" />
                  </label>
                  <label class="space-y-1">
                    <span class="text-xs text-muted-foreground" data-field-label="货损数量">货损${escapeHtml(objectMeta.objectLabel)}数量</span>
                    <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="number" min="0" data-pda-execd-field="specialCraftDamageQty" value="${escapeHtml(detailState.specialCraftDamageQty)}" />
                  </label>
                  <div class="rounded-md border bg-muted/20 px-3 py-2 text-xs">
                    <div class="text-muted-foreground" data-field-label="完工后数量">完工后${escapeHtml(objectMeta.objectLabel)}数量</div>
                    <div class="mt-1 text-sm font-semibold">${completedQty} ${escapeHtml(objectMeta.qtyUnit)}</div>
                  </div>
                </div>
              `
            : ''
        }
        <div class="grid grid-cols-2 gap-2">
          ${
            allowedActions.length
              ? allowedActions.map((action) => `
                <button type="button" class="inline-flex h-9 items-center justify-center rounded-md ${action.primary ? 'bg-primary text-primary-foreground' : 'border'} text-sm hover:bg-muted" data-pda-execd-action="${action.action}" data-task-id="${escapeHtml(task.taskId)}">${action.action === 'special-receive-cut-pieces' ? `确认接收${escapeHtml(objectMeta.objectLabel)}` : escapeHtml(action.label)}</button>
              `).join('')
              : '<div class="col-span-2 rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">当前状态暂无可执行动作</div>'
          }
        </div>
        <details class="rounded-md border bg-muted/20 px-3 py-2 text-xs">
          <summary class="cursor-pointer font-medium">查看菲票和流转信息</summary>
          <div class="mt-2 space-y-2">${ticketRows}</div>
        </details>
        <div class="rounded-md border bg-muted/20 px-3 py-2 text-xs">
          <div>待加工仓 / 待交出仓：${escapeHtml(warehouseSummary)}</div>
          <div class="mt-1">交出记录：${escapeHtml(handoverSummary)}</div>
          <div class="mt-1">差异记录：${escapeHtml(differenceSummary)}</div>
        </div>
        <div class="space-y-2">
          <div class="text-xs font-medium">操作记录</div>
          ${operationRows}
        </div>
      </div>
    </article>
  `
}

function getPostFinishingActionLabel(actionType: PostFinishingActionType, phase: 'start' | 'finish'): string {
  if (actionType === '扫码收货') return phase === 'start' ? '开始扫码收货' : '确认收货入库'
  if (phase === 'start') {
    return actionType === '后道' ? '开始后道' : actionType === '质检' ? '开始质检' : '开始复检'
  }
  return actionType === '后道' ? '完成后道' : actionType === '质检' ? '完成质检' : '完成复检'
}

function getPostFinishingActionCode(actionType: PostFinishingActionType, phase: 'start' | 'finish'): string {
  if (actionType === '扫码收货') return phase === 'start' ? 'POST_RECEIVE_START' : 'POST_RECEIVE_FINISH'
  if (actionType === '质检') return phase === 'start' ? 'POST_QC_START' : 'POST_QC_FINISH'
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

const PDA_POST_PROJECT_OPTIONS: Array<PostFinishingQcPostProjectJudgement['projectName']> = ['开扣眼', '装扣子', '熨烫', '包装']

function registerPdaPostQcFormSync(): void {
  if (typeof window === 'undefined') return
  ;(window as typeof window & { __syncPdaPostQcForm?: () => void }).__syncPdaPostQcForm = () => {
    document.querySelectorAll<HTMLElement>('[data-pda-qc-result-card]').forEach((card) => {
      const buttonhole = card.querySelector<HTMLInputElement>('[data-qc-project-name="开扣眼"]')
      const button = card.querySelector<HTMLInputElement>('[data-qc-project-name="装扣子"]')
      const forceIroningAndPackaging = Boolean(buttonhole?.checked || button?.checked)
      card.querySelectorAll<HTMLInputElement>('[data-qc-project-lockable]').forEach((checkbox) => {
        checkbox.checked = forceIroningAndPackaging || checkbox.checked
        checkbox.disabled = forceIroningAndPackaging
      })
      card.querySelectorAll<HTMLInputElement>('[data-qc-button-mode]').forEach((radio) => {
        radio.disabled = !button?.checked
        if (!button?.checked) radio.checked = false
      })
    })
  }
}

function buildPdaPostTaskActionHref(execId: string, action: string, params: Record<string, string> = {}): string {
  const search = new URLSearchParams({ postMobileAction: action, ...params })
  return `/fcs/pda/exec/${encodeURIComponent(execId)}?${search.toString()}`
}

function getPdaPostMobileAction(): string {
  return new URLSearchParams(window.location.search).get('postMobileAction') || ''
}

function getPdaPostMobileParam(name: string): string {
  return new URLSearchParams(window.location.search).get(name) || ''
}

function renderSkuThumb(imageUrl: string | undefined, label: string): string {
  return imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(label)}" class="h-14 w-14 rounded-md border object-cover">`
    : `<div class="flex h-14 w-14 items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">无图</div>`
}

function renderPdaPostActionHeader(title: string, subtitle: string): string {
  return `
    <div class="flex items-center gap-2">
      <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-pda-execd-action="back">
        <i data-lucide="arrow-left" class="mr-1 h-4 w-4"></i>
        返回
      </button>
      <div>
        <h1 class="text-base font-semibold">${escapeHtml(title)}</h1>
        <div class="text-xs text-muted-foreground">${escapeHtml(subtitle)}</div>
      </div>
    </div>
  `
}

function renderPdaPostCreateQcPage(execId: string, task: PostFinishingTaskView, waitItems: PostFinishingWaitQcSkuItem[]): string {
  const cards = waitItems.map((item, index) => `
    <article class="rounded-lg border bg-card p-3" data-pda-qc-card data-warehouse-record-id="${escapeHtml(item.warehouseRecordId)}" data-wait-qty="${item.waitQcQty}">
      <label class="flex items-start gap-3">
        <input type="checkbox" class="mt-1 h-4 w-4 rounded border" data-pda-qc-selected ${index === 0 ? 'checked' : ''}>
        ${renderSkuThumb(item.skuImageUrl, item.skuCode)}
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold">${escapeHtml(item.skuCode)}</div>
          <div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(item.colorName)} / ${escapeHtml(item.sizeName)}</div>
          <div class="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
            <div class="rounded-md bg-muted px-2 py-1"><div class="text-muted-foreground">当前库存</div><div class="font-semibold">${item.currentStockQty}</div></div>
            <div class="rounded-md bg-muted px-2 py-1"><div class="text-muted-foreground">待质检</div><div class="font-semibold">${item.waitQcQty}</div></div>
            <div class="rounded-md bg-muted px-2 py-1"><div class="text-muted-foreground">质检中</div><div class="font-semibold">${item.qcInProgressQty}</div></div>
          </div>
        </div>
      </label>
      <div class="mt-3 grid gap-1">
        <label class="text-xs font-medium">本次质检数量</label>
        <input type="number" min="0" max="${item.waitQcQty}" value="${item.waitQcQty}" class="h-10 rounded-md border px-3 text-sm" data-pda-qc-qty>
      </div>
    </article>
  `).join('')

  const content = `
    <div class="space-y-4 bg-background p-4 pb-6">
      ${renderPdaPostActionHeader('创建质检单', task.postTaskNo)}
      <article class="rounded-lg border bg-card p-3 text-xs">
        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
          <span class="text-muted-foreground">生产单</span><span class="font-medium">${renderPdaObjectCode({
            objectType: 'PRODUCTION_ORDER',
            objectId: task.productionOrderNo,
          })}</span>
          <span class="text-muted-foreground">后道工厂</span><span>${escapeHtml(task.managedPostFactoryName)}</span>
        </div>
      </article>
      <div class="space-y-3">${cards || '<div class="rounded-md border bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">暂无待质检 SKU</div>'}</div>
      <button type="button" class="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50" data-pda-execd-action="post-mobile-create-qc-submit" data-post-task-id="${escapeHtml(task.postTaskId)}" ${waitItems.length ? '' : 'disabled'}>提交质检单</button>
    </div>
  `
  void execId
  return renderPdaFrame(content, 'exec', { disableTodoAutoOpen: true })
}

function renderPdaPostCompleteQcPage(execId: string, qcOrderId: string): string {
  registerPdaPostQcFormSync()
  const qc = listPostFinishingQcOrderEntities().find((item) => item.qcOrderId === qcOrderId || item.qcOrderNo === qcOrderId)
  if (!qc) {
    return renderPdaFrame(`<div class="p-4"><button class="mb-4 inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-pda-execd-action="back">返回</button><div class="rounded-md border bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">质检单不存在</div></div>`, 'exec', { disableTodoAutoOpen: true })
  }

  const cards = qc.qcSkuResults.map((result) => {
    const projectNames = new Set(result.postProjectJudgements.filter((item) => item.needed).map((item) => item.projectName))
    const selectedButtonMode = result.postProjectJudgements.find((item) => item.projectName === '装扣子')?.buttonAttachMode
    const forceIroningAndPackaging = projectNames.has('开扣眼') || projectNames.has('装扣子')
    return `
      <article class="rounded-lg border bg-card p-3" data-pda-qc-result-card
        data-sku-line-id="${escapeHtml(result.skuLineId)}"
        data-sku-id="${escapeHtml(result.skuId)}"
        data-sku-code="${escapeHtml(result.skuCode)}"
        data-sku-image-url="${escapeHtml(result.skuImageUrl || '')}"
        data-color-name="${escapeHtml(result.colorName)}"
        data-size-name="${escapeHtml(result.sizeName)}"
        data-qty-unit="${escapeHtml(result.qtyUnit)}"
        data-source-factory-id="${escapeHtml(qc.sourceFactoryId)}"
        data-source-factory-name="${escapeHtml(qc.sourceFactoryName)}"
      >
        <div class="flex gap-3">
          ${renderSkuThumb(result.skuImageUrl, result.skuCode)}
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold">${escapeHtml(result.skuCode)}</div>
            <div class="text-xs text-muted-foreground">${escapeHtml(result.colorName)} / ${escapeHtml(result.sizeName)}</div>
          </div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <label class="grid gap-1 text-xs"><span>质检数量</span><input type="number" min="0" value="${result.inspectedQty}" class="h-9 rounded-md border px-2" data-qc-inspected></label>
          <label class="grid gap-1 text-xs"><span>合格数量</span><input type="number" min="0" value="${result.qualifiedQty || result.inspectedQty}" class="h-9 rounded-md border px-2" data-qc-qualified></label>
          <label class="grid gap-1 text-xs"><span>返工数量</span><input type="number" min="0" value="${result.reworkQty || ''}" class="h-9 rounded-md border px-2" data-qc-rework></label>
          <label class="grid gap-1 text-xs"><span>瑕疵数量</span><input type="number" min="0" value="${result.defectAcceptedQty || ''}" class="h-9 rounded-md border px-2" data-qc-defect-accepted></label>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
          ${PDA_POST_PROJECT_OPTIONS.map((projectName) => {
            const lockable = projectName === '熨烫' || projectName === '包装'
            const checked = lockable && forceIroningAndPackaging ? true : projectNames.has(projectName)
            const disabled = lockable && forceIroningAndPackaging
            return `
              <label class="inline-flex items-center gap-2 rounded-md border px-2 py-2">
                <input type="checkbox" data-qc-project-name="${escapeHtml(projectName)}" ${lockable ? 'data-qc-project-lockable="1"' : ''} onchange="window.__syncPdaPostQcForm()" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
                <span>${escapeHtml(projectName)}</span>
              </label>
              ${projectName === '装扣子' ? `
                <div class="col-span-2 grid gap-2 rounded-md border bg-white p-2">
                  <label class="inline-flex items-center gap-2">
                    <input type="radio" name="pda-button-mode-${escapeHtml(result.qcSkuResultId)}" value="人工装扣" data-qc-button-mode="manual" ${selectedButtonMode === '人工装扣' ? 'checked' : ''} ${projectNames.has('装扣子') ? '' : 'disabled'}>
                    <span>人工装扣</span>
                  </label>
                  <label class="inline-flex items-center gap-2">
                    <input type="radio" name="pda-button-mode-${escapeHtml(result.qcSkuResultId)}" value="机器装扣" data-qc-button-mode="machine" ${selectedButtonMode === '机器装扣' ? 'checked' : ''} ${projectNames.has('装扣子') ? '' : 'disabled'}>
                    <span>机器装扣</span>
                  </label>
                </div>
              ` : ''}
            `
          }).join('')}
        </div>
      </article>
    `
  }).join('')

  const content = `
    <div class="space-y-4 bg-background p-4 pb-6">
      ${renderPdaPostActionHeader('完成质检', qc.qcOrderNo)}
      <div class="space-y-3">${cards}</div>
      <button type="button" class="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-execd-action="post-mobile-complete-qc-submit" data-qc-order-id="${escapeHtml(qc.qcOrderId)}" data-post-task-id="${escapeHtml(qc.postTaskId || execId)}">提交质检结果</button>
    </div>
  `
  return renderPdaFrame(content, 'exec', { disableTodoAutoOpen: true })
}

function renderPdaPostCompleteRecheckPage(execId: string, recheckOrderId: string): string {
  const recheck = listPostFinishingRecheckOrderEntities().find((item) => item.recheckOrderId === recheckOrderId || item.recheckOrderNo === recheckOrderId)
  if (!recheck) {
    return renderPdaFrame(`<div class="p-4"><button class="mb-4 inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-pda-execd-action="back">返回</button><div class="rounded-md border bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">复检单不存在</div></div>`, 'exec', { disableTodoAutoOpen: true })
  }

  const cards = recheck.recheckSkuResults.map((result) => `
    <article class="rounded-lg border bg-card p-3" data-pda-recheck-card
      data-sku-line-id="${escapeHtml(result.skuLineId)}"
      data-sku-id="${escapeHtml(result.skuId)}"
      data-sku-code="${escapeHtml(result.skuCode)}"
      data-sku-image-url="${escapeHtml(result.skuImageUrl || '')}"
      data-color-name="${escapeHtml(result.colorName)}"
      data-size-name="${escapeHtml(result.sizeName)}"
      data-qty-unit="${escapeHtml(result.qtyUnit)}"
    >
      <div class="flex gap-3">
        ${renderSkuThumb(result.skuImageUrl, result.skuCode)}
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold">${escapeHtml(result.skuCode)}</div>
          <div class="text-xs text-muted-foreground">${escapeHtml(result.colorName)} / ${escapeHtml(result.sizeName)}</div>
        </div>
      </div>
      <div class="mt-3 grid grid-cols-3 gap-2">
        <label class="grid gap-1 text-xs"><span>本次复检</span><input type="number" min="0" value="${result.recheckQty || result.waitRecheckQty}" class="h-9 rounded-md border px-2" data-recheck-qty></label>
        <label class="grid gap-1 text-xs"><span>合格数量</span><input type="number" min="0" value="${result.qualifiedQty || result.waitRecheckQty}" class="h-9 rounded-md border px-2" data-recheck-qualified></label>
        <label class="grid gap-1 text-xs"><span>不合格数量</span><input type="number" min="0" value="${result.unqualifiedQty}" class="h-9 rounded-md border px-2" data-recheck-unqualified></label>
      </div>
      <label class="mt-3 grid gap-1 text-xs"><span>备注</span><input type="text" value="${escapeHtml(result.remark || '')}" class="h-9 rounded-md border px-2" data-recheck-remark></label>
    </article>
  `).join('')

  const content = `
    <div class="space-y-4 bg-background p-4 pb-6">
      ${renderPdaPostActionHeader('完成复检', recheck.recheckOrderNo)}
      <div class="space-y-3">${cards}</div>
      <button type="button" class="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-execd-action="post-mobile-complete-recheck-submit" data-recheck-order-id="${escapeHtml(recheck.recheckOrderId)}" data-post-task-id="${escapeHtml(recheck.postTaskId || execId)}">提交复检结果</button>
    </div>
  `
  return renderPdaFrame(content, 'exec', { disableTodoAutoOpen: true })
}

function readNumberFromElement(root: ParentNode, selector: string, fallback = 0): number {
  const element = root.querySelector<HTMLInputElement>(selector)
  const value = Number(element?.value || fallback)
  return Number.isFinite(value) ? value : fallback
}

function readTextFromElement(root: ParentNode, selector: string): string {
  return root.querySelector<HTMLInputElement>(selector)?.value.trim() || ''
}

function collectPdaQcSkuResults(qcOrderId: string): PostFinishingQcSkuResult[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-pda-qc-result-card]')).map((card, index) => {
    const inspectedQty = readNumberFromElement(card, '[data-qc-inspected]')
    const qualifiedQty = readNumberFromElement(card, '[data-qc-qualified]')
    const reworkQty = readNumberFromElement(card, '[data-qc-rework]')
    const defectAcceptedQty = readNumberFromElement(card, '[data-qc-defect-accepted]')
    const unqualifiedQty = reworkQty + defectAcceptedQty
    const projectJudgements = Array.from(card.querySelectorAll<HTMLInputElement>('[data-qc-project-name]')).map((checkbox) => ({
      projectName: checkbox.dataset.qcProjectName as PostFinishingQcPostProjectJudgement['projectName'],
      needed: checkbox.checked,
      qty: checkbox.checked ? Math.max(qualifiedQty, 0) : 0,
      buttonAttachMode: checkbox.dataset.qcProjectName === '装扣子' && checkbox.checked
        ? card.querySelector<HTMLInputElement>('[data-qc-button-mode]:checked')?.value as PostFinishingQcPostProjectJudgement['buttonAttachMode'] | undefined
        : undefined,
    }))
    return {
      qcSkuResultId: `${qcOrderId}-PDA-${index + 1}`,
      skuLineId: card.dataset.skuLineId || '',
      skuId: card.dataset.skuId || '',
      skuCode: card.dataset.skuCode || '',
      skuImageUrl: card.dataset.skuImageUrl || undefined,
      colorName: card.dataset.colorName || '',
      sizeName: card.dataset.sizeName || '',
      inspectedQty,
      qualifiedQty,
      unqualifiedQty,
      reworkQty,
      defectAcceptedQty,
      platformReasonQty: 0,
      factoryReasonQty: unqualifiedQty,
      responsibleFactoryId: card.dataset.sourceFactoryId || undefined,
      responsibleFactoryName: card.dataset.sourceFactoryName || undefined,
      reworkReceiveFactoryId: card.dataset.sourceFactoryId || undefined,
      reworkReceiveFactoryName: card.dataset.sourceFactoryName || undefined,
      defectReasonItems: [],
      postProjectJudgements: projectJudgements,
      qtyUnit: card.dataset.qtyUnit || '件',
      remark: readTextFromElement(card, '[data-qc-remark]') || undefined,
    }
  })
}

function collectPdaRecheckSkuResults(recheckOrderId: string): PostFinishingRecheckSkuResult[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-pda-recheck-card]')).map((card, index) => ({
    recheckSkuResultId: `${recheckOrderId}-PDA-${index + 1}`,
    skuLineId: card.dataset.skuLineId || '',
    skuId: card.dataset.skuId || '',
    skuCode: card.dataset.skuCode || '',
    skuImageUrl: card.dataset.skuImageUrl || undefined,
    colorName: card.dataset.colorName || '',
    sizeName: card.dataset.sizeName || '',
    waitRecheckQty: readNumberFromElement(card, '[data-recheck-qty]'),
    recheckQty: readNumberFromElement(card, '[data-recheck-qty]'),
    qualifiedQty: readNumberFromElement(card, '[data-recheck-qualified]'),
    unqualifiedQty: readNumberFromElement(card, '[data-recheck-unqualified]'),
    qtyUnit: card.dataset.qtyUnit || '件',
    remark: readTextFromElement(card, '[data-recheck-remark]') || undefined,
  }))
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
            开始后道
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
              开始后道
            </button>
          ` : `
            <button type="button" class="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-execd-action="post-project-complete" data-post-order-id="${escapeHtml(order.postOrderId)}" data-project-line-id="${escapeHtml(line.projectLineId)}" data-project-planned-qty="${line.plannedQty}">
              完成后道
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
    if (order.currentStatus === '待质检') {
      actions.push(renderPostFinishingActionButton(order, '质检', 'start', !receivedStatuses.includes(order.receiveAction.status)))
    } else if (order.currentStatus === '质检中') {
      actions.push(`
        <button type="button" class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-execd-action="post-mobile-open-complete-qc" data-qc-order-id="${escapeHtml(order.qcOrderId || order.linkedQcOrderId)}" data-post-task-id="${escapeHtml(order.postTaskId || order.sourceTaskId)}">
          完成质检
        </button>
      `)
      actions.push(`
        <button type="button" class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted" data-pda-execd-action="post-report-difference" data-post-order-id="${escapeHtml(order.postOrderId)}" data-task-id="${escapeHtml(order.sourceTaskId)}">
          上报差异
        </button>
      `)
    }

    if (order.currentStatus === '复检中') {
      actions.push(`
        <button type="button" class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-execd-action="post-mobile-open-complete-recheck" data-recheck-order-id="${escapeHtml(order.recheckOrderId || order.linkedRecheckOrderId)}" data-post-task-id="${escapeHtml(order.postTaskId || order.sourceTaskId)}">
          完成复检
        </button>
      `)
      actions.push(`
        <button type="button" class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted" data-pda-execd-action="post-report-difference" data-post-order-id="${escapeHtml(order.postOrderId)}" data-task-id="${escapeHtml(order.sourceTaskId)}">
          上报差异
        </button>
      `)
    } else if (order.currentStatus === '待复检') {
      actions.push(renderPostFinishingActionButton(order, '复检', 'start'))
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
  const waitItems = listPostFinishingWaitQcSkuItems({ postTaskId: task.postTaskId })
  const qcOrders = listPostFinishingQcOrderEntities().filter((item) => item.postTaskId === task.postTaskId || item.productionOrderNo === task.productionOrderNo)
  const postOrders = listPostFinishingWorkOrders().filter((item) => item.postTaskId === task.postTaskId || item.sourceProductionOrderNo === task.productionOrderNo)
  const recheckOrders = listPostFinishingRecheckOrderEntities().filter((item) => item.postTaskId === task.postTaskId || item.productionOrderNo === task.productionOrderNo)
  const mobileAction = getPdaPostMobileAction()
  if (mobileAction === 'create-qc') {
    return renderPdaPostCreateQcPage(execId, task, waitItems)
  }
  if (mobileAction === 'complete-qc') {
    return renderPdaPostCompleteQcPage(execId, getPdaPostMobileParam('qcOrderId'))
  }
  if (mobileAction === 'complete-recheck') {
    return renderPdaPostCompleteRecheckPage(execId, getPdaPostMobileParam('recheckOrderId'))
  }
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
      ? `<a class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" href="${escapeHtml(buildPdaPostTaskActionHref(execId, 'create-qc'))}">创建质检单</a>`
      : '',
    postOrders[0]
      ? `<button type="button" class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted" data-pda-execd-action="post-task-open-order" data-post-order-id="${escapeHtml(postOrders[0].postOrderId)}">处理后道单</button>`
      : '',
  ].filter(Boolean).join('')
  const waitRows = waitItems.map((item) => `
    <tr>
      <td class="px-3 py-2"><div class="flex items-center gap-2">${renderSkuThumb(item.skuImageUrl, item.skuCode)}<span>${escapeHtml(item.skuCode)}</span></div></td>
      <td class="px-3 py-2">${escapeHtml(item.colorName)} / ${escapeHtml(item.sizeName)}</td>
      <td class="px-3 py-2">${item.currentStockQty} / ${item.waitQcQty} / ${item.qcInProgressQty} ${escapeHtml(item.qtyUnit)}</td>
    </tr>
  `).join('')
  const qcRows = qcOrders.map((item) => `
    <tr>
      <td class="px-3 py-2 font-mono">${renderPdaObjectCode({
        objectType: 'QC_ORDER',
        objectId: item.qcOrderNo,
        relatedProductionOrderNo: item.productionOrderNo,
      })}</td>
      <td class="px-3 py-2">${escapeHtml(item.qcStatus)}</td>
      <td class="px-3 py-2">${item.inspectedGarmentQty} 件</td>
      <td class="px-3 py-2">
        ${item.qcStatus !== '质检完成' ? `<a class="inline-flex h-8 items-center rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground" href="${escapeHtml(buildPdaPostTaskActionHref(execId, 'complete-qc', { qcOrderId: item.qcOrderId }))}">完成质检</a>` : '—'}
      </td>
    </tr>
  `).join('')
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
  const recheckRows = recheckOrders.map((item) => `
    <tr>
      <td class="px-3 py-2 font-mono">${renderPdaObjectCode({
        objectType: 'RECHECK_ORDER',
        objectId: item.recheckOrderNo,
        relatedProductionOrderNo: item.productionOrderNo,
      })}</td>
      <td class="px-3 py-2">${escapeHtml(item.sourceType)}</td>
      <td class="px-3 py-2">${escapeHtml(item.recheckStatus)}</td>
      <td class="px-3 py-2">
        ${item.recheckStatus !== '复检完成' ? `<a class="inline-flex h-8 items-center rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground" href="${escapeHtml(buildPdaPostTaskActionHref(execId, 'complete-recheck', { recheckOrderId: item.recheckOrderId }))}">完成复检</a>` : '—'}
      </td>
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

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3"><h2 class="text-sm font-semibold">待质检库存</h2></header>
        <div class="overflow-x-auto p-4">
          <table class="min-w-[480px] text-left text-xs">
            <thead class="bg-muted text-muted-foreground"><tr><th class="px-3 py-2">SKU</th><th class="px-3 py-2">颜色 / 尺码</th><th class="px-3 py-2">库存 / 待质检 / 质检中</th></tr></thead>
            <tbody class="divide-y">${waitRows || '<tr><td colspan="3" class="px-3 py-4 text-center text-muted-foreground">暂无待质检库存</td></tr>'}</tbody>
          </table>
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3"><h2 class="text-sm font-semibold">质检、后道、复检</h2></header>
        <div class="space-y-3 p-4">
          <div class="overflow-x-auto"><table class="min-w-[600px] text-left text-xs"><thead class="bg-muted text-muted-foreground"><tr><th class="px-3 py-2">质检单</th><th class="px-3 py-2">状态</th><th class="px-3 py-2">数量</th><th class="px-3 py-2">操作</th></tr></thead><tbody class="divide-y">${qcRows || '<tr><td colspan="4" class="px-3 py-4 text-center text-muted-foreground">暂无质检单</td></tr>'}</tbody></table></div>
          <div class="overflow-x-auto"><table class="min-w-[520px] text-left text-xs"><thead class="bg-muted text-muted-foreground"><tr><th class="px-3 py-2">后道单</th><th class="px-3 py-2">后道项目</th><th class="px-3 py-2">状态</th></tr></thead><tbody class="divide-y">${postRows || '<tr><td colspan="3" class="px-3 py-4 text-center text-muted-foreground">暂无后道单</td></tr>'}</tbody></table></div>
          <div class="overflow-x-auto"><table class="min-w-[600px] text-left text-xs"><thead class="bg-muted text-muted-foreground"><tr><th class="px-3 py-2">复检单</th><th class="px-3 py-2">来源</th><th class="px-3 py-2">状态</th><th class="px-3 py-2">操作</th></tr></thead><tbody class="divide-y">${recheckRows || '<tr><td colspan="4" class="px-3 py-4 text-center text-muted-foreground">暂无复检单</td></tr>'}</tbody></table></div>
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
        <h1 class="text-base font-semibold">后道任务执行</h1>
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
            <span class="text-muted-foreground">已完成后道成衣件数</span>
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
  const content = `
    <div class="space-y-4 bg-background p-4 pb-6">
      <div class="flex items-center gap-2">
        <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-pda-execd-action="back">
          <i data-lucide="arrow-left" class="mr-1 h-4 w-4"></i>
          返回
        </button>
        <h1 class="text-base font-semibold">车缝后道任务</h1>
      </div>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-semibold">${renderPdaObjectCode({
              objectType: 'PROCESS_DOC',
              objectId: task.postTaskNo,
              relatedProductionOrderNo: task.productionOrderNo,
            })}</span>
            <span class="inline-flex rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">${escapeHtml(task.status)}</span>
          </div>
        </header>
        <div class="grid gap-3 p-4 text-xs">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <span class="text-muted-foreground">车缝任务号</span>
            <span class="font-medium">${renderPdaObjectCode({
              objectType: 'PROCESS_DOC',
              objectId: task.sewingTaskNo,
              relatedProductionOrderNo: task.productionOrderNo,
            })}</span>
            <span class="text-muted-foreground">生产单</span>
            <span>${renderPdaObjectCode({
              objectType: 'PRODUCTION_ORDER',
              objectId: task.productionOrderNo,
            })}</span>
            <span class="text-muted-foreground">车缝工厂</span>
            <span>${escapeHtml(task.sewingFactoryName)}</span>
            <span class="text-muted-foreground">计划成衣件数</span>
            <span>${task.plannedGarmentQty} ${escapeHtml(task.qtyUnit)}</span>
            <span class="text-muted-foreground">已完成车缝成衣件数</span>
            <span>${task.completedSewingGarmentQty} ${escapeHtml(task.qtyUnit)}</span>
            <span class="text-muted-foreground">是否需要本厂完成后道</span>
            <span>${task.needFactoryPostFinishing ? '是' : '否'}</span>
            <span class="text-muted-foreground">后道完成成衣件数</span>
            <span>${task.completedPostGarmentQty} ${escapeHtml(task.qtyUnit)}</span>
            <span class="text-muted-foreground">后道后流向</span>
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
          <button type="button" class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-pda-execd-action="sewing-post-start" data-sewing-post-task-id="${escapeHtml(task.postTaskId)}" ${canStartPost ? '' : 'disabled'}>开始后道</button>
          <button type="button" class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50" data-pda-execd-action="sewing-post-finish" data-sewing-post-task-id="${escapeHtml(task.postTaskId)}" ${canFinishPost ? '' : 'disabled'}>完成后道</button>
          <button type="button" class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-pda-execd-action="sewing-post-transfer" data-sewing-post-task-id="${escapeHtml(task.postTaskId)}" ${canTransfer ? '' : 'disabled'}>交给后道工厂</button>
          <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">车缝工厂只执行车缝和后道，不执行后道工厂质检和复检。</div>
        </div>
      </article>
    </div>
  `
  void taskId
  return renderPdaFrame(content, 'exec', { disableTodoAutoOpen: true })
}

export function renderPdaExecDetailPage(taskId: string): string {
  syncPdaStartRiskAndExceptions()
  syncMilestoneOverdueExceptions()

  const task = getTaskFactById(taskId)

  const waterSolubleOrder = task ? getWaterSolubleWorkOrderByTaskId(task.taskId) : null
  if (task && waterSolubleOrder) {
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

  const currentFactoryId = getPdaSession()?.factoryId || task.assignedFactoryId || TEST_FACTORY_ID

  syncDialogStateWithQuery(task)

  const status = task.status || 'NOT_STARTED'
  const prereq = getStartPrerequisite(task)
  const isSimpleFiveStepExecution = task.pdaStepTemplateCode === 'SIMPLE_FIVE_STEP'
  const deadline = getDeadlineStatus(
    (task as ProcessTask & { taskDeadline?: string }).taskDeadline,
    task.finishedAt,
  )

  let mobileTaskAccess = getMobileTaskAccessResult(task, currentFactoryId)
  if (!canFactoryAccessSpecialCraftPdaTask(currentFactoryId, task)) {
    mobileTaskAccess = {
      ...mobileTaskAccess,
      canOpenMobileExecution: false,
      canExecuteInMobile: false,
      reasonCode: 'TASK_NOT_VISIBLE_IN_MOBILE_LIST',
      reasonLabel: '当前工厂无该特殊工艺加工权限',
      suggestedAction: '请切换到对应辅助工艺或特种工艺工厂账号后查看',
    }
  }
  const canStart = status === 'NOT_STARTED' && prereq.met && mobileTaskAccess.canExecuteInMobile
  const canFinish = status === 'IN_PROGRESS' && mobileTaskAccess.canExecuteInMobile && !isSimpleFiveStepExecution
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
  const sourceInfo = getMobileExecutionTaskSourceInfo(task)
  const taskTabKey = getMobileTaskTabKey(task)
  const taskTabLabel = MOBILE_EXECUTION_TASK_TAB_LABELS[taskTabKey]
  const qtyDisplayMeta = resolveTaskQtyDisplayMeta(task, displayProcessName)
  const handoverOrder = getTaskHandoverOrder(task as TaskWithHandoverFields)
  const printWorkOrder = getPrintWorkOrderByTaskId(task.taskId)
  const dyeWorkOrder = getDyeWorkOrderByTaskId(task.taskId)
  const woolOrder = getWoolWorkOrderByTaskId(task.taskId)
  const isWoolPreStart = Boolean(
    woolOrder
    && ['WAIT_ACCEPT', 'WAIT_PICKUP', 'PICKUP_IN_PROGRESS', 'WAIT_MACHINE_SCHEDULE', 'MACHINE_SCHEDULED'].includes(woolOrder.status),
  )
  const isWoolBeforeStartReady = Boolean(
    woolOrder
    && ['WAIT_ACCEPT', 'WAIT_PICKUP', 'PICKUP_IN_PROGRESS', 'WAIT_MACHINE_SCHEDULE'].includes(woolOrder.status),
  )
  const woolWorkflowOperationActions =
    woolOrder && isWoolBeforeStartReady
      ? getWoolAllowedActions(woolOrder)
      : []
  const activeDetailDialog = getCurrentSearchParams().get('action')
  const isStartDialogOpen = activeDetailDialog === 'start'
  const isMilestoneDialogOpen = activeDetailDialog === 'milestone'
  const isPauseDialogOpen = activeDetailDialog === 'pause'
  const taskQrValue = getTaskQrValue(task as TaskWithHandoverFields)
  const receiverDisplayText = getReceiverDisplayText(task as TaskWithHandoverFields)
  const currentFactoryDisplay = assignedFactory
    ? formatFactoryDisplayName(assignedFactory.name, assignedFactory.code || assignedFactory.id)
    : sourceInfo.factoryDisplayName
  const simpleFiveStepPanel = isSimpleFiveStepExecution
    ? `
        <section class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="font-semibold">${escapeHtml(task.taskCategoryZh || displayProcessName)}五步执行</h2>
              <p class="mt-1 text-xs">确认领料 → 开始做 → 上传进度 → 交给${escapeHtml(task.handoverReceiverName || '仓库')} → 仓库待确认后完工</p>
            </div>
            <span class="rounded-full bg-white px-2 py-1 text-xs font-medium text-blue-700">不直接完工</span>
          </div>
          <div class="mt-3 grid grid-cols-5 gap-1 text-center text-[11px]">
            ${['确认领料', '开始做', '上传进度', `交给${task.handoverReceiverName || '仓库'}`, '仓库待确认'].map((step, index) => `
              <div class="rounded-md bg-white px-1 py-2 ${index <= (status === 'NOT_STARTED' ? 0 : status === 'IN_PROGRESS' ? 2 : status === 'DONE' ? 4 : 1) ? 'font-semibold text-blue-700' : 'text-muted-foreground'}">
                ${escapeHtml(step)}
              </div>
            `).join('')}
          </div>
        </section>
      `
    : ''

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
  const renderWoolWorkflowOperationButtons = (): string =>
    woolOrder && woolWorkflowOperationActions.length
      ? `
          <div class="${woolWorkflowOperationActions.length > 1 ? 'grid grid-cols-2 gap-2' : 'space-y-2'}">
            ${woolWorkflowOperationActions
              .map((action) => `
                <button
                  type="button"
                  class="inline-flex h-9 w-full items-center justify-center rounded-md ${
                    action.tone === 'primary'
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border hover:bg-muted'
                  } text-sm font-medium"
                  data-pda-execd-action="wool-workflow"
                  data-wool-workflow-action="${escapeHtml(action.code)}"
                  data-wool-order-id="${escapeHtml(woolOrder.woolOrderId)}"
                  ${action.nodeName ? `data-node-name="${escapeHtml(action.nodeName)}"` : ''}
                >
                  ${escapeHtml(action.label)}
                </button>
              `)
              .join('')}
          </div>
        `
      : ''
  const renderDetailAuxiliaryButtons = (): string => {
    const buttons: string[] = []

    if (!isWoolBeforeStartReady && status !== 'NOT_STARTED') {
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

    if (!isWoolPreStart && milestone.required && (status === 'IN_PROGRESS' || milestone.status === 'REPORTED')) {
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

    if (!isWoolPreStart && (status === 'IN_PROGRESS' || status === 'BLOCKED')) {
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
      ${simpleFiveStepPanel}
      ${mobileTaskAccess.canOpenMobileExecution && printWorkOrder ? renderPrintingTaskCard(task as TaskWithHandoverFields, printWorkOrder, handoverOrder) : ''}
      ${mobileTaskAccess.canOpenMobileExecution && dyeWorkOrder ? renderDyeingTaskCard(task as TaskWithHandoverFields, dyeWorkOrder, handoverOrder) : ''}
      ${mobileTaskAccess.canOpenMobileExecution && woolOrder ? renderWoolTaskCard(task as TaskWithHandoverFields, woolOrder, handoverOrder) : ''}
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

      <article class="rounded-lg border bg-card">
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
              ? renderWoolWorkflowOperationButtons()
              : ''
          }
          ${
            mobileTaskAccess.canOpenMobileExecution
              ? renderDetailAuxiliaryButtons()
              : ''
          }
          ${
            mobileTaskAccess.canOpenMobileExecution && woolWorkflowOperationActions.length === 0 && status === 'NOT_STARTED'
              ? prereq.met
                ? `
                    <button
                      class="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      data-pda-execd-action="open-start-dialog"
                      data-task-id="${escapeHtml(task.taskId)}"
                      ${canStart ? '' : 'disabled'}
                    >
                      <i data-lucide="play" class="mr-2 h-4 w-4"></i>
                      ${isSimpleFiveStepExecution ? '确认领料 / 开始做' : '开工'}
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
            mobileTaskAccess.canOpenMobileExecution && status === 'IN_PROGRESS' && isSimpleFiveStepExecution
              ? `
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      class="inline-flex h-9 items-center justify-center rounded-md border border-blue-200 text-sm text-blue-700 hover:bg-blue-50"
                      data-pda-execd-action="open-milestone-dialog"
                    >
                      <i data-lucide="upload" class="mr-2 h-4 w-4"></i>
                      上传进度
                    </button>
                    <button
                      class="inline-flex h-9 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      data-pda-execd-action="view-handover-order"
                      data-handover-order-id="${escapeHtml(handoverOrder?.handoverOrderId || handoverOrder?.handoverId || '')}"
                      ${handoverOrder ? '' : 'disabled'}
                    >
                      <i data-lucide="send" class="mr-2 h-4 w-4"></i>
                      交给${escapeHtml(task.handoverReceiverName || '仓库')}
                    </button>
                  </div>
                  <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">交出后进入仓库待确认，仓库确认前不显示已完工。</div>
                `
              : mobileTaskAccess.canOpenMobileExecution && status === 'IN_PROGRESS'
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

export function handlePdaExecDetailEvent(target: HTMLElement): boolean {
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
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-execd-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaExecdAction
  if (!action) return false

  if (action === 'back') {
    appStore.navigate(resolveExecDetailBackHref())
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
    if (!order || !session) {
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
      if (!overlay || overlay.orderId !== orderId || overlay.expectedStatus !== order.status || overlay.token !== actionNode.dataset.overlayToken) {
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
      detailState.waterCompletionDraft = { orderId, completedQty: String(order.plannedQty), reason: '' }
      detailState.waterOverlay = { type: 'completion', orderId, expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS', token: createWaterOverlayToken(orderId) }
      refreshWaterSolubleOverlay()
      return true
    }
    if (action === 'water-open-supervisor') {
      detailState.waterOverlay = { type: 'supervisor', orderId, expectedStatus: 'PRODUCTION_PAUSED', token: createWaterOverlayToken(orderId) }
      refreshWaterSolubleOverlay()
      return true
    }
    if (action === 'water-go-handover') {
      appStore.navigate(`/fcs/pda/handover?tab=handout&focusTaskId=${encodeURIComponent(order.taskId)}`)
      return true
    }

    if (action === 'water-confirm-completion') {
      if (detailState.waterCompletionDraft.orderId !== orderId) {
        showPdaExecDetailToast('当前填写内容已失效，请重新打开。')
        return true
      }
      const completedQty = Number(detailState.waterCompletionDraft.completedQty.trim())
      if (!Number.isFinite(completedQty) || completedQty <= 0) {
        showPdaExecDetailToast('请输入大于 0 的有效完成数量。')
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
      const actionKey = `${orderId}:COMPLETE:${order.status}`
      if (pendingWaterActions.has(actionKey)) return true
      pendingWaterActions.add(actionKey)
      const button = actionNode as HTMLButtonElement
      const oldText = button.textContent || '确认完成'
      button.disabled = true
      button.textContent = '处理中…'
      const result = executeWaterSolublePdaAction({ action: 'COMPLETE', orderId, expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS', completedQty, reason, actor: session })
      pendingWaterActions.delete(actionKey)
      showPdaExecDetailToast(result.message)
      if (result.ok) {
        detailState.waterOverlay = null
        detailState.waterCompletionDraft = { orderId: '', completedQty: '', reason: '' }
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
      const actionKey = `${orderId}:RESOLVE_PAUSE:${order.status}`
      if (pendingWaterActions.has(actionKey)) return true
      pendingWaterActions.add(actionKey)
      const button = actionNode as HTMLButtonElement
      const oldText = button.textContent || '确认处理'
      button.disabled = true
      button.textContent = '处理中…'
      const result = executeWaterSolublePdaAction({ action: 'RESOLVE_PAUSE', orderId, expectedStatus: 'PRODUCTION_PAUSED', decision, actor: session })
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

    const actionKey = `${orderId}:${action}:${order.status}`
    if (pendingWaterActions.has(actionKey)) return true
    pendingWaterActions.add(actionKey)
    const button = actionNode as HTMLButtonElement
    const oldText = button.textContent || ''
    button.disabled = true
    button.textContent = '处理中…'
    const result = action === 'water-material-ready'
      ? executeWaterSolublePdaAction({ action: 'MATERIAL_READY', orderId, expectedStatus: 'WAIT_MATERIAL', actor: session })
      : executeWaterSolublePdaAction({ action: 'START', orderId, expectedStatus: 'WAIT_WATER_SOLUBLE', actor: session })
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
      detailState.dyeWaterDraft = { dyeOrderId: '', outputQty: '', reason: '' }
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
    if (!order || !session || !order.requiresWaterSoluble) {
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
      if (!overlay || overlay.dyeOrderId !== dyeOrderId || overlay.taskId !== order.taskId || overlay.expectedStatus !== order.status || overlay.token !== actionNode.dataset.overlayToken) {
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
      detailState.dyeWaterDraft = { dyeOrderId, outputQty: String(order.waterSolublePlannedQty ?? order.plannedQty), reason: '' }
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
      if (detailState.dyeWaterDraft.dyeOrderId !== dyeOrderId) {
        showPdaExecDetailToast('当前填写内容已失效，请重新打开。')
        return true
      }
      const outputQty = Number(detailState.dyeWaterDraft.outputQty.trim())
      const plannedQty = order.waterSolublePlannedQty ?? order.plannedQty
      const reason = detailState.dyeWaterDraft.reason.trim()
      if (!Number.isFinite(outputQty) || outputQty <= 0) {
        showPdaExecDetailToast('请输入大于 0 的有效完成数量。')
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
        detailState.dyeWaterDraft = { dyeOrderId: '', outputQty: '', reason: '' }
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
      const key = `${dyeOrderId}:START_DYE:${order.status}`
      if (pendingDyeWaterActions.has(key)) return true
      pendingDyeWaterActions.add(key)
      const button = actionNode as HTMLButtonElement
      const oldText = button.textContent || '开始染色'
      button.disabled = true
      button.textContent = '处理中…'
      const inputText = window.prompt('请输入染色投入数量', String(order.waterSolubleCompletedQty ?? order.plannedQty))
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
        startDyeing(dyeOrderId, { dyeVatNo, inputQty, operatorName: session.userName })
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

  if (action === 'wool-workflow' && actionNode.dataset.woolOrderId && actionNode.dataset.woolWorkflowAction) {
    const orderId = actionNode.dataset.woolOrderId
    const workflowAction = actionNode.dataset.woolWorkflowAction
    const operatedAt = nowTimestamp()
    const woolOrder = getWoolWorkOrderByTaskId(orderId) || getWoolOrderForTask(getTaskFactById(orderId))
    if (workflowAction === 'ACCEPT') acceptWoolWorkOrder(orderId, '工厂端操作员', operatedAt)
    if (workflowAction === 'CONFIRM_PICKUP') confirmWoolPickupRecord(orderId, '工厂端操作员', operatedAt)
    if (workflowAction === 'COMPLETE_PICKUP') completeWoolPickupHead(orderId, '工厂端操作员', operatedAt)
    if (workflowAction === 'SCHEDULE_MACHINE') scheduleWoolMachines(orderId, '工厂端排产员', operatedAt)
    if (workflowAction === 'START_FLAT') {
      const defaultQty = woolOrder ? getWoolYarnUsageSummary(woolOrder).processingUsageWeightKg || woolOrder.yarnReceipt.receivedWeightKg || woolOrder.yarnReceipt.plannedWeightKg : 0
      const yarnUsageWeightKg = promptWoolKgValue('请输入本次纱线加工领用数量（kg）', defaultQty, false)
      if (yarnUsageWeightKg === null) return true
      updateWoolWorkOrderNodeStatus(orderId, '横机成片', '进行中', '工厂端操作员', operatedAt, { yarnUsageWeightKg })
    }
    if (workflowAction === 'REPORT_FLAT_MILESTONE') updateWoolWorkOrderNodeStatus(orderId, '横机成片', '进行中', '工厂端操作员', operatedAt)
    if (workflowAction === 'COMPLETE_FLAT') updateWoolWorkOrderNodeStatus(orderId, '横机成片', '已完成', '工厂端操作员', operatedAt)
    if (workflowAction === 'START_LINKING') updateWoolWorkOrderNodeStatus(orderId, '缝盘', '进行中', '工厂端操作员', operatedAt)
    if (workflowAction === 'COMPLETE_LINKING') {
      const defaultQty = woolOrder ? getWoolYarnUsageSummary(woolOrder).linkingLossWeightKg : 0
      const yarnLossWeightKg = promptWoolKgValue('请输入缝盘损耗纱线数量（kg）', defaultQty, true)
      if (yarnLossWeightKg === null) return true
      updateWoolWorkOrderNodeStatus(orderId, '缝盘', '已完成', '工厂端操作员', operatedAt, { yarnLossWeightKg })
    }
    if (workflowAction === 'START_IRONING') updateWoolWorkOrderNodeStatus(orderId, '熨烫', '进行中', '工厂端操作员', operatedAt)
    if (workflowAction === 'COMPLETE_IRONING') updateWoolWorkOrderNodeStatus(orderId, '熨烫', '已完成', '工厂端操作员', operatedAt)
    if (workflowAction === 'START_PACKING') updateWoolWorkOrderNodeStatus(orderId, '包装', '进行中', '工厂端操作员', operatedAt)
    if (workflowAction === 'COMPLETE_PACKING') updateWoolWorkOrderNodeStatus(orderId, '包装', '已完成', '工厂端操作员', operatedAt)
    if (workflowAction === 'SKIP_PACKING') updateWoolWorkOrderNodeStatus(orderId, '包装', '已跳过', '工厂端操作员', operatedAt)
    if (workflowAction === 'PRINT_FEI_TICKET') markWoolFeiTicketsPrinted(orderId, '工厂端操作员', operatedAt)
    if (workflowAction === 'SUBMIT_HANDOVER') submitWoolHandover(orderId, '工厂端操作员', operatedAt)
    if (workflowAction === 'CONFIRM_HANDOVER_RECEIPT') confirmWoolHandoverReceipt(orderId, '接收仓库', operatedAt)
    showPdaExecDetailToast('毛织任务状态已更新，Web端同步更新')
    return true
  }

  if (
    (action === 'wool-node-start' || action === 'wool-node-complete' || action === 'wool-node-skip')
    && actionNode.dataset.woolOrderId
    && actionNode.dataset.nodeName
  ) {
    const nextStatus: WoolNodeStatus =
      action === 'wool-node-start' ? '进行中' : action === 'wool-node-complete' ? '已完成' : '已跳过'
    const woolOrder = getWoolWorkOrderByTaskId(actionNode.dataset.woolOrderId) || getWoolOrderForTask(getTaskFactById(actionNode.dataset.woolOrderId))
    if (nextStatus === '进行中' && actionNode.dataset.nodeName === '横机成片') {
      const defaultQty = woolOrder ? getWoolYarnUsageSummary(woolOrder).processingUsageWeightKg || woolOrder.yarnReceipt.receivedWeightKg || woolOrder.yarnReceipt.plannedWeightKg : 0
      const yarnUsageWeightKg = promptWoolKgValue('请输入本次纱线加工领用数量（kg）', defaultQty, false)
      if (yarnUsageWeightKg === null) return true
      updateWoolWorkOrderNodeStatus(actionNode.dataset.woolOrderId, actionNode.dataset.nodeName, nextStatus, '工厂端操作员', nowTimestamp(), { yarnUsageWeightKg })
      showPdaExecDetailToast(`毛织节点已更新为${nextStatus}，Web端同步更新`)
      return true
    }
    if (nextStatus === '已完成' && actionNode.dataset.nodeName === '缝盘') {
      const defaultQty = woolOrder ? getWoolYarnUsageSummary(woolOrder).linkingLossWeightKg : 0
      const yarnLossWeightKg = promptWoolKgValue('请输入缝盘损耗纱线数量（kg）', defaultQty, true)
      if (yarnLossWeightKg === null) return true
      updateWoolWorkOrderNodeStatus(actionNode.dataset.woolOrderId, actionNode.dataset.nodeName, nextStatus, '工厂端操作员', nowTimestamp(), { yarnLossWeightKg })
      showPdaExecDetailToast(`毛织节点已更新为${nextStatus}，Web端同步更新`)
      return true
    }
    updateWoolWorkOrderNodeStatus(actionNode.dataset.woolOrderId, actionNode.dataset.nodeName, nextStatus, '工厂端操作员', nowTimestamp())
    showPdaExecDetailToast(`毛织节点已更新为${nextStatus}，Web端同步更新`)
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
    const taskId = actionNode.dataset.taskId
    if (!taskId) {
      showPdaExecDetailToast('任务未关联')
      return true
    }
    const printOrderForQty = action === 'print-submit-handover' ? getPrintWorkOrderByTaskId(taskId) : undefined
    const dyeOrderForQty = action === 'dye-submit-handover' ? getDyeWorkOrderByTaskId(taskId) : undefined
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
    const defaultQty = printOrderForQty?.actualCompletedQty || printOrderForQty?.plannedQty || dyeOrderForQty?.plannedQty || 0
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
          operatorName: '印花工厂',
          operatedAt: nowTimestamp(),
          objectType: printOrder.objectType || (printOrder.qtyUnit === '片' ? '裁片' : '面料'),
          objectQty: submittedQty,
          qtyUnit: printOrder.qtyUnit,
          qtyLabel,
          remark: '移动端发起交出',
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
          operatorName: '染色工厂',
          operatedAt: nowTimestamp(),
          objectType: '面料',
          objectQty: submittedQty,
          qtyUnit: dyeOrder.qtyUnit,
          qtyLabel,
          remark: '移动端发起交出',
        })
      }
      showPdaExecDetailToast('交出记录已生成，Web 端交出与仓库待收货记录已同步')
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
    if (!canOperateDyeingNode(task)) {
      showPdaExecDetailToast('请先开工')
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
    action === 'special-bind-fei-ticket' ||
    action === 'special-receive-cut-pieces' ||
    action === 'special-start-process' ||
    action === 'special-finish-process' ||
    action === 'special-report-difference' ||
    action === 'special-submit-handover' ||
    action === 'special-rework-after-reject'
  ) {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true
    try {
      if (action === 'special-bind-fei-ticket') {
        const feiTicketNo = window.prompt('请输入绑定菲票号')?.trim() || ''
        if (!feiTicketNo) {
          showPdaExecDetailToast('请填写菲票号')
          return true
        }
        bindSpecialCraftFeiTicket(taskId, { feiTicketNo, operatorName: '现场操作员', operatedAt: nowTimestamp() })
        showPdaExecDetailToast('菲票已绑定，Web 端绑定菲票已同步')
        return true
      }

      if (action === 'special-report-difference') {
        const task = getTaskFactById(taskId)
        const bindings = task ? getSpecialCraftExecBindings(task) : []
        const workOrder = task ? getSpecialCraftWorkOrderForPdaTask(task, bindings) : undefined
        const objectMeta = resolveSpecialCraftPdaObjectMeta(workOrder)
        const sourceId = workOrder?.workOrderId || ''
        if (!sourceId) {
          showPdaExecDetailToast('特殊工艺加工单未关联')
          return true
        }
        let scrapQty = Number(detailState.specialCraftScrapQty || 0)
        let damageQty = Number(detailState.specialCraftDamageQty || 0)
        if (scrapQty + damageQty <= 0) {
          const diffQtyText = window.prompt(`请输入差异${objectMeta.objectLabel}数量`, '1')?.trim() || ''
          scrapQty = Number(diffQtyText || 0)
          damageQty = 0
        }
        if (!Number.isFinite(scrapQty) || !Number.isFinite(damageQty) || scrapQty + damageQty <= 0) {
          showPdaExecDetailToast(`请填写有效差异${objectMeta.objectLabel}数量`)
          return true
        }
        executeMobileProcessAction({
          sourceType: 'SPECIAL_CRAFT',
          sourceId,
          taskId,
          actionCode: 'SPECIAL_CRAFT_REPORT_DIFFERENCE',
          operatorName: '现场操作员',
          operatedAt: nowTimestamp(),
          objectType: objectMeta.objectType,
          objectQty: scrapQty + damageQty,
          qtyUnit: objectMeta.qtyUnit,
          remark: '移动端上报差异',
        })
        showPdaExecDetailToast(`差异已上报，${objectMeta.requiresFeiTicket ? '菲票数量和 ' : ''}Web 端差异记录已同步`)
        return true
      }

      const task = getTaskFactById(taskId)
      const bindings = task ? getSpecialCraftExecBindings(task) : []
      const workOrder = task ? getSpecialCraftWorkOrderForPdaTask(task, bindings) : undefined
      const objectMeta = resolveSpecialCraftPdaObjectMeta(workOrder)
      const sourceId = workOrder?.workOrderId || ''
      if (!sourceId) {
        showPdaExecDetailToast('特殊工艺加工单未关联')
        return true
      }
      const sourceBinding = objectMeta.requiresFeiTicket ? bindings[0] : undefined
      const actionCodeMap: Record<string, string> = {
        'special-receive-cut-pieces': 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES',
        'special-start-process': 'SPECIAL_CRAFT_START_PROCESS',
        'special-finish-process': 'SPECIAL_CRAFT_FINISH_PROCESS',
        'special-submit-handover': 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
        'special-rework-after-reject': 'SPECIAL_CRAFT_REWORK_AFTER_REJECT',
      }
      const actionLabelMap: Record<string, string> = {
        'special-receive-cut-pieces': `确认接收${objectMeta.objectLabel}`,
        'special-start-process': '开始加工',
        'special-finish-process': '完成加工',
        'special-submit-handover': '发起交出',
        'special-rework-after-reject': '驳回后重交',
      }
      const baseQty = getSpecialCraftPdaBaseQty(task as ProcessTask, workOrder, sourceBinding, objectMeta) || 1
      const finishQty = Math.max(
        baseQty - Number(detailState.specialCraftScrapQty || 0) - Number(detailState.specialCraftDamageQty || 0),
        0,
      )
      executeMobileProcessAction({
        sourceType: 'SPECIAL_CRAFT',
        sourceId,
        taskId,
        actionCode: actionCodeMap[action] || 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
        operatorName: '现场操作员',
        operatedAt: nowTimestamp(),
        objectType: objectMeta.objectType,
        objectQty: action === 'special-finish-process' ? finishQty || baseQty : baseQty,
        qtyUnit: objectMeta.qtyUnit,
        remark: `移动端${actionLabelMap[action] || '发起交出'}`,
      })
      showPdaExecDetailToast(`特殊工艺${actionLabelMap[action] || '发起交出'}已同步`)
      return true
    } catch (error) {
      showPdaExecDetailToast(error instanceof Error ? error.message : '特殊工艺写回失败')
      return true
    }
  }

  if (
    action === 'post-mobile-create-qc-submit'
    || action === 'post-mobile-complete-qc-submit'
    || action === 'post-mobile-complete-recheck-submit'
    || action === 'post-mobile-open-complete-qc'
    || action === 'post-mobile-open-complete-recheck'
    || action === 'post-project-start'
    || action === 'post-project-complete'
  ) {
    try {
      if (action === 'post-mobile-open-complete-qc') {
        const qcOrderId = actionNode.dataset.qcOrderId
        const postTaskId = actionNode.dataset.postTaskId || qcOrderId
        if (!qcOrderId || !postTaskId) return true
        appStore.navigate(buildPdaPostTaskActionHref(postTaskId, 'complete-qc', { qcOrderId }))
        return true
      }

      if (action === 'post-mobile-open-complete-recheck') {
        const recheckOrderId = actionNode.dataset.recheckOrderId
        const postTaskId = actionNode.dataset.postTaskId || recheckOrderId
        if (!recheckOrderId || !postTaskId) return true
        appStore.navigate(buildPdaPostTaskActionHref(postTaskId, 'complete-recheck', { recheckOrderId }))
        return true
      }

      if (action === 'post-mobile-create-qc-submit') {
        const postTaskId = actionNode.dataset.postTaskId
        if (!postTaskId) return true
        const allocations = Array.from(document.querySelectorAll<HTMLElement>('[data-pda-qc-card]'))
          .filter((card) => card.querySelector<HTMLInputElement>('[data-pda-qc-selected]')?.checked)
          .map((card) => ({
            warehouseRecordId: card.dataset.warehouseRecordId || '',
            qcQty: readNumberFromElement(card, '[data-pda-qc-qty]'),
          }))
          .filter((item) => item.warehouseRecordId && item.qcQty > 0)
        if (!allocations.length) {
          showPdaExecDetailToast('请至少选择一个待质检 SKU')
          return true
        }
        const qc = createPostFinishingQcOrder({
          postTaskId,
          allocations,
          inspectorName: 'PDA 后道质检员',
          qcStationName: '后道质检台 A',
        })
        showPdaExecDetailToast('质检单已创建')
        appStore.navigate(buildPdaPostTaskActionHref(postTaskId, 'complete-qc', { qcOrderId: qc.qcOrderId }))
        return true
      }

      if (action === 'post-mobile-complete-qc-submit') {
        const qcOrderId = actionNode.dataset.qcOrderId
        const postTaskId = actionNode.dataset.postTaskId
        if (!qcOrderId) return true
        const qcSkuResults = collectPdaQcSkuResults(qcOrderId)
        if (!qcSkuResults.length) {
          showPdaExecDetailToast('请填写 SKU 质检结果')
          return true
        }
        const invalidResult = qcSkuResults.find((item) => item.inspectedQty !== item.qualifiedQty + item.reworkQty + item.defectAcceptedQty)
        if (invalidResult) {
          showPdaExecDetailToast(`${invalidResult.skuCode || 'SKU'} 数量不一致`)
          return true
        }
        const missingButtonMode = qcSkuResults.find((item) => item.postProjectJudgements.some((project) => project.projectName === '装扣子' && project.needed && !project.buttonAttachMode))
        if (missingButtonMode) {
          showPdaExecDetailToast(`${missingButtonMode.skuCode || 'SKU'} 请选择人工装扣或机器装扣`)
          return true
        }
        const inspectedQty = qcSkuResults.reduce((sum, item) => sum + item.inspectedQty, 0)
        const defectiveQty = qcSkuResults.reduce((sum, item) => sum + item.unqualifiedQty, 0)
        const passedQty = qcSkuResults.reduce((sum, item) => sum + item.qualifiedQty, 0)
        const hasDefectAcceptedQty = qcSkuResults.some((item) => item.defectAcceptedQty > 0)
        if (hasDefectAcceptedQty) {
          submitPostFinishingPdaQcResult({
            qcOrderId,
            qcSkuResults,
            inspectorName: 'PDA 后道质检员',
            qcStationName: '后道质检台 A',
          })
          showPdaExecDetailToast('已提交，待 Web 补齐瑕疵原因')
        } else {
          completePostFinishingQcOrder({
            qcOrderId,
            qcSkuResults,
            inspectedGarmentQty: inspectedQty,
            passedGarmentQty: passedQty,
            defectiveGarmentQty: defectiveQty,
            qcResult: defectiveQty <= 0 ? '全数合规' : passedQty <= 0 ? '全数不合格' : '部分不合格',
            inspectorName: 'PDA 后道质检员',
            qcStationName: '后道质检台 A',
            unqualifiedReasonSummary: defectiveQty > 0 ? 'PDA 录入 SKU 级不合格结果' : '',
          })
          showPdaExecDetailToast('质检结果已提交')
        }
        appStore.navigate(`/fcs/pda/exec/${encodeURIComponent(postTaskId || qcOrderId)}`)
        return true
      }

      if (action === 'post-mobile-complete-recheck-submit') {
        const recheckOrderId = actionNode.dataset.recheckOrderId
        const postTaskId = actionNode.dataset.postTaskId
        if (!recheckOrderId) return true
        const recheckSkuResults = collectPdaRecheckSkuResults(recheckOrderId)
        if (!recheckSkuResults.length) {
          showPdaExecDetailToast('请填写 SKU 复检结果')
          return true
        }
        completePostFinishingRecheckOrder({
          recheckOrderId,
          operatorName: 'PDA 复检员',
          recheckSkuResults,
        })
        showPdaExecDetailToast('复检结果已提交')
        appStore.navigate(`/fcs/pda/exec/${encodeURIComponent(postTaskId || recheckOrderId)}`)
        return true
      }

      const postOrderId = actionNode.dataset.postOrderId
      const projectLineId = actionNode.dataset.projectLineId
      if (!postOrderId || !projectLineId) return true
      if (action === 'post-project-start') {
        startPostFinishingProjectLine({
          postOrderId,
          projectLineId,
          operatorName: 'PDA 后道操作员',
        })
        showPdaExecDetailToast('后道项目已开始')
        return true
      }
      completePostFinishingProjectLine({
        postOrderId,
        projectLineId,
        operatorName: 'PDA 后道操作员',
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
          operatorName: '移动端操作员',
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

      if (action === 'post-finish-action' && actionType === '质检') {
        const qcOrderId = getPostFinishingWorkOrderForMobile(postOrderId)?.qcOrderId
        if (qcOrderId) {
          appStore.navigate(buildPdaPostTaskActionHref(postTaskId || postOrderId, 'complete-qc', { qcOrderId }))
        }
        return true
      }

      if (action === 'post-finish-action' && actionType === '复检') {
        const recheckOrderId = getPostFinishingWorkOrderForMobile(postOrderId)?.recheckOrderId
        if (recheckOrderId) {
          appStore.navigate(buildPdaPostTaskActionHref(postTaskId || postOrderId, 'complete-recheck', { recheckOrderId }))
        }
        return true
      }

      if (action === 'post-start-action') {
        executeMobileProcessAction({
          sourceType: 'POST_FINISHING',
          sourceId: postOrderId,
          taskId: postTaskId,
          actionCode: actionNode.dataset.postActionCode || getPostFinishingActionCode(actionType, 'start'),
          operatorName: '移动端操作员',
          operatedAt: nowTimestamp(),
          objectType: '成衣',
          objectQty: getPostFinishingWorkOrderForMobile(postOrderId)?.plannedGarmentQty || 1,
          qtyUnit: '件',
          remark: `移动端${getPostFinishingActionLabel(actionType, 'start')}`,
        })
        showPdaExecDetailToast(`${getPostFinishingActionLabel(actionType, 'start')}已通过统一写回记录`)
        return true
      }

      const qtyPrompt =
        actionType === '复检'
          ? '请输入复检确认成衣件数'
          : actionType === '质检'
            ? '请输入已质检成衣件数'
            : '请输入完成成衣件数'
      const qtyText = window.prompt(qtyPrompt, '0')?.trim() || ''
      const submittedQty = Number(qtyText)
      if (!Number.isFinite(submittedQty) || submittedQty <= 0) {
        showPdaExecDetailToast(qtyPrompt)
        return true
      }
      const rejectedQty =
        actionType === '质检'
          ? Number(window.prompt('请输入不合格成衣件数', '0')?.trim() || '0')
          : 0
      const acceptedQty =
        actionType === '复检'
          ? submittedQty
          : actionType === '质检'
            ? Math.max(submittedQty - (Number.isFinite(rejectedQty) ? rejectedQty : 0), 0)
            : submittedQty
      executeMobileProcessAction({
        sourceType: 'POST_FINISHING',
        sourceId: postOrderId,
        taskId: postTaskId,
        actionCode: actionNode.dataset.postActionCode || getPostFinishingActionCode(actionType, 'finish'),
        operatorName: '移动端操作员',
        operatedAt: nowTimestamp(),
        objectType: '成衣',
        objectQty: submittedQty,
        qtyUnit: '件',
        formData: {
          质检不合格成衣件数: Number.isFinite(rejectedQty) ? rejectedQty : 0,
          复检不合格成衣件数: actionType === '复检' ? 0 : undefined,
        },
        remark: `移动端${getPostFinishingActionLabel(actionType, 'finish')}，确认 ${acceptedQty} 件`,
      })
      showPdaExecDetailToast(`${getPostFinishingActionLabel(actionType, 'finish')}已通过统一写回同步 Web`)
      return true
    } catch (error) {
      showPdaExecDetailToast(error instanceof Error ? error.message : '后道写回失败')
      return true
    }
  }

  if (action === 'post-task-create-qc') {
    const postTaskId = actionNode.dataset.postTaskId
    if (!postTaskId) return true
    appStore.navigate(buildPdaPostTaskActionHref(postTaskId, 'create-qc'))
    return true
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
        const qtyText = window.prompt('请输入后道完成成衣件数', '0')?.trim() || ''
        const completedQty = Number(qtyText)
        if (!Number.isFinite(completedQty) || completedQty <= 0) {
          showPdaExecDetailToast('请填写有效后道完成成衣件数')
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
    const woolOrderForStart = getWoolOrderForTask(task)
    const yarnUsageWeightKg = woolOrderForStart
      ? promptWoolKgValue(
          '请输入本次纱线加工领用数量（kg）',
          getWoolYarnUsageSummary(woolOrderForStart).processingUsageWeightKg
            || woolOrderForStart.yarnReceipt.receivedWeightKg
            || woolOrderForStart.yarnReceipt.plannedWeightKg,
          false,
        )
      : undefined
    if (yarnUsageWeightKg === null) return true

    const isWoolTask = startWoolOrderFromMobile(task, startTime, yarnUsageWeightKg)
    if (!isWoolTask) {
      mutateStartTask(taskId, 'PDA', {
        startTime,
        headcount,
        proofFiles: detailState.startProofFiles,
      })
    }
    if (!isWoolTask && isSpecialCraftExecutionTask(task, getTaskProcessDisplayName(task))) {
      try {
        const specialBindings = getSpecialCraftExecBindings(task)
        const specialWorkOrder = getSpecialCraftWorkOrderForPdaTask(task, specialBindings)
        const objectMeta = resolveSpecialCraftPdaObjectMeta(specialWorkOrder)
        const sourceBinding = objectMeta.requiresFeiTicket ? specialBindings[0] : undefined
        const sourceId = specialWorkOrder?.workOrderId || ''
        if (sourceId) {
          executeMobileProcessAction({
            sourceType: 'SPECIAL_CRAFT',
            sourceId,
            taskId,
            actionCode: 'SPECIAL_CRAFT_START_PROCESS',
            operatorName: '现场操作员',
            operatedAt: startTime,
            objectType: objectMeta.objectType,
            objectQty: getSpecialCraftPdaBaseQty(task, specialWorkOrder, sourceBinding, objectMeta) || 1,
            qtyUnit: objectMeta.qtyUnit,
            remark: '移动端开始加工',
          })
        }
      } catch {
        // 开工主链已成功，特殊工艺回写失败时保持原有移动端提示逻辑。
      }
    }
    let startToast = '开工成功'
    try {
      if (isWoolTask) {
        showPdaExecDetailToast('开工成功，毛织加工单已同步 Web 端')
        syncPdaStartRiskAndExceptions()
        syncMilestoneOverdueExceptions()
        return true
      }
      const ensured = ensureHandoverOrderForStartedTask(taskId)
      const updatedTask = getTaskFactById(taskId) as TaskWithHandoverFields | null
      const handoverOrder = getHandoverOrderById(ensured.handoverOrderId) ?? null
      if (updatedTask) {
        syncTaskHandoverFields(updatedTask, handoverOrder)
      }
      startToast = ensured.created ? '开工成功，交出单已生成' : '开工成功，交出单已就绪'
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

    if (reportWoolMilestoneFromMobile(task, reportAt)) {
      showPdaExecDetailToast('关键节点已上报，毛织加工单已同步 Web 端')
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
    if (getWaterSolubleWorkOrderByTaskId(task.taskId)) {
      showPdaExecDetailToast('请使用页面上的当前水溶动作，不要使用通用完工')
      return true
    }
    const access = getMobileTaskAccessResult(task, getPdaSession()?.factoryId || task.assignedFactoryId || TEST_FACTORY_ID)
    if (!access.canExecuteInMobile) {
      showPdaExecDetailToast(`当前任务不可执行：${access.reasonLabel}`)
      return true
    }
    if (task.pdaStepTemplateCode === 'SIMPLE_FIVE_STEP') {
      showPdaExecDetailToast(`请先上传进度并交给${task.handoverReceiverName || '仓库'}，仓库待确认后才能完工`)
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
      const scrapQty = Number(detailState.specialCraftScrapQty || 0)
      const damageQty = Number(detailState.specialCraftDamageQty || 0)
      if (!Number.isFinite(scrapQty) || scrapQty < 0 || !Number.isFinite(damageQty) || damageQty < 0) {
        showPdaExecDetailToast('请填写有效报废和货损数量')
          return true
      }
      const objectMeta = resolveSpecialCraftPdaObjectMeta(specialCraftWorkOrder)
      const sourceBinding = objectMeta.requiresFeiTicket ? specialCraftBindings[0] : undefined
      const baseQty = getSpecialCraftPdaBaseQty(task, specialCraftWorkOrder, sourceBinding, objectMeta)
      executeMobileProcessAction({
        sourceType: 'SPECIAL_CRAFT',
        sourceId: specialCraftWorkOrder.workOrderId,
        taskId,
        actionCode: 'SPECIAL_CRAFT_FINISH_PROCESS',
        operatorName: '现场操作员',
        operatedAt: nowTimestamp(),
        objectType: objectMeta.objectType,
        objectQty: Math.max(baseQty - scrapQty - damageQty, 0),
        qtyUnit: objectMeta.qtyUnit,
        remark: `移动端完成加工，报废${objectMeta.objectLabel}数量${scrapQty}${objectMeta.qtyUnit}，货损${objectMeta.objectLabel}数量${damageQty}${objectMeta.qtyUnit}`,
      })
      detailState.specialCraftScrapQty = '0'
      detailState.specialCraftDamageQty = '0'
    }

    if (finishWoolOrderFromMobile(task)) {
      showPdaExecDetailToast('完工成功，毛织加工单已同步 Web 端')
      return true
    }

    mutateFinishTask(taskId, 'PDA')
    showPdaExecDetailToast('完工成功')
    return true
  }

  return false
}
