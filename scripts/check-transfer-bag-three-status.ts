#!/usr/bin/env node

// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import assert from 'node:assert/strict'
// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import { existsSync, readFileSync } from 'node:fs'
// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import { execFileSync } from 'node:child_process'
// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import { tmpdir } from 'node:os'
// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import { join } from 'node:path'
// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import { fileURLToPath } from 'node:url'
import type { AppendCuttingRuntimeEventInput } from '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'

const lifecycleModuleUrl = new URL(
  '../src/data/fcs/cutting/transfer-bag-lifecycle.ts',
  import.meta.url,
)

assert(
  existsSync(fileURLToPath(lifecycleModuleUrl)),
  '缺少中转袋三状态统一生命周期模块',
)

const lifecycle = await import(lifecycleModuleUrl.href)
const runtimeLedger = await import(
  '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
)
const waitHandoverRuntime = await import(
  '../src/pages/process-factory/cutting/wait-handover-runtime.ts'
)
const transferBagRuntime = await import(
  '../src/data/fcs/cutting/transfer-bag-runtime.ts'
)
const transferBagReturnModel = await import(
  '../src/pages/process-factory/cutting/transfer-bag-return-model.ts'
)
const cuttingQrCodes = await import(
  '../src/data/fcs/cutting/qr-codes.ts'
)
const pdaTransferBagDetail = await import(
  '../src/pages/pda-transfer-bag-detail.ts'
)
const labelPrintTemplate = await import(
  '../src/pages/print/templates/label-print-template.ts'
)
const transferBagsPageSource = readFileSync(
  fileURLToPath(new URL(
    '../src/pages/process-factory/cutting/transfer-bags.ts',
    import.meta.url,
  )),
  'utf8',
)
const transferBagDetailSource = readFileSync(
  fileURLToPath(new URL(
    '../src/pages/process-factory/cutting/transfer-bags/detail.ts',
    import.meta.url,
  )),
  'utf8',
)
const transferBagProjectionSource = readFileSync(
  fileURLToPath(new URL(
    '../src/pages/process-factory/cutting/transfer-bags-projection.ts',
    import.meta.url,
  )),
  'utf8',
)
const transferBagStateSource = readFileSync(
  fileURLToPath(new URL(
    '../src/pages/process-factory/cutting/transfer-bags/state.ts',
    import.meta.url,
  )),
  'utf8',
)
const waitHandoverRuntimeSource = readFileSync(
  fileURLToPath(new URL(
    '../src/pages/process-factory/cutting/wait-handover-runtime.ts',
    import.meta.url,
  )),
  'utf8',
)

assert.deepEqual(
  lifecycle.TRANSFER_BAG_MAIN_STATUS_META,
  {
    IDLE: { label: '空闲' },
    IN_USE: { label: '使用中' },
    DISABLED: { label: '已报废' },
  },
  '中转袋主状态必须且只能是空闲、使用中、已报废',
)
assert.deepEqual(
  lifecycle.TRANSFER_BAG_FLOW_STAGE_META,
  {
    PACKED: { label: '菲票已装袋' },
    INBOUND_STORED: { label: '入仓暂存中' },
    READY_HANDOVER: { label: '待交出' },
    HANDED_OVER_WAITING_RETURN: { label: '已交出待回收' },
  },
  '使用中的流转阶段必须且只能是四个已完成事实',
)

const base = {
  carrierId: 'carrier:BAG-A-001',
  bagCode: 'BAG-A-001',
}

const idle = lifecycle.deriveTransferBagLifecycle({
  ...base,
  cycles: [],
  facts: [],
})
assert.equal(idle.mainStatus, 'IDLE')
assert.equal(idle.flowStage, null)
assert.equal(idle.mainStatusLabel, '空闲')
assert.equal(idle.flowStageLabel, '—')
assert.equal(idle.canStartBagging, true)
assert.deepEqual(idle.allowedActions, ['BAGGING', 'REPACK_TARGET', 'SCRAP'])

const openCycle = {
  usageCycleId: 'cycle:BAG-A-001:001',
  startedAt: '2026-07-30 09:00',
  productionOrderNo: 'PO-001',
}

const packedFact = {
  factId: 'fact:packed:001',
  factType: 'BAGGING_CONFIRMED',
  usageCycleId: openCycle.usageCycleId,
  occurredAt: '2026-07-30 09:01',
}

const packed = lifecycle.deriveTransferBagLifecycle({
  ...base,
  cycles: [openCycle],
  facts: [packedFact],
})
assert.equal(packed.mainStatus, 'IN_USE')
assert.equal(packed.flowStage, 'PACKED')
assert.equal(packed.mainStatusLabel, '使用中')
assert.equal(packed.flowStageLabel, '菲票已装袋')
assert.equal(packed.canStartBagging, false)
assert.deepEqual(packed.allowedActions, ['INBOUND', 'REPACK'])

const inboundFact = {
  factId: 'fact:inbound:001',
  factType: 'INBOUND_CONFIRMED',
  usageCycleId: openCycle.usageCycleId,
  occurredAt: '2026-07-30 09:10',
}
const inbound = lifecycle.deriveTransferBagLifecycle({
  ...base,
  cycles: [openCycle],
  facts: [packedFact, inboundFact],
})
assert.equal(inbound.mainStatus, 'IN_USE')
assert.equal(inbound.flowStage, 'INBOUND_STORED')
assert.deepEqual(inbound.allowedActions, ['REPACK', 'HANDOVER'])

const repackResultFact = {
  factId: 'fact:repack-result:001',
  factType: 'REPACK_RESULT_CONFIRMED',
  usageCycleId: openCycle.usageCycleId,
  occurredAt: '2026-07-30 09:15',
}
const readyHandover = lifecycle.deriveTransferBagLifecycle({
  ...base,
  cycles: [openCycle],
  facts: [packedFact, inboundFact, repackResultFact],
})
assert.equal(readyHandover.mainStatus, 'IN_USE')
assert.equal(readyHandover.flowStage, 'READY_HANDOVER')
assert.equal(readyHandover.flowStageLabel, '待交出')
assert.deepEqual(readyHandover.allowedActions, ['REPACK', 'HANDOVER'])

const handoverFact = {
  factId: 'fact:handover:001',
  factType: 'HANDOVER_CONFIRMED',
  usageCycleId: openCycle.usageCycleId,
  handoverLegId: 'leg:001',
  occurredAt: '2026-07-30 09:20',
}
const handedOver = lifecycle.deriveTransferBagLifecycle({
  ...base,
  cycles: [openCycle],
  facts: [packedFact, inboundFact, handoverFact],
})
assert.equal(handedOver.mainStatus, 'IN_USE')
assert.equal(handedOver.flowStage, 'HANDED_OVER_WAITING_RETURN')
assert.equal(handedOver.activeHandoverLegId, 'leg:001')
assert.deepEqual(
  handedOver.allowedActions,
  ['SPECIAL_CRAFT_RETURN', 'PHYSICAL_RETURN', 'FORCE_RETURN'],
)

const downstreamFacts = [
  {
    factId: 'fact:received:001',
    factType: 'DOWNSTREAM_RECEIVED',
    usageCycleId: openCycle.usageCycleId,
    occurredAt: '2026-07-30 09:30',
  },
  {
    factId: 'fact:difference:001',
    factType: 'DOWNSTREAM_DIFFERENCE',
    usageCycleId: openCycle.usageCycleId,
    occurredAt: '2026-07-30 09:31',
  },
  {
    factId: 'fact:writeback:001',
    factType: 'DOWNSTREAM_WRITEBACK',
    usageCycleId: openCycle.usageCycleId,
    occurredAt: '2026-07-30 09:32',
  },
]
const afterDownstreamWriteback = lifecycle.deriveTransferBagLifecycle({
  ...base,
  cycles: [openCycle],
  facts: [packedFact, inboundFact, handoverFact, ...downstreamFacts],
})
assert.equal(
  afterDownstreamWriteback.flowStage,
  'HANDED_OVER_WAITING_RETURN',
  '接收、差异和回写不得提前关闭物理袋生命周期',
)
assert.deepEqual(
  afterDownstreamWriteback.sourceFactIds,
  [packedFact.factId, inboundFact.factId, handoverFact.factId],
  '生命周期来源不得混入下游记录状态',
)

const specialCraftReturnFact = {
  factId: 'fact:special-return:001',
  factType: 'SPECIAL_CRAFT_BAG_RETURNED',
  usageCycleId: openCycle.usageCycleId,
  handoverLegId: 'leg:001',
  occurredAt: '2026-07-30 10:00',
}
const returnedFromSpecialCraft = lifecycle.deriveTransferBagLifecycle({
  ...base,
  cycles: [openCycle],
  facts: [packedFact, inboundFact, handoverFact, specialCraftReturnFact],
})
assert.equal(returnedFromSpecialCraft.flowStage, 'INBOUND_STORED')
assert.equal(returnedFromSpecialCraft.activeHandoverLegId, null)

const closedReusable = lifecycle.deriveTransferBagLifecycle({
  ...base,
  cycles: [{
    ...openCycle,
    closedAt: '2026-07-30 11:00',
    closeResult: 'REUSABLE',
  }],
  facts: [packedFact, inboundFact, handoverFact],
})
assert.equal(closedReusable.mainStatus, 'IDLE')
assert.equal(closedReusable.flowStage, null)

