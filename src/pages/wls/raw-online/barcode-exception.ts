// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowDetailDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderFormDialog } from '../../../components/ui/dialog.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { createOnlineListController } from './shared.ts'
import { barcodeExceptionSeed, type BarcodeExceptionRow } from './seed.ts'

const EVENT_PREFIX = 'wls-online-barcode-exception'
const DATA_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())

const statusClass: Record<string, string> = {
  '待审核': 'bg-orange-50 text-orange-700',
  '待处理': 'bg-amber-50 text-amber-700',
  '处理完成': 'bg-emerald-50 text-emerald-700',
  '已驳回': 'bg-slate-100 text-slate-400',
}

const WAREHOUSES = ['GT面料仓', 'holis面料仓', 'HILON-裁片仓', '面料中央仓', 'HILON-面料仓', 'GUDANG BARU-1']

const controller = createOnlineListController<BarcodeExceptionRow>({
  prefix: EVENT_PREFIX,
  preferenceKey: '/wls/online/barcode-exception:list-columns',
  seed: barcodeExceptionSeed,
  exportFileName: '面料条码异常',
  queryLabel: '搜索',
  resetLabel: '清除',
  showExport: false,
  columns: [
    { key: 'exceptionNo', title: '异常单号', width: 150, required: true, freezeable: true, sortable: true, sortValue: r => r.exceptionNo,
      render: r => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.exceptionNo)}</span>` },
    { key: 'spu', title: 'SPU', width: 150, sortable: true, sortValue: r => r.spu,
      render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.spu)}</span>` },
    { key: 'sku', title: 'SKU', width: 180, sortable: true, sortValue: r => r.sku,
      render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
    { key: 'location', title: '仓库 | 库区 | 库位', width: 190, sortable: true, sortValue: r => r.warehouse,
      render: r => `<div class="flex flex-col gap-0.5"><span class="text-slate-700">${escapeHtml(r.warehouse)}</span><span class="text-[11px] text-slate-400">${escapeHtml(r.zone)} · ${escapeHtml(r.location)}</span></div>` },
    { key: 'handledRolls', title: '处理卷数', width: 100, align: 'right', sortable: true, sortValue: r => r.handledRolls,
      render: r => `<span class="text-slate-700 font-medium">${r.handledRolls} 卷</span>` },
    { key: 'operators', title: '操作人【创建 | 审核 | 处理】', width: 210, sortable: true, sortValue: r => r.createdBy,
      render: r => `<div class="flex flex-col gap-0.5 text-[11px] text-slate-500"><span>创建：${escapeHtml(r.createdBy)}</span><span>审核：${escapeHtml(r.auditedBy)}</span><span>处理：${escapeHtml(r.handledBy)}</span></div>` },
    { key: 'status', title: '状态', width: 110, sortable: true, sortValue: r => r.status,
      render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status] || 'bg-slate-100 text-slate-600'}">${escapeHtml(r.status)}</span>` },
    { key: 'times', title: '时间【创建 | 审核 | 完成】', width: 210, sortable: true, sortValue: r => r.createTime,
      render: r => `<div class="flex flex-col gap-0.5 text-[11px] text-slate-400"><span>创建：${escapeHtml(r.createTime)}</span><span>审核：${escapeHtml(r.auditTime)}</span><span>完成：${escapeHtml(r.doneTime)}</span></div>` },
    { key: 'actions', title: '操作', width: 130, required: true, actionColumn: true,
      render: r => {
        const rowId = escapeHtml(r.id)
        const buttons: string[] = [`<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view" data-${EVENT_PREFIX}-row-id="${rowId}">查看</button>`]
        if (r.status === '待审核' || r.status === '待处理') {
          buttons.push(`<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-${EVENT_PREFIX}-action="handle" data-${EVENT_PREFIX}-row-id="${rowId}">处理</button>`)
        }
        return `<div class="flex items-center gap-1">${buttons.join('')}</div>`
      } },
  ],
  filters: [
    { key: 'keyword', label: '搜索', placeholder: '单号 / SPU / SKU', span: 2 },
    { key: 'warehouse', label: '仓库', kind: 'select', options: WAREHOUSES.map((name) => ({ value: name, label: name })) },
    { key: 'status', label: '状态', kind: 'select', options: ['待审核', '待处理', '处理完成', '已驳回'].map((status) => ({ value: status, label: status })) },
  ],
  rowMatches: (row, filters) => {
    if (filters.warehouse && row.warehouse !== filters.warehouse) return false
    if (filters.status && row.status !== filters.status) return false
    const keyword = (filters.keyword || '').trim().toLowerCase()
    if (!keyword) return true
    return `${row.exceptionNo} ${row.spu} ${row.sku}`.toLowerCase().includes(keyword)
  },
  onAction: ({ action, node, controller: c }) => {
    const rowId = node.dataset[`${DATA_PREFIX}RowId`] || ''
    const row = c.config.seed.find((item) => item.id === rowId)
    if (action === 'view' && row) { c.openDialog('detail', c.config.seed.indexOf(row)); return true }
    if (action === 'create-exception') { c.openDialog('create-exception'); return true }
    if (action === 'save-exception') { c.feedback('异常单已创建'); c.closeDialog(); return true }
    if (action === 'handle' && row && (row.status === '待审核' || row.status === '待处理')) {
      row.status = '处理完成'
      row.handledBy = '仓库主管'
      row.doneTime = '2026-10-14 16:50'
      c.feedback(`异常单 ${row.exceptionNo} 已处理完成`)
      c.refresh()
      return true
    }
    return false
  },
})

