import { escapeHtml } from '../../utils.ts'
import type {
  WarehouseLocationMapCell,
  WarehouseLocationMapProjection,
  WarehouseLocationOccupancy,
} from '../../pages/process-factory/cutting/warehouse-location-map-model.ts'
import {
  listWarehouseLocationMapCells,
  listWarehouseLocationMapShelfCells,
} from '../../pages/process-factory/cutting/warehouse-location-map-model.ts'

export type WarehouseLocationMapMode = 'VIEW' | 'SELECT' | 'LAYOUT'

export const WAREHOUSE_LEVEL_VIEWPORT_PAGE_SIZE = 8
export const WAREHOUSE_POSITION_VIEWPORT_PAGE_SIZE = 12

export function maxWarehouseShelfPositionCount(levels: ReadonlyArray<{ locations: readonly unknown[] }>): number {
  let maximum = 0
  for (const level of levels) {
    if (level.locations.length > maximum) maximum = level.locations.length
  }
  return maximum
}

export function resolveWarehouseShelfViewportPagination(
  levels: ReadonlyArray<{ locations: readonly unknown[] }>,
  requestedLevelPage = 1,
  requestedPositionPage = 1,
): { levelPage: number; levelPageCount: number; positionPage: number; positionPageCount: number } {
  const levelPageCount = Math.max(1, Math.ceil(levels.length / WAREHOUSE_LEVEL_VIEWPORT_PAGE_SIZE))
  const positionPageCount = Math.max(1, Math.ceil(maxWarehouseShelfPositionCount(levels) / WAREHOUSE_POSITION_VIEWPORT_PAGE_SIZE))
  return {
    levelPage: Math.min(Math.max(1, requestedLevelPage), levelPageCount),
    levelPageCount,
    positionPage: Math.min(Math.max(1, requestedPositionPage), positionPageCount),
    positionPageCount,
  }
}

export interface WarehouseLocationMapOptions {
  projection: WarehouseLocationMapProjection
  mode: WarehouseLocationMapMode
  factoryName: string
  selectedLocationIds?: string[]
  feedbackMessage?: string
  openLocationId?: string
  occupancyPage?: number
  unlocatedPage?: number
}

function renderCell(
  cell: WarehouseLocationMapCell,
  mode: WarehouseLocationMapMode,
  selectedIds: Set<string>,
): string {
  const occupied = cell.businessStatus === 'OCCUPIED'
  const selected = selectedIds.has(cell.locationId)
  const unavailableReason = cell.areaStatus !== 'AVAILABLE'
    ? '库区已停用'
    : cell.shelfStatus !== 'AVAILABLE'
      ? '货架已停用'
      : cell.status !== 'AVAILABLE'
        ? '库位已停用'
        : ''
  const hasOccupancyDetail = occupied && cell.occupancies.length > 0
  const selectionDisabled = Boolean(unavailableReason) || (occupied && !hasOccupancyDetail)
  const selectionButtonDisabled = selectionDisabled && !selected && !hasOccupancyDetail
  const action = mode === 'SELECT'
    ? selected
      ? 'toggle-location'
      : hasOccupancyDetail
        ? 'open-occupancy'
        : !selectionDisabled && !occupied
          ? 'toggle-location'
          : ''
    : hasOccupancyDetail ? 'open-occupancy' : ''
  const summary = cell.occupancies[0]
  const rollSummary = summary?.rollDetails?.length
    ? `${summary.rollDetails.length} 卷 · ${Number(summary.rollDetails.reduce((sum, roll) => sum + roll.yard, 0).toFixed(2))} Yard / ${Number(summary.rollDetails.reduce((sum, roll) => sum + roll.meter, 0).toFixed(2))} 米`
    : summary?.rollCount
      ? `${summary.rollCount} 卷 · 卷明细待补充`
    : ''
  const bagSummary = summary?.bagCode
    ? `${summary.bagCode} · ${summary.ticketNos?.length ?? 0} 张菲票 · ${summary.qty} ${summary.unit}`
    : ''
  const statusClass = occupied
    ? 'border-rose-300 bg-rose-50 text-rose-800'
    : unavailableReason
      ? 'border-slate-300 bg-slate-100 text-slate-600'
    : selected
      ? 'border-blue-600 bg-blue-600 text-white ring-2 ring-blue-200'
      : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
  return `
    <div class="shrink-0">
      <button
        type="button"
        class="relative min-h-11 min-w-[9.5rem] rounded-md border px-2 py-1.5 text-left text-xs ${statusClass} ${mode === 'SELECT' && selectionButtonDisabled ? 'cursor-not-allowed opacity-60' : ''}"
        data-skip-page-rerender="true"
        data-warehouse-map-action="${action}"
        data-location-id="${escapeHtml(cell.locationId)}"
        data-location-no="${escapeHtml(cell.locationNo)}"
        data-position-no="${cell.positionNo}"
        aria-pressed="${selected}"
        ${mode === 'SELECT' && selectionButtonDisabled ? 'disabled aria-disabled="true"' : ''}
      >
        <span class="block font-semibold">P${String(cell.positionNo).padStart(2, '0')} · ${occupied ? '占用' : '空闲'}</span>
        <span class="mt-0.5 block font-mono">${escapeHtml(cell.locationNo)}</span>
        ${unavailableReason ? `<span class="mt-0.5 block">${escapeHtml(unavailableReason)}，不可选择</span>` : ''}
        ${occupied && summary ? `
          <span class="mt-1 block max-w-28 truncate" title="${escapeHtml(summary.productionOrderNo || '未关联生产单')}">${escapeHtml(summary.productionOrderNo || '未关联生产单')}</span>
          <span class="block max-w-28 truncate" title="${escapeHtml(summary.objectName)}">${escapeHtml(summary.objectName)}</span>
          <span class="block max-w-36 truncate" title="${escapeHtml(rollSummary || bagSummary || `${summary.qty} ${summary.unit}`)}">${escapeHtml(rollSummary || bagSummary || `${summary.qty} ${summary.unit}`)}</span>
          ${cell.occupancies.length > 1 ? `<span class="block">等 ${cell.occupancies.length} 项</span>` : ''}
        ` : ''}
        ${selected ? '<span class="absolute right-1 top-0.5 font-bold">✓</span>' : ''}
      </button>
      ${mode === 'LAYOUT' ? `
        <div class="mt-1 flex justify-center gap-1">
          <button type="button" class="min-h-11 min-w-11 rounded border text-xs" aria-label="${escapeHtml(cell.locationNo)} 左移" data-skip-page-rerender="true" data-warehouse-map-action="move-location-left" data-location-id="${escapeHtml(cell.locationId)}" data-shelf-id="${escapeHtml(cell.shelfId)}">←</button>
          <button type="button" class="min-h-11 min-w-11 rounded border text-xs" aria-label="修改 ${escapeHtml(cell.locationNo)} 编号" data-skip-page-rerender="true" data-warehouse-map-action="rename-location" data-location-id="${escapeHtml(cell.locationId)}">改</button>
          <button type="button" class="min-h-11 min-w-11 rounded border text-xs" aria-label="${escapeHtml(cell.locationNo)} 右移" data-skip-page-rerender="true" data-warehouse-map-action="move-location-right" data-location-id="${escapeHtml(cell.locationId)}" data-shelf-id="${escapeHtml(cell.shelfId)}">→</button>
        </div>
      ` : mode === 'VIEW' ? `<button type="button" class="mt-1 min-h-11 w-full rounded border px-2 text-xs" data-skip-page-rerender="true" data-warehouse-map-action="open-print-location-label" data-location-id="${escapeHtml(cell.locationId)}">打印标签</button>` : ''}
    </div>
  `
}

