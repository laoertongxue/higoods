import assert from 'node:assert/strict'

import {
  buildLaceProcessOrderTaskDocuments,
  buildProcessOrderTaskLinks,
  getProcessOrderTaskRelationView,
  resolveLaceFormalChainIdentity,
  type LaceFormalProductionRouteSnapshot,
  type ProcessOrderTaskDocumentRef,
} from '../src/data/fcs/process-order-task-links.ts'
import { listLaceProductionOrders, PLATFORM_ADMIN } from '../src/data/fcs/lace-factory-domain.ts'
import type { TechnicalProcessEntry } from '../src/data/pcs-technical-data-version-types.ts'

function entry(input: Pick<
  TechnicalProcessEntry,
  'id' | 'stageCode' | 'stageName' | 'processCode' | 'processName' | 'linkedBomItemIds' | 'consumedBomItemIds' | 'predecessorEntryIds'
>): TechnicalProcessEntry {
  return {
    entryType: 'PROCESS_BASELINE',
    assignmentGranularity: 'ORDER',
    defaultDocType: input.stageCode === 'PREP' ? 'PREPARATION_ORDER' : 'TASK',
    taskTypeMode: 'PROCESS',
    isSpecialCraft: false,
    ...input,
  }
}

const demoOrders = listLaceProductionOrders(PLATFORM_ADMIN)
assert(demoOrders.length > 0, '当前花边演示数据不能为空')
for (const order of demoOrders) {
  const view = getProcessOrderTaskRelationView(order.workOrderId)
  assert(view, `当前花边演示单 ${order.workOrderNo} 必须继续可读`)
  assert.equal(view.current.formalRouteLinkStatus, 'UNLINKED', `${order.workOrderNo} 没有匹配正式生产单时必须明确保持未关联`)
  assert.equal(view.current.productionOrderId, undefined, `${order.workOrderNo} 不得按款式或 SKU 猜测生产单`)
  assert.deepEqual(view.current.sourceEntryIds, [], `${order.workOrderNo} 不得猜测路线 occurrence`)
  assert.deepEqual(view.current.bomItemIds, [], `${order.workOrderNo} 不得猜测 BOM 分支`)
  assert(
    view.predecessors.some((document) => document.documentId === `LACE-PURCHASE:${order.purchaseOrderId}`),
    `${order.workOrderNo} 保持未关联时仍须保留现有采购需求来源`,
  )
}

const demo = demoOrders[0]
const productionOrderId = 'PO-LACE-FORMAL-001'
const productionOrderNo = 'PO-LACE-FORMAL-001'
const techPackVersionId = 'TPV-LACE-FORMAL-001'
const techPackVersionLabel = '正式版 V1'
const styleCode = 'STYLE-LACE-FORMAL-001'
const bomItemId = 'BOM-LACE-FORMAL-001'
const skuId = 'SKU-LACE-FORMAL-001'
const skuCode = 'LACE-FORMAL-001'
const dyeEntryId = 'ENTRY-LACE-DYE-001'
const laceEntryId = 'ENTRY-LACE-PROCESS-001'
const consumerEntryId = 'ENTRY-LACE-CONSUMER-001'
const routeEntries: TechnicalProcessEntry[] = [
  entry({
    id: dyeEntryId,
    stageCode: 'PREP',
    stageName: '准备阶段',
    processCode: 'DYE',
    processName: '染色',
    linkedBomItemIds: [bomItemId],
    consumedBomItemIds: [],
    predecessorEntryIds: [],
  }),
  entry({
    id: laceEntryId,
    stageCode: 'PROD',
    stageName: '生产阶段',
    processCode: 'LACE_PROCESSING',
    processName: '花边加工',
    linkedBomItemIds: [bomItemId],
    consumedBomItemIds: [],
    predecessorEntryIds: [dyeEntryId],
  }),
  entry({
    id: consumerEntryId,
    stageCode: 'PROD',
    stageName: '生产阶段',
    processCode: 'SEW',
    processName: '车缝',
    linkedBomItemIds: [],
    consumedBomItemIds: [bomItemId],
    predecessorEntryIds: [laceEntryId],
  }),
]
const formalSnapshot: LaceFormalProductionRouteSnapshot = {
  productionOrderId,
  productionOrderNo,
  styleCode,
  techPackVersionId,
  techPackVersionLabel,
  bomItems: [{
    id: bomItemId,
    type: '辅料',
    materialCode: skuCode,
    materialSkuId: skuId,
  }],
  processEntries: routeEntries,
}
const fixtureOrder = {
  ...demo,
  workOrderId: 'LWO-LACE-FORMAL-001',
  workOrderNo: 'HBSC-LACE-FORMAL-001',
  generationKey: `PURCHASE-LACE-FORMAL-001::${skuId}`,
  purchaseOrderId: 'PURCHASE-LACE-FORMAL-001',
  purchaseOrderNo: 'CG-LACE-FORMAL-001',
  skuId,
  skuCode,
  sourceLines: demo.sourceLines.map((line, index) => ({
    ...line,
    purchaseOrderLineId: `POL-LACE-FORMAL-${index + 1}`,
    styleId: styleCode,
    styleCode,
    styleName: '正式花边链测试款',
  })),
  processingOutput: {
    ...demo.processingOutput,
    skuId,
    skuCode,
  },
}

