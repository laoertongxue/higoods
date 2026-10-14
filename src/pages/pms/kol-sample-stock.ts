import { createPmsLocalListInteractions } from './local-list-interactions.ts'
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
  lockPmsKolStockBatch,
  hydratePmsKolStock,
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
    | { kind: 'lock'; clientActionId: string; qty: number; search?:string }
    | { kind: 'release'; clientActionId: string; skus: string[] }
    | { kind: 'link-create'; clientActionId: string }
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
  root.querySelectorAll<HTMLButtonElement>(`[data-${EVENT_PREFIX}-action="release-selected"], [data-${EVENT_PREFIX}-action="create-link-selected"]`).forEach((button) => {
    button.disabled = state.selectedSkus.length === 0
  })
  const titleNode = root.querySelector<HTMLElement>('[data-standard-list-table-section] h2')
  if (titleNode) titleNode.textContent = `共 ${filteredRows().length} 条${state.selectedSkus.length ? ` · 已选 ${state.selectedSkus.length} 条` : ''}`
  syncProcessSelectionHeader(root)
}

function renderFilters(): string {
  const brandOptions = PmsKolBrandList.map((b) => `<option value="${b}" ${state.brand === b ? 'selected' : ''}>${b}</option>`).join('')
  const positioningOptions = `<option value="" ${state.positioning===''?'selected':''}>全部</option>` + PmsKolPositioningList.map((p) => `<option value="${p}" ${state.positioning === p ? 'selected' : ''}>${p}</option>`).join('')
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
    { label: '筛选 SKU 数', value: stats.totalSkus },
    { label: 'KOL 库存合计', value: stats.totalKolStock },
    { label: 'VKOL 当日手动锁定池', value: stats.totalVkolManualLockedPool },
    { label: '锁定已占用', value: stats.totalLockedOccupied },
  ]
  return renderProcessOrderStats(items)
}

function renderTopActions(): string {
  const today = new Date().toISOString().slice(0, 10)
  return `<div class="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3">
    <button type="button" class="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300" data-${EVENT_PREFIX}-action="lock-selected" data-skip-page-rerender="true">批量锁定 VKOL 库存</button>
    <button type="button" class="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:bg-slate-300" data-${EVENT_PREFIX}-action="release-selected" disabled data-skip-page-rerender="true">批量释放锁定</button>
    <button type="button" class="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300" data-${EVENT_PREFIX}-action="create-link-selected" disabled data-skip-page-rerender="true">生成对外样品池链接</button>
    <span class="ml-auto text-xs text-slate-500">当前锁定日期: ${escapeHtml(today)}</span>
  </div>`
}