function renderBarcodeExceptionPage(): string {
  const view = controller.view()
  const seed = controller.config.seed
  return renderStandardListPage({
    title: '面料条码异常',
    description: '创建异常单后审核，处理页可编辑本单内任意状态条码属性（仅本功能处理入口可编辑）。',
    primaryActionsHtml: renderPrimaryButton('创建异常单', { prefix: EVENT_PREFIX, action: 'create-exception' }, 'plus'),
    filtersHtml: view.filtersHtml,
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${seed.length} 条` },
      { label: '待审核', value: `${seed.filter((row) => row.status === '待审核').length} 条` },
      { label: '待处理', value: `${seed.filter((row) => row.status === '待处理').length} 条` },
      { label: '处理完成', value: `${seed.filter((row) => row.status === '处理完成').length} 条` },
    ]),
    listTitle: '面料条码异常单',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns: controller.config.columns, rows: view.rows, preferences: controller.state.preferences, sort: controller.state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无条码异常单' }),
    paginationHtml: renderTablePagination({ total: view.filtered.length, from: view.filtered.length ? (controller.state.currentPage - 1) * controller.state.preferences.pageSize + 1 : 0, to: Math.min(controller.state.currentPage * controller.state.preferences.pageSize, view.filtered.length), currentPage: controller.state.currentPage, totalPages: Math.max(1, Math.ceil(view.filtered.length / controller.state.preferences.pageSize)), pageSize: controller.state.preferences.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [10, 20, 50] }),
    overlaysHtml: [
      controller.state.showColumnSettings ? renderStandardListColumnSettings({ title: '条码异常列设置', columns: controller.config.columns, preferences: controller.state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 430 }) : '',
      controller.state.dialogKey === 'detail' && view.dialogRow ? renderStandardRowDetailDialog({ title: '条码异常单详情', columns: controller.config.columns, row: view.dialogRow, eventPrefix: EVENT_PREFIX }) : '',
      controller.state.dialogKey === 'create-exception' ? renderFormDialog(
        { title: '创建异常单', description: '选择仓库、SKU 与处理卷数后创建异常单', closeAction: { prefix: EVENT_PREFIX, action: 'close-dialog' }, submitAction: { prefix: EVENT_PREFIX, action: 'save-exception', label: '创建异常单' }, width: 'lg' },
        `<div class="grid grid-cols-2 gap-x-6 gap-y-3">
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">仓库</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="仅面料仓" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">SKU</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="SKU" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">库区 / 库位</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="库区 / 库位" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">处理卷数</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="卷数" data-skip-page-rerender="true"></label>
        </div>`,
      ) : '',
    ].join(''),
  })
}

export function renderBarcodeExceptionListPage(): string {
  controller.entry()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderBarcodeExceptionPage()}</div></div>`
}

export function handleBarcodeExceptionListPageEvent(target: HTMLElement, event?: Event): boolean {
  return controller.handle(target, event)
}

controller.setRenderer(renderBarcodeExceptionPage)
