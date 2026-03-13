import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import {
  processTasks,
  type ProcessTask,
} from '../data/fcs/process-tasks'
import { productionOrders } from '../data/fcs/production-orders'
import { indonesiaFactories } from '../data/fcs/indonesia-factories'
import {
  calculateSlaDue,
  generateCaseId,
  generateHandoverEventId,
  generateNotificationId,
  generateUrgeId,
  initialExceptions,
  initialHandoverEvents,
  initialNotifications,
  initialUrges,
  type DiffReasonCode,
  type ExceptionCase,
  type HandoverEvent,
  type HandoverEventType,
  type HandoverParty,
  type HandoverStatus,
  type Notification,
  type PartyKind,
  type RecipientType,
  type UrgeLog,
  type UrgeType,
} from '../data/fcs/store-domain-progress'

type HandoverTab = 'list' | 'timeline'
type DiffFilter = 'ALL' | 'YES' | 'NO'

interface ProgressHandoverState {
  lastQueryKey: string

  keyword: string
  filterPo: string
  filterTaskId: string
  filterEventType: 'ALL' | HandoverEventType
  filterStatus: 'ALL' | HandoverStatus
  filterHasDiff: DiffFilter
  showUrlFilterBanner: boolean

  activeTab: HandoverTab
  timelineOrderId: string

  rowMenuEventId: string | null

  newDrawerOpen: boolean
  detailEventId: string | null

  confirmEventId: string | null
  disputeEventId: string | null
  disputeReason: string

  formOrderId: string
  formTaskId: string
  formEventType: HandoverEventType
  formFromKind: PartyKind
  formFromId: string
  formFromName: string
  formToKind: PartyKind
  formToId: string
  formToName: string
  formExpected: number
  formActual: number
  formDiffReason: '' | DiffReasonCode
  formDiffRemark: string
  formOccurredAt: string
}

const state: ProgressHandoverState = {
  lastQueryKey: '',

  keyword: '',
  filterPo: '',
  filterTaskId: '',
  filterEventType: 'ALL',
  filterStatus: 'ALL',
  filterHasDiff: 'ALL',
  showUrlFilterBanner: false,

  activeTab: 'list',
  timelineOrderId: '',

  rowMenuEventId: null,

  newDrawerOpen: false,
  detailEventId: null,

  confirmEventId: null,
  disputeEventId: null,
  disputeReason: '',

  formOrderId: '',
  formTaskId: '',
  formEventType: 'CUT_PIECES_TO_MAIN_FACTORY',
  formFromKind: 'FACTORY',
  formFromId: '',
  formFromName: '',
  formToKind: 'FACTORY',
  formToId: '',
  formToName: '',
  formExpected: 0,
  formActual: 0,
  formDiffReason: '',
  formDiffRemark: '',
  formOccurredAt: getCurrentLocalDateTimeInput(),
}

const STATUS_CONFIG: Record<HandoverStatus, { label: string; className: string; icon: string }> = {
  PENDING_CONFIRM: { label: '待确认', className: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: 'clock' },
  CONFIRMED: { label: '已确认', className: 'bg-green-100 text-green-700 border-green-200', icon: 'check-circle' },
  DISPUTED: { label: '争议', className: 'bg-red-100 text-red-700 border-red-200', icon: 'alert-circle' },
  VOID: { label: '已作废', className: 'bg-zinc-100 text-zinc-500 border-zinc-200', icon: 'x-circle' },
}

const EVENT_TYPE_CONFIG: Record<HandoverEventType, { label: string; icon: string }> = {
  CUT_PIECES_TO_MAIN_FACTORY: { label: '裁片交接主工厂', icon: 'truck' },
  FINISHED_GOODS_TO_WAREHOUSE: { label: '成衣交接仓库', icon: 'warehouse' },
  MATERIAL_TO_PROCESSOR: { label: '物料交接加工方', icon: 'package' },
}

const DIFF_REASON_CONFIG: Record<DiffReasonCode, string> = {
  SHORTAGE: '短缺',
  OVERAGE: '超发',
  DAMAGE: '损坏',
  MIXED_BATCH: '混批',
  UNKNOWN: '未知',
}

