import {
  productionOrders,
  type ProductionOrder,
} from './production-orders.ts'
import {
  getProductionOrderProcessEntries,
  getProductionOrderTechPackSnapshot,
} from './production-order-tech-pack-runtime.ts'
import {
  attachSpecialCraftTasksToProductionArtifacts,
  type ProductionArtifactSpecialCraftAttachment,
} from './special-craft-task-generation.ts'
import type { SpecialCraftTaskOrder, SpecialCraftTaskGenerationBatch, SpecialCraftTaskGenerationError } from './special-craft-task-orders.ts'
import {
  getProcessCraftByCode,
  getProcessDefinitionByCode,
  getProcessStageByCode,
  listActiveProcessCraftDefinitions,
  type CraftStageCode,
  type CapacityRollupMode,
  type DetailSplitDimension,
  type DetailSplitMode,
  type FactoryMobileExecutionMode,
  type ProcessCraftDefinition,
  type ProcessAssignmentGranularity,
  type ProcessDocType,
  type ProcessRole,
  type RuleSource,
  type TaskTypeMode,
} from './process-craft-dict.ts'
import type { TechnicalProcessEntry } from '../pcs-technical-data-version-types.ts'
import type {
  ProductionOrderTechPackSnapshot,
  TechPackBomItemSnapshot,
} from './production-tech-pack-snapshot-types.ts'
import { selectProductionMaterialBomItems } from './production-material-bom.ts'

type TechPackProcessEntry = TechnicalProcessEntry
type TechPackProcessEntryType = TechnicalProcessEntry['entryType']

export type ProductionArtifactType = 'DEMAND' | 'TASK' | 'PREPARATION_ORDER'

export interface GeneratedProductionArtifactBase {
  artifactId: string
  artifactType: ProductionArtifactType
  orderId: string
  techPackId: string
  orderQty: number
  sourceEntryId: string
  sourceEntryType: TechPackProcessEntryType
  stageCode: CraftStageCode
  stageName: string
  processCode: string
  processName: string
  systemProcessCode: string
  craftCode?: string
  craftName?: string
  assignmentGranularity: ProcessAssignmentGranularity
  ruleSource: RuleSource
  detailSplitMode: DetailSplitMode
  detailSplitDimensions: DetailSplitDimension[]
  defaultDocType: ProcessDocType
  taskTypeMode: TaskTypeMode
  isSpecialCraft: boolean
  selectedTargetObject?: string
  woolTaskType?: 'WHOLE_GARMENT' | 'PART_PANEL'
  downstreamTarget?: '后道工厂' | '裁床待交出仓'
  requiresFeiTicket?: boolean
  materialIssueMode?: 'WAREHOUSE_DELIVERY'
  bomItemId?: string
  materialCode?: string
  materialName?: string
  plannedQty?: number
  plannedUnit?: string
  linkedBomItemIds?: string[]
  linkedPatternIds?: string[]
  routeStepNo?: number
  routeLaneNo?: number
  routeParallelGroupId?: string
  routeParallelGroupName?: string
  docTypeLabel: string
  generationSortKey?: string
  sortKey: string
}

export interface GeneratedDemandArtifact extends GeneratedProductionArtifactBase {
  artifactType: 'DEMAND'
  demandTypeCode: string
  demandTypeLabel: string
  requiresWaterSoluble?: boolean
  processRoute?: Array<'WATER_SOLUBLE' | 'DYE'>
}

export interface GeneratedTaskArtifact extends GeneratedProductionArtifactBase {
  artifactType: 'TASK'
  taskTypeCode: string
  taskTypeLabel: string
  taskScope: 'EXTERNAL_TASK' | 'POST_ROLLUP_TASK'
  rolledUpChildProcessCodes?: string[]
  rolledUpChildProcessNames?: string[]
}

export interface GeneratedPreparationOrderArtifact extends GeneratedProductionArtifactBase {
  artifactType: 'PREPARATION_ORDER'
  preparationOrderTypeCode: string
  preparationOrderTypeLabel: string
  preparationScope: 'INTERNAL_PREPARATION_ORDER'
}

export type GeneratedProductionArtifact = GeneratedDemandArtifact | GeneratedTaskArtifact | GeneratedPreparationOrderArtifact
export type ProductionDemandArtifact = GeneratedDemandArtifact
export type ProductionTaskArtifact = GeneratedTaskArtifact
export type ProductionPreparationOrderArtifact = GeneratedPreparationOrderArtifact

export interface GeneratedProductionArtifactBundle {
  orderId: string
  artifacts: GeneratedProductionArtifact[]
  specialCraftTaskOrders: SpecialCraftTaskOrder[]
  specialCraftGenerationBatch: SpecialCraftTaskGenerationBatch
  specialCraftGenerationErrors: SpecialCraftTaskGenerationError[]
  specialCraftGenerationWarnings: string[]
}