const closedDisabled = lifecycle.deriveTransferBagLifecycle({
  ...base,
  cycles: [{
    ...openCycle,
    closedAt: '2026-07-30 11:00',
    closeResult: 'DISABLED',
  }],
  facts: [packedFact, inboundFact, handoverFact],
})
assert.equal(closedDisabled.mainStatus, 'DISABLED')
assert.equal(closedDisabled.flowStage, null)
assert.deepEqual(closedDisabled.allowedActions, [])

const scrappedDuringOpenCycle = lifecycle.deriveTransferBagLifecycle({
  ...base,
  cycles: [openCycle],
  facts: [
    packedFact,
    {
      factId: 'fact:scrap:001',
      factType: 'BAG_SCRAPPED',
      usageCycleId: openCycle.usageCycleId,
      occurredAt: '2026-07-30 09:05',
    },
  ],
})
assert.equal(scrappedDuringOpenCycle.mainStatus, 'IN_USE')
assert.equal(scrappedDuringOpenCycle.flowStage, 'PACKED')
assert.deepEqual(scrappedDuringOpenCycle.allowedActions, ['INBOUND', 'REPACK'])

const scrappedThenRepackedSourceEmptied = lifecycle.deriveTransferBagLifecycle({
  ...base,
  cycles: [openCycle],
  facts: [
    packedFact,
    {
      factId: 'fact:scrap:invalid-open-cycle:001',
      factType: 'BAG_SCRAPPED',
      usageCycleId: openCycle.usageCycleId,
      occurredAt: '2026-07-30 09:05',
    },
    repackResultFact,
    {
      factId: 'fact:repack-source-emptied:after-invalid-scrap:001',
      factType: 'REPACK_SOURCE_EMPTIED',
      usageCycleId: openCycle.usageCycleId,
      occurredAt: '2026-07-30 09:16',
    },
  ],
})
assert.equal(scrappedThenRepackedSourceEmptied.mainStatus, 'IDLE')
assert.equal(scrappedThenRepackedSourceEmptied.flowStage, null)
assert.deepEqual(
  scrappedThenRepackedSourceEmptied.sourceFactIds,
  [],
  '使用中写入的无效报废事实不得在原袋清空后延迟生效',
)

const scrappedWithoutOpenCycle = lifecycle.deriveTransferBagLifecycle({
  ...base,
  cycles: [],
  facts: [{
    factId: 'fact:scrap:idle:001',
    factType: 'BAG_SCRAPPED',
    occurredAt: '2026-07-30 09:05',
  }],
})
assert.equal(scrappedWithoutOpenCycle.mainStatus, 'DISABLED')
assert.equal(scrappedWithoutOpenCycle.flowStage, null)
assert.deepEqual(
  scrappedWithoutOpenCycle.sourceFactIds,
  ['fact:scrap:idle:001'],
  '袋已空闲后写入的报废事实必须使主状态变为已报废',
)

const repackedSourceEmptied = lifecycle.deriveTransferBagLifecycle({
  ...base,
  cycles: [openCycle],
  facts: [
    packedFact,
    inboundFact,
    repackResultFact,
    {
      factId: 'fact:repack-source-emptied:001',
      factType: 'REPACK_SOURCE_EMPTIED',
      usageCycleId: openCycle.usageCycleId,
      occurredAt: '2026-07-30 09:16',
    },
  ],
})
assert.equal(repackedSourceEmptied.mainStatus, 'IDLE')
assert.equal(repackedSourceEmptied.flowStage, null)
assert.deepEqual(
  repackedSourceEmptied.allowedActions,
  ['BAGGING', 'REPACK_TARGET', 'SCRAP'],
  '分装交出原袋清空必须关闭当前使用周期并恢复空闲',
)

const newerCycle = {
  usageCycleId: 'cycle:BAG-A-001:002',
  startedAt: '2026-07-31 08:00',
  productionOrderNo: 'PO-002',
}
const newPackedFact = {
  factId: 'fact:packed:002',
  factType: 'BAGGING_CONFIRMED',
  usageCycleId: newerCycle.usageCycleId,
  occurredAt: '2026-07-31 08:01',
}
const reused = lifecycle.deriveTransferBagLifecycle({
  ...base,
  cycles: [
    {
      ...openCycle,
      closedAt: '2026-07-30 11:00',
      closeResult: 'REUSABLE',
    },
    newerCycle,
  ],
  facts: [packedFact, inboundFact, handoverFact, newPackedFact],
})
assert.equal(reused.usageCycleId, newerCycle.usageCycleId)
assert.equal(reused.flowStage, 'PACKED')
assert.deepEqual(reused.sourceFactIds, [newPackedFact.factId])

const ambiguousLegacyCycle = lifecycle.deriveTransferBagLifecycle({
  ...base,
  cycles: [openCycle],
  facts: [],
})
assert.equal(ambiguousLegacyCycle.mainStatus, 'IN_USE')
assert.equal(ambiguousLegacyCycle.flowStage, null)
assert(ambiguousLegacyCycle.compatibilityBlockedReason)
assert.deepEqual(ambiguousLegacyCycle.allowedActions, [])

function createMemoryStorage() {
  const records = new Map<string, string>()
  return {
    getItem(key: string) {
      return records.get(key) ?? null
    },
    setItem(key: string, value: string) {
      records.set(key, value)
    },
    removeItem(key: string) {
      records.delete(key)
    },
  }
}

const transferBagTicketFactSnapshot = {
  feiTicketId: 'FT-ID-REPACK-001',
  feiTicketNo: 'FT-REPACK-001',
  productionOrderId: 'PO-ID-REPACK-001',
  productionOrderNo: 'PO-REPACK-001',
  cutOrderId: 'CUT-ID-REPACK-001',
  cutOrderNo: 'CUT-REPACK-001',
  color: '深蓝',
  size: 'M',
  partCode: 'FRONT',
  partName: '前片',
  pieceQty: 12,
  sewingTaskId: 'SEW-ID-REPACK-001',
  sewingTaskNo: 'SEW-REPACK-001',
  receiverFactoryId: 'FACTORY-ID-REPACK-001',
  receiverFactoryName: '车缝一厂',
}
const secondTransferBagTicketFactSnapshot = {
  ...transferBagTicketFactSnapshot,
  feiTicketId: 'FT-ID-REPACK-002',
  feiTicketNo: 'FT-REPACK-002',
  color: '炭灰',
  size: 'L',
  pieceQty: 9,
}

const repackEvent = {
  eventId: 'cutting-event:BAG-REPACK:REPACK-001:202608011000',
  eventNo: 'BAG-REPACK-202608011000',
  idempotencyKey: 'REPACK-001:CONFIRMED',
  eventType: '中转袋拆袋重装',
  eventSource: 'WEB',
  eventStatus: '已同步',
  occurredAt: '2026-08-01 10:00',
  createdAt: '2026-08-01 10:00',
  operatorId: 'OP-REPACK-001',
  operatorName: '重装操作员',
  operatorRole: '裁片仓主管',
  refs: {
    repackBatchId: ' REPACK-001 ',
    transferBagCodes: ['BAG-SOURCE-001', '', 'BAG-SOURCE-002', 'BAG-RESULT-001', 'BAG-SOURCE-001'],
    sewingTaskIds: ['SEW-ID-REPACK-001', '', 'SEW-ID-REPACK-001'],
    sewingTaskNos: ['SEW-REPACK-001', ''],
  },
  payload: {
    repackBatchId: 'REPACK-001',
    sourceBags: [{
      bagCode: 'BAG-SOURCE-001',
      usageCycleId: 'cycle:BAG-SOURCE-001:001',
      beforeTickets: [transferBagTicketFactSnapshot],
    }, {
      bagCode: 'BAG-SOURCE-002',
      usageCycleId: 'cycle:BAG-SOURCE-002:001',
      beforeTickets: [secondTransferBagTicketFactSnapshot],
    }],
    resultBags: [{
      bagCode: 'BAG-RESULT-001',
      usageCycleId: 'cycle:BAG-RESULT-001:001',
      reusedSourceBag: false,
      tickets: [transferBagTicketFactSnapshot],
    }, {
      bagCode: 'BAG-SOURCE-001',
      usageCycleId: 'cycle:BAG-SOURCE-001:002',
      reusedSourceBag: true,
      tickets: [secondTransferBagTicketFactSnapshot],
    }],
    movedTickets: [{
      feiTicketId: 'FT-ID-REPACK-001',
      fromBagCode: 'BAG-SOURCE-001',
      toBagCode: 'BAG-RESULT-001',
      pieceQty: 12,
    }, {
      feiTicketId: 'FT-ID-REPACK-002',
      fromBagCode: 'BAG-SOURCE-002',
      toBagCode: 'BAG-SOURCE-001',
      pieceQty: 9,
    }],
    confirmedAt: '2026-08-01 10:00',
    confirmedBy: '重装操作员',
  },
}

const recoveryEvent = {
  eventId: 'cutting-event:BAG-RETURN:BAG-RESULT-001:202608011100',
  eventNo: 'BAG-RETURN-202608011100',
  idempotencyKey: 'cycle:BAG-RESULT-001:001:RECOVERY',
  eventType: '中转袋回收',
  eventSource: 'PDA',
  eventStatus: '已同步',
  occurredAt: '2026-08-01 11:00',
  createdAt: '2026-08-01 11:00',
  operatorId: 'OP-RECOVERY-001',
  operatorName: '回收操作员',
  operatorRole: '中转袋回收员',
  refs: {
    transferBagCode: 'BAG-RESULT-001',
    usageCycleId: 'cycle:BAG-RESULT-001:001',
  },
  payload: {
    bagCode: 'BAG-RESULT-001',
    usageCycleId: 'cycle:BAG-RESULT-001:001',
    physicalBagReceived: true,
    physicalBagEmpty: true,
    recoveryMode: 'FORCED',
    recoveryNode: '车缝一厂收货区',
    recoveryLocation: '裁床中转袋回收位',
    reason: '下游签收后强制回收空袋',
    recoveredAt: '2026-08-01 11:00',
    recoveredBy: '回收操作员',
  },
}