function viewportControl(action: 'viewport-level-page' | 'viewport-position-page', label: string, pageAction: 'first' | 'previous' | 'next' | 'last', disabled: boolean): string {
  return `<button type="button" class="min-h-11 rounded-md border px-3 text-xs disabled:opacity-40" data-skip-page-rerender="true" data-warehouse-map-action="${action}" data-page-action="${pageAction}" ${disabled ? 'disabled' : ''}>${label}</button>`
}

function renderShelfViewport(
  shelf: WarehouseLocationMapProjection['areas'][number]['shelves'][number],
  mode: WarehouseLocationMapMode,
  selectedIds: Set<string>,
  requestedLevelPage = 1,
  requestedPositionPage = 1,
): string {
  const { levelPage, levelPageCount, positionPage, positionPageCount } = resolveWarehouseShelfViewportPagination(
    shelf.levels,
    requestedLevelPage,
    requestedPositionPage,
  )
  const visibleLevels = shelf.levels.slice((levelPage - 1) * WAREHOUSE_LEVEL_VIEWPORT_PAGE_SIZE, levelPage * WAREHOUSE_LEVEL_VIEWPORT_PAGE_SIZE)
  const positionStart = (positionPage - 1) * WAREHOUSE_POSITION_VIEWPORT_PAGE_SIZE
  return `<div class="min-w-0" data-warehouse-map-shelf-viewport data-shelf-id="${escapeHtml(shelf.shelfId)}" data-level-page="${levelPage}" data-position-page="${positionPage}">
    ${levelPageCount > 1 || positionPageCount > 1 ? `<div class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/30 px-3 py-2 text-xs">
      <div class="flex flex-wrap items-center gap-2"><span>层 第 ${levelPage}/${levelPageCount} 页</span>${viewportControl('viewport-level-page', '首层', 'first', levelPage === 1)}${viewportControl('viewport-level-page', '上一组层', 'previous', levelPage === 1)}${viewportControl('viewport-level-page', '下一组层', 'next', levelPage === levelPageCount)}${viewportControl('viewport-level-page', '末层', 'last', levelPage === levelPageCount)}</div>
      <div class="flex flex-wrap items-center gap-2"><span>位置 第 ${positionPage}/${positionPageCount} 页</span>${viewportControl('viewport-position-page', '首位置', 'first', positionPage === 1)}${viewportControl('viewport-position-page', '上一组位置', 'previous', positionPage === 1)}${viewportControl('viewport-position-page', '下一组位置', 'next', positionPage === positionPageCount)}${viewportControl('viewport-position-page', '末位置', 'last', positionPage === positionPageCount)}</div>
    </div>` : ''}
    <div class="min-w-0 overflow-x-auto pb-1" data-warehouse-shelf-scroll><div class="min-w-max space-y-2">
      ${visibleLevels.map((level) => `<div class="grid grid-cols-[4rem_auto] items-start gap-2" data-warehouse-level-no="${level.levelNo}"><div class="sticky left-0 z-10 flex min-h-11 items-center rounded-md border bg-card px-2 text-xs font-semibold">L${String(level.levelNo).padStart(2, '0')}</div><div class="flex gap-2">${level.locations.slice(positionStart, positionStart + WAREHOUSE_POSITION_VIEWPORT_PAGE_SIZE).map((cell) => renderCell(cell, mode, selectedIds)).join('')}</div></div>`).join('')}
    </div></div>
  </div>`
}

