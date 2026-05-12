import {
  listPostFinishingWaitHandoverWarehouseRecords,
  listPostFinishingWaitProcessWarehouseRecords,
  type PostFinishingWaitHandoverWarehouseRecord,
  type PostFinishingWaitProcessWarehouseRecord,
  type PostFinishingWarehouseFlowRecord,
} from '../../../data/fcs/post-finishing-domain.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatGarmentQty,
  getPostListFilters,
  paginatePostRows,
  postFilterTextMatches,
  renderPostPagination,
  renderPostStatusBadge,
} from './shared.ts'

type Mode = 'wait-process' | 'wait-handover'
type TabKey = 'inventory' | 'flow' | 'locations'
type WarehouseRecord = PostFinishingWaitProcessWarehouseRecord | PostFinishingWaitHandoverWarehouseRecord

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'inventory', label: '库存' },
  { key: 'flow', label: '流水记录' },
  { key: 'locations', label: '库区库位' },
]

function basePath(mode: Mode): string {
  return mode === 'wait-process' ? '/fcs/craft/post-finishing/wait-process-warehouse' : '/fcs/craft/post-finishing/wait-handover-warehouse'
}

function title(mode: Mode): string {
  return mode === 'wait-process' ? '后道待加工仓' : '后道待交出仓'
}

function params(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function activeTab(): TabKey {
  const value = params().get('tab') as TabKey | null
  return value && TABS.some((tab) => tab.key === value) ? value : 'inventory'
}

function buildLink(mode: Mode, overrides: Record<string, string | number | undefined>): string {
  const next = params()
  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined || value === '' || value === '全部') next.delete(key)
    else next.set(key, String(value))
  })
  const query = next.toString()
  return `${basePath(mode)}${query ? `?${query}` : ''}`
}

function records(mode: Mode): WarehouseRecord[] {
  return mode === 'wait-process' ? listPostFinishingWaitProcessWarehouseRecords() : listPostFinishingWaitHandoverWarehouseRecords()
}

function qty(record: WarehouseRecord): number {
  return 'availableGarmentQty' in record
    ? record.availableGarmentQty
    : Math.max(record.waitHandoverGarmentQty - record.submittedHandoverGarmentQty, 0)
}

function location(record: WarehouseRecord, index: number, mode: Mode): string {
  const area = mode === 'wait-process' ? '待加工仓' : '待交出仓'
  return `${area} ${index % 2 === 0 ? 'A' : 'B'} 区 / PF-${mode === 'wait-process' ? 'P' : 'H'}-${String(index + 1).padStart(2, '0')}`
}

function filterRows(input: WarehouseRecord[], mode: Mode): WarehouseRecord[] {
  const filters = getPostListFilters()
  return input.filter((record) => {
    if (filters.status !== '全部' && record.status !== filters.status) return false
    if (filters.factory !== '全部' && record.managedPostFactoryName !== filters.factory) return false
    return postFilterTextMatches(filters.keyword, [record.warehouseRecordNo, record.postOrderNo, record.sourceProductionOrderNo, record.sourceTaskNo, record.managedPostFactoryName, record.spuCode, record.spuName, record.skuCode, record.colorName, record.sizeName, record.status, title(mode)])
  })
}

function renderHeader(mode: Mode): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-foreground">${escapeHtml(title(mode))}</h1>
      </div>
      ${mode === 'wait-process' ? '<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">扫码收货</button>' : ''}
    </header>
  `
}

function metric(label: string, value: string, helper = ''): string {
  return `
    <article class="rounded-lg border bg-card px-4 py-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-2 text-2xl font-semibold text-foreground">${escapeHtml(value)}</div>
      ${helper ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(helper)}</div>` : ''}
    </article>
  `
}

function renderMetrics(input: WarehouseRecord[], mode: Mode): string {
  const totalQty = input.reduce((sum, item) => sum + qty(item), 0)
  const activeCount = input.filter((item) => qty(item) > 0).length
  const flowCount = input.reduce((sum, item) => sum + item.flowRecords.length, 0)
  const locationCount = Math.min(Math.max(input.length, 1), 6)
  return `
    <section class="grid gap-3 md:grid-cols-4">
      ${metric(mode === 'wait-process' ? '待加工库存' : '待交出库存', formatGarmentQty(totalQty), '当前可用库存')}
      ${metric('库存项目', `${input.length} 条`, `${activeCount} 条有库存`)}
      ${metric('库区库位', `${locationCount} 个`, '支持查看流水')}
      ${metric('流水记录', `${flowCount} 条`, mode === 'wait-process' ? '收货 + 质检 + 后道' : '复检 + WMS')}
    </section>
  `
}

function renderTabs(mode: Mode, current: TabKey): string {
  return `
    <nav class="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
      ${TABS.map((tab) => `<button type="button" class="rounded px-3 py-1.5 text-sm ${tab.key === current ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}" data-nav="${escapeHtml(buildLink(mode, { tab: tab.key, page: 1 }))}">${escapeHtml(tab.label)}</button>`).join('')}
    </nav>
  `
}