const scrapEvent = {
  eventId: 'cutting-event:BAG-SCRAP:BAG-SCRAP-001:202608011200',
  eventNo: 'BAG-SCRAP-202608011200',
  idempotencyKey: 'BAG-SCRAP-001:SCRAPPED',
  eventType: '中转袋报废',
  eventSource: 'WEB',
  eventStatus: '已同步',
  occurredAt: '2026-08-01 12:00',
  createdAt: '2026-08-01 12:00',
  operatorId: 'OP-SCRAP-001',
  operatorName: '报废操作员',
  operatorRole: '裁片仓主管',
  refs: {
    transferBagCode: 'BAG-SCRAP-001',
  },
  payload: {
    bagCode: 'BAG-SCRAP-001',
    idleConfirmed: true,
    reason: '物理袋破损无法复用',
    authorizedBy: '仓库经理',
    scrappedAt: '2026-08-01 12:00',
    scrappedBy: '报废操作员',
  },
}

const repackAppendInput = {
  idempotencyKey: repackEvent.idempotencyKey,
  eventType: '中转袋拆袋重装',
  eventSource: repackEvent.eventSource,
  eventStatus: repackEvent.eventStatus,
  occurredAt: repackEvent.occurredAt,
  createdAt: repackEvent.createdAt,
  operatorId: repackEvent.operatorId,
  operatorName: repackEvent.operatorName,
  operatorRole: repackEvent.operatorRole,
  refs: repackEvent.refs,
  payload: repackEvent.payload,
} satisfies AppendCuttingRuntimeEventInput<'中转袋拆袋重装'>

const recoveryAppendInput = {
  idempotencyKey: recoveryEvent.idempotencyKey,
  eventType: '中转袋回收',
  eventSource: recoveryEvent.eventSource,
  eventStatus: recoveryEvent.eventStatus,
  occurredAt: recoveryEvent.occurredAt,
  createdAt: recoveryEvent.createdAt,
  operatorId: recoveryEvent.operatorId,
  operatorName: recoveryEvent.operatorName,
  operatorRole: recoveryEvent.operatorRole,
  refs: recoveryEvent.refs,
  payload: recoveryEvent.payload,
} satisfies AppendCuttingRuntimeEventInput<'中转袋回收'>

const scrapAppendInput = {
  idempotencyKey: scrapEvent.idempotencyKey,
  eventType: '中转袋报废',
  eventSource: scrapEvent.eventSource,
  eventStatus: scrapEvent.eventStatus,
  occurredAt: scrapEvent.occurredAt,
  createdAt: scrapEvent.createdAt,
  operatorId: scrapEvent.operatorId,
  operatorName: scrapEvent.operatorName,
  operatorRole: scrapEvent.operatorRole,
  refs: scrapEvent.refs,
  payload: scrapEvent.payload,
} satisfies AppendCuttingRuntimeEventInput<'中转袋报废'>

const legacyBaggingConfirmEvent = {
  eventId: 'cutting-event:BAG-CONFIRM:BAG-LEGACY-001:202607301000',
  eventNo: 'BAG-CONFIRM-202607301000',
  eventType: '交出装袋确认',
  eventSource: 'PDA',
  eventStatus: '已同步',
  occurredAt: '2026-07-30 10:00',
  createdAt: '2026-07-30 10:00',
  operatorId: 'OP-LEGACY-001',
  operatorName: '历史装袋员',
  operatorRole: '裁片仓装袋员',
  refs: {
    transferBagCode: 'BAG-LEGACY-001',
    usageCycleId: 'cycle:BAG-LEGACY-001:001',
  },
  payload: {
    baggingConfirmRecordId: 'legacy-bagging-confirm-001',
    baggingConfirmRecordNo: 'LEGACY-CONFIRM-001',
    pickingTaskId: 'PICK-LEGACY-001',
    pickingTaskNo: 'PICK-LEGACY-001',
    sewingTaskId: 'SEW-LEGACY-001',
    sewingTaskNo: 'SEW-LEGACY-001',
    sourceTempBagCode: 'BAG-LEGACY-SOURCE-001',
    targetTransferBagCode: 'BAG-LEGACY-001',
    bagUseId: 'cycle:BAG-LEGACY-001:001',
    scannedFeiTicketIds: ['FT-LEGACY-001'],
    scannedFeiTicketNos: ['FT-LEGACY-001'],
    containedFeiTicketIds: ['FT-LEGACY-001'],
    containedFeiTicketNos: ['FT-LEGACY-001'],
    totalPieceQty: 8,
    pickedQty: 8,
    unit: '片',
    scannedAt: '2026-07-30 10:00',
    scannedBy: '历史装袋员',
    packedAt: '2026-07-30 10:00',
    packedBy: '历史装袋员',
    checkResult: '正常',
    bagBindingRule: '一个中转袋只能绑定一个车缝任务',
  },
}

const restoredTransferBagEvents = runtimeLedger.deserializeCuttingRuntimeEventLedgerStorage(
  runtimeLedger.serializeCuttingRuntimeEventLedgerStorage({
    events: [repackEvent, recoveryEvent, scrapEvent, legacyBaggingConfirmEvent],
  }),
)
assert.equal(restoredTransferBagEvents.events.length, 4)
const restoredRepackEvent = restoredTransferBagEvents.events.find(
  (event: { eventType: string }) => event.eventType === '中转袋拆袋重装',
)
assert.equal(restoredRepackEvent?.payload.repackBatchId, 'REPACK-001')
assert.deepEqual(
  restoredRepackEvent?.payload,
  repackEvent.payload,
  '重装事件的袋、菲票和移动数量事实必须完整往返',
)
assert.equal(restoredRepackEvent?.payload.sourceBags.length, 2)
assert.equal(restoredRepackEvent?.payload.resultBags.length, 2)
assert.equal(restoredRepackEvent?.payload.resultBags[1].reusedSourceBag, true)
assert.deepEqual(
  restoredRepackEvent?.payload.resultBags[0].tickets,
  [transferBagTicketFactSnapshot],
  '重装菲票事实快照必须往返保留',
)
assert.equal(
  restoredRepackEvent?.payload.resultBags[0].reusedSourceBag,
  false,
  '重装结果袋复用标记必须按 boolean literal 往返保留',
)
assert.deepEqual(
  restoredRepackEvent?.refs.transferBagCodes,
  ['BAG-SOURCE-001', 'BAG-SOURCE-002', 'BAG-RESULT-001'],
  '重装引用袋号必须去空、去重且保持稳定顺序',
)
assert.deepEqual(restoredRepackEvent?.refs.sewingTaskIds, ['SEW-ID-REPACK-001'])
assert.deepEqual(restoredRepackEvent?.refs.sewingTaskNos, ['SEW-REPACK-001'])
assert.equal(
  restoredTransferBagEvents.events.find(
    (event: { eventType: string }) => event.eventType === '中转袋回收',
  )?.payload.physicalBagReceived,
  true,
  '回收物理袋签收事实必须按 boolean literal 往返保留',
)
assert.deepEqual(
  restoredTransferBagEvents.events.find(
    (event: { eventType: string }) => event.eventType === '中转袋回收',
  )?.payload,
  recoveryEvent.payload,
  '回收事件关键载荷不得在反序列化时丢失',
)
assert.equal(
  restoredTransferBagEvents.events.find(
    (event: { eventType: string }) => event.eventType === '中转袋报废',
  )?.payload.idleConfirmed,
  true,
  '报废前空闲确认事实必须按 boolean literal 往返保留',
)
assert.deepEqual(
  restoredTransferBagEvents.events.find(
    (event: { eventType: string }) => event.eventType === '中转袋报废',
  )?.payload,
  scrapEvent.payload,
  '报废事件关键载荷不得在反序列化时丢失',
)
const restoredLegacyBaggingConfirmEvent = restoredTransferBagEvents.events.find(
  (event: { eventType: string }) => event.eventType === '交出装袋确认',
)
assert.equal(restoredLegacyBaggingConfirmEvent?.eventStatus, '已同步')

const legacyHandoverRecordSubmitEvent = {
  eventId: 'cutting-event:HANDOVER:LEGACY-TRANSFER-BAG-001:202607301100',
  eventNo: 'HANDOVER-202607301100',
  eventType: '新增交出记录',
  eventSource: 'WEB',
  eventStatus: '已同步',
  occurredAt: '2026-07-30 11:00',
  createdAt: '2026-07-30 11:00',
  operatorId: 'OP-LEGACY-HANDOVER-001',
  operatorName: '历史交出员',
  operatorRole: '裁片仓交出员',
  refs: { transferBagCode: 'BAG-LEGACY-TRANSFER-001' },
  payload: {
    handoverOrderId: 'HO-LEGACY-001',
    handoverOrderNo: 'HO-LEGACY-001',
    handoverRecordId: 'HR-LEGACY-001',
    handoverRecordNo: 'HR-LEGACY-001',
    receiverType: '车缝厂',
    receiverId: 'FACTORY-ID-LEGACY-001',
    receiverName: '历史车缝厂',
    transferBagUses: [{
      bagUseId: 'cycle:BAG-LEGACY-TRANSFER-001:001',
      bagCode: 'BAG-LEGACY-TRANSFER-001',
      containedFeiTicketIds: ['FT-LEGACY-TRANSFER-001'],
      totalPieceQty: 6,
    }],
    feiTicketItems: [],
    currentHandedOverQty: 6,
    submittedAt: '2026-07-30 11:00',
    submittedBy: '历史交出员',
  },
}

