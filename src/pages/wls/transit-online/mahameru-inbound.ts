// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderFormDialog } from '../../../components/ui/dialog.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { createStandardListPage, type TransitOnlineListDefinition } from './list-factory.ts'
import { mahameruInboundSeed, transitOnlineWarehouses, type TransitOnlineInboundRow } from './seed.ts'
import type { StandardListColumn } from '../../../components/ui/list-table.ts'

const EVENT = 'wls-online-mahameru-inbound'

const statusClass: Record<string, string> = {
  待收货: 'bg-orange-50 text-orange-700',
  部分收货: 'bg-blue-50 text-blue-700',
  收货完成: 'bg-emerald-50 text-emerald-700',
  已取消: 'bg-slate-100 text-slate-500',
}

const createDraft: { docType: string; sourceNo: string; sku: string; packageCount: string; quantity: string } = {
  docType: '申请调拨',
  sourceNo: '',
  sku: '',
  packageCount: '',
  quantity: '',
}
let createOpen = false

const columns: StandardListColumn<TransitOnlineInboundRow>[] = [
  {
    key: 'no',
    title: '单号',
    width: 190,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (r) => r.no,
    render: (r) => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.no)}</span>`,
  },
  {
    key: 'material',
    title: '面料信息',
    width: 240,
    sortable: true,
    sortValue: (r) => r.sku,
    render: (r) => `<div class="min-w-0"><div class="font-mono text-xs text-slate-700">${escapeHtml(r.sku)}</div><div class="truncate text-xs text-slate-500">${escapeHtml(r.materialName)}</div></div>`,
  },
  { key: 'docType', title: '单据类型', width: 110, sortable: true, sortValue: (r) => r.docType, render: (r) => `<span class="text-xs text-slate-500">${escapeHtml(r.docType)}</span>` },
  {
    key: 'status',
    title: '订单状态',
    width: 100,
    sortable: true,
    sortValue: (r) => r.status,
    render: (r) => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status] ?? ''}">${escapeHtml(r.status)}</span>`,
  },
  { key: 'source', title: '来料来源', width: 110, sortable: true, sortValue: (r) => r.source, render: (r) => `<span class="text-xs text-slate-500">${escapeHtml(r.source)}</span>` },
  { key: 'expectedQty', title: '应收数量 (卷/Yard)', width: 130, align: 'right', sortable: true, sortValue: (r) => r.expectedQty, render: (r) => `<span class="font-medium text-slate-700">${r.expectedQty} 卷/Yard</span>` },
  { key: 'time', title: '时间', width: 150, sortable: true, sortValue: (r) => r.time, render: (r) => `<span class="text-xs text-slate-400">${escapeHtml(r.time)}</span>` },
  {
    key: 'actions',
    title: '操作',
    width: 100,
    required: true,
    actionColumn: true,
    render: (r) => `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT}-action="view-detail" data-${EVENT}-idx="${mahameruInboundSeed.indexOf(r)}">查看明细</button>`,
  },
]

