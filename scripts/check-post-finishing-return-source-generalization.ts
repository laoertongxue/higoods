import assert from 'node:assert/strict'
import {
  buildFormalPostFinishingReturnSources,
  type PostFinishingFormalReturnSourceFacts,
} from '../src/data/fcs/post-finishing-return-source-adapter.ts'
import type { ProductionOrder } from '../src/data/fcs/production-orders.ts'
import type { RuntimeProcessTask } from '../src/data/fcs/runtime-process-tasks.ts'
import type { SpecialCraftTaskOrder } from '../src/data/fcs/special-craft-task-orders.ts'
import type { WoolDomainStore } from '../src/data/fcs/wool-task-domain.ts'
import '../src/data/fcs/runtime-process-tasks.ts'
import '../src/data/fcs/wool-task-domain.ts'
import '../src/data/fcs/special-craft-task-orders.ts'
import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  getPostFinishingReturnSourceScanValue,
  listPostFinishingReturnRegistrationSources,
  registerPostFinishingFactoryReturn,
  resetPostFinishingFullFlow,
  resolvePostFinishingReturnRegistrationSource,
} from '../src/data/fcs/post-finishing-full-flow.ts'

function order(id: string, no: string, options?: { kol?: boolean }): ProductionOrder {
  const saleType = options?.kol ? 'KOL样衣' : '预售'
  const snapshot = { demandId: `D-${id}`, spuCode: `SPU-${id}`, spuName: `款式 ${id}`, buyerName: '买手', merchandiserName: '跟单', saleType, priority: '普通', requiredDeliveryDate: null, constraintsNote: '', skuLines: [] }
  return {
    productionOrderId: id,
    productionOrderNo: no,
    mainFactoryId: options?.kol ? 'KOL-GOTO-001' : 'FACTORY-MAIN',
    demandSnapshot: snapshot,
    sourceDemandSnapshots: [snapshot],
    techPackSnapshot: null,
  } as unknown as ProductionOrder
}

function runtimeTask(input: {
  id: string
  order: ProductionOrder
  kind: 'SEW' | 'SEWING_IRON_PACK' | 'CUTTING_SEWING_IRON_PACK'
  assignmentStatus?: 'ASSIGNED' | 'AWARDED' | 'UNASSIGNED'
}): RuntimeProcessTask {
  return {
    taskId: input.id,
    taskNo: `NO-${input.id}`,
    productionOrderId: input.order.productionOrderId,
    productionOrderNo: input.order.productionOrderNo,
    processCode: 'PROC_SEW',
    processBusinessCode: input.kind,
    processNameZh: '车缝',
    mergedTaskType: input.kind === 'SEW' ? undefined : input.kind,
    assignmentStatus: input.assignmentStatus || 'ASSIGNED',
    acceptanceStatus: 'ACCEPTED',
    assignedFactoryId: 'SEW-FACTORY',
    assignedFactoryName: '三方车缝厂',
    status: 'IN_PROGRESS',
    executionEnabled: true,
    scopeSkuLines: [
      { skuCode: `SKU-${input.id}-S`, size: 'S', color: '黑色', qty: 10 },
      { skuCode: `SKU-${input.id}-M`, size: 'M', color: '黑色', qty: 20 },
    ],
  } as unknown as RuntimeProcessTask
}

function specialTask(input: {
  id: string
  order: ProductionOrder
  operationId: 'AUX-OP-HEAT-TRANSFER' | 'AUX-OP-DIRECT-PRINT'
  returnedQty: number
  targetObject?: '成衣' | '已裁部位'
}): SpecialCraftTaskOrder {
  return {
    taskOrderId: input.id,
    taskOrderNo: `NO-${input.id}`,
    operationId: input.operationId,
    targetObject: input.targetObject || '成衣',
    productionOrderId: input.order.productionOrderId,
    productionOrderNo: input.order.productionOrderNo,
    assignmentStatus: 'ASSIGNED',
    assignedFactoryId: 'GRAPHIC-FACTORY',
    assignedFactoryName: '成衣图案工厂',
    factoryId: 'GRAPHIC-FACTORY',
    factoryName: '成衣图案工厂',
    lineProgress: [{
      lineProgressKey: `sku:${input.id}`,
      lineType: 'sku',
      skuCode: `SKU-${input.id}`,
      partName: '成衣',
      colorName: '白色',
      sizeCode: 'M',
      planQty: 10,
      receivedQty: 10,
      completedQty: 10,
      returnedQty: input.returnedQty,
    }],
  } as unknown as SpecialCraftTaskOrder
}

const independentOrder = order('PO-ID-INDEPENDENT', 'PO-INDEPENDENT')
const sewIronOrder = order('PO-ID-SEW-IRON', 'PO-SEW-IRON')
const cutSewIronOrder = order('PO-ID-CUT-SEW-IRON', 'PO-CUT-SEW-IRON')
const heatOrder = order('PO-ID-HEAT', 'PO-HEAT')
const directOrder = order('PO-ID-DIRECT', 'PO-DIRECT')
const kolOrder = order('PO-ID-KOL', 'PO-KOL', { kol: true })

