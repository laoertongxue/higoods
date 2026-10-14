import assert from 'node:assert/strict'
import test from 'node:test'
import { createPpicDailyStore, addPpicPromise, arrangePpicMakeup, syncPpicReceipts, confirmPpicDay } from '../../src/data/fcs/ppic-daily-return.ts'
import { capturePpicDailyStore, restorePpicDailyStoreForTests, getPpicDailyReturnView, getPpicDailySupervisorView, getCurrentPpicDailyActor, PPIC_DAILY_DEMO_MEMBERS, getPpicTaskPromiseHistory } from '../../src/data/fcs/ppic-daily-return-records.ts'
import { createEffectiveTaskAssignment, captureEffectiveTaskAssignmentState, restoreEffectiveTaskAssignmentState } from '../../src/data/fcs/effective-task-assignments.ts'
import { transferSewingTaskResponsibility, captureSewingResponsibilityState, restoreSewingResponsibilityState } from '../../src/data/fcs/sewing-outsourcing-responsibility.ts'
import { resolveInitialOrderRuntimeTaskIdentity } from '../../src/data/fcs/process-tasks.ts'
import { getFactoryActivePpicSnapshot, getFactoryMasterRecordById } from '../../src/data/fcs/factory-master-store.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC, getOnboardingPpicOptionById } from '../../src/data/fcs/factory-onboarding-ppic.ts'

// 隔离契约仅替换现有登录上下文，不提供产品身份切换API。
function setTestPpicLogin(id: string): void {
  const user = getOnboardingPpicOptionById(id)
  if (!user) throw new Error('测试账号不存在')
  Object.assign(SEWING_OUTSOURCING_DEMO_CURRENT_PPIC, user)
}
const yesterday = '2026-10-13T02:00:00Z', today = '2026-10-14T05:00:00Z'
test('R75: actor follows the existing current PPIC context without a page-local identity', () => {
  const before = { ...SEWING_OUTSOURCING_DEMO_CURRENT_PPIC }
  try {
    Object.assign(SEWING_OUTSOURCING_DEMO_CURRENT_PPIC, { ppicId: 'PPIC-LEADER-LINGYUN', ppicName: '凌云', role: 'TEAM_LEADER' })
    assert.deepEqual(getCurrentPpicDailyActor(), { id: 'PPIC-LEADER-LINGYUN', name: '凌云', leader: true })
  } finally { Object.assign(SEWING_OUTSOURCING_DEMO_CURRENT_PPIC, before) }
})
function normalTask() {
  for (const actor of PPIC_DAILY_DEMO_MEMBERS.filter(p => !p.leader)) {
    setTestPpicLogin(actor.id)
    const view = getPpicDailyReturnView({ nowAt: today }).tasks.find(t => t.basis.expectedQty !== null)
    if (view) return { actor, view: { ...view, task: { ...view.task, expectedQty: 2000, status: 'READY', basisVersion: 'REVIEW-SUMMARY-FIXTURE' } } }
  }
  throw new Error('需要已有第三方任务和正式应回依据的正常夹具')
}

