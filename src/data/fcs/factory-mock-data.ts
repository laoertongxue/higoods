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
import {
  getProcessDefinitionByCode,
  listCraftsByProcessCode,
  listProcessDefinitions,
} from './process-craft-dict.ts'
import { specialCraftDedicatedFactorySeeds } from './special-craft-dedicated-factories.ts'

const POST_CAPACITY_NODE_CODES = ['BUTTONHOLE', 'BUTTON_ATTACH', 'IRONING', 'PACKAGING'] as const satisfies FactoryPostCapacityNodeCode[]
const DEDICATED_POST_ACTION_NAMES = ['质检', '后道', '复检'] as const
const BASIC_POST_ACTION_NAMES = ['后道'] as const
export const TEST_FACTORY_ID = 'F090'
export const TEST_FACTORY_CODE = 'F090'
export const TEST_FACTORY_NAME = '全能力测试工厂'
export const TEST_FACTORY_DISPLAY_NAME = `${TEST_FACTORY_NAME}（${TEST_FACTORY_CODE}）`
export const TEST_FACTORY_SCOPE = 'ALL_PROCESS_CRAFT' as const
export const OWN_WOOL_FACTORY_ID = 'OWN_WOOL_FACTORY'
export const OWN_WOOL_FACTORY_CODE = 'WOOL-OWN-001'
export const OWN_WOOL_FACTORY_NAME = '周哥毛织厂'
export const DEDICATED_POST_FACTORY_ID = 'PF-DEDICATED-001'
export const DEDICATED_POST_FACTORY_CODE = 'POST-FIN-001'
export const DEDICATED_POST_FACTORY_NAME = 'HiGood 后道工厂'
export const KOL_GOTO_FACTORY_ID = 'KOL-GOTO-001'
export const KOL_GOTO_FACTORY_CODE = 'KOL-GOTO'
export const KOL_GOTO_FACTORY_NAME = 'kol goto'

const thirdPartySewingSeatCountByFactoryId: Record<string, number> = {
  'ID-F021': 48,
  'ID-F022': 36,
  'ID-F023': 18,
  'ID-F024': 28,
  'ID-F025': 16,
  'ID-F026': 14,
  'ID-F027': 22,
  'ID-F028': 26,
  'ID-F029': 34,
  'ID-F030': 20,
  [KOL_GOTO_FACTORY_ID]: 12,
}

export function formatFactoryDisplayName(factoryName?: string | null, factoryCodeOrId?: string | null): string {
  const normalizedName = factoryName?.trim() || ''
  const normalizedCode = factoryCodeOrId?.trim() || ''
  if (!normalizedName && !normalizedCode) return ''
  if (normalizedName.includes(`（${TEST_FACTORY_CODE}）`)) return normalizedName
  if (
    normalizedName === TEST_FACTORY_NAME
    || normalizedCode === TEST_FACTORY_ID
    || normalizedCode === TEST_FACTORY_CODE
    || normalizedCode === 'ID-F090'
  ) {
    return TEST_FACTORY_DISPLAY_NAME
  }
  return normalizedCode ? `${normalizedName || normalizedCode}（${normalizedCode}）` : normalizedName
}

