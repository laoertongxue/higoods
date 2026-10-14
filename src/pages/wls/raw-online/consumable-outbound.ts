// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowDetailDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderFormDialog } from '../../../components/ui/dialog.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { createOnlineListController, type OnlineListController } from './shared.ts'
import { RAW_WAREHOUSE_15, consumableOutboundSeed, WAREHOUSE_ATTR_OPTIONS, type ConsumableOutboundRow } from './seed.ts'

const EVENT_PREFIX = 'wls-online-consumable-outbound'
const DATA_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())

const statusClass: Record<string, string> = {
  '待出库': 'bg-orange-50 text-orange-700',
  '已出库': 'bg-emerald-50 text-emerald-700',
  '已取消': 'bg-slate-100 text-slate-400',
}

const controller: OnlineListController<ConsumableOutboundRow> = createOnlineListController<ConsumableOutboundRow>({
  prefix: EVENT_PREFIX,
  preferenceKey: '/wls/online/consumable-outbound:list-columns',
  seed: consumableOutboundSeed,
  exportFileName: '耗材出库列表',
  resetLabel: '清除',
  showExport: false,
  columns: [
    { key: 'select', title: '勾选', width: 56, required: true, freezeable: true, leadingControlColumn: true,
      render: r => `<input type="checkbox" class="h-4 w-4 cursor-pointer accent-blue-600" aria-label="选择 ${escapeHtml(r.outboundNo)}" data-${EVENT_PREFIX}-field="row-select" data-${EVENT_PREFIX}-id="${escapeHtml(r.id)}" ${controller.state.selected.has(r.id) ? 'checked' : ''}>` },
    { key: 'outboundNo', title: '单号', width: 190, required: true, freezeable: true, sortable: true, sortValue: r => r.outboundNo,
      render: r => `<div class="flex flex-col gap-0.5"><span class="font-mono text-xs text-blue-600">${escapeHtml(r.outboundNo)}</span><span class="text-[11px] font-mono text-slate-400">${escapeHtml(r.relatedNo)}</span></div>` },
    { key: 'spu', title: '物料 SPU', width: 150, sortable: true, sortValue: r => r.spu,
      render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.spu)}</span>` },
    { key: 'sku', title: '物料 SKU', width: 180, sortable: true, sortValue: r => r.sku,
      render: r => `<div class="flex flex-col gap-0.5"><span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span><span class="text-[11px] text-slate-400">${escapeHtml(r.productName)}</span></div>` },
    { key: 'warehouse', title: '出库仓库', width: 140, sortable: true, sortValue: r => r.warehouse,
      render: r => `<span class="text-slate-700">${escapeHtml(r.warehouse)}</span>` },
    { key: 'outboundType', title: '出库类型', width: 140, sortable: true, sortValue: r => r.outboundType,
      render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.outboundType)}</span>` },
    { key: 'status', title: '出库状态', width: 110, sortable: true, sortValue: r => r.status,
      render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status] || 'bg-slate-100 text-slate-600'}">${escapeHtml(r.status)}</span>` },
    { key: 'time', title: '时间', width: 150, sortable: true, sortValue: r => r.time,
      render: r => `<span class="text-slate-400 text-xs">${escapeHtml(r.time)}</span>` },
  ],
  filters: [
    { key: 'keyword', label: '搜索', placeholder: '出库单号 / 关联单号 / 物料 SKU', span: 2 },
    { key: 'whAttr', label: '仓库属性', kind: 'select', options: WAREHOUSE_ATTR_OPTIONS.map((attr) => ({ value: attr, label: attr })) },
    { key: 'warehouse', label: '仓库名称', kind: 'select', options: RAW_WAREHOUSE_15.map((warehouse) => ({ value: warehouse.name, label: `${warehouse.name}（${warehouse.attr}）` })) },
  ],
  statusTabs: [
    { key: 'all', label: '全部', match: () => true },
    { key: 'pending', label: '待出库', match: (row) => row.status === '待出库' },
    { key: 'done', label: '已出库', match: (row) => row.status === '已出库' },
    { key: 'canceled', label: '已取消', match: (row) => row.status === '已取消' },
  ],
  rowMatches: (row, filters) => {
    if (filters.whAttr && row.warehouseAttr !== filters.whAttr) return false
    if (filters.warehouse && row.warehouse !== filters.warehouse) return false
    const keyword = (filters.keyword || '').trim().toLowerCase()
    if (!keyword) return true
    return `${row.outboundNo} ${row.relatedNo} ${row.spu} ${row.sku}`.toLowerCase().includes(keyword)
  },
  onAction: ({ action, node, controller: c }) => {
    const rowId = node.dataset[`${DATA_PREFIX}RowId`] || ''
    const row = c.config.seed.find((item) => item.id === rowId)
    if (action === 'view' && row) { c.openDialog('detail', c.config.seed.indexOf(row)); return true }
    if (action === 'create-outbound') { c.openDialog('create-outbound'); return true }
    if (action === 'save-outbound') { c.feedback('出库单已创建'); c.closeDialog(); return true }
    return false
  },
})

