// @page-pattern: list
import { confirmPmsAction } from './shared.ts'
import { renderRealQrPlaceholder, hydrateRealQRCodes } from '../../components/real-qr.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  addPmsConfirmationBoxSpec,
  hydratePmsSupplierConfirmationsFromIdb,
  savePmsConfirmationShipment,
  synchronizePmsSupplierConfirmations,
  addPmsConfirmationPackageDetail,
  calculatePmsBoxVolume,
  checkPmsConfirmation,
  confirmPmsSupplierConfirmation,
  derivePmsLabelStatus,
  generatePmsConfirmationLabels,
  generatePmsConfirmationRolls,
  getPmsSupplierConfirmation,
  listPmsSupplierConfirmations,
  printPmsConfirmationLabels,
  recordPmsConfirmationLabelDownload,
  removePmsConfirmationBoxSpec,
  removePmsConfirmationPackageDetail,
  summarizePmsConfirmationLabels,
  type PmsConfirmationBoxSpec,
  type PmsConfirmationPackageDetail,
  type PmsConfirmationRoll,
  type PmsLabelStatus,
  type PmsSupplierConfirmation,
} from '../../data/pms/supplier-confirmations.ts'
import { hydratePmsMaterialPurchaseOrdersFromIdb, getPmsMaterialPurchaseOrder } from '../../data/pms/material-purchase-orders.ts'
import { listPmsLogs, hydratePmsLogsFromIdb, nextPmsActionId, PMS_BUYER_ACTOR, PMS_MANAGER_ACTOR, PmsDomainError } from '../../data/pms/runtime.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import {
  formatPmsQty,
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

type ConfirmationOverlay =
  | null
  | { kind: 'rolls'; confirmationNo: string; clientActionId: string; confirmArmed: boolean; armedDeleteBoxNo: string; armedDeletePackageDetailNo: string; saveConfirmArmed?:boolean; saveConfirmQty?:number; saveConfirmPackageCount?:number }
  | {kind:'view';confirmationNo:string}
  | {kind:'logs';confirmationNo:string}
  | { kind: 'label'; confirmationNo: string; rollNo: string; clientActionId: string; returnToView?: boolean }

interface ConfirmationPageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | PmsSupplierConfirmation['status']
  searchField: string
  supplierFilter: string
  categoryFilter: string
  packageFilter: string
  labelFilter: string
  operatorFilter: string
  fromDate: string
  toDate: string
  overlay: ConfirmationOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-conf'
const ROOT_SELECTOR = '[data-pms-conf-root]'

let busy = false
let dirty = false
const selected = new Set<string>()

const state: ConfirmationPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 5 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
  searchField:'confirm_no',supplierFilter:'',categoryFilter:'',packageFilter:'',labelFilter:'',operatorFilter:'',fromDate:'',toDate:'',
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsSupplierConfirmation[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsSupplierConfirmations().filter((confirmation) => {
    if (state.status && confirmation.status !== state.status) return false
    if (state.supplierFilter && confirmation.supplierName !== state.supplierFilter) return false
    if (state.categoryFilter && getPmsMaterialPurchaseOrder(confirmation.purchaseOrderNo)?.materialType !== state.categoryFilter) return false
    if (state.packageFilter && confirmation.packageUnit !== state.packageFilter) return false
    if (state.labelFilter && summarizePmsConfirmationLabels(confirmation) !== state.labelFilter) return false
    if (state.operatorFilter && !confirmation.editor.includes(state.operatorFilter)) return false
    if (state.fromDate && confirmation.updatedAt.slice(0,10) < state.fromDate) return false
    if (state.toDate && confirmation.updatedAt.slice(0,10) > state.toDate) return false
    if (!keyword) return true
    const value = state.searchField === 'purchase_order_no' ? confirmation.purchaseOrderNo : state.searchField === 'sku' ? confirmation.materialCode : state.searchField === 'name' ? confirmation.materialName : confirmation.confirmationNo
    return value.toLowerCase().includes(keyword)
  })
}

function confirmationTone(status: PmsSupplierConfirmation['status']): 'blue' | 'green' | 'yellow' {
  if (status === '已确认') return 'green'
  if (status === '已编辑') return 'blue'
  return 'yellow'
}

function labelTone(status: PmsLabelStatus): 'blue' | 'green' | 'yellow' | 'red' | 'slate' {
  if (status === '已打印' || status === '已重打') return 'green'
  if (status === '已生成' || status === '部分打印') return 'blue'
  if (status === '异常') return 'red'
  return 'slate'
}

