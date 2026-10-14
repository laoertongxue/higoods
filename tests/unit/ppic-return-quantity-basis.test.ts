import { listSewingOutsourcingReturnTrackingRows } from '../../src/data/fcs/sewing-outsourcing-return-tracking.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { derivePpicReturnQuantityBasis, getPpicReturnQuantityBasis, type PpicReturnQuantityBasisInput, type PpicReturnQuantityHandover, type PpicReturnQuantityRelease } from '../../src/data/fcs/ppic-return-quantity-basis.ts'
import { captureEffectiveTaskAssignmentState, restoreEffectiveTaskAssignmentState, type EffectiveTaskAssignment } from '../../src/data/fcs/effective-task-assignments.ts'
import { withBrowserBusinessStorage } from '../../src/data/browser-storage.ts'
import { CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, type CuttingRuntimeEvent, type SimpleCutPieceHandoverPayload } from '../../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { isCompleteSuccessfulWholeBagHandoverEvent } from '../../src/data/fcs/cutting/transfer-bag-operations.ts'

const assignment: EffectiveTaskAssignment = {
  assignmentId: 'ASG-QUANTITY-1', runtimeTaskId: 'TASK-QUANTITY-1', productionOrderId: 'PO-QUANTITY', productionOrderNo: 'PO-Q-1', taskNo: 'SEW-Q-1',
  factoryId: 'FACTORY-Q-1', factoryName: '三方车缝一厂', source: 'DIRECT_DISPATCH', assignedQty: 100,
  skuLines: [{ skuCode: 'SKU-BLACK-M', color: '黑色', size: 'M', qty: 100 }], processCodes: ['SEW'], frozenPrice: 1200, priceCurrency: 'IDR', priceUnit: '件',
  businessAssignedAt: '2026-10-01 09:00:00', operatedAt: '2026-10-01 09:00:00', operatedBy: '计划', ppicId: 'PPIC-1', ppicName: '跟单一', status: 'EFFECTIVE',
}
const sku = { skuCode: 'SKU-BLACK-M', color: '黑色', size: 'M' }
const requirements = [
  { ...sku, partCode: 'FRONT', partName: '前片', piecesPerGarment: 1 },
  { ...sku, partCode: 'BACK', partName: '后片', piecesPerGarment: 1 },
  { ...sku, partCode: 'SLEEVE', partName: '袖片', piecesPerGarment: 2 },
]
function handover(id: string, quantities = [100, 100, 200], kind: PpicReturnQuantityHandover['sourceRef']['kind'] = 'SIMPLE_HANDOVER'): PpicReturnQuantityHandover {
  return { taskId: assignment.runtimeTaskId, factoryId: assignment.factoryId, productionOrderId: assignment.productionOrderId,
    sourceRef: { kind, recordId: id, version: `EVENT-${id}`, occurredAt: '2026-10-02 10:00:00' },
    lines: requirements.map((part, index) => ({ ...sku, partCode: part.partCode, pieceQty: quantities[index]!, ticketId: `${id}:${part.partCode}` })),
  }
}
function release(qty = 100, tasks = [assignment.runtimeTaskId]): PpicReturnQuantityRelease {
  return { status: 'CONFIRMED', sourceRef: { kind: 'CUT_PIECE_RELEASE', recordId: 'RELEASE-Q-1', version: 'RELEASE-V1', occurredAt: '2026-10-01 14:00:00' },
    lines: [{ ...sku, releaseConfirmQty: qty, allocationTaskIds: tasks }],
  }
}
function basis(patch: Partial<PpicReturnQuantityBasisInput> = {}) {
  return derivePpicReturnQuantityBasis({ assignment, assignmentId: assignment.assignmentId, requirements, handovers: [handover('HAND-Q-1')], release: release(), ...patch })
}

test('R77: Jakarta millisecond wall-clock matches UTC regardless of the host time zone', () => {
  const before = process.env.TZ
  try {
    process.env.TZ = 'Asia/Shanghai'
    const event = handover('RECENT'); event.sourceRef.occurredAt = '2026-10-14T02:30:00Z'
    const at = (nowAt: string) => basis({ handovers: [event], nowAt })
    assert.equal(at('2026-10-14 10:00:00').expectedQty, 100)
    assert.deepEqual(at('2026-10-14 10:00:00.500'), at('2026-10-14T03:00:00.500Z'))
    assert.equal(at('2026-10-14 10:00:00.500').expectedQty, 100)
  } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before }
})

