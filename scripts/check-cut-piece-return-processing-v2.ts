import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  confirmCutPieceReturnReceipt,
  createCutPieceReturnCase,
  createCutPieceReturnLargeTicket,
  createCutPieceReturnSupplementPlan,
  getCutPieceReturnCase,
  listCutPieceReturnInitiationCandidates,
  markCutPieceReturnLargeTicketPrinted,
  resetCutPieceReturnDomainForTesting,
  scrapCutPieceReturnInventory,
  type CutPieceReturnCaseProjection,
  type CutPieceReturnInitiationCandidate,
} from '../src/data/fcs/cutting/cut-piece-return-domain.ts'
import {
  listSupplementOrders,
  resetSupplementOrderRegistryForTesting,
} from '../src/data/fcs/cutting/supplement-order-registry.ts'

function mustGetCase(caseId: string): CutPieceReturnCaseProjection {
  const record = getCutPieceReturnCase(caseId)
  assert.ok(record, `应存在退仓单 ${caseId}`)
  return record
}

function mustGetEligibleCandidate(): CutPieceReturnInitiationCandidate {
  const candidates = listCutPieceReturnInitiationCandidates()
  assert.ok(candidates.length > 0, '正式车缝交出记录应生成退仓发起候选')
  assert.ok(candidates.some((item) => !item.eligible && item.blockedReasons.length > 0), '来源事实不完整的候选必须明确阻断原因')
  const candidate = candidates.find((item) => item.eligible)
  assert.ok(candidate, '至少应存在一个来源完整、可发起退仓的正式车缝交出候选')
  assert.ok(candidate.sourceHandoverRecordIds.length > 0, '发起候选必须冻结来源交出记录')
  assert.ok(candidate.frozenReleaseSnapshotId, '发起候选必须冻结裁片放行快照')
  assert.ok(candidate.frozenMinimumReturnQty > 0, '发起候选必须冻结首次正式交出齐套责任')
  assert.ok(candidate.parts.length > 0, '发起候选必须冻结来源裁片单与部位')
  assert.ok(candidate.styleImageUrl && candidate.parts.every((part) => part.sourceMaterialImageUrl), '发起候选的款式和每种物料必须有正式图片')
  return candidate
}

function manualReceiptLines(candidate: CutPieceReturnInitiationCandidate, pieceQty = 1) {
  return candidate.parts.map((part) => ({
    partCode: part.partCode,
    sourceCutOrderId: part.sourceCutOrderId,
    pieceQty,
    identificationMode: 'MANUAL_PART_SELECTION' as const,
    physicalTicketStatus: 'MISSING' as const,
  }))
}

resetSupplementOrderRegistryForTesting()
resetCutPieceReturnDomainForTesting()

const candidate = mustGetEligibleCandidate()
const beforeCreateExpected = candidate.currentExpectedReturnQty
const created = createCutPieceReturnCase({
  candidateId: candidate.candidateId,
  createdBy: '验收退仓员',
  createdAt: '2026-08-13 09:00:00',
})
assert.equal(created.receiptStatus, '待接收')
assert.equal(created.responsibility.currentExpectedReturnQty, beforeCreateExpected, '仅发起退仓不得改变车缝工厂应回责任')
assert.equal(created.inventoryLots.length, 0, '仅发起退仓不得提前生成退裁片库存')
assert.deepEqual(created.sourceHandoverRecordIds, candidate.sourceHandoverRecordIds, '退仓单应冻结全部来源交出记录')
assert.throws(
  () => createCutPieceReturnCase({ candidateId: candidate.candidateId, createdBy: '验收退仓员' }),
  /已有未结算退仓单/,
  '同一责任范围存在未结算退仓单时必须阻断重复发起',
)

