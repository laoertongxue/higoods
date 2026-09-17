import assert from 'node:assert/strict'
import test from 'node:test'

import { productionDemands } from '../../src/data/fcs/production-demands.ts'
import { listDyeWorkOrders } from '../../src/data/fcs/dyeing-task-domain.ts'
import { cancelProductionDemandPrintWorkOrder, listPrintWorkOrders } from '../../src/data/fcs/printing-task-domain.ts'
import type { FormalProductionOrderProcessSnapshot } from '../../src/data/fcs/process-work-order-domain.ts'
import {
  EARLY_PROCESS_ACCEPTANCE_ROWS,
  calculateEarlyProcessPlannedQty,
  createProductionDemandEarlyProcessWorkOrder,
  ensureProductionDemandEarlyProcessAcceptanceData,
  listEarlyProcessCreateCandidates,
  prepareProductionDemandEarlyMatches,
} from '../../src/data/fcs/production-demand-early-process-work-orders.ts'

function demand(id: string) {
  const result = productionDemands.find(item => item.demandId === id)
  assert.ok(result, `missing demand ${id}`)
  return result
}

function snapshot(input: {
  processCode: 'DYE' | 'PRINT'
  productionOrderId: string
  inputSku: string
  outputSku: string
  plannedQty?: number
}): FormalProductionOrderProcessSnapshot {
  return {
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderId,
    orderedAt: '2026-09-17 10:00:00',
    techPackVersionId: `TP-${input.productionOrderId}`,
    techPackVersionLabel: 'V1.0',
    processEntryId: `${input.processCode}-ENTRY-1`,
    routeObjectKey: 'BOM:FORMAL-MERGED',
    materialId: input.inputSku,
    materialName: '合并生产单主面料',
    materialItems: [{ sourceBomItemId: 'BOM-FORMAL-MERGED', materialId: input.inputSku, materialName: '合并生产单主面料', materialType: '面料' }],
    inputMaterialSkuId: input.inputSku,
    inputMaterialSkuCode: input.inputSku,
    inputMaterialName: '加工投入',
    inputMaterialImageUrl: '/materials/process-orders/greige-cotton-polyester-woven.jpg',
    outputMaterialSkuId: input.outputSku,
    outputMaterialSkuCode: input.outputSku,
    outputMaterialName: '加工产出',
    outputMaterialImageUrl: '/materials/process-orders/fog-blue-woven.png',
    targetColor: '黑色',
    plannedQty: input.plannedQty ?? 3000,
    qtyUnit: '米',
    processCodes: [input.processCode],
    dyeProcessName: input.processCode === 'DYE' ? '染色' : undefined,
    printProcessName: input.processCode === 'PRINT' ? '印花' : undefined,
    spuCode: 'SPU-TSHIRT-081',
    spuName: '春季休闲印花短袖 T 恤',
    requiredDeliveryDate: '2026-04-15',
  }
}

function create(processCode: 'DYE' | 'PRINT', productionDemandId: string, inputSku: string, outputSku: string) {
  const candidate = listEarlyProcessCreateCandidates(processCode).find(item => item.demand.demandId === productionDemandId)
  assert.ok(candidate, `missing ${processCode} task candidate for ${productionDemandId}`)
  return createProductionDemandEarlyProcessWorkOrder({
    processCode,
    productionDemandId,
    professionalTaskId: candidate.professionalTaskId,
    inputMaterialSkuCode: inputSku,
    outputMaterialSkuCode: outputSku,
    materialName: '合并生产单主面料',
    materialImageUrl: '/materials/process-orders/greige-cotton-polyester-woven.jpg',
    targetColor: '黑色',
    estimatedUnitConsumption: 1.5,
    estimatedLossRate: 0.05,
    qtyUnit: '米',
    factoryId: processCode === 'DYE' ? 'F090' : 'FAC-FLOWER',
    factoryName: processCode === 'DYE' ? '全能力测试工厂（F090）' : 'FLOWER',
    operatorName: '管理员',
    operatorRole: '管理员',
  }, `2026-09-17 10:${productionDemandId.slice(-2)}:00`)
}

