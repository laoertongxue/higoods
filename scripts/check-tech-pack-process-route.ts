import assert from 'node:assert/strict'

import {
  approveTechPackReview,
  startTechPackReview,
  submitTechPackFirstStageReview,
} from '../src/data/pcs-tech-pack-review.ts'
import {
  publishTechnicalDataVersion,
  saveTechnicalDataVersionContent,
} from '../src/data/pcs-project-technical-data-writeback.ts'
import {
  getTechnicalDataVersionContent,
  replaceTechnicalDataVersionStore,
} from '../src/data/pcs-technical-data-version-repository.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-types.ts'
import {
  areRouteEntriesContinuous,
  normalizeProcessRouteEntries,
  sortProcessRouteEntries,
} from '../src/data/tech-pack-process-route.ts'
import {
  applyProcessRouteDraftAction,
  type ProcessRouteDraftState,
} from '../src/pages/tech-pack/events.ts'
import type { TechniqueItem } from '../src/pages/tech-pack/context.ts'

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

function buildCheckTechnique(id: string, routeStepNo: number): TechniqueItem {
  return {
    id,
    entryType: 'PROCESS_BASELINE',
    stageCode: 'PROD',
    stage: '生产阶段',
    processCode: id.toUpperCase(),
    process: `检查工序 ${id}`,
    craftCode: '',
    technique: `检查工序 ${id}`,
    assignmentGranularity: 'SKU',
    ruleSource: 'INHERIT_PROCESS',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
    defaultDocType: 'TASK',
    taskTypeMode: 'PROCESS',
    isSpecialCraft: false,
    triggerSource: '检查脚本',
    outputValue: 0,
    outputValueUnit: '产值/件',
    referenceOutputValueValue: null,
    referenceOutputValueUnit: '',
    referenceOutputValueUnitLabel: '',
    referenceOutputValueNote: '',
    difficulty: '中等',
    remark: '',
    source: '字典引用',
    routeStepNo,
    routeLaneNo: 1,
    routeParallelAcceptanceMode: 'INDEPENDENT_ONLY',
    routeSourceKind: 'DICT_DEFAULT',
  }
}

function routeStepNos(draft: ProcessRouteDraftState): number[] {
  return draft.techniques
    .slice()
    .sort((left, right) => left.routeStepNo - right.routeStepNo || left.routeLaneNo - right.routeLaneNo)
    .map((item) => item.routeStepNo)
}

function assertContinuousRouteSteps(draft: ProcessRouteDraftState, message: string): void {
  const steps = Array.from(new Set(routeStepNos(draft)))
  assert.deepEqual(steps, steps.map((_, index) => index + 1), message)
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

const pageRouteDraft: ProcessRouteDraftState = {
  techniques: [
    buildCheckTechnique('page-tech-a', 1),
    buildCheckTechnique('page-tech-b', 2),
    buildCheckTechnique('page-tech-c', 3),
  ],
  processRouteStatus: 'UNCONFIRMED',
  processRouteConfirmedBy: '',
  processRouteConfirmedAt: '',
  processRouteUpdatedBy: '',
  processRouteUpdatedAt: '',
}
const confirmedDraft = applyProcessRouteDraftAction(
  pageRouteDraft,
  { type: 'confirm' },
  'Budi Santoso',
  '2026-07-07 10:20',
)
assert.equal(confirmedDraft.processRouteStatus, 'CONFIRMED', '确认路线后状态应为已确认')
assert.equal(confirmedDraft.processRouteConfirmedBy, 'Budi Santoso', '确认路线后应写入确认人')
assert.equal(confirmedDraft.processRouteConfirmedAt, '2026-07-07 10:20', '确认路线后应写入确认时间')

const movedDraft = applyProcessRouteDraftAction(
  confirmedDraft,
  { type: 'move-down', techniqueId: 'page-tech-a' },
  'Budi Santoso',
  '2026-07-07 10:21',
)
assert.equal(movedDraft.processRouteStatus, 'UNCONFIRMED', '路线排序后应自动取消确认')
assert.equal(movedDraft.processRouteConfirmedBy, '', '路线排序后应清空确认人')
assert.equal(movedDraft.processRouteConfirmedAt, '', '路线排序后应清空确认时间')
assertContinuousRouteSteps(movedDraft, '路线排序后步骤应保持连续')

const parallelDraft = applyProcessRouteDraftAction(
  confirmedDraft,
  { type: 'make-parallel-next', techniqueId: 'page-tech-a' },
  'Budi Santoso',
  '2026-07-07 10:22',
)
assert.equal(parallelDraft.processRouteStatus, 'UNCONFIRMED', '设为并行后应自动取消确认')
assert.deepEqual(routeStepNos(parallelDraft), [1, 1, 2], '设为并行后相邻步骤应合并为同一步')
assertContinuousRouteSteps(parallelDraft, '设为并行后步骤应保持连续')

const confirmedParallelDraft = applyProcessRouteDraftAction(
  parallelDraft,
  { type: 'confirm' },
  'Budi Santoso',
  '2026-07-07 10:23',
)
const toggledDraft = applyProcessRouteDraftAction(
  confirmedParallelDraft,
  { type: 'toggle-parallel-group-acceptance', techniqueId: 'page-tech-a' },
  'Budi Santoso',
  '2026-07-07 10:24',
)
assert.equal(toggledDraft.processRouteStatus, 'UNCONFIRMED', '并行承接方式变更后应自动取消确认')
assert.equal(toggledDraft.processRouteConfirmedBy, '', '并行承接方式变更后应清空确认人')
assert.equal(toggledDraft.processRouteConfirmedAt, '', '并行承接方式变更后应清空确认时间')
assert.equal(
  toggledDraft.techniques.find((item) => item.id === 'page-tech-a')?.routeParallelAcceptanceMode,
  'WHOLE_GROUP_ALLOWED',
  '并行承接方式应能切换为整体承接',
)

const splitDraft = applyProcessRouteDraftAction(
  confirmedParallelDraft,
  { type: 'remove-from-parallel', techniqueId: 'page-tech-b' },
  'Budi Santoso',
  '2026-07-07 10:25',
)
assert.equal(splitDraft.processRouteStatus, 'UNCONFIRMED', '移出并行后应自动取消确认')
assert.equal(splitDraft.processRouteConfirmedBy, '', '移出并行后应清空确认人')
assert.equal(splitDraft.processRouteConfirmedAt, '', '移出并行后应清空确认时间')
assert.deepEqual(routeStepNos(splitDraft), [1, 2, 3], '移出并行后步骤应拆成连续步骤')
assertContinuousRouteSteps(splitDraft, '移出并行后步骤应保持连续')

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
    processRouteUpdatedBy: routeConfirmed ? 'Budi Santoso' : '测试用户',
    processRouteUpdatedAt: routeConfirmed ? '2026-07-07 10:10' : '2026-07-07 10:00',
    processRouteChangeReason: routeConfirmed ? '第 2 批确认检查' : '',
    sizeTable: [{ id: `${id}-size`, part: '胸围', S: 90, M: 94, L: 98, XL: 102, tolerance: 1 }],
    bomItems: [{ id: `${id}-bom`, type: '面料', name: '主面料', spec: '100% 棉', unitConsumption: 1, lossRate: 0.03, supplier: '供应商' }],
    qualityRules: [],
    colorMaterialMappings: [{ id: `${id}-mapping`, spuCode: id, colorCode: 'BK', colorName: '黑色', status: 'CONFIRMED', generatedMode: 'MANUAL', lines: [] }],
    patternDesigns: [],
    attachments: [],
    legacyCompatibleCostPayload: routeConfirmed ? {
      processRouteStatus: 'CONFIRMED',
      processRouteConfirmedBy: 'Budi Santoso',
      processRouteConfirmedAt: '2026-07-07 10:10',
      processRouteUpdatedBy: 'Budi Santoso',
      processRouteUpdatedAt: '2026-07-07 10:10',
      processRouteChangeReason: '第 2 批确认检查',
    } : {},
  }
}

