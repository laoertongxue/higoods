import { renderBadge } from '../../../components/ui/badge.ts'
import type { BadgeVariant } from '../../../components/ui/types.ts'
import {
  getMaterialPrepRecordContext,
  listMaterialPrepOrderProjections,
  listPickupCandidates,
  pickupStatusLabelMap,
  pickupWorkbenchTabs,
  rejectMaterialPrepRecord,
  type MaterialPrepLine,
  type MaterialPrepOrderProjection,
  type PickupOrderStatus,
  type PrepRecordPickupCandidate,
  type PrepRecordPickupCandidateItem,
} from '../../../data/fcs/cutting/production-material-prep.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionObjectCodeButton,
  renderProductionOrderIdentityCell,
} from '../../../data/fcs/production-order-identity.ts'
import { escapeHtml } from '../../../utils.ts'
import { getCanonicalCuttingMeta, renderCuttingPageHeader } from './meta.ts'
import { renderCompactKpiGroup } from './layout.helpers.ts'

type PickupDetailTab = 'demand' | 'records' | 'materials' | 'warehouse' | 'reject'

interface PickupListFilters {
  keyword: string
  materialKeyword: string
}

const statusVariantMap: Record<string, BadgeVariant> = {
  WAIT_PICKUP: 'warning',
  REJECTED_WAIT_WLS: 'danger',
  PICKUP_DONE: 'success',
  ACTUAL_CLOSED: 'neutral',
  NOT_PICKABLE: 'neutral',
  NEED_PREP_NO_STOCK: 'warning',
  NEED_PREP_PARTIAL_STOCK: 'info',
  NEED_PREP_ALL_STOCK: 'success',
  REJECTED_REWORK: 'danger',
  READY: 'success',
  CLOSED: 'neutral',
}

function renderProductionOrderCode(productionOrderNo: string): string {
  return renderProductionObjectCodeButton({
    objectType: 'PRODUCTION_ORDER',
    objectId: productionOrderNo,
    defaultTab: 'overview',
    highlightKey: `PRODUCTION_ORDER:${productionOrderNo}`,
  })
}

function renderPrepOrderCode(prepOrderNo: string, productionOrderNo: string): string {
  return renderProductionObjectCodeButton({
    objectType: 'MATERIAL_PREP_ORDER',
    objectId: prepOrderNo,
    relatedProductionOrderNo: productionOrderNo,
    defaultTab: 'materials',
    highlightKey: `MATERIAL_PREP_ORDER:${prepOrderNo}`,
  })
}

function renderPrepRecordCode(prepRecordId: string, productionOrderNo: string): string {
  return renderProductionObjectCodeButton({
    objectType: 'MATERIAL_PREP_RECORD',
    objectId: prepRecordId,
    relatedProductionOrderNo: productionOrderNo,
    defaultTab: 'materials',
    highlightKey: `MATERIAL_PREP_RECORD:${prepRecordId}`,
  })
}

function renderPickupRecordCode(pickupRecordId: string, productionOrderNo: string): string {
  return renderProductionObjectCodeButton({
    objectType: 'MATERIAL_PICKUP_RECORD',
    objectId: pickupRecordId,
    relatedProductionOrderNo: productionOrderNo,
    defaultTab: 'materials',
    highlightKey: `MATERIAL_PICKUP_RECORD:${pickupRecordId}`,
  })
}

function renderMaterialSkuCode(materialSku: string, productionOrderNo: string): string {
  return renderProductionObjectCodeButton({
    objectType: 'MATERIAL',
    objectId: materialSku,
    relatedProductionOrderNo: productionOrderNo,
    defaultTab: 'materials',
    highlightKey: `MATERIAL:${materialSku}`,
  })
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
  return `/fcs/craft/cutting/pickup-management${query ? `?${query}` : ''}`
}

function buildDetailHref(prepOrderId: string, activeTab?: string, prepRecordId?: string, prepLineId?: string): string {
  const params = new URLSearchParams()
  params.set('prepOrderId', prepOrderId)
  if (activeTab) params.set('fromTab', activeTab)
  if (prepRecordId) params.set('prepRecordId', prepRecordId)
  if (prepLineId) params.set('prepLineId', prepLineId)
  return `/fcs/craft/cutting/pickup-management-detail?${params.toString()}`
}

function buildDetailStateHref(
  projection: MaterialPrepOrderProjection,
  options: {
    detailTab?: PickupDetailTab
    prepRecordId?: string
    prepLineId?: string
  } = {},
): string {
  const params = getSearchParams()
  params.set('prepOrderId', projection.order.prepOrderId)
  if (options.detailTab) params.set('detailTab', options.detailTab)
  if (options.prepRecordId) params.set('prepRecordId', options.prepRecordId)
  if (options.prepLineId) params.set('prepLineId', options.prepLineId)
  return `/fcs/craft/cutting/pickup-management-detail?${params.toString()}`
}

