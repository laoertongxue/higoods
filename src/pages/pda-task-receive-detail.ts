import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { type ProcessTask } from '../data/fcs/process-tasks'
import { productionOrders } from '../data/fcs/production-orders'
import { indonesiaFactories } from '../data/fcs/indonesia-factories'
import {
  PDA_MOCK_BIDDING_TENDERS,
  PDA_MOCK_QUOTED_TENDERS,
} from '../data/fcs/pda-mobile-mock'
import {
  getTaskProcessDisplayName,
  getTaskStageDisplayName,
} from '../data/fcs/page-adapters/task-execution-adapter'
import {
  getPdaTaskFlowTaskById,
  isCuttingSpecialTask,
  listPdaTaskFlowTasks,
  resolvePdaTaskExecPath,
  type PdaTaskFlowMock,
} from '../data/fcs/pda-cutting-execution-source.ts'
import { renderPdaFrame } from './pda-shell'
import {
  buildPdaCuttingDirectExecEntryHref,
  buildPdaCuttingTaskDetailNavHref,
} from './pda-cutting-nav-context'
import {
  buildPdaCuttingTaskEntryAction,
  getPdaCuttingTaskStateBadgeClass,
} from './pda-cutting-task-rollup'

interface TaskReceiveDetailState {
  rejectDialogOpen: boolean
  rejectReason: string
}

type ReceiveDetailTabKey = 'pending-accept' | 'pending-quote' | 'quoted' | 'awarded'

type PdaReceiveTask = PdaTaskFlowMock

const state: TaskReceiveDetailState = {
  rejectDialogOpen: false,
  rejectReason: '',
}

function listTaskFacts(): ProcessTask[] {
  return listPdaTaskFlowTasks()
}

function getTaskFactById(taskId: string): ProcessTask | null {
  return getPdaTaskFlowTaskById(taskId) ?? null
}

function getTaskDisplayNo(task: ProcessTask): string {
  return task.taskNo || task.taskId
}

function getRootTaskDisplayNo(task: ProcessTask): string {
  return task.rootTaskNo || task.taskNo || task.taskId
}

function getTaskProductionOrderNo(task: ProcessTask): string {
  return (task as ProcessTask & { productionOrderNo?: string }).productionOrderNo || task.productionOrderId
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function getCurrentFactoryId(): string {
  if (typeof window === 'undefined') return 'ID-F001'

  try {
    const localFactoryId = window.localStorage.getItem('fcs_pda_factory_id')
    if (localFactoryId) return localFactoryId

    const rawSession = window.localStorage.getItem('fcs_pda_session')
    if (rawSession) {
      const parsed = JSON.parse(rawSession) as { factoryId?: string }
      if (parsed.factoryId) return parsed.factoryId
    }
  } catch {
    // ignore parsing errors
  }

  return 'ID-F001'
}

function getFactoryName(factoryId: string): string {
  const factory = indonesiaFactories.find((item) => item.id === factoryId)
  return factory?.name ?? factoryId
}

function getReceiveDetailSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, queryString = ''] = pathname.split('?')
  return new URLSearchParams(queryString)
}

function resolveReceiveBackHref(): string {
  const returnTo = getReceiveDetailSearchParams().get('returnTo')
  if (returnTo && returnTo.startsWith('/fcs/pda/task-receive')) {
    return returnTo
  }
  return '/fcs/pda/task-receive'
}

function getReceiveDetailTab(task: ProcessTask): ReceiveDetailTabKey {
  const returnTo = getReceiveDetailSearchParams().get('returnTo')
  if (returnTo) {
    const [, queryString = ''] = returnTo.split('?')
    const tab = new URLSearchParams(queryString).get('tab')
    if (tab === 'pending-accept' || tab === 'pending-quote' || tab === 'quoted' || tab === 'awarded') {
      return tab
    }
  }

  if (PDA_MOCK_QUOTED_TENDERS.some((item) => item.taskId === task.taskId)) {
    return 'quoted'
  }
  if (PDA_MOCK_BIDDING_TENDERS.some((item) => item.taskId === task.taskId)) {
    return 'pending-quote'
  }
  if (task.assignmentMode === 'BIDDING' && task.assignmentStatus === 'AWARDED') {
    return 'awarded'
  }
  return 'pending-accept'
}

function getPendingQuoteTender(taskId: string) {
  return PDA_MOCK_BIDDING_TENDERS.find((item) => item.taskId === taskId) ?? null
}

function getQuotedTender(taskId: string) {
  return PDA_MOCK_QUOTED_TENDERS.find((item) => item.taskId === taskId) ?? null
}