const roundtripId = 'tdv_route_roundtrip'
const reviewGateId = 'tdv_route_review_gate'
const publishGateId = 'tdv_route_publish_gate'
replaceTechnicalDataVersionStore({
  version: 4,
  records: [
    buildRouteGateRecord(roundtripId),
    buildRouteGateRecord(reviewGateId),
    buildRouteGateRecord(publishGateId, true),
  ],
  contents: [
    buildRouteGateContent(roundtripId, true),
    buildRouteGateContent(reviewGateId, false),
    buildRouteGateContent(publishGateId, false),
  ],
  pendingItems: [],
})

const roundtripContent = getTechnicalDataVersionContent(roundtripId)
assert.equal(roundtripContent?.processRouteStatus, 'CONFIRMED', '仓库读取时应保留路线确认状态')
assert.equal(roundtripContent?.processRouteConfirmedBy, 'Budi Santoso', '仓库读取时应保留路线确认人')
assert.equal(roundtripContent?.processRouteConfirmedAt, '2026-07-07 10:10', '仓库读取时应保留路线确认时间')
assert.equal(roundtripContent?.processRouteUpdatedBy, 'Budi Santoso', '仓库读取时应保留路线更新人')
assert.equal(roundtripContent?.processRouteUpdatedAt, '2026-07-07 10:10', '仓库读取时应保留路线更新时间')
assert.equal(roundtripContent?.processRouteChangeReason, '第 2 批确认检查', '仓库读取时应保留路线变更原因')

saveTechnicalDataVersionContent(roundtripId, {
  processRouteStatus: 'UNCONFIRMED',
  processRouteConfirmedBy: '',
  processRouteConfirmedAt: '',
  processRouteUpdatedBy: 'Budi Santoso',
  processRouteUpdatedAt: '2026-07-07 10:30',
}, 'Budi Santoso')
const canceledRouteContent = getTechnicalDataVersionContent(roundtripId)
assert.equal(canceledRouteContent?.processRouteStatus, 'UNCONFIRMED', '取消确认后状态应回到未确认')
assert.equal(canceledRouteContent?.processRouteConfirmedBy, '', '取消确认后 top-level 确认人必须清空')
assert.equal(canceledRouteContent?.processRouteConfirmedAt, '', '取消确认后 top-level 确认时间必须清空')
assert.equal(
  canceledRouteContent?.legacyCompatibleCostPayload.processRouteConfirmedBy,
  '',
  '取消确认后 legacy payload 确认人必须清空',
)
assert.equal(
  canceledRouteContent?.legacyCompatibleCostPayload.processRouteConfirmedAt,
  '',
  '取消确认后 legacy payload 确认时间必须清空',
)

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
