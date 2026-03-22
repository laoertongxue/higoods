import {
  state,
  BLOCK_REASON_LABEL,
  nowTimestamp,
  getTaskById,
  getFactoryById,
  getTaskTenderId,
  getTenderById,
  listBoardTasks,
  getUnifiedCategoryFromReason,
  getDefaultSubCategoryKeyFromReason,
  generateCaseId,
  generateNotificationId,
  generateUrgeId,
  listProgressExceptions,
  upsertProgressExceptionCase,
  initialNotifications,
  initialUrges,
  getOrderById,
  appStore,
  type BlockReason,
  type ExceptionCategory,
  type PoLifecycle,
  type ProcessTask,
  type TaskAuditLog,
  type TaskStatus,
  type ProductionOrder,
  type Notification,
  type ExceptionCase,
  type ReasonCode,
  type Severity,
  type UrgeLog,
  type UrgeType,
} from './context'

function getExceptionsByTaskId(taskId: string): ExceptionCase[] {
  return listProgressExceptions().filter((item) => item.relatedTaskIds.includes(taskId))
}

function nextUrgeAuditLogId(urgeId: string, index: number): string {
  return `UAL-${urgeId}-${String(index).padStart(3, '0')}`
}

function nextExceptionAuditLogId(exception: ExceptionCase): string {
  return `EAL-${exception.caseId}-${String(exception.auditLogs.length + 1).padStart(3, '0')}`
}

function nextTaskAuditLogId(task: ProcessTask): string {
  return `AL-${task.taskId}-${String(task.auditLogs.length + 1).padStart(3, '0')}`
}

function nextOrderAuditLogId(order: ProductionOrder): string {
  return `AL-ORDER-${order.productionOrderId}-${String(order.auditLogs.length + 1).padStart(3, '0')}`
}

function createNotification(payload: Omit<Notification, 'notificationId' | 'createdAt'>): Notification {
  const notification: Notification = {
    ...payload,
    notificationId: generateNotificationId(),
    createdAt: nowTimestamp(),
  }

  initialNotifications.push(notification)
  return notification
}

function createUrge(payload: Omit<UrgeLog, 'urgeId' | 'createdAt' | 'status' | 'auditLogs'>): UrgeLog {
  const createdAt = nowTimestamp()
  const urgeId = generateUrgeId()

  const urge: UrgeLog = {
    ...payload,
    urgeId,
    createdAt,
    status: 'SENT',
    auditLogs: [
      {
        id: nextUrgeAuditLogId(urgeId, 1),
        action: 'SEND',
        detail: '发送催办',
        at: createdAt,
        by: payload.fromName,
      },
    ],
  }

  initialUrges.push(urge)

  const urgeTypeLabel: Record<UrgeType, string> = {
    URGE_ASSIGN_ACK: '催确认接单',
    URGE_START: '催开工',
    URGE_FINISH: '催完工',
    URGE_UNBLOCK: '催尽快处理',
    URGE_TENDER_BID: '催报价',
    URGE_TENDER_AWARD: '催定标',
    URGE_HANDOVER_CONFIRM: '催交接确认',
    URGE_HANDOVER_EVIDENCE: '催补证据/处理差异',
    URGE_CASE_HANDLE: '去处理异常',
  }

  createNotification({
    level: 'INFO',
    title: '收到催办',
    content: `${payload.fromName}：${urgeTypeLabel[payload.urgeType]} - ${payload.message}`,
    recipientType: payload.toType,
    recipientId: payload.toId,
    recipientName: payload.toName,
    targetType: payload.targetType,
    targetId: payload.targetId,
    related: {},
    deepLink: payload.deepLink,
    createdBy: payload.fromId,
  })

  return urge
}

