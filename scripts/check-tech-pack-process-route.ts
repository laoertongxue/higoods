import assert from 'node:assert/strict'

import {
  approveTechPackReview,
  startTechPackReview,
  submitTechPackFirstStageReview,
} from '../src/data/pcs-tech-pack-review.ts'
import { publishTechnicalDataVersion } from '../src/data/pcs-project-technical-data-writeback.ts'
import { replaceTechnicalDataVersionStore } from '../src/data/pcs-technical-data-version-repository.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-types.ts'
import {
  areRouteEntriesContinuous,
  normalizeProcessRouteEntries,
  sortProcessRouteEntries,
} from '../src/data/tech-pack-process-route.ts'

type CheckRouteEntry = {
  id: string
  stageCode: string
  processCode: string
  routeStepNo?: number
  routeLaneNo?: number
  routeParallelGroupId?: string
  routeParallelAcceptanceMode?: 'INDEPENDENT_ONLY' | 'WHOLE_GROUP_ALLOWED'
}

function ids(entries: Array<{ id: string }>): string[] {
  return entries.map((entry) => entry.id)
}

const singleEntry: CheckRouteEntry = { id: 'single', stageCode: 'PREP', processCode: 'CUTTING' }
assert.deepEqual(normalizeProcessRouteEntries([]), [], '空输入应返回空数组')
assert.deepEqual(ids(normalizeProcessRouteEntries([singleEntry])), ['single'], '单条输入应保留原条目')

const missingRouteEntries: CheckRouteEntry[] = [
  { id: 'a', stageCode: 'PREP', processCode: 'CUTTING' },
  { id: 'b', stageCode: 'PROD', processCode: 'SEWING' },
]
assert.deepEqual(
  normalizeProcessRouteEntries(missingRouteEntries).map((entry) => entry.routeStepNo),
  [1, 2],
  '缺 routeStepNo 时应从第 1 步开始归一化',
)

const sameSortKeyEntries: CheckRouteEntry[] = [
  { id: 'z-last-id', stageCode: 'PROD', processCode: 'SEWING', routeStepNo: 2, routeLaneNo: 1 },
  { id: 'a-first-id', stageCode: 'PROD', processCode: 'SEWING', routeStepNo: 2, routeLaneNo: 1 },
]
assert.deepEqual(
  ids(sortProcessRouteEntries(sameSortKeyEntries)),
  ['z-last-id', 'a-first-id'],
  '相同排序键时 sortProcessRouteEntries 必须保留原数组顺序',
)
assert.deepEqual(
  ids(normalizeProcessRouteEntries(sameSortKeyEntries)),
  ['z-last-id', 'a-first-id'],
  '相同排序键时 normalizeProcessRouteEntries 必须保留原数组顺序',
)

assert.equal(
  areRouteEntriesContinuous([
    { id: 'step-1', routeStepNo: 1 },
    { id: 'step-2', routeStepNo: 2 },
  ]).allowed,
  true,
  '串行相邻步骤应允许连续判断',
)

assert.equal(
  areRouteEntriesContinuous([
    { id: 'step-1', routeStepNo: 1 },
    { id: 'step-3', routeStepNo: 3 },
  ]).allowed,
  false,
  '路线步骤断档时不允许连续判断',
)

assert.equal(
  areRouteEntriesContinuous([
    { id: 'parallel-a', routeStepNo: 2, routeParallelGroupId: 'G1' },
    { id: 'parallel-b', routeStepNo: 2, routeParallelGroupId: 'G1' },
  ]).allowed,
  false,
  '同一步并行默认不允许连续判断',
)