const scannedPart = candidate.parts[0]
assert.ok(scannedPart.historicalTicketExists && scannedPart.oldFeiTicketNo, '验收场景应保留系统历史来源票号')
const wrongScanLines = manualReceiptLines(candidate)
wrongScanLines[0] = {
  ...wrongScanLines[0],
  identificationMode: 'SCAN_OLD_TICKET',
  physicalTicketStatus: 'PRESENT_AND_SCANNED',
  scannedTicketNo: 'TI-WRONG',
}
assert.throws(() => confirmCutPieceReturnReceipt({
  caseId: created.caseId,
  returnedGarmentQty: 2,
  partCounts: wrongScanLines,
  confirmedBy: '验收退仓员',
}), /与冻结来源不匹配/, '扫描到不属于本单的旧菲票必须阻断')

const receiptLines = candidate.parts.map((part, index) => ({
  partCode: part.partCode,
  sourceCutOrderId: part.sourceCutOrderId,
  pieceQty: index === 1 ? 1 : 2,
  identificationMode: index === 0 ? 'SCAN_OLD_TICKET' as const : 'MANUAL_PART_SELECTION' as const,
  physicalTicketStatus: index === 0
    ? 'PRESENT_AND_SCANNED' as const
    : index === 1
      ? 'MISSING' as const
      : 'UNREADABLE' as const,
  scannedTicketNo: index === 0 ? part.oldFeiTicketNo : '',
}))
const received = confirmCutPieceReturnReceipt({
  caseId: created.caseId,
  returnedGarmentQty: 2,
  partCounts: receiptLines,
  confirmedBy: '验收退仓员',
  confirmedAt: '2026-08-13 09:10:00',
})
const receivedPieceQty = receiptLines.reduce((sum, line) => sum + line.pieceQty, 0)
assert.equal(received.responsibility.currentExpectedReturnQty, beforeCreateExpected - 2, '确认退件后只按件扣减车缝工厂应回责任')
assert.equal(received.returnZoneAvailablePieceQty, receivedPieceQty, '各部位应按实际片数进入退裁片库区')
assert.match(received.receipts[0].differenceSummary, /按件确认 2 件/, '部位差异必须保留，但不得反向改写退件件数')
assert.equal(received.receipts[0].partCounts[0].physicalTicketStatus, 'PRESENT_AND_SCANNED', '只有扫描并匹配成功才能记为实物票在场')
assert.equal(received.receipts[0].partCounts[1].physicalTicketStatus, 'MISSING', '未带实物票必须作为独立证据记录')
assert.ok(received.parts[1].historicalTicketExists, '系统历史存在菲票与本次未带实物票必须保持为两个事实')

const partKeys = candidate.parts.map((part) => `${part.sourceCutOrderId}::${part.partCode}`)
const ticketCreated = createCutPieceReturnLargeTicket({
  caseId: created.caseId,
  partKeys,
  createdBy: '验收退仓员',
  createdAt: '2026-08-13 09:12:00',
})
const largeTicket = ticketCreated.largeTickets.at(-1)
assert.ok(largeTicket, '旧实物菲票缺失或不可识别时仍应能按冻结部位快速生成退裁片大菲票')
assert.equal(largeTicket.partLines.reduce((sum, line) => sum + line.pieceQty, 0), receivedPieceQty)
const ticketPrinted = markCutPieceReturnLargeTicketPrinted({
  caseId: created.caseId,
  ticketId: largeTicket.ticketId,
  printedAt: '2026-08-13 09:13:00',
})
assert.equal(ticketPrinted.largeTickets.at(-1)?.printStatus, '已打印')

const scrapPart = candidate.parts[1] ?? candidate.parts[0]
const scrapAvailable = received.inventoryLots
  .filter((lot) => lot.sourceCutOrderId === scrapPart.sourceCutOrderId && lot.partCode === scrapPart.partCode)
  .reduce((sum, lot) => sum + lot.pieceQty - lot.scrappedPieceQty - lot.transferredPieceQty, 0)
