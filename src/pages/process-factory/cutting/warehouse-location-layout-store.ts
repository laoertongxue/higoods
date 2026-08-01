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
  addedAreaList?: FactoryWarehouseArea[]
  addedLocationListByShelfId?: Record<string, FactoryWarehouseLocation[]>
  updatedAt: string
  updatedBy: string
}

export interface WarehouseLayoutStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
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
    removeItem: (key) => memoryValues.delete(key),
  }
}

export function createMemoryWarehouseLayoutStorage(): WarehouseLayoutStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => values.delete(key),
  }
}

export function getWarehouseLayoutStorageKey(
  factoryId: string,
  warehouseKind: FactoryInternalWarehouse['warehouseKind'],
  warehouseId = '',
): string {
  return warehouseId
    ? `higood:cutting-warehouse-layout:v2:${factoryId}:${warehouseKind}:${warehouseId}`
    : `higood:cutting-warehouse-layout:v1:${factoryId}:${warehouseKind}`
}

function getWarehouseLayoutHistoryStorageKey(
  factoryId: string,
  warehouseKind: FactoryInternalWarehouse['warehouseKind'],
  warehouseId = '',
): string {
  return warehouseId
    ? `higood:cutting-warehouse-layout-history:v2:${factoryId}:${warehouseKind}:${warehouseId}`
    : `higood:cutting-warehouse-layout-history:v1:${factoryId}:${warehouseKind}`
}

export function listWarehouseLayoutChangeRecords(
  factoryId: string,
  warehouseKind: FactoryInternalWarehouse['warehouseKind'],
  warehouseId = '',
  storage: WarehouseLayoutStorage = currentStorage(),
): WarehouseLayoutChangeRecord[] {
  const raw = storage.getItem(getWarehouseLayoutHistoryStorageKey(factoryId, warehouseKind, warehouseId))
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
  const isNonEmptyString = (item: unknown): item is string => typeof item === 'string' && item.trim().length > 0
  const isStringArray = (item: unknown): item is string[] => Array.isArray(item) && item.every(isNonEmptyString)
  const isStringArrayRecord = (item: unknown): item is Record<string, string[]> => Boolean(
    item && typeof item === 'object' && !Array.isArray(item)
    && Object.entries(item).every(([key, ids]) => isNonEmptyString(key) && isStringArray(ids)),
  )
  const isOverrideRecord = (item: unknown, keys: string[]): boolean => item === undefined || Boolean(
    item && typeof item === 'object' && !Array.isArray(item)
    && Object.entries(item).every(([id, override]) => {
      if (!isNonEmptyString(id) || !override || typeof override !== 'object' || Array.isArray(override)) return false
      return keys.every((key) => isNonEmptyString((override as Record<string, unknown>)[key]))
    }),
  )
  const isValidLocation = (location: unknown): location is FactoryWarehouseLocation => {
    if (!location || typeof location !== 'object' || Array.isArray(location)) return false
    const candidate = location as Partial<FactoryWarehouseLocation>
    return isNonEmptyString(candidate.locationId)
      && isNonEmptyString(candidate.locationNo)
      && isNonEmptyString(candidate.locationName)
      && (candidate.status === 'AVAILABLE' || candidate.status === 'STOPPED')
  }
  const isValidShelf = (shelf: unknown): shelf is FactoryWarehouseShelf => {
    if (!shelf || typeof shelf !== 'object' || Array.isArray(shelf)) return false
    const candidate = shelf as Partial<FactoryWarehouseShelf>
    return isNonEmptyString(candidate.shelfId)
      && isNonEmptyString(candidate.shelfNo)
      && isNonEmptyString(candidate.shelfName)
      && (candidate.status === 'AVAILABLE' || candidate.status === 'STOPPED')
      && Array.isArray(candidate.locationList)
      && candidate.locationList.length > 0
      && candidate.locationList.every(isValidLocation)
  }
  const isValidArea = (area: unknown): area is FactoryWarehouseArea => {
    if (!area || typeof area !== 'object' || Array.isArray(area)) return false
    const candidate = area as Partial<FactoryWarehouseArea>
    return isNonEmptyString(candidate.areaId)
      && isNonEmptyString(candidate.areaName)
      && (candidate.status === 'AVAILABLE' || candidate.status === 'STOPPED')
      && Array.isArray(candidate.shelfList)
      && candidate.shelfList.length > 0
      && candidate.shelfList.every(isValidShelf)
  }
  const addedAreaListValid = snapshot.addedAreaList === undefined || (
    Array.isArray(snapshot.addedAreaList)
    && snapshot.addedAreaList.every(isValidArea)
  )
  const addedLocationListValid = snapshot.addedLocationListByShelfId === undefined || (
    Boolean(snapshot.addedLocationListByShelfId && typeof snapshot.addedLocationListByShelfId === 'object')
    && Object.values(snapshot.addedLocationListByShelfId).every((locations) =>
      Array.isArray(locations) && locations.every(isValidLocation))
  )
  return snapshot.factoryId === warehouse.factoryId
    && snapshot.warehouseId === warehouse.warehouseId
    && snapshot.warehouseKind === warehouse.warehouseKind
    && Number.isInteger(snapshot.layoutVersion)
    && isStringArray(snapshot.areaOrder)
    && isStringArrayRecord(snapshot.shelfOrderByAreaId)
    && isStringArrayRecord(snapshot.locationOrderByShelfId)
    && (snapshot.unassignedLocationIds === undefined || isStringArray(snapshot.unassignedLocationIds))
    && isOverrideRecord(snapshot.areaLabelOverrides, ['areaName'])
    && isOverrideRecord(snapshot.shelfLabelOverrides, ['shelfNo'])
    && isOverrideRecord(snapshot.locationLabelOverrides, ['locationNo', 'locationName'])
    && addedAreaListValid
    && addedLocationListValid
}

