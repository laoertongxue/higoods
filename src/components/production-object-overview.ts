import { escapeHtml } from '../utils'
import {
  getMaterialResourceOverview,
  getProductionObjectOverview,
  materialTypeLabel,
  productionObjectSearchIndex,
  purchaseArrivalStatusLabel,
  queryProductionObjectIssues,
  resolveProductionObjectRequest,
  searchMaterialResources,
  searchProductionObjects,
  warehouseExecutionStatusLabel,
  type MaterialResourceContext,
  type MaterialResourceOverview,
  type ProductionMaterialLine,
  type ProductionObjectClickedRef,
  type ProductionObjectMultipleMatchesResult,
  type ProductionObjectOverview,
  type ProductionObjectSearchIndex,
  type ProductionObjectUnlinkedResult,
  type ProductionObjectType,
} from '../data/fcs/production-object-overview.ts'
import { renderProductionObjectCodeButton } from '../data/fcs/production-order-identity.ts'

type OverviewTab =
  | 'overview'
  | 'materials'
  | 'progress'
  | 'quantity'
  | 'documents'
  | 'issues'
  | 'relationship'
  | 'timeline'
  | 'material-flow'
  | 'responsibility'
  | 'cross-query'
  | 'relationship-history'

const TAB_ITEMS: Array<{ key: OverviewTab; label: string }> = [
  { key: 'overview', label: '总览' },
  { key: 'materials', label: '面辅料与仓储' },
  { key: 'progress', label: '工艺与任务' },
  { key: 'quantity', label: '数量' },
  { key: 'issues', label: '异常与责任' },
  { key: 'relationship-history', label: '关系与历史' },
]

const OBJECT_TYPE_LABEL: Record<ProductionObjectType, string> = {
  PRODUCTION_ORDER: '生产单',
  DEMAND: '生产需求',
  MATERIAL: '面辅料',
  WAREHOUSE_DOC: '仓库执行单',
  PROCESS_DOC: '工艺单据',
  MATERIAL_PREP_ORDER: '配料单',
  MATERIAL_PREP_RECORD: '配料记录',
  MATERIAL_PICKUP_RECORD: '发料/领料记录',
  CUT_ORDER: '裁片单',
  FEI_TICKET: '菲票',
  SPREADING_ORDER: '铺布单',
  PRINT_WORK_ORDER: '印花工单',
  DYE_WORK_ORDER: '染色工单',
  HANDOVER_ORDER: '交出单',
  QC_MASTER_ORDER: '质检总单',
  QC_ORDER: '质检单',
  RECHECK_ORDER: '复检单',
  FINISHED_INBOUND_ORDER: '成品入库单',
  PURCHASE_ORDER: '采购单',
}

type MaterialResourceTab = 'supply-demand' | 'allocations' | 'inventory' | 'execution' | 'issues-master'

const MATERIAL_RESOURCE_TAB_ITEMS: Array<{ key: MaterialResourceTab; label: string }> = [
  { key: 'supply-demand', label: '供需总览' },
  { key: 'allocations', label: '业务占用' },
  { key: 'inventory', label: '库存与在途' },
  { key: 'execution', label: '配料 / 领料 / 发料' },
  { key: 'issues-master', label: '异常与档案' },
]

let activeTab: OverviewTab = 'overview'
let activeMaterialResourceTab: MaterialResourceTab = 'supply-demand'
let searchKeyword = ''

function canShowProductionObjectEntry(pathname: string): boolean {
  if (pathname.startsWith('/fcs/print/')) return false
  if (pathname.startsWith('/fcs/task-print/')) return false
  if (pathname.includes('confirmation-print')) return false
  return (
    pathname.startsWith('/fcs')
    || pathname.startsWith('/pcs')
    || pathname.startsWith('/pms')
    || pathname.startsWith('/wls')
  )
}

export function renderProductionObjectFloatingEntry(pathname: string): string {
  if (!canShowProductionObjectEntry(pathname)) return ''

  return `
    <button
      type="button"
      class="production-object-floating-entry group"
      data-production-object-action="toggle-search"
      data-skip-page-rerender="true"
      aria-label="查生产"
    >
      <i data-lucide="search" class="h-5 w-5"></i>
      <span class="production-object-floating-entry__label">查生产</span>
    </button>
    <div data-production-object-overlay-root="true"></div>
  `
}

function statusClass(text: string): string {
  if (text.includes('暂不能') || text.includes('未到仓') || text.includes('差异')) return 'border-red-200 bg-red-50 text-red-700'
  if (text.includes('确认') || text.includes('待')) return 'border-amber-200 bg-amber-50 text-amber-700'
  if (text.includes('可以') || text.includes('已')) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function badge(text: string, className = statusClass(text)): string {
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(text)}</span>`
}

function getPrimaryObjectRef(overview: ProductionObjectOverview): { objectType: ProductionObjectType; objectId: string } {
  if (overview.summary.productionOrderNo && overview.summary.productionOrderNo !== '尚未生成') {
    return { objectType: 'PRODUCTION_ORDER', objectId: overview.summary.productionOrderNo }
  }
  return { objectType: 'DEMAND', objectId: overview.summary.demandNo }
}

function renderOverviewCode(
  objectType: ProductionObjectType,
  objectId: string,
  label: string,
  className = 'font-mono text-blue-600 hover:underline',
): string {
  return renderProductionObjectCodeButton({ objectType, objectId, label, className })
}

function makeHighlightKeyFromText(text: string): string {
  return text.trim().replace(/\s+/g, '-') || 'quantity'
}

function formatQty(value: number | undefined, unit: string): string {
  return `${Number(value || 0).toLocaleString('zh-CN')}${unit}`
}

function renderSearchEmpty(keyword: string): string {
  if (!keyword) return '<div class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">输入生产单、需求单、SPU、SKU、面料 / 辅料 / 纱线、配料单 / 领料单 / 发料单、裁片单、菲票、印花工单或染色工单，快速查看生产全貌。</div>'
  if (keyword.trim().length < 2) return '<div class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">请至少输入 2 个字符。</div>'
  return '<div class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">没有找到匹配对象。请确认编号是否完整，或换用 SPU / SKU / 生产单号搜索。</div>'
}

function isSearchRiskItem(item: ProductionObjectSearchIndex): boolean {
  if (item.objectType === 'MATERIAL_PREP_RECORD' || item.objectType === 'MATERIAL_PICKUP_RECORD') return false
  const text = `${item.statusText || ''} ${item.displayTitle}`
  return ['待', '未', '缺', '差异', '部分', '确认', '加工中', '回仓'].some((value) => text.includes(value))
}

function getSearchBlockerText(item: ProductionObjectSearchIndex): string {
  const matchedText = item.matchedReason?.replace(/^命中：/, '') || ''
  if (['缺料', '未到仓', '待领料', '待确认', '差异'].some((value) => matchedText.includes(value))) return matchedText
  if (isSearchRiskItem(item)) return item.statusText || '需要确认'
  return '无明显卡点'
}

function takeSearchGroup(
  rows: ProductionObjectSearchIndex[],
  used: Set<string>,
  predicate: (item: ProductionObjectSearchIndex, index: number) => boolean,
  limit: number,
): ProductionObjectSearchIndex[] {
  const group: ProductionObjectSearchIndex[] = []
  rows.forEach((item, index) => {
    if (group.length >= limit || used.has(item.id) || !predicate(item, index)) return
    used.add(item.id)
    group.push(item)
  })
  return group
}

function groupSearchResults(rows: ProductionObjectSearchIndex[]): Array<{ title: string; rows: ProductionObjectSearchIndex[] }> {
  const used = new Set<string>()
  const best = takeSearchGroup(rows, used, (_item, index) => index === 0, 1)
  const risk = takeSearchGroup(rows, used, isSearchRiskItem, 6)
  const main = takeSearchGroup(rows, used, (item) => item.objectType === 'PRODUCTION_ORDER' || item.objectType === 'DEMAND', 6)
  const execution = takeSearchGroup(rows, used, () => true, 9)

  return [
    { title: '最佳匹配', rows: best },
    { title: '当前卡点', rows: risk },
    { title: '生产主线', rows: main },
    { title: '关联执行', rows: execution },
  ].filter((group) => group.rows.length > 0)
}

function withRelatedMainlineRows(rows: ProductionObjectSearchIndex[]): ProductionObjectSearchIndex[] {
  const ids = new Set(rows.map((item) => item.id))
  const relatedOrderNos = uniqueSearchTexts(rows.map((item) => item.relatedProductionOrderNo).filter(Boolean) as string[])
  const mainlineRows = productionObjectSearchIndex
    .filter((item) =>
      (item.objectType === 'PRODUCTION_ORDER' || item.objectType === 'DEMAND') &&
      !ids.has(item.id) &&
      relatedOrderNos.some((orderNo) => item.primaryNo === orderNo || item.relatedProductionOrderNo === orderNo),
    )
    .map((item) => ({ ...item, matchedReason: '关联生产对象' }))
  return [...rows, ...mainlineRows]
}

function uniqueSearchTexts(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function isExplicitBusinessObjectSearch(keyword: string, rows: ProductionObjectSearchIndex[]): boolean {
  const query = keyword.trim()
  if (!query) return false
  const normalizedQuery = query.toUpperCase()
  return rows.some((item) =>
    item.objectType !== 'MATERIAL' &&
    [item.id, item.primaryNo, item.secondaryNo]
      .filter(Boolean)
      .some((value) => String(value).toUpperCase() === normalizedQuery),
  )
}

function shouldUseMaterialResourceSearch(keyword: string, rows: ProductionObjectSearchIndex[], materialResources: MaterialResourceOverview[]): boolean {
  const query = keyword.trim()
  if (!query) return false
  if (['缺料', '待领料', '未到仓'].some((word) => query.includes(word))) return materialResources.length > 0
  if (materialResources.length === 0) return false
  return !isExplicitBusinessObjectSearch(query, rows)
}

function renderMaterialSearchResultCard(resource: MaterialResourceOverview): string {
  const summary = resource.supplyDemandSummary
  return `
    <article class="rounded-lg border bg-card p-3 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            ${badge('物料资源', 'border-blue-200 bg-blue-50 text-blue-700')}
            ${badge(materialTypeLabel[resource.materialType], 'border-slate-200 bg-slate-50 text-slate-700')}
          </div>
          <div class="mt-2 break-all font-mono text-sm font-semibold text-foreground">${escapeHtml(resource.materialSku)}</div>
          <div class="mt-1 truncate text-sm text-foreground">${escapeHtml(resource.materialName)}</div>
          <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div><span class="text-foreground">当前判断：</span>${escapeHtml(resource.currentJudgement)}</div>
            <div><span class="text-foreground">总需求：</span>${formatMaterialResourceQty(summary.totalRequiredQty, summary.unit)}</div>
            <div><span class="text-foreground">可用库存：</span>${formatMaterialResourceQty(summary.availableQty, summary.unit)}</div>
            <div><span class="text-foreground">在途采购：</span>${formatMaterialResourceQty(summary.inTransitQty, summary.unit)}</div>
            <div><span class="text-foreground">缺口：</span>${formatMaterialResourceQty(summary.shortageQty, summary.unit)}</div>
            <div><span class="text-foreground">影响范围：</span>${resource.businessAllocations.length} 张生产单</div>
          </div>
        </div>
        <div class="flex shrink-0 flex-col gap-2 text-right">
          <button type="button" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700" data-production-object-action="open-material-resource" data-material-sku="${escapeHtml(resource.materialSku)}" data-skip-page-rerender="true">查看物料资源</button>
          <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-production-object-action="copy-no" data-copy-text="${escapeHtml(resource.materialSku)}" data-skip-page-rerender="true">复制编码</button>
        </div>
      </div>
    </article>
  `
}

function renderSearchResultCard(item: ProductionObjectSearchIndex): string {
  const isMaterial = item.objectType === 'MATERIAL'
  const primaryAction = isMaterial
    ? `<button type="button" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700" data-production-object-action="open-material-resource" data-material-sku="${escapeHtml(item.primaryNo)}" data-skip-page-rerender="true">查看物料资源</button>`
    : `<button type="button" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700" data-production-object-action="open" data-object-type="${item.objectType}" data-object-id="${escapeHtml(item.id)}" data-skip-page-rerender="true">查看总览</button>`
  return `
    <article class="rounded-lg border bg-card p-3 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            ${badge(OBJECT_TYPE_LABEL[item.objectType], 'border-blue-200 bg-blue-50 text-blue-700')}
            ${item.statusText ? badge(item.statusText) : ''}
          </div>
          <div class="mt-2 font-mono text-sm font-semibold text-foreground">${escapeHtml(item.primaryNo)}</div>
          <div class="mt-1 truncate text-sm text-foreground">${escapeHtml(item.displayTitle)}</div>
          <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div><span class="text-foreground">关联生产对象：</span>${escapeHtml(item.relatedProductionOrderNo || item.secondaryNo || '-')}</div>
            <div><span class="text-foreground">当前状态：</span>${escapeHtml(item.statusText || '待确认')}</div>
            <div><span class="text-foreground">当前卡点：</span>${escapeHtml(getSearchBlockerText(item))}</div>
            <div><span class="text-foreground">责任方：</span>${escapeHtml(item.ownerRole || '待确认')}</div>
            <div><span class="text-foreground">最近更新：</span>${escapeHtml(item.updatedAt || '-')}</div>
            <div><span class="text-foreground">命中：</span>${escapeHtml(item.matchedReason || '对象索引')}</div>
          </div>
        </div>
        <div class="flex shrink-0 flex-col gap-2 text-right">
          ${primaryAction}
          <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-production-object-action="copy-no" data-copy-text="${escapeHtml(item.primaryNo)}" data-skip-page-rerender="true">${isMaterial ? '复制编码' : '复制编号'}</button>
          ${item.routePath ? `<button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-production-object-action="go-source" data-route-path="${escapeHtml(item.routePath)}" data-skip-page-rerender="true">查看来源</button>` : ''}
        </div>
      </div>
    </article>
  `
}

