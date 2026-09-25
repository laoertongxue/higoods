import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTransferBagLandingFromPrefilter } from '../../src/pages/process-factory/cutting/transfer-bags/handlers.ts'
import { installCuttingCommittedEventReader, installManagedCuttingEventScope, type CuttingRuntimeEvent } from '../../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'

test('已提交新周期可由真实袋档案进入历史，错误袋和未知周期仍拒绝', () => {
  const event = { eventId:'event-history',eventType:'菲票装袋',eventStatus:'已生效',occurredAt:'2026-09-25 10:00:00',refs:{usageCycleId:'old-cycle'},payload:{bagCode:'BAG-HISTORY',feiTicketItems:[]} } as unknown as CuttingRuntimeEvent
  installCuttingCommittedEventReader(() => [event], 810)
  installManagedCuttingEventScope(true)
  const model = { usages:[], masters:[{bagId:'master-history',bagCode:'BAG-HISTORY'}] } as unknown as NonNullable<Parameters<typeof resolveTransferBagLandingFromPrefilter>[1]>
  try {
    const route = resolveTransferBagLandingFromPrefilter({ usageId:'old-cycle',bagId:'master-history',bagCode:'BAG-HISTORY' },model)
    assert.deepEqual(route,{ page:'detail',reason:'explicit-usage',bagId:'master-history',bagCode:'BAG-HISTORY',usageId:'old-cycle' })
    assert.equal(resolveTransferBagLandingFromPrefilter({usageId:'unknown-cycle',bagId:'master-history'},model)?.page,'list')
    assert.equal(resolveTransferBagLandingFromPrefilter({usageId:'old-cycle',bagCode:'OTHER-BAG'},model)?.page,'list')
    assert.equal(resolveTransferBagLandingFromPrefilter({usageId:'old-cycle',bagId:'other-master'},model)?.page,'list')
  } finally {
    installManagedCuttingEventScope(false)
    installCuttingCommittedEventReader(events => events,811)
  }
})
