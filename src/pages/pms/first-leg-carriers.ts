// @page-pattern: list
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  createPmsFirstLegCarrier,
  createPmsFirstLegChannel,
  listPmsFirstLegCarriers,
  listPmsFirstLegChannels,
  togglePmsFirstLegCarrierStatus,
  togglePmsFirstLegChannelStatus,
  updatePmsFirstLegCarrier,
  updatePmsFirstLegChannel,
  type PmsContainerPrice,
  type PmsFirstLegBillingMethod,
  type PmsFirstLegCarrier,
  type PmsFirstLegChannel,
  type PmsFirstLegCurrency,
  type PmsFirstLegTransportMethod,
} from '../../data/pms/first-leg-logistics.ts'
import { nextPmsActionId, PMS_BUYER_ACTOR, PmsDomainError } from '../../data/pms/runtime.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import {
  formatPmsTime,
  handlePmsCommonImageEvent,
  hydratePmsSurface,
  readNumberField,
  readTextField,
  renderPmsFeedback,
  renderPmsImagePreview,
  renderPmsOverlayError,
  renderPmsStatusBadge,
} from './shared.ts'

type CarrierOverlay =
  | null
  | { kind: 'carrier-form'; carrierCode: string }
  | { kind: 'channels'; carrierCode: string }
  | { kind: 'channel-form'; carrierCode: string; channelCode: string }
  | { kind: 'toggle-carrier'; carrierCode: string }
  | { kind: 'toggle-channel'; channelCode: string }

