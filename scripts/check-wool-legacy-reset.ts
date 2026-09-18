import assert from 'node:assert/strict'
import type { PdaHandoverHead, PdaHandoverRecord, PdaHandoverStateSnapshot, PdaPickupRecord } from '../src/data/fcs/pda-handover-events.ts'
import type { WoolDomainStore } from '../src/data/fcs/wool-domain/store.ts'

const values = new Map<string, string>()
let failKey = ''
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem(key: string, value: string) { if (key === failKey) { failKey = ''; throw new Error('测试存储失败') }; values.set(key, value) },
  removeItem(key: string) { values.delete(key) },
}
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage, sessionStorage: storage, addEventListener() {}, dispatchEvent() {}, location: { pathname: '/fcs/craft/wool/work-orders', search: '' } } })
Object.defineProperty(globalThis, 'document', { configurable: true, value: { addEventListener() {} } })
const core = await import('../src/data/fcs/factory-receiving.ts')
const registry = await import('../src/data/fcs/pda-handover-handout-registry.ts')
const { resetLegacyWoolFacts, LEGACY_WOOL_STORE_KEY } = await import('../src/data/fcs/wool-domain/legacy-reset.ts')
const PDA_KEY = 'higood.formal-merged-handout-actions.v1', STAGE_KEY = 'higood-fcs-wool-stage-store-v3'
const beforePdaLoad = core.captureFactoryReceivingData()
const dormant = registry.captureRegisteredPdaHandoverState()
const dormantHeads = [
  ['DORMANT-OLD', { handoverId: 'DORMANT-OLD', taskId: 'DORMANT-OLD-TASK' }],
  ['DORMANT-KEEP', { handoverId: 'DORMANT-KEEP', taskId: 'DORMANT-OTHER-TASK' }],
] as Array<[string, PdaHandoverHead]>
const dormantState: PdaHandoverStateSnapshot = { ...dormant, handoverHeadAdditions: dormantHeads,
  handoutRecordAdditions: dormantHeads.map(([id, head]) => [id, [{ recordId: `${id}-OUT`, handoverId: id, taskId: head.taskId } as PdaHandoverRecord]]),
  pickupRecordAdditions: dormantHeads.map(([id, head]) => [id, [{ recordId: `${id}-IN`, handoverId: id, taskId: head.taskId } as PdaPickupRecord]]),
  pickupRecordOverrides: dormantHeads.map(([id]) => [`${id}-IN`, { status: 'RECEIVED' }]),
  headCompletionOverrides: dormantHeads.map(([id]) => [id, { completionStatus: 'COMPLETED' }]),
}
dormantState.persistedActionsRaw = JSON.stringify({ version: 1, ...Object.fromEntries(Object.entries(dormantState).filter(([key]) => key !== 'persistedActionsRaw' && !key.startsWith('cached'))) })
registry.restoreRegisteredPdaHandoverState(dormantState)
storage.setItem(LEGACY_WOOL_STORE_KEY, JSON.stringify({ workOrders: { old: { woolOrderId: 'old', taskId: 'DORMANT-OLD-TASK' } }, machines: [], handovers: [] }))
resetLegacyWoolFacts({ workOrders: {}, machines: [], handovers: [] } as unknown as WoolDomainStore)
const dormantSaved = JSON.parse(storage.getItem(PDA_KEY)!)
assert.deepEqual(dormantSaved.handoverHeadAdditions.map(([id]: [string]) => id), ['DORMANT-KEEP'])
assert.deepEqual(dormantSaved.pickupRecordAdditions.map(([id]: [string]) => id), ['DORMANT-KEEP'])
assert.deepEqual(registry.captureRegisteredPdaHandoverState().handoutRecordAdditions.map(([id]) => id), ['DORMANT-KEEP'])
const pda = await import('../src/data/fcs/pda-handover-events.ts')
const loaded = pda.capturePdaHandoverState()
assert.ok(loaded.pickupRecordAdditions.some(([id]) => id === 'DORMANT-KEEP'))
assert.ok(!JSON.stringify(loaded).includes('DORMANT-OLD'))
for (const key of ['handoverHeadAdditions', 'pickupRecordAdditions', 'handoutRecordAdditions', 'pickupRecordOverrides', 'handoutRecordOverrides', 'handoutRecordVersionHistory', 'headCompletionOverrides'] as const) {
  ;(loaded[key] as Array<[string, unknown]>) = loaded[key].filter(([id]) => !id.startsWith('DORMANT-'))
}
loaded.persistedActionsRaw = null
pda.restorePdaHandoverState(loaded)
core.restoreFactoryReceivingData(beforePdaLoad)
values.delete(STAGE_KEY)
console.log('✓ PDA 尚未加载时清理共享与持久化旧记录，后续加载不复活，非毛织领料和完成记录保留')
const { buildWoolFactWorkflowMockStore } = await import('../src/data/fcs/wool-domain/mock-data.ts')
const oldId = 'CUSTOM-OLD-42', oldTask = 'CUSTOM-TASK-42', oldHandover = 'CUSTOM-HANDOVER-42'
const receivingSeed = core.captureFactoryReceivingData(), pdaSeed = pda.capturePdaHandoverState()
const cleanStore = buildWoolFactWorkflowMockStore()
const currentOrderId = Object.keys(cleanStore.workOrders)[0]
const oldMachines = [
  { ...cleanStore.machines[0], machineModel: '原厂保留机型', status: 'REPAIR' as const },
  { ...cleanStore.machines[0], machineId: 'CUSTOM-MACHINE-42', machineNo: '机42', machineName: '厂内自建横机', status: 'DISABLED' as const },
]
const legacy = { workOrders: { [oldId]: { woolOrderId: oldId, taskId: oldTask, taskNo: 'JK-OLD-42' } }, handovers: [{ handoverId: oldHandover, woolOrderId: oldId }], machines: oldMachines, machineAssociations: [{ machineId: oldMachines[0].machineId, woolOrderId: oldId }] }

