import assert from 'node:assert/strict'
import test from 'node:test'
import * as flow from '../../src/data/fcs/post-finishing-full-flow.ts'
import { ensureQualityManagementRecords } from '../../src/data/fcs/quality-management-records.ts'

// PFN-001—022: use the public return → confirmation → QC commands, rather than
// manufacturing internal processing state. These contracts run in Node memory;
// browser persistence and device acceptance are separate evidence.
const actors = flow.POST_FINISHING_ACCEPTANCE_ACTORS
const chain = ['开扣眼', '装扣子', '熨烫', '包装'] as const
const fixedTime = Date.parse('2026-10-19T08:00:00+08:00')
const originalPlans = flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.map(source => source.skus.map(sku => sku.plannedQty))
test.before(async () => { await ensureQualityManagementRecords() })
test.afterEach(() => flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.forEach((source, sourceIndex) => source.skus.forEach((sku, skuIndex) => {
  sku.plannedQty = originalPlans[sourceIndex][skuIndex]
})))

function createTask(items: string[], quantities = [100, 0, 0, 0, 0], orderIndex = 0, beforeCompleteQc?: () => void) {
  flow.resetPostFinishingFullFlow()
  const source = flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[orderIndex]
  // Isolated D1 source input, authorized for acceptance only. Production fixtures
  // remain unchanged on disk, and every altered plan is restored after each test.
  source.skus.forEach((sku, index) => { sku.plannedQty = Math.max(originalPlans[orderIndex][index], quantities[index] ?? 0) })
  const delivery = flow.registerPostFinishingFactoryReturn({
    productionOrderNo: source.productionOrderNo,
    executionTaskId: source.executionTaskId,
    returnIndex: 1,
    triggerSource: '车缝正常交出',
    idempotencyKey: 'PROCESS-PROGRESS-SOURCE',
    quantities: source.skus.map((sku, index) => ({ skuId: sku.skuId, registeredQty: quantities[index] ?? 0 })),
    deliveryPersonName: '分项验收送货人',
    deliveryPersonPhone: '',
    evidenceImageUrls: [source.skus[0].imageUrl],
    actor: actors.factoryCourier,
    nowMs: fixedTime,
  })
  flow.confirmPostFinishingFactoryReturn({
    deliveryId: delivery.deliveryId,
    firstCounts: delivery.lines.map(line => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })),
    actor: actors.returnConfirmer,
    nowMs: fixedTime + 1000,
  })
  const qc = flow.sendPostFinishingFactoryReturnToQc({ deliveryId: delivery.deliveryId, actor: actors.sender, nowMs: fixedTime + 2000 })
  const claimed = flow.claimPostFinishingQcTask({ qcTaskNo: qc.qcTaskNo, actor: actors.qcA, nowMs: fixedTime + 3000 })
  assert.ok(claimed.inspection?.snapshot.items.length, '领取已固定有效标准')
  flow.submitPostFinishingQcRound({ qcTaskId:qc.qcTaskId,actor:actors.qcA,operationId:'PROCESS-PROGRESS-QC-ROUND',lines:qc.lines.map(line=>({skuId:line.sku.skuId,passedQty:line.expectedQty,defectQty:0,returnQty:0,issues:[]})),nowMs:fixedTime+3500 })
  flow.attachPostFinishingQcSignedPaper({ qcTaskId:qc.qcTaskId,actor:actors.qcA,name:'隔离双签测试文件.png',url:'/test-only-signed-paper.png',nowMs:fixedTime+3600 })
  beforeCompleteQc?.()
  const completed = flow.completePostFinishingQcTask({
    qcTaskId: qc.qcTaskId,
    processItems: items,
    results: qc.lines.map(line => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 })),
    actor: actors.qcA,
    nowMs: fixedTime + 4000,
  })
  const task = flow.listPostFinishingFullFlowPostTasks().find(row => row.qcTaskId === completed.qcTaskId)
  assert.ok(task, '正合格量及非空加工项目必须生成原来源加工单')
  return { source, delivery, qc: completed, task }
}

function progress(taskId: string) {
  assert.equal(typeof (flow as any).getPostFinishingProcessProgress, 'function', '应导出统一分项进度读取函数')
  return (flow as any).getPostFinishingProcessProgress(taskId)
}

function append(taskId: string, processItem: string, quantities: Array<{ skuId: string; quantity: number }>, operationId: string, responsible: flow.PostFinishingActor = actors.postOperator, actor: flow.PostFinishingActor = responsible) {
  assert.equal(typeof (flow as any).appendPostFinishingProcessCompletion, 'function', '应导出逐项增量登记命令')
  return (flow as any).appendPostFinishingProcessCompletion({ postTaskId: taskId, processItem, quantities, operationId, responsible, actor, nowMs: fixedTime + 10000 })
}

