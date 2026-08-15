/*
 * Historical contract retained for review. The executable contract moved to
 * check-cut-piece-return-processing-v2.ts when the product flow was simplified
 * from "return -> supplement -> rekit -> re-handover" to "return -> supplement
 * order created -> return settled".
 *
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  completeCutPieceReturnSupplement,
  confirmCutPieceReturnReceipt,
  confirmCutPieceReturnRehandover,
  createCutPieceReturnLargeTicket,
  createCutPieceReturnRekitBatch,
  createCutPieceReturnSupplementPlan,
  getCutPieceReturnCase,
  markCutPieceReturnLargeTicketPrinted,
  resetCutPieceReturnDomainForTesting,
  scrapCutPieceReturnInventory,
} from '../src/data/fcs/cutting/cut-piece-return-domain.ts'
import {
  listSupplementOrders,
  resetSupplementOrderRegistryForTesting,
} from '../src/data/fcs/cutting/supplement-order-registry.ts'

function mustGetCase(caseId: string) {
  const record = getCutPieceReturnCase(caseId)
  assert.ok(record, `应存在退仓单 ${caseId}`)
  return record
}

resetSupplementOrderRegistryForTesting()
resetCutPieceReturnDomainForTesting()

const initial = mustGetCase('cut-return-001')
assert.equal(initial.responsibility.currentExpectedReturnQty, 200, '首次责任基数应为 200 件')
assert.match(initial.responsibility.formulaText, /200 件（首次正式交出齐套责任） \+ 0 件（后来正式再交出） - 0 件（已确认退件） = 200 件/)

const received = confirmCutPieceReturnReceipt({
  caseId: initial.caseId,
  returnedGarmentQty: 12,
  partCounts: [
    { partCode: 'FRONT', pieceQty: 12 },
    { partCode: 'BACK', pieceQty: 10 },
    { partCode: 'SLEEVE', pieceQty: 12 },
  ],
  confirmedBy: '验收退仓员',
  confirmedAt: '2026-08-13 09:00:00',
})
assert.equal(received.responsibility.currentExpectedReturnQty, 188, '确认退件 12 件后应回责任应降至 188 件')
assert.equal(received.returnZoneAvailablePieceQty, 34, '退裁片库区应按部位实点写入 34 片')
assert.match(received.receipts[0].differenceSummary, /后片少 2 片/, '部位差异应保留，不能篡改确认退件件数')

const ticketCreated = createCutPieceReturnLargeTicket({
  caseId: initial.caseId,
  partCodes: ['FRONT', 'BACK', 'SLEEVE'],
  createdBy: '验收退仓员',
  createdAt: '2026-08-13 09:05:00',
})
const largeTicket = ticketCreated.largeTickets.at(-1)
assert.ok(largeTicket, '旧实物菲票缺失时应能手动生成退裁片大菲票')
assert.equal(largeTicket.partLines.reduce((sum, line) => sum + line.pieceQty, 0), 34)
const ticketPrinted = markCutPieceReturnLargeTicketPrinted({
  caseId: initial.caseId,
  ticketId: largeTicket.ticketId,
  printedAt: '2026-08-13 09:06:00',
})
assert.equal(ticketPrinted.largeTickets.at(-1)?.printStatus, '已打印')

const scrapped = scrapCutPieceReturnInventory({
  caseId: initial.caseId,
  partCode: 'BACK',
  pieceQty: 2,
  operatedBy: '验收主管',
  operatedAt: '2026-08-13 09:10:00',
})
assert.equal(scrapped.returnZoneAvailablePieceQty, 32, '报废应从退裁片库区核销 2 片')
assert.equal(scrapped.scrappedPieceQty, 2)
assert.equal(scrapped.responsibility.currentExpectedReturnQty, 188, '部位报废不得二次扣减车缝工厂应回责任')
assert.throws(() => scrapCutPieceReturnInventory({
  caseId: initial.caseId,
  partCode: 'BACK',
  pieceQty: 99,
  operatedBy: '验收主管',
}), /仅有 8 片可报废/, '报废超过部位可用片数必须阻断')

const planned = createCutPieceReturnSupplementPlan({
  caseId: initial.caseId,
  finalMakeupGarmentQty: 15,
  partLines: [
    { partCode: 'FRONT', supplementPieceQty: 3 },
    { partCode: 'BACK', supplementPieceQty: 7 },
    { partCode: 'SLEEVE', supplementPieceQty: 17 },
  ],
  createdBy: '验收主管',
  createdAt: '2026-08-13 09:20:00',
})
const plan = planned.supplementPlans.at(-1)
assert.ok(plan, '应生成退仓补料计划')
assert.equal(plan.finalMakeupGarmentQty, 15, '最终补齐件数应与部位补裁片数独立保存')
assert.equal(plan.partLines.find((line) => line.partCode === 'SLEEVE')?.supplementPieceQty, 17, '补裁数量可大于此前清点到的 12 片')
assert.equal(plan.supplementLinks.length, 2, '跨两个原裁片单的补裁应拆成两张补料单')
assert.deepEqual(new Set(plan.supplementLinks.map((link) => link.originalCutOrderNo)), new Set(['CUT-260306-101-01', 'CUT-260306-101-02']))

const registeredSupplementOrders = listSupplementOrders()
assert.equal(registeredSupplementOrders.length, 2, '补料计划必须登记到统一补料单事实源')
assert.ok(registeredSupplementOrders.every((order) => order.reason === '裁片退仓后补裁'))
assert.ok(registeredSupplementOrders.every((order) => order.totalQty === 15 && order.status === '未完成'))
assert.throws(() => createCutPieceReturnRekitBatch({
  caseId: initial.caseId,
  finalGarmentQty: 15,
  transferBagCode: 'BAG-SHOULD-BLOCK',
  createdBy: '验收齐套员',
}), /补料尚未完成/, '存在部位差异且补料未完成时必须阻断齐套')

const supplied = completeCutPieceReturnSupplement({
  caseId: initial.caseId,
  planId: plan.planId,
  completedBy: '验收补料员',
  completedAt: '2026-08-13 10:00:00',
})
assert.equal(supplied.returnZoneAvailablePieceQty, 59, '原退回 32 片与补料到齐 27 片应在退裁片库区共同可用')
assert.ok(listSupplementOrders().every((order) => order.status === '已完成'))
assert.throws(() => createCutPieceReturnRekitBatch({
  caseId: initial.caseId,
  finalGarmentQty: 14,
  transferBagCode: 'BAG-SHOULD-BLOCK',
  createdBy: '验收齐套员',
}), /与已确认补料计划的最终补齐 15 件不一致/, '齐套件数必须与补料计划最终件数一致')

const rekitted = createCutPieceReturnRekitBatch({
  caseId: initial.caseId,
  finalGarmentQty: 15,
  transferBagCode: 'BAG-RETURN-ACCEPT-001',
  createdBy: '验收齐套员',
  createdAt: '2026-08-13 10:10:00',
})
const rekitBatch = rekitted.rekitBatches.at(-1)
assert.ok(rekitBatch, '应生成重新齐套批次')
assert.equal(rekitBatch.partCounts.reduce((sum, line) => sum + line.pieceQty, 0), 45, '15 件三部位齐套应装入 45 片')
assert.equal(rekitted.waitHandoverPieceQty, 45, '齐套后应进入裁床待交出仓')
assert.equal(rekitted.returnZoneAvailablePieceQty, 14, '多补的袖片应作为剩余库存留在退裁片库区')
assert.equal(rekitted.responsibility.currentExpectedReturnQty, 188, '仅进入待交出仓不得增加车缝工厂应回责任')

const rehanded = confirmCutPieceReturnRehandover({
  caseId: initial.caseId,
  rekitBatchId: rekitBatch.rekitBatchId,
  handedOverBy: '验收交出仓管',
  handedOverAt: '2026-08-13 10:30:00',
})
assert.equal(rehanded.waitHandoverPieceQty, 0)
assert.equal(rehanded.responsibility.rehandedOverGarmentQty, 15)
assert.equal(rehanded.responsibility.currentExpectedReturnQty, 203, '正式再交出 15 件后应回责任应加回至 203 件')
assert.match(rehanded.responsibility.formulaText, /200 件（首次正式交出齐套责任） \+ 15 件（后来正式再交出） - 12 件（已确认退件） = 203 件/)
const repeatedHandover = confirmCutPieceReturnRehandover({
  caseId: initial.caseId,
  rekitBatchId: rekitBatch.rekitBatchId,
  handedOverBy: '验收交出仓管',
})
assert.equal(repeatedHandover.responsibility.currentExpectedReturnQty, 203, '重复确认正式交出不得重复增加责任')

const operationActions = new Set(rehanded.operationLogs.map((log) => log.action))
for (const action of ['来源责任冻结', '确认退件', '报废退裁片', '创建补料计划', '补料裁片到齐', '重新齐套装袋', '正式重新交出', '生成退裁片大菲票', '打印退裁片大菲票']) {
  assert.ok(operationActions.has(action as never), `操作追溯应包含：${action}`)
}

assert.throws(() => confirmCutPieceReturnReceipt({
  caseId: 'cut-return-002',
  returnedGarmentQty: 339,
  partCounts: [{ partCode: 'FRONT', pieceQty: 339 }],
  confirmedBy: '验收退仓员',
}), /超过当前应回 338 件/, '超出当前应回责任的退件确认必须阻断')

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const menuSource = readFileSync(`${projectRoot}/src/data/app-shell-config.ts`, 'utf8')
const routeSource = readFileSync(`${projectRoot}/src/router/routes-fcs.ts`, 'utf8')
const pageSource = readFileSync(`${projectRoot}/src/pages/process-factory/cutting/cut-piece-return-processing.ts`, 'utf8')
const warehouseSource = readFileSync(`${projectRoot}/src/pages/process-factory/cutting/warehouse-hub.ts`, 'utf8')
assert.match(menuSource, /裁片退仓处理/)
assert.match(menuSource, /\/fcs\/craft\/cutting\/cut-piece-return-processing/)
assert.match(routeSource, /cut-piece-return-processing/)
assert.match(pageSource, /^\/\/ @page-pattern: list/)
assert.match(pageSource, /renderStandardListPage/)
assert.match(pageSource, /createProcessOrderListController/)
assert.match(pageSource, /旧票缺失时可按系统已知部位快速选择/)
assert.match(pageSource, /data-cut-piece-return-print-sheet/)
assert.match(warehouseSource, /退裁片库区与重新齐套待交出/)
assert.match(warehouseSource, /未齐套裁片不得混入正常待交出中转袋/)
assert.match(warehouseSource, /正式交出前不增加车缝工厂应回责任/)
assert.match(
  warehouseSource,
  /const inventoryContent = `<section class="space-y-4">\s*\$\{renderCutPieceReturnWaitHandoverArea\(\)\}/,
  '退裁片库区必须接入待交出仓默认库存页，不能只存在于未渲染的工作台函数中',
)

console.log('cut-piece return processing contract passed')
*/

import './check-cut-piece-return-processing-v2.ts'