function renderMaterialGroupedSearchResults(keyword: string, materialResources: MaterialResourceOverview[], rows: ProductionObjectSearchIndex[]): string {
  const used = new Set<string>()
  const takeRows = (predicate: (item: ProductionObjectSearchIndex) => boolean): ProductionObjectSearchIndex[] => {
    const group: ProductionObjectSearchIndex[] = []
    for (const item of rows) {
      const key = `${item.objectType}:${item.id}`
      if (group.length >= 6 || used.has(key) || !predicate(item)) continue
      used.add(key)
      group.push(item)
    }
    return group
  }
  const materialRows = materialResources.slice(0, 6)
  const relatedMain = takeRows((item) => item.objectType === 'PRODUCTION_ORDER' || item.objectType === 'DEMAND')
  const warehouse = takeRows((item) => item.objectType === 'WAREHOUSE_DOC' || item.objectType === 'MATERIAL_PREP_ORDER' || item.objectType === 'MATERIAL_PREP_RECORD' || item.objectType === 'MATERIAL_PICKUP_RECORD')
  const risks = takeRows(isSearchRiskItem)
  const groups = [
    { title: '物料资源', rowsHtml: materialRows.map(renderMaterialSearchResultCard).join(''), count: materialRows.length },
    { title: '相关生产对象', rowsHtml: relatedMain.map(renderSearchResultCard).join(''), count: relatedMain.length },
    { title: '相关采购与仓储', rowsHtml: warehouse.map(renderSearchResultCard).join(''), count: warehouse.length },
    { title: '异常线索', rowsHtml: risks.map(renderSearchResultCard).join(''), count: risks.length },
  ].filter((group) => group.count > 0)

  if (groups.length === 0) return renderSearchEmpty(keyword)
  return `
    <div class="space-y-4">
      ${groups.map((group) => `
        <section class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold">${escapeHtml(group.title)}</h3>
            <span class="text-xs text-muted-foreground">${group.count} 个对象</span>
          </div>
          ${group.rowsHtml}
        </section>
      `).join('')}
    </div>
  `
}

function renderSearchResults(keyword: string): string {
  const rows = withRelatedMainlineRows(searchProductionObjects(keyword))
  const candidateMaterialResources = keyword.trim() ? searchMaterialResources(keyword) : []
  const materialResources = shouldUseMaterialResourceSearch(keyword, rows, candidateMaterialResources) ? candidateMaterialResources : []
  if (materialResources.length > 0) return renderMaterialGroupedSearchResults(keyword, materialResources, rows)
  if (rows.length === 0) return renderSearchEmpty(keyword)
  const groups = groupSearchResults(rows)
  return `
    <div class="space-y-4">
      ${groups.map((group) => `
        <section class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold">${escapeHtml(group.title)}</h3>
            <span class="text-xs text-muted-foreground">${group.rows.length} 个对象</span>
          </div>
          ${group.rows.map(renderSearchResultCard).join('')}
        </section>
      `).join('')}
    </div>
  `
}

export function renderProductionObjectSearchPanel(keyword = searchKeyword): string {
  const escapedKeyword = escapeHtml(keyword)
  return `
    <div class="production-object-search-panel" data-production-object-surface="search">
      <button class="absolute inset-0 bg-slate-950/30" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭"></button>
      <section class="production-object-search-panel__body">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 class="text-base font-semibold">生产全局搜索</h2>
            <p class="mt-1 text-xs text-muted-foreground">小提示：支持生产单、生产需求、SPU、SKU、面料 / 辅料 / 纱线、配料单 / 领料单 / 发料单、裁片单、菲票、印花工单、染色工单</p>
          </div>
          <button class="h-8 w-8 rounded-md text-lg text-muted-foreground hover:bg-muted" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭">×</button>
        </header>
        <div class="production-object-search-panel__content space-y-3 p-4">
          <div class="relative">
            <input
              class="h-10 w-full rounded-md border bg-background px-3 pr-10 text-sm outline-none focus:border-blue-500"
              placeholder="输入生产单 / 需求单 / SPU / SKU / 物料SKU / 配料单 / 领料单 / 发料单 / 裁片单 / 菲票 / 印花工单 / 染色工单"
              value="${escapedKeyword}"
              data-production-object-action="search"
              data-skip-page-rerender="true"
              autofocus
            />
            ${
              keyword
                ? '<button class="absolute right-2 top-1.5 h-7 w-7 rounded-md text-muted-foreground hover:bg-muted" data-production-object-action="clear-search" data-skip-page-rerender="true" aria-label="清空">×</button>'
                : ''
            }
          </div>
          <div data-production-object-search-results="true">
            ${renderSearchResults(keyword)}
          </div>
        </div>
      </section>
    </div>
  `
}

export function renderOverviewHeader(overview: ProductionObjectOverview): string {
  const { summary, continueDecision } = overview
  const primaryRef = getPrimaryObjectRef(overview)
  return `
    <header class="production-object-overview__header">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-base font-semibold">生产对象总览</h2>
            ${badge(OBJECT_TYPE_LABEL[overview.objectType], 'border-blue-200 bg-blue-50 text-blue-700')}
          </div>
          <p class="mt-1 break-all text-xs text-muted-foreground">
            ${
              summary.productionOrderNo === '尚未生成'
                ? escapeHtml(summary.productionOrderNo)
                : renderOverviewCode('PRODUCTION_ORDER', summary.productionOrderNo, summary.productionOrderNo, 'font-mono text-blue-600 hover:underline')
            }｜${renderOverviewCode('DEMAND', summary.demandNo, summary.demandNo, 'font-mono text-blue-600 hover:underline')}｜SPU: ${renderOverviewCode(primaryRef.objectType, primaryRef.objectId, summary.spu, 'font-mono text-blue-600 hover:underline')}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-production-object-action="copy-no" data-copy-text="${escapeHtml(summary.productionOrderNo)}" data-skip-page-rerender="true">复制编号</button>
          <button class="h-8 w-8 rounded-md text-lg text-muted-foreground hover:bg-muted" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭">×</button>
        </div>
      </div>
      <div class="mt-3 rounded-lg border bg-muted/30 p-3">
        <div class="mb-2 text-xs font-semibold text-muted-foreground">当前判断</div>
        <div class="flex flex-wrap items-center gap-2">
          ${badge(continueDecision.displayText)}
          <span class="text-sm font-medium text-foreground">${escapeHtml(continueDecision.reasonText)}</span>
        </div>
        <div class="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <div><span class="text-foreground">下一步：</span>${escapeHtml(continueDecision.nextActionText)}</div>
          <div><span class="text-foreground">当前责任方：</span>${escapeHtml(continueDecision.ownerName || continueDecision.ownerRole)}</div>
          <div><span class="text-foreground">最近更新：</span>${escapeHtml(continueDecision.updatedAt)}</div>
        </div>
      </div>
    </header>
  `
}

