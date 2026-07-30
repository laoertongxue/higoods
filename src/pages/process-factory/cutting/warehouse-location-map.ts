import {
  listFactoryInternalWarehouses,
  listFactoryWaitProcessStockItems,
  type FactoryInternalWarehouse,
  type FactoryInternalWarehouseKind,
} from '../../../data/fcs/factory-internal-warehouse.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  renderWarehouseLocationMap,
  type WarehouseLocationMapMode,
} from '../../../components/ui/warehouse-location-map.ts'
import {
  buildWarehouseLocationMapProjection,
  resolveStableWarehouseLocationRef,
  type WarehouseLocationMapProjection,
  type WarehouseLocationOccupancy,
} from './warehouse-location-map-model.ts'
import {
  loadWarehouseLayoutSnapshot,
  saveWarehouseLayoutSnapshot,
  type FactoryWarehouseLayoutSnapshot,
} from './warehouse-location-layout-store.ts'
import {
  buildWaitHandoverLocationOccupancyStates,
  listWaitHandoverRuntimeEvents,
} from './wait-handover-runtime.ts'

type CuttingWarehouseMapKind = Extract<FactoryInternalWarehouseKind, 'WAIT_PROCESS' | 'WAIT_HANDOVER'>

function getSearchParams(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function listCuttingWarehouses(kind: CuttingWarehouseMapKind): FactoryInternalWarehouse[] {
  return listFactoryInternalWarehouses()
    .filter((warehouse) => warehouse.factoryKind === 'CENTRAL_CUTTING' && warehouse.warehouseKind === kind && warehouse.isEnabled)
    .sort((left, right) => left.factoryName.localeCompare(right.factoryName, 'zh-CN'))
}

function getCurrentWarehouse(kind: CuttingWarehouseMapKind): FactoryInternalWarehouse | null {
  const warehouses = listCuttingWarehouses(kind)
  const factoryId = getSearchParams().get('factoryId')
  return warehouses.find((warehouse) => warehouse.factoryId === factoryId) ?? warehouses[0] ?? null
}

function buildWaitProcessOccupancies(
  warehouse: FactoryInternalWarehouse,
  snapshot: FactoryWarehouseLayoutSnapshot,
): WarehouseLocationOccupancy[] {
  return listFactoryWaitProcessStockItems()
    .filter((item) => item.warehouseId === warehouse.warehouseId && item.factoryId === warehouse.factoryId)
    .filter((item) => Number(item.availableQty ?? item.receivedQty - Number(item.issuedQty || 0)) > 0)
    .map((item) => {
      const ref = resolveStableWarehouseLocationRef(warehouse, {
        areaName: item.areaName,
        shelfNo: item.shelfNo,
        locationNo: item.locationNo,
      }, snapshot)
      return {
        occupancyId: `wait-process:${item.stockItemId}`,
        footprintId: `wait-process:${item.sourceRecordId}`,
        locationId: ref?.locationId ?? `unresolved:${item.stockItemId}`,
        productionOrderNo: item.productionOrderNo || item.taskNo || '',
        objectNo: item.materialSku || item.sourceRecordNo,
        objectName: item.stockMaterialName || item.itemName,
        qty: Number(item.availableQty ?? item.receivedQty - Number(item.issuedQty || 0)),
        unit: item.unit,
        inboundAt: item.receivedAt,
        inboundBy: item.receiverName || item.operatorRoleName || '仓管员',
      }
    })
}

function buildWaitHandoverOccupancies(warehouse: FactoryInternalWarehouse): WarehouseLocationOccupancy[] {
  return buildWaitHandoverLocationOccupancyStates(listWaitHandoverRuntimeEvents())
    .filter((state) =>
      state.locationRef.factoryId === warehouse.factoryId
      && state.locationRef.warehouseKind === warehouse.warehouseKind
      && state.locationRef.warehouseId === warehouse.warehouseId,
    )
    .map((state) => ({
      occupancyId: `wait-handover:${state.sourceEventId}`,
      footprintId: `bag:${state.bagCode}`,
      locationId: state.locationRef.locationId,
      productionOrderNo: state.productionOrderNo,
      objectNo: state.bagCode,
      objectName: `中转袋 ${state.bagCode}`,
      qty: state.totalPieceQty,
      unit: '片',
      inboundAt: state.inboundAt,
      inboundBy: state.inboundBy,
    }))
}

function buildCurrentProjection(kind: CuttingWarehouseMapKind): {
  warehouse: FactoryInternalWarehouse
  snapshot: FactoryWarehouseLayoutSnapshot
  projection: WarehouseLocationMapProjection
  warningMessage: string
} | null {
  const warehouse = getCurrentWarehouse(kind)
  if (!warehouse) return null
  const loaded = loadWarehouseLayoutSnapshot(warehouse)
  const occupancies = kind === 'WAIT_PROCESS'
    ? buildWaitProcessOccupancies(warehouse, loaded.snapshot)
    : buildWaitHandoverOccupancies(warehouse)
  return {
    warehouse,
    snapshot: loaded.snapshot,
    projection: buildWarehouseLocationMapProjection(warehouse, loaded.snapshot, occupancies),
    warningMessage: loaded.warningMessage,
  }
}

function renderFactorySelector(kind: CuttingWarehouseMapKind, current: FactoryInternalWarehouse): string {
  return `
    <label class="flex items-center gap-2 text-sm">
      <span class="text-muted-foreground">裁床工厂</span>
      <select class="h-10 rounded-md border bg-background px-3" data-skip-page-rerender="true" data-warehouse-map-action="change-factory" data-warehouse-kind="${kind}">
        ${listCuttingWarehouses(kind).map((warehouse) => `
          <option value="${escapeHtml(warehouse.factoryId)}" ${warehouse.factoryId === current.factoryId ? 'selected' : ''}>${escapeHtml(warehouse.factoryName)}</option>
        `).join('')}
      </select>
    </label>
  `
}

export function renderCuttingWarehouseLocationMapSection(
  kind: CuttingWarehouseMapKind,
  requestedMode?: WarehouseLocationMapMode,
): string {
  const current = buildCurrentProjection(kind)
  if (!current) {
    return '<div class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">当前没有可用的裁床仓库库位主数据。</div>'
  }
  const mode = requestedMode ?? (getSearchParams().get('layout') === '1' ? 'LAYOUT' : 'VIEW')
  return `
    <section class="space-y-4" data-cutting-warehouse-map-section data-warehouse-kind="${kind}">
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        ${renderFactorySelector(kind, current.warehouse)}
        <div class="flex gap-2">
          ${mode === 'LAYOUT'
            ? '<button type="button" class="min-h-11 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-skip-page-rerender="true" data-warehouse-map-action="finish-layout">完成编排</button>'
            : '<button type="button" class="min-h-11 rounded-md border px-4 text-sm" data-skip-page-rerender="true" data-warehouse-map-action="enter-layout">编排库位图</button>'}
        </div>
      </div>
      ${renderWarehouseLocationMap({
        projection: current.projection,
        mode,
        factoryName: current.warehouse.factoryName,
        feedbackMessage: current.warningMessage,
      })}
    </section>
  `
}

function updateUrlParam(name: string, value: string | null): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  value ? url.searchParams.set(name, value) : url.searchParams.delete(name)
  window.history.replaceState({}, '', `${url.pathname}${url.search}`)
}

