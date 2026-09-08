import { getProductionOrderProcessEntries } from './production-order-tech-pack-runtime.ts'
import { listProcessWorkOrderRelationSources, PROCESS_WORK_ORDER_SOURCE_LABEL } from './process-work-order-domain.ts'
import { processTasks } from './process-tasks.ts'
import {
  listLaceProductionOrders,
  PLATFORM_ADMIN,
  type LaceProductionOrderView,
} from './lace-factory-domain.ts'
import { productionOrders } from './production-orders.ts'
import type { TechnicalBomItem, TechnicalProcessEntry } from '../pcs-technical-data-version-types.ts'
import { buildBindingProcessOrders } from '../../pages/process-factory/cutting/binding-strip-orders.ts'
import { listGeneratedCutOrderSourceRecords } from './cutting/generated-cut-orders.ts'
import { listSpecialCraftTaskOrders } from './special-craft-task-orders.ts'
import { buildSpecialCraftTaskDetailPath } from './special-craft-operations.ts'
import { listWoolWorkOrders, type WoolWorkOrder } from './wool-task-domain.ts'

export type ProcessOrderTaskDocumentKind = 'SOURCE_DOCUMENT' | 'PREPARATION_ORDER' | 'PRODUCTION_TASK'

export interface ProcessOrderTaskDetailRef {
  detailId: string
  label: string
  sourceEntryIds: string[]
  routeObjectKeys: string[]
  bomItemIds: string[]
}

export interface ProcessOrderTaskDocumentRef {
  documentId: string
  documentNo: string
  documentKind: ProcessOrderTaskDocumentKind
  documentTypeLabel: string
  productionOrderId?: string
  productionOrderNo?: string
  techPackVersionId?: string
  techPackVersionLabel?: string
  processCode: string
  processName: string
  sourceEntryIds: string[]
  processEntryIds?: string[]
  routeObjectKeys?: string[]
  bomItemIds: string[]
  formalRouteLinkStatus?: 'LINKED' | 'UNLINKED'
  sourceLabel: string
  objectLabel: string
  quantityLabel: string
  href?: string
  detailLabels?: string[]
  detailRefs?: ProcessOrderTaskDetailRef[]
  predecessorDocumentIds?: string[]
  successorDocumentIds?: string[]
}

export interface LaceFormalProductionRouteSnapshot {
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  techPackVersionId: string
  techPackVersionLabel: string
  bomItems: Array<Pick<TechnicalBomItem, 'id' | 'type' | 'materialCode' | 'materialSkuId'>>
  processEntries: TechnicalProcessEntry[]
}

export interface LaceFormalChainIdentity {
  productionOrderId: string
  productionOrderNo: string
  techPackVersionId: string
  techPackVersionLabel: string
  bomItemIds: string[]
  dyeProcessEntryIds: string[]
  laceProcessEntryIds: string[]
  consumerProcessEntryIds: string[]
}

export type LaceProcessOrderTaskSource = Pick<
  LaceProductionOrderView,
  | 'workOrderId'
  | 'workOrderNo'
  | 'generationKey'
  | 'purchaseOrderId'
  | 'purchaseOrderNo'
  | 'purchaseVersion'
  | 'skuId'
  | 'skuCode'
  | 'materialName'
  | 'planQty'
  | 'unit'
  | 'sourceLines'
  | 'inputLines'
  | 'processingOutput'
  | 'targetWarehouseName'
>

export interface ProcessOrderTaskLink {
  linkId: string
  productionOrderId: string
  predecessorDocumentId: string
  predecessorEntryId: string
  predecessorDetailIds: string[]
  successorDocumentId: string
  successorEntryId: string
  successorDetailIds: string[]
  routeObjectKey?: string
}

export interface PendingProcessOrderTaskRef {
  productionOrderId: string
  occurrenceEntryId: string
  stageCode: 'PREP' | 'PROD'
  processCode: string
  processName: string
  routeObjectKey?: string
  inputObjectType?: TechnicalProcessEntry['inputObjectType']
  outputObjectType?: TechnicalProcessEntry['outputObjectType']
  relationStatus: 'PENDING_DOCUMENT'
}

export interface ProcessOrderTaskRelationView {
  current: ProcessOrderTaskDocumentRef
  demandSource: string
  predecessors: ProcessOrderTaskDocumentRef[]
  successors: ProcessOrderTaskDocumentRef[]
  pendingPredecessors: PendingProcessOrderTaskRef[]
  pendingSuccessors: PendingProcessOrderTaskRef[]
  taskDetails: string[]
  selectedDetailId?: string
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim() || '').filter(Boolean))]
}

function resolveRouteObjectKeys(productionOrderId: string | undefined, sourceEntryIds: string[]): string[] {
  if (!productionOrderId || sourceEntryIds.length === 0) return []
  const sourceEntryIdSet = new Set(sourceEntryIds)
  return unique(
    getProductionOrderProcessEntries(productionOrderId)
      .filter((entry) => sourceEntryIdSet.has(entry.id))
      .map((entry) => entry.routeObjectKey),
  )
}

function buildDetailRef(input: {
  detailId: string
  label: string
  sourceEntryIds?: string[]
  routeObjectKeys?: string[]
  bomItemIds?: string[]
}): ProcessOrderTaskDetailRef {
  return {
    detailId: input.detailId,
    label: input.label,
    sourceEntryIds: unique(input.sourceEntryIds ?? []),
    routeObjectKeys: unique(input.routeObjectKeys ?? []),
    bomItemIds: unique(input.bomItemIds ?? []),
  }
}

function listDocumentDetailIdsForEntry(document: ProcessOrderTaskDocumentRef, entryId: string): string[] {
  const detailRefs = document.detailRefs ?? []
  if (detailRefs.length === 0) return []
  const matching = detailRefs.filter((detail) => (
    detail.sourceEntryIds.length === 0 || detail.sourceEntryIds.includes(entryId)
  ))
  return unique((matching.length > 0 ? matching : detailRefs).map((detail) => detail.detailId))
}

