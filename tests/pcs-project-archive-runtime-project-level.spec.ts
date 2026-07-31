import assert from 'node:assert/strict'

import {
  listProjectArchiveDocumentsByArchiveId,
  resetProjectArchiveRepository,
} from '../src/data/pcs-project-archive-repository.ts'
import {
  createProjectArchive,
  syncExistingProjectArchiveByProjectId,
  uploadProjectArchiveManualDocument,
} from '../src/data/pcs-project-archive-sync.ts'
import {
  listProjectRelationsByProject,
  resetProjectRelationRepository,
} from '../src/data/pcs-project-relation-repository.ts'
import { listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetProjectArchiveRepository()

const project = listProjects().find((item) => Boolean(item.linkedStyleId))
assert.ok(project, '必须存在已关联款式档案的商品项目')
const createResult = createProjectArchive(project!.projectId, '测试用户')
assert.equal(createResult.ok, true, createResult.message)
assert.ok(createResult.archive, '必须成功建立项目资料归档')
const archiveId = createResult.archive!.projectArchiveId

syncExistingProjectArchiveByProjectId(project!.projectId, '测试用户')

const archiveRelation = listProjectRelationsByProject(project!.projectId).find(
  (item) => item.sourceModule === '项目资料归档',
)
assert.ok(archiveRelation, '运行时同步后必须存在项目资料归档关系')
assert.equal(archiveRelation.projectNodeId, null, '运行时归档关系必须保持项目级')
assert.equal(archiveRelation.stepCode, '')
assert.equal(archiveRelation.stepName, '')

uploadProjectArchiveManualDocument(
  archiveId,
  {
    documentGroup: 'OTHER_FILE',
    title: '项目级手工资料',
    note: '',
    files: [{ fileName: '项目级资料.pdf', fileType: 'PDF' }],
  },
  '测试用户',
)
const manualDocument = listProjectArchiveDocumentsByArchiveId(archiveId).find(
  (item) => item.documentTitle === '项目级手工资料',
)
assert.ok(manualDocument, '应保存手工资料')
assert.equal(manualDocument.projectNodeId, '', '手工资料不得绑定 PROJECT_INIT')
assert.equal(manualDocument.stepCode, '')
assert.equal(manualDocument.stepName, '')

console.log('pcs-project-archive-runtime-project-level.spec.ts PASS')
