import type {
  FactoryInternalWarehouse,
  FactoryInternalWarehouseKind,
  FactoryWarehouseArea,
  FactoryWarehouseLocation,
  FactoryWarehouseShelf,
} from '../../../data/fcs/factory-internal-warehouse.ts'
import { buildCuttingWarehouseLocationNo } from '../../../data/fcs/cutting/warehouse-location-mock.ts'

export interface FactoryWarehouseLayoutSnapshot {
  schemaVersion: 3
  factoryId: string
  warehouseKind: FactoryInternalWarehouseKind
  warehouseId: string
  layoutVersion: number
  areaList: FactoryWarehouseArea[]
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

export interface LoadedWarehouseLayout {
  snapshot: FactoryWarehouseLayoutSnapshot
  warningMessage: string
  persistenceAvailable: boolean
}

export interface WarehouseLayoutChangeRecord {
  changeRecordId: string
  factoryId: string
  warehouseKind: FactoryInternalWarehouseKind
  warehouseId: string
  beforeVersion: number
  afterVersion: number
  beforeSnapshot: FactoryWarehouseLayoutSnapshot
  afterSnapshot: FactoryWarehouseLayoutSnapshot
  updatedAt: string
  updatedBy: string
}

export interface CreateWarehouseAreaInput {
  areaId: string
  areaName: string
  code: string
  remark?: string
  updatedBy: string
}

export interface UpdateWarehouseAreaInput {
  areaId: string
  areaName?: string
  code?: string
  remark?: string
  enabled?: boolean
  updatedBy: string
}

export interface CreateWarehouseShelfInput {
  areaId: string
  shelfId: string
  shelfSequence: number
  positionCounts: number[]
  remark?: string
  updatedBy: string
}

export interface WarehouseShelfBatchOptions {
  yieldControl?: () => Promise<void>
  signal?: AbortSignal
}

export interface UpdateWarehouseShelfInput {
  shelfId: string
  shelfSequence?: number
  shelfName?: string
  remark?: string
  enabled?: boolean
  updatedBy: string
}

export interface UpdateWarehouseLocationInput {
  locationId: string
  levelNo?: number
  positionNo?: number
  remark?: string
  enabled?: boolean
  updatedBy: string
}

export interface AdjustWarehouseLevelPositionCountInput {
  shelfId: string
  levelNo: number
  positionCount: number
  updatedBy: string
}

export interface SetWarehouseLocationEnabledInput {
  locationId: string
  enabled: boolean
  updatedBy: string
}

export interface RevokeNewWarehouseNodeInput {
  nodeType: 'AREA' | 'SHELF' | 'LOCATION'
  nodeId: string
  createdInLayoutVersion: number
  updatedBy: string
}

interface LayoutNodeCreationMetadata {
  layoutCreatedInVersion: number
}

type LayoutWarehouseArea = FactoryWarehouseArea & Partial<LayoutNodeCreationMetadata>
type LayoutWarehouseShelf = FactoryWarehouseShelf & Partial<LayoutNodeCreationMetadata>
type LayoutWarehouseLocation = FactoryWarehouseLocation & Partial<LayoutNodeCreationMetadata>

const memoryValues = new Map<string, string>()

function clone<T>(value: T): T {
  return structuredClone(value)
}

function currentStorage(): WarehouseLayoutStorage {
  if (typeof window !== 'undefined') {
    try {
      const storage = window.localStorage
      if (storage) return storage
    } catch {
      const unavailableError = new Error('浏览器存储不可用。')
      const fail = (): never => { throw unavailableError }
      return {
        getItem: fail,
        setItem: fail,
        removeItem: fail,
      }
    }
  }
  return {
    getItem: (key) => memoryValues.get(key) ?? null,
    setItem: (key, value) => { memoryValues.set(key, value) },
    removeItem: (key) => memoryValues.delete(key),
  }
}

export function createMemoryWarehouseLayoutStorage(): WarehouseLayoutStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => values.delete(key),
  }
}

export function getWarehouseLayoutStorageKey(
  factoryId: string,
  warehouseKind: FactoryInternalWarehouseKind,
  warehouseId = '',
): string {
  return `higood:cutting-warehouse-layout:v3:${factoryId}:${warehouseKind}:${warehouseId}`
}

function getWarehouseLayoutHistoryStorageKey(
  factoryId: string,
  warehouseKind: FactoryInternalWarehouseKind,
  warehouseId = '',
): string {
  return `higood:cutting-warehouse-layout-history:v3:${factoryId}:${warehouseKind}:${warehouseId}`
}

function legacyLayoutKeys(factoryId: string, warehouseKind: FactoryInternalWarehouseKind, warehouseId: string): string[] {
  return [
    `higood:cutting-warehouse-layout:v2:${factoryId}:${warehouseKind}:${warehouseId}`,
    `higood:cutting-warehouse-layout:v1:${factoryId}:${warehouseKind}`,
  ]
}

function legacyHistoryKeys(factoryId: string, warehouseKind: FactoryInternalWarehouseKind, warehouseId: string): string[] {
  return [
    `higood:cutting-warehouse-layout-history:v2:${factoryId}:${warehouseKind}:${warehouseId}`,
    `higood:cutting-warehouse-layout-history:v1:${factoryId}:${warehouseKind}`,
  ]
}

function assertText(value: string, label: string): void {
  if (!value.trim()) throw new Error(`请输入${label}。`)
}

function assertSequence(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || !Number.isFinite(value) || value < 1) throw new Error(`${label}必须是有限正整数。`)
}

function assertAreaCode(code: string): void {
  if (!/^[A-Z]$/.test(code)) throw new Error('库区代码必须是 A 到 Z 的单个大写字母。')
}

function listShelves(snapshot: FactoryWarehouseLayoutSnapshot): FactoryWarehouseShelf[] {
  return snapshot.areaList.flatMap((area) => area.shelfList)
}

function listLocations(snapshot: FactoryWarehouseLayoutSnapshot): FactoryWarehouseLocation[] {
  return listShelves(snapshot).flatMap((shelf) => shelf.locationList)
}

