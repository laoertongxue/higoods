import {
  getSpecialCraftSupportedTargetObjectLabels,
  getSpecialCraftTargetObjectLabel,
  listSelectableSpecialCraftDefinitions,
  PROCESS_CRAFT_MANAGEMENT_DOMAIN_NAME,
  type ProcessCraftDefinition,
  type ProcessCraftManagementDomain,
  type ProcessCraftManagementDomainName,
  type SpecialCraftSupportedTargetObject,
  type SpecialCraftTargetObjectLabel,
  type SpecialCraftVisibleFactoryType,
} from './process-craft-dict.ts'
import { getFactoryMasterRecordById, listFactoryMasterRecords } from './factory-master-store.ts'
import type { FactoryType } from './factory-types.ts'
import { getDedicatedSpecialCraftFactoryId } from './special-craft-dedicated-factories.ts'

export type SpecialCraftTargetObject =
  | SpecialCraftTargetObjectLabel
  | '裁片'
  | '面料'
  | '成衣半成品'

export interface SpecialCraftOperationDefinition {
  operationId: string
  craftCode: string
  craftName: string
  processCode: string
  processName: string
  managementDomain: ProcessCraftManagementDomain
  managementDomainName: ProcessCraftManagementDomainName
  operationName: string
  supportedTargetObjects: SpecialCraftSupportedTargetObject[]
  supportedTargetObjectLabels: SpecialCraftTargetObjectLabel[]
  defaultTargetObject: SpecialCraftTargetObjectLabel
  targetObject: SpecialCraftTargetObject
  visibleFactoryTypes: SpecialCraftVisibleFactoryType[]
  visibleFactoryIds?: string[]
  requiresTaskOrder: boolean
  requiresFactoryWarehouse: boolean
  requiresFeiTicketScan: boolean
  mustReturnToCuttingFactory: boolean
  isEnabled: boolean
  remark: string
}

interface SpecialCraftOperationSeed {
  operationId: string
  defaultTargetObject: SpecialCraftSupportedTargetObject
  requiresFeiTicketScan: boolean
  mustReturnToCuttingFactory: boolean
  remark: string
}

type OperationCraftDefinition = ProcessCraftDefinition & {
  managementDomain?: ProcessCraftManagementDomain
  managementDomainName?: ProcessCraftManagementDomainName
}

const auxiliaryCraftOperationSeedByName: Record<string, SpecialCraftOperationSeed> = {
  绣花: {
    operationId: 'AUX-OP-EMBROIDERY',
    defaultTargetObject: 'CUT_PIECE',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按绣花类辅助工艺加工单管理，完成后进入辅助工艺待交出仓。',
  },
  打条: {
    operationId: 'AUX-OP-STRIP',
    defaultTargetObject: 'CUT_PIECE',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按裁片打条辅助工艺加工单管理，完成后进入辅助工艺待交出仓。',
  },
  压褶: {
    operationId: 'AUX-OP-PLEATING',
    defaultTargetObject: 'CUT_PIECE',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按裁片压褶辅助工艺加工单管理，完成后进入辅助工艺待交出仓。',
  },
  打揽: {
    operationId: 'AUX-OP-DALAN',
    defaultTargetObject: 'CUT_PIECE',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按裁片打揽辅助工艺加工单管理，完成后进入辅助工艺待交出仓。',
  },
  烫画: {
    operationId: 'AUX-OP-HEAT-TRANSFER',
    defaultTargetObject: 'SEMI_FINISHED_GARMENT',
    requiresFeiTicketScan: false,
    mustReturnToCuttingFactory: false,
    remark: '按成衣半成品烫画辅助工艺加工单管理，完成后进入辅助工艺待交出仓。',
  },
  直喷: {
    operationId: 'AUX-OP-DIRECT-PRINT',
    defaultTargetObject: 'CUT_PIECE',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按裁片直喷辅助工艺加工单管理，完成后进入辅助工艺待交出仓。',
  },
  贝壳绣: {
    operationId: 'AUX-OP-SHELL-EMBROIDERY',
    defaultTargetObject: 'CUT_PIECE',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按贝壳绣辅助工艺加工单管理，完成后进入辅助工艺待交出仓。',
  },
  曲牙绣: {
    operationId: 'AUX-OP-CURVED-TEETH-EMBROIDERY',
    defaultTargetObject: 'CUT_PIECE',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按曲牙绣辅助工艺加工单管理，完成后进入辅助工艺待交出仓。',
  },
  一字贝绣花: {
    operationId: 'AUX-OP-STRAIGHT-SHELL-EMBROIDERY',
    defaultTargetObject: 'CUT_PIECE',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按一字贝绣花辅助工艺加工单管理，完成后进入辅助工艺待交出仓。',
  },
}

