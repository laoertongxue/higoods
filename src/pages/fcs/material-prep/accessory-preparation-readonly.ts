// @page-pattern: list
// @list-pagination: none — 详情一次展示当前生产单有限辅料BOM；生产单跟进主列表使用分页。
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  getMaterialPrepRecordItems, getMaterialPrepRecordUnitSummaries, isAccessoryWarehouseScopeLine, derivePickupStatus,
  type MaterialPrepOrderProjection, type MaterialPrepOrderStatus, type MaterialPrepUnitSummary,
} from '../../../data/fcs/cutting/production-material-prep.ts'
import { listAccessoryWarehouseLocations } from '../../../data/wls/accessory-warehouse-master.ts'
import type { AccessoryPreparation } from '../../../data/wls/accessory-warehouse-flow.ts'
import type { AccessoryWarehouseSourceIssue } from '../../../data/wls/accessory-warehouse-sources.ts'
import { accessoryImage, accessoryOverlay, focusAccessoryOverlay, restoreAccessoryFocus, trapAccessoryOverlayFocus } from '../../wls/accessory-warehouses/shared.ts'
import { escapeHtml } from '../../../utils.ts'

const PREFIX = 'fcs-accessory-readonly'
const basePath = '/fcs/material-prep/sewing'
const gtpPath = '/wls/accessory-warehouses/gtp/preparation'
const unitQty = (value: number, unit: string) => `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 6 })} ${escapeHtml(unit)}`

/** 只裁去本轮已迁入 GTP 的物料；其余旧业务仍沿原行、原记录身份处理。 */
export function retainLegacySewingProjection(projection: MaterialPrepOrderProjection): MaterialPrepOrderProjection | null {
  const lines = projection.lines.filter(line => !isAccessoryWarehouseScopeLine(line, projection.order))
  if (!lines.length) return null
  if (lines.length === projection.lines.length) return projection
  const lineIds = new Set(lines.map(line => line.prepLineId))
  const prepRecords = projection.prepRecords.flatMap(record => {
    const items = getMaterialPrepRecordItems(record).filter(item => lineIds.has(item.prepLineId))
    if (!items.length) return []
    const copy = { ...record, prepLineId: items[0].prepLineId, items }
    const unitSummaries = getMaterialPrepRecordUnitSummaries(copy)
    return [{ ...copy, unitSummaries, preparedQty: unitSummaries.length === 1 ? unitSummaries[0].preparedQty : null, rollCount: items.reduce((sum, item) => sum + item.rollCount, 0) }]
  })
  const recordIds = new Set(prepRecords.map(record => record.prepRecordId))
  const pickupRecords = projection.pickupRecords.filter(record => lineIds.has(record.prepLineId))
  const unitMap = new Map<string, MaterialPrepUnitSummary>()
  for (const line of lines) {
    const value = unitMap.get(line.unit) || { unit: line.unit, requiredQty: 0, confirmedPrepQty: 0, grossPickedQty: 0, returnedQty: 0, effectivePickedQty: 0, availableToPickupQty: 0, shortageQty: 0 }
    value.requiredQty += line.requiredQty
    value.confirmedPrepQty += line.confirmedPrepQty
    value.grossPickedQty += line.pickedQty
    value.returnedQty += line.returnedQty
    value.effectivePickedQty += Math.max(line.pickedQty - line.returnedQty, 0)
    value.availableToPickupQty += Math.max(line.confirmedPrepQty - Math.max(line.pickedQty - line.returnedQty, 0), 0)
    value.shortageQty += line.shortageQty
    unitMap.set(line.unit, value)
  }
  const unitSummaries = [...unitMap.values()]
  const one = unitSummaries.length === 1 ? unitSummaries[0] : null
  const needed = lines.filter(line => line.remainingNeedQty > 0)
  const status: MaterialPrepOrderStatus = projection.order.isClosed ? 'CLOSED'
    : prepRecords.some(record => record.recordStatus === 'REJECTED') ? 'REJECTED_REWORK'
      : !needed.length ? 'READY'
        : needed.every(line => line.availableStockQty >= line.remainingNeedQty) ? 'NEED_PREP_ALL_STOCK'
          : needed.some(line => line.availableStockQty > 0) ? 'NEED_PREP_PARTIAL_STOCK' : 'NEED_PREP_NO_STOCK'
  return {
    ...projection,
    order: { ...projection.order, overallPrepStatus: status, pickupStatus: derivePickupStatus(lines, prepRecords, pickupRecords, projection.order.isClosed) },
    lines, prepRecords, pickupRecords,
    pickupReturnRecords: projection.pickupReturnRecords.filter(record => lineIds.has(record.prepLineId)),
    rejectRecords: projection.rejectRecords.filter(record => lineIds.has(record.prepLineId)),
    stagingRecords: projection.stagingRecords.filter(record => recordIds.has(record.prepRecordId)),
    taskProjections: projection.taskProjections.flatMap(task => {
      const materialLines = task.materialLines.filter(line => lineIds.has(line.prepLineId))
      return materialLines.length ? [{ ...task, materialLines, materialCount: materialLines.length, prepRecordCount: new Set(materialLines.flatMap(line => line.prepRecords.map(record => record.prepRecordId))).size }] : []
    }),
    unitSummaries, totalRequiredQty: one?.requiredQty ?? null, totalConfirmedPrepQty: one?.confirmedPrepQty ?? null,
    totalPickedQty: one?.grossPickedQty ?? null, totalReturnedQty: one?.returnedQty ?? null,
    totalAvailableToPickupQty: one?.availableToPickupQty ?? null, totalShortageQty: one?.shortageQty ?? null,
    lineCount: lines.length, readyLineCount: lines.filter(line => line.confirmedPrepQty >= line.requiredQty).length,
    shortageLineCount: needed.length, returnedLineCount: lines.filter(line => line.returnedQty > 0).length,
    canContinuePrepLineCount: lines.filter(line => line.canPrepQty > 0).length,
    stockSufficientLineCount: needed.filter(line => line.availableStockQty >= line.remainingNeedQty).length,
    stockInsufficientLineCount: needed.filter(line => line.availableStockQty > 0 && line.availableStockQty < line.remainingNeedQty).length,
    noStockLineCount: needed.filter(line => line.availableStockQty <= 0).length,
    rejectedRecordCount: prepRecords.filter(record => record.recordStatus === 'REJECTED').length,
  }
}

