import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { renderFormDrawer as uiFormDrawer } from '../components/ui'
import { renderTablePagination } from '../components/ui/pagination'
import {
  DEFAULT_PAGE_SIZE_OPTIONS,
  getNextPage,
  getPrevPage,
  paginateRows,
  parsePageSize,
} from '../utils/paging'
import {
  CHANNEL_STORES,
  LEGAL_ENTITIES,
  OWNER_TYPE_META,
  STORE_AUTH_STATUS_META,
  STORE_STATUS_META,
  listChannelStores,
  type ChannelStore,
} from '../data/pcs-channels'

interface NewStoreForm {
  channel: string
  storeName: string
  storeCode: string
  platformStoreId: string
  country: string
  pricingCurrency: string
  settlementCurrency: string
  timezone: string
}

interface PageState {
  searchKeyword: string
  filterChannel: string
  filterCountry: string
  filterStatus: string
  filterAuthStatus: string
  filterOwnerType: string
  filterLegalEntity: string
  currentPage: number
  pageSize: number
  createDrawerOpen: boolean
  newStore: NewStoreForm
  notice: string | null
}

let stores: ChannelStore[] = listChannelStores()

const state: PageState = {
  searchKeyword: '',
  filterChannel: 'all',
  filterCountry: 'all',
  filterStatus: 'all',
  filterAuthStatus: 'all',
  filterOwnerType: 'all',
  filterLegalEntity: 'all',
  currentPage: 1,
  pageSize: 10,
  createDrawerOpen: false,
  newStore: {
    channel: '',
    storeName: '',
    storeCode: '',
    platformStoreId: '',
    country: '',
    pricingCurrency: '',
    settlementCurrency: '',
    timezone: '',
  },
  notice: '已迁移渠道店铺管理：列表、筛选、新建店铺抽屉、店铺详情内页与同步/提现入口。',
}

function getFilteredRows(): ChannelStore[] {
  const keyword = state.searchKeyword.trim().toLowerCase()

  return stores.filter((store) => {
    if (
      keyword &&
      !store.storeName.toLowerCase().includes(keyword) &&
      !store.storeCode.toLowerCase().includes(keyword)
    ) {
      return false
    }

    if (state.filterChannel !== 'all' && store.channel !== state.filterChannel) return false
    if (state.filterCountry !== 'all' && store.country !== state.filterCountry) return false
    if (state.filterStatus !== 'all' && store.status !== state.filterStatus) return false
    if (state.filterAuthStatus !== 'all' && store.authStatus !== state.filterAuthStatus) return false
    if (state.filterOwnerType !== 'all' && store.ownerType !== state.filterOwnerType) return false

    if (state.filterLegalEntity !== 'all') {
      const entity = LEGAL_ENTITIES.find((item) => item.id === state.filterLegalEntity)
      if (!entity || store.ownerName !== entity.name) return false
    }

    return true
  })
}

function getPaging(rows: ChannelStore[]) {
  return paginateRows(rows, state.currentPage, state.pageSize)
}