function buildReceiveQuotePath(tenderId: string): string {
  return `/fcs/pda/task-receive?tab=pending-quote&quoteTenderId=${encodeURIComponent(tenderId)}`
}

function getTaskStyleSnapshot(task: ProcessTask): {
  spuCode: string
  spuName: string
  deliveryDate: string
  spuImageUrl?: string
} {
  const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)
  const taskSnapshot = task as ProcessTask & {
    spuCode?: string
    spuName?: string
    requiredDeliveryDate?: string
    spuImageUrl?: string
  }

  return {
    spuCode: order?.demandSnapshot?.spuCode || taskSnapshot.spuCode || '-',
    spuName: order?.demandSnapshot?.spuName || taskSnapshot.spuName || '-',
    deliveryDate: order?.demandSnapshot?.requiredDeliveryDate || taskSnapshot.requiredDeliveryDate || '-',
    spuImageUrl: taskSnapshot.spuImageUrl,
  }
}

function renderSectionCard(title: string, icon: string, body: string): string {
  return `
    <article class="rounded-lg border bg-card">
      <header class="border-b px-4 py-3">
        <h2 class="flex items-center gap-2 text-base font-semibold">
          <i data-lucide="${escapeHtml(icon)}" class="h-4 w-4"></i>
          ${escapeHtml(title)}
        </h2>
      </header>
      <div class="space-y-3 p-4 text-sm">${body}</div>
    </article>
  `
}

function mutateAcceptTask(taskId: string, by: string): void {
  const now = nowTimestamp()
  const task = getTaskFactById(taskId)
  if (!task) return

  task.acceptanceStatus = 'ACCEPTED'
  task.acceptedAt = now
  task.acceptedBy = by
  task.updatedAt = now
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-ACC-${Date.now()}`,
      action: 'ACCEPT_TASK',
      detail: '工厂确认接单',
      at: now,
      by,
    },
  ]
}

function mutateRejectTask(taskId: string, reason: string, by: string): void {
  const now = nowTimestamp()
  const task = getTaskFactById(taskId)
  if (!task) return

  task.acceptanceStatus = 'REJECTED'
  task.assignmentStatus = 'UNASSIGNED'
  task.assignedFactoryId = undefined
  task.assignedFactoryName = undefined
  task.updatedAt = now
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-REJ-${Date.now()}`,
      action: 'REJECT_TASK',
      detail: `工厂拒绝接单，原因：${reason}`,
      at: now,
      by,
    },
  ]
}