interface ResolvedEntryContext {
  orderId: string
  orderQty: number
  techPackId: string
  sourceEntry: TechPackProcessEntry
  sourceEntryId: string
  stageCode: CraftStageCode
  stageName: string
  stageSort: number
  processCode: string
  processName: string
  processSort: number
  systemProcessCode: string
  craftCode?: string
  craftName?: string
  processRole: ProcessRole
  parentProcessCode?: string
  generatesExternalTask: boolean
  requiresTaskQr: boolean
  requiresHandoverOrder: boolean
  capacityEnabled: boolean
  capacityRollupMode: CapacityRollupMode
  factoryMobileExecutionMode: FactoryMobileExecutionMode
  isActive: boolean
  assignmentGranularity: ProcessAssignmentGranularity
  ruleSource: RuleSource
  detailSplitMode: DetailSplitMode
  detailSplitDimensions: DetailSplitDimension[]
  defaultDocType: ProcessDocType
  taskTypeMode: TaskTypeMode
  isSpecialCraft: boolean
  routeStepNo?: number
  routeLaneNo?: number
  routeParallelGroupId?: string
  routeParallelGroupName?: string
  entryIndex: number
}

const DOC_TYPE_LABEL: Record<ProcessDocType, string> = {
  DEMAND: '需求单',
  TASK: '任务单',
  PREPARATION_ORDER: '加工单',
}

export const DICTIONARY_CRAFT_MOCKS_PER_DEFINITION = 3
const DICTIONARY_COVERAGE_BLOCKED_ORDER_STATUSES = new Set(['DRAFT', 'READY_FOR_BREAKDOWN'])

function toArtifactKeySegment(entryId: string): string {
  return entryId.replace(/[^A-Za-z0-9_-]/g, '_')
}

function toUnambiguousArtifactIdentitySegment(value: string): string {
  const encoded = encodeURIComponent(value)
  return `${encoded.length}_${encoded}`
}

function toMockToken(value: string, size: number): string {
  const digits = value.replace(/\D/g, '')
  return (digits || value.replace(/[^A-Za-z0-9]/g, '') || '0').slice(-size).padStart(size, '0')
}