function getStats() {
  return {
    total: CHANNEL_STORES.length,
    active: CHANNEL_STORES.filter((item) => item.status === 'ACTIVE').length,
    connected: CHANNEL_STORES.filter((item) => item.authStatus === 'CONNECTED').length,
    expired: CHANNEL_STORES.filter((item) => item.authStatus === 'EXPIRED').length,
    noPayoutBinding: CHANNEL_STORES.filter((item) => !item.payoutAccountId).length,
    personalOwner: CHANNEL_STORES.filter((item) => item.ownerType === 'PERSONAL').length,
  }
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-channel-store-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">渠道店铺管理</h1>
        <p class="mt-1 text-sm text-muted-foreground">管理渠道×店铺基础信息、授权连接与提现账号绑定关系。</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-store-action="go-payout">
          <i data-lucide="wallet" class="mr-1 h-3.5 w-3.5"></i>提现账号管理
        </button>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-store-action="go-sync">
          <i data-lucide="refresh-cw" class="mr-1 h-3.5 w-3.5"></i>同步状态
        </button>
        <button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-pcs-channel-store-action="open-create">
          <i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>新建店铺
        </button>
      </div>
    </header>
  `
}

function renderStats(): string {
  const stats = getStats()

  return `
    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">全部店铺</p><p class="mt-1 text-xl font-semibold">${stats.total}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">启用中</p><p class="mt-1 text-xl font-semibold text-emerald-700">${stats.active}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">已授权</p><p class="mt-1 text-xl font-semibold text-blue-700">${stats.connected}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">授权过期</p><p class="mt-1 text-xl font-semibold text-amber-700">${stats.expired}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">缺少提现绑定</p><p class="mt-1 text-xl font-semibold text-rose-700">${stats.noPayoutBinding}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">个人归属</p><p class="mt-1 text-xl font-semibold text-orange-700">${stats.personalOwner}</p></article>
    </section>
  `
}

function renderFilters(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <div class="xl:col-span-2">
          <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
            <input class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" placeholder="店铺名称 / 店铺编码" value="${escapeHtml(state.searchKeyword)}" data-pcs-channel-store-field="searchKeyword" />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">渠道</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-store-field="filterChannel">
            <option value="all" ${state.filterChannel === 'all' ? 'selected' : ''}>全部</option>
            ${Array.from(new Set(stores.map((item) => item.channel))).map((channel) => `<option value="${channel}" ${state.filterChannel === channel ? 'selected' : ''}>${channel}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">国家/区域</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-store-field="filterCountry">
            <option value="all" ${state.filterCountry === 'all' ? 'selected' : ''}>全部</option>
            ${Array.from(new Set(stores.map((item) => item.country))).map((country) => `<option value="${country}" ${state.filterCountry === country ? 'selected' : ''}>${country}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">店铺状态</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-store-field="filterStatus">
            <option value="all" ${state.filterStatus === 'all' ? 'selected' : ''}>全部</option>
            ${Object.entries(STORE_STATUS_META).map(([key, meta]) => `<option value="${key}" ${state.filterStatus === key ? 'selected' : ''}>${meta.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">授权状态</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-store-field="filterAuthStatus">
            <option value="all" ${state.filterAuthStatus === 'all' ? 'selected' : ''}>全部</option>
            ${Object.entries(STORE_AUTH_STATUS_META).map(([key, meta]) => `<option value="${key}" ${state.filterAuthStatus === key ? 'selected' : ''}>${meta.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-3">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">归属类型</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-store-field="filterOwnerType">
            <option value="all" ${state.filterOwnerType === 'all' ? 'selected' : ''}>全部</option>
            <option value="LEGAL" ${state.filterOwnerType === 'LEGAL' ? 'selected' : ''}>法人</option>
            <option value="PERSONAL" ${state.filterOwnerType === 'PERSONAL' ? 'selected' : ''}>个人</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">法人主体</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-store-field="filterLegalEntity">
            <option value="all" ${state.filterLegalEntity === 'all' ? 'selected' : ''}>全部</option>
            ${LEGAL_ENTITIES.map((entity) => `<option value="${entity.id}" ${state.filterLegalEntity === entity.id ? 'selected' : ''}>${entity.name}</option>`).join('')}
          </select>
        </div>
        <div class="flex items-end justify-end">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-channel-store-action="reset-filters">重置筛选</button>
        </div>
      </div>
    </section>
  `
}

function renderRows(rows: ChannelStore[]): string {
  if (!rows.length) {
    return `
      <tr>
        <td colspan="10" class="px-4 py-12 text-center text-muted-foreground">
          <i data-lucide="store" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
          <p class="mt-2 text-sm">暂无店铺数据</p>
        </td>
      </tr>
    `
  }

  return rows
    .map(
      (store) => `
        <tr class="border-b last:border-b-0 hover:bg-muted/40">
          <td class="px-3 py-3 align-top">${escapeHtml(store.channel)}</td>
          <td class="px-3 py-3 align-top">
            <button class="font-medium text-blue-700 hover:underline" data-pcs-channel-store-action="go-detail" data-store-id="${escapeHtml(store.id)}">${escapeHtml(store.storeName)}</button>
            <p class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(store.storeCode)}</p>
          </td>
          <td class="px-3 py-3 align-top text-xs">${escapeHtml(store.platformStoreId ?? '-')}</td>
          <td class="px-3 py-3 align-top">${escapeHtml(store.country)}</td>
          <td class="px-3 py-3 align-top">${escapeHtml(store.pricingCurrency)}</td>
          <td class="px-3 py-3 align-top"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${STORE_STATUS_META[store.status].color}">${STORE_STATUS_META[store.status].label}</span></td>
          <td class="px-3 py-3 align-top"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${STORE_AUTH_STATUS_META[store.authStatus].color}">${STORE_AUTH_STATUS_META[store.authStatus].label}</span></td>
          <td class="px-3 py-3 align-top text-xs">${store.payoutAccountName ? `${escapeHtml(store.payoutAccountName)}<br/><span class="text-muted-foreground">${escapeHtml(store.payoutIdentifier ?? '')}</span>` : '<span class="text-rose-600">未绑定</span>'}</td>
          <td class="px-3 py-3 align-top">${store.ownerType ? `<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${OWNER_TYPE_META[store.ownerType].color}">${OWNER_TYPE_META[store.ownerType].label}</span>` : '-'}</td>
          <td class="px-3 py-3 align-top text-xs text-muted-foreground">${escapeHtml(store.updatedAt)}</td>
        </tr>
      `,
    )
    .join('')
}

function renderTable(): string {
  const filtered = getFilteredRows()
  const paging = getPaging(filtered)
  state.currentPage = paging.currentPage

  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1220px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">渠道</th>
              <th class="px-3 py-2 font-medium">店铺</th>
              <th class="px-3 py-2 font-medium">平台店铺ID</th>
              <th class="px-3 py-2 font-medium">国家/区域</th>
              <th class="px-3 py-2 font-medium">报价币种</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">授权状态</th>
              <th class="px-3 py-2 font-medium">提现绑定</th>
              <th class="px-3 py-2 font-medium">归属类型</th>
              <th class="px-3 py-2 font-medium">更新时间</th>
            </tr>
          </thead>
          <tbody>${renderRows(paging.rows)}</tbody>
        </table>
      </div>
      ${renderTablePagination({
        total: paging.total,
        from: paging.from,
        to: paging.to,
        currentPage: paging.currentPage,
        totalPages: paging.totalPages,
        pageSize: state.pageSize,
        actionPrefix: 'pcs-channel-store',
        pageSizeOptions: DEFAULT_PAGE_SIZE_OPTIONS,
      })}
    </section>
  `
}

function renderCreateDrawer(): string {
  if (!state.createDrawerOpen) return ''

  const formContent = `
    <div class="grid gap-3 sm:grid-cols-2">
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">渠道</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.newStore.channel)}" data-pcs-channel-store-field="new-channel" />
      </div>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">店铺名称</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.newStore.storeName)}" data-pcs-channel-store-field="new-store-name" />
      </div>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">店铺编码</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.newStore.storeCode)}" data-pcs-channel-store-field="new-store-code" />
      </div>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">平台店铺ID</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.newStore.platformStoreId)}" data-pcs-channel-store-field="new-platform-store-id" />
      </div>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">国家/区域</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.newStore.country)}" data-pcs-channel-store-field="new-country" />
      </div>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">报价币种</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.newStore.pricingCurrency)}" data-pcs-channel-store-field="new-pricing-currency" />
      </div>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">结算币种</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.newStore.settlementCurrency)}" data-pcs-channel-store-field="new-settlement-currency" />
      </div>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">时区</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.newStore.timezone)}" data-pcs-channel-store-field="new-timezone" />
      </div>
    </div>
  `

  return uiFormDrawer(
    {
      title: '新建店铺',
      subtitle: '用于接入渠道店铺基础资料。',
      closeAction: { prefix: 'pcs-channel-store', action: 'close-create' },
      submitAction: { prefix: 'pcs-channel-store', action: 'confirm-create', label: '确认创建' },
      width: 'md',
    },
    formContent
  )
}

function resetCreateForm(): void {
  state.newStore = {
    channel: '',
    storeName: '',
    storeCode: '',
    platformStoreId: '',
    country: '',
    pricingCurrency: '',
    settlementCurrency: '',
    timezone: '',
  }
}

function closeAllDialogs(): void {
  state.createDrawerOpen = false
}

export function renderPcsChannelStoresPage(): string {
  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderStats()}
      ${renderFilters()}
      ${renderTable()}
      ${renderCreateDrawer()}
    </div>
  `
}

export function handlePcsChannelStoresEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-channel-store-field]')

  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.pcsChannelStoreField
    if (field === 'searchKeyword') {
      state.searchKeyword = fieldNode.value
      state.currentPage = 1
      return true
    }
    if (field === 'new-channel') state.newStore.channel = fieldNode.value
    if (field === 'new-store-name') state.newStore.storeName = fieldNode.value
    if (field === 'new-store-code') state.newStore.storeCode = fieldNode.value
    if (field === 'new-platform-store-id') state.newStore.platformStoreId = fieldNode.value
    if (field === 'new-country') state.newStore.country = fieldNode.value
    if (field === 'new-pricing-currency') state.newStore.pricingCurrency = fieldNode.value
    if (field === 'new-settlement-currency') state.newStore.settlementCurrency = fieldNode.value
    if (field === 'new-timezone') state.newStore.timezone = fieldNode.value
    return true
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsChannelStoreField
    if (field === 'filterChannel') state.filterChannel = fieldNode.value
    if (field === 'filterCountry') state.filterCountry = fieldNode.value
    if (field === 'filterStatus') state.filterStatus = fieldNode.value
    if (field === 'filterAuthStatus') state.filterAuthStatus = fieldNode.value
    if (field === 'filterOwnerType') state.filterOwnerType = fieldNode.value
    if (field === 'filterLegalEntity') state.filterLegalEntity = fieldNode.value
    if (field === 'pageSize') state.pageSize = parsePageSize(fieldNode.value)
    state.currentPage = 1
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-channel-store-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsChannelStoreAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'go-payout') {
    appStore.navigate('/pcs/channels/stores/payout-accounts')
    return true
  }

  if (action === 'go-sync') {
    appStore.navigate('/pcs/channels/stores/sync')
    return true
  }

  if (action === 'go-detail') {
    const storeId = actionNode.dataset.storeId
    if (!storeId) return false
    appStore.navigate(`/pcs/channels/stores/${storeId}`)
    return true
  }

  if (action === 'open-create') {
    state.createDrawerOpen = true
    return true
  }

  if (action === 'close-create') {
    state.createDrawerOpen = false
    return true
  }

  if (action === 'confirm-create') {
    if (!state.newStore.channel || !state.newStore.storeName || !state.newStore.storeCode) {
      state.notice = '请至少填写渠道、店铺名称和店铺编码。'
      return true
    }

    const newStore: ChannelStore = {
      id: `ST-${String(stores.length + 1).padStart(3, '0')}`,
      channel: state.newStore.channel,
      storeName: state.newStore.storeName,
      storeCode: state.newStore.storeCode,
      platformStoreId: state.newStore.platformStoreId || null,
      country: state.newStore.country || '-',
      pricingCurrency: state.newStore.pricingCurrency || '-',
      status: 'ACTIVE',
      authStatus: 'CONNECTED',
      payoutAccountId: null,
      payoutAccountName: null,
      payoutIdentifier: null,
      ownerType: null,
      ownerName: null,
      updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    }

    stores = [newStore, ...stores]
    state.currentPage = 1
    state.createDrawerOpen = false
    state.notice = `${newStore.id} 已创建（演示态）。`
    resetCreateForm()
    return true
  }

  if (action === 'reset-filters') {
    state.searchKeyword = ''
    state.filterChannel = 'all'
    state.filterCountry = 'all'
    state.filterStatus = 'all'
    state.filterAuthStatus = 'all'
    state.filterOwnerType = 'all'
    state.filterLegalEntity = 'all'
    state.currentPage = 1
    return true
  }

  if (action === 'prev-page') {
    state.currentPage = getPrevPage(state.currentPage)
    return true
  }

  if (action === 'next-page') {
    state.currentPage = getNextPage(state.currentPage, getFilteredRows().length, state.pageSize)
    return true
  }

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsChannelStoresDialogOpen(): boolean {
  return state.createDrawerOpen
}