const currentHandoverRecordSubmitEvent = {
  ...legacyHandoverRecordSubmitEvent,
  eventId: 'cutting-event:HANDOVER:CURRENT-TRANSFER-BAG-001:202608011300',
  eventNo: 'HANDOVER-202608011300',
  occurredAt: '2026-08-01 13:00',
  createdAt: '2026-08-01 13:00',
  payload: {
    ...legacyHandoverRecordSubmitEvent.payload,
    handoverOrderId: 'HO-CURRENT-001',
    handoverOrderNo: 'HO-CURRENT-001',
    handoverRecordId: 'HR-CURRENT-001',
    handoverRecordNo: 'HR-CURRENT-001',
    transferBagUses: [{
      bagUseId: 'cycle:BAG-CURRENT-TRANSFER-001:001',
      bagCode: 'BAG-CURRENT-TRANSFER-001',
      containedFeiTicketIds: ['FT-ID-REPACK-001'],
      totalPieceQty: 12,
      sewingTaskIds: ['SEW-ID-REPACK-001'],
      sewingTaskNos: ['SEW-REPACK-001'],
      ticketSnapshot: [transferBagTicketFactSnapshot],
    }],
  },
}
const restoredHandoverRecordSubmitEvents = runtimeLedger.deserializeCuttingRuntimeEventLedgerStorage(
  JSON.stringify({
    events: [legacyHandoverRecordSubmitEvent, currentHandoverRecordSubmitEvent],
  }),
)
const restoredLegacyTransferBagUse = restoredHandoverRecordSubmitEvents.events.find(
  (event: { eventId: string }) => event.eventId === legacyHandoverRecordSubmitEvent.eventId,
)?.payload.transferBagUses[0]
assert.equal(restoredLegacyTransferBagUse?.sewingTaskIds, undefined)
assert.equal(restoredLegacyTransferBagUse?.ticketSnapshot, undefined)
const restoredCurrentTransferBagUse = restoredHandoverRecordSubmitEvents.events.find(
  (event: { eventId: string }) => event.eventId === currentHandoverRecordSubmitEvent.eventId,
)?.payload.transferBagUses[0]
assert.deepEqual(restoredCurrentTransferBagUse?.sewingTaskIds, ['SEW-ID-REPACK-001'])
assert.deepEqual(restoredCurrentTransferBagUse?.sewingTaskNos, ['SEW-REPACK-001'])
assert.deepEqual(restoredCurrentTransferBagUse?.ticketSnapshot, [transferBagTicketFactSnapshot])

const repackIdempotencyStorage = createMemoryStorage()
const firstRepackAppend = runtimeLedger.appendCuttingRuntimeEventIdempotent(
  repackAppendInput,
  repackIdempotencyStorage,
)
const duplicateRepackAppend = runtimeLedger.appendCuttingRuntimeEventIdempotent(
  repackAppendInput,
  repackIdempotencyStorage,
)
assert.equal(firstRepackAppend.appended, true)
assert.equal(duplicateRepackAppend.appended, false)
assert.equal(firstRepackAppend.event.refs.repackBatchId, 'REPACK-001')
assert.deepEqual(
  firstRepackAppend.event.refs.transferBagCodes,
  ['BAG-SOURCE-001', 'BAG-SOURCE-002', 'BAG-RESULT-001'],
)
assert.deepEqual(firstRepackAppend.event.refs.sewingTaskIds, ['SEW-ID-REPACK-001'])
assert.deepEqual(firstRepackAppend.event.refs.sewingTaskNos, ['SEW-REPACK-001'])
assert.equal(
  runtimeLedger.buildCuttingRuntimeEventId(
    '中转袋拆袋重装',
    { repackBatchId: 'REPACK-001' },
    '2026-08-01 10:00',
  ),
  'cutting-event:BAG-REPACK:REPACK-001:202608011000',
  '重装批次必须进入稳定业务事件编号',
)
assert.equal(
  runtimeLedger.buildCuttingRuntimeEventId(
    '中转袋拆袋重装',
    { repackBatchId: ' REPACK-001 ' },
    '2026-08-01 10:00',
  ),
  runtimeLedger.buildCuttingRuntimeEventId(
    '中转袋拆袋重装',
    { repackBatchId: 'REPACK-001' },
    '2026-08-01 10:00',
  ),
  '重装批次前后空白不得改变事件业务键',
)
assert.equal(
  runtimeLedger.buildCuttingRuntimeEventId(
    '中转袋拆袋重装',
    { repackBatchId: '   ' },
    '2026-08-01 10:00',
  ),
  runtimeLedger.buildCuttingRuntimeEventId(
    '中转袋拆袋重装',
    {},
    '2026-08-01 10:00',
  ),
  '空白重装批次必须与空引用走同一事件业务键兜底',
)
assert.equal(
  runtimeLedger.listCuttingRuntimeEvents(repackIdempotencyStorage).length,
  1,
  '同一重装幂等键重复追加只能保留一条事实',
)

const runtimeLedgerModulePath = fileURLToPath(new URL(
  '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts',
  import.meta.url,
))
const typeProbeDir = mkdtempSync(join(tmpdir(), 'higoods-transfer-bag-event-contract-'))
const typeProbePath = join(typeProbeDir, 'runtime-event-contract-probe.ts')
try {
  writeFileSync(typeProbePath, `
import {
  appendCuttingRuntimeEvent,
  appendCuttingRuntimeEventIdempotent,
} from ${JSON.stringify(runtimeLedgerModulePath)}
import type { AppendCuttingRuntimeEventInput } from ${JSON.stringify(runtimeLedgerModulePath)}

const validRepack = {
  eventType: '中转袋拆袋重装',
  operatorName: '类型检查员',
  payload: {
    repackBatchId: 'REPACK-TYPE-001',
    sourceBags: [],
    resultBags: [],
    movedTickets: [],
    confirmedAt: '2026-08-01 10:00',
    confirmedBy: '类型检查员',
  },
} satisfies AppendCuttingRuntimeEventInput<'中转袋拆袋重装'>
void validRepack

const invalidRepack: AppendCuttingRuntimeEventInput<'中转袋拆袋重装'> = {
  eventType: '中转袋拆袋重装',
  operatorName: '类型检查员',
  // @ts-expect-error 重装事件不得接受未建模的任意载荷。
  payload: { arbitrary: 123 },
}
void invalidRepack

appendCuttingRuntimeEvent({
  eventType: '中转袋拆袋重装',
  operatorName: '类型检查员',
  // @ts-expect-error 新增事件追加入口不得接受未建模的任意载荷。
  payload: { arbitrary: 123 },
})
appendCuttingRuntimeEventIdempotent({
  idempotencyKey: 'REPACK-TYPE-INVALID',
  eventType: '中转袋拆袋重装',
  operatorName: '类型检查员',
  // @ts-expect-error 新增事件幂等追加入口不得接受未建模的任意载荷。
  payload: { arbitrary: 123 },
})
`)
  execFileSync('npm', [
    'exec', 'tsc', '--', '--noEmit', '--target', 'ES2022', '--module', 'ESNext',
    '--moduleResolution', 'Bundler', '--strict', '--skipLibCheck', '--lib', 'ES2022,DOM',
    '--allowImportingTsExtensions', typeProbePath,
  ], { stdio: 'inherit' })
} finally {
  rmSync(typeProbeDir, { recursive: true, force: true })
}

assert.equal(
  typeof runtimeLedger.appendCuttingRuntimeEventIdempotent,
  'function',
  '运行时事实账必须提供返回 appended 结果的幂等追加入口',
)
assert.equal(
  typeof waitHandoverRuntime.buildWaitHandoverUsageCycleId,
  'function',
  '装袋确认必须生成稳定的使用周期标识',
)
assert.equal(
  typeof waitHandoverRuntime.buildNextWaitHandoverHandoverLeg,
  'function',
  '整袋交出必须生成周期内递增的交出流转段',
)
assert.equal(
  typeof waitHandoverRuntime.listWaitHandoverLifecycleFacts,
  'function',
  '必须能按物理袋读取统一生命周期事实',
)
assert.equal(
  typeof waitHandoverRuntime.buildWaitHandoverLifecycleByBagCode,
  'function',
  'Web、PDA 和主列表必须共用按袋生命周期查询入口',
)
assert.equal(
  typeof transferBagRuntime.buildTransferBagLifecycleCycleFromRuntimeRecord,
  'function',
  '旧使用周期必须通过一个集中适配器进入三状态生命周期',
)

const storage = createMemoryStorage()
const usageCycleId = waitHandoverRuntime.buildWaitHandoverUsageCycleId(
  'BAG-TDD-001',
  '2026-07-30 12:00',
)
assert.equal(
  usageCycleId,
  'cycle:BAG-TDD-001:202607301200',
  '使用周期标识必须由袋号和确认装袋时间稳定生成',
)

