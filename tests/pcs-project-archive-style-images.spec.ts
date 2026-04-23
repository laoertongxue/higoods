import assert from 'node:assert/strict'

import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  listActiveProjectTemplates,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  createProjectImageAssetRecords,
  resetProjectImageAssets,
  upsertProjectImageAssets,
} from '../src/data/pcs-project-image-repository.ts'
import { createStyleArchiveShell, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { collectProjectArchiveAutoData } from '../src/data/pcs-project-archive-collector.ts'
import type { ProjectArchiveRecord } from '../src/data/pcs-project-archive-types.ts'

resetProjectRepository()
resetProjectImageAssets()
resetStyleArchiveRepository()

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
    projectName: '项目归档采集款式图片项目',
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

const [mainImage, galleryImage] = createProjectImageAssetRecords(
  created.project,
  [
    {
      imageUrl: 'mock://style-archive-main-file',
      imageName: '档案主图',
      imageType: '款式档案图',
      sourceNodeCode: 'STYLE_ARCHIVE_CREATE',
      sourceRecordId: 'style_create_demo',
      sourceType: '生成款式档案',
      usageScopes: ['款式档案', '项目资料归档'],
      imageStatus: '可用于款式档案',
      mainFlag: true,
      sortNo: 1,
    },
    {
      imageUrl: 'mock://style-archive-gallery-file',
      imageName: '档案图册图',
      imageType: '款式档案图',
      sourceNodeCode: 'STYLE_ARCHIVE_CREATE',
      sourceRecordId: 'style_create_demo',
      sourceType: '生成款式档案',
      usageScopes: ['款式档案', '项目资料归档'],
      imageStatus: '可用于款式档案',
      mainFlag: false,
      sortNo: 2,
    },
  ],
  '测试用户',
)
upsertProjectImageAssets([mainImage, galleryImage])

const style = createStyleArchiveShell({
  styleId: 'style_archive_collect_demo',
  styleCode: 'SPU-20260420-001',
  styleName: '项目归档采集款式图片',
  styleNameEn: '',
  styleNumber: 'STYLE-20260420-001',
  styleType: '基础款',
  sourceProjectId: created.project.projectId,
  sourceProjectCode: created.project.projectCode,
  sourceProjectName: created.project.projectName,
  sourceProjectNodeId: '',
  categoryId: created.project.categoryId,
  categoryName: created.project.categoryName,
  subCategoryId: created.project.subCategoryId,
  subCategoryName: created.project.subCategoryName,
  brandId: created.project.brandId,
  brandName: created.project.brandName,
  yearTag: created.project.yearTag,
  seasonTags: [...created.project.seasonTags],
  styleTags: [...created.project.styleTags],
  targetAudienceTags: [...created.project.targetAudienceTags],
  targetChannelCodes: [...created.project.targetChannelCodes],
  priceRangeLabel: created.project.priceRangeLabel,
  archiveStatus: 'DRAFT',
  baseInfoStatus: '待完善',
  specificationStatus: '未建立',
  techPackStatus: '未建立',
  costPricingStatus: '未建立',
  specificationCount: 0,
  techPackVersionCount: 0,
  costVersionCount: 0,
  channelProductCount: 0,
  currentTechPackVersionId: '',
  currentTechPackVersionCode: '',
  currentTechPackVersionLabel: '',
  currentTechPackVersionStatus: '',
  currentTechPackVersionActivatedAt: '',
  currentTechPackVersionActivatedBy: '',
  mainImageId: mainImage.imageId,
  mainImageUrl: mainImage.imageUrl,
  galleryImageIds: [mainImage.imageId, galleryImage.imageId],
  galleryImageUrls: [mainImage.imageUrl, galleryImage.imageUrl],
  imageSource: '商品上架图片、档案补充图',
  sellingPointText: '',
  detailDescription: '',
  packagingInfo: '',
  remark: '',
  generatedAt: '2026-04-20 13:00',
  generatedBy: '测试用户',
  updatedAt: '2026-04-20 13:00',
  updatedBy: '测试用户',
  legacyOriginProject: '',
})

const archive: ProjectArchiveRecord = {
  projectArchiveId: 'archive_demo_001',
  archiveNo: 'AR-20260420-001',
  projectId: created.project.projectId,
  projectCode: created.project.projectCode,
  projectName: created.project.projectName,
  styleId: style.styleId,
  styleCode: style.styleCode,
  styleName: style.styleName,
  currentTechnicalVersionId: '',
  currentTechnicalVersionCode: '',
  currentTechnicalVersionLabel: '',
  currentPatternAssetIds: [],
  currentPatternAssetCodes: [],
  currentPatternAssetCount: 0,
  currentTechPackLogCount: 0,
  closureSnapshotAt: '2026-04-20 13:00',
  closureSnapshotBy: '测试用户',
  archiveStatus: 'COLLECTING',
  documentCount: 0,
  fileCount: 0,
  autoCollectedCount: 0,
  manualUploadedCount: 0,
  missingItemCount: 0,
  readyForFinalize: false,
  createdAt: '2026-04-20 13:00',
  createdBy: '测试用户',
  updatedAt: '2026-04-20 13:00',
  updatedBy: '测试用户',
  finalizedAt: '',
  finalizedBy: '',
  note: '',
}

const collected = collectProjectArchiveAutoData(archive, created.project, style)
const styleDocument = collected.documents.find((item) => item.documentGroup === 'STYLE_ARCHIVE')

assert.ok(styleDocument, '项目资料归档应采集款式档案资料')
assert.equal(styleDocument?.fileCount, 2, '款式档案资料应采集主图和图册文件')
assert.equal(styleDocument?.primaryFileName, '档案主图', '主文件应对应款式档案主图')
assert.ok(collected.files.some((item) => item.previewUrl === mainImage.imageUrl), '归档文件中应包含款式档案主图')
assert.ok(collected.files.some((item) => item.previewUrl === galleryImage.imageUrl), '归档文件中应包含款式档案图册图')

console.log('pcs-project-archive-style-images.spec.ts PASS')