test('PFN-001/002/003：全部15种非空QC选择按相对顺序执行，来源责任不覆盖实际选择', () => {
  for (let mask = 1; mask < 16; mask += 1) {
    const selected = chain.filter((_item, index) => mask & (1 << index))
    const { task } = createTask([...selected].reverse(), [100, 0, 0, 0, 0], mask % 3)
    assert.deepEqual(task.processItems, selected)
    const view = progress(task.postTaskId)
    assert.deepEqual(view.processes.filter((row: any) => row.applicable).map((row: any) => row.processItem), selected)
    for (const item of chain) {
      const row = view.processes.find((value: any) => value.processItem === item)
      assert.ok(row, `列表所需四个项目的 ${item} 进度必须存在`)
      assert.equal(row.applicable, selected.includes(item))
      assert.equal(row.completedQty, 0)
    }
  }
})

test('PFN-009/015/016/021/022：D1四项形成500/300/200/100进度，最后适用项决定成衣完成量', () => {
  const { task, source } = createTask([...chain], [1000, 0, 0, 0, 0])
  const skuId = source.skus[0].skuId
  ;[500, 300, 200, 100].forEach((quantity, index) => append(task.postTaskId, chain[index], [{ skuId, quantity }], `FOUR-${index}`))
  const view = progress(task.postTaskId)
  assert.deepEqual(view.processes.map((row: any) => row.completedQty), [500, 300, 200, 100])
  assert.deepEqual(view.processes.map((row: any) => row.availableQty), [500, 200, 100, 100])
  assert.equal(view.totalExpectedQty, 1000)
  assert.equal(view.totalCompletedQty, 100)
  assert.equal(view.totalReservedQty, 0)
  assert.equal(view.availableForOutboundQty, 100)
  assert.equal(flow.getPostFinishingFullFlowPostTask(task.postTaskId)?.status, '后道中')
  assert.equal(view.records.length, 4)
  assert.equal(flow.listPostFinishingFullFlowRecheckOrders().length, 0, '加工保存不自动建复检')
})

test('PFN-002/013/016：仅装扣子与包装，包装受装扣子上限约束；四种单项均可成为末项', () => {
  let fixture = createTask(['包装', '装扣子'])
  let skuId = fixture.source.skus[0].skuId
  append(fixture.task.postTaskId, '装扣子', [{ skuId, quantity: 30 }], 'BUTTON-30')
  assert.throws(() => append(fixture.task.postTaskId, '包装', [{ skuId, quantity: 31 }], 'PACK-31'))
  append(fixture.task.postTaskId, '包装', [{ skuId, quantity: 10 }], 'PACK-10')
  assert.equal(progress(fixture.task.postTaskId).availableForOutboundQty, 10)
  for (const item of chain) {
    fixture = createTask([item])
    skuId = fixture.source.skus[0].skuId
    append(fixture.task.postTaskId, item, [{ skuId, quantity: 100 }], `SINGLE-${item}`)
    assert.equal(progress(fixture.task.postTaskId).totalCompletedQty, 100)
    assert.equal(progress(fixture.task.postTaskId).availableForOutboundQty, 100)
    assert.equal(flow.getPostFinishingFullFlowPostTask(fixture.task.postTaskId)?.status, '后道完成')
  }
})

test('PFN-011/012/013：首项不超Q，后项逐SKU不超前序，其他SKU余量不能抵扣', () => {
  const { task, source } = createTask(['开扣眼', '包装'], [100, 100, 0, 0, 0])
  const [first, second] = source.skus
  append(task.postTaskId, '开扣眼', [{ skuId: first.skuId, quantity: 10 }, { skuId: second.skuId, quantity: 80 }], 'FIRST')
  const before = progress(task.postTaskId)
  assert.throws(() => append(task.postTaskId, '包装', [{ skuId: first.skuId, quantity: 11 }, { skuId: second.skuId, quantity: 1 }], 'CROSS-SKU'))
  assert.throws(() => append(task.postTaskId, '开扣眼', [{ skuId: first.skuId, quantity: 91 }], 'OVER-Q'))
  assert.deepEqual(progress(task.postTaskId), before, '整次失败不能部分增加任一SKU')
  append(task.postTaskId, '包装', [{ skuId: first.skuId, quantity: 10 }, { skuId: second.skuId, quantity: 20 }], 'PACK-VALID')
  assert.equal(progress(task.postTaskId).totalCompletedQty, 30)
})

