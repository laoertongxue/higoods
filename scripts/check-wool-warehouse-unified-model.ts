import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  addWoolHandover,
  addWoolProcessReport,
  addWoolYarnReceipt,
  adjustWoolWarehouseStock,
  changeWoolFactQty,
  completeWoolWorkOrder,
  getWoolOutputHandoverAvailableQty,
  getWoolOutputReadiness,
  getWoolProcessingStatus,
  getWoolWarehouseStock,
  issueWoolYarn,
  listWoolYarnReceiptLineTraces,
  listWoolWarehouseFlows,
  listWoolWorkOrders,
  readWoolStore,
  replaceWoolStore,
  resetWoolFactWorkflowMock,
  returnWoolYarn,
  transferWoolWarehouseStock,
  WOOL_WAIT_HANDOVER_WAREHOUSE_ID,
  WOOL_WAIT_PROCESS_WAREHOUSE_ID,
} from '../src/data/fcs/wool-task-domain.ts'
import {
  listFactoryInternalWarehouses,
  resolveEnabledFactoryWarehouseLocation,
} from '../src/data/fcs/factory-internal-warehouse-locations.ts'
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
const publicWarehouses = listFactoryInternalWarehouses()
  .filter((warehouse) => warehouse.isEnabled)
const publicTarget = publicWarehouses
  .flatMap((warehouse) => warehouse.areaList.flatMap((area) =>
    area.shelfList.flatMap((shelf) =>
      shelf.locationList.map((location) => ({ warehouse, location })),
    ),
  ))
  .find(({ warehouse, location }) =>
    resolveEnabledFactoryWarehouseLocation(warehouse.warehouseId, location.locationId),
  )!