function renderClickedObjectSummary(ref: ProductionObjectClickedRef | null, relatedProductionOrderNo?: string | null): string {
  if (!ref) return ''
  return `
    <section
      class="border-b bg-blue-50/60 px-4 py-3 text-sm"
      data-production-object-clicked-ref="true"
      data-production-object-highlight-key="${escapeHtml(ref.highlightKey)}"
    >
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-medium">当前查看</span>
        <span class="rounded border border-blue-200 bg-white px-2 py-0.5">${escapeHtml(OBJECT_TYPE_LABEL[ref.objectType] || ref.objectType)}</span>
        <span class="font-mono text-blue-700">${escapeHtml(ref.objectNo)}</span>
        ${relatedProductionOrderNo ? `<span class="text-muted-foreground">关联生产单：${escapeHtml(relatedProductionOrderNo)}</span>` : ''}
        <span class="text-muted-foreground">来源系统：${escapeHtml(ref.sourceDomain)}</span>
        <span class="text-muted-foreground">状态：${escapeHtml(ref.statusText)}</span>
        <span class="text-muted-foreground">单据关系：已关联</span>
      </div>
    </section>
  `
}

function renderTabs(
  overview: ProductionObjectOverview,
  tab: OverviewTab,
  request: { objectType: ProductionObjectType; objectId: string; relatedProductionOrderNo?: string | null } = {
    objectType: overview.objectType,
    objectId: overview.objectKey,
  },
): string {
  const hasMaterialIssue = overview.materials.some((line) => line.shortageQty > 0)
  const hasProgressIssue = overview.progressNodes.some((node) => node.status.includes('待') || node.status.includes('不能'))
  const hasIssue = overview.issues.length > 0

  return `
    <nav class="flex shrink-0 gap-1 overflow-x-auto border-b bg-card px-4">
      ${TAB_ITEMS.map((item) => {
        const active = item.key === tab
        const showDot = (item.key === 'materials' && hasMaterialIssue) || (item.key === 'progress' && hasProgressIssue) || (item.key === 'issues' && hasIssue)
        return `
          <button
            class="relative h-10 shrink-0 px-3 text-sm font-medium ${active ? 'text-blue-600' : 'text-muted-foreground hover:text-foreground'}"
            data-production-object-action="switch-tab"
            data-tab="${item.key}"
            data-object-type="${request.objectType}"
            data-object-id="${escapeHtml(request.objectId)}"
            ${request.relatedProductionOrderNo ? `data-related-production-order-no="${escapeHtml(request.relatedProductionOrderNo)}"` : ''}
            data-skip-page-rerender="true"
          >
            ${escapeHtml(item.label)}${showDot ? '<span class="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle"></span>' : ''}
            ${active ? '<span class="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-blue-600"></span>' : ''}
          </button>
        `
      }).join('')}
    </nav>
  `
}

function renderSummaryTab(overview: ProductionObjectOverview): string {
  const { summary } = overview
  const primaryRef = getPrimaryObjectRef(overview)
  return `
    <div class="space-y-4">
      <section class="grid gap-3 md:grid-cols-[88px_1fr]">
        <div class="h-24 w-20 overflow-hidden rounded-md border bg-muted">
          ${summary.imageUrl ? `<img src="${escapeHtml(summary.imageUrl)}" class="h-full w-full object-cover" alt="${escapeHtml(summary.productTitle)}" />` : '<div class="flex h-full items-center justify-center text-xs text-muted-foreground">商品图</div>'}
        </div>
        <div>
          <h3 class="text-sm font-semibold">对象身份</h3>
          <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            ${renderInfoItem('商品', summary.productTitle)}
            ${renderInfoItemHtml('SPU', renderOverviewCode(primaryRef.objectType, primaryRef.objectId, summary.spu))}
            ${renderInfoItem('SKU 数量', summary.skuSummary)}
            ${renderInfoItemHtml('生产需求单', renderOverviewCode('DEMAND', summary.demandNo, summary.demandNo))}
            ${renderInfoItemHtml(
              '生产单',
              summary.productionOrderNo === '尚未生成'
                ? escapeHtml(summary.productionOrderNo)
                : renderOverviewCode('PRODUCTION_ORDER', summary.productionOrderNo, summary.productionOrderNo),
            )}
            ${renderInfoItem('计划数量', `${summary.planQuantity.toLocaleString('zh-CN')} ${summary.unit}`)}
            ${renderInfoItem('交期', summary.plannedDeliveryDate)}
            ${renderInfoItem('当前阶段', summary.currentStage)}
            ${renderInfoItem('主工厂', summary.mainFactoryName)}
            ${renderInfoItem('交付仓', summary.deliveryWarehouse)}
            ${renderInfoItem('跟单员', summary.merchandiser)}
          </div>
        </div>
      </section>
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-sm font-semibold">当前生产流程</h3>
        <div class="mt-4 grid gap-2 xl:grid-cols-8">
          ${['需求接收', '生产单生成', '面辅料准备', '裁片', '印花/染色', '车缝', '后道', '入库'].map((name, index) => `
            <div class="rounded-lg border bg-muted/20 p-3">
              <div class="text-xs text-muted-foreground">第 ${index + 1} 步</div>
              <div class="mt-1 text-sm font-medium">${escapeHtml(name)}</div>
              <div class="mt-2">${index <= 1 ? badge('已完成') : index === 2 ? badge(overview.continueDecision.displayText) : badge('待处理')}</div>
            </div>
          `).join('')}
        </div>
      </section>
      ${renderExecutionOverview(overview)}
      ${renderKeyEvidence(overview)}
      ${renderEvidenceDetails(overview)}
    </div>
  `
}

function renderKeyEvidence(overview: ProductionObjectOverview): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">关键证据</h3>
        <span class="text-xs text-muted-foreground">${overview.decisionFacts.length} 条依据</span>
      </div>
      <div class="mt-3 space-y-2">
        ${overview.decisionFacts.slice(0, 5).map((fact) => `
          <article class="rounded-md border bg-muted/20 p-3 text-sm">
            <div class="font-medium">${escapeHtml(fact.evidenceText)}</div>
            <div class="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              <div><span class="text-foreground">来源：</span>${renderOverviewCode('MATERIAL', fact.sourceObjectNo, fact.sourceObjectNo)}</div>
              <div><span class="text-foreground">责任方：</span>${escapeHtml(fact.ownerRole)}</div>
              <div><span class="text-foreground">下一步：</span>${escapeHtml(fact.nextActionText)}</div>
            </div>
          </article>
        `).join('') || '<div class="rounded-md border border-dashed p-3 text-sm text-muted-foreground">暂无关键证据。</div>'}
      </div>
    </section>
  `
}

function renderEvidenceDetails(overview: ProductionObjectOverview): string {
  return `
    <details class="rounded-lg border bg-card p-4">
      <summary class="cursor-pointer text-sm font-semibold">数据来源 / 事实口径 / 数据冲突</summary>
      <div class="mt-4 space-y-4">
        <section>
          <h3 class="text-sm font-semibold">数据来源</h3>
          <div class="mt-3 grid gap-2 sm:grid-cols-2">
            ${overview.sourceSnapshots.map((source) => `
              <div class="rounded-md border bg-muted/20 p-3 text-sm">
                <div class="font-medium">${escapeHtml(source.sourceName)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(source.sourceText)}｜${escapeHtml(source.updatedAt)}</div>
              </div>
            `).join('')}
          </div>
        </section>
        <section>
          <h3 class="text-sm font-semibold">事实口径</h3>
          <div class="mt-3 grid gap-2 md:grid-cols-2">
            ${overview.factSources.map((fact) => `
              <article class="rounded-md border bg-muted/20 p-3 text-sm">
                <div class="flex flex-wrap items-center gap-2">
                  ${badge(fact.factType, 'border-slate-200 bg-slate-50 text-slate-700')}
                  ${badge(fact.statusText)}
                </div>
                <div class="mt-2 font-medium">${renderOverviewCode(fact.sourceDomain === 'PFOS' ? 'PROCESS_DOC' : fact.sourceDomain === 'WMS' ? 'WAREHOUSE_DOC' : 'MATERIAL', fact.sourceObjectNo, fact.sourceObjectNo)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(fact.sourceDomain)}｜${escapeHtml(fact.quantityText)}｜${escapeHtml(fact.updatedAt)}</div>
                <div class="mt-2 text-xs text-muted-foreground">责任方：${escapeHtml(fact.ownerRole)}｜下一步：${escapeHtml(fact.nextActionText)}</div>
              </article>
            `).join('')}
          </div>
        </section>
        <section>
          <h3 class="text-sm font-semibold">数据冲突</h3>
          <div class="mt-3 space-y-2">
            ${overview.dataConflicts.map((conflict) => `
              <article class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                <div class="font-medium text-amber-800">${escapeHtml(conflict.displayText)}</div>
                <div class="mt-1 text-xs text-amber-700">依据对象：${renderOverviewCode('MATERIAL', conflict.sourceObjectNo, conflict.sourceObjectNo, 'font-mono text-amber-700 hover:underline')}｜责任方：${escapeHtml(conflict.ownerRole)}｜下一步：${escapeHtml(conflict.nextActionText)}</div>
              </article>
            `).join('') || '<div class="rounded-md border border-dashed p-3 text-sm text-muted-foreground">暂无需要核对的数据冲突。</div>'}
          </div>
        </section>
      </div>
    </details>
  `
}

function renderExecutionOverview(overview: ProductionObjectOverview): string {
  const { taskFactories, keyTimes, quantityQuality } = overview.executionOverview
  if (taskFactories.length === 0 && overview.materials.length === 0 && keyTimes.length === 0 && quantityQuality.length === 0) return ''
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold">执行概览</h3>
      <div class="mt-3 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <article class="min-w-0 space-y-2">
          <h4 class="text-sm font-semibold">加工厂</h4>
          ${taskFactories.slice(0, 7).map((row) => `
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span class="text-foreground">${escapeHtml(row.taskType)}：${escapeHtml(row.factory)}</span>
              <span class="font-mono text-muted-foreground">${escapeHtml(row.taskNo)}</span>
              ${badge(row.status)}
            </div>
          `).join('') || '<div class="text-sm text-muted-foreground">暂无加工任务</div>'}
        </article>
        <article class="min-w-0 space-y-2">
          <h4 class="text-sm font-semibold">物料配领</h4>
          ${renderMaterialPickupSummary(overview.materials)}
        </article>
        <article class="min-w-0 space-y-2">
          <h4 class="text-sm font-semibold">时间</h4>
          ${keyTimes.slice(0, 9).map((row) => {
            const timeText = row.actualAt !== '-' ? row.actualAt : row.plannedAt
            return `
              <div class="grid grid-cols-[8rem_1fr] gap-2 text-sm">
                <span class="text-blue-600">${escapeHtml(row.nodeType)}：</span>
                <span class="text-foreground">${escapeHtml(timeText || '待确认')}</span>
              </div>
            `
          }).join('') || '<div class="text-sm text-muted-foreground">暂无关键时间</div>'}
        </article>
        <article class="min-w-0 space-y-2">
          <h4 class="text-sm font-semibold">数量</h4>
          ${quantityQuality.slice(0, 9).map((row) => `
            <div class="grid grid-cols-[8rem_1fr] gap-2 text-sm">
              <span class="text-blue-600">${escapeHtml(row.quantityType)}：</span>
              <span class="text-foreground">${escapeHtml(row.currentQty)}${row.unit ? ` ${escapeHtml(row.unit)}` : ''}</span>
            </div>
          `).join('') || '<div class="text-sm text-muted-foreground">暂无关键数量</div>'}
        </article>
      </div>
    </section>
  `
}

