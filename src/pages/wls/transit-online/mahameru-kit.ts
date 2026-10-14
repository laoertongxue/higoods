// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { createStandardListPage, type TransitOnlineListDefinition } from './list-factory.ts'
import { mahameruKitSeed, type TransitOnlineKitRow } from './seed.ts'
import type { StandardListColumn } from '../../../components/ui/list-table.ts'

const EVENT = 'wls-online-mahameru-kit'

// 勾选列选中行（group8 行52）。
const selectedRows = new Set<number>()

const columns: StandardListColumn<TransitOnlineKitRow>[] = [
  {
    key: 'selection',
    title: '勾选',
    width: 56,
    required: true,
    freezeable: true,
    render: (r) => `<input type="checkbox" class="h-4 w-4 rounded border-slate-300" ${selectedRows.has(mahameruKitSeed.indexOf(r)) ? 'checked' : ''} data-${EVENT}-action="toggle-select" data-${EVENT}-idx="${mahameruKitSeed.indexOf(r)}">`,
  },
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
    key: 'satisfied',
    title: '是否满足',
    width: 100,
    sortable: true,
    sortValue: (r) => r.satisfied,
    render: (r) => `<span class="rounded-full px-2 py-0.5 text-xs ${r.satisfied === '满足' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">${escapeHtml(r.satisfied)}</span>`,
  },
  { key: 'sku', title: 'SKU', width: 190, sortable: true, sortValue: (r) => r.sku, render: (r) => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  {
    key: 'materialName',
    title: '物料信息',
    width: 200,
    sortable: true,
    sortValue: (r) => r.materialName,
    render: (r) => `<div class="min-w-0"><div class="truncate text-xs text-slate-700">${escapeHtml(r.materialName)}</div><div class="truncate text-xs text-slate-400">${escapeHtml(r.spu)}</div></div>`,
  },
  { key: 'fabricType', title: '面料类型', width: 100, sortable: true, sortValue: (r) => r.fabricType, render: (r) => `<span class="text-xs text-slate-500">${escapeHtml(r.fabricType)}</span>` },
  { key: 'requiredQty', title: '原始需求', width: 90, align: 'right', sortable: true, sortValue: (r) => r.requiredQty, render: (r) => `<span class="text-slate-600">${r.requiredQty} 件</span>` },
  { key: 'workAreaQty', title: '作业区', width: 90, align: 'right', sortable: true, sortValue: (r) => r.workAreaQty, render: (r) => `<span class="text-slate-600">${r.workAreaQty} 件</span>` },
  { key: 'shelfQty', title: '货架可用', width: 100, align: 'right', sortable: true, sortValue: (r) => r.shelfQty, render: (r) => `<span class="text-slate-600">${r.shelfQty} 件</span>` },
  { key: 'totalQty', title: '合计可用', width: 100, align: 'right', sortable: true, sortValue: (r) => r.totalQty, render: (r) => `<span class="font-medium text-slate-700">${r.totalQty} 件</span>` },
  {
    key: 'shortageRate',
    title: '短缺比例',
    width: 100,
    align: 'right',
    sortable: true,
    sortValue: (r) => Number(r.shortageRate.replace('%', '')),
    render: (r) => `<span class="text-xs ${r.shortageRate === '0%' ? 'text-slate-400' : 'text-rose-600'}">${escapeHtml(r.shortageRate)}</span>`,
  },
  { key: 'location', title: '上架库位', width: 110, sortable: true, sortValue: (r) => r.location, render: (r) => `<span class="rounded bg-blue-50 px-2 py-0.5 font-mono text-xs text-blue-700">${escapeHtml(r.location)}</span>` },
  { key: 'updateTime', title: '更新时间', width: 150, sortable: true, sortValue: (r) => r.updateTime, render: (r) => `<span class="text-xs text-slate-400">${escapeHtml(r.updateTime)}</span>` },
]

const definition: TransitOnlineListDefinition<TransitOnlineKitRow> = {
  eventPrefix: EVENT,
  preferenceKey: '/wls/online/mahameru-kit:list-columns',
  title: '生产单校验',
  listTitle: '生产单校验列表',
  columns,
  rows: mahameruKitSeed,
  emptyText: '暂无待校验生产单',
  defaultFrozenKeys: ['selection', 'productionNo'],
  exportFileName: '生产单校验',
  primaryActionsHtml: () =>
    `<div class="flex flex-wrap items-center gap-2">${renderPrimaryButton('生成配料单', { prefix: EVENT, action: 'generate-allocation' }, 'list-plus')}${renderSecondaryButton('更新校验', { prefix: EVENT, action: 'refresh-check' }, 'refresh-cw')}${renderSecondaryButton('批量确认满足', { prefix: EVENT, action: 'batch-confirm' }, 'check-check')}${renderSecondaryButton('生产单合并处理', { prefix: EVENT, action: 'merge-production' }, 'git-merge')}</div>`,
  searches: [
    { name: 'productionNo', label: '生产单号', placeholder: '生产单号', wide: true },
    { name: 'sku', label: '商品 SKU', placeholder: '搜索 SKU' },
  ],
  tabs: [
    { key: '全部', label: '全部' },
    { key: '满足', label: '满足' },
    { key: '不满足', label: '不满足' },
  ],
  stats: (rows) => [
    { label: '记录数', value: `${rows.length} 条` },
    { label: '满足', value: `${rows.filter((r) => r.satisfied === '满足').length} 条` },
    { label: '不满足', value: `${rows.filter((r) => r.satisfied === '不满足').length} 条` },
  ],
  matches: (row, query) => {
    if (query.tab && query.tab !== '全部' && row.satisfied !== query.tab) return false
    const productionNo = (query.searches.productionNo ?? '').trim().toLowerCase()
    if (productionNo && !row.productionNo.toLowerCase().includes(productionNo)) return false
    const sku = (query.searches.sku ?? '').trim().toLowerCase()
    if (sku && !row.sku.toLowerCase().includes(sku)) return false
    return true
  },
  onAction: (action, node, ctx) => {
    if (action === 'toggle-select') {
      const idx = Number(node.dataset['wlsOnlineMahameruKitIdx'])
      if (selectedRows.has(idx)) selectedRows.delete(idx)
      else selectedRows.add(idx)
      return true
    }
    if (action === 'generate-allocation') {
      showListFeedback('已按当前不满足生产单生成配料单草稿')
      return true
    }
    if (action === 'refresh-check') {
      showListFeedback('已重新读取作业区与货架库存，校验结果已更新')
      return true
    }
    if (action === 'batch-confirm') {
      const targets = ctx.filtered().filter((row) => row.satisfied === '不满足')
      targets.forEach((row) => {
        row.satisfied = '满足'
        row.totalQty = row.requiredQty
        row.shortageRate = '0%'
      })
      showListFeedback(`已确认 ${targets.length} 条生产单满足配料`)
      return true
    }
    if (action === 'merge-production') {
      showListFeedback('生产单合并处理已提交，合并结果将在校验刷新后显示')
      return true
    }
    return false
  },
}

const page = createStandardListPage(definition)

export function renderTransitOnlineMahameruKitPage(): string {
  return page.render()
}

export function handleTransitOnlineMahameruKitEvent(target: HTMLElement, event?: Event): boolean {
  return page.handle(target, event)
}
