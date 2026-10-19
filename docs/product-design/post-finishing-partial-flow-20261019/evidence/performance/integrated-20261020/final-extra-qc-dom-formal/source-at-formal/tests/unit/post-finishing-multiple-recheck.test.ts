import assert from 'node:assert/strict'
import test from 'node:test'
import * as flow from '../../src/data/fcs/post-finishing-full-flow.ts'
import { getPostFinishingAuthorizationDisplay } from '../../src/data/fcs/post-finishing-authorization.ts'

// PFN-005/006/028—046: public business commands only. The temporarily enlarged
// source plan is an isolated acceptance input, not an internal flow-state seed.
const actors = flow.POST_FINISHING_ACCEPTANCE_ACTORS
const chain = ['开扣眼', '装扣子', '熨烫', '包装'] as const
const now = Date.parse('2026-10-19T08:00:00+08:00')
const originalPlans = flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.map(source => source.skus.map(sku => sku.plannedQty))
test.afterEach(() => flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.forEach((source, sourceIndex) => source.skus.forEach((sku, skuIndex) => {
  sku.plannedQty = originalPlans[sourceIndex][skuIndex]
})))

function createQc(items: string[], quantities = [1000, 0, 0, 0, 0], allDefect = false) {
  flow.resetPostFinishingFullFlow()
  const source = flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
  source.skus.forEach((sku, index) => { sku.plannedQty = Math.max(originalPlans[0][index], quantities[index] ?? 0) })
  const delivery = flow.registerPostFinishingFactoryReturn({
    productionOrderNo: source.productionOrderNo,
    executionTaskId: source.executionTaskId,
    returnIndex: 1,
    triggerSource: '车缝正常交出',
    idempotencyKey: 'MULTIPLE-RECHECK-SOURCE',
    quantities: source.skus.map((sku, index) => ({ skuId: sku.skuId, registeredQty: quantities[index] ?? 0 })),
    deliveryPersonName: '多次复检验收送货人', deliveryPersonPhone: '', evidenceImageUrls: [source.skus[0].imageUrl],
    actor: actors.factoryCourier, nowMs: now,
  })
  flow.confirmPostFinishingFactoryReturn({
    deliveryId: delivery.deliveryId, actor: actors.returnConfirmer,
    firstCounts: delivery.lines.map(line => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })), nowMs: now + 1000,
  })
  const qc = flow.sendPostFinishingFactoryReturnToQc({ deliveryId: delivery.deliveryId, actor: actors.sender, nowMs: now + 2000 })
  flow.claimPostFinishingQcTask({ qcTaskNo: qc.qcTaskNo, actor: actors.qcA, nowMs: now + 3000 })
  const completed = flow.completePostFinishingQcTask({
    qcTaskId: qc.qcTaskId, processItems: items, actor: actors.qcA, nowMs: now + 4000,
    results: qc.lines.map(line => ({
      skuId: line.sku.skuId, passedQty: allDefect ? 0 : line.expectedQty,
      defectQty: allDefect ? line.expectedQty : 0, returnQty: 0,
      defectReasonQuantities: allDefect && line.expectedQty ? [{ reason: '破洞', quantity: line.expectedQty }] : [],
    })),
  })
  return { source, delivery, qc: completed, task: flow.listPostFinishingFullFlowPostTasks().find(row => row.qcTaskId === qc.qcTaskId) }
}

function createTask(items: string[] = [...chain], quantities = [1000, 0, 0, 0, 0]) {
  const fixture = createQc(items, quantities)
  assert.ok(fixture.task)
  return { ...fixture, task: fixture.task }
}

function progress(postTaskId: string) {
  assert.equal(typeof (flow as any).getPostFinishingProcessProgress, 'function')
  return (flow as any).getPostFinishingProcessProgress(postTaskId)
}

function append(postTaskId: string, processItem: string, skuId: string, quantity: number, operationId: string) {
  assert.equal(typeof (flow as any).appendPostFinishingProcessCompletion, 'function')
  return (flow as any).appendPostFinishingProcessCompletion({
    postTaskId, processItem, quantities: [{ skuId, quantity }], operationId,
    responsible: actors.postOperator, actor: actors.postOperator, nowMs: now + 10000,
  })
}

function submit(postTaskId: string, skuId: string, quantity: number, operationId: string, nowMs = now + 20000) {
  assert.equal(typeof (flow as any).submitPostFinishingForRecheck, 'function')
  return (flow as any).submitPostFinishingForRecheck({ postTaskId, quantities: [{ skuId, quantity }], operationId, actor: actors.postOperator, nowMs }) as flow.PostFinishingRecheckOrder
}

