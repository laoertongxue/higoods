import { productionOrders } from './production-orders.ts'
import { resolveReleasedTechPackForProductionOrder } from './production-upstream-chain.ts'
import {
  getProcessCraftByCode,
  getProcessDefinitionByCode,
  getProcessStageByCode,
  type CraftStageCode,
  type DetailSplitDimension,
  type DetailSplitMode,
  type ProcessAssignmentGranularity,
  type ProcessDocType,
  type RuleSource,
  type TaskTypeMode,
} from './process-craft-dict.ts'
import {
  listTechnicalProcessEntriesBySpuCode as listTechPackProcessEntries,
  type TechPackProcessEntry,
  type TechPackProcessEntryType,
} from '../pcs-technical-data-runtime-source.ts'

export type ProductionArtifactType = 'DEMAND' | 'TASK'

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
  docTypeLabel: string
  sortKey: string
}

export interface GeneratedDemandArtifact extends GeneratedProductionArtifactBase {
  artifactType: 'DEMAND'
  demandTypeCode: string
  demandTypeLabel: string
}

export interface GeneratedTaskArtifact extends GeneratedProductionArtifactBase {
  artifactType: 'TASK'
  taskTypeCode: string
  taskTypeLabel: string
  publishedSamPerUnit: number
  publishedSamUnit: string
  publishedSamDifficulty: 'LOW' | 'MEDIUM' | 'HIGH'
  publishedSamSource: 'TECH_PACK_PROCESS_ENTRY'
}

export type GeneratedProductionArtifact = GeneratedDemandArtifact | GeneratedTaskArtifact
export type ProductionDemandArtifact = GeneratedDemandArtifact
export type ProductionTaskArtifact = GeneratedTaskArtifact

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
  assignmentGranularity: ProcessAssignmentGranularity
  ruleSource: RuleSource
  detailSplitMode: DetailSplitMode
  detailSplitDimensions: DetailSplitDimension[]
  defaultDocType: ProcessDocType
  taskTypeMode: TaskTypeMode
  isSpecialCraft: boolean
  publishedSamPerUnit: number
  publishedSamUnit: string
  publishedSamDifficulty: 'LOW' | 'MEDIUM' | 'HIGH'
  publishedSamSource: 'TECH_PACK_PROCESS_ENTRY'
  entryIndex: number
}

const DOC_TYPE_LABEL: Record<ProcessDocType, string> = {
  DEMAND: '需求单',
  TASK: '任务单',
}

const DEMAND_TYPE_LABEL_BY_PROCESS_CODE: Record<string, string> = {
  PRINT: '印花需求单',
  DYE: '染色需求单',
}

function toArtifactKeySegment(entryId: string): string {
  return entryId.replace(/[^A-Za-z0-9_-]/g, '_')
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
  const publishedSamPerUnit = Number.isFinite(entry.standardTimeMinutes)
    ? Number(entry.standardTimeMinutes)
    : 0
  const publishedSamUnit = entry.timeUnit?.trim() || '分钟/件'
  const publishedSamDifficulty = entry.difficulty || 'MEDIUM'

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
    assignmentGranularity: entry.assignmentGranularity || fallbackGranularity,
    ruleSource: resolvedRuleSource,
    detailSplitMode: entry.detailSplitMode || craftDefinition?.detailSplitMode || fallbackSplitMode,
    detailSplitDimensions: entry.detailSplitDimensions?.length
      ? [...entry.detailSplitDimensions]
      : [...fallbackSplitDimensions],
    defaultDocType: entry.defaultDocType || processDefinition?.defaultDocType || craftDefinition?.defaultDocType || 'TASK',
    taskTypeMode: entry.taskTypeMode || processDefinition?.taskTypeMode || craftDefinition?.taskTypeMode || 'PROCESS',
    isSpecialCraft: entry.isSpecialCraft ?? craftDefinition?.isSpecialCraft ?? false,
    publishedSamPerUnit,
    publishedSamUnit,
    publishedSamDifficulty,
    publishedSamSource: 'TECH_PACK_PROCESS_ENTRY',
    entryIndex,
  }
}

function buildSortKey(context: ResolvedEntryContext): string {
  return `${String(context.stageSort).padStart(3, '0')}-${String(context.processSort).padStart(3, '0')}-${String(
    context.entryIndex,
  ).padStart(3, '0')}-${context.sourceEntryId}`
}