interface FollowupRow {
  id: string
  productionOrderNo: string
  styleName: string
  styleImageUrl: string
  preparation?: AccessoryPreparation
  legacyLineCount: number
}
let followupListSource: { preparations: AccessoryPreparation[]; legacy: MaterialPrepOrderProjection[] } | null = null
function href(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
  for (const [key, value] of Object.entries(values)) value ? params.set(key, value) : params.delete(key)
  return `${basePath}${params.size ? `?${params}` : ''}`
}
function progress(preparation: AccessoryPreparation): string {
  return [...new Set(preparation.lines.map(line => line.unit))].map(unit => {
    const lines = preparation.lines.filter(line => line.unit === unit)
    return `已配 ${unitQty(lines.reduce((sum, line) => sum + line.preparedQty, 0), unit)} / 应配 ${unitQty(lines.reduce((sum, line) => sum + line.requiredQty, 0), unit)}`
  }).join('<br>')
}
const listColumns: StandardListColumn<FollowupRow>[] = [
  { key: 'order', title: '生产单 / 款式', width: 300, required: true, render: row => `<div class="flex items-center gap-3">${accessoryImage(row.styleImageUrl, row.styleName)}<div><strong>${escapeHtml(row.productionOrderNo)}</strong><p>${escapeHtml(row.styleName)}</p></div></div>` },
  { key: 'accessory', title: 'GTP 辅料配料', width: 300, render: row => row.preparation ? `<span class="font-medium">${escapeHtml(row.preparation.status)}</span><p class="mt-1 text-xs">${progress(row.preparation)}</p>` : '不涉及本轮辅料' },
  { key: 'other', title: '其他用料', width: 120, render: row => row.legacyLineCount ? `${row.legacyLineCount} 行` : '—' },
  { key: 'actions', title: '操作', width: 180, required: true, actionColumn: true, render: row => `<button class="rounded border px-3 py-2 text-sm" data-nav="${escapeHtml(href({ prepOrderId: row.id, page: undefined, prepModal: undefined, closeModal: undefined }))}">查看跟进</button>` },
]

