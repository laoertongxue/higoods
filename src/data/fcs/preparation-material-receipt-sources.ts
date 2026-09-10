import { getProcessOrderTaskRelationView } from './process-order-task-links.ts'
import { listPdaHandoverHeads, getPdaHandoverRecordsByHead } from './pda-handover-events.ts'
import {
  listWarehouseInternalTransferOrders,
  listWarehouseInternalTransferOrdersByOrder,
  listWarehouseIssueOrders,
  listWarehouseIssueOrdersByOrder,
  type WarehouseInternalTransferOrder,
  type WarehouseIssueOrder,
} from './warehouse-material-execution.ts'
import type { ProcessOrderInputSourceType } from './process-order-flow-contract.ts'
import { getProductionOrderProcessEntries } from './production-order-tech-pack-runtime.ts'

export interface PreparationMaterialReceiptSourceOption {
  sourceType: ProcessOrderInputSourceType
  recordId: string
  documentId: string
  documentNo: string
  lineId: string
  label: string
  unit: string
  availableQty: number
  sourceWarehouseId?: string
  sourceWarehouseName?: string
  targetWarehouseId?: string
  targetWarehouseName?: string
  predecessorOrderId?: string
  predecessorOrderNo?: string
  routeObjectKey?: string
}

export interface PreparationMaterialReceiptSourceResult {
  requiresSource: true
  /** @deprecated 仅供旧调用方兼容；新逻辑应读取 sourceMode 和 requiresSource。 */
  requiresUpstream: boolean
  sourceMode: ProcessOrderInputSourceType | 'UNRESOLVED'
  options: PreparationMaterialReceiptSourceOption[]
  blockReason?: string
}

export interface PreparationConsumedSourceQuantity {
  sourceRecordId?: string
  qty: number
}

export interface PreparationMaterialReceiptSourceConstraints {
  targetFactoryId?: string
  targetTaskId?: string
  materialCodes?: readonly string[]
  bomItemIds?: readonly string[]
}

type CentralTransferDocument = WarehouseIssueOrder | WarehouseInternalTransferOrder

function normalizeProcessCode(processCode: string): string {
  return processCode.trim().toUpperCase().replace(/^PROC_/, '').replaceAll('-', '_')
}

function matchesMaterialConstraint(
  line: CentralTransferDocument['lines'][number],
  materialCodes: readonly string[],
): boolean {
  if (materialCodes.length === 0) return true
  const facts = [line.materialCode, line.skuCode, line.sourceTaskId]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(value => value.trim())
  return materialCodes.some(code => facts.includes(code.trim()))
}

// 中央仓对外发加工厂形成出库单，对仓内加工区形成内部调拨单；两者都是首道加工单的可追溯投入来源。
export function normalizeCentralTransferReceiptSources(input: {
  documents: readonly CentralTransferDocument[]
  processCode: string
  currentDocumentId: string
  qtyUnit: string
  consumed: readonly PreparationConsumedSourceQuantity[]
  routeObjectKey?: string
  constraints?: PreparationMaterialReceiptSourceConstraints
}): PreparationMaterialReceiptSourceOption[] {
  const consumedByRecord = new Map<string, number>()
  input.consumed.forEach((item) => {
    if (!item.sourceRecordId || !Number.isFinite(item.qty) || item.qty <= 0) return
    consumedByRecord.set(item.sourceRecordId, (consumedByRecord.get(item.sourceRecordId) ?? 0) + item.qty)
  })
  const expectedProcessCode = normalizeProcessCode(input.processCode)
  const materialCodes = (input.constraints?.materialCodes ?? []).filter(code => code.trim())

  return input.documents
    .filter(doc => (
      normalizeProcessCode(doc.processCode) === expectedProcessCode
      || doc.runtimeTaskId === input.currentDocumentId
    ))
    .filter(doc => !input.constraints?.targetFactoryId || doc.targetFactoryId === input.constraints.targetFactoryId)
    .filter(doc => !input.constraints?.targetTaskId || doc.runtimeTaskId === input.constraints.targetTaskId)
    .flatMap(doc => doc.lines
      .filter(line => matchesMaterialConstraint(line, materialCodes))
      .map((line): PreparationMaterialReceiptSourceOption => {
        const transferredQty = doc.docType === 'ISSUE' ? line.issuedQty : line.transferredQty
        return {
          sourceType: 'CENTRAL_TRANSFER',
          recordId: line.lineId,
          documentId: doc.id,
          documentNo: doc.docNo,
          lineId: line.lineId,
          label: `${doc.docNo} · ${line.materialCode || line.materialName}`,
          unit: line.unit,
          availableQty: Math.max(transferredQty - (consumedByRecord.get(line.lineId) ?? 0), 0),
          sourceWarehouseId: doc.warehouseId,
          sourceWarehouseName: doc.warehouseName,
          targetWarehouseId: doc.targetFactoryId ? `${doc.targetFactoryId}-WIP` : undefined,
          targetWarehouseName: doc.targetFactoryName ? `${doc.targetFactoryName}待加工仓` : '加工待加工仓',
          routeObjectKey: input.routeObjectKey,
        }
      }))
    .filter(record => record.unit === input.qtyUnit && record.availableQty > 0)
}

export function getPreparationMaterialSourceDocumentNo(sourceRecordId: string | undefined): string | undefined {
  if (!sourceRecordId) return undefined
  const centralDocument = [...listWarehouseIssueOrders(), ...listWarehouseInternalTransferOrders()]
    .find(document => document.lines.some(line => line.lineId === sourceRecordId))
  if (centralDocument) return centralDocument.docNo
  const handoverHead = listPdaHandoverHeads().find(head => (
    head.headType === 'HANDOUT'
    && getPdaHandoverRecordsByHead(head.handoverId).some(record => (record.handoverRecordId || record.recordId) === sourceRecordId)
  ))
  return handoverHead?.handoverOrderNo || handoverHead?.handoverOrderId
}