const PARTY_KIND_CONFIG: Record<PartyKind, { label: string; icon: string }> = {
  FACTORY: { label: '工厂', icon: 'building-2' },
  WAREHOUSE: { label: '仓库', icon: 'warehouse' },
  LEGAL_ENTITY: { label: '法律实体', icon: 'building-2' },
  OTHER: { label: '其他', icon: 'package' },
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function getCurrentLocalDateTimeInput(): string {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function parseDateTime(value: string | undefined): number {
  if (!value) return Number.NaN
  return new Date(value.replace(' ', 'T')).getTime()
}

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return query ?? ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

function isEventType(value: string | null): value is HandoverEventType {
  return value === 'CUT_PIECES_TO_MAIN_FACTORY' || value === 'FINISHED_GOODS_TO_WAREHOUSE' || value === 'MATERIAL_TO_PROCESSOR'
}

function isHandoverStatus(value: string | null): value is HandoverStatus {
  return value === 'PENDING_CONFIRM' || value === 'CONFIRMED' || value === 'DISPUTED' || value === 'VOID'
}

function isPartyKind(value: string | null): value is PartyKind {
  return value === 'FACTORY' || value === 'WAREHOUSE' || value === 'LEGAL_ENTITY' || value === 'OTHER'
}

function isDiffReasonCode(value: string | null): value is DiffReasonCode {
  return value === 'SHORTAGE' || value === 'OVERAGE' || value === 'DAMAGE' || value === 'MIXED_BATCH' || value === 'UNKNOWN'
}

function showProgressHandoverToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'progress-handover-toast-root'
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

function openLinkedPage(title: string, href: string): void {
  appStore.openTab({
    key: href,
    title,
    href,
    closable: true,
  })
}

function getOrderById(orderId: string) {
  return productionOrders.find((item) => item.productionOrderId === orderId)
}

function getFactoryById(factoryId: string) {
  return indonesiaFactories.find((item) => item.id === factoryId)
}

function getHandoverEventById(eventId: string): HandoverEvent | undefined {
  return initialHandoverEvents.find((item) => item.eventId === eventId)
}

function getTasksByOrderId(orderId: string): ProcessTask[] {
  return processTasks.filter((task) => task.productionOrderId === orderId)
}

function updateHandoverEvent(updated: HandoverEvent): void {
  const index = initialHandoverEvents.findIndex((item) => item.eventId === updated.eventId)
  if (index >= 0) {
    initialHandoverEvents[index] = updated
  }
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

  const urge: UrgeLog = {
    ...payload,
    urgeId: generateUrgeId(),
    createdAt,
    status: 'SENT',
    auditLogs: [
      {
        id: `UAL-${Date.now()}`,
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
    URGE_UNBLOCK: '催解除阻塞',
    URGE_TENDER_BID: '催报价',
    URGE_TENDER_AWARD: '催定标',
    URGE_HANDOVER_CONFIRM: '催交接确认',
    URGE_HANDOVER_EVIDENCE: '催补证据/处理差异',
    URGE_CASE_HANDLE: '催处理异常',
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

function createOrUpdateHandoverException(event: HandoverEvent, detail: string): ExceptionCase {
  const sourceType: ExceptionCase['sourceType'] = event.relatedTaskId ? 'TASK' : 'ORDER'
  const sourceId = event.relatedTaskId || event.productionOrderId

  const existed = initialExceptions.find(
    (item) =>
      item.sourceType === sourceType &&
      item.sourceId === sourceId &&
      item.reasonCode === 'HANDOVER_DIFF' &&
      item.caseStatus !== 'CLOSED',
  )

  const now = nowTimestamp()

  if (existed) {
    const updated: ExceptionCase = {
      ...existed,
      updatedAt: now,
      detail,
      auditLogs: [
        ...existed.auditLogs,
        {
          id: `EAL-${Date.now()}`,
          action: 'UPDATE',
          detail: '交接差异信号触发，更新异常',
          at: now,
          by: '系统',
        },
      ],
    }

    const index = initialExceptions.findIndex((item) => item.caseId === existed.caseId)
    if (index >= 0) {
      initialExceptions[index] = updated
    }

    return updated
  }

  const created: ExceptionCase = {
    caseId: generateCaseId(),
    caseStatus: 'OPEN',
    severity: 'S1',
    category: 'HANDOVER',
    reasonCode: 'HANDOVER_DIFF',
    sourceType,
    sourceId,
    relatedOrderIds: [event.productionOrderId],
    relatedTaskIds: event.relatedTaskId ? [event.relatedTaskId] : [],
    relatedTenderIds: [],
    summary: '交接差异',
    detail,
    createdAt: now,
    updatedAt: now,
    slaDueAt: calculateSlaDue('S1', now),
    tags: ['交接', '差异'],
    actions: [],
    auditLogs: [
      {
        id: `EAL-${Date.now()}`,
        action: 'CREATE',
        detail: '系统自动生成异常单',
        at: now,
        by: '系统',
      },
    ],
  }

  initialExceptions.push(created)
  return created
}

function createHandoverEvent(payload: Omit<HandoverEvent, 'eventId' | 'createdAt' | 'auditLogs'>): HandoverEvent {
  const now = nowTimestamp()

  const event: HandoverEvent = {
    ...payload,
    eventId: generateHandoverEventId(),
    createdAt: now,
    auditLogs: [
      {
        id: `HAL-${Date.now()}`,
        action: 'CREATE',
        detail: '创建交接事件',
        at: now,
        by: payload.createdBy,
      },
    ],
  }

  initialHandoverEvents.push(event)

  if (event.qtyDiff !== 0 || event.status === 'DISPUTED') {
    createOrUpdateHandoverException(
      event,
      `交接差异：${event.fromParty.name} -> ${event.toParty.name}，应交${event.qtyExpected}，实交${event.qtyActual}，差异${event.qtyDiff}${event.diffReasonCode ? `，原因：${event.diffReasonCode}` : ''}，生产单：${event.productionOrderId}`,
    )
  }

  return event
}

function confirmHandoverEvent(eventId: string, by: string): void {
  const event = getHandoverEventById(eventId)
  if (!event || event.status !== 'PENDING_CONFIRM') return

  const now = nowTimestamp()
  const nextStatus: HandoverStatus = event.qtyDiff !== 0 ? 'DISPUTED' : 'CONFIRMED'

  const updated: HandoverEvent = {
    ...event,
    status: nextStatus,
    confirmedAt: now,
    confirmedBy: by,
    auditLogs: [
      ...event.auditLogs,
      {
        id: `HAL-${Date.now()}`,
        action: nextStatus === 'DISPUTED' ? 'DISPUTE' : 'CONFIRM',
        detail: nextStatus === 'DISPUTED' ? '确认时发现差异，标记争议' : '确认交接',
        at: now,
        by,
      },
    ],
  }

  updateHandoverEvent(updated)

  if (event.qtyDiff !== 0) {
    createOrUpdateHandoverException(
      updated,
      `交接差异确认：${event.fromParty.name} -> ${event.toParty.name}，应交${event.qtyExpected}，实交${event.qtyActual}，差异${event.qtyDiff}${event.diffReasonCode ? `，原因：${event.diffReasonCode}` : ''}，生产单：${event.productionOrderId}`,
    )
  }
}

function markHandoverDisputed(eventId: string, reason: string, by: string): void {
  const event = getHandoverEventById(eventId)
  if (!event) return

  const now = nowTimestamp()

  const updated: HandoverEvent = {
    ...event,
    status: 'DISPUTED',
    diffRemark: reason,
    auditLogs: [
      ...event.auditLogs,
      {
        id: `HAL-${Date.now()}`,
        action: 'DISPUTE',
        detail: `标记争议：${reason}`,
        at: now,
        by,
      },
    ],
  }

  updateHandoverEvent(updated)

  createOrUpdateHandoverException(
    updated,
    `交接争议：${event.fromParty.name} -> ${event.toParty.name}，原因：${reason}，生产单：${event.productionOrderId}`,
  )
}

function voidHandoverEvent(eventId: string, by: string): void {
  const event = getHandoverEventById(eventId)
  if (!event) return

  const now = nowTimestamp()

  const updated: HandoverEvent = {
    ...event,
    status: 'VOID',
    auditLogs: [
      ...event.auditLogs,
      {
        id: `HAL-${Date.now()}`,
        action: 'VOID',
        detail: '作废交接事件',
        at: now,
        by,
      },
    ],
  }

  updateHandoverEvent(updated)
}

function resetForm(): void {
  state.formOrderId = ''
  state.formTaskId = ''
  state.formEventType = 'CUT_PIECES_TO_MAIN_FACTORY'
  state.formFromKind = 'FACTORY'
  state.formFromId = ''
  state.formFromName = ''
  state.formToKind = 'FACTORY'
  state.formToId = ''
  state.formToName = ''
  state.formExpected = 0
  state.formActual = 0
  state.formDiffReason = ''
  state.formDiffRemark = ''
  state.formOccurredAt = getCurrentLocalDateTimeInput()
}

function closeRowMenu(): void {
  state.rowMenuEventId = null
}

function syncFromQuery(): void {
  const queryKey = getCurrentQueryString()
  if (state.lastQueryKey === queryKey) return

  state.lastQueryKey = queryKey

  const params = getCurrentSearchParams()
  const po = params.get('po') || ''
  const taskId = params.get('taskId') || ''
  const eventType = params.get('eventType')
  const status = params.get('status')
  const eventId = params.get('eventId') || ''

  state.filterPo = po
  state.filterTaskId = taskId
  state.filterEventType = isEventType(eventType) ? eventType : 'ALL'
  state.filterStatus = isHandoverStatus(status) ? status : 'ALL'

  state.showUrlFilterBanner = Boolean(po || taskId || eventType || status || eventId)

  if (po) {
    state.timelineOrderId = po
  }

  if (eventId && getHandoverEventById(eventId)) {
    state.detailEventId = eventId
  }
}

function getFilteredEvents(): HandoverEvent[] {
  return initialHandoverEvents
    .filter((event) => {
      const keyword = state.keyword.trim().toLowerCase()
      if (keyword) {
        const combined = `${event.eventId} ${event.productionOrderId} ${event.fromParty.name} ${event.toParty.name}`.toLowerCase()
        if (!combined.includes(keyword)) return false
      }

      if (state.filterPo && event.productionOrderId !== state.filterPo) return false
      if (state.filterTaskId && event.relatedTaskId !== state.filterTaskId) return false
      if (state.filterEventType !== 'ALL' && event.eventType !== state.filterEventType) return false
      if (state.filterStatus !== 'ALL' && event.status !== state.filterStatus) return false
      if (state.filterHasDiff === 'YES' && event.qtyDiff === 0) return false
      if (state.filterHasDiff === 'NO' && event.qtyDiff !== 0) return false

      return true
    })
    .sort((a, b) => parseDateTime(b.occurredAt) - parseDateTime(a.occurredAt))
}

function getKpiStats(): { pending: number; disputed: number; todayNew: number } {
  const today = new Date().toISOString().slice(0, 10)

  return {
    pending: initialHandoverEvents.filter((event) => event.status === 'PENDING_CONFIRM').length,
    disputed: initialHandoverEvents.filter((event) => event.status === 'DISPUTED' || event.qtyDiff !== 0).length,
    todayNew: initialHandoverEvents.filter((event) => event.createdAt.startsWith(today)).length,
  }
}

function getOrderIdsWithHandover(): string[] {
  const ids = new Set<string>()
  initialHandoverEvents.forEach((event) => ids.add(event.productionOrderId))
  return Array.from(ids).sort((a, b) => a.localeCompare(b))
}

function getTimelineEvents(orderId: string): HandoverEvent[] {
  if (!orderId) return []
  return initialHandoverEvents
    .filter((event) => event.productionOrderId === orderId)
    .sort((a, b) => parseDateTime(a.occurredAt) - parseDateTime(b.occurredAt))
}

function getTimelineSummary(orderId: string): { pending: number; confirmed: number; disputed: number } {
  const events = getTimelineEvents(orderId)

  return {
    pending: events.filter((event) => event.status === 'PENDING_CONFIRM').length,
    confirmed: events.filter((event) => event.status === 'CONFIRMED').length,
    disputed: events.filter((event) => event.status === 'DISPUTED').length,
  }
}

function renderBadge(label: string, className: string, icon?: string): string {
  return `
    <span class="inline-flex items-center rounded border px-2 py-0.5 text-xs ${className}">
      ${icon ? `<i data-lucide="${icon}" class="h-3 w-3"></i>` : ''}
      <span class="${icon ? 'ml-1' : ''}">${escapeHtml(label)}</span>
    </span>
  `
}

function renderStatusBadge(status: HandoverStatus): string {
  const config = STATUS_CONFIG[status]
  return renderBadge(config.label, config.className, config.icon)
}

function renderHeader(): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold">交接链路追踪</h2>
        <p class="text-sm text-muted-foreground">生产交接事件追踪与管理</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button class="inline-flex h-8 items-center rounded-md border bg-primary px-3 text-sm text-primary-foreground hover:opacity-90" data-handover-action="open-new-drawer">
          <i data-lucide="plus" class="mr-1.5 h-4 w-4"></i>新增交接事件
        </button>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-handover-action="refresh">
          <i data-lucide="refresh-cw" class="mr-1.5 h-4 w-4"></i>刷新
        </button>
        <button class="inline-flex h-8 cursor-not-allowed items-center rounded-md border border-muted-foreground/20 bg-muted px-3 text-sm text-muted-foreground" disabled>
          <i data-lucide="download" class="mr-1.5 h-4 w-4"></i>导出
        </button>
      </div>
    </header>
  `
}

function renderUrlBanner(): string {
  if (!state.showUrlFilterBanner) return ''

  return `
    <section class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
      <div class="flex flex-wrap items-center gap-2 text-sm text-blue-700">
        <i data-lucide="alert-triangle" class="h-4 w-4"></i>
        <span>来自看板的筛选条件</span>
        ${state.filterPo ? renderBadge(`生产单: ${state.filterPo}`, 'bg-white text-blue-700 border-blue-200') : ''}
        ${state.filterTaskId ? renderBadge(`任务: ${state.filterTaskId}`, 'bg-white text-blue-700 border-blue-200') : ''}
        ${
          state.filterEventType !== 'ALL'
            ? renderBadge(`类型: ${EVENT_TYPE_CONFIG[state.filterEventType].label}`, 'bg-white text-blue-700 border-blue-200')
            : ''
        }
        ${
          state.filterStatus !== 'ALL'
            ? renderBadge(`状态: ${STATUS_CONFIG[state.filterStatus].label}`, 'bg-white text-blue-700 border-blue-200')
            : ''
        }
      </div>
      <button class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-white hover:bg-blue-100" data-handover-action="clear-filters" aria-label="清除筛选">
        <i data-lucide="x" class="h-4 w-4"></i>
      </button>
    </section>
  `
}

function renderKpis(kpi: { pending: number; disputed: number; todayNew: number }): string {
  return `
    <section class="grid gap-4 md:grid-cols-3">
      <button
        class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40 ${state.filterStatus === 'PENDING_CONFIRM' ? 'ring-2 ring-primary' : ''}"
        data-handover-action="toggle-pending-filter"
      >
        <p class="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <i data-lucide="clock" class="h-4 w-4 text-yellow-500"></i>
          待确认
        </p>
        <p class="mt-2 text-2xl font-bold">${kpi.pending}</p>
      </button>

      <button
        class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40 ${state.filterStatus === 'DISPUTED' ? 'ring-2 ring-primary' : ''}"
        data-handover-action="toggle-disputed-filter"
      >
        <p class="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <i data-lucide="alert-circle" class="h-4 w-4 text-red-500"></i>
          争议/差异
        </p>
        <p class="mt-2 text-2xl font-bold text-red-600">${kpi.disputed}</p>
      </button>

      <article class="rounded-lg border bg-card p-4">
        <p class="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <i data-lucide="plus" class="h-4 w-4 text-blue-500"></i>
          今日新增
        </p>
        <p class="mt-2 text-2xl font-bold">${kpi.todayNew}</p>
      </article>
    </section>
  `
}

function renderTabs(): string {
  return `
    <div class="inline-flex rounded-md border p-1 text-sm">
      <button class="rounded px-3 py-1.5 ${state.activeTab === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-handover-action="switch-tab" data-tab="list">交接事件台账</button>
      <button class="rounded px-3 py-1.5 ${state.activeTab === 'timeline' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-handover-action="switch-tab" data-tab="timeline">生产单时间线</button>
    </div>
  `
}

function renderListFilters(): string {
  return `
    <section class="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
      <div class="min-w-[220px] flex-1">
        <div class="relative">
          <i data-lucide="search" class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"></i>
          <input
            class="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm"
            placeholder="搜索交接单号/生产单/工厂"
            value="${escapeAttr(state.keyword)}"
            data-handover-field="keyword"
          />
        </div>
      </div>

      <select class="h-9 w-[190px] rounded-md border bg-background px-3 text-sm" data-handover-field="filterEventType">
        <option value="ALL" ${state.filterEventType === 'ALL' ? 'selected' : ''}>事件类型</option>
        ${Object.entries(EVENT_TYPE_CONFIG)
          .map(([key, config]) => `<option value="${key}" ${state.filterEventType === key ? 'selected' : ''}>${escapeHtml(config.label)}</option>`)
          .join('')}
      </select>

      <select class="h-9 w-[140px] rounded-md border bg-background px-3 text-sm" data-handover-field="filterStatus">
        <option value="ALL" ${state.filterStatus === 'ALL' ? 'selected' : ''}>状态</option>
        ${Object.entries(STATUS_CONFIG)
          .map(([key, config]) => `<option value="${key}" ${state.filterStatus === key ? 'selected' : ''}>${escapeHtml(config.label)}</option>`)
          .join('')}
      </select>

      <select class="h-9 w-[140px] rounded-md border bg-background px-3 text-sm" data-handover-field="filterHasDiff">
        <option value="ALL" ${state.filterHasDiff === 'ALL' ? 'selected' : ''}>是否有差异</option>
        <option value="YES" ${state.filterHasDiff === 'YES' ? 'selected' : ''}>有差异</option>
        <option value="NO" ${state.filterHasDiff === 'NO' ? 'selected' : ''}>无差异</option>
      </select>

      <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-handover-action="clear-filters">重置</button>
    </section>
  `
}

function renderRowActionMenu(event: HandoverEvent): string {
  const isOpen = state.rowMenuEventId === event.eventId

  return `
    <div class="relative inline-flex" data-handover-stop="true">
      <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-handover-action="toggle-row-menu" data-event-id="${escapeAttr(event.eventId)}">
        <i data-lucide="more-horizontal" class="h-4 w-4"></i>
      </button>
      ${
        isOpen
          ? `
            <div class="absolute right-0 top-9 z-20 min-w-[170px] rounded-md border bg-popover p-1 shadow-lg">
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-handover-action="open-detail" data-event-id="${escapeAttr(event.eventId)}">
                <i data-lucide="eye" class="mr-2 h-4 w-4"></i>查看详情
              </button>
              ${
                event.status === 'PENDING_CONFIRM'
                  ? `
                    <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-handover-action="open-confirm-dialog" data-event-id="${escapeAttr(event.eventId)}">
                      <i data-lucide="check-circle" class="mr-2 h-4 w-4"></i>确认交接
                    </button>
                  `
                  : ''
              }
              ${
                event.status === 'PENDING_CONFIRM' || (event.status === 'CONFIRMED' && event.qtyDiff !== 0)
                  ? `
                    <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-handover-action="open-dispute-dialog" data-event-id="${escapeAttr(event.eventId)}">
                      <i data-lucide="alert-circle" class="mr-2 h-4 w-4"></i>标记争议
                    </button>
                  `
                  : ''
              }
              <div class="my-1 h-px bg-border"></div>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-handover-action="view-exception" data-event-id="${escapeAttr(event.eventId)}">
                <i data-lucide="alert-triangle" class="mr-2 h-4 w-4"></i>查看异常
              </button>
            </div>
          `
          : ''
      }
    </div>
  `
}

function renderEventsTable(events: HandoverEvent[]): string {
  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-muted/40">
            <tr class="border-b text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">交接单号</th>
              <th class="px-3 py-2 font-medium">生产单号</th>
              <th class="px-3 py-2 font-medium">关联任务</th>
              <th class="px-3 py-2 font-medium">事件类型</th>
              <th class="px-3 py-2 font-medium">发出方 → 接收方</th>
              <th class="px-3 py-2 font-medium text-right">应交/实交/差异</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">发生时间</th>
              <th class="px-3 py-2 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              events.length === 0
                ? `
                  <tr>
                    <td colspan="9" class="px-3 py-10 text-center text-muted-foreground">
                      未找到交接事件
                      <button class="ml-2 inline-flex items-center text-primary hover:underline" data-handover-action="open-new-drawer">可新建交接事件</button>
                    </td>
                  </tr>
                `
                : events
                    .map((event) => {
                      const relatedTask = event.relatedTaskId ? processTasks.find((task) => task.taskId === event.relatedTaskId) : null

                      return `
                        <tr class="border-b">
                          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(event.eventId)}</td>
                          <td class="px-3 py-2">
                            <button class="inline-flex items-center text-xs text-primary hover:underline" data-handover-action="goto-order" data-order-id="${escapeAttr(event.productionOrderId)}">
                              ${escapeHtml(event.productionOrderId)}
                            </button>
                          </td>
                          <td class="px-3 py-2">
                            ${
                              relatedTask
                                ? `
                                  <button class="inline-flex items-center text-xs text-primary hover:underline" data-handover-action="goto-task" data-task-id="${escapeAttr(relatedTask.taskId)}">
                                    ${escapeHtml(relatedTask.processNameZh)} (${escapeHtml(relatedTask.taskId)})
                                  </button>
                                `
                                : '<span class="text-xs text-muted-foreground">-</span>'
                            }
                          </td>
                          <td class="px-3 py-2">
                            <span class="inline-flex items-center gap-1.5 text-xs">
                              <i data-lucide="${EVENT_TYPE_CONFIG[event.eventType].icon}" class="h-3.5 w-3.5"></i>
                              ${escapeHtml(EVENT_TYPE_CONFIG[event.eventType].label)}
                            </span>
                          </td>
                          <td class="px-3 py-2 text-xs">
                            ${escapeHtml(event.fromParty.name)}
                            <i data-lucide="arrow-right" class="mx-1 inline h-3 w-3"></i>
                            ${escapeHtml(event.toParty.name)}
                          </td>
                          <td class="px-3 py-2 text-right font-mono text-xs">
                            ${event.qtyExpected} / ${event.qtyActual} /
                            <span class="${event.qtyDiff !== 0 ? 'font-bold text-red-600' : ''}">${event.qtyDiff > 0 ? '+' : ''}${event.qtyDiff}</span>
                          </td>
                          <td class="px-3 py-2">${renderStatusBadge(event.status)}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(event.occurredAt)}</td>
                          <td class="px-3 py-2 text-right">${renderRowActionMenu(event)}</td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderListTab(events: HandoverEvent[]): string {
  return `
    <div class="space-y-4">
      ${renderListFilters()}
      ${renderEventsTable(events)}
    </div>
  `
}

function renderTimelineTab(): string {
  const orderIds = getOrderIdsWithHandover()
  const timelineOrderId = state.timelineOrderId || orderIds[0] || ''
  const timelineEvents = getTimelineEvents(timelineOrderId)
  const summary = getTimelineSummary(timelineOrderId)

  return `
    <section class="grid gap-4 md:grid-cols-3">
      <article class="overflow-hidden rounded-lg border bg-card md:col-span-1">
        <div class="border-b px-4 py-3 text-sm font-medium">生产单</div>
        <div class="max-h-[500px] overflow-y-auto">
          ${
            orderIds.length === 0
              ? '<div class="px-4 py-10 text-center text-sm text-muted-foreground">暂无交接数据</div>'
              : orderIds
                  .map((orderId) => {
                    const order = getOrderById(orderId)
                    const eventsCount = initialHandoverEvents.filter((event) => event.productionOrderId === orderId).length
                    const pendingCount = initialHandoverEvents.filter((event) => event.productionOrderId === orderId && event.status === 'PENDING_CONFIRM').length
                    const disputedCount = initialHandoverEvents.filter((event) => event.productionOrderId === orderId && event.status === 'DISPUTED').length

                    return `
                      <button
                        class="flex w-full items-center justify-between border-b px-4 py-3 text-left hover:bg-muted ${timelineOrderId === orderId ? 'bg-muted' : ''}"
                        data-handover-action="select-timeline-order"
                        data-order-id="${escapeAttr(orderId)}"
                      >
                        <span>
                          <span class="block font-mono text-sm">${escapeHtml(orderId)}</span>
                          <span class="block text-xs text-muted-foreground">${escapeHtml(order?.demandSnapshot.spuName || '')}</span>
                        </span>
                        <span class="flex items-center gap-1.5 text-xs">
                          ${renderBadge(String(eventsCount), 'bg-background text-foreground border-border')}
                          ${pendingCount > 0 ? renderBadge(String(pendingCount), 'bg-yellow-100 text-yellow-700 border-yellow-200') : ''}
                          ${disputedCount > 0 ? renderBadge(String(disputedCount), 'bg-red-100 text-red-700 border-red-200') : ''}
                          <i data-lucide="chevron-right" class="h-4 w-4 text-muted-foreground"></i>
                        </span>
                      </button>
                    `
                  })
                  .join('')
          }
        </div>
      </article>

      <article class="overflow-hidden rounded-lg border bg-card md:col-span-2">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <p class="text-sm font-medium">${timelineOrderId ? `${escapeHtml(timelineOrderId)} 交接时间线` : '请选择生产单'}</p>
          ${
            timelineOrderId
              ? `
                <div class="flex items-center gap-3 text-xs">
                  <span class="text-yellow-700">待确认: ${summary.pending}</span>
                  <span class="text-green-700">已确认: ${summary.confirmed}</span>
                  <span class="text-red-700">争议: ${summary.disputed}</span>
                </div>
              `
              : ''
          }
        </div>

        ${
          !timelineOrderId
            ? '<div class="flex h-[450px] items-center justify-center text-sm text-muted-foreground">请从左侧选择一个生产单查看交接时间线</div>'
            : `
              <div class="h-[450px] overflow-y-auto p-4">
                <div class="relative pl-6">
                  <div class="absolute bottom-0 left-2 top-0 w-0.5 bg-border"></div>
                  ${
                    timelineEvents.length === 0
                      ? '<div class="py-8 text-center text-sm text-muted-foreground">未找到交接事件</div>'
                      : timelineEvents
                          .map((event) => {
                            const nodeClass =
                              event.status === 'CONFIRMED'
                                ? 'border-green-500'
                                : event.status === 'PENDING_CONFIRM'
                                  ? 'border-yellow-500'
                                  : event.status === 'DISPUTED'
                                    ? 'border-red-500'
                                    : 'border-zinc-300'

                            return `
                              <div class="relative pb-6 last:pb-0">
                                <div class="absolute left-[-20px] h-4 w-4 rounded-full border-2 bg-background ${nodeClass}"></div>
                                <button
                                  class="ml-4 w-[calc(100%-1rem)] rounded-lg border bg-background p-3 text-left shadow-sm transition hover:shadow-md"
                                  data-handover-action="open-detail"
                                  data-event-id="${escapeAttr(event.eventId)}"
                                >
                                  <div class="flex items-start justify-between gap-3">
                                    <div>
                                      <p class="inline-flex items-center gap-2 text-sm font-medium">
                                        <i data-lucide="${EVENT_TYPE_CONFIG[event.eventType].icon}" class="h-4 w-4"></i>
                                        ${escapeHtml(EVENT_TYPE_CONFIG[event.eventType].label)}
                                        ${renderStatusBadge(event.status)}
                                      </p>
                                      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(event.fromParty.name)} → ${escapeHtml(event.toParty.name)}</p>
                                      <p class="mt-1 text-xs">应交: ${event.qtyExpected} | 实交: ${event.qtyActual} | 差异: <span class="${event.qtyDiff !== 0 ? 'font-bold text-red-600' : ''}">${event.qtyDiff > 0 ? '+' : ''}${event.qtyDiff}</span></p>
                                      ${event.evidence.length > 0 ? `<p class="mt-1 text-xs text-muted-foreground">附件: ${event.evidence.length} 个</p>` : ''}
                                    </div>
                                    <div class="shrink-0 text-right text-xs text-muted-foreground">
                                      <p>${escapeHtml(event.occurredAt.slice(0, 10))}</p>
                                      <p>${escapeHtml(event.occurredAt.slice(11, 16))}</p>
                                    </div>
                                  </div>
                                </button>
                              </div>
                            `
                          })
                          .join('')
                  }
                </div>
              </div>
            `
        }
      </article>
    </section>
  `
}

function renderPartySelect(kindField: 'formFromKind' | 'formToKind', idField: 'formFromId' | 'formToId', nameField: 'formFromName' | 'formToName'): string {
  const kind = state[kindField]
  const id = state[idField]
  const name = state[nameField]

  return `
    <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-handover-field="${kindField}">
      ${Object.entries(PARTY_KIND_CONFIG)
        .map(([key, config]) => `<option value="${key}" ${kind === key ? 'selected' : ''}>${escapeHtml(config.label)}</option>`)
        .join('')}
    </select>
    ${
      kind === 'FACTORY'
        ? `
          <select class="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm" data-handover-field="${idField}">
            <option value="">选择工厂</option>
            ${indonesiaFactories
              .map((factory) => `<option value="${escapeAttr(factory.id)}" ${id === factory.id ? 'selected' : ''}>${escapeHtml(factory.name)}</option>`)
              .join('')}
          </select>
        `
        : `
          <input
            class="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="名称"
            value="${escapeAttr(name)}"
            data-handover-field="${nameField}"
          />
        `
    }
  `
}

function renderNewDrawer(): string {
  if (!state.newDrawerOpen) return ''

  const orderTasks = state.formOrderId ? getTasksByOrderId(state.formOrderId) : []
  const diff = state.formActual - state.formExpected

  return `
    <div class="fixed inset-0 z-[55]">
      <button class="absolute inset-0 bg-black/45" data-handover-action="close-new-drawer" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full max-w-[500px] overflow-y-auto border-l bg-background shadow-2xl">
        <header class="sticky top-0 z-10 border-b bg-background/95 px-5 py-4 backdrop-blur">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h3 class="text-lg font-semibold">新增交接事件</h3>
              <p class="text-sm text-muted-foreground">生产交接事件追踪与管理</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-handover-action="close-new-drawer" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
        </header>

        <div class="space-y-5 px-5 py-5">
          <section class="space-y-3">
            <h4 class="text-sm font-medium">关联对象</h4>

            <label class="space-y-1">
              <span class="text-sm">选择生产单 *</span>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-handover-field="formOrderId">
                <option value="">选择生产单</option>
                ${productionOrders
                  .map(
                    (order) =>
                      `<option value="${escapeAttr(order.productionOrderId)}" ${state.formOrderId === order.productionOrderId ? 'selected' : ''}>${escapeHtml(order.productionOrderId)} - ${escapeHtml(order.demandSnapshot.spuName)}</option>`,
                  )
                  .join('')}
              </select>
            </label>

            ${
              state.formOrderId
                ? `
                  <label class="space-y-1">
                    <span class="text-sm">关联任务（可选）</span>
                    <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-handover-field="formTaskId">
                      <option value="">不关联任务</option>
                      ${orderTasks
                        .map((task) => `<option value="${escapeAttr(task.taskId)}" ${state.formTaskId === task.taskId ? 'selected' : ''}>${escapeHtml(task.processNameZh)} (${escapeHtml(task.taskId)})</option>`)
                        .join('')}
                    </select>
                  </label>
                `
                : ''
            }
          </section>

          <section class="space-y-3 border-t pt-4">
            <h4 class="text-sm font-medium">事件信息</h4>

            <label class="space-y-1">
              <span class="text-sm">事件类型 *</span>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-handover-field="formEventType">
                ${Object.entries(EVENT_TYPE_CONFIG)
                  .map(([key, config]) => `<option value="${key}" ${state.formEventType === key ? 'selected' : ''}>${escapeHtml(config.label)}</option>`)
                  .join('')}
              </select>
            </label>

            <div class="grid grid-cols-2 gap-3">
              <label class="space-y-1">
                <span class="text-sm">发出方 *</span>
                ${renderPartySelect('formFromKind', 'formFromId', 'formFromName')}
              </label>
              <label class="space-y-1">
                <span class="text-sm">接收方 *</span>
                ${renderPartySelect('formToKind', 'formToId', 'formToName')}
              </label>
            </div>
          </section>

          <section class="space-y-3 border-t pt-4">
            <h4 class="text-sm font-medium">数量信息</h4>

            <div class="grid grid-cols-3 gap-3">
              <label class="space-y-1">
                <span class="text-sm">应交数量</span>
                <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="number" value="${state.formExpected}" data-handover-field="formExpected" />
              </label>

              <label class="space-y-1">
                <span class="text-sm">实交数量 *</span>
                <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="number" value="${state.formActual}" data-handover-field="formActual" />
              </label>

              <div class="space-y-1">
                <span class="text-sm">差异</span>
                <div class="${toClassName('flex h-9 items-center rounded-md border bg-muted px-3 font-mono text-sm', diff !== 0 && 'font-bold text-red-600')}">${diff > 0 ? '+' : ''}${diff}</div>
              </div>
            </div>

            ${
              diff !== 0
                ? `
                  <label class="space-y-1">
                    <span class="text-sm">差异原因 *</span>
                    <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-handover-field="formDiffReason">
                      <option value="">选择差异原因</option>
                      ${Object.entries(DIFF_REASON_CONFIG)
                        .map(([key, label]) => `<option value="${key}" ${state.formDiffReason === key ? 'selected' : ''}>${escapeHtml(label)}</option>`)
                        .join('')}
                    </select>
                  </label>
                  <label class="space-y-1">
                    <span class="text-sm">差异备注</span>
                    <textarea class="min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="填写差异备注" data-handover-field="formDiffRemark">${escapeHtml(state.formDiffRemark)}</textarea>
                  </label>
                `
                : ''
            }
          </section>

          <section class="space-y-1 border-t pt-4">
            <span class="text-sm">发生时间</span>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="datetime-local" value="${escapeAttr(state.formOccurredAt)}" data-handover-field="formOccurredAt" />
          </section>
        </div>

        <footer class="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-background px-5 py-4">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-handover-action="close-new-drawer">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-handover-action="save-pending">暂存为待确认</button>
          <button class="inline-flex h-9 items-center rounded-md border bg-primary px-4 text-sm text-primary-foreground hover:opacity-90" data-handover-action="save-and-confirm">保存并确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderDetailDrawer(): string {
  if (!state.detailEventId) return ''

  const event = getHandoverEventById(state.detailEventId)
  if (!event) return ''

  const canConfirm = event.status === 'PENDING_CONFIRM'
  const canDispute = event.status === 'PENDING_CONFIRM' || (event.status === 'CONFIRMED' && event.qtyDiff !== 0)

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-handover-action="close-detail" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full max-w-[500px] overflow-y-auto border-l bg-background shadow-2xl">
        <header class="sticky top-0 z-10 border-b bg-background/95 px-5 py-4 backdrop-blur">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h3 class="text-lg font-semibold">交接事件详情</h3>
              <p class="font-mono text-xs text-muted-foreground">${escapeHtml(event.eventId)}</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-handover-action="close-detail" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
        </header>

        <div class="space-y-5 px-5 py-5">
          <div class="flex items-center gap-2">
            ${renderStatusBadge(event.status)}
            ${event.qtyDiff !== 0 ? renderBadge('交接差异', 'bg-red-100 text-red-700 border-red-200') : ''}
          </div>

          <section class="space-y-3">
            <h4 class="text-sm font-medium">事件信息</h4>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p class="text-xs text-muted-foreground">生产单号</p>
                <p class="font-mono">${escapeHtml(event.productionOrderId)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">关联任务</p>
                <p class="font-mono">${escapeHtml(event.relatedTaskId || '-')}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">事件类型</p>
                <p>${escapeHtml(EVENT_TYPE_CONFIG[event.eventType].label)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">发生时间</p>
                <p>${escapeHtml(event.occurredAt)}</p>
              </div>
            </div>
          </section>

          <section class="space-y-3 border-t pt-4">
            <div class="flex items-center gap-2">
              <article class="flex-1 rounded-lg border p-3">
                <p class="text-xs text-muted-foreground">发出方</p>
                <p class="font-medium">${escapeHtml(event.fromParty.name)}</p>
                <p class="text-xs text-muted-foreground">${escapeHtml(PARTY_KIND_CONFIG[event.fromParty.kind].label)}</p>
              </article>
              <i data-lucide="arrow-right" class="h-5 w-5 text-muted-foreground"></i>
              <article class="flex-1 rounded-lg border p-3">
                <p class="text-xs text-muted-foreground">接收方</p>
                <p class="font-medium">${escapeHtml(event.toParty.name)}</p>
                <p class="text-xs text-muted-foreground">${escapeHtml(PARTY_KIND_CONFIG[event.toParty.kind].label)}</p>
              </article>
            </div>
          </section>

          <section class="space-y-3 border-t pt-4">
            <h4 class="text-sm font-medium">数量信息</h4>
            <div class="grid grid-cols-3 gap-3">
              <article class="rounded-lg border p-3 text-center">
                <p class="text-xs text-muted-foreground">应交数量</p>
                <p class="text-lg font-bold">${event.qtyExpected}</p>
              </article>
              <article class="rounded-lg border p-3 text-center">
                <p class="text-xs text-muted-foreground">实交数量</p>
                <p class="text-lg font-bold">${event.qtyActual}</p>
              </article>
              <article class="${toClassName('rounded-lg border p-3 text-center', event.qtyDiff !== 0 && 'border-red-200 bg-red-50')}">
                <p class="text-xs text-muted-foreground">差异</p>
                <p class="${toClassName('text-lg font-bold', event.qtyDiff !== 0 && 'text-red-600')}">${event.qtyDiff > 0 ? '+' : ''}${event.qtyDiff}</p>
              </article>
            </div>
            ${event.diffReasonCode ? `<p class="text-sm"><span class="text-xs text-muted-foreground">差异原因</span><br/>${escapeHtml(DIFF_REASON_CONFIG[event.diffReasonCode])}</p>` : ''}
            ${event.diffRemark ? `<p class="text-sm"><span class="text-xs text-muted-foreground">差异备注</span><br/>${escapeHtml(event.diffRemark)}</p>` : ''}
          </section>

          <section class="space-y-3 border-t pt-4">
            <h4 class="text-sm font-medium">证据附件</h4>
            ${
              event.evidence.length > 0
                ? `
                  <div class="space-y-2">
                    ${event.evidence
                      .map(
                        (evidence) => `
                          <div class="flex items-center gap-2 text-sm">
                            <i data-lucide="${evidence.type === 'PHOTO' ? 'camera' : 'file-text'}" class="h-4 w-4"></i>
                            <span>${escapeHtml(evidence.name)}</span>
                          </div>
                        `,
                      )
                      .join('')}
                  </div>
                `
                : '<p class="text-sm text-muted-foreground">无附件</p>'
            }
          </section>

          <section class="space-y-3 border-t pt-4">
            <h4 class="text-sm font-medium">操作日志</h4>
            <div class="space-y-2">
              ${event.auditLogs
                .map(
                  (log) => `
                    <div class="flex items-start gap-2 text-xs">
                      <p class="w-28 shrink-0 text-muted-foreground">${escapeHtml(log.at)}</p>
                      <p><span class="font-medium">${escapeHtml(log.by)}</span>: ${escapeHtml(log.detail)}</p>
                    </div>
                  `,
                )
                .join('')}
            </div>
          </section>
        </div>

        <footer class="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-background px-5 py-4">
          ${
            canConfirm
              ? `
                <button class="inline-flex h-9 items-center rounded-md border bg-primary px-3 text-sm text-primary-foreground hover:opacity-90" data-handover-action="open-confirm-dialog" data-event-id="${escapeAttr(event.eventId)}">
                  <i data-lucide="check-circle" class="mr-1.5 h-4 w-4"></i>确认交接
                </button>
              `
              : ''
          }

          ${
            canDispute
              ? `
                <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-handover-action="open-dispute-dialog" data-event-id="${escapeAttr(event.eventId)}">
                  <i data-lucide="alert-circle" class="mr-1.5 h-4 w-4"></i>标记争议
                </button>
              `
              : ''
          }

          ${
            event.status === 'PENDING_CONFIRM' && event.toParty.id
              ? `
                <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-handover-action="urge-confirm" data-event-id="${escapeAttr(event.eventId)}">
                  <i data-lucide="bell" class="mr-1.5 h-4 w-4"></i>催确认
                </button>
              `
              : ''
          }

          ${
            event.status === 'DISPUTED' && event.toParty.id
              ? `
                <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-handover-action="urge-dispute" data-event-id="${escapeAttr(event.eventId)}">
                  <i data-lucide="bell" class="mr-1.5 h-4 w-4"></i>催处理差异
                </button>
              `
              : ''
          }

          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-handover-action="view-exception" data-event-id="${escapeAttr(event.eventId)}">
            <i data-lucide="external-link" class="mr-1.5 h-4 w-4"></i>查看异常
          </button>

          ${
            event.status !== 'VOID'
              ? `
                <button class="inline-flex h-9 items-center rounded-md border border-red-200 bg-red-50 px-3 text-sm text-red-700 hover:bg-red-100" data-handover-action="void-event" data-event-id="${escapeAttr(event.eventId)}">
                  作废
                </button>
              `
              : ''
          }
        </footer>
      </section>
    </div>
  `
}

function renderConfirmDialog(): string {
  if (!state.confirmEventId) return ''

  const event = getHandoverEventById(state.confirmEventId)
  if (!event) return ''

  return `
    <div class="fixed inset-0 z-[60]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-handover-action="close-confirm-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <header class="space-y-1">
          <h3 class="text-lg font-semibold">确认交接</h3>
          <p class="text-sm text-muted-foreground">${event.qtyDiff !== 0 ? '存在差异，确认后将自动生成异常单' : '确认此交接事件？'}</p>
        </header>

        <div class="mt-4 space-y-2 text-sm">
          <p>交接单号: ${escapeHtml(event.eventId)}</p>
          <p>生产单: ${escapeHtml(event.productionOrderId)}</p>
          <p>应交: ${event.qtyExpected} | 实交: ${event.qtyActual} | 差异: ${event.qtyDiff > 0 ? '+' : ''}${event.qtyDiff}</p>
        </div>

        <footer class="mt-6 flex justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-handover-action="close-confirm-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border bg-primary px-4 text-sm text-primary-foreground hover:opacity-90" data-handover-action="confirm-event" data-event-id="${escapeAttr(event.eventId)}">确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderDisputeDialog(): string {
  if (!state.disputeEventId) return ''

  const event = getHandoverEventById(state.disputeEventId)
  if (!event) return ''

  return `
    <div class="fixed inset-0 z-[60]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-handover-action="close-dispute-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <header class="space-y-1">
          <h3 class="text-lg font-semibold">标记争议</h3>
          <p class="text-sm text-muted-foreground">请填写争议原因</p>
        </header>

        <div class="mt-4 space-y-1">
          <p class="text-sm text-muted-foreground">交接单号：${escapeHtml(event.eventId)}</p>
          <textarea class="mt-2 min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="请填写争议原因" data-handover-field="disputeReason">${escapeHtml(state.disputeReason)}</textarea>
        </div>

        <footer class="mt-6 flex justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-handover-action="close-dispute-dialog">取消</button>
          <button class="${toClassName('inline-flex h-9 items-center rounded-md px-4 text-sm', state.disputeReason.trim() ? 'border bg-primary text-primary-foreground hover:opacity-90' : 'cursor-not-allowed border border-muted-foreground/20 bg-muted text-muted-foreground')}" data-handover-action="confirm-dispute" data-event-id="${escapeAttr(event.eventId)}" ${state.disputeReason.trim() ? '' : 'disabled'}>确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderPage(): string {
  syncFromQuery()

  const events = getFilteredEvents()
  const kpi = getKpiStats()

  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderUrlBanner()}
      ${renderKpis(kpi)}
      ${renderTabs()}
      ${state.activeTab === 'list' ? renderListTab(events) : renderTimelineTab()}
      ${renderNewDrawer()}
      ${renderDetailDrawer()}
      ${renderConfirmDialog()}
      ${renderDisputeDialog()}
    </div>
  `
}

function handleSelectOrder(orderId: string): void {
  state.formOrderId = orderId
  state.formTaskId = ''

  const order = getOrderById(orderId)
  if (!order) {
    state.formExpected = 0
    state.formActual = 0
    return
  }

  const totalQty = order.demandSnapshot.skuLines.reduce((sum, sku) => sum + sku.qty, 0)
  state.formExpected = totalQty
  state.formActual = totalQty

  state.formToKind = 'FACTORY'
  state.formToId = order.mainFactoryId
  state.formToName = order.mainFactorySnapshot.name
}

function buildExceptionHrefByEvent(event: HandoverEvent): string {
  const params = new URLSearchParams()
  params.set('po', event.productionOrderId)
  if (event.relatedTaskId) {
    params.set('taskId', event.relatedTaskId)
  }
  params.set('reasonCode', 'HANDOVER_DIFF')

  return `/fcs/progress/exceptions?${params.toString()}`
}

function handleSaveEvent(andConfirm: boolean): void {
  if (!state.formOrderId) {
    showProgressHandoverToast('请选择生产单', 'error')
    return
  }

  if (state.formFromKind === 'FACTORY' && !state.formFromId) {
    showProgressHandoverToast('请选择发出方工厂', 'error')
    return
  }

  if (state.formToKind === 'FACTORY' && !state.formToId) {
    showProgressHandoverToast('请选择接收方工厂', 'error')
    return
  }

  if (state.formFromKind !== 'FACTORY' && !state.formFromName.trim()) {
    showProgressHandoverToast('请填写发出方名称', 'error')
    return
  }

  if (state.formToKind !== 'FACTORY' && !state.formToName.trim()) {
    showProgressHandoverToast('请填写接收方名称', 'error')
    return
  }

  const qtyDiff = state.formActual - state.formExpected
  if (qtyDiff !== 0 && !state.formDiffReason) {
    showProgressHandoverToast('有差异时必须填写差异原因', 'error')
    return
  }

  const fromFactory = state.formFromKind === 'FACTORY' ? getFactoryById(state.formFromId) : undefined
  const toFactory = state.formToKind === 'FACTORY' ? getFactoryById(state.formToId) : undefined

  const fromParty: HandoverParty = {
    kind: state.formFromKind,
    id: state.formFromKind === 'FACTORY' ? state.formFromId : undefined,
    name: state.formFromKind === 'FACTORY' ? fromFactory?.name || state.formFromId : state.formFromName.trim(),
  }

  const toParty: HandoverParty = {
    kind: state.formToKind,
    id: state.formToKind === 'FACTORY' ? state.formToId : undefined,
    name: state.formToKind === 'FACTORY' ? toFactory?.name || state.formToId : state.formToName.trim(),
  }

  const now = nowTimestamp()

  createHandoverEvent({
    productionOrderId: state.formOrderId,
    relatedTaskId: state.formTaskId || undefined,
    eventType: state.formEventType,
    fromParty,
    toParty,
    qtyExpected: state.formExpected,
    qtyActual: state.formActual,
    qtyDiff,
    diffReasonCode: state.formDiffReason || undefined,
    diffRemark: state.formDiffRemark || undefined,
    status: andConfirm ? (qtyDiff !== 0 ? 'DISPUTED' : 'CONFIRMED') : 'PENDING_CONFIRM',
    occurredAt: `${state.formOccurredAt.replace('T', ' ')}:00`,
    createdBy: 'Admin',
    confirmedAt: andConfirm ? now : undefined,
    confirmedBy: andConfirm ? 'Admin' : undefined,
    evidence: [],
  })

  showProgressHandoverToast('交接事件已创建')
  state.newDrawerOpen = false
  resetForm()
}

function updateField(field: string, node: HTMLElement): void {
  if (field === 'keyword' && node instanceof HTMLInputElement) {
    state.keyword = node.value
    return
  }

  if (field === 'filterEventType' && node instanceof HTMLSelectElement) {
    state.filterEventType = isEventType(node.value) ? node.value : 'ALL'
    return
  }

  if (field === 'filterStatus' && node instanceof HTMLSelectElement) {
    state.filterStatus = isHandoverStatus(node.value) ? node.value : 'ALL'
    return
  }

  if (field === 'filterHasDiff' && node instanceof HTMLSelectElement) {
    if (node.value === 'ALL' || node.value === 'YES' || node.value === 'NO') {
      state.filterHasDiff = node.value
    }
    return
  }

  if (field === 'formOrderId' && node instanceof HTMLSelectElement) {
    handleSelectOrder(node.value)
    return
  }

  if (field === 'formTaskId' && node instanceof HTMLSelectElement) {
    state.formTaskId = node.value
    return
  }

  if (field === 'formEventType' && node instanceof HTMLSelectElement) {
    if (isEventType(node.value)) {
      state.formEventType = node.value
    }
    return
  }

  if (field === 'formFromKind' && node instanceof HTMLSelectElement) {
    if (!isPartyKind(node.value)) return
    state.formFromKind = node.value
    state.formFromId = ''
    state.formFromName = ''
    return
  }

  if (field === 'formFromId' && node instanceof HTMLSelectElement) {
    state.formFromId = node.value
    const factory = getFactoryById(node.value)
    state.formFromName = factory?.name || ''
    return
  }

  if (field === 'formFromName' && node instanceof HTMLInputElement) {
    state.formFromName = node.value
    return
  }

  if (field === 'formToKind' && node instanceof HTMLSelectElement) {
    if (!isPartyKind(node.value)) return
    state.formToKind = node.value
    state.formToId = ''
    state.formToName = ''
    return
  }

  if (field === 'formToId' && node instanceof HTMLSelectElement) {
    state.formToId = node.value
    const factory = getFactoryById(node.value)
    state.formToName = factory?.name || ''
    return
  }

  if (field === 'formToName' && node instanceof HTMLInputElement) {
    state.formToName = node.value
    return
  }

  if (field === 'formExpected' && node instanceof HTMLInputElement) {
    state.formExpected = Number(node.value) || 0
    return
  }

  if (field === 'formActual' && node instanceof HTMLInputElement) {
    state.formActual = Number(node.value) || 0
    return
  }

  if (field === 'formDiffReason' && node instanceof HTMLSelectElement) {
    state.formDiffReason = isDiffReasonCode(node.value) ? node.value : ''
    return
  }

  if (field === 'formDiffRemark' && node instanceof HTMLTextAreaElement) {
    state.formDiffRemark = node.value
    return
  }

  if (field === 'formOccurredAt' && node instanceof HTMLInputElement) {
    state.formOccurredAt = node.value
    return
  }

  if (field === 'disputeReason' && node instanceof HTMLTextAreaElement) {
    state.disputeReason = node.value
  }
}

function handleAction(action: string, actionNode: HTMLElement): boolean {
  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab
    if (tab === 'list' || tab === 'timeline') {
      state.activeTab = tab
    }
    return true
  }

  if (action === 'refresh') {
    showProgressHandoverToast('数据已刷新')
    return true
  }

  if (action === 'clear-filters') {
    state.keyword = ''
    state.filterPo = ''
    state.filterTaskId = ''
    state.filterEventType = 'ALL'
    state.filterStatus = 'ALL'
    state.filterHasDiff = 'ALL'
    state.showUrlFilterBanner = false
    appStore.navigate('/fcs/progress/handover')
    return true
  }

  if (action === 'toggle-pending-filter') {
    state.filterStatus = state.filterStatus === 'PENDING_CONFIRM' ? 'ALL' : 'PENDING_CONFIRM'
    return true
  }

  if (action === 'toggle-disputed-filter') {
    state.filterStatus = state.filterStatus === 'DISPUTED' ? 'ALL' : 'DISPUTED'
    return true
  }

  if (action === 'open-new-drawer') {
    state.newDrawerOpen = true
    return true
  }

  if (action === 'close-new-drawer') {
    state.newDrawerOpen = false
    resetForm()
    return true
  }

  if (action === 'save-pending') {
    handleSaveEvent(false)
    return true
  }

  if (action === 'save-and-confirm') {
    handleSaveEvent(true)
    return true
  }

  if (action === 'toggle-row-menu') {
    const eventId = actionNode.dataset.eventId
    if (!eventId) return true
    state.rowMenuEventId = state.rowMenuEventId === eventId ? null : eventId
    return true
  }

  if (action === 'open-detail') {
    const eventId = actionNode.dataset.eventId
    if (eventId) {
      state.detailEventId = eventId
    }
    closeRowMenu()
    return true
  }

  if (action === 'close-detail') {
    state.detailEventId = null
    return true
  }

  if (action === 'open-confirm-dialog') {
    const eventId = actionNode.dataset.eventId
    if (eventId) {
      state.confirmEventId = eventId
    }
    closeRowMenu()
    return true
  }

  if (action === 'close-confirm-dialog') {
    state.confirmEventId = null
    return true
  }

  if (action === 'confirm-event') {
    const eventId = actionNode.dataset.eventId
    if (!eventId) return true
    confirmHandoverEvent(eventId, 'Admin')
    state.confirmEventId = null
    state.detailEventId = null
    showProgressHandoverToast('交接已确认')
    return true
  }

  if (action === 'open-dispute-dialog') {
    const eventId = actionNode.dataset.eventId
    if (eventId) {
      state.disputeEventId = eventId
      state.disputeReason = ''
    }
    closeRowMenu()
    return true
  }

  if (action === 'close-dispute-dialog') {
    state.disputeEventId = null
    state.disputeReason = ''
    return true
  }

  if (action === 'confirm-dispute') {
    const eventId = actionNode.dataset.eventId
    if (!eventId || !state.disputeReason.trim()) {
      showProgressHandoverToast('请填写争议原因', 'error')
      return true
    }
    markHandoverDisputed(eventId, state.disputeReason.trim(), 'Admin')
    state.disputeEventId = null
    state.disputeReason = ''
    state.detailEventId = null
    showProgressHandoverToast('已标记为争议')
    return true
  }

  if (action === 'void-event') {
    const eventId = actionNode.dataset.eventId
    if (!eventId) return true
    voidHandoverEvent(eventId, 'Admin')
    state.detailEventId = null
    showProgressHandoverToast('交接事件已作废')
    return true
  }

  if (action === 'view-exception') {
    const eventId = actionNode.dataset.eventId
    const event = eventId ? getHandoverEventById(eventId) : undefined
    if (event) {
      openLinkedPage('异常定位', buildExceptionHrefByEvent(event))
    }
    closeRowMenu()
    return true
  }

  if (action === 'urge-confirm') {
    const eventId = actionNode.dataset.eventId
    const event = eventId ? getHandoverEventById(eventId) : undefined
    if (!event || !event.toParty.id) return true

    const toType: RecipientType = event.toParty.kind === 'FACTORY' ? 'FACTORY' : 'INTERNAL_USER'

    createUrge({
      urgeType: 'URGE_HANDOVER_CONFIRM',
      fromType: 'INTERNAL_USER',
      fromId: 'U002',
      fromName: '跟单A',
      toType,
      toId: event.toParty.id,
      toName: event.toParty.name,
      targetType: 'HANDOVER',
      targetId: event.eventId,
      message: `请尽快确认交接事件 ${event.eventId}`,
      deepLink: {
        path: '/fcs/progress/handover',
        query: { eventId: event.eventId },
      },
    })

    showProgressHandoverToast('催办已发送')
    return true
  }

  if (action === 'urge-dispute') {
    const eventId = actionNode.dataset.eventId
    const event = eventId ? getHandoverEventById(eventId) : undefined
    if (!event || !event.toParty.id) return true

    const toType: RecipientType = event.toParty.kind === 'FACTORY' ? 'FACTORY' : 'INTERNAL_USER'

    createUrge({
      urgeType: 'URGE_HANDOVER_EVIDENCE',
      fromType: 'INTERNAL_USER',
      fromId: 'U002',
      fromName: '跟单A',
      toType,
      toId: event.toParty.id,
      toName: event.toParty.name,
      targetType: 'HANDOVER',
      targetId: event.eventId,
      message: `请补充证据或处理交接差异 ${event.eventId}`,
      deepLink: {
        path: '/fcs/progress/handover',
        query: { eventId: event.eventId },
      },
    })

    showProgressHandoverToast('催办已发送')
    return true
  }

  if (action === 'goto-order') {
    const orderId = actionNode.dataset.orderId
    if (orderId) {
      openLinkedPage(`生产单 ${orderId}`, `/fcs/production/orders/${encodeURIComponent(orderId)}`)
    }
    return true
  }

  if (action === 'goto-task') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      openLinkedPage('任务进度看板', `/fcs/progress/board?taskId=${encodeURIComponent(taskId)}`)
    }
    return true
  }

  if (action === 'select-timeline-order') {
    const orderId = actionNode.dataset.orderId
    if (orderId) {
      state.timelineOrderId = orderId
    }
    return true
  }

  return false
}

export function renderProgressHandoverPage(): string {
  return renderPage()
}

export function handleProgressHandoverEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-handover-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement || fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.handoverField
    if (!field) return true
    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-handover-action]')
  if (!actionNode) {
    if (state.rowMenuEventId) {
      closeRowMenu()
      return true
    }
    return false
  }

  const action = actionNode.dataset.handoverAction
  if (!action) return false

  return handleAction(action, actionNode)
}

export function isProgressHandoverDialogOpen(): boolean {
  return Boolean(state.newDrawerOpen || state.detailEventId || state.confirmEventId || state.disputeEventId)
}
