import type {
  FactoryInternalWarehouse,
  FactoryWarehouseLocationStatus,
} from '../../../data/fcs/factory-internal-warehouse.ts'
import type { FactoryWarehouseLayoutSnapshot } from './warehouse-location-layout-store.ts'
import { applyWarehouseLayoutSnapshot } from './warehouse-location-layout-store.ts'

export interface StableWarehouseLocationRef {
  factoryId: string
  warehouseId: string
  warehouseKind: FactoryInternalWarehouse['warehouseKind']
  areaId: string
  areaName: string
  shelfId: string
  shelfNo: string
  locationId: string
  locationNo: string
  locationName: string
  status: FactoryWarehouseLocationStatus
  orderIndex: number
}

export interface HistoricalWarehouseLocationInput {
  locationId?: string
  areaName?: string
  shelfNo?: string
  locationNo?: string
}

export type WarehouseLocationBusinessStatus = 'EMPTY' | 'OCCUPIED'

export interface WarehouseLocationOccupancy {
  occupancyId: string
  footprintId: string
  locationId: string
  productionOrderNo: string
  objectNo: string
  objectName: string
  qty: number
  unit: string
  inboundAt: string
  inboundBy: string
}

export interface WarehouseLocationMapCell extends StableWarehouseLocationRef {
  businessStatus: WarehouseLocationBusinessStatus
  occupancies: WarehouseLocationOccupancy[]
}

export interface WarehouseLocationMapShelf {
  areaId: string
  areaName: string
  shelfId: string
  shelfNo: string
  locations: WarehouseLocationMapCell[]
}

export interface WarehouseLocationMapArea {
  areaId: string
  areaName: string
  shelves: WarehouseLocationMapShelf[]
}

export interface WarehouseLocationMapProjection {
  factoryId: string
  warehouseId: string
  warehouseKind: FactoryInternalWarehouse['warehouseKind']
  warehouseName: string
  totalLocationCount: number
  emptyLocationCount: number
  occupiedLocationCount: number
  areas: WarehouseLocationMapArea[]
  unlocatedOccupancies: WarehouseLocationOccupancy[]
}

export interface WarehouseLocationSelectionResult {
  ok: boolean
  message: string
  selectedLocationIds: string[]
}

export interface WarehouseStorageFootprint {
  footprintId: string
  sourceType: 'PICKUP_SESSION' | 'TEMP_BAG' | 'TRANSFER_BAG' | 'SPECIAL_CRAFT_RETURN'
  sourceId: string
  locationIds: string[]
  totalQty: number
  unit: string
  remainingQty: number
  inboundAt: string
  inboundBy: string
}

export function listStableWarehouseLocationRefs(
  warehouse: FactoryInternalWarehouse,
  snapshot?: FactoryWarehouseLayoutSnapshot,
): StableWarehouseLocationRef[] {
  const effective = snapshot
    ? applyWarehouseLayoutSnapshot(warehouse, snapshot).warehouse
    : warehouse
  return effective.areaList.flatMap((area) =>
    area.shelfList.flatMap((shelf) =>
      shelf.locationList.map((location, orderIndex) => ({
        factoryId: effective.factoryId,
        warehouseId: effective.warehouseId,
        warehouseKind: effective.warehouseKind,
        areaId: area.areaId,
        areaName: area.areaName,
        shelfId: shelf.shelfId,
        shelfNo: shelf.shelfNo,
        locationId: location.locationId,
        locationNo: location.locationNo,
        locationName: location.locationName,
        status: location.status,
        orderIndex,
      })),
    ),
  )
}

export function resolveStableWarehouseLocationRef(
  warehouse: FactoryInternalWarehouse,
  input: HistoricalWarehouseLocationInput,
  snapshot?: FactoryWarehouseLayoutSnapshot,
): StableWarehouseLocationRef | null {
  const refs = listStableWarehouseLocationRefs(warehouse, snapshot)
  if (input.locationId) {
    return refs.find((item) => item.locationId === input.locationId) ?? null
  }
  const precise = refs.filter((item) =>
    item.areaName === input.areaName
    && item.shelfNo === input.shelfNo
    && item.locationNo === input.locationNo,
  )
  if (precise.length === 1) return precise[0]
  const compatible = refs.filter((item) =>
    item.areaName === input.areaName
    && item.locationNo === input.locationNo,
  )
  return compatible.length === 1 ? compatible[0] : null
}

