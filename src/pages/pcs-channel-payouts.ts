// @page-pattern: list
/** 提现账号既有视图。渠道店铺名称与身份只读取渠道店铺档案。 */
import { appStore } from '../state/store.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'
import { renderStandardListPage, renderStandardListFilters, renderStandardListStats } from '../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../components/ui/list-table-model.ts'
import { listChannelStores, channelLabel } from '../data/pcs-channel-store-repository.ts'
type OwnerType = 'PERSONAL' | 'LEGAL'

type PayoutDetailTabKey = 'overview' | 'stores' | 'attachments'

type PayoutStatus = 'ACTIVE' | 'INACTIVE'

interface LegalEntity {
  id: string
  name: string
  country: string
}

interface StoreLog {
  time: string
  action: string
  operator: string
  detail: string
}

interface PayoutBinding {
  id: string
  payoutAccountId: string
  payoutAccountName: string
  payoutIdentifier: string
  ownerType: OwnerType
  ownerName: string
  effectiveFrom: string
  effectiveTo: string | null
  changeReason: string
  changedBy: string
  changedAt: string
}

interface PayoutAccountRecord {
  id: string
  name: string
  payoutChannel: string
  identifierMasked: string
  ownerType: OwnerType
  ownerRefId: string
  ownerName: string
  country: string
  currency: string
  status: PayoutStatus
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  logs: StoreLog[]
}

interface PayoutCreateDraft {
  name: string
  payoutChannel: string
  identifier: string
  ownerType: OwnerType | ''
  ownerRefId: string
  country: string
  currency: string
}

const OWNER_TYPE_META: Record<OwnerType, { label: string; className: string; icon: string }> = {
  PERSONAL: { label: '个人', className: 'bg-blue-100 text-blue-700', icon: 'user' },
  LEGAL: { label: '法人', className: 'bg-violet-100 text-violet-700', icon: 'building-2' },
}

const PAYOUT_STATUS_META: Record<PayoutStatus, { label: string; className: string }> = {
  ACTIVE: { label: '启用', className: 'bg-green-100 text-green-700' },
  INACTIVE: { label: '停用', className: 'bg-slate-100 text-slate-500' },
}

const LEGAL_ENTITIES: LegalEntity[] = [
  { id: 'LE-001', name: 'HiGOOD LIVE Limited', country: '香港' },
  { id: 'LE-002', name: 'PT HIGOOD LIVE JAKARTA', country: '印尼' },
]

const ACCOUNT_COUNTRY_OPTIONS = [
  { code: 'HK', label: '香港' },
  { code: 'ID', label: '印尼' },
  { code: 'VN', label: '越南' },
  { code: 'MY', label: '马来西亚' },
]

const CURRENCY_OPTIONS = ['USD', 'IDR', 'VND', 'MYR', 'PHP']

const PAYOUT_CHANNEL_OPTIONS = ['平台内提现', '银行转账', 'PSP']

const PAYOUT_DETAIL_TABS: Array<{ key: PayoutDetailTabKey; label: string }> = [
  { key: 'overview', label: '基本信息' },
  { key: 'stores', label: '关联店铺' },
  { key: 'attachments', label: '附件与日志' },
]

const initialPayoutCreateDraft: PayoutCreateDraft = {
  name: '',
  payoutChannel: '',
  identifier: '',
  ownerType: '',
  ownerRefId: '',
  country: '',
  currency: '',
}

const payoutAccountRecords = new Map<string, PayoutAccountRecord>()

