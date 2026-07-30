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
