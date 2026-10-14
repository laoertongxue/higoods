// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderFormDialog } from '../../../components/ui/dialog.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { createOnlineListController, type OnlineListController, type OnlineStatusTab } from './shared.ts'
import { RAW_WAREHOUSE_15, rawBarcodeSeed, rawPutawaySeed, type BarcodeRow } from './seed.ts'

const statusClass: Record<string, string> = {
  '草稿': 'bg-slate-100 text-slate-500',
  '待打印': 'bg-amber-50 text-amber-700',
  '待上架': 'bg-orange-50 text-orange-700',
  '已上架': 'bg-emerald-50 text-emerald-700',
  '下架到待出库区': 'bg-blue-50 text-blue-700',
  '已出库': 'bg-slate-100 text-slate-500',
}
const inboundStatusClass: Record<string, string> = {
  '未入库': 'bg-slate-100 text-slate-500',
  '已入库': 'bg-emerald-50 text-emerald-700',
}

const PUTAWAY_TABS: readonly OnlineStatusTab<BarcodeRow>[] = [
  { key: 'all', label: '全部', match: () => true },
  { key: 'draft', label: '草稿', match: (row) => row.status === '草稿' },
  { key: 'to-print', label: '待打印', match: (row) => row.status === '待打印' },
  { key: 'to-shelf', label: '待上架', match: (row) => row.status === '待上架' },
]

const BARCODE_TABS: readonly OnlineStatusTab<BarcodeRow>[] = [
  { key: 'all', label: '全部', match: () => true },
  { key: 'draft', label: '草稿', match: (row) => row.status === '草稿' },
  { key: 'to-print', label: '待打印', match: (row) => row.status === '待打印' },
  { key: 'to-shelf', label: '待上架', match: (row) => row.status === '待上架' },
  { key: 'on-shelf', label: '已上架', match: (row) => row.status === '已上架' },
  { key: 'off-shelf', label: '下架到待出库区', match: (row) => row.status === '下架到待出库区' },
  { key: 'outbound', label: '已出库', match: (row) => row.status === '已出库' },
]

interface BatchAction {
  label: string
  action: string
  primary?: boolean
}

interface BarcodePageConfig {
  key: 'putaway' | 'barcode'
  title: string
  listTitle: string
  preferenceKey: string
  eventPrefix: string
  seed: BarcodeRow[]
  batchActions: readonly BatchAction[]
  tabs: readonly OnlineStatusTab<BarcodeRow>[]
}

const BARCODE_PAGES: readonly BarcodePageConfig[] = [
  {
    key: 'putaway', title: '待上架列表', listTitle: '待上架条码', preferenceKey: '/wls/online/raw-putaway:list-columns', eventPrefix: 'wls-online-raw-putaway', seed: rawPutawaySeed, tabs: PUTAWAY_TABS,
    batchActions: [
      { label: '新增条码', action: 'new-barcode', primary: true },
      { label: '批量上架', action: 'batch-putaway' },
      { label: '批量修改', action: 'batch-edit' },
      { label: '批量打印', action: 'batch-print' },
      { label: '批量删除', action: 'batch-delete' },
      { label: '导入细码', action: 'import-codes' },
    ],
  },
  {
    key: 'barcode', title: '原料条码列表', listTitle: '原料条码', preferenceKey: '/wls/online/raw-barcode:list-columns', eventPrefix: 'wls-online-raw-barcode', seed: rawBarcodeSeed, tabs: BARCODE_TABS,
    batchActions: [
      { label: '新增条码', action: 'new-barcode', primary: true },
      { label: '批量修改', action: 'batch-edit' },
      { label: '批量打印', action: 'batch-print' },
      { label: '导入细码', action: 'import-codes' },
      { label: '批量下架到待出库区', action: 'batch-off-shelf' },
    ],
  },
]

const RELATE_TYPES = ['自定义', '面辅料采购单', '印花单', '染色单', '水溶单']
const WH_ATTRS = ['面料仓', '辅料仓', '纱线仓', '耗材仓', '包材仓', '中转仓']