function toDemandArtifact(context: ResolvedEntryContext): GeneratedDemandArtifact {
  const demandTypeLabel = DEMAND_TYPE_LABEL_BY_PROCESS_CODE[context.processCode] ?? `${context.processName}需求单`
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
    docTypeLabel: demandTypeLabel,
    demandTypeCode: `DEMAND_${context.processCode}`,
    demandTypeLabel,
    sortKey: buildSortKey(context),
  }
}

function toTaskArtifact(context: ResolvedEntryContext): GeneratedTaskArtifact {
  const taskTypeCode = context.isSpecialCraft ? context.craftCode || context.processCode : context.processCode
  const taskTypeLabel = context.isSpecialCraft ? context.craftName || context.processName : context.processName
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
    docTypeLabel: DOC_TYPE_LABEL.TASK,
    taskTypeCode,
    taskTypeLabel,
    publishedSamPerUnit: context.publishedSamPerUnit,
    publishedSamUnit: context.publishedSamUnit,
    publishedSamDifficulty: context.publishedSamDifficulty,
    publishedSamSource: context.publishedSamSource,
    sortKey: buildSortKey(context),
  }
}

function shouldGenerateDemand(entry: TechPackProcessEntry, context: ResolvedEntryContext): boolean {
  return (
    entry.entryType === 'PROCESS_BASELINE' &&
    context.stageCode === 'PREP' &&
    context.defaultDocType === 'DEMAND' &&
    (context.processCode === 'PRINT' || context.processCode === 'DYE')
  )
}

function shouldGenerateTask(entry: TechPackProcessEntry, context: ResolvedEntryContext): boolean {
  return entry.entryType === 'CRAFT' && context.defaultDocType === 'TASK' && (context.stageCode === 'PROD' || context.stageCode === 'POST')
}

function resolveTechPackIdByOrder(orderId: string): string | null {
  return resolveReleasedTechPackForProductionOrder(orderId)?.spuCode ?? null
}

function resolveTechPackEntriesByOrder(orderId: string): TechPackProcessEntry[] {
  const techPack = resolveReleasedTechPackForProductionOrder(orderId)
  if (!techPack) return []
  return listTechPackProcessEntries(techPack.spuCode)
}

export function generateProductionArtifactsForOrder(orderId: string): GeneratedProductionArtifact[] {
  const techPackId = resolveTechPackIdByOrder(orderId)
  if (!techPackId) return []

  const entries = resolveTechPackEntriesByOrder(orderId)
  if (!entries.length) return []

  const artifacts: GeneratedProductionArtifact[] = []

  entries.forEach((entry, index) => {
    const context = resolveEntryContext(orderId, entry, index)
    context.techPackId = techPackId

    if (shouldGenerateDemand(entry, context)) {
      artifacts.push(toDemandArtifact(context))
      return
    }

    if (shouldGenerateTask(entry, context)) {
      artifacts.push(toTaskArtifact(context))
    }
  })

  return artifacts.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

export function generateDemandArtifactsForOrder(orderId: string): GeneratedDemandArtifact[] {
  return generateProductionArtifactsForOrder(orderId).filter(
    (item): item is GeneratedDemandArtifact => item.artifactType === 'DEMAND',
  )
}

export function generateTaskArtifactsForOrder(orderId: string): GeneratedTaskArtifact[] {
  return generateProductionArtifactsForOrder(orderId).filter(
    (item): item is GeneratedTaskArtifact => item.artifactType === 'TASK',
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

export function generateDemandArtifactsForAllOrders(): GeneratedDemandArtifact[] {
  return generateProductionArtifactsForAllOrders().filter(
    (item): item is GeneratedDemandArtifact => item.artifactType === 'DEMAND',
  )
}

export function listGeneratedProductionDemandArtifacts(): GeneratedDemandArtifact[] {
  return generateDemandArtifactsForAllOrders()
}

export function generateTaskArtifactsForAllOrders(): GeneratedTaskArtifact[] {
  return generateProductionArtifactsForAllOrders().filter((item): item is GeneratedTaskArtifact => item.artifactType === 'TASK')
}

export function listGeneratedProductionTaskArtifacts(): GeneratedTaskArtifact[] {
  return generateTaskArtifactsForAllOrders()
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
