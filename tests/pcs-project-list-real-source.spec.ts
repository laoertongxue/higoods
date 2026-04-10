import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getProjectStoreSnapshot, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { buildProjectListViewModels, getProjectListFilterCatalog } from '../src/data/pcs-project-view-model.ts'

resetProjectRepository()

const snapshot = getProjectStoreSnapshot()
assert.ok(snapshot.projects.length > 0, '仓储为空时应自动写入初始化项目主记录')
assert.ok(snapshot.phases.length > 0, '仓储为空时应自动写入初始化阶段记录')
assert.ok(snapshot.nodes.length > 0, '仓储为空时应自动写入初始化工作项节点')

const rows = buildProjectListViewModels()
assert.equal(rows.length, snapshot.projects.length, '列表页应从真实项目仓储读取项目记录')

const firstProject = rows[0]
assert.ok(firstProject, '应存在至少一个初始化项目')

const firstProjectNodes = snapshot.nodes.filter((node) => node.projectId === firstProject.projectId)
const expectedTotal = firstProjectNodes.filter((node) => node.currentStatus !== '已取消').length
const expectedCompleted = firstProjectNodes.filter((node) => node.currentStatus === '已完成').length
assert.equal(firstProject.totalNodeCount, expectedTotal, '完成情况总数应来自真实项目节点')
assert.equal(firstProject.completedNodeCount, expectedCompleted, '完成情况已完成数应来自真实项目节点')

const filters = getProjectListFilterCatalog()
assert.ok(filters.owners.length > 0, '负责人筛选应来自真实项目主记录')
assert.ok(filters.phases.length > 0, '阶段筛选应来自真实阶段记录')
assert.ok(filters.statuses.length > 0, '状态筛选应来自真实项目状态')

const listPageSource = readFileSync(new URL('../src/pages/pcs-projects.ts', import.meta.url), 'utf8')
assert.ok(listPageSource.includes('buildProjectListViewModels'), '列表页应调用项目视图模型')
assert.ok(!listPageSource.includes('PROJECT_SEEDS'), '列表页不应再以内置项目种子作为主渲染源')

console.log('pcs-project-list-real-source.spec.ts PASS')
