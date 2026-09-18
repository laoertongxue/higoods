// @page-pattern: list
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderDangerButton, renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  advancePmsSupplierStatus,
  createPmsSupplier,
  getPmsSupplier,
  listPmsSuppliers,
  pmsAllowedSupplierNextStatuses,
  updatePmsSupplier,
  PMS_SUPPLIER_CITIES,
  PMS_SUPPLIER_COUNTRIES,
  PMS_SUPPLIER_CURRENCIES,
  PMS_SUPPLIER_DELIVERY_METHODS,
  PMS_SUPPLIER_LEVELS,
  PMS_SUPPLIER_PAYMENT_METHODS,
  PMS_SUPPLIER_TYPES,
  type PmsSupplier,
  type PmsSupplierCategory,
  type PmsSupplierCurrency,
  type PmsSupplierDeliveryMethod,
  type PmsSupplierInput,
  type PmsSupplierLevel,
  type PmsSupplierPaymentMethod,
  type PmsSupplierStatus,
} from '../../data/pms/suppliers.ts'
import { listPmsLogs, PmsDomainError, type PmsActorRole } from '../../data/pms/runtime.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import {
  formatPmsQty,
  formatPmsTime,
  hydratePmsSurface,
  readNumberField,
  readTextField,
  renderPmsFeedback,
  renderPmsOverlayError,
  renderPmsStatusBadge,
} from './shared.ts'

type SupplierOverlay =
  | null
  | { kind: 'detail'; supplierCode: string }
  | { kind: 'form'; supplierCode: string }
  | { kind: 'reject'; supplierCode: string }
  | { kind: 'toggle'; supplierCode: string; nextStatus: PmsSupplierStatus }

interface SupplierPageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | PmsSupplierStatus
  category: '' | PmsSupplierCategory
  overlay: SupplierOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-sup'
const ROOT_SELECTOR = '[data-pms-sup-root]'
const BUYER = { id: 'USR-PMS-WANG', name: '王采购', role: '采购员' as PmsActorRole }

const state: SupplierPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
  category: '',
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsSupplier[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsSuppliers().filter((supplier) => {
    if (state.status && supplier.status !== state.status) return false
    if (state.category && supplier.category !== state.category) return false
    if (!keyword) return true
    return [supplier.supplierCode, supplier.supplierName, supplier.shortName, supplier.contactName, supplier.contactPhone].some((value) => value.toLowerCase().includes(keyword))
  })
}

function statusTone(status: PmsSupplierStatus): 'blue' | 'green' | 'yellow' | 'red' | 'slate' {
  if (status === '已启用') return 'green'
  if (status === '待审核') return 'yellow'
  if (status === '已驳回') return 'red'
  if (status === '草稿') return 'blue'
  return 'slate'
}

const STATUS_ACTION_LABELS: Record<PmsSupplierStatus, string> = {
  草稿: '提交审核',
  待审核: '审核通过',
  已驳回: '退回修改',
  已启用: '停用',
  已停用: '启用',
}

