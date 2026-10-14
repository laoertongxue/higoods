// @page-pattern: list
import { confirmPmsAction } from './shared.ts'
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  computePmsSupplyConversion,
  convertPmsSupplyQty,
  getPmsSupplyArchive,
  listPmsSupplyArchives,
  updatePmsSupplyArchive,
  createPmsSupplyArchive,
  copyPmsSupplyArchive,
  importPmsSupplyArchives,
  hydratePmsSupplyArchivesFromIdb,
  type PmsSupplyArchiveInput,
  type PmsSupplyArchive,
  type PmsSupplyArchiveUnit,
} from '../../data/pms/supplier-supply-archives.ts'
import { nextPmsActionId, PmsDomainError } from '../../data/pms/runtime.ts'
import { downloadPmsCsv, downloadPmsFile, buildPmsHtmlTemplateFile } from '../../utils/pms-export.ts'
import { parsePmsExcelRows } from '../../utils/pms-excel-import.ts'
import { listPmsSuppliers, hydratePmsSuppliersFromIdb } from '../../data/pms/suppliers.ts'
import { listPurchaseGoodsReferences, listPurchaseWarehouses } from '../../data/pms/canonical-purchase-references.ts'
import { listPmsFirstLegCarriers, listPmsFirstLegChannels, hydratePmsFirstLegFromIdb } from '../../data/pms/first-leg-logistics.ts'
import { renderPmsSupplierDetailOverlay } from './suppliers.ts'
import { escapeHtml } from '../../utils.ts'
import {
  formatPmsMoney,
  formatPmsQty,
  hydratePmsSurface,
  readNumberField,
  readTextField,
  handlePmsCommonImageEvent,
  renderPmsBusinessImage,
  renderPmsImagePreview,
  renderPmsFeedback,
  renderPmsOverlayError,
  renderPmsStatusBadge,
} from './shared.ts'

type ArchiveOverlay = null | { kind: 'detail'; archiveId: string } | { kind: 'edit'; archiveId: string } | { kind: 'copy'; archiveId: string } | { kind: 'toggle'; archiveId: string } | { kind: 'new' } | { kind: 'import' } | { kind: 'supplier'; supplierCode: string }

interface ArchivePageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | '有效' | '停用'
  supplierFilter: string
  categoryFilter: string
  regionFilter: string
  skuFilter: string
  nameFilter: string
  baseUnitFilter: string
  packageUnitFilter: string
  defaultFilter: string
  overlay: ArchiveOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-arc'
const ROOT_SELECTOR = '[data-pms-arc-root]'
const BUYER = { id: 'USR-PMS-WANG', name: '王采购', role: '采购员' as const }

let operationId = nextPmsActionId('supply-archive')
let saving = false
let dirty = false
let importRows: PmsSupplyArchiveInput[] = []
let importError = ''

const state: ArchivePageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
  supplierFilter: '', categoryFilter: '', regionFilter: '', skuFilter:'',nameFilter:'',baseUnitFilter:'',packageUnitFilter:'',defaultFilter:'',
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsSupplyArchive[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsSupplyArchives().filter((archive) => {
    if (state.status && archive.status !== state.status) return false
    if (state.supplierFilter && archive.supplierCode !== state.supplierFilter) return false
    if (state.categoryFilter && archive.materialCategory !== state.categoryFilter) return false
    if (state.regionFilter && archive.purchaseRegion !== state.regionFilter) return false
    if (state.skuFilter && !archive.materialCode.toLowerCase().includes(state.skuFilter.toLowerCase())) return false
    if (state.nameFilter && !archive.materialName.toLowerCase().includes(state.nameFilter.toLowerCase())) return false
    if (state.baseUnitFilter && archive.baseUnit !== state.baseUnitFilter) return false
    if (state.packageUnitFilter && archive.packageUnit !== state.packageUnitFilter) return false
    if (state.defaultFilter && String(archive.isDefaultSupplier) !== state.defaultFilter) return false
    if (!keyword) return true
    return [archive.supplierName, archive.supplierCode, archive.materialName, archive.materialCode].some((value) => value.toLowerCase().includes(keyword))
  })
}

