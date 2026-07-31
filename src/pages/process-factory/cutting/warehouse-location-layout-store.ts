import type {
  FactoryInternalWarehouse,
  FactoryWarehouseArea,
  FactoryWarehouseLocation,
  FactoryWarehouseShelf,
} from '../../../data/fcs/factory-internal-warehouse.ts'

export interface FactoryWarehouseLayoutSnapshot {
  factoryId: string
  warehouseKind: FactoryInternalWarehouse['warehouseKind']
  warehouseId: string
  layoutVersion: number
  areaOrder: string[]
  shelfOrderByAreaId: Record<string, string[]>
  locationOrderByShelfId: Record<string, string[]>
  unassignedLocationIds: string[]
  areaLabelOverrides: Record<string, {
    areaName: string
  }>
  shelfLabelOverrides: Record<string, {
    shelfNo: string
  }>
  locationLabelOverrides: Record<string, {
    locationNo: string
    locationName: string
  }>
  updatedAt: string
  updatedBy: string
}

export interface WarehouseLayoutStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface AppliedWarehouseLayout {
  warehouse: FactoryInternalWarehouse
  warningMessages: string[]
}

export interface WarehouseLayoutChangeRecord {
  changeRecordId: string
  factoryId: string
  warehouseKind: FactoryInternalWarehouse['warehouseKind']
  warehouseId: string
  beforeVersion: number
  afterVersion: number
  beforeSnapshot: FactoryWarehouseLayoutSnapshot
  afterSnapshot: FactoryWarehouseLayoutSnapshot
  updatedAt: string
  updatedBy: string
}

const memoryValues = new Map<string, string>()

function clone<T>(value: T): T {
  return structuredClone(value)
}

function currentStorage(): WarehouseLayoutStorage {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  return {
    getItem: (key) => memoryValues.get(key) ?? null,
    setItem: (key, value) => {
      memoryValues.set(key, value)
    },
  }
}

export function createMemoryWarehouseLayoutStorage(): WarehouseLayoutStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

export function getWarehouseLayoutStorageKey(
  factoryId: string,
  warehouseKind: FactoryInternalWarehouse['warehouseKind'],
): string {
  return `higood:cutting-warehouse-layout:v1:${factoryId}:${warehouseKind}`
}

function getWarehouseLayoutHistoryStorageKey(
  factoryId: string,
  warehouseKind: FactoryInternalWarehouse['warehouseKind'],
): string {
  return `higood:cutting-warehouse-layout-history:v1:${factoryId}:${warehouseKind}`
}

export function listWarehouseLayoutChangeRecords(
  factoryId: string,
  warehouseKind: FactoryInternalWarehouse['warehouseKind'],
  storage: WarehouseLayoutStorage = currentStorage(),
): WarehouseLayoutChangeRecord[] {
  const raw = storage.getItem(getWarehouseLayoutHistoryStorageKey(factoryId, warehouseKind))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? clone(parsed) : []
  } catch {
    return []
  }
}

export function buildInitialWarehouseLayoutSnapshot(
  warehouse: FactoryInternalWarehouse,
  updatedBy: string,
): FactoryWarehouseLayoutSnapshot {
  return {
    factoryId: warehouse.factoryId,
    warehouseKind: warehouse.warehouseKind,
    warehouseId: warehouse.warehouseId,
    layoutVersion: 0,
    areaOrder: warehouse.areaList.map((area) => area.areaId),
    shelfOrderByAreaId: Object.fromEntries(
      warehouse.areaList.map((area) => [area.areaId, area.shelfList.map((shelf) => shelf.shelfId)]),
    ),
    locationOrderByShelfId: Object.fromEntries(
      warehouse.areaList.flatMap((area) =>
        area.shelfList.map((shelf) => [shelf.shelfId, shelf.locationList.map((location) => location.locationId)]),
      ),
    ),
    unassignedLocationIds: [],
    areaLabelOverrides: {},
    shelfLabelOverrides: {},
    locationLabelOverrides: {},
    updatedAt: new Date().toISOString(),
    updatedBy,
  }
}

function isCompatibleSnapshot(
  value: unknown,
  warehouse: FactoryInternalWarehouse,
): value is FactoryWarehouseLayoutSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const snapshot = value as Partial<FactoryWarehouseLayoutSnapshot>
  return snapshot.factoryId === warehouse.factoryId
    && snapshot.warehouseId === warehouse.warehouseId
    && snapshot.warehouseKind === warehouse.warehouseKind
    && Number.isInteger(snapshot.layoutVersion)
    && Array.isArray(snapshot.areaOrder)
    && Boolean(snapshot.shelfOrderByAreaId && typeof snapshot.shelfOrderByAreaId === 'object')
    && Boolean(snapshot.locationOrderByShelfId && typeof snapshot.locationOrderByShelfId === 'object')
}