assert.throws(() => scrapCutPieceReturnInventory({
  caseId: created.caseId,
  sourceCutOrderId: scrapPart.sourceCutOrderId,
  partCode: scrapPart.partCode,
  pieceQty: 1,
  reason: ' ',
  operatedBy: '验收主管',
}), /必须填写原因/, '报废必须填写原因')
assert.throws(() => scrapCutPieceReturnInventory({
  caseId: created.caseId,
  sourceCutOrderId: scrapPart.sourceCutOrderId,
  partCode: scrapPart.partCode,
  pieceQty: scrapAvailable + 1,
  reason: '破损',
  operatedBy: '验收主管',
}), new RegExp(`仅有 ${scrapAvailable} 片可报废`), '报废超过退裁片库区可用量必须阻断')
const afterScrap = scrapCutPieceReturnInventory({
  caseId: created.caseId,
  sourceCutOrderId: scrapPart.sourceCutOrderId,
  partCode: scrapPart.partCode,
  pieceQty: 1,
  reason: '严重破损，无法继续使用',
  operatedBy: '验收主管',
  operatedAt: '2026-08-13 09:20:00',
})
assert.equal(afterScrap.returnZoneAvailablePieceQty, receivedPieceQty - 1, '报废应从退裁片库区永久核销')
assert.equal(afterScrap.responsibility.currentExpectedReturnQty, received.responsibility.currentExpectedReturnQty, '报废不得二次扣减车缝工厂应回责任')

const expectedAfterReceipt = afterScrap.responsibility.currentExpectedReturnQty
const supplementLines = candidate.parts.map((part, index) => ({
  partCode: part.partCode,
  sourceCutOrderId: part.sourceCutOrderId,
  supplementPieceQty: 7 + index,
}))
const distinctCutOrderIds = new Set(supplementLines.map((line) => line.sourceCutOrderId))
const planned = createCutPieceReturnSupplementPlan({
  caseId: created.caseId,
  finalMakeupGarmentQty: 25,
  partLines: supplementLines,
  createdBy: '验收主管',
  createdAt: '2026-08-13 09:30:00',
})
const plan = planned.supplementPlans.at(-1)
assert.ok(plan, '非报废退仓应创建关联补料单')
assert.equal(plan.finalMakeupGarmentQty, 25, '最终补多少件必须作为独立口径保存')
assert.ok(plan.partLines.every((line) => line.supplementPieceQty > 2), '新补裁部位数量不得被此前清点数量限制')
assert.equal(plan.supplementLinks.length, distinctCutOrderIds.size, '跨原裁片单必须原子拆成一张裁片单一张补料单')
assert.equal(planned.dispositionStatus, '已转补料')
assert.equal(planned.settlementType, 'SUPPLEMENT_CREATED', '补料单创建成功即完成退仓侧结算')
assert.equal(planned.returnZoneAvailablePieceQty, 0, '结算后剩余退裁片应全部转入对应补料业务')
assert.equal(planned.transferredToSupplementPieceQty, receivedPieceQty - 1)
assert.equal(planned.responsibility.currentExpectedReturnQty, expectedAfterReceipt, '创建补料单不得增加或减少车缝工厂应回责任')
planned.inventoryLots.forEach((lot) => {
  assert.equal(lot.pieceQty, lot.scrappedPieceQty + lot.transferredPieceQty, '每个退裁片库存批次必须满足入库=报废+转补料的守恒关系')
})