function listCurrentLaceFormalRouteSnapshots(): LaceFormalProductionRouteSnapshot[] {
  return productionOrders
    .filter((order) => !['DRAFT', 'CANCELLED', 'ON_HOLD'].includes(order.status))
    .flatMap((order) => {
      const snapshot = order.techPackSnapshot
      if (!snapshot) return []
      return [{
        productionOrderId: order.productionOrderId,
        productionOrderNo: order.productionOrderNo,
        styleCode: snapshot.styleCode,
        techPackVersionId: snapshot.sourceTechPackVersionId,
        techPackVersionLabel: snapshot.sourceTechPackVersionLabel || snapshot.versionLabel,
        bomItems: snapshot.bomItems,
        processEntries: snapshot.processEntries,
      }]
    })
}

export function resolveLaceFormalChainIdentity(
  order: LaceProcessOrderTaskSource,
  formalSnapshots: readonly LaceFormalProductionRouteSnapshot[],
): LaceFormalChainIdentity | undefined {
  const sourceStyleCodes = unique(order.sourceLines.map((line) => line.styleCode))
  if (sourceStyleCodes.length !== 1) return undefined
  const skuIdentities = new Set(unique([order.skuId, order.skuCode]))
  const candidates = formalSnapshots.flatMap((snapshot): LaceFormalChainIdentity[] => {
    if (
      snapshot.styleCode !== sourceStyleCodes[0]
      || !snapshot.productionOrderId.trim()
      || !snapshot.techPackVersionId.trim()
      || !snapshot.techPackVersionLabel.trim()
    ) return []

    const matchingBomItems = snapshot.bomItems.filter((item) => (
      item.type === '辅料'
      && unique([item.materialSkuId, item.materialCode]).some((identity) => skuIdentities.has(identity))
    ))
    if (matchingBomItems.length === 0) return []
    const matchingBomItemIds = new Set(matchingBomItems.map((item) => item.id))
    const laceEntries = snapshot.processEntries.filter((entry) => (
      entry.processCode === 'LACE_PROCESSING'
      && (entry.linkedBomItemIds ?? []).some((bomItemId) => matchingBomItemIds.has(bomItemId))
    ))
    const linkedBomItemIds = new Set(laceEntries.flatMap((entry) => (
      (entry.linkedBomItemIds ?? []).filter((bomItemId) => matchingBomItemIds.has(bomItemId))
    )))
    if (
      laceEntries.length === 0
      || matchingBomItems.some((item) => !linkedBomItemIds.has(item.id))
    ) return []

    const laceProcessEntryIds = laceEntries.map((entry) => entry.id)
    const laceProcessEntryIdSet = new Set(laceProcessEntryIds)
    const dyeProcessEntryIds = snapshot.processEntries
      .filter((entry) => entry.processCode === 'DYE')
      .filter((entry) => (entry.linkedBomItemIds ?? []).some((bomItemId) => linkedBomItemIds.has(bomItemId)))
      .filter((entry) => laceEntries.some((laceEntry) => (laceEntry.predecessorEntryIds ?? []).includes(entry.id)))
      .map((entry) => entry.id)
    const consumerProcessEntryIds = snapshot.processEntries
      .filter((entry) => (entry.predecessorEntryIds ?? []).some((entryId) => laceProcessEntryIdSet.has(entryId)))
      .filter((entry) => (entry.consumedBomItemIds ?? []).some((bomItemId) => linkedBomItemIds.has(bomItemId)))
      .map((entry) => entry.id)

    return [{
      productionOrderId: snapshot.productionOrderId,
      productionOrderNo: snapshot.productionOrderNo,
      techPackVersionId: snapshot.techPackVersionId,
      techPackVersionLabel: snapshot.techPackVersionLabel,
      bomItemIds: [...linkedBomItemIds],
      dyeProcessEntryIds,
      laceProcessEntryIds,
      consumerProcessEntryIds,
    }]
  })

  // 采购来源行没有生产单 ID。若同款同 SKU 同时命中多张正式生产单，无法证明
  // 这张采购/花边单具体服务哪一张生产单，必须保持未关联而不是任选一张。
  return candidates.length === 1 ? candidates[0] : undefined
}