export function loadWarehouseLayoutSnapshot(
  warehouse: FactoryInternalWarehouse,
  storage: WarehouseLayoutStorage = currentStorage(),
): { snapshot: FactoryWarehouseLayoutSnapshot; warningMessage: string } {
  const key = getWarehouseLayoutStorageKey(warehouse.factoryId, warehouse.warehouseKind)
  const raw = storage.getItem(key)
  if (!raw) {
    return {
      snapshot: buildInitialWarehouseLayoutSnapshot(warehouse, '系统初始化'),
      warningMessage: '',
    }
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isCompatibleSnapshot(parsed, warehouse)) throw new Error('layout mismatch')
    return {
      snapshot: {
        ...clone(parsed),
        unassignedLocationIds: [...(parsed.unassignedLocationIds ?? [])],
        areaLabelOverrides: { ...(parsed.areaLabelOverrides ?? {}) },
        shelfLabelOverrides: { ...(parsed.shelfLabelOverrides ?? {}) },
        locationLabelOverrides: { ...(parsed.locationLabelOverrides ?? {}) },
      },
      warningMessage: '',
    }
  } catch {
    return {
      snapshot: buildInitialWarehouseLayoutSnapshot(warehouse, '系统恢复'),
      warningMessage: '部分编排无法恢复，请重新检查。',
    }
  }
}

export function saveWarehouseLayoutSnapshot(
  snapshot: FactoryWarehouseLayoutSnapshot,
  expectedVersion: number,
  storage: WarehouseLayoutStorage = currentStorage(),
): { ok: boolean; message: string; snapshot?: FactoryWarehouseLayoutSnapshot } {
  const key = getWarehouseLayoutStorageKey(snapshot.factoryId, snapshot.warehouseKind)
  const raw = storage.getItem(key)
  let currentVersion = 0
  let currentSnapshot: FactoryWarehouseLayoutSnapshot | null = null
  if (raw) {
    try {
      currentSnapshot = JSON.parse(raw) as FactoryWarehouseLayoutSnapshot
      currentVersion = Number(currentSnapshot.layoutVersion ?? -1)
    } catch {
      return { ok: false, message: '部分编排无法恢复，请重新检查。' }
    }
  }
  if (currentVersion !== expectedVersion) {
    return { ok: false, message: '库位图已被更新，请刷新后重试。' }
  }
  const next = {
    ...clone(snapshot),
    layoutVersion: expectedVersion + 1,
    updatedAt: new Date().toISOString(),
  }
  storage.setItem(key, JSON.stringify(next))
  const beforeSnapshot = currentSnapshot ?? {
    ...clone(snapshot),
    layoutVersion: expectedVersion,
  }
  const historyKey = getWarehouseLayoutHistoryStorageKey(snapshot.factoryId, snapshot.warehouseKind)
  const history = listWarehouseLayoutChangeRecords(snapshot.factoryId, snapshot.warehouseKind, storage)
  const changeRecord: WarehouseLayoutChangeRecord = {
    changeRecordId: `${snapshot.factoryId}:${snapshot.warehouseKind}:v${next.layoutVersion}:${next.updatedAt}`,
    factoryId: snapshot.factoryId,
    warehouseKind: snapshot.warehouseKind,
    warehouseId: snapshot.warehouseId,
    beforeVersion: expectedVersion,
    afterVersion: next.layoutVersion,
    beforeSnapshot: clone(beforeSnapshot),
    afterSnapshot: clone(next),
    updatedAt: next.updatedAt,
    updatedBy: next.updatedBy,
  }
  storage.setItem(historyKey, JSON.stringify([changeRecord, ...history].slice(0, 100)))
  return { ok: true, message: '库位图编排已保存。', snapshot: next }
}

function orderByIds<T>(
  items: T[],
  ids: string[],
  getId: (item: T) => string,
  warnings: string[],
  label: string,
): T[] {
  const byId = new Map(items.map((item) => [getId(item), item]))
  const ordered: T[] = []
  ids.forEach((id) => {
    const item = byId.get(id)
    if (item) {
      ordered.push(item)
      byId.delete(id)
    } else {
      warnings.push(`${label} ${id} 已不存在`)
    }
  })
  if (byId.size) warnings.push(`新增${label}已按主数据顺序追加，请检查后保存`)
  return [...ordered, ...byId.values()]
}