function getMaterialPickupQty(line: ProductionMaterialLine): number {
  return Math.max(Number(line.issuedQty || 0), Number(line.factoryReceivedQty || 0))
}

function getMaterialPickupGap(line: ProductionMaterialLine): number {
  const preparedGap = Math.max(0, line.requiredQty - Number(line.preparedQty || 0))
  const pickupGap = Math.max(0, line.requiredQty - getMaterialPickupQty(line))
  if (line.shortageQty > 0) return line.shortageQty
  return Math.max(preparedGap, pickupGap)
}

function getMaterialPickupStatus(line: ProductionMaterialLine): string {
  const preparedQty = Number(line.preparedQty || 0)
  const pickupQty = getMaterialPickupQty(line)
  if (line.purchaseArrivalStatus === 'NOT_PURCHASED') return '待采购'
  if (line.purchaseArrivalStatus === 'PURCHASED_NOT_ARRIVED' || line.purchaseArrivalStatus === 'PARTIAL_ARRIVED') return '待到仓'
  if (preparedQty <= 0) return '待配料'
  if (preparedQty < line.requiredQty) return '部分配料'
  if (pickupQty <= 0) return '待领料'
  if (pickupQty < line.requiredQty) return '部分领料'
  return '已领齐'
}

function getMaterialPickupPriority(line: ProductionMaterialLine): number {
  const status = getMaterialPickupStatus(line)
  if (getMaterialPickupGap(line) > 0 && status !== '已领齐') return 0
  if (status === '待领料' || status === '部分领料') return 1
  if (line.materialType === 'FABRIC') return 2
  if (line.materialType === 'ACCESSORY' || line.materialType === 'YARN') return 3
  return 4
}

function renderMaterialPickupSummary(materials: ProductionMaterialLine[]): string {
  const rows = [...materials].sort((a, b) =>
    getMaterialPickupPriority(a) - getMaterialPickupPriority(b) ||
    a.materialName.localeCompare(b.materialName),
  )
  const visibleRows = pickVisibleMaterialPickupRows(rows)
  return `
    ${visibleRows.map((line) => {
      const pickupQty = getMaterialPickupQty(line)
      const gapQty = getMaterialPickupGap(line)
      return `
        <div class="rounded-md border bg-muted/20 p-2 text-xs">
          <div class="flex flex-wrap items-center gap-1">
            ${badge(materialTypeLabel[line.materialType], 'border-slate-200 bg-slate-50 text-slate-700')}
            ${badge(getMaterialPickupStatus(line))}
          </div>
          <div class="mt-1 truncate text-sm font-medium">${escapeHtml(line.materialName)}</div>
          <div class="mt-0.5 truncate font-mono text-muted-foreground">${renderOverviewCode('MATERIAL', line.materialSku, line.materialSku, 'text-blue-600 hover:underline')}</div>
          <div class="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-muted-foreground">
            <div><span class="text-foreground">需求：</span>${formatQty(line.requiredQty, line.unit)}</div>
            <div><span class="text-foreground">已配料：</span>${formatQty(line.preparedQty, line.unit)}</div>
            <div><span class="text-foreground">已领料：</span>${formatQty(pickupQty, line.unit)}</div>
            <div><span class="text-foreground">缺口：</span>${formatQty(gapQty, line.unit)}</div>
          </div>
        </div>
      `
    }).join('') || '<div class="text-sm text-muted-foreground">暂无物料配领</div>'}
    ${rows.length > visibleRows.length ? `<div class="text-xs text-muted-foreground">另有 ${rows.length - visibleRows.length} 个物料，在「面辅料与仓储」中查看。</div>` : ''}
  `
}

function pickVisibleMaterialPickupRows(rows: ProductionMaterialLine[]): ProductionMaterialLine[] {
  const visibleRows = rows.slice(0, 6)
  const yarnLine = rows.find((line) => line.materialType === 'YARN')
  if (yarnLine && visibleRows.length > 0 && !visibleRows.includes(yarnLine)) visibleRows[visibleRows.length - 1] = yarnLine
  return visibleRows
}

function renderInfoItem(label: string, value: string): string {
  return renderInfoItemHtml(label, escapeHtml(value || '-'))
}

function renderInfoItemHtml(label: string, valueHtml: string): string {
  return `
    <div class="rounded-lg border bg-card p-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 break-words text-sm font-medium text-foreground">${valueHtml}</div>
    </div>
  `
}

function renderMaterialCard(line: ProductionMaterialLine): string {
  const arrivalText = line.estimatedWarehouseArrivalAt || purchaseArrivalStatusLabel[line.purchaseArrivalStatus]
  return `
    <article class="rounded-lg border bg-card p-3">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            ${badge(materialTypeLabel[line.materialType], 'border-slate-200 bg-slate-50 text-slate-700')}
            ${badge(purchaseArrivalStatusLabel[line.purchaseArrivalStatus])}
            ${badge(warehouseExecutionStatusLabel[line.warehouseExecutionStatus])}
          </div>
          <div class="mt-2 text-sm font-semibold">${escapeHtml(line.materialName)}</div>
          <div class="mt-1 text-xs text-muted-foreground">${renderOverviewCode('MATERIAL', line.materialSku, line.materialSku)}｜${escapeHtml(line.spec || '-')}</div>
        </div>
        <div class="text-right text-xs text-muted-foreground">
          <div>当前责任方</div>
          <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(line.ownerRole)}</div>
        </div>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-6">
        ${renderMiniQty('需求', line.requiredQty, line.unit)}
        ${renderMiniQty('已采购', line.purchasedQty, line.unit)}
        ${renderMiniQty('已到仓', line.arrivedWarehouseQty, line.unit)}
        ${renderMiniQty('已配料', line.preparedQty, line.unit)}
        ${renderMiniQty('已发料', line.issuedQty, line.unit)}
        ${renderMiniQty('工厂已签收', line.factoryReceivedQty, line.unit)}
      </div>
      <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <div><span class="text-foreground">缺口：</span>${formatQty(line.shortageQty, line.unit)}</div>
        <div><span class="text-foreground">预计到仓时间：</span>${escapeHtml(arrivalText)}</div>
        <div><span class="text-foreground">下一步：</span>${escapeHtml(line.nextActionText)}</div>
      </div>
    </article>
  `
}

function renderMiniQty(label: string, value: number | undefined, unit: string): string {
  return `
    <div class="rounded-md border bg-muted/20 p-2">
      <div class="text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 font-medium text-foreground">${formatQty(value, unit)}</div>
    </div>
  `
}

function renderMaterialResourceMetric(label: string, value: string): string {
  return `
    <div class="rounded-lg border bg-card p-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 break-words text-sm font-semibold text-foreground">${escapeHtml(value)}</div>
    </div>
  `
}

function formatMaterialResourceQty(value: number, unit: string): string {
  return `${Number(value || 0).toLocaleString('zh-CN')}${escapeHtml(unit)}`
}

function renderMaterialsTab(overview: ProductionObjectOverview): string {
  const shortageLines = overview.materials.filter((line) => line.shortageQty > 0)
  const arrivalDates = shortageLines.map((line) => line.estimatedWarehouseArrivalAt).filter(Boolean).sort()
  return `
    <div class="space-y-3">
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-sm font-semibold">面辅料结论</h3>
        <div class="mt-2 grid gap-2 text-sm sm:grid-cols-4">
          ${renderInfoItem('面辅料', shortageLines.length > 0 ? `缺 ${shortageLines.length} 项` : '齐套信息未发现缺口')}
          ${renderInfoItem('主要原因', shortageLines[0]?.materialName ? `${shortageLines[0].materialName}${purchaseArrivalStatusLabel[shortageLines[0].purchaseArrivalStatus]}` : '暂无')}
          ${renderInfoItem('最晚预计到仓', arrivalDates.at(-1) || '待确认')}
          ${renderInfoItem('下一步', overview.continueDecision.nextActionText)}
        </div>
      </section>
      <div class="space-y-3">
        ${overview.materials.map(renderMaterialCard).join('') || '<div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">暂无面辅料明细</div>'}
      </div>
    </div>
  `
}