const columns: StandardListColumn<PmsSupplierConfirmation>[] = [
  {key:'selection',title:'选择',width:54,required:true,render:row => `<input type="checkbox" aria-label="选择 ${escapeHtml(row.confirmationNo)}" ${selected.has(row.confirmationNo) ? 'checked' : ''} data-pms-conf-select="${escapeHtml(row.confirmationNo)}" data-skip-page-rerender="true">`},
  {
    key: 'confirmation',
    title: '确认单 / 状态',
    width: 210,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.confirmationNo,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.confirmationNo)}</div><div class="mt-1">${renderPmsStatusBadge(row.status, confirmationTone(row.status))}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.editor)} · ${formatPmsTime(row.updatedAt)}</div>${row.confirmedBy ? `<div class="mt-1 text-xs text-slate-500">确认人 ${escapeHtml(row.confirmedBy)}</div>` : ''}`,
  },
  {
    key: 'material',
    title: '物料与采购单',
    width: 280,
    required: true,
    freezeable: true,
    render: (row) => `<div class="flex items-center gap-3">${renderPmsBusinessImage(row.materialImageUrl, `${row.materialName}（${row.materialCode}）实物图`, 'h-12 w-12')}<div><div class="font-medium">${escapeHtml(row.materialName)}</div><div class="text-xs text-slate-500">${escapeHtml(row.purchaseOrderNo)} · ${escapeHtml(row.unit)}</div><div class="mt-1 flex items-center gap-2 text-xs text-slate-500">${renderPmsBusinessImage(row.styleImageUrl, `${row.styleName}款式图`, 'h-6 w-6')}<span>${escapeHtml(row.styleName)} · ${escapeHtml(row.styleCode)}</span></div></div></div>`,
  },
  {
    key: 'supplier',
    title: '供应商 / 来源',
    width: 190,
    sortable: true,
    sortValue: (row) => row.supplierName,
    render: (row) => `<div class="font-medium">${escapeHtml(row.supplierName)}</div><div class="mt-1 text-xs text-slate-500">入库单 ${escapeHtml(row.inboundNo)}</div><div class="mt-1 text-xs text-slate-500">关联 ${escapeHtml(row.relationNo)}</div>`,
  },
  {
    key: 'packages',
    title: '包装与标签',
    width: 220,
    render: (row) => {
      if (row.rolls.length === 0) return '<span class="text-xs text-amber-700">未生成包装明细</span>'
      const labelStatus = summarizePmsConfirmationLabels(row)
      const generated = row.rolls.filter((roll) => roll.labelNo).length
      const printed = row.rolls.filter((roll) => roll.printCount > 0).length
      return `<div class="text-sm">${row.rolls.length} 个包装 · 每包装 ${formatPmsQty(row.packageQty, row.packageUnit)}</div><div class="mt-1">${renderPmsStatusBadge(labelStatus, labelTone(labelStatus))}</div><div class="mt-1 text-xs text-slate-500">已生成 ${generated} · 已打印 ${printed}</div>`
    },
  },
  {
    key: 'actions',
    title: '操作',
    width: 150,
    actionColumn: true,
    render: (row) => `<div class="flex items-center justify-end gap-1.5"><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-rolls" data-confirmation-no="${escapeHtml(row.confirmationNo)}" data-skip-page-rerender="true">编辑</button><button type="button" class="text-xs text-blue-700" data-${EVENT_PREFIX}-action="open-view" data-confirmation-no="${escapeHtml(row.confirmationNo)}" data-skip-page-rerender="true">查看</button><button type="button" class="text-xs text-blue-700" data-${EVENT_PREFIX}-action="open-logs" data-confirmation-no="${escapeHtml(row.confirmationNo)}" data-skip-page-rerender="true">操作日志</button></div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/material-supplier-confirmations',
  pageSizeOptions: [5,10,20],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-conf-table-surface]',
  paginationSurfaceSelector: '[data-pms-conf-pagination-content]',
  overlaysSurfaceSelector: '[data-pms-conf-overlays]',
  defaultFrozenKeys: ['confirmation', 'material'],
  columnSettingsTitle: '供应商确认单列设置',
  emptyText: '当前条件下暂无供应商确认单',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  const select = (key:string,label:string,value:string,options:string[]) => `<label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">${label}</span><select class="h-9 w-full rounded border bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="${key}" data-skip-page-rerender="true"><option value="">全部</option>${options.map(option=>`<option value="${escapeHtml(option)}" ${value===option?'selected':''}>${escapeHtml(option)}</option>`).join('')}</select></label>`
  const input = (key:string,label:string,value:string,type='text') => `<label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">${label}</span><input type="${type}" value="${escapeHtml(value)}" class="h-9 w-full rounded border px-2 text-sm" data-${EVENT_PREFIX}-field="${key}" data-skip-page-rerender="true"></label>`
  const count = [state.supplierFilter,state.categoryFilter,state.packageFilter,state.labelFilter,state.operatorFilter,state.fromDate,state.toDate].filter(Boolean).length
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid grid-cols-2 gap-3 lg:grid-cols-4"><label><span class="mb-1 block text-xs text-muted-foreground">检索字段</span><select class="h-9 w-full rounded border px-2" data-${EVENT_PREFIX}-field="searchField" data-skip-page-rerender="true">${[['confirm_no','确认单号'],['purchase_order_no','采购单号'],['sku','SKU'],['name','物料名称']].map(([value,label])=>`<option value="${value}" ${state.searchField===value?'selected':''}>${label}</option>`).join('')}</select></label>${input('keyword','关键词',state.keyword)}${select('status','确认状态',state.status,['待确认','已编辑','已确认'])}</div><div class="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4" data-process-advanced ${count?'':'hidden'}>${select('supplierFilter','供应商',state.supplierFilter,[...new Set(listPmsSupplierConfirmations().map(row=>row.supplierName))])}${select('categoryFilter','物料分类',state.categoryFilter,['面料','辅料','纱线','包材','耗材'])}${select('packageFilter','包装单位',state.packageFilter,[...new Set(listPmsSupplierConfirmations().map(row=>row.packageUnit))])}${select('labelFilter','标签状态',state.labelFilter,['未生成','已生成','已打印','部分打印','已重打','异常'])}${input('operatorFilter','最近操作人',state.operatorFilter)}${input('fromDate','更新开始日期',state.fromDate,'date')}${input('toDate','更新结束日期',state.toDate,'date')}</div><div class="mt-3 flex gap-2" data-process-filter-actions>${renderPrimaryButton('查询',{prefix:EVENT_PREFIX,action:'query'},'search')}${renderSecondaryButton('重置',{prefix:EVENT_PREFIX,action:'reset'},'rotate-ccw')}${renderSecondaryButton('导出',{prefix:EVENT_PREFIX,action:'export'},'download')}${renderProcessFilterToggle(count,'button')}</div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  return renderProcessOrderStats([
    { label: '确认单总数', value: rows.length },
    { label: '待确认 / 已编辑', value: rows.filter((row) => row.status !== '已确认').length },
    { label: '包装总数', value: rows.reduce((sum, row) => sum + row.rolls.length, 0) },
    { label: '已打印标签', value: rows.reduce((sum, row) => sum + row.rolls.filter((roll) => roll.printCount > 0).length, 0) },
  ])
}

function readOptionalNumberField(scope: ParentNode, selector: string): number | undefined {
  const field = scope.querySelector<HTMLInputElement>(selector)
  if (!field || !field.value.trim()) return undefined
  return Number(field.value)
}

function formatPmsVolume(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 4 }).format(value)
}

function previewRollCount(confirmation: PmsSupplierConfirmation, metersPerRoll: number): number {
  const order = getPmsMaterialPurchaseOrder(confirmation.purchaseOrderNo)
  if (!order || !Number.isFinite(metersPerRoll) || metersPerRoll <= 0) return 0
  return Math.max(1, Math.ceil(order.orderedQty / metersPerRoll))
}

function syncRollCountPreview(target: HTMLElement): void {
  const surface = target.closest<HTMLElement>('[data-pms-conf-rolls-root]')
  const confirmation = state.overlay?.kind === 'rolls' ? getPmsSupplierConfirmation(state.overlay.confirmationNo) : undefined
  if (!surface || !confirmation) return
  const countField = surface.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-rolls-count]`)
  if (!countField) return
  const meters = readNumberField(surface, `[data-${EVENT_PREFIX}-rolls-meters]`)
  const count = previewRollCount(confirmation, meters)
  countField.value = count > 0 ? String(count) : ''
}

function syncBoxVolumePreview(target: HTMLElement): void {
  const surface = target.closest<HTMLElement>('[data-pms-conf-rolls-root]')
  if (!surface) return
  const volumeField = surface.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-box-volume]`)
  if (!volumeField) return
  const length = readNumberField(surface, `[data-${EVENT_PREFIX}-box-length]`)
  const width = readNumberField(surface, `[data-${EVENT_PREFIX}-box-width]`)
  const height = readNumberField(surface, `[data-${EVENT_PREFIX}-box-height]`)
  if (Number.isFinite(length) && length > 0 && Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    volumeField.value = String(calculatePmsBoxVolume(length, width, height))
  } else {
    volumeField.value = ''
  }
}

function downloadPmsLabelPng(confirmation: PmsSupplierConfirmation, roll: PmsConfirmationRoll): boolean {
  if (typeof document === 'undefined') return false
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 440
  const context = canvas.getContext('2d')
  if (!context) return false
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = '#0f172a'
  context.lineWidth = 4
  context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)
  context.fillStyle = '#0f172a'
  context.font = 'bold 30px sans-serif'
  context.fillText('面辅料包装标签', 36, 68)
  context.font = '24px sans-serif'
  const boxSpec = confirmation.boxSpecs.find((spec) => spec.boxNo === roll.boxNo)
  const lines = [
    `卷号：${roll.rollNo}`,
    `物料：${confirmation.materialName}（${confirmation.materialCode}）`,
    `数量：${formatPmsQty(roll.qty, confirmation.packageUnit)}`,
    `箱号：${roll.boxNo}${boxSpec ? ` · ${boxSpec.length}×${boxSpec.width}×${boxSpec.height}cm` : ''}`,
    `采购单：${confirmation.purchaseOrderNo}`,
    `供应商：${confirmation.supplierName}`,
  ]
  lines.forEach((line, index) => context.fillText(line, 36, 128 + index * 44))
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = `${roll.rollNo}-标签.png`
  link.click()
  return true
}

