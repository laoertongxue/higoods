import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateQcShippingPriority,
  DEFAULT_QC_SHIPPING_PRIORITY_RULES,
  parseQcShippingDeadlineMillis,
  type PriorityDemand,
  type PriorityPostSupply,
  type PriorityStock,
} from '../../src/data/fcs/post-finishing-qc-shipping-priority.ts'

const nowMs = Date.parse('2026-10-21T09:00:00+07:00')
function demand(id: string, quantity: number, deadline = '2026-10-21 23:59:59', warehouseId = 'AC', sku = 'STYLE-black-m'): PriorityDemand {
  return { id, orderId: `ORDER-${id}`, sku, warehouseId, quantity, deadline, deadlineTimeZone: 'Asia/Jakarta' }
}
function stock(quantity: number, reservations: PriorityStock['reservations'] = [], warehouseId = 'AC', sku = 'STYLE-black-m', id = 'stock-1'): PriorityStock {
  return { id, sku, warehouseId, quantity, reservations }
}
function post(quantity: number, warehouseId = 'AC', sku = 'STYLE-black-m', id = 'post-1'): PriorityPostSupply {
  return { id, sku, warehouseId, quantity }
}
function calculate(demands: PriorityDemand[], stocks: PriorityStock[] = [], postSupplies: PriorityPostSupply[] = []) {
  return calculateQcShippingPriority({ demands, stocks, postSupplies, nowMs })
}

test('今日专属占用先覆盖原订单，公共库存和后道量依次覆盖今日明日', () => {
  const result = calculate(
    [demand('today', 60), demand('tomorrow', 50, '2026-10-22 23:59:59')],
    [stock(100, [{ id: 'reserved-today', orderLineId: 'today', quantity: 40 }, { id: 'external', quantity: 30 }])],
    [post(20)],
  )
  assert.equal(result.ready, true)
  assert.deepEqual(result.issues, [])
  assert.equal(result.rows[0]!.today, 0)
  assert.equal(result.rows[0]!.tomorrow, 20)
  assert.equal(result.rows[0]!.stars, 1)
  assert.equal(result.rows[0]!.freeStock, 30)
  assert.equal(result.rows[0]!.reservedDemandCoverage, 40)
  assert.equal(result.rows[0]!.sharedSupplyUsed, 50)
  assert.equal(result.rows[0]!.unusedSupply, 0)
  assert.equal(result.asOf, '2026-10-21T09:00:00+07:00')
})

test('相同占用总量改为保障明日订单，今日缺10明日缺10', () => {
  const result = calculate(
    [demand('today', 60), demand('tomorrow', 50, '2026-10-22 23:59:59')],
    [stock(100, [{ id: 'reserved-tomorrow', orderLineId: 'tomorrow', quantity: 40 }, { id: 'external', quantity: 30 }])],
    [post(20)],
  )
  assert.equal(result.ready, true)
  assert.equal(result.rows[0]!.today, 10)
  assert.equal(result.rows[0]!.tomorrow, 10)
  assert.equal(result.rows[0]!.stars, 2)
})

test('不同仓库与不同SKU供给不互抵，供给无需求的行也可审计', () => {
  const result = calculate([demand('today', 50)], [stock(100, [], 'FM'), stock(100, [], 'AC', 'OTHER', 'stock-other')], [post(30, 'FM')])
  assert.equal(result.ready, true)
  const row = result.rows.find(value => value.sku === 'STYLE-black-m' && value.warehouseId === 'AC')!
  assert.equal(row.today, 50)
  assert.equal(row.stars, 2)
  assert.equal(result.rows.find(value => value.warehouseId === 'FM')!.unusedSupply, 130)
})