function findArea(snapshot: FactoryWarehouseLayoutSnapshot, areaId: string): FactoryWarehouseArea {
  const area = snapshot.areaList.find((item) => item.areaId === areaId)
  if (!area) throw new Error('目标库区不存在，请刷新后重试。')
  return area
}

function findShelfContext(snapshot: FactoryWarehouseLayoutSnapshot, shelfId: string): { area: FactoryWarehouseArea; shelf: FactoryWarehouseShelf } {
  for (const area of snapshot.areaList) {
    const shelf = area.shelfList.find((item) => item.shelfId === shelfId)
    if (shelf) return { area, shelf }
  }
  throw new Error('目标货架不存在，请刷新后重试。')
}

function findLocationContext(snapshot: FactoryWarehouseLayoutSnapshot, locationId: string): {
  area: FactoryWarehouseArea
  shelf: FactoryWarehouseShelf
  location: FactoryWarehouseLocation
} {
  for (const area of snapshot.areaList) {
    for (const shelf of area.shelfList) {
      const location = shelf.locationList.find((item) => item.locationId === locationId)
      if (location) return { area, shelf, location }
    }
  }
  throw new Error('目标库位不存在，请刷新后重试。')
}

function locationNo(area: FactoryWarehouseArea, shelf: FactoryWarehouseShelf, levelNo: number, positionNo: number): string {
  if (!area.code || !shelf.shelfSequence) throw new Error('库区代码或货架序号不完整，不能生成库位编号。')
  return buildCuttingWarehouseLocationNo(area.code, shelf.shelfSequence, levelNo, positionNo)
}

function renumberShelf(area: FactoryWarehouseArea, shelf: FactoryWarehouseShelf): void {
  if (!shelf.shelfSequence) throw new Error('货架序号必须是有限正整数。')
  shelf.shelfNo = `R${String(shelf.shelfSequence).padStart(2, '0')}`
  shelf.shelfName = `${area.areaName} ${shelf.shelfNo}`
  shelf.locationList.forEach((location) => {
    if (!location.levelNo || !location.positionNo) throw new Error('库位层号和层内位置号必须完整。')
    const nextNo = locationNo(area, shelf, location.levelNo, location.positionNo)
    location.locationNo = nextNo
    location.locationName = nextNo
  })
}

function validateSnapshot(snapshot: FactoryWarehouseLayoutSnapshot): void {
  if (snapshot.schemaVersion !== 3) throw new Error('布局快照版本无效。')
  if (!Number.isInteger(snapshot.layoutVersion) || snapshot.layoutVersion < 0) throw new Error('布局版本必须是非负整数。')
  const assertCreationMetadata = (node: object, label: string) => {
    if (!Object.prototype.hasOwnProperty.call(node, 'layoutCreatedInVersion')) return
    const createdInVersion = (node as Partial<LayoutNodeCreationMetadata>).layoutCreatedInVersion
    if (typeof createdInVersion !== 'number' || !Number.isInteger(createdInVersion) || createdInVersion < 1 || createdInVersion > snapshot.layoutVersion) {
      throw new Error(`${label}的创建版本必须是 1 到当前布局版本的整数。`)
    }
  }
  const areaIds = new Set<string>()
  const areaCodes = new Set<string>()
  const areaNames = new Set<string>()
  const shelfIds = new Set<string>()
  const locationIds = new Set<string>()
  const locationNos = new Set<string>()
  snapshot.areaList.forEach((area) => {
    assertCreationMetadata(area, `库区 ${area.areaId}`)
    assertText(area.areaId, '库区 ID')
    assertText(area.areaName, '库区名称')
    if (!area.code) throw new Error(`库区 ${area.areaName} 缺少库区代码。`)
    assertAreaCode(area.code)
    if (areaIds.has(area.areaId)) throw new Error(`库区 ID ${area.areaId} 已存在。`)
    if (areaCodes.has(area.code)) throw new Error(`库区代码 ${area.code} 已存在。`)
    const normalizedAreaName = area.areaName.trim()
    if (areaNames.has(normalizedAreaName)) throw new Error(`库区名称 ${normalizedAreaName} 已存在。`)
    areaIds.add(area.areaId)
    areaCodes.add(area.code)
    areaNames.add(normalizedAreaName)
    const sequences = new Set<number>()
    area.shelfList.forEach((shelf) => {
      assertCreationMetadata(shelf, `货架 ${shelf.shelfId}`)
      assertText(shelf.shelfId, '货架 ID')
      if (shelf.shelfSequence === undefined) throw new Error(`货架 ${shelf.shelfName} 缺少货架序号。`)
      assertSequence(shelf.shelfSequence, '货架序号')
      if (shelfIds.has(shelf.shelfId)) throw new Error(`货架 ID ${shelf.shelfId} 已存在。`)
      if (sequences.has(shelf.shelfSequence)) throw new Error(`库区 ${area.code} 的货架序号 ${shelf.shelfSequence} 已存在。`)
      shelfIds.add(shelf.shelfId)
      sequences.add(shelf.shelfSequence)
      const positionsByLevel = new Map<number, number[]>()
      shelf.locationList.forEach((location) => {
        assertCreationMetadata(location, `库位 ${location.locationId}`)
        if (location.levelNo === undefined || location.positionNo === undefined) throw new Error(`库位 ${location.locationNo} 缺少层号或层内位置号。`)
        assertSequence(location.levelNo, '层号')
        assertSequence(location.positionNo, '层内位置号')
        if (locationIds.has(location.locationId)) throw new Error(`库位 ID ${location.locationId} 已存在。`)
        if (locationNos.has(location.locationNo)) throw new Error(`完整编号 ${location.locationNo} 已存在。`)
        const expectedNo = locationNo(area, shelf, location.levelNo, location.positionNo)
        if (location.locationNo !== expectedNo) throw new Error(`库位 ${location.locationId} 的完整编号应为 ${expectedNo}。`)
        locationIds.add(location.locationId)
        locationNos.add(location.locationNo)
        const positions = positionsByLevel.get(location.levelNo) ?? []
        positions.push(location.positionNo)
        positionsByLevel.set(location.levelNo, positions)
      })
      positionsByLevel.forEach((positions, levelNo) => {
        const sorted = [...positions].sort((left, right) => left - right)
        sorted.forEach((positionNo, index) => {
          if (positionNo !== index + 1) throw new Error(`货架 ${shelf.shelfNo} 第 ${levelNo} 层只能从最右端增减，不能出现中间断层。`)
        })
      })
    })
  })
}