function moveViewportPage(current: number, count: number, action: string | undefined): number {
  if (action === 'first') return 1
  if (action === 'previous') return Math.max(1, current - 1)
  if (action === 'next') return Math.min(count, current + 1)
  if (action === 'last') return count
  return current
}

export function handleWarehouseLocationMapViewportEvent(target: HTMLElement, projection: WarehouseLocationMapProjection): boolean {
  const actionNode = target.closest<HTMLElement>('[data-warehouse-map-action]')
  const action = actionNode?.dataset.warehouseMapAction
  if (!actionNode || !['viewport-level-page', 'viewport-position-page'].includes(action || '')) return false
  const mapRoot = actionNode.closest<HTMLElement>('[data-warehouse-map-root]')
  const viewport = actionNode.closest<HTMLElement>('[data-warehouse-map-shelf-viewport]')
  if (!mapRoot || !viewport) return false
  const shelf = projection.areas.flatMap((area) => area.shelves).find((item) => item.shelfId === viewport.dataset.shelfId)
  if (!shelf) return false
  const selectedIds = new Set(Array.from(mapRoot.querySelectorAll<HTMLElement>('[data-warehouse-map-selected-item]')).map((item) => item.dataset.locationId || '').filter(Boolean))
  const { levelPageCount, positionPageCount } = resolveWarehouseShelfViewportPagination(shelf.levels)
  let levelPage = Number(viewport.dataset.levelPage) || 1
  let positionPage = Number(viewport.dataset.positionPage) || 1
  if (action === 'viewport-level-page') levelPage = moveViewportPage(levelPage, levelPageCount, actionNode.dataset.pageAction)
  else positionPage = moveViewportPage(positionPage, positionPageCount, actionNode.dataset.pageAction)
  const template = document.createElement('template')
  template.innerHTML = renderShelfViewport(shelf, (mapRoot.dataset.warehouseMapMode as WarehouseLocationMapMode) || 'VIEW', selectedIds, levelPage, positionPage).trim()
  const nextViewport = template.content.firstElementChild
  if (nextViewport) viewport.replaceWith(nextViewport)
  return true
}

function renderPageControls(
  action: 'occupancy-page' | 'occupancy-detail-page' | 'summary-page' | 'unlocated-page',
  page: number,
  total: number,
  detailId?: string,
): string {
  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  return `
    <div class="mt-3 flex items-center justify-between gap-2 text-xs">
      <span>第 ${page} / ${pageCount} 页 · 每页 ${pageSize} 条 · 共 ${total} 条</span>
      <div class="flex gap-2">
        <button type="button" class="min-h-11 rounded-md border px-3 disabled:opacity-50" data-skip-page-rerender="true" data-warehouse-map-action="${action}" data-page="${page - 1}" ${detailId ? `data-occupancy-id="${escapeHtml(detailId)}"` : ''} ${page <= 1 ? 'disabled' : ''}>上一页</button>
        <button type="button" class="min-h-11 rounded-md border px-3 disabled:opacity-50" data-skip-page-rerender="true" data-warehouse-map-action="${action}" data-page="${page + 1}" ${detailId ? `data-occupancy-id="${escapeHtml(detailId)}"` : ''} ${page >= pageCount ? 'disabled' : ''}>下一页</button>
      </div>
    </div>
  `
}

