// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderDialog, renderFormDialog } from '../../../components/ui/dialog.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { createStandardListPage, type TransitOnlineListDefinition, type TransitOnlineListContext } from './list-factory.ts'
import { mahameruReceivedSeed, type TransitOnlineReceivedRow } from './seed.ts'
import type { StandardListColumn } from '../../../components/ui/list-table.ts'

const EVENT = 'wls-online-mahameru-received'
const DATA_PREFIX = 'wlsOnlineMahameruReceived'

// 勾选列选中行（group8 行22、group9 行11）。
const selectedRows = new Set<number>()

const receiveClass: Record<string, string> = {
  待收货: 'bg-orange-50 text-orange-700',
  收货完成: 'bg-emerald-50 text-emerald-700',
}

const taskClass: Record<string, string> = {
  待处理: 'bg-orange-50 text-orange-700',
  未配齐: 'bg-amber-50 text-amber-700',
  已配齐: 'bg-emerald-50 text-emerald-700',
}

let expandedIdx = -1
let printOpen = false
let createOpen = false
const createDraft: { sourceNo: string; productionNo: string; sku: string; quantity: string } = {
  sourceNo: '',
  productionNo: '',
  sku: '',
  quantity: '',
}

const columns: StandardListColumn<TransitOnlineReceivedRow>[] = [
  {
    key: 'selection',
    title: '勾选',
    width: 56,
    required: true,
    freezeable: true,
    render: (r) => {
      const idx = mahameruReceivedSeed.indexOf(r)
      return `<input type="checkbox" class="h-4 w-4 rounded border-slate-300" ${selectedRows.has(idx) ? 'checked' : ''} data-${EVENT}-action="toggle-select" data-${EVENT}-idx="${idx}">`
    },
  },
  {
    key: 'receiveNo',
    title: '收货单号',
    width: 190,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (r) => r.receiveNo,
    render: (r) => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.receiveNo)}</span>`,
  },
  { key: 'sourceNo', title: '来源单号', width: 170, sortable: true, sortValue: (r) => r.sourceNo, render: (r) => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.sourceNo)}</span>` },
  { key: 'demandNo', title: '需求单号', width: 150, sortable: true, sortValue: (r) => r.demandNo, render: (r) => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.demandNo)}</span>` },
  { key: 'productionNo', title: '生产单号', width: 110, sortable: true, sortValue: (r) => r.productionNo, render: (r) => `<span class="text-slate-700">${escapeHtml(r.productionNo)}</span>` },
  {
    key: 'material',
    title: '面料信息',
    width: 220,
    sortable: true,
    sortValue: (r) => r.sku,
    render: (r) => `<div class="min-w-0"><div class="font-mono text-xs text-slate-700">${escapeHtml(r.sku)}</div><div class="truncate text-xs text-slate-500">${escapeHtml(r.materialName)}</div></div>`,
  },
  { key: 'expectedQty', title: '应收数量', width: 90, align: 'right', sortable: true, sortValue: (r) => r.expectedQty, render: (r) => `<span class="text-slate-600">${r.expectedQty} 件</span>` },
  { key: 'actualQty', title: '实收数量', width: 90, align: 'right', sortable: true, sortValue: (r) => r.actualQty, render: (r) => `<span class="font-medium text-slate-700">${r.actualQty} 件</span>` },
  {
    key: 'receiveStatus',
    title: '收货状态',
    width: 100,
    sortable: true,
    sortValue: (r) => r.receiveStatus,
    render: (r) => `<span class="rounded-full px-2 py-0.5 text-xs ${receiveClass[r.receiveStatus] ?? ''}">${escapeHtml(r.receiveStatus)}</span>`,
  },
  { key: 'kitType', title: '齐套类型', width: 130, sortable: true, sortValue: (r) => r.kitType, render: (r) => `<span class="text-xs text-slate-600">${escapeHtml(r.kitType)}</span>` },
  {
    key: 'taskStatus',
    title: '任务状态',
    width: 100,
    sortable: true,
    sortValue: (r) => r.taskStatus,
    render: (r) => `<span class="rounded-full px-2 py-0.5 text-xs ${taskClass[r.taskStatus] ?? ''}">${escapeHtml(r.taskStatus)}</span>`,
  },
  {
    key: 'actions',
    title: '操作',
    width: 340,
    required: true,
    actionColumn: true,
    render: (r) => {
      const idx = mahameruReceivedSeed.indexOf(r)
      const btn = (action: string, label: string) =>
        `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT}-action="${action}" data-${EVENT}-idx="${idx}">${label}</button>`
      const base = `${btn('toggle-expand', expandedIdx === idx ? '收起' : '展开')}${btn('row-log', '查看日志')}${btn('row-barcode', '查看条码')}`
      const branch =
        r.receiveStatus === '待收货'
          ? `<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-${EVENT}-action="row-receive" data-${EVENT}-idx="${idx}">收货</button>`
          : r.taskStatus === '未配齐'
            ? `${btn('row-unmatched-task', '查看未配齐上架任务')}${btn('row-print-unmatched', '打印未配齐的上架任务单')}${btn('row-complete', '完成')}`
            : btn('row-alloc-task', '查看可配齐配料任务单')
      return `<div class="flex flex-wrap items-center gap-1">${base}${branch}</div>`
    },
  },
]

function renderExpansion(ctx: TransitOnlineListContext<TransitOnlineReceivedRow>): string {
  const row = ctx.rows[expandedIdx]
  if (!row) return ''
  const detailRows = row.details
    .map(
      (detail) => `<tr class="border-b last:border-b-0"><td class="px-3 py-1.5 font-mono text-xs">${escapeHtml(detail.sku)}</td><td class="px-3 py-1.5 text-xs">${escapeHtml(detail.materialName)}</td><td class="px-3 py-1.5 text-right text-xs">${detail.expectedQty} 件</td><td class="px-3 py-1.5 text-right text-xs">${detail.actualQty} 件</td><td class="px-3 py-1.5 text-right text-xs">${detail.allocationQty} 件</td><td class="px-3 py-1.5 text-right text-xs">${detail.putawayQty} 件</td><td class="px-3 py-1.5 text-right text-xs">${detail.rollCount} 卷</td></tr>`,
    )
    .join('')
  return `<div class="border-t bg-slate-50/70 px-3 py-3" data-${EVENT}-expansion>
    <p class="mb-2 text-xs font-medium text-slate-600">收货单 ${escapeHtml(row.receiveNo)} · 明细 / 配货 / 上架</p>
    <table class="w-full table-fixed border-collapse">
      <thead><tr class="border-b text-left text-xs text-muted-foreground"><th class="px-3 py-1.5">物料 SKU</th><th class="px-3 py-1.5">名称</th><th class="px-3 py-1.5 text-right">应收</th><th class="px-3 py-1.5 text-right">实收</th><th class="px-3 py-1.5 text-right">已配货</th><th class="px-3 py-1.5 text-right">已上架</th><th class="px-3 py-1.5 text-right">卷数</th></tr></thead>
      <tbody>${detailRows}</tbody>
    </table>
  </div>`
}

function renderPrintDialog(ctx: TransitOnlineListContext<TransitOnlineReceivedRow>): string {
  const rows = ctx.filtered().slice(0, 12)
  const content = `<div class="max-h-[50vh] overflow-y-auto"><table class="w-full table-fixed border-collapse text-xs">
    <thead><tr class="border-b text-left text-muted-foreground"><th class="px-2 py-1.5">收货单号</th><th class="px-2 py-1.5">生产单号</th><th class="px-2 py-1.5 text-right">实收</th><th class="px-2 py-1.5">任务状态</th></tr></thead>
    <tbody>${rows.map((row) => `<tr class="border-b last:border-b-0"><td class="px-2 py-1.5 font-mono">${escapeHtml(row.receiveNo)}</td><td class="px-2 py-1.5">${escapeHtml(row.productionNo)}</td><td class="px-2 py-1.5 text-right">${row.actualQty} 件</td><td class="px-2 py-1.5">${escapeHtml(row.taskStatus)}</td></tr>`).join('')}</tbody>
  </table></div>
  <p class="mt-3 text-xs text-muted-foreground">共 ${ctx.filtered().length} 张收货后任务单，将按当前筛选结果打印。</p>`
  return renderFormDialog(
    {
      title: '打印收货后任务单',
      description: '确认打印范围后生成收货后任务单。',
      closeAction: { prefix: EVENT, action: 'close-print' },
      submitAction: { prefix: EVENT, action: 'confirm-print', label: '确认打印' },
      width: 'lg',
    },
    content,
  )
}

function renderCreateDialog(): string {
  const content = `<div class="grid grid-cols-2 gap-x-6 gap-y-3">
    <label class="flex min-w-0 flex-col gap-1"><span class="text-xs text-muted-foreground">来源单号 (必填)</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(createDraft.sourceNo)}" placeholder="来源单号 / 入库单号" data-${EVENT}-field="create:sourceNo"></label>
    <label class="flex min-w-0 flex-col gap-1"><span class="text-xs text-muted-foreground">生产单号 (必填)</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(createDraft.productionNo)}" placeholder="生产单号" data-${EVENT}-field="create:productionNo"></label>
    <label class="col-span-2 flex min-w-0 flex-col gap-1"><span class="text-xs text-muted-foreground">面料 SKU (必填)</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(createDraft.sku)}" placeholder="如 CNIDML002-ge001296" data-${EVENT}-field="create:sku"></label>
    <label class="flex min-w-0 flex-col gap-1"><span class="text-xs text-muted-foreground">实收数量</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" type="number" value="${escapeHtml(createDraft.quantity)}" placeholder="件" data-${EVENT}-field="create:quantity"></label>
  </div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
  return renderFormDialog(
    {
      title: '创建收货单',
      description: '按来源单登记实收面料，保存后进入收货与上架流程。',
      closeAction: { prefix: EVENT, action: 'close-create' },
      submitAction: { prefix: EVENT, action: 'submit-create', label: '保存收货单' },
      width: 'lg',
    },
    content,
  )
}

