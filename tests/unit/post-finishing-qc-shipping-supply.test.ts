import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  PostFinishingAcceptanceSku,
  PostFinishingOutboundOrder,
  PostFinishingPostTask,
  PostFinishingQcTask,
  PostFinishingRecheckOrder,
  PostFinishingWarehouseReceipt,
} from '../../src/data/fcs/post-finishing-full-flow.ts'
import { projectQcShippingSupply } from '../../src/data/fcs/post-finishing-qc-shipping-supply.ts'

const sku: PostFinishingAcceptanceSku = {
  skuId: 'SKU-BLACK-M', skuCode: 'STYLE-black-m', spuCode: 'STYLE', spuName: '测试款',
  colorName: '黑色', sizeName: 'M', imageUrl: '/test.jpg', barcode: '123', plannedQty: 100, qtyUnit: '件',
}
const responsibility: PostFinishingQcTask['responsibility'] = {
  sewingTaskType: 'INDEPENDENT_SEWING', taskTypeLabel: '仅车缝', responsibilityMode: 'POST_FACTORY',
  responsibilityLabel: '后道工厂负责', source: 'PPIC任务分配', frozenAt: '2026-10-21T08:00:00+07:00',
  defaultProcessItems: ['开扣眼', '装扣子', '熨烫', '包装'], processItemsEditable: true,
}
const actor = { actorId: 'QC', actorName: '测试质检员', roleName: 'QC质检员' }

function qc(id = 'QC-1', passed = 100): PostFinishingQcTask {
  return {
    qcTaskId: id, qcTaskNo: id, deliveryId: `D-${id}`, deliveryOrderNo: `D-${id}`,
    productionOrderId: `P-${id}`, productionOrderNo: `P-${id}`, responsibility,
    returnIndex: 1, status: '质检完成', lines: [{ sku, expectedQty: passed }], referenceIds: [],
    createdBy: actor, createdAt: '2026-10-21T08:00:00+07:00',
    results: [{ sku, expectedQty: passed, passedQty: passed, defectQty: 0, returnQty: 0 }],
  }
}

function post(root: PostFinishingQcTask): PostFinishingPostTask {
  return {
    postTaskId: `POST-${root.qcTaskId}`, postTaskNo: `POST-${root.qcTaskId}`,
    deliveryId: root.deliveryId, deliveryOrderNo: root.deliveryOrderNo,
    productionOrderNo: root.productionOrderNo, responsibility, sourceType: '质检补加工',
    qcTaskId: root.qcTaskId, qcTaskNo: root.qcTaskNo, returnIndex: root.returnIndex,
    status: '后道中', processItems: ['开扣眼', '装扣子', '熨烫', '包装'],
    lines: root.results!.map(line => ({ sku: line.sku, expectedQty: line.passedQty })),
  }
}

function recheck(task: PostFinishingPostTask, id: string, expected: number, handover?: number): PostFinishingRecheckOrder {
  return {
    recheckOrderId: id, recheckOrderNo: id,
    deliveryId: task.deliveryId, deliveryOrderNo: task.deliveryOrderNo, productionOrderNo: task.productionOrderNo,
    responsibility, sourceType: '后道加工后', qcTaskId: task.qcTaskId, qcTaskNo: task.qcTaskNo,
    postTaskId: task.postTaskId, postTaskNo: task.postTaskNo, returnIndex: task.returnIndex,
    status: handover === undefined ? '待复检' : '复检完成',
    lines: [{ sku, expectedQty: expected, handoverQty: handover, barcodeStatus: '正确', barcodeEvents: [] }],
  }
}