const identity = resolveLaceFormalChainIdentity(fixtureOrder, [formalSnapshot])
assert(identity, '完整正式生产单、技术包 BOM 和花边 occurrence 必须能建立花边链身份')
assert.deepEqual(identity, {
  productionOrderId,
  productionOrderNo,
  techPackVersionId,
  techPackVersionLabel,
  bomItemIds: [bomItemId],
  dyeProcessEntryIds: [dyeEntryId],
  laceProcessEntryIds: [laceEntryId],
  consumerProcessEntryIds: [consumerEntryId],
})

const laceDocuments = buildLaceProcessOrderTaskDocuments([fixtureOrder], [formalSnapshot])
const purchaseDocument = laceDocuments.find((document) => document.documentKind === 'SOURCE_DOCUMENT')
const laceDocument = laceDocuments.find((document) => document.documentId === fixtureOrder.workOrderId)
assert(purchaseDocument && laceDocument, '完整 fixture 必须生成采购需求和花边加工单关系文档')
for (const document of [purchaseDocument, laceDocument]) {
  assert.equal(document.productionOrderId, productionOrderId)
  assert.equal(document.techPackVersionId, techPackVersionId)
  assert.equal(document.techPackVersionLabel, techPackVersionLabel)
  assert.deepEqual(document.processEntryIds, [laceEntryId])
  assert.deepEqual(document.bomItemIds, [bomItemId])
  assert.equal(document.formalRouteLinkStatus, 'LINKED')
}
assert.deepEqual(laceDocument.sourceEntryIds, [laceEntryId])
assert.equal(purchaseDocument.documentId, `LACE-PURCHASE:${fixtureOrder.generationKey}`)

const dyeDocument: ProcessOrderTaskDocumentRef = {
  documentId: 'DYE-LACE-FORMAL-001',
  documentNo: 'RS-LACE-FORMAL-001',
  documentKind: 'PREPARATION_ORDER',
  documentTypeLabel: '染色加工单',
  productionOrderId,
  productionOrderNo,
  techPackVersionId,
  techPackVersionLabel,
  processCode: 'DYE',
  processName: '染色',
  sourceEntryIds: [dyeEntryId],
  processEntryIds: [dyeEntryId],
  bomItemIds: [bomItemId],
  formalRouteLinkStatus: 'LINKED',
  sourceLabel: `生产单 ${productionOrderNo}`,
  objectLabel: `${bomItemId} / 染色花边`,
  quantityLabel: '100 Yard',
}
const consumerDocument: ProcessOrderTaskDocumentRef = {
  documentId: 'TASK-LACE-CONSUMER-001',
  documentNo: 'RW-LACE-CONSUMER-001',
  documentKind: 'PRODUCTION_TASK',
  documentTypeLabel: '车缝任务',
  productionOrderId,
  productionOrderNo,
  techPackVersionId,
  techPackVersionLabel,
  processCode: 'SEW',
  processName: '车缝',
  sourceEntryIds: [consumerEntryId],
  processEntryIds: [consumerEntryId],
  bomItemIds: [bomItemId],
  formalRouteLinkStatus: 'LINKED',
  sourceLabel: `生产单 ${productionOrderNo}`,
  objectLabel: '成衣 / 花边使用方',
  quantityLabel: '100 件',
}
const links = buildProcessOrderTaskLinks(
  [...laceDocuments, dyeDocument, consumerDocument],
  new Map([[productionOrderId, routeEntries]]),
)
assert(
  links.some((link) => link.predecessorDocumentId === purchaseDocument.documentId && link.successorDocumentId === laceDocument.documentId),
  '采购需求必须显式连接花边加工单',
)
assert(
  links.some((link) => link.predecessorDocumentId === dyeDocument.documentId && link.successorDocumentId === laceDocument.documentId),
  '存在染色 occurrence 时必须按直接前置 occurrence 连接染色单与花边加工单',
)
assert(
  links.some((link) => link.predecessorDocumentId === laceDocument.documentId && link.successorDocumentId === consumerDocument.documentId),
  '花边加工单必须按 BOM 分支和直接前置 occurrence 连接下游使用方',
)

const withoutDyeSnapshot: LaceFormalProductionRouteSnapshot = {
  ...formalSnapshot,
  processEntries: routeEntries.filter((item) => item.id !== dyeEntryId).map((item) => (
    item.id === laceEntryId ? { ...item, predecessorEntryIds: [] } : item
  )),
}
assert.deepEqual(
  resolveLaceFormalChainIdentity(fixtureOrder, [withoutDyeSnapshot])?.dyeProcessEntryIds,
  [],
  '花边染色是可选 occurrence；没有染色时不得伪造染色任务项',
)
assert.equal(
  resolveLaceFormalChainIdentity(fixtureOrder, [formalSnapshot, { ...formalSnapshot, productionOrderId: 'PO-LACE-AMBIGUOUS-002' }]),
  undefined,
  '同款同 SKU 命中多张生产单时必须保持未关联，不得任选一张',
)
assert.equal(
  resolveLaceFormalChainIdentity(fixtureOrder, [{ ...formalSnapshot, processEntries: routeEntries.filter((item) => item.id !== laceEntryId) }]),
  undefined,
  '没有明确花边加工 occurrence 时必须保持未关联',
)

console.log(`PROD-027 花边正式加工链专项检查通过：完整 fixture ${links.length} 条关系；当前 ${demoOrders.length} 张演示花边单保持未关联。`)