const runtimeEventInput = {
  eventType: '菲票装袋',
  eventSource: 'WEB',
  eventStatus: '已同步',
  occurredAt: '2026-07-30 12:00',
  operatorId: 'OP-001',
  operatorName: '测试装袋员',
  operatorRole: '裁片仓装袋员',
  idempotencyKey: `${usageCycleId}:BAGGING_CONFIRMED`,
  refs: {
    productionOrderId: 'PO-ID-001',
    productionOrderNo: 'PO-001',
    cutOrderId: 'CUT-ID-001',
    cutOrderNo: 'CUT-001',
    feiTicketIds: ['FT-ID-001'],
    feiTicketNos: ['FT-001'],
    transferBagCode: 'BAG-TDD-001',
    usageCycleId,
  },
  payload: {
    baggingRecordId: 'bagging:BAG-TDD-001:001',
    bagCode: 'BAG-TDD-001',
    feiTicketItems: [],
    totalPieceQty: 10,
    mixedFlag: false,
    baggingBy: '测试装袋员',
    baggingAt: '2026-07-30 12:00',
  },
}
const firstAppend = runtimeLedger.appendCuttingRuntimeEventIdempotent(
  runtimeEventInput,
  storage,
)
const duplicateAppend = runtimeLedger.appendCuttingRuntimeEventIdempotent(
  runtimeEventInput,
  storage,
)
assert.equal(firstAppend.appended, true)
assert.equal(duplicateAppend.appended, false)
assert.equal(firstAppend.event.eventId, duplicateAppend.event.eventId)
assert.equal(
  runtimeLedger.listCuttingRuntimeEvents(storage).length,
  1,
  '相同幂等键重复提交不得新增第二条事实',
)
assert.equal(firstAppend.event.refs.usageCycleId, usageCycleId)

const firstLeg = waitHandoverRuntime.buildNextWaitHandoverHandoverLeg({
  bagCode: 'BAG-TDD-001',
  usageCycleId,
  events: runtimeLedger.listCuttingRuntimeEvents(storage),
})
assert.deepEqual(firstLeg, {
  handoverLegId: `${usageCycleId}:handover:1`,
  handoverSequence: 1,
})

runtimeLedger.appendCuttingRuntimeEventIdempotent({
  eventType: '新增交出记录',
  eventSource: 'WEB',
  eventStatus: '已同步',
  occurredAt: '2026-07-30 12:30',
  operatorName: '测试交出员',
  idempotencyKey: `${usageCycleId}:HANDOVER_CONFIRMED:${firstLeg.handoverLegId}`,
  refs: {
    transferBagCode: 'BAG-TDD-001',
    usageCycleId,
    handoverLegId: firstLeg.handoverLegId,
  },
  payload: {
    handoverRecordId: 'HANDOVER-001',
    handoverRecordNo: 'HANDOVER-001',
    handoverOrderId: 'ORDER-001',
    handoverOrderNo: 'ORDER-001',
    status: '待接收',
    submitSource: 'WEB',
    sourceWarehouseId: 'cutting-wait-handover',
    sourceWarehouseName: '裁床待交出仓',
    receiverType: 'SEWING_TASK',
    receiverId: 'SEW-001',
    receiverName: '车缝任务 001',
    receiverFactoryId: 'FAC-001',
    receiverFactoryName: '车缝一厂',
    currentHandedOverQty: 10,
    unit: '片',
    bagCount: 1,
    handoverMode: '整袋交出',
    submittedAt: '2026-07-30 12:30',
    submittedBy: '测试交出员',
    feiTicketItems: [],
    transferBagUses: [],
  },
}, storage)

const secondLeg = waitHandoverRuntime.buildNextWaitHandoverHandoverLeg({
  bagCode: 'BAG-TDD-001',
  usageCycleId,
  events: runtimeLedger.listCuttingRuntimeEvents(storage),
})
assert.deepEqual(secondLeg, {
  handoverLegId: `${usageCycleId}:handover:2`,
  handoverSequence: 2,
})

const lifecycleFacts = waitHandoverRuntime.listWaitHandoverLifecycleFacts(
  'BAG-TDD-001',
  storage,
)
assert.deepEqual(
  lifecycleFacts.map((fact: { factType: string }) => fact.factType),
  ['BAGGING_CONFIRMED', 'HANDOVER_CONFIRMED'],
)
const runtimeLifecycle =
  waitHandoverRuntime.buildWaitHandoverLifecycleByBagCode(
    'BAG-TDD-001',
    storage,
  )
assert.equal(runtimeLifecycle.usageCycleId, usageCycleId)
assert.equal(runtimeLifecycle.mainStatus, 'IN_USE')
assert.equal(runtimeLifecycle.flowStage, 'HANDED_OVER_WAITING_RETURN')
assert.equal(runtimeLifecycle.activeHandoverLegId, firstLeg.handoverLegId)

const adapterScrapStorage = createMemoryStorage()
const adapterScrapBagCode = 'BAG-ADAPTER-SCRAP-001'
const adapterScrapCycleId = waitHandoverRuntime.buildWaitHandoverUsageCycleId(
  adapterScrapBagCode,
  '2026-07-30 12:40',
)
const adapterBaggingEvent = runtimeLedger.appendCuttingRuntimeEventIdempotent({
  eventType: '菲票装袋',
  eventSource: 'WEB',
  eventStatus: '已同步',
  occurredAt: '2026-07-30 12:40',
  operatorName: '适配回归装袋员',
  idempotencyKey: `${adapterScrapCycleId}:BAGGING_CONFIRMED`,
  refs: {
    transferBagCode: adapterScrapBagCode,
    usageCycleId: adapterScrapCycleId,
  },
  payload: {
    bagCode: adapterScrapBagCode,
    usageCycleId: adapterScrapCycleId,
  },
}, adapterScrapStorage).event
const adapterInvalidScrapEvent = runtimeLedger.appendCuttingRuntimeEventIdempotent({
  eventType: '中转袋报废',
  eventSource: 'WEB',
  eventStatus: '已同步',
  occurredAt: '2026-07-30 12:45',
  operatorName: '适配回归报废员',
  idempotencyKey: `${adapterScrapBagCode}:BAG_SCRAPPED:invalid-open-cycle`,
  refs: {
    transferBagCode: adapterScrapBagCode,
    usageCycleId: adapterScrapCycleId,
  },
  payload: {
    bagCode: adapterScrapBagCode,
    usageCycleId: adapterScrapCycleId,
    reason: '使用中误写报废事实',
  },
}, adapterScrapStorage).event
const runtimeLifecycleAfterInvalidScrap =
  waitHandoverRuntime.buildWaitHandoverLifecycleByBagCode(
    adapterScrapBagCode,
    adapterScrapStorage,
  )
assert.equal(runtimeLifecycleAfterInvalidScrap.mainStatus, 'IN_USE')
assert.equal(runtimeLifecycleAfterInvalidScrap.flowStage, 'PACKED')
assert.deepEqual(
  runtimeLifecycleAfterInvalidScrap.sourceFactIds,
  [adapterBaggingEvent.eventId],
  '运行态适配链路不得把使用中无效报废事实采纳为生命周期证据',
)
runtimeLedger.appendCuttingRuntimeEventIdempotent({
  eventType: '中转袋回收',
  eventSource: 'WEB',
  eventStatus: '已同步',
  occurredAt: '2026-07-30 12:50',
  operatorName: '适配回归回收员',
  idempotencyKey: `${adapterScrapCycleId}:PHYSICAL_BAG_RETURNED`,
  refs: {
    transferBagCode: adapterScrapBagCode,
    usageCycleId: adapterScrapCycleId,
  },
  payload: {
    bagCode: adapterScrapBagCode,
    usageCycleId: adapterScrapCycleId,
    returnWarehouseName: '裁片仓空袋区',
  },
}, adapterScrapStorage)
const runtimeLifecycleAfterLegalClose =
  waitHandoverRuntime.buildWaitHandoverLifecycleByBagCode(
    adapterScrapBagCode,
    adapterScrapStorage,
  )
assert.equal(runtimeLifecycleAfterLegalClose.mainStatus, 'IDLE')
assert.equal(runtimeLifecycleAfterLegalClose.flowStage, null)
assert.deepEqual(
  runtimeLifecycleAfterLegalClose.sourceFactIds,
  [],
  '周期合法关闭后，旧无效报废事实不得延迟生效',
)
assert.notEqual(
  adapterInvalidScrapEvent.eventId,
  adapterBaggingEvent.eventId,
)

const actionStorage = createMemoryStorage()
const actionTicket = {
  feiTicketId: 'FT-ID-ACTION-001',
  feiTicketNo: 'FT-ACTION-001',
  productionOrderId: 'PO-ID-ACTION-001',
  productionOrderNo: 'PO-ACTION-001',
  cutOrderId: 'CUT-ID-ACTION-001',
  cutOrderNo: 'CUT-ACTION-001',
  spreadingOrderId: 'SPREAD-ID-ACTION-001',
  spreadingOrderNo: 'SPREAD-ACTION-001',
  spuCode: 'SPU-ACTION-001',
  color: '黑色',
  size: 'M',
  partCode: 'FRONT',
  partName: '前幅',
  pieceQty: 10,
  pieceSequenceLabel: '1-10',
  hasSpecialCraft: false,
  specialCraftDisplay: '无',
  receiverFactoryDisplay: '无',
  printStatus: '已打印',
  voidStatus: '有效',
}
const actionCycleId = waitHandoverRuntime.buildWaitHandoverUsageCycleId(
  'BAG-ACTION-001',
  '2026-07-30 13:00',
)
const actionInput = {
  source: 'WEB',
  operator: {
    operatorId: 'OP-ACTION-001',
    operatorName: '动作测试员',
  },
  bagCode: 'BAG-ACTION-001',
  tickets: [actionTicket],
  occurredAt: '2026-07-30 13:00',
  usageCycleId: actionCycleId,
  idempotencyKey: `${actionCycleId}:BAGGING_CONFIRMED`,
  storage: actionStorage,
}
const firstBaggingAction =
  waitHandoverRuntime.appendWaitHandoverBaggingEvent(actionInput)
