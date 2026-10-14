// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowDetailDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderFormDialog } from '../../../components/ui/dialog.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { createOnlineListController, type OnlineListController, type OnlineStatusTab } from './shared.ts'
import { RAW_WAREHOUSE_13, TRANSFER_TARGET_WAREHOUSES, transferHandoverSeed, transferWaitHandoverSeed, transferWaitInboundSeed, type TransferRow } from './seed.ts'

const statusClass: Record<string, string> = {
  '待交出': 'bg-orange-50 text-orange-700', '部分交出': 'bg-amber-50 text-amber-700', '已交出': 'bg-emerald-50 text-emerald-700',
  '待到货': 'bg-orange-50 text-orange-700', '部分到货': 'bg-amber-50 text-amber-700', '已到货': 'bg-emerald-50 text-emerald-700',
  '待审核': 'bg-orange-50 text-orange-700', '已驳回': 'bg-slate-100 text-slate-400', '确认通过': 'bg-blue-50 text-blue-700', '待调拨': 'bg-amber-50 text-amber-700',
}

interface TransferPageConfig {
  key: 'wait-handover' | 'handover' | 'wait-inbound'
  title: string
  listTitle: string
  preferenceKey: string
  eventPrefix: string
  seed: TransferRow[]
  doneLabel: string
  statuses: readonly string[]
  tabs: readonly OnlineStatusTab<TransferRow>[]
}

const HANDOVER_TABS: readonly OnlineStatusTab<TransferRow>[] = [
  { key: 'all', label: '全部', match: () => true },
  { key: 'pending', label: '待交出', match: (row) => row.status === '待交出' || row.status === '部分交出' },
  { key: 'done', label: '已交出', match: (row) => row.status === '已交出' },
]

const WAIT_INBOUND_TABS: readonly OnlineStatusTab<TransferRow>[] = [
  { key: 'all', label: '全部', match: () => true },
  { key: 'pending', label: '待审核', match: (row) => row.status === '待审核' },
  { key: 'rejected', label: '已驳回', match: (row) => row.status === '已驳回' },
  { key: 'approved', label: '确认通过', match: (row) => row.status === '确认通过' },
  { key: 'wait-transfer', label: '待调拨', match: (row) => row.status === '待调拨' },
]

const TRANSFER_PAGES: readonly TransferPageConfig[] = [
  { key: 'wait-handover', title: '调拨待交出列表', listTitle: '待交出调拨单', preferenceKey: '/wls/online/transfer-wait-handover:list-columns', eventPrefix: 'wls-online-transfer-wait-handover', seed: transferWaitHandoverSeed, doneLabel: '到货数量', statuses: ['待交出', '部分交出', '已交出'], tabs: HANDOVER_TABS },
  { key: 'handover', title: '调拨交出单据', listTitle: '已交出调拨单', preferenceKey: '/wls/online/transfer-handover:list-columns', eventPrefix: 'wls-online-transfer-handover', seed: transferHandoverSeed, doneLabel: '到货数量', statuses: ['待交出', '部分交出', '已交出'], tabs: HANDOVER_TABS },
  { key: 'wait-inbound', title: '原料调拨单（等待入库）', listTitle: '待收货', preferenceKey: '/wls/online/transfer-wait-inbound:list-columns', eventPrefix: 'wls-online-transfer-wait-inbound', seed: transferWaitInboundSeed, doneLabel: '到货数量', statuses: ['待审核', '已驳回', '确认通过', '待调拨'], tabs: WAIT_INBOUND_TABS },
]

