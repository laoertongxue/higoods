import assert from 'node:assert/strict'
import fs from 'node:fs'

import { renderPcsRevisionTaskDetailPage } from '../src/pages/pcs-engineering-tasks.ts'
import { getProjectNodeRecordByWorkItemTypeCode, listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetRevisionTaskRepository, getRevisionTaskById, updateRevisionTask } from '../src/data/pcs-revision-task-repository.ts'
import { resetPatternTaskRepository, listPatternTasks } from '../src/data/pcs-pattern-task-repository.ts'
import { resetPlateMakingTaskRepository, listPlateMakingTasks } from '../src/data/pcs-plate-making-repository.ts'
import { resetFirstSampleTaskRepository, listFirstSampleTasks } from '../src/data/pcs-first-sample-repository.ts'
import { resetFirstOrderSampleTaskRepository, listFirstOrderSampleTasks } from '../src/data/pcs-first-order-sample-repository.ts'
import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  REVISION_TASK_SOURCE_TYPE_LIST,
  normalizeLegacyTaskStatus,
  normalizeRevisionTaskSourceType,
} from '../src/data/pcs-task-source-normalizer.ts'
import {
  completeRevisionTask,
  completeRevisionTaskWithProjectRelationSync,
  confirmRevisionTaskOutput,
  createDownstreamTasksFromRevision,
  createRevisionTaskWithProjectRelation,
  inferDownstreamTypesFromRevisionTask,
  submitRevisionTaskForConfirmation,
} from '../src/data/pcs-task-project-relation-writeback.ts'
import { isTechPackGenerationAllowedStatus } from '../src/data/pcs-tech-pack-task-generation.ts'

function pass(label: string): void {
  console.log(`PASS ${label}`)
}

function resetAll(): void {
  resetProjectRepository()
  resetProjectRelationRepository()
  resetStyleArchiveRepository()
  resetRevisionTaskRepository()
  resetPatternTaskRepository()
  resetPlateMakingTaskRepository()
  resetFirstSampleTaskRepository()
  resetFirstOrderSampleTaskRepository()
}

function assertIncludes(source: string, pattern: string, message: string): void {
  assert.ok(source.includes(pattern), message)
}

resetAll()

assert.deepEqual(REVISION_TASK_SOURCE_TYPE_LIST, ['测款结论返改', '首版样衣返改', '既有商品改款', '人工改版需求'])
assert.equal(normalizeRevisionTaskSourceType('测款触发'), '测款结论返改')
assert.equal(normalizeRevisionTaskSourceType('人工创建'), '人工改版需求')
assert.equal(normalizeRevisionTaskSourceType('FIRST_SAMPLE_REWORK'), '首版样衣返改')
assert.equal(normalizeLegacyTaskStatus('TECH_PACK_GENERATED'), '已生成技术包')
pass('来源类型和新增状态使用中文业务口径')

const style = listStyleArchives()[0]
assert.ok(style, '应存在正式款式档案演示数据')
const project = listProjects().find((item) =>
  Boolean(getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'REVISION_TASK')),
)
assert.ok(project, '应存在带改版任务节点的商品项目演示数据')

const projectRequired = createRevisionTaskWithProjectRelation({
  projectId: '',
  title: '未选项目的测款结论返改',
  sourceType: '测款结论返改',
  ownerName: '测试用户',
  dueAt: '2026-06-30 18:00',
  revisionScopeCodes: ['PATTERN'],
  revisionScopeNames: ['版型结构'],
  issueSummary: '测款结论要求调整版型。',
  evidenceSummary: '测款反馈已确认。',
  operatorName: '验收脚本',
})
assert.equal(projectRequired.ok, false)
assert.ok(projectRequired.message.includes('商品项目'), '测款结论返改未选项目时应阻断')

const manualWithoutReference = createRevisionTaskWithProjectRelation({
  projectId: '',
  title: '未选参考对象的人工改版需求',
  sourceType: '人工改版需求',
  styleId: style.styleId,
  ownerName: '测试用户',
  dueAt: '2026-06-30 18:00',
  revisionScopeCodes: ['PATTERN'],
  revisionScopeNames: ['版型结构'],
  issueSummary: '人工复盘要求调整。',
  evidenceSummary: '评审会提出调整建议。',
  operatorName: '验收脚本',
})
assert.equal(manualWithoutReference.ok, false)
assert.ok(manualWithoutReference.message.includes('参考对象'), '人工改版需求缺少参考对象时应阻断')