test('PFN-014：空量、小数、负数、未知及重复SKU、未选项目均拒绝且不追加事实', () => {
  const { task, source } = createTask(['装扣子'])
  const skuId = source.skus[0].skuId
  const invalid = [
    [], [{ skuId, quantity: 0 }], [{ skuId, quantity: -1 }], [{ skuId, quantity: 0.5 }],
    [{ skuId, quantity: Number.NaN }], [{ skuId, quantity: Number.POSITIVE_INFINITY }],
    [{ skuId: 'UNKNOWN', quantity: 1 }], [{ skuId, quantity: 1 }, { skuId, quantity: 2 }],
  ]
  const before = progress(task.postTaskId)
  invalid.forEach((quantities, index) => assert.throws(() => append(task.postTaskId, '装扣子', quantities, `INVALID-${index}`)))
  assert.throws(() => append(task.postTaskId, '包装', [{ skuId, quantity: 1 }], 'UNSELECTED'))
  assert.deepEqual(progress(task.postTaskId), before)
  append(task.postTaskId, '装扣子', [{ skuId, quantity: 1 }, { skuId: source.skus[1].skuId, quantity: 0 }], 'LOCAL-ZERO')
  assert.equal(progress(task.postTaskId).totalCompletedQty, 1)
})

test('PFN-009/010/017/018/019/020：D5多人200+300累计500保留责任、录入人与时间，同提交重试不重复累计', () => {
  const { task, source } = createTask(['熨烫'], [1000, 0, 0, 0, 0])
  const quantities = (quantity: number) => [{ skuId: source.skus[0].skuId, quantity }]
  append(task.postTaskId, '熨烫', quantities(200), 'PERSON-A', actors.postOperator, actors.postSupervisor)
  append(task.postTaskId, '熨烫', quantities(300), 'PERSON-B', actors.postSupervisor, actors.postOperator)
  append(task.postTaskId, '熨烫', quantities(300), 'PERSON-B', actors.postSupervisor, actors.postOperator)
  assert.throws(() => append(task.postTaskId, '熨烫', quantities(301), 'PERSON-B', actors.postSupervisor, actors.postOperator), '同提交标识不能悄悄接受变化后的内容')
  const view = progress(task.postTaskId)
  assert.equal(view.totalCompletedQty, 500)
  assert.equal(view.records.length, 2)
  assert.deepEqual(view.records.map((row: any) => row.responsible.actorId), [actors.postOperator.actorId, actors.postSupervisor.actorId])
  assert.deepEqual(view.records.map((row: any) => row.recordedBy.actorId), [actors.postSupervisor.actorId, actors.postOperator.actorId])
  assert.ok(view.records.every((row: any) => row.recordId && row.operationId && row.recordedAt && row.postTaskId === task.postTaskId))
  assert.equal(new Set(view.records.map((row: any) => row.recordId)).size, 2)
  assert.throws(() => append(task.postTaskId, '熨烫', quantities(1), 'NO-RESPONSIBLE', { actorId: '', actorName: '', roleName: '' }))
  assert.equal(progress(task.postTaskId).totalCompletedQty, 500)
})

test('PFN-004/052：已有执行事实后不能通过重复QC或旧整单命令覆盖加工链、数量', () => {
  const { task, source, qc } = createTask(['装扣子', '包装'])
  append(task.postTaskId, '装扣子', [{ skuId: source.skus[0].skuId, quantity: 10 }], 'FREEZE')
  flow.completePostFinishingQcTask({ qcTaskId: qc.qcTaskId, actor: actors.qcA, processItems: ['熨烫'], results: [] })
  assert.deepEqual(flow.getPostFinishingFullFlowPostTask(task.postTaskId)?.processItems, ['装扣子', '包装'])
  const before = progress(task.postTaskId)
  assert.throws(() => flow.setPostFinishingPostProcessedQuantity({ postTaskId: task.postTaskId, skuId: source.skus[0].skuId, processedQty: 100, actor: actors.postOperator }))
  assert.deepEqual(progress(task.postTaskId), before)
})

