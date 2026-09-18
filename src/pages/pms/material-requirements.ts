// @page-pattern: list
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import { getPmsMaterial } from '../../data/pms/materials.ts'
import {
  checkPmsMaterialRequirementPush,
  listPmsMaterialPurchaseOrders,
  pushPmsMaterialRequirement,
  type PmsRequirementPushLineInput,
} from '../../data/pms/material-purchase-orders.ts'
import { listPmsMaterialRequirements, type PmsMaterialRequirement, type PmsMaterialRequirementLine } from '../../data/pms/material-requirements.ts'
import { nextPmsActionId, PMS_BUYER_ACTOR, PmsDomainError } from '../../data/pms/runtime.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import {
  formatPmsQty,
  formatPmsTime,
  handlePmsCommonImageEvent,
  hydratePmsSurface,
  readTextField,
  renderPmsBusinessImage,
  renderPmsFeedback,
  renderPmsImagePreview,
  renderPmsOverlayError,
  renderPmsStatusBadge,
} from './shared.ts'

type RequirementOverlay =
  | null
  | { kind: 'detail'; requirementNo: string; clientActionId: string }
  | { kind: 'push'; requirementNo: string; clientActionId: string }

interface RequirementPageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | PmsMaterialRequirement['status']
  overlay: RequirementOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-mreq'
const ROOT_SELECTOR = '[data-pms-mreq-root]'

