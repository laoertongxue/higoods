import { appStore } from '../state/store'
import { renderRealQrPlaceholder } from '../components/real-qr'
import { escapeHtml } from '../utils'
import { processTasks, type ExecProofFile, type PauseReasonCode, type ProcessTask, type StartProofFile } from '../data/fcs/process-tasks.ts'
import { indonesiaFactories } from '../data/fcs/indonesia-factories'
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
  getPdaTaskFlowTaskById,
  isCuttingSpecialTask,
  listPdaTaskFlowTasks,
} from '../data/fcs/pda-cutting-execution-source.ts'
import {
  getSpecialCraftFeiTicketScanSummary,
  listCuttingSpecialCraftFeiTicketBindings,
} from '../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import {
  formatRemainingHours,
  formatStartDueSourceText,
  getStartPrerequisite,
  getTaskStartDueInfo,
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
  getDyeExecutionNodeRecord,
  getDyeOrderHandoverSummary,
  getDyeReviewRecordByOrderId,
  getDyeWorkOrderById,
  getDyeWorkOrderByTaskId,
  getDyeWorkOrderStatusLabel,
  getSampleWaitTypeLabel,
  listDyeVatOptions,
  type DyeWorkOrder,
} from '../data/fcs/dyeing-task-domain.ts'
import {
  bindSpecialCraftFeiTicket,
  finishDyeMaterialWaitWriteback,
  finishDyeNode,
  finishDyeSampleWaitWriteback,
  finishPostFinishingAction,
  finishPrintNode,
  finishSpecialCraftTask,
  getPostFinishingWorkOrderForMobile,
  createPostFinishingHandoverWarehouseRecord,
  receivePostFinishedGarmentsAtManagedPostFactory,
  reportSpecialCraftDifference,
  startDyeMaterialWaitWriteback,
  startDyeNode,
  startDyeSampleWaitWriteback,
  startPostFinishingAction,
  startPrintNode,
  startSpecialCraftTask,
  submitDyeHandover,
  submitPostFinishingHandover,
  submitPrintHandover,
  transferPostFinishedGarmentsToManagedPostFactory,
  submitSpecialCraftHandover,
} from '../data/fcs/process-execution-writeback.ts'
import type {
  PostFinishingActionType,
  PostFinishingWorkOrder,
  SewingFactoryPostTask,
} from '../data/fcs/post-finishing-domain.ts'
import {
  getPostFinishingFlowText,
  getPostFinishingSourceLabel,
  getSewingFactoryPostTaskById,
  listPostFinishingWorkOrders,
  listSewingFactoryPostTasks,
  finishSewingFactoryPostTask,
  startSewingFactoryPostTask,
  transferSewingFactoryPostTaskToManagedFactory,
} from '../data/fcs/post-finishing-domain.ts'
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
}

function mapPostFinishingStatusToTaskStatus(status: string): ProcessTask['status'] {
  if (status.includes('差异')) return 'BLOCKED'
  if (status.includes('中')) return 'IN_PROGRESS'
  if (status.includes('已交出') || status.includes('已回写') || status.includes('已完成')) return 'DONE'
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
  const baseTasks = listPdaTaskFlowTasks()
  const existingTaskIds = new Set(baseTasks.map((task) => task.taskId))
  const postTasks = listPostFinishingWorkOrders()
    .filter((order) => !existingTaskIds.has(order.sourceTaskId))
    .map((order, index) => mapPostFinishingOrderToTask(order, baseTasks.length + index + 1))
  const existingWithPost = new Set([...existingTaskIds, ...postTasks.map((task) => task.taskId)])
  const sewingPostTasks = listSewingFactoryPostTasks()
    .filter((task) => !existingWithPost.has(task.postTaskId))
    .map((task, index) => mapSewingFactoryPostTaskToProcessTask(task, baseTasks.length + postTasks.length + index + 1))
  return [...baseTasks, ...postTasks, ...sewingPostTasks]
}

function getTaskFactById(taskId: string): ProcessTask | null {
  return getPdaTaskFlowTaskById(taskId) ?? processTasks.find((task) => task.taskId === taskId) ?? null
}

function getTaskDisplayNo(task: ProcessTask): string {
  return task.taskNo || task.taskId
}

