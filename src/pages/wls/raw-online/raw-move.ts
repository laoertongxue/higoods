// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowDetailDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderFormDialog } from '../../../components/ui/dialog.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { createOnlineListController } from './shared.ts'
import { rawMoveSeed, type RawMoveRow } from './seed.ts'

const EVENT_PREFIX = 'wls-online-raw-move'
const DATA_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())

const statusClass: Record<string, string> = {
  '待处理': 'bg-orange-50 text-orange-700',
  '部分完成': 'bg-amber-50 text-amber-700',
  '已完成': 'bg-emerald-50 text-emerald-700',
  '已驳回': 'bg-slate-100 text-slate-400',
}

const controller = createOnlineListController<RawMoveRow>({
  prefix: EVENT_PREFIX,
  preferenceKey: '/wls/online/raw-move:list-columns',
  seed: rawMoveSeed,
  exportFileName: '原料移货',
  queryLabel: '搜索',
  resetLabel: '清除',
  showExport: false,
  columns: [
    { key: 'moveNo', title: '移货单', width: 150, required: true, freezeable: true, sortable: true, sortValue: r => r.moveNo,
      render: r => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.moveNo)}</span>` },
    { key: 'warehouse', title: '仓库名称', width: 150, sortable: true, sortValue: r => r.warehouse,
      render: r => `<span class="text-slate-700">${escapeHtml(r.warehouse)}</span>` },
    { key: 'materialType', title: '物料类型', width: 100, sortable: true, sortValue: r => r.materialType,
      render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.materialType)}</span>` },
    { key: 'fromLocation', title: '源库区库位', width: 120, sortable: true, sortValue: r => r.fromLocation,
      render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.fromLocation)}</span>` },
    { key: 'toLocation', title: '目标库区库位', width: 120, sortable: true, sortValue: r => r.toLocation,
      render: r => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.toLocation)}</span>` },
    { key: 'totalQty', title: '总数量', width: 110, align: 'right', sortable: true, sortValue: r => r.totalQty,
      render: r => `<span class="text-slate-700 font-medium">${r.totalQty} ${escapeHtml(r.unit)}</span>` },
    { key: 'totalRolls', title: '总卷数', width: 100, align: 'right', sortable: true, sortValue: r => r.totalRolls,
      render: r => `<span class="text-slate-600">${r.totalRolls} 卷</span>` },
    { key: 'createTime', title: '创建时间', width: 150, sortable: true, sortValue: r => r.createTime,
      render: r => `<span class="text-slate-400 text-xs">${escapeHtml(r.createTime)}</span>` },
    { key: 'completeTime', title: '完成时间', width: 150, sortable: true, sortValue: r => r.completeTime,
      render: r => `<span class="text-slate-400 text-xs">${escapeHtml(r.completeTime)}</span>` },
    { key: 'status', title: '状态', width: 110, sortable: true, sortValue: r => r.status,
      render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status] || 'bg-slate-100 text-slate-600'}">${escapeHtml(r.status)}</span>` },
    { key: 'operator', title: '操作人', width: 110, sortable: true, sortValue: r => r.operator,
      render: r => `<span class="text-slate-600">${escapeHtml(r.operator)}</span>` },
    { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true,
      render: r => `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view" data-${EVENT_PREFIX}-row-id="${escapeHtml(r.id)}">查看</button></div>` },
  ],
  filters: [
    { key: 'keyword', label: '搜索', placeholder: '移货单号', span: 2 },
    { key: 'warehouse', label: '仓库编码', kind: 'select', options: ['GT面料仓', 'holis面料仓', 'HILON-裁片仓', '面料中央仓'].map((name) => ({ value: name, label: name })) },
  ],
  statusTabs: [
    { key: 'all', label: '全部', match: () => true },
    { key: 'pending', label: '待处理', match: (row) => row.status === '待处理' },
    { key: 'partial', label: '部分完成', match: (row) => row.status === '部分完成' },
    { key: 'done', label: '已完成', match: (row) => row.status === '已完成' },
    { key: 'rejected', label: '已驳回', match: (row) => row.status === '已驳回' },
  ],
  rowMatches: (row, filters) => {
    if (filters.warehouse && row.warehouse !== filters.warehouse) return false
    const keyword = (filters.keyword || '').trim().toLowerCase()
    if (!keyword) return true
    return row.moveNo.toLowerCase().includes(keyword)
  },
  onAction: ({ action, node, controller: c }) => {
    const rowId = node.dataset[`${DATA_PREFIX}RowId`] || ''
    const row = c.config.seed.find((item) => item.id === rowId)
    if (action === 'view' && row) { c.openDialog('detail', c.config.seed.indexOf(row)); return true }
    if (action === 'create-move') { c.openDialog('create-move'); return true }
    if (action === 'save-move') { c.feedback('移货单已创建'); c.closeDialog(); return true }
    return false
  },
})

