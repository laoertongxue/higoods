import {
  listSelectableSpecialCraftDefinitions,
  type ProcessCraftDefinition,
} from './process-craft-dict.ts'

export type SpecialCraftTargetObject = '裁片' | '面料' | '成衣半成品'

export interface SpecialCraftOperationDefinition {
  operationId: string
  craftCode: string
  craftName: string
  processCode: string
  processName: string
  operationName: string
  targetObject: SpecialCraftTargetObject
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
  targetObject: SpecialCraftTargetObject
  requiresFeiTicketScan: boolean
  mustReturnToCuttingFactory: boolean
  remark: string
}

const specialCraftOperationSeedByName: Record<string, SpecialCraftOperationSeed> = {
  打揽: {
    operationId: 'SC-OP-008',
    targetObject: '裁片',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按裁片任务单管理，完成后回裁床厂待交出仓。',
  },
  打条: {
    operationId: 'SC-OP-032',
    targetObject: '裁片',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按裁片任务单管理，完成后回裁床厂待交出仓。',
  },
  激光切: {
    operationId: 'SC-OP-064',
    targetObject: '裁片',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按裁片任务单管理，完成后回裁床厂待交出仓。',
  },
  洗水: {
    operationId: 'SC-OP-128',
    targetObject: '面料',
    requiresFeiTicketScan: false,
    mustReturnToCuttingFactory: false,
    remark: '按面料任务单管理，保留后续工厂仓口径扩展位。',
  },
  烫画: {
    operationId: 'SC-OP-8192',
    targetObject: '裁片',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按裁片任务单管理，完成后回裁床厂待交出仓。',
  },
  直喷: {
    operationId: 'SC-OP-16384',
    targetObject: '裁片',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按裁片任务单管理，完成后回裁床厂待交出仓。',
  },
  捆条: {
    operationId: 'SC-OP-131072',
    targetObject: '裁片',
    requiresFeiTicketScan: true,
    mustReturnToCuttingFactory: true,
    remark: '按裁片任务单管理，完成后回裁床厂待交出仓。',
  },
}

function buildOperationDefinition(
  craftDefinition: ProcessCraftDefinition,
  seed: SpecialCraftOperationSeed,
): SpecialCraftOperationDefinition {
  return {
    operationId: seed.operationId,
    craftCode: craftDefinition.craftCode,
    craftName: craftDefinition.craftName,
    processCode: craftDefinition.processCode,
    processName: '特殊工艺',
    operationName: craftDefinition.craftName,
    targetObject: seed.targetObject,
    requiresTaskOrder: true,
    requiresFactoryWarehouse: true,
    requiresStatistics: true,
    requiresFeiTicketScan: seed.requiresFeiTicketScan,
    mustReturnToCuttingFactory: seed.mustReturnToCuttingFactory,
    isEnabled: craftDefinition.isActive,
    remark: seed.remark,
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
  return specialCraftOperationDefinitions.map((item) => ({ ...item }))
}

export function listEnabledSpecialCraftOperationDefinitions(): SpecialCraftOperationDefinition[] {
  return specialCraftOperationDefinitions
    .filter((item) => item.isEnabled)
    .map((item) => ({ ...item }))
}

export function getSpecialCraftOperationById(operationId: string): SpecialCraftOperationDefinition | undefined {
  const matched = specialCraftOperationById.get(operationId)
  return matched ? { ...matched } : undefined
}

export function getSpecialCraftOperationByCraftCode(craftCode: string): SpecialCraftOperationDefinition | undefined {
  const matched = specialCraftOperationByCraftCode.get(craftCode)
  return matched ? { ...matched } : undefined
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

export function buildSpecialCraftWarehousePath(
  input: Pick<SpecialCraftOperationDefinition, 'operationId'> | string,
): string {
  const slug = typeof input === 'string' ? normalizeOperationSlug(input) : buildSpecialCraftOperationSlug(input)
  return `/fcs/process-factory/special-craft/${slug}/warehouse`
}

export function buildSpecialCraftStatisticsPath(
  input: Pick<SpecialCraftOperationDefinition, 'operationId'> | string,
): string {
  const slug = typeof input === 'string' ? normalizeOperationSlug(input) : buildSpecialCraftOperationSlug(input)
  return `/fcs/process-factory/special-craft/${slug}/statistics`
}
