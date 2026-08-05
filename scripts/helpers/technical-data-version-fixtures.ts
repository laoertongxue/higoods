import {
  createEngineeringMasterOrder,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
} from '../../src/data/pcs-engineering-master-repository.ts'
import { createStyleArchiveShell, getStyleArchiveById } from '../../src/data/pcs-style-archive-repository.ts'
import {
  createTechnicalDataVersionDraft,
  getTechnicalDataVersionStoreSnapshot,
  pushTechnicalDataVersionPendingItem,
  resetTechnicalDataVersionRepository,
} from '../../src/data/pcs-technical-data-version-repository.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionPendingItem,
  TechnicalDataVersionRecord,
  TechnicalDataVersionStoreSnapshot,
} from '../../src/data/pcs-technical-data-version-types.ts'

function ensureFixtureStyle(record: TechnicalDataVersionRecord): void {
  if (getStyleArchiveById(record.styleId)) return
  const fixtureProjectId = `fixture_project_${record.styleId}`
  createStyleArchiveShell({
    styleId: record.styleId,
    styleCode: record.styleCode,
    styleName: record.styleName,
    styleNameEn: '',
    styleNumber: record.styleCode,
    productType: '检查款式',
    sourceProjectId: fixtureProjectId,
    sourceProjectCode: fixtureProjectId,
    sourceProjectName: record.styleName,
    sourceProjectNodeId: `fixture_node_${record.styleId}`,
    categoryId: 'fixture-category',
    categoryName: '检查分类',
    subCategoryId: '',
    subCategoryName: '',
    brandId: 'fixture-brand',
    brandName: '检查品牌',
    yearTag: '2026',
    seasonTags: [],
    styleTags: [],
    targetAudienceTags: [],
    targetChannelCodes: ['tiktok'],
    priceRangeLabel: '¥100-199',
    archiveStatus: 'DRAFT',
    baseInfoStatus: '待完善',
    specificationStatus: '待完善',
    techPackStatus: '草稿中',
    costPricingStatus: '待维护',
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
    mainImageId: '',
    mainImageUrl: '',
    galleryImageIds: [],
    galleryImageUrls: [],
    imageSource: '检查脚本',
    sellingPointText: '',
    detailDescription: '',
    packagingInfo: '',
    remark: '',
    generatedAt: record.createdAt,
    generatedBy: '检查脚本',
    updatedAt: record.updatedAt,
    updatedBy: '检查脚本',
    legacyOriginProject: '',
  })
}

export function installTechnicalDataVersionFixtures(input: {
  version?: number
  records: TechnicalDataVersionRecord[]
  contents: TechnicalDataVersionContent[]
  pendingItems?: TechnicalDataVersionPendingItem[]
}): TechnicalDataVersionStoreSnapshot {
  resetEngineeringMasterRepository()
  resetTechnicalDataVersionRepository()
  const contentByVersionId = new Map(input.contents.map((content) => [content.technicalVersionId, content]))
  const sourceByStyleId = new Map<string, ReturnType<typeof publishEngineeringMasterOrder>>()

  input.records.forEach((record) => {
    ensureFixtureStyle(record)
    let master = sourceByStyleId.get(record.styleId)
    if (!master) {
      master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
        styleId: record.styleId,
        styleCode: record.styleCode,
        merchandiserId: 'CHECK-MERCHANDISER',
        merchandiserName: record.updatedBy || '检查脚本',
        createdById: 'CHECK-SYSTEM',
        createdBy: '检查脚本',
        createdByRole: '系统',
        creationMode: 'SYSTEM',
        preparationType: 'PURE_WOVEN',
        qualificationFact: {
          styleCode: record.styleCode,
          formalSaleStatus: 'NO_FORMAL_SALE',
          formalProductionStatus: 'NO_FORMAL_PRODUCTION',
          formalSaleSource: '专项检查固定事实',
          formalProductionSource: '专项检查固定事实',
          checkedAt: record.createdAt,
        },
        bulkProductionQualification: {
          basisType: 'TEST_APPROVED',
          triggerBusinessObjectType: '专项检查',
          triggerBusinessObjectId: `CHECK-${record.styleId}`,
          thresholdQuantity: 1,
          reachedQuantity: 1,
          reachedAt: record.createdAt,
          reason: '专项检查构造技术包来源',
          uniqueTriggerKey: `TECHNICAL-VERSION-FIXTURE-${record.styleId}`,
        },
        creationReason: '专项检查构造技术包来源',
      }).masterOrderId)
      sourceByStyleId.set(record.styleId, master)
    }
    const sourceTaskId = `${master.masterOrderId}-TECH_PACK_CONFIRMATION`
    createTechnicalDataVersionDraft({
      ...record,
      sourceProjectId: master.masterOrderId,
      sourceProjectCode: master.masterOrderCode,
      sourceProjectName: master.styleName,
      createdFromTaskType: 'ENGINEERING_MASTER',
      createdFromTaskId: sourceTaskId,
      createdFromTaskCode: sourceTaskId,
    }, contentByVersionId.get(record.technicalVersionId))
  })
  input.pendingItems?.forEach(pushTechnicalDataVersionPendingItem)
  return getTechnicalDataVersionStoreSnapshot()
}