export function loadWarehouseLayoutSnapshot(
  warehouse: FactoryInternalWarehouse,
  storage: WarehouseLayoutStorage = currentStorage(),
): { snapshot: FactoryWarehouseLayoutSnapshot; warningMessage: string } {
  const key = getWarehouseLayoutStorageKey(warehouse.factoryId, warehouse.warehouseKind, warehouse.warehouseId)
  const legacyKey = getWarehouseLayoutStorageKey(warehouse.factoryId, warehouse.warehouseKind)
  const currentRaw = storage.getItem(key)
  const legacyRaw = storage.getItem(legacyKey)
  const raw = currentRaw ?? legacyRaw
  if (!raw) {
    return {
      snapshot: buildInitialWarehouseLayoutSnapshot(warehouse, '系统初始化'),
      warningMessage: '',
    }
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isCompatibleSnapshot(parsed, warehouse)) throw new Error('layout mismatch')
    let warningMessage = ''
    if (!currentRaw && legacyRaw) {
      const historyKey = getWarehouseLayoutHistoryStorageKey(warehouse.factoryId, warehouse.warehouseKind, warehouse.warehouseId)
      const legacyHistoryKey = getWarehouseLayoutHistoryStorageKey(warehouse.factoryId, warehouse.warehouseKind)
      const previousHistoryRaw = storage.getItem(historyKey)
      try {
        storage.setItem(key, legacyRaw)
        const legacyHistory = storage.getItem(legacyHistoryKey)
        if (legacyHistory && !storage.getItem(historyKey)) storage.setItem(historyKey, legacyHistory)
        warningMessage = '已将旧版库位图编排迁移到当前仓库。'
      } catch {
        try {
          storage.removeItem?.(key)
          if (previousHistoryRaw === null) storage.removeItem?.(historyKey)
          else storage.setItem(historyKey, previousHistoryRaw)
        } catch {
          // Keep the legacy keys untouched so the next read can retry migration.
        }
        warningMessage = '旧版库位图已读取，但迁移保存失败，请稍后重试。'
      }
    }
    return {
      snapshot: {
        ...clone(parsed),
        unassignedLocationIds: [...(parsed.unassignedLocationIds ?? [])],
        areaLabelOverrides: { ...(parsed.areaLabelOverrides ?? {}) },
        shelfLabelOverrides: { ...(parsed.shelfLabelOverrides ?? {}) },
        locationLabelOverrides: { ...(parsed.locationLabelOverrides ?? {}) },
        addedAreaList: clone(parsed.addedAreaList ?? []),
        addedLocationListByShelfId: clone(parsed.addedLocationListByShelfId ?? {}),
      },
      warningMessage,
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
  const key = getWarehouseLayoutStorageKey(snapshot.factoryId, snapshot.warehouseKind, snapshot.warehouseId)
  const raw = storage.getItem(key) ?? storage.getItem(getWarehouseLayoutStorageKey(snapshot.factoryId, snapshot.warehouseKind))
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
  const beforeSnapshot = currentSnapshot ?? {
    ...clone(snapshot),
    layoutVersion: expectedVersion,
  }
  const historyKey = getWarehouseLayoutHistoryStorageKey(snapshot.factoryId, snapshot.warehouseKind, snapshot.warehouseId)
  const history = listWarehouseLayoutChangeRecords(snapshot.factoryId, snapshot.warehouseKind, snapshot.warehouseId, storage)
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
  const previousLayoutRaw = storage.getItem(key)
  const previousHistoryRaw = storage.getItem(historyKey)
  try {
    storage.setItem(key, JSON.stringify(next))
    storage.setItem(historyKey, JSON.stringify([changeRecord, ...history].slice(0, 100)))
  } catch {
    try {
      if (previousLayoutRaw === null) storage.removeItem?.(key)
      else storage.setItem(key, previousLayoutRaw)
      if (previousHistoryRaw === null) storage.removeItem?.(historyKey)
      else storage.setItem(historyKey, previousHistoryRaw)
    } catch {
      // Preserve the original failure; storage recovery is best effort.
    }
    return { ok: false, message: '库位图保存失败，未能同步编排历史，请重试。' }
  }
  return { ok: true, message: '库位图编排已保存。', snapshot: next }
}

export function resetWarehouseLayoutSnapshot(
  warehouse: FactoryInternalWarehouse,
  updatedBy: string,
  storage: WarehouseLayoutStorage = currentStorage(),
): { ok: boolean; message: string; snapshot?: FactoryWarehouseLayoutSnapshot } {
  const key = getWarehouseLayoutStorageKey(warehouse.factoryId, warehouse.warehouseKind, warehouse.warehouseId)
  const raw = storage.getItem(key)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (isCompatibleSnapshot(parsed, warehouse)) {
        return { ok: false, message: '库位图已被其他页面恢复或更新，请刷新后重试。' }
      }
    } catch {
      // Only an explicitly damaged JSON snapshot may be replaced by this recovery path.
    }
  }
  const beforeSnapshot = buildInitialWarehouseLayoutSnapshot(warehouse, '损坏快照恢复')
  const snapshot = {
    ...buildInitialWarehouseLayoutSnapshot(warehouse, updatedBy),
    layoutVersion: 1,
  }
  const historyKey = getWarehouseLayoutHistoryStorageKey(warehouse.factoryId, warehouse.warehouseKind, warehouse.warehouseId)
  const history = listWarehouseLayoutChangeRecords(warehouse.factoryId, warehouse.warehouseKind, warehouse.warehouseId, storage)
  const changeRecord: WarehouseLayoutChangeRecord = {
    changeRecordId: `${warehouse.factoryId}:${warehouse.warehouseKind}:recovery:${snapshot.updatedAt}`,
    factoryId: warehouse.factoryId,
    warehouseKind: warehouse.warehouseKind,
    warehouseId: warehouse.warehouseId,
    beforeVersion: 0,
    afterVersion: 1,
    beforeSnapshot,
    afterSnapshot: clone(snapshot),
    updatedAt: snapshot.updatedAt,
    updatedBy,
  }
  const previousHistoryRaw = storage.getItem(historyKey)
  try {
    storage.setItem(key, JSON.stringify(snapshot))
    storage.setItem(historyKey, JSON.stringify([changeRecord, ...history].slice(0, 100)))
  } catch {
    try {
      if (raw === null) storage.removeItem?.(key)
      else storage.setItem(key, raw)
      if (previousHistoryRaw === null) storage.removeItem?.(historyKey)
      else storage.setItem(historyKey, previousHistoryRaw)
    } catch {
      // Preserve the original failure; storage recovery is best effort.
    }
    return { ok: false, message: '默认编排恢复失败，请清理浏览器存储后重试。' }
  }
  return { ok: true, message: '已恢复默认编排。', snapshot: clone(snapshot) }
}

