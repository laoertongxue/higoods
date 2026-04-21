import type {
  Factory,
  FactoryPostCapacityNodeCode,
  FactoryProcessAbility,
  FactoryTier,
  FactoryType,
} from './factory-types.ts'
import {
  generateFactoryCode as genCode,
  indonesiaFactories,
  isFactoryPoolOrganization,
} from './indonesia-factories.ts'
import { getProcessDefinitionByCode, listCraftsByProcessCode } from './process-craft-dict.ts'

const POST_CAPACITY_NODE_CODES = ['BUTTONHOLE', 'BUTTON_ATTACH', 'IRONING', 'PACKAGING'] as const satisfies FactoryPostCapacityNodeCode[]

const legacyTagProcessMap: Record<string, string[]> = {
  印花: ['PRINT'],
  绣花: ['EMBROIDERY'],
  水洗: ['SPECIAL_CRAFT'],
  染色: ['DYE'],
  车缝: ['SEW'],
  后整: ['POST_FINISHING'],
}

const factoryTypeProcessMap: Partial<Record<FactoryType, string[]>> = {
  CENTRAL_GARMENT: ['SEW'],
  CENTRAL_PRINT: ['PRINT'],
  CENTRAL_DYE: ['DYE'],
  CENTRAL_CUTTING: ['CUT_PANEL'],
  CENTRAL_SPECIAL: ['SPECIAL_CRAFT'],
  CENTRAL_AUX: ['POST_FINISHING', 'SPECIAL_CRAFT'],
  CENTRAL_LACE: ['POST_FINISHING'],
  CENTRAL_KNIT: ['SEW', 'PLEATING'],
  CENTRAL_DENIM_WASH: ['SPECIAL_CRAFT', 'SHRINKING'],
  SATELLITE_SEWING: ['SEW'],
  SATELLITE_FINISHING: ['POST_FINISHING', 'PLEATING', 'SPECIAL_CRAFT'],
  THIRD_SEWING: ['SEW'],
}

function isWashOnlyFactory(tags: string[], factoryType: FactoryType): boolean {
  return factoryType === 'CENTRAL_DENIM_WASH' || tags.includes('水洗')
}

function resolveWashCraftAbility(): FactoryProcessAbility | null {
  const process = getProcessDefinitionByCode('SPECIAL_CRAFT')
  const washCraft = listCraftsByProcessCode('SPECIAL_CRAFT').find((item) => item.craftName === '洗水')
  if (!process || !washCraft) return null
  return {
    processCode: 'SPECIAL_CRAFT',
    craftCodes: [washCraft.craftCode],
    abilityId: 'ABILITY_SPECIAL_CRAFT_WASH',
    processName: process.processName,
    craftNames: ['洗水'],
    abilityName: '特殊工艺 - 洗水',
    abilityScope: 'CRAFT',
    canReceiveTask: true,
    capacityManaged: true,
    status: 'ACTIVE',
  }
}

function createProcessAbility(
  processCode: string,
  options?: {
    tags?: string[]
    factoryType?: FactoryType
  },
): FactoryProcessAbility | null {
  const process = getProcessDefinitionByCode(processCode)
  if (!process || !process.isActive) return null

  if (processCode === 'SPECIAL_CRAFT' && options?.factoryType && options.tags && isWashOnlyFactory(options.tags, options.factoryType)) {
    return resolveWashCraftAbility()
  }

  if (processCode === 'POST_FINISHING') {
    return {
      processCode,
      craftCodes: [],
      capacityNodeCodes: [...POST_CAPACITY_NODE_CODES],
      abilityId: `ABILITY_${processCode}`,
      processName: process.processName,
      craftNames: POST_CAPACITY_NODE_CODES.map((nodeCode) => getProcessDefinitionByCode(nodeCode)?.processName ?? nodeCode),
      abilityName: process.processName,
      abilityScope: 'PROCESS',
      canReceiveTask: true,
      capacityManaged: true,
      status: 'ACTIVE',
    }
  }

  const crafts = listCraftsByProcessCode(processCode)
  const craftCodes = crafts.map((item) => item.craftCode)
  if (!craftCodes.length) return null

  return {
    processCode,
    craftCodes,
    abilityId: `ABILITY_${processCode}`,
    processName: process.processName,
    craftNames: crafts.map((item) => item.craftName),
    abilityName: process.processName,
    abilityScope: craftCodes.length === 1 ? 'CRAFT' : 'PROCESS',
    canReceiveTask: process.generatesExternalTask,
    capacityManaged: process.capacityEnabled,
    status: process.isActive ? 'ACTIVE' : 'DISABLED',
  }
}

function buildProcessAbilities(tags: string[], factoryType: FactoryType): FactoryProcessAbility[] {
  const processCodes = new Set<string>()

  tags.forEach((tag) => {
    ;(legacyTagProcessMap[tag] ?? []).forEach((processCode) => processCodes.add(processCode))
  })

  ;(factoryTypeProcessMap[factoryType] ?? []).forEach((processCode) => processCodes.add(processCode))

  return [...processCodes]
    .map((processCode) => createProcessAbility(processCode, { tags, factoryType }))
    .filter((item): item is FactoryProcessAbility => Boolean(item))
}

function adjustProcessAbilitiesForFactory(factoryId: string, abilities: FactoryProcessAbility[]): FactoryProcessAbility[] {
  if (factoryId !== 'ID-F024') return abilities

  return abilities.map((ability) => {
    if (ability.processCode !== 'POST_FINISHING') return ability
    const capacityNodeCodes: FactoryPostCapacityNodeCode[] = ['BUTTONHOLE', 'IRONING']
    return {
      ...ability,
      capacityNodeCodes,
      craftNames: capacityNodeCodes.map((code) => getProcessDefinitionByCode(code)?.processName ?? code),
    }
  })
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
  const processAbilities = adjustProcessAbilitiesForFactory(
    factory.id,
    buildProcessAbilities(factory.tags, factoryType),
  )

  return {
    id: factory.id,
    code: factory.code,
    name: factory.name,
    address: `${factory.address}, ${factory.city}, ${factory.province}`,
    contact: factory.contactName,
    phone: factory.contactPhone,
    status: mapStatus(factory.status),
    cooperationMode: index % 3 === 0 ? 'exclusive' : index % 3 === 1 ? 'preferred' : 'general',
    processAbilities,
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
