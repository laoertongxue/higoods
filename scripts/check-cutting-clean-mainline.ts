#!/usr/bin/env tsx

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { listCutOrderCloseRecords } from '../src/data/fcs/cutting/cut-order-close-records.ts'
import {
  listCuttingMainlineLedgerEvents,
  summarizeCuttingMainlineLedgerEvents,
} from '../src/data/fcs/cutting/cutting-mainline-event-ledger.ts'
import { listGeneratedCutOrderSourceRecords } from '../src/data/fcs/cutting/generated-cut-orders.ts'
import {
  listCuttingActualOutputs,
  listFeiTicketGenerationEligibilityRows,
  listGeneratedFeiTickets,
  listPieceSequenceRangeScenarioRows,
} from '../src/data/fcs/cutting/generated-fei-tickets.ts'
import {
  buildSpecialCraftHandoverGroups,
  buildSpecialCraftReturnProjection,
  buildUniversalHandoverProjection,
  listHandoverAfterRecordResults,
  listHandoverOrders,
  listHandoverRecords,
  listSpecialCraftHandoverCandidates,
  listSpecialCraftReturnInventoryRecords,
  listSpecialCraftReturnRecords,
} from '../src/data/fcs/cutting/handover-orders.ts'
import { listCuttingMaterialLedgerEvents, listMaterialLedgerProjections } from '../src/data/fcs/cutting/material-ledger.ts'
import {
  buildHandoverPickingTaskProjectionFromAllocationProjection,
  buildSewingTaskAllocationProjectionFromInventory,
  type SewingTaskAllocationInventoryRecord,
} from '../src/data/fcs/cutting/sewing-dispatch.ts'
import { buildSpreadingReplenishmentHandlingObjects, listSpreadingDifferences } from '../src/data/fcs/cutting/spreading-differences.ts'
import { buildBindingProcessOrders } from '../src/pages/process-factory/cutting/binding-strip-orders.ts'
import { buildFeiTicketLabelPrintProjection } from '../src/pages/process-factory/cutting/fei-ticket-print-projection.ts'
import {
  buildInboundTempBagInventoryRecords,
  buildInboundTempBagsFromTransferBagViewModel,
} from '../src/pages/process-factory/cutting/transfer-bags-model.ts'
import { buildTransferBagsProjection } from '../src/pages/process-factory/cutting/transfer-bags-projection.ts'

const ROOT = process.cwd()

function repoPath(relativePath: string): string {
  return path.join(ROOT, relativePath)
}

function listFilesRecursively(relativePath: string): string[] {
  const absolutePath = repoPath(relativePath)
  if (!existsSync(absolutePath)) return []
  if (statSync(absolutePath).isFile()) return [relativePath]
  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const child = `${relativePath}/${entry.name}`
    if (entry.isDirectory()) return listFilesRecursively(child)
    return [child]
  })
}

function read(relativePath: string): string {
  return readFileSync(repoPath(relativePath), 'utf8')
}

function assertEvery<T>(items: T[], predicate: (item: T) => boolean, message: string): void {
  const failedIndex = items.findIndex((item) => !predicate(item))
  assert.equal(failedIndex, -1, `${message}，失败位置：${failedIndex}`)
}

function assertIncludes<T>(items: T[], expected: T, message: string): void {
  assert(items.includes(expected), `${message}：缺少 ${String(expected)}`)
}

