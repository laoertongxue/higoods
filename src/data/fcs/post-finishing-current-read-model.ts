/**
 * 后道当前只读投影。
 *
 * 该文件不持久化、不创建业务单据，也不暴露写动作；它只把
 * post-finishing-full-flow 的权威事实投影给仍使用通用任务、打印、统计界面的消费者。
 */
import {
  POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS,
  getPostFinishingFullFlowPostTask,
  getPostFinishingProcessProgress,
  getPostFinishingQcInspectionSummary,
  type PostFinishingProcessItem,
  listPostFinishingFactoryReturns,
  listPostFinishingFullFlowOutboundOrders,
  listPostFinishingFullFlowPostTasks,
  listPostFinishingTaskQuantitySummaries,
  listPostFinishingTaskChildQuantitySummaries,
  listPostFinishingFullFlowQcTasks,
  getPostFinishingFullFlowQcTask,
  listPostFinishingFullFlowRecheckOrders,
  listPostFinishingWaitHandoverWarehouseRecords,
  type PostFinishingAcceptanceSku,
  type PostFinishingPostTask,
  type PostFinishingQcTask,
  type PostFinishingRecheckOrder,
  type PostFinishingSewingTaskType,
} from './post-finishing-full-flow.ts'
import {
  DEDICATED_POST_FACTORY_ID,
  DEDICATED_POST_FACTORY_NAME,
} from './factory-mock-data.ts'
import { listFactoryMasterRecords } from './factory-master-store.ts'
import { productionOrders } from './production-orders.ts'
import { isKolGotoProductionOrder } from './kol-goto-special-flow.ts'
import { buildFormalPostFinishingReturnSources } from './post-finishing-return-source-adapter.ts'
import { readRuntimeTasks } from './runtime-task-read-bridge.ts'
import type { RuntimeProcessTask } from './runtime-process-tasks.ts'
import { readPostFinishingWoolSourceStore, readPostFinishingSpecialCraftSourceTaskOrders } from './post-finishing-return-source-fact-bridge.ts'

export { listPostFinishingWaitHandoverWarehouseRecords }

export const FULL_CAPABILITY_FACTORY_ID = DEDICATED_POST_FACTORY_ID
export const FULL_CAPABILITY_FACTORY_NAME = DEDICATED_POST_FACTORY_NAME

export function isPostFinishingFactoryId(factoryId: string): boolean {
  return factoryId === DEDICATED_POST_FACTORY_ID || factoryId === 'ID-F002'
}

export type PostFinishingActionType = '扫码收货' | '质检' | '后道' | '出货' | '复检'
export type PostFinishingTaskStatus = '待上游交出' | '待收货' | '待质检' | '质检中' | '待后道' | '后道中' | '待出货' | '待复检' | '待交出' | '待人工完成' | '已完成'

export interface PostFinishingSkuLine {
  skuLineId: string
  spuId: string
  spuCode: string
  spuName: string
  skuId: string
  skuCode: string
  originalSpuCode?: string
  originalSkuCode?: string
  colorName: string
  sizeName: string
  imageUrl?: string
  plannedQty: number
  receivedQty: number
  availableQty: number
  handedOverQty: number
  qtyUnit: string
}

export interface PostFinishingTaskView {
  saleType: string
  skus: PostFinishingAcceptanceSku[]
  postTaskId: string
  postTaskNo: string
  productionOrderId: string
  productionOrderNo: string
  styleId: string
  styleNo: string
  styleName: string
  spuId: string
  spuCode: string
  spuName: string
  techPackVersionId: string
  techPackVersionLabel: string
  managedPostFactoryId: string
  managedPostFactoryName: string
  plannedGarmentQty: number
  qtyUnit: string
  sourceFactoryNames: string[]
  sourceTaskNos: string[]
  sourceTasks: Array<{ taskId: string; taskType: PostFinishingSewingTaskType; sourceKind?: string }>
  currentStatus: PostFinishingTaskStatus
  currentNode: string
  receivedQty: number
  waitQcQty: number
  qcInProgressQty: number
  qcDoneQty: number
  qcReleasedQty?: number
  waitOutboundQty?: number
  waitPostQty: number
  postDoingQty: number
  postDoneQty: number
  waitRecheckQty: number
  recheckDoneQty: number
  waitHandoverQty: number
  qcOrderCount: number
  postOrderCount: number
  recheckOrderCount: number
  acceptanceStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  acceptedAt?: string
  acceptedBy?: string
  rejectedAt?: string
  rejectedBy?: string
  rejectReason?: string
  createdAt: string
  updatedAt: string
}

export interface PostFinishingQcDefectReasonItem {
  reasonItemId: string
  reasonName: string
  qty: number
  liabilityType: '平台' | '工厂'
  responsibleFactoryId?: string
  responsibleFactoryName?: string
}

export interface PostFinishingEvidenceAsset {
  assetId: string
  assetName: string
  assetType: '图片' | '视频' | '文件'
  url: string
}

export interface PostFinishingQcSkuResult {
  qcSkuResultId: string
  skuLineId: string
  skuId: string
  skuCode: string
  originalSkuCode?: string
  skuImageUrl?: string
  colorName: string
  sizeName: string
  inspectedQty: number
  inspectionKnown?: boolean
  uninspectedReleaseQty?: number
  releasedQty?: number
  qualifiedQty: number
  unqualifiedQty: number
  reworkQty: number
  defectAcceptedQty: number
  platformReasonQty: number
  factoryReasonQty: number
  reworkReceiveFactoryId?: string
  reworkReceiveFactoryName?: string
  reworkDeductionUnitAmountIdr?: number
  reworkDeductionAmountIdr?: number
  sourceChargeback?: { currency: 'IDR'; unitAmount: number; amount: number; reason: '后道工厂接收返工' }
  responsibleFactoryId?: string
  responsibleFactoryName?: string
  inspectionIssueSummaries?: string[]
  defectReasonItems: PostFinishingQcDefectReasonItem[]
  postProjectJudgements: Array<{ projectName: PostFinishingProcessItem; needed: boolean; qty: number; buttonAttachMode?: '人工装扣' | '机器装扣' }>
  qtyUnit: string
  remark?: string
}

export interface PostFinishingActionRecord {
  actionId: string
  actionRecordId: string
  actionRecordNo: string
  postOrderId: string
  postOrderNo: string
  linkedQcOrderId?: string
  linkedRecheckOrderId?: string
  actionType: PostFinishingActionType
  status: string
  sourceFactoryName: string
  targetFactoryName: string
  operatorName: string
  startedAt?: string
  finishedAt?: string
  submittedGarmentQty: number
  acceptedGarmentQty: number
  rejectedGarmentQty: number
  diffGarmentQty: number
  qtyUnit: string
  receivedGarmentQty?: number
  inspectedGarmentQty?: number
  passedGarmentQty?: number
  defectiveGarmentQty?: number
  reworkGarmentQty?: number
  defectAcceptedGarmentQty?: number
  processingFeeDeductionQty?: number
  completedPostGarmentQty?: number
  recheckedGarmentQty?: number
  confirmedGarmentQty?: number
  qcSkuResults?: PostFinishingQcSkuResult[]
  warehouseAllocations?: Array<{ warehouseRecordId: string; postTaskId?: string; productionOrderNo: string; sourceFactoryId?: string; sourceFactoryName: string; qcQty: number }>
  qualityDeductionSnapshot?: { qcId: string; qcNo: string; productionOrderNo: string; responsiblePartyType: string; responsiblePartyId: string; responsiblePartyName: string }
  qcResult?: '全数合规' | '部分不合格' | '全数不合格' | '全数合格'
  qcStationName?: string
  evidenceAssets?: PostFinishingEvidenceAsset[]
  needButtonhole?: boolean
  needButton?: boolean
  needIronPack?: boolean
  reworkReceiveFactoryId?: string
  reworkReceiveFactoryName?: string
  skipReason?: string
  skuLines: PostFinishingSkuLine[]
  remark?: string
}

