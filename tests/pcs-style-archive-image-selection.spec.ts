import assert from 'node:assert/strict'

import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  getProjectNodeRecordByWorkItemTypeCode,
  getProjectStoreSnapshot,
  listActiveProjectTemplates,
  listProjectNodes,
  replaceProjectStore,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'
import {
  createProjectImageAssetRecords,
  resetProjectImageAssets,
  upsertProjectImageAssets,
} from '../src/data/pcs-project-image-repository.ts'
import { listStyleArchiveImageCandidates } from '../src/data/pcs-style-archive-image-selection.ts'
import { generateStyleArchiveFromProjectNode } from '../src/data/pcs-project-style-archive-generation.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'

function prepareProject(projectName: string) {
  resetProjectRepository()
  resetStyleArchiveRepository()
  resetProjectRelationRepository()
  resetProjectChannelProductRepository()
  resetProjectImageAssets()

  const catalog = getProjectCreateCatalog()
  const template = listActiveProjectTemplates()[0]
  const category = catalog.categories[0]
  const subCategory = category?.children[0]
  const brand = catalog.brands[0]
  const styleCode = catalog.styleCodes[0] || catalog.styles[0]
  const owner = catalog.owners[0]
  const team = catalog.teams[0]
  const channel = catalog.channelOptions[0]

  assert.ok(template && category && brand && styleCode && owner && team && channel)

  const created = createProject(
    {
      ...createEmptyProjectDraft(),
      projectName,
      projectType: '商品开发',
      projectSourceType: '企划提案',
      templateId: template.id,
      categoryId: category.id,
      categoryName: category.name,
      subCategoryId: subCategory?.id || '',
      subCategoryName: subCategory?.name || '',
      brandId: brand.id,
      brandName: brand.name,
      styleCodeId: styleCode.id,
      styleCodeName: styleCode.name,
      styleType: '基础款',
      priceRangeLabel: '¥199-399',
      targetChannelCodes: [channel.code],
      ownerId: owner.id,
      ownerName: owner.name,
      teamId: team.id,
      teamName: team.name,
    },
    '测试用户',
  )

  const projectId = created.project.projectId
  const styleNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'STYLE_ARCHIVE_CREATE')
  const conclusionNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'TEST_CONCLUSION')
  const orderedNodes = listProjectNodes(projectId)
  const styleNodeIndex = orderedNodes.findIndex((item) => item.projectNodeId === styleNode?.projectNodeId)

  assert.ok(styleNode && conclusionNode)
  assert.ok(styleNodeIndex >= 0)

  const snapshot = getProjectStoreSnapshot()
  replaceProjectStore({
    ...snapshot,
    nodes: snapshot.nodes.map((item) => {
      if (item.projectId !== projectId) return item
      const nodeOrder = orderedNodes.findIndex((candidate) => candidate.projectNodeId === item.projectNodeId)
      if (nodeOrder >= 0 && nodeOrder < styleNodeIndex) {
        return {
          ...item,
          currentStatus: '已完成',
          latestResultType: item.projectNodeId === conclusionNode.projectNodeId ? '测款通过' : '已完成',
          latestResultText:
            item.projectNodeId === conclusionNode.projectNodeId
              ? '测款通过，可进入款式档案开发阶段。'
              : `${item.workItemTypeName}已完成。`,
          pendingActionType: '',
          pendingActionText: '',
          updatedAt: '2026-04-20 10:00',
        }
      }
      if (item.projectNodeId === styleNode.projectNodeId) {
        return {
          ...item,
          currentStatus: '进行中',
          latestResultType: '等待生成款式档案',
          latestResultText: '测款通过，待生成款式档案。',
          pendingActionType: '生成款式档案',
          pendingActionText: '请先确认档案主图和图册。',
          updatedAt: '2026-04-20 10:05',
        }
      }
      return item
    }),
  })

  return { project: created.project, projectId }
}

const { project, projectId } = prepareProject('款式档案图片候选验证项目')

const [listingImage, sampleImage, referenceImage] = createProjectImageAssetRecords(
  project,
  [
    {
      imageUrl: 'mock://listing-main-image',
      imageName: '商品上架主图',
      imageType: '上架图',
      sourceNodeCode: 'CHANNEL_PRODUCT_LISTING',
      sourceRecordId: 'listing_batch_demo',
      sourceType: '商品上架',
      usageScopes: ['商品上架', '项目资料归档'],
      imageStatus: '可用于上架',
      mainFlag: true,
      sortNo: 1,
    },
    {
      imageUrl: 'mock://sample-style-image',
      imageName: '样衣候选图',
      imageType: '试穿图',
      sourceNodeCode: 'SAMPLE_SHOOT_FIT',
      sourceRecordId: 'sample_record_demo',
      sourceType: '样衣拍摄与试穿',
      usageScopes: ['样衣评估', '款式档案'],
      imageStatus: '可用于款式档案',
      mainFlag: false,
      sortNo: 2,
    },
    {
      imageUrl: 'mock://reference-image',
      imageName: '项目参考图',
      imageType: '项目参考图',
      sourceNodeCode: 'PROJECT_INIT',
      sourceRecordId: 'project_init_demo',
      sourceType: '商品项目立项',
      usageScopes: ['立项参考', '项目资料归档'],
      imageStatus: '待确认',
      mainFlag: false,
      sortNo: 3,
    },
  ],
  '测试用户',
)
upsertProjectImageAssets([listingImage, sampleImage, referenceImage])

const candidates = listStyleArchiveImageCandidates(projectId)
assert.equal(candidates[0]?.imageId, listingImage.imageId, '第一优先候选应为商品上架图片')
assert.equal(candidates[1]?.imageId, sampleImage.imageId, '第二优先候选应为样衣拍摄中可用于款式档案的图片')
assert.equal(candidates[2]?.imageId, referenceImage.imageId, '第三优先候选应为项目参考图')
assert.equal(candidates[2]?.requiresConfirmation, true, '项目参考图应要求人工确认后使用')

const result = generateStyleArchiveFromProjectNode(projectId, '测试用户', {
  styleMainImageId: listingImage.imageId,
  styleGalleryImageIds: [listingImage.imageId, sampleImage.imageId],
})

assert.equal(result.ok, true, '应能按候选图生成款式档案')
assert.equal(result.style?.mainImageId, listingImage.imageId, '主图应写入所选上架图资产')
assert.deepEqual(result.style?.galleryImageIds, [listingImage.imageId, sampleImage.imageId], '图册应写入所选图片资产')
assert.equal(result.style?.mainImageUrl, listingImage.imageUrl, '主图 URL 应来自所选上架图')
assert.ok(result.style?.imageSource.includes('商品上架图片'), '图片来源应包含商品上架图片')
assert.ok(result.style?.imageSource.includes('样衣拍摄图片'), '图片来源应包含样衣拍摄图片')

console.log('pcs-style-archive-image-selection.spec.ts PASS')