function scanSourceForForbiddenTerms(): void {
  const trackedJs = execFileSync('git', ['ls-files', 'src/**/*.js', 'vite.config.js'], { encoding: 'utf8' }).trim()
  assert.equal(trackedJs, '', `仍有被 Git 跟踪的 JS 产物：\n${trackedJs}`)

  const scanTargets = ['src/pages/process-factory/cutting', 'src/data/fcs/cutting', 'src/domain/fcs-cutting-runtime', 'src/domain/cutting-core', 'src/domain/cutting-pda-writeback', 'src/router', 'src/data/app-shell-config.ts']
  const files = scanTargets
    .flatMap(listFilesRecursively)
    .filter((file) => /\.(ts|tsx|json)$/.test(file))

  const forbiddenTerms = [
    '可裁排产',
    '原始裁片单',
    '合并裁剪',
    '合并批次',
    '裁片批次',
    '裁剪总结',
    '裁剪总表',
    '唛架方案列表',
    '铺布列表',
    '交出车缝',
    '车缝中转袋',
    '特殊工艺中转袋',
    '中转袋类型',
    '物理分类',
    '未齐套不能交出',
    '齐套后才能交出',
    '特殊工艺未回仓不能交出',
    '待补裁',
    'ledger-placeholder',
    '待审核后生成',
    '模拟回仓',
    'mock-marker-plan',
    'marker-plan-ref',
    'MarkerPlanRef',
    'MarkerSchemeSourceType',
    'MarkerPlanSourceSource',
  ]

  const matches: string[] = []
  files.forEach((file) => {
    const source = read(file)
    forbiddenTerms.forEach((term) => {
      if (source.includes(term)) matches.push(`${file}: ${term}`)
    })
    if (/min-w-\[(1[6-9][0-9][0-9]|2[0-9][0-9][0-9])px\]/.test(source)) {
      matches.push(`${file}: min-w >= 1600px`)
    }
    if (/预留.*事件/.test(source)) {
      matches.push(`${file}: 预留事件文案`)
    }
  })
  assert.equal(matches.length, 0, `旧口径或撑宽写法仍有残留：\n${matches.join('\n')}`)
}

function assertCutOrderAndMaterialLedger(): void {
  const cutOrders = listGeneratedCutOrderSourceRecords()
  assert(cutOrders.length > 0, '裁片单生成源不能为空')
  assertEvery(cutOrders, (row) => Boolean(row.materialIdentity?.materialSku && row.materialIdentity?.materialName && row.materialIdentity?.materialColor && row.materialIdentity?.materialAlias && row.materialIdentity?.materialImageUrl), '裁片单面料身份必须完整')
  assertEvery(cutOrders, (row) => Boolean(row.patternIdentity?.patternFileId && row.patternIdentity?.patternVersion && row.patternIdentity?.effectiveWidthValue && row.patternIdentity?.effectiveWidthUnit), '裁片单纸样身份必须完整')
  assertEvery(cutOrders, (row) => row.generationKey.includes(String(row.materialSku).toLowerCase()) && row.generationKey.includes(String(row.patternIdentity.patternFileId).toLowerCase()) && row.generationKey.includes(String(row.patternIdentity.effectiveWidthValue)), '裁片单 generationKey 必须包含面料、纸样和有效幅宽')

  const eventTypes = Array.from(new Set(listCuttingMaterialLedgerEvents().map((event) => event.eventType)))
	  ;[
	    'TRANSFER_WAREHOUSE_ALLOCATED',
	    'CUTTING_CLAIMED',
	    'SPREADING_ACTUAL_CONSUMED',
	  ].forEach((type) => assertIncludes(eventTypes, type, '数量账事件类型不完整'))

	  const projections = listMaterialLedgerProjections()
	  assert(projections.some((row) => row.cuttingClaimedQty > 0), '数量账缺少裁床领料事实')
	  assert(projections.some((row) => row.spreadingConsumedQty > 0), '数量账缺少实际消耗事实')
	  projections.forEach((row) => {
	    const expected = Math.max(row.cuttingClaimedQty - row.spreadingConsumedQty - row.returnedQty + row.adjustmentQty, 0)
	    assert.equal(row.availableQty, expected, `可用余额公式错误：${row.cutOrderNo}`)
	    assert(row.unit, `数量账缺少单位：${row.cutOrderNo}`)
	  })
}

