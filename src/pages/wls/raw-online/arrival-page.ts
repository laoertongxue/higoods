// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowDetailDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderDialog, renderFormDialog } from '../../../components/ui/dialog.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { createOnlineListController, type OnlineListController } from './shared.ts'
import { ARRIVAL_SOURCES, RAW_WAREHOUSE_13, arrivalSeedByKey, type ArrivalRow, type ArrivalSourceConfig, type ArrivalStatus } from './seed.ts'

const statusClass: Record<ArrivalStatus, string> = {
  '待收货': 'bg-orange-50 text-orange-700',
  '部分收货': 'bg-amber-50 text-amber-700',
  '收货完成': 'bg-emerald-50 text-emerald-700',
  '终止收货': 'bg-slate-100 text-slate-400',
}

function makeArrivalColumns(config: ArrivalSourceConfig): StandardListColumn<ArrivalRow>[] {
  const prefix = config.eventPrefix
  return [
    { key: 'source', title: '入库单来源', width: 210, required: true, freezeable: true, sortable: true, sortValue: r => r.sourceNo,
      render: r => `<div class="flex flex-col gap-0.5"><span class="text-slate-700 font-medium">${escapeHtml(r.sourceType)} ${escapeHtml(r.sourceNo)}</span><span class="text-[11px] font-mono text-slate-400">${escapeHtml(r.relatedNo)} · ${escapeHtml(r.productionNo)}</span></div>` },
    { key: 'styleNo', title: '款号', width: 150, sortable: true, sortValue: r => r.styleNo,
      render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.styleNo)}</span>` },
    { key: 'warehouse', title: '入库仓库', width: 150, sortable: true, sortValue: r => r.warehouse,
      render: r => `<div class="flex flex-col gap-0.5"><span class="text-slate-700">${escapeHtml(r.warehouse)}</span><span class="text-[11px] text-slate-400">${escapeHtml(r.warehouseAttr)}</span></div>` },
    { key: 'product', title: '商品明细', width: 230, sortable: true, sortValue: r => r.sku,
      render: r => `<div class="flex flex-col gap-0.5"><span class="text-slate-700">${escapeHtml(r.productName)}</span><span class="text-[11px] font-mono text-slate-400">${escapeHtml(r.sku)}</span><span class="text-[11px] font-mono text-slate-400">${escapeHtml(r.spu)}</span></div>` },
    { key: 'qty', title: '数量', width: 150, sortable: true, sortValue: r => r.planQty,
      render: r => `<div class="flex flex-col gap-0.5"><span class="text-slate-700">计划：${r.planQty} ${escapeHtml(r.unit)}</span><span class="text-slate-400 text-xs">实际：${r.actualQty} ${escapeHtml(r.unit)}</span></div>` },
    { key: 'package', title: '包装数', width: 160, sortable: true, sortValue: r => r.planPackage,
      render: r => `<div class="flex flex-col gap-0.5"><span class="text-slate-700">计划：${r.planPackage} 包装单元</span><span class="text-slate-400 text-xs">实际：${r.actualPackage} 包装单元</span></div>` },
    { key: 'measure', title: '重量 / 标准克重 / 标准数量', width: 190, sortable: true, sortValue: r => r.standardQty,
      render: r => `<div class="flex flex-col gap-0.5"><span class="text-slate-600">重量：${escapeHtml(r.weight)}</span><span class="text-[11px] text-slate-400">标准克重：${escapeHtml(r.gramWeight)} · 标准数量：${r.standardQty}</span></div>` },
    { key: 'time', title: '时间', width: 150, sortable: true, sortValue: r => r.time,
      render: r => `<span class="text-slate-400 text-xs">${escapeHtml(r.time)}</span>` },
    { key: 'status', title: '状态', width: 110, sortable: true, sortValue: r => r.status,
      render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status]}">${escapeHtml(r.status)}</span>` },
    { key: 'actions', title: '操作', width: 220, required: true, actionColumn: true,
      render: r => {
        const canInbound = r.status === '待收货' || r.status === '部分收货'
        const buttons: string[] = []
        if (canInbound) buttons.push(`<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-${prefix}-action="inbound" data-${prefix}-row-id="${escapeHtml(r.id)}">入库</button>`)
        buttons.push(`<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${prefix}-action="view-barcodes" data-${prefix}-row-id="${escapeHtml(r.id)}">查看条码</button>`)
        if (canInbound) buttons.push(`<button class="rounded border border-rose-200 px-2 py-0.5 text-xs text-rose-600 hover:bg-rose-50" data-${prefix}-action="terminate" data-${prefix}-row-id="${escapeHtml(r.id)}">终止收货</button>`)
        buttons.push(`<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${prefix}-action="view-detail" data-${prefix}-row-id="${escapeHtml(r.id)}">查看详情</button>`)
        return `<div class="flex flex-wrap items-center gap-1">${buttons.join('')}</div>`
      } },
  ]
}