const duplicateBaggingAction =
  waitHandoverRuntime.appendWaitHandoverBaggingEvent(actionInput)
const actionEvents = runtimeLedger.listCuttingRuntimeEvents(actionStorage)
assert.equal(actionEvents.length, 1, '装袋动作重复提交不得写入第二条事件')
assert.equal(actionEvents[0].refs.usageCycleId, actionCycleId)
assert.equal(
  actionEvents[0].idempotencyKey,
  `${actionCycleId}:BAGGING_CONFIRMED`,
)
assert.equal(firstBaggingAction.eventId, duplicateBaggingAction.eventId)
assert.equal(
  waitHandoverRuntime
    .buildWaitHandoverLifecycleByBagCode('BAG-ACTION-001', actionStorage)
    .flowStage,
  'PACKED',
)

const inboundActionInput = {
  source: 'WEB',
  operator: {
    operatorId: 'OP-ACTION-002',
    operatorName: '入仓测试员',
  },
  bagCode: 'BAG-ACTION-001',
  warehouseArea: 'A 区',
  locationCode: 'A-01-01',
  occurredAt: '2026-07-30 13:10',
  usageCycleId: actionCycleId,
  idempotencyKey: `${actionCycleId}:INBOUND_CONFIRMED`,
  storage: actionStorage,
}
const firstInboundAction =
  waitHandoverRuntime.appendWaitHandoverInboundEvent(inboundActionInput)
const duplicateInboundAction =
  waitHandoverRuntime.appendWaitHandoverInboundEvent(inboundActionInput)
