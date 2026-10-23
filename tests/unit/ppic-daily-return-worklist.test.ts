import assert from 'node:assert/strict'
import test from 'node:test'
import { getPpicDailyWorklistView, getPpicDailyReturnView, PPIC_DAILY_DEMO_MEMBERS } from '../../src/data/fcs/ppic-daily-return-records.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC, getOnboardingPpicOptionById } from '../../src/data/fcs/factory-onboarding-ppic.ts'

const now = '2026-10-14T05:00:00Z'
function setTestPpicLogin(id: string): void {
  const user = getOnboardingPpicOptionById(id)
  if (!user) throw new Error('测试账号不存在')
  Object.assign(SEWING_OUTSOURCING_DEMO_CURRENT_PPIC, user)
}

test('全量回货任务列表不受当前登录或组长身份收窄，PPIC 筛选按任务当前负责人生效', () => {
  const before = { ...SEWING_OUTSOURCING_DEMO_CURRENT_PPIC }
  try {
    const member = PPIC_DAILY_DEMO_MEMBERS.find(p => !p.leader && !p.id.startsWith('PPIC-DAILY-MOCK'))!
    const leader = PPIC_DAILY_DEMO_MEMBERS.find(p => p.leader)!
    setTestPpicLogin(member.id)
    const asMember = getPpicDailyWorklistView({ nowAt: now })
    setTestPpicLogin(leader.id)
    const asLeader = getPpicDailyWorklistView({ nowAt: now })
    assert.ok(asMember.rows.length > 0)
    assert.deepEqual(asLeader.rows.map(row => row.task.assignmentId), asMember.rows.map(row => row.task.assignmentId))
    const otherOwner = asMember.ppicOptions.find(option => option.id !== member.id)
    if (otherOwner) assert.ok(asMember.rows.some(row => row.task.ownerId === otherOwner.id), '全量列表必须包含其他 PPIC 跟进的任务')
    const ownerId = asMember.rows[0].task.ownerId
    const filtered = getPpicDailyWorklistView({ ppicId: ownerId, nowAt: now })
    assert.ok(filtered.rows.length > 0)
    assert.ok(filtered.rows.every(row => row.task.ownerId === ownerId))
    assert.equal(asMember.stats.tasks, asMember.rows.length)
    assert.equal(asMember.stats.ppics, new Set(asMember.rows.map(row => row.task.ownerId)).size)
    assert.ok(asMember.ppicOptions.some(option => option.id === ownerId))
  } finally { Object.assign(SEWING_OUTSOURCING_DEMO_CURRENT_PPIC, before) }
})

test('每日填报视图可按指定 PPIC 读取，不受当前登录限制', () => {
  const before = { ...SEWING_OUTSOURCING_DEMO_CURRENT_PPIC }
  try {
    const member = PPIC_DAILY_DEMO_MEMBERS.find(p => !p.leader && !p.id.startsWith('PPIC-DAILY-MOCK'))!
    const leader = PPIC_DAILY_DEMO_MEMBERS.find(p => p.leader)!
    setTestPpicLogin(leader.id)
    const memberView = getPpicDailyReturnView({ actorId: member.id, nowAt: now })
    assert.equal(memberView.actor.id, member.id)
    assert.ok(memberView.tasks.every(task => task.task.ownerId === member.id))
    const leaderView = getPpicDailyReturnView({ actorId: leader.id, nowAt: now })
    assert.equal(leaderView.actor.id, leader.id)
    assert.ok(leaderView.tasks.every(task => task.task.ownerId === leader.id))
  } finally { Object.assign(SEWING_OUTSOURCING_DEMO_CURRENT_PPIC, before) }
})
