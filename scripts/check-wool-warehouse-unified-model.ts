import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  addWoolHandover,
  addWoolProcessReport,
  addWoolYarnReceipt,
  adjustWoolWarehouseStock,
  changeWoolFactQty,
  completeWoolWorkOrder,
  clearWoolStoreMemoryCache,
  getWoolOutputHandoverAvailableQty,
  getWoolOutputReadiness,
  getWoolHandoverEffectiveQty,
  getWoolProcessReportEffectiveQty,
  getWoolProcessingStatus,
  getWoolStoreReadCountForDiagnostics,
  getWoolWarehouseStock,
  issueWoolYarn,
  listWoolYarnReceiptLineTraces,
  listWoolWarehouseFlows,
  listWoolWarehouseStocks,
  listWoolWorkOrders,
  readWoolStore,
  replaceWoolStore,
  resetWoolStoreReadCountForDiagnostics,
  resetWoolFactWorkflowMock,
  returnWoolYarn,
  transferWoolWarehouseStock,
  WOOL_WAIT_HANDOVER_WAREHOUSE_ID,
  WOOL_WAIT_PROCESS_WAREHOUSE_ID,
  WOOL_DOMAIN_STORE_KEY,
} from '../src/data/fcs/wool-task-domain.ts'
import {
  listFactoryInternalWarehouses,
  resolveEnabledFactoryWarehouseLocation,
} from '../src/data/fcs/factory-internal-warehouse-locations.ts'
import { getFactoryMobileWarehouseOverview } from '../src/data/fcs/factory-mobile-warehouse.ts'
import { OWN_WOOL_FACTORY_ID } from '../src/data/fcs/factory-mock-data.ts'
import {
  formatIndonesiaBusinessDateTime,
  isIndonesiaBusinessDateToday,
} from '../src/data/fcs/indonesia-business-time.ts'
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
const mobileWarehouseSource = readFileSync(
  new URL('../src/data/fcs/factory-mobile-warehouse.ts', import.meta.url),
  'utf8',
)

for (const removedApi of [
  'listWoolWaitHandoverHandoutRecords',
  'listWoolWaitHandoverInboundRecords',
  'listWoolWaitProcessReceiptRecords',
  'listWoolWarehouseInventory',
]) {
  assert(!mobileWarehouseSource.includes(removedApi), `移动仓库不得读取旧毛织投影：${removedApi}`)
}
for (const requiredApi of [
  'listWoolYarnReceiptLineTracesFromStore',
  'listWoolWarehouseStocksFromStore',
  'getWoolProcessReportEffectiveQty',
  'getWoolHandoverEffectiveQty',
]) {
  assert(mobileWarehouseSource.includes(requiredApi), `移动仓库必须从毛织事实汇总：${requiredApi}`)
}

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
  '加工接收',
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
const fixedJakartaNow = new Date('2026-07-30T17:30:00.000Z')
assert.equal(formatIndonesiaBusinessDateTime(fixedJakartaNow), '2026-07-31 00:30:00')
assert(isIndonesiaBusinessDateToday('2026-07-31 00:05:00', fixedJakartaNow))
assert(!isIndonesiaBusinessDateToday('2026-07-30 23:59:59', fixedJakartaNow))
const historicalOrder = listWoolWorkOrders()
  .find((order) => order.mockScenarioCode === 'NO_YARN_RECEIPT')!