function assertFeiTicketChain(): void {
  const outputs = listCuttingActualOutputs()
  const tickets = listGeneratedFeiTickets()
  assert(outputs.some((output) => output.actualPieceQty > 0 && output.canGenerateFeiTicket), '缺少可生成菲票的实际裁剪产出')
  assertEvery(tickets, (ticket) => ticket.sourceBasisType === 'ACTUAL_CUTTING_OUTPUT', '菲票必须只基于实际裁剪产出')
  assertEvery(tickets, (ticket) => ticket.actualCutPieceQty > 0 && ticket.sourceOutputLineId && ticket.productionOrderNo && ticket.cutOrderNo && ticket.sourceMarkerPlanNo && ticket.spreadingOrderNo, '菲票追溯字段或实际裁片数量不完整')
  assertEvery(tickets, (ticket) => Boolean(ticket.materialIdentity?.materialSku && ticket.patternIdentity?.patternFileId), '菲票必须带面料和纸样身份')
  assertEvery(tickets, (ticket) => ticket.applicableSkuCodes.length > 0 && Boolean(ticket.applicableSkuLabel), '菲票必须带适用 SKU')
  assertEvery(tickets, (ticket) => ticket.partQuantityPerGarment > 0 && Boolean(ticket.businessSizeLabel), '菲票必须带业务尺码组合和部位数量')
  assert(tickets.some((ticket) => ticket.hasSpecialCraft && ticket.specialCrafts.length > 0), '缺少特殊工艺菲票')
  assert(tickets.some((ticket) => !ticket.hasSpecialCraft), '缺少无特殊工艺菲票')
  tickets.filter((ticket) => ticket.hasSpecialCraft).forEach((ticket) => {
    assertEvery(ticket.specialCrafts, (craft) => Boolean(craft.craftCategory && craft.craftType && craft.receiverFactoryName), `特殊工艺承接工厂缺失：${ticket.feiTicketNo}`)
  })
  assertEvery(tickets, (ticket) => Boolean(ticket.pieceSequenceRange?.basis === '床次层序' && ticket.pieceSequenceLabel && ticket.pieceSequenceRange.startNo === 1), '菲票部位裁片编号范围必须来自床次层序')

  const duplicateKeys = new Set<string>()
  tickets.forEach((ticket) => {
    const key = `${ticket.sourceOutputLineId}|${ticket.partCode}|${ticket.skuSize}|${ticket.skuColor}|${ticket.feiTicketVersion || 'V1'}`
    assert(!duplicateKeys.has(key), `同一实际裁剪产出重复生成有效菲票：${key}`)
    duplicateKeys.add(key)
  })

  const eligibilityRows = listFeiTicketGenerationEligibilityRows()
  assert(eligibilityRows.some((row) => !row.eligibility.canGenerate && row.eligibility.reasonCodes.includes('SPREADING_NOT_CUT_DONE')), '缺少未裁剪不能生成菲票校验')
  assert(eligibilityRows.some((row) => !row.eligibility.canGenerate && row.eligibility.reasonCodes.includes('ACTUAL_OUTPUT_ZERO')), '缺少实际产出为 0 不能生成菲票校验')
  assert(eligibilityRows.some((row) => !row.eligibility.canGenerate && row.eligibility.reasonCodes.includes('DIFFERENCE_PENDING')), '缺少差异未处理不能生成菲票校验')

  const rangeScenarios = listPieceSequenceRangeScenarioRows()
  const highLowRanges = rangeScenarios
    .filter((row) => row.markerModeLabel.includes('高低层') && row.pieceSequenceRange)
    .map((row) => row.pieceSequenceLabel)
  assert(new Set(highLowRanges).size > 1, '缺少高低层按尺码组编号范围场景')
  assert(rangeScenarios.some((row) => row.markerModeLabel.includes('对折') && row.scenarioLabel.includes('不按对折倍数')), '缺少对折编号范围不放大场景')
  assert(rangeScenarios.some((row) => row.scenarioLabel.includes('重复片数') && row.partName.includes('-')), '缺少重复片数通过部位实例表达场景')

  const printProjection = buildFeiTicketLabelPrintProjection(tickets.find((ticket) => ticket.hasSpecialCraft) || tickets[0])
  assert(printProjection.qrPayload.payloadVersion, '菲票二维码 payload 缺少版本号')
  assert(printProjection.qrPayload.feiTicketNo && printProjection.qrPayload.productionOrderNo && printProjection.qrPayload.cutOrderNo && printProjection.qrPayload.spreadingOrderNo, '菲票二维码 payload 缺少追踪字段')
  assert(printProjection.qrPayload.applicableSkuLabel && printProjection.qrPayload.partQuantityPerGarment > 0 && printProjection.qrPayload.businessSizeLabel, '菲票二维码 payload 缺少适用 SKU、部位数量或业务尺码组合')
  assert(printProjection.titleLabel.startsWith('SPU:') && printProjection.materialDisplayLabel && printProjection.markerSpreadingLabel, '菲票打印投影缺少业务方版式标题或关键字段')
  assert(printProjection.specialCraftDisplayLines.length > 0 && printProjection.receiverFactoryDisplayLines.length > 0, '菲票打印投影缺少特殊工艺或承接工厂')
  assert(printProjection.pieceSequenceLabel.includes('编号区间'), '菲票打印投影缺少编号区间')
  assert.equal(printProjection.templateSize, '10cm x 10cm', '菲票默认打印模板必须是 10cm x 10cm')
}