function renderRawMovePage(): string {
  const view = controller.view()
  const seed = controller.config.seed
  return renderStandardListPage({
    title: '原料移货',
    description: '原料仓库内移货：面料按卷条码、非面料按 SKU 数量，从源库位移动到目标库位。',
    primaryActionsHtml: renderPrimaryButton('新建移货单', { prefix: EVENT_PREFIX, action: 'create-move' }, 'plus'),
    statusTabsHtml: view.statusTabsHtml,
    filtersHtml: view.filtersHtml,
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${seed.length} 条` },
      { label: '待处理', value: `${seed.filter((row) => row.status === '待处理').length} 条` },
      { label: '已完成', value: `${seed.filter((row) => row.status === '已完成').length} 条` },
      { label: '已驳回', value: `${seed.filter((row) => row.status === '已驳回').length} 条` },
    ]),
    listTitle: '原料移货单',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns: controller.config.columns, rows: view.rows, preferences: controller.state.preferences, sort: controller.state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无移货单' }),
    paginationHtml: renderTablePagination({ total: view.filtered.length, from: view.filtered.length ? (controller.state.currentPage - 1) * controller.state.preferences.pageSize + 1 : 0, to: Math.min(controller.state.currentPage * controller.state.preferences.pageSize, view.filtered.length), currentPage: controller.state.currentPage, totalPages: Math.max(1, Math.ceil(view.filtered.length / controller.state.preferences.pageSize)), pageSize: controller.state.preferences.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [10, 20, 50] }),
    overlaysHtml: [
      controller.state.showColumnSettings ? renderStandardListColumnSettings({ title: '原料移货列设置', columns: controller.config.columns, preferences: controller.state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 430 }) : '',
      controller.state.dialogKey === 'detail' && view.dialogRow ? renderStandardRowDetailDialog({ title: '移货单详情', columns: controller.config.columns, row: view.dialogRow, eventPrefix: EVENT_PREFIX }) : '',
      controller.state.dialogKey === 'create-move' ? renderFormDialog(
        { title: '新建移货单', description: '选择源、目标库位与物料后创建移货单', closeAction: { prefix: EVENT_PREFIX, action: 'close-dialog' }, submitAction: { prefix: EVENT_PREFIX, action: 'save-move', label: '创建移货单' }, width: 'lg' },
        `<div class="grid grid-cols-2 gap-x-6 gap-y-3">
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">仓库名称</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="仓库名称" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">物料类型</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="面料 / 辅料 / 耗材 / 纱线 / 包材" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">源库区库位</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="源库位" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">目标库区库位</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="目标库位" data-skip-page-rerender="true"></label>
        </div>`,
      ) : '',
    ].join(''),
  })
}

export function renderRawMoveListPage(): string {
  controller.entry()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderRawMovePage()}</div></div>`
}

export function handleRawMoveListPageEvent(target: HTMLElement, event?: Event): boolean {
  return controller.handle(target, event)
}

controller.setRenderer(renderRawMovePage)
