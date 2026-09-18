// @page-pattern: list
import { renderDangerButton, renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  addPmsPaymentAttachment,
  checkPmsPaymentRequestEditScope,
  consumePmsPaymentDraft,
  createPmsPaymentRequestFromDraft,
  getPmsPaymentRequest,
  listPmsPaymentRequests,
  registerPmsPayment,
  removePmsPaymentAttachment,
  submitPmsPaymentRequest,
  updatePmsPaymentRequestInfo,
  updatePmsPaymentRemark,
  voidPmsPaymentRequest,
  type PmsPaymentDraft,
  type PmsPaymentRequest,
  type PmsPaymentRequestInfoInput,
  type PmsPaymentRequestType,
} from '../../data/pms/payment-requests.ts'
import { getPmsMaterial } from '../../data/pms/materials.ts'
import { getPmsMaterialReconciliation } from '../../data/pms/reconciliations.ts'
import { listPmsLogs, PmsDomainError } from '../../data/pms/runtime.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import {
  formatPmsMoney,
  formatPmsTime,
  handlePmsCommonImageEvent,
  hydratePmsSurface,
  readNumberField,
  readTextField,
  renderPmsBusinessImage,
  renderPmsFeedback,
  renderPmsImagePreview,
  renderPmsOverlayError,
  renderPmsStatusBadge,
} from './shared.ts'

type PaymentSubOverlay = null | { kind: 'request' } | { kind: 'pay' } | { kind: 'void' } | { kind: 'attachment' }

interface PaymentPageState extends ProcessOrderListControllerState {
  type: PmsPaymentRequestType
  keyword: string
  status: '' | PmsPaymentRequest['status']
  paymentStatus: '' | PmsPaymentRequest['paymentStatus']
  draft: PmsPaymentDraft | null
  detailNo: string
  subOverlay: PaymentSubOverlay
  armedAttachmentIndex: number
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-pay'
const ROOT_SELECTOR = '[data-pms-pay-root]'
const FINANCE = { id: 'USR-PMS-LIU', name: '刘财务', role: '财务' as const }

const state: PaymentPageState = {
  type: 'material',
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
  paymentStatus: '',
  draft: null,
  detailNo: '',
  subOverlay: null,
  armedAttachmentIndex: -1,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsPaymentRequest[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsPaymentRequests(state.type).filter((request) => {
    if (state.status && request.status !== state.status) return false
    if (state.paymentStatus && request.paymentStatus !== state.paymentStatus) return false
    if (!keyword) return true
    return [request.requestNo, request.objectName, ...request.sourceRows.map((row) => row.sourceId)].some((value) => value.toLowerCase().includes(keyword))
  })
}

function statusTone(status: PmsPaymentRequest['status']): 'blue' | 'green' | 'yellow' | 'red' | 'slate' {
  if (status === '已完成') return 'green'
  if (status === '已请款') return 'blue'
  if (status === '部分请款') return 'yellow'
  if (status === '已作废') return 'red'
  return 'slate'
}

const columns: StandardListColumn<PmsPaymentRequest>[] = [
  {
    key: 'request',
    title: '请款单 / 状态',
    width: 230,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.requestNo,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.requestNo)}</div><div class="mt-1 flex flex-wrap gap-1">${renderPmsStatusBadge(row.status, statusTone(row.status))}${renderPmsStatusBadge(row.paymentStatus, row.paymentStatus === '已付款' ? 'green' : row.paymentStatus === '部分付款' ? 'yellow' : 'slate')}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.createdBy)} · ${formatPmsTime(row.createdAt)}</div>`,
  },
  {
    key: 'object',
    title: '付款对象',
    width: 240,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.objectName,
    render: (row) => `<div class="font-medium">${escapeHtml(row.objectName)}</div><div class="mt-1 text-xs text-slate-500">${row.type === 'material' ? '面辅料采购请款' : '物流费用请款'} · ${escapeHtml(row.currency)}</div><div class="mt-1 text-xs text-slate-500">来源 ${row.sourceRows.length} 条对账</div>`,
  },
  {
    key: 'amount',
    title: '应付 / 已请款 / 已付款',
    width: 260,
    sortable: true,
    sortValue: (row) => row.payableAmount,
    render: (row) => {
      const money = (value: number) => formatPmsMoney(value, row.currency === 'USD' ? 'USD' : 'RMB')
      const pending = Math.max(0, row.payableAmount - row.requestedAmount)
      return `<div class="text-xs text-slate-500">应付 ${money(row.payableAmount)}</div><div class="mt-1 text-sm tabular-nums">已请款 ${money(row.requestedAmount)} · 待请款 ${money(pending)}</div><div class="mt-1 text-sm tabular-nums">已付款 ${money(row.paidAmount)}</div>`
    },
  },
  {
    key: 'source',
    title: '来源对账',
    width: 220,
    render: (row) => `<div class="space-y-1 text-xs">${row.sourceRows.map((source) => `<div><div>${escapeHtml(source.sourceId)}</div><div class="text-slate-500">${escapeHtml(source.sourceLabel)}</div></div>`).join('')}</div>`,
  },
  {
    key: 'attachment',
    title: '附件',
    width: 140,
    sortable: true,
    sortValue: (row) => row.attachments.length,
    render: (row) => row.attachments.length > 0 ? `<div class="text-sm">${row.attachments.length} 个</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.attachments[0].name)}</div>` : '<span class="text-xs text-slate-500">无附件</span>',
  },
  {
    key: 'actions',
    title: '操作',
    width: 130,
    actionColumn: true,
    render: (row) => `<button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-detail" data-request-no="${escapeHtml(row.requestNo)}" data-skip-page-rerender="true">详情与处理</button>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/payment-requests',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-pay-table-surface]',
  paginationSurfaceSelector: '[data-pms-pay-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-pay-overlays]',
  defaultFrozenKeys: ['request', 'object'],
  columnSettingsTitle: '请款单列设置',
  emptyText: '当前条件下暂无请款单',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function pageTitle(): string {
  return state.type === 'material' ? '面辅料采购请款' : '物流费用请款'
}