export function buildLaceProcessOrderTaskDocuments(
  laceOrders: readonly LaceProcessOrderTaskSource[],
  formalSnapshots: readonly LaceFormalProductionRouteSnapshot[],
): ProcessOrderTaskDocumentRef[] {
  return laceOrders.flatMap((order) => {
    const identity = resolveLaceFormalChainIdentity(order, formalSnapshots)
    const formalSnapshot = identity
      ? formalSnapshots.find((snapshot) => snapshot.productionOrderId === identity.productionOrderId)
      : undefined
    const routeObjectKeys = unique(
      formalSnapshot?.processEntries
        .filter((entry) => identity?.laceProcessEntryIds.includes(entry.id))
        .map((entry) => entry.routeObjectKey) ?? [],
    )
    const purchaseDocumentId = identity
      ? `LACE-PURCHASE:${order.generationKey}`
      : `LACE-PURCHASE:${order.purchaseOrderId}`
    const commonIdentity = identity ? {
      productionOrderId: identity.productionOrderId,
      productionOrderNo: identity.productionOrderNo,
      techPackVersionId: identity.techPackVersionId,
      techPackVersionLabel: identity.techPackVersionLabel,
      bomItemIds: identity.bomItemIds,
      formalRouteLinkStatus: 'LINKED' as const,
    } : {
      bomItemIds: [] as string[],
      formalRouteLinkStatus: 'UNLINKED' as const,
    }
    const purchaseDocument: ProcessOrderTaskDocumentRef = {
      documentId: purchaseDocumentId,
      documentNo: order.purchaseOrderNo,
      documentKind: 'SOURCE_DOCUMENT',
      documentTypeLabel: '花边采购需求',
      ...commonIdentity,
      processCode: 'PURCHASE',
      processName: '采购备货',
      sourceEntryIds: [],
      processEntryIds: identity?.laceProcessEntryIds ?? [],
      routeObjectKeys,
      sourceLabel: `PMS 采购单 ${order.purchaseOrderNo}`,
      objectLabel: `${order.materialName} / ${order.skuCode}`,
      quantityLabel: `${order.planQty} ${order.unit}`,
      href: `/fcs/craft/accessory/lace/purchase-demands?purchaseOrderId=${encodeURIComponent(order.purchaseOrderId)}`,
      detailRefs: order.sourceLines.map((line) => buildDetailRef({
        detailId: line.purchaseOrderLineId,
        label: `${line.styleCode} / ${line.orderedQty} ${line.unit}`,
        routeObjectKeys,
        bomItemIds: identity?.bomItemIds,
      })),
    }
    const processingDocument: ProcessOrderTaskDocumentRef = {
      documentId: order.workOrderId,
      documentNo: order.workOrderNo,
      documentKind: 'PRODUCTION_TASK',
      documentTypeLabel: '花边加工单',
      ...commonIdentity,
      processCode: 'LACE_PROCESSING',
      processName: '花边加工',
      sourceEntryIds: identity?.laceProcessEntryIds ?? [],
      processEntryIds: identity?.laceProcessEntryIds ?? [],
      routeObjectKeys,
      sourceLabel: `PMS 采购单 ${order.purchaseOrderNo} / V${order.purchaseVersion}`,
      objectLabel: `${order.materialName} / ${order.skuCode}`,
      quantityLabel: `${order.planQty} ${order.unit}`,
      href: `/fcs/craft/accessory/lace/work-orders/${encodeURIComponent(order.workOrderId)}`,
      detailLabels: [
        ...order.inputLines.map((line) => `投入：${line.inputMaterialName} / ${line.plannedQty} ${line.unit}`),
        `产出：${order.processingOutput.materialName} / ${order.processingOutput.planQty} ${order.processingOutput.unit}`,
        `交出后去向：${order.targetWarehouseName}`,
      ],
      detailRefs: [
        ...order.inputLines.map((line) => buildDetailRef({
          detailId: `INPUT:${line.inputMaterialId}`,
          label: `投入：${line.inputMaterialName} / ${line.plannedQty} ${line.unit}`,
          sourceEntryIds: identity?.laceProcessEntryIds,
          routeObjectKeys,
          bomItemIds: identity?.bomItemIds,
        })),
        buildDetailRef({
          detailId: `OUTPUT:${order.processingOutput.skuId}`,
          label: `产出：${order.processingOutput.materialName} / ${order.processingOutput.planQty} ${order.processingOutput.unit}`,
          sourceEntryIds: identity?.laceProcessEntryIds,
          routeObjectKeys,
          bomItemIds: identity?.bomItemIds,
        }),
      ],
      predecessorDocumentIds: [purchaseDocumentId],
    }
    return [purchaseDocument, processingDocument]
  })
}

function inferWorkOrderEntryIds(input: {
  productionOrderId?: string
  processCode: string
  explicitEntryId?: string
  bomItemIds: string[]
}): string[] {
  if (input.explicitEntryId) return [input.explicitEntryId]
  if (!input.productionOrderId) return []
  const bomIds = new Set(input.bomItemIds)
  // 旧 Mock 只带生产单号，没有 BOM 分支或 occurrence 身份；按工序码猜测会把
  // 不同历史加工单错误挂到同一个路线节点。没有分支证据时宁可保持待关联。
  if (bomIds.size === 0) return []
  return getProductionOrderProcessEntries(input.productionOrderId)
    .filter((entry) => entry.processCode === input.processCode)
    .filter((entry) => (entry.linkedBomItemIds ?? []).some((id) => bomIds.has(id)))
    .map((entry) => entry.id)
}

