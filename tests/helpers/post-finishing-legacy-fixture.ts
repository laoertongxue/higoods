import * as flow from '../../src/data/fcs/post-finishing-full-flow.ts'
import { ensureQualityManagementRecords } from '../../src/data/fcs/quality-management-records.ts'

/**
 * Isolated historical input, not proof that an old factory/recheck action happened.
 * Current public commands establish the garment source, actual full QC and item
 * quantities. We then explicitly encode the old combined post/recheck schema;
 * no retired recheck command is executed or reintroduced.
 */
export async function createLegacyPostFinishingFixture(historyQty = 400, prefix = 'OLD-SOURCE') {
  await ensureQualityManagementRecords()
  flow.resetPostFinishingFullFlow()
  const source = flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
  const prior = source.skus[0].plannedQty, actor = flow.POST_FINISHING_ACCEPTANCE_ACTORS
  try {
    source.skus[0].plannedQty = 1000
    const delivery = flow.registerPostFinishingFactoryReturn({ productionOrderNo: source.productionOrderNo, executionTaskId: source.executionTaskId,
      returnIndex: 1, triggerSource: '车缝正常交出', idempotencyKey: prefix,
      quantities: source.skus.map((sku, index) => ({ skuId: sku.skuId, registeredQty: index ? 0 : 1000 })),
      deliveryPersonName: '明确历史输入夹具送货人', deliveryPersonPhone: '', evidenceImageUrls: [source.skus[0].imageUrl], actor: actor.factoryCourier })
    flow.confirmPostFinishingFactoryReturn({ deliveryId: delivery.deliveryId,
      firstCounts: delivery.lines.map(line => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })), actor: actor.returnConfirmer })
    const qc = flow.sendPostFinishingFactoryReturnToQc({ deliveryId: delivery.deliveryId, actor: actor.sender })
    flow.claimPostFinishingQcTask({ qcTaskNo: qc.qcTaskNo, actor: actor.qcA })
    flow.submitPostFinishingQcRound({ qcTaskId: qc.qcTaskId, actor: actor.qcA, operationId: `${prefix}:REAL-ROUND`,
      lines: qc.lines.map(line => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0, issues: [] })) })
    flow.attachPostFinishingQcSignedPaper({ qcTaskId: qc.qcTaskId, actor: actor.qcA,
      url: source.skus[0].imageUrl, name: '隔离夹具纸单素材；不代表现场双签' })
    const completed = flow.completePostFinishingQcTask({ qcTaskId: qc.qcTaskId, actor: actor.qcA, processItems: [...flow.POST_FINISHING_PROCESS_ITEMS] })
    const parent = flow.getPostFinishingFullFlowPostTask(completed.postTaskId!)!
    for (const processItem of flow.POST_FINISHING_PROCESS_ITEMS) flow.appendPostFinishingProcessCompletion({ postTaskId: parent.postTaskId, processItem,
      actor: actor.postOperator, responsible: actor.postOperator, quantities: [{ skuId: source.skus[0].skuId, quantity: historyQty }], operationId: `${prefix}:${processItem}` })
    const outbound = flow.submitPostFinishingForOutbound({ postTaskId: parent.postTaskId,
      quantities: [{ skuId: source.skus[0].skuId, quantity: historyQty }], actor: actor.postOperator, operationId: `${prefix}:DIRECT-OUTBOUND` })
    const recheck: flow.PostFinishingRecheckOrder = {
      recheckOrderId: `LEGACY-RC:${parent.postTaskId}`, recheckOrderNo: `${parent.postTaskNo}-FJ`,
      deliveryId: outbound.deliveryId, deliveryOrderNo: outbound.deliveryOrderNo, productionOrderNo: outbound.productionOrderNo,
      responsibility: structuredClone(outbound.responsibility), sourceType: outbound.sourceType, qcTaskId: outbound.qcTaskId, qcTaskNo: outbound.qcTaskNo,
      postTaskId: parent.postTaskId, postTaskNo: parent.postTaskNo, returnIndex: outbound.returnIndex,
      status: '待复检', createdAt: outbound.createdAt,
      lines: outbound.lines.map(line => ({ sku: structuredClone(line.sku), expectedQty: line.outboundQty, barcodeStatus: '待扫描', barcodeEvents: [] })),
    }
    const oldParent: any = { ...parent, executionModel: undefined, processItems: ['烫包'], status: '后道完成',
      recheckOrderId: recheck.recheckOrderId, recheckOrderNo: recheck.recheckOrderNo,
      results: parent.lines.map((line, index) => ({ ...line, processedQty: index ? 0 : historyQty,
        unprocessedQty: index ? 0 : 1000 - historyQty, unprocessedReason: index ? undefined : '明确旧合并表示：历史本次未处理' })) }
    const oldQc = flow.getPostFinishingFullFlowQcTask(qc.qcTaskId)!
    delete oldQc.inspection // This old-format input has no frozen standard or actual inspection-round history.
    const snapshot: any = { schemaVersion: 2, deliveries: [flow.getPostFinishingFactoryReturn(delivery.deliveryId)], qcTasks: [oldQc], postTasks: [oldParent],
      recheckOrders: [recheck], outboundOrders: [], warehouseReceipts: [], waitProcessWarehouseRecords: flow.listPostFinishingWaitProcessWarehouseRecords(),
      waitProcessWarehouseMovements: flow.listPostFinishingWaitProcessWarehouseMovements(), waitHandoverWarehouseRecords: [], waitHandoverWarehouseMovements: [],
      returnConfirmationVersions: flow.listPostFinishingReturnConfirmationVersions(), defects: [], materialTransferOrders: [], materialStocks: [] }
    return { snapshot, taskId: parent.postTaskId, parentId: parent.postTaskId, skuId: source.skus[0].skuId,
      recheckNo: recheck.recheckOrderNo, oldRecheckId: recheck.recheckOrderId, activeOutboundId: outbound.outboundOrderId }
  } finally { source.skus[0].plannedQty = prior }
}