test('R39/R60: different-size original promises use quantity-weighted rate and team reads reject a member', () => {
  const saved = capturePpicDailyStore(), beforeActor = getCurrentPpicDailyActor()
  try {
    const { actor, view } = normalTask(), s = createPpicDailyStore()
    const make = (id: string, quantity: number) => addPpicPromise(s, { operationId: id, actor, task: view.task, quantity, deadlineAt: '2026-10-14T10:00', nowAt: id === 'small' ? '2026-10-14T01:00:00Z' : '2026-10-14T01:01:00Z', date: '2026-10-14' })
    const small = make('small', 100), large = make('large', 900)
    syncPpicReceipts(s, [{ id: 'weighted-r', deliveryId: 'weighted-d', assignmentId: view.task.assignmentId, factoryId: view.task.factoryId, quantity: 550, confirmedAt: '2026-10-14T02:00:00Z', recordedAt: '2026-10-14T02:01:00Z' }])
    arrangePpicMakeup(s, { operationId: 'weighted-m', actor, task: view.task, promiseId: large.promiseId, quantity: 450, deadlineAt: '2026-10-15T10:00', nowAt: today, reason: '运输延迟', detail: '' })
    restorePpicDailyStoreForTests(s)
    assert.throws(() => getPpicDailySupervisorView({ nowAt: today }), /组长/)
    setTestPpicLogin(PPIC_DAILY_DEMO_MEMBERS.find(p => p.leader)!.id)
    const summary = getPpicDailySupervisorView({ nowAt: today })
    assert.equal(summary.rows.length, 2)
    assert.equal(summary.stats.originalQty, 1000)
    assert.equal(summary.stats.timelyQty, 550)
    assert.equal(summary.stats.timelyRate, 0.55)
    assert.equal(summary.stats.todayMakeupPlans, 1)
    assert.equal(summary.rows.find(r => r.promise.promiseId === small.promiseId)!.result.timelyQty, 100)
    assert.equal(summary.rows.find(r => r.promise.promiseId === large.promiseId)!.result.timelyQty, 450)
  } finally { restorePpicDailyStoreForTests(saved); setTestPpicLogin(beforeActor.id) }
})

test('R41: reason/status/promise-number filters keep today makeup statistics within matching records', () => {
  const saved = capturePpicDailyStore(), beforeActor = getCurrentPpicDailyActor()
  try {
    const { actor, view } = normalTask(), s = createPpicDailyStore()
    const make = (id: string, reason: string) => {
      const p = addPpicPromise(s, { operationId: id, actor, task: view.task, quantity: 100, deadlineAt: '2026-10-13T17:00', nowAt: yesterday, date: '2026-10-13' })
      const m = arrangePpicMakeup(s, { operationId: 'm-' + id, actor, task: view.task, promiseId: p.promiseId, quantity: 100, deadlineAt: '2026-10-14T17:00', reason, detail: '', nowAt: '2026-10-14T01:00:00Z' })
      return { p, m }
    }
    const a = make('transport', '运输延迟'), b = make('factory', '工厂生产延迟')
    syncPpicReceipts(s, [a, b].map(({p}, i) => ({ id: 'r' + i, deliveryId: 'd' + i, assignmentId: view.task.assignmentId, factoryId: view.task.factoryId, quantity: 100, confirmedAt: '2026-10-14T02:00:00Z', recordedAt: '2026-10-14T03:00:00Z' })))
    restorePpicDailyStoreForTests(s)
    setTestPpicLogin(PPIC_DAILY_DEMO_MEMBERS.find(p => p.leader)!.id)
    const all = getPpicDailySupervisorView({ nowAt: today })
    assert.equal(all.stats.actualMakeupReceivedQty, 200)
    for (const query of [{ reason: '运输延迟' }, { keyword: a.p.promiseNo }, { reason: '运输延迟', status: '已补齐' }]) {
      const filtered = getPpicDailySupervisorView({ ...query, nowAt: today })
      assert.equal(filtered.todayMakeups.length, 1)
      assert.equal(filtered.stats.actualMakeupReceivedQty, 100)
      assert.equal(filtered.stats.actualReceivedQty, 100)
      assert.equal(filtered.stats.originalQty, 0)
    }
  } finally { restorePpicDailyStoreForTests(saved); setTestPpicLogin(beforeActor.id) }
})