test('先抵历史超期，再抵今日明日和远期；今日超时仅为今日子集', () => {
  const demands = [demand('overdue', 20, '2026-10-20 23:59:59'), demand('elapsed-today', 15, '2026-10-21 08:59:59'), demand('today', 35), demand('tomorrow', 40, '2026-10-22 23:59:59'), demand('future', 25, '2026-10-23 12:00:00')]
  const covered = calculate(demands, [stock(40)])
  assert.equal(covered.ready, true)
  assert.deepEqual([covered.rows[0]!.overdue, covered.rows[0]!.today, covered.rows[0]!.todayOverdue, covered.rows[0]!.tomorrow, covered.rows[0]!.future], [0, 30, 0, 40, 25])
  const insufficient = calculate(demands, [stock(10)])
  assert.deepEqual([insufficient.rows[0]!.overdue, insufficient.rows[0]!.today, insufficient.rows[0]!.todayOverdue], [10, 50, 15])
  assert.equal(insufficient.rows[0]!.label, DEFAULT_QC_SHIPPING_PRIORITY_RULES.overdueLabel)
  assert.equal(insufficient.rows[0]!.stars, 2)
})

test('五天后订单已有占用不被今日抢占，多余占用也保持锁定', () => {
  const result = calculate([demand('today', 40), demand('future', 50, '2026-10-26 23:59:59')], [stock(100, [{ id: 'future-reserve', orderLineId: 'future', quantity: 80 }])])
  assert.equal(result.ready, true)
  assert.equal(result.rows[0]!.today, 20)
  assert.equal(result.rows[0]!.future, 0)
  assert.equal(result.rows[0]!.reservedDemandCoverage, 50)
  assert.equal(result.rows[0]!.reservedStock, 80)
  assert.equal(result.rows[0]!.freeStock, 20)
})

test('同订单行跨库存的占用合计覆盖不得超过需求量', () => {
  const result = calculate([demand('today', 10), demand('other', 10)], [stock(20, [{ id: 'r1', orderLineId: 'today', quantity: 15 }]), stock(20, [{ id: 'r2', orderLineId: 'today', quantity: 15 }], 'AC', 'STYLE-black-m', 'stock-2')])
  assert.equal(result.ready, true)
  assert.equal(result.rows[0]!.reservedDemandCoverage, 10)
  assert.equal(result.rows[0]!.reservedStock, 30)
  assert.equal(result.rows[0]!.today, 0)
  assert.equal(result.rows[0]!.sharedSupplyUsed, 10)
})

test('上海源时间正确转换为雅加达自然日，不采用滚动24小时', () => {
  const result = calculate([
    { ...demand('shanghai', 10, '2026-10-22 00:30:00'), deadlineTimeZone: 'Asia/Shanghai' },
    demand('jakarta', 20, '2026-10-22 00:30:00'),
    demand('far', 30, '2026-10-23 00:00:00'),
  ])
  assert.equal(result.ready, true)
  assert.deepEqual([result.rows[0]!.today, result.rows[0]!.tomorrow, result.rows[0]!.future], [10, 20, 30])
})

test('显式ISO偏移和Z时间按绝对时刻解释，日期边界使用雅加达', () => {
  const result = calculate([
    { ...demand('offset', 10, '2026-10-22T00:30:00+08:00'), deadlineTimeZone: 'ISO' },
    { ...demand('utc', 20, '2026-10-21T17:00:00Z'), deadlineTimeZone: 'UTC' },
    demand('midnight', 30, '2026-10-21 00:00:00'),
  ])
  assert.equal(result.ready, true)
  assert.deepEqual([result.rows[0]!.today, result.rows[0]!.tomorrow, result.rows[0]!.todayOverdue], [40, 20, 30])
  const nextDay = calculateQcShippingPriority({ demands: [demand('now-tomorrow', 4, '2026-10-22 00:00:00')], stocks: [], postSupplies: [], nowMs: Date.parse('2026-10-21T17:00:00Z') })
  assert.equal(nextDay.rows[0]!.today, 4)
  assert.equal(nextDay.rows[0]!.todayOverdue, 0)
})

