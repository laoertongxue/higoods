import { getProcessWorkOrderById } from '../process-work-order-domain.ts'
import { getDyeReviewRecordByOrderId, listDyeExecutionNodeRecords } from '../dyeing-task-domain.ts'
import { getPrintReviewRecordByOrderId, listPrintExecutionNodeRecords } from '../printing-task-domain.ts'
import { getSupplementPrintActualInputs } from '../supplement-print-prerequisite.ts'
import type { SupplementOrderLifecycle, SupplementMaterialDemand } from './supplement-order-registry.ts'
import { getSupplementMaterialPrepDemand } from './supplement-material-prep-demand-registry.ts'
import { listSupplementPurchaseOrders } from './supplement-purchase-order-registry.ts'
import type { SupplementMaterialPrepStatus } from './supplement-material-prep-demand-registry.ts'

export interface SupplementNodeDocumentView {
  documentNo: string
  createdAt: string
  plannedQty: number
  completedQty: number
  unit: string
  status: string
  owner: string
  estimatedArrivalAt: string
  sourceTrace: string
}

export interface SupplementMaterialNodeFactView {
  material: {
    materialDemandId: string
    materialSku: string
    materialName: string
    materialImageUrl: string
    materialImageAlt: string
    color: string
    specification: string
    patternPart: string
    requiredQty: number
    unit: string
  }
  inventory: { status: string; summary: string; rows: Array<Record<string, string | number | boolean>> }
  purchase: { status: string; summary: string; documents: SupplementNodeDocumentView[]; isExistingTransit: boolean }
  dye: { status: string; summary: string; documents: SupplementNodeDocumentView[] }
  print: { status: string; summary: string; documents: SupplementNodeDocumentView[] }
  materialPrep: { status: string; summary: string; approvedRequiredQty: number; arrivedQty: number; currentAvailableQty: number; preparedQty: number; pickedQty: number; remainingQty: number; unit: string }
  hasUnresolvedDifference: boolean
  unresolvedDifferenceNodes: string[]
}

function processNode(order: SupplementOrderLifecycle, demand: SupplementMaterialDemand, processType: 'DYE' | 'PRINT') {
  const required = processType === 'DYE' ? demand.dyeRequired : demand.printRequired
  if (!required) return { status: '不需要', summary: '不需要', documents: [], hasDifference: false }
  const refs = order.processWorkOrderRefs.filter((ref) =>
    ref.processType === processType && ref.materialDemandIds.includes(demand.key)
  )
  const documents = refs.map((ref): SupplementNodeDocumentView => {
    const workOrder = getProcessWorkOrderById(ref.workOrderId)
    const review = processType === 'DYE'
      ? getDyeReviewRecordByOrderId(ref.workOrderId)
      : getPrintReviewRecordByOrderId(ref.workOrderId)
    const nodeOutputQty = (processType === 'DYE'
      ? listDyeExecutionNodeRecords(ref.workOrderId)
      : listPrintExecutionNodeRecords(ref.workOrderId))
      .filter((node) => node.finishedAt && Number(node.outputQty) >= 0)
      .at(-1)?.outputQty
    const actualPrintInputs = processType === 'PRINT' ? getSupplementPrintActualInputs(ref.workOrderId) : []
    return {
      documentNo: ref.workOrderNo,
      createdAt: workOrder?.createdAt || '未记录',
      plannedQty: ref.plannedQty,
      completedQty: review?.receivedQty ?? nodeOutputQty ?? 0,
      unit: ref.unit,
      status: workOrder?.statusLabel || '未形成',
      owner: workOrder?.factoryName || '未记录',
      estimatedArrivalAt: '未记录',
      sourceTrace: actualPrintInputs.length
        ? actualPrintInputs.map((item) => `${item.dyeWorkOrderNo}：${item.qualifiedQty} ${item.unit}，批次/交接 ${item.batchSource}`).join('；')
        : '未记录',
    }
  })
  const hasDifference = refs.some((ref) => {
    const review = processType === 'DYE'
      ? getDyeReviewRecordByOrderId(ref.workOrderId)
      : getPrintReviewRecordByOrderId(ref.workOrderId)
    return Boolean(review && (review.diffQty !== 0 || review.reviewStatus === 'HANDOVER_DIFFERENCE'))
  })
  let status = documents.length ? documents.map((document) => document.status).join('、') : '未形成'
  if (processType === 'PRINT' && demand.dyeRequired) {
    const dyeRefs = order.processWorkOrderRefs.filter((ref) =>
      ref.processType === 'DYE' && ref.materialDemandIds.includes(demand.key)
    )
    if (!dyeRefs.length || dyeRefs.some((ref) => getProcessWorkOrderById(ref.workOrderId)?.statusLabel !== '已完成')) {
      status = '等待染色完成'
    }
  }
  return { status, summary: documents.length ? `${documents.length} 张，计划 ${documents.reduce((sum, document) => sum + document.plannedQty, 0)} ${demand.unit}` : status, documents, hasDifference }
}