function isV3Snapshot(value: unknown, warehouse?: FactoryInternalWarehouse): value is FactoryWarehouseLayoutSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<FactoryWarehouseLayoutSnapshot>
  if (candidate.schemaVersion !== 3 || !Array.isArray(candidate.areaList) || !Number.isInteger(candidate.layoutVersion)) return false
  if (warehouse && (candidate.factoryId !== warehouse.factoryId || candidate.warehouseId !== warehouse.warehouseId || candidate.warehouseKind !== warehouse.warehouseKind)) return false
  try {
    validateSnapshot(candidate as FactoryWarehouseLayoutSnapshot)
    if (warehouse) {
      const baselineAreaIds = new Set(warehouse.areaList.map((area) => area.areaId))
      const baselineShelfIds = new Set(warehouse.areaList.flatMap((area) => area.shelfList.map((shelf) => shelf.shelfId)))
      const baselineLocationIds = new Set(warehouse.areaList.flatMap((area) => area.shelfList.flatMap((shelf) => shelf.locationList.map((location) => location.locationId))))
      const assertBaselineMetadata = (node: object, nodeId: string, baselineIds: Set<string>, label: string) => {
        const hasMetadata = Object.prototype.hasOwnProperty.call(node, 'layoutCreatedInVersion')
        if (baselineIds.has(nodeId) && hasMetadata) throw new Error(`默认${label}不得带创建元数据。`)
        if (!baselineIds.has(nodeId) && !hasMetadata) throw new Error(`新建${label}必须带有效创建元数据。`)
      }
      candidate.areaList.forEach((area) => {
        assertBaselineMetadata(area, area.areaId, baselineAreaIds, '库区')
        area.shelfList.forEach((shelf) => {
          assertBaselineMetadata(shelf, shelf.shelfId, baselineShelfIds, '货架')
          shelf.locationList.forEach((location) => {
            assertBaselineMetadata(location, location.locationId, baselineLocationIds, '库位')
          })
        })
      })
    }
    return true
  } catch {
    return false
  }
}

function nextSnapshot(snapshot: FactoryWarehouseLayoutSnapshot, updatedBy: string, mutate: (next: FactoryWarehouseLayoutSnapshot) => void): FactoryWarehouseLayoutSnapshot {
  assertText(updatedBy, '操作人')
  const next = clone(snapshot)
  mutate(next)
  if (JSON.stringify(next.areaList) === JSON.stringify(snapshot.areaList)) return snapshot
  next.layoutVersion = snapshot.layoutVersion + 1
  next.updatedAt = new Date().toISOString()
  next.updatedBy = updatedBy.trim()
  validateSnapshot(next)
  return next
}

function occupiedNos(snapshot: FactoryWarehouseLayoutSnapshot, ids: Iterable<string>): string[] {
  const occupied = new Set(ids)
  return listLocations(snapshot).filter((location) => occupied.has(location.locationId)).map((location) => location.locationNo)
}

function assertNoOccupied(snapshot: FactoryWarehouseLayoutSnapshot, locationIds: string[], occupiedLocationIds: Iterable<string>, action: string): void {
  const target = new Set(locationIds)
  const conflicts = occupiedNos(snapshot, occupiedLocationIds).filter((no) => {
    const location = listLocations(snapshot).find((item) => item.locationNo === no)
    return Boolean(location && target.has(location.locationId))
  })
  if (conflicts.length) throw new Error(`占用库位 ${conflicts.join('、')} ${action}。`)
}

function newLocationId(snapshot: FactoryWarehouseLayoutSnapshot, shelfId: string, levelNo: number, positionNo: number): string {
  const stem = `${shelfId}-L${String(levelNo).padStart(2, '0')}-P${String(positionNo).padStart(2, '0')}`
  const existing = new Set(listLocations(snapshot).map((location) => location.locationId))
  if (!existing.has(stem)) return stem
  let sequence = 2
  while (existing.has(`${stem}-${sequence}`)) sequence += 1
  return `${stem}-${sequence}`
}

export function listWarehouseLayoutChangeRecords(
  factoryId: string,
  warehouseKind: FactoryInternalWarehouseKind,
  warehouseId = '',
  storage: WarehouseLayoutStorage = currentStorage(),
): WarehouseLayoutChangeRecord[] {
  let raw: string | null = null
  try { raw = storage.getItem(getWarehouseLayoutHistoryStorageKey(factoryId, warehouseKind, warehouseId)) } catch { return [] }
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? clone(parsed.filter((record) => isV3Snapshot(record?.beforeSnapshot) && isV3Snapshot(record?.afterSnapshot)))
      : []
  } catch {
    return []
  }
}

export function buildInitialWarehouseLayoutSnapshot(
  warehouse: FactoryInternalWarehouse,
  updatedBy: string,
): FactoryWarehouseLayoutSnapshot {
  const snapshot: FactoryWarehouseLayoutSnapshot = {
    schemaVersion: 3,
    factoryId: warehouse.factoryId,
    warehouseKind: warehouse.warehouseKind,
    warehouseId: warehouse.warehouseId,
    layoutVersion: 0,
    areaList: clone(warehouse.areaList),
    updatedAt: new Date().toISOString(),
    updatedBy,
  }
  validateSnapshot(snapshot)
  return snapshot
}

