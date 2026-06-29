import { renderBadge } from '../../../components/ui/badge.ts'
import type { BadgeVariant } from '../../../components/ui/types.ts'
import {
  appendAutoPrepRecordForOrder,
  closeMaterialPrepOrder,
  confirmMaterialPrepRecord,
  getMaterialPrepOrderProjection,
  getMaterialPrepRecordItems,
  listMaterialPrepOrderProjections,
  materialPrepStatusLabelMap,
  materialPrepRecordStatusLabelMap,
  materialPrepWorkbenchTabs,
  pickupStatusLabelMap,
  classifyPrepLineType,
  pickMaterialPrepRecord,
  stageMaterialPrepRecord,
  type MaterialPrepLine,
  type MaterialPrepOrderProjection,
  type MaterialPrepOrderStatus,
  type MaterialPrepRecord,
  type MaterialPrepRecordStatus,
  type PickupRecord,
  type PrepRejectRecord,
} from '../../../data/fcs/cutting/production-material-prep.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../../../data/fcs/production-order-identity.ts'
import { escapeHtml } from '../../../utils.ts'

type MaterialPrepDetailTab = 'demand' | 'inventory' | 'tasks' | 'records' | 'pickup'

const statusVariantMap: Record<string, BadgeVariant> = {
  NEED_PREP_NO_STOCK: 'warning',
  NEED_PREP_PARTIAL_STOCK: 'info',
  NEED_PREP_ALL_STOCK: 'success',
  REJECTED_REWORK: 'danger',
  READY: 'success',
  CLOSED: 'neutral',
  WAIT_PICKUP: 'warning',
  REJECTED_WAIT_WLS: 'danger',
  PICKUP_DONE: 'success',
  ACTUAL_CLOSED: 'neutral',
  NOT_PICKABLE: 'neutral',
}

const recordStatusClassMap: Record<MaterialPrepRecordStatus, string> = {
  DRAFT: 'border-l-slate-400 bg-slate-50/60',
  PICKED: 'border-l-blue-500 bg-blue-50/60',
  STAGED: 'border-l-amber-500 bg-amber-50/60',
  CONFIRMED: 'border-l-green-500 bg-green-50/60',
  REJECTED: 'border-l-rose-500 bg-rose-50/60',
}

const legacyPrepStatusMap: Record<string, MaterialPrepOrderStatus> = {
  NEED_PREP: 'NEED_PREP_PARTIAL_STOCK',
  CONTINUE_PREP: 'NEED_PREP_PARTIAL_STOCK',
  SHORTAGE_TRACKING: 'NEED_PREP_NO_STOCK',
}

const categoryLabel = '裁片配料'
const pageBasePath = '/fcs/material-prep/cutting'

function getCategoryLines(projection: Pick<MaterialPrepOrderProjection, 'lines'>): MaterialPrepLine[] {
  return projection.lines.filter((line) => classifyPrepLineType(line) === categoryLabel)
}

function getCategoryLineIds(projection: Pick<MaterialPrepOrderProjection, 'lines'>): Set<string> {
  return new Set(getCategoryLines(projection).map((line) => line.prepLineId))
}

function getCategoryPrepRecords(projection: MaterialPrepOrderProjection): MaterialPrepRecord[] {
  const lineIds = getCategoryLineIds(projection)
  return projection.prepRecords.filter((record) =>
    getMaterialPrepRecordItems(record).some((item) => lineIds.has(item.prepLineId)),
  )
}

function getCategoryTaskProjections(projection: MaterialPrepOrderProjection): MaterialPrepOrderProjection['taskProjections'] {
  const lineIds = getCategoryLineIds(projection)
  return projection.taskProjections.map((task) => {
    const materialLines = task.materialLines.filter((line) => lineIds.has(line.prepLineId))
    return {
      ...task,
      materialCount: materialLines.length,
      prepRecordCount: new Set(materialLines.flatMap((line) => line.prepRecords.map((record) => record.prepRecordId))).size,
      materialLines,
    }
  }).filter((task) => task.materialLines.length > 0)
}

function filterOrders(): MaterialPrepOrderProjection[] {
  return listMaterialPrepOrderProjections().filter(p =>
    p.lines.some(l => classifyPrepLineType(l) === categoryLabel)
  )
}

function normalizeMaterialPrepStatus(value: string | null | undefined): MaterialPrepOrderStatus {
  if (value && value in materialPrepStatusLabelMap) return value as MaterialPrepOrderStatus
  return legacyPrepStatusMap[value || ''] || 'NEED_PREP_NO_STOCK'
}

function filterByKeyword(rows: MaterialPrepOrderProjection[], keyword: string): MaterialPrepOrderProjection[] {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return rows
  return rows.filter((row) =>
    row.order.productionOrderNo.toLowerCase().includes(kw) ||
    row.order.styleNo.toLowerCase().includes(kw) ||
    row.order.styleName.toLowerCase().includes(kw) ||
    row.order.spu.toLowerCase().includes(kw) ||
    getCategoryLines(row).some((line) => line.materialName.toLowerCase().includes(kw)),
  )
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
  return `${pageBasePath}${query ? `?${query}` : ''}`
}

function buildDetailHref(prepOrderId: string, activeTab?: string): string {
  const params = new URLSearchParams()
  params.set('prepOrderId', prepOrderId)
  if (activeTab) params.set('fromTab', activeTab)
  return `${pageBasePath}?${params.toString()}`
}

function buildAddPrepRecordHref(prepOrderId: string, activeTab?: string): string {
  const params = new URLSearchParams()
  params.set('prepOrderId', prepOrderId)
  params.set('detailTab', 'records')
  params.set('prepModal', '1')
  if (activeTab) params.set('fromTab', activeTab)
  return `${pageBasePath}?${params.toString()}`
}

function buildClosePrepOrderHref(prepOrderId: string, activeTab?: string): string {
  const params = new URLSearchParams()
  params.set('prepOrderId', prepOrderId)
  params.set('detailTab', 'inventory')
  params.set('closeModal', '1')
  if (activeTab) params.set('fromTab', activeTab)
  return `${pageBasePath}?${params.toString()}`
}

