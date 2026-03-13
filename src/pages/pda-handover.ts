import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import { renderPdaFrame } from './pda-shell'
import { pdaHandoverEvents, type HandoverAction, type HandoverEvent } from '../data/fcs/pda-handover-events'

type HandoverTab = 'pickup' | 'receive' | 'handout' | 'done'

interface PdaHandoverState {
  selectedFactoryId: string
  activeTab: HandoverTab
}

const state: PdaHandoverState = {
  selectedFactoryId: '',
  activeTab: 'pickup',
}

const TAB_CONFIG: Array<{ key: HandoverTab; label: string }> = [
  { key: 'pickup', label: '待领料' },
  { key: 'receive', label: '待接收' },
  { key: 'handout', label: '待交出' },
  { key: 'done', label: '已处理' },
]

const ACTION_LABELS: Record<HandoverAction, string> = {
  PICKUP: '领料',
  RECEIVE: '接收',
  HANDOUT: '交出',
}

const STATUS_LABELS: Record<'PENDING' | 'CONFIRMED' | 'DISPUTED', string> = {
  PENDING: '待处理',
  CONFIRMED: '已确认',
  DISPUTED: '争议中',
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
    state.activeTab = 'pickup'
    return
  }
  if (TAB_CONFIG.some((item) => item.key === tab)) {
    state.activeTab = tab as HandoverTab
  }
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
    // ignore parse errors
  }

  state.selectedFactoryId = 'ID-F001'
  return state.selectedFactoryId
}

function getDeadlineBadge(event: HandoverEvent): { label: string; className: string } | null {
  if (event.status !== 'PENDING') return null
  const diff = parseDateMs(event.deadlineTime) - Date.now()
  const hours = diff / 3600000

  if (diff < 0) {
    return { label: '已逾期', className: 'border-destructive text-destructive' }
  }
  if (hours < 4) {
    return { label: '即将逾期', className: 'border-amber-400 text-amber-600' }
  }
  return null
}

function renderPartyChip(kind: HandoverEvent['fromPartyKind'], name: string): string {
  return `
    <span class="inline-flex items-center gap-1 text-xs">
      <i data-lucide="${kind === 'WAREHOUSE' ? 'warehouse' : 'factory'}" class="h-3 w-3 shrink-0 text-muted-foreground"></i>
      <span>${escapeHtml(name)}</span>
    </span>
  `
}

function renderEventCard(event: HandoverEvent, actionLabel: string): string {
  const deadlineBadge = getDeadlineBadge(event)
  const qtyLabel = event.action === 'PICKUP' ? '应领' : event.action === 'RECEIVE' ? '应收' : '应交'

  return `
    <article
      class="cursor-pointer rounded-lg border transition-colors hover:border-primary"
      data-pda-handover-action="open-detail"
      data-event-id="${escapeHtml(event.eventId)}"
    >
      <div class="space-y-2 p-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="truncate font-mono text-xs text-muted-foreground">${escapeHtml(event.eventId)}</span>
            <span class="inline-flex shrink-0 items-center rounded border border-border bg-muted px-1.5 py-0 text-[10px]">${escapeHtml(
              ACTION_LABELS[event.action],
            )}</span>
            ${
              deadlineBadge
                ? `<span class="inline-flex shrink-0 items-center rounded border px-1.5 py-0 text-[10px] ${deadlineBadge.className}">${escapeHtml(deadlineBadge.label)}</span>`
                : ''
            }
          </div>
          <i data-lucide="chevron-right" class="h-4 w-4 shrink-0 text-muted-foreground"></i>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          <div><span class="text-muted-foreground">任务编号：</span>${escapeHtml(event.taskId)}</div>
          <div><span class="text-muted-foreground">生产单号：</span>${escapeHtml(event.productionOrderId)}</div>
          ${
            event.prevProcess
              ? `<div><span class="text-muted-foreground">上一道工序：</span>${escapeHtml(event.prevProcess)}</div>`
              : ''
          }
          <div><span class="text-muted-foreground">当前工序：</span>${escapeHtml(event.currentProcess)}</div>
        </div>

        <div class="flex items-center gap-2 py-0.5 text-xs">
          <span class="shrink-0 text-muted-foreground">来源方：</span>
          ${renderPartyChip(event.fromPartyKind, event.fromPartyName)}
          <i data-lucide="arrow-right" class="h-3 w-3 shrink-0 text-muted-foreground"></i>
          <span class="shrink-0 text-muted-foreground">去向方：</span>
          ${renderPartyChip(event.toPartyKind, event.toPartyName)}
        </div>

        <div class="flex items-center gap-4 text-xs">
          <span class="flex items-center gap-1">
            <i data-lucide="package" class="h-3 w-3 text-muted-foreground"></i>
            ${qtyLabel}：<span class="font-medium">${event.qtyExpected} ${escapeHtml(event.qtyUnit)}</span>
          </span>
          ${
            event.qtyActual != null
              ? `<span>实际：<span class="font-medium">${event.qtyActual} ${escapeHtml(event.qtyUnit)}</span></span>`
              : ''
          }
        </div>

        <div class="text-[10px] text-muted-foreground">要求时间：${escapeHtml(event.deadlineTime)}</div>

        ${
          event.qtyDiff != null && event.qtyDiff > 0
            ? `
              <div class="space-y-0.5 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                <div class="font-medium">差异数量：${event.qtyDiff} ${escapeHtml(event.qtyUnit)}</div>
                ${event.diffReason ? `<div>${escapeHtml(event.diffReason)}</div>` : ''}
              </div>
            `
            : ''
        }

        ${
          event.action === 'RECEIVE' && event.qcResult
            ? `
              <div class="space-y-1">
                <div class="flex items-center gap-2 text-xs">
                  <span class="text-muted-foreground">质检结论：</span>
                  <span class="inline-flex items-center rounded border px-1.5 py-0 text-[10px] ${
                    event.qcResult === 'PASS'
                      ? 'border-primary/20 bg-primary text-primary-foreground'
                      : 'border-destructive/20 bg-destructive text-destructive-foreground'
                  }">${event.qcResult === 'PASS' ? '合格' : '不合格'}</span>
                  ${
                    event.qcDefectQty != null && event.qcDefectQty > 0
                      ? `<span class="text-destructive">不合格 ${event.qcDefectQty} ${escapeHtml(event.qtyUnit)}</span>`
                      : ''
                  }
                </div>
                ${
                  event.qcProblemType
                    ? `<div class="text-xs text-muted-foreground">问题类型：${escapeHtml(event.qcProblemType)}</div>`
                    : ''
                }
                ${
                  event.qcProblemDesc
                    ? `<div class="rounded bg-red-50 px-2 py-1 text-xs text-red-600">${escapeHtml(event.qcProblemDesc)}</div>`
                    : ''
                }
              </div>
            `
            : ''
        }

        <button
          class="mt-1 inline-flex h-8 w-full items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          data-pda-handover-action="open-detail"
          data-event-id="${escapeHtml(event.eventId)}"
        >${escapeHtml(actionLabel)}</button>
      </div>
    </article>
  `
}