function renderProgressTab(overview: ProductionObjectOverview): string {
  return `
    <div class="space-y-3">
      ${overview.progressNodes.map((node) => `
        <article class="rounded-lg border bg-card p-3">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="text-sm font-semibold">${escapeHtml(node.nodeName)}</div>
              <div class="mt-1 text-xs text-muted-foreground">${renderOverviewCode('PROCESS_DOC', node.relatedDocNo, node.relatedDocNo)}｜${escapeHtml(node.quantityText)}</div>
            </div>
            ${badge(node.status)}
          </div>
          <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
            <div><span class="text-foreground">责任方：</span>${escapeHtml(node.ownerRole)}</div>
            <div><span class="text-foreground">计划时间：</span>${escapeHtml(node.plannedAt)}</div>
            <div><span class="text-foreground">实际时间：</span>${escapeHtml(node.actualAt)}</div>
            <div><span class="text-foreground">说明：</span>${escapeHtml(node.description)}</div>
          </div>
        </article>
      `).join('') || '<div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">暂无生产进度节点</div>'}
    </div>
  `
}

function renderDocumentGroups(overview: ProductionObjectOverview, groups: string[]): string {
  const primaryRef = getPrimaryObjectRef(overview)
  return `
    <div class="space-y-4">
      ${groups.map((group) => {
        const docs = overview.relatedDocuments.filter((doc) => doc.docGroup === group)
        if (docs.length === 0) return ''
        return `
          <section class="rounded-lg border bg-card p-4">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-semibold">${escapeHtml(group)}</h3>
              <span class="text-xs text-muted-foreground">${docs.length} 个对象</span>
            </div>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
      ${docs.map((doc) => {
        const objectType: ProductionObjectType = doc.docType === '生产需求单'
          ? 'DEMAND'
          : doc.objectType
            ? doc.objectType
          : doc.sourceDomain === 'WMS'
            ? 'WAREHOUSE_DOC'
            : doc.sourceDomain === 'PFOS'
              ? 'PROCESS_DOC'
              : primaryRef.objectType
        const objectId = doc.docType === '生产需求单'
          ? overview.summary.demandNo
          : doc.objectType
            ? doc.docNo
          : doc.sourceDomain === 'WMS' || doc.sourceDomain === 'PFOS'
            ? doc.docNo
            : primaryRef.objectId
        return `
        <article class="rounded-lg border bg-card p-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              ${badge(doc.docType, 'border-slate-200 bg-slate-50 text-slate-700')}
              <div class="mt-2 text-sm font-semibold">${renderOverviewCode(objectType, objectId, doc.docNo)}</div>
              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(doc.sourceDomain)}｜${escapeHtml(doc.quantityText)}｜${escapeHtml(doc.updatedAt)}</div>
            </div>
            ${badge(doc.statusText)}
          </div>
          <div class="mt-3 flex items-center justify-between gap-2 text-xs">
            <span class="text-muted-foreground">责任方：${escapeHtml(doc.ownerRole)}</span>
            <button class="rounded-md border px-2 py-1 hover:bg-muted" data-production-object-action="go-source" data-route-path="${escapeHtml(doc.routePath)}" data-skip-page-rerender="true">查看原页面</button>
          </div>
        </article>
      `}).join('')}
            </div>
          </section>
        `
      }).join('')}
    </div>
  `
}

function renderDocumentsTab(overview: ProductionObjectOverview): string {
  return renderDocumentGroups(overview, ['生产', '面辅料', '裁片', '印花', '染色', '仓库'])
}

function renderIssuesTab(overview: ProductionObjectOverview): string {
  if (overview.issues.length === 0) {
    return '<div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">暂无需要处理的问题</div>'
  }
  return `
    <div class="space-y-3">
      ${overview.issues.map((issue) => `
        <article class="rounded-lg border bg-card p-3">
          <div class="flex flex-wrap items-center gap-2">
            ${badge(issue.issueType)}
            ${badge(`影响：${issue.continueText}`)}
          </div>
          <div class="mt-2 text-sm text-foreground">${escapeHtml(issue.description)}</div>
          <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <div><span class="text-foreground">影响对象：</span>${renderOverviewCode('MATERIAL', issue.affectedObjectNo, issue.affectedObjectNo)}</div>
            <div><span class="text-foreground">当前责任方：</span>${escapeHtml(issue.ownerRole)}</div>
            <div><span class="text-foreground">下一步：</span>${escapeHtml(issue.nextActionText)}</div>
          </div>
        </article>
      `).join('')}
    </div>
  `
}