function isPositiveRouteNo(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function buildDictionaryCraftMockDocumentNo(
  prefix: string,
  craftCode: string,
  orderId: string,
  mockIndex: number,
): string {
  return `${prefix}${toMockToken(craftCode, 7)}${toMockToken(orderId, 8)}${String(mockIndex + 1).padStart(2, '0')}`
}

function listTechPackSourceOrders() {
  return productionOrders
    .map((order) => ({
      order,
      snapshot: getProductionOrderTechPackSnapshot(order.productionOrderId),
    }))
    .filter((item): item is { order: typeof productionOrders[number]; snapshot: NonNullable<ReturnType<typeof getProductionOrderTechPackSnapshot>> } => Boolean(item.snapshot))
}

function listDictionaryCoverageSourceOrders() {
  return listTechPackSourceOrders().filter(({ order }) =>
    order.taskBreakdownSummary.isBrokenDown && !DICTIONARY_COVERAGE_BLOCKED_ORDER_STATUSES.has(order.status),
  )
}

function getMockSourceForCraft(craftIndex: number, mockIndex: number) {
  const sourceOrders = listDictionaryCoverageSourceOrders()
  if (!sourceOrders.length) return null
  return sourceOrders[(craftIndex * DICTIONARY_CRAFT_MOCKS_PER_DEFINITION + mockIndex) % sourceOrders.length]
}

export function getDictionaryCraftMockSource(craftCode: string, mockIndex: number) {
  const craftIndex = listActiveProcessCraftDefinitions().findIndex((definition) => definition.craftCode === craftCode)
  if (craftIndex < 0) return null
  return getMockSourceForCraft(craftIndex, mockIndex)
}

function toCoverageSortKey(definition: ProcessCraftDefinition, mockIndex: number): string {
  const stageSort = getProcessStageByCode(definition.stageCode)?.sort ?? 999
  const processSort = getProcessDefinitionByCode(definition.processCode)?.sort ?? 999
  return `${String(stageSort).padStart(3, '0')}-${String(processSort).padStart(3, '0')}-${String(definition.legacyValue).padStart(7, '0')}-${String(mockIndex).padStart(3, '0')}`
}

function toCoverageSourceEntryId(definition: ProcessCraftDefinition, mockIndex: number, snapshotId: string): string {
  return `DICT-MOCK-${definition.craftCode}-${String(mockIndex + 1).padStart(2, '0')}-${snapshotId}`
}

function toCoverageTargetObject(definition: ProcessCraftDefinition): string | undefined {
  if (definition.isSpecialCraft) return definition.supportedTargetObjectLabels[0] || definition.targetObjectName
  if (definition.processCode === 'WOOL') return definition.targetObjectName
  return undefined
}

function buildDictionaryCoverageBase(
  definition: ProcessCraftDefinition,
  craftIndex: number,
  mockIndex: number,
): GeneratedProductionArtifactBase | null {
  const source = getMockSourceForCraft(craftIndex, mockIndex)
  if (!source) return null
  const processDefinition = getProcessDefinitionByCode(definition.processCode)
  const stageDefinition = getProcessStageByCode(definition.stageCode)
  const materialBomItems = selectProductionMaterialBomItems(source.snapshot.bomItems)
  const linkedBomItem = definition.processCode === 'WATER_SOLUBLE'
    ? materialBomItems[mockIndex % materialBomItems.length] || source.snapshot.bomItems[0]
    : materialBomItems[0] || source.snapshot.bomItems[0]
  if (definition.processCode === 'WATER_SOLUBLE') {
    if (
      !linkedBomItem?.id
      || !linkedBomItem.name?.trim()
    ) return null
  }
  const waterSolubleMaterialFields = definition.processCode === 'WATER_SOLUBLE' && linkedBomItem
    ? {
        bomItemId: linkedBomItem.id,
        materialCode: linkedBomItem.materialCode || linkedBomItem.id,
        materialName: linkedBomItem.name,
        plannedQty: calculateBomProcessPlannedQty(source.order, linkedBomItem),
        plannedUnit: linkedBomItem.unit || '米',
        linkedBomItemIds: [linkedBomItem.id],
      }
    : {}
  const sourceEntryId = toCoverageSourceEntryId(definition, mockIndex, source.snapshot.snapshotId)
  const sortKey = `${toCoverageSortKey(definition, mockIndex)}-${source.order.productionOrderId}`

  return {
    artifactId: `DICT-${definition.defaultDocType}-${definition.craftCode}-${source.order.productionOrderId}-${mockIndex + 1}`,
    artifactType: definition.defaultDocType,
    orderId: source.order.productionOrderId,
    techPackId: source.snapshot.sourceTechPackVersionId,
    orderQty: resolveOrderQty(source.order.productionOrderId),
    sourceEntryId,
    sourceEntryType: 'CRAFT',
    stageCode: definition.stageCode,
    stageName: stageDefinition?.stageName ?? definition.stageCode,
    processCode: definition.processCode,
    processName: processDefinition?.processName ?? definition.processCode,
    systemProcessCode: definition.systemProcessCode,
    craftCode: definition.craftCode,
    craftName: definition.craftName,
    assignmentGranularity: definition.assignmentGranularity,
    ruleSource: definition.ruleSource,
    detailSplitMode: definition.detailSplitMode,
    detailSplitDimensions: [...definition.detailSplitDimensions],
    defaultDocType: definition.defaultDocType,
    taskTypeMode: definition.taskTypeMode,
    isSpecialCraft: definition.isSpecialCraft,
    selectedTargetObject: toCoverageTargetObject(definition),
    woolTaskType:
      definition.processCode === 'WOOL'
        ? definition.craftName === '部位毛织'
          ? 'PART_PANEL'
          : 'WHOLE_GARMENT'
        : undefined,
    downstreamTarget:
      definition.processCode === 'WOOL'
        ? definition.craftName === '部位毛织'
          ? '裁床待交出仓'
          : '后道工厂'
        : undefined,
    materialIssueMode: definition.processCode === 'WOOL' ? 'WAREHOUSE_DELIVERY' : undefined,
    linkedBomItemIds: linkedBomItem ? [linkedBomItem.id] : undefined,
    ...waterSolubleMaterialFields,
    linkedPatternIds: undefined,
    docTypeLabel: definition.defaultDocType === 'DEMAND'
      ? `${definition.craftName}需求单`
      : DOC_TYPE_LABEL[definition.defaultDocType],
    generationSortKey: sortKey,
    sortKey,
  }
}

function buildDictionaryCoverageDemandArtifact(
  definition: ProcessCraftDefinition,
  craftIndex: number,
  mockIndex: number,
): GeneratedDemandArtifact | null {
  const base = buildDictionaryCoverageBase(definition, craftIndex, mockIndex)
  if (!base || base.artifactType !== 'DEMAND') return null
  const demandTypeLabel = `${definition.craftName}需求单`
  return {
    ...base,
    artifactType: 'DEMAND',
    docTypeLabel: demandTypeLabel,
    demandTypeCode: `DEMAND_${definition.craftCode}`,
    demandTypeLabel,
  }
}

function buildDictionaryCoverageTaskArtifact(
  definition: ProcessCraftDefinition,
  craftIndex: number,
  mockIndex: number,
): GeneratedTaskArtifact | null {
  const base = buildDictionaryCoverageBase(definition, craftIndex, mockIndex)
  if (!base || base.artifactType !== 'TASK') return null
  return {
    ...base,
    artifactType: 'TASK',
    docTypeLabel: DOC_TYPE_LABEL.TASK,
    taskTypeCode: definition.craftCode,
    taskTypeLabel: definition.craftName,
    taskScope: definition.processRole === 'INTERNAL_CAPACITY_NODE' ? 'POST_ROLLUP_TASK' : 'EXTERNAL_TASK',
  }
}

function listDictionaryCoverageDemandArtifacts(): GeneratedDemandArtifact[] {
  return listActiveProcessCraftDefinitions()
    .flatMap((definition, craftIndex) => {
      if (
        definition.defaultDocType !== 'DEMAND'
      ) return []
      return Array.from({ length: DICTIONARY_CRAFT_MOCKS_PER_DEFINITION }, (_, mockIndex) =>
        buildDictionaryCoverageDemandArtifact(definition, craftIndex, mockIndex),
      )
    })
    .filter((item): item is GeneratedDemandArtifact => Boolean(item))
}

function listDictionaryCoverageTaskArtifacts(): GeneratedTaskArtifact[] {
  return listActiveProcessCraftDefinitions()
    .flatMap((definition, craftIndex) => {
      if (
        definition.defaultDocType !== 'TASK'
        || definition.stageCode === 'PREP'
        || ['CUT_PANEL', 'SEW', 'BUTTONHOLE', 'BUTTON_ATTACH', 'IRON_PACK'].includes(definition.processCode)
      ) return []
      return Array.from({ length: DICTIONARY_CRAFT_MOCKS_PER_DEFINITION }, (_, mockIndex) =>
        buildDictionaryCoverageTaskArtifact(definition, craftIndex, mockIndex),
      )
    })
    .filter((item): item is GeneratedTaskArtifact => Boolean(item))
}

function ensureDictionaryCoverage<T extends GeneratedProductionArtifact>(
  existingArtifacts: T[],
  coverageArtifacts: T[],
  definitions: ProcessCraftDefinition[],
): T[] {
  const result = [...existingArtifacts]
  for (const definition of definitions) {
    const existingOrderIds = new Set(
      result
        .filter((artifact) => artifact.craftCode === definition.craftCode)
        .map((artifact) => artifact.orderId),
    )
    if (existingOrderIds.size >= DICTIONARY_CRAFT_MOCKS_PER_DEFINITION) continue

    const candidates = coverageArtifacts.filter((artifact) => artifact.craftCode === definition.craftCode)
    const primaryAdds = candidates
      .filter((artifact) => !existingOrderIds.has(artifact.orderId))
      .slice(0, DICTIONARY_CRAFT_MOCKS_PER_DEFINITION - existingOrderIds.size)
    const pickedArtifactIds = new Set(primaryAdds.map((artifact) => artifact.artifactId))
    const fallbackAdds = candidates
      .filter((artifact) => !pickedArtifactIds.has(artifact.artifactId))
      .slice(0, Math.max(0, DICTIONARY_CRAFT_MOCKS_PER_DEFINITION - existingOrderIds.size - primaryAdds.length))

    result.push(...primaryAdds, ...fallbackAdds)
  }
  return result.sort((a, b) => {
    if (a.orderId !== b.orderId) return a.orderId.localeCompare(b.orderId)
    return a.sortKey.localeCompare(b.sortKey)
  })
}

function resolveOrderQty(orderId: string): number {
  const order = productionOrders.find((item) => item.productionOrderId === orderId)
  if (!order) return 0
  return order.demandSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0)
}

