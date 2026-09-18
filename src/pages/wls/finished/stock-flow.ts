// @page-pattern: list
import type { AppState } from '../../../state/store'
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn, type StandardListHeaderGroup } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'

type StockFlowRecord = {
  id: string;
  operateTime: string;
  warehouseName: string;
  spu: string;
  sku: string;
  productName: string;
  businessNo: string;
  docType: string;
  actionType: string;
  inboundChange: number;
  inboundBefore: number;
  putawayChange: number;
  putawayBefore: number;
  transferChange: number;
  transferBefore: number;
  pickChange: number;
  pickBefore: number;
  outboundChange: number;
  outboundBefore: number;
  locationCode: string;
  operatorName: string;
  operationTime: string;
  remark: string;
};

const STOCK_FLOW_SEED: StockFlowRecord[] = (() => {
  const docTypes = ['入库单', '上架单', '调拨单', '拣货单', '出库单'];
  const actionTypes = ['入库', '上架', '库内调拨', '拣货', '出库'];
  const warehouses = ['中央总仓-成衣仓', '成衣仓-深圳仓01', '成衣仓-武汉仓01'];
  const locations = ['A01-01', 'A01-02', 'A02-03', 'B01-02', 'B03-01', 'C01-01', 'C02-01'];
  const operators = ['张仓管', '李操作员', '王组长', '赵仓管', '刘操作员'];
  const records: StockFlowRecord[] = [];

  for (let i = 0; i < 56; i++) {
    const actionIdx = i % 5;
    const change = 5 + (i * 3) % 30;
    const before = 50 + (i * 7) % 200;
    const dayOffset = Math.floor(i / 10);
    const baseDate = new Date(2026, 8, 18 - dayOffset, 8 + (i % 10), (i * 13) % 60);
    const timeStr = baseDate.toISOString().slice(0, 16).replace('T', ' ');

    records.push({
      id: `SF-${String(i + 1).padStart(5, '0')}`,
      operateTime: timeStr,
      warehouseName: warehouses[i % warehouses.length],
      spu: `SPU-GC-${String(10001 + (i % 20)).padStart(5, '0')}`,
      sku: `SKU-GC-${String(20001 + i).padStart(5, '0')}`,
      productName: ['黑色连衣裙 M', '白色短袖 L', '灰色百褶裙 M', '卡其夹克 S', '蓝色牛仔裤 L'][i % 5],
      businessNo: `BZ2026${String(5000 + i).padStart(6, '0')}`,
      docType: docTypes[actionIdx],
      actionType: actionTypes[actionIdx],
      inboundChange: actionIdx === 0 ? change : 0,
      inboundBefore: actionIdx === 0 ? before : 0,
      putawayChange: actionIdx === 1 ? change : 0,
      putawayBefore: actionIdx === 1 ? before : 0,
      transferChange: actionIdx === 2 ? change : 0,
      transferBefore: actionIdx === 2 ? before : 0,
      pickChange: actionIdx === 3 ? -change : 0,
      pickBefore: actionIdx === 3 ? before : 0,
      outboundChange: actionIdx === 4 ? -change : 0,
      outboundBefore: actionIdx === 4 ? before : 0,
      locationCode: locations[i % locations.length],
      operatorName: operators[i % operators.length],
      operationTime: timeStr,
      remark: i % 8 === 0 ? '进入质检区' : '',
    });
  }
  return records;
})();

const EVENT_PREFIX = 'wls-stock-flow'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/finished/stock-flow:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 20 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  warehouseFilter: '' as string,
  docTypeFilter: '' as string,
  actionTypeFilter: '' as string,
}

function metricChangeClass(v: number): string {
  return v > 0 ? 'text-emerald-700 font-semibold' : v < 0 ? 'text-red-700 font-semibold' : 'text-slate-500'
}

function formatChange(v: number): string {
  return v > 0 ? `+${v}` : `${v}`
}