const columns: StandardListColumn<PmsSupplier>[] = [
  {
    key: 'supplier',
    title: '供应商',
    width: 260,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.supplierName,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.supplierName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.supplierCode)} · ${escapeHtml(row.shortName)} · ${escapeHtml(row.category)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.country || '—')} · ${escapeHtml(row.city || '—')}</div>`,
  },
  {
    key: 'contact',
    title: '联系人',
    width: 160,
    render: (row) => `<div class="text-sm">${escapeHtml(row.contactName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.contactPhone)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.email || '—')}</div>`,
  },
  {
    key: 'settlement',
    title: '结算 / 交付',
    width: 190,
    render: (row) => `<div class="text-sm">${escapeHtml(row.level)} · ${escapeHtml(row.paymentMethod)} · ${escapeHtml(row.currency)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.defaultDeliveryMethod || '—')}</div><div class="mt-1 text-xs text-slate-500">供货周期 ${row.leadTimeDays} 天 · 关联物料 ${row.materialCount} 个</div>`,
  },
  {
    key: 'tags',
    title: '标签',
    width: 180,
    render: (row) => row.tags.length ? `<div class="flex flex-wrap gap-1">${row.tags.map((tag) => `<span class="rounded-full border bg-slate-50 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(tag)}</span>`).join('')}</div>` : '<span class="text-xs text-slate-500">—</span>',
  },
  {
    key: 'status',
    title: '状态',
    width: 190,
    sortable: true,
    sortValue: (row) => row.status,
    render: (row) => `${renderPmsStatusBadge(row.status, statusTone(row.status))}${row.rejectReason ? `<div class="mt-1 text-xs text-red-700">驳回：${escapeHtml(row.rejectReason)}</div>` : ''}`,
  },
  {
    key: 'actions',
    title: '操作',
    width: 230,
    actionColumn: true,
    render: (row) => {
      const nextStatuses = pmsAllowedSupplierNextStatuses(row.status)
      const next = nextStatuses.find((status) => status !== '已驳回')
      const editable = row.status === '草稿' || row.status === '已驳回'
      return `<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-detail" data-supplier-code="${escapeHtml(row.supplierCode)}" data-skip-page-rerender="true">详情</button>
        <button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-edit" data-supplier-code="${escapeHtml(row.supplierCode)}" data-skip-page-rerender="true" ${editable ? '' : 'disabled'}>编辑</button>
        ${next ? `<button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="advance" data-supplier-code="${escapeHtml(row.supplierCode)}" data-next-status="${next}" data-skip-page-rerender="true">${STATUS_ACTION_LABELS[next]}</button>` : ''}
      </div>`
    },
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/suppliers',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-sup-table-surface]',
  paginationSurfaceSelector: '[data-pms-sup-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-sup-overlays]',
  defaultFrozenKeys: ['supplier'],
  columnSettingsTitle: '供应商列设置',
  emptyText: '当前条件下暂无供应商',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  const statuses: Array<'' | PmsSupplierStatus> = ['', '草稿', '待审核', '已启用', '已驳回', '已停用']
  const statusOptions = statuses.map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const categories: Array<'' | PmsSupplierCategory> = ['', ...PMS_SUPPLIER_TYPES]
  const categoryOptions = categories.map((value) => `<option value="${value}" ${state.category === value ? 'selected' : ''}>${value || '全部类型'}</option>`).join('')
  const advancedCount = state.category ? 1 : 0
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="编码 / 名称 / 联系人 / 电话" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">类型</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="category" data-skip-page-rerender="true">${categoryOptions}</select></label>
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderPrimaryButton('新增供应商', { prefix: EVENT_PREFIX, action: 'open-create' }, 'plus')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  return renderProcessOrderStats([
    { label: '供应商总数', value: rows.length },
    { label: '已启用', value: rows.filter((row) => row.status === '已启用').length },
    { label: '待审核 / 已驳回', value: rows.filter((row) => row.status === '待审核' || row.status === '已驳回').length },
    { label: '关联物料', value: rows.reduce((sum, row) => sum + row.materialCount, 0) },
  ])
}

function formField(label: string, field: string, value: string, options: { full?: boolean; type?: 'text' | 'number'; min?: string; step?: string } = {}): string {
  return `<label class="${options.full ? 'col-span-2' : ''} flex flex-col gap-1 text-xs text-muted-foreground">${escapeHtml(label)}<input class="h-9 rounded-md border bg-background px-2 text-sm" type="${options.type ?? 'text'}"${options.min ? ` min="${options.min}"` : ''}${options.step ? ` step="${options.step}"` : ''} value="${escapeHtml(value)}" data-${EVENT_PREFIX}-form-field="${field}" data-skip-page-rerender="true" /></label>`
}

function formSelect(label: string, field: string, value: string, options: readonly string[], full = false): string {
  return `<label class="${full ? 'col-span-2' : ''} flex flex-col gap-1 text-xs text-muted-foreground">${escapeHtml(label)}<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-form-field="${field}" data-skip-page-rerender="true">${options.map((option) => `<option value="${escapeHtml(option)}" ${value === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></label>`
}

function formSectionTitle(title: string): string {
  return `<div class="col-span-2 mt-1 border-t pt-3 text-sm font-semibold">${escapeHtml(title)}</div>`
}

function supplierForm(supplier?: PmsSupplier): string {
  return `<div class="grid grid-cols-2 gap-3">
    ${formSectionTitle('一、基础信息')}
    ${formField('供应商名称', 'supplierName', supplier?.supplierName ?? '', { full: true })}
    ${formField('供应商简称', 'shortName', supplier?.shortName ?? '')}
    ${formSelect('供应商类型', 'category', supplier?.category ?? '面料供应商', PMS_SUPPLIER_TYPES)}
    ${formSelect('国家/地区', 'country', supplier?.country ?? '中国', PMS_SUPPLIER_COUNTRIES)}
    ${formSelect('省市', 'city', supplier?.city ?? '广东广州', PMS_SUPPLIER_CITIES)}
    ${formSelect('供应商等级', 'level', supplier?.level ?? 'B级', PMS_SUPPLIER_LEVELS)}
    ${formSectionTitle('二、联系人信息')}
    ${formField('联系人', 'contactName', supplier?.contactName ?? '')}
    ${formField('联系电话', 'contactPhone', supplier?.contactPhone ?? '')}
    ${formField('邮箱', 'email', supplier?.email ?? '')}
    ${formField('微信', 'wechat', supplier?.wechat ?? '')}
    ${formSectionTitle('三、商务结算信息')}
    ${formSelect('付款方式', 'paymentMethod', supplier?.paymentMethod ?? '月结', PMS_SUPPLIER_PAYMENT_METHODS)}
    ${formSelect('币种', 'currency', supplier?.currency ?? 'RMB', PMS_SUPPLIER_CURRENCIES)}
    ${formField('开票信息', 'invoiceInfo', supplier?.invoiceInfo ?? '')}
    ${formField('银行账户', 'bankAccount', supplier?.bankAccount ?? '')}
    ${formSectionTitle('四、交付信息')}
    ${formSelect('默认交货方式', 'defaultDeliveryMethod', supplier?.defaultDeliveryMethod ?? '供应商直发海外仓', PMS_SUPPLIER_DELIVERY_METHODS, true)}
    ${formSectionTitle('五、补充说明')}
    ${formField('供货周期（天）', 'leadTimeDays', String(supplier?.leadTimeDays ?? 15), { type: 'number', min: '1', step: '1' })}
    ${formField('地址', 'address', supplier?.address ?? '')}
    ${formField('备注', 'remark', supplier?.remark ?? '', { full: true })}
  </div>`
}

function renderFormOverlay(supplierCode: string): string {
  const supplier = supplierCode ? getPmsSupplier(supplierCode) : undefined
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="供应商表单" data-pms-sup-form-root><section class="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-background p-5 shadow-2xl"><header class="mb-4 flex items-center justify-between"><h2 class="font-semibold">${supplier ? `编辑 ${escapeHtml(supplier.supplierCode)}` : '新增供应商'}</h2>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header>${renderPmsOverlayError(state.overlayError)}
    ${supplierForm(supplier)}
    <footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${supplier ? renderPrimaryButton('保存修改', { prefix: EVENT_PREFIX, action: 'submit-form' }, 'check-check') : renderPrimaryButton('创建供应商', { prefix: EVENT_PREFIX, action: 'submit-form' }, 'plus')}</footer></section></div>`
}

function detailItem(label: string, value: string, raw = false): string {
  return `<div><dt class="text-xs text-muted-foreground">${escapeHtml(label)}</dt><dd class="mt-1">${raw ? value : escapeHtml(value)}</dd></div>`
}

function detailSection(title: string, items: string): string {
  return `<section><h3 class="mb-2 text-sm font-semibold">${escapeHtml(title)}</h3><dl class="grid grid-cols-2 gap-3 text-sm">${items}</dl></section>`
}

export function renderPmsSupplierDetailOverlay(supplierCode: string): string {
  const supplier = getPmsSupplier(supplierCode)
  if (!supplier) return ''
  const logs = listPmsLogs('supplier', supplierCode)
  const logItems = logs.length
    ? logs.map((log) => `<li class="rounded-md border p-3 text-xs"><div class="flex items-center justify-between"><strong>${escapeHtml(log.action)}</strong><span class="text-slate-500">${formatPmsTime(log.occurredAt)}</span></div><div class="mt-1 text-slate-600">${escapeHtml(log.actorName)}：${escapeHtml(log.beforeValue)} → ${escapeHtml(log.afterValue)}${log.reason ? `（${escapeHtml(log.reason)}）` : ''}</div></li>`).join('')
    : '<li class="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">暂无操作日志</li>'
  const baseItems = [
    detailItem('供应商编码', supplier.supplierCode),
    detailItem('供应商名称', supplier.supplierName),
    detailItem('供应商简称', supplier.shortName),
    detailItem('供应商类型', supplier.category),
    detailItem('国家/地区', supplier.country || '—'),
    detailItem('省市', supplier.city || '—'),
    detailItem('供应商等级', supplier.level),
    detailItem('状态', renderPmsStatusBadge(supplier.status, statusTone(supplier.status)), true),
    detailItem('创建人', supplier.createdBy),
    detailItem('创建时间', formatPmsTime(supplier.createdAt)),
    detailItem('更新时间', formatPmsTime(supplier.updatedAt)),
  ].join('')
  const contactItems = [
    detailItem('联系人', supplier.contactName),
    detailItem('联系电话', supplier.contactPhone),
    detailItem('邮箱', supplier.email || '—'),
    detailItem('微信', supplier.wechat || '—'),
  ].join('')
  const financeItems = [
    detailItem('付款方式', supplier.paymentMethod),
    detailItem('币种', supplier.currency),
    detailItem('默认交货方式', supplier.defaultDeliveryMethod || '—'),
    detailItem('开票信息', supplier.invoiceInfo || '—'),
    detailItem('银行账户', supplier.bankAccount || '—'),
  ].join('')
  const collaborationItems = [
    detailItem('累计采购单数', `${supplier.totalPurchaseOrders ?? 0} 单`),
    detailItem('累计采购金额', formatPmsQty(supplier.totalPurchaseAmount ?? 0, supplier.currency)),
    detailItem('准时交付率', `${supplier.onTimeDeliveryRate ?? 0}%`),
    detailItem('质量合格率', `${supplier.qualityPassRate ?? 0}%`),
    detailItem('最近采购订单号', supplier.recentPurchaseOrderNo || '—'),
    detailItem('最近采购日期', supplier.recentPurchaseDate || '—'),
  ].join('')
  const otherItems = [
    detailItem('供货周期', `${supplier.leadTimeDays} 天`),
    detailItem('地址', supplier.address || '—'),
    detailItem('标签', supplier.tags.length ? supplier.tags.join('、') : '—'),
    detailItem('备注', supplier.remark || '—'),
    supplier.rejectReason ? detailItem('驳回原因', `<span class="text-red-700">${escapeHtml(supplier.rejectReason)}</span>`, true) : '',
  ].join('')
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="供应商详情"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭详情"></button><section class="relative z-10 flex h-full w-[640px] max-w-[94vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(supplier.supplierName)}</h2><p class="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500"><span>${escapeHtml(supplier.supplierCode)} · ${escapeHtml(supplier.category)}</span>${renderPmsStatusBadge(supplier.status, statusTone(supplier.status))}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    ${detailSection('基础信息', baseItems)}
    ${detailSection('联系人信息', contactItems)}
    ${detailSection('采购与财务信息', financeItems)}
    ${detailSection('采购协同数据', collaborationItems)}
    ${detailSection('其他信息', otherItems)}
    <section><h3 class="mb-2 text-sm font-semibold">操作日志</h3><ul class="space-y-2">${logItems}</ul></section>
  </div></section></div>`
}

function renderRejectOverlay(supplierCode: string): string {
  return `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="驳回供应商" data-pms-sup-reject-root><section class="w-full max-w-lg rounded-xl bg-background p-5 shadow-2xl"><h2 class="font-semibold">驳回 ${escapeHtml(supplierCode)}</h2>${renderPmsOverlayError(state.overlayError)}<label class="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">驳回原因（必填）<textarea class="min-h-24 rounded-md border bg-background p-2 text-sm" data-${EVENT_PREFIX}-reject-reason data-skip-page-rerender="true"></textarea></label><footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderDangerButton('确认驳回', { prefix: EVENT_PREFIX, action: 'submit-reject' }, 'check-check')}</footer></section></div>`
}

function renderToggleOverlay(supplierCode: string, nextStatus: PmsSupplierStatus): string {
  const supplier = getPmsSupplier(supplierCode)
  return `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="供应商状态确认" data-pms-sup-toggle-root><section class="w-full max-w-md rounded-xl bg-background p-5 shadow-2xl"><h2 class="font-semibold">${escapeHtml(STATUS_ACTION_LABELS[supplier!.status])}</h2><p class="mt-2 text-sm text-slate-600">确认将 <strong>${escapeHtml(supplier?.supplierName ?? supplierCode)}</strong> 变为${escapeHtml(nextStatus)}？停用不影响历史采购单与供货档案。</p><footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${nextStatus === '已停用' ? renderDangerButton(`确认${nextStatus}`, { prefix: EVENT_PREFIX, action: 'confirm-toggle' }, 'check-check') : renderPrimaryButton(`确认${nextStatus}`, { prefix: EVENT_PREFIX, action: 'confirm-toggle' }, 'check-check')}</footer></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-sup-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return columnSettings
  if (state.overlay.kind === 'detail') return `${columnSettings}${renderPmsSupplierDetailOverlay(state.overlay.supplierCode)}`
  if (state.overlay.kind === 'form') return `${columnSettings}${renderFormOverlay(state.overlay.supplierCode)}`
  if (state.overlay.kind === 'reject') return `${columnSettings}${renderRejectOverlay(state.overlay.supplierCode)}`
  return `${columnSettings}${renderToggleOverlay(state.overlay.supplierCode, state.overlay.nextStatus)}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: false,
    title: '商品供应商管理',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2"><span class="text-xs text-muted-foreground">状态机：草稿 → 待审核 → 已启用 / 已驳回；已启用可停用</span>${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-sup-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-sup-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-sup-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-sup-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function readForm(surface: HTMLElement): PmsSupplierInput {
  return {
    supplierName: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="supplierName"]`),
    shortName: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="shortName"]`),
    category: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="category"]`) as PmsSupplierCategory,
    country: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="country"]`),
    city: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="city"]`),
    contactName: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="contactName"]`),
    contactPhone: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="contactPhone"]`),
    email: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="email"]`),
    wechat: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="wechat"]`),
    level: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="level"]`) as PmsSupplierLevel,
    paymentMethod: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="paymentMethod"]`) as PmsSupplierPaymentMethod,
    currency: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="currency"]`) as PmsSupplierCurrency,
    defaultDeliveryMethod: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="defaultDeliveryMethod"]`) as PmsSupplierDeliveryMethod,
    invoiceInfo: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="invoiceInfo"]`),
    bankAccount: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="bankAccount"]`),
    leadTimeDays: readNumberField(surface, `[data-${EVENT_PREFIX}-form-field="leadTimeDays"]`),
    address: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="address"]`),
    remark: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="remark"]`),
  }
}

function submitForm(supplierCode: string): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-sup-form-root]')
  if (!surface) return
  try {
    if (supplierCode) {
      updatePmsSupplier(supplierCode, readForm(surface), BUYER)
      state.feedback = `已保存供应商 ${supplierCode}。`
    } else {
      const supplier = createPmsSupplier(readForm(surface), BUYER)
      state.feedback = `已创建供应商 ${supplier.supplierCode}（草稿）。`
    }
    state.feedbackOk = true
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '保存供应商失败，请检查填写内容'
    refreshOverlays()
  }
}

function advanceStatus(supplierCode: string, nextStatus: PmsSupplierStatus, reason = ''): void {
  try {
    advancePmsSupplierStatus(supplierCode, nextStatus, BUYER, reason)
    state.feedback = `${supplierCode} 已变为${nextStatus}。`
    state.feedbackOk = true
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '状态流转失败'
    refreshOverlays()
  }
}

function exportRows(): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前查询条件下没有可导出的供应商。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    '商品供应商.csv',
    ['供应商编码', '供应商名称', '简称', '类型', '国家/地区', '省市', '联系人', '电话', '邮箱', '微信', '等级', '付款方式', '币种', '默认交货方式', '开票信息', '银行账户', '供货周期', '状态', '累计采购单数', '累计采购金额', '准时交付率', '质量合格率', '关联物料'],
    rows.map((row) => [row.supplierCode, row.supplierName, row.shortName, row.category, row.country ?? '', row.city ?? '', row.contactName, row.contactPhone, row.email, row.wechat ?? '', row.level, row.paymentMethod, row.currency, row.defaultDeliveryMethod ?? '', row.invoiceInfo ?? '', row.bankAccount ?? '', row.leadTimeDays, row.status, row.totalPurchaseOrders ?? 0, row.totalPurchaseAmount ?? 0, row.onTimeDeliveryRate ?? 0, row.qualityPassRate ?? 0, row.materialCount]),
  )
  state.feedback = `已导出 ${rows.length} 家供应商（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