function resolveEntryContext(orderId: string, entry: TechPackProcessEntry, entryIndex: number): ResolvedEntryContext {
  const processDefinition = getProcessDefinitionByCode(entry.processCode)
  const craftDefinition = entry.craftCode ? getProcessCraftByCode(entry.craftCode) : undefined
  const stageCode = (entry.stageCode || processDefinition?.stageCode || craftDefinition?.stageCode || 'PROD') as CraftStageCode
  const stageDefinition = getProcessStageByCode(stageCode)
  const fallbackRuleSource: RuleSource =
    entry.entryType === 'CRAFT' && (entry.isSpecialCraft || craftDefinition?.isSpecialCraft)
      ? 'OVERRIDE_CRAFT'
      : 'INHERIT_PROCESS'
  const fallbackGranularity = processDefinition?.assignmentGranularity
    || craftDefinition?.assignmentGranularity
    || 'ORDER'
  const fallbackSplitMode = processDefinition?.detailSplitMode
    || craftDefinition?.detailSplitMode
    || 'COMPOSITE'
  const fallbackSplitDimensions = processDefinition?.detailSplitDimensions?.length
    ? processDefinition.detailSplitDimensions
    : craftDefinition?.detailSplitDimensions?.length
      ? craftDefinition.detailSplitDimensions
      : fallbackGranularity === 'SKU' || fallbackGranularity === 'DETAIL'
        ? (['GARMENT_SKU'] as DetailSplitDimension[])
        : fallbackGranularity === 'COLOR'
          ? (['GARMENT_COLOR', 'MATERIAL_SKU'] as DetailSplitDimension[])
          : (['PATTERN', 'MATERIAL_SKU'] as DetailSplitDimension[])
  const resolvedRuleSource = entry.ruleSource || craftDefinition?.ruleSource || fallbackRuleSource
  return {
    orderId,
    orderQty: resolveOrderQty(orderId),
    techPackId: '',
    sourceEntry: entry,
    sourceEntryId: entry.id,
    stageCode,
    stageName: entry.stageName || stageDefinition?.stageName || stageCode,
    stageSort: stageDefinition?.sort ?? 999,
    processCode: entry.processCode,
    processName: entry.processName || processDefinition?.processName || entry.processCode,
    processSort: processDefinition?.sort ?? 999,
    systemProcessCode: processDefinition?.systemProcessCode || craftDefinition?.systemProcessCode || `PROC_${entry.processCode}`,
    craftCode: entry.craftCode,
    craftName: entry.craftName,
    processRole: craftDefinition?.processRole ?? processDefinition?.processRole ?? 'EXTERNAL_TASK',
    parentProcessCode: craftDefinition?.parentProcessCode ?? processDefinition?.parentProcessCode,
    generatesExternalTask: craftDefinition?.generatesExternalTask ?? processDefinition?.generatesExternalTask ?? false,
    requiresTaskQr: craftDefinition?.requiresTaskQr ?? processDefinition?.requiresTaskQr ?? false,
    requiresHandoverOrder: craftDefinition?.requiresHandoverOrder ?? processDefinition?.requiresHandoverOrder ?? false,
    capacityEnabled: craftDefinition?.capacityEnabled ?? processDefinition?.capacityEnabled ?? true,
    capacityRollupMode: craftDefinition?.capacityRollupMode ?? processDefinition?.capacityRollupMode ?? 'NONE',
    factoryMobileExecutionMode:
      craftDefinition?.factoryMobileExecutionMode
      ?? processDefinition?.factoryMobileExecutionMode
      ?? 'NONE',
    isActive: craftDefinition?.isActive ?? processDefinition?.isActive ?? true,
    assignmentGranularity: entry.assignmentGranularity || fallbackGranularity,
    ruleSource: resolvedRuleSource,
    detailSplitMode: entry.detailSplitMode || craftDefinition?.detailSplitMode || fallbackSplitMode,
    detailSplitDimensions: entry.detailSplitDimensions?.length
      ? [...entry.detailSplitDimensions]
      : [...fallbackSplitDimensions],
    defaultDocType: entry.defaultDocType || processDefinition?.defaultDocType || craftDefinition?.defaultDocType || 'TASK',
    taskTypeMode: entry.taskTypeMode || processDefinition?.taskTypeMode || craftDefinition?.taskTypeMode || 'PROCESS',
    isSpecialCraft: entry.isSpecialCraft ?? craftDefinition?.isSpecialCraft ?? false,
    routeStepNo: entry.routeStepNo,
    routeLaneNo: entry.routeLaneNo,
    routeParallelGroupId: entry.routeParallelGroupId,
    routeParallelGroupName: entry.routeParallelGroupName,
    entryIndex,
  }
}

