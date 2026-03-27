import { productionOrders } from '../production-orders'
import { listGeneratedProductionDemandArtifacts } from '../production-artifact-generation'
import type { ProcessTask } from '../process-tasks'
import {
  listProgressExceptions,
  listProgressFacts,
  listProgressMaterialStatementDrafts,
  type ExceptionCase,
} from '../store-domain-progress'
import { listExecutionTaskFacts } from './task-execution-adapter'

export interface LegacyLikeQualityInspection {
  qcId: string
  productionOrderId: string
  status: 'DRAFT' | 'SUBMITTED' | 'CLOSED'
  liabilityStatus: 'DRAFT' | 'CONFIRMED' | 'DISPUTED'
  result: 'PASS' | 'FAIL'
  createdAt: string
  updatedAt?: string
}

export interface LegacyLikeDeductionBasisItem {
  basisId: string
  status: 'DRAFT' | 'CONFIRMED' | 'DISPUTED' | 'VOID'
  settlementReady: boolean
  settlementFreezeReason?: string
  sourceRefId: string
  sourceId: string
  factoryId?: string
  createdAt: string
  updatedAt?: string
}

export interface LegacyLikeDyePrintOrder {
  dpId: string
  productionOrderId: string
  processorFactoryId?: string
  availableQty: number
  returnedFailQty: number
  returnBatches: Array<{ batchId: string }>
}

export interface LegacyLikeStatementDraft {
  statementId: string
  status: 'DRAFT' | 'CONFIRMED' | 'CLOSED'
  itemBasisIds: string[]
  totalAmount: number
  createdAt: string
  updatedAt?: string
}

export interface LegacyLikeSettlementBatch {
  batchId: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED'
  totalAmount: number
  createdAt: string
  updatedAt?: string
}

function resolveOrderFactoryId(orderId: string): string | undefined {
  const order = productionOrders.find((item) => item.productionOrderId === orderId)
  return order?.mainFactoryId
}

function toLegacyQcResult(exception: ExceptionCase): 'PASS' | 'FAIL' {
  if (
    exception.reasonCode === 'MATERIAL_QTY_SHORT'
    || exception.reasonCode === 'HANDOUT_DIFF'
    || exception.reasonCode === 'HANDOUT_PENDING_CHECK'
  ) {
    return 'FAIL'
  }
  return 'PASS'
}

export function listLegacyLikeProcessTasksForTailPages(): ProcessTask[] {
  return listExecutionTaskFacts().filter((task) => task.defaultDocType !== 'DEMAND')
}

export function listLegacyLikeExceptionsForTailPages(): ExceptionCase[] {
  return listProgressExceptions()
}

export function listLegacyLikeQualityInspectionsForTailPages(): LegacyLikeQualityInspection[] {
  return listProgressExceptions()
    .map((exception) => {
      const productionOrderId = exception.relatedOrderIds[0] ?? ''
      const status: LegacyLikeQualityInspection['status'] =
        exception.caseStatus === 'CLOSED' ? 'CLOSED' : 'SUBMITTED'
      const liabilityStatus: LegacyLikeQualityInspection['liabilityStatus'] =
        exception.caseStatus === 'IN_PROGRESS'
          ? 'DISPUTED'
          : exception.caseStatus === 'RESOLVED' || exception.caseStatus === 'CLOSED'
            ? 'CONFIRMED'
            : 'DRAFT'

      return {
        qcId: `QC-${exception.caseId}`,
        productionOrderId,
        status,
        liabilityStatus,
        result: toLegacyQcResult(exception),
        createdAt: exception.createdAt,
        updatedAt: exception.updatedAt ?? exception.createdAt,
      } satisfies LegacyLikeQualityInspection
    })
    .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
}

