import assert from 'node:assert/strict'
import test from 'node:test'
import { writeFileSync } from 'node:fs'
import * as flow from '../../src/data/fcs/post-finishing-full-flow.ts'
import { mapPostFinishingRepositoryValues } from '../../src/data/fcs/post-finishing-records.ts'
import { ensureQualityManagementRecords } from '../../src/data/fcs/quality-management-records.ts'

const actors = flow.POST_FINISHING_ACCEPTANCE_ACTORS
const items = ['开扣眼', '装扣子', '熨烫', '包装'] as const
const now = Date.parse('2026-10-20T08:00:00+08:00')
const sourcePlans = flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.map(source => source.skus.map(sku => sku.plannedQty))
const observations: Array<Record<string, unknown>> = []
test.before(async()=>{await ensureQualityManagementRecords()})
test.beforeEach(() => flow.resetPostFinishingFullFlow())
test.afterEach(() => flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.forEach((source, i) => source.skus.forEach((sku, j) => { sku.plannedQty = sourcePlans[i][j] })))
test.after(() => {
  const output = process.env.POST_FINISHING_TASK_SUMMARY_EVIDENCE_OUT
  if (output) writeFileSync(output, JSON.stringify({ boundary: 'Isolated Node public-command contracts, not browser persistence, UI or performance acceptance.', observations }, null, 2))
})

function createQc(processItems: flow.PostFinishingProcessItem[], quantities = [1000, 0, 0, 0, 0], sourceIndex = 0, returnIndex = 1) {
  const source = flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[sourceIndex]
  source.skus.forEach((sku, index) => { sku.plannedQty = Math.max(sku.plannedQty, (quantities[index] || 0) * returnIndex) })
  const delivery = flow.registerPostFinishingFactoryReturn({
    productionOrderNo: source.productionOrderNo, executionTaskId: source.executionTaskId, returnIndex,
    triggerSource: '车缝正常交出', idempotencyKey: `SUMMARY-SOURCE-${sourceIndex}-${returnIndex}`,
    quantities: source.skus.map((sku, index) => ({ skuId: sku.skuId, registeredQty: quantities[index] || 0 })),
    deliveryPersonName: '摘要契约隔离送货来源', deliveryPersonPhone: '', evidenceImageUrls: [source.skus[0].imageUrl], actor: actors.factoryCourier, nowMs: now,
  })
  flow.confirmPostFinishingFactoryReturn({ deliveryId: delivery.deliveryId, firstCounts: delivery.lines.map(line => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })), actor: actors.returnConfirmer, nowMs: now + 1000 })
  const qc = flow.sendPostFinishingFactoryReturnToQc({ deliveryId: delivery.deliveryId, actor: actors.sender, nowMs: now + 2000 })
  const claimed=flow.claimPostFinishingQcTask({ qcTaskNo: qc.qcTaskNo, actor: actors.qcA, nowMs: now + 3000 })
  assert.ok(claimed.inspection?.snapshot.items.length)
  flow.submitPostFinishingQcRound({qcTaskId:qc.qcTaskId,actor:actors.qcA,operationId:`SUMMARY-QC-${sourceIndex}-${returnIndex}`,lines:qc.lines.map(line=>({skuId:line.sku.skuId,passedQty:line.expectedQty,defectQty:0,returnQty:0,issues:[]})),nowMs:now+3500})
  flow.attachPostFinishingQcSignedPaper({qcTaskId:qc.qcTaskId,actor:actors.qcA,name:'隔离双签测试文件.png',url:'/test-only-signed-paper.png',nowMs:now+3600})
  flow.completePostFinishingQcTask({ qcTaskId: qc.qcTaskId, processItems, results: qc.lines.map(line => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 })), actor: actors.qcA, nowMs: now + 4000 })
  return { source, delivery, task: flow.listPostFinishingFullFlowPostTasks().find(row => row.qcTaskId === qc.qcTaskId) }
}