export type WarehouseLocationMigrationStatus = 'MATCHED' | 'NEEDS_CONFIRMATION' | 'UNRESOLVED'

export function classifyHistoricalWarehouseLocation(
  warehouse: FactoryInternalWarehouse,
  input: HistoricalWarehouseLocationInput,
  snapshot?: FactoryWarehouseLayoutSnapshot,
): {
  status: WarehouseLocationMigrationStatus
  match: StableWarehouseLocationRef | null
  candidates: StableWarehouseLocationRef[]
} {
  const match = resolveStableWarehouseLocationRef(warehouse, input, snapshot)
  if (match) return { status: 'MATCHED', match, candidates: [match] }
  const candidates = listStableWarehouseLocationRefs(warehouse, snapshot).filter((item) =>
    (!input.areaName || item.areaName === input.areaName)
    && (!input.locationNo || item.locationNo === input.locationNo),
  )
  return {
    status: candidates.length > 1 ? 'NEEDS_CONFIRMATION' : 'UNRESOLVED',
    match: null,
    candidates,
  }
}

function listMapCells(projection: WarehouseLocationMapProjection): WarehouseLocationMapCell[] {
  return projection.areas.flatMap((area) => area.shelves.flatMap((shelf) => shelf.locations))
}

export function buildWarehouseLocationMapProjection(
  warehouse: FactoryInternalWarehouse,
  snapshot: FactoryWarehouseLayoutSnapshot,
  occupancies: WarehouseLocationOccupancy[],
): WarehouseLocationMapProjection {
  const effective = applyWarehouseLayoutSnapshot(warehouse, snapshot).warehouse
  const refs = listStableWarehouseLocationRefs(warehouse, snapshot)
  const refIds = new Set(refs.map((ref) => ref.locationId))
  const occupancyByLocationId = new Map<string, WarehouseLocationOccupancy[]>()
  occupancies.forEach((occupancy) => {
    if (!refIds.has(occupancy.locationId)) return
    const rows = occupancyByLocationId.get(occupancy.locationId) ?? []
    rows.push(occupancy)
    occupancyByLocationId.set(occupancy.locationId, rows)
  })
  const refById = new Map(refs.map((ref) => [ref.locationId, ref]))
  const areas = effective.areaList
    .filter((area) => area.status === 'AVAILABLE')
    .map((area) => ({
      areaId: area.areaId,
      areaName: area.areaName,
      shelves: area.shelfList
        .filter((shelf) => shelf.status === 'AVAILABLE')
        .map((shelf) => ({
          areaId: area.areaId,
          areaName: area.areaName,
          shelfId: shelf.shelfId,
          shelfNo: shelf.shelfNo,
          locations: shelf.locationList
            .filter((location) => location.status === 'AVAILABLE')
            .map((location) => {
              const ref = refById.get(location.locationId)
              if (!ref) return null
              const rows = occupancyByLocationId.get(location.locationId) ?? []
              return {
                ...ref,
                businessStatus: rows.length ? 'OCCUPIED' as const : 'EMPTY' as const,
                occupancies: rows,
              }
            })
            .filter((location): location is WarehouseLocationMapCell => Boolean(location)),
        })),
    }))
  const cells = areas.flatMap((area) => area.shelves.flatMap((shelf) => shelf.locations))
  return {
    factoryId: effective.factoryId,
    warehouseId: effective.warehouseId,
    warehouseKind: effective.warehouseKind,
    warehouseName: effective.warehouseName,
    totalLocationCount: cells.length,
    emptyLocationCount: cells.filter((cell) => cell.businessStatus === 'EMPTY').length,
    occupiedLocationCount: cells.filter((cell) => cell.businessStatus === 'OCCUPIED').length,
    areas,
    unlocatedOccupancies: occupancies.filter((occupancy) => !refIds.has(occupancy.locationId)),
  }
}

