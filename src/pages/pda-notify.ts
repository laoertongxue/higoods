import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import { processTasks } from '../data/fcs/process-tasks'
import {
  initialHandoverEvents,
  initialNotifications,
  type Notification,
} from '../data/fcs/store-domain-progress'
import { renderPdaFrame } from './pda-shell'

type NotifyView = 'todo' | 'inbox'
type InboxFilter = 'unread' | 'all'

interface PdaNotifyState {
  activeView: NotifyView
  inboxFilter: InboxFilter
}

interface SummaryCard {
  key: string
  label: string
  count: number
  icon: string
  colorClass: string
  bgClass: string
  href?: string
  toView?: NotifyView
}

const state: PdaNotifyState = {
  activeView: 'todo',
  inboxFilter: 'unread',
}

const MOCK_TENDERS_BIDDING = [
  {
    tenderId: 'TENDER-0002-001',
    taskId: 'TASK-0002-002',
    processName: '裁剪',
    qty: 800,
    biddingDeadline: '2026-03-20 18:00',
  },
]

const MOCK_AWARDED = [
  {
    tenderId: 'TENDER-0004-001',
    taskId: 'TASK-0004-002',
    processName: '车缝',
    qty: 1200,
    notifiedAt: '2026-03-09 10:00',
    awardedPrice: 13200,
  },
]

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function parseDateMs(value: string | undefined): number {
  if (!value) return Number.NaN
  return new Date(value.replace(' ', 'T')).getTime()
}

function buildPath(path: string, query?: Record<string, string>): string {
  if (!query) return path
  const qs = new URLSearchParams(query).toString()
  return qs ? `${path}?${qs}` : path
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}

