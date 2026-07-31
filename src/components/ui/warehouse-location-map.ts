import { escapeHtml } from '../../utils.ts'
import type {
  WarehouseLocationMapCell,
  WarehouseLocationMapProjection,
} from '../../pages/process-factory/cutting/warehouse-location-map-model.ts'
import { toggleWarehouseLocationSelection } from '../../pages/process-factory/cutting/warehouse-location-map-model.ts'

export type WarehouseLocationMapMode = 'VIEW' | 'SELECT' | 'LAYOUT'

export interface WarehouseLocationMapOptions {
  projection: WarehouseLocationMapProjection
  mode: WarehouseLocationMapMode
  factoryName: string
  selectedLocationIds?: string[]
  feedbackMessage?: string
  openLocationId?: string
  occupancyPage?: number
  unlocatedPage?: number
  selectionLimit?: number
}

function renderCell(
  cell: WarehouseLocationMapCell,
  mode: WarehouseLocationMapMode,
  selectedIds: Set<string>,
  selectionDisabled: boolean,
): string {
  const occupied = cell.businessStatus === 'OCCUPIED'
  const selected = selectedIds.has(cell.locationId)
  const action = mode === 'SELECT'
    ? (occupied || selectionDisabled ? '' : 'toggle-location')
    : occupied ? 'open-occupancy' : ''
  const summary = cell.occupancies[0]
  const statusClass = occupied
    ? 'border-rose-300 bg-rose-50 text-rose-800'
    : selected
      ? 'border-blue-600 bg-blue-600 text-white ring-2 ring-blue-200'
      : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
  return `
    <div class="shrink-0">
      <button
        type="button"
        class="relative min-h-11 min-w-11 rounded-md border px-2 py-1.5 text-left text-xs ${statusClass} ${mode === 'SELECT' && (occupied || selectionDisabled) ? 'cursor-not-allowed opacity-60' : ''}"
        data-skip-page-rerender="true"
        data-warehouse-map-action="${action}"
        data-location-id="${escapeHtml(cell.locationId)}"
        data-location-no="${escapeHtml(cell.locationNo)}"
        aria-pressed="${selected}"
        ${mode === 'SELECT' && (occupied || selectionDisabled) ? 'disabled aria-disabled="true"' : ''}
      >
        <span class="block font-semibold">${escapeHtml(cell.locationNo)}</span>
        <span class="mt-0.5 block">${occupied ? '占用' : '空闲'}</span>
        ${occupied && summary ? `
          <span class="mt-1 block max-w-28 truncate" title="${escapeHtml(summary.productionOrderNo || '未关联生产单')}">${escapeHtml(summary.productionOrderNo || '未关联生产单')}</span>
          <span class="block max-w-28 truncate" title="${escapeHtml(summary.objectName)}">${escapeHtml(summary.objectName)}</span>
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
      ` : ''}
    </div>
  `
}

function renderPageControls(
  action: 'occupancy-page' | 'unlocated-page',
  page: number,
  total: number,
): string {
  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  return `
    <div class="mt-3 flex items-center justify-between gap-2 text-xs">
      <span>第 ${page} / ${pageCount} 页 · 每页 ${pageSize} 条 · 共 ${total} 条</span>
      <div class="flex gap-2">
        <button type="button" class="min-h-11 rounded-md border px-3 disabled:opacity-50" data-skip-page-rerender="true" data-warehouse-map-action="${action}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>上一页</button>
        <button type="button" class="min-h-11 rounded-md border px-3 disabled:opacity-50" data-skip-page-rerender="true" data-warehouse-map-action="${action}" data-page="${page + 1}" ${page >= pageCount ? 'disabled' : ''}>下一页</button>
      </div>
    </div>
  `
}