function outbound(root: PostFinishingQcTask, id: string, quantity: number, source?: PostFinishingRecheckOrder): PostFinishingOutboundOrder {
  return {
    outboundOrderId: id, outboundOrderNo: id, deliveryId: root.deliveryId, deliveryOrderNo: root.deliveryOrderNo,
    productionOrderNo: root.productionOrderNo, qcTaskId: root.qcTaskId, qcTaskNo: root.qcTaskNo,
    postTaskId: source?.postTaskId, postTaskNo: source?.postTaskNo, responsibility,
    sourceType: source ? '后道加工后' : '质检直达', recheckOrderId: source?.recheckOrderId,
    recheckOrderNo: source?.recheckOrderNo, returnIndex: root.returnIndex,
    status: '待仓库接收', lines: [{ sku, outboundQty: quantity }], createdAt: '2026-10-21T09:00:00+07:00',
  }
}

function receive(order: PostFinishingOutboundOrder, quantity = order.lines[0].outboundQty): PostFinishingWarehouseReceipt {
  order.status = '已接收入库'
  order.lines[0].receivedQty = quantity
  return {
    receiptId: `REC-${order.outboundOrderId}`, outboundOrderId: order.outboundOrderId,
    outboundOrderNo: order.outboundOrderNo, productionOrderNo: order.productionOrderNo,
    lines: [{ sku, expectedQty: order.lines[0].outboundQty, receivedQty: quantity }],
    receivedBy: actor, receivedAt: '2026-10-21T10:00:00+07:00',
    authorizationId: quantity === order.lines[0].outboundQty ? undefined : 'AUTH-SHORT',
    differenceReason: quantity === order.lines[0].outboundQty ? undefined : '已核对短少',
  }
}

function project(input: {
  qcs?: PostFinishingQcTask[]; postTasks?: PostFinishingPostTask[]; rechecks?: PostFinishingRecheckOrder[];
  outbounds?: PostFinishingOutboundOrder[]; receipts?: PostFinishingWarehouseReceipt[];
} = {}) {
  return projectQcShippingSupply({ qcs: [], postTasks: [], rechecks: [], outbounds: [], receipts: [], ...input })
}

function sum(result: ReturnType<typeof project>, position: 'post' | 'warehouse') {
  return result.segments.filter(segment => segment.position === position).reduce((total, segment) => total + segment.quantity, 0)
}

test('100 件跨全部子单互斥投影：加工 30、复检 20、待接收 40、实收 10', () => {
  const root = qc(); const task = post(root)
  const pending = recheck(task, 'RC-20', 20)
  const completed = recheck(task, 'RC-40', 40, 40)
  const received = recheck(task, 'RC-10', 10, 10)
  const out40 = outbound(root, 'OUT-40', 40, completed)
  const out10 = outbound(root, 'OUT-10', 10, received)
  const receipt = receive(out10)
  const result = project({ qcs: [root], postTasks: [task], rechecks: [pending, completed, received], outbounds: [out40, out10], receipts: [receipt] })
  assert.deepEqual(result.issues, [])
  assert.equal(sum(result, 'post'), 90)
  assert.equal(sum(result, 'warehouse'), 10)
  assert.deepEqual(result.segments.map(segment => segment.quantity).sort((a, b) => a - b), [10, 20, 30, 40])
  assert.equal(new Set(result.segments.map(segment => segment.id)).size, 4)
})

test('四个加工项各完成 50 不会把同一批 50 件算成 200', () => {
  const root = qc('QC-1', 50); const task = post(root)
  task.results = [{ sku, expectedQty: 50, processedQty: 50, unprocessedQty: 0 }]
  const result = project({ qcs: [root], postTasks: [task] })
  assert.deepEqual(result.issues, [])
  assert.equal(sum(result, 'post'), 50)
})

test('质检直达待接收只计一次，仓库确认 40 出 38 收只计实收 38', () => {
  const root = qc('QC-DIRECT', 40); const order = outbound(root, 'OUT-DIRECT', 40)
  let result = project({ qcs: [root], outbounds: [order] })
  assert.equal(sum(result, 'post'), 40)
  assert.deepEqual(result.issues, [])
  const receipt = receive(order, 38)
  result = project({ qcs: [root], outbounds: [order], receipts: [receipt] })
  assert.deepEqual(result.issues, [])
  assert.equal(sum(result, 'post'), 0)
  assert.equal(sum(result, 'warehouse'), 38)
  assert.equal(result.segments[0].receiptId, receipt.receiptId)
})