function createTask(processItems: flow.PostFinishingProcessItem[], quantities = [1000, 0, 0, 0, 0], sourceIndex = 0, returnIndex = 1) {
  const fixture = createQc(processItems, quantities, sourceIndex, returnIndex)
  assert.ok(fixture.task)
  return { ...fixture, task: fixture.task }
}

function append(task: flow.PostFinishingPostTask, processItem: flow.PostFinishingProcessItem, quantities: Array<{ skuId: string; quantity: number }>, operationId: string) {
  return flow.appendPostFinishingProcessCompletion({ postTaskId: task.postTaskId, processItem, quantities, responsible: actors.postOperator, actor: actors.postOperator, operationId, nowMs: now + 10000 })
}

function submit(task: flow.PostFinishingPostTask, quantities: Array<{ skuId: string; quantity: number }>, operationId: string) {
  return flow.submitPostFinishingForOutbound({ postTaskId: task.postTaskId, quantities, actor: actors.postOperator, operationId, nowMs: now + 20000 })
}

function dispatchOutbound(record: flow.PostFinishingOutboundOrder) { return flow.dispatchPostFinishingOutboundOrder({outboundOrderId:record.outboundOrderId,actor:actors.postOperator,nowMs:now+40000}) }

function receive(outbound: flow.PostFinishingOutboundOrder) {
  flow.receivePostFinishingOutboundOrder({ outboundOrderNo: outbound.outboundOrderNo, actor: actors.warehouseReceiver, receivedQuantities: outbound.lines.map(line => ({ skuId: line.sku.skuId, receivedQty: line.outboundQty })), nowMs: now + 50000 })
}

function compareSummaries(stage: string) {
  const expected = flow.listPostFinishingFullFlowPostTasks().map(task => {
    const full = flow.getPostFinishingProcessProgress(task)
    return { postTaskId: task.postTaskId, productionOrderNo: task.productionOrderNo, qcTaskId: task.qcTaskId,
      status: task.status, completedAt: task.completedAt, totalExpectedQty: full.totalExpectedQty,
      totalCompletedQty: full.totalCompletedQty, availableForOutboundQty: full.availableForOutboundQty }
  })
  const actual = flow.listPostFinishingTaskQuantitySummaries()
  assert.deepEqual(actual, expected, `${stage}：摘要必须与完整公开getter逐字段相同`)
  assert.ok(actual.every(row => Object.values(row).every(value => value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value))), '摘要不返回SKU、records或其他可变树')
  observations.push({ stage, summaries: actual, fullProgress: flow.listPostFinishingFullFlowPostTasks().map(task => {
    const full = flow.getPostFinishingProcessProgress(task)
    return { postTaskId: task.postTaskId, legacyPending: full.legacyPending, totalReservedQty: full.totalReservedQty, recordCount: full.records.length }
  }) })
  compareChildSummaries(stage)
  return actual
}

