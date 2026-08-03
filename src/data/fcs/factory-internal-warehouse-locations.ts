import { mockFactories } from './factory-mock-data.ts'
import type { Factory, FactoryType } from './factory-types.ts'
import { buildCuttingWarehouseAreaList } from './cutting/warehouse-location-mock.ts'

export type FactoryInternalWarehouseKind = 'WAIT_PROCESS' | 'WAIT_HANDOVER'
export type FactoryWarehouseLocationStatus = 'AVAILABLE' | 'STOPPED'

export interface FactoryWarehouseLocation {
  locationId: string
  locationNo: string
  locationName: string
  levelNo?: number
  positionNo?: number
  status: FactoryWarehouseLocationStatus
  remark?: string
}

export interface FactoryWarehouseShelf {
  shelfId: string
  shelfNo: string
  shelfName: string
  shelfSequence?: number
  locationList: FactoryWarehouseLocation[]
  status: FactoryWarehouseLocationStatus
  remark?: string
}

export interface FactoryWarehouseArea {
  areaId: string
  areaName: string
  code?: string
  shelfList: FactoryWarehouseShelf[]
  status: FactoryWarehouseLocationStatus
  remark?: string
}

export interface FactoryInternalWarehouse {
  warehouseId: string
  factoryId: string
  factoryName: string
  factoryKind: FactoryType
  warehouseKind: FactoryInternalWarehouseKind
  warehouseName: string
  warehouseShortName: '待加工仓' | '待交出仓'
  isDefault: boolean
  isEnabled: boolean
  areaList: FactoryWarehouseArea[]
  createdAt: string
  updatedAt: string
}

export interface FactoryWarehouseNodeRow {
  rowType: 'AREA' | 'SHELF' | 'LOCATION'
  warehouseId: string
  warehouseName: string
  factoryId: string
  factoryName: string
  areaId: string
  areaName: string
  shelfId?: string
  shelfNo?: string
  shelfName?: string
  locationId?: string
  locationNo?: string
  locationName?: string
  status: FactoryWarehouseLocationStatus
  remark?: string
}

export interface ResolvedFactoryWarehouseLocation {
  warehouse: FactoryInternalWarehouse
  area: FactoryWarehouseArea
  shelf: FactoryWarehouseShelf
  location: FactoryWarehouseLocation
}

export type FactoryWarehouseLocationRegistrySnapshot = FactoryInternalWarehouse[]

const DEFAULT_AREA_NAMES = ['A区', 'B区', 'C区', 'D区', 'E区', 'F区', '异常区', '待确认区'] as const
const SEWING_FACTORY_TYPES = new Set<FactoryType>(['CENTRAL_GARMENT', 'SATELLITE_SEWING', 'THIRD_SEWING'])
const ONBOARDING_CUTTING_FACTORIES = [
  { factoryId: 'FACTORY-ONBOARD-0034', factoryName: '定向裁演示工厂34' },
  { factoryId: 'FACTORY-ONBOARD-0035', factoryName: '定位裁演示工厂35' },
] as const

let warehouseLocationRegistry: FactoryInternalWarehouse[] | null = null
const knownWarehouseLocationPairs = new Set<string>()

function warehouseLocationPair(warehouseId: string, locationId: string): string {
  return `${warehouseId}|${locationId}`
}

