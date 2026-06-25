import {
  materialPrepStatusLabelMap,
  materialPrepWorkbenchTabs,
  classifyPrepLineType,
  escapeHtml,
  renderBadge,
  formatQty,
  type MaterialPrepOrderProjection,
  type MaterialPrepOrderStatus,
} from './shared.ts'

import {
  listMaterialPrepOrderProjections,
} from '../../../data/fcs/cutting/production-material-prep.ts'

import type { BadgeVariant } from '../../../components/ui/types.ts'

const statusVariantMap: Record<string, BadgeVariant> = {
  NEED_PREP_NO_STOCK: 'warning',
  NEED_PREP_PARTIAL_STOCK: 'info',
  NEED_PREP_ALL_STOCK: 'success',
  REJECTED_REWORK: 'danger',
  READY: 'success',
  CLOSED: 'neutral',
}

const legacyPrepStatusMap: Record<string, MaterialPrepOrderStatus> = {
  NEED_PREP: 'NEED_PREP_PARTIAL_STOCK',
  CONTINUE_PREP: 'NEED_PREP_PARTIAL_STOCK',
  SHORTAGE_TRACKING: 'NEED_PREP_NO_STOCK',
}

function normalizeMaterialPrepStatus(value: string | null | undefined): MaterialPrepOrderStatus {
  if (value && value in materialPrepStatusLabelMap) return value as MaterialPrepOrderStatus
  return legacyPrepStatusMap[value || ''] || 'NEED_PREP_NO_STOCK'
}

function getSearchParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

function buildHref(params: Record<string, string | undefined>): string {
  const search = getSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
    else search.delete(key)
  })
  const query = search.toString()
  return `/fcs/material-prep/list${query ? `?${query}` : ''}`
}

function getOrderCategory(row: MaterialPrepOrderProjection): string {
  if (!row.lines.length) return '其他配料'
  return classifyPrepLineType(row.lines[0])
}

const categoryDetailPathMap: Record<string, string> = {
  '染色配料': '/fcs/material-prep/dyeing/detail',
  '印花配料': '/fcs/material-prep/printing/detail',
  '裁片配料': '/fcs/material-prep/cutting/detail',
  '车缝配料': '/fcs/material-prep/sewing/detail',
  '其他配料': '/fcs/material-prep/other/detail',
}

function buildDetailHref(prepOrderId: string, category: string): string {
  const basePath = categoryDetailPathMap[category] || '/fcs/material-prep/cutting/detail'
  return `${basePath}?prepOrderId=${encodeURIComponent(prepOrderId)}`
}

function renderCategoryBadge(row: MaterialPrepOrderProjection): string {
  const category = getOrderCategory(row)
  const variant: BadgeVariant =
    category === '裁片配料' ? 'info' :
    category === '染色配料' ? 'warning' :
    category === '印花配料' ? 'success' :
    category === '车缝配料' ? 'neutral' :
    'neutral'
  return renderBadge(category, variant)
}

function renderStatusBadge(status: MaterialPrepOrderStatus): string {
  const label = materialPrepStatusLabelMap[status]
  const variant = statusVariantMap[status] || 'neutral'
  return renderBadge(label, variant)
}

function renderPrepProgress(row: MaterialPrepOrderProjection): string {
  const total = row.totalRequiredQty
  const confirmed = row.totalConfirmedPrepQty
  if (total <= 0) {
    return `<div class="text-xs text-muted-foreground">暂无需求</div>`
  }
  const pct = Math.min(Math.round((confirmed / total) * 100), 100)
  const barColor = pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-slate-200'
  return `
    <div class="space-y-1">
      <div class="flex items-center justify-between text-xs">
        <span>已配 ${formatQty(confirmed)} / ${formatQty(total)}</span>
        <span class="font-medium">${pct}%</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div class="h-full rounded-full ${barColor}" style="width:${pct}%"></div>
      </div>
    </div>
  `
}

function renderTabs(rows: MaterialPrepOrderProjection[], activeTab: MaterialPrepOrderStatus): string {
  return `
    <div class="flex flex-wrap gap-2">
      ${materialPrepWorkbenchTabs.map((tab) => {
        const count = rows.filter((row) => row.order.overallPrepStatus === tab.key).length
        const isActive = tab.key === activeTab
        return `
          <button type="button" data-nav="${escapeHtml(buildHref({ tab: tab.key }))}" class="rounded-md border px-3 py-2 text-sm ${isActive ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}">
            ${escapeHtml(tab.label)} <span class="ml-1 text-xs opacity-80">${count}</span>
          </button>
        `
      }).join('')}
    </div>
  `
}