function setup() {
  const data = structuredClone(receivingSeed)
  const template = data.sources.find(source => source.lines[0].material.kind === 'YARN')!
  const oldLine = { ...structuredClone(template.lines[0]), id: 'MIXED-OLD', woolOrderId: oldId }
  const keptLine = { ...structuredClone(template.lines[0]), id: 'MIXED-KEEP', material: { ...template.lines[0].material, sku: 'SKU-WOOL-MOCK-01-IS-A-MATERIAL' } }
  const freshLine = { ...structuredClone(template.lines[0]), id: 'NEW-STAGE-KEEP', woolOrderId: currentOrderId }
  const seededLine = { ...structuredClone(template.lines[0]), id: 'OLD-SEED-LINE', woolOrderId: 'WOOL-RCV-DEMO-001' }
  const source = { ...structuredClone(template), id: 'MIXED-SOURCE', documentNo: 'MIXED-SOURCE', lines: [oldLine, keptLine, freshLine, seededLine] }
  const derived = { ...structuredClone(template), id: 'OLD-HANDOUT-SOURCE', documentNo: 'OLD-HANDOUT-SOURCE', originalRecordId: oldHandover, lines: [{ ...structuredClone(template.lines[0]), id: 'OLD-HANDOUT-LINE' }] }
  data.sources.push(source, derived, { ...structuredClone(derived), id: 'PDA-OLD-SOURCE', documentNo: 'PDA-OLD-SOURCE', originalRecordId: 'OLD-HEAD-RECORD', lines: [{ ...structuredClone(template.lines[0]), id: 'PDA-OLD-LINE' }] })
  const position = core.getDefaultFactoryReceiptPosition(template.targetFactoryId)
  const inputs = source.lines.map(line => ({ sourceId: source.id, sourceLineId: line.id, ...position, businessQty: 1, businessUnit: 'kg' }))
  const input = { id: 'MIXED-RECEIPT', factoryId: template.targetFactoryId, operatorName: '验收员', operatorId: 'TEST', receivedAt: '2026-09-18 10:00:00', remark: '', lines: inputs }
  data.receipts.push({ ...input, fingerprint: JSON.stringify(input), lines: source.lines.map((line, i) => ({ ...inputs[i], id: `R-${line.id}`, material: line.material, qty: 1, unit: 'kg' as const, sourceDocumentNo: source.documentNo, sourceType: source.type, origin: source.origin, woolOrderId: line.woolOrderId })) })
  data.deliveries.push({ id: 'MIXED-DELIVERY', barcode: 'MIXED-DELIVERY', deliveredAt: input.receivedAt, createdBy: 'TEST', lines: source.lines.map(line => ({ id: `D-${line.id}`, sourceId: source.id, sourceLineId: line.id, qty: 1, unit: 'kg', rollBarcodes: [] })) })
  data.allocations.push({ id: 'REMOVE-OLD-ALLOCATION', woolOrderId: oldId, receiptLineId: 'R-MIXED-KEEP', qty: 0.5, operatorName: 'TEST', at: input.receivedAt }, { id: 'KEEP-ALLOCATION', dyeOrderId: 'DWO-001', receiptLineId: 'R-MIXED-KEEP', qty: 0.5, operatorName: 'TEST', at: input.receivedAt })
  data.materialUses = [{ id: 'KEEP-MIXED-USE', printingOrderId: 'PWO-TEST', factoryId: template.targetFactoryId, operatorName: 'TEST', at: input.receivedAt, lines: [{ receiptLineId: 'R-MIXED-OLD', qty: 0.2, unit: 'kg' }, { receiptLineId: 'R-MIXED-KEEP', qty: 0.2, unit: 'kg' }] }]
  core.restoreFactoryReceivingData(data)

  const heads = [
    ['OLD-HEAD', { handoverId: 'OLD-HEAD', taskId: oldTask, scopeKey: oldId }],
    ['SEED-HEAD', { handoverId: 'SEED-HEAD', taskId: 'TASK-WOOL-MOCK-03', scopeKey: 'WOOL-MOCK-03' }],
    ['KEEP-HEAD', { handoverId: 'KEEP-HEAD', taskId: 'TASK-DYE-001', scopeKey: 'DWO-001' }],
  ] as Array<[string, PdaHandoverHead]>
  const records = heads.map(([id, head]) => [id, [{ recordId: `${id}-RECORD`, handoverId: id, taskId: head.taskId, ...(id === 'OLD-HEAD' ? { sourceWoolHandoverId: oldHandover } : {}) }]] as [string, PdaHandoverRecord[]])
  const state: PdaHandoverStateSnapshot = { ...structuredClone(pdaSeed), handoverHeadAdditions: heads, handoutRecordAdditions: records,
    pickupRecordAdditions: heads.map(([id, head]) => [id, [{ recordId: `${id}-PICKUP`, handoverId: id, taskId: head.taskId } as PdaPickupRecord]]),
    handoutRecordOverrides: records.map(([, rows]) => [rows[0].recordId, { status: 'WRITTEN_BACK' }]),
    pickupRecordOverrides: heads.map(([id]) => [`${id}-PICKUP`, { status: 'RECEIVED' }]),
    handoutRecordVersionHistory: records.map(([, rows]) => [rows[0].taskId, rows]),
    headCompletionOverrides: heads.map(([id]) => [id, { completionStatus: 'COMPLETED' }]), cachedBuiltHeads: heads.map(([, head]) => head), cachedPostFinishingBuiltHeads: null,
  }
  state.persistedActionsRaw = JSON.stringify({ version: 1, ...Object.fromEntries(Object.entries(state).filter(([key]) => key !== 'persistedActionsRaw' && !key.startsWith('cached'))) })
  pda.restorePdaHandoverState(state)
  storage.setItem(LEGACY_WOOL_STORE_KEY, JSON.stringify(legacy))
  storage.setItem('unrelated-production-orders', '{"unchanged":true}')
  values.delete(STAGE_KEY)
  return { store: structuredClone(cleanStore), data, state, input }
}
let checks = 1
function check(label: string, fn: () => void) { fn(); checks++; console.log(`✓ ${label}`) }
check('按真实旧 ID 清理混合接收、送货、分配行，保留新阶段和非毛织事实', () => {
  const { store, input } = setup()
  const result = resetLegacyWoolFacts(store)
  assert.deepEqual(new Set(result.removedSourceLineIds), new Set(['MIXED-OLD', 'OLD-SEED-LINE', 'OLD-HANDOUT-LINE', 'PDA-OLD-LINE']))
  const saved = core.captureFactoryReceivingData()
  assert.deepEqual(saved.sources.find(source => source.id === 'MIXED-SOURCE')!.lines.map(line => line.id), ['MIXED-KEEP', 'NEW-STAGE-KEEP'])
  assert.equal(saved.sources.some(source => source.id === 'OLD-HANDOUT-SOURCE'), false)
  assert.deepEqual(saved.receipts[0].lines.map(line => line.id), ['R-MIXED-KEEP', 'R-NEW-STAGE-KEEP'])
  assert.deepEqual(saved.deliveries[0].lines.map(line => line.id), ['D-MIXED-KEEP', 'D-NEW-STAGE-KEEP'])
  assert.deepEqual(saved.allocations.map(allocation => allocation.id), ['KEEP-ALLOCATION'])
  assert.deepEqual(saved.materialUses![0].lines, [{ receiptLineId: 'R-MIXED-KEEP', qty: 0.2, unit: 'kg' }])
  assert.deepEqual(core.prepareFactoryReceipt({ ...input, lines: input.lines.filter(line => ['MIXED-KEEP', 'NEW-STAGE-KEEP'].includes(line.sourceLineId)) }), saved.receipts[0])
  assert.equal(storage.getItem('unrelated-production-orders'), '{"unchanged":true}')
})
check('旧设备档案及维护状态保留，旧设备占用和旧单不迁入新存储', () => {
  const { store } = setup()
  resetLegacyWoolFacts(store)
  assert.equal(storage.getItem(LEGACY_WOOL_STORE_KEY), null)
  assert.deepEqual(store.machines.find(machine => machine.machineId === oldMachines[0].machineId), oldMachines[0])
  assert.deepEqual(store.machines.find(machine => machine.machineId === oldMachines[1].machineId), oldMachines[1])
  assert.ok(!store.machineAssociations.some(association => association.machineId === oldMachines[0].machineId), '维修旧设备不被新演示关联占用')
  const persisted = JSON.parse(storage.getItem(STAGE_KEY)!)
  assert.deepEqual(persisted.machines, store.machines)
  assert.equal(persisted.workOrders[oldId], undefined)
  assert.equal(persisted.machineAssociations.some((row: { woolOrderId: string }) => row.woolOrderId === oldId), false)
})
check('PDA 持久化及运行态交接、领料、覆盖和历史只移除旧毛织', () => {
  const { store } = setup()
  resetLegacyWoolFacts(store)
  const state = pda.capturePdaHandoverState(), persisted = JSON.parse(storage.getItem(PDA_KEY)!)
  for (const current of [state, persisted]) {
    assert.deepEqual(current.handoverHeadAdditions.map(([id]: [string, unknown]) => id), ['KEEP-HEAD'])
    assert.deepEqual(current.handoutRecordAdditions.map(([id]: [string, unknown]) => id), ['KEEP-HEAD'])
    assert.deepEqual(current.pickupRecordAdditions.map(([id]: [string, unknown]) => id), ['KEEP-HEAD'])
    assert.deepEqual(current.handoutRecordOverrides.map(([id]: [string, unknown]) => id), ['KEEP-HEAD-RECORD'])
    assert.deepEqual(current.pickupRecordOverrides.map(([id]: [string, unknown]) => id), ['KEEP-HEAD-PICKUP'])
    assert.deepEqual(current.handoutRecordVersionHistory.map(([id]: [string, unknown]) => id), ['TASK-DYE-001'])
    assert.deepEqual(current.headCompletionOverrides.map(([id]: [string, unknown]) => id), ['KEEP-HEAD'])
  }
  assert.equal(state.cachedBuiltHeads, null)
})
check('重启和重复初始化不复活旧单；没有 v2 时也清除明确旧演示引用', () => {
  const { store } = setup()
  resetLegacyWoolFacts(store)
  const persisted = [...values.entries()]
  core.clearFactoryReceivingCache()
  const again = resetLegacyWoolFacts(JSON.parse(storage.getItem(STAGE_KEY)!))
  assert.equal(again.legacyStoreRemoved, false)
  assert.deepEqual(again.removedSourceLineIds, [])
  assert.deepEqual([...values.entries()], persisted)
  const noLegacy = setup()
  values.delete(LEGACY_WOOL_STORE_KEY)
  const result = resetLegacyWoolFacts(noLegacy.store)
  assert.deepEqual(result.removedSourceLineIds, ['OLD-SEED-LINE'])
  assert.deepEqual(result.removedPdaHeadIds, ['SEED-HEAD'])
  assert(core.getFactoryReceivingSource('MIXED-SOURCE')!.lines.some(line => line.woolOrderId === oldId))
})
check('损坏旧数据不覆盖；保存失败回退原接收、PDA、设备及存储', () => {
  const { store } = setup()
  const before = [...values.entries()], beforePda = pda.capturePdaHandoverState(), machines = structuredClone(store.machines)
  failKey = STAGE_KEY
  assert.throws(() => resetLegacyWoolFacts(store), /原记录已保留/)
  assert.deepEqual(new Map(values), new Map(before))
  assert.deepEqual(store.machines, machines)
  assert.deepEqual(pda.capturePdaHandoverState(), beforePda)
  assert(core.captureFactoryReceivingData().sources.find(source => source.id === 'MIXED-SOURCE')!.lines.some(line => line.id === 'MIXED-OLD'))
  storage.setItem(LEGACY_WOOL_STORE_KEY, '{broken')
  const damaged = new Map(values)
  assert.throws(() => resetLegacyWoolFacts(store), /未清除任何记录/)
  assert.deepEqual(new Map(values), damaged)
})
const runtime = await import('../src/data/fcs/runtime-process-tasks.ts')
const wool = await import('../src/data/fcs/wool-domain/store.ts')
const source = await import('../src/data/fcs/wool-domain/tech-pack-source.ts')
const { WOOL_DISPATCH_DEMO_ORDER_IDS } = await import('../src/data/fcs/process-tasks.ts')
check('合格旧来源任务只生成新配对身份，不继承旧数量和记录；旧演示任务仍排除', () => {
  setup()
  const previousWool = wool.readWoolStore(), previousRuntime = runtime.captureRuntimeDirectDispatchState()
  const template = runtime.listRuntimeProcessTasks().find(task => (task.processCode === 'WOOL' || task.processBusinessCode === 'WOOL') && task.sourceEntryId)!
  const taskId = 'LEGACY-VALID-SOURCE-TASK', productionId = 'LEGACY-VALID-SOURCE-PO'
  const nextRuntime = structuredClone(previousRuntime)
  const order = structuredClone(nextRuntime.productionOrders.find(order => order.productionOrderId === template.productionOrderId)!)
  order.productionOrderId = productionId; order.productionOrderNo = productionId; order.taskBreakdownSummary.isBrokenDown = true
  assert.ok(order.techPackSnapshot)
  order.techPackSnapshot.productionOrderId = productionId; order.techPackSnapshot.productionOrderNo = productionId
  nextRuntime.productionOrders.push(order)
  nextRuntime.reassignedTasks.push([taskId, { ...structuredClone(template), taskId, taskNo: taskId, productionOrderId: productionId,
    status: 'NOT_STARTED', executionEnabled: true, isSplitSource: false, isSplitResult: false,
    assignedFactoryId: 'OWN_WOOL_FACTORY', assignedFactoryName: '周哥毛织厂', taskDeadline: '2026-09-30' }])
  try {
    runtime.restoreRuntimeDirectDispatchState(nextRuntime)
    const fresh = buildWoolFactWorkflowMockStore()
    storage.setItem(LEGACY_WOOL_STORE_KEY, JSON.stringify({ workOrders: { 'OLD-VALID': { woolOrderId: 'OLD-VALID', taskId } }, machines: [],
      handovers: [{ handoverId: 'OLD-VALID-OUT', woolOrderId: 'OLD-VALID', handoverQty: 999 }], processReports: [{ reportId: 'OLD-VALID-REPORT', woolOrderId: 'OLD-VALID', reportedQty: 999 }] }))
    resetLegacyWoolFacts(fresh)
    wool.replaceWoolStore(fresh)
    source.ensureRuntimeWoolWorkOrders(productionId)
    source.ensureRuntimeWoolWorkOrders(productionId)
    const current = wool.readWoolStore(), pair = Object.values(current.workOrders).filter(order => order.sourceTaskId === taskId)
    assert.equal(pair.length, 2)
    assert.deepEqual(new Set(pair.map(order => order.stage)), new Set(['KNITTING', 'LINKING']))
    assert.ok(pair.every(order => order.woolOrderId.startsWith(`WOOL-STAGE:${taskId}:`)))
    const newIds = new Set(pair.map(order => order.woolOrderId))
    for (const rows of [current.processReports, current.handovers, current.yarnReceipts, current.internalReceipts, current.pieceReceipts, current.craftRecords, current.completions]) {
      assert.ok(!rows.some(row => newIds.has(row.woolOrderId)))
    }
    assert.ok(!JSON.stringify(current).includes('OLD-VALID-REPORT')); assert.ok(!JSON.stringify(current).includes('OLD-VALID-OUT'))
    source.ensureRuntimeWoolWorkOrders()
    assert.ok(Object.values(wool.readWoolStore().workOrders).every(order => !WOOL_DISPATCH_DEMO_ORDER_IDS.has(order.productionOrderId)))
  } finally {
    runtime.restoreRuntimeDirectDispatchState(previousRuntime); wool.replaceWoolStore(previousWool)
  }
})
console.log(`PASS ${checks} legacy wool reset checks`)
