import assert from 'node:assert/strict'

import {
  approveTechPackReview,
  canEditTechnicalModule,
  canPublishTechnicalVersionByReview,
  getTechnicalReviewPendingRoles,
  getTechnicalReviewStatusText,
  returnTechPackReviewToFirstStage,
  startTechPackReview,
  submitTechPackFirstStageReview,
} from '../src/data/pcs-tech-pack-review.ts'
import {
  getTechnicalDataVersionById,
  replaceTechnicalDataVersionStore,
} from '../src/data/pcs-technical-data-version-repository.ts'
import {
  buildTechnicalVersionDetailViewModel,
  buildTechnicalVersionListByStyle,
} from '../src/data/pcs-technical-data-version-view-model.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-types.ts'

const technicalVersionId = 'tdv_review_domain_001'

const record = {
  technicalVersionId,
  technicalVersionCode: 'TDV-REVIEW-DOMAIN-001',
  versionLabel: 'V1',
  versionNo: 1,
  styleId: 'STYLE-REVIEW-DOMAIN',
  styleCode: 'STYLE-REVIEW-DOMAIN',
  styleName: '审核流验证款',
  sourceProjectId: 'PRJ-REVIEW-DOMAIN',
  sourceProjectCode: 'PRJ-REVIEW-DOMAIN',
  sourceProjectName: '审核流验证项目',
  sourceProjectNodeId: '',
  primaryPlateTaskId: '',
  primaryPlateTaskCode: '',
  primaryPlateTaskVersion: '',
  linkedRevisionTaskIds: [],
  linkedPatternTaskIds: [],
  linkedArtworkTaskIds: [],
  createdFromTaskType: 'MANUAL',
  createdFromTaskId: '',
  createdFromTaskCode: '',
  baseTechnicalVersionId: '',
  baseTechnicalVersionCode: '',
  changeScope: '手动新增',
  changeSummary: '审核流领域验证',
  garmentDifficultyGrade: 'B',
  linkedPartTemplateIds: [],
  linkedPatternLibraryVersionIds: [],
  linkedPatternAssetIds: [],
  linkedPatternAssetCodes: [],
  archiveCollectedFlag: false,
  archiveCollectedAt: '',
  versionStatus: 'DRAFT',
  bomStatus: 'DRAFT',
  patternStatus: 'DRAFT',
  processStatus: 'DRAFT',
  gradingStatus: 'DRAFT',
  qualityStatus: 'DRAFT',
  colorMaterialStatus: 'DRAFT',
  designStatus: 'EMPTY',
  attachmentStatus: 'EMPTY',
  bomItemCount: 1,
  patternFileCount: 1,
  processEntryCount: 1,
  gradingRuleCount: 1,
  qualityRuleCount: 1,
  colorMaterialMappingCount: 1,
  designAssetCount: 0,
  attachmentCount: 0,
  completenessScore: 100,
  missingItemCodes: [],
  missingItemNames: [],
  publishedAt: '',
  publishedBy: '',
  createdAt: '2026-05-25 10:00',
  createdBy: '测试用户',
  updatedAt: '2026-05-25 10:00',
  updatedBy: '测试用户',
  note: '',
  legacySpuCode: '',
  legacyVersionLabel: '',
} satisfies TechnicalDataVersionRecord