function sourceMaterialThumbnail(sourceId: string): string {
  const reconciliation = getPmsMaterialReconciliation(sourceId)
  const material = reconciliation ? getPmsMaterial(reconciliation.materialCode) : undefined
  if (!material) return ''
  return renderPmsBusinessImage(material.imageUrl, `${material.materialName}（${material.materialCode}）实物图`, 'h-10 w-10')
}

function renderFilters(): string {
  const statusOptions = ['', '未请款', '部分请款', '已请款', '已完成', '已作废'].map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部请款状态'}</option>`).join('')
  const paymentOptions = ['', '未付款', '部分付款', '已付款'].map((value) => `<option value="${value}" ${state.paymentStatus === value ? 'selected' : ''}>${value || '全部付款状态'}</option>`).join('')
  const advancedCount = state.paymentStatus ? 1 : 0
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="请款单 / 付款对象 / 对账记录" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">请款状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">付款状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="paymentStatus" data-skip-page-rerender="true">${paymentOptions}</select></label>
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  return renderProcessOrderStats([
    { label: '请款单', value: rows.length },
    { label: '应付合计', value: formatPmsMoney(rows.reduce((sum, row) => sum + row.payableAmount, 0)) },
    { label: '已请款合计', value: formatPmsMoney(rows.reduce((sum, row) => sum + row.requestedAmount, 0)) },
    { label: '已付款合计', value: formatPmsMoney(rows.reduce((sum, row) => sum + row.paidAmount, 0)) },
  ])
}

export function formatPmsAmountUpper(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—'
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
  const units = ['', '拾', '佰', '仟']
  const sectionMarkers = ['', '万', '亿', '兆']
  const fixed = Math.round(value * 100)
  const jiao = Math.floor((fixed % 100) / 10)
  const fen = fixed % 10
  let integer = Math.floor(fixed / 100)
  if (integer === 0 && jiao === 0 && fen === 0) return '零元整'
  let result = ''
  let needZero = false
  let lowerSection = -1
  let sectionIndex = 0
  while (integer > 0) {
    const section = integer % 10000
    if (section === 0) {
      if (result) needZero = true
    } else {
      let sectionText = ''
      let zeroInSection = false
      String(section).padStart(4, '0').split('').forEach((character, index) => {
        const digit = Number(character)
        const unit = units[3 - index]
        if (digit === 0) {
          if (sectionText) zeroInSection = true
          return
        }
        sectionText += `${zeroInSection ? '零' : ''}${digits[digit]}${unit}`
        zeroInSection = false
      })
      const bridge = needZero || (result && lowerSection >= 0 && lowerSection < 1000) ? '零' : ''
      result = `${sectionText}${sectionMarkers[sectionIndex] ?? ''}${bridge}${result}`
      needZero = false
      lowerSection = section
    }
    integer = Math.floor(integer / 10000)
    sectionIndex += 1
  }
  let amount = `${result || '零'}元`
  if (jiao === 0 && fen === 0) return `${amount}整`
  if (jiao > 0) amount += `${digits[jiao]}角`
  if (fen > 0) amount += `${jiao === 0 ? '零' : ''}${digits[fen]}分`
  return amount
}

function draftField(name: string, label: string, value: string, options: { type?: string; placeholder?: string; options?: string[] } = {}): string {
  const shared = `data-${EVENT_PREFIX}-draft-field="${name}" data-skip-page-rerender="true"`
  const control = options.options
    ? `<select class="h-9 rounded-md border bg-background px-2 text-sm" ${shared}>${options.options.map((option) => `<option value="${option}" ${option === value ? 'selected' : ''}>${option}</option>`).join('')}</select>`
    : `<input class="h-9 rounded-md border bg-background px-2 text-sm" type="${options.type ?? 'text'}" value="${escapeHtml(value)}" placeholder="${options.placeholder ?? ''}" ${shared} />`
  return `<label class="flex flex-col gap-1 text-xs text-muted-foreground">${label}${control}</label>`
}

