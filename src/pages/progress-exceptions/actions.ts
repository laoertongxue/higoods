import {
  state,
  DIRECT_CLOSE_REASON_SET,
  CLOSE_REASON_LABEL,
  nowTimestamp,
  getExceptionCases,
  getCaseById,
  getTaskById,
  getResolveJudgeResult,
  getExecutionTaskFactById,
  appStore,
  appendCaseAction,
  appendCaseAuditLog,
  appendCaseStatusChangeAudit,
  markCaseResolved,
  maybeAutoCloseResolvedCase,
  markCaseClosed,
  allowContinueFromPauseException,
  recordPauseExceptionFollowUp,
  generateNotificationId,
  generateUrgeId,
  initialNotifications,
  initialUrges,
  normalizeCaseStatus,
  upsertProgressExceptionCase,
  extendTenderDeadlineFromRuntime,
  type ExceptionCase,
  type Notification,
  type ProcessTask,
  type TaskAuditLog,
  type UrgeLog,
  type CloseReasonCode,
  type ResolveRuleCode,
} from './context'

export function syncExceptionResolvedByBusiness(): void {
  const now = nowTimestamp()
  const exceptionCases = getExceptionCases()

  for (const exc of exceptionCases) {
    const uiStatus = normalizeCaseStatus(exc.caseStatus)
    if (uiStatus === 'RESOLVED' || uiStatus === 'CLOSED') continue
    if (exc.sourceSystem === 'MOCK') continue

    const judge = getResolveJudgeResult(exc)
    if (!judge.resolved) continue

    const resolved = markCaseResolved(exc, {
      by: '系统',
      source: 'SYSTEM',
      ruleCode: judge.resolvedRuleCode,
      detail: judge.resolvedDetail,
      at: now,
      actionType: 'AUTO_RESOLVE',
      auditAction: 'AUTO_RESOLVE',
    })
    const closedIfNeeded = maybeAutoCloseResolvedCase(resolved, '系统')
    updateException(closedIfNeeded)
  }
}

export function updateException(updated: ExceptionCase): void {
  upsertProgressExceptionCase(updated)
}

export function updateTaskStatus(taskId: string, newStatus: ProcessTask['status'], by: string = 'Admin'): void {
  const task = getExecutionTaskFactById(taskId)
  if (!task) return
  const now = nowTimestamp()

  const actionMap: Record<ProcessTask['status'], string> = {
    NOT_STARTED: 'RESET',
    IN_PROGRESS: task.status === 'BLOCKED' ? 'UNBLOCK' : 'START',
    DONE: 'FINISH',
    BLOCKED: 'BLOCK',
    CANCELLED: 'CANCEL',
  }

  const detailMap: Record<ProcessTask['status'], string> = {
    NOT_STARTED: '重置为未开始',
    IN_PROGRESS: task.status === 'BLOCKED' ? '恢复执行并继续推进' : '任务开始执行',
    DONE: '任务已完工',
    BLOCKED: '任务生产暂停',
    CANCELLED: '任务已取消',
  }

  const taskAudit: TaskAuditLog = {
    id: `AL-${taskId}-${String(task.auditLogs.length + 1).padStart(4, '0')}`,
    action: actionMap[newStatus],
    detail: detailMap[newStatus],
    at: now,
    by,
  }

  task.status = newStatus
  task.updatedAt = now
  if (newStatus === 'IN_PROGRESS') {
    task.blockReason = undefined
    task.blockRemark = undefined
    task.blockedAt = undefined
  }
  task.auditLogs = [...task.auditLogs, taskAudit]
}

export function extendTenderDeadline(tenderId: string, hours: number = 24): void {
  extendTenderDeadlineFromRuntime(tenderId, hours, 'Admin')
}

export function createNotification(payload: Omit<Notification, 'notificationId' | 'createdAt'>): Notification {
  const notification: Notification = {
    ...payload,
    notificationId: generateNotificationId(),
    createdAt: nowTimestamp(),
  }

  initialNotifications.push(notification)
  return notification
}

export function createUrge(payload: Omit<UrgeLog, 'urgeId' | 'createdAt' | 'status' | 'auditLogs'>): UrgeLog {
  const createdAt = nowTimestamp()

  const urge: UrgeLog = {
    ...payload,
    urgeId: generateUrgeId(),
    createdAt,
    status: 'SENT',
    auditLogs: [
      {
        id: `UAL-${payload.targetId}-${String(initialUrges.length + 1).padStart(4, '0')}`,
        action: 'SEND',
        detail: '发送催办',
        at: createdAt,
        by: payload.fromName,
      },
    ],
  }

  initialUrges.push(urge)

  createNotification({
    level: 'INFO',
    title: '收到催办',
    content: `${payload.fromName}：请尽快处理 ${payload.targetId}`,
    recipientType: payload.toType,
    recipientId: payload.toId,
    recipientName: payload.toName,
    targetType: payload.targetType,
    targetId: payload.targetId,
    related: { caseId: payload.targetType === 'CASE' ? payload.targetId : undefined },
    deepLink: payload.deepLink,
    createdBy: payload.fromId,
  })

  return urge
}