function renderConsumableOutboundPage(): string {
  const view = controller.view()
  const seed = controller.config.seed
  return renderStandardListPage({
    title: '出库单列表（耗材出库）',
    description: '用于查看出库前置单据，包含单号、商品、收货单位、货主与出库时间等信息。',
    primaryActionsHtml: renderPrimaryButton('手动创建出库单', { prefix: EVENT_PREFIX, action: 'create-outbound' }, 'plus'),
    statusTabsHtml: view.statusTabsHtml,
    filtersHtml: view.filtersHtml,
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${seed.length} 条` },
      { label: '待出库', value: `${seed.filter((row) => row.status === '待出库').length} 条` },
      { label: '已出库', value: `${seed.filter((row) => row.status === '已出库').length} 条` },
      { label: '已取消', value: `${seed.filter((row) => row.status === '已取消').length} 条` },
    ]),
    listTitle: '耗材出库列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns: controller.config.columns, rows: view.rows, preferences: controller.state.preferences, sort: controller.state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无耗材出库单' }),
    paginationHtml: renderTablePagination({ total: view.filtered.length, from: view.filtered.length ? (controller.state.currentPage - 1) * controller.state.preferences.pageSize + 1 : 0, to: Math.min(controller.state.currentPage * controller.state.preferences.pageSize, view.filtered.length), currentPage: controller.state.currentPage, totalPages: Math.max(1, Math.ceil(view.filtered.length / controller.state.preferences.pageSize)), pageSize: controller.state.preferences.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [10, 20, 50] }),
    overlaysHtml: [
      controller.state.showColumnSettings ? renderStandardListColumnSettings({ title: '耗材出库列设置', columns: controller.config.columns, preferences: controller.state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 430 }) : '',
      controller.state.dialogKey === 'detail' && view.dialogRow ? renderStandardRowDetailDialog({ title: '耗材出库单详情', columns: controller.config.columns, row: view.dialogRow, eventPrefix: EVENT_PREFIX }) : '',
      controller.state.dialogKey === 'create-outbound' ? renderFormDialog(
        { title: '手动创建出库单', closeAction: { prefix: EVENT_PREFIX, action: 'close-dialog' }, submitAction: { prefix: EVENT_PREFIX, action: 'save-outbound', label: '创建出库单' }, width: 'lg' },
        `<div class="grid grid-cols-2 gap-x-6 gap-y-3">
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">关联单号</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">出库仓库</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">物料 SKU</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">出库数量</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" data-skip-page-rerender="true"></label>
        </div>`,
      ) : '',
    ].join(''),
  })
}

export function renderConsumableOutboundListPage(): string {
  controller.entry()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderConsumableOutboundPage()}</div></div>`
}

export function handleConsumableOutboundListPageEvent(target: HTMLElement, event?: Event): boolean {
  return controller.handle(target, event)
}

controller.setRenderer(renderConsumableOutboundPage)
