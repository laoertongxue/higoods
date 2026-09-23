export type PcsSampleType = 'marketing' | 'production'

export type PcsSampleLocationType = 'live-room' | 'home-studio' | 'factory' | 'department' | 'warehouse'

export type PcsSampleLocationId = string

export interface PcsSampleLocationRecord {
  locationId: PcsSampleLocationId
  locationType: PcsSampleLocationType
  locationName: string
  ownerName?: string
  remark?: string
}

export interface PcsSampleTypeConversionLog {
  conversionId: string
  sampleId: string
  fromType: PcsSampleType
  toType: PcsSampleType
  actor: string
  reason: string
  convertedAt: string
}

export const PCS_SAMPLE_TYPES: readonly PcsSampleType[] = ['marketing', 'production'] as const

export const PCS_SAMPLE_TYPE_LABELS: Record<PcsSampleType, string> = {
  marketing: '营销样品',
  production: '生产样品',
}

export const PCS_SAMPLE_LOCATION_TYPES: readonly PcsSampleLocationType[] = [
  'live-room',
  'home-studio',
  'factory',
  'department',
  'warehouse',
] as const

export const PCS_SAMPLE_LOCATION_TYPE_LABELS: Record<PcsSampleLocationType, string> = {
  'live-room': '直播间',
  'home-studio': '家播',
  factory: '工厂',
  department: '部门',
  warehouse: '仓库',
}

export const PCS_SAMPLE_LOCATIONS: readonly PcsSampleLocationRecord[] = [
  { locationId: 'loc-live-01', locationType: 'live-room', locationName: '深圳直播间 A', ownerName: '运营一组' },
  { locationId: 'loc-live-02', locationType: 'live-room', locationName: '雅加达直播间 B', ownerName: '印尼直播组' },
  { locationId: 'loc-home-01', locationType: 'home-studio', locationName: '达人小美家播间', ownerName: '小美' },
  { locationId: 'loc-home-02', locationType: 'home-studio', locationName: '达人阿杰家播间', ownerName: '阿杰' },
  { locationId: 'loc-factory-01', locationType: 'factory', locationName: '雅加达一号厂', ownerName: '生产部' },
  { locationId: 'loc-dept-01', locationType: 'department', locationName: '商品部样衣组', ownerName: '商品部' },
  { locationId: 'loc-wh-01', locationType: 'warehouse', locationName: '深圳样衣仓', ownerName: '仓管' },
] as const

export function getPcsSampleLocationById(locationId: PcsSampleLocationId): PcsSampleLocationRecord | null {
  return PCS_SAMPLE_LOCATIONS.find((item) => item.locationId === locationId) || null
}

export function listPcsSampleLocationsByType(locationType: PcsSampleLocationType): PcsSampleLocationRecord[] {
  return PCS_SAMPLE_LOCATIONS.filter((item) => item.locationType === locationType)
}