export function loadWarehouseLayoutSnapshot(
  warehouse: FactoryInternalWarehouse,
  storage: WarehouseLayoutStorage = currentStorage(),
): LoadedWarehouseLayout {
  const key = getWarehouseLayoutStorageKey(warehouse.factoryId, warehouse.warehouseKind, warehouse.warehouseId)
  let persistenceAvailable = true
  const removeSafely = (removeKey: string) => {
    try { storage.removeItem?.(removeKey) } catch { persistenceAvailable = false }
  }
  legacyLayoutKeys(warehouse.factoryId, warehouse.warehouseKind, warehouse.warehouseId).forEach(removeSafely)
  legacyHistoryKeys(warehouse.factoryId, warehouse.warehouseKind, warehouse.warehouseId).forEach(removeSafely)
  let raw: string | null = null
  try { raw = storage.getItem(key) } catch { persistenceAvailable = false }
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (isV3Snapshot(parsed, warehouse)) {
        if (persistenceAvailable) {
          try { storage.setItem(key, raw) } catch { persistenceAvailable = false }
        }
        return {
          snapshot: clone(parsed),
          warningMessage: persistenceAvailable ? '' : '当前仅可查看，无法保存。',
          persistenceAvailable,
        }
      }
    } catch {
      // Invalid local prototype cache is intentionally discarded below.
    }
    removeSafely(key)
  }
  const snapshot = buildInitialWarehouseLayoutSnapshot(warehouse, '系统初始化')
  try { storage.setItem(key, JSON.stringify(snapshot)) } catch { persistenceAvailable = false }
  return {
    snapshot,
    warningMessage: persistenceAvailable ? '' : '当前仅可查看，无法保存。',
    persistenceAvailable,
  }
}

export function saveWarehouseLayoutSnapshot(
  snapshot: FactoryWarehouseLayoutSnapshot,
  expectedVersion: number,
  storage: WarehouseLayoutStorage = currentStorage(),
): { ok: boolean; message: string; snapshot?: FactoryWarehouseLayoutSnapshot } {
  try { validateSnapshot(snapshot) } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '库位图结构不完整，请检查后重试。' }
  }
  const key = getWarehouseLayoutStorageKey(snapshot.factoryId, snapshot.warehouseKind, snapshot.warehouseId)
  let raw: string | null
  try { raw = storage.getItem(key) } catch {
    return { ok: false, message: '当前仅可查看，无法保存。' }
  }
  let currentSnapshot: FactoryWarehouseLayoutSnapshot | null = null
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (isV3Snapshot(parsed)) currentSnapshot = parsed
    } catch {
      currentSnapshot = null
    }
  }
  if (!currentSnapshot) {
    return { ok: false, message: '未加载当前库位布局，请刷新加载后再保存。' }
  }
  const currentVersion = currentSnapshot.layoutVersion
  if (currentVersion !== expectedVersion || snapshot.layoutVersion !== expectedVersion + 1) {
    return { ok: false, message: '库位图已被更新，请刷新后重试。' }
  }
  const beforeSnapshot = currentSnapshot
  const historyKey = getWarehouseLayoutHistoryStorageKey(snapshot.factoryId, snapshot.warehouseKind, snapshot.warehouseId)
  const history = listWarehouseLayoutChangeRecords(snapshot.factoryId, snapshot.warehouseKind, snapshot.warehouseId, storage)
  const changeRecord: WarehouseLayoutChangeRecord = {
    changeRecordId: `${snapshot.factoryId}:${snapshot.warehouseKind}:v${snapshot.layoutVersion}:${snapshot.updatedAt}`,
    factoryId: snapshot.factoryId,
    warehouseKind: snapshot.warehouseKind,
    warehouseId: snapshot.warehouseId,
    beforeVersion: expectedVersion,
    afterVersion: snapshot.layoutVersion,
    beforeSnapshot: clone(beforeSnapshot),
    afterSnapshot: clone(snapshot),
    updatedAt: snapshot.updatedAt,
    updatedBy: snapshot.updatedBy,
  }
  let previousLayoutRaw: string | null
  let previousHistoryRaw: string | null
  try {
    previousLayoutRaw = storage.getItem(key)
    previousHistoryRaw = storage.getItem(historyKey)
  } catch {
    return { ok: false, message: '当前仅可查看，无法保存。' }
  }
  try {
    storage.setItem(key, JSON.stringify(snapshot))
    storage.setItem(historyKey, JSON.stringify([changeRecord, ...history].slice(0, 100)))
  } catch (error) {
    try {
      if (previousLayoutRaw === null) storage.removeItem?.(key); else storage.setItem(key, previousLayoutRaw)
      if (previousHistoryRaw === null) storage.removeItem?.(historyKey); else storage.setItem(historyKey, previousHistoryRaw)
    } catch { /* Best-effort rollback only. */ }
    const name = typeof DOMException !== 'undefined' && error instanceof DOMException ? error.name : ''
    const message = error instanceof Error ? error.message : ''
    if (error instanceof RangeError || name === 'QuotaExceededError' || /quota|memory|array length|call stack/i.test(message)) {
      return { ok: false, message: '本次规模超出当前设备可处理能力，建议拆分货架/减少单次生成。' }
    }
    return { ok: false, message: '库位图保存失败，未能同步编排历史，请重试。' }
  }
  return { ok: true, message: '库位图编排已保存。', snapshot: clone(snapshot) }
}