function buildPrepModalHref(prepOrderId: string, activeTab?: string, prepRecordId?: string, prepLineId?: string): string {
  const params = new URLSearchParams()
  if (activeTab) params.set('tab', activeTab)
  params.set('prepOrderId', prepOrderId)
  params.set('prepModal', '1')
  if (prepRecordId) params.set('prepRecordId', prepRecordId)
  if (prepLineId) params.set('prepLineId', prepLineId)
  return `/fcs/craft/cutting/pickup-management?${params.toString()}`
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

function renderMaterialThumb(item: Pick<PrepRecordPickupCandidateItem | MaterialPrepLine, 'materialImageUrl' | 'materialName'>): string {
  return renderImageThumb(item.materialImageUrl, item.materialName)
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
    <div class="inline-flex min-h-10 max-w-full items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm shadow-sm">
      <span class="shrink-0 text-muted-foreground">${escapeHtml(label)}：</span>
      <span class="font-semibold tabular-nums">${escapeHtml(value)}</span>
      <span class="min-w-0 truncate text-[11px] text-muted-foreground">${escapeHtml(desc)}</span>
    </div>
  `
}

function getPickupListFilters(params = getSearchParams()): PickupListFilters {
  return {
    keyword: (params.get('q') || '').trim(),
    materialKeyword: (params.get('material') || '').trim(),
  }
}

function renderPickupFilters(filters: PickupListFilters): string {
  return `
    <section class="rounded-lg border bg-card p-4" data-testid="cutting-pickup-list-filters">
      <div class="grid gap-3 md:grid-cols-[minmax(240px,1fr)_minmax(220px,1fr)_auto_auto] md:items-end">
        <label class="space-y-1 text-sm">
          <span class="font-medium text-foreground">关键词</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(filters.keyword)}" placeholder="生产单 / 配料单 / 款号 / SPU" data-pickup-filter-field="keyword" />
        </label>
        <label class="space-y-1 text-sm">
          <span class="font-medium text-foreground">物料 / 裁片单</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(filters.materialKeyword)}" placeholder="物料 SKU / 名称 / 裁片单" data-pickup-filter-field="materialKeyword" />
        </label>
        <button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pickup-action="apply-list-filters">查询</button>
        <button type="button" class="h-10 rounded-md border px-4 text-sm hover:bg-muted" data-pickup-action="reset-list-filters">重置</button>
      </div>
    </section>
  `
}

function matchesPickupRow(row: MaterialPrepOrderProjection, filters: PickupListFilters): boolean {
  const keyword = filters.keyword.toLowerCase()
  const materialKeyword = filters.materialKeyword.toLowerCase()
  if (keyword) {
    const text = [
      row.order.prepOrderNo,
      row.order.productionOrderNo,
      row.order.styleNo,
      row.order.styleName,
      row.order.spu,
      row.latestOperatorName,
    ].join(' ').toLowerCase()
    if (!text.includes(keyword)) return false
  }
  if (materialKeyword) {
    const text = row.lines
      .map((line) => `${line.cutOrderNo} ${line.materialSku} ${line.materialName} ${line.materialType} ${line.color} ${line.spec}`)
      .join(' ')
      .toLowerCase()
    if (!text.includes(materialKeyword)) return false
  }
  return true
}

function matchesPickupCandidate(candidate: PrepRecordPickupCandidate, filters: PickupListFilters): boolean {
  const keyword = filters.keyword.toLowerCase()
  const materialKeyword = filters.materialKeyword.toLowerCase()
  if (keyword) {
    const text = [
      candidate.prepOrderNo,
      candidate.productionOrderNo,
      candidate.styleNo,
      candidate.styleName,
      candidate.spu,
      candidate.operatorName,
      candidate.confirmedBy,
    ].join(' ').toLowerCase()
    if (!text.includes(keyword)) return false
  }
  if (materialKeyword) {
    const text = candidate.items
      .map((item) => `${item.cutOrderNo} ${item.materialSku} ${item.materialName} ${item.materialType} ${item.color}`)
      .join(' ')
      .toLowerCase()
    if (!text.includes(materialKeyword)) return false
  }
  return true
}

function normalizePickupWorkbenchTab(value: string | null): PickupOrderStatus {
  const matched = pickupWorkbenchTabs.find((tab) => tab.key === value)
  return matched?.key || 'WAIT_PICKUP'
}

function getPickupRowsForTab(
  rows: MaterialPrepOrderProjection[],
  candidates: PrepRecordPickupCandidate[],
  activeTab: PickupOrderStatus,
): MaterialPrepOrderProjection[] {
  if (activeTab === 'WAIT_PICKUP') {
    const candidateOrderIds = new Set(candidates.map((candidate) => candidate.prepOrderId))
    return rows.filter((row) => candidateOrderIds.has(row.order.prepOrderId))
  }
  return rows.filter((row) => row.order.pickupStatus === activeTab)
}

function getPickupTabCount(
  rows: MaterialPrepOrderProjection[],
  candidates: PrepRecordPickupCandidate[],
  tab: PickupOrderStatus,
): number {
  if (tab === 'WAIT_PICKUP') return candidates.length
  return rows.filter((row) => row.order.pickupStatus === tab).length
}

function renderTabs(rows: MaterialPrepOrderProjection[], candidates: PrepRecordPickupCandidate[], activeTab: PickupOrderStatus): string {
  return `
    <div class="flex flex-wrap gap-2">
      ${pickupWorkbenchTabs.map((tab) => {
        const count = getPickupTabCount(rows, candidates, tab.key)
        return `
          <button type="button" data-nav="${escapeHtml(buildHref({ tab: tab.key, prepOrderId: undefined, prepRecordId: undefined }))}" class="rounded-md border px-3 py-2 text-sm ${tab.key === activeTab ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}">
            ${escapeHtml(tab.label)} <span class="ml-1 text-xs opacity-80">${count}</span>
          </button>
        `
      }).join('')}
    </div>
  `
}

function getActiveDetailTab(params: URLSearchParams): PickupDetailTab {
  const value = params.get('detailTab')
  if (value === 'records' || value === 'materials' || value === 'warehouse' || value === 'reject') return value
  return 'demand'
}

function renderDetailTabs(
  projection: MaterialPrepOrderProjection,
  candidates: PrepRecordPickupCandidate[],
  activeTab: PickupDetailTab,
  activePrepRecordId: string,
  activePrepLineId: string,
): string {
  const tabs: Array<{ key: PickupDetailTab; label: string; count?: string }> = [
    { key: 'demand', label: '生产需求信息' },
    { key: 'records', label: '待领料配料记录', count: `${candidates.length} 条` },
    { key: 'materials', label: '物料领料明细', count: `${projection.lineCount} 行` },
    { key: 'warehouse', label: '待加工仓入库记录', count: `${projection.pickupRecords.length} 条` },
    { key: 'reject', label: '打回处理记录', count: `${projection.rejectRecords.length} 条` },
  ]
  return `
    <section class="rounded-lg border bg-card px-4 py-3">
      <div class="flex flex-wrap gap-2">
        ${tabs.map((tab) => `
          <button
            type="button"
            data-nav="${escapeHtml(buildDetailStateHref(projection, {
              detailTab: tab.key,
              prepRecordId: activePrepRecordId,
              prepLineId: activePrepLineId,
            }))}"
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

function buildWaitProcessClaimHref(candidate: PrepRecordPickupCandidate): string {
  const params = new URLSearchParams({
    tab: 'claimRecords',
    warehouseAction: 'claim',
    prepRecordId: candidate.prepRecordId,
    prepOrderId: candidate.prepOrderId,
    prepLineId: candidate.defaultPrepLineId,
    cutOrderId: candidate.defaultCutOrderId,
  })
  return `/fcs/craft/cutting/warehouse-management/wait-process?${params.toString()}`
}

function renderCandidateMaterialPreview(candidate: PrepRecordPickupCandidate): string {
  return `
    <div class="space-y-2">
      ${candidate.items.slice(0, 4).map((item) => `
        <div class="flex items-start gap-2 rounded-md border bg-background px-2 py-2">
          ${renderMaterialThumb(item)}
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1">
              ${renderBadge(item.materialType, item.materialType === '面料' ? 'info' : item.materialType === '辅料' ? 'warning' : item.materialType === '纱线' ? 'success' : 'neutral')}
              <span class="truncate text-xs font-medium">${renderMaterialSkuCode(item.materialSku, candidate.productionOrderNo)}</span>
            </div>
            <div class="mt-1 truncate text-xs text-muted-foreground">${escapeHtml(item.materialName)} / ${escapeHtml(item.color)}</div>
            <div class="mt-1 text-xs text-muted-foreground">本次可领 ${formatQty(item.availableToPickupQty, item.unit)} / 已领 ${formatQty(item.pickedQty, item.unit)}</div>
          </div>
        </div>
      `).join('')}
      ${candidate.items.length > 4 ? `<div class="text-xs text-muted-foreground">还有 ${candidate.items.length - 4} 项物料，查看配料单可核对全部明细。</div>` : ''}
    </div>
  `
}

function renderWaitPickupCandidateTable(candidates: PrepRecordPickupCandidate[], activeTab: PickupOrderStatus): string {
  return `
    <div class="rounded-lg border bg-card">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 class="text-base font-semibold">领料工作台</h2>
          <div class="mt-1 text-xs text-muted-foreground">待领料按配料记录逐条展示；一条已确认配料记录对应一条裁床待领料通知。</div>
        </div>
        <span class="text-xs text-muted-foreground">先查看配料单核对物料，再办理领料入库或打回中转仓。</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1480px] text-left text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2">待领料配料记录</th>
              <th class="px-3 py-2">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE} / 款式</th>
              <th class="px-3 py-2">记录内物料</th>
              <th class="px-3 py-2">可领 / 已领</th>
              <th class="px-3 py-2">来源仓库</th>
              <th class="px-3 py-2">确认信息</th>
              <th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            ${candidates.length ? candidates.map((candidate) => `
              <tr class="border-t">
                <td class="px-3 py-3 align-top">
                  <div class="font-medium">${escapeHtml(candidate.batchNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${renderPrepRecordCode(candidate.prepRecordId, candidate.productionOrderNo)}</div>
                  <div class="mt-2">${renderBadge('已确认待领料', 'success')}</div>
                  <div class="mt-2 text-xs text-muted-foreground">明细 ${candidate.materialCount} 项 / 卷件 ${candidate.totalRollCount}</div>
                </td>
                <td class="px-3 py-3 align-top">
                  <div class="flex items-start gap-3">
                    ${renderImageThumb(candidate.spuImageUrl, `${candidate.styleNo} / ${candidate.spu} 款式SPU图`, 'h-14 w-14')}
                    <div>
                      <div class="cursor-pointer hover:underline" data-nav="${escapeHtml(buildDetailHref(candidate.prepOrderId, activeTab, candidate.prepRecordId, candidate.defaultPrepLineId))}">${renderProductionOrderIdentityCell(candidate.productionOrderNo)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">配料单：${renderPrepOrderCode(candidate.prepOrderNo, candidate.productionOrderNo)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(candidate.styleNo)} / ${escapeHtml(candidate.styleName)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(candidate.spu)}</div>
                    </div>
                  </div>
                </td>
                <td class="px-3 py-3 align-top">${renderCandidateMaterialPreview(candidate)}</td>
                <td class="px-3 py-3 align-top text-xs">
                  <div>本次可领：<span class="font-medium text-foreground">${formatQty(candidate.totalAvailableToPickupQty)}</span></div>
                  <div class="mt-1">已领：${formatQty(candidate.totalPickedQty)}</div>
                  <div class="mt-1">已确认配料：${formatQty(candidate.totalPreparedQty)}</div>
                </td>
                <td class="px-3 py-3 align-top text-xs">
                  <div class="font-medium">${escapeHtml(candidate.warehouseNames.join('、'))}</div>
                  <div class="mt-2 space-y-1 text-muted-foreground">
                    ${candidate.items.slice(0, 3).map((item) => `<div>${escapeHtml(item.stockWarehouseName)} / ${escapeHtml(item.warehouseArea)} / ${escapeHtml(item.locationCode)}</div>`).join('')}
                    ${candidate.items.length > 3 ? `<div>更多库位见配料单明细。</div>` : ''}
                  </div>
                </td>
                <td class="px-3 py-3 align-top text-xs">
                  <div>${escapeHtml(candidate.confirmedBy || candidate.operatorName)}</div>
                  <div class="mt-1 text-muted-foreground">${escapeHtml(candidate.confirmedAt || candidate.preparedAt)}</div>
                </td>
                <td class="px-3 py-3 align-top">
                  <div class="flex flex-col gap-2">
                    <button type="button" data-nav="${escapeHtml(buildPrepModalHref(candidate.prepOrderId, activeTab, candidate.prepRecordId, candidate.defaultPrepLineId))}" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">查看配料单</button>
                    <button type="button" data-nav="${escapeHtml(buildWaitProcessClaimHref(candidate))}" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">办理领料入库</button>
                    <button type="button" data-nav="${escapeHtml(buildDetailHref(candidate.prepOrderId, activeTab, candidate.prepRecordId, candidate.defaultPrepLineId))}" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">查看详情</button>
                  </div>
                </td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="7" class="px-3 py-8 text-center text-sm text-muted-foreground">暂无待领料配料记录。</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderOrderTable(rows: MaterialPrepOrderProjection[], candidates: PrepRecordPickupCandidate[], activeTab: PickupOrderStatus): string {
  if (activeTab === 'WAIT_PICKUP') return renderWaitPickupCandidateTable(candidates, activeTab)

  const candidateByOrder = candidates.reduce<Record<string, PrepRecordPickupCandidate[]>>((accumulator, candidate) => {
    accumulator[candidate.prepOrderId] = accumulator[candidate.prepOrderId] || []
    accumulator[candidate.prepOrderId].push(candidate)
    return accumulator
  }, {})

  return `
    <div class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-base font-semibold">领料工作台</h2>
        <span class="text-xs text-muted-foreground">列表只展示领料对象；点击查看配料单后在弹窗内决定领料或打回。</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1180px] text-left text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
              <th class="px-3 py-2">款式 / 物料概况</th>
              <th class="px-3 py-2">领料状态</th>
              <th class="px-3 py-2">可领 / 已领 / 缺料</th>
              <th class="px-3 py-2">待加工仓入库</th>
              <th class="px-3 py-2">最近动作</th>
              <th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map((row) => {
              const rowCandidates = candidateByOrder[row.order.prepOrderId] || []
              const firstCandidate = rowCandidates[0]
              return `
                <tr class="border-t">
                  <td class="px-3 py-3 align-top">
                    <div class="cursor-pointer hover:underline" data-nav="${escapeHtml(buildDetailHref(row.order.prepOrderId, activeTab, firstCandidate?.prepRecordId, firstCandidate?.defaultPrepLineId))}">${renderProductionOrderIdentityCell(row.order.productionOrderNo)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">配料单：${renderPrepOrderCode(row.order.prepOrderNo, row.order.productionOrderNo)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">交期：${escapeHtml(row.order.deliveryDate)}</div>
                  </td>
                  <td class="px-3 py-3 align-top">
                    <div class="flex items-start gap-3">
                      ${renderSpuThumb(row.order)}
                      <div>
                        <div class="font-medium">${escapeHtml(row.order.styleNo)} / ${escapeHtml(row.order.styleName)}</div>
                        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.order.spu)}</div>
                        <div class="mt-1 text-xs text-muted-foreground">物料 ${row.lineCount} 行，已配齐 ${row.readyLineCount} 行</div>
                        ${rowCandidates.length ? `
                          <div class="mt-2 text-xs text-muted-foreground">可领配料记录 ${rowCandidates.length} 条 / 明细 ${rowCandidates.reduce((sum, candidate) => sum + candidate.items.length, 0)} 项</div>
                          <div class="mt-1 space-y-1">
                            ${rowCandidates.slice(0, 3).map((candidate) => `
                              <div class="rounded border bg-background px-2 py-1 text-xs text-slate-700">
                                配料记录：${escapeHtml(candidate.batchNo)} / ${renderPrepRecordCode(candidate.prepRecordId, candidate.productionOrderNo)} / 明细 ${candidate.items.length} 项
                              </div>
                            `).join('')}
                          </div>
                          <div class="mt-1 flex flex-wrap gap-2">
                            ${rowCandidates.flatMap((candidate) => candidate.items).slice(0, 4).map((item) => renderMaterialThumb(item)).join('')}
                          </div>
                        ` : ''}
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-3 align-top">
                    ${renderStatus(row.order.pickupStatus, pickupStatusLabelMap[row.order.pickupStatus])}
                    ${row.order.isClosed ? `<div class="mt-2 text-xs text-slate-600">配料端已关闭，业务含义为后续不再配。</div>` : ''}
                  </td>
                  <td class="px-3 py-3 align-top text-xs">
                    <div>可领：${formatQty(row.totalAvailableToPickupQty)}</div>
                    <div>已领：${formatQty(row.totalPickedQty)}</div>
                    <div>缺料：${formatQty(row.totalShortageQty)}</div>
                  </td>
                  <td class="px-3 py-3 align-top text-xs">
                    ${row.pickupRecords.length ? row.pickupRecords.slice(0, 2).map((record) => `<div>${escapeHtml(record.warehouseArea)} / ${escapeHtml(record.locationCode)} / ${formatQty(record.pickedQty)}</div>`).join('') : '暂无入库'}
                  </td>
                  <td class="px-3 py-3 align-top text-xs">
                    <div>${escapeHtml(row.latestOperatorName)}</div>
                    <div class="mt-1 text-muted-foreground">${escapeHtml(row.latestOperatedAt || row.order.createdAt)}</div>
                  </td>
                  <td class="px-3 py-3 align-top">
                    <div class="flex flex-col gap-2">
                      ${firstCandidate ? `<button type="button" data-nav="${escapeHtml(buildWaitProcessClaimHref(firstCandidate))}" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">办理领料入库</button>` : ''}
                      <button type="button" data-nav="${escapeHtml(buildDetailHref(row.order.prepOrderId, activeTab, firstCandidate?.prepRecordId, firstCandidate?.defaultPrepLineId))}" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">查看详情</button>
                      <button type="button" data-nav="${escapeHtml(buildPrepModalHref(row.order.prepOrderId, activeTab, firstCandidate?.prepRecordId, firstCandidate?.defaultPrepLineId))}" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">查看配料单</button>
                    </div>
                  </td>
                </tr>
              `
            }).join('') : `
              <tr>
                <td colspan="7" class="px-3 py-8 text-center text-sm text-muted-foreground">当前状态下暂无领料单。</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderCandidateList(candidates: PrepRecordPickupCandidate[]): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">待领料配料记录</h3>
      <div class="mt-2 text-xs text-muted-foreground">一条已确认配料记录只生成一条裁床待领料通知；记录内物料明细用于领料核对和打回判断。</div>
      <div class="mt-3 space-y-3">
        ${candidates.length ? candidates.map((candidate) => `
          <article class="rounded-md border bg-background p-3 text-sm">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="flex items-start gap-3">
                ${renderImageThumb(candidate.spuImageUrl, `${candidate.styleNo} / ${candidate.spu} 款式SPU图`, 'h-14 w-14')}
                <div>
                  <div class="font-medium">${escapeHtml(candidate.batchNo)} / ${renderPrepRecordCode(candidate.prepRecordId, candidate.productionOrderNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${renderProductionOrderCode(candidate.productionOrderNo)} / ${renderPrepOrderCode(candidate.prepOrderNo, candidate.productionOrderNo)} / ${escapeHtml(candidate.styleNo)} ${escapeHtml(candidate.styleName)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">确认：${escapeHtml(candidate.confirmedAt || candidate.preparedAt)} / ${escapeHtml(candidate.confirmedBy || candidate.operatorName)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">来源仓库：${escapeHtml(candidate.warehouseNames.join('、'))}</div>
                </div>
              </div>
              ${renderBadge('已确认可领', 'success')}
            </div>
            <div class="mt-3 grid grid-cols-4 gap-2 text-xs">
              <div><div class="text-muted-foreground">物料明细</div><div class="font-medium">${candidate.materialCount} 项</div></div>
              <div><div class="text-muted-foreground">合计卷数</div><div class="font-medium">${candidate.totalRollCount} 卷</div></div>
              <div><div class="text-muted-foreground">已领明细数量</div><div class="font-medium">${candidate.totalPickedQty.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}</div></div>
              <div><div class="text-muted-foreground">本次可领明细数量</div><div class="font-medium">${candidate.totalAvailableToPickupQty.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}</div></div>
            </div>
            <div class="mt-3 overflow-x-auto">
              <table class="w-full min-w-[980px] text-left text-xs">
                <thead class="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2">图片</th>
                    <th class="px-3 py-2">类别</th>
                    <th class="px-3 py-2">物料</th>
                    <th class="px-3 py-2">已确认配料</th>
                    <th class="px-3 py-2">已领</th>
                    <th class="px-3 py-2">本次可领</th>
                    <th class="px-3 py-2">来源仓库 / 库位</th>
                  </tr>
                </thead>
                <tbody>
                  ${candidate.items.map((item) => `
                    <tr class="border-t">
                      <td class="px-3 py-2">${renderMaterialThumb(item)}</td>
                      <td class="px-3 py-2">${renderBadge(item.materialType, item.materialType === '面料' ? 'info' : item.materialType === '辅料' ? 'warning' : item.materialType === '纱线' ? 'success' : 'neutral')}</td>
                      <td class="px-3 py-2">
                        <div class="font-medium">${renderMaterialSkuCode(item.materialSku, candidate.productionOrderNo)}</div>
                        <div class="mt-1 text-muted-foreground">${escapeHtml(item.materialName)} / ${escapeHtml(item.color)} / ${escapeHtml(item.cutOrderNo)}</div>
                      </td>
                      <td class="px-3 py-2">${formatQty(item.preparedQty, item.unit)} / ${item.rollCount} 卷</td>
                      <td class="px-3 py-2">${formatQty(item.pickedQty, item.unit)}</td>
                      <td class="px-3 py-2">${formatQty(item.availableToPickupQty, item.unit)}</td>
                      <td class="px-3 py-2">
                        <div class="font-medium">${escapeHtml(item.stockWarehouseName)}</div>
                        <div class="mt-1 text-muted-foreground">${escapeHtml(item.warehouseArea)} / ${escapeHtml(item.locationCode)}</div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <button type="button" data-nav="${escapeHtml(buildWaitProcessClaimHref(candidate))}" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">办理领料入库</button>
              <button type="button" data-nav="${escapeHtml(buildPrepModalHref(candidate.prepOrderId, undefined, candidate.prepRecordId, candidate.defaultPrepLineId))}" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">查看配料单</button>
            </div>
          </article>
        `).join('') : '<div class="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">当前页签下暂无待领料配料记录。</div>'}
      </div>
    </section>
  `
}

function renderRejectPanel(prepRecordId: string, prepLineId = ''): string {
  const context = prepRecordId ? getMaterialPrepRecordContext(prepRecordId, prepLineId) : null
  if (!context) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-base font-semibold">打回配料记录</h3>
        <div class="mt-2 text-sm text-muted-foreground">选择一条已确认配料记录后，可在这里填写打回原因并退回中转仓重新配料。</div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">打回配料记录</h3>
      <div class="mt-3 rounded-md border bg-muted/20 p-3 text-sm">
        <div class="flex items-start gap-3">
          ${renderImageThumb(context.projection.order.spuImageUrl, `${context.projection.order.styleNo} 款式SPU图`, 'h-14 w-14')}
          <div>
            <div class="font-medium">${escapeHtml(context.record.batchNo)} / ${renderPrepRecordCode(context.record.prepRecordId, context.projection.order.productionOrderNo)}</div>
            <div class="mt-1 text-xs text-muted-foreground">记录内物料：${context.items.length} 项 / 来源仓库：${escapeHtml(context.warehouseNames.join('、'))}。</div>
            <div class="mt-1 text-xs text-muted-foreground">打回对象是整条配料记录，不是记录内某一物料。打回后该记录变为未确认/待重配，不影响同配料单其他记录。</div>
          </div>
        </div>
      </div>
      <div class="mt-3 overflow-x-auto rounded-md border">
        <table class="w-full min-w-[900px] text-left text-xs">
          <thead class="bg-muted/60 text-muted-foreground">
            <tr>
              <th class="px-3 py-2">图片</th>
              <th class="px-3 py-2">物料</th>
              <th class="px-3 py-2">本次可领</th>
              <th class="px-3 py-2">来源仓库 / 库位</th>
            </tr>
          </thead>
          <tbody>
            ${context.items.map((item) => `
              <tr class="border-t">
                <td class="px-3 py-2">${renderMaterialThumb(item)}</td>
                <td class="px-3 py-2">
                  <div class="font-medium">${renderMaterialSkuCode(item.materialSku, context.projection.order.productionOrderNo)}</div>
                  <div class="mt-1 text-muted-foreground">${escapeHtml(item.materialName)} / ${escapeHtml(item.color)} / ${escapeHtml(item.cutOrderNo)}</div>
                </td>
                <td class="px-3 py-2">${formatQty(item.availableToPickupQty, item.unit)}</td>
                <td class="px-3 py-2">
                  <div class="font-medium">${escapeHtml(item.stockWarehouseName)}</div>
                  <div class="mt-1 text-muted-foreground">${escapeHtml(item.warehouseArea)} / ${escapeHtml(item.locationCode)}</div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <label class="block">
          <span class="text-xs font-medium text-muted-foreground">打回原因（必填）</span>
          <select class="mt-1 h-10 w-full rounded-md border px-3 text-sm">
            <option>色号不符</option>
            <option>数量与配料记录不一致</option>
            <option>卷号/库位无法核对</option>
          </select>
        </label>
        <label class="block">
          <span class="text-xs font-medium text-muted-foreground">详细说明（必填）</span>
          <input class="mt-1 h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(context.record.rejectReason || '请仓库复核后重新确认配料')}" />
        </label>
        <div class="flex items-end">
          <button type="button" class="h-10 rounded-md border border-rose-200 px-4 text-sm font-medium text-rose-700 hover:bg-rose-50">打回中转仓</button>
        </div>
      </div>
    </section>
  `
}

function renderPrepRecordModal(
  projection: MaterialPrepOrderProjection | null,
  prepRecordId: string,
  prepLineId: string,
  activeTab: PickupOrderStatus,
): string {
  if (!projection || !prepRecordId) return ''
  const context = getMaterialPrepRecordContext(prepRecordId, prepLineId)
  const closeHref = buildHref({
    tab: activeTab,
    prepOrderId: undefined,
    prepRecordId: undefined,
    prepLineId: undefined,
    prepModal: undefined,
  })
  if (!context) {
    return `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
        <section class="w-full max-w-3xl rounded-lg bg-background shadow-xl">
          <div class="flex items-center justify-between border-b px-5 py-4">
            <h2 class="text-lg font-semibold">配料单详情</h2>
            <button type="button" data-nav="${escapeHtml(closeHref)}" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">关闭</button>
          </div>
          <div class="p-5 text-sm text-muted-foreground">未找到对应配料记录，可能已被打回或已领完。</div>
        </section>
      </div>
    `
  }
  const claimHref = buildWaitProcessClaimHref({
    prepRecordId: context.record.prepRecordId,
    prepOrderId: context.projection.order.prepOrderId,
    prepOrderNo: context.projection.order.prepOrderNo,
    productionOrderId: context.projection.order.productionOrderId,
    productionOrderNo: context.projection.order.productionOrderNo,
    styleNo: context.projection.order.styleNo,
    styleName: context.projection.order.styleName,
    spu: context.projection.order.spu,
    spuImageUrl: context.projection.order.spuImageUrl,
    batchNo: context.record.batchNo,
    preparedAt: context.record.preparedAt,
    operatorName: context.record.operatorName,
    confirmedAt: context.record.confirmedAt,
    confirmedBy: context.record.confirmedBy,
    materialCount: context.items.length,
    totalPreparedQty: context.items.reduce((sum, item) => sum + item.preparedQty, 0),
    totalPickedQty: context.items.reduce((sum, item) => sum + item.pickedQty, 0),
    totalAvailableToPickupQty: context.items.reduce((sum, item) => sum + item.availableToPickupQty, 0),
    totalRollCount: context.items.reduce((sum, item) => sum + item.rollCount, 0),
    warehouseNames: context.warehouseNames,
    defaultPrepLineId: context.items[0]?.prepLineId || context.line.prepLineId,
    defaultCutOrderId: context.items[0]?.cutOrderId || context.line.cutOrderId,
    defaultCutOrderNo: context.items[0]?.cutOrderNo || context.line.cutOrderNo,
    orderStatus: context.projection.order.overallPrepStatus,
    pickupStatus: context.projection.order.pickupStatus,
    items: context.items,
  })
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <section class="max-h-[88vh] w-full max-w-6xl overflow-hidden rounded-lg bg-background shadow-xl">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 class="text-lg font-semibold">配料单详情</h2>
            <p class="mt-1 text-sm text-muted-foreground">裁床在这里核对已确认配料记录；可以直接去领料，也可以填写原因打回中转仓。</p>
          </div>
          <button type="button" data-nav="${escapeHtml(closeHref)}" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">关闭</button>
        </div>
        <div class="max-h-[calc(88vh-76px)] overflow-y-auto p-5">
          <div class="rounded-md border bg-muted/20 p-3">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="flex items-start gap-3">
                ${renderImageThumb(context.projection.order.spuImageUrl, `${context.projection.order.styleNo} 款式SPU图`, 'h-16 w-16')}
                <div>
                  <div class="font-medium">${renderProductionOrderCode(context.projection.order.productionOrderNo)} / ${renderPrepOrderCode(context.projection.order.prepOrderNo, context.projection.order.productionOrderNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(context.projection.order.styleNo)} ${escapeHtml(context.projection.order.styleName)} / ${escapeHtml(context.projection.order.spu)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">配料记录：${escapeHtml(context.record.batchNo)} / ${renderPrepRecordCode(context.record.prepRecordId, context.projection.order.productionOrderNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">确认：${escapeHtml(context.record.confirmedAt || '未确认')} / ${escapeHtml(context.record.confirmedBy || '-')}</div>
                </div>
              </div>
              ${renderBadge(context.record.recordStatus === 'CONFIRMED' ? '已确认待领料' : context.record.recordStatus === 'REJECTED' ? '已打回' : '未确认', context.record.recordStatus === 'CONFIRMED' ? 'success' : context.record.recordStatus === 'REJECTED' ? 'danger' : 'warning')}
            </div>
          </div>

          <div class="mt-4 overflow-x-auto rounded-md border">
            <table class="w-full min-w-[1040px] text-left text-sm">
              <thead class="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2">图片</th>
                  <th class="px-3 py-2">类别</th>
                  <th class="px-3 py-2">物料</th>
                  <th class="px-3 py-2">配料数量</th>
                  <th class="px-3 py-2">已领</th>
                  <th class="px-3 py-2">本次可领</th>
                  <th class="px-3 py-2">来源仓库 / 库位</th>
                  <th class="px-3 py-2">备注</th>
                </tr>
              </thead>
              <tbody>
                ${context.items.map((item) => `
                  <tr class="border-t">
                    <td class="px-3 py-3">${renderMaterialThumb(item)}</td>
                    <td class="px-3 py-3">${renderBadge(item.materialType, item.materialType === '面料' ? 'info' : item.materialType === '辅料' ? 'warning' : item.materialType === '纱线' ? 'success' : 'neutral')}</td>
                    <td class="px-3 py-3">
                      <div class="font-medium">${renderMaterialSkuCode(item.materialSku, context.projection.order.productionOrderNo)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.materialName)} / ${escapeHtml(item.color)} / ${escapeHtml(item.cutOrderNo)}</div>
                    </td>
                    <td class="px-3 py-3">${formatQty(item.preparedQty, item.unit)} / ${item.rollCount} 卷</td>
                    <td class="px-3 py-3">${formatQty(item.pickedQty, item.unit)}</td>
                    <td class="px-3 py-3">${formatQty(item.availableToPickupQty, item.unit)}</td>
                    <td class="px-3 py-3">
                      <div class="font-medium">${escapeHtml(item.stockWarehouseName)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.warehouseArea)} / ${escapeHtml(item.locationCode)}</div>
                    </td>
                    <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(item.remark || '随整条配料记录核对')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="mt-4 rounded-md border border-rose-100 bg-rose-50/40 p-3">
            <div class="text-sm font-medium text-rose-700">打回配料记录</div>
            <div class="mt-1 text-xs text-rose-600">打回对象是整条配料记录，必须填写原因；打回后该记录不会继续出现在待领料中。</div>
            <div class="mt-3 grid gap-3 lg:grid-cols-[220px_1fr_auto]">
              <label class="block">
                <span class="text-xs font-medium text-muted-foreground">打回原因（必填）</span>
                <select data-pickup-reject-reason class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">请选择</option>
                  <option>色号不符</option>
                  <option>数量与配料记录不一致</option>
                  <option>卷号/库位无法核对</option>
                  <option>实物标签缺失</option>
                </select>
              </label>
              <label class="block">
                <span class="text-xs font-medium text-muted-foreground">详细说明（必填）</span>
                <input data-pickup-reject-detail class="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" placeholder="请填写打回说明，便于中转仓重新配料" />
              </label>
              <div class="flex items-end gap-2">
                <button type="button" data-nav="${escapeHtml(claimHref)}" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white">办理领料入库</button>
                <button
                  type="button"
                  data-pickup-action="reject-prep-record"
                  data-prep-record-id="${escapeHtml(context.record.prepRecordId)}"
                  class="h-10 rounded-md border border-rose-200 bg-background px-4 text-sm font-medium text-rose-700 hover:bg-rose-50"
                >打回中转仓</button>
              </div>
            </div>
            <div data-pickup-reject-error class="mt-2 hidden text-xs text-rose-700"></div>
          </div>
        </div>
      </section>
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
        <div><div class="text-xs text-muted-foreground">生产单</div><div class="font-medium">${renderProductionOrderCode(order.productionOrderNo)}</div></div>
        <div><div class="text-xs text-muted-foreground">配料单</div><div class="font-medium">${renderPrepOrderCode(order.prepOrderNo, order.productionOrderNo)}</div></div>
        <div><div class="text-xs text-muted-foreground">款式</div><div class="font-medium">${escapeHtml(order.styleNo)} / ${escapeHtml(order.styleName)}</div></div>
        <div><div class="text-xs text-muted-foreground">SPU</div><div class="font-medium">${escapeHtml(order.spu)}</div></div>
        <div><div class="text-xs text-muted-foreground">计划数量</div><div class="font-medium">${order.planQty.toLocaleString('zh-CN')} 件</div></div>
        <div><div class="text-xs text-muted-foreground">客户</div><div class="font-medium">${escapeHtml(order.customerName)}</div></div>
        <div><div class="text-xs text-muted-foreground">交期</div><div class="font-medium">${escapeHtml(order.deliveryDate)}</div></div>
        <div><div class="text-xs text-muted-foreground">领料状态</div><div class="font-medium">${escapeHtml(pickupStatusLabelMap[order.pickupStatus])}</div></div>
      </div>
      ${order.isClosed ? `<div class="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">配料已关闭：${escapeHtml(order.closeReason)} / ${escapeHtml(order.closedAt)}</div>` : ''}
    </section>
  `
}

function renderWarehousePickupRecords(projection: MaterialPrepOrderProjection): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">待加工仓入库记录</h3>
      <p class="mt-1 text-sm text-muted-foreground">这里展示裁床执行中转仓领料后，写入待加工仓的领料/入库记录。</p>
      <div class="mt-3 overflow-x-auto">
        <table class="w-full min-w-[980px] text-left text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2">领料记录</th>
              <th class="px-3 py-2">配料记录</th>
              <th class="px-3 py-2">物料</th>
              <th class="px-3 py-2">领料数量</th>
              <th class="px-3 py-2">入库库区 / 库位</th>
              <th class="px-3 py-2">接收人 / 时间</th>
              <th class="px-3 py-2">状态</th>
            </tr>
          </thead>
          <tbody>
            ${projection.pickupRecords.length ? projection.pickupRecords.map((record) => {
              const line = projection.lines.find((item) => item.prepLineId === record.prepLineId)
              return `
                <tr class="border-t">
                  <td class="px-3 py-3">
                    <div class="font-medium">${renderPickupRecordCode(record.pickupRecordId, projection.order.productionOrderNo)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">流水：${escapeHtml(record.waitProcessLedgerEventId || '-')}</div>
                  </td>
                  <td class="px-3 py-3">${renderPrepRecordCode(record.prepRecordId, projection.order.productionOrderNo)}</td>
                  <td class="px-3 py-3">
                    <div class="font-medium">${line?.materialSku ? renderMaterialSkuCode(line.materialSku, projection.order.productionOrderNo) : escapeHtml(record.prepLineId)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line ? `${line.materialName} / ${line.color}` : '未匹配物料行')}</div>
                  </td>
                  <td class="px-3 py-3">${formatQty(record.pickedQty, line?.unit || 'yard')} / ${record.rollCount} 卷</td>
                  <td class="px-3 py-3">
                    <div class="font-medium">${escapeHtml(record.warehouseArea)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.locationCode)}</div>
                  </td>
                  <td class="px-3 py-3">
                    <div>${escapeHtml(record.receiverName)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.pickedAt)}</div>
                  </td>
                  <td class="px-3 py-3">
                    ${renderBadge(record.pickupStatus, record.pickupStatus === '差异领料' ? 'warning' : 'success')}
                    ${record.differenceQty ? `<div class="mt-1 text-xs text-rose-700">差异 ${formatQty(record.differenceQty, line?.unit || 'yard')}：${escapeHtml(record.differenceReason)}</div>` : ''}
                  </td>
                </tr>
              `
            }).join('') : `
              <tr>
                <td colspan="7" class="px-3 py-8 text-center text-sm text-muted-foreground">暂无待加工仓入库记录。</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderOrderDetail(projection: MaterialPrepOrderProjection | null): string {
  if (!projection) return ''
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">物料领料明细</h3>
      <p class="mt-1 text-sm text-muted-foreground">按生产单全部物料展示需求、已确认配料、已领料、来源仓库和缺料进度。</p>
      <div class="mt-3 flex flex-wrap gap-4">
        <div>
          <div class="text-xs text-muted-foreground">款式/SPU 图</div>
          <div class="mt-1">${renderImageThumb(projection.order.spuImageUrl, `${projection.order.styleNo} / ${projection.order.spu} 款式SPU图`, 'h-24 w-24')}</div>
        </div>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-3 text-sm lg:grid-cols-5">
        <div><div class="text-xs text-muted-foreground">生产单</div><div class="font-medium">${renderProductionOrderCode(projection.order.productionOrderNo)}</div></div>
        <div><div class="text-xs text-muted-foreground">配料单</div><div class="font-medium">${renderPrepOrderCode(projection.order.prepOrderNo, projection.order.productionOrderNo)}</div></div>
        <div><div class="text-xs text-muted-foreground">已确认可领</div><div class="font-medium">${formatQty(projection.totalAvailableToPickupQty)}</div></div>
        <div><div class="text-xs text-muted-foreground">已领料</div><div class="font-medium">${formatQty(projection.totalPickedQty)}</div></div>
        <div><div class="text-xs text-muted-foreground">缺料</div><div class="font-medium">${formatQty(projection.totalShortageQty)}</div></div>
      </div>
      <div class="mt-3 overflow-x-auto">
        <table class="w-full min-w-[1120px] text-left text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2">图片</th>
              <th class="px-3 py-2">类别</th>
              <th class="px-3 py-2">物料</th>
              <th class="px-3 py-2">需求</th>
              <th class="px-3 py-2">已确认配料</th>
              <th class="px-3 py-2">已领</th>
              <th class="px-3 py-2">来源仓库</th>
              <th class="px-3 py-2">缺料进度</th>
            </tr>
          </thead>
          <tbody>
            ${projection.lines.map((line) => `
              <tr class="border-t">
                <td class="px-3 py-3">${renderMaterialThumb(line)}</td>
                <td class="px-3 py-3">${renderBadge(line.materialType, line.materialType === '面料' ? 'info' : line.materialType === '辅料' ? 'warning' : line.materialType === '纱线' ? 'success' : 'neutral')}</td>
                <td class="px-3 py-3">
                  <div class="font-medium">${renderMaterialSkuCode(line.materialSku, projection.order.productionOrderNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.materialName)} / ${escapeHtml(line.color)}</div>
                </td>
                <td class="px-3 py-3">${formatQty(line.requiredQty, line.unit)}</td>
                <td class="px-3 py-3">${formatQty(line.confirmedPrepQty, line.unit)}</td>
                <td class="px-3 py-3">${formatQty(line.pickedQty, line.unit)}</td>
                <td class="px-3 py-3">
                  <div class="font-medium">${escapeHtml(line.stockWarehouseName)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.stockWarehouseArea)} / ${escapeHtml(line.stockLocationCode)}</div>
                </td>
                <td class="px-3 py-3">
                  ${renderBadge(line.upstreamProgressStatus, line.upstreamProgressStatus === '已到仓可配' ? 'success' : line.upstreamProgressStatus === '无需跟进' ? 'neutral' : 'warning')}
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

function renderPickupDetail(
  projection: MaterialPrepOrderProjection,
  candidates: PrepRecordPickupCandidate[],
  activeTab: PickupDetailTab,
  activePrepRecordId: string,
  activePrepLineId: string,
): string {
  const content = activeTab === 'records'
    ? renderCandidateList(candidates)
    : activeTab === 'materials'
      ? renderOrderDetail(projection)
      : activeTab === 'warehouse'
        ? renderWarehousePickupRecords(projection)
        : activeTab === 'reject'
          ? renderRejectPanel(activePrepRecordId, activePrepLineId)
          : renderProductionDemand(projection)
  return `
    <div class="space-y-4">
      ${renderDetailTabs(projection, candidates, activeTab, activePrepRecordId, activePrepLineId)}
      ${content}
    </div>
  `
}

export function renderCraftCuttingPickupManagementPage(): string {
  const params = getSearchParams()
  const activeTab = normalizePickupWorkbenchTab(params.get('tab'))
  const filters = getPickupListFilters(params)
  const allRows = listMaterialPrepOrderProjections()
  const filteredAllRows = allRows.filter((row) => matchesPickupRow(row, filters))
  const candidates = listPickupCandidates().filter((candidate) => matchesPickupCandidate(candidate, filters))
  const rows = getPickupRowsForTab(activeTab === 'WAIT_PICKUP' ? allRows : filteredAllRows, candidates, activeTab)
  const activeOrderId = params.get('prepOrderId') || ''
  const activeProjection = activeOrderId ? allRows.find((row) => row.order.prepOrderId === activeOrderId) || null : null
  const activePrepRecordId = params.get('prepRecordId') || candidates.find((candidate) => candidate.prepOrderId === activeOrderId)?.prepRecordId || ''
  const activePrepLineId = params.get('prepLineId') || candidates.find((candidate) => candidate.prepRecordId === activePrepRecordId)?.defaultPrepLineId || ''
  const showPrepModal = params.get('prepModal') === '1'
  const counts = pickupWorkbenchTabs.reduce<Record<string, number>>((accumulator, tab) => {
    accumulator[tab.key] = getPickupTabCount(filteredAllRows, candidates, tab.key)
    return accumulator
  }, {})

  return `
    <div class="space-y-5 p-6">
      ${renderCuttingPageHeader(getCanonicalCuttingMeta('pickup-management'))}
      ${renderPickupFilters(filters)}
      ${renderCompactKpiGroup(`
        ${renderKpi('待领料', counts.WAIT_PICKUP || 0, '配料已确认待领取')}
        ${renderKpi('打回待仓库处理', counts.REJECTED_WAIT_WLS || 0, '已打回中转仓')}
        ${renderKpi('已领料完结', counts.PICKUP_DONE || 0, '已配齐且已领完')}
        ${renderKpi('按实完结', counts.ACTUAL_CLOSED || 0, '配料端关闭后按实结束')}
      `)}
      ${renderTabs(filteredAllRows, candidates, activeTab)}
      ${renderOrderTable(rows, candidates, activeTab)}
      ${showPrepModal ? renderPrepRecordModal(activeProjection, activePrepRecordId, activePrepLineId, activeTab) : ''}
    </div>
  `
}

export function renderCraftCuttingPickupManagementDetailPage(): string {
  const params = getSearchParams()
  const allRows = listMaterialPrepOrderProjections()
  const activeOrderId = params.get('prepOrderId') || allRows.find((row) => row.order.pickupStatus === 'WAIT_PICKUP')?.order.prepOrderId || allRows[0]?.order.prepOrderId || ''
  const activeProjection = allRows.find((row) => row.order.prepOrderId === activeOrderId) || allRows[0] || null
  const candidates = listPickupCandidates().filter((candidate) => candidate.prepOrderId === activeOrderId)
  const activePrepRecordId = params.get('prepRecordId') || candidates[0]?.prepRecordId || activeProjection?.prepRecords.find((record) => record.recordStatus === 'CONFIRMED')?.prepRecordId || ''
  const activePrepLineId = params.get('prepLineId') || candidates.find((candidate) => candidate.prepRecordId === activePrepRecordId)?.defaultPrepLineId || ''
  const activeDetailTab = getActiveDetailTab(params)
  const backTab = params.get('fromTab') || activeProjection?.order.pickupStatus || 'WAIT_PICKUP'
  const backHref = buildHref({ tab: backTab, prepOrderId: undefined, prepRecordId: undefined, fromTab: undefined })

  if (!activeProjection) {
    return `
      <div class="space-y-5 p-6">
        ${renderCuttingPageHeader(getCanonicalCuttingMeta('pickup-management'), {
          actionsHtml: `<button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(backHref)}">返回领料列表</button>`,
        })}
        <section class="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">未找到领料单。</section>
      </div>
    `
  }

  return `
    <div class="space-y-5 p-6">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="text-sm text-muted-foreground">工艺工厂运营系统 / 裁床厂管理 / 裁前准备 / 领料管理</div>
          <h1 class="mt-1 text-2xl font-bold">领料详情</h1>
          <p class="mt-2 text-sm text-muted-foreground">生产单 ${renderProductionOrderCode(activeProjection.order.productionOrderNo)} / 配料单 ${renderPrepOrderCode(activeProjection.order.prepOrderNo, activeProjection.order.productionOrderNo)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(backHref)}">返回领料列表</button>
        </div>
      </header>
      ${renderPickupDetail(activeProjection, candidates, activeDetailTab, activePrepRecordId, activePrepLineId)}
    </div>
  `
}

export function handleCraftCuttingPickupManagementEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pickup-action]')
  const action = actionNode?.dataset.pickupAction
  if (!actionNode || !action) return false

  if (action === 'apply-list-filters' || action === 'reset-list-filters') {
    const params = getSearchParams()
    params.delete('prepOrderId')
    params.delete('prepRecordId')
    params.delete('prepLineId')
    params.delete('prepModal')
    if (action === 'apply-list-filters') {
      const keyword = document.querySelector<HTMLInputElement>('[data-pickup-filter-field="keyword"]')?.value.trim() || ''
      const materialKeyword = document.querySelector<HTMLInputElement>('[data-pickup-filter-field="materialKeyword"]')?.value.trim() || ''
      if (keyword) params.set('q', keyword)
      else params.delete('q')
      if (materialKeyword) params.set('material', materialKeyword)
      else params.delete('material')
    } else {
      params.delete('q')
      params.delete('material')
    }
    const href = `${window.location.pathname}?${params.toString()}`
    window.history.pushState({}, '', href)
    window.dispatchEvent(new PopStateEvent('popstate'))
    return true
  }

  if (action === 'reject-prep-record') {
    const prepRecordId = actionNode.dataset.prepRecordId || ''
    const container = actionNode.closest<HTMLElement>('.fixed.inset-0') || document.body
    const reasonNode = container.querySelector<HTMLSelectElement>('[data-pickup-reject-reason]')
    const detailNode = container.querySelector<HTMLInputElement>('[data-pickup-reject-detail]')
    const errorNode = container.querySelector<HTMLElement>('[data-pickup-reject-error]')
    const reason = reasonNode?.value.trim() || ''
    const detail = detailNode?.value.trim() || ''
    if (!prepRecordId) return false
    if (!reason || !detail) {
      if (errorNode) {
        errorNode.textContent = '打回原因和详细说明都必须填写。'
        errorNode.classList.remove('hidden')
      }
      return false
    }
    rejectMaterialPrepRecord(prepRecordId, reason, detail, '裁床 李明')
    return true
  }

  return false
}