export function showProgressExceptionsToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'progress-exceptions-toast-root'
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
      if (root && root.childElementCount === 0) root.remove()
    }, 180)
  }, 2400)
}

export function openLinkedPage(title: string, href: string): void {
  appStore.openTab({
    key: href,
    title,
    href,
    closable: true,
  })
}


export function clearFilters(): void {
  state.keyword = ''
  state.statusFilter = 'ALL'
  state.severityFilter = 'ALL'
  state.categoryFilter = 'ALL'
  state.subCategoryFilter = 'ALL'
  state.ownerFilter = 'ALL'
  state.factoryFilter = 'ALL'
  state.processFilter = 'ALL'
  state.currentPage = 1
  state.aggregateFilter = null
  state.showUpstreamHint = false
  state.rowActionMenuCaseId = null
  state.pauseFollowUpCaseId = null
  state.pauseFollowUpRemark = ''
  appStore.navigate('/fcs/progress/exceptions')
}

export function assignCaseOwner(exc: ExceptionCase, userId: string, userName: string): ExceptionCase {
  const now = nowTimestamp()
  const currentStatus = normalizeCaseStatus(exc.caseStatus)
  const promoteToInProgress = currentStatus === 'OPEN'

  let updated: ExceptionCase = {
    ...exc,
    caseStatus: promoteToInProgress ? 'IN_PROGRESS' : exc.caseStatus,
    ownerUserId: userId,
    ownerUserName: userName,
    updatedAt: now,
  }

  updated = appendCaseAction(updated, {
    actionType: 'ASSIGN_OWNER',
    actionDetail: `指派责任人：${userName}`,
    at: now,
    by: 'Admin',
  })
  updated = appendCaseAuditLog(updated, {
    action: 'ASSIGN',
    detail: `指派给 ${userName}`,
    at: now,
    by: 'Admin',
  })
  if (promoteToInProgress) {
    updated = appendCaseAction(updated, {
      actionType: 'FOLLOW_UP',
      actionDetail: '指派责任人后自动转为处理中',
      at: now,
      by: 'Admin',
    })
    updated = appendCaseStatusChangeAudit(updated, exc.caseStatus, 'IN_PROGRESS', now, 'Admin')
  }

  updateException(updated)
  return updated
}

export function confirmUnblock(): void {
  if (!state.unblockDialogCaseId) return

  const exc = getCaseById(state.unblockDialogCaseId)
  if (!exc) {
    state.unblockDialogCaseId = null
    state.unblockRemark = ''
    return
  }

  if (!state.unblockRemark.trim()) {
    showProgressExceptionsToast('请填写处理备注', 'error')
    return
  }

  const now = nowTimestamp()

  for (const taskId of exc.relatedTaskIds) {
    const task = getTaskById(taskId)
    if (task?.status === 'BLOCKED') {
      updateTaskStatus(taskId, 'IN_PROGRESS')
    }
  }

  let updated: ExceptionCase = {
    ...exc,
    caseStatus: 'IN_PROGRESS',
    updatedAt: now,
  }
  updated = appendCaseAction(updated, {
    actionType: 'UNBLOCK',
    actionDetail: `恢复执行：${state.unblockRemark.trim()}`,
    at: now,
    by: 'Admin',
  })
  updated = appendCaseAuditLog(updated, {
    action: 'UNBLOCK',
    detail: `执行恢复执行，备注：${state.unblockRemark.trim()}`,
    at: now,
    by: 'Admin',
  })
  updated = appendCaseStatusChangeAudit(updated, exc.caseStatus, 'IN_PROGRESS', now, 'Admin')

  updateException(updated)
  showProgressExceptionsToast('已恢复执行')
  state.unblockDialogCaseId = null
  state.unblockRemark = ''
}

export function confirmExtendTender(): void {
  if (!state.extendDialogCaseId) return

  const exc = getCaseById(state.extendDialogCaseId)
  if (!exc) {
    state.extendDialogCaseId = null
    return
  }

  const now = nowTimestamp()

  for (const tenderId of exc.relatedTenderIds) {
    extendTenderDeadline(tenderId, 24)
  }

  let updated: ExceptionCase = {
    ...exc,
    caseStatus: 'IN_PROGRESS',
    updatedAt: now,
  }
  updated = appendCaseAction(updated, {
    actionType: 'EXTEND_TENDER',
    actionDetail: '延长竞价截止时间 24 小时',
    at: now,
    by: 'Admin',
  })
  updated = appendCaseAuditLog(updated, {
    action: 'EXTEND_TENDER',
    detail: '执行延长竞价 24 小时',
    at: now,
    by: 'Admin',
  })
  updated = appendCaseStatusChangeAudit(updated, exc.caseStatus, 'IN_PROGRESS', now, 'Admin')

  updateException(updated)
  showProgressExceptionsToast('已延长竞价 24 小时')
  state.extendDialogCaseId = null
}

