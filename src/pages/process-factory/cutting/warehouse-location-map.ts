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
  assignWarehouseLocationToShelf,
  applyWarehouseLayoutSnapshot,
  type FactoryWarehouseLayoutSnapshot,
} from './warehouse-location-layout-store.ts'
import {
  buildWaitHandoverLocationOccupancyStates,
  listWaitHandoverRuntimeEvents,
} from './wait-handover-runtime.ts'
import {
  listCuttingRuntimeEventsByInventoryScope,
  type CuttingRuntimeEvent,
} from '../../../data/fcs/cutting/cutting-runtime-event-ledger.ts'

export type CuttingWarehouseMapKind = Extract<FactoryInternalWarehouseKind, 'WAIT_PROCESS' | 'WAIT_HANDOVER'>

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

export function resolveCurrentCuttingWarehouseLocationRef(
  kind: CuttingWarehouseMapKind,
  areaName: string,
  locationNo: string,
) {
  const warehouse = getCurrentWarehouse(kind)
  if (!warehouse) return null
  const { snapshot } = loadWarehouseLayoutSnapshot(warehouse)
  return resolveStableWarehouseLocationRef(warehouse, { areaName, locationNo }, snapshot)
}

function runtimeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function runtimeString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function buildWaitProcessRuntimeOccupancies(
  warehouse: FactoryInternalWarehouse,
  snapshot: FactoryWarehouseLayoutSnapshot,
  events: CuttingRuntimeEvent[],
  options: { excludePickupSessionId?: string } = {},
): WarehouseLocationOccupancy[] {
  const latestAdjustmentBySessionId = new Map<string, Record<string, unknown>>()
  events
    .filter((event) => event.eventType === '待加工仓位置调整' && event.eventStatus !== '已取消')
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt, 'zh-CN'))
    .forEach((event) => {
      const payload = runtimeRecord(event.payload)
      const pickupSessionId = runtimeString(payload.pickupSessionId)
      if (pickupSessionId) latestAdjustmentBySessionId.set(pickupSessionId, payload)
    })
  return events
    .filter((event) =>
      event.eventStatus !== '已取消'
      && (event.eventType === '中转仓领料' || event.eventType === '待加工仓回收入仓')
      && event.inventoryEffect?.direction === 'IN',
    )
    .flatMap((event) => {
      const payload = runtimeRecord(event.payload)
      const pickupSessionId = runtimeString(payload.pickupSessionId) || event.refs.handoverRecordId || event.eventId
      const adjustment = latestAdjustmentBySessionId.get(pickupSessionId)
      const rawRefs = Array.isArray(adjustment?.locationRefs)
        ? adjustment.locationRefs
        : Array.isArray(payload.locationRefs) ? payload.locationRefs : []
      const locationRefs = rawRefs
        .map((rawRef) => {
          const ref = runtimeRecord(rawRef)
          return resolveStableWarehouseLocationRef(warehouse, {
            locationId: runtimeString(ref.locationId),
            areaName: runtimeString(ref.areaName),
            shelfNo: runtimeString(ref.shelfNo),
            locationNo: runtimeString(ref.locationNo),
          }, snapshot)
        })
        .filter((ref): ref is NonNullable<typeof ref> => Boolean(ref))
      if (!locationRefs.length) return []
      if (pickupSessionId === options.excludePickupSessionId) return []
      const prepLineId = runtimeString(payload.prepLineId) || event.material?.materialSku || event.eventId
      const totalQty = Number(payload.pickupQty || payload.returnedQty || event.inventoryEffect?.qty || 0)
      const footprintLocationNos = locationRefs.map((ref) => ref.locationNo)
      return locationRefs.map((ref, index) => ({
        occupancyId: `wait-process-runtime:${event.eventId}:${ref.locationId}`,
        footprintId: `pickup-session:${pickupSessionId}:${prepLineId}`,
        locationId: ref.locationId,
        productionOrderNo: event.refs.productionOrderNo || event.refs.cutOrderNo || '',
        objectNo: event.material?.materialSku || prepLineId,
        objectName: event.material?.materialName || event.material?.materialAlias || '待加工物料',
        qty: index === 0 ? totalQty : 0,
        unit: event.inventoryEffect?.unit || event.material?.unit || '',
        inboundAt: runtimeString(payload.pickupAt) || event.occurredAt,
        inboundBy: runtimeString(payload.pickupBy) || event.operatorName,
        materialColor: event.material?.materialColor,
        materialSpec: event.material?.materialSpec,
        footprintLocationNos,
        remainingQty: totalQty,
        partialOccupancyNote: locationRefs.length > 1
          ? `本批物料连续存放于 ${locationRefs.length} 个库位；总量仅在起始库位计算一次。`
          : undefined,
        cutOrderNo: event.refs.cutOrderNo,
      }))
    })
}

function buildWaitProcessOccupancies(
  warehouse: FactoryInternalWarehouse,
  snapshot: FactoryWarehouseLayoutSnapshot,
): WarehouseLocationOccupancy[] {
  const runtimeOccupancies = buildWaitProcessRuntimeOccupancies(
    warehouse,
    snapshot,
    listCuttingRuntimeEventsByInventoryScope('裁床待加工仓'),
  )
  const runtimeKeys = new Set(runtimeOccupancies.map((item) =>
    `${item.productionOrderNo}:${item.objectNo}:${item.locationId}`))
  const stockOccupancies = listFactoryWaitProcessStockItems()
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
        materialColor: item.fabricColor,
        taskNo: item.taskNo,
        cutOrderNo: item.sourceRecordNo,
      }
    })
    .filter((item) => !runtimeKeys.has(`${item.productionOrderNo}:${item.objectNo}:${item.locationId}`))
  return [...runtimeOccupancies, ...stockOccupancies]
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
      objectNo: state.objectNo || state.bagCode,
      objectName: state.objectName || `中转袋 ${state.bagCode}`,
      qty: state.totalPieceQty,
      unit: '片',
      inboundAt: state.inboundAt,
      inboundBy: state.inboundBy,
      ticketNos: state.feiTicketIds,
    }))
}