interface CarrierPageState extends ProcessOrderListControllerState {
  keyword: string
  statusFilter: '' | '启用' | '停用'
  overlay: CarrierOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-flc'
const ROOT_SELECTOR = '[data-pms-flc-root]'

const TRANSPORT_METHODS: PmsFirstLegTransportMethod[] = ['海卡', '海派', '空卡', '空派', '铁路', '快递', '卡航']
const BILLING_METHODS: PmsFirstLegBillingMethod[] = ['计费重', '实重', '体积', '整柜']
const CURRENCIES: PmsFirstLegCurrency[] = ['RMB', 'USD', 'IDR']
const CONTAINER_TYPES: PmsContainerPrice['containerType'][] = ['20GP', '40GP', '40HQ', '45HQ']

function pmsFlagText(value: boolean | undefined): string {
  return value === undefined ? '—' : value ? '是' : '否'
}

function parsePmsDestinations(value: string): string[] {
  return value.split(/[、,，;；/]/).map((item) => item.trim()).filter(Boolean)
}

function readOptionalNumberField(scope: ParentNode, selector: string): number | undefined {
  const field = scope.querySelector<HTMLInputElement>(selector)
  if (!field || field.value.trim() === '') return undefined
  return Number(field.value)
}

function channelFieldElement(surface: ParentNode, name: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null {
  const nodes = [...surface.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-${EVENT_PREFIX}-channel-field="${name}"]`)]
  return nodes.find((node) => !node.closest('[data-pms-flc-billing-section][hidden]')) ?? nodes[0] ?? null
}

function readChannelText(surface: ParentNode, name: string): string {
  return channelFieldElement(surface, name)?.value.trim() ?? ''
}

function readChannelOptionalNumber(surface: ParentNode, name: string): number | undefined {
  const field = channelFieldElement(surface, name)
  if (!field || field.value.trim() === '') return undefined
  return Number(field.value)
}

function readChannelBoolean(surface: ParentNode, name: string): boolean | undefined {
  const field = channelFieldElement(surface, name)
  if (!field) return undefined
  if (field.value === 'true') return true
  if (field.value === 'false') return false
  return undefined
}

function syncChannelBillingSections(select: HTMLSelectElement): void {
  const root = select.closest<HTMLElement>('[data-pms-flc-channel-form-root]')
  if (!root) return
  const sections = [...root.querySelectorAll<HTMLElement>('[data-pms-flc-billing-section]')]
  const visibleValues = new Map<string, string>()
  sections.filter((section) => !section.hidden).forEach((section) => {
    section.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-channel-field]`).forEach((input) => {
      visibleValues.set(input.dataset.pmsFlcChannelField || '', input.value)
    })
  })
  sections.forEach((section) => {
    section.hidden = section.dataset.pmsFlcBillingSection !== select.value
  })
  sections.filter((section) => !section.hidden).forEach((section) => {
    section.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-channel-field]`).forEach((input) => {
      const carried = visibleValues.get(input.dataset.pmsFlcChannelField || '')
      if (carried !== undefined && carried !== '' && input.value === '') input.value = carried
    })
  })
}

const state: CarrierPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  statusFilter: '',
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function carrierChannels(carrierCode: string): PmsFirstLegChannel[] {
  return listPmsFirstLegChannels().filter((channel) => channel.carrierId === carrierCode)
}

function filteredRows(): PmsFirstLegCarrier[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsFirstLegCarriers().filter((carrier) => {
    if (state.statusFilter && carrier.status !== state.statusFilter) return false
    if (!keyword) return true
    return [carrier.carrierCode, carrier.carrierName, carrier.shortName, carrier.contactName, carrier.city].some((value) => value.toLowerCase().includes(keyword))
  })
}

const columns: StandardListColumn<PmsFirstLegCarrier>[] = [
  {
    key: 'carrier',
    title: '物流商 / 编码',
    width: 260,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.carrierName,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.carrierName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.carrierCode)} · ${escapeHtml(row.shortName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.countryOrRegion)} · ${escapeHtml(row.city)} · ${escapeHtml(row.level)}</div>`,
  },
  {
    key: 'contact',
    title: '联系人',
    width: 200,
    render: (row) => `<div class="text-sm">${escapeHtml(row.contactName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.contactPhone)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.email || '—')} · ${escapeHtml(row.wechat || '—')}</div>`,
  },
  {
    key: 'settlement',
    title: '结算 / 付款',
    width: 180,
    render: (row) => `<div class="text-sm">${escapeHtml(row.settlementCurrency)} · ${escapeHtml(row.paymentMethod)}</div><div class="mt-1 text-xs text-slate-500">账期 ${row.accountPeriodDays === undefined ? '—' : `${row.accountPeriodDays} 天`} · 更新 ${formatPmsTime(row.updatedAt)}</div>`,
  },
  {
    key: 'channels',
    title: '渠道',
    width: 200,
    sortable: true,
    sortValue: (row) => carrierChannels(row.carrierCode).length,
    render: (row) => {
      const channels = carrierChannels(row.carrierCode)
      const enabled = channels.filter((channel) => channel.status === '启用').length
      return `<div class="text-sm">共 ${channels.length} 条</div><div class="mt-1 text-xs text-slate-500">启用 ${enabled} · ${channels.map((channel) => channel.transportMethod).slice(0, 3).join(' / ') || '—'}</div>`
    },
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    sortable: true,
    sortValue: (row) => row.status,
    render: (row) => renderPmsStatusBadge(row.status, row.status === '启用' ? 'green' : 'slate'),
  },
  {
    key: 'actions',
    title: '操作',
    width: 220,
    actionColumn: true,
    render: (row) => `<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5"><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-channels" data-carrier-code="${escapeHtml(row.carrierCode)}" data-skip-page-rerender="true">渠道管理</button><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-carrier-edit" data-carrier-code="${escapeHtml(row.carrierCode)}" data-skip-page-rerender="true">编辑</button><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="toggle-carrier" data-carrier-code="${escapeHtml(row.carrierCode)}" data-skip-page-rerender="true">${row.status === '启用' ? '停用' : '启用'}</button></div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/first-leg-carriers',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-flc-table-surface]',
  paginationSurfaceSelector: '[data-pms-flc-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-flc-overlays]',
  defaultFrozenKeys: ['carrier'],
  columnSettingsTitle: '头程物流商列设置',
  emptyText: '当前条件下暂无头程物流商',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  const statusOptions = ['', '启用', '停用'].map((value) => `<option value="${value}" ${state.statusFilter === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const advancedCount = state.statusFilter ? 1 : 0
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="物流商 / 编码 / 联系人 / 城市" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="statusFilter" data-skip-page-rerender="true">${statusOptions}</select></label>
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  const channels = listPmsFirstLegChannels()
  return renderProcessOrderStats([
    { label: '物流商总数', value: rows.length },
    { label: '启用物流商', value: rows.filter((row) => row.status === '启用').length },
    { label: '渠道总数', value: channels.length },
    { label: '启用渠道', value: channels.filter((channel) => channel.status === '启用').length },
  ])
}

function renderCarrierFormOverlay(carrierCode: string): string {
  const carrier = listPmsFirstLegCarriers().find((item) => item.carrierCode === carrierCode)
  const textField = (name: string, label: string, value: string | undefined, wide = false) => `<label class="${wide ? 'col-span-2 ' : ''}flex flex-col gap-1 text-xs text-muted-foreground">${label}<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(value ?? '')}" data-${EVENT_PREFIX}-carrier-field="${name}" data-skip-page-rerender="true" /></label>`
  const numberField = (name: string, label: string, value: number | undefined, fallback = '') => `<label class="flex flex-col gap-1 text-xs text-muted-foreground">${label}<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="1" value="${value === undefined ? fallback : value}" data-${EVENT_PREFIX}-carrier-field="${name}" data-skip-page-rerender="true" /></label>`
  const selectField = (name: string, label: string, options: string[], value: string | undefined) => `<label class="flex flex-col gap-1 text-xs text-muted-foreground">${label}<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-carrier-field="${name}" data-skip-page-rerender="true">${options.map((item) => `<option value="${escapeHtml(item)}" ${item === value ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></label>`
  const booleanField = (name: string, label: string, value: boolean | undefined, fallback: boolean) => {
    const current = value ?? fallback
    return `<label class="flex flex-col gap-1 text-xs text-muted-foreground">${label}<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-carrier-field="${name}" data-skip-page-rerender="true"><option value="true" ${current ? 'selected' : ''}>是</option><option value="false" ${current ? '' : 'selected'}>否</option></select></label>`
  }
  const selectedMethods = carrier?.supportedTransportMethods ?? []
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="物流商表单" data-pms-flc-carrier-form-root><section class="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-background p-5 shadow-2xl"><header class="mb-4 flex items-center justify-between"><h2 class="font-semibold">${carrier ? `编辑 ${escapeHtml(carrier.carrierCode)}` : '新增头程物流商'}</h2>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header>${renderPmsOverlayError(state.overlayError)}
    <div class="space-y-3">
      <section class="rounded-lg border p-3"><h3 class="text-sm font-semibold">一、基础信息</h3><div class="mt-3 grid grid-cols-2 gap-3">${textField('carrierName', '物流商名称', carrier?.carrierName, true)}${textField('shortName', '简称', carrier?.shortName)}${selectField('countryOrRegion', '国家 / 地区', ['中国', '印尼', '美国', '其他'], carrier?.countryOrRegion ?? '中国')}${textField('city', '城市', carrier?.city)}${selectField('level', '等级', ['A级', 'B级', 'C级'], carrier?.level ?? 'B级')}</div></section>
      <section class="rounded-lg border p-3"><h3 class="text-sm font-semibold">二、联系人信息</h3><div class="mt-3 grid grid-cols-2 gap-3">${textField('contactName', '联系人', carrier?.contactName)}${textField('contactPhone', '联系电话', carrier?.contactPhone)}${textField('email', '邮箱', carrier?.email)}${textField('wechat', '微信', carrier?.wechat)}${textField('address', '联系地址', carrier?.address, true)}</div></section>
      <section class="rounded-lg border p-3"><h3 class="text-sm font-semibold">三、结算信息</h3><div class="mt-3 grid grid-cols-2 gap-3">${selectField('settlementCurrency', '结算币种', CURRENCIES, carrier?.settlementCurrency ?? 'RMB')}${selectField('paymentMethod', '付款方式', ['月结', '票结', '预付', '到付'], carrier?.paymentMethod ?? '月结')}${numberField('accountPeriodDays', '账期天数', carrier?.accountPeriodDays)}${textField('invoiceInfo', '开票信息', carrier?.invoiceInfo)}${textField('bankAccount', '银行账户', carrier?.bankAccount)}${textField('payeeName', '收款人', carrier?.payeeName)}</div></section>
      <section class="rounded-lg border p-3"><h3 class="text-sm font-semibold">四、服务信息</h3><div class="mt-3 grid grid-cols-2 gap-3">
        <label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">支持运输方式<div class="flex flex-wrap gap-3 rounded-md border bg-background px-3 py-2">${TRANSPORT_METHODS.map((item) => `<label class="flex items-center gap-1 text-sm"><input type="checkbox" data-${EVENT_PREFIX}-carrier-method="${item}" ${selectedMethods.includes(item) ? 'checked' : ''} data-skip-page-rerender="true" />${item}</label>`).join('')}</div></label>
        ${textField('supportedDestinations', '支持目的地（顿号或逗号分隔）', carrier?.supportedDestinations?.join('、'), true)}
        ${booleanField('supportTaxDeclaration', '是否支持报税', carrier?.supportTaxDeclaration, true)}
        ${booleanField('supportCustomsClearance', '是否支持清关', carrier?.supportCustomsClearance, true)}
        ${booleanField('supportDelivery', '是否支持派送', carrier?.supportDelivery, true)}
      </div></section>
      <section class="rounded-lg border p-3"><h3 class="text-sm font-semibold">五、备注说明</h3><div class="mt-3 grid grid-cols-2 gap-3">${textField('remark', '备注', carrier?.remark, true)}</div></section>
    </div>
    <footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton(`${carrier ? '保存修改' : '创建物流商'}`, { prefix: EVENT_PREFIX, action: 'submit-carrier' }, 'check-check')}</footer></section></div>`
}

function renderCarrierInfoPanel(carrier: PmsFirstLegCarrier): string {
  const infoItem = (label: string, value: string) => `<div class="min-w-0"><dt class="text-slate-400">${label}</dt><dd class="mt-0.5 truncate text-slate-700" title="${escapeHtml(value)}">${escapeHtml(value)}</dd></div>`
  return `<section class="rounded-lg border bg-muted/30 p-3"><h3 class="text-sm font-semibold">物流商信息</h3><dl class="mt-2 grid grid-cols-3 gap-x-4 gap-y-2 text-xs">
    ${infoItem('邮箱', carrier.email || '—')}
    ${infoItem('微信', carrier.wechat || '—')}
    ${infoItem('账期天数', carrier.accountPeriodDays === undefined ? '—' : `${carrier.accountPeriodDays} 天`)}
    ${infoItem('联系地址', carrier.address || '—')}
    ${infoItem('开票信息', carrier.invoiceInfo || '—')}
    ${infoItem('银行账户', carrier.bankAccount || '—')}
    ${infoItem('收款人', carrier.payeeName || '—')}
    ${infoItem('支持运输方式', carrier.supportedTransportMethods?.join(' / ') || '—')}
    ${infoItem('支持目的地', carrier.supportedDestinations?.join('、') || '—')}
    ${infoItem('支持报税', pmsFlagText(carrier.supportTaxDeclaration))}
    ${infoItem('支持清关', pmsFlagText(carrier.supportCustomsClearance))}
    ${infoItem('支持派送', pmsFlagText(carrier.supportDelivery))}
  </dl></section>`
}

function renderChannelsOverlay(carrierCode: string): string {
  const carrier = listPmsFirstLegCarriers().find((item) => item.carrierCode === carrierCode)
  if (!carrier) return ''
  const channels = carrierChannels(carrierCode)
  const rowsHtml = channels.length
    ? channels.map((channel) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm"><div class="font-medium">${escapeHtml(channel.channelName)}</div><div class="text-xs text-slate-500">${escapeHtml(channel.channelCode)} · ${escapeHtml(channel.originPlace)} → ${escapeHtml(channel.destinationWarehouse)}</div></td><td class="px-3 py-2 text-sm">${escapeHtml(channel.transportMethod)} · ${channel.estimatedTransitDays}天</td><td class="px-3 py-2 text-sm">${escapeHtml(channel.billingMethod)}${channel.billingMethod === '整柜' ? `<div class="text-xs text-slate-500">${channel.containerPrices.map((price) => `${price.containerType} ¥${price.price}`).join(' / ')}</div>` : `<div class="text-xs text-slate-500">${channel.unitPrice} ${channel.currency}</div>`}</td><td class="px-3 py-2 text-sm">${escapeHtml(channel.taxMethod)}<div class="text-xs text-slate-500">含税 ${pmsFlagText(channel.includeTax)} · 清关 ${pmsFlagText(channel.includeCustomsClearance)} · 派送 ${pmsFlagText(channel.includeDelivery)}</div></td><td class="px-3 py-2 text-sm">${channel.minTransitDays ?? '—'} - ${channel.maxTransitDays ?? '—'} 天<div class="text-xs text-slate-500">截单 ${escapeHtml(channel.cutoffTime || '—')} · ${escapeHtml(channel.departureFrequency || '—')}</div></td><td class="px-3 py-2 text-sm">${escapeHtml(channel.destinationCountry || '—')} · ${escapeHtml(channel.applicableArea || '—')}<div class="text-xs text-slate-500">${escapeHtml(channel.transferCenter || '—')}</div><div class="text-xs text-slate-500">带电 ${pmsFlagText(channel.supportBattery)} · 液体 ${pmsFlagText(channel.supportLiquid)} · 敏感 ${pmsFlagText(channel.supportSensitiveGoods)} · 普货 ${pmsFlagText(channel.supportNormalGoods)}</div><div class="text-xs text-slate-500">最大单箱 ${channel.maxBoxWeight ?? '—'} kg / ${channel.maxBoxVolume ?? '—'} m³</div></td><td class="px-3 py-2">${renderPmsStatusBadge(channel.status, channel.status === '启用' ? 'green' : 'slate')}</td><td class="px-3 py-2"><div class="flex items-center justify-end gap-1.5"><button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-${EVENT_PREFIX}-action="open-channel-edit" data-carrier-code="${escapeHtml(carrierCode)}" data-channel-code="${escapeHtml(channel.channelCode)}" data-skip-page-rerender="true">编辑</button><button type="button" class="rounded-md border px-2 py-1 text-xs ${channel.status === '启用' ? 'text-red-700' : 'text-emerald-700'} hover:bg-muted" data-${EVENT_PREFIX}-action="toggle-channel" data-channel-code="${escapeHtml(channel.channelCode)}" data-skip-page-rerender="true">${channel.status === '启用' ? '停用' : '启用'}</button></div></td></tr>`).join('')
    : '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="8">该物流商还没有渠道</td></tr>'
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="渠道管理" data-pms-flc-channels-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭渠道管理"></button><section class="relative z-10 flex h-full w-[1120px] max-w-[96vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(carrier.shortName)} · 渠道管理</h2><p class="mt-1 text-xs text-slate-500">停用渠道不影响历史头程单；整柜计费需要完整配置四个箱型</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="flex-1 space-y-4 overflow-y-auto p-4">${renderPmsOverlayError(state.overlayError)}
    ${renderCarrierInfoPanel(carrier)}
    ${renderPrimaryButton('新增渠道', { prefix: EVENT_PREFIX, action: 'open-channel-create' }, 'plus').replace('<button', `<button data-carrier-code="${escapeHtml(carrierCode)}"`)}
    <div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left" style="min-width: 1280px"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">渠道</th><th class="px-3 py-2">运输 / 时效</th><th class="px-3 py-2">计费</th><th class="px-3 py-2">税 / 含项</th><th class="px-3 py-2">时效区间 / 截单</th><th class="px-3 py-2">路线 / 限制</th><th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
  </div></section></div>`
}

function renderChannelFormOverlay(carrierCode: string, channelCode: string): string {
  const channel = listPmsFirstLegChannels().find((item) => item.channelCode === channelCode)
  const containerRows = CONTAINER_TYPES.map((type) => {
    const config = channel?.containerPrices.find((price) => price.containerType === type)
    return `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm">${type}</td><td class="px-3 py-2"><input class="h-8 w-24 rounded-md border px-2 text-sm" type="number" min="1" step="1" value="${config?.weightLimit ?? ''}" data-${EVENT_PREFIX}-container-weight="${type}" data-skip-page-rerender="true" /></td><td class="px-3 py-2"><input class="h-8 w-24 rounded-md border px-2 text-sm" type="number" min="0.1" step="0.1" value="${config?.volumeLimit ?? ''}" data-${EVENT_PREFIX}-container-volume="${type}" data-skip-page-rerender="true" /></td><td class="px-3 py-2"><input class="h-8 w-28 rounded-md border px-2 text-sm" type="number" min="0" step="1" value="${config?.price ?? ''}" data-${EVENT_PREFIX}-container-price="${type}" data-skip-page-rerender="true" /></td></tr>`
  }).join('')
  const billingMethod = channel?.billingMethod ?? '计费重'
  const billingHidden = (method: PmsFirstLegBillingMethod) => (billingMethod === method ? '' : ' hidden')
  const textValue = (value: string | undefined) => value ?? ''
  const numberField = (name: string, label: string, value: number | undefined, attrs = 'min="0" step="0.01"') => `<label class="flex flex-col gap-1 text-xs text-muted-foreground">${label}<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" ${attrs} value="${value === undefined ? '' : value}" data-${EVENT_PREFIX}-channel-field="${name}" data-skip-page-rerender="true" /></label>`
  const textField = (name: string, label: string, value: string, type = 'text') => `<label class="flex flex-col gap-1 text-xs text-muted-foreground">${label}<input class="h-9 rounded-md border bg-background px-2 text-sm" type="${type}" value="${escapeHtml(value)}" data-${EVENT_PREFIX}-channel-field="${name}" data-skip-page-rerender="true" /></label>`
  const selectField = (name: string, label: string, options: string[], value: string) => `<label class="flex flex-col gap-1 text-xs text-muted-foreground">${label}<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-channel-field="${name}" data-skip-page-rerender="true">${options.map((item) => `<option value="${escapeHtml(item)}" ${item === value ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></label>`
  const booleanField = (name: string, label: string, value: boolean | undefined, fallback: boolean) => {
    const current = value ?? fallback
    return `<label class="flex flex-col gap-1 text-xs text-muted-foreground">${label}<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-channel-field="${name}" data-skip-page-rerender="true"><option value="true" ${current ? 'selected' : ''}>是</option><option value="false" ${current ? '' : 'selected'}>否</option></select></label>`
  }
  return `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="渠道表单" data-pms-flc-channel-form-root><section class="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-background p-5 shadow-2xl"><header class="mb-4 flex items-center justify-between"><h2 class="font-semibold">${channel ? `编辑渠道 ${escapeHtml(channel.channelCode)}` : '新增渠道'}</h2>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-channel-form' }, 'x')}</header>${renderPmsOverlayError(state.overlayError)}
    <div class="space-y-3">
      <section class="rounded-lg border p-3"><h3 class="text-sm font-semibold">一、渠道基础信息</h3><div class="mt-3 grid grid-cols-2 gap-3"><label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">渠道名称<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(channel?.channelName ?? '')}" data-${EVENT_PREFIX}-channel-field="channelName" data-skip-page-rerender="true" /></label>${selectField('transportMethod', '运输方式', TRANSPORT_METHODS, channel?.transportMethod ?? '空派')}${selectField('billingMethod', '计费方式', BILLING_METHODS, billingMethod)}</div></section>
      <section class="rounded-lg border p-3"><h3 class="text-sm font-semibold">二、时效信息</h3><div class="mt-3 grid grid-cols-2 gap-3">${numberField('estimatedTransitDays', '预计运输天数', channel?.estimatedTransitDays ?? 10, 'min="1" step="1"')}${numberField('minTransitDays', '最短运输天数', channel?.minTransitDays, 'min="0" step="1"')}${numberField('maxTransitDays', '最长运输天数', channel?.maxTransitDays, 'min="0" step="1"')}${textField('cutoffTime', '截单时间', channel ? textValue(channel.cutoffTime) : '18:00', 'time')}${textField('departureFrequency', '发车 / 起飞频率', channel ? textValue(channel.departureFrequency) : '每周一三五')}</div></section>
      <section class="rounded-lg border p-3"><h3 class="text-sm font-semibold">三、计费信息（按计费方式显示）</h3><div class="mt-3 space-y-3">
        <div class="grid grid-cols-2 gap-3" data-pms-flc-billing-section="计费重"${billingHidden('计费重')}>${numberField('chargeWeightFactor', '计费重系数', channel?.chargeWeightFactor)}${numberField('volumeDivisor', '体积重除数', channel?.volumeDivisor, 'min="0" step="1"')}${numberField('minChargeWeight', '最低计费重量 KG', channel?.minChargeWeight)}</div>
        <div class="grid grid-cols-2 gap-3" data-pms-flc-billing-section="实重"${billingHidden('实重')}>${numberField('minChargeWeight', '最低计费重量 KG', channel?.minChargeWeight)}${numberField('firstWeightPrice', '首重价格', channel?.firstWeightPrice)}${numberField('additionalWeightPrice', '续重价格', channel?.additionalWeightPrice)}</div>
        <div class="grid grid-cols-2 gap-3" data-pms-flc-billing-section="体积"${billingHidden('体积')}>${numberField('volumeDivisor', '体积重除数', channel?.volumeDivisor, 'min="0" step="1"')}</div>
        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1 text-xs text-muted-foreground">单价 / 币种
            <span class="flex gap-2"><input class="h-9 w-full rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.1" value="${channel?.unitPrice ?? 0}" data-${EVENT_PREFIX}-channel-field="unitPrice" data-skip-page-rerender="true" /><select class="h-9 w-24 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-channel-field="currency" data-skip-page-rerender="true">${CURRENCIES.map((value) => `<option value="${value}" ${channel?.currency === value ? 'selected' : ''}>${value}</option>`).join('')}</select></span>
          </label>
        </div>
        <div data-pms-flc-billing-section="整柜"${billingHidden('整柜')}><h4 class="text-xs font-semibold text-muted-foreground">整柜价格配置（计费方式为“整柜”时必填）</h4><div class="mt-2 overflow-x-auto"><table class="w-full table-fixed text-left"><thead class="text-xs text-muted-foreground"><tr><th class="px-3 py-2">箱型</th><th class="px-3 py-2">限重(kg)</th><th class="px-3 py-2">限体积(m³)</th><th class="px-3 py-2">价格</th></tr></thead><tbody>${containerRows}</tbody></table></div></div>
      </div></section>
      <section class="rounded-lg border p-3"><h3 class="text-sm font-semibold">四、税务与清关信息</h3><div class="mt-3 grid grid-cols-2 gap-3">${selectField('taxMethod', '交税方式', ['报税', '不报税'], channel?.taxMethod ?? '报税')}${booleanField('includeTax', '是否含税', channel?.includeTax, true)}${booleanField('includeCustomsClearance', '是否包清关', channel?.includeCustomsClearance, true)}${booleanField('includeDelivery', '是否包派送', channel?.includeDelivery, true)}<label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">报税说明<textarea class="min-h-16 rounded-md border bg-background px-2 py-1.5 text-sm" data-${EVENT_PREFIX}-channel-field="taxRemark" data-skip-page-rerender="true">${escapeHtml(textValue(channel?.taxRemark))}</textarea></label></div></section>
      <section class="rounded-lg border p-3"><h3 class="text-sm font-semibold">五、路线信息</h3><div class="mt-3 grid grid-cols-2 gap-3">${textField('originPlace', '起运地', textValue(channel?.originPlace))}${textField('destinationCountry', '目的国家', channel ? textValue(channel.destinationCountry) : '印尼')}${textField('destinationWarehouse', '目的仓', channel ? textValue(channel.destinationWarehouse) : '印尼雅加达面辅料仓')}${textField('applicableArea', '适用区域', channel ? textValue(channel.applicableArea) : '雅加达')}${textField('transferCenter', '转运中心', channel ? textValue(channel.transferCenter) : '广州转运中心')}</div></section>
      <section class="rounded-lg border p-3"><h3 class="text-sm font-semibold">六、限制与备注</h3><div class="mt-3 grid grid-cols-2 gap-3">${booleanField('supportBattery', '是否支持带电', channel?.supportBattery, false)}${booleanField('supportLiquid', '是否支持液体', channel?.supportLiquid, false)}${booleanField('supportSensitiveGoods', '是否支持敏感货', channel?.supportSensitiveGoods, false)}${booleanField('supportNormalGoods', '是否支持普货', channel?.supportNormalGoods, true)}${numberField('maxBoxWeight', '最大单箱重量 KG', channel?.maxBoxWeight)}${numberField('maxBoxVolume', '最大单箱体积 m³', channel?.maxBoxVolume)}<label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">渠道备注<textarea class="min-h-20 rounded-md border bg-background px-2 py-1.5 text-sm" data-${EVENT_PREFIX}-channel-field="remark" data-skip-page-rerender="true">${escapeHtml(textValue(channel?.remark))}</textarea></label></div></section>
    </div>
    <footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-channel-form' }, 'x')}${renderPrimaryButton(`${channel ? '保存修改' : '创建渠道'}`, { prefix: EVENT_PREFIX, action: 'submit-channel' }, 'check-check')}</footer></section></div>`
}

function renderToggleOverlay(kind: 'carrier' | 'channel', code: string): string {
  const target = kind === 'carrier' ? listPmsFirstLegCarriers().find((item) => item.carrierCode === code) : listPmsFirstLegChannels().find((item) => item.channelCode === code)
  const name = kind === 'carrier' ? (target as PmsFirstLegCarrier | undefined)?.carrierName : (target as PmsFirstLegChannel | undefined)?.channelName
  const nextStatus = target?.status === '启用' ? '停用' : '启用'
  return `<div class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="启停确认" data-pms-flc-toggle-root><section class="w-full max-w-md rounded-xl bg-background p-5 shadow-2xl"><h2 class="font-semibold">${nextStatus}${kind === 'carrier' ? '物流商' : '渠道'}</h2><p class="mt-2 text-sm text-slate-600">确认将 <strong>${escapeHtml(name ?? code)}</strong> ${nextStatus}？停用不影响历史头程单，但不能再用于新建头程。</p><footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton(`确认${nextStatus}`, { prefix: EVENT_PREFIX, action: 'confirm-toggle' }, 'check-check')}</footer></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-flc-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return `${columnSettings}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'carrier-form') return `${columnSettings}${renderCarrierFormOverlay(state.overlay.carrierCode)}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'channels') return `${columnSettings}${renderChannelsOverlay(state.overlay.carrierCode)}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'channel-form') return `${columnSettings}${renderChannelsOverlay(state.overlay.carrierCode)}${renderChannelFormOverlay(state.overlay.carrierCode, state.overlay.channelCode)}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'toggle-carrier') return `${columnSettings}${renderToggleOverlay('carrier', state.overlay.carrierCode)}${renderPmsImagePreview()}`
  return `${columnSettings}${renderToggleOverlay('channel', state.overlay.channelCode)}${renderPmsImagePreview()}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: false,
    title: '头程物流商管理',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2"><span class="text-xs text-muted-foreground">物流商与渠道支持启停；整柜渠道按 20GP/40GP/40HQ/45HQ 配置价格</span>${renderPrimaryButton('新增物流商', { prefix: EVENT_PREFIX, action: 'open-carrier-create' }, 'plus')}${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-flc-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-flc-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-flc-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-flc-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function exportRows(): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前查询条件下没有可导出的物流商。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    '头程物流商.csv',
    ['物流商编码', '名称', '简称', '国家/地区', '城市', '等级', '联系人', '电话', '结算币种', '付款方式', '状态', '渠道编码', '渠道名称', '运输方式', '时效(天)', '计费方式', '单价', '币种', '税', '状态'],
    rows.flatMap((carrier) => {
      const channels = carrierChannels(carrier.carrierCode)
      return channels.length > 0
        ? channels.map((channel) => [carrier.carrierCode, carrier.carrierName, carrier.shortName, carrier.countryOrRegion, carrier.city, carrier.level, carrier.contactName, carrier.contactPhone, carrier.settlementCurrency, carrier.paymentMethod, carrier.status, channel.channelCode, channel.channelName, channel.transportMethod, channel.estimatedTransitDays, channel.billingMethod, channel.unitPrice, channel.currency, channel.taxMethod, channel.status])
        : [[carrier.carrierCode, carrier.carrierName, carrier.shortName, carrier.countryOrRegion, carrier.city, carrier.level, carrier.contactName, carrier.contactPhone, carrier.settlementCurrency, carrier.paymentMethod, carrier.status, '', '', '', '', '', '', '', '', '']]
    }),
  )
  state.feedback = `已导出 ${rows.length} 家物流商及其渠道（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

function readCarrierForm(surface: HTMLElement) {
  return {
    carrierName: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="carrierName"]`),
    shortName: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="shortName"]`),
    countryOrRegion: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="countryOrRegion"]`) as '中国' | '印尼' | '美国' | '其他',
    city: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="city"]`),
    level: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="level"]`) as 'A级' | 'B级' | 'C级',
    contactName: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="contactName"]`),
    contactPhone: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="contactPhone"]`),
    email: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="email"]`),
    wechat: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="wechat"]`),
    address: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="address"]`),
    settlementCurrency: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="settlementCurrency"]`) as PmsFirstLegCurrency,
    paymentMethod: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="paymentMethod"]`) as '月结' | '票结' | '预付' | '到付',
    accountPeriodDays: readOptionalNumberField(surface, `[data-${EVENT_PREFIX}-carrier-field="accountPeriodDays"]`),
    invoiceInfo: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="invoiceInfo"]`),
    bankAccount: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="bankAccount"]`),
    payeeName: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="payeeName"]`),
    supportedTransportMethods: [...surface.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-carrier-method]`)]
      .filter((input) => input.checked)
      .map((input) => input.dataset.pmsFlcCarrierMethod as PmsFirstLegTransportMethod),
    supportedDestinations: parsePmsDestinations(readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="supportedDestinations"]`)),
    supportTaxDeclaration: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="supportTaxDeclaration"]`) === 'true',
    supportCustomsClearance: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="supportCustomsClearance"]`) === 'true',
    supportDelivery: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="supportDelivery"]`) === 'true',
    remark: readTextField(surface, `[data-${EVENT_PREFIX}-carrier-field="remark"]`),
  }
}

function readChannelForm(surface: HTMLElement) {
  const billingMethod = readTextField(surface, `[data-${EVENT_PREFIX}-channel-field="billingMethod"]`) as PmsFirstLegBillingMethod
  const containerPrices: PmsContainerPrice[] = CONTAINER_TYPES.map((type) => ({
    containerType: type,
    weightLimit: readNumberField(surface, `[data-${EVENT_PREFIX}-container-weight="${type}"]`),
    volumeLimit: readNumberField(surface, `[data-${EVENT_PREFIX}-container-volume="${type}"]`),
    price: readNumberField(surface, `[data-${EVENT_PREFIX}-container-price="${type}"]`),
    currency: readTextField(surface, `[data-${EVENT_PREFIX}-channel-field="currency"]`) as PmsFirstLegCurrency,
  }))
  return {
    channelName: readTextField(surface, `[data-${EVENT_PREFIX}-channel-field="channelName"]`),
    transportMethod: readTextField(surface, `[data-${EVENT_PREFIX}-channel-field="transportMethod"]`) as PmsFirstLegTransportMethod,
    estimatedTransitDays: readNumberField(surface, `[data-${EVENT_PREFIX}-channel-field="estimatedTransitDays"]`),
    billingMethod,
    unitPrice: readNumberField(surface, `[data-${EVENT_PREFIX}-channel-field="unitPrice"]`),
    currency: readTextField(surface, `[data-${EVENT_PREFIX}-channel-field="currency"]`) as PmsFirstLegCurrency,
    taxMethod: readTextField(surface, `[data-${EVENT_PREFIX}-channel-field="taxMethod"]`) as '报税' | '不报税',
    containerPrices: billingMethod === '整柜' ? containerPrices : [],
    originPlace: readTextField(surface, `[data-${EVENT_PREFIX}-channel-field="originPlace"]`),
    destinationWarehouse: readTextField(surface, `[data-${EVENT_PREFIX}-channel-field="destinationWarehouse"]`),
    remark: readChannelText(surface, 'remark'),
    minTransitDays: readChannelOptionalNumber(surface, 'minTransitDays'),
    maxTransitDays: readChannelOptionalNumber(surface, 'maxTransitDays'),
    cutoffTime: readChannelText(surface, 'cutoffTime'),
    departureFrequency: readChannelText(surface, 'departureFrequency'),
    chargeWeightFactor: readChannelOptionalNumber(surface, 'chargeWeightFactor'),
    volumeDivisor: readChannelOptionalNumber(surface, 'volumeDivisor'),
    minChargeWeight: readChannelOptionalNumber(surface, 'minChargeWeight'),
    firstWeightPrice: readChannelOptionalNumber(surface, 'firstWeightPrice'),
    additionalWeightPrice: readChannelOptionalNumber(surface, 'additionalWeightPrice'),
    includeTax: readChannelBoolean(surface, 'includeTax'),
    includeCustomsClearance: readChannelBoolean(surface, 'includeCustomsClearance'),
    includeDelivery: readChannelBoolean(surface, 'includeDelivery'),
    taxRemark: readChannelText(surface, 'taxRemark'),
    destinationCountry: readChannelText(surface, 'destinationCountry'),
    applicableArea: readChannelText(surface, 'applicableArea'),
    transferCenter: readChannelText(surface, 'transferCenter'),
    supportBattery: readChannelBoolean(surface, 'supportBattery'),
    supportLiquid: readChannelBoolean(surface, 'supportLiquid'),
    supportSensitiveGoods: readChannelBoolean(surface, 'supportSensitiveGoods'),
    supportNormalGoods: readChannelBoolean(surface, 'supportNormalGoods'),
    maxBoxWeight: readChannelOptionalNumber(surface, 'maxBoxWeight'),
    maxBoxVolume: readChannelOptionalNumber(surface, 'maxBoxVolume'),
  }
}

function submitCarrier(carrierCode: string): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-flc-carrier-form-root]')
  if (!surface) return
  try {
    const input = readCarrierForm(surface)
    if (carrierCode) {
      updatePmsFirstLegCarrier(carrierCode, input, PMS_BUYER_ACTOR)
      state.feedback = `已保存物流商 ${carrierCode}。`
    } else {
      const carrier = createPmsFirstLegCarrier(input, PMS_BUYER_ACTOR)
      state.feedback = `已创建物流商 ${carrier.carrierCode}。`
    }
    state.feedbackOk = true
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '保存物流商失败'
    refreshOverlays()
  }
}

function submitChannel(carrierCode: string, channelCode: string): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-flc-channel-form-root]')
  if (!surface) return
  try {
    const input = { carrierId: carrierCode, ...readChannelForm(surface) }
    if (channelCode) {
      updatePmsFirstLegChannel(channelCode, input, PMS_BUYER_ACTOR)
      state.feedback = `已保存渠道 ${channelCode}。`
    } else {
      const channel = createPmsFirstLegChannel(input, PMS_BUYER_ACTOR)
      state.feedback = `已创建渠道 ${channel.channelCode}。`
    }
    state.feedbackOk = true
    state.overlay = { kind: 'channels', carrierCode }
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '保存渠道失败，请检查填写内容'
    refreshOverlays()
  }
}

export function renderPmsFirstLegCarriersPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-flc-root data-skip-page-rerender="true"><style>[data-pms-flc-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsFirstLegCarrierOverlays(): boolean {
  if (state.overlay?.kind === 'channel-form') {
    state.overlay = { kind: 'channels', carrierCode: state.overlay.carrierCode }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (state.overlay?.kind === 'channels') {
    state.overlay = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (state.overlay) {
    state.overlay = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (state.showColumnSettings) {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  return false
}

export function handlePmsFirstLegCarriersEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    closePmsFirstLegCarrierOverlays()
    return true
  }

  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsFlcField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'statusFilter') {
      state.statusFilter = field.value as CarrierPageState['statusFilter']
      return true
    }
    if (fieldName === 'pageSize') {
      controller.setPageSize(Number.parseInt((field as HTMLSelectElement).value, 10))
      controller.refresh({ overlays: false })
      return true
    }
    return true
  }

  const channelFieldControl = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-channel-field]`)
  if (channelFieldControl?.dataset.pmsFlcChannelField === 'billingMethod' && channelFieldControl instanceof HTMLSelectElement) {
    syncChannelBillingSections(channelFieldControl)
    return true
  }

  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsFlcAction
  if (!action) return false

  if (action === 'query') {
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.statusFilter = ''
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'export') {
    exportRows()
    return true
  }
  if (action === 'open-column-settings') {
    state.showColumnSettings = true
    refreshOverlays()
    return true
  }
  if (action === 'close-column-settings') {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  if (action === 'restore-column-settings') {
    controller.restorePreferences()
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode?.closest<HTMLElement>('[data-pms-flc-column-key]')?.dataset.pmsFlcColumnKey || ''
    controller.updateColumnPreference(action, key, actionNode?.closest('input')?.checked)
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    controller.stepPage(action === 'next-page' ? 1 : -1)
    controller.refresh({ overlays: false })
    return true
  }
  if (action === 'sort-column') {
    controller.cycleSort(actionNode?.dataset.columnKey || '')
    controller.refresh()
    return true
  }
  if (action === 'open-carrier-create') {
    state.overlay = { kind: 'carrier-form', carrierCode: '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-carrier-edit') {
    state.overlay = { kind: 'carrier-form', carrierCode: actionNode?.dataset.carrierCode || '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-channels') {
    state.overlay = { kind: 'channels', carrierCode: actionNode?.dataset.carrierCode || '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-channel-create' || action === 'open-channel-edit') {
    state.overlay = { kind: 'channel-form', carrierCode: actionNode?.dataset.carrierCode || (state.overlay?.kind === 'channels' ? state.overlay.carrierCode : ''), channelCode: action === 'open-channel-edit' ? actionNode?.dataset.channelCode || '' : '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'toggle-carrier') {
    state.overlay = { kind: 'toggle-carrier', carrierCode: actionNode?.dataset.carrierCode || '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'toggle-channel') {
    state.overlay = { kind: 'toggle-channel', channelCode: actionNode?.dataset.channelCode || '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'confirm-toggle') {
    try {
      if (state.overlay?.kind === 'toggle-carrier') {
        const carrier = togglePmsFirstLegCarrierStatus(state.overlay.carrierCode, PMS_BUYER_ACTOR)
        state.feedback = `物流商 ${carrier.shortName} 已${carrier.status}。`
      } else if (state.overlay?.kind === 'toggle-channel') {
        const channel = togglePmsFirstLegChannelStatus(state.overlay.channelCode, PMS_BUYER_ACTOR)
        state.feedback = `渠道 ${channel.channelName} 已${channel.status}。`
      }
      state.feedbackOk = true
      state.overlay = null
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '启停失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'submit-carrier') {
    if (state.overlay?.kind === 'carrier-form') submitCarrier(state.overlay.carrierCode)
    return true
  }
  if (action === 'submit-channel') {
    if (state.overlay?.kind === 'channel-form') submitChannel(state.overlay.carrierCode, state.overlay.channelCode)
    return true
  }
  if (action === 'close-channel-form') {
    closePmsFirstLegCarrierOverlays()
    return true
  }
  if (action === 'close-overlay') {
    if (state.overlay?.kind === 'carrier-form' || state.overlay?.kind === 'channels') {
      state.overlay = null
      state.overlayError = ''
      refreshOverlays()
      return true
    }
    closePmsFirstLegCarrierOverlays()
    return true
  }
  return false
}

export function getPmsFirstLegCarrierRowCountForTest(): number {
  return filteredRows().length
}