function createOrUpdateExceptionFromSignal(signal: {
  sourceType: 'TASK' | 'ORDER' | 'TENDER'
  sourceId: string
  reasonCode: ReasonCode
  detail?: string
}): ExceptionCase {
  const now = nowTimestamp()
  const unifiedCategory = getUnifiedCategoryFromReason(signal.reasonCode)
  const subCategoryKey = getDefaultSubCategoryKeyFromReason(signal.reasonCode) || 'EXEC_BLOCK_OTHER'

  const existed = listProgressExceptions().find(
    (item) =>
      item.sourceType === signal.sourceType &&
      item.sourceId === signal.sourceId &&
      item.reasonCode === signal.reasonCode &&
      item.caseStatus !== 'CLOSED',
  )

  if (existed) {
    existed.updatedAt = now
    existed.detail = signal.detail || existed.detail
    if (!existed.unifiedCategory) existed.unifiedCategory = unifiedCategory
    if (!existed.subCategoryKey) existed.subCategoryKey = subCategoryKey
    existed.auditLogs = [
      ...existed.auditLogs,
      {
        id: nextExceptionAuditLogId(existed),
        action: 'UPDATE',
        detail: '信号重新触发，更新异常',
        at: now,
        by: '系统',
      },
    ]
    upsertProgressExceptionCase(existed)
    return existed
  }

  const s1Reasons: ReasonCode[] = ['TENDER_OVERDUE', 'NO_BID', 'FACTORY_BLACKLISTED', 'HANDOVER_DIFF']
  const s2Reasons: ReasonCode[] = [
    'DISPATCH_REJECTED',
    'ACK_TIMEOUT',
    'TENDER_NEAR_DEADLINE',
    'TECH_PACK_NOT_RELEASED',
    'MATERIAL_NOT_READY',
    'START_OVERDUE',
    'MILESTONE_NOT_REPORTED',
  ]

  let severity: Severity = 'S3'
  if (s1Reasons.includes(signal.reasonCode)) {
    severity = 'S1'
  } else if (s2Reasons.includes(signal.reasonCode) || signal.reasonCode.startsWith('BLOCKED_')) {
    severity = 'S2'
  }

  let category: ExceptionCategory = 'EXECUTION'
  if (unifiedCategory === 'ASSIGNMENT') category = 'ASSIGNMENT'
  if (unifiedCategory === 'EXECUTION') category = 'EXECUTION'
  if (unifiedCategory === 'TECH_PACK') category = 'TECH_PACK'
  if (unifiedCategory === 'MATERIAL') category = 'MATERIAL'
  if (unifiedCategory === 'HANDOUT') category = 'HANDOVER'

  let relatedOrderIds: string[] = []
  let relatedTaskIds: string[] = []
  let relatedTenderIds: string[] = []

  if (signal.sourceType === 'TASK') {
    const task = getTaskById(signal.sourceId)
    relatedTaskIds = [signal.sourceId]
    if (task) {
      relatedOrderIds = [task.productionOrderId]
      const tenderId = getTaskTenderId(task)
      if (tenderId) relatedTenderIds = [tenderId]
    }
  } else if (signal.sourceType === 'ORDER') {
    relatedOrderIds = [signal.sourceId]
    relatedTaskIds = listBoardTasks().filter((task) => task.productionOrderId === signal.sourceId).map((task) => task.taskId)
  } else {
    const tender = getTenderById(signal.sourceId)
    relatedTenderIds = [signal.sourceId]
    if (tender) {
      relatedOrderIds = tender.productionOrderIds
      relatedTaskIds = tender.taskIds
    }
  }

  const reasonSummary: Record<ReasonCode, string> = {
    BLOCKED_MATERIAL: '物料待处理',
    BLOCKED_CAPACITY: '产能待处理',
    BLOCKED_QUALITY: '质量处理',
    BLOCKED_TECH: '工艺资料生产暂停',
    BLOCKED_EQUIPMENT: '设备待处理',
    BLOCKED_OTHER: '其他待处理',
    TENDER_OVERDUE: '竞价已逾期',
    TENDER_NEAR_DEADLINE: '竞价即将截止',
    NO_BID: '竞价无人报价',
    PRICE_ABNORMAL: '报价异常',
    DISPATCH_REJECTED: '派单被拒',
    ACK_TIMEOUT: '派单确认超时',
    TECH_PACK_NOT_RELEASED: '技术包未发布',
    FACTORY_BLACKLISTED: '工厂黑名单',
    HANDOVER_DIFF: '交接差异',
    MATERIAL_NOT_READY: '物料未齐套',
    START_OVERDUE: '开工逾期',
    MILESTONE_NOT_REPORTED: '关键节点未上报',
  }

  const exception: ExceptionCase = {
    caseId: generateCaseId(),
    caseStatus: 'OPEN',
    severity,
    category,
    unifiedCategory,
    subCategoryKey,
    reasonCode: signal.reasonCode,
    sourceType: signal.sourceType,
    sourceId: signal.sourceId,
    relatedOrderIds,
    relatedTaskIds,
    relatedTenderIds,
    summary: reasonSummary[signal.reasonCode] ?? signal.reasonCode,
    detail: signal.detail ?? `${signal.sourceType} ${signal.sourceId} 触发异常：${reasonSummary[signal.reasonCode] ?? signal.reasonCode}`,
    createdAt: now,
    updatedAt: now,
    tags: [],
    actions: [],
    auditLogs: [
      {
        id: `EAL-${exception.caseId}-001`,
        action: 'CREATE',
        detail: '系统自动生成异常单',
        at: now,
        by: '系统',
      },
    ],
  }

  upsertProgressExceptionCase(exception)
  return exception
}

