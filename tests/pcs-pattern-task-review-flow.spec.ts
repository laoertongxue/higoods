import assert from 'node:assert/strict'

import {
  reviewPatternTaskByBuyer,
  transferPatternTaskToChinaTeam,
} from '../src/data/pcs-pattern-task-flow-service.ts'
import { resetPatternTaskRepository, updatePatternTask } from '../src/data/pcs-pattern-task-repository.ts'
import { savePatternTaskDraft, submitPatternTaskForBuyerReview } from '../src/data/pcs-task-project-relation-writeback.ts'

resetPatternTaskRepository()

const task = savePatternTaskDraft({
  projectId: '',
  title: '买手审核花型',
  sourceType: '项目模板阶段',
  demandSourceType: '预售测款通过',
  processType: '数码印',
  requestQty: 1,
  fabricName: '毛织印花坯布',
  demandImageIds: ['mock://pattern-demand/b.png'],
  assignedTeamCode: 'JKT_TEAM',
  assignedMemberId: 'jkt_bandung',
})

assert.throws(
  () => reviewPatternTaskByBuyer(task.patternTaskId, '买手已驳回', '文锋', ''),
  /买手驳回必须填写说明/,
  '买手驳回必须填写说明',
)

assert.throws(
  () => reviewPatternTaskByBuyer(task.patternTaskId, '买手已通过', '文锋', '确认通过'),
  /请先由花型师提交买手确认/,
  '买手确认必须发生在花型师提交之后',
)

const missingSubmit = submitPatternTaskForBuyerReview(task.patternTaskId, 'bing bing')
assert.equal(missingSubmit.ok, false)
assert.match(missingSubmit.message, /花型版次|完成确认图片|花型文件/, '缺少执行产出时不得提交买手确认')

const transferred = transferPatternTaskToChinaTeam(task.patternTaskId, '雅加达团队无法还原颜色', 'cn_dandan')
assert.equal(transferred.transferToTeamName, '中国团队')
assert.equal(transferred.assignedMemberName, '单单')

updatePatternTask(task.patternTaskId, {
  artworkVersion: 'A1',
  completionImageIds: ['mock://pattern-complete/b.png'],
})

const missingFileSubmit = submitPatternTaskForBuyerReview(task.patternTaskId, '单单')
assert.equal(missingFileSubmit.ok, false)
assert.match(missingFileSubmit.message, /花型文件/, '花型师提交买手确认前必须上传花型文件')

updatePatternTask(task.patternTaskId, {
  patternFileIds: ['mock-file://pattern-artwork/b.ai'],
})

const submitted = submitPatternTaskForBuyerReview(task.patternTaskId, '单单')
assert.equal(submitted.ok, true)
assert.equal(submitted.task?.status, '待确认')
assert.equal(submitted.task?.buyerReviewStatus, '待买手确认')

const rejected = reviewPatternTaskByBuyer(task.patternTaskId, '买手已驳回', '文锋', '颜色不准')
assert.equal(rejected.buyerReviewStatus, '买手已驳回')
assert.equal(rejected.status, '进行中')

const resubmitted = submitPatternTaskForBuyerReview(task.patternTaskId, '单单')
assert.equal(resubmitted.ok, true)
assert.equal(resubmitted.task?.status, '待确认')

const approved = reviewPatternTaskByBuyer(task.patternTaskId, '买手已通过', '文锋', '确认通过')
assert.equal(approved.buyerReviewStatus, '买手已通过')
assert.equal(approved.status, '已确认')

console.log('pcs-pattern-task-review-flow.spec.ts PASS')
