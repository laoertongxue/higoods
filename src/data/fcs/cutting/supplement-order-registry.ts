import type { SupplementCreatedPurchaseOrderRef } from './supplement-purchase-order-registry.ts'
import type { SupplementMaterialSupplyDecisionSnapshot } from './supplement-supply-domain.ts'

export type SupplementOrderStatus = '未完成' | '已完成'

export interface SupplementOrderLineFact {
  readonly color: string
  readonly size: string
  readonly supplementQty: number
}

export type SupplementMaterialDemand = {
  key: string
  materialPatternMappingId: string
  sourceBomItemId: string
  techPackVersionId: string
  materialSku: string
  materialName: string
  materialTypeLabel: string
  materialImageUrl: string
  materialImageAlt: string
  materialAlias: string
  materialRole: '面料A' | '面料B' | '面料C' | '里布' | '衬' | '罗纹' | '辅料' | '包材' | '未识别'
  roleSource: string
  roleConfirmStatus: '已确认' | '待确认'
  patternId: string
  patternName: string
  requiredQty: number
  unit: string
  printRequired: boolean
  dyeRequired: boolean
  processNote: string
  originalCutOrderId: string
  originalCutOrderNo: string
  color?: string
  spec?: string
  patternPart?: string
}

export interface SupplementProcessWorkOrderRef {
  processType: 'PRINT' | 'DYE'
  sourceType: 'CUT_PIECE_SUPPLEMENT'
  workOrderId: string
  workOrderNo: string
  materialSku: string
  materialName: string
  materialDemandIds: string[]
  plannedQty: number
  unit: string
}

export interface SupplementDraftMeta {
  readonly candidateId: string
  readonly sourceType: 'production-order' | 'cut-order' | 'release-snapshot'
  readonly sourceNo: string
  readonly styleName: string
  readonly spuCode: string
  readonly styleImageUrl: string
  readonly styleImageAlt: string
  readonly releaseSnapshotId?: string
  readonly releaseMatrixVersion?: number
  readonly releaseTargetConfirmedAt?: string
}

export interface SupplementOrderLifecycle {
  readonly id: string
  readonly recordNo: string
  readonly cutOrderId: string
  readonly cutOrderNo: string
  readonly productionOrderId: string
  readonly productionOrderNo: string
  readonly sequenceNo: number
  readonly status: SupplementOrderStatus
  readonly reason: string
  readonly reasonDetail: string
  readonly totalQty: number
  readonly lineSummary: string
  readonly lines: ReadonlyArray<SupplementOrderLineFact>
  readonly materialDemands: ReadonlyArray<SupplementMaterialDemand>
  readonly supplyDecisionSnapshots: ReadonlyArray<SupplementMaterialSupplyDecisionSnapshot>
  readonly processWorkOrderRefs: ReadonlyArray<SupplementProcessWorkOrderRef>
  readonly createdPurchaseOrderRefs: ReadonlyArray<SupplementCreatedPurchaseOrderRef>
  readonly materialPrepDemandId: string
  readonly confirmationKey: string
  readonly requestFingerprint: string
  readonly draftMeta: SupplementDraftMeta
  readonly createdAt: string
  readonly createdBy: string
  readonly completedAt: string
  readonly completedBy: string
}

type MutableSupplementOrderLifecycle = {
  -readonly [Key in keyof SupplementOrderLifecycle]: SupplementOrderLifecycle[Key]
}

export type RegisterSupplementOrderInput = Omit<
  SupplementOrderLifecycle,
  | 'sequenceNo'
  | 'status'
  | 'completedAt'
  | 'completedBy'
  | 'productionOrderId'
  | 'processWorkOrderRefs'
  | 'supplyDecisionSnapshots'
  | 'createdPurchaseOrderRefs'
  | 'materialPrepDemandId'
  | 'confirmationKey'
  | 'requestFingerprint'
  | 'draftMeta'
> & Partial<Pick<
  SupplementOrderLifecycle,
  | 'productionOrderId'
  | 'processWorkOrderRefs'
  | 'supplyDecisionSnapshots'
  | 'createdPurchaseOrderRefs'
  | 'materialPrepDemandId'
  | 'confirmationKey'
  | 'requestFingerprint'
  | 'draftMeta'
>>

const supplementOrders = new Map<string, MutableSupplementOrderLifecycle>()

function cloneSupplementOrder(
  order: SupplementOrderLifecycle,
): SupplementOrderLifecycle {
  return {
    ...order,
    lines: order.lines.map((line) => ({ ...line })),
    materialDemands: order.materialDemands.map((demand) => ({ ...demand })),
    supplyDecisionSnapshots: order.supplyDecisionSnapshots.map((snapshot) => ({
      ...snapshot,
      inventoryRows: snapshot.inventoryRows.map((row) => ({ ...row })),
      existingTransitSummary: snapshot.existingTransitSummary ? { ...snapshot.existingTransitSummary } : null,
      existingTransitRows: (snapshot.existingTransitRows ?? []).map((row) => ({ ...row })),
      warnings: [...snapshot.warnings],
    })),
    processWorkOrderRefs: order.processWorkOrderRefs.map((ref) => ({ ...ref, materialDemandIds: [...ref.materialDemandIds] })),
    createdPurchaseOrderRefs: order.createdPurchaseOrderRefs.map((ref) => ({ ...ref })),
    draftMeta: { ...order.draftMeta },
  }
}