function renderDraftOverlay(draft: PmsPaymentDraft): string {
  const money = (value: number) => formatPmsMoney(value, draft.currency === 'USD' ? 'USD' : 'RMB')
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="创建请款单" data-pms-pay-draft-root><section class="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-background p-5 shadow-2xl"><header class="mb-4 flex items-center justify-between"><div><h2 class="font-semibold">创建${state.type === 'material' ? '面辅料' : '物流'}请款单</h2><p class="mt-1 text-xs text-slate-500">由对账页生成草稿，默认金额与收款人，可补充银行与付款信息后创建</p></div>${renderSecondaryButton('放弃', { prefix: EVENT_PREFIX, action: 'discard-draft' }, 'x')}</header>${renderPmsOverlayError(state.overlayError)}
    <dl class="grid grid-cols-3 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">付款对象</dt><dd class="mt-1">${escapeHtml(draft.objectName)}</dd></div><div><dt class="text-xs text-muted-foreground">币种</dt><dd class="mt-1">${escapeHtml(draft.currency)}</dd></div><div><dt class="text-xs text-muted-foreground">请款金额（大写）</dt><dd class="mt-1 font-semibold tabular-nums">${money(draft.totalAmount)} · ${formatPmsAmountUpper(draft.totalAmount)}</dd></div></dl>
    <section class="mt-4 rounded-lg border p-3"><h3 class="text-xs font-semibold text-muted-foreground">收款人信息</h3><div class="mt-3 grid grid-cols-3 gap-3">
      ${draftField('payeeName', '收款人名称', draft.objectName)}
      ${draftField('payeeShortName', '收款人简称', '')}
      ${draftField('payeeCurrency', '结算币种', draft.currency, { options: ['RMB', 'USD', 'IDR'] })}
      ${draftField('payeeBankName', '开户行', '')}
      ${draftField('payeeBankAccount', '银行账号', '')}
      ${draftField('payeeSwiftCode', 'SWIFT Code', '')}
      ${draftField('payeeAddress', '收款人地址', '')}
      ${draftField('payeeContactName', '联系人', '')}
      ${draftField('payeeContactPhone', '联系电话', '')}
    </div></section>
    <section class="mt-3 rounded-lg border p-3"><h3 class="text-xs font-semibold text-muted-foreground">付款信息</h3><div class="mt-3 grid grid-cols-3 gap-3">
      ${draftField('paymentType', '付款类型', '全款', { options: ['全款', '部分付款'] })}
      ${draftField('payerEntity', '付款主体', '深圳市海谷科技有限公司')}
      ${draftField('paymentMethod', '付款方式', '银行转账', { options: ['银行转账', '承兑', '现金'] })}
      ${draftField('paymentNature', '款项性质', state.type === 'material' ? '材料款' : '物流费', { options: ['材料款', '物流费', '其他'] })}
      ${draftField('applicant', '申请人', '刘财务')}
      ${draftField('applicantDept', '申请部门', '财务部')}
      ${draftField('paymentNote', '付款备注', '')}
    </div></section>
    <section class="mt-3 rounded-lg border p-3"><h3 class="text-xs font-semibold text-muted-foreground">金额信息与付款说明</h3><div class="mt-3 grid grid-cols-3 gap-3">
      ${draftField('exchangeRate', '汇率', '1', { type: 'number' })}
      ${draftField('baseCurrencyAmount', '折算本位币金额', String(draft.totalAmount), { type: 'number' })}
      ${draftField('purpose', '用途说明', '')}
      ${draftField('supplement', '补充说明', '')}
    </div></section>
    <div class="mt-4 overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">来源对账</th><th class="px-3 py-2">说明</th><th class="px-3 py-2">金额</th></tr></thead><tbody>${draft.rows.map((row) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm"><div class="flex items-center gap-3">${sourceMaterialThumbnail(row.sourceId)}<span>${escapeHtml(row.sourceId)}</span></div></td><td class="px-3 py-2 text-sm">${escapeHtml(row.sourceLabel)}</td><td class="px-3 py-2 text-sm tabular-nums">${money(row.amount)}</td></tr>`).join('')}</tbody></table></div>
    <footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'discard-draft' }, 'x')}${renderPrimaryButton('创建请款单', { prefix: EVENT_PREFIX, action: 'create-request' }, 'check-check')}</footer></section></div>`
}

function infoInput(name: string, label: string, value: string, editable: boolean, type = 'text'): string {
  return `<label class="flex flex-col gap-1 text-xs text-muted-foreground">${label}<input class="h-9 rounded-md border bg-background px-2 text-sm ${editable ? '' : 'bg-slate-100'}" type="${type}" value="${escapeHtml(value)}" ${editable ? '' : 'disabled'} data-${EVENT_PREFIX}-info-field="${name}" data-skip-page-rerender="true" /></label>`
}

function infoValue(label: string, value: string): string {
  return `<div><dt class="text-xs text-muted-foreground">${label}</dt><dd class="mt-1 text-sm">${escapeHtml(value || '—')}</dd></div>`
}

function recordRows(rows: Array<{ at: string; amount: number; note: string; operator: string; method?: string; voucherNo?: string }>, money: (value: number) => string, withVoucher: boolean): string {
  if (rows.length === 0) return `<tr><td class="px-3 py-4 text-center text-xs text-muted-foreground" colspan="${withVoucher ? 5 : 4}">暂无记录</td></tr>`
  return rows.map((row) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-xs">${formatPmsTime(row.at)}</td><td class="px-3 py-2 text-sm tabular-nums">${money(row.amount)}</td><td class="px-3 py-2 text-xs">${escapeHtml(row.method ?? '')}</td>${withVoucher ? `<td class="px-3 py-2 text-xs">${escapeHtml(row.voucherNo || '—')}</td>` : ''}<td class="px-3 py-2 text-xs">${escapeHtml(row.operator)}${row.note ? ` · ${escapeHtml(row.note)}` : ''}</td></tr>`).join('')
}