test('无缺裁片按实际交出齐套件数，不能按已分配或放行的较大数量', () => {
  const result = basis({ handovers: [handover('HALF', [50, 50, 100])] })
  assert.equal(result.status, 'READY'); assert.equal(result.expectedQty, 50)
  assert.equal(result.sourceKind, 'CUT_PIECE_COMPLETE_KIT'); assert.equal(result.skuLines[0].expectedQty, 50)
  assert.deepEqual(result.missingParts, [])
})
test('缺整部位按实际放行件数，排除部位不能降低应回责任', () => {
  const result = basis({ handovers: [handover('MISSING', [100, 100, 0])] })
  assert.equal(result.expectedQty, 100); assert.equal(result.sourceKind, 'CUT_PIECE_RELEASE')
  assert.equal(result.skuLines[0].handedOverCompleteKitQty, 0); assert.equal(result.missingParts[0].missingPieceQty, 200)
})
test('局部缺片也按放行数量，来源已扣占用后的availableQty不参与公式', () => {
  const source = release(90) as PpicReturnQuantityRelease & { availableQty: number }
  source.availableQty = 0
  const result = basis({ handovers: [handover('PARTIAL', [80, 70, 160])], release: source })
  assert.equal(result.expectedQty, 90); assert.equal(result.missingParts[0].partCode, 'BACK')
  assert.equal(result.missingParts[0].missingPieceQty, 10)
})
test('三合一交出面辅料按分配数量，不要求裁片交出或放行', () => {
  const result = basis({ assignment: { ...assignment, processCodes: ['CUTTING', 'SEW', 'IRON_PACK'] }, requirements: [], handovers: [], release: undefined })
  assert.equal(result.expectedQty, 100); assert.equal(result.sourceKind, 'ASSIGNMENT'); assert.equal(result.taskType, 'CUTTING_TO_IRON_PACK')
})
test('车缝烫包沿用实际交出规则，任务类型可识别', () => {
  const result = basis({ assignment: { ...assignment, processCodes: ['SEW', 'IRON_PACK'] } })
  assert.equal(result.expectedQty, 100); assert.equal(result.taskType, 'SEWING_TO_IRON_PACK')
})
test('多批交出合计，同一交出记录重读只计一次', () => {
  const a = handover('A', [30, 30, 60]), b = handover('B', [20, 20, 40], 'TRANSFER_BAG_HANDOVER')
  const result = basis({ handovers: [a, b, structuredClone(a)] })
  assert.equal(result.expectedQty, 50); assert.equal(result.sourceRefs.filter(ref => ref.kind.includes('HANDOVER')).length, 2)
})
test('简易与中转袋来源重复引用同一菲票，不重复计量；冲突数量阻断', () => {
  const a = handover('SIMPLE', [50, 50, 100]), b = handover('BAG', [50, 50, 100], 'TRANSFER_BAG_HANDOVER')
  b.lines.forEach((line, index) => { line.ticketId = a.lines[index]!.ticketId })
  assert.equal(basis({ handovers: [a, b] }).expectedQty, 50)
  b.lines[0].pieceQty = 49
  const conflict = basis({ handovers: [a, b] })
  assert.equal(conflict.status, 'AMBIGUOUS'); assert.equal(conflict.expectedQty, null)
})
test('旧镜像与正式交出同记录只计一次，数量版本冲突阻断', () => {
  const a = handover('SAME'), b = handover('SAME', [100, 100, 200], 'LEGACY_HANDOVER')
  b.lines.forEach(line => { delete line.ticketId })
  assert.equal(basis({ handovers: [a, b] }).expectedQty, 100)
  b.lines[0].pieceQty = 99
  assert.equal(basis({ handovers: [a, b] }).status, 'AMBIGUOUS')
})
test('同一生产单、工厂的其他任务交出不能计入当前任务', () => {
  const other = handover('OTHER'); other.taskId = 'TASK-OTHER'
  const result = basis({ handovers: [other] })
  assert.equal(result.status, 'WAIT_HANDOVER'); assert.equal(result.expectedQty, null)
})
test('共享SKU放行多任务且缺少逐任务来源时不盲摊', () => {
  const result = basis({ handovers: [handover('MISSING', [100, 100, 0])], release: release(200, [assignment.runtimeTaskId, 'TASK-OTHER']) })
  assert.equal(result.status, 'AMBIGUOUS'); assert.equal(result.expectedQty, null)
  assert.match(result.message, /多个任务/)
})
test('明确逐任务放行来源可读取，放行生产单总量不直接作任务数量', () => {
  const source = release(200, [assignment.runtimeTaskId, 'TASK-OTHER']); source.lines[0].taskReleaseConfirmQty = 100
  assert.equal(basis({ handovers: [handover('MISSING', [100, 100, 0])], release: source }).expectedQty, 100)
})
test('放行包含未分配量、低于已交齐套、未确认或需复核均阻断', () => {
  const missing = [handover('MISSING', [90, 80, 180])]
  for (const source of [release(120), release(70)]) assert.equal(basis({ handovers: missing, release: source }).status, 'AMBIGUOUS')
  for (const status of ['UNCONFIRMED', 'NEEDS_REVIEW'] as const) {
    const result = basis({ handovers: missing, release: { ...release(), status } })
    assert.equal(result.status, 'SOURCE_UNAVAILABLE'); assert.equal(result.expectedQty, null)
  }
})
test('尚未交出、无法读到放行或必需部位时保留null，不产生0件完成', () => {
  assert.equal(basis({ handovers: [] }).status, 'WAIT_HANDOVER')
  assert.equal(basis({ handovers: [] }).expectedQty, null)
  assert.equal(basis({ requirements: [] }).status, 'SOURCE_UNAVAILABLE')
  assert.equal(basis({ handovers: [handover('MISSING', [100, 100, 0])], release: undefined }).expectedQty, null)
  const result = getPpicReturnQuantityBasis('ASG-NEVER-EXISTS-QUANTITY')
  assert.equal(result.status, 'SOURCE_UNAVAILABLE'); assert.equal(result.expectedQty, null)
})
test('来源顺序和当前PPIC改变不改变数量依据，补交及放行新版本产生新身份', () => {
  const a = handover('A', [30, 30, 60]), b = handover('B', [20, 20, 40])
  const first = basis({ handovers: [a, b] }), reordered = basis({ requirements: [...requirements].reverse(), handovers: [b, a], ppic: { ppicId: 'PPIC-NEW', ppicName: '新跟单' } })
  assert.equal(first.basisVersion, reordered.basisVersion); assert.equal(reordered.ppicId, 'PPIC-NEW')
  assert.notEqual(first.basisVersion, basis({ handovers: [a, b, handover('C', [10, 10, 20])] }).basisVersion)
  const missing = [handover('MISSING', [100, 100, 0])], old = basis({ handovers: missing }), next = release()
  next.sourceRef.version = 'RELEASE-V2'
  assert.notEqual(old.basisVersion, basis({ handovers: missing, release: next }).basisVersion)
})
test('使用Jakarta业务时间截止，不提前纳入未来交出或未来放行', () => {
  assert.equal(basis({ nowAt: '2026-10-02T02:59:59Z' }).status, 'WAIT_HANDOVER')
  assert.equal(basis({ nowAt: '2026-10-02T03:00:00Z' }).expectedQty, 100)
  const source = release(); source.sourceRef.occurredAt = '2026-10-03 10:00:00'
  assert.equal(basis({ nowAt: '2026-10-02 12:00:00', handovers: [handover('MISSING', [100, 100, 0])], release: source }).status, 'SOURCE_UNAVAILABLE')
})
test('颜色尺码或每件用片数无依据、重复部位、超任务交出都阻断', () => {
  assert.equal(basis({ requirements: [...requirements, requirements[0]!] }).status, 'AMBIGUOUS')
  assert.equal(basis({ requirements: requirements.map(part => ({ ...part, piecesPerGarment: 0 })) }).status, 'SOURCE_UNAVAILABLE')
  assert.equal(basis({ handovers: [handover('OVER', [101, 101, 202])] }).status, 'AMBIGUOUS')
  assert.equal(basis({ assignment: { ...assignment, skuLines: [{ ...assignment.skuLines[0]!, size: '' }] } }).status, 'SOURCE_UNAVAILABLE')
})