const columns: StandardListColumn<StockFlowRecord>[] = [
  { key: 'operateTime', title: '发生时间', width: 150, required: true, freezeable: true, sortable: true, sortValue: r => r.operateTime,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.operateTime)}</span>` },
  { key: 'warehouseName', title: '仓库名称', width: 160, required: true, freezeable: true, sortable: true, sortValue: r => r.warehouseName,
    render: r => `<span class="text-slate-700">${escapeHtml(r.warehouseName)}</span>` },
  { key: 'spu', title: '商品SPU', width: 160, required: true, freezeable: true, sortable: true, sortValue: r => r.spu,
    render: r => `<span class="text-blue-600 font-mono text-xs">${escapeHtml(r.spu)}</span>` },
  { key: 'sku', title: '商品SKU', width: 160, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="text-blue-600 font-mono text-xs">${escapeHtml(r.sku)}</span>` },
  { key: 'productName', title: '商品名称', width: 150, sortable: true, sortValue: r => r.productName,
    render: r => `<span class="text-slate-700">${escapeHtml(r.productName)}</span>` },
  { key: 'businessNo', title: '业务单号', width: 150, sortable: true, sortValue: r => r.businessNo,
    render: r => `<span class="text-blue-600 font-mono text-xs">${escapeHtml(r.businessNo)}</span>` },
  { key: 'docType', title: '单据类型', width: 100, sortable: true, sortValue: r => r.docType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.docType)}</span>` },
  { key: 'actionType', title: '动作类型', width: 100, sortable: true, sortValue: r => r.actionType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.actionType)}</span>` },
  // Metric columns: 入库
  { key: 'inboundChange', title: '入库变动', width: 100, align: 'right', sortable: true, sortValue: r => r.inboundChange,
    render: r => `<span class="${metricChangeClass(r.inboundChange)}">${formatChange(r.inboundChange)}</span>` },
  { key: 'inboundBefore', title: '入库变动前', width: 100, align: 'right', sortable: true, sortValue: r => r.inboundBefore,
    render: r => `<span class="text-slate-600">${r.inboundBefore}</span>` },
  { key: 'inboundAfter', title: '入库变动后', width: 100, align: 'right',
    render: r => `<span class="text-slate-700">${r.inboundBefore + r.inboundChange}</span>` },
  // Metric columns: 上架
  { key: 'putawayChange', title: '上架变动', width: 100, align: 'right', sortable: true, sortValue: r => r.putawayChange,
    render: r => `<span class="${metricChangeClass(r.putawayChange)}">${formatChange(r.putawayChange)}</span>` },
  { key: 'putawayBefore', title: '上架变动前', width: 100, align: 'right', sortable: true, sortValue: r => r.putawayBefore,
    render: r => `<span class="text-slate-600">${r.putawayBefore}</span>` },
  { key: 'putawayAfter', title: '上架变动后', width: 100, align: 'right',
    render: r => `<span class="text-slate-700">${r.putawayBefore + r.putawayChange}</span>` },
  // Metric columns: 库内调拨
  { key: 'transferChange', title: '调拨变动', width: 100, align: 'right', sortable: true, sortValue: r => r.transferChange,
    render: r => `<span class="${metricChangeClass(r.transferChange)}">${formatChange(r.transferChange)}</span>` },
  { key: 'transferBefore', title: '调拨变动前', width: 100, align: 'right', sortable: true, sortValue: r => r.transferBefore,
    render: r => `<span class="text-slate-600">${r.transferBefore}</span>` },
  { key: 'transferAfter', title: '调拨变动后', width: 100, align: 'right',
    render: r => `<span class="text-slate-700">${r.transferBefore + r.transferChange}</span>` },
  // Metric columns: 拣货
  { key: 'pickChange', title: '拣货变动', width: 100, align: 'right', sortable: true, sortValue: r => r.pickChange,
    render: r => `<span class="${metricChangeClass(r.pickChange)}">${formatChange(r.pickChange)}</span>` },
  { key: 'pickBefore', title: '拣货变动前', width: 100, align: 'right', sortable: true, sortValue: r => r.pickBefore,
    render: r => `<span class="text-slate-600">${r.pickBefore}</span>` },
  { key: 'pickAfter', title: '拣货变动后', width: 100, align: 'right',
    render: r => `<span class="text-slate-700">${r.pickBefore + r.pickChange}</span>` },
  // Metric columns: 出库
  { key: 'outboundChange', title: '出库变动', width: 100, align: 'right', sortable: true, sortValue: r => r.outboundChange,
    render: r => `<span class="${metricChangeClass(r.outboundChange)}">${formatChange(r.outboundChange)}</span>` },
  { key: 'outboundBefore', title: '出库变动前', width: 100, align: 'right', sortable: true, sortValue: r => r.outboundBefore,
    render: r => `<span class="text-slate-600">${r.outboundBefore}</span>` },
  { key: 'outboundAfter', title: '出库变动后', width: 100, align: 'right',
    render: r => `<span class="text-slate-700">${r.outboundBefore + r.outboundChange}</span>` },
  // Tail columns
  { key: 'locationCode', title: '库位', width: 100, sortable: true, sortValue: r => r.locationCode,
    render: r => `<span class="text-slate-600">${escapeHtml(r.locationCode)}</span>` },
  { key: 'operatorName', title: '操作人', width: 100, sortable: true, sortValue: r => r.operatorName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.operatorName)}</span>` },
  { key: 'operationTime', title: '操作时间', width: 150, sortable: true, sortValue: r => r.operationTime,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.operationTime)}</span>` },
  { key: 'remark', title: '备注', width: 140, sortable: true, sortValue: r => r.remark,
    render: r => r.remark.includes('质检区')
      ? `<span class="inline-flex items-center gap-1"><span class="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">退货质检入区</span><span class="text-slate-500 text-xs">${escapeHtml(r.remark)}</span></span>`
      : `<span class="text-slate-500 text-xs">${escapeHtml(r.remark)}</span>` },
]

