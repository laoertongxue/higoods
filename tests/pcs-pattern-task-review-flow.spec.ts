import assert from 'node:assert/strict'

import {
  reviewPatternTaskByBuyer,
  transferPatternTaskToChinaTeam,
} from '../src/data/pcs-pattern-task-flow-service.ts'
import { resetPatternTaskRepository } from '../src/data/pcs-pattern-task-repository.ts'
import { savePatternTaskDraft } from '../src/data/pcs-task-project-relation-writeback.ts'

resetPatternTaskRepository()

const task = savePatternTaskDraft({
  projectId: '',
  title: '买手审核花型',
  sourceType: '项目模板阶段',
  demandSourceType: '预售测款通过',
  processType: '数码印',
  requestQty: 1,
  fabricName: '针织印花坯布',
  demandImageIds: ['mock://pattern-demand/b.png'],
  assignedTeamCode: 'JKT_TEAM',
  assignedMemberId: 'jkt_bandung',
})

assert.throws(
  () => reviewPatternTaskByBuyer(task.patternTaskId, '买手已驳回', '文锋', ''),
  /买手驳回必须填写说明/,
  '买手驳回必须填写说明',
)

const rejected = reviewPatternTaskByBuyer(task.patternTaskId, '买手已驳回', '文锋', '颜色不准')
assert.equal(rejected.buyerReviewStatus, '买手已驳回')
assert.equal(rejected.status, '进行中')

const transferred = transferPatternTaskToChinaTeam(task.patternTaskId, '雅加达团队无法还原颜色', 'cn_dandan')
assert.equal(transferred.transferToTeamName, '中国团队')
assert.equal(transferred.assignedMemberName, '单单')

const approved = reviewPatternTaskByBuyer(task.patternTaskId, '买手已通过', '文锋', '确认通过')
assert.equal(approved.buyerReviewStatus, '买手已通过')
assert.equal(approved.status, '已确认')

console.log('pcs-pattern-task-review-flow.spec.ts PASS')