function buildEffectiveInventoryRecords(): SewingTaskAllocationInventoryRecord[] {
  const transferBagViewModel = buildTransferBagsProjection().viewModel
  const inboundTempBags = buildInboundTempBagsFromTransferBagViewModel(transferBagViewModel)
  const inboundInventoryRecords = buildInboundTempBagInventoryRecords(inboundTempBags)
  const specialCraftReturnInventoryRecords = buildSpecialCraftReturnProjection().inventoryRecords.map((record) => ({
    inventoryRecordId: record.inventoryRecordId,
    feiTicketId: record.feiTicketId,
    feiTicketNo: record.feiTicketNo,
    cutOrderId: record.cutOrderId,
    cutOrderNo: record.cutOrderNo,
    productionOrderId: record.productionOrderId,
    productionOrderNo: record.productionOrderNo,
    spuCode: record.spuCode,
    color: record.color,
    size: record.size,
    partName: record.partName,
    pieceQty: record.pieceQty,
    pieceSequenceLabel: record.pieceSequenceLabel,
    hasSpecialCraft: true,
    specialCraftDisplay: record.specialCraftDisplay,
    receiverFactoryDisplay: record.receiverFactoryDisplay,
    printStatus: '已首打',
    voidStatus: '有效',
    tempBagCode: '特殊工艺回仓',
    warehouseArea: record.warehouseArea,
    locationCode: record.locationCode,
    inboundAt: record.inboundAt,
    inventoryStatus: record.specialCraftReadyForSewing ? '待分配' : '特殊工艺未完成',
  }))
  const allocationRuleFixtureRecords: SewingTaskAllocationInventoryRecord[] = [
    {
      inventoryRecordId: 'INV-RULE-VOID-FEI',
      feiTicketId: 'rule-void-fei-ticket',
      feiTicketNo: 'FT-RULE-VOID-FEI',
      cutOrderId: 'cut-order:rule-void',
      cutOrderNo: 'CUT-RULE-VOID',
      productionOrderId: 'PO-RULE',
      productionOrderNo: 'PO-RULE',
      spuCode: 'SPU-RULE',
      color: 'Black',
      size: 'M',
      partName: '前片',
      pieceQty: 10,
      pieceSequenceLabel: '1-10',
      hasSpecialCraft: false,
      specialCraftDisplay: '无',
      receiverFactoryDisplay: '无',
      printStatus: '已首打',
      voidStatus: '已作废',
      tempBagCode: '规则校验',
      warehouseArea: '裁床待交出仓',
      locationCode: 'RULE',
      inboundAt: '2026-05-24 09:00:00',
      inventoryStatus: '待分配',
    },
    {
      inventoryRecordId: 'INV-RULE-WAIT-PRINT-FEI',
      feiTicketId: 'rule-wait-print-fei-ticket',
      feiTicketNo: 'FT-RULE-WAIT-PRINT-FEI',
      cutOrderId: 'cut-order:rule-wait-print',
      cutOrderNo: 'CUT-RULE-WAIT-PRINT',
      productionOrderId: 'PO-RULE',
      productionOrderNo: 'PO-RULE',
      spuCode: 'SPU-RULE',
      color: 'Black',
      size: 'M',
      partName: '后片',
      pieceQty: 10,
      pieceSequenceLabel: '1-10',
      hasSpecialCraft: false,
      specialCraftDisplay: '无',
      receiverFactoryDisplay: '无',
      printStatus: '未首打',
      voidStatus: '有效',
      tempBagCode: '规则校验',
      warehouseArea: '裁床待交出仓',
      locationCode: 'RULE',
      inboundAt: '2026-05-24 09:00:00',
      inventoryStatus: '待分配',
    },
  ]
  return [...inboundInventoryRecords, ...specialCraftReturnInventoryRecords, ...allocationRuleFixtureRecords]
}