const state: RequirementPageState = {
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

function filteredRows(): PmsMaterialRequirement[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsMaterialRequirements().filter((requirement) => {
    if (state.status && requirement.status !== state.status) return false
    if (!keyword) return true
    return [requirement.requirementNo, requirement.sourcePurchaseOrderNo, requirement.productName, ...requirement.lines.map((line) => line.materialName)].some((value) => value.toLowerCase().includes(keyword))
  })
}

function requirementTone(status: PmsMaterialRequirement['status']): 'blue' | 'green' | 'yellow' {
  if (status === '已下推') return 'green'
  if (status === '部分下推') return 'blue'
  return 'yellow'
}

const columns: StandardListColumn<PmsMaterialRequirement>[] = [
  {
    key: 'requirement',
    title: '需求单 / 来源',
    width: 210,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.requirementNo,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.requirementNo)}</div><div class="mt-1 text-xs text-slate-500">来源 ${escapeHtml(row.sourcePurchaseOrderNo || '—')}${row.sourceSuggestionNo ? ` · ${escapeHtml(row.sourceSuggestionNo)}` : ''}</div><div class="mt-1 text-xs text-slate-500">${formatPmsTime(row.createdAt)}</div>`,
  },
  {
    key: 'style',
    title: '款式',
    width: 220,
    required: true,
    freezeable: true,
    render: (row) => `<div class="flex items-center gap-3">${renderPmsBusinessImage(row.styleImageUrl, `${row.productName}款式图`, 'h-12 w-12')}<div><div class="font-medium">${escapeHtml(row.productName)}</div><div class="text-xs text-slate-500">${escapeHtml(row.spu)}</div></div></div>`,
  },
  {
    key: 'lines',
    title: '物料行 / 待下推',
    width: 170,
    render: (row) => {
      const pending = row.lines.filter((line) => line.pushStatus === '待下推').length
      return `<div class="text-sm">共 <strong>${row.lines.length}</strong> 行</div><div class="mt-1 text-xs ${pending > 0 ? 'text-amber-700' : 'text-emerald-700'}">待下推 ${pending} 行</div><div class="mt-1 text-xs text-slate-500">建议合计 ${formatPmsQty(row.lines.reduce((sum, line) => sum + line.suggestedQty, 0))}</div>`
    },
  },
  {
    key: 'status',
    title: '状态',
    width: 110,
    sortable: true,
    sortValue: (row) => row.status,
    render: (row) => renderPmsStatusBadge(row.status, requirementTone(row.status)),
  },
  {
    key: 'actions',
    title: '操作',
    width: 170,
    actionColumn: true,
    render: (row) => {
      const check = checkPmsMaterialRequirementPush(row.requirementNo)
      return `<div class="flex items-center justify-end gap-1.5">
        <button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-detail" data-requirement-no="${escapeHtml(row.requirementNo)}" data-skip-page-rerender="true">查看明细</button>
        <button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-push" data-requirement-no="${escapeHtml(row.requirementNo)}" data-skip-page-rerender="true" ${check.ok ? '' : 'disabled'}>下推采购单</button>
      </div>`
    },
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/material-requirements',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-mreq-table-surface]',
  paginationSurfaceSelector: '[data-pms-mreq-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-mreq-overlays]',
  defaultFrozenKeys: ['requirement', 'style'],
  columnSettingsTitle: '面辅料需求列设置',
  emptyText: '当前条件下暂无面辅料需求单',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  const statuses: Array<'' | PmsMaterialRequirement['status']> = ['', '已生成', '部分下推', '已下推']
  const options = statuses.map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const advancedCount = state.status ? 1 : 0
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="需求单号 / 来源采购单 / 款式 / 物料" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">下推状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${options}</select></label>
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  const pendingLines = rows.flatMap((row) => row.lines).filter((line) => line.pushStatus === '待下推')
  return renderProcessOrderStats([
    { label: '需求单总数', value: rows.length },
    { label: '待下推行', value: pendingLines.length },
    { label: '建议采购量', value: formatPmsQty(pendingLines.reduce((sum, line) => sum + line.suggestedQty, 0)) },
    { label: '已生成采购单', value: listPmsMaterialPurchaseOrders().filter((order) => rows.some((row) => row.requirementNo === order.requirementNo)).length },
  ])
}

function renderLineRow(requirement: PmsMaterialRequirement, line: PmsMaterialRequirementLine, editable: boolean): string {
  const blocked = line.suggestedQty <= 0
  const price = getPmsMaterial(line.materialCode)?.referencePurchasePrice ?? 0
  const input = editable
    ? `<input class="h-8 w-24 rounded-md border px-2 text-sm ${blocked ? 'bg-slate-100 text-slate-400' : ''}" type="number" min="0" step="0.01" value="${blocked ? 0 : line.actualQty}" ${blocked ? 'disabled' : ''} data-${EVENT_PREFIX}-push-qty="${escapeHtml(line.lineNo)}" data-skip-page-rerender="true" />`
    : `<span class="tabular-nums">${formatPmsQty(line.actualQty, line.unit)}</span>`
  const priceInput = editable
    ? `<input class="h-8 w-24 rounded-md border px-2 text-sm ${blocked ? 'bg-slate-100 text-slate-400' : ''}" type="number" min="0" step="0.01" value="${price}" ${blocked ? 'disabled' : ''} data-${EVENT_PREFIX}-push-price="${escapeHtml(line.lineNo)}" data-skip-page-rerender="true" />`
    : `<span class="tabular-nums">¥${price.toFixed(2)}</span>`
  return `<tr class="border-b last:border-b-0">
    <td class="px-3 py-2"><div class="flex items-center gap-3">${renderPmsBusinessImage(line.imageUrl, `${line.materialName}（${line.materialCode}）实物图`, 'h-11 w-11')}<div><div class="font-medium">${escapeHtml(line.materialName)}</div><div class="text-xs text-slate-500">${escapeHtml(line.materialCode)} · ${escapeHtml(line.materialType)} · ${escapeHtml(line.unit)}</div><div class="text-xs text-slate-500">单件用量 ${line.plannedUsage} · 损耗 ${Math.round(line.lossRate * 100)}%</div></div></div></td>
    <td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(line.bomDemand, line.unit)}</td>
    <td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(line.stockQty, line.unit)}</td>
    <td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(line.historicalStockQty, line.unit)}</td>
    <td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(line.idHistoricalStockQty, line.unit)}</td>
    <td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(line.purchasingQty, line.unit)}</td>
    <td class="px-3 py-2 text-sm font-semibold tabular-nums">${formatPmsQty(line.suggestedQty, line.unit)}</td>
    <td class="px-3 py-2">${input}</td>
    <td class="px-3 py-2">${priceInput}</td>
    <td class="px-3 py-2 text-sm">${escapeHtml(line.supplierName || '未指定')}</td>
    <td class="px-3 py-2">${line.pushStatus === '已下推' ? renderPmsStatusBadge(`已下推 ${line.generatedPurchaseOrderNo}`, 'green') : renderPmsStatusBadge(line.suggestedQty > 0 ? '待下推' : '建议为 0', line.suggestedQty > 0 ? 'yellow' : 'slate')}</td>
  </tr>`
}

function renderLineTable(requirement: PmsMaterialRequirement, editable: boolean): string {
  return `<div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left" style="min-width: 1180px"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="w-72 px-3 py-2">物料</th><th class="w-24 px-3 py-2">BOM 需求</th><th class="w-20 px-3 py-2">库存</th><th class="w-24 px-3 py-2">历史库存</th><th class="w-28 px-3 py-2">ID 历史库存</th><th class="w-20 px-3 py-2">采购中</th><th class="w-24 px-3 py-2">建议采购</th><th class="w-28 px-3 py-2">实际采购</th><th class="w-28 px-3 py-2">采购单价</th><th class="w-40 px-3 py-2">供应商</th><th class="w-36 px-3 py-2">下推状态</th></tr></thead><tbody>${requirement.lines.map((line) => renderLineRow(requirement, line, editable)).join('')}</tbody></table></div>`
}