const headerGroups: StandardListHeaderGroup[] = [
  { key: 'inbound', title: '入库', columnKeys: ['inboundChange', 'inboundBefore', 'inboundAfter'] },
  { key: 'putaway', title: '上架', columnKeys: ['putawayChange', 'putawayBefore', 'putawayAfter'] },
  { key: 'transfer', title: '库内调拨', columnKeys: ['transferChange', 'transferBefore', 'transferAfter'] },
  { key: 'pick', title: '拣货', columnKeys: ['pickChange', 'pickBefore', 'pickAfter'] },
  { key: 'outbound', title: '出库', columnKeys: ['outboundChange', 'outboundBefore', 'outboundAfter'] },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['operateTime', 'warehouseName', 'spu'],
  pageSize: PAGE_SIZE_OPTIONS[1],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): StockFlowRecord[] {
  const kw = state.keyword.trim().toLowerCase()
  return STOCK_FLOW_SEED.filter(r => {
    if (state.warehouseFilter && r.warehouseName !== state.warehouseFilter) return false
    if (state.docTypeFilter && r.docType !== state.docTypeFilter) return false
    if (state.actionTypeFilter && r.actionType !== state.actionTypeFilter) return false
    if (!kw) return true
    return `${r.businessNo} ${r.spu} ${r.sku} ${r.productName} ${r.warehouseName} ${r.locationCode}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  const warehouses = [...new Set(STOCK_FLOW_SEED.map(r => r.warehouseName))]
  const docTypes = [...new Set(STOCK_FLOW_SEED.map(r => r.docType))]
  const actionTypes = [...new Set(STOCK_FLOW_SEED.map(r => r.actionType))]
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="业务单号 / SPU / SKU / 商品 / 仓库 / 库位" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">仓库</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="warehouse"><option value="">全部仓库</option>${warehouses.map(w => `<option value="${escapeHtml(w)}" ${state.warehouseFilter === w ? 'selected' : ''}>${escapeHtml(w)}</option>`).join('')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">单据类型</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="docType"><option value="">全部单据类型</option>${docTypes.map(d => `<option value="${escapeHtml(d)}" ${state.docTypeFilter === d ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">动作类型</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="actionType"><option value="">全部动作类型</option>${actionTypes.map(a => `<option value="${escapeHtml(a)}" ${state.actionTypeFilter === a ? 'selected' : ''}>${escapeHtml(a)}</option>`).join('')}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '库存流水查询',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '总记录数', value: `${STOCK_FLOW_SEED.length} 条` },
      { label: '入库', value: `${STOCK_FLOW_SEED.filter(r => r.actionType === '入库').length} 条` },
      { label: '出库', value: `${STOCK_FLOW_SEED.filter(r => r.actionType === '出库').length} 条` },
      { label: '拣货', value: `${STOCK_FLOW_SEED.filter(r => r.actionType === '拣货').length} 条` },
    ]),
    listTitle: '流水记录列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, headerGroups, emptyText: '暂无库存流水' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '库存流水列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 600 }) : '',
  })
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-root]`)
}

function refreshWorkspace(): void {
  const host = document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-workspace]`)
  if (!host) return
  host.innerHTML = renderWorkspace()
  hydrateIcons(host)
}