function assertWaitHandoverInventoryAndDispatch(): void {
  const transferBagViewModel = buildTransferBagsProjection().viewModel
  const inboundTempBags = buildInboundTempBagsFromTransferBagViewModel(transferBagViewModel)
  assert(inboundTempBags.some((bag) => bag.mixedFlag && !('sewingTaskId' in bag)), '入仓暂存袋必须允许混装且不绑定车缝任务')
  assert(inboundTempBags.every((bag) => bag.useStage === '入仓暂存'), '入仓暂存袋使用阶段错误')

  const allocationProjection = buildSewingTaskAllocationProjectionFromInventory(buildEffectiveInventoryRecords())
  assert(allocationProjection.allocations.length > 0, '车缝任务分配必须基于待交出仓库存生成候选')
  assertEvery(allocationProjection.allocations, (allocation) => allocation.allocationBasis === '基于裁床待交出仓已有菲票 / 裁片库存', '车缝任务分配口径必须基于库存')
  assert(allocationProjection.excludedItems.some((item) => item.exclusionReason.includes('菲票已作废')), '作废菲票必须排除分配')
  assert(allocationProjection.specialCraftPendingItems.length > 0, '特殊工艺未回仓部位必须进入待回仓提示')
  assert(allocationProjection.allocations.some((allocation) => allocation.shortageItems.length > 0), '不齐套分配后必须展示缺口')
  assert(allocationProjection.reservations.length > 0, '库存分配必须生成占用记录')
  assert(allocationProjection.releasedReservations.length > 0, '车缝任务取消后必须有占用释放场景')

  const pickingProjection = buildHandoverPickingTaskProjectionFromAllocationProjection(allocationProjection)
  assert(pickingProjection.tasks.length > 0, '车缝任务分配后必须生成交出装袋确认任务')
  assert(pickingProjection.targetTransferBags.length > 0, '交出装袋确认后必须有中转袋结果')
  assert(pickingProjection.targetTransferBags.some((bag) => bag.useStage === '交出装袋'), '交出装袋阶段使用阶段错误')
  assert(pickingProjection.scanChecks.some((check) => check.checkResult.includes('拒绝') || check.reason.includes('拒绝') || check.reason.includes('不能')), '交出装袋确认必须有错误扫码拒绝场景')
  assert(pickingProjection.syncFailedCount > 0, 'PDA 交出装袋确认同步失败场景必须可见')
}