function renderRelationshipTab(overview: ProductionObjectOverview): string {
  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-sm font-semibold">关系链</h3>
        <div class="mt-3 grid gap-2 md:grid-cols-2">
          ${overview.relationshipEdges.map((edge) => `
            <article class="rounded-md border bg-muted/20 p-3 text-xs">
              <div class="font-medium text-foreground">${escapeHtml(edge.from)} → ${escapeHtml(edge.to)}</div>
              <div class="mt-1 text-muted-foreground">${escapeHtml(edge.relationText)}</div>
            </article>
          `).join('') || '<div class="rounded-md border border-dashed p-3 text-sm text-muted-foreground">暂无关系链</div>'}
        </div>
      </section>
      ${overview.relationshipGroups.map((group) => `
        <section class="rounded-lg border bg-card p-4">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold">${escapeHtml(group.groupName)}</h3>
            <span class="text-xs text-muted-foreground">${group.nodes.length} 个节点</span>
          </div>
          <div class="mt-3 grid gap-2 md:grid-cols-2">
            ${group.nodes.map((node) => `
              <article class="rounded-md border bg-muted/20 p-3">
                <div class="flex flex-wrap items-center gap-2">
                  ${badge(node.nodeType, 'border-slate-200 bg-slate-50 text-slate-700')}
                  ${badge(node.statusText)}
                </div>
                <div class="mt-2 break-all font-mono text-sm font-semibold">${escapeHtml(node.objectNo)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(node.title)}</div>
                <div class="mt-2 flex items-center justify-between gap-2 text-xs">
                  <span class="text-muted-foreground">责任方：${escapeHtml(node.ownerRole)}</span>
                  <button class="rounded-md border px-2 py-1 hover:bg-muted" data-production-object-action="go-source" data-route-path="${escapeHtml(node.routePath)}" data-skip-page-rerender="true">查看原页面</button>
                </div>
              </article>
            `).join('') || '<div class="rounded-md border border-dashed p-3 text-sm text-muted-foreground">暂无节点</div>'}
          </div>
        </section>
      `).join('')}
    </div>
  `
}

function renderTimelineTab(overview: ProductionObjectOverview): string {
  return `
    <div class="space-y-3">
      ${overview.productionTimeline.map((node, index) => `
        <article class="rounded-lg border ${node.isIssue ? 'border-red-200 bg-red-50' : node.isCurrent ? 'border-amber-200 bg-amber-50' : 'bg-card'} p-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">${index + 1}</span>
            <span class="text-sm font-semibold">${escapeHtml(node.nodeName)}</span>
            ${badge(node.statusText)}
          </div>
          <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
            <div><span class="text-foreground">计划时间：</span>${escapeHtml(node.plannedAt)}</div>
            <div><span class="text-foreground">实际时间：</span>${escapeHtml(node.actualAt)}</div>
            <div><span class="text-foreground">责任方：</span>${escapeHtml(node.ownerRole)}</div>
            <div><span class="text-foreground">依据：</span>${renderOverviewCode('PRODUCTION_ORDER', overview.summary.productionOrderNo, node.evidenceObjectNo, 'font-mono text-blue-600 hover:underline')}</div>
          </div>
        </article>
      `).join('')}
    </div>
  `
}

function renderMaterialFlowTab(overview: ProductionObjectOverview): string {
  return `
    <div class="space-y-3">
      ${overview.materialFlowTimeline.map((event, index) => `
        <article class="rounded-lg border bg-card p-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">${index + 1}</span>
            <span class="text-sm font-semibold">${escapeHtml(event.stageName)}</span>
            ${badge(event.statusText)}
          </div>
          <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
            <div><span class="text-foreground">来源对象：</span>${escapeHtml(event.sourceObjectNo)}</div>
            <div><span class="text-foreground">数量：</span>${escapeHtml(event.quantityText)}</div>
            <div><span class="text-foreground">责任方：</span>${escapeHtml(event.ownerRole)}</div>
            <div><span class="text-foreground">时间：</span>${escapeHtml(event.eventAt)}</div>
          </div>
        </article>
      `).join('') || '<div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">暂无面辅料流转记录</div>'}
    </div>
  `
}

function renderResponsibilityTab(overview: ProductionObjectOverview): string {
  return `
    <div class="space-y-3">
      ${overview.responsibilityAnalysis.map((item) => `
        <article class="rounded-lg border bg-card p-3">
          <div class="flex flex-wrap items-center gap-2">
            ${badge(item.issueType)}
            ${badge(`责任方：${item.ownerRole}`)}
          </div>
          <div class="mt-2 text-sm text-foreground">${escapeHtml(item.affectedScopeText)}</div>
          <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
            <div><span class="text-foreground">判断依据：</span>${escapeHtml(item.evidenceText)}</div>
            <div><span class="text-foreground">依据对象：</span>${escapeHtml(item.evidenceObjectNo)}</div>
            <div><span class="text-foreground">下一步：</span>${escapeHtml(item.nextActionText)}</div>
            <div><span class="text-foreground">预计恢复：</span>${escapeHtml(item.recoveryText)}</div>
          </div>
        </article>
      `).join('') || '<div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">暂无责任分析</div>'}
    </div>
  `
}

function renderCrossQueryTab(overview: ProductionObjectOverview): string {
  const rows = queryProductionObjectIssues({ materialSku: overview.materials[0]?.materialSku || undefined })
  const fallbackRows = rows.length ? rows : queryProductionObjectIssues({ issueType: '已采购未到仓' })
  return `
    <div class="space-y-3">
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-sm font-semibold">生产问题聚合查询</h3>
        <p class="mt-1 text-xs text-muted-foreground">当前展示同物料或同类问题影响的生产单集合，可按物料 SKU、工厂、异常类型、预计到仓日期在数据层查询。</p>
      </section>
      <div class="grid gap-3 md:grid-cols-2">
        ${fallbackRows.map((row) => `
          <article class="rounded-lg border bg-card p-3">
            <div class="flex flex-wrap items-center gap-2">
              ${badge(row.issueType)}
              ${badge(row.riskText)}
            </div>
            <div class="mt-2 font-mono text-sm font-semibold">${renderOverviewCode('PRODUCTION_ORDER', row.productionOrderNo, row.productionOrderNo)}</div>
            <div class="mt-1 text-sm">${escapeHtml(row.productTitle)}</div>
            <div class="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div><span class="text-foreground">影响对象：</span>${escapeHtml(row.impactObjectNo)}</div>
              <div><span class="text-foreground">责任方：</span>${escapeHtml(row.ownerRole)}</div>
              <div><span class="text-foreground">工厂：</span>${escapeHtml(row.factoryName)}</div>
              <div><span class="text-foreground">预计恢复：</span>${escapeHtml(row.etaDate)}</div>
            </div>
            <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.reasonText)}</div>
          </article>
        `).join('') || '<div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">暂无聚合结果</div>'}
      </div>
    </div>
  `
}

function renderMaterialsWarehouseTab(overview: ProductionObjectOverview): string {
  return `
    <div class="space-y-4">
      ${renderMaterialsTab(overview)}
      <section>
        <h3 class="mb-3 text-sm font-semibold">仓储与配领单据</h3>
        ${renderDocumentGroups(overview, ['面辅料', '仓库'])}
      </section>
    </div>
  `
}

function renderTasksTab(overview: ProductionObjectOverview): string {
  return `
    <div class="space-y-4">
      <section>
        <h3 class="mb-3 text-sm font-semibold">工艺任务</h3>
        ${renderProgressTab(overview)}
      </section>
      <section>
        <h3 class="mb-3 text-sm font-semibold">工艺单据</h3>
        ${renderDocumentGroups(overview, ['生产', '裁片', '印花', '染色'])}
      </section>
    </div>
  `
}

function renderIssuesResponsibilityTab(overview: ProductionObjectOverview): string {
  return `
    <div class="space-y-4">
      <section>
        <h3 class="mb-3 text-sm font-semibold">异常与责任</h3>
        ${renderIssuesTab(overview)}
      </section>
      <section>
        <h3 class="mb-3 text-sm font-semibold">责任分析</h3>
        ${renderResponsibilityTab(overview)}
      </section>
    </div>
  `
}

function renderRelationshipHistoryTab(overview: ProductionObjectOverview): string {
  return `
    <div class="space-y-4">
      ${renderRelationshipTab(overview)}
      <section>
        <h3 class="mb-3 text-sm font-semibold">生产时间线</h3>
        ${renderTimelineTab(overview)}
      </section>
      <section>
        <h3 class="mb-3 text-sm font-semibold">面辅料流转</h3>
        ${renderMaterialFlowTab(overview)}
      </section>
      <section>
        <h3 class="mb-3 text-sm font-semibold">跨单影响</h3>
        ${renderCrossQueryTab(overview)}
      </section>
    </div>
  `
}

function renderQuantityTab(overview: ProductionObjectOverview): string {
  const rows = overview.executionOverview.quantityQuality
  return `
    <div class="space-y-3">
      <h3 class="text-sm font-semibold">关键数量</h3>
      <div class="grid gap-2">
        ${rows.map((row) => {
          const value = `${row.currentQty}${row.unit} / 计划 ${row.plannedQty}${row.unit}`
          const note = `${row.status}｜差异 ${row.diff}｜${row.note}`
          return `
            <article class="rounded-md border bg-card p-3 text-sm" data-production-object-highlight-key="${escapeHtml(makeHighlightKeyFromText(row.quantityType))}">
              <div class="flex items-center justify-between gap-3">
                <span class="font-medium">${escapeHtml(row.quantityType)}</span>
                <span class="font-mono">${escapeHtml(value)}</span>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(note)}</p>
            </article>
          `
        }).join('') || '<div class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">暂无关键数量</div>'}
      </div>
    </div>
  `
}

export function renderOverviewSummaryTab(overview: ProductionObjectOverview): string {
  return renderSummaryTab(overview)
}

export function renderOverviewMaterialsTab(overview: ProductionObjectOverview): string {
  return renderMaterialsTab(overview)
}

export function renderOverviewProgressTab(overview: ProductionObjectOverview): string {
  return renderProgressTab(overview)
}

export function renderOverviewDocumentsTab(overview: ProductionObjectOverview): string {
  return renderDocumentsTab(overview)
}

export function renderOverviewIssuesTab(overview: ProductionObjectOverview): string {
  return renderIssuesTab(overview)
}

export function renderOverviewRelationshipTab(overview: ProductionObjectOverview): string {
  return renderRelationshipTab(overview)
}

export function renderOverviewTimelineTab(overview: ProductionObjectOverview): string {
  return renderTimelineTab(overview)
}

export function renderOverviewMaterialFlowTab(overview: ProductionObjectOverview): string {
  return renderMaterialFlowTab(overview)
}

export function renderOverviewResponsibilityTab(overview: ProductionObjectOverview): string {
  return renderResponsibilityTab(overview)
}

export function renderOverviewCrossQueryTab(overview: ProductionObjectOverview): string {
  return renderCrossQueryTab(overview)
}

function renderTabBody(overview: ProductionObjectOverview, tab: OverviewTab): string {
  if (tab === 'materials' || tab === 'documents') return renderMaterialsWarehouseTab(overview)
  if (tab === 'progress') return renderTasksTab(overview)
  if (tab === 'quantity') return renderQuantityTab(overview)
  if (tab === 'issues' || tab === 'responsibility') return renderIssuesResponsibilityTab(overview)
  if (tab === 'relationship-history' || tab === 'relationship' || tab === 'timeline' || tab === 'material-flow' || tab === 'cross-query') return renderRelationshipHistoryTab(overview)
  return renderSummaryTab(overview)
}

function renderMaterialResourceHeader(resource: MaterialResourceOverview): string {
  return `
    <header class="border-b bg-card px-4 py-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            ${badge(materialTypeLabel[resource.materialType], 'border-blue-200 bg-blue-50 text-blue-700')}
            <span class="font-mono break-all text-sm font-semibold">${escapeHtml(resource.materialSku)}</span>
          </div>
          <h2 class="mt-1 text-base font-semibold">物料资源总览｜${escapeHtml(resource.materialName)}</h2>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(resource.spec)}｜${escapeHtml(resource.unit)}｜${escapeHtml(resource.supplierName)}</p>
        </div>
        <button class="h-8 w-8 rounded-md text-lg text-muted-foreground hover:bg-muted" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭">×</button>
      </div>
    </header>
  `
}

function renderMaterialResourceTabs(resource: MaterialResourceOverview, tab: MaterialResourceTab): string {
  return `
    <div class="flex shrink-0 gap-1 overflow-x-auto border-b bg-card px-4" role="tablist">
      ${MATERIAL_RESOURCE_TAB_ITEMS.map((item) => `
        <button
          type="button"
          class="whitespace-nowrap border-b-2 px-3 py-2 text-sm ${item.key === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-muted-foreground hover:text-foreground'}"
          data-production-object-action="switch-material-tab"
          data-tab="${item.key}"
          data-material-sku="${escapeHtml(resource.materialSku)}"
          data-skip-page-rerender="true"
        >${escapeHtml(item.label)}</button>
      `).join('')}
    </div>
  `
}

function renderMaterialSupplyDemandTab(resource: MaterialResourceOverview): string {
  const summary = resource.supplyDemandSummary
  const source = resource.sourceContext
  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-sm font-semibold">当前判断</h3>
        <p class="mt-2 text-sm text-foreground">${escapeHtml(resource.currentJudgement)}</p>
        ${source?.sourceObjectId ? `<p class="mt-2 text-xs text-muted-foreground">当前来源：${escapeHtml(source.sourceLabel || '生产对象总览')}｜${renderOverviewCode(source.sourceObjectType || 'PRODUCTION_ORDER', source.sourceObjectId, source.sourceObjectId)}</p>` : ''}
      </section>
      <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        ${renderMaterialResourceMetric('总需求', formatMaterialResourceQty(summary.totalRequiredQty, summary.unit))}
        ${renderMaterialResourceMetric('可用库存', formatMaterialResourceQty(summary.availableQty, summary.unit))}
        ${renderMaterialResourceMetric('已锁定', formatMaterialResourceQty(summary.lockedQty, summary.unit))}
        ${renderMaterialResourceMetric('缺口', formatMaterialResourceQty(summary.shortageQty, summary.unit))}
        ${renderMaterialResourceMetric('在途采购', formatMaterialResourceQty(summary.inTransitQty, summary.unit))}
        ${renderMaterialResourceMetric('待检', formatMaterialResourceQty(summary.pendingInspectionQty, summary.unit))}
        ${renderMaterialResourceMetric('影响范围', `${resource.businessAllocations.length} 张生产单`)}
        ${renderMaterialResourceMetric('最早影响交期', summary.earliestImpactDate)}
      </section>
    </div>
  `
}