export function renderFinishedStockFlow(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleStockFlowEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'warehouse') { state.warehouseFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'docType') { state.docTypeFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'actionType') { state.actionTypeFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'pageSize' && event?.type === 'change') {
      state.preferences.pageSize = Number((field as HTMLSelectElement).value)
      state.currentPage = 1
      saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
      refreshWorkspace()
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset[`${DATASET_PREFIX}Action`]
  if (!actionNode || !action) return false
  if (event?.type === 'change' && !['toggle-column-visibility', 'toggle-column-freeze'].includes(action)) return true
  if (action === 'prev-page' || action === 'next-page') {
    state.currentPage = Math.max(1, state.currentPage + (action === 'next-page' ? 1 : -1))
    refreshWorkspace()
    return true
  }
  if (action === 'sort-column') {
    const key = actionNode.dataset.columnKey || actionNode.dataset.column_key || ''
    state.sort = state.sort?.key === key ? (state.sort.direction === 'asc' ? { key, direction: 'desc' } : null) : { key, direction: 'asc' }
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'apply-filter') {
    const input = rootElement()?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="keyword"]`)
    if (input) state.keyword = input.value
    const warehouse = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="warehouse"]`)
    if (warehouse) state.warehouseFilter = warehouse.value
    const docType = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="docType"]`)
    if (docType) state.docTypeFilter = docType.value
    const actionType = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="actionType"]`)
    if (actionType) state.actionTypeFilter = actionType.value
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.warehouseFilter = ''
    state.docTypeFilter = ''
    state.actionTypeFilter = ''
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'open-column-settings') { state.showColumnSettings = true; refreshWorkspace(); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; refreshWorkspace(); return true }
  if (action === 'restore-column-settings') { state.preferences = defaultPreferences(); saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences); refreshWorkspace(); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode.dataset[`${DATASET_PREFIX}ColumnKey`] || actionNode.closest<HTMLElement>(`[data-${EVENT_PREFIX}-column-key]`)?.dataset[`${DATASET_PREFIX}ColumnKey`] || ''
    const col = columns.find(c => c.key === key)
    if (!col || col.actionColumn) return true
    if (action === 'toggle-column-visibility' && col.required) return true
    const prop = action === 'toggle-column-freeze' ? 'frozenKeys' : 'visibleKeys'
    state.preferences[prop] = state.preferences[prop].includes(key) ? state.preferences[prop].filter(k => k !== key) : [...state.preferences[prop], key]
    saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
    refreshWorkspace()
    return true
  }
  if (action === 'export') { exportStandardListRows({ fileName: '库存流水查询', columns, rows: filteredRows() }); return true }
  return false
}