const historicalOutput = historicalOrder.outputPlanLines[0]
addWoolYarnReceipt(historicalOrder.woolOrderId, {
  commandId: 'CHECK-T13-HISTORY-RECEIPT',
  receivedAt: '2026-07-29 23:40:00',
  receivedBy: '历史仓管',
  lines: historicalOutput.requiredYarnSkus.map((yarnSkuCode) => ({
    yarnSkuCode,
    yarnName: `${yarnSkuCode} 历史接收`,
    receivedQty: 2,
  })),
})
addWoolProcessReport(historicalOrder.woolOrderId, {
  commandId: 'CHECK-T13-HISTORY-REPORT',
  outputSkuCode: historicalOutput.outputSkuCode,
  reportedQty: 1,
  reportedAt: '2026-07-29 23:45:00',
  reportedBy: '历史操作员',
})
addWoolHandover(historicalOrder.woolOrderId, {
  commandId: 'CHECK-T13-HISTORY-HANDOVER',
  outputSkuCode: historicalOutput.outputSkuCode,
  handoverQty: 1,
  handedOverAt: '2026-07-29 23:50:00',
  handedOverBy: '历史仓管',
})
const overviewNow = new Date('2026-07-30T16:30:00.000Z')
const mobileFactStore = readWoolStore()
const mobileOverview = getFactoryMobileWarehouseOverview(
  OWN_WOOL_FACTORY_ID,
  '我方毛织厂',
  overviewNow,
)
const todayReceiptLines = Object.keys(mobileFactStore.workOrders)
  .flatMap((woolOrderId) => listWoolYarnReceiptLineTraces({ woolOrderId, batchMatch: 'ANY' }))
  .filter((line) => line.receivedAt.startsWith('2026-07-30'))
const todayReports = mobileFactStore.processReports.filter((record) => record.reportedAt.startsWith('2026-07-30'))
const todayHandovers = mobileFactStore.handovers.filter((record) => record.handedOverAt.startsWith('2026-07-30'))
assert.equal(
  mobileOverview.todayInboundCount,
  todayReceiptLines.length + todayReports.length,
  '毛织移动仓今日入库计数必须只汇总今日接收明细和加工填报事实',
)
assert.equal(
  mobileOverview.todayOutboundCount,
  todayHandovers.length,
  '毛织移动仓今日出库计数必须只汇总今日交出事实',
)
assert.equal(
  mobileOverview.todayInboundQty,
  todayReceiptLines.reduce((sum, line) => sum + line.effectiveQty, 0)
    + todayReports.reduce((sum, record) => sum + getWoolProcessReportEffectiveQty(mobileFactStore, record), 0),
  '毛织移动仓今日入库数量必须排除历史事实',
)
assert.equal(
  mobileOverview.todayOutboundQty,
  todayHandovers.reduce((sum, record) => sum + getWoolHandoverEffectiveQty(mobileFactStore, record), 0),
  '毛织移动仓今日出库数量必须排除历史事实',
)
resetWoolFactWorkflowMock('CHECK_TASK_11_WAREHOUSE')
const issueOrder = listWoolWorkOrders()
  .find((order) => order.mockScenarioCode === 'YARN_ISSUE_RETURN')!
const batchIsolationOrder = listWoolWorkOrders()
  .find((order) => order.mockScenarioCode === 'NO_YARN_RECEIPT')!
const batchIsolationYarnSku = batchIsolationOrder.outputPlanLines[0].requiredYarnSkus[0]
const sharedStockOrders = listWoolWorkOrders()
  .filter((order) => order.outputPlanLines.some((line) => line.requiredYarnSkus.includes('YARN-A')))
  .slice(0, 2)
assert.equal(sharedStockOrders.length, 2, '稳定 stockKey 用例需要两个包含同一纱线 SKU 的加工单')
sharedStockOrders.forEach((order, index) => addWoolYarnReceipt(order.woolOrderId, {
  commandId: `CHECK-T13-STABLE-STOCK-${index + 1}`,
  batchNo: 'BATCH-SAME',
  receivedAt: '2026-07-31 09:40:00',
  receivedBy: '稳定键仓管',
  lines: [{
    yarnSkuCode: 'YARN-A',
    yarnName: '同 SKU 同批次纱线',
    receivedQty: index + 4,
  }],
}))
const sharedStocks = listWoolWarehouseStocks('WAIT_PROCESS')
  .filter((stock) => stock.objectSkuCode === 'YARN-A' && stock.batchNo === 'BATCH-SAME')