test('复检少交不能释放回父任务，差额位置未知必须报告核对', () => {
  const root = qc(); const task = post(root)
  const rc = recheck(task, 'RC-SHORT', 40, 38)
  const order = outbound(root, 'OUT-SHORT', 38, rc)
  const result = project({ qcs: [root], postTasks: [task], rechecks: [rc], outbounds: [order] })
  assert.equal(sum(result, 'post'), 98)
  assert.ok(result.issues.some(issue => issue.code === 'SHORT_HANDOVER_UNLOCATED'))
  assert.equal(result.segments.find(segment => segment.id.startsWith('qc:'))?.quantity, 60)
})

test('复检授权多交先占用实际数量，不能在根中留下一份额外实物', () => {
  const root = qc(); const task = post(root)
  const rc = recheck(task, 'RC-EXTRA', 40, 45)
  const result = project({ qcs: [root], postTasks: [task], rechecks: [rc], outbounds: [outbound(root, 'OUT-EXTRA', 45, rc)] })
  assert.deepEqual(result.issues, [])
  assert.equal(sum(result, 'post'), 100)
  assert.equal(result.segments.find(segment => segment.id.startsWith('qc:'))?.quantity, 55)
})

test('瑕疵及退回排除；待质检与质检中即使残留结果也不供给', () => {
  const complete = qc('QC-PASS', 80)
  complete.lines[0].expectedQty = 100
  complete.results![0] = { sku, expectedQty: 100, passedQty: 80, defectQty: 12, returnQty: 8 }
  const pending = qc('QC-PENDING'); pending.status = '待质检'
  const inProgress = qc('QC-RUNNING'); inProgress.status = '质检中'
  const result = project({ qcs: [complete, pending, inProgress] })
  assert.equal(sum(result, 'post'), 80)
  assert.deepEqual(result.issues, [])
})

test('QC 已授权实点差异以真实合格量为根，不强制回到原应检数', () => {
  const root = qc('QC-AUTH', 100)
  root.qcAuthorizationId = 'QC-AUTH-1'
  root.results![0].passedQty = 95
  root.results![0].defectQty = 2
  const result = project({ qcs: [root] })
  assert.deepEqual(result.issues, [])
  assert.equal(sum(result, 'post'), 95)
  root.qcAuthorizationId = undefined
  assert.ok(project({ qcs: [root] }).issues.some(issue => issue.code === 'QC_QUANTITY_MISMATCH'))
})

test('多次回货 QC 和所有复检子单分别处理，输入快照保持不变', () => {
  const first = qc('QC-1', 100); const second = qc('QC-2', 50)
  const task = post(first)
  const r1 = recheck(task, 'RC-1', 20); const r2 = recheck(task, 'RC-2', 30)
  const input = { qcs: [first, second], postTasks: [task], rechecks: [r1, r2], outbounds: [], receipts: [] }
  const original = JSON.stringify(input)
  const result = project(input)
  assert.deepEqual(result.issues, [])
  assert.equal(sum(result, 'post'), 150)
  assert.equal(JSON.stringify(input), original)
})

test('重复实收单不重复库存，已接收入库缺少实收单必须核对', () => {
  const root = qc('QC-1', 40); const order = outbound(root, 'OUT-1', 40); const receipt = receive(order)
  let result = project({ qcs: [root], outbounds: [order], receipts: [receipt, { ...receipt, receiptId: 'REC-SECOND' }] })
  assert.equal(sum(result, 'warehouse'), 0)
  assert.ok(result.issues.some(issue => issue.code === 'DUPLICATE_RECEIPT'))
  result = project({ qcs: [root], outbounds: [order] })
  assert.ok(result.issues.some(issue => issue.code === 'MISSING_RECEIPT'))
  assert.equal(sum(result, 'post') + sum(result, 'warehouse'), 0)
})

