import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  allocateCombinedDyeingOutput,
  type CombinedDyeingMemberSnapshot,
} from '../src/data/fcs/combined-dyeing-domain.ts'

const memberA: CombinedDyeingMemberSnapshot = {
  dyeWorkOrderId: 'DYE-WO-A',
  dyeWorkOrderNo: '染色加工单-A',
  productionOrderId: 'PO-A',
  productionOrderNo: 'PO-001',
  productionOrderOrderedAt: '2026-07-15 08:00:00',
  requiredQty: 600,
  effectiveSatisfiedQtyBeforeTask: 0,
  qtyUnit: 'Yard',
}

const memberB: CombinedDyeingMemberSnapshot = {
  dyeWorkOrderId: 'DYE-WO-B',
  dyeWorkOrderNo: '染色加工单-B',
  productionOrderId: 'PO-B',
  productionOrderNo: 'PO-002',
  productionOrderOrderedAt: '2026-07-15T09:00:00',
  requiredQty: 400,
  effectiveSatisfiedQtyBeforeTask: 0,
  qtyUnit: 'Yard',
}

const memberC: CombinedDyeingMemberSnapshot = {
  dyeWorkOrderId: 'DYE-WO-C',
  dyeWorkOrderNo: '染色加工单-C',
  productionOrderId: 'PO-C',
  productionOrderNo: 'PO-003',
  productionOrderOrderedAt: '2026-07-15 09:00:00',
  requiredQty: 200,
  effectiveSatisfiedQtyBeforeTask: 0,
  qtyUnit: 'Yard',
}

function allocationSummary(actualOutputQty: number) {
  return allocateCombinedDyeingOutput([memberC, memberA, memberB], actualOutputQty)
}

