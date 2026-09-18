// @page-pattern: list
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
  type PmsSupplyArchive,
  type PmsSupplyArchiveUnit,
} from '../../data/pms/supplier-supply-archives.ts'
import { PmsDomainError } from '../../data/pms/runtime.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
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

type ArchiveOverlay = null | { kind: 'detail'; archiveId: string } | { kind: 'edit'; archiveId: string }

interface ArchivePageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | '有效' | '停用'
  overlay: ArchiveOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-arc'
const ROOT_SELECTOR = '[data-pms-arc-root]'
const BUYER = { id: 'USR-PMS-WANG', name: '王采购', role: '采购员' as const }

const state: ArchivePageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsSupplyArchive[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsSupplyArchives().filter((archive) => {
    if (state.status && archive.status !== state.status) return false
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
    render: (row) => `<div class="font-semibold">${escapeHtml(row.supplierName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.supplierCode)}</div><div class="mt-1 text-xs text-slate-500">供货周期 ${row.leadTimeDays} 天</div>`,
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
    render: (row) => `<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5"><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-detail" data-archive-id="${escapeHtml(row.archiveId)}" data-skip-page-rerender="true">换算与快照</button><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-edit" data-archive-id="${escapeHtml(row.archiveId)}" data-skip-page-rerender="true">编辑档案</button></div>`,
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
  paginationSurfaceSelector: '[data-pms-arc-pagination-surface]',
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
  const statusOptions = ['', '有效', '停用'].map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const advancedCount = state.status ? 1 : 0
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="供应商 / 物料编码 / 物料名称" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    <span class="ml-auto text-xs text-muted-foreground">采购单保存包装快照，档案变化不影响历史采购单</span>
    </div></div>`
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
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="供货档案详情" data-pms-arc-detail-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭详情"></button><section class="relative z-10 flex h-full w-[720px] max-w-[94vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(archive.supplierName)} · ${escapeHtml(archive.materialName)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(archive.materialCode)} · 基础单位 ${escapeHtml(archive.baseUnit)} · V${archive.version}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
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

function renderEditOverlay(archiveId: string): string {
  const archive = getPmsSupplyArchive(archiveId)
  if (!archive) return ''
  return `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="编辑供货档案" data-pms-arc-edit-root><section class="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl bg-background p-5 shadow-2xl"><header class="mb-4 flex items-center justify-between"><h2 class="font-semibold">编辑档案 ${escapeHtml(archiveId)}</h2>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header>${renderPmsOverlayError(state.overlayError)}
    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">包装单位<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(archive.packageUnit)}" data-${EVENT_PREFIX}-edit-field="packageUnit" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">每包装数量（${escapeHtml(archive.baseUnit)}）<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0.01" step="0.01" value="${archive.packageQty}" data-${EVENT_PREFIX}-edit-field="packageQty" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">每箱包装数<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="1" step="1" value="${archive.boxQty}" data-${EVENT_PREFIX}-edit-field="boxQty" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">报价<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="${archive.price}" data-${EVENT_PREFIX}-edit-field="price" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">币种<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-edit-field="currency" data-skip-page-rerender="true">${['RMB', 'USD'].map((value) => `<option value="${value}" ${archive.currency === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">最小起订量<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="${archive.minOrderQty}" data-${EVENT_PREFIX}-edit-field="minOrderQty" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">供货周期（天）<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="1" step="1" value="${archive.leadTimeDays}" data-${EVENT_PREFIX}-edit-field="leadTimeDays" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">状态<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-edit-field="status" data-skip-page-rerender="true">${['有效', '停用'].map((value) => `<option value="${value}" ${archive.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
    </div>
    <p class="mt-3 rounded-md border bg-muted/30 px-3 py-2 text-xs text-slate-600">保存后版本号 +1 并生成包装快照；历史采购单已保存的快照不变。</p>
    <footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存并生成快照', { prefix: EVENT_PREFIX, action: 'submit-edit' }, 'check-check')}</footer></section></div>`
}

function refreshImageSurface(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-arc-image-surface]')
  if (surface) surface.innerHTML = renderPmsImagePreview()
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-arc-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return columnSettings
  if (state.overlay.kind === 'detail') return `${columnSettings}${renderDetailOverlay(state.overlay.archiveId)}`
  return `${columnSettings}${renderDetailOverlay(state.overlay.archiveId)}${renderEditOverlay(state.overlay.archiveId)}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: false,
    title: '供应商供货档案',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-arc-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-arc-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-arc-overlays>${renderOverlays()}</div><div data-pms-arc-image-surface>${renderPmsImagePreview()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
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

function submitEdit(archiveId: string): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-arc-edit-root]')
  if (!surface) return
  try {
    const archive = updatePmsSupplyArchive(
      archiveId,
      {
        packageUnit: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="packageUnit"]`),
        packageQty: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="packageQty"]`),
        boxQty: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="boxQty"]`),
        price: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="price"]`),
        currency: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="currency"]`) as 'RMB' | 'USD',
        minOrderQty: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="minOrderQty"]`),
        leadTimeDays: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="leadTimeDays"]`),
        status: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="status"]`) as '有效' | '停用',
      },
      BUYER,
    )
    state.feedback = `${archiveId} 已更新到 V${archive.version} 并生成包装快照。`
    state.feedbackOk = true
    state.overlay = { kind: 'detail', archiveId }
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '保存供货档案失败，请检查填写内容'
    refreshOverlays()
  }
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
    ['档案号', '供应商编码', '供应商', '物料编码', '物料名称', '基础单位', '包装单位', '每包装数量', '每箱包装数', '报价', '币种', '起订量', '供货周期', '版本', '状态'],
    rows.map((row) => [row.archiveId, row.supplierCode, row.supplierName, row.materialCode, row.materialName, row.baseUnit, row.packageUnit, row.packageQty, row.boxQty, row.price, row.currency, row.minOrderQty, row.leadTimeDays, row.version, row.status]),
  )
  state.feedback = `已导出 ${rows.length} 条供货档案（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

export function renderPmsSupplierSupplyArchivesPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-arc-root data-skip-page-rerender="true"><style>[data-pms-arc-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsSupplyArchiveOverlays(): boolean {
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

export function handlePmsSupplyArchivesEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshImageSurface)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    closePmsSupplyArchiveOverlays()
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
  if (action === 'query') {
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.status = ''
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
    if (state.overlay?.kind === 'edit') submitEdit(state.overlay.archiveId)
    return true
  }
  if (action === 'close-overlay') {
    closePmsSupplyArchiveOverlays()
    return true
  }
  return false
}
