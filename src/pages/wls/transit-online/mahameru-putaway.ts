// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { createStandardListPage, type TransitOnlineListDefinition } from './list-factory.ts'
import { mahameruPutawaySeed, type TransitOnlinePutawayRow } from './seed.ts'
import type { StandardListColumn } from '../../../components/ui/list-table.ts'

const statusClass: Record<string, string> = {
  待上架: 'bg-orange-50 text-orange-700',
  上架完成: 'bg-emerald-50 text-emerald-700',
  已释放: 'bg-slate-100 text-slate-500',
  已出库: 'bg-blue-50 text-blue-700',
}

// 勾选列选中行（上架单 / 作业单同构）。
const selectedRows = new Set<number>()

function buildPutawayColumns(eventPrefix: string): StandardListColumn<TransitOnlinePutawayRow>[] {
  return [
    {
      key: 'selection',
      title: '勾选',
      width: 56,
      required: true,
      freezeable: true,
      render: (r) => `<input type="checkbox" class="h-4 w-4 rounded border-slate-300" ${selectedRows.has(mahameruPutawaySeed.indexOf(r)) ? 'checked' : ''} data-${eventPrefix}-action="toggle-select" data-${eventPrefix}-idx="${mahameruPutawaySeed.indexOf(r)}">`,
    },
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
      key: 'location',
      title: '上架库位',
      width: 120,
      sortable: true,
      sortValue: (r) => r.location,
      render: (r) => `<span class="rounded bg-blue-50 px-2 py-0.5 font-mono text-xs text-blue-700">${escapeHtml(r.location)}</span>`,
    },
    {
      key: 'material',
      title: '面料信息',
      width: 240,
      sortable: true,
      sortValue: (r) => r.sku,
      render: (r) => `<div class="min-w-0"><div class="font-mono text-xs text-slate-700">${escapeHtml(r.sku)}</div><div class="truncate text-xs text-slate-500">${escapeHtml(r.materialName)}</div></div>`,
    },
    {
      key: 'receiveQty',
      title: '收货数量',
      width: 100,
      align: 'right',
      sortable: true,
      sortValue: (r) => r.receiveQty,
      render: (r) => `<span class="text-slate-600">${r.receiveQty}</span>`,
    },
    {
      key: 'putawayQty',
      title: '上架数量',
      width: 100,
      align: 'right',
      sortable: true,
      sortValue: (r) => r.putawayQty,
      render: (r) => `<span class="font-medium text-slate-700">${r.putawayQty}</span>`,
    },
    {
      key: 'status',
      title: '上架状态',
      width: 100,
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status] ?? ''}">${escapeHtml(r.status)}</span>`,
    },
    {
      key: 'time',
      title: '时间',
      width: 150,
      sortable: true,
      sortValue: (r) => r.time,
      render: (r) => `<span class="text-xs text-slate-400">${escapeHtml(r.time)}</span>`,
    },
    {
      key: 'actions',
      title: '操作',
      width: 220,
      required: true,
      actionColumn: true,
      render: (r) => {
        const idx = mahameruPutawaySeed.indexOf(r)
        const btn = (action: string, label: string) =>
          `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${eventPrefix}-action="${action}" data-${eventPrefix}-idx="${idx}">${label}</button>`
        const extra = r.status === '待上架' ? `<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-${eventPrefix}-action="row-putaway" data-${eventPrefix}-idx="${idx}">一键上架</button>` : ''
        return `<div class="flex items-center gap-1">${btn('view-detail', '查看明细')}${btn('row-log', '查看日志')}${extra}</div>`
      },
    },
  ]
}

export interface PutawayLikeOptions {
  eventPrefix: string
  preferenceKey: string
  title: string
  listTitle: string
  rows: TransitOnlinePutawayRow[]
  description?: string
}

/** 上架单 / 作业单同构页构建器：列结构与筛选一致，仅标题与数据视角不同。 */
export function createPutawayLikePage(options: PutawayLikeOptions) {
  const definition: TransitOnlineListDefinition<TransitOnlinePutawayRow> = {
    eventPrefix: options.eventPrefix,
    preferenceKey: options.preferenceKey,
    title: options.title,
    listTitle: options.listTitle,
    columns: buildPutawayColumns(options.eventPrefix),
    rows: options.rows,
    emptyText: '暂无上架单据',
    defaultFrozenKeys: ['selection', 'no'],
    detailTitle: `${options.listTitle}详情`,
    exportFileName: options.listTitle,
    description: options.description,
    searches: [
      { name: 'keyword', label: '综合查询', placeholder: '上架单号 / 收货单号 / 生产单号 / 入库单号 / 库位', wide: true },
      { name: 'sku', label: '商品 SKU', placeholder: '搜索商品 SKU' },
      { name: 'spu', label: '商品 SPU', placeholder: '搜索商品 SPU' },
    ],
    tabs: [
      { key: '全部', label: '全部' },
      { key: '待上架', label: '待上架' },
      { key: '上架完成', label: '上架完成' },
      { key: '已释放', label: '已释放' },
      { key: '已出库', label: '已出库' },
    ],
    stats: (rows) => [
      { label: '记录数', value: `${rows.length} 条` },
      { label: '待上架', value: `${rows.filter((r) => r.status === '待上架').length} 条` },
      { label: '上架完成', value: `${rows.filter((r) => r.status === '上架完成').length} 条` },
    ],
    matches: (row, query) => {
      if (query.tab && query.tab !== '全部' && row.status !== query.tab) return false
      const keyword = (query.searches.keyword ?? '').trim().toLowerCase()
      if (keyword) {
        const haystack = `${row.no} ${row.receiveNo} ${row.productionNo} ${row.inboundNo} ${row.location}`.toLowerCase()
        if (!haystack.includes(keyword)) return false
      }
      const sku = (query.searches.sku ?? '').trim().toLowerCase()
      if (sku && !row.sku.toLowerCase().includes(sku)) return false
      const spu = (query.searches.spu ?? '').trim().toLowerCase()
      if (spu && !row.spu.toLowerCase().includes(spu)) return false
      return true
    },
    onAction: (action, node, ctx) => {
      const idx = Number(node.dataset[`${options.eventPrefix.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())}Idx`])
      if (action === 'toggle-select') {
        if (selectedRows.has(idx)) selectedRows.delete(idx)
        else selectedRows.add(idx)
        return true
      }
      if (action === 'row-log') {
        const row = ctx.rows[idx]
        if (row) showListFeedback(`上架单 ${row.no} 操作日志：收货 → 上架`)
        return true
      }
      if (action === 'row-putaway') {
        const row = ctx.rows[idx]
        if (row) {
          row.status = '上架完成'
          row.putawayQty = row.receiveQty
          showListFeedback(`上架单 ${row.no} 已完成上架 ${row.putawayQty} 卷`)
        }
        return true
      }
      return false
    },
  }
  return createStandardListPage(definition)
}

const page = createPutawayLikePage({
  eventPrefix: 'wls-online-mahameru-putaway',
  preferenceKey: '/wls/online/mahameru-putaway:list-columns',
  title: '上架单管理',
  listTitle: '上架单列表',
  rows: mahameruPutawaySeed,
})

export function renderTransitOnlineMahameruPutawayPage(): string {
  return page.render()
}

export function handleTransitOnlineMahameruPutawayEvent(target: HTMLElement, event?: Event): boolean {
  return page.handle(target, event)
}
