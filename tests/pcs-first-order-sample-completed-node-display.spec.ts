import assert from 'node:assert/strict'

import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import {
  listFirstOrderSampleTasksByProjectNode,
  resetFirstOrderSampleTaskRepository,
} from '../src/data/pcs-first-order-sample-repository.ts'
import { resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'
import { getProjectNodeInstanceModel } from '../src/data/pcs-project-instance-model.ts'

resetProjectRepository()
resetFirstSampleTaskRepository()
resetFirstOrderSampleTaskRepository()
resetProjectRelationRepository()

const project = listProjects().find((item) => item.projectCode === 'PRJ-20251216-030')
assert.ok(project, '缺少首单样衣完成展示 mock 项目')
const node = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'FIRST_ORDER_SAMPLE')
assert.ok(node, '缺少 FIRST_ORDER_SAMPLE 项目节点')
assert.equal(node.currentStatus, '已完成')

const task = listFirstOrderSampleTasksByProjectNode(project.projectId, node.projectNodeId)[0]
assert.ok(task, '缺少已通过首单样衣任务')
assert.equal(task.status, '已通过')
assert.equal(task.sourceFirstSampleTaskId, 'FSD-20260425-003')
assert.equal(task.sourceFirstSampleTaskCode, 'FSD-20260425-003')
assert.equal(task.sourceFirstSampleCode, 'FS-RESULT-25003')
assert.equal(task.sourceTechPackVersionId, 'TDV-ID-0008')
assert.equal(task.sourceTechPackVersionLabel, 'V2')
assert.equal(task.factoryName, '深圳工厂01')
assert.equal(task.sampleChainMode, '复用首版结论')
assert.equal(task.sampleCode, 'FOS-RESULT-25001')
assert.equal(task.conclusionResult, '通过')
assert.equal(task.confirmedAt, '2026-04-25 11:20')
assert.equal(task.confirmedBy, '张娜')

const model = getProjectNodeInstanceModel(project.projectId, node.projectNodeId)
const latest = model.latestInstance
assert.ok(latest, '完成节点应能读取正式首单样衣任务实例')
const fields = new Map(latest.fields.map((field) => [field.fieldKey, field.value]))
assert.equal(fields.get('sourceFirstSampleTaskCode'), 'FSD-20260425-003')
assert.equal(fields.get('sourceFirstSampleCode'), 'FS-RESULT-25003')
assert.equal(fields.get('sourceTechPackVersionLabel'), 'V2')
assert.equal(fields.get('factoryName'), '深圳工厂01')
assert.equal(fields.get('sampleChainMode'), '复用首版结论')
assert.match(fields.get('samplePlanLines') || '', /复用首版结论/)
assert.equal(fields.get('finalReferenceNote'), '首版样衣确认通过，首单阶段直接沿用。')
assert.equal(fields.get('sampleCode'), 'FOS-RESULT-25001')
assert.equal(fields.get('conclusionResult'), '通过')
assert.equal(fields.get('conclusionNote'), '首单样衣确认通过，可进入后续。')
assert.equal(fields.get('confirmedAt'), '2026-04-25 11:20')
assert.equal(fields.get('confirmedBy'), '张娜')
