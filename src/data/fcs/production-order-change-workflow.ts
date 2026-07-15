import { listMaterialArchives } from '../pcs-material-archive-repository.ts'
import {
  getProductionOrderChangeCurrentFacts,
  listCurrentFormalVersionDemandCoverage,
  listProductionOrderTechPackRelations,
  type ProductionOrderChangeCurrentFacts,
} from './production-tech-pack-change-domain.ts'
import { productionOrders, type ProductionOrderStatus } from './production-orders.ts'
import {
  buildFormalProductionOrderProcessSnapshots,
  prepareSyncProcessWorkOrdersAfterProductionOrderChanges,
  type FormalProductionOrderProcessSnapshot,
} from './production-process-work-order-service.ts'

export type ProductionChangeType = 'QUANTITY_CHANGE' | 'MATERIAL_REPLACEMENT'

export type ProductionChangeResult = 'PRODUCTION_PATCH' | 'VERSION_RELATION' | 'VERSION_AND_PATCH'

export interface ProductionChangeTechPackIdentity {
  techPackVersionId: string
  techPackVersionLabel: string
}

export function predictProductionChangeTechPackIdentity(input: {
  result: ProductionChangeResult
  currentTechPackVersionId: string
  currentTechPackVersionLabel: string
  latestPublishedTechPackVersionId: string
  latestPublishedTechPackVersionLabel: string
}): ProductionChangeTechPackIdentity {
  const usesLatestPublishedVersion = input.result === 'VERSION_RELATION' || input.result === 'VERSION_AND_PATCH'
  return usesLatestPublishedVersion
    ? {
        techPackVersionId: input.latestPublishedTechPackVersionId,
        techPackVersionLabel: input.latestPublishedTechPackVersionLabel,
      }
    : {
        techPackVersionId: input.currentTechPackVersionId,
        techPackVersionLabel: input.currentTechPackVersionLabel,
      }
}

export type MaterialReplacementMode = 'REMAINING' | 'FULL'

export type MaterialReplacementScope = 'CURRENT_ONLY' | 'CURRENT_AND_FOLLOWING'

export type ProductionChangePlanItemKind = 'AUTO' | 'MERCHANDISER_DECISION'

export interface QuantityChangeLine {
  id: string
  skuCode: string
  color: string
  size: string
  originalQty: number
  currentQty: number
  targetQty: number
  unit: '件'
  isNew: boolean
  coveredByCurrentVersion: boolean
}

export interface LegacyQuantityChangeLine {
  color: string
  size: string
  currentQty: number
  newQty: number
  unit: string
}

export interface LegacyQuantityEditAdaptation {
  quantityLines: QuantityChangeLine[]
  unmatchedLegacyLines: LegacyQuantityChangeLine[]
}

export interface MaterialReplacementAllocation {
  id: string
  skuCode: string
  color: string
  size: string
  demandQty: number
  oldMaterialFactQty: number
  suggestedReplacementQty: number
  confirmedReplacementQty: number
}

export interface MaterialReplacementDraft {
  originalMaterialId: string
  replacementMaterialId: string
  replacementMode: MaterialReplacementMode
  scope: MaterialReplacementScope
  suggestedProductionQty: number
  confirmedProductionQty: number
  allocations: MaterialReplacementAllocation[]
  followingOrders: Array<{
    productionOrderId: string
    progressText: string
    started: boolean
    suggestedMode: MaterialReplacementMode
    confirmedMode: MaterialReplacementMode
    changeable?: boolean
    affectedDocumentNos?: string[]
  }>
}

export interface ProductionChangeMaterialIdentity {
  factId: string
  sourceTechPackVersionId: string
  sourceBomItemId: string
  canonicalMaterialId: string
}

export function resolveProductionChangeMaterialIdentity(
  productionOrderId: string,
  materialFactId: string,
): ProductionChangeMaterialIdentity | null {
  const fact = getProductionOrderChangeCurrentFacts(productionOrderId)?.materialFacts
    .find((item) => item.id === materialFactId)
  if (
    !fact?.sourceTechPackVersionId?.trim()
    || !fact.sourceBomItemId?.trim()
    || !fact.canonicalMaterialId?.trim()
  ) return null
  return {
    factId: fact.id,
    sourceTechPackVersionId: fact.sourceTechPackVersionId,
    sourceBomItemId: fact.sourceBomItemId,
    canonicalMaterialId: fact.canonicalMaterialId,
  }
}

type FollowingOrderPlan = MaterialReplacementDraft['followingOrders'][number]

interface FollowingOrderScenarioSeed {
  productionOrderId: string
  progressText: string
  orderStatus: ProductionOrderStatus
  affectedDocumentNos?: string[]
}

// 当前共享技术包关系 Mock 暂无同 SPU 多生产单；这组模块内种子仅覆盖生产单变更的已开工/未开工后续单场景。
const PRODUCTION_CHANGE_FOLLOWING_ORDER_SCENARIO_SEEDS: Record<string, FollowingOrderScenarioSeed[]> = {
  'PO-202603-0004': [
    {
      productionOrderId: 'PO-202603-0101',
      progressText: '已领料 900 yard；已裁剪 120 件',
      orderStatus: 'EXECUTING',
      affectedDocumentNos: ['WLS-PL-260306-101', 'CUT-260306-101-01'],
    },
    {
      productionOrderId: 'PO-202603-0102',
      progressText: '尚未开始',
      orderStatus: 'READY_FOR_BREAKDOWN',
      affectedDocumentNos: [],
    },
  ],
}

function normalizeDemandKeyPart(value: string): string {
  return value.normalize('NFKC').trim().toUpperCase()
}

function createDemandCoverageKey(line: Pick<QuantityChangeLine, 'skuCode' | 'color' | 'size'>): string {
  return [line.skuCode, line.color, line.size].map(normalizeDemandKeyPart).join('\u0000')
}

export function isQuantityLineCoveredByCurrentFormalVersion(
  productionOrderId: string,
  line: Pick<QuantityChangeLine, 'skuCode' | 'color' | 'size'>,
): boolean {
  const formalVersionKeys = listCurrentFormalVersionDemandCoverage(productionOrderId)
    .map(createDemandCoverageKey)
  return new Set(formalVersionKeys)
    .has(createDemandCoverageKey(line))
}

export function createEmptyMaterialReplacementDraft(): MaterialReplacementDraft {
  return {
    originalMaterialId: '',
    replacementMaterialId: '',
    replacementMode: 'REMAINING',
    scope: 'CURRENT_ONLY',
    suggestedProductionQty: 0,
    confirmedProductionQty: 0,
    allocations: [],
    followingOrders: [],
  }
}

export function createQuantityLinesForOrder(productionOrderId: string): QuantityChangeLine[] {
  const facts = getProductionOrderChangeCurrentFacts(productionOrderId)
  if (!facts) return []

  return facts.demandQuantityFacts.map((fact) => ({
    id: fact.id,
    skuCode: fact.skuCode,
    color: fact.color,
    size: fact.size,
    originalQty: fact.originalDemandQty,
    currentQty: fact.currentDemandQty,
    targetQty: fact.currentDemandQty,
    unit: '件',
    isNew: false,
    coveredByCurrentVersion: true,
  }))
}

const COLOR_ALIASES: Record<string, string> = {
  BLACK: 'BLACK',
  黑: 'BLACK',
  黑色: 'BLACK',
  NAVY: 'NAVY',
  NAVYBLUE: 'NAVY',
  藏青: 'NAVY',
  藏青色: 'NAVY',
  WHITE: 'WHITE',
  白: 'WHITE',
  白色: 'WHITE',
}

function normalizeQuantityColor(color: string): string {
  const normalized = color.normalize('NFKC').trim().toUpperCase().replace(/[\s_-]+/g, '')
  return COLOR_ALIASES[normalized] ?? normalized
}

function normalizeQuantitySize(size: string): string {
  return size.normalize('NFKC').trim().toUpperCase()
}

export function adaptLegacyQuantityLinesForEdit(
  productionOrderId: string,
  legacyLines: LegacyQuantityChangeLine[],
): LegacyQuantityEditAdaptation {
  const quantityLines = createQuantityLinesForOrder(productionOrderId).map((line) => ({ ...line }))
  const currentLineByCombination = new Map(
    quantityLines.map((line) => [
      `${normalizeQuantityColor(line.color)}\u0000${normalizeQuantitySize(line.size)}`,
      line,
    ]),
  )
  const unmatchedLegacyLines: LegacyQuantityChangeLine[] = []

  legacyLines.forEach((legacyLine) => {
    const combinationKey = `${normalizeQuantityColor(legacyLine.color)}\u0000${normalizeQuantitySize(legacyLine.size)}`
    const currentLine = currentLineByCombination.get(combinationKey)
    if (!currentLine) {
      unmatchedLegacyLines.push({ ...legacyLine })
      return
    }

    const currentQty = Number.isFinite(legacyLine.currentQty) ? Math.round(legacyLine.currentQty) : 0
    const newQty = Number.isFinite(legacyLine.newQty) ? Math.round(legacyLine.newQty) : currentQty
    currentLine.targetQty = Math.max(currentLine.targetQty + (newQty - currentQty), 0)
  })

  return { quantityLines, unmatchedLegacyLines }
}