function listSnapshotLocationIds(snapshot: FactoryWarehouseLayoutSnapshot): Set<string> {
  return new Set([
    ...Object.values(snapshot.locationOrderByShelfId).flat(),
    ...(snapshot.addedAreaList ?? []).flatMap((area) =>
      area.shelfList.flatMap((shelf) => shelf.locationList.map((location) => location.locationId))),
    ...Object.values(snapshot.addedLocationListByShelfId ?? {}).flat()
      .map((location) => location.locationId),
  ])
}

export function appendWarehouseArea(
  snapshot: FactoryWarehouseLayoutSnapshot,
  area: FactoryWarehouseArea,
): FactoryWarehouseLayoutSnapshot {
  const areaIds = new Set([...(snapshot.areaOrder ?? []), ...(snapshot.addedAreaList ?? []).map((item) => item.areaId)])
  if (areaIds.has(area.areaId)) throw new Error(`库区 ${area.areaName} 已存在。`)
  const locationIds = listSnapshotLocationIds(snapshot)
  const nestedLocationIds = area.shelfList.flatMap((shelf) => shelf.locationList.map((location) => location.locationId))
  if (new Set(nestedLocationIds).size !== nestedLocationIds.length) throw new Error('新增库区包含重复库位。')
  if (nestedLocationIds.some((locationId) => locationIds.has(locationId))) {
    throw new Error('新增库区包含重复库位编号。')
  }
  const shelfIds = new Set([
    ...Object.values(snapshot.shelfOrderByAreaId).flat(),
    ...(snapshot.addedAreaList ?? []).flatMap((item) => item.shelfList.map((shelf) => shelf.shelfId)),
  ])
  const nestedShelfIds = area.shelfList.map((shelf) => shelf.shelfId)
  if (new Set(nestedShelfIds).size !== nestedShelfIds.length) throw new Error('新增库区包含重复货架。')
  if (area.shelfList.some((shelf) => shelfIds.has(shelf.shelfId))) throw new Error('新增库区包含重复货架。')
  return {
    ...clone(snapshot),
    areaOrder: [...snapshot.areaOrder, area.areaId],
    shelfOrderByAreaId: {
      ...snapshot.shelfOrderByAreaId,
      [area.areaId]: area.shelfList.map((shelf) => shelf.shelfId),
    },
    locationOrderByShelfId: {
      ...snapshot.locationOrderByShelfId,
      ...Object.fromEntries(area.shelfList.map((shelf) => [shelf.shelfId, shelf.locationList.map((location) => location.locationId)])),
    },
    addedAreaList: [...(snapshot.addedAreaList ?? []), clone(area)],
  }
}