function hasSameBusinessIdentity(
  existing: MutableSupplementOrderLifecycle,
  input: RegisterSupplementOrderInput,
): boolean {
  return existing.id === input.id
    && existing.recordNo === input.recordNo
    && existing.cutOrderId === input.cutOrderId
    && existing.cutOrderNo === input.cutOrderNo
    && existing.productionOrderNo === input.productionOrderNo
}

export function listSupplementOrdersByCutOrder(
  cutOrderId: string,
): ReadonlyArray<SupplementOrderLifecycle> {
  return [...supplementOrders.values()]
    .filter((order) => order.cutOrderId === cutOrderId)
    .sort((left, right) => left.sequenceNo - right.sequenceNo)
    .map(cloneSupplementOrder)
}

export function listSupplementOrders(): ReadonlyArray<SupplementOrderLifecycle> {
  return [...supplementOrders.values()].map(cloneSupplementOrder)
}

export function listActiveSupplementOrders(): SupplementOrderLifecycle[] {
  return listSupplementOrders().filter((order) => order.status === '未完成')
}

export function listSupplementOrdersByProductionOrder(
  productionOrderId: string,
): SupplementOrderLifecycle[] {
  return listSupplementOrders().filter((order) => order.productionOrderId === productionOrderId)
}

export function getSupplementOrder(id: string): SupplementOrderLifecycle | undefined {
  const order = supplementOrders.get(id)
  return order ? cloneSupplementOrder(order) : undefined
}

export function registerSupplementOrder(
  input: RegisterSupplementOrderInput,
): SupplementOrderLifecycle {
  const existing = supplementOrders.get(input.id)
  if (existing) {
    if (!hasSameBusinessIdentity(existing, input)) {
      throw new Error('补料单标识冲突，不能登记到不同业务对象。')
    }
    return cloneSupplementOrder(existing)
  }
  if (input.confirmationKey && [...supplementOrders.values()].some((order) =>
    order.confirmationKey === input.confirmationKey && order.id !== input.id
  )) {
    throw new Error('同一确认键已生成补料单，不能重复登记。')
  }

  const order: MutableSupplementOrderLifecycle = {
    ...input,
    lines: input.lines.map((line) => ({ ...line })),
    materialDemands: input.materialDemands.map((demand) => ({ ...demand })),
    supplyDecisionSnapshots: (input.supplyDecisionSnapshots ?? []).map((snapshot) => ({
      ...snapshot,
      inventoryRows: snapshot.inventoryRows.map((row) => ({ ...row })),
      existingTransitSummary: snapshot.existingTransitSummary ? { ...snapshot.existingTransitSummary } : null,
      existingTransitRows: (snapshot.existingTransitRows ?? []).map((row) => ({ ...row })),
      warnings: [...snapshot.warnings],
    })),
    processWorkOrderRefs: (input.processWorkOrderRefs ?? []).map((ref) => ({
      ...ref,
      materialDemandIds: [...(ref.materialDemandIds ?? [])],
    })),
    createdPurchaseOrderRefs: (input.createdPurchaseOrderRefs ?? []).map((ref) => ({ ...ref })),
    materialPrepDemandId: input.materialPrepDemandId ?? `SUP-PREP:${input.id}`,
    draftMeta: input.draftMeta
      ? { ...input.draftMeta }
      : { candidateId: '', sourceType: 'cut-order', sourceNo: '', styleName: '', spuCode: '', styleImageUrl: '', styleImageAlt: '' },
    productionOrderId: input.productionOrderId ?? '',
    confirmationKey: input.confirmationKey ?? '',
    requestFingerprint: input.requestFingerprint ?? '',
    sequenceNo: listSupplementOrdersByCutOrder(input.cutOrderId).length + 1,
    status: '未完成',
    completedAt: '',
    completedBy: '',
  }
  supplementOrders.set(order.id, order)
  return cloneSupplementOrder(order)
}

export function completeSupplementOrder(input: {
  id: string
  completedAt: string
  completedBy: string
  unresolvedDifferences?: ReadonlyArray<{ materialName: string; nodeName: string; quantity: number; unit: string }>
}): SupplementOrderLifecycle {
  const existing = supplementOrders.get(input.id)
  if (!existing) {
    throw new Error('未找到对应补料单，请刷新后重试。')
  }
  if (existing.status === '已完成') {
    throw new Error('该补料单已完成，无需重复操作。')
  }
  if (input.unresolvedDifferences?.length) {
    const first = input.unresolvedDifferences[0]
    throw new Error(`${first.materialName}的${first.nodeName}仍有 ${first.quantity} ${first.unit} 未处理差异，暂不能完成补料。`)
  }

  const completed: MutableSupplementOrderLifecycle = {
    ...existing,
    status: '已完成',
    completedAt: input.completedAt,
    completedBy: input.completedBy,
  }
  supplementOrders.set(completed.id, completed)
  return cloneSupplementOrder(completed)
}

export function resetSupplementOrderRegistryForTesting(): void {
  supplementOrders.clear()
}

export function removeSupplementOrderForRollback(id: string, confirmationKey: string): void {
  const existing = supplementOrders.get(id)
  if (existing?.confirmationKey === confirmationKey && existing.status === '未完成') supplementOrders.delete(id)
}
