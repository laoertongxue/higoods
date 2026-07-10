import { listMaterialArchives } from '../pcs-material-archive-repository.ts'
import {
  getProductionOrderChangeCurrentFacts,
  listProductionOrderTechPackRelations,
} from './production-tech-pack-change-domain.ts'
import { productionOrders, type ProductionOrderStatus } from './production-orders.ts'
import { resolveLinkedDemandForProductionOrder } from './production-upstream-chain.ts'

export type ProductionChangeType = 'QUANTITY_CHANGE' | 'MATERIAL_REPLACEMENT'

export type ProductionChangeResult = 'PRODUCTION_PATCH' | 'VERSION_RELATION' | 'VERSION_AND_PATCH'

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
  const demand = resolveLinkedDemandForProductionOrder(productionOrderId)
  if (!demand) return []

  return demand.skuLines.map((line, index) => ({
    id: `${productionOrderId}-QTY-${index + 1}`,
    skuCode: line.skuCode,
    color: line.color,
    size: line.size,
    originalQty: line.qty,
    currentQty: line.qty,
    targetQty: line.qty,
    unit: '件',
    isNew: false,
    coveredByCurrentVersion: true,
  }))
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
  if (quantityLines.length === 0) return []

  const allocations = quantityLines.map((line, index) => {
    const normalizedDemandQty = Number.isFinite(line.currentQty) ? Math.round(line.currentQty) : 0
    const demandQty = Math.max(0, normalizedDemandQty)
    const oldMaterialFactQty = Math.floor(demandQty * 0.55)
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

export interface ProductionChangeDraft {
  productionOrderId: string
  changeType: ProductionChangeType
  reason: string
  quantityLines: QuantityChangeLine[]
  materialReplacement: MaterialReplacementDraft | null
  decisionValues: Record<string, { value: string; reason: string }>
  affectedDocumentNos?: string[]
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

export interface ProductionChangePreview {
  result: ProductionChangeResult
  resultReason: string
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
    defaultValue?: string
    suggestedValue?: string
  },
): ProductionChangePlanItem {
  const decision = draft.decisionValues[input.id]
  const { defaultValue = '', suggestedValue, reasonRequired, ...item } = input
  const selectedValue = decision?.value ?? defaultValue
  return {
    ...item,
    kind: 'MERCHANDISER_DECISION',
    selectedValue,
    reason: decision?.reason ?? '',
    reasonRequired: reasonRequired || (suggestedValue !== undefined && selectedValue !== suggestedValue),
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
  autoItems.push(
    ...buildDocumentPlanItems(
      'quantity-current-document',
      '重算关联单据',
      '系统按当前执行事实调整未执行数量；已领、已裁、已加工和已完工事实保持不变。',
      sanitizeObjectIds(draft.affectedDocumentNos),
    ),
  )

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
    decisionItems: [],
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
    followingModes.forEach(({ order, finalMode }) => {
      if (!order.started) {
        autoItems.push(
          createAutoItem({
            id: `following-order-auto-${order.productionOrderId}`,
            group: '上下游单据',
            title: `同步后续生产单 ${order.productionOrderId}`,
            description: '该生产单尚未开工，系统将全部切换新正式版本并重算备料与交期。',
            affectedDocumentNo: '',
          }),
        )
      } else {
        const isRemaining = finalMode === 'REMAINING'
        decisionItems.push(
          createDecisionItem(draft, {
            id: `following-order-mode-${order.productionOrderId}`,
            group: '上下游单据',
            title: `确认已开工生产单 ${order.productionOrderId} 的替换方式`,
            description: isRemaining
              ? `${order.progressText}，该生产单按剩余部分打补丁并同步切换正式版本。`
              : `${order.progressText}，该生产单按全部数量整体切换新正式版本。`,
            affectedDocumentNo: '',
            options: [
              { value: 'REMAINING', label: '只替换剩余数量' },
              { value: 'FULL', label: '全部数量改用新物料' },
            ],
            defaultValue: order.confirmedMode ?? order.suggestedMode,
            suggestedValue: order.suggestedMode,
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
        title: '保留旧面料已形成事实',
        description: `已有 ${oldMaterialFactQty} 件对应的旧面料事实数量，系统继续计入当前生产单，只替换剩余数量。`,
        affectedDocumentNo: '',
      }),
    )
  }
  if (oldMaterialFactQty > 0 && replacement.replacementMode === 'FULL') {
    decisionItems.push(
      createDecisionItem(draft, {
        id: 'old-material-disposition',
        group: '实物去向',
        title: '确认旧面料实物去向',
        description: `已有 ${oldMaterialFactQty} 件对应的旧面料事实数量，全部替换后需确认不再计入当前需求的实物去向。`,
        affectedDocumentNo: '',
        options: [
          { value: 'RETURN_TO_STOCK', label: '转库存' },
          { value: 'TRANSFER_USE', label: '转其他生产单使用' },
          { value: 'DISPOSE', label: '报损或其他处置' },
        ],
        reasonRequired: true,
      }),
    )
  }

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