function buildGenerationSortKey(context: ResolvedEntryContext): string {
  return `${String(context.stageSort).padStart(3, '0')}-${String(context.processSort).padStart(3, '0')}-${String(
    context.entryIndex,
  ).padStart(3, '0')}-${context.sourceEntryId}`
}

function buildSortKey(context: ResolvedEntryContext): string {
  if (isPositiveRouteNo(context.routeStepNo) && isPositiveRouteNo(context.routeLaneNo)) {
    return `${String(context.routeStepNo).padStart(6, '0')}-${String(context.routeLaneNo).padStart(6, '0')}-${String(
      context.entryIndex,
    ).padStart(3, '0')}-${context.sourceEntryId}`
  }

  return buildGenerationSortKey(context)
}

function toDemandArtifact(context: ResolvedEntryContext): GeneratedDemandArtifact {
  const demandTypeLabel = `${context.processName}需求单`
  return {
    artifactId: `DEMART-${context.orderId}-${toArtifactKeySegment(context.sourceEntryId)}`,
    artifactType: 'DEMAND',
    orderId: context.orderId,
    techPackId: context.techPackId,
    orderQty: context.orderQty,
    sourceEntryId: context.sourceEntryId,
    sourceEntryType: context.sourceEntry.entryType,
    stageCode: context.stageCode,
    stageName: context.stageName,
    processCode: context.processCode,
    processName: context.processName,
    systemProcessCode: context.systemProcessCode,
    craftCode: context.craftCode,
    craftName: context.craftName,
    assignmentGranularity: context.assignmentGranularity,
    ruleSource: context.ruleSource,
    detailSplitMode: context.detailSplitMode,
    detailSplitDimensions: [...context.detailSplitDimensions],
    defaultDocType: context.defaultDocType,
    taskTypeMode: context.taskTypeMode,
    isSpecialCraft: context.isSpecialCraft,
    routeStepNo: context.routeStepNo,
    routeLaneNo: context.routeLaneNo,
    routeParallelGroupId: context.routeParallelGroupId,
    routeParallelGroupName: context.routeParallelGroupName,
    docTypeLabel: demandTypeLabel,
    demandTypeCode: `DEMAND_${context.processCode}`,
    demandTypeLabel,
    generationSortKey: buildGenerationSortKey(context),
    sortKey: buildSortKey(context),
  }
}

function toTaskArtifact(context: ResolvedEntryContext): GeneratedTaskArtifact {
  const isCraftTask = context.sourceEntry.entryType === 'CRAFT' || context.taskTypeMode === 'CRAFT'
  const taskTypeCode = isCraftTask ? context.craftCode || context.processCode : context.processCode
  const taskTypeLabel = isCraftTask ? context.craftName || context.processName : context.processName
  return {
    artifactId: `TASKART-${context.orderId}-${toArtifactKeySegment(context.sourceEntryId)}`,
    artifactType: 'TASK',
    orderId: context.orderId,
    techPackId: context.techPackId,
    orderQty: context.orderQty,
    sourceEntryId: context.sourceEntryId,
    sourceEntryType: context.sourceEntry.entryType,
    stageCode: context.stageCode,
    stageName: context.stageName,
    processCode: context.processCode,
    processName: context.processName,
    systemProcessCode: context.systemProcessCode,
    craftCode: context.craftCode,
    craftName: context.craftName,
    assignmentGranularity: context.assignmentGranularity,
    ruleSource: context.ruleSource,
    detailSplitMode: context.detailSplitMode,
    detailSplitDimensions: [...context.detailSplitDimensions],
    defaultDocType: context.defaultDocType,
    taskTypeMode: context.taskTypeMode,
    isSpecialCraft: context.isSpecialCraft,
    selectedTargetObject: context.sourceEntry.selectedTargetObject,
    woolTaskType: context.sourceEntry.woolTaskType,
    downstreamTarget: context.sourceEntry.downstreamTarget,
    materialIssueMode: context.sourceEntry.materialIssueMode,
    linkedBomItemIds: context.sourceEntry.linkedBomItemIds ? [...context.sourceEntry.linkedBomItemIds] : undefined,
    linkedPatternIds: context.sourceEntry.linkedPatternIds ? [...context.sourceEntry.linkedPatternIds] : undefined,
    routeStepNo: context.routeStepNo,
    routeLaneNo: context.routeLaneNo,
    routeParallelGroupId: context.routeParallelGroupId,
    routeParallelGroupName: context.routeParallelGroupName,
    docTypeLabel: DOC_TYPE_LABEL.TASK,
    generationSortKey: buildGenerationSortKey(context),
    taskTypeCode,
    taskTypeLabel,
    taskScope: 'EXTERNAL_TASK',
    sortKey: buildSortKey(context),
  }
}

