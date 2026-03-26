import { productionOrders } from './production-orders.ts'
import { buildDeductionEntryHrefByBasisId } from './quality-chain-adapter.ts'
import { listMaterialStatementDraftsForSettlement } from './store-domain-dispatch-process.ts'
import { initialDeductionBasisItems } from './store-domain-quality-seeds.ts'
import { initialPayableAdjustments, initialStatementDrafts } from './store-domain-settlement-seeds.ts'
import type { DeductionBasisItem, SettlementPartyType } from './store-domain-quality-types.ts'
import type {
  PayableAdjustment,
  StatementDraftItem,
  StatementSourceItemType,
  StatementStatus,
} from './store-domain-settlement-types.ts'
import type { MaterialStatementDraft } from './store-domain-dispatch-process.ts'

export interface StatementSourceItemViewModel {
  sourceItemId: string
  sourceType: StatementSourceItemType
  sourceLabelZh: string
  settlementPartyType: SettlementPartyType | string
  settlementPartyId: string
  productionOrderId?: string
  taskId?: string
  qty: number
  amount: number
  currency: string
  sourceStatus: string
  sourceStatusZh: string
  occurredAt?: string
  createdAt?: string
  updatedAt?: string
  routeToSource: string
  canEnterStatement: boolean
  alreadyBoundStatementId?: string
  sourceReason?: string
  remark?: string
}

const SOURCE_LABEL_ZH: Record<StatementSourceItemType, string> = {
  QUALITY_BASIS: '质量来源',
  PAYABLE_ADJUSTMENT: '应付调整',
  MATERIAL_STATEMENT: '车缝领料对账',
}

const QUALITY_STATUS_ZH: Record<string, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  DISPUTED: '争议中',
  VOID: '已作废',
}

const ADJUSTMENT_STATUS_ZH: Record<string, string> = {
  DRAFT: '待入对账单',
  EFFECTIVE: '已生效',
  VOID: '已作废',
}

const MATERIAL_STATUS_ZH: Record<string, string> = {
  DRAFT: '草稿中',
  CONFIRMED: '已确认',
  CLOSED: '已关闭',
}

const MATERIAL_SETTLEMENT_RATE_PER_UNIT = 1.2

function buildAdjustmentHref(adjustmentId: string, linkedStatementId?: string): string {
  const params = new URLSearchParams()
  params.set('keyword', adjustmentId)
  if (linkedStatementId) params.set('view', 'bound')
  return `/fcs/settlement/adjustments?${params.toString()}`
}

function buildMaterialStatementHref(
  materialStatementId: string,
  status: MaterialStatementDraft['status'],
): string {
  const params = new URLSearchParams()
  params.set('keyword', materialStatementId)
  if (status === 'DRAFT') params.set('view', 'draft')
  if (status === 'CONFIRMED') params.set('view', 'confirmed')
  if (status === 'CLOSED') params.set('view', 'closed')
  params.set('detail', materialStatementId)
  return `/fcs/settlement/material-statements?${params.toString()}`
}

function getStatementBindingMap(): Map<string, string> {
  const map = new Map<string, string>()
  for (const statement of initialStatementDrafts) {
    if (statement.status === 'CLOSED') continue
    for (const item of statement.items) {
      map.set(item.sourceItemId ?? item.basisId, statement.statementId)
    }
    for (const basisId of statement.itemBasisIds) {
      if (!map.has(basisId)) map.set(basisId, statement.statementId)
    }
    for (const sourceId of statement.itemSourceIds ?? []) {
      if (!map.has(sourceId)) map.set(sourceId, statement.statementId)
    }
  }
  return map
}

function resolveMaterialSettlementParty(
  draft: MaterialStatementDraft,
): { settlementPartyType: SettlementPartyType | 'OTHER'; settlementPartyId: string } {
  const order = productionOrders.find((item) => item.productionOrderId === draft.productionOrderId)
  if (order?.mainFactoryId) {
    return {
      settlementPartyType: 'FACTORY',
      settlementPartyId: order.mainFactoryId,
    }
  }
  return {
    settlementPartyType: 'OTHER',
    settlementPartyId: draft.productionOrderId,
  }
}

function getMaterialStatementAmount(draft: MaterialStatementDraft): number {
  return Number((draft.totalIssuedQty * MATERIAL_SETTLEMENT_RATE_PER_UNIT).toFixed(2))
}

export function mapQualityBasisToStatementSourceItem(
  basis: DeductionBasisItem,
  bindingMap: Map<string, string>,
): StatementSourceItemViewModel {
  const qty = basis.deductionQty ?? basis.qty ?? 0
  const amount =
    typeof basis.deductionAmount === 'number'
      ? basis.deductionAmount
      : typeof basis.deductionAmountSnapshot === 'number'
        ? basis.deductionAmountSnapshot
        : 0
  const alreadyBoundStatementId = bindingMap.get(basis.basisId)

  return {
    sourceItemId: basis.basisId,
    sourceType: 'QUALITY_BASIS',
    sourceLabelZh: SOURCE_LABEL_ZH.QUALITY_BASIS,
    settlementPartyType: basis.settlementPartyType ?? 'OTHER',
    settlementPartyId: basis.settlementPartyId ?? basis.factoryId ?? '-',
    productionOrderId: basis.productionOrderId,
    taskId: basis.taskId,
    qty,
    amount,
    currency: 'CNY',
    sourceStatus: basis.status,
    sourceStatusZh: QUALITY_STATUS_ZH[basis.status] ?? basis.status,
    occurredAt: basis.updatedAt ?? basis.createdAt,
    createdAt: basis.createdAt,
    updatedAt: basis.updatedAt,
    routeToSource: buildDeductionEntryHrefByBasisId(basis.basisId),
    canEnterStatement:
      basis.settlementReady === true
      && basis.status !== 'VOID'
      && qty > 0
      && !alreadyBoundStatementId,
    alreadyBoundStatementId,
    sourceReason: basis.reasonCode,
    remark: basis.summary,
  }
}