function buildDocumentRefs(productionOrderId?: string): ProcessOrderTaskDocumentRef[] {
  const generatedCutOrders = listGeneratedCutOrderSourceRecords()
  const specialCraftOrders = listSpecialCraftTaskOrders()
  const scopedEntries = productionOrderId ? getProductionOrderProcessEntries(productionOrderId) : []
  const needsWoolDocuments = !productionOrderId || scopedEntries.length === 0
    || scopedEntries.some(entry => entry.processCode === 'WOOL' || entry.processCode === 'PROC_WOOL')
  const woolWorkOrders = needsWoolDocuments ? listWoolWorkOrders({ productionOrderId }) : []
  const laceFormalSnapshots = listCurrentLaceFormalRouteSnapshots()
  const formalSnapshotByOrderId = new Map(laceFormalSnapshots.map((snapshot) => [snapshot.productionOrderId, snapshot]))
  const formalCuttingTaskIds = new Set(generatedCutOrders.map((order) => order.cuttingTaskId))
  const formalSpecialCraftTaskIds = new Set(specialCraftOrders.map((order) => order.sourceTaskId).filter(Boolean))
  const woolTaskIds = new Set(woolWorkOrders.map((order) => order.taskId))
  const preparationDocuments = listProcessWorkOrderRelationSources().map((order): ProcessOrderTaskDocumentRef => {
    const bomItemIds = unique([
      ...(order.sourceSnapshot.bomItemIds ?? []),
      order.sourceSnapshot.bomItemId,
    ])
    const productionOrderId = order.sourceSnapshot.productionOrderId || order.sourceProductionOrderId
    const processName = order.processType === 'PRINT'
      ? '印花'
      : order.processType === 'DYE' ? '染色' : '水溶'
    const sourceEntryIds = inferWorkOrderEntryIds({
      productionOrderId,
      processCode: order.processType,
      explicitEntryId: order.sourceSnapshot.processEntryId,
      bomItemIds,
    })
    const routeObjectKeys = resolveRouteObjectKeys(productionOrderId, sourceEntryIds)
    const formalSnapshot = productionOrderId ? formalSnapshotByOrderId.get(productionOrderId) : undefined
    const objectLabel = [order.objectType, order.materialName, order.materialSku].filter(Boolean).join(' / ')
    const quantityLabel = `${order.plannedQty} ${order.plannedUnit}`
    return {
      documentId: order.workOrderId,
      documentNo: order.workOrderNo,
      documentKind: 'PREPARATION_ORDER',
      documentTypeLabel: `${processName}加工单`,
      productionOrderId,
      productionOrderNo: order.sourceSnapshot.productionOrderNo || order.sourceProductionOrderNo,
      techPackVersionId: order.sourceSnapshot.techPackVersionId || formalSnapshot?.techPackVersionId,
      techPackVersionLabel: order.sourceSnapshot.techPackVersionLabel || formalSnapshot?.techPackVersionLabel,
      processCode: order.processType,
      processName,
      sourceEntryIds,
      processEntryIds: sourceEntryIds,
      routeObjectKeys,
      bomItemIds,
      formalRouteLinkStatus: formalSnapshot && sourceEntryIds.length > 0 && bomItemIds.length > 0 ? 'LINKED' : 'UNLINKED',
      sourceLabel: PROCESS_WORK_ORDER_SOURCE_LABEL[order.sourceType],
      objectLabel,
      quantityLabel,
      detailRefs: [buildDetailRef({
        detailId: `${order.workOrderId}:MAIN`,
        label: [objectLabel, quantityLabel].filter(Boolean).join(' / '),
        sourceEntryIds,
        routeObjectKeys,
        bomItemIds,
      })],
    }
  })

  const productionDocuments = processTasks
    .filter((task): task is typeof task & { productionOrderId: string } => Boolean(task.productionOrderId))
    .filter((task) => !formalCuttingTaskIds.has(task.taskId))
    .filter((task) => !formalSpecialCraftTaskIds.has(task.taskId))
    .filter((task) => !woolTaskIds.has(task.taskId))
    .map((task): ProcessOrderTaskDocumentRef => {
      const sourceEntryIds = unique([...(task.sourceEntryIds ?? []), task.sourceEntryId])
      const routeObjectKeys = unique([
        ...(task.routeObjectKeys ?? []),
        task.routeObjectKey,
        ...resolveRouteObjectKeys(task.productionOrderId, sourceEntryIds),
      ])
      const formalSnapshot = formalSnapshotByOrderId.get(task.productionOrderId)
      const objectLabel = [task.selectedTargetObject, ...routeObjectKeys].filter(Boolean).join(' / ')
      const quantityLabel = `${task.qty} ${task.qtyDisplayUnit || task.qtyUnit}`
      const detailRefs = task.detailRows?.length
        ? task.detailRows.map((row) => buildDetailRef({
            detailId: row.rowKey,
            label: row.rowLabel || [
              row.dimensions.GARMENT_SKU,
              row.dimensions.GARMENT_COLOR,
              row.dimensions.PATTERN,
              row.dimensions.MATERIAL_SKU,
              `${row.qty} ${row.uom}`,
            ].filter(Boolean).join(' / '),
            sourceEntryIds: unique([row.sourceRefs.sourceEntryId]),
            routeObjectKeys,
            bomItemIds: unique([row.sourceRefs.bomItemId]),
          }))
        : [buildDetailRef({
            detailId: `${task.taskId}:MAIN`,
            label: [objectLabel, quantityLabel].filter(Boolean).join(' / '),
            sourceEntryIds,
            routeObjectKeys,
            bomItemIds: unique(task.consumedBomItemIds ?? []),
          })]
      return {
        documentId: task.taskId,
        documentNo: task.taskNo || task.taskId,
        documentKind: 'PRODUCTION_TASK',
        documentTypeLabel: task.taskCategoryZh || `${task.processNameZh}加工单`,
        productionOrderId: task.productionOrderId,
        productionOrderNo: task.productionOrderNo,
        techPackVersionId: formalSnapshot?.techPackVersionId,
        techPackVersionLabel: formalSnapshot?.techPackVersionLabel,
        processCode: task.processBusinessCode || task.processCode,
        processName: task.processBusinessName || task.processNameZh,
        sourceEntryIds,
        processEntryIds: sourceEntryIds,
        routeObjectKeys,
        bomItemIds: unique(task.consumedBomItemIds ?? []),
        formalRouteLinkStatus: formalSnapshot && sourceEntryIds.length > 0 ? 'LINKED' : 'UNLINKED',
        sourceLabel: task.productionOrderNo ? `生产单 ${task.productionOrderNo}` : '生产任务生成',
        objectLabel,
        quantityLabel,
        detailRefs,
      }
    })

  const woolDocuments = woolWorkOrders.map((order): ProcessOrderTaskDocumentRef => {
    const bomItemIds = unique(order.outputPlanLines.flatMap((line) => line.sourceBomItemIds))
    const sourceEntryIds = inferWorkOrderEntryIds({
      productionOrderId: order.productionOrderId,
      processCode: 'WOOL',
      bomItemIds,
    })
    const routeObjectKeys = resolveRouteObjectKeys(order.productionOrderId, sourceEntryIds)
    const formalSnapshot = formalSnapshotByOrderId.get(order.productionOrderId)
    const outputObjectLabel = order.kind === 'PART_PANEL' ? '毛织横机片' : '成衣'
    const totalOutputQty = order.outputPlanLines.reduce((sum, line) => sum + line.plannedQty, 0)
    const buildLineEntryIds = (line: WoolWorkOrder['outputPlanLines'][number]) => inferWorkOrderEntryIds({
      productionOrderId: order.productionOrderId,
      processCode: 'WOOL',
      bomItemIds: line.sourceBomItemIds,
    })
    return {
      // 毛织详情由 woolOrderId 路由承载，但生产任务关系沿用其稳定 taskId；
      // 页面也以 taskId 查询，避免再造一套平行关系身份。
      documentId: order.taskId,
      documentNo: order.woolOrderNo,
      documentKind: 'PRODUCTION_TASK',
      documentTypeLabel: order.kind === 'PART_PANEL' ? '部位毛织加工单' : '整件毛织加工单',
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
      techPackVersionId: order.sourceTechPackVersionId,
      techPackVersionLabel: order.sourceTechPackVersionCode,
      processCode: 'WOOL',
      processName: order.kind === 'PART_PANEL' ? '部位毛织' : '整件毛织',
      sourceEntryIds,
      processEntryIds: sourceEntryIds,
      routeObjectKeys,
      bomItemIds,
      formalRouteLinkStatus: formalSnapshot && sourceEntryIds.length > 0 && bomItemIds.length > 0 ? 'LINKED' : 'UNLINKED',
      sourceLabel: `生产单 ${order.productionOrderNo} / 技术包 ${order.sourceTechPackVersionCode}`,
      objectLabel: `纱线 → ${outputObjectLabel}`,
      quantityLabel: `${totalOutputQty} 件`,
      href: `/fcs/craft/wool/work-orders/${encodeURIComponent(order.woolOrderId)}`,
      detailRefs: order.outputPlanLines.map((line) => {
        const lineEntryIds = buildLineEntryIds(line)
        return buildDetailRef({
          detailId: `${order.woolOrderId}:${line.outputSkuCode}`,
          label: [
            line.garmentSkuCode,
            line.woolPartName,
            `${line.colorName}/${line.sizeCode}`,
            `投入纱线 ${line.requiredYarnSkus.join('、') || '待确认'}`,
            `产出 ${line.outputSkuCode} ${line.plannedQty} ${line.qtyUnit}`,
          ].filter(Boolean).join(' / '),
          sourceEntryIds: lineEntryIds,
          routeObjectKeys: resolveRouteObjectKeys(order.productionOrderId, lineEntryIds),
          bomItemIds: line.sourceBomItemIds,
        })
      }),
    }
  })

  const cuttingDocuments = generatedCutOrders.map((order): ProcessOrderTaskDocumentRef => {
    const sourceTask = processTasks.find((task) => task.taskId === order.cuttingTaskId)
    const sourceEntryIds = unique([...(sourceTask?.sourceEntryIds ?? []), sourceTask?.sourceEntryId])
    const routeObjectKeys = unique([
      ...(sourceTask?.routeObjectKeys ?? []),
      sourceTask?.routeObjectKey,
      ...resolveRouteObjectKeys(order.productionOrderId, sourceEntryIds),
    ])
    const bomItemIds = unique(sourceTask?.consumedBomItemIds ?? [])
    return {
      documentId: order.cutOrderId,
      documentNo: order.cutOrderNo,
      documentKind: 'PRODUCTION_TASK',
      documentTypeLabel: '裁片单',
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
      processCode: 'CUT_PANEL',
      processName: '裁剪',
      sourceEntryIds,
      processEntryIds: sourceEntryIds,
      routeObjectKeys,
      bomItemIds,
      sourceLabel: `生产单 ${order.productionOrderNo} / ${order.cutOrderSourceLabel}`,
      objectLabel: `${order.materialName} / ${order.materialSku} → ${order.pieceSummary}`,
      quantityLabel: `生产数量 ${order.requiredQty} 件`,
      href: `/fcs/craft/cutting/cut-orders/${encodeURIComponent(order.cutOrderId)}`,
      detailLabels: [
        `投入：${order.materialName} / ${order.materialSku}`,
        ...order.pieceRows.map((part) => `产出裁片：${part.partName} / 每件 ${part.pieceCountPerUnit} 片`),
      ],
      detailRefs: [
        buildDetailRef({
          detailId: `${order.cutOrderId}:INPUT:${order.materialSku}`,
          label: `投入：${order.materialName} / ${order.materialSku}`,
          sourceEntryIds,
          routeObjectKeys,
          bomItemIds,
        }),
        ...order.pieceRows.map((part) => buildDetailRef({
          detailId: `${order.cutOrderId}:OUTPUT:${part.patternId}:${part.partCode}`,
          label: `产出裁片：${part.partName} / 每件 ${part.pieceCountPerUnit} 片`,
          sourceEntryIds,
          routeObjectKeys,
          bomItemIds,
        })),
      ],
    }
  })

  const specialCraftDocuments = specialCraftOrders.map((order): ProcessOrderTaskDocumentRef => ({
    documentId: order.taskOrderId,
    documentNo: order.taskOrderNo,
    documentKind: 'PRODUCTION_TASK',
    documentTypeLabel: `${order.operationName}加工单`,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    processCode: order.processCode,
    processName: order.operationName,
    sourceEntryIds: unique([
      order.sourceEntryId,
      ...(order.demandLines ?? []).map((line) => line.sourceEntryId),
    ]),
    processEntryIds: unique([
      order.sourceEntryId,
      ...(order.demandLines ?? []).map((line) => line.sourceEntryId),
    ]),
    routeObjectKeys: unique((order.demandLines ?? []).map((line) => line.routeObjectKey)),
    bomItemIds: unique((order.demandLines ?? []).map((line) => line.sourceBomItemId)),
    sourceLabel: [
      `生产单 ${order.productionOrderNo}`,
      order.techPackVersion ? `技术包 ${order.techPackVersion}` : '',
      order.sourceTaskNo ? `来源任务 ${order.sourceTaskNo}` : '',
    ].filter(Boolean).join(' / '),
    objectLabel: `${order.inputObjectType} → ${order.outputObjectType}`,
    quantityLabel: `${order.planQty} ${order.outputUnit || order.unit}`,
    href: buildSpecialCraftTaskDetailPath(order.operationId, order.taskOrderId),
    detailLabels: (order.demandLines ?? []).map((line) => [
      line.skuCode,
      line.partName,
      line.materialSku,
      `${line.planPieceQty} ${line.outputUnit || line.unit}`,
    ].filter(Boolean).join(' / ')),
    detailRefs: (order.demandLines ?? []).map((line) => buildDetailRef({
      detailId: line.demandLineId,
      label: [
        line.skuCode,
        line.partName,
        line.materialSku,
        `${line.planPieceQty} ${line.outputUnit || line.unit}`,
      ].filter(Boolean).join(' / '),
      sourceEntryIds: unique([line.sourceEntryId]),
      routeObjectKeys: unique([line.routeObjectKey]),
      bomItemIds: unique([line.sourceBomItemId]),
    })),
  }))

  const bindingDocuments = buildBindingProcessOrders().map((order): ProcessOrderTaskDocumentRef => {
    const sourceCutOrder = generatedCutOrders.find((cutOrder) => (
      cutOrder.cutOrderNo === order.sourceCutOrderNo
      || cutOrder.cuttingTaskId === order.sourceParentTaskId
    ))
    const buttonLoopSuccessors = order.bindingDetails.some((detail) => detail.requiresButtonLoop)
      ? processTasks
          .filter((task) => task.productionOrderId === order.sourceProductionOrderId)
          .filter((task) => task.craftName === '盘扣' || task.processBusinessName === '盘扣')
          .map((task) => task.taskId)
      : []
    return {
      documentId: order.bindingOrderId,
      documentNo: order.bindingOrderNo,
      documentKind: 'PRODUCTION_TASK',
      documentTypeLabel: '捆条加工单',
      productionOrderId: order.sourceProductionOrderId,
      productionOrderNo: order.sourceProductionOrderNo,
      processCode: 'BINDING_STRIP',
      processName: '捆条',
      sourceEntryIds: [],
      processEntryIds: [],
      routeObjectKeys: [],
      bomItemIds: [],
      sourceLabel: `裁片单 ${order.sourceCutOrderNo}`,
      objectLabel: `${order.materialIdentity.materialName} / ${order.patternIdentity.piecePartNames.join('、')}`,
      quantityLabel: `${order.plannedOutputQty} ${order.unit}`,
      href: `/fcs/craft/cutting/special-processes/${encodeURIComponent(order.bindingOrderId)}`,
      detailLabels: order.bindingDetails.map((detail) => (
        `${detail.bindingStripName} / ${detail.bindingWidth} cm / ${detail.plannedBindingLength} ${order.unit}`
      )),
      detailRefs: order.bindingDetails.map((detail) => buildDetailRef({
        detailId: detail.detailId,
        label: `${detail.bindingStripName} / ${detail.bindingWidth} cm / ${detail.plannedBindingLength} ${order.unit}`,
      })),
      predecessorDocumentIds: unique([sourceCutOrder?.cutOrderId, order.sourceParentTaskId]),
      successorDocumentIds: unique(buttonLoopSuccessors),
    }
  })

  const laceDocuments = buildLaceProcessOrderTaskDocuments(
    listLaceProductionOrders(PLATFORM_ADMIN),
    laceFormalSnapshots,
  )

  return [
    ...preparationDocuments,
    ...productionDocuments,
    ...woolDocuments,
    ...cuttingDocuments,
    ...specialCraftDocuments,
    ...bindingDocuments,
    ...new Map(laceDocuments.map((document) => [document.documentId, document])).values(),
  ].filter(document => !productionOrderId || document.productionOrderId === productionOrderId)
}

