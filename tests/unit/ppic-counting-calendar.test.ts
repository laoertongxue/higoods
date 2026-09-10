import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateNaturalDayDeadline } from '../../src/data/fcs/production-return-fulfillment.ts'
import { createSewingDeliverySlaSnapshot } from '../../src/data/fcs/sewing-delivery-sla.ts'

test('RETURN-010: only the acceptance week Sunday is skipped, for every starting weekday', () => {
  const starts = ['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02']
  const expected = ['2026-07-30', '2026-07-31', '2026-08-01', '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06']
  starts.forEach((start, i) => assert.equal(calculateNaturalDayDeadline(start, 4), expected[i]))
  assert.equal(calculateNaturalDayDeadline('2026-08-02', 7), '2026-08-09')
  assert.equal(calculateNaturalDayDeadline('2026-12-31', 4), '2027-01-04')
})

test('RETURN-004—010: both projections share counting dates and ceil targets', () => {
  const rules = { INDEPENDENT_SEWING: [4, 8, 9], SEWING_TO_IRON_PACK: [5, 9, 10], CUTTING_TO_IRON_PACK: [6, 9, 12] } as const
  for (const slaKind of Object.keys(rules) as Array<keyof typeof rules>) {
    const snapshot = createSewingDeliverySlaSnapshot({ assignmentId: 'calendar-test', runtimeTaskId: 'calendar-test', productionOrderId: 'calendar-test', factoryId: 'calendar-test', factoryName: '测试工厂', assignedQty: 101, acceptedAt: '2026-08-01 15:30:00', slaKind })
    snapshot.milestones.forEach((milestone, i) => {
      assert.equal(milestone.deadlineAt, `${calculateNaturalDayDeadline('2026-08-01', rules[slaKind][i])} 23:59:59`)
      assert.equal(milestone.targetQty, [31, 71, 101][i])
    })
  }
})