function controllerFor(config: ArrivalSourceConfig): OnlineListController<ArrivalRow> {
  return controllers.get(config.key)!
}

const controllers = new Map<ArrivalSourceConfig['key'], OnlineListController<ArrivalRow>>()

for (const config of ARRIVAL_SOURCES) {
  const prefix = config.eventPrefix
  const controller = createOnlineListController<ArrivalRow>({
    prefix,
    preferenceKey: config.preferenceKey,
    columns: makeArrivalColumns(config),
    seed: arrivalSeedByKey(config.key),
    exportFileName: config.title,
    queryLabel: '搜索',
    resetLabel: '清除',
    showExport: false,
    filters: [
      { key: 'keyword', label: '搜索', placeholder: '入库单号 / 关联单号 / 生产单 / SKU / SPU', span: 2 },
      { key: 'warehouseAttr', label: '仓库属性', kind: 'select', options: [
        { value: '面料仓', label: '面料仓' }, { value: '辅料仓', label: '辅料仓' },
        { value: '纱线仓', label: '纱线仓' }, { value: '耗材仓', label: '耗材仓' }, { value: '包材仓', label: '包材仓' },
      ] },
      { key: 'warehouse', label: '入库仓库', kind: 'select', options: RAW_WAREHOUSE_13.map((warehouse) => ({ value: warehouse.name, label: warehouse.name })) },
    ],
    statusTabs: [
      { key: 'all', label: '全部', match: () => true },
      { key: 'pending', label: '待收货', match: (row) => row.status === '待收货' },
      { key: 'partial', label: '部分收货', match: (row) => row.status === '部分收货' },
      { key: 'done', label: '收货完成', match: (row) => row.status === '收货完成' },
      { key: 'terminated', label: '终止收货', match: (row) => row.status === '终止收货' },
    ],
    rowMatches: (row, filters) => {
      if (filters.warehouseAttr && row.warehouseAttr !== filters.warehouseAttr) return false
      if (filters.warehouse && row.warehouse !== filters.warehouse) return false
      const keyword = (filters.keyword || '').trim().toLowerCase()
      if (!keyword) return true
      return `${row.sourceNo} ${row.relatedNo} ${row.productionNo} ${row.sku} ${row.spu} ${row.styleNo} ${row.productName}`.toLowerCase().includes(keyword)
    },
    onAction: ({ action, node, controller: c }) => {
      const rowId = node.dataset[`${c.config.prefix.replace(/-([a-z0-9])/g, (_, ch: string) => ch.toUpperCase())}RowId`] || ''
      const row = c.config.seed.find((item) => item.id === rowId)
      if (action === 'create-inbound') { c.openDialog('create-inbound'); return true }
      if (action === 'view-barcodes' && row) { c.openDialog('barcodes', c.config.seed.indexOf(row)); return true }
      if (action === 'view-detail' && row) { c.openDialog('detail', c.config.seed.indexOf(row)); return true }
      if (action === 'terminate' && row && (row.status === '待收货' || row.status === '部分收货')) {
        row.status = '终止收货'
        c.feedback(`入库单 ${row.sourceNo} 已终止收货`)
        c.refresh()
        return true
      }
      if (action === 'inbound' && row && (row.status === '待收货' || row.status === '部分收货')) {
        row.status = '收货完成'
        row.actualQty = row.planQty
        row.actualPackage = row.planPackage
        c.feedback(`入库单 ${row.sourceNo} 已完成入库`)
        c.refresh()
        return true
      }
      if (action === 'save-create-inbound') { c.feedback('入库单已创建'); c.closeDialog(); return true }
      return false
    },
  })
  controllers.set(config.key, controller)
}

