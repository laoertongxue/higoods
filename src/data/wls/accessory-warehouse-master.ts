export type AccessoryWarehouseKey = 'gtp' | 'hilon' | 'mahameru'

export interface AccessoryWarehouseMaster {
  key: AccessoryWarehouseKey
  code: string
  name: string
  type: '自建' | '合作'
  businessType: '辅料仓'
  contact: string
  country: string
  timezone: string
  manager: string
  enabled: boolean
  subjects: string[]
  zoneCount: number
  locationCount: number
  boundFactoryName: string
}

export interface AccessoryWarehouseZone {
  id: string
  zoneName: string
  warehouseCode: string
  warehouseName: string
  locationCount: number
  zoneType: '存储' | '暂存'
  enabled: boolean
}

export interface AccessoryWarehouseLocation {
  id: string
  locationCode: string
  warehouseCode: string
  warehouseName: string
  zoneId: string
  zoneName: string
  enabled: boolean
}

type WarehouseSeed = Readonly<Omit<AccessoryWarehouseMaster, 'subjects'>> & {
  readonly subjects: readonly string[]
}

function freezeWarehouse(warehouse: AccessoryWarehouseMaster): WarehouseSeed {
  return Object.freeze({ ...warehouse, subjects: Object.freeze([...warehouse.subjects]) })
}

// 固定演示主数据：读取不写入浏览器存储，也不代表现场仓库属性已核定。
// WH-FITTING-MAHAMERU 是本地演示编号；库区、库位及联系人均为演示配置。
// 不在此主数据中虚构库存、收货、领料或调拨记录。
const warehouseSeeds: readonly WarehouseSeed[] = Object.freeze([
  freezeWarehouse({
    key: 'gtp',
    code: 'WH-FITTING-001',
    name: '辅料中央仓（GTP）',
    type: '自建',
    businessType: '辅料仓',
    contact: 'GTP联系人（演示）',
    country: '印度尼西亚',
    timezone: 'Asia/Jakarta',
    manager: 'GTP仓管（演示）',
    enabled: true,
    subjects: ['HiGood 印尼（演示）'],
    zoneCount: 2,
    locationCount: 6,
    boundFactoryName: '',
  }),
  freezeWarehouse({
    key: 'hilon',
    code: 'HILON-2',
    name: 'HILON辅料仓',
    type: '合作',
    businessType: '辅料仓',
    contact: 'HILON联系人（演示）',
    country: '印度尼西亚',
    timezone: 'Asia/Jakarta',
    manager: 'HILON仓管（演示）',
    enabled: true,
    subjects: ['HiGood 印尼（演示）'],
    zoneCount: 2,
    locationCount: 6,
    boundFactoryName: 'sea cutting',
  }),
  freezeWarehouse({
    key: 'mahameru',
    code: 'WH-FITTING-MAHAMERU',
    name: 'Mahameru辅料仓',
    type: '合作',
    businessType: '辅料仓',
    contact: 'Mahameru联系人（演示）',
    country: '印度尼西亚',
    timezone: 'Asia/Jakarta',
    manager: 'Mahameru仓管（演示）',
    enabled: true,
    subjects: ['HiGood 印尼（演示）'],
    zoneCount: 2,
    locationCount: 6,
    boundFactoryName: 'sea cutting2',
  }),
])

const locationPrefixes: Readonly<Record<AccessoryWarehouseKey, string>> = Object.freeze({
  gtp: 'GTP',
  hilon: 'HILON',
  mahameru: 'MAHAMERU',
})

const zoneSeeds: readonly Readonly<AccessoryWarehouseZone>[] = Object.freeze(
  warehouseSeeds.flatMap((warehouse) => ['A', 'B'].map((letter) => Object.freeze({
    id: `${warehouse.code}-ZONE-${letter}`,
    zoneName: `辅料存储${letter}区`,
    warehouseCode: warehouse.code,
    warehouseName: warehouse.name,
    locationCount: 3,
    zoneType: '存储' as const,
    enabled: true,
  }))),
)