assert.equal(sharedStocks.length, 2)
assert.notEqual(sharedStocks[0].stockKey, sharedStocks[1].stockKey)
const selectedSharedStock = sharedStocks[1]
assert.equal(selectedSharedStock?.woolOrderId, sharedStocks[1].woolOrderId)
const untouchedSharedQty = getWoolWarehouseStock({
  woolOrderId: sharedStocks[0].woolOrderId,
  objectSkuCode: sharedStocks[0].objectSkuCode,
  batchNo: sharedStocks[0].batchNo,
  defaultLocationId: 'WOOL-WP-YARN-DEFAULT',
})
adjustWoolWarehouseStock({
  commandId: 'CHECK-T13-STABLE-STOCK-ADJUST',
  woolOrderId: selectedSharedStock!.woolOrderId,
  objectSkuCode: selectedSharedStock!.objectSkuCode,
  batchNo: selectedSharedStock!.batchNo,
  defaultLocationId: selectedSharedStock!.defaultLocationId,
  afterQty: 2,
  reason: '只调整选中加工单',
  operatedAt: '2026-07-31 09:45:00',
  operatedBy: '稳定键仓管',
})
assert.equal(
  getWoolWarehouseStock({
    woolOrderId: sharedStocks[0].woolOrderId,
    objectSkuCode: sharedStocks[0].objectSkuCode,
    batchNo: sharedStocks[0].batchNo,
    defaultLocationId: 'WOOL-WP-YARN-DEFAULT',
  }),
  untouchedSharedQty,
  '同 SKU 同批次跨两张加工单时，未选中加工单必须零写',
)
addWoolYarnReceipt(batchIsolationOrder.woolOrderId, {
  commandId: 'CHECK-T11-BATCH-EXACT-NO-BATCH',
  batchNo: '   ',
  receivedAt: '2026-07-31 09:50:00',
  receivedBy: '精确批次仓管',
  lines: [{
    yarnSkuCode: batchIsolationYarnSku,
    yarnName: '精确批次测试纱线',
    receivedQty: 1,
  }],
})
addWoolYarnReceipt(batchIsolationOrder.woolOrderId, {
  commandId: 'CHECK-T11-BATCH-EXACT-X',
  batchNo: ' BATCH-X ',
  receivedAt: '2026-07-31 09:51:00',
  receivedBy: '精确批次仓管',
  lines: [{
    yarnSkuCode: batchIsolationYarnSku,
    yarnName: '精确批次测试纱线',
    receivedQty: 10,
  }],
})
const noBatchStockKey = {
  woolOrderId: batchIsolationOrder.woolOrderId,
  objectSkuCode: batchIsolationYarnSku,
  batchNo: undefined,
  defaultLocationId: 'WOOL-WP-YARN-DEFAULT' as const,
}
assert.equal(getWoolWarehouseStock(noBatchStockKey), 1, '无批次库存不得汇总 BATCH-X')
assert.equal(getWoolWarehouseStock({ ...noBatchStockKey, batchNo: ' BATCH-X ' }), 10)
const beforeExactBatchOverIssue = JSON.stringify(readWoolStore())
assert.throws(
  () => issueWoolYarn(batchIsolationOrder.woolOrderId, {
    commandId: 'CHECK-T11-BATCH-EXACT-OVER-ISSUE',
    yarnSkuCode: batchIsolationYarnSku,
    batchNo: undefined,
    issuedQty: 5,
    issuedAt: '2026-07-31 09:52:00',
    issuedBy: '精确批次仓管',
  }),
  /领用数量不能超过当前库存/,
)
assert.equal(JSON.stringify(readWoolStore()), beforeExactBatchOverIssue, '无批次超领必须零写')
issueWoolYarn(batchIsolationOrder.woolOrderId, {
  commandId: 'CHECK-T11-BATCH-EXACT-FRACTIONAL-YARN',
  yarnSkuCode: batchIsolationYarnSku,
  batchNo: undefined,
  issuedQty: 0.5,
  issuedAt: '2026-07-31 09:53:00',
  issuedBy: '精确批次仓管',
})
assert.equal(getWoolWarehouseStock(noBatchStockKey), 0.5, 'kg 纱线允许小数且仍按无批次精确扣减')
assert.equal(getWoolWarehouseStock({ ...noBatchStockKey, batchNo: 'BATCH-X' }), 10)
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
const beforeFractionalAdjustment = JSON.stringify(readWoolStore())
assert.throws(
  () => adjustWoolWarehouseStock({
    commandId: 'CHECK-T11-FRACTIONAL-GARMENT-ADJUST',
    woolOrderId: wholeOrder.woolOrderId,
    objectSkuCode: wholeOrder.outputPlanLines[0].outputSkuCode,
    defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT',
    afterQty: 1.5,
    reason: '件数不得为小数',
    operatedAt: '2026-07-31 10:08:00',
    operatedBy: '毛织仓管',
  }),
  /件.*整数|整数/,
)
assert.equal(JSON.stringify(readWoolStore()), beforeFractionalAdjustment, '1.5 件调整必须零写')
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
const publicLocationTargets = publicWarehouses.flatMap((warehouse) =>
  warehouse.areaList.flatMap((area) =>
    area.shelfList.flatMap((shelf) =>
      shelf.locationList.map((location) => ({ warehouse, location })),
    ),
  ),
)
const publicTarget = publicLocationTargets.find(({ warehouse, location }) =>
  publicWarehouses.some((candidate) =>
    candidate.warehouseId !== warehouse.warehouseId
    && resolveEnabledFactoryWarehouseLocation(candidate.warehouseId, location.locationId),
  ),
)
assert(publicTarget, '夹具必须提供至少一个可在两个公共仓库中使用的共享库位编号')
const sameLocationOtherWarehouse = publicWarehouses.find((warehouse) =>
  warehouse.warehouseId !== publicTarget.warehouse.warehouseId
  && resolveEnabledFactoryWarehouseLocation(warehouse.warehouseId, publicTarget.location.locationId),
)
assert(sameLocationOtherWarehouse, '夹具必须提供共享库位编号对应的另一公共仓库')
const availableBeforeTransfer = getWoolOutputHandoverAvailableQty(
  wholeOrder.woolOrderId,
  transferLine.outputSkuCode,
)
const beforeFractionalTransfer = JSON.stringify(readWoolStore())
assert.throws(
  () => transferWoolWarehouseStock({
    commandId: 'CHECK-T11-FRACTIONAL-GARMENT-TRANSFER',
    ...stockKey,
    fromWarehouseId: WOOL_WAIT_HANDOVER_WAREHOUSE_ID,
    fromLocationId: 'WOOL-WH-GARMENT-DEFAULT',
    toWarehouseId: publicTarget.warehouse.warehouseId,
    toLocationId: publicTarget.location.locationId,
    qty: 0.5,
    reason: '件数不得为小数',
    operatedAt: '2026-07-31 10:09:00',
    operatedBy: '毛织仓管',
  }),
  /件.*整数|整数/,
)
assert.equal(JSON.stringify(readWoolStore()), beforeFractionalTransfer, '0.5 件转出必须零写')
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
const beforeFractionalTransferBack = JSON.stringify(readWoolStore())
assert.throws(
  () => transferWoolWarehouseStock({
    commandId: 'CHECK-T11-FRACTIONAL-GARMENT-TRANSFER-BACK',
    ...stockKey,
    fromWarehouseId: publicTarget.warehouse.warehouseId,
    fromLocationId: publicTarget.location.locationId,
    toWarehouseId: WOOL_WAIT_HANDOVER_WAREHOUSE_ID,
    toLocationId: 'WOOL-WH-GARMENT-DEFAULT',
    qty: 0.5,
    reason: '件数不得为小数',
    operatedAt: '2026-07-31 10:10:01',
    operatedBy: '毛织仓管',
  }),
  /件.*整数|整数/,
)
assert.equal(JSON.stringify(readWoolStore()), beforeFractionalTransferBack, '0.5 件转回必须零写')
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
    qty: 1,
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
const legalStoreBeforeReplayAttacks = readWoolStore()
const legalStoreBeforeReplayAttacksJson = JSON.stringify(legalStoreBeforeReplayAttacks)
const negativeAdjustmentStore = structuredClone(legalStoreBeforeReplayAttacks)
negativeAdjustmentStore.warehouseFlows.push({
  flowId: 'WF-FORGED-NEGATIVE-ADJUSTMENT',
  woolOrderId: batchIsolationOrder.woolOrderId,
  flowType: 'ADJUSTMENT',
  businessType: 'STOCK_ADJUSTMENT',
  warehouseMode: 'WAIT_PROCESS',
  defaultLocationType: 'YARN',
  defaultLocationId: 'WOOL-WP-YARN-DEFAULT',
  objectSkuCode: batchIsolationYarnSku,
  batchNo: undefined,
  qty: -99,
  unit: 'kg',
  sourceRecordType: 'STOCK_ADJUSTMENT',
  sourceRecordId: 'FORGED-NEGATIVE-ADJUSTMENT',
  reason: '伪造负库存',
  operatedAt: '2026-07-31 10:11:30',
  operatedBy: '攻击者',
})
assert.throws(
  () => replaceWoolStore(negativeAdjustmentStore),
  /负库存|账本/,
  'store 重放必须拒绝任一步形成负库存的伪造调整',
)
assert.equal(JSON.stringify(readWoolStore()), legalStoreBeforeReplayAttacksJson, '失败重放不得覆盖合法内存缓存')