function renderLockOverlay(clientActionId: string, _qty: number): string {
  const query=state.overlay?.kind==='lock'?state.overlay.search || '':state.search
  const rows = listPmsKolStock().filter(row => !query || `${row.sku} ${row.spu}`.toLowerCase().includes(query.toLowerCase())).slice(0,300)
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="批量锁定库存"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" aria-label="关闭"></button><section class="relative z-10 flex h-full w-[720px] max-w-[96vw] flex-col bg-white"><header class="border-b p-4 font-semibold">批量锁定库存</header><div class="flex-1 overflow-auto p-4"><p class="mb-3 text-sm">设置最终锁定池，数量不能低于已占用或超过 KOL 库存。</p>${renderPmsOverlayError(state.overlayError)}<div class="mb-3 flex flex-wrap gap-2"><input class="h-9 flex-1 rounded border px-2" aria-label="批量锁定 SKU 查询" value="${escapeHtml(query)}" data-kol-lock-query>${renderSecondaryButton('查询SKU',{prefix:EVENT_PREFIX,action:'query-lock-sku'})}</div><div class="mb-3 flex gap-2"><input class="h-9 w-20 rounded border px-2" type="number" min="0" max="100" value="50" data-kol-lock-ratio aria-label="锁定比例百分比"><span class="self-center text-sm">%</span>${renderSecondaryButton('按比例填充勾选项',{prefix:EVENT_PREFIX,action:'fill-lock-ratio'})}${renderSecondaryButton('勾选项清零',{prefix:EVENT_PREFIX,action:'clear-lock-qty'})}</div><table class="w-full text-sm"><thead><tr><th>选择</th><th>SKU</th><th>库存 / 已占用</th><th>最终锁定池（件）</th></tr></thead><tbody>${rows.map(row=>`<tr class="border-t"><td><input type="checkbox" data-kol-lock-select="${escapeHtml(row.sku)}" ${state.selectedSkus.includes(row.sku)?'checked':''}></td><td class="py-2">${escapeHtml(row.sku)}</td><td>${row.kolStock} / ${row.lockedOccupied}</td><td><input class="h-9 w-24 rounded border px-2" type="number" min="${row.lockedOccupied}" max="${row.kolStock}" step="1" value="${row.vkolManualLockedPool}" data-kol-lock-qty="${escapeHtml(row.sku)}" aria-label="${escapeHtml(row.sku)} 最终锁定池"></td></tr>`).join('')}</tbody></table></div><footer class="flex justify-end gap-2 border-t p-4">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-overlay'})}${renderPrimaryButton('确认锁定',{prefix:EVENT_PREFIX,action:'submit-lock'})}</footer></section></div>`
}
function renderReleaseOverlay(skus: string[]): string {
  const quantity = skus.reduce((sum,sku)=>{const row=listPmsKolStock().find(r=>r.sku===sku);return sum+(row?row.vkolManualLockedPool-row.lockedOccupied:0)},0)
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-5" role="dialog" aria-modal="true" aria-label="释放锁定"><section class="w-[440px] max-w-full rounded-lg bg-white p-5"><h2 class="font-semibold">释放锁定</h2><p class="my-4 text-sm">释放 ${skus.length} 个 SKU 的 ${quantity} 件未占用锁定，已占用数量保留。</p>${renderPmsOverlayError(state.overlayError)}<div class="flex justify-end gap-2">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-overlay'})}${renderPrimaryButton('释放未占用锁定',{prefix:EVENT_PREFIX,action:'submit-release'})}</div></section></div>`
}
function renderLinkCreateOverlay(): string {
  return `<div class="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label="创建样品池"><section class="flex h-full w-[480px] max-w-[96vw] flex-col bg-white"><header class="border-b p-4 font-semibold">创建样品池</header><div class="space-y-4 p-4">${renderPmsOverlayError(state.overlayError)}<p class="text-sm">已选择 ${state.selectedSkus.length} 个 SKU</p><label class="block text-sm">样品池名称<input class="mt-1 h-9 w-full rounded border px-2" data-kol-pool-name value="寄样池"></label><label class="block text-sm">最多可选 SKU<input class="mt-1 h-9 w-full rounded border px-2" type="number" min="1" max="${state.selectedSkus.length}" value="${Math.min(3,state.selectedSkus.length)}" data-kol-pool-max></label><label class="block text-sm">有效期<input class="mt-1 h-9 w-full rounded border px-2" type="datetime-local" value="${new Date(Date.now()+7*86400000).toISOString().slice(0,16)}" data-kol-pool-expires></label></div><footer class="mt-auto flex justify-end gap-2 border-t p-4">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-overlay'})}${renderPrimaryButton('创建样品池',{prefix:EVENT_PREFIX,action:'submit-link'})}</footer></section></div>`
}

