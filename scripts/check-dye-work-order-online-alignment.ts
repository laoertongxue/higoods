import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  confirmDyeReceipt,
  getDyeWorkOrderById,
  getDyeReviewRecordByOrderId,
  getDyeOrderHandoverSummary,
  listDyeExecutionNodeRecords,
  listDyeWorkOrders,
  registerFormalProductionOrderDyeWorkOrder,
} from '../src/data/fcs/dyeing-task-domain.ts'
import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'
import {
  advanceDyeWorkOrderOnlineStatus,
  assertDyeWorkOrderOnlineActionAllowed,
  getDyeWorkOrderOnlineRecord,
  isDyeWorkOrderHighRiskStatusChange,
  listDyeWorkOrderOnlineLogs,
  recordDyeWorkOrderPdaStart,
  updateDyeWorkOrderFromPfos,
} from '../src/data/fcs/dye-work-order-online-domain.ts'
import { listBusinessFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import {
  buildDyeWorkOrderCsv,
  filterDyeWorkOrderOnlineRows,
  getDyeWorkOrderOnlineSummary,
  listDyeWorkOrderOnlineRows,
} from '../src/data/fcs/dye-work-order-online-view.ts'
import { buildDyeingWorkOrderDetailLink } from '../src/data/fcs/fcs-route-links.ts'
import { renderDyeWorkOrderOverlay } from '../src/pages/process-factory/dyeing/work-order-overlays.ts'
import {
  buildDyeWorkOrderFlowCardPrintDocument,
  renderDyeWorkOrderFlowCardTemplate,
} from '../src/pages/print/templates/dye-work-order-flow-card-template.ts'

const seededOrders = listDyeWorkOrders()
const seededRows = listDyeWorkOrderOnlineRows()
const seededRowsById = new Map(seededRows.map((row) => [row.dyeOrderId, row]))

for (const seededOrder of seededOrders) {
  const row = seededRowsById.get(seededOrder.dyeOrderId)
  assert(row, `可见加工单缺少列表行：${seededOrder.dyeOrderId}`)
  const online = getDyeWorkOrderOnlineRecord(seededOrder.dyeOrderId)
  const nodes = listDyeExecutionNodeRecords(seededOrder.dyeOrderId)
  const handover = getDyeOrderHandoverSummary(seededOrder.dyeOrderId)
  const review = getDyeReviewRecordByOrderId(seededOrder.dyeOrderId)

  if (online.status === '染色中') {
    assert(online.rawMaterialQty > 0, `${seededOrder.dyeOrderId} 染色中必须存在实际投入`)
  }
  if (['染色完成', '待审核', '部分入库', '已完成'].includes(online.status)) {
    assert(online.rawMaterialQty > 0, `${seededOrder.dyeOrderId} 已完成染色节点必须存在实际投入`)
    assert(online.completedQty > 0, `${seededOrder.dyeOrderId} 已完成染色节点必须存在实际产出`)
    assert.equal(
      online.lossQty,
      Number((online.rawMaterialQty - online.completedQty).toFixed(2)),
      `${seededOrder.dyeOrderId} 损耗必须等于实际投入减实际产出`,
    )
  }
  if (handover.submittedQty > 0) {
    assert(online.completedQty >= handover.submittedQty, `${seededOrder.dyeOrderId} 交出数量不得超过实际产出`)
  }
  if (review) {
    assert(review.receivedQty <= handover.submittedQty, `${seededOrder.dyeOrderId} 累计实收不得超过交出数量`)
  }
  if (online.status === '部分入库') {
    assert(review && review.receivedQty > 0, `${seededOrder.dyeOrderId} 部分入库必须已有实收数量`)
    assert(review.receivedQty < handover.submittedQty, `${seededOrder.dyeOrderId} 部分入库必须仍有未收数量`)
    assert.equal(row.pendingInboundQty, Number((handover.submittedQty - review.receivedQty).toFixed(2)), `${seededOrder.dyeOrderId} 待入库数量口径错误`)
  }
  if (online.status === '已完成') {
    assert(review, `${seededOrder.dyeOrderId} 已完成必须存在收货事实`)
    assert.equal(review.receivedQty, handover.submittedQty, `${seededOrder.dyeOrderId} 已完成必须足额收货`)
    assert.equal(row.pendingInboundQty, 0, `${seededOrder.dyeOrderId} 已完成不得仍有待入库数量`)
  }
  if (['等待处理', '取消'].includes(online.status) && nodes.length === 0) {
    assert.equal(online.rawMaterialQty, 0, `${seededOrder.dyeOrderId} 未执行不得出现实际投入`)
    assert.equal(online.completedQty, 0, `${seededOrder.dyeOrderId} 未执行不得出现实际产出`)
  }
}

const seededTasks = listPdaGenericProcessTasks()
assert(seededRows.some((row) => !row.factoryId && row.status === '等待处理'), 'Mock 必须覆盖待分配工厂')
assert(seededRows.some((row) => row.factoryId && !getDyeWorkOrderOnlineRecord(row.dyeOrderId).accepted && row.status === '等待处理'), 'Mock 必须覆盖已分配待接单')
assert(seededRows.some((row) => row.factoryId && getDyeWorkOrderOnlineRecord(row.dyeOrderId).accepted && row.status === '等待处理'), 'Mock 必须覆盖已接单待开工')
assert(seededRows.some((row) => row.status === '染色中'), 'Mock 必须覆盖染色中')
assert(seededRows.some((row) => row.isReplenishment && row.status === '染色中'), 'Mock 必须覆盖补料染色中')
assert(seededRows.some((row) => row.status === '染色完成'), 'Mock 必须覆盖染色完成待交出')
assert(seededRows.some((row) => row.status === '待审核'), 'Mock 必须覆盖已交出待审核')
assert(seededRows.some((row) => row.status === '部分入库'), 'Mock 必须覆盖部分入库')
assert(seededRows.some((row) => row.status === '取消'), 'Mock 必须覆盖取消并保留历史')
assert(seededRows.some((row) => row.status === '已完成'), 'Mock 必须覆盖足额入库完成')
assert(seededRows.some((row) => row.sourceType === 'STOCK' && !row.productionOrderNo), 'Mock 必须覆盖不伪造生产单号的备货创建')
assert(seededRows.some((row) => row.isOverdue && !['取消', '已完成'].includes(row.status)), 'Mock 必须覆盖超期未完结')
assert(seededRows.some((row) => row.dyeOrderId.startsWith('DYE-WATER-')), 'Mock 必须覆盖含水溶加工单')
assert(seededRows.some((row) => row.dyeOrderId.startsWith('DYE-COMBINED-DEMO-')), 'Mock 必须覆盖合并染色成员加工单')

const businessFactories = listBusinessFactoryMasterRecords({ includeTestFactories: true })
for (const row of seededRows.filter((item) => item.sourceType === 'STOCK' && item.factoryId)) {
  const factory = businessFactories.find((item) => item.id === row.factoryId)
  assert(factory, `${row.dyeOrderId} 备货染色单分配的工厂必须存在于工厂主数据`)
  assert(
    factory.factoryType === 'CENTRAL_DYE' || factory.processAbilities.some((ability) => ability.processCode === 'DYE'),
    `${row.dyeOrderId} 备货染色单只能分配给具备染色能力的工厂`,
  )
}

for (const row of seededRows.filter((item) => !item.factoryId)) {
  const task = seededTasks.find((item) => item.taskId === row.taskNo)
  assert(!task?.assignedFactoryId, `${row.dyeOrderId} 待分配工厂不得在 PDA 保留旧工厂归属`)
  assert.equal(getDyeWorkOrderOnlineRecord(row.dyeOrderId).accepted, false, `${row.dyeOrderId} 待分配工厂不得存在接单事实`)
}

const order = listDyeWorkOrders().find((item) => getDyeWorkOrderOnlineRecord(item.dyeOrderId).status === '等待处理')
assert(order, '至少需要一张等待处理的染色加工单')

const initial = getDyeWorkOrderOnlineRecord(order.dyeOrderId)
assert.equal(initial.status, '等待处理')

advanceDyeWorkOrderOnlineStatus(order.dyeOrderId, {
  action: '接单',
  operatorName: '染厂操作员',
  operatedAt: '2026-07-16 08:00:00',
  source: 'PDA',
})
assert.equal(getDyeWorkOrderOnlineRecord(order.dyeOrderId).status, '等待处理')

advanceDyeWorkOrderOnlineStatus(order.dyeOrderId, {
  action: '开工',
  operatorName: '染厂操作员',
  operatedAt: '2026-07-16 08:10:00',
  source: 'PDA',
})
assert.equal(getDyeWorkOrderOnlineRecord(order.dyeOrderId).status, '染色中')

advanceDyeWorkOrderOnlineStatus(order.dyeOrderId, {
  action: '完工',
  operatorName: '染厂操作员',
  operatedAt: '2026-07-16 12:00:00',
  source: 'PDA',
  completedQty: 80,
  lossQty: 3,
})
const completed = getDyeWorkOrderOnlineRecord(order.dyeOrderId)
assert.equal(completed.status, '染色完成')
assert.equal(completed.completedQty, 80)
assert.equal(completed.lossQty, 3)

assert.equal(isDyeWorkOrderHighRiskStatusChange('染色完成', '等待处理'), true)
assert.equal(isDyeWorkOrderHighRiskStatusChange('取消', '等待处理'), true, '从取消恢复必须二次确认')
assert.equal(isDyeWorkOrderHighRiskStatusChange('待审核', '部分入库'), true, '人工改为部分入库必须二次确认')
assert.equal(isDyeWorkOrderHighRiskStatusChange('部分入库', '已完成'), true, '人工改为已完成必须二次确认')
updateDyeWorkOrderFromPfos(order.dyeOrderId, {
  expectedVersion: completed.version,
  operatorName: '染厂主管',
  operatedAt: '2026-07-16 12:10:00',
  status: '等待处理',
  plannedFinishAt: '2026-07-20 18:00:00',
  factoryId: order.dyeFactoryId,
  factoryName: order.dyeFactoryName,
  receiverName: order.receiverName,
  shade: '深色',
  temperature: 205,
  rawMaterialQty: 83,
  rawMaterialRollCount: 2,
  completedQty: 80,
  lossQty: 3,
  remark: '主管回退复核',
})
assert.equal(getDyeWorkOrderOnlineRecord(order.dyeOrderId).status, '等待处理')
assert.throws(
  () => updateDyeWorkOrderFromPfos(order.dyeOrderId, {
    expectedVersion: completed.version,
    operatorName: '染厂主管',
    operatedAt: '2026-07-16 12:11:00',
    status: '取消',
    plannedFinishAt: '2026-07-20 18:00:00',
    factoryId: order.dyeFactoryId,
    factoryName: order.dyeFactoryName,
    receiverName: order.receiverName,
    shade: '深色',
    temperature: 205,
    rawMaterialQty: 83,
    rawMaterialRollCount: 2,
    completedQty: 80,
    lossQty: 3,
    remark: '过期版本',
  }),
  /已被其他操作更新/,
)

const logs = listDyeWorkOrderOnlineLogs(order.dyeOrderId)
assert(logs.some((log) => log.action === 'PFOS人工编辑'))
assert(logs.some((log) => log.action === '开工'))
assert(logs.every((log) => log.workOrderNo === order.dyeOrderNo))

const pdaOrder = listDyeWorkOrders().find((item) => item.dyeOrderId !== order.dyeOrderId && getDyeWorkOrderOnlineRecord(item.dyeOrderId).status === '等待处理')
assert(pdaOrder, '至少需要第二张等待处理的染色加工单验证 PDA 顺序')
assert.throws(
  () => advanceDyeWorkOrderOnlineStatus(pdaOrder.dyeOrderId, {
    action: '开工', operatorName: '操作员', operatedAt: '2026-07-16 08:00:00', source: 'PDA',
  }),
  /请先接单/,
)
advanceDyeWorkOrderOnlineStatus(pdaOrder.dyeOrderId, {
  action: '接单', operatorName: '操作员', operatedAt: '2026-07-16 08:01:00', source: 'PDA',
})
advanceDyeWorkOrderOnlineStatus(pdaOrder.dyeOrderId, {
  action: '开工', operatorName: '操作员', operatedAt: '2026-07-16 08:02:00', source: 'PDA',
})
assert.throws(
  () => advanceDyeWorkOrderOnlineStatus(pdaOrder.dyeOrderId, {
    action: '交出', operatorName: '操作员', operatedAt: '2026-07-16 08:03:00', source: 'PDA',
  }),
  /请先完工/,
)

const cancelledBefore = getDyeWorkOrderOnlineRecord(pdaOrder.dyeOrderId)
updateDyeWorkOrderFromPfos(pdaOrder.dyeOrderId, {
  expectedVersion: cancelledBefore.version,
  operatorName: '染厂主管',
  operatedAt: '2026-07-16 08:04:00',
  status: '取消',
  plannedFinishAt: cancelledBefore.plannedFinishAt,
  factoryId: pdaOrder.dyeFactoryId,
  factoryName: pdaOrder.dyeFactoryName,
  receiverName: pdaOrder.receiverName,
  shade: '',
  temperature: null,
  rawMaterialQty: 0,
  rawMaterialRollCount: 0,
  completedQty: 0,
  lossQty: 0,
  remark: '主管取消后 PDA 必须停止',
})
assert.throws(
  () => assertDyeWorkOrderOnlineActionAllowed(pdaOrder.dyeOrderId, '完工'),
  /已取消.*不能继续操作/,
)

const truthOrder = registerFormalProductionOrderDyeWorkOrder({
  workOrderId: 'DWO-CHECK-TRUTH-001',
  workOrderNo: 'RS-CHECK-TRUTH-001',
  processName: '匹染',
  productionOrderId: 'PO-CHECK-TRUTH-001',
  productionOrderNo: 'PO-CHECK-TRUTH-001',
  orderedAt: '2026-07-16 06:00:00',
  techPackVersionId: 'TP-CHECK-TRUTH-001',
  techPackVersionLabel: 'v1.0',
  materialId: 'FAB-CHECK-TRUTH-001',
  materialName: '真实快照面料',
  targetColor: '深海蓝',
  plannedQty: 100,
  qtyUnit: 'Yard',
  processCodes: ['DYE'],
  dyeProcessName: '匹染',
  factoryId: '',
  factoryName: '待分配工厂',
  spuCode: 'SPU-CHECK-TRUTH-001',
  spuName: '真实快照商品',
  requiredDeliveryDate: '2026-07-22',
})
const truthInitial = getDyeWorkOrderOnlineRecord(truthOrder.dyeOrderId)
const truthInitialTask = listPdaGenericProcessTasks().find((task) => task.taskId === truthOrder.taskId)
assert.equal(truthInitial.status, '等待处理', '待分配工厂与染色执行状态必须分维度')
assert.throws(
  () => advanceDyeWorkOrderOnlineStatus(truthOrder.dyeOrderId, {
    action: '接单', operatorName: '未归属操作员', operatedAt: '2026-07-16 08:50:00', source: 'PDA',
  }),
  /待分配工厂.*不能接单/,
)
assert.equal(truthInitialTask?.acceptanceStatus, 'PENDING', '正式加工单即使已分配工厂，也必须等待 PDA 明确接单')
assert.equal(truthInitial.accepted, false, 'PFOS 接单事实必须与 PDA 任务一致')
const dyeFactory = listBusinessFactoryMasterRecords({ includeTestFactories: true })
  .find((factory) => factory.factoryType === 'CENTRAL_DYE' || factory.processAbilities.some((ability) => ability.processCode === 'DYE'))
assert(dyeFactory, '工厂主数据必须存在可承接染色的工厂')
const unassignedEditHtml = renderDyeWorkOrderOverlay({ type: 'edit', dyeOrderId: truthOrder.dyeOrderId })
assert(unassignedEditHtml.includes(dyeFactory.name), '待分配加工单必须能选择尚未出现在加工单列表中的真实染厂')
updateDyeWorkOrderFromPfos(truthOrder.dyeOrderId, {
  expectedVersion: truthInitial.version,
  operatorName: '业务人员',
  operatedAt: '2026-07-16 09:00:00',
  status: '染色完成',
  plannedFinishAt: '',
  factoryId: 'F090',
  factoryName: '全能力测试工厂',
  receiverName: 'hilon',
  shade: '深色',
  temperature: 205,
  rawMaterialQty: 0,
  rawMaterialRollCount: 0,
  completedQty: 0,
  lossQty: 0,
  remark: '零数量与工厂同步验收',
})
const canonicalTruthOrder = getDyeWorkOrderById(truthOrder.dyeOrderId)
assert.equal(canonicalTruthOrder?.dyeFactoryId, 'F090', 'PFOS 分配工厂必须同步真实染色加工单')
assert.equal(canonicalTruthOrder?.dyeFactoryName, '全能力测试工厂')
const truthTask = listPdaGenericProcessTasks().find((task) => task.taskId === truthOrder.taskId)
assert.equal(truthTask?.assignedFactoryId, 'F090', 'PFOS 分配工厂必须同步 PDA 任务')
assert.equal(truthTask?.assignedFactoryName, '全能力测试工厂')

const reassignmentOrder = registerFormalProductionOrderDyeWorkOrder({
  workOrderId: 'DWO-CHECK-REASSIGN-001',
  workOrderNo: 'RS-CHECK-REASSIGN-001',
  processName: '匹染',
  productionOrderId: 'PO-CHECK-REASSIGN-001',
  productionOrderNo: 'PO-CHECK-REASSIGN-001',
  orderedAt: '2026-07-16 06:30:00',
  techPackVersionId: 'TP-CHECK-REASSIGN-001',
  techPackVersionLabel: 'v1.0',
  materialId: 'FAB-CHECK-REASSIGN-001',
  materialName: '改派验收面料',
  targetColor: '海军蓝',
  plannedQty: 120,
  qtyUnit: 'Yard',
  processCodes: ['DYE'],
  dyeProcessName: '匹染',
  factoryId: 'F090',
  factoryName: '全能力测试工厂',
  spuCode: 'SPU-CHECK-REASSIGN-001',
  spuName: '改派验收商品',
  requiredDeliveryDate: '2026-07-23',
})
advanceDyeWorkOrderOnlineStatus(reassignmentOrder.dyeOrderId, {
  action: '接单', operatorName: '原染厂', operatedAt: '2026-07-16 09:10:00', source: 'PDA',
})
recordDyeWorkOrderPdaStart(reassignmentOrder.taskId, '原染厂', '2026-07-16 09:11:00')
const reassignmentStarted = getDyeWorkOrderOnlineRecord(reassignmentOrder.dyeOrderId)
assert.equal(reassignmentStarted.status, '染色中', 'PDA 通用开工必须立即同步 PFOS 染色中')
updateDyeWorkOrderFromPfos(reassignmentOrder.dyeOrderId, {
  ...reassignmentStarted,
  expectedVersion: reassignmentStarted.version,
  operatorName: '染厂主管',
  operatedAt: '2026-07-16 09:12:00',
  factoryId: dyeFactory.id,
  factoryName: dyeFactory.name,
  remark: '进行中改派新染厂',
})
const reassignedOnline = getDyeWorkOrderOnlineRecord(reassignmentOrder.dyeOrderId)
const reassignedTask = listPdaGenericProcessTasks().find((task) => task.taskId === reassignmentOrder.taskId)
assert.equal(reassignedOnline.status, '染色中', '进行中改派不应伪造执行状态回退')
assert.equal(reassignedOnline.accepted, false, '改派后 PFOS 必须与 PDA 一起重置接单责任')
assert.equal(reassignedTask?.acceptanceStatus, 'PENDING')
advanceDyeWorkOrderOnlineStatus(reassignmentOrder.dyeOrderId, {
  action: '接单', operatorName: '新染厂', operatedAt: '2026-07-16 09:13:00', source: 'PDA',
})
assert.equal(getDyeWorkOrderOnlineRecord(reassignmentOrder.dyeOrderId).status, '染色中')
assert.equal(getDyeWorkOrderOnlineRecord(reassignmentOrder.dyeOrderId).accepted, true)

const receiptOrder = getDyeWorkOrderById('DWO-008')
const receiptReview = getDyeReviewRecordByOrderId('DWO-008')
assert(receiptOrder && receiptReview, '缺少取消后入库原子性验收样本')
const receiptOnline = getDyeWorkOrderOnlineRecord(receiptOrder.dyeOrderId)
updateDyeWorkOrderFromPfos(receiptOrder.dyeOrderId, {
  ...receiptOnline,
  expectedVersion: receiptOnline.version,
  operatorName: '染厂主管',
  operatedAt: '2026-07-16 09:20:00',
  status: '取消',
  remark: '取消后禁止入库',
})
const canonicalBeforeRejectedReceipt = getDyeWorkOrderById(receiptOrder.dyeOrderId)
const reviewBeforeRejectedReceipt = getDyeReviewRecordByOrderId(receiptOrder.dyeOrderId)
assert.throws(
  () => confirmDyeReceipt(receiptOrder.dyeOrderId, { receivedBy: '仓管', receivedQty: receiptReview.submittedQty }),
  /已取消.*不能继续操作/,
)
assert.deepEqual(getDyeWorkOrderById(receiptOrder.dyeOrderId), canonicalBeforeRejectedReceipt, '入库被拒后加工单不得留下部分提交')
assert.deepEqual(getDyeReviewRecordByOrderId(receiptOrder.dyeOrderId), reviewBeforeRejectedReceipt, '入库被拒后收货记录不得留下部分提交')

const truthRow = listDyeWorkOrderOnlineRows().find((row) => row.dyeOrderId === truthOrder.dyeOrderId)
assert(truthRow, '缺少真实快照验收行')
assert.equal(truthRow.rawMaterialQty, 0, '明确填写的原料数量 0 不得回退')
assert.equal(truthRow.rawMaterialRollCount, 0, '明确填写的原料卷数 0 不得回退')
assert.equal(truthRow.completedQty, 0, '明确填写的完成数量 0 不得回退')
assert.equal(truthRow.lossQty, 0, '明确填写的损耗数量 0 不得回退')
assert.equal(truthRow.plannedFinishAt, '', '清空预计完成时间后不得生成虚构日期')
assert.equal(truthRow.productCode, 'SPU-CHECK-TRUTH-001', '商品 SPU 必须来自正式生产单快照')
assert.equal(truthRow.materialName, '真实快照面料', '面料名称必须来自正式生产单快照')
assert.equal('demandNo' in truthRow, false, '染色加工单列表行不得重新引入需求单号')
assert(!/^\d+$/.test(truthRow.purchaseOrderNo), '不得按数组序号伪造采购单号')

for (let index = 0; index < 11; index += 1) {
  const current = getDyeWorkOrderOnlineRecord(truthOrder.dyeOrderId)
  updateDyeWorkOrderFromPfos(truthOrder.dyeOrderId, {
    ...current,
    expectedVersion: current.version,
    operatorName: '染厂主管',
    operatedAt: `2026-07-16 10:${String(index).padStart(2, '0')}:00`,
    remark: `分页日志-${index + 1}`,
  })
}
const logPageOne = renderDyeWorkOrderOverlay({ type: 'logs', dyeOrderId: truthOrder.dyeOrderId, logPage: 1 })
assert(logPageOne.includes('共 12 条'), '日志弹窗必须显示完整历史总数')
assert(logPageOne.includes('data-dye-work-orders-action="next-log-page"'), '超过一页的日志必须可以进入下一页')
const logPageTwo = renderDyeWorkOrderOverlay({ type: 'logs', dyeOrderId: truthOrder.dyeOrderId, logPage: 2 })
assert(logPageTwo.includes('第 2 / 2 页'), '日志弹窗必须支持真实分页')

const rows = listDyeWorkOrderOnlineRows()
assert(rows.length >= 8, '染色加工单线上列表演示数据不足')
assert(rows.every((row) => row.workOrderNo === row.platformWorkOrderNo), '列表只能使用平台加工单号')
assert(rows.some((row) => row.productImageUrl && row.materialImageUrl), '列表需要商品图和面料图')
assert(rows.some((row) => row.status === '部分入库' && row.pendingInboundQty > 0), '列表需要部分入库样本')
assert(rows.some((row) => row.isOverdue && !['取消', '已完成'].includes(row.status)), '列表需要超期未完结样本')

const terminalRow = rows.find((row) => row.status === '已完成')
assert(terminalRow, '列表需要已完成终态样本')
const terminalRecord = getDyeWorkOrderOnlineRecord(terminalRow.dyeOrderId)
assert.throws(
  () => updateDyeWorkOrderFromPfos(terminalRow.dyeOrderId, {
    ...terminalRecord,
    expectedVersion: terminalRecord.version,
    operatorName: '染厂主管',
    operatedAt: '2026-07-16 13:00:00',
    status: '取消',
    remark: '已完成终态不得取消',
  }),
  /已完成.*不能修改状态/,
)

const filtered = filterDyeWorkOrderOnlineRows(rows, { statuses: ['染色中'] })
assert(filtered.length > 0, '列表需要染色中样本')
assert(filtered.every((row) => row.status === '染色中'))
const summary = getDyeWorkOrderOnlineSummary(rows)
assert(summary.plannedQtyByUnit.some((item) => item.unit === 'Yard'))
assert(buildDyeWorkOrderCsv(rows, '备料').startsWith('\uFEFF'))
assert(buildDyeWorkOrderCsv(rows, '超期未完结').includes('平台加工单号'))
assert(!buildDyeWorkOrderCsv(rows, '全部').includes('需求单号'), '染色加工单导出不得展示需求单号')

const workOrdersSource = fs.readFileSync(path.join(process.cwd(), 'src/pages/process-factory/dyeing/work-orders.ts'), 'utf8')
const pdaReceiveSource = fs.readFileSync(path.join(process.cwd(), 'src/pages/pda-task-receive.ts'), 'utf8')
const pdaExecSource = fs.readFileSync(path.join(process.cwd(), 'src/pages/pda-exec-detail.ts'), 'utf8')
const actionWritebackSource = fs.readFileSync(path.join(process.cwd(), 'src/data/fcs/process-action-writeback-service.ts'), 'utf8')
const dyeDomainSource = fs.readFileSync(path.join(process.cwd(), 'src/data/fcs/dyeing-task-domain.ts'), 'utf8')
assert(pdaReceiveSource.includes('recordDyeWorkOrderPdaAcceptance'), 'PDA 确认接单后必须同步染色加工单接单状态')
assert(pdaExecSource.includes('getDyeWorkOrderOnlineRecord'), 'PDA 必须展示与 PFOS 相同的染色加工单状态')
assert(pdaExecSource.includes("action: '开工'"), '含水溶染色直接开工后必须同步线上状态')
;["action: '开工'", "action: '完工'", "action: '交出'"].forEach((text) => {
  assert(actionWritebackSource.includes(text), `染色动作写回缺少线上状态映射：${text}`)
})
assert(dyeDomainSource.includes('notifyDyeReceiptOnlineStatus'), '染色收货确认必须同步部分入库或已完成')
assert(pdaExecSource.includes('recordDyeWorkOrderPdaStart'), 'PDA 顶部确认开工必须同步 PFOS 染色中')
;[
  '查询项', '状态', '销售类型', '生产工厂', '染色工艺', '面料接收人',
  '是否纱线', '是否补料', 'GTG仓是否有库存', '物料类型', '染色色号',
  '成分', '幅宽', '克重', '导出备料数据', '导出超期未完结',
  '批量打印染整生产流程卡', '商品信息', '采购单信息', '原料/面料',
  '属性信息', '时间/加工厂', '附加信息', '查看', '编辑', '日志', '打印流程卡',
].forEach((text) => assert(workOrdersSource.includes(text), `染色加工单列表缺少：${text}`))
;['补料', '多 ', '少 ', '一致', 'isInventoryShortage'].forEach((text) => {
  assert(workOrdersSource.includes(text), `染色加工单列表缺少业务表达：${text}`)
})
assert(workOrdersSource.includes('renderStandardListTable'), '染色加工单列表必须使用标准列表模板')
assert(workOrdersSource.includes("['染色完成', '待审核', '部分入库', '已完成', '取消']"), '染色完成及后续状态不得把损耗误算为待染数量')
assert(workOrdersSource.includes('formatQty(pendingDyeQty(row), row.qtyUnit)'), '列表待染数量必须使用状态感知口径')
;['查看配方', '查看统计'].forEach((text) => assert(!workOrdersSource.includes(text), `单张染色加工单列表不应保留：${text}`))
assert(!workOrdersSource.includes('需求单号'), '染色加工单列表不得展示已删除的需求单号')

assert.equal(buildDyeingWorkOrderDetailLink(order.dyeOrderId), `/fcs/craft/dyeing/work-orders?dyeOrderId=${order.dyeOrderId}`)
const editHtml = renderDyeWorkOrderOverlay({ type: 'edit', dyeOrderId: order.dyeOrderId })
;['预计完成时间', '生产工厂', '面料接收人', '深浅', '温度', '计划数量', '原料数量', '原料卷数', '完成数量', '损耗数量', '备注'].forEach((text) => {
  assert(editHtml.includes(text), `编辑弹窗缺少：${text}`)
})
assert(editHtml.includes('readonly'), '计划数量和平台加工单号必须只读')
assert(!editHtml.includes('染缸执行'))
assert(!editHtml.includes('移动端执行任务引用'))

const flowCard = buildDyeWorkOrderFlowCardPrintDocument(order.dyeOrderId)
assert.equal(flowCard.sourceId, order.dyeOrderId)
const flowCardText = JSON.stringify(flowCard)
;[
  '染整生产流程卡', 'Kartu Alur Produksi Pencelupan dan Penyempurnaan',
  order.dyeOrderNo, '下单日期', '是否加急', '生产单号', '色样备注',
  'No. Warna', 'Bahan baku', 'Kuantitas', 'Formula pencelupan',
  'Pencelupan', 'Penghilangan air', 'Pengeringan', 'Finishing', 'Kemasan',
  '卡序号', '布料样品 SPU', '批号',
].forEach((text) => assert(flowCardText.includes(text), `染整生产流程卡缺少：${text}`))
assert(!flowCardText.includes('工厂加工单号'))
assert(!flowCardText.includes('需求单号'), '染整生产流程卡不得展示已删除的需求单号')
const flowCardHtml = renderDyeWorkOrderFlowCardTemplate(flowCard)
assert(flowCardHtml.includes('print-production-image-card'), '染整生产流程卡必须真正输出色样和商品图片区')
assert(flowCardHtml.includes('print-main-grid'), '染整生产流程卡必须保留三列头部布局')

const highRiskHtml = renderDyeWorkOrderOverlay({
  type: 'edit', dyeOrderId: truthOrder.dyeOrderId, confirmHighRisk: true, targetStatus: '取消',
})
assert(highRiskHtml.includes('染色完成 → 取消'), '高风险确认必须展示原状态和目标状态')
assert(highRiskHtml.includes('会影响 PDA 当前可执行动作'), '高风险确认必须说明 PDA 动作影响')

console.log('dye work order online alignment check passed')
