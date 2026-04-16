import { appStore } from '../state/store.ts'
import { ensurePcsSampleDemoDataReady } from '../data/pcs-sample-demo.ts'
import { listSampleAssets } from '../data/pcs-sample-asset-repository.ts'
import {
  listSampleLedgerEvents,
  listSampleLedgerEventsBySample,
  listSampleWritebackPendingItems,
} from '../data/pcs-sample-ledger-repository.ts'
import type {
  SampleAssetRecord,
  SampleInventoryStatus,
  SampleLedgerEventRecord,
  SampleLedgerEventType,
} from '../data/pcs-sample-types.ts'
import { ensurePcsProjectDemoDataReady } from '../data/pcs-project-demo-seed-service.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'

type QuickFilterKey = 'all' | 'inTransit' | 'stocktake' | 'unmapped' | 'closed'

interface SampleLedgerPageState {
  notice: string | null
  filters: {
    search: string
    site: string
    sourceDocType: string
    selectedEventTypes: SampleLedgerEventType[]
    quickFilter: QuickFilterKey
    unmappedOnly: boolean
    currentPage: number
    pageSize: number
  }
  detailEventId: string | null
}

const EVENT_META: Record<SampleLedgerEventType, { label: string; className: string }> = {
  RECEIVE_ARRIVAL: { label: '到样签收', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  CHECKIN_VERIFY: { label: '核对入库', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  RESERVE_LOCK: { label: '预占锁定', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  CANCEL_RESERVE: { label: '取消预占', className: 'border-slate-200 bg-slate-100 text-slate-600' },
  CHECKOUT_BORROW: { label: '领用出库', className: 'border-orange-200 bg-orange-50 text-orange-700' },
  RETURN_CHECKIN: { label: '归还入库', className: 'border-teal-200 bg-teal-50 text-teal-700' },
  SHIP_OUT: { label: '寄出', className: 'border-violet-200 bg-violet-50 text-violet-700' },
  DELIVER_SIGNED: { label: '签收', className: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
  STOCKTAKE: { label: '盘点', className: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700' },
  DISPOSAL: { label: '处置', className: 'border-rose-200 bg-rose-50 text-rose-700' },
  RETURN_SUPPLIER: { label: '退货', className: 'border-red-200 bg-red-50 text-red-700' },
}

const INVENTORY_STATUS_META: Record<SampleInventoryStatus, { label: string; className: string }> = {
  在途: { label: '在途', className: 'border-violet-200 bg-violet-50 text-violet-700' },
  在库待核对: { label: '在库待核对', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  在库可用: { label: '在库可用', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  预占锁定: { label: '预占锁定', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  借出占用: { label: '借出占用', className: 'border-orange-200 bg-orange-50 text-orange-700' },
  在途待签收: { label: '在途待签收', className: 'border-violet-200 bg-violet-50 text-violet-700' },
  待处置: { label: '待处置', className: 'border-rose-200 bg-rose-50 text-rose-700' },
  已退货: { label: '已退货', className: 'border-red-200 bg-red-50 text-red-700' },
  维修中: { label: '维修中', className: 'border-yellow-200 bg-yellow-50 text-yellow-700' },
  已处置: { label: '已处置', className: 'border-slate-200 bg-slate-100 text-slate-600' },
}

const SOURCE_DOC_TYPE_OPTIONS = [
  { value: 'all', label: '全部来源' },
  { value: '样衣获取单', label: '样衣获取单' },
  { value: '样衣使用申请', label: '样衣使用申请' },
  { value: '首版样衣打样任务', label: '首版样衣打样任务' },
  { value: '产前版样衣任务', label: '产前版样衣任务' },
  { value: '样衣退回单', label: '样衣退回单' },
  { value: '样衣处置单', label: '样衣处置单' },
  { value: '盘点单', label: '盘点单' },
] as const

const state: SampleLedgerPageState = {
  notice: null,
  filters: {
    search: '',
    site: 'all',
    sourceDocType: 'all',
    selectedEventTypes: [],
    quickFilter: 'all',
    unmappedOnly: false,
    currentPage: 1,
    pageSize: 12,
  },
  detailEventId: null,
}

function ensurePageDataReady(): void {
  ensurePcsProjectDemoDataReady()
  ensurePcsSampleDemoDataReady()
}

function getAllEvents(): SampleLedgerEventRecord[] {
  ensurePageDataReady()
  return listSampleLedgerEvents()
}

function getAllAssets(): SampleAssetRecord[] {
  ensurePageDataReady()
  return listSampleAssets()
}

function getPendingItems() {
  ensurePageDataReady()
  return listSampleWritebackPendingItems()
}

function getEventBadge(eventType: SampleLedgerEventType): string {
  const meta = EVENT_META[eventType]
  return `<span class="${escapeHtml(toClassName('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', meta.className))}">${escapeHtml(meta.label)}</span>`
}

function getInventoryBadge(status: SampleInventoryStatus): string {
  const meta = INVENTORY_STATUS_META[status]
  return `<span class="${escapeHtml(toClassName('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', meta.className))}">${escapeHtml(meta.label)}</span>`
}

function getSourceRoute(event: SampleLedgerEventRecord): string | null {
  if (event.projectId && event.projectNodeId) {
    return `/pcs/projects/${event.projectId}`
  }
  switch (event.sourceDocType) {
    case '样衣使用申请':
      return '/pcs/samples/application'
    case '首版样衣打样任务':
      return '/pcs/samples/first-sample'
    case '产前版样衣任务':
      return '/pcs/samples/pre-production'
    case '样衣退回单':
    case '样衣处置单':
      return '/pcs/samples/return'
    default:
      return null
  }
}

function getWorkItemRoute(event: SampleLedgerEventRecord): string | null {
  if (event.projectId && event.projectNodeId) {
    return `/pcs/projects/${event.projectId}`
  }
  return null
}

function isStocktakeIssue(event: SampleLedgerEventRecord): boolean {
  return event.eventType === 'STOCKTAKE' && /差异|异常|待追踪/.test(event.note || '')
}

function isInTransit(event: SampleLedgerEventRecord): boolean {
  return event.eventType === 'SHIP_OUT' || ['在途', '在途待签收'].includes(event.inventoryStatusAfter)
}

function isClosedAsset(asset: SampleAssetRecord): boolean {
  return asset.inventoryStatus === '已退货' || asset.inventoryStatus === '已处置'
}

function getFilteredEvents(): SampleLedgerEventRecord[] {
  const search = state.filters.search.trim().toLowerCase()
  return getAllEvents().filter((event) => {
    if (search) {
      const haystack = [
        event.ledgerEventCode,
        event.sampleCode,
        event.sampleName,
        event.sourceDocCode,
        event.sourceDocId,
        event.projectCode,
        event.projectName,
        event.operatorName,
        event.note,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }

    if (state.filters.site !== 'all' && event.responsibleSite !== state.filters.site) return false
    if (state.filters.sourceDocType !== 'all' && event.sourceDocType !== state.filters.sourceDocType) return false
    if (state.filters.selectedEventTypes.length > 0 && !state.filters.selectedEventTypes.includes(event.eventType)) return false
    if (state.filters.unmappedOnly && event.projectId) return false

    if (state.filters.quickFilter === 'inTransit' && !isInTransit(event)) return false
    if (state.filters.quickFilter === 'stocktake' && !isStocktakeIssue(event)) return false
    if (state.filters.quickFilter === 'unmapped' && event.projectId) return false
    if (
      state.filters.quickFilter === 'closed' &&
      event.eventType !== 'RETURN_SUPPLIER' &&
      event.eventType !== 'DISPOSAL' &&
      event.inventoryStatusAfter !== '已退货' &&
      event.inventoryStatusAfter !== '已处置'
    ) {
      return false
    }

    return true
  })
}

function getPagedEvents(): { items: SampleLedgerEventRecord[]; total: number; totalPages: number } {
  const items = getFilteredEvents()
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / state.filters.pageSize))
  const currentPage = Math.min(state.filters.currentPage, totalPages)
  if (currentPage !== state.filters.currentPage) {
    state.filters.currentPage = currentPage
  }
  const start = (currentPage - 1) * state.filters.pageSize
  return {
    items: items.slice(start, start + state.filters.pageSize),
    total,
    totalPages,
  }
}

function getSummary() {
  const events = getAllEvents()
  const assets = getAllAssets()
  const pendingItems = getPendingItems()
  const statusCounts = assets.reduce<Record<string, number>>((acc, asset) => {
    acc[asset.inventoryStatus] = (acc[asset.inventoryStatus] || 0) + 1
    return acc
  }, {})

  return {
    totalEvents: events.length,
    inTransit: events.filter(isInTransit).length,
    stocktakeIssueCount: events.filter(isStocktakeIssue).length,
    unmappedCount: pendingItems.length,
    closedCount: assets.filter(isClosedAsset).length,
    statusCounts,
  }
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <div class="flex items-start justify-between gap-3">
        <p class="text-sm text-blue-800">${escapeHtml(state.notice)}</p>
        <button type="button" class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-sample-ledger-action="close-notice">关闭</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  return `
    <section class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs text-slate-500">商品中心 / 样衣管理</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900">样衣台账</h1>
        <p class="mt-1 text-sm text-slate-500">样衣资产的不可篡改事实账，记录全链路流转事件、项目绑定和库存影响留痕。</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-ledger-action="refresh">
          <i data-lucide="refresh-cw" class="h-4 w-4"></i>刷新
        </button>
        <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-ledger-action="export">
          <i data-lucide="download" class="h-4 w-4"></i>导出
        </button>
      </div>
    </section>
  `
}

function renderKpis(): string {
  const summary = getSummary()
  const cards: Array<{ key: QuickFilterKey; label: string; value: number; helper: string; tone: string }> = [
    { key: 'all', label: '全部事件', value: summary.totalEvents, helper: '样衣全链路事实留痕', tone: 'border-slate-200 bg-white text-slate-900' },
    { key: 'inTransit', label: '在途寄送', value: summary.inTransit, helper: '寄出后待签收或在途事件', tone: 'border-violet-200 bg-violet-50 text-violet-700' },
    { key: 'stocktake', label: '盘点差异', value: summary.stocktakeIssueCount, helper: '盘点异常待追踪处理', tone: 'border-rose-200 bg-rose-50 text-rose-700' },
    { key: 'unmapped', label: '待补关联', value: summary.unmappedCount, helper: '需补正式商品项目的记录', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
    { key: 'closed', label: '已收口样衣', value: summary.closedCount, helper: '已退货或已处置的资产', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  ]

  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      ${cards
        .map(
          (card) => `
            <button
              type="button"
              class="${escapeHtml(
                toClassName(
                  'rounded-lg border p-4 text-left transition hover:shadow-sm',
                  card.tone,
                  state.filters.quickFilter === card.key ? 'ring-2 ring-blue-500' : '',
                ),
              )}"
              data-pcs-sample-ledger-action="set-quick-filter"
              data-value="${escapeHtml(card.key)}"
            >
              <p class="text-xs">${escapeHtml(card.label)}</p>
              <p class="mt-2 text-2xl font-semibold">${card.value}</p>
              <p class="mt-2 text-xs opacity-80">${escapeHtml(card.helper)}</p>
            </button>
          `,
        )
        .join('')}
    </section>
  `
}

function renderAssetStatusStrip(): string {
  const summary = getSummary()
  const items = [
    { label: '在库可用', value: summary.statusCounts['在库可用'] || 0, tone: 'text-emerald-700' },
    { label: '预占锁定', value: summary.statusCounts['预占锁定'] || 0, tone: 'text-amber-700' },
    { label: '借出占用', value: summary.statusCounts['借出占用'] || 0, tone: 'text-orange-700' },
    { label: '在途待签收', value: summary.statusCounts['在途待签收'] || 0, tone: 'text-violet-700' },
    { label: '待处置', value: summary.statusCounts['待处置'] || 0, tone: 'text-rose-700' },
  ]

  return `
    <section class="rounded-lg border bg-white px-4 py-3">
      <div class="flex flex-wrap items-center gap-4 text-sm">
        <p class="font-medium text-slate-900">当前样衣状态</p>
        ${items
          .map(
            (item) => `
              <div class="flex items-center gap-2">
                <span class="text-slate-500">${escapeHtml(item.label)}</span>
                <span class="${escapeHtml(toClassName('text-sm font-semibold', item.tone))}">${item.value}</span>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderFilters(): string {
  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="grid gap-4 xl:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]">
        <label class="space-y-1">
          <span class="text-xs text-slate-500">搜索记录</span>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"></i>
            <input
              class="h-10 w-full rounded-md border border-slate-200 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="搜索事件编号 / 样衣编号 / 样衣名称 / 来源单据"
              value="${escapeHtml(state.filters.search)}"
              data-pcs-sample-ledger-field="search"
            />
          </div>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">责任站点</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-sample-ledger-field="site">
            ${['all', '深圳', '雅加达']
              .map((site) => `<option value="${site}" ${state.filters.site === site ? 'selected' : ''}>${escapeHtml(site === 'all' ? '全部站点' : site)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">来源单据</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-sample-ledger-field="source-doc-type">
            ${SOURCE_DOC_TYPE_OPTIONS.map((item) => `<option value="${item.value}" ${state.filters.sourceDocType === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="mt-4">
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs text-slate-500">事件类型</p>
          ${
            state.filters.selectedEventTypes.length > 0
              ? '<button type="button" class="text-xs text-blue-700 hover:underline" data-pcs-sample-ledger-action="clear-event-types">清空事件类型</button>'
              : ''
          }
        </div>
        <div class="mt-2 flex flex-wrap gap-2">
          ${Object.entries(EVENT_META)
            .map(([code, meta]) => {
              const selected = state.filters.selectedEventTypes.includes(code as SampleLedgerEventType)
              return `
                <button
                  type="button"
                  class="${escapeHtml(
                    toClassName(
                      'inline-flex items-center rounded-full border px-3 py-1 text-xs transition',
                      selected ? 'border-slate-900 bg-slate-900 text-white' : meta.className,
                    ),
                  )}"
                  data-pcs-sample-ledger-action="toggle-event-type"
                  data-value="${escapeHtml(code)}"
                >
                  ${escapeHtml(meta.label)}
                </button>
              `
            })
            .join('')}
        </div>
      </div>
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          class="${escapeHtml(
            toClassName(
              'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition',
              state.filters.unmappedOnly ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            ),
          )}"
          data-pcs-sample-ledger-action="toggle-unmapped-only"
        >
          <i data-lucide="link-2-off" class="h-4 w-4"></i>只看待补正式关联
        </button>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-ledger-action="query">查询</button>
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-ledger-action="reset">重置</button>
        </div>
      </div>
    </section>
  `
}

function renderPagination(totalPages: number): string {
  return `
    <div class="flex items-center justify-between px-4 py-3">
      <p class="text-xs text-slate-500">第 ${state.filters.currentPage} / ${totalPages} 页</p>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="${escapeHtml(
            toClassName(
              'inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50',
              state.filters.currentPage === 1 ? 'cursor-not-allowed opacity-50' : '',
            ),
          )}"
          data-pcs-sample-ledger-action="set-page"
          data-page="${state.filters.currentPage - 1}"
          ${state.filters.currentPage === 1 ? 'disabled' : ''}
        >上一页</button>
        <button
          type="button"
          class="inline-flex h-8 items-center rounded-md bg-slate-900 px-3 text-xs text-white"
          disabled
        >${state.filters.currentPage}</button>
        <button
          type="button"
          class="${escapeHtml(
            toClassName(
              'inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50',
              state.filters.currentPage === totalPages ? 'cursor-not-allowed opacity-50' : '',
            ),
          )}"
          data-pcs-sample-ledger-action="set-page"
          data-page="${state.filters.currentPage + 1}"
          ${state.filters.currentPage === totalPages ? 'disabled' : ''}
        >下一页</button>
      </div>
    </div>
  `
}

function renderTable(): string {
  const { items, total, totalPages } = getPagedEvents()
  return `
    <section class="rounded-lg border bg-white">
      <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p class="text-sm font-medium text-slate-900">台账记录</p>
          <p class="mt-1 text-xs text-slate-500">当前共筛选出 ${total} 条台账记录，支持按事件、项目绑定和库存影响联查。</p>
        </div>
        <button type="button" class="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-sample-ledger-action="set-quick-filter" data-value="unmapped">
          <i data-lucide="alert-triangle" class="h-3.5 w-3.5"></i>查看待补关联
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3">业务时间</th>
              <th class="px-4 py-3">样衣</th>
              <th class="px-4 py-3">事件类型</th>
              <th class="px-4 py-3">库存影响</th>
              <th class="px-4 py-3">位置 / 保管</th>
              <th class="px-4 py-3">来源单据</th>
              <th class="px-4 py-3">商品项目 / 工作项</th>
              <th class="px-4 py-3">操作人</th>
              <th class="px-4 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${
              items.length === 0
                ? `
                  <tr>
                    <td colspan="9" class="px-4 py-10 text-center text-sm text-slate-500">当前筛选条件下暂无样衣台账记录。</td>
                  </tr>
                `
                : items
                    .map((event) => {
                      const sourceRoute = getSourceRoute(event)
                      const projectRoute = event.projectId ? `/pcs/projects/${event.projectId}` : null
                      const workItemRoute = getWorkItemRoute(event)
                      return `
                        <tr class="hover:bg-slate-50/80 ${!event.projectId && (event.legacyProjectRef || event.sourceDocCode) ? 'bg-amber-50/40' : ''}">
                          <td class="px-4 py-3 align-top">
                            <p class="text-sm text-slate-900">${escapeHtml(formatDateTime(event.businessDate))}</p>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(event.ledgerEventCode)}</p>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(event.responsibleSite)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-pcs-sample-ledger-action="open-detail" data-event-id="${escapeHtml(event.ledgerEventId)}">${escapeHtml(event.sampleCode)}</button>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(event.sampleName)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">${getEventBadge(event.eventType)}</td>
                          <td class="px-4 py-3 align-top">
                            <div class="flex flex-wrap items-center gap-2">
                              ${getInventoryBadge(event.inventoryStatusAfter as SampleInventoryStatus)}
                              ${
                                isStocktakeIssue(event)
                                  ? '<span class="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">盘点差异</span>'
                                  : ''
                              }
                            </div>
                            <p class="mt-2 text-xs text-slate-500">${escapeHtml(event.inventoryStatusBefore)} → ${escapeHtml(event.inventoryStatusAfter)}</p>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(event.availabilityBefore)} → ${escapeHtml(event.availabilityAfter)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <p class="text-sm text-slate-900">${escapeHtml(event.locationBefore)} → ${escapeHtml(event.locationAfter)}</p>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(event.note || '-')}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            ${
                              sourceRoute
                                ? `<button type="button" class="text-left text-blue-700 hover:underline" data-nav="${escapeHtml(sourceRoute)}">${escapeHtml(event.sourceDocCode || event.sourceDocId)}</button>`
                                : `<p class="text-sm text-slate-900">${escapeHtml(event.sourceDocCode || event.sourceDocId || '-')}</p>`
                            }
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(event.sourceDocType || event.sourceModule)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            ${
                              projectRoute
                                ? `<button type="button" class="text-left text-blue-700 hover:underline" data-nav="${escapeHtml(projectRoute)}">${escapeHtml(event.projectCode)}</button>`
                                : `<p class="text-sm text-amber-700">${escapeHtml(event.legacyProjectRef || '待补正式商品项目')}</p>`
                            }
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(event.projectName || '未识别正式商品项目')}</p>
                            ${
                              workItemRoute
                                ? `<button type="button" class="mt-1 text-xs text-blue-700 hover:underline" data-nav="${escapeHtml(workItemRoute)}">${escapeHtml(event.workItemTypeName || '查看工作项')}</button>`
                                : event.workItemTypeName
                                  ? `<p class="mt-1 text-xs text-slate-500">${escapeHtml(event.workItemTypeName)}</p>`
                                  : ''
                            }
                          </td>
                          <td class="px-4 py-3 align-top text-sm text-slate-700">${escapeHtml(event.operatorName || '-')}</td>
                          <td class="px-4 py-3 align-top text-center">
                            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-sample-ledger-action="open-detail" data-event-id="${escapeHtml(event.ledgerEventId)}">查看详情</button>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
      ${renderPagination(totalPages)}
    </section>
  `
}

function renderPendingSection(): string {
  const items = getPendingItems()
  if (items.length === 0) return ''

  return `
    <section class="rounded-lg border border-amber-200 bg-amber-50/70">
      <div class="flex items-center justify-between border-b border-amber-200 px-4 py-3">
        <div>
          <p class="text-sm font-medium text-amber-900">待补正式关联</p>
          <p class="mt-1 text-xs text-amber-700">以下样衣记录仍保留历史项目字段，需补录正式商品项目或正式工作项关联。</p>
        </div>
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-amber-300 bg-white px-3 text-xs text-amber-700 hover:bg-amber-100" data-pcs-sample-ledger-action="set-quick-filter" data-value="unmapped">筛到这批记录</button>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-amber-200 text-sm">
          <thead class="bg-amber-100/70 text-left text-xs font-medium uppercase tracking-wide text-amber-800">
            <tr>
              <th class="px-4 py-3">样衣编号</th>
              <th class="px-4 py-3">来源页面</th>
              <th class="px-4 py-3">来源单据</th>
              <th class="px-4 py-3">历史项目字段</th>
              <th class="px-4 py-3">历史工作项字段</th>
              <th class="px-4 py-3">原因</th>
              <th class="px-4 py-3">发现时间</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-amber-200/70">
            ${items
              .map(
                (item) => `
                  <tr>
                    <td class="px-4 py-3 font-medium text-amber-900">${escapeHtml(item.sampleCode || '-')}</td>
                    <td class="px-4 py-3 text-amber-900">${escapeHtml(item.sourcePage)}</td>
                    <td class="px-4 py-3 text-amber-900">${escapeHtml(item.sourceDocCode || '-')}</td>
                    <td class="px-4 py-3 text-amber-900">${escapeHtml(item.rawProjectField || '-')}</td>
                    <td class="px-4 py-3 text-amber-900">${escapeHtml(item.rawWorkItemField || '-')}</td>
                    <td class="px-4 py-3 text-amber-800">${escapeHtml(item.reason)}</td>
                    <td class="px-4 py-3 text-amber-900">${escapeHtml(formatDateTime(item.discoveredAt))}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderDrawerShell(title: string, subtitle: string, body: string): string {
  return `
    <div class="fixed inset-0 z-50 flex justify-end">
      <button type="button" class="absolute inset-0 bg-slate-900/35" data-pcs-sample-ledger-action="close-detail"></button>
      <section class="relative flex h-full w-full max-w-3xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div class="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p class="text-xs text-slate-500">样衣台账详情</p>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(title)}</h2>
            <p class="mt-1 text-sm text-slate-500">${escapeHtml(subtitle)}</p>
          </div>
          <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-ledger-action="close-detail">关闭</button>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-5">${body}</div>
      </section>
    </div>
  `
}

function renderDetailDrawer(): string {
  if (!state.detailEventId) return ''
  const event = getAllEvents().find((item) => item.ledgerEventId === state.detailEventId)
  if (!event) return ''
  const asset = getAllAssets().find((item) => item.sampleAssetId === event.sampleAssetId)
  const sameSampleEvents = listSampleLedgerEventsBySample(event.sampleAssetId)
  const sourceRoute = getSourceRoute(event)
  const projectRoute = event.projectId ? `/pcs/projects/${event.projectId}` : null
  const workItemRoute = getWorkItemRoute(event)

  const body = `
    <div class="space-y-6">
      <section class="rounded-lg border bg-slate-50 p-4">
        <div class="flex flex-wrap items-center gap-2">
          ${getEventBadge(event.eventType)}
          ${getInventoryBadge(event.inventoryStatusAfter as SampleInventoryStatus)}
          ${!event.projectId ? '<span class="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">待补正式关联</span>' : ''}
        </div>
        <div class="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <p class="text-xs text-slate-500">事件编码</p>
            <p class="mt-1 font-medium text-slate-900">${escapeHtml(event.ledgerEventCode)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">业务时间</p>
            <p class="mt-1 font-medium text-slate-900">${escapeHtml(formatDateTime(event.businessDate))}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">样衣编号</p>
            <p class="mt-1 font-medium text-slate-900">${escapeHtml(event.sampleCode)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">责任站点 / 操作人</p>
            <p class="mt-1 font-medium text-slate-900">${escapeHtml(event.responsibleSite)} / ${escapeHtml(event.operatorName || '-')}</p>
          </div>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <div class="flex items-center gap-2">
          <i data-lucide="package" class="h-4 w-4 text-slate-500"></i>
          <h3 class="text-sm font-medium text-slate-900">库存影响</h3>
        </div>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs text-slate-500">库存状态</p>
            <p class="mt-2 text-sm font-medium text-slate-900">${escapeHtml(event.inventoryStatusBefore)} → ${escapeHtml(event.inventoryStatusAfter)}</p>
            <p class="mt-2 text-xs text-slate-500">可用性：${escapeHtml(event.availabilityBefore)} → ${escapeHtml(event.availabilityAfter)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs text-slate-500">位置变化</p>
            <p class="mt-2 text-sm font-medium text-slate-900">${escapeHtml(event.locationBefore)} → ${escapeHtml(event.locationAfter)}</p>
            <p class="mt-2 text-xs text-slate-500">当前保管：${escapeHtml(asset?.custodianName || '-')}</p>
          </div>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <div class="flex items-center gap-2">
          <i data-lucide="link-2" class="h-4 w-4 text-slate-500"></i>
          <h3 class="text-sm font-medium text-slate-900">来源与绑定</h3>
        </div>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div class="rounded-lg border border-slate-200 p-4">
            <p class="text-xs text-slate-500">来源单据</p>
            <div class="mt-2">
              ${
                sourceRoute
                  ? `<button type="button" class="text-left text-sm font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(sourceRoute)}">${escapeHtml(event.sourceDocCode || event.sourceDocId)}</button>`
                  : `<p class="text-sm font-medium text-slate-900">${escapeHtml(event.sourceDocCode || event.sourceDocId || '-')}</p>`
              }
              <p class="mt-1 text-xs text-slate-500">${escapeHtml(event.sourceDocType || event.sourceModule)}</p>
            </div>
          </div>
          <div class="rounded-lg border border-slate-200 p-4">
            <p class="text-xs text-slate-500">绑定商品项目</p>
            <div class="mt-2">
              ${
                projectRoute
                  ? `<button type="button" class="text-left text-sm font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(projectRoute)}">${escapeHtml(event.projectCode)}</button>`
                  : `<p class="text-sm font-medium text-amber-700">${escapeHtml(event.legacyProjectRef || '待补正式商品项目')}</p>`
              }
              <p class="mt-1 text-xs text-slate-500">${escapeHtml(event.projectName || '当前仅保留历史字段')}</p>
            </div>
          </div>
          <div class="rounded-lg border border-slate-200 p-4 md:col-span-2">
            <p class="text-xs text-slate-500">正式工作项</p>
            <div class="mt-2">
              ${
                workItemRoute
                  ? `<button type="button" class="text-left text-sm font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(workItemRoute)}">${escapeHtml(event.workItemTypeName || '查看工作项')}</button>`
                  : `<p class="text-sm font-medium text-slate-900">${escapeHtml(event.workItemTypeName || '未识别正式工作项')}</p>`
              }
              <p class="mt-1 text-xs text-slate-500">工作项编码：${escapeHtml(event.workItemTypeCode || '-')}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <div class="flex items-center gap-2">
          <i data-lucide="file-text" class="h-4 w-4 text-slate-500"></i>
          <h3 class="text-sm font-medium text-slate-900">留痕说明</h3>
        </div>
        <div class="mt-4 space-y-3">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs text-slate-500">事件说明</p>
            <p class="mt-2 text-sm text-slate-700">${escapeHtml(event.note || '未填写说明')}</p>
          </div>
          ${
            asset
              ? `
                <div class="grid gap-3 md:grid-cols-4">
                  <div class="rounded-lg border border-slate-200 p-3">
                    <p class="text-xs text-slate-500">当前资产状态</p>
                    <p class="mt-2 text-sm font-medium text-slate-900">${escapeHtml(asset.inventoryStatus)}</p>
                  </div>
                  <div class="rounded-lg border border-slate-200 p-3">
                    <p class="text-xs text-slate-500">当前位置</p>
                    <p class="mt-2 text-sm font-medium text-slate-900">${escapeHtml(asset.locationDisplay)}</p>
                  </div>
                  <div class="rounded-lg border border-slate-200 p-3">
                    <p class="text-xs text-slate-500">当前保管人</p>
                    <p class="mt-2 text-sm font-medium text-slate-900">${escapeHtml(asset.custodianName)}</p>
                  </div>
                  <div class="rounded-lg border border-slate-200 p-3">
                    <p class="text-xs text-slate-500">最后更新</p>
                    <p class="mt-2 text-sm font-medium text-slate-900">${escapeHtml(formatDateTime(asset.updatedAt))}</p>
                  </div>
                </div>
              `
              : ''
          }
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <div class="flex items-center gap-2">
          <i data-lucide="history" class="h-4 w-4 text-slate-500"></i>
          <h3 class="text-sm font-medium text-slate-900">同样衣事件流</h3>
        </div>
        <div class="mt-4 space-y-3">
          ${sameSampleEvents
            .map(
              (item) => `
                <div class="${escapeHtml(toClassName('rounded-lg border px-4 py-3', item.ledgerEventId === event.ledgerEventId ? 'border-blue-200 bg-blue-50/70' : 'border-slate-200 bg-white'))}">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div class="flex flex-wrap items-center gap-2">
                      ${getEventBadge(item.eventType)}
                      <span class="text-xs text-slate-500">${escapeHtml(formatDateTime(item.businessDate))}</span>
                    </div>
                    <p class="text-xs text-slate-500">${escapeHtml(item.ledgerEventCode)}</p>
                  </div>
                  <p class="mt-2 text-sm text-slate-700">${escapeHtml(item.locationBefore)} → ${escapeHtml(item.locationAfter)}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(item.note || '-')}</p>
                </div>
              `,
            )
            .join('')}
        </div>
      </section>
    </div>
  `

  return renderDrawerShell(`${event.sampleCode} · ${EVENT_META[event.eventType].label}`, event.sampleName, body)
}

export function renderPcsSampleLedgerPage(): string {
  ensurePageDataReady()
  return `
    <div class="space-y-4">
      ${renderNotice()}
      ${renderHeader()}
      ${renderKpis()}
      ${renderAssetStatusStrip()}
      ${renderFilters()}
      ${renderTable()}
      ${renderPendingSection()}
      ${renderDetailDrawer()}
    </div>
  `
}

export function isPcsSampleLedgerDialogOpen(): boolean {
  return Boolean(state.detailEventId)
}

export function handlePcsSampleLedgerInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-sample-ledger-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsSampleLedgerField
  if (!field) return false

  if (field === 'search' && fieldNode instanceof HTMLInputElement) {
    state.filters.search = fieldNode.value
    return true
  }
  if (field === 'site' && fieldNode instanceof HTMLSelectElement) {
    state.filters.site = fieldNode.value
    return true
  }
  if (field === 'source-doc-type' && fieldNode instanceof HTMLSelectElement) {
    state.filters.sourceDocType = fieldNode.value
    return true
  }
  return false
}

export function handlePcsSampleLedgerEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-sample-ledger-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsSampleLedgerAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }
  if (action === 'refresh') {
    ensurePageDataReady()
    state.notice = '已刷新样衣台账演示数据。'
    return true
  }
  if (action === 'export') {
    state.notice = `已导出 ${getFilteredEvents().length} 条样衣台账记录。`
    return true
  }
  if (action === 'query') {
    state.filters.currentPage = 1
    return true
  }
  if (action === 'reset') {
    state.filters = {
      search: '',
      site: 'all',
      sourceDocType: 'all',
      selectedEventTypes: [],
      quickFilter: 'all',
      unmappedOnly: false,
      currentPage: 1,
      pageSize: 12,
    }
    return true
  }
  if (action === 'set-quick-filter') {
    const value = (actionNode.dataset.value as QuickFilterKey) || 'all'
    state.filters.quickFilter = state.filters.quickFilter === value ? 'all' : value
    state.filters.currentPage = 1
    return true
  }
  if (action === 'toggle-event-type') {
    const value = actionNode.dataset.value as SampleLedgerEventType | undefined
    if (!value) return true
    state.filters.selectedEventTypes = state.filters.selectedEventTypes.includes(value)
      ? state.filters.selectedEventTypes.filter((item) => item !== value)
      : [...state.filters.selectedEventTypes, value]
    state.filters.currentPage = 1
    return true
  }
  if (action === 'clear-event-types') {
    state.filters.selectedEventTypes = []
    return true
  }
  if (action === 'toggle-unmapped-only') {
    state.filters.unmappedOnly = !state.filters.unmappedOnly
    state.filters.currentPage = 1
    return true
  }
  if (action === 'set-page') {
    const page = Number.parseInt(actionNode.dataset.page || '', 10)
    if (Number.isFinite(page) && page > 0) {
      state.filters.currentPage = page
    }
    return true
  }
  if (action === 'open-detail') {
    const eventId = actionNode.dataset.eventId
    if (!eventId) return true
    state.detailEventId = eventId
    return true
  }
  if (action === 'close-detail') {
    state.detailEventId = null
    return true
  }

  return false
}

export function resetPcsSampleLedgerState(): void {
  state.notice = null
  state.filters = {
    search: '',
    site: 'all',
    sourceDocType: 'all',
    selectedEventTypes: [],
    quickFilter: 'all',
    unmappedOnly: false,
    currentPage: 1,
    pageSize: 12,
  }
  state.detailEventId = null
}

export function navigateToPcsSampleLedger(): void {
  appStore.navigate('/pcs/samples/ledger')
}