function renderSearchBar(keyword: string): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-[minmax(240px,1fr)_auto] md:items-end">
        <label class="space-y-1">
          <span class="text-sm font-medium">关键词搜索</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-fcs-material-prep-action="search-input" data-search-field="keyword" data-skip-page-rerender="true" placeholder="生产单号 / 款式 / SPU / 物料名称" value="${escapeHtml(keyword)}" />
        </label>
        <button class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-fcs-material-prep-action="search-apply">查询</button>
      </div>
    </section>
  `
}

function buildDetailStateHref(
  projection: MaterialPrepOrderProjection,
  options: {
    detailTab?: MaterialPrepDetailTab
    prepModal?: boolean
    continuePrepRecordId?: string
    closeModal?: boolean
  } = {},
): string {
  const params = new URLSearchParams()
  params.set('prepOrderId', projection.order.prepOrderId)
  if (options.detailTab) params.set('detailTab', options.detailTab)
  if (options.prepModal) params.set('prepModal', '1')
  if (options.continuePrepRecordId) params.set('continuePrepRecordId', options.continuePrepRecordId)
  if (options.closeModal) params.set('closeModal', '1')
  const fromTab = getSearchParams().get('fromTab')
  if (fromTab) params.set('fromTab', fromTab)
  return `${pageBasePath}?${params.toString()}`
}

function formatQty(value: number, unit = 'yard'): string {
  return `${Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`
}

function renderImageThumb(imageUrl: string, label: string, className = 'h-12 w-12'): string {
  return `
    <div class="${escapeHtml(className)} overflow-hidden rounded-md border bg-muted">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(label)}" class="h-full w-full object-cover" loading="lazy" />
    </div>
  `
}

function renderMaterialThumb(line: MaterialPrepLine): string {
  return renderImageThumb(line.materialImageUrl, line.materialName)
}

function renderSpuThumb(order: MaterialPrepOrderProjection['order'], className = 'h-14 w-14'): string {
  return `
    <div class="shrink-0">
      ${renderImageThumb(order.spuImageUrl, `${order.styleNo} / ${order.spu} 款式SPU图`, className)}
      <div class="mt-1 text-center text-[10px] text-muted-foreground">款式/SPU</div>
    </div>
  `
}

function renderStatus(status: string, label: string): string {
  return renderBadge(label, statusVariantMap[status] || 'neutral')
}

function renderKpi(label: string, value: number | string, desc: string): string {
  return `
    <div class="rounded-lg border bg-card px-4 py-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-2xl font-semibold">${escapeHtml(value)}</div>
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(desc)}</div>
    </div>
  `
}

function renderImplementationStatus(projection: MaterialPrepOrderProjection): string {
  const pendingText = projection.order.pendingAssignmentCount > 0
    ? `${projection.order.pendingAssignmentCount} 个任务待分配后回写工厂`
    : '任务工厂均已回写'
  const stagingText = projection.stagingRecords.length
    ? `${projection.stagingRecords.length} 条暂存记录 / ${projection.order.stagingAreaCount} 个暂存区`
    : '暂无暂存台账'
  const pickText = [
    `待拣货 ${projection.prepRecords.filter((record) => record.recordStatus === 'DRAFT').length}`,
    `已拣货 ${projection.prepRecords.filter((record) => record.recordStatus === 'PICKED').length}`,
    `已入暂存 ${projection.prepRecords.filter((record) => record.recordStatus === 'STAGED').length}`,
  ].join(' / ')
  return `
    <section class="grid gap-3 md:grid-cols-5">
      ${renderKpi('BOM 来源', projection.order.bomSourceLabel, `展开时间 ${escapeHtml(projection.order.bomExpandedAt || '暂无')}`)}
      ${renderKpi('暂存区台账', stagingText, '入暂存区时生成，确认或打回时同步状态')}
      ${renderKpi('仓库拣货进度', pickText, `已确认 ${projection.prepRecords.filter((record) => record.recordStatus === 'CONFIRMED').length} 条`)}
      ${renderKpi('完成通知', `${projection.order.prepCompletionEventCount} 条`, 'CONFIRMED 后生成配料完成通知事件')}
      ${renderKpi('分配回写', pendingText, `已回写 ${projection.order.assignedTaskCount} 个任务`)}
    </section>
  `
}

function getLinePrepRecordCount(row: MaterialPrepOrderProjection, line: MaterialPrepLine): number {
  return row.prepRecords.filter((record) =>
    getMaterialPrepRecordItems(record).some((item) => item.prepLineId === line.prepLineId),
  ).length
}

function getLinePickupRecordCount(row: MaterialPrepOrderProjection, line: MaterialPrepLine): number {
  return row.pickupRecords.filter((record) => record.prepLineId === line.prepLineId).length
}

function renderNeedPrepState(line: MaterialPrepLine): string {
  if (line.linePrepStatus === '被打回') return renderBadge('需要重配', 'danger')
  if (line.linePrepStatus === '按实关闭') return renderBadge('后续不配', 'neutral')
  if (line.remainingNeedQty <= 0) return renderBadge('无需配料', 'success')
  if (line.availableStockQty <= 0) return renderBadge('无库存可配', 'warning')
  if (line.availableStockQty >= line.remainingNeedQty) return renderBadge('库存充足', 'success')
  return renderBadge('库存不足', 'info')
}

function renderLineStockSituation(line: MaterialPrepLine): string {
  return `
    <div class="space-y-1 text-xs">
      <div class="font-medium">${formatQty(line.availableStockQty, line.unit)}</div>
      <div class="text-muted-foreground">${escapeHtml(line.stockWarehouseName)} / ${escapeHtml(line.stockWarehouseArea)}</div>
      <div class="text-muted-foreground">库位：${escapeHtml(line.stockLocationCode)}</div>
    </div>
  `
}

function renderOrderStockSummary(row: MaterialPrepOrderProjection): string {
  const lines = getCategoryLines(row)
  const availableLines = lines.filter((line) => line.availableStockQty > 0).length
  const totalAvailable = lines.reduce((sum, line) => sum + Number(line.availableStockQty || 0), 0)
  const warehouses = Array.from(new Set(lines.filter((line) => line.availableStockQty > 0).map((line) => line.stockWarehouseName)))
  return `
    <div class="space-y-1 text-xs">
      <div>有库存：${availableLines}/${lines.length} 行</div>
      <div>当前库存：${formatQty(totalAvailable)}</div>
      <div class="text-muted-foreground">${warehouses.length ? warehouses.map(escapeHtml).join(' / ') : '暂无可配库存'}</div>
    </div>
  `
}

function renderUpstreamProgress(line: MaterialPrepLine): string {
  const variant = line.upstreamProgressStatus === '已到仓可配'
    ? 'success'
    : line.upstreamProgressStatus === '无需跟进'
      ? 'neutral'
      : 'warning'
  const adjustMessage = `打开${line.upstreamDocumentTitle || '上游单据'}调整：${line.upstreamDocumentNo}`
  return `
    <div class="space-y-1">
      ${renderBadge(line.upstreamProgressStatus, variant)}
      <div class="text-xs text-muted-foreground">${escapeHtml(line.upstreamProgressDetail)}</div>
      ${line.upstreamDocumentNo ? `
        <button
          type="button"
          data-fcs-material-prep-action="adjust-upstream-doc"
          data-upstream-document-no="${escapeHtml(line.upstreamDocumentNo)}"
          data-upstream-document-title="${escapeHtml(line.upstreamDocumentTitle)}"
          data-upstream-document-adjust-message="${escapeHtml(adjustMessage)}"
          onclick="window.alert(this.dataset.upstreamDocumentAdjustMessage || '')"
          class="mt-1 rounded-md border border-blue-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
        >
          ${escapeHtml(line.upstreamDocumentTitle)}：${escapeHtml(line.upstreamDocumentNo)} / ${escapeHtml(line.upstreamDocumentAdjustLabel || '调整')}
        </button>
      ` : ''}
    </div>
  `
}

function renderPrepRecordStatusBadge(status: MaterialPrepRecordStatus): string {
  const label = materialPrepRecordStatusLabelMap[status]
  const variantMap: Record<MaterialPrepRecordStatus, BadgeVariant> = {
    DRAFT: 'neutral',
    PICKED: 'info',
    STAGED: 'warning',
    CONFIRMED: 'success',
    REJECTED: 'danger',
  }
  return renderBadge(label, variantMap[status])
}

function renderTaskAssignmentBadge(task: MaterialPrepLine['taskLinks'][number]): string {
  return task.allocationStatus === '已分配'
    ? renderBadge('已分配', 'success')
    : renderBadge('未分配', 'neutral')
}

function renderTaskFactoryText(task: MaterialPrepLine['taskLinks'][number]): string {
  return task.allocationStatus === '已分配'
    ? `${escapeHtml(task.factoryName || '工厂未命名')} / ${escapeHtml(task.assignedAt || '分配时间未记录')}`
    : '待分配后确定'
}

function renderLineTaskLinks(line: MaterialPrepLine): string {
  if (line.confirmedPrepQty <= 0) return renderBadge('配料确认后分配任务', 'neutral')
  if (!line.taskLinks.length) return renderBadge('确认配料后开放', 'neutral')
  return `
    <div class="space-y-1">
      ${line.taskLinks.map((task) => `
        <div class="rounded-md border bg-background px-2 py-1">
          <div class="flex flex-wrap items-center gap-1">
            ${renderTaskAssignmentBadge(task)}
            <span class="font-medium">${escapeHtml(task.taskNo)}</span>
          </div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.taskName)} / ${renderTaskFactoryText(task)}</div>
        </div>
      `).join('')}
    </div>
  `
}

function renderPrepRecordActions(record: MaterialPrepRecord): string {
  const id = escapeHtml(record.prepRecordId)

  switch (record.recordStatus) {
    case 'DRAFT':
      return `<button type="button" data-fcs-material-prep-action="pick-record" data-prep-record-id="${id}" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">确认拣货</button>`
    case 'PICKED':
      return `<button type="button" data-fcs-material-prep-action="stage-record" data-prep-record-id="${id}" class="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white">确认入暂存区</button>`
    case 'STAGED':
      return `<button type="button" data-fcs-material-prep-action="confirm-record" data-prep-record-id="${id}" class="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white">确认配料完成</button>`
    case 'CONFIRMED':
      return `<span class="rounded-md bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">已确认，可加工领料</span>`
    case 'REJECTED':
      return `
        <span class="rounded-md bg-rose-50 px-3 py-1.5 text-xs text-rose-700">被打回</span>
        <button type="button" data-fcs-material-prep-action="stage-record" data-prep-record-id="${id}" class="rounded-md border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50">重新入暂存区</button>
      `
  }
}