function compareChildSummaries(stage: string) {
  const complete = {
    rechecks: flow.listPostFinishingFullFlowRecheckOrders(),
    outbounds: flow.listPostFinishingFullFlowOutboundOrders(),
    waitHandovers: flow.listPostFinishingWaitHandoverWarehouseRecords(),
  }
  const productionNos = [...new Set([...complete.rechecks, ...complete.outbounds, ...complete.waitHandovers].map(row => row.productionOrderNo))]
  const filters = [undefined, new Set<string>(), new Set(['UNKNOWN-CHILD-SUMMARY-PRODUCTION']), ...productionNos.map(no => new Set([no])), new Set(productionNos)]
  const oracle = (nos?: ReadonlySet<string>) => ({
    rechecks: complete.rechecks.filter(row => !nos || nos.has(row.productionOrderNo)).map(row => ({
      recheckOrderId: row.recheckOrderId, productionOrderNo: row.productionOrderNo,
      qcTaskId: row.qcTaskId, status: row.status, completedAt: row.completedAt,
      totalExpectedQty: row.lines.reduce((sum, line) => sum + line.expectedQty, 0),
      totalHandoverQty: row.lines.reduce((sum, line) => sum + (line.handoverQty || 0), 0),
    })),
    outbounds: complete.outbounds.filter(row => !nos || nos.has(row.productionOrderNo)).map(row => ({
      outboundOrderId: row.outboundOrderId, productionOrderNo: row.productionOrderNo,
      deliveryId: row.deliveryId, status: row.status,
    })),
    waitHandovers: complete.waitHandovers.filter(row => !nos || nos.has(row.productionOrderNo)).map(row => ({
      warehouseRecordId: row.warehouseRecordId, productionOrderNo: row.productionOrderNo,
      totalAvailableQty: row.lines.reduce((sum, line) => sum + line.availableQty, 0),
    })),
  })
  for (const filter of filters) {
    const actual = flow.listPostFinishingTaskChildQuantitySummaries(filter)
    assert.deepEqual(actual, oracle(filter), `${stage}：子单摘要必须等于原完整getter过滤后相同字段、顺序和求和`)
    for (const rows of Object.values(actual)) for (const row of rows) {
      assert.ok(Object.values(row).every(value => value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value)), '子单摘要的每个字段都必须是primitive')
    }
  }
  const detached = flow.listPostFinishingTaskChildQuantitySummaries()
  for (const rows of Object.values(detached)) {
    for (const row of rows) for (const key of Object.keys(row)) Reflect.set(row, key, 'UNSAVED-CHILD-SUMMARY-MUTATION')
    rows.splice(0)
  }
  assert.deepEqual(flow.listPostFinishingTaskChildQuantitySummaries(), oracle(), `${stage}：修改摘要行或数组不能修改后道事实`)
  assert.deepEqual(flow.listPostFinishingFullFlowRecheckOrders(), complete.rechecks)
  assert.deepEqual(flow.listPostFinishingFullFlowOutboundOrders(), complete.outbounds)
  assert.deepEqual(flow.listPostFinishingWaitHandoverWarehouseRecords(), complete.waitHandovers)
  const actual = flow.listPostFinishingTaskChildQuantitySummaries()
  observations.push({ stage: `${stage}:child-primitive-summaries`, filtersChecked: filters.length,
    rechecks: actual.rechecks, outbounds: actual.outbounds, waitHandovers: actual.waitHandovers, primitiveAndReturnIsolation: true })
  return actual
}

test('PFN-009/022/028/043/048/071：D1分项、主管订正及100/100/800多次直接出货的摘要逐阶段等于完整进度', () => {
  const { task, source } = createTask([...items])
  const skuId = source.skus[0].skuId
  compareSummaries('D1-before-processing')
  ;[500, 300, 200, 100].forEach((quantity, index) => append(task, items[index], [{ skuId, quantity }], `SUMMARY-INITIAL-${index}`))
  assert.equal(compareSummaries('D1-500-300-200-100')[0].totalCompletedQty, 100)
  const original = flow.getPostFinishingProcessProgress(task.postTaskId).records.find(row => row.processItem === '开扣眼')!
  flow.correctPostFinishingProcessCompletion({ recordId: original.recordId, quantities: [{ skuId, quantity: 550 }], actor: actors.postSupervisor, operationId: 'SUMMARY-CORRECT-HOLE', reason: '隔离契约：复核首项原登记', nowMs: now + 15000 })
  assert.equal(compareSummaries('D1-after-signed-correction')[0].totalCompletedQty, 100)
  const first = dispatchOutbound(submit(task, [{ skuId, quantity: 100 }], 'SUMMARY-RC-1'))
  receive(first)
  assert.equal(compareSummaries('D1-first-100-received')[0].availableForOutboundQty, 0)
  append(task, '包装', [{ skuId, quantity: 100 }], 'SUMMARY-PACK-SECOND')
  const second = dispatchOutbound(submit(task, [{ skuId, quantity: 100 }], 'SUMMARY-RC-2'))
  ;[450, 700, 800, 800].forEach((quantity, index) => append(task, items[index], [{ skuId, quantity }], `SUMMARY-FINISH-${index}`))
  assert.equal(compareSummaries('D1-all-1000-before-third')[0].availableForOutboundQty, 800)
  const third = dispatchOutbound(submit(task, [{ skuId, quantity: 800 }], 'SUMMARY-RC-3'))
  receive(third); receive(second)
  const final = compareSummaries('D1-all-three-received')[0]
  assert.equal(final.totalExpectedQty, 1000); assert.equal(final.totalCompletedQty, 1000); assert.equal(final.availableForOutboundQty, 0)
})

