#!/usr/bin/env node

import process from 'node:process'
import { settlementLinkedMockFactoryOutput } from '../src/data/fcs/settlement-linked-mock-factory.ts'
import {
  initialSettlementBatches,
  initialStatementDrafts,
  initialTaskEarningLedgers,
} from '../src/data/fcs/store-domain-settlement-seeds.ts'
import { listStatementSourceItems } from '../src/data/fcs/store-domain-statement-source-adapter.ts'
import { isKolGotoFactory, isKolGotoProductionOrder, isKolGotoWholeOrderTask } from '../src/data/fcs/kol-goto-special-flow.ts'
import { isThirdPartyFactorySettlementBlocked } from '../src/data/fcs/third-party-factory-rating.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function main(): void {
  const {
    factories,
    productionOrders,
    processTasks,
    returnInboundBatches,
    qcScenarios,
    payableAdjustments,
    taskEarningLedgers,
    statementSourceRows,
    statementDraftLines,
    statementDrafts,
    settlementBatches,
    feishuPaymentApprovals,
    paymentWritebacks,
  } = settlementLinkedMockFactoryOutput

  assert(factories.length >= 5, `工厂数量不足，当前 ${factories.length}`)
  assert(processTasks.length >= 50, `任务数量不足，当前 ${processTasks.length}`)
  assert(returnInboundBatches.length >= 150, `回货批次数量不足，当前 ${returnInboundBatches.length}`)

  const cycleIds = new Set(
    statementDrafts
      .map((item) => item.settlementCycleId)
      .filter((item): item is string => Boolean(item)),
  )
  const cycleWindows = new Set(
    statementDrafts
      .map((item) =>
        item.settlementCycleStartAt && item.settlementCycleEndAt
          ? `${item.settlementCycleStartAt}~${item.settlementCycleEndAt}`
          : null,
      )
      .filter((item): item is string => Boolean(item)),
  )
  assert(cycleWindows.size >= 4, `双周结算时间窗不足，当前 ${cycleWindows.size}`)

  for (const factory of factories) {
    const factoryCycles = new Set(
      statementDrafts
        .filter((item) => item.settlementPartyId === factory.id)
        .map((item) => item.settlementCycleId)
        .filter((item): item is string => Boolean(item)),
    )
    if (isThirdPartyFactorySettlementBlocked(factory.id) || isThirdPartyFactorySettlementBlocked(factory.code)) {
      assert(factoryCycles.size === 0, `${factory.name} 已被结算门禁阻断，不应生成对账周期`)
      continue
    }
    const minimumCycleCount = isKolGotoFactory(factory.id) ? 1 : 2
    assert(factoryCycles.size >= minimumCycleCount, `${factory.name} 的结算周期覆盖不足，当前 ${factoryCycles.size}`)
  }

  const activeSourceTypes = Array.from(new Set(listStatementSourceItems().map((item) => item.sourceType))).sort()
  const generatedSourceTypes = Array.from(new Set(statementSourceRows.map((item) => item.sourceType))).sort()
  assert(
    generatedSourceTypes.every((item) => item === 'TASK_EARNING' || item === 'QUALITY_DEDUCTION'),
    `工厂输出的来源类型异常：${generatedSourceTypes.join(', ')}`,
  )
  assert(
    activeSourceTypes.every((item) => item === 'TASK_EARNING' || item === 'QUALITY_DEDUCTION'),
    `当前结算来源类型异常：${activeSourceTypes.join(', ')}`,
  )
  assert(
    !generatedSourceTypes.includes('MATERIAL_STATEMENT' as never) && !activeSourceTypes.includes('MATERIAL_STATEMENT' as never),
    '车缝接收对账仍进入了正式流水来源项',
  )

  const lineGrainTypes = new Set(
    statementDraftLines.map((item) => item.statementLineGrainType),
  )
  assert(lineGrainTypes.has('RETURN_INBOUND_BATCH'), '缺少回货批次型对账明细行')
  assert(lineGrainTypes.has('TASK_COMPLETION'), '缺少 KOL 整单任务完成型对账明细行')
  assert(
    statementDraftLines.some(
      (item) =>
        item.sourceItemType === 'QUALITY_DEDUCTION' &&
        (item.statementLineGrainType === 'RETURN_INBOUND_BATCH' || item.statementLineGrainType === 'NON_BATCH_QUALITY'),
    ),
    '缺少可追到正式质量扣款流水的对账明细行',
  )

  const duplicateStatementKeys = new Set<string>()
  for (const statement of initialStatementDrafts) {
    const key = `${statement.settlementPartyId}__${statement.settlementCycleId}`
    assert(!duplicateStatementKeys.has(key), `存在同工厂同周期重复对账单：${key}`)
    duplicateStatementKeys.add(key)
  }

  const statementIds = new Set(initialStatementDrafts.map((item) => item.statementId))
  for (const batch of initialSettlementBatches) {
    assert(batch.statementIds.length > 0, `${batch.batchId} 未绑定对账单`)
    for (const statementId of batch.statementIds) {
      assert(statementIds.has(statementId), `${batch.batchId} 绑定了不存在的对账单 ${statementId}`)
    }
  }

  const pricingTypes = new Set(processTasks.map((item) => item.assignmentMode))
  assert(pricingTypes.has('DIRECT'), '缺少派单任务')
  assert(pricingTypes.has('BIDDING'), '缺少竞价任务')

  const kolOrders = productionOrders.filter(isKolGotoProductionOrder)
  const kolTasks = processTasks.filter((task) => isKolGotoWholeOrderTask(
    task,
    kolOrders.find((order) => order.productionOrderId === task.productionOrderId),
  ))
  const kolLedgers = taskEarningLedgers.filter((ledger) => isKolGotoFactory(ledger.factoryId))
  const kolLines = statementDraftLines.filter((line) => isKolGotoFactory(line.settlementPartyId))
  assert(kolOrders.length === 1, `KOL 联动 Mock 应只有 1 张生产单，当前 ${kolOrders.length}`)
  assert(kolTasks.length === 1, `KOL 联动 Mock 应只有 1 张整单任务，当前 ${kolTasks.length}`)
  assert(kolTasks[0].assignmentMode === 'DIRECT' && kolTasks[0].pricingMode === 'FIXED_TOTAL', 'KOL 联动任务不应出现竞价或按件计价')
  assert(!returnInboundBatches.some((batch) => isKolGotoFactory(batch.returnFactoryId)), 'KOL 固定总价结算不应伪造回货批次')
  assert(kolLedgers.length === 1, `KOL 联动 Mock 应只有 1 条任务收入流水，当前 ${kolLedgers.length}`)
  assert(kolLedgers[0].sourceType === 'TASK_COMPLETION' && kolLedgers[0].priceSourceType === 'TASK_FIXED_TOTAL', 'KOL 流水必须由任务完成和固定总价驱动')
  assert(kolLedgers[0].qty === 1 && !kolLedgers[0].returnInboundBatchId, 'KOL 流水数量必须为 1 且不绑定回货批次')
  assert(kolLines.length === 1 && kolLines[0].statementLineGrainType === 'TASK_COMPLETION', 'KOL 对账明细必须是一条任务完成行')

  assert(taskEarningLedgers.length >= 150, `任务收入流水数量不足，当前 ${taskEarningLedgers.length}`)
  assert(initialTaskEarningLedgers.length === taskEarningLedgers.length, '任务收入流水种子未完全接管工厂输出')
  assert(feishuPaymentApprovals.length > 0, '缺少飞书付款审批样例')
  assert(paymentWritebacks.length > 0, '缺少打款回写样例')
  const approvalStatuses = new Set(feishuPaymentApprovals.map((item) => item.status))
  assert(approvalStatuses.has('APPROVING'), '缺少飞书审批中样例')
  assert(approvalStatuses.has('PAID'), '缺少飞书已付款样例')

  const versionShiftFactory = factories.find((factory) => {
    const versionNos = new Set(
      initialStatementDrafts
        .filter((item) => item.settlementPartyId === factory.id)
        .map((item) => item.settlementProfileVersionNo),
    )
    return versionNos.size >= 2
  })
  assert(Boolean(versionShiftFactory), '缺少中途更换结算资料版本的工厂场景')

  const sampleFactoryChains: Array<{
    factoryId: string
    factoryName: string
    settlementCycleId: string
    statementId: string
    settlementProfileVersionNo: string
    pricingSourceType: string
    returnInboundBatchId: string
    qcId: string | null
    batchId: string | null
  }> = []

  for (const factory of factories.slice(0, 3)) {
    const statement = initialStatementDrafts.find(
      (item) =>
        item.settlementPartyId === factory.id &&
        item.items.some((line) => line.statementLineGrainType === 'RETURN_INBOUND_BATCH'),
    )
    assert(Boolean(statement), `${factory.name} 缺少可抽检的对账单`)

    const line = statement!.items.find((item) => item.statementLineGrainType === 'RETURN_INBOUND_BATCH')
    assert(Boolean(line?.returnInboundBatchId), `${statement!.statementId} 缺少回货批次行`)

    const returnBatch = returnInboundBatches.find((item) => item.batchId === line!.returnInboundBatchId)
    assert(Boolean(returnBatch), `${statement!.statementId} 的回货批次不存在`)

    const task = processTasks.find((item) => item.taskId === line!.taskId)
    assert(Boolean(task), `${statement!.statementId} 的任务不存在`)

    const relatedQc = qcScenarios.find((item) => item.batchId === line!.returnInboundBatchId) ?? null
    const relatedBatch =
      initialSettlementBatches.find((item) => item.statementIds.includes(statement!.statementId)) ?? null

    sampleFactoryChains.push({
      factoryId: factory.id,
      factoryName: factory.name,
      settlementCycleId: statement!.settlementCycleId ?? '-',
      statementId: statement!.statementId,
      settlementProfileVersionNo: statement!.settlementProfileVersionNo,
      pricingSourceType: line!.pricingSourceType ?? 'NONE',
      returnInboundBatchId: line!.returnInboundBatchId ?? '-',
      qcId: relatedQc?.qcId ?? null,
      batchId: relatedBatch?.batchId ?? null,
    })
  }

  const sampleCycleChains: Array<{
    settlementCycleId: string
    settlementCycleWindow: string
    statementId: string
    factoryName: string
    pricingSourceType: string
    returnInboundBatchId: string
    qcId: string | null
    batchId: string | null
  }> = []
  const pickedCycleWindows = new Set<string>()

  for (const statement of initialStatementDrafts) {
    const cycleWindow =
      statement.settlementCycleStartAt && statement.settlementCycleEndAt
        ? `${statement.settlementCycleStartAt}~${statement.settlementCycleEndAt}`
        : ''
    if (!cycleWindow || pickedCycleWindows.has(cycleWindow)) continue
    const line = statement.items.find((item) => item.statementLineGrainType === 'RETURN_INBOUND_BATCH')
    if (!line?.returnInboundBatchId) continue
    const factoryName = factories.find((item) => item.id === statement.settlementPartyId)?.name ?? statement.settlementPartyId
    const relatedQc = qcScenarios.find((item) => item.batchId === line.returnInboundBatchId) ?? null
    const relatedBatch =
      initialSettlementBatches.find((item) => item.statementIds.includes(statement.statementId)) ?? null
    sampleCycleChains.push({
      settlementCycleId: statement.settlementCycleId ?? '-',
      settlementCycleWindow: cycleWindow,
      statementId: statement.statementId,
      factoryName,
      pricingSourceType: line.pricingSourceType ?? 'NONE',
      returnInboundBatchId: line.returnInboundBatchId,
      qcId: relatedQc?.qcId ?? null,
      batchId: relatedBatch?.batchId ?? null,
    })
    pickedCycleWindows.add(cycleWindow)
    if (sampleCycleChains.length === 3) break
  }

  assert(sampleFactoryChains.length === 3, `工厂抽检链路数量不足，当前 ${sampleFactoryChains.length}`)
  assert(sampleCycleChains.length === 3, `周期抽检链路数量不足，当前 ${sampleCycleChains.length}`)

  console.log(
    JSON.stringify(
      {
        工厂数: factories.length,
        生产单数: productionOrders.length,
        任务数: processTasks.length,
        回货批次数: returnInboundBatches.length,
        质检记录数: qcScenarios.length,
        兼容调整样例数: payableAdjustments.length,
        任务收入流水数: taskEarningLedgers.length,
        对账来源行数: statementSourceRows.length,
        对账明细行数: statementDraftLines.length,
        当前任务收入流水种子数: initialTaskEarningLedgers.length,
        对账单数: statementDrafts.length,
        预付款批次数: settlementBatches.length,
        飞书付款审批数: feishuPaymentApprovals.length,
        打款回写数: paymentWritebacks.length,
        工厂周期键数: cycleIds.size,
        双周时间窗数: cycleWindows.size,
        工厂输出来源类型: generatedSourceTypes,
        当前来源类型: activeSourceTypes,
        明细行粒度类型: Array.from(lineGrainTypes).sort(),
        中途换版本工厂: versionShiftFactory?.name ?? null,
        工厂抽检链路: sampleFactoryChains,
        周期抽检链路: sampleCycleChains,
      },
      null,
      2,
    ),
  )
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
}