function scanAll(record: flow.PostFinishingRecheckOrder, actor: flow.PostFinishingActor = actors.recheckerA) {
  record.lines.filter(line => line.expectedQty > 0).forEach(line => flow.scanPostFinishingRecheckSkuBarcode({
    recheckOrderId: record.recheckOrderId, skuId: line.sku.skuId, scannedBarcode: line.sku.barcode, actor, nowMs: now + 30000,
  }))
}

function complete(record: flow.PostFinishingRecheckOrder, actor: flow.PostFinishingActor = actors.recheckerA) {
  return flow.completePostFinishingRecheckOrderFullFlow({
    recheckOrderId: record.recheckOrderId, actor, nowMs: now + 40000,
    results: record.lines.map(line => ({ skuId: line.sku.skuId, handoverQty: line.expectedQty })),
  })
}

function receive(outbound: flow.PostFinishingOutboundOrder) {
  return flow.receivePostFinishingOutboundOrder({
    outboundOrderNo: outbound.outboundOrderNo, actor: actors.warehouseReceiver, nowMs: now + 50000,
    receivedQuantities: outbound.lines.map(line => ({ skuId: line.sku.skuId, receivedQty: line.outboundQty })),
  })
}

test('PFN-005/006：QC无项目保留直达出货，合格0不产生空加工/复检/出货', () => {
  let fixture = createQc([], [100, 0, 0, 0, 0])
  assert.equal(fixture.task, undefined)
  assert.equal(flow.listPostFinishingFullFlowRecheckOrders().length, 0)
  let outbounds = flow.listPostFinishingFullFlowOutboundOrders()
  assert.equal(outbounds.length, 1)
  assert.equal(outbounds[0].sourceType, '质检直达')
  assert.equal(outbounds[0].lines.reduce((sum, line) => sum + line.outboundQty, 0), 100)
  fixture = createQc([...chain], [100, 0, 0, 0, 0], true)
  assert.equal(fixture.task, undefined)
  assert.equal(flow.listPostFinishingFullFlowRecheckOrders().length, 0)
  assert.equal(flow.listPostFinishingFullFlowOutboundOrders().length, 0)
})