export interface PostFinishingWorkOrder {
  postOrderId: string
  postOrderNo: string
  postTaskId?: string
  postTaskNo?: string
  routeMode: '需要后道加工' | '无需后道加工'
  linkedQcOrderId: string
  linkedRecheckOrderId: string
  sourceContextId: string
  styleId: string
  styleNo: string
  styleName: string
  spuId: string
  spuCode: string
  spuName: string
  skuSummary: string
  skuLines: PostFinishingSkuLine[]
  sourceProductionOrderId: string
  sourceProductionOrderNo: string
  sourceTaskId: string
  sourceTaskNo: string
  sourcePostTaskId?: string
  sourcePostTaskNo?: string
  sourceSewingTaskNo: string
  sourceSewingFactoryId: string
  sourceSewingFactoryName: string
  sourceFactoryType: '车缝厂' | '毛织厂' | '特殊工艺厂' | '未关联任务'
  managedPostFactoryId: string
  managedPostFactoryName: string
  currentFactoryId: string
  currentFactoryName: string
  currentStatus: string
  receiveMaterialStatus: string
  qcStatus: string
  postStatus: string
  recheckStatus: string
  handoverStatus: string
  plannedGarmentQty: number
  plannedGarmentQtyUnit: string
  isDedicatedPostFactory: boolean
  isPostDoneBySewingFactory: boolean
  requiresPostFinishing: boolean
  needButtonhole: boolean
  needButton: boolean
  needIronPack: boolean
  postProcessItems: Array<PostFinishingProcessItem>
  postProjectLines: Array<{
    projectLineId: string
    postOrderId: string
    postOrderNo: string
    qcOrderId: string
    qcOrderNo: string
    skuLineId: string
    skuId: string
    skuCode: string
    skuImageUrl?: string
    colorName: string
    sizeName: string
    projectName: PostFinishingProcessItem
    plannedQty: number
    status: '待开始' | '进行中' | '已完成'
    completedQty: number
    qtyUnit: string
  }>
  qcOrderId: string
  qcOrderNo: string
  recheckOrderId?: string
  recheckOrderNo?: string
  createdAt: string
  updatedAt: string
  receiveAction: PostFinishingActionRecord
  postAction: PostFinishingActionRecord
  qcAction: PostFinishingActionRecord
  recheckAction: PostFinishingActionRecord
  waitProcessWarehouseRecordId: string
  waitHandoverWarehouseRecordId?: string
  handoverRecordId?: string
  handoverAction?: PostFinishingActionRecord & { handoverGarmentQty?: number }
}

export interface SewingFactoryPostTask {
  taskId: string
  taskNo: string
  postTaskId: string
  postTaskNo: string
  relatedPostOrderId?: string
  relatedPostOrderNo?: string
  productionOrderNo: string
  styleNo: string
  spuId: string
  spuCode: string
  spuName: string
  skuLines: PostFinishingSkuLine[]
  sourceFactoryId: string
  sourceFactoryName: string
  status: '待车缝' | '车缝中' | '车缝完成' | '待后道' | '后道中' | '后道完成' | '待交后道工厂' | '已交后道工厂'
  needFactoryPostFinishing: boolean
  managedPostFactoryId: string
  managedPostFactoryName: string
}

export interface PostFinishingQcOrder {
  qcOrderId: string
  qcOrderNo: string
  postTaskId?: string
  postTaskNo?: string
  productionOrderId: string
  productionOrderNo: string
  sourceTaskId: string
  sourceTaskNo: string
  sourceFactoryId: string
  sourceFactoryName: string
  managedPostFactoryId: string
  managedPostFactoryName: string
  spuId: string
  spuCode: string
  spuName: string
  qcStatus: '待质检' | '质检中' | '质检完成'
  inspectedGarmentQty: number
  passedGarmentQty: number
  defectiveGarmentQty: number
  reworkGarmentQty: number
  defectAcceptedGarmentQty: number
  processingFeeDeductionQty: number
  reworkReceiveFactoryId?: string
  reworkReceiveFactoryName?: string
  skuLines: PostFinishingSkuLine[]
  qcSkuResults: PostFinishingQcSkuResult[]
  inspectorName: string
  inspectedAt?: string
  createdAt: string
  updatedAt: string
}