const sameLocationOtherWarehouse = publicWarehouses.find((warehouse) =>
  warehouse.warehouseId !== publicTarget.warehouse.warehouseId
  && resolveEnabledFactoryWarehouseLocation(warehouse.warehouseId, publicTarget.location.locationId),
)!
const availableBeforeTransfer = getWoolOutputHandoverAvailableQty(
  wholeOrder.woolOrderId,
  transferLine.outputSkuCode,
)
const transferOut = transferWoolWarehouseStock({
  commandId: 'CHECK-T11-TRANSFER-OUT',
  ...stockKey,
  fromWarehouseId: WOOL_WAIT_HANDOVER_WAREHOUSE_ID,
  fromLocationId: 'WOOL-WH-GARMENT-DEFAULT',
  toWarehouseId: publicTarget.warehouse.warehouseId,
  toLocationId: publicTarget.location.locationId,
  qty: 2,
  reason: '调拨到公共仓库暂存',
  operatedAt: '2026-07-31 10:10:00',
  operatedBy: '毛织仓管',
})
assert.equal(transferOut.fromWarehouseId, WOOL_WAIT_HANDOVER_WAREHOUSE_ID)
assert.equal(transferOut.fromLocationId, 'WOOL-WH-GARMENT-DEFAULT')
assert.equal(transferOut.toWarehouseId, publicTarget.warehouse.warehouseId)
assert.equal(transferOut.toLocationId, publicTarget.location.locationId)
assert.equal(
  getWoolOutputHandoverAvailableQty(wholeOrder.woolOrderId, transferLine.outputSkuCode),
  availableBeforeTransfer - 2,
  '转出默认库位后必须减少逐 SKU 可交出余额',
)
transferWoolWarehouseStock({
  commandId: 'CHECK-T11-TRANSFER-OUT-SAME-LOCATION-OTHER-WAREHOUSE',
  ...stockKey,
  fromWarehouseId: WOOL_WAIT_HANDOVER_WAREHOUSE_ID,
  fromLocationId: 'WOOL-WH-GARMENT-DEFAULT',
  toWarehouseId: sameLocationOtherWarehouse.warehouseId,
  toLocationId: publicTarget.location.locationId,
  qty: 1,
  reason: '同库位编号转入另一公共仓库',
  operatedAt: '2026-07-31 10:10:30',
  operatedBy: '毛织仓管',
})
const transferBack = transferWoolWarehouseStock({
  commandId: 'CHECK-T11-TRANSFER-BACK',
  ...stockKey,
  fromWarehouseId: publicTarget.warehouse.warehouseId,
  fromLocationId: publicTarget.location.locationId,
  toWarehouseId: WOOL_WAIT_HANDOVER_WAREHOUSE_ID,
  toLocationId: 'WOOL-WH-GARMENT-DEFAULT',
  qty: 1,
  reason: '退回毛织默认库位',
  operatedAt: '2026-07-31 10:11:00',
  operatedBy: '毛织仓管',
})
assert.equal(transferBack.fromWarehouseId, publicTarget.warehouse.warehouseId)
assert.equal(transferBack.fromLocationId, publicTarget.location.locationId)
assert.equal(transferBack.toWarehouseId, WOOL_WAIT_HANDOVER_WAREHOUSE_ID)
assert.equal(transferBack.toLocationId, 'WOOL-WH-GARMENT-DEFAULT')
transferWoolWarehouseStock({
  commandId: 'CHECK-T11-TRANSFER-BACK-FIRST-WAREHOUSE-REST',
  ...stockKey,
  fromWarehouseId: publicTarget.warehouse.warehouseId,
  fromLocationId: publicTarget.location.locationId,
  toWarehouseId: WOOL_WAIT_HANDOVER_WAREHOUSE_ID,
  toLocationId: 'WOOL-WH-GARMENT-DEFAULT',
  qty: 1,
  reason: '转回第一公共仓剩余库存',
  operatedAt: '2026-07-31 10:11:05',
  operatedBy: '毛织仓管',
})
const beforeCrossWarehouseMix = JSON.stringify(readWoolStore())
assert.throws(
  () => transferWoolWarehouseStock({
    commandId: 'CHECK-T11-TRANSFER-BACK-MUST-NOT-MIX-WAREHOUSE',
    ...stockKey,
    fromWarehouseId: publicTarget.warehouse.warehouseId,
    fromLocationId: publicTarget.location.locationId,
    toWarehouseId: WOOL_WAIT_HANDOVER_WAREHOUSE_ID,
    toLocationId: 'WOOL-WH-GARMENT-DEFAULT',
    qty: 0.001,
    reason: '不得借用同库位编号另一仓余额',
    operatedAt: '2026-07-31 10:11:06',
    operatedBy: '毛织仓管',
  }),
  /可转回余额/,
)
assert.equal(JSON.stringify(readWoolStore()), beforeCrossWarehouseMix, '同 locationId 跨公共仓不得混算')
const beforeWrongWarehouse = JSON.stringify(readWoolStore())
assert.throws(
  () => transferWoolWarehouseStock({
    commandId: 'CHECK-T11-TRANSFER-BACK-WRONG-WAREHOUSE',
    ...stockKey,
    fromWarehouseId: publicTarget.warehouse.warehouseId,
    fromLocationId: publicTarget.location.locationId,
    toWarehouseId: 'ARBITRARY-WRONG-WAREHOUSE',
    toLocationId: 'WOOL-WH-GARMENT-DEFAULT',
    qty: 0.5,
    reason: '错误目标仓库',
    operatedAt: '2026-07-31 10:11:10',
    operatedBy: '毛织仓管',
  }),
  /默认仓库|仓库.*库位.*对应/,
)
assert.equal(JSON.stringify(readWoolStore()), beforeWrongWarehouse, '错误默认仓库转回必须零写')
assert.throws(
  () => transferWoolWarehouseStock({
    commandId: 'CHECK-T11-TRANSFER-BACK-WRONG-OBJECT-WAREHOUSE',
    ...yarnStockKey,
    fromWarehouseId: publicTarget.warehouse.warehouseId,
    fromLocationId: publicTarget.location.locationId,
    toWarehouseId: WOOL_WAIT_HANDOVER_WAREHOUSE_ID,
    toLocationId: 'WOOL-WP-YARN-DEFAULT',
    qty: 0.01,
    reason: '纱线错误转回待交出仓',
    operatedAt: '2026-07-31 10:11:20',
    operatedBy: '毛织仓管',
  }),
  /默认仓库|仓库.*库位.*对应/,
)
assert.equal(JSON.stringify(readWoolStore()), beforeWrongWarehouse, '错对象默认仓转回必须零写')
const invalidTransferStore = readWoolStore()
const invalidTransfer = invalidTransferStore.warehouseFlows.find((flow) =>
  flow.sourceRecordId === transferOut.sourceRecordId,
)!
invalidTransfer.fromWarehouseId = undefined
assert.throws(
  () => replaceWoolStore(invalidTransferStore),
  /转移流水.*仓库|四端身份/,
  'store 必须拒绝缺少默认仓库端身份的转移流水',
)
const invalidRegistryStore = readWoolStore()
const invalidRegistryTransfer = invalidRegistryStore.warehouseFlows.find((flow) =>
  flow.sourceRecordId === transferOut.sourceRecordId,
)!
invalidRegistryTransfer.toWarehouseId = sameLocationOtherWarehouse.warehouseId
invalidRegistryTransfer.toLocationId = 'ARBITRARY-WRONG-LOCATION'
assert.throws(
  () => replaceWoolStore(invalidRegistryStore),
  /公共仓库.*启用位置|registry|仓库.*库位/,
  'store 必须按 warehouseId + locationId 校验公共仓库注册表',
)
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

