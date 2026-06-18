import assert from 'node:assert/strict'

import { listPatternTasks, resetPatternTaskRepository } from '../src/data/pcs-pattern-task-repository.ts'
import { listPlateMakingTasks, resetPlateMakingTaskRepository } from '../src/data/pcs-plate-making-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { getProjectNodeRecordByWorkItemTypeCode, listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { resetRevisionTaskRepository } from '../src/data/pcs-revision-task-repository.ts'
import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createDownstreamTasksFromRevision,
  createRevisionTaskWithProjectRelation,
} from '../src/data/pcs-task-project-relation-writeback.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetStyleArchiveRepository()
resetRevisionTaskRepository()
resetPatternTaskRepository()
resetPlateMakingTaskRepository()

const style = listStyleArchives()[0]
assert.ok(style, '应存在正式款式档案演示数据')

const measureWithoutProject = createRevisionTaskWithProjectRelation({
  projectId: '',
  title: '未选项目的测款改版任务',
  sourceType: '测款结论返改',
  ownerName: '当前用户',
  revisionScopeCodes: ['PATTERN'],
  revisionScopeNames: ['版型结构'],
  issueSummary: '测款反馈需要调整版型。',
  evidenceSummary: '直播评论和试穿反馈都指出版型问题。',
  operatorName: '测试用户',
})
assert.equal(measureWithoutProject.ok, false, '测款结论返改的改版任务必须选择商品项目')

const existingStyleRevision = createRevisionTaskWithProjectRelation({
  projectId: '',
  title: '既有商品花型改版',
  sourceType: '既有商品改款',
  styleId: style!.styleId,
  ownerName: '王版师',
  revisionScopeCodes: ['PRINT', 'COLOR'],
  revisionScopeNames: ['花型', '颜色'],
  issueSummary: '既有商品花型密度偏高，主色偏暗。',
  evidenceSummary: '结合竞品对比和门店反馈，确认需要调整。',
  operatorName: '测试用户',
})
assert.equal(existingStyleRevision.ok, true, '既有商品改款应允许不关联商品项目')
if (existingStyleRevision.ok) {
  assert.equal(existingStyleRevision.task.projectId, '', '既有商品改款不应强制写入商品项目')
  assert.equal(existingStyleRevision.task.styleId, style!.styleId, '既有商品改款应写入正式款式档案')
  assert.equal(existingStyleRevision.relation, null, '未关联商品项目时不应写项目关系')
}

const manualWithoutReference = createRevisionTaskWithProjectRelation({
  projectId: '',
  title: '人工改版需求任务',
  sourceType: '人工改版需求',
  styleId: style!.styleId,
  ownerName: '李版师',
  revisionScopeCodes: ['PATTERN'],
  revisionScopeNames: ['版型结构'],
  issueSummary: '需要重新评估版长和腰节。',
  evidenceSummary: '设计复盘时确认存在版长比例问题。',
  operatorName: '测试用户',
})
assert.equal(manualWithoutReference.ok, false, '人工改版需求的改版任务必须选择参考对象')

const manualWithReference = createRevisionTaskWithProjectRelation({
  projectId: '',
  title: '人工改版需求任务（带参考对象）',
  sourceType: '人工改版需求',
  styleId: style!.styleId,
  referenceObjectType: '设计评审记录',
  referenceObjectId: 'REF-REVIEW-001',
  referenceObjectCode: 'REF-REVIEW-001',
  referenceObjectName: '春夏连衣裙评审纪要',
  ownerName: '李版师',
  revisionScopeCodes: ['PATTERN'],
  revisionScopeNames: ['版型结构'],
  issueSummary: '需要调整领口与版长比例。',
  evidenceSummary: '设计评审记录已明确指出当前版型问题。',
  operatorName: '测试用户',
})
assert.equal(manualWithReference.ok, true, '人工改版需求并选择参考对象后应允许创建')
if (manualWithReference.ok) {
  assert.equal(manualWithReference.task.referenceObjectCode, 'REF-REVIEW-001', '人工改版需求应写入参考对象信息')
  assert.equal(manualWithReference.task.projectId, '', '人工改版需求不应强制挂商品项目')
}

const project = listProjects().find((item) =>
  Boolean(getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'REVISION_TASK')),
)
assert.ok(project, '应存在测款结论返改的商品项目演示数据')

const measureRevision = createRevisionTaskWithProjectRelation({
  projectId: project!.projectId,
  title: '测款结论返改任务（花型）',
  sourceType: '测款结论返改',
  ownerName: project!.ownerName,
  revisionScopeCodes: ['PRINT'],
  revisionScopeNames: ['花型'],
  issueSummary: '测款阶段确认花型层次和主色需要调整。',
  evidenceSummary: '直播测款评论、用户停留和试穿反馈均指向花型问题。',
  operatorName: '测试用户',
})
assert.equal(measureRevision.ok, true, '测款结论返改并选择商品项目后应允许创建')
if (measureRevision.ok) {
  assert.ok(measureRevision.relation, '测款结论返改应写入正式项目关系')
  const downstream = createDownstreamTasksFromRevision(measureRevision.task.revisionTaskId, ['PRINT'])
  assert.equal(downstream.successCount, 1, '勾选花型时应同步创建花型下游任务')
  assert.ok(!downstream.failureMessages.some((message) => message.includes('缺少花型任务节点')), '缺少花型节点不应阻断改版下游花型任务')
  assert.equal(listPlateMakingTasks().filter((item) => item.upstreamObjectId === measureRevision.task.revisionTaskId).length, 0, '不应再创建制版下游任务')
  const patternDownstreams = listPatternTasks().filter((item) => item.upstreamObjectId === measureRevision.task.revisionTaskId)
  assert.equal(patternDownstreams.length, 1, '花型下游任务应能按改版任务上游关系查到')
  assert.equal(patternDownstreams[0]?.projectId, project!.projectId, '花型下游任务应保留商品项目归属')
  assert.equal(patternDownstreams[0]?.sourceType, '改版任务', '花型下游任务来源应标记为改版任务')
}

console.log('pcs-revision-task-source-rules.spec.ts PASS')
