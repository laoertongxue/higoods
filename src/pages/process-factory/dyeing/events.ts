import { appStore } from '../../../state/store'
import {
  confirmDyeReceipt,
  executeDyeWaterSolublePdaAction,
  getDyeWorkOrderById,
  getDyeReviewRecordByOrderId,
  markDyeReceiptDifference,
  type DyeWaterSolublePauseDecision,
} from '../../../data/fcs/dyeing-task-domain.ts'
import { getPdaSession } from '../../../data/fcs/store-domain-pda.ts'
import { validateWaterSolublePdaActor, type WaterSolublePdaRoleAction } from '../../../data/fcs/water-soluble-pda-actor.ts'
import { executeProcessWebAction } from '../../../data/fcs/process-web-status-actions.ts'
import {
  handleProcessWebStatusActionDialogEvent,
  openProcessWebStatusActionDialog,
} from '../shared/web-status-action-dialog.ts'

function showDyeingToast(message: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'dyeing-page-toast-root'
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
      if (root && root.childElementCount === 0) root.remove()
    }, 180)
  }, 2200)
}

function refreshCurrentDyeingPage(): void {
  const current = appStore.getState().pathname || '/'
  const [path, queryString = ''] = current.split('?')
  const params = new URLSearchParams(queryString)
  params.delete('webAction')
  params.set('actionResultAt', String(Date.now()))
  const next = `${path}?${params.toString()}`
  appStore.navigate(next, { historyMode: 'replace' })
}

let dyeWaterConfirmationSequence = 0
let activeDyeWaterConfirmation: null | {
  token: string
  dyeOrderId: string
  taskId: string
  expectedStatus: string
  expectedNode: 'WATER_SOLUBLE'
  actorLoginId: string
} = null

function executeConfirmedDyeWaterAction(
  actionNode: HTMLElement,
  action: 'START' | 'COMPLETE' | 'RESOLVE_PAUSE',
  values: { outputQty?: number; reason?: string; decision?: DyeWaterSolublePauseDecision } = {},
): void {
  const dyeOrderId = actionNode.dataset.dyeOrderId || ''
  const order = getDyeWorkOrderById(dyeOrderId)
  const session = getPdaSession()
  const roleAction: WaterSolublePdaRoleAction = action === 'RESOLVE_PAUSE' ? 'SUPERVISE' : 'OPERATE'
  const requiredStatus = action === 'START' ? 'WAIT_WATER_SOLUBLE' : action === 'COMPLETE' ? 'WATER_SOLUBLE_IN_PROGRESS' : 'PRODUCTION_PAUSED'
  if (!order || !session || !order.requiresWaterSoluble) {
    showDyeingToast('当前加工单或登录信息已失效，请重新进入。')
    return
  }
  if (
    actionNode.dataset.taskId !== order.taskId
    || actionNode.dataset.expectedStatus !== order.status
    || actionNode.dataset.expectedNode !== 'WATER_SOLUBLE'
    || order.status !== requiredStatus
  ) {
    showDyeingToast('当前任务或步骤已更新，请按最新页面操作。')
    return
  }
  const actorError = validateWaterSolublePdaActor(session, order.dyeFactoryId, roleAction)
  if (actorError) {
    showDyeingToast(actorError)
    return
  }

  const expectedStatus = order.status
  const confirmationContext = {
    token: `${order.dyeOrderId}:${++dyeWaterConfirmationSequence}`,
    dyeOrderId: order.dyeOrderId,
    taskId: order.taskId,
    expectedStatus,
    expectedNode: 'WATER_SOLUBLE' as const,
    actorLoginId: session.loginId,
  }
  activeDyeWaterConfirmation = confirmationContext
  const confirmed = window.confirm(action === 'START' ? '确认开始水溶？' : action === 'COMPLETE' ? '确认提交水溶完成数量？' : '确认提交主管处理结果？')
  if (!confirmed) {
    if (activeDyeWaterConfirmation?.token === confirmationContext.token) activeDyeWaterConfirmation = null
    return
  }

  const current = getDyeWorkOrderById(dyeOrderId)
  const currentSession = getPdaSession()
  if (
    !current || !currentSession
    || activeDyeWaterConfirmation?.token !== confirmationContext.token
    || confirmationContext.dyeOrderId !== current.dyeOrderId
    || confirmationContext.taskId !== current.taskId
    || confirmationContext.expectedStatus !== current.status
    || confirmationContext.expectedNode !== 'WATER_SOLUBLE'
    || confirmationContext.actorLoginId !== currentSession.loginId
    || current.status !== expectedStatus
    || validateWaterSolublePdaActor(currentSession, current.dyeFactoryId, roleAction)
  ) {
    if (activeDyeWaterConfirmation?.token === confirmationContext.token) activeDyeWaterConfirmation = null
    showDyeingToast('当前确认已失效，请重新操作。')
    return
  }
  activeDyeWaterConfirmation = null

  const common = {
    dyeOrderId: current.dyeOrderId,
    taskId: current.taskId,
    expectedStatus,
    expectedNode: 'WATER_SOLUBLE' as const,
    actor: currentSession,
  }
  const result = action === 'START'
    ? executeDyeWaterSolublePdaAction({ action, ...common, expectedStatus: requiredStatus })
    : action === 'COMPLETE'
      ? executeDyeWaterSolublePdaAction({ action, ...common, expectedStatus: requiredStatus, outputQty: values.outputQty, reason: values.reason })
      : executeDyeWaterSolublePdaAction({ action, ...common, expectedStatus: requiredStatus, decision: values.decision })
  showDyeingToast(result.ok ? (action === 'START' ? '已开始水溶' : action === 'COMPLETE' ? (result.order?.status === 'PRODUCTION_PAUSED' ? '数量不足，已交主管处理' : '水溶完成，可继续染色') : '主管处理已记录') : result.message)
  if (result.ok) refreshCurrentDyeingPage()
}