const woolStore = {
  workOrders: {
    'WOOL-WHOLE': {
      woolOrderId: 'WOOL-WHOLE', woolOrderNo: 'WMO-WHOLE', taskId: 'TASK-WOOL-WHOLE', taskNo: 'WO-WHOLE',
      productionOrderId: 'PO-ID-WOOL', productionOrderNo: 'PO-WOOL', styleNo: 'STYLE-WOOL', styleName: '整件毛织衫', styleImageUrl: '/cardigan-sample.jpg',
      factoryId: 'WOOL-FACTORY', factoryName: '毛织工厂', plannedCompletionAt: '2026-09-01', kind: 'WHOLE_GARMENT',
      outputPlanLines: [{ outputSkuCode: 'WOOL-SKU-M', outputObjectType: 'GARMENT', garmentSkuCode: 'WOOL-SKU-M', colorCode: 'BLACK', colorName: '黑色', sizeCode: 'M', plannedQty: 10, qtyUnit: '件', requiredYarnSkus: [], sourceTechPackVersionId: 'TP', sourceTechPackVersionCode: 'V1', sourceColorMappingIds: [], sourceBomItemIds: [] }],
      downstreamTarget: { receiverType: 'DOWNSTREAM_FACTORY', receiverId: 'POST', receiverName: '后道工厂' }, sourceTechPackVersionId: 'TP', sourceTechPackVersionCode: 'V1', createdAt: '2026-09-01', createdBy: '测试', updatedAt: '2026-09-01', updatedBy: '测试',
    },
    'WOOL-PANEL': {
      woolOrderId: 'WOOL-PANEL', woolOrderNo: 'WMO-PANEL', taskId: 'TASK-WOOL-PANEL', taskNo: 'WO-PANEL',
      productionOrderId: 'PO-ID-PANEL', productionOrderNo: 'PO-PANEL', styleNo: 'STYLE-PANEL', styleName: '毛织裁片', factoryId: 'WOOL-FACTORY', factoryName: '毛织工厂', plannedCompletionAt: '2026-09-01', kind: 'PART_PANEL',
      outputPlanLines: [{ outputSkuCode: 'PANEL-SKU', outputObjectType: 'WOOL_PANEL', garmentSkuCode: 'GARMENT-SKU', colorCode: 'BLACK', colorName: '黑色', sizeCode: 'M', plannedQty: 10, qtyUnit: '件', requiredYarnSkus: [], sourceTechPackVersionId: 'TP', sourceTechPackVersionCode: 'V1', sourceColorMappingIds: [], sourceBomItemIds: [] }],
      downstreamTarget: { receiverType: 'CUTTING_WAIT_HANDOVER_WAREHOUSE', receiverId: 'CUT', receiverName: '裁床待交出仓' }, sourceTechPackVersionId: 'TP', sourceTechPackVersionCode: 'V1', createdAt: '2026-09-01', createdBy: '测试', updatedAt: '2026-09-01', updatedBy: '测试',
    },
  },
  handovers: [
    { handoverId: 'HANDOVER-WHOLE', woolOrderId: 'WOOL-WHOLE', outputSkuCode: 'WOOL-SKU-M', handoverQty: 6, qtyUnit: '件', receiverType: 'DOWNSTREAM_FACTORY', receiverId: 'POST', receiverName: '后道工厂', handedOverAt: '2026-09-01', handedOverBy: '毛织主管', warehouseOutboundFlowId: 'FLOW-WHOLE', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
    { handoverId: 'HANDOVER-PANEL', woolOrderId: 'WOOL-PANEL', outputSkuCode: 'PANEL-SKU', handoverQty: 6, qtyUnit: '件', receiverType: 'CUTTING_WAIT_HANDOVER_WAREHOUSE', receiverId: 'CUT', receiverName: '裁床待交出仓', handedOverAt: '2026-09-01', handedOverBy: '毛织主管', warehouseOutboundFlowId: 'FLOW-PANEL', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
  ],
  qtyChangeLogs: [], yarnReceipts: [], yarnIssues: [], yarnReturns: [], processReports: [], warehouseFlows: [], completions: [], machines: [], machineAssociations: [], machineAssociationLogs: [], operationLogs: [],
} as unknown as WoolDomainStore

const facts: PostFinishingFormalReturnSourceFacts = {
  productionOrders: [independentOrder, sewIronOrder, cutSewIronOrder, heatOrder, directOrder, kolOrder],
  runtimeTasks: [
    runtimeTask({ id: 'TASK-INDEPENDENT', order: independentOrder, kind: 'SEW' }),
    runtimeTask({ id: 'TASK-SEW-IRON', order: sewIronOrder, kind: 'SEWING_IRON_PACK' }),
    runtimeTask({ id: 'TASK-CUT-SEW-IRON', order: cutSewIronOrder, kind: 'CUTTING_SEWING_IRON_PACK' }),
    runtimeTask({ id: 'TASK-UNASSIGNED', order: independentOrder, kind: 'SEW', assignmentStatus: 'UNASSIGNED' }),
    runtimeTask({ id: 'TASK-KOL', order: kolOrder, kind: 'SEW' }),
  ],
  woolStore,
  specialCraftTaskOrders: [
    specialTask({ id: 'TASK-HEAT', order: heatOrder, operationId: 'AUX-OP-HEAT-TRANSFER', returnedQty: 7 }),
    specialTask({ id: 'TASK-DIRECT', order: directOrder, operationId: 'AUX-OP-DIRECT-PRINT', returnedQty: 8 }),
    specialTask({ id: 'TASK-ZERO', order: heatOrder, operationId: 'AUX-OP-HEAT-TRANSFER', returnedQty: 0 }),
    specialTask({ id: 'TASK-PIECE', order: heatOrder, operationId: 'AUX-OP-HEAT-TRANSFER', returnedQty: 5, targetObject: '已裁部位' }),
    specialTask({ id: 'TASK-KOL-HEAT', order: kolOrder, operationId: 'AUX-OP-HEAT-TRANSFER', returnedQty: 5 }),
  ],
}

const adapted = buildFormalPostFinishingReturnSources(facts)
assert.deepEqual(new Set(adapted.map((source) => source.sourceKind)), new Set([
  'INDEPENDENT_SEWING',
  'SEWING_IRON_PACK',
  'CUTTING_SEWING_IRON_PACK',
  'WHOLE_GARMENT_WOOL',
  'GARMENT_HEAT_TRANSFER',
  'GARMENT_DIRECT_PRINT',
]), '正式来源适配必须覆盖三种任务分配范围、普通整件毛织、成衣烫画和成衣直喷')
assert(!adapted.some((source) => source.productionOrderNo === 'PO-KOL'), 'KOL 样衣和 KOL 小单不得进入普通后道来源')
assert(!adapted.some((source) => source.executionTaskId === 'TASK-UNASSIGNED'), '未形成有效分配的生产任务不得成为回货来源')
assert(!adapted.some((source) => source.executionTaskId === 'TASK-ZERO' || source.executionTaskId === 'TASK-PIECE'), '没有成衣交出数量或对象不是成衣的图案任务不得成为回货来源')
assert.equal(adapted.find((source) => source.sourceKind === 'WHOLE_GARMENT_WOOL')?.skus[0]?.plannedQty, 6, '整件毛织来源数量必须取实际交出，不得取生产计划')

resetPostFinishingFullFlow()
const liveSources = listPostFinishingReturnRegistrationSources()
assert.equal(liveSources.filter((source) => source.productionOrderNo.startsWith('PO-QC-202608-')).length, 15, '正式来源接入后仍必须保留 3×5×5 演示 seed')
const liveFormal = liveSources.find((source) => source.sourceKind === 'INDEPENDENT_SEWING' && source.executionTaskId)
assert(liveFormal, '当前正式有效车缝分配必须可以投影为回货来源')
const arbitraryScan = getPostFinishingReturnSourceScanValue(liveFormal.productionOrderNo, 12, liveFormal.executionTaskId)
const resolved = resolvePostFinishingReturnRegistrationSource(arbitraryScan)
assert.equal(resolved.returnIndex, 12, '正式来源码必须接受任意大于 0 的回货序号')
assert.equal(resolved.productionOrder.executionTaskId, liveFormal.executionTaskId, '多来源生产单必须按任务标识精确解析')
const registered = registerPostFinishingFactoryReturn({
  productionOrderNo: resolved.productionOrder.productionOrderNo,
  executionTaskId: resolved.productionOrder.executionTaskId,
  returnIndex: 12,
  triggerSource: '车缝正常交出',
  idempotencyKey: 'CHECK-FORMAL-SOURCE-PARTIAL-SKU',
  quantities: resolved.productionOrder.skus.map((sku, index) => ({ skuId: sku.skuId, registeredQty: index === 0 ? 1 : 0 })),
  deliveryPersonName: '正式来源送货人',
  deliveryPersonPhone: '081200000012',
  evidenceImageUrls: ['/shirt-sample.jpg'],
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier,
})
assert.equal(registered.lines.reduce((sum, line) => sum + line.registeredQty, 0), 1, '正式来源登记必须允许部分 SKU 为 0 且整批总量大于 0')
resetPostFinishingFullFlow()

console.log('post-finishing return source generalization passed: 正式来源、KOL 排除、任意回货序号、部分 SKU 为 0 和累计守恒均已覆盖')