export function confirmPauseFollowUp(): void {
  if (!state.pauseFollowUpCaseId) return
  if (!state.pauseFollowUpRemark.trim()) {
    showProgressExceptionsToast('请填写跟进备注', 'error')
    return
  }

  const exc = getCaseById(state.pauseFollowUpCaseId)
  if (!exc) {
    state.pauseFollowUpCaseId = null
    state.pauseFollowUpRemark = ''
    return
  }

  const remark = state.pauseFollowUpRemark.trim()
  let result: { ok: boolean; message: string }

  if (exc.sourceType === 'FACTORY_PAUSE_REPORT') {
    result = recordPauseExceptionFollowUp(exc.caseId, remark, 'Admin')
  } else {
    const now = nowTimestamp()
    const shouldPromote = normalizeCaseStatus(exc.caseStatus) === 'OPEN'
    let updated: ExceptionCase = {
      ...exc,
      caseStatus: shouldPromote ? 'IN_PROGRESS' : exc.caseStatus,
      updatedAt: now,
    }
    updated = appendCaseAction(updated, {
      actionType: 'FOLLOW_UP',
      actionDetail: `记录跟进：${remark}`,
      at: now,
      by: 'Admin',
    })
    updated = appendCaseAuditLog(updated, {
      action: 'FOLLOW_UP',
      detail: `记录跟进：${remark}`,
      at: now,
      by: 'Admin',
    })
    if (shouldPromote) {
      updated = appendCaseStatusChangeAudit(updated, exc.caseStatus, 'IN_PROGRESS', now, 'Admin')
    }
    updateException(updated)
    result = { ok: true, message: '已记录跟进' }
  }

  showProgressExceptionsToast(result.message, result.ok ? 'success' : 'error')
  if (result.ok) {
    state.pauseFollowUpCaseId = null
    state.pauseFollowUpRemark = ''
  }
}

export function confirmPauseAllowContinue(caseId: string): void {
  const result = allowContinueFromPauseException(caseId, 'Admin')
  showProgressExceptionsToast(result.message, result.ok ? 'success' : 'error')
}

export function openCloseDialog(caseId: string): void {
  state.closeDialogCaseId = caseId
  state.closeReason = 'RESOLVED_DONE'
  state.closeRemark = ''
  state.closeMergeCaseId = ''
}

export function closeCloseDialog(): void {
  state.closeDialogCaseId = null
  state.closeReason = 'RESOLVED_DONE'
  state.closeRemark = ''
  state.closeMergeCaseId = ''
}

export function confirmCloseException(): void {
  if (!state.closeDialogCaseId) return

  const exc = getCaseById(state.closeDialogCaseId)
  if (!exc) {
    closeCloseDialog()
    return
  }

  const reason = state.closeReason
  const remark = state.closeRemark.trim()
  const mergedCaseId = state.closeMergeCaseId.trim()
  const uiStatus = normalizeCaseStatus(exc.caseStatus)

  if (reason === 'RESOLVED_DONE' && uiStatus !== 'RESOLVED') {
    showProgressExceptionsToast('仅已解决异常可按“已解决后关闭”关闭', 'error')
    return
  }

  if (DIRECT_CLOSE_REASON_SET.has(reason) && !remark) {
    showProgressExceptionsToast('请补充关闭备注，说明关闭依据', 'error')
    return
  }

  if ((reason === 'DUPLICATE' || reason === 'MERGED') && !mergedCaseId && !remark) {
    showProgressExceptionsToast('请填写关联异常号或关闭备注', 'error')
    return
  }

  const now = nowTimestamp()
  const closeDetail = [
    `关闭异常：${CLOSE_REASON_LABEL[reason]}`,
    mergedCaseId ? `关联异常 ${mergedCaseId}` : '',
    remark ? `备注：${remark}` : '',
  ]
    .filter(Boolean)
    .join('，')

  updateException(
    markCaseClosed(exc, {
      by: 'Admin',
      reasonCode: reason,
      detail: closeDetail,
      mergedCaseId: mergedCaseId || undefined,
      at: now,
      actionType: 'CLOSE_EXCEPTION',
      auditAction: 'CLOSE_EXCEPTION',
    }),
  )

  showProgressExceptionsToast('异常已关闭')
  closeCloseDialog()
}