const specialTypeCraftOperationSeedByName: Record<string, SpecialCraftOperationSeed> = {
  模板工序: {
    operationId: 'SPC-OP-TEMPLATE-PROCESS',
    defaultTargetObject: 'CUT_PIECE',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按模板机特种工艺加工单管理，完成后进入特种工艺待交出仓。',
  },
  激光开袋: {
    operationId: 'SPC-OP-LASER-POCKET',
    defaultTargetObject: 'CUT_PIECE',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按激光开袋特种工艺加工单管理，完成后进入特种工艺待交出仓。',
  },
  '特种车缝（花样机）': {
    operationId: 'SPC-OP-PATTERN-MACHINE-SEWING',
    defaultTargetObject: 'CUT_PIECE',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按花样机特种车缝加工单管理，完成后进入特种工艺待交出仓。',
  },
  橡筋定长切割: {
    operationId: 'SPC-OP-ELASTIC-FIXED-LENGTH-CUTTING',
    defaultTargetObject: 'ACCESSORY',
    requiresFeiTicketScan: false,
    mustReturnToCuttingFactory: false,
    remark: '按橡筋定长切割特种工艺加工单管理，完成后进入特种工艺待交出仓。',
  },
}

function buildOperationDefinition(
  craftDefinition: OperationCraftDefinition,
  seed: SpecialCraftOperationSeed,
  managementDomain: ProcessCraftManagementDomain,
): SpecialCraftOperationDefinition {
  const managementDomainName = PROCESS_CRAFT_MANAGEMENT_DOMAIN_NAME[managementDomain]
  const supportedTargetObjects = craftDefinition.supportedTargetObjects.length > 0
    ? [...craftDefinition.supportedTargetObjects]
    : [seed.defaultTargetObject]
  const defaultTargetObject = supportedTargetObjects.includes(seed.defaultTargetObject)
    ? getSpecialCraftTargetObjectLabel(seed.defaultTargetObject)
    : getSpecialCraftTargetObjectLabel(supportedTargetObjects[0])
  const dedicatedFactoryId = getDedicatedSpecialCraftFactoryId(seed.operationId)
  return {
    operationId: seed.operationId,
    craftCode: craftDefinition.craftCode,
    craftName: craftDefinition.craftName,
    processCode: craftDefinition.processCode,
    processName: managementDomain === 'AUXILIARY_CRAFT_FACTORY' ? '辅助工艺' : '特种工艺',
    managementDomain,
    managementDomainName,
    operationName: craftDefinition.craftName,
    supportedTargetObjects,
    supportedTargetObjectLabels: getSpecialCraftSupportedTargetObjectLabels(supportedTargetObjects),
    defaultTargetObject,
    targetObject: defaultTargetObject,
    visibleFactoryTypes: [],
    visibleFactoryIds: dedicatedFactoryId ? [dedicatedFactoryId] : [],
    requiresTaskOrder: true,
    requiresFactoryWarehouse: true,
    requiresFeiTicketScan: seed.requiresFeiTicketScan,
    mustReturnToCuttingFactory: seed.mustReturnToCuttingFactory,
    isEnabled: craftDefinition.isActive,
    remark: seed.remark,
  }
}

function cloneOperationDefinition(item: SpecialCraftOperationDefinition): SpecialCraftOperationDefinition {
  return {
    ...item,
    supportedTargetObjects: [...item.supportedTargetObjects],
    supportedTargetObjectLabels: [...item.supportedTargetObjectLabels],
    visibleFactoryTypes: [...item.visibleFactoryTypes],
    visibleFactoryIds: [...(item.visibleFactoryIds ?? [])],
  }
}

function buildOperationDefinitionsForDomain(
  managementDomain: ProcessCraftManagementDomain,
  seedByName: Record<string, SpecialCraftOperationSeed>,
): SpecialCraftOperationDefinition[] {
  return (listSelectableSpecialCraftDefinitions() as OperationCraftDefinition[])
    .filter((craftDefinition) => craftDefinition.managementDomain === managementDomain)
    .map((craftDefinition) => {
      const seed = seedByName[craftDefinition.craftName]
      return seed ? buildOperationDefinition(craftDefinition, seed, managementDomain) : null
    })
    .filter((item): item is SpecialCraftOperationDefinition => Boolean(item))
}

export const auxiliaryCraftOperationDefinitions: SpecialCraftOperationDefinition[] =
  buildOperationDefinitionsForDomain('AUXILIARY_CRAFT_FACTORY', auxiliaryCraftOperationSeedByName)

export const specialTypeCraftOperationDefinitions: SpecialCraftOperationDefinition[] =
  buildOperationDefinitionsForDomain('SPECIAL_CRAFT_FACTORY', specialTypeCraftOperationSeedByName)

export const specialCraftOperationDefinitions: SpecialCraftOperationDefinition[] = [
  ...auxiliaryCraftOperationDefinitions,
  ...specialTypeCraftOperationDefinitions,
]