function renderDetailOverlay(requirementNo: string): string {
  const requirement = listPmsMaterialRequirements().find((row) => row.requirementNo === requirementNo)
  if (!requirement) return ''
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="面辅料需求明细"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭明细"></button><section class="relative z-10 flex h-full w-[1080px] max-w-[96vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(requirement.requirementNo)} · ${escapeHtml(requirement.productName)}</h2><p class="mt-1 text-xs text-slate-500">来源 ${escapeHtml(requirement.sourcePurchaseOrderNo)} · ${escapeHtml(requirement.status)} · ${formatPmsTime(requirement.createdAt)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    <div class="flex items-center gap-4">${renderPmsBusinessImage(requirement.styleImageUrl, `${requirement.productName}款式图`, 'h-20 w-20')}<dl class="grid flex-1 grid-cols-3 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">状态</dt><dd class="mt-1">${renderPmsStatusBadge(requirement.status, requirementTone(requirement.status))}</dd></div><div><dt class="text-xs text-muted-foreground">物料行</dt><dd class="mt-1">${requirement.lines.length} 行</dd></div><div><dt class="text-xs text-muted-foreground">来源建议</dt><dd class="mt-1">${escapeHtml(requirement.sourceSuggestionNo || '手工/生产采购单生成')}</dd></div></dl></div>
    ${renderLineTable(requirement, false)}
    <p class="text-xs text-slate-500">BOM 需求 = SKU 数量 × 单件用量 × (1 + 损耗)；建议采购量 = max(0, BOM 需求 − 库存 − 采购中)。</p>
  </div></section></div>`
}

function renderPushOverlay(requirementNo: string): string {
  const requirement = listPmsMaterialRequirements().find((row) => row.requirementNo === requirementNo)
  if (!requirement) return ''
  const check = checkPmsMaterialRequirementPush(requirementNo)
  const pushable = requirement.lines.filter((line) => line.pushStatus === '待下推' && line.suggestedQty > 0).length
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="下推面辅料采购单" data-pms-mreq-push-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭下推"></button><section class="relative z-10 flex h-full w-[900px] max-w-[96vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">下推面辅料采购单</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(requirementNo)} · 建议采购量为 0 的行不能下推，缺供应商的行会被阻断</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="flex-1 space-y-4 overflow-y-auto p-4">${renderPmsOverlayError(state.overlayError)}
    <p class="rounded-md border bg-muted/30 px-3 py-2 text-sm text-slate-700">实际采购数量默认为建议采购量，可按供应商报价调整；下推后生成面辅料采购单，状态为“待采购”。可下推 ${pushable} 行。</p>
    ${renderLineTable(requirement, true)}
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('确认下推生成采购单', { prefix: EVENT_PREFIX, action: 'submit-push' }, 'check-check').replace('<button', `<button ${check.ok ? '' : 'disabled'}`)}</footer></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-mreq-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return `${columnSettings}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'detail') return `${columnSettings}${renderDetailOverlay(state.overlay.requirementNo)}${renderPmsImagePreview()}`
  return `${columnSettings}${renderPushOverlay(state.overlay.requirementNo)}${renderPmsImagePreview()}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: false,
    title: '面辅料需求分析',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2"><span class="text-xs text-muted-foreground">由商品采购单按 BOM 生成，下推后进入面辅料采购单</span>${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-mreq-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-mreq-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-mreq-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-mreq-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function closeOverlay(): void {
  state.overlay = null
  state.overlayError = ''
  refreshOverlays()
}

function exportRows(): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前查询条件下没有可导出的面辅料需求。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    '面辅料需求分析.csv',
    ['需求单号', '来源采购单', '款式', 'SPU', '状态', '物料编码', '物料名称', '单位', 'BOM需求', '库存', '历史库存', 'ID历史库存', '采购中', '建议采购量', '实际采购量', '供应商', '下推状态', '生成采购单'],
    rows.flatMap((row) =>
      row.lines.map((line) => [row.requirementNo, row.sourcePurchaseOrderNo, row.productName, row.spu, row.status, line.materialCode, line.materialName, line.unit, line.bomDemand, line.stockQty, line.historicalStockQty, line.idHistoricalStockQty, line.purchasingQty, line.suggestedQty, line.actualQty, line.supplierName, line.pushStatus, line.generatedPurchaseOrderNo]),
    ),
  )
  state.feedback = `已导出 ${rows.length} 张需求单的全部物料行。`
  state.feedbackOk = true
  refreshAll()
}

function submitPush(requirementNo: string): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-mreq-push-root]')
  if (!surface) return
  const requirement = listPmsMaterialRequirements().find((row) => row.requirementNo === requirementNo)
  if (!requirement) return
  const inputs: PmsRequirementPushLineInput[] = []
  requirement.lines.forEach((line) => {
    if (line.pushStatus !== '待下推' || line.suggestedQty <= 0) return
    const qty = Number.parseFloat(surface.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-push-qty="${line.lineNo}"]`)?.value ?? '')
    const price = Number.parseFloat(surface.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-push-price="${line.lineNo}"]`)?.value ?? '')
    if (Number.isFinite(qty) && qty > 0) inputs.push({ lineNo: line.lineNo, actualQty: qty, unitPrice: Number.isFinite(price) ? price : 0 })
  })
  try {
    const created = pushPmsMaterialRequirement(requirementNo, inputs, PMS_BUYER_ACTOR)
    state.feedback = `已下推生成 ${created.length} 张面辅料采购单：${created.map((order) => order.purchaseOrderNo).join('、')}`
    state.feedbackOk = true
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '下推面辅料采购单失败'
    refreshOverlays()
  }
}

export function renderPmsMaterialRequirementsPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-mreq-root data-skip-page-rerender="true"><style>[data-pms-mreq-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsMaterialRequirementOverlays(): boolean {
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

export function handlePmsMaterialRequirementsEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    closeOverlay()
    return true
  }

  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsMreqField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as RequirementPageState['status']
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
  const action = actionNode?.dataset.pmsMreqAction
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
    const key = actionNode?.closest<HTMLElement>('[data-pms-mreq-column-key]')?.dataset.pmsMreqColumnKey || ''
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
    state.overlay = { kind: 'detail', requirementNo: actionNode?.dataset.requirementNo || '', clientActionId: nextPmsActionId('pms-mreq-detail') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-push') {
    state.overlay = { kind: 'push', requirementNo: actionNode?.dataset.requirementNo || '', clientActionId: nextPmsActionId('pms-mreq-push') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'close-overlay') {
    closeOverlay()
    return true
  }
  if (action === 'submit-push') {
    if (state.overlay?.kind === 'push') submitPush(state.overlay.requirementNo)
    return true
  }
  return false
}

export function getPmsMaterialRequirementRowCountForTest(): number {
  return filteredRows().length
}