const nonFiniteFlowStore = structuredClone(legalStoreBeforeReplayAttacks)
nonFiniteFlowStore.warehouseFlows.find((flow) => flow.flowId === transferOut.flowId)!.qty = Number.NaN
assert.throws(
  () => replaceWoolStore(nonFiniteFlowStore),
  /有限数字|账本/,
  'store 重放必须拒绝 NaN 仓库流水',
)
assert.equal(JSON.stringify(readWoolStore()), legalStoreBeforeReplayAttacksJson, 'NaN 校验失败必须零写')
const infiniteFlowStore = structuredClone(legalStoreBeforeReplayAttacks)
infiniteFlowStore.warehouseFlows.find((flow) => flow.flowId === transferOut.flowId)!.qty = Number.POSITIVE_INFINITY
assert.throws(
  () => replaceWoolStore(infiniteFlowStore),
  /有限数字|账本/,
  'store 重放必须拒绝 Infinity 仓库流水',
)
assert.equal(JSON.stringify(readWoolStore()), legalStoreBeforeReplayAttacksJson, 'Infinity 校验失败必须零写')

const fractionalHistoricalStore = structuredClone(legalStoreBeforeReplayAttacks)
fractionalHistoricalStore.warehouseFlows.find((flow) => flow.flowId === transferOut.flowId)!.qty = 0.5
assert.throws(
  () => replaceWoolStore(fractionalHistoricalStore),
  /件.*整数|整数/,
  'store 重放必须拒绝历史件数小数',
)
assert.equal(JSON.stringify(readWoolStore()), legalStoreBeforeReplayAttacksJson, '历史小数校验失败必须零写')