test('PFN-071：主管订正保留原责任与有符号差量，绝对订正可为0且不破坏后序或出货占用', () => {
  const { task, source } = createTask(['开扣眼', '装扣子'])
  const skuId = source.skus[0].skuId
  append(task.postTaskId, '开扣眼', [{ skuId, quantity: 50 }], 'ORIGINAL-HOLE')
  append(task.postTaskId, '装扣子', [{ skuId, quantity: 30 }], 'ORIGINAL-BUTTON')
  const originalRecords = progress(task.postTaskId).records
  const hole = originalRecords.find((row: any) => row.processItem === '开扣眼')
  const button = originalRecords.find((row: any) => row.processItem === '装扣子')
  assert.equal(typeof (flow as any).correctPostFinishingProcessCompletion, 'function')
  const correct = (recordId: string, quantity: number, operationId: string, actor: flow.PostFinishingActor = actors.postSupervisor, reason = '复核原登记误录') => (flow as any).correctPostFinishingProcessCompletion({ recordId, quantities: [{ skuId, quantity }], operationId, actor, reason, nowMs: fixedTime + 20000 })
  const before = progress(task.postTaskId)
  assert.throws(() => correct(hole.recordId, 20, 'BREAK-PREVIOUS'))
  assert.throws(() => correct(hole.recordId, 101, 'OVER-EXPECTED'))
  assert.throws(() => correct(hole.recordId, 60, 'NON-SUPERVISOR', actors.postOperator))
  assert.throws(() => correct(hole.recordId, 60, 'NO-REASON', actors.postSupervisor, ''))
  assert.throws(() => correct(hole.recordId, -1, 'NEGATIVE'))
  assert.deepEqual(progress(task.postTaskId), before)
  correct(hole.recordId, 60, 'CORRECT-HOLE')
  correct(hole.recordId, 60, 'CORRECT-HOLE')
  assert.throws(() => correct(hole.recordId, 61, 'CORRECT-HOLE'))
  let view = progress(task.postTaskId)
  assert.deepEqual(view.processes.filter((row: any) => row.applicable).map((row: any) => row.completedQty), [60, 30])
  assert.equal(view.records.length, 3)
  assert.deepEqual(view.records.slice(0, 2), originalRecords)
  const correction = view.records[2]
  assert.equal(correction.correctionOf, hole.recordId)
  assert.deepEqual(correction.quantities, [{ skuId, quantity: 10 }])
  assert.equal(correction.responsible.actorId, hole.responsible.actorId)
  assert.equal(correction.recordedBy.actorId, actors.postSupervisor.actorId)
  assert.equal(correction.reason, '复核原登记误录')
  assert.throws(() => correct(correction.recordId, 55, 'CORRECT-A-CORRECTION'))

  correct(button.recordId, 0, 'BUTTON-TO-ZERO')
  view = progress(task.postTaskId)
  assert.equal(view.totalCompletedQty, 0)
  assert.equal(view.records.at(-1).quantities[0].quantity, -30)
  correct(button.recordId, 25, 'BUTTON-TO-25')
  assert.equal(progress(task.postTaskId).totalCompletedQty, 25)
  ;(flow as any).submitPostFinishingForOutbound({ postTaskId: task.postTaskId, quantities: [{ skuId, quantity: 25 }], actor: actors.postOperator, operationId: 'CORRECT-RESERVATION', nowMs: fixedTime + 30000 })
  const reserved = progress(task.postTaskId)
  assert.throws(() => correct(button.recordId, 24, 'BREAK-RESERVATION'))
  assert.deepEqual(progress(task.postTaskId), reserved)
})

test('PFN-017/020/068/071：回货、QC、复检及仓收角色不能冒充加工登记或后道主管订正', () => {
  const { task, source } = createTask(['装扣子'])
  const quantities = [{ skuId: source.skus[0].skuId, quantity: 10 }]
  const forbidden = [actors.factoryCourier, actors.returnConfirmer, actors.returnSupervisor, actors.qcA, actors.qcSupervisor, actors.recheckerA, actors.warehouseReceiver]
  for (const actor of forbidden) {
    assert.throws(() => append(task.postTaskId, '装扣子', quantities, `BAD-RECORDER-${actor.actorId}`, actors.postOperator, actor))
    assert.throws(() => append(task.postTaskId, '装扣子', quantities, `BAD-RESPONSIBLE-${actor.actorId}`, actor, actors.postOperator))
  }
  assert.equal(progress(task.postTaskId).records.length, 0)
  append(task.postTaskId, '装扣子', quantities, 'AUTHORIZED-POST')
  const before = progress(task.postTaskId)
  for (const actor of forbidden) {
    assert.throws(() => (flow as any).submitPostFinishingForOutbound({ postTaskId: task.postTaskId, quantities, actor, operationId: `BAD-HANDOVER-${actor.actorId}` }))
    assert.throws(() => (flow as any).correctPostFinishingProcessCompletion({ recordId: before.records[0].recordId, quantities, actor, reason: '角色边界验收', operationId: `BAD-CORRECTION-${actor.actorId}` }))
  }
  assert.equal(flow.listPostFinishingFullFlowRecheckOrders().length, 0)
  assert.deepEqual(progress(task.postTaskId), before)
})