export function resetWarehouseLayoutSnapshot(
  warehouse: FactoryInternalWarehouse,
  updatedBy: string,
  storage: WarehouseLayoutStorage = currentStorage(),
): { ok: boolean; message: string; snapshot?: FactoryWarehouseLayoutSnapshot } {
  const key = getWarehouseLayoutStorageKey(warehouse.factoryId, warehouse.warehouseKind, warehouse.warehouseId)
  let raw: string | null
  try { raw = storage.getItem(key) } catch {
    return { ok: false, message: '当前仅可查看，无法保存。' }
  }
  if (raw) {
    try {
      if (isV3Snapshot(JSON.parse(raw), warehouse)) return { ok: false, message: '库位图已被其他页面恢复或更新，请刷新后重试。' }
    } catch { /* Damaged cache may be replaced. */ }
  }
  const loaded = loadWarehouseLayoutSnapshot(warehouse, storage)
  if (!loaded.persistenceAvailable) return { ok: false, message: loaded.warningMessage }
  const baseline = loaded.snapshot
  const snapshot = {
    ...baseline,
    areaList: clone(warehouse.areaList),
    layoutVersion: baseline.layoutVersion + 1,
    updatedAt: new Date().toISOString(),
    updatedBy,
  }
  const result = saveWarehouseLayoutSnapshot(snapshot, 0, storage)
  return result.ok ? { ok: true, message: '已恢复默认编排。', snapshot: result.snapshot } : result
}

export function createWarehouseArea(snapshot: FactoryWarehouseLayoutSnapshot, input: CreateWarehouseAreaInput): FactoryWarehouseLayoutSnapshot {
  assertAreaCode(input.code)
  assertText(input.areaId, '库区 ID')
  assertText(input.areaName, '库区名称')
  if (snapshot.areaList.some((area) => area.areaId === input.areaId)) throw new Error(`库区 ID ${input.areaId} 已存在。`)
  if (snapshot.areaList.some((area) => area.code === input.code)) throw new Error(`库区代码 ${input.code} 已存在。`)
  const normalizedAreaName = input.areaName.trim()
  if (snapshot.areaList.some((area) => area.areaName.trim() === normalizedAreaName)) throw new Error(`库区名称 ${normalizedAreaName} 已存在。`)
  return nextSnapshot(snapshot, input.updatedBy, (next) => {
    next.areaList.push({
      areaId: input.areaId,
      areaName: normalizedAreaName,
      code: input.code,
      shelfList: [],
      status: 'AVAILABLE',
      remark: input.remark?.trim() ?? '',
      layoutCreatedInVersion: snapshot.layoutVersion + 1,
    } as LayoutWarehouseArea)
  })
}

export function updateWarehouseArea(snapshot: FactoryWarehouseLayoutSnapshot, input: UpdateWarehouseAreaInput, occupiedLocationIds: Iterable<string>): FactoryWarehouseLayoutSnapshot {
  const current = findArea(snapshot, input.areaId)
  if (input.code !== undefined) assertAreaCode(input.code)
  if (input.areaName !== undefined) assertText(input.areaName, '库区名称')
  const changesProtectedField = (input.areaName !== undefined && input.areaName.trim() !== current.areaName)
    || (input.code !== undefined && input.code !== current.code)
    || (input.enabled === false && current.status !== 'STOPPED')
  const changesDerivedFields = (input.areaName !== undefined && input.areaName.trim() !== current.areaName)
    || (input.code !== undefined && input.code !== current.code)
  if (changesProtectedField) {
    assertNoOccupied(
      snapshot,
      current.shelfList.flatMap((shelf) => shelf.locationList.map((location) => location.locationId)),
      occupiedLocationIds,
      '只能修改备注，不能修改库区代码、名称或启停状态',
    )
  }
  if (input.code && snapshot.areaList.some((area) => area.areaId !== input.areaId && area.code === input.code)) throw new Error(`库区代码 ${input.code} 已存在。`)
  const normalizedAreaName = input.areaName?.trim()
  if (normalizedAreaName && snapshot.areaList.some((area) => area.areaId !== input.areaId && area.areaName.trim() === normalizedAreaName)) throw new Error(`库区名称 ${normalizedAreaName} 已存在。`)
  return nextSnapshot(snapshot, input.updatedBy, (next) => {
    const area = findArea(next, input.areaId)
    if (input.areaName !== undefined) area.areaName = input.areaName.trim()
    if (input.code !== undefined) area.code = input.code
    if (input.remark !== undefined) area.remark = input.remark.trim()
    if (input.enabled !== undefined) area.status = input.enabled ? 'AVAILABLE' : 'STOPPED'
    if (changesDerivedFields) area.shelfList.forEach((shelf) => renumberShelf(area, shelf))
  })
}

export function createWarehouseShelf(snapshot: FactoryWarehouseLayoutSnapshot, input: CreateWarehouseShelfInput): FactoryWarehouseLayoutSnapshot {
  assertText(input.shelfId, '货架 ID')
  assertSequence(input.shelfSequence, '货架序号')
  if (!input.positionCounts.length) throw new Error('新建货架至少需要 1 层。')
  input.positionCounts.forEach((count, index) => assertSequence(count, `第 ${index + 1} 层位置数`))
  const totalLocationCount = input.positionCounts.reduce((total, count) => total + count, 0)
  if (!Number.isSafeInteger(totalLocationCount)) throw new Error('本次生成库位总数超出语言可安全表示范围，请调整输入后重试。')
  const area = findArea(snapshot, input.areaId)
  if (listShelves(snapshot).some((shelf) => shelf.shelfId === input.shelfId)) throw new Error(`货架 ID ${input.shelfId} 已存在。`)
  if (area.shelfList.some((shelf) => shelf.shelfSequence === input.shelfSequence)) throw new Error(`货架序号 ${input.shelfSequence} 已存在。`)
  return nextSnapshot(snapshot, input.updatedBy, (next) => {
    const nextArea = findArea(next, input.areaId)
    const shelf: FactoryWarehouseShelf = {
      shelfId: input.shelfId,
      shelfNo: `R${String(input.shelfSequence).padStart(2, '0')}`,
      shelfName: `${nextArea.areaName} R${String(input.shelfSequence).padStart(2, '0')}`,
      shelfSequence: input.shelfSequence,
      locationList: [],
      status: 'AVAILABLE',
      remark: input.remark?.trim() ?? '',
      layoutCreatedInVersion: snapshot.layoutVersion + 1,
    } as LayoutWarehouseShelf
    input.positionCounts.forEach((count, levelIndex) => {
      const levelNo = levelIndex + 1
      for (let positionNo = 1; positionNo <= count; positionNo += 1) {
        const no = locationNo(nextArea, shelf, levelNo, positionNo)
        shelf.locationList.push({
          locationId: newLocationId(next, shelf.shelfId, levelNo, positionNo),
          locationNo: no,
          locationName: no,
          levelNo,
          positionNo,
          status: 'AVAILABLE',
          remark: '',
          layoutCreatedInVersion: snapshot.layoutVersion + 1,
        } as LayoutWarehouseLocation)
      }
    })
    nextArea.shelfList.push(shelf)
  })
}