const returnSupplementOrders = listSupplementOrders().filter((order) => order.sourceReturnCaseId === created.caseId)
assert.equal(returnSupplementOrders.length, distinctCutOrderIds.size)
assert.ok(returnSupplementOrders.every((order) => order.businessSourceType === 'SEWING_RETURN'), '退仓补料必须有独立业务来源“车缝退仓”')
assert.ok(returnSupplementOrders.every((order) => order.reason === '车缝退仓补料' && order.status === '未完成'))
assert.ok(returnSupplementOrders.every((order) => order.sourceReturnOrderNo === created.returnOrderNo))
assert.ok(returnSupplementOrders.every((order) => order.sourceHandoverRecordIds.length > 0))
assert.ok(returnSupplementOrders.every((order) => order.sourceReturnPieceSnapshot.length > 0), '补料单必须冻结对应原裁片单的可复用退裁片快照')
assert.deepEqual(
  new Set(returnSupplementOrders.map((order) => order.cutOrderId)),
  distinctCutOrderIds,
  '每张退仓补料单必须挂在一个具体原裁片单上',
)
assert.throws(() => createCutPieceReturnSupplementPlan({
  caseId: created.caseId,
  finalMakeupGarmentQty: 1,
  partLines: supplementLines,
  createdBy: '验收主管',
}), /已结算/, '退仓结算后不得重复创建补料单')
assert.throws(() => scrapCutPieceReturnInventory({
  caseId: created.caseId,
  sourceCutOrderId: scannedPart.sourceCutOrderId,
  partCode: scannedPart.partCode,
  pieceQty: 1,
  reason: '重复操作',
  operatedBy: '验收主管',
}), /已结算/, '退仓结算后不得再次报废')

const actions = new Set(mustGetCase(created.caseId).operationLogs.map((log) => log.action))
for (const action of ['发起退仓', '来源责任冻结', '确认退件', '报废退裁片', '创建补料单并结算', '生成退裁片大菲票', '打印退裁片大菲票']) {
  assert.ok(actions.has(action as never), `操作追溯应包含：${action}`)
}
for (const removedAction of ['补料裁片到齐', '重新齐套装袋', '正式重新交出']) {
  assert.ok(!actions.has(removedAction as never), `退仓侧不得继续保留旧流程动作：${removedAction}`)
}

const reopenedCandidate = listCutPieceReturnInitiationCandidates().find((item) => item.candidateId === candidate.candidateId)
assert.ok(reopenedCandidate?.eligible, '前一退仓单结算后，同一责任范围可按剩余应回再次发起')
const repeatedScanCase = createCutPieceReturnCase({
  candidateId: candidate.candidateId,
  createdBy: '验收退仓员',
  createdAt: '2026-08-13 10:00:00',
})
const duplicateScanLines = manualReceiptLines(candidate)
duplicateScanLines[0] = {
  ...duplicateScanLines[0],
  identificationMode: 'SCAN_OLD_TICKET',
  physicalTicketStatus: 'PRESENT_AND_SCANNED',
  scannedTicketNo: scannedPart.oldFeiTicketNo,
}
assert.throws(() => confirmCutPieceReturnReceipt({
  caseId: repeatedScanCase.caseId,
  returnedGarmentQty: 1,
  partCounts: duplicateScanLines,
  confirmedBy: '验收退仓员',
}), /禁止重复扫描/, '同一旧菲票不得用于两次退仓清点')

