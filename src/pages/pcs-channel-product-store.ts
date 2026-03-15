import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  CHANNEL_OPTIONS,
  CHANNEL_PRODUCT_STATUS_META,
  CHANNEL_PRODUCTS,
  MAPPING_HEALTH_META,
  STORE_OPTIONS,
  listChannelProducts,
  type ChannelProduct,
} from '../data/pcs-channels'

interface PageState {
  searchKeyword: string
  filterChannel: string
  filterStore: string
  filterStatus: string
  filterMappingHealth: string
  selectedProducts: string[]
  currentPage: number
  pageSize: number
  notice: string | null
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

let products: ChannelProduct[] = listChannelProducts()

const state: PageState = {
  searchKeyword: '',
  filterChannel: 'all',
  filterStore: 'all',
  filterStatus: 'all',
  filterMappingHealth: 'all',
  selectedProducts: [],
  currentPage: 1,
  pageSize: 10,
  notice: '已迁移店铺渠道商品内页，支持批量选择、映射健康筛选和详情跳转。',
}

function getFilteredRows(): ChannelProduct[] {
  const keyword = state.searchKeyword.trim().toLowerCase()

  return products.filter((row) => {
    if (
      keyword &&
      !row.internalRefName.toLowerCase().includes(keyword) &&
      !row.internalRefCode.toLowerCase().includes(keyword) &&
      !(row.platformItemId ?? '').toLowerCase().includes(keyword)
    ) {
      return false
    }

    if (state.filterChannel !== 'all' && row.channel !== state.filterChannel) return false
    if (state.filterStore !== 'all' && row.storeId !== state.filterStore) return false
    if (state.filterStatus !== 'all' && row.status !== state.filterStatus) return false
    if (state.filterMappingHealth !== 'all' && row.mappingHealth !== state.filterMappingHealth) return false
    return true
  })
}

function getPaging(rows: ChannelProduct[]) {
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize))
  const currentPage = Math.min(Math.max(1, state.currentPage), totalPages)
  const start = (currentPage - 1) * state.pageSize
  const end = start + state.pageSize

  return {
    rows: rows.slice(start, end),
    total,
    totalPages,
    currentPage,
    from: total === 0 ? 0 : start + 1,
    to: total === 0 ? 0 : Math.min(end, total),
  }
}