const legacyTagProcessMap: Record<string, string[]> = {
  印花: ['PRINT'],
  绣花: ['EMBROIDERY'],
  水洗: ['WASHING'],
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
  CENTRAL_WOOL: ['SEW', 'PLEATING'],
  CENTRAL_DENIM_WASH: ['WASHING', 'SHRINKING'],
  SATELLITE_SEWING: ['SEW'],
  SATELLITE_FINISHING: ['POST_FINISHING', 'PLEATING', 'SPECIAL_CRAFT'],
  THIRD_SEWING: ['SEW'],
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

  if (processCode === 'POST_FINISHING') {
    const isDedicatedPostFactory = options?.factoryType === 'SATELLITE_FINISHING'
    return {
      processCode,
      craftCodes: [],
      capacityNodeCodes: [...POST_CAPACITY_NODE_CODES],
      abilityId: `ABILITY_${processCode}`,
      processName: process.processName,
      craftNames: [...(isDedicatedPostFactory ? DEDICATED_POST_ACTION_NAMES : BASIC_POST_ACTION_NAMES)],
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

function buildAllProcessAbilitiesForTestFactory(): FactoryProcessAbility[] {
  const processCodes = listProcessDefinitions()
    .filter((process) => process.isActive && (process.generatesExternalTask || process.processCode === 'POST_FINISHING'))
    .map((process) => process.processCode)

  return processCodes
    .map((processCode) => createProcessAbility(processCode, { tags: [], factoryType: 'CENTRAL_AUX' }))
    .filter((item): item is FactoryProcessAbility => Boolean(item))
    .map((item) => ({
      ...item,
      craftCodes: [...item.craftCodes],
      capacityNodeCodes: item.capacityNodeCodes ? [...item.capacityNodeCodes] : undefined,
      craftNames: item.craftNames ? [...item.craftNames] : undefined,
      canReceiveTask: true,
      status: 'ACTIVE',
    }))
}

function adjustProcessAbilitiesForFactory(factoryId: string, abilities: FactoryProcessAbility[]): FactoryProcessAbility[] {
  if (factoryId !== 'ID-F024') return abilities

  return abilities.map((ability) => {
    if (ability.processCode !== 'POST_FINISHING') return ability
    const capacityNodeCodes: FactoryPostCapacityNodeCode[] = ['BUTTONHOLE', 'IRONING']
    return {
      ...ability,
      capacityNodeCodes,
      craftNames: [...BASIC_POST_ACTION_NAMES],
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
    WOOL: 'CENTRAL_WOOL',
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

const generatedFactories: Factory[] = factoryPoolSourceRecords.map((factory, index) => {
  const factoryTier = mapTier(factory.tier)
  const factoryType = mapType(factory.tier, factory.type, index)
  const sewingSeatCount = factoryType === 'THIRD_SEWING' ? thirdPartySewingSeatCountByFactoryId[factory.id] : undefined
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
    sewingSeatCount,
    machineTotalCount: sewingSeatCount,
    effectiveWorkerCount: sewingSeatCount,
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

const allProcessCraftTestFactory: Factory = {
  id: TEST_FACTORY_ID,
  code: TEST_FACTORY_CODE,
  name: TEST_FACTORY_NAME,
  address: 'Jakarta Test Lane 90, Jakarta, DKI Jakarta',
  contact: '联调负责人',
  phone: '+62 21 9000 0090',
  status: 'active',
  cooperationMode: 'general',
  processAbilities: buildAllProcessAbilitiesForTestFactory(),
  qualityScore: 100,
  deliveryScore: 100,
  createdAt: '2026-04-24 09:00:00',
  updatedAt: '2026-04-24 09:00:00',
  factoryTier: 'CENTRAL',
  factoryType: 'CENTRAL_AUX',
  pdaEnabled: true,
  pdaTenantId: TEST_FACTORY_ID,
  isTestFactory: true,
  testFactoryScope: TEST_FACTORY_SCOPE,
  eligibility: {
    allowDispatch: true,
    allowBid: true,
    allowExecute: true,
    allowSettle: true,
  },
}

const ownWoolFactory: Factory = {
  id: OWN_WOOL_FACTORY_ID,
  code: OWN_WOOL_FACTORY_CODE,
  name: OWN_WOOL_FACTORY_NAME,
  address: '浙江绍兴毛织园区 9 号楼',
  contact: '周哥',
  phone: '+86 138 0000 2605',
  status: 'active',
  cooperationMode: 'exclusive',
  processAbilities: [
    {
      processCode: 'PROC_WOOL',
      craftCodes: ['WHOLE_GARMENT_WOOL', 'PART_PANEL_WOOL'],
      abilityId: 'ABILITY_PROC_WOOL_OWN',
      processName: '毛织',
      craftNames: ['整件毛织', '部位毛织'],
      abilityName: '毛织 / 整件与部位',
      abilityScope: 'PROCESS',
      canReceiveTask: true,
      capacityManaged: true,
      status: 'ACTIVE',
    },
  ],
  qualityScore: 92,
  deliveryScore: 90,
  createdAt: '2026-05-09 09:00:00',
  updatedAt: '2026-05-09 09:00:00',
  factoryTier: 'CENTRAL',
  factoryType: 'CENTRAL_WOOL',
  pdaEnabled: true,
  pdaTenantId: OWN_WOOL_FACTORY_ID,
  eligibility: {
    allowDispatch: true,
    allowBid: false,
    allowExecute: true,
    allowSettle: true,
  },
}

const dedicatedPostFactory: Factory = {
  id: DEDICATED_POST_FACTORY_ID,
  code: DEDICATED_POST_FACTORY_CODE,
  name: DEDICATED_POST_FACTORY_NAME,
  factoryShortName: 'higood_post',
  address: '印尼雅加达后道加工园区 1 号楼',
  contact: '后道工厂负责人',
  mobilePhone: '+62 21 8800 2605',
  phone: '+62 21 8800 2605',
  status: 'active',
  cooperationMode: 'exclusive',
  processAbilities: [
    {
      processCode: 'POST_FINISHING',
      craftCodes: [],
      capacityNodeCodes: [...POST_CAPACITY_NODE_CODES],
      abilityId: 'ABILITY_POST_FINISHING_DEDICATED',
      processName: '后道',
      craftNames: [...DEDICATED_POST_ACTION_NAMES],
      abilityName: '后道',
      abilityScope: 'PROCESS',
      canReceiveTask: true,
      capacityManaged: true,
      status: 'ACTIVE',
    },
  ],
  qualityScore: 93,
  deliveryScore: 91,
  createdAt: '2026-05-22 09:00:00',
  updatedAt: '2026-05-22 09:00:00',
  factoryTier: 'SATELLITE',
  factoryType: 'SATELLITE_FINISHING',
  pdaEnabled: true,
  pdaTenantId: DEDICATED_POST_FACTORY_ID,
  eligibility: {
    allowDispatch: true,
    allowBid: false,
    allowExecute: true,
    allowSettle: true,
  },
}

const kolGotoProcessCodes = ['CUT_PANEL', 'SEW', 'SPECIAL_CRAFT', 'POST_FINISHING'] as const

function normalizeKolGotoProcessAbility(ability: FactoryProcessAbility): FactoryProcessAbility {
  if (ability.processCode === 'SPECIAL_CRAFT') {
    return {
      ...ability,
      processName: '辅助工艺 / 特殊工艺',
      abilityName: '辅助工艺 / 特殊工艺',
      craftNames: Array.from(new Set(['辅助工艺', ...(ability.craftNames ?? []), '特殊工艺'])),
    }
  }

  if (ability.processCode === 'POST_FINISHING') {
    return {
      ...ability,
      processName: '后道 / 质检 / 复检 / 包装',
      abilityName: '后道 / 质检 / 复检 / 包装',
      craftNames: Array.from(new Set(['质检', '后道', '复检', ...(ability.craftNames ?? []), '包装'])),
      capacityNodeCodes: [...POST_CAPACITY_NODE_CODES],
      capacityManaged: true,
    }
  }

  return ability
}

const kolGotoFactory: Factory = {
  id: KOL_GOTO_FACTORY_ID,
  code: KOL_GOTO_FACTORY_CODE,
  name: KOL_GOTO_FACTORY_NAME,
  factoryShortName: KOL_GOTO_FACTORY_NAME,
  address: '印尼雅加达 KOL 小单整单承接中心',
  contact: 'KOL 整单负责人',
  mobilePhone: '+62 21 8800 0810',
  phone: '+62 21 8800 0810',
  status: 'active',
  cooperationMode: 'general',
  processAbilities: kolGotoProcessCodes
    .map((processCode) => createProcessAbility(processCode, { tags: [], factoryType: 'THIRD_SEWING' }))
    .filter((item): item is FactoryProcessAbility => Boolean(item))
    .map(normalizeKolGotoProcessAbility)
    .map((item) => ({
      ...item,
      canReceiveTask: true,
      status: 'ACTIVE',
    })),
  qualityScore: 96,
  deliveryScore: 95,
  createdAt: '2026-06-30 09:00:00',
  updatedAt: '2026-06-30 09:00:00',
  factoryTier: 'THIRD_PARTY',
  factoryType: 'THIRD_SEWING',
  pdaEnabled: true,
  pdaTenantId: KOL_GOTO_FACTORY_ID,
  sewingSeatCount: thirdPartySewingSeatCountByFactoryId[KOL_GOTO_FACTORY_ID],
  machineTotalCount: thirdPartySewingSeatCountByFactoryId[KOL_GOTO_FACTORY_ID],
  effectiveWorkerCount: thirdPartySewingSeatCountByFactoryId[KOL_GOTO_FACTORY_ID],
  eligibility: {
    allowDispatch: true,
    allowBid: false,
    allowExecute: true,
    allowSettle: true,
  },
  taskAcceptanceConfig: {
    singleProcessEnabled: true,
    continuousProcessEnabled: false,
    wholeOrderEnabled: true,
    continuousRules: [],
    wholeOrderRule: {
      enabled: true,
      applicableSaleTypes: ['KOL样衣', 'KOL样品小单'],
      excludedProcessCodes: ['PRINT', 'DYE'],
      defaultTaskName: 'KOL整单任务',
      allowRuleRecommendation: true,
      handoverReceiverKind: 'WAREHOUSE',
      handoverReceiverName: '仓库',
      pdaStepTemplateCode: 'SIMPLE_FIVE_STEP',
      remark: 'KOL 样衣和样品小单整单承接；印花、染色保持独立加工单链路。',
    },
  },
}

export const specialCraftDedicatedFactories: Factory[] = specialCraftDedicatedFactorySeeds.map((seed) => {
  const processName = seed.managementDomain === 'AUXILIARY_CRAFT_FACTORY' ? '辅助工艺' : '特种工艺'
  return {
    id: seed.factoryId,
    code: seed.factoryCode,
    name: seed.factoryName,
    factoryShortName: seed.craftName,
    address: `印尼雅加达 ${seed.craftName}工艺园区`,
    contact: `${seed.craftName}负责人`,
    phone: '+62 21 8800 0001',
    status: 'active',
    cooperationMode: 'exclusive',
    processAbilities: [
      {
        processCode: 'SPECIAL_CRAFT',
        craftCodes: [seed.craftCode],
        abilityId: `ABILITY_${seed.factoryId}`,
        processName,
        craftNames: [seed.craftName],
        abilityName: `${seed.craftName}专属加工`,
        abilityScope: 'CRAFT',
        canReceiveTask: true,
        capacityManaged: true,
        status: 'ACTIVE',
      },
    ],
    qualityScore: 90,
    deliveryScore: 90,
    createdAt: '2026-05-21 09:00:00',
    updatedAt: '2026-05-21 09:00:00',
    factoryTier: 'CENTRAL',
    factoryType: seed.factoryType,
    pdaEnabled: true,
    pdaTenantId: seed.factoryId,
    eligibility: {
      allowDispatch: true,
      allowBid: false,
      allowExecute: true,
      allowSettle: true,
    },
  }
})

export const mockFactories: Factory[] = [
  kolGotoFactory,
  dedicatedPostFactory,
  ...generatedFactories,
  allProcessCraftTestFactory,
  ownWoolFactory,
  ...specialCraftDedicatedFactories,
]

export { genCode as generateFactoryCode }