function renderMaterialAllocationsTab(resource: MaterialResourceOverview): string {
  return `
    <div class="space-y-3">
      ${resource.businessAllocations.map((item) => `
        <article class="rounded-lg border ${item.isSourceContext ? 'border-blue-300 bg-blue-50/60' : 'bg-card'} p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0 break-all font-mono text-sm font-semibold">${renderOverviewCode('PRODUCTION_ORDER', item.businessNo, item.businessNo)}</div>
            <div class="flex flex-wrap items-center gap-2">
              ${item.isSourceContext ? badge('当前来源', 'border-blue-200 bg-blue-100 text-blue-700') : ''}
              ${badge(item.status)}
            </div>
          </div>
          <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
            <div class="break-words"><span class="text-foreground">SPU：</span>${escapeHtml(item.spu)}</div>
            <div class="break-words"><span class="text-foreground">颜色尺码：</span>${escapeHtml(item.colorSize)}</div>
            <div class="break-words"><span class="text-foreground">交期：</span>${escapeHtml(item.deliveryDate)}</div>
            <div class="break-words"><span class="text-foreground">优先级：</span>${escapeHtml(item.priority)}</div>
            <div><span class="text-foreground">需求：</span>${formatMaterialResourceQty(item.requiredQty, resource.unit)}</div>
            <div><span class="text-foreground">已配料：</span>${formatMaterialResourceQty(item.preparedQty, resource.unit)}</div>
            <div><span class="text-foreground">已领料：</span>${formatMaterialResourceQty(item.pickedQty, resource.unit)}</div>
            <div><span class="text-foreground">缺口：</span>${formatMaterialResourceQty(item.shortageQty, resource.unit)}</div>
          </div>
        </article>
      `).join('')}
    </div>
  `
}

function renderMaterialInventoryTab(resource: MaterialResourceOverview): string {
  return `
    <div class="space-y-4">
      <section class="space-y-2">
        <h3 class="text-sm font-semibold">库存批次</h3>
        ${resource.inventoryBatches.map((item) => `
          <div class="rounded-lg border bg-card p-3 text-xs">
            <div class="break-words font-medium">${escapeHtml(item.warehouseName)}｜${escapeHtml(item.batchNo)}</div>
            <div class="mt-2 grid gap-2 text-muted-foreground sm:grid-cols-5">
              <div>总库存：${formatMaterialResourceQty(item.totalQty, item.unit)}</div>
              <div>可用：${formatMaterialResourceQty(item.availableQty, item.unit)}</div>
              <div>锁定：${formatMaterialResourceQty(item.lockedQty, item.unit)}</div>
              <div>待检：${formatMaterialResourceQty(item.pendingInspectionQty, item.unit)}</div>
              <div>冻结：${formatMaterialResourceQty(item.frozenQty, item.unit)}</div>
            </div>
          </div>
        `).join('')}
      </section>
      <section class="space-y-2">
        <h3 class="text-sm font-semibold">采购在途</h3>
        ${resource.purchaseInTransit.map((item) => `
          <div class="rounded-lg border bg-card p-3 text-xs">
            <div class="font-mono break-all font-medium">${escapeHtml(item.purchaseOrderNo)}</div>
            <div class="mt-2 grid gap-2 text-muted-foreground sm:grid-cols-4">
              <div class="break-words">供应商：${escapeHtml(item.supplierName)}</div>
              <div>采购：${formatMaterialResourceQty(item.purchaseQty, resource.unit)}</div>
              <div>未到仓：${formatMaterialResourceQty(item.pendingArrivalQty, resource.unit)}</div>
              <div>预计到仓：${escapeHtml(item.estimatedArrivalAt)}</div>
            </div>
          </div>
        `).join('') || '<div class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">暂无采购在途</div>'}
      </section>
    </div>
  `
}

function renderMaterialExecutionTab(resource: MaterialResourceOverview): string {
  return `
    <div class="space-y-3">
      ${resource.materialExecutionLines.map((item) => `
        <article class="rounded-lg border ${item.isSourceContext ? 'border-blue-300 bg-blue-50/60' : 'bg-card'} p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0 break-words text-sm font-semibold">${renderOverviewCode('PRODUCTION_ORDER', item.businessNo, item.businessNo)}｜${escapeHtml(item.processName)} / ${escapeHtml(item.factoryName)}</div>
            ${item.isSourceContext ? badge('当前来源', 'border-blue-200 bg-blue-100 text-blue-700') : ''}
          </div>
          <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-5">
            <div>需求：${formatMaterialResourceQty(item.requiredQty, item.unit)}</div>
            <div>已配料：${formatMaterialResourceQty(item.preparedQty, item.unit)}</div>
            <div>待配料：${formatMaterialResourceQty(item.pendingPrepareQty, item.unit)}</div>
            <div>已领料：${formatMaterialResourceQty(item.pickedQty, item.unit)}</div>
            <div>待领料：${formatMaterialResourceQty(item.pendingPickQty, item.unit)}</div>
            <div>已发料：${formatMaterialResourceQty(item.issuedQty, item.unit)}</div>
            <div>待发料：${formatMaterialResourceQty(item.pendingIssueQty, item.unit)}</div>
            <div>缺口：${formatMaterialResourceQty(item.shortageQty, item.unit)}</div>
            <div class="break-words sm:col-span-2">下一动作：${escapeHtml(item.nextActionText)}</div>
          </div>
        </article>
      `).join('')}
    </div>
  `
}

function renderMaterialIssuesMasterTab(resource: MaterialResourceOverview): string {
  return `
    <div class="space-y-4">
      <section class="space-y-2">
        <h3 class="text-sm font-semibold">异常与风险</h3>
        ${resource.issues.map((item) => `
          <article class="rounded-lg border bg-card p-3 text-xs">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="font-medium">${escapeHtml(item.issueType)}｜${renderOverviewCode('PRODUCTION_ORDER', item.affectedBusinessNo, item.affectedBusinessNo)}</div>
              ${badge(item.statusText)}
            </div>
            <div class="mt-2 grid gap-2 text-muted-foreground sm:grid-cols-4">
              <div>影响数量：${formatMaterialResourceQty(item.affectedQty, item.unit)}</div>
              <div>责任方：${escapeHtml(item.ownerRole)}</div>
              <div>发生时间：${escapeHtml(item.occurredAt)}</div>
              <div>要求完成：${escapeHtml(item.requiredDoneAt)}</div>
              <div class="sm:col-span-4">建议处理：${escapeHtml(item.suggestionText)}</div>
            </div>
          </article>
        `).join('') || '<div class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">暂无异常</div>'}
      </section>
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-sm font-semibold">物料档案</h3>
        <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <div>物料编码：${escapeHtml(resource.masterData.materialSku)}</div>
          <div>名称：${escapeHtml(resource.masterData.materialName)}</div>
          <div>类型：${escapeHtml(materialTypeLabel[resource.masterData.materialType])}</div>
          <div>规格：${escapeHtml(resource.masterData.spec)}</div>
          <div>单位：${escapeHtml(resource.masterData.unit)}</div>
          <div>默认供应商：${escapeHtml(resource.masterData.supplierName)}</div>
          <div>采购周期：${escapeHtml(resource.masterData.purchaseCycleText)}</div>
          <div>最小采购量：${escapeHtml(resource.masterData.minPurchaseQtyText)}</div>
          <div>默认损耗率：${escapeHtml(resource.masterData.lossRateText)}</div>
          <div>替代料：${escapeHtml(resource.masterData.substituteText)}</div>
          <div>适用品类 / SPU：${escapeHtml(resource.masterData.applicableText)}</div>
          <div>主数据状态：${escapeHtml(resource.masterData.statusText)}</div>
        </div>
      </section>
    </div>
  `
}

function renderMaterialResourceTabBody(resource: MaterialResourceOverview, tab: MaterialResourceTab): string {
  if (tab === 'allocations') return renderMaterialAllocationsTab(resource)
  if (tab === 'inventory') return renderMaterialInventoryTab(resource)
  if (tab === 'execution') return renderMaterialExecutionTab(resource)
  if (tab === 'issues-master') return renderMaterialIssuesMasterTab(resource)
  return renderMaterialSupplyDemandTab(resource)
}

function renderUnlinkedObjectSurface(result: ProductionObjectUnlinkedResult): string {
  return `
    <div class="production-object-overview" data-production-object-surface="overview">
      <button class="absolute inset-0 bg-slate-950/30" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭"></button>
      <section class="production-object-overview__panel">
        <header class="flex items-center justify-between border-b px-4 py-3">
          <h2 class="text-base font-semibold">生产对象总览</h2>
          <button class="h-8 w-8 rounded-md text-lg text-muted-foreground hover:bg-muted" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭">×</button>
        </header>
        <div class="space-y-3 p-4 text-sm">
          <div class="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">${escapeHtml(result.message)}</div>
          <div>当前编号：<span class="font-mono">${escapeHtml(result.request.objectId)}</span></div>
          <div>来源系统：${escapeHtml(result.sourceDomain)}</div>
          ${result.routePath
            ? `<button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-production-object-action="go-source" data-route-path="${escapeHtml(result.routePath)}" data-skip-page-rerender="true">查看来源</button>`
            : '<button class="rounded-md border px-3 py-1.5 text-xs text-muted-foreground" type="button" disabled>查看来源</button>'}
        </div>
      </section>
    </div>
  `
}

function renderMultipleMatchesSurface(result: ProductionObjectMultipleMatchesResult): string {
  return `
    <div class="production-object-overview" data-production-object-surface="overview">
      <button class="absolute inset-0 bg-slate-950/30" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭"></button>
      <section class="production-object-overview__panel">
        <header class="flex items-center justify-between border-b px-4 py-3">
          <h2 class="text-base font-semibold">选择关联生产单</h2>
          <button class="h-8 w-8 rounded-md text-lg text-muted-foreground hover:bg-muted" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭">×</button>
        </header>
        <div class="space-y-2 p-4">
          ${result.candidates.map((item) => `
            <button class="w-full rounded-md border p-3 text-left text-sm hover:bg-muted"
              data-production-object-action="open"
              data-object-type="${item.objectType}"
              data-object-id="${escapeHtml(item.id)}"
              data-related-production-order-no="${escapeHtml(item.relatedProductionOrderNo || '')}"
              data-skip-page-rerender="true">
              <div class="font-mono text-blue-700">${escapeHtml(item.primaryNo)}</div>
              <div class="text-xs text-muted-foreground">关联生产单：${escapeHtml(item.relatedProductionOrderNo || '未关联')}</div>
            </button>
          `).join('')}
        </div>
      </section>
    </div>
  `
}