test('R22/R43: retired promise remains readable but cannot make current day confirmation incomplete', () => {
  const saved = capturePpicDailyStore(), beforeActor = getCurrentPpicDailyActor()
  try {
    const { actor, view } = normalTask(), s = createPpicDailyStore()
    addPpicPromise(s, { operationId: 'retired', actor, task: { ...view.task, assignmentId: 'REVIEW-RETIRED' }, quantity: 100, deadlineAt: '2026-10-13T17:00', nowAt: yesterday, date: '2026-10-13' })
    restorePpicDailyStoreForTests(s)
    const current = getPpicDailyReturnView({ nowAt: today })
    confirmPpicDay(s, { operationId: 'today', actor, date: '2026-10-14', tasks: current.tasks.map(t => t.task), noArrangementReasons: Object.fromEntries(current.tasks.map(t => [t.task.assignmentId, '今日无安排'])), nowAt: today })
    restorePpicDailyStoreForTests(s)
    const personal = getPpicDailyReturnView({ nowAt: today })
    assert.equal(personal.needsReconfirmation, false)
    assert.equal(personal.history.length, 1)
    setTestPpicLogin(PPIC_DAILY_DEMO_MEMBERS.find(p => p.leader)!.id)
    const person = getPpicDailySupervisorView({ nowAt: today }).people.find(p => p.id === actor.id)!
    assert.equal(person.needsReconfirmation, false)
    assert.equal(person.status, '已提交')
  } finally { restorePpicDailyStoreForTests(saved); setTestPpicLogin(beforeActor.id) }
})

