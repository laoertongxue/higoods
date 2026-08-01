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
  areaCode: string
  areaName: string
  shelfId: string
  shelfSequence: number
  shelfNo: string
  locationId: string
  locationNo: string
  locationName: string
  levelNo: number
  positionNo: number
  areaStatus: FactoryWarehouseLocationStatus
  shelfStatus: FactoryWarehouseLocationStatus
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
  readonly levels: readonly WarehouseLocationMapLevel[]
}

export interface WarehouseLocationMapLevel {
  readonly levelNo: number
  readonly locations: readonly WarehouseLocationMapCell[]
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

function assertWarehouseHierarchySequence(
  value: number | undefined,
  fieldLabel: '货架序号' | '层号' | '层内位置号',
  nodeType: '货架' | '库位',
  nodeId: string,
): asserts value is number {
  if (!Number.isFinite(value) || !Number.isSafeInteger(value) || value! < 1) {
    throw new Error(`${nodeType} ${nodeId} 的${fieldLabel}必须是有限正整数。`)
  }
}

function assertWarehouseHierarchyFacts(warehouse: FactoryInternalWarehouse): void {
  warehouse.areaList.forEach((area) => {
    if (!area.code || !/^[A-Z]$/.test(area.code)) {
      throw new Error(`库区 ${area.areaId} 的库区代码必须是 A 到 Z 的单个大写字母。`)
    }
    area.shelfList.forEach((shelf) => {
      assertWarehouseHierarchySequence(shelf.shelfSequence, '货架序号', '货架', shelf.shelfId)
      shelf.locationList.forEach((location) => {
        assertWarehouseHierarchySequence(location.levelNo, '层号', '库位', location.locationId)
        assertWarehouseHierarchySequence(location.positionNo, '层内位置号', '库位', location.locationId)
      })
    })
  })
}

function buildWarehouseLocationMapShelf(input: {
  areaId: string
  areaName: string
  shelfId: string
  shelfNo: string
  levels: readonly WarehouseLocationMapLevel[]
}): WarehouseLocationMapShelf {
  return input
}

export function listWarehouseLocationMapShelfCells(
  shelf: WarehouseLocationMapShelf,
): readonly WarehouseLocationMapCell[] {
  return Object.freeze(shelf.levels.flatMap((level) => level.locations))
}

export function listWarehouseLocationMapCells(
  projection: WarehouseLocationMapProjection,
): readonly WarehouseLocationMapCell[] {
  return Object.freeze(projection.areas.flatMap((area) =>
    area.shelves.flatMap((shelf) => listWarehouseLocationMapShelfCells(shelf))))
}

export function listStableWarehouseLocationRefs(
  warehouse: FactoryInternalWarehouse,
  snapshot?: FactoryWarehouseLayoutSnapshot,
): StableWarehouseLocationRef[] {
  const effective = snapshot
    ? applyWarehouseLayoutSnapshot(warehouse, snapshot).warehouse
    : warehouse
  assertWarehouseHierarchyFacts(effective)
  return effective.areaList.flatMap((area) =>
    area.shelfList.flatMap((shelf) =>
      shelf.locationList.map((location, orderIndex) => ({
        factoryId: effective.factoryId,
        warehouseId: effective.warehouseId,
        warehouseKind: effective.warehouseKind,
        areaId: area.areaId,
        areaCode: area.code!,
        areaName: area.areaName,
        shelfId: shelf.shelfId,
        shelfSequence: shelf.shelfSequence!,
        shelfNo: shelf.shelfNo,
        locationId: location.locationId,
        locationNo: location.locationNo,
        locationName: location.locationName,
        levelNo: location.levelNo!,
        positionNo: location.positionNo!,
        areaStatus: area.status,
        shelfStatus: shelf.status,
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

type WarehouseLocationSelectability = 'SELECTABLE' | 'MISSING' | 'WRONG_SCOPE' | 'STOPPED' | 'OCCUPIED'

function classifyWarehouseLocationSelectability(
  projection: WarehouseLocationMapProjection,
  cell: WarehouseLocationMapCell | undefined,
): WarehouseLocationSelectability {
  if (!cell) return 'MISSING'
  if (cell.factoryId !== projection.factoryId
    || cell.warehouseId !== projection.warehouseId
    || cell.warehouseKind !== projection.warehouseKind) return 'WRONG_SCOPE'
  if (cell.areaStatus !== 'AVAILABLE'
    || cell.shelfStatus !== 'AVAILABLE'
    || cell.status !== 'AVAILABLE') return 'STOPPED'
  return cell.businessStatus === 'OCCUPIED' ? 'OCCUPIED' : 'SELECTABLE'
}

export function buildWarehouseLocationMapProjection(
  warehouse: FactoryInternalWarehouse,
  snapshot: FactoryWarehouseLayoutSnapshot,
  occupancies: WarehouseLocationOccupancy[],
): WarehouseLocationMapProjection {
  const effective = applyWarehouseLayoutSnapshot(warehouse, snapshot).warehouse
  const refs = listStableWarehouseLocationRefs(warehouse, snapshot)
  const knownLocationIds = new Set(refs.map((ref) => ref.locationId))
  const candidateOccupanciesByLocationId = new Map<string, WarehouseLocationOccupancy[]>()
  occupancies.forEach((occupancy) => {
    if (!knownLocationIds.has(occupancy.locationId)) return
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
    .map((area) => ({
      areaId: area.areaId,
      areaName: area.areaName,
      shelves: area.shelfList
        .map((shelf) => {
          const cells = shelf.locationList
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
            .filter((location): location is WarehouseLocationMapCell => Boolean(location))
          const cellsByLevel = new Map<number, WarehouseLocationMapCell[]>()
          cells.forEach((cell) => {
            const levelCells = cellsByLevel.get(cell.levelNo) ?? []
            levelCells.push(cell)
            cellsByLevel.set(cell.levelNo, levelCells)
          })
          const levels = Object.freeze(Array.from(cellsByLevel.entries())
            .sort(([left], [right]) => right - left)
            .map(([levelNo, locations]) => Object.freeze({
              levelNo,
              locations: Object.freeze(locations.sort((left, right) => left.positionNo - right.positionNo)),
            })))
          return buildWarehouseLocationMapShelf({
            areaId: area.areaId,
            areaName: area.areaName,
            shelfId: shelf.shelfId,
            shelfNo: shelf.shelfNo,
            levels,
          })
        }),
    }))
  const cells = areas.flatMap((area) => area.shelves.flatMap((shelf) => listWarehouseLocationMapShelfCells(shelf)))
  return {
    factoryId: effective.factoryId,
    warehouseId: effective.warehouseId,
    warehouseKind: effective.warehouseKind,
    warehouseName: effective.warehouseName,
    totalLocationCount: cells.length,
    emptyLocationCount: cells.filter((cell) => cell.businessStatus === 'EMPTY').length,
    occupiedLocationCount: cells.filter((cell) => cell.businessStatus === 'OCCUPIED').length,
    areas,
    unlocatedOccupancies: [
      ...occupancies.filter((occupancy) => !knownLocationIds.has(occupancy.locationId)).map((occupancy) => ({
        ...occupancy,
        partialOccupancyNote: occupancy.partialOccupancyNote || '历史库位无法唯一匹配，请主管确认后重新定位。',
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
  const cellsById = new Map(listWarehouseLocationMapCells(projection).map((cell) => [cell.locationId, cell]))
  const selectabilities = uniqueIds.map((id) => classifyWarehouseLocationSelectability(projection, cellsById.get(id)))
  if (selectabilities.includes('MISSING')) {
    return { ok: false, message: '库位不存在或已停用，请重新选择。', selectedLocationIds: uniqueIds }
  }
  if (selectabilities.includes('WRONG_SCOPE')) {
    return { ok: false, message: '所选库位不属于当前工厂或当前仓库，请重新选择。', selectedLocationIds: uniqueIds }
  }
  if (selectabilities.includes('STOPPED')) {
    return { ok: false, message: '库位不存在或已停用，请重新选择。', selectedLocationIds: uniqueIds }
  }
  if (selectabilities.includes('OCCUPIED')) {
    return { ok: false, message: '所选库位已被占用，请重新选择。', selectedLocationIds: uniqueIds }
  }
  return { ok: true, message: '', selectedLocationIds: uniqueIds }
}

export function revalidateWarehouseLocationSelection(
  projection: WarehouseLocationMapProjection,
  selectedLocationIds: string[],
): WarehouseLocationSelectionResult {
  const uniqueIds = Array.from(new Set(selectedLocationIds))
  const cellsById = new Map(listWarehouseLocationMapCells(projection).map((cell) => [cell.locationId, cell]))
  const retained: string[] = []
  const conflictLabels: string[] = []
  uniqueIds.forEach((locationId) => {
    const cell = cellsById.get(locationId)
    if (classifyWarehouseLocationSelectability(projection, cell) === 'SELECTABLE') retained.push(locationId)
    else conflictLabels.push(cell?.locationNo || `未知库位（${locationId}）`)
  })
  if (!conflictLabels.length) return validateWarehouseLocationSelection(projection, uniqueIds)
  return {
    ok: false,
    message: `以下库位已不可用：${conflictLabels.join('、')}。其他仍可用的选择已保留，请重新确认。`,
    selectedLocationIds: retained,
  }
}

export function toggleWarehouseLocationSelection(
  projection: WarehouseLocationMapProjection,
  selectedLocationIds: string[],
  locationId: string,
): WarehouseLocationSelectionResult {
  const normalizedCurrent = Array.from(new Set(selectedLocationIds))
  const selectedIndex = normalizedCurrent.indexOf(locationId)
  if (selectedIndex >= 0) {
    return {
      ok: true,
      message: '',
      selectedLocationIds: normalizedCurrent.filter((id) => id !== locationId),
    }
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