export function renderProductionObjectOverviewSurface(
  objectType: ProductionObjectType,
  objectId: string,
  tab?: OverviewTab,
  relatedProductionOrderNo?: string | null,
  activeHighlightKey?: string | null,
): string {
  const resolved = resolveProductionObjectRequest({ objectType, objectId, relatedProductionOrderNo })
  if (resolved.status === 'UNLINKED') return renderUnlinkedObjectSurface(resolved)
  if (resolved.status === 'MULTIPLE_MATCHES') return renderMultipleMatchesSurface(resolved)

  const overview = getProductionObjectOverview(resolved.indexItem.objectType, resolved.indexItem.id)
  if (!overview) {
    return `
      <div class="production-object-overview" data-production-object-surface="overview">
        <button class="absolute inset-0 bg-slate-950/30" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭"></button>
        <section class="production-object-overview__panel">
          <header class="flex items-center justify-between border-b px-4 py-3">
            <h2 class="text-base font-semibold">生产对象总览</h2>
            <button class="h-8 w-8 rounded-md text-lg text-muted-foreground hover:bg-muted" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭">×</button>
          </header>
          <div class="p-6 text-sm text-muted-foreground">暂无数据</div>
        </section>
      </div>
    `
  }

  const primaryRef = getPrimaryObjectRef(overview)
  const activeBodyTab: OverviewTab = tab || resolved.clickedRef.defaultTab
  const highlightKey = activeHighlightKey || resolved.clickedRef.highlightKey

  return `
    <div
      class="production-object-overview"
      data-production-object-surface="overview"
      data-object-type="${resolved.clickedRef.objectType}"
      data-object-id="${escapeHtml(resolved.clickedRef.objectId)}"
      data-related-production-order-no="${escapeHtml(resolved.indexItem.relatedProductionOrderNo || '')}"
      data-production-object-active-highlight="${escapeHtml(highlightKey)}"
      data-primary-object-type="${primaryRef.objectType}"
      data-primary-object-id="${escapeHtml(primaryRef.objectId)}"
    >
      <button class="absolute inset-0 bg-slate-950/30" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭"></button>
      <section class="production-object-overview__panel">
        ${renderOverviewHeader(overview)}
        ${renderClickedObjectSummary(resolved.clickedRef, resolved.indexItem.relatedProductionOrderNo)}
        ${renderTabs(overview, activeBodyTab, {
          objectType: resolved.clickedRef.objectType,
          objectId: resolved.clickedRef.objectId,
          relatedProductionOrderNo: resolved.indexItem.relatedProductionOrderNo,
        })}
        <div class="production-object-overview__body">
          ${renderTabBody(overview, activeBodyTab)}
        </div>
        <footer class="production-object-overview__footer">
          <div class="text-xs text-muted-foreground">FCS 只展示采购、WMS、PFOS 摘要与下钻入口，不在这里修改原系统数据。</div>
        </footer>
      </section>
    </div>
  `
}

export function renderMaterialResourceOverviewSurface(
  materialSku: string,
  context: MaterialResourceContext = {},
  tab: MaterialResourceTab = activeMaterialResourceTab,
): string {
  const resource = getMaterialResourceOverview(materialSku, context)
  if (!resource) {
    return `
      <div
        class="production-object-overview"
        data-production-object-surface="material-resource"
        data-material-sku="${escapeHtml(materialSku)}"
        data-source-object-type="${escapeHtml(context.sourceObjectType || '')}"
        data-source-object-id="${escapeHtml(context.sourceObjectId || '')}"
      >
        <button class="absolute inset-0 bg-slate-950/30" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭"></button>
        <section class="production-object-overview__panel">
          <header class="flex items-center justify-between border-b px-4 py-3">
            <h2 class="text-base font-semibold">物料资源总览</h2>
            <button class="h-8 w-8 rounded-md text-lg text-muted-foreground hover:bg-muted" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭">×</button>
          </header>
          <div class="p-6 text-sm text-muted-foreground">暂无物料资源数据</div>
        </section>
      </div>
    `
  }
  return `
    <div
      class="production-object-overview"
      data-production-object-surface="material-resource"
      data-material-sku="${escapeHtml(resource.materialSku)}"
      data-source-object-type="${escapeHtml(context.sourceObjectType || '')}"
      data-source-object-id="${escapeHtml(context.sourceObjectId || '')}"
    >
      <button class="absolute inset-0 bg-slate-950/30" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭"></button>
      <section class="production-object-overview__panel">
        ${renderMaterialResourceHeader(resource)}
        ${renderMaterialResourceTabs(resource, tab)}
        <div class="production-object-overview__body">
          ${renderMaterialResourceTabBody(resource, tab)}
        </div>
        <footer class="production-object-overview__footer">
          <div class="text-xs text-muted-foreground">物料资源总览只做供需、库存、配领发和异常判断，不在这里修改库存或采购数据。</div>
        </footer>
      </section>
    </div>
  `
}

function getOverlayRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>('[data-production-object-overlay-root="true"]')
}

function setOverlay(html: string, mode: 'search' | 'overview' | 'material-resource'): void {
  const root = getOverlayRoot()
  if (!root) return
  root.innerHTML = html
  root.dataset.productionObjectMode = mode
}

function updateSearchResults(input: HTMLInputElement): void {
  searchKeyword = input.value
  const panel = input.closest<HTMLElement>('[data-production-object-surface="search"]')
  const results = panel?.querySelector<HTMLElement>('[data-production-object-search-results="true"]')
  if (results) results.innerHTML = renderSearchResults(searchKeyword)
}

function navigateTo(routePath: string): void {
  if (!routePath || typeof window === 'undefined') return
  window.history.pushState(window.history.state, '', routePath)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function closeProductionObjectOverlays(): boolean {
  const root = getOverlayRoot()
  if (!root || !root.innerHTML.trim()) return false
  root.innerHTML = ''
  delete root.dataset.productionObjectMode
  return true
}

export function handleProductionObjectOverviewEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-production-object-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.productionObjectAction

  if (action === 'toggle-search') {
    const root = getOverlayRoot()
    if (root?.dataset.productionObjectMode === 'search') {
      closeProductionObjectOverlays()
    } else {
      setOverlay(renderProductionObjectSearchPanel(searchKeyword), 'search')
    }
    return true
  }

  if (action === 'search') {
    if (actionNode instanceof HTMLInputElement) updateSearchResults(actionNode)
    return true
  }

  if (action === 'clear-search') {
    searchKeyword = ''
    setOverlay(renderProductionObjectSearchPanel(''), 'search')
    return true
  }

  if (action === 'open-material-resource') {
    activeMaterialResourceTab = 'supply-demand'
    const materialSku = actionNode.dataset.materialSku || actionNode.dataset.objectId
    const surface = actionNode.closest<HTMLElement>('[data-production-object-surface="overview"]')
    const sourceObjectType = (actionNode.dataset.sourceObjectType || surface?.dataset.primaryObjectType || surface?.dataset.objectType) as ProductionObjectType | undefined
    const sourceObjectId = actionNode.dataset.sourceObjectId || surface?.dataset.primaryObjectId || surface?.dataset.objectId
    if (!materialSku) return true
    setOverlay(renderMaterialResourceOverviewSurface(materialSku, {
      sourceObjectType,
      sourceObjectId,
      sourceLabel: sourceObjectId ? '生产对象总览 / 面辅料与仓储' : undefined,
    }, activeMaterialResourceTab), 'material-resource')
    return true
  }

  if (action === 'open') {
    const objectType = actionNode.dataset.objectType as ProductionObjectType | undefined
    const objectId = actionNode.dataset.objectId
    const defaultTab = actionNode.dataset.defaultTab as OverviewTab | undefined
    const highlightKey = actionNode.dataset.highlightKey
    const relatedProductionOrderNo = actionNode.dataset.relatedProductionOrderNo
    activeTab = defaultTab || 'overview'
    if (!objectType || !objectId) return true
    setOverlay(renderProductionObjectOverviewSurface(objectType, objectId, defaultTab, relatedProductionOrderNo, highlightKey), 'overview')
    return true
  }

  if (action === 'switch-tab') {
    const nextTab = (actionNode.dataset.tab as OverviewTab | undefined) || 'overview'
    const surface = actionNode.closest<HTMLElement>('[data-production-object-surface="overview"]')
    const objectType = (actionNode.dataset.objectType || surface?.dataset.objectType) as ProductionObjectType | undefined
    const objectId = actionNode.dataset.objectId || surface?.dataset.objectId
    const relatedProductionOrderNo = actionNode.dataset.relatedProductionOrderNo || surface?.dataset.relatedProductionOrderNo
    const highlightKey = surface?.dataset.productionObjectActiveHighlight
    if (!objectType || !objectId) return true
    setOverlay(renderProductionObjectOverviewSurface(objectType, objectId, nextTab, relatedProductionOrderNo, highlightKey), 'overview')
    activeTab = nextTab
    return true
  }

  if (action === 'switch-material-tab') {
    activeMaterialResourceTab = (actionNode.dataset.tab as MaterialResourceTab | undefined) || 'supply-demand'
    const surface = actionNode.closest<HTMLElement>('[data-production-object-surface="material-resource"]')
    const materialSku = surface?.dataset.materialSku
    const sourceObjectType = surface?.dataset.sourceObjectType as ProductionObjectType | undefined
    const sourceObjectId = surface?.dataset.sourceObjectId
    if (!materialSku) return true
    setOverlay(renderMaterialResourceOverviewSurface(materialSku, {
      sourceObjectType,
      sourceObjectId,
      sourceLabel: sourceObjectId ? '生产对象总览 / 面辅料与仓储' : undefined,
    }, activeMaterialResourceTab), 'material-resource')
    return true
  }

  if (action === 'copy-no') {
    const text = actionNode.dataset.copyText || ''
    void navigator.clipboard?.writeText(text)
    actionNode.textContent = '已复制'
    return true
  }

  if (action === 'go-source') {
    navigateTo(actionNode.dataset.routePath || '')
    closeProductionObjectOverlays()
    return true
  }

  if (action === 'close') {
    closeProductionObjectOverlays()
    return true
  }

  return false
}

export function hasProductionObjectIndexData(): boolean {
  return productionObjectSearchIndex.length > 0
}