test('远期需求不挂星，已覆盖全部近两日需求也不挂星', () => {
  assert.equal(calculate([demand('future', 5, '2026-10-23 01:00:00')]).rows[0]!.stars, 0)
  const row = calculate([demand('today', 10), demand('tomorrow', 20, '2026-10-22 01:00:00')], [stock(35)]).rows[0]!
  assert.equal(row.stars, 0)
  assert.equal(row.unusedSupply, 5)
})

test('非法日历日期、缺失时间、模糊来源时区均使结果需核对', () => {
  for (const deadline of ['2026-02-29 10:00:00', '2026-04-31 00:00:00', '2026-10-21 24:00:00', '2026-10-21 23:60:00', '2026-10-21', '', '2026-10-21T10:00:00+25:00']) {
    const result = calculate([demand('invalid', 5, deadline)])
    assert.equal(result.ready, false, deadline)
    assert.ok(result.issues.length > 0)
  }
  assert.equal(calculate([{ ...demand('unknown-zone', 5), deadlineTimeZone: 'local' }]).ready, false)
  assert.equal(calculate([demand('leap-day', 5, '2028-02-29 10:00:00')]).ready, true)
})

test('占用超库存、错仓、错SKU、未知关联行不能被静默忽略', () => {
  const row = demand('today', 10)
  const cases = [
    stock(5, [{ id: 'r', orderLineId: 'today', quantity: 6 }]),
    stock(10, [{ id: 'r', orderLineId: 'today', quantity: 5 }], 'FM'),
    stock(10, [{ id: 'r', orderLineId: 'today', quantity: 5 }], 'AC', 'OTHER'),
    stock(10, [{ id: 'r', orderLineId: 'missing', quantity: 5 }]),
  ]
  for (const current of cases) {
    const result = calculate([row], [current])
    assert.equal(result.ready, false)
    assert.ok(result.issues.length > 0)
  }
})

test('明确外部用途占用可以无关联订单行，仍从公共供给扣除', () => {
  const row = calculate([demand('today', 10)], [stock(10, [{ id: 'outside', quantity: 8 }])]).rows[0]!
  assert.equal(row.today, 8)
  assert.equal(row.freeStock, 2)
})

test('重复需求、库存、后道供给或占用ID报错且不重复计量', () => {
  const cases = [
    calculate([demand('dup', 10), demand('dup', 10)]),
    calculate([demand('today', 30)], [stock(10), stock(10)]),
    calculate([demand('today', 30)], [], [post(10), post(10)]),
    calculate([demand('today', 30)], [stock(10, [{ id: 'r', quantity: 5 }, { id: 'r', quantity: 5 }])]),
    calculate([demand('today', 30)], [stock(10, [], 'AC', 'STYLE-black-m', 'same-source')], [post(10, 'AC', 'STYLE-black-m', 'same-source')]),
  ]
  for (const result of cases) {
    assert.equal(result.ready, false)
    assert.ok(result.issues.some(value => value.includes('重复')))
  }
  assert.equal(cases[0]!.rows[0]!.demandQuantity, 10)
  assert.equal(cases[1]!.rows[0]!.today, 20)
  assert.equal(cases[2]!.rows[0]!.today, 20)
})

test('数量必须是非负安全整数，不能用小数、负数、NaN或Infinity抵扣', () => {
  for (const quantity of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(calculate([demand('d', quantity)]).ready, false)
    assert.equal(calculate([demand('d', 10)], [stock(quantity)]).ready, false)
    assert.equal(calculate([demand('d', 10)], [], [post(quantity)]).ready, false)
    assert.equal(calculate([demand('d', 10)], [stock(10, [{ id: 'r', quantity }])]).ready, false)
  }
  assert.equal(calculate([demand('zero', 0)], [stock(0)], [post(0)]).ready, true)
})