function renderRollRow(confirmationNo: string, roll: PmsConfirmationRoll, index: number): string {
  const labelStatus = derivePmsLabelStatus(roll)
  return `<tr class="border-b last:border-b-0">
    <td class="px-3 py-2 text-sm">${index + 1}</td>
    <td class="px-3 py-2 text-sm">${escapeHtml(roll.rollNo)}</td>
    <td class="px-3 py-2 text-sm">${escapeHtml(roll.packageNo)}</td>
    <td class="px-3 py-2"><input class="h-8 w-20 rounded-md border px-2 text-sm" value="${escapeHtml(roll.boxNo)}" data-${EVENT_PREFIX}-roll-box="${escapeHtml(roll.rollNo)}" data-skip-page-rerender="true" /></td>
    <td class="px-3 py-2"><input class="h-8 w-24 rounded-md border px-2 text-sm" type="number" min="0" step="0.01" value="${roll.qty}" data-${EVENT_PREFIX}-roll-qty="${escapeHtml(roll.rollNo)}" data-skip-page-rerender="true" /></td>
    <td class="px-3 py-2"><input class="h-8 w-20 rounded-md border px-2 text-sm" type="number" min="0" step="0.01" value="${roll.weight}" data-${EVENT_PREFIX}-roll-weight="${escapeHtml(roll.rollNo)}" data-skip-page-rerender="true" /></td>
    <td class="px-3 py-2"><input class="h-8 w-36 rounded-md border px-2 text-sm" value="${escapeHtml(roll.remark)}" data-${EVENT_PREFIX}-roll-remark="${escapeHtml(roll.rollNo)}" data-skip-page-rerender="true" /></td>
    <td class="px-3 py-2 text-xs">${roll.labelNo ? escapeHtml(roll.labelNo) : '—'}</td>
    <td class="px-3 py-2">${renderPmsStatusBadge(labelStatus, labelTone(labelStatus))}</td>
    <td class="px-3 py-2"><div class="flex items-center justify-end gap-1.5">${roll.labelNo ? `<button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-label" data-confirmation-no="${escapeHtml(confirmationNo)}" data-roll-no="${escapeHtml(roll.rollNo)}" data-skip-page-rerender="true">预览二维码</button>` : ''}<button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50" data-${EVENT_PREFIX}-action="generate-label" data-roll-no="${escapeHtml(roll.rollNo)}" data-skip-page-rerender="true" ${roll.labelNo ? 'disabled' : ''}>生成标签</button></div></td>
  </tr>`
}

function renderBoxSpecRow(spec: PmsConfirmationBoxSpec, armed: boolean): string {
  return `<tr class="border-b last:border-b-0">
    <td class="px-3 py-2 text-sm">${escapeHtml(spec.boxNo)}</td>
    <td class="px-3 py-2 text-sm">${formatPmsVolume(spec.length)}</td>
    <td class="px-3 py-2 text-sm">${formatPmsVolume(spec.width)}</td>
    <td class="px-3 py-2 text-sm">${formatPmsVolume(spec.height)}</td>
    <td class="px-3 py-2 text-sm">${formatPmsVolume(spec.volume)} cm³</td>
    <td class="px-3 py-2 text-sm">${spec.remark ? escapeHtml(spec.remark) : '—'}</td>
    <td class="px-3 py-2 text-right"><button type="button" class="text-left text-xs text-red-700 hover:underline" data-${EVENT_PREFIX}-action="delete-box-spec" data-box-no="${escapeHtml(spec.boxNo)}" data-skip-page-rerender="true">${armed ? '确认删除箱规' : '删除'}</button></td>
  </tr>`
}

function renderBoxSpecSection(confirmation: PmsSupplierConfirmation, armedBoxNo: string): string {
  const table = confirmation.boxSpecs.length > 0
    ? `<div class="mt-3 overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left" style="min-width: 760px"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="w-28 px-3 py-2">箱号</th><th class="w-20 px-3 py-2">长(cm)</th><th class="w-20 px-3 py-2">宽(cm)</th><th class="w-20 px-3 py-2">高(cm)</th><th class="w-28 px-3 py-2">体积(cm³)</th><th class="px-3 py-2">备注</th><th class="w-20 px-3 py-2 text-right">操作</th></tr></thead><tbody>${confirmation.boxSpecs.map((spec) => renderBoxSpecRow(spec, spec.boxNo === armedBoxNo)).join('')}</tbody></table></div>`
    : '<p class="mt-3 text-xs text-slate-500">还没有箱规，请填写箱号与长宽高后新增。</p>'
  return `<section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">箱规表</h3>${table}${armedBoxNo ? `<p class="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">再次点击“确认删除箱规”将删除 ${escapeHtml(armedBoxNo)}；点击其它操作会取消。</p>` : ''}
    <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-6">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">箱号<input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="如 BOX-004" data-${EVENT_PREFIX}-box-no data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">长(cm)<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0.01" step="0.01" data-${EVENT_PREFIX}-box-length data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">宽(cm)<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0.01" step="0.01" data-${EVENT_PREFIX}-box-width data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">高(cm)<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0.01" step="0.01" data-${EVENT_PREFIX}-box-height data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">体积(cm³，自动)<input class="h-9 rounded-md border bg-muted/40 px-2 text-sm" readonly data-${EVENT_PREFIX}-box-volume data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">备注<input class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-box-remark data-skip-page-rerender="true" /></label>
    </div>
    <div class="mt-3">${renderPrimaryButton('新增箱规', { prefix: EVENT_PREFIX, action: 'add-box-spec' }, 'plus')}</div></section>`
}

function renderPackageDetailRow(detail: PmsConfirmationPackageDetail, armed: boolean): string {
  return `<tr class="border-b last:border-b-0">
    <td class="px-3 py-2 text-sm">${escapeHtml(detail.packageMethod)}</td>
    <td class="px-3 py-2 text-sm">${formatPmsQty(detail.qty, detail.unit)}</td>
    <td class="px-3 py-2 text-sm">${detail.remark ? escapeHtml(detail.remark) : '—'}</td>
    <td class="px-3 py-2 text-right"><button type="button" class="text-left text-xs text-red-700 hover:underline" data-${EVENT_PREFIX}-action="delete-package-detail" data-package-detail-no="${escapeHtml(detail.packageDetailNo)}" data-skip-page-rerender="true">${armed ? '确认删除包装明细' : '删除'}</button></td>
  </tr>`
}

function renderPackageDetailSection(confirmation: PmsSupplierConfirmation, armedPackageDetailNo: string): string {
  const table = confirmation.packageDetails.length > 0
    ? `<div class="mt-3 overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left" style="min-width: 640px"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="w-40 px-3 py-2">包装方式</th><th class="w-40 px-3 py-2">数量</th><th class="px-3 py-2">备注</th><th class="w-20 px-3 py-2 text-right">操作</th></tr></thead><tbody>${confirmation.packageDetails.map((detail) => renderPackageDetailRow(detail, detail.packageDetailNo === armedPackageDetailNo)).join('')}</tbody></table></div>`
    : '<p class="mt-3 text-xs text-slate-500">还没有包装明细，可新增包装方式、数量与单位。</p>'
  const methodOptions = ['卷装', '袋装', '箱装', '托盘', '其他'].map((method) => `<option value="${method}">${method}</option>`).join('')
  return `<section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">包装明细（包模式）</h3>${table}${armedPackageDetailNo ? `<p class="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">再次点击“确认删除包装明细”将删除 ${escapeHtml(armedPackageDetailNo)}；点击其它操作会取消。</p>` : ''}
    <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">包装方式<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-package-method data-skip-page-rerender="true">${methodOptions}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">数量<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0.01" step="0.01" data-${EVENT_PREFIX}-package-qty data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">单位<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(confirmation.packageUnit)}" data-${EVENT_PREFIX}-package-unit data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">备注<input class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-package-remark data-skip-page-rerender="true" /></label>
    </div>
    <div class="mt-3">${renderPrimaryButton('新增包装明细', { prefix: EVENT_PREFIX, action: 'add-package-detail' }, 'plus')}</div></section>`
}

function renderRollsOverlay(confirmationNo: string, confirmArmed: boolean, armedDeleteBoxNo: string, armedDeletePackageDetailNo: string): string {
  const confirmation = getPmsSupplierConfirmation(confirmationNo)
  if (!confirmation) return ''
  const check = checkPmsConfirmation(confirmationNo)
  const rows = filteredRows()
  const rowIndex = rows.findIndex((row) => row.confirmationNo === confirmation.confirmationNo)
  const hasPrev = rowIndex > 0
  const hasNext = rowIndex >= 0 && rowIndex < rows.length - 1
  const order = getPmsMaterialPurchaseOrder(confirmation.purchaseOrderNo)
  const defaultMeters = confirmation.packageQty > 0 ? confirmation.packageQty : 0
  const rollCountPreview = order && defaultMeters > 0 ? Math.max(1, Math.ceil(order.orderedQty / defaultMeters)) : 0
  const rollForm = confirmation.rolls.length === 0
    ? `<section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">生成卷号</h3><div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <label class="flex flex-col gap-1 text-xs text-muted-foreground">卷号前缀<input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="如 FAB" data-${EVENT_PREFIX}-rolls-prefix data-skip-page-rerender="true" /></label>
        <label class="flex flex-col gap-1 text-xs text-muted-foreground">每包装基础数量（${escapeHtml(confirmation.unit)}）<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0.01" step="0.01" value="${defaultMeters}" data-${EVENT_PREFIX}-rolls-meters data-skip-page-rerender="true" /></label>
        <label class="flex flex-col gap-1 text-xs text-muted-foreground">每卷重量(kg，选填)<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0.01" step="0.01" data-${EVENT_PREFIX}-rolls-weight data-skip-page-rerender="true" /></label>
        <label class="flex flex-col gap-1 text-xs text-muted-foreground">起始序号<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="1" step="1" value="1" data-${EVENT_PREFIX}-rolls-start data-skip-page-rerender="true" /></label>
        <label class="flex flex-col gap-1 text-xs text-muted-foreground">卷数（自动）<input class="h-9 rounded-md border bg-muted/40 px-2 text-sm" readonly value="${rollCountPreview}" data-${EVENT_PREFIX}-rolls-count data-skip-page-rerender="true" /></label>
        <label class="flex flex-col gap-1 text-xs text-muted-foreground">每包装基础数量<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0.01" step="0.01" value="${confirmation.packageQty}" data-${EVENT_PREFIX}-rolls-qty data-skip-page-rerender="true" /></label>
        <label class="flex flex-col gap-1 text-xs text-muted-foreground">包装单位<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(confirmation.packageUnit)}" data-${EVENT_PREFIX}-rolls-unit data-skip-page-rerender="true" /></label>
        <label class="flex flex-col gap-1 text-xs text-muted-foreground">箱数<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="1" step="1" value="2" data-${EVENT_PREFIX}-rolls-boxes data-skip-page-rerender="true" /></label>
      </div><p class="mt-2 text-xs text-slate-500">尾包装保留实际余量。</p><div class="mt-3">${renderPrimaryButton('生成卷号', { prefix: EVENT_PREFIX, action: 'generate-rolls' }, 'package-plus')}</div></section>`
    : ''
  const rollTable = confirmation.rolls.length > 0
    ? `<div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left" style="min-width: 1200px"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="w-12 px-3 py-2">#</th><th class="w-32 px-3 py-2">卷号</th><th class="w-32 px-3 py-2">包装号</th><th class="w-24 px-3 py-2">箱号</th><th class="w-28 px-3 py-2">基础数量（${escapeHtml(confirmation.unit)}）</th><th class="w-24 px-3 py-2">重量(kg)</th><th class="w-40 px-3 py-2">备注</th><th class="w-32 px-3 py-2">标签号</th><th class="w-24 px-3 py-2">标签状态</th><th class="w-48 px-3 py-2 text-right">操作</th></tr></thead><tbody>${confirmation.rolls.map((roll, index) => renderRollRow(confirmation.confirmationNo, roll, index)).join('')}</tbody></table></div>`
    : ''
  const boxSpecSection = renderBoxSpecSection(confirmation, armedDeleteBoxNo)
  const packageDetailSection = renderPackageDetailSection(confirmation, armedDeletePackageDetailNo)
  const confirmPanel = confirmation.rolls.length > 0
    ? `<section class="rounded-lg border p-4"><div class="flex flex-wrap items-center gap-2">
        ${renderSecondaryButton('保存明细修改', { prefix: EVENT_PREFIX, action: 'save-rolls' }, 'check-check')}
        ${renderSecondaryButton('生成未生成标签', { prefix: EVENT_PREFIX, action: 'generate-labels' }, 'tags')}
        ${renderSecondaryButton('打印全部已生成标签', { prefix: EVENT_PREFIX, action: 'print-labels' }, 'printer')}
        ${renderPrimaryButton(confirmArmed ? '确认供应商发货' : '供应商确认', { prefix: EVENT_PREFIX, action: 'confirm-supplier' }, 'check-check').replace('<button', `<button ${check.ok ? '' : 'disabled'}`)}
      </div>${confirmArmed ? '<p class="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">确认供应商发货，并更新关联采购单的供应商确认状态。</p>' : ''}${check.ok ? '' : `<p class="mt-2 text-xs text-amber-700">当前不能确认：${escapeHtml(check.reason)}</p>`}<p class="mt-2 text-xs text-slate-500">修改已确认的发货信息后需重新确认。</p></section>`
    : ''
  const navigation = `<div class="flex items-center gap-2">${renderSecondaryButton('上一张', { prefix: EVENT_PREFIX, action: 'prev-confirmation' }, 'chevron-left').replace('<button', `<button ${hasPrev ? '' : 'disabled'}`)}<span class="text-xs text-slate-500">第 ${rowIndex + 1} / ${rows.length} 张</span>${renderSecondaryButton('下一张', { prefix: EVENT_PREFIX, action: 'next-confirmation' }, 'chevron-right').replace('<button', `<button ${hasNext ? '' : 'disabled'}`)}${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</div>`
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="包装与标签" data-pms-conf-rolls-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭包装与标签"></button><section class="relative z-10 flex h-full w-[1100px] max-w-[97vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(confirmation.confirmationNo)} · ${escapeHtml(confirmation.materialName)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(confirmation.purchaseOrderNo)} · ${escapeHtml(confirmation.supplierName)} · ${renderPmsStatusBadge(confirmation.status, confirmationTone(confirmation.status))}</p></div>${navigation}</header><div class="flex-1 space-y-4 overflow-y-auto p-4">${renderPmsOverlayError(state.overlayError)}
    <div class="flex items-center gap-4">${renderPmsBusinessImage(confirmation.materialImageUrl, `${confirmation.materialName}实物图`, 'h-20 w-20')}${renderPmsBusinessImage(confirmation.styleImageUrl, `${confirmation.styleName}款式图`, 'h-20 w-20')}<dl class="grid flex-1 grid-cols-3 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">基础单位</dt><dd class="mt-1">${escapeHtml(confirmation.unit)}</dd></div><div><dt class="text-xs text-muted-foreground">包装单位 / 每包装</dt><dd class="mt-1">${escapeHtml(confirmation.packageUnit)} · ${formatPmsQty(confirmation.packageQty)}</dd></div><div><dt class="text-xs text-muted-foreground">包装数</dt><dd class="mt-1">${confirmation.rolls.length}</dd></div></dl></div>
    <section class="grid grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-4">${[
      ['actualShipmentQty','实际发货数量（'+confirmation.unit+'）',confirmation.actualShipmentQty ?? (confirmation.rolls.length ? confirmation.rolls.reduce((sum,roll)=>sum+roll.qty,0) : order?.orderedQty ?? 0),'number'],
      ['packageCount','包装数量',confirmation.packageCount ?? Math.max(1,confirmation.rolls.length),'number'],['totalBoxCount','箱数',confirmation.totalBoxCount ?? confirmation.boxSpecs.length,'number'],
      ['totalWeight','重量（kg）',confirmation.totalWeight ?? confirmation.rolls.reduce((sum,roll)=>sum+roll.weight,0),'number'],['totalVolume','体积（m³）',Number((confirmation.totalVolume ?? confirmation.boxSpecs.reduce((sum,box)=>sum+box.volume/1000000,0)).toFixed(6)),'number'],
      ['shipmentDate','发货日期',confirmation.shipmentDate || '','date'],['shipmentRemark','发货备注',confirmation.shipmentRemark || '','text'],['purchaseRemark','采购备注',confirmation.purchaseRemark || '','text'],['internalRemark','内部备注',confirmation.internalRemark || '','text']
      ].map(([key,label,value,type])=>`<label class="flex flex-col gap-1 text-xs text-muted-foreground">${label}<input class="h-9 rounded border px-2 text-sm" type="${type}" ${type==='number'?'min="0" step="0.01"':''} value="${escapeHtml(String(value))}" data-pms-conf-shipment-field="${key}" data-skip-page-rerender="true"></label>`).join('')}<footer class="col-span-2 flex flex-wrap gap-2 md:col-span-4">${renderPrimaryButton('保存草稿',{prefix:EVENT_PREFIX,action:'save-shipment'},'save')}${renderPrimaryButton(state.overlay?.kind==='rolls'&&state.overlay.saveConfirmArmed?'确认保存发货':'保存并确认',{prefix:EVENT_PREFIX,action:'save-confirm'},'check')}</footer>${state.overlay?.kind==='rolls'&&state.overlay.saveConfirmArmed?`<p class="col-span-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 md:col-span-4" data-pms-conf-save-confirm-summary>确认 ${escapeHtml(confirmationNo)} 实际发货 ${formatPmsQty(state.overlay.saveConfirmQty||0)} ${escapeHtml(confirmation.unit)}、${state.overlay.saveConfirmPackageCount||0} 个包装，并更新关联采购单 ${escapeHtml(confirmation.purchaseOrderNo)} 的供应商确认状态。</p>`:''}</section>
    ${rollForm}${rollTable}${boxSpecSection}${packageDetailSection}${confirmPanel}
  </div></section></div>`
}

function renderLabelOverlay(confirmationNo: string, rollNo: string): string {
  const confirmation = getPmsSupplierConfirmation(confirmationNo)
  const roll = confirmation?.rolls.find((item) => item.rollNo === rollNo)
  if (!confirmation || !roll) return ''
  return `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="标签二维码预览" data-pms-conf-label-root><section class="w-full max-w-md rounded-xl bg-background p-5 shadow-2xl"><header class="mb-4 flex items-center justify-between"><h2 class="font-semibold">包装标签预览 · ${escapeHtml(roll.rollNo)}</h2>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-label' }, 'x')}</header>${renderPmsOverlayError(state.overlayError)}
    <div class="flex flex-col items-center gap-3">${renderRealQrPlaceholder({ value: roll.qrContent || roll.packageNo, size: 200, title: '包装标签二维码', label: roll.packageNo })}<pre class="w-full whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs text-slate-700">${escapeHtml(roll.qrContent)}</pre><div class="text-xs text-slate-500">打印次数 ${roll.printCount} · 状态 ${escapeHtml(derivePmsLabelStatus(roll))}${roll.printedBy ? ` · 最近打印 ${escapeHtml(roll.printedBy)} ${formatPmsTime(roll.printedAt)}` : ''}</div><div class="flex items-center gap-2">${renderSecondaryButton('下载标签 PNG', { prefix: EVENT_PREFIX, action: 'download-label-png' }, 'download').replace('<button', `<button data-roll-no="${escapeHtml(roll.rollNo)}"`)}${renderPrimaryButton(roll.printCount > 0 ? '重新打印标签' : '打印标签', { prefix: EVENT_PREFIX, action: 'print-single' }, 'printer').replace('<button', `<button data-roll-no="${escapeHtml(roll.rollNo)}"`)}</div></div>
  </section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-conf-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return `${columnSettings}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'logs') return columnSettings + `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="确认单操作日志"><section class="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-background p-5"><header class="flex justify-between"><h2 class="font-semibold">${escapeHtml(state.overlay.confirmationNo)} 操作日志</h2>${renderSecondaryButton('关闭',{prefix:EVENT_PREFIX,action:'close-overlay'},'x')}</header>${listPmsLogs('supplier-confirmation',state.overlay.confirmationNo).map(log=>`<p class="my-2 text-sm">${formatPmsTime(log.occurredAt)} · ${escapeHtml(log.actorName)} · ${escapeHtml(log.action)} · ${escapeHtml(log.afterValue)} · ${escapeHtml(log.reason)}</p>`).join('') || '<p class="my-4 text-sm text-muted-foreground">暂无操作日志</p>'}</section></div>`
  if (state.overlay.kind === 'view') return columnSettings + renderReadOnlyConfirmation(state.overlay.confirmationNo) + renderPmsImagePreview()
  if (state.overlay.kind === 'rolls') return `${columnSettings}${renderRollsOverlay(state.overlay.confirmationNo, state.overlay.confirmArmed, state.overlay.armedDeleteBoxNo, state.overlay.armedDeletePackageDetailNo)}${renderPmsImagePreview()}`
  return `${columnSettings}${state.overlay.returnToView ? renderReadOnlyConfirmation(state.overlay.confirmationNo) : renderRollsOverlay(state.overlay.confirmationNo, false, '', '')}${renderLabelOverlay(state.overlay.confirmationNo, state.overlay.rollNo)}${renderPmsImagePreview()}`
}

function renderReadOnlyConfirmation(confirmationNo:string):string {
  return renderRollsOverlay(confirmationNo,false,'','').replace(/<(input|select|textarea)(?=\s)/g,'<$1 disabled').replace(/<button[^>]*data-pms-conf-action="(?:generate[^"]*|add[^"]*|delete[^"]*|save[^"]*|confirm-supplier|print-labels)"[^>]*>[\s\S]*?<\/button>/g,'')
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: true,
    title: '面辅料供应商确认单',
    primaryActionsHtml: renderPrimaryButton('同步采购单',{prefix:EVENT_PREFIX,action:'sync-orders'},'refresh-cw'),
    feedbackHtml: `<div data-pms-conf-feedback>${renderPmsFeedback(state.feedback,state.feedbackOk)}</div>`,
    filtersHtml: renderFilters(),
    statsHtml: `<div data-pms-conf-stats>${renderStats()}</div>`,
    listTitle: `共 ${filteredRows().length} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('全选本页',{prefix:EVENT_PREFIX,action:'select-page'},'check')}${renderSecondaryButton('清空选择',{prefix:EVENT_PREFIX,action:'clear-selection'},'x')}${renderSecondaryButton('批量打印标签',{prefix:EVENT_PREFIX,action:'batch-print'},'printer')}${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-conf-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-conf-pagination-surface><div data-pms-conf-pagination-content>${view.paginationHtml}</div><div class="mt-2 flex justify-end gap-2"><input class="h-8 w-16 rounded border px-2" type="number" min="1" aria-label="跳转页码" data-pms-conf-jump value="${state.currentPage}">${renderSecondaryButton('跳转',{prefix:EVENT_PREFIX,action:'jump-page'},'arrow-right')}</div></div>`,
    overlaysHtml: `<div data-pms-conf-overlays>${renderOverlays()}</div>`,
  })
}

function hydrateSurface(surface: ParentNode | null | undefined): void {
  hydratePmsSurface(surface)
  if (surface) hydrateRealQRCodes(surface)
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  const filters=root.querySelector<HTMLElement>('[data-standard-list-filters]');if(filters){filters.innerHTML=renderFilters();hydrateSurface(filters)}
  const stats=root.querySelector<HTMLElement>('[data-pms-conf-stats]');if(stats)stats.innerHTML=renderStats()
  const feedback=root.querySelector<HTMLElement>('[data-pms-conf-feedback]');if(feedback)feedback.innerHTML=renderPmsFeedback(state.feedback,state.feedbackOk)
  const title=root.querySelector<HTMLElement>('[data-standard-list-table-section] > header h2');if(title)title.textContent=`共 ${filteredRows().length} 条`
  controller.refresh({overlays:false});refreshOverlays()
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-conf-overlays]')
  if (!surface) return
  const inputs = dirty ? Array.from(surface.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-pms-conf-rolls-root] input,[data-pms-conf-rolls-root] select,[data-pms-conf-rolls-root] textarea')).flatMap(input => {
    const attribute = Array.from(input.attributes).find(item => item.name.startsWith('data-pms-conf-'))
    return attribute ? [{ name: attribute.name, identity: attribute.value, value: input.value }] : []
  }) : []
  surface.innerHTML = renderOverlays()
  for (const saved of inputs) {
    const input = surface.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[${saved.name}="${CSS.escape(saved.identity)}"]`)
    if (input) input.value = saved.value
  }
  hydrateSurface(surface)
}