test('PFN-002/016/048/056：两项及四种单项、多来源子集、空Set与primitive返回隔离保持', () => {
  const pair = createTask(['装扣子', '包装'], [100, 0, 0, 0, 0])
  append(pair.task, '装扣子', [{ skuId: pair.source.skus[0].skuId, quantity: 30 }], 'SUMMARY-PAIR-BUTTON')
  append(pair.task, '包装', [{ skuId: pair.source.skus[0].skuId, quantity: 10 }], 'SUMMARY-PAIR-PACK')
  items.forEach((item, index) => {
    const single = createTask([item], [10, 0, 0, 0, 0], 1, index + 1)
    append(single.task, item, [{ skuId: single.source.skus[0].skuId, quantity: 10 }], `SUMMARY-SINGLE-${index}`)
  })
  const all = compareSummaries('two-items-and-four-single-items')
  assert.equal(all.length, 5)
  for (const productionOrderNos of [new Set<string>(), new Set([pair.task.productionOrderNo]), new Set([flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[1].productionOrderNo]), new Set(['UNKNOWN']), new Set(all.map(row => row.productionOrderNo))]) {
    assert.deepEqual(flow.listPostFinishingTaskQuantitySummaries(productionOrderNos), all.filter(row => productionOrderNos.has(row.productionOrderNo)))
  }
  const detached = flow.listPostFinishingTaskQuantitySummaries()
  detached[0].totalCompletedQty = -999
  detached[0].productionOrderNo = 'UNSAVED-RETURN-MUTATION'
  detached.pop()
  assert.deepEqual(flow.listPostFinishingTaskQuantitySummaries(), all)
  compareSummaries('summary-return-mutation-does-not-change-authority')
})

test('PFN-011/038/040/048：多SKU本次选择0不占用，实际出货摘要不改变加工供给', () => {
  const {task,source}=createTask(['装扣子'],[10,10,0,0,0])
  append(task,'装扣子',source.skus.slice(0,2).map(sku=>({skuId:sku.skuId,quantity:10})),'SUMMARY-MULTI-SKU')
  assert.equal(compareSummaries('multi-sku-before-allocation')[0].totalCompletedQty,20)
  const record=submit(task,[{skuId:source.skus[0].skuId,quantity:0},{skuId:source.skus[1].skuId,quantity:10}],'SUMMARY-MULTI-OUT')
  const outbound=dispatchOutbound(record);assert.deepEqual(outbound.lines.map(line=>line.outboundQty),[10])
  assert.equal(flow.getPostFinishingProcessProgress(task.postTaskId).totalReservedQty,10)
  const summary=compareSummaries('multi-sku-after-explicit-partial-zero')[0]
  assert.equal(summary.totalCompletedQty,20);assert.equal(summary.availableForOutboundQty,10)
})

