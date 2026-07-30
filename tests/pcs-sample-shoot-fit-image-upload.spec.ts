import assert from 'node:assert/strict'

import { approveProjectInitAndSync, saveProjectNodeFormalRecord } from '../src/data/pcs-project-flow-service.ts'
import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  getProjectNodeRecordByStepCode,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { resetProjectImageAssets } from '../src/data/pcs-project-image-repository.ts'
import { appendSampleShootImages, listSampleShootImageAssets } from '../src/data/pcs-sample-shoot-image-service.ts'
import { renderPcsProjectStepDetailPage } from '../src/pages/pcs-projects.ts'

function buildProjectDraft() {
  const draft = createEmptyProjectDraft()
  const catalog = getProjectCreateCatalog()
  const category = catalog.categories[0]
  const subCategory = category.children[0]
  const brand = catalog.brands[0]
  const styleCode = catalog.styleCodes[0]
  const owner = catalog.owners[0]
  const team = catalog.teams[0]

  draft.projectName = '样衣拍摄图片上传测试项目'
  draft.projectSourceType = catalog.projectSourceTypes[0]
  draft.categoryId = category.id
  draft.categoryName = category.name
  draft.subCategoryId = subCategory?.id || ''
  draft.subCategoryName = subCategory?.name || ''
  draft.brandId = brand.id
  draft.brandName = brand.name
  draft.styleCodeId = styleCode.id
  draft.styleCodeName = styleCode.name
  draft.styleNumber = styleCode.name
  draft.styleType = '基础款'
  draft.yearTag = catalog.yearTags[0]
  draft.priceRangeLabel = catalog.priceRanges[0]
  draft.targetChannelCodes = ['tiktok']
  draft.ownerId = owner.id
  draft.ownerName = owner.name
  draft.teamId = team.id
  draft.teamName = team.name
  return draft
}

function saveNode(projectId: string, stepCode: string, values: Record<string, unknown>) {
  const node = getProjectNodeRecordByStepCode(projectId, stepCode)
  assert.ok(node, `应存在节点 ${stepCode}`)
  const result = saveProjectNodeFormalRecord({
    projectId,
    projectNodeId: node!.projectNodeId,
    payload: {
      businessDate: '2026-04-20 10:00',
      values,
    },
    completeAfterSave: true,
    operatorName: '测试用户',
  })
  assert.ok(result.ok, `${stepCode} 应可完成`)
}

function advanceToSampleShoot(projectId: string) {
  saveNode(projectId, 'SAMPLE_ACQUIRE', {
    sampleSourceType: '外采',
    sampleSupplierId: 'supplier-demo',
    sampleLink: 'https://example.com/sample',
    sampleUnitPrice: '99',
  })
  saveNode(projectId, 'SAMPLE_INBOUND_CHECK', {
    sampleInboundLines: JSON.stringify([
      { colorName: '黑色', sizeName: 'M', plannedQty: 1, receivedQty: 1 },
    ]),
    receivedQty: 1,
    receivedAt: '2026-04-20 11:00',
    qualityCheckResult: '到样完整',
    checkResult: '已完成核对',
  })
  const reviewNode = getProjectNodeRecordByStepCode(projectId, 'FEASIBILITY_REVIEW')
  if (reviewNode) {
    saveNode(projectId, 'FEASIBILITY_REVIEW', {
      reviewConclusion: '进入测款',
      reviewRisk: '可继续进入样衣拍摄与试穿。',
    })
  }
}

resetProjectRepository()
resetProjectInlineNodeRecordRepository()
resetProjectImageAssets()

const created = createProject(buildProjectDraft(), '测试用户')
const projectId = created.project.projectId

const approveResult = approveProjectInitAndSync(projectId, '测试用户')
assert.ok(approveResult.ok, '应能完成商品项目立项审核')
advanceToSampleShoot(projectId)

const flatImages = appendSampleShootImages(projectId, 'sampleFlatImageIds', ['data:image/png;base64,flat-1'], '测试用户')
const tryOnImages = appendSampleShootImages(projectId, 'sampleTryOnImageIds', ['data:image/png;base64,try-1'], '测试用户')
const detailImages = appendSampleShootImages(projectId, 'sampleDetailImageIds', ['data:image/png;base64,detail-1'], '测试用户')

assert.equal(listSampleShootImageAssets(projectId).length, 3, '样衣拍摄图片应写入项目图片资产池')
assert.deepEqual(
  listSampleShootImageAssets(projectId).map((item) => item.imageType),
  ['样衣平铺图', '试穿图', '细节图'],
  '样衣拍摄图片类型应按分组写入',
)

const sampleShootNode = getProjectNodeRecordByStepCode(projectId, 'SAMPLE_SHOOT_FIT')
assert.ok(sampleShootNode, '应存在样衣拍摄与试穿节点')

const saveResult = saveProjectNodeFormalRecord({
  projectId,
  projectNodeId: sampleShootNode!.projectNodeId,
  payload: {
    businessDate: '2026-04-20 13:00',
    values: {
      shootPlan: '安排一轮棚拍和一轮试穿拍摄。',
      fitFeedback: '试穿效果自然，可进入后续节点。',
      sampleFlatImageIds: flatImages.map((item) => item.imageId),
      sampleTryOnImageIds: tryOnImages.map((item) => item.imageId),
      sampleDetailImageIds: detailImages.map((item) => item.imageId),
      sampleVideoUrls: ['mock://sample-video/001'],
      shootImageNote: '已补齐本次样衣拍摄图片。',
      listingCandidateImageIds: [],
      styleArchiveCandidateImageIds: [],
    },
  },
  completeAfterSave: true,
  operatorName: '测试用户',
})

assert.ok(saveResult.ok, '样衣拍摄与试穿应可保存并完成')

const html = await renderPcsProjectStepDetailPage(projectId, sampleShootNode!.projectNodeId)
assert.match(html, /样衣平铺图/, '已完成工作项应展示样衣平铺图分组')
assert.match(html, /试穿图/, '已完成工作项应展示试穿图分组')
assert.match(html, /细节图/, '已完成工作项应展示细节图分组')
assert.match(html, /open-image-preview/, '已完成工作项应支持图片预览')

console.log('pcs-sample-shoot-fit-image-upload.spec.ts PASS')