function renderOccupancyDrawer(
  projection: WarehouseLocationMapProjection,
  requestedLocationId?: string,
  requestedPage?: number,
  requestedDetailId?: string,
  requestedDetailPage?: number,
): string {
  const locationId = requestedLocationId ?? (typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('locationId')
    : '')
  if (!locationId) return ''
  const cell = listWarehouseLocationMapCells(projection).find((item) => item.locationId === locationId)
  if (!cell?.occupancies.length) return ''
  const pageCount = Math.max(1, Math.ceil(cell.occupancies.length / 10))
  const page = Math.min(Math.max(1, requestedPage ?? (Number(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('occupancyPage') : 1,
  ) || 1)), pageCount)
  const occupancies = cell.occupancies.slice((page - 1) * 10, page * 10)
  const detailPage = Math.max(1, requestedDetailPage ?? (Number(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('occupancyDetailPage') : 1,
  ) || 1))
  const detailId = requestedDetailId ?? (typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('occupancyDetailId') || ''
    : '')
  const detailPageForItem = (item: WarehouseLocationOccupancy): number => item.occupancyId === detailId
    ? detailPage
    : 1
  return `
    <aside class="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l bg-background p-5 shadow-xl" data-warehouse-map-occupancy-overlay data-warehouse-map-occupancy-drawer>
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-xs text-muted-foreground">${escapeHtml(cell.areaName)} / ${escapeHtml(cell.shelfNo)}</p>
          <h3 class="mt-1 text-lg font-semibold">${escapeHtml(cell.locationNo)} 占用明细</h3>
        </div>
        <button type="button" class="min-h-11 min-w-11 rounded-md border" data-skip-page-rerender="true" data-warehouse-map-action="close-occupancy">关闭</button>
      </div>
      <div class="mt-4 space-y-3">
        ${occupancies.map((item) => `
          <article class="rounded-lg border p-3 text-sm">
            <div class="flex items-start gap-3">
              ${item.styleImageUrl
                ? `<span class="shrink-0"><img src="${escapeHtml(item.styleImageUrl)}" alt="款式图" class="h-16 w-16 rounded-md border object-cover" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><span hidden class="flex h-16 w-16 items-center justify-center rounded-md border bg-muted/30 px-2 text-center text-xs text-muted-foreground">款式图加载失败</span></span>`
                : '<div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border bg-muted/30 px-2 text-center text-xs text-muted-foreground">款式图待补充</div>'}
              <div class="min-w-0">
                <div class="font-medium">${escapeHtml(item.productionOrderNo || '未关联生产单')}</div>
                <div class="mt-1 text-muted-foreground">${escapeHtml(item.styleName || item.objectName)}</div>
              </div>
            </div>
            ${projection.warehouseKind === 'WAIT_PROCESS' ? (item.materialImageUrl
              ? `<div class="mt-3 flex items-center gap-3"><span><img src="${escapeHtml(item.materialImageUrl)}" alt="物料图" class="h-14 w-14 rounded-md border object-cover" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><span hidden class="flex h-14 w-14 items-center justify-center rounded-md border bg-muted/30 px-2 text-center text-xs text-muted-foreground">物料图加载失败</span></span><span class="text-xs text-muted-foreground">物料图 / ${escapeHtml(item.objectName)}</span></div>`
              : '<div class="mt-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">物料图待补充</div>') : ''}
            <div class="mt-2 grid grid-cols-2 gap-2 text-muted-foreground">
              <span>对象编号：${escapeHtml(item.objectNo)}</span>
              ${item.taskNo ? `<span>裁片任务：${escapeHtml(item.taskNo)}</span>` : ''}
              ${item.cutOrderNo ? `<span>裁片单：${escapeHtml(item.cutOrderNo)}</span>` : ''}
              ${item.ticketNos?.length ? `<span>菲票：${escapeHtml(item.ticketNos.join('、'))}</span>` : ''}
              ${item.bagCode ? `<span>中转袋：${escapeHtml(item.bagCode)}</span>` : ''}
              ${item.packed ? '<span>袋内状态：已装菲票</span>' : ''}
              ${item.unresolvedTicketCount ? `<span>菲票明细待补充：${item.unresolvedTicketCount} 张</span>` : ''}
              <span>数量：${escapeHtml(String(item.qty))} ${escapeHtml(item.unit)}</span>
              <span>入仓人：${escapeHtml(item.inboundBy || '未记录')}</span>
              <span>入仓时间：${escapeHtml(item.inboundAt || '未记录')}</span>
              <span>库位范围：${escapeHtml(item.footprintLocationNos?.join('、') || cell.locationNo)}</span>
              ${item.materialColor ? `<span>颜色：${escapeHtml(item.materialColor)}</span>` : ''}
              ${item.materialSpec ? `<span>规格：${escapeHtml(item.materialSpec)}</span>` : ''}
              ${typeof item.remainingQty === 'number' ? `<span>剩余数量：${escapeHtml(String(item.remainingQty))} ${escapeHtml(item.unit)}</span>` : ''}
            </div>
            ${item.rollDetails?.length ? `
              <div class="mt-3 overflow-x-auto">
                <div class="mb-1 text-xs font-medium text-foreground">${item.rollDetailsAreDemo ? '演示卷明细' : '物料卷明细'}</div>
                <table class="min-w-[560px] w-full text-xs"><thead><tr class="border-b text-left text-muted-foreground"><th class="px-2 py-1">卷号</th><th class="px-2 py-1">Yard</th><th class="px-2 py-1">米</th><th class="px-2 py-1">库位</th></tr></thead><tbody>${item.rollDetails.slice((Math.min(detailPageForItem(item), Math.max(1, Math.ceil(item.rollDetails.length / 10))) - 1) * 10, Math.min(detailPageForItem(item), Math.max(1, Math.ceil(item.rollDetails.length / 10))) * 10).map((roll) => `<tr class="border-b last:border-b-0"><td class="px-2 py-1">${escapeHtml(roll.rollNo)}</td><td class="px-2 py-1">${escapeHtml(String(roll.yard))}</td><td class="px-2 py-1">${escapeHtml(String(roll.meter))}</td><td class="px-2 py-1">${escapeHtml(roll.locationNo || cell.locationNo)}</td></tr>`).join('')}</tbody></table>
                ${renderPageControls('occupancy-detail-page', Math.min(detailPageForItem(item), Math.max(1, Math.ceil(item.rollDetails.length / 10))), item.rollDetails.length, item.occupancyId)}
              </div>
            ` : projection.warehouseKind === 'WAIT_PROCESS' ? '<div class="mt-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">卷明细待补充，当前仅保留总量。</div>' : ''}
            ${item.ticketDetails?.length ? `
              <div class="mt-3 overflow-x-auto">
                <div class="mb-1 text-xs font-medium text-foreground">袋内菲票明细</div>
                <table class="min-w-[640px] w-full text-xs"><thead><tr class="border-b text-left text-muted-foreground"><th class="px-2 py-1">菲票号</th><th class="px-2 py-1">部位</th><th class="px-2 py-1">尺码</th><th class="px-2 py-1">片数</th><th class="px-2 py-1">特殊工艺</th></tr></thead><tbody>${item.ticketDetails.slice((Math.min(detailPageForItem(item), Math.max(1, Math.ceil(item.ticketDetails.length / 10))) - 1) * 10, Math.min(detailPageForItem(item), Math.max(1, Math.ceil(item.ticketDetails.length / 10))) * 10).map((ticket) => `<tr class="border-b last:border-b-0"><td class="px-2 py-1">${escapeHtml(ticket.feiTicketNo)}</td><td class="px-2 py-1">${escapeHtml(ticket.partName)}</td><td class="px-2 py-1">${escapeHtml(ticket.size)}</td><td class="px-2 py-1">${escapeHtml(String(ticket.pieceQty))} 片</td><td class="px-2 py-1">${escapeHtml(ticket.specialCraftText || '无')}</td></tr>`).join('')}</tbody></table>
                ${renderPageControls('occupancy-detail-page', Math.min(detailPageForItem(item), Math.max(1, Math.ceil(item.ticketDetails.length / 10))), item.ticketDetails.length, item.occupancyId)}
              </div>
            ` : projection.warehouseKind === 'WAIT_HANDOVER' && item.packed ? `<div class="mt-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">袋内菲票明细待补充，请按菲票号核对。</div>` : ''}
            ${item.partialOccupancyNote ? `<div class="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">${escapeHtml(item.partialOccupancyNote)}</div>` : ''}
          </article>
        `).join('')}
      </div>
      ${renderPageControls('occupancy-page', page, cell.occupancies.length)}
    </aside>
    <button type="button" class="fixed inset-0 z-40 bg-black/30" aria-label="关闭占用明细" data-warehouse-map-occupancy-overlay data-skip-page-rerender="true" data-warehouse-map-action="close-occupancy"></button>
  `
}