test('R43/R60: actual before/after-deadline transfers preserve due owner and limit history and continuation', async () => {
  // 数量公式另有来源契约；这里用正式运行任务与真实移交命令隔离验证责任和读取范围。
  const beforeStore = capturePpicDailyStore(), beforeActor = getCurrentPpicDailyActor()
  const beforeAssignments = captureEffectiveTaskAssignmentState(), beforeResponsibility = captureSewingResponsibilityState()
  try {
    const identity = resolveInitialOrderRuntimeTaskIdentity('PO-202603-0015', 'SEW')!
    const factoryId = 'ID-F021', snapshot = getFactoryActivePpicSnapshot(factoryId)!
    const a = PPIC_DAILY_DEMO_MEMBERS.find(m => m.id === snapshot.ppicId)!
    const [b, c, unrelated] = PPIC_DAILY_DEMO_MEMBERS.filter(m => !m.leader && !m.id.startsWith('PPIC-DAILY-MOCK') && m.id !== a.id)
    const leader = PPIC_DAILY_DEMO_MEMBERS.find(m => m.leader)!
    const assignment = createEffectiveTaskAssignment({ assignmentId: 'QA-PPIC-TRANSFER-ASSIGNMENT', runtimeTaskId: identity.runtimeTaskId, taskNo: identity.taskNo,
      productionOrderId: 'PO-202603-0015', productionOrderNo: 'PO-202603-0015', factoryId, factoryName: getFactoryMasterRecordById(factoryId)!.name,
      source: 'DIRECT_DISPATCH', assignedQty: 100, skuLines: [{ skuCode: 'QA-PPIC-TRANSFER-SKU', color: 'Black', size: 'M', qty: 100 }],
      processCodes: ['SEW'], frozenPrice: 1500, priceCurrency: 'IDR', priceUnit: '件', businessAssignedAt: '2026-10-14 08:00:00', operatedAt: '2026-10-14 08:00:00',
      operatedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName, allocationOperatorPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId, allocationOperatorPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName })
    const s = createPpicDailyStore(), task = { assignmentId: assignment.assignmentId, taskId: identity.runtimeTaskId, factoryId, ownerId: a.id,
      expectedQty: 100, basisVersion: 'QA-OWNERSHIP-ONLY', sourceKind: 'HANDOVER', sourceRefs: [], status: 'READY' }
    const root = addPpicPromise(s, { operationId: 'QA-TRANSFER-ROOT', actor: a, task, quantity: 100, date: '2026-10-14', nowAt: '2026-10-14T09:00:00+07:00', deadlineAt: '2026-10-14T12:00:00+07:00' })
    restorePpicDailyStoreForTests(s)
    const transfer = (id: string, target: string, at: string) => transferSewingTaskResponsibility({ commandId: id, runtimeTaskId: identity.runtimeTaskId,
      targetPpicId: target, reason: '本地契约核验责任时点', remainingItems: ['接续100件回货欠回'], operatedAt: at, operatedByPpicId: leader.id })
    transfer('QA-TRANSFER-B', b.id, '2026-10-14 11:00:00')
    transfer('QA-TRANSFER-C', c.id, '2026-10-14 13:00:00')
    setTestPpicLogin(leader.id)
    const row = getPpicDailySupervisorView({ nowAt: '2026-10-14T14:00:00+07:00' }).rows.find(r => r.promise.promiseId === root.promiseId)!
    assert.equal(row.ownerId, c.id); assert.equal(row.dueOwnerId, b.id); assert.equal(row.promise.actorId, a.id)
    setTestPpicLogin(unrelated.id)
    const unscoped = getPpicDailyReturnView({ nowAt: '2026-10-14T14:00:00+07:00' })
    assert(!unscoped.tasks.some(t => t.task.assignmentId === assignment.assignmentId))
    assert(!unscoped.history.some(t => t.assignmentId === assignment.assignmentId))
    assert.throws(() => getPpicTaskPromiseHistory(assignment.assignmentId), /本人当前负责/)
    setTestPpicLogin(a.id)
    const old = getPpicDailyReturnView({ nowAt: '2026-10-14T14:00:00+07:00' })
    assert.equal(old.history.find(t => t.assignmentId === assignment.assignmentId)!.promises[0].actorId, a.id)
    const makeup = { operationId: 'QA-TRANSFER-M', assignmentId: assignment.assignmentId, promiseId: root.promiseId, quantity: 100,
      deadlineAt: '2026-10-15T10:00:00+07:00', reason: '运输延迟', detail: '', nowAt: '2026-10-14T14:00:00+07:00' }
    setTestPpicLogin(c.id)
    const context = getPpicDailyReturnView({ nowAt: makeup.nowAt }).tasks.find(t => t.task.assignmentId === assignment.assignmentId)!.task
    assert.throws(() => arrangePpicMakeup(s, { ...makeup, actor: a, task: context }), /本人当前负责/)
    assert.throws(() => arrangePpicMakeup(s, { ...makeup, actor: b, task: context }), /本人当前负责/)
    const continued = arrangePpicMakeup(s, { ...makeup, actor: c, task: context })
    restorePpicDailyStoreForTests(s)
    assert.equal(continued.actorId, c.id)
    assert.equal(getPpicTaskPromiseHistory(assignment.assignmentId).promises[0].actorId, a.id)
  } finally {
    restorePpicDailyStoreForTests(beforeStore); restoreEffectiveTaskAssignmentState(beforeAssignments)
    restoreSewingResponsibilityState(beforeResponsibility); setTestPpicLogin(beforeActor.id)
  }
})

test('R75: inactive or missing current account is rejected; role is read from the directory', () => {
  const before = { ...SEWING_OUTSOURCING_DEMO_CURRENT_PPIC }
  try {
    Object.assign(SEWING_OUTSOURCING_DEMO_CURRENT_PPIC, { ppicId: 'PPIC-STOP-003' })
    assert.throws(() => getCurrentPpicDailyActor(), /未启用/)
    Object.assign(SEWING_OUTSOURCING_DEMO_CURRENT_PPIC, { ppicId: 'UNKNOWN-CURRENT-USER' })
    assert.throws(() => getCurrentPpicDailyActor(), /未启用/)
    Object.assign(SEWING_OUTSOURCING_DEMO_CURRENT_PPIC, before, { role: 'TEAM_LEADER' })
    assert.equal(getCurrentPpicDailyActor().leader, false)
  } finally { Object.assign(SEWING_OUTSOURCING_DEMO_CURRENT_PPIC, before) }
})