function toPreparationOrderArtifact(context: ResolvedEntryContext): GeneratedPreparationOrderArtifact {
  const typeLabel = `${context.processName}加工单`
  return {
    artifactId: `PREPART-${context.orderId}-${toArtifactKeySegment(context.sourceEntryId)}`,
    artifactType: 'PREPARATION_ORDER',
    orderId: context.orderId,
    techPackId: context.techPackId,
    orderQty: context.orderQty,
    sourceEntryId: context.sourceEntryId,
    sourceEntryType: context.sourceEntry.entryType,
    stageCode: 'PREP',
    stageName: context.stageName,
    processCode: context.processCode,
    processName: context.processName,
    systemProcessCode: context.systemProcessCode,
    craftCode: context.craftCode,
    craftName: context.craftName,
    assignmentGranularity: context.assignmentGranularity,
    ruleSource: context.ruleSource,
    detailSplitMode: context.detailSplitMode,
    detailSplitDimensions: [...context.detailSplitDimensions],
    defaultDocType: 'PREPARATION_ORDER',
    taskTypeMode: context.taskTypeMode,
    isSpecialCraft: false,
    linkedBomItemIds: context.sourceEntry.linkedBomItemIds ? [...context.sourceEntry.linkedBomItemIds] : undefined,
    linkedPatternIds: context.sourceEntry.linkedPatternIds ? [...context.sourceEntry.linkedPatternIds] : undefined,
    routeStepNo: context.routeStepNo,
    routeLaneNo: context.routeLaneNo,
    routeParallelGroupId: context.routeParallelGroupId,
    routeParallelGroupName: context.routeParallelGroupName,
    docTypeLabel: typeLabel,
    preparationOrderTypeCode: context.processCode,
    preparationOrderTypeLabel: typeLabel,
    preparationScope: 'INTERNAL_PREPARATION_ORDER',
    generationSortKey: buildGenerationSortKey(context),
    sortKey: buildSortKey(context),
  }
}

export function calculateBomProcessPlannedQty(
  order: ProductionOrder,
  bomItem: TechPackBomItemSnapshot,
): number {
  const bomLabel = `BOM ${bomItem.id}（${bomItem.materialCode || bomItem.name || bomItem.id}）`
  for (const line of order.demandSnapshot.skuLines) {
    if (!Number.isFinite(line.qty)) {
      throw new Error(`${bomLabel}计划数量计算失败：SKU ${line.skuCode} 数量必须是有限数`)
    }
    if (line.qty < 0) {
      throw new Error(`${bomLabel}计划数量计算失败：SKU ${line.skuCode} 数量必须大于等于 0`)
    }
  }

  const applicableSkuCodes = bomItem.applicableSkuCodes ?? []
  const garmentQty = order.demandSnapshot.skuLines.reduce((sum, line) => {
    if (applicableSkuCodes.length > 0 && !applicableSkuCodes.includes(line.skuCode)) return sum
    return sum + line.qty
  }, 0)
  if (garmentQty <= 0) {
    const reason = applicableSkuCodes.length > 0
      ? '适用 SKU 未匹配到大于 0 的生产数量'
      : '生产数量合计必须大于 0'
    throw new Error(`${bomLabel}计划数量计算失败：${reason}`)
  }
  if (!Number.isFinite(bomItem.unitConsumption)) {
    throw new Error(`${bomLabel}计划数量计算失败：BOM 单位用量必须是有限数`)
  }
  if (bomItem.unitConsumption <= 0) {
    throw new Error(`${bomLabel}计划数量计算失败：BOM 单位用量必须大于 0`)
  }
  if (!Number.isFinite(bomItem.lossRate)) {
    throw new Error(`${bomLabel}计划数量计算失败：BOM 损耗率必须是有限数`)
  }
  if (bomItem.lossRate < 0) {
    throw new Error(`${bomLabel}计划数量计算失败：BOM 损耗率必须大于等于 0`)
  }
  const plannedQty = garmentQty * bomItem.unitConsumption * (1 + bomItem.lossRate / 100)
  if (!Number.isFinite(plannedQty)) {
    throw new Error(`${bomLabel}计划数量计算失败：计划数量必须是有限数`)
  }
  const roundedPlannedQty = Math.round(plannedQty * 1000) / 1000
  if (!Number.isFinite(roundedPlannedQty)) {
    throw new Error(`${bomLabel}计划数量计算失败：计划数量必须是有限数`)
  }
  if (roundedPlannedQty <= 0) {
    throw new Error(`${bomLabel}计划数量计算失败：计划数量必须大于 0`)
  }
  return roundedPlannedQty
}

interface GenerateBomDrivenPrepArtifactsForEntryInput {
  order: ProductionOrder
  snapshot: ProductionOrderTechPackSnapshot
  entry: TechnicalProcessEntry
  entryIndex: number
}