const manualWithReference = createRevisionTaskWithProjectRelation({
  projectId: '',
  title: '带参考对象的人工改版需求',
  sourceType: '人工改版需求',
  styleId: style.styleId,
  referenceObjectType: '设计评审记录',
  referenceObjectId: 'REF-REVISION-001',
  referenceObjectCode: 'REF-REVISION-001',
  referenceObjectName: '春夏款复盘纪要',
  ownerName: '测试用户',
  dueAt: '2026-06-30 18:00',
  revisionScopeCodes: ['PATTERN'],
  revisionScopeNames: ['版型结构'],
  issueSummary: '人工复盘要求调整。',
  evidenceSummary: '评审会提出调整建议。',
  operatorName: '验收脚本',
})
assert.equal(manualWithReference.ok, true)
if (manualWithReference.ok) {
  assert.equal(manualWithReference.task.projectId, '')
  assert.equal(manualWithReference.task.referenceObjectCode, 'REF-REVISION-001')
}
pass('不同业务来源的创建约束清晰且互不混淆')

const standalonePatternRevision = createRevisionTaskWithProjectRelation({
  projectId: '',
  title: '独立花型改版任务',
  sourceType: '既有商品改款',
  styleId: style.styleId,
  ownerName: '验收脚本',
  dueAt: '2026-06-30 18:00',
  revisionScopeCodes: ['PRINT'],
  revisionScopeNames: ['花型'],
  issueSummary: '独立改版任务也需要调整花型。',
  evidenceSummary: '正式款式档案已存在，业务确认按独立任务推进。',
  operatorName: '验收脚本',
})
assert.equal(standalonePatternRevision.ok, true, '独立改版任务关联正式款式后应允许创建')
if (!standalonePatternRevision.ok) throw new Error(standalonePatternRevision.message)
const standaloneDetailHtml = renderPcsRevisionTaskDetailPage(standalonePatternRevision.task.revisionTaskId)
assertIncludes(standaloneDetailHtml, '独立改版任务', '独立改版任务详情页应明确展示独立任务归属')
assert.ok(!standaloneDetailHtml.includes('未关联商品项目'), '独立改版任务详情页不应提示未关联商品项目')
assert.ok(!standaloneDetailHtml.includes('先补齐正式商品项目链路'), '独立改版任务不应要求补齐正式商品项目链路')
assert.deepEqual(inferDownstreamTypesFromRevisionTask(standalonePatternRevision.task), ['PRINT'], '独立改版任务涉及花型时只建议花型下游')
const standaloneDownstream = createDownstreamTasksFromRevision(standalonePatternRevision.task.revisionTaskId, ['PRINT'])
assert.equal(standaloneDownstream.successCount, 1, '独立改版任务勾选花型时应创建花型下游')
assert.ok(!standaloneDownstream.failureMessages.some((item) => item.includes('未关联商品项目')), '独立改版任务创建花型下游不应被商品项目阻断')
const standalonePatternDownstreams = listPatternTasks().filter((item) => item.upstreamObjectId === standalonePatternRevision.task.revisionTaskId)
assert.equal(standalonePatternDownstreams.length, 1)
assert.equal(standalonePatternDownstreams[0]?.projectId, '')
assert.equal(standalonePatternDownstreams[0]?.sourceType, '改版任务')
assert.equal(standalonePatternDownstreams[0]?.styleId, style.styleId)
const standaloneSubmitted = submitRevisionTaskForConfirmation(standalonePatternRevision.task.revisionTaskId, '验收脚本')
assert.equal(standaloneSubmitted.ok, true)
const standaloneConfirmed = confirmRevisionTaskOutput(standalonePatternRevision.task.revisionTaskId, '验收脚本')
assert.equal(standaloneConfirmed.ok, true)
const standaloneCompleted = completeRevisionTask(standalonePatternRevision.task.revisionTaskId, '验收脚本')
assert.equal(standaloneCompleted.ok, true)
assert.equal(standaloneCompleted.ok && standaloneCompleted.task.status, '已完成')
pass('独立改版任务按独立任务语义展示，可创建花型下游并完成闭环')