export function renderWarehouseLocationMapOccupancyOverlay(
  projection: WarehouseLocationMapProjection,
  requestedLocationId?: string,
  requestedPage?: number,
  requestedDetailId?: string,
  requestedDetailPage?: number,
): string {
  return renderOccupancyDrawer(projection, requestedLocationId, requestedPage, requestedDetailId, requestedDetailPage)
}

export function handleWarehouseLocationMapOccupancyEvent(
  target: HTMLElement,
  projection: WarehouseLocationMapProjection,
): boolean {
  if (handleWarehouseLocationMapViewportEvent(target, projection)) return true
  const actionNode = target.closest<HTMLElement>('[data-warehouse-map-action]')
  const action = actionNode?.dataset.warehouseMapAction
  if (!actionNode || !['open-occupancy', 'close-occupancy', 'occupancy-page', 'occupancy-detail-page'].includes(action || '')) {
    return false
  }
  const mapRoot = actionNode.closest<HTMLElement>('[data-warehouse-map-root]')
  if (!mapRoot) return false

  if (action === 'open-occupancy') {
    mapRoot.dataset.occupancyLocationId = actionNode.dataset.locationId || ''
    mapRoot.dataset.occupancyPage = '1'
    mapRoot.dataset.occupancyDetailId = ''
    mapRoot.dataset.occupancyDetailPage = '1'
  } else if (action === 'close-occupancy') {
    mapRoot.dataset.occupancyLocationId = ''
  } else if (action === 'occupancy-page') {
    mapRoot.dataset.occupancyPage = actionNode.dataset.page || '1'
    mapRoot.dataset.occupancyDetailId = ''
    mapRoot.dataset.occupancyDetailPage = '1'
  } else if (action === 'occupancy-detail-page') {
    mapRoot.dataset.occupancyDetailId = actionNode.dataset.occupancyId || ''
    mapRoot.dataset.occupancyDetailPage = actionNode.dataset.page || '1'
  }

  mapRoot.querySelectorAll<HTMLElement>('[data-warehouse-map-occupancy-overlay]').forEach((node) => node.remove())
  const locationId = mapRoot.dataset.occupancyLocationId || ''
  if (locationId) {
    mapRoot.insertAdjacentHTML('beforeend', renderWarehouseLocationMapOccupancyOverlay(
      projection,
      locationId,
      Number(mapRoot.dataset.occupancyPage) || 1,
      mapRoot.dataset.occupancyDetailId || '',
      Number(mapRoot.dataset.occupancyDetailPage) || 1,
    ))
  }
  return true
}