const overReturnStore = structuredClone(legalStoreBeforeReplayAttacks)
const forgedReturn = {
  ...overReturnStore.yarnReturns[0],
  returnId: 'WRT-FORGED-OVER-RETURN',
  returnNo: 'WRT-NO-FORGED-OVER-RETURN',
  woolOrderId: issueOrder.woolOrderId,
  yarnSkuCode: 'YARN-A',
  batchNo: ' BATCH-AB ',
  returnedQty: 999,
  warehouseInboundFlowId: 'WF-WRT-FORGED-OVER-RETURN',
  returnedAt: '2026-07-31 10:11:31',
  returnedBy: '攻击者',
}
overReturnStore.yarnReturns.push(forgedReturn)
overReturnStore.warehouseFlows.push({
  ...overReturnStore.warehouseFlows.find((flow) => flow.flowId === returned.warehouseInboundFlowId)!,
  flowId: forgedReturn.warehouseInboundFlowId,
  sourceRecordId: forgedReturn.returnId,
  batchNo: forgedReturn.batchNo,
  qty: forgedReturn.returnedQty,
  operatedAt: forgedReturn.returnedAt,
  operatedBy: forgedReturn.returnedBy,
})
assert.throws(
  () => replaceWoolStore(overReturnStore),
  /累计退回.*累计领用|账本/,
  'store 重放必须拒绝同单 SKU 批次超退回',
)
assert.equal(JSON.stringify(readWoolStore()), legalStoreBeforeReplayAttacksJson, '超退回重放失败必须零写')

