#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  getTransferBagContentDisplayItems,
  getTransferBagScanSummaryByQr,
  listCuttingSewingDispatchBatches,
  listCuttingSewingTransferBags,
} from '../src/data/fcs/cutting/sewing-dispatch.ts'
import { listFactoryInternalWarehouses } from '../src/data/fcs/factory-internal-warehouse.ts'
import { getFactoryMobileWarehouseCards, getFactoryMobileWarehouseOverview } from '../src/data/fcs/factory-mobile-warehouse.ts'
import { mockFactories } from '../src/data/fcs/factory-mock-data.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
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
const handoverDataSource = read('src/data/fcs/pda-handover-events.ts')
const mobileWarehouseSource = read('src/data/fcs/factory-mobile-warehouse.ts')
const pdaHandoverPageSource = read('src/pages/pda-handover.ts')
const pdaHandoverDetailSource = read('src/pages/pda-handover-detail.ts')
const pdaTransferBagDetailSource = read('src/pages/pda-transfer-bag-detail.ts')
const pdaWarehouseSource = read('src/pages/pda-warehouse.ts') + read('src/pages/pda-warehouse-shared.ts')
const cuttingSewingPageSource = read('src/pages/process-factory/cutting/sewing-dispatch.ts')
const transferBagsPageSource = read('src/pages/process-factory/cutting/transfer-bags.ts')
const feiTicketsPageSource = read('src/pages/process-factory/cutting/fei-tickets.ts')
const routeSource = read('src/router/routes-pda.ts') + read('src/router/route-renderers.ts')

assertContains(packageSource, 'check:transfer-bag-mobile-closed-loop', 'package.json 缺少中转袋移动端闭环检查命令')
assertContains(dataSource, 'export interface TransferBagContentItem', '缺少通用袋内明细模型')
assertContains(dataSource, "bagMode: '混装'", '中转袋必须明确支持混装')
assertContains(dataSource, 'scanFeiTicketIntoTransferBagOnMobile', '缺少移动端扫菲票装袋 helper')
assertContains(dataSource, 'removeTransferBagContentItemBeforeHandover', '缺少已装袋未交出调整 helper')
assertContains(dataSource, 'assertTransferBagEditableBeforeHandover', '缺少中转袋交出前可编辑断言')
assertContains(dataSource, 'validateTransferBagForMixedPacking', '缺少混装合法性校验')
assertContains(dataSource, 'validateDispatchBatchCompleteness', '发料批次齐套校验必须保留')
assertContains(dataSource, 'getTransferBagScanSummaryByQr', '缺少扫袋识别 helper')
assertContains(dataSource, 'getTransferBagContentDisplayItems', '缺少袋内明细展示 helper')
assertContains(dataSource, 'writebackSewingReceiveByTransferBag', '缺少车缝按袋回写 helper')
assertContains(dataSource, 'writebackSewingReceiveByFeiTicket', '缺少车缝按菲票回写 helper')
assertContains(dataSource, 'finalizeCombinedSewingWriteback', '缺少双口径回写汇总 helper')
assertContains(handoverDataSource, 'TransferBagWritebackLine', '交出记录缺少袋级回写行')
assertContains(handoverDataSource, 'TransferBagFeiTicketWritebackLine', '交出记录缺少菲票级回写行')
assertContains(handoverDataSource, "writebackMode?: '按袋' | '按袋 + 菲票'", '交出记录缺少回写模式')
assertContains(handoverDataSource, 'combinedWritebackStatus', '交出记录缺少组合回写状态')

;[
  '中转袋',
  '新建中转袋',
  '扫码装袋',
  '移除菲票',
  '完成装袋',
  '扫描中转袋',
  '按袋回写',
  '按菲票回写',
  '袋内明细',
].forEach((token) => assertContains(pdaHandoverDetailSource + pdaTransferBagDetailSource, token, `移动端缺少：${token}`))

;['菲票号', '颜色', '尺码', '部位', '数量'].forEach((token) => {
  assertContains(pdaTransferBagDetailSource, token, `袋内明细缺少：${token}`)
})
assertContains(routeSource, '/fcs/pda/transfer-bag-detail', '缺少中转袋移动端详情路由')
assertContains(pdaHandoverPageSource, '待装袋', '交接列表缺少裁床装袋状态')
assertContains(pdaHandoverPageSource, '待收中转袋', '交接列表缺少车缝收袋状态')
assertContains(cuttingSewingPageSource, '中转袋正式支持混装', 'Web 裁片发料页未同步混装口径')
assertContains(transferBagsPageSource, '支持一个中转袋混装', 'Web 中转袋页仍未同步混装口径')
assertContains(feiTicketsPageSource, '袋内状态', '菲票页缺少袋内状态')
assertContains(feiTicketsPageSource, '所属交出记录', '菲票页缺少所属交出记录')