function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  blockReason?: BlockReason,
  blockRemark?: string,
  by: string = 'Admin',
): void {
  const task = getTaskById(taskId)
  if (!task) return
  const now = nowTimestamp()

  const actionMap: Record<TaskStatus, string> = {
    NOT_STARTED: 'RESET',
    IN_PROGRESS: task.status === 'BLOCKED' ? 'UNBLOCK' : 'START',
    DONE: 'FINISH',
    BLOCKED: 'BLOCK',
    CANCELLED: 'CANCEL',
  }

  const detailMap: Record<TaskStatus, string> = {
    NOT_STARTED: '重置为未开始',
    IN_PROGRESS: task.status === 'BLOCKED' ? '恢复执行，状态改为进行中' : '标记开始',
    DONE: '标记完工',
    BLOCKED: `标记生产暂停，原因：${blockReason ?? 'OTHER'}${blockRemark ? `，备注：${blockRemark}` : ''}`,
    CANCELLED: '取消任务',
  }

  const auditLog: TaskAuditLog = {
    id: nextTaskAuditLogId(task),
    action: actionMap[newStatus],
    detail: detailMap[newStatus],
    at: now,
    by,
  }

  const updatedTask: ProcessTask = {
    ...task,
    status: newStatus,
    updatedAt: now,
    auditLogs: [...task.auditLogs, auditLog],
    ...(newStatus === 'IN_PROGRESS' && !task.startedAt ? { startedAt: now } : {}),
    ...(newStatus === 'DONE' ? { finishedAt: now } : {}),
    ...(newStatus === 'BLOCKED' ? { blockReason, blockRemark, blockedAt: now } : {}),
    ...(newStatus !== 'BLOCKED' ? { blockReason: undefined, blockRemark: undefined, blockedAt: undefined } : {}),
  }

  Object.assign(task, updatedTask)

  const orderIndex = productionOrders.findIndex((order) => order.productionOrderId === task.productionOrderId)
  if (orderIndex < 0) return

  const order = productionOrders[orderIndex]
  const relatedTasks = listBoardTasks().filter((item) => item.productionOrderId === task.productionOrderId)
  const doneCount = relatedTasks.filter((item) => item.status === 'DONE').length
  const inProgressCount = relatedTasks.filter((item) => item.status === 'IN_PROGRESS').length
  const blockedCount = relatedTasks.filter((item) => item.status === 'BLOCKED').length

  let nextStatus = order.status
  if (doneCount === relatedTasks.length && relatedTasks.length > 0) {
    nextStatus = 'COMPLETED'
  } else if (doneCount > 0 || inProgressCount > 0 || blockedCount > 0) {
    nextStatus = 'EXECUTING'
  }

  productionOrders[orderIndex] = {
    ...order,
    status: nextStatus,
    updatedAt: now,
    auditLogs: [
      ...order.auditLogs,
      {
        id: nextOrderAuditLogId(order),
        action: 'TASK_STATUS_WRITEBACK',
        detail: `任务 ${taskId} 状态变更为 ${newStatus}`,
        at: now,
        by: '系统',
      },
    ],
  }
}

function showProgressBoardToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'progress-board-toast-root'
  let root = document.getElementById(rootId)

  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-6 top-20 z-[130] flex max-w-sm flex-col gap-2'
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