export function renderWarehouseLocationMapUnlocatedSection(
  projection: WarehouseLocationMapProjection,
  requestedPage?: number,
): string {
  if (!projection.unlocatedOccupancies.length) return ''
  const pageCount = Math.max(1, Math.ceil(projection.unlocatedOccupancies.length / 10))
  const page = Math.min(Math.max(1, requestedPage ?? (Number(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('unlocatedPage') : 1,
  ) || 1)), pageCount)
  const rows = projection.unlocatedOccupancies.slice((page - 1) * 10, page * 10)
  return `
    <article class="rounded-lg border border-amber-200 bg-amber-50 p-4" data-warehouse-map-unlocated-section>
      <h3 class="font-semibold text-amber-900">待确认历史库位 ${projection.unlocatedOccupancies.length} 条</h3>
      <p class="mt-1 text-sm text-amber-800">历史记录未能唯一匹配当前库位，请人工确认后再纳入库位图。</p>
      <div class="mt-3 space-y-2">
        ${rows.map((item) => `
          <div class="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm">
            <div>${escapeHtml(item.productionOrderNo || '未关联生产单')} · ${escapeHtml(item.objectName)}</div>
            <div class="mt-1 text-xs text-amber-800">${escapeHtml(item.partialOccupancyNote || '历史库位无法唯一匹配，请主管确认后重新定位。')}</div>
          </div>
        `).join('')}
      </div>
      ${renderPageControls('unlocated-page', page, projection.unlocatedOccupancies.length)}
    </article>
  `
}

export function renderWarehouseLocationMapSummarySection(projection: WarehouseLocationMapProjection): string {
  const groups = new Map<string, {
    productionOrderNo: string
    objectNames: Set<string>
    locationIds: Set<string>
    qtyByUnit: Map<string, Map<string, number>>
    footprintIds: Set<string>
    rolls: Map<string, { yard: number; meter: number }>
    reportedRollCount: Map<string, number>
    bagCodes: Set<string>
    tickets: Set<string>
  }>()
  listWarehouseLocationMapCells(projection)
    .flatMap((cell) => cell.occupancies.map((occupancy) => ({ cell, occupancy })))
    .forEach(({ cell, occupancy }) => {
      const key = occupancy.productionOrderNo || occupancy.objectNo
      const group = groups.get(key) ?? {
        productionOrderNo: occupancy.productionOrderNo || '未关联生产单',
        objectNames: new Set<string>(),
        locationIds: new Set<string>(),
        qtyByUnit: new Map<string, Map<string, number>>(),
        footprintIds: new Set<string>(),
        rolls: new Map<string, { yard: number; meter: number }>(),
        reportedRollCount: new Map<string, number>(),
        bagCodes: new Set<string>(),
        tickets: new Set<string>(),
      }
      group.locationIds.add(cell.locationId)
      group.objectNames.add(occupancy.objectName)
      group.footprintIds.add(occupancy.footprintId)
      const qtyByFootprintId = group.qtyByUnit.get(occupancy.unit) ?? new Map<string, number>()
      qtyByFootprintId.set(
        occupancy.footprintId,
        Math.max(qtyByFootprintId.get(occupancy.footprintId) ?? 0, occupancy.qty),
      )
      group.qtyByUnit.set(occupancy.unit, qtyByFootprintId)
      occupancy.rollDetails?.forEach((roll) => group.rolls.set(`${occupancy.footprintId}:${roll.rollNo}`, { yard: roll.yard, meter: roll.meter }))
      if (occupancy.rollCount) group.reportedRollCount.set(occupancy.footprintId, occupancy.rollCount)
      if (occupancy.bagCode) group.bagCodes.add(occupancy.bagCode)
      occupancy.ticketNos?.forEach((ticketNo) => group.tickets.add(ticketNo))
      groups.set(key, group)
    })
  if (!groups.size) return ''
  const pageCount = Math.max(1, Math.ceil(groups.size / 10))
  const page = Math.min(Math.max(1, Number(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('summaryPage') : 1,
  ) || 1), pageCount)
  const rows = Array.from(groups.values()).slice((page - 1) * 10, page * 10)
  return `
    <div class="rounded-lg border bg-card p-4" data-warehouse-map-summary-section>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 class="text-sm font-semibold">生产单占用摘要</h3><span class="text-xs text-muted-foreground">按生产单汇总，多库位不重复计量</span></div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${rows.map((group) => `
          <article class="rounded-md border bg-muted/10 p-3 text-sm">
            <div class="font-medium">${escapeHtml(group.productionOrderNo)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(Array.from(group.objectNames).join('、'))}</div>
            <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              ${projection.warehouseKind === 'WAIT_PROCESS'
                ? `<span>${Math.max(group.rolls.size, ...group.reportedRollCount.values(), 0)} 卷</span><span>${Number((group.rolls.size ? Array.from(group.rolls.values()).reduce((sum, roll) => sum + roll.yard, 0) : Array.from(group.qtyByUnit.entries()).reduce((sum, [unit, rows]) => sum + (['米', 'm'].includes(unit.trim().toLowerCase()) ? Array.from(rows.values()).reduce((qty, value) => qty + value, 0) / 0.9144 : ['yard', 'yards', 'yd', '码'].includes(unit.trim().toLowerCase()) ? Array.from(rows.values()).reduce((qty, value) => qty + value, 0) : 0), 0)).toFixed(2))} Yard / ${Number((group.rolls.size ? Array.from(group.rolls.values()).reduce((sum, roll) => sum + roll.meter, 0) : Array.from(group.qtyByUnit.entries()).reduce((sum, [unit, rows]) => sum + (['米', 'm'].includes(unit.trim().toLowerCase()) ? Array.from(rows.values()).reduce((qty, value) => qty + value, 0) : ['yard', 'yards', 'yd', '码'].includes(unit.trim().toLowerCase()) ? Array.from(rows.values()).reduce((qty, value) => qty + value, 0) * 0.9144 : 0), 0)).toFixed(2))} 米</span>`
                : `<span>${group.bagCodes.size} 袋</span><span>${group.tickets.size} 张菲票</span><span>${Array.from(group.qtyByUnit.get('片')?.values() ?? []).reduce((sum, qty) => sum + qty, 0)} 片</span>`}
              <span>${group.locationIds.size} 个库位</span>
              <span>库存口径 ${Array.from(group.qtyByUnit.entries()).map(([unit, qtyByFootprintId]) => `${escapeHtml(String(Array.from(qtyByFootprintId.values()).reduce((sum, qty) => sum + qty, 0)))} ${escapeHtml(unit)}`).join('、')}</span>
            </div>
          </article>
        `).join('')}
      </div>
      ${renderPageControls('summary-page', page, groups.size)}
    </div>
  `
}

