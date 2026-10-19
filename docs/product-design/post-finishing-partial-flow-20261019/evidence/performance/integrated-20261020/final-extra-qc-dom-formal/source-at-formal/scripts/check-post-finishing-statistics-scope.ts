import assert from 'node:assert/strict'
import * as flow from '../src/data/fcs/post-finishing-full-flow.ts'
import { getPostFinishingExecutionStatistics as statistics } from '../src/data/fcs/process-statistics-domain.ts'
import { getPostFinishingTaskByProductionOrder } from '../src/data/fcs/post-finishing-current-read-model.ts'
import { getPostFinishingAuthorizationDisplay, listPostFinishingAuthorizedPeople, POST_FINISHING_AUTHORIZATION_WINDOW_MS } from '../src/data/fcs/post-finishing-authorization.ts'

// Task-scoped Node contract. Public commands construct isolated memory facts;
// it neither opens a browser nor claims IndexedDB/physical factory acceptance.
const actors = flow.POST_FINISHING_ACCEPTANCE_ACTORS
const source = flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
const originalPlans = source.skus.map(sku => sku.plannedQty)
const now = Date.now() - 60 * 60 * 1000
const old = now - 10 * 24 * 60 * 60 * 1000
const authorizer = listPostFinishingAuthorizedPeople()[0]
let authSequence = 0
let returnIndex = 0
const skuQuantities = (values: number[]) => source.skus.map((sku, index) => ({ skuId: sku.skuId, quantity: values[index] || 0 }))
function authority(at: number) {
  const nowMs = at + ++authSequence * POST_FINISHING_AUTHORIZATION_WINDOW_MS
  return { nowMs, authorization: { scanValue: getPostFinishingAuthorizationDisplay(authorizer.authorizerId, nowMs).scanPayload, differenceReason: '统计契约实际差异', nowMs } }
}
function create(values: number[], at: number, direct = false) {
  const index = ++returnIndex
  const delivery = flow.registerPostFinishingFactoryReturn({ productionOrderNo: source.productionOrderNo,
    executionTaskId: source.executionTaskId, returnIndex: index, triggerSource: '车缝正常交出', idempotencyKey: 'STAT-SCOPE-' + index,
    quantities: skuQuantities(values).map(row => ({ skuId: row.skuId, registeredQty: row.quantity })),
    deliveryPersonName: '统计范围契约送货人', deliveryPersonPhone: '', evidenceImageUrls: [source.skus[0].imageUrl], actor: actors.factoryCourier, nowMs: at })
  flow.confirmPostFinishingFactoryReturn({ deliveryId: delivery.deliveryId, firstCounts: delivery.lines.map(line => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })), actor: actors.returnConfirmer, nowMs: at + 1000 })
  const qc = flow.sendPostFinishingFactoryReturnToQc({ deliveryId: delivery.deliveryId, actor: actors.sender, nowMs: at + 2000 })
  flow.claimPostFinishingQcTask({ qcTaskNo: qc.qcTaskNo, actor: actors.qcA, nowMs: at + 3000 })
  flow.completePostFinishingQcTask({ qcTaskId: qc.qcTaskId, actor: actors.qcA, processItems: direct ? [] : ['包装'],
    results: qc.lines.map(line => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 })), nowMs: at + 4000 })
  return { delivery, qc, task: flow.listPostFinishingFullFlowPostTasks().find(task => task.qcTaskId === qc.qcTaskId),
    outbound: flow.listPostFinishingFullFlowOutboundOrders().find(out => out.qcTaskId === qc.qcTaskId) }
}
function append(task: flow.PostFinishingPostTask, values: number[], key: string, at: number) {
  flow.appendPostFinishingProcessCompletion({ postTaskId: task.postTaskId, processItem: '包装', quantities: skuQuantities(values).filter(row => row.quantity),
    responsible: actors.postOperator, actor: actors.postOperator, operationId: key, nowMs: at })
}
function child(task: flow.PostFinishingPostTask, values: number[], key: string, at: number, actual = values) {
  const recheck = flow.submitPostFinishingForRecheck({ postTaskId: task.postTaskId, quantities: skuQuantities(values).filter(row => row.quantity), actor: actors.postOperator, operationId: key, nowMs: at })
  flow.claimPostFinishingRecheckOrder({ recheckOrderNo: recheck.recheckOrderNo, actor: actors.recheckerA, nowMs: at + 1000 })
  for (const line of recheck.lines) if (line.expectedQty) flow.scanPostFinishingRecheckSkuBarcode({ recheckOrderId: recheck.recheckOrderId, skuId: line.sku.skuId, scannedBarcode: line.sku.barcode, actor: actors.recheckerA, nowMs: at + 2000 })
  const gate = JSON.stringify(actual) !== JSON.stringify(values) ? authority(at + 3000) : { nowMs: at + 3000 }
  const result = flow.completePostFinishingRecheckOrderFullFlow({ recheckOrderId: recheck.recheckOrderId, actor: actors.recheckerA,
    results: recheck.lines.map(line => ({ skuId: line.sku.skuId, handoverQty: actual[source.skus.findIndex(sku => sku.skuId === line.sku.skuId)] || 0 })), ...gate })
  return flow.getPostFinishingFullFlowOutboundOrder(result.outboundOrderId!)!
}
function receive(outbound: flow.PostFinishingOutboundOrder, at: number, actual?: number[]) {
  const amounts = outbound.lines.map(line => actual ? actual[source.skus.findIndex(sku => sku.skuId === line.sku.skuId)] || 0 : line.outboundQty)
  const different = outbound.lines.some((line, index) => line.outboundQty !== amounts[index])
  const gate = different ? authority(at) : { nowMs: at }
  flow.receivePostFinishingOutboundOrder({ outboundOrderNo: outbound.outboundOrderNo, actor: actors.warehouseReceiver,
    receivedQuantities: outbound.lines.map((line, index) => ({ skuId: line.sku.skuId, receivedQty: amounts[index] })), ...gate })
}
function pick(value: ReturnType<typeof statistics>) {
  return Object.fromEntries(['workOrderCount', 'postOrderCount', 'receiveDoneGarmentQty', 'postDoneGarmentQty', 'waitPostGarmentQty',
    'waitRecheckGarmentQty', 'recheckConfirmedGarmentQty', 'handedOverGarmentQty', 'receivedGarmentQty', 'waitHandoverGarmentQty',
    'waitWritebackHandoverCount', 'writtenBackHandoverCount', 'waitHandoverTaskCount', 'handedOverTaskCount',
    'sewingFactoryPostDoneTaskCount', 'diffGarmentQty', 'differenceRecordCount', 'lessReceiveGarmentQty', 'moreReceiveGarmentQty'].map(key => [key, value[key as keyof typeof value]]))
}
try {
  flow.resetPostFinishingFullFlow()
  // Source plan adjustment is isolated test input, restored below. Every
  // return/QC/completion/recheck/outbound/receipt still uses its public command.
  source.skus.forEach(sku => { sku.plannedQty = Math.max(sku.plannedQty, 1000) })
  const a = create([100], old).task!
  append(a, [80], 'STAT-A-PACK', old + 5000)
  receive(child(a, [30], 'STAT-A-OLD', old + 6000), old + 10000)
  child(a, [20], 'STAT-A-TODAY', now)
  const b = create([60], now + 10000).task!
  append(b, [60], 'STAT-B-PACK', now + 15000)
  receive(child(b, [60], 'STAT-B-CHILD', now + 16000), now + 20000)
  const root = getPostFinishingTaskByProductionOrder(source.productionOrderNo)!
  const filterA = statistics({ workOrderId: a.postTaskId })
  assert.equal(filterA.workOrderCount, 1)
  assert.equal(filterA.postOrderCount, 1)
  assert.equal(filterA.receiveDoneGarmentQty, 100)
  assert.equal(filterA.qcPassGarmentQty, 100)
  assert.equal(filterA.postDoneGarmentQty, 80)
  assert.equal(filterA.waitPostGarmentQty, 20, '正常在制也保留Q-F，不只统计待后道状态')
  assert.equal(filterA.waitRecheckGarmentQty, 30)
  assert.equal(filterA.handedOverGarmentQty, 50)
  assert.equal(filterA.receivedGarmentQty, 30)
  assert.equal(filterA.waitHandoverGarmentQty, 20)
  assert.equal(filterA.handedOverTaskCount, 0)
  assert.equal(filterA.factoryRows[0].plannedQty, 100)
  assert.equal(filterA.factoryRows[0].doneQty, 80)
  assert.equal(filterA.factoryRows[0].handoverQty, 50)
  assert.deepEqual(pick(statistics({ workOrderId: a.postTaskNo })), pick(filterA), '实际加工单号与ID范围一致')
  assert.equal(statistics({ workOrderId: b.postTaskId }).handedOverTaskCount, 1, '所选完整兄弟链可闭环，不能混入另一链在制余量')
  const byRoot = statistics({ workOrderId: root.postTaskId })
  for (const workOrderId of [root.postTaskNo, source.productionOrderNo]) assert.deepEqual(pick(statistics({ workOrderId })), pick(byRoot))
  assert.equal(byRoot.workOrderCount, 1)
  assert.equal(byRoot.postOrderCount, 2)
  assert.equal(byRoot.receiveDoneGarmentQty, 160)
  assert.equal(byRoot.handedOverGarmentQty, 110)
  assert.equal(byRoot.receivedGarmentQty, 90)
  assert.equal(byRoot.waitHandoverTaskCount, 1, '一父任务的多子单按父任务去重')
  assert.equal(byRoot.handedOverTaskCount, 0, '一张已收不能让尚有加工余量的父任务提前闭环')
  const today = statistics({ workOrderId: a.postTaskId, timeRange: 'TODAY' })
  assert.equal(today.handedOverGarmentQty, 20)
  assert.equal(today.receivedGarmentQty, 0)
  assert.equal(today.waitHandoverGarmentQty, 20)
  assert.equal(today.waitHandoverTaskCount, 1)
  assert.equal(today.waitWritebackHandoverCount, 1)
  const c = create([10], old + 60000).task!
  append(c, [10], 'STAT-C-PACK', old + 65000)
  receive(child(c, [10], 'STAT-C-CHILD', old + 66000), old + 70000)
  const oldToday = statistics({ workOrderId: c.postTaskNo, timeRange: 'TODAY' })
  assert.equal(oldToday.handedOverGarmentQty, 0)
  assert.equal(oldToday.receivedGarmentQty, 0)
  assert.equal(oldToday.waitHandoverTaskCount, 0)
  assert.equal(oldToday.handedOverTaskCount, 0, 'cohort无单不得计全部出货已收任务')
  const direct = create([40], now + 30000, true)
  const directRoot = statistics({ workOrderId: root.postTaskId, timeRange: 'TODAY' })
  assert.equal(directRoot.sewingFactoryPostDoneTaskCount, 1)
  assert.equal(directRoot.postOrderCount, 3, 'QC直达不生成加工单')
  assert.equal(directRoot.handedOverGarmentQty, 120)
  assert.equal(directRoot.waitHandoverGarmentQty, 60)
  assert.equal(directRoot.diffGarmentQty, 0, '未接收的40件不能伪造为少收差异')
  receive(direct.outbound!, now + 40000)
  const recheckDiff = create([20], now + 50000).task!
  append(recheckDiff, [20], 'STAT-RDIFF-PACK', now + 55000)
  receive(child(recheckDiff, [20], 'STAT-RDIFF-CHILD', now + 56000, [19]), now + 180000)
  const recheckDifference = statistics({ workOrderId: recheckDiff.postTaskId })
  assert.equal(recheckDifference.handedOverTaskCount, 0, '授权少复核仍有差异，不能宣布全部链完整')
  assert.equal(recheckDifference.diffGarmentQty, 0, '复检差异不混为成衣仓差异')
  const warehouseDiff = create([10, 10], now + 240000).task!
  append(warehouseDiff, [10, 10], 'STAT-WDIFF-PACK', now + 245000)
  receive(child(warehouseDiff, [10, 10], 'STAT-WDIFF-CHILD', now + 246000), now + 300000, [9, 11])
  const warehouseDifference = statistics({ workOrderId: warehouseDiff.postTaskNo })
  assert.equal(warehouseDifference.receivedGarmentQty, 20)
  assert.equal(warehouseDifference.diffGarmentQty, 2, '逐SKU正负差异不能抵消')
  assert.equal(warehouseDifference.lessReceiveGarmentQty, 1)
  assert.equal(warehouseDifference.moreReceiveGarmentQty, 1)
  assert.equal(warehouseDifference.differenceRecordCount, 1, '多个差异SKU仍是一张出货差异单')
  assert.equal(warehouseDifference.handedOverTaskCount, 0)
  assert.equal(warehouseDifference.waitReviewCount, 0, '不制造独立仓收复核流程')
  for (const filter of [{ workOrderId: '不存在的任务' }, { factoryId: 'OTHER-FACTORY' }, { factoryId: 'OTHER-FACTORY', workOrderId: a.postTaskId }]) {
    const empty = statistics(filter)
    assert.equal(empty.workOrderCount, 0); assert.equal(empty.postOrderCount, 0)
    assert.equal(empty.receiveDoneGarmentQty, 0); assert.equal(empty.handedOverGarmentQty, 0)
    assert.equal(empty.receivedGarmentQty, 0); assert.equal(empty.diffGarmentQty, 0)
    assert.deepEqual(empty.factoryRows, [])
  }
  console.log(JSON.stringify({ passed: true, boundary: 'isolated Node memory / public commands only; no persistence or browser claim',
    scenarios: ['root ID/No/productionNo', 'actual post ID/No and sibling isolation', 'Q-F in-progress remainder', 'same outbound time cohort',
      'QC direct and pending not a shortage', 'recheck authorized short not closed', 'per-SKU warehouse +/- not cancelled', 'factory/unknown scope'],
    scopedA: pick(filterA), rootBeforeExtraScenarios: pick(byRoot), todayA: pick(today), warehouseDifference: pick(warehouseDifference) }, null, 2))
} finally {
  source.skus.forEach((sku, index) => { sku.plannedQty = originalPlans[index] })
  flow.resetPostFinishingFullFlow()
}
