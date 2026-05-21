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
    factoryId: 'FAC-AUX-EMBROIDERY',
    factoryCode: 'AUX-EMB-001',
    factoryName: '绣花专属工厂',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  },
  {
    operationId: 'AUX-OP-STRIP',
    craftCode: 'CRAFT_000032',
    craftName: '打条',
    factoryId: 'FAC-AUX-STRIP',
    factoryCode: 'AUX-STRIP-001',
    factoryName: '打条专属工厂',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  },
  {
    operationId: 'AUX-OP-PLEATING',
    craftCode: 'CRAFT_3000002',
    craftName: '压褶',
    factoryId: 'FAC-AUX-PLEATING',
    factoryCode: 'AUX-PLEAT-001',
    factoryName: '压褶专属工厂',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  },
  {
    operationId: 'AUX-OP-DALAN',
    craftCode: 'CRAFT_000008',
    craftName: '打揽',
    factoryId: 'FAC-AUX-DALAN',
    factoryCode: 'AUX-DALAN-001',
    factoryName: '打揽专属工厂',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  },
  {
    operationId: 'AUX-OP-HEAT-TRANSFER',
    craftCode: 'CRAFT_008192',
    craftName: '烫画',
    factoryId: 'FAC-AUX-HEAT-TRANSFER',
    factoryCode: 'AUX-HEAT-001',
    factoryName: '烫画专属工厂',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  },
  {
    operationId: 'AUX-OP-DIRECT-PRINT',
    craftCode: 'CRAFT_016384',
    craftName: '直喷',
    factoryId: 'FAC-AUX-DIRECT-PRINT',
    factoryCode: 'AUX-DP-001',
    factoryName: '直喷专属工厂',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  },
  {
    operationId: 'AUX-OP-SHELL-EMBROIDERY',
    craftCode: 'CRAFT_3000003',
    craftName: '贝壳绣',
    factoryId: 'FAC-AUX-SHELL-EMBROIDERY',
    factoryCode: 'AUX-SHELL-001',
    factoryName: '贝壳绣专属工厂',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  },
  {
    operationId: 'AUX-OP-CURVED-TEETH-EMBROIDERY',
    craftCode: 'CRAFT_3000004',
    craftName: '曲牙绣',
    factoryId: 'FAC-AUX-CURVED-TEETH',
    factoryCode: 'AUX-CURVED-001',
    factoryName: '曲牙绣专属工厂',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  },
  {
    operationId: 'AUX-OP-STRAIGHT-SHELL-EMBROIDERY',
    craftCode: 'CRAFT_3000005',
    craftName: '一字贝绣花',
    factoryId: 'FAC-AUX-STRAIGHT-SHELL',
    factoryCode: 'AUX-STRAIGHT-001',
    factoryName: '一字贝绣花专属工厂',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    factoryType: 'CENTRAL_AUX',
  },
  {
    operationId: 'SPC-OP-TEMPLATE-PROCESS',
    craftCode: 'CRAFT_3000006',
    craftName: '模板工序',
    factoryId: 'FAC-SPC-TEMPLATE-PROCESS',
    factoryCode: 'SPC-TEMPLATE-001',
    factoryName: '模板工序专属工厂',
    managementDomain: 'SPECIAL_CRAFT_FACTORY',
    factoryType: 'CENTRAL_SPECIAL',
  },
  {
    operationId: 'SPC-OP-LASER-POCKET',
    craftCode: 'CRAFT_3000007',
    craftName: '激光开袋',
    factoryId: 'FAC-SPC-LASER-POCKET',
    factoryCode: 'SPC-LASER-001',
    factoryName: '激光开袋专属工厂',
    managementDomain: 'SPECIAL_CRAFT_FACTORY',
    factoryType: 'CENTRAL_SPECIAL',
  },
  {
    operationId: 'SPC-OP-PATTERN-MACHINE-SEWING',
    craftCode: 'CRAFT_3000008',
    craftName: '特种车缝（花样机）',
    factoryId: 'FAC-SPC-PATTERN-MACHINE',
    factoryCode: 'SPC-PATTERN-001',
    factoryName: '花样机特种车缝专属工厂',
    managementDomain: 'SPECIAL_CRAFT_FACTORY',
    factoryType: 'CENTRAL_SPECIAL',
  },
  {
    operationId: 'SPC-OP-ELASTIC-FIXED-LENGTH-CUTTING',
    craftCode: 'CRAFT_3000009',
    craftName: '橡筋定长切割',
    factoryId: 'FAC-SPC-ELASTIC-CUTTING',
    factoryCode: 'SPC-ELASTIC-001',
    factoryName: '橡筋定长切割专属工厂',
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