function makeTransferColumns(config: TransferPageConfig): StandardListColumn<TransferRow>[] {
  const prefix = config.eventPrefix
  return [
    { key: 'id', title: 'ID', width: 90, required: true, freezeable: true, sortable: true, sortValue: r => Number(r.id),
      render: r => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.id)}</span>` },
    { key: 'productionNo', title: '生产单', width: 120, sortable: true, sortValue: r => r.productionNo,
      render: r => `<span class="text-slate-700">${escapeHtml(r.productionNo)}</span>` },
    { key: 'sku', title: 'Sku', width: 180, sortable: true, sortValue: r => r.sku,
      render: r => `<div class="flex flex-col gap-0.5"><span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span><span class="text-[11px] text-slate-400">${escapeHtml(r.materialType)}</span></div>` },
    { key: 'fromWarehouse', title: '调出仓库', width: 200, sortable: true, sortValue: r => r.fromWarehouse,
      render: r => `<div class="flex flex-col gap-0.5"><span class="text-slate-700">${escapeHtml(r.fromWarehouse)}</span><span class="text-[11px] text-slate-400">库存：${(r.transferQty * 25.4).toFixed(2)}/${r.transferQty}${escapeHtml(r.unit)}</span></div>` },
    { key: 'toWarehouse', title: '目标仓库', width: 200, sortable: true, sortValue: r => r.toWarehouse,
      render: r => `<div class="flex flex-col gap-0.5"><span class="text-slate-700">${escapeHtml(r.toWarehouse)}</span><span class="text-[11px] text-slate-400">库存：${(r.transferQty * 24.8).toFixed(2)}/${Math.max(1, r.transferQty - 1)}${escapeHtml(r.unit)}</span></div>` },
    { key: 'transferQty', title: '调拨数量', width: 110, align: 'right', sortable: true, sortValue: r => r.transferQty,
      render: r => `<span class="text-slate-700 font-medium">${r.transferQty} ${escapeHtml(r.unit)}</span>` },
    { key: 'doneQty', title: config.doneLabel, width: 120, align: 'right', sortable: true, sortValue: r => r.doneQty,
      render: r => `<span class="text-slate-600">${r.doneQty} ${escapeHtml(r.unit)}</span>` },
    { key: 'status', title: '状态', width: 110, sortable: true, sortValue: r => r.status,
      render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status] || 'bg-slate-100 text-slate-600'}">${escapeHtml(r.status)}</span>` },
    { key: 'applicant', title: '申请人', width: 110, sortable: true, sortValue: r => r.applicant,
      render: r => `<span class="text-slate-600">${escapeHtml(r.applicant)}</span>` },
    { key: 'applyTime', title: '申请时间', width: 150, sortable: true, sortValue: r => r.applyTime,
      render: r => `<span class="text-slate-400 text-xs">${escapeHtml(r.applyTime)}</span>` },
    { key: 'actions', title: '操作', width: 130, required: true, actionColumn: true,
      render: r => {
        const rowId = escapeHtml(r.id)
        const buttons: string[] = [`<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${prefix}-action="view" data-${prefix}-row-id="${rowId}">查看</button>`]
        if ((config.key === 'wait-handover' || config.key === 'handover') && (r.status === '待交出' || r.status === '部分交出')) {
          buttons.push(`<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-${prefix}-action="handover" data-${prefix}-row-id="${rowId}">交出</button>`)
        }
        if (config.key === 'wait-inbound' && (r.status === '待审核' || r.status === '待调拨')) {
          buttons.push(`<button class="rounded border border-rose-200 px-2 py-0.5 text-xs text-rose-600 hover:bg-rose-50" data-${prefix}-action="reject" data-${prefix}-row-id="${rowId}">驳回</button>`)
        }
        return `<div class="flex items-center gap-1">${buttons.join('')}</div>`
      } },
  ]
}

const controllers = new Map<TransferPageConfig['key'], OnlineListController<TransferRow>>()

for (const config of TRANSFER_PAGES) {
  const prefix = config.eventPrefix
  const dataPrefix = prefix.replace(/-([a-z0-9])/g, (_, ch: string) => ch.toUpperCase())
  const controller = createOnlineListController<TransferRow>({
    prefix,
    preferenceKey: config.preferenceKey,
    columns: makeTransferColumns(config),
    seed: config.seed,
    exportFileName: config.title,
    queryLabel: '搜索',
    resetLabel: '清除',
    showExport: false,
    filters: [
      { key: 'keyword', label: '搜索', placeholder: 'SPU / SKU / 生产单 / 染色单 / 印花单', span: 2 },
      { key: 'materialType', label: '全部类型', kind: 'select', options: ['面料', '辅料', '耗材', '纱线', '包材'].map((type) => ({ value: type, label: type })) },
      { key: 'status', label: '状态', kind: 'select', options: config.statuses.map((status) => ({ value: status, label: status })) },
      { key: 'fromWarehouse', label: '调出仓库', kind: 'select', options: RAW_WAREHOUSE_13.map((warehouse) => ({ value: warehouse.name, label: warehouse.name })) },
      { key: 'toWarehouse', label: '目标仓库', kind: 'select', options: TRANSFER_TARGET_WAREHOUSES.map((warehouse) => ({ value: warehouse.name, label: warehouse.name })) },
    ],
    statusTabs: config.tabs,
    rowMatches: (row, filters) => {
      if (filters.materialType && row.materialType !== filters.materialType) return false
      if (filters.status && row.status !== filters.status) return false
      if (filters.fromWarehouse && row.fromWarehouse !== filters.fromWarehouse) return false
      if (filters.toWarehouse && row.toWarehouse !== filters.toWarehouse) return false
      const keyword = (filters.keyword || '').trim().toLowerCase()
      if (!keyword) return true
      return `${row.spu} ${row.sku} ${row.productionNo} ${row.fromWarehouse} ${row.toWarehouse}`.toLowerCase().includes(keyword)
    },
    onAction: ({ action, node, controller: c }) => {
      const rowId = node.dataset[`${dataPrefix}RowId`] || ''
      const row = c.config.seed.find((item) => item.id === rowId)
      if (action === 'view' && row) { c.openDialog('detail', c.config.seed.indexOf(row)); return true }
      if (action === 'create-transfer') { c.openDialog('create-transfer'); return true }
      if (action === 'save-transfer') { c.feedback('调拨单已创建'); c.closeDialog(); return true }
      if (action === 'handover' && row && (config.key === 'wait-handover' || config.key === 'handover') && (row.status === '待交出' || row.status === '部分交出')) {
        row.status = row.status === '待交出' ? '部分交出' : '已交出'
        row.doneQty = row.status === '已交出' ? row.transferQty : Math.round(row.transferQty * 0.5 * 10) / 10
        c.feedback(`调拨单 ${row.id} 已现场交出`)
        c.refresh()
        return true
      }
      if (action === 'reject' && row && (row.status === '待审核' || row.status === '待调拨')) {
        row.status = '已驳回'
        c.feedback(`调拨单 ${row.id} 已驳回`)
        c.refresh()
        return true
      }
      return false
    },
  })
  controllers.set(config.key, controller)
}

