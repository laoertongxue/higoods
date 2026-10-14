// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderDialog, renderFormDialog } from '../../../components/ui/dialog.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { createOnlineListController } from './shared.ts'
import { stockMonitorSeed, type StockMonitorRow } from './seed.ts'

const EVENT_PREFIX = 'wls-online-stock-monitor'
const DATA_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())

const stockStatusClass: Record<string, string> = {
  '库存充足': 'bg-emerald-50 text-emerald-700',
  '库存不足': 'bg-red-50 text-red-700',
}

const controller = createOnlineListController<StockMonitorRow>({
  prefix: EVENT_PREFIX,
  preferenceKey: '/wls/online/stock-monitor:list-columns',
  seed: stockMonitorSeed,
  exportFileName: '备货面料库存监控',
  queryLabel: '搜索',
  resetLabel: '重置',
  showExport: false,
  columns: [
    { key: 'image', title: '图片', width: 72, required: true, freezeable: true,
      render: r => `<button type="button" class="relative flex h-12 w-12 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded border bg-slate-50" data-pda-image-preview-url="${escapeHtml(r.image)}" data-pda-image-preview-title="${escapeHtml(r.productName)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(r.productName)}实物图"><img src="${escapeHtml(r.image)}" alt="${escapeHtml(r.productName)}实物图" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片失败';this.nextElementSibling.hidden=false"><span class="absolute inset-0 flex items-center justify-center bg-white/80 px-0.5 text-center text-[10px] text-muted-foreground">加载中</span></button>` },
    { key: 'product', title: '名称 / SKU', width: 220, required: true, freezeable: true, sortable: true, sortValue: r => r.productName,
      render: r => `<div class="flex flex-col gap-0.5"><span class="text-slate-700 font-medium">${escapeHtml(r.productName)}</span><span class="text-[11px] font-mono text-slate-400">${escapeHtml(r.sku)}</span><span class="text-[11px] font-mono text-slate-400">${escapeHtml(r.spu)}</span></div>` },
    { key: 'materialType', title: '类型', width: 90, sortable: true, sortValue: r => r.materialType,
      render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.materialType)}</span>` },
    { key: 'targetStock', title: '目标 SKU 库存', width: 120, align: 'right', sortable: true, sortValue: r => r.targetStock,
      render: r => `<span class="text-slate-700">${r.targetStock} ${escapeHtml(r.unit)}</span>` },
    { key: 'threshold', title: '阈值 / 触发数量', width: 130, align: 'right', sortable: true, sortValue: r => r.threshold,
      render: r => `<span class="text-slate-600">${r.threshold} ${escapeHtml(r.unit)}</span>` },
    { key: 'stockStatus', title: '目标 SKU 库存状态', width: 140, sortable: true, sortValue: r => r.stockStatus,
      render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${stockStatusClass[r.stockStatus] || 'bg-slate-100 text-slate-600'}">${escapeHtml(r.stockStatus)}</span>` },
    { key: 'shortageCondition', title: '库存不足条件', width: 150, sortable: true, sortValue: r => r.shortageCondition,
      render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.shortageCondition)}</span>` },
    { key: 'usage7d', title: '近 7 天使用', width: 110, align: 'right', sortable: true, sortValue: r => r.usage7d,
      render: r => `<span class="text-slate-600">${r.usage7d} ${escapeHtml(r.unit)}</span>` },
    { key: 'purchasing', title: '采购中', width: 100, align: 'right', sortable: true, sortValue: r => r.purchasing,
      render: r => `<span class="text-slate-600">${r.purchasing}</span>` },
    { key: 'processing', title: '加工中', width: 100, align: 'right', sortable: true, sortValue: r => r.processing,
      render: r => `<span class="text-slate-600">${r.processing}</span>` },
    { key: 'suggestedOrder', title: '建议下单数量', width: 130, align: 'right', sortable: true, sortValue: r => r.suggestedOrder,
      render: r => `<span class="${r.suggestedOrder > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}">${r.suggestedOrder} ${escapeHtml(r.unit)}</span>` },
    { key: 'process', title: '是否加工 / 工序', width: 140, sortable: true, sortValue: r => r.needProcess,
      render: r => `<div class="flex flex-col gap-0.5 text-xs"><span class="text-slate-600">${escapeHtml(r.needProcess)}</span><span class="text-[11px] text-slate-400">${escapeHtml(r.process)}</span></div>` },
    { key: 'rawMaterial', title: '坯布 / 原料', width: 130, sortable: true, sortValue: r => r.rawMaterial,
      render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.rawMaterial)}</span>` },
    { key: 'rawStock', title: '坯布库存', width: 100, align: 'right', sortable: true, sortValue: r => r.rawStock,
      render: r => `<span class="text-slate-600">${r.rawStock}</span>` },
    { key: 'actions', title: '操作', width: 250, required: true, actionColumn: true,
      render: r => `<div class="flex flex-wrap items-center gap-1">
        <button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="edit" data-${EVENT_PREFIX}-row-id="${escapeHtml(r.id)}">编辑</button>
        <button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="gen-transfer" data-${EVENT_PREFIX}-row-id="${escapeHtml(r.id)}">生成调拨单</button>
        <button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="gen-purchase" data-${EVENT_PREFIX}-row-id="${escapeHtml(r.id)}">生成面辅料采购单</button>
        <button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view-records" data-${EVENT_PREFIX}-row-id="${escapeHtml(r.id)}">查看记录</button>
      </div>` },
  ],
  filters: [
    { key: 'keyword', label: '搜索', placeholder: 'SPU / SKU', span: 2 },
    { key: 'materialType', label: '类型', kind: 'select', options: [{ value: '面料', label: '面料' }, { value: '辅料', label: '辅料' }] },
    { key: 'needProcess', label: '是否加工', kind: 'select', options: [{ value: '是', label: '是' }, { value: '否', label: '否' }] },
    { key: 'stockStatus', label: '目标SKU库存状态', kind: 'select', options: [{ value: '库存不足', label: '库存不足' }, { value: '库存充足', label: '库存充足' }] },
  ],
  rowMatches: (row, filters) => {
    if (filters.materialType && row.materialType !== filters.materialType) return false
    if (filters.needProcess && row.needProcess !== filters.needProcess) return false
    if (filters.stockStatus && row.stockStatus !== filters.stockStatus) return false
    const keyword = (filters.keyword || '').trim().toLowerCase()
    if (!keyword) return true
    return `${row.spu} ${row.sku}`.toLowerCase().includes(keyword)
  },
  onAction: ({ action, node, controller: c }) => {
    const rowId = node.dataset[`${DATA_PREFIX}RowId`] || ''
    const row = c.config.seed.find((item) => item.id === rowId)
    if ((action === 'edit' || action === 'gen-transfer' || action === 'gen-purchase' || action === 'view-records') && row) {
      c.openDialog(action, c.config.seed.indexOf(row))
      return true
    }
    if (action === 'save-edit') { c.feedback('监控配置已保存'); c.closeDialog(); return true }
    if (action === 'add-sku') { c.openDialog('add-sku'); return true }
    if (action === 'save-add-sku') { c.feedback('监控SKU已添加'); c.closeDialog(); return true }
    if (action === 'submit-transfer') { c.feedback('调拨单已生成'); c.closeDialog(); return true }
    if (action === 'submit-purchase') { c.feedback('面辅料采购单已生成'); c.closeDialog(); return true }
    return false
  },
})