test('实收与出货数量、状态或 SKU 矛盾时不能当正常库存', () => {
  const root = qc('QC-1', 40); const order = outbound(root, 'OUT-1', 40); const receipt = receive(order)
  receipt.lines[0].receivedQty = 39
  let result = project({ qcs: [root], outbounds: [order], receipts: [receipt] })
  assert.ok(result.issues.some(issue => issue.code === 'RECEIPT_MISMATCH'))
  assert.equal(sum(result, 'warehouse'), 0)
  receipt.lines[0].receivedQty = 40; order.status = '待仓库接收'
  result = project({ qcs: [root], outbounds: [order], receipts: [receipt] })
  assert.ok(result.issues.some(issue => issue.code === 'RECEIPT_STATUS_CONFLICT'))
})

test('缺父级、错误生产单关系、重复子出货都报告关系错误', () => {
  const root = qc(); const task = post(root); const rc = recheck(task, 'RC-1', 40, 40)
  let result = project({ qcs: [root], rechecks: [rc] })
  assert.ok(result.issues.some(issue => issue.code === 'MISSING_PARENT'))
  const order = outbound(root, 'OUT-1', 40, rc)
  order.productionOrderNo = 'P-WRONG'
  result = project({ qcs: [root], postTasks: [task], rechecks: [rc], outbounds: [order] })
  assert.ok(result.issues.some(issue => issue.code === 'PARENT_MISMATCH'))
  order.productionOrderNo = root.productionOrderNo
  result = project({ qcs: [root], postTasks: [task], rechecks: [rc], outbounds: [order, { ...order, outboundOrderId: 'OUT-2', outboundOrderNo: 'OUT-2' }] })
  assert.ok(result.issues.some(issue => issue.code === 'DUPLICATE_CHILD'))
  assert.ok(sum(result, 'post') <= 100)
})

test('预留超过 QC 合格量、重复 SKU、非整数数量均报告核对', () => {
  const root = qc('QC-1', 50); const task = post(root)
  let result = project({ qcs: [root], postTasks: [task], rechecks: [recheck(task, 'RC-1', 30), recheck(task, 'RC-2', 30)] })
  assert.ok(result.issues.some(issue => issue.code === 'OVER_RESERVED'))
  root.results!.push({ ...root.results![0] })
  result = project({ qcs: [root] })
  assert.ok(result.issues.some(issue => issue.code === 'DUPLICATE_SKU'))
  root.results = [{ ...root.results![0], passedQty: 1.5 }]
  result = project({ qcs: [root] })
  assert.ok(result.issues.some(issue => issue.code === 'INVALID_QUANTITY'))
  assert.equal(result.segments.length, 0)
})

test('未完成复检不能有子出货；完成复检缺交出数量或子出货量不一致需核对', () => {
  const root = qc(); const task = post(root); const rc = recheck(task, 'RC-1', 40)
  const order = outbound(root, 'OUT-1', 40, rc)
  let result = project({ qcs: [root], postTasks: [task], rechecks: [rc], outbounds: [order] })
  assert.ok(result.issues.some(issue => issue.code === 'CHILD_STATUS_CONFLICT'))
  rc.status = '复检完成'
  result = project({ qcs: [root], postTasks: [task], rechecks: [rc], outbounds: [order] })
  assert.ok(result.issues.some(issue => issue.code === 'MISSING_HANDOVER'))
  rc.lines[0].handoverQty = 39
  result = project({ qcs: [root], postTasks: [task], rechecks: [rc], outbounds: [order] })
  assert.ok(result.issues.some(issue => issue.code === 'OUTBOUND_MISMATCH'))
})

