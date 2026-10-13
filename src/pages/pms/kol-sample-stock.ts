// @page-pattern: list
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import { renderProcessFilterToggle, renderProcessOrderStats, renderProcessSelectionHeader, syncProcessSelectionHeader } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import {
  type PmsKolBrand,
  type PmsKolPositioning,
  type PmsKolStockRow,
  PmsKolBrandList,
  PmsKolPositioningList,
  filterPmsKolStock,
  generatePmsKolLinkCode,
  listPmsKolStock,
  releasePmsKolLock,
  summarizePmsKolStock,
} from '../../data/pms/kol-sample-stock.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import { hydratePmsSurface, renderPmsBusinessImage, renderPmsFeedback, renderPmsOverlayError } from './shared.ts'

const EVENT_PREFIX = 'pms-kst'
const ROOT_SELECTOR = '[data-pms-kst-root]'

interface KolStockPageState extends ProcessOrderListControllerState {
  search: string
  brand: '' | PmsKolBrand
  positioning: '' | PmsKolPositioning
  stockAtLeast: string
  stockAtMost: string
  lockedStatus: '' | '全部SKU' | '有锁定'
  selectedSkus: string[]
  overlay:
    | null
    | { kind: 'lock'; clientActionId: string; qty: number }
    | { kind: 'link-result'; clientActionId: string; url: string }
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const state: KolStockPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  search: '',
  brand: '',
  positioning: '',
  stockAtLeast: '',
  stockAtMost: '',
  lockedStatus: '全部SKU',
  selectedSkus: [],
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function filter(): PmsKolStockFilterShape {
  return {
    search: state.search,
    brand: state.brand,
    positioning: state.positioning,
    stockAtLeast: state.stockAtLeast ? Number(state.stockAtLeast) : undefined,
    stockAtMost: state.stockAtMost ? Number(state.stockAtMost) : undefined,
    lockedStatus: state.lockedStatus,
  }
}

type PmsKolStockFilterShape = Parameters<typeof filterPmsKolStock>[0]

function filteredRows(): PmsKolStockRow[] {
  return filterPmsKolStock(filter())
}

const columns: StandardListColumn<PmsKolStockRow>[] = [
  {
    key: 'select',
    title: '',
    width: 44,
    required: true,
    leadingControlColumn: true,
    renderHeader: (rows) => renderProcessSelectionHeader(rows.map((r) => r.sku), new Set(state.selectedSkus), EVENT_PREFIX),
    render: (row) => `<input type="checkbox" class="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500" data-${EVENT_PREFIX}-field="select-row" data-sku="${escapeHtml(row.sku)}" ${state.selectedSkus.includes(row.sku) ? 'checked' : ''}>`,
  },
  {
    key: 'product',
    title: '商品信息',
    width: 280,
    required: true,
    render: (row) => `<div class="flex items-start gap-2"><div class="shrink-0">${renderPmsBusinessImage(row.imageUrl, `${row.spu} ${row.productName}`, 'h-11 w-11')}</div><div class="min-w-0 flex-1"><div class="truncate font-medium text-blue-700">${escapeHtml(row.sku)}</div><div class="mt-0.5 text-[11px] text-slate-500">SPU: ${escapeHtml(row.spu)}</div><div class="text-[11px] text-slate-500">名称: ${escapeHtml(row.productName)}</div></div></div>`,
  },
  {
    key: 'brandPositioning',
    title: '品牌 / 商品定位',
    width: 160,
    render: (row) => `<div class="font-medium">${escapeHtml(row.brand)}</div><div class="text-[11px] text-slate-500">${escapeHtml(row.positioning)}</div>`,
  },
  {
    key: 'kolStock',
    title: 'KOL库存',
    width: 100,
    sortable: true,
    sortValue: (row) => row.kolStock,
    render: (row) => `<span class="tabular-nums text-base font-semibold">${row.kolStock}</span>`,
  },
  {
    key: 'vkolManualLockedPool',
    title: 'VKOL当日手动锁定池',
    width: 160,
    sortable: true,
    sortValue: (row) => row.vkolManualLockedPool,
    render: (row) => {
      if (row.vkolManualLockedPool <= 0) return '<span class="text-xs text-slate-400">—</span>'
      return `<span class="tabular-nums text-amber-700">${row.vkolManualLockedPool}</span>`
    },
  },
  {
    key: 'lockedOccupied',
    title: '锁定已占用',
    width: 110,
    sortable: true,
    sortValue: (row) => row.lockedOccupied,
    render: (row) => {
      if (row.lockedOccupied <= 0) return '<span class="text-xs text-slate-400">—</span>'
      return `<span class="tabular-nums text-rose-700">${row.lockedOccupied}</span>`
    },
  },
  {
    key: 'actions',
    title: '操作',
    width: 120,
    actionColumn: true,
    required: true,
    render: (row) => {
      const hasLock = row.vkolManualLockedPool > 0 || row.lockedOccupied > 0
      return `<button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-2 py-1 text-xs ${hasLock ? 'text-blue-700 hover:bg-blue-50' : 'text-slate-300'} disabled:text-slate-300" data-${EVENT_PREFIX}-action="release-row" data-sku="${escapeHtml(row.sku)}" ${hasLock ? '' : 'disabled'} data-skip-page-rerender="true">释放</button>`
    },
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/kol-sample-stock',
  pageSizeOptions: [10, 20, 50, 100],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-kst-table-surface]',
  paginationSurfaceSelector: '[data-pms-kst-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-kst-overlays]',
  defaultFrozenKeys: ['product'],
  columnSettingsTitle: 'KOL库存列设置',
  emptyText: '当前条件下暂无 KOL 库存 SKU',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function syncSelectionButtons(): void {
  const root = rootElement()
  if (!root) return
  root.querySelectorAll<HTMLButtonElement>(`[data-${EVENT_PREFIX}-action="release-selected"], [data-${EVENT_PREFIX}-action="lock-selected"], [data-${EVENT_PREFIX}-action="create-link-selected"]`).forEach((button) => {
    button.disabled = state.selectedSkus.length === 0
  })
  const titleNode = root.querySelector<HTMLElement>('[data-standard-list-table-section] h2')
  if (titleNode) titleNode.textContent = `共 ${filteredRows().length} 条${state.selectedSkus.length ? ` · 已选 ${state.selectedSkus.length} 条` : ''}`
  syncProcessSelectionHeader(root)
}

function renderFilters(): string {
  const brandOptions = PmsKolBrandList.map((b) => `<option value="${b}" ${state.brand === b ? 'selected' : ''}>${b}</option>`).join('')
  const positioningOptions = PmsKolPositioningList.map((p) => `<option value="${p}" ${state.positioning === p ? 'selected' : ''}>${p}</option>`).join('')
  const lockedOptions = ['全部SKU', '有锁定']
    .map((opt) => `<option value="${opt}" ${state.lockedStatus === opt ? 'selected' : ''}>${opt}</option>`).join('')
  const advancedCount = [state.positioning, state.stockAtLeast, state.stockAtMost].filter((v) => v !== '' && v !== '全部').length
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">SPU / SKU</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="可批量查询" value="${escapeHtml(state.search)}" data-${EVENT_PREFIX}-field="search" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">品牌</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="brand" data-skip-page-rerender="true">${brandOptions}</select></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">商品定位</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="positioning" data-skip-page-rerender="true">${positioningOptions}</select></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">KOL库存 最小</span><input class="h-9 w-full rounded-md border px-3 text-sm" type="number" min="0" value="${escapeHtml(state.stockAtLeast)}" data-${EVENT_PREFIX}-field="stockAtLeast" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">KOL库存 最大</span><input class="h-9 w-full rounded-md border px-3 text-sm" type="number" min="0" value="${escapeHtml(state.stockAtMost)}" data-${EVENT_PREFIX}-field="stockAtMost" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">锁定情况</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="lockedStatus" data-skip-page-rerender="true">${lockedOptions}</select></label>
  </div>
  <div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
  </div>
  <div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-2 text-xs text-slate-500">已展开高级条件(商品定位、KOL库存区间)</div></div>
  </div>`
}

function renderStats(): string {
  const stats = summarizePmsKolStock(filter())
  const items = [
    { label: '本页 SKU 数', value: stats.totalSkus },
    { label: 'KOL 库存合计', value: stats.totalKolStock },
    { label: 'VKOL 当日手动锁定池', value: stats.totalVkolManualLockedPool },
    { label: '锁定已占用', value: stats.totalLockedOccupied },
  ]
  return renderProcessOrderStats(items)
}

function renderTopActions(): string {
  const today = new Date().toISOString().slice(0, 10)
  return `<div class="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3">
    <button type="button" class="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300" data-${EVENT_PREFIX}-action="lock-selected" disabled data-skip-page-rerender="true">批量锁定 VKOL 库存</button>
    <button type="button" class="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:bg-slate-300" data-${EVENT_PREFIX}-action="release-selected" disabled data-skip-page-rerender="true">批量释放锁定</button>
    <button type="button" class="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300" data-${EVENT_PREFIX}-action="create-link-selected" disabled data-skip-page-rerender="true">生成对外样品池链接</button>
    <span class="ml-auto text-xs text-slate-500">当前锁定日期: ${escapeHtml(today)}</span>
  </div>`
}

function renderLockOverlay(clientActionId: string, qty: number): string {
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="批量锁定 VKOL 库存"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭"></button><section class="relative z-10 flex h-full w-[420px] max-w-[92vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">批量锁定 VKOL 库存</h2><p class="mt-1 text-xs text-slate-500">对所选 SKU 设置本次手动锁定数量</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    ${renderPmsOverlayError(state.overlayError)}
    <label class="flex flex-col gap-1 text-xs text-muted-foreground">锁定数量(每个 SKU)
      <input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="1" value="${qty}" data-${EVENT_PREFIX}-overlay-qty="1" data-skip-page-rerender="true" />
    </label>
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3" data-pms-kst-lock="${escapeHtml(clientActionId)}">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('确认锁定', { prefix: EVENT_PREFIX, action: 'submit-lock' }, 'check-check')}</footer></section></div>`
}

function renderLinkResultOverlay(clientActionId: string, url: string): string {
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="生成对外样品池链接"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭"></button><section class="relative z-10 flex h-full w-[480px] max-w-[92vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">已生成对外样品池链接</h2><p class="mt-1 text-xs text-slate-500">原型仅记录链接,真实提交由 manage.higood.ai 处理</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    <div class="rounded-md border bg-slate-50 p-3 text-sm">
      <div class="text-xs text-slate-500">链接地址</div>
      <div class="mt-1 break-all font-mono">${escapeHtml(url)}</div>
    </div>
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3" data-pms-kst-link-result="${escapeHtml(clientActionId)}">${renderSecondaryButton('复制', { prefix: EVENT_PREFIX, action: 'copy-link' }, 'copy')}${renderPrimaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</footer></section></div>`
}

function renderOverlays(): string {
  if (!state.overlay) return ''
  if (state.overlay.kind === 'lock') return renderLockOverlay(state.overlay.clientActionId, state.overlay.qty)
  return renderLinkResultOverlay(state.overlay.clientActionId, state.overlay.url)
}

function renderBody(): string {
  const stats = renderStats()
  const topActions = renderTopActions()
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  const listTitle = `共 ${filteredRows().length} 条${state.selectedSkus.length ? ` · 已选 ${state.selectedSkus.length} 条` : ''}`
  return renderStandardListPage({
    showHeader: false,
    title: 'KOL 库存',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: `<div class="space-y-2">${topActions}${renderFilters()}</div>`,
    statsHtml: stats,
    listTitle,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-kst-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-kst-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-kst-overlays>${renderOverlays()}</div>`,
  })
}

function readOverlayInput(selectorAttr: string): string {
  if (typeof document === 'undefined') return ''
  const overlayRoot = document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-overlays]`)
  if (!overlayRoot) return ''
  const input = overlayRoot.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-${selectorAttr}="1"]`)
  return input?.value ?? ''
}

function handleFieldEvent(target: HTMLElement): void {
  const field = target.dataset[`${EVENT_PREFIX}Field`]
  if (!field) return
  if (field === 'select-row') return
  const value = (target as HTMLInputElement).value
  switch (field) {
    case 'search': state.search = value; break
    case 'brand': state.brand = value as '' | PmsKolBrand; break
    case 'positioning': state.positioning = value as '' | PmsKolPositioning; break
    case 'stockAtLeast': state.stockAtLeast = value; break
    case 'stockAtMost': state.stockAtMost = value; break
    case 'lockedStatus': state.lockedStatus = value as '' | '全部SKU' | '有锁定'; break
  }
}

function handleActionEvent(target: HTMLElement): void {
  const action = target.dataset[`${EVENT_PREFIX}Action`]
  if (!action) return
  switch (action) {
    case 'query':
      state.currentPage = 1
      state.feedback = '已应用筛选条件'
      state.feedbackOk = true
      break
    case 'reset':
      state.search = ''
      state.brand = ''
      state.positioning = ''
      state.stockAtLeast = ''
      state.stockAtMost = ''
      state.lockedStatus = '全部SKU'
      state.currentPage = 1
      state.feedback = '已重置筛选'
      state.feedbackOk = true
      break
    case 'open-column-settings':
      // Handled by controller
      break
    case 'release-row': {
      const sku = target.dataset.sku ?? ''
      const result = releasePmsKolLock([sku])
      if (result.failedSkus.length) {
        state.feedback = `释放失败: SKU ${result.failedSkus.join(', ')} 不存在`
        state.feedbackOk = false
      } else if (result.released === 0) {
        state.feedback = '该 SKU 当前没有可释放的锁定'
        state.feedbackOk = true
      } else {
        state.feedback = `已释放 ${sku} 的 ${result.released} 件锁定`
        state.feedbackOk = true
      }
      state.selectedSkus = state.selectedSkus.filter((s) => s !== sku)
      break
    }
    case 'release-selected': {
      if (state.selectedSkus.length === 0) {
        state.feedback = '请先选择要释放的 SKU'
        state.feedbackOk = false
        return
      }
      const result = releasePmsKolLock(state.selectedSkus)
      if (result.failedSkus.length) {
        state.feedback = `部分 SKU 不存在: ${result.failedSkus.join(', ')}`
        state.feedbackOk = false
      } else if (result.released === 0) {
        state.feedback = '所选 SKU 当前没有可释放的锁定'
        state.feedbackOk = true
      } else {
        state.feedback = `已释放 ${result.released} 件锁定(共 ${state.selectedSkus.length} 个 SKU)`
        state.feedbackOk = true
      }
      state.selectedSkus = []
      break
    }
    case 'lock-selected': {
      if (state.selectedSkus.length === 0) {
        state.feedback = '请先选择要锁定的 SKU'
        state.feedbackOk = false
        return
      }
      state.overlay = { kind: 'lock', clientActionId: `kst-lock-${Date.now()}`, qty: 1 }
      state.overlayError = ''
      break
    }
    case 'submit-lock': {
      if (!state.overlay || state.overlay.kind !== 'lock') return
      const qty = Number(readOverlayInput('overlay-qty'))
      if (!Number.isFinite(qty) || qty <= 0) {
        state.overlayError = '请输入大于 0 的锁定数量'
        return
      }
      const ok = releasePmsKolLock(state.selectedSkus)
      if (ok.failedSkus.length) {
        state.overlayError = `部分 SKU 不存在: ${ok.failedSkus.join(', ')}`
        return
      }
      // Re-locking uses lockPmsKolStockBatch; here we just demo via direct mutation through selected entries.
      // Use listPmsKolStock to find rows and adjust.
      for (const sku of state.selectedSkus) {
        const row = listPmsKolStock().find((r) => r.sku === sku)
        if (!row) continue
        row.vkolManualLockedPool += qty
      }
      state.feedback = `已对 ${state.selectedSkus.length} 个 SKU 各锁定 ${qty} 件`
      state.feedbackOk = true
      state.overlay = null
      state.selectedSkus = []
      break
    }
    case 'create-link-selected': {
      if (state.selectedSkus.length === 0) {
        state.feedback = '请先选择要加入样品池的 SKU'
        state.feedbackOk = false
        return
      }
      const result = generatePmsKolLinkCode()
      state.overlay = { kind: 'link-result', clientActionId: `kst-link-${Date.now()}`, url: result.url }
      state.overlayError = ''
      state.feedback = `已为 ${state.selectedSkus.length} 个 SKU 生成对外样品池链接,真实提交由 manage.higood.ai 处理`
      state.feedbackOk = true
      break
    }
    case 'copy-link': {
      if (!state.overlay || state.overlay.kind !== 'link-result') return
      const url = state.overlay.url
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(url).catch(() => undefined)
      }
      state.feedback = '链接已复制(原型模拟)'
      state.feedbackOk = true
      break
    }
    case 'close-overlay':
      state.overlay = null
      state.overlayError = ''
      break
    default:
      break
  }
}

function handleChangeEvent(target: HTMLElement): void {
  if (target.dataset[`${EVENT_PREFIX}Field`] === 'select-row') {
    const sku = target.dataset.sku ?? ''
    if (target instanceof HTMLInputElement && target.checked) {
      if (!state.selectedSkus.includes(sku)) state.selectedSkus.push(sku)
    } else {
      state.selectedSkus = state.selectedSkus.filter((s) => s !== sku)
    }
    syncSelectionButtons()
  }
}

export function renderPmsKolStockPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, false)
  const html = renderBody()
  queueMicrotask(() => {
    const root = rootElement()
    hydratePmsSurface(root)
    syncSelectionButtons()
  })
  return html
}

export function handlePmsKolStockEvent(event: Event): void {
  const target = event.target as HTMLElement
  if (!target || typeof target.closest !== 'function') return
  const actionable = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-field], [data-${EVENT_PREFIX}-action]`)
  if (!actionable || !rootElement()?.contains(actionable)) return
  if (actionable.dataset[`${EVENT_PREFIX}Action`]) {
    handleActionEvent(actionable)
  } else if (actionable.dataset[`${EVENT_PREFIX}Field`]) {
    if (event.type === 'change') handleChangeEvent(actionable)
    else handleFieldEvent(actionable)
  }
}

export function closePmsKolStockOverlays(): void {
  state.overlay = null
  state.overlayError = ''
}