const content: TechnicalDataVersionContent = {
  technicalVersionId,
  patternFiles: [
    {
      id: 'pattern-review-1',
      recordKind: 'MATERIAL_ASSOCIATION',
      patternName: '前片纸样',
      fileName: 'front.dxf',
      fileUrl: '#',
      uploadedAt: '2026-05-25 10:00',
      uploadedBy: '版师',
    },
  ],
  patternDesc: '',
  processEntries: [
    {
      id: 'process-review-1',
      entryType: 'CRAFT',
      stageCode: 'PROD',
      stageName: '生产阶段',
      processCode: 'SEW',
      processName: '车缝',
      craftCode: 'SEW_BASE',
      craftName: '基础车缝',
      assignmentGranularity: 'ORDER',
      defaultDocType: 'TASK',
      taskTypeMode: 'CRAFT',
      isSpecialCraft: false,
    },
  ],
  sizeTable: [{ id: 'size-review-1', part: '胸围', S: 90, M: 94, L: 98, XL: 102, tolerance: 1 }],
  bomItems: [
    {
      id: 'bom-review-1',
      type: '面料',
      name: '主面料',
      spec: '100% 棉',
      unitConsumption: 1.2,
      lossRate: 0.03,
      supplier: '供应商甲',
    },
  ],
  qualityRules: [
    {
      id: 'quality-review-1',
      checkItem: '外观',
      standardText: '无明显瑕疵',
      samplingRule: '首件 + 抽检',
      note: '',
    },
  ],
  colorMaterialMappings: [
    {
      id: 'mapping-review-1',
      spuCode: 'STYLE-REVIEW-DOMAIN',
      colorCode: 'BK',
      colorName: '黑色',
      status: 'CONFIRMED',
      generatedMode: 'MANUAL',
      lines: [],
    },
  ],
  patternDesigns: [],
  attachments: [],
  legacyCompatibleCostPayload: {
    materialCostItems: [{ id: 'MC-bom-review-1', bomItemId: 'bom-review-1', price: 12, currency: '人民币', unit: '人民币/件' }],
  },
}

replaceTechnicalDataVersionStore({
  version: 3,
  records: [record],
  contents: [content],
  pendingItems: [],
})

let current = getTechnicalDataVersionById(technicalVersionId)
assert.ok(current, '应能读取技术包版本')
assert.equal(current.reviewStage, '未提交审核', '旧草稿默认应为未提交审核')
assert.equal(getTechnicalReviewStatusText(current), '待提交审核', '未提交审核应给出中文提示')
assert.throws(
  () => startTechPackReview(technicalVersionId, 'BUYER', '买手A'),
  /请先提交技术包审核/,
  '未提交审核前不能直接开始审核',
)

current = submitTechPackFirstStageReview(technicalVersionId, '维护人')
assert.equal(current.reviewStage, '第一阶段并行审核', '提交后进入第一阶段并行审核')
assert.deepEqual(getTechnicalReviewPendingRoles(current), ['买手', '版师'], '第一阶段应同时待买手和版师审核')
assert.equal(canEditTechnicalModule(current, 'BOM'), true, '买手待审核时物料清单可修改')
assert.equal(canEditTechnicalModule(current, 'PATTERN'), true, '版师待审核时纸样管理可修改')
assert.equal(canEditTechnicalModule(current, 'MATERIAL_PATTERN_LINK'), true, '跟单维护的物料&纸样关联可修改')

current = startTechPackReview(technicalVersionId, 'BUYER', '买手A')
assert.equal(current.buyerReview?.status, '审核中', '买手可先开始审核')
assert.equal(canEditTechnicalModule(current, 'BOM'), false, '买手审核中物料清单锁定')
assert.equal(canEditTechnicalModule(current, 'COST'), false, '买手审核中核价锁定')
assert.equal(canEditTechnicalModule(current, 'PATTERN'), true, '买手审核中不锁定版师模块')

current = approveTechPackReview(technicalVersionId, 'BUYER', '物料和核价通过', '买手A')
assert.equal(current.buyerReview?.status, '审核-已通过', '买手可审核通过')
assert.equal(current.reviewStage, '第一阶段并行审核', '只有买手通过时仍停留在第一阶段')
assert.deepEqual(getTechnicalReviewPendingRoles(current), ['版师'], '买手通过后只待版师审核')

