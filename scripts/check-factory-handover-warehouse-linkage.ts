#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  findFactoryWaitHandoverStockItemByHandoverRecordId,
  findFactoryWaitProcessStockItemBySourceRecordId,
  findFactoryWarehouseInboundRecordBySourceRecordId,
  findFactoryWarehouseOutboundRecordByHandoverRecordId,
  listFactoryWaitHandoverStockItems,
  listFactoryWarehouseInboundRecords,
  listFactoryWarehouseOutboundRecords,
} from '../src/data/fcs/factory-internal-warehouse.ts'
import {
  getPdaHandoverRecordsByHead,
  getPdaPickupRecordsByHead,
  listPdaHandoverHeads,
} from '../src/data/fcs/pda-handover-events.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function joinText(parts: string[]): string {
  return parts.join('')
}

function buildToken(...parts: string[]): string {
  return parts.join('')
}

function assertContains(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotContains(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

const packageSource = read('package.json')
const linkageSource = read('src/data/fcs/factory-warehouse-linkage.ts')
const warehouseDataSource = read('src/data/fcs/factory-internal-warehouse.ts')
const pdaHandoverDataSource = read('src/data/fcs/pda-handover-events.ts')
const handoverDetailSource = read('src/pages/pda-handover-detail.ts')
const waitProcessSource = read('src/pages/pda-warehouse-wait-process.ts')
const waitHandoverSource = read('src/pages/pda-warehouse-wait-handover.ts')
const inboundSource = read('src/pages/pda-warehouse-inbound-records.ts')
const outboundSource = read('src/pages/pda-warehouse-outbound-records.ts')
const webWarehouseSource = read('src/pages/factory-internal-warehouse.ts')
const specialCraftWarehouseSource = read('src/pages/process-factory/special-craft/warehouse.ts')
const specialCraftTaskSource = read('src/data/fcs/special-craft-task-orders.ts')
const specialCraftFeiFlowSource = read('src/data/fcs/cutting/special-craft-fei-ticket-flow.ts')
const sewingDispatchSource = read('src/data/fcs/cutting/sewing-dispatch.ts') + read('src/pages/process-factory/cutting/sewing-dispatch.ts')
const progressStatisticsSource = read('src/data/fcs/progress-statistics-linkage.ts')

const warehousePageSource = [
  waitProcessSource,
  waitHandoverSource,
  inboundSource,
  outboundSource,
  webWarehouseSource,
  specialCraftWarehouseSource,
].join('\n')

assertContains(
  packageSource,
  '"check:factory-handover-warehouse-linkage": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-factory-handover-warehouse-linkage.ts"',
  'package.json 缺少交接与仓管联动检查命令',
)

;[
  'linkPickupConfirmToInboundRecord',
  'linkHandoverReceiveToInboundRecord',
  'linkTaskCompletionToWaitHandoverStock',
  'linkHandoverRecordToOutboundRecord',
  'syncReceiverWritebackToOutboundRecord',
  'syncQuantityObjectionToOutboundRecord',
].forEach((token) => {
  assertContains(linkageSource, token, `联动适配层缺少：${token}`)
})

assertContains(handoverDetailSource, 'linkPickupConfirmToInboundRecord', '交接详情未复用待领料到入库联动')
assertContains(handoverDetailSource, 'linkHandoverReceiveToInboundRecord', '交接详情未复用交出接收到入库联动')
assertContains(handoverDetailSource, 'linkHandoverRecordToOutboundRecord', '交接详情未复用交出到出库联动')
assertContains(handoverDetailSource, 'syncReceiverWritebackToOutboundRecord', '交接详情未复用回写同步联动')
assertContains(handoverDetailSource, 'syncQuantityObjectionToOutboundRecord', '交接详情未复用数量异议同步联动')
assertContains(handoverDetailSource, '已入待加工仓', '交接详情缺少待加工仓联动提示')
assertContains(handoverDetailSource, '已入待加工仓 · 差异待处理', '交接详情缺少差异入库提示')
assertContains(handoverDetailSource, '已驳回', '交接详情缺少驳回提示')
assertContains(handoverDetailSource, '已生成出库记录', '交接详情缺少出库联动提示')
assertContains(handoverDetailSource, '完成领料单', '交接详情缺少完成领料单按钮')
assertContains(handoverDetailSource, '完成交出单', '交接详情缺少完成交出单按钮')
assertContains(pdaHandoverDataSource, '领料单已完成，不允许新增领料记录', '完成领料单后必须禁止新增领料记录')
assertContains(pdaHandoverDataSource, '交出单已完成，不允许新增交出记录', '完成交出单后必须禁止新增交出记录')
assertContains(pdaHandoverDataSource, 'receiverClosedAt: head.receiverClosedAt', '交出单完成后接收方回写闭合必须保留独立语义')
assertNotContains(pdaHandoverDataSource, '仍有待接收方回写记录', '完成交出单不得依赖全部回写')
assertNotContains(pdaHandoverDataSource, '仍有未处理完成的数量异议', '完成交出单不得依赖异议关闭')
assertContains(specialCraftWarehouseSource, '自动转单', '特殊工艺仓库管理缺少自动转单展示')
assertContains(specialCraftTaskSource, 'buildFactoryWaitProcessStockItemFromInboundRecord', '特殊工艺任务仓库关联未复用待加工仓转单结果')
assertContains(specialCraftTaskSource, 'buildFactoryWaitHandoverStockItemFromOutboundRecord', '特殊工艺任务仓库关联未复用待交出仓转单结果')
assertContains(specialCraftFeiFlowSource, 'receiveSpecialCraftReturnToCuttingWaitHandoverWarehouse', '缺少特殊工艺回仓进入裁床厂待交出仓例外 helper')
assertContains(specialCraftFeiFlowSource, "currentLocation: '裁床厂待交出仓'", '特殊工艺回仓未写入裁床厂待交出仓')
assertContains(specialCraftFeiFlowSource, 'returnDifferenceStatus', '特殊工艺回仓差异必须独立记录，不覆盖回仓所在')
assertContains(sewingDispatchSource, 'submitCuttingSewingDispatchBatch', '裁床发车缝缺少提交本次发料 helper')
assertContains(sewingDispatchSource, 'createFactoryHandoverRecord', '裁床发车缝必须复用现有交出记录')
assertContains(sewingDispatchSource, 'linkHandoverRecordToOutboundRecord', '裁床发车缝必须复用出库联动')
assertContains(sewingDispatchSource, 'syncSewingReceiveWritebackToDispatch', '车缝厂回写必须同步本次发料状态')
assertContains(sewingDispatchSource, 'writebackSewingReceiveByTransferBag', '车缝厂必须支持按中转袋回写')
assertContains(sewingDispatchSource, 'writebackSewingReceiveByFeiTicket', '车缝厂必须支持按菲票回写')
assert(!listFactoryWarehouseInboundRecords().some((record) => record.factoryName.includes('车缝')), `不应为${buildToken('车', '缝')}接收方生成内部仓记录`)
assertContains(progressStatisticsSource, 'buildHandoverProgressSnapshot', '统计与进度联动缺少交接统计 helper')
assertContains(progressStatisticsSource, 'listReceiverWritebacks', '交接统计必须消费接收方回写')
assertContains(progressStatisticsSource, 'listQuantityObjections', '交接统计必须消费数量异议')

const pickupHeads = listPdaHandoverHeads().filter((head) => head.headType === 'PICKUP')
const pickupRecords = pickupHeads.flatMap((head) =>
  getPdaPickupRecordsByHead(head.handoverId).map((record) => ({ head, record })),
)

const confirmedPickup = pickupRecords.find(
  ({ record }) =>
    record.status === 'RECEIVED'
    && Boolean(findFactoryWarehouseInboundRecordBySourceRecordId(record.recordId)),
)
assert(confirmedPickup, '缺少待领料确认成功样例')
const confirmedInbound = findFactoryWarehouseInboundRecordBySourceRecordId(confirmedPickup!.record.recordId)
assert(confirmedInbound, '待领料确认成功后未生成入库记录')
assert(confirmedInbound!.status === '已入库', '待领料确认成功后的入库记录状态应为已入库')
const confirmedWaitProcess = findFactoryWaitProcessStockItemBySourceRecordId(confirmedPickup!.record.recordId)
assert(confirmedWaitProcess, '待领料确认成功后未生成待加工仓明细')
assert(confirmedWaitProcess!.status === '已入待加工仓', '待领料确认成功后的待加工仓状态应为已入待加工仓')

const diffPickup = pickupRecords.find(
  ({ record }) =>
    ['OBJECTION_REPORTED', 'OBJECTION_PROCESSING', 'OBJECTION_RESOLVED'].includes(record.status)
    && Boolean(findFactoryWarehouseInboundRecordBySourceRecordId(record.recordId)),
)
assert(diffPickup, '缺少待领料差异样例')
const diffInbound = findFactoryWarehouseInboundRecordBySourceRecordId(diffPickup!.record.recordId)
assert(diffInbound, '待领料差异后未生成入库记录')
assert(diffInbound!.status === '差异待处理', '待领料差异后的入库记录状态应为差异待处理')
const diffWaitProcess = findFactoryWaitProcessStockItemBySourceRecordId(diffPickup!.record.recordId)
assert(diffWaitProcess, '待领料差异后未生成待加工仓明细')
assert(diffWaitProcess!.status === '差异待处理', '待领料差异后的待加工仓状态应为差异待处理')

const rejectedPickup = pickupRecords.find(({ record }) => record.status === 'REJECTED')
assert(rejectedPickup, '缺少待领料驳回样例')
assert(!findFactoryWarehouseInboundRecordBySourceRecordId(rejectedPickup!.record.recordId), '待领料驳回后不应生成入库记录')
assert(!findFactoryWaitProcessStockItemBySourceRecordId(rejectedPickup!.record.recordId), '待领料驳回后不应进入待加工仓')

const handoverReceiveInbound = listFactoryWarehouseInboundRecords().find((record) => record.sourceRecordType === 'HANDOVER_RECEIVE')
assert(handoverReceiveInbound, '缺少交出接收生成的入库记录')

const pendingWaitHandover = listFactoryWaitHandoverStockItems().find(
  (item) => item.status === '待交出' && !item.handoverRecordId && item.waitHandoverQty > 0,
)
assert(pendingWaitHandover, '缺少任务完工进入待交出仓的样例')

const handoutHeads = listPdaHandoverHeads().filter((head) => head.headType === 'HANDOUT')
const handoutRecords = handoutHeads.flatMap((head) =>
  getPdaHandoverRecordsByHead(head.handoverId).map((record) => ({ head, record })),
)
const linkedHandout = handoutRecords.find(({ record }) =>
  Boolean(findFactoryWarehouseOutboundRecordByHandoverRecordId(record.handoverRecordId || record.recordId)),
)
assert(linkedHandout, '缺少交出记录生成出库记录样例')
const outboundRecord = findFactoryWarehouseOutboundRecordByHandoverRecordId(
  linkedHandout!.record.handoverRecordId || linkedHandout!.record.recordId,
)
assert(outboundRecord, '交出记录提交后未生成出库记录')
assert(outboundRecord!.handoverOrderNo, '出库记录未关联交出单')
assert(outboundRecord!.handoverRecordNo, '出库记录未关联交出记录')
assert(outboundRecord!.handoverRecordQrValue, '出库记录未关联交出二维码')

const writtenBackOutbound = listFactoryWarehouseOutboundRecords().find((record) => record.status === '已回写')
assert(writtenBackOutbound, '缺少回写无差异的出库记录样例')
const diffOutbound = listFactoryWarehouseOutboundRecords().find((record) => record.status === '差异')
assert(diffOutbound, '缺少回写差异的出库记录样例')
const objectionOutbound = listFactoryWarehouseOutboundRecords().find((record) => record.status === '异议中')
assert(objectionOutbound, '缺少数量异议中的出库记录样例')

assert(
  findFactoryWaitHandoverStockItemByHandoverRecordId(writtenBackOutbound!.handoverRecordId || '')?.status === '已回写',
  '待交出仓未同步无差异回写状态',
)
assert(
  findFactoryWaitHandoverStockItemByHandoverRecordId(diffOutbound!.handoverRecordId || '')?.status === '差异',
  '待交出仓未同步差异回写状态',
)
assert(
  findFactoryWaitHandoverStockItemByHandoverRecordId(objectionOutbound!.handoverRecordId || '')?.status === '异议中',
  '待交出仓未同步异议状态',
)

;[
  '来源动作',
  '入库记录',
  '来源状态',
  '出库记录',
  '交出二维码',
  '回写状态',
  '生成方式',
].forEach((token) => {
  assertContains(warehousePageSource, token, `仓管页面缺少联动展示：${token}`)
})
assert(
  warehousePageSource.includes('自动转单') || warehousePageSource.includes('getWarehouseGeneratedModeLabel'),
  '仓管页面缺少自动转单展示',
)

;[
  buildToken('确认', '领料'),
  buildToken('手动', '入库'),
  buildToken('新增', '库存'),
  buildToken('新增', '入库'),
  buildToken('手动', '出库'),
  buildToken('新增', '出库'),
].forEach((token) => {
  assertNotContains(waitProcessSource, token, `待加工仓页面不应提供主操作：${token}`)
  assertNotContains(inboundSource, token, `入库记录页面不应提供主操作：${token}`)
  assertNotContains(specialCraftWarehouseSource, token, `特殊工艺仓库管理不应提供主操作：${token}`)
})
;[
  buildToken('确认', '领料'),
  buildToken('新增', '交出记录'),
  buildToken('新建', '交出'),
  buildToken('手动', '出库'),
  buildToken('新增', '出库'),
  buildToken('新增', '库存'),
].forEach((token) => {
  assertNotContains(waitHandoverSource, token, `待交出仓页面不应提供主操作：${token}`)
  assertNotContains(outboundSource, token, `出库记录页面不应提供主操作：${token}`)
  assertNotContains(specialCraftWarehouseSource, token, `特殊工艺仓库管理不应提供主操作：${token}`)
})

;[
  'FactoryPickupOrder',
  'WarehousePickupOrder',
  'FactoryMaterialPickupOrder',
  buildToken('Warehouse', 'HandoverOrder'),
  buildToken('Factory', 'OutboundOrder'),
  'FactoryDeliveryOrder',
  'WarehouseDeliveryOrder',
  buildToken('仓库', '领料单'),
  buildToken('仓库', '交出单'),
  buildToken('create', 'Warehouse', 'Handover'),
  'createWarehousePickup',
].forEach((token) => {
  assertNotContains(linkageSource + warehouseDataSource + handoverDetailSource + warehousePageSource + specialCraftTaskSource, token, `不应新增重复主模型：${token}`)
})

assertNotContains(warehousePageSource, 'FCS:', '仓管页面不应直接显示二维码 payload')
assertNotContains(warehousePageSource, 'QR payload', '仓管页面不应直接显示 QR payload 文案')
assertNotContains(warehousePageSource, 'JSON.stringify', '仓管页面不应直接输出 JSON')

const visiblePdaPattern = new RegExp(
  [
    `>[^<]*${joinText(['PD', 'A'])}`,
    joinText(['PDA', '执行']),
    joinText(['PDA', '交接']),
    joinText(['PDA', '仓管']),
    joinText(['PDA', '待办']),
  ].join('|'),
)
assert(!visiblePdaPattern.test(warehousePageSource + handoverDetailSource), '页面用户可见文案仍出现 PDA')
assertNotContains(warehousePageSource + handoverDetailSource, joinText(['来', '料仓']), '页面主文案仍出现来料仓')
assertNotContains(warehousePageSource + handoverDetailSource, joinText(['半成品', '仓']), '页面主文案仍出现半成品仓')

;[
  joinText(['库存', '三态']),
  joinText(['上架', '任务']),
  joinText(['拣货', '波次']),
  joinText(['拣货', '路径']),
  joinText(['库位', '规则']),
  joinText(['完整', '库存账']),
].forEach((token) => {
  assertNotContains(warehousePageSource + handoverDetailSource + warehouseDataSource, token, `本轮不应引入 WMS 能力：${token}`)
})

console.log('check:factory-handover-warehouse-linkage passed')
