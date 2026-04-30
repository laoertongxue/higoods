import {
  getSpecialCraftSupportedTargetObjectLabels,
  getSpecialCraftTargetObjectLabel,
  listSelectableSpecialCraftDefinitions,
  type ProcessCraftDefinition,
  type SpecialCraftSupportedTargetObject,
  type SpecialCraftTargetObjectLabel,
  type SpecialCraftVisibleFactoryType,
} from './process-craft-dict.ts'
import { getFactoryMasterRecordById, listFactoryMasterRecords } from './factory-master-store.ts'
import type { FactoryType } from './factory-types.ts'

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
  operationName: string
  supportedTargetObjects: SpecialCraftSupportedTargetObject[]
  supportedTargetObjectLabels: SpecialCraftTargetObjectLabel[]
  defaultTargetObject: SpecialCraftTargetObjectLabel
  targetObject: SpecialCraftTargetObject
  visibleFactoryTypes: SpecialCraftVisibleFactoryType[]
  visibleFactoryIds?: string[]
  requiresTaskOrder: boolean
  requiresFactoryWarehouse: boolean
  requiresStatistics: boolean
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

const specialCraftOperationSeedByName: Record<string, SpecialCraftOperationSeed> = {
  打揽: {
    operationId: 'SC-OP-008',
    defaultTargetObject: 'CUT_PIECE',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按裁片任务单管理，完成后回裁床厂待交出仓。',
  },
  打条: {
    operationId: 'SC-OP-032',
    defaultTargetObject: 'CUT_PIECE',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按裁片任务单管理，完成后回裁床厂待交出仓。',
  },
  激光切: {
    operationId: 'SC-OP-064',
    defaultTargetObject: 'CUT_PIECE',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按裁片任务单管理，完成后回裁床厂待交出仓。',
  },
  烫画: {
    operationId: 'SC-OP-8192',
    defaultTargetObject: 'CUT_PIECE',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按裁片任务单管理，完成后回裁床厂待交出仓。',
  },
  直喷: {
    operationId: 'SC-OP-16384',
    defaultTargetObject: 'CUT_PIECE',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按裁片任务单管理，完成后回裁床厂待交出仓。',
  },
  捆条: {
    operationId: 'SC-OP-131072',
    defaultTargetObject: 'CUT_PIECE',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按裁片任务单管理，完成后回裁床厂待交出仓。',
  },
}

function buildOperationDefinition(
  craftDefinition: ProcessCraftDefinition,
  seed: SpecialCraftOperationSeed,
): SpecialCraftOperationDefinition {
  const supportedTargetObjects = craftDefinition.supportedTargetObjects.length > 0
    ? [...craftDefinition.supportedTargetObjects]
    : [seed.defaultTargetObject]
  const defaultTargetObject = supportedTargetObjects.includes(seed.defaultTargetObject)
    ? getSpecialCraftTargetObjectLabel(seed.defaultTargetObject)
    : getSpecialCraftTargetObjectLabel(supportedTargetObjects[0])
  return {
    operationId: seed.operationId,
    craftCode: craftDefinition.craftCode,
    craftName: craftDefinition.craftName,
    processCode: craftDefinition.processCode,
    processName: '特殊工艺',
    operationName: craftDefinition.craftName,
    supportedTargetObjects,
    supportedTargetObjectLabels: getSpecialCraftSupportedTargetObjectLabels(supportedTargetObjects),
    defaultTargetObject,
    targetObject: defaultTargetObject,
    visibleFactoryTypes: [],
    visibleFactoryIds: [],
    requiresTaskOrder: true,
    requiresFactoryWarehouse: true,
    requiresStatistics: true,
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

export const specialCraftOperationDefinitions: SpecialCraftOperationDefinition[] =
  listSelectableSpecialCraftDefinitions()
    .map((craftDefinition) => {
      const seed = specialCraftOperationSeedByName[craftDefinition.craftName]
      return seed ? buildOperationDefinition(craftDefinition, seed) : null
    })
    .filter((item): item is SpecialCraftOperationDefinition => Boolean(item))

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

export function listEnabledSpecialCraftOperationDefinitions(): SpecialCraftOperationDefinition[] {
  return specialCraftOperationDefinitions
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
  return selectedTargetObject === '已裁部位' || selectedTargetObject === '完整面料'
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

export function buildSpecialCraftWarehousePath(
  input: Pick<SpecialCraftOperationDefinition, 'operationId'> | string,
): string {
  const slug = typeof input === 'string' ? normalizeOperationSlug(input) : buildSpecialCraftOperationSlug(input)
  return `/fcs/process-factory/special-craft/${slug}/warehouse`
}

export function buildSpecialCraftWaitProcessWarehousePath(
  input: Pick<SpecialCraftOperationDefinition, 'operationId'> | string,
): string {
  const slug = typeof input === 'string' ? normalizeOperationSlug(input) : buildSpecialCraftOperationSlug(input)
  return `/fcs/process-factory/special-craft/${slug}/wait-process-warehouse`
}

export function buildSpecialCraftWaitHandoverWarehousePath(
  input: Pick<SpecialCraftOperationDefinition, 'operationId'> | string,
): string {
  const slug = typeof input === 'string' ? normalizeOperationSlug(input) : buildSpecialCraftOperationSlug(input)
  return `/fcs/process-factory/special-craft/${slug}/wait-handover-warehouse`
}

export function buildSpecialCraftPreferredWarehousePath(
  input: Pick<SpecialCraftOperationDefinition, 'operationId'> & {
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
    ? buildSpecialCraftWaitHandoverWarehousePath(input)
    : buildSpecialCraftWaitProcessWarehousePath(input)
}

export function buildSpecialCraftStatisticsPath(
  input: Pick<SpecialCraftOperationDefinition, 'operationId'> | string,
): string {
  const slug = typeof input === 'string' ? normalizeOperationSlug(input) : buildSpecialCraftOperationSlug(input)
  return `/fcs/process-factory/special-craft/${slug}/statistics`
}