const locationSeeds: readonly Readonly<AccessoryWarehouseLocation>[] = Object.freeze(
  warehouseSeeds.flatMap((warehouse) => zoneSeeds
    .filter((zone) => zone.warehouseCode === warehouse.code)
    .flatMap((zone) => [1, 2, 3].map((index) => {
      const letter = zone.id.slice(-1)
      const locationCode = `${locationPrefixes[warehouse.key]}-${letter}-${String(index).padStart(2, '0')}`
      return Object.freeze({
        id: `${warehouse.code}-LOCATION-${letter}-${index}`,
        locationCode,
        warehouseCode: warehouse.code,
        warehouseName: warehouse.name,
        zoneId: zone.id,
        zoneName: zone.zoneName,
        enabled: true,
      })
    }))),
)

function copyWarehouse(warehouse: WarehouseSeed): AccessoryWarehouseMaster {
  return { ...warehouse, subjects: [...warehouse.subjects] }
}

export function listAccessoryWarehouses(): AccessoryWarehouseMaster[] {
  return warehouseSeeds.map(copyWarehouse)
}

export function getAccessoryWarehouse(key: AccessoryWarehouseKey): AccessoryWarehouseMaster {
  const warehouse = warehouseSeeds.find((item) => item.key === key)
  if (!warehouse) throw new RangeError(`Unknown accessory warehouse: ${key}`)
  return copyWarehouse(warehouse)
}

export function listAccessoryWarehouseZones(warehouseCode?: string): AccessoryWarehouseZone[] {
  return zoneSeeds
    .filter((zone) => warehouseCode === undefined || zone.warehouseCode === warehouseCode)
    .map((zone) => ({ ...zone }))
}

export function listAccessoryWarehouseLocations(warehouseCode?: string): AccessoryWarehouseLocation[] {
  return locationSeeds
    .filter((location) => warehouseCode === undefined || location.warehouseCode === warehouseCode)
    .map((location) => ({ ...location }))
}

/** 收货上架只允许选择本仓及其启用库区内的启用库位。 */
export function listEnabledAccessoryWarehouseLocations(warehouseCode: string): AccessoryWarehouseLocation[] {
  const warehouse = warehouseSeeds.find((item) => item.code === warehouseCode)
  if (!warehouse?.enabled) return []
  const enabledZoneIds = new Set(zoneSeeds
    .filter((zone) => zone.warehouseCode === warehouseCode && zone.enabled)
    .map((zone) => zone.id))
  return listAccessoryWarehouseLocations(warehouseCode)
    .filter((location) => location.enabled && enabledZoneIds.has(location.zoneId))
}

export function isEnabledAccessoryWarehouseLocation(warehouseCode: string, locationCode: string): boolean {
  if (!locationCode) return false
  return listEnabledAccessoryWarehouseLocations(warehouseCode)
    .some((location) => location.locationCode === locationCode)
}

export function resolveAccessoryWarehouseForCuttingFactoryName(name: string): AccessoryWarehouseMaster | null {
  const normalizedName = name.trim().replace(/\s+/g, ' ').toLowerCase()
  if (!normalizedName) return null
  const warehouse = warehouseSeeds.find((item) => item.boundFactoryName === normalizedName)
  return warehouse ? copyWarehouse(warehouse) : null
}

/** 后道接收沿用独立仓位；不作为新增三仓侧栏或基础三仓身份。 */
export function listAccessoryPostWarehouseLocations(): AccessoryWarehouseLocation[] {
  return [1, 2].map(index => ({ id: `DLN-MAT-A01-0${index}`, locationCode: `PF-MAT-A01-0${index}`, warehouseCode: 'DLN',
    warehouseName: 'DLN 后道工厂', zoneId: 'DLN-MAT-A01', zoneName: '后道辅料暂存区（演示）', enabled: true }))
}