function renderDetailOverlay(requestNo: string): string {
  const request = getPmsPaymentRequest(requestNo)
  if (!request) return ''
  const scope = checkPmsPaymentRequestEditScope(requestNo)
  const editable = scope.level === 'full'
  const money = (value: number) => formatPmsMoney(value, request.currency === 'USD' ? 'USD' : 'RMB')
  const pendingRequest = Math.max(0, request.payableAmount - request.requestedAmount)
  const pendingPay = Math.max(0, request.requestedAmount - request.paidAmount)
  const logs = listPmsLogs('payment-request', requestNo)
  const logItems = logs.length
    ? logs.map((log) => `<li class="rounded-md border p-3 text-xs"><div class="flex items-center justify-between"><strong>${escapeHtml(log.action)}</strong><span class="text-slate-500">${formatPmsTime(log.occurredAt)}</span></div><div class="mt-1 text-slate-600">${escapeHtml(log.actorName)}：${escapeHtml(log.beforeValue)} → ${escapeHtml(log.afterValue)}${log.reason ? `（${escapeHtml(log.reason)}）` : ''}</div></li>`).join('')
    : '<li class="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">暂无操作日志</li>'
  const actions: string[] = []
  if (request.status !== '已完成' && request.status !== '已作废') {
    if (pendingRequest > 0) actions.push(renderPrimaryButton('提交请款', { prefix: EVENT_PREFIX, action: 'open-request' }, 'send'))
    if (request.requestedAmount > 0 && pendingPay > 0) actions.push(renderSecondaryButton('付款登记', { prefix: EVENT_PREFIX, action: 'open-pay' }, 'wallet'))
    if (scope.level !== 'readonly') actions.push(renderSecondaryButton('添加附件', { prefix: EVENT_PREFIX, action: 'open-attachment' }, 'paperclip'))
    if (request.paidAmount === 0) actions.push(renderDangerButton('作废', { prefix: EVENT_PREFIX, action: 'open-void' }, 'x-circle'))
  }
  const payeeSection = editable
    ? `<section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">收款人信息</h3><div class="mt-3 grid grid-cols-3 gap-3">${infoInput('payeeName', '收款人名称', request.payee.name, editable)}${infoInput('payeeShortName', '收款人简称', request.payee.shortName, editable)}${infoInput('payeeBankName', '开户行', request.payee.bankName, editable)}${infoInput('payeeBankAccount', '银行账号', request.payee.bankAccount, editable)}${infoInput('payeeSwiftCode', 'SWIFT Code', request.payee.swiftCode, editable)}${infoInput('payeeContactName', '联系人', request.payee.contactName, editable)}${infoInput('payeeContactPhone', '联系电话', request.payee.contactPhone, editable)}<label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">收款人地址<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(request.payee.address)}" data-${EVENT_PREFIX}-info-field="payeeAddress" data-skip-page-rerender="true" /></label></div></section>`
    : `<section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">收款人信息</h3><dl class="mt-3 grid grid-cols-3 gap-3">${infoValue('收款人名称', request.payee.name)}${infoValue('简称', request.payee.shortName)}${infoValue('开户行', request.payee.bankName)}${infoValue('银行账号', request.payee.bankAccount)}${infoValue('SWIFT Code', request.payee.swiftCode)}${infoValue('地址', request.payee.address)}${infoValue('联系人', request.payee.contactName)}${infoValue('联系电话', request.payee.contactPhone)}</dl></section>`
  const paymentSection = editable
    ? `<section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">付款信息</h3><div class="mt-3 grid grid-cols-3 gap-3"><label class="flex flex-col gap-1 text-xs text-muted-foreground">付款类型<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-info-field="paymentType" data-skip-page-rerender="true">${['全款', '部分付款'].map((value) => `<option value="${value}" ${value === request.paymentInfo.paymentType ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label class="flex flex-col gap-1 text-xs text-muted-foreground">付款方式<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-info-field="paymentMethod" data-skip-page-rerender="true">${['银行转账', '承兑', '现金'].map((value) => `<option value="${value}" ${value === request.paymentInfo.method ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label class="flex flex-col gap-1 text-xs text-muted-foreground">款项性质<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-info-field="paymentNature" data-skip-page-rerender="true">${['材料款', '物流费', '其他'].map((value) => `<option value="${value}" ${value === request.paymentInfo.nature ? 'selected' : ''}>${value}</option>`).join('')}</select></label>${infoInput('payerEntity', '付款主体', request.paymentInfo.payerEntity, editable)}${infoInput('applicant', '申请人', request.paymentInfo.applicant, editable)}${infoInput('applicantDept', '申请部门', request.paymentInfo.applicantDept, editable)}${infoInput('paymentNote', '付款备注', request.paymentInfo.note, editable)}</div><div class="mt-3 grid grid-cols-3 gap-3">${infoInput('exchangeRate', '汇率', String(request.amountInfo.exchangeRate), editable, 'number')}${infoInput('baseCurrencyAmount', '折算本位币金额', String(request.amountInfo.baseCurrencyAmount), editable, 'number')}${infoInput('purpose', '用途说明', request.narrative.purpose, editable)}</div><div class="mt-3">${renderSecondaryButton('保存请款信息', { prefix: EVENT_PREFIX, action: 'save-info' }, 'check-check').replace('<button', `<button data-request-no="${escapeHtml(requestNo)}"`)}</div></section>`
    : `<section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">付款信息与金额</h3><dl class="mt-3 grid grid-cols-3 gap-3">${infoValue('付款类型', request.paymentInfo.paymentType)}${infoValue('付款主体', request.paymentInfo.payerEntity)}${infoValue('付款方式', request.paymentInfo.method)}${infoValue('款项性质', request.paymentInfo.nature)}${infoValue('申请人 / 部门', `${request.paymentInfo.applicant} · ${request.paymentInfo.applicantDept}`)}${infoValue('汇率 / 本位币', `${request.amountInfo.exchangeRate} · ${request.amountInfo.baseCurrencyAmount}`)}${infoValue('用途说明', request.narrative.purpose)}${infoValue('费用明细说明', request.narrative.feeDetail)}${infoValue('补充说明', request.narrative.supplement)}</dl><p class="mt-2 text-xs text-slate-500">${request.currency === 'RMB' ? `金额大写：${escapeHtml(formatPmsAmountUpper(request.payableAmount))}` : `金额大写仅对 RMB 展示（当前 ${escapeHtml(request.currency)}）`}</p></section>`
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="请款单详情" data-pms-pay-detail-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭详情"></button><section class="relative z-10 flex h-full w-[820px] max-w-[95vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(request.requestNo)} · ${escapeHtml(request.objectName)}</h2><p class="mt-1 flex flex-wrap gap-1">${renderPmsStatusBadge(request.status, statusTone(request.status))}${renderPmsStatusBadge(request.paymentStatus, request.paymentStatus === '已付款' ? 'green' : request.paymentStatus === '部分付款' ? 'yellow' : 'slate')}<span class="text-xs text-slate-500">${escapeHtml(request.currency)} · 编辑范围：${scope.level === 'full' ? '可修改' : scope.level === 'attachment-only' ? '仅附件备注' : '只读'}</span></p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">${renderPmsOverlayError(state.overlayError)}
    <section class="grid grid-cols-4 gap-3 rounded-lg border p-3 text-sm"><div><dt class="text-xs text-muted-foreground">应付</dt><dd class="mt-1 tabular-nums">${money(request.payableAmount)}</dd></div><div><dt class="text-xs text-muted-foreground">已请款</dt><dd class="mt-1 tabular-nums">${money(request.requestedAmount)}</dd></div><div><dt class="text-xs text-muted-foreground">已付款</dt><dd class="mt-1 tabular-nums">${money(request.paidAmount)}</dd></div><div><dt class="text-xs text-muted-foreground">待请款 / 未付</dt><dd class="mt-1 tabular-nums">${money(pendingRequest)} / ${money(pendingPay)}</dd></div></section>
    ${request.voidReason ? `<p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">已作废：${escapeHtml(request.voidReason)}</p>` : ''}
    ${actions.length > 0 ? `<section class="flex flex-wrap items-center gap-2 rounded-lg border p-4">${actions.join('')}</section>` : ''}
    ${payeeSection}
    ${paymentSection}
    ${request.narrative.feeDetail ? `<section class="rounded-lg border p-4 text-sm"><h3 class="text-sm font-semibold">费用明细说明</h3><p class="mt-2 text-slate-600">${escapeHtml(request.narrative.feeDetail)}</p></section>` : ''}
    <section><h3 class="mb-2 text-sm font-semibold">来源对账</h3><div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">对账记录</th><th class="px-3 py-2">说明</th><th class="px-3 py-2">金额</th></tr></thead><tbody>${request.sourceRows.map((row) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm"><div class="flex items-center gap-3">${sourceMaterialThumbnail(row.sourceId)}<span>${escapeHtml(row.sourceId)}</span></div></td><td class="px-3 py-2 text-sm">${escapeHtml(row.sourceLabel)}</td><td class="px-3 py-2 text-sm tabular-nums">${money(row.amount)}</td></tr>`).join('')}</tbody></table></div></section>
    <section><h3 class="mb-2 text-sm font-semibold">请款记录（${request.requestRecords.length}）</h3><div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">时间</th><th class="px-3 py-2">金额</th><th class="px-3 py-2">方式</th><th class="px-3 py-2">操作人 / 备注</th></tr></thead><tbody>${recordRows(request.requestRecords, money, false)}</tbody></table></div></section>
    <section><h3 class="mb-2 text-sm font-semibold">付款记录（${request.paymentRecords.length}）</h3><div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">时间</th><th class="px-3 py-2">金额</th><th class="px-3 py-2">方式</th><th class="px-3 py-2">凭证号</th><th class="px-3 py-2">操作人 / 备注</th></tr></thead><tbody>${recordRows(request.paymentRecords, money, true)}</tbody></table></div></section>
    <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">备注与附件</h3><label class="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">备注<input class="h-9 rounded-md border bg-background px-2 text-sm ${scope.level === 'readonly' ? 'bg-slate-100' : ''}" value="${escapeHtml(request.remark)}" ${scope.level === 'readonly' ? 'disabled' : ''} data-${EVENT_PREFIX}-remark data-skip-page-rerender="true" /></label>${scope.level === 'readonly' ? '' : `<div class="mt-2">${renderSecondaryButton('保存备注', { prefix: EVENT_PREFIX, action: 'save-remark' }, 'check-check').replace('<button', `<button data-request-no="${escapeHtml(requestNo)}"`)}</div>`}<ul class="mt-3 space-y-1 text-xs">${request.attachments.length > 0 ? request.attachments.map((attachment, index) => `<li class="flex items-center justify-between gap-2 rounded-md border px-3 py-2"><span>${escapeHtml(attachment.name)}${attachment.description ? `<span class="ml-2 text-slate-500">${escapeHtml(attachment.description)}</span>` : ''}</span><span class="flex items-center gap-2 text-slate-500">${escapeHtml(attachment.uploadedBy)} · ${formatPmsTime(attachment.uploadedAt)}${scope.level === 'readonly' ? '' : `<button type="button" class="text-left text-xs text-red-700 hover:underline" data-${EVENT_PREFIX}-action="remove-attachment" data-request-no="${escapeHtml(requestNo)}" data-index="${index}" data-skip-page-rerender="true">${state.armedAttachmentIndex === index ? '确认删除附件' : '删除'}</button>`}</span></li>`).join('') : '<li class="rounded-md border bg-muted/30 px-3 py-2 text-muted-foreground">暂无附件</li>'}</ul></section>
    <section><h3 class="mb-2 text-sm font-semibold">操作日志</h3><ul class="space-y-2">${logItems}</ul></section>
  </div></section></div>`
}

function renderSubOverlay(): string {
  if (!state.subOverlay || !state.detailNo) return ''
  const request = getPmsPaymentRequest(state.detailNo)
  if (!request) return ''
  const money = (value: number) => formatPmsMoney(value, request.currency === 'USD' ? 'USD' : 'RMB')
  if (state.subOverlay.kind === 'request') {
    const pending = Math.max(0, request.payableAmount - request.requestedAmount)
    return `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="提交请款" data-pms-pay-request-root><section class="w-full max-w-lg rounded-xl bg-background p-5 shadow-2xl"><h2 class="font-semibold">提交请款 · ${escapeHtml(request.requestNo)}</h2><p class="mt-1 text-xs text-slate-500">待请款 ${money(pending)}；累计已请款不得超过应付金额</p>${renderPmsOverlayError(state.overlayError)}<div class="mt-3 grid grid-cols-2 gap-3"><label class="flex flex-col gap-1 text-xs text-muted-foreground">本次请款金额<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0.01" step="0.01" value="${pending}" data-${EVENT_PREFIX}-request-amount data-skip-page-rerender="true" /></label><label class="flex flex-col gap-1 text-xs text-muted-foreground">付款日期<input class="h-9 rounded-md border bg-background px-2 text-sm" type="date" value="2026-06-20" data-${EVENT_PREFIX}-request-date data-skip-page-rerender="true" /></label><label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">财务备注<input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="选填，如请款说明" data-${EVENT_PREFIX}-request-note data-skip-page-rerender="true" /></label></div><footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-sub' }, 'x')}${renderPrimaryButton('确认请款', { prefix: EVENT_PREFIX, action: 'submit-request' }, 'check-check')}</footer></section></div>`
  }
  if (state.subOverlay.kind === 'pay') {
    const pending = Math.max(0, request.requestedAmount - request.paidAmount)
    return `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="付款登记" data-pms-pay-register-root><section class="w-full max-w-lg rounded-xl bg-background p-5 shadow-2xl"><h2 class="font-semibold">付款登记 · ${escapeHtml(request.requestNo)}</h2><p class="mt-1 text-xs text-slate-500">未付金额 ${money(pending)}；付款金额不得超过未付金额</p>${renderPmsOverlayError(state.overlayError)}<div class="mt-3 grid grid-cols-2 gap-3"><label class="flex flex-col gap-1 text-xs text-muted-foreground">付款金额<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0.01" step="0.01" value="${pending}" data-${EVENT_PREFIX}-pay-amount data-skip-page-rerender="true" /></label><label class="flex flex-col gap-1 text-xs text-muted-foreground">付款方式<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-pay-method data-skip-page-rerender="true">${['银行转账', '承兑', '现金'].map((value) => `<option value="${value}">${value}</option>`).join('')}</select></label><label class="flex flex-col gap-1 text-xs text-muted-foreground">付款日期<input class="h-9 rounded-md border bg-background px-2 text-sm" type="date" value="2026-06-20" data-${EVENT_PREFIX}-pay-date data-skip-page-rerender="true" /></label><label class="flex flex-col gap-1 text-xs text-muted-foreground">凭证号<input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="如 BK-20260620-001" data-${EVENT_PREFIX}-pay-voucher data-skip-page-rerender="true" /></label><label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">付款备注<input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="选填" data-${EVENT_PREFIX}-pay-note data-skip-page-rerender="true" /></label></div><footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-sub' }, 'x')}${renderPrimaryButton('确认付款', { prefix: EVENT_PREFIX, action: 'submit-pay' }, 'check-check')}</footer></section></div>`
  }
  if (state.subOverlay.kind === 'void') {
    return `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="作废请款单" data-pms-pay-void-root><section class="w-full max-w-lg rounded-xl bg-background p-5 shadow-2xl"><h2 class="font-semibold">作废 ${escapeHtml(request.requestNo)}</h2><p class="mt-1 text-xs text-slate-500">作废后释放来源对账，可重新生成请款单；已有付款记录不能作废。</p>${renderPmsOverlayError(state.overlayError)}<label class="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">作废原因（必填）<textarea class="min-h-24 rounded-md border bg-background p-2 text-sm" data-${EVENT_PREFIX}-void-reason data-skip-page-rerender="true"></textarea></label><footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-sub' }, 'x')}${renderPrimaryButton('确认作废', { prefix: EVENT_PREFIX, action: 'submit-void' }, 'check-check')}</footer></section></div>`
  }
  return `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="添加附件" data-pms-pay-attachment-root><section class="w-full max-w-lg rounded-xl bg-background p-5 shadow-2xl"><h2 class="font-semibold">添加附件 · ${escapeHtml(request.requestNo)}</h2><p class="mt-1 text-xs text-slate-500">原型仅登记附件名称与上传人时间，不保存真实文件。</p>${renderPmsOverlayError(state.overlayError)}<div class="mt-3 grid grid-cols-2 gap-3"><label class="flex flex-col gap-1 text-xs text-muted-foreground">附件名称<input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="如 付款回单-0616.jpg" data-${EVENT_PREFIX}-attachment-name data-skip-page-rerender="true" /></label><label class="flex flex-col gap-1 text-xs text-muted-foreground">附件说明<input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="选填" data-${EVENT_PREFIX}-attachment-description data-skip-page-rerender="true" /></label></div><footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-sub' }, 'x')}${renderPrimaryButton('保存附件', { prefix: EVENT_PREFIX, action: 'submit-attachment' }, 'check-check')}</footer></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-pay-column-overlays>${controller.renderColumnSettings()}</div>`
  const parts = [columnSettings]
  if (state.draft) parts.push(renderDraftOverlay(state.draft))
  if (state.detailNo) parts.push(renderDetailOverlay(state.detailNo))
  parts.push(renderSubOverlay())
  parts.push(renderPmsImagePreview())
  return parts.join('')
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: false,
    title: pageTitle(),
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2"><span class="text-xs text-muted-foreground">未请款可修改备注与附件；部分/已请款仅可补充附件备注；已完成/已作废只读</span>${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-pay-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-pay-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-pay-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-pay-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function handleSubAction(action: string): boolean {
  const requestNo = state.detailNo
  if (!requestNo) return true
  const overlaySelector = state.subOverlay?.kind === 'request'
    ? '[data-pms-pay-request-root]'
    : state.subOverlay?.kind === 'pay'
      ? '[data-pms-pay-register-root]'
      : state.subOverlay?.kind === 'void'
        ? '[data-pms-pay-void-root]'
        : '[data-pms-pay-attachment-root]'
  const surface = rootElement()?.querySelector<HTMLElement>(overlaySelector)
  try {
    if (action === 'submit-request') {
      if (!surface) return true
      const request = submitPmsPaymentRequest(
        requestNo,
        readNumberField(surface, `[data-${EVENT_PREFIX}-request-amount]`),
        FINANCE,
        readTextField(surface, `[data-${EVENT_PREFIX}-request-note]`),
        readTextField(surface, `[data-${EVENT_PREFIX}-request-date]`),
      )
      state.feedback = `${requestNo} 已提交请款，当前状态 ${request.status}。`
      state.feedbackOk = true
    } else if (action === 'submit-pay') {
      if (!surface) return true
      const amount = readNumberField(surface, `[data-${EVENT_PREFIX}-pay-amount]`)
      const method = readTextField(surface, `[data-${EVENT_PREFIX}-pay-method]`) as '银行转账' | '承兑' | '现金'
      const note = readTextField(surface, `[data-${EVENT_PREFIX}-pay-note]`)
      const voucherNo = readTextField(surface, `[data-${EVENT_PREFIX}-pay-voucher]`)
      const paidAt = readTextField(surface, `[data-${EVENT_PREFIX}-pay-date]`)
      const request = registerPmsPayment(requestNo, { amount, method, note, voucherNo, paidAt }, FINANCE)
      state.feedback = `${requestNo} 付款登记成功，付款状态 ${request.paymentStatus}。`
      state.feedbackOk = true
    } else if (action === 'submit-void') {
      if (!surface) return true
      const reason = readTextField(surface, `[data-${EVENT_PREFIX}-void-reason]`)
      voidPmsPaymentRequest(requestNo, reason, FINANCE)
      state.feedback = `${requestNo} 已作废，来源对账已释放。`
      state.feedbackOk = true
      state.detailNo = ''
    } else if (action === 'submit-attachment') {
      if (!surface) return true
      const name = readTextField(surface, `[data-${EVENT_PREFIX}-attachment-name]`)
      const description = readTextField(surface, `[data-${EVENT_PREFIX}-attachment-description]`)
      addPmsPaymentAttachment(requestNo, name, FINANCE, description)
      state.feedback = `${requestNo} 已添加附件 ${name}。`
      state.feedbackOk = true
    }
    state.subOverlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '操作失败'
    refreshOverlays()
  }
  return true
}

function readDraftInfo(): PmsPaymentRequestInfoInput {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-pay-draft-root]')
  if (!surface) return {}
  const text = (name: string) => readTextField(surface, `[data-${EVENT_PREFIX}-draft-field="${name}"]`)
  const number = (name: string) => readNumberField(surface, `[data-${EVENT_PREFIX}-draft-field="${name}"]`)
  return {
    payee: {
      name: text('payeeName'),
      shortName: text('payeeShortName'),
      currency: text('payeeCurrency') as 'RMB' | 'USD' | 'IDR',
      bankName: text('payeeBankName'),
      bankAccount: text('payeeBankAccount'),
      swiftCode: text('payeeSwiftCode'),
      address: text('payeeAddress'),
      contactName: text('payeeContactName'),
      contactPhone: text('payeeContactPhone'),
    },
    paymentInfo: {
      paymentType: text('paymentType') as '全款' | '部分付款',
      payerEntity: text('payerEntity'),
      method: text('paymentMethod') as '银行转账' | '承兑' | '现金',
      nature: text('paymentNature') as '材料款' | '物流费' | '其他',
      applicant: text('applicant'),
      applicantDept: text('applicantDept'),
      note: text('paymentNote'),
    },
    amountInfo: {
      exchangeRate: number('exchangeRate'),
      baseCurrencyAmount: number('baseCurrencyAmount'),
    },
    narrative: {
      purpose: text('purpose'),
      supplement: text('supplement'),
    },
  }
}

function createFromDraft(): void {
  if (!state.draft) return
  try {
    const request = createPmsPaymentRequestFromDraft(state.draft, FINANCE, readDraftInfo())
    state.feedback = `已创建请款单 ${request.requestNo}（${request.objectName} · ${request.payableAmount} ${request.currency}），状态为未请款。`
    state.feedbackOk = true
    state.draft = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '创建请款单失败'
    refreshOverlays()
  }
}

function exportRows(): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前查询条件下没有可导出的请款单。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    state.type === 'material' ? '面辅料采购请款.csv' : '物流费用请款.csv',
    ['请款单', '付款对象', '币种', '应付金额', '已请款', '待请款', '已付款', '请款状态', '付款状态', '来源对账', '附件数', '创建人', '创建时间'],
    rows.map((row) => [row.requestNo, row.objectName, row.currency, row.payableAmount, row.requestedAmount, Math.max(0, row.payableAmount - row.requestedAmount), row.paidAmount, row.status, row.paymentStatus, row.sourceRows.map((source) => source.sourceId).join('、'), row.attachments.length, row.createdBy, row.createdAt]),
  )
  state.feedback = `已导出 ${rows.length} 张请款单（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

function renderPage(type: PmsPaymentRequestType): string {
  state.type = type
  state.detailNo = ''
  state.subOverlay = null
  state.armedAttachmentIndex = -1
  state.overlayError = ''
  state.feedback = ''
  state.feedbackOk = true
  const consumedDraft = consumePmsPaymentDraft(type)
  if (consumedDraft) state.draft = consumedDraft
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-pay-root data-skip-page-rerender="true"><style>[data-pms-pay-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function renderPmsMaterialPaymentRequestsPage(): string {
  return renderPage('material')
}

export function renderPmsLogisticsPaymentRequestsPage(): string {
  return renderPage('logistics')
}

export function closePmsPaymentRequestOverlays(): boolean {
  state.armedAttachmentIndex = -1
  if (state.subOverlay) {
    state.subOverlay = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (state.draft) {
    state.draft = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (state.detailNo) {
    state.detailNo = ''
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

export function handlePmsPaymentRequestsEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape') {
    if (state.subOverlay || state.draft || state.detailNo) return closePmsPaymentRequestOverlays()
    return false
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsPayField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as PaymentPageState['status']
      return true
    }
    if (fieldName === 'paymentStatus') {
      state.paymentStatus = field.value as PaymentPageState['paymentStatus']
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
  const action = actionNode?.dataset.pmsPayAction
  if (!action) return false
  if (action !== 'remove-attachment') state.armedAttachmentIndex = -1
  if (action === 'query') {
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.status = ''
    state.paymentStatus = ''
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'export') {
    exportRows()
    return true
  }
  if (action === 'save-info') {
    const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-pay-detail-root]')
    if (!surface) return true
    const read = (name: string) => readTextField(surface, `[data-${EVENT_PREFIX}-info-field="${name}"]`)
    try {
      updatePmsPaymentRequestInfo(actionNode?.dataset.requestNo || '', {
        payee: {
          name: read('payeeName'),
          shortName: read('payeeShortName'),
          bankName: read('payeeBankName'),
          bankAccount: read('payeeBankAccount'),
          swiftCode: read('payeeSwiftCode'),
          address: read('payeeAddress'),
          contactName: read('payeeContactName'),
          contactPhone: read('payeeContactPhone'),
        },
        paymentInfo: {
          paymentType: read('paymentType') as '全款' | '部分付款',
          payerEntity: read('payerEntity'),
          method: read('paymentMethod') as '银行转账' | '承兑' | '现金',
          nature: read('paymentNature') as '材料款' | '物流费' | '其他',
          applicant: read('applicant'),
          applicantDept: read('applicantDept'),
          note: read('paymentNote'),
        },
        amountInfo: {
          exchangeRate: readNumberField(surface, `[data-${EVENT_PREFIX}-info-field="exchangeRate"]`),
          baseCurrencyAmount: readNumberField(surface, `[data-${EVENT_PREFIX}-info-field="baseCurrencyAmount"]`),
        },
        narrative: { purpose: read('purpose') },
      }, FINANCE)
      state.feedback = `${actionNode?.dataset.requestNo} 请款信息已保存。`
      state.feedbackOk = true
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '保存请款信息失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'remove-attachment') {
    const requestNo = actionNode?.dataset.requestNo || ''
    const index = Number.parseInt(actionNode?.dataset.index || '', 10)
    if (state.armedAttachmentIndex !== index) {
      state.armedAttachmentIndex = index
      state.overlayError = ''
      refreshOverlays()
      return true
    }
    try {
      removePmsPaymentAttachment(requestNo, index, FINANCE)
      state.feedback = `${requestNo} 附件已删除。`
      state.feedbackOk = true
      state.armedAttachmentIndex = -1
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.armedAttachmentIndex = -1
      state.overlayError = error instanceof PmsDomainError ? error.message : '删除附件失败'
      refreshOverlays()
    }
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
    const key = actionNode?.closest<HTMLElement>('[data-pms-pay-column-key]')?.dataset.pmsPayColumnKey || ''
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
    state.detailNo = actionNode?.dataset.requestNo || ''
    state.subOverlay = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'create-request') {
    createFromDraft()
    return true
  }
  if (action === 'discard-draft') {
    state.draft = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-request' || action === 'open-pay' || action === 'open-void' || action === 'open-attachment') {
    state.subOverlay = { kind: action === 'open-request' ? 'request' : action === 'open-pay' ? 'pay' : action === 'open-void' ? 'void' : 'attachment' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'close-sub') {
    state.subOverlay = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'save-remark') {
    const root = rootElement()
    if (!root) return true
    try {
      updatePmsPaymentRemark(actionNode?.dataset.requestNo || '', readTextField(root, `[data-${EVENT_PREFIX}-remark]`), FINANCE)
      state.feedback = `${actionNode?.dataset.requestNo} 备注已保存。`
      state.feedbackOk = true
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '保存备注失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'submit-request' || action === 'submit-pay' || action === 'submit-void' || action === 'submit-attachment') {
    return handleSubAction(action)
  }
  if (action === 'close-overlay') {
    closePmsPaymentRequestOverlays()
    return true
  }
  return false
}
