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

export const specialCraftDedicatedFactorySeeds: SpecialCraftDedicatedFactorySeed[] = [
  {
    operationId: 'AUX-OP-EMBROIDERY',
    craftCode: 'CRAFT_3000001',
    craftName: '绣花',
    factoryId: 'FAC-AUX-CRAFT',
    factoryCode: 'AUX-CRAFT',
    factoryName: '辅助工艺厂',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  },
  {
    operationId: 'AUX-OP-STRIP',
    craftCode: 'CRAFT_000032',
    craftName: '打条',
    factoryId: 'FAC-AUX-CRAFT',
    factoryCode: 'AUX-CRAFT',
    factoryName: '辅助工艺厂',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  },
  {
    operationId: 'AUX-OP-PLEATING',
    craftCode: 'CRAFT_3000002',
    craftName: '压褶',
    factoryId: 'FAC-AUX-CRAFT',
    factoryCode: 'AUX-CRAFT',
    factoryName: '辅助工艺厂',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  },
  {
    operationId: 'AUX-OP-DALAN',
    craftCode: 'CRAFT_000008',
    craftName: '打揽',
    factoryId: 'FAC-AUX-CRAFT',
    factoryCode: 'AUX-CRAFT',
    factoryName: '辅助工艺厂',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  },
  {
    operationId: 'AUX-OP-HEAT-TRANSFER',
    craftCode: 'CRAFT_008192',
    craftName: '烫画',
    factoryId: 'FAC-AUX-CRAFT',
    factoryCode: 'AUX-CRAFT',
    factoryName: '辅助工艺厂',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  },
  {
    operationId: 'AUX-OP-DIRECT-PRINT',
    craftCode: 'CRAFT_016384',
    craftName: '直喷',
    factoryId: 'FAC-AUX-CRAFT',
    factoryCode: 'AUX-CRAFT',
    factoryName: '辅助工艺厂',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  },
  {
    operationId: 'AUX-OP-SHELL-EMBROIDERY',
    craftCode: 'CRAFT_3000003',
    craftName: '贝壳绣',
    factoryId: 'FAC-AUX-CRAFT',
    factoryCode: 'AUX-CRAFT',
    factoryName: '辅助工艺厂',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  },
  {
    operationId: 'AUX-OP-CURVED-TEETH-EMBROIDERY',
    craftCode: 'CRAFT_3000004',
    craftName: '曲牙绣',
    factoryId: 'FAC-AUX-CRAFT',
    factoryCode: 'AUX-CRAFT',
    factoryName: '辅助工艺厂',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  },
  {
    operationId: 'AUX-OP-STRAIGHT-SHELL-EMBROIDERY',
    craftCode: 'CRAFT_3000005',
    craftName: '一字贝绣花',
    factoryId: 'FAC-AUX-CRAFT',
    factoryCode: 'AUX-CRAFT',
    factoryName: '辅助工艺厂',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  },
  {
    operationId: 'SPC-OP-TEMPLATE-PROCESS',
    craftCode: 'CRAFT_3000006',
    craftName: '模板工序',
    factoryId: 'FAC-SPC-CRAFT',
    factoryCode: 'SPC-CRAFT',
    factoryName: '特种工艺厂',
    managementDomain: 'SPECIAL_CRAFT_FACTORY',
    factoryType: 'CENTRAL_SPECIAL',
  },
  {
    operationId: 'SPC-OP-LASER-POCKET',
    craftCode: 'CRAFT_3000007',
    craftName: '激光开袋',
    factoryId: 'FAC-SPC-CRAFT',
    factoryCode: 'SPC-CRAFT',
    factoryName: '特种工艺厂',
    managementDomain: 'SPECIAL_CRAFT_FACTORY',
    factoryType: 'CENTRAL_SPECIAL',
  },
  {
    operationId: 'SPC-OP-PATTERN-MACHINE-SEWING',
    craftCode: 'CRAFT_3000008',
    craftName: '特种车缝（花样机）',
    factoryId: 'FAC-SPC-CRAFT',
    factoryCode: 'SPC-CRAFT',
    factoryName: '特种工艺厂',
    managementDomain: 'SPECIAL_CRAFT_FACTORY',
    factoryType: 'CENTRAL_SPECIAL',
  },
  {
    operationId: 'SPC-OP-ELASTIC-FIXED-LENGTH-CUTTING',
    craftCode: 'CRAFT_3000009',
    craftName: '橡筋定长切割',
    factoryId: 'FAC-SPC-CRAFT',
    factoryCode: 'SPC-CRAFT',
    factoryName: '特种工艺厂',
    managementDomain: 'SPECIAL_CRAFT_FACTORY',
    factoryType: 'CENTRAL_SPECIAL',
  },
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
