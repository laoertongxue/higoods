#!/usr/bin/env node

// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import assert from 'node:assert/strict'
// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import { existsSync } from 'node:fs'
// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import { fileURLToPath } from 'node:url'

const lifecycleModuleUrl = new URL(
  '../src/data/fcs/cutting/transfer-bag-lifecycle.ts',
  import.meta.url,
)

assert(
  existsSync(fileURLToPath(lifecycleModuleUrl)),
  '缺少中转袋三状态统一生命周期模块',
)

const lifecycle = await import(lifecycleModuleUrl.href)

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
    HANDED_OVER_WAITING_RETURN: { label: '已交出待回收' },
  },
  '使用中的流转阶段必须且只能是三个已完成事实',
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
assert.deepEqual(idle.allowedActions, ['BAGGING', 'SCRAP'])

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
assert.deepEqual(packed.allowedActions, ['INBOUND', 'SCRAP'])

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
assert.deepEqual(inbound.allowedActions, ['HANDOVER', 'SCRAP'])

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
  ['SPECIAL_CRAFT_RETURN', 'PHYSICAL_RETURN', 'SCRAP'],
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

const scrapped = lifecycle.deriveTransferBagLifecycle({
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
assert.equal(scrapped.mainStatus, 'DISABLED')
assert.equal(scrapped.flowStage, null)

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
assert.deepEqual(ambiguousLegacyCycle.allowedActions, ['SCRAP'])

console.log('check:transfer-bag-three-status passed')