const columns: StandardListColumn<PmsSupplyArchive>[] = [
  {
    key: 'supplier',
    title: '供应商',
    width: 230,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.supplierName,
    render: (row) => `<div class="font-semibold"><button type="button" class="text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-supplier" data-supplier-code="${escapeHtml(row.supplierCode)}" data-skip-page-rerender="true">${escapeHtml(row.supplierName)}</button></div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.supplierCode)}</div><div class="mt-1 text-xs text-slate-500">供货周期 ${row.leadTimeDays} 天</div>`,
  },
  {
    key: 'material',
    title: '物料',
    width: 280,
    required: true,
    freezeable: true,
    render: (row) => `<div class="flex items-center gap-3">${renderPmsBusinessImage(row.materialImageUrl, `${row.materialName}（${row.materialCode}）实物图`, 'h-12 w-12')}<div><div class="font-medium">${escapeHtml(row.materialName)}</div><div class="text-xs text-slate-500">${escapeHtml(row.materialCode)} · ${escapeHtml(row.materialCategory)}</div><div class="text-xs text-slate-500">基础单位 ${escapeHtml(row.baseUnit)}</div></div></div>`,
  },
  {
    key: 'package',
    title: '包装换算',
    width: 220,
    render: (row) => `<div class="text-sm">1 ${escapeHtml(row.packageUnit)} = ${formatPmsQty(row.packageQty, row.baseUnit)}</div><div class="mt-1 text-xs text-slate-500">1 箱 = ${row.boxQty} ${escapeHtml(row.packageUnit)}</div><div class="mt-1 text-xs text-slate-500">成衣箱数向上取整：${row.isGarment ? '是' : '否'}</div>`,
  },
  {
    key: 'quote',
    title: '报价 / 起订',
    width: 180,
    sortable: true,
    sortValue: (row) => row.price,
    render: (row) => `<div class="text-sm font-semibold tabular-nums">${formatPmsMoney(row.price, row.currency)}</div><div class="mt-1 text-xs text-slate-500">起订 ${formatPmsQty(row.minOrderQty, row.baseUnit)}</div><div class="mt-1 text-xs text-slate-500">最近报价 ${escapeHtml(row.latestQuoteAt)} · V${row.version}</div>`,
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    sortable: true,
    sortValue: (row) => row.status,
    render: (row) => renderPmsStatusBadge(row.status, row.status === '有效' ? 'green' : 'slate'),
  },
  {
    key: 'actions',
    title: '操作',
    width: 190,
    actionColumn: true,
    render: (row) => `<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5"><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-detail" data-archive-id="${escapeHtml(row.archiveId)}" data-skip-page-rerender="true">换算与快照</button><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-edit" data-archive-id="${escapeHtml(row.archiveId)}" data-skip-page-rerender="true">编辑档案</button><button type="button" class="text-xs text-blue-700" data-${EVENT_PREFIX}-action="open-copy" data-archive-id="${escapeHtml(row.archiveId)}" data-skip-page-rerender="true">复制</button><button type="button" class="text-xs text-blue-700" data-${EVENT_PREFIX}-action="open-toggle" data-archive-id="${escapeHtml(row.archiveId)}" data-skip-page-rerender="true">${row.status === '有效' ? '停用' : '启用'}</button></div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/supplier-supply-archives',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-arc-table-surface]',
  paginationSurfaceSelector: '[data-pms-arc-pagination-content]',
  overlaysSurfaceSelector: '[data-pms-arc-overlays]',
  defaultFrozenKeys: ['supplier', 'material'],
  columnSettingsTitle: '供货档案列设置',
  emptyText: '当前条件下暂无供货档案',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  const input = (key: string,label: string,value: string) => `<label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">${label}</span><input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(value)}" data-${EVENT_PREFIX}-field="${key}" data-skip-page-rerender="true"></label>`
  const select = (key: string,label: string,value: string,options: Array<{value:string;text:string}>) => `<label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">${label}</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="${key}" data-skip-page-rerender="true"><option value="">全部</option>${options.map(option => `<option value="${escapeHtml(option.value)}" ${value === option.value ? 'selected' : ''}>${escapeHtml(option.text)}</option>`).join('')}</select></label>`
  const units = [...new Set(['米','码','公斤','KG','个','件','卷','箱','包','打',...listPurchaseGoodsReferences().map(item => item.unit)])].map(value => ({value,text:value}))
  const count = [state.categoryFilter,state.baseUnitFilter,state.packageUnitFilter,state.defaultFilter,state.status].filter(Boolean).length
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid grid-cols-2 gap-3 lg:grid-cols-3">${select('supplierFilter','供应商',state.supplierFilter,listPmsSuppliers().map(item => ({value:item.supplierCode,text:item.supplierName})))}${input('skuFilter','商品 / 物料 SKU',state.skuFilter)}${input('nameFilter','商品 / 物料名称',state.nameFilter)}</div><div data-process-advanced ${count ? '' : 'hidden'} class="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">${select('categoryFilter','物料分类',state.categoryFilter,['面料','辅料','纱线','包材','耗材','成衣','样衣'].map(value => ({value,text:value})))}${select('baseUnitFilter','基础单位',state.baseUnitFilter,units)}${select('packageUnitFilter','包装单位',state.packageUnitFilter,units)}${select('defaultFilter','默认供应商',state.defaultFilter,[{value:'false',text:'否'},{value:'true',text:'是'}])}${select('status','状态',state.status,[{value:'有效',text:'启用'},{value:'停用',text:'停用'}])}</div><div class="mt-3 flex flex-wrap gap-2" data-process-filter-actions>${renderPrimaryButton('查询',{prefix:EVENT_PREFIX,action:'query'},'search')}${renderSecondaryButton('重置',{prefix:EVENT_PREFIX,action:'reset'},'rotate-ccw')}${renderSecondaryButton('导出',{prefix:EVENT_PREFIX,action:'export'},'download')}${renderProcessFilterToggle(count,'button')}</div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  return renderProcessOrderStats([
    { label: '档案总数', value: rows.length },
    { label: '有效档案', value: rows.filter((row) => row.status === '有效').length },
    { label: '成衣供货档案', value: rows.filter((row) => row.isGarment).length },
    { label: '平均供货周期', value: rows.length ? `${Math.round(rows.reduce((sum, row) => sum + row.leadTimeDays, 0) / rows.length)} 天` : '—' },
  ])
}

