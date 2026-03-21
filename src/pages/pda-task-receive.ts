import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import { type ProcessTask } from '../data/fcs/process-tasks'
import { indonesiaFactories } from '../data/fcs/indonesia-factories'
import {
  getTaskProcessDisplayName,
} from '../data/fcs/page-adapters/task-execution-adapter'
import {
  getTaskChainTaskById,
  listTaskChainTasks,
  listTaskChainTenders,
  resolveTaskChainTenderId,
  type TaskChainTenderStatus,
} from '../data/fcs/page-adapters/task-chain-pages-adapter'
import { renderPdaFrame } from './pda-shell'

type TabKey = 'pending-accept' | 'pending-quote' | 'quoted' | 'awarded'

type DeadlineBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

interface BiddingTender {
  tenderId: string
  taskId: string
  productionOrderId: string
  processName: string
  qty: number
  qtyUnit: string
  factoryPoolCount: number
  biddingDeadline: string
  taskDeadline: string
  standardPrice: number
  currency: string
}

interface QuotedTender {
  tenderId: string
  taskId: string
  productionOrderId: string
  processName: string
  qty: number
  qtyUnit: string
  quotedPrice: number
  quotedAt: string
  deliveryDays: number
  tenderStatus: string
  currency: string
  unit: string
  biddingDeadline: string
  taskDeadline: string
  remark: string
}

interface AwardedTender {
  tenderId: string
  taskId: string
  productionOrderId: string
  processName: string
  qty: number
  qtyUnit: string
  awardedPrice: number
  currency: string
  unit: string
  taskDeadline: string
  notifiedAt: string
  awardNote: string
  execStatus: string
}

interface SubmittedQuoteSnapshot {
  quotedPrice: number
  quotedAt: string
  deliveryDays: number
  remark: string
}

interface TaskReceiveState {
  selectedFactoryId: string
  activeTab: TabKey
  keyword: string
  processFilter: string
  deadlineFilter: string
  quoteDialogOpen: boolean
  quotingTenderId: string | null
  quoteAmount: string
  deliveryDays: string
  quoteRemark: string
  submittingQuote: boolean
  submittedTenderIds: Set<string>
  rejectDialogOpen: boolean
  rejectingTaskId: string
  rejectReason: string
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'pending-accept', label: '待接单任务' },
  { key: 'pending-quote', label: '待报价招标单' },
  { key: 'quoted', label: '已报价招标单' },
  { key: 'awarded', label: '已中标任务' },
]

const state: TaskReceiveState = {
  selectedFactoryId: '',
  activeTab: 'pending-accept',
  keyword: '',
  processFilter: 'ALL',
  deadlineFilter: 'ALL',
  quoteDialogOpen: false,
  quotingTenderId: null,
  quoteAmount: '',
  deliveryDays: '',
  quoteRemark: '',
  submittingQuote: false,
  submittedTenderIds: new Set<string>(),
  rejectDialogOpen: false,
  rejectingTaskId: '',
  rejectReason: '',
}

const submittedQuotes = new Map<string, SubmittedQuoteSnapshot>()

function listTaskFacts(): ProcessTask[] {
  return listTaskChainTasks()
}

function getTaskFactById(taskId: string): ProcessTask | null {
  return getTaskChainTaskById(taskId) ?? null
}

function getTaskDisplayNo(task: ProcessTask | null): string {
  if (!task) return '-'
  return task.taskNo || task.taskId
}

function getTaskRootNo(task: ProcessTask | null): string {
  if (!task) return '-'
  return task.rootTaskNo || task.taskNo || task.taskId
}

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return query || ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