function renderTable(rows: MaterialPrepOrderProjection[]): string {
  return `
    <div class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-base font-semibold">配料列表</h2>
        <span class="text-xs text-muted-foreground">共 ${rows.length} 条配料单</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[960px] text-left text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2">生产单号</th>
              <th class="px-3 py-2">款式名</th>
              <th class="px-3 py-2">配料类型</th>
              <th class="px-3 py-2">需求总量</th>
              <th class="px-3 py-2">配料进度</th>
              <th class="px-3 py-2">状态</th>
              <th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map((row) => {
              const category = getOrderCategory(row)
              return `
              <tr class="border-t hover:bg-muted/30">
                <td class="px-3 py-3">
                  <div class="font-medium">${escapeHtml(row.order.productionOrderNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">配料单：${escapeHtml(row.order.prepOrderNo)}</div>
                </td>
                <td class="px-3 py-3">
                  <div>${escapeHtml(row.order.styleNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.order.styleName)}</div>
                </td>
                <td class="px-3 py-3">${renderCategoryBadge(row)}</td>
                <td class="px-3 py-3">
                  <div class="font-medium">${formatQty(row.totalRequiredQty)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${row.lineCount} 行物料</div>
                </td>
                <td class="px-3 py-3 min-w-[200px]">${renderPrepProgress(row)}</td>
                <td class="px-3 py-3">${renderStatusBadge(row.order.overallPrepStatus)}</td>
                <td class="px-3 py-3">
                  <button type="button" data-fcs-material-prep-action="view-detail" data-prep-order-id="${escapeHtml(row.order.prepOrderId)}" data-prep-order-category="${escapeHtml(category)}" class="rounded-md border border-blue-200 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50">查看</button>
                </td>
              </tr>
              `
            }).join('') : `
              <tr>
                <td colspan="7" class="px-3 py-8 text-center text-sm text-muted-foreground">当前状态下暂无配料单。</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `
}

export function renderFcsMaterialPrepListPage(): string {
  const params = getSearchParams()
  const activeTab = normalizeMaterialPrepStatus(params.get('tab'))
  const keyword = (params.get('keyword') || '').trim().toLowerCase()
  const categoryFilter = (params.get('category') || '').trim()

  const allRows = listMaterialPrepOrderProjections()

  const keywordFiltered = keyword
    ? allRows.filter((row) =>
        row.order.productionOrderNo.toLowerCase().includes(keyword) ||
        row.order.styleNo.toLowerCase().includes(keyword) ||
        row.order.styleName.toLowerCase().includes(keyword) ||
        row.order.spu.toLowerCase().includes(keyword) ||
        row.lines.some((line) => line.materialName.toLowerCase().includes(keyword))
      )
    : allRows

  const categoryFiltered = categoryFilter
    ? keywordFiltered.filter((row) => getOrderCategory(row) === categoryFilter)
    : keywordFiltered

  const rows = categoryFiltered.filter((row) => row.order.overallPrepStatus === activeTab)

  return `
    <div class="space-y-5 p-6">
      <header>
        <div>
          <div class="text-sm text-muted-foreground">生产协同系统 / 配料管理</div>
          <h1 class="mt-1 text-2xl font-bold">配料列表</h1>
          <p class="mt-2 text-sm text-muted-foreground">综合看板，聚合展示所有配料单，按状态筛选，点击查看进入对应类型配料详情。</p>
        </div>
      </header>

      <section class="rounded-lg border bg-card p-4">
        <div class="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_180px_auto] md:items-end">
          <label class="space-y-1">
            <span class="text-sm font-medium">关键词搜索</span>
            <input class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-fcs-material-prep-action="search-input" data-search-field="keyword" data-skip-page-rerender="true" placeholder="生产单号 / 款式 / SPU / 物料名称" />
          </label>
          <label class="space-y-1">
            <span class="text-sm font-medium">配料类型</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-fcs-material-prep-action="search-select" data-search-field="category">
              <option value="">全部类型</option>
              <option value="染色配料">染色配料</option>
              <option value="印花配料">印花配料</option>
              <option value="裁片配料">裁片配料</option>
              <option value="车缝配料">车缝配料</option>
              <option value="其他配料">其他配料</option>
            </select>
          </label>
          <label class="space-y-1">
            <span class="text-sm font-medium">配料单状态</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-fcs-material-prep-action="search-select" data-search-field="status">
              <option value="">全部状态</option>
              <option value="NEED_PREP_NO_STOCK">待配料 - 无库存</option>
              <option value="NEED_PREP_PARTIAL_STOCK">待配料 - 部分有库存</option>
              <option value="NEED_PREP_ALL_STOCK">待配料 - 库存充足</option>
              <option value="REJECTED_REWORK">被打回重配</option>
              <option value="READY">已配齐</option>
              <option value="CLOSED">已关闭</option>
            </select>
          </label>
          <button class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-fcs-material-prep-action="search-apply">查询</button>
        </div>
      </section>

      ${renderTabs(categoryFiltered, activeTab)}
      ${renderTable(rows)}
    </div>
  `
}

export function handleFcsMaterialPrepListEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-fcs-material-prep-action]')
  const action = actionNode?.dataset.fcsMaterialPrepAction
  if (!actionNode || !action) return false

  if (action === 'view-detail') {
    const prepOrderId = actionNode.dataset.prepOrderId || ''
    const category = actionNode.dataset.prepOrderCategory || ''
    if (!prepOrderId) return false
    const href = buildDetailHref(prepOrderId, category)
    window.history.pushState({}, '', href)
    window.dispatchEvent(new PopStateEvent('popstate'))
    return true
  }

  if (action === 'search-apply') {
    const keyword = (document.querySelector('[data-search-field="keyword"]') as HTMLInputElement)?.value || ''
    const category = (document.querySelector('[data-search-field="category"]') as HTMLSelectElement)?.value || ''
    const status = (document.querySelector('[data-search-field="status"]') as HTMLSelectElement)?.value || ''
    window.history.pushState({}, '', buildHref({ keyword: keyword || undefined, category: category || undefined, tab: status || undefined }))
    window.dispatchEvent(new PopStateEvent('popstate'))
    return true
  }

  return false
}