function applyLocationOverride(
  location: FactoryWarehouseLocation,
  snapshot: FactoryWarehouseLayoutSnapshot,
): FactoryWarehouseLocation {
  const override = snapshot.locationLabelOverrides[location.locationId]
  return override ? { ...location, ...override } : location
}

function applyShelf(
  shelf: FactoryWarehouseShelf,
  snapshot: FactoryWarehouseLayoutSnapshot,
  warnings: string[],
  locationById: Map<string, FactoryWarehouseLocation>,
  assignedLocationIds: Set<string>,
  unassignedLocationIds: Set<string>,
): FactoryWarehouseShelf {
  const requestedIds = (snapshot.locationOrderByShelfId[shelf.shelfId] ?? [])
    .filter((locationId) => !unassignedLocationIds.has(locationId))
  const originalFallbackIds = shelf.locationList
    .map((location) => location.locationId)
    .filter((locationId) => !assignedLocationIds.has(locationId) && !unassignedLocationIds.has(locationId))
  if (originalFallbackIds.length) warnings.push('新增库位已按主数据顺序追加，请检查后保存')
  const locationList = orderByIds(
    [...new Set([...requestedIds, ...originalFallbackIds])]
      .map((locationId) => locationById.get(locationId))
      .filter((location): location is FactoryWarehouseLocation => Boolean(location)),
    [...requestedIds, ...originalFallbackIds],
    (location) => location.locationId,
    warnings,
    '库位',
  ).map((location) => applyLocationOverride(location, snapshot))
  const shelfOverride = snapshot.shelfLabelOverrides?.[shelf.shelfId]
  return { ...shelf, ...shelfOverride, locationList }
}

function applyArea(
  area: FactoryWarehouseArea,
  snapshot: FactoryWarehouseLayoutSnapshot,
  warnings: string[],
  locationById: Map<string, FactoryWarehouseLocation>,
  assignedLocationIds: Set<string>,
  unassignedLocationIds: Set<string>,
): FactoryWarehouseArea {
  const shelfList = orderByIds(
    area.shelfList,
    snapshot.shelfOrderByAreaId[area.areaId] ?? [],
    (shelf) => shelf.shelfId,
    warnings,
    '货架',
  ).map((shelf) => applyShelf(
    shelf,
    snapshot,
    warnings,
    locationById,
    assignedLocationIds,
    unassignedLocationIds,
  ))
  const areaOverride = snapshot.areaLabelOverrides?.[area.areaId]
  return { ...area, ...areaOverride, shelfList }
}

export function assignWarehouseLocationToShelf(
  snapshot: FactoryWarehouseLayoutSnapshot,
  locationId: string,
  shelfId: string,
): FactoryWarehouseLayoutSnapshot {
  const locationOrderByShelfId = Object.fromEntries(
    Object.entries(snapshot.locationOrderByShelfId).map(([currentShelfId, locationIds]) => [
      currentShelfId,
      locationIds.filter((id) => id !== locationId),
    ]),
  )
  locationOrderByShelfId[shelfId] = [
    ...(locationOrderByShelfId[shelfId] ?? []),
    locationId,
  ]
  return {
    ...snapshot,
    locationOrderByShelfId,
    unassignedLocationIds: snapshot.unassignedLocationIds.filter((id) => id !== locationId),
  }
}

export function applyWarehouseLayoutSnapshot(
  warehouse: FactoryInternalWarehouse,
  snapshot: FactoryWarehouseLayoutSnapshot,
): AppliedWarehouseLayout {
  const warningMessages: string[] = []
  if (!isCompatibleSnapshot(snapshot, warehouse)) {
    return {
      warehouse: clone(warehouse),
      warningMessages: ['编排与当前仓库不匹配，已使用主数据默认顺序。'],
    }
  }
  const locationById = new Map(
    warehouse.areaList.flatMap((area) =>
      area.shelfList.flatMap((shelf) => shelf.locationList),
    ).map((location) => [location.locationId, location]),
  )
  const assignedLocationIds = new Set(Object.values(snapshot.locationOrderByShelfId).flat())
  const unassignedLocationIds = new Set(snapshot.unassignedLocationIds ?? [])
  const areaList = orderByIds(
    warehouse.areaList,
    snapshot.areaOrder,
    (area) => area.areaId,
    warningMessages,
    '库区',
  ).map((area) => applyArea(
    area,
    snapshot,
    warningMessages,
    locationById,
    assignedLocationIds,
    unassignedLocationIds,
  ))
  return {
    warehouse: { ...clone(warehouse), areaList },
    warningMessages,
  }
}
