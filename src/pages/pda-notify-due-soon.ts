import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import { processTasks } from '../data/fcs/process-tasks'
import { indonesiaFactories } from '../data/fcs/indonesia-factories'
import { formatRemainingHours, getTaskStartDueInfo, syncPdaStartRiskAndExceptions } from '../data/fcs/pda-start-link'
import { renderPdaFrame } from './pda-shell'

type DueSoonCategory = '全部' | '接单类' | '报价类' | '交接类' | '执行类'

interface DueSoonItem {
  id: string
  category: Exclude<DueSoonCategory, '全部'>
  subtype: '待接单' | '待报价' | '待领料' | '待接收' | '待交出' | '执行进行中' | '开工预期'
  taskId?: string
  eventId?: string
  tenderId?: string
  productionOrderId?: string
  processName?: string
  currentFactory?: string
  fromParty?: string
  toParty?: string
  currentProcess?: string
  prevProcess?: string
  deadlineLabel: string
  deadline: string
  statusLabel: string
  riskNote?: string
  href: string
}

interface DueSoonState {
  activeCategory: DueSoonCategory
  search: string
}

const state: DueSoonState = {
  activeCategory: '全部',
  search: '',
}

const NOW = new Date()
const SOON_THRESHOLD_MS = 24 * 3600 * 1000

function parseDateMs(value: string): number {
  return new Date(value.replace(' ', 'T')).getTime()
}

function formatDateTime(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

function addHours(base: Date, hours: number): string {
  return formatDateTime(new Date(base.getTime() + hours * 3600 * 1000))
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}

function msUntil(deadline: string): number {
  return parseDateMs(deadline) - NOW.getTime()
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '已逾期'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h >= 1) return `剩余 ${h} 小时 ${m} 分钟`
  return `剩余 ${m} 分钟`
}