function listEntriesByProductionOrder(documentRefs: ProcessOrderTaskDocumentRef[]): Map<string, TechnicalProcessEntry[]> {
  const result = new Map<string, TechnicalProcessEntry[]>()
  unique(documentRefs.map((document) => document.productionOrderId)).forEach((productionOrderId) => {
    result.set(productionOrderId, getProductionOrderProcessEntries(productionOrderId))
  })
  return result
}

export function buildProcessOrderTaskLinks(
  documentRefs: ProcessOrderTaskDocumentRef[] = buildDocumentRefs(),
  entriesByOrder: Map<string, TechnicalProcessEntry[]> = listEntriesByProductionOrder(documentRefs),
): ProcessOrderTaskLink[] {
  const documentsByOrder = new Map<string, ProcessOrderTaskDocumentRef[]>()
  documentRefs.forEach((document) => {
    if (!document.productionOrderId) return
    documentsByOrder.set(document.productionOrderId, [
      ...(documentsByOrder.get(document.productionOrderId) ?? []),
      document,
    ])
  })
  const links: ProcessOrderTaskLink[] = []

  documentsByOrder.forEach((documents, productionOrderId) => {
    const entryById = new Map((entriesByOrder.get(productionOrderId) ?? []).map((entry) => [entry.id, entry]))
    const documentsByEntryId = new Map<string, ProcessOrderTaskDocumentRef[]>()
    documents.forEach((document) => document.sourceEntryIds.forEach((entryId) => {
      documentsByEntryId.set(entryId, [...(documentsByEntryId.get(entryId) ?? []), document])
    }))

    documents.forEach((successor) => {
      successor.sourceEntryIds.forEach((successorEntryId) => {
        const successorEntry = entryById.get(successorEntryId)
        ;(successorEntry?.predecessorEntryIds ?? []).forEach((predecessorEntryId) => {
          ;(documentsByEntryId.get(predecessorEntryId) ?? []).forEach((predecessor) => {
            if (predecessor.documentId === successor.documentId) return
            if (
              predecessor.documentKind === 'PREPARATION_ORDER'
              && successor.documentKind === 'PREPARATION_ORDER'
              && predecessor.bomItemIds.length > 0
              && successor.bomItemIds.length > 0
              && !predecessor.bomItemIds.some((bomItemId) => successor.bomItemIds.includes(bomItemId))
            ) return
            links.push({
              linkId: `${productionOrderId}:${predecessor.documentId}:${predecessorEntryId}:${successor.documentId}:${successorEntryId}`,
              productionOrderId,
              predecessorDocumentId: predecessor.documentId,
              predecessorEntryId,
              predecessorDetailIds: listDocumentDetailIdsForEntry(predecessor, predecessorEntryId),
              successorDocumentId: successor.documentId,
              successorEntryId,
              successorDetailIds: listDocumentDetailIdsForEntry(successor, successorEntryId),
              routeObjectKey: successorEntry?.routeObjectKey || entryById.get(predecessorEntryId)?.routeObjectKey,
            })
          })
        })
      })
    })
  })

  const documentById = new Map(documentRefs.map((document) => [document.documentId, document]))
  documentRefs.forEach((document) => {
    ;(document.predecessorDocumentIds ?? []).forEach((predecessorDocumentId) => {
      if (!documentById.has(predecessorDocumentId) || predecessorDocumentId === document.documentId) return
      links.push({
        linkId: `EXPLICIT:${predecessorDocumentId}:${document.documentId}`,
        productionOrderId: document.productionOrderId || documentById.get(predecessorDocumentId)?.productionOrderId || 'NON_ROUTE',
        predecessorDocumentId,
        predecessorEntryId: 'EXPLICIT_SOURCE',
        predecessorDetailIds: unique((documentById.get(predecessorDocumentId)?.detailRefs ?? []).map((detail) => detail.detailId)),
        successorDocumentId: document.documentId,
        successorEntryId: document.sourceEntryIds[0] || 'EXPLICIT_TARGET',
        successorDetailIds: unique((document.detailRefs ?? []).map((detail) => detail.detailId)),
        routeObjectKey: document.routeObjectKeys?.[0] || documentById.get(predecessorDocumentId)?.routeObjectKeys?.[0],
      })
    })
    ;(document.successorDocumentIds ?? []).forEach((successorDocumentId) => {
      if (!documentById.has(successorDocumentId) || successorDocumentId === document.documentId) return
      links.push({
        linkId: `EXPLICIT:${document.documentId}:${successorDocumentId}`,
        productionOrderId: document.productionOrderId || documentById.get(successorDocumentId)?.productionOrderId || 'NON_ROUTE',
        predecessorDocumentId: document.documentId,
        predecessorEntryId: document.sourceEntryIds[0] || 'EXPLICIT_SOURCE',
        predecessorDetailIds: unique((document.detailRefs ?? []).map((detail) => detail.detailId)),
        successorDocumentId,
        successorEntryId: documentById.get(successorDocumentId)?.sourceEntryIds[0] || 'EXPLICIT_TARGET',
        successorDetailIds: unique((documentById.get(successorDocumentId)?.detailRefs ?? []).map((detail) => detail.detailId)),
        routeObjectKey: document.routeObjectKeys?.[0] || documentById.get(successorDocumentId)?.routeObjectKeys?.[0],
      })
    })
  })

  return [...new Map(links.map((link) => [link.linkId, link])).values()]
}

