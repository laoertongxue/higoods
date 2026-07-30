import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  addWoolHandover,
  addWoolProcessReport,
  addWoolYarnReceipt,
  adjustWoolWarehouseStock,
  completeWoolWorkOrder,
  getWoolOutputHandoverAvailableQty,
  getWoolOutputReadiness,
  getWoolProcessingStatus,
  getWoolWarehouseStock,
  issueWoolYarn,
  listWoolWarehouseFlows,
  listWoolWorkOrders,
  readWoolStore,
  resetWoolFactWorkflowMock,
  returnWoolYarn,
  transferWoolWarehouseStock,
} from '../src/data/fcs/wool-task-domain.ts'
import {
  renderCraftWoolWaitHandoverWarehousePage,
  renderCraftWoolWaitProcessWarehousePage,
} from '../src/pages/process-factory/wool/warehouse.ts'
import { appStore } from '../src/state/store.ts'

const warehouseSource = readFileSync(
  new URL('../src/pages/process-factory/wool/warehouse.ts', import.meta.url),
  'utf8',
)
const handlersSource = readFileSync(
  new URL('../src/main-handlers/fcs-handlers.ts', import.meta.url),
  'utf8',
)

for (const locationId of [
  'WOOL-WP-YARN-DEFAULT',
  'WOOL-WH-CUT-DEFAULT',
  'WOOL-WH-GARMENT-DEFAULT',
]) {
  assert(warehouseSource.includes(locationId), `毛织 Web 仓库必须固定展示 ${locationId}`)
}
for (const removedText of [
  '库区管理',
  '库位管理',
  '完工入仓',
  '损耗回收',
  '加工领料',
  '回收入仓',
  '交出确认',
  'listWoolWarehouseAreas',
  'listWoolWarehouseLocations',
  'WoolWarehouseArea',
  'WoolWarehouseLocation',
  'WoolYarnRecoveryRecord',
  'recordWoolYarnRecovery',
]) {
  assert(!warehouseSource.includes(removedText), `毛织 Web 仓库不得保留旧模型：${removedText}`)
}
for (const requiredText of [
  '// @page-pattern: list',
  'renderStandardListPage',
  'renderStandardListTable',
  'renderTablePagination',
  '纱线领用',
  '纱线退回',
  '库存调整',
  '库存转移',
  '已完成加工单剩余库存',
  'data-skip-page-rerender="true"',
  'handleCraftWoolWarehouseEvent',
]) {
  assert(warehouseSource.includes(requiredText), `毛织 Web 仓库缺少新事实入口：${requiredText}`)
}
assert(handlersSource.includes('handleCraftWoolWarehouseEvent'), 'FCS 事件分发必须接入毛织仓库局部事件')

resetWoolFactWorkflowMock('CHECK_TASK_11_WAREHOUSE')
const issueOrder = listWoolWorkOrders()
  .find((order) => order.mockScenarioCode === 'YARN_ISSUE_RETURN')!
const yarnStockKey = {
  woolOrderId: issueOrder.woolOrderId,
  objectSkuCode: 'YARN-A',
  batchNo: 'BATCH-AB',
  defaultLocationId: 'WOOL-WP-YARN-DEFAULT' as const,
}
const readinessBeforeIssue = getWoolOutputReadiness(
  issueOrder.woolOrderId,
  issueOrder.outputPlanLines[0].outputSkuCode,
)
const statusBeforeIssue = getWoolProcessingStatus(issueOrder.woolOrderId)
const stockBeforeIssue = getWoolWarehouseStock(yarnStockKey)
const issue = issueWoolYarn(issueOrder.woolOrderId, {
  commandId: 'CHECK-T11-ISSUE-001',
  yarnSkuCode: 'YARN-A',
  batchNo: 'BATCH-AB',
  issuedQty: 0.1,
  issuedAt: '2026-07-31 10:00:00',
  issuedBy: '毛织仓管',
})
assert.equal(getWoolWarehouseStock(yarnStockKey), stockBeforeIssue - 0.1)
assert.deepEqual(
  getWoolOutputReadiness(issueOrder.woolOrderId, issueOrder.outputPlanLines[0].outputSkuCode),
  readinessBeforeIssue,
  '纱线领用不得改变齐料事实',
)
assert.equal(getWoolProcessingStatus(issueOrder.woolOrderId), statusBeforeIssue)
assert.deepEqual(
  issueWoolYarn(issueOrder.woolOrderId, {
    commandId: 'CHECK-T11-ISSUE-001',
    yarnSkuCode: 'YARN-A',
    batchNo: 'BATCH-AB',
    issuedQty: 0.1,
    issuedAt: '2026-07-31 10:00:00',
    issuedBy: '毛织仓管',
  }),
  issue,
  '相同领用命令重试必须幂等',
)

