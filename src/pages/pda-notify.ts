import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { initialNotifications, type Notification } from '../data/fcs/store-domain-progress'
import { getStartPrerequisite, getTaskStartDueInfo, syncPdaStartRiskAndExceptions } from '../data/fcs/pda-start-link'
import { syncMilestoneOverdueExceptions } from '../data/fcs/pda-exec-link'
import { isCuttingSpecialTask, listPdaTaskFlowTasks } from '../data/fcs/pda-cutting-special'
import {
  PDA_MOCK_AWARDED_TENDER_NOTICES,
  PDA_MOCK_BIDDING_TENDERS,
} from '../data/fcs/pda-mobile-mock'
import { renderPdaFrame } from './pda-shell'

type NotifyTab = 'todo' | 'inbox'
type NotifFilter = 'all' | 'unread' | 'read'

type TodoType = '待接单' | '待报价' | '已中标' | '待领料' | '待交出' | '生产暂停' | '即将逾期'

interface PdaNotifyState {
  activeTab: NotifyTab
  notifFilter: NotifFilter
}

interface TodoItem {
  id: string
  type: TodoType
  title: string
  subtitle: string
  orderNo?: string
  process?: string
  deadline?: string
  href: string
  query?: Record<string, string>
  urgent?: boolean
}

interface SummaryCard {
  key: string
  label: string
  count: number
  icon: string
  colorClass: string
  bgClass: string
  href: string
  query?: Record<string, string>
  isInbox?: boolean
}

const state: PdaNotifyState = {
  activeTab: 'todo',
  notifFilter: 'all',
}

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  NEW_TASK: '新派单通知',
  TENDER_BID: '报价提醒',
  TENDER_AWARDED: '中标通知',
  HANDOVER: '交接提醒',
  EXEC_RISK: '执行风险提醒',
  QUALITY: '质量/争议提醒',
  SETTLEMENT: '结算提醒',
}

const NOW_DUE = new Date()
const SOON_MS = 24 * 3600 * 1000