function renderArrivalOverlays(controller: OnlineListController<ArrivalRow>): string {
  const { state } = controller
  const prefix = controller.config.prefix
  const row = state.dialogRowIdx >= 0 ? controller.config.seed[state.dialogRowIdx] : null
  const parts: string[] = []
  if (state.showColumnSettings) {
    parts.push(renderStandardListColumnSettings({ title: '到货清单列设置', columns: controller.config.columns, preferences: state.preferences, eventPrefix: prefix, maxFrozenWidth: 430 }))
  }
  if (state.dialogKey === 'barcodes' && row) {
    const rowsHtml = row.barcodes.length
      ? row.barcodes.map((item) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 font-mono text-xs text-slate-700">${escapeHtml(item.barcode)}</td><td class="px-3 py-2 text-right text-xs text-slate-600">${escapeHtml(item.qty)}</td></tr>`).join('')
      : '<tr><td colspan="2" class="px-3 py-6 text-center text-sm text-slate-400">该单据暂无条码</td></tr>'
    const content = `<p class="mb-3 text-sm text-slate-500">${escapeHtml(row.sourceType)} ${escapeHtml(row.sourceNo)} · 共 ${row.barcodes.length} 个条码</p><div class="overflow-hidden rounded-md border"><table class="w-full table-fixed"><thead class="bg-muted/50 text-xs text-slate-500"><tr><th class="px-3 py-2 text-left font-medium">条码</th><th class="px-3 py-2 text-right font-medium">数量</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`
    parts.push(renderDialog({ title: '查看条码', description: `${row.productName}`, closeAction: { prefix, action: 'close-dialog' }, width: 'md' }, content))
  }
  if (state.dialogKey === 'detail' && row) {
    parts.push(renderStandardRowDetailDialog({ title: '到货单详情', columns: controller.config.columns, row, eventPrefix: prefix }))
  }
  if (state.dialogKey === 'create-inbound') {
    parts.push(renderFormDialog(
      { title: '手动创建入库单', description: '填写来源与收货物料后创建入库单', closeAction: { prefix, action: 'close-dialog' }, submitAction: { prefix, action: 'save-create-inbound', label: '创建入库单' }, width: 'lg' },
      `<div class="grid grid-cols-2 gap-x-6 gap-y-3">
        <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">来源单号</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="关联单号 / 生产单" data-skip-page-rerender="true"></label>
        <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">款号</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="款号" data-skip-page-rerender="true"></label>
        <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">入库仓库</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="仓库名称" data-skip-page-rerender="true"></label>
        <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">商品 SKU</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="SKU" data-skip-page-rerender="true"></label>
      </div>`,
    ))
  }
  return parts.join('')
}

function renderArrivalListPage(config: ArrivalSourceConfig): string {
  const controller = controllerFor(config)
  const prefix = config.eventPrefix
  const view = controller.view()
  const seed = controller.config.seed
  return renderStandardListPage({
    title: config.title,
    description: '用于查看入库前置单据，包含单号、商品、送货单位、货主与发货时间等信息。',
    primaryActionsHtml: renderPrimaryButton('手动创建入库单', { prefix, action: 'create-inbound' }, 'plus'),
    statusTabsHtml: view.statusTabsHtml,
    filtersHtml: view.filtersHtml,
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${seed.length} 条` },
      { label: '待收货', value: `${seed.filter((row) => row.status === '待收货').length} 条` },
      { label: '部分收货', value: `${seed.filter((row) => row.status === '部分收货').length} 条` },
      { label: '收货完成', value: `${seed.filter((row) => row.status === '收货完成').length} 条` },
    ]),
    listTitle: config.listTitle,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns: controller.config.columns, rows: view.rows, preferences: controller.state.preferences, sort: controller.state.sort, eventPrefix: prefix, emptyText: `暂无${config.sourceType}到货记录` }),
    paginationHtml: renderTablePagination({ total: view.filtered.length, from: view.filtered.length ? (controller.state.currentPage - 1) * controller.state.preferences.pageSize + 1 : 0, to: Math.min(controller.state.currentPage * controller.state.preferences.pageSize, view.filtered.length), currentPage: controller.state.currentPage, totalPages: Math.max(1, Math.ceil(view.filtered.length / controller.state.preferences.pageSize)), pageSize: controller.state.preferences.pageSize, actionPrefix: prefix, fieldPrefix: prefix, pageSizeOptions: [10, 20, 50] }),
    overlaysHtml: renderArrivalOverlays(controller),
  })
}

export function renderDyeArrivalPage(): string {
  const controller = controllerFor(ARRIVAL_SOURCES[0])
  controller.entry()
  return `<div data-${controller.config.prefix}-root data-skip-page-rerender="true"><div data-${controller.config.prefix}-workspace>${renderArrivalListPage(ARRIVAL_SOURCES[0])}</div></div>`
}

export function renderPrintArrivalPage(): string {
  const controller = controllerFor(ARRIVAL_SOURCES[1])
  controller.entry()
  return `<div data-${controller.config.prefix}-root data-skip-page-rerender="true"><div data-${controller.config.prefix}-workspace>${renderArrivalListPage(ARRIVAL_SOURCES[1])}</div></div>`
}

export function renderEmbroideryArrivalPage(): string {
  const controller = controllerFor(ARRIVAL_SOURCES[2])
  controller.entry()
  return `<div data-${controller.config.prefix}-root data-skip-page-rerender="true"><div data-${controller.config.prefix}-workspace>${renderArrivalListPage(ARRIVAL_SOURCES[2])}</div></div>`
}

export function handleDyeArrivalPageEvent(target: HTMLElement, event?: Event): boolean {
  return controllerFor(ARRIVAL_SOURCES[0]).handle(target, event)
}

export function handlePrintArrivalPageEvent(target: HTMLElement, event?: Event): boolean {
  return controllerFor(ARRIVAL_SOURCES[1]).handle(target, event)
}

export function handleEmbroideryArrivalPageEvent(target: HTMLElement, event?: Event): boolean {
  return controllerFor(ARRIVAL_SOURCES[2]).handle(target, event)
}

function wireRenderer(config: ArrivalSourceConfig): void {
  const controller = controllerFor(config)
  controller.setRenderer(() => renderArrivalListPage(config))
}
ARRIVAL_SOURCES.forEach(wireRenderer)