function cloneDetailRef(detail: ProcessOrderTaskDetailRef): ProcessOrderTaskDetailRef {
  return {
    ...detail,
    sourceEntryIds: [...detail.sourceEntryIds],
    routeObjectKeys: [...detail.routeObjectKeys],
    bomItemIds: [...detail.bomItemIds],
  }
}

function cloneDocumentRef(document: ProcessOrderTaskDocumentRef): ProcessOrderTaskDocumentRef {
  return {
    ...document,
    sourceEntryIds: [...document.sourceEntryIds],
    processEntryIds: document.processEntryIds ? [...document.processEntryIds] : undefined,
    routeObjectKeys: document.routeObjectKeys ? [...document.routeObjectKeys] : undefined,
    bomItemIds: [...document.bomItemIds],
    detailLabels: document.detailLabels ? [...document.detailLabels] : undefined,
    detailRefs: document.detailRefs?.map(cloneDetailRef),
    predecessorDocumentIds: document.predecessorDocumentIds ? [...document.predecessorDocumentIds] : undefined,
    successorDocumentIds: document.successorDocumentIds ? [...document.successorDocumentIds] : undefined,
  }
}

function buildPendingRouteRelations(input: {
  current: ProcessOrderTaskDocumentRef
  documents: ProcessOrderTaskDocumentRef[]
  entriesByOrder: Map<string, TechnicalProcessEntry[]>
  selectedDetailId?: string
}): { predecessors: PendingProcessOrderTaskRef[]; successors: PendingProcessOrderTaskRef[] } {
  const productionOrderId = input.current.productionOrderId
  if (!productionOrderId) return { predecessors: [], successors: [] }
  const entries = input.entriesByOrder.get(productionOrderId) ?? []
  const entryById = new Map(entries.map((entry) => [entry.id, entry]))
  const documentsByEntryId = new Map<string, ProcessOrderTaskDocumentRef[]>()
  input.documents
    .filter((document) => document.productionOrderId === productionOrderId)
    .forEach((document) => document.sourceEntryIds.forEach((entryId) => {
      documentsByEntryId.set(entryId, [...(documentsByEntryId.get(entryId) ?? []), document])
    }))
  const selectedDetail = input.selectedDetailId
    ? input.current.detailRefs?.find((detail) => detail.detailId === input.selectedDetailId)
    : undefined
  const currentEntryIds = selectedDetail?.sourceEntryIds.length
    ? selectedDetail.sourceEntryIds
    : input.current.sourceEntryIds

  const toPending = (entry: TechnicalProcessEntry): PendingProcessOrderTaskRef | undefined => {
    if (entry.stageCode === 'POST') return undefined
    return {
      productionOrderId,
      occurrenceEntryId: entry.id,
      stageCode: entry.stageCode,
      processCode: entry.processCode,
      processName: entry.craftName || entry.processName,
      routeObjectKey: entry.routeObjectKey,
      inputObjectType: entry.inputObjectType,
      outputObjectType: entry.outputObjectType,
      relationStatus: 'PENDING_DOCUMENT',
    }
  }
  const predecessorEntries = currentEntryIds
    .flatMap((entryId) => entryById.get(entryId)?.predecessorEntryIds ?? [])
    .filter((entryId) => (documentsByEntryId.get(entryId) ?? []).length === 0)
    .map((entryId) => entryById.get(entryId))
    .filter((entry): entry is TechnicalProcessEntry => Boolean(entry))
    .map(toPending)
    .filter((entry): entry is PendingProcessOrderTaskRef => Boolean(entry))
  const currentEntryIdSet = new Set(currentEntryIds)
  const successorEntries = entries
    .filter((entry) => (entry.predecessorEntryIds ?? []).some((entryId) => currentEntryIdSet.has(entryId)))
    .filter((entry) => (documentsByEntryId.get(entry.id) ?? []).length === 0)
    .map(toPending)
    .filter((entry): entry is PendingProcessOrderTaskRef => Boolean(entry))
  const dedupe = (items: PendingProcessOrderTaskRef[]) => [
    ...new Map(items.map((item) => [item.occurrenceEntryId, item])).values(),
  ]
  return { predecessors: dedupe(predecessorEntries), successors: dedupe(successorEntries) }
}