export function renderAccessoryPreparationFollowupList(preparations: AccessoryPreparation[], legacy: MaterialPrepOrderProjection[], keyword = ''): string {
  followupListSource = { preparations, legacy }
  const rows = new Map<string, FollowupRow>()
  for (const preparation of preparations) rows.set(preparation.id, { id: preparation.id, productionOrderNo: preparation.productionOrderNo, styleName: preparation.styleName, styleImageUrl: preparation.styleImageUrl, preparation, legacyLineCount: 0 })
  for (const projection of legacy) {
    const existing = rows.get(projection.order.prepOrderId)
    if (existing) existing.legacyLineCount = projection.lines.length
    else rows.set(projection.order.prepOrderId, { id: projection.order.prepOrderId, productionOrderNo: projection.order.productionOrderNo, styleName: projection.order.styleName, styleImageUrl: projection.order.spuImageUrl, legacyLineCount: projection.lines.length })
  }
  const filtered = [...rows.values()].filter(row => !keyword.trim() || [row.productionOrderNo, row.styleName, ...(row.preparation?.lines.map(line => line.materialName) || [])].join(' ').toLowerCase().includes(keyword.trim().toLowerCase()))
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
  const requestedSize = Number(params.get('pageSize') || 10)
  const pageSize = [10, 20, 50].includes(requestedSize) ? requestedSize : 10
  const page = paginateStandardListRows(filtered, Number(params.get('page') || 1), pageSize)
  return `<div data-fcs-accessory-readonly data-skip-page-rerender="true">${renderStandardListPage({
    title: '车缝配料跟进',
    primaryActionsHtml: `<button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-nav="${gtpPath}">前往 GTP 办理辅料配料</button>`,
    filtersHtml: `<div class="flex flex-wrap items-end gap-3 rounded border bg-card p-3"><label class="grid min-w-60 gap-1 text-sm">生产单 / 款式 / 辅料<input class="h-9 rounded border px-3" data-fcs-material-prep-action="search-input" data-skip-page-rerender="true" value="${escapeHtml(keyword)}"></label><button class="h-9 rounded border px-4 text-sm" data-fcs-material-prep-action="search-apply">查询</button><button class="h-9 rounded border px-4 text-sm" data-${PREFIX}-action="reset">重置</button></div>`,
    statsHtml: renderStandardListStats([{ label: '生产单', value: filtered.length }, { label: '辅料待配齐', value: filtered.filter(row => row.preparation && row.preparation.status !== '已配齐').length }, { label: '辅料已配齐', value: filtered.filter(row => row.preparation?.status === '已配齐').length }]),
    listTitle: '生产单配料跟进',
    tableHtml: renderStandardListTable({ columns: listColumns, rows: page.rows, preferences: { order: listColumns.map(column => column.key), visibleKeys: listColumns.map(column => column.key), frozenKeys: [], pageSize }, sort: null, eventPrefix: PREFIX }),
    paginationHtml: renderTablePagination({ ...page, actionPrefix: PREFIX, pageSizeOptions: [10, 20, 50], skipPageRerender: true }),
  })}<div data-fcs-accessory-overlay></div></div>`
}

export function renderAccessoryPreparationFollowupDetail(preparation: AccessoryPreparation, issues: AccessoryWarehouseSourceIssue[], hasOtherLines: boolean): string {
  const locationCodes = new Map(listAccessoryWarehouseLocations().map(location => [location.id, location.locationCode]))
  const code = (value: string) => escapeHtml(locationCodes.get(value) || value || '未登记')
  const columns: StandardListColumn<AccessoryPreparation['lines'][number]>[] = [
    { key: 'material', title: '辅料', width: 280, required: true, render: line => `<div class="flex items-center gap-3">${accessoryImage(line.imageUrl, line.materialName)}<div><strong>${escapeHtml(line.materialName)}</strong>${line.materialSku && !/-bom-|prep-line-|::/.test(line.materialSku) ? `<p class="text-xs text-muted-foreground">${escapeHtml(line.materialSku)}</p>` : ''}<p class="text-xs text-muted-foreground">${escapeHtml([line.color, line.spec].filter(Boolean).join(' · '))}</p></div></div>` },
    { key: 'required', title: '应配', width: 130, render: line => unitQty(line.requiredQty, line.unit) },
    { key: 'prepared', title: '已配', width: 130, render: line => unitQty(line.preparedQty, line.unit) },
    { key: 'remaining', title: '待配', width: 130, render: line => unitQty(Math.max(0, line.requiredQty - line.preparedQty), line.unit) },
    { key: 'locations', title: '配料库位', width: 190, render: line => line.preparedQty <= 0 ? '—' : line.allocations?.length ? line.allocations.map(allocation => `${code(allocation.locationId)}：${unitQty(allocation.qty, line.unit)}`).join('<br>') : code(line.locationId) },
  ]
  const detail = (text: string) => {
    let result = text
    for (const [id, label] of locationCodes) result = result.split(id).join(label)
    return escapeHtml(result)
  }
  return `<div data-fcs-accessory-readonly="${escapeHtml(preparation.id)}" data-skip-page-rerender="true" class="p-4 space-y-4">
    <header class="flex flex-wrap items-start justify-between gap-3"><div class="flex items-center gap-3">${accessoryImage(preparation.styleImageUrl, preparation.styleName)}<div><h1 class="text-xl font-semibold">${escapeHtml(preparation.productionOrderNo)} · 辅料配料跟进</h1><p class="mt-1 text-sm">${escapeHtml(preparation.styleName)} · ${escapeHtml(preparation.status)}</p></div></div><div class="flex flex-wrap gap-2"><button class="rounded border px-3 py-2 text-sm" data-nav="${basePath}">返回跟进列表</button><button class="rounded bg-blue-600 px-3 py-2 text-sm text-white" data-nav="${gtpPath}">前往 GTP 办理</button></div></header>
    <p class="text-sm text-muted-foreground">辅料配料由辅料中央仓（GTP）办理，此处查看清单、进度和记录。</p>
    ${issues.length ? `<div role="alert" class="rounded border border-amber-200 bg-amber-50 p-3 text-sm">${issues.map(issue => `<p>${escapeHtml(issue.message)}</p>`).join('')}</div>` : ''}
    ${renderStandardListPage({ title: '辅料清单', showHeader: false, filtersHtml: '', listTitle: '辅料清单', tableHtml: renderStandardListTable({ columns, rows: preparation.lines, preferences: { order: columns.map(column => column.key), visibleKeys: columns.map(column => column.key), frozenKeys: [], pageSize: preparation.lines.length }, sort: null, eventPrefix: PREFIX }), paginationHtml: '' })}
    <section class="rounded border bg-card p-4"><h2 class="font-semibold">配料备注</h2><p class="mt-2 whitespace-pre-wrap text-sm">${escapeHtml(preparation.remark || '暂无备注')}</p></section>
    <section class="rounded border bg-card p-4"><h2 class="font-semibold">配料记录</h2>${preparation.history.length ? `<ol class="mt-3 space-y-2">${preparation.history.map(item => `<li class="rounded border p-3 text-sm"><strong>${escapeHtml(item.action)}</strong><p class="mt-1 whitespace-pre-wrap">${detail(item.detail)}</p><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.by)} · ${escapeHtml(item.at)}</p></li>`).join('')}</ol>` : '<p class="mt-2 text-sm text-muted-foreground">尚无配料记录。</p>'}</section>
    ${hasOtherLines ? '<p class="text-sm font-medium">其他用料沿原流程跟进，见下方明细。</p>' : ''}<div data-fcs-accessory-overlay></div></div>`
}

