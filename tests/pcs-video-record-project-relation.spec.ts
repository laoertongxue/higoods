import assert from 'node:assert/strict'
import { createEmptyProjectDraft, createProject, findProjectNodeByWorkItemTypeCode, getProjectCreateCatalog, listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import {
  clearProjectRelationStore,
  listProjectRelationsByVideoRecord,
  replaceVideoRecordProjectRelations,
  resetProjectRelationRepository,
  unlinkVideoRecordProjectRelation,
} from '../src/data/pcs-project-relation-repository.ts'
import { getVideoTestRecordById, resetVideoTestingRepository } from '../src/data/pcs-video-testing-repository.ts'
import {
  createAndLaunchChannelProductForProject,
  createProjectForBusinessChain,
  prepareProjectWithLaunchedChannelProduct,
  resetProjectBusinessChainRepositories,
} from './pcs-project-formal-chain-helper.ts'

function buildDraftForTemplate(templateId: string) {
  const catalog = getProjectCreateCatalog()
  const category = catalog.categories[0]!
  const owner = catalog.owners[0]!
  const team = catalog.teams[0]!
  const brand = catalog.brands[0]!
  const draft = createEmptyProjectDraft()
  draft.projectName = `测试项目-${templateId}`
  draft.projectType = catalog.projectTypes[0]!
  draft.projectSourceType = catalog.projectSourceTypes[0]!
  draft.templateId = templateId
  draft.categoryId = category.id
  draft.categoryName = category.name
  draft.subCategoryId = category.children[0]?.id ?? ''
  draft.subCategoryName = category.children[0]?.name ?? ''
  draft.brandId = brand.id
  draft.brandName = brand.name
  draft.targetChannelCodes = ['tiktok-shop']
  draft.ownerId = owner.id
  draft.ownerName = owner.name
  draft.teamId = team.id
  draft.teamName = team.name
  draft.sampleSourceType = '自打样'
  return draft
}

resetProjectRepository()
resetVideoTestingRepository()
resetProjectRelationRepository()
const record = getVideoTestRecordById('SV-20260122-008')
assert.ok(record, '应存在可用于验证的短视频记录')

clearProjectRelationStore()
const launchedProjectA = prepareProjectWithLaunchedChannelProduct('短视频测款正式关联项目甲')
const videoProjectB = createProjectForBusinessChain('短视频测款正式关联项目乙')
assert.ok(findProjectNodeByWorkItemTypeCode(videoProjectB.projectId, 'VIDEO_TEST'), '测试项目乙应存在短视频测款节点')
createAndLaunchChannelProductForProject(videoProjectB.projectId)

const replaceResult = replaceVideoRecordProjectRelations(record!.videoRecordId, [
  launchedProjectA.projectId,
  videoProjectB.projectId,
])
assert.equal(replaceResult.errors.length, 0, '短视频记录关联有效项目时不应报错')
assert.equal(replaceResult.relations.length, 2, '一条短视频记录应允许关联多个商品项目')
assert.ok(
  replaceResult.relations.every(
    (item) =>
      item.workItemTypeCode === 'VIDEO_TEST' &&
      item.sourceObjectType === '短视频记录' &&
      item.sourceLineId === null,
  ),
  '短视频记录写入正式关系时，目标节点必须固定为 VIDEO_TEST',
)

const duplicated = replaceVideoRecordProjectRelations(record!.videoRecordId, [launchedProjectA.projectId, launchedProjectA.projectId])
assert.equal(duplicated.relations.length, 1, '同一条短视频记录重复关联同一个项目时，只保留一条正式关系记录')

unlinkVideoRecordProjectRelation(record!.videoRecordId, launchedProjectA.projectId)
assert.equal(listProjectRelationsByVideoRecord(record!.videoRecordId).length, 0, '解除短视频记录与项目关系后，正式关系应同步消失')

const projectWithoutVideoNode = createProject(buildDraftForTemplate('TPL-003')).project
assert.ok(!findProjectNodeByWorkItemTypeCode(projectWithoutVideoNode.projectId, 'VIDEO_TEST'), 'TPL-003 创建的项目不应存在 VIDEO_TEST 节点')

const missingNodeResult = replaceVideoRecordProjectRelations(record!.videoRecordId, [projectWithoutVideoNode.projectId])
assert.equal(missingNodeResult.relations.length, 0, '项目缺少 VIDEO_TEST 节点时不得写入正式关系')
assert.ok(
  missingNodeResult.errors.includes('当前项目未配置对应测款工作项，请先检查项目模板与项目节点。'),
  '项目存在但缺少对应节点时应给出明确提示',
)
assert.equal(missingNodeResult.pendingItems.length, 1, '项目存在但缺少对应节点时应进入待补齐清单')

resetProjectBusinessChainRepositories()
const blockedProject = createProjectForBusinessChain('未完成商品上架短视频门禁项目')
const blockedResult = replaceVideoRecordProjectRelations(record!.videoRecordId, [blockedProject.projectId])
assert.equal(blockedResult.relations.length, 0, '未完成商品上架的项目不得建立正式短视频测款关系')
assert.ok(
  blockedResult.errors.includes('当前项目未完成商品上架，不能建立正式短视频测款关系。'),
  '仓储层应返回明确的短视频测款门禁原因',
)
assert.equal(blockedResult.pendingItems.length, 1, '被门禁拦住的短视频测款关系应进入待处理清单')

console.log('pcs-video-record-project-relation.spec.ts PASS')
