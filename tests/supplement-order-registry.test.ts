import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'

import {
  completeSupplementOrder,
  getSupplementOrder,
  listSupplementOrdersByCutOrder,
  registerSupplementOrder,
  resetSupplementOrderRegistryForTesting,
  type RegisterSupplementOrderInput,
  type SupplementOrderLifecycle,
} from '../src/data/fcs/cutting/supplement-order-registry.ts'

type MutableLifecycleForAttack = {
  -readonly [Key in keyof SupplementOrderLifecycle]: SupplementOrderLifecycle[Key]
}

function asMutableAttackTarget(value: unknown): MutableLifecycleForAttack {
  return value as MutableLifecycleForAttack
}

afterEach(() => {
  resetSupplementOrderRegistryForTesting()
})

function buildInput(
  overrides: Partial<RegisterSupplementOrderInput> = {},
): RegisterSupplementOrderInput {
  return {
    id: 'supplement-1',
    recordNo: 'BL20260722001',
    cutOrderId: 'cut-order-1',
    cutOrderNo: 'CP67942',
    productionOrderNo: 'PO15089',
    reason: '裁片破损需补裁',
    totalQty: 12,
    lineSummary: '黑色 / M：12 片',
    createdAt: '2026-07-22 09:00:00',
    createdBy: '王师傅',
    ...overrides,
  }
}

test('同一裁片单的补料次数递增，并按次数升序返回', () => {
  const firstRegistered = registerSupplementOrder(buildInput({
    id: 'supplement-2',
    recordNo: 'BL20260722002',
    createdAt: '2026-07-22 09:10:00',
  }))
  const secondRegistered = registerSupplementOrder(buildInput())

  assert.equal(firstRegistered.sequenceNo, 1)
  assert.equal(secondRegistered.sequenceNo, 2)
  assert.deepEqual(
    listSupplementOrdersByCutOrder('cut-order-1').map((item) => item.sequenceNo),
    [1, 2],
  )
})

test('不同裁片单各自从第 1 次开始，且新建补料单默认为未完成', () => {
  const firstCutOrder = registerSupplementOrder(buildInput())
  const anotherCutOrder = registerSupplementOrder(buildInput({
    id: 'supplement-2',
    recordNo: 'BL20260722002',
    cutOrderId: 'cut-order-2',
    cutOrderNo: 'CP67943',
  }))

  assert.equal(firstCutOrder.sequenceNo, 1)
  assert.equal(anotherCutOrder.sequenceNo, 1)
  assert.equal(firstCutOrder.status, '未完成')
  assert.equal(firstCutOrder.completedAt, '')
  assert.equal(firstCutOrder.completedBy, '')
})

test('完成补料单只更新目标单，并记录完成人和完成时间', () => {
  registerSupplementOrder(buildInput())
  registerSupplementOrder(buildInput({
    id: 'supplement-2',
    recordNo: 'BL20260722002',
  }))

  const completed = completeSupplementOrder({
    id: 'supplement-2',
    completedAt: '2026-07-22 10:30:00',
    completedBy: '李主管',
  })

  assert.equal(completed.status, '已完成')
  assert.equal(completed.completedAt, '2026-07-22 10:30:00')
  assert.equal(completed.completedBy, '李主管')
  assert.equal(getSupplementOrder('supplement-1')?.status, '未完成')
  assert.equal(getSupplementOrder('supplement-1')?.completedAt, '')
})

test('完成不存在的补料单时给出刷新提示', () => {
  assert.throws(
    () => completeSupplementOrder({
      id: 'missing',
      completedAt: '2026-07-22 10:30:00',
      completedBy: '李主管',
    }),
    { message: '未找到对应补料单，请刷新后重试。' },
  )
})

test('重复完成补料单时给出无需重复操作提示', () => {
  registerSupplementOrder(buildInput())
  completeSupplementOrder({
    id: 'supplement-1',
    completedAt: '2026-07-22 10:30:00',
    completedBy: '李主管',
  })

  assert.throws(
    () => completeSupplementOrder({
      id: 'supplement-1',
      completedAt: '2026-07-22 11:00:00',
      completedBy: '赵主管',
    }),
    { message: '该补料单已完成，无需重复操作。' },
  )
})