function showTaskReceiveDetailToast(message: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'pda-task-receive-detail-toast-root'
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

function getTaskPricing(task: ProcessTask): {
  standardPrice?: number
  directPrice?: number
  currency: string
  unit: string
  priceStatus: string | null
  priceStatusColor: string
} {
  const standardPrice = task.standardPrice
  const directPrice = (task as ProcessTask & { directPrice?: number }).directPrice ?? task.dispatchPrice
  const currency =
    (task as ProcessTask & { currency?: string }).currency ||
    task.dispatchPriceCurrency ||
    task.standardPriceCurrency ||
    'IDR'
  const unit = task.dispatchPriceUnit || task.standardPriceUnit || task.qtyUnit || '件'

  let priceStatus: string | null = null
  if (standardPrice != null && directPrice != null) {
    if (directPrice === standardPrice) {
      priceStatus = '按标准价派单'
    } else if (directPrice > standardPrice) {
      priceStatus = '高于标准价'
    } else {
      priceStatus = '低于标准价'
    }
  }

  const priceStatusColor =
    priceStatus === '按标准价派单'
      ? 'text-muted-foreground'
      : priceStatus === '高于标准价'
        ? 'text-amber-600'
        : 'text-blue-600'

  return { standardPrice, directPrice, currency, unit, priceStatus, priceStatusColor }
}

function getAssignmentModeLabel(mode: ProcessTask['assignmentMode']): string {
  if (mode === 'DIRECT') return '直接派单'
  if (mode === 'BIDDING') return '竞价指派'
  return mode
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function renderField(label: string, value: string): string {
  return `
    <div>
      <span class="text-muted-foreground">${escapeHtml(label)}:</span>
      <div class="font-medium">${escapeHtml(value)}</div>
    </div>
  `
}

function renderCuttingTaskRollupCard(task: PdaReceiveTask): string {
  return `
    <article class="rounded-lg border bg-card">
      <header class="border-b px-4 py-3">
        <div class="flex items-center justify-between gap-2">
          <h2 class="flex items-center gap-2 text-base font-semibold">
            <i data-lucide="clipboard-list" class="h-4 w-4"></i>
            ${escapeHtml(getTaskDisplayNo(task))}
          </h2>
          <span class="inline-flex items-center rounded border px-2 py-0.5 text-xs ${escapeHtml(getPdaCuttingTaskStateBadgeClass(task.taskStateLabel))}">${escapeHtml(task.taskStateLabel || '待开始')}</span>
        </div>
      </header>

      <div class="space-y-3 p-4">
        <div class="grid grid-cols-2 gap-3 text-sm">
          ${renderField('生产单号', getTaskProductionOrderNo(task))}
          ${renderField('工序名称', getTaskProcessDisplayName(task))}
          ${renderField('裁片单数量', `${task.cutPieceOrderCount || 0} 张`)}
          ${renderField('当前状态', task.taskStateLabel || '待开始')}
          ${renderField('已完成', `${task.completedCutPieceOrderCount || 0} 张`)}
          ${renderField('未完成', `${task.pendingCutPieceOrderCount || 0} 张`)}
          ${
            task.exceptionCutPieceOrderCount
              ? renderField('异常裁片单', `${task.exceptionCutPieceOrderCount} 张`)
              : renderField('异常裁片单', '0 张')
          }
          ${renderField('下一步', task.taskNextActionLabel || '查看任务')}
        </div>

        ${
          task.taskProgressLabel
            ? `<div class="rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground">${escapeHtml(task.taskProgressLabel)}</div>`
            : ''
        }
      </div>
    </article>
  `
}

function renderCuttingTaskActionCard(task: PdaReceiveTask): string {
  const taskDetailHref = buildPdaCuttingTaskDetailNavHref(task.taskId, {
    sourcePageKey: 'task-receive-detail',
    returnTo: appStore.getState().pathname,
    focusTaskId: task.taskId,
    executionOrderId: task.defaultExecutionOrderId,
    executionOrderNo: task.defaultExecutionOrderNo,
    taskNo: task.taskNo,
    productionOrderNo: getTaskProductionOrderNo(task),
  })
  const execHref = buildPdaCuttingDirectExecEntryHref(task.taskId, {
    sourcePageKey: 'task-receive-detail',
    returnTo: taskDetailHref,
    focusTaskId: task.taskId,
    executionOrderId: task.defaultExecutionOrderId,
    executionOrderNo: task.defaultExecutionOrderNo,
    focusExecutionOrderId: task.defaultExecutionOrderId,
    focusExecutionOrderNo: task.defaultExecutionOrderNo,
    taskNo: task.taskNo,
    productionOrderNo: getTaskProductionOrderNo(task),
  })
  const entryAction = buildPdaCuttingTaskEntryAction(task, {
    returnTo: appStore.getState().pathname,
    detailHref: taskDetailHref,
    execHref,
  })

  return renderSectionCard(
    '进入处理',
    'arrow-right-circle',
    `
      <div class="grid grid-cols-2 gap-3">
        ${renderField('当前任务状态', task.taskStateLabel || '待开始')}
        ${renderField('下一步建议', task.taskNextActionLabel || '查看任务')}
      </div>
      ${
        entryAction.helperText
          ? `<div class="rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground">${escapeHtml(entryAction.helperText)}</div>`
          : ''
      }
      ${
        entryAction.directExec
          ? `
              <div class="flex gap-2">
                <button class="inline-flex h-9 flex-1 items-center justify-center rounded-md border px-3 text-sm hover:bg-muted" data-nav="${escapeHtml(taskDetailHref)}">查看裁片任务</button>
                <button class="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90" data-nav="${escapeHtml(entryAction.href)}">${escapeHtml(entryAction.label)}</button>
              </div>
            `
          : `
              <button class="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90" data-nav="${escapeHtml(taskDetailHref)}">${escapeHtml(entryAction.label)}</button>
            `
      }
    `,
  )
}

function renderRejectDialog(taskId: string): string {
  if (!state.rejectDialogOpen) return ''

  return `
    <div class="fixed inset-0 z-[120] bg-black/35" data-pda-trd-action="close-reject"></div>
    <div class="fixed inset-0 z-[121] flex items-center justify-center p-4">
      <article class="w-full max-w-sm rounded-lg border bg-background shadow-lg">
        <header class="space-y-1 border-b px-4 py-3">
          <h3 class="text-base font-semibold">拒绝接单</h3>
          <p class="text-xs text-muted-foreground">请填写拒绝原因（必填）</p>
        </header>

        <div class="px-4 py-3">
          <textarea
            class="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="请输入拒绝原因"
            data-pda-trd-field="rejectReason"
          >${escapeHtml(state.rejectReason)}</textarea>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pda-trd-action="close-reject">取消</button>
          <button
            class="inline-flex h-8 items-center rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            data-pda-trd-action="confirm-reject"
            data-task-id="${escapeHtml(taskId)}"
            ${!state.rejectReason.trim() ? 'disabled' : ''}
          >确认拒单</button>
        </footer>
      </article>
    </div>
  `
}

function renderTaskStyleCard(task: ProcessTask): string {
  const styleSnapshot = getTaskStyleSnapshot(task)

  return `
    <div class="flex items-start gap-3 text-sm">
      <div class="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted">
        ${
          styleSnapshot.spuImageUrl
            ? `<img src="${escapeHtml(styleSnapshot.spuImageUrl)}" alt="SPU ${escapeHtml(styleSnapshot.spuCode)}" class="h-full w-full object-cover" crossorigin="anonymous" />`
            : `
                <div class="flex h-full w-full items-center justify-center">
                  <i data-lucide="package" class="h-6 w-6 text-muted-foreground"></i>
                </div>
              `
        }
      </div>
      <div class="min-w-0 flex-1">
        <div class="mb-0.5 text-xs text-muted-foreground">款式信息 / SPU 缩略图</div>
        <div class="font-mono text-xs font-medium">${escapeHtml(styleSnapshot.spuCode)}</div>
        ${
          styleSnapshot.spuName !== '-'
            ? `<div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(styleSnapshot.spuName)}</div>`
            : ''
        }
        <div class="mt-0.5 text-xs text-muted-foreground">交付日期：${escapeHtml(styleSnapshot.deliveryDate)}</div>
      </div>
    </div>
  `
}

function renderReceiveStatusChips(task: ProcessTask, tab: ReceiveDetailTabKey): string {
  const sceneBadge =
    tab === 'pending-quote'
      ? renderBadge('待报价', 'border-blue-200 bg-blue-50 text-blue-700')
      : tab === 'quoted'
        ? renderBadge('已报价', 'border-slate-200 bg-slate-50 text-slate-700')
        : tab === 'awarded'
          ? renderBadge('已中标', 'border-emerald-200 bg-emerald-50 text-emerald-700')
          : renderBadge('待接单', 'border-amber-200 bg-amber-50 text-amber-700')

  return `
    <div class="flex flex-wrap gap-2">
      ${sceneBadge}
      ${renderBadge(getAssignmentModeLabel(task.assignmentMode), 'border-border bg-muted text-foreground')}
      ${
        task.assignmentStatus
          ? renderBadge(
              task.assignmentStatus === 'ASSIGNED'
                ? '已分配'
                : task.assignmentStatus === 'AWARDED'
                  ? '已中标'
                  : task.assignmentStatus === 'BIDDING'
                    ? '竞价中'
                    : task.assignmentStatus,
              'border-border bg-background text-muted-foreground',
            )
          : ''
      }
      ${
        task.acceptanceStatus
          ? renderBadge(
              task.acceptanceStatus === 'ACCEPTED'
                ? '已接单'
                : task.acceptanceStatus === 'REJECTED'
                  ? '已拒单'
                  : '待接单',
              task.acceptanceStatus === 'ACCEPTED'
                ? 'border-primary/20 bg-primary text-primary-foreground'
                : task.acceptanceStatus === 'REJECTED'
                  ? 'border-destructive/20 bg-destructive text-destructive-foreground'
                  : 'border-border bg-background text-muted-foreground',
            )
          : ''
      }
    </div>
  `
}

function renderReceiveSpecificSection(task: ProcessTask, tab: ReceiveDetailTabKey): string {
  const pricing = getTaskPricing(task)
  const pendingQuoteTender = getPendingQuoteTender(task.taskId)
  const quotedTender = getQuotedTender(task.taskId)
  const acceptDeadline = task.acceptDeadline || ''
  const dispatchedAt = (task as ProcessTask & { dispatchedAt?: string }).dispatchedAt
  const execHref = resolvePdaTaskExecPath(task.taskId, appStore.getState().pathname)
  const deliveryDays = quotedTender?.deliveryDays ? `${quotedTender.deliveryDays} 天` : '-'
  const execStatus =
    task.status === 'DONE'
      ? '已完工'
      : task.status === 'IN_PROGRESS'
        ? '进行中'
        : task.status === 'BLOCKED'
          ? '生产暂停'
          : '待开工'

  if (tab === 'pending-quote' && pendingQuoteTender) {
    return renderSectionCard(
      '招标信息',
      'gavel',
      `
        <div class="grid grid-cols-2 gap-3">
          ${renderField('招标单号', pendingQuoteTender.tenderId)}
          ${renderField('工厂池数量', `${pendingQuoteTender.factoryPoolCount} 家`)}
          ${renderField('竞价截止时间', pendingQuoteTender.biddingDeadline)}
          ${renderField('任务截止时间', pendingQuoteTender.taskDeadline)}
          ${renderField('工序标准价', `${pendingQuoteTender.standardPrice.toLocaleString()} ${pendingQuoteTender.currency}/${pendingQuoteTender.qtyUnit}`)}
          ${renderField('当前报价状态', '待报价')}
        </div>
        <div class="rounded bg-blue-50 px-3 py-2 text-xs text-blue-700">当前仍在招标阶段，确认款式与交付要求后可直接报价。</div>
        <button
          class="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          data-pda-trd-action="open-quote"
          data-tender-id="${escapeHtml(pendingQuoteTender.tenderId)}"
        >立即报价</button>
      `,
    )
  }

  if (tab === 'quoted' && quotedTender) {
    return renderSectionCard(
      '已报价信息',
      'badge-cent',
      `
        <div class="grid grid-cols-2 gap-3">
          ${renderField('招标单号', quotedTender.tenderId)}
          ${renderField('已报价金额', `${quotedTender.quotedPrice.toLocaleString()} ${quotedTender.currency}/${quotedTender.unit}`)}
          ${renderField('报价时间', quotedTender.quotedAt)}
          ${renderField('交付承诺', deliveryDays)}
          ${renderField('竞价截止时间', quotedTender.biddingDeadline)}
          ${renderField('当前报价状态', quotedTender.tenderStatusLabel)}
        </div>
        <div class="rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground">同一招标单内同一工厂只允许报价一次，当前报价记录仅供查看，不支持修改。</div>
      `,
    )
  }

  if (tab === 'awarded') {
    return renderSectionCard(
      '中标信息',
      'award',
      `
        <div class="grid grid-cols-2 gap-3">
          ${renderField('招标单号', task.tenderId || `TENDER-${task.taskId}`)}
          ${
            pricing.directPrice != null
              ? renderField('中标价格', `${pricing.directPrice.toLocaleString()} ${pricing.currency}/${pricing.unit}`)
              : renderField('中标价格', '-')
          }
          ${renderField('平台通知时间', task.awardedAt || task.updatedAt)}
          ${renderField('当前执行状态', execStatus)}
        </div>
        ${
          task.priceDiffReason
            ? `<div class="rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground">中标说明：${escapeHtml(task.priceDiffReason)}</div>`
            : ''
        }
        <button class="inline-flex h-9 w-full items-center justify-center rounded-md border px-3 text-sm hover:bg-muted" data-nav="${escapeHtml(execHref)}">去执行</button>
      `,
    )
  }

  return renderSectionCard(
    '直接派单信息',
    'clipboard-list',
    `
      <div class="grid grid-cols-2 gap-3">
        ${dispatchedAt ? renderField('直接派单时间', dispatchedAt) : ''}
        ${acceptDeadline ? renderField('接单截止时间', acceptDeadline) : ''}
        ${task.taskDeadline ? renderField('任务截止时间', task.taskDeadline) : ''}
        ${renderField('币种 / 单位', `${pricing.currency} / ${pricing.unit}`)}
        ${
          pricing.standardPrice != null
            ? renderField('工序标准价', `${pricing.standardPrice.toLocaleString()} ${pricing.currency}/${pricing.unit}`)
            : ''
        }
        ${
          pricing.directPrice != null
            ? renderField('直接派单价', `${pricing.directPrice.toLocaleString()} ${pricing.currency}/${pricing.unit}`)
            : ''
        }
      </div>
      ${
        pricing.priceStatus
          ? `<div class="text-xs font-medium ${pricing.priceStatusColor}">${escapeHtml(pricing.priceStatus)}</div>`
          : ''
      }
      ${
        task.priceDiffReason
          ? `<div class="rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">价格偏差原因：${escapeHtml(task.priceDiffReason)}</div>`
          : ''
      }
      ${
        task.dispatchRemark
          ? `<div class="rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground">派单备注：${escapeHtml(task.dispatchRemark)}</div>`
          : ''
      }
    `,
  )
}

function renderPdaTaskReceiveCuttingDetailPage(task: PdaReceiveTask): string {
  const factory = task.assignedFactoryId
    ? indonesiaFactories.find((item) => item.id === task.assignedFactoryId)
    : undefined
  const tab = getReceiveDetailTab(task)
  const canOperate =
    (!task.acceptanceStatus || task.acceptanceStatus === 'PENDING') && tab === 'pending-accept'
  const pricing = getTaskPricing(task)
  const styleSnapshot = getTaskStyleSnapshot(task)

  const content = `
    <div class="flex min-h-[760px] flex-col bg-background">
      <header class="sticky top-0 z-30 border-b bg-background px-4 py-3">
        <div class="flex items-center gap-3">
          <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-pda-trd-action="back">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>
          </button>
          <h1 class="text-lg font-semibold">任务详情</h1>
        </div>
      </header>

      <div class="flex-1 space-y-4 p-4 pb-28">
        ${renderCuttingTaskRollupCard(task)}

        <article class="rounded-lg border bg-card">
          <header class="border-b px-4 py-3">
            <h2 class="flex items-center gap-2 text-base font-semibold">
              <i data-lucide="clipboard-check" class="h-4 w-4"></i>
              接单情况
            </h2>
          </header>
          <div class="space-y-3 p-4">
            <div class="grid grid-cols-2 gap-3 text-sm">
              ${renderField('原始任务', getRootTaskDisplayNo(task))}
              ${renderField('当前工厂', factory?.name || task.assignedFactoryName || task.assignedFactoryId || '-')}
              ${renderField('指派方式', getAssignmentModeLabel(task.assignmentMode))}
              ${renderField('接单状态', task.acceptanceStatus === 'ACCEPTED' ? '已接单' : task.acceptanceStatus === 'REJECTED' ? '已拒单' : '待接单')}
              ${renderField('数量', `${task.qty} ${task.qtyUnit}`)}
              ${renderField('任务截止', task.taskDeadline || '-')}
              ${
                pricing.directPrice != null
                  ? renderField('当前价格', `${pricing.directPrice.toLocaleString()} ${pricing.currency}/${pricing.unit}`)
                  : renderField('当前价格', '-')
              }
              ${renderField('价格说明', pricing.priceStatus || '按当前派单执行')}
            </div>
            ${renderTaskStyleCard(task)}
            ${renderReceiveStatusChips(task, tab)}
          </div>
        </article>

        ${renderCuttingTaskActionCard(task)}

        <article class="rounded-lg border bg-card">
          <header class="border-b px-4 py-3">
            <h2 class="flex items-center gap-2 text-base font-semibold">
              <i data-lucide="factory" class="h-4 w-4"></i>
              ${escapeHtml(tab === 'pending-quote' || tab === 'quoted' ? '当前查看工厂' : '承接工厂')}
            </h2>
          </header>
          <div class="p-4 text-sm">
            <div class="font-medium">${escapeHtml(factory?.name || task.assignedFactoryName || task.assignedFactoryId || '-')}</div>
            ${
              factory
                ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(factory.city)}, ${escapeHtml(factory.province)}</div>`
                : ''
            }
          </div>
        </article>

        <article class="rounded-lg border bg-card">
          <header class="border-b px-4 py-3">
            <h2 class="flex items-center gap-2 text-base font-semibold">
              <i data-lucide="clock" class="h-4 w-4"></i>
              最近动作
            </h2>
          </header>
          <div class="p-4">
            ${
              !task.auditLogs || task.auditLogs.length === 0
                ? '<p class="text-sm text-muted-foreground">暂无日志</p>'
                : `
                    <div class="space-y-2">
                      ${[...task.auditLogs]
                        .reverse()
                        .slice(0, 10)
                        .map(
                          (log) => `
                            <article class="border-l-2 border-muted py-1 pl-3 text-sm">
                              <div class="flex items-center gap-2">
                                <span class="inline-flex items-center rounded border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">${escapeHtml(log.action)}</span>
                                <span class="text-xs text-muted-foreground">${escapeHtml(log.at)}</span>
                              </div>
                              <div class="mt-0.5 text-muted-foreground">${escapeHtml(log.detail)}</div>
                              <div class="text-xs text-muted-foreground">操作人: ${escapeHtml(log.by)}</div>
                            </article>
                          `,
                        )
                        .join('')}
                    </div>
                  `
            }
          </div>
        </article>
      </div>

      ${
        canOperate
          ? `
              <div class="absolute bottom-[72px] left-0 right-0 border-t bg-background px-4 py-3">
                <div class="flex gap-3">
                  <button
                    class="inline-flex h-9 flex-1 items-center justify-center rounded-md border px-3 text-sm hover:bg-muted"
                    data-pda-trd-action="open-reject"
                  >
                    <i data-lucide="x-circle" class="mr-1.5 h-4 w-4"></i>
                    拒单
                  </button>
                  <button
                    class="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    data-pda-trd-action="accept"
                    data-task-id="${escapeHtml(task.taskId)}"
                  >
                    <i data-lucide="check-circle" class="mr-1.5 h-4 w-4"></i>
                    接单
                  </button>
                </div>
              </div>
            `
          : ''
      }

      ${renderRejectDialog(task.taskId)}
    </div>
  `

  return renderPdaFrame(content, 'task-receive')
}

export function renderPdaTaskReceiveDetailPage(taskId: string): string {
  const task = getTaskFactById(taskId)

  if (isCuttingSpecialTask(task)) {
    return renderPdaTaskReceiveCuttingDetailPage(task as PdaReceiveTask)
  }

  if (!task) {
    const content = `
      <div class="flex min-h-[760px] flex-col bg-background">
        <header class="sticky top-0 z-30 border-b bg-background px-4 py-3">
          <button class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground" data-pda-trd-action="back">
            <i data-lucide="arrow-left" class="mr-1.5 h-4 w-4"></i>
            返回
          </button>
        </header>

        <div class="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">未找到任务</div>
      </div>
    `

    return renderPdaFrame(content, 'task-receive')
  }

  const factory = task.assignedFactoryId
    ? indonesiaFactories.find((item) => item.id === task.assignedFactoryId)
    : undefined

  const styleSnapshot = getTaskStyleSnapshot(task)
  const stageLabel = getTaskStageDisplayName(task)
  const displayProcessName = getTaskProcessDisplayName(task)
  const tab = getReceiveDetailTab(task)
  const canOperate = (!task.acceptanceStatus || task.acceptanceStatus === 'PENDING') && tab === 'pending-accept'

  const content = `
    <div class="flex min-h-[760px] flex-col bg-background">
      <header class="sticky top-0 z-30 border-b bg-background px-4 py-3">
        <div class="flex items-center gap-3">
          <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-pda-trd-action="back">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>
          </button>
          <h1 class="text-lg font-semibold">任务详情</h1>
        </div>
      </header>

      <div class="flex-1 space-y-4 p-4 pb-28">
        <article class="rounded-lg border bg-card">
          <header class="border-b px-4 py-3">
            <h2 class="flex items-center gap-2 text-base font-semibold">
              <i data-lucide="clipboard-list" class="h-4 w-4"></i>
              ${escapeHtml(getTaskDisplayNo(task))}
            </h2>
          </header>

          <div class="space-y-3 p-4">
            <div class="grid grid-cols-2 gap-3 text-sm">
              ${renderField('原始任务', getRootTaskDisplayNo(task))}
              ${renderField('生产单号', getTaskProductionOrderNo(task))}
              ${renderField('工序序号', String(task.seq))}
              ${renderField('工序名称', displayProcessName)}
              ${renderField('工序编码', task.processBusinessCode || task.processCode)}
              ${renderField('阶段', stageLabel)}
              ${renderField('数量', `${task.qty} ${task.qtyUnit}`)}
              ${renderField('拆分组', task.splitGroupId || '未拆分')}
            </div>

            <div class="h-px bg-border"></div>

            <div class="flex items-start gap-3 text-sm">
              <div class="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted">
                ${
                  styleSnapshot.spuImageUrl
                    ? `<img src="${escapeHtml(styleSnapshot.spuImageUrl)}" alt="SPU ${escapeHtml(styleSnapshot.spuCode)}" class="h-full w-full object-cover" crossorigin="anonymous" />`
                    : `
                        <div class="flex h-full w-full items-center justify-center">
                          <i data-lucide="package" class="h-6 w-6 text-muted-foreground"></i>
                        </div>
                      `
                }
              </div>
              <div class="min-w-0 flex-1">
                <div class="mb-0.5 text-xs text-muted-foreground">款式信息 / SPU 缩略图</div>
                <div class="font-mono text-xs font-medium">${escapeHtml(styleSnapshot.spuCode)}</div>
                ${
                  styleSnapshot.spuName !== '-'
                    ? `<div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(styleSnapshot.spuName)}</div>`
                    : ''
                }
                <div class="mt-0.5 text-xs text-muted-foreground">交付日期：${escapeHtml(styleSnapshot.deliveryDate)}</div>
              </div>
            </div>

            <div class="h-px bg-border"></div>

            <div class="flex flex-wrap gap-2">
              ${renderBadge(getAssignmentModeLabel(task.assignmentMode), 'border-border bg-muted text-foreground')}
              ${renderBadge(task.assignmentStatus === 'ASSIGNED' ? '已分配' : task.assignmentStatus, 'border-border bg-background text-muted-foreground')}
              ${
                task.acceptanceStatus
                  ? renderBadge(
                      task.acceptanceStatus === 'ACCEPTED'
                        ? '已接单'
                        : task.acceptanceStatus === 'REJECTED'
                          ? '已拒单'
                          : '待接单',
                      task.acceptanceStatus === 'ACCEPTED'
                        ? 'border-primary/20 bg-primary text-primary-foreground'
                        : task.acceptanceStatus === 'REJECTED'
                          ? 'border-destructive/20 bg-destructive text-destructive-foreground'
                          : 'border-border bg-background text-muted-foreground',
                    )
                  : ''
              }
            </div>
          </div>
        </article>

        ${renderReceiveSpecificSection(task, tab)}

        <article class="rounded-lg border bg-card">
          <header class="border-b px-4 py-3">
            <h2 class="flex items-center gap-2 text-base font-semibold">
              <i data-lucide="factory" class="h-4 w-4"></i>
              承接工厂
            </h2>
          </header>
          <div class="p-4 text-sm">
            <div class="font-medium">${escapeHtml(factory?.name || task.assignedFactoryId || '-')}</div>
            ${
              factory
                ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(factory.city)}, ${escapeHtml(factory.province)}</div>`
                : ''
            }
          </div>
        </article>

        <article class="rounded-lg border bg-card">
          <header class="border-b px-4 py-3">
            <h2 class="flex items-center gap-2 text-base font-semibold">
              <i data-lucide="clock" class="h-4 w-4"></i>
              操作日志
            </h2>
          </header>

          <div class="p-4">
            ${
              !task.auditLogs || task.auditLogs.length === 0
                ? '<p class="text-sm text-muted-foreground">暂无日志</p>'
                : `
                    <div class="space-y-2">
                      ${[...task.auditLogs]
                        .reverse()
                        .slice(0, 10)
                        .map(
                          (log) => `
                            <article class="border-l-2 border-muted py-1 pl-3 text-sm">
                              <div class="flex items-center gap-2">
                                <span class="inline-flex items-center rounded border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">${escapeHtml(log.action)}</span>
                                <span class="text-xs text-muted-foreground">${escapeHtml(log.at)}</span>
                              </div>
                              <div class="mt-0.5 text-muted-foreground">${escapeHtml(log.detail)}</div>
                              <div class="text-xs text-muted-foreground">操作人: ${escapeHtml(log.by)}</div>
                            </article>
                          `,
                        )
                        .join('')}
                    </div>
                  `
            }
          </div>
        </article>
      </div>

      ${
        canOperate
          ? `
              <div class="absolute bottom-[72px] left-0 right-0 border-t bg-background px-4 py-3">
                <div class="flex gap-3">
                  <button
                    class="inline-flex h-9 flex-1 items-center justify-center rounded-md border px-3 text-sm hover:bg-muted"
                    data-pda-trd-action="open-reject"
                  >
                    <i data-lucide="x-circle" class="mr-1.5 h-4 w-4"></i>
                    拒单
                  </button>
                  <button
                    class="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    data-pda-trd-action="accept"
                    data-task-id="${escapeHtml(task.taskId)}"
                  >
                    <i data-lucide="check-circle" class="mr-1.5 h-4 w-4"></i>
                    接单
                  </button>
                </div>
              </div>
            `
          : ''
      }

      ${renderRejectDialog(task.taskId)}
    </div>
  `

  return renderPdaFrame(content, 'task-receive')
}

export function handlePdaTaskReceiveDetailEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pda-trd-field]')
  if (fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.pdaTrdField
    if (field === 'rejectReason') {
      state.rejectReason = fieldNode.value
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-trd-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaTrdAction
  if (!action) return false

  if (action === 'back') {
    appStore.navigate(resolveReceiveBackHref())
    return true
  }

  if (action === 'open-quote') {
    const tenderId = actionNode.dataset.tenderId
    if (!tenderId) return true
    appStore.navigate(buildReceiveQuotePath(tenderId))
    return true
  }

  if (action === 'open-reject') {
    state.rejectDialogOpen = true
    state.rejectReason = ''
    return true
  }

  if (action === 'close-reject') {
    state.rejectDialogOpen = false
    state.rejectReason = ''
    return true
  }

  if (action === 'accept') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    const factoryName = getFactoryName(getCurrentFactoryId())
    mutateAcceptTask(taskId, factoryName)
    showTaskReceiveDetailToast('接单成功')
    state.rejectDialogOpen = false
    state.rejectReason = ''
    appStore.navigate(resolveReceiveBackHref())
    return true
  }

  if (action === 'confirm-reject') {
    const taskId = actionNode.dataset.taskId
    if (!taskId || !state.rejectReason.trim()) return true

    const factoryName = getFactoryName(getCurrentFactoryId())
    mutateRejectTask(taskId, state.rejectReason.trim(), factoryName)
    showTaskReceiveDetailToast('已拒绝接单')
    state.rejectDialogOpen = false
    state.rejectReason = ''
    appStore.navigate(resolveReceiveBackHref())
    return true
  }

  return false
}
