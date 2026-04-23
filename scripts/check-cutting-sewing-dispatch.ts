#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertSewingDispatchAllowed,
  buildRequiredCutPiecesForSewingDispatch,
  getCuttingSewingDispatchByHandoverRecordId,
  getCuttingSewingDispatchProgressByProductionOrder,
  getCuttingSewingDispatchSummary,
  getEligibleFeiTicketsForSewingDispatch,
  listCuttingSewingDispatchBatches,
  listCuttingSewingDispatchOrders,
  listCuttingSewingDispatchValidationResults,
  listCuttingSewingTransferBags,
  validateDispatchBatchCompleteness,
  validateTransferBagCompleteness,
} from '../src/data/fcs/cutting/sewing-dispatch.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { getProductionOrderTechPackSnapshot } from '../src/data/fcs/production-order-tech-pack-runtime.ts'
import { listFactoryWarehouseInboundRecords } from '../src/data/fcs/factory-internal-warehouse.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function resolveRepoPath(relativePath: string): string {
  return path.join(ROOT, relativePath)
}

function read(relativePath: string): string {
  return fs.readFileSync(resolveRepoPath(relativePath), 'utf8')
}

function ensureExists(relativePath: string): void {
  assert(fs.existsSync(resolveRepoPath(relativePath)), `缺少文件：${relativePath}`)
}