function makeBarcodeColumns(config: BarcodePageConfig): StandardListColumn<BarcodeRow>[] {
  const prefix = config.eventPrefix
  return [
    { key: 'select', title: '勾选', width: 56, required: true, freezeable: true, leadingControlColumn: true,
      render: r => `<input type="checkbox" class="h-4 w-4 cursor-pointer accent-blue-600" aria-label="选择条码 ${escapeHtml(r.barcode)}" data-${prefix}-field="row-select" data-${prefix}-id="${escapeHtml(r.id)}" ${controllers.get(config.key)?.state.selected.has(r.id) ? 'checked' : ''}>` },
    { key: 'id', title: 'ID', width: 80, required: true, freezeable: true, sortable: true, sortValue: r => Number(r.id),
      render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.id)}</span>` },
    { key: 'barcode', title: '条码', width: 180, freezeable: true, sortable: true, sortValue: r => r.barcode,
      render: r => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.barcode)}</span>` },
    { key: 'relatedNo', title: '关联单号', width: 150, sortable: true, sortValue: r => r.relatedNo,
      render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.relatedNo)}</span>` },
    { key: 'productionNo', title: '专用生产单', width: 120, sortable: true, sortValue: r => r.productionNo,
      render: r => `<span class="text-slate-700">${escapeHtml(r.productionNo)}</span>` },
    { key: 'sku', title: 'SKU', width: 190, sortable: true, sortValue: r => r.sku,
      render: r => `<div class="flex flex-col gap-0.5"><span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span><span class="text-[11px] font-mono text-slate-400">${escapeHtml(r.spu)}</span></div>` },
    { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
      render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status] || 'bg-slate-100 text-slate-600'}">${escapeHtml(r.status)}</span>` },
    { key: 'inboundStatus', title: '入库状态', width: 100, sortable: true, sortValue: r => r.inboundStatus,
      render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${inboundStatusClass[r.inboundStatus] || 'bg-slate-100 text-slate-600'}">${escapeHtml(r.inboundStatus)}</span>` },
    { key: 'rollNo', title: '卷号', width: 110, sortable: true, sortValue: r => r.rollNo,
      render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.rollNo)}</span>` },
    { key: 'rollLength', title: '卷长(Y)', width: 90, align: 'right', sortable: true, sortValue: r => r.rollLength,
      render: r => `<span class="text-slate-700">${r.rollLength} Y</span>` },
    { key: 'weight', title: '重量(KG)', width: 100, align: 'right', sortable: true, sortValue: r => r.weight,
      render: r => `<span class="text-slate-700">${r.weight} KG</span>` },
    { key: 'gramWeight', title: '克重(g)', width: 90, align: 'right', sortable: true, sortValue: r => r.gramWeight,
      render: r => `<span class="text-slate-600">${r.gramWeight} g</span>` },
    { key: 'standardQty', title: '标准数量', width: 100, align: 'right', sortable: true, sortValue: r => r.standardQty,
      render: r => `<span class="text-slate-600">${r.standardQty}</span>` },
    { key: 'width', title: '幅宽', width: 90, sortable: true, sortValue: r => r.width,
      render: r => `<span class="text-slate-600">${escapeHtml(r.width)}</span>` },
    { key: 'warehouse', title: '入库仓库', width: 140, sortable: true, sortValue: r => r.warehouse,
      render: r => `<div class="flex flex-col gap-0.5"><span class="text-slate-700">${escapeHtml(r.warehouse)}</span><span class="text-[11px] text-slate-400">${escapeHtml(r.location)}</span></div>` },
    { key: 'inboundTime', title: '入库时间', width: 150, sortable: true, sortValue: r => r.inboundTime,
      render: r => `<span class="text-slate-400 text-xs">${escapeHtml(r.inboundTime || '—')}</span>` },
    { key: 'printer', title: '打印人', width: 100, sortable: true, sortValue: r => r.printer,
      render: r => `<span class="text-slate-600">${escapeHtml(r.printer)}</span>` },
    { key: 'printTime', title: '打印时间', width: 150, sortable: true, sortValue: r => r.printTime,
      render: r => `<span class="text-slate-400 text-xs">${escapeHtml(r.printTime)}</span>` },
    { key: 'actions', title: '操作', width: 150, required: true, actionColumn: true,
      render: r => {
        const rowId = escapeHtml(r.id)
        return `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${prefix}-action="edit" data-${prefix}-row-id="${rowId}">编辑</button><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${prefix}-action="print-barcode" data-${prefix}-row-id="${rowId}">打印条码</button></div>`
      } },
  ]
}

const controllers = new Map<BarcodePageConfig['key'], OnlineListController<BarcodeRow>>()

for (const config of BARCODE_PAGES) {
  const prefix = config.eventPrefix
  const dataPrefix = prefix.replace(/-([a-z0-9])/g, (_, ch: string) => ch.toUpperCase())
  const controller = createOnlineListController<BarcodeRow>({
    prefix,
    preferenceKey: config.preferenceKey,
    columns: makeBarcodeColumns(config),
    seed: config.seed,
    exportFileName: config.title,
    showExport: false,
    pageSizeOptions: [20, 40, 60, 100, 200, 500, 1000],
    filters: [
      { key: 'relatedNo', label: '关联单号', placeholder: '关联单号' },
      { key: 'barcode', label: '条码 code', placeholder: '条码' },
      { key: 'batch', label: '打印批次', placeholder: '打印批次' },
      { key: 'spu', label: 'SPU', placeholder: 'SPU' },
      { key: 'sku', label: 'SKU', placeholder: 'SKU' },
      { key: 'location', label: '库位代码', placeholder: '库位代码' },
      { key: 'printFrom', label: '打印开始', placeholder: '2026-09-01' },
      { key: 'printTo', label: '打印结束', placeholder: '2026-09-30' },
      { key: 'relateType', label: '类型', kind: 'select', options: RELATE_TYPES.map((type) => ({ value: type, label: type })) },
      { key: 'whAttr', label: '仓库属性', kind: 'select', options: WH_ATTRS.map((attr) => ({ value: attr, label: attr })) },
      { key: 'warehouse', label: '仓库', kind: 'select', options: RAW_WAREHOUSE_15.map((warehouse) => ({ value: warehouse.name, label: warehouse.code ? `${warehouse.name}（${warehouse.code}）` : warehouse.name })) },
      { key: 'inboundStatus', label: '入库状态', kind: 'select', options: [{ value: '未入库', label: '未入库' }, { value: '已入库', label: '已入库' }] },
    ],
    statusTabs: config.tabs,
    rowMatches: (row, filters) => {
      const includes = (value: string | undefined, target: string) => !value || target.toLowerCase().includes(value.trim().toLowerCase())
      if (!includes(filters.relatedNo, row.relatedNo)) return false
      if (!includes(filters.barcode, row.barcode)) return false
      if (!includes(filters.batch, row.batch)) return false
      if (!includes(filters.spu, row.spu)) return false
      if (!includes(filters.sku, row.sku)) return false
      if (!includes(filters.location, row.location)) return false
      if (filters.relateType && row.relateType !== filters.relateType) return false
      if (filters.whAttr && row.whAttr !== filters.whAttr) return false
      if (filters.warehouse && row.warehouse !== filters.warehouse) return false
      if (filters.inboundStatus && row.inboundStatus !== filters.inboundStatus) return false
      const day = row.printTime.slice(0, 10)
      if (filters.printFrom && day < filters.printFrom) return false
      if (filters.printTo && day > filters.printTo) return false
      return true
    },
    onAction: ({ action, node, controller: c }) => {
      const rowId = node.dataset[`${dataPrefix}RowId`] || ''
      const row = c.config.seed.find((item) => item.id === rowId)
      if (action === 'new-barcode') { c.openDialog('new-barcode'); return true }
      if (action === 'save-barcode') { c.feedback('条码已新增'); c.closeDialog(); return true }
      if (action === 'edit' && row) { c.openDialog('edit-barcode', c.config.seed.indexOf(row)); return true }
      if (action === 'save-edit-barcode') { c.feedback('条码已保存'); c.closeDialog(); return true }
      if (action === 'print-barcode' && row) { c.feedback(`条码 ${row.barcode} 已发送打印`); return true }
      if (action === 'batch-putaway') {
        c.config.seed.filter((item) => item.status === '待上架').forEach((item) => { item.status = '已上架'; item.inboundStatus = '已入库' })
        c.feedback('已批量上架待上架条码')
        c.refresh()
        return true
      }
      if (action === 'batch-off-shelf') {
        c.config.seed.filter((item) => item.status === '已上架').forEach((item) => { item.status = '下架到待出库区' })
        c.feedback('已批量下架到待出库区')
        c.refresh()
        return true
      }
      if (action === 'batch-edit' || action === 'batch-print' || action === 'batch-delete' || action === 'import-codes') {
        c.feedback(`已执行「${action === 'batch-edit' ? '批量修改' : action === 'batch-print' ? '批量打印' : action === 'batch-delete' ? '批量删除' : '导入细码'}」`)
        return true
      }
      return false
    },
  })
  controllers.set(config.key, controller)
}

function renderBarcodeListPage(config: BarcodePageConfig): string {
  const controller = controllers.get(config.key)!
  const prefix = config.eventPrefix
  const view = controller.view()
  const seed = controller.config.seed
  const actionsHtml = config.batchActions.map((item) => item.primary
    ? renderPrimaryButton(item.label, { prefix, action: item.action }, 'plus')
    : renderSecondaryButton(item.label, { prefix, action: item.action })).join('')
  return renderStandardListPage({
    title: config.title,
    description: '手动打印面辅料卷条码，记录写入 WMS。',
    statusTabsHtml: view.statusTabsHtml,
    filtersHtml: view.filtersHtml,
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${seed.length} 条` },
      { label: '待上架', value: `${seed.filter((row) => row.status === '待上架').length} 条` },
      { label: '已上架', value: `${seed.filter((row) => row.status === '已上架').length} 条` },
      { label: '已入库', value: `${seed.filter((row) => row.inboundStatus === '已入库').length} 条` },
    ]),
    listTitle: config.listTitle,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${actionsHtml}${renderSecondaryButton('列设置', { prefix, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns: controller.config.columns, rows: view.rows, preferences: controller.state.preferences, sort: controller.state.sort, eventPrefix: prefix, emptyText: '暂无条码记录' }),
    paginationHtml: renderTablePagination({ total: view.filtered.length, from: view.filtered.length ? (controller.state.currentPage - 1) * controller.state.preferences.pageSize + 1 : 0, to: Math.min(controller.state.currentPage * controller.state.preferences.pageSize, view.filtered.length), currentPage: controller.state.currentPage, totalPages: Math.max(1, Math.ceil(view.filtered.length / controller.state.preferences.pageSize)), pageSize: controller.state.preferences.pageSize, actionPrefix: prefix, fieldPrefix: prefix, pageSizeOptions: [20, 40, 60, 100, 200, 500, 1000] }),
    overlaysHtml: [
      controller.state.showColumnSettings ? renderStandardListColumnSettings({ title: `${config.listTitle}列设置`, columns: controller.config.columns, preferences: controller.state.preferences, eventPrefix: prefix, maxFrozenWidth: 430 }) : '',
      controller.state.dialogKey === 'edit-barcode' && view.dialogRow ? renderFormDialog(
        { title: '编辑条码', description: `${view.dialogRow.barcode} · ${view.dialogRow.sku}`, closeAction: { prefix, action: 'close-dialog' }, submitAction: { prefix, action: 'save-edit-barcode', label: '保存条码' }, width: 'lg' },
        `<div class="grid grid-cols-2 gap-x-6 gap-y-3">
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">关联单号</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(view.dialogRow.relatedNo)}" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">专用生产单</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(view.dialogRow.productionNo)}" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">SKU</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(view.dialogRow.sku)}" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">卷号</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(view.dialogRow.rollNo)}" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">卷长 (Yard)</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" value="${view.dialogRow.rollLength}" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">重量 (KG)</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" value="${view.dialogRow.weight}" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">克重 (g)</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" value="${view.dialogRow.gramWeight}" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">标准数量</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" value="${view.dialogRow.standardQty}" data-skip-page-rerender="true"></label>
        </div>`,
      ) : '',
      controller.state.dialogKey === 'new-barcode' ? renderFormDialog(
        { title: '新增条码', description: '填写条码与卷信息，保存后进入待上架', closeAction: { prefix, action: 'close-dialog' }, submitAction: { prefix, action: 'save-barcode', label: '保存条码' }, width: 'lg' },
        `<div class="grid grid-cols-2 gap-x-6 gap-y-3">
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">关联单号</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="关联单号" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">专用生产单</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="生产单" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">SKU</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="SKU" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">卷号</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="卷号" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">卷长 (Yard)</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="卷长" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">重量 (KG)</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="重量" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">克重 (g)</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="克重" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">标准数量</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="标准数量" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">幅宽</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="幅宽" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">库位代码</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="库位代码" data-skip-page-rerender="true"></label>
        </div>`,
      ) : '',
    ].join(''),
  })
}

function mountBarcodePage(config: BarcodePageConfig): string {
  const controller = controllers.get(config.key)!
  controller.entry()
  return `<div data-${config.eventPrefix}-root data-skip-page-rerender="true"><div data-${config.eventPrefix}-workspace>${renderBarcodeListPage(config)}</div></div>`
}

export function renderRawPutawayPage(): string { return mountBarcodePage(BARCODE_PAGES[0]) }
export function renderRawBarcodePage(): string { return mountBarcodePage(BARCODE_PAGES[1]) }

export function handleRawPutawayPageEvent(target: HTMLElement, event?: Event): boolean {
  return controllers.get('putaway')!.handle(target, event)
}
export function handleRawBarcodePageEvent(target: HTMLElement, event?: Event): boolean {
  return controllers.get('barcode')!.handle(target, event)
}

BARCODE_PAGES.forEach((config) => {
  controllers.get(config.key)!.setRenderer(() => renderBarcodeListPage(config))
})
