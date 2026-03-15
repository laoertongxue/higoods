import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  listOrderSyncErrors,
  listProductSyncErrors,
  type OrderSyncError,
  type ProductSyncError,
} from '../data/pcs-channels'

type SyncDomain = 'PRODUCT' | 'ORDER'

interface SyncRow {
  id: string
  domain: SyncDomain
  store: string
  objectId: string
  objectName: string
  errorType: string
  errorMsg: string
  time: string
  status: string
}

interface PageState {
  searchKeyword: string
  filterDomain: 'all' | SyncDomain
  filterStore: string
  filterStatus: 'all' | '待处理' | '已重试' | '已恢复'
  currentPage: number
  pageSize: number
  detailDialogOpen: boolean
  detailRowId: string | null
  batchRetryDialogOpen: boolean
  notice: string | null
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

let rows: SyncRow[] = buildRows()

const state: PageState = {
  searchKeyword: '',
  filterDomain: 'all',
  filterStore: 'all',
  filterStatus: 'all',
  currentPage: 1,
  pageSize: 10,
  detailDialogOpen: false,
  detailRowId: null,
  batchRetryDialogOpen: false,
  notice: '已迁移同步状态：商品同步错误、订单同步错误、重试与错误详情弹窗。',
}

function buildRows(): SyncRow[] {
  const productRows = listProductSyncErrors().map<SyncRow>((row: ProductSyncError) => ({
    id: row.id,
    domain: 'PRODUCT',
    store: row.store,
    objectId: row.productId,
    objectName: row.productName,
    errorType: row.errorType,
    errorMsg: row.errorMsg,
    time: row.time,
    status: row.status,
  }))

  const orderRows = listOrderSyncErrors().map<SyncRow>((row: OrderSyncError) => ({
    id: row.id,
    domain: 'ORDER',
    store: row.store,
    objectId: row.orderId,
    objectName: `订单 ${row.orderId}`,
    errorType: row.errorType,
    errorMsg: row.errorMsg,
    time: row.time,
    status: row.status,
  }))

  return [...productRows, ...orderRows].sort((a, b) => b.time.localeCompare(a.time))
}

function getStatusColor(status: SyncRow['status']): string {
  if (status === '待处理') return 'bg-rose-100 text-rose-700'
  if (status === '已重试') return 'bg-amber-100 text-amber-700'
  return 'bg-emerald-100 text-emerald-700'
}

function getDomainMeta(domain: SyncDomain): { label: string; color: string } {
  if (domain === 'PRODUCT') {
    return { label: '商品同步', color: 'bg-blue-100 text-blue-700' }
  }
  return { label: '订单同步', color: 'bg-violet-100 text-violet-700' }
}

function getFilteredRows(): SyncRow[] {
  const keyword = state.searchKeyword.trim().toLowerCase()

  return rows.filter((row) => {
    if (
      keyword &&
      !row.id.toLowerCase().includes(keyword) &&
      !row.objectId.toLowerCase().includes(keyword) &&
      !row.objectName.toLowerCase().includes(keyword) &&
      !row.errorMsg.toLowerCase().includes(keyword)
    ) {
      return false
    }

    if (state.filterDomain !== 'all' && row.domain !== state.filterDomain) return false
    if (state.filterStore !== 'all' && row.store !== state.filterStore) return false
    if (state.filterStatus !== 'all' && row.status !== state.filterStatus) return false

    return true
  })
}

function getPaging(filteredRows: SyncRow[]) {
  const total = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize))
  const currentPage = Math.min(Math.max(1, state.currentPage), totalPages)
  const start = (currentPage - 1) * state.pageSize
  const end = start + state.pageSize

  return {
    rows: filteredRows.slice(start, end),
    total,
    totalPages,
    currentPage,
    from: total === 0 ? 0 : start + 1,
    to: total === 0 ? 0 : Math.min(end, total),
  }
}

function getStats() {
  return {
    total: rows.length,
    pending: rows.filter((row) => row.status === '待处理').length,
    retried: rows.filter((row) => row.status === '已重试').length,
    recovered: rows.filter((row) => row.status === '已恢复').length,
    product: rows.filter((row) => row.domain === 'PRODUCT').length,
    order: rows.filter((row) => row.domain === 'ORDER').length,
  }
}