function deriveMaterialPrepLineStatus(input: {
  storedStatus?: SupplementMaterialPrepStatus
  approvedQty: number
  currentAvailableQty: number
  preparedQty: number
  pickedQty: number
  unresolvedDifferenceQty: number
  purchaseStatus: string
  dyeStatus: string
  printStatus: string
  dyeRequired: boolean
  printRequired: boolean
  hasExistingTransit: boolean
}): SupplementMaterialPrepStatus {
  if (input.storedStatus === '已结束') return '已结束'
  if (input.unresolvedDifferenceQty > 0) return '存在差异'
  if (input.pickedQty >= input.approvedQty) return '已领料'
  if (input.pickedQty > 0) return '部分领料'
  if (input.preparedQty >= input.approvedQty) return '已配料'
  if (input.preparedQty > 0) return '部分配料'
  if (input.currentAvailableQty >= input.approvedQty) return '可配料'
  if (input.currentAvailableQty > 0) return '部分到仓'
  if (input.dyeRequired && input.dyeStatus !== '已完成') {
    return /进行|加工中|生产中/.test(input.dyeStatus) ? '染色中' : '等待染色'
  }
  if (input.printRequired && input.printStatus !== '已完成') {
    return /进行|加工中|生产中|印花中/.test(input.printStatus) ? '印花中' : '等待印花'
  }
  if (input.purchaseStatus === '采购中') return '采购中'
  if (input.purchaseStatus === '部分到货') return '部分到仓'
  if (input.purchaseStatus === '已到货') return '等待到仓'
  if (input.hasExistingTransit) return '等待到仓'
  return input.storedStatus ?? '等待库存准备'
}