export function handleAccessoryPreparationReadonlyEvent(target: HTMLElement): boolean {
  const root = target.closest<HTMLElement>('[data-fcs-accessory-readonly]')
  if (!root) return false
  const field = target.closest<HTMLSelectElement>(`[data-${PREFIX}-field="pageSize"]`)
  const node = target.closest<HTMLElement>(`[data-${PREFIX}-action]`)
  const search = target.closest<HTMLElement>('[data-fcs-material-prep-action="search-apply"]')
  if ((field || node || search) && followupListSource && !root.dataset.fcsAccessoryReadonly) {
    const params = new URLSearchParams(window.location.search)
    if (field) { params.set('pageSize', field.value); params.delete('page') }
    else if (search) {
      const keyword = root.querySelector<HTMLInputElement>('[data-fcs-material-prep-action="search-input"]')?.value.trim() || ''
      if (keyword) params.set('keyword', keyword); else params.delete('keyword')
      params.delete('page')
    } else if (node?.dataset.fcsAccessoryReadonlyAction === 'reset') { params.delete('keyword'); params.delete('page') }
    else {
      const page = Math.max(1, Number(params.get('page') || 1) + (node?.dataset.fcsAccessoryReadonlyAction === 'next-page' ? 1 : -1))
      params.set('page', String(page))
    }
    // 查询与分页只更新当前列表，避免与外壳的异步路由渲染重复读取。
    window.history.pushState({}, '', `${basePath}${params.size ? `?${params}` : ''}`)
    root.outerHTML = renderAccessoryPreparationFollowupList(followupListSource.preparations, followupListSource.legacy, params.get('keyword') || '')
    return true
  }
  const image = target.closest<HTMLElement>('[data-accessory-action]')
  if (image?.dataset.accessoryAction === 'close-image') { document.querySelector('[data-fcs-accessory-overlay]')?.replaceChildren(); restoreAccessoryFocus(); return true }
  if (image?.dataset.accessoryAction === 'image') {
    const host = document.querySelector('[data-fcs-accessory-overlay]')
    if (host) { host.innerHTML = accessoryOverlay(image.dataset.label || '图片', `<img src="${escapeHtml(image.dataset.image || '')}" alt="${escapeHtml(image.dataset.label || '')}" class="mx-auto max-h-[70vh] max-w-full object-contain" onerror="this.nextElementSibling.hidden=false"><p hidden class="mt-2 text-sm text-red-600">图片加载失败，关闭后重试。</p>`, '', 'close-image'); focusAccessoryOverlay() }
    return true
  }
  return false
}
if (typeof document !== 'undefined') document.addEventListener('keydown', event => {
  if (!document.querySelector('[data-fcs-accessory-readonly] [data-aw-overlay]')) return
  trapAccessoryOverlayFocus(event)
  if (event.key === 'Escape') { document.querySelector('[data-fcs-accessory-overlay]')?.replaceChildren(); restoreAccessoryFocus() }
})