function generateBomDrivenPrepArtifactsForEntry(
  input: GenerateBomDrivenPrepArtifactsForEntryInput,
): GeneratedProductionArtifact[] {
  const { order, snapshot, entry, entryIndex } = input
  if (entry.processCode !== 'WATER_SOLUBLE') return []

  const linkedBomItemIds = [...new Set(entry.linkedBomItemIds ?? [])]
  const bomItemById = new Map(
    selectProductionMaterialBomItems(snapshot.bomItems).map((item) => [item.id, item]),
  )
  const context = resolveEntryContext(order.productionOrderId, entry, entryIndex)
  context.orderQty = order.demandSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0)
  context.techPackId = snapshot.sourceTechPackVersionId

  return linkedBomItemIds.flatMap((bomItemId) => {
    const bomItem = bomItemById.get(bomItemId)
    if (!bomItem) return []

    const requiresWaterSoluble = bomItem.waterSolubleRequirement === '是'
    const requiresDye = bomItem.dyeRequirement && bomItem.dyeRequirement !== '无'
    // 同一面料同时需要水溶和染色时，由一张染色加工单在同一染厂完成；
    // 这里只保留仅水溶场景的独立生产准备加工单。
    if (!requiresWaterSoluble || requiresDye) return []
    if (!bomItem.unit?.trim()) {
      throw new Error(`BOM ${bomItem.id}（${bomItem.materialCode || bomItem.name || bomItem.id}）产物生成失败：BOM 数量单位不能为空`)
    }

    const materialFields = {
      bomItemId: bomItem.id,
      materialCode: bomItem.materialCode || bomItem.id,
      materialName: bomItem.name,
      plannedQty: calculateBomProcessPlannedQty(order, bomItem),
      plannedUnit: bomItem.unit.trim(),
      linkedBomItemIds: [bomItem.id],
    }
    const techPackVersionKey = snapshot.sourceTechPackVersionId
      || snapshot.sourceTechPackVersionCode
      || snapshot.snapshotId
    const artifactKey = [
      order.productionOrderId,
      snapshot.snapshotId,
      techPackVersionKey,
      entry.id,
      bomItem.id,
    ].map(toUnambiguousArtifactIdentitySegment).join('-')
    const bomSortSuffix = toArtifactKeySegment(bomItem.id)

    return [{
      ...toPreparationOrderArtifact(context),
      ...materialFields,
      artifactId: `PREPART-${artifactKey}`,
      defaultDocType: 'PREPARATION_ORDER',
      docTypeLabel: '水溶加工单',
      preparationOrderTypeCode: 'WATER_SOLUBLE',
      preparationOrderTypeLabel: '水溶加工单',
      preparationScope: 'INTERNAL_PREPARATION_ORDER',
      generationSortKey: `${buildGenerationSortKey(context)}-${bomSortSuffix}`,
      sortKey: `${buildSortKey(context)}-${bomSortSuffix}`,
    }]
  })
}

function shouldGenerateExternalTask(context: ResolvedEntryContext): boolean {
  if (!context.isActive) return false
  if (context.stageCode === 'PREP') return false
  if (!context.generatesExternalTask) return false
  if (context.defaultDocType !== 'TASK') return false
  if (context.sourceEntry.entryType === 'CRAFT') return true
  return context.sourceEntry.entryType === 'PROCESS_BASELINE'
}

function resolveTechPackEntriesByOrder(orderId: string): TechPackProcessEntry[] {
  return getProductionOrderProcessEntries(orderId)
}

function dedupeBomDrivenArtifacts(
  artifacts: GeneratedProductionArtifact[],
): GeneratedProductionArtifact[] {
  const seenKeys = new Set<string>()
  return artifacts.filter((artifact) => {
    if (!artifact.bomItemId) return true
    const key = [artifact.artifactType, artifact.processCode, artifact.bomItemId].join('\u0000')
    if (seenKeys.has(key)) return false
    seenKeys.add(key)
    return true
  })
}