const overIssueStore = structuredClone(legalStoreBeforeReplayAttacks)
const issueTemplate = overIssueStore.yarnIssues.find((item) => item.issueId === issue.issueId)!
const issueFlowTemplate = overIssueStore.warehouseFlows.find((item) =>
  item.flowId === issueTemplate.warehouseOutboundFlowId,
)!
overIssueStore.yarnIssues.push({
  ...issueTemplate,
  issueId: 'WI-FORGED-OVER-ISSUE',
  issueNo: 'WI-NO-FORGED-OVER-ISSUE',
  issuedQty: 999,
  warehouseOutboundFlowId: 'WF-WI-FORGED-OVER-ISSUE',
  issuedAt: '2026-07-31 10:11:32',
  issuedBy: '攻击者',
})
overIssueStore.warehouseFlows.push({
  ...issueFlowTemplate,
  flowId: 'WF-WI-FORGED-OVER-ISSUE',
  sourceRecordId: 'WI-FORGED-OVER-ISSUE',
  qty: 999,
  operatedAt: '2026-07-31 10:11:32',
  operatedBy: '攻击者',
})
assert.throws(
  () => replaceWoolStore(overIssueStore),
  /负库存|账本/,
  'store 重放必须拒绝超领',
)
assert.equal(JSON.stringify(readWoolStore()), legalStoreBeforeReplayAttacksJson, '超领重放失败必须零写')

const overTransferBackStore = structuredClone(legalStoreBeforeReplayAttacks)
overTransferBackStore.warehouseFlows.push({
  ...transferOut,
  flowId: 'WF-FORGED-OVER-TRANSFER-BACK',
  sourceRecordId: 'FORGED-OVER-TRANSFER-BACK',
  fromWarehouseId: transferOut.toWarehouseId,
  fromLocationId: transferOut.toLocationId,
  toWarehouseId: transferOut.fromWarehouseId,
  toLocationId: transferOut.fromLocationId,
  qty: 999,
  operatedAt: '2026-07-31 10:11:33',
  operatedBy: '攻击者',
})
assert.throws(
  () => replaceWoolStore(overTransferBackStore),
  /可转回余额|账本/,
  'store 重放必须拒绝公共仓超转回',
)
assert.equal(JSON.stringify(readWoolStore()), legalStoreBeforeReplayAttacksJson, '超转回重放失败必须零写')
const wrongObjectLocationStore = structuredClone(legalStoreBeforeReplayAttacks)
wrongObjectLocationStore.warehouseFlows.push({
  flowId: 'WF-FORGED-WRONG-OBJECT-LOCATION',
  woolOrderId: wholeOrder.woolOrderId,
  flowType: 'ADJUSTMENT',
  businessType: 'STOCK_ADJUSTMENT',
  warehouseMode: 'WAIT_PROCESS',
  defaultLocationType: 'YARN',
  defaultLocationId: 'WOOL-WP-YARN-DEFAULT',
  objectSkuCode: transferLine.outputSkuCode,
  qty: 1,
  unit: 'kg',
  sourceRecordType: 'STOCK_ADJUSTMENT',
  sourceRecordId: 'FORGED-WRONG-OBJECT-LOCATION',
  reason: '伪造对象默认位',
  operatedAt: '2026-07-31 10:11:34',
  operatedBy: '攻击者',
})
assert.throws(
  () => replaceWoolStore(wrongObjectLocationStore),
  /对象.*默认库位|对象类型|单位/,
  'store 重放必须拒绝加工后对象写入纱线默认库位',
)
assert.equal(JSON.stringify(readWoolStore()), legalStoreBeforeReplayAttacksJson, '错对象默认位失败必须零写')
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