test('PFN-028—035/039—046：D1按100/100/800三次复检出货，各张独立实收且父状态不提前', () => {
  const { source, delivery, task } = createTask()
  const skuId = source.skus[0].skuId
  ;[500, 300, 200, 100].forEach((quantity, index) => append(task.postTaskId, chain[index], skuId, quantity, `INITIAL-${index}`))
  const first = submit(task.postTaskId, skuId, 100, 'HANDOVER-1')
  assert.equal(first.status, '待复检')
  assert.equal(progress(task.postTaskId).availableForRecheckQty, 0, '待领取时已占用100')
  assert.throws(() => submit(task.postTaskId, skuId, 1, 'NO-SUPPLY'))
  assert.equal(submit(task.postTaskId, skuId, 100, 'HANDOVER-1').recheckOrderId, first.recheckOrderId)
  assert.throws(() => submit(task.postTaskId, skuId, 99, 'HANDOVER-1'), '同提交标识不能代表不同交复检数量')
  assert.equal(flow.listPostFinishingFullFlowRecheckOrders().length, 1)
  flow.claimPostFinishingRecheckOrder({ recheckOrderNo: first.recheckOrderNo, actor: actors.recheckerA })
  flow.releasePostFinishingRecheckOrder({ recheckOrderId: first.recheckOrderId, actor: actors.recheckerA, reason: '交接另一复检员' })
  assert.equal(progress(task.postTaskId).availableForRecheckQty, 0, '退领只释放人员，不释放数量')
  flow.claimPostFinishingRecheckOrder({ recheckOrderNo: first.recheckOrderNo, actor: actors.recheckerA })
  scanAll(first)
  complete(first)
  complete(first)
  const firstOutbound = flow.listPostFinishingFullFlowOutboundOrders()[0]
  receive(firstOutbound)
  const again = receive(firstOutbound)
  assert.equal(again.alreadyReceived, true)
  assert.equal(flow.listPostFinishingWarehouseReceipts().length, 1)
  assert.notEqual(flow.getPostFinishingFactoryReturn(delivery.deliveryId)?.status, '已完成', '仅100已收不能完成1000')
  assert.equal(flow.getPostFinishingFullFlowPostTask(task.postTaskId)?.status, '后道中')

  append(task.postTaskId, '包装', skuId, 100, 'PACK-SECOND')
  const second = submit(task.postTaskId, skuId, 100, 'HANDOVER-2', now + 60000)
  flow.claimPostFinishingRecheckOrder({ recheckOrderNo: second.recheckOrderNo, actor: actors.recheckerB })
  scanAll(second, actors.recheckerB)
  complete(second, actors.recheckerB)
  assert.equal(flow.listPostFinishingFullFlowOutboundOrders().filter(row => row.status === '待仓库接收').length, 1)

  ;[500, 700, 800, 800].forEach((quantity, index) => append(task.postTaskId, chain[index], skuId, quantity, `FINISH-${index}`))
  assert.equal(flow.getPostFinishingFullFlowPostTask(task.postTaskId)?.status, '后道完成')
  assert.equal(progress(task.postTaskId).availableForRecheckQty, 800)
  assert.notEqual(flow.getPostFinishingFactoryReturn(delivery.deliveryId)?.status, '已完成', '全部加工完成但800未交复检仍未闭环')
  const third = submit(task.postTaskId, skuId, 800, 'HANDOVER-3', now + 120000)
  flow.claimPostFinishingRecheckOrder({ recheckOrderNo: third.recheckOrderNo, actor: actors.recheckerA })
  scanAll(third)
  complete(third)
  const rechecks = flow.listPostFinishingFullFlowRecheckOrders()
  const outbounds = flow.listPostFinishingFullFlowOutboundOrders()
  assert.deepEqual(rechecks.map(row => row.lines.reduce((sum, line) => sum + line.expectedQty, 0)), [100, 100, 800])
  assert.equal(new Set(rechecks.map(row => row.recheckOrderId)).size, 3)
  assert.equal(new Set(rechecks.map(row => row.recheckOrderNo)).size, 3)
  assert.equal(new Set(outbounds.map(row => row.outboundOrderId)).size, 3)
  assert.equal(new Set(outbounds.map(row => row.outboundOrderNo)).size, 3)
  assert.equal(new Set(rechecks.map(row => (row as any).createdAt)).size, 3)
  assert.ok(rechecks.every(row => row.postTaskId === task.postTaskId && row.deliveryId === delivery.deliveryId && (row as any).createdBy.actorId === actors.postOperator.actorId))
  assert.ok(outbounds.every(row => row.postTaskId === task.postTaskId && row.lines.every(line => line.outboundQty > 0)))
  const secondOutbound = outbounds.find(row => row.recheckOrderId === second.recheckOrderId)!
  const thirdOutbound = outbounds.find(row => row.recheckOrderId === third.recheckOrderId)!
  assert.equal(flow.tracePostFinishingFullFlow(second.recheckOrderNo).recheckOrder?.recheckOrderId, second.recheckOrderId)
  assert.equal(flow.tracePostFinishingFullFlow(thirdOutbound.outboundOrderNo).outboundOrder?.outboundOrderId, thirdOutbound.outboundOrderId)
  assert.equal(flow.getPostFinishingWaitHandoverWarehouseRecord(thirdOutbound.outboundOrderId)?.recheckOrderId, third.recheckOrderId)
  receive(thirdOutbound)
  assert.notEqual(flow.getPostFinishingFactoryReturn(delivery.deliveryId)?.status, '已完成', '第2张未收不能被第3张代收')
  assert.equal(flow.getPostFinishingFullFlowOutboundOrder(secondOutbound.outboundOrderId)?.status, '待仓库接收')
  assert.throws(() => flow.receivePostFinishingOutboundOrder({ outboundOrderNo: secondOutbound.outboundOrderNo, actor: actors.postOperator, receivedQuantities: secondOutbound.lines.map(line => ({ skuId: line.sku.skuId, receivedQty: line.outboundQty })) }))
  receive(secondOutbound)
  assert.equal(flow.getPostFinishingFactoryReturn(delivery.deliveryId)?.status, '已完成')
  assert.equal(flow.listPostFinishingWarehouseReceipts().length, 3)
  assert.equal(progress(task.postTaskId).totalCompletedQty, 1000)
  assert.equal(progress(task.postTaskId).totalReservedQty, 1000)
  assert.equal(progress(task.postTaskId).availableForRecheckQty, 0)
  assert.equal(flow.listPostFinishingWaitHandoverWarehouseRecords().length, 3)
  assert.ok(flow.listPostFinishingWaitHandoverWarehouseRecords().every(row => row.status === '已交出' && row.lines.every(line => line.availableQty === 0)))
})

