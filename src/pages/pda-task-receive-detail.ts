import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { type ProcessTask } from '../data/fcs/process-tasks'
import { productionOrders } from '../data/fcs/production-orders'
import { indonesiaFactories } from '../data/fcs/indonesia-factories'
import {
  getTaskProcessDisplayName,
  getTaskStageDisplayName,
} from '../data/fcs/page-adapters/task-execution-adapter'
import {
  getPdaTaskFlowTaskById,
  isCuttingSpecialTask,
  listPdaTaskFlowTasks,
} from '../data/fcs/pda-cutting-special'
import { renderPdaCuttingTaskDetailPage } from './pda-cutting-task-detail'
import { renderPdaFrame } from './pda-shell'

interface TaskReceiveDetailState {
  rejectDialogOpen: boolean
  rejectReason: string
}

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

export function renderPdaTaskReceiveDetailPage(taskId: string): string {
  const task = getTaskFactById(taskId)

  if (isCuttingSpecialTask(task)) {
    return renderPdaCuttingTaskDetailPage(taskId)
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

  const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)
  const factory = task.assignedFactoryId
    ? indonesiaFactories.find((item) => item.id === task.assignedFactoryId)
    : undefined

  const spuCode = order?.demandSnapshot?.spuCode || '-'
  const spuName = order?.demandSnapshot?.spuName || '-'
  const deliveryDate = order?.demandSnapshot?.requiredDeliveryDate || '-'
  const stageLabel = getTaskStageDisplayName(task)
  const displayProcessName = getTaskProcessDisplayName(task)
  const spuImageUrl = (task as ProcessTask & { spuImageUrl?: string }).spuImageUrl
  const dispatchedAt = (task as ProcessTask & { dispatchedAt?: string }).dispatchedAt

  const pricing = getTaskPricing(task)
  const acceptDeadline = task.acceptDeadline || ''

  const deadlineStatus = (() => {
    if (!acceptDeadline) return null
    const diff = new Date(acceptDeadline.replace(' ', 'T')).getTime() - Date.now()
    const hours = diff / 3600000
    if (diff < 0) return { label: '接单逾期', color: 'text-destructive' }
    if (hours < 4) return { label: '即将逾期', color: 'text-amber-600' }
    return { label: '正常', color: 'text-muted-foreground' }
  })()

  const canOperate = !task.acceptanceStatus || task.acceptanceStatus === 'PENDING'

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
              ${renderField('生产单号', task.productionOrderId)}
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
                  spuImageUrl
                    ? `<img src="${escapeHtml(spuImageUrl)}" alt="SPU ${escapeHtml(spuCode)}" class="h-full w-full object-cover" crossorigin="anonymous" />`
                    : `
                        <div class="flex h-full w-full items-center justify-center">
                          <i data-lucide="package" class="h-6 w-6 text-muted-foreground"></i>
                        </div>
                      `
                }
              </div>
              <div class="min-w-0 flex-1">
                <div class="mb-0.5 text-xs text-muted-foreground">款式信息 / SPU 缩略图</div>
                <div class="font-mono text-xs font-medium">${escapeHtml(spuCode)}</div>
                ${
                  spuName !== '-'
                    ? `<div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(spuName)}</div>`
                    : ''
                }
                <div class="mt-0.5 text-xs text-muted-foreground">交付日期：${escapeHtml(deliveryDate)}</div>
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

        <article class="rounded-lg border bg-card">
          <header class="border-b px-4 py-3">
            <h2 class="flex items-center gap-2 text-base font-semibold">
              <i data-lucide="clipboard-list" class="h-4 w-4"></i>
              直接派单信息
            </h2>
          </header>

          <div class="space-y-3 p-4 text-sm">
            <div class="grid grid-cols-2 gap-3">
              ${dispatchedAt ? renderField('直接派单时间', dispatchedAt) : ''}
              ${
                acceptDeadline
                  ? `
                      <div>
                        <span class="text-muted-foreground">接单截止时间:</span>
                        <div class="font-medium">${escapeHtml(acceptDeadline)}</div>
                        ${
                          deadlineStatus
                            ? `<div class="mt-0.5 text-xs font-medium ${deadlineStatus.color}">${escapeHtml(deadlineStatus.label)}</div>`
                            : ''
                        }
                      </div>
                    `
                  : ''
              }
              ${
                (task as ProcessTask & { taskDeadline?: string }).taskDeadline
                  ? renderField('任务截止时间', (task as ProcessTask & { taskDeadline?: string }).taskDeadline || '-')
                  : ''
              }
              ${renderField('币种 / 单位', `${pricing.currency} / ${pricing.unit}`)}
              ${
                pricing.standardPrice != null
                  ? renderField('工序标准价', `${pricing.standardPrice.toLocaleString()} ${pricing.currency}/${pricing.unit}`)
                  : ''
              }
              ${
                pricing.directPrice != null
                  ? `
                      <div>
                        <span class="text-muted-foreground">直接派单价:</span>
                        <div class="font-medium text-primary">${pricing.directPrice.toLocaleString()} ${escapeHtml(pricing.currency)}/${escapeHtml(pricing.unit)}</div>
                        ${
                          pricing.priceStatus
                            ? `<div class="mt-0.5 text-xs font-medium ${pricing.priceStatusColor}">${escapeHtml(pricing.priceStatus)}</div>`
                            : ''
                        }
                      </div>
                    `
                  : ''
              }
            </div>

            ${
              task.priceDiffReason
                ? `
                    <div class="h-px bg-border"></div>
                    <div class="text-sm">
                      <span class="text-muted-foreground">价格偏差原因:</span>
                      <div class="mt-1 rounded bg-amber-50 p-2 text-xs text-amber-700">${escapeHtml(task.priceDiffReason)}</div>
                    </div>
                  `
                : ''
            }

            ${
              task.dispatchRemark
                ? `
                    <div class="h-px bg-border"></div>
                    <div class="text-sm">
                      <span class="text-muted-foreground">派单备注:</span>
                      <div class="mt-1 rounded bg-muted/50 p-2 text-xs">${escapeHtml(task.dispatchRemark)}</div>
                    </div>
                  `
                : ''
            }
          </div>
        </article>

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
    appStore.navigate('/fcs/pda/task-receive')
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
    appStore.navigate('/fcs/pda/task-receive')
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
    appStore.navigate('/fcs/pda/task-receive')
    return true
  }

  return false
}