const specialCraftOperationById = new Map(
  specialCraftOperationDefinitions.map((item) => [item.operationId, item] as const),
)

const specialCraftOperationByCraftCode = new Map(
  specialCraftOperationDefinitions.map((item) => [item.craftCode, item] as const),
)

function normalizeOperationSlug(value: string): string {
  return value.trim().toLowerCase()
}

export function listSpecialCraftOperationDefinitions(): SpecialCraftOperationDefinition[] {
  return specialCraftOperationDefinitions.map((item) => cloneOperationDefinition(item))
}

export function listAuxiliaryCraftOperationDefinitions(): SpecialCraftOperationDefinition[] {
  return auxiliaryCraftOperationDefinitions.map((item) => cloneOperationDefinition(item))
}

export function listSpecialTypeCraftOperationDefinitions(): SpecialCraftOperationDefinition[] {
  return specialTypeCraftOperationDefinitions.map((item) => cloneOperationDefinition(item))
}

export function listOperationDefinitionsByManagementDomain(
  managementDomain: ProcessCraftManagementDomain,
): SpecialCraftOperationDefinition[] {
  if (managementDomain === 'AUXILIARY_CRAFT_FACTORY') {
    return listAuxiliaryCraftOperationDefinitions()
  }

  if (managementDomain === 'SPECIAL_CRAFT_FACTORY') {
    return listSpecialTypeCraftOperationDefinitions()
  }

  return []
}

export function listEnabledSpecialCraftOperationDefinitions(): SpecialCraftOperationDefinition[] {
  return specialCraftOperationDefinitions
    .filter((item) => item.isEnabled)
    .map((item) => cloneOperationDefinition(item))
}

export function listEnabledAuxiliaryCraftOperationDefinitions(): SpecialCraftOperationDefinition[] {
  return auxiliaryCraftOperationDefinitions
    .filter((item) => item.isEnabled)
    .map((item) => cloneOperationDefinition(item))
}

export function listEnabledSpecialTypeCraftOperationDefinitions(): SpecialCraftOperationDefinition[] {
  return specialTypeCraftOperationDefinitions
    .filter((item) => item.isEnabled)
    .map((item) => cloneOperationDefinition(item))
}

export function getSpecialCraftOperationById(operationId: string): SpecialCraftOperationDefinition | undefined {
  const matched = specialCraftOperationById.get(operationId)
  return matched ? cloneOperationDefinition(matched) : undefined
}

export function getSpecialCraftOperationByCraftCode(craftCode: string): SpecialCraftOperationDefinition | undefined {
  const matched = specialCraftOperationByCraftCode.get(craftCode)
  return matched ? cloneOperationDefinition(matched) : undefined
}

function matchesFactoryAbility(factoryId: string, operation: SpecialCraftOperationDefinition): boolean {
  const factory = getFactoryMasterRecordById(factoryId)
  if (!factory) return false
  return factory.processAbilities.some((ability) =>
    (ability.status ?? 'ACTIVE') !== 'DISABLED'
    && ability.canReceiveTask !== false
    && ability.processCode === operation.processCode
    && ability.craftCodes.includes(operation.craftCode),
  )
}

function matchesFactoryVisibility(
  input: {
    factoryId: string
    factoryType: FactoryType
  },
  operation: SpecialCraftOperationDefinition,
): boolean {
  const typeMatched =
    operation.visibleFactoryTypes.length === 0
      || operation.visibleFactoryTypes.includes(input.factoryType as SpecialCraftVisibleFactoryType)
  const idMatched =
    !operation.visibleFactoryIds?.length
      || operation.visibleFactoryIds.includes(input.factoryId)
  return typeMatched && idMatched
}

export function canFactorySeeSpecialCraftOperation(factoryId: string, operationId: string): boolean {
  const factory = getFactoryMasterRecordById(factoryId)
  const operation = getSpecialCraftOperationById(operationId)
  if (!factory || !operation || !operation.isEnabled) return false
  return matchesFactoryAbility(factoryId, operation) && matchesFactoryVisibility(
    { factoryId, factoryType: factory.factoryType },
    operation,
  )
}

export function listVisibleSpecialCraftOperationsForFactory(factoryId: string): SpecialCraftOperationDefinition[] {
  return listEnabledSpecialCraftOperationDefinitions().filter((operation) =>
    canFactorySeeSpecialCraftOperation(factoryId, operation.operationId),
  )
}

export function listVisibleSpecialCraftOperationsForFactoryType(factoryType: FactoryType): SpecialCraftOperationDefinition[] {
  const matchingFactories = listFactoryMasterRecords().filter((factory) => factory.factoryType === factoryType)
  return listEnabledSpecialCraftOperationDefinitions().filter((operation) =>
    matchingFactories.some((factory) => canFactorySeeSpecialCraftOperation(factory.id, operation.operationId)),
  )
}