export function validateWarehouseLocationSelection(
  projection: WarehouseLocationMapProjection,
  selectedLocationIds: string[],
): WarehouseLocationSelectionResult {
  const uniqueIds = Array.from(new Set(selectedLocationIds))
  if (!uniqueIds.length) {
    return { ok: false, message: '请选择空闲库位。', selectedLocationIds: [] }
  }
  const cellsById = new Map(listMapCells(projection).map((cell) => [cell.locationId, cell]))
  const cells = uniqueIds.map((id) => cellsById.get(id)).filter((cell): cell is WarehouseLocationMapCell => Boolean(cell))
  if (cells.length !== uniqueIds.length) {
    return { ok: false, message: '库位不存在或已停用，请重新选择。', selectedLocationIds: uniqueIds }
  }
  if (cells.some((cell) => cell.businessStatus === 'OCCUPIED')) {
    return { ok: false, message: '所选库位已被占用，请重新选择。', selectedLocationIds: uniqueIds }
  }
  const first = cells[0]
  if (cells.some((cell) => cell.areaId !== first.areaId || cell.shelfId !== first.shelfId)) {
    return { ok: false, message: '请选择同一货架内连续相邻的空闲库位。', selectedLocationIds: uniqueIds }
  }
  const orderIndexes = cells.map((cell) => cell.orderIndex).sort((left, right) => left - right)
  const consecutive = orderIndexes.every((orderIndex, index) =>
    index === 0 || orderIndex === orderIndexes[index - 1] + 1
  )
  return consecutive
    ? {
        ok: true,
        message: '',
        selectedLocationIds: cells.sort((left, right) => left.orderIndex - right.orderIndex).map((cell) => cell.locationId),
      }
    : {
        ok: false,
        message: '请选择同一货架内连续相邻的空闲库位。',
        selectedLocationIds: uniqueIds,
      }
}

export function toggleWarehouseLocationSelection(
  projection: WarehouseLocationMapProjection,
  selectedLocationIds: string[],
  locationId: string,
): WarehouseLocationSelectionResult {
  const current = validateWarehouseLocationSelection(projection, selectedLocationIds)
  const normalizedCurrent = selectedLocationIds.length
    ? (current.ok ? current.selectedLocationIds : [...selectedLocationIds])
    : []
  const selectedIndex = normalizedCurrent.indexOf(locationId)
  if (selectedIndex >= 0) {
    if (normalizedCurrent.length > 2 && selectedIndex > 0 && selectedIndex < normalizedCurrent.length - 1) {
      return {
        ok: false,
        message: '只能从已选范围两端取消库位。',
        selectedLocationIds: normalizedCurrent,
      }
    }
    const next = normalizedCurrent.filter((id) => id !== locationId)
    return next.length
      ? validateWarehouseLocationSelection(projection, next)
      : { ok: true, message: '', selectedLocationIds: [] }
  }
  return validateWarehouseLocationSelection(projection, [...normalizedCurrent, locationId])
}

export function buildWarehouseStorageFootprint(
  input: Omit<WarehouseStorageFootprint, 'remainingQty'> & { remainingQty?: number },
): WarehouseStorageFootprint {
  return {
    ...input,
    locationIds: Array.from(new Set(input.locationIds)),
    totalQty: Number(input.totalQty || 0),
    remainingQty: Number(input.remainingQty ?? input.totalQty ?? 0),
  }
}

export function adjustWarehouseStorageFootprint(
  footprint: WarehouseStorageFootprint,
  nextLocationIds: string[],
  remainingQty: number,
  projection: WarehouseLocationMapProjection,
): { ok: boolean; message: string; footprint?: WarehouseStorageFootprint } {
  const normalizedQty = Number(remainingQty || 0)
  if (normalizedQty <= 0) {
    return {
      ok: true,
      message: '本批物料已全部离仓，存放范围已释放。',
      footprint: { ...footprint, locationIds: [], remainingQty: 0 },
    }
  }
  const selection = validateWarehouseLocationSelection(projection, nextLocationIds)
  if (!selection.ok) return { ok: false, message: selection.message }
  return {
    ok: true,
    message: '剩余存放范围已更新。',
    footprint: {
      ...footprint,
      locationIds: selection.selectedLocationIds,
      remainingQty: normalizedQty,
    },
  }
}
