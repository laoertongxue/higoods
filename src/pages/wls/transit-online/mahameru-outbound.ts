// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { createStandardListPage, type TransitOnlineListDefinition } from './list-factory.ts'
import { mahameruOutboundSeed, type TransitOnlineOutboundRow } from './seed.ts'
import type { StandardListColumn } from '../../../components/ui/list-table.ts'

const EVENT = 'wls-online-mahameru-outbound'

const statusClass: Record<string, string> = {
  待出库: 'bg-orange-50 text-orange-700',
  已领料: 'bg-blue-50 text-blue-700',
  已取消: 'bg-slate-100 text-slate-500',
  已出库: 'bg-emerald-50 text-emerald-700',
}

const columns: StandardListColumn<TransitOnlineOutboundRow>[] = [
  {
    key: 'no',
    title: '单号',
    width: 200,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (r) => r.no,
    render: (r) => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.no)}</span>`,
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    sortable: true,
    sortValue: (r) => r.status,
    render: (r) => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status] ?? ''}">${escapeHtml(r.status)}</span>`,
  },
  {
    key: 'material',
    title: '面料信息',
    width: 240,
    sortable: true,
    sortValue: (r) => r.sku,
    render: (r) => `<div class="min-w-0"><div class="font-mono text-xs text-slate-700">${escapeHtml(r.sku)}</div><div class="truncate text-xs text-slate-500">${escapeHtml(r.materialName)}</div></div>`,
  },
  { key: 'planQty', title: '计划出库', width: 100, align: 'right', sortable: true, sortValue: (r) => r.planQty, render: (r) => `<span class="text-slate-600">${r.planQty} 卷</span>` },
  { key: 'allocationQty', title: '配料数量', width: 100, align: 'right', sortable: true, sortValue: (r) => r.allocationQty, render: (r) => `<span class="text-slate-600">${r.allocationQty} 卷</span>` },
  { key: 'actualQty', title: '实际出库', width: 100, align: 'right', sortable: true, sortValue: (r) => r.actualQty, render: (r) => `<span class="font-medium text-slate-700">${r.actualQty} 卷</span>` },
  { key: 'time', title: '时间', width: 150, sortable: true, sortValue: (r) => r.time, render: (r) => `<span class="text-xs text-slate-400">${escapeHtml(r.time)}</span>` },
  {
    key: 'actions',
    title: '操作',
    width: 240,
    required: true,
    actionColumn: true,
    render: (r) => {
      const idx = mahameruOutboundSeed.indexOf(r)
      const btn = (action: string, label: string) =>
        `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT}-action="${action}" data-${EVENT}-idx="${idx}">${label}</button>`
      const extra =
        r.status === '待出库'
          ? `${btn('row-update-allocation', '更新裁片配料')}<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-${EVENT}-action="row-confirm" data-${EVENT}-idx="${idx}">确认出库</button>`
          : ''
      return `<div class="flex items-center gap-1">${btn('view-detail', '查看明细')}${extra}</div>`
    },
  },
]

const definition: TransitOnlineListDefinition<TransitOnlineOutboundRow> = {
  eventPrefix: EVENT,
  preferenceKey: '/wls/online/mahameru-outbound:list-columns',
  title: '中转出库单列表',
  listTitle: '出库单列表',
  columns,
  rows: mahameruOutboundSeed,
  emptyText: '暂无出库单',
  defaultFrozenKeys: ['no'],
  detailTitle: '中转出库单详情',
  exportFileName: '中转出库单',
  searches: [
    { name: 'keyword', label: '综合查询', placeholder: '出库单号 / 生产单号', wide: true },
    { name: 'sku', label: '商品 SKU', placeholder: '搜索 SKU' },
  ],
  tabs: [
    { key: '全部', label: '全部' },
    { key: '待出库', label: '待出库' },
    { key: '已领料', label: '已领料' },
    { key: '已取消', label: '已取消' },
    { key: '已出库', label: '已出库' },
  ],
  stats: (rows) => [
    { label: '记录数', value: `${rows.length} 条` },
    { label: '待出库', value: `${rows.filter((r) => r.status === '待出库').length} 条` },
    { label: '已出库', value: `${rows.filter((r) => r.status === '已出库').length} 条` },
  ],
  matches: (row, query) => {
    if (query.tab && query.tab !== '全部' && row.status !== query.tab) return false
    const keyword = (query.searches.keyword ?? '').trim().toLowerCase()
    if (keyword) {
      const haystack = `${row.no} ${row.productionNo}`.toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    const sku = (query.searches.sku ?? '').trim().toLowerCase()
    if (sku && !row.sku.toLowerCase().includes(sku)) return false
    return true
  },
  onAction: (action, node, ctx) => {
    const idx = Number(node.dataset['wlsOnlineMahameruOutboundIdx'])
    if (action === 'row-update-allocation') {
      const row = ctx.rows[idx]
      if (row) showListFeedback(`出库单 ${row.no} 的裁片配料已更新`)
      return true
    }
    if (action === 'row-confirm') {
      const row = ctx.rows[idx]
      if (row) {
        row.status = '已出库'
        row.actualQty = row.planQty
        showListFeedback(`出库单 ${row.no} 已确认出库 ${row.actualQty} 卷`)
      }
      return true
    }
    return false
  },
}

const page = createStandardListPage(definition)

export function renderTransitOnlineMahameruOutboundPage(): string {
  return page.render()
}

export function handleTransitOnlineMahameruOutboundEvent(target: HTMLElement, event?: Event): boolean {
  return page.handle(target, event)
}
