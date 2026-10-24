import {ensureQualityManagementRecords} from '../../src/data/fcs/quality-management-records.ts'
await ensureQualityManagementRecords()
import assert from 'node:assert/strict'
import test from 'node:test'
import { FINISHED_OUTBOUND_SEED, applyFinishedOutboundAction } from '../../src/data/wls/finished-outbound-orders.ts'
import { getPostFinishingQcPrintProductionSource, listPostFinishingFullFlowQcTasks, listPostFinishingFullFlowOutboundOrders } from '../../src/data/fcs/post-finishing-full-flow.ts'
import { parseQcShippingDeadlineMillis } from '../../src/data/fcs/post-finishing-qc-shipping-priority.ts'
import { getQcShippingPriorityForQc, getQcShippingPriorityForProduction, preparePostFinishingQcShippingPriority, resolveQcShippingIdentity, readQcShippingDestination, readQcShippingPriorityRules, saveQcShippingPriorityRules, saveQcShippingDestination } from '../../src/data/fcs/post-finishing-qc-shipping-priority-runtime.ts'

test('全部静态出库记录含取消和已出库均有有效揽收时效，非法值不允许动作保存', () => {
  for (const order of FINISHED_OUTBOUND_SEED) assert.ok(parseQcShippingDeadlineMillis(order.deadline, order.deadlineTimeZone || 'Asia/Jakarta') !== undefined, order.outboundOrderNo)
  const row = FINISHED_OUTBOUND_SEED.find(row => row.status === '已打单')!
  for (const deadline of ['', '2026-02-30 12:00:00']) assert.throws(() => applyFinishedOutboundAction({ ...row, deadline }, 'print', '2026-10-21 10:00:00'), /揽收时效/)
})

test('实际关联样本读取后按仓生成QC参考，生产单主单不累加重复QC引用', async () => {
  await preparePostFinishingQcShippingPriority()
  const qc = listPostFinishingFullFlowQcTasks().find(row => row.status === '待质检')!
  const doc = getQcShippingPriorityForQc(qc)!
  assert.equal(doc.ready, true, doc.issues.join(';'))
  assert.equal(doc.stars, 2)
  assert.ok(doc.rows.every(row => row.warehouseName === 'A&C WH'))
  assert.equal(doc.ruleVersion, 1)
  assert.match(doc.asOf, /\+07:00$/)
  const master = getQcShippingPriorityForProduction(qc.productionOrderNo)!
  assert.equal(new Set(master.rows.map(row => `${row.sku}|${row.warehouseName}`)).size, master.rows.length)
  assert.deepEqual(master.rows, doc.rows)
  assert.equal(getPostFinishingQcPrintProductionSource(qc.qcTaskId).productionOrderNo, qc.productionOrderNo)
  const complete = listPostFinishingFullFlowQcTasks().find(row => row.status === '质检完成')!
  assert.equal(getQcShippingPriorityForQc(complete), undefined)
})

test('来源非法时效含取消记录也不能被丢弃后冒充正常计算', async () => {
  const row = FINISHED_OUTBOUND_SEED.find(row => row.status === '已取消')!
  const original = row.deadline
  try {
    row.deadline = ''
    await preparePostFinishingQcShippingPriority()
    const qc = listPostFinishingFullFlowQcTasks().find(row => row.status === '待质检')!
    const doc = getQcShippingPriorityForQc(qc)!
    assert.equal(doc.ready, false)
    assert.ok(doc.issues.some(issue => issue.includes('揽收时效')))
  } finally { row.deadline = original; await preparePostFinishingQcShippingPriority() }
})

test('规则保存验证真实版本及责任字段，冲突和非法规则不覆盖当前值', async () => {
  const initial = readQcShippingPriorityRules()
  await assert.rejects(saveQcShippingPriorityRules({ ...initial, expectedVersion: initial.version, todayStars: 1, operator: '测试维护人', reason: '错误顺序验证' }), /星数/)
  assert.deepEqual(readQcShippingPriorityRules(), initial)
  const saved = await saveQcShippingPriorityRules({ ...initial, expectedVersion: initial.version, todayStars: 3, operator: '测试维护人', reason: '显示三级星号验证' })
  assert.equal(saved.version, initial.version + 1)
  await assert.rejects(saveQcShippingPriorityRules({ ...initial, expectedVersion: initial.version, operator: '冲突维护人', reason: '旧版本验证' }), /已被其他操作修改/)
  assert.equal(readQcShippingPriorityRules().todayStars, 3)
})

