import assert from 'node:assert/strict'
import test from 'node:test'
import { appendStaticCuttingRuntimeEvent } from '../../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
import {
  buildEffectiveAssignmentStaticFixture,
  indexExistingRuntimeTaskAssignment,
} from '../../src/data/fcs/effective-task-assignments.ts'
import { resolveActionBagCurrent } from '../../src/pages/process-factory/cutting/wait-handover-actions.ts'
import type { TransferBagTicketFactSnapshot } from '../../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'

function bag(
  kind: 'REPLACEMENT_FABRIC' | 'BINDING_STRIP',
  suffix: string,
  binding: 'current' | 'none' | 'old-factory' | 'other-order',
) {
  const taskId = `TASK-FABRIC-${suffix}`,
    orderId = `PO-FABRIC-${suffix}`,
    bagCode = `BAG-FABRIC-${suffix}`
  buildEffectiveAssignmentStaticFixture(() =>
    indexExistingRuntimeTaskAssignment({
      assignmentId: `ASG-FABRIC-${suffix}`,
      runtimeTaskId: taskId,
      productionOrderId: orderId,
      taskNo: taskId,
      factoryId: 'ID-F001',
      factoryName: '当前车缝厂',
      source: 'DIRECT_DISPATCH',
      assignedQty: 100,
      skuLines: [{ skuCode: 'SKU-A', color: 'Grey', size: 'M', qty: 100 }],
      processCodes: ['SEW'],
      frozenPrice: 1,
      priceCurrency: 'IDR',
      priceUnit: '件',
      businessAssignedAt: '2026-09-25',
      operatedAt: '2026-09-25',
      operatedBy: '测试',
      status: 'EFFECTIVE',
      indexedRuntimeSnapshot: true,
    }),
  )
  const ticket: TransferBagTicketFactSnapshot = {
    ticketKind: kind,
    feiTicketId: `FABRIC-${suffix}`,
    feiTicketNo: `FABRIC-${suffix}`,
    productionOrderId: binding === 'other-order' ? 'PO-OTHER' : orderId,
    productionOrderNo: orderId,
    cutOrderId: '',
    cutOrderNo: '',
    color: 'Grey',
    size: '',
    partCode: '',
    partName: '',
    pieceQty: 0,
    materialKey: 'MAT',
    materialCode: 'MAT',
    materialName: '主面料',
    quantity: kind === 'REPLACEMENT_FABRIC' ? 5 : 8,
    quantityUnit: kind === 'REPLACEMENT_FABRIC' ? 'Yard' : '米',
    replacementSequence: kind === 'REPLACEMENT_FABRIC' ? 1 : undefined,
    sewingTaskId: binding === 'none' ? '' : taskId,
    sewingTaskNo: binding === 'none' ? '' : taskId,
    receiverFactoryId: binding === 'none' ? '' : binding === 'old-factory' ? 'OLD-FACTORY' : 'ID-F001',
    receiverFactoryName: binding === 'none' ? '' : '袋内工厂快照',
  }
  appendStaticCuttingRuntimeEvent({
    eventType: '菲票装袋',
    eventSource: 'MOCK',
    eventStatus: '已同步',
    idempotencyKey: bagCode,
    occurredAt: '2026-09-25 09:00:00',
    operatorName: '专项Mock',
    refs: {
      productionOrderId: ticket.productionOrderId,
      productionOrderNo: orderId,
      transferBagCode: bagCode,
      usageCycleId: `CYCLE-${bagCode}`,
      feiTicketIds: [ticket.feiTicketId],
      feiTicketNos: [ticket.feiTicketNo],
    },
    payload: {
      baggingRecordId: `PACK-${bagCode}`,
      bagCode,
      feiTicketItems: [ticket],
      totalPieceQty: 0,
      mixedFlag: false,
      baggingBy: '专项Mock',
      baggingAt: '2026-09-25 09:00:00',
    },
  })
  return { current: resolveActionBagCurrent(bagCode), taskId }
}
for (const kind of ['REPLACEMENT_FABRIC', 'BINDING_STRIP'] as const) {
  test(`${kind} 已绑定有效同生产单任务保留归属，不按部位裁片SKU消除`, () => {
    const { current, taskId } = bag(kind, `${kind}-VALID`, 'current')
    assert.equal(current.tickets[0].sewingTaskId, taskId)
    assert.equal(current.tickets[0].receiverFactoryId, 'ID-F001')
    assert.equal(current.tickets[0].pieceQty, 0)
  })
  test(`${kind} 未绑定票不猜任务，可由用户明确同批加入`, () => {
    const { current } = bag(kind, `${kind}-UNBOUND`, 'none')
    assert.equal(current.tickets[0].sewingTaskId, '')
    assert.equal(current.tickets[0].receiverFactoryId, '')
  })
  for (const binding of ['old-factory', 'other-order'] as const)
    test(`${kind} ${binding} 旧绑定不可作为当前任务沿用`, () => {
      const { current } = bag(kind, `${kind}-${binding}`, binding)
      assert.equal(current.tickets[0].sewingTaskId, '')
      assert.match(current.compatibilityBlockedReason || '', /任务|分配|工厂|生产单/)
    })
}