current = startTechPackReview(technicalVersionId, 'PATTERN_MAKER', '版师B')
assert.equal(canEditTechnicalModule(current, 'PATTERN'), false, '版师审核中纸样池锁定')
assert.equal(canEditTechnicalModule(current, 'COLOR_MATERIAL_MAPPING'), true, '版师审核中不锁定跟单维护的款色用料对应')
assert.equal(canEditTechnicalModule(current, 'MATERIAL_PATTERN_LINK'), true, '版师审核中不锁定跟单维护的物料&纸样关联')
current = approveTechPackReview(technicalVersionId, 'PATTERN_MAKER', '纸样池通过', '版师B')
assert.equal(current.reviewStage, '跟单复核', '买手和版师都通过后进入跟单复核')
assert.deepEqual(getTechnicalReviewPendingRoles(current), ['跟单'], '第一阶段通过后待跟单复核')

current = startTechPackReview(technicalVersionId, 'MERCHANDISER', '跟单C')
assert.equal(current.merchandiserReview?.status, '审核中', '跟单可开始整体复核')
assert.equal(canEditTechnicalModule(current, 'BOM'), false, '跟单审核中物料清单锁定')
assert.equal(canEditTechnicalModule(current, 'PROCESS'), false, '跟单审核中剩余模块锁定')
assert.equal(canEditTechnicalModule(current, 'MATERIAL_PATTERN_LINK'), false, '跟单审核中物料&纸样关联锁定')

current = returnTechPackReviewToFirstStage(technicalVersionId, '整体复核发现问题，打回上一阶段', '跟单C')
assert.equal(current.reviewStage, '第一阶段并行审核', '跟单打回后回到第一阶段')
assert.equal(current.buyerReview?.status, '待审核', '跟单打回后买手回到待审核')
assert.equal(current.patternMakerReview?.status, '待审核', '跟单打回后版师回到待审核')
assert.equal(current.returnedFromMerchandiserFlag, true, '应记录跟单打回标记')
assert.equal(canEditTechnicalModule(current, 'BOM'), true, '打回后物料清单可修改')
assert.equal(canEditTechnicalModule(current, 'COLOR_MATERIAL_MAPPING'), true, '打回后款色用料对应可修改')
assert.equal(canEditTechnicalModule(current, 'MATERIAL_PATTERN_LINK'), true, '打回后物料&纸样关联可修改')

current = startTechPackReview(technicalVersionId, 'BUYER', '买手A')
current = approveTechPackReview(technicalVersionId, 'BUYER', '复审通过', '买手A')
current = startTechPackReview(technicalVersionId, 'PATTERN_MAKER', '版师B')
current = approveTechPackReview(technicalVersionId, 'PATTERN_MAKER', '复审通过', '版师B')
assert.throws(
  () => approveTechPackReview(technicalVersionId, 'MERCHANDISER', '整体复核通过', '跟单C'),
  /当前审核节点需先进入审核中/,
  '跟单复核必须先进入审核中再通过',
)
current = startTechPackReview(technicalVersionId, 'MERCHANDISER', '跟单C')
current = approveTechPackReview(technicalVersionId, 'MERCHANDISER', '整体复核通过', '跟单C')
assert.equal(current.reviewStage, '待发布', '跟单通过后进入待发布')
assert.equal(canPublishTechnicalVersionByReview(current), true, '跟单通过后允许发布')

const listItem = buildTechnicalVersionListByStyle('STYLE-REVIEW-DOMAIN')[0]
assert.equal(listItem.reviewStatusText, '审核通过，待发布', '版本列表应派生审核提示')
assert.equal(listItem.pendingReviewerText, '无', '待发布时无待审核人')
assert.equal(listItem.reviewActionText, '发布正式版本', '待发布时应提示发布正式版本')

const detail = buildTechnicalVersionDetailViewModel(technicalVersionId)
assert.ok(detail, '应能构建详情视图')
assert.equal(detail.reviewStage, '待发布', '详情视图应包含审核阶段')

console.log('check:tech-pack-review-domain passed')