export function buildCurrentCuttingWarehouseMapProjection(kind: CuttingWarehouseMapKind): {
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
  const applied = applyWarehouseLayoutSnapshot(warehouse, loaded.snapshot)
  return {
    warehouse,
    snapshot: loaded.snapshot,
    projection: buildWarehouseLocationMapProjection(warehouse, loaded.snapshot, occupancies),
    warningMessage: [loaded.warningMessage, ...applied.warningMessages].filter(Boolean).join('；'),
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
  const current = buildCurrentCuttingWarehouseMapProjection(kind)
  if (!current) {
    return '<div class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">当前没有可用的裁床仓库库位主数据。</div>'
  }
  const mode = requestedMode ?? (getSearchParams().get('layout') === '1' ? 'LAYOUT' : 'VIEW')
  return `
    <section class="space-y-4" data-cutting-warehouse-map-section data-warehouse-kind="${kind}">
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4" data-warehouse-map-toolbar>
        <div class="flex flex-wrap items-center gap-3">
          ${renderFactorySelector(kind, current.warehouse)}
          <span class="text-xs text-muted-foreground">编排版本 v${current.snapshot.layoutVersion} · ${escapeHtml(current.snapshot.updatedBy)} · ${escapeHtml(current.snapshot.updatedAt)}</span>
        </div>
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
  if (!region) return
  const template = document.createElement('template')
  template.innerHTML = renderCuttingWarehouseLocationMapSection(kind).trim()
  const nextSection = template.content.firstElementChild
  const currentToolbar = region.querySelector<HTMLElement>('[data-warehouse-map-toolbar]')
  const nextToolbar = nextSection?.querySelector<HTMLElement>('[data-warehouse-map-toolbar]')
  if (currentToolbar && nextToolbar) currentToolbar.replaceWith(nextToolbar)
  const currentMap = region.querySelector<HTMLElement>('[data-warehouse-map-root]')
  const nextMap = nextSection?.querySelector<HTMLElement>('[data-warehouse-map-root]')
  if (currentMap && nextMap) currentMap.replaceWith(nextMap)
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
  const current = buildCurrentCuttingWarehouseMapProjection(kind)
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
    updateUrlParam('occupancyPage', null)
    refreshMapSection(kind)
    return true
  }
  if (action === 'close-occupancy') {
    updateUrlParam('locationId', null)
    updateUrlParam('occupancyPage', null)
    refreshMapSection(kind)
    return true
  }
  if (action === 'occupancy-page' || action === 'unlocated-page') {
    updateUrlParam(action === 'occupancy-page' ? 'occupancyPage' : 'unlocatedPage', node.dataset.page || '1')
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
  if (action === 'move-shelf-up' || action === 'move-shelf-down') {
    const areaId = node.dataset.areaId || ''
    persistSnapshot(kind, (snapshot) => ({
      ...snapshot,
      shelfOrderByAreaId: {
        ...snapshot.shelfOrderByAreaId,
        [areaId]: moveId(
          snapshot.shelfOrderByAreaId[areaId] ?? [],
          node.dataset.shelfId || '',
          action.endsWith('up') ? -1 : 1,
        ),
      },
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
    const current = buildCurrentCuttingWarehouseMapProjection(kind)
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
  if (action === 'rename-area') {
    const current = buildCurrentCuttingWarehouseMapProjection(kind)
    const areaId = node.dataset.areaId || ''
    const area = current?.projection.areas.find((item) => item.areaId === areaId)
    const nextName = typeof window !== 'undefined'
      ? window.prompt('请输入新的库区名称', area?.areaName || '')?.trim()
      : ''
    if (!nextName || !area) return true
    persistSnapshot(kind, (snapshot) => ({
      ...snapshot,
      areaLabelOverrides: {
        ...snapshot.areaLabelOverrides,
        [areaId]: { areaName: nextName },
      },
    }))
    return true
  }
  if (action === 'rename-shelf') {
    const current = buildCurrentCuttingWarehouseMapProjection(kind)
    const shelfId = node.dataset.shelfId || ''
    const shelf = current?.projection.areas
      .flatMap((area) => area.shelves)
      .find((item) => item.shelfId === shelfId)
    const nextNo = typeof window !== 'undefined'
      ? window.prompt('请输入新的货架编号', shelf?.shelfNo || '')?.trim()
      : ''
    if (!nextNo || !shelf) return true
    persistSnapshot(kind, (snapshot) => ({
      ...snapshot,
      shelfLabelOverrides: {
        ...snapshot.shelfLabelOverrides,
        [shelfId]: { shelfNo: nextNo },
      },
    }))
    return true
  }
  if (action === 'assign-location' && target instanceof HTMLSelectElement) {
    const locationId = node.dataset.locationId || ''
    if (!locationId || !target.value) return true
    persistSnapshot(kind, (snapshot) =>
      assignWarehouseLocationToShelf(snapshot, locationId, target.value))
    return true
  }
  return false
}
