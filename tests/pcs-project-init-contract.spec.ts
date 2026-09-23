import assert from 'node:assert/strict'

import {
  getProjectConfigSourceMapping,
  listProjectStepFieldDefinitions,
} from '../src/data/pcs-project-domain-contract.ts'
import {
  createEmptyProjectDraft,
  listProjectNodes,
  listProjects,
} from '../src/data/pcs-project-repository.ts'

const draftKeys = Object.keys(createEmptyProjectDraft()).sort()
const projectInitFieldKeys = listProjectStepFieldDefinitions('PROJECT_INIT').map((field) => field.fieldKey)
const uniqueFieldKeys = Array.from(new Set(projectInitFieldKeys)).sort()

assert.equal(projectInitFieldKeys.length, draftKeys.length, 'PROJECT_INIT 字段总数应与项目创建草稿一致')
assert.equal(uniqueFieldKeys.length, draftKeys.length, 'PROJECT_INIT 不应出现重复字段定义')
assert.deepEqual(uniqueFieldKeys, draftKeys, 'PROJECT_INIT 正式字段应完整覆盖创建草稿全部字段')

const missingMappings = draftKeys.filter((fieldKey) => !getProjectConfigSourceMapping(fieldKey))
assert.deepEqual(missingMappings, [], 'PROJECT_INIT 全部字段都应具备来源映射')

const project = listProjects()[0]
assert.ok(project, '应存在商品项目演示数据')

const projectInitNode = listProjectNodes(project.projectId).find((node) => node.stepCode === 'PROJECT_INIT')
assert.ok(projectInitNode, '演示项目应包含 PROJECT_INIT 节点')

console.log('pcs-project-init-contract.spec.ts PASS')