export function getSupplementMaterialNodeFacts(order: SupplementOrderLifecycle): SupplementMaterialNodeFactView[] {
  const prepDemand = getSupplementMaterialPrepDemand(order.materialPrepDemandId)
  const purchases = listSupplementPurchaseOrders(order.id)
  return order.materialDemands.map((demand) => {
    const supply = order.supplyDecisionSnapshots.find((snapshot) => snapshot.materialDemandId === demand.key)
    const prepLine = prepDemand?.lines.find((line) => line.materialDemandId === demand.key)
    const createdPurchases = purchases.filter((purchase) => purchase.materialDemandId === demand.key)
    const purchaseDocuments = createdPurchases.map((purchase): SupplementNodeDocumentView => ({
      documentNo: purchase.purchaseOrderNo,
      createdAt: purchase.createdAt,
      plannedQty: purchase.purchaseQty,
      completedQty: purchase.arrivedQty,
      unit: purchase.unit,
      status: purchase.status,
      owner: '采购',
      estimatedArrivalAt: purchase.estimatedArrivalAt || '未记录',
      sourceTrace: '本次补料缺口采购',
    }))
    const purchase = supply?.existingTransitSummary && supply.existingTransitCoverageQty > 0
      ? {
          status: '已有采购在途',
          summary: `已有采购在途 ${supply.existingTransitSummary.pendingQty} ${supply.existingTransitSummary.unit}，预计到货 ${supply.existingTransitSummary.estimatedArrivalAt}`,
          documents: [],
          isExistingTransit: true,
        }
      : supply?.existingTransitRows.some((row) => !row.unitMatched)
        ? {
            status: '单位不一致，需核对',
            summary: supply.existingTransitRows.map((row) => `采购在途 ${row.pendingQty} ${row.unit}`).join('；'),
            documents: [],
            isExistingTransit: true,
          }
      : purchaseDocuments.length
        ? {
            status: createdPurchases.every((item) => item.status === '已到货') ? '已到货' : createdPurchases.some((item) => item.status === '部分到货') ? '部分到货' : '采购中',
            summary: `${createdPurchases.length} 张，采购 ${createdPurchases.reduce((sum, item) => sum + item.purchaseQty, 0)} ${demand.unit}`,
            documents: purchaseDocuments,
            isExistingTransit: false,
          }
        : { status: '不需要', summary: '不需要采购', documents: [], isExistingTransit: false }
    const dye = processNode(order, demand, 'DYE')
    const print = processNode(order, demand, 'PRINT')
    const unresolvedDifference = prepLine?.unresolvedDifferenceQty ?? 0
    const materialPrepStatus = deriveMaterialPrepLineStatus({
      storedStatus: prepDemand?.status,
      approvedQty: prepLine?.approvedRequiredQty ?? demand.requiredQty,
      currentAvailableQty: prepLine?.currentAvailableQty ?? 0,
      preparedQty: prepLine?.preparedQty ?? 0,
      pickedQty: prepLine?.pickedQty ?? 0,
      unresolvedDifferenceQty: unresolvedDifference,
      purchaseStatus: purchase.status,
      dyeStatus: dye.status,
      printStatus: print.status,
      dyeRequired: demand.dyeRequired,
      printRequired: demand.printRequired,
      hasExistingTransit: Boolean(supply?.existingTransitCoverageQty),
    })
    return {
      material: {
        materialDemandId: demand.key,
        materialSku: demand.materialSku,
        materialName: demand.materialName,
        materialImageUrl: demand.materialImageUrl,
        materialImageAlt: demand.materialImageAlt || `${demand.materialName}实物图`,
        color: demand.color || '未记录',
        specification: demand.spec || '未记录',
        patternPart: demand.patternPart || demand.patternName || '未记录',
        requiredQty: demand.requiredQty,
        unit: demand.unit,
      },
      inventory: {
        status: (supply?.availableInventoryCoverageQty ?? 0) > 0 ? '有可用库存' : '各仓均无可用库存',
        summary: (supply?.availableInventoryCoverageQty ?? 0) > 0
          ? `${supply!.inventoryRows.filter((row) => row.availableQty > 0 && row.unitMatched).length} 个仓有库存，可覆盖 ${supply!.availableInventoryCoverageQty} ${demand.unit}`
          : '各仓均无可用库存',
        rows: (supply?.inventoryRows ?? []).map((row) => ({ ...row })),
      },
      purchase,
      dye,
      print,
      materialPrep: {
        status: materialPrepStatus,
        summary: prepLine ? `批准 ${prepLine.approvedRequiredQty}，可配 ${prepLine.currentAvailableQty}，已领 ${prepLine.pickedQty} ${prepLine.unit}` : '未形成',
        approvedRequiredQty: prepLine?.approvedRequiredQty ?? demand.requiredQty,
        arrivedQty: prepLine?.arrivedQty ?? 0,
        currentAvailableQty: prepLine?.currentAvailableQty ?? 0,
        preparedQty: prepLine?.preparedQty ?? 0,
        pickedQty: prepLine?.pickedQty ?? 0,
        remainingQty: prepLine?.remainingQty ?? demand.requiredQty,
        unit: prepLine?.unit ?? demand.unit,
      },
      hasUnresolvedDifference: unresolvedDifference > 0 || dye.hasDifference || print.hasDifference,
      unresolvedDifferenceNodes: [
        ...(dye.hasDifference ? ['染色'] : []),
        ...(print.hasDifference ? ['印花'] : []),
        ...(unresolvedDifference > 0 ? ['中转仓配料'] : []),
      ],
    }
  })
}

export function getSupplementCompletionEligibility(order: SupplementOrderLifecycle): { allowed: boolean; reasons: string[] } {
  const reasons = getSupplementMaterialNodeFacts(order).flatMap((row) =>
    row.unresolvedDifferenceNodes.map((node) => `${row.material.materialName}的${node}存在未处理数量差异`)
  )
  return { allowed: reasons.length === 0, reasons }
}

export function getSupplementNodeOverview(order: SupplementOrderLifecycle) {
  const rows = getSupplementMaterialNodeFacts(order)
  return {
    inventory: [...new Set(rows.map((row) => row.inventory.status))].join('、'),
    purchase: [...new Set(rows.map((row) => row.purchase.status))].join('、'),
    dye: [...new Set(rows.map((row) => row.dye.status))].join('、'),
    print: [...new Set(rows.map((row) => row.print.status))].join('、'),
    materialPrep: [...new Set(rows.map((row) => row.materialPrep.status))].join('、'),
    currentNode: rows.some((row) => row.hasUnresolvedDifference) ? '存在差异'
      : rows.find((row) => row.print.status !== '不需要' && row.print.status !== '已完成')?.print.status
        || rows.find((row) => row.dye.status !== '不需要' && row.dye.status !== '已完成')?.dye.status
        || rows.find((row) => row.purchase.status !== '不需要' && row.purchase.status !== '已到货')?.purchase.status
        || rows[0]?.materialPrep.status || '未形成',
  }
}