test('验收数据至少包含 5 张染色和 5 张印花提前加工单，并覆盖全部匹配状态', () => {
  ensureProductionDemandEarlyProcessAcceptanceData()
  const dyeRows = listDyeWorkOrders().filter(order => order.sourceSnapshot?.sourceType === 'PRODUCTION_DEMAND')
  const printRows = listPrintWorkOrders().filter(order => order.sourceSnapshot?.sourceType === 'PRODUCTION_DEMAND')
  assert.ok(dyeRows.length >= 5)
  assert.ok(printRows.length >= 5)
  const expected = new Set(['WAIT_PRODUCTION_ORDER', 'WAIT_TECH_PACK', 'MATCHED', 'MATCH_FAILED', 'CANCELLED'])
  assert.deepEqual(new Set(dyeRows.map(order => order.sourceSnapshot?.matchStatus).filter(Boolean)), expected)
  assert.deepEqual(new Set(printRows.map(order => order.sourceSnapshot?.matchStatus).filter(Boolean)), expected)
  const mergedPrintRows = printRows.filter(order => order.sourceSnapshot?.matchedProductionOrderId === 'PO-EARLY-MERGED-001')
  assert.equal(mergedPrintRows.length, 2)
  assert.equal(new Set(mergedPrintRows.map(order => order.sourceSnapshot?.productionDemandId)).size, 2)
  assert.ok(EARLY_PROCESS_ACCEPTANCE_ROWS.length >= 12)
})

test('印花专业成果把多张图片和多个文件统一保存在同一附件集合', () => {
  const candidate = listEarlyProcessCreateCandidates('PRINT').find(item => item.eligible)
  assert.ok(candidate)
  assert.ok(candidate.professionalResultAttachments.filter(file => file.mimeType.startsWith('image/')).length >= 2)
  assert.ok(candidate.professionalResultAttachments.filter(file => !file.mimeType.startsWith('image/')).length >= 2)
})

test('同一生产需求可手动选择具体专业任务，创建结果保存所选任务与全部成果附件', () => {
  const candidates = listEarlyProcessCreateCandidates('PRINT').filter(item => item.demand.demandId === 'DEM-202603-0094')
  assert.ok(candidates.length >= 2)
  const selected = candidates[1]
  const result = createProductionDemandEarlyProcessWorkOrder({
    processCode: 'PRINT', productionDemandId: selected.demand.demandId, professionalTaskId: selected.professionalTaskId,
    inputMaterialSkuCode: 'FAB-DYED-MANUAL-094', outputMaterialSkuCode: 'FAB-PRINT-MANUAL-094',
    materialName: selected.defaultMaterialName, materialImageUrl: selected.defaultMaterialImageUrl,
    targetColor: selected.defaultTargetColor, estimatedUnitConsumption: 1.35, estimatedLossRate: 0.05,
    qtyUnit: '米', factoryId: 'FAC-PRINT-FLOWER', factoryName: 'FLOWER', operatorName: '管理员', operatorRole: '管理员',
  }, '2026-09-17 13:00:00')
  const created = listPrintWorkOrders().find(order => order.printOrderId === result.workOrderId)
  assert.equal(created?.sourceSnapshot?.professionalTaskId, selected.professionalTaskId)
  assert.equal(created?.sourceSnapshot?.professionalResultId, selected.professionalResultId)
  assert.deepEqual(created?.sourceSnapshot?.professionalResultAttachments, selected.professionalResultAttachments)
  cancelProductionDemandPrintWorkOrder(result.workOrderId, { operatorName: '管理员', operatorRole: '管理员', reason: '单测清理', cancelledAt: '2026-09-17 13:01:00' })
})

test('创建提前加工单必须选择所属专业任务并明确加工厂', () => {
  const candidate = listEarlyProcessCreateCandidates('DYE').find(item => item.eligible)
  assert.ok(candidate)
  const base = {
    processCode: 'DYE' as const, productionDemandId: candidate.demand.demandId,
    inputMaterialSkuCode: 'FAB-GREIGE-GATE', outputMaterialSkuCode: 'FAB-DYED-GATE',
    materialName: candidate.defaultMaterialName, materialImageUrl: candidate.defaultMaterialImageUrl,
    targetColor: candidate.defaultTargetColor, estimatedUnitConsumption: 1.35, estimatedLossRate: 0.05,
    qtyUnit: '米', operatorName: '管理员', operatorRole: '管理员',
  }
  assert.throws(() => createProductionDemandEarlyProcessWorkOrder({ ...base, professionalTaskId: 'NOT-IN-DEMAND', factoryId: 'F090', factoryName: '全能力测试工厂（F090）' }), /请选择属于生产需求单/)
  assert.throws(() => createProductionDemandEarlyProcessWorkOrder({ ...base, professionalTaskId: candidate.professionalTaskId, factoryId: '', factoryName: '' }), /必须明确加工厂/)
})

