import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildProjectDetailViewModel } from '../src/data/pcs-project-view-model.ts'
import {
  clearProjectRelationStore,
  listProjectRelationsByProject,
  resetProjectRelationRepository,
} from '../src/data/pcs-project-relation-repository.ts'
import { getProjectStoreSnapshot, resetProjectRepository } from '../src/data/pcs-project-repository.ts'

resetProjectRepository()
resetProjectRelationRepository()

const detailPageSource = readFileSync(new URL('../src/pages/pcs-project-detail.ts', import.meta.url), 'utf8')
assert.ok(detailPageSource.includes('renderRelationSection'), '项目详情页应新增正式关联对象区域')
assert.ok(detailPageSource.includes('暂无关联对象'), '项目详情页应包含关联对象空状态文案')
assert.ok(detailPageSource.includes('当前项目尚未建立正式模块关联'), '项目详情页应包含正式关系空状态说明')

const projectSnapshot = getProjectStoreSnapshot()
const projectWithRelations = projectSnapshot.projects.find((project) => listProjectRelationsByProject(project.projectId).length > 0)
assert.ok(projectWithRelations, '初始化项目中应至少存在一个已建立正式关系的项目')

const detail = buildProjectDetailViewModel(projectWithRelations!.projectId)
assert.ok(detail, '应能读取真实项目详情')
assert.ok(detail!.relationSection.totalCount > 0, '项目详情页的关联对象区域应来自正式关系仓储')
assert.equal(
  detail!.relationSection.totalCount,
  listProjectRelationsByProject(projectWithRelations!.projectId).length,
  '项目详情页关联对象数量应与正式关系仓储一致',
)
assert.ok(detail!.relationSection.groups.length > 0, '项目详情页应按来源模块分组展示正式关系')
assert.ok(detail!.relationSection.unboundRelationCount >= 0, '项目详情页应能识别未挂项目工作项的关系记录')

const projectWithoutRelations = projectSnapshot.projects.find((project) => listProjectRelationsByProject(project.projectId).length === 0)
assert.ok(projectWithoutRelations, '初始化项目中应存在暂无正式关系的项目')

clearProjectRelationStore()
const emptyDetail = buildProjectDetailViewModel(projectWithoutRelations!.projectId)
assert.ok(emptyDetail, '清空关系仓储后仍应能读取项目详情')
assert.equal(emptyDetail!.relationSection.totalCount, 0, '没有关系记录时详情页应返回空的正式关联对象区域')

console.log('pcs-project-detail-relations.spec.ts PASS')