const bags = listCuttingSewingTransferBags()
const batches = listCuttingSewingDispatchBatches()
assert(bags.length > 0, '缺少中转袋数据')
assert(batches.length > 0, '缺少发料批次数据')
assert(bags.every((bag) => bag.dispatchBatchId && bag.transferOrderId), '中转袋必须归属于发料批次与中转单')
assert(bags.every((bag) => bag.bagMode === '混装'), '中转袋必须全部支持混装')
assert(bags.every((bag) => Array.isArray(bag.contentItems)), '中转袋必须有袋内明细数组')
assert(bags.some((bag) => getTransferBagContentDisplayItems(bag.transferBagId).some((item) => item.sourceKind === 'FEI_TICKET')), 'mandatory 当前必须支持裁片菲票装袋')
const scanSummary = getTransferBagScanSummaryByQr(bags[0].transferBagNo)
assert(scanSummary, '扫袋必须能识别中转袋')
assert(scanSummary!.contentSummary.feiTicketCount >= 0, '扫袋结果必须包含菲票数量')

const nonSewingFactory = mockFactories.find((factory) => !factory.name.includes('车缝')) || mockFactories[0]
const cards = getFactoryMobileWarehouseCards(nonSewingFactory.factoryId || nonSewingFactory.id, nonSewingFactory.name)
assert.deepEqual(
  cards.map((card) => card.cardId),
  ['wait-process', 'wait-handover', 'inbound-records', 'outbound-records', 'stocktake', 'difference'],
  '非车缝工厂仓管 6 卡顺序不能变化',
)
const sewingFactory = mockFactories.find((factory) => factory.name.includes('车缝'))
if (sewingFactory) {
  const overview = getFactoryMobileWarehouseOverview(sewingFactory.factoryId || sewingFactory.id, sewingFactory.name)
  assert(overview.isSewingLightweight, '车缝厂仓管必须是轻量接收回写口径')
}
assert(!listFactoryInternalWarehouses().some((warehouse) => warehouse.factoryName.includes('车缝')), '车缝厂不得生成工厂内部仓')
assertContains(mobileWarehouseSource + pdaWarehouseSource, '待收中转袋', '车缝轻量仓管缺少待收中转袋')
assertContains(mobileWarehouseSource + pdaWarehouseSource, '菲票回写', '车缝轻量仓管缺少菲票回写')

;[
  buildToken('Warehouse', 'BaggingOrder'),
  buildToken('Transfer', 'Bag', 'Center'),
  buildToken('Receive', 'Bag', 'Order'),
  buildToken('Bag', 'Writeback', 'Order'),
].forEach((token) => assertNotContains(dataSource + handoverDataSource, token, `不应新增第二套中转袋或回写框架：${token}`))

;[
  buildToken('库存', '三态'),
  buildToken('上架', '任务'),
  buildToken('拣货', '波次'),
  buildToken('完整', '库存账'),
  buildToken('axi', 'os'),
  buildToken('fet', 'ch('),
  buildToken('api', 'Client'),
  buildToken('use', 'Translation'),
  buildToken('e', 'charts'),
  buildToken('re', 'charts'),
].forEach((token) => assertNotContains(dataSource + handoverDataSource + mobileWarehouseSource + pdaHandoverDetailSource, token, `不应新增越界能力：${token}`))

assertNotContains(pdaHandoverPageSource + pdaHandoverDetailSource + pdaTransferBagDetailSource + pdaWarehouseSource, buildToken('QR ', 'payload'), '页面不得显示二维码原始内容')
assertNotContains(pdaHandoverPageSource + pdaHandoverDetailSource + pdaTransferBagDetailSource + pdaWarehouseSource, 'JSON.stringify', '页面不得显示 JSON')
assert(!/>[^<]*PDA/.test(pdaHandoverPageSource + pdaHandoverDetailSource + pdaTransferBagDetailSource + pdaWarehouseSource), '用户可见页面不得出现 PDA')

console.log('check:transfer-bag-mobile-closed-loop passed')