const WAREHOUSE_BUILD_BATCH_SIZE = 200

export async function createWarehouseShelfInBatches(
  snapshot: FactoryWarehouseLayoutSnapshot,
  input: CreateWarehouseShelfInput,
  options: WarehouseShelfBatchOptions = {},
): Promise<FactoryWarehouseLayoutSnapshot> {
  const yieldControl = options.yieldControl ?? (() => new Promise((resolve) => setTimeout(resolve, 0)))
  const assertNotAborted = () => {
    if (options.signal?.aborted) throw new DOMException('已取消生成。', 'AbortError')
  }
  assertNotAborted()
  assertText(input.shelfId, '货架 ID')
  assertSequence(input.shelfSequence, '货架序号')
  if (!input.positionCounts.length) throw new Error('新建货架至少需要 1 层。')
  input.positionCounts.forEach((count, index) => assertSequence(count, `第 ${index + 1} 层位置数`))
  const totalLocationCount = input.positionCounts.reduce((total, count) => total + count, 0)
  if (!Number.isSafeInteger(totalLocationCount)) throw new Error('本次生成库位总数超出语言可安全表示范围，请调整输入后重试。')
  const area = findArea(snapshot, input.areaId)
  if (listShelves(snapshot).some((shelf) => shelf.shelfId === input.shelfId)) throw new Error(`货架 ID ${input.shelfId} 已存在。`)
  if (area.shelfList.some((shelf) => shelf.shelfSequence === input.shelfSequence)) throw new Error(`货架序号 ${input.shelfSequence} 已存在。`)
  const shelfNo = `R${String(input.shelfSequence).padStart(2, '0')}`
  const existingIds = new Set(listLocations(snapshot).map((location) => location.locationId))
  const locationList: FactoryWarehouseLocation[] = []
  let builtCount = 0
  for (let levelIndex = 0; levelIndex < input.positionCounts.length; levelIndex += 1) {
    assertNotAborted()
    const levelNo = levelIndex + 1
    for (let positionNo = 1; positionNo <= input.positionCounts[levelIndex]; positionNo += 1) {
      const no = buildCuttingWarehouseLocationNo(area.code || '', input.shelfSequence, levelNo, positionNo)
      const stem = `${input.shelfId}-L${String(levelNo).padStart(2, '0')}-P${String(positionNo).padStart(2, '0')}`
      let locationId = stem
      let suffix = 2
      while (existingIds.has(locationId)) {
        locationId = `${stem}-${suffix}`
        suffix += 1
      }
      existingIds.add(locationId)
      locationList.push({
        locationId,
        locationNo: no,
        locationName: no,
        levelNo,
        positionNo,
        status: 'AVAILABLE',
        remark: '',
        layoutCreatedInVersion: snapshot.layoutVersion + 1,
      } as LayoutWarehouseLocation)
      builtCount += 1
      if (builtCount % WAREHOUSE_BUILD_BATCH_SIZE === 0) {
        await yieldControl()
        assertNotAborted()
      }
    }
  }
  assertNotAborted()
  return nextSnapshot(snapshot, input.updatedBy, (next) => {
    const nextArea = findArea(next, input.areaId)
    nextArea.shelfList.push({
      shelfId: input.shelfId,
      shelfNo,
      shelfName: `${nextArea.areaName} ${shelfNo}`,
      shelfSequence: input.shelfSequence,
      locationList,
      status: 'AVAILABLE',
      remark: input.remark?.trim() ?? '',
      layoutCreatedInVersion: snapshot.layoutVersion + 1,
    } as LayoutWarehouseShelf)
  })
}

export function updateWarehouseShelf(snapshot: FactoryWarehouseLayoutSnapshot, input: UpdateWarehouseShelfInput, occupiedLocationIds: Iterable<string>): FactoryWarehouseLayoutSnapshot {
  const current = findShelfContext(snapshot, input.shelfId)
  if (input.shelfSequence !== undefined) assertSequence(input.shelfSequence, '货架序号')
  const changesProtectedField = (input.shelfSequence !== undefined && input.shelfSequence !== current.shelf.shelfSequence)
    || (input.shelfName !== undefined && input.shelfName.trim() !== current.shelf.shelfName)
    || (input.enabled === false && current.shelf.status !== 'STOPPED')
  const changesDerivedFields = input.shelfSequence !== undefined && input.shelfSequence !== current.shelf.shelfSequence
  if (changesProtectedField) {
    assertNoOccupied(
      snapshot,
      current.shelf.locationList.map((location) => location.locationId),
      occupiedLocationIds,
      '只能修改备注，不能修改货架序号、名称或启停状态',
    )
  }
  if (input.shelfSequence !== undefined && current.area.shelfList.some((shelf) => shelf.shelfId !== input.shelfId && shelf.shelfSequence === input.shelfSequence)) throw new Error(`货架序号 ${input.shelfSequence} 已存在。`)
  return nextSnapshot(snapshot, input.updatedBy, (next) => {
    const { area, shelf } = findShelfContext(next, input.shelfId)
    if (input.shelfSequence !== undefined) shelf.shelfSequence = input.shelfSequence
    if (input.shelfName !== undefined) shelf.shelfName = input.shelfName.trim()
    if (input.remark !== undefined) shelf.remark = input.remark.trim()
    if (input.enabled !== undefined) shelf.status = input.enabled ? 'AVAILABLE' : 'STOPPED'
    if (changesDerivedFields) renumberShelf(area, shelf)
    if (input.shelfName !== undefined) shelf.shelfName = input.shelfName.trim()
  })
}