function syncTabWithQuery(): void {
  const tab = getCurrentSearchParams().get('tab')
  if (!tab) {
    state.activeTab = 'pending-accept'
    return
  }
  if (TABS.some((item) => item.key === tab)) {
    state.activeTab = tab as TabKey
  }
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function parseDateMs(value: string): number {
  return new Date(value.replace(' ', 'T')).getTime()
}

function getCurrentFactoryId(): string {
  if (state.selectedFactoryId) return state.selectedFactoryId
  if (typeof window === 'undefined') return 'ID-F001'

  try {
    const localFactoryId = window.localStorage.getItem('fcs_pda_factory_id')
    if (localFactoryId) {
      state.selectedFactoryId = localFactoryId
      return localFactoryId
    }

    const rawSession = window.localStorage.getItem('fcs_pda_session')
    if (rawSession) {
      const parsed = JSON.parse(rawSession) as { factoryId?: string }
      if (parsed.factoryId) {
        state.selectedFactoryId = parsed.factoryId
        return parsed.factoryId
      }
    }
  } catch {
    // ignore parsing errors
  }

  state.selectedFactoryId = 'ID-F001'
  return state.selectedFactoryId
}

function getFactoryName(factoryId: string): string {
  const factory = indonesiaFactories.find((item) => item.id === factoryId)
  return factory?.name ?? factoryId
}

function getDeadlineStatus(deadline: string): { label: string; variant: DeadlineBadgeVariant } {
  if (!deadline) return { label: '正常', variant: 'secondary' }
  const diff = parseDateMs(deadline) - Date.now()
  const hours = diff / 3600000
  if (diff < 0) return { label: '接单逾期', variant: 'destructive' }
  if (hours < 4) return { label: '即将逾期', variant: 'default' }
  return { label: '正常', variant: 'secondary' }
}

function getDeadlineBadgeClass(variant: DeadlineBadgeVariant): string {
  if (variant === 'destructive') return 'bg-destructive text-destructive-foreground border-destructive/20'
  if (variant === 'default') return 'bg-primary text-primary-foreground border-primary/20'
  if (variant === 'outline') return 'bg-background text-foreground border-border'
  return 'bg-muted text-muted-foreground border-border'
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

function showTaskReceiveToast(message: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'pda-task-receive-toast-root'
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

function getTabCounts(
  pendingAcceptTasks: ProcessTask[],
  activeBiddingTenders: BiddingTender[],
  quotedTenders: QuotedTender[],
  awardedTenders: AwardedTender[],
): Record<TabKey, number> {
  return {
    'pending-accept': pendingAcceptTasks.length,
    'pending-quote': activeBiddingTenders.length,
    quoted: quotedTenders.length,
    awarded: awardedTenders.length,
  }
}

function toTenderStatusLabel(status: TaskChainTenderStatus): string {
  if (status === 'OVERDUE') return '已逾期'
  if (status === 'AWARDED') return '已定标'
  if (status === 'CLOSED') return '已关闭'
  if (status === 'CANCELLED') return '已取消'
  return '招标中'
}

function getQuotedTenders(): QuotedTender[] {
  return listTaskChainTenders()
    .filter((tender) => state.submittedTenderIds.has(tender.tenderId))
    .map((tender) => {
      const taskId = tender.taskIds[0] ?? ''
      const task = taskId ? getTaskFactById(taskId) : null
      const snapshot = submittedQuotes.get(tender.tenderId)
      const qtyUnit = task?.qtyUnit || '件'
      const currency = task?.standardPriceCurrency || task?.dispatchPriceCurrency || 'CNY'

      return {
        tenderId: tender.tenderId,
        taskId,
        productionOrderId: task?.productionOrderId || tender.productionOrderIds[0] || '',
        processName: task ? getTaskProcessDisplayName(task) : '-',
        qty: task?.qty ?? 0,
        qtyUnit,
        quotedPrice: snapshot?.quotedPrice ?? task?.dispatchPrice ?? task?.standardPrice ?? 0,
        quotedAt: snapshot?.quotedAt ?? nowTimestamp(),
        deliveryDays: snapshot?.deliveryDays ?? 0,
        tenderStatus: toTenderStatusLabel(tender.status),
        currency,
        unit: qtyUnit,
        biddingDeadline: tender.deadline,
        taskDeadline: task?.taskDeadline || '',
        remark: snapshot?.remark ?? '',
      } satisfies QuotedTender
    })
    .sort((left, right) => right.quotedAt.localeCompare(left.quotedAt))
}

function getActiveBiddingTenders(): BiddingTender[] {
  return listTaskChainTenders()
    .filter((tender) => tender.status === 'OPEN' || tender.status === 'OVERDUE')
    .filter((tender) => !state.submittedTenderIds.has(tender.tenderId))
    .map((tender) => {
      const taskId = tender.taskIds[0] ?? ''
      const task = taskId ? getTaskFactById(taskId) : null
      const qtyUnit = task?.qtyUnit || '件'
      const processName = task ? getTaskProcessDisplayName(task) : '-'

      return {
        tenderId: tender.tenderId,
        taskId,
        productionOrderId: task?.productionOrderId || tender.productionOrderIds[0] || '',
        processName,
        qty: task?.qty ?? 0,
        qtyUnit,
        factoryPoolCount: Math.max(tender.taskIds.length, 1),
        biddingDeadline: tender.deadline,
        taskDeadline: task?.taskDeadline || '',
        standardPrice: task?.standardPrice ?? 0,
        currency: task?.standardPriceCurrency || task?.dispatchPriceCurrency || 'CNY',
      } satisfies BiddingTender
    })
    .sort((left, right) => left.biddingDeadline.localeCompare(right.biddingDeadline))
}

function getAwardedTenders(selectedFactoryId: string): AwardedTender[] {
  return listTaskFacts()
    .filter(
      (task) =>
        task.assignmentMode === 'BIDDING'
        && task.assignmentStatus === 'AWARDED'
        && task.assignedFactoryId === selectedFactoryId,
    )
    .map((task) => ({
      tenderId: resolveTaskChainTenderId(task) || `TENDER-${task.taskId}`,
      taskId: task.taskId,
      productionOrderId: task.productionOrderId,
      processName: getTaskProcessDisplayName(task),
      qty: task.qty,
      qtyUnit: task.qtyUnit,
      awardedPrice: task.dispatchPrice ?? task.standardPrice ?? 0,
      currency: task.dispatchPriceCurrency || task.standardPriceCurrency || 'CNY',
      unit: task.dispatchPriceUnit || task.standardPriceUnit || task.qtyUnit || '件',
      taskDeadline: task.taskDeadline || '',
      notifiedAt: task.awardedAt || task.updatedAt || task.createdAt,
      awardNote: task.priceDiffReason || '',
      execStatus: task.status === 'NOT_STARTED' ? '待开工' : task.status === 'IN_PROGRESS' ? '进行中' : '已完工',
    }))
    .sort((left, right) => right.notifiedAt.localeCompare(left.notifiedAt))
}

function getPendingAcceptTasks(selectedFactoryId: string): ProcessTask[] {
  return listTaskFacts().filter(
    (task) =>
      task.assignedFactoryId === selectedFactoryId &&
      task.assignmentMode === 'DIRECT' &&
      (!task.acceptanceStatus || task.acceptanceStatus === 'PENDING'),
  )
}

function getFilteredPendingTasks(pendingAcceptTasks: ProcessTask[]): ProcessTask[] {
  return pendingAcceptTasks.filter((task) => {
    const keyword = state.keyword.trim()
    const displayProcessName = getTaskProcessDisplayName(task)
    if (
      keyword &&
      !task.taskId.includes(keyword) &&
      !(task.taskNo || '').includes(keyword) &&
      !task.productionOrderId.includes(keyword) &&
      !displayProcessName.includes(keyword)
    ) {
      return false
    }

    if (state.processFilter !== 'ALL' && displayProcessName !== state.processFilter) {
      return false
    }

    return true
  })
}

function renderFieldRow(label: string, value: string, highlight = false): string {
  return `
    <div>
      <span class="text-muted-foreground">${escapeHtml(label)}：</span>
      <span class="${highlight ? 'font-medium text-primary' : 'font-medium'}">${escapeHtml(value)}</span>
    </div>
  `
}

function renderEmptyState(label: string): string {
  return `
    <div class="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <i data-lucide="clipboard-list" class="mb-3 h-12 w-12 opacity-30"></i>
      <p class="text-sm">${escapeHtml(label)}</p>
    </div>
  `
}

function renderPendingAcceptTask(task: ProcessTask, factoryName: string): string {
  const displayProcessName = getTaskProcessDisplayName(task)
  const deadlineStatus = getDeadlineStatus(task.acceptDeadline || '')
  const pricing = getTaskPricing(task)
  const dispatchedAt = (task as ProcessTask & { dispatchedAt?: string }).dispatchedAt

  return `
    <article class="overflow-hidden rounded-lg border bg-card">
      <div class="space-y-2 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-mono text-sm font-semibold">${escapeHtml(getTaskDisplayNo(task))}</span>
          <span class="inline-flex shrink-0 items-center rounded border px-1.5 text-[10px] ${toClassName(
            getDeadlineBadgeClass(deadlineStatus.variant),
            deadlineStatus.label === '即将逾期' ? 'bg-amber-500 text-white border-amber-500' : '',
          )}">${escapeHtml(deadlineStatus.label)}</span>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          ${renderFieldRow('原始任务', getTaskRootNo(task))}
          ${renderFieldRow('生产单号', task.productionOrderId)}
          ${renderFieldRow('工序', displayProcessName)}
          ${renderFieldRow('数量', `${task.qty} ${pricing.unit}`)}
          ${renderFieldRow('拆分组', task.splitGroupId || '未拆分')}
          ${dispatchedAt ? renderFieldRow('直接派单时间', dispatchedAt) : ''}
          ${task.acceptDeadline ? renderFieldRow('接单截止', task.acceptDeadline) : ''}
          ${(task as ProcessTask & { taskDeadline?: string }).taskDeadline ? renderFieldRow('任务截止', (task as ProcessTask & { taskDeadline?: string }).taskDeadline || '') : ''}
          ${pricing.standardPrice != null ? renderFieldRow('工序标准价', `${pricing.standardPrice.toLocaleString()} ${pricing.currency}/${pricing.unit}`) : ''}
          ${pricing.directPrice != null ? renderFieldRow('直接派单价', `${pricing.directPrice.toLocaleString()} ${pricing.currency}/${pricing.unit}`, true) : ''}
          ${
            pricing.priceStatus
              ? `<div class="col-span-2"><span class="text-xs font-medium ${pricing.priceStatusColor}">${escapeHtml(
                  pricing.priceStatus,
                )}</span></div>`
              : ''
          }
        </div>

        ${
          task.dispatchRemark
            ? `<p class="rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">派单备注：${escapeHtml(task.dispatchRemark)}</p>`
            : ''
        }
      </div>

      <div class="border-t px-3 py-2">
        <div class="flex items-center gap-2">
          <button
            class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
            data-pda-tr-action="open-detail"
            data-task-id="${escapeHtml(task.taskId)}"
          >查看详情</button>

          <button
            class="inline-flex h-8 items-center rounded-md border border-destructive/20 bg-destructive px-3 text-xs text-destructive-foreground hover:opacity-90"
            data-pda-tr-action="open-reject"
            data-task-id="${escapeHtml(task.taskId)}"
          >拒单</button>

          <button
            class="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            data-pda-tr-action="accept-task"
            data-task-id="${escapeHtml(task.taskId)}"
            data-factory-name="${escapeHtml(factoryName)}"
          >接单</button>
        </div>
      </div>
    </article>
  `
}

function renderPendingQuoteItem(tender: BiddingTender): string {
  const task = getTaskFactById(tender.taskId)
  const processName = task ? getTaskProcessDisplayName(task) : tender.processName
  return `
    <article class="overflow-hidden rounded-lg border bg-card">
      <div class="space-y-2 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-mono text-sm font-semibold">${escapeHtml(tender.tenderId)}</span>
          <span class="inline-flex items-center rounded border border-blue-200 bg-blue-500 px-1.5 text-[10px] text-white">招标中</span>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          ${renderFieldRow('任务编号', getTaskDisplayNo(task))}
          ${renderFieldRow('原始任务', getTaskRootNo(task))}
          ${renderFieldRow('生产单号', tender.productionOrderId)}
          ${renderFieldRow('工序', processName)}
          ${renderFieldRow('数量', `${tender.qty} ${tender.qtyUnit}`)}
          ${renderFieldRow('工厂池', `${tender.factoryPoolCount} 家`)}
          ${renderFieldRow('竞价截止', tender.biddingDeadline)}
          ${renderFieldRow('任务截止', tender.taskDeadline)}
          ${renderFieldRow('工序标准价', `${tender.standardPrice.toLocaleString()} ${tender.currency}/${tender.qtyUnit}`)}
        </div>
      </div>

      <div class="border-t px-3 py-2">
        <button
          class="inline-flex h-8 w-full items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          data-pda-tr-action="open-quote"
          data-tender-id="${escapeHtml(tender.tenderId)}"
        >立即报价</button>
      </div>
    </article>
  `
}

function renderQuotedItem(tender: QuotedTender): string {
  const task = getTaskFactById(tender.taskId)
  const processName = task ? getTaskProcessDisplayName(task) : tender.processName
  return `
    <article class="rounded-lg border bg-card">
      <div class="space-y-2 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-mono text-sm font-semibold">${escapeHtml(tender.tenderId)}</span>
          <span class="inline-flex items-center rounded border border-border bg-background px-1.5 text-[10px] text-muted-foreground">${escapeHtml(tender.tenderStatus)}</span>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          ${renderFieldRow('任务编号', getTaskDisplayNo(task))}
          ${renderFieldRow('原始任务', getTaskRootNo(task))}
          ${renderFieldRow('生产单号', tender.productionOrderId)}
          ${renderFieldRow('工序', processName)}
          ${renderFieldRow('数量', `${tender.qty} ${tender.unit}`)}
          ${renderFieldRow('报价金额', `${tender.quotedPrice.toLocaleString()} ${tender.currency}/${tender.unit}`, true)}
          ${renderFieldRow('报价时间', tender.quotedAt)}
          ${tender.deliveryDays ? renderFieldRow('交付承诺', `${tender.deliveryDays} 天`) : ''}
          ${renderFieldRow('竞价截止', tender.biddingDeadline)}
          ${renderFieldRow('任务截止', tender.taskDeadline)}
        </div>
      </div>
    </article>
  `
}

function renderAwardedItem(item: AwardedTender): string {
  const task = getTaskFactById(item.taskId)
  const processName = task ? getTaskProcessDisplayName(task) : item.processName
  return `
    <article class="overflow-hidden rounded-lg border border-green-200 bg-card">
      <div class="space-y-2 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-mono text-sm font-semibold">${escapeHtml(item.tenderId)}</span>
          <div class="flex shrink-0 items-center gap-1">
            ${
              item.execStatus
                ? `<span class="inline-flex items-center rounded border border-border bg-background px-1.5 text-[10px] text-muted-foreground">${escapeHtml(item.execStatus)}</span>`
                : ''
            }
            <span class="inline-flex items-center rounded border border-green-600 bg-green-600 px-1.5 text-[10px] text-white">已中标</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          ${renderFieldRow('任务编号', getTaskDisplayNo(task))}
          ${renderFieldRow('原始任务', getTaskRootNo(task))}
          ${renderFieldRow('生产单号', item.productionOrderId)}
          ${renderFieldRow('工序', processName)}
          ${renderFieldRow('数量', `${item.qty} ${item.unit}`)}
          ${renderFieldRow('中标价格', `${item.awardedPrice.toLocaleString()} ${item.currency}/${item.unit}`, true)}
          ${renderFieldRow('任务截止', item.taskDeadline)}
          ${renderFieldRow('平台通知时间', item.notifiedAt)}
        </div>

        ${
          item.awardNote
            ? `<p class="rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">中标说明：${escapeHtml(item.awardNote)}</p>`
            : ''
        }
      </div>

      <div class="border-t px-3 py-2">
        <div class="flex items-center gap-2">
          <button
            class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
            data-pda-tr-action="open-detail"
            data-task-id="${escapeHtml(item.taskId)}"
          >查看任务详情</button>

          <button
            class="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            data-pda-tr-action="open-exec"
            data-task-id="${escapeHtml(item.taskId)}"
          >
            去执行
            <i data-lucide="chevron-right" class="ml-0.5 h-3.5 w-3.5"></i>
          </button>
        </div>
      </div>
    </article>
  `
}

function renderQuoteDialog(quotingTender: BiddingTender | null): string {
  if (!state.quoteDialogOpen) return ''
  const quotingTask = quotingTender ? getTaskFactById(quotingTender.taskId) : null
  const quotingProcessName = quotingTask
    ? getTaskProcessDisplayName(quotingTask)
    : (quotingTender?.processName || '')

  return `
    <div class="fixed inset-0 z-[120] bg-black/35" data-pda-tr-action="close-quote"></div>
    <div class="fixed inset-0 z-[121] flex items-center justify-center p-4">
      <article class="w-full max-w-sm rounded-lg border bg-background shadow-lg">
        <header class="space-y-1 border-b px-4 py-3">
          <h3 class="text-base font-semibold">立即报价</h3>
          <p class="text-xs text-muted-foreground">
            ${escapeHtml(quotingTender?.tenderId || '')} · ${escapeHtml(quotingProcessName)}
            <br />
            <span class="font-medium text-amber-600">同一招标单内只允许报价一次，提交后不可修改。</span>
          </p>
        </header>

        <div class="space-y-4 px-4 py-3">
          <div class="space-y-1.5">
            <label class="text-sm font-medium" for="pda-tr-quote-amount">
              报价金额（${escapeHtml(quotingTender?.currency || 'CNY')}/${escapeHtml(quotingTender?.qtyUnit || '件')}）<span class="text-destructive">*</span>
            </label>
            <input
              id="pda-tr-quote-amount"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              type="number"
              placeholder="请输入报价金额"
              data-pda-tr-field="quoteAmount"
              value="${escapeHtml(state.quoteAmount)}"
            />
            ${
              quotingTender
                ? `<p class="text-xs text-muted-foreground">工序标准价参考：${quotingTender.standardPrice.toLocaleString()} ${escapeHtml(quotingTender.currency)}/${escapeHtml(quotingTender.qtyUnit)}</p>`
                : ''
            }
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium" for="pda-tr-delivery-days">交付承诺天数（选填）</label>
            <input
              id="pda-tr-delivery-days"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              type="number"
              placeholder="例如：10"
              data-pda-tr-field="deliveryDays"
              value="${escapeHtml(state.deliveryDays)}"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium" for="pda-tr-quote-remark">报价备注（选填）</label>
            <textarea
              id="pda-tr-quote-remark"
              class="min-h-[72px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="可填写报价说明或补充说明"
              data-pda-tr-field="quoteRemark"
            >${escapeHtml(state.quoteRemark)}</textarea>
          </div>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pda-tr-action="close-quote">取消</button>
          <button
            class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            data-pda-tr-action="submit-quote"
            ${!state.quoteAmount ? 'disabled' : ''}
          >${state.submittingQuote ? '提交中...' : '确认提交报价'}</button>
        </footer>
      </article>
    </div>
  `
}

function renderRejectDialog(): string {
  if (!state.rejectDialogOpen) return ''

  return `
    <div class="fixed inset-0 z-[120] bg-black/35" data-pda-tr-action="close-reject"></div>
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
            data-pda-tr-field="rejectReason"
          >${escapeHtml(state.rejectReason)}</textarea>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pda-tr-action="close-reject">取消</button>
          <button
            class="inline-flex h-8 items-center rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            data-pda-tr-action="confirm-reject"
            ${!state.rejectReason.trim() ? 'disabled' : ''}
          >确认拒单</button>
        </footer>
      </article>
    </div>
  `
}

export function renderPdaTaskReceivePage(): string {
  syncTabWithQuery()

  const selectedFactoryId = getCurrentFactoryId()
  const factoryName = getFactoryName(selectedFactoryId)

  const pendingAcceptTasks = getPendingAcceptTasks(selectedFactoryId)
  const processOptions = Array.from(new Set(pendingAcceptTasks.map((task) => getTaskProcessDisplayName(task))))

  const activeBiddingTenders = getActiveBiddingTenders()
  const allQuotedTenders = getQuotedTenders()
  const awardedTenders = getAwardedTenders(selectedFactoryId)
  const filteredPendingTasks = getFilteredPendingTasks(pendingAcceptTasks)
  const tabCounts = getTabCounts(
    pendingAcceptTasks,
    activeBiddingTenders,
    allQuotedTenders,
    awardedTenders,
  )
  const quotingTender = activeBiddingTenders.find((item) => item.tenderId === state.quotingTenderId) ?? null

  const content = `
    <div class="flex min-h-[760px] flex-col bg-background">
      <header class="sticky top-0 z-30 border-b bg-background px-4 py-3">
        <h1 class="mb-3 flex items-center gap-2 text-lg font-semibold">
          <i data-lucide="clipboard-list" class="h-5 w-5"></i>
          接单与报价
        </h1>

        <div class="relative mb-2">
          <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
          <input
            class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
            placeholder="搜索任务号 / 招标单号 / 生产单号"
            data-pda-tr-field="keyword"
            value="${escapeHtml(state.keyword)}"
          />
        </div>

        ${
          state.activeTab === 'pending-accept'
            ? `
              <div class="flex gap-2">
                <select class="h-8 flex-1 rounded-md border bg-background px-2 text-xs" data-pda-tr-field="processFilter">
                  <option value="ALL" ${state.processFilter === 'ALL' ? 'selected' : ''}>全部工序</option>
                  ${processOptions
                    .map(
                      (processName) =>
                        `<option value="${escapeHtml(processName)}" ${state.processFilter === processName ? 'selected' : ''}>${escapeHtml(processName)}</option>`,
                    )
                    .join('')}
                </select>

                <select class="h-8 flex-1 rounded-md border bg-background px-2 text-xs" data-pda-tr-field="deadlineFilter">
                  <option value="ALL" ${state.deadlineFilter === 'ALL' ? 'selected' : ''}>全部状态</option>
                  <option value="NORMAL" ${state.deadlineFilter === 'NORMAL' ? 'selected' : ''}>正常</option>
                  <option value="SOON" ${state.deadlineFilter === 'SOON' ? 'selected' : ''}>即将逾期</option>
                  <option value="EXPIRED" ${state.deadlineFilter === 'EXPIRED' ? 'selected' : ''}>接单逾期</option>
                </select>
              </div>
            `
            : ''
        }
      </header>

      <div class="sticky top-[auto] z-20 flex border-b bg-background">
        ${TABS.map((tab) => {
          const active = tab.key === state.activeTab
          return `
            <button
              class="flex-1 border-b-2 py-2.5 text-xs font-medium transition-colors ${toClassName(
                active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
              )}"
              data-pda-tr-action="switch-tab"
              data-tab="${tab.key}"
            >
              ${escapeHtml(tab.label)}
              ${
                tabCounts[tab.key] > 0
                  ? `<span class="ml-1 inline-block rounded-full px-1.5 py-0 text-[10px] leading-4 ${toClassName(
                      active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}">${tabCounts[tab.key]}</span>`
                  : ''
              }
            </button>
          `
        }).join('')}
      </div>

      <div class="flex-1 space-y-3 p-4">
        ${
          state.activeTab === 'pending-accept'
            ? filteredPendingTasks.length === 0
              ? renderEmptyState('暂无待接单任务')
              : filteredPendingTasks.map((task) => renderPendingAcceptTask(task, factoryName)).join('')
            : ''
        }

        ${
          state.activeTab === 'pending-quote'
            ? `
              <div class="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-muted-foreground">
                <i data-lucide="info" class="h-3.5 w-3.5 shrink-0 text-blue-500"></i>
                同一招标单内，同一工厂只允许报价一次，提交后不可修改。
              </div>
              ${
                activeBiddingTenders.length === 0
                  ? renderEmptyState('暂无待报价招标单')
                  : activeBiddingTenders.map((tender) => renderPendingQuoteItem(tender)).join('')
              }
            `
            : ''
        }

        ${
          state.activeTab === 'quoted'
            ? `
              <div class="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <i data-lucide="alert-circle" class="h-3.5 w-3.5 shrink-0"></i>
                同一招标单内同一工厂只允许报价一次，不支持再次报价或修改报价。
              </div>
              ${
                allQuotedTenders.length === 0
                  ? renderEmptyState('暂无已报价记录')
                  : allQuotedTenders.map((tender) => renderQuotedItem(tender)).join('')
              }
            `
            : ''
        }

        ${
          state.activeTab === 'awarded'
            ? `
              <div class="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-muted-foreground">
                <i data-lucide="info" class="h-3.5 w-3.5 shrink-0 text-green-600"></i>
                平台定标即视为任务归属确定，无需二次确认，直接进入生产执行。
              </div>
              ${
                awardedTenders.length === 0
                  ? renderEmptyState('暂无已中标任务')
                  : awardedTenders.map((item) => renderAwardedItem(item)).join('')
              }
            `
            : ''
        }
      </div>

      ${renderQuoteDialog(quotingTender)}
      ${renderRejectDialog()}
    </div>
  `

  return renderPdaFrame(content, 'task-receive')
}

function closeQuoteDialog(): void {
  state.quoteDialogOpen = false
  state.quotingTenderId = null
  state.quoteAmount = ''
  state.deliveryDays = ''
  state.quoteRemark = ''
  state.submittingQuote = false
}

function closeRejectDialog(): void {
  state.rejectDialogOpen = false
  state.rejectingTaskId = ''
  state.rejectReason = ''
}

export function handlePdaTaskReceiveEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pda-tr-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.pdaTrField
    if (!field) return true

    if (field === 'keyword') {
      state.keyword = fieldNode.value
      return true
    }

    if (field === 'processFilter') {
      state.processFilter = fieldNode.value
      return true
    }

    if (field === 'deadlineFilter') {
      state.deadlineFilter = fieldNode.value
      return true
    }

    if (field === 'quoteAmount') {
      state.quoteAmount = fieldNode.value
      return true
    }

    if (field === 'deliveryDays') {
      state.deliveryDays = fieldNode.value
      return true
    }

    if (field === 'quoteRemark') {
      state.quoteRemark = fieldNode.value
      return true
    }

    if (field === 'rejectReason') {
      state.rejectReason = fieldNode.value
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-tr-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaTrAction
  if (!action) return false

  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab as TabKey | undefined
    if (tab && TABS.some((item) => item.key === tab)) {
      state.activeTab = tab
      appStore.navigate(`/fcs/pda/task-receive?tab=${tab}`)
    }
    return true
  }

  if (action === 'open-detail') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      appStore.navigate(`/fcs/pda/task-receive/${taskId}`)
    }
    return true
  }

  if (action === 'open-exec') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      appStore.navigate(`/fcs/pda/exec/${taskId}`)
    }
    return true
  }

  if (action === 'open-reject') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      state.rejectingTaskId = taskId
      state.rejectReason = ''
      state.rejectDialogOpen = true
    }
    return true
  }

  if (action === 'close-reject') {
    closeRejectDialog()
    return true
  }

  if (action === 'confirm-reject') {
    if (!state.rejectReason.trim() || !state.rejectingTaskId) return true
    const factoryName = getFactoryName(getCurrentFactoryId())
    mutateRejectTask(state.rejectingTaskId, state.rejectReason.trim(), factoryName)
    closeRejectDialog()
    showTaskReceiveToast('已拒绝接单')
    return true
  }

  if (action === 'accept-task') {
    const taskId = actionNode.dataset.taskId
    const factoryName = actionNode.dataset.factoryName || getFactoryName(getCurrentFactoryId())
    if (taskId) {
      mutateAcceptTask(taskId, factoryName)
      showTaskReceiveToast('接单成功')
    }
    return true
  }

  if (action === 'open-quote') {
    const tenderId = actionNode.dataset.tenderId
    if (tenderId) {
      state.quotingTenderId = tenderId
      state.quoteDialogOpen = true
      state.quoteAmount = ''
      state.deliveryDays = ''
      state.quoteRemark = ''
    }
    return true
  }

  if (action === 'close-quote') {
    closeQuoteDialog()
    return true
  }

  if (action === 'submit-quote') {
    if (!state.quoteAmount || Number.isNaN(Number(state.quoteAmount)) || Number(state.quoteAmount) <= 0) {
      showTaskReceiveToast('请填写有效的报价金额')
      return true
    }

    const quotingTenderId = state.quotingTenderId
    if (quotingTenderId) {
      state.submittedTenderIds = new Set([...state.submittedTenderIds, quotingTenderId])
      submittedQuotes.set(quotingTenderId, {
        quotedPrice: Number(state.quoteAmount),
        quotedAt: nowTimestamp(),
        deliveryDays: Number(state.deliveryDays || '0') || 0,
        remark: state.quoteRemark.trim(),
      })
    }

    closeQuoteDialog()
    showTaskReceiveToast('报价提交成功，同一招标单内只允许报价一次，不可修改。')
    return true
  }

  return false
}
