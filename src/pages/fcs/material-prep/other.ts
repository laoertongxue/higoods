import { renderBadge } from '../../../components/ui/badge.ts'
import type { BadgeVariant } from '../../../components/ui/types.ts'
import {
  appendAutoPrepRecordForOrder,
  closeMaterialPrepOrder,
  listMaterialPrepOrderProjections,
  classifyPrepLineType,
  pickMaterialPrepRecord,
  stageMaterialPrepRecord,
  confirmMaterialPrepRecord,
  getMaterialPrepRecordItems,
  getMaterialPrepOrderProjection,
  materialPrepStatusLabelMap,
  materialPrepRecordStatusLabelMap,
  pickupStatusLabelMap,
  materialPrepWorkbenchTabs,
  type MaterialPrepOrderProjection,
  type MaterialPrepOrderStatus,
  type MaterialPrepLine,
  type MaterialPrepRecord,
  type MaterialPrepRecordStatus,
} from '../../../data/fcs/cutting/production-material-prep.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
  renderProductionObjectCodeButton,
} from '../../../data/fcs/production-order-identity.ts'
import {
  formatMaterialPrepPickupByUnit,
  formatMaterialPrepProgressByUnit,
  formatMaterialPrepUnitMetric,
  renderMaterialPrepOrderCodeButton,
  renderMaterialPrepRecordCodeButton,
  renderMaterialPickupRecordCodeButton,
} from './shared.ts'
import { escapeHtml } from '../../../utils.ts'

type MaterialPrepDetailTab = 'demand' | 'inventory' | 'tasks' | 'records' | 'pickup'

const statusVariantMap: Record<string, BadgeVariant> = {
  NEED_PREP_NO_STOCK: 'warning',
  NEED_PREP_PARTIAL_STOCK: 'info',
  NEED_PREP_ALL_STOCK: 'success',
  REJECTED_REWORK: 'danger',
  READY: 'success',
  CLOSED: 'neutral',
}

const recordStatusClassMap: Record<MaterialPrepRecordStatus, string> = {
  DRAFT: 'border-l-slate-400 bg-slate-50/60',
  PICKED: 'border-l-blue-500 bg-blue-50/60',
  STAGED: 'border-l-amber-500 bg-amber-50/60',
  CONFIRMED: 'border-l-green-500 bg-green-50/60',
  REJECTED: 'border-l-rose-500 bg-rose-50/60',
}

const categoryLabel = '其他配料'
const pageBasePath = '/fcs/material-prep/other'

