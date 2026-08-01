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
  materialColor?: string
  materialSpec?: string
  footprintLocationNos?: string[]
  remainingQty?: number
  partialOccupancyNote?: string
  taskNo?: string
  cutOrderNo?: string
  ticketNos?: string[]
  styleName?: string
  styleImageUrl?: string
  materialImageUrl?: string
  rollDetails?: Array<{
    rollNo: string
    yard: number
    meter: number
    locationNo?: string
  }>
  rollCount?: number
  rollDetailsAreDemo?: boolean
  bagCode?: string
  packed?: boolean
  ticketDetails?: Array<{
    feiTicketNo: string
    partName: string
    size: string
    pieceQty: number
    specialCraftText?: string
  }>
  unresolvedTicketCount?: number
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
  unassignedLocations: StableWarehouseLocationRef[]
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
  if (compatible.length === 1) return compatible[0]
  if (snapshot) {
    const historical = listStableWarehouseLocationRefs(warehouse)
    const historicalMatches = historical.filter((item) =>
      item.areaName === input.areaName
      && (!input.shelfNo || item.shelfNo === input.shelfNo)
      && item.locationNo === input.locationNo,
    )
    if (historicalMatches.length === 1) {
      return refs.find((item) => item.locationId === historicalMatches[0].locationId) ?? null
    }
  }
  return null
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
  const knownLocationIds = new Set(refs.map((ref) => ref.locationId))
  const activeLocationIds = new Set(effective.areaList
    .filter((area) => area.status === 'AVAILABLE')
    .flatMap((area) => area.shelfList
      .filter((shelf) => shelf.status === 'AVAILABLE')
      .flatMap((shelf) => shelf.locationList
        .filter((location) => location.status === 'AVAILABLE')
        .map((location) => location.locationId))))
  const candidateOccupanciesByLocationId = new Map<string, WarehouseLocationOccupancy[]>()
  occupancies.forEach((occupancy) => {
    if (!activeLocationIds.has(occupancy.locationId)) return
    const rows = candidateOccupanciesByLocationId.get(occupancy.locationId) ?? []
    rows.push(occupancy)
    candidateOccupanciesByLocationId.set(occupancy.locationId, rows)
  })
  const occupancyByLocationId = new Map<string, WarehouseLocationOccupancy[]>()
  const conflictingOccupancies: WarehouseLocationOccupancy[] = []
  const conflictingLocationIds = new Set<string>()
  candidateOccupanciesByLocationId.forEach((rows, locationId) => {
    const productionOrderKeys = new Set(rows.map((occupancy) => occupancy.productionOrderNo || occupancy.objectNo))
    if (productionOrderKeys.size > 1) {
      conflictingLocationIds.add(locationId)
      const markedRows = rows.map((occupancy) => ({
        ...occupancy,
        partialOccupancyNote: '该库位已关联其他生产单，请主管确认后重新定位。',
      }))
      conflictingOccupancies.push(...markedRows)
      occupancyByLocationId.set(locationId, markedRows)
      return
    }
    occupancyByLocationId.set(locationId, rows)
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
                 businessStatus: rows.length || conflictingLocationIds.has(location.locationId) ? 'OCCUPIED' as const : 'EMPTY' as const,
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
    unassignedLocations: [],
    unlocatedOccupancies: [
      ...occupancies.filter((occupancy) => !activeLocationIds.has(occupancy.locationId)).map((occupancy) => ({
        ...occupancy,
        partialOccupancyNote: occupancy.partialOccupancyNote || (knownLocationIds.has(occupancy.locationId)
          ? '原库位已停用，请主管确认新的可用库位。'
          : '历史库位无法唯一匹配，请主管确认后重新定位。'),
      })),
      ...conflictingOccupancies,
    ],
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

export function revalidateWarehouseLocationSelection(
  projection: WarehouseLocationMapProjection,
  selectedLocationIds: string[],
): WarehouseLocationSelectionResult {
  const selected = new Set(selectedLocationIds)
  const cells = listMapCells(projection)
  const conflicts = selectedLocationIds
    .map((locationId) => cells.find((cell) => cell.locationId === locationId))
    .filter((cell) => !cell || cell.status !== 'AVAILABLE' || cell.businessStatus === 'OCCUPIED')
  if (!conflicts.length) return validateWarehouseLocationSelection(projection, selectedLocationIds)

  const validCells = cells
    .filter((cell) => selected.has(cell.locationId))
    .filter((cell) => cell.status === 'AVAILABLE' && cell.businessStatus === 'EMPTY')
    .sort((left, right) => left.orderIndex - right.orderIndex)
  const segments: WarehouseLocationMapCell[][] = []
  for (const cell of validCells) {
    const segment = segments.at(-1)
    const previous = segment?.at(-1)
    if (!previous || previous.shelfId !== cell.shelfId || cell.orderIndex !== previous.orderIndex + 1) {
      segments.push([cell])
    } else {
      segment.push(cell)
    }
  }
  const retained = segments.sort((left, right) => right.length - left.length)[0] ?? []
  const conflictLabels = conflicts.map((cell) => cell?.locationNo || '已删除库位')
  return {
    ok: false,
    message: `以下库位已不可用：${conflictLabels.join('、')}。其他仍连续可用的选择已保留，请重新确认。`,
    selectedLocationIds: retained.map((cell) => cell.locationId),
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