function copyToClipboard(text: string): void {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showProgressBoardToast(`已复制: ${text}`)
      })
      .catch(() => {
        showProgressBoardToast('复制失败', 'error')
      })
    return
  }

  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()

    try {
      document.execCommand('copy')
      showProgressBoardToast(`已复制: ${text}`)
    } catch {
      showProgressBoardToast('复制失败', 'error')
    } finally {
      textarea.remove()
    }
  }
}

function openLinkedPage(title: string, href: string): void {
  appStore.openTab({
    key: href,
    title,
    href,
    closable: true,
  })
}

function syncPresetFromQuery(): void {
  const queryKey = getCurrentQueryString()
  if (state.lastQueryKey === queryKey) return

  state.lastQueryKey = queryKey
  const params = getCurrentSearchParams()

  const presetStatus = params.get('status')
  const presetAssignmentStatus = params.get('assignmentStatus')
  const presetRisk = params.get('risk')
  const presetTaskId = params.get('taskId')
  const presetPoId = params.get('po')

  if (!state.initializedByQuery) {
    state.initializedByQuery = true
    state.statusFilter = presetStatus || 'ALL'
    state.assignmentStatusFilter = presetAssignmentStatus || 'ALL'
    state.riskFilter = presetRisk || 'ALL'
  } else {
    if (presetStatus) state.statusFilter = presetStatus
    if (presetAssignmentStatus) state.assignmentStatusFilter = presetAssignmentStatus
    if (presetRisk) state.riskFilter = presetRisk
  }

  if (presetTaskId) {
    state.dimension = 'task'
    state.keyword = presetTaskId
  }

  if (presetPoId && !presetTaskId) {
    state.dimension = 'order'
    state.poKeyword = presetPoId
  }
}

function clearTaskFilters(): void {
  state.keyword = ''
  state.statusFilter = 'ALL'
  state.assignmentStatusFilter = 'ALL'
  state.assignmentModeFilter = 'ALL'
  state.processFilter = 'ALL'
  state.stageFilter = 'ALL'
  state.riskFilter = 'ALL'
  state.factoryFilter = 'ALL'
}

function handleTaskKpiClick(type: string): void {
  clearTaskFilters()

  switch (type) {
    case 'notStarted':
      state.statusFilter = 'NOT_STARTED'
      break
    case 'inProgress':
      state.statusFilter = 'IN_PROGRESS'
      break
    case 'blocked':
      state.statusFilter = 'BLOCKED'
      break
    case 'done':
      state.statusFilter = 'DONE'
      break
    case 'unassigned':
      state.assignmentStatusFilter = 'UNASSIGNED'
      break
    case 'tenderOverdue':
      state.riskFilter = 'tenderOverdueOnly'
      break
    default:
      break
  }
}

function handlePoKpiClick(lifecycle: PoLifecycle): void {
  state.poKeyword = ''
  state.poLifecycleFilter = lifecycle
}

function setTaskSelected(taskId: string, checked: boolean): void {
  if (checked) {
    if (!state.selectedTaskIds.includes(taskId)) {
      state.selectedTaskIds = [...state.selectedTaskIds, taskId]
    }
    return
  }

  state.selectedTaskIds = state.selectedTaskIds.filter((id) => id !== taskId)
}

function openOrderDetail(orderId: string): void {
  state.dimension = 'order'
  state.detailOrderId = orderId
  state.detailTaskId = null
  state.orderActionMenuId = null
  state.taskActionMenuId = null
}

function openTaskDetail(taskId: string): void {
  state.detailTaskId = taskId
  state.taskDetailTab = 'basic'
  state.taskActionMenuId = null
}