/**
 * Preserve the old test's aggregate Q1000/H400/pending250 and 151 RC records,
 * but partition them into independent historical batches. A single parent's
 * common-success group must never be split merely to obtain partial progress.
 */
export function partitionLegacyPostFinishingMigrationFixture(fixture: Awaited<ReturnType<typeof createLegacyPostFinishingFixture>>) {
  const original = structuredClone(fixture.snapshot)
  const names = ['deliveries','qcTasks','postTasks','waitProcessWarehouseRecords','waitProcessWarehouseMovements','returnConfirmationVersions']
  const snapshot = { ...structuredClone(original), schemaVersion: 1 }
  for (const name of [...names,'recheckOrders']) snapshot[name] = []
  const idFields = new Set(['deliveryId','deliveryOrderNo','qcTaskId','qcTaskNo','postTaskId','postTaskNo','recheckOrderId','recheckOrderNo','warehouseRecordId','movementId','confirmationVersionId'])
  const qtyFields = new Set(['registeredQty','firstCountQty','confirmedQty','expectedQty','releasedQty','passedQty','quantity'])
  const sourceIds = new Set<string>()
  function collect(value: any) {
    if (Array.isArray(value)) value.forEach(collect)
    else if (value && typeof value === 'object') for (const [key,item] of Object.entries(value)) {
      if (idFields.has(key) && typeof item === 'string') sourceIds.add(item)
      else collect(item)
    }
  }
  collect(original)
  for (let group = 0; group < 16; group++) {
    const qty = group === 0 ? 850 : 10, historical = group === 0 ? 250 : 10
    const ids = new Map([...sourceIds].map(id => [id, group ? `${id}__HISTORY_GROUP_${group}` : id]))
    function transform(value: any, field = ''): any {
      if (typeof value === 'string') return field === 'idempotencyKey' ? `${value}:HISTORY-GROUP-${group}` : ids.get(value) || value
      if (typeof value === 'number') {
        if (field === 'returnIndex') return group + 1
        if (field === 'processedQty' && value > 0) return historical
        if (field === 'unprocessedQty' && value > 0) return qty - historical
        if (qtyFields.has(field) && value > 0) return qty
        return value
      }
      if (Array.isArray(value)) return value.map(item => transform(item))
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,transform(item,key)]))
      return value
    }
    for (const name of names) snapshot[name].push(...transform(original[name]))
    const template = transform(original.recheckOrders[0])
    const count = group === 0 ? 1 : 10
    for (let index = 0; index < count; index++) {
      const rc = structuredClone(template)
      rc.recheckOrderId = group === 0 ? template.recheckOrderId : `OLD-RC-MIGRATION-${(group-1)*10+index}`
      rc.recheckOrderNo = group === 0 ? template.recheckOrderNo : `OLD-RC-MIGRATION-${(group-1)*10+index}`
      rc.lines.forEach((line: any) => {line.expectedQty=line.expectedQty>0 ? group===0?100:1 : 0})
      snapshot.recheckOrders.push(rc)
      if (index===0) {
        snapshot.postTasks[group].recheckOrderId=rc.recheckOrderId
        snapshot.postTasks[group].recheckOrderNo=rc.recheckOrderNo
      }
    }
  }
  return { ...fixture, snapshot }
}