test('PFN-053/054/068：辅料未变时，归属读取故障不阻断普通QC、加工登记和分配出货', () => {
  let ownershipUnavailable = false
  let ownershipReads = 0
  let installedReads = 0
  let materialBytes = ''
  const readOwners = () => {
    ownershipReads += 1
    if (ownershipUnavailable) throw new Error('隔离契约：旧辅料准备资料不可读取')
    return new Set<string>()
  }
  const bridge: flow.AccessoryPostFinishingReadBridge = {
    ownsProduction: id => readOwners().has(id),
    ownedProductionIdentities: readOwners,
    transfers: () => [],
    stocks: () => [],
    readiness: () => undefined,
  }
  try {
    let fixture: ReturnType<typeof createTask> | undefined
    assert.doesNotThrow(() => {
      fixture = createTask(['装扣子'], [100, 0, 0, 0, 0], 0, () => {
        const originalMaterials = flow.readLegacyPostFinishingMaterialState()
        assert.ok(originalMaterials.materialTransferOrders.length > 0, '公开演示来源须含非空原辅料，不能以空数组避开保护分支')
        materialBytes = JSON.stringify(originalMaterials)
        flow.installAccessoryPostFinishingReadBridge(bridge)
        installedReads = ownershipReads
        ownershipUnavailable = true
      })
    }, '质检未修改辅料时，不应为保护未变辅料再次读取旧归属来源')
    assert.ok(fixture)
    const skuId = fixture.source.skus[0].skuId
    assert.doesNotThrow(() => append(fixture!.task.postTaskId, '装扣子', [{ skuId, quantity: 25 }], 'MATERIAL-UNCHANGED-APPEND'))
    assert.doesNotThrow(() => flow.submitPostFinishingForOutbound({
      postTaskId: fixture!.task.postTaskId,
      quantities: [{ skuId, quantity: 25 }],
      actor: actors.postOperator,
      operationId: 'MATERIAL-UNCHANGED-RECHECK',
      nowMs: fixedTime + 20000,
    }))
    assert.equal(ownershipReads, installedReads, '完整原辅料字节未变的三个普通动作不应触发归属读取')
    assert.equal(JSON.stringify(flow.readLegacyPostFinishingMaterialState()), materialBytes)
    assert.equal(progress(fixture.task.postTaskId).totalCompletedQty, 25)
    assert.equal(progress(fixture.task.postTaskId).totalReservedQty, 25)
    assert.equal(flow.listPostFinishingFullFlowOutboundOrders().filter(row => row.postTaskId === fixture!.task.postTaskId).length, 1)
  } finally {
    ownershipUnavailable = false
    flow.installAccessoryPostFinishingReadBridge(bridge)
  }
})

test('PFN-052/054/068：受管辅料原整单入口仍拒绝修改，归属未知也不能入库', () => {
  createTask(['装扣子'])
  const originalMaterials = flow.readLegacyPostFinishingMaterialState()
  const transfer = originalMaterials.materialTransferOrders.find(row => row.status === '待入库')
  assert.ok(transfer, '使用公开演示中已有待入库辅料单，不注入内部材料状态')
  const materialBytes = JSON.stringify(originalMaterials)
  const owned = new Set([transfer.productionOrderId, transfer.productionOrderNo])
  let ownershipUnavailable = false
  const readOwners = () => {
    if (ownershipUnavailable) throw new Error('隔离契约：辅料归属无法核对')
    return owned
  }
  const bridge: flow.AccessoryPostFinishingReadBridge = {
    ownsProduction: id => readOwners().has(id),
    ownedProductionIdentities: readOwners,
    transfers: () => [],
    stocks: () => [],
    readiness: () => undefined,
  }
  flow.installAccessoryPostFinishingReadBridge(bridge)
  try {
    const receive = () => flow.receivePostFinishingMaterialTransfer({ transferOrderNo: transfer.transferOrderNo, actor: actors.postOperator, nowMs: fixedTime + 30000 })
    assert.throws(receive, /辅料调拨入口逐行确认收货并上架/)
    assert.equal(JSON.stringify(flow.readLegacyPostFinishingMaterialState()), materialBytes)
    ownershipUnavailable = true
    assert.throws(receive, /辅料归属无法核对/)
    assert.equal(JSON.stringify(flow.readLegacyPostFinishingMaterialState()), materialBytes, '归属未知时不能接受原材料变更')
  } finally {
    ownershipUnavailable = false
    flow.installAccessoryPostFinishingReadBridge(bridge)
  }
  // Public material receive rejects managed rows before mutation; this test does
  // not inject private state to pretend it exercised persist's changed-row guard.
})