test('计划加工数量包含损耗率，且染色印花投入与产出 SKU 必须不同', () => {
  assert.equal(calculateEarlyProcessPlannedQty(1000, 1.8, 0.05), 1890)
  assert.throws(() => calculateEarlyProcessPlannedQty(1000, 0, 0.05), /必须大于 0/)
  assert.throws(() => create('DYE', 'DEM-202603-0093', 'SAME-SKU', 'SAME-SKU'), /不能相同/)
})

test('专业成果未审核通过时不可创建提前加工单', () => {
  const candidate = listEarlyProcessCreateCandidates('DYE').find(item => item.demand.demandId === 'DEM-202603-0006')
  assert.equal(candidate?.eligible, false)
  assert.match(candidate?.ineligibleReason || '', /待买手审核通过/)
  assert.throws(() => create('DYE', 'DEM-202603-0006', 'RAW-006', 'DYED-006'), /待买手审核通过/)
})

test('多个生产需求合并为一张生产单时，可匹配多张提前染色加工单', () => {
  const first = create('DYE', 'DEM-202603-0093', 'RAW-MERGED-DYE', 'DYED-MERGED-DYE')
  const second = create('DYE', 'DEM-202603-0094', 'RAW-MERGED-DYE', 'DYED-MERGED-DYE')
  assert.throws(
    () => create('DYE', 'DEM-202603-0093', 'RAW-MERGED-DYE', 'DYED-MERGED-DYE'),
    /已有有效加工单/,
  )
  const plannedQtyById = new Map(
    listDyeWorkOrders()
      .filter(order => [first.workOrderId, second.workOrderId].includes(order.dyeOrderId))
      .map(order => [order.dyeOrderId, order.plannedQty]),
  )
  const match = prepareProductionDemandEarlyMatches({
    demands: [demand('DEM-202603-0093'), demand('DEM-202603-0094')],
    productionOrderId: 'PO-MERGED-DYE-001',
    productionOrderNo: 'PO-MERGED-DYE-001',
  }, [snapshot({ processCode: 'DYE', productionOrderId: 'PO-MERGED-DYE-001', inputSku: 'RAW-MERGED-DYE', outputSku: 'DYED-MERGED-DYE' })], '2026-09-17 11:00:00')
  assert.deepEqual(new Set(match.matchedWorkOrderIds), new Set([first.workOrderId, second.workOrderId]))
  assert.equal(match.remainingSnapshots.length, 0)
  match.commit()
  const matched = listDyeWorkOrders().filter(order => [first.workOrderId, second.workOrderId].includes(order.dyeOrderId))
  assert.equal(matched.length, 2)
  assert.ok(matched.every(order => order.sourceSnapshot?.matchedProductionOrderId === 'PO-MERGED-DYE-001'))
  assert.ok(matched.every(order => order.plannedQty === plannedQtyById.get(order.dyeOrderId)), '正式匹配不得回写提前单计划数量')
  match.rollback()
  const rolledBack = listDyeWorkOrders().filter(order => [first.workOrderId, second.workOrderId].includes(order.dyeOrderId))
  assert.ok(rolledBack.every(order => order.sourceSnapshot?.matchStatus === 'WAIT_PRODUCTION_ORDER'))
})

test('等待技术包的提前单在技术包就绪后可由同一匹配服务自动重试', () => {
  ensureProductionDemandEarlyProcessAcceptanceData()
  const before = listDyeWorkOrders().find(order => order.sourceSnapshot?.productionDemandId === 'DEM-202603-0002')
  assert.ok(before)
  assert.equal(before.sourceSnapshot?.matchStatus, 'WAIT_TECH_PACK')
  const plannedQty = before.plannedQty
  const retry = prepareProductionDemandEarlyMatches({
    demands: [{ ...demand('DEM-202603-0002'), techPackStatus: 'RELEASED' }],
    productionOrderId: 'PO-EARLY-MERGED-001',
    productionOrderNo: 'PO-EARLY-MERGED-001',
  }, [snapshot({
    processCode: 'DYE',
    productionOrderId: 'PO-EARLY-MERGED-001',
    inputSku: 'FAB-GREIGE-002',
    outputSku: 'FAB-DYED-RED-002',
    plannedQty: 9999,
  })], '2026-09-17 11:05:00')
  assert.deepEqual(retry.matchedWorkOrderIds, [before.dyeOrderId])
  retry.commit()
  const matched = listDyeWorkOrders().find(order => order.dyeOrderId === before.dyeOrderId)
  assert.equal(matched?.sourceSnapshot?.matchStatus, 'MATCHED')
  assert.equal(matched?.plannedQty, plannedQty)
  assert.ok(matched?.sourceSnapshot?.operationFacts?.some(fact => fact.action === 'MATCH'))
  retry.rollback()
  assert.equal(listDyeWorkOrders().find(order => order.dyeOrderId === before.dyeOrderId)?.sourceSnapshot?.matchStatus, 'WAIT_TECH_PACK')
})

