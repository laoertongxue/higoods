import { renderDetailDrawer as uiDetailDrawer } from '../components/ui/index.ts'
import { listSampleLedgerViewItems } from '../data/pcs-sample-view-model.ts'
import { ensureSampleBootstrapInitialized } from '../data/pcs-sample-project-writeback.ts'
import { escapeHtml } from '../utils.ts'

interface SampleLedgerPageState {
  keyword: string
  eventFilter: string
  siteFilter: string
  selectedEventId: string | null
  detailOpen: boolean
}

let state: SampleLedgerPageState = {
  keyword: '',
  eventFilter: 'all',
  siteFilter: 'all',
  selectedEventId: null,
  detailOpen: false,
}

function getEvents() {
  ensureSampleBootstrapInitialized()
  return listSampleLedgerViewItems().filter((item) => {
    if (state.keyword) {
      const keyword = state.keyword.toLowerCase()
      const matched = [
        item.ledgerEventCode,
        item.sampleCode,
        item.sampleName,
        item.sourceDocCode,
        item.projectCode,
        item.workItemTypeName,
      ]
        .filter(Boolean)
        .some((text) => text.toLowerCase().includes(keyword))
      if (!matched) return false
    }
    if (state.eventFilter !== 'all' && item.eventName !== state.eventFilter) return false
    if (state.siteFilter !== 'all' && item.responsibleSite !== state.siteFilter) return false
    return true
  })
}

function getSelectedEvent() {
  if (!state.selectedEventId) return null
  return listSampleLedgerViewItems().find((item) => item.ledgerEventId === state.selectedEventId) || null
}

function renderDetail(): string {
  const event = getSelectedEvent()
  if (!state.detailOpen || !event) return ''
  return uiDetailDrawer(
    {
      title: '样衣台账事件详情',
      subtitle: event.ledgerEventCode,
      closeAction: { prefix: 'sample-ledger', action: 'close-detail' },
      width: 'md',
    },
    `
      <div class="space-y-5 text-sm">
        <section class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">事件类型</div><div class="mt-1 font-medium">${escapeHtml(event.eventName)}</div></div>
          <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">事件时间</div><div class="mt-1 font-medium">${escapeHtml(event.businessDate)}</div></div>
          <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">样衣编号</div><div class="mt-1 font-medium">${escapeHtml(event.sampleCode)}</div></div>
          <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">样衣名称</div><div class="mt-1 font-medium">${escapeHtml(event.sampleName)}</div></div>
          <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">来源单据</div><div class="mt-1 font-medium">${escapeHtml(`${event.sourceDocType} / ${event.sourceDocCode}`)}</div></div>
          <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">责任站点</div><div class="mt-1 font-medium">${escapeHtml(event.responsibleSite)}</div></div>
          <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">关联项目</div><div class="mt-1 font-medium">${escapeHtml(event.projectCode ? `${event.projectCode} · ${event.projectName}` : '未绑定项目')}</div></div>
          <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">关联项目节点</div><div class="mt-1 font-medium">${escapeHtml(event.workItemTypeName || '未挂项目节点')}</div></div>
          <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">事件后库存状态</div><div class="mt-1 font-medium">${escapeHtml(event.inventoryStatusAfter)}</div></div>
          <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">操作人</div><div class="mt-1 font-medium">${escapeHtml(event.operatorName)}</div></div>
        </section>
      </div>
    `,
  )
}

export function handleSampleLedgerEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-sample-ledger-action]')
  const action = actionNode?.dataset.sampleLedgerAction
  if (!action) return false

  if (action === 'open-detail') {
    const eventId = actionNode?.dataset.eventId
    if (eventId) {
      state.selectedEventId = eventId
      state.detailOpen = true
    }
    return true
  }

  if (action === 'close-detail') {
    state.detailOpen = false
    return true
  }

  if (action === 'reset') {
    state.keyword = ''
    state.eventFilter = 'all'
    state.siteFilter = 'all'
    return true
  }

  return false
}