const traceReceipts = Array.from({ length: 12 }, (_, index) =>
  addWoolYarnReceipt(issueOrder.woolOrderId, {
    commandId: `CHECK-T11-TRACE-RECEIPT-${index + 1}`,
    deliveryNo: `TRACE-DELIVERY-${String(index + 1).padStart(2, '0')}`,
    batchNo: 'BATCH-TRACE',
    receivedAt: `2026-07-31 11:${String(index).padStart(2, '0')}:00`,
    receivedBy: index === 0 ? '仓管 <甲>' : `仓管 ${index + 1}`,
    proofFiles: index === 0 ? ['凭证<script>alert(1)</script>.jpg'] : [],
    remark: index === 0 ? '备注 <img src=x onerror=alert(1)>' : `追溯备注 ${index + 1}`,
    lines: [{
      yarnSkuCode: 'YARN-A',
      yarnName: '黑色纱线 <A>',
      receivedQty: index + 1,
      differenceNote: index === 0 ? '差异 <svg onload=alert(1)>' : `差异 ${index + 1}`,
    }],
  }),
)
let traceQty = traceReceipts[0].lines[0].receivedQty
for (let index = 0; index < 12; index += 1) {
  traceQty += 0.1
  changeWoolFactQty({
    commandId: `CHECK-T11-TRACE-CHANGE-${index + 1}`,
    recordType: 'YARN_RECEIPT',
    recordId: traceReceipts[0].receiptId,
    recordLineId: traceReceipts[0].lines[0].lineId,
    afterQty: traceQty,
    reason: index === 0 ? '修改 <script>alert(1)</script>' : `数量复核 ${index + 1}`,
    changedAt: `2026-07-31 12:${String(index).padStart(2, '0')}:00`,
    changedBy: index === 0 ? '复核人 <乙>' : `复核人 ${index + 1}`,
  })
}
const receiptTraces = listWoolYarnReceiptLineTraces({
  woolOrderId: issueOrder.woolOrderId,
  objectSkuCode: 'YARN-A',
  batchMatch: 'EXACT',
  batchNo: 'BATCH-TRACE',
})
assert.equal(receiptTraces.length, 12, '确认接收详情必须保留 12 条独立接收明细')
const longTrace = receiptTraces.find((item) =>
  item.receiptId === traceReceipts[0].receiptId
  && item.lineId === traceReceipts[0].lines[0].lineId,
)!
assert.equal(longTrace.originalQty, 1)
assert.equal(longTrace.effectiveQty, traceQty)
assert.equal(longTrace.qtyChanges.length, 12)
assert.equal(longTrace.qtyChanges[0].beforeQty, 1)
assert.equal(longTrace.qtyChanges.at(-1)?.afterQty, traceQty)
assert.equal(longTrace.traceKey, `${longTrace.receiptId}|${longTrace.lineId}`)
assert.equal(receiptTraces.find((item) => item.receiptId === traceReceipts[1].receiptId)?.qtyChanges.length, 0)