test('同一 ID 重复注册保持幂等且不占用新的补料次数', () => {
  const original = registerSupplementOrder(buildInput())
  const replay = registerSupplementOrder(buildInput({
    reason: '重复请求中的不同原因不应覆盖原记录',
    totalQty: 99,
  }))
  const next = registerSupplementOrder(buildInput({
    id: 'supplement-2',
    recordNo: 'BL20260722002',
  }))

  assert.deepEqual(replay, original)
  assert.equal(replay.reason, '裁片破损需补裁')
  assert.equal(replay.totalQty, 12)
  assert.equal(next.sequenceNo, 2)
  assert.equal(listSupplementOrdersByCutOrder('cut-order-1').length, 2)
})

test('公开边界只导出一个补料生命周期类型', () => {
  const source = readFileSync(
    new URL('../src/data/fcs/cutting/supplement-order-registry.ts', import.meta.url),
    'utf8',
  )
  const lifecycleTypeExports = source.match(
    /^export (?:interface|type) (?:Readonly)?SupplementOrderLifecycle\b/gm,
  ) || []

  assert.equal(lifecycleTypeExports.length, 1)
})

test('篡改注册返回值不会污染内部记录', () => {
  const registered = asMutableAttackTarget(registerSupplementOrder(buildInput()))
  registered.cutOrderNo = 'CP-MUTATED'
  registered.status = '已完成'

  const stored = getSupplementOrder('supplement-1')
  assert.equal(stored?.cutOrderNo, 'CP67942')
  assert.equal(stored?.status, '未完成')
})

test('篡改单条查询返回值不会污染内部记录', () => {
  registerSupplementOrder(buildInput())
  const queried = asMutableAttackTarget(getSupplementOrder('supplement-1'))
  queried.reason = '被篡改的原因'
  queried.totalQty = 999

  const stored = getSupplementOrder('supplement-1')
  assert.equal(stored?.reason, '裁片破损需补裁')
  assert.equal(stored?.totalQty, 12)
})

test('篡改列表查询返回值不会污染内部记录', () => {
  registerSupplementOrder(buildInput())
  const listed = asMutableAttackTarget(listSupplementOrdersByCutOrder('cut-order-1')[0])
  listed.recordNo = 'BL-MUTATED'
  listed.productionOrderNo = 'PO-MUTATED'

  const stored = getSupplementOrder('supplement-1')
  assert.equal(stored?.recordNo, 'BL20260722001')
  assert.equal(stored?.productionOrderNo, 'PO15089')
})

test('篡改完成返回值不会污染内部完成事实', () => {
  registerSupplementOrder(buildInput())
  const completed = completeSupplementOrder({
    id: 'supplement-1',
    completedAt: '2026-07-22 10:30:00',
    completedBy: '李主管',
  })
  const attackedCompleted = asMutableAttackTarget(completed)
  attackedCompleted.status = '未完成'
  attackedCompleted.completedAt = '2099-01-01 00:00:00'
  attackedCompleted.completedBy = '被篡改的人'

  const stored = getSupplementOrder('supplement-1')
  assert.equal(stored?.status, '已完成')
  assert.equal(stored?.completedAt, '2026-07-22 10:30:00')
  assert.equal(stored?.completedBy, '李主管')
})

test('同一 ID 不能跨裁片单重放', () => {
  registerSupplementOrder(buildInput())

  assert.throws(
    () => registerSupplementOrder(buildInput({
      cutOrderId: 'cut-order-2',
    })),
    { message: '补料单标识冲突，不能登记到不同业务对象。' },
  )
})

test('同一 ID 使用不同裁片单号时拒绝重放', () => {
  registerSupplementOrder(buildInput())

  assert.throws(
    () => registerSupplementOrder(buildInput({ cutOrderNo: 'CP67943' })),
    { message: '补料单标识冲突，不能登记到不同业务对象。' },
  )
})

test('同一 ID 使用不同补料单号时拒绝重放', () => {
  registerSupplementOrder(buildInput())

  assert.throws(
    () => registerSupplementOrder(buildInput({ recordNo: 'BL20260722999' })),
    { message: '补料单标识冲突，不能登记到不同业务对象。' },
  )
})

test('同一 ID 使用不同生产单号时拒绝重放', () => {
  registerSupplementOrder(buildInput())

  assert.throws(
    () => registerSupplementOrder(buildInput({ productionOrderNo: 'PO99999' })),
    { message: '补料单标识冲突，不能登记到不同业务对象。' },
  )
})