export function generateProductionArtifactsForOrder(orderId: string): GeneratedProductionArtifact[] {
  const order = productionOrders.find((item) => item.productionOrderId === orderId)
  const snapshot = getProductionOrderTechPackSnapshot(orderId)
  if (!order || !snapshot || !snapshot.sourceTechPackVersionId) return []
  const techPackId = snapshot.sourceTechPackVersionId

  const entries = resolveTechPackEntriesByOrder(orderId)
  if (!entries.length) return []

  const artifacts: GeneratedProductionArtifact[] = []
  const taskContexts: ResolvedEntryContext[] = []

  entries.forEach((entry, index) => {
    const context = resolveEntryContext(orderId, entry, index)
    context.techPackId = techPackId

    if (context.stageCode === 'PREP') {
      if (context.processCode === 'WATER_SOLUBLE') {
        artifacts.push(...generateBomDrivenPrepArtifactsForEntry({ order, snapshot, entry, entryIndex: index }))
      } else {
        artifacts.push(toPreparationOrderArtifact(context))
      }
      return
    }

    if (shouldGenerateExternalTask(context)) {
      taskContexts.push(context)
    }
  })
  artifacts.push(...taskContexts.map((context) => toTaskArtifact(context)))

  return dedupeBomDrivenArtifacts(artifacts).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

export function generateProductionArtifactBundleForOrder(orderId: string): GeneratedProductionArtifactBundle {
  const artifacts = generateProductionArtifactsForOrder(orderId)
  const attachment: ProductionArtifactSpecialCraftAttachment<GeneratedProductionArtifact> =
    attachSpecialCraftTasksToProductionArtifacts({
      orderId,
      artifacts,
    })

  return {
    orderId,
    artifacts: attachment.artifacts,
    specialCraftTaskOrders: attachment.specialCraftTaskOrders,
    specialCraftGenerationBatch: attachment.specialCraftGenerationBatch,
    specialCraftGenerationErrors: attachment.specialCraftGenerationErrors,
    specialCraftGenerationWarnings: attachment.specialCraftGenerationWarnings,
  }
}

export function generateDemandArtifactsForOrder(orderId: string): GeneratedDemandArtifact[] {
  return generateProductionArtifactsForOrder(orderId).filter(
    (item): item is GeneratedDemandArtifact => item.artifactType === 'DEMAND',
  )
}

export function generateTaskArtifactsForOrder(orderId: string): GeneratedTaskArtifact[] {
  return generateProductionArtifactsForOrder(orderId).filter(
    (item): item is GeneratedTaskArtifact => item.artifactType === 'TASK' && item.stageCode !== 'PREP',
  )
}

export function generatePreparationOrderArtifactsForOrder(orderId: string): GeneratedPreparationOrderArtifact[] {
  return generateProductionArtifactsForOrder(orderId).filter(
    (item): item is GeneratedPreparationOrderArtifact => item.artifactType === 'PREPARATION_ORDER',
  )
}

export function generateProductionArtifactsForAllOrders(): GeneratedProductionArtifact[] {
  return productionOrders
    .flatMap((order) => generateProductionArtifactsForOrder(order.productionOrderId))
    .sort((a, b) => {
      if (a.orderId !== b.orderId) return a.orderId.localeCompare(b.orderId)
      return a.sortKey.localeCompare(b.sortKey)
    })
}

export function generateProductionArtifactBundlesForAllOrders(): GeneratedProductionArtifactBundle[] {
  return productionOrders.map((order) => generateProductionArtifactBundleForOrder(order.productionOrderId))
}

export function generateDemandArtifactsForAllOrders(): GeneratedDemandArtifact[] {
  const generatedArtifacts = generateProductionArtifactsForAllOrders().filter(
    (item): item is GeneratedDemandArtifact => item.artifactType === 'DEMAND',
  )
  const demandDefinitions = listActiveProcessCraftDefinitions().filter((definition) => definition.defaultDocType === 'DEMAND')
  return ensureDictionaryCoverage(
    generatedArtifacts,
    listDictionaryCoverageDemandArtifacts(),
    demandDefinitions,
  )
}

export function listGeneratedProductionDemandArtifacts(): GeneratedDemandArtifact[] {
  return generateDemandArtifactsForAllOrders()
}

export function generateTaskArtifactsForAllOrders(): GeneratedTaskArtifact[] {
  const generatedArtifacts = generateProductionArtifactsForAllOrders().filter((item): item is GeneratedTaskArtifact => item.artifactType === 'TASK' && item.stageCode !== 'PREP')
  const taskDefinitions = listActiveProcessCraftDefinitions().filter((definition) => (
    definition.defaultDocType === 'TASK'
    && definition.stageCode !== 'PREP'
    && !['CUT_PANEL', 'SEW', 'BUTTONHOLE', 'BUTTON_ATTACH', 'IRON_PACK'].includes(definition.processCode)
  ))
  return ensureDictionaryCoverage(
    generatedArtifacts,
    listDictionaryCoverageTaskArtifacts(),
    taskDefinitions,
  )
}

export function listGeneratedProductionTaskArtifacts(): GeneratedTaskArtifact[] {
  return generateTaskArtifactsForAllOrders()
}

export function listGeneratedProductionPreparationOrderArtifacts(): GeneratedPreparationOrderArtifact[] {
  return generateProductionArtifactsForAllOrders().filter(
    (item): item is GeneratedPreparationOrderArtifact => item.artifactType === 'PREPARATION_ORDER',
  )
}

export function listGeneratedSpecialCraftTaskArtifacts(): SpecialCraftTaskOrder[] {
  return generateProductionArtifactBundlesForAllOrders().flatMap((bundle) => bundle.specialCraftTaskOrders)
}

export const artifactGenerationScenarioOrderIds = {
  prepOnly: 'PO-202603-0014',
  normalProduction: 'PO-202603-0002',
  specialCraft: 'PO-202603-0015',
  postProcess: 'PO-202603-0002',
  mixed: 'PO-202603-0015',
} as const

export function listArtifactGenerationScenarioArtifacts(): Record<
  keyof typeof artifactGenerationScenarioOrderIds,
  GeneratedProductionArtifact[]
> {
  return {
    prepOnly: generateProductionArtifactsForOrder(artifactGenerationScenarioOrderIds.prepOnly),
    normalProduction: generateProductionArtifactsForOrder(artifactGenerationScenarioOrderIds.normalProduction),
    specialCraft: generateProductionArtifactsForOrder(artifactGenerationScenarioOrderIds.specialCraft),
    postProcess: generateProductionArtifactsForOrder(artifactGenerationScenarioOrderIds.postProcess),
    mixed: generateProductionArtifactsForOrder(artifactGenerationScenarioOrderIds.mixed),
  }
}