const created = createRevisionTaskWithProjectRelation({
  projectId: project.projectId,
  title: '验收改版任务',
  sourceType: '测款结论返改',
  ownerName: project.ownerName,
  dueAt: '2026-06-30 18:00',
  revisionScopeCodes: ['PATTERN', 'PRINT', 'COLOR'],
  revisionScopeNames: ['版型结构', '花型', '颜色'],
  issueSummary: '测款结论要求同步调整版型与花色。',
  evidenceSummary: '直播测款评论、试穿记录和评审结论均指向此问题。',
  sampleQty: 2,
  operatorName: '验收脚本',
})
assert.equal(created.ok, true)
assert.ok(created.ok && created.relation, '项目型改版任务应写入正式项目关系')
assert.equal(created.ok && created.task.status, '进行中')
if (!created.ok) throw new Error(created.message)

const nodeAfterCreate = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'REVISION_TASK')
assert.equal(nodeAfterCreate?.currentStatus, '进行中')
assert.equal(nodeAfterCreate?.latestInstanceId, created.task.revisionTaskId)
assert.equal(nodeAfterCreate?.latestInstanceCode, created.task.revisionTaskCode)
pass('创建后改版任务和商品项目节点同步为进行中')

const suggestedTypes = inferDownstreamTypesFromRevisionTask(created.task)
assert.deepEqual(suggestedTypes, ['PRINT', 'FIRST_SAMPLE'])
assert.deepEqual(
  inferDownstreamTypesFromRevisionTask({ revisionScopeCodes: [], revisionScopeNames: ['颜色'], sampleQty: 0 }),
  ['PRINT'],
  '只有颜色业务名称时也应推导花型任务',
)
const downstreamResult = createDownstreamTasksFromRevision(created.task.revisionTaskId)
assert.equal(downstreamResult.successCount, 2, '涉及花型且需要出样时应创建花型任务和首版样衣打样')
assert.ok(!downstreamResult.failureMessages.some((item) => item.includes('缺少制版任务节点')))
assert.ok(!downstreamResult.failureMessages.some((item) => item.includes('缺少首版样衣节点')))
assert.equal(listPlateMakingTasks().filter((item) => item.upstreamObjectId === created.task.revisionTaskId).length, 0)
const createdPatternDownstreams = listPatternTasks().filter((item) => item.upstreamObjectId === created.task.revisionTaskId)
assert.equal(createdPatternDownstreams.length, 1)
assert.equal(createdPatternDownstreams[0]?.projectId, project.projectId)
assert.equal(createdPatternDownstreams[0]?.projectNodeId, '')
const createdPatternDownstreamCode = createdPatternDownstreams[0]?.patternTaskCode || ''
const createdFirstSampleDownstreams = listFirstSampleTasks().filter((item) => item.upstreamObjectId === created.task.revisionTaskId)
assert.equal(createdFirstSampleDownstreams.length, 1)
assert.equal(createdFirstSampleDownstreams[0]?.projectId, project.projectId)
assert.equal(createdFirstSampleDownstreams[0]?.sourceTaskId, created.task.revisionTaskId)
const createdFirstSampleDownstreamCode = createdFirstSampleDownstreams[0]?.firstSampleTaskCode || ''
assert.equal(listFirstOrderSampleTasks().filter((item) => item.upstreamObjectId === created.task.revisionTaskId).length, 0)
pass('下游任务按改版范围推导，默认创建花型和产出样衣，不再默认创建制版任务')