function buildTaskDetails(current: ProcessOrderTaskDocumentRef, selectedDetailId?: string): string[] {
  if (selectedDetailId) {
    const detail = current.detailRefs?.find((item) => item.detailId === selectedDetailId)
    return detail ? [detail.label] : []
  }
  if (current.detailLabels?.length) return [...current.detailLabels]
  if (current.detailRefs?.length) return current.detailRefs.map((detail) => detail.label)
  const task = processTasks.find((item) => item.taskId === current.documentId)
  if (task?.detailRows?.length) {
    return task.detailRows.map((row) => [
      row.dimensions.GARMENT_SKU,
      row.dimensions.GARMENT_COLOR,
      row.dimensions.PATTERN,
      row.dimensions.MATERIAL_SKU,
      `${row.qty} ${row.uom}`,
    ].filter(Boolean).join(' / '))
  }
  return [current.objectLabel, current.quantityLabel].filter(Boolean)
}

function buildRelationView(input: {
  current: ProcessOrderTaskDocumentRef
  documents: ProcessOrderTaskDocumentRef[]
  links: ProcessOrderTaskLink[]
  entriesByOrder: Map<string, TechnicalProcessEntry[]>
  selectedDetailId?: string
}): ProcessOrderTaskRelationView {
  const documentById = new Map(input.documents.map((document) => [document.documentId, document]))
  const relevantPredecessorLinks = input.links.filter((link) => (
    link.successorDocumentId === input.current.documentId
    && (!input.selectedDetailId || link.successorDetailIds.length === 0 || link.successorDetailIds.includes(input.selectedDetailId))
  ))
  const relevantSuccessorLinks = input.links.filter((link) => (
    link.predecessorDocumentId === input.current.documentId
    && (!input.selectedDetailId || link.predecessorDetailIds.length === 0 || link.predecessorDetailIds.includes(input.selectedDetailId))
  ))
  const predecessors = unique(relevantPredecessorLinks.map((link) => link.predecessorDocumentId))
    .map((id) => documentById.get(id))
    .filter((item): item is ProcessOrderTaskDocumentRef => Boolean(item))
  const successors = unique(relevantSuccessorLinks.map((link) => link.successorDocumentId))
    .map((id) => documentById.get(id))
    .filter((item): item is ProcessOrderTaskDocumentRef => Boolean(item))
  const pending = buildPendingRouteRelations({
    current: input.current,
    documents: input.documents,
    entriesByOrder: input.entriesByOrder,
    selectedDetailId: input.selectedDetailId,
  })
  return {
    current: cloneDocumentRef(input.current),
    demandSource: input.current.sourceLabel,
    predecessors: predecessors.map(cloneDocumentRef),
    successors: successors.map(cloneDocumentRef),
    pendingPredecessors: pending.predecessors.map((item) => ({ ...item })),
    pendingSuccessors: pending.successors.map((item) => ({ ...item })),
    taskDetails: buildTaskDetails(input.current, input.selectedDetailId),
    selectedDetailId: input.selectedDetailId,
  }
}

