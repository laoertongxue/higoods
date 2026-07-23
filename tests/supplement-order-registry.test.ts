import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'

import {
  completeSupplementOrder,
  getSupplementOrder,
  listSupplementOrders,
  listSupplementOrdersByCutOrder,
  registerSupplementOrder,
  resetSupplementOrderRegistryForTesting,
  type RegisterSupplementOrderInput,
  type SupplementOrderLifecycle,
} from '../src/data/fcs/cutting/supplement-order-registry.ts'
import {
  fixedSupplementOrderFixtures,
  ensureFixedSupplementOrderFixturesRegistered,
} from '../src/data/fcs/cutting/cut-order-supplement-fixture.ts'

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
    reasonDetail: '验片发现黑色 M 码前片破损，需要按实际缺口补裁。',
    totalQty: 12,
    lineSummary: '黑色 / M：12 片',
    lines: [{ color: '黑色', size: 'M', supplementQty: 12 }],
    materialDemands: [{ materialSku: 'MAT-BLK-001', materialName: '黑色弹力斜纹布', requiredQty: 18.6, unit: '米' }],
    createdAt: '2026-07-22 09:00:00',
    createdBy: '王师傅',
    ...overrides,
  }
}

test('固定补料 fixture 一次幂等初始化全部 15 条且每张裁片单序号稳定', () => {
  ensureFixedSupplementOrderFixturesRegistered()
  ensureFixedSupplementOrderFixturesRegistered()

  assert.equal(fixedSupplementOrderFixtures.length, 15)
  const grouped = Map.groupBy(fixedSupplementOrderFixtures, (item) => item.cutOrderId)
  grouped.forEach((fixtures, cutOrderId) => {
    assert.deepEqual(
      listSupplementOrdersByCutOrder(cutOrderId).map((item) => item.sequenceNo),
      fixtures.map((item) => item.sequenceNo),
    )
  })
  assert.equal(
    fixedSupplementOrderFixtures
      .map((fixture) => getSupplementOrder(fixture.id))
      .filter(Boolean).length,
    15,
  )
  assert.deepEqual(
    listSupplementOrders().map((item) => item.id),
    fixedSupplementOrderFixtures.map((item) => item.id),
  )
})

test('全量列表返回值的嵌套详情也不能反向污染 registry', () => {
  ensureFixedSupplementOrderFixturesRegistered()
  const listed = listSupplementOrders()
  const target = listed[1]
  ;(target.lines as Array<{ color: string; size: string; supplementQty: number }>)[0].size = '被篡改尺码'
  ;(target.materialDemands as Array<{ materialSku: string; materialName: string; requiredQty: number; unit: string }>)[0].requiredQty = 999

  assert.notEqual(getSupplementOrder(target.id)?.lines[0].size, '被篡改尺码')
  assert.notEqual(getSupplementOrder(target.id)?.materialDemands[0].requiredQty, 999)
})

test('嵌套详情登记、读取和完成后保持完整，深层篡改不污染 registry', () => {
  const registered = registerSupplementOrder(buildInput())
  assert.equal(registered.reasonDetail, '验片发现黑色 M 码前片破损，需要按实际缺口补裁。')
  assert.deepEqual(registered.lines, [{ color: '黑色', size: 'M', supplementQty: 12 }])
  assert.deepEqual(registered.materialDemands, [{ materialSku: 'MAT-BLK-001', materialName: '黑色弹力斜纹布', requiredQty: 18.6, unit: '米' }])

  ;(registered.lines as Array<{ color: string; size: string; supplementQty: number }>)[0].supplementQty = 999
  ;(registered.materialDemands as Array<{ materialSku: string; materialName: string; requiredQty: number; unit: string }>)[0].materialName = '被篡改物料'

  const completed = completeSupplementOrder({
    id: 'supplement-1',
    completedAt: '2026-07-22 10:30:00',
    completedBy: '李主管',
  })
  assert.deepEqual(completed.lines, [{ color: '黑色', size: 'M', supplementQty: 12 }])
  assert.deepEqual(completed.materialDemands, [{ materialSku: 'MAT-BLK-001', materialName: '黑色弹力斜纹布', requiredQty: 18.6, unit: '米' }])

  ;(completed.lines as Array<{ color: string; size: string; supplementQty: number }>)[0].color = '被篡改颜色'
  assert.deepEqual(getSupplementOrder('supplement-1')?.lines, [{ color: '黑色', size: 'M', supplementQty: 12 }])
})

test('登记时隔离输入引用，后续篡改不能改写任何生命周期事实', () => {
  const input = buildInput()
  const mutableInput = input as {
    reason: string
    totalQty: number
    lineSummary: string
    lines: Array<{ color: string; size: string; supplementQty: number }>
    materialDemands: Array<{
      materialSku: string
      materialName: string
      requiredQty: number
      unit: string
    }>
  }
  const registered = asMutableAttackTarget(registerSupplementOrder(input))

  mutableInput.reason = '被篡改原因'
  mutableInput.totalQty = 999
  mutableInput.lineSummary = '被篡改摘要'
  mutableInput.lines[0].supplementQty = 999
  mutableInput.lines.push({ color: '被追加颜色', size: 'XL', supplementQty: 999 })
  mutableInput.lines.splice(0, 1)
  mutableInput.materialDemands[0].materialName = '被篡改物料'
  mutableInput.materialDemands.push({
    materialSku: 'MAT-MUTATED',
    materialName: '被追加物料',
    requiredQty: 999,
    unit: '米',
  })
  mutableInput.materialDemands.splice(0, 1)
  registered.reason = '被篡改登记返回值'
  ;(registered.lines as Array<{ color: string; size: string; supplementQty: number }>)[0].size = '被篡改返回尺码'

  const expectedLines = [{ color: '黑色', size: 'M', supplementQty: 12 }]
  const expectedMaterialDemands = [{
    materialSku: 'MAT-BLK-001',
    materialName: '黑色弹力斜纹布',
    requiredQty: 18.6,
    unit: '米',
  }]
  const queried = getSupplementOrder('supplement-1')
  const listed = listSupplementOrders()[0]
  const replayed = registerSupplementOrder(input)

  for (const actual of [queried, listed, replayed]) {
    assert.equal(actual?.reason, '裁片破损需补裁')
    assert.equal(actual?.totalQty, 12)
    assert.equal(actual?.lineSummary, '黑色 / M：12 片')
    assert.deepEqual(actual?.lines, expectedLines)
    assert.deepEqual(actual?.materialDemands, expectedMaterialDemands)
  }
  assert.equal(listSupplementOrders().length, 1)

  const completed = completeSupplementOrder({
    id: 'supplement-1',
    completedAt: '2026-07-22 10:30:00',
    completedBy: '李主管',
  })
  assert.equal(completed.reason, '裁片破损需补裁')
  assert.equal(completed.totalQty, 12)
  assert.equal(completed.lineSummary, '黑色 / M：12 片')
  assert.deepEqual(completed.lines, expectedLines)
  assert.deepEqual(completed.materialDemands, expectedMaterialDemands)
})

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