test('PFN-022/043/A29：加工1000但仅交复检并仓收100时，父单未闭环且剩900仍可继续交复检', () => {
  const { source, delivery, task } = createTask()
  const skuId = source.skus[0].skuId
  chain.forEach((item, index) => append(task.postTaskId, item, skuId, 1000, `A29-FULL-${index}`))
  const first = submit(task.postTaskId, skuId, 100, 'A29-FIRST-100')
  flow.claimPostFinishingRecheckOrder({ recheckOrderNo: first.recheckOrderNo, actor: actors.recheckerA })
  scanAll(first)
  complete(first)
  const outbound = flow.listPostFinishingFullFlowOutboundOrders()[0]
  receive(outbound)
  const view = progress(task.postTaskId)
  assert.equal(flow.getPostFinishingFullFlowPostTask(task.postTaskId)?.status, '后道完成')
  assert.deepEqual(view.processes.map((row: any) => row.completedQty), [1000, 1000, 1000, 1000])
  assert.equal(view.totalCompletedQty, 1000)
  assert.equal(view.totalReservedQty, 100)
  assert.equal(view.availableForRecheckQty, 900)
  assert.equal(flow.listPostFinishingWarehouseReceipts().reduce((sum, row) => sum + row.lines.reduce((qty, line) => qty + line.receivedQty, 0), 0), 100)
  assert.notEqual(flow.getPostFinishingFactoryReturn(delivery.deliveryId)?.status, '已完成')
  const remaining = submit(task.postTaskId, skuId, 900, 'A29-CONTINUE-900')
  assert.equal(remaining.lines.reduce((sum, line) => sum + line.expectedQty, 0), 900)
  assert.equal(progress(task.postTaskId).availableForRecheckQty, 0)
  assert.notEqual(flow.getPostFinishingFactoryReturn(delivery.deliveryId)?.status, '已完成', '新交900仍待复检与实收，父单不能提前结束')
})

test('PFN-030/031/036：待领取、复检中、条码异常及完成全部占用，错码仅阻断本张且重贴后必须复扫', () => {
  const { source, task } = createTask(['熨烫'], [100, 0, 0, 0, 0])
  const sku = source.skus[0]
  append(task.postTaskId, '熨烫', sku.skuId, 100, 'ALL-IRON')
  const records = Array.from({ length: 4 }, (_, index) => submit(task.postTaskId, sku.skuId, 20, `STATE-${index}`))
  flow.claimPostFinishingRecheckOrder({ recheckOrderNo: records[1].recheckOrderNo, actor: actors.recheckerA })
  flow.claimPostFinishingRecheckOrder({ recheckOrderNo: records[2].recheckOrderNo, actor: actors.recheckerB })
  flow.scanPostFinishingRecheckSkuBarcode({ recheckOrderId: records[2].recheckOrderId, skuId: sku.skuId, scannedBarcode: 'WRONG', actor: actors.recheckerB })
  assert.throws(() => complete(records[2], actors.recheckerB), (error: any) => error.code === 'BARCODE_BLOCKED')
  flow.markPostFinishingRecheckSkuRelabeled({ recheckOrderId: records[2].recheckOrderId, skuId: sku.skuId, actor: actors.recheckerB })
  assert.throws(() => complete(records[2], actors.recheckerB), (error: any) => error.code === 'BARCODE_BLOCKED')
  flow.claimPostFinishingRecheckOrder({ recheckOrderNo: records[3].recheckOrderNo, actor: actors.recheckerA })
  scanAll(records[3])
  complete(records[3])
  assert.equal(progress(task.postTaskId).totalReservedQty, 80)
  assert.equal(progress(task.postTaskId).availableForRecheckQty, 20)
  flow.releasePostFinishingRecheckOrder({ recheckOrderId: records[1].recheckOrderId, actor: actors.recheckerA, reason: '退领' })
  assert.equal(progress(task.postTaskId).totalReservedQty, 80)
  scanAll(records[2], actors.recheckerB)
  complete(records[2], actors.recheckerB)
  assert.equal(flow.getPostFinishingFullFlowRecheckOrder(records[0].recheckOrderId)?.status, '待复检')
  assert.equal(flow.listPostFinishingFullFlowOutboundOrders().length, 2)
  assert.equal(progress(task.postTaskId).availableForRecheckQty, 20)
})