export function updateWarehouseLocation(snapshot: FactoryWarehouseLayoutSnapshot, input: UpdateWarehouseLocationInput, occupiedLocationIds: Iterable<string>): FactoryWarehouseLayoutSnapshot {
  const current = findLocationContext(snapshot, input.locationId)
  if (input.levelNo !== undefined) assertSequence(input.levelNo, '层号')
  if (input.positionNo !== undefined) assertSequence(input.positionNo, '层内位置号')
  const structuralChange = (input.levelNo !== undefined && input.levelNo !== current.location.levelNo)
    || (input.positionNo !== undefined && input.positionNo !== current.location.positionNo)
  if (structuralChange) assertNoOccupied(snapshot, [input.locationId], occupiedLocationIds, '只能修改备注，不能修改层号或层内位置号')
  const nextStatus = input.enabled === undefined ? current.location.status : input.enabled ? 'AVAILABLE' : 'STOPPED'
  if (nextStatus !== current.location.status && input.enabled === false) assertNoOccupied(snapshot, [input.locationId], occupiedLocationIds, '不能停用')
  return nextSnapshot(snapshot, input.updatedBy, (next) => {
    const { area, shelf, location } = findLocationContext(next, input.locationId)
    if (input.levelNo !== undefined) location.levelNo = input.levelNo
    if (input.positionNo !== undefined) location.positionNo = input.positionNo
    if (input.remark !== undefined) location.remark = input.remark.trim()
    if (input.enabled !== undefined) location.status = nextStatus
    if (structuralChange) renumberShelf(area, shelf)
  })
}

export function adjustWarehouseLevelPositionCount(snapshot: FactoryWarehouseLayoutSnapshot, input: AdjustWarehouseLevelPositionCountInput, occupiedLocationIds: Iterable<string>): FactoryWarehouseLayoutSnapshot {
  assertSequence(input.levelNo, '层号')
  assertSequence(input.positionCount, '每层库位数量')
  const { shelf } = findShelfContext(snapshot, input.shelfId)
  const currentLevel = shelf.locationList.filter((location) => location.levelNo === input.levelNo)
  if (!currentLevel.length) throw new Error(`货架 ${shelf.shelfNo} 不存在第 ${input.levelNo} 层。`)
  const currentCount = Math.max(...currentLevel.map((location) => location.positionNo ?? 0))
  if (input.positionCount === currentCount) return snapshot
  if (input.positionCount < currentCount) {
    const removedIds = currentLevel.filter((location) => (location.positionNo ?? 0) > input.positionCount).map((location) => location.locationId)
    assertNoOccupied(snapshot, removedIds, occupiedLocationIds, '不能减少')
  }
  return nextSnapshot(snapshot, input.updatedBy, (next) => {
    const { area, shelf: nextShelf } = findShelfContext(next, input.shelfId)
    if (input.positionCount < currentCount) {
      nextShelf.locationList = nextShelf.locationList.filter((location) => location.levelNo !== input.levelNo || (location.positionNo ?? 0) <= input.positionCount)
    } else {
      for (let positionNo = currentCount + 1; positionNo <= input.positionCount; positionNo += 1) {
        const no = locationNo(area, nextShelf, input.levelNo, positionNo)
        nextShelf.locationList.push({
          locationId: newLocationId(next, nextShelf.shelfId, input.levelNo, positionNo),
          locationNo: no,
          locationName: no,
          levelNo: input.levelNo,
          positionNo,
          status: 'AVAILABLE',
          remark: '',
          layoutCreatedInVersion: snapshot.layoutVersion + 1,
        } as LayoutWarehouseLocation)
      }
    }
    nextShelf.locationList.sort((left, right) => (left.levelNo ?? 0) - (right.levelNo ?? 0) || (left.positionNo ?? 0) - (right.positionNo ?? 0))
  })
}

export function setWarehouseLocationEnabled(snapshot: FactoryWarehouseLayoutSnapshot, input: SetWarehouseLocationEnabledInput, occupiedLocationIds: Iterable<string>): FactoryWarehouseLayoutSnapshot {
  return updateWarehouseLocation(snapshot, input, occupiedLocationIds)
}

export function revokeNewWarehouseNode(snapshot: FactoryWarehouseLayoutSnapshot, input: RevokeNewWarehouseNodeInput, referencedLocationIds: Iterable<string>): FactoryWarehouseLayoutSnapshot {
  if (!Number.isInteger(input.createdInLayoutVersion)
    || input.createdInLayoutVersion < 1
    || input.createdInLayoutVersion > snapshot.layoutVersion) {
    throw new Error('仅允许撤销本次新建的错误节点，日常维护不能硬删除。')
  }
  const referenced = new Set(referencedLocationIds)
  let locationIds: string[] = []
  let node: LayoutWarehouseArea | LayoutWarehouseShelf | LayoutWarehouseLocation
  if (input.nodeType === 'AREA') {
    node = findArea(snapshot, input.nodeId) as LayoutWarehouseArea
    locationIds = node.shelfList.flatMap((shelf) => shelf.locationList.map((location) => location.locationId))
  } else if (input.nodeType === 'SHELF') {
    node = findShelfContext(snapshot, input.nodeId).shelf as LayoutWarehouseShelf
    locationIds = node.locationList.map((location) => location.locationId)
  } else {
    node = findLocationContext(snapshot, input.nodeId).location as LayoutWarehouseLocation
    locationIds = [node.locationId]
  }
  if (node.layoutCreatedInVersion !== input.createdInLayoutVersion) {
    throw new Error('仅允许撤销本次新建的错误节点，日常维护不能硬删除。')
  }
  const conflicts = locationIds.filter((locationId) => referenced.has(locationId))
  if (conflicts.length) {
    const conflictNos = conflicts.map((locationId) => findLocationContext(snapshot, locationId).location.locationNo)
    throw new Error(`库位 ${conflictNos.join('、')} 已被引用或占用，不能撤销。`)
  }
  return nextSnapshot(snapshot, input.updatedBy, (next) => {
    if (input.nodeType === 'AREA') next.areaList = next.areaList.filter((area) => area.areaId !== input.nodeId)
    if (input.nodeType === 'SHELF') {
      const context = findShelfContext(next, input.nodeId)
      context.area.shelfList = context.area.shelfList.filter((shelf) => shelf.shelfId !== input.nodeId)
    }
    if (input.nodeType === 'LOCATION') {
      const context = findLocationContext(next, input.nodeId)
      context.shelf.locationList = context.shelf.locationList.filter((location) => location.locationId !== input.nodeId)
    }
  })
}

