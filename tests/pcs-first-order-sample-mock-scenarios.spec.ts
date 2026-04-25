import assert from 'node:assert/strict'

import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'
import {
  listFirstOrderSampleTasksByProjectNode,
  resetFirstOrderSampleTaskRepository,
} from '../src/data/pcs-first-order-sample-repository.ts'
import {
  listFirstOrderSourceFirstSampleOptions,
  listFirstOrderTechPackVersionOptions,
} from '../src/data/pcs-first-order-sample-project-writeback.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-projects.ts'

resetProjectRepository()
resetFirstSampleTaskRepository()
resetFirstOrderSampleTaskRepository()
resetProjectRelationRepository()

const projects = new Map(listProjects().map((project) => [project.projectCode, project]))

const scenarioA = projects.get('PRJ-20251216-028')
assert.ok(scenarioA, '缺少场景 1：进入首单样衣节点但尚未创建任务')
const nodeA = getProjectNodeRecordByWorkItemTypeCode(scenarioA.projectId, 'FIRST_ORDER_SAMPLE')
assert.ok(nodeA)
assert.equal(listFirstOrderSampleTasksByProjectNode(scenarioA.projectId, nodeA.projectNodeId).length, 0)
assert.ok(listFirstOrderSourceFirstSampleOptions(scenarioA.projectId).length >= 1)
assert.ok(listFirstOrderTechPackVersionOptions(scenarioA).length >= 1)

const scenarioB = projects.get('PRJ-20251216-029')
assert.ok(scenarioB, '缺少场景 2：首单样衣任务已创建但信息未补齐')
const nodeB = getProjectNodeRecordByWorkItemTypeCode(scenarioB.projectId, 'FIRST_ORDER_SAMPLE')
assert.ok(nodeB)
const taskB = listFirstOrderSampleTasksByProjectNode(scenarioB.projectId, nodeB.projectNodeId)[0]
assert.ok(taskB)
assert.equal(taskB.status, '打样中')
assert.equal(taskB.sourceFirstSampleTaskCode, 'FSD-20260425-002')
assert.equal(taskB.sourceTechPackVersionId, 'TDV-ID-0007')
assert.equal(taskB.factoryName, '深圳工厂01')
assert.equal(taskB.targetSite, '深圳')
assert.equal(taskB.sampleChainMode, '复用首版结论')
assert.equal(taskB.samplePlanLines.length, 0)
assert.equal(taskB.finalReferenceNote, '')
assert.equal(taskB.sampleCode, '')
assert.equal(taskB.conclusionResult, '')
assert.equal(taskB.confirmedAt, '')
assert.equal(taskB.confirmedBy, '')
const scenarioBHtml = await renderPcsProjectWorkItemDetailPage(scenarioB.projectId, nodeB.projectNodeId)
assert.match(scenarioBHtml, /首单样衣打样任务/, '已建未补齐场景应在商品项目节点展示任务信息卡片')
assert.match(scenarioBHtml, new RegExp(taskB.firstOrderSampleTaskCode), '已建未补齐场景应展示任务编号')
assert.match(scenarioBHtml, /深圳工厂01/, '已建未补齐场景应展示工厂')
assert.match(scenarioBHtml, /去首单样衣打样详情补齐/, '已建未补齐场景应展示详情补齐入口')

const scenarioC = projects.get('PRJ-20251216-030')
assert.ok(scenarioC, '缺少场景 3：首单样衣已通过且商品项目节点完整展示')
const nodeC = getProjectNodeRecordByWorkItemTypeCode(scenarioC.projectId, 'FIRST_ORDER_SAMPLE')
assert.ok(nodeC)
assert.equal(nodeC.currentStatus, '已完成')
const taskC = listFirstOrderSampleTasksByProjectNode(scenarioC.projectId, nodeC.projectNodeId)[0]
assert.ok(taskC)
assert.equal(taskC.sourceFirstSampleTaskId, 'FSD-20260425-003')
assert.equal(taskC.sourceFirstSampleTaskCode, 'FSD-20260425-003')
assert.equal(taskC.sourceFirstSampleCode, 'FS-RESULT-25003')
assert.equal(taskC.sourceTechPackVersionId, 'TDV-ID-0008')
assert.equal(taskC.sourceTechPackVersionLabel, 'V2')
assert.equal(taskC.factoryName, '深圳工厂01')
assert.equal(taskC.targetSite, '深圳')
assert.equal(taskC.sampleChainMode, '复用首版结论')
assert.equal(taskC.productionReferenceRequiredFlag, false)
assert.equal(taskC.chinaReviewRequiredFlag, false)
assert.equal(taskC.correctFabricRequiredFlag, false)
assert.equal(taskC.samplePlanLines[0]?.sampleRole, '复用首版结论')
assert.equal(taskC.finalReferenceNote, '首版样衣确认通过，首单阶段直接沿用。')
assert.equal(taskC.sampleCode, 'FOS-RESULT-25001')
assert.equal(taskC.conclusionResult, '通过')
assert.equal(taskC.conclusionNote, '首单样衣确认通过，可进入后续。')
assert.equal(taskC.confirmedAt, '2026-04-25 11:20')
assert.equal(taskC.confirmedBy, '张娜')
assert.equal(taskC.status, '已通过')
const scenarioCHtml = await renderPcsProjectWorkItemDetailPage(scenarioC.projectId, nodeC.projectNodeId)
assert.match(scenarioCHtml, /首单样衣打样任务/, '已完成场景应在商品项目节点展示任务信息卡片')
assert.match(scenarioCHtml, /FOS-RESULT-25001/, '已完成场景应展示首单样衣结果编号')
assert.match(scenarioCHtml, /首单样衣确认通过，可进入后续。/, '已完成场景应展示确认说明')
assert.match(scenarioCHtml, /查看首单样衣详情/, '已完成场景应展示查看详情入口')