export function listLegacyLikeDeductionBasisForTailPages(): LegacyLikeDeductionBasisItem[] {
  return listLegacyLikeQualityInspectionsForTailPages().map((qc) => {
    const factoryId = resolveOrderFactoryId(qc.productionOrderId)
    const status: LegacyLikeDeductionBasisItem['status'] =
      qc.liabilityStatus === 'DISPUTED'
        ? 'DISPUTED'
        : qc.liabilityStatus === 'CONFIRMED'
          ? 'CONFIRMED'
          : 'DRAFT'
    const settlementReady = status === 'CONFIRMED'

    return {
      basisId: `BAS-${qc.qcId}`,
      status,
      settlementReady,
      settlementFreezeReason: status === 'DISPUTED' ? '争议冻结，待仲裁结论' : undefined,
      sourceRefId: qc.qcId,
      sourceId: qc.qcId,
      factoryId,
      createdAt: qc.createdAt,
      updatedAt: qc.updatedAt ?? qc.createdAt,
    } satisfies LegacyLikeDeductionBasisItem
  })
}

export function listLegacyLikeDyePrintOrdersForTailPages(): LegacyLikeDyePrintOrder[] {
  const demandArtifacts = listGeneratedProductionDemandArtifacts()
    .filter((item) => item.processCode === 'PRINT' || item.processCode === 'DYE')
    .sort((a, b) => a.artifactId.localeCompare(b.artifactId))
  const exceptions = listProgressExceptions()

  return demandArtifacts.map((artifact) => {
    const orderId = artifact.orderId
    const openMaterialException = exceptions.some(
      (exception) =>
        exception.caseStatus !== 'CLOSED'
        && exception.caseStatus !== 'RESOLVED'
        && exception.relatedOrderIds.includes(orderId)
        && (
          exception.reasonCode === 'MATERIAL_NOT_READY'
          || exception.reasonCode === 'MATERIAL_PREP_PENDING'
          || exception.reasonCode === 'MATERIAL_QTY_SHORT'
        ),
    )

    const handoutDiffCount = exceptions.filter(
      (exception) =>
        exception.relatedOrderIds.includes(orderId)
        && exception.reasonCode === 'HANDOUT_DIFF'
        && exception.caseStatus !== 'CLOSED',
    ).length

    const availableQty = openMaterialException ? 0 : Math.max(artifact.orderQty, 0)
    const returnedFailQty = handoutDiffCount * 10

    return {
      dpId: `DPO-${artifact.orderId}-${artifact.processCode}`,
      productionOrderId: artifact.orderId,
      processorFactoryId: resolveOrderFactoryId(orderId),
      availableQty,
      returnedFailQty,
      returnBatches: [{ batchId: `RTB-${artifact.artifactId}` }],
    } satisfies LegacyLikeDyePrintOrder
  })
}

export function listLegacyLikeStatementDraftsForTailPages(): LegacyLikeStatementDraft[] {
  return listProgressMaterialStatementDrafts().map((draft) => ({
    statementId: draft.materialStatementId,
    status: draft.status,
    itemBasisIds: draft.items.map((item) => `BAS-${item.taskId}`),
    totalAmount: draft.totalIssuedQty * 12 + draft.totalRequestedQty * 3,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt ?? draft.createdAt,
  }))
}

export function listLegacyLikeSettlementBatchesForTailPages(): LegacyLikeSettlementBatch[] {
  return listLegacyLikeStatementDraftsForTailPages()
    .filter((statement) => statement.status === 'CONFIRMED' || statement.status === 'CLOSED')
    .map((statement, index) => ({
      batchId: `STB-${String(index + 1).padStart(3, '0')}`,
      status: statement.status === 'CLOSED' ? 'COMPLETED' : 'PROCESSING',
      totalAmount: statement.totalAmount,
      createdAt: statement.createdAt,
      updatedAt: statement.updatedAt,
    }))
}

export function getTailPageTaskFactsByOrder(orderId: string): ReturnType<typeof listProgressFacts> {
  return listProgressFacts().filter((fact) => fact.productionOrderId === orderId)
}