function assertCompleteOrderIds(currentIds: readonly string[], orderedIds: readonly string[], label: string): void {
  const current = new Set(currentIds)
  if (orderedIds.length !== currentIds.length
    || orderedIds.some((id) => typeof id !== 'string' || !current.has(id))
    || new Set(orderedIds).size !== current.size) {
    throw new Error(`${label}排序必须保留完整节点集合，不能新增、删除或修改节点事实。`)
  }
}

function hasSameOrder(currentIds: readonly string[], orderedIds: readonly string[]): boolean {
  return currentIds.every((id, index) => id === orderedIds[index])
}

export function reorderWarehouseAreas(
  snapshot: FactoryWarehouseLayoutSnapshot,
  orderedAreaIds: readonly string[],
  updatedBy = snapshot.updatedBy,
): FactoryWarehouseLayoutSnapshot {
  const currentIds = snapshot.areaList.map((area) => area.areaId)
  assertCompleteOrderIds(currentIds, orderedAreaIds, '库区')
  if (hasSameOrder(currentIds, orderedAreaIds)) return snapshot
  return nextSnapshot(snapshot, updatedBy, (next) => {
    const byId = new Map(next.areaList.map((area) => [area.areaId, area]))
    next.areaList = orderedAreaIds.map((areaId) => byId.get(areaId)!)
  })
}

export function reorderWarehouseShelves(
  snapshot: FactoryWarehouseLayoutSnapshot,
  areaId: string,
  orderedShelfIds: readonly string[],
  updatedBy = snapshot.updatedBy,
): FactoryWarehouseLayoutSnapshot {
  const current = findArea(snapshot, areaId)
  const currentIds = current.shelfList.map((shelf) => shelf.shelfId)
  assertCompleteOrderIds(currentIds, orderedShelfIds, '货架')
  if (hasSameOrder(currentIds, orderedShelfIds)) return snapshot
  return nextSnapshot(snapshot, updatedBy, (next) => {
    const area = findArea(next, areaId)
    const byId = new Map(area.shelfList.map((shelf) => [shelf.shelfId, shelf]))
    area.shelfList = orderedShelfIds.map((shelfId) => byId.get(shelfId)!)
  })
}

export function reorderWarehouseLocations(
  snapshot: FactoryWarehouseLayoutSnapshot,
  shelfId: string,
  orderedLocationIds: readonly string[],
  updatedBy = snapshot.updatedBy,
): FactoryWarehouseLayoutSnapshot {
  const current = findShelfContext(snapshot, shelfId).shelf
  const currentIds = current.locationList.map((location) => location.locationId)
  assertCompleteOrderIds(currentIds, orderedLocationIds, '库位')
  if (hasSameOrder(currentIds, orderedLocationIds)) return snapshot
  return nextSnapshot(snapshot, updatedBy, (next) => {
    const shelf = findShelfContext(next, shelfId).shelf
    const byId = new Map(shelf.locationList.map((location) => [location.locationId, location]))
    shelf.locationList = orderedLocationIds.map((locationId) => byId.get(locationId)!)
  })
}

export function appendWarehouseArea(snapshot: FactoryWarehouseLayoutSnapshot, area: FactoryWarehouseArea): FactoryWarehouseLayoutSnapshot {
  const usedCodes = new Set(snapshot.areaList.map((item) => item.code))
  const code = area.code && /^[A-Z]$/.test(area.code)
    ? area.code
    : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((item) => !usedCodes.has(item))
  if (!code) throw new Error('库区代码 A 到 Z 已全部使用，不能继续新增。')
  return createWarehouseArea(snapshot, {
    areaId: area.areaId,
    areaName: area.areaName,
    code,
    remark: area.remark,
    updatedBy: snapshot.updatedBy,
  })
}

export function appendWarehouseLocation(snapshot: FactoryWarehouseLayoutSnapshot, areaId: string, shelfId: string, location: FactoryWarehouseLocation): FactoryWarehouseLayoutSnapshot {
  return nextSnapshot(snapshot, snapshot.updatedBy, (next) => {
    const context = findShelfContext(next, shelfId)
    if (context.area.areaId !== areaId) throw new Error('目标库区或货架不存在。')
    const levelNo = Math.max(1, ...context.shelf.locationList.map((item) => item.levelNo ?? 0))
    const positionNo = Math.max(0, ...context.shelf.locationList.filter((item) => item.levelNo === levelNo).map((item) => item.positionNo ?? 0)) + 1
    assertSequence(positionNo, '每层库位数量')
    const no = locationNo(context.area, context.shelf, levelNo, positionNo)
    context.shelf.locationList.push({
      ...clone(location),
      locationNo: no,
      locationName: no,
      levelNo,
      positionNo,
      layoutCreatedInVersion: snapshot.layoutVersion + 1,
    } as LayoutWarehouseLocation)
  })
}

export function applyWarehouseLayoutSnapshot(
  warehouse: FactoryInternalWarehouse,
  snapshot: FactoryWarehouseLayoutSnapshot,
): AppliedWarehouseLayout {
  if (!isV3Snapshot(snapshot, warehouse)) {
    return { warehouse: clone(warehouse), warningMessages: ['编排与当前仓库不匹配，已使用当前默认布局。'] }
  }
  return { warehouse: { ...clone(warehouse), areaList: clone(snapshot.areaList) }, warningMessages: [] }
}