test('PFN-048/058/059：明确旧表示unknown和H400/N600主管承接，以及公开demo摘要保持完整getter口径', () => {
  const { task, source } = createTask(['装扣子', '包装'])
  // Declared old-format input only: encode the public QC task without the new
  // execution marker. No completion, receipt or private flow state is injected.
  mapPostFinishingRepositoryValues(value => value === 'ITEMS_V1' ? undefined : value)
  assert.equal(flow.getPostFinishingProcessProgress(task.postTaskId).legacyPending, true)
  assert.equal(compareSummaries('declared-legacy-unknown')[0].totalCompletedQty, 0)
  flow.confirmPostFinishingLegacyCarryover({
    postTaskId: task.postTaskId, processItems: ['装扣子', '包装'],
    history: task.lines.map(line => ({ skuId: line.sku.skuId, completedQty: line.sku.skuId === source.skus[0].skuId ? 400 : 0 })),
    baselines: [{ processItem: '装扣子', quantities: [{ skuId: source.skus[0].skuId, quantity: 200 }] }, { processItem: '包装', quantities: [{ skuId: source.skus[0].skuId, quantity: 100 }] }],
    actor: actors.postSupervisor, reason: '隔离旧表示契约：主管核对历史H及剩余N', nowMs: now + 60000,
  })
  assert.equal(compareSummaries('legacy-H400-N600-C200-100')[0].totalCompletedQty, 500)
  submit(task, [{ skuId: source.skus[0].skuId, quantity: 400 }], 'SUMMARY-CARRYOVER-NEW-RC')
  assert.equal(compareSummaries('legacy-carryover-after-explicit-new-400-reservation')[0].availableForOutboundQty, 100)
  append(task, '包装', [{ skuId: source.skus[0].skuId, quantity: 100 }], 'SUMMARY-CARRYOVER-PACK')
  assert.equal(compareSummaries('legacy-carryover-new-increment')[0].totalCompletedQty, 600)
  flow.loadPostFinishingDemoData()
  const demo = compareSummaries('original-public-demo')
  assert.ok(demo.length > 1)
  // The current public demo uses ITEMS_V1. Re-encoding only that marker is an
  // explicit legacy/unknown compatibility control, not a claimed factory action.
  mapPostFinishingRepositoryValues(value => value === 'ITEMS_V1' ? undefined : value)
  assert.ok(flow.listPostFinishingFullFlowPostTasks().some(row => flow.getPostFinishingProcessProgress(row).legacyPending))
  compareSummaries('declared-old-marker-demo-unknown')
})

test('PFN-033/039/044/046/057：历史复检/当前出货/待交出两过滤交集等于完整后过滤，且不暴露可变源引用', () => {
  const fixtures = [createTask(['包装'], [10, 0, 0, 0, 0], 0, 1), createTask(['包装'], [20, 0, 0, 0, 0], 0, 2), createTask(['包装'], [30, 0, 0, 0, 0], 1, 1)]
  for (const [index, fixture] of fixtures.entries()) {
    const quantities = [{ skuId: fixture.source.skus[0].skuId, quantity: [10, 20, 30][index] }]
    append(fixture.task, '包装', quantities, `SUMMARY-FILTER-APPEND-${index}`)
    dispatchOutbound(submit(fixture.task, quantities, `SUMMARY-FILTER-RC-${index}`))
  }
  createQc([], [40, 0, 0, 0, 0], 2, 1)
  const sourceFilters = [undefined, new Set<string>(), new Set([fixtures[0].task.productionOrderNo]), new Set([fixtures[2].task.productionOrderNo]), new Set(['UNKNOWN']), new Set(fixtures.map(row => row.task.productionOrderNo))]
  const postFilters = [undefined, new Set<string>(), new Set([fixtures[0].task.postTaskId]), new Set([fixtures[0].task.postTaskId, fixtures[2].task.postTaskId]), new Set(['UNKNOWN']), new Set(fixtures.map(row => row.task.postTaskId))]
  const readers = [flow.listPostFinishingFullFlowRecheckOrders, flow.listPostFinishingFullFlowOutboundOrders, flow.listPostFinishingWaitHandoverWarehouseRecords] as Array<(nos?: ReadonlySet<string>, ids?: ReadonlySet<string>) => Array<{ postTaskId?: string; productionOrderNo: string; lines: Array<{ sku: { barcode: string } }> }>>
  const counts: number[] = []
  for (const read of readers) {
    const all = read()
    counts.push(all.length)
    for (const nos of sourceFilters) for (const ids of postFilters) assert.deepEqual(read(nos, ids), all.filter(row => (!nos || nos.has(row.productionOrderNo)) && (!ids || Boolean(row.postTaskId && ids.has(row.postTaskId)))))
    const detached = read(undefined, new Set([fixtures[0].task.postTaskId]))
    assert.equal(detached.length, read===flow.listPostFinishingFullFlowRecheckOrders?0:1)
    if(detached.length)detached[0].lines[0].sku.barcode = 'UNSAVED-CLONE-MUTATION'
    detached.pop()
    assert.deepEqual(read(), all, '过滤结果数组、行和SKU必须保持独立')
  }
  assert.deepEqual(counts, [0, 4, 4], 'QC直达出货无postTaskId，应由任务ID过滤排除')
  compareSummaries('filtered-child-collections')
  observations.push({ stage: 'child-filter-cross-product', counts, combinationsPerReader: sourceFilters.length * postFilters.length, deepReturnIsolation: true })
})