function renderDetailOverlay(archiveId: string): string {
  const archive = getPmsSupplyArchive(archiveId)
  if (!archive) return ''
  const snapshots = [...archive.snapshots].reverse()
  const snapshotRows = snapshots.map((snapshot) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm">V${snapshot.version}</td><td class="px-3 py-2 text-sm">1 ${escapeHtml(snapshot.packageUnit)} = ${snapshot.packageQty} ${escapeHtml(archive.baseUnit)}</td><td class="px-3 py-2 text-sm">${snapshot.boxQty} ${escapeHtml(snapshot.packageUnit)}/箱</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsMoney(snapshot.price, snapshot.currency)}</td><td class="px-3 py-2 text-xs text-slate-500">${escapeHtml(snapshot.effectiveFrom)} · ${escapeHtml(snapshot.changedBy)}</td></tr>`).join('')
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="供货档案详情" data-pms-arc-detail-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭详情"></button><section class="relative z-10 flex h-full w-[720px] max-w-[94vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(archive.supplierName)} · ${escapeHtml(archive.materialName)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(archive.materialCode)} · 基础单位 ${escapeHtml(archive.baseUnit)} · V${archive.version}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4"><section><h3 class="mb-2 font-semibold">供货设置</h3><dl class="grid grid-cols-2 gap-3 text-sm">${ARCHIVE_FIELDS.map(field => `<div><dt class="text-xs text-muted-foreground">${field.label}</dt><dd class="mt-1">${escapeHtml(field.type === 'boolean' ? archive[field.key] ? '是' : '否' : String(archive[field.key] ?? '—'))}</dd></div>`).join('')}<div><dt class="text-xs text-muted-foreground">每箱基础数量</dt><dd>${archive.packageQty * archive.boxQty} ${escapeHtml(archive.baseUnit)}</dd></div><div><dt class="text-xs text-muted-foreground">头程物流商 / 渠道</dt><dd>${escapeHtml(listPmsFirstLegCarriers().find(item => item.carrierCode === archive.firstLegCarrierCode)?.carrierName || '—')} / ${escapeHtml(listPmsFirstLegChannels().find(item => item.channelCode === archive.firstLegChannelCode)?.channelName || '—')}</dd></div></dl></section>
    <div class="flex items-center gap-4">${renderPmsBusinessImage(archive.materialImageUrl, `${archive.materialName}实物图`, 'h-20 w-20')}<dl class="grid flex-1 grid-cols-3 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">包装</dt><dd class="mt-1">1 ${escapeHtml(archive.packageUnit)} = ${formatPmsQty(archive.packageQty, archive.baseUnit)}</dd></div><div><dt class="text-xs text-muted-foreground">每箱</dt><dd class="mt-1">${archive.boxQty} ${escapeHtml(archive.packageUnit)}</dd></div><div><dt class="text-xs text-muted-foreground">报价</dt><dd class="mt-1 tabular-nums">${formatPmsMoney(archive.price, archive.currency)}</dd></div><div><dt class="text-xs text-muted-foreground">起订量</dt><dd class="mt-1 tabular-nums">${formatPmsQty(archive.minOrderQty, archive.baseUnit)}</dd></div><div><dt class="text-xs text-muted-foreground">供货周期</dt><dd class="mt-1">${archive.leadTimeDays} 天</dd></div><div><dt class="text-xs text-muted-foreground">状态</dt><dd class="mt-1">${renderPmsStatusBadge(archive.status, archive.status === '有效' ? 'green' : 'slate')}</dd></div></dl></div>
    <section class="rounded-lg border p-4" data-pms-arc-conversion-root><h3 class="text-sm font-semibold">数量换算</h3><div class="mt-3 flex flex-wrap items-end gap-3">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">数量<input class="h-9 w-32 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="250" data-${EVENT_PREFIX}-conv-field="qty" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">从<select class="h-9 w-32 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-conv-field="from" data-skip-page-rerender="true"><option value="base">基础（${escapeHtml(archive.baseUnit)}）</option><option value="package">${escapeHtml(archive.packageUnit)}</option><option value="box">箱</option></select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">到<select class="h-9 w-32 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-conv-field="to" data-skip-page-rerender="true"><option value="package">${escapeHtml(archive.packageUnit)}</option><option value="box">箱</option><option value="base">基础（${escapeHtml(archive.baseUnit)}）</option></select></label>
      ${renderSecondaryButton('换算', { prefix: EVENT_PREFIX, action: 'convert' }, 'refresh-cw')}
      <span class="pb-2 text-sm font-semibold text-blue-700" data-pms-arc-conversion-result>—</span>
    </div><p class="mt-2 text-xs text-slate-500">成衣箱数按向上取整；换算结果仅供参考，采购单以供货档案快照为准。</p></section>
    <section><h3 class="mb-2 text-sm font-semibold">包装快照（${snapshots.length}）</h3><div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">版本</th><th class="px-3 py-2">包装</th><th class="px-3 py-2">每箱</th><th class="px-3 py-2">报价</th><th class="px-3 py-2">生效</th></tr></thead><tbody>${snapshotRows}</tbody></table></div></section>
  </div></section></div>`
}

const ARCHIVE_FIELDS: Array<{ key: keyof PmsSupplyArchive; label: string; type?: 'number' | 'boolean'; options?: string[] }> = [
  { key: 'materialCategory', label: '物料分类', options: ['面料','辅料','纱线','包材','耗材','成衣','样衣'] },
  { key: 'purchaseRegion', label: '采购区域', options: ['中国','印尼','越南','其他'] },
  { key: 'isDefaultSupplier', label: '是否默认供应商', type: 'boolean' },
  { key: 'status', label: '状态', options: ['有效','停用'] },
  { key: 'baseUnit', label: '基础单位' }, { key: 'purchaseUnit', label: '采购单位' }, { key: 'packageUnit', label: '包装单位' }, { key: 'boxUnit', label: '箱单位' },
  { key: 'price', label: '默认采购价', type: 'number' }, { key: 'currency', label: '币种', options: ['RMB','USD','IDR'] },
  { key: 'minOrderQty', label: 'MOQ / 起订量', type: 'number' }, { key: 'leadTimeDays', label: '交期天数', type: 'number' },
  { key: 'requiresQc', label: '是否需要质检', type: 'boolean' }, { key: 'buyer', label: '默认采购员' }, { key: 'packagingMethod', label: '包装方式' },
  { key: 'packageQty', label: '每包装单位基础数量', type: 'number' }, { key: 'boxQty', label: '每箱包装数', type: 'number' },
  { key: 'packageWeight', label: '单包装重量（kg）', type: 'number' }, { key: 'packageVolume', label: '单包装体积（m³）', type: 'number' },
  { key: 'boxWeight', label: '单箱重量（kg）', type: 'number' }, { key: 'boxVolume', label: '单箱体积（m³）', type: 'number' }, { key: 'boxSpec', label: '箱规' },
  { key: 'allowIrregular', label: '允许不规则包装数量', type: 'boolean' }, { key: 'packagingRemark', label: '包装备注' },
  { key: 'domesticCarrier', label: '默认国内物流商' }, { key: 'deliveryMethod', label: '默认发货方式' }, { key: 'deliveryAddress', label: '默认发货地址' },
  { key: 'targetWarehouse', label: '默认收货仓' }, { key: 'directOverseas', label: '直发海外仓', type: 'boolean' },
]
function archiveField(key: string, label: string, value: unknown, type = 'text', options?: Array<{ value: string; text: string }>): string {
  const attrs = `aria-label="${escapeHtml(label)}" data-${EVENT_PREFIX}-edit-field="${key}" data-skip-page-rerender="true"`
  const control = options ? `<select class="h-9 rounded-md border bg-background px-2 text-sm" ${attrs}>${options.map(option => `<option value="${escapeHtml(option.value)}" ${String(value ?? '') === option.value ? 'selected' : ''}>${escapeHtml(option.text)}</option>`).join('')}</select>` : `<input class="h-9 rounded-md border bg-background px-2 text-sm" type="${type}" ${type === 'number' ? 'min="0" step="0.01"' : ''} value="${escapeHtml(String(value ?? ''))}" ${attrs}>`
  return `<label class="flex flex-col gap-1 text-xs text-muted-foreground">${label}${control}</label>`
}
function renderEditOverlay(archiveId = ''): string {
  const archive = archiveId ? getPmsSupplyArchive(archiveId) : undefined
  const defaults = { packageUnit: '卷', boxUnit: '箱', packageQty: 100, boxQty: 4, price: 0, currency: 'RMB', minOrderQty: 0, leadTimeDays: 1, purchaseRegion: '中国', status: '有效' }
  const values = { ...defaults, ...archive } as Partial<PmsSupplyArchive>
  const references = listPurchaseGoodsReferences().filter(item => item.active)
  const materialOptions = [{ value: '', text: '选择商品或物料 SKU' }, ...references.map(item => ({ value: item.materialCode, text: `${item.materialName}（${item.materialCode}）` }))]
  if (archive && !references.some(item => item.materialCode === archive.materialCode)) materialOptions.push({ value: archive.materialCode, text: `${archive.materialName}（历史采购身份）` })
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="${archive ? '编辑' : '新增'}供货档案" data-pms-arc-edit-root><section class="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-background p-5 shadow-2xl"><header class="mb-4 flex items-center justify-between"><h2 class="font-semibold">${archive ? '编辑供货档案' : '新增供货档案'}</h2>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header>${renderPmsOverlayError(state.overlayError)}<div class="grid grid-cols-2 gap-3">
    ${archiveField('supplierCode','供应商（必填）',archive?.supplierCode || '', 'text', [{ value: '', text: '请选择供应商' }, ...listPmsSuppliers().map(item => ({ value: item.supplierCode, text: item.supplierName }))])}
    ${archiveField('materialCode','商品 / 物料 SKU（必填）',archive?.materialCode || '', 'text', materialOptions)}
    <div class="col-span-2 flex items-center gap-3" data-pms-arc-material-preview>${archive ? renderPmsBusinessImage(archive.materialImageUrl, archive.materialName, 'h-12 w-12') + escapeHtml(archive.materialName) : ''}</div>
    ${ARCHIVE_FIELDS.map(field => archiveField(field.key, field.label, values[field.key] ?? (field.type === 'number' ? 0 : field.type === 'boolean' ? false : ''), field.type === 'number' ? 'number' : 'text', field.type === 'boolean' ? [{value:'false',text:'否'},{value:'true',text:'是'}] : field.options?.map(option => ({value:option,text:option === '有效' ? '启用' : option})))).join('')}
    <p class="text-xs text-muted-foreground">每箱基础数量：<strong data-pms-arc-box-total>${(archive?.packageQty || 100) * (archive?.boxQty || 4)}</strong></p>
    ${archiveField('firstLegCarrierCode','默认头程物流商',archive?.firstLegCarrierCode || '', 'text', [{value:'',text:'请选择'}, ...listPmsFirstLegCarriers().filter(item => item.status === '启用').map(item => ({value:item.carrierCode,text:item.carrierName}))])}
    ${archiveField('firstLegChannelCode','默认头程渠道',archive?.firstLegChannelCode || '', 'text', [{value:'',text:'请选择'}, ...listPmsFirstLegChannels().filter(item => item.status === '启用' && item.carrierId === archive?.firstLegCarrierCode).map(item => ({value:item.channelCode,text:item.channelName}))])}
    </div><footer class="mt-4 flex justify-end gap-2">${renderSecondaryButton('取消', {prefix:EVENT_PREFIX,action:'close-overlay'},'x')}${renderPrimaryButton('保存供货档案',{prefix:EVENT_PREFIX,action:'submit-edit'},'save')}</footer></section></div>`
}
function renderImportOverlay(): string {
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="导入供货档案"><section class="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-background p-5"><header class="flex justify-between"><h2 class="font-semibold">导入供货档案</h2>${renderSecondaryButton('关闭',{prefix:EVENT_PREFIX,action:'close-overlay'},'x')}</header><div class="my-4 flex gap-2">${renderSecondaryButton('下载导入模板',{prefix:EVENT_PREFIX,action:'template'},'download')}<label class="rounded border px-3 py-2 text-sm">选择 xls / xlsx<input type="file" accept=".xls,.xlsx" data-pms-arc-import-file class="block mt-2"></label>${renderSecondaryButton('清空预览',{prefix:EVENT_PREFIX,action:'clear-import'},'x')}</div>${renderPmsOverlayError(importError || state.overlayError)}<div class="overflow-auto"><table class="w-full text-sm"><thead><tr><th>供应商编码</th><th>商品 / 物料 SKU</th><th>价格</th><th>包装数量</th></tr></thead><tbody>${importRows.map(row => `<tr><td>${escapeHtml(row.supplierCode)}</td><td>${escapeHtml(row.materialCode)}</td><td>${row.price}</td><td>${row.packageQty}</td></tr>`).join('')}</tbody></table></div><footer class="mt-4 flex justify-end">${renderPrimaryButton(`确认导入 ${importRows.length} 条`,{prefix:EVENT_PREFIX,action:'commit-import'},'check').replace('<button', `<button ${!importRows.length || importError ? 'disabled' : ''}`)}</footer></section></div>`
}

function refreshImageSurface(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-arc-image-surface]')
  if (surface) surface.innerHTML = renderPmsImagePreview()
}

function renderOverlays(): string {
  const settings = `<div data-pms-arc-column-overlays>${controller.renderColumnSettings()}</div>`
  const overlay = state.overlay
  if (!overlay) return settings
  if (overlay.kind === 'detail') return settings + renderDetailOverlay(overlay.archiveId)
  if (overlay.kind === 'edit') return settings + renderEditOverlay(overlay.archiveId)
  if (overlay.kind === 'new') return settings + renderEditOverlay()
  if (overlay.kind === 'import') return settings + renderImportOverlay()
  if (overlay.kind === 'supplier') return settings + renderPmsSupplierDetailOverlay(overlay.supplierCode).replaceAll('data-pms-sup-action="close-overlay"','data-pms-arc-action="close-overlay"')
  const archive = getPmsSupplyArchive(overlay.archiveId)
  if (!archive) return settings
  const action = overlay.kind === 'copy' ? '复制' : archive.status === '有效' ? '停用' : '启用'
  return settings + `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="${action}供货档案"><section class="w-full max-w-lg rounded-xl bg-background p-5"><h2 class="font-semibold">${action}供货档案</h2><p class="my-3 text-sm">${escapeHtml(archive.materialName)} · ${escapeHtml(archive.supplierName)}。${action === '停用' ? '停用后不可用于新的采购，历史采购快照保留。' : ''}</p>${overlay.kind === 'copy' ? archiveField('copySupplier','复制给供应商','', 'text', [{value:'',text:'请选择其他供应商'}, ...listPmsSuppliers().filter(item => item.supplierCode !== archive.supplierCode).map(item => ({value:item.supplierCode,text:item.supplierName}))]) : ''}${renderPmsOverlayError(state.overlayError)}<footer class="mt-4 flex justify-end gap-2">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-overlay'},'x')}${renderPrimaryButton(`确认${action}`,{prefix:EVENT_PREFIX,action:'confirm-action'},'check')}</footer></section></div>`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({className:'pms-compact-list',
      showHeader: true,
    title: '供应商供货档案',
    primaryActionsHtml: renderPrimaryButton('新增供货档案',{prefix:EVENT_PREFIX,action:'open-new'},'plus') + renderSecondaryButton('导入',{prefix:EVENT_PREFIX,action:'open-import'},'upload'),
    feedbackHtml: `<div data-pms-arc-feedback>${renderPmsFeedback(state.feedback, state.feedbackOk)}</div>`,
    filtersHtml: renderFilters(),
    statsHtml: `<div data-pms-arc-stats>${renderStats()}</div>`,
    listTitle: `共 ${filteredRows().length} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-arc-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-arc-pagination-surface><div data-pms-arc-pagination-content>${view.paginationHtml}</div><div class="mt-2 flex items-center justify-end gap-2 text-xs"><label>跳转到<input type="number" min="1" class="ml-2 h-8 w-16 rounded border px-2" aria-label="跳转页码" data-pms-arc-jump value="${state.currentPage}"></label>${renderSecondaryButton('跳转',{prefix:EVENT_PREFIX,action:'jump-page'},'arrow-right')}</div></div>`,
    overlaysHtml: `<div data-pms-arc-overlays>${renderOverlays()}</div><div data-pms-arc-image-surface>${renderPmsImagePreview()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  const filters = root.querySelector<HTMLElement>('[data-standard-list-filters]')
  if (filters) { filters.innerHTML = renderFilters(); hydratePmsSurface(filters) }
  const stats = root.querySelector<HTMLElement>('[data-pms-arc-stats]')
  if (stats) stats.innerHTML = renderStats()
  const feedback = root.querySelector<HTMLElement>('[data-pms-arc-feedback]')
  if (feedback) feedback.innerHTML = renderPmsFeedback(state.feedback, state.feedbackOk)
  const title = root.querySelector<HTMLElement>('[data-standard-list-table-section] > header h2')
  if (title) title.textContent = `共 ${filteredRows().length} 条`
  controller.refresh({ overlays: false })
  refreshOverlays()
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-arc-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function updateConversionResult(): void {
  const root = rootElement()?.querySelector<HTMLElement>('[data-pms-arc-conversion-root]')
  const result = rootElement()?.querySelector<HTMLElement>('[data-pms-arc-conversion-result]')
  if (!root || !result || state.overlay?.kind !== 'detail') return
  const archive = getPmsSupplyArchive(state.overlay.archiveId)
  if (!archive) return
  const qty = readNumberField(root, `[data-${EVENT_PREFIX}-conv-field="qty"]`)
  const from = readTextField(root, `[data-${EVENT_PREFIX}-conv-field="from"]`) as PmsSupplyArchiveUnit
  const to = readTextField(root, `[data-${EVENT_PREFIX}-conv-field="to"]`) as PmsSupplyArchiveUnit
  try {
    const converted = convertPmsSupplyQty(archive, qty, from, to)
    const unitLabel = to === 'base' ? archive.baseUnit : to === 'package' ? archive.packageUnit : '箱'
    const conversion = computePmsSupplyConversion(archive, from === 'base' ? qty : convertPmsSupplyQty(archive, qty, from, 'base'))
    result.textContent = `${formatPmsQty(converted)} ${unitLabel}（约 ${conversion.packageCount} ${archive.packageUnit} / ${conversion.boxCount} 箱）`
  } catch (error) {
    result.textContent = error instanceof PmsDomainError ? error.message : '换算失败'
  }
}

function readArchiveForm(surface: HTMLElement): PmsSupplyArchiveInput {
  const supplierCode = readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="supplierCode"]`)
  const materialCode = readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="materialCode"]`)
  const input: Record<string, unknown> = { supplierCode, materialCode }
  for (const field of ARCHIVE_FIELDS) input[field.key] = field.type === 'number' ? readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="${field.key}"]`) : field.type === 'boolean' ? readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="${field.key}"]`) === 'true' : readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="${field.key}"]`)
  for (const key of ['firstLegCarrierCode','firstLegChannelCode']) input[key] = readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="${key}"]`)
  return input as unknown as PmsSupplyArchiveInput
}
function showSaveError(surface: HTMLElement, error: unknown): void {
  state.overlayError = `未保存：${error instanceof Error ? error.message : '保存失败'}`
  surface.querySelector('[data-pms-arc-save-error]')?.remove()
  surface.querySelector('header')?.insertAdjacentHTML('afterend', `<div data-pms-arc-save-error>${renderPmsOverlayError(state.overlayError)}</div>`)
}
async function submitEdit(archiveId: string): Promise<void> {
  if (saving) return
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-arc-edit-root]')
  if (!surface) return
  saving = true
  try {
    const input = readArchiveForm(surface)
    const archive = archiveId ? await updatePmsSupplyArchive(archiveId, input, BUYER, operationId) : await createPmsSupplyArchive(input, BUYER, operationId)
    state.feedback = `${archive.archiveId} 已保存，包装快照 V${archive.version}。`
    dirty = false; state.feedbackOk = true; state.overlay = {kind:'detail',archiveId:archive.archiveId}; state.overlayError = ''
    refreshAll()
  } catch (error) { showSaveError(surface, error) } finally { saving = false }
}

function exportRows(): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前查询条件下没有可导出的供货档案。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    '供应商供货档案.csv',
    ['档案号','供应商编码','供应商','商品/物料SKU','商品/物料名称',...ARCHIVE_FIELDS.map(field => field.label),'每箱基础数量','头程物流商编码','头程渠道编码','版本'],
    rows.map(row => [row.archiveId,row.supplierCode,row.supplierName,row.materialCode,row.materialName,...ARCHIVE_FIELDS.map(field => field.type === 'boolean' ? row[field.key] ? '是' : '否' : String(row[field.key] ?? '')),row.packageQty * row.boxQty,row.firstLegCarrierCode,row.firstLegChannelCode,row.version]),
  )
  state.feedback = `已导出 ${rows.length} 条供货档案（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