function getRootTaskDisplayNo(task: ProcessTask): string {
  return task.rootTaskNo || task.taskNo || task.taskId
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
    WAIT_RECEIVER_WRITEBACK: '待回写',
    PARTIAL_WRITTEN_BACK: '部分回写',
    WRITTEN_BACK: '已回写',
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
          <span class="text-xs font-medium">${escapeHtml(handoverOrder.handoverOrderNo || handoverOrderId)}</span>
          <span class="text-xs text-muted-foreground">状态</span>
          <span class="text-xs font-medium">${escapeHtml(getHandoverOrderStatusLabel(handoverOrder.handoverOrderStatus))}</span>
          <span class="text-xs text-muted-foreground">已交出</span>
          <span class="text-xs">${handoverOrder.submittedQtyTotal ?? 0} ${escapeHtml(unitLabel)}</span>
          <span class="text-xs text-muted-foreground">已回写</span>
          <span class="text-xs">${handoverOrder.writtenBackQtyTotal ?? 0} ${escapeHtml(unitLabel)}</span>
          <span class="text-xs text-muted-foreground">差异</span>
          <span class="text-xs">${handoverOrder.diffQtyTotal ?? 0} ${escapeHtml(unitLabel)}</span>
          <span class="text-xs text-muted-foreground">异议</span>
          <span class="text-xs">${handoverOrder.objectionCount} 条</span>
          <span class="text-xs text-muted-foreground">待回写</span>
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

function canOperatePrintingNode(task: ProcessTask): boolean {
  return task.status !== 'NOT_STARTED' && task.status !== 'CANCELLED'
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
      : printOrder.status === 'HANDOVER_SUBMITTED'
        ? renderPrintingStatusBadge('已交出待回写', 'warning')
        : handoverSummary.writtenBackQty > 0
          ? renderPrintingStatusBadge('接收方已回写', 'info')
          : renderPrintingStatusBadge('未开始', 'muted')
  const reviewBadge = review
    ? review.reviewStatus === 'PASS'
      ? renderPrintingStatusBadge('已完成', 'success')
      : review.reviewStatus === 'REJECTED'
        ? renderPrintingStatusBadge('已驳回', 'danger')
        : renderPrintingStatusBadge('待审核', 'warning')
    : renderPrintingStatusBadge('待审核', 'muted')

  return `
    <article class="rounded-lg border bg-card">
      <header class="border-b px-4 py-3">
        <div class="flex items-center justify-between gap-2">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <i data-lucide="palette" class="h-4 w-4"></i>
            印花任务
          </h2>
          ${renderPrintingStatusBadge(getPrintWorkOrderStatusLabel(printOrder.status), printOrder.status === 'COMPLETED' ? 'success' : printOrder.status === 'REJECTED' ? 'danger' : printOrder.status === 'WAIT_HANDOVER' || printOrder.status === 'HANDOVER_SUBMITTED' || printOrder.status === 'WAIT_REVIEW' ? 'warning' : 'info')}
        </div>
      </header>

      <div class="space-y-4 p-4 text-sm">
        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
          <span class="text-xs text-muted-foreground">印花加工单</span>
          <span class="text-xs font-medium">${escapeHtml(printOrder.printOrderNo)}</span>
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
              <div><span class="text-muted-foreground">完成面料米数：</span>${printNode?.outputQty ?? 0} ${escapeHtml(getQtyUnitLabel(printOrder.qtyUnit))}</div>
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
              <div><span class="text-muted-foreground">原料使用：</span>${transferNode?.usedMaterialQty ?? 0} ${escapeHtml(getQtyUnitLabel(printOrder.qtyUnit))}</div>
              <div><span class="text-muted-foreground">实际完成：</span>${transferNode?.actualCompletedQty ?? 0} ${escapeHtml(getQtyUnitLabel(printOrder.qtyUnit))}</div>
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
              <div><span class="text-muted-foreground">交出单：</span>${escapeHtml(handoverOrder?.handoverOrderNo || printOrder.handoverOrderNo || printOrder.handoverOrderId || '未生成')}</div>
              <div><span class="text-muted-foreground">交出记录：</span>${handoverSummary.recordCount} 条</div>
              <div><span class="text-muted-foreground">待回写：</span>${handoverSummary.pendingWritebackCount} 条</div>
              <div><span class="text-muted-foreground">实收面料米数：</span>${handoverSummary.writtenBackQty} ${escapeHtml(getQtyUnitLabel(printOrder.qtyUnit))}</div>
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
              <h3 class="text-sm font-medium">审核</h3>
              ${reviewBadge}
            </div>
            <div class="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
              <div><span class="text-muted-foreground">接收方：</span>${escapeHtml(printOrder.targetTransferWarehouseName)}</div>
              <div><span class="text-muted-foreground">实收面料米数：</span>${review?.receivedQty ?? handoverSummary.writtenBackQty} ${escapeHtml(getQtyUnitLabel(printOrder.qtyUnit))}</div>
              <div><span class="text-muted-foreground">差异：</span>${review?.diffQty ?? handoverSummary.diffQty}</div>
              <div><span class="text-muted-foreground">审核状态：</span>${escapeHtml(review ? review.reviewStatus === 'PASS' ? '已完成' : review.reviewStatus === 'REJECTED' ? '已驳回' : '待审核' : '待审核')}</div>
              <div class="sm:col-span-2"><span class="text-muted-foreground">备注：</span>${escapeHtml(review?.remark || '接收方回写后进入待审核')}</div>
            </div>
          </section>
        </div>
      </div>
    </article>
  `
}

function canOperateDyeingNode(task: ProcessTask): boolean {
  return task.status !== 'NOT_STARTED' && task.status !== 'CANCELLED'
}

function renderDyeingTaskCard(
  task: TaskWithHandoverFields,
  dyeOrder: DyeWorkOrder,
  handoverOrder: PdaHandoverHead | null,
): string {
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
      : dyeOrder.status === 'HANDOVER_SUBMITTED'
        ? renderPrintingStatusBadge('已交出待回写', 'warning')
        : handoverSummary.writtenBackQty > 0
          ? renderPrintingStatusBadge('接收方已回写', 'info')
          : renderPrintingStatusBadge('未开始', 'muted')
  const reviewBadge = review
    ? review.reviewStatus === 'PASS'
      ? renderPrintingStatusBadge('已完成', 'success')
      : review.reviewStatus === 'REJECTED'
        ? renderPrintingStatusBadge('已驳回', 'danger')
        : renderPrintingStatusBadge('待审核', 'warning')
    : renderPrintingStatusBadge('待审核', 'muted')

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
          ${renderPrintingStatusBadge(getDyeWorkOrderStatusLabel(dyeOrder.status), dyeOrder.status === 'COMPLETED' ? 'success' : dyeOrder.status === 'REJECTED' ? 'danger' : dyeOrder.status === 'WAIT_HANDOVER' || dyeOrder.status === 'HANDOVER_SUBMITTED' || dyeOrder.status === 'WAIT_REVIEW' ? 'warning' : 'info')}
        </div>
      </header>

      <div class="space-y-4 p-4 text-sm">
        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
          <span class="text-xs text-muted-foreground">染色加工单</span>
          <span class="text-xs font-medium">${escapeHtml(dyeOrder.dyeOrderNo)}</span>
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
              <div><span class="text-muted-foreground">完成面料米数：</span>${dyeNode?.outputQty ?? 0} ${escapeHtml(getQtyUnitLabel(dyeOrder.qtyUnit))}</div>
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
              ${renderPrintingStatusBadge(packNode?.finishedAt ? '包装完成' : dyeOrder.status === 'WAIT_HANDOVER' || dyeOrder.status === 'HANDOVER_SUBMITTED' ? '待送货' : '按节点推进', packNode?.finishedAt ? 'success' : 'info')}
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
              <div><span class="text-muted-foreground">交出单：</span>${escapeHtml(handoverOrder?.handoverOrderNo || dyeOrder.handoverOrderNo || dyeOrder.handoverOrderId || '未生成')}</div>
              <div><span class="text-muted-foreground">交出记录：</span>${handoverSummary.recordCount} 条</div>
              <div><span class="text-muted-foreground">待回写：</span>${handoverSummary.pendingWritebackCount} 条</div>
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
                ${!handoverOrder || (dyeOrder.status !== 'WAIT_HANDOVER' && dyeOrder.status !== 'HANDOVER_SUBMITTED') ? 'disabled' : ''}
              >
                发起交出
              </button>
            </div>
          </section>

          <section class="rounded-lg border bg-background p-3">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium">审核</h3>
              ${reviewBadge}
            </div>
            <div class="mt-3 space-y-1 text-xs">
              <div><span class="text-muted-foreground">接收方：</span>${escapeHtml(dyeOrder.targetTransferWarehouseName)}</div>
              <div><span class="text-muted-foreground">实收染色面料米数：</span>${review?.receivedQty ?? handoverSummary.writtenBackQty} ${escapeHtml(getQtyUnitLabel(dyeOrder.qtyUnit))}</div>
              <div><span class="text-muted-foreground">差异：</span>${review?.diffQty ?? handoverSummary.diffQty}</div>
              <div><span class="text-muted-foreground">审核状态：</span>${escapeHtml(review ? review.reviewStatus === 'PASS' ? '已完成' : review.reviewStatus === 'REJECTED' ? '已驳回' : '待审核' : '待审核')}</div>
              <div><span class="text-muted-foreground">备注：</span>${escapeHtml(review?.remark || '接收方回写后进入待审核')}</div>
            </div>
          </section>
        </div>
      </div>
    </article>
  `
}

function resolveTaskQtyDisplayMeta(task: ProcessTask, displayProcessName = getTaskProcessDisplayName(task)): { label: string; valueText: string } {
  const unitLabel = getQtyUnitLabel(task.qtyUnit)
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
  return '上报成衣件数（件）'
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
  return query || ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
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

function getTaskPricing(task: ProcessTask): {
  unitPrice?: number
  currency: string
  unit: string
  estimatedIncome?: number
} {
  const unitPrice =
    (task as ProcessTask & { directPrice?: number; awardedPrice?: number }).directPrice ||
    (task as ProcessTask & { directPrice?: number; awardedPrice?: number }).awardedPrice ||
    task.dispatchPrice

  const currency =
    (task as ProcessTask & { currency?: string }).currency ||
    task.dispatchPriceCurrency ||
    task.standardPriceCurrency ||
    'CNY'

  const unit = getQtyUnitLabel(task.dispatchPriceUnit || task.standardPriceUnit || task.qtyUnit)
  const estimatedIncome = unitPrice != null ? unitPrice * task.qty : undefined

  return { unitPrice, currency, unit, estimatedIncome }
}

function isSpecialCraftExecutionTask(task: ProcessTask, displayProcessName = getTaskProcessDisplayName(task)): boolean {
  const stage = (task as ProcessTask & { stage?: string; processStage?: string; processCode?: string }).stage
  const processStage = (task as ProcessTask & { processStage?: string; processCode?: string }).processStage
  const processCode = (task as ProcessTask & { processCode?: string }).processCode
  return stage === 'SPECIAL'
    || processStage === 'SPECIAL'
    || processCode === 'SPECIAL_CRAFT'
    || /特殊工艺|绣花|打揽|打条|激光切|洗水|烫画|直喷|捆条/.test(displayProcessName)
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

function renderSpecialCraftExecutionPanel(task: ProcessTask, status: string, displayProcessName: string): string {
  const bindings = getSpecialCraftExecBindings(task)
  if (!isSpecialCraftExecutionTask(task, displayProcessName) && bindings.length === 0) return ''

  const summaries = bindings.map((binding) => getSpecialCraftFeiTicketScanSummary(binding.feiTicketNo))
  const ticketRows = summaries.length > 0
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
                <span data-field-label="原数量">原裁片数量：${summary.originalQty} 片</span>
                <span data-field-label="当前数量">当前裁片数量：${summary.currentQty} 片</span>
                <span>累计报废裁片数量：${summary.cumulativeScrapQty} 片</span>
                <span>累计货损裁片数量：${summary.cumulativeDamageQty} 片</span>
              </div>
            </div>
          `,
        )
        .join('')
    : '<div class="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">暂无绑定菲票</div>'

  const firstBinding = bindings[0]
  const receivedQty = firstBinding?.receivedQty || firstBinding?.currentQty || firstBinding?.openingQty || 0
  const scrapQty = Number(detailState.specialCraftScrapQty || 0)
  const damageQty = Number(detailState.specialCraftDamageQty || 0)
  const completedQty = Math.max(receivedQty - (Number.isFinite(scrapQty) ? scrapQty : 0) - (Number.isFinite(damageQty) ? damageQty : 0), 0)

  return `
    <article class="rounded-lg border bg-card">
      <header class="border-b px-4 py-3">
        <h2 class="flex items-center gap-2 text-sm font-semibold">
          <i data-lucide="scan-line" class="h-4 w-4"></i>
          特殊工艺菲票
        </h2>
      </header>
      <div class="space-y-3 p-4 text-sm" data-writeback-link="linkSpecialCraftCompletionToReturnWaitHandoverStock">
        <div class="space-y-2">${ticketRows}</div>
        ${
          status === 'IN_PROGRESS'
            ? `
                <div class="grid gap-3 sm:grid-cols-3">
                  <label class="space-y-1">
                    <span class="text-xs text-muted-foreground" data-field-label="报废数量">报废裁片数量</span>
                    <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="number" min="0" data-pda-execd-field="specialCraftScrapQty" value="${escapeHtml(detailState.specialCraftScrapQty)}" />
                  </label>
                  <label class="space-y-1">
                    <span class="text-xs text-muted-foreground" data-field-label="货损数量">货损裁片数量</span>
                    <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="number" min="0" data-pda-execd-field="specialCraftDamageQty" value="${escapeHtml(detailState.specialCraftDamageQty)}" />
                  </label>
                  <div class="rounded-md border bg-muted/20 px-3 py-2 text-xs">
                    <div class="text-muted-foreground" data-field-label="完工后数量">完工后裁片数量</div>
                    <div class="mt-1 text-sm font-semibold">${completedQty} 片</div>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    class="inline-flex h-9 items-center justify-center rounded-md border text-sm hover:bg-muted"
                    data-pda-execd-action="special-bind-fei-ticket"
                    data-task-id="${escapeHtml(task.taskId)}"
                  >
                    绑定菲票
                  </button>
                  <button
                    type="button"
                    class="inline-flex h-9 items-center justify-center rounded-md border text-sm hover:bg-muted"
                    data-pda-execd-action="special-report-difference"
                    data-task-id="${escapeHtml(task.taskId)}"
                  >
                    上报差异
                  </button>
                </div>
              `
            : status === 'DONE'
              ? `
                  <button
                    type="button"
                    class="inline-flex h-9 w-full items-center justify-center rounded-md border text-sm hover:bg-muted"
                    data-pda-execd-action="special-submit-handover"
                    data-task-id="${escapeHtml(task.taskId)}"
                  >
                    发起交出
                  </button>
                `
            : ''
        }
      </div>
    </article>
  `
}