function getSelectedRow(): SyncRow | null {
  if (!state.detailRowId) return null
  return rows.find((row) => row.id === state.detailRowId) ?? null
}

function renderNotice(): string {
  if (!state.notice) return ''

  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-store-sync-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">同步状态</h1>
        <p class="mt-1 text-sm text-muted-foreground">查看渠道店铺的商品与订单同步错误，并执行重试处理。</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-store-sync-action="go-store-list">
          <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回店铺列表
        </button>
        <button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-pcs-store-sync-action="open-batch-retry">
          <i data-lucide="refresh-cw" class="mr-1 h-3.5 w-3.5"></i>批量重试待处理
        </button>
      </div>
    </header>
  `
}

function renderStats(): string {
  const stats = getStats()

  return `
    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">同步错误总数</p><p class="mt-1 text-xl font-semibold">${stats.total}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">待处理</p><p class="mt-1 text-xl font-semibold text-rose-700">${stats.pending}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">已重试</p><p class="mt-1 text-xl font-semibold text-amber-700">${stats.retried}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">已恢复</p><p class="mt-1 text-xl font-semibold text-emerald-700">${stats.recovered}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">商品同步错误</p><p class="mt-1 text-xl font-semibold text-blue-700">${stats.product}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">订单同步错误</p><p class="mt-1 text-xl font-semibold text-violet-700">${stats.order}</p></article>
    </section>
  `
}

function renderFilters(): string {
  const stores = Array.from(new Set(rows.map((row) => row.store))).sort((a, b) => a.localeCompare(b))

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div class="xl:col-span-2">
          <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
            <input class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" placeholder="错误ID / 对象ID / 错误信息" value="${escapeHtml(state.searchKeyword)}" data-pcs-store-sync-field="searchKeyword" />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">错误域</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-store-sync-field="filterDomain">
            <option value="all" ${state.filterDomain === 'all' ? 'selected' : ''}>全部</option>
            <option value="PRODUCT" ${state.filterDomain === 'PRODUCT' ? 'selected' : ''}>商品同步</option>
            <option value="ORDER" ${state.filterDomain === 'ORDER' ? 'selected' : ''}>订单同步</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">店铺</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-store-sync-field="filterStore">
            <option value="all" ${state.filterStore === 'all' ? 'selected' : ''}>全部店铺</option>
            ${stores.map((store) => `<option value="${escapeHtml(store)}" ${state.filterStore === store ? 'selected' : ''}>${escapeHtml(store)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">处理状态</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-store-sync-field="filterStatus">
            <option value="all" ${state.filterStatus === 'all' ? 'selected' : ''}>全部</option>
            <option value="待处理" ${state.filterStatus === '待处理' ? 'selected' : ''}>待处理</option>
            <option value="已重试" ${state.filterStatus === '已重试' ? 'selected' : ''}>已重试</option>
            <option value="已恢复" ${state.filterStatus === '已恢复' ? 'selected' : ''}>已恢复</option>
          </select>
        </div>
      </div>
      <div class="mt-3 flex justify-end">
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-store-sync-action="reset-filters">重置筛选</button>
      </div>
    </section>
  `
}

function renderRows(filteredRows: SyncRow[]): string {
  if (!filteredRows.length) {
    return `
      <tr>
        <td colspan="8" class="px-4 py-12 text-center text-muted-foreground">
          <i data-lucide="shield-check" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
          <p class="mt-2 text-sm">暂无同步错误</p>
        </td>
      </tr>
    `
  }

  return filteredRows
    .map((row) => {
      const domainMeta = getDomainMeta(row.domain)

      return `
        <tr class="border-b last:border-b-0 hover:bg-muted/40">
          <td class="px-3 py-3 align-top">
            <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${domainMeta.color}">${domainMeta.label}</span>
          </td>
          <td class="px-3 py-3 align-top text-xs">
            <p class="font-medium">${escapeHtml(row.id)}</p>
            <p class="mt-1 text-muted-foreground">${escapeHtml(row.objectId)}</p>
          </td>
          <td class="px-3 py-3 align-top text-xs">${escapeHtml(row.objectName)}</td>
          <td class="px-3 py-3 align-top text-xs">${escapeHtml(row.store)}</td>
          <td class="px-3 py-3 align-top text-xs">${escapeHtml(row.errorType)}</td>
          <td class="px-3 py-3 align-top text-xs text-muted-foreground">${escapeHtml(row.errorMsg)}</td>
          <td class="px-3 py-3 align-top"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getStatusColor(row.status)}">${escapeHtml(row.status)}</span></td>
          <td class="px-3 py-3 align-top text-xs">
            <p class="text-muted-foreground">${escapeHtml(row.time)}</p>
            <div class="mt-2 flex flex-wrap gap-1">
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-store-sync-action="open-detail" data-row-id="${escapeHtml(row.id)}">查看详情</button>
              ${row.status !== '已恢复' ? `<button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-50" data-pcs-store-sync-action="retry-one" data-row-id="${escapeHtml(row.id)}">重试</button>` : ''}
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderTable(): string {
  const filtered = getFilteredRows()
  const paging = getPaging(filtered)
  state.currentPage = paging.currentPage

  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1180px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">错误域</th>
              <th class="px-3 py-2 font-medium">错误ID / 对象ID</th>
              <th class="px-3 py-2 font-medium">对象名称</th>
              <th class="px-3 py-2 font-medium">店铺</th>
              <th class="px-3 py-2 font-medium">错误类型</th>
              <th class="px-3 py-2 font-medium">错误信息</th>
              <th class="px-3 py-2 font-medium">处理状态</th>
              <th class="px-3 py-2 font-medium">时间 / 操作</th>
            </tr>
          </thead>
          <tbody>${renderRows(paging.rows)}</tbody>
        </table>
      </div>
      <footer class="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-3">
        <p class="text-xs text-muted-foreground">共 ${paging.total} 条${paging.total ? `，当前 ${paging.from}-${paging.to}` : ''}</p>
        <div class="flex flex-wrap items-center gap-2">
          <select class="h-8 rounded-md border bg-background px-2 text-xs" data-pcs-store-sync-field="pageSize">
            ${PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${size === state.pageSize ? 'selected' : ''}>${size} 条/页</option>`).join('')}
          </select>
          <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${paging.currentPage <= 1 ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-store-sync-action="prev-page" ${paging.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
          <span class="text-xs text-muted-foreground">${paging.currentPage} / ${paging.totalPages}</span>
          <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${paging.currentPage >= paging.totalPages ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-store-sync-action="next-page" ${paging.currentPage >= paging.totalPages ? 'disabled' : ''}>下一页</button>
        </div>
      </footer>
    </section>
  `
}

function renderDetailDialog(): string {
  if (!state.detailDialogOpen) return ''

  const row = getSelectedRow()
  if (!row) return ''

  const domainMeta = getDomainMeta(row.domain)

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-2xl rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">同步错误详情</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.id)} · ${escapeHtml(row.time)}</p>
        </header>
        <div class="space-y-3 px-4 py-4 text-sm">
          <p>错误域：<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${domainMeta.color}">${domainMeta.label}</span></p>
          <p>对象：${escapeHtml(row.objectId)} ｜ ${escapeHtml(row.objectName)}</p>
          <p>店铺：${escapeHtml(row.store)}</p>
          <p>错误类型：${escapeHtml(row.errorType)}</p>
          <div class="rounded-md border bg-muted/30 p-3">
            <p class="text-xs text-muted-foreground">错误信息</p>
            <p class="mt-1">${escapeHtml(row.errorMsg)}</p>
          </div>
          <p>处理状态：<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getStatusColor(row.status)}">${escapeHtml(row.status)}</span></p>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-store-sync-action="close-detail">关闭</button>
          ${row.status !== '已恢复' ? `<button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-store-sync-action="retry-one" data-row-id="${escapeHtml(row.id)}">重试</button>` : ''}
        </footer>
      </section>
    </div>
  `
}

function renderBatchRetryDialog(): string {
  if (!state.batchRetryDialogOpen) return ''

  const pendingCount = getFilteredRows().filter((row) => row.status === '待处理').length

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-md rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">批量重试待处理错误</h3>
        </header>
        <div class="space-y-2 px-4 py-4 text-sm">
          <p>当前筛选范围内共有 <span class="font-semibold text-rose-700">${pendingCount}</span> 条待处理错误。</p>
          <p class="text-muted-foreground">确认后将统一标记为“已重试”（演示态）。</p>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-store-sync-action="close-batch-retry">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-store-sync-action="confirm-batch-retry">确认重试</button>
        </footer>
      </section>
    </div>
  `
}

function closeAllDialogs(): void {
  state.detailDialogOpen = false
  state.detailRowId = null
  state.batchRetryDialogOpen = false
}

function retryRows(targetRows: SyncRow[]): number {
  let updated = 0
  targetRows.forEach((row) => {
    const matched = rows.find((item) => item.id === row.id)
    if (!matched) return
    if (matched.status === '已恢复') return
    matched.status = '已重试'
    updated += 1
  })
  return updated
}

export function renderPcsChannelStoreSyncPage(): string {
  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderStats()}
      ${renderFilters()}
      ${renderTable()}
      ${renderDetailDialog()}
      ${renderBatchRetryDialog()}
    </div>
  `
}

export function handlePcsChannelStoreSyncEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-store-sync-field]')

  if (fieldNode instanceof HTMLInputElement) {
    if (fieldNode.dataset.pcsStoreSyncField === 'searchKeyword') {
      state.searchKeyword = fieldNode.value
      state.currentPage = 1
      return true
    }
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsStoreSyncField
    if (field === 'filterDomain') state.filterDomain = fieldNode.value as PageState['filterDomain']
    if (field === 'filterStore') state.filterStore = fieldNode.value
    if (field === 'filterStatus') state.filterStatus = fieldNode.value as PageState['filterStatus']
    if (field === 'pageSize') state.pageSize = Number(fieldNode.value) || 10
    state.currentPage = 1
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-store-sync-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsStoreSyncAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'go-store-list') {
    appStore.navigate('/pcs/channels/stores')
    return true
  }

  if (action === 'reset-filters') {
    state.searchKeyword = ''
    state.filterDomain = 'all'
    state.filterStore = 'all'
    state.filterStatus = 'all'
    state.currentPage = 1
    return true
  }

  if (action === 'open-detail') {
    const rowId = actionNode.dataset.rowId
    if (!rowId) return false
    state.detailDialogOpen = true
    state.detailRowId = rowId
    return true
  }

  if (action === 'close-detail') {
    state.detailDialogOpen = false
    state.detailRowId = null
    return true
  }

  if (action === 'retry-one') {
    const rowId = actionNode.dataset.rowId
    if (!rowId) return false
    const row = rows.find((item) => item.id === rowId)
    if (!row) return false
    if (row.status === '已恢复') {
      state.notice = `${row.id} 已恢复，无需重试。`
      return true
    }
    row.status = '已重试'
    state.notice = `${row.id} 已执行重试（演示态）。`
    return true
  }

  if (action === 'open-batch-retry') {
    state.batchRetryDialogOpen = true
    return true
  }

  if (action === 'close-batch-retry') {
    state.batchRetryDialogOpen = false
    return true
  }

  if (action === 'confirm-batch-retry') {
    const pendingRows = getFilteredRows().filter((row) => row.status === '待处理')
    const updated = retryRows(pendingRows)
    state.batchRetryDialogOpen = false
    state.notice = `批量重试完成：${updated} 条已更新为“已重试”（演示态）。`
    return true
  }

  if (action === 'prev-page') {
    state.currentPage = Math.max(1, state.currentPage - 1)
    state.detailDialogOpen = false
    state.detailRowId = null
    return true
  }

  if (action === 'next-page') {
    const totalPages = Math.max(1, Math.ceil(getFilteredRows().length / state.pageSize))
    state.currentPage = Math.min(totalPages, state.currentPage + 1)
    state.detailDialogOpen = false
    state.detailRowId = null
    return true
  }

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsChannelStoreSyncDialogOpen(): boolean {
  return state.detailDialogOpen || state.batchRetryDialogOpen
}