function assertContains(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotContains(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

function buildToken(...parts: string[]): string {
  return parts.join('')
}

const packageSource = read('package.json')
const dataSource = read('src/data/fcs/cutting/sewing-dispatch.ts')
const transferBagRuntimeSource = read('src/data/fcs/cutting/transfer-bag-runtime.ts')
const cuttingMetaSource = read('src/pages/process-factory/cutting/meta.ts')
const sewingDispatchPageSource = read('src/pages/process-factory/cutting/sewing-dispatch.ts')
const transferBagsPageSource = read('src/pages/process-factory/cutting/transfer-bags.ts')
const feiTicketsPageSource = read('src/pages/process-factory/cutting/fei-tickets.ts')
const progressSource = read('src/pages/process-factory/cutting/production-progress.ts')
const summarySource = read('src/pages/process-factory/cutting/cutting-summary.ts')
const orderDetailSource = read('src/pages/production/detail-domain.ts')
const handoverSource = read('src/pages/pda-handover.ts') + read('src/pages/pda-handover-detail.ts')
const linkageSource = read('src/data/fcs/factory-warehouse-linkage.ts')
const progressStatisticsSource = read('src/data/fcs/progress-statistics-linkage.ts')
const finalAcceptanceSource = read('scripts/check-fcs-final-acceptance.ts')
const followupSource = read('scripts/check-followup-cleanup.ts')
const sewingDispatchPageAndMetaSource = sewingDispatchPageSource + cuttingMetaSource

ensureExists('src/data/fcs/cutting/sewing-dispatch.ts')
ensureExists('src/pages/process-factory/cutting/sewing-dispatch.ts')
ensureExists('scripts/check-cutting-sewing-dispatch.ts')
assertContains(packageSource, 'check:cutting-sewing-dispatch', 'package.json 缺少裁片发料检查命令')

;[
  'export interface CuttingSewingDispatchOrder',
  'export interface CuttingSewingDispatchBatch',
  'export interface CuttingSewingDispatchSkuQtyLine',
  'export interface CuttingSewingTransferBag',
  'export interface CuttingSewingTransferBagPieceLine',
  'export interface CuttingSewingDispatchValidationResult',
  'buildRequiredCutPiecesForSewingDispatch',
  'getEligibleFeiTicketsForSewingDispatch',
  'createCuttingSewingDispatchOrder',
  'createCuttingSewingDispatchBatch',
  'createCuttingSewingTransferBags',
  'scanFeiTicketIntoTransferBag',
  'scanFeiTicketIntoTransferBagOnMobile',
  'removeFeiTicketFromTransferBag',
  'removeTransferBagContentItemBeforeHandover',
  'validateTransferBagForMixedPacking',
  'validateTransferBagCompleteness',
  'validateDispatchBatchCompleteness',
  'submitCuttingSewingDispatchBatch',
  'syncSewingReceiveWritebackToDispatch',
  'writebackSewingReceiveByTransferBag',
  'writebackSewingReceiveByFeiTicket',
  'finalizeCombinedSewingWriteback',
  'syncSewingQuantityObjectionToDispatch',
  'getCuttingSewingDispatchProgressByProductionOrder',
  'assertSewingDispatchAllowed',
].forEach((token) => {
  assertContains(dataSource, token, `裁片发料数据层缺少：${token}`)
})

;[
  'transferOrderNo',
  'transferOrderQrValue',
  'transferBagNo',
  'transferBagQrValue',
  'bagMode',
  'contentItems',
  'packStatus',
  'currentLocation',
  'plannedSkuQtyLines',
  'requiredPieceQty',
  'scannedPieceQty',
  'missingPieceQty',
  'overPieceQty',
  'specialCraftReturnStatus',
].forEach((token) => {
  assertContains(dataSource, token, `裁片发料模型缺少字段：${token}`)
})

const dispatchOrders = listCuttingSewingDispatchOrders()
const dispatchBatches = listCuttingSewingDispatchBatches()
const transferBags = listCuttingSewingTransferBags()
const validationResults = listCuttingSewingDispatchValidationResults()

assert(dispatchOrders.length > 0, '必须存在裁床发给车缝的发料单数据')
assert(dispatchBatches.length > 0, '必须存在本次发料批次数据')
assert(transferBags.length > 0, '必须存在中转袋数据')
assert(validationResults.length > 0, '必须存在齐套校验结果')
assert(dispatchOrders.some((order) => order.dispatchBatchIds.length >= 2), '必须支持同一生产单多次发料')
assert(dispatchBatches.every((batch) => batch.plannedSkuQtyLines.length > 0), '每次发料必须包含颜色 / 尺码 / 件数')
assert(new Set(dispatchBatches.map((batch) => batch.transferOrderNo)).size === dispatchBatches.length, '中转单号必须唯一')
assert(new Set(transferBags.map((bag) => bag.transferBagNo)).size === transferBags.length, '中转袋号必须唯一')
assert(dispatchBatches.every((batch) => batch.transferOrderQrValue.length > 0), '中转单必须有二维码值')
assert(transferBags.every((bag) => bag.transferBagQrValue.length > 0), '中转袋必须有二维码值')

const sampleForRequiredPieces = dispatchBatches
  .map((batch) => {
    const order = productionOrders.find((item) => item.productionOrderId === batch.productionOrderId)
    const snapshot = order ? getProductionOrderTechPackSnapshot(order.productionOrderId) : undefined
    const requiredResult = order && snapshot
      ? buildRequiredCutPiecesForSewingDispatch(order, snapshot, batch.plannedSkuQtyLines)
      : undefined
    return {
      batch,
      order,
      snapshot,
      requiredResult,
    }
  })
  .find((item) => item.order && item.snapshot && item.requiredResult && item.requiredResult.requiredPieceLines.length > 0)
const sampleBatch = sampleForRequiredPieces?.batch || dispatchBatches[0]
const sampleOrder = sampleForRequiredPieces?.order || productionOrders.find((order) => order.productionOrderId === sampleBatch.productionOrderId)
assert(sampleOrder, '示例发料批次必须关联生产单')
const sampleSnapshot = sampleForRequiredPieces?.snapshot || getProductionOrderTechPackSnapshot(sampleOrder.productionOrderId)
assert(sampleSnapshot, '示例发料批次必须能读取技术包快照')
const requiredResult = sampleForRequiredPieces?.requiredResult || buildRequiredCutPiecesForSewingDispatch(sampleOrder, sampleSnapshot, sampleBatch.plannedSkuQtyLines)
assert(requiredResult.requiredPieceLines.length > 0, '必须能按技术包计算应配裁片')
assert(requiredResult.requiredPieceLines.every((line) => line.requiredPieceQty === line.garmentQty * line.pieceCountPerGarment), '应配数量必须等于本次发料件数乘每件片数')
assert(requiredResult.requiredPieceLines.every((line) => line.colorName && line.sizeCode && line.partName), '应配裁片必须按颜色、尺码、部位计算')

const eligibleTickets = getEligibleFeiTicketsForSewingDispatch({ productionOrderId: sampleBatch.productionOrderId })
assert(eligibleTickets.length > 0, '必须存在可发给车缝的菲票筛选结果')
assert(eligibleTickets.every((ticket) => ticket.productionOrderId === sampleBatch.productionOrderId), '可发给车缝菲票必须属于当前生产单')

const completeBag = transferBags.find((bag) => bag.completeStatus === '已配齐')
assert(completeBag, '必须存在已配齐中转袋示例')
const completeBagValidation = validateTransferBagCompleteness(completeBag.transferBagId)
assert.equal(completeBagValidation.updatedTransferBag.completeStatus, '已配齐', '已配齐中转袋必须通过齐套校验')
assert(completeBagValidation.validationResults.every((item) => !item.blocking), '已配齐中转袋不能存在阻塞项')

const incompleteBag = transferBags.find((bag) => bag.completeStatus !== '已配齐')
assert(incompleteBag, '必须存在未配齐中转袋示例')
const incompleteBagValidation = validateTransferBagCompleteness(incompleteBag.transferBagId)
assert(incompleteBagValidation.validationResults.some((item) => item.blocking), '未配齐中转袋必须存在阻塞项')
assert(
  incompleteBagValidation.validationResults.some((item) => item.validationType === '缺少裁片' || item.validationType === '特殊工艺未回仓'),
  '未配齐中转袋必须体现缺少裁片或特殊工艺未回仓',
)

const completeBatch = dispatchBatches.find((batch) => batch.completeStatus === '已配齐')
assert(completeBatch, '必须存在已配齐发料批次')
const completeBatchValidation = validateDispatchBatchCompleteness(completeBatch.dispatchBatchId)
assert.equal(completeBatchValidation.updatedDispatchBatch.completeStatus, '已配齐', '已配齐批次必须通过齐套校验')
assert.doesNotThrow(() => assertSewingDispatchAllowed(completeBatch.dispatchBatchId), '已配齐批次应允许提交交出')

const blockedBatch = dispatchBatches.find((batch) => batch.completeStatus !== '已配齐')
assert(blockedBatch, '必须存在阻塞发料批次')
const blockedBatchValidation = validateDispatchBatchCompleteness(blockedBatch.dispatchBatchId)
assert.notEqual(blockedBatchValidation.updatedDispatchBatch.completeStatus, '已配齐', '未配齐批次不得通过齐套校验')
assert.throws(() => assertSewingDispatchAllowed(blockedBatch.dispatchBatchId), /未配齐|特殊工艺|差异|异议|重复|已发出/, '未配齐批次不得提交交出')

assert(validationResults.some((item) => item.validationType === '缺少裁片' && item.blocking), '缺少裁片必须阻断交出')
assert(validationResults.some((item) => item.validationType === '特殊工艺未回仓' && item.blocking), '特殊工艺未回仓必须阻断交出')
assert(dataSource.includes('裁片超出') && dataSource.includes('overPieceQty'), '裁片超出必须阻断交出')
assert(dataSource.includes('差异待处理不阻断裁片统一发料'), '特殊工艺差异待处理不应阻断已回仓裁片继续发车缝')
assert(dataSource.includes('currentQty > 0'), '特殊工艺已回仓裁片继续发车缝仍必须 currentQty 大于 0')
assert(dataSource.includes('菲票重复') && dataSource.includes('菲票已发出'), '必须阻断重复或已发出菲票')

const handedOverBatch = dispatchBatches.find((batch) => batch.handoverRecordId)
assert(handedOverBatch?.handoverRecordId, '提交交出必须创建现有交出记录')
const handoverProjection = getCuttingSewingDispatchByHandoverRecordId(handedOverBatch.handoverRecordId)
assert(handoverProjection.dispatchBatch?.transferOrderNo === handedOverBatch.transferOrderNo, '交出记录必须能反查中转单')
assert(handoverProjection.transferBags.length > 0, '交出记录必须能反查中转袋')
assert(dataSource.includes('createFactoryHandoverRecord'), '提交交出必须调用现有交出记录逻辑')
assert(dataSource.includes('linkHandoverRecordToOutboundRecord'), '提交交出必须触发出库联动')
assert(dataSource.includes("receiverKind: '后道工厂'") && dataSource.includes('车缝厂'), '交出接收方必须是车缝厂')
assert(dataSource.includes('sourceFactoryName: order.cuttingFactoryName') && dataSource.includes('sourceFactoryId: order.cuttingFactoryId'), '交出发出方必须是裁床厂')
assert(dataSource.includes('syncSewingReceiveWritebackToDispatch'), '车缝厂回写必须同步发料状态')
assert(dataSource.includes('syncSewingQuantityObjectionToDispatch'), '数量异议必须同步异议中状态')
assert(linkageSource.includes('buildOutboundRecordFromHandoverRecord'), '出库联动必须继续复用 Prompt 4')

const inboundRecords = listFactoryWarehouseInboundRecords()
assert(!inboundRecords.some((record) => record.factoryName.includes('车缝') || String(record.sourceFactoryName || '').includes('车缝')), `不应为${buildToken('车', '缝')}接收方生成内部仓记录`)
assert(!dataSource.includes(buildToken('车', '缝厂', ' · ', '待加工仓')), `不应为${buildToken('车', '缝')}接收方生成${buildToken('待加工', '仓')}`)
assert(!dataSource.includes(buildToken('车', '缝厂', ' · ', '待交出仓')), `不应为${buildToken('车', '缝')}接收方生成${buildToken('待交出', '仓')}`)
assert(!dataSource.includes('sewingFactoryWarehouse'), `不应为${buildToken('车', '缝')}接收方创建内部仓对象`)

const progress = getCuttingSewingDispatchProgressByProductionOrder(sampleBatch.productionOrderId)
assert(progress.totalProductionQty > 0, '发料进度必须包含生产总数')
assert(progress.dispatchBatchCount >= 1, '发料进度必须包含发料批次数')
assert(typeof progress.canCreateNextBatch === 'boolean', '发料进度必须输出是否可继续发料')
const summary = getCuttingSewingDispatchSummary()
assert(summary.remainingGarmentQty >= 0, '发料汇总必须包含剩余未发件数')

;[
  buildToken('裁片', '发料'),
  buildToken('发料单'),
  buildToken('中转单'),
  buildToken('中转袋'),
  buildToken('齐套', '校验'),
  buildToken('交出', '记录'),
  buildToken('回写', '差异'),
  buildToken('新增本次发料'),
  buildToken('扫菲票装袋'),
  buildToken('允许', '混装'),
  buildToken('已装袋未交出可调整'),
  buildToken('按袋回写'),
  buildToken('按菲票回写'),
  buildToken('提交交出'),
].forEach((token) => {
  assertContains(sewingDispatchPageAndMetaSource, token, `裁片发料页面缺少：${token}`)
})

;[
  buildToken('中转袋', '归属中转单'),
  buildToken('裁片发料', '中转袋'),
  buildToken('齐套状态'),
  buildToken('发料状态'),
  buildToken('回写状态'),
  buildToken('差异数量'),
  buildToken('支持一个中转袋混装'),
  buildToken('袋内明细'),
].forEach((token) => {
  assertContains(transferBagsPageSource, token, `中转袋页面缺少裁片发料字段：${token}`)
})

;[
  buildToken('中转单号'),
  buildToken('中转袋号'),
  buildToken('发车缝状态'),
  buildToken('是否已装袋'),
  buildToken('是否已交出'),
  buildToken('车缝回写状态'),
  buildToken('特殊工艺回仓状态'),
].forEach((token) => {
  assertContains(feiTicketsPageSource, token, `菲票页面缺少发车缝状态：${token}`)
})

;[
  buildToken('生产总数'),
  buildToken('累计已发车缝件数'),
  buildToken('剩余未发件数'),
  buildToken('发料批次数'),
  buildToken('是否可继续发料'),
  buildToken('阻塞原因'),
].forEach((token) => {
  assertContains(progressSource + summarySource, token, `裁床生产进度或裁剪总结缺少发料汇总：${token}`)
})

;[
  buildToken('裁片', '发料'),
  buildToken('累计已发件数'),
  buildToken('最近中转单'),
  buildToken('查看裁片发料'),
  buildToken('查看中转袋'),
  buildToken('查看交出记录'),
].forEach((token) => {
  assertContains(orderDetailSource, token, `生产单详情缺少裁片发料汇总：${token}`)
})

;[
  buildToken('中转单'),
  buildToken('中转袋'),
  buildToken('菲票数'),
  buildToken('本次发料件数'),
  buildToken('裁片数量'),
  buildToken('车缝厂回写'),
].forEach((token) => {
  assertContains(handoverSource, token, `工厂端交接缺少裁片发料信息：${token}`)
})

assertContains(cuttingMetaSource, 'sewing-dispatch', '裁片发料页面缺少裁床菜单元信息')
assertContains(finalAcceptanceSource, 'check:cutting-sewing-dispatch', '最终验收检查缺少裁片发料命令')
assertContains(followupSource, 'check:cutting-sewing-dispatch', '后续清理检查缺少裁片发料命令')
assertContains(progressStatisticsSource, 'buildSewingDispatchProgressSnapshot', '统计与进度联动缺少裁片发料进度聚合')
assertContains(progressStatisticsSource, 'getCuttingSewingDispatchProgressByProductionOrder', '裁片发料进度必须被统计联动消费')
assertContains(progressStatisticsSource, '中转袋未配齐时不可交出', '统计联动必须保留未配齐不可交出的校验')
;[
  'mixedTransferBagCount',
  'packedTransferBagCount',
  'scannedReceivedTransferBagCount',
  'partialWritebackTransferBagCount',
  'bagDifferenceCount',
  'feiTicketDifferenceCount',
  'transferBagCombinedWritebackStatus',
  'receivedTransferBagCount',
  'receivedFeiTicketCount',
].forEach((token) => {
  assertContains(progressStatisticsSource, token, `裁片发料袋级/菲票级回写统计缺少：${token}`)
})
;[
  '允许混装',
  '已装袋未交出可调整',
  '按袋回写',
  '按菲票回写',
  '部分回写',
  '已回写',
  '差异',
].forEach((token) => {
  assertContains(sewingDispatchPageSource + transferBagsPageSource + feiTicketsPageSource, token, `裁片发料页面缺少袋级 / 菲票级回写展示：${token}`)
})

;[
  buildToken('Warehouse', 'HandoverOrder'),
  buildToken('Factory', 'OutboundOrder'),
  buildToken('仓库', '交出单'),
  buildToken('新', '交出框架'),
  buildToken('Cutting', 'Sewing', 'HandoverOrder'),
].forEach((token) => {
  assertNotContains(dataSource + sewingDispatchPageSource + handoverSource, token, `不应新增第二套交出框架：${token}`)
})

;[
  buildToken('特殊工艺', '厂', '直接发', '车', '缝'),
  buildToken('直接发', '车', '缝'),
  buildToken('直接发', '成衣', '仓'),
  buildToken('手动', '出库'),
  buildToken('新增', '库存'),
  buildToken('车', '缝厂', '待加工仓'),
  buildToken('车', '缝厂', '待交出仓'),
  buildToken('来料', '仓'),
  buildToken('半成品', '仓'),
].forEach((token) => {
  assertNotContains(sewingDispatchPageSource + transferBagsPageSource + feiTicketsPageSource + orderDetailSource + handoverSource, token, `页面用户可见文案不应出现：${token}`)
})

;[
  buildToken('库存', '三态'),
  buildToken('上架', '任务'),
  buildToken('拣货', '波次'),
  buildToken('库位', '规则'),
  buildToken('完整', '库存账'),
  buildToken('axi', 'os'),
  buildToken('api', 'Client'),
  buildToken('use', 'Translation'),
  buildToken('loc', 'ales'),
  buildToken('trans', 'lations'),
].forEach((token) => {
  assertNotContains(dataSource + sewingDispatchPageSource + transferBagRuntimeSource, token, `本 prompt 不应新增越界能力：${token}`)
})

;[
  'transferOrderQrValue',
  'transferBagQrValue',
].forEach((token) => {
  assertContains(dataSource, token, `数据层必须保留二维码值字段：${token}`)
})
;[
  'FCS:',
  buildToken('QR ', 'payload'),
  'JSON.stringify',
].forEach((token) => {
  assertNotContains(sewingDispatchPageSource + transferBagsPageSource + feiTicketsPageSource + orderDetailSource + handoverSource, `>${token}<`, `页面不得直显二维码原始内容：${token}`)
})

console.log('check:cutting-sewing-dispatch passed')