async function closeTopOverlay(): Promise<void> {
  if(busy)return
  if(dirty&&state.overlay?.kind==='rolls'&&!await confirmPmsAction(`${state.overlay.confirmationNo} 本次填写尚未保存。关闭会丢弃本次填写。`,'放弃填写并关闭','确认单未保存'))return
  if (state.overlay?.kind === 'label') {
    state.overlay = state.overlay.returnToView ? {kind:'view',confirmationNo:state.overlay.confirmationNo} : { kind: 'rolls', confirmationNo: state.overlay.confirmationNo, clientActionId: nextPmsActionId('pms-conf-rolls'), confirmArmed: false, armedDeleteBoxNo: '', armedDeletePackageDetailNo: '' }
    state.overlayError = ''
    refreshOverlays()
    return
  }
  dirty=false
  state.overlay = null
  state.overlayError = ''
  refreshOverlays()
}

function exportRows(): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前查询条件下没有可导出的确认单。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    '面辅料供应商确认单.csv',
    ['确认单号', '采购单号', '物料编码', '物料名称', '款式', '供应商', '状态', '卷号', '包装号', '箱号', '箱规(cm)', '基础数量', '基础单位', '标签号', '标签状态', '打印次数', '确认人'],
    rows.flatMap((row) =>
      row.rolls.length > 0
        ? row.rolls.map((roll) => {
            const boxSpec = row.boxSpecs.find((spec) => spec.boxNo === roll.boxNo)
            return [row.confirmationNo, row.purchaseOrderNo, row.materialCode, row.materialName, row.styleName, row.supplierName, row.status, roll.rollNo, roll.packageNo, roll.boxNo, boxSpec ? `${boxSpec.length}×${boxSpec.width}×${boxSpec.height}` : '', roll.qty, row.unit, roll.labelNo, derivePmsLabelStatus(roll), roll.printCount, row.confirmedBy]
          })
        : [[row.confirmationNo, row.purchaseOrderNo, row.materialCode, row.materialName, row.styleName, row.supplierName, row.status, '', '', '', '', '', row.unit, '', '未生成', 0, row.confirmedBy]],
    ),
  )
  state.feedback = `已导出 ${rows.length} 张确认单的包装标签数据。`
  state.feedbackOk = true
  refreshAll()
}