function getCurrentFactoryId(): string {
  if (typeof window === 'undefined') return 'ID-F001'

  try {
    const fromFactoryKey = window.localStorage.getItem('fcs_pda_factory_id')
    if (fromFactoryKey) return fromFactoryKey

    const rawSession = window.localStorage.getItem('fcs_pda_session')
    if (rawSession) {
      const parsed = JSON.parse(rawSession) as { factoryId?: string }
      if (parsed.factoryId) return parsed.factoryId
    }
  } catch {
    // ignore localStorage parse errors and use fallback factory
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

function getNotifyPageData(): {
  selectedFactoryId: string
  summaryCards: SummaryCard[]
  totalTodo: number
  unreadCount: number
  factoryNotifications: Notification[]
} {
  const selectedFactoryId = getCurrentFactoryId()

  const pendingAcceptTasks = processTasks.filter(
    (task) =>
      task.assignedFactoryId === selectedFactoryId &&
      task.assignmentMode === 'DIRECT' &&
      (!task.acceptanceStatus || task.acceptanceStatus === 'PENDING'),
  )

  const pendingMaterialTasks = processTasks.filter(
    (task) =>
      task.assignedFactoryId === selectedFactoryId &&
      task.acceptanceStatus === 'ACCEPTED' &&
      (!task.status || task.status === 'NOT_STARTED'),
  )

  const pendingHandoverEvents = initialHandoverEvents.filter(
    (event) =>
      event.toParty.kind === 'FACTORY' &&
      event.toParty.id === selectedFactoryId &&
      event.status === 'PENDING_CONFIRM',
  )

  const inProgressTasks = processTasks.filter(
    (task) =>
      task.assignedFactoryId === selectedFactoryId &&
      task.acceptanceStatus === 'ACCEPTED' &&
      task.status === 'IN_PROGRESS',
  )

  const unreadNotifications = initialNotifications.filter(
    (notification) =>
      notification.recipientType === 'FACTORY' &&
      notification.recipientId === selectedFactoryId &&
      !notification.readAt,
  )

  const factoryNotifications = initialNotifications
    .filter((notification) => {
      if (notification.recipientType !== 'FACTORY') return false
      if (notification.recipientId !== selectedFactoryId) return false
      if (state.inboxFilter === 'unread' && notification.readAt) return false
      return true
    })
    .slice()
    .sort((a, b) => parseDateMs(b.createdAt) - parseDateMs(a.createdAt))

  const summaryCards: SummaryCard[] = [
    {
      key: 'pendingAccept',
      label: '待接单任务',
      count: pendingAcceptTasks.length,
      icon: 'clipboard-list',
      colorClass: 'text-orange-600',
      bgClass: 'bg-orange-50',
      href: '/fcs/pda/task-receive?tab=pending-accept',
    },
    {
      key: 'pendingQuote',
      label: '待报价招标单',
      count: MOCK_TENDERS_BIDDING.length,
      icon: 'package',
      colorClass: 'text-blue-600',
      bgClass: 'bg-blue-50',
      href: '/fcs/pda/task-receive?tab=pending-quote',
    },
    {
      key: 'awarded',
      label: '已中标任务',
      count: MOCK_AWARDED.length,
      icon: 'trophy',
      colorClass: 'text-green-600',
      bgClass: 'bg-green-50',
      href: '/fcs/pda/task-receive?tab=awarded',
    },
    {
      key: 'pendingMaterial',
      label: '待领料',
      count: pendingMaterialTasks.length,
      icon: 'package',
      colorClass: 'text-amber-600',
      bgClass: 'bg-amber-50',
      href: '/fcs/pda/exec',
    },
    {
      key: 'pendingReceive',
      label: '待接收',
      count: pendingHandoverEvents.length,
      icon: 'arrow-left-right',
      colorClass: 'text-purple-600',
      bgClass: 'bg-purple-50',
      href: '/fcs/pda/handover',
    },
    {
      key: 'pendingHandout',
      label: '待交出',
      count: inProgressTasks.length,
      icon: 'arrow-left-right',
      colorClass: 'text-teal-600',
      bgClass: 'bg-teal-50',
      href: '/fcs/pda/exec',
    },
    {
      key: 'unreadNotify',
      label: '未读通知',
      count: unreadNotifications.length,
      icon: 'bell',
      colorClass: 'text-red-600',
      bgClass: 'bg-red-50',
      toView: 'inbox',
    },
  ]

  const totalTodo = summaryCards.slice(0, 6).reduce((sum, card) => sum + card.count, 0)

  return {
    selectedFactoryId,
    summaryCards,
    totalTodo,
    unreadCount: unreadNotifications.length,
    factoryNotifications,
  }
}

function renderSummaryCard(card: SummaryCard): string {
  return `
    <button
      class="text-left"
      data-pda-notify-action="open-summary"
      data-href="${escapeAttr(card.href ?? '')}"
      data-view="${escapeAttr(card.toView ?? '')}"
    >
      <article class="rounded-lg border transition-colors hover:border-primary ${card.count > 0 ? 'border-current/20' : ''}">
        <div class="flex items-center gap-3 p-3">
          <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.bgClass}">
            <i data-lucide="${card.icon}" class="h-4 w-4 ${card.colorClass}"></i>
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs leading-tight text-muted-foreground">${escapeHtml(card.label)}</p>
            <p class="text-xl font-bold leading-tight tabular-nums ${card.count > 0 ? card.colorClass : 'text-foreground'}">${card.count}</p>
          </div>
          <i data-lucide="chevron-right" class="h-4 w-4 shrink-0 text-muted-foreground"></i>
        </div>
      </article>
    </button>
  `
}

function getNotificationLevelBadge(level: Notification['level']): { label: string; className: string } {
  if (level === 'CRITICAL') {
    return { label: '紧急', className: 'bg-red-100 text-red-700 border-red-200' }
  }
  if (level === 'WARN') {
    return { label: '警告', className: 'bg-amber-100 text-amber-700 border-amber-200' }
  }
  return { label: '通知', className: 'bg-slate-100 text-slate-700 border-slate-200' }
}

function renderNotificationItem(notification: Notification): string {
  const level = getNotificationLevelBadge(notification.level)

  return `
    <button class="w-full text-left" data-pda-notify-action="open-notification" data-id="${escapeAttr(notification.notificationId)}">
      <article class="rounded-lg border transition-colors hover:border-primary ${notification.readAt ? '' : 'border-l-4 border-l-primary'}">
        <div class="space-y-1 px-3 py-2.5">
          <div class="flex items-start justify-between gap-2">
            <div class="flex min-w-0 flex-wrap items-center gap-1.5">
              <span class="inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium ${level.className}">${escapeHtml(level.label)}</span>
              ${notification.readAt ? '' : '<span class="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"></span>'}
            </div>
            <span class="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">${escapeHtml(notification.createdAt.slice(0, 16))}</span>
          </div>
          <p class="text-sm font-medium leading-snug">${escapeHtml(notification.title)}</p>
          <p class="line-clamp-2 text-xs text-muted-foreground">${escapeHtml(notification.content)}</p>
          ${notification.deepLink?.path ? '<p class="text-xs text-primary">点击查看详情</p>' : ''}
        </div>
      </article>
    </button>
  `
}

export function renderPdaNotifyPage(): string {
  const {
    selectedFactoryId,
    summaryCards,
    totalTodo,
    unreadCount,
    factoryNotifications,
  } = getNotifyPageData()

  if (!selectedFactoryId) {
    const noLoginContent = `
      <div class="min-h-[760px] p-4">
        <h1 class="mb-4 text-lg font-semibold">待办</h1>
        <article class="rounded-lg border">
          <div class="px-4 py-8 text-center text-sm text-muted-foreground">请先登录工厂账号</div>
        </article>
      </div>
    `

    return renderPdaFrame(noLoginContent, 'notify')
  }

  const content = `
    <div class="flex min-h-[760px] flex-col bg-background">
      <header class="sticky top-0 z-20 border-b bg-background px-4 pb-0 pt-3">
        <h1 class="mb-3 text-lg font-semibold">待办工作台</h1>
        <div class="flex">
          <button
            class="flex-1 border-b-2 py-2 text-sm font-medium transition-colors ${state.activeView === 'todo' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}"
            data-pda-notify-action="switch-view"
            data-view="todo"
          >
            待办
            ${
              totalTodo > 0
                ? `<span class="ml-1.5 inline-flex min-w-[16px] items-center justify-center rounded bg-destructive px-1.5 py-0 text-[10px] text-destructive-foreground">${totalTodo}</span>`
                : ''
            }
          </button>
          <button
            class="flex-1 border-b-2 py-2 text-sm font-medium transition-colors ${state.activeView === 'inbox' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}"
            data-pda-notify-action="switch-view"
            data-view="inbox"
          >
            通知
            ${
              unreadCount > 0
                ? `<span class="ml-1.5 inline-flex min-w-[16px] items-center justify-center rounded bg-destructive px-1.5 py-0 text-[10px] text-destructive-foreground">${unreadCount}</span>`
                : ''
            }
          </button>
        </div>
      </header>

      <div class="flex-1 space-y-4 p-4">
        ${
          state.activeView === 'todo'
            ? `
              ${
                totalTodo === 0 && unreadCount === 0
                  ? `
                    <div class="py-16 text-center text-muted-foreground">
                      <i data-lucide="check" class="mx-auto mb-3 h-12 w-12 opacity-30"></i>
                      <p class="text-sm">暂无待办事项</p>
                    </div>
                  `
                  : `
                    <div class="grid grid-cols-2 gap-3">
                      ${summaryCards.map((card) => renderSummaryCard(card)).join('')}
                    </div>
                  `
              }

              <section>
                <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">快捷入口</p>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    class="text-left"
                    data-pda-notify-action="open-quick-entry"
                    data-href="/fcs/pda/task-receive"
                  >
                    <article class="rounded-lg border transition-colors hover:border-primary">
                      <div class="flex flex-col items-center gap-1.5 p-3 text-center">
                        <i data-lucide="clipboard-list" class="h-5 w-5 text-muted-foreground"></i>
                        <span class="text-xs text-muted-foreground">接单与报价</span>
                      </div>
                    </article>
                  </button>

                  <button
                    class="text-left"
                    data-pda-notify-action="open-quick-entry"
                    data-href="/fcs/pda/exec"
                  >
                    <article class="rounded-lg border transition-colors hover:border-primary">
                      <div class="flex flex-col items-center gap-1.5 p-3 text-center">
                        <i data-lucide="package" class="h-5 w-5 text-muted-foreground"></i>
                        <span class="text-xs text-muted-foreground">生产执行</span>
                      </div>
                    </article>
                  </button>

                  <button
                    class="text-left"
                    data-pda-notify-action="open-quick-entry"
                    data-href="/fcs/pda/handover"
                  >
                    <article class="rounded-lg border transition-colors hover:border-primary">
                      <div class="flex flex-col items-center gap-1.5 p-3 text-center">
                        <i data-lucide="arrow-left-right" class="h-5 w-5 text-muted-foreground"></i>
                        <span class="text-xs text-muted-foreground">交接确认</span>
                      </div>
                    </article>
                  </button>
                </div>
              </section>
            `
            : `
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex gap-2">
                    <button
                      class="rounded-full border px-3 py-1 text-sm transition-colors ${toClassName(
                        state.inboxFilter === 'unread'
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground',
                      )}"
                      data-pda-notify-action="set-filter"
                      data-filter="unread"
                    >未读</button>
                    <button
                      class="rounded-full border px-3 py-1 text-sm transition-colors ${toClassName(
                        state.inboxFilter === 'all'
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground',
                      )}"
                      data-pda-notify-action="set-filter"
                      data-filter="all"
                    >全部</button>
                  </div>
                  ${
                    unreadCount > 0
                      ? '<button class="inline-flex items-center rounded px-2 py-1 text-sm hover:bg-muted" data-pda-notify-action="mark-all-read"><i data-lucide="check-check" class="mr-1 h-4 w-4"></i>全部已读</button>'
                      : ''
                  }
                </div>

                ${
                  factoryNotifications.length === 0
                    ? `
                      <div class="py-12 text-center text-muted-foreground">
                        <i data-lucide="inbox" class="mx-auto mb-2 h-10 w-10 opacity-30"></i>
                        <p class="text-sm">暂无通知</p>
                      </div>
                    `
                    : factoryNotifications.map((notification) => renderNotificationItem(notification)).join('')
                }
              </div>
            `
        }
      </div>
    </div>
  `

  return renderPdaFrame(content, 'notify')
}