export function renderPmsSuppliersPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-sup-root data-skip-page-rerender="true"><style>[data-pms-sup-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsSupplierOverlays(): boolean {
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

export function handlePmsSuppliersEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    state.overlay = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsSupField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as SupplierPageState['status']
      return true
    }
    if (fieldName === 'category') {
      state.category = field.value as SupplierPageState['category']
      return true
    }
    if (fieldName === 'pageSize') {
      controller.setPageSize(Number.parseInt((field as HTMLSelectElement).value, 10))
      controller.refresh({ overlays: false })
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsSupAction
  if (!action) return false
  if (action === 'query') {
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.status = ''
    state.category = ''
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
    const key = actionNode?.closest<HTMLElement>('[data-pms-sup-column-key]')?.dataset.pmsSupColumnKey || ''
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
  if (action === 'open-detail') {
    state.overlay = { kind: 'detail', supplierCode: actionNode?.dataset.supplierCode || '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-create') {
    state.overlay = { kind: 'form', supplierCode: '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-edit') {
    state.overlay = { kind: 'form', supplierCode: actionNode?.dataset.supplierCode || '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'advance') {
    const supplierCode = actionNode?.dataset.supplierCode || ''
    const nextStatus = actionNode?.dataset.nextStatus as PmsSupplierStatus | undefined
    if (!nextStatus) return true
    if (nextStatus === '已驳回') {
      state.overlay = { kind: 'reject', supplierCode }
      state.overlayError = ''
      refreshOverlays()
      return true
    }
    if (nextStatus === '已停用' || nextStatus === '已启用') {
      state.overlay = { kind: 'toggle', supplierCode, nextStatus }
      state.overlayError = ''
      refreshOverlays()
      return true
    }
    advanceStatus(supplierCode, nextStatus)
    return true
  }
  if (action === 'submit-form') {
    if (state.overlay?.kind === 'form') submitForm(state.overlay.supplierCode)
    return true
  }
  if (action === 'submit-reject') {
    if (state.overlay?.kind !== 'reject') return true
    const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-sup-reject-root]')
    const reason = surface ? readTextField(surface, `[data-${EVENT_PREFIX}-reject-reason]`) : ''
    advanceStatus(state.overlay.supplierCode, '已驳回', reason)
    return true
  }
  if (action === 'confirm-toggle') {
    if (state.overlay?.kind !== 'toggle') return true
    advanceStatus(state.overlay.supplierCode, state.overlay.nextStatus)
    return true
  }
  if (action === 'close-overlay') {
    state.overlay = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  return false
}