function nowText(): string {
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function todayText(): string {
  return nowText().slice(0, 10)
}

function cloneLog(log: StoreLog): StoreLog {
  return { ...log }
}

function cloneAccount(record: PayoutAccountRecord): PayoutAccountRecord {
  return {
    ...record,
    logs: record.logs.map(cloneLog),
  }
}

function getCountryLabel(code: string): string {
  return ACCOUNT_COUNTRY_OPTIONS.find((item) => item.code === code)?.label ?? code
}

function resetPayoutCreateDraft(): void {
  state.payoutCreateDraft = { ...initialPayoutCreateDraft }
}

function listPayoutAccounts(): PayoutAccountRecord[] {
  ensureSeeded()
  return Array.from(payoutAccountRecords.values())
    .map(cloneAccount)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function getPayoutAccountById(accountId: string): PayoutAccountRecord | null {
  ensureSeeded()
  const record = payoutAccountRecords.get(accountId)
  return record ? cloneAccount(record) : null
}

function getRelatedStoresForAccount(accountId: string): Array<{
  storeId: string
  storeName: string
  channel: string
  country: string
  bindingStatus: string
  effectiveFrom: string
  effectiveTo: string | null
}> {
  return listStores()
    .flatMap((store) =>
      store.bindings
        .filter((binding) => binding.payoutAccountId === accountId)
        .map((binding) => ({
          storeId: store.id,
          storeName: store.storeName,
          channel: store.channel,
          country: store.country,
          bindingStatus: binding.effectiveTo ? '历史' : '当前',
          effectiveFrom: binding.effectiveFrom,
          effectiveTo: binding.effectiveTo,
        })),
    )
    .sort((a, b) => (b.effectiveTo ?? '9999-12-31').localeCompare(a.effectiveTo ?? '9999-12-31'))
}

function getRelatedStoreCount(accountId: string): number {
  return getRelatedStoresForAccount(accountId).length
}

function updateAccount(accountId: string, updater: (record: PayoutAccountRecord) => PayoutAccountRecord): void {
  ensureSeeded()
  const current = payoutAccountRecords.get(accountId)
  if (!current) return
  payoutAccountRecords.set(accountId, cloneAccount(updater(cloneAccount(current))))
}

function appendAccountLog(record: PayoutAccountRecord, log: StoreLog): PayoutAccountRecord {
  return {
    ...record,
    updatedAt: log.time,
    updatedBy: log.operator,
    logs: [log, ...record.logs],
  }
}

function syncPayoutDetailState(accountId: string): void {
  const routeKey = appStore.getState().pathname
  if (state.payoutDetail.routeKey === routeKey && state.payoutDetail.accountId === accountId) return
  state.payoutDetail = {
    routeKey,
    accountId,
    activeTab: 'overview',
  }
}

function renderBadge(text: string, className: string): string {
  return `<span class="${escapeHtml(toClassName('inline-flex items-center rounded-full px-2 py-1 text-xs font-medium', className))}">${escapeHtml(text)}</span>`
}

function renderOwnerBadge(ownerType: OwnerType): string {
  const meta = OWNER_TYPE_META[ownerType]
  return `
    <span class="${escapeHtml(toClassName('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium', meta.className))}">
      <i data-lucide="${escapeHtml(meta.icon)}" class="h-3 w-3"></i>${escapeHtml(meta.label)}
    </span>
  `
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
      <div class="flex items-start justify-between gap-3">
        <p>${escapeHtml(state.notice)}</p>
        <button type="button" class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-channel-store-action="close-notice">关闭</button>
      </div>
    </section>
  `
}

function renderPageHeader(title: string, description: string, actions: string): string {
  return `
    <section class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">${escapeHtml(title)}</h1>
        <p class="mt-1 text-sm text-slate-500">${escapeHtml(description)}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">${actions}</div>
    </section>
  `
}

function renderMetricButton(title: string, value: string | number, tone: string, action: string, extraData = ''): string {
  return `
    <button type="button" class="${escapeHtml(toClassName('rounded-lg border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md', tone))}" data-pcs-channel-store-action="${escapeHtml(action)}" ${extraData}>
      <div class="text-sm ${tone.includes('red') ? 'text-red-700' : tone.includes('orange') ? 'text-orange-700' : tone.includes('yellow') ? 'text-yellow-700' : 'text-slate-500'}">${escapeHtml(title)}</div>
      <div class="mt-2 text-2xl font-semibold text-slate-900">${escapeHtml(value)}</div>
    </button>
  `
}

function renderCard(title: string, body: string, actions = ''): string {
  return `
    <section class="rounded-lg border bg-white shadow-sm">
      <div class="flex items-center justify-between gap-3 border-b px-5 py-4">
        <h2 class="text-base font-semibold text-slate-900">${escapeHtml(title)}</h2>
        <div class="flex items-center gap-2">${actions}</div>
      </div>
      <div class="p-5">${body}</div>
    </section>
  `
}

function renderDrawerShell(title: string, description: string, body: string, footer: string): string {
  return `
    <div class="fixed inset-0 z-50">
      <button type="button" class="absolute inset-0 bg-slate-900/35" data-pcs-channel-store-action="close-dialogs"></button>
      <aside class="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l bg-white shadow-2xl">
        <div class="border-b px-6 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-slate-900">${escapeHtml(title)}</h3>
              <p class="mt-1 text-sm text-slate-500">${escapeHtml(description)}</p>
            </div>
            <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="close-dialogs">关闭</button>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">${body}</div>
        <div class="flex items-center justify-end gap-2 border-t px-6 py-4">${footer}</div>
      </aside>
    </div>
  `
}

function renderFormField(label: string, control: string, required = false): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-slate-700">${escapeHtml(label)}${required ? '<span class="text-red-500"> *</span>' : ''}</span>
      ${control}
    </label>
  `
}

function renderTextInput(field: string, value: string, placeholder: string, type = 'text'): string {
  return `<input type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-400" data-pcs-channel-store-field="${escapeHtml(field)}" />`
}

function renderTextArea(field: string, value: string, placeholder: string, rows = 4): string {
  return `<textarea rows="${escapeHtml(rows)}" placeholder="${escapeHtml(placeholder)}" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400" data-pcs-channel-store-field="${escapeHtml(field)}">${escapeHtml(value)}</textarea>`
}

function renderSelect(field: string, value: string, options: Array<{ value: string; label: string }>, placeholder: string): string {
  const placeholderOption = value ? '' : `<option value="">${escapeHtml(placeholder)}</option>`
  return `
    <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400" data-pcs-channel-store-field="${escapeHtml(field)}">
      ${placeholderOption}
      ${options
        .map(
          (option) =>
            `<option value="${escapeHtml(option.value)}"${option.value === value ? ' selected' : ''}>${escapeHtml(option.label)}</option>`,
        )
        .join('')}
    </select>
  `
}

function renderCheckbox(field: string, checked: boolean, label: string): string {
  return `
    <label class="inline-flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-blue-600" data-pcs-channel-store-field="${escapeHtml(field)}"${checked ? ' checked' : ''} />
      <span>${escapeHtml(label)}</span>
    </label>
  `
}

function getFilteredPayoutAccounts(): PayoutAccountRecord[] {
  const keyword = state.payoutList.search.trim().toLowerCase()
  return listPayoutAccounts().filter((account) => {
    const matchesKeyword =
      keyword.length === 0 ||
      [account.name, account.identifierMasked, account.ownerName].join(' ').toLowerCase().includes(keyword)
    if (!matchesKeyword) return false
    if (state.payoutList.ownerType !== 'all' && account.ownerType !== state.payoutList.ownerType) return false
    if (state.payoutList.legalEntity !== 'all' && account.ownerRefId !== state.payoutList.legalEntity) return false
    if (state.payoutList.country !== 'all' && account.country !== state.payoutList.country) return false
    if (state.payoutList.status !== 'all' && account.status !== state.payoutList.status) return false
    return true
  })
}

function getPayoutStats() {
  const accounts = listPayoutAccounts()
  return {
    total: accounts.length,
    active: accounts.filter((account) => account.status === 'ACTIVE').length,
    legal: accounts.filter((account) => account.ownerType === 'LEGAL').length,
    personal: accounts.filter((account) => account.ownerType === 'PERSONAL').length,
  }
}

function createPayoutAccount(): void {
  const draft = state.payoutCreateDraft
  if (!draft.name || !draft.payoutChannel || !draft.ownerType || !draft.ownerRefId || !draft.country || !draft.currency) {
    state.notice = '请补齐账号名称、提现渠道、归属类型、归属主体、国家/区域和币种。'
    return
  }
  const timestamp = nowText()
  const id = `PA-${String(payoutAccountRecords.size + 1).padStart(3, '0')}`
  const ownerName =
    draft.ownerType === 'LEGAL'
      ? LEGAL_ENTITIES.find((entity) => entity.id === draft.ownerRefId)?.name ?? draft.ownerRefId
      : draft.ownerRefId.trim()
  const record: PayoutAccountRecord = {
    id,
    name: draft.name.trim(),
    payoutChannel: draft.payoutChannel,
    identifierMasked: draft.identifier.trim() || '****待补录',
    ownerType: draft.ownerType,
    ownerRefId: draft.ownerRefId.trim(),
    ownerName,
    country: draft.country,
    currency: draft.currency,
    status: 'ACTIVE',
    createdAt: timestamp,
    createdBy: '当前用户',
    updatedAt: timestamp,
    updatedBy: '当前用户',
    logs: [
      { time: timestamp, action: '创建账号', operator: '当前用户', detail: `新建提现账号 ${draft.name.trim()}。` },
    ],
  }
  payoutAccountRecords.set(id, cloneAccount(record))
  state.notice = `提现账号 ${record.name} 已创建。`
  resetPayoutCreateDraft()
  closeAllDialogs()
}

function renderPayoutCreateDrawer(): string {
  if (!state.payoutCreateDrawerOpen) return ''
  const draft = state.payoutCreateDraft
  const body = `
    <div class="space-y-6">
      ${renderFormField('账号名称', renderTextInput('payout-create-name', draft.name, '如：HiGOOD LIVE Limited - TikTok Payout'), true)}
      ${renderFormField(
        '提现渠道',
        renderSelect('payout-create-channel', draft.payoutChannel, PAYOUT_CHANNEL_OPTIONS.map((item) => ({ value: item, label: item })), '选择提现渠道'),
        true,
      )}
      ${renderFormField('账号标识（脱敏展示）', renderTextInput('payout-create-identifier', draft.identifier, '如：卡号尾号 / 钱包 ID'))}
      ${renderFormField(
        '归属类型',
        renderSelect(
          'payout-create-owner-type',
          draft.ownerType,
          [
            { value: 'LEGAL', label: '法人 (公司)' },
            { value: 'PERSONAL', label: '个人' },
          ],
          '选择归属类型',
        ),
        true,
      )}
      ${
        draft.ownerType === 'LEGAL'
          ? renderFormField(
              '法人主体',
              renderSelect('payout-create-owner-ref-id', draft.ownerRefId, LEGAL_ENTITIES.map((item) => ({ value: item.id, label: `${item.name} (${item.country})` })), '选择法人主体'),
              true,
            )
          : renderFormField('个人姓名', renderTextInput('payout-create-owner-ref-id', draft.ownerRefId, '输入个人姓名'), true)
      }
      <div class="grid gap-4 md:grid-cols-2">
        ${renderFormField(
          '国家/区域',
          renderSelect('payout-create-country', draft.country, ACCOUNT_COUNTRY_OPTIONS.map((item) => ({ value: item.code, label: item.label })), '选择国家/区域'),
          true,
        )}
        ${renderFormField(
          '币种',
          renderSelect('payout-create-currency', draft.currency, CURRENCY_OPTIONS.map((item) => ({ value: item, label: item })), '选择币种'),
          true,
        )}
      </div>
    </div>
  `
  const footer = `
    <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="close-dialogs">取消</button>
    <button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-channel-store-action="submit-payout-create">创建账号</button>
  `
  return renderDrawerShell('新建提现账号', '管理提现账号主数据，决定店铺收入归属主体。', body, footer)
}

function renderPayoutAccountListContent(): string {
  resetStandardListEntryTransientStateOnRouteEntry(payoutListState,typeof document!=='undefined'&&!!document.querySelector('[data-pcs-payout-list]'))
  payoutController.ensurePreferencesLoaded();payoutController.installColumnDragEvents()
  const stats=getPayoutStats(),accounts=getFilteredPayoutAccounts(),view=payoutController.getView(accounts)
  const filters=`${renderFormField('关键词',renderTextInput('payout-list-search',state.payoutList.search,'账号名称 / 尾号 / PSP 标识'))}${renderFormField('归属类型',renderSelect('payout-list-owner-type',state.payoutList.ownerType==='all'?'':state.payoutList.ownerType,[{value:'LEGAL',label:'法人'},{value:'PERSONAL',label:'个人'}],'全部类型'))}${state.payoutList.ownerType==='LEGAL'?renderFormField('法人主体',renderSelect('payout-list-legal-entity',state.payoutList.legalEntity==='all'?'':state.payoutList.legalEntity,LEGAL_ENTITIES.map(item=>({value:item.id,label:item.name})),'全部法人')):''}${renderFormField('国家 / 区域',renderSelect('payout-list-country',state.payoutList.country==='all'?'':state.payoutList.country,ACCOUNT_COUNTRY_OPTIONS.map(item=>({value:item.code,label:item.label})),'全部区域'))}${renderFormField('状态',renderSelect('payout-list-status',state.payoutList.status==='all'?'':state.payoutList.status,[{value:'ACTIVE',label:'启用'},{value:'INACTIVE',label:'停用'}],'全部状态'))}`
  const action=(label:string,value:string,attributes='')=>`<button type="button" class="h-9 rounded-md border bg-white px-3 text-sm" data-pcs-channel-store-action="${value}" ${attributes}>${label}</button>`
  return `<div data-pcs-payout-page data-pcs-payout-list>${renderStandardListPage({
    title:'提现账号管理',feedbackHtml:renderNotice(),
    primaryActionsHtml:`<div class="flex gap-2"><button class="h-9 rounded-md border bg-white px-3 text-sm" data-nav="/pcs/channels/stores">返回店铺列表</button>${action('新建提现账号','open-payout-create')}</div>`,
    filtersHtml:renderStandardListFilters({fieldsHtml:filters,actionPrefix:'pcs-channel-store',queryAction:'payout-query',resetAction:'reset-payout-list'}),
    statsHtml:renderStandardListStats([{label:'全部账号',value:stats.total},{label:'启用中',value:stats.active},{label:'法人账号',value:stats.legal},{label:'个人账号',value:stats.personal}],{compact:true}),
    listTitle:`提现账号（${accounts.length}）`,listActionsHtml:`<div class="flex flex-wrap gap-2">${action('启用中','payout-quick-filter','data-filter="status" data-value="ACTIVE"')}${action('法人账号','payout-quick-filter','data-filter="owner" data-value="LEGAL"')}${action('个人账号','payout-quick-filter','data-filter="owner" data-value="PERSONAL"')}${action('列设置','open-column-settings')}</div>`,
    tableHtml:`<div data-payout-table>${view.tableHtml}</div>`,paginationHtml:`<div data-payout-pagination>${view.paginationHtml}</div>`,overlaysHtml:`<div data-payout-overlays>${payoutController.renderColumnSettings()}</div>${renderPayoutCreateDrawer()}`,
  })}</div>`
}

function renderPayoutAccountDetailContent(account: PayoutAccountRecord): string {
  const relatedStores = getRelatedStoresForAccount(account.id)
  const tabs = PAYOUT_DETAIL_TABS.map(
    (tab) => `
      <button type="button" class="${escapeHtml(toClassName('inline-flex h-9 items-center rounded-md px-3 text-sm', state.payoutDetail.activeTab === tab.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'))}" data-pcs-channel-store-action="set-payout-detail-tab" data-value="${escapeHtml(tab.key)}">${escapeHtml(tab.label)}</button>
    `,
  ).join('')
  const overview = `
    <div class="grid gap-4 xl:grid-cols-2">
      ${renderCard(
        '账号信息',
        `
          <div class="grid gap-4 text-sm md:grid-cols-2">
            <div><div class="text-slate-500">账号名称</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(account.name)}</div></div>
            <div><div class="text-slate-500">账号标识（脱敏）</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(account.identifierMasked)}</div></div>
            <div><div class="text-slate-500">提现渠道</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(account.payoutChannel)}</div></div>
            <div><div class="text-slate-500">国家/区域</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(getCountryLabel(account.country))}</div></div>
            <div><div class="text-slate-500">币种</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(account.currency)}</div></div>
            <div><div class="text-slate-500">状态</div><div class="mt-1">${renderBadge(PAYOUT_STATUS_META[account.status].label, PAYOUT_STATUS_META[account.status].className)}</div></div>
          </div>
        `,
      )}
      ${renderCard(
        '归属信息',
        `
          <div class="grid gap-4 text-sm md:grid-cols-2">
            <div><div class="text-slate-500">归属类型</div><div class="mt-1">${renderOwnerBadge(account.ownerType)}</div></div>
            <div><div class="text-slate-500">归属主体</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(account.ownerName)}</div></div>
            <div><div class="text-slate-500">创建时间</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(formatDateTime(account.createdAt))}</div></div>
            <div><div class="text-slate-500">创建人</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(account.createdBy)}</div></div>
          </div>
        `,
      )}
    </div>
  `
  const stores = renderCard(
    '关联店铺（当前/历史绑定）',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3 font-medium">店铺名称</th>
              <th class="px-4 py-3 font-medium">渠道</th>
              <th class="px-4 py-3 font-medium">国家</th>
              <th class="px-4 py-3 font-medium">绑定状态</th>
              <th class="px-4 py-3 font-medium">生效区间</th>
              <th class="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              relatedStores
                .map(
                  (store) => `
                    <tr class="border-t border-slate-100 align-top">
                      <td class="px-4 py-3 font-medium text-slate-900">${escapeHtml(store.storeName)}</td>
                      <td class="px-4 py-3">${renderBadge(store.channel, 'border border-slate-200 bg-white text-slate-700')}</td>
                      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(store.country)}</td>
                      <td class="px-4 py-3">${renderBadge(store.bindingStatus, store.bindingStatus === '当前' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500')}</td>
                      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(store.effectiveFrom)} ~ ${escapeHtml(store.effectiveTo || '当前')}</td>
                      <td class="px-4 py-3"><button type="button" class="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/channels/stores/${escapeHtml(store.storeId)}"><i data-lucide="external-link" class="h-3.5 w-3.5"></i>查看店铺</button></td>
                    </tr>
                  `,
                )
                .join('') || '<tr><td colspan="6" class="px-4 py-10 text-center text-sm text-slate-500">暂无关联店铺。</td></tr>'
            }
          </tbody>
        </table>
      </div>
    `,
  )
  const attachments = `
    ${renderCard(
      '附件',
      `
        <div class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          <i data-lucide="file-text" class="mx-auto mb-3 h-10 w-10 text-slate-300"></i>
          <p>暂无附件</p>
          <p class="mt-1">可上传开户证明、收款证明、平台截图等。</p>
        </div>
      `,
    )}
    ${renderCard(
      '操作日志',
      `
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-slate-500">
              <tr>
                <th class="px-4 py-3 font-medium">时间</th>
                <th class="px-4 py-3 font-medium">操作</th>
                <th class="px-4 py-3 font-medium">操作人</th>
                <th class="px-4 py-3 font-medium">详情</th>
              </tr>
            </thead>
            <tbody>
              ${account.logs
                .map(
                  (log) => `
                    <tr class="border-t border-slate-100 align-top">
                      <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(formatDateTime(log.time))}</td>
                      <td class="px-4 py-3">${renderBadge(log.action, 'border border-slate-200 bg-white text-slate-700')}</td>
                      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(log.operator)}</td>
                      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(log.detail)}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `,
    )}
  `
  const content =
    state.payoutDetail.activeTab === 'overview'
      ? overview
      : state.payoutDetail.activeTab === 'stores'
        ? stores
        : attachments
  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      <section class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-start gap-4">
          <button type="button" class="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/channels/stores/payout-accounts">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>返回列表
          </button>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <i data-lucide="wallet" class="h-5 w-5 text-slate-400"></i>
              <h1 class="text-2xl font-semibold text-slate-900">${escapeHtml(account.name)}</h1>
              ${renderOwnerBadge(account.ownerType)}
              ${renderBadge(PAYOUT_STATUS_META[account.status].label, PAYOUT_STATUS_META[account.status].className)}
            </div>
            <p class="mt-1 text-sm text-slate-500">${escapeHtml(account.identifierMasked)} | ${escapeHtml(getCountryLabel(account.country))} | ${escapeHtml(account.currency)}</p>
          </div>
        </div>
        <div>
          <button type="button" class="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="payout-edit-placeholder" data-account-id="${escapeHtml(account.id)}"><i data-lucide="edit" class="h-4 w-4"></i>编辑账号</button>
        </div>
      </section>
      <section class="rounded-lg border bg-white p-2 shadow-sm">
        <div class="flex flex-wrap gap-2">${tabs}</div>
      </section>
      ${content}
    </div>
  `
}

export function renderPcsPayoutAccountListPage(): string {
  ensureSeeded()
  return renderPayoutAccountListContent()
}

export function renderPcsPayoutAccountDetailPage(accountId: string): string {
  ensureSeeded()
  syncPayoutDetailState(accountId)
  const account = getPayoutAccountById(accountId)
  if (!account) {
    return `
      <div class="space-y-5 p-4">
        <section class="rounded-lg border bg-white p-4">
          <h1 class="text-xl font-semibold text-slate-900">提现账号不存在</h1>
          <p class="mt-1 text-sm text-slate-500">未找到对应的提现账号记录，请返回列表重新选择。</p>
        </section>
      </div>
    `
  }
  return `<div data-pcs-payout-page>${renderPayoutAccountDetailContent(account)}</div>`
}
const state={notice:null as string|null,payoutList:{search:'',ownerType:'all',legalEntity:'all',country:'all',status:'all'},payoutCreateDrawerOpen:false,payoutCreateDraft:{...initialPayoutCreateDraft},payoutDetail:{routeKey:'',accountId:null as string|null,activeTab:'overview' as PayoutDetailTabKey}}
const payoutListState:ProcessOrderListControllerState={currentPage:1,sort:null,preferences:{order:[],visibleKeys:[],frozenKeys:[],pageSize:20},preferencesLoaded:false,showColumnSettings:false}
const payoutColumns:StandardListColumn<PayoutAccountRecord>[]=[
  {key:'account',title:'提现账号',width:230,required:true,freezeable:true,sortable:true,sortValue:r=>r.name,render:r=>`<button class="text-left font-medium text-blue-600" data-nav="/pcs/channels/stores/payout-accounts/${escapeHtml(r.id)}">${escapeHtml(r.name)}</button><div class="mt-1 text-xs text-slate-500">${escapeHtml(r.identifierMasked)}</div>`},
  {key:'type',title:'归属类型',width:100,render:r=>renderOwnerBadge(r.ownerType)},
  {key:'owner',title:'归属主体',width:200,sortable:true,sortValue:r=>r.ownerName,render:r=>escapeHtml(r.ownerName)},
  {key:'country',title:'国家 / 币种',width:120,render:r=>`${escapeHtml(getCountryLabel(r.country))}<div class="mt-1 text-xs text-slate-500">${escapeHtml(r.currency)}</div>`},
  {key:'status',title:'状态',width:90,render:r=>renderBadge(PAYOUT_STATUS_META[r.status].label,PAYOUT_STATUS_META[r.status].className)},
  {key:'stores',title:'关联店铺',width:110,render:r=>`${getRelatedStoreCount(r.id)} 个店铺`},
  {key:'updated',title:'最近更新',width:155,sortable:true,sortValue:r=>r.updatedAt,render:r=>escapeHtml(formatDateTime(r.updatedAt))},
  {key:'actions',title:'操作',width:130,required:true,actionColumn:true,render:r=>`<div class="flex gap-3"><button class="text-blue-600" data-nav="/pcs/channels/stores/payout-accounts/${escapeHtml(r.id)}">详情</button><button class="text-blue-600" data-pcs-channel-store-action="payout-edit-placeholder" data-account-id="${escapeHtml(r.id)}">编辑</button></div>`},
]
const payoutController=createProcessOrderListController({state:payoutListState,columns:payoutColumns,preferenceKey:'higood:list-page:pcs-payout-accounts',pageSizeOptions:[20,50,100],eventPrefix:'pcs-channel-store',rootSelector:'[data-pcs-payout-list]',tableSurfaceSelector:'[data-payout-table]',paginationSurfaceSelector:'[data-payout-pagination]',overlaysSurfaceSelector:'[data-payout-overlays]',defaultFrozenKeys:['account'],columnSettingsTitle:'提现账号列表列设置',emptyText:'暂无符合条件的提现账号。',getRows:getFilteredPayoutAccounts,maxFrozenWidth:480,locallyManagedEvents:true})
function refreshPayoutPage():void {
  if(typeof document==='undefined')return
  const root=document.querySelector('[data-pcs-payout-page]');if(!root)return
  const id=appStore.getState().pathname.split('/payout-accounts/')[1]
  root.outerHTML=id?renderPcsPayoutAccountDetailPage(id):renderPcsPayoutAccountListPage()
}
const PAYOUT_BINDINGS:Record<string,PayoutBinding[]>={'ST-001': [
        {
          id: 'BND-002',
          payoutAccountId: 'PA-002',
          payoutAccountName: 'PT HIGOOD LIVE - IDN Payout',
          payoutIdentifier: '****1234',
          ownerType: 'LEGAL',
          ownerName: 'PT HIGOOD LIVE JAKARTA',
          effectiveFrom: '2025-10-01',
          effectiveTo: null,
          changeReason: '店铺正式上线，绑定公司提现账号',
          changedBy: '李运营',
          changedAt: '2025-10-01 09:00',
        },
        {
          id: 'BND-001',
          payoutAccountId: 'PA-003',
          payoutAccountName: '张三-个人卡',
          payoutIdentifier: '****5678',
          ownerType: 'PERSONAL',
          ownerName: '张三',
          effectiveFrom: '2025-08-15',
          effectiveTo: '2025-09-30',
          changeReason: '测试阶段临时绑定个人账号',
          changedBy: '系统管理员',
          changedAt: '2025-08-15 10:00',
        },
      ],
'ST-002': [
        {
          id: 'BND-003',
          payoutAccountId: 'PA-004',
          payoutAccountName: '李四-个人卡',
          payoutIdentifier: '****9012',
          ownerType: 'PERSONAL',
          ownerName: '李四',
          effectiveFrom: '2025-11-10',
          effectiveTo: null,
          changeReason: '越南账号按个人主体结算',
          changedBy: '王运营',
          changedAt: '2025-11-10 09:00',
        },
      ],
'ST-003': [
        {
          id: 'BND-004',
          payoutAccountId: 'PA-001',
          payoutAccountName: 'HiGOOD LIVE Limited - TikTok Payout',
          payoutIdentifier: '****6789',
          ownerType: 'LEGAL',
          ownerName: 'HiGOOD LIVE Limited',
          effectiveFrom: '2025-09-26',
          effectiveTo: null,
          changeReason: '马来店铺由香港主体统一收款',
          changedBy: '系统管理员',
          changedAt: '2025-09-26 09:30',
        },
      ],
'ST-004': [],
'ST-005': [
        {
          id: 'BND-005',
          payoutAccountId: 'PA-003',
          payoutAccountName: '张三-个人卡',
          payoutIdentifier: '****5678',
          ownerType: 'PERSONAL',
          ownerName: '张三',
          effectiveFrom: '2025-08-28',
          effectiveTo: null,
          changeReason: '独立站初期沿用个人账号收款',
          changedBy: '系统管理员',
          changedAt: '2025-08-28 09:20',
        },
      ]}
function listStores(){return listChannelStores(true).map(s=>({id:s.id,storeName:s.storeName,channel:channelLabel(s.channelCode),country:s.marketCode,bindings:PAYOUT_BINDINGS[s.id]||[]}))}
function ensureSeeded(){if(payoutAccountRecords.size)return;const accounts:PayoutAccountRecord[]=[
    {
      id: 'PA-001',
      name: 'HiGOOD LIVE Limited - TikTok Payout',
      payoutChannel: '平台内提现',
      identifierMasked: '****6789',
      ownerType: 'LEGAL',
      ownerRefId: 'LE-001',
      ownerName: 'HiGOOD LIVE Limited',
      country: 'HK',
      currency: 'USD',
      status: 'ACTIVE',
      createdAt: '2025-08-01 09:00',
      createdBy: '系统管理员',
      updatedAt: '2026-01-10 10:00',
      updatedBy: '陈主管',
      logs: [
        { time: '2026-01-10 10:00', action: '更新账号', operator: '陈主管', detail: '同步平台提现主体信息。' },
        { time: '2025-08-01 09:00', action: '创建账号', operator: '系统管理员', detail: '新建平台提现账号。' },
      ],
    },
    {
      id: 'PA-002',
      name: 'PT HIGOOD LIVE - IDN Payout',
      payoutChannel: '平台内提现',
      identifierMasked: '****1234',
      ownerType: 'LEGAL',
      ownerRefId: 'LE-002',
      ownerName: 'PT HIGOOD LIVE JAKARTA',
      country: 'ID',
      currency: 'IDR',
      status: 'ACTIVE',
      createdAt: '2025-08-01 10:00',
      createdBy: '系统管理员',
      updatedAt: '2026-01-08 14:30',
      updatedBy: '李运营',
      logs: [
        { time: '2026-01-08 14:30', action: '更新信息', operator: '李运营', detail: '更新账号名称。' },
        { time: '2025-10-01 09:00', action: '绑定店铺', operator: '李运营', detail: '绑定至 TikTok 印尼主店。' },
        { time: '2025-08-01 10:00', action: '创建账号', operator: '系统管理员', detail: '新建提现账号。' },
      ],
    },
    {
      id: 'PA-003',
      name: '张三-个人卡',
      payoutChannel: '银行转账',
      identifierMasked: '****5678',
      ownerType: 'PERSONAL',
      ownerRefId: 'P-001',
      ownerName: '张三',
      country: 'ID',
      currency: 'IDR',
      status: 'ACTIVE',
      createdAt: '2025-07-15 11:00',
      createdBy: '系统管理员',
      updatedAt: '2026-01-05 09:00',
      updatedBy: '李运营',
      logs: [
        { time: '2026-01-05 09:00', action: '更新账号', operator: '李运营', detail: '更新归属主体展示。' },
        { time: '2025-08-15 10:00', action: '绑定店铺', operator: '系统管理员', detail: '测试阶段绑定 TikTok 印尼主店。' },
      ],
    },
    {
      id: 'PA-004',
      name: '李四-个人卡',
      payoutChannel: '银行转账',
      identifierMasked: '****9012',
      ownerType: 'PERSONAL',
      ownerRefId: 'P-002',
      ownerName: '李四',
      country: 'VN',
      currency: 'VND',
      status: 'ACTIVE',
      createdAt: '2025-09-05 13:00',
      createdBy: '系统管理员',
      updatedAt: '2026-01-03 16:00',
      updatedBy: '陈主管',
      logs: [
        { time: '2026-01-03 16:00', action: '更新账号', operator: '陈主管', detail: '补录越南店铺绑定资料。' },
        { time: '2025-09-05 13:00', action: '创建账号', operator: '系统管理员', detail: '新建个人收款账号。' },
      ],
    },
    {
      id: 'PA-005',
      name: '旧账号-已停用',
      payoutChannel: 'PSP',
      identifierMasked: '****0000',
      ownerType: 'LEGAL',
      ownerRefId: 'LE-001',
      ownerName: 'HiGOOD LIVE Limited',
      country: 'HK',
      currency: 'USD',
      status: 'INACTIVE',
      createdAt: '2025-05-20 10:00',
      createdBy: '系统管理员',
      updatedAt: '2025-12-01 10:00',
      updatedBy: '系统管理员',
      logs: [
        { time: '2025-12-01 10:00', action: '停用账号', operator: '系统管理员', detail: '旧账号停用并转移店铺绑定。' },
      ],
    },
  ];accounts.forEach(r=>payoutAccountRecords.set(r.id,cloneAccount(r)))}
function closeAllDialogs(){state.payoutCreateDrawerOpen=false}

function handlePayoutAccountInput(target:Element):boolean {const fieldNode=target.closest<HTMLElement>('[data-pcs-channel-store-field]');const field=fieldNode?.dataset.pcsChannelStoreField;if(!fieldNode||!field)return false;
  if(field==='page-size'){payoutController.setPageSize(Number((fieldNode as HTMLSelectElement).value));return true}
  if(field==='goto-page'){payoutListState.currentPage=Number((fieldNode as HTMLInputElement).value)||1;return true}
  if (field === 'payout-list-search' && fieldNode instanceof HTMLInputElement) {
    state.payoutList.search = fieldNode.value
    return true
  }
  if (field === 'payout-list-owner-type' && fieldNode instanceof HTMLSelectElement) {
    state.payoutList.ownerType = fieldNode.value || 'all'
    state.payoutList.legalEntity = 'all'
    return true
  }
  if (field === 'payout-list-legal-entity' && fieldNode instanceof HTMLSelectElement) {
    state.payoutList.legalEntity = fieldNode.value || 'all'
    return true
  }
  if (field === 'payout-list-country' && fieldNode instanceof HTMLSelectElement) {
    state.payoutList.country = fieldNode.value || 'all'
    return true
  }
  if (field === 'payout-list-status' && fieldNode instanceof HTMLSelectElement) {
    state.payoutList.status = fieldNode.value || 'all'
    return true
  }

  const payoutCreateFields: Record<string, keyof PayoutCreateDraft> = {
    'payout-create-name': 'name',
    'payout-create-channel': 'payoutChannel',
    'payout-create-identifier': 'identifier',
    'payout-create-owner-type': 'ownerType',
    'payout-create-owner-ref-id': 'ownerRefId',
    'payout-create-country': 'country',
    'payout-create-currency': 'currency',
  }
  if (field in payoutCreateFields && (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement)) {
    const draftField = payoutCreateFields[field]
    state.payoutCreateDraft = {
      ...state.payoutCreateDraft,
      [draftField]: draftField === 'ownerType'
        ? (fieldNode.value === 'PERSONAL' || fieldNode.value === 'LEGAL' ? fieldNode.value : '')
        : fieldNode.value,
    }
    if (field === 'payout-create-owner-type') {
      state.payoutCreateDraft.ownerRefId = ''
    }
    return true
  }

  return false
}

function handlePayoutAccountEvent(target:HTMLElement):boolean {const actionNode=target.closest<HTMLElement>('[data-pcs-channel-store-action]');const action=actionNode?.dataset.pcsChannelStoreAction;if(!actionNode||!action)return false;if(action==='close-notice'){state.notice=null;return true}
  if(action==='payout-query'){payoutListState.currentPage=1;return true}
  if(action==='open-column-settings'||action==='close-column-settings'){payoutListState.showColumnSettings=action==='open-column-settings';return true}
  if(action==='restore-column-preferences'){payoutController.restorePreferences();return true}
  if(action==='sort-column'){payoutController.cycleSort(actionNode.dataset.columnKey||'');return true}
  if(action==='prev-page'||action==='next-page'){payoutController.stepPage(action==='prev-page'?-1:1);return true}
  if(action==='toggle-column-visibility'||action==='toggle-column-freeze'){payoutController.updateColumnPreference(action,actionNode.dataset.columnKey||'',(actionNode as HTMLInputElement).checked);return true}
  if (action === 'open-payout-create') {
    state.payoutCreateDrawerOpen = true
    return true
  }
  if (action === 'submit-payout-create') {
    createPayoutAccount()
    return true
  }
  if (action === 'reset-payout-list') {
    payoutListState.currentPage=1
    state.payoutList = {
      search: '',
      ownerType: 'all',
      legalEntity: 'all',
      country: 'all',
      status: 'all',
    }
    return true
  }
  if (action === 'payout-quick-filter') {
    payoutListState.currentPage=1
    const filter = actionNode.dataset.filter
    const value = actionNode.dataset.value ?? ''
    if (filter === 'status') state.payoutList.status = value
    if (filter === 'owner') state.payoutList.ownerType = value
    return true
  }
  if (action === 'payout-edit-placeholder') {
    const accountId = actionNode.dataset.accountId
    state.notice = accountId ? `提现账号 ${accountId} 的编辑入口已预留。` : '编辑入口已预留。'
    return true
  }
  if (action === 'set-payout-detail-tab') {
    state.payoutDetail.activeTab = (actionNode.dataset.value as PayoutDetailTabKey) || 'overview'
    return true
  }

  if (action === 'close-dialogs') {
    closeAllDialogs();payoutListState.showColumnSettings=false
    return true
  }

  return false
}
export function handlePcsPayoutAccountInput(target:Element):boolean {
  const handled=handlePayoutAccountInput(target)
  if(handled&&(target instanceof HTMLSelectElement||target.closest('[data-pcs-channel-store-field="goto-page"]')))refreshPayoutPage()
  return handled
}
export function handlePcsPayoutAccountEvent(target:HTMLElement):boolean {const handled=handlePayoutAccountEvent(target);if(handled)refreshPayoutPage();return handled}
export function isPcsPayoutAccountDialogOpen(){return state.payoutCreateDrawerOpen||payoutListState.showColumnSettings}