export function appendWarehouseLocation(
  snapshot: FactoryWarehouseLayoutSnapshot,
  areaId: string,
  shelfId: string,
  location: FactoryWarehouseLocation,
): FactoryWarehouseLayoutSnapshot {
  const addedArea = (snapshot.addedAreaList ?? []).find((area) => area.areaId === areaId)
  const knownArea = Boolean(addedArea || snapshot.areaOrder.includes(areaId))
  const knownShelf = Boolean(
    addedArea?.shelfList.some((shelf) => shelf.shelfId === shelfId)
      || snapshot.shelfOrderByAreaId[areaId]?.includes(shelfId),
  )
  if (!knownArea || !knownShelf) throw new Error('目标库区或货架不存在。')
  if (listSnapshotLocationIds(snapshot).has(location.locationId)) throw new Error('新增库位 ID 已存在。')
  const next = clone(snapshot)
  const addedShelf = addedArea?.shelfList.find((shelf) => shelf.shelfId === shelfId)
  if (addedShelf) {
    const nextAddedArea = next.addedAreaList?.find((area) => area.areaId === areaId)
    const nextAddedShelf = nextAddedArea?.shelfList.find((shelf) => shelf.shelfId === shelfId)
    nextAddedShelf?.locationList.push(clone(location))
  } else {
    next.addedLocationListByShelfId = {
      ...(next.addedLocationListByShelfId ?? {}),
      [shelfId]: [...(next.addedLocationListByShelfId?.[shelfId] ?? []), clone(location)],
    }
  }
  next.locationOrderByShelfId[shelfId] = [
    ...(next.locationOrderByShelfId[shelfId] ?? []),
    location.locationId,
  ]
  return next
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
  placedLocationIds: Set<string>,
  unassignedLocationIds: Set<string>,
): FactoryWarehouseShelf {
  const effectiveShelf = shelf
  const requestedIds = (snapshot.locationOrderByShelfId[shelf.shelfId] ?? [])
    .filter((locationId) => !unassignedLocationIds.has(locationId))
    .filter((locationId) => {
      if (!placedLocationIds.has(locationId)) {
        placedLocationIds.add(locationId)
        return true
      }
      warnings.push(`库位 ${locationId} 被重复编排到多个货架，已保留首次归属`)
      return false
    })
  const originalFallbackIds = effectiveShelf.locationList
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
  return { ...effectiveShelf, ...shelfOverride, locationList }
}

