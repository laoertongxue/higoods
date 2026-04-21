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
          updatedAt: '2026-04-20 11:00',
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
          updatedAt: '2026-04-20 11:05',
        }
      }
      return item
    }),
  })

  return { project: created.project, projectId }
}

const { project, projectId } = prepareProject('款式档案主图继承上架图片项目')

const [listingImage] = createProjectImageAssetRecords(
  project,
  [
    {
      imageUrl: 'mock://listing-priority-main-image',
      imageName: '优先上架主图',
      imageType: '上架图',
      sourceNodeCode: 'CHANNEL_PRODUCT_LISTING',
      sourceRecordId: 'listing_batch_demo',
      sourceType: '商品上架',
      usageScopes: ['商品上架', '项目资料归档'],
      imageStatus: '可用于上架',
      mainFlag: true,
      sortNo: 1,
    },
  ],
  '测试用户',
)
upsertProjectImageAssets([listingImage])

const result = generateStyleArchiveFromProjectNode(projectId, '测试用户', {
  styleMainImageId: listingImage.imageId,
  styleGalleryImageIds: [],
})

assert.equal(result.ok, true, '只选择主图时也应能生成款式档案')
assert.equal(result.style?.mainImageId, listingImage.imageId, '主图应继承所选上架图资产')
assert.deepEqual(result.style?.galleryImageIds, [listingImage.imageId], '仅选择主图时图册应默认包含主图')
assert.equal(result.style?.imageSource, '商品上架图片', '仅选上架图时图片来源应明确为商品上架图片')

console.log('pcs-style-archive-image-inherit-listing.spec.ts PASS')
