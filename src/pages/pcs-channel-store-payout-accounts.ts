import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { renderConfirmDialog, renderFormDrawer as uiFormDrawer } from '../components/ui'
import {
  OWNER_TYPE_META,
  listChannelStores,
  listPayoutAccounts,
  type ChannelStore,
  type OwnerType,
  type PayoutAccount,
} from '../data/pcs-channels'

interface CreateAccountForm {
  name: string
  payoutChannel: string
  identifierMasked: string
  ownerType: OwnerType
  ownerRefId: string
  ownerName: string
  country: string
  currency: string
}

interface PageState {
  searchKeyword: string
  filterOwnerType: 'all' | OwnerType
  filterCountry: string
  filterStatus: 'all' | 'ACTIVE' | 'INACTIVE'
  currentPage: number
  pageSize: number
  createDrawerOpen: boolean
  createForm: CreateAccountForm
  deactivateDialogOpen: boolean
  deactivateAccountId: string | null
  relatedDialogOpen: boolean
  relatedAccountId: string | null
  notice: string | null
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

let accounts: PayoutAccount[] = listPayoutAccounts()
const stores: ChannelStore[] = listChannelStores()

const state: PageState = {
  searchKeyword: '',
  filterOwnerType: 'all',
  filterCountry: 'all',
  filterStatus: 'all',
  currentPage: 1,
  pageSize: 10,
  createDrawerOpen: false,
  createForm: {
    name: '',
    payoutChannel: '平台内提现',
    identifierMasked: '',
    ownerType: 'LEGAL',
    ownerRefId: '',
    ownerName: '',
    country: '',
    currency: '',
  },
  deactivateDialogOpen: false,
  deactivateAccountId: null,
  relatedDialogOpen: false,
  relatedAccountId: null,
  notice: '已迁移提现账号管理：列表筛选、关联店铺弹窗、新建与停用流程。',
}

function getStatusMeta(status: PayoutAccount['status']): { label: string; color: string } {
  if (status === 'ACTIVE') {
    return { label: '启用', color: 'bg-emerald-100 text-emerald-700' }
  }
  return { label: '停用', color: 'bg-slate-100 text-slate-600' }
}

function getFilteredRows(): PayoutAccount[] {
  const keyword = state.searchKeyword.trim().toLowerCase()

  return accounts.filter((row) => {
    if (
      keyword &&
      !row.id.toLowerCase().includes(keyword) &&
      !row.name.toLowerCase().includes(keyword) &&
      !row.identifierMasked.toLowerCase().includes(keyword) &&
      !row.ownerName.toLowerCase().includes(keyword)
    ) {
      return false
    }

    if (state.filterOwnerType !== 'all' && row.ownerType !== state.filterOwnerType) return false
    if (state.filterCountry !== 'all' && row.country !== state.filterCountry) return false
    if (state.filterStatus !== 'all' && row.status !== state.filterStatus) return false

    return true
  })
}

function getPaging(filteredRows: PayoutAccount[]) {
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
    total: accounts.length,
    active: accounts.filter((row) => row.status === 'ACTIVE').length,
    inactive: accounts.filter((row) => row.status === 'INACTIVE').length,
    legalOwner: accounts.filter((row) => row.ownerType === 'LEGAL').length,
    personalOwner: accounts.filter((row) => row.ownerType === 'PERSONAL').length,
    unboundStores: stores.filter((store) => !store.payoutAccountId).length,
  }
}

function getRelatedStores(accountId: string | null): ChannelStore[] {
  if (!accountId) return []
  return stores.filter((store) => store.payoutAccountId === accountId)
}

function getSelectedAccount(): PayoutAccount | null {
  if (!state.relatedAccountId) return null
  return accounts.find((item) => item.id === state.relatedAccountId) ?? null
}

