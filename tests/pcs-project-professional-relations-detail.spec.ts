import assert from 'node:assert/strict'

import { listProjectRelationsByProject, resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import type { ProjectRelationTaskSourceModule } from '../src/data/pcs-project-relation-types.ts'
import { renderPcsProjectDetailPage } from '../src/pages/pcs-projects.ts'

resetProjectRepository()
resetProjectRelationRepository()

const professionalModules = new Set<ProjectRelationTaskSourceModule>([
  '改版任务',
  '制版任务',
  '花型任务',
  '首版样衣打样',
  '首单样衣打样',
])

const matched = listProjects()
  .map((project) => ({
    project,
    relations: listProjectRelationsByProject(project.projectId)
      .filter((relation) => professionalModules.has(relation.sourceModule as ProjectRelationTaskSourceModule)),
  }))
  .find(({ relations }) => new Set(relations.map((relation) => relation.sourceModule)).size >= 2)

assert.ok(matched, '演示数据应至少存在一个关联多类专业任务的商品项目')

const html = await renderPcsProjectDetailPage(matched.project.projectId)

for (const relation of matched.relations) {
  assert.match(html, new RegExp(relation.sourceObjectCode), `项目详情必须展示${relation.sourceModule}编号`)
  assert.match(html, new RegExp(relation.sourceStatus), `项目详情必须展示${relation.sourceModule}状态`)
}

assert.match(html, /关联工程任务/, '项目详情应以独立摘要展示项目级专业任务关系')
assert.match(html, /任务类型/, '项目详情应明确展示任务类型')
assert.match(html, /任务编号/, '项目详情应明确展示任务编号')
assert.match(html, /来源/, '项目详情应明确展示任务来源')
assert.match(html, /打开任务/, '项目详情应提供专业任务详情入口')

console.log('pcs-project-professional-relations-detail.spec.ts PASS')