function openLabelPrint(rows:PmsSupplierConfirmation[],rollNos?:string[]):void {
  const labels=rows.flatMap(row=>row.rolls.filter(roll=>roll.labelNo&&(!rollNos||rollNos.includes(roll.rollNo))).map(roll=>({row,roll})))
  if(!labels.length){state.feedback='所选确认单没有已生成的标签。';state.feedbackOk=false;refreshAll();return}
  const popup=window.open('','_blank')
  if(!popup){state.feedback='打印预览未打开，请允许本页打开打印窗口后重试。';state.feedbackOk=false;refreshAll();return}
  popup.document.write(`<html lang="zh-CN"><head><title>供应商包装标签</title><style>body{font:14px sans-serif}article{border:1px solid #ddd;padding:12px;margin:12px;break-inside:avoid}img{width:64px;height:64px;object-fit:contain}@media print{button{display:none}}</style></head><body><button onclick="window.print()">打印标签</button>${labels.map(({row,roll})=>`<article><h2>${escapeHtml(roll.labelNo)}</h2><img src="${escapeHtml(row.materialImageUrl)}" alt="${escapeHtml(row.materialName)}"><p>${escapeHtml(row.materialName)} · ${escapeHtml(row.materialCode)}</p><p>${escapeHtml(row.purchaseOrderNo)} · ${escapeHtml(roll.rollNo)} · ${roll.qty} ${escapeHtml(row.unit)}</p>${renderRealQrPlaceholder({value:roll.qrContent,size:120,title:roll.labelNo})}</article>`).join('')}</body></html>`);popup.document.close();hydrateRealQRCodes(popup.document)
}