function renderNotice(): string {
  if (!state.notice) return ''

  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-payout-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">提现账号管理</h1>
        <p class="mt-1 text-sm text-muted-foreground">维护店铺提现账号，管理绑定主体与生效状态。</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-payout-action="go-store-list">
          <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回店铺列表
        </button>
        <button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-pcs-payout-action="open-create">
          <i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>新建提现账号
        </button>
      </div>
    </header>
  `
}

function renderStats(): string {
  const stats = getStats()

  return `
    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">提现账号总数</p><p class="mt-1 text-xl font-semibold">${stats.total}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">启用</p><p class="mt-1 text-xl font-semibold text-emerald-700">${stats.active}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">停用</p><p class="mt-1 text-xl font-semibold text-slate-600">${stats.inactive}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">法人主体</p><p class="mt-1 text-xl font-semibold text-violet-700">${stats.legalOwner}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">个人主体</p><p class="mt-1 text-xl font-semibold text-blue-700">${stats.personalOwner}</p></article>
      <article class="rounded-lg border bg-card p-3"><p class="text-xs text-muted-foreground">未绑定店铺</p><p class="mt-1 text-xl font-semibold text-rose-700">${stats.unboundStores}</p></article>
    </section>
  `
}

function renderFilters(): string {
  const countries = Array.from(new Set(accounts.map((row) => row.country))).sort((a, b) => a.localeCompare(b))

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div class="xl:col-span-2">
          <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
            <input class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" placeholder="账号ID / 账号名称 / 脱敏标识 / 主体名称" value="${escapeHtml(state.searchKeyword)}" data-pcs-payout-field="searchKeyword" />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">归属类型</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-payout-field="filterOwnerType">
            <option value="all" ${state.filterOwnerType === 'all' ? 'selected' : ''}>全部</option>
            <option value="LEGAL" ${state.filterOwnerType === 'LEGAL' ? 'selected' : ''}>法人</option>
            <option value="PERSONAL" ${state.filterOwnerType === 'PERSONAL' ? 'selected' : ''}>个人</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">国家/区域</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-payout-field="filterCountry">
            <option value="all" ${state.filterCountry === 'all' ? 'selected' : ''}>全部</option>
            ${countries.map((country) => `<option value="${escapeHtml(country)}" ${state.filterCountry === country ? 'selected' : ''}>${escapeHtml(country)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">状态</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-payout-field="filterStatus">
            <option value="all" ${state.filterStatus === 'all' ? 'selected' : ''}>全部</option>
            <option value="ACTIVE" ${state.filterStatus === 'ACTIVE' ? 'selected' : ''}>启用</option>
            <option value="INACTIVE" ${state.filterStatus === 'INACTIVE' ? 'selected' : ''}>停用</option>
          </select>
        </div>
        <div class="flex items-end justify-end">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-payout-action="reset-filters">重置筛选</button>
        </div>
      </div>
    </section>
  `
}

function renderRows(pagingRows: PayoutAccount[]): string {
  if (!pagingRows.length) {
    return `
      <tr>
        <td colspan="8" class="px-4 py-12 text-center text-muted-foreground">
          <i data-lucide="wallet-cards" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
          <p class="mt-2 text-sm">暂无提现账号</p>
        </td>
      </tr>
    `
  }

  return pagingRows
    .map((row) => {
      const ownerMeta = OWNER_TYPE_META[row.ownerType]
      const statusMeta = getStatusMeta(row.status)

      return `
        <tr class="border-b last:border-b-0 hover:bg-muted/40">
          <td class="px-3 py-3 align-top text-xs">${escapeHtml(row.id)}</td>
          <td class="px-3 py-3 align-top text-xs">
            <p class="font-medium">${escapeHtml(row.name)}</p>
            <p class="mt-1 text-muted-foreground">${escapeHtml(row.payoutChannel)}</p>
          </td>
          <td class="px-3 py-3 align-top text-xs">${escapeHtml(row.identifierMasked)}</td>
          <td class="px-3 py-3 align-top text-xs">
            <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${ownerMeta.color}">${ownerMeta.label}</span>
            <p class="mt-1">${escapeHtml(row.ownerName)}</p>
          </td>
          <td class="px-3 py-3 align-top text-xs">${escapeHtml(row.country)} / ${escapeHtml(row.currency)}</td>
          <td class="px-3 py-3 align-top text-xs">${row.relatedStoresCount}</td>
          <td class="px-3 py-3 align-top"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${statusMeta.color}">${statusMeta.label}</span></td>
          <td class="px-3 py-3 align-top text-xs">
            <p class="text-muted-foreground">${escapeHtml(row.updatedAt)}</p>
            <div class="mt-2 flex flex-wrap gap-1">
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-payout-action="open-related" data-account-id="${escapeHtml(row.id)}">关联店铺</button>
              ${row.status === 'ACTIVE' ? `<button class="inline-flex h-7 items-center rounded-md border border-rose-300 px-2 text-xs text-rose-700 hover:bg-rose-50" data-pcs-payout-action="open-deactivate" data-account-id="${escapeHtml(row.id)}">停用</button>` : ''}
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
        <table class="w-full min-w-[1160px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">账号ID</th>
              <th class="px-3 py-2 font-medium">账号名称 / 通道</th>
              <th class="px-3 py-2 font-medium">脱敏标识</th>
              <th class="px-3 py-2 font-medium">归属主体</th>
              <th class="px-3 py-2 font-medium">国家 / 币种</th>
              <th class="px-3 py-2 font-medium">关联店铺数</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">更新时间 / 操作</th>
            </tr>
          </thead>
          <tbody>${renderRows(paging.rows)}</tbody>
        </table>
      </div>
      <footer class="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-3">
        <p class="text-xs text-muted-foreground">共 ${paging.total} 条${paging.total ? `，当前 ${paging.from}-${paging.to}` : ''}</p>
        <div class="flex flex-wrap items-center gap-2">
          <select class="h-8 rounded-md border bg-background px-2 text-xs" data-pcs-payout-field="pageSize">
            ${PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${size === state.pageSize ? 'selected' : ''}>${size} 条/页</option>`).join('')}
          </select>
          <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${paging.currentPage <= 1 ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-payout-action="prev-page" ${paging.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
          <span class="text-xs text-muted-foreground">${paging.currentPage} / ${paging.totalPages}</span>
          <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${paging.currentPage >= paging.totalPages ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-payout-action="next-page" ${paging.currentPage >= paging.totalPages ? 'disabled' : ''}>下一页</button>
        </div>
      </footer>
    </section>
  `
}

function renderCreateDrawer(): string {
  if (!state.createDrawerOpen) return ''

  const formContent = `
    <div class="space-y-3">
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">账号名称</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.name)}" data-pcs-payout-field="create-name" />
      </div>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">提现通道</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.payoutChannel)}" data-pcs-payout-field="create-payout-channel" />
      </div>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">脱敏标识</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="如：****1234" value="${escapeHtml(state.createForm.identifierMasked)}" data-pcs-payout-field="create-identifier" />
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">归属类型</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-payout-field="create-owner-type">
            <option value="LEGAL" ${state.createForm.ownerType === 'LEGAL' ? 'selected' : ''}>法人</option>
            <option value="PERSONAL" ${state.createForm.ownerType === 'PERSONAL' ? 'selected' : ''}>个人</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">归属主体ID</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.ownerRefId)}" data-pcs-payout-field="create-owner-ref-id" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">归属主体名称</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.ownerName)}" data-pcs-payout-field="create-owner-name" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">国家/区域</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.country)}" data-pcs-payout-field="create-country" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">币种</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.currency)}" data-pcs-payout-field="create-currency" />
        </div>
      </div>
    </div>
  `

  return uiFormDrawer(
    {
      title: '新建提现账号',
      subtitle: '用于渠道店铺绑定结算主体。',
      closeAction: { prefix: 'pcs-payout', action: 'close-create' },
      submitAction: { prefix: 'pcs-payout', action: 'confirm-create', label: '确认创建' },
      width: 'md',
    },
    formContent
  )
}

function renderDeactivateDialog(): string {
  if (!state.deactivateDialogOpen || !state.deactivateAccountId) return ''

  const selected = accounts.find((item) => item.id === state.deactivateAccountId)
  if (!selected) return ''

  const contentHtml = `
    <div class="space-y-2 text-sm">
      <p>账号：${escapeHtml(selected.name)}</p>
      <p class="text-muted-foreground">停用后该账号不可再用于新绑定（演示态）。</p>
    </div>
  `

  return renderConfirmDialog(
    {
      title: '停用提现账号',
      closeAction: { prefix: 'pcs-payout', action: 'close-deactivate' },
      confirmAction: { prefix: 'pcs-payout', action: 'confirm-deactivate', label: '确认停用' },
      danger: true,
      width: 'sm',
    },
    contentHtml
  )
}

function renderRelatedDialog(): string {
  if (!state.relatedDialogOpen || !state.relatedAccountId) return ''

  const account = getSelectedAccount()
  const relatedStores = getRelatedStores(state.relatedAccountId)

  if (!account) return ''

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-2xl rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">关联店铺</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(account.id)} ｜ ${escapeHtml(account.name)}</p>
        </header>
        <div class="max-h-[420px] overflow-y-auto px-4 py-4">
          ${
            relatedStores.length
              ? `<div class="space-y-2">${relatedStores
                  .map(
                    (store) => `
                      <article class="rounded-md border bg-card px-3 py-2 text-sm">
                        <p class="font-medium">${escapeHtml(store.storeName)} <span class="ml-1 text-xs text-muted-foreground">${escapeHtml(store.storeCode)}</span></p>
                        <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(store.channel)} ｜ ${escapeHtml(store.country)} ｜ 更新时间：${escapeHtml(store.updatedAt)}</p>
                      </article>
                    `,
                  )
                  .join('')}</div>`
              : '<p class="text-sm text-muted-foreground">暂无关联店铺</p>'
          }
        </div>
        <footer class="flex items-center justify-end border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-payout-action="close-related">关闭</button>
        </footer>
      </section>
    </div>
  `
}

function resetCreateForm(): void {
  state.createForm = {
    name: '',
    payoutChannel: '平台内提现',
    identifierMasked: '',
    ownerType: 'LEGAL',
    ownerRefId: '',
    ownerName: '',
    country: '',
    currency: '',
  }
}

function closeAllDialogs(): void {
  state.createDrawerOpen = false
  state.deactivateDialogOpen = false
  state.deactivateAccountId = null
  state.relatedDialogOpen = false
  state.relatedAccountId = null
}

export function renderPcsChannelStorePayoutAccountsPage(): string {
  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderStats()}
      ${renderFilters()}
      ${renderTable()}
      ${renderCreateDrawer()}
      ${renderDeactivateDialog()}
      ${renderRelatedDialog()}
    </div>
  `
}

export function handlePcsChannelStorePayoutAccountsEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-payout-field]')

  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.pcsPayoutField
    if (field === 'searchKeyword') {
      state.searchKeyword = fieldNode.value
      state.currentPage = 1
      return true
    }
    if (field === 'create-name') state.createForm.name = fieldNode.value
    if (field === 'create-payout-channel') state.createForm.payoutChannel = fieldNode.value
    if (field === 'create-identifier') state.createForm.identifierMasked = fieldNode.value
    if (field === 'create-owner-ref-id') state.createForm.ownerRefId = fieldNode.value
    if (field === 'create-owner-name') state.createForm.ownerName = fieldNode.value
    if (field === 'create-country') state.createForm.country = fieldNode.value
    if (field === 'create-currency') state.createForm.currency = fieldNode.value
    return true
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsPayoutField
    if (field === 'filterOwnerType') state.filterOwnerType = fieldNode.value as PageState['filterOwnerType']
    if (field === 'filterCountry') state.filterCountry = fieldNode.value
    if (field === 'filterStatus') state.filterStatus = fieldNode.value as PageState['filterStatus']
    if (field === 'pageSize') state.pageSize = Number(fieldNode.value) || 10
    if (field === 'create-owner-type') state.createForm.ownerType = fieldNode.value as OwnerType
    state.currentPage = 1
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-payout-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsPayoutAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'go-store-list') {
    appStore.navigate('/pcs/channels/stores')
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
    if (!state.createForm.name || !state.createForm.identifierMasked || !state.createForm.ownerName) {
      state.notice = '请至少填写账号名称、脱敏标识、归属主体名称。'
      return true
    }

    const newAccount: PayoutAccount = {
      id: `PA-${String(accounts.length + 1).padStart(3, '0')}`,
      name: state.createForm.name,
      payoutChannel: state.createForm.payoutChannel || '平台内提现',
      identifierMasked: state.createForm.identifierMasked,
      ownerType: state.createForm.ownerType,
      ownerRefId: state.createForm.ownerRefId || '-',
      ownerName: state.createForm.ownerName,
      country: state.createForm.country || '-',
      currency: state.createForm.currency || '-',
      status: 'ACTIVE',
      relatedStoresCount: 0,
      updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    }

    accounts = [newAccount, ...accounts]
    state.currentPage = 1
    state.createDrawerOpen = false
    state.notice = `${newAccount.id} 已创建（演示态）。`
    resetCreateForm()
    return true
  }

  if (action === 'open-deactivate') {
    const accountId = actionNode.dataset.accountId
    if (!accountId) return false
    state.deactivateDialogOpen = true
    state.deactivateAccountId = accountId
    return true
  }

  if (action === 'close-deactivate') {
    state.deactivateDialogOpen = false
    state.deactivateAccountId = null
    return true
  }

  if (action === 'confirm-deactivate') {
    if (!state.deactivateAccountId) return false
    const matched = accounts.find((item) => item.id === state.deactivateAccountId)
    if (!matched) return false
    matched.status = 'INACTIVE'
    matched.updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
    state.notice = `${matched.id} 已停用（演示态）。`
    state.deactivateDialogOpen = false
    state.deactivateAccountId = null
    return true
  }

  if (action === 'open-related') {
    const accountId = actionNode.dataset.accountId
    if (!accountId) return false
    state.relatedDialogOpen = true
    state.relatedAccountId = accountId
    return true
  }

  if (action === 'close-related') {
    state.relatedDialogOpen = false
    state.relatedAccountId = null
    return true
  }

  if (action === 'reset-filters') {
    state.searchKeyword = ''
    state.filterOwnerType = 'all'
    state.filterCountry = 'all'
    state.filterStatus = 'all'
    state.currentPage = 1
    return true
  }

  if (action === 'prev-page') {
    state.currentPage = Math.max(1, state.currentPage - 1)
    state.relatedDialogOpen = false
    state.relatedAccountId = null
    return true
  }

  if (action === 'next-page') {
    const totalPages = Math.max(1, Math.ceil(getFilteredRows().length / state.pageSize))
    state.currentPage = Math.min(totalPages, state.currentPage + 1)
    state.relatedDialogOpen = false
    state.relatedAccountId = null
    return true
  }

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsChannelStorePayoutAccountsDialogOpen(): boolean {
  return state.createDrawerOpen || state.deactivateDialogOpen || state.relatedDialogOpen
}
