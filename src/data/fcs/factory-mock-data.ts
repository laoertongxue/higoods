import type { Factory, FactoryProcessAbility, FactoryTier, FactoryType } from './factory-types.ts'
import {
  generateFactoryCode as genCode,
  indonesiaFactories,
  isFactoryPoolOrganization,
} from './indonesia-factories.ts'
import { listCraftsByProcessCode } from './process-craft-dict.ts'

const POST_PROCESS_CODES = [
  'BUTTONHOLE',
  'BUTTON_ATTACH',
  'HARDWARE',
  'FROG_BUTTON',
  'IRONING',
  'PACKAGING',
] as const

const legacyTagProcessMap: Record<string, string[]> = {
  印花: ['PRINT'],
  绣花: ['EMBROIDERY'],
  水洗: ['WASHING'],
  染色: ['DYE'],
  车缝: ['SEW'],
  后整: [...POST_PROCESS_CODES],
}

const factoryTypeProcessMap: Partial<Record<FactoryType, string[]>> = {
  CENTRAL_GARMENT: ['SEW'],
  CENTRAL_PRINT: ['PRINT'],
  CENTRAL_DYE: ['DYE'],
  CENTRAL_CUTTING: ['CUT_PANEL'],
  CENTRAL_SPECIAL: ['SPECIAL_CRAFT'],
  CENTRAL_AUX: [...POST_PROCESS_CODES, 'SPECIAL_CRAFT'],
  CENTRAL_LACE: [...POST_PROCESS_CODES],
  CENTRAL_KNIT: ['SEW', 'PLEATING'],
  CENTRAL_DENIM_WASH: ['WASHING', 'SHRINKING'],
  SATELLITE_SEWING: ['SEW'],
  SATELLITE_FINISHING: [...POST_PROCESS_CODES, 'PLEATING', 'SPECIAL_CRAFT'],
  THIRD_SEWING: ['SEW'],
}

function createProcessAbility(processCode: string): FactoryProcessAbility | null {
  const craftCodes = listCraftsByProcessCode(processCode).map((item) => item.craftCode)
  if (!craftCodes.length) return null
  return {
    processCode,
    craftCodes,
  }
}

function buildProcessAbilities(tags: string[], factoryType: FactoryType): FactoryProcessAbility[] {
  const processCodes = new Set<string>()

  tags.forEach((tag) => {
    ;(legacyTagProcessMap[tag] ?? []).forEach((processCode) => processCodes.add(processCode))
  })

  ;(factoryTypeProcessMap[factoryType] ?? []).forEach((processCode) => processCodes.add(processCode))

  return [...processCodes]
    .map((processCode) => createProcessAbility(processCode))
    .filter((item): item is FactoryProcessAbility => Boolean(item))
}

function mapStatus(status: string): Factory['status'] {
  const statusMap: Record<string, Factory['status']> = {
    ACTIVE: 'active',
    SUSPENDED: 'paused',
    BLACKLISTED: 'blacklist',
    INACTIVE: 'inactive',
  }
  return statusMap[status] || 'active'
}

function mapTier(tier: string): FactoryTier {
  if (tier === 'SATELLITE') return 'SATELLITE'
  if (tier === 'THIRD_PARTY') return 'THIRD_PARTY'
  return 'CENTRAL'
}

function mapType(tier: string, type: string, index: number): FactoryType {
  const typeMap: Record<string, FactoryType> = {
    CENTRAL_FACTORY: 'CENTRAL_GARMENT',
    PRINTING: 'CENTRAL_PRINT',
    DYEING: 'CENTRAL_DYE',
    CUTTING: 'CENTRAL_CUTTING',
    AUX_PROCESS: 'CENTRAL_AUX',
    SPECIAL_PROCESS: 'CENTRAL_SPECIAL',
    TRIM_SUPPLIER: 'CENTRAL_LACE',
    KNIT: 'CENTRAL_KNIT',
    DENIM_WASH: 'CENTRAL_DENIM_WASH',
    POD: 'CENTRAL_POD',
    SATELLITE_CLUSTER: 'SATELLITE_SEWING',
    MICRO_SEWING: 'THIRD_SEWING',
  }
  if (tier === 'SATELLITE') return index % 2 === 0 ? 'SATELLITE_SEWING' : 'SATELLITE_FINISHING'
  if (tier === 'THIRD_PARTY') return 'THIRD_SEWING'
  return typeMap[type] || 'CENTRAL_GARMENT'
}

function getDefaultParentId(tier: string): string | undefined {
  if (tier === 'SATELLITE' || tier === 'THIRD_PARTY') return 'ID-F001'
  return undefined
}

const factoryPoolSourceRecords = indonesiaFactories.filter(isFactoryPoolOrganization)

export const mockFactories: Factory[] = factoryPoolSourceRecords.map((factory, index) => {
  const factoryTier = mapTier(factory.tier)
  const factoryType = mapType(factory.tier, factory.type, index)

  return {
    id: factory.id,
    code: factory.code,
    name: factory.name,
    address: `${factory.address}, ${factory.city}, ${factory.province}`,
    contact: factory.contactName,
    phone: factory.contactPhone,
    status: mapStatus(factory.status),
    cooperationMode: index % 3 === 0 ? 'exclusive' : index % 3 === 1 ? 'preferred' : 'general',
    processAbilities: buildProcessAbilities(factory.tags, factoryType),
    qualityScore: factory.qualityScore,
    deliveryScore: factory.deliveryScore,
    createdAt: factory.createdAt,
    updatedAt: factory.updatedAt,
    factoryTier,
    factoryType,
    parentFactoryId: getDefaultParentId(factory.tier),
    pdaEnabled: true,
    pdaTenantId: factory.id,
    eligibility: {
      allowDispatch: factory.status === 'ACTIVE',
      allowBid: factory.status === 'ACTIVE',
      allowExecute: factory.status === 'ACTIVE',
      allowSettle: factory.status === 'ACTIVE' && (factory.hasSettlement ?? false),
    },
  }
})

export { genCode as generateFactoryCode }