export const LEGACY_ORIGINAL_MATERIAL_PREFIX = 'legacy-original:'
export const LEGACY_REPLACEMENT_MATERIAL_PREFIX = 'legacy-replacement:'

export function createLegacyMaterialValue(prefix: string, text: string): string {
  return `${prefix}${encodeURIComponent(text)}`
}

export function readLegacyMaterialText(value: string): string {
  const prefix = [LEGACY_ORIGINAL_MATERIAL_PREFIX, LEGACY_REPLACEMENT_MATERIAL_PREFIX]
    .find((candidate) => value.startsWith(candidate))
  if (!prefix) return ''
  try {
    return decodeURIComponent(value.slice(prefix.length))
  } catch {
    return value.slice(prefix.length)
  }
}

function normalizeMaterialIdentityText(text: string): string {
  return text
    .normalize('NFKC')
    .trim()
    .replace(/^(主面料|原面料|替代物料|新面料)\s*[:：]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function extractMaterialCode(text: string): string {
  return text.match(/\b(?:MAT-)?(?:FAB|ACC|DYE)[-_][A-Z0-9-]+\b/i)?.[0]?.toUpperCase() ?? ''
}

export function getMaterialIdentity(
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  const legacyText = readLegacyMaterialText(value)
  const option = options.find((item) => item.value === value)
  const sourceText = legacyText || option?.label || value
  const code = extractMaterialCode(`${value} ${sourceText}`)
  if (code) return `code:${code}`
  const identityText = normalizeMaterialIdentityText(sourceText)
  return identityText ? `text:${identityText}` : ''
}

export function areMaterialSelectionsEquivalent(
  originalValue: string,
  originalOptions: Array<{ value: string; label: string }>,
  replacementValue: string,
  replacementOptions: Array<{ value: string; label: string }>,
): boolean {
  if (!originalValue || !replacementValue) return false
  const originalIdentity = getMaterialIdentity(originalValue, originalOptions)
  const replacementIdentity = getMaterialIdentity(replacementValue, replacementOptions)
  return Boolean(originalIdentity && originalIdentity === replacementIdentity)
}

export function resolveLegacyMaterialValue(
  text: string,
  options: Array<{ value: string; label: string }>,
  legacyPrefix: string,
): string {
  const legacyValue = createLegacyMaterialValue(legacyPrefix, text)
  const legacyIdentity = getMaterialIdentity(legacyValue, [])
  const matched = options.find((option) => getMaterialIdentity(option.value, options) === legacyIdentity)
  if (matched) return matched.value

  const normalizedText = normalizeMaterialIdentityText(text)
  const nameMatched = options.find((option) => {
    const normalizedLabel = normalizeMaterialIdentityText(option.label.split(' / ')[0])
    return normalizedLabel.includes(normalizedText) || normalizedText.includes(normalizedLabel)
  })
  return nameMatched?.value ?? legacyValue
}

export function listReplacementMaterialOptions(): Array<{ value: string; label: string }> {
  const options = listMaterialArchives('fabric').map((material) => ({
    value: material.materialId.trim(),
    label: `${material.materialCode} / ${material.materialName}`,
  }))
  const uniqueOptions = new Map<string, { value: string; label: string }>()
  options.forEach((option) => {
    if (option.value && !uniqueOptions.has(option.value)) uniqueOptions.set(option.value, option)
  })
  return Array.from(uniqueOptions.values())
}

export function listAffectedDocumentNosForOrder(productionOrderId: string): string[] {
  const documentNos = getProductionOrderChangeCurrentFacts(productionOrderId)?.documentFacts
    .map((fact) => fact.documentNo.trim())
    .filter(Boolean) ?? []
  return Array.from(new Set(documentNos))
}

const CLOSED_PRODUCTION_ORDER_STATUSES = new Set<ProductionOrderStatus>(['COMPLETED', 'CANCELLED'])
const STARTED_PRODUCTION_ORDER_STATUSES = new Set<ProductionOrderStatus>(['EXECUTING', 'ON_HOLD'])

function resolveFollowingOrderStateFromOrderStatus(orderStatus: ProductionOrderStatus): {
  changeable: boolean
  started: boolean
} {
  return {
    changeable: !CLOSED_PRODUCTION_ORDER_STATUSES.has(orderStatus),
    started: STARTED_PRODUCTION_ORDER_STATUSES.has(orderStatus),
  }
}

export function resolveFollowingOrderStateFromProgressFallback(progressTexts: string[]): {
  changeable: boolean
  started: boolean
} {
  const hasExplicitWholeOrderClosure = progressTexts.some(
    (text) => {
      const normalizedText = text.trim()
      return (
        normalizedText === '已完成' ||
        normalizedText === '已结算' ||
        /(整单|生产单).*(已完成|已结算)/.test(normalizedText) ||
        normalizedText.includes('已完成并结算') ||
        normalizedText.includes('已全部结算')
      )
    },
  )
  if (hasExplicitWholeOrderClosure) return { changeable: false, started: true }

  const hasStartedFact = progressTexts.some(
    (text) =>
      ['已配', '已领', '已裁', '加工中', '已加工', '已交出', '已生成', '已铺布'].some((marker) =>
        text.includes(marker),
      ) || /(配料|领料|裁片|印花|染色|加工|车缝|后道).*已完成/.test(text),
  )
  return { changeable: true, started: hasStartedFact }
}

export function createFollowingOrderPlans(
  productionOrderId: string,
): MaterialReplacementDraft['followingOrders'] {
  const relations = listProductionOrderTechPackRelations()
  const currentRelation = relations.find((relation) => relation.productionOrderId === productionOrderId)
  if (!currentRelation) return []

  const uniquePlans = new Map<string, FollowingOrderPlan>()
  const blockedOrderIds = new Set<string>()
  const productionOrderById = new Map(productionOrders.map((order) => [order.productionOrderId, order]))
  relations.forEach((relation) => {
    const orderId = relation.productionOrderId.trim()
    if (!orderId || orderId === productionOrderId || relation.spuId !== currentRelation.spuId) return

    const progressTexts = [...relation.progressSummary, ...relation.restrictionSummary]
    const productionOrder = productionOrderById.get(orderId)
    const orderState = productionOrder
      ? resolveFollowingOrderStateFromOrderStatus(productionOrder.status)
      : resolveFollowingOrderStateFromProgressFallback(progressTexts)
    if (!orderState.changeable) {
      blockedOrderIds.add(orderId)
      return
    }

    const started = orderState.started
    const suggestedMode: MaterialReplacementMode = started ? 'REMAINING' : 'FULL'
    const progressText = relation.progressSummary.join('；') || '尚未开始'
    if (!uniquePlans.has(orderId)) {
      uniquePlans.set(orderId, {
        productionOrderId: orderId,
        progressText,
        started,
        suggestedMode,
        confirmedMode: suggestedMode,
        changeable: true,
        affectedDocumentNos: listAffectedDocumentNosForOrder(orderId),
      })
    }
  })

  ;(PRODUCTION_CHANGE_FOLLOWING_ORDER_SCENARIO_SEEDS[productionOrderId] ?? []).forEach((seed) => {
    const orderId = seed.productionOrderId.trim()
    const orderState = resolveFollowingOrderStateFromOrderStatus(seed.orderStatus)
    if (!orderId || blockedOrderIds.has(orderId) || uniquePlans.has(orderId) || !orderState.changeable) return
    const suggestedMode: MaterialReplacementMode = orderState.started ? 'REMAINING' : 'FULL'
    uniquePlans.set(orderId, {
      productionOrderId: orderId,
      progressText: seed.progressText,
      started: orderState.started,
      suggestedMode,
      confirmedMode: suggestedMode,
      changeable: orderState.changeable,
      affectedDocumentNos: sanitizeObjectIds(seed.affectedDocumentNos),
    })
  })
  return Array.from(uniquePlans.values())
}

export function buildMaterialReplacementAllocations(
  productionOrderId: string,
  confirmedProductionQty: number,
): MaterialReplacementAllocation[] {
  const quantityLines = createQuantityLinesForOrder(productionOrderId)
  const demandFacts = getProductionOrderChangeCurrentFacts(productionOrderId)?.demandQuantityFacts ?? []
  const demandFactById = new Map(demandFacts.map((fact) => [fact.id, fact]))
  if (quantityLines.length === 0) return []

  const allocations = quantityLines.map((line, index) => {
    const normalizedDemandQty = Number.isFinite(line.currentQty) ? Math.round(line.currentQty) : 0
    const demandQty = Math.max(0, normalizedDemandQty)
    const executedQty = demandFactById.get(line.id)?.executedQty ?? 0
    const oldMaterialFactQty = Math.min(Math.max(Math.round(executedQty), 0), demandQty)
    return {
      id: `${productionOrderId}-ALLOC-${index + 1}`,
      skuCode: line.skuCode,
      color: line.color,
      size: line.size,
      demandQty,
      oldMaterialFactQty,
      suggestedReplacementQty: Math.max(demandQty - oldMaterialFactQty, 0),
      confirmedReplacementQty: 0,
    }
  })
  const totalDemandQty = allocations.reduce((sum, line) => sum + line.demandQty, 0)
  const normalizedConfirmedQty = Number.isFinite(confirmedProductionQty) ? Math.round(confirmedProductionQty) : 0
  const limitedConfirmedQty = Math.min(Math.max(normalizedConfirmedQty, 0), totalDemandQty)
  const totalSuggestedQty = allocations.reduce((sum, line) => sum + line.suggestedReplacementQty, 0)

  let allocatedQty = 0
  allocations.forEach((line, index) => {
    if (index === allocations.length - 1) return
    const proportionalQty = totalSuggestedQty > 0
      ? Math.floor((limitedConfirmedQty * line.suggestedReplacementQty) / totalSuggestedQty)
      : 0
    line.confirmedReplacementQty = Math.min(proportionalQty, line.demandQty)
    allocatedQty += line.confirmedReplacementQty
  })

  const lastLine = allocations[allocations.length - 1]
  lastLine.confirmedReplacementQty = Math.min(limitedConfirmedQty - allocatedQty, lastLine.demandQty)
  allocatedQty += lastLine.confirmedReplacementQty

  let remainder = limitedConfirmedQty - allocatedQty
  allocations.forEach((line) => {
    if (remainder <= 0) return
    const availableQty = line.demandQty - line.confirmedReplacementQty
    const addedQty = Math.min(availableQty, remainder)
    line.confirmedReplacementQty += addedQty
    remainder -= addedQty
  })

  return allocations
}

export interface NormalizedMaterialReplacementAllocations {
  allocations: MaterialReplacementAllocation[]
  confirmedProductionQty: number
  totalDemandQty: number
  wasNormalized: boolean
}

export function normalizeMaterialReplacementAllocations(
  productionOrderId: string,
  existingAllocations: MaterialReplacementAllocation[],
  confirmedProductionQty: number,
): NormalizedMaterialReplacementAllocations {
  const canonicalAllocations = buildMaterialReplacementAllocations(productionOrderId, confirmedProductionQty)
  const totalDemandQty = canonicalAllocations.reduce((sum, line) => sum + line.demandQty, 0)
  const normalizedConfirmedQty = canonicalAllocations.reduce(
    (sum, line) => sum + line.confirmedReplacementQty,
    0,
  )
  if (existingAllocations.length === 0) {
    return {
      allocations: canonicalAllocations,
      confirmedProductionQty: normalizedConfirmedQty,
      totalDemandQty,
      wasNormalized: false,
    }
  }

  const existingById = new Map(existingAllocations.map((line) => [line.id, line]))
  const existingByCombination = new Map(
    existingAllocations.map((line) => [`${line.skuCode}\u0000${line.color}\u0000${line.size}`, line]),
  )
  const matchedExistingIds = new Set<string>()
  let valueWasNormalized = Number(confirmedProductionQty) !== normalizedConfirmedQty

  const normalizedExisting = canonicalAllocations.map((canonicalLine) => {
    const combinationKey = `${canonicalLine.skuCode}\u0000${canonicalLine.color}\u0000${canonicalLine.size}`
    const existingLine = existingById.get(canonicalLine.id) ?? existingByCombination.get(combinationKey)
    if (!existingLine) return { ...canonicalLine, confirmedReplacementQty: 0 }
    matchedExistingIds.add(existingLine.id)

    const rawQty = Number(existingLine.confirmedReplacementQty)
    const integerQty = Number.isFinite(rawQty) ? Math.round(rawQty) : 0
    const limitedQty = Math.min(Math.max(integerQty, 0), canonicalLine.demandQty)
    if (rawQty !== limitedQty) valueWasNormalized = true
    return { ...canonicalLine, confirmedReplacementQty: limitedQty }
  })
  const existingTotal = normalizedExisting.reduce((sum, line) => sum + line.confirmedReplacementQty, 0)
  const hasUnknownAllocation = existingAllocations.some((line) => !matchedExistingIds.has(line.id))

  if (!hasUnknownAllocation && existingTotal === normalizedConfirmedQty) {
    return {
      allocations: normalizedExisting,
      confirmedProductionQty: normalizedConfirmedQty,
      totalDemandQty,
      wasNormalized: valueWasNormalized,
    }
  }

  return {
    allocations: canonicalAllocations,
    confirmedProductionQty: normalizedConfirmedQty,
    totalDemandQty,
    wasNormalized: true,
  }
}

export interface ProductionChangeDraft {
  productionOrderId: string
  changeType: ProductionChangeType
  reason: string
  quantityLines: QuantityChangeLine[]
  materialReplacement: MaterialReplacementDraft | null
  decisionValues: Record<string, { value: string; reason: string }>
  affectedDocumentNos?: string[]
}

export function getProductionChangeDecisionSuggestedValue(
  draft: ProductionChangeDraft,
  decisionId: string,
): string | undefined {
  return draft.materialReplacement?.followingOrders.find(
    (order) => `following-order-mode-${order.productionOrderId}` === decisionId,
  )?.suggestedMode
}

export const productionChangeResultLabels: Record<ProductionChangeResult, string> = {
  PRODUCTION_PATCH: '生产单打补丁',
  VERSION_RELATION: '正式版本绑定调整',
  VERSION_AND_PATCH: '生产单打补丁 + 正式版本绑定调整',
}

export interface ProductionChangePlanItem {
  id: string
  kind: ProductionChangePlanItemKind
  group: '需求与物料' | '上下游单据' | '实物去向' | '成本与交期'
  title: string
  description: string
  affectedDocumentNo: string
  options: Array<{ value: string; label: string }>
  selectedValue: string
  reason: string
  reasonRequired: boolean
}

export interface ProductionChangeExecutionStep {
  id: string
  label: string
  status: 'WAITING' | 'RUNNING' | 'DONE' | 'ROLLED_BACK'
}

export interface ProductionChangeExecutionResult {
  status: 'DONE' | 'ROLLED_BACK'
  message: string
  progress: number
  steps: ProductionChangeExecutionStep[]
  lockObjectIds: string[]
  result: ProductionChangeResult
  resultLabel: string
}

export interface ProductionChangeExecutionOptions {
  shouldFail?: boolean
  onProgress?: (progress: number, result: ProductionChangeExecutionResult) => void
  onStep?: (step: ProductionChangeExecutionStep, result: ProductionChangeExecutionResult) => void
  persist?: (result: ProductionChangeExecutionResult) => ProductionChangeExecutionResult | void
  processWorkOrderSnapshots?: FormalProductionOrderProcessSnapshot[] | (() => FormalProductionOrderProcessSnapshot[])
  changeRecordId?: string
  processWorkOrderSyncRecordedAt?: string
}

export interface ProductionChangePreview {
  result: ProductionChangeResult
  resultReason: string
  factsFingerprint: string
  affectedOrderIds: string[]
  autoItems: ProductionChangePlanItem[]
  decisionItems: ProductionChangePlanItem[]
  summary: {
    affectedOrderCount: number
    affectedDocumentCount: number
    materialDeltaText: string
    costDeltaText: string
    deliveryImpactText: string
  }
  lockObjectIds: string[]
}

export type ProductionChangeStatus = 'DRAFT' | 'READY' | 'EXECUTING' | 'DONE' | 'ROLLED_BACK'

export const productionChangeStatusLabels: Record<ProductionChangeStatus, string> = {
  DRAFT: '草稿',
  READY: '待确认执行',
  EXECUTING: '同步执行中',
  DONE: '已完成',
  ROLLED_BACK: '已回滚',
}

export interface ProductionChangeDocumentTrace {
  changeOrderId: string
  documentNo: string
  documentTypeLabel: string
  beforeText: string
  afterText: string
  handlingText: string
  executedAt: string
}

export interface ProductionChangeRecord extends ProductionChangeDraft {
  id: string
  result: ProductionChangeResult
  resultReason: string
  status: ProductionChangeStatus
  preview: ProductionChangePreview
  execution: {
    status: 'IDLE' | 'RUNNING' | 'DONE' | 'ROLLED_BACK'
    message: string
    progress: number
    steps: ProductionChangeExecutionStep[]
  }
  createdBy: string
  createdAt: string
  lastExecutedAt: string
  currentFactsSnapshot: ProductionOrderChangeCurrentFacts | null
  affectedOrderFactsSnapshots: ProductionOrderChangeCurrentFacts[]
  documentTraces: ProductionChangeDocumentTrace[]
}

const activeProductionChangeLocks = new Set<string>()

export function getProductionChangeLockMessage(): string {
  return '生产单正在变更，请稍后再试'
}

export function isProductionChangeObjectLocked(objectId: string): boolean {
  return activeProductionChangeLocks.has(objectId.trim())
}

export function createProductionChangeRolledBackResult(
  preview: ProductionChangePreview,
  lockObjectIds: string[] = sanitizeObjectIds(preview.lockObjectIds),
  message = '执行失败，本次没有修改任何单据。',
): ProductionChangeExecutionResult {
  return {
    status: 'ROLLED_BACK',
    message,
    progress: 100,
    steps: [
      { id: 'LOCK', label: '锁定处理范围', status: 'ROLLED_BACK' },
      { id: 'FACTS', label: '最后核对当前事实', status: 'ROLLED_BACK' },
      { id: 'CHANGE', label: '执行全部处理动作', status: 'ROLLED_BACK' },
      { id: 'TRACE', label: '写入双向留痕', status: 'ROLLED_BACK' },
      { id: 'COMMIT', label: '全部回滚', status: 'ROLLED_BACK' },
    ],
    lockObjectIds,
    result: preview.result,
    resultLabel: productionChangeResultLabels[preview.result],
  }
}

export function executeProductionChange(
  preview: ProductionChangePreview,
  options: ProductionChangeExecutionOptions = {},
): ProductionChangeExecutionResult {
  const lockObjectIds = sanitizeObjectIds(preview.lockObjectIds)
  if (lockObjectIds.some((objectId) => activeProductionChangeLocks.has(objectId))) {
    return createProductionChangeRolledBackResult(preview, lockObjectIds, getProductionChangeLockMessage())
  }
  lockObjectIds.forEach((objectId) => activeProductionChangeLocks.add(objectId))
  let persistenceStarted = false
  let persistedDoneResult: ProductionChangeExecutionResult | null = null

  try {
    const currentFingerprint = createProductionChangeScopeFingerprint(
      preview.affectedOrderIds,
      [...preview.autoItems, ...preview.decisionItems],
    )
    if (!currentFingerprint || currentFingerprint !== preview.factsFingerprint) {
      const staleFactsResult = createProductionChangeRolledBackResult(
        preview,
        lockObjectIds,
        '当前事实已变化，请重新确认处理方案',
      )
      persistenceStarted = true
      return options.persist?.(staleFactsResult) ?? staleFactsResult
    }
    const failed = options.shouldFail === true
    const stepSeeds = [
      { id: 'LOCK', label: '锁定处理范围' },
      { id: 'FACTS', label: '最后核对当前事实' },
      { id: 'CHANGE', label: '执行全部处理动作' },
      { id: 'TRACE', label: '写入双向留痕' },
      { id: 'COMMIT', label: failed ? '全部回滚' : '统一提交' },
    ]
    const steps: ProductionChangeExecutionStep[] = []
    const result: ProductionChangeExecutionResult = {
      status: failed ? 'ROLLED_BACK' : 'DONE',
      message: failed ? '执行失败，本次没有修改任何单据。' : '全部处理成功并已统一生效。',
      progress: 0,
      steps,
      lockObjectIds,
      result: preview.result,
      resultLabel: productionChangeResultLabels[preview.result],
    }
    stepSeeds.forEach((seed, index) => {
      const shouldRollBack = failed && (seed.id === 'CHANGE' || seed.id === 'TRACE' || seed.id === 'COMMIT')
      const step: ProductionChangeExecutionStep = {
        ...seed,
        status: shouldRollBack ? 'ROLLED_BACK' : 'DONE',
      }
      steps.push(step)
      result.progress = Math.round(((index + 1) / stepSeeds.length) * 100)
      options.onStep?.(step, result)
      options.onProgress?.(result.progress, result)
    })
    const preparedWorkOrderBatch = failed
      ? null
      : (() => {
          try {
            const snapshots = typeof options.processWorkOrderSnapshots === 'function'
              ? options.processWorkOrderSnapshots()
              : options.processWorkOrderSnapshots ?? preview.affectedOrderIds.flatMap((productionOrderId) => {
                  const order = productionOrders.find((item) => item.productionOrderId === productionOrderId)
                  return order ? buildFormalProductionOrderProcessSnapshots(order) : []
                })
            return prepareSyncProcessWorkOrdersAfterProductionOrderChanges(snapshots, {
              changeRecordId: options.changeRecordId || `PRODUCTION-CHANGE:${preview.factsFingerprint}`,
              recordedAt: options.processWorkOrderSyncRecordedAt,
            })
          } catch {
            return null
          }
        })()
    if (!failed && !preparedWorkOrderBatch) {
      return createProductionChangeRolledBackResult(preview, lockObjectIds)
    }
    persistenceStarted = true
    const persistedResult = options.persist?.(result) ?? result
    if (persistedResult.status !== 'DONE') return persistedResult
    persistedDoneResult = persistedResult
    preparedWorkOrderBatch?.commit()
    return persistedResult
  } catch {
    if (persistedDoneResult) return persistedDoneResult
    const rolledBackResult = createProductionChangeRolledBackResult(preview, lockObjectIds)
    if (!persistenceStarted) {
      persistenceStarted = true
      options.persist?.(rolledBackResult)
    }
    return rolledBackResult
  } finally {
    lockObjectIds.forEach((objectId) => activeProductionChangeLocks.delete(objectId))
  }
}

export type InferProductionChangeResultInput =
  | {
      changeType: 'QUANTITY_CHANGE'
      requiresNewFormalVersion: boolean
    }
  | {
      changeType: 'MATERIAL_REPLACEMENT'
      replacementMode: MaterialReplacementMode
      scope: MaterialReplacementScope
    }

export function inferProductionChangeResult(input: InferProductionChangeResultInput): ProductionChangeResult {
  if (input.changeType === 'QUANTITY_CHANGE') {
    return input.requiresNewFormalVersion ? 'VERSION_AND_PATCH' : 'PRODUCTION_PATCH'
  }

  if (input.scope === 'CURRENT_ONLY') return 'PRODUCTION_PATCH'
  return input.replacementMode === 'REMAINING' ? 'VERSION_AND_PATCH' : 'VERSION_RELATION'
}

export function quantityChangeRequiresNewFormalVersion(lines: QuantityChangeLine[]): boolean {
  return lines.some((line) => line.isNew && !line.coveredByCurrentVersion && line.targetQty > 0)
}

function sanitizeObjectIds(ids: string[] | undefined): string[] {
  return Array.from(new Set((ids ?? []).map((id) => id.trim()).filter(Boolean)))
}

function sanitizeFollowingOrders(
  orders: MaterialReplacementDraft['followingOrders'],
): MaterialReplacementDraft['followingOrders'] {
  const uniqueOrders = new Map<string, MaterialReplacementDraft['followingOrders'][number]>()
  orders.forEach((order) => {
    const productionOrderId = order.productionOrderId.trim()
    if (!productionOrderId || order.changeable === false || uniqueOrders.has(productionOrderId)) return
    uniqueOrders.set(productionOrderId, {
      ...order,
      productionOrderId,
      affectedDocumentNos: sanitizeObjectIds(order.affectedDocumentNos),
    })
  })
  return Array.from(uniqueOrders.values())
}

function isMaterialReplacementMode(value: string | undefined): value is MaterialReplacementMode {
  return value === 'REMAINING' || value === 'FULL'
}

function resolveFollowingOrderMode(
  draft: ProductionChangeDraft,
  order: MaterialReplacementDraft['followingOrders'][number],
): MaterialReplacementMode {
  if (!order.started) return 'FULL'
  const decisionValue = draft.decisionValues[`following-order-mode-${order.productionOrderId}`]?.value
  if (isMaterialReplacementMode(decisionValue)) return decisionValue
  return order.confirmedMode ?? order.suggestedMode
}

function parseBusinessQuantity(value: string): number {
  const matched = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/)
  return matched ? Number(matched[0]) : 0
}

function getFollowingOldMaterialFactSummary(
  productionOrderId: string,
  sourceProductionOrderId: string,
  originalMaterialId: string,
): string {
  const facts = getProductionOrderChangeCurrentFacts(productionOrderId)
  const sourceFacts = getProductionOrderChangeCurrentFacts(sourceProductionOrderId)
  if (!facts || !sourceFacts) return ''
  const sourceMaterialFact = sourceFacts.materialFacts.find((fact) => fact.id === originalMaterialId)
  const sourceMaterialCode = sourceMaterialFact?.material.trim().split(/\s+/)[0]?.toUpperCase()
  if (!sourceMaterialCode) return ''
  const originalMaterialFact = facts.materialFacts.find(
    (fact) => fact.material.trim().toUpperCase().startsWith(sourceMaterialCode),
  )
  const pickedMaterialQty = originalMaterialFact ? parseBusinessQuantity(originalMaterialFact.pickedQty) : 0
  if (pickedMaterialQty <= 0) return ''
  const executedQty = facts.demandQuantityFacts.reduce((sum, fact) => sum + fact.executedQty, 0)
  return `已领旧料约 ${pickedMaterialQty}，已完成生产 ${executedQty} 件`
}

function buildDocumentPlanItems(
  idPrefix: string,
  title: string,
  description: string,
  affectedDocumentNos: string[],
): ProductionChangePlanItem[] {
  return affectedDocumentNos.map((affectedDocumentNo, index) =>
    createAutoItem({
      id: `${idPrefix}-${index + 1}`,
      group: '上下游单据',
      title: `${title} ${affectedDocumentNo}`,
      description,
      affectedDocumentNo,
    }),
  )
}

function buildQuantityDocumentPlanItems(affectedDocumentNos: string[]): ProductionChangePlanItem[] {
  return affectedDocumentNos.map((affectedDocumentNo, index) => {
    const isCuttingOrder = affectedDocumentNo.toUpperCase().startsWith('CUT-')
    return createAutoItem({
      id: `quantity-current-document-${index + 1}`,
      group: '上下游单据',
      title: isCuttingOrder ? '裁剪单未执行数量自动调整' : '关联单据未执行数量自动调整',
      description: '已执行数量保持不变，按每条需求明细的增减分别调整剩余计划并写入变更留痕。',
      affectedDocumentNo,
    })
  })
}

function createAutoItem(input: Omit<ProductionChangePlanItem, 'kind' | 'options' | 'selectedValue' | 'reason' | 'reasonRequired'>): ProductionChangePlanItem {
  return {
    ...input,
    kind: 'AUTO',
    options: [],
    selectedValue: '',
    reason: '',
    reasonRequired: false,
  }
}

function createDecisionItem(
  draft: ProductionChangeDraft,
  input: Omit<ProductionChangePlanItem, 'kind' | 'selectedValue' | 'reason'> & {
    suggestedValue?: string
  },
): ProductionChangePlanItem {
  const decision = draft.decisionValues[input.id]
  const { suggestedValue, reasonRequired, ...item } = input
  const selectedValue = decision?.value ?? ''
  return {
    ...item,
    kind: 'MERCHANDISER_DECISION',
    selectedValue,
    reason: decision?.reason ?? '',
    reasonRequired: reasonRequired || (
      selectedValue.length > 0 && suggestedValue !== undefined && selectedValue !== suggestedValue
    ),
  }
}

interface ProductionChangePlanBuild {
  result: ProductionChangeResult
  resultReason: string
  autoItems: ProductionChangePlanItem[]
  decisionItems: ProductionChangePlanItem[]
  materialModeSummaryText?: string
  remainingModeCount?: number
  fullModeCount?: number
}

function buildQuantityPlan(draft: ProductionChangeDraft): ProductionChangePlanBuild {
  const requiresNewFormalVersion = quantityChangeRequiresNewFormalVersion(draft.quantityLines)
  const result = inferProductionChangeResult({ changeType: 'QUANTITY_CHANGE', requiresNewFormalVersion })
  const changedLineCount = draft.quantityLines.filter((line) => line.currentQty !== line.targetQty || line.isNew).length
  const autoItems: ProductionChangePlanItem[] = [
    createAutoItem({
      id: 'quantity-demand-update',
      group: '需求与物料',
      title: '更新生产需求明细',
      description: `按 ${changedLineCount} 条颜色尺码明细更新生产单需求，并保留原数量与变更后数量。`,
      affectedDocumentNo: '',
    }),
  ]
  autoItems.push(...buildQuantityDocumentPlanItems(sanitizeObjectIds(draft.affectedDocumentNos)))
  autoItems.push(
    createAutoItem({
      id: 'quantity-cost-delivery',
      group: '成本与交期',
      title: '成本与交期自动重算',
      description: '系统按每条需求明细的增加或减少分别重算物料、加工成本与关联交期；净变化只用于汇总展示。',
      affectedDocumentNo: '',
    }),
  )

  const currentFacts = getProductionOrderChangeCurrentFacts(draft.productionOrderId)
  const executedQtyByDemandKey = new Map(
    (currentFacts?.demandQuantityFacts ?? []).map((fact) => [createDemandCoverageKey(fact), fact.executedQty]),
  )
  const decisionItems = draft.quantityLines.flatMap((line) => {
    const overProducedQty = Math.max((executedQtyByDemandKey.get(createDemandCoverageKey(line)) ?? 0) - line.targetQty, 0)
    if (overProducedQty === 0) return []
    return [
      createDecisionItem(draft, {
        id: `quantity-over-produced-${line.id}`,
        group: '实物去向',
        title: `${line.color} ${line.size} 已完成数量超出新需求`,
        description: `已完成数量比变更后需求多 ${overProducedQty} 件，需要确认这部分成品的业务去向。`,
        affectedDocumentNo: draft.productionOrderId,
        options: [
          { value: 'KEEP_AS_STOCK', label: '转库存保留' },
          { value: 'TRANSFER_TO_OTHER_ORDER', label: '转其他生产单使用' },
          { value: 'SETTLEMENT_DIFFERENCE', label: '按生产差异结算' },
        ],
        reasonRequired: false,
      }),
    ]
  })

  if (requiresNewFormalVersion) {
    autoItems.push(
      createAutoItem({
        id: 'quantity-version-relation',
        group: '上下游单据',
        title: '调整正式版本绑定',
        description: '新增颜色尺码未被当前正式版本覆盖，系统生成正式版本绑定调整并同步生产单补丁。',
        affectedDocumentNo: '',
      }),
    )
  }

  return {
    result,
    resultReason: requiresNewFormalVersion
      ? '存在新增且当前正式版本未覆盖的颜色尺码明细，需要调整正式版本绑定并同步生产单补丁。'
      : '变更明细均被当前正式版本覆盖，只需更新当前生产单及其未执行数据。',
    autoItems,
    decisionItems,
  }
}

function buildMaterialPlan(draft: ProductionChangeDraft, replacement: MaterialReplacementDraft): ProductionChangePlanBuild {
  const affectedDocumentNos = sanitizeObjectIds(draft.affectedDocumentNos)
  const followingOrders =
    replacement.scope === 'CURRENT_AND_FOLLOWING' ? replacement.followingOrders : []
  const followingModes = followingOrders.map((order) => ({
    order,
    finalMode: resolveFollowingOrderMode(draft, order),
  }))
  const combinedModes = [replacement.replacementMode, ...followingModes.map(({ finalMode }) => finalMode)]
  const remainingModeCount = combinedModes.filter((mode) => mode === 'REMAINING').length
  const fullModeCount = combinedModes.length - remainingModeCount
  const result =
    replacement.scope === 'CURRENT_ONLY'
      ? 'PRODUCTION_PATCH'
      : remainingModeCount > 0
        ? 'VERSION_AND_PATCH'
        : 'VERSION_RELATION'
  const modeText = replacement.replacementMode === 'REMAINING' ? '剩余数量' : '全部数量'
  const autoItems: ProductionChangePlanItem[] = [
    createAutoItem({
      id: 'material-demand-update',
      group: '需求与物料',
      title: '更新替代物料需求',
      description: `将 ${replacement.originalMaterialId} 的${modeText}替换为 ${replacement.replacementMaterialId}，确认替换生产数量 ${replacement.confirmedProductionQty} 件。`,
      affectedDocumentNo: '',
    }),
  ]
  autoItems.push(
    ...buildDocumentPlanItems(
      'material-current-document',
      '同步当前生产单关联单据',
      '系统按当前领料、裁剪、加工和库存事实调整未执行部分，已发生事实保持不变。',
      affectedDocumentNos,
    ),
  )
  const decisionItems: ProductionChangePlanItem[] = []

  if (replacement.scope === 'CURRENT_AND_FOLLOWING') {
    if (followingModes.length === 0) {
      const relation = listProductionOrderTechPackRelations().find(
        (item) => item.productionOrderId === draft.productionOrderId,
      )
      const relationObjectId = relation
        ? `正式版本关系-${relation.productionOrderId}-${relation.currentTechPackVersionId}`
        : `正式版本关系-${draft.productionOrderId}`
      autoItems.push(
        createAutoItem({
          id: 'future-production-order-version-relation',
          group: '上下游单据',
          title: '更新以后新建生产单使用的正式版本',
          description: '当前没有已创建的后续生产单；系统调整正式版本关系后，以后新建的同款生产单直接使用新面料版本。',
          affectedDocumentNo: relationObjectId,
        }),
      )
    }
    followingModes.forEach(({ order, finalMode }) => {
      if (!order.started) {
        autoItems.push(
          createAutoItem({
            id: `following-order-auto-${order.productionOrderId}`,
            group: '上下游单据',
            title: `同步后续生产单 ${order.productionOrderId}`,
            description: '该生产单尚未开工，系统将全部切换新正式版本并重算备料与交期。',
            affectedDocumentNo: order.productionOrderId,
          }),
        )
      } else {
        const isRemaining = finalMode === 'REMAINING'
        decisionItems.push(
          createDecisionItem(draft, {
            id: `following-order-mode-${order.productionOrderId}`,
            group: '上下游单据',
            title: `${order.productionOrderId} 的替换方式`,
            description: isRemaining
              ? `${order.progressText}，该生产单按剩余部分打补丁并同步切换正式版本。`
              : `${order.progressText}，该生产单按全部数量整体切换新正式版本。`,
            affectedDocumentNo: order.productionOrderId,
            options: [
              { value: 'REMAINING', label: '剩余数量替换' },
              { value: 'FULL', label: '全部数量替换' },
            ],
            suggestedValue: order.suggestedMode,
            reasonRequired: false,
          }),
        )
      }

      const oldMaterialFactSummary = getFollowingOldMaterialFactSummary(
        order.productionOrderId,
        draft.productionOrderId,
        replacement.originalMaterialId,
      )
      if (finalMode === 'FULL' && oldMaterialFactSummary) {
        decisionItems.push(
          createDecisionItem(draft, {
            id: `following-old-material-disposition-${order.productionOrderId}`,
            group: '实物去向',
            title: `${order.productionOrderId} 已形成旧料实物的去向`,
            description: `${oldMaterialFactSummary}。该生产单选择全部数量替换后，需要确认旧料、裁片和在制品的业务去向。`,
            affectedDocumentNo: order.productionOrderId,
            options: [
              { value: 'RETURN_TO_STOCK', label: '退回库存' },
              { value: 'TRANSFER_USE', label: '转其他生产单使用' },
              { value: 'DISPOSE', label: '按现场规则处置' },
            ],
            reasonRequired: false,
          }),
        )
      }

      autoItems.push(
        ...buildDocumentPlanItems(
          `following-document-${order.productionOrderId}`,
          `同步后续生产单 ${order.productionOrderId} 关联单据`,
          finalMode === 'REMAINING'
            ? '按剩余部分补丁方案同步该后续生产单的明确关联单据。'
            : '按整体切换方案同步该后续生产单的明确关联单据。',
          sanitizeObjectIds(order.affectedDocumentNos),
        ),
      )
    })
  }

  const oldMaterialFactQty = replacement.allocations.reduce((total, allocation) => total + allocation.oldMaterialFactQty, 0)
  if (oldMaterialFactQty > 0 && replacement.replacementMode === 'REMAINING') {
    autoItems.push(
      createAutoItem({
        id: 'old-material-fact-kept',
        group: '实物去向',
        title: '保留已完成生产数量',
        description: `已有 ${oldMaterialFactQty} 件完成生产，系统继续计入当前生产单，只替换剩余待生产数量。`,
        affectedDocumentNo: '',
      }),
    )
  }
  if (oldMaterialFactQty > 0 && replacement.replacementMode === 'FULL') {
    decisionItems.push(
      createDecisionItem(draft, {
        id: 'old-material-disposition',
        group: '实物去向',
        title: '旧面料成品退出当前需求后的去向',
        description: `已有 ${oldMaterialFactQty} 件完成生产，全部替换后需确认这些成品不再计入当前需求时的实物去向。`,
        affectedDocumentNo: '',
        options: [
          { value: 'RETURN_TO_STOCK', label: '转库存' },
          { value: 'TRANSFER_USE', label: '转其他生产单' },
          { value: 'DISPOSE', label: '处置' },
        ],
        reasonRequired: false,
      }),
    )
  }

  autoItems.push(
    createAutoItem({
      id: 'material-cost-delivery',
      group: '成本与交期',
      title: '成本与交期自动重算',
      description: '系统按新旧物料价差、已发生事实和最终替换范围重算成本与关联交期。',
      affectedDocumentNo: '',
    }),
  )

  const resultReason =
    replacement.scope === 'CURRENT_ONLY'
      ? `${modeText}替换仅作用于当前生产单，系统生成生产单补丁。`
      : remainingModeCount > 0
        ? '当前及可变更后续生产单的最终方案中包含剩余数量替换，需要生产单补丁并调整正式版本绑定。'
        : '当前生产单及所有纳入的后续生产单最终均为全部替换，只需统一调整正式版本绑定关系。'
  const materialModeSummaryText =
    replacement.scope === 'CURRENT_ONLY'
      ? `当前生产单采用${modeText}替换。`
      : `综合方案：${remainingModeCount} 张生产单采用剩余数量替换，${fullModeCount} 张生产单采用全部数量替换。`

  return {
    result,
    resultReason,
    autoItems,
    decisionItems,
    materialModeSummaryText,
    remainingModeCount,
    fullModeCount,
  }
}

export function buildProductionChangePreview(draft: ProductionChangeDraft): ProductionChangePreview {
  if (draft.changeType === 'MATERIAL_REPLACEMENT' && !draft.materialReplacement) {
    throw new Error('替换物料变更缺少物料替换内容')
  }

  const materialReplacement = draft.materialReplacement
    ? {
        ...draft.materialReplacement,
        followingOrders: sanitizeFollowingOrders(draft.materialReplacement.followingOrders),
      }
    : null
  const sanitizedDraft: ProductionChangeDraft = {
    ...draft,
    productionOrderId: draft.productionOrderId.trim(),
    quantityLines: draft.quantityLines.map((line) => ({
      ...line,
      coveredByCurrentVersion: line.isNew
        ? isQuantityLineCoveredByCurrentFormalVersion(draft.productionOrderId, line)
        : line.coveredByCurrentVersion,
    })),
    affectedDocumentNos: sanitizeObjectIds(draft.affectedDocumentNos),
    materialReplacement,
  }
  const plan =
    sanitizedDraft.changeType === 'QUANTITY_CHANGE'
      ? buildQuantityPlan(sanitizedDraft)
      : buildMaterialPlan(sanitizedDraft, materialReplacement as MaterialReplacementDraft)
  const replacement = materialReplacement
  const affectedOrderIds = Array.from(
    new Set([
      sanitizedDraft.productionOrderId,
      ...(sanitizedDraft.changeType === 'MATERIAL_REPLACEMENT' && replacement?.scope === 'CURRENT_AND_FOLLOWING'
        ? replacement.followingOrders.map((order) => order.productionOrderId)
        : []),
    ].filter((id) => id.trim().length > 0)),
  )
  const planItems = [...plan.autoItems, ...plan.decisionItems]
  const affectedDocumentIds = Array.from(
    new Set(planItems.map((item) => item.affectedDocumentNo).filter((id) => id.trim().length > 0)),
  )
  const quantityDelta = sanitizedDraft.quantityLines.reduce((total, line) => total + line.targetQty - line.currentQty, 0)

  return {
    result: plan.result,
    resultReason: plan.resultReason,
    factsFingerprint: createProductionChangeScopeFingerprint(affectedOrderIds, planItems),
    affectedOrderIds,
    autoItems: plan.autoItems,
    decisionItems: plan.decisionItems,
    summary: {
      affectedOrderCount: affectedOrderIds.length,
      affectedDocumentCount: affectedDocumentIds.length,
      materialDeltaText:
        sanitizedDraft.changeType === 'QUANTITY_CHANGE'
          ? `生产需求净变化 ${quantityDelta >= 0 ? '+' : ''}${quantityDelta} 件。`
          : `${replacement?.originalMaterialId ?? '原物料'} → ${replacement?.replacementMaterialId ?? '替代物料'}，确认替换 ${replacement?.confirmedProductionQty ?? 0} 件；${plan.materialModeSummaryText ?? ''}`,
      costDeltaText:
        sanitizedDraft.changeType === 'QUANTITY_CHANGE'
          ? '系统按需求数量变化重算未发生的物料与加工成本。'
          : '系统按新旧物料价差及已发生事实核算成本差异。',
      deliveryImpactText:
        sanitizedDraft.changeType === 'MATERIAL_REPLACEMENT' && replacement?.scope === 'CURRENT_AND_FOLLOWING'
          ? `最终方案包含 ${plan.remainingModeCount ?? 0} 张剩余数量替换、${plan.fullModeCount ?? 0} 张全部数量替换，系统据此重算关联单据交期。`
          : '系统按确认后的生产数量重算关联单据交期。',
    },
    lockObjectIds: Array.from(new Set([...affectedOrderIds, ...affectedDocumentIds])).filter((id) => id.trim().length > 0),
  }
}

export function createProductionChangeFactsFingerprint(productionOrderId: string): string {
  const normalizedOrderId = productionOrderId.trim()
  return normalizedOrderId ? createProductionChangeScopeFingerprint([normalizedOrderId], []) : ''
}

export function createProductionChangeScopeFingerprint(
  affectedOrderIds: string[],
  planItems: ProductionChangePlanItem[],
): string {
  const orderFacts = sanitizeObjectIds(affectedOrderIds).map((productionOrderId) => ({
    productionOrderId,
    facts: getProductionOrderChangeCurrentFacts(productionOrderId),
  }))
  const handlingFacts = planItems.map((item) => ({
    id: item.id,
    kind: item.kind,
    affectedDocumentNo: item.affectedDocumentNo,
  }))
  return JSON.stringify({ orderFacts, handlingFacts })
}

export function validateProductionChangeDecisions(preview: ProductionChangePreview): string[] {
  return preview.decisionItems
    .filter(
      (item) =>
        !item.selectedValue ||
        !item.options.some((option) => option.value === item.selectedValue) ||
        (item.reasonRequired && item.reason.trim().length === 0),
    )
    .map((item) => item.id)
}

function createRecordExecution(
  status: ProductionChangeStatus,
): ProductionChangeRecord['execution'] {
  if (status === 'DONE') {
    return {
      status: 'DONE',
      message: '全部处理成功并已统一生效。',
      progress: 100,
      steps: [
        { id: 'LOCK', label: '锁定处理范围', status: 'DONE' },
        { id: 'FACTS', label: '最后核对当前事实', status: 'DONE' },
        { id: 'CHANGE', label: '执行全部处理动作', status: 'DONE' },
        { id: 'TRACE', label: '写入双向留痕', status: 'DONE' },
        { id: 'COMMIT', label: '统一提交', status: 'DONE' },
      ],
    }
  }
  if (status === 'ROLLED_BACK') {
    return {
      status: 'ROLLED_BACK',
      message: '执行失败，本次没有修改任何单据。',
      progress: 100,
      steps: [
        { id: 'LOCK', label: '锁定处理范围', status: 'ROLLED_BACK' },
        { id: 'FACTS', label: '最后核对当前事实', status: 'ROLLED_BACK' },
        { id: 'CHANGE', label: '执行全部处理动作', status: 'ROLLED_BACK' },
        { id: 'TRACE', label: '写入双向留痕', status: 'ROLLED_BACK' },
        { id: 'COMMIT', label: '全部回滚', status: 'ROLLED_BACK' },
      ],
    }
  }
  return {
    status: status === 'EXECUTING' ? 'RUNNING' : 'IDLE',
    message: status === 'EXECUTING' ? getProductionChangeLockMessage() : '',
    progress: 0,
    steps: [],
  }
}

function summarizeQuantityChange(
  draft: ProductionChangeDraft,
): { beforeText: string; afterText: string } {
  const changedLines = draft.quantityLines.filter(
    (line) => line.isNew || line.currentQty !== line.targetQty,
  )
  if (changedLines.length === 0) {
    return { beforeText: '需求明细数量未变化', afterText: '需求明细数量未变化' }
  }
  return {
    beforeText: changedLines
      .map((line) => `${line.color}/${line.size} ${line.currentQty} ${line.unit}`)
      .join('；'),
    afterText: changedLines
      .map((line) => `${line.color}/${line.size} ${line.targetQty} ${line.unit}`)
      .join('；'),
  }
}

function getTraceHandlingText(
  draft: ProductionChangeDraft,
  status: ProductionChangeStatus,
  planItem?: ProductionChangePlanItem,
): string {
  if (status === 'ROLLED_BACK') return '同步执行失败，全部回滚，单据保持变更前内容'
  if (!planItem) return '系统按当前事实自动处理未执行部分'
  if (planItem.kind === 'AUTO') return planItem.description
  const decision = draft.decisionValues[planItem.id]
  const selectedLabel = planItem.options.find((option) => option.value === decision?.value)?.label
  return selectedLabel
    ? `跟单确认：${selectedLabel}${decision?.reason.trim() ? `（${decision.reason.trim()}）` : ''}`
    : planItem.description
}

function getDocumentTypeLabel(documentNo: string, fact?: ProductionOrderChangeCurrentFacts['documentFacts'][number]): string {
  if (fact) return fact.group
  if (documentNo.startsWith('正式版本关系-')) return '正式版本关系'
  if (documentNo.startsWith('PO-')) return '生产单'
  if (documentNo.startsWith('CUT-')) return '裁剪单'
  if (documentNo.startsWith('SP-')) return '铺布单'
  if (documentNo.startsWith('WLS-') || documentNo.startsWith('MR-') || documentNo.startsWith('MI-')) return '配料/领料单'
  if (documentNo.startsWith('DY-')) return '染色加工单'
  if (documentNo.startsWith('PR-')) return '印花加工单'
  if (documentNo.startsWith('SEW-')) return '车缝加工单'
  if (documentNo.startsWith('SET-')) return '结算单'
  return '关联单据'
}

function buildProductionChangeDocumentTraces(
  id: string,
  draft: ProductionChangeDraft,
  status: ProductionChangeStatus,
  executedAt: string,
  affectedOrderFactsSnapshots: ProductionOrderChangeCurrentFacts[],
  preview: ProductionChangePreview,
): ProductionChangeDocumentTrace[] {
  if (status === 'DRAFT' || status === 'READY' || status === 'EXECUTING') return []
  const documentNos = sanitizeObjectIds(
    draft.affectedDocumentNos?.length
      ? draft.affectedDocumentNos
      : affectedOrderFactsSnapshots.flatMap((facts) => facts.documentFacts.slice(0, 3).map((fact) => fact.documentNo)),
  )
  const factEntries = affectedOrderFactsSnapshots.flatMap((facts) =>
    facts.documentFacts.map((fact) => ({ facts, fact })),
  )
  const factByDocumentNo = new Map(factEntries.map(({ fact }) => [fact.documentNo, fact]))
  const ownerFactsByDocumentNo = new Map(factEntries.map(({ fact, facts }) => [fact.documentNo, facts]))
  const planItemByDocumentNo = new Map(
    [...preview.autoItems, ...preview.decisionItems]
      .filter((item) => item.affectedDocumentNo)
      .map((item) => [item.affectedDocumentNo, item]),
  )
  const followingOrderById = new Map(
    (draft.materialReplacement?.followingOrders ?? []).map((order) => [order.productionOrderId, order]),
  )
  const quantitySummary = summarizeQuantityChange(draft)
  const material = draft.materialReplacement

  return documentNos.map((documentNo) => {
    const fact = factByDocumentNo.get(documentNo)
    const ownerFacts = ownerFactsByDocumentNo.get(documentNo)
    const planItem = planItemByDocumentNo.get(documentNo)
    const followingOrder = followingOrderById.get(documentNo)
    const ownerFollowingOrder = followingOrder ?? (
      ownerFacts ? followingOrderById.get(ownerFacts.productionOrderId) : undefined
    )
    let beforeText: string
    let afterText: string
    if (fact) {
      beforeText = `${fact.status}；计划 ${fact.plannedQty}；已完成 ${fact.doneQty}；待处理 ${fact.pendingQty}`
      if (draft.changeType === 'QUANTITY_CHANGE') {
        const linkedLines = draft.quantityLines.filter((line) => fact.demandFactIds?.includes(line.id))
        const linkedDelta = linkedLines.reduce((sum, line) => sum + line.targetQty - line.currentQty, 0)
        const plannedQty = parseBusinessQuantity(fact.plannedQty)
        const doneQty = parseBusinessQuantity(fact.doneQty)
        const linkedTargetQty = linkedLines.reduce((sum, line) => sum + line.targetQty, 0)
        const afterPlanText = fact.plannedQty.includes('件') && linkedLines.length > 0
          ? `新计划 ${Math.max(doneQty, plannedQty + linkedDelta)} 件`
          : fact.quantityPerDemandUnit && fact.planUnit && linkedLines.length > 0
            ? `新计划 ${Math.max(doneQty, Math.round(linkedTargetQty * fact.quantityPerDemandUnit * 100) / 100)} ${fact.planUnit}`
            : `原单位计划 ${fact.plannedQty}，缺少需求到单据单位换算关系`
        const linkedSummary = linkedLines.length > 0
          ? linkedLines.map((line) => `${line.color}/${line.size} ${line.currentQty}→${line.targetQty} 件`).join('；')
          : quantitySummary.afterText
        afterText = `${fact.status}；${afterPlanText}；已完成 ${fact.doneQty} 保持不变；${linkedSummary}`
      } else {
        const followingOrderMode = ownerFollowingOrder
          ? resolveFollowingOrderMode(draft, ownerFollowingOrder)
          : material?.replacementMode ?? 'REMAINING'
        const linkedDemandFacts = ownerFacts?.demandQuantityFacts.filter(
          (demand) => !fact.demandFactIds?.length || fact.demandFactIds.includes(demand.id),
        ) ?? []
        const replacementQty = documentNo === draft.productionOrderId
          ? material?.confirmedProductionQty ?? 0
          : followingOrderMode === 'FULL'
            ? linkedDemandFacts.reduce((sum, demand) => sum + demand.currentDemandQty, 0)
            : linkedDemandFacts.reduce((sum, demand) => sum + demand.pendingQty, 0)
        afterText = `${fact.status}；原计划 ${fact.plannedQty}；已完成 ${fact.doneQty} 保持原物料事实；对应生产 ${replacementQty} 件改用 ${material?.replacementMaterialId || '未记录'}`
      }
    } else if (documentNo === draft.productionOrderId) {
      beforeText = draft.changeType === 'QUANTITY_CHANGE'
        ? quantitySummary.beforeText
        : `当前生产单原物料 ${material?.originalMaterialId || '未记录'}，需求 ${material?.allocations.reduce((sum, line) => sum + line.demandQty, 0) ?? 0} 件`
      afterText = draft.changeType === 'QUANTITY_CHANGE'
        ? quantitySummary.afterText
        : `当前生产单改用 ${material?.replacementMaterialId || '未记录'}，按${material?.replacementMode === 'FULL' ? '全部数量' : '剩余数量'}替换 ${material?.confirmedProductionQty ?? 0} 件`
    } else if (followingOrder) {
      beforeText = `${followingOrder.progressText}；系统建议${followingOrder.suggestedMode === 'FULL' ? '全部数量替换' : '剩余数量替换'}`
      afterText = `跟单确认按${resolveFollowingOrderMode(draft, followingOrder) === 'FULL' ? '全部数量' : '剩余数量'}替换`
    } else {
      beforeText = `关联 ${getDocumentTypeLabel(documentNo)}；保持当前状态和已完成数量`
      afterText = draft.changeType === 'QUANTITY_CHANGE'
        ? `需求明细调整为：${quantitySummary.afterText}`
        : `未执行部分改用 ${material?.replacementMaterialId || '未记录'}，确认替换 ${material?.confirmedProductionQty ?? 0} 件；${planItem?.description ?? '按所属生产单确认方案同步'}`
    }
    if (status === 'ROLLED_BACK') afterText = `未生效，保持变更前：${beforeText}`
    return {
      changeOrderId: id,
      documentNo,
      documentTypeLabel: getDocumentTypeLabel(documentNo, fact),
      beforeText,
      afterText,
      handlingText: getTraceHandlingText(draft, status, planItem),
      executedAt,
    }
  })
}

export function buildProductionChangeRecord(
  id: string,
  draft: ProductionChangeDraft,
  status: ProductionChangeStatus,
  createdAt: string,
  executedAt = createdAt,
): ProductionChangeRecord {
  const copiedDraft = structuredClone(draft)
  const preview = buildProductionChangePreview(copiedDraft)
  const affectedOrderFactsSnapshots = preview.affectedOrderIds
    .map((productionOrderId) => getProductionOrderChangeCurrentFacts(productionOrderId))
    .filter((facts): facts is ProductionOrderChangeCurrentFacts => Boolean(facts))
    .map((facts) => structuredClone(facts))
  const currentFactsSnapshot = affectedOrderFactsSnapshots.find(
    (facts) => facts.productionOrderId === copiedDraft.productionOrderId,
  ) ?? null
  const affectedDocumentNos = sanitizeObjectIds([
    ...preview.affectedOrderIds,
    ...affectedOrderFactsSnapshots.flatMap((facts) => facts.documentFacts.map((fact) => fact.documentNo)),
    ...preview.autoItems.map((item) => item.affectedDocumentNo),
    ...preview.decisionItems.map((item) => item.affectedDocumentNo),
  ])
  copiedDraft.affectedDocumentNos = affectedDocumentNos
  return {
    ...copiedDraft,
    id,
    result: preview.result,
    resultReason: preview.resultReason,
    status,
    preview,
    execution: createRecordExecution(status),
    createdBy: '陈静',
    createdAt,
    lastExecutedAt: status === 'DRAFT' || status === 'READY' ? '' : executedAt,
    currentFactsSnapshot,
    affectedOrderFactsSnapshots,
    documentTraces: buildProductionChangeDocumentTraces(
      id,
      copiedDraft,
      status,
      executedAt,
      affectedOrderFactsSnapshots,
      preview,
    ),
  }
}

function buildProductionChangeSeedRecords(): ProductionChangeRecord[] {
  const productionOrderId = listProductionOrderTechPackRelations()
    .map((relation) => relation.productionOrderId)
    .find((orderId) => createQuantityLinesForOrder(orderId).length > 0) ?? 'PO-202603-0004'
  const affectedDocumentNos = listAffectedDocumentNosForOrder(productionOrderId).slice(0, 3)
  const quantityLines = createQuantityLinesForOrder(productionOrderId)
  if (quantityLines[0]) quantityLines[0].targetQty += 20
  const quantityDraft: ProductionChangeDraft = {
    productionOrderId,
    changeType: 'QUANTITY_CHANGE',
    reason: '追加黑色小码需求数量。',
    quantityLines,
    materialReplacement: null,
    decisionValues: {},
    affectedDocumentNos,
  }
  const materialOptions = listReplacementMaterialOptions()
  const materialDraft: ProductionChangeDraft = {
    productionOrderId,
    changeType: 'MATERIAL_REPLACEMENT',
    reason: '原面料不足，剩余数量改用新面料。',
    quantityLines: createQuantityLinesForOrder(productionOrderId),
    materialReplacement: {
      ...createEmptyMaterialReplacementDraft(),
      originalMaterialId: materialOptions[0]?.value ?? '',
      replacementMaterialId: materialOptions[1]?.value ?? materialOptions[0]?.value ?? '',
      replacementMode: 'REMAINING',
      scope: 'CURRENT_AND_FOLLOWING',
      suggestedProductionQty: 220,
      confirmedProductionQty: 220,
      allocations: buildMaterialReplacementAllocations(productionOrderId, 220),
      followingOrders: createFollowingOrderPlans(productionOrderId),
    },
    decisionValues: {},
    affectedDocumentNos,
  }
  const rolledBackDraft: ProductionChangeDraft = {
    ...structuredClone(quantityDraft),
    reason: '缩减藏青色大码数量，执行时当前事实发生变化。',
  }
  if (rolledBackDraft.quantityLines[1]) {
    rolledBackDraft.quantityLines[1].targetQty = Math.max(
      rolledBackDraft.quantityLines[1].currentQty - 10,
      0,
    )
  }
  return [
    buildProductionChangeRecord('BG-20260710-001', quantityDraft, 'DONE', '2026-07-10 09:20'),
    buildProductionChangeRecord('BG-20260710-002', materialDraft, 'READY', '2026-07-10 10:15'),
    buildProductionChangeRecord('BG-20260710-003', rolledBackDraft, 'ROLLED_BACK', '2026-07-10 11:05'),
  ]
}

let productionChangeRecords = buildProductionChangeSeedRecords()
const reservedProductionChangeSequences = new Map<string, number>()
let productionChangeDocumentTraceIndex = buildProductionChangeDocumentTraceIndex(productionChangeRecords)

function buildProductionChangeDocumentTraceIndex(
  records: ProductionChangeRecord[],
): Map<string, ProductionChangeDocumentTrace[]> {
  const index = new Map<string, ProductionChangeDocumentTrace[]>()
  records.forEach((record) => {
    record.documentTraces.forEach((trace) => {
      const documentNo = trace.documentNo.trim()
      if (!documentNo) return
      index.set(documentNo, [...(index.get(documentNo) ?? []), structuredClone(trace)])
    })
  })
  return index
}

function rebuildProductionChangeDocumentTraceIndex(): void {
  productionChangeDocumentTraceIndex = buildProductionChangeDocumentTraceIndex(productionChangeRecords)
}

export function listProductionChangeRecords(): ProductionChangeRecord[] {
  return structuredClone(productionChangeRecords)
}

export function getProductionChangeRecord(id: string): ProductionChangeRecord | null {
  const record = productionChangeRecords.find((item) => item.id === id.trim())
  return record ? structuredClone(record) : null
}

export function listProductionChangeDocumentTraces(documentNo: string): ProductionChangeDocumentTrace[] {
  return structuredClone(productionChangeDocumentTraceIndex.get(documentNo.trim()) ?? [])
}

export function saveProductionChangeRecord(
  record: ProductionChangeRecord,
  options: { allowReplace?: boolean } = {},
): void {
  const copiedRecord = structuredClone(record)
  const existingRecord = productionChangeRecords.find((item) => item.id === copiedRecord.id)
  if (existingRecord) {
    if (existingRecord.status === 'DONE') {
      throw new Error(`已完成的生产单变更记录 ${copiedRecord.id} 不能覆盖`)
    }
    if (options.allowReplace !== true || existingRecord.status !== 'ROLLED_BACK') {
      throw new Error(`生产单变更记录 ${copiedRecord.id} 已存在`)
    }
  }
  productionChangeRecords = [
    copiedRecord,
    ...productionChangeRecords.filter((item) => item.id !== copiedRecord.id),
  ]
  rebuildProductionChangeDocumentTraceIndex()
}

export function resetProductionChangeRecordsForTesting(): void {
  productionChangeRecords = buildProductionChangeSeedRecords()
  reservedProductionChangeSequences.clear()
  rebuildProductionChangeDocumentTraceIndex()
}

export function restoreProductionChangeRecords(records: ProductionChangeRecord[]): void {
  productionChangeRecords = structuredClone(records)
  rebuildProductionChangeDocumentTraceIndex()
}

export function restoreProductionChangeRecordSnapshot(
  recordId: string,
  recordSnapshot: ProductionChangeRecord | null,
): void {
  const normalizedRecordId = recordId.trim()
  productionChangeRecords = [
    ...(recordSnapshot ? [structuredClone(recordSnapshot)] : []),
    ...productionChangeRecords.filter((record) => record.id !== normalizedRecordId),
  ]
  rebuildProductionChangeDocumentTraceIndex()
}

export function replaceProductionChangeRecordsForTesting(records: ProductionChangeRecord[]): void {
  restoreProductionChangeRecords(records)
}

function getProductionChangeRecordDatePrefix(occurredAt: string | Date): string {
  const date = normalizeProductionChangeOccurredAt(occurredAt).date
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('')
}

export function normalizeProductionChangeOccurredAt(
  occurredAt: string | Date,
): { date: Date; text: string } {
  if (occurredAt instanceof Date) {
    if (Number.isNaN(occurredAt.getTime())) throw new Error('生产单变更记录时间无效')
    const date = new Date(occurredAt.getTime())
    return {
      date,
      text: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
    }
  }
  const matched = occurredAt.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!matched) throw new Error('生产单变更记录时间无效')
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '00'] = matched
  const values = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number)
  const [year, month, day, hour, minute, second] = values
  const date = new Date(year, month - 1, day, hour, minute, second)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    throw new Error('生产单变更记录时间无效')
  }
  return { date, text: `${yearText}-${monthText}-${dayText} ${hourText}:${minuteText}` }
}

export function createNextProductionChangeRecordId(occurredAt: string | Date = new Date()): string {
  const datePrefix = getProductionChangeRecordDatePrefix(occurredAt)
  const savedMax = productionChangeRecords.reduce((maxSequence, record) => {
    const matched = record.id.match(new RegExp(`^BG-${datePrefix}-(\\d+)$`))
    return matched ? Math.max(maxSequence, Number(matched[1])) : maxSequence
  }, 0)
  const nextSequence = Math.max(savedMax, reservedProductionChangeSequences.get(datePrefix) ?? 0) + 1
  reservedProductionChangeSequences.set(datePrefix, nextSequence)
  return `BG-${datePrefix}-${String(nextSequence).padStart(3, '0')}`
}