export function listProcessOrderTaskDocuments(): ProcessOrderTaskDocumentRef[] {
  return buildDocumentRefs().map(cloneDocumentRef)
}

export function listProcessOrderTaskLinksByProductionOrder(productionOrderId: string): ProcessOrderTaskLink[] {
  const documents = buildDocumentRefs()
  return buildProcessOrderTaskLinks(documents)
    .filter((link) => link.productionOrderId === productionOrderId)
    .map((link) => ({
      ...link,
      predecessorDetailIds: [...link.predecessorDetailIds],
      successorDetailIds: [...link.successorDetailIds],
    }))
}

export function buildProcessOrderTaskRelationViewFromDocuments(
  documentId: string,
  documents: ProcessOrderTaskDocumentRef[],
  entriesByOrder: Map<string, TechnicalProcessEntry[]> = listEntriesByProductionOrder(documents),
  selectedDetailId?: string,
): ProcessOrderTaskRelationView | undefined {
  const current = documents.find((document) => document.documentId === documentId || document.documentNo === documentId)
  if (!current) return undefined
  if (selectedDetailId && !current.detailRefs?.some((detail) => detail.detailId === selectedDetailId)) return undefined
  return buildRelationView({
    current,
    documents,
    links: buildProcessOrderTaskLinks(documents, entriesByOrder),
    entriesByOrder,
    selectedDetailId,
  })
}

export function getProcessOrderTaskRelationView(documentId: string): ProcessOrderTaskRelationView | undefined {
  const preparationSource = listProcessWorkOrderRelationSources().find(order =>
    order.workOrderId === documentId || order.workOrderNo === documentId,
  )
  const productionOrderId = preparationSource?.sourceSnapshot.productionOrderId || preparationSource?.sourceProductionOrderId
  const documents = buildDocumentRefs(productionOrderId)
  const entriesByOrder = listEntriesByProductionOrder(documents)
  return buildProcessOrderTaskRelationViewFromDocuments(documentId, documents, entriesByOrder)
}

export function getProcessOrderTaskRelationViewByDetail(
  documentId: string,
  detailId: string,
): ProcessOrderTaskRelationView | undefined {
  const documents = buildDocumentRefs()
  const entriesByOrder = listEntriesByProductionOrder(documents)
  return buildProcessOrderTaskRelationViewFromDocuments(documentId, documents, entriesByOrder, detailId)
}

export function listProcessOrderTaskRelationViewsByProductionOrder(
  productionOrderId: string,
): ProcessOrderTaskRelationView[] {
  const documents = buildDocumentRefs()
  const scopedDocuments = documents.filter((document) => document.productionOrderId === productionOrderId)
  const entriesByOrder = listEntriesByProductionOrder(documents)
  const links = buildProcessOrderTaskLinks(documents, entriesByOrder)
  return scopedDocuments.map((current) => buildRelationView({ current, documents, links, entriesByOrder }))
}

export function listProcessOrderTaskRelationViewsByOccurrence(
  occurrenceEntryId: string,
  productionOrderId?: string,
): ProcessOrderTaskRelationView[] {
  const documents = buildDocumentRefs()
  const scopedDocuments = documents.filter((document) => (
    (!productionOrderId || document.productionOrderId === productionOrderId)
    && unique([
      ...document.sourceEntryIds,
      ...(document.processEntryIds ?? []),
      ...(document.detailRefs ?? []).flatMap((detail) => detail.sourceEntryIds),
    ]).includes(occurrenceEntryId)
  ))
  const entriesByOrder = listEntriesByProductionOrder(documents)
  const links = buildProcessOrderTaskLinks(documents, entriesByOrder)
  return scopedDocuments.map((current) => buildRelationView({ current, documents, links, entriesByOrder }))
}