function renderCreateDialog(): string {
  const content = `<div class="grid grid-cols-2 gap-x-6 gap-y-3">
    <label class="flex min-w-0 flex-col gap-1"><span class="text-xs text-muted-foreground">单据类型</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT}-field="create:docType">${['申请调拨', '染色交出', '印花交出', '绣花交出'].map((option) => `<option value="${option}" ${createDraft.docType === option ? 'selected' : ''}>${option}</option>`).join('')}</select></label>
    <label class="flex min-w-0 flex-col gap-1"><span class="text-xs text-muted-foreground">来源单号 (必填)</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(createDraft.sourceNo)}" placeholder="来源单号 / 生产单号" data-${EVENT}-field="create:sourceNo"></label>
    <label class="col-span-2 flex min-w-0 flex-col gap-1"><span class="text-xs text-muted-foreground">面料 SKU (必填)</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(createDraft.sku)}" placeholder="如 CNIDML002-ge001296" data-${EVENT}-field="create:sku"></label>
    <label class="flex min-w-0 flex-col gap-1"><span class="text-xs text-muted-foreground">包装数</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" type="number" value="${escapeHtml(createDraft.packageCount)}" placeholder="卷数" data-${EVENT}-field="create:packageCount"></label>
    <label class="flex min-w-0 flex-col gap-1"><span class="text-xs text-muted-foreground">应收数量</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" type="number" value="${escapeHtml(createDraft.quantity)}" placeholder="卷/Yard" data-${EVENT}-field="create:quantity"></label>
    <p class="col-span-2 text-xs text-muted-foreground">入库仓库：${escapeHtml(transitOnlineWarehouses.mahameru.name)}（${escapeHtml(transitOnlineWarehouses.mahameru.code)}）</p>
  </div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
  return renderFormDialog(
    {
      title: '创建入库单',
      description: '按来源单登记预入库面料，保存后进入待收货。',
      closeAction: { prefix: EVENT, action: 'close-create' },
      submitAction: { prefix: EVENT, action: 'submit-create', label: '保存入库单' },
      width: 'lg',
    },
    content,
  )
}

const definition: TransitOnlineListDefinition<TransitOnlineInboundRow> = {
  eventPrefix: EVENT,
  preferenceKey: '/wls/online/mahameru-inbound:list-columns',
  title: '中转预入库列表',
  listTitle: '预入库单列表',
  columns,
  rows: mahameruInboundSeed,
  emptyText: '暂无预入库单',
  defaultFrozenKeys: ['no'],
  detailTitle: '中转预入库单详情',
  exportFileName: '中转预入库单',
  primaryActionsHtml: () =>
    `<div class="flex flex-wrap items-center gap-2">${renderPrimaryButton('创建入库单', { prefix: EVENT, action: 'open-create' }, 'plus')}${renderSecondaryButton('调拨入库', { prefix: EVENT, action: 'transfer-inbound' }, 'arrow-down-to-line')}</div>`,
  searches: [
    { name: 'keyword', label: '综合查询', placeholder: '预入库单号 / 来源单号 / 生产单号 / 收货单号', wide: true },
    { name: 'sku', label: '商品 SKU / SPU', placeholder: 'SKU / SPU' },
    { name: 'productionOrderNo', label: '生产订单号', placeholder: '生产订单号' },
    { name: 'demandNo', label: '需求单号', placeholder: '需求单号' },
  ],
  selects: [
    { name: 'orderType', label: '单据类型', options: ['全部单据类型', '申请调拨', '染色交出', '印花交出', '绣花交出'] },
    { name: 'status', label: '订单状态', options: ['全部', '待收货', '部分收货', '收货完成', '已取消'] },
  ],
  stats: (rows) => [
    { label: '记录数', value: `${rows.length} 条` },
    { label: '待收货', value: `${rows.filter((r) => r.status === '待收货').length} 条` },
    { label: '部分收货', value: `${rows.filter((r) => r.status === '部分收货').length} 条` },
    { label: '收货完成', value: `${rows.filter((r) => r.status === '收货完成').length} 条` },
  ],
  matches: (row, query) => {
    const orderType = query.selects.orderType ?? ''
    if (orderType && row.docType !== orderType) return false
    const status = query.selects.status ?? ''
    if (status && row.status !== status) return false
    const keyword = (query.searches.keyword ?? '').trim().toLowerCase()
    if (keyword) {
      const haystack = `${row.no} ${row.receiveNo} ${row.productionNo} ${row.productionOrderNo}`.toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    const sku = (query.searches.sku ?? '').trim().toLowerCase()
    if (sku && !`${row.sku} ${row.spu}`.toLowerCase().includes(sku)) return false
    const productionOrderNo = (query.searches.productionOrderNo ?? '').trim().toLowerCase()
    if (productionOrderNo && !row.productionOrderNo.toLowerCase().includes(productionOrderNo)) return false
    const demandNo = (query.searches.demandNo ?? '').trim().toLowerCase()
    if (demandNo && !row.demandNo.toLowerCase().includes(demandNo)) return false
    return true
  },
  onField: (name, element) => {
    if (!name.startsWith('create:')) return false
    const field = name.slice('create:'.length) as keyof typeof createDraft
    createDraft[field] = (element as HTMLInputElement).value
    return true
  },
  onAction: (action) => {
    if (action === 'open-create') {
      createOpen = true
      return true
    }
    if (action === 'close-create') {
      createOpen = false
      return true
    }
    if (action === 'submit-create') {
      if (!createDraft.sourceNo.trim() || !createDraft.sku.trim()) {
        showListFeedback('请填写来源单号与面料 SKU 后再保存', 'warning')
        return true
      }
      createOpen = false
      showListFeedback(`入库单已创建：${createDraft.sku}，等待收货`)
      createDraft.sourceNo = ''
      createDraft.sku = ''
      createDraft.packageCount = ''
      createDraft.quantity = ''
      return true
    }
    if (action === 'transfer-inbound') {
      showListFeedback('已打开调拨入库来源选择，请选择调拨单后继续')
      return true
    }
    return false
  },
  overlaysHtml: () => (createOpen ? renderCreateDialog() : ''),
}

const page = createStandardListPage(definition)

export function renderTransitOnlineMahameruInboundPage(): string {
  return page.render()
}

export function handleTransitOnlineMahameruInboundEvent(target: HTMLElement, event?: Event): boolean {
  return page.handle(target, event)
}