test('PFN-037/038/040：复检总量0即使有授权也拒绝；无效授权不改实数；少交不重复释放占用', () => {
  const { source, task } = createTask(['包装'], [200, 0, 0, 0, 0])
  const skuId = source.skus[0].skuId
  append(task.postTaskId, '包装', skuId, 200, 'PACK-200')
  const record = submit(task.postTaskId, skuId, 100, 'RESERVE-100')
  flow.claimPostFinishingRecheckOrder({ recheckOrderNo: record.recheckOrderNo, actor: actors.recheckerA })
  scanAll(record)
  const authorizationTime = now + 180000
  const authorization = { scanValue: getPostFinishingAuthorizationDisplay('AUTH-POST-001', authorizationTime).scanPayload, differenceReason: '实物复点差异', nowMs: authorizationTime }
  const before = flow.getPostFinishingFullFlowRecheckOrder(record.recheckOrderId)
  assert.throws(() => flow.completePostFinishingRecheckOrderFullFlow({ recheckOrderId: record.recheckOrderId, actor: actors.recheckerA, results: record.lines.map(line => ({ skuId: line.sku.skuId, handoverQty: 0 })), authorization, nowMs: authorizationTime }))
  assert.deepEqual(flow.getPostFinishingFullFlowRecheckOrder(record.recheckOrderId), before)
  assert.equal(flow.listPostFinishingFullFlowOutboundOrders().length, 0)
  assert.throws(() => flow.completePostFinishingRecheckOrderFullFlow({ recheckOrderId: record.recheckOrderId, actor: actors.recheckerA, results: record.lines.map(line => ({ skuId: line.sku.skuId, handoverQty: line.expectedQty ? 99 : 0 })), authorization: { scanValue: 'INVALID', differenceReason: '点数差异' }, nowMs: authorizationTime }))
  assert.deepEqual(flow.getPostFinishingFullFlowRecheckOrder(record.recheckOrderId), before)
  const expiredTime = authorizationTime + 60000
  assert.throws(() => flow.completePostFinishingRecheckOrderFullFlow({ recheckOrderId: record.recheckOrderId, actor: actors.recheckerA,
    results: record.lines.map(line => ({ skuId: line.sku.skuId, handoverQty: line.expectedQty ? 99 : 0 })),
    authorization: { ...authorization, nowMs: expiredTime }, nowMs: expiredTime }))
  assert.deepEqual(flow.getPostFinishingFullFlowRecheckOrder(record.recheckOrderId), before)
  flow.completePostFinishingRecheckOrderFullFlow({ recheckOrderId: record.recheckOrderId, actor: actors.recheckerA, results: record.lines.map(line => ({ skuId: line.sku.skuId, handoverQty: line.expectedQty ? 99 : 0 })), authorization, nowMs: authorizationTime })
  assert.equal(flow.listPostFinishingFullFlowOutboundOrders()[0].lines.reduce((sum, line) => sum + line.outboundQty, 0), 99)
  assert.equal(progress(task.postTaskId).totalReservedQty, 100)
  assert.equal(progress(task.postTaskId).availableForRecheckQty, 100)
})