test('PFN-033/038/039/044/048：三张独立出货状态的primitive摘要及数量完整、无新复检', () => {
  const {task,source}=createTask(['包装']),skuId=source.skus[0].skuId
  append(task,'包装',[{skuId,quantity:1000}],'CHILD-SUMMARY-READY-1000')
  const first=submit(task,[{skuId,quantity:100}],'CHILD-SUMMARY-OUT-100-FIRST');receive(dispatchOutbound(first))
  const second=submit(task,[{skuId,quantity:100}],'CHILD-SUMMARY-OUT-100-SECOND');dispatchOutbound(second)
  const third=submit(task,[{skuId,quantity:800}],'CHILD-SUMMARY-OUT-800-THIRD')
  const mixed=compareChildSummaries('D1-three-outbounds-received-dispatched-ready')
  assert.deepEqual(flow.listPostFinishingFullFlowOutboundOrders().map(row=>row.lines.reduce((sum,line)=>sum+line.outboundQty,0)),[100,100,800])
  assert.equal(new Set(mixed.outbounds.map(row=>row.status)).size,3,'已实收、待仓收、待出货三种真实状态')
  assert.equal(mixed.rechecks.length,0);assert.equal(mixed.waitHandovers[0].totalAvailableQty,0)
  assert.equal(flow.getPostFinishingFullFlowOutboundOrder(first.outboundOrderId)?.status,'已接收入库')
  assert.equal(flow.getPostFinishingFullFlowOutboundOrder(third.outboundOrderId)?.status,'待出货')
  const partial=createTask(['装扣子'],[10,10,0,0,0],1)
  append(partial.task,'装扣子',partial.source.skus.slice(0,2).map(sku=>({skuId:sku.skuId,quantity:10})),'CHILD-SUMMARY-PARTIAL-PROCESS')
  const partialOutbound=submit(partial.task,[{skuId:partial.source.skus[0].skuId,quantity:0},{skuId:partial.source.skus[1].skuId,quantity:10}],'CHILD-SUMMARY-PARTIAL-OUT')
  dispatchOutbound(partialOutbound);assert.deepEqual(partialOutbound.lines.map(line=>line.outboundQty),[10])
  const direct=createQc([],[40,0,0,0,0],2);assert.equal(direct.task,undefined)
  const all=compareChildSummaries('mixed-states-partial-zero-and-QC-direct')
  assert.ok(all.outbounds.some(row=>row.deliveryId===direct.delivery.deliveryId),'无需加工出货仍保留且无postTaskId')
  assert.deepEqual([all.rechecks.length,all.outbounds.length,all.waitHandovers.length],[0,5,5])
})
