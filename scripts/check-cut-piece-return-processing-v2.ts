import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  createAndConfirmCutPieceReturn,
  createCutPieceReturnLargeTicket,
  createCutPieceReturnSupplementPlan,
  findCutPieceReturnSources,
  getCutPieceReturnCase,
  listCutPieceReturnCases,
  listCutPieceReturnFactoriesByProductionOrder,
  listCutPieceReturnInitiationCandidates,
  markCutPieceReturnLargeTicketPrinted,
  resetCutPieceReturnDomainForTesting,
  scrapCutPieceReturnInventory,
  type CutPieceReturnCaseProjection,
  type CutPieceReturnInitiationCandidate,
} from '../src/data/fcs/cutting/cut-piece-return-domain.ts'
import { handoverRecords } from '../src/data/fcs/cutting/handover-orders.ts'
import {
  listSupplementOrders,
  resetSupplementOrderRegistryForTesting,
} from '../src/data/fcs/cutting/supplement-order-registry.ts'

function mustGetCase(caseId: string): CutPieceReturnCaseProjection {
  const record = getCutPieceReturnCase(caseId)
  assert.ok(record, `应存在退仓单 ${caseId}`)
  return record
}

function mustGetTaskCandidate(taskNo = 'ST-260324-001'): CutPieceReturnInitiationCandidate {
  const result = findCutPieceReturnSources({ mode: 'SEWING_TASK', sewingTaskNo: taskNo })
  assert.equal(result.length, 1, `车缝任务 ${taskNo} 应精确定位到一个责任范围`)
  const candidate = result[0]
  assert.ok(candidate.eligible, `车缝任务 ${taskNo} 应可发起退仓：${candidate.blockedReasons.join('；')}`)
  assert.ok(candidate.sourceHandoverRecordIds.length > 0, '来源必须冻结实际接收回写的交出记录')
  assert.ok(candidate.frozenReleaseSnapshotId, '来源必须冻结裁片放行快照')
  assert.ok(candidate.frozenMinimumReturnQty > 0, '来源必须冻结任务级首次正式交出齐套责任')
  assert.ok(candidate.parts.length > 0, '来源必须冻结原裁片单和有效接收部位')
  assert.ok(candidate.styleImageUrl && candidate.parts.every((part) => part.sourceMaterialImageUrl), '款式和每种物料必须有正式图片')
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

const candidate = mustGetTaskCandidate()
assert.equal(candidate.frozenMinimumReturnQty, 200, 'ST-260324-001 的首次任务级齐套责任应冻结为 200 件')
assert.equal(candidate.currentExpectedReturnQty, 188, '历史已确认退件 12 件后，当前最多可退应为 188 件')
assert.deepEqual(
  Object.fromEntries(candidate.parts.map((part) => [part.partCode, {
    effective: part.effectiveHandedPieceQty,
    returned: part.confirmedReturnedPieceQty,
    available: part.currentReturnablePieceQty,
  }])),
  {
    FRONT: { effective: 60, returned: 12, available: 48 },
    BACK: { effective: 60, returned: 12, available: 48 },
    SLEEVE: { effective: 28, returned: 12, available: 16 },
    COLLAR: { effective: 30, returned: 12, available: 18 },
  },
  '每个原裁片单部位必须按实际有效接收量减已确认退回量计算可退上限',
)

const factories = listCutPieceReturnFactoriesByProductionOrder('PO-202603-0101')
assert.deepEqual(factories, [{ factoryId: 'sew-factory-01', factoryName: 'PT Indo Sewing Center' }], '生产单只能返回真实交出记录中的承接工厂')
assert.equal(findCutPieceReturnSources({
  mode: 'PRODUCTION_FACTORY',
  productionOrderNo: 'PO-202603-0101',
  factoryId: 'sew-factory-01',
})[0]?.sewingTaskId, 'ST-260324-001')
assert.equal(findCutPieceReturnSources({ mode: 'SEWING_TASK', sewingTaskNo: 'ST-260324-002' }).length, 0, '未完成接收回写的交出记录不能成为退仓来源')
assert.equal(findCutPieceReturnSources({ mode: 'FEI_TICKET', feiTicketNo: 'FT-260324-001' })[0]?.sewingTaskId, 'ST-260324-001', '菲票号必须反查到实际车缝任务')
assert.equal(findCutPieceReturnSources({ mode: 'FEI_TICKET', feiTicketNo: 'FT-260324-001' })[0]?.matchedFeiTicketNo, 'FT-260324-001')
assert.throws(() => findCutPieceReturnSources({ mode: 'SEWING_TASK', sewingTaskNo: '' }), /请输入车缝任务单号/)
assert.throws(() => findCutPieceReturnSources({ mode: 'PRODUCTION_FACTORY', productionOrderNo: 'PO-202603-0101', factoryId: '' }), /请选择.*车缝工厂/)

const baseRecord = handoverRecords.find((record) => record.handoverRecordId === 'HR-CUT-SEW-260324-001-001')
assert.ok(baseRecord, '多任务验收需要基准正式接收记录')
const splitTaskRecord = structuredClone(baseRecord)
splitTaskRecord.handoverRecordId = 'HR-CUT-SEW-260324-001-SPLIT'
splitTaskRecord.handoverRecordNo = 'JCR-260324-001-SPLIT'
splitTaskRecord.relatedSewingTaskId = 'ST-260324-001-SPLIT'
splitTaskRecord.cutPieceReturnResponsibilitySnapshot = {
  completeKitQtyByColorSize: { 'Black::M': 40 },
  frozenAt: '2026-04-24 14:00',
  basisText: '同一生产单拆出的第二个车缝任务责任。',
}
splitTaskRecord.feiTicketItems = splitTaskRecord.feiTicketItems.map((ticket, index) => ({
  ...ticket,
  feiTicketId: `FT-SPLIT-${index + 1}`,
  feiTicketNo: `FT-SPLIT-${index + 1}`,
}))
splitTaskRecord.transferBagUses = splitTaskRecord.transferBagUses.map((bag, index) => ({
  ...bag,
  bagUseId: `BU-SPLIT-${index + 1}`,
  relatedHandoverRecordId: splitTaskRecord.handoverRecordId,
  relatedSewingTaskId: splitTaskRecord.relatedSewingTaskId,
  containedFeiTicketIds: splitTaskRecord.feiTicketItems.map((ticket) => ticket.feiTicketId),
}))
handoverRecords.push(splitTaskRecord)
try {
  const splitResults = findCutPieceReturnSources({
    mode: 'PRODUCTION_FACTORY',
    productionOrderNo: 'PO-202603-0101',
    factoryId: 'sew-factory-01',
  })
  assert.deepEqual(new Set(splitResults.map((item) => item.sewingTaskId)), new Set(['ST-260324-001', 'ST-260324-001-SPLIT']), '同一生产单和工厂存在多个任务时必须返回多个精确任务供人工选择')
  assert.notEqual(splitResults[0].responsibilityScopeKey, splitResults[1].responsibilityScopeKey, '责任范围必须包含车缝任务，不能把同生产单任务合并')
} finally {
  handoverRecords.pop()
}

const caseCountBeforeFailures = listCutPieceReturnCases().length
assert.throws(() => createAndConfirmCutPieceReturn({
  candidateId: candidate.candidateId,
  returnedGarmentQty: candidate.currentExpectedReturnQty + 1,
  partCounts: manualReceiptLines(candidate),
  confirmedBy: '验收退仓员',
}), /超过当前应回 188 件/, '退仓件数超过任务当前可退件数必须阻断')
const overPartLines = manualReceiptLines(candidate)
overPartLines[0].pieceQty = candidate.parts[0].currentReturnablePieceQty + 1
assert.throws(() => createAndConfirmCutPieceReturn({
  candidateId: candidate.candidateId,
  returnedGarmentQty: 1,
  partCounts: overPartLines,
  confirmedBy: '验收退仓员',
}), /超过当前可退 48 片/, '任一部位超过实际有效交出剩余片数必须阻断')
const wrongScanLines = manualReceiptLines(candidate)
wrongScanLines[0] = {
  ...wrongScanLines[0],
  identificationMode: 'SCAN_OLD_TICKET',
  physicalTicketStatus: 'PRESENT_AND_SCANNED',
  scannedTicketNo: 'FT-WRONG',
}
assert.throws(() => createAndConfirmCutPieceReturn({
  candidateId: candidate.candidateId,
  returnedGarmentQty: 1,
  partCounts: wrongScanLines,
  confirmedBy: '验收退仓员',
}), /与冻结来源不匹配/, '扫描到不属于本任务部位的菲票必须阻断')
assert.equal(listCutPieceReturnCases().length, caseCountBeforeFailures, '任一原子确认失败都不得留下空的待接收退仓单')

const scannedPart = candidate.parts[0]
assert.ok(scannedPart.historicalTicketExists && scannedPart.oldFeiTicketNo, '系统应保留历史来源菲票号，但不推断本次实物票在场')
const receiptLines = candidate.parts.map((part, index) => ({
  partCode: part.partCode,
  sourceCutOrderId: part.sourceCutOrderId,
  pieceQty: index === 1 ? 1 : 2,
  identificationMode: index === 0 ? 'SCAN_OLD_TICKET' as const : 'MANUAL_PART_SELECTION' as const,
  physicalTicketStatus: index === 0
    ? 'PRESENT_AND_SCANNED' as const
    : index === 1 ? 'MISSING' as const : 'UNREADABLE' as const,
  scannedTicketNo: index === 0 ? part.oldFeiTicketNo : '',
}))
const received = createAndConfirmCutPieceReturn({
  candidateId: candidate.candidateId,
  returnedGarmentQty: 2,
  partCounts: receiptLines,
  confirmedBy: '验收退仓员',
  confirmedAt: '2026-08-13 09:10:00',
})
const receivedPieceQty = receiptLines.reduce((sum, line) => sum + line.pieceQty, 0)
assert.equal(received.receiptStatus, '已确认退件', '新增退仓必须原子创建并确认，不产生新的待接收状态')
assert.equal(received.responsibility.currentExpectedReturnQty, 186, '确认 2 件后任务当前应回应从 188 降至 186 件')
assert.equal(received.returnZoneAvailablePieceQty, receivedPieceQty, '各部位按实际片数原子进入退裁片库区')
assert.match(received.receipts[0].differenceSummary, /按件确认 2 件/, '件片差异只记录，不反向改写件数')
assert.equal(received.receipts[0].partCounts[0].physicalTicketStatus, 'PRESENT_AND_SCANNED', '只有本次扫描匹配才可记实物票在场')
assert.equal(received.receipts[0].partCounts[1].physicalTicketStatus, 'MISSING', '未带实物票必须作为独立现场证据')
assert.ok(received.parts[1].historicalTicketExists, '系统有历史票号与本次未带实物票必须并存')
assert.deepEqual(received.sourceHandoverRecordIds, candidate.sourceHandoverRecordIds, '退仓单必须冻结精确任务的全部有效交出记录')

const partKeys = candidate.parts.map((part) => `${part.sourceCutOrderId}::${part.partCode}`)
const ticketCreated = createCutPieceReturnLargeTicket({
  caseId: received.caseId,
  partKeys,
  createdBy: '验收退仓员',
  createdAt: '2026-08-13 09:12:00',
})
const largeTicket = ticketCreated.largeTickets.at(-1)
assert.ok(largeTicket, '旧实物菲票缺失或不可识别时仍应能按冻结部位快速生成退裁片大菲票')
assert.equal(largeTicket.partLines.reduce((sum, line) => sum + line.pieceQty, 0), receivedPieceQty)
const ticketPrinted = markCutPieceReturnLargeTicketPrinted({
  caseId: received.caseId,
  ticketId: largeTicket.ticketId,
  printedAt: '2026-08-13 09:13:00',
})
assert.equal(ticketPrinted.largeTickets.at(-1)?.printStatus, '已打印')

const scrapPart = candidate.parts[1] ?? candidate.parts[0]
const scrapAvailable = received.inventoryLots
  .filter((lot) => lot.sourceCutOrderId === scrapPart.sourceCutOrderId && lot.partCode === scrapPart.partCode)
  .reduce((sum, lot) => sum + lot.pieceQty - lot.scrappedPieceQty - lot.transferredPieceQty, 0)
assert.throws(() => scrapCutPieceReturnInventory({
  caseId: received.caseId,
  sourceCutOrderId: scrapPart.sourceCutOrderId,
  partCode: scrapPart.partCode,
  pieceQty: 1,
  reason: ' ',
  operatedBy: '验收主管',
}), /必须填写原因/)
assert.throws(() => scrapCutPieceReturnInventory({
  caseId: received.caseId,
  sourceCutOrderId: scrapPart.sourceCutOrderId,
  partCode: scrapPart.partCode,
  pieceQty: scrapAvailable + 1,
  reason: '破损',
  operatedBy: '验收主管',
}), new RegExp(`仅有 ${scrapAvailable} 片可报废`))
const afterScrap = scrapCutPieceReturnInventory({
  caseId: received.caseId,
  sourceCutOrderId: scrapPart.sourceCutOrderId,
  partCode: scrapPart.partCode,
  pieceQty: 1,
  reason: '严重破损，无法继续使用',
  operatedBy: '验收主管',
  operatedAt: '2026-08-13 09:20:00',
})
assert.equal(afterScrap.returnZoneAvailablePieceQty, receivedPieceQty - 1, '报废从退裁片库区永久核销')
assert.equal(afterScrap.responsibility.currentExpectedReturnQty, received.responsibility.currentExpectedReturnQty, '报废不二次改变车缝责任')

const supplementLines = candidate.parts.map((part, index) => ({
  partCode: part.partCode,
  sourceCutOrderId: part.sourceCutOrderId,
  supplementPieceQty: 7 + index,
}))
const distinctCutOrderIds = new Set(supplementLines.map((line) => line.sourceCutOrderId))
const planned = createCutPieceReturnSupplementPlan({
  caseId: received.caseId,
  finalMakeupGarmentQty: 25,
  partLines: supplementLines,
  createdBy: '验收主管',
  createdAt: '2026-08-13 09:30:00',
})
const plan = planned.supplementPlans.at(-1)
assert.ok(plan)
assert.equal(plan.finalMakeupGarmentQty, 25, '最终补多少件作为独立件数口径保存')
assert.ok(plan.partLines.every((line) => line.supplementPieceQty > 2), '新补裁片数不受此前退回清点数量限制')
assert.equal(plan.supplementLinks.length, distinctCutOrderIds.size, '每个原裁片单拆成独立补料单')
assert.equal(planned.settlementType, 'SUPPLEMENT_CREATED', '创建补料单即结算非报废退仓')
assert.equal(planned.returnZoneAvailablePieceQty, 0)
assert.equal(planned.responsibility.currentExpectedReturnQty, afterScrap.responsibility.currentExpectedReturnQty, '创建补料不改变工厂当前应回')
planned.inventoryLots.forEach((lot) => assert.equal(lot.pieceQty, lot.scrappedPieceQty + lot.transferredPieceQty, '退裁片库存必须守恒'))

const returnSupplementOrders = listSupplementOrders().filter((order) => order.sourceReturnCaseId === received.caseId)
assert.equal(returnSupplementOrders.length, distinctCutOrderIds.size)
assert.ok(returnSupplementOrders.every((order) => order.businessSourceType === 'SEWING_RETURN'))
assert.ok(returnSupplementOrders.every((order) => order.reason === '车缝退仓补料' && order.status === '未完成'))
assert.ok(returnSupplementOrders.every((order) => order.sourceReturnOrderNo === received.returnOrderNo))
assert.ok(returnSupplementOrders.every((order) => order.sourceHandoverRecordIds.length > 0))
assert.ok(returnSupplementOrders.every((order) => order.sourceReturnPieceSnapshot.length > 0))
assert.deepEqual(new Set(returnSupplementOrders.map((order) => order.cutOrderId)), distinctCutOrderIds)
assert.throws(() => createCutPieceReturnSupplementPlan({
  caseId: received.caseId,
  finalMakeupGarmentQty: 1,
  partLines: supplementLines,
  createdBy: '验收主管',
}), /已结算/)

const duplicateCandidate = mustGetTaskCandidate()
const caseCountBeforeDuplicateScan = listCutPieceReturnCases().length
const duplicateScanLines = manualReceiptLines(duplicateCandidate)
duplicateScanLines[0] = {
  ...duplicateScanLines[0],
  identificationMode: 'SCAN_OLD_TICKET',
  physicalTicketStatus: 'PRESENT_AND_SCANNED',
  scannedTicketNo: scannedPart.oldFeiTicketNo,
}
assert.throws(() => createAndConfirmCutPieceReturn({
  candidateId: duplicateCandidate.candidateId,
  returnedGarmentQty: 1,
  partCounts: duplicateScanLines,
  confirmedBy: '验收退仓员',
}), /禁止重复扫描/)
assert.equal(listCutPieceReturnCases().length, caseCountBeforeDuplicateScan, '重复菲票扫描失败不得留下退仓单')

const actions = new Set(mustGetCase(received.caseId).operationLogs.map((log) => log.action))
for (const action of ['发起退仓', '来源责任冻结', '确认退件', '报废退裁片', '创建补料单并结算', '生成退裁片大菲票', '打印退裁片大菲票']) {
  assert.ok(actions.has(action as never), `操作追溯应包含：${action}`)
}
for (const removedAction of ['补料裁片到齐', '重新齐套装袋', '正式重新交出']) {
  assert.ok(!actions.has(removedAction as never), `退仓侧不得保留旧流程动作：${removedAction}`)
}

resetSupplementOrderRegistryForTesting()
resetCutPieceReturnDomainForTesting()
const scrapCandidate = mustGetTaskCandidate()
const scrapReceived = createAndConfirmCutPieceReturn({
  candidateId: scrapCandidate.candidateId,
  returnedGarmentQty: 1,
  partCounts: manualReceiptLines(scrapCandidate),
  confirmedBy: '验收退仓员',
})
const scrapExpected = scrapReceived.responsibility.currentExpectedReturnQty
let allScrapped = scrapReceived
for (const part of scrapCandidate.parts) {
  allScrapped = scrapCutPieceReturnInventory({
    caseId: scrapReceived.caseId,
    sourceCutOrderId: part.sourceCutOrderId,
    partCode: part.partCode,
    pieceQty: 1,
    reason: '全部无法使用',
    operatedBy: '验收主管',
  })
}
assert.equal(allScrapped.returnZoneAvailablePieceQty, 0)
assert.equal(allScrapped.dispositionStatus, '已报废关闭')
assert.equal(allScrapped.settlementType, 'SCRAPPED')
assert.equal(allScrapped.responsibility.currentExpectedReturnQty, scrapExpected, '全量报废也不二次改变应回责任')

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const menuSource = readFileSync(`${projectRoot}/src/data/app-shell-config.ts`, 'utf8')
const iconSource = readFileSync(`${projectRoot}/src/icons/shell-icons.ts`, 'utf8')
const routeSource = readFileSync(`${projectRoot}/src/router/routes-fcs.ts`, 'utf8')
const listControllerSource = readFileSync(`${projectRoot}/src/components/ui/process-order-list-controller.ts`, 'utf8')
const pageSource = readFileSync(`${projectRoot}/src/pages/process-factory/cutting/cut-piece-return-processing.ts`, 'utf8')
const supplementSource = readFileSync(`${projectRoot}/src/pages/process-factory/cutting/supplement-management.ts`, 'utf8')
const cutOrderSource = readFileSync(`${projectRoot}/src/pages/process-factory/cutting/cut-orders.ts`, 'utf8')
const warehouseSource = readFileSync(`${projectRoot}/src/pages/process-factory/cutting/warehouse-hub.ts`, 'utf8')
assert.match(menuSource, /裁片退仓处理[^\n]+icon: 'ArchiveRestore'/)
assert.match(iconSource, /ArchiveRestore/)
assert.match(routeSource, /cut-piece-return-processing/)
assert.match(pageSource, /^\/\/ @page-pattern: list/)
assert.match(pageSource, /renderStandardListPage/)
assert.match(pageSource, /createProcessOrderListController/)
assert.match(listControllerSource, /renderStandardListTable/)
assert.match(listControllerSource, /renderTablePagination/)
assert.match(pageSource, /查看退裁片库区<\/a><button[^>]+data-cut-piece-return-action="open-create">新增退仓<\/button>/, '新增退仓必须位于标题操作区最右侧')
assert.match(pageSource, /车缝任务单号/)
assert.match(pageSource, /生产单 \+ 车缝工厂/)
assert.match(pageSource, /菲票号/)
assert.match(pageSource, /不展示全量交出候选/)
assert.match(pageSource, /createAndConfirmCutPieceReturn/)
assert.doesNotMatch(pageSource, /createCutPieceReturnCase/)
assert.match(pageSource, /扫描旧菲票并匹配/)
assert.match(pageSource, /未带实物票，手动选部位/)
assert.match(pageSource, /该查找不代表本次实物票在场/)
assert.match(pageSource, /有效交出.*已退.*可退/)
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

assert.ok(listCutPieceReturnInitiationCandidates().every((item) => item.responsibilityScopeKey.includes(item.sewingTaskId)), '所有责任范围必须包含车缝任务')
console.log('cut-piece return processing v3 contract passed')