export function handlePdaNotifyEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pda-notify-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaNotifyAction
  if (!action) return false

  if (action === 'switch-view') {
    const view = actionNode.dataset.view
    if (view === 'todo' || view === 'inbox') {
      state.activeView = view
    }
    return true
  }

  if (action === 'set-filter') {
    const filter = actionNode.dataset.filter
    if (filter === 'unread' || filter === 'all') {
      state.inboxFilter = filter
    }
    return true
  }

  if (action === 'open-summary') {
    const view = actionNode.dataset.view
    if (view === 'inbox' || view === 'todo') {
      state.activeView = view
      return true
    }

    const href = actionNode.dataset.href
    if (href) {
      appStore.navigate(href)
    }
    return true
  }

  if (action === 'open-quick-entry') {
    const href = actionNode.dataset.href
    if (href) {
      appStore.navigate(href)
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

    if (current.deepLink?.path) {
      appStore.navigate(buildPath(current.deepLink.path, current.deepLink.query))
      return true
    }

    if (current.related?.taskId) {
      appStore.navigate(`/fcs/pda/exec/${current.related.taskId}`)
      return true
    }

    return true
  }

  if (action === 'mark-all-read') {
    markAllNotificationsRead(getCurrentFactoryId())
    showPdaNotifyToast('已将所有通知标记为已读')
    return true
  }

  return false
}