const noBatchTraceReceipt = addWoolYarnReceipt(issueOrder.woolOrderId, {
  commandId: 'CHECK-T11-TRACE-NO-BATCH',
  deliveryNo: 'TRACE-DELIVERY-NO-BATCH',
  batchNo: '   ',
  receivedAt: '2026-07-31 13:00:00',
  receivedBy: '无批次仓管',
  remark: '仅无批次详情可见',
  lines: [{
    yarnSkuCode: 'YARN-A',
    yarnName: '无批次 A 纱',
    receivedQty: 3,
    differenceNote: '无批次差异',
  }],
})
const batchXTraceReceipt = addWoolYarnReceipt(issueOrder.woolOrderId, {
  commandId: 'CHECK-T11-TRACE-BATCH-X',
  deliveryNo: 'TRACE-DELIVERY-BATCH-X',
  batchNo: ' BATCH-X ',
  receivedAt: '2026-07-31 13:01:00',
  receivedBy: 'X 批次仓管',
  remark: '仅 BATCH-X 详情可见',
  lines: [{
    yarnSkuCode: 'YARN-A',
    yarnName: 'BATCH-X A 纱',
    receivedQty: 4,
    differenceNote: 'BATCH-X 差异',
  }],
})
changeWoolFactQty({
  commandId: 'CHECK-T11-TRACE-NO-BATCH-CHANGE',
  recordType: 'YARN_RECEIPT',
  recordId: noBatchTraceReceipt.receiptId,
  recordLineId: noBatchTraceReceipt.lines[0].lineId,
  afterQty: 3.5,
  reason: '无批次修改历史',
  changedAt: '2026-07-31 13:10:00',
  changedBy: '无批次复核人',
})
changeWoolFactQty({
  commandId: 'CHECK-T11-TRACE-BATCH-X-CHANGE',
  recordType: 'YARN_RECEIPT',
  recordId: batchXTraceReceipt.receiptId,
  recordLineId: batchXTraceReceipt.lines[0].lineId,
  afterQty: 4.5,
  reason: 'BATCH-X 修改历史',
  changedAt: '2026-07-31 13:11:00',
  changedBy: 'X 批次复核人',
})
const allBatchTraces = listWoolYarnReceiptLineTraces({
  woolOrderId: issueOrder.woolOrderId,
  objectSkuCode: 'YARN-A',
  batchMatch: 'ANY',
})
assert(allBatchTraces.some((item) => item.receiptId === noBatchTraceReceipt.receiptId))
assert(allBatchTraces.some((item) => item.receiptId === batchXTraceReceipt.receiptId))
assert(allBatchTraces.some((item) => item.batchNo === 'BATCH-AB'))
const exactNoBatchTraces = listWoolYarnReceiptLineTraces({
  woolOrderId: issueOrder.woolOrderId,
  objectSkuCode: 'YARN-A',
  batchMatch: 'EXACT',
  batchNo: undefined,
})
assert.deepEqual(
  exactNoBatchTraces.map((item) => item.receiptId),
  [noBatchTraceReceipt.receiptId],
  'EXACT + undefined 只能查询规范化无批次接收',
)
assert.equal(exactNoBatchTraces[0].batchNo, undefined)
assert.equal(exactNoBatchTraces[0].effectiveQty, 3.5)
assert.equal(exactNoBatchTraces[0].qtyChanges[0].reason, '无批次修改历史')
const exactBatchXTraces = listWoolYarnReceiptLineTraces({
  woolOrderId: issueOrder.woolOrderId,
  objectSkuCode: 'YARN-A',
  batchMatch: 'EXACT',
  batchNo: ' BATCH-X ',
})
assert.deepEqual(exactBatchXTraces.map((item) => item.receiptId), [batchXTraceReceipt.receiptId])
assert.equal(exactBatchXTraces[0].batchNo, 'BATCH-X')
assert.equal(exactBatchXTraces[0].qtyChanges[0].reason, 'BATCH-X 修改历史')

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