function formatDueDate(offsetHours: number): string {
  const date = new Date(NOW_DUE.getTime() + offsetHours * 3600 * 1000)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

function isSoon(value: string): boolean {
  const ms = parseDateMs(value) - NOW_DUE.getTime()
  return ms > 0 && ms < SOON_MS
}

const MOCK_TENDERS_SOON = [
  { biddingDeadline: formatDueDate(5) },
  { biddingDeadline: formatDueDate(9) },
  { biddingDeadline: formatDueDate(15) },
].filter((item) => isSoon(item.biddingDeadline))

const MOCK_HO_SOON_DEADLINES = [
  formatDueDate(3),
  formatDueDate(6),
  formatDueDate(8),
  formatDueDate(12),
  formatDueDate(16),
  formatDueDate(20),
].filter((item) => isSoon(item))

function parseDateMs(value: string | undefined): number {
  if (!value) return Number.NaN
  return new Date(value.replace(' ', 'T')).getTime()
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function buildPath(path: string, query?: Record<string, string>): string {
  if (!query) return path
  const search = new URLSearchParams(query).toString()
  return search ? `${path}?${search}` : path
}

function parseQueryString(queryString: string | undefined): Record<string, string> | undefined {
  if (!queryString) return undefined
  const params = new URLSearchParams(queryString)
  const entries = Array.from(params.entries())
  if (entries.length === 0) return undefined
  return Object.fromEntries(entries)
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
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
    // ignore parse errors
  }

  return 'ID-F001'
}

function markNotificationRead(notificationId: string): void {
  const index = initialNotifications.findIndex((item) => item.notificationId === notificationId)
  if (index < 0) return

  const current = initialNotifications[index]
  if (current.readAt) return

  initialNotifications[index] = {
    ...current,
    readAt: nowTimestamp(),
  }
}

function markAllNotificationsRead(factoryId: string): void {
  const readAt = nowTimestamp()

  for (let i = 0; i < initialNotifications.length; i += 1) {
    const item = initialNotifications[i]
    if (item.recipientType !== 'FACTORY') continue
    if (item.recipientId !== factoryId) continue
    if (item.readAt) continue

    initialNotifications[i] = {
      ...item,
      readAt,
    }
  }
}

function showPdaNotifyToast(message: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'pda-notify-toast-root'
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

function blockReasonLabel(reason: string): string {
  const map: Record<string, string> = {
    MATERIAL: '物料缺失',
    EQUIPMENT: '设备故障',
    QUALITY: '质量问题',
    OTHER: '其他',
  }
  return map[reason] ?? reason
}

function isUrgentDeadline(deadline: string): boolean {
  const now = new Date()
  const due = new Date(deadline.replace(' ', 'T'))
  const diff = due.getTime() - now.getTime()
  return diff >= 0 && diff < 24 * 3600 * 1000
}

function getNotifyPageData(): {
  selectedFactoryId: string
  summaryCards: SummaryCard[]
  totalTodo: number
  unreadCount: number
  todoItems: TodoItem[]
  notifications: Notification[]
} {
  syncPdaStartRiskAndExceptions()
  syncMilestoneOverdueExceptions()
  const selectedFactoryId = getCurrentFactoryId()
  const taskFacts = listPdaTaskFlowTasks()

  const myTasks = taskFacts.filter(
    (task) => task.assignedFactoryId === selectedFactoryId && task.acceptanceStatus === 'ACCEPTED',
  )

  const pendingAcceptTasks = taskFacts.filter(
    (task) =>
      task.assignedFactoryId === selectedFactoryId &&
      task.assignmentMode === 'DIRECT' &&
      (!task.acceptanceStatus || task.acceptanceStatus === 'PENDING'),
  )

  const notStartedTasks = myTasks.filter((task) => task.status === 'NOT_STARTED')
  const inProgressTasks = myTasks.filter((task) => task.status === 'IN_PROGRESS')
  const blockedTasks = myTasks.filter((task) => task.status === 'BLOCKED')
  const doneTasks = myTasks.filter((task) => task.status === 'DONE')

  const pendingPickup = notStartedTasks.filter((task) => {
    const receiveSummary = (task as { summary?: { receiveSummary?: string } }).summary?.receiveSummary ?? ''
    const requiresPickup =
      isCuttingSpecialTask(task as any) ||
      Boolean(task.hasMaterialRequest) ||
      receiveSummary.includes('领料') ||
      receiveSummary.includes('扫码')

    return requiresPickup && !getStartPrerequisite(task).met
  })

  const pendingHandout = doneTasks.filter(
    (task) => (task as typeof task & { handoutStatus?: string }).handoutStatus === 'PENDING',
  )

  const acceptSoonCount = taskFacts.filter(
    (task) =>
      task.assignedFactoryId === selectedFactoryId &&
      task.assignmentMode === 'DIRECT' &&
      (!task.acceptanceStatus || task.acceptanceStatus === 'PENDING') &&
      !!task.acceptDeadline &&
      isSoon(task.acceptDeadline),
  ).length

  const execSoonCount = inProgressTasks.filter(
    (task) => !!task.taskDeadline && isSoon(task.taskDeadline),
  ).length

  const startSoonCount = notStartedTasks.filter((task) => {
    const dueInfo = getTaskStartDueInfo(task)
    return dueInfo.prerequisiteMet && dueInfo.startRiskStatus === 'DUE_SOON'
  }).length

  const dueSoonTotalCount =
    acceptSoonCount + MOCK_TENDERS_SOON.length + MOCK_HO_SOON_DEADLINES.length + execSoonCount + startSoonCount

  const allNotifications = initialNotifications
    .filter(
      (item) => item.recipientType === 'FACTORY' && item.recipientId === selectedFactoryId,
    )
    .slice()
    .sort((a, b) => parseDateMs(b.createdAt) - parseDateMs(a.createdAt))

  const unreadCount = allNotifications.filter((item) => !item.readAt).length

  const filteredNotifications = allNotifications.filter((item) => {
    if (state.notifFilter === 'unread') return !item.readAt
    if (state.notifFilter === 'read') return !!item.readAt
    return true
  })

  const summaryCards: SummaryCard[] = [
    {
      key: 'accept',
      label: '待接单',
      count: pendingAcceptTasks.length,
      icon: 'clipboard-list',
      colorClass: 'text-orange-600',
      bgClass: 'bg-orange-50',
      href: '/fcs/pda/task-receive',
      query: { tab: 'pending-accept' },
    },
    {
      key: 'quote',
      label: '待报价',
      count: PDA_MOCK_BIDDING_TENDERS.length,
      icon: 'package',
      colorClass: 'text-blue-600',
      bgClass: 'bg-blue-50',
      href: '/fcs/pda/task-receive',
      query: { tab: 'pending-quote' },
    },
    {
      key: 'awarded',
      label: '已中标',
      count: PDA_MOCK_AWARDED_TENDER_NOTICES.length,
      icon: 'trophy',
      colorClass: 'text-green-600',
      bgClass: 'bg-green-50',
      href: '/fcs/pda/task-receive',
      query: { tab: 'awarded' },
    },
    {
      key: 'pickup',
      label: '待领料',
      count: pendingPickup.length,
      icon: 'package',
      colorClass: 'text-amber-600',
      bgClass: 'bg-amber-50',
      href: '/fcs/pda/handover',
      query: { tab: 'pickup' },
    },
    {
      key: 'handout',
      label: '待交出',
      count: pendingHandout.length,
      icon: 'arrow-left-right',
      colorClass: 'text-teal-600',
      bgClass: 'bg-teal-50',
      href: '/fcs/pda/handover',
      query: { tab: 'handout' },
    },
    {
      key: 'blocked',
      label: '生产暂停',
      count: blockedTasks.length,
      icon: 'shield-alert',
      colorClass: 'text-red-600',
      bgClass: 'bg-red-50',
      href: '/fcs/pda/exec',
      query: { tab: 'blocked' },
    },
    {
      key: 'soondue',
      label: '即将逾期',
      count: dueSoonTotalCount,
      icon: 'clock',
      colorClass: 'text-rose-600',
      bgClass: 'bg-rose-50',
      href: '/fcs/pda/notify/due-soon',
    },
    {
      key: 'unread',
      label: '未读通知',
      count: unreadCount,
      icon: 'bell',
      colorClass: 'text-indigo-600',
      bgClass: 'bg-indigo-50',
      href: '#inbox',
      isInbox: true,
    },
  ]

  const todoItems: TodoItem[] = []

  pendingAcceptTasks.forEach((task) => {
    todoItems.push({
      id: task.taskId,
      type: '待接单',
      title: '直接派单待接单',
      subtitle: task.taskId,
      orderNo: task.productionOrderId,
      process: task.processNameZh,
      deadline: task.taskDeadline,
      href: '/fcs/pda/task-receive',
      query: { tab: 'pending-accept' },
      urgent: false,
    })
  })

  PDA_MOCK_BIDDING_TENDERS.forEach((item) => {
    todoItems.push({
      id: item.tenderId,
      type: '待报价',
      title: '招标单待报价',
      subtitle: item.tenderId,
      orderNo: item.productionOrderId,
      process: item.processName,
      deadline: item.biddingDeadline,
      href: '/fcs/pda/task-receive',
      query: { tab: 'pending-quote' },
      urgent: false,
    })
  })

  PDA_MOCK_AWARDED_TENDER_NOTICES.forEach((item) => {
    todoItems.push({
      id: item.tenderId,
      type: '已中标',
      title: '竞价中标 — 待执行',
      subtitle: item.tenderId,
      orderNo: item.productionOrderId,
      process: item.processName,
      href: '/fcs/pda/task-receive',
      query: { tab: 'awarded' },
      urgent: false,
    })
  })

  pendingPickup.forEach((task) => {
    todoItems.push({
      id: `pk-${task.taskId}`,
      type: '待领料',
      title: '尚无领料记录，暂不可开工',
      subtitle: task.taskId,
      orderNo: task.productionOrderId,
      process: task.processNameZh,
      deadline: task.taskDeadline,
      href: '/fcs/pda/handover',
      query: { tab: 'pickup' },
      urgent: false,
    })
  })

  pendingHandout.forEach((task) => {
    todoItems.push({
      id: `ho-${task.taskId}`,
      type: '待交出',
      title: '已完工待交出',
      subtitle: task.taskId,
      orderNo: task.productionOrderId,
      process: task.processNameZh,
      href: '/fcs/pda/handover',
      query: { tab: 'handout' },
      urgent: false,
    })
  })

  blockedTasks.forEach((task) => {
    const blockReason = (task as typeof task & { blockReason?: string }).blockReason
    todoItems.push({
      id: `blk-${task.taskId}`,
      type: '生产暂停',
      title: '任务生产暂停 — 需处理',
      subtitle: `${task.taskId}${blockReason ? ` · ${blockReasonLabel(blockReason)}` : ''}`,
      orderNo: task.productionOrderId,
      process: task.processNameZh,
      href: '/fcs/pda/exec',
      query: { tab: 'blocked' },
      urgent: true,
    })
  })

  if (dueSoonTotalCount > 0) {
    todoItems.push({
      id: 'due-soon-entry',
      type: '即将逾期',
      title: '即将逾期事项',
      subtitle: `共 ${dueSoonTotalCount} 条 — 点击查看各类别逾期详情`,
      href: '/fcs/pda/notify/due-soon',
      urgent: true,
    })
  }

  const todoOrder: Record<TodoType, number> = {
    生产暂停: 1,
    即将逾期: 2,
    待接单: 3,
    待报价: 4,
    已中标: 5,
    待领料: 6,
    待交出: 7,
  }

  todoItems.sort((a, b) => (todoOrder[a.type] ?? 9) - (todoOrder[b.type] ?? 9))

  const totalTodo = summaryCards.filter((card) => !card.isInbox).reduce((sum, card) => sum + card.count, 0)

  return {
    selectedFactoryId,
    summaryCards,
    totalTodo,
    unreadCount,
    todoItems,
    notifications: filteredNotifications,
  }
}

function renderSummaryCard(card: SummaryCard): string {
  const queryString = card.query ? new URLSearchParams(card.query).toString() : ''

  return `
    <button
      class="text-left"
      data-pda-notify-action="open-summary"
      data-inbox="${card.isInbox ? 'true' : 'false'}"
      data-href="${escapeAttr(card.href)}"
      data-query="${escapeAttr(queryString)}"
    >
      <article class="rounded-lg border p-2.5 transition-colors hover:border-primary ${
        card.count > 0 ? 'border-current' : ''
      }">
        <div class="mb-1 flex h-7 w-7 items-center justify-center rounded-lg ${card.bgClass}">
          <i data-lucide="${card.icon}" class="h-3.5 w-3.5 ${card.colorClass}"></i>
        </div>
        <p class="text-xl font-bold leading-none tabular-nums ${
          card.count > 0 ? card.colorClass : 'text-foreground'
        }">${card.count}</p>
        <p class="mt-1 text-[10px] leading-tight text-muted-foreground">${escapeHtml(card.label)}</p>
      </article>
    </button>
  `
}

function renderTodoTypeBadge(type: TodoType): string {
  const map: Record<TodoType, { label: string; className: string }> = {
    待接单: { label: '待接单', className: 'bg-orange-100 text-orange-700 border-orange-200' },
    待报价: { label: '待报价', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    已中标: { label: '已中标', className: 'bg-green-100 text-green-700 border-green-200' },
    待领料: { label: '待领料', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    待交出: { label: '待交出', className: 'bg-teal-100 text-teal-700 border-teal-200' },
    生产暂停: { label: '生产暂停', className: 'bg-red-100 text-red-700 border-red-200' },
    即将逾期: { label: '即将逾期', className: 'bg-rose-100 text-rose-700 border-rose-200' },
  }

  const config = map[type]
  return `<span class="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${config.className}">${escapeHtml(config.label)}</span>`
}

function renderTodoItem(item: TodoItem): string {
  const queryString = item.query ? new URLSearchParams(item.query).toString() : ''
  return `
    <button
      class="w-full text-left"
      data-pda-notify-action="open-todo"
      data-href="${escapeAttr(item.href)}"
      data-query="${escapeAttr(queryString)}"
    >
      <article class="rounded-lg border px-3 py-2.5 transition-colors hover:border-primary ${
        item.urgent ? 'border-l-4 border-l-destructive' : ''
      }">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="flex flex-wrap items-center gap-1.5">
              ${renderTodoTypeBadge(item.type)}
              ${item.urgent ? '<i data-lucide="alert-circle" class="h-3.5 w-3.5 shrink-0 text-destructive"></i>' : ''}
            </div>
            <p class="text-sm font-medium leading-snug">${escapeHtml(item.title)}</p>
            <p class="truncate text-xs text-muted-foreground">${escapeHtml(item.subtitle)}</p>
            <div class="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
              ${item.orderNo ? `<span>生产单：${escapeHtml(item.orderNo)}</span>` : ''}
              ${item.process ? `<span>工序：${escapeHtml(item.process)}</span>` : ''}
              ${
                item.deadline
                  ? `<span class="${isUrgentDeadline(item.deadline) ? 'font-medium text-destructive' : ''}">截止：${escapeHtml(item.deadline)}</span>`
                  : ''
              }
            </div>
          </div>
          <i data-lucide="chevron-right" class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"></i>
        </div>
      </article>
    </button>
  `
}

function renderNotifLevelBadge(level: Notification['level']): string {
  if (level === 'CRITICAL') {
    return '<span class="inline-flex h-4 items-center rounded bg-destructive px-1.5 py-0 text-[10px] text-destructive-foreground">紧急</span>'
  }

  if (level === 'WARN') {
    return '<span class="inline-flex h-4 items-center rounded bg-amber-500 px-1.5 py-0 text-[10px] text-white">警告</span>'
  }

  return '<span class="inline-flex h-4 items-center rounded bg-secondary px-1.5 py-0 text-[10px] text-secondary-foreground">通知</span>'
}

function renderNotificationItem(notification: Notification): string {
  const n = notification as Notification & { notificationType?: string; body?: string }
  const typeLabel =
    NOTIFICATION_TYPE_LABELS[n.notificationType || ''] ||
    (n.notificationType ? n.notificationType : '通知')

  return `
    <button
      class="w-full text-left"
      data-pda-notify-action="open-notification"
      data-id="${escapeAttr(notification.notificationId)}"
    >
      <article class="rounded-lg border px-3 py-2.5 transition-colors hover:border-primary ${
        notification.readAt ? '' : 'border-l-4 border-l-primary'
      }">
        <div class="space-y-1">
          <div class="flex items-start justify-between gap-2">
            <div class="flex min-w-0 flex-wrap items-center gap-1.5">
              ${renderNotifLevelBadge(notification.level)}
              <span class="text-[10px] text-muted-foreground">${escapeHtml(typeLabel)}</span>
              ${notification.readAt ? '' : '<span class="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"></span>'}
            </div>
            <span class="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">${escapeHtml(notification.createdAt.slice(5, 16))}</span>
          </div>
          <p class="text-sm font-medium leading-snug">${escapeHtml(notification.title)}</p>
          <p class="line-clamp-2 text-xs text-muted-foreground">${escapeHtml(n.body || notification.content)}</p>
          <p class="text-xs text-primary">查看详情</p>
        </div>
      </article>
    </button>
  `
}

export function renderPdaNotifyPage(): string {
  const { selectedFactoryId, summaryCards, totalTodo, unreadCount, todoItems, notifications } =
    getNotifyPageData()

  if (!selectedFactoryId) {
    const content = `
      <div class="min-h-[760px] bg-muted/30 p-4">
        <h1 class="mb-4 text-base font-semibold">待办</h1>
        <article class="rounded-lg border bg-background">
          <div class="px-4 py-8 text-center text-sm text-muted-foreground">请先登录工厂账号</div>
        </article>
      </div>
    `
    return renderPdaFrame(content, 'notify')
  }

  const content = `
    <div class="flex min-h-[760px] flex-col bg-muted/30">
      <header class="sticky top-0 z-20 border-b bg-background">
        <div class="px-4 pb-0 pt-3">
          <h1 class="mb-2.5 text-base font-semibold">待办</h1>
          <div class="flex">
            <button
              class="flex-1 border-b-2 py-2 text-sm font-medium transition-colors ${
                state.activeTab === 'todo'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground'
              }"
              data-pda-notify-action="switch-tab"
              data-tab="todo"
            >
              待处理事项
              ${
                totalTodo > 0
                  ? `<span class="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-md bg-[#f5222d] px-1 text-[10px] font-semibold leading-none text-white">${totalTodo}</span>`
                  : ''
              }
            </button>
            <button
              class="flex-1 border-b-2 py-2 text-sm font-medium transition-colors ${
                state.activeTab === 'inbox'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground'
              }"
              data-pda-notify-action="switch-tab"
              data-tab="inbox"
            >
              通知提醒
              ${
                unreadCount > 0
                  ? `<span class="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-md bg-[#f5222d] px-1 text-[10px] font-semibold leading-none text-white">${unreadCount}</span>`
                  : ''
              }
            </button>
          </div>
        </div>
      </header>

      ${
        state.activeTab === 'todo'
          ? `
            <div class="flex-1 space-y-4 p-4">
              <section>
                <p class="mb-2 text-xs font-medium text-muted-foreground">总览</p>
                <div class="grid grid-cols-3 gap-2">
                  ${summaryCards.map((card) => renderSummaryCard(card)).join('')}
                </div>
              </section>

              <section>
                <p class="mb-2 text-xs font-medium text-muted-foreground">待处理事项</p>
                ${
                  todoItems.length === 0
                    ? `
                      <div class="py-10 text-center text-muted-foreground">
                        <i data-lucide="check" class="mx-auto mb-2 h-10 w-10 opacity-30"></i>
                        <p class="text-sm">暂无待处理事项</p>
                      </div>
                    `
                    : `<div class="space-y-2">${todoItems
                        .map((item) => renderTodoItem(item))
                        .join('')}</div>`
                }
              </section>
            </div>
          `
          : `
            <div class="flex-1 space-y-3 p-4">
              <div class="flex items-center justify-between">
                <div class="flex gap-1.5">
                  <button
                    class="rounded-full border px-3 py-1 text-xs transition-colors ${
                      state.notifFilter === 'all'
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:border-foreground'
                    }"
                    data-pda-notify-action="set-filter"
                    data-filter="all"
                  >全部</button>
                  <button
                    class="rounded-full border px-3 py-1 text-xs transition-colors ${
                      state.notifFilter === 'unread'
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:border-foreground'
                    }"
                    data-pda-notify-action="set-filter"
                    data-filter="unread"
                  >未读${
                    unreadCount > 0
                      ? `<span class="ml-1 font-semibold ${
                          state.notifFilter === 'unread' ? 'text-primary-foreground' : ''
                        }">${unreadCount}</span>`
                      : ''
                  }</button>
                  <button
                    class="rounded-full border px-3 py-1 text-xs transition-colors ${
                      state.notifFilter === 'read'
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:border-foreground'
                    }"
                    data-pda-notify-action="set-filter"
                    data-filter="read"
                  >已读</button>
                </div>
                ${
                  unreadCount > 0
                    ? '<button class="inline-flex h-7 items-center rounded px-2 text-xs hover:bg-muted" data-pda-notify-action="mark-all-read"><i data-lucide="check-check" class="mr-1 h-3.5 w-3.5"></i>全部已读</button>'
                    : ''
                }
              </div>

              ${
                notifications.length === 0
                  ? `
                    <div class="py-12 text-center text-muted-foreground">
                      <i data-lucide="inbox" class="mx-auto mb-2 h-10 w-10 opacity-30"></i>
                      <p class="text-sm">暂无通知</p>
                    </div>
                  `
                  : `<div class="space-y-2">${notifications
                      .map((notification) => renderNotificationItem(notification))
                      .join('')}</div>`
              }
            </div>
          `
      }
    </div>
  `

  return renderPdaFrame(content, 'notify')
}

export function handlePdaNotifyEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pda-notify-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaNotifyAction
  if (!action) return false

  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab
    if (tab === 'todo' || tab === 'inbox') {
      state.activeTab = tab
    }
    return true
  }

  if (action === 'set-filter') {
    const filter = actionNode.dataset.filter
    if (filter === 'all' || filter === 'unread' || filter === 'read') {
      state.notifFilter = filter
    }
    return true
  }

  if (action === 'open-summary') {
    const isInbox = actionNode.dataset.inbox === 'true'
    if (isInbox) {
      state.activeTab = 'inbox'
      return true
    }

    const href = actionNode.dataset.href
    if (href) {
      const query = parseQueryString(actionNode.dataset.query)
      appStore.navigate(buildPath(href, query))
    }
    return true
  }

  if (action === 'open-todo') {
    const href = actionNode.dataset.href
    if (href) {
      const query = parseQueryString(actionNode.dataset.query)
      appStore.navigate(buildPath(href, query))
    }
    return true
  }

  if (action === 'open-notification') {
    const notificationId = actionNode.dataset.id
    if (!notificationId) return true

    const current = initialNotifications.find((item) => item.notificationId === notificationId)
    if (!current) return true

    if (!current.readAt) {
      markNotificationRead(notificationId)
    }

    appStore.navigate(`/fcs/pda/notify/${notificationId}`)
    return true
  }

  if (action === 'mark-all-read') {
    markAllNotificationsRead(getCurrentFactoryId())
    showPdaNotifyToast('已全部标记为已读')
    return true
  }

  return false
}