function renderDoneCard(event: HandoverEvent): string {
  return `
    <article
      class="cursor-pointer rounded-lg border transition-colors hover:border-primary"
      data-pda-handover-action="open-detail"
      data-event-id="${escapeHtml(event.eventId)}"
    >
      <div class="space-y-1.5 p-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="truncate font-mono text-xs text-muted-foreground">${escapeHtml(event.eventId)}</span>
            <span class="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0 text-[10px]">${escapeHtml(
              ACTION_LABELS[event.action],
            )}</span>
            <span class="inline-flex items-center rounded border px-1.5 py-0 text-[10px] ${
              event.status === 'DISPUTED'
                ? 'border-destructive/20 bg-destructive text-destructive-foreground'
                : 'border-primary/20 bg-primary text-primary-foreground'
            }">${escapeHtml(STATUS_LABELS[event.status])}</span>
          </div>
          <i data-lucide="chevron-right" class="h-4 w-4 shrink-0 text-muted-foreground"></i>
        </div>

        <div class="flex items-center gap-2 text-xs">
          ${renderPartyChip(event.fromPartyKind, event.fromPartyName)}
          <i data-lucide="arrow-right" class="h-3 w-3 shrink-0 text-muted-foreground"></i>
          ${renderPartyChip(event.toPartyKind, event.toPartyName)}
        </div>

        <div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>数量：${event.qtyActual ?? event.qtyExpected} ${escapeHtml(event.qtyUnit)}</span>
          ${
            event.qtyDiff != null && event.qtyDiff > 0
              ? `<span class="text-amber-600">差异 ${event.qtyDiff} ${escapeHtml(event.qtyUnit)}</span>`
              : ''
          }
          ${
            event.action === 'RECEIVE' && event.qcResult
              ? `
                <span>
                  质检：
                  <span class="${event.qcResult === 'PASS' ? 'text-green-600' : 'text-destructive'}">
                    ${event.qcResult === 'PASS' ? '合格' : '不合格'}
                  </span>
                  ${
                    event.qcDefectQty != null && event.qcDefectQty > 0
                      ? `<span class="ml-1 text-destructive">(${event.qcDefectQty} ${escapeHtml(event.qtyUnit)})</span>`
                      : ''
                  }
                </span>
              `
              : ''
          }
          ${
            event.proofCount != null
              ? `
                <span class="inline-flex items-center gap-0.5 ${
                  event.proofCount > 0 ? 'text-blue-600' : 'text-muted-foreground'
                }">
                  <i data-lucide="paperclip" class="h-3 w-3"></i>
                  ${event.proofCount > 0 ? `凭证 ${event.proofCount} 个` : '暂无凭证'}
                </span>
              `
              : ''
          }
          ${event.confirmedAt ? `<span>确认于 ${escapeHtml(event.confirmedAt)}</span>` : ''}
        </div>

        ${
          event.status === 'DISPUTED' && event.qcProblemDesc
            ? `<div class="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-600">${escapeHtml(event.qcProblemDesc)}</div>`
            : ''
        }
        ${
          event.status === 'DISPUTED' && event.diffReason
            ? `<div class="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">${escapeHtml(event.diffReason)}</div>`
            : ''
        }
      </div>
    </article>
  `
}