// 只返回中央仓原调拨行或直接前置加工单的原交出记录，不按物料、工厂或计划量猜来源。
export function getPreparationMaterialReceiptSources(
  orderId: string,
  qtyUnit: string,
  consumed: readonly PreparationConsumedSourceQuantity[] = [],
  constraints: PreparationMaterialReceiptSourceConstraints = {},
): PreparationMaterialReceiptSourceResult {
  const relation = getProcessOrderTaskRelationView(orderId)
  if (!relation) {
    return {
      requiresSource: true,
      requiresUpstream: false,
      sourceMode: 'UNRESOLVED',
      options: [],
      blockReason: '未找到加工单对应的正式路线，暂不能接收。',
    }
  }
  const currentBomItemIds = new Set((constraints.bomItemIds?.length ? constraints.bomItemIds : relation.current.bomItemIds).filter(Boolean))
  const currentRouteObjectKeys = new Set(relation.current.routeObjectKeys ?? [])
  const matchesCurrentObjectBranch = (candidate: { bomItemIds?: readonly string[]; routeObjectKeys?: readonly string[] }): boolean => {
    const candidateBomItemIds = candidate.bomItemIds ?? []
    const candidateRouteObjectKeys = candidate.routeObjectKeys ?? []
    if (currentRouteObjectKeys.size > 0 && candidateRouteObjectKeys.some(key => currentRouteObjectKeys.has(key))) return true
    if (currentBomItemIds.size > 0 && candidateBomItemIds.some(id => currentBomItemIds.has(id))) return true
    if ((currentRouteObjectKeys.size > 0 || currentBomItemIds.size > 0) && (candidateRouteObjectKeys.length > 0 || candidateBomItemIds.length > 0)) return false
    return true
  }
  const predecessors = relation.predecessors
    .filter((document) => document.documentKind !== 'SOURCE_DOCUMENT')
    .filter(matchesCurrentObjectBranch)
  const processEntries = relation.current.productionOrderId ? getProductionOrderProcessEntries(relation.current.productionOrderId) : []
  const pendingPredecessors = relation.pendingPredecessors.filter((pending) => {
    const entry = processEntries.find(item => item.id === pending.occurrenceEntryId)
    return matchesCurrentObjectBranch({
      bomItemIds: entry?.linkedBomItemIds,
      routeObjectKeys: [entry?.routeObjectKey].filter((value): value is string => Boolean(value)),
    })
  })
  const hasRoutePredecessor = predecessors.length > 0 || pendingPredecessors.length > 0
  if (!hasRoutePredecessor) {
    const documents = relation.current.productionOrderId
      ? [
          ...listWarehouseIssueOrdersByOrder(relation.current.productionOrderId),
          ...listWarehouseInternalTransferOrdersByOrder(relation.current.productionOrderId),
        ]
      : []
    const options = normalizeCentralTransferReceiptSources({
      documents,
      processCode: relation.current.processCode,
      currentDocumentId: relation.current.documentId,
      qtyUnit,
      consumed,
      routeObjectKey: relation.current.routeObjectKeys?.[0],
      constraints,
    })
    return {
      requiresSource: true,
      requiresUpstream: false,
      sourceMode: 'CENTRAL_TRANSFER',
      options,
      blockReason: options.length > 0 ? undefined : '未找到中央仓调拨到本加工厂待加工仓的可接收记录。',
    }
  }
  const heads = listPdaHandoverHeads().filter(head => head.headType === 'HANDOUT' && predecessors.some(doc => doc.documentId === head.taskId || doc.documentNo === head.taskNo || doc.documentNo === head.sourceTaskNo))
  const predecessorById = new Map(predecessors.flatMap((document) => [
    [document.documentId, document],
    [document.documentNo, document],
  ]))
  const options = heads
    .flatMap(head => getPdaHandoverRecordsByHead(head.handoverId).map(record => ({ head, record, qtyUnit: record.qtyUnit || head.qtyUnit })))
    .filter(({ record }) => record.handoverRecordStatus !== 'VOIDED')
    .map(({ head, record, qtyUnit: sourceUnit }): PreparationMaterialReceiptSourceOption => {
      const predecessor = predecessorById.get(head.taskId) || predecessorById.get(head.taskNo) || predecessorById.get(head.sourceTaskNo || '')
      const recordId = record.handoverRecordId || record.recordId
      const documentNo = head.handoverOrderNo || head.handoverOrderId || head.handoverId
      return {
        sourceType: 'UPSTREAM_HANDOUT',
        recordId,
        documentId: head.handoverId,
        documentNo,
        lineId: recordId,
        label: `${documentNo} · ${record.handoverRecordNo || recordId}`,
        unit: sourceUnit || '',
        availableQty: Math.max((record.submittedQty ?? record.plannedQty ?? 0) - (record.receiverWrittenQty ?? record.warehouseWrittenQty ?? 0), 0),
        targetWarehouseId: head.receiverId,
        targetWarehouseName: head.targetName,
        predecessorOrderId: predecessor?.documentId,
        predecessorOrderNo: predecessor?.documentNo,
        routeObjectKey: relation.current.routeObjectKeys?.[0],
      }
    })
    .filter(record => record.unit === qtyUnit && record.availableQty > 0)
  return {
    requiresSource: true,
    requiresUpstream: true,
    sourceMode: 'UPSTREAM_HANDOUT',
    options,
    blockReason: options.length > 0 ? undefined : '直接上游尚无可接收的交出记录。',
  }
}