test('相同业务单号不同内部编号也不是两批，重复交接操作不得重复供给', () => {
  const root = qc(); const task = post(root)
  const first = recheck(task, 'RC-1', 40)
  const duplicate = recheck(task, 'RC-2', 40)
  duplicate.recheckOrderNo = first.recheckOrderNo
  let result = project({ qcs: [root], postTasks: [task], rechecks: [first, duplicate] })
  assert.ok(result.issues.some(issue => issue.code === 'DUPLICATE_RECORD'))
  assert.ok(sum(result, 'post') <= 100)
  duplicate.recheckOrderNo = 'RC-2'
  first.operationId = 'SAME-HANDOVER'; duplicate.operationId = first.operationId
  result = project({ qcs: [root], postTasks: [task], rechecks: [first, duplicate] })
  assert.ok(result.issues.some(issue => issue.code === 'DUPLICATE_CHILD'))
})

test('负数、未知 SKU、未授权实收差异以及未知状态不能生成正常结论', () => {
  const root = qc('QC-1', 40); const order = outbound(root, 'OUT-1', 40)
  order.lines[0].outboundQty = -1
  let result = project({ qcs: [root], outbounds: [order] })
  assert.ok(result.issues.some(issue => issue.code === 'INVALID_QUANTITY'))
  assert.ok(result.segments.every(segment => segment.quantity >= 0 && Number.isInteger(segment.quantity)))
  order.lines[0].outboundQty = 40
  const receipt = receive(order, 38); receipt.authorizationId = undefined
  result = project({ qcs: [root], outbounds: [order], receipts: [receipt] })
  assert.ok(result.issues.some(issue => issue.code === 'UNCONFIRMED_RECEIPT_DIFFERENCE'))
  assert.equal(sum(result, 'warehouse'), 0)
  receipt.authorizationId = 'AUTH'; receipt.lines[0].sku = { ...sku, skuId: 'WRONG' }
  result = project({ qcs: [root], outbounds: [order], receipts: [receipt] })
  assert.ok(result.issues.some(issue => issue.code === 'RECEIPT_MISMATCH'))
  root.status = '未知' as PostFinishingQcTask['status']
  result = project({ qcs: [root] })
  assert.ok(result.issues.some(issue => issue.code === 'INVALID_STATUS'))
  assert.equal(result.segments.length, 0)
})

test('合并兼容：当前直接出货可分两批且待出货仍在后道，抽检未抽随批放行不丢失',()=>{
 const root=qc('QC-DIRECT',100)
 Object.assign(root.results![0],{passedQty:30,releasedQty:100,uninspectedQty:70,inspectedQty:30})
 const task=post(root);task.executionModel='ITEMS_V1';task.lines[0].expectedQty=100
 const first=outbound(root,'DIRECT-A',40),second=outbound(root,'DIRECT-B',20)
 for(const order of[first,second])Object.assign(order,{postTaskId:task.postTaskId,postTaskNo:task.postTaskNo,sourceType:'后道加工后',executionModel:'DIRECT_V2',status:'待出货'})
 let result=project({qcs:[root],postTasks:[task],outbounds:[first,second]})
 assert.deepEqual(result.issues,[]);assert.equal(result.segments.reduce((n,r)=>n+r.quantity,0),100)
 assert.equal(result.segments.filter(r=>r.outboundOrderId).reduce((n,r)=>n+r.quantity,0),60)
 first.status='已接收入库';first.lines[0].receivedQty=40
 const actual=receive(first,40)
 result=project({qcs:[root],postTasks:[task],outbounds:[first,second],receipts:[actual]})
 assert.deepEqual(result.issues,[]);assert.equal(result.segments.filter(r=>r.position==='warehouse').reduce((n,r)=>n+r.quantity,0),40)
 assert.equal(result.segments.reduce((n,r)=>n+r.quantity,0),100)
})