function simpleEvent(id: string, quantities = [50, 50, 100]): CuttingRuntimeEvent<'简易裁片交出'> {
  const payload: SimpleCutPieceHandoverPayload = {
    schemaVersion: 1, assignmentId: assignment.assignmentId, runtimeTaskId: assignment.runtimeTaskId,
    taskNo: assignment.taskNo!, taskSheetNo: 'SHEET-Q-1', taskSheetVersion: 'SHEET-V1', taskTypeLabel: '独立车缝',
    productionOrderId: assignment.productionOrderId, productionOrderNo: assignment.productionOrderNo!, styleCode: 'STYLE-Q', styleName: '数量契约款', styleImageUrl: '/images/quantity-source.jpg',
    factoryId: assignment.factoryId, factoryName: assignment.factoryName, ppicId: 'PPIC-1', ppicName: '跟单一', warehouseFactoryId: 'CUTTING-FACTORY',
    handoverOrderId: 'HO-Q', handoverOrderNo: 'HO-Q', handoverRecordId: id, handoverRecordNo: id,
    requirementSnapshotId: 'REQ-Q-V1', requirementSnapshotAt: '2026-10-01 09:00:00', skuLines: assignment.skuLines,
    requirements: requirements.map(part => ({ ...part, allocatedGarmentQty: 100 })),
    tickets: requirements.map((part, index) => ({ ...sku, partCode: part.partCode, partName: part.partName, pieceQty: quantities[index]!, feiTicketId: `${id}:${part.partCode}`, feiTicketNo: `${id}:${part.partCode}`, sourceOutputLineId: `OUTPUT-${id}:${index}`, cutOrderId: 'CUT-Q', cutOrderNo: 'CUT-Q', pieceRange: '1-50', unit: '片' })),
    totalPieceQty: quantities.reduce((sum, value) => sum + value, 0), receiptStatus: 'RECEIVED', confirmationBasis: 'WAREHOUSE_CONFIRMATION',
  }
  return { eventId: `EVENT-${id}`, eventNo: `EVENT-${id}`, eventType: '简易裁片交出', eventSource: 'WEB', eventStatus: '已同步', occurredAt: '2026-10-02 10:00:00', operatorName: '裁床仓管', refs: { productionOrderId: assignment.productionOrderId, handoverRecordId: id }, payload }
}
function withFormalSources(events: CuttingRuntimeEvent[], read: () => void) {
  const before = captureEffectiveTaskAssignmentState()
  const current = { ...assignment, ppicPhone: '08000000001', ppicSnapshotAt: assignment.businessAssignedAt }
  const raw = JSON.stringify({ events })
  let writes = 0
  try {
    restoreEffectiveTaskAssignmentState({ ...before, assignments: [...before.assignments, [current.assignmentId, current]], current: [...before.current, [current.runtimeTaskId, [current.assignmentId]]] })
    withBrowserBusinessStorage({ getItem: key => key === CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY ? raw : null, setItem() { writes++ }, removeItem() { writes++ } }, () => {
      read(); assert.equal(writes, 0, '应回依据 getter 不初始化或保存业务来源')
    })
  } finally { restoreEffectiveTaskAssignmentState(before) }
}
test('正式简易交出适配器按分配身份和冻结部位读取，重复读取不写库', () => {
  withFormalSources([simpleEvent('FORMAL-SIMPLE')], () => {
    const result = getPpicReturnQuantityBasis(assignment.assignmentId)
    assert.equal(result.status, 'READY'); assert.equal(result.expectedQty, 50); assert.equal(result.ppicId, 'PPIC-1')
    assert.ok(result.sourceRefs.some(ref => ref.kind === 'SIMPLE_HANDOVER' && ref.recordId === 'FORMAL-SIMPLE'))
    assert.equal(result.basisVersion, getPpicReturnQuantityBasis(assignment.assignmentId).basisVersion)
  })
})
test('正式中转袋和简易交出合并去重，其他任务菲票不串量', () => {
  const simple = simpleEvent('FORMAL-SIMPLE-BAG', [30, 30, 60])
  const tickets = requirements.map((part, index) => ({ feiTicketId: `BAG-TICKET-${index}`, feiTicketNo: `BAG-TICKET-${index}`, productionOrderId: assignment.productionOrderId, productionOrderNo: assignment.productionOrderNo!, cutOrderId: 'CUT-Q', cutOrderNo: 'CUT-Q', color: sku.color, size: sku.size, partCode: part.partCode, partName: part.partName, pieceQty: [20, 20, 40][index]!, sewingTaskId: assignment.runtimeTaskId, sewingTaskNo: assignment.taskNo!, receiverFactoryId: assignment.factoryId, receiverFactoryName: assignment.factoryName }))
  const assignments = tickets.map(ticket => ({ feiTicketId: ticket.feiTicketId, feiTicketNo: ticket.feiTicketNo, sewingTaskId: ticket.sewingTaskId, sewingTaskNo: ticket.sewingTaskNo, receiverFactoryId: ticket.receiverFactoryId, receiverFactoryName: ticket.receiverFactoryName }))
  const operator = { operatorId: 'WAREHOUSE-Q', operatorName: '裁床仓管', operatorRole: '裁片仓交出员' }
  const legId = 'CYCLE-Q:handover:1'
  // 已保存正式来源夹具，不调用 getter 的内部数量公式生成期望值。
  const canonicalIntent = JSON.stringify({ bagCode: 'BAG-Q', usageCycleId: 'CYCLE-Q', handoverLegId: legId, handoverOrderId: 'HO-Q', handoverOrderNo: 'HO-Q', handoverRecordId: 'FORMAL-BAG', handoverRecordNo: 'FORMAL-BAG', assignments, submittedTicketSnapshot: tickets, source: 'WEB', operator })
  const event: CuttingRuntimeEvent<'新增交出记录'> = { eventId: 'EVENT-FORMAL-BAG', eventNo: 'EVENT-FORMAL-BAG', eventType: '新增交出记录', eventSource: 'WEB', eventStatus: '已同步', occurredAt: '2026-10-02 11:00:00', operatorId: operator.operatorId, operatorName: operator.operatorName, operatorRole: operator.operatorRole, idempotencyKey: 'whole-bag-handover:FORMAL-BAG',
    inventoryEffect: { inventoryScope: '裁床待交出仓', direction: 'OUT', qty: 80, unit: '片', fromWarehouseArea: '待交出一区', fromLocationCode: 'A-01' },
    refs: { productionOrderId: assignment.productionOrderId, productionOrderNo: assignment.productionOrderNo, transferBagCode: 'BAG-Q', usageCycleId: 'CYCLE-Q', handoverOrderId: 'HO-Q', handoverRecordId: 'FORMAL-BAG', handoverLegId: legId, sewingTaskIds: [assignment.runtimeTaskId], sewingTaskNos: [assignment.taskNo!], feiTicketIds: tickets.map(ticket => ticket.feiTicketId), feiTicketNos: tickets.map(ticket => ticket.feiTicketNo) },
    payload: { canonicalIntent, handoverLegId: legId, handoverOrderId: 'HO-Q', handoverOrderNo: 'HO-Q', handoverRecordId: 'FORMAL-BAG', handoverRecordNo: 'FORMAL-BAG', receiverType: '车缝厂', receiverId: assignment.factoryId, receiverName: assignment.factoryName,
      transferBagUses: [{ bagUseId: 'CYCLE-Q', bagCode: 'BAG-Q', containedFeiTicketIds: tickets.map(ticket => ticket.feiTicketId), totalPieceQty: 80, sewingTaskIds: [assignment.runtimeTaskId], sewingTaskNos: [assignment.taskNo!], ticketSnapshot: tickets, sourceWarehouseArea: '待交出一区', sourceLocationCode: 'A-01' }],
      feiTicketItems: tickets.map(ticket => ({ feiTicketId: ticket.feiTicketId, feiTicketNo: ticket.feiTicketNo, pieceQty: ticket.pieceQty, unit: '片' })), currentHandedOverQty: 80, submittedAt: '2026-10-02 11:00:00', submittedBy: operator.operatorName },
  }
  assert.equal(isCompleteSuccessfulWholeBagHandoverEvent(event), true, '测试使用现有正式交出解析器接受的完整来源')
  withFormalSources([simple, event], () => {
    const result = getPpicReturnQuantityBasis(assignment.assignmentId)
    assert.equal(result.status, 'READY'); assert.equal(result.expectedQty, 50)
    assert.ok(result.sourceRefs.some(ref => ref.kind === 'TRANSFER_BAG_HANDOVER' && ref.recordId === 'FORMAL-BAG'))
  })
})