assert.equal(firstInboundAction.eventId, duplicateInboundAction.eventId)
assert.equal(
  runtimeLedger.listCuttingRuntimeEvents(actionStorage).length,
  2,
  '入仓动作重复提交不得写入第二条事件',
)
assert.equal(firstInboundAction.refs.usageCycleId, actionCycleId)
assert.equal(
  waitHandoverRuntime
    .buildWaitHandoverLifecycleByBagCode('BAG-ACTION-001', actionStorage)
    .flowStage,
  'INBOUND_STORED',
)
assert.equal(
  /appendWaitHandoverInboundEvent\(input:\s*\{[\s\S]*?\btickets\??:/.test(
    waitHandoverRuntimeSource,
  ),
  false,
  '入仓命令不得接收页面传入的菲票数组',
)
assert.equal(
  waitHandoverRuntimeSource.includes(
    'export function appendWaitHandoverBaggingConfirmEvent',
  ),
  false,
  '新代码不得继续暴露“交出装袋确认”写入口',
)
assert.throws(
  () => waitHandoverRuntime.appendWaitHandoverBaggingEvent({
    ...actionInput,
    occurredAt: '2026-07-30 13:11',
    idempotencyKey: `${actionCycleId}:BAGGING_CONFIRMED:duplicate-cycle`,
  }),
  /不能重复装袋/,
  '已进入使用周期的物理袋必须由统一命令阻断重复装袋',
)
assert.throws(
  () => waitHandoverRuntime.appendWaitHandoverInboundEvent({
    source: 'WEB',
    operator: {
      operatorId: 'OP-ACTION-IDLE-INBOUND',
      operatorName: '入仓测试员',
    },
    bagCode: 'BAG-IDLE-INBOUND-001',
    warehouseArea: 'A 区',
    locationCode: 'A-01-02',
    occurredAt: '2026-07-30 13:12',
    storage: actionStorage,
  }),
  /尚未完成菲票装袋|不能入仓/,
  '空闲袋必须由统一命令阻断入仓',
)

const handoverPayload = {
  handoverOrderId: 'HANDOVER-ORDER-ACTION-001',
  handoverOrderNo: 'JCD-ACTION-001',
  handoverRecordId: 'HANDOVER-RECORD-ACTION-001',
  handoverRecordNo: 'JCJL-ACTION-001',
  receiverType: '车缝厂',
  receiverId: 'SEWING-FACTORY-ACTION-001',
  receiverName: '测试车缝厂',
  transferBagUses: [{
    bagUseId: actionCycleId,
    bagCode: 'BAG-ACTION-001',
    containedFeiTicketIds: [actionTicket.feiTicketId],
    totalPieceQty: 10,
  }],
  feiTicketItems: [{
    feiTicketId: actionTicket.feiTicketId,
    feiTicketNo: actionTicket.feiTicketNo,
    pieceQty: 10,
    unit: '片',
  }],
  currentHandedOverQty: 10,
  submittedAt: '2026-07-30 13:20',
  submittedBy: '交出测试员',
}
const handoverActionInput = {
  source: 'WEB',
  operator: {
    operatorId: 'OP-ACTION-003',
    operatorName: '交出测试员',
  },
  payload: handoverPayload,
  fromWarehouseArea: 'A 区',
  fromLocationCode: 'A-01-01',
  occurredAt: '2026-07-30 13:20',
  usageCycleId: actionCycleId,
  idempotencyKey:
    `${actionCycleId}:HANDOVER_CONFIRMED:${handoverPayload.handoverRecordId}`,
  storage: actionStorage,
}
assert.throws(
  () => waitHandoverRuntime.appendWaitHandoverHandoverRecordEvent({
    ...handoverActionInput,
    payload: {
      ...handoverPayload,
      handoverRecordId: 'HANDOVER-RECORD-PARTIAL-001',
      transferBagUses: [{
        ...handoverPayload.transferBagUses[0],
        containedFeiTicketIds: [],
      }],
      feiTicketItems: [],
      currentHandedOverQty: 0,
    },
    idempotencyKey:
      `${actionCycleId}:HANDOVER_CONFIRMED:HANDOVER-RECORD-PARTIAL-001`,
  }),
  /完整中转袋|袋内快照/,
  '交出命令必须在统一命令边界阻断按菲票或空内容局部交出',
)
const firstHandoverAction =
  waitHandoverRuntime.appendWaitHandoverHandoverRecordEvent(
    handoverActionInput,
  )
const duplicateHandoverAction =
  waitHandoverRuntime.appendWaitHandoverHandoverRecordEvent(
    handoverActionInput,
  )
assert.equal(firstHandoverAction.eventId, duplicateHandoverAction.eventId)
assert.equal(
  runtimeLedger.listCuttingRuntimeEvents(actionStorage).length,
  3,
  '整袋交出动作重复提交不得写入第二条事件',
)
assert.equal(firstHandoverAction.refs.usageCycleId, actionCycleId)
assert.equal(
  firstHandoverAction.refs.handoverLegId,
  `${actionCycleId}:handover:1`,
)
assert.equal(
  waitHandoverRuntime
    .buildWaitHandoverLifecycleByBagCode('BAG-ACTION-001', actionStorage)
    .flowStage,
  'HANDED_OVER_WAITING_RETURN',
)

const specialReturnPayload = {
  returnRecordId: 'SPECIAL-RETURN-ACTION-001',
  returnRecordNo: 'TH-ACTION-001',
  sourceHandoverOrderId: handoverPayload.handoverOrderId,
  sourceHandoverOrderNo: handoverPayload.handoverOrderNo,
  sourceHandoverRecordId: handoverPayload.handoverRecordId,
  sourceHandoverRecordNo: handoverPayload.handoverRecordNo,
  receiverFactoryId: 'CRAFT-FACTORY-ACTION-001',
  receiverFactoryName: '测试工艺厂',
  transferBagCode: 'BAG-ACTION-001',
  warehouseName: '裁床待交出仓',
  craftType: '印花',
  returnedFeiTicketItems: [{
    feiTicketId: actionTicket.feiTicketId,
    feiTicketNo: actionTicket.feiTicketNo,
    specialCraftId: 'SPECIAL-CRAFT-ACTION-001',
    craftType: '印花',
    partName: '前幅',
    size: 'M',
    expectedQty: 10,
    returnedQty: 10,
    unit: '片',
    returnStatus: '已回仓',
  }],
  warehouseArea: '特殊工艺回仓区',
  locationCode: 'SC-01',
  returnedAt: '2026-07-30 13:40',
  returnedBy: '回仓测试员',
}
const specialReturnActionInput = {
  source: 'WEB',
  operator: {
    operatorId: 'OP-ACTION-004',
    operatorName: '回仓测试员',
  },
  payload: specialReturnPayload,
  specialCraftId: 'SPECIAL-CRAFT-ACTION-001',
  occurredAt: '2026-07-30 13:40',
  usageCycleId: actionCycleId,
  handoverLegId: `${actionCycleId}:handover:1`,
  idempotencyKey:
    `${actionCycleId}:SPECIAL_CRAFT_BAG_RETURNED:${specialReturnPayload.returnRecordId}`,
  storage: actionStorage,
}
const firstSpecialReturnAction =
  waitHandoverRuntime.appendWaitHandoverSpecialCraftReturnEvent(
    specialReturnActionInput,
  )
const duplicateSpecialReturnAction =
  waitHandoverRuntime.appendWaitHandoverSpecialCraftReturnEvent(
    specialReturnActionInput,
  )
assert.equal(
  firstSpecialReturnAction.eventId,
  duplicateSpecialReturnAction.eventId,
)
assert.equal(
  runtimeLedger.listCuttingRuntimeEvents(actionStorage).length,
  4,
  '有袋特殊工艺回仓重复提交不得写入第二条事件',
)
assert.equal(firstSpecialReturnAction.refs.usageCycleId, actionCycleId)
assert.equal(
  firstSpecialReturnAction.refs.handoverLegId,
  `${actionCycleId}:handover:1`,
)
assert.equal(
  waitHandoverRuntime
    .buildWaitHandoverLifecycleByBagCode('BAG-ACTION-001', actionStorage)
    .flowStage,
  'INBOUND_STORED',
)

const specialHandoverPayload = {
  handoverOrderId: 'SPECIAL-HANDOVER-ORDER-ACTION-002',
  handoverRecordId: 'SPECIAL-HANDOVER-RECORD-ACTION-002',
  craftCategory: '特种工艺',
  craftType: '绣花',
  receiverFactoryId: 'CRAFT-FACTORY-ACTION-002',
  receiverFactoryName: '测试绣花厂',
  feiTicketItems: [{
    feiTicketId: actionTicket.feiTicketId,
    feiTicketNo: actionTicket.feiTicketNo,
    specialCraftId: 'SPECIAL-CRAFT-ACTION-002',
    partName: '前幅',
    size: 'M',
    pieceQty: 10,
  }],
  handedOverAt: '2026-07-30 13:50',
  handedOverBy: '工艺交出测试员',
}
assert.throws(
  () =>
    waitHandoverRuntime.appendWaitHandoverSpecialCraftHandoverEvent({
      source: 'WEB',
      operator: {
        operatorId: 'OP-ACTION-PARTIAL',
        operatorName: '工艺交出测试员',
      },
      payload: {
        ...specialHandoverPayload,
        handoverRecordId: 'SPECIAL-HANDOVER-RECORD-PARTIAL',
        feiTicketItems: [],
      },
      handoverOrderId: specialHandoverPayload.handoverOrderId,
      handoverRecordId: 'SPECIAL-HANDOVER-RECORD-PARTIAL',
      specialCraftId: 'SPECIAL-CRAFT-ACTION-002',
      transferBagCode: 'BAG-ACTION-001',
      fromWarehouseArea: '特殊工艺回仓区',
      occurredAt: '2026-07-30 13:49',
      usageCycleId: actionCycleId,
      storage: actionStorage,
    }),
  /完整菲票快照/,
  '特殊工艺带袋交出不得用部分菲票推动整只袋进入交出阶段',
)
const specialHandoverAction =
  waitHandoverRuntime.appendWaitHandoverSpecialCraftHandoverEvent({
    source: 'WEB',
    operator: {
      operatorId: 'OP-ACTION-005',
      operatorName: '工艺交出测试员',
    },
    payload: specialHandoverPayload,
    handoverOrderId: specialHandoverPayload.handoverOrderId,
    handoverRecordId: specialHandoverPayload.handoverRecordId,
    specialCraftId: 'SPECIAL-CRAFT-ACTION-002',
    transferBagCode: 'BAG-ACTION-001',
    fromWarehouseArea: '特殊工艺回仓区',
    occurredAt: '2026-07-30 13:50',
    usageCycleId: actionCycleId,
    storage: actionStorage,
  })
assert.equal(specialHandoverAction.refs.usageCycleId, actionCycleId)
assert.equal(
  specialHandoverAction.refs.handoverLegId,
  `${actionCycleId}:handover:2`,
  '同一使用周期再次交出必须进入新的流转段',
)
assert.equal(
  waitHandoverRuntime
    .buildWaitHandoverLifecycleByBagCode('BAG-ACTION-001', actionStorage)
    .flowStage,
  'HANDED_OVER_WAITING_RETURN',
)

const lifecycleBeforeTicketOnlyReturn =
  waitHandoverRuntime.buildWaitHandoverLifecycleByBagCode(
    'BAG-ACTION-001',
    actionStorage,
  )
waitHandoverRuntime.appendWaitHandoverSpecialCraftReturnEvent({
  source: 'WEB',
  operator: {
    operatorId: 'OP-ACTION-006',
    operatorName: '无袋回仓测试员',
  },
  payload: {
    ...specialReturnPayload,
    returnRecordId: 'SPECIAL-RETURN-TICKET-ONLY-001',
    returnRecordNo: 'TH-TICKET-ONLY-001',
    transferBagCode: undefined,
    returnedAt: '2026-07-30 14:00',
    returnedBy: '无袋回仓测试员',
  },
  specialCraftId: 'SPECIAL-CRAFT-ACTION-002',
  occurredAt: '2026-07-30 14:00',
  storage: actionStorage,
})
assert.deepEqual(
  waitHandoverRuntime.buildWaitHandoverLifecycleByBagCode(
    'BAG-ACTION-001',
    actionStorage,
  ),
  lifecycleBeforeTicketOnlyReturn,
  '只回菲票、未带回实物袋时不得改变任何中转袋生命周期',
)

waitHandoverRuntime.appendWaitHandoverPhysicalReturnEvent({
  source: 'WEB',
  operator: {
    operatorId: 'OP-ACTION-007',
    operatorName: '回收测试员',
  },
  bagCode: 'BAG-ACTION-001',
  usageCycleId: actionCycleId,
  returnedAt: '2026-07-30 14:10',
  returnWarehouseName: '裁片仓空袋区',
  storage: actionStorage,
})
const physicallyReturnedLifecycle =
  waitHandoverRuntime.buildWaitHandoverLifecycleByBagCode(
    'BAG-ACTION-001',
    actionStorage,
  )
assert.equal(physicallyReturnedLifecycle.mainStatus, 'IDLE')
assert.equal(physicallyReturnedLifecycle.flowStage, null)

waitHandoverRuntime.appendWaitHandoverScrapEvent({
  source: 'WEB',
  operator: {
    operatorId: 'OP-ACTION-008',
    operatorName: '报废主管',
  },
  bagCode: 'BAG-SCRAP-ACTION-001',
  scrappedAt: '2026-07-30 14:20',
  reason: '袋体破裂无法继续使用',
  storage: actionStorage,
})
const directlyScrappedLifecycle =
  waitHandoverRuntime.buildWaitHandoverLifecycleByBagCode(
    'BAG-SCRAP-ACTION-001',
    actionStorage,
  )
assert.equal(directlyScrappedLifecycle.mainStatus, 'DISABLED')
assert.equal(directlyScrappedLifecycle.flowStage, null)

const runtimeCycleBase = {
  cycleId: 'runtime-cycle-001',
  cycleNo: 'CYCLE-001',
  carrierId: 'carrier:BAG-RUNTIME-001',
  carrierCode: 'BAG-RUNTIME-001',
  carrierType: 'bag',
  sewingTaskId: '',
  sewingTaskNo: '',
  sewingFactoryId: '',
  sewingFactoryName: '',
  styleCode: 'STYLE-001',
  spuCode: 'SPU-001',
  skuSummary: 'SKU-001',
  colorSummary: '黑色',
  sizeSummary: 'M',
  cycleStatus: 'PACKING',
  status: 'loaded',
  packedTicketCount: 1,
  packedCutOrderCount: 1,
  startedAt: '2026-07-30 14:00',
  dispatchAt: '',
  dispatchBy: '',
  signoffStatus: 'PENDING',
  note: '',
}
assert.deepEqual(
  transferBagRuntime.buildTransferBagLifecycleCycleFromRuntimeRecord(
    runtimeCycleBase,
  ),
  {
    usageCycleId: 'runtime-cycle-001',
    startedAt: '2026-07-30 14:00',
  },
)
assert.deepEqual(
  transferBagRuntime.buildTransferBagLifecycleCycleFromRuntimeRecord({
    ...runtimeCycleBase,
    cycleStatus: 'CLOSED',
    returnedAt: '2026-07-30 16:00',
  }),
  {
    usageCycleId: 'runtime-cycle-001',
    startedAt: '2026-07-30 14:00',
    closedAt: '2026-07-30 16:00',
    closeResult: 'REUSABLE',
  },
)
assert.deepEqual(
  transferBagRuntime.buildTransferBagLifecycleCycleFromRuntimeRecord({
    ...runtimeCycleBase,
    cycleStatus: 'SCRAP_CLOSED',
    returnedAt: '2026-07-30 16:00',
  }),
  {
    usageCycleId: 'runtime-cycle-001',
    startedAt: '2026-07-30 14:00',
    closedAt: '2026-07-30 16:00',
    closeResult: 'DISABLED',
  },
)

const transferBagPageSource = readFileSync(
  fileURLToPath(new URL(
    '../src/pages/process-factory/cutting/transfer-bags.ts',
    import.meta.url,
  )),
  'utf8',
)
const transferBagDialogSource = readFileSync(
  fileURLToPath(new URL(
    '../src/pages/process-factory/cutting/transfer-bags/dialogs.ts',
    import.meta.url,
  )),
  'utf8',
)
assert(
  transferBagPageSource.includes(
    "const statusOptions: TransferBagCarrierCurrentStatus[] = ['空闲', '使用中', '已报废']",
  ),
  '中转袋主列表状态筛选必须且只能提供空闲、使用中、已报废',
)
for (const stageKey of [
  'PACKED',
  'INBOUND_STORED',
  'READY_HANDOVER',
  'HANDED_OVER_WAITING_RETURN',
]) {
  assert(
    transferBagPageSource.includes(
      `TRANSFER_BAG_FLOW_STAGE_META.${stageKey}.label`,
    ),
    `中转袋主列表必须复用统一生命周期中的${stageKey}阶段元数据`,
  )
}
for (const contract of [
  '// @page-pattern: list',
  'return renderStandardListPage({',
  'return renderStandardListTable({',
  'renderTablePagination({',
  'renderStandardListColumnSettings({',
]) {
  assert(
    transferBagPageSource.includes(contract),
    `真实中转袋列表路由未落实标准列表契约：${contract}`,
  )
}
assert(
  transferBagProjectionSource.includes(
    'buildRuntimeTransferBagLifecycleProjection',
  )
    && transferBagStateSource.includes(
      'buildRuntimeTransferBagLifecycleProjection',
    ),
  '主列表必须实时读取统一生命周期事实投影，不能只读旧 TransferBagStore',
)
for (const detailSection of [
  '当前袋内菲票快照',
  '中转袋入仓记录',
  '袋级交出记录',
  '特殊工艺带袋回仓记录',
  '下游接收与回写记录',
  '物理回收',
  '报废记录',
  '业务差异',
  '历史周期',
]) {
  assert(
    transferBagDetailSource.includes(detailSection),
    `中转袋详情缺少设计要求的分区：${detailSection}`,
  )
}
assert(
  transferBagDetailSource.includes('renderDetailPagination({'),
  '中转袋详情各类数据明细必须分页',
)
assert.equal(
  /WAITING_CLEANING|WAITING_REPAIR/.test(
    `${transferBagPageSource}\n${transferBagDialogSource}`,
  ),
  false,
  '回收页面不得继续提供待清洗或待维修结果',
)

const discrepancyClosure =
  transferBagReturnModel.closeTransferBagUsageCycle({
    usage: {
      cycleId: 'cycle:discrepancy:001',
      cycleNo: 'CYCLE-DIFFERENCE-001',
    },
    bag: {},
    receipt: {
      discrepancyType: 'QTY_MISMATCH',
    },
    condition: {
      conditionStatus: 'GOOD',
      cleanlinessStatus: 'CLEAN',
      damageType: '',
      repairNeeded: false,
      reusableDecision: 'REUSABLE',
    },
    nowText: '2026-07-30 17:00',
    closedBy: '回收主管',
  })
assert.equal(
  discrepancyClosure.closureStatus,
  'CLOSED',
  '回收差异不得把可继续使用的中转袋关闭为报废',
)
assert.equal(discrepancyClosure.nextBagStatus, 'REUSABLE')
assert.deepEqual(
  discrepancyClosure.warningMessages,
  ['本次回收存在差异，已生成回收差异记录。'],
)

const explicitScrapClosure =
  transferBagReturnModel.closeTransferBagUsageCycle({
    usage: {
      cycleId: 'cycle:scrap:001',
      cycleNo: 'CYCLE-SCRAP-001',
    },
    bag: {},
    receipt: {
      discrepancyType: 'NONE',
    },
    condition: {
      conditionStatus: 'SEVERE_DAMAGE',
      cleanlinessStatus: 'CLEAN',
      damageType: '袋体破裂无法继续使用',
      repairNeeded: false,
      reusableDecision: 'DISABLED',
    },
    nowText: '2026-07-30 17:10',
    closedBy: '回收主管',
  })
assert.equal(explicitScrapClosure.closureStatus, 'SCRAP_CLOSED')
assert.equal(explicitScrapClosure.nextBagStatus, 'DISABLED')

const stableCarrierQr = cuttingQrCodes.encodeCarrierQr({
  carrierId: 'carrier:BAG-QR-001',
  carrierCode: 'BAG-QR-001',
  carrierType: 'bag',
  issuedAt: '2026-07-30 18:00',
  ownershipFactoryId: 'FACTORY-CUT-001',
  ownershipFactoryName: '裁床一厂',
})
assert.deepEqual(
  Object.keys(stableCarrierQr.payload).sort(),
  [
    'carrierCode',
    'carrierId',
    'carrierType',
    'codeType',
    'issuedAt',
    'ownershipFactoryId',
    'ownershipFactoryName',
    'version',
  ],
  '中转袋二维码只能携带稳定身份、版本、发码时间和固定归属',
)
assert.equal(
  cuttingQrCodes.summarizeTraceabilityPayload(stableCarrierQr.payload)
    .relationSummary,
  '中转袋档案',
)
const transferBagLabelDocument =
  labelPrintTemplate.buildTransferBagLabelPrintDocument({
    documentType: 'TRANSFER_BAG_LABEL',
    sourceType: 'TRANSFER_BAG_RECORD',
    sourceId: 'carrier-bag-005',
  })
const printedCarrierPayload = cuttingQrCodes.parseCuttingTraceQr(
  transferBagLabelDocument.qrPayload,
)
assert.equal(
  printedCarrierPayload?.codeType,
  'CARRIER',
  '中转袋物理标签必须打印可被统一扫码入口识别的稳定载具二维码',
)
assert.equal(
  printedCarrierPayload?.codeType === 'CARRIER'
    ? printedCarrierPayload.carrierCode
    : '',
  'BAG-A-005',
)
assert.deepEqual(
  printedCarrierPayload ? Object.keys(printedCarrierPayload).sort() : [],
  [
    'carrierCode',
    'carrierId',
    'carrierType',
    'codeType',
    'issuedAt',
    'ownershipFactoryId',
    'ownershipFactoryName',
    'version',
  ],
  '中转袋物理标签二维码不得携带状态、阶段、周期、库位或接收回写字段',
)

assert.deepEqual(
  pdaTransferBagDetail.getPdaTransferBagVisibleActionLabels(
    {
      mainStatus: 'IN_USE',
      flowStage: 'HANDED_OVER_WAITING_RETURN',
      allowedActions: ['SPECIAL_CRAFT_RETURN', 'PHYSICAL_RETURN', 'SCRAP'],
    },
    '已交出',
  ),
  ['按袋确认', '按菲票确认'],
  '已交出扫码详情只能展示下游接收确认，不得继续展示装袋或移除菲票',
)
assert.deepEqual(
  pdaTransferBagDetail.getPdaTransferBagVisibleActionLabels(
    {
      mainStatus: 'DISABLED',
      flowStage: null,
      allowedActions: [],
    },
    '差异',
  ),
  [],
  '已报废中转袋扫码详情必须只读',
)

const pdaTransferBagDetailSource = readFileSync(
  fileURLToPath(new URL(
    '../src/pages/pda-transfer-bag-detail.ts',
    import.meta.url,
  )),
  'utf8',
)
assert(
  pdaTransferBagDetailSource.includes('buildWaitHandoverLifecycleByBagCode'),
  '扫码详情必须读取统一中转袋生命周期投影',
)
assert(
  pdaTransferBagDetailSource.includes('物理袋状态'),
  '扫码详情必须明确展示物理袋状态',
)
assert(
  pdaTransferBagDetailSource.includes('流转阶段'),
  '扫码详情必须明确展示流转阶段',
)
assert(
  pdaTransferBagDetailSource.includes('接收回写状态'),
  '扫码详情必须把下游状态明确标为接收回写状态',
)
assert.equal(
  pdaTransferBagDetailSource.includes('action=new-master'),
  false,
  '现场扫码详情不得长期展示新建中转袋主档入口',
)
assert(
  pdaTransferBagDetailSource.includes('data-nav='),
  '扫码详情展示的记录动作必须跳转到可执行记录页面，不得形成死按钮',
)

const masterQuickFilterSource = transferBagsPageSource.slice(
  transferBagsPageSource.indexOf('function renderMasterQuickFilterBar'),
  transferBagsPageSource.indexOf('function renderUsageRecordQuickFilterBar'),
)
assert.equal(
  masterQuickFilterSource.includes('usageSewingTaskId'),
  false,
  '中转袋主列表的流转阶段筛选不得混入车缝任务选项',
)
for (const legacyWriteAction of [
  "if (action === 'open-inbound-pack')",
  "if (action === 'open-handover-pack')",
  "if (action === 'save-inbound-pack')",
  "if (action === 'save-handover-pack')",
  "if (action === 'complete-inbound-storage')",
  "if (action === 'release-inbound-bag')",
  "if (action === 'create-usage')",
  "if (action === 'bind-ticket')",
  "if (action === 'import-prefill')",
  "if (action === 'remove-binding')",
  "if (action === 'confirm-handover')",
  "if (action === 'mark-ready')",
  "if (action === 'mark-dispatched')",
]) {
  assert.equal(
    transferBagsPageSource.includes(legacyWriteAction),
    false,
    `中转袋档案页不得保留旧写入口：${legacyWriteAction}`,
  )
}
assert.equal(
  transferBagDetailSource.includes("usageStageLabel || '交出装袋'"),
  false,
  '中转袋详情的可达历史视图必须统一展示三阶段口径',
)

console.log('check:transfer-bag-three-status passed')