test('批次去向继承版本为0；非法仓拒绝，父剩余去向变化不改已冻结子单', async () => {
  const qcs = listPostFinishingFullFlowQcTasks()
  const qc = qcs.find(row => row.status === '待质检')!
  assert.equal(readQcShippingDestination(qc.qcTaskId)?.version, 0)
  await assert.rejects(saveQcShippingDestination({ sourceId: qc.qcTaskId, warehouseId: 'unknown', expectedVersion: 0, operator: '测试计划员', reason: '错误仓库验证' }), /目标成衣仓/)
  const complete = qcs.find(row => row.outboundOrderId)!
  const before = listPostFinishingFullFlowOutboundOrders().filter(row => row.qcTaskId === complete.qcTaskId)
  await saveQcShippingDestination({ sourceId: complete.qcTaskId, warehouseId: 'WH-FM', expectedVersion: 0, operator: '测试计划员', reason: '只维护父剩余去向' })
  assert.deepEqual(listPostFinishingFullFlowOutboundOrders().filter(row => row.qcTaskId === complete.qcTaskId), before)
})

test('替换颜色尺码按现有规范化匹配，后道已换码的新实收不依赖旧仓库存批次', () => {
  const sourceQc = listPostFinishingFullFlowQcTasks()[0]!
  const sku = { ...sourceQc.lines[0]!.sku, skuCode: 'OLD', colorName: 'white', sizeName: 'm' }
  const qc = { ...sourceQc, productionOrderId: 'IDENTITY-CASE' }
  const identity = { records: [{ productionOrderId: 'IDENTITY-CASE', productionOrderNo: qc.productionOrderNo, sourceColor: ' WHITE ', lines: [{ size: 'M', source: { skuCode: 'OLD' }, target: { skuCode: 'NEW' }, postFactoryQty: 100, postRelabeledQty: 100 }] }], inventoryBatches: [], relabelTasks: [], warehouseMovements: [], version: 1 } as unknown as import('../../src/data/fcs/garment-spu-replacement-records.ts').GarmentReplacementStoreSnapshot
  const issues: string[] = []
  for (const stage of ['reference', 'post', 'warehouse'] as const) assert.equal(resolveQcShippingIdentity(qc, sku, stage, issues, identity), 'NEW')
  assert.deepEqual(issues, [])
  identity.records[0]!.lines[0]!.postRelabeledQty = 40
  resolveQcShippingIdentity(qc, sku, 'post', issues, identity)
  assert.ok(issues.some(issue => issue.includes('不能抵扣原SKU')))
})