export interface PostFinishingRecheckOrderProjection {
  recheckOrderId: string
  recheckOrderNo: string
  postTaskId?: string
  postTaskNo?: string
  sourceType: '后道加工单'
  qcOrderId: string
  qcOrderNo: string
  postOrderId?: string
  postOrderNo?: string
  productionOrderNo: string
  sourceTaskNo: string
  managedPostFactoryName: string
  spuId: string
  spuCode: string
  spuName: string
  recheckStatus: '待复检' | '复检中' | '复检完成'
  recheckedGarmentQty: number
  passedGarmentQty: number
  defectiveGarmentQty: number
  recheckerName: string
  recheckedAt?: string
  createdAt: string
  updatedAt: string
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

type DeliverySnapshot = ReturnType<typeof listPostFinishingFactoryReturns>
type RecheckSnapshot = ReturnType<typeof listPostFinishingFullFlowRecheckOrders>
type ProcessProgress = ReturnType<typeof getPostFinishingProcessProgress>
interface QcProjectionSnapshot {
  deliveries: DeliverySnapshot
  factories: ReturnType<typeof listFactoryMasterRecords>
}
interface WorkOrderProjectionSnapshot extends QcProjectionSnapshot {
  qcTasks: ReturnType<typeof listPostFinishingFullFlowQcTasks>
  rechecks: RecheckSnapshot
  outbounds: ReturnType<typeof listPostFinishingFullFlowOutboundOrders>
  waitHandovers: ReturnType<typeof listPostFinishingWaitHandoverWarehouseRecords>
}
type TaskChildSnapshot = ReturnType<typeof listPostFinishingTaskChildQuantitySummaries>
interface TaskProjectionSnapshot {
  deliveries: DeliverySnapshot
  qcTasks: ReturnType<typeof listPostFinishingFullFlowQcTasks>
  postTasks: ReturnType<typeof listPostFinishingTaskQuantitySummaries>
  rechecks: TaskChildSnapshot['rechecks']
  outbounds: TaskChildSnapshot['outbounds']
  waitHandovers: TaskChildSnapshot['waitHandovers']
}

// Snapshots belong to one synchronous list read only. Every next call reads
// the current authoritative facts again; there is no cross-action cache.
function workOrderProjectionSnapshot(task?: PostFinishingPostTask): WorkOrderProjectionSnapshot {
  const postTaskIds = task ? new Set([task.postTaskId]) : undefined
  return {
    deliveries: listPostFinishingFactoryReturns(),
    factories: listFactoryMasterRecords(),
    qcTasks: listPostFinishingFullFlowQcTasks(),
    rechecks: [],
    outbounds: listPostFinishingFullFlowOutboundOrders().filter(row=>!postTaskIds || (!!row.postTaskId && postTaskIds.has(row.postTaskId))),
    waitHandovers: listPostFinishingWaitHandoverWarehouseRecords(undefined, postTaskIds),
  }
}

function toSkuLine(sku: PostFinishingAcceptanceSku, quantities: Partial<Pick<PostFinishingSkuLine, 'plannedQty' | 'receivedQty' | 'availableQty' | 'handedOverQty'>> = {}): PostFinishingSkuLine {
  return {
    skuLineId: `${sku.skuId}-LINE`,
    spuId: sku.spuCode,
    spuCode: sku.spuCode,
    spuName: sku.spuName,
    skuId: sku.skuId,
    skuCode: sku.skuCode,
    colorName: sku.colorName,
    sizeName: sku.sizeName,
    imageUrl: sku.imageUrl,
    plannedQty: quantities.plannedQty ?? sku.plannedQty,
    receivedQty: quantities.receivedQty ?? 0,
    availableQty: quantities.availableQty ?? 0,
    handedOverQty: quantities.handedOverQty ?? 0,
    qtyUnit: sku.qtyUnit,
  }
}

function taskStatus(orderId: string, productionOrderNo: string, snapshot: TaskProjectionSnapshot): PostFinishingTaskStatus {
  const deliveries = snapshot.deliveries.filter((item) => item.productionOrderId === orderId && item.status !== '已废弃')
  const qcTasks = snapshot.qcTasks.filter((item) => item.productionOrderId === orderId)
  const postTasks = snapshot.postTasks.filter((item) => item.productionOrderNo === productionOrderNo)
  const rechecks = snapshot.rechecks.filter((item) => item.productionOrderNo === productionOrderNo)
  const outbounds = snapshot.outbounds.filter((item) => deliveries.some((delivery) => delivery.deliveryId === item.deliveryId))
  if (postTasks.some((item) => item.status === '后道中')) return '后道中'
  if (postTasks.some((item) => item.status === '待后道')) return '待后道'
  if (qcTasks.some((item) => item.status === '质检中')) return '质检中'
  if (qcTasks.some((item) => item.status === '待质检' || item.status === '待送检')) return '待质检'
  if (deliveries.some((item) => !item.confirmedAt)) return '待收货'
  if (deliveries.some((delivery) => delivery.confirmedAt && !qcTasks.some((qc) => qc.deliveryId === delivery.deliveryId))) return '待质检'
  if (postTasks.some(task => getPostFinishingProcessProgress(task.postTaskId).availableForOutboundQty > 0) || outbounds.some(row=>row.status==='待出货')) return '待出货'
  if (outbounds.some((item) => item.status !== '已接收入库')) return '待交出'
  const formalOrder = productionOrders.find((item) => item.productionOrderId === orderId)
  if (formalOrder?.status === 'COMPLETED') return '已完成'
  if (outbounds.length > 0) {
    const expectedQty = sum(formalOrder?.demandSnapshot.skuLines.map((line) => line.qty) || [])
      || sum(POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.find((item) => item.productionOrderId === orderId)?.skus.map((sku) => sku.plannedQty) || [])
    const receivedQty = sum(deliveries.flatMap((delivery) => delivery.lines.map((line) => line.confirmedQty || 0)))
    return receivedQty < expectedQty ? '待上游交出' : '待人工完成'
  }
  return deliveries.length ? '待质检' : '待上游交出'
}

function listPostFinishingTaskSources() {
  const formalSources = buildFormalPostFinishingReturnSources({
    productionOrders,
    runtimeTasks: readRuntimeTasks<RuntimeProcessTask>(),
    woolStore: readPostFinishingWoolSourceStore(),
    specialCraftTaskOrders: readPostFinishingSpecialCraftSourceTaskOrders(),
  })
  return [...POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS, ...formalSources]
}

export function listPostFinishingTasks(productionOrderIds?: ReadonlySet<string>): PostFinishingTaskView[] {
  const sources = listPostFinishingTaskSources().filter(source => !productionOrderIds || productionOrderIds.has(source.productionOrderId))
  const deliveries = listPostFinishingFactoryReturns(productionOrderIds)
  const productionOrderNos = productionOrderIds ? new Set([...sources.map(source => source.productionOrderNo), ...deliveries.map(row => row.productionOrderNo)]) : undefined
  const children = listPostFinishingTaskChildQuantitySummaries(productionOrderNos)
  const outboundQuantityById=new Map(listPostFinishingFullFlowOutboundOrders().map(row=>[row.outboundOrderId,row.lines.reduce((n,line)=>n+line.outboundQty,0)]))
  const snapshot: TaskProjectionSnapshot = {
    deliveries,
    qcTasks: listPostFinishingFullFlowQcTasks(productionOrderNos),
    postTasks: listPostFinishingTaskQuantitySummaries(productionOrderNos),
    ...children,
  }
  const orders = new Map<string, {
    productionOrderId: string
    productionOrderNo: string
    styleNo: string
    styleName: string
    skus: PostFinishingAcceptanceSku[]
  }>()
  sources.forEach((source) => {
    const current = orders.get(source.productionOrderId)
    orders.set(source.productionOrderId, {
      productionOrderId: source.productionOrderId,
      productionOrderNo: source.productionOrderNo,
      styleNo: source.styleNo,
      styleName: source.styleName,
      skus: [...new Map([...(current?.skus || []), ...source.skus].map((sku) => [sku.skuId, sku])).values()],
    })
  })
  // 分配关闭或来源已全部回货后，已产生的交接事实仍须可追溯。
  snapshot.deliveries.forEach((delivery) => {
    const current = orders.get(delivery.productionOrderId)
    const sku = delivery.lines[0]?.sku
    orders.set(delivery.productionOrderId, {
      productionOrderId: delivery.productionOrderId,
      productionOrderNo: delivery.productionOrderNo,
      styleNo: current?.styleNo || sku?.spuCode || delivery.productionOrderNo,
      styleName: current?.styleName || sku?.spuName || '成衣',
      skus: [...new Map([...(current?.skus || []), ...delivery.lines.map((line) => line.sku)].map((item) => [item.skuId, item])).values()],
    })
  })
  return [...orders.values()].filter((order) => {
    const formalOrder = productionOrders.find((item) => item.productionOrderId === order.productionOrderId)
    return !formalOrder || !isKolGotoProductionOrder(formalOrder)
  }).map((order) => {
    const deliveries = snapshot.deliveries.filter((item) => item.productionOrderId === order.productionOrderId)
    const qcTasks = snapshot.qcTasks.filter((item) => item.productionOrderId === order.productionOrderId)
    const postTasks = snapshot.postTasks.filter((item) => item.productionOrderNo === order.productionOrderNo)
    const rechecks = snapshot.rechecks.filter((item) => item.productionOrderNo === order.productionOrderNo)
    const waitHandover = snapshot.waitHandovers.filter((item) => item.productionOrderNo === order.productionOrderNo)
    const receivedQty = sum(deliveries.flatMap((delivery) => delivery.lines.map((line) => line.confirmedQty || 0)))
    const qcDoneQty = sum(qcTasks.map(task=>getPostFinishingQcInspectionSummary(task)?.inspectedQty || 0))
    const qcCompletedBatchQty=sum(qcTasks.filter(task=>task.status==='质检完成').flatMap(task=>task.lines.map(line=>line.expectedQty)))
    const qcReleasedQty=sum(qcTasks.filter(task=>task.status==='质检完成').flatMap(task=>(task.results||[]).map(line=>line.releasedQty??line.passedQty)))
    const postDoneQty = sum(postTasks.map(task => task.totalCompletedQty))
    const recheckDoneQty = sum(rechecks.filter((item) => item.status === '复检完成').map(item => item.totalHandoverQty))
    const currentStatus = taskStatus(order.productionOrderId, order.productionOrderNo, snapshot)
    const formalOrder = productionOrders.find((item) => item.productionOrderId === order.productionOrderId)
    const orderSources = sources.filter((item) => item.productionOrderId === order.productionOrderId)
    const createdAt = deliveries[0]?.registeredAt || ''
    const updatedAt = [createdAt, ...deliveries.map((item) => item.confirmedAt || item.registeredAt), ...qcTasks.map((item) => item.completedAt || item.createdAt), ...postTasks.map((item) => item.completedAt || qcTasks.find((qc) => qc.qcTaskId === item.qcTaskId)?.createdAt || createdAt), ...rechecks.map((item) => item.completedAt || qcTasks.find((qc) => qc.qcTaskId === item.qcTaskId)?.createdAt || createdAt)].sort().at(-1) || createdAt
    return {
      postTaskId: `PF-TASK-${order.productionOrderId}`,
      skus: order.skus.map((sku) => ({ ...sku })),
      saleType: formalOrder?.demandSnapshot.saleType || POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.find((source) => source.productionOrderId === order.productionOrderId)?.saleType || '未记录',
      postTaskNo: `PF-${order.productionOrderNo}`,
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
      styleId: order.styleNo,
      styleNo: order.styleNo,
      styleName: order.styleName,
      spuId: order.skus[0]?.spuCode || order.styleNo,
      spuCode: order.skus[0]?.spuCode || order.styleNo,
      spuName: order.skus[0]?.spuName || order.styleName,
      techPackVersionId: formalOrder?.techPackSnapshot?.sourceTechPackVersionId || '',
      techPackVersionLabel: formalOrder?.techPackSnapshot?.sourceTechPackVersionLabel || '绑定生产单技术包快照',
      managedPostFactoryId: DEDICATED_POST_FACTORY_ID,
      managedPostFactoryName: DEDICATED_POST_FACTORY_NAME,
      plannedGarmentQty: sum(formalOrder?.demandSnapshot.skuLines.map((line) => line.qty) || []) || sum(order.skus.map((sku) => sku.plannedQty)),
      qtyUnit: '件',
      sourceFactoryNames: [...new Set([...orderSources.map((item) => 'sourceFactoryName' in item ? item.sourceFactoryName : item.sewingFactoryName), ...deliveries.map((item) => item.sewingFactoryName)])],
      sourceTaskNos: [...new Set([...orderSources.map((item) => 'sourceTaskNo' in item ? item.sourceTaskNo : item.sewingTaskNo), ...deliveries.map((item) => item.sewingTaskNo)])],
      sourceTasks: [...new Map([
        ...orderSources.map((item) => ({ taskId: item.executionTaskId, taskType: 'sewingTaskType' in item ? item.sewingTaskType : item.responsibilityType,
          sourceKind: 'sourceKind' in item ? item.sourceKind : item.sewingTaskType === 'INDEPENDENT_SEWING' ? 'INDEPENDENT_SEWING' : item.sewingTaskType === 'SEWING_TO_IRON_PACK' ? 'SEWING_IRON_PACK' : 'CUTTING_SEWING_IRON_PACK' })),
        ...deliveries.map((item) => {
          const source = orderSources.find((source) => source.executionTaskId === item.executionTaskId)
          return { taskId: item.executionTaskId, taskType: item.sewingTaskType,
            sourceKind: source && ('sourceKind' in source ? source.sourceKind : source.sewingTaskType === 'INDEPENDENT_SEWING' ? 'INDEPENDENT_SEWING' : source.sewingTaskType === 'SEWING_TO_IRON_PACK' ? 'SEWING_IRON_PACK' : 'CUTTING_SEWING_IRON_PACK') || undefined }
        }),
      ].map((item) => [item.taskId, item])).values()],
      currentStatus,
      currentNode: currentStatus,
      receivedQty,
      waitQcQty: Math.max(receivedQty - qcCompletedBatchQty, 0),
      qcInProgressQty: sum(qcTasks.filter((item) => item.status === '质检中').flatMap((item) => item.lines.map((line) => line.expectedQty))),
      qcDoneQty,
      qcReleasedQty,
      waitOutboundQty:sum(snapshot.outbounds.filter(row=>row.productionOrderNo===order.productionOrderNo&&row.status==='待出货').map(row=>outboundQuantityById.get(row.outboundOrderId)||0)),
      waitPostQty: sum(postTasks.filter((item) => item.status === '待后道').map(item => item.totalExpectedQty)),
      postDoingQty: sum(postTasks.filter(item => item.status === '后道中').map(task => task.totalExpectedQty - task.totalCompletedQty)),
      postDoneQty,
      waitRecheckQty: 0,
      recheckDoneQty: 0,
      waitHandoverQty: sum(waitHandover.map(item => item.totalAvailableQty)),
      qcOrderCount: qcTasks.length,
      postOrderCount: postTasks.length,
      recheckOrderCount: 0,
      acceptanceStatus: deliveries.length ? 'ACCEPTED' : 'PENDING',
      acceptedAt: deliveries[0]?.registeredAt,
      acceptedBy: deliveries.length ? DEDICATED_POST_FACTORY_NAME : undefined,
      createdAt,
      updatedAt,
    }
  })
}

export function getPostFinishingTaskById(taskId: string): PostFinishingTaskView | undefined {
  // 正式任务ID/编号已有生产单归属，直达时无需复制其他生产单的质检快照。
  // 原上游任务号仍按既有别名匹配，不能把它误当成本对象编号。
  if (taskId.startsWith('PF-TASK-')) {
    const task = listPostFinishingTasks(new Set([taskId.slice('PF-TASK-'.length)]))
      .find(item => item.postTaskId === taskId)
    if (task) return task
  } else if (taskId.startsWith('PF-')) {
    const task = getPostFinishingTaskByProductionOrder(taskId.slice('PF-'.length))
    if (task?.postTaskNo === taskId) return task
  }
  return listPostFinishingTasks().find((item) => item.postTaskId === taskId || item.postTaskNo === taskId || item.sourceTaskNos.includes(taskId))
}

export function getPostFinishingTaskByProductionOrder(orderIdOrNo: string): PostFinishingTaskView | undefined {
  // 保留车缝、毛织和特殊工艺的实际来源，来源退役后的历史仍通过原回货单保留。
  const productionOrderIds = new Set<string>()
  for (const order of [...listPostFinishingTaskSources(), ...listPostFinishingFactoryReturns()]) {
    if (order.productionOrderId === orderIdOrNo || order.productionOrderNo === orderIdOrNo) productionOrderIds.add(order.productionOrderId)
  }
  if (!productionOrderIds.size) return undefined
  return listPostFinishingTasks(productionOrderIds).find((item) => item.productionOrderId === orderIdOrNo || item.productionOrderNo === orderIdOrNo)
}

function buildQcSkuResults(task: PostFinishingQcTask, delivery: DeliverySnapshot[number] | undefined, factories: QcProjectionSnapshot['factories']): PostFinishingQcSkuResult[] {
  const demoReworkUnitAmountIdr = 0
  const inspection = getPostFinishingQcInspectionSummary(task)
  return task.lines.map((line) => {
    const result = task.results?.find((item) => item.sku.skuId === line.sku.skuId)
    const actual = inspection?.lines.find(row=>row.skuId===line.sku.skuId)
    const qualifiedQty = actual?.passedQty ?? result?.passedQty ?? 0
    const unqualifiedQty = actual ? actual.returnQty + actual.defectQty : (result?.returnQty || 0) + (result?.defectQty || 0)
    const receiver = result?.returnReceiver
      ? factories.find((factory) => factory.name === result.returnReceiver)
      : undefined
    const externalRework = Boolean(
      result?.returnQty
      && result.returnReceiver
      && delivery?.sewingFactoryName
      && result.returnReceiver !== delivery.sewingFactoryName,
    )
    const reworkDeductionAmountIdr = externalRework
      ? (result?.returnQty || 0) * demoReworkUnitAmountIdr
      : 0
    const defectReasonItems = (result?.defectReasonQuantities || []).map((reason, index) => {
      const platformReason = ['色差', '布料原因'].includes(reason.reason)
      return {
        reasonItemId: `${task.qcTaskId}-${line.sku.skuId}-REASON-${index + 1}`,
        reasonName: reason.reason,
        qty: reason.quantity,
        liabilityType: platformReason ? '平台' as const : '工厂' as const,
        responsibleFactoryId: platformReason ? undefined : delivery?.sewingFactoryId,
        responsibleFactoryName: platformReason ? undefined : delivery?.sewingFactoryName,
      }
    })
    const platformReasonQty = defectReasonItems
      .filter((item) => item.liabilityType === '平台')
      .reduce((total, item) => total + item.qty, 0)
    return {
      qcSkuResultId: `${task.qcTaskId}-${line.sku.skuId}`,
      skuLineId: `${line.sku.skuId}-LINE`,
      skuId: line.sku.skuId,
      skuCode: line.sku.skuCode,
      skuImageUrl: line.sku.imageUrl,
      colorName: line.sku.colorName,
      sizeName: line.sku.sizeName,
      inspectedQty: actual?.inspectedQty || 0,
      inspectionKnown:!!inspection,
      uninspectedReleaseQty:task.status==='质检完成'?(result?.uninspectedQty||0):0,
      releasedQty:result?.releasedQty??result?.passedQty??0,
      qualifiedQty,
      unqualifiedQty,
      reworkQty: actual?.returnQty ?? result?.returnQty ?? 0,
      defectAcceptedQty: actual?.defectQty ?? result?.defectQty ?? 0,
      platformReasonQty,
      factoryReasonQty: Math.max(unqualifiedQty - platformReasonQty, 0),
      reworkReceiveFactoryId: receiver?.id,
      reworkReceiveFactoryName: result?.returnReceiver,
      reworkDeductionUnitAmountIdr: reworkDeductionAmountIdr > 0 ? demoReworkUnitAmountIdr : 0,
      reworkDeductionAmountIdr,
      sourceChargeback: reworkDeductionAmountIdr > 0
        ? { currency: 'IDR', unitAmount: demoReworkUnitAmountIdr, amount: reworkDeductionAmountIdr, reason: '后道工厂接收返工' }
        : undefined,
      responsibleFactoryId: delivery?.sewingFactoryId,
      responsibleFactoryName: delivery?.sewingFactoryName,
      inspectionIssueSummaries:task.inspection?.rounds.flatMap(round=>round.lines.filter(row=>row.skuId===line.sku.skuId).flatMap(row=>(row.issues||[]).map(issue=>`${(task.inspection!.snapshot.skuSnapshots?.find(sku=>sku.skuId===line.sku.skuId)?.snapshot || task.inspection!.snapshot).items.find(item=>item.id===issue.itemId)?.name || issue.itemId}${issue.note?`：${issue.note}`:''}`))),
      defectReasonItems,
      postProjectJudgements: (task.frozenProcessItems || []).map((projectName) => ({ projectName, needed: true, qty: result?.releasedQty ?? qualifiedQty })),
      qtyUnit: line.sku.qtyUnit,
      remark: result?.returnReason,
    }
  })
}

function blankAction(input: {
  id: string
  no: string
  type: PostFinishingActionType
  status: string
  lines: PostFinishingSkuLine[]
  submitted: number
  accepted: number
  rejected?: number
  operator?: string
  startedAt?: string
  finishedAt?: string
  qcResults?: PostFinishingQcSkuResult[]
}): PostFinishingActionRecord {
  return {
    actionId: input.id,
    actionRecordId: input.id,
    actionRecordNo: input.no,
    postOrderId: input.id,
    postOrderNo: input.no,
    actionType: input.type,
    status: input.status,
    sourceFactoryName: '',
    targetFactoryName: DEDICATED_POST_FACTORY_NAME,
    operatorName: input.operator || '',
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    submittedGarmentQty: input.submitted,
    acceptedGarmentQty: input.accepted,
    rejectedGarmentQty: input.rejected || 0,
    diffGarmentQty: input.submitted - input.accepted - (input.rejected || 0),
    qtyUnit: '件',
    skuLines: input.lines,
    qcSkuResults: input.qcResults,
  }
}

function toQcAction(task: PostFinishingQcTask, snapshot: QcProjectionSnapshot): PostFinishingActionRecord {
  const delivery = snapshot.deliveries.find((item) => item.deliveryId === task.deliveryId)
  const results = buildQcSkuResults(task, delivery, snapshot.factories)
  const inspectedQty = sum(results.map((line) => line.inspectedQty))
  const passedQty = sum(results.map((line) => line.qualifiedQty))
  const unqualifiedQty = sum(results.map((line) => line.unqualifiedQty))
  const action = blankAction({
    id: task.qcTaskId, no: task.qcTaskNo, type: '质检', status: task.status,
    lines: task.lines.map((line) => toSkuLine(line.sku, { plannedQty: line.expectedQty, receivedQty: line.expectedQty })),
    submitted: inspectedQty, accepted: passedQty, rejected: unqualifiedQty,
    operator: task.claimedBy?.actorName, startedAt: task.claimedAt, finishedAt: task.completedAt, qcResults: results,
  })
  action.postOrderId = task.postTaskId || ''
  action.postOrderNo = task.postTaskNo || ''
  action.linkedQcOrderId = task.qcTaskId
  action.sourceFactoryName = task.sourceKind==='WAREHOUSE_STOCK'?task.sourceWarehouseName || '原仓待核对':delivery?.sewingFactoryName || ''
  action.warehouseAllocations = [{
    warehouseRecordId: `PF-WAIT-${task.deliveryId}`,
    postTaskId: task.sourceKind==='WAREHOUSE_STOCK'?'':`PF-TASK-${task.productionOrderId}`,
    productionOrderNo: task.productionOrderNo,
    sourceFactoryId: delivery?.sewingFactoryId,
    sourceFactoryName: delivery?.sewingFactoryName || '',
    qcQty: inspectedQty,
  }]
  action.diffGarmentQty = 0 // Unknown legacy inspection is not a quantity shortfall.
  action.inspectedGarmentQty = inspectedQty
  action.passedGarmentQty = passedQty
  action.defectiveGarmentQty = unqualifiedQty
  action.reworkGarmentQty = sum(results.map((line) => line.reworkQty))
  action.defectAcceptedGarmentQty = sum(results.map((line) => line.defectAcceptedQty))
  action.reworkReceiveFactoryId = [...new Set(results.map((line) => line.reworkReceiveFactoryId).filter(Boolean))].join('、') || undefined
  action.reworkReceiveFactoryName = [...new Set(results.map((line) => line.reworkReceiveFactoryName).filter(Boolean))].join('、') || undefined
  return action
}

function workOrderSkuLines(task: PostFinishingPostTask, outbounds: ReturnType<typeof listPostFinishingFullFlowOutboundOrders>): PostFinishingSkuLine[] {
  return task.lines.map((line) => toSkuLine(line.sku, {
    plannedQty: line.expectedQty,
    receivedQty: line.expectedQty,
    availableQty: line.expectedQty,
    handedOverQty: sum(outbounds.filter(row=>row.status!=='待出货').flatMap(row => row.lines.filter(q => q.sku.skuId === line.sku.skuId).map(q => q.outboundQty))),
  }))
}

function toReceiveAction(task: PostFinishingPostTask, skuLines: PostFinishingSkuLine[], delivery: DeliverySnapshot[number] | undefined): PostFinishingActionRecord {
  const plannedQty = sum(task.lines.map((line) => line.expectedQty))
  const action = blankAction({ id: task.deliveryId, no: task.deliveryOrderNo, type: '扫码收货', status: delivery?.status || '', lines: skuLines, submitted: plannedQty, accepted: plannedQty, operator: delivery?.confirmedBy?.actorName, finishedAt: delivery?.confirmedAt })
  action.receivedGarmentQty = delivery?.lines.reduce((total, line) => total + (line.confirmedQty || 0), 0) || 0
  return action
}

function toPostAction(task: PostFinishingPostTask, skuLines: PostFinishingSkuLine[], progress: ProcessProgress): PostFinishingActionRecord {
  const action = blankAction({ id: task.postTaskId, no: task.postTaskNo, type: '后道', status: task.status, lines: skuLines,
    submitted: sum(task.lines.map((line) => line.expectedQty)), accepted: progress.totalCompletedQty,
    operator: [...new Set(progress.records.map(row => row.responsible.actorName))].join('、') || (task.executionModel ? undefined : '历史合并记录'), startedAt: task.startedAt, finishedAt: task.completedAt })
  action.completedPostGarmentQty = progress.totalCompletedQty
  return action
}

function toRecheckAction(row: PostFinishingRecheckOrder): PostFinishingActionRecord {
  const lines = row.lines.map(line => toSkuLine(line.sku, { plannedQty: line.expectedQty, availableQty: 0 }))
  const qty = sum(row.lines.map(line => line.handoverQty || 0))
  const action = blankAction({ id: row.recheckOrderId, no: row.recheckOrderNo, type: '复检', status: row.status, lines,
    submitted: sum(row.lines.map(line => line.expectedQty)), accepted: row.status === '复检完成' ? qty : 0,
    operator: row.claimedBy?.actorName, startedAt: row.claimedAt, finishedAt: row.completedAt })
  action.postOrderId = row.postTaskId || ''; action.postOrderNo = row.postTaskNo || ''; action.linkedRecheckOrderId = row.recheckOrderId
  action.recheckedGarmentQty = action.acceptedGarmentQty; action.confirmedGarmentQty = action.acceptedGarmentQty
  return action
}

function toWorkOrder(task: PostFinishingPostTask, snapshot: WorkOrderProjectionSnapshot): PostFinishingWorkOrder {
  const delivery = snapshot.deliveries.find((item) => item.deliveryId === task.deliveryId)
  const qc = snapshot.qcTasks.find((item) => item.qcTaskId === task.qcTaskId)
  const progress = getPostFinishingProcessProgress(task)
  const rechecks:RecheckSnapshot = []
  const outbounds=snapshot.outbounds.filter(item=>item.postTaskId===task.postTaskId)
  const recheck = rechecks.find(item => item.status !== '复检完成') || rechecks[0]
  const waitHandovers = snapshot.waitHandovers.filter(item => item.postTaskId === task.postTaskId)
  const waitHandover = waitHandovers.find(item => item.status !== '已交出') || waitHandovers[0]
  const skuLines = workOrderSkuLines(task, outbounds)
  const plannedQty = sum(task.lines.map((line) => line.expectedQty))
  const recheckQty = sum(rechecks.flatMap(row => row.status === '复检完成' ? row.lines.map(line => line.handoverQty || 0) : []))
  const emptyReceive = toReceiveAction(task, skuLines, delivery)
  const qcAction = qc ? toQcAction(qc, snapshot) : blankAction({ id: task.qcTaskId, no: task.qcTaskNo, type: '质检', status: '', lines: skuLines, submitted: 0, accepted: 0 })
  const postAction = toPostAction(task, skuLines, progress)
  const recheckAction = blankAction({ id: rechecks.length > 1 ? '' : recheck?.recheckOrderId || '', no: rechecks.length > 1 ? `复检汇总（${rechecks.length}张）` : recheck?.recheckOrderNo || '', type: '复检', status: rechecks.length ? rechecks.every(row => row.status === '复检完成') ? '复检完成' : '待复检' : '', lines: skuLines, submitted: plannedQty, accepted: recheckQty, operator: rechecks.length > 1 ? '系统汇总（明细见各复检单）' : recheck?.claimedBy?.actorName, startedAt: rechecks.length > 1 ? undefined : recheck?.claimedAt, finishedAt: rechecks.length > 1 ? undefined : recheck?.completedAt })
  recheckAction.recheckedGarmentQty = recheckQty
  recheckAction.confirmedGarmentQty = recheckQty
  const handedOverQty = sum(waitHandovers.flatMap(row => row.lines.map(line => line.handedOverQty)))
  const handoverAction = blankAction({
    id: waitHandovers.length > 1 ? '' : waitHandover?.outboundOrderId || '',
    no: waitHandovers.length > 1 ? waitHandovers.map(row => row.outboundOrderNo).join('、') : waitHandover?.outboundOrderNo || '',
    type: '出货',
    status: waitHandover?.status || '待交出',
    lines: skuLines,
    submitted: sum(waitHandovers.flatMap(row => row.lines.map(line => line.inboundQty))),
    accepted: handedOverQty,
    operator: waitHandovers.length > 1 ? '系统汇总（明细见各出货单）' : waitHandover?.handedOverBy?.actorName,
    finishedAt: waitHandovers.length > 1 ? undefined : waitHandover?.handedOverAt,
  }) as PostFinishingActionRecord & { handoverGarmentQty?: number }
  handoverAction.handoverGarmentQty = handedOverQty
  return {
    postOrderId: task.postTaskId,
    postOrderNo: task.postTaskNo,
    postTaskId: task.postTaskId,
    postTaskNo: task.postTaskNo,
    routeMode: '需要后道加工',
    linkedQcOrderId: task.qcTaskId,
    linkedRecheckOrderId: recheck?.recheckOrderId || '',
    sourceContextId: task.deliveryId,
    styleId: skuLines[0]?.spuCode || task.productionOrderNo,
    styleNo: skuLines[0]?.spuCode || task.productionOrderNo,
    styleName: skuLines[0]?.spuName || '成衣',
    spuId: skuLines[0]?.spuId || task.productionOrderNo,
    spuCode: skuLines[0]?.spuCode || task.productionOrderNo,
    spuName: skuLines[0]?.spuName || '成衣',
    skuSummary: skuLines.map((line) => `${line.skuCode}/${line.colorName}/${line.sizeName}`).join('、'),
    skuLines,
    sourceProductionOrderId: delivery?.productionOrderId || task.productionOrderNo,
    sourceProductionOrderNo: task.productionOrderNo,
    sourceTaskId: task.postTaskId,
    sourceTaskNo: task.postTaskNo,
    sourceSewingTaskNo: delivery?.sewingTaskNo || '',
    sourceSewingFactoryId: delivery?.sewingFactoryId || '',
    sourceSewingFactoryName: delivery?.sewingFactoryName || '',
    sourceFactoryType: '车缝厂',
    managedPostFactoryId: DEDICATED_POST_FACTORY_ID,
    managedPostFactoryName: DEDICATED_POST_FACTORY_NAME,
    currentFactoryId: DEDICATED_POST_FACTORY_ID,
    currentFactoryName: DEDICATED_POST_FACTORY_NAME,
    currentStatus: task.status,
    receiveMaterialStatus: delivery?.status || '',
    qcStatus: qc?.status || '',
    postStatus: task.status,
    recheckStatus: recheck?.status || '',
    handoverStatus: waitHandover?.status || '',
    plannedGarmentQty: plannedQty,
    plannedGarmentQtyUnit: '件',
    isDedicatedPostFactory: true,
    isPostDoneBySewingFactory: false,
    requiresPostFinishing: true,
    needButtonhole: task.processItems.includes('开扣眼'),
    needButton: task.processItems.includes('装扣子'),
    needIronPack: (task.processItems.includes('熨烫') || task.processItems.includes('包装')),
    postProcessItems: [...task.processItems],
    postProjectLines: task.lines.flatMap((line) => task.processItems.map((projectName) => ({
      projectLineId: `${task.postTaskId}-${line.sku.skuId}-${projectName}`,
      postOrderId: task.postTaskId,
      postOrderNo: task.postTaskNo,
      qcOrderId: task.qcTaskId,
      qcOrderNo: task.qcTaskNo,
      skuLineId: `${line.sku.skuId}-LINE`,
      skuId: line.sku.skuId,
      skuCode: line.sku.skuCode,
      skuImageUrl: line.sku.imageUrl,
      colorName: line.sku.colorName,
      sizeName: line.sku.sizeName,
      projectName,
      plannedQty: progress.processes.find(row => row.processItem === projectName)?.lines.find(row => row.sku.skuId === line.sku.skuId)?.expectedQty || 0,
      status: (progress.processes.find(row => row.processItem === projectName)?.lines.find(row => row.sku.skuId === line.sku.skuId)?.completedQty || 0) >= (progress.processes.find(row => row.processItem === projectName)?.lines.find(row => row.sku.skuId === line.sku.skuId)?.expectedQty || 0) ? '已完成' as const : (progress.processes.find(row => row.processItem === projectName)?.lines.find(row => row.sku.skuId === line.sku.skuId)?.completedQty || 0) > 0 ? '进行中' as const : '待开始' as const,
      completedQty: progress.processes.find(row => row.processItem === projectName)?.lines.find(row => row.sku.skuId === line.sku.skuId)?.completedQty || 0,
      qtyUnit: line.sku.qtyUnit,
    }))),
    qcOrderId: task.qcTaskId,
    qcOrderNo: task.qcTaskNo,
    recheckOrderId: recheck?.recheckOrderId,
    recheckOrderNo: recheck?.recheckOrderNo,
    createdAt: qc?.createdAt || delivery?.registeredAt || task.startedAt || '',
    updatedAt: task.completedAt || task.startedAt || qc?.createdAt || delivery?.registeredAt || '',
    receiveAction: emptyReceive,
    postAction,
    qcAction,
    recheckAction,
    handoverAction,
    waitProcessWarehouseRecordId: `PF-WAIT-${task.deliveryId}`,
    waitHandoverWarehouseRecordId: waitHandover?.warehouseRecordId,
    handoverRecordId: waitHandover?.status === '已交出' ? waitHandover.outboundOrderId : undefined,
  }
}

export function listPostFinishingWorkOrders(): PostFinishingWorkOrder[] {
  const tasks = listPostFinishingFullFlowPostTasks()
  const snapshot = workOrderProjectionSnapshot()
  return tasks.map(task => toWorkOrder(task, snapshot))
}

export function getPostFinishingWorkOrderById(idOrNo: string): PostFinishingWorkOrder | undefined {
  const task = getPostFinishingFullFlowPostTask(idOrNo)
  return task ? toWorkOrder(task, workOrderProjectionSnapshot(task)) : undefined
}

export function getPostFinishingWorkOrderBySourceTaskId(taskId: string): PostFinishingWorkOrder | undefined {
  return listPostFinishingWorkOrders().find((item) => item.sourceTaskId === taskId || item.postTaskId === taskId)
}

export function listSewingFactoryPostTasks(): SewingFactoryPostTask[] {
  return []
}

export function getSewingFactoryPostTaskById(_taskId: string): SewingFactoryPostTask | undefined {
  return undefined
}

export function getPostFinishingSourceLabel(order: Pick<PostFinishingWorkOrder, 'sourceFactoryType' | 'requiresPostFinishing'>): string {
  return `${order.sourceFactoryType}回货 · ${order.requiresPostFinishing ? 'QC 已确认后道项目' : 'QC 直达成衣仓'}`
}

export function getPostFinishingFlowText(order: Pick<PostFinishingWorkOrder, 'requiresPostFinishing'>): string {
  return order.requiresPostFinishing ? 'QC → 后道加工 → 后道出货单 → 实际发出 → 成衣仓接收' : 'QC → 后道出货单 → 实际发出 → 成衣仓接收'
}

export function listPostFinishingActionRecords(actionType?: PostFinishingActionType): PostFinishingActionRecord[] {
  if (actionType === '质检') return listPostFinishingQcOrders()
  const rechecks:RecheckSnapshot=[]
  if (actionType === '复检') return []
  const outbounds=listPostFinishingFullFlowOutboundOrders()
  if (actionType && actionType !== '后道' && actionType !== '扫码收货') return []
  const tasks = listPostFinishingFullFlowPostTasks()
  const deliveries = actionType === '后道' ? [] : listPostFinishingFactoryReturns()
  const actions = tasks.flatMap(task => {
    const skuLines = workOrderSkuLines(task, outbounds.filter(row => row.postTaskId === task.postTaskId))
    const receive = () => toReceiveAction(task, skuLines, deliveries.find(row => row.deliveryId === task.deliveryId))
    const post = () => toPostAction(task, skuLines, getPostFinishingProcessProgress(task))
    if (actionType === '扫码收货') return [receive()]
    if (actionType === '后道') return [post()]
    return [receive(), post()]
  })
  if (actionType) return actions
  const qcSnapshot = { deliveries, factories: listFactoryMasterRecords() }
  // Preserve the public all-actions order: each parent's receive then post,
  // followed by every actual recheck and finally every QC (including QC-only).
  return [...actions, ...listPostFinishingFullFlowQcTasks().map(task => toQcAction(task, qcSnapshot))]
}

export function listPostFinishingQcOrders(): PostFinishingActionRecord[] {
  const tasks = listPostFinishingFullFlowQcTasks()
  const snapshot = { deliveries: listPostFinishingFactoryReturns(), factories: listFactoryMasterRecords() }
  return tasks.map(task => toQcAction(task, snapshot))
}

export function listPostFinishingRecheckOrders(): PostFinishingActionRecord[] {
  return listPostFinishingActionRecords('复检')
}

export function listPostFinishingQcOrderEntities(qcIdOrNo?: string): PostFinishingQcOrder[] {
  const deliveries = listPostFinishingFactoryReturns()
  const factories = listFactoryMasterRecords()
  const selected = qcIdOrNo === undefined ? undefined : getPostFinishingFullFlowQcTask(qcIdOrNo)
  const tasks = qcIdOrNo === undefined ? listPostFinishingFullFlowQcTasks() : selected ? [selected] : []
  return tasks.map((task) => {
    const delivery = deliveries.find((item) => item.deliveryId === task.deliveryId)
    const skuResults = buildQcSkuResults(task, delivery, factories)
    const reworkReceiveFactoryIds = [...new Set(skuResults.map((line) => line.reworkReceiveFactoryId).filter(Boolean))].join('、')
    const reworkReceiveFactoryNames = [...new Set(skuResults.map((line) => line.reworkReceiveFactoryName).filter(Boolean))].join('、')
    return {
      qcOrderId: task.qcTaskId,
      qcOrderNo: task.qcTaskNo,
      postTaskId: task.postTaskId,
      postTaskNo: task.postTaskNo,
      productionOrderId: task.productionOrderId,
      productionOrderNo: task.productionOrderNo,
      sourceTaskId: delivery?.sewingTaskNo || task.deliveryId,
      sourceTaskNo: delivery?.sewingTaskNo || task.deliveryOrderNo,
      sourceFactoryId: delivery?.sewingFactoryId || '',
      sourceFactoryName: delivery?.sewingFactoryName || '',
      managedPostFactoryId: DEDICATED_POST_FACTORY_ID,
      managedPostFactoryName: DEDICATED_POST_FACTORY_NAME,
      spuId: task.lines[0]?.sku.spuCode || task.productionOrderNo,
      spuCode: task.lines[0]?.sku.spuCode || task.productionOrderNo,
      spuName: task.lines[0]?.sku.spuName || '成衣',
      qcStatus: task.status === '待送检' ? '待质检' : task.status,
      inspectedGarmentQty: sum(skuResults.map((line) => line.inspectedQty)),
      passedGarmentQty: sum(skuResults.map((line) => line.qualifiedQty)),
      defectiveGarmentQty: sum(skuResults.map((line) => line.unqualifiedQty)),
      reworkGarmentQty: sum(skuResults.map((line) => line.reworkQty)),
      defectAcceptedGarmentQty: sum(skuResults.map((line) => line.defectAcceptedQty)),
      processingFeeDeductionQty: 0,
      reworkReceiveFactoryId: reworkReceiveFactoryIds || undefined,
      reworkReceiveFactoryName: reworkReceiveFactoryNames || undefined,
      skuLines: task.lines.map((line) => toSkuLine(line.sku, {
        plannedQty: line.expectedQty,
        receivedQty: line.expectedQty,
        availableQty: task.status === '质检完成' ? 0 : line.expectedQty,
      })),
      qcSkuResults: skuResults,
      inspectorName: task.claimedBy?.actorName || '',
      inspectedAt: task.completedAt,
      createdAt: task.createdAt,
      updatedAt: task.completedAt || task.claimedAt || task.createdAt,
    }
  })
}

function projectRecheck(order: PostFinishingRecheckOrder, postTasks: PostFinishingPostTask[]): PostFinishingRecheckOrderProjection {
  const postTask = postTasks.find((item) => item.postTaskId === order.postTaskId)
  const qty = sum(order.lines.map((line) => line.handoverQty || 0))
  return {
    recheckOrderId: order.recheckOrderId,
    recheckOrderNo: order.recheckOrderNo,
    postTaskId: order.postTaskId,
    postTaskNo: order.postTaskNo,
    sourceType: '后道加工单',
    qcOrderId: order.qcTaskId,
    qcOrderNo: order.qcTaskNo,
    postOrderId: order.postTaskId,
    postOrderNo: order.postTaskNo,
    productionOrderNo: order.productionOrderNo,
    sourceTaskNo: order.postTaskNo || '',
    managedPostFactoryName: DEDICATED_POST_FACTORY_NAME,
    spuId: postTask?.lines[0]?.sku.spuCode || order.productionOrderNo,
    spuCode: postTask?.lines[0]?.sku.spuCode || order.productionOrderNo,
    spuName: postTask?.lines[0]?.sku.spuName || '成衣',
    recheckStatus: order.status === '复检完成' ? '复检完成' : order.status === '待复检' ? '待复检' : '复检中',
    recheckedGarmentQty: qty,
    passedGarmentQty: qty,
    defectiveGarmentQty: 0,
    recheckerName: order.claimedBy?.actorName || '',
    recheckedAt: order.completedAt,
    createdAt: order.createdAt || order.claimedAt || order.completedAt || '',
    updatedAt: order.completedAt || order.claimedAt || order.createdAt || '',
  }
}

export function listPostFinishingRecheckOrderEntities(): PostFinishingRecheckOrderProjection[] {
  const postTasks = listPostFinishingFullFlowPostTasks()
  return listPostFinishingFullFlowRecheckOrders().map(order => projectRecheck(order, postTasks))
}

export function listPostFinishingIdentityMigrationCandidates(productionOrderIdOrNo: string, color: string): Array<{
  objectType: string
  objectId: string
  size: string
  originalSpuCode: string
  originalSkuCode: string
}> {
  const normalizedColor = color.trim().toLowerCase()
  const qcCandidates = listPostFinishingFullFlowQcTasks()
    .filter((task) => task.productionOrderId === productionOrderIdOrNo || task.productionOrderNo === productionOrderIdOrNo)
    .flatMap((task) => (task.results || [])
      .filter((line) => line.sku.colorName.trim().toLowerCase() === normalizedColor)
      .filter((line) => line.returnQty > 0 || line.defectQty > 0)
      .map((line) => ({
        objectType: 'QC_SKU_RESULT',
        objectId: `${task.qcTaskId}-${line.sku.skuId}`,
        size: line.sku.sizeName,
        originalSpuCode: line.sku.spuCode,
        originalSkuCode: line.sku.skuCode,
      })))
  return qcCandidates
}
