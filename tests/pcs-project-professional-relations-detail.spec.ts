import assert from 'node:assert/strict'

import { listProjectRelationsByProject, resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import type { ProjectRelationTaskSourceModule } from '../src/data/pcs-project-relation-types.ts'

resetProjectRepository()
resetProjectRelationRepository()

const professionalModules = new Set<ProjectRelationTaskSourceModule>([
  '设计改款任务',
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

console.log('pcs-project-professional-relations-detail.spec.ts PASS')