test('真实命令：100合格中40子单冻结A、余60改B；子单改B及实收不增加总供给', async () => {
  const flow = await import('../../src/data/fcs/post-finishing-full-flow.ts')
  const supply = await import('../../src/data/fcs/post-finishing-qc-shipping-supply.ts')
  const runtime = await import('../../src/data/fcs/post-finishing-qc-shipping-priority-runtime.ts')
  const actors = flow.POST_FINISHING_ACCEPTANCE_ACTORS
  flow.resetPostFinishingFullFlow()
  const source = flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]!
  const delivery = flow.registerPostFinishingFactoryReturn({ productionOrderNo: source.productionOrderNo, executionTaskId: source.executionTaskId, returnIndex: 1, triggerSource: '车缝正常交出', idempotencyKey: 'QCU-SPLIT-WAREHOUSE', quantities: source.skus.map((sku, index) => ({ skuId: sku.skuId, registeredQty: index ? 0 : 100 })), deliveryPersonName: '数量契约来源', deliveryPersonPhone: '', evidenceImageUrls: [source.skus[0]!.imageUrl], actor: actors.factoryCourier })
  flow.confirmPostFinishingFactoryReturn({ deliveryId: delivery.deliveryId, actor: actors.returnConfirmer, firstCounts: delivery.lines.map(line => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })) })
  const qc = flow.sendPostFinishingFactoryReturnToQc({ deliveryId: delivery.deliveryId, actor: actors.sender })
  flow.claimPostFinishingQcTask({ qcTaskNo: qc.qcTaskNo, actor: actors.qcA })
  flow.submitPostFinishingQcRound({qcTaskId:qc.qcTaskId,actor:actors.qcA,operationId:'priority-actual-round',lines:qc.lines.map(line=>({skuId:line.sku.skuId,passedQty:line.expectedQty,defectQty:0,returnQty:0,issues:[]}))})
  flow.attachPostFinishingQcSignedPaper({qcTaskId:qc.qcTaskId,actor:actors.qcA,url:source.skus[0].imageUrl,name:'隔离契约纸单，非真实签字'})
  flow.completePostFinishingQcTask({qcTaskId:qc.qcTaskId,actor:actors.qcA,processItems:['包装']})
  const post = flow.listPostFinishingFullFlowPostTasks()[0]!
  const skuId = source.skus[0]!.skuId
  flow.appendPostFinishingProcessCompletion({ postTaskId: post.postTaskId, processItem: '包装', quantities: [{ skuId, quantity: 40 }], operationId: 'QCU-PACK-40', responsible: actors.postOperator, actor: actors.postOperator })
  const prepared=flow.submitPostFinishingForOutbound({postTaskId:post.postTaskId,quantities:[{skuId,quantity:40}],operationId:'QCU-DIRECT-40',actor:actors.postOperator})
  flow.dispatchPostFinishingOutboundOrder({outboundOrderId:prepared.outboundOrderId,actor:actors.postOperator})
  const child = flow.listPostFinishingFullFlowOutboundOrders()[0]!
  assert.equal(child.targetWarehouseId, 'WH-AC')
  await runtime.saveQcShippingDestination({ sourceId: qc.qcTaskId, warehouseId: 'WH-FM', expectedVersion: 0, operator: '数量契约计划员', reason: '剩余60供B仓' })
  assert.equal(flow.getPostFinishingFullFlowOutboundOrder(child.outboundOrderId)!.targetWarehouseId, 'WH-AC')
  const readProjection = () => supply.projectQcShippingSupply({ qcs: flow.listPostFinishingFullFlowQcTasks(), postTasks: flow.listPostFinishingFullFlowPostTasks(), rechecks: flow.listPostFinishingFullFlowRecheckOrders(), outbounds: flow.listPostFinishingFullFlowOutboundOrders(), receipts: flow.listPostFinishingWarehouseReceipts() })
  let projected = readProjection()
  assert.deepEqual(projected.issues, [])
  assert.equal(projected.segments.filter(row => !row.outboundOrderId).reduce((s, row) => s + row.quantity, 0), 60)
  assert.equal(projected.segments.filter(row => row.outboundOrderId === child.outboundOrderId).reduce((s, row) => s + row.quantity, 0), 40)
  flow.setPostFinishingOutboundDestination({ outboundOrderId: child.outboundOrderId, warehouseId: 'WH-FM', expectedWarehouseId: 'WH-AC', operator: '数量契约计划员', reason: '本子单实际改供B仓' })
  assert.equal(flow.getPostFinishingFullFlowOutboundOrder(child.outboundOrderId)!.status, '待仓库接收')
  flow.receivePostFinishingOutboundOrder({ outboundOrderNo: child.outboundOrderNo, targetWarehouseId: 'WH-FM', actor: actors.warehouseReceiver, receivedQuantities: child.lines.map(line => ({ skuId: line.sku.skuId, receivedQty: line.outboundQty })) })
  projected = readProjection()
  assert.deepEqual(projected.issues, [])
  assert.equal(projected.segments.reduce((s, row) => s + row.quantity, 0), 100)
  assert.equal(projected.segments.filter(row => row.position === 'warehouse').reduce((s, row) => s + row.quantity, 0), 40)
  assert.equal(flow.listPostFinishingWarehouseReceipts()[0]!.warehouseId, 'WH-FM')
  const inventory=await import('../../src/data/wls/finished-inventory-records.ts')
  const beforeInventory=inventory.captureFinishedInventoryState(),sku=child.lines[0].sku
  try {
    inventory.restoreFinishedInventoryState({...beforeInventory,lots:[{...beforeInventory.lots[0],id:'QCU-EXISTING-WH-FM-100',warehouseId:'WH-FM',warehouseName:'F&M WH',skuId:sku.skuId,skuCode:sku.skuCode,styleNo:sku.spuCode,quantity:100,quality:'正常',putaway:true}]})
    const rows=runtime.readUnifiedQcShippingStockRows().filter(row=>row.sku===sku.skuCode&&row.warehouseName==='F&M WH')
    assert.equal(rows.length,1,'同仓同SKU独立实收并入原行，不另造第二库存行')
    assert.equal(rows[0].spotStock,140,'原100件与实际接收40件只相加一次')
    assert.equal((rows[0] as any).physicalQuantity,140,'总实物数量必须同步；不能总库存100但正常库存140')
  } finally { inventory.restoreFinishedInventoryState(beforeInventory) }

  assert.throws(() => flow.setPostFinishingOutboundDestination({ outboundOrderId: child.outboundOrderId, warehouseId: 'WH-AC', expectedWarehouseId: 'WH-FM', operator: '测试员', reason: '禁止改实收' }), /已实收/)
})


test('供货只读投影不携带标准树，修改返回数量或SKU不影响权威QC',async()=>{
 const flow=await import('../../src/data/fcs/post-finishing-full-flow.ts')
 const view=flow.listPostFinishingQcShippingFacts().find(row=>row.lines.length)!
 const original=flow.getPostFinishingFullFlowQcTask(view.qcTaskId)!
 assert.equal(view.inspection,undefined)
 view.lines[0].expectedQty+=1;view.lines[0].sku.skuCode+='-NOT-SAVED'
 const after=flow.getPostFinishingFullFlowQcTask(view.qcTaskId)!
 assert.deepEqual(after,original)
})