export async function renderPmsSupplierSupplyArchivesPage(): Promise<string> {
  try { await Promise.all([hydratePmsSupplyArchivesFromIdb(), hydratePmsSuppliersFromIdb(), hydratePmsFirstLegFromIdb()]) } catch (error) { state.feedback = `用户资料未读取：${error instanceof Error ? error.message : '读取失败'}。当前显示固定演示资料，保存不可用。`; state.feedbackOk = false }
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-arc-root data-skip-page-rerender="true"><style>[data-pms-arc-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export async function closePmsSupplyArchiveOverlays(): Promise<boolean> {
  if (saving) return false
  if (((dirty && (state.overlay?.kind === 'new' || state.overlay?.kind === 'edit')) || (state.overlay?.kind === 'import' && importRows.length > 0)) && !await confirmPmsAction('供货档案填写或导入预览尚未保存。关闭会丢弃本次填写。','放弃填写并关闭','供货档案未保存')) return true
  dirty = false
  if (state.overlay?.kind === 'edit') {
    state.overlay = { kind: 'detail', archiveId: state.overlay.archiveId }
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

export async function handlePmsSupplyArchivesEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshImageSurface)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    await closePmsSupplyArchiveOverlays()
    return true
  }
  const importFile = target.closest<HTMLInputElement>('[data-pms-arc-import-file]')
  if (importFile && event?.type === 'change') {
    importRows = []; importError = ''; state.overlayError=''
    try {
      const file = importFile.files?.[0]
      if (!file) return true
      if (file.size > 5 * 1024 * 1024) throw new Error('文件超过 5 MB')
      const rows = await parsePmsExcelRows(file)
      const header = rows.shift() || []
      const required = ['供应商编码','商品/物料SKU','包装数量','每箱包装数','价格','币种','交期天数']
      if (required.some(label => !header.includes(label))) throw new Error('表头与导入模板不一致')
      importRows = rows.map(row => { const value = (label: string) => row[header.indexOf(label)] || ''; return {supplierCode:value('供应商编码'),materialCode:value('商品/物料SKU'),packageQty:Number(value('包装数量')),boxQty:Number(value('每箱包装数')),price:Number(value('价格')),currency:value('币种') as 'RMB'|'USD'|'IDR',leadTimeDays:Number(value('交期天数'))} })
      if (!importRows.length) throw new Error('文件没有可导入记录')
    } catch (error) { importError = error instanceof Error ? error.message : '文件读取失败' }
    refreshOverlays(); return true
  }
  const editField = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-edit-field]`)
  if (editField) {
    if (event?.type === 'input' || event?.type === 'change') dirty = true
    const surface = editField.closest<HTMLElement>('[data-pms-arc-edit-root]')
    if (surface && editField.dataset.pmsArcEditField === 'materialCode') {
      const reference = listPurchaseGoodsReferences().find(item => item.materialCode === editField.value)
      const preview = surface.querySelector<HTMLElement>('[data-pms-arc-material-preview]')
      if (reference && preview) { preview.innerHTML = renderPmsBusinessImage(reference.imageUrl, reference.materialName, 'h-12 w-12') + escapeHtml(reference.materialName); hydratePmsSurface(preview) }
      for (const key of ['baseUnit','purchaseUnit']) { const node = surface.querySelector<HTMLInputElement>(`[data-pms-arc-edit-field="${key}"]`); if (node && reference) node.value = reference.unit }
      const price = surface.querySelector<HTMLInputElement>('[data-pms-arc-edit-field="price"]'); if (price && reference) price.value = String(reference.referencePrice)
    }
    if (surface && editField.dataset.pmsArcEditField === 'firstLegCarrierCode') {
      const channels = surface.querySelector<HTMLSelectElement>('[data-pms-arc-edit-field="firstLegChannelCode"]')
      if (channels) channels.innerHTML = '<option value="">请选择</option>' + listPmsFirstLegChannels().filter(item => item.carrierId === editField.value && item.status === '启用').map(item => `<option value="${escapeHtml(item.channelCode)}">${escapeHtml(item.channelName)}</option>`).join('')
    }
    const total = surface?.querySelector<HTMLElement>('[data-pms-arc-box-total]')
    if (surface && total) total.textContent = String(readNumberField(surface,'[data-pms-arc-edit-field="packageQty"]') * readNumberField(surface,'[data-pms-arc-edit-field="boxQty"]'))
    return true
  }
  const convField = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-conv-field]`)
  if (convField) {
    updateConversionResult()
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsArcField
  if (field && fieldName) {
    if (['supplierFilter','categoryFilter','regionFilter','skuFilter','nameFilter','baseUnitFilter','packageUnitFilter','defaultFilter'].includes(fieldName)) { (state as unknown as Record<string,string>)[fieldName] = field.value; return true }
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as ArchivePageState['status']
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
  const action = actionNode?.dataset.pmsArcAction
  if (!action) return false
  if (['open-new','open-import','open-copy','open-toggle'].includes(action)) {
    operationId = nextPmsActionId('supply-archive'); dirty = false; state.overlayError = ''
    state.overlay = action === 'open-new' ? {kind:'new'} : action === 'open-import' ? {kind:'import'} : {kind:action === 'open-copy' ? 'copy' : 'toggle',archiveId:actionNode?.dataset.archiveId || ''}
    refreshOverlays(); return true
  }
  if (action === 'open-supplier') { state.overlay = {kind:'supplier',supplierCode:actionNode?.dataset.supplierCode || ''}; refreshOverlays(); return true }
  if (action === 'template') { downloadPmsFile('供货档案导入模板.xls',buildPmsHtmlTemplateFile('供货档案模板',['供应商编码','商品/物料SKU','包装数量','每箱包装数','价格','币种','交期天数'],[]),'application/vnd.ms-excel'); return true }
  if (action === 'clear-import') { importRows = []; importError = ''; state.overlayError=''; refreshOverlays(); return true }
  if (action === 'commit-import') {
    if (saving || importError || !importRows.length) return true
    saving = true
    try { const result = await importPmsSupplyArchives(importRows,BUYER,operationId); state.feedback = `已导入 ${result.length} 条供货档案。`; state.feedbackOk = true; state.overlay = null; importRows = []; refreshAll() }
    catch(error) { state.overlayError = `未导入：${error instanceof Error ? error.message : '保存失败'}`; refreshOverlays() }
    finally { saving = false }
    return true
  }
  if (action === 'confirm-action') {
    if (saving || !state.overlay || !('archiveId' in state.overlay)) return true
    saving = true
    try {
      const overlay = state.overlay
      const archive = getPmsSupplyArchive(overlay.archiveId)!
      if (overlay.kind === 'copy') { const supplier = rootElement()?.querySelector<HTMLSelectElement>('[data-pms-arc-edit-field="copySupplier"]')?.value || ''; await copyPmsSupplyArchive(archive.archiveId,supplier,BUYER,operationId) }
      else await updatePmsSupplyArchive(archive.archiveId,{status:archive.status === '有效' ? '停用' : '有效'},BUYER,operationId)
      state.feedback = '供货档案已保存。'; state.feedbackOk = true; state.overlay = null; state.overlayError = ''; refreshAll()
    } catch(error) { state.overlayError = `未保存：${error instanceof Error ? error.message : '保存失败'}`; refreshOverlays() } finally { saving = false }
    return true
  }
  if (action === 'query') {
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.status = ''; state.supplierFilter = ''; state.categoryFilter = ''; state.regionFilter = ''; state.skuFilter = ''; state.nameFilter = ''; state.baseUnitFilter = ''; state.packageUnitFilter = ''; state.defaultFilter = ''
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
    const key = actionNode?.closest<HTMLElement>('[data-pms-arc-column-key]')?.dataset.pmsArcColumnKey || ''
    controller.updateColumnPreference(action, key, actionNode?.closest('input')?.checked)
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'jump-page') { const value = Number(rootElement()?.querySelector<HTMLInputElement>('[data-pms-arc-jump]')?.value); if (Number.isInteger(value) && value > 0) { state.currentPage = Math.min(value, Math.max(1,Math.ceil(filteredRows().length / state.preferences.pageSize))); controller.refresh({overlays:false}) } return true }
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
    state.overlay = { kind: 'detail', archiveId: actionNode?.dataset.archiveId || '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-edit') {
    operationId = nextPmsActionId('supply-archive'); dirty = false
    state.overlay = { kind: 'edit', archiveId: actionNode?.dataset.archiveId || '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'convert') {
    updateConversionResult()
    return true
  }
  if (action === 'submit-edit') {
    if (state.overlay?.kind === 'edit' || state.overlay?.kind === 'new') await submitEdit(state.overlay.kind === 'edit' ? state.overlay.archiveId : '')
    return true
  }
  if (action === 'close-overlay') {
    await closePmsSupplyArchiveOverlays()
    return true
  }
  return false
}
