// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { createStandardListPage, type TransitOnlineListDefinition } from './list-factory.ts'
import { mahameruAllocationSeed, type TransitOnlineAllocationRow } from './seed.ts'
import type { StandardListColumn } from '../../../components/ui/list-table.ts'

const EVENT = 'wls-online-mahameru-allocation'

// 勾选列选中行（group8 行59、group9 行12）。
const selectedRows = new Set<number>()

const flowClass: Record<string, string> = {
  待配料: 'bg-orange-50 text-orange-700',
  已配料: 'bg-emerald-50 text-emerald-700',
}

const columns: StandardListColumn<TransitOnlineAllocationRow>[] = [
  {
    key: 'selection',
    title: '勾选',
    width: 56,
    required: true,
    freezeable: true,
    render: (r) => `<input type="checkbox" class="h-4 w-4 rounded border-slate-300" ${selectedRows.has(mahameruAllocationSeed.indexOf(r)) ? 'checked' : ''} data-${EVENT}-action="toggle-select" data-${EVENT}-idx="${mahameruAllocationSeed.indexOf(r)}">`,
  },
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
  { key: 'allocationType', title: '配料类型', width: 110, sortable: true, sortValue: (r) => r.allocationType, render: (r) => `<span class="text-xs text-slate-500">${escapeHtml(r.allocationType)}</span>` },
  {
    key: 'material',
    title: '面料信息',
    width: 230,
    sortable: true,
    sortValue: (r) => r.sku,
    render: (r) => `<div class="min-w-0"><div class="font-mono text-xs text-slate-700">${escapeHtml(r.sku)}</div><div class="truncate text-xs text-slate-500">${escapeHtml(r.materialName)}</div></div>`,
  },
  { key: 'planQty', title: '计划数量', width: 100, align: 'right', sortable: true, sortValue: (r) => r.planQty, render: (r) => `<span class="text-slate-600">${r.planQty} 卷</span>` },
  { key: 'actualQty', title: '实际配料数量', width: 120, align: 'right', sortable: true, sortValue: (r) => r.actualQty, render: (r) => `<span class="font-medium text-slate-700">${r.actualQty} 卷</span>` },
  { key: 'workAreaQty', title: '作业区数量', width: 110, align: 'right', sortable: true, sortValue: (r) => r.workAreaQty, render: (r) => `<span class="text-slate-600">${r.workAreaQty} 卷</span>` },
  { key: 'shelfQty', title: '货架数量', width: 100, align: 'right', sortable: true, sortValue: (r) => r.shelfQty, render: (r) => `<span class="text-slate-600">${r.shelfQty} 卷</span>` },
  { key: 'warehouseQty', title: '仓库已有数量', width: 120, align: 'right', sortable: true, sortValue: (r) => r.warehouseQty, render: (r) => `<span class="text-slate-600">${r.warehouseQty} 卷</span>` },
  {
    key: 'flowStatus',
    title: '流转状态',
    width: 100,
    sortable: true,
    sortValue: (r) => r.flowStatus,
    render: (r) => `<span class="rounded-full px-2 py-0.5 text-xs ${flowClass[r.flowStatus] ?? ''}">${escapeHtml(r.flowStatus)}</span>`,
  },
  { key: 'taskStatus', title: '任务状态', width: 100, sortable: true, sortValue: (r) => r.taskStatus, render: (r) => `<span class="text-xs text-slate-600">${escapeHtml(r.taskStatus)}</span>` },
  { key: 'createTime', title: '生成时间', width: 150, sortable: true, sortValue: (r) => r.createTime, render: (r) => `<span class="text-xs text-slate-400">${escapeHtml(r.createTime)}</span>` },
  {
    key: 'actions',
    title: '操作',
    width: 210,
    required: true,
    actionColumn: true,
    render: (r) => {
      const idx = mahameruAllocationSeed.indexOf(r)
      const btn = (action: string, label: string) =>
        `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT}-action="${action}" data-${EVENT}-idx="${idx}">${label}</button>`
      return `<div class="flex items-center gap-1">${btn('view-detail', '查看明细')}${btn('row-log', '查看日志')}${btn('row-finish', '完成配料')}</div>`
    },
  },
]

const definition: TransitOnlineListDefinition<TransitOnlineAllocationRow> = {
  eventPrefix: EVENT,
  preferenceKey: '/wls/online/mahameru-allocation:list-columns',
  title: '中转配料单列表',
  listTitle: '配料单列表',
  columns,
  rows: mahameruAllocationSeed,
  emptyText: '暂无配料单',
  defaultFrozenKeys: ['selection', 'no'],
  detailTitle: '中转配料单详情',
  exportFileName: '中转配料单',
  searches: [
    { name: 'keyword', label: '综合查询', placeholder: '配料单号 / 收货单号 / 预入库单号 / 生产单号', wide: true },
    { name: 'sku', label: '商品 SKU', placeholder: '搜索 SKU' },
  ],
  tabs: [
    { key: '全部', label: '全部' },
    { key: '待配料', label: '待配料' },
    { key: '已配料', label: '已配料' },
  ],
  stats: (rows) => [
    { label: '记录数', value: `${rows.length} 条` },
    { label: '待配料', value: `${rows.filter((r) => r.flowStatus === '待配料').length} 条` },
    { label: '已配料', value: `${rows.filter((r) => r.flowStatus === '已配料').length} 条` },
  ],
  matches: (row, query) => {
    if (query.tab && query.tab !== '全部' && row.flowStatus !== query.tab) return false
    const keyword = (query.searches.keyword ?? '').trim().toLowerCase()
    if (keyword) {
      const haystack = `${row.no} ${row.receiveNo} ${row.inboundNo} ${row.productionNo}`.toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    const sku = (query.searches.sku ?? '').trim().toLowerCase()
    if (sku && !row.sku.toLowerCase().includes(sku)) return false
    return true
  },
  onAction: (action, node, ctx) => {
    const idx = Number(node.dataset['wlsOnlineMahameruAllocationIdx'])
    if (action === 'toggle-select') {
      if (selectedRows.has(idx)) selectedRows.delete(idx)
      else selectedRows.add(idx)
      return true
    }
    if (action === 'row-log') {
      const row = ctx.rows[idx]
      if (row) showListFeedback(`配料单 ${row.no} 操作日志：生成 → 配料 → 完成`)
      return true
    }
    if (action === 'row-finish') {
      const row = ctx.rows[idx]
      if (row) {
        if (row.flowStatus === '已配料') {
          showListFeedback(`配料单 ${row.no} 已完成配料`)
          return true
        }
        row.flowStatus = '已配料'
        row.actualQty = row.actualQty || row.planQty
        row.taskStatus = '已配齐'
        showListFeedback(`配料单 ${row.no} 已完成配料 ${row.actualQty} 卷`)
      }
      return true
    }
    return false
  },
}

const page = createStandardListPage(definition)

export function renderTransitOnlineMahameruAllocationPage(): string {
  return page.render()
}

export function handleTransitOnlineMahameruAllocationEvent(target: HTMLElement, event?: Event): boolean {
  return page.handle(target, event)
}