const returned = returnWoolYarn(issueOrder.woolOrderId, {
  commandId: 'CHECK-T11-RETURN-001',
  yarnSkuCode: 'YARN-A',
  batchNo: 'BATCH-AB',
  returnedQty: 0.1,
  returnedAt: '2026-07-31 10:05:00',
  returnedBy: '毛织仓管',
})
assert.equal(returned.batchNo, 'BATCH-AB')
assert.equal(getWoolWarehouseStock(yarnStockKey), stockBeforeIssue)
assert.deepEqual(
  getWoolOutputReadiness(issueOrder.woolOrderId, issueOrder.outputPlanLines[0].outputSkuCode),
  readinessBeforeIssue,
  '纱线退回不得改变齐料事实',
)
const afterLegalReturn = JSON.stringify(readWoolStore())
assert.throws(
  () => returnWoolYarn(issueOrder.woolOrderId, {
    commandId: 'CHECK-T11-RETURN-OVER',
    yarnSkuCode: 'YARN-A',
    batchNo: 'BATCH-AB',
    returnedQty: 99,
    returnedAt: '2026-07-31 10:06:00',
    returnedBy: '毛织仓管',
  }),
  /累计退回不能超过累计领用/,
)
assert.equal(JSON.stringify(readWoolStore()), afterLegalReturn, '超退回失败必须保持 store 零写')

const otherOrder = listWoolWorkOrders()
  .find((order) =>
    order.woolOrderId !== issueOrder.woolOrderId
    && order.outputPlanLines.some((line) => line.requiredYarnSkus.includes('YARN-A')),
  )!
const beforeCrossOrderReturn = JSON.stringify(readWoolStore())
assert.throws(
  () => returnWoolYarn(otherOrder.woolOrderId, {
    commandId: 'CHECK-T11-RETURN-CROSS-ORDER',
    yarnSkuCode: 'YARN-A',
    batchNo: 'BATCH-AB',
    returnedQty: 0.1,
    returnedAt: '2026-07-31 10:07:00',
    returnedBy: '毛织仓管',
  }),
  /累计退回不能超过累计领用/,
)
assert.equal(JSON.stringify(readWoolStore()), beforeCrossOrderReturn, '跨单退回失败必须零写')

const wholeOrder = listWoolWorkOrders()
  .find((order) => order.mockScenarioCode === 'FIXED_LOCATION_UI' && order.kind === 'WHOLE_GARMENT')!
const panelOrder = listWoolWorkOrders()
  .find((order) => order.mockScenarioCode === 'FIXED_LOCATION_UI' && order.kind === 'PART_PANEL')!
assert(
  listWoolWarehouseFlows({
    woolOrderId: wholeOrder.woolOrderId,
    sourceRecordType: 'PROCESS_REPORT',
  }).every((flow) => flow.defaultLocationId === 'WOOL-WH-GARMENT-DEFAULT'),
  '整件毛织填报必须进入成衣默认库位',
)
assert(
  listWoolWarehouseFlows({
    woolOrderId: panelOrder.woolOrderId,
    sourceRecordType: 'PROCESS_REPORT',
  }).every((flow) => flow.defaultLocationId === 'WOOL-WH-CUT-DEFAULT'),
  '部位毛织填报必须进入裁片默认库位',
)

const transferLine = wholeOrder.outputPlanLines[0]
const stockKey = {
  woolOrderId: wholeOrder.woolOrderId,
  objectSkuCode: transferLine.outputSkuCode,
  defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT' as const,
}
const availableBeforeTransfer = getWoolOutputHandoverAvailableQty(
  wholeOrder.woolOrderId,
  transferLine.outputSkuCode,
)
transferWoolWarehouseStock({
  commandId: 'CHECK-T11-TRANSFER-OUT',
  ...stockKey,
  toWarehouseId: 'FIW-OWN_WOOL_FACTORY-WAIT_HANDOVER',
  toLocationId: 'LOC-A-01-01',
  qty: 2,
  reason: '调拨到公共仓库暂存',
  operatedAt: '2026-07-31 10:10:00',
  operatedBy: '毛织仓管',
})
assert.equal(
  getWoolOutputHandoverAvailableQty(wholeOrder.woolOrderId, transferLine.outputSkuCode),
  availableBeforeTransfer - 2,
  '转出默认库位后必须减少逐 SKU 可交出余额',
)
transferWoolWarehouseStock({
  commandId: 'CHECK-T11-TRANSFER-BACK',
  ...stockKey,
  fromWarehouseId: 'FIW-OWN_WOOL_FACTORY-WAIT_HANDOVER',
  fromLocationId: 'LOC-A-01-01',
  toWarehouseId: 'WOOL-WAIT-HANDOVER',
  toLocationId: 'WOOL-WH-GARMENT-DEFAULT',
  qty: 1,
  reason: '退回毛织默认库位',
  operatedAt: '2026-07-31 10:11:00',
  operatedBy: '毛织仓管',
})
assert.equal(
  getWoolOutputHandoverAvailableQty(wholeOrder.woolOrderId, transferLine.outputSkuCode),
  availableBeforeTransfer - 1,
  '转回默认库位后可重新参与交出，但仍受逐 SKU 未交出填报余额限制',
)
const availableBeforeAdjustment = getWoolOutputHandoverAvailableQty(
  wholeOrder.woolOrderId,
  transferLine.outputSkuCode,
)
adjustWoolWarehouseStock({
  commandId: 'CHECK-T11-ADJUST-UP',
  ...stockKey,
  afterQty: 500,
  reason: '盘点差异',
  operatedAt: '2026-07-31 10:12:00',
  operatedBy: '毛织仓管',
})
assert.equal(
  getWoolOutputHandoverAvailableQty(wholeOrder.woolOrderId, transferLine.outputSkuCode),
  availableBeforeAdjustment + 1,
  '库存调高只能补回已转出的 1 件，不能越过累计填报减累计交出余额',
)