function getPostFinishingActionLabel(actionType: PostFinishingActionType, phase: 'start' | 'finish'): string {
  if (actionType === '接收领料') return phase === 'start' ? '开始接收' : '确认接收领料'
  if (phase === 'start') {
    return actionType === '后道' ? '开始后道' : actionType === '质检' ? '开始质检' : '开始复检'
  }
  return actionType === '后道' ? '完成后道' : actionType === '质检' ? '完成质检' : '完成复检'
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
      data-post-action-type="${escapeHtml(actionType)}"
      ${disabled ? 'disabled' : ''}
    >
      ${escapeHtml(getPostFinishingActionLabel(actionType, phase))}
    </button>
  `
}

function canPostFinishingManagedFactoryOperate(order: PostFinishingWorkOrder): boolean {
  return order.isDedicatedPostFactory
}

function renderPostFinishingActionPanel(order: PostFinishingWorkOrder): string {
  const actions: string[] = []
  if (order.receiveAction.status === '待接收') {
    actions.push(renderPostFinishingActionButton(order, '接收领料', 'finish'))
  } else if (order.receiveAction.status === '接收中') {
    actions.push(renderPostFinishingActionButton(order, '接收领料', 'finish'))
  }

  if (!order.isPostDoneBySewingFactory && order.currentStatus === '待后道') {
    actions.push(renderPostFinishingActionButton(order, '后道', 'start'))
  }
  if (!order.isPostDoneBySewingFactory && order.currentStatus === '后道中') {
    actions.push(renderPostFinishingActionButton(order, '后道', 'finish'))
  }

  if (order.isPostDoneBySewingFactory) {
    actions.push('<div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">后道已由车缝厂完成，后道工厂只执行接收领料、质检、复检和交出。</div>')
  }

  if (canPostFinishingManagedFactoryOperate(order)) {
    if (order.currentStatus === '待质检') {
      actions.push(renderPostFinishingActionButton(order, '质检', 'start', order.receiveAction.status !== '已接收'))
    } else if (order.currentStatus === '质检中') {
      actions.push(renderPostFinishingActionButton(order, '质检', 'finish'))
    }

    if (order.currentStatus === '复检中') {
      actions.push(renderPostFinishingActionButton(order, '复检', 'finish'))
    } else if (order.currentStatus === '待复检') {
      actions.push(renderPostFinishingActionButton(order, '复检', 'start'))
    }
  }

  if (order.waitHandoverWarehouseRecordId || order.currentStatus === '待交出' || order.currentStatus === '复检完成') {
    actions.push(`
      <button type="button" class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted" data-pda-execd-action="post-submit-handover" data-post-order-id="${escapeHtml(order.postOrderId)}">
        发起交出
      </button>
    `)
  }

  if (actions.length === 0) {
    return '<div class="rounded-md border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">当前没有可执行动作</div>'
  }

  return `<div class="grid gap-2">${actions.join('')}</div>`
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
            <span class="font-mono text-sm font-semibold">${escapeHtml(order.postOrderNo)}</span>
            <span class="inline-flex rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">${escapeHtml(order.currentStatus)}</span>
          </div>
        </header>
        <div class="grid gap-3 p-4 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span class="text-muted-foreground">生产单</span>
            <span class="font-medium">${escapeHtml(order.sourceProductionOrderNo)}</span>
            <span class="text-muted-foreground">来源任务</span>
            <span class="font-medium">${escapeHtml(order.sourceTaskNo)}</span>
            <span class="text-muted-foreground">来源车缝任务</span>
            <span class="font-medium">${escapeHtml(order.sourceSewingTaskNo)}</span>
            <span class="text-muted-foreground">当前工厂</span>
            <span>${escapeHtml(order.currentFactoryName)}</span>
            <span class="text-muted-foreground">后道工厂</span>
            <span>${escapeHtml(order.managedPostFactoryName)}</span>
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
          <h2 class="text-sm font-semibold">接收领料、质检、后道、复检记录</h2>
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
    </div>
  `
  void execId
  return renderPdaFrame(content, 'exec')
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
            <span class="font-mono text-sm font-semibold">${escapeHtml(task.postTaskNo)}</span>
            <span class="inline-flex rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">${escapeHtml(task.status)}</span>
          </div>
        </header>
        <div class="grid gap-3 p-4 text-xs">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <span class="text-muted-foreground">车缝任务号</span>
            <span class="font-medium">${escapeHtml(task.sewingTaskNo)}</span>
            <span class="text-muted-foreground">生产单</span>
            <span>${escapeHtml(task.productionOrderNo)}</span>
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
            <span>${escapeHtml(task.relatedPostOrderNo)}</span>
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
  return renderPdaFrame(content, 'exec')
}