async function handleRollsAction(action: string, actionNode: HTMLElement | null, confirmationNo: string): Promise<boolean> {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-conf-rolls-root]')
  const operationId = state.overlay?.kind === 'rolls' ? state.overlay.clientActionId + ':' + action : nextPmsActionId(action)
  try {
    if (action === 'generate-rolls') {
      if (!surface) return true
      await generatePmsConfirmationRolls(
        confirmationNo,
        {
          rollCount: readNumberField(surface as ParentNode, `[data-${EVENT_PREFIX}-rolls-count]`),
          qtyPerPackage: readNumberField(surface as ParentNode, `[data-${EVENT_PREFIX}-rolls-qty]`),
          packageUnit: readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-rolls-unit]`),
          boxCount: readNumberField(surface as ParentNode, `[data-${EVENT_PREFIX}-rolls-boxes]`),
          rollNoPrefix: readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-rolls-prefix]`),
          metersPerRoll: readNumberField(surface as ParentNode, `[data-${EVENT_PREFIX}-rolls-meters]`),
          weightPerRoll: readOptionalNumberField(surface as ParentNode, `[data-${EVENT_PREFIX}-rolls-weight]`),
          startSequence: readNumberField(surface as ParentNode, `[data-${EVENT_PREFIX}-rolls-start]`),
        },
        PMS_BUYER_ACTOR,
        operationId,
      )
      state.feedback = `${confirmationNo} 已生成卷号与包装明细，可继续生成标签。`
      state.feedbackOk = true
      state.overlay = { kind: 'rolls', confirmationNo, clientActionId: nextPmsActionId('pms-conf-rolls'), confirmArmed: false, armedDeleteBoxNo: '', armedDeletePackageDetailNo: '' }
      state.overlayError = ''
      refreshAll()
      return true
    }
    if (action === 'add-box-spec') {
      if (!surface) return true
      await addPmsConfirmationBoxSpec(
        confirmationNo,
        {
          boxNo: readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-box-no]`),
          length: readNumberField(surface as ParentNode, `[data-${EVENT_PREFIX}-box-length]`),
          width: readNumberField(surface as ParentNode, `[data-${EVENT_PREFIX}-box-width]`),
          height: readNumberField(surface as ParentNode, `[data-${EVENT_PREFIX}-box-height]`),
          volume: readOptionalNumberField(surface as ParentNode, `[data-${EVENT_PREFIX}-box-volume]`),
          remark: readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-box-remark]`),
        },
        PMS_BUYER_ACTOR,
        operationId,
      )
      state.feedback = `${confirmationNo} 已新增箱规。`
      state.feedbackOk = true
      state.overlayError = ''
      refreshOverlays()
      return true
    }
    if (action === 'delete-box-spec') {
      const boxNo = actionNode?.dataset.boxNo || ''
      if (state.overlay?.kind !== 'rolls') return true
      if (state.overlay.armedDeleteBoxNo !== boxNo) {
        state.overlay = { ...state.overlay, armedDeleteBoxNo: boxNo, armedDeletePackageDetailNo: '' }
        state.overlayError = ''
        refreshOverlays()
        return true
      }
      await removePmsConfirmationBoxSpec(confirmationNo, boxNo, PMS_BUYER_ACTOR, operationId)
      state.overlay = { ...state.overlay, armedDeleteBoxNo: '', armedDeletePackageDetailNo: '' }
      state.feedback = `已删除箱规 ${boxNo}。`
      state.feedbackOk = true
      state.overlayError = ''
      refreshOverlays()
      return true
    }
    if (action === 'add-package-detail') {
      if (!surface) return true
      await addPmsConfirmationPackageDetail(
        confirmationNo,
        {
          packageMethod: readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-package-method]`),
          qty: readNumberField(surface as ParentNode, `[data-${EVENT_PREFIX}-package-qty]`),
          unit: readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-package-unit]`),
          remark: readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-package-remark]`),
        },
        PMS_BUYER_ACTOR,
        operationId,
      )
      state.feedback = `${confirmationNo} 已新增包装明细。`
      state.feedbackOk = true
      state.overlayError = ''
      refreshOverlays()
      return true
    }
    if (action === 'delete-package-detail') {
      const packageDetailNo = actionNode?.dataset.packageDetailNo || ''
      if (state.overlay?.kind !== 'rolls') return true
      if (state.overlay.armedDeletePackageDetailNo !== packageDetailNo) {
        state.overlay = { ...state.overlay, armedDeleteBoxNo: '', armedDeletePackageDetailNo: packageDetailNo }
        state.overlayError = ''
        refreshOverlays()
        return true
      }
      await removePmsConfirmationPackageDetail(confirmationNo, packageDetailNo, PMS_BUYER_ACTOR, operationId)
      state.overlay = { ...state.overlay, armedDeleteBoxNo: '', armedDeletePackageDetailNo: '' }
      state.feedback = '已删除包装明细。'
      state.feedbackOk = true
      state.overlayError = ''
      refreshOverlays()
      return true
    }
    if (action === 'generate-label') {
      const rollNo = actionNode?.dataset.rollNo || ''
      await generatePmsConfirmationLabels(confirmationNo, [rollNo], PMS_BUYER_ACTOR, operationId)
      state.feedback = `已生成标签 ${rollNo}。`
      state.feedbackOk = true
      state.overlayError = ''
      refreshOverlays()
      return true
    }
    if (action === 'generate-labels') {
      const confirmation = getPmsSupplierConfirmation(confirmationNo)
      const targets = confirmation?.rolls.filter((roll) => !roll.labelNo).map((roll) => roll.rollNo) ?? []
      if (targets.length === 0) {
        state.overlayError = '所有包装都已经生成标签，无需重复生成。'
        refreshOverlays()
        return true
      }
      await generatePmsConfirmationLabels(confirmationNo, targets, PMS_BUYER_ACTOR, operationId)
      state.feedback = `已生成 ${targets.length} 个包装标签。`
      state.feedbackOk = true
      state.overlayError = ''
      refreshOverlays()
      return true
    }
    if (action === 'print-labels') {
      const confirmation = getPmsSupplierConfirmation(confirmationNo)
      const targets = confirmation?.rolls.filter((roll) => roll.labelNo).map((roll) => roll.rollNo) ?? []
      if (targets.length === 0) {
        state.overlayError = '没有可打印的标签，请先生成标签。'
        refreshOverlays()
        return true
      }
      await printPmsConfirmationLabels(confirmationNo, targets, PMS_BUYER_ACTOR, operationId)
      const row=getPmsSupplierConfirmation(confirmationNo);if(row)openLabelPrint([row],targets)
      state.feedback = `已打开 ${targets.length} 个包装标签打印预览。`
      state.feedbackOk = true
      state.overlayError = ''
      refreshOverlays()
      return true
    }
    if (action === 'save-rolls' || action === 'save-shipment' || action === 'save-confirm') {
      if (!surface) return true
      const confirmation = getPmsSupplierConfirmation(confirmationNo)
      if (!confirmation) return true
      const number = (key:string)=>readNumberField(surface,`[data-pms-conf-shipment-field="${key}"]`)
      const text = (key:string)=>readTextField(surface,`[data-pms-conf-shipment-field="${key}"]`)
      if(action==='save-confirm'&&state.overlay?.kind==='rolls'&&!state.overlay.saveConfirmArmed){state.overlay={...state.overlay,saveConfirmArmed:true,saveConfirmQty:number('actualShipmentQty'),saveConfirmPackageCount:number('packageCount')};refreshOverlays();return true}
      await savePmsConfirmationShipment(confirmationNo,{actualShipmentQty:number('actualShipmentQty'),packageCount:number('packageCount'),totalBoxCount:number('totalBoxCount'),totalWeight:number('totalWeight'),totalVolume:number('totalVolume'),shipmentDate:text('shipmentDate'),shipmentRemark:text('shipmentRemark'),purchaseRemark:text('purchaseRemark'),internalRemark:text('internalRemark'),rolls:confirmation.rolls.map(roll=>({rollNo:roll.rollNo,boxNo:readTextField(surface,`[data-${EVENT_PREFIX}-roll-box="${roll.rollNo}"]`),qty:readNumberField(surface,`[data-${EVENT_PREFIX}-roll-qty="${roll.rollNo}"]`),weight:readNumberField(surface,`[data-${EVENT_PREFIX}-roll-weight="${roll.rollNo}"]`),remark:readTextField(surface,`[data-${EVENT_PREFIX}-roll-remark="${roll.rollNo}"]`)}))},PMS_BUYER_ACTOR,action==='save-confirm',operationId)
      dirty=false;if(state.overlay?.kind==='rolls')state.overlay.saveConfirmArmed=false;state.feedback='供应商确认单已保存。';state.feedbackOk=true;state.overlayError='';refreshAll();return true
    }
    if (action === 'confirm-supplier') {
      if (state.overlay?.kind !== 'rolls') return true
      if(dirty){state.overlayError='先保存本次填写，再确认供应商发货。';if(surface)surface.querySelector('header')?.insertAdjacentHTML('afterend',renderPmsOverlayError(state.overlayError));return true}
      if (!state.overlay.confirmArmed) {
        state.overlay = { ...state.overlay, confirmArmed: true }
        state.overlayError = ''
        refreshOverlays()
        return true
      }
      await confirmPmsSupplierConfirmation(confirmationNo, PMS_MANAGER_ACTOR, operationId)
      state.feedback = `${confirmationNo} 已确认供应商发货。`
      state.feedbackOk = true
      state.overlay = null
      state.overlayError = ''
      refreshAll()
      return true
    }
  } catch (error) {
    if (state.overlay?.kind === 'rolls') state.overlay = { ...state.overlay, armedDeleteBoxNo: '', armedDeletePackageDetailNo: '' }
    state.overlayError = `未保存：${error instanceof Error ? error.message : '操作失败'}`
    if (surface) { surface.querySelector('[data-pms-conf-save-error]')?.remove(); surface.querySelector('header')?.insertAdjacentHTML('afterend', `<div data-pms-conf-save-error>${renderPmsOverlayError(state.overlayError)}</div>`) }
    return true
  }
  return false
}

export async function renderPmsSupplierConfirmationsPage(): Promise<string> {
  try { await Promise.all([hydratePmsSupplierConfirmationsFromIdb(),hydratePmsMaterialPurchaseOrdersFromIdb(),hydratePmsLogsFromIdb()]) } catch(error) {state.feedback=`用户记录未读取：${error instanceof Error?error.message:'读取失败'}。当前显示固定演示记录，保存不可用。`;state.feedbackOk=false}
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-conf-root data-skip-page-rerender="true"><style>[data-pms-conf-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export async function closePmsSupplierConfirmationOverlays(): Promise<boolean> {
  if (state.overlay) {
    await closeTopOverlay()
    return true
  }
  if (state.showColumnSettings) {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  return false
}

export async function handlePmsSupplierConfirmationsEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    await closeTopOverlay()
    return true
  }

  const rollMeters = target.closest<HTMLInputElement>(`[data-${EVENT_PREFIX}-rolls-meters]`)
  if (rollMeters && event?.type === 'input') {
    const confirmationNo = state.overlay?.kind === 'rolls' ? state.overlay.confirmationNo : ''
    const confirmation = confirmationNo ? getPmsSupplierConfirmation(confirmationNo) : undefined
    const order = confirmation ? getPmsMaterialPurchaseOrder(confirmation.purchaseOrderNo) : undefined
    const meters = Number(rollMeters.value)
    const countNode = rootElement()?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-rolls-count]`)
    if (countNode) {
      countNode.value = String(order && Number.isFinite(meters) && meters > 0 ? Math.max(1, Math.ceil(order.orderedQty / meters)) : 0)
    }
    return true
  }
  const check=target.closest<HTMLInputElement>('[data-pms-conf-select]');if(check){const key=check.dataset.pmsConfSelect!;if(check.checked)selected.add(key);else selected.delete(key);return true}
  if(target.closest('[data-pms-conf-rolls-root]') && (event?.type==='input'||event?.type==='change')){
    dirty=true
    if(state.overlay?.kind==='rolls'&&state.overlay.saveConfirmArmed){state.overlay.saveConfirmArmed=false;rootElement()?.querySelector('[data-pms-conf-save-confirm-summary]')?.remove();const saveButton=rootElement()?.querySelector<HTMLElement>('[data-pms-conf-action="save-confirm"]');if(saveButton)saveButton.textContent='保存并确认'}
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsConfField
  if (field && fieldName) {
    if(['searchField','supplierFilter','categoryFilter','packageFilter','labelFilter','operatorFilter','fromDate','toDate'].includes(fieldName)){(state as unknown as Record<string,string>)[fieldName]=field.value;return true}
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as ConfirmationPageState['status']
      return true
    }
    if (fieldName === 'pageSize') {
      controller.setPageSize(Number.parseInt((field as HTMLSelectElement).value, 10))
      controller.refresh({ overlays: false })
      return true
    }
    return true
  }

  const liveInput = target.closest<HTMLInputElement>(`[data-${EVENT_PREFIX}-box-length], [data-${EVENT_PREFIX}-box-width], [data-${EVENT_PREFIX}-box-height], [data-${EVENT_PREFIX}-rolls-meters]`)
  if (liveInput && event?.type === 'input') {
    if (liveInput.dataset.pmsConfRollsMeters !== undefined) syncRollCountPreview(liveInput)
    else syncBoxVolumePreview(liveInput)
    return true
  }

  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsConfAction
  if (!action) return false
  if (action !== 'delete-box-spec' && action !== 'delete-package-detail' && state.overlay?.kind === 'rolls' && (state.overlay.armedDeleteBoxNo || state.overlay.armedDeletePackageDetailNo)) {
    state.overlay = { ...state.overlay, armedDeleteBoxNo: '', armedDeletePackageDetailNo: '' }
  }

  if(action==='open-view'||action==='open-logs'){state.overlay={kind:action==='open-view'?'view':'logs',confirmationNo:actionNode?.dataset.confirmationNo||''};refreshOverlays();return true}
  if(action==='sync-orders'){try{const count=await synchronizePmsSupplierConfirmations(PMS_BUYER_ACTOR,nextPmsActionId('sync'));state.feedback=count?`已同步 ${count} 条采购单。`:'没有尚未同步的有效采购单。';state.feedbackOk=true;refreshAll()}catch(error){state.feedback=`未同步：${error instanceof Error?error.message:'保存失败'}`;state.feedbackOk=false;refreshAll()}return true}
  if(action==='select-page'){filteredRows().slice((state.currentPage-1)*state.preferences.pageSize,state.currentPage*state.preferences.pageSize).forEach(row=>selected.add(row.confirmationNo));controller.refresh({overlays:false});return true}
  if(action==='clear-selection'){selected.clear();controller.refresh({overlays:false});return true}
  if(action==='jump-page'){const page=Number(rootElement()?.querySelector<HTMLInputElement>('[data-pms-conf-jump]')?.value);if(Number.isInteger(page)&&page>0){state.currentPage=page;controller.refresh({overlays:false})}return true}
  if(action==='batch-print'){const rows=filteredRows().filter(row=>selected.has(row.confirmationNo));if(!rows.length){state.feedback='先选择需要打印的确认单。';state.feedbackOk=false;refreshAll();return true}openLabelPrint(rows);return true}
  if (action === 'query') {
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.status = ''; state.searchField='confirm_no';state.supplierFilter='';state.categoryFilter='';state.packageFilter='';state.labelFilter='';state.operatorFilter='';state.fromDate='';state.toDate='';selected.clear()
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
    const key = actionNode?.closest<HTMLElement>('[data-pms-conf-column-key]')?.dataset.pmsConfColumnKey || ''
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
  if (action === 'open-rolls') {
    dirty=false;state.overlay = { kind: 'rolls', confirmationNo: actionNode?.dataset.confirmationNo || '', clientActionId: nextPmsActionId('pms-conf-rolls'), confirmArmed: false, armedDeleteBoxNo: '', armedDeletePackageDetailNo: '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'prev-confirmation' || action === 'next-confirmation') {
    if (state.overlay?.kind !== 'rolls' && state.overlay?.kind !== 'view') return true
    const viewing=state.overlay.kind==='view'
    const rows = filteredRows()
    const rowIndex = rows.findIndex((row) => row.confirmationNo === state.overlay?.confirmationNo)
    const step = action === 'next-confirmation' ? 1 : -1
    const targetRow = rowIndex >= 0 ? rows[rowIndex + step] : undefined
    if (!targetRow) {
      state.overlayError = step > 0 ? '已经是当前查询结果的最后一张确认单。' : '已经是当前查询结果的第一张确认单。'
      refreshOverlays()
      return true
    }
    if(dirty&&!await confirmPmsAction(`${state.overlay.confirmationNo} 本次填写尚未保存。切换到 ${targetRow.confirmationNo} 会丢弃本次填写。`,'放弃填写并切换','确认单未保存'))return true
    dirty=false
    state.overlay = viewing ? {kind:'view',confirmationNo:targetRow.confirmationNo} : { kind: 'rolls', confirmationNo: targetRow.confirmationNo, clientActionId: nextPmsActionId('pms-conf-rolls'), confirmArmed: false, armedDeleteBoxNo: '', armedDeletePackageDetailNo: '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-label') {
    state.overlay = { kind: 'label', confirmationNo: actionNode?.dataset.confirmationNo || '', rollNo: actionNode?.dataset.rollNo || '', clientActionId: nextPmsActionId('pms-conf-label'),returnToView:state.overlay?.kind==='view' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'close-label') {
    await closeTopOverlay()
    return true
  }
  if (action === 'print-single') {
    const rollNo = actionNode?.dataset.rollNo || ''
    const confirmationNo = state.overlay?.kind === 'label' ? state.overlay.confirmationNo : ''
    const operationId = state.overlay?.kind === 'label' ? state.overlay.clientActionId + ':' + action : nextPmsActionId(action)
    try {
      await printPmsConfirmationLabels(confirmationNo, [rollNo], PMS_BUYER_ACTOR, operationId)
      const row=getPmsSupplierConfirmation(confirmationNo);if(row)openLabelPrint([row],[rollNo])
      state.feedback = `${rollNo} 已打开标签打印预览。`
      state.feedbackOk = true
      state.overlayError = ''
      refreshOverlays()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '打印标签失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'download-label-png') {
    const rollNo = actionNode?.dataset.rollNo || ''
    const confirmationNo = state.overlay?.kind === 'label' ? state.overlay.confirmationNo : ''
    const operationId = state.overlay?.kind === 'label' ? state.overlay.clientActionId + ':' + action : nextPmsActionId(action)
    const confirmation = getPmsSupplierConfirmation(confirmationNo)
    const roll = confirmation?.rolls.find((item) => item.rollNo === rollNo)
    if (!confirmation || !roll) {
      state.overlayError = '标签数据不存在，请重新打开标签预览。'
      refreshOverlays()
      return true
    }
    try {
      const downloaded = downloadPmsLabelPng(confirmation, roll)
      if (downloaded) await recordPmsConfirmationLabelDownload(confirmationNo, [rollNo], PMS_BUYER_ACTOR, operationId)
      state.feedback = downloaded ? `已下载标签 PNG：${rollNo}。` : '当前环境不支持生成标签 PNG。'
      state.feedbackOk = downloaded
      state.overlayError = ''
      refreshOverlays()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '下载标签 PNG 失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'close-overlay') {
    await closeTopOverlay()
    return true
  }
  if (state.overlay?.kind === 'rolls') {
    if (busy) return true
    const confirmationNo=state.overlay.confirmationNo
    busy=true
    try {
      const handled=await handleRollsAction(action,actionNode,confirmationNo)
      if(!state.overlayError&&state.overlay?.kind==='rolls')state.overlay.clientActionId=nextPmsActionId('confirmation')
      return handled
    } finally {busy=false}
  }
  return false
}

export function getPmsSupplierConfirmationRowCountForTest(): number {
  return filteredRows().length
}