test('合并生产单中只有部分需求有提前单时，只为未覆盖需求补建剩余数量', () => {
  const early = create('PRINT', 'DEM-202603-0093', 'DYED-MERGED-PRINT', 'PRINTED-MERGED-PRINT')
  const formal = snapshot({ processCode: 'PRINT', productionOrderId: 'PO-MERGED-PRINT-001', inputSku: 'DYED-MERGED-PRINT', outputSku: 'PRINTED-MERGED-PRINT', plannedQty: 3000 })
  const match = prepareProductionDemandEarlyMatches({
    demands: [demand('DEM-202603-0093'), demand('DEM-202603-0094')],
    productionOrderId: 'PO-MERGED-PRINT-001',
    productionOrderNo: 'PO-MERGED-PRINT-001',
  }, [formal], '2026-09-17 11:10:00')
  assert.deepEqual(match.matchedWorkOrderIds, [early.workOrderId])
  assert.equal(match.remainingSnapshots.length, 1)
  assert.equal(match.remainingSnapshots[0].plannedQty, 1500)
  match.commit()
})

test('已有提前单但正式 BOM 或 SKU 不一致时进入异常，且不重复补建同一工艺单', () => {
  const early = create('PRINT', 'DEM-202603-0094', 'EARLY-INPUT-094', 'EARLY-OUTPUT-094')
  const match = prepareProductionDemandEarlyMatches({
    demands: [demand('DEM-202603-0094')],
    productionOrderId: 'PO-MISMATCH-094',
    productionOrderNo: 'PO-MISMATCH-094',
  }, [snapshot({ processCode: 'PRINT', productionOrderId: 'PO-MISMATCH-094', inputSku: 'FORMAL-INPUT-094', outputSku: 'FORMAL-OUTPUT-094' })], '2026-09-17 11:20:00')
  assert.ok(match.failedWorkOrderIds.includes(early.workOrderId))
  assert.equal(match.remainingSnapshots.length, 0)
  match.commit()
})

test('取消后重建保留旧单，并建立双向替代关系', () => {
  ensureProductionDemandEarlyProcessAcceptanceData()
  const cancelled = listDyeWorkOrders().find(order => order.sourceSnapshot?.productionDemandId === 'DEM-202603-0005' && order.sourceSnapshot.generationRevision === 1)
  const replacement = listDyeWorkOrders().find(order => order.sourceSnapshot?.productionDemandId === 'DEM-202603-0005' && order.sourceSnapshot.generationRevision === 2)
  assert.ok(cancelled && replacement)
  assert.equal(cancelled.sourceSnapshot?.matchStatus, 'CANCELLED')
  assert.equal(cancelled.sourceSnapshot?.replacementWorkOrderId, replacement.dyeOrderId)
  assert.equal(replacement.sourceSnapshot?.replacesWorkOrderId, cancelled.dyeOrderId)
})

test('没有提前加工单的需求仍保留正式加工单快照', () => {
  const formal = snapshot({ processCode: 'DYE', productionOrderId: 'PO-NO-EARLY-001', inputSku: 'RAW-NONE', outputSku: 'DYED-NONE', plannedQty: 860 })
  const match = prepareProductionDemandEarlyMatches({
    demands: [demand('DEM-202603-0081')],
    productionOrderId: 'PO-NO-EARLY-001',
    productionOrderNo: 'PO-NO-EARLY-001',
  }, [formal], '2026-09-17 11:30:00')
  assert.equal(match.remainingSnapshots.length, 1)
  assert.equal(match.remainingSnapshots[0].plannedQty, 860)
})