export function renderPdaExecDetailPage(taskId: string): string {
  syncPdaStartRiskAndExceptions()
  syncMilestoneOverdueExceptions()

  const task = getTaskFactById(taskId)

  if (task && isCuttingSpecialTask(task)) {
    return renderPdaCuttingTaskDetailPage(taskId, { backHref: '/fcs/pda/exec' })
  }

  if (task?.processCode === 'SEWING_POST') {
    const sewingPostTask = getSewingFactoryPostTaskById(task.taskId)
    if (sewingPostTask) {
      return renderPdaSewingPostTaskPage(taskId, sewingPostTask)
    }
  }

  if (!task) {
    const sewingPostTask = getSewingFactoryPostTaskById(taskId)
    if (sewingPostTask) {
      return renderPdaSewingPostTaskPage(taskId, sewingPostTask)
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

    return renderPdaFrame(content, 'exec')
  }

  syncDialogStateWithQuery(task)

  const status = task.status || 'NOT_STARTED'
  const prereq = getStartPrerequisite(task)
  const deadline = getDeadlineStatus(
    (task as ProcessTask & { taskDeadline?: string }).taskDeadline,
    task.finishedAt,
  )

  const canStart = status === 'NOT_STARTED' && prereq.met
  const canFinish = status === 'IN_PROGRESS'
  const startDueInfo = getTaskStartDueInfo(task)
  const milestone = getTaskMilestoneState(task)
  const pauseHandleStatus = getPauseHandleStatus(task)
  const startDueAt = startDueInfo.startDueAt || '—'
  const startSourceText = formatStartDueSourceText(startDueInfo.startDueSource)
  const milestoneProofTitle =
    milestone.proofRequirement === 'NONE'
      ? '关键节点凭证（当前配置：不要求凭证）'
      : `关键节点凭证（当前配置：${milestone.proofRequirementLabel}）`
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
    ? indonesiaFactories.find((factory) => factory.id === task.assignedFactoryId)
    : undefined
  const pauseReasonLabel = (task as ProcessTask & { pauseReasonLabel?: string | null }).pauseReasonLabel || ''
  const pauseReportedAt = (task as ProcessTask & { pauseReportedAt?: string | null }).pauseReportedAt || ''
  const displayProcessName = getTaskProcessDisplayName(task)
  const qtyDisplayMeta = resolveTaskQtyDisplayMeta(task, displayProcessName)
  const handoverOrder = getTaskHandoverOrder(task as TaskWithHandoverFields)
  const printWorkOrder = getPrintWorkOrderByTaskId(task.taskId)
  const dyeWorkOrder = getDyeWorkOrderByTaskId(task.taskId)
  const taskQrValue = getTaskQrValue(task as TaskWithHandoverFields)
  const receiverDisplayText = getReceiverDisplayText(task as TaskWithHandoverFields)

  const pricing = getTaskPricing(task)
  const specialCraftExecutionPanel = renderSpecialCraftExecutionPanel(task, status, displayProcessName)

  const content = `
    <div class="space-y-4 bg-background p-4 pb-6">
      <div class="flex items-center gap-2">
        <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-pda-execd-action="back">
          <i data-lucide="arrow-left" class="mr-1 h-4 w-4"></i>
          返回
        </button>
        <h1 class="text-base font-semibold">任务详情</h1>
      </div>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <div class="flex items-center justify-between gap-2 text-sm">
            <span class="font-mono font-semibold">${escapeHtml(getTaskDisplayNo(task))}</span>
            <span class="inline-flex items-center rounded px-2 py-0.5 text-xs ${statusColorMap[status] ?? 'bg-muted text-muted-foreground'}">${escapeHtml(statusLabelMap[status] ?? status)}</span>
          </div>
        </header>

        <div class="space-y-3 p-4 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <span class="text-xs text-muted-foreground">生产单号</span>
            <span class="text-xs font-medium">${escapeHtml(task.productionOrderId)}</span>
            <span class="text-xs text-muted-foreground">原始任务</span>
            <span class="text-xs font-medium">${escapeHtml(getRootTaskDisplayNo(task))}</span>
            <span class="text-xs text-muted-foreground">当前工序</span>
            <span class="text-xs font-medium">${escapeHtml(displayProcessName)}</span>
            <span class="text-xs text-muted-foreground">${escapeHtml(qtyDisplayMeta.label)}</span>
            <span class="text-xs font-medium">${escapeHtml(qtyDisplayMeta.valueText)}</span>
            ${
              assignedFactory
                ? `
                    <span class="text-xs text-muted-foreground">当前工厂</span>
                    <span class="text-xs font-medium">${escapeHtml(assignedFactory.name)}</span>
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
      ${printWorkOrder ? renderPrintingTaskCard(task as TaskWithHandoverFields, printWorkOrder, handoverOrder) : ''}
      ${dyeWorkOrder ? renderDyeingTaskCard(task as TaskWithHandoverFields, dyeWorkOrder, handoverOrder) : ''}
      ${specialCraftExecutionPanel}

      ${
        milestone.required
          ? `
              <article class="rounded-lg border bg-card">
                <header class="border-b px-4 py-3">
                  <h2 class="flex items-center gap-2 text-sm font-semibold">
                    <i data-lucide="flag" class="h-4 w-4"></i>
                    关键节点上报
                  </h2>
                </header>
                <div class="space-y-3 p-4 text-sm">
                  <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span class="text-xs text-muted-foreground">规则名称</span>
                    <span class="text-xs font-medium">${escapeHtml(milestone.ruleLabel)}</span>
                    <span class="text-xs text-muted-foreground">当前状态</span>
                    <span class="text-xs font-medium ${milestone.status === 'REPORTED' ? 'text-green-700' : 'text-amber-700'}">${milestone.status === 'REPORTED' ? '已上报' : '待上报'}</span>
                    <span class="text-xs text-muted-foreground">${escapeHtml(getReportedQtyLabel(milestone.targetUnitLabel))}</span>
                    <span class="text-xs">${escapeHtml(String(milestone.status === 'REPORTED' ? (milestone.reportedQty ?? milestone.targetQty) : milestone.targetQty))} ${escapeHtml(milestone.targetUnitLabel)}</span>
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
                              <p class="mt-2 text-xs text-muted-foreground">上报数量按规则固定为 ${milestone.targetQty} ${escapeHtml(milestone.targetUnitLabel)}</p>
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
              </article>
            `
          : ''
      }

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <i data-lucide="pause-circle" class="h-4 w-4"></i>
            上报暂停
          </h2>
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
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <i data-lucide="shield-check" class="h-4 w-4"></i>
            执行前置信息
          </h2>
        </header>

        <div class="space-y-3 p-4 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <span class="text-xs text-muted-foreground">前置条件</span>
            <span class="text-xs font-medium">${escapeHtml(prereq.conditionLabel)}</span>
            <span class="text-xs text-muted-foreground">当前状态</span>
            <span class="text-xs font-medium ${prereq.met ? 'text-green-700' : 'text-amber-700'}">${escapeHtml(prereq.statusLabel)}</span>
            <span class="text-xs text-muted-foreground">来源方</span>
            <span class="text-xs">领料记录</span>
          </div>

          <div class="rounded-md border px-3 py-2.5 text-xs ${
            prereq.met
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }">
            ${
              prereq.met
                ? '<div class="flex items-center gap-1.5 font-medium"><i data-lucide="check-circle" class="h-3.5 w-3.5"></i>已满足开工条件</div>'
                : `<div class="flex items-center gap-1.5 font-medium"><i data-lucide="alert-triangle" class="h-3.5 w-3.5"></i>${escapeHtml(prereq.blocker)}</div><p class="mt-1 pl-5 text-amber-600">${escapeHtml(prereq.hint)}</p>`
            }
          </div>

          ${
            !prereq.met
              ? `
                  <button class="inline-flex h-8 w-full items-center justify-center rounded-md border border-amber-300 text-sm text-amber-700 hover:bg-amber-50" data-pda-execd-action="go-handover" data-tab="pickup">
                    <i data-lucide="arrow-left-right" class="mr-2 h-3.5 w-3.5"></i>
                    去领料
                  </button>
                `
              : ''
          }
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <i data-lucide="clock" class="h-4 w-4"></i>
            开工信息
          </h2>
        </header>

        <div class="space-y-3 p-4 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <span class="text-xs text-muted-foreground">当前状态</span>
            <span class="inline-flex w-fit items-center rounded px-2 py-0.5 text-xs ${statusColorMap[status] ?? 'bg-muted text-muted-foreground'}">${escapeHtml(statusLabelMap[status] ?? status)}</span>
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
                    <div class="border-b px-3 py-2 text-sm font-medium">开工凭证（选填）</div>
                    <div class="p-3">
                      ${renderProofUploadSection(detailState.startProofFiles, 'start', '可上传开工现场、物料到位、设备状态等证明材料，当前为选填')}
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
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <i data-lucide="coins" class="h-4 w-4"></i>
            金额情况
          </h2>
        </header>

        <div class="p-4 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <span class="text-xs text-muted-foreground">任务单价</span>
            <span class="text-xs font-medium">${
              pricing.unitPrice != null
                ? `${pricing.unitPrice.toLocaleString()} ${escapeHtml(pricing.currency)} / ${escapeHtml(pricing.unit)}`
                : '—'
            }</span>
            <span class="text-xs text-muted-foreground">预计收入</span>
            <span class="text-xs font-medium">${
              pricing.estimatedIncome != null
                ? `${pricing.estimatedIncome.toLocaleString()} ${escapeHtml(pricing.currency)}`
                : '—'
            }</span>
            <span class="text-xs text-muted-foreground">扣款状态</span>
            <span class="text-xs text-muted-foreground">暂无扣款记录</span>
            <span class="text-xs text-muted-foreground">结算状态</span>
            <span class="text-xs text-muted-foreground">待结算</span>
          </div>
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">操作</h2>
        </header>

        <div class="space-y-2 p-4">
          ${
            status === 'NOT_STARTED'
              ? prereq.met
                ? `
                    <button
                      class="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      data-pda-execd-action="confirm-start"
                      data-task-id="${escapeHtml(task.taskId)}"
                      ${canStart ? '' : 'disabled'}
                    >
                      <i data-lucide="play" class="mr-2 h-4 w-4"></i>
                      开工
                    </button>
                  `
                : `
                    <button class="inline-flex h-9 w-full items-center justify-center rounded-md border border-amber-300 text-sm text-amber-700 hover:bg-amber-50" data-pda-execd-action="go-handover" data-tab="pickup">
                      <i data-lucide="arrow-left-right" class="mr-2 h-4 w-4"></i>
                      去领料（有领料记录后即可开工）
                    </button>
                  `
              : ''
          }

          ${
            status === 'IN_PROGRESS'
              ? `
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      class="inline-flex h-9 items-center justify-center rounded-md border text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                      data-pda-execd-action="report-pause-entry"
                    >
                      <i data-lucide="alert-triangle" class="mr-2 h-4 w-4"></i>
                      上报暂停
                    </button>
                    ${
                      printWorkOrder || dyeWorkOrder
                        ? `
                            <button
                              class="inline-flex h-9 items-center justify-center rounded-md border text-sm text-muted-foreground"
                              disabled
                            >
                              ${printWorkOrder ? '印花加工单审核通过后完成' : '染色加工单审核通过后完成'}
                            </button>
                          `
                        : `
                            <button
                              class="inline-flex h-9 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                              data-pda-execd-action="finish-task"
                              data-task-id="${escapeHtml(task.taskId)}"
                              ${canFinish ? '' : 'disabled'}
                            >
                              <i data-lucide="check-circle" class="mr-2 h-4 w-4"></i>
                              完工
                            </button>
                          `
                    }
                  </div>
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
            status === 'BLOCKED'
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
            status === 'DONE'
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

  return renderPdaFrame(content, 'exec')
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
    appStore.navigate('/fcs/pda/exec')
    return true
  }

  if (action === 'go-handover') {
    const tab = actionNode.dataset.tab || 'pickup'
    appStore.navigate(`/fcs/pda/handover?tab=${tab}`)
    return true
  }

  if (action === 'print-submit-handover' || action === 'dye-submit-handover') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) {
      showPdaExecDetailToast('任务未关联')
      return true
    }
    const defaultQty =
      action === 'print-submit-handover'
        ? getPrintWorkOrderByTaskId(taskId)?.actualCompletedQty || getPrintWorkOrderByTaskId(taskId)?.plannedQty || 0
        : getDyeWorkOrderByTaskId(taskId)?.plannedQty || 0
    const qtyText = window.prompt('请输入交出面料米数', String(defaultQty || ''))?.trim() || ''
    const submittedQty = Number(qtyText)
    if (!Number.isFinite(submittedQty) || submittedQty <= 0) {
      showPdaExecDetailToast('请填写有效交出面料米数')
      return true
    }
    try {
      if (action === 'print-submit-handover') {
        submitPrintHandover(taskId, { submittedQty, operatorName: '印花工厂', remark: '移动端发起交出' })
      } else {
        submitDyeHandover(taskId, { submittedQty, operatorName: '染色工厂', remark: '移动端发起交出' })
      }
      showPdaExecDetailToast('交出记录已生成，Web 端送货交出和审核记录已同步')
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
        startPrintNode(printOrder.taskId, 'COLOR_TEST', { operatorName: '印花工厂' })
        showPdaExecDetailToast('花型测试已开始')
        return true
      }

      if (action === 'print-complete-color-test') {
        const passed = window.confirm('花型测试是否通过？')
        const remark = window.prompt('请填写结果说明（可选）') || undefined
        finishPrintNode(printOrder.taskId, 'COLOR_TEST', { passed, operatorName: '印花工厂', remark })
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
        startPrintNode(printOrder.taskId, 'PRINT', { printerNo, operatorName: '印花工厂' })
        showPdaExecDetailToast('打印开始已记录')
        return true
      }

      if (action === 'print-complete-printing') {
        const outputQtyText = window.prompt('请输入完成面料米数', String(printOrder.plannedQty))?.trim() || ''
        const wasteQtyText = window.prompt('请输入损耗面料米数（可选）', '0')?.trim() || '0'
        finishPrintNode(printOrder.taskId, 'PRINT', {
          outputQty: Number(outputQtyText),
          wasteQty: Number(wasteQtyText),
          operatorName: '印花工厂',
        })
        showPdaExecDetailToast('打印完成已记录')
        return true
      }

      if (action === 'print-start-transfer') {
        startPrintNode(printOrder.taskId, 'TRANSFER', { operatorName: '印花工厂' })
        showPdaExecDetailToast('转印开始已记录')
        return true
      }

      const usedMaterialQtyText = window.prompt('请输入实际使用原料面料米数', String(printOrder.plannedQty))?.trim() || ''
      const actualCompletedQtyText = window.prompt('请输入转印完成面料米数', String(printOrder.plannedQty))?.trim() || ''
      finishPrintNode(printOrder.taskId, 'TRANSFER', {
        usedMaterialQty: Number(usedMaterialQtyText),
        actualCompletedQty: Number(actualCompletedQtyText),
        operatorName: '印花工厂',
      })
      showPdaExecDetailToast('转印完成，已进入待送货')
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
        finishDyeSampleWaitWriteback(dyeOrder.taskId, { operatorName: '染色工厂' })
        showPdaExecDetailToast('等样衣/色样已完成')
        return true
      }

      if (action === 'dye-start-material-wait') {
        startDyeMaterialWaitWriteback(dyeOrder.taskId, { operatorName: '染色工厂' })
        showPdaExecDetailToast('等原料已开始')
        return true
      }

      if (action === 'dye-complete-material-wait') {
        finishDyeMaterialWaitWriteback(dyeOrder.taskId, { operatorName: '染色工厂' })
        showPdaExecDetailToast('等原料已完成')
        return true
      }

      if (action === 'dye-start-sample-test') {
        startDyeNode(dyeOrder.taskId, 'SAMPLE', { operatorName: '染色工厂' })
        showPdaExecDetailToast('打样开始已记录')
        return true
      }

      if (action === 'dye-complete-sample-test') {
        const colorNo = window.prompt('请输入色号', dyeOrder.colorNo || '')?.trim() || ''
        if (!colorNo) {
          showPdaExecDetailToast('请填写色号')
          return true
        }
        finishDyeNode(dyeOrder.taskId, 'SAMPLE', { colorNo, operatorName: '染色工厂' })
        showPdaExecDetailToast('打样完成已记录')
        return true
      }

      if (action === 'dye-start-material-ready') {
        startDyeNode(dyeOrder.taskId, 'MATERIAL_READY', { operatorName: '染色工厂' })
        showPdaExecDetailToast('备料开始已记录')
        return true
      }

      if (action === 'dye-complete-material-ready') {
        const outputQtyText = window.prompt('请输入备料面料米数（可选）', String(dyeOrder.plannedQty))?.trim() || ''
        finishDyeNode(dyeOrder.taskId, 'MATERIAL_READY', {
          outputQty: outputQtyText ? Number(outputQtyText) : undefined,
          operatorName: '染色工厂',
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
        startDyeNode(dyeOrder.taskId, 'VAT_PLAN', { dyeVatNo, operatorName: '染色工厂' })
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
        startDyeNode(dyeOrder.taskId, 'DYE', { dyeVatNo, operatorName: '染色工厂' })
        showPdaExecDetailToast('染色开始已记录')
        return true
      }

      if (action === 'dye-complete-dye') {
        const inputQtyText = window.prompt('请输入投入面料米数（可选）', String(dyeOrder.plannedQty))?.trim() || ''
        const outputQtyText = window.prompt('请输入完成面料米数（可选）', String(dyeOrder.plannedQty))?.trim() || ''
        finishDyeNode(dyeOrder.taskId, 'DYE', {
          inputQty: inputQtyText ? Number(inputQtyText) : undefined,
          outputQty: outputQtyText ? Number(outputQtyText) : undefined,
          operatorName: '染色工厂',
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
        startDyeNode(dyeOrder.taskId, nodeCode, { operatorName: '染色工厂' })
        showPdaExecDetailToast(`${nodeLabelMap[nodeCode]}开始已记录`)
        return true
      }

      const outputQtyText = window.prompt(`请输入完成面料米数（${nodeLabelMap[nodeCode]}）`, String(dyeOrder.plannedQty))?.trim() || ''
      finishDyeNode(dyeOrder.taskId, nodeCode, {
        outputQty: outputQtyText ? Number(outputQtyText) : undefined,
        operatorName: '染色工厂',
      })
      showPdaExecDetailToast(nodeCode === 'PACK' ? '包装完成，已进入待送货' : `${nodeLabelMap[nodeCode]}完成已记录`)
      return true
    } catch (error) {
      showPdaExecDetailToast(error instanceof Error ? error.message : '保存失败')
      return true
    }
  }

  if (action === 'special-bind-fei-ticket' || action === 'special-report-difference' || action === 'special-submit-handover') {
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
        let scrapQty = Number(detailState.specialCraftScrapQty || 0)
        let damageQty = Number(detailState.specialCraftDamageQty || 0)
        if (scrapQty + damageQty <= 0) {
          const diffQtyText = window.prompt('请输入差异裁片数量', '1')?.trim() || ''
          scrapQty = Number(diffQtyText || 0)
          damageQty = 0
        }
        if (!Number.isFinite(scrapQty) || !Number.isFinite(damageQty) || scrapQty + damageQty <= 0) {
          showPdaExecDetailToast('请填写有效差异裁片数量')
          return true
        }
        reportSpecialCraftDifference(taskId, {
          scrapQty,
          damageQty,
          operatorName: '现场操作员',
          reason: '移动端上报差异',
          operatedAt: nowTimestamp(),
        })
        showPdaExecDetailToast('差异已上报，菲票数量和 Web 端差异记录已同步')
        return true
      }

      submitSpecialCraftHandover(taskId, { operatorName: '现场操作员', operatedAt: nowTimestamp(), remark: '移动端发起交出' })
      showPdaExecDetailToast('特殊工艺交出记录已同步')
      return true
    } catch (error) {
      showPdaExecDetailToast(error instanceof Error ? error.message : '特殊工艺写回失败')
      return true
    }
  }

  if (
    action === 'post-start-action'
    || action === 'post-finish-action'
    || action === 'post-transfer-managed'
    || action === 'post-receive-managed'
    || action === 'post-create-handover'
    || action === 'post-submit-handover'
  ) {
    const postOrderId = actionNode.dataset.postOrderId
    const actionType = actionNode.dataset.postActionType as PostFinishingActionType | undefined
    if (!postOrderId) return true

    try {
      if (action === 'post-transfer-managed') {
        transferPostFinishedGarmentsToManagedPostFactory(postOrderId, { operatorName: '移动端操作员', operatedAt: nowTimestamp() })
        showPdaExecDetailToast('已交给后道工厂，Web 后道待加工仓已同步')
        return true
      }

      if (action === 'post-receive-managed') {
        receivePostFinishedGarmentsAtManagedPostFactory(postOrderId, { operatorName: '后道工厂', operatedAt: nowTimestamp() })
        showPdaExecDetailToast('后道工厂已接收，可继续质检和复检')
        return true
      }

      if (action === 'post-create-handover') {
        createPostFinishingHandoverWarehouseRecord(postOrderId, { operatorName: '后道工厂', operatedAt: nowTimestamp() })
        showPdaExecDetailToast('后道交出仓记录已生成')
        return true
      }

      if (action === 'post-submit-handover') {
        const qtyText = window.prompt('请输入交出成衣件数', '0')?.trim() || ''
        const submittedQty = Number(qtyText)
        if (!Number.isFinite(submittedQty) || submittedQty <= 0) {
          showPdaExecDetailToast('请填写有效交出成衣件数')
          return true
        }
        submitPostFinishingHandover(postOrderId, { submittedGarmentQty: submittedQty, operatorName: '后道工厂', operatedAt: nowTimestamp() })
        showPdaExecDetailToast('后道交出已提交，Web 后道交出仓已同步')
        return true
      }

      if (!actionType) return true

      if (action === 'post-start-action') {
        startPostFinishingAction(postOrderId, actionType, { operatorName: '移动端操作员', operatedAt: nowTimestamp() })
        showPdaExecDetailToast(`${getPostFinishingActionLabel(actionType, 'start')}已记录`)
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
      finishPostFinishingAction(postOrderId, actionType, {
        submittedGarmentQty: submittedQty,
        acceptedGarmentQty: acceptedQty,
        rejectedGarmentQty: Number.isFinite(rejectedQty) ? rejectedQty : 0,
        operatorName: '移动端操作员',
        operatedAt: nowTimestamp(),
      })
      showPdaExecDetailToast(`${getPostFinishingActionLabel(actionType, 'finish')}已写回 Web`)
      return true
    } catch (error) {
      showPdaExecDetailToast(error instanceof Error ? error.message : '后道写回失败')
      return true
    }
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
      showPdaExecDetailToast('已交给后道工厂，后道工厂将接收领料后质检和复检')
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

  if (action === 'confirm-start') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    const task = getTaskFactById(taskId)
    if (!task) return true

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

    const headcount = undefined

    mutateStartTask(taskId, 'PDA', {
      startTime,
      headcount,
      proofFiles: detailState.startProofFiles,
    })
    if (isSpecialCraftExecutionTask(task, getTaskProcessDisplayName(task))) {
      try {
        startSpecialCraftTask(taskId, { operatorName: '现场操作员', operatedAt: startTime })
      } catch {
        // 开工主链已成功，特殊工艺回写失败时保持原有移动端提示逻辑。
      }
    }
    let startToast = '开工成功'
    try {
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
    showPdaExecDetailToast('请在“上报暂停”区块补充信息后提交')
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

    if (!isTaskMilestoneReported(task)) {
      showPdaExecDetailToast('请先完成关键节点上报')
      return true
    }

    const displayProcessName = getTaskProcessDisplayName(task)
    const specialCraftBindings = getSpecialCraftExecBindings(task)
    if (isSpecialCraftExecutionTask(task, displayProcessName) && specialCraftBindings.length > 0) {
      const scrapQty = Number(detailState.specialCraftScrapQty || 0)
      const damageQty = Number(detailState.specialCraftDamageQty || 0)
      if (!Number.isFinite(scrapQty) || scrapQty < 0 || !Number.isFinite(damageQty) || damageQty < 0) {
        showPdaExecDetailToast('请填写有效报废和货损数量')
        return true
      }
      finishSpecialCraftTask(taskId, {
        scrapQty,
        damageQty,
        operatorName: '现场操作员',
        operatedAt: nowTimestamp(),
      })
      detailState.specialCraftScrapQty = '0'
      detailState.specialCraftDamageQty = '0'
    }

    mutateFinishTask(taskId, 'PDA')
    showPdaExecDetailToast('完工成功')
    return true
  }

  return false
}