function renderTransferListPage(config: TransferPageConfig): string {
  const controller = controllers.get(config.key)!
  const prefix = config.eventPrefix
  const view = controller.view()
  const seed = controller.config.seed
  return renderStandardListPage({
    title: config.title,
    description: '新系统手动创建的原料调拨单，创建即"待调拨"，选择卷条码执行调拨后完成跨系统库存过账。',
    primaryActionsHtml: renderPrimaryButton('新增调拨单', { prefix, action: 'create-transfer' }, 'plus'),
    statusTabsHtml: view.statusTabsHtml,
    filtersHtml: view.filtersHtml,
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${seed.length} 条` },
      { label: config.statuses[0], value: `${seed.filter((row) => row.status === config.statuses[0]).length} 条` },
      { label: config.statuses[config.statuses.length - 1], value: `${seed.filter((row) => row.status === config.statuses[config.statuses.length - 1]).length} 条` },
    ]),
    listTitle: config.listTitle,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns: controller.config.columns, rows: view.rows, preferences: controller.state.preferences, sort: controller.state.sort, eventPrefix: prefix, emptyText: '暂无调拨单' }),
    paginationHtml: renderTablePagination({ total: view.filtered.length, from: view.filtered.length ? (controller.state.currentPage - 1) * controller.state.preferences.pageSize + 1 : 0, to: Math.min(controller.state.currentPage * controller.state.preferences.pageSize, view.filtered.length), currentPage: controller.state.currentPage, totalPages: Math.max(1, Math.ceil(view.filtered.length / controller.state.preferences.pageSize)), pageSize: controller.state.preferences.pageSize, actionPrefix: prefix, fieldPrefix: prefix, pageSizeOptions: [10, 20, 50] }),
    overlaysHtml: [
      controller.state.showColumnSettings ? renderStandardListColumnSettings({ title: '调拨单列设置', columns: controller.config.columns, preferences: controller.state.preferences, eventPrefix: prefix, maxFrozenWidth: 430 }) : '',
      controller.state.dialogKey === 'detail' && view.dialogRow ? renderStandardRowDetailDialog({ title: '调拨单详情', columns: controller.config.columns, row: view.dialogRow, eventPrefix: prefix }) : '',
      controller.state.dialogKey === 'create-transfer' ? renderFormDialog(
        { title: '新增调拨单', description: '填写调出、目标仓库与物料后创建调拨单', closeAction: { prefix, action: 'close-dialog' }, submitAction: { prefix, action: 'save-transfer', label: '创建调拨单' }, width: 'lg' },
        `<div class="grid grid-cols-2 gap-x-6 gap-y-3">
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">调出仓库</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="调出仓库" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">目标仓库</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="目标仓库" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">物料 SKU</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="SKU" data-skip-page-rerender="true"></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">调拨数量</span><input class="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="数量" data-skip-page-rerender="true"></label>
        </div>`,
      ) : '',
    ].join(''),
  })
}

function mountTransferPage(config: TransferPageConfig): string {
  const controller = controllers.get(config.key)!
  controller.entry()
  return `<div data-${config.eventPrefix}-root data-skip-page-rerender="true"><div data-${config.eventPrefix}-workspace>${renderTransferListPage(config)}</div></div>`
}

export function renderTransferWaitHandoverPage(): string { return mountTransferPage(TRANSFER_PAGES[0]) }
export function renderTransferHandoverPage(): string { return mountTransferPage(TRANSFER_PAGES[1]) }
export function renderTransferWaitInboundPage(): string { return mountTransferPage(TRANSFER_PAGES[2]) }

export function handleTransferWaitHandoverPageEvent(target: HTMLElement, event?: Event): boolean {
  return controllers.get('wait-handover')!.handle(target, event)
}
export function handleTransferHandoverPageEvent(target: HTMLElement, event?: Event): boolean {
  return controllers.get('handover')!.handle(target, event)
}
export function handleTransferWaitInboundPageEvent(target: HTMLElement, event?: Event): boolean {
  return controllers.get('wait-inbound')!.handle(target, event)
}

TRANSFER_PAGES.forEach((config) => {
  controllers.get(config.key)!.setRenderer(() => renderTransferListPage(config))
})