function renderOrderMaterialRows(row: MaterialPrepOrderProjection): string {
  const materialLines = getCategoryLines(row)
  return `
    <div class="rounded-md border bg-background">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div class="text-sm font-medium">裁片纸样关联物料</div>
        <div class="text-xs text-muted-foreground">只显示进入${escapeHtml(categoryLabel)}的物料</div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1500px] text-left text-xs">
          <thead class="bg-muted/60 text-muted-foreground">
            <tr>
              <th class="px-3 py-2">图片</th>
              <th class="px-3 py-2">类别</th>
              <th class="px-3 py-2">物料</th>
              <th class="px-3 py-2">关联任务</th>
              <th class="px-3 py-2">需要多少</th>
              <th class="px-3 py-2">最大可配</th>
              <th class="px-3 py-2">默认配料</th>
              <th class="px-3 py-2">已配多少</th>
              <th class="px-3 py-2">剩余未配</th>
              <th class="px-3 py-2">库存情况</th>
              <th class="px-3 py-2">配料记录</th>
              <th class="px-3 py-2">领料记录</th>
              <th class="px-3 py-2">是否还需要配料</th>
              <th class="px-3 py-2">上游进度</th>
            </tr>
          </thead>
          <tbody>
            ${materialLines.map((line) => `
              <tr class="border-t">
                <td class="px-3 py-2">${renderMaterialThumb(line)}</td>
                <td class="px-3 py-2">${renderBadge(line.materialType, line.materialType === '面料' ? 'info' : line.materialType === '辅料' ? 'warning' : line.materialType === '纱线' ? 'success' : 'neutral')}</td>
                <td class="px-3 py-2">
                  <div class="font-medium">${escapeHtml(line.materialSku)}</div>
                  <div class="mt-1 text-muted-foreground">${escapeHtml(line.materialName)} / ${escapeHtml(line.color)} / ${escapeHtml(line.spec)}</div>
                  <div class="mt-1 text-muted-foreground">裁片单：${escapeHtml(line.cutOrderNo)}</div>
                </td>
                <td class="px-3 py-2">${renderLineTaskLinks(line)}</td>
                <td class="px-3 py-2">${formatQty(line.requiredQty, line.unit)}</td>
                <td class="px-3 py-2">${formatQty(line.maxPrepQty, line.unit)}</td>
                <td class="px-3 py-2">${formatQty(line.defaultPrepQty, line.unit)}</td>
                <td class="px-3 py-2">${formatQty(line.confirmedPrepQty, line.unit)}</td>
                <td class="px-3 py-2">${formatQty(line.remainingNeedQty, line.unit)}</td>
                <td class="px-3 py-2">${renderLineStockSituation(line)}</td>
                <td class="px-3 py-2">${getLinePrepRecordCount(row, line)} 条</td>
                <td class="px-3 py-2">${getLinePickupRecordCount(row, line)} 条</td>
                <td class="px-3 py-2">${renderNeedPrepState(line)}</td>
                <td class="px-3 py-2">
                  ${renderUpstreamProgress(line)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderTabs(rows: MaterialPrepOrderProjection[], activeTab: MaterialPrepOrderStatus): string {
  return `
    <div class="flex flex-wrap gap-2">
      ${materialPrepWorkbenchTabs.map((tab) => {
        const count = rows.filter((row) => row.order.overallPrepStatus === tab.key).length
        return `
          <button type="button" data-nav="${escapeHtml(buildHref({ tab: tab.key, prepOrderId: undefined }))}" class="rounded-md border px-3 py-2 text-sm ${tab.key === activeTab ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}">
            ${escapeHtml(tab.label)} <span class="ml-1 text-xs opacity-80">${count}</span>
          </button>
        `
      }).join('')}
    </div>
  `
}

function renderDetailTabs(projection: MaterialPrepOrderProjection, activeTab: MaterialPrepDetailTab): string {
  const materialLines = getCategoryLines(projection)
  const taskProjections = getCategoryTaskProjections(projection)
  const prepRecords = getCategoryPrepRecords(projection)
  const lineIds = getCategoryLineIds(projection)
  const tabs: Array<{ key: MaterialPrepDetailTab; label: string; count?: string }> = [
    { key: 'demand', label: '生产需求信息' },
    { key: 'inventory', label: '当前各仓库存信息与上游进度', count: `${materialLines.length} 行` },
    { key: 'tasks', label: '按任务查看配料情况', count: `${taskProjections.length} 个任务` },
    { key: 'records', label: '配料记录', count: `${prepRecords.length} 条` },
    { key: 'pickup', label: '与配料记录关联的领料记录', count: `${projection.pickupRecords.filter((record) => lineIds.has(record.prepLineId)).length + projection.rejectRecords.filter((record) => lineIds.has(record.prepLineId)).length} 条` },
  ]
  return `
    <section class="rounded-lg border bg-card px-4 py-3">
      <div class="flex flex-wrap gap-2">
        ${tabs.map((tab) => `
          <button
            type="button"
            data-nav="${escapeHtml(buildDetailStateHref(projection, { detailTab: tab.key }))}"
            class="rounded-md border px-3 py-2 text-sm ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}"
          >
            ${escapeHtml(tab.label)}
            ${tab.count ? `<span class="ml-1 text-xs opacity-80">${escapeHtml(tab.count)}</span>` : ''}
          </button>
        `).join('')}
      </div>
    </section>
  `
}

function getActiveDetailTab(params: URLSearchParams): MaterialPrepDetailTab {
  const value = params.get('detailTab')
  if (value === 'inventory' || value === 'tasks' || value === 'records' || value === 'pickup') return value
  return 'demand'
}

function renderOrderTable(rows: MaterialPrepOrderProjection[], activeTab: MaterialPrepOrderStatus): string {
  return `
    <div class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-base font-semibold">${escapeHtml(categoryLabel)} 配料工作台</h2>
        <span class="text-xs text-muted-foreground">列表只展示待处理对象；点击查看详情后再处理配料记录。</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1180px] text-left text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
              <th class="px-3 py-2">款式 / SPU</th>
              <th class="px-3 py-2">配料进度</th>
              <th class="px-3 py-2">领料状态</th>
              <th class="px-3 py-2">物料行</th>
              <th class="px-3 py-2">库存情况</th>
              <th class="px-3 py-2">缺料与上游</th>
              <th class="px-3 py-2">最近操作</th>
              <th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map((row) => `
              <tr class="border-t">
                <td class="px-3 py-3 align-top">
                  <div class="cursor-pointer hover:underline" data-nav="${escapeHtml(buildDetailHref(row.order.prepOrderId, activeTab))}">${renderProductionOrderIdentityCell(row.order.productionOrderNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">配料单：${escapeHtml(row.order.prepOrderNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">交期：${escapeHtml(row.order.deliveryDate)}</div>
                </td>
                <td class="px-3 py-3 align-top">
                  <div class="flex items-start gap-3">
                    ${renderSpuThumb(row.order)}
                    <div>
                      <div class="font-medium">${escapeHtml(row.order.styleNo)} / ${escapeHtml(row.order.styleName)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.order.spu)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">计划 ${row.order.planQty.toLocaleString('zh-CN')} 件</div>
                    </div>
                  </div>
                </td>
                <td class="px-3 py-3 align-top">
                  ${renderStatus(row.order.overallPrepStatus, materialPrepStatusLabelMap[row.order.overallPrepStatus])}
                  <div class="mt-2 text-xs text-muted-foreground">已确认 ${formatQty(row.totalConfirmedPrepQty)} / 需求 ${formatQty(row.totalRequiredQty)}</div>
                </td>
                <td class="px-3 py-3 align-top">
                  ${renderStatus(row.order.pickupStatus, pickupStatusLabelMap[row.order.pickupStatus])}
                  <div class="mt-2 text-xs text-muted-foreground">已领 ${formatQty(row.totalPickedQty)}，可领 ${formatQty(row.totalAvailableToPickupQty)}</div>
                </td>
                <td class="px-3 py-3 align-top text-xs">
                  <div>物料行：${row.lineCount}</div>
                  <div>已配齐：${row.readyLineCount}</div>
                  <div>未配齐：${row.shortageLineCount}</div>
                  <div>库存充足：${row.stockSufficientLineCount}</div>
                  <div>库存不足：${row.stockInsufficientLineCount}</div>
                  <div>无库存：${row.noStockLineCount}</div>
                  <div>被打回：${row.rejectedRecordCount}</div>
                </td>
                <td class="px-3 py-3 align-top">${renderOrderStockSummary(row)}</td>
                <td class="px-3 py-3 align-top text-xs">
                  <div>缺口：${formatQty(row.totalShortageQty)}</div>
                  <div>最早可配：${escapeHtml(row.earliestExpectedAvailableAt || '暂无')}</div>
                </td>
                <td class="px-3 py-3 align-top text-xs">
                  <div>${escapeHtml(row.latestOperatorName)}</div>
                  <div class="mt-1 text-muted-foreground">${escapeHtml(row.latestOperatedAt || row.order.createdAt)}</div>
                </td>
                <td class="px-3 py-3 align-top">
                  <div class="flex flex-col gap-2">
                    <button type="button" data-nav="${escapeHtml(buildDetailHref(row.order.prepOrderId, activeTab))}" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">查看详情</button>
                    <button type="button" data-nav="${escapeHtml(buildAddPrepRecordHref(row.order.prepOrderId, activeTab))}" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">新增配料记录</button>
                    ${!row.order.isClosed && row.order.overallPrepStatus !== 'READY'
                      ? `<button type="button" data-nav="${escapeHtml(buildClosePrepOrderHref(row.order.prepOrderId, activeTab))}" class="rounded-md border border-rose-200 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50">关闭配料单</button>`
                      : ''}
                  </div>
                </td>
              </tr>
              <tr class="bg-muted/20">
                <td colspan="9" class="px-3 pb-4 pt-0">
                  ${renderOrderMaterialRows(row)}
                </td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="9" class="px-3 py-8 text-center text-sm text-muted-foreground">当前状态下暂无${escapeHtml(categoryLabel)}配料单。</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderProductionDemand(projection: MaterialPrepOrderProjection): string {
  const order = projection.order
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">生产需求信息</h3>
      <div class="mt-3 flex flex-wrap gap-4">
        <div>
          <div class="text-xs text-muted-foreground">款式/SPU 图</div>
          <div class="mt-1">${renderImageThumb(order.spuImageUrl, `${order.styleNo} / ${order.spu} 款式SPU图`, 'h-24 w-24')}</div>
        </div>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
        <div><div class="text-xs text-muted-foreground">生产单</div><div class="font-medium">${escapeHtml(order.productionOrderNo)}</div></div>
        <div><div class="text-xs text-muted-foreground">款式</div><div class="font-medium">${escapeHtml(order.styleNo)} / ${escapeHtml(order.styleName)}</div></div>
        <div><div class="text-xs text-muted-foreground">SPU</div><div class="font-medium">${escapeHtml(order.spu)}</div></div>
        <div><div class="text-xs text-muted-foreground">计划数量</div><div class="font-medium">${order.planQty.toLocaleString('zh-CN')} 件</div></div>
        <div><div class="text-xs text-muted-foreground">客户</div><div class="font-medium">${escapeHtml(order.customerName)}</div></div>
        <div><div class="text-xs text-muted-foreground">交期</div><div class="font-medium">${escapeHtml(order.deliveryDate)}</div></div>
        <div><div class="text-xs text-muted-foreground">创建人</div><div class="font-medium">${escapeHtml(order.creatorName)}</div></div>
        <div><div class="text-xs text-muted-foreground">创建时间</div><div class="font-medium">${escapeHtml(order.createdAt)}</div></div>
      </div>
      ${order.isClosed ? `<div class="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">配料已关闭：${escapeHtml(order.closeReason)} / ${escapeHtml(order.closedAt)}</div>` : ''}
    </section>
  `
}

function renderInventoryProgress(lines: MaterialPrepLine[]): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">当前各仓库存信息与上游进度</h3>
      <div class="mt-3 overflow-x-auto">
        <table class="w-full min-w-[1280px] text-left text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2">图片</th>
              <th class="px-3 py-2">类别</th>
              <th class="px-3 py-2">物料</th>
              <th class="px-3 py-2">关联任务</th>
              <th class="px-3 py-2">需求</th>
              <th class="px-3 py-2">已确认配料</th>
              <th class="px-3 py-2">已领料</th>
              <th class="px-3 py-2">在库仓库</th>
              <th class="px-3 py-2">在库库存</th>
              <th class="px-3 py-2">当前可配</th>
              <th class="px-3 py-2">缺口</th>
              <th class="px-3 py-2">采购/印花/染色进度</th>
            </tr>
          </thead>
          <tbody>
            ${lines.map((line) => `
              <tr class="border-t">
                <td class="px-3 py-3">${renderMaterialThumb(line)}</td>
                <td class="px-3 py-3">${renderBadge(line.materialType, line.materialType === '面料' ? 'info' : line.materialType === '辅料' ? 'warning' : line.materialType === '纱线' ? 'success' : 'neutral')}</td>
                <td class="px-3 py-3">
                  <div class="font-medium">${escapeHtml(line.materialSku)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.materialName)} / ${escapeHtml(line.color)} / ${escapeHtml(line.spec)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">裁片单：${escapeHtml(line.cutOrderNo)}</div>
                </td>
                <td class="px-3 py-3">${renderLineTaskLinks(line)}</td>
                <td class="px-3 py-3">${formatQty(line.requiredQty, line.unit)}</td>
                <td class="px-3 py-3">${formatQty(line.confirmedPrepQty, line.unit)}</td>
                <td class="px-3 py-3">${formatQty(line.pickedQty, line.unit)}</td>
                <td class="px-3 py-3">
                  <div class="font-medium">${escapeHtml(line.stockWarehouseName)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.stockWarehouseArea)} / ${escapeHtml(line.stockLocationCode)}</div>
                </td>
                <td class="px-3 py-3">${formatQty(line.availableStockQty, line.unit)}</td>
                <td class="px-3 py-3">${formatQty(line.canPrepQty, line.unit)}</td>
                <td class="px-3 py-3">${formatQty(line.shortageQty, line.unit)}</td>
                <td class="px-3 py-3">
                  ${renderUpstreamProgress(line)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function summarizeTaskQty(
  materialLines: MaterialPrepOrderProjection['taskProjections'][number]['materialLines'],
  field: 'requiredQty' | 'confirmedPrepQty' | 'pickedQty' | 'remainingNeedQty',
): string {
  return Array.from(
    materialLines.reduce((summary, line) => {
      summary.set(line.unit, Number(summary.get(line.unit) || 0) + Number(line[field] || 0))
      return summary
    }, new Map<string, number>()),
  ).map(([unit, qty]) => formatQty(qty, unit)).join('、') || '0'
}

function renderTaskPrepRecordRefs(
  prepRecords: MaterialPrepOrderProjection['taskProjections'][number]['materialLines'][number]['prepRecords'],
  unit: string,
): string {
  if (!prepRecords.length) {
    return `
      <div class="inline-flex rounded-md border border-dashed bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
        暂无配料记录
      </div>
    `
  }
  return `
    <div class="space-y-2">
      ${prepRecords.map((record) => {
        const statusClass = record.recordStatus === 'CONFIRMED'
          ? 'border-l-green-500 bg-green-50/60'
          : record.recordStatus === 'REJECTED'
            ? 'border-l-rose-500 bg-rose-50/60'
            : record.recordStatus === 'STAGED'
              ? 'border-l-amber-500 bg-amber-50/60'
              : record.recordStatus === 'PICKED'
                ? 'border-l-blue-500 bg-blue-50/60'
                : 'border-l-slate-400 bg-slate-50/60'
        return `
        <div class="min-w-[220px] rounded-md border border-l-4 ${statusClass} px-2.5 py-2 shadow-sm">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-foreground">配料记录号 ${record.recordNo}</span>
            ${renderPrepRecordStatusBadge(record.recordStatus)}
          </div>
          <div class="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>本次配料：<strong class="font-medium text-foreground">${formatQty(record.preparedQty, unit)}</strong></span>
            <span>卷/件数：<strong class="font-medium text-foreground">${record.rollCount}</strong></span>
          </div>
          <div class="mt-1 truncate text-[11px] text-muted-foreground" title="${escapeHtml(record.prepRecordId)}">记录ID：${escapeHtml(record.prepRecordId)}</div>
        </div>
      `}).join('')}
    </div>
  `
}

function renderTaskPrepOverview(projection: MaterialPrepOrderProjection): string {
  const taskProjections = getCategoryTaskProjections(projection)
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">任务维度配料情况</h3>
      <p class="mt-1 text-sm text-muted-foreground">配料确认后再进入任务分配；这里仅展示已进入${escapeHtml(categoryLabel)}的物料与下游任务回写情况。</p>
      <div class="mt-3 space-y-4">
        ${taskProjections.length ? taskProjections.map((task) => `
          <article class="rounded-md border bg-background">
            <div class="flex flex-wrap items-start justify-between gap-3 border-b px-3 py-3">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium">${escapeHtml(task.taskNo)}</span>
                  ${renderBadge(task.taskType, 'info')}
                  ${renderTaskAssignmentBadge(task)}
                </div>
                <div class="mt-1 text-xs text-muted-foreground">任务：${escapeHtml(task.taskName)} / 任务工厂：${task.allocationStatus === '已分配' ? escapeHtml(task.factoryName || '工厂未命名') : '待分配后确定'} / 分配时间：${task.allocationStatus === '已分配' ? escapeHtml(task.assignedAt || '分配时间未记录') : '任务未分配'}</div>
              </div>
              <div class="grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
                <div>物料：${task.materialCount} 行</div>
                <div>需要：${escapeHtml(summarizeTaskQty(task.materialLines, 'requiredQty'))}</div>
                <div>已配：${escapeHtml(summarizeTaskQty(task.materialLines, 'confirmedPrepQty'))}</div>
                <div>已领：${escapeHtml(summarizeTaskQty(task.materialLines, 'pickedQty'))}</div>
              </div>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[1180px] text-left text-sm">
                <thead class="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2">图片</th>
                    <th class="px-3 py-2">物料</th>
                    <th class="px-3 py-2">需要多少</th>
                    <th class="px-3 py-2">配了多少</th>
                    <th class="px-3 py-2">领了多少</th>
                    <th class="px-3 py-2">剩余未配</th>
                    <th class="px-3 py-2">配料记录</th>
                    <th class="px-3 py-2">领料记录</th>
                    <th class="px-3 py-2">配料状态</th>
                  </tr>
                </thead>
                <tbody>
                  ${task.materialLines.map((line) => `
                    <tr class="border-t">
                      <td class="px-3 py-3">${renderImageThumb(line.materialImageUrl, line.materialName)}</td>
                      <td class="px-3 py-3">
                        <div class="font-medium">${escapeHtml(line.materialSku)}</div>
                        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.materialName)} / ${escapeHtml(line.color)} / ${escapeHtml(line.spec)}</div>
                      </td>
                      <td class="px-3 py-3">${formatQty(line.requiredQty, line.unit)}</td>
                      <td class="px-3 py-3">${formatQty(line.confirmedPrepQty, line.unit)}</td>
                      <td class="px-3 py-3">${formatQty(line.pickedQty, line.unit)}</td>
                      <td class="px-3 py-3">${formatQty(line.remainingNeedQty, line.unit)}</td>
                      <td class="px-3 py-3">${renderTaskPrepRecordRefs(line.prepRecords, line.unit)}</td>
                      <td class="px-3 py-3">${line.pickupRecordCount} 条</td>
                      <td class="px-3 py-3">${renderBadge(line.linePrepStatus, line.linePrepStatus === '已配齐' ? 'success' : line.linePrepStatus === '被打回' ? 'danger' : line.linePrepStatus === '按实关闭' ? 'neutral' : 'warning')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </article>
        `).join('') : '<div class="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">配料记录确认后，才显示任务维度配料情况和任务分配入口。</div>'}
      </div>
    </section>
  `
}

function renderPrepRecordSourceCell(
  item: ReturnType<typeof getMaterialPrepRecordItems>[number],
  line?: MaterialPrepLine,
): string {
  const warehouseName = item.stockWarehouseName || line?.stockWarehouseName || '-'
  const warehouseArea = item.warehouseArea || item.stockWarehouseArea || line?.stockWarehouseArea || '-'
  const locationCode = item.locationCode || item.stockLocationCode || line?.stockLocationCode || '-'
  const sourceType = line?.upstreamSourceType || '库存配料'
  return `
    <div class="font-medium">${escapeHtml(warehouseName)}</div>
    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(warehouseArea)} / ${escapeHtml(locationCode)}</div>
    <div class="mt-1 text-xs text-muted-foreground">配料来源：${escapeHtml(sourceType)}</div>
  `
}

function renderPrepRecords(
  records: MaterialPrepRecord[],
  lines: MaterialPrepLine[],
  addHref: string,
  buildContinueHref: (record: MaterialPrepRecord) => string,
): string {
  const lineById = new Map(lines.map((line) => [line.prepLineId, line]))
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-base font-semibold">配料记录</h3>
        <button type="button" data-nav="${escapeHtml(addHref)}" class="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white">新增配料记录</button>
      </div>
      <div class="mt-2 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        配料记录按 DRAFT → PICKED → STAGED → CONFIRMED 流转；打回后可从 STAGED 重新确认；已确认的配料可被裁床领料；每条记录整体确认，记录内物料明细不单独确认。
      </div>
      <div class="mt-3 space-y-3">
        ${records.length ? records.map((record, recordIndex) => {
          const recordItems = getMaterialPrepRecordItems(record)
          const statusLabel = materialPrepRecordStatusLabelMap[record.recordStatus]
          const statusVariant: BadgeVariant = record.recordStatus === 'CONFIRMED' ? 'success' : record.recordStatus === 'REJECTED' ? 'danger' : record.recordStatus === 'STAGED' ? 'warning' : record.recordStatus === 'PICKED' ? 'info' : 'neutral'
          const totalRollCount = recordItems.reduce((sum, item) => sum + Number(item.rollCount || 0), 0)
          const recordNo = recordIndex + 1
          return `
            <article class="rounded-md border bg-background">
              <div class="flex flex-wrap items-start justify-between gap-3 border-b px-3 py-3">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-medium">配料记录号：${recordNo}</span>
                    ${renderBadge(statusLabel, statusVariant)}
                  </div>
                  <div class="mt-1 text-xs text-muted-foreground">批次号：${escapeHtml(record.batchNo)} / ${escapeHtml(record.preparedAt)} / ${escapeHtml(record.operatorName)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">
                    合计：${formatQty(record.preparedQty)} / ${record.rollCount} 卷 / ${escapeHtml(record.warehouseArea)} / ${escapeHtml(record.locationCode)}
                  </div>
                  ${record.stagingArea ? `<div class="mt-0.5 text-xs text-muted-foreground">暂存区：${escapeHtml(record.stagingArea)}</div>` : ''}
                  ${record.rejectReason ? `<div class="mt-1 text-xs text-rose-600">打回原因：${escapeHtml(record.rejectReason)}</div>` : ''}
                  ${record.remark ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.remark)}</div>` : ''}
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  ${renderPrepRecordActions(record)}
                </div>
              </div>
              ${recordItems.length > 0 ? `
                <div class="px-3 py-3">
                  <div class="mb-2 text-xs font-medium text-muted-foreground">记录内物料明细（${recordItems.length} 行 / ${totalRollCount} 卷）</div>
                  <div class="overflow-x-auto">
                    <table class="w-full min-w-[1000px] text-left text-sm">
                      <thead class="bg-muted/60 text-xs text-muted-foreground">
                        <tr>
                          <th class="px-3 py-2">图片</th>
                          <th class="px-3 py-2">类别</th>
                          <th class="px-3 py-2">物料</th>
                          <th class="px-3 py-2">关联任务</th>
                          <th class="px-3 py-2">数量</th>
                          <th class="px-3 py-2">配料来源</th>
                          <th class="px-3 py-2">当前在库</th>
                          <th class="px-3 py-2">明细备注</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${recordItems.map((item) => {
                          const line = lineById.get(item.prepLineId)
                          return `
                            <tr class="border-t">
                              <td class="px-3 py-3">${line ? renderMaterialThumb(line) : ''}</td>
                              <td class="px-3 py-3">${line ? renderBadge(line.materialType, line.materialType === '面料' ? 'info' : line.materialType === '辅料' ? 'warning' : line.materialType === '纱线' ? 'success' : 'neutral') : '-'}</td>
                              <td class="px-3 py-3">
                                <div class="font-medium">${escapeHtml(line?.materialSku || item.prepLineId)}</div>
                                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line ? `${line.materialName} / ${line.color} / ${line.cutOrderNo}` : '')}</div>
                              </td>
                              <td class="px-3 py-3">${line ? renderLineTaskLinks(line) : '-'}</td>
                              <td class="px-3 py-3">${formatQty(item.preparedQty, line?.unit || 'yard')} / ${item.rollCount} 卷</td>
                              <td class="px-3 py-3">${renderPrepRecordSourceCell(item, line)}</td>
                              <td class="px-3 py-3 text-xs text-muted-foreground">${line ? formatQty(item.stockAvailableQty || line.availableStockQty, line.unit) : '-'}</td>
                              <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(item.remark || '随整条配料记录确认')}</td>
                            </tr>
                          `
                        }).join('')}
                      </tbody>
                    </table>
                  </div>
                  <div class="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                    <div>确认记录：${escapeHtml(record.confirmedAt || '未确认')} ${escapeHtml(record.confirmedBy)}</div>
                    <div class="text-rose-600">打回记录：${escapeHtml(record.rejectReason || '无')}</div>
                  </div>
                </div>
              ` : `<div class="px-3 pb-4 pt-0 text-xs text-muted-foreground">暂无物料明细。</div>`}
            </article>
          `
        }).join('') : '<div class="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">暂无配料记录。</div>'}
      </div>
    </section>
  `
}

function renderPickupRecords(records: PickupRecord[], rejectRecords: PrepRejectRecord[]): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">与配料记录关联的领料记录</h3>
      <div class="mt-3 grid gap-3 lg:grid-cols-2">
        <div class="rounded-md border">
          <div class="border-b px-3 py-2 text-sm font-medium">领料记录</div>
          <div class="divide-y">
            ${records.length ? records.map((record) => `
              <div class="px-3 py-3 text-sm">
                <div class="font-medium">${escapeHtml(record.pickupRecordId)}</div>
                <div class="mt-1 text-xs text-muted-foreground">配料记录：${escapeHtml(record.prepRecordId)}</div>
                <div class="mt-1 text-xs text-muted-foreground">领料：${formatQty(record.pickedQty)} / ${record.rollCount} 卷 / ${escapeHtml(record.receiverName)} / ${escapeHtml(record.pickedAt)}</div>
                <div class="mt-1 text-xs text-muted-foreground">入库：${escapeHtml(record.warehouseArea)} / ${escapeHtml(record.locationCode)}</div>
                ${record.differenceReason ? `<div class="mt-1 text-xs text-amber-700">差异：${escapeHtml(record.differenceReason)}</div>` : ''}
              </div>
            `).join('') : '<div class="px-3 py-4 text-sm text-muted-foreground">暂无领料记录。</div>'}
          </div>
        </div>
        <div class="rounded-md border">
          <div class="border-b px-3 py-2 text-sm font-medium">打回记录</div>
          <div class="divide-y">
            ${rejectRecords.length ? rejectRecords.map((record) => `
              <div class="px-3 py-3 text-sm">
                <div class="font-medium text-rose-700">${escapeHtml(record.rejectReason)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.rejectDetail)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.rejectedBy)} / ${escapeHtml(record.rejectedAt)}</div>
              </div>
            `).join('') : '<div class="px-3 py-4 text-sm text-muted-foreground">暂无打回记录。</div>'}
          </div>
        </div>
      </div>
    </section>
  `
}

function getPrepRecordNumber(projection: MaterialPrepOrderProjection, recordId?: string): number {
  if (!recordId) return projection.prepRecords.length + 1
  const index = projection.prepRecords.findIndex((record) => record.prepRecordId === recordId)
  return index >= 0 ? index + 1 : projection.prepRecords.length + 1
}

function renderPrepLineMetric(label: string, value: string): string {
  return `
    <div class="rounded-md bg-background px-2.5 py-2">
      <div class="text-[11px] text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-0.5 text-sm font-medium">${escapeHtml(value)}</div>
    </div>
  `
}

function renderPrepMaterialInputCard(line: MaterialPrepLine): string {
  return `
    <article class="p-3" data-fcs-prep-line-card data-prep-line-id="${escapeHtml(line.prepLineId)}">
      <div class="grid gap-3 lg:grid-cols-[minmax(280px,1.45fr)_minmax(260px,1fr)_minmax(240px,0.95fr)]">
        <div class="flex min-w-0 items-start gap-3">
          ${renderMaterialThumb(line)}
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <div class="break-all font-medium">${escapeHtml(line.materialSku)}</div>
              ${renderBadge(line.materialType, line.materialType === '面料' ? 'info' : line.materialType === '辅料' ? 'warning' : line.materialType === '纱线' ? 'success' : 'neutral')}
            </div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.materialName)} / ${escapeHtml(line.color)} / ${escapeHtml(line.spec)}</div>
            <div class="mt-1 text-xs text-muted-foreground">裁片单：${escapeHtml(line.cutOrderNo)}</div>
            <div class="mt-1">${renderLineTaskLinks(line)}</div>
          </div>
        </div>

        <div>
          <div class="text-xs font-medium text-muted-foreground">配料进度</div>
          <div class="mt-2 grid grid-cols-2 gap-2">
            ${renderPrepLineMetric('需求', formatQty(line.requiredQty, line.unit))}
            ${renderPrepLineMetric('已确认', formatQty(line.confirmedPrepQty, line.unit))}
            ${renderPrepLineMetric('已领料', formatQty(line.pickedQty, line.unit))}
            ${renderPrepLineMetric('剩余未配', formatQty(line.remainingNeedQty, line.unit))}
          </div>
        </div>

        <div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-medium text-muted-foreground">可配情况</span>
            ${renderNeedPrepState(line)}
          </div>
          <div class="mt-2 rounded-md bg-background px-2.5 py-2 text-sm">
            <div>当前可配：<span class="font-medium">${formatQty(line.canPrepQty, line.unit)}</span></div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.stockWarehouseName)} / ${escapeHtml(line.stockWarehouseArea)} / ${escapeHtml(line.stockLocationCode)}</div>
            <div class="mt-1 text-xs text-muted-foreground">在库：${formatQty(line.availableStockQty, line.unit)}</div>
          </div>
        </div>
      </div>

      <div class="mt-3 rounded-md border bg-muted/20 px-3 py-3">
        <div class="mb-2 text-xs font-medium text-muted-foreground">配料操作</div>
        <div class="flex flex-wrap items-end gap-3">
          <label class="space-y-1">
            <span class="block text-xs text-muted-foreground">本次数量</span>
            <div class="flex items-center gap-1.5">
              <input data-fcs-prep-line-qty class="h-9 w-32 rounded-md border bg-background px-2 text-sm" value="0" />
              <span class="text-xs text-muted-foreground">${escapeHtml(line.unit)}</span>
            </div>
          </label>
          <label class="space-y-1">
            <span class="block text-xs text-muted-foreground">卷/件数</span>
            <input data-fcs-prep-line-count class="h-9 w-24 rounded-md border bg-background px-2 text-sm" value="0" />
          </label>
          <div class="flex flex-wrap gap-2 pb-0.5">
            <button
              type="button"
              data-fcs-material-prep-action="fill-current-prep"
              data-current-prep-qty="${escapeHtml(String(line.canPrepQty || 0))}"
              onclick="const card=this.closest('[data-fcs-prep-line-card]'); const input=card&&card.querySelector('[data-fcs-prep-line-qty]'); if(input) input.value=this.dataset.currentPrepQty || '0';"
              class="rounded-md border border-blue-200 px-3 py-2 text-xs text-blue-700 hover:bg-blue-50"
            >填当前可配</button>
            <button
              type="button"
              data-fcs-material-prep-action="clear-prep-line"
              onclick="const card=this.closest('[data-fcs-prep-line-card]'); const qty=card&&card.querySelector('[data-fcs-prep-line-qty]'); const count=card&&card.querySelector('[data-fcs-prep-line-count]'); if(qty) qty.value='0'; if(count) count.value='0';"
              class="rounded-md border px-3 py-2 text-xs hover:bg-background"
            >清零</button>
          </div>
        </div>
      </div>
    </article>
  `
}

function renderPrepMaterialInputTable(projection: MaterialPrepOrderProjection): string {
  const materialLines = getCategoryLines(projection)
  return `
    <div class="mt-4 rounded-md border">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div class="text-sm font-medium">裁片纸样关联物料</div>
        <div class="text-xs text-muted-foreground">只填写进入${escapeHtml(categoryLabel)}的物料；确认后再开放任务分配。</div>
      </div>
      <div class="divide-y">
        ${materialLines.map(renderPrepMaterialInputCard).join('')}
      </div>
    </div>
  `
}

function renderAddPrepRecordModal(projection: MaterialPrepOrderProjection, activeTab: MaterialPrepDetailTab): string {
  const closeHref = buildDetailStateHref(projection, { detailTab: activeTab })
  const materialLines = getCategoryLines(projection)
  const needPrepCount = materialLines.filter((line) => line.remainingNeedQty > 0).length
  const nextRecordNumber = getPrepRecordNumber(projection)
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <section class="max-h-[88vh] w-full max-w-7xl overflow-hidden rounded-lg bg-background shadow-xl">
        <div class="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 class="text-lg font-semibold">新增配料记录</h2>
            <p class="mt-1 text-sm text-muted-foreground">默认展示${escapeHtml(categoryLabel)} ${materialLines.length} 行物料，其中 ${needPrepCount} 行仍需配料；配料确认后再分配任务。</p>
          </div>
          <button type="button" data-nav="${escapeHtml(closeHref)}" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">关闭</button>
        </div>
        <div class="max-h-[calc(88vh-72px)] overflow-y-auto p-5">
          <div class="grid gap-3 md:grid-cols-4">
            <label class="space-y-1 text-xs text-muted-foreground">
              <span>配料记录号</span>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground" value="${nextRecordNumber}" />
            </label>
            <label class="space-y-1 text-xs text-muted-foreground">
              <span>配料人</span>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground" value="${escapeHtml(projection.order.creatorName)}" />
            </label>
            <label class="space-y-1 text-xs text-muted-foreground">
              <span>配料时间</span>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground" value="2026-03-16 14:30" />
            </label>
            <label class="space-y-1 text-xs text-muted-foreground">
              <span>记录状态</span>
              <input class="h-9 w-full rounded-md border bg-muted px-3 text-sm text-muted-foreground" value="待拣货" readonly />
            </label>
          </div>

          ${renderPrepMaterialInputTable(projection)}

          <label class="mt-4 block space-y-1 text-xs text-muted-foreground">
            <span>备注</span>
            <textarea class="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground">按当前可配库存新增配料记录，待复核后确认整条记录。</textarea>
          </label>

          <div class="mt-5 flex justify-end gap-2">
            <button type="button" data-nav="${escapeHtml(closeHref)}" class="rounded-md border px-4 py-2 text-sm hover:bg-muted">取消</button>
            <button type="button" data-fcs-material-prep-action="create-prep-record" data-prep-order-id="${escapeHtml(projection.order.prepOrderId)}" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">保存为待拣货记录</button>
          </div>
        </div>
      </section>
    </div>
  `
}

function renderContinuePrepRecordModal(
  projection: MaterialPrepOrderProjection,
  activeTab: MaterialPrepDetailTab,
  prepRecordId: string,
): string {
  const closeHref = buildDetailStateHref(projection, { detailTab: activeTab })
  const record = projection.prepRecords.find((item) => item.prepRecordId === prepRecordId)
  if (!record) return ''
  const recordNumber = getPrepRecordNumber(projection, record.prepRecordId)
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <section class="max-h-[88vh] w-full max-w-7xl overflow-hidden rounded-lg bg-background shadow-xl">
        <div class="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 class="text-lg font-semibold">新增配料</h2>
            <p class="mt-1 text-sm text-muted-foreground">继续补充配料记录号 ${recordNumber}；只填写本次新增的物料数量，保存后仍归入这条待拣货配料记录。</p>
          </div>
          <button type="button" data-nav="${escapeHtml(closeHref)}" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">关闭</button>
        </div>
        <div class="max-h-[calc(88vh-72px)] overflow-y-auto p-5">
          ${renderPrepMaterialInputTable(projection)}
          <div class="mt-5 flex justify-end gap-2">
            <button type="button" data-nav="${escapeHtml(closeHref)}" class="rounded-md border px-4 py-2 text-sm hover:bg-muted">取消</button>
            <button type="button" data-nav="${escapeHtml(closeHref)}" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">保存本次新增配料</button>
          </div>
        </div>
      </section>
    </div>
  `
}

function renderClosePrepOrderModal(projection: MaterialPrepOrderProjection, activeTab: MaterialPrepDetailTab): string {
  const closeHref = buildDetailStateHref(projection, { detailTab: activeTab })
  const gapLines = getCategoryLines(projection).filter((line) => line.remainingNeedQty > 0)
  const gapSummary = Array.from(
    gapLines.reduce((summary, line) => {
      summary.set(line.unit, Number(summary.get(line.unit) || 0) + Number(line.remainingNeedQty || 0))
      return summary
    }, new Map<string, number>()),
  ).map(([unit, qty]) => formatQty(qty, unit)).join('、') || '无缺口'
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <section class="max-h-[88vh] w-full max-w-6xl overflow-hidden rounded-lg bg-background shadow-xl" data-fcs-close-modal>
        <div class="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 class="text-lg font-semibold">关闭配料单二次确认</h2>
            <p class="mt-1 text-sm text-muted-foreground">关闭后该配料单进入已关闭，后续不再配料；领料端按已领/已确认数量按实完结。</p>
          </div>
          <button type="button" data-nav="${escapeHtml(closeHref)}" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">取消</button>
        </div>
        <div class="max-h-[calc(88vh-76px)] overflow-y-auto p-5">
          <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            当前仍有 ${gapLines.length} 行缺口物料，按单位汇总缺口：${escapeHtml(gapSummary)}。请确认这些物料后续不再配料。
          </div>
          <div class="mt-4 rounded-md border">
            <div class="border-b px-3 py-2 text-sm font-medium">缺口物料</div>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[1160px] text-left text-sm">
                <thead class="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2">图片</th>
                    <th class="px-3 py-2">类别</th>
                    <th class="px-3 py-2">物料</th>
                    <th class="px-3 py-2">关联任务</th>
                    <th class="px-3 py-2">需求数量</th>
                    <th class="px-3 py-2">已确认配料</th>
                    <th class="px-3 py-2">缺口</th>
                    <th class="px-3 py-2">当前库存</th>
                    <th class="px-3 py-2">上游进度</th>
                  </tr>
                </thead>
                <tbody>
                  ${gapLines.map((line) => `
                    <tr class="border-t">
                      <td class="px-3 py-3">${renderMaterialThumb(line)}</td>
                      <td class="px-3 py-3">${renderBadge(line.materialType, line.materialType === '面料' ? 'info' : line.materialType === '辅料' ? 'warning' : line.materialType === '纱线' ? 'success' : 'neutral')}</td>
                      <td class="px-3 py-3">
                        <div class="font-medium">${escapeHtml(line.materialSku)}</div>
                        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.materialName)} / ${escapeHtml(line.color)} / ${escapeHtml(line.spec)}</div>
                        <div class="mt-1 text-xs text-muted-foreground">裁片单：${escapeHtml(line.cutOrderNo)}</div>
                      </td>
                      <td class="px-3 py-3">${renderLineTaskLinks(line)}</td>
                      <td class="px-3 py-3">${formatQty(line.requiredQty, line.unit)}</td>
                      <td class="px-3 py-3">${formatQty(line.confirmedPrepQty, line.unit)}</td>
                      <td class="px-3 py-3 font-medium text-rose-700">${formatQty(line.remainingNeedQty, line.unit)}</td>
                      <td class="px-3 py-3">${formatQty(line.availableStockQty, line.unit)}</td>
                      <td class="px-3 py-3">
                        ${renderUpstreamProgress(line)}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <label class="mt-4 block space-y-1 text-xs text-muted-foreground">
            <span>关闭原因（必填）</span>
            <textarea data-fcs-close-reason class="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground">后续不再配，按当前已配/已领数量关闭</textarea>
          </label>
          <div class="mt-5 flex justify-end gap-2">
            <button type="button" data-nav="${escapeHtml(closeHref)}" class="rounded-md border px-4 py-2 text-sm hover:bg-muted">取消</button>
            <button type="button" data-fcs-material-prep-action="close-order" data-prep-order-id="${escapeHtml(projection.order.prepOrderId)}" class="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white">确认关闭配料单</button>
          </div>
        </div>
      </section>
    </div>
  `
}

function renderDetail(projection: MaterialPrepOrderProjection, activeTab: MaterialPrepDetailTab): string {
  const materialLines = getCategoryLines(projection)
  const prepRecords = getCategoryPrepRecords(projection)
  const lineIds = getCategoryLineIds(projection)
  const content = activeTab === 'inventory'
    ? renderInventoryProgress(materialLines)
    : activeTab === 'tasks'
      ? renderTaskPrepOverview(projection)
    : activeTab === 'records'
      ? renderPrepRecords(
          prepRecords,
          materialLines,
          buildDetailStateHref(projection, { detailTab: 'records', prepModal: true }),
          (record) => buildDetailStateHref(projection, { detailTab: 'records', continuePrepRecordId: record.prepRecordId }),
        )
    : activeTab === 'pickup'
        ? renderPickupRecords(
            projection.pickupRecords.filter((record) => lineIds.has(record.prepLineId)),
            projection.rejectRecords.filter((record) => lineIds.has(record.prepLineId)),
          )
        : renderProductionDemand(projection)
  return `
    <div class="space-y-4">
      ${renderDetailTabs(projection, activeTab)}
      ${content}
    </div>
  `
}

export function renderFcsCuttingPrepPage(): string {
  const params = getSearchParams()
  const activeOrderId = params.get('prepOrderId')
  if (activeOrderId) {
    const allRows = filterOrders()
    const projection = getMaterialPrepOrderProjection(activeOrderId) || allRows[0]
    const backTab = normalizeMaterialPrepStatus(params.get('fromTab') || projection?.order.overallPrepStatus)
    const backHref = buildHref({ tab: backTab, prepOrderId: undefined, fromTab: undefined })
    const activeDetailTab = getActiveDetailTab(params)
    const showPrepModal = params.get('prepModal') === '1'
    const continuePrepRecordId = params.get('continuePrepRecordId') || ''
    const showCloseModal = params.get('closeModal') === '1'

    if (!projection) {
      return `
        <div class="space-y-5 p-6">
          <header class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="text-sm text-muted-foreground">生产协同系统 / 配料管理 / ${escapeHtml(categoryLabel)}</div>
              <h1 class="mt-1 text-2xl font-bold">配料详情</h1>
            </div>
            <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(backHref)}">返回配料列表</button>
          </header>
          <section class="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">未找到配料单。</section>
        </div>
      `
    }

    return `
      <div class="space-y-5 p-6">
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="text-sm text-muted-foreground">生产协同系统 / 配料管理 / ${escapeHtml(categoryLabel)}</div>
            <h1 class="mt-1 text-2xl font-bold">配料详情</h1>
            <p class="mt-2 text-sm text-muted-foreground">生产单 ${escapeHtml(projection.order.productionOrderNo)} / 配料单 ${escapeHtml(projection.order.prepOrderNo)}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(backHref)}">返回配料列表</button>
            ${!projection.order.isClosed && projection.order.overallPrepStatus !== 'READY'
              ? `<button type="button" class="rounded-md border border-rose-200 px-4 py-2 text-sm text-rose-700 hover:bg-rose-50" data-nav="${escapeHtml(buildDetailStateHref(projection, { detailTab: activeDetailTab, closeModal: true }))}">关闭配料单</button>`
              : ''}
          </div>
        </header>

        <section class="grid gap-3 md:grid-cols-4">
          ${renderKpi('配料状态', materialPrepStatusLabelMap[projection.order.overallPrepStatus], `已确认 ${formatQty(projection.totalConfirmedPrepQty)} / 需求 ${formatQty(projection.totalRequiredQty)}`)}
          ${renderKpi('领料状态', pickupStatusLabelMap[projection.order.pickupStatus], `已领 ${formatQty(projection.totalPickedQty)} / 可领 ${formatQty(projection.totalAvailableToPickupQty)}`)}
          ${renderKpi('物料行', `${projection.readyLineCount}/${projection.lineCount}`, `未配齐 ${projection.shortageLineCount} 行，库存充足 ${projection.stockSufficientLineCount} 行，库存不足 ${projection.stockInsufficientLineCount} 行，无库存 ${projection.noStockLineCount} 行`)}
          ${renderKpi('缺料缺口', formatQty(projection.totalShortageQty), `最早可配 ${escapeHtml(projection.earliestExpectedAvailableAt || '暂无')}`)}
        </section>

        ${renderImplementationStatus(projection)}
        ${renderDetail(projection, activeDetailTab)}
        ${showPrepModal ? renderAddPrepRecordModal(projection, activeDetailTab) : ''}
        ${continuePrepRecordId ? renderContinuePrepRecordModal(projection, activeDetailTab, continuePrepRecordId) : ''}
        ${showCloseModal && !projection.order.isClosed ? renderClosePrepOrderModal(projection, activeDetailTab) : ''}
      </div>
    `
  }

  const activeTab = normalizeMaterialPrepStatus(params.get('tab'))
  const keyword = params.get('keyword') || ''
  const allRows = filterOrders()
  const keywordFiltered = filterByKeyword(allRows, keyword)
  const rows = keywordFiltered.filter((row) => row.order.overallPrepStatus === activeTab)

  return `
    <div class="space-y-5 p-6">
      <header>
        <div>
          <div class="text-sm text-muted-foreground">生产协同系统 / 配料管理</div>
          <h1 class="mt-1 text-2xl font-bold">${escapeHtml(categoryLabel)}</h1>
          <p class="mt-2 text-sm text-muted-foreground">按生产单组织${escapeHtml(categoryLabel)}配料，让配料人员知道哪些无库存可配、哪些部分有库存可配、哪些全部都有充足库存、哪些被打回重配、哪些已配齐。</p>
        </div>
      </header>

      ${renderSearchBar(keyword)}
      ${renderTabs(keywordFiltered, activeTab)}
      ${renderOrderTable(rows, activeTab)}
    </div>
  `
}

export function handleFcsCuttingPrepEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-fcs-material-prep-action]')
  const action = actionNode?.dataset.fcsMaterialPrepAction
  if (!actionNode || !action) return false

  if (action === 'search-apply') {
    const input = document.querySelector<HTMLInputElement>('[data-fcs-material-prep-action="search-input"]')
    const keyword = input?.value.trim() || ''
    const params = getSearchParams()
    if (keyword) {
      params.set('keyword', keyword)
    } else {
      params.delete('keyword')
    }
    params.delete('prepOrderId')
    params.delete('detailTab')
    const query = params.toString()
    window.history.pushState({}, '', `${pageBasePath}${query ? `?${query}` : ''}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
    return true
  }

  if (action === 'adjust-upstream-doc') {
    const docNo = actionNode.dataset.upstreamDocumentNo || ''
    const docTitle = actionNode.dataset.upstreamDocumentTitle || '上游单据'
    window.alert(`打开${docTitle}调整：${docNo}`)
    return true
  }

  if (action === 'pick-record') {
    const prepRecordId = actionNode.dataset.prepRecordId || ''
    if (!prepRecordId) return false
    pickMaterialPrepRecord(prepRecordId, '仓库 张三')
    window.dispatchEvent(new PopStateEvent('popstate'))
    return true
  }

  if (action === 'fill-current-prep' || action === 'clear-prep-line') {
    const card = actionNode.closest<HTMLElement>('[data-fcs-prep-line-card]')
    const qtyInput = card?.querySelector<HTMLInputElement>('[data-fcs-prep-line-qty]')
    const countInput = card?.querySelector<HTMLInputElement>('[data-fcs-prep-line-count]')
    if (!qtyInput || !countInput) return false
    qtyInput.value = action === 'fill-current-prep' ? actionNode.dataset.currentPrepQty || '0' : '0'
    if (action === 'clear-prep-line') countInput.value = '0'
    return true
  }

  if (action === 'create-prep-record') {
    const prepOrderId = actionNode.dataset.prepOrderId || ''
    if (!prepOrderId) return false
    const record = appendAutoPrepRecordForOrder(prepOrderId, '配料小组 周敏', undefined, categoryLabel)
    if (!record) {
      window.alert('当前配料单没有可配库存，无法新增配料记录。')
      return true
    }
    const params = getSearchParams()
    params.delete('prepModal')
    params.delete('continuePrepRecordId')
    params.set('detailTab', 'records')
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
    return true
  }

  if (action === 'stage-record') {
    const prepRecordId = actionNode.dataset.prepRecordId || ''
    if (!prepRecordId) return false
    const area = window.prompt('请输入暂存区域名称：', '中转仓暂存区 A')
    if (area === null) return true
    stageMaterialPrepRecord(prepRecordId, area || '中转仓暂存区', '配料小组 周敏')
    window.dispatchEvent(new PopStateEvent('popstate'))
    return true
  }

  if (action === 'confirm-record') {
    const prepRecordId = actionNode.dataset.prepRecordId || ''
    if (!prepRecordId) return false
    confirmMaterialPrepRecord(prepRecordId, '配料小组 周敏')
    window.dispatchEvent(new PopStateEvent('popstate'))
    return true
  }

  if (action === 'close-order') {
    const prepOrderId = actionNode.dataset.prepOrderId || ''
    const modal = actionNode.closest<HTMLElement>('[data-fcs-close-modal]')
    const reasonInput = modal?.querySelector<HTMLTextAreaElement>('[data-fcs-close-reason]')
    const closeReason = reasonInput?.value.trim() || ''
    if (!prepOrderId) return false
    if (!closeReason) {
      window.alert('请填写关闭原因。')
      return true
    }
    closeMaterialPrepOrder(prepOrderId, closeReason, '中转仓 周敏')
    const params = getSearchParams()
    params.delete('closeModal')
    const query = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
    return true
  }

  return false
}