function filterOrders(): MaterialPrepOrderProjection[] {
  return listMaterialPrepOrderProjections().filter(p =>
    p.lines.some(l => classifyPrepLineType(l) === categoryLabel)
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

function buildDetailStateHref(
  projection: MaterialPrepOrderProjection,
  options: {
    detailTab?: MaterialPrepDetailTab
  } = {},
): string {
  const params = new URLSearchParams()
  params.set('prepOrderId', projection.order.prepOrderId)
  if (options.detailTab) params.set('detailTab', options.detailTab)
  const fromTab = getSearchParams().get('fromTab')
  if (fromTab) params.set('fromTab', fromTab)
  const keyword = getSearchParams().get('keyword')
  if (keyword) params.set('keyword', keyword)
  return `${pageBasePath}?${params.toString()}`
}

function buildPrepModalHref(projection: MaterialPrepOrderProjection): string {
  const params = new URLSearchParams()
  params.set('prepOrderId', projection.order.prepOrderId)
  params.set('detailTab', 'records')
  params.set('prepModal', '1')
  const fromTab = getSearchParams().get('fromTab')
  if (fromTab) params.set('fromTab', fromTab)
  return `${pageBasePath}?${params.toString()}`
}

function buildClosePrepOrderHref(projection: MaterialPrepOrderProjection): string {
  const params = new URLSearchParams(window.location.search)
  params.set('prepOrderId', projection.order.prepOrderId)
  params.set('detailTab', 'inventory')
  params.set('closeModal', '1')
  return `${pageBasePath}?${params.toString()}`
}

function formatQty(value: number, unit = 'yard'): string {
  return `${Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`
}

function renderBadgeForStatus(status: string, label: string): string {
  return renderBadge(label, statusVariantMap[status] || 'neutral')
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

const legacyPrepStatusMap: Record<string, MaterialPrepOrderStatus> = {
  NEED_PREP: 'NEED_PREP_PARTIAL_STOCK',
  CONTINUE_PREP: 'NEED_PREP_PARTIAL_STOCK',
  SHORTAGE_TRACKING: 'NEED_PREP_NO_STOCK',
}

function normalizeMaterialPrepStatus(value: string | null | undefined): MaterialPrepOrderStatus {
  if (value && value in materialPrepStatusLabelMap) return value as MaterialPrepOrderStatus
  return legacyPrepStatusMap[value || ''] || 'NEED_PREP_NO_STOCK'
}

function filterByKeyword(rows: MaterialPrepOrderProjection[], keyword: string): MaterialPrepOrderProjection[] {
  if (!keyword || !keyword.trim()) return rows
  const kw = keyword.trim().toLowerCase()
  return rows.filter(row => {
    const order = row.order
    if (order.productionOrderNo.toLowerCase().includes(kw)) return true
    if (order.styleNo.toLowerCase().includes(kw)) return true
    if (order.styleName.toLowerCase().includes(kw)) return true
    if (order.spu.toLowerCase().includes(kw)) return true
    return row.lines.some(line => line.materialName.toLowerCase().includes(kw))
  })
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

function renderTabs(rows: MaterialPrepOrderProjection[], activeTab: MaterialPrepOrderStatus): string {
  return `
    <div class="flex flex-wrap gap-2">
      ${materialPrepWorkbenchTabs.map((tab) => {
        const count = rows.filter((row) => row.order.overallPrepStatus === tab.key).length
        return `
          <button type="button" data-nav="${escapeHtml(buildHref({ tab: tab.key, prepOrderId: undefined, detailTab: undefined }))}" class="rounded-md border px-3 py-2 text-sm ${tab.key === activeTab ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}">
            ${escapeHtml(tab.label)} <span class="ml-1 text-xs opacity-80">${count}</span>
          </button>
        `
      }).join('')}
    </div>
  `
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
  const availableLines = row.lines.filter((line) => line.availableStockQty > 0).length
  const totalAvailable = row.lines.reduce((sum, line) => sum + Number(line.availableStockQty || 0), 0)
  const warehouses = Array.from(new Set(row.lines.filter((line) => line.availableStockQty > 0).map((line) => line.stockWarehouseName)))
  return `
    <div class="space-y-1 text-xs">
      <div>有库存：${availableLines}/${row.lineCount} 行</div>
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

function renderPrepRecordStatusRow(record: MaterialPrepRecord): string {
  const statusClass = recordStatusClassMap[record.recordStatus] || recordStatusClassMap.DRAFT
  const statusLabel = materialPrepRecordStatusLabelMap[record.recordStatus]

  const recordItems = getMaterialPrepRecordItems(record)
  const totalRollCount = recordItems.reduce((sum, item) => sum + Number(item.rollCount || 0), 0)

  return `
    <div class="rounded-md border border-l-4 ${statusClass} px-3 py-3 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium">${escapeHtml(record.batchNo)}</span>
            ${renderBadge(statusLabel, record.recordStatus === 'CONFIRMED' ? 'success' : record.recordStatus === 'REJECTED' ? 'danger' : record.recordStatus === 'STAGED' ? 'warning' : record.recordStatus === 'PICKED' ? 'info' : 'neutral')}
          </div>
          <div class="mt-1 text-xs text-muted-foreground">
            ${formatQty(record.preparedQty)} / ${record.rollCount} 卷 / ${escapeHtml(record.warehouseArea)} / ${escapeHtml(record.locationCode)}
          </div>
          <div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(record.operatorName)} / ${escapeHtml(record.preparedAt)}</div>
          ${record.stagingArea ? `<div class="mt-0.5 text-xs text-muted-foreground">暂存区：${escapeHtml(record.stagingArea)}</div>` : ''}
          ${record.rejectReason ? `<div class="mt-1 text-xs text-rose-600">打回原因：${escapeHtml(record.rejectReason)}</div>` : ''}
          ${record.remark ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.remark)}</div>` : ''}
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${renderPrepRecordActions(record)}
        </div>
      </div>
      ${recordItems.length > 1 ? `
        <div class="mt-3 border-t pt-2">
          <div class="text-xs font-medium text-muted-foreground">记录内物料明细（${recordItems.length} 行 / ${totalRollCount} 卷）</div>
          <div class="mt-2 grid gap-1">
            ${recordItems.map((item) => `
              <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>${escapeHtml(item.prepLineId)}</span>
                <span>${formatQty(item.preparedQty)}</span>
                <span>${item.rollCount} 卷</span>
                <span>${escapeHtml(item.warehouseArea || record.warehouseArea)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
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
  return `
    <div class="rounded-md border bg-background">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div class="text-sm font-medium">物料配料明细</div>
        <div class="text-xs text-muted-foreground">配料类型：${escapeHtml(categoryLabel)}</div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1200px] text-left text-xs">
          <thead class="bg-muted/60 text-muted-foreground">
            <tr>
              <th class="px-3 py-2">图片</th>
              <th class="px-3 py-2">类别</th>
              <th class="px-3 py-2">物料</th>
              <th class="px-3 py-2">关联任务</th>
              <th class="px-3 py-2">需求</th>
              <th class="px-3 py-2">最大可配</th>
              <th class="px-3 py-2">默认配料</th>
              <th class="px-3 py-2">已配</th>
              <th class="px-3 py-2">已领</th>
              <th class="px-3 py-2">剩余未配</th>
              <th class="px-3 py-2">库存情况</th>
              <th class="px-3 py-2">是否需要配料</th>
              <th class="px-3 py-2">上游进度</th>
            </tr>
          </thead>
          <tbody>
            ${row.lines.map((line) => `
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
                <td class="px-3 py-2">${formatQty(line.pickedQty, line.unit)}</td>
                <td class="px-3 py-2">${formatQty(line.remainingNeedQty, line.unit)}</td>
                <td class="px-3 py-2">${renderLineStockSituation(line)}</td>
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

function renderOrderTable(rows: MaterialPrepOrderProjection[], activeTab: MaterialPrepOrderStatus): string {
  return `
    <div class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-base font-semibold">${escapeHtml(categoryLabel)} 配料工作台</h2>
        <span class="text-xs text-muted-foreground">共 ${rows.length} 条配料单</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[960px] text-left text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
              <th class="px-3 py-2">款式 / SPU</th>
              <th class="px-3 py-2">配料进度</th>
              <th class="px-3 py-2">领料状态</th>
              <th class="px-3 py-2">物料行</th>
              <th class="px-3 py-2">库存情况</th>
              <th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map((row) => `
              <tr class="border-t hover:bg-muted/30">
                <td class="px-3 py-3 align-top">
                  <div class="cursor-pointer hover:underline" data-nav="${escapeHtml(buildDetailStateHref(row))}">${renderProductionOrderIdentityCell(row.order.productionOrderNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">配料单：${escapeHtml(row.order.prepOrderNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">交期：${escapeHtml(row.order.deliveryDate)}</div>
                </td>
                <td class="px-3 py-3 align-top">
                  <div class="flex items-start gap-3">
                    ${renderSpuThumb(row.order)}
                    <div>
                      <div class="font-medium">${escapeHtml(row.order.styleNo)} / ${escapeHtml(row.order.styleName)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.order.spu)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">计划 ${row.order.demandQty.toLocaleString('zh-CN')} 件</div>
                    </div>
                  </div>
                </td>
                <td class="px-3 py-3 align-top">
                  ${renderBadgeForStatus(row.order.overallPrepStatus, materialPrepStatusLabelMap[row.order.overallPrepStatus])}
                  <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(formatMaterialPrepProgressByUnit(row))}</div>
                </td>
                <td class="px-3 py-3 align-top">
                  ${renderBadgeForStatus(row.order.pickupStatus, pickupStatusLabelMap[row.order.pickupStatus])}
                  <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(formatMaterialPrepPickupByUnit(row))}</div>
                </td>
                <td class="px-3 py-3 align-top text-xs">
                  <div>物料行：${row.lineCount}</div>
                  <div>已配齐：${row.readyLineCount}</div>
                  <div>未配齐：${row.shortageLineCount}</div>
                </td>
                <td class="px-3 py-3 align-top">${renderOrderStockSummary(row)}</td>
                <td class="px-3 py-3 align-top">
                  <button type="button" data-nav="${escapeHtml(buildDetailStateHref(row))}" class="rounded-md border border-blue-200 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50">查看详情</button>
                </td>
              </tr>
              <tr class="bg-muted/20">
                <td colspan="7" class="px-3 pb-4 pt-0">
                  ${renderOrderMaterialRows(row)}
                </td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="7" class="px-3 py-8 text-center text-sm text-muted-foreground">当前状态下暂无${escapeHtml(categoryLabel)}配料单。</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function getActiveDetailTab(params: URLSearchParams): MaterialPrepDetailTab {
  const value = params.get('detailTab')
  if (value === 'inventory' || value === 'tasks' || value === 'records' || value === 'pickup') return value
  return 'demand'
}

function renderDetailTabs(projection: MaterialPrepOrderProjection, activeTab: MaterialPrepDetailTab): string {
  const tabs: Array<{ key: MaterialPrepDetailTab; label: string; count?: string }> = [
    { key: 'demand', label: '生产需求信息' },
    { key: 'inventory', label: '当前各仓库存信息与上游进度', count: `${projection.lineCount} 行` },
    { key: 'tasks', label: '按任务查看配料情况', count: `${projection.taskProjections.length} 个任务` },
    { key: 'records', label: '配料记录', count: `${projection.prepRecords.length} 条` },
    { key: 'pickup', label: '与配料记录关联的领料记录', count: `${projection.pickupRecords.length + projection.rejectRecords.length} 条` },
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
        <div><div class="text-xs text-muted-foreground">计划数量</div><div class="font-medium">${order.demandQty.toLocaleString('zh-CN')} 件</div></div>
        <div><div class="text-xs text-muted-foreground">客户</div><div class="font-medium">${escapeHtml(order.customerName)}</div></div>
        <div><div class="text-xs text-muted-foreground">交期</div><div class="font-medium">${escapeHtml(order.deliveryDate)}</div></div>
        <div><div class="text-xs text-muted-foreground">创建人</div><div class="font-medium">${escapeHtml(order.creatorName)}</div></div>
        <div><div class="text-xs text-muted-foreground">创建时间</div><div class="font-medium">${escapeHtml(order.createdAt)}</div></div>
      </div>
      <div class="mt-3 grid gap-3 text-sm lg:grid-cols-4">
        <div><div class="text-xs text-muted-foreground">配料状态</div><div class="font-medium">${escapeHtml(materialPrepStatusLabelMap[order.overallPrepStatus])}</div></div>
        <div><div class="text-xs text-muted-foreground">领料状态</div><div class="font-medium">${escapeHtml(pickupStatusLabelMap[order.pickupStatus])}</div></div>
        <div><div class="text-xs text-muted-foreground">BOM 来源</div><div class="font-medium">${escapeHtml(order.bomSourceLabel)}</div></div>
        <div><div class="text-xs text-muted-foreground">BOM 展开时间</div><div class="font-medium">${escapeHtml(order.bomExpandedAt || '暂无')}</div></div>
      </div>
      ${order.isClosed ? `<div class="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">配料已关闭：${escapeHtml(order.closeReason)} / ${escapeHtml(order.closedAt)}</div>` : ''}
    </section>
    ${renderOrderMaterialRows(projection)}
  `
}

function renderInventoryProgress(projection: MaterialPrepOrderProjection): string {
  const lines = projection.lines
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">当前各仓库存信息与上游进度</h3>
      <div class="mt-3 grid gap-3 text-sm lg:grid-cols-2">
        <div class="rounded-md border bg-muted/20 px-3 py-2">
          <div class="text-xs text-muted-foreground">物料行</div>
          <div class="mt-1 font-medium">${projection.readyLineCount}/${projection.lineCount}</div>
          <div class="mt-1 text-xs text-muted-foreground">未配齐 ${projection.shortageLineCount} 行，库存充足 ${projection.stockSufficientLineCount} 行，库存不足 ${projection.stockInsufficientLineCount} 行，无库存 ${projection.noStockLineCount} 行</div>
        </div>
        <div class="rounded-md border bg-muted/20 px-3 py-2">
          <div class="text-xs text-muted-foreground">缺料缺口</div>
          <div class="mt-1 font-medium">${escapeHtml(formatMaterialPrepUnitMetric(projection, 'shortageQty'))}</div>
          <div class="mt-1 text-xs text-muted-foreground">最早可配 ${escapeHtml(projection.earliestExpectedAvailableAt || '暂无')}</div>
        </div>
      </div>
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
  relatedProductionOrderNo: string,
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
        const statusLabel = materialPrepRecordStatusLabelMap[record.recordStatus]
        const statusVariant: BadgeVariant = record.recordStatus === 'CONFIRMED' ? 'success' : record.recordStatus === 'REJECTED' ? 'danger' : record.recordStatus === 'STAGED' ? 'warning' : record.recordStatus === 'PICKED' ? 'info' : 'neutral'
        return `
        <div class="min-w-[220px] rounded-md border border-l-4 ${statusClass} px-2.5 py-2 shadow-sm">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-foreground">配料记录号 ${renderMaterialPrepRecordCodeButton(record, relatedProductionOrderNo, {
              label: record.recordNo,
              className: 'font-mono text-blue-600 hover:underline',
            })}</span>
            ${renderBadge(statusLabel, statusVariant)}
          </div>
          <div class="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>本次配料：<strong class="font-medium text-foreground">${formatQty(record.preparedQty, unit)}</strong></span>
            <span>卷/件数：<strong class="font-medium text-foreground">${record.rollCount}</strong></span>
          </div>
          <div class="mt-1 truncate text-[11px] text-muted-foreground" title="${escapeHtml(record.prepRecordId)}">记录ID：${renderMaterialPrepRecordCodeButton(record, relatedProductionOrderNo, {
            label: record.prepRecordId,
            className: 'font-mono text-blue-600 hover:underline',
          })}</div>
        </div>
      `}).join('')}
    </div>
  `
}

function renderTaskPrepOverview(projection: MaterialPrepOrderProjection): string {
  const assignmentText = projection.order.pendingAssignmentCount > 0
    ? `${projection.order.pendingAssignmentCount} 个任务待分配后回写工厂`
    : '任务工厂均已回写'
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">任务维度配料情况</h3>
      <p class="mt-1 text-sm text-muted-foreground">以任务的维度展示配料情况：这是个什么任务、任务需要哪些物料、这些物料需要多少、配了多少、领了多少，以及有哪些配料记录。分配完成后会回写任务工厂和分配时间。</p>
      <div class="mt-3 rounded-md border bg-muted/20 px-3 py-2 text-sm">
        <div class="text-xs text-muted-foreground">分配回写</div>
        <div class="mt-1 font-medium">${escapeHtml(assignmentText)}</div>
        <div class="mt-1 text-xs text-muted-foreground">已回写 ${projection.order.assignedTaskCount} 个任务</div>
      </div>
      <div class="mt-3 space-y-4">
        ${projection.taskProjections.length ? projection.taskProjections.map((task) => `
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
                      <td class="px-3 py-3">${renderTaskPrepRecordRefs(line.prepRecords, line.unit, projection.order.productionOrderNo)}</td>
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

function renderPrepModal(projection: MaterialPrepOrderProjection): string {
  const lines = projection.lines.filter(l => classifyPrepLineType(l) === categoryLabel && l.canPrepQty > 0)
  const closeHref = buildDetailStateHref(projection, { detailTab: 'records' })
  if (!lines.length) return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div class="rounded-lg bg-background p-8 shadow-xl">
        <p class="text-lg">当前无库存可配</p>
        <button type="button" data-nav="${escapeHtml(closeHref)}" class="mt-4 rounded-md border px-4 py-2 text-sm hover:bg-muted">关闭</button>
      </div>
    </div>
  `
  const totalPrep = lines.reduce((sum, l) => sum + l.canPrepQty, 0)
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <section class="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-lg bg-background shadow-xl">
        <div class="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 class="text-lg font-semibold">新增配料记录</h2>
            <p class="mt-1 text-sm text-muted-foreground">以下 ${lines.length} 行物料将按最大可配数量自动生成配料明细</p>
          </div>
          <button type="button" data-nav="${escapeHtml(closeHref)}" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">关闭</button>
        </div>
        <div class="max-h-[calc(85vh-72px)] overflow-y-auto p-5">
          <div class="grid gap-3 md:grid-cols-4">
            <label class="space-y-1 text-xs text-muted-foreground">
              <span>配料记录号</span>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="BATCH-自动生成" />
            </label>
            <label class="space-y-1 text-xs text-muted-foreground">
              <span>配料人</span>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="配料小组 周敏" />
            </label>
            <label class="space-y-1 text-xs text-muted-foreground">
              <span>包含物料行</span>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${lines.length} 行 / ${totalPrep} total" />
            </label>
            <label class="space-y-1 text-xs text-muted-foreground">
              <span>记录状态</span>
              <input class="h-9 w-full rounded-md border bg-muted px-3 text-sm text-muted-foreground" value="待拣货" readonly />
            </label>
          </div>

          <div class="mt-4 overflow-x-auto rounded-md border">
            <table class="w-full text-left text-xs">
              <thead class="bg-muted/60 text-muted-foreground">
                <tr>
                  <th class="px-3 py-2">物料SKU</th>
                  <th class="px-3 py-2">物料名称</th>
                  <th class="px-3 py-2">需求量</th>
                  <th class="px-3 py-2">库存可用</th>
                  <th class="px-3 py-2">本次配料</th>
                </tr>
              </thead>
              <tbody>
                ${lines.map(l => `
                  <tr class="border-t">
                    <td class="px-3 py-2 font-medium">${escapeHtml(l.materialSku)}</td>
                    <td class="px-3 py-2">${escapeHtml(l.materialName)}</td>
                    <td class="px-3 py-2">${l.requiredQty} ${escapeHtml(l.unit)}</td>
                    <td class="px-3 py-2">${l.availableStockQty} ${escapeHtml(l.unit)}</td>
                    <td class="px-3 py-2 font-semibold">${l.defaultPrepQty || l.canPrepQty} ${escapeHtml(l.unit)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <label class="mt-4 block space-y-1 text-xs text-muted-foreground">
            <span>备注</span>
            <textarea class="min-h-16 w-full rounded-md border bg-background px-3 py-2 text-sm">按当前最大可配数量自动生成配料明细，待仓库拣货后逐步确认。</textarea>
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

function renderCloseModal(projection: MaterialPrepOrderProjection): string {
  const shortageLines = projection.lines.filter(l => l.remainingNeedQty > 0)
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <section class="max-h-[88vh] w-full max-w-lg overflow-hidden rounded-lg bg-background shadow-xl">
        <div class="border-b px-5 py-4">
          <h2 class="text-lg font-semibold">关闭配料单</h2>
          <p class="mt-1 text-sm text-muted-foreground">关闭后将不再安排后续配料，裁床按实完结。</p>
        </div>
        <div class="space-y-4 p-5">
          ${shortageLines.length > 0 ? `
            <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <div class="font-medium">存在 ${shortageLines.length} 行未配齐的物料</div>
              <ul class="mt-1 ml-5 list-disc text-xs">
                ${shortageLines.map(l => `<li>${escapeHtml(l.materialSku)} ${escapeHtml(l.materialName)}：尚缺 ${l.remainingNeedQty} ${escapeHtml(l.unit)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          <label class="block space-y-1 text-sm">
            <span class="font-medium">关闭原因 <span class="text-rose-500">*</span></span>
            <textarea class="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm" data-fcs-close-reason placeholder="请填写关闭原因，后续将不再配料。"></textarea>
          </label>
          <div class="flex justify-end gap-2">
            <button type="button" data-nav="${escapeHtml(buildDetailStateHref(projection, { detailTab: 'records' }))}" class="rounded-md border px-4 py-2 text-sm hover:bg-muted">取消</button>
            <button type="button" data-fcs-material-prep-action="close-order" data-prep-order-id="${escapeHtml(projection.order.prepOrderId)}" class="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white">确认关闭</button>
          </div>
        </div>
      </section>
    </div>
  `
}

function renderPrepRecords(projection: MaterialPrepOrderProjection): string {
  const records = projection.prepRecords
  const stagingText = projection.stagingRecords.length
    ? `${projection.stagingRecords.length} 条暂存记录 / ${projection.order.stagingAreaCount} 个暂存区`
    : '暂无暂存台账'
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-base font-semibold">配料记录</h3>
        <button type="button" data-nav="${escapeHtml(buildPrepModalHref(projection))}" class="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white">新增配料记录</button>
        <button type="button" data-nav="${escapeHtml(buildClosePrepOrderHref(projection))}" class="rounded-md border border-rose-200 px-3 py-2 text-xs text-rose-700 hover:bg-rose-50">关闭配料单</button>
      </div>
      <div class="mt-2 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        配料记录按 DRAFT → PICKED → STAGED → CONFIRMED 流转；打回后可从 STAGED 重新确认；已确认的配料可被加工领料；每条记录整体确认，记录内物料明细不单独确认。
      </div>
      <div class="mt-3 grid gap-3 text-sm lg:grid-cols-2">
        <div class="rounded-md border bg-muted/20 px-3 py-2">
          <div class="text-xs text-muted-foreground">暂存区台账</div>
          <div class="mt-1 font-medium">${escapeHtml(stagingText)}</div>
          <div class="mt-1 text-xs text-muted-foreground">入暂存区时生成，确认或打回时同步状态</div>
        </div>
        <div class="rounded-md border bg-muted/20 px-3 py-2">
          <div class="text-xs text-muted-foreground">完成通知</div>
          <div class="mt-1 font-medium">${projection.order.prepCompletionEventCount} 条</div>
          <div class="mt-1 text-xs text-muted-foreground">CONFIRMED 后生成配料完成通知事件</div>
        </div>
      </div>
      <div class="mt-3 space-y-3">
        ${records.length ? records.map((record) => renderPrepRecordStatusRow(record)).join('') : '<div class="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">暂无配料记录。</div>'}
      </div>
    </section>
  `
}

function renderPickupRecords(projection: MaterialPrepOrderProjection): string {
  const records = projection.pickupRecords
  const rejectRecords = projection.rejectRecords
  const relatedProductionOrderNo = projection.order.productionOrderNo
  const pickText = [
    `待拣货 ${projection.prepRecords.filter((record) => record.recordStatus === 'DRAFT').length}`,
    `已拣货 ${projection.prepRecords.filter((record) => record.recordStatus === 'PICKED').length}`,
    `已入暂存 ${projection.prepRecords.filter((record) => record.recordStatus === 'STAGED').length}`,
  ].join(' / ')
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">与配料记录关联的领料记录</h3>
      <div class="mt-3 grid gap-3 text-sm lg:grid-cols-2">
        <div class="rounded-md border bg-muted/20 px-3 py-2">
          <div class="text-xs text-muted-foreground">领料状态</div>
          <div class="mt-1 font-medium">${escapeHtml(pickupStatusLabelMap[projection.order.pickupStatus])}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(formatMaterialPrepPickupByUnit(projection))}</div>
        </div>
        <div class="rounded-md border bg-muted/20 px-3 py-2">
          <div class="text-xs text-muted-foreground">仓库拣货进度</div>
          <div class="mt-1 font-medium">${escapeHtml(pickText)}</div>
          <div class="mt-1 text-xs text-muted-foreground">已确认 ${projection.prepRecords.filter((record) => record.recordStatus === 'CONFIRMED').length} 条</div>
        </div>
      </div>
      <div class="mt-3 grid gap-3 lg:grid-cols-2">
        <div class="rounded-md border">
          <div class="border-b px-3 py-2 text-sm font-medium">领料记录</div>
          <div class="divide-y">
            ${records.length ? records.map((record) => `
              <div class="px-3 py-3 text-sm">
                <div class="font-medium">${renderMaterialPickupRecordCodeButton(record, relatedProductionOrderNo, {
                  label: record.pickupRecordId,
                  className: 'font-mono text-blue-600 hover:underline',
                })}</div>
                <div class="mt-1 text-xs text-muted-foreground">配料记录：${renderMaterialPrepRecordCodeButton(record, relatedProductionOrderNo, {
                  label: record.prepRecordId,
                  className: 'font-mono text-blue-600 hover:underline',
                })}</div>
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

function renderDetail(projection: MaterialPrepOrderProjection, activeTab: MaterialPrepDetailTab): string {
  const content = activeTab === 'inventory'
    ? renderInventoryProgress(projection)
    : activeTab === 'tasks'
      ? renderTaskPrepOverview(projection)
    : activeTab === 'records'
      ? renderPrepRecords(projection)
    : activeTab === 'pickup'
      ? renderPickupRecords(projection)
      : renderProductionDemand(projection)
  return `
    <div class="space-y-4">
      ${renderDetailTabs(projection, activeTab)}
      ${content}
    </div>
  `
}

function renderDetailPage(): string {
  const params = getSearchParams()
  const prepOrderId = params.get('prepOrderId')
  const backTab = normalizeMaterialPrepStatus(params.get('fromTab'))
  const keyword = params.get('keyword') || ''
  const backHref = buildHref({ tab: backTab, prepOrderId: undefined, fromTab: undefined, detailTab: undefined, keyword: keyword || undefined })
  const activeDetailTab = getActiveDetailTab(params)
  const showPrepModal = params.get('prepModal') === '1'
  const showCloseModal = params.get('closeModal') === '1'

  if (!prepOrderId) {
    return `
      <div class="space-y-5 p-6">
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="text-sm text-muted-foreground">生产协同系统 / 配料管理 / ${escapeHtml(categoryLabel)}</div>
            <h1 class="mt-1 text-2xl font-bold">配料详情</h1>
          </div>
          <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(backHref)}">返回配料列表</button>
        </header>
        <section class="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">缺少配料单参数。</section>
      </div>
    `
  }

  const projection = getMaterialPrepOrderProjection(prepOrderId)
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
    <div class="space-y-5 p-6" data-production-object-type-hints="MATERIAL_PREP_ORDER MATERIAL_PREP_RECORD MATERIAL_PICKUP_RECORD">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="text-sm text-muted-foreground">生产协同系统 / 配料管理 / ${escapeHtml(categoryLabel)}</div>
          <h1 class="mt-1 text-2xl font-bold">配料详情</h1>
          <p class="mt-2 text-sm text-muted-foreground">生产单 ${renderProductionObjectCodeButton({
            objectType: 'PRODUCTION_ORDER',
            objectId: projection.order.productionOrderNo,
            label: projection.order.productionOrderNo,
            className: 'font-mono text-blue-600 hover:underline',
          })} / 配料单 ${renderMaterialPrepOrderCodeButton(projection)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${renderMaterialPrepOrderCodeButton(projection, { label: '生产总览', className: 'rounded-md border border-blue-200 px-4 py-2 text-sm text-blue-700 hover:bg-blue-50' })}
          <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(backHref)}">返回配料列表</button>
          ${!projection.order.isClosed && projection.order.overallPrepStatus !== 'READY'
            ? `<button type="button" data-nav="${escapeHtml(buildClosePrepOrderHref(projection))}" class="rounded-md border border-rose-200 px-4 py-2 text-sm text-rose-700 hover:bg-rose-50">关闭配料单</button>`
            : ''}
        </div>
      </header>

      ${renderDetail(projection, activeDetailTab)}
      ${showPrepModal ? renderPrepModal(projection) : ''}
      ${showCloseModal ? renderCloseModal(projection) : ''}
    </div>
  `
}

export function renderFcsOtherPrepPage(): string {
  const params = getSearchParams()
  const prepOrderId = params.get('prepOrderId')
  if (prepOrderId) return renderDetailPage()

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
          <h1 class="mt-1 text-2xl font-bold">其他配料（包材）</h1>
          <p class="mt-2 text-sm text-muted-foreground">按生产单组织${escapeHtml(categoryLabel)}配料，让配料人员知道哪些无库存可配、哪些部分有库存可配、哪些全部都有充足库存、哪些被打回重配、哪些已配齐。</p>
        </div>
      </header>

      ${renderSearchBar(keyword)}
      ${renderTabs(allRows, activeTab)}
      ${renderOrderTable(rows, activeTab)}
    </div>
  `
}

export function handleFcsOtherPrepEvent(target: HTMLElement): boolean {
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
    params.set('detailTab', 'records')
    window.history.replaceState({}, '', `${pageBasePath}?${params.toString()}`)
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
    const reasonInput = document.querySelector<HTMLTextAreaElement>('[data-fcs-close-reason]')
    const closeReason = reasonInput?.value.trim() || ''
    if (!prepOrderId) return false
    if (!closeReason) {
      window.alert('请填写关闭原因。')
      return true
    }
    closeMaterialPrepOrder(prepOrderId, closeReason, '配料小组 周敏')
    const params = getSearchParams()
    params.delete('closeModal')
    params.set('detailTab', 'records')
    window.history.replaceState({}, '', `${pageBasePath}?${params.toString()}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
    return true
  }

  return false
}