function assertHandoverAndSpecialCraft(): void {
  const projection = buildUniversalHandoverProjection()
  ;['车缝厂', '辅助工艺厂', '特种工艺厂', '仓库'].forEach((receiverType) => {
    assert(projection.receiverTypes.includes(receiverType), `通用交出缺少接收对象：${receiverType}`)
  })
  ;['车缝交出', '特殊工艺交出', '仓库交出'].forEach((handoverType) => {
    assert(projection.handoverTypes.includes(handoverType), `通用交出缺少业务类型：${handoverType}`)
  })
  assert(listHandoverOrders().some((order) => order.totalRecordCount > 1), '交出单必须支持多条交出记录')
  listHandoverRecords().forEach((record) => {
    assert(record.previousHandedOverSummary.length > 0 && record.currentHandedOverSummary.length > 0 && record.cumulativeHandedOverSummary.length > 0, `交出记录三组数量缺失：${record.handoverRecordNo}`)
    assert(record.transferBagUses.length > 0, `交出记录缺少中转袋：${record.handoverRecordNo}`)
    assert(record.feiTicketItems.length > 0, `交出记录缺少菲票明细：${record.handoverRecordNo}`)
    assert(record.receiverWritebackStatus, `交出记录缺少接收回写：${record.handoverRecordNo}`)
  })
  assert(listHandoverAfterRecordResults().every((result) => result.canSubmitNextRecord), '不齐套或有缺口不能阻止继续新增交出记录')

  const candidates = listSpecialCraftHandoverCandidates()
  assert(candidates.some((candidate) => candidate.canCreateHandover), '特殊工艺必须能从菲票生成交出候选')
  assert(candidates.some((candidate) => !candidate.canCreateHandover && candidate.reasonTexts.join('').includes('承接工厂')), '承接工厂待补充必须阻止正式交出单')
  const groups = buildSpecialCraftHandoverGroups()
  assert(groups.some((group) => group.receiverFactoryName.includes('绣花') || group.craftType === '绣花'), '特殊工艺必须按承接工厂 / 工艺归组')
  assert(groups.some((group) => !group.canCreateHandover), '承接工厂缺失归组必须保留待补充原因')

  const returnRecords = listSpecialCraftReturnRecords()
  assert(returnRecords.some((record) => record.returnStatus === '已回仓'), '缺少特殊工艺全量回仓场景')
  assert(returnRecords.some((record) => record.returnStatus === '部分回仓' && record.discrepancyItems.length > 0), '缺少特殊工艺部分回仓及差异场景')
  assertEvery(returnRecords, (record) => Boolean(record.sourceHandoverOrderId && record.sourceHandoverRecordId), '特殊工艺回仓必须关联原交出单和交出记录')
  const returnInventory = listSpecialCraftReturnInventoryRecords()
  assert(returnInventory.some((record) => record.specialCraftReadyForSewing), '所有必要特殊工艺回仓后必须可参与车缝任务分配')
  assert(returnInventory.some((record) => !record.specialCraftReadyForSewing), '仍有特殊工艺未回仓时必须阻止该菲票参与车缝分配')
}