function renderLinkResultOverlay(clientActionId: string, url: string): string {
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="生成对外样品池链接"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭"></button><section class="relative z-10 flex h-full w-[480px] max-w-[92vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">已生成对外样品池链接</h2><p class="mt-1 text-xs text-slate-500">样品池已保存，可在本浏览器查看并提交寄样申请</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    <div class="rounded-md border bg-slate-50 p-3 text-sm">
      <div class="text-xs text-slate-500">链接地址</div>
      <div class="mt-1 break-all font-mono">${escapeHtml(url)}</div>
    </div>
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3" data-pms-kst-link-result="${escapeHtml(clientActionId)}">${renderSecondaryButton('复制', { prefix: EVENT_PREFIX, action: 'copy-link' }, 'copy')}${renderPrimaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</footer></section></div>`
}

function renderOverlays(): string {
  if (!state.overlay) return ''
  if (state.overlay.kind === 'lock') return renderLockOverlay(state.overlay.clientActionId, state.overlay.qty)
  if (state.overlay.kind === 'release') return renderReleaseOverlay(state.overlay.skus)
  if (state.overlay.kind === 'link-create') return renderLinkCreateOverlay()
  return renderLinkResultOverlay(state.overlay.clientActionId, state.overlay.url)
}

function renderBody(): string {
  const stats = renderStats()
  const topActions = renderTopActions()
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  const listTitle = `共 ${filteredRows().length} 条${state.selectedSkus.length ? ` · 已选 ${state.selectedSkus.length} 条` : ''}`
  return renderStandardListPage({
    showHeader: true,
    title: 'KOL 库存',
    feedbackHtml: `<div data-${EVENT_PREFIX}-feedback>${renderPmsFeedback(state.feedback, state.feedbackOk)}</div>`,
    filtersHtml: `<div data-${EVENT_PREFIX}-filters>${`<div class="space-y-2">${topActions}${renderFilters()}</div>`}</div>`,
    statsHtml: `<div data-${EVENT_PREFIX}-stats>${stats}</div>`,
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
  const field = target.getAttribute(`data-${EVENT_PREFIX}-field`)
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

async function handleActionEvent(target: HTMLElement): Promise<void> {
  const action = target.getAttribute(`data-${EVENT_PREFIX}-action`)
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
    case 'query-lock-sku':if(state.overlay?.kind==='lock') state.overlay.search=rootElement()?.querySelector<HTMLInputElement>('[data-kol-lock-query]')?.value || '';break
    case 'toggle-page': {const checked=target instanceof HTMLInputElement && target.checked;rootElement()?.querySelectorAll<HTMLInputElement>('tbody [data-pms-kst-field="select-row"]').forEach(input=>{const sku=input.dataset.sku || '';state.selectedSkus=checked?[...new Set([...state.selectedSkus,sku])]:state.selectedSkus.filter(item=>item!==sku)});break}
    case 'release-row':
    case 'release-selected': {
      const skus = action === 'release-row' ? [target.dataset.sku || ''] : state.selectedSkus.slice()
      if (!skus.length) throw new Error('请先选择要释放的 SKU')
      state.overlay = {kind:'release',clientActionId:crypto.randomUUID(),skus};state.overlayError='';break
    }
    case 'submit-release': {
      if(state.overlay?.kind !== 'release') return
      const result = await releasePmsKolLock(state.overlay.skus,state.overlay.clientActionId)
      state.feedback = `已释放 ${result.released} 件未占用锁定`;state.feedbackOk=true;state.overlay=null;state.selectedSkus=[];break
    }
    case 'lock-selected':
      state.overlay = {kind:'lock',clientActionId:crypto.randomUUID(),qty:1};state.overlayError='';break
    case 'fill-lock-ratio':
    case 'clear-lock-qty': {
      const root = rootElement()
      const selected = Array.from(root?.querySelectorAll<HTMLInputElement>('[data-kol-lock-select]:checked') || [])
      if(!selected.length) throw new Error('先勾选需要填充的 SKU')
      const ratio = Number(root?.querySelector<HTMLInputElement>('[data-kol-lock-ratio]')?.value || 0)
      if(!Number.isFinite(ratio) || ratio < 0 || ratio > 100) throw new Error('比例须为 0～100')
      selected.forEach(input=>{const sku=input.dataset.kolLockSelect;const row=listPmsKolStock().find(r=>r.sku===sku);const qty=Array.from(root?.querySelectorAll<HTMLInputElement>('[data-kol-lock-qty]') || []).find(x=>x.dataset.kolLockQty===sku);if(row && qty) qty.value=String(action==='clear-lock-qty'?0:Math.max(row.lockedOccupied,Math.floor(row.kolStock*ratio/100)))})
      return
    }
    case 'submit-lock': {
      if(state.overlay?.kind !== 'lock') return
      const root = rootElement()
      const selected = Array.from(root?.querySelectorAll<HTMLInputElement>('[data-kol-lock-select]:checked') || [])
      const entries=selected.map(input=>({sku:input.dataset.kolLockSelect || '',qty:Number(Array.from(root?.querySelectorAll<HTMLInputElement>('[data-kol-lock-qty]') || []).find(x=>x.dataset.kolLockQty===input.dataset.kolLockSelect)?.value)}))
      await lockPmsKolStockBatch(entries,state.overlay.clientActionId)
      state.feedback=`已保存 ${entries.length} 个 SKU 的锁定池`;state.feedbackOk=true;state.overlay=null;state.selectedSkus=[];break
    }
    case 'create-link-selected':
      if(!state.selectedSkus.length) throw new Error('先选择样品 SKU')
      state.overlay={kind:'link-create',clientActionId:crypto.randomUUID()};state.overlayError='';break
    case 'submit-link': {
      if(state.overlay?.kind !== 'link-create') return
      const root=rootElement()
      const result=await generatePmsKolLinkCode(state.selectedSkus,{name:root?.querySelector<HTMLInputElement>('[data-kol-pool-name]')?.value,maxSkuSelection:Number(root?.querySelector<HTMLInputElement>('[data-kol-pool-max]')?.value),expiresAt:root?.querySelector<HTMLInputElement>('[data-kol-pool-expires]')?.value,operationId:state.overlay.clientActionId})
      state.overlay={kind:'link-result',clientActionId:result.linkCode,url:result.url};state.feedback='样品池已保存';state.feedbackOk=true;break
    }
    case 'copy-link': {
      if (!state.overlay || state.overlay.kind !== 'link-result') return
      const url = state.overlay.url
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(new URL(url,window.location.origin).href)
      }
      state.feedback = '链接已复制'
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
  if(target.getAttribute(`data-${EVENT_PREFIX}-field`)==='selection-scope'){const value=(target as HTMLSelectElement).value;state.selectedSkus=value==='all'?filteredRows().map(row=>row.sku):value==='page'?Array.from(rootElement()?.querySelectorAll<HTMLInputElement>('tbody [data-pms-kst-field="select-row"]') || []).map(input=>input.dataset.sku || ''):[];controller.refresh({overlays:false});syncSelectionButtons();return}
  if (target.getAttribute(`data-${EVENT_PREFIX}-field`) === 'select-row') {
    const sku = target.dataset.sku ?? ''
    if (target instanceof HTMLInputElement && target.checked) {
      if (!state.selectedSkus.includes(sku)) state.selectedSkus.push(sku)
    } else {
      state.selectedSkus = state.selectedSkus.filter((s) => s !== sku)
    }
    syncSelectionButtons()
  }
}

export async function renderPmsKolStockPage(): Promise<string> {
  try { ; await hydratePmsKolStock() } catch(error) { state.feedback=error instanceof Error?error.message:"用户数据不可读";state.feedbackOk=false }
  resetStandardListEntryTransientStateOnRouteEntry(state, false)
  const html = `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true">${renderBody()}</div>`
  queueMicrotask(() => {
    const root = rootElement()
    hydratePmsSurface(root)
    local.mount()
    syncSelectionButtons()
  })
  return html
}

const local = createPmsLocalListInteractions({
  prefix: EVENT_PREFIX, state, controller,
  listTitle: () => `共 ${filteredRows().length} 条`,
  filters: () => `<div class="space-y-2">${renderTopActions()}${renderFilters()}</div>`, stats: renderStats,
  feedback: () => renderPmsFeedback(state.feedback, state.feedbackOk), overlays: renderOverlays,
})

export async function handlePmsKolStockEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  if (!rootElement()?.contains(target)) return false
  if (local.handle(target, event)) return true
  const actionable = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-field], [data-${EVENT_PREFIX}-action]`)
  if (!actionable) return false
  const action = actionable.getAttribute(`data-${EVENT_PREFIX}-action`)
  if (action) {
    if (event && event.type !== 'click') return true
    if(action === 'fill-lock-ratio' || action === 'clear-lock-qty') { try { await handleActionEvent(actionable) } catch(error) { state.feedback=error instanceof Error?error.message:'填充失败';state.feedbackOk=false;local.refresh(false,true) }; return true }
    try { await handleActionEvent(actionable) } catch (error) {
      state.feedback = error instanceof Error ? error.message : '操作未保存'
      state.feedbackOk = false
      local.refresh(false,true);return true
    }
    local.refresh(action === 'reset')
    syncSelectionButtons()
  } else {
    if (event?.type === 'change') handleChangeEvent(actionable)
    handleFieldEvent(actionable)
  }
  return true
}

export function closePmsKolStockOverlays(): void {
  state.overlay = null
  state.overlayError = ''
}