const performanceBaseStore = readWoolStore()
const performanceTemplateOrder = performanceBaseStore.workOrders[wholeOrder.woolOrderId]
const performanceResults: Array<{ scale: number; medianMs: number; readCount: number; htmlLength: number }> = []
for (const scale of [25, 50, 100, 250]) {
  const scaleStore = structuredClone(performanceBaseStore)
  for (let index = 0; index < scale; index += 1) {
    const woolOrderId = `WOOL-T11-PERF-${scale}-${index}`
    const outputSkuCode = `WOOL-T11-PERF-SKU-${scale}-${index}`
    scaleStore.workOrders[woolOrderId] = {
      ...structuredClone(performanceTemplateOrder),
      woolOrderId,
      woolOrderNo: `WMO-T11-PERF-${scale}-${String(index).padStart(3, '0')}`,
      taskId: `TASK-T11-PERF-${scale}-${index}`,
      taskNo: `WT-T11-PERF-${scale}-${index}`,
      outputPlanLines: [{
        ...structuredClone(performanceTemplateOrder.outputPlanLines[0]),
        outputSkuCode,
        garmentSkuCode: outputSkuCode,
      }],
    }
    scaleStore.warehouseFlows.push({
      flowId: `WF-T11-PERF-${scale}-${index}`,
      woolOrderId,
      flowType: 'ADJUSTMENT',
      businessType: 'STOCK_ADJUSTMENT',
      warehouseMode: 'WAIT_HANDOVER',
      defaultLocationType: 'GARMENT',
      defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT',
      objectSkuCode: outputSkuCode,
      qty: 1,
      unit: '件',
      sourceRecordType: 'STOCK_ADJUSTMENT',
      sourceRecordId: `T11-PERF-${scale}-${index}`,
      reason: '性能规模事实',
      operatedAt: `2026-07-31 14:${String(index % 60).padStart(2, '0')}:00`,
      operatedBy: '性能测试',
    })
  }
  replaceWoolStore(scaleStore)
  const durations: number[] = []
  let scaledHtml = ''
  for (let attempt = 0; attempt < 3; attempt += 1) {
    resetWoolStoreReadCountForDiagnostics()
    const startedAt = performance.now()
    scaledHtml = renderCraftWoolWaitHandoverWarehousePage()
    durations.push(performance.now() - startedAt)
    assert.equal(getWoolStoreReadCountForDiagnostics(), 1, `${scale} 行渲染只能读取一次毛织 store`)
  }
  durations.sort((left, right) => left - right)
  assert(durations[1] < 180, `${scale} 行渲染中位耗时必须低于 180ms，实际 ${durations[1].toFixed(1)}ms`)
  assert((scaledHtml.match(/<tr/g) ?? []).length <= 12, `${scale} 行渲染只能输出当前页`)
  assert(scaledHtml.length < 300_000, `${scale} 行渲染 HTML 必须有界`)
  performanceResults.push({
    scale,
    medianMs: Number(durations[1].toFixed(1)),
    readCount: getWoolStoreReadCountForDiagnostics(),
    htmlLength: scaledHtml.length,
  })
}
replaceWoolStore(performanceBaseStore)
console.log(`Task 11 warehouse performance: ${JSON.stringify(performanceResults)}`)

const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
const persistedValues = new Map<string, string>()
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => persistedValues.get(key) ?? null,
      setItem: (key: string, value: string) => { persistedValues.set(key, value) },
      removeItem: (key: string) => { persistedValues.delete(key) },
    },
  },
})
replaceWoolStore(performanceBaseStore)
const legalPersistedStore = persistedValues.get(WOOL_DOMAIN_STORE_KEY)
assert(legalPersistedStore)
assert.throws(() => replaceWoolStore(negativeAdjustmentStore), /负库存|账本/)
assert.equal(
  persistedValues.get(WOOL_DOMAIN_STORE_KEY),
  legalPersistedStore,
  '非法 replace 必须在持久化前失败并保留合法持久化快照',
)
const invalidPersistedStore = JSON.stringify(negativeAdjustmentStore)
persistedValues.set(WOOL_DOMAIN_STORE_KEY, invalidPersistedStore)
clearWoolStoreMemoryCache()
const reloadedAfterInvalidPersistence = readWoolStore()
assert(
  !reloadedAfterInvalidPersistence.warehouseFlows.some((flow) =>
    flow.flowId === 'WF-FORGED-NEGATIVE-ADJUSTMENT',
  ),
  '持久化重载必须拒绝非法账本并使用合法初始化事实',
)
assert.equal(
  persistedValues.get(WOOL_DOMAIN_STORE_KEY),
  invalidPersistedStore,
  '非法持久化重载不得静默覆盖原始证据',
)
if (windowDescriptor) {
  Object.defineProperty(globalThis, 'window', windowDescriptor)
} else {
  Reflect.deleteProperty(globalThis, 'window')
}

console.log('PASS task 11: wool Web warehouses use fixed locations and atomic fact flows')