const wanlongProject = listProjects().find((item) => item.templateId === 'TPL-003' || item.templateName.includes('万隆改版'))
assert.ok(wanlongProject, '应存在万隆改版出样衣测款项目演示数据')
const wanlongRevision = createRevisionTaskWithProjectRelation({
  projectId: wanlongProject.projectId,
  title: '万隆改版出样衣验收任务',
  sourceType: '测款结论返改',
  ownerName: wanlongProject.ownerName,
  dueAt: '2026-06-30 18:00',
  revisionScopeCodes: ['PATTERN'],
  revisionScopeNames: ['版型结构'],
  issueSummary: '万隆项目需要按改版任务出样衣。',
  evidenceSummary: '项目模板已锁定样衣来源为委托打样。',
  sampleQty: 0,
  operatorName: '验收脚本',
})
assert.equal(wanlongRevision.ok, true)
if (!wanlongRevision.ok) throw new Error(wanlongRevision.message)
assert.deepEqual(inferDownstreamTypesFromRevisionTask(wanlongRevision.task), ['FIRST_SAMPLE'])
const wanlongDownstream = createDownstreamTasksFromRevision(wanlongRevision.task.revisionTaskId)
assert.equal(wanlongDownstream.successCount, 1, '万隆改版出样衣项目即使未填样衣数量也应创建首版样衣打样')
const wanlongProducedSamples = listFirstSampleTasks().filter((item) => item.upstreamObjectId === wanlongRevision.task.revisionTaskId)
assert.equal(wanlongProducedSamples.length, 1)
assert.equal(wanlongProducedSamples[0]?.sourceTaskId, wanlongRevision.task.revisionTaskId)
pass('万隆改版出样衣项目默认把改版任务产出样衣落到首版样衣打样')

const submitted = submitRevisionTaskForConfirmation(created.task.revisionTaskId, '验收脚本')
assert.equal(submitted.ok, true)
assert.equal(submitted.ok && submitted.task.status, '待确认')
assert.equal(getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'REVISION_TASK')?.currentStatus, '待确认')

const confirmed = confirmRevisionTaskOutput(created.task.revisionTaskId, '验收脚本')
assert.equal(confirmed.ok, true)
assert.equal(confirmed.ok && confirmed.task.status, '已确认')
assert.equal(getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'REVISION_TASK')?.pendingActionType, '生成改版技术包版本')
pass('进行中到待确认到已确认的状态流转和项目节点写回正确')

assert.equal(isTechPackGenerationAllowedStatus('进行中'), false)
assert.equal(isTechPackGenerationAllowedStatus('待确认'), false)
assert.equal(isTechPackGenerationAllowedStatus('已确认'), true)
assert.equal(isTechPackGenerationAllowedStatus('已生成技术包'), true)

const beforeTechPackComplete = completeRevisionTaskWithProjectRelationSync(created.task.revisionTaskId, '验收脚本')
assert.equal(beforeTechPackComplete.ok, false)
assert.ok(beforeTechPackComplete.message.includes('请先生成改版技术包版本'))

const generatedTask = updateRevisionTask(created.task.revisionTaskId, {
  status: '已生成技术包',
  generatedNewTechPackVersionFlag: true,
  generatedNewTechPackVersionAt: '2026-06-17 13:08:00',
  linkedTechPackVersionId: 'TDV-ACCEPTANCE-001',
  linkedTechPackVersionCode: 'TDV-ACCEPTANCE-001',
  linkedTechPackVersionLabel: 'V2 改版',
  linkedTechPackVersionStatus: 'DRAFT',
})
assert.ok(generatedTask, '应能写入已生成技术包状态')

const completed = completeRevisionTaskWithProjectRelationSync(created.task.revisionTaskId, '验收脚本')
assert.equal(completed.ok, true)
assert.equal(completed.ok && completed.task.status, '已完成')
assert.equal(getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'REVISION_TASK')?.currentStatus, '已完成')
pass('完成任务必须以已生成技术包为前置，完成后回写项目节点')

