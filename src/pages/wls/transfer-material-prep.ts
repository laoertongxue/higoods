import { renderBadge } from '../../components/ui/badge.ts'
import type { BadgeVariant } from '../../components/ui/types.ts'
import {
  closeMaterialPrepOrder,
  confirmMaterialPrepRecord,
  getMaterialPrepOrderProjection,
  getMaterialPrepRecordItems,
  listMaterialPrepOrderProjections,
  materialPrepStatusLabelMap,
  materialPrepWorkbenchTabs,
  pickupStatusLabelMap,
  type MaterialPrepLine,
  type MaterialPrepOrderProjection,
  type MaterialPrepOrderStatus,
  type MaterialPrepRecord,
  type PickupRecord,
  type PrepRejectRecord,
} from '../../data/fcs/cutting/production-material-prep.ts'
import { escapeHtml } from '../../utils.ts'

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
  return `/wls/transfer-warehouse/material-prep${query ? `?${query}` : ''}`
}

function buildDetailHref(prepOrderId: string, activeTab?: string): string {
  const params = new URLSearchParams()
  params.set('prepOrderId', prepOrderId)
  if (activeTab) params.set('fromTab', activeTab)
  return `/wls/transfer-warehouse/material-prep-detail?${params.toString()}`
}

function buildAddPrepRecordHref(prepOrderId: string, activeTab?: string): string {
  const params = new URLSearchParams()
  params.set('prepOrderId', prepOrderId)
  params.set('detailTab', 'records')
  params.set('prepModal', '1')
  if (activeTab) params.set('fromTab', activeTab)
  return `/wls/transfer-warehouse/material-prep-detail?${params.toString()}`
}

function buildClosePrepOrderHref(prepOrderId: string, activeTab?: string): string {
  const params = new URLSearchParams()
  params.set('prepOrderId', prepOrderId)
  params.set('detailTab', 'inventory')
  params.set('closeModal', '1')
  if (activeTab) params.set('fromTab', activeTab)
  return `/wls/transfer-warehouse/material-prep-detail?${params.toString()}`
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
  const params = getSearchParams()
  params.set('prepOrderId', projection.order.prepOrderId)
  if (options.detailTab) params.set('detailTab', options.detailTab)
  if (options.prepModal) params.set('prepModal', '1')
  else params.delete('prepModal')
  if (options.continuePrepRecordId) params.set('continuePrepRecordId', options.continuePrepRecordId)
  else params.delete('continuePrepRecordId')
  if (options.closeModal) params.set('closeModal', '1')
  else params.delete('closeModal')
  return `/wls/transfer-warehouse/material-prep-detail?${params.toString()}`
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

function renderPrepRecordStatus(status: MaterialPrepRecord['recordStatus']): string {
  if (status === 'CONFIRMED') return renderBadge('已确认', 'success')
  if (status === 'REJECTED') return renderBadge('被打回重配', 'danger')
  return renderBadge('未确认', 'warning')
}

function renderLineTaskLinks(line: MaterialPrepLine): string {
  if (!line.taskLinks.length) return renderBadge('任务未分配', 'neutral')
  return `
    <div class="space-y-1">
      ${line.taskLinks.map((task) => `
        <div class="rounded-md border bg-background px-2 py-1">
          <div class="flex flex-wrap items-center gap-1">
            ${renderBadge(task.allocationStatus, task.allocationStatus === '已分配' ? 'success' : 'neutral')}
            <span class="font-medium">${escapeHtml(task.taskNo)}</span>
          </div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.taskName)} / ${escapeHtml(task.factoryName)}</div>
        </div>
      `).join('')}
    </div>
  `
}