function main(): void {
  const domainSource = readFileSync(new URL('../src/data/fcs/combined-dyeing-domain.ts', import.meta.url), 'utf8')
  assert(!domainSource.includes('Date.parse'), '合并染色排序不得重新引入环境相关 Date.parse')
  assert(!/\bnew\s+Date\s*\(/.test(domainSource), '合并染色排序不得重新引入环境相关 new Date')

  const partial = allocationSummary(800)
  assert.deepEqual(
    partial.allocations.map(({ productionOrderNo, allocatedQty, satisfaction, unmetQty }) => ({
      productionOrderNo,
      allocatedQty,
      satisfaction,
      unmetQty,
    })),
    [
      { productionOrderNo: 'PO-001', allocatedQty: 600, satisfaction: 'FULL', unmetQty: 0 },
      { productionOrderNo: 'PO-002', allocatedQty: 200, satisfaction: 'PARTIAL', unmetQty: 200 },
      { productionOrderNo: 'PO-003', allocatedQty: 0, satisfaction: 'UNMET', unmetQty: 200 },
    ],
    '800 Yard 必须先满足最早下单的 A，再部分满足同时间但单号更小的 B',
  )
  assert.equal(partial.excessQty, 0, '未超过总需求时不得产生余量')

  const excess = allocationSummary(1300)
  assert.deepEqual(
    excess.allocations.map(({ productionOrderNo, allocatedQty, satisfaction, unmetQty }) => ({
      productionOrderNo,
      allocatedQty,
      satisfaction,
      unmetQty,
    })),
    [
      { productionOrderNo: 'PO-001', allocatedQty: 600, satisfaction: 'FULL', unmetQty: 0 },
      { productionOrderNo: 'PO-002', allocatedQty: 400, satisfaction: 'FULL', unmetQty: 0 },
      { productionOrderNo: 'PO-003', allocatedQty: 200, satisfaction: 'FULL', unmetQty: 0 },
    ],
    '产出不得分配超过成员剩余需求',
  )
  assert.equal(excess.excessQty, 100, '超过总需求的 100 Yard 必须单独返回')

  const zero = allocationSummary(0)
  assert(zero.allocations.every((item) => item.allocatedQty === 0 && item.satisfaction === 'UNMET'), '0 产出合法且所有未满足成员都应为未满足')
  assert.equal(zero.excessQty, 0)

  const alreadySatisfied = allocateCombinedDyeingOutput([
    { ...memberA, effectiveSatisfiedQtyBeforeTask: 600 },
    { ...memberB, effectiveSatisfiedQtyBeforeTask: 100 },
  ], 350)
  assert.deepEqual(
    alreadySatisfied.allocations.map((item) => [item.productionOrderNo, item.allocatedQty, item.satisfaction, item.unmetQty]),
    [
      ['PO-001', 0, 'FULL', 0],
      ['PO-002', 300, 'FULL', 0],
    ],
    '分配只计算本任务前尚未满足的数量',
  )
  assert.equal(alreadySatisfied.excessQty, 50)

  const decimal = allocateCombinedDyeingOutput([
    { ...memberA, requiredQty: 0.1 },
    { ...memberB, requiredQty: 0.2 },
  ], 0.3)
  assert.deepEqual(
    decimal.allocations.map((item) => [item.allocatedQty, item.satisfaction, item.unmetQty]),
    [
      [0.1, 'FULL', 0],
      [0.2, 'FULL', 0],
    ],
    '小数数量不得因浮点残差误判为部分满足',
  )
  assert.equal(decimal.excessQty, 0)

  for (const invalidOutput of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => allocationSummary(invalidOutput), /实际产出数量/, `必须拒绝非法实际产出：${invalidOutput}`)
  }
  assert.throws(() => allocateCombinedDyeingOutput([], 0), /至少包含 1 个成员/, '领域分配至少需要一个成员')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, requiredQty: 0 }], 0), /需求数量/, '需求数量必须大于 0')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, requiredQty: -1 }], 0), /需求数量/, '需求数量不得为负数')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, requiredQty: Number.NaN }], 0), /需求数量/, '需求数量必须是有限数')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, effectiveSatisfiedQtyBeforeTask: -1 }], 0), /任务前已满足数量/, '任务前已满足数量不得为负数')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, effectiveSatisfiedQtyBeforeTask: Number.NaN }], 0), /任务前已满足数量/, '任务前已满足数量必须是有限数')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, effectiveSatisfiedQtyBeforeTask: 601 }], 0), /任务前已满足数量/, '任务前已满足数量不得超过需求')
  assert.throws(() => allocateCombinedDyeingOutput([memberA, { ...memberB, qtyUnit: '米' }], 0), /数量单位必须一致/, '成员单位不一致必须拒绝')

  const identityFields = [
    ['dyeWorkOrderId', '染色加工单 ID'],
    ['dyeWorkOrderNo', '染色加工单号'],
    ['productionOrderId', '生产单 ID'],
    ['productionOrderNo', '生产单号'],
  ] as const
  for (const [field, label] of identityFields) {
    assert.throws(
      () => allocateCombinedDyeingOutput([{ ...memberA, [field]: '' }], 0),
      new RegExp(`${label}不能为空`),
      `${label}空字符串必须拒绝`,
    )
    assert.throws(
      () => allocateCombinedDyeingOutput([{ ...memberA, [field]: '   ' }], 0),
      new RegExp(`${label}不能为空`),
      `${label}纯空格必须拒绝`,
    )
  }

  assert.throws(() => allocateCombinedDyeingOutput([memberA, { ...memberB, dyeWorkOrderId: memberA.dyeWorkOrderId }], 0), /染色加工单/, '重复染色加工单必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([memberA, { ...memberB, dyeWorkOrderNo: memberA.dyeWorkOrderNo }], 0), /染色加工单/, '重复染色加工单号必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([memberA, { ...memberB, productionOrderId: memberA.productionOrderId }], 0), /生产单/, '重复生产单必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([memberA, { ...memberB, productionOrderNo: memberA.productionOrderNo }], 0), /生产单/, '重复生产单号必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([memberA, { ...memberB, dyeWorkOrderId: ` ${memberA.dyeWorkOrderId} ` }], 0), /染色加工单/, 'trim 后重复染色加工单 ID 必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([memberA, { ...memberB, dyeWorkOrderNo: ` ${memberA.dyeWorkOrderNo} ` }], 0), /染色加工单/, 'trim 后重复染色加工单号必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([memberA, { ...memberB, productionOrderId: ` ${memberA.productionOrderId} ` }], 0), /生产单/, 'trim 后重复生产单 ID 必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([memberA, { ...memberB, productionOrderNo: ` ${memberA.productionOrderNo} ` }], 0), /生产单/, 'trim 后重复生产单号必须拒绝')

  const canonicalIdentity = allocateCombinedDyeingOutput([{
    ...memberA,
    dyeWorkOrderId: ` ${memberA.dyeWorkOrderId} `,
    dyeWorkOrderNo: ` ${memberA.dyeWorkOrderNo} `,
    productionOrderId: ` ${memberA.productionOrderId} `,
    productionOrderNo: ` ${memberA.productionOrderNo} `,
  }], 0).allocations[0]!
  assert.deepEqual(
    [canonicalIdentity.dyeWorkOrderId, canonicalIdentity.dyeWorkOrderNo, canonicalIdentity.productionOrderId, canonicalIdentity.productionOrderNo],
    [memberA.dyeWorkOrderId, memberA.dyeWorkOrderNo, memberA.productionOrderId, memberA.productionOrderNo],
    '分配结果必须输出 trim 后的成员身份',
  )

  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, productionOrderOrderedAt: '' }], 0), /下单时间/, '空下单时间必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, productionOrderOrderedAt: 'not-a-date' }], 0), /下单时间/, '非法下单时间必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, productionOrderOrderedAt: '2026-02-30 08:00:00' }], 0), /下单时间/, '不存在的日历日期必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, productionOrderOrderedAt: '2026-07-15 24:00:00' }], 0), /下单时间/, '非法小时必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, productionOrderOrderedAt: '2026-07-15 09:00' }], 0), /下单时间/, '缺少秒的时间格式必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, productionOrderOrderedAt: '2026-07-15T09:00:00Z' }], 0), /无时区/, '显式 Z 时区必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, productionOrderOrderedAt: '2026-07-15T09:00:00+08:00' }], 0), /无时区/, '显式 offset 时区必须拒绝')

  const originalTimezone = process.env.TZ
  const allocationOrderByTimezone = (timezone: string): string[] => {
    process.env.TZ = timezone
    return allocateCombinedDyeingOutput([memberC, memberB, memberA], 0).allocations.map((item) => item.productionOrderNo)
  }
  try {
    assert.deepEqual(allocationOrderByTimezone('UTC'), ['PO-001', 'PO-002', 'PO-003'], 'UTC 环境必须保持固定排序')
    assert.deepEqual(allocationOrderByTimezone('Asia/Shanghai'), ['PO-001', 'PO-002', 'PO-003'], '上海时区环境必须保持相同排序')
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ
    else process.env.TZ = originalTimezone
  }

  const inputWithManualAllocation = Object.freeze([
    Object.freeze({ ...memberC, allocatedQty: 999 }),
    Object.freeze({ ...memberA, allocatedQty: 999 }),
    Object.freeze({ ...memberB, allocatedQty: 999 }),
  ])
  const inputSnapshot = structuredClone(inputWithManualAllocation)
  const calculated = allocateCombinedDyeingOutput(inputWithManualAllocation, 800)
  assert.deepEqual(inputWithManualAllocation, inputSnapshot, '纯函数不得修改输入数组或成员对象')
  assert.deepEqual(calculated.allocations.map((item) => item.allocatedQty), [600, 200, 0], '外部传入的人工分配值必须被忽略，结果只能由领域函数计算')

  console.log('✓ 合并染色分配领域检查通过')
}

main()