const detailTask = getRevisionTaskById(created.task.revisionTaskId)
assert.ok(detailTask, '应能读取验收改版任务')
const detailHtml = renderPcsRevisionTaskDetailPage(created.task.revisionTaskId)
;[
  '任务推进摘要',
  '为什么改',
  '改什么',
  '当前下一步',
  '技术包',
  '完成前缺失项',
  '业务来源',
  '任务目的',
  '来源对象',
  '推进状态',
  '缺失项',
  '关联对象',
  '任务总览',
  '改版内容',
  '产出样衣',
  '产出与验证',
  '下游任务',
].forEach((label) => {
  assertIncludes(detailHtml, label, `改版详情页缺少：${label}`)
})
assert.ok(!detailHtml.includes('正式工作项'), '详情页右侧摘要不应再突出系统节点字段')
assert.ok(!detailHtml.includes('来源任务编号'), '详情页不应再用来源任务编号作为主阅读字段')
assert.ok(!detailHtml.includes('技术包状态</p>'), '详情页不应重复展示旧版技术包状态字段')
assert.ok(createdPatternDownstreamCode, '应存在可展示的花型任务编号')
assert.ok(createdFirstSampleDownstreamCode, '应存在可展示的产出样衣任务编号')
assertIncludes(detailHtml, '下游任务', '改版详情页应展示下游任务摘要')
assertIncludes(detailHtml, '2 个', '改版详情页默认视图应展示已生成 2 个下游任务')
pass('详情页内容结构聚焦业务推进、缺失项和下一动作')

const pageSource = fs.readFileSync('src/pages/pcs-engineering-tasks.ts', 'utf8')
;[
  'data-pcs-engineering-action="submit-revision-confirmation"',
  'data-pcs-engineering-action="confirm-revision-output"',
  'data-pcs-engineering-action="revision-generate-tech-pack"',
  'data-pcs-engineering-action="complete-revision-task"',
  'data-pcs-engineering-action="revision-create-downstream"',
].forEach((action) => {
  assertIncludes(pageSource, action, `改版详情页缺少动作入口：${action}`)
})
assertIncludes(pageSource, '创建建议下游', '下游页签缺少创建建议下游入口')
assertIncludes(pageSource, 'sourceOptions: REVISION_TASK_SOURCE_TYPE_LIST', '列表来源筛选必须固定展示标准改版来源')
assertIncludes(pageSource, "已确认: { label: '待生成技术包'", '已确认状态必须按待生成技术包展示')
assertIncludes(pageSource, "已生成技术包: { label: '待完成'", '已生成技术包状态必须按待完成展示')
assertIncludes(pageSource, "ENGINEERING_COMMON_FILTER_STATUS_OPTIONS = ['进行中', '待确认', '已确认', '已生成技术包', '已完成']", '工程任务状态筛选必须收敛为 5 个业务状态')
assertIncludes(pageSource, "label: '产出样衣'", '改版详情页样衣页签必须表达为产出样衣')
assertIncludes(pageSource, '当前改版任务暂未产出样衣', '产出样衣空状态必须按当前改版任务语义表达')
assertIncludes(pageSource, "task.projectCode || '独立改版任务'", '独立改版任务标题信息不得继续显示未关联商品项目')
assert.ok(!pageSource.includes("task.projectCode || '未关联商品项目'"), '独立改版任务标题不得继续使用未关联商品项目')
assert.ok(!pageSource.includes("if (!task.projectId) return '先补齐正式商品项目链路'"), '独立改版任务下一步不得要求补齐正式商品项目链路')
assert.ok(!pageSource.includes("missing.push('关联商品项目')"), '独立改版任务缺失项不得提示关联商品项目')
assert.ok(!pageSource.includes("label: '关联样衣'"), '改版详情页不得继续使用关联样衣页签')
assert.ok(!pageSource.includes("statusOptions: ['未开始', '进行中'"), '工程任务状态筛选不得继续展示未开始')
assert.ok(!pageSource.includes("'异常待处理', '已取消']"), '工程任务状态筛选不得继续展示阻塞和已取消')
assert.ok(!pageSource.includes('py-6 text-center text-sm text-slate-500'), '上传空状态不应继续占用大块纵向空间')
assert.ok((pageSource.match(/'面辅料变化'/g) || []).length >= 1, '仍需保留面辅料变化业务模块')
assert.ok(pageSource.includes('明细编辑'), '面辅料编辑区应与面辅料变化汇总区区分命名')
pass('页面动作和密集布局问题已收敛')

console.log('check-pcs-revision-remodel-acceptance PASS')
