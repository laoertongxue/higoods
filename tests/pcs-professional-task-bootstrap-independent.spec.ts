import assert from 'node:assert/strict'

import { listProjects } from '../src/data/pcs-project-repository.ts'
import { findStyleArchiveByCode, getStyleArchiveById } from '../src/data/pcs-style-archive-repository.ts'
import {
  createTaskBootstrapSnapshot,
  createTaskRelationBootstrapSnapshot,
} from '../src/data/pcs-task-bootstrap.ts'

const snapshot = createTaskBootstrapSnapshot()
const projects = new Map(listProjects().map((project) => [project.projectId, project]))
const professionalTasks = [
  ...snapshot.revisionTasks,
  ...snapshot.plateTasks,
  ...snapshot.patternTasks,
  ...snapshot.firstSampleTasks,
  ...snapshot.firstOrderSampleTasks,
]

assert.ok(snapshot.revisionTasks.length >= 4, '改版模块应保留项目归属与独立创建两类真实业务种子')
assert.ok(snapshot.plateTasks.length >= 8, '制版模块应保留足够的真实业务种子')
assert.ok(snapshot.patternTasks.length >= 4, '花型模块应保留足够的真实业务种子')
assert.ok(snapshot.firstSampleTasks.length >= 8, '首版样衣模块应保留足够的真实业务种子')
assert.ok(snapshot.firstOrderSampleTasks.length >= 4, '首单样衣模块应保留足够的真实业务种子')
assert.ok(snapshot.plateTasks.every((task) => task.projectId && !task.projectNodeId), '制版种子只能关联来源项目，不能依赖项目节点')
assert.ok(snapshot.patternTasks.every((task) => task.projectId && !task.projectNodeId), '花型种子只能关联来源项目，不能依赖项目节点')
assert.ok(snapshot.firstSampleTasks.every((task) => task.projectId && !task.projectNodeId), '首版样衣种子只能关联来源项目，不能依赖项目节点')
assert.ok(snapshot.firstOrderSampleTasks.every((task) => task.projectId && !task.projectNodeId), '首单样衣种子只能关联来源项目，不能依赖项目节点')
professionalTasks.forEach((task) => {
  if (task.projectId) {
    const project = projects.get(task.projectId)
    assert.ok(project, `${task.stepName} ${task.title} 的 projectId 必须指向真实项目`)
    assert.equal(task.projectCode, project.projectCode)
    assert.equal(task.projectName, project.projectName)
    assert.equal(task.projectNodeId, '', `${task.stepName} ${task.title} 不能绑定项目节点`)
    return
  }

  assert.equal(task.stepCode, 'REVISION_TASK', '只有独立改版／设计任务可以不关联工程主单项目')
  assert.ok(
    task.sourceType === '既有商品改款' || task.sourceType === '人工改版需求',
    '无项目改版任务只能来源于既有商品改款或人工设计需求',
  )
  const styleById = getStyleArchiveById(task.styleId)
  const styleByCode = findStyleArchiveByCode(task.styleCode)
  assert.ok(styleById, `独立改版任务 ${task.revisionTaskCode} 的 styleId 必须指向真实款式档案`)
  assert.ok(styleByCode, `独立改版任务 ${task.revisionTaskCode} 的 styleCode 必须指向真实款式档案`)
  assert.equal(styleById.styleId, styleByCode.styleId)
  assert.equal(task.spuCode, styleById.styleCode)
  assert.equal(task.productStyleCode, styleById.styleCode)
  assert.ok(task.upstreamModule && task.upstreamObjectType && task.upstreamObjectId && task.upstreamObjectCode)
  assert.ok(task.issueSummary && task.evidenceSummary, '独立改版任务必须保留正式需求与来源依据')
  assert.ok(task.revisionScopeCodes.length > 0 && task.revisionScopeNames.length > 0, '独立改版任务必须明确改版范围')
  assert.equal(task.projectNodeId, '')
})

const relationSnapshot = createTaskRelationBootstrapSnapshot()
const professionalSourceModules = new Set(['改版任务', '制版任务', '花型任务', '首版样衣打样', '首单样衣打样'])
assert.equal(relationSnapshot.relations.length, 0, '五类独立专业任务 bootstrap 不得生成项目节点关系')
assert.ok(
  relationSnapshot.relations.every((relation) => !professionalSourceModules.has(relation.sourceModule)),
  'bootstrap 不得残留任何五类专业任务项目关系',
)
assert.ok(snapshot.plateTasks.every((task) => task.upstreamObjectId && task.upstreamObjectCode), '制版种子必须保留真实来源对象')
assert.ok(snapshot.firstOrderSampleTasks.every((task) => task.upstreamObjectId && task.upstreamObjectCode), '首单样衣种子必须保留真实来源任务')
snapshot.plateTasks.forEach((task) => {
  if (task.sourceType === '改版任务') {
    const upstream = snapshot.revisionTasks.find((item) => item.revisionTaskId === task.upstreamObjectId)
    assert.ok(upstream, `制版任务 ${task.plateTaskCode} 的改版来源必须存在`)
    assert.equal(upstream.projectId, task.projectId, `制版任务 ${task.plateTaskCode} 与改版来源必须属于同一项目`)
    return
  }
  assert.equal(task.sourceType, '人工创建')
  assert.equal(task.upstreamModule, '商品项目')
  assert.equal(task.upstreamObjectType, '商品项目')
  assert.equal(task.upstreamObjectId, task.projectId)
  assert.equal(task.upstreamObjectCode, task.projectCode)
})
snapshot.firstOrderSampleTasks.forEach((task) => {
  assert.equal(task.sourceType, '首版样衣打样')
  const upstream = snapshot.firstSampleTasks.find((item) => item.firstSampleTaskId === task.upstreamObjectId)
  assert.ok(upstream, `首单样衣任务 ${task.firstOrderSampleTaskCode} 的首版样衣来源必须存在`)
  assert.equal(upstream.projectId, task.projectId, `首单样衣任务 ${task.firstOrderSampleTaskCode} 与来源必须属于同一项目`)
})
assert.ok(snapshot.plateTasks.some((task) => task.status === '进行中'))
assert.ok(snapshot.plateTasks.some((task) => task.status === '已完成'))
assert.ok(snapshot.patternTasks.some((task) => task.status === '进行中'))
assert.ok(snapshot.patternTasks.some((task) => task.status === '已完成' || task.status === '已确认'))
assert.ok(snapshot.firstSampleTasks.some((task) => task.status === '打样中'))
assert.ok(snapshot.firstSampleTasks.some((task) => task.status === '已通过'))
assert.ok(snapshot.firstOrderSampleTasks.some((task) => task.status === '打样中'))
assert.ok(snapshot.firstOrderSampleTasks.some((task) => task.status === '已通过'))

console.log('pcs-professional-task-bootstrap-independent.spec.ts PASS')
