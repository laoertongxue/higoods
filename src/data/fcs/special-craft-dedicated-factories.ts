import type { FactoryType } from './factory-types.ts'
import type { ProcessCraftManagementDomain } from './process-craft-dict.ts'

export interface SpecialCraftDedicatedFactorySeed {
  operationId: string
  craftCode: string
  craftName: string
  factoryId: string
  factoryCode: string
  factoryName: string
  managementDomain: ProcessCraftManagementDomain
  factoryType: FactoryType
}

export const FLOWER_FACTORY_ID = 'FAC-FLOWER'
export const FLOWER_FACTORY_CODE = 'FLOWER'
export const FLOWER_FACTORY_NAME = 'FLOWER'
export const APF_FACTORY_ID = 'FAC-APF'
export const APF_FACTORY_CODE = 'APF'
export const APF_FACTORY_NAME = 'APF - 辅助工艺'
export const SPF_FACTORY_ID = 'FAC-SPF'
export const SPF_FACTORY_CODE = 'SPF'
export const SPF_FACTORY_NAME = 'SPF - 特种工艺'
export const LEGACY_SPECIAL_CRAFT_FACTORY_IDS = ['FAC-AUX-CRAFT', 'FAC-SPC-CRAFT'] as const

export function isLegacySpecialCraftFactoryId(factoryId: string | null | undefined): boolean {
  return LEGACY_SPECIAL_CRAFT_FACTORY_IDS.includes(String(factoryId || '') as typeof LEGACY_SPECIAL_CRAFT_FACTORY_IDS[number])
}

const apfCrafts = [
  ['AUX-OP-EMBROIDERY', 'CRAFT_3000001', '绣花'],
  ['AUX-OP-STRIP', 'CRAFT_000032', '打条'],
  ['AUX-OP-PLEATING', 'CRAFT_3000002', '压褶'],
  ['AUX-OP-DALAN', 'CRAFT_000008', '打揽'],
  ['AUX-OP-SHELL-EMBROIDERY', 'CRAFT_3000003', '贝壳绣'],
  ['AUX-OP-CURVED-TEETH-EMBROIDERY', 'CRAFT_3000004', '曲牙绣'],
  ['AUX-OP-STRAIGHT-SHELL-EMBROIDERY', 'CRAFT_3000005', '一字贝绣花'],
  ['AUX-OP-BUTTON-LOOP', 'CRAFT_3100001', '盘扣'],
  ['AUX-OP-FLOWER-MAKING', 'CRAFT_3100002', '花朵'],
  ['AUX-OP-GATHERING', 'CRAFT_3100003', '打褶'],
  ['AUX-OP-HOTFIX-RHINESTONE', 'CRAFT_3100004', '烫钻'],
] as const

const flowerCrafts = [
  ['AUX-OP-HEAT-TRANSFER', 'CRAFT_008192', '烫画'],
  ['AUX-OP-DIRECT-PRINT', 'CRAFT_016384', '直喷'],
] as const

const spfCrafts = [
  ['SPC-OP-TEMPLATE-PROCESS', 'CRAFT_3000006', '模板工序'],
  ['SPC-OP-LASER-POCKET', 'CRAFT_3000007', '激光开袋'],
  ['SPC-OP-PATTERN-MACHINE-SEWING', 'CRAFT_3000008', '特种车缝（花样机）'],
  ['SPC-OP-ELASTIC-FIXED-LENGTH-CUTTING', 'CRAFT_3000009', '橡筋定长切割'],
] as const

function buildFactorySeeds(
  rows: ReadonlyArray<readonly [string, string, string]>,
  factory: Pick<SpecialCraftDedicatedFactorySeed, 'factoryId' | 'factoryCode' | 'factoryName' | 'managementDomain' | 'factoryType'>,
): SpecialCraftDedicatedFactorySeed[] {
  return rows.map(([operationId, craftCode, craftName]) => ({
    operationId,
    craftCode,
    craftName,
    ...factory,
  }))
}

export const specialCraftDedicatedFactorySeeds: SpecialCraftDedicatedFactorySeed[] = [
  ...buildFactorySeeds(flowerCrafts, {
    factoryId: FLOWER_FACTORY_ID,
    factoryCode: FLOWER_FACTORY_CODE,
    factoryName: FLOWER_FACTORY_NAME,
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  }),
  ...buildFactorySeeds(apfCrafts, {
    factoryId: APF_FACTORY_ID,
    factoryCode: APF_FACTORY_CODE,
    factoryName: APF_FACTORY_NAME,
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  }),
  ...buildFactorySeeds(spfCrafts, {
    factoryId: SPF_FACTORY_ID,
    factoryCode: SPF_FACTORY_CODE,
    factoryName: SPF_FACTORY_NAME,
    managementDomain: 'SPECIAL_CRAFT_FACTORY',
    factoryType: 'CENTRAL_SPECIAL',
  }),
]

const dedicatedFactorySeedByOperationId = new Map(
  specialCraftDedicatedFactorySeeds.map((item) => [item.operationId, item] as const),
)

export function getDedicatedSpecialCraftFactorySeed(operationId: string): SpecialCraftDedicatedFactorySeed | undefined {
  return dedicatedFactorySeedByOperationId.get(operationId)
}

export function getDedicatedSpecialCraftFactoryId(operationId: string): string | undefined {
  return getDedicatedSpecialCraftFactorySeed(operationId)?.factoryId
}
