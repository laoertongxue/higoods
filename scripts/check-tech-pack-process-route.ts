import assert from 'node:assert/strict'

import {
  approveTechPackReview,
  getTechnicalProcessRouteGate,
  startTechPackReview,
  submitTechPackFirstStageReview,
} from '../src/data/pcs-tech-pack-review.ts'
import {
  publishTechnicalDataVersion,
  saveTechnicalDataVersionContent,
} from '../src/data/pcs-project-technical-data-writeback.ts'
import {
  buildTechnicalDataDerivedState,
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
import { syncPreparationProcessesFromBom } from '../src/pages/tech-pack/bom-process-linkage.ts'
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
    { id: 'parallel-a', processCode: 'SEW', routeStepNo: 2, routeParallelGroupId: 'G1', routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED' },
    { id: 'parallel-b', processCode: 'POST_FINISHING', routeStepNo: 2, routeParallelGroupId: 'G1', routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED' },
  ]).allowed,
  true,
  '同一步并行且允许整体承接时，本批内部连续判断应允许',
)

const noSingleFactoryCoverageResult = areRouteEntriesContinuous(
  [
    { id: 'parallel-a', processCode: 'CUT_PANEL', routeStepNo: 2, routeParallelGroupId: 'G1', routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED' },
    { id: 'parallel-b', processCode: 'DYE', routeStepNo: 2, routeParallelGroupId: 'G1', routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED' },
  ],
  { canSingleFactoryCoverProcesses: () => false },
)
assert.equal(noSingleFactoryCoverageResult.allowed, false, '同一步并行整体承接必须支持同一工厂能力校验')
assert.match(noSingleFactoryCoverageResult.reason, /同一工厂.*全部工序能力/, '能力不足时必须返回中文原因')

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

const movedUpDraft = applyProcessRouteDraftAction(
  confirmedDraft,
  { type: 'move-up', techniqueId: 'page-tech-b' },
  'Budi Santoso',
  '2026-07-07 10:21',
)
assert.equal(movedUpDraft.processRouteStatus, 'UNCONFIRMED', '路线上移后应自动取消确认')
assert.equal(movedUpDraft.processRouteConfirmedBy, '', '路线上移后应清空确认人')
assert.equal(movedUpDraft.processRouteConfirmedAt, '', '路线上移后应清空确认时间')
assertContinuousRouteSteps(movedUpDraft, '路线上移后步骤应保持连续')

const dyePrintDraft: ProcessRouteDraftState = {
  techniques: [
    {
      ...buildCheckTechnique('process-dye', 1),
      processCode: 'DYE',
      linkedBomItemIds: ['bom-shared-dye-print'],
    },
    {
      ...buildCheckTechnique('process-print', 2),
      processCode: 'PRINT',
      linkedBomItemIds: ['bom-shared-dye-print'],
    },
  ],
  processRouteStatus: 'UNCONFIRMED',
  processRouteConfirmedBy: '',
  processRouteConfirmedAt: '',
  processRouteUpdatedBy: '',
  processRouteUpdatedAt: '',
}
let dyePrintOrderWarning = ''
const reversedDyePrint = applyProcessRouteDraftAction(
  dyePrintDraft,
  { type: 'move-up', techniqueId: 'process-print' },
  '测试人员',
  '2026-07-22 10:00:00',
  (message) => {
    dyePrintOrderWarning = message
  },
)
assert.deepEqual(
  reversedDyePrint.techniques.map((item) => item.id),
  dyePrintDraft.techniques.map((item) => item.id),
  '同一 BOM 物料不能保存先印花后染色的路线',
)
assert.equal(
  dyePrintOrderWarning,
  '同一物料必须先染色、后印花，请调整工艺顺序',
  '拖动形成先印后染时必须告知调整方法',
)

const invalidDyePrintDraft: ProcessRouteDraftState = {
  ...dyePrintDraft,
  techniques: [
    { ...dyePrintDraft.techniques[1], routeStepNo: 1 },
    { ...dyePrintDraft.techniques[0], routeStepNo: 2 },
  ],
}
const confirmedInvalidDyePrint = applyProcessRouteDraftAction(
  invalidDyePrintDraft,
  { type: 'confirm' },
  '测试人员',
  '2026-07-22 10:01:00',
)
assert.equal(
  confirmedInvalidDyePrint.processRouteStatus,
  'UNCONFIRMED',
  '同一 BOM 物料先印花后染色时不得确认路线',
)
const generatedDyePrint = syncPreparationProcessesFromBom([], [
  {
    id: 'bom-shared-dye-print',
    dyeRequirement: '匹染',
    printRequirement: '数码印',
  },
])
assert.deepEqual(
  generatedDyePrint.generatedProcessCodes,
  ['DYE', 'PRINT'],
  '同一 BOM 物料同时需要染色和印花时必须先生成染色、后生成印花',
)

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

function buildRouteGateRecord(
  id: string,
  merchandiserPassed = false,
  versionStatus: TechnicalDataVersionRecord['versionStatus'] = 'DRAFT',
): TechnicalDataVersionRecord {
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
    versionStatus,
    reviewStage: versionStatus === 'PUBLISHED' ? '已发布' : merchandiserPassed ? '待发布' : '未提交审核',
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
    publishedAt: versionStatus === 'PUBLISHED' ? '2026-07-07 11:00' : '',
    publishedBy: versionStatus === 'PUBLISHED' ? 'Budi Santoso' : '',
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
      routeParallelGroupId: 'ROUTE-GROUP-1',
      routeParallelGroupName: '路线克隆验证并行组',
      routeParallelAcceptanceMode: 'INDEPENDENT_ONLY',
      routeSourceKind: 'DICT_DEFAULT',
      supportedTargetObjects: ['CUT_PIECE'],
      supportedTargetObjectLabels: ['已裁部位'],
      linkedBomItemIds: [`${id}-bom`],
      linkedPatternIds: [`${id}-pattern`],
      visibleFactoryTypes: ['SEWING'],
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

function buildLegacyOnlyRouteGateContent(id: string): TechnicalDataVersionContent {
  const content = buildRouteGateContent(id, false)
  delete content.processRouteStatus
  delete content.processRouteConfirmedBy
  delete content.processRouteConfirmedAt
  delete content.processRouteUpdatedBy
  delete content.processRouteUpdatedAt
  delete content.processRouteChangeReason
  content.legacyCompatibleCostPayload = {
    processRouteStatus: 'CONFIRMED',
    processRouteConfirmedBy: 'Budi Santoso',
    processRouteConfirmedAt: '2026-07-07 10:40',
    processRouteUpdatedBy: 'Budi Santoso',
    processRouteUpdatedAt: '2026-07-07 10:40',
  }
  return content
}

function buildMissingRouteStatusPublishedContent(id: string): TechnicalDataVersionContent {
  const content = buildRouteGateContent(id, false)
  delete content.processRouteStatus
  delete content.processRouteConfirmedBy
  delete content.processRouteConfirmedAt
  delete content.processRouteUpdatedBy
  delete content.processRouteUpdatedAt
  delete content.processRouteChangeReason
  content.legacyCompatibleCostPayload = {}
  return content
}

const roundtripId = 'tdv_route_roundtrip'
const legacyOnlyGateId = 'tdv_route_legacy_only_gate'
const reviewGateId = 'tdv_route_review_gate'
const publishGateId = 'tdv_route_publish_gate'
const publishedMissingRouteId = 'tdv_route_published_missing_status'
replaceTechnicalDataVersionStore({
  version: 4,
  records: [
    buildRouteGateRecord(roundtripId),
    buildRouteGateRecord(legacyOnlyGateId),
    buildRouteGateRecord(reviewGateId),
    buildRouteGateRecord(publishGateId, true),
    buildRouteGateRecord(publishedMissingRouteId, true, 'PUBLISHED'),
  ],
  contents: [
    buildRouteGateContent(roundtripId, true),
    buildLegacyOnlyRouteGateContent(legacyOnlyGateId),
    buildRouteGateContent(reviewGateId, false),
    buildRouteGateContent(publishGateId, false),
    buildMissingRouteStatusPublishedContent(publishedMissingRouteId),
  ],
  pendingItems: [],
})

const legacyOnlyGate = getTechnicalProcessRouteGate(legacyOnlyGateId)
assert.equal(legacyOnlyGate.hasRoute, true, 'legacy-only 路线门禁应识别已有路线')
assert.equal(legacyOnlyGate.processRouteStatus, 'CONFIRMED', 'legacy-only 路线确认状态应回退读取 legacy payload')
assert.equal(legacyOnlyGate.processRouteConfirmedBy, 'Budi Santoso', 'legacy-only 路线确认人应回退读取 legacy payload')
assert.equal(legacyOnlyGate.processRouteConfirmedAt, '2026-07-07 10:40', 'legacy-only 路线确认时间应回退读取 legacy payload')
assert.equal(legacyOnlyGate.confirmed, true, 'legacy-only 已确认路线应允许门禁通过')

saveTechnicalDataVersionContent(legacyOnlyGateId, { patternDesc: '无关保存' }, 'Budi Santoso')
const legacyOnlyGateAfterUnrelatedSave = getTechnicalProcessRouteGate(legacyOnlyGateId)
assert.equal(
  legacyOnlyGateAfterUnrelatedSave.processRouteStatus,
  'CONFIRMED',
  'legacy-only 已确认路线在无关保存后仍应回退读取 legacy payload',
)
assert.equal(legacyOnlyGateAfterUnrelatedSave.confirmed, true, 'legacy-only 已确认路线在无关保存后仍应允许门禁通过')

saveTechnicalDataVersionContent(legacyOnlyGateId, {
  processRouteStatus: 'UNCONFIRMED',
  processRouteConfirmedBy: '',
  processRouteConfirmedAt: '',
  processRouteUpdatedBy: 'Budi Santoso',
  processRouteUpdatedAt: '2026-07-07 10:45',
}, 'Budi Santoso')
const legacyOnlyGateAfterCancel = getTechnicalProcessRouteGate(legacyOnlyGateId)
assert.equal(legacyOnlyGateAfterCancel.processRouteStatus, 'UNCONFIRMED', 'legacy-only 路线显式取消确认后应变为未确认')
assert.equal(legacyOnlyGateAfterCancel.processRouteConfirmedBy, '', 'legacy-only 路线显式取消确认后应清空确认人')
assert.equal(legacyOnlyGateAfterCancel.processRouteConfirmedAt, '', 'legacy-only 路线显式取消确认后应清空确认时间')
assert.equal(legacyOnlyGateAfterCancel.confirmed, false, 'legacy-only 路线显式取消确认后门禁应不通过')

const publishedMissingRouteContent = getTechnicalDataVersionContent(publishedMissingRouteId)
assert.equal(
  publishedMissingRouteContent?.processRouteStatus,
  'UNCONFIRMED',
  '已发布版本缺少显式路线确认字段时不得在读取层自动补为已确认',
)
assert(
  publishedMissingRouteContent
    ? buildTechnicalDataDerivedState('PUBLISHED', publishedMissingRouteContent).missingItemCodes.includes('PROCESS')
    : false,
  '已发布版本缺少显式路线确认字段时 PROCESS 必须仍为核心缺失项',
)
assert.equal(
  getTechnicalProcessRouteGate(publishedMissingRouteId).confirmed,
  false,
  '已发布版本缺少显式路线确认字段时路线门禁不得通过',
)

const roundtripContent = getTechnicalDataVersionContent(roundtripId)
assert.equal(roundtripContent?.processRouteStatus, 'CONFIRMED', '仓库读取时应保留路线确认状态')
assert.equal(roundtripContent?.processRouteConfirmedBy, 'Budi Santoso', '仓库读取时应保留路线确认人')
assert.equal(roundtripContent?.processRouteConfirmedAt, '2026-07-07 10:10', '仓库读取时应保留路线确认时间')
assert.equal(roundtripContent?.processRouteUpdatedBy, 'Budi Santoso', '仓库读取时应保留路线更新人')
assert.equal(roundtripContent?.processRouteUpdatedAt, '2026-07-07 10:10', '仓库读取时应保留路线更新时间')
assert.equal(roundtripContent?.processRouteChangeReason, '第 2 批确认检查', '仓库读取时应保留路线变更原因')
assert.equal(roundtripContent?.processEntries[0]?.routeStepNo, 1, '仓库读取时工序条目应保留路线步骤')
assert.equal(roundtripContent?.processEntries[0]?.routeLaneNo, 1, '仓库读取时工序条目应保留路线并行线')
assert.equal(roundtripContent?.processEntries[0]?.routeParallelGroupId, 'ROUTE-GROUP-1', '仓库读取时工序条目应保留并行组')
assert.equal(roundtripContent?.processEntries[0]?.routeParallelGroupName, '路线克隆验证并行组', '仓库读取时工序条目应保留并行组名称')
assert.equal(roundtripContent?.processEntries[0]?.routeSourceKind, 'DICT_DEFAULT', '仓库读取时工序条目应保留路线来源')
roundtripContent?.processEntries[0]?.linkedBomItemIds?.push('mutated-bom')
assert.deepEqual(
  getTechnicalDataVersionContent(roundtripId)?.processEntries[0]?.linkedBomItemIds,
  [`${roundtripId}-bom`],
  '仓库克隆工序条目时必须深拷贝来源关联数组',
)

const unconfirmedDerived = buildTechnicalDataDerivedState('DRAFT', buildRouteGateContent('tdv_route_unconfirmed_core', false))
assert(unconfirmedDerived.missingItemCodes.includes('PROCESS'), '缺少路线确认时 PROCESS 应纳入核心缺失项')
assert.equal(unconfirmedDerived.completenessScore, 80, '缺少路线确认时核心资料完整度不能拿到工序 20 分')

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
  /核心域未补全，暂不能发布：工序工艺/,
  '发布正式版前必须把未确认路线计入工序工艺核心缺失',
)

console.log('tech-pack process route checks passed')