function refreshMapSection(kind: CuttingWarehouseMapKind): void {
  if (typeof document === 'undefined') return
  const region = document.querySelector<HTMLElement>(`[data-cutting-warehouse-map-section][data-warehouse-kind="${kind}"]`)
  if (region) region.outerHTML = renderCuttingWarehouseLocationMapSection(kind)
}

function moveId(ids: string[], id: string, direction: -1 | 1): string[] {
  const next = [...ids]
  const index = next.indexOf(id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= next.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

function persistSnapshot(
  kind: CuttingWarehouseMapKind,
  mutate: (snapshot: FactoryWarehouseLayoutSnapshot) => FactoryWarehouseLayoutSnapshot,
): void {
  const current = buildCurrentProjection(kind)
  if (!current) return
  const result = saveWarehouseLayoutSnapshot(
    { ...mutate(structuredClone(current.snapshot)), updatedBy: '当前用户' },
    current.snapshot.layoutVersion,
  )
  if (!result.ok && typeof window !== 'undefined') window.alert(result.message)
  refreshMapSection(kind)
}

export function handleCuttingWarehouseLocationMapEvent(target: HTMLElement, event?: Event): boolean {
  const node = target.closest<HTMLElement>('[data-warehouse-map-action]')
  if (!node) return false
  const section = node.closest<HTMLElement>('[data-cutting-warehouse-map-section]')
  const kind = section?.dataset.warehouseKind as CuttingWarehouseMapKind | undefined
  if (!kind) return false
  const action = node.dataset.warehouseMapAction
  if (action === 'change-factory' && target instanceof HTMLSelectElement) {
    updateUrlParam('factoryId', target.value)
    updateUrlParam('locationId', null)
    refreshMapSection(kind)
    return true
  }
  if (action === 'enter-layout' || action === 'finish-layout') {
    updateUrlParam('layout', action === 'enter-layout' ? '1' : null)
    refreshMapSection(kind)
    return true
  }
  if (action === 'open-occupancy') {
    updateUrlParam('locationId', node.dataset.locationId || null)
    refreshMapSection(kind)
    return true
  }
  if (action === 'close-occupancy') {
    updateUrlParam('locationId', null)
    refreshMapSection(kind)
    return true
  }
  if (action === 'move-area-left' || action === 'move-area-right') {
    persistSnapshot(kind, (snapshot) => ({
      ...snapshot,
      areaOrder: moveId(snapshot.areaOrder, node.dataset.areaId || '', action.endsWith('left') ? -1 : 1),
    }))
    return true
  }
  if (action === 'move-location-left' || action === 'move-location-right') {
    const shelfId = node.dataset.shelfId || ''
    persistSnapshot(kind, (snapshot) => ({
      ...snapshot,
      locationOrderByShelfId: {
        ...snapshot.locationOrderByShelfId,
        [shelfId]: moveId(
          snapshot.locationOrderByShelfId[shelfId] ?? [],
          node.dataset.locationId || '',
          action.endsWith('left') ? -1 : 1,
        ),
      },
    }))
    return true
  }
  if (action === 'rename-location') {
    const current = buildCurrentProjection(kind)
    const locationId = node.dataset.locationId || ''
    const cell = current?.projection.areas
      .flatMap((area) => area.shelves.flatMap((shelf) => shelf.locations))
      .find((item) => item.locationId === locationId)
    const nextNo = typeof window !== 'undefined' ? window.prompt('请输入新的库位编号', cell?.locationNo || '')?.trim() : ''
    if (!nextNo || !cell) return true
    persistSnapshot(kind, (snapshot) => ({
      ...snapshot,
      locationLabelOverrides: {
        ...snapshot.locationLabelOverrides,
        [locationId]: { locationNo: nextNo, locationName: nextNo },
      },
    }))
    return true
  }
  return Boolean(event)
}