const emptyOrder = listWoolWorkOrders()
  .find((order) => order.mockScenarioCode === 'NO_YARN_RECEIPT')!
const emptyLine = emptyOrder.outputPlanLines[0]
adjustWoolWarehouseStock({
  commandId: 'CHECK-T11-ADJUST-NO-REPORT',
  woolOrderId: emptyOrder.woolOrderId,
  objectSkuCode: emptyLine.outputSkuCode,
  defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT',
  afterQty: 5,
  reason: '盘点发现库存',
  operatedAt: '2026-07-31 10:13:00',
  operatedBy: '毛织仓管',
})
assert.equal(
  getWoolOutputHandoverAvailableQty(emptyOrder.woolOrderId, emptyLine.outputSkuCode),
  0,
  '独立库存调整不得绕过加工填报事实形成可交出余额',
)
const noReportSnapshot = JSON.stringify(readWoolStore())
assert.throws(
  () => addWoolHandover(emptyOrder.woolOrderId, {
    commandId: 'CHECK-T11-HANDOVER-NO-REPORT',
    outputSkuCode: emptyLine.outputSkuCode,
    handoverQty: 1,
    handedOverAt: '2026-07-31 10:14:00',
    handedOverBy: '毛织仓管',
  }),
  /尚无有效加工填报|没有可交出余额/,
)
assert.equal(JSON.stringify(readWoolStore()), noReportSnapshot, '无填报交出失败必须零写')

const completeOrder = listWoolWorkOrders()
  .find((order) => order.mockScenarioCode === 'READY_TO_COMPLETE')!
completeWoolWorkOrder(completeOrder.woolOrderId, {
  commandId: 'CHECK-T11-COMPLETE',
  completedAt: '2026-07-31 10:20:00',
  completedBy: '毛织主管',
})
const completedSnapshot = JSON.stringify(readWoolStore())
assert.throws(
  () => issueWoolYarn(completeOrder.woolOrderId, {
    commandId: 'CHECK-T11-COMPLETED-ISSUE',
    yarnSkuCode: 'YARN-A',
    issuedQty: 0.1,
    issuedAt: '2026-07-31 10:21:00',
    issuedBy: '毛织仓管',
  }),
  /已完成/,
)
assert.equal(JSON.stringify(readWoolStore()), completedSnapshot, '已完成加工单领用失败必须零写')

appStore.navigate('/fcs/craft/wool/wait-process-warehouse')
const waitProcessHtml = renderCraftWoolWaitProcessWarehousePage()
for (const label of [
  '毛织待加工仓',
  'WOOL-WP-YARN-DEFAULT',
  '纱线领用',
  '纱线退回',
  '确认接收入库',
  '库存调整',
  '库存转移',
]) {
  assert(waitProcessHtml.includes(label), `待加工仓渲染缺少：${label}`)
}
assert(waitProcessHtml.includes('data-standard-list-scroll'))
assert(waitProcessHtml.includes('列设置'))

appStore.navigate('/fcs/craft/wool/wait-handover-warehouse')
const waitHandoverHtml = renderCraftWoolWaitHandoverWarehousePage()
for (const label of [
  '毛织待交出仓',
  'WOOL-WH-CUT-DEFAULT',
  'WOOL-WH-GARMENT-DEFAULT',
  '库存',
  '入库',
  '出库',
  '调整',
  '转移',
  '已完成加工单剩余库存',
]) {
  assert(waitHandoverHtml.includes(label), `待交出仓渲染缺少：${label}`)
}
for (const html of [waitProcessHtml, waitHandoverHtml]) {
  assert(!html.includes('完工入仓'))
  assert(!html.includes('交出确认'))
  assert(!html.includes('库区管理'))
  assert(!html.includes('库位管理'))
}

console.log('PASS task 11: wool Web warehouses use fixed locations and atomic fact flows')