export function getDefaultSpecialCraftTargetObject(
  operation: Pick<SpecialCraftOperationDefinition, 'defaultTargetObject' | 'targetObject'>,
): SpecialCraftTargetObjectLabel {
  if (operation.defaultTargetObject === '已裁部位' || operation.defaultTargetObject === '完整面料') {
    return operation.defaultTargetObject
  }
  return operation.targetObject === '面料' || operation.targetObject === '完整面料'
    ? '完整面料'
    : '已裁部位'
}

export function isSpecialCraftTargetObjectSupported(
  operation: Pick<SpecialCraftOperationDefinition, 'supportedTargetObjectLabels'>,
  selectedTargetObject: string | undefined,
): selectedTargetObject is SpecialCraftTargetObjectLabel {
  return selectedTargetObject === '已裁部位' || selectedTargetObject === '完整面料' || selectedTargetObject === '成衣半成品'
    ? operation.supportedTargetObjectLabels.includes(selectedTargetObject)
    : false
}

export function buildSpecialCraftOperationSlug(
  input: Pick<SpecialCraftOperationDefinition, 'operationId'> | string,
): string {
  const operationId = typeof input === 'string' ? input : input.operationId
  return normalizeOperationSlug(operationId)
}

export function getSpecialCraftOperationBySlug(slug: string): SpecialCraftOperationDefinition | undefined {
  const normalizedSlug = normalizeOperationSlug(slug)
  return listEnabledSpecialCraftOperationDefinitions().find(
    (item) => buildSpecialCraftOperationSlug(item) === normalizedSlug,
  )
}

export function buildSpecialCraftTaskOrdersPath(
  input: Pick<SpecialCraftOperationDefinition, 'operationId'> | string,
): string {
  const slug = typeof input === 'string' ? normalizeOperationSlug(input) : buildSpecialCraftOperationSlug(input)
  return `/fcs/process-factory/special-craft/${slug}/tasks`
}

export function buildSpecialCraftTaskDetailPath(
  input: Pick<SpecialCraftOperationDefinition, 'operationId'> | string,
  taskOrderId: string,
): string {
  const slug = typeof input === 'string' ? normalizeOperationSlug(input) : buildSpecialCraftOperationSlug(input)
  return `${buildSpecialCraftTaskOrdersPath(slug)}/${encodeURIComponent(taskOrderId)}`
}

export function buildSpecialCraftWorkOrderDetailPath(
  input: Pick<SpecialCraftOperationDefinition, 'operationId'> | string,
  workOrderId: string,
): string {
  const slug = typeof input === 'string' ? normalizeOperationSlug(input) : buildSpecialCraftOperationSlug(input)
  return `/fcs/process-factory/special-craft/${slug}/work-orders/${encodeURIComponent(workOrderId)}`
}

export function buildSpecialCraftManagementDomainSlug(
  managementDomain: ProcessCraftManagementDomain,
): 'auxiliary' | 'special-type' {
  return managementDomain === 'AUXILIARY_CRAFT_FACTORY' ? 'auxiliary' : 'special-type'
}

export function getSpecialCraftManagementDomainBySlug(
  slug: string,
): ProcessCraftManagementDomain | undefined {
  const normalizedSlug = normalizeOperationSlug(slug)
  if (normalizedSlug === 'auxiliary') return 'AUXILIARY_CRAFT_FACTORY'
  if (normalizedSlug === 'special-type') return 'SPECIAL_CRAFT_FACTORY'
  return undefined
}

export function buildSpecialCraftDomainWaitProcessWarehousePath(
  managementDomain: ProcessCraftManagementDomain,
): string {
  return `/fcs/process-factory/special-craft/${buildSpecialCraftManagementDomainSlug(managementDomain)}/wait-process-warehouse`
}

export function buildSpecialCraftDomainWaitHandoverWarehousePath(
  managementDomain: ProcessCraftManagementDomain,
): string {
  return `/fcs/process-factory/special-craft/${buildSpecialCraftManagementDomainSlug(managementDomain)}/wait-handover-warehouse`
}

export function buildSpecialCraftPreferredWarehousePath(
  input: Pick<SpecialCraftOperationDefinition, 'operationId' | 'managementDomain'> & {
    waitHandoverQty?: number
    handoverOrderId?: string
    handoverRecordNo?: string
  },
): string {
  const shouldOpenWaitHandover =
    Number(input.waitHandoverQty || 0) > 0
    || Boolean(input.handoverOrderId)
    || Boolean(input.handoverRecordNo)
  return shouldOpenWaitHandover
    ? buildSpecialCraftDomainWaitHandoverWarehousePath(input.managementDomain)
    : buildSpecialCraftDomainWaitProcessWarehousePath(input.managementDomain)
}