function renderOrderMaterialRows(row: MaterialPrepOrderProjection): string {
  return `
    <div class="rounded-md border bg-background">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div class="text-sm font-medium">物料配料明细</div>
        <div class="text-xs text-muted-foreground">每个生产单至少 8 个物料：面料 3 个、辅料 3 个、纱线 1 个、包材 1 个。</div>
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
              <th class="px-3 py-2">已配多少</th>
              <th class="px-3 py-2">剩余未配</th>
              <th class="px-3 py-2">配料记录</th>
              <th class="px-3 py-2">领料记录</th>
              <th class="px-3 py-2">是否还需要配料</th>
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
                <td class="px-3 py-2">${formatQty(line.confirmedPrepQty, line.unit)}</td>
                <td class="px-3 py-2">${formatQty(line.remainingNeedQty, line.unit)}</td>
                <td class="px-3 py-2">${getLinePrepRecordCount(row, line)} 条</td>
                <td class="px-3 py-2">${getLinePickupRecordCount(row, line)} 条</td>
                <td class="px-3 py-2">${renderNeedPrepState(line)}</td>
                <td class="px-3 py-2">
                  ${renderBadge(line.upstreamProgressStatus, line.upstreamProgressStatus === '已到仓可配' ? 'success' : line.upstreamProgressStatus === '无需跟进' ? 'neutral' : 'warning')}
                  <div class="mt-1 text-muted-foreground">${escapeHtml(line.upstreamProgressDetail)}</div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `
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

function getActiveDetailTab(params: URLSearchParams): MaterialPrepDetailTab {
  const value = params.get('detailTab')
  if (value === 'inventory' || value === 'tasks' || value === 'records' || value === 'pickup') return value
  return 'demand'
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

function renderOrderTable(rows: MaterialPrepOrderProjection[], activeTab: MaterialPrepOrderStatus): string {
  return `
    <div class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-base font-semibold">配料工作台</h2>
        <span class="text-xs text-muted-foreground">列表只展示待处理对象；点击查看详情后再处理配料记录。</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1180px] text-left text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2">生产单</th>
              <th class="px-3 py-2">款式 / SPU</th>
              <th class="px-3 py-2">配料进度</th>
              <th class="px-3 py-2">领料状态</th>
              <th class="px-3 py-2">物料行</th>
              <th class="px-3 py-2">缺料与上游</th>
              <th class="px-3 py-2">最近操作</th>
              <th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map((row) => `
              <tr class="border-t">
                <td class="px-3 py-3 align-top">
                  <button type="button" data-nav="${escapeHtml(buildDetailHref(row.order.prepOrderId, activeTab))}" class="font-medium text-blue-700 hover:underline">${escapeHtml(row.order.productionOrderNo)}</button>
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
                <td colspan="8" class="px-3 pb-4 pt-0">
                  ${renderOrderMaterialRows(row)}
                </td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="8" class="px-3 py-8 text-center text-sm text-muted-foreground">当前状态下暂无配料单。</td>
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
                  ${renderBadge(line.upstreamProgressStatus, line.upstreamProgressStatus === '已到仓可配' ? 'success' : line.upstreamProgressStatus === '无需跟进' ? 'neutral' : 'warning')}
                  <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(line.upstreamSourceType)} / ${escapeHtml(line.expectedAvailableAt || '无预计时间')}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.upstreamProgressDetail)}</div>
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
            : 'border-l-amber-500 bg-amber-50/60'
        return `
        <div class="min-w-[220px] rounded-md border border-l-4 ${statusClass} px-2.5 py-2 shadow-sm">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-foreground">配料记录号 ${record.recordNo}</span>
            ${renderPrepRecordStatus(record.recordStatus)}
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
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">任务维度配料情况</h3>
      <p class="mt-1 text-sm text-muted-foreground">以任务的维度展示配料情况：这是个什么任务、任务需要哪些物料、这些物料需要多少、配了多少、领了多少，以及有哪些配料记录。</p>
      <div class="mt-3 space-y-4">
        ${projection.taskProjections.length ? projection.taskProjections.map((task) => `
          <article class="rounded-md border bg-background">
            <div class="flex flex-wrap items-start justify-between gap-3 border-b px-3 py-3">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium">${escapeHtml(task.taskNo)}</span>
                  ${renderBadge(task.taskType, 'info')}
                  ${renderBadge(task.allocationStatus, task.allocationStatus === '已分配' ? 'success' : 'neutral')}
                </div>
                <div class="mt-1 text-xs text-muted-foreground">任务：${escapeHtml(task.taskName)} / 任务工厂：${escapeHtml(task.factoryName)} / 分配时间：${escapeHtml(task.assignedAt || '任务未分配')}</div>
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
        `).join('') : '<div class="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">当前生产单尚未完成任务分配，暂无任务维度配料情况。</div>'}
      </div>
    </section>
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
        新增记录默认为未确认；已有未确认记录时仍可继续新增配料。确认对象是整条配料记录，记录内物料明细不单独确认。确认后裁床领料管理会看到对应待领料；下游打回后，该配料记录会回到未确认/待重配状态，不影响同单其他配料记录。
      </div>
      <div class="mt-3 space-y-3">
        ${records.length ? records.map((record, recordIndex) => {
          const recordItems = getMaterialPrepRecordItems(record)
          const statusLabel = record.recordStatus === 'CONFIRMED' ? '已确认' : record.recordStatus === 'REJECTED' ? '被打回重配' : '未确认'
          const statusVariant: BadgeVariant = record.recordStatus === 'CONFIRMED' ? 'success' : record.recordStatus === 'REJECTED' ? 'danger' : 'warning'
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
                  <div class="mt-1 text-xs text-muted-foreground">配料记录ID：${escapeHtml(record.prepRecordId)} / ${escapeHtml(record.preparedAt)} / ${escapeHtml(record.operatorName)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">整条记录合计：${recordItems.length} 个物料明细 / ${totalRollCount} 卷；物料数量按各自单位在明细中查看</div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  ${record.recordStatus !== 'CONFIRMED'
                    ? `
                      <button type="button" data-nav="${escapeHtml(buildContinueHref(record))}" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">新增配料</button>
                      <button type="button" data-wls-prep-action="confirm-record" data-prep-record-id="${escapeHtml(record.prepRecordId)}" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">确认整条配料记录</button>
                    `
                    : '<span class="rounded-md bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">整条记录已进入领料管理</span>'}
                </div>
              </div>
              <div class="px-3 py-3">
                <div class="mb-2 text-xs font-medium text-muted-foreground">记录内物料明细</div>
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

function renderPrepMaterialInputTable(projection: MaterialPrepOrderProjection): string {
  const materialLines = projection.lines
  return `
    <div class="mt-4 rounded-md border">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div class="text-sm font-medium">生产单所需全部物料</div>
        <div class="text-xs text-muted-foreground">按行填写本次配料数量和卷/件数；确认对象仍是整条配料记录。</div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1500px] text-left text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2">物料</th>
              <th class="px-3 py-2">类别</th>
              <th class="px-3 py-2">关联任务</th>
              <th class="px-3 py-2">需求数量</th>
              <th class="px-3 py-2">已确认配料</th>
              <th class="px-3 py-2">已领料</th>
              <th class="px-3 py-2">剩余未配</th>
              <th class="px-3 py-2">当前可配</th>
              <th class="px-3 py-2">是否还需要配料</th>
              <th class="px-3 py-2">来源仓库 / 库位</th>
              <th class="px-3 py-2">本次数量</th>
              <th class="px-3 py-2">卷/件数</th>
            </tr>
          </thead>
          <tbody>
            ${materialLines.map((line) => `
              <tr class="border-t">
                <td class="px-3 py-3">
                  <div class="flex items-start gap-2">
                    ${renderMaterialThumb(line)}
                    <div>
                      <div class="font-medium">${escapeHtml(line.materialSku)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.materialName)} / ${escapeHtml(line.color)} / ${escapeHtml(line.spec)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">裁片单：${escapeHtml(line.cutOrderNo)}</div>
                    </div>
                  </div>
                </td>
                <td class="px-3 py-3">${renderBadge(line.materialType, line.materialType === '面料' ? 'info' : line.materialType === '辅料' ? 'warning' : line.materialType === '纱线' ? 'success' : 'neutral')}</td>
                <td class="px-3 py-3">${renderLineTaskLinks(line)}</td>
                <td class="px-3 py-3">${formatQty(line.requiredQty, line.unit)}</td>
                <td class="px-3 py-3">${formatQty(line.confirmedPrepQty, line.unit)}</td>
                <td class="px-3 py-3">${formatQty(line.pickedQty, line.unit)}</td>
                <td class="px-3 py-3">${formatQty(line.remainingNeedQty, line.unit)}</td>
                <td class="px-3 py-3">${formatQty(line.canPrepQty, line.unit)}</td>
                <td class="px-3 py-3">${renderNeedPrepState(line)}</td>
                <td class="px-3 py-3">
                  <div class="font-medium">${escapeHtml(line.stockWarehouseName)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.stockWarehouseArea)} / ${escapeHtml(line.stockLocationCode)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">在库：${formatQty(line.availableStockQty, line.unit)}</div>
                </td>
                <td class="px-3 py-3">
                  <input class="h-9 w-28 rounded-md border bg-background px-2 text-sm" value="0" />
                  <span class="ml-1 text-xs text-muted-foreground">${escapeHtml(line.unit)}</span>
                </td>
                <td class="px-3 py-3"><input class="h-9 w-20 rounded-md border bg-background px-2 text-sm" value="0" /></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderAddPrepRecordModal(projection: MaterialPrepOrderProjection, activeTab: MaterialPrepDetailTab): string {
  const closeHref = buildDetailStateHref(projection, { detailTab: activeTab })
  const materialLines = projection.lines
  const needPrepCount = materialLines.filter((line) => line.remainingNeedQty > 0).length
  const nextRecordNumber = getPrepRecordNumber(projection)
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <section class="max-h-[88vh] w-full max-w-7xl overflow-hidden rounded-lg bg-background shadow-xl">
        <div class="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 class="text-lg font-semibold">新增配料记录</h2>
            <p class="mt-1 text-sm text-muted-foreground">默认展示该生产单全部 ${materialLines.length} 行物料，其中 ${needPrepCount} 行仍需配料；配料人只填写本次实际配料数量，不配的行保持 0。</p>
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
              <input class="h-9 w-full rounded-md border bg-muted px-3 text-sm text-muted-foreground" value="未确认" readonly />
            </label>
          </div>

          ${renderPrepMaterialInputTable(projection)}

          <label class="mt-4 block space-y-1 text-xs text-muted-foreground">
            <span>备注</span>
            <textarea class="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground">按当前可配库存新增配料记录，待复核后确认整条记录。</textarea>
          </label>

          <div class="mt-5 flex justify-end gap-2">
            <button type="button" data-nav="${escapeHtml(closeHref)}" class="rounded-md border px-4 py-2 text-sm hover:bg-muted">取消</button>
            <button type="button" data-nav="${escapeHtml(closeHref)}" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">保存为未确认记录</button>
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
            <p class="mt-1 text-sm text-muted-foreground">继续补充配料记录号 ${recordNumber}；只填写本次新增的物料数量，保存后仍归入这条未确认配料记录。</p>
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
  const gapLines = projection.lines.filter((line) => line.remainingNeedQty > 0)
  const gapSummary = Array.from(
    gapLines.reduce((summary, line) => {
      summary.set(line.unit, Number(summary.get(line.unit) || 0) + Number(line.remainingNeedQty || 0))
      return summary
    }, new Map<string, number>()),
  ).map(([unit, qty]) => formatQty(qty, unit)).join('、') || '无缺口'
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <section class="max-h-[88vh] w-full max-w-6xl overflow-hidden rounded-lg bg-background shadow-xl" data-wls-close-modal>
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
                        ${renderBadge(line.upstreamProgressStatus, line.upstreamProgressStatus === '已到仓可配' ? 'success' : line.upstreamProgressStatus === '无需跟进' ? 'neutral' : 'warning')}
                        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.upstreamProgressDetail)}</div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <label class="mt-4 block space-y-1 text-xs text-muted-foreground">
            <span>关闭原因（必填）</span>
            <textarea data-wls-close-reason class="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground">后续不再配，按当前已配/已领数量关闭</textarea>
          </label>
          <div class="mt-5 flex justify-end gap-2">
            <button type="button" data-nav="${escapeHtml(closeHref)}" class="rounded-md border px-4 py-2 text-sm hover:bg-muted">取消</button>
            <button type="button" data-wls-prep-action="close-order" data-prep-order-id="${escapeHtml(projection.order.prepOrderId)}" class="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white">确认关闭配料单</button>
          </div>
        </div>
      </section>
    </div>
  `
}

function renderDetail(projection: MaterialPrepOrderProjection, activeTab: MaterialPrepDetailTab): string {
  const content = activeTab === 'inventory'
    ? renderInventoryProgress(projection.lines)
    : activeTab === 'tasks'
      ? renderTaskPrepOverview(projection)
    : activeTab === 'records'
      ? renderPrepRecords(
          projection.prepRecords,
          projection.lines,
          buildDetailStateHref(projection, { detailTab: 'records', prepModal: true }),
          (record) => buildDetailStateHref(projection, { detailTab: 'records', continuePrepRecordId: record.prepRecordId }),
        )
      : activeTab === 'pickup'
        ? renderPickupRecords(projection.pickupRecords, projection.rejectRecords)
        : renderProductionDemand(projection)
  return `
    <div class="space-y-4">
      ${renderDetailTabs(projection, activeTab)}
      ${content}
    </div>
  `
}

export function renderWlsTransferMaterialPrepPage(): string {
  const params = getSearchParams()
  const activeTab = normalizeMaterialPrepStatus(params.get('tab'))
  const allRows = listMaterialPrepOrderProjections()
  const rows = allRows.filter((row) => row.order.overallPrepStatus === activeTab)

  return `
    <div class="space-y-5 p-6">
      <header>
        <div>
          <div class="text-sm text-muted-foreground">仓储物流系统 / 中转仓管理</div>
          <h1 class="mt-1 text-2xl font-bold">配料管理</h1>
          <p class="mt-2 text-sm text-muted-foreground">按生产单组织配料，让配料人员知道哪些无库存可配、哪些部分有库存可配、哪些全部都有充足库存、哪些被打回重配、哪些已配齐。</p>
        </div>
      </header>

      ${renderTabs(allRows, activeTab)}
      ${renderOrderTable(rows, activeTab)}
    </div>
  `
}

export function renderWlsTransferMaterialPrepDetailPage(): string {
  const params = getSearchParams()
  const allRows = listMaterialPrepOrderProjections()
  const activeOrderId = params.get('prepOrderId') || allRows[0]?.order.prepOrderId || ''
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
            <div class="text-sm text-muted-foreground">仓储物流系统 / 中转仓管理 / 配料管理</div>
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
          <div class="text-sm text-muted-foreground">仓储物流系统 / 中转仓管理 / 配料管理</div>
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
        ${renderKpi('缺料缺口', formatQty(projection.totalShortageQty), `最早可配 ${projection.earliestExpectedAvailableAt || '暂无'}`)}
      </section>

      ${renderDetail(projection, activeDetailTab)}
      ${showPrepModal ? renderAddPrepRecordModal(projection, activeDetailTab) : ''}
      ${continuePrepRecordId ? renderContinuePrepRecordModal(projection, activeDetailTab, continuePrepRecordId) : ''}
      ${showCloseModal && !projection.order.isClosed ? renderClosePrepOrderModal(projection, activeDetailTab) : ''}
    </div>
  `
}

export function handleWlsTransferMaterialPrepEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-wls-prep-action]')
  const action = actionNode?.dataset.wlsPrepAction
  if (!actionNode || !action) return false

  if (action === 'confirm-record') {
    const prepRecordId = actionNode.dataset.prepRecordId || ''
    if (!prepRecordId) return false
    confirmMaterialPrepRecord(prepRecordId, '中转仓 周敏')
    return true
  }

  if (action === 'close-order') {
    const prepOrderId = actionNode.dataset.prepOrderId || ''
    const modal = actionNode.closest<HTMLElement>('[data-wls-close-modal]')
    const reasonInput = modal?.querySelector<HTMLTextAreaElement>('[data-wls-close-reason]')
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
