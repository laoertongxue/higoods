import assert from 'node:assert/strict'
import test from 'node:test'
import { confirmPpicDay } from '../../src/data/fcs/ppic-daily-return.ts'
import { capturePpicDailyStore, restorePpicDailyStoreForTests, getPpicDailyActorById, getPpicDailyReturnView, getPpicDailyStatisticsView } from '../../src/data/fcs/ppic-daily-return-records.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC } from '../../src/data/fcs/factory-onboarding-ppic.ts'

const now = '2026-10-14T05:00:00Z'

test('统计视图给出应填报任务、每 PPIC 和每日趋势；确认后计入已填报', () => {
  const saved = capturePpicDailyStore(), beforeActor = { ...SEWING_OUTSOURCING_DEMO_CURRENT_PPIC }
  try {
    const view = getPpicDailyStatisticsView({ nowAt: now, days: 7 })
    assert.ok(view.rows.length > 0)
    assert.equal(view.stats.requiredTasks, view.rows.reduce((total, row) => total + row.requiredTasks, 0))
    assert.equal(view.stats.requiredPpics, view.rows.length)
    assert.equal(view.daily.length, 7)
    assert.equal(view.daily.at(-1)!.date, view.date)
    assert.equal(view.daily.at(-1)!.requiredTasks, view.stats.requiredTasks)
    assert.equal(view.daily.at(-1)!.requiredPpics, view.stats.requiredPpics)
    const first = view.rows[0], actor = getPpicDailyActorById(first.ownerId)
    assert.ok(actor)
    const personal = getPpicDailyReturnView({ actorId: first.ownerId, nowAt: now })
    const filledBefore = view.stats.filledPpics
    const store = capturePpicDailyStore()
    confirmPpicDay(store, {
      operationId: 'STATS-CONFIRM', actor, date: view.date, tasks: personal.tasks.map(task => task.task),
      noArrangementReasons: Object.fromEntries(personal.tasks.map(task => [task.task.assignmentId, '统计用例无安排'])), nowAt: now,
    })
    restorePpicDailyStoreForTests(store)
    const after = getPpicDailyStatisticsView({ nowAt: now, days: 7 })
    assert.equal(after.stats.filledPpics, filledBefore + 1)
    assert.equal(after.stats.unfilledPpics, after.stats.requiredPpics - after.stats.filledPpics)
    assert.ok(after.stats.coveredTasks >= first.requiredTasks)
    const row = after.rows.find(item => item.ownerId === first.ownerId)!
    assert.equal(row.submissionStatus, '已提交')
    assert.equal(row.coveredTasks, row.requiredTasks)
    assert.equal(after.daily.at(-1)!.filledPpics, filledBefore + 1)
    assert.equal(after.daily.at(-1)!.coveredTasks, row.coveredTasks)
  } finally {
    restorePpicDailyStoreForTests(saved)
    Object.assign(SEWING_OUTSOURCING_DEMO_CURRENT_PPIC, beforeActor)
  }
})
