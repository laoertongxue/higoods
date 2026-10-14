// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { createStandardListPage, type TransitOnlineListDefinition } from './list-factory.ts'
import { mahameruInventorySeed, type TransitOnlineInventoryRow } from './seed.ts'
import type { StandardListColumn } from '../../../components/ui/list-table.ts'

const statusClass: Record<string, string> = {
  待上架: 'bg-orange-50 text-orange-700',
  已上架: 'bg-emerald-50 text-emerald-700',
  已出库: 'bg-blue-50 text-blue-700',
}

const EVENT = 'wls-online-mahameru-inventory'

const columns: StandardListColumn<TransitOnlineInventoryRow>[] = [
  {
    key: 'productionNo',
    title: '生产单号',
    width: 120,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (r) => r.productionNo,
    render: (r) => `<span class="text-slate-700">${escapeHtml(r.productionNo)}</span>`,
  },
  {
    key: 'sku',
    title: 'SKU',
    width: 200,
    sortable: true,
    sortValue: (r) => r.sku,
    render: (r) => `<div class="min-w-0"><div class="font-mono text-xs text-slate-700">${escapeHtml(r.sku)}</div><div class="truncate text-xs text-slate-500">${escapeHtml(r.materialName)}</div></div>`,
  },
  { key: 'area', title: '库区', width: 110, sortable: true, sortValue: (r) => r.area, render: (r) => `<span class="text-xs text-slate-500">${escapeHtml(r.area)}</span>` },
  {
    key: 'location',
    title: '库位',
    width: 110,
    sortable: true,
    sortValue: (r) => r.location,
    render: (r) => `<span class="rounded bg-blue-50 px-2 py-0.5 font-mono text-xs text-blue-700">${escapeHtml(r.location)}</span>`,
  },
  { key: 'pendingQty', title: '待上架数量', width: 110, align: 'right', sortable: true, sortValue: (r) => r.pendingQty, render: (r) => `<span class="text-slate-600">${r.pendingQty}</span>` },
  { key: 'shelfQty', title: '货架数量', width: 100, align: 'right', sortable: true, sortValue: (r) => r.shelfQty, render: (r) => `<span class="font-medium text-slate-700">${r.shelfQty}</span>` },
  { key: 'outboundQty', title: '出库数量', width: 100, align: 'right', sortable: true, sortValue: (r) => r.outboundQty, render: (r) => `<span class="text-slate-600">${r.outboundQty}</span>` },
  { key: 'warehouse', title: '仓库', width: 160, sortable: true, sortValue: (r) => r.warehouse, render: (r) => `<span class="text-xs text-slate-500">${escapeHtml(r.warehouse)}</span>` },
  {
    key: 'status',
    title: '状态',
    width: 100,
    sortable: true,
    sortValue: (r) => r.status,
    render: (r) => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status] ?? ''}">${escapeHtml(r.status)}</span>`,
  },
  { key: 'updateTime', title: '更新时间', width: 150, sortable: true, sortValue: (r) => r.updateTime, render: (r) => `<span class="text-xs text-slate-400">${escapeHtml(r.updateTime)}</span>` },
  {
    key: 'actions',
    title: '操作',
    width: 100,
    required: true,
    actionColumn: true,
    render: (r) => `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT}-action="view-barcode" data-${EVENT}-idx="${mahameruInventorySeed.indexOf(r)}">查看条码</button>`,
  },
]

const definition: TransitOnlineListDefinition<TransitOnlineInventoryRow> = {
  eventPrefix: EVENT,
  preferenceKey: '/wls/online/mahameru-inventory:list-columns',
  title: '中转仓库存查询',
  listTitle: '中转仓库存',
  columns,
  rows: mahameruInventorySeed,
  emptyText: '暂无库存记录',
  defaultFrozenKeys: ['productionNo'],
  detailTitle: '中转仓库存明细',
  exportFileName: '中转仓库存',
  searches: [
    { name: 'productionNo', label: '生产单号', placeholder: '搜索生产单号' },
    { name: 'sku', label: '商品 SKU', placeholder: '搜索 SKU' },
    { name: 'spu', label: '商品 SPU', placeholder: '搜索 SPU' },
  ],
  tabs: [
    { key: '全部', label: '全部' },
    { key: '待上架', label: '待上架' },
    { key: '已上架', label: '已上架' },
    { key: '已出库', label: '已出库' },
  ],
  stats: (rows) => [
    { label: '记录数', value: `${rows.length} 条` },
    { label: '待上架', value: `${rows.reduce((sum, r) => sum + r.pendingQty, 0)} 件` },
    { label: '货架库存', value: `${rows.reduce((sum, r) => sum + r.shelfQty, 0)} 件` },
    { label: '已出库', value: `${rows.reduce((sum, r) => sum + r.outboundQty, 0)} 件` },
  ],
  matches: (row, query) => {
    if (query.tab && query.tab !== '全部' && row.status !== query.tab) return false
    const productionNo = (query.searches.productionNo ?? '').trim().toLowerCase()
    if (productionNo && !row.productionNo.toLowerCase().includes(productionNo)) return false
    const sku = (query.searches.sku ?? '').trim().toLowerCase()
    if (sku && !row.sku.toLowerCase().includes(sku)) return false
    const spu = (query.searches.spu ?? '').trim().toLowerCase()
    if (spu && !row.spu.toLowerCase().includes(spu)) return false
    return true
  },
  onAction: (action, node, ctx) => {
    if (action === 'view-barcode') {
      const idx = Number(node.dataset['wlsOnlineMahameruInventoryIdx'])
      const row = ctx.rows[idx]
      if (row) showListFeedback(`已生成 ${row.sku} @ ${row.location} 的条码视图`)
      return true
    }
    return false
  },
}

const page = createStandardListPage(definition)

export function renderTransitOnlineMahameruInventoryPage(): string {
  return page.render()
}

export function handleTransitOnlineMahameruInventoryEvent(target: HTMLElement, event?: Event): boolean {
  return page.handle(target, event)
}
