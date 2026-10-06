import { listLiveRooms, liveRoomAvailable, liveRoomLocationName } from './los-live-room-master.ts'
export type PcsSampleType = 'marketing' | 'production'

export type PcsSampleLocationType = 'live-room' | 'home-studio' | 'factory' | 'department' | 'warehouse'

export type PcsSampleLocationId = string

export interface PcsSampleLocationRecord {
  locationId: PcsSampleLocationId
  locationType: PcsSampleLocationType
  locationName: string
  ownerName?: string
  remark?: string
  enabled?: boolean
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

const PCS_OTHER_SAMPLE_LOCATIONS: readonly PcsSampleLocationRecord[] = [
  { locationId: 'loc-home-01', locationType: 'home-studio', locationName: '达人小美家播间', ownerName: '小美' },
  { locationId: 'loc-home-02', locationType: 'home-studio', locationName: '达人阿杰家播间', ownerName: '阿杰' },
  { locationId: 'loc-factory-01', locationType: 'factory', locationName: '雅加达一号厂', ownerName: '生产部' },
  { locationId: 'loc-dept-01', locationType: 'department', locationName: '商品部样衣组', ownerName: '商品部' },
  { locationId: 'loc-wh-02', locationType: 'warehouse', locationName: '雅加达样衣仓', ownerName: 'Budi' },
  { locationId: 'loc-wh-01', locationType: 'warehouse', locationName: '深圳样衣仓', ownerName: '仓管' },
] as const

export function getPcsSampleLocationById(locationId: PcsSampleLocationId): PcsSampleLocationRecord | null {
  return listPcsSampleLocations().find((item) => item.locationId === locationId) || null
}

export function listPcsSampleLocationsByType(locationType: PcsSampleLocationType): PcsSampleLocationRecord[] {
  return listPcsSampleLocations().filter((item) => item.locationType === locationType)
}

/** PCS read model. Live rooms have one LOS source; historical disabled IDs remain resolvable. */
export function listPcsSampleLocations(): PcsSampleLocationRecord[] {
  return [...PCS_OTHER_SAMPLE_LOCATIONS.map(loc => ({ ...loc })), ...listLiveRooms().map(room => ({
    locationId: room.roomId, locationType: 'live-room' as const, locationName: liveRoomLocationName(room),
    ownerName: room.opm, enabled: liveRoomAvailable(room),
  }))]
}