function assertDifferencesReplenishmentCloseAndBinding(): void {
  const differences = listSpreadingDifferences()
  assertEvery(differences, (difference) => difference.linkedLedgerEventIds.length > 0, '铺布裁剪差异必须关联数量账事件')
  ;['面料余额不足', '实铺小于计划', '实际用量差异', '实裁小于计划', '现场反馈', '卷记录异常'].forEach((type) => {
    assert(differences.some((difference) => difference.differenceType === type), `缺少差异场景：${type}`)
  })

  const replenishmentItems = buildSpreadingReplenishmentHandlingObjects()
  assertEvery(replenishmentItems, (item) => item.reviewResult === '仅记录差异' ? item.linkedLedgerEventIds.length === 0 : item.linkedLedgerEventIds.length > 0, '补料处理对象必须按审核结果关联数量账事件')
  assert(replenishmentItems.some((item) => item.reviewResult === '关闭裁片单' && item.closeReason), '关闭裁片单审核结果必须填写关闭原因')
  assert(replenishmentItems.some((item) => item.reviewResult === '仅记录差异'), '缺少仅记录差异场景')

  const closeRecords = listCutOrderCloseRecords()
  assertEvery(closeRecords, (record) => Boolean(record.closeReasonCode && record.closeReasonText && record.closeDescription && record.closedAt && record.closedBy), '关闭记录必须有关闭原因、说明、人和时间')
  assertEvery(closeRecords, (record) => Boolean(record.ledgerSnapshotBeforeClose && record.openImpactItems.length > 0 && record.linkedLedgerEventIds.length > 0), '关闭记录必须有关闭前数量账快照、影响项和事件')

  const bindingOrders = buildBindingProcessOrders()
  const allowedBindingStatuses = ['待加工', '加工中', '已完成', '已取消'] as const
  assert(bindingOrders.length > 0, '缺少捆条加工单')
  assertEvery(bindingOrders, (order) => allowedBindingStatuses.includes(order.status), '捆条加工单主状态只能表达加工生命周期')
  assert(bindingOrders.some((order) => order.status === '待加工'), '缺少待加工捆条加工单')
  assert(bindingOrders.some((order) => order.status === '加工中' && order.cuttingRecords.length > 0), '缺少分次裁剪中的捆条加工单')
  assert(bindingOrders.some((order) => order.status === '已完成' && order.cuttingRecords.length > 1), '缺少多次完成裁剪的捆条加工单')
  assert(bindingOrders.some((order) => order.bindingDetails.length > 1), '缺少同一加工单多种宽度规格的捆条明细')
  assert(bindingOrders.some((order) => order.differenceStatus === '有差异' && order.differenceRecords.length > 0), '缺少仅记录差异的捆条加工单')
  assert(bindingOrders.some((order) => order.inboundStatus === '已入仓'), '缺少捆条入仓派生状态')
  assert(bindingOrders.some((order) => order.handoverStatus === '已装袋待交出' || order.handoverStatus === '已交出'), '缺少捆条装袋交出派生状态')
  assertEvery(bindingOrders, (order) => !order.sourceSpreadingOrderId && !order.sourceSpreadingOrderNo, '捆条加工单不应绑定具体铺布单')
  bindingOrders.forEach((order) => {
    assertEvery(order.bindingDetails, (detail) => Boolean(detail.bindingWidth > 0 && detail.requiredLength > 0 && detail.feiTicketNo), `捆条明细必须带宽度、计划长度和唯一菲票：${order.bindingOrderNo}`)
  })
  bindingOrders.filter((order) => order.differenceRecords.length > 0).forEach((order) => {
    assert(order.linkedReplenishmentIds.length > 0 || order.linkedLedgerEventIds.length > 0 || order.linkedCheckItemIds.length > 0, `捆条差异必须进入补料、数量账或核查：${order.bindingOrderNo}`)
  })
}

function assertMainlineTransactionLedger(): void {
  const summary = summarizeCuttingMainlineLedgerEvents()
  const expectedStages = ['数量账', 'PDA执行写回', '铺布裁剪差异', '补料管理', '裁片单关闭', '菲票生成', '交出记录', '特殊工艺回仓'] as const
  expectedStages.forEach((stage) => assert((summary.stageCounts[stage] || 0) > 0, `主链路事件账缺少阶段：${stage}`))
  const events = listCuttingMainlineLedgerEvents()
  assert(summary.totalEventCount > 50, '主链路事件账事件数量过少')
  assertEvery(events, (event) => Boolean(event.eventId && event.eventStage && event.sourceObjectId && event.traceText), '主链路事件账必须可追溯')
}

function main(): void {
  scanSourceForForbiddenTerms()
  assertCutOrderAndMaterialLedger()
  assertFeiTicketChain()
  assertWaitHandoverInventoryAndDispatch()
  assertHandoverAndSpecialCraft()
  assertDifferencesReplenishmentCloseAndBinding()
  assertMainlineTransactionLedger()

  console.log(
    JSON.stringify(
      {
        项目代码清洁性: '通过',
        裁片单与数量账: '通过',
        菲票生成与打印追踪: '通过',
        待交出仓库存与车缝分配: '通过',
        通用交出与特殊工艺回仓: '通过',
        补料关闭捆条到账: '通过',
        主链路事件账: summarizeCuttingMainlineLedgerEvents(),
      },
      null,
      2,
    ),
  )
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
}