export function renderWarehouseLocationMap(options: WarehouseLocationMapOptions): string {
  const { projection, mode } = options
  const selectedLocationIds = Array.from(new Set(options.selectedLocationIds ?? []))
  const selectedIds = new Set(selectedLocationIds)
  const cellsById = new Map(listWarehouseLocationMapCells(projection).map((cell) => [cell.locationId, cell]))
  const selectedCells = selectedLocationIds.flatMap((locationId) => {
    const cell = cellsById.get(locationId)
    return cell ? [cell] : []
  })
  return `
    <section class="space-y-4" data-warehouse-map-root data-warehouse-map-mode="${mode}" data-warehouse-id="${escapeHtml(projection.warehouseId)}" data-warehouse-kind="${escapeHtml(projection.warehouseKind)}">
      <div class="rounded-lg border bg-card p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-xs text-muted-foreground">${escapeHtml(options.factoryName)}</div>
            <h2 class="mt-1 text-base font-semibold">${escapeHtml(projection.warehouseName)}库位图</h2>
          </div>
          <div class="flex flex-wrap gap-2 text-sm">
            <span class="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">空闲 ${projection.emptyLocationCount}</span>
            <span class="rounded-full bg-rose-50 px-3 py-1 text-rose-700">占用 ${projection.occupiedLocationCount}</span>
            <span class="rounded-full bg-slate-100 px-3 py-1 text-slate-700">共 ${projection.totalLocationCount}</span>
          </div>
        </div>
        ${mode === 'SELECT' ? `
          <div class="mt-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800" data-warehouse-map-selection-summary>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span>已选 ${selectedCells.length} 个库位</span>
              <button type="button" class="min-h-11 rounded-md border border-blue-200 bg-white px-3" data-skip-page-rerender="true" data-warehouse-map-action="clear-selection" ${selectedIds.size ? '' : 'disabled'}>清空选择</button>
            </div>
            ${selectedCells.length ? `<div class="mt-2 flex flex-wrap gap-2" data-warehouse-map-selected-items>${selectedCells.map((cell) => `
              <button type="button" class="min-h-11 rounded-md border border-blue-200 bg-white px-3 font-mono text-xs" data-warehouse-map-selected-item data-skip-page-rerender="true" data-warehouse-map-action="toggle-location" data-location-id="${escapeHtml(cell.locationId)}" data-location-no="${escapeHtml(cell.locationNo)}">${escapeHtml(cell.locationNo)} · 取消</button>
            `).join('')}</div>` : ''}
          </div>
        ` : ''}
        ${options.feedbackMessage ? `<div class="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">${escapeHtml(options.feedbackMessage)}</div>` : ''}
      </div>

      ${mode === 'SELECT' ? '' : renderWarehouseLocationMapSummarySection(projection)}

      ${projection.areas.map((area) => `
        <article class="rounded-lg border bg-card">
          <header class="flex items-center justify-between border-b px-4 py-3">
            <h3 class="font-semibold">库区：${escapeHtml(area.areaName)}</h3>
            ${mode === 'LAYOUT' ? `
              <div class="flex gap-1">
                <button type="button" class="min-h-11 rounded-md border px-3 text-sm" data-skip-page-rerender="true" data-warehouse-map-action="move-area-left" data-area-id="${escapeHtml(area.areaId)}">左移库区</button>
                <button type="button" class="min-h-11 rounded-md border px-3 text-sm" data-skip-page-rerender="true" data-warehouse-map-action="rename-area" data-area-id="${escapeHtml(area.areaId)}">修改库区名称</button>
                <button type="button" class="min-h-11 rounded-md border px-3 text-sm" data-skip-page-rerender="true" data-warehouse-map-action="open-create-shelf" data-area-id="${escapeHtml(area.areaId)}">新增货架</button>
                <button type="button" class="min-h-11 rounded-md border px-3 text-sm" data-skip-page-rerender="true" data-warehouse-map-action="move-area-right" data-area-id="${escapeHtml(area.areaId)}">右移库区</button>
              </div>
            ` : mode === 'VIEW' ? `<button type="button" class="min-h-11 rounded-md border px-3 text-sm" data-skip-page-rerender="true" data-warehouse-map-action="open-print-area-labels" data-area-id="${escapeHtml(area.areaId)}">打印本库区标签</button>` : ''}
          </header>
          <div class="divide-y">
            ${area.shelves.length ? area.shelves.map((shelf) => {
              const shelfCells = listWarehouseLocationMapShelfCells(shelf)
              const selectedCell = shelfCells.find((cell) => selectedIds.has(cell.locationId))
              const selectedLevelIndex = selectedCell ? shelf.levels.findIndex((level) => level.levelNo === selectedCell.levelNo) : -1
              const selectedLevel = selectedLevelIndex >= 0 ? shelf.levels[selectedLevelIndex] : undefined
              const selectedPositionIndex = selectedCell && selectedLevel ? selectedLevel.locations.findIndex((cell) => cell.locationId === selectedCell.locationId) : -1
              const initialLevelPage = selectedLevelIndex >= 0 ? Math.floor(selectedLevelIndex / WAREHOUSE_LEVEL_VIEWPORT_PAGE_SIZE) + 1 : 1
              const initialPositionPage = selectedPositionIndex >= 0 ? Math.floor(selectedPositionIndex / WAREHOUSE_POSITION_VIEWPORT_PAGE_SIZE) + 1 : 1
              return `
              <div class="grid gap-3 p-4 md:grid-cols-[9rem_minmax(0,1fr)]">
                <div>
                  <div class="text-sm font-medium">${escapeHtml(shelf.shelfNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${shelfCells.length} 个库位</div>
                  ${mode === 'LAYOUT' ? `
                    <div class="mt-2 flex gap-1">
                      <button type="button" class="min-h-11 min-w-11 rounded border text-xs" aria-label="${escapeHtml(shelf.shelfNo)} 上移" data-skip-page-rerender="true" data-warehouse-map-action="move-shelf-up" data-area-id="${escapeHtml(area.areaId)}" data-shelf-id="${escapeHtml(shelf.shelfId)}">↑</button>
                      <button type="button" class="min-h-11 min-w-11 rounded border text-xs" aria-label="修改 ${escapeHtml(shelf.shelfNo)} 编号" data-skip-page-rerender="true" data-warehouse-map-action="rename-shelf" data-shelf-id="${escapeHtml(shelf.shelfId)}">改</button>
                      <button type="button" class="min-h-11 min-w-11 rounded border text-xs" aria-label="${escapeHtml(shelf.shelfNo)} 下移" data-skip-page-rerender="true" data-warehouse-map-action="move-shelf-down" data-area-id="${escapeHtml(area.areaId)}" data-shelf-id="${escapeHtml(shelf.shelfId)}">↓</button>
                    </div>
                  ` : mode === 'VIEW' ? `<button type="button" class="mt-2 min-h-11 rounded border px-3 text-xs" data-skip-page-rerender="true" data-warehouse-map-action="open-print-shelf-labels" data-shelf-id="${escapeHtml(shelf.shelfId)}">打印本货架</button>` : ''}
                </div>
                ${renderShelfViewport(shelf, mode, selectedIds, initialLevelPage, initialPositionPage)}
              </div>
            `}).join('') : '<div class="p-6 text-center text-sm text-muted-foreground">暂无货架，请新增货架并预览将生成的 L / P 完整编号。</div>'}
          </div>
        </article>
      `).join('')}

      ${renderWarehouseLocationMapUnlocatedSection(projection, options.unlocatedPage)}
      ${renderWarehouseLocationMapOccupancyOverlay(projection, options.openLocationId, options.occupancyPage)}
    </section>
  `
}
