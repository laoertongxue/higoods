// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { createStandardListPage, type TransitOnlineListDefinition } from './list-factory.ts'
import { mahameruLocationRows, type TransitOnlineLocation } from './seed.ts'
import type { StandardListColumn } from '../../../components/ui/list-table.ts'

const statusClass: Record<string, string> = {
  空闲: 'bg-emerald-50 text-emerald-700',
  占用: 'bg-orange-50 text-orange-700',
}

const EVENT = 'wls-online-mahameru-location'

const columns: StandardListColumn<TransitOnlineLocation>[] = [
  {
    key: 'locationCode',
    title: '库位编号',
    width: 150,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (r) => r.locationCode,
    render: (r) => `<span class="rounded bg-blue-50 px-2 py-0.5 font-mono text-xs text-blue-700">${escapeHtml(r.locationCode)}</span>`,
  },
  { key: 'area', title: '所属库区', width: 130, sortable: true, sortValue: (r) => r.area, render: (r) => `<span class="text-xs text-slate-500">${escapeHtml(r.area)}</span>` },
  {
    key: 'status',
    title: '库位状态',
    width: 100,
    sortable: true,
    sortValue: (r) => r.status,
    render: (r) => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status] ?? ''}">${escapeHtml(r.status)}</span>`,
  },
  { key: 'productionNo', title: '绑定生产单号', width: 140, sortable: true, sortValue: (r) => r.productionNo, render: (r) => `<span class="text-slate-700">${escapeHtml(r.productionNo)}</span>` },
  { key: 'bindTime', title: '最后绑定时间', width: 170, sortable: true, sortValue: (r) => r.bindTime, render: (r) => `<span class="text-xs text-slate-400">${escapeHtml(r.bindTime)}</span>` },
  { key: 'skuCount', title: 'SKU 数', width: 90, align: 'right', sortable: true, sortValue: (r) => r.skuCount, render: (r) => `<span class="font-medium text-slate-700">${r.skuCount}</span>` },
  { key: 'warehouse', title: '仓库', width: 170, sortable: true, sortValue: (r) => r.warehouse, render: (r) => `<span class="text-xs text-slate-500">${escapeHtml(r.warehouse)}</span>` },
]

const definition: TransitOnlineListDefinition<TransitOnlineLocation> = {
  eventPrefix: EVENT,
  preferenceKey: '/wls/online/mahameru-location:list-columns',
  title: '中转仓库位管理',
  listTitle: '中转仓库位',
  columns,
  rows: mahameruLocationRows,
  emptyText: '暂无库位记录',
  defaultFrozenKeys: ['locationCode'],
  exportFileName: '中转仓库位',
  searches: [
    { name: 'keyword', label: '综合查询', placeholder: '库位编号 / 库区 / 生产单号', wide: true },
    { name: 'bindProductionNo', label: '绑定生产单号', placeholder: '绑定生产单号' },
  ],
  tabs: [
    { key: '全部', label: '全部' },
    { key: '空闲', label: '空闲' },
    { key: '占用', label: '占用' },
  ],
  stats: (rows) => [
    { label: '记录数', value: `${rows.length} 条` },
    { label: '空闲', value: `${rows.filter((r) => r.status === '空闲').length} 条` },
    { label: '占用', value: `${rows.filter((r) => r.status === '占用').length} 条` },
  ],
  matches: (row, query) => {
    if (query.tab && query.tab !== '全部' && row.status !== query.tab) return false
    const keyword = (query.searches.keyword ?? '').trim().toLowerCase()
    if (keyword) {
      const haystack = `${row.locationCode} ${row.area} ${row.productionNo}`.toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    const bindProductionNo = (query.searches.bindProductionNo ?? '').trim().toLowerCase()
    if (bindProductionNo && !row.productionNo.toLowerCase().includes(bindProductionNo)) return false
    return true
  },
}

const page = createStandardListPage(definition)

export function renderTransitOnlineMahameruLocationPage(): string {
  return page.render()
}

export function handleTransitOnlineMahameruLocationEvent(target: HTMLElement, event?: Event): boolean {
  return page.handle(target, event)
}