test('同截止时刻按订单行ID稳定分配，不依赖输入排列且不改变输入', () => {
  const demands = [demand('b', 10), demand('a', 10)]
  const stocks = [stock(5)]
  const before = structuredClone({ demands, stocks })
  const first = calculate(demands, stocks)
  const second = calculate([...demands].reverse(), [...stocks].reverse())
  assert.deepEqual(first, second)
  assert.deepEqual({ demands, stocks }, before)
  assert.equal(first.rows[0]!.demandRows.find(value => value.id === 'a')!.remainingQuantity, 5)
  assert.equal(first.rows[0]!.demandRows.find(value => value.id === 'b')!.remainingQuantity, 10)
})

test('合法维护星级生效，今日必须高于明日且限1至5星', () => {
  const rules = { ...DEFAULT_QC_SHIPPING_PRIORITY_RULES, todayStars: 5, tomorrowStars: 3, version: 2, todayLabel: '今日优先', tomorrowLabel: '明日准备' }
  const result = calculateQcShippingPriority({ demands: [demand('today', 2)], stocks: [], postSupplies: [], rules, nowMs })
  assert.equal(result.ready, true)
  assert.equal(result.rows[0]!.stars, 5)
  assert.equal(result.rows[0]!.label, '今日优先')
  assert.equal(result.ruleVersion, 2)
  for (const bad of [{ ...rules, todayStars: 3 }, { ...rules, tomorrowStars: 0 }, { ...rules, todayStars: 6 }, { ...rules, todayLabel: '' }, { ...rules, version: 0 }]) {
    assert.equal(calculateQcShippingPriority({ demands: [], stocks: [], postSupplies: [], rules: bad, nowMs }).ready, false)
  }
})

test('上游来源问题和无效统计时点显式返回需核对', () => {
  const upstream = calculateQcShippingPriority({ demands: [demand('today', 5)], stocks: [], postSupplies: [], nowMs, issues: ['供货去向未确认'] })
  assert.equal(upstream.ready, false)
  assert.ok(upstream.issues.includes('供货去向未确认'))
  const invalidClock = calculateQcShippingPriority({ demands: [], stocks: [], postSupplies: [], nowMs: Number.NaN })
  assert.equal(invalidClock.ready, false)
  assert.equal(invalidClock.asOf, '')
})

test('空身份字段及显式空关联不是外部用途，须核对', () => {
  for (const patch of [{ id: '' }, { orderId: '' }, { sku: '' }, { warehouseId: '' }]) {
    assert.equal(calculate([{ ...demand('today', 10), ...patch }]).ready, false)
  }
  assert.equal(calculate([demand('today', 10)], [stock(10, [{ id: 'r', orderLineId: '', quantity: 3 }])]).ready, false)
})

test('同量供给由后道转入现货不增加保障量，实际短少会留下缺口', () => {
  const demands = [demand('today', 100), demand('tomorrow', 80, '2026-10-22 10:00:00')]
  const before = calculate(demands, [stock(60)], [post(40)]).rows[0]!
  const received = calculate(demands, [stock(100)]).rows[0]!
  assert.deepEqual([before.today, before.tomorrow], [received.today, received.tomorrow])
  assert.deepEqual([before.today, before.tomorrow], [0, 80])
  const short = calculate(demands, [stock(98)]).rows[0]!
  assert.deepEqual([short.today, short.tomorrow], [2, 80])
  for (const row of [before, received, short]) {
    assert.equal(row.demandQuantity, row.reservedDemandCoverage + row.sharedSupplyUsed + row.overdue + row.today + row.tomorrow + row.future)
    assert.equal(row.freeStock + row.postSupply, row.sharedSupplyUsed + row.unusedSupply)
  }
})

test('公共截止时间解析器拒绝日期滚动，并与计算使用同一来源时区口径', () => {
  assert.equal(parseQcShippingDeadlineMillis('2026-10-22 00:30:00', 'Asia/Shanghai'), Date.parse('2026-10-21T23:30:00+07:00'))
  assert.equal(parseQcShippingDeadlineMillis('2026-10-21T17:00:00Z', 'ISO'), Date.parse('2026-10-22T00:00:00+07:00'))
  assert.equal(parseQcShippingDeadlineMillis('2026-02-29 10:00:00', 'Asia/Jakarta'), undefined)
})