function renderFilters(mode: Mode, input: WarehouseRecord[]): string {
  const filters = getPostListFilters()
  const statusOptions = ['全部', ...Array.from(new Set(input.map((item) => item.status))).filter(Boolean)]
  const factoryOptions = ['全部', ...Array.from(new Set(input.map((item) => item.managedPostFactoryName))).filter(Boolean)]
  return `
    <form class="rounded-lg border bg-card p-4" method="get" action="${escapeHtml(basePath(mode))}">
      <input type="hidden" name="tab" value="${escapeHtml(activeTab())}" />
      <input type="hidden" name="page" value="1" />
      <div class="grid gap-3 md:grid-cols-4">
        <label class="space-y-1 text-sm"><span class="text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" name="keyword" value="${escapeHtml(filters.keyword)}" placeholder="SKU / 生产单 / 单号" /></label>
        <label class="space-y-1 text-sm"><span class="text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border px-3 text-sm" name="status">${statusOptions.map((value) => `<option value="${escapeHtml(value)}" ${filters.status === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label>
        <label class="space-y-1 text-sm"><span class="text-xs text-muted-foreground">工厂</span><select class="h-9 w-full rounded-md border px-3 text-sm" name="factory">${factoryOptions.map((value) => `<option value="${escapeHtml(value)}" ${filters.factory === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label>
        <div class="flex items-end justify-end gap-2"><button type="button" class="h-9 rounded-md border px-3 text-sm" data-nav="${escapeHtml(basePath(mode))}">重置</button><button type="submit" class="h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white">查询</button></div>
      </div>
    </form>
  `
}

function table(headers: string[], rows: string, minWidth = 'min-w-[1180px]'): string {
  return `
    <div class="overflow-x-auto">
      <table class="${minWidth} w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs text-muted-foreground"><tr>${headers.map((header) => `<th class="px-3 py-2 font-medium">${escapeHtml(header)}</th>`).join('')}</tr></thead>
        <tbody>${rows || `<tr><td colspan="${headers.length}" class="px-3 py-8 text-center text-muted-foreground">暂无数据</td></tr>`}</tbody>
      </table>
    </div>
  `
}

function renderInventoryRows(input: WarehouseRecord[], mode: Mode): string {
  return input.map((record, index) => `
    <tr class="align-top">
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.skuCode)}</td>
      <td class="px-3 py-3 text-sm"><div class="font-medium">${escapeHtml(record.spuName)}</div><div class="text-xs text-muted-foreground">${escapeHtml(record.colorName)} / ${escapeHtml(record.sizeName)}</div></td>
      <td class="px-3 py-3 text-sm font-medium">${formatGarmentQty(qty(record), record.qtyUnit)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(location(record, index, mode))}</td>
      <td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td>
      <td class="px-3 py-3"><button type="button" class="rounded-md border px-2 py-1 text-xs" data-nav="${escapeHtml(buildLink(mode, { tab: 'flow', keyword: record.skuCode, page: 1 }))}">查看库存流水</button></td>
    </tr>
  `).join('')
}

function renderFlowRows(input: WarehouseRecord[]): string {
  return input.flatMap((record) => record.flowRecords.map((flow: PostFinishingWarehouseFlowRecord) => `
    <tr class="align-top">
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.skuCode)}</td>
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(flow.flowRecordNo)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(flow.flowType)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(flow.qty, flow.qtyUnit)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(flow.beforeQty, flow.qtyUnit)} -> ${formatGarmentQty(flow.afterQty, flow.qtyUnit)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(flow.operatedAt)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(flow.operatorName)}</td>
    </tr>
  `)).join('')
}

function renderLocationRows(input: WarehouseRecord[], mode: Mode): string {
  return input.map((record, index) => `
    <tr class="align-top">
      <td class="px-3 py-3 text-sm">${escapeHtml(location(record, index, mode))}</td>
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.skuCode)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.spuName)} / ${escapeHtml(record.colorName)} / ${escapeHtml(record.sizeName)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(qty(record), record.qtyUnit)}</td>
      <td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td>
    </tr>
  `).join('')
}

function renderSection(titleText: string, body: string): string {
  return `
    <section class="rounded-lg border bg-card">
      <header class="border-b px-4 py-3"><h2 class="text-sm font-semibold">${escapeHtml(titleText)}</h2></header>
      <div class="p-4">${body}</div>
    </section>
  `
}

function renderPage(mode: Mode): string {
  const all = records(mode)
  const filtered = filterRows(all, mode)
  const pagination = paginatePostRows(filtered, getPostListFilters())
  const tab = activeTab()
  const body = tab === 'flow'
    ? table(['SKU', '流水号', '类型', '数量', '前后库存', '操作时间', '操作人'], renderFlowRows(pagination.rows), 'min-w-[1120px]')
    : tab === 'locations'
      ? table(['库区库位', 'SKU', '款式/颜色/尺码', '当前库存', '状态'], renderLocationRows(pagination.rows, mode), 'min-w-[980px]')
      : table(['SKU', '款式名称 / 颜色', '当前库存', '库区库位', '状态', '操作'], renderInventoryRows(pagination.rows, mode), 'min-w-[1100px]')
  return `
    <div class="space-y-4 p-4">
      ${renderHeader(mode)}
      ${renderMetrics(all, mode)}
      ${renderTabs(mode, tab)}
      ${renderFilters(mode, all)}
      ${renderSection(tab === 'flow' ? '流水记录' : tab === 'locations' ? '库区库位' : '库存', `${body}<div class="mt-4">${renderPostPagination(pagination)}</div>`)}
    </div>
  `
}

export function renderPostFinishingWaitProcessWarehousePage(): string {
  return renderPage('wait-process')
}

export function renderPostFinishingWaitHandoverWarehousePage(): string {
  return renderPage('wait-handover')
}