function rememberWarehouseLocations(warehouses: FactoryInternalWarehouse[]): void {
  for (const warehouse of warehouses) {
    for (const area of warehouse.areaList) {
      for (const shelf of area.shelfList) {
        for (const location of shelf.locationList) {
          knownWarehouseLocationPairs.add(warehouseLocationPair(warehouse.warehouseId, location.locationId))
        }
      }
    }
  }
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function getWarehouseShortName(warehouseKind: FactoryInternalWarehouseKind): '待加工仓' | '待交出仓' {
  return warehouseKind === 'WAIT_PROCESS' ? '待加工仓' : '待交出仓'
}

function buildDefaultLocations(areaName: string): FactoryWarehouseLocation[] {
  const prefix = areaName.replace('区', '')
  return [
    {
      locationId: `LOC-${prefix}-01-01`,
      locationNo: `${prefix}-01-01`,
      locationName: `${prefix}-01-01`,
      status: 'AVAILABLE',
      remark: areaName === '异常区' ? '用于差异与破损暂存' : areaName === '待确认区' ? '待领料或待确认明细' : '',
    },
    {
      locationId: `LOC-${prefix}-01-02`,
      locationNo: `${prefix}-01-02`,
      locationName: `${prefix}-01-02`,
      status: 'AVAILABLE',
      remark: '',
    },
  ]
}

function buildDefaultShelf(areaName: string): FactoryWarehouseShelf[] {
  const prefix = areaName.replace('区', '')
  return [
    {
      shelfId: `SHELF-${prefix}-01`,
      shelfNo: `${prefix}-01`,
      shelfName: `${prefix}-01`,
      locationList: buildDefaultLocations(areaName),
      status: 'AVAILABLE',
      remark: areaName === '异常区' ? '异常件集中放置' : '',
    },
  ]
}

function buildDefaultAreaList(): FactoryWarehouseArea[] {
  return DEFAULT_AREA_NAMES.map((areaName) => ({
    areaId: `AREA-${areaName}`,
    areaName,
    shelfList: buildDefaultShelf(areaName),
    status: 'AVAILABLE',
    remark: areaName === '待确认区' ? '待接收或待复核' : '',
  }))
}

export function buildCraftWarehouseAreas(): FactoryWarehouseArea[] {
  return [
    { areaId: 'AUX-WP-AREA-01', areaName: '绣花-成衣库区', shelfList: buildDefaultShelf('AUX-WP-01'), status: 'AVAILABLE' },
    { areaId: 'AUX-WP-AREA-02', areaName: '绣花-裁片库区', shelfList: buildDefaultShelf('AUX-WP-02'), status: 'AVAILABLE' },
    { areaId: 'AUX-WP-AREA-03', areaName: '烫画-成衣库区', shelfList: buildDefaultShelf('AUX-WP-03'), status: 'AVAILABLE' },
    { areaId: 'AUX-WP-AREA-04', areaName: '直喷-成衣库区', shelfList: buildDefaultShelf('AUX-WP-04'), status: 'AVAILABLE' },
    { areaId: 'AUX-WP-AREA-05', areaName: '抽条-裁片库区', shelfList: buildDefaultShelf('AUX-WP-05'), status: 'AVAILABLE' },
    { areaId: 'AUX-WP-AREA-06', areaName: '压褶-裁片库区', shelfList: buildDefaultShelf('AUX-WP-06'), status: 'AVAILABLE' },
    { areaId: 'AUX-WP-AREA-07', areaName: '打缆-裁片库区', shelfList: buildDefaultShelf('AUX-WP-07'), status: 'AVAILABLE' },
    { areaId: 'AUX-WP-AREA-08', areaName: '贝壳绣-裁片库区', shelfList: buildDefaultShelf('AUX-WP-08'), status: 'AVAILABLE' },
    { areaId: 'AUX-WP-AREA-09', areaName: '曲牙绣-裁片库区', shelfList: buildDefaultShelf('AUX-WP-09'), status: 'AVAILABLE' },
    { areaId: 'AUX-WP-AREA-10', areaName: '直牙绣-裁片库区', shelfList: buildDefaultShelf('AUX-WP-10'), status: 'AVAILABLE' },
    { areaId: 'SPC-WP-AREA-01', areaName: '模板工艺-裁片库区', shelfList: buildDefaultShelf('SPC-WP-01'), status: 'AVAILABLE' },
    { areaId: 'SPC-WP-AREA-02', areaName: '激光袋-裁片库区', shelfList: buildDefaultShelf('SPC-WP-02'), status: 'AVAILABLE' },
    { areaId: 'SPC-WP-AREA-03', areaName: '花样机-裁片库区', shelfList: buildDefaultShelf('SPC-WP-03'), status: 'AVAILABLE' },
    { areaId: 'SPC-WP-AREA-04', areaName: '橡筋定长-辅料库区', shelfList: buildDefaultShelf('SPC-WP-04'), status: 'AVAILABLE' },
  ]
}

function buildFactoryAreaList(
  factoryId: string,
  factoryType: FactoryType,
  warehouseKind: FactoryInternalWarehouseKind,
): FactoryWarehouseArea[] {
  if (factoryId === 'FAC-AUX-CRAFT') {
    return buildCraftWarehouseAreas().filter((area) => area.areaId.startsWith('AUX-'))
  }
  if (factoryId === 'FAC-SPC-CRAFT') {
    return buildCraftWarehouseAreas().filter((area) => area.areaId.startsWith('SPC-'))
  }
  if (factoryType === 'CENTRAL_CUTTING') {
    return buildCuttingWarehouseAreaList(warehouseKind)
  }
  return buildDefaultAreaList()
}

export function buildDefaultFactoryInternalWarehouses(factories: Factory[] = mockFactories): FactoryInternalWarehouse[] {
  const seenIds = new Set<string>()
  return factories
    .filter((factory) => !SEWING_FACTORY_TYPES.has(factory.factoryType))
    .filter((factory) => {
      if (seenIds.has(factory.id)) return false
      seenIds.add(factory.id)
      return true
    })
    .flatMap((factory) => {
      const createdAt = factory.createdAt || '2026-04-01 08:00:00'
      const updatedAt = factory.updatedAt || createdAt
      return (['WAIT_PROCESS', 'WAIT_HANDOVER'] as const).map((warehouseKind) => {
        const warehouseShortName = getWarehouseShortName(warehouseKind)
        return {
          warehouseId: `FIW-${factory.id}-${warehouseKind}`,
          factoryId: factory.id,
          factoryName: factory.name,
          factoryKind: factory.factoryType,
          warehouseKind,
          warehouseName: `${factory.name} · ${warehouseShortName}`,
          warehouseShortName,
          isDefault: true,
          isEnabled: true,
          areaList: buildFactoryAreaList(factory.id, factory.factoryType, warehouseKind),
          createdAt,
          updatedAt,
        }
      })
    })
}

function buildOnboardingCuttingInternalWarehouses(): FactoryInternalWarehouse[] {
  return ONBOARDING_CUTTING_FACTORIES.flatMap((factory) =>
    (['WAIT_PROCESS', 'WAIT_HANDOVER'] as const).map((warehouseKind) => {
      const warehouseShortName = getWarehouseShortName(warehouseKind)
      return {
        warehouseId: `FIW-${factory.factoryId}-${warehouseKind}`,
        factoryId: factory.factoryId,
        factoryName: factory.factoryName,
        factoryKind: 'CENTRAL_CUTTING',
        warehouseKind,
        warehouseName: `${factory.factoryName} · ${warehouseShortName}`,
        warehouseShortName,
        isDefault: true,
        isEnabled: true,
        areaList: buildCuttingWarehouseAreaList(warehouseKind),
        createdAt: '2026-04-20 08:00:00',
        updatedAt: '2026-04-20 08:00:00',
      }
    }),
  )
}

function ensureWarehouseLocationRegistry(): FactoryInternalWarehouse[] {
  if (!warehouseLocationRegistry) {
    warehouseLocationRegistry = [
      ...buildDefaultFactoryInternalWarehouses(),
      ...buildOnboardingCuttingInternalWarehouses(),
    ]
    rememberWarehouseLocations(warehouseLocationRegistry)
  }
  return warehouseLocationRegistry
}

export function getFactoryInternalWarehouseRegistryReference(): FactoryInternalWarehouse[] {
  return ensureWarehouseLocationRegistry()
}

export function listFactoryInternalWarehouses(): FactoryInternalWarehouse[] {
  return cloneValue(ensureWarehouseLocationRegistry())
}

export function resolveEnabledFactoryWarehouseLocation(
  warehouseId: string,
  locationId: string,
): ResolvedFactoryWarehouseLocation | undefined {
  const warehouse = ensureWarehouseLocationRegistry().find((item) =>
    item.warehouseId === warehouseId && item.isEnabled,
  )
  if (!warehouse) return undefined
  for (const area of warehouse.areaList) {
    if (area.status !== 'AVAILABLE') continue
    for (const shelf of area.shelfList) {
      if (shelf.status !== 'AVAILABLE') continue
      const location = shelf.locationList.find((item) =>
        item.locationId === locationId && item.status === 'AVAILABLE',
      )
      if (location) {
        return cloneValue({ warehouse, area, shelf, location })
      }
    }
  }
  return undefined
}

export function resolveFactoryWarehouseLocation(
  warehouseId: string,
  locationId: string,
): ResolvedFactoryWarehouseLocation | undefined {
  const warehouse = ensureWarehouseLocationRegistry().find((item) =>
    item.warehouseId === warehouseId,
  )
  if (!warehouse) return undefined
  for (const area of warehouse.areaList) {
    for (const shelf of area.shelfList) {
      const location = shelf.locationList.find((item) => item.locationId === locationId)
      if (location) return cloneValue({ warehouse, area, shelf, location })
    }
  }
  return undefined
}

export function isKnownFactoryWarehouseLocation(
  warehouseId: string,
  locationId: string,
): boolean {
  return Boolean(resolveFactoryWarehouseLocation(warehouseId, locationId))
    || knownWarehouseLocationPairs.has(warehouseLocationPair(warehouseId, locationId))
}

export function createFactoryWarehouseLocationRegistrySnapshot(): FactoryWarehouseLocationRegistrySnapshot {
  return cloneValue(ensureWarehouseLocationRegistry())
}

export function restoreFactoryWarehouseLocationRegistrySnapshot(
  snapshot: FactoryWarehouseLocationRegistrySnapshot,
): void {
  const registry = ensureWarehouseLocationRegistry()
  rememberWarehouseLocations(registry)
  rememberWarehouseLocations(snapshot)
  registry.splice(0, registry.length, ...cloneValue(snapshot))
}

function mutateWarehouseNode(
  rowType: FactoryWarehouseNodeRow['rowType'],
  ids: { warehouseId: string; areaId: string; shelfId?: string; locationId?: string },
  updater: (target: FactoryWarehouseArea | FactoryWarehouseShelf | FactoryWarehouseLocation) => void,
): boolean {
  const warehouse = ensureWarehouseLocationRegistry().find((item) => item.warehouseId === ids.warehouseId)
  if (!warehouse) return false
  const area = warehouse.areaList.find((item) => item.areaId === ids.areaId)
  if (!area) return false
  if (rowType === 'AREA') {
    updater(area)
    warehouse.updatedAt = nowTimestamp()
    return true
  }
  const shelf = area.shelfList.find((item) => item.shelfId === ids.shelfId)
  if (!shelf) return false
  if (rowType === 'SHELF') {
    updater(shelf)
    warehouse.updatedAt = nowTimestamp()
    return true
  }
  const location = shelf.locationList.find((item) => item.locationId === ids.locationId)
  if (!location) return false
  updater(location)
  warehouse.updatedAt = nowTimestamp()
  return true
}

export function createFactoryWarehouseArea(warehouseId: string): FactoryWarehouseArea | null {
  const warehouse = ensureWarehouseLocationRegistry().find((item) => item.warehouseId === warehouseId)
  if (!warehouse) return null
  const nextIndex = warehouse.areaList.length + 1
  const areaName = `扩展区${nextIndex}`
  const area: FactoryWarehouseArea = {
    areaId: `AREA-${warehouseId}-${nextIndex}`,
    areaName,
    shelfList: [{
      shelfId: `SHELF-${warehouseId}-${nextIndex}-01`,
      shelfNo: `扩展-${nextIndex}-01`,
      shelfName: `扩展-${nextIndex}-01`,
      locationList: [{
        locationId: `LOC-${warehouseId}-${nextIndex}-01-01`,
        locationNo: `扩展-${nextIndex}-01-01`,
        locationName: `扩展-${nextIndex}-01-01`,
        status: 'AVAILABLE',
        remark: '',
      }],
      status: 'AVAILABLE',
      remark: '',
    }],
    status: 'AVAILABLE',
    remark: '',
  }
  warehouse.areaList.push(area)
  warehouse.updatedAt = nowTimestamp()
  return cloneValue(area)
}

export function createFactoryWarehouseShelf(warehouseId: string, areaId?: string): FactoryWarehouseShelf | null {
  const warehouse = ensureWarehouseLocationRegistry().find((item) => item.warehouseId === warehouseId)
  if (!warehouse) return null
  const area = warehouse.areaList.find((item) => item.areaId === areaId) || warehouse.areaList[0]
  if (!area) return null
  const nextIndex = area.shelfList.length + 1
  const prefix = area.areaName.replace('区', '')
  const shelf: FactoryWarehouseShelf = {
    shelfId: `SHELF-${area.areaId}-${nextIndex}`,
    shelfNo: `${prefix}-${String(nextIndex).padStart(2, '0')}`,
    shelfName: `${prefix}-${String(nextIndex).padStart(2, '0')}`,
    locationList: [{
      locationId: `LOC-${area.areaId}-${nextIndex}-01`,
      locationNo: `${prefix}-${String(nextIndex).padStart(2, '0')}-01`,
      locationName: `${prefix}-${String(nextIndex).padStart(2, '0')}-01`,
      status: 'AVAILABLE',
      remark: '',
    }],
    status: 'AVAILABLE',
    remark: '',
  }
  area.shelfList.push(shelf)
  rememberWarehouseLocations([warehouse])
  warehouse.updatedAt = nowTimestamp()
  return cloneValue(shelf)
}

export function createFactoryWarehouseLocation(
  warehouseId: string,
  areaId?: string,
  shelfId?: string,
): FactoryWarehouseLocation | null {
  const warehouse = ensureWarehouseLocationRegistry().find((item) => item.warehouseId === warehouseId)
  if (!warehouse) return null
  const area = warehouse.areaList.find((item) => item.areaId === areaId) || warehouse.areaList[0]
  if (!area) return null
  const shelf = area.shelfList.find((item) => item.shelfId === shelfId) || area.shelfList[0]
  if (!shelf) return null
  const nextIndex = shelf.locationList.length + 1
  const location: FactoryWarehouseLocation = {
    locationId: `LOC-${shelf.shelfId}-${nextIndex}`,
    locationNo: `${shelf.shelfNo}-${String(nextIndex).padStart(2, '0')}`,
    locationName: `${shelf.shelfNo}-${String(nextIndex).padStart(2, '0')}`,
    status: 'AVAILABLE',
    remark: '',
  }
  shelf.locationList.push(location)
  knownWarehouseLocationPairs.add(warehouseLocationPair(warehouse.warehouseId, location.locationId))
  warehouse.updatedAt = nowTimestamp()
  return cloneValue(location)
}

export function updateFactoryWarehouseNodeRemark(
  rowType: FactoryWarehouseNodeRow['rowType'],
  ids: { warehouseId: string; areaId: string; shelfId?: string; locationId?: string },
  remark: string,
): boolean {
  return mutateWarehouseNode(rowType, ids, (target) => {
    target.remark = remark.trim()
  })
}

export function toggleFactoryWarehouseNodeStatus(
  rowType: FactoryWarehouseNodeRow['rowType'],
  ids: { warehouseId: string; areaId: string; shelfId?: string; locationId?: string },
): boolean {
  return mutateWarehouseNode(rowType, ids, (target) => {
    target.status = target.status === 'AVAILABLE' ? 'STOPPED' : 'AVAILABLE'
  })
}