test('PFN-029/038：授权多交只能补占同SKU尚未占用完成量，不能凭授权超实物供给', () => {
  const { source, task } = createTask(['包装'], [200, 0, 0, 0, 0])
  const skuId = source.skus[0].skuId
  append(task.postTaskId, '包装', skuId, 200, 'PACK-200')
  const record = submit(task.postTaskId, skuId, 100, 'RESERVE-100')
  flow.claimPostFinishingRecheckOrder({ recheckOrderNo: record.recheckOrderNo, actor: actors.recheckerA })
  scanAll(record)
  const authorizationTime = now + 240000
  const authorization = { scanValue: getPostFinishingAuthorizationDisplay('AUTH-POST-001', authorizationTime).scanPayload, differenceReason: '复点多一件', nowMs: authorizationTime }
  const before = flow.getPostFinishingFullFlowRecheckOrder(record.recheckOrderId)
  assert.throws(() => flow.completePostFinishingRecheckOrderFullFlow({ recheckOrderId: record.recheckOrderId, actor: actors.recheckerA, results: record.lines.map(line => ({ skuId: line.sku.skuId, handoverQty: line.expectedQty ? 201 : 0 })), authorization, nowMs: authorizationTime }))
  assert.deepEqual(flow.getPostFinishingFullFlowRecheckOrder(record.recheckOrderId), before)
  flow.completePostFinishingRecheckOrderFullFlow({ recheckOrderId: record.recheckOrderId, actor: actors.recheckerA, results: record.lines.map(line => ({ skuId: line.sku.skuId, handoverQty: line.expectedQty ? 101 : 0 })), authorization, nowMs: authorizationTime })
  assert.equal(progress(task.postTaskId).totalReservedQty, 101)
  assert.equal(progress(task.postTaskId).availableForRecheckQty, 99)
  assert.equal(flow.listPostFinishingFullFlowOutboundOrders()[0].lines.reduce((sum, line) => sum + line.outboundQty, 0), 101)
  const noSpare = createTask(['包装'], [100, 0, 0, 0, 0])
  const noSpareSku = noSpare.source.skus[0].skuId
  append(noSpare.task.postTaskId, '包装', noSpareSku, 100, 'NO-SPARE-PACK')
  const noSpareRecheck = submit(noSpare.task.postTaskId, noSpareSku, 100, 'NO-SPARE-RESERVE')
  flow.claimPostFinishingRecheckOrder({ recheckOrderNo: noSpareRecheck.recheckOrderNo, actor: actors.recheckerA })
  scanAll(noSpareRecheck)
  const beforeNoSpare = progress(noSpare.task.postTaskId)
  const noSpareTime = authorizationTime + 60000
  assert.throws(() => flow.completePostFinishingRecheckOrderFullFlow({ recheckOrderId: noSpareRecheck.recheckOrderId, actor: actors.recheckerA,
    results: noSpareRecheck.lines.map(line => ({ skuId: line.sku.skuId, handoverQty: 101 })), nowMs: noSpareTime,
    authorization: { scanValue: getPostFinishingAuthorizationDisplay('AUTH-POST-001', noSpareTime).scanPayload, differenceReason: '实物多1但无未占用供给', nowMs: noSpareTime } }))
  assert.deepEqual(progress(noSpare.task.postTaskId), beforeNoSpare)
  assert.equal(flow.listPostFinishingFullFlowOutboundOrders().length, 0)
})

test('PFN-038/040/050：多SKU部分实际为0需授权，出货及待交出库存仅包含正数量行', () => {
  const { source, task } = createTask(['装扣子'], [10, 10, 0, 0, 0])
  for (const sku of source.skus.slice(0, 2)) append(task.postTaskId, '装扣子', sku.skuId, 10, `BUTTON-${sku.skuId}`)
  const record = (flow as any).submitPostFinishingForRecheck({
    postTaskId: task.postTaskId,
    quantities: source.skus.slice(0, 2).map(sku => ({ skuId: sku.skuId, quantity: 10 })),
    actor: actors.postOperator, operationId: 'PARTIAL-ZERO', nowMs: now + 20000,
  }) as flow.PostFinishingRecheckOrder
  flow.claimPostFinishingRecheckOrder({ recheckOrderNo: record.recheckOrderNo, actor: actors.recheckerA })
  scanAll(record)
  const results = record.lines.map(line => ({ skuId: line.sku.skuId, handoverQty: line.sku.skuId === source.skus[0].skuId ? 0 : line.expectedQty }))
  const before = flow.getPostFinishingFullFlowRecheckOrder(record.recheckOrderId)
  assert.throws(() => flow.completePostFinishingRecheckOrderFullFlow({ recheckOrderId: record.recheckOrderId, actor: actors.recheckerA, results }))
  assert.deepEqual(flow.getPostFinishingFullFlowRecheckOrder(record.recheckOrderId), before)
  const authorizationTime = now + 300000
  flow.completePostFinishingRecheckOrderFullFlow({
    recheckOrderId: record.recheckOrderId, actor: actors.recheckerA, results, nowMs: authorizationTime,
    authorization: { scanValue: getPostFinishingAuthorizationDisplay('AUTH-POST-001', authorizationTime).scanPayload, differenceReason: '第一SKU本次实物未交出', nowMs: authorizationTime },
  })
  const outbound = flow.listPostFinishingFullFlowOutboundOrders()[0]
  assert.deepEqual(outbound.lines.map(line => ({ skuId: line.sku.skuId, quantity: line.outboundQty })), [{ skuId: source.skus[1].skuId, quantity: 10 }])
  assert.ok(flow.listPostFinishingWaitHandoverWarehouseRecords()[0].lines.every(line => line.inboundQty > 0))
  assert.equal(progress(task.postTaskId).totalReservedQty, 20)
  assert.equal(progress(task.postTaskId).availableForRecheckQty, 0)
})