test('R45: current ambiguous source does not erase a historically confirmed 35% target', () => {
  const old = simpleEvent('ASOF-OLD', [50, 50, 100])
  const future = simpleEvent('ASOF-FUTURE', [70, 70, 140]); future.occurredAt = '2026-10-06 10:00:00'
  withFormalSources([old, future], () => {
    assert.equal(getPpicReturnQuantityBasis(assignment.assignmentId, '2026-10-04 23:59:59').expectedQty, 50)
    assert.equal(getPpicReturnQuantityBasis(assignment.assignmentId, '2026-10-07 10:00:00').status, 'AMBIGUOUS')
    const row = listSewingOutsourcingReturnTrackingRows('2026-10-07 10:00:00').find(r => r.assignment.assignmentId === assignment.assignmentId)!
    assert.deepEqual(listSewingOutsourcingReturnTrackingRows('2026-10-07 10:00:00', item => item.assignmentId === assignment.assignmentId), [row], 'H15 提前按任务限定仍保留全部数量、历史节点和责任事实')
    assert.deepEqual(listSewingOutsourcingReturnTrackingRows('2026-10-07 10:00:00', () => false), [])
    assert.equal(row.returnProjection.milestones.find(n => n.ratio === .35)?.targetQty, 18)
    assert.deepEqual(row.returnProjection.missingMilestones.map(n => n.ratio), [1])
  })
})
