import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateNaturalDayDeadline } from '../../src/data/fcs/production-return-fulfillment.ts'
import { createSewingDeliverySlaSnapshot } from '../../src/data/fcs/sewing-delivery-sla.ts'
import { calculateSewingReturnDeadlineDate, SEWING_RETURN_RULE_VERSION } from '../../src/data/fcs/sewing-return-calendar.ts'

test('CONTRACT-002: business allocation day is day 1 and every calendar day counts, including Sunday', () => {
  const starts = ['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02']
  const expected = ['2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05']
  starts.forEach((start, i) => assert.equal(calculateNaturalDayDeadline(start, 4), expected[i]))
  assert.equal(calculateNaturalDayDeadline('2026-08-02 23:59:59', 1), '2026-08-02')
  assert.equal(calculateNaturalDayDeadline('2026-08-02', 7), '2026-08-08')
  assert.equal(calculateNaturalDayDeadline('2026-12-31', 4), '2027-01-03')
  assert.equal(calculateNaturalDayDeadline('2028-02-27', 4), '2028-03-01')
  assert.equal(SEWING_RETURN_RULE_VERSION, 'PPIC-20261008-NATURAL-DAYS')
})

test('CONTRACT-002: the three contracts retain 4/8/9, 5/9/10 and 6/9/12 calendar-day milestones', () => {
  const rules = { INDEPENDENT_SEWING: [4, 8, 9], SEWING_TO_IRON_PACK: [5, 9, 10], CUTTING_TO_IRON_PACK: [6, 9, 12] } as const
  const expectedDates = {
    INDEPENDENT_SEWING: ['2026-08-04', '2026-08-08', '2026-08-09'],
    SEWING_TO_IRON_PACK: ['2026-08-05', '2026-08-09', '2026-08-10'],
    CUTTING_TO_IRON_PACK: ['2026-08-06', '2026-08-09', '2026-08-12'],
  } as const
  for (const slaKind of Object.keys(rules) as Array<keyof typeof rules>) {
    const snapshot = createSewingDeliverySlaSnapshot({ assignmentId: 'calendar-test', runtimeTaskId: 'calendar-test', productionOrderId: 'calendar-test', factoryId: 'calendar-test', factoryName: '测试工厂', assignedQty: 101, acceptedAt: '2026-08-01 15:30:00', businessAssignedAt: '2026-08-01 15:30:00', slaKind })
    assert.equal(snapshot.ruleVersion, SEWING_RETURN_RULE_VERSION)
    snapshot.milestones.forEach((milestone, i) => {
      assert.equal(milestone.deadlineAt, `${expectedDates[slaKind][i]} 23:59:59`)
      assert.equal(milestone.deadlineAt, `${calculateNaturalDayDeadline('2026-08-01', rules[slaKind][i])} 23:59:59`)
      assert.equal(milestone.targetQty, [31, 71, 101][i])
    })
  }
})

test('CONTRACT-002: invalid calendar dates and counting days still fail without creating deadlines', () => {
  for (const start of ['2026-02-29', '2026-04-31', '2026-13-01', '']) {
    assert.throws(() => calculateSewingReturnDeadlineDate(start, 4), /有效日期/)
  }
  for (const day of [0, -1, 1.5, Number.NaN]) {
    assert.throws(() => calculateSewingReturnDeadlineDate('2026-08-01', day), /计时日/)
  }
})