export function handleSampleLedgerInput(target: Element): boolean {
  const field = (target as HTMLElement).dataset.sampleLedgerField
  if (!field) return false
  if (field === 'keyword') {
    state.keyword = (target as HTMLInputElement).value
    return true
  }
  if (field === 'event') {
    state.eventFilter = (target as HTMLSelectElement).value
    return true
  }
  if (field === 'site') {
    state.siteFilter = (target as HTMLSelectElement).value
    return true
  }
  return false
}

export function isSampleLedgerDialogOpen(): boolean {
  return state.detailOpen
}

export function renderSampleLedgerPage(): string {
  const events = getEvents()
  const eventOptions = Array.from(new Set(listSampleLedgerViewItems().map((item) => item.eventName)))
  const siteOptions = Array.from(new Set(listSampleLedgerViewItems().map((item) => item.responsibleSite)))

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">样衣台账</h1>
          <p class="mt-1 text-sm text-muted-foreground">正式样衣台账事件统一来自样衣台账事件仓储，并作为库存、流转、项目回写的唯一事件来源。</p>
        </div>
      </header>

      <section class="rounded-lg border bg-white p-4">
        <div class="grid gap-4 md:grid-cols-[2fr,1fr,1fr,auto]">
          <input class="h-9 rounded-md border px-3 text-sm" placeholder="搜索事件编号/样衣/来源单据/项目/项目节点" value="${escapeHtml(state.keyword)}" data-sample-ledger-field="keyword" />
          <select class="h-9 rounded-md border px-3 text-sm" data-sample-ledger-field="event">
            <option value="all" ${state.eventFilter === 'all' ? 'selected' : ''}>全部事件类型</option>
            ${eventOptions.map((item) => `<option value="${escapeHtml(item)}" ${state.eventFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
          <select class="h-9 rounded-md border px-3 text-sm" data-sample-ledger-field="site">
            <option value="all" ${state.siteFilter === 'all' ? 'selected' : ''}>全部站点</option>
            ${siteOptions.map((item) => `<option value="${escapeHtml(item)}" ${state.siteFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-gray-50" data-sample-ledger-action="reset">重置筛选</button>
        </div>
      </section>

      <section class="overflow-hidden rounded-lg border bg-card">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1200px] text-sm">
            <thead>
              <tr class="border-b bg-muted/30 text-left text-muted-foreground">
                <th class="px-3 py-2 font-medium">事件编号</th>
                <th class="px-3 py-2 font-medium">事件类型</th>
                <th class="px-3 py-2 font-medium">样衣编号</th>
                <th class="px-3 py-2 font-medium">样衣名称</th>
                <th class="px-3 py-2 font-medium">来源单据</th>
                <th class="px-3 py-2 font-medium">项目编号</th>
                <th class="px-3 py-2 font-medium">项目节点</th>
                <th class="px-3 py-2 font-medium">站点</th>
                <th class="px-3 py-2 font-medium">事件时间</th>
                <th class="px-3 py-2 font-medium">操作人</th>
                <th class="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${events.length > 0 ? events.map((item) => `
                <tr class="border-b last:border-b-0 hover:bg-muted/30">
                  <td class="px-3 py-3 font-medium text-primary">${escapeHtml(item.ledgerEventCode)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.eventName)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.sampleCode)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.sampleName)}</td>
                  <td class="px-3 py-3">${escapeHtml(`${item.sourceDocType} / ${item.sourceDocCode}`)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.projectCode || '—')}</td>
                  <td class="px-3 py-3">${escapeHtml(item.workItemTypeName || '未挂项目节点')}</td>
                  <td class="px-3 py-3">${escapeHtml(item.responsibleSite)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.businessDate)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.operatorName)}</td>
                  <td class="px-3 py-3">
                    <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-sample-ledger-action="open-detail" data-event-id="${item.ledgerEventId}">查看</button>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="11" class="px-4 py-12 text-center text-muted-foreground">暂无正式样衣台账事件</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      ${renderDetail()}
    </div>
  `
}