export function mapPayableAdjustmentToStatementSourceItem(
  adjustment: PayableAdjustment,
  bindingMap: Map<string, string>,
): StatementSourceItemViewModel {
  const alreadyBoundStatementId = bindingMap.get(adjustment.adjustmentId) ?? adjustment.linkedStatementId

  return {
    sourceItemId: adjustment.adjustmentId,
    sourceType: 'PAYABLE_ADJUSTMENT',
    sourceLabelZh: SOURCE_LABEL_ZH.PAYABLE_ADJUSTMENT,
    settlementPartyType: adjustment.settlementPartyType,
    settlementPartyId: adjustment.settlementPartyId,
    productionOrderId: adjustment.productionOrderId,
    taskId: adjustment.taskId,
    qty: 1,
    amount: adjustment.amount,
    currency: adjustment.currency,
    sourceStatus: adjustment.status,
    sourceStatusZh:
      adjustment.status === 'DRAFT' && alreadyBoundStatementId
        ? '已入对账单'
        : (ADJUSTMENT_STATUS_ZH[adjustment.status] ?? adjustment.status),
    occurredAt: adjustment.updatedAt ?? adjustment.createdAt,
    createdAt: adjustment.createdAt,
    updatedAt: adjustment.updatedAt,
    routeToSource: buildAdjustmentHref(adjustment.adjustmentId, alreadyBoundStatementId),
    canEnterStatement: adjustment.status === 'DRAFT' && !alreadyBoundStatementId,
    alreadyBoundStatementId,
    sourceReason: adjustment.relatedBasisId ? `关联依据 ${adjustment.relatedBasisId}` : TYPE_LABEL_ZH[adjustment.adjustmentType],
    remark: adjustment.remark,
  }
}

const TYPE_LABEL_ZH: Record<PayableAdjustment['adjustmentType'], string> = {
  DEDUCTION_SUPPLEMENT: '扣款补录',
  COMPENSATION: '补差',
  REVERSAL: '冲销',
}

export function mapMaterialStatementToStatementSourceItem(
  draft: MaterialStatementDraft,
  bindingMap: Map<string, string>,
): StatementSourceItemViewModel {
  const party = resolveMaterialSettlementParty(draft)
  const alreadyBoundStatementId = bindingMap.get(draft.materialStatementId)

  return {
    sourceItemId: draft.materialStatementId,
    sourceType: 'MATERIAL_STATEMENT',
    sourceLabelZh: SOURCE_LABEL_ZH.MATERIAL_STATEMENT,
    settlementPartyType: party.settlementPartyType,
    settlementPartyId: party.settlementPartyId,
    productionOrderId: draft.productionOrderId,
    qty: draft.totalIssuedQty,
    amount: getMaterialStatementAmount(draft),
    currency: 'CNY',
    sourceStatus: draft.status,
    sourceStatusZh:
      draft.status === 'CONFIRMED' && alreadyBoundStatementId
        ? '已入对账单'
        : (MATERIAL_STATUS_ZH[draft.status] ?? draft.status),
    occurredAt: draft.updatedAt ?? draft.createdAt,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    routeToSource: buildMaterialStatementHref(draft.materialStatementId, draft.status),
    canEnterStatement: draft.status === 'CONFIRMED' && !alreadyBoundStatementId && draft.totalIssuedQty > 0,
    alreadyBoundStatementId,
    sourceReason: `已确认 ${draft.itemCount} 条领料记录`,
    remark: draft.remark,
  }
}

export function listStatementSourceItems(): StatementSourceItemViewModel[] {
  const bindingMap = getStatementBindingMap()
  return [
    ...initialDeductionBasisItems.map((basis) => mapQualityBasisToStatementSourceItem(basis, bindingMap)),
    ...initialPayableAdjustments.map((adjustment) => mapPayableAdjustmentToStatementSourceItem(adjustment, bindingMap)),
    ...listMaterialStatementDraftsForSettlement().map((draft) => mapMaterialStatementToStatementSourceItem(draft, bindingMap)),
  ].sort((left, right) => {
    const leftTime = left.updatedAt ?? left.createdAt ?? ''
    const rightTime = right.updatedAt ?? right.createdAt ?? ''
    return leftTime < rightTime ? 1 : leftTime > rightTime ? -1 : 0
  })
}

export function toStatementDraftItemFromSource(
  item: StatementSourceItemViewModel,
): StatementDraftItem {
  return {
    sourceItemId: item.sourceItemId,
    sourceItemType: item.sourceType,
    sourceLabelZh: item.sourceLabelZh,
    sourceRefLabel: item.sourceItemId,
    routeToSource: item.routeToSource,
    settlementPartyType: item.settlementPartyType,
    settlementPartyId: item.settlementPartyId,
    basisId: item.sourceType === 'QUALITY_BASIS' ? item.sourceItemId : item.sourceItemId,
    deductionQty: item.qty,
    deductionAmount: item.amount,
    currency: item.currency,
    remark: item.remark,
    productionOrderId: item.productionOrderId,
    taskId: item.taskId,
    sourceType:
      item.sourceType === 'QUALITY_BASIS'
        ? 'QC_FAIL'
        : item.sourceType === 'PAYABLE_ADJUSTMENT'
          ? 'PAYABLE_ADJUSTMENT'
          : 'MATERIAL_STATEMENT',
  }
}

export function getStatementSourceItemById(sourceItemId: string): StatementSourceItemViewModel | undefined {
  return listStatementSourceItems().find((item) => item.sourceItemId === sourceItemId)
}
