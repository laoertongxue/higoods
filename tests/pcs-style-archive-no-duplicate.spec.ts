import assert from 'node:assert/strict'
import { generateStyleArchiveShellFromProject } from '../src/data/pcs-project-style-archive-writeback.ts'
import {
  findStyleArchiveByProjectId,
  listStyleArchivePendingItems,
  listStyleArchives,
} from '../src/data/pcs-style-archive-repository.ts'
import { prepareProjectWithPassedTesting } from './pcs-project-formal-chain-helper.ts'

const project = prepareProjectWithPassedTesting('款式档案唯一性测试项目')

const beforeCount = listStyleArchives().length
const first = generateStyleArchiveShellFromProject(project.projectId, '测试用户')
assert.ok(first.ok && first.style, '首次生成应成功')
const second = generateStyleArchiveShellFromProject(project.projectId, '测试用户')
assert.equal(second.ok, true, '已生成过的项目再次发起应返回已有记录')
assert.equal(second.existed, true, '重复发起不应再次创建新壳记录')
assert.equal(listStyleArchives().length, beforeCount + 1, '同一项目不应重复生成第二个壳记录')
assert.equal(findStyleArchiveByProjectId(project.projectId)?.styleId, first.style!.styleId, '项目到款式档案的主关联应保持唯一')

const legacyOnlyPending = listStyleArchivePendingItems().every((item) => !item.reason.includes('自动创建假项目'))
assert.equal(legacyOnlyPending, true, '历史 originProject 只应保留迁移痕迹，不应误写正式项目主关联')

console.log('pcs-style-archive-no-duplicate.spec.ts PASS')