function renderOccupancyDrawer(
  projection: WarehouseLocationMapProjection,
  requestedLocationId?: string,
  requestedPage?: number,
): string {
  const locationId = requestedLocationId ?? (typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('locationId')
    : '')
  if (!locationId) return ''
  const cell = projection.areas
    .flatMap((area) => area.shelves.flatMap((shelf) => shelf.locations))
    .find((item) => item.locationId === locationId)
  if (!cell?.occupancies.length) return ''
  const pageCount = Math.max(1, Math.ceil(cell.occupancies.length / 10))
  const page = Math.min(Math.max(1, requestedPage ?? (Number(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('occupancyPage') : 1,
  ) || 1)), pageCount)
  const occupancies = cell.occupancies.slice((page - 1) * 10, page * 10)
  return `
    <aside class="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l bg-background p-5 shadow-xl" data-warehouse-map-occupancy-drawer>
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
            <div class="font-medium">${escapeHtml(item.objectName)}</div>
            <div class="mt-2 grid grid-cols-2 gap-2 text-muted-foreground">
              <span>生产单：${escapeHtml(item.productionOrderNo || '未关联')}</span>
              <span>对象编号：${escapeHtml(item.objectNo)}</span>
              ${item.taskNo ? `<span>裁片任务：${escapeHtml(item.taskNo)}</span>` : ''}
              ${item.cutOrderNo ? `<span>裁片单：${escapeHtml(item.cutOrderNo)}</span>` : ''}
              ${item.ticketNos?.length ? `<span>菲票：${escapeHtml(item.ticketNos.join('、'))}</span>` : ''}
              <span>数量：${escapeHtml(String(item.qty))} ${escapeHtml(item.unit)}</span>
              <span>入仓人：${escapeHtml(item.inboundBy || '未记录')}</span>
              <span>入仓时间：${escapeHtml(item.inboundAt || '未记录')}</span>
              <span>库位范围：${escapeHtml(item.footprintLocationNos?.join('、') || cell.locationNo)}</span>
              ${item.materialColor ? `<span>颜色：${escapeHtml(item.materialColor)}</span>` : ''}
              ${item.materialSpec ? `<span>规格：${escapeHtml(item.materialSpec)}</span>` : ''}
              ${typeof item.remainingQty === 'number' ? `<span>剩余数量：${escapeHtml(String(item.remainingQty))} ${escapeHtml(item.unit)}</span>` : ''}
            </div>
            ${item.partialOccupancyNote ? `<div class="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">${escapeHtml(item.partialOccupancyNote)}</div>` : ''}
          </article>
        `).join('')}
      </div>
      ${renderPageControls('occupancy-page', page, cell.occupancies.length)}
    </aside>
    <button type="button" class="fixed inset-0 z-40 bg-black/30" aria-label="关闭占用明细" data-skip-page-rerender="true" data-warehouse-map-action="close-occupancy"></button>
  `
}

export function renderWarehouseLocationMap(options: WarehouseLocationMapOptions): string {
  const { projection, mode } = options
  const selectedIds = new Set(options.selectedLocationIds ?? [])
  const selectedCells = projection.areas
    .flatMap((area) => area.shelves.flatMap((shelf) => shelf.locations))
    .filter((cell) => selectedIds.has(cell.locationId))
    .sort((left, right) => left.orderIndex - right.orderIndex)
  const selectedRange = selectedCells.length
    ? `${selectedCells[0].locationNo} 至 ${selectedCells.at(-1)?.locationNo}`
    : '未选择'
  const requestedUnlocatedPage = options.unlocatedPage ?? (Number(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('unlocatedPage') : 1,
  ) || 1)
  const unlocatedPageCount = Math.max(1, Math.ceil(projection.unlocatedOccupancies.length / 10))
  const unlocatedPage = Math.min(Math.max(1, requestedUnlocatedPage), unlocatedPageCount)
  const unlocatedRows = projection.unlocatedOccupancies.slice((unlocatedPage - 1) * 10, unlocatedPage * 10)
  return `
    <section class="space-y-4" data-warehouse-map-root data-warehouse-id="${escapeHtml(projection.warehouseId)}" data-warehouse-kind="${escapeHtml(projection.warehouseKind)}">
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
          <div class="mt-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span>${options.selectionLimit === 1 ? '请选择 1 个空闲库位' : '请选择同一货架内连续相邻的空闲库位'}；已选 ${selectedIds.size} 个，范围：${escapeHtml(selectedRange)}。</span>
              <button type="button" class="min-h-11 rounded-md border border-blue-200 bg-white px-3" data-skip-page-rerender="true" data-warehouse-map-action="clear-selection" ${selectedIds.size ? '' : 'disabled'}>清空选择</button>
            </div>
          </div>
        ` : ''}
        ${options.feedbackMessage ? `<div class="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">${escapeHtml(options.feedbackMessage)}</div>` : ''}
      </div>

      ${projection.areas.map((area) => `
        <article class="rounded-lg border bg-card">
          <header class="flex items-center justify-between border-b px-4 py-3">
            <h3 class="font-semibold">库区：${escapeHtml(area.areaName)}</h3>
            ${mode === 'LAYOUT' ? `
              <div class="flex gap-1">
                <button type="button" class="min-h-11 rounded-md border px-3 text-sm" data-skip-page-rerender="true" data-warehouse-map-action="move-area-left" data-area-id="${escapeHtml(area.areaId)}">左移库区</button>
                <button type="button" class="min-h-11 rounded-md border px-3 text-sm" data-skip-page-rerender="true" data-warehouse-map-action="rename-area" data-area-id="${escapeHtml(area.areaId)}">修改库区名称</button>
                <button type="button" class="min-h-11 rounded-md border px-3 text-sm" data-skip-page-rerender="true" data-warehouse-map-action="move-area-right" data-area-id="${escapeHtml(area.areaId)}">右移库区</button>
              </div>
            ` : ''}
          </header>
          <div class="divide-y">
            ${area.shelves.map((shelf) => `
              <div class="grid gap-3 p-4 md:grid-cols-[9rem_minmax(0,1fr)]">
                <div>
                  <div class="text-sm font-medium">${escapeHtml(shelf.shelfNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${shelf.locations.length} 个库位</div>
                  ${mode === 'LAYOUT' ? `
                    <div class="mt-2 flex gap-1">
                      <button type="button" class="min-h-11 min-w-11 rounded border text-xs" aria-label="${escapeHtml(shelf.shelfNo)} 上移" data-skip-page-rerender="true" data-warehouse-map-action="move-shelf-up" data-area-id="${escapeHtml(area.areaId)}" data-shelf-id="${escapeHtml(shelf.shelfId)}">↑</button>
                      <button type="button" class="min-h-11 min-w-11 rounded border text-xs" aria-label="修改 ${escapeHtml(shelf.shelfNo)} 编号" data-skip-page-rerender="true" data-warehouse-map-action="rename-shelf" data-shelf-id="${escapeHtml(shelf.shelfId)}">改</button>
                      <button type="button" class="min-h-11 min-w-11 rounded border text-xs" aria-label="${escapeHtml(shelf.shelfNo)} 下移" data-skip-page-rerender="true" data-warehouse-map-action="move-shelf-down" data-area-id="${escapeHtml(area.areaId)}" data-shelf-id="${escapeHtml(shelf.shelfId)}">↓</button>
                    </div>
                  ` : ''}
                </div>
                <div class="overflow-x-auto pb-1">
                  <div class="flex min-w-max gap-2">
                    ${shelf.locations.map((cell) => {
                      const selectionDisabled = mode === 'SELECT'
                        && !selectedIds.has(cell.locationId)
                        && (
                          (options.selectionLimit !== undefined && selectedIds.size >= options.selectionLimit)
                          || !toggleWarehouseLocationSelection(projection, [...selectedIds], cell.locationId).ok
                        )
                      return renderCell(cell, mode, selectedIds, selectionDisabled)
                    }).join('')}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </article>
      `).join('')}

      ${mode === 'LAYOUT' && projection.unassignedLocations.length ? `
        <article class="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 class="font-semibold text-amber-900">未编排库位 ${projection.unassignedLocations.length} 个</h3>
          <div class="mt-3 space-y-2">
            ${projection.unassignedLocations.map((location) => `
              <div class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm">
                <span>${escapeHtml(location.locationNo)} · 原记录 ${escapeHtml(location.areaName)} / ${escapeHtml(location.shelfNo)}</span>
                <label class="flex items-center gap-2">
                  <span>放入货架</span>
                  <select class="min-h-11 rounded-md border px-2" data-skip-page-rerender="true" data-warehouse-map-action="assign-location" data-location-id="${escapeHtml(location.locationId)}">
                    <option value="">请选择</option>
                    ${projection.areas.flatMap((area) => area.shelves.map((shelf) => `<option value="${escapeHtml(shelf.shelfId)}">${escapeHtml(area.areaName)} / ${escapeHtml(shelf.shelfNo)}</option>`)).join('')}
                  </select>
                </label>
              </div>
            `).join('')}
          </div>
        </article>
      ` : ''}

      ${projection.unlocatedOccupancies.length ? `
        <article class="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 class="font-semibold text-amber-900">待确认历史库位 ${projection.unlocatedOccupancies.length} 条</h3>
          <p class="mt-1 text-sm text-amber-800">历史记录未能唯一匹配当前库位，请人工确认后再纳入库位图。</p>
          <div class="mt-3 space-y-2">
            ${unlocatedRows.map((item) => `
              <div class="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm">${escapeHtml(item.productionOrderNo || '未关联生产单')} · ${escapeHtml(item.objectName)}</div>
            `).join('')}
          </div>
          ${renderPageControls('unlocated-page', unlocatedPage, projection.unlocatedOccupancies.length)}
        </article>
      ` : ''}
      ${renderOccupancyDrawer(projection, options.openLocationId, options.occupancyPage)}
    </section>
  `
}