function renderEmptyState(message: string): string {
  return `<div class="py-10 text-center text-sm text-muted-foreground">${escapeHtml(message)}</div>`
}

export function renderPdaHandoverPage(): string {
  syncTabWithQuery()
  const selectedFactoryId = getCurrentFactoryId()
  const matchFactory = (event: HandoverEvent): boolean => !selectedFactoryId || event.factoryId === selectedFactoryId

  const pickupEvents = pdaHandoverEvents.filter(
    (event) => event.action === 'PICKUP' && event.status === 'PENDING' && matchFactory(event),
  )
  const receiveEvents = pdaHandoverEvents.filter(
    (event) => event.action === 'RECEIVE' && event.status === 'PENDING' && matchFactory(event),
  )
  const handoutEvents = pdaHandoverEvents.filter(
    (event) => event.action === 'HANDOUT' && event.status === 'PENDING' && matchFactory(event),
  )
  const doneEvents = pdaHandoverEvents.filter(
    (event) => (event.status === 'CONFIRMED' || event.status === 'DISPUTED') && matchFactory(event),
  )

  const tabCounts: Record<HandoverTab, number> = {
    pickup: pickupEvents.length,
    receive: receiveEvents.length,
    handout: handoutEvents.length,
    done: doneEvents.length,
  }

  const content = `
    <div class="flex min-h-[760px] flex-col bg-background">
      <div class="shrink-0 px-4 pb-2 pt-4">
        <h1 class="mb-3 text-lg font-semibold">交接</h1>

        <div class="mb-3 grid grid-cols-4 gap-1.5">
          ${TAB_CONFIG.map((tab) => {
            const active = state.activeTab === tab.key
            return `
              <button
                class="${toClassName(
                  'rounded-lg border p-2 text-center transition-colors',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-transparent bg-muted/40',
                )}"
                data-pda-handover-action="switch-tab"
                data-tab="${tab.key}"
              >
                <p class="text-base font-bold tabular-nums">${tabCounts[tab.key]}</p>
                <p class="mt-0.5 text-[9px] leading-tight opacity-80">${escapeHtml(tab.label)}</p>
              </button>
            `
          }).join('')}
        </div>
      </div>

      <div class="flex-1 space-y-3 overflow-y-auto px-4 pb-4 pt-3">
        ${
          state.activeTab === 'pickup'
            ? `
              <p class="text-xs text-muted-foreground">首道工序工厂从仓库领取面辅料。领料完成后，具备开工条件。</p>
              ${
                pickupEvents.length === 0
                  ? renderEmptyState('暂无待领料事项')
                  : pickupEvents.map((event) => renderEventCard(event, '确认领料')).join('')
              }
            `
            : ''
        }

        ${
          state.activeTab === 'receive'
            ? `
              <p class="text-xs text-muted-foreground">非首道工序工厂接收上一道工序的半成品。接收须完成数量确认与到货质检，接收完成后具备开工条件。</p>
              ${
                receiveEvents.length === 0
                  ? renderEmptyState('暂无待接收事项')
                  : receiveEvents.map((event) => renderEventCard(event, '进入接收确认')).join('')
              }
            `
            : ''
        }

        ${
          state.activeTab === 'handout'
            ? `
              <p class="text-xs text-muted-foreground">当前工厂完成本道工序后，将半成品交给下一节点（工厂或仓库）。</p>
              ${
                handoutEvents.length === 0
                  ? renderEmptyState('暂无待交出事项')
                  : handoutEvents.map((event) => renderEventCard(event, '确认交出')).join('')
              }
            `
            : ''
        }

        ${
          state.activeTab === 'done'
            ? doneEvents.length === 0
              ? renderEmptyState('暂无已处理记录')
              : doneEvents.map((event) => renderDoneCard(event)).join('')
            : ''
        }
      </div>
    </div>
  `

  return renderPdaFrame(content, 'handover')
}

export function handlePdaHandoverEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pda-handover-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaHandoverAction
  if (!action) return false

  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab as HandoverTab | undefined
    if (tab && TAB_CONFIG.some((item) => item.key === tab)) {
      state.activeTab = tab
      appStore.navigate(`/fcs/pda/handover?tab=${tab}`)
    }
    return true
  }

  if (action === 'open-detail') {
    const eventId = actionNode.dataset.eventId
    if (eventId) {
      appStore.navigate(`/fcs/pda/handover/${eventId}`)
    }
    return true
  }

  return false
}