function handleBatchUrge(): void {
  const selectedTasks = listBoardTasks().filter((task) => state.selectedTaskIds.includes(task.taskId))
  let sent = 0

  for (const task of selectedTasks) {
    if (!task.assignedFactoryId || ['DONE', 'CANCELLED'].includes(task.status)) continue

    const factory = getFactoryById(task.assignedFactoryId)
    const urgeType: UrgeType =
      task.status === 'NOT_STARTED'
        ? 'URGE_START'
        : task.status === 'BLOCKED'
          ? 'URGE_UNBLOCK'
          : 'URGE_FINISH'

    createUrge({
      urgeType,
      fromType: 'INTERNAL_USER',
      fromId: 'U002',
      fromName: '跟单A',
      toType: 'FACTORY',
      toId: task.assignedFactoryId,
      toName: factory?.name ?? task.assignedFactoryId,
      targetType: 'TASK',
      targetId: task.taskId,
      message: `请尽快处理任务 ${task.taskId}`,
      deepLink: {
        path: '/fcs/progress/board',
        query: { taskId: task.taskId },
      },
    })

    sent += 1
  }

  showProgressBoardToast(sent > 0 ? `已发送 ${sent} 条催办` : '没有可催办任务', sent > 0 ? 'success' : 'error')
  state.selectedTaskIds = []
}

function openBatchDialog(type: 'start' | 'finish'): void {
  const eligibleTaskIds = state.selectedTaskIds.filter((taskId) => {
    const task = getTaskById(taskId)
    if (!task) return false
    return type === 'start' ? task.status === 'NOT_STARTED' : task.status === 'IN_PROGRESS'
  })

  if (eligibleTaskIds.length === 0) {
    showProgressBoardToast('没有符合条件的任务', 'error')
    return
  }

  state.confirmDialogType = type
  state.confirmTaskIds = eligibleTaskIds
}

function confirmBatchAction(): void {
  if (!state.confirmDialogType || state.confirmTaskIds.length === 0) return

  const newStatus: TaskStatus = state.confirmDialogType === 'start' ? 'IN_PROGRESS' : 'DONE'

  for (const taskId of state.confirmTaskIds) {
    updateTaskStatus(taskId, newStatus, undefined, undefined, 'Admin')
  }

  showProgressBoardToast(`已更新 ${state.confirmTaskIds.length} 个任务`)
  state.confirmDialogType = null
  state.confirmTaskIds = []
  state.selectedTaskIds = []
}

function requestTaskStatusChange(task: ProcessTask, nextStatus: TaskStatus): void {
  if (nextStatus === 'BLOCKED') {
    state.blockDialogTaskId = task.taskId
    state.blockReason = 'OTHER'
    state.blockRemark = ''
    return
  }

  updateTaskStatus(task.taskId, nextStatus, undefined, undefined, 'Admin')
  showProgressBoardToast(`任务 ${task.taskId} 状态已更新`)
}

function confirmTaskBlock(): void {
  if (!state.blockDialogTaskId) return

  const task = getTaskById(state.blockDialogTaskId)
  if (!task) {
    state.blockDialogTaskId = null
    return
  }

  updateTaskStatus(task.taskId, 'BLOCKED', state.blockReason, state.blockRemark, 'Admin')

  const reasonCodeMap: Record<BlockReason, ReasonCode> = {
    MATERIAL: 'BLOCKED_MATERIAL',
    CAPACITY: 'BLOCKED_CAPACITY',
    QUALITY: 'BLOCKED_QUALITY',
    TECH: 'BLOCKED_TECH',
    EQUIPMENT: 'BLOCKED_EQUIPMENT',
    OTHER: 'BLOCKED_OTHER',
    ALLOCATION_GATE: 'BLOCKED_OTHER',
  }

  createOrUpdateExceptionFromSignal({
    sourceType: 'TASK',
    sourceId: task.taskId,
    reasonCode: reasonCodeMap[state.blockReason],
    detail: state.blockRemark || `任务 ${task.taskId} 被标记为生产暂停，原因：${BLOCK_REASON_LABEL[state.blockReason]}`,
  })

  showProgressBoardToast(`任务 ${task.taskId} 已标记为生产暂停`)

  state.blockDialogTaskId = null
  state.blockReason = 'OTHER'
  state.blockRemark = ''
}

export {
  showProgressBoardToast,
  copyToClipboard,
  openLinkedPage,
  clearTaskFilters,
  handleTaskKpiClick,
  handlePoKpiClick,
  setTaskSelected,
  openOrderDetail,
  openTaskDetail,
  handleBatchUrge,
  openBatchDialog,
  confirmBatchAction,
  requestTaskStatusChange,
  createUrge,
  confirmTaskBlock,
}