assert.equal(
  areRouteEntriesContinuous([
    { id: 'parallel-a', routeStepNo: 2, routeParallelGroupId: 'G1', routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED' },
    { id: 'parallel-b', routeStepNo: 2, routeParallelGroupId: 'G1', routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED' },
  ]).allowed,
  true,
  '同一步并行且允许整体承接时，本批内部连续判断应允许',
)

function buildRouteGateRecord(id: string, merchandiserPassed = false): TechnicalDataVersionRecord {
  return {
    technicalVersionId: id,
    technicalVersionCode: id.toUpperCase(),
    versionLabel: 'V1',
    versionNo: 1,
    styleId: id,
    styleCode: id,
    styleName: '路线门禁验证款',
    sourceProjectId: id,
    sourceProjectCode: id,
    sourceProjectName: '路线门禁验证项目',
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
    changeSummary: '路线门禁验证',
    garmentDifficultyGrade: 'B',
    linkedPartTemplateIds: [],
    linkedPatternLibraryVersionIds: [],
    linkedPatternAssetIds: [],
    linkedPatternAssetCodes: [],
    archiveCollectedFlag: false,
    archiveCollectedAt: '',
    versionStatus: 'DRAFT',
    reviewStage: merchandiserPassed ? '待发布' : '未提交审核',
    buyerReview: merchandiserPassed ? { nodeKey: 'BUYER', nodeName: '买手审核', status: '审核-已通过', reviewerRole: '买手' } : undefined,
    patternMakerReview: merchandiserPassed ? { nodeKey: 'PATTERN_MAKER', nodeName: '版师审核', status: '审核-已通过', reviewerRole: '版师' } : undefined,
    merchandiserReview: merchandiserPassed ? { nodeKey: 'MERCHANDISER', nodeName: '跟单审核', status: '审核-已通过', reviewerRole: '跟单' } : undefined,
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
    qualityRuleCount: 0,
    colorMaterialMappingCount: 1,
    designAssetCount: 0,
    attachmentCount: 0,
    completenessScore: 100,
    missingItemCodes: [],
    missingItemNames: [],
    publishedAt: '',
    publishedBy: '',
    createdAt: '2026-07-07 10:00',
    createdBy: '测试用户',
    updatedAt: '2026-07-07 10:00',
    updatedBy: '测试用户',
    note: '',
    legacySpuCode: '',
    legacyVersionLabel: '',
  }
}

function buildRouteGateContent(id: string, routeConfirmed: boolean): TechnicalDataVersionContent {
  return {
    technicalVersionId: id,
    patternFiles: [{ id: `${id}-pattern`, fileName: 'front.dxf', fileUrl: '#', uploadedAt: '2026-07-07 10:00', uploadedBy: '版师' }],
    patternDesc: '',
    processEntries: [{
      id: `${id}-process-sew`,
      entryType: 'PROCESS_BASELINE',
      stageCode: 'PROD',
      stageName: '生产阶段',
      processCode: 'SEW',
      processName: '车缝',
      assignmentGranularity: 'SKU',
      defaultDocType: 'TASK',
      taskTypeMode: 'PROCESS',
      isSpecialCraft: false,
      routeStepNo: 1,
      routeLaneNo: 1,
      routeParallelAcceptanceMode: 'INDEPENDENT_ONLY',
      routeSourceKind: 'DICT_DEFAULT',
    }],
    processRouteStatus: routeConfirmed ? 'CONFIRMED' : 'UNCONFIRMED',
    processRouteConfirmedBy: routeConfirmed ? 'Budi Santoso' : '',
    processRouteConfirmedAt: routeConfirmed ? '2026-07-07 10:10' : '',
    sizeTable: [{ id: `${id}-size`, part: '胸围', S: 90, M: 94, L: 98, XL: 102, tolerance: 1 }],
    bomItems: [{ id: `${id}-bom`, type: '面料', name: '主面料', spec: '100% 棉', unitConsumption: 1, lossRate: 0.03, supplier: '供应商' }],
    qualityRules: [],
    colorMaterialMappings: [{ id: `${id}-mapping`, spuCode: id, colorCode: 'BK', colorName: '黑色', status: 'CONFIRMED', generatedMode: 'MANUAL', lines: [] }],
    patternDesigns: [],
    attachments: [],
    legacyCompatibleCostPayload: {},
  }
}

const reviewGateId = 'tdv_route_review_gate'
const publishGateId = 'tdv_route_publish_gate'
replaceTechnicalDataVersionStore({
  version: 4,
  records: [buildRouteGateRecord(reviewGateId), buildRouteGateRecord(publishGateId, true)],
  contents: [buildRouteGateContent(reviewGateId, false), buildRouteGateContent(publishGateId, false)],
  pendingItems: [],
})

submitTechPackFirstStageReview(reviewGateId, {
  buyerReviewerId: 'U001',
  patternMakerReviewerId: 'U001',
  merchandiserReviewerId: 'U001',
  operator: { id: 'U001', name: 'Budi Santoso' },
})
startTechPackReview(reviewGateId, 'BUYER', 'Budi Santoso')
approveTechPackReview(reviewGateId, 'BUYER', '买手通过', 'Budi Santoso')
startTechPackReview(reviewGateId, 'PATTERN_MAKER', 'Budi Santoso')
approveTechPackReview(reviewGateId, 'PATTERN_MAKER', '版师通过', 'Budi Santoso')
startTechPackReview(reviewGateId, 'MERCHANDISER', 'Budi Santoso')
assert.throws(
  () => approveTechPackReview(reviewGateId, 'MERCHANDISER', '整体复核通过', 'Budi Santoso'),
  /工艺路线未确认，不能通过跟单审核/,
  '跟单审核通过前必须确认工艺路线',
)
assert.throws(
  () => publishTechnicalDataVersion(publishGateId, 'Budi Santoso'),
  /工艺路线未确认，不能发布正式技术包。/,
  '发布正式版前必须再次确认工艺路线',
)

console.log('tech-pack process route checks passed')