function getStats() {
  return {
    total: CHANNEL_PRODUCTS.length,
    online: CHANNEL_PRODUCTS.filter((item) => item.status === 'ONLINE').length,
    draft: CHANNEL_PRODUCTS.filter((item) => item.status === 'DRAFT' || item.status === 'READY').length,
    listingInProgress: CHANNEL_PRODUCTS.filter((item) => item.status === 'LISTING_IN_PROGRESS').length,
    blocked: CHANNEL_PRODUCTS.filter((item) => item.status === 'BLOCKED').length,
    mappingIssue: CHANNEL_PRODUCTS.filter((item) => item.mappingHealth !== 'OK').length,
  }
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-channel-store-view-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">店铺渠道商品视图</h1>
        <p class="mt-1 text-sm text-muted-foreground">按渠道 × 店铺查看商品状态、映射健康和上架执行结果。</p>
      </div>
      <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-store-view-action="go-group-view">
        <i data-lucide="layers" class="mr-1 h-3.5 w-3.5"></i>返回商品组视图
      </button>
    </header>
  `
}

function renderStats(): string {
  const stats = getStats()

  return `
    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">店铺商品总数</p><p class="mt-1 text-xl font-semibold">${stats.total}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">在售</p><p class="mt-1 text-xl font-semibold text-emerald-700">${stats.online}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">草稿/就绪</p><p class="mt-1 text-xl font-semibold text-blue-700">${stats.draft}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">上架中</p><p class="mt-1 text-xl font-semibold text-amber-700">${stats.listingInProgress}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">受限</p><p class="mt-1 text-xl font-semibold text-rose-700">${stats.blocked}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">映射异常</p><p class="mt-1 text-xl font-semibold text-orange-700">${stats.mappingIssue}</p></article>
    </section>
  `
}

function renderFilters(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
            <input class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" placeholder="内部编码 / 商品名称 / 平台商品ID" value="${escapeHtml(state.searchKeyword)}" data-pcs-channel-store-view-field="searchKeyword" />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">渠道</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-store-view-field="filterChannel">
            <option value="all" ${state.filterChannel === 'all' ? 'selected' : ''}>全部渠道</option>
            ${CHANNEL_OPTIONS.map((channel) => `<option value="${channel.id}" ${state.filterChannel === channel.id ? 'selected' : ''}>${channel.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">店铺</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-store-view-field="filterStore">
            <option value="all" ${state.filterStore === 'all' ? 'selected' : ''}>全部店铺</option>
            ${STORE_OPTIONS.map((store) => `<option value="${store.id}" ${state.filterStore === store.id ? 'selected' : ''}>${store.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">状态</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-store-view-field="filterStatus">
            <option value="all" ${state.filterStatus === 'all' ? 'selected' : ''}>全部状态</option>
            ${Object.entries(CHANNEL_PRODUCT_STATUS_META)
              .map(([key, meta]) => `<option value="${key}" ${state.filterStatus === key ? 'selected' : ''}>${meta.label}</option>`)
              .join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">映射健康</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-store-view-field="filterMappingHealth">
            <option value="all" ${state.filterMappingHealth === 'all' ? 'selected' : ''}>全部</option>
            <option value="OK" ${state.filterMappingHealth === 'OK' ? 'selected' : ''}>正常</option>
            <option value="MISSING" ${state.filterMappingHealth === 'MISSING' ? 'selected' : ''}>缺映射</option>
            <option value="CONFLICT" ${state.filterMappingHealth === 'CONFLICT' ? 'selected' : ''}>冲突</option>
          </select>
        </div>
      </div>
      <div class="mt-3 flex justify-end">
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-channel-store-view-action="reset-filters">重置筛选</button>
      </div>
    </section>
  `
}

function renderRows(rows: ChannelProduct[]): string {
  if (!rows.length) {
    return `
      <tr>
        <td colspan="11" class="px-4 py-12 text-center text-muted-foreground">
          <i data-lucide="shopping-bag" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
          <p class="mt-2 text-sm">暂无店铺渠道商品数据</p>
        </td>
      </tr>
    `
  }

  return rows
    .map((product) => {
      const selected = state.selectedProducts.includes(product.id)
      const channel = CHANNEL_OPTIONS.find((item) => item.id === product.channel)
      return `
        <tr class="border-b last:border-b-0 hover:bg-muted/40">
          <td class="px-3 py-3 align-top"><input type="checkbox" class="h-4 w-4 rounded border" ${selected ? 'checked' : ''} data-pcs-channel-store-view-action="toggle-select" data-product-id="${escapeHtml(product.id)}" /></td>
          <td class="px-3 py-3 align-top text-xs">${escapeHtml(channel?.name ?? product.channel)}<br/>${escapeHtml(product.storeName)}</td>
          <td class="px-3 py-3 align-top">
            <button class="font-medium text-blue-700 hover:underline" data-pcs-channel-store-view-action="go-detail" data-product-id="${escapeHtml(product.id)}">${escapeHtml(product.id)}</button>
            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(product.platformItemTitle)}</p>
            <p class="text-xs text-muted-foreground">${escapeHtml(product.platformItemId ?? '-')}</p>
          </td>
          <td class="px-3 py-3 align-top text-xs">${escapeHtml(product.internalRefCode)}<br/>${escapeHtml(product.internalRefName)}</td>
          <td class="px-3 py-3 align-top">${product.variantCount}</td>
          <td class="px-3 py-3 align-top text-right">${product.storePrice.toLocaleString()} ${escapeHtml(product.currency)}</td>
          <td class="px-3 py-3 align-top"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${CHANNEL_PRODUCT_STATUS_META[product.status].color}">${CHANNEL_PRODUCT_STATUS_META[product.status].label}</span></td>
          <td class="px-3 py-3 align-top"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${MAPPING_HEALTH_META[product.mappingHealth].color}">${MAPPING_HEALTH_META[product.mappingHealth].label}</span></td>
          <td class="px-3 py-3 align-top text-xs">${escapeHtml(product.activeListingInstanceId ?? '-')}</td>
          <td class="px-3 py-3 align-top text-xs text-muted-foreground">${escapeHtml(product.updatedAt)}</td>
          <td class="px-3 py-3 align-top">
            <div class="flex flex-wrap gap-1">
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-channel-store-view-action="go-detail" data-product-id="${escapeHtml(product.id)}">详情</button>
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-channel-store-view-action="open-action" data-product-id="${escapeHtml(product.id)}">更多操作</button>
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

  const allSelected = filtered.length > 0 && filtered.every((item) => state.selectedProducts.includes(item.id))

  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="border-b px-3 py-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <label class="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" class="h-4 w-4 rounded border" ${allSelected ? 'checked' : ''} data-pcs-channel-store-view-action="toggle-select-all" />
            全选当前筛选结果
          </label>
          <div class="flex gap-2">
            <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-channel-store-view-action="batch-offline">批量下架</button>
            <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-channel-store-view-action="batch-export">导出</button>
          </div>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1440px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">选择</th>
              <th class="px-3 py-2 font-medium">渠道/店铺</th>
              <th class="px-3 py-2 font-medium">商品</th>
              <th class="px-3 py-2 font-medium">内部对象</th>
              <th class="px-3 py-2 font-medium">变体数</th>
              <th class="px-3 py-2 text-right font-medium">店铺价</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">映射健康</th>
              <th class="px-3 py-2 font-medium">执行实例</th>
              <th class="px-3 py-2 font-medium">更新时间</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${renderRows(paging.rows)}</tbody>
        </table>
      </div>
      <footer class="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-3">
        <p class="text-xs text-muted-foreground">共 ${paging.total} 条${paging.total ? `，当前 ${paging.from}-${paging.to}` : ''}</p>
        <div class="flex flex-wrap items-center gap-2">
          <select class="h-8 rounded-md border bg-background px-2 text-xs" data-pcs-channel-store-view-field="pageSize">
            ${PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${size === state.pageSize ? 'selected' : ''}>${size} 条/页</option>`).join('')}
          </select>
          <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${paging.currentPage <= 1 ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-channel-store-view-action="prev-page" ${paging.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
          <span class="text-xs text-muted-foreground">${paging.currentPage} / ${paging.totalPages}</span>
          <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${paging.currentPage >= paging.totalPages ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-channel-store-view-action="next-page" ${paging.currentPage >= paging.totalPages ? 'disabled' : ''}>下一页</button>
        </div>
      </footer>
    </section>
  `
}

export function renderPcsChannelProductStoreViewPage(): string {
  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderStats()}
      ${renderFilters()}
      ${renderTable()}
    </div>
  `
}

export function handlePcsChannelProductStoreViewEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-channel-store-view-field]')

  if (fieldNode instanceof HTMLInputElement) {
    if (fieldNode.dataset.pcsChannelStoreViewField === 'searchKeyword') {
      state.searchKeyword = fieldNode.value
      state.currentPage = 1
      return true
    }
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsChannelStoreViewField
    if (field === 'filterChannel') state.filterChannel = fieldNode.value
    if (field === 'filterStore') state.filterStore = fieldNode.value
    if (field === 'filterStatus') state.filterStatus = fieldNode.value
    if (field === 'filterMappingHealth') state.filterMappingHealth = fieldNode.value
    if (field === 'pageSize') state.pageSize = Number(fieldNode.value) || 10
    state.currentPage = 1
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-channel-store-view-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsChannelStoreViewAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'go-group-view') {
    appStore.navigate('/pcs/channels/products')
    return true
  }

  if (action === 'go-detail') {
    const productId = actionNode.dataset.productId
    if (!productId) return false
    appStore.navigate(`/pcs/channels/products/${productId}`)
    return true
  }

  if (action === 'toggle-select') {
    const productId = actionNode.dataset.productId
    if (!productId) return false
    if (state.selectedProducts.includes(productId)) {
      state.selectedProducts = state.selectedProducts.filter((item) => item !== productId)
    } else {
      state.selectedProducts = [...state.selectedProducts, productId]
    }
    return true
  }

  if (action === 'toggle-select-all') {
    const filtered = getFilteredRows()
    const allSelected = filtered.length > 0 && filtered.every((item) => state.selectedProducts.includes(item.id))
    if (allSelected) {
      state.selectedProducts = state.selectedProducts.filter((id) => !filtered.some((item) => item.id === id))
    } else {
      const merged = new Set([...state.selectedProducts, ...filtered.map((item) => item.id)])
      state.selectedProducts = Array.from(merged)
    }
    return true
  }

  if (action === 'batch-offline') {
    state.notice = `已提交批量下架（${state.selectedProducts.length} 项，演示态）。`
    return true
  }

  if (action === 'batch-export') {
    state.notice = `已导出选中数据（${state.selectedProducts.length} 项，演示态）。`
    return true
  }

  if (action === 'open-action') {
    const productId = actionNode.dataset.productId
    if (!productId) return false
    state.notice = `${productId} 已打开更多操作菜单（演示态）。`
    return true
  }

  if (action === 'reset-filters') {
    state.searchKeyword = ''
    state.filterChannel = 'all'
    state.filterStore = 'all'
    state.filterStatus = 'all'
    state.filterMappingHealth = 'all'
    state.currentPage = 1
    return true
  }

  if (action === 'prev-page') {
    state.currentPage = Math.max(1, state.currentPage - 1)
    return true
  }

  if (action === 'next-page') {
    const totalPages = Math.max(1, Math.ceil(getFilteredRows().length / state.pageSize))
    state.currentPage = Math.min(totalPages, state.currentPage + 1)
    return true
  }

  return false
}