const definition: TransitOnlineListDefinition<TransitOnlineReceivedRow> = {
  eventPrefix: EVENT,
  preferenceKey: '/wls/online/mahameru-received:list-columns',
  title: '中转收货单列表',
  listTitle: '收货单列表',
  columns,
  rows: mahameruReceivedSeed,
  emptyText: '暂无收货单',
  defaultFrozenKeys: ['selection', 'receiveNo'],
  exportFileName: '中转收货单',
  primaryActionsHtml: () =>
    `<div class="flex flex-wrap items-center gap-2">${renderPrimaryButton('创建收货单', { prefix: EVENT, action: 'open-create' }, 'plus')}${renderSecondaryButton('打印收货后任务单', { prefix: EVENT, action: 'open-print' }, 'printer')}</div>`,
  searches: [
    { name: 'keyword', label: '综合查询', placeholder: '收货单号 / 生产单号 / 入库单号 / 来源单号 / 需求单号', wide: true },
    { name: 'sku', label: '商品 SKU', placeholder: '搜索商品 SKU' },
    { name: 'spu', label: '商品 SPU', placeholder: '搜索商品 SPU' },
  ],
  selects: [
    { name: 'taskStatusFilter', label: '全部任务状态', options: ['全部任务状态', '待处理', '未配齐', '已配齐'] },
  ],
  tabs: [
    { key: '全部', label: '全部' },
    { key: '待收货', label: '待收货' },
    { key: '收货完成', label: '收货完成' },
  ],
  stats: (rows) => [
    { label: '记录数', value: `${rows.length} 条` },
    { label: '待收货', value: `${rows.filter((r) => r.receiveStatus === '待收货').length} 条` },
    { label: '收货完成', value: `${rows.filter((r) => r.receiveStatus === '收货完成').length} 条` },
    { label: '未配齐', value: `${rows.filter((r) => r.taskStatus === '未配齐').length} 条` },
  ],
  matches: (row, query) => {
    const tab = query.tab
    if (tab && tab !== '全部' && row.receiveStatus !== tab) return false
    const taskStatusFilter = query.selects.taskStatusFilter ?? ''
    if (taskStatusFilter && taskStatusFilter !== '全部任务状态' && row.taskStatus !== taskStatusFilter) return false
    const keyword = (query.searches.keyword ?? '').trim().toLowerCase()
    if (keyword) {
      const haystack = `${row.receiveNo} ${row.sourceNo} ${row.demandNo} ${row.productionNo}`.toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    const sku = (query.searches.sku ?? '').trim().toLowerCase()
    if (sku && !row.sku.toLowerCase().includes(sku)) return false
    const spu = (query.searches.spu ?? '').trim().toLowerCase()
    if (spu && !row.productionNo.toLowerCase().includes(spu)) return false
    return true
  },
  extraTableHtml: (ctx) => (expandedIdx >= 0 ? renderExpansion(ctx) : ''),
  overlaysHtml: (ctx) => [printOpen ? renderPrintDialog(ctx) : '', createOpen ? renderCreateDialog() : ''].join(''),
  onField: (name, element) => {
    if (!name.startsWith('create:')) return false
    const field = name.slice('create:'.length) as keyof typeof createDraft
    createDraft[field] = (element as HTMLInputElement).value
    return true
  },
  onAction: (action, node, ctx) => {
    const idxOf = () => Number(node.dataset[`${DATA_PREFIX}Idx`])
    if (action === 'toggle-select') {
      const idx = idxOf()
      if (selectedRows.has(idx)) selectedRows.delete(idx)
      else selectedRows.add(idx)
      return true
    }
    if (action === 'row-log') {
      const row = ctx.rows[idxOf()]
      if (row) showListFeedback(`收货单 ${row.receiveNo} 操作日志：创建 → 收货 → 配料`)
      return true
    }
    if (action === 'row-barcode') {
      const row = ctx.rows[idxOf()]
      if (row) showListFeedback(`已生成收货单 ${row.receiveNo} 的条码视图`)
      return true
    }
    if (action === 'row-receive') {
      const row = ctx.rows[idxOf()]
      if (row) showListFeedback(`收货单 ${row.receiveNo} 已进入收货，实收 ${row.actualQty} 件`)
      return true
    }
    if (action === 'row-unmatched-task') {
      showListFeedback('已打开未配齐上架任务列表')
      return true
    }
    if (action === 'row-print-unmatched') {
      showListFeedback('已生成未配齐的上架任务单打印任务')
      return true
    }
    if (action === 'row-complete') {
      const row = ctx.rows[idxOf()]
      if (row) {
        row.taskStatus = '已配齐'
        showListFeedback(`收货单 ${row.receiveNo} 已标记完成配齐`)
      }
      return true
    }
    if (action === 'row-alloc-task') {
      showListFeedback('已打开可配齐配料任务单')
      return true
    }
    if (action === 'toggle-expand') {
      const idx = Number(node.dataset[`${DATA_PREFIX}Idx`])
      expandedIdx = expandedIdx === idx ? -1 : idx
      return true
    }
    if (action === 'print-row') {
      const idx = Number(node.dataset[`${DATA_PREFIX}Idx`])
      const row = ctx.rows[idx]
      if (row) showListFeedback(`已生成收货单 ${row.receiveNo} 的任务单打印任务`)
      return true
    }
    if (action === 'open-print') {
      printOpen = true
      return true
    }
    if (action === 'close-print') {
      printOpen = false
      return true
    }
    if (action === 'confirm-print') {
      printOpen = false
      showListFeedback(`已生成 ${ctx.filtered().length} 张收货后任务单`)
      return true
    }
    if (action === 'open-create') {
      createOpen = true
      return true
    }
    if (action === 'close-create') {
      createOpen = false
      return true
    }
    if (action === 'submit-create') {
      if (!createDraft.sourceNo.trim() || !createDraft.productionNo.trim() || !createDraft.sku.trim()) {
        showListFeedback('请填写来源单号、生产单号与面料 SKU 后再保存', 'warning')
        return true
      }
      createOpen = false
      showListFeedback(`收货单已创建：${createDraft.productionNo}，等待收货`)
      createDraft.sourceNo = ''
      createDraft.productionNo = ''
      createDraft.sku = ''
      createDraft.quantity = ''
      return true
    }
    return false
  },
}

const page = createStandardListPage(definition)

export function renderTransitOnlineMahameruReceivedPage(): string {
  return page.render()
}

export function handleTransitOnlineMahameruReceivedEvent(target: HTMLElement, event?: Event): boolean {
  return page.handle(target, event)
}