export function handleCraftDyeingEvent(target: HTMLElement): boolean {
  const dialogHandled = handleProcessWebStatusActionDialogEvent(target, {
    toast: showDyeingToast,
    refresh: refreshCurrentDyeingPage,
  })
  if (dialogHandled !== null) return dialogHandled

  const actionNode = target.closest<HTMLElement>('[data-dyeing-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.dyeingAction
  if (!action) return false

  if (action === 'navigate') {
    const href = actionNode.dataset.href
    if (href) appStore.navigate(href)
    return true
  }

  if (action === 'open-web-status-action-dialog') {
    openProcessWebStatusActionDialog({ actionNode, sourceType: 'DYE_WORK_ORDER' })
    return false
  }

  if (action === 'web-status-action') {
    const sourceId = actionNode.dataset.sourceId
    const actionCode = actionNode.dataset.actionCode
    if (!sourceId || !actionCode) return true
    try {
      const result = executeProcessWebAction({
        sourceType: 'DYE_WORK_ORDER',
        sourceId,
        actionCode,
        operatorName: 'Web 端操作员',
        operatedAt: '2026-04-28 10:00',
        remark: '工艺工厂 Web 端状态操作',
      })
      showDyeingToast(result.message)
    } catch (error) {
      showDyeingToast(error instanceof Error ? error.message : '状态操作失败')
    }
    return true
  }

  if (action === 'start-water-soluble') {
    executeConfirmedDyeWaterAction(actionNode, 'START')
    return true
  }

  if (action === 'complete-water-soluble') {
    const dyeOrderId = actionNode.dataset.dyeOrderId
    if (!dyeOrderId) return true
    const qtyText = window.prompt('请输入水溶实际完成数量')
    if (qtyText === null) return true
    const normalizedQtyText = qtyText.trim()
    if (!normalizedQtyText) {
      showDyeingToast('请填写水溶实际完成数量。')
      return true
    }
    const outputQty = Number(normalizedQtyText)
    const reason = window.prompt('如数量与计划不同，请填写原因') || ''
    executeConfirmedDyeWaterAction(actionNode, 'COMPLETE', { outputQty, reason })
    return true
  }

  if (action === 'resolve-water-soluble-pause') {
    const dyeOrderId = actionNode.dataset.dyeOrderId
    const decision = actionNode.dataset.decision as 'CONTINUE_PROCESSING' | 'CONTINUE_WITH_ACTUAL_QTY' | 'RETURN_FOR_REWORK' | undefined
    if (!dyeOrderId || !decision) return true
    executeConfirmedDyeWaterAction(actionNode, 'RESOLVE_PAUSE', { decision })
    return true
  }

  if (action === 'confirm-receipt') {
    const dyeOrderId = actionNode.dataset.dyeOrderId
    if (!dyeOrderId) return true
    confirmDyeReceipt(dyeOrderId, { receivedBy: '仓库收货员', remark: '仓库确认本次收货' })
    showDyeingToast('已确认本次收货')
    appStore.navigate(`/fcs/craft/dyeing/reports?dyeOrderId=${encodeURIComponent(dyeOrderId)}`)
    return true
  }

  if (action === 'mark-receipt-difference') {
    const dyeOrderId = actionNode.dataset.dyeOrderId
    if (!dyeOrderId) return true
    const review = getDyeReviewRecordByOrderId(dyeOrderId)
    const defaultQty = review?.receivedQty || review?.submittedQty || 0
    const qtyText = window.prompt('请输入本次实收数量', String(defaultQty))
    if (qtyText === null) return true
    const receivedQty = Number(qtyText)
    if (!Number.isFinite(receivedQty) || receivedQty < 0) {
      showDyeingToast('请填写有效的实收数量')
      return true
    }
    const differenceReason = window.prompt('请输入收货差异原因')
    if (!differenceReason) return true
    markDyeReceiptDifference(dyeOrderId, {
      receivedBy: '仓库收货员',
      receivedQty,
      differenceReason,
      remark: '仓库确认收货差异',
    })
    showDyeingToast('已标记收货差异')
    appStore.navigate(`/fcs/craft/dyeing/reports?dyeOrderId=${encodeURIComponent(dyeOrderId)}`)
    return true
  }

  return false
}