function isSoonDue(deadline: string): boolean {
  const ms = msUntil(deadline)
  return ms > 0 && ms < SOON_THRESHOLD_MS
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

function getFactoryName(factoryId: string): string {
  const factory = indonesiaFactories.find((item) => item.id === factoryId)
  return factory?.name ?? factoryId
}

const DUE_SOON_MOCK: DueSoonItem[] = [
  {
    id: 'recv-PDA-RECV-001',
    category: '接单类',
    subtype: '待接单',
    taskId: 'PDA-RECV-001',
    productionOrderId: 'PO-2024-0030',
    processName: '裁片',
    currentFactory: 'PT Sinar Garment Indonesia',
    deadlineLabel: '接单截止时间',
    deadline: addHours(NOW, 3),
    statusLabel: '待接单',
    riskNote: '距接单截止不足 12 小时，请尽快确认',
    href: '/fcs/pda/task-receive/PDA-RECV-001',
  },
  {
    id: 'recv-PDA-RECV-002',
    category: '接单类',
    subtype: '待接单',
    taskId: 'PDA-RECV-002',
    productionOrderId: 'PO-2024-0031',
    processName: '车缝',
    currentFactory: 'PT Sinar Garment Indonesia',
    deadlineLabel: '接单截止时间',
    deadline: addHours(NOW, 9),
    statusLabel: '待接单',
    riskNote: '距接单截止不足 20 小时',
    href: '/fcs/pda/task-receive/PDA-RECV-002',
  },
  {
    id: 'recv-PDA-RECV-003',
    category: '接单类',
    subtype: '待接单',
    taskId: 'PDA-RECV-003',
    productionOrderId: 'PO-2024-0032',
    processName: '整烫',
    currentFactory: 'PT Sinar Garment Indonesia',
    deadlineLabel: '接单截止时间',
    deadline: addHours(NOW, 1.5),
    statusLabel: '待接单',
    riskNote: '距接单截止不足 4 小时，紧急',
    href: '/fcs/pda/task-receive/PDA-RECV-003',
  },
  {
    id: 'quote-TENDER-PDA-003',
    category: '报价类',
    subtype: '待报价',
    tenderId: 'TENDER-PDA-003',
    taskId: 'TENDER-PDA-003',
    productionOrderId: 'PO-2024-0018',
    processName: '车缝',
    deadlineLabel: '竞价截止时间',
    deadline: addHours(NOW, 6),
    statusLabel: '待报价',
    riskNote: '竞价窗口即将关闭，共 1600 件',
    href: '/fcs/pda/task-receive?tab=pending-quote',
  },
  {
    id: 'quote-TENDER-DUE-001',
    category: '报价类',
    subtype: '待报价',
    tenderId: 'TENDER-DUE-001',
    taskId: 'TENDER-DUE-001',
    productionOrderId: 'PO-2024-0050',
    processName: '整烫',
    deadlineLabel: '竞价截止时间',
    deadline: addHours(NOW, 4),
    statusLabel: '待报价',
    riskNote: '距竞价截止仅剩 8 小时，2200 件整烫单',
    href: '/fcs/pda/task-receive?tab=pending-quote',
  },
  {
    id: 'quote-TENDER-DUE-002',
    category: '报价类',
    subtype: '待报价',
    tenderId: 'TENDER-DUE-002',
    taskId: 'TENDER-DUE-002',
    productionOrderId: 'PO-2024-0051',
    processName: '包装',
    deadlineLabel: '竞价截止时间',
    deadline: addHours(NOW, 11),
    statusLabel: '待报价',
    riskNote: '包装工序竞价，共 3000 件',
    href: '/fcs/pda/task-receive?tab=pending-quote',
  },
  {
    id: 'pickup-EV-PK-004',
    category: '交接类',
    subtype: '待领料',
    eventId: 'EV-PK-004',
    taskId: 'PDA-EXEC-007',
    productionOrderId: 'PO-2024-0017',
    currentProcess: '裁片',
    fromParty: '万隆织带辅料仓',
    deadlineLabel: '领料要求时间',
    deadline: addHours(NOW, 8),
    statusLabel: '待领料',
    riskNote: '织带辅料仓库库存差 50 件待补货，需提前确认',
    href: '/fcs/pda/handover/EV-PK-004',
  },
  {
    id: 'pickup-EV-PK-003',
    category: '交接类',
    subtype: '待领料',
    eventId: 'EV-PK-003',
    taskId: 'PDA-EXEC-005',
    productionOrderId: 'PO-2024-0015',
    currentProcess: '裁片',
    fromParty: '雅加达中央面料仓',
    deadlineLabel: '领料要求时间',
    deadline: addHours(NOW, 2.5),
    statusLabel: '待领料',
    riskNote: '梭织面料已就位，请在截止前完成领料确认',
    href: '/fcs/pda/handover/EV-PK-003',
  },
  {
    id: 'receive-EV-RC-003',
    category: '交接类',
    subtype: '待接收',
    eventId: 'EV-RC-003',
    taskId: 'PDA-EXEC-006',
    productionOrderId: 'PO-2024-0016',
    currentProcess: '车缝',
    prevProcess: '裁片',
    fromParty: '棉兰卫星工厂',
    deadlineLabel: '接收要求时间',
    deadline: addHours(NOW, 7),
    statusLabel: '待接收',
    riskNote: 'QC 发现 45 件尺寸偏差，接收前需核实处理方案',
    href: '/fcs/pda/handover/EV-RC-003',
  },
  {
    id: 'receive-EV-RC-004',
    category: '交接类',
    subtype: '待接收',
    eventId: 'EV-RC-004',
    taskId: 'PDA-EXEC-010',
    productionOrderId: 'PO-2024-0020',
    currentProcess: '车缝',
    prevProcess: '裁片',
    fromParty: '日惹裁片分厂',
    deadlineLabel: '接收要求时间',
    deadline: addHours(NOW, 5.5),
    statusLabel: '待接收',
    riskNote: '82 件布料色差需隔离复检，影响接收确认',
    href: '/fcs/pda/handover/EV-RC-004',
  },
  {
    id: 'handout-EV-HO-004',
    category: '交接类',
    subtype: '待交出',
    eventId: 'EV-HO-004',
    taskId: 'PDA-EXEC-017',
    productionOrderId: 'PO-2024-0027',
    currentProcess: '包装',
    toParty: '泗水成品仓库',
    deadlineLabel: '交出要求时间',
    deadline: addHours(NOW, 13),
    statusLabel: '待交出',
    riskNote: '包装已完工，待安排入库交接',
    href: '/fcs/pda/handover/EV-HO-004',
  },
  {
    id: 'handout-EV-HO-002',
    category: '交接类',
    subtype: '待交出',
    eventId: 'EV-HO-002',
    taskId: 'PDA-EXEC-016',
    productionOrderId: 'PO-2024-0026',
    currentProcess: '裁片',
    toParty: '泗水车缝厂',
    deadlineLabel: '交出要求时间',
    deadline: addHours(NOW, 10),
    statusLabel: '待交出',
    riskNote: '裁片已完成，需在截止前移交泗水车缝厂',
    href: '/fcs/pda/handover/EV-HO-002',
  },
]

const CATEGORIES: Array<{ key: DueSoonCategory; label: string; icon: string }> = [
  { key: '全部', label: '全部', icon: 'clock' },
  { key: '接单类', label: '接单类', icon: 'clipboard-list' },
  { key: '报价类', label: '报价类', icon: 'package' },
  { key: '交接类', label: '交接类', icon: 'arrow-left-right' },
  { key: '执行类', label: '执行类', icon: 'play' },
]

const SUBTYPE_STYLE: Record<string, { label: string; className: string }> = {
  待接单: { label: '待接单', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  待报价: { label: '待报价', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  待领料: { label: '待领料', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  待接收: { label: '待接收', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  待交出: { label: '待交出', className: 'bg-teal-100 text-teal-700 border-teal-200' },
  执行进行中: { label: '进行中', className: 'bg-sky-100 text-sky-700 border-sky-200' },
  开工预期: { label: '开工预期', className: 'bg-amber-100 text-amber-700 border-amber-200' },
}

const CATEGORY_EMPTY: Record<DueSoonCategory, string> = {
  全部: '当前暂无即将逾期事项',
  接单类: '当前暂无接单类即将逾期事项',
  报价类: '当前暂无报价类即将逾期事项',
  交接类: '当前暂无交接类即将逾期事项',
  执行类: '当前暂无执行类即将逾期事项',
}

function getAllItems(): DueSoonItem[] {
  syncPdaStartRiskAndExceptions()

  const staticItems = DUE_SOON_MOCK.filter((item) => isSoonDue(item.deadline))
  const selectedFactoryId = getCurrentFactoryId()
  const startDueItems: DueSoonItem[] = processTasks
    .filter(
      (task) =>
        task.taskId.startsWith('PDA-EXEC-') &&
        task.assignedFactoryId === selectedFactoryId &&
        task.acceptanceStatus === 'ACCEPTED' &&
        task.status === 'NOT_STARTED',
    )
    .map((task) => {
      const dueInfo = getTaskStartDueInfo(task)
      return { task, dueInfo }
    })
    .filter((item) => item.dueInfo.prerequisiteMet && item.dueInfo.startRiskStatus === 'DUE_SOON' && item.dueInfo.startDueAt)
    .map((item) => ({
      id: `start-due-${item.task.taskId}`,
      category: '执行类' as const,
      subtype: '开工预期' as const,
      taskId: item.task.taskId,
      productionOrderId: item.task.productionOrderId,
      processName: item.task.processNameZh,
      currentFactory: getFactoryName(item.task.assignedFactoryId || selectedFactoryId),
      deadlineLabel: '开工时限',
      deadline: item.dueInfo.startDueAt as string,
      statusLabel: '待开工',
      riskNote:
        typeof item.dueInfo.remainingMs === 'number'
          ? `距开工时限不足 ${formatRemainingHours(item.dueInfo.remainingMs)} 小时`
          : '距开工时限不足 24 小时',
      href: `/fcs/pda/exec/${item.task.taskId}?action=start`,
    }))

  const execInProgressItems: DueSoonItem[] = processTasks
    .filter(
      (task) =>
        task.taskId.startsWith('PDA-EXEC-') &&
        task.assignedFactoryId === selectedFactoryId &&
        task.acceptanceStatus === 'ACCEPTED' &&
        task.status === 'IN_PROGRESS' &&
        Boolean(task.taskDeadline),
    )
    .map((task) => {
      const deadline = task.taskDeadline as string
      const remainingMs = msUntil(deadline)
      return { task, deadline, remainingMs }
    })
    .filter((item) => item.remainingMs > 0 && item.remainingMs < SOON_THRESHOLD_MS)
    .map((item) => ({
      id: `exec-due-${item.task.taskId}`,
      category: '执行类' as const,
      subtype: '执行进行中' as const,
      taskId: item.task.taskId,
      productionOrderId: item.task.productionOrderId,
      processName: item.task.processNameZh,
      currentFactory: getFactoryName(item.task.assignedFactoryId || selectedFactoryId),
      deadlineLabel: '任务截止时间',
      deadline: item.deadline,
      statusLabel: '进行中',
      riskNote: `距任务截止不足 ${formatRemainingHours(item.remainingMs)} 小时`,
      href: `/fcs/pda/exec/${item.task.taskId}`,
    }))

  return [...staticItems, ...execInProgressItems, ...startDueItems]
}

function getCountByCategory(items: DueSoonItem[]): Record<string, number> {
  const map: Record<string, number> = {}
  items.forEach((item) => {
    map[item.category] = (map[item.category] ?? 0) + 1
  })
  return map
}

function getFilteredItems(items: DueSoonItem[]): DueSoonItem[] {
  let list =
    state.activeCategory === '全部' ? items : items.filter((item) => item.category === state.activeCategory)

  const keyword = state.search.trim().toLowerCase()
  if (keyword) {
    list = list.filter((item) => {
      return (
        item.taskId?.toLowerCase().includes(keyword) ||
        item.eventId?.toLowerCase().includes(keyword) ||
        item.tenderId?.toLowerCase().includes(keyword) ||
        item.productionOrderId?.toLowerCase().includes(keyword)
      )
    })
  }

  return list.slice().sort((a, b) => msUntil(a.deadline) - msUntil(b.deadline))
}

function renderFieldRow(label: string, value: string, urgent = false): string {
  return `
    <span class="col-span-1 flex gap-1">
      <span class="shrink-0">${escapeHtml(label)}：</span>
      <span class="truncate font-medium ${urgent ? 'text-destructive' : 'text-foreground'}">${escapeHtml(value)}</span>
    </span>
  `
}

function renderDueSoonCard(item: DueSoonItem): string {
  const remaining = msUntil(item.deadline)
  const isVeryUrgent = remaining < 6 * 3600 * 1000
  const subtype = SUBTYPE_STYLE[item.subtype] ?? { label: item.subtype, className: 'bg-muted text-muted-foreground border' }

  return `
    <button class="w-full text-left" data-pda-due-action="open-item" data-href="${escapeHtml(item.href)}">
      <article class="rounded-lg border-l-4 transition-colors hover:border-primary ${isVeryUrgent ? 'border-l-destructive' : 'border-l-amber-400'}">
        <div class="space-y-1.5 px-3 py-2.5">
          <div class="flex items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${subtype.className}">${escapeHtml(subtype.label)}</span>
              <span class="text-[10px] text-muted-foreground">${escapeHtml(item.category)}</span>
            </div>
            <span class="shrink-0 text-[11px] font-semibold tabular-nums ${isVeryUrgent ? 'text-destructive' : 'text-amber-600'}">${escapeHtml(formatRemaining(remaining))}</span>
          </div>

          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1 space-y-0.5">
              <p class="truncate text-sm font-medium leading-snug">${escapeHtml(item.eventId || item.taskId || item.tenderId || item.id)}</p>
              <div class="mt-0.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                ${item.productionOrderId ? renderFieldRow('生产单', item.productionOrderId) : ''}
                ${item.processName ? renderFieldRow('工序', item.processName) : ''}
                ${item.currentProcess ? renderFieldRow('当前工序', item.currentProcess) : ''}
                ${item.prevProcess ? renderFieldRow('上道工序', item.prevProcess) : ''}
                ${item.fromParty ? renderFieldRow('来源方', item.fromParty) : ''}
                ${item.toParty ? renderFieldRow('去向方', item.toParty) : ''}
                ${item.currentFactory ? renderFieldRow('当前工厂', item.currentFactory) : ''}
                ${renderFieldRow(item.deadlineLabel, item.deadline, isVeryUrgent)}
              </div>

              ${
                item.riskNote
                  ? `<div class="mt-1 flex items-start gap-1 rounded bg-amber-50 px-1.5 py-1 text-[11px] text-amber-700">
                      <i data-lucide="alert-triangle" class="mt-0.5 h-3 w-3 shrink-0"></i>
                      <span class="leading-snug">${escapeHtml(item.riskNote)}</span>
                    </div>`
                  : ''
              }
            </div>
            <i data-lucide="chevron-right" class="mt-1 h-4 w-4 shrink-0 text-muted-foreground"></i>
          </div>
        </div>
      </article>
    </button>
  `
}

export function renderPdaNotifyDueSoonPage(): string {
  const allItems = getAllItems()
  const countByCategory = getCountByCategory(allItems)
  const filtered = getFilteredItems(allItems)

  const content = `
    <div class="flex min-h-[760px] flex-col bg-muted/30">
      <header class="sticky top-0 z-20 border-b bg-background">
        <div class="flex items-center gap-2 px-3 py-3">
          <button class="rounded-md p-1 hover:bg-muted" data-pda-due-action="back">
            <i data-lucide="arrow-left" class="h-5 w-5"></i>
          </button>
          <div class="min-w-0 flex-1">
            <h1 class="text-base font-semibold leading-tight">即将逾期事项</h1>
            <p class="text-[11px] text-muted-foreground">距截止时间不足 24 小时</p>
          </div>
          ${
            allItems.length > 0
              ? `<span class="shrink-0 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">${allItems.length} 条</span>`
              : ''
          }
        </div>

        <div class="flex items-center gap-4 overflow-x-auto px-4 pb-2 text-xs text-muted-foreground">
          ${CATEGORIES.filter((item) => item.key !== '全部')
            .map((item) => {
              const count = countByCategory[item.key] ?? 0
              return `<span class="shrink-0">${escapeHtml(item.label)} <span class="font-semibold ${count > 0 ? 'text-foreground' : ''}">${count}</span></span>`
            })
            .join('')}
        </div>
      </header>

      <section class="sticky top-[88px] z-10 border-b bg-background">
        <div class="flex gap-1 overflow-x-auto px-3 py-2">
          ${CATEGORIES.map((category) => {
            const count = category.key === '全部' ? allItems.length : (countByCategory[category.key] ?? 0)
            const active = state.activeCategory === category.key
            return `
              <button
                class="shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${toClassName(
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-foreground',
                )}"
                data-pda-due-action="set-category"
                data-category="${category.key}"
              >
                <i data-lucide="${category.icon}" class="mr-1 inline-block h-3.5 w-3.5 align-text-bottom"></i>
                ${escapeHtml(category.label)}
                ${
                  count > 0
                    ? `<span class="ml-0.5 text-[10px] font-bold ${active ? 'text-primary-foreground' : 'text-destructive'}">${count}</span>`
                    : ''
                }
              </button>
            `
          }).join('')}
        </div>

        <div class="relative px-3 pb-2">
          <i data-lucide="search" class="pointer-events-none absolute left-6 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"></i>
          <input
            class="h-8 w-full rounded-md border bg-background pl-8 pr-3 text-xs"
            data-pda-due-field="search"
            placeholder="搜索任务编号 / 交接事件号 / 生产单号..."
            value="${escapeAttr(state.search)}"
          />
        </div>
      </section>

      <div class="flex-1 space-y-2 p-3">
        ${
          filtered.length === 0
            ? `
              <div class="py-16 text-center text-muted-foreground">
                <i data-lucide="clock" class="mx-auto mb-2 h-10 w-10 opacity-25"></i>
                <p class="text-sm">${escapeHtml(CATEGORY_EMPTY[state.activeCategory])}</p>
              </div>
            `
            : filtered.map((item) => renderDueSoonCard(item)).join('')
        }
      </div>
    </div>
  `

  return renderPdaFrame(content, 'notify')
}

export function handlePdaNotifyDueSoonEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pda-due-field]')
  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.pdaDueField
    if (field === 'search') {
      state.search = fieldNode.value
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-due-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaDueAction
  if (!action) return false

  if (action === 'back') {
    appStore.navigate('/fcs/pda/notify')
    return true
  }

  if (action === 'set-category') {
    const category = actionNode.dataset.category as DueSoonCategory | undefined
    if (category && ['全部', '接单类', '报价类', '交接类', '执行类'].includes(category)) {
      state.activeCategory = category
    }
    return true
  }

  if (action === 'open-item') {
    const href = actionNode.dataset.href
    if (href) {
      appStore.navigate(href)
    }
    return true
  }

  return false
}