function applyArea(
  area: FactoryWarehouseArea,
  snapshot: FactoryWarehouseLayoutSnapshot,
  warnings: string[],
  locationById: Map<string, FactoryWarehouseLocation>,
  assignedLocationIds: Set<string>,
  placedLocationIds: Set<string>,
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
    placedLocationIds,
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
  const seenAreaIds = new Set(warehouse.areaList.map((area) => area.areaId))
  const seenShelfIds = new Set(warehouse.areaList.flatMap((area) => area.shelfList.map((shelf) => shelf.shelfId)))
  const seenLocationIds = new Set(warehouse.areaList.flatMap((area) =>
    area.shelfList.flatMap((shelf) => shelf.locationList.map((location) => location.locationId))))
  const addedAreas: FactoryWarehouseArea[] = []
  ;(snapshot.addedAreaList ?? []).forEach((area) => {
    if (seenAreaIds.has(area.areaId)) {
      warningMessages.push(`新增库区 ${area.areaName} 的 ID 已存在，已忽略重复节点`)
      return
    }
    seenAreaIds.add(area.areaId)
    const shelfList = area.shelfList.flatMap((shelf) => {
      if (seenShelfIds.has(shelf.shelfId)) {
        warningMessages.push(`新增货架 ${shelf.shelfNo} 的 ID 已存在，已忽略重复节点`)
        return []
      }
      seenShelfIds.add(shelf.shelfId)
      const locationList = shelf.locationList.filter((location) => {
        if (!seenLocationIds.has(location.locationId)) {
          seenLocationIds.add(location.locationId)
          return true
        }
        warningMessages.push(`新增库位 ${location.locationNo} 的 ID 已存在，已忽略重复节点`)
        return false
      })
      return [{ ...shelf, locationList }]
    })
    if (!shelfList.length) {
      warningMessages.push(`新增库区 ${area.areaName} 没有可用货架，已忽略`)
      return
    }
    addedAreas.push({ ...area, shelfList })
  })
  const availableShelfIds = new Set([
    ...warehouse.areaList.flatMap((area) => area.shelfList.map((shelf) => shelf.shelfId)),
    ...addedAreas.flatMap((area) => area.shelfList.map((shelf) => shelf.shelfId)),
  ])
  const addedLocationsByShelfId: Record<string, FactoryWarehouseLocation[]> = {}
  Object.entries(snapshot.addedLocationListByShelfId ?? {}).forEach(([shelfId, locations]) => {
    if (!availableShelfIds.has(shelfId)) {
      warningMessages.push(`新增库位的目标货架 ${shelfId} 已不存在，已忽略`)
      return
    }
    addedLocationsByShelfId[shelfId] = locations.filter((location) => {
      if (!seenLocationIds.has(location.locationId)) {
        seenLocationIds.add(location.locationId)
        return true
      }
      warningMessages.push(`新增库位 ${location.locationNo} 的 ID 已存在，已忽略重复节点`)
      return false
    })
  })
  const baseAreaList = [
    ...warehouse.areaList,
    ...addedAreas,
  ].map((area) => ({
    ...area,
    shelfList: area.shelfList.map((shelf) => ({
      ...shelf,
      locationList: [
        ...shelf.locationList,
        ...(addedLocationsByShelfId[shelf.shelfId] ?? []),
      ],
    })),
  }))
  const effectiveWarehouse = { ...clone(warehouse), areaList: baseAreaList }
  const locationById = new Map(
    baseAreaList.flatMap((area) =>
      area.shelfList.flatMap((shelf) => shelf.locationList),
    ).map((location) => [location.locationId, location]),
  )
  const assignedLocationIds = new Set(Object.values(snapshot.locationOrderByShelfId).flat())
  const placedLocationIds = new Set<string>()
  const unassignedLocationIds = new Set(snapshot.unassignedLocationIds ?? [])
  const areaList = orderByIds(
    baseAreaList,
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
    placedLocationIds,
    unassignedLocationIds,
  ))
  return {
    warehouse: { ...effectiveWarehouse, areaList },
    warningMessages,
  }
}