resetSupplementOrderRegistryForTesting()
resetCutPieceReturnDomainForTesting()
const scrapCandidate = mustGetEligibleCandidate()
const scrapCase = createCutPieceReturnCase({ candidateId: scrapCandidate.candidateId, createdBy: '验收退仓员' })
const scrapReceived = confirmCutPieceReturnReceipt({
  caseId: scrapCase.caseId,
  returnedGarmentQty: 1,
  partCounts: manualReceiptLines(scrapCandidate),
  confirmedBy: '验收退仓员',
})
const scrapExpected = scrapReceived.responsibility.currentExpectedReturnQty
let allScrapped = scrapReceived
for (const part of scrapCandidate.parts) {
  allScrapped = scrapCutPieceReturnInventory({
    caseId: scrapCase.caseId,
    sourceCutOrderId: part.sourceCutOrderId,
    partCode: part.partCode,
    pieceQty: 1,
    reason: '全部无法使用',
    operatedBy: '验收主管',
  })
}
assert.equal(allScrapped.returnZoneAvailablePieceQty, 0)
assert.equal(allScrapped.dispositionStatus, '已报废关闭')
assert.equal(allScrapped.settlementType, 'SCRAPPED', '退裁片全部报废后应直接关闭退仓单')
assert.equal(allScrapped.responsibility.currentExpectedReturnQty, scrapExpected, '全量报废也不得二次扣减应回责任')
assert.throws(() => createCutPieceReturnSupplementPlan({
  caseId: scrapCase.caseId,
  finalMakeupGarmentQty: 1,
  partLines: [{
    partCode: scrapCandidate.parts[0].partCode,
    sourceCutOrderId: scrapCandidate.parts[0].sourceCutOrderId,
    supplementPieceQty: 1,
  }],
  createdBy: '验收主管',
}), /已结算/, '全量报废关闭后不得再创建补料')

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const menuSource = readFileSync(`${projectRoot}/src/data/app-shell-config.ts`, 'utf8')
const iconSource = readFileSync(`${projectRoot}/src/icons/shell-icons.ts`, 'utf8')
const routeSource = readFileSync(`${projectRoot}/src/router/routes-fcs.ts`, 'utf8')
const listControllerSource = readFileSync(`${projectRoot}/src/components/ui/process-order-list-controller.ts`, 'utf8')
const pageSource = readFileSync(`${projectRoot}/src/pages/process-factory/cutting/cut-piece-return-processing.ts`, 'utf8')
const supplementSource = readFileSync(`${projectRoot}/src/pages/process-factory/cutting/supplement-management.ts`, 'utf8')
const cutOrderSource = readFileSync(`${projectRoot}/src/pages/process-factory/cutting/cut-orders.ts`, 'utf8')
const warehouseSource = readFileSync(`${projectRoot}/src/pages/process-factory/cutting/warehouse-hub.ts`, 'utf8')
assert.match(menuSource, /裁片退仓处理[^\n]+icon: 'ArchiveRestore'/, '裁片退仓菜单必须配置图标')
assert.match(iconSource, /ArchiveRestore/, 'Shell 图标映射必须实际注册退仓图标')
assert.match(routeSource, /cut-piece-return-processing/)
assert.match(pageSource, /^\/\/ @page-pattern: list/)
assert.match(pageSource, /renderStandardListPage/)
assert.match(pageSource, /createProcessOrderListController/)
assert.match(listControllerSource, /renderStandardListTable/)
assert.match(listControllerSource, /renderTablePagination/)
assert.match(pageSource, /data-cut-piece-return-action="open-create"/, '页面必须提供新增退仓入口')
assert.match(pageSource, /扫描旧菲票并匹配/)
assert.match(pageSource, /未带实物票，手动选部位/)
assert.match(pageSource, /实物票不可识别，手动选部位/)
assert.match(pageSource, /创建补料单并结算退仓/)
assert.match(pageSource, /data-cut-piece-return-print-sheet/)
assert.match(pageSource, /固定 100mm × 100mm/)
assert.doesNotMatch(pageSource, /重新齐套装袋|正式重新交出|confirm-rehandover|create-rekit/)
assert.match(supplementSource, /业务来源/)
assert.match(supplementSource, /人工发起/)
assert.match(supplementSource, /车缝退仓/)
assert.match(supplementSource, /sourceReturnPieceSnapshot/)
assert.match(cutOrderSource, /车缝退仓补料/)
assert.match(cutOrderSource, /人工补料/)
assert.match(warehouseSource, /退裁片库区/)
assert.match(warehouseSource, /非报废裁片在创建补料单时转入对应补料业务/)
assert.match(warehouseSource, /与普通待交出中转袋严格分区，不直接形成待交出库存/)
assert.doesNotMatch(warehouseSource, /rekitBatches|重新齐套待交出/)

console.log('cut-piece return processing contract passed')