function fieldRow(label: string, value: string): string {
  return `<label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">${escapeHtml(label)}</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(value)}" data-skip-page-rerender="true"></label>`
}

function renderStockMonitorPage(): string {
  const view = controller.view()
  const seed = controller.config.seed
  const row = view.dialogRow
  const overlays: string[] = []
  if (controller.state.showColumnSettings) {
    overlays.push(renderStandardListColumnSettings({ title: '库存监控列设置', columns: controller.config.columns, preferences: controller.state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 430 }))
  }
  if (controller.state.dialogKey === 'edit' && row) {
    overlays.push(renderFormDialog(
      { title: '编辑监控配置', description: `${row.productName} · ${row.sku}`, closeAction: { prefix: EVENT_PREFIX, action: 'close-dialog' }, submitAction: { prefix: EVENT_PREFIX, action: 'save-edit', label: '保存' }, width: 'lg' },
      `<div class="grid grid-cols-2 gap-x-6 gap-y-3">${fieldRow(`目标 SKU 库存 (${row.unit})`, String(row.targetStock))}${fieldRow(`阈值 / 触发数量 (${row.unit})`, String(row.threshold))}${fieldRow('近 7 天使用', String(row.usage7d))}${fieldRow('是否加工', row.needProcess)}</div>`,
    ))
  }
  if (controller.state.dialogKey === 'gen-transfer' && row) {
    overlays.push(renderFormDialog(
      { title: '生成调拨单', description: `${row.productName} · 建议调拨 ${row.suggestedOrder} ${row.unit}`, closeAction: { prefix: EVENT_PREFIX, action: 'close-dialog' }, submitAction: { prefix: EVENT_PREFIX, action: 'submit-transfer', label: '生成调拨单' }, width: 'lg' },
      `<div class="grid grid-cols-2 gap-x-6 gap-y-3">${fieldRow('调出仓库', '面料中央仓')}${fieldRow('目标仓库', 'GT面料仓')}${fieldRow(`调拨数量 (${row.unit})`, String(row.suggestedOrder || row.threshold))}${fieldRow('申请人', '计划员')}</div>`,
    ))
  }
  if (controller.state.dialogKey === 'gen-purchase' && row) {
    overlays.push(renderFormDialog(
      { title: '生成面辅料采购单', description: `${row.productName} · 建议下单 ${row.suggestedOrder} ${row.unit}`, closeAction: { prefix: EVENT_PREFIX, action: 'close-dialog' }, submitAction: { prefix: EVENT_PREFIX, action: 'submit-purchase', label: '生成采购单' }, width: 'lg' },
      `<div class="grid grid-cols-2 gap-x-6 gap-y-3">${fieldRow('供应商', '万隆面料供应链有限公司')}${fieldRow(`采购数量 (${row.unit})`, String(row.suggestedOrder || row.threshold))}${fieldRow('期望到货', '2026-11-05')}${fieldRow('采购员', '计划员')}</div>`,
    ))
  }
  if (controller.state.dialogKey === 'view-records' && row) {
    const records = [
      { time: '2026-10-14 09:20', action: '生成调拨单', detail: `调拨 ${row.threshold} ${row.unit} 至 GT面料仓`, operator: '计划员' },
      { time: '2026-10-12 14:05', action: '生成面辅料采购单', detail: `采购 ${row.suggestedOrder} ${row.unit}`, operator: '采购员' },
      { time: '2026-10-10 08:40', action: '编辑配置', detail: `阈值调整为 ${row.threshold} ${row.unit}`, operator: '仓库主管' },
    ]
    const content = `<div class="overflow-hidden rounded-md border"><table class="w-full table-fixed"><thead class="bg-muted/50 text-xs text-slate-500"><tr><th class="px-3 py-2 text-left font-medium">时间</th><th class="px-3 py-2 text-left font-medium">动作</th><th class="px-3 py-2 text-left font-medium">内容</th><th class="px-3 py-2 text-left font-medium">操作人</th></tr></thead><tbody>${records.map((record) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-xs text-slate-400">${escapeHtml(record.time)}</td><td class="px-3 py-2 text-xs text-slate-600">${escapeHtml(record.action)}</td><td class="px-3 py-2 text-xs text-slate-600">${escapeHtml(record.detail)}</td><td class="px-3 py-2 text-xs text-slate-600">${escapeHtml(record.operator)}</td></tr>`).join('')}</tbody></table></div>`
    overlays.push(renderDialog({ title: '监控记录', description: `${row.productName} · ${row.sku}`, closeAction: { prefix: EVENT_PREFIX, action: 'close-dialog' }, width: 'lg' }, content))
  }
  if (controller.state.dialogKey === 'add-sku') {
    overlays.push(renderFormDialog(
      { title: '手动添加监控SKU', description: '选择目标 SKU 并设置目标库存与阈值', closeAction: { prefix: EVENT_PREFIX, action: 'close-dialog' }, submitAction: { prefix: EVENT_PREFIX, action: 'save-add-sku', label: '添加监控SKU' }, width: 'lg' },
      `<div class="grid grid-cols-2 gap-x-6 gap-y-3">${fieldRow('面料 / 辅料 SKU', '')}${fieldRow('类型', '面料')}${fieldRow('目标 SKU 库存 (米)', '1000')}${fieldRow('阈值 / 触发数量 (米)', '300')}</div>`,
    ))
  }
  return renderStandardListPage({
    title: '备货面料库存监控',
    description: '长期监控目标SKU库存，不足时按坯布库存决定生成调拨单或采购单。',
    primaryActionsHtml: renderPrimaryButton('手动添加监控SKU', { prefix: EVENT_PREFIX, action: 'add-sku' }, 'plus'),
    filtersHtml: view.filtersHtml,
    statsHtml: renderStandardListStats([
      { label: '监控对象', value: `${seed.length} 条` },
      { label: '库存不足', value: `${seed.filter((item) => item.stockStatus === '库存不足').length} 条` },
      { label: '库存充足', value: `${seed.filter((item) => item.stockStatus === '库存充足').length} 条` },
      { label: '建议下单', value: `${seed.filter((item) => item.suggestedOrder > 0).length} 条` },
    ]),
    listTitle: '库存监控配置',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns: controller.config.columns, rows: view.rows, preferences: controller.state.preferences, sort: controller.state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无监控对象' }),
    paginationHtml: renderTablePagination({ total: view.filtered.length, from: view.filtered.length ? (controller.state.currentPage - 1) * controller.state.preferences.pageSize + 1 : 0, to: Math.min(controller.state.currentPage * controller.state.preferences.pageSize, view.filtered.length), currentPage: controller.state.currentPage, totalPages: Math.max(1, Math.ceil(view.filtered.length / controller.state.preferences.pageSize)), pageSize: controller.state.preferences.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [10, 20, 50] }),
    overlaysHtml: overlays.join(''),
  })
}

export function renderStockMonitorListPage(): string {
  controller.entry()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderStockMonitorPage()}</div></div>`
}

export function handleStockMonitorListPageEvent(target: HTMLElement, event?: Event): boolean {
  return controller.handle(target, event)
}

controller.setRenderer(renderStockMonitorPage)
