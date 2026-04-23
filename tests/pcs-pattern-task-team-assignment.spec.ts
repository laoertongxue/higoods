import assert from 'node:assert/strict'

import {
  assertPatternTaskMemberInTeam,
  listPatternTaskMembersByTeam,
  PATTERN_TASK_TEAMS,
} from '../src/data/pcs-pattern-task-team-config.ts'

assert.deepEqual(
  PATTERN_TASK_TEAMS.map((item) => item.teamName),
  ['中国团队', '万隆团队', '雅加达团队'],
  '花型任务团队必须固定为三组',
)

assert.deepEqual(
  listPatternTaskMembersByTeam('CN_TEAM').map((item) => item.memberName),
  ['bing bing', '单单', '关浩'],
  '中国团队成员必须固定',
)

assert.deepEqual(
  listPatternTaskMembersByTeam('BDG_TEAM').map((item) => item.memberName),
  ['ramzi adli', 'micin', 'Irfan', 'Usman', 'zaenal Abidin'],
  '万隆团队成员必须固定',
)

assert.deepEqual(
  listPatternTaskMembersByTeam('JKT_TEAM').map((item) => item.memberName),
  ['Bandung'],
  '雅加达团队成员必须固定',
)

assert.doesNotThrow(() => assertPatternTaskMemberInTeam('CN_TEAM', 'cn_bing_bing'))
assert.throws(
  () => assertPatternTaskMemberInTeam('CN_TEAM', 'bdg_micin'),
  /花型师必须来自所选团队/,
  '成员必须受团队约束',
)

console.log('pcs-pattern-task-team-assignment.spec.ts PASS')
