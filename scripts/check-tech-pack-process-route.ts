import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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
} from '../src/data/pcs-technical-data-version-repository.ts'
import { installTechnicalDataVersionFixtures } from './helpers/technical-data-version-fixtures.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-types.ts'
import {
  CURRENT_PROCESS_ROUTE_SCHEMA_VERSION,
  PROCESS_ROUTE_EXPLICIT_EDGE_MIGRATION_MARKER,
  addProcessRouteEdge,
  materializeLegacyProcessRoutePredecessors,
  migrateProcessRouteSchema,
  normalizeProcessRouteEntries,
  removeProcessRouteEdge,
  sortProcessRouteEntries,
  validateProcessRouteGraph,
} from '../src/data/tech-pack-process-route.ts'
import {
  applyProcessRouteDraftAction,
  type ProcessRouteDraftState,
} from '../src/pages/tech-pack/events.ts'
import {
  syncTechPackProcessesFromBom,
  type BomDrivenPrepTechnique,
} from '../src/pages/tech-pack/bom-process-linkage.ts'
import {
  syncPatternDrivenTechniques,
  type PatternItem,
  type TechniqueItem,
} from '../src/pages/tech-pack/context.ts'

type CheckRouteEntry = {
  id: string
  stageCode: string
  processCode: string
  routeObjectKey?: string
  inputObjectType?: 'BOM_MATERIAL' | 'FABRIC' | 'YARN' | 'ACCESSORY' | 'PACKAGING_MATERIAL' | 'CUT_PIECE' | 'KNITTED_PANEL' | 'GARMENT' | 'PACKED_GARMENT'
  outputObjectType?: 'BOM_MATERIAL' | 'FABRIC' | 'YARN' | 'ACCESSORY' | 'PACKAGING_MATERIAL' | 'CUT_PIECE' | 'KNITTED_PANEL' | 'GARMENT' | 'PACKED_GARMENT'
  linkedBomItemIds?: string[]
  consumedBomItemIds?: string[]
  predecessorEntryIds?: string[]
  routeStepNo?: number
  routeLaneNo?: number
  routeParallelGroupId?: string
}

function ids(entries: Array<{ id: string }>): string[] {
  return entries.map((entry) => entry.id)
}

function buildCheckTechnique(
  id: string,
  overrides: Partial<TechniqueItem> = {},
): TechniqueItem {
  return {
    id,
    entryType: 'PROCESS_BASELINE',
    stageCode: 'PREP',
    stage: '准备阶段',
    processCode: 'DYE',
    process: '染色',
    craftCode: '',
    technique: '染色',
    assignmentGranularity: 'COLOR',
    ruleSource: 'INHERIT_PROCESS',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['MATERIAL_SKU'],
    defaultDocType: 'PREPARATION_ORDER',
    taskTypeMode: 'PROCESS',
    isSpecialCraft: false,
    linkedBomItemIds: ['bom-main'],
    routeObjectKey: 'BOM:bom-main',
    inputObjectType: 'FABRIC',
    outputObjectType: 'FABRIC',
    consumedBomItemIds: [],
    predecessorEntryIds: [],
    triggerSource: '检查脚本',
    difficulty: '中等',
    remark: '',
    source: '字典引用',
    sourceType: 'MANUAL',
    routeStepNo: 1,
    routeLaneNo: 1,
    routeSourceKind: 'MANUAL',
    ...overrides,
  }
}

const singleEntry: CheckRouteEntry = { id: 'single', stageCode: 'PREP', processCode: 'CUTTING' }
const legacyBomCut = buildCheckTechnique('legacy-bom-cut', {
  stageCode: 'PROD', processCode: 'CUT_PANEL', sourceType: undefined,
  inputObjectType: 'FABRIC', outputObjectType: 'CUT_PIECE',
})
const legacySew = buildCheckTechnique('legacy-sew', {
  stageCode: 'PROD', processCode: 'SEW', sourceType: undefined,
  routeObjectKey: 'GARMENT:test', linkedBomItemIds: [],
  inputObjectType: 'CUT_PIECE', outputObjectType: 'GARMENT', predecessorEntryIds: [legacyBomCut.id],
})
const migratedBomRoute = syncTechPackProcessesFromBom([legacyBomCut, legacySew], [
  { id: 'bom-main', type: '面料', printRequirement: '是' },
]).techniques
assert.equal(migratedBomRoute.filter((entry) => entry.processCode === 'CUT_PANEL').length, 1, '旧 BOM 裁剪不得与自动裁剪重复')
assert.deepEqual(migratedBomRoute.find((entry) => entry.id === legacySew.id)?.predecessorEntryIds,
  ['tech-prod-bom-main-cut-panel'], '车缝必须迁移到当前裁剪 occurrence，不能悬挂旧 ID')
assert.deepEqual(syncTechPackProcessesFromBom(migratedBomRoute, [{ id: 'bom-main', type: '面料', printRequirement: '是' }]).techniques,
  migratedBomRoute, 'BOM 路线迁移必须幂等')
assert(validateProcessRouteGraph(migratedBomRoute, { requireComplete: true }).some((issue) => issue.code === 'MISSING_REQUIRED_PREDECESSOR'),
  '新增印花尚未与裁剪承接时不得沿用确认状态')
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

const noDictionaryDefaultOrderEntries: CheckRouteEntry[] = [
  { id: 'print-first', stageCode: 'PREP', processCode: 'PRINT' },
  { id: 'dye-second', stageCode: 'PREP', processCode: 'DYE' },
  { id: 'water-third', stageCode: 'PREP', processCode: 'WATER_SOLUBLE' },
]
assert.deepEqual(
  ids(sortProcessRouteEntries(noDictionaryDefaultOrderEntries)),
  ['print-first', 'dye-second', 'water-third'],
  '同阶段且未录入路线时不得再按工序字典默认顺序重排',
)
assert.deepEqual(
  ids(normalizeProcessRouteEntries(noDictionaryDefaultOrderEntries)),
  ['print-first', 'dye-second', 'water-third'],
  '同阶段路线归一化必须保留该款原始录入顺序',
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

const dyeNode = buildCheckTechnique('route-dye')
const printNode = buildCheckTechnique('route-print', {
  processCode: 'PRINT',
  process: '印花',
  technique: '印花',
})
const dyeThenPrint = addProcessRouteEdge([dyeNode, printNode], dyeNode.id, printNode.id)
assert.deepEqual(dyeThenPrint.issues, [], '同一 BOM 分支必须允许明确配置染色后印花')
assert.deepEqual(
  dyeThenPrint.entries.find((item) => item.id === printNode.id)?.predecessorEntryIds,
  [dyeNode.id],
  '染色后印花必须保存直接前置 occurrence ID',
)
assert.deepEqual(
  validateProcessRouteGraph(dyeThenPrint.entries, { requireComplete: true }),
  [],
  '显式连接后的染色→印花路线应可确认',
)

const printThenDye = addProcessRouteEdge(
  [
    { ...printNode, predecessorEntryIds: [] },
    { ...dyeNode, predecessorEntryIds: [] },
  ],
  printNode.id,
  dyeNode.id,
)
assert.deepEqual(printThenDye.issues, [], '业务未规定统一印染顺序，必须允许同一 BOM 明确配置印花后染色')
assert.deepEqual(
  printThenDye.entries.find((item) => item.id === dyeNode.id)?.predecessorEntryIds,
  [printNode.id],
  '印花后染色也必须保存真实直接前置，而不是被默认顺序改写',
)

const pageRouteDraft: ProcessRouteDraftState = {
  techniques: dyeThenPrint.entries as TechniqueItem[],
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

const removedEdge = applyProcessRouteDraftAction(
  confirmedDraft,
  { type: 'remove-edge', sourceEntryId: dyeNode.id, targetEntryId: printNode.id },
  'Budi Santoso',
  '2026-07-07 10:21',
)
assert.equal(removedEdge.processRouteStatus, 'UNCONFIRMED', '删除路线边后必须自动取消确认')
assert.deepEqual(
  removedEdge.techniques.find((item) => item.id === printNode.id)?.predecessorEntryIds,
  [],
  '删除路线边必须删除后置节点保存的直接前置 ID',
)
let incompleteWarning = ''
const incompleteConfirmed = applyProcessRouteDraftAction(
  removedEdge,
  { type: 'confirm' },
  'Budi Santoso',
  '2026-07-07 10:22',
  (message) => { incompleteWarning = message },
)
assert.equal(incompleteConfirmed.processRouteStatus, 'UNCONFIRMED', '同一对象多个未连接起点不得确认')
assert.match(incompleteWarning, /多个未连接的起点/, '确认失败应直接指出缺少真实前后关系')

const crossBomEdge = addProcessRouteEdge(
  [
    buildCheckTechnique('bom-a-dye', { linkedBomItemIds: ['bom-a'], routeObjectKey: 'BOM:bom-a' }),
    buildCheckTechnique('bom-b-print', {
      processCode: 'PRINT',
      process: '印花',
      technique: '印花',
      linkedBomItemIds: ['bom-b'],
      routeObjectKey: 'BOM:bom-b',
    }),
  ],
  'bom-a-dye',
  'bom-b-print',
)
assert(crossBomEdge.issues.some((issue) => issue.code === 'OBJECT_BRANCH_MISMATCH'), '不同 BOM 物料不能因对象类型相同被错误连线')

const missingTargetEdge = addProcessRouteEdge([dyeNode], dyeNode.id, 'missing-target')
assert(missingTargetEdge.issues.some((issue) => issue.code === 'MISSING_TARGET'), '连接不存在的后置节点必须阻断')

const cutPiecePrint = buildCheckTechnique('invalid-cut-piece-print', {
  stageCode: 'PROD',
  stage: '生产阶段',
  processCode: 'PRINT',
  process: '印花',
  technique: '印花',
  routeObjectKey: 'PATTERN:front:PIECE:front-panel',
  inputObjectType: 'CUT_PIECE',
  outputObjectType: 'CUT_PIECE',
})
assert(
  validateProcessRouteGraph([cutPiecePrint]).some((issue) => issue.code === 'FABRIC_PRINT_OBJECT_INVALID'),
  '裁片不得配置印花，图案类工艺必须使用烫画或直喷',
)
for (const [name, objectType] of [['裁片', 'CUT_PIECE'], ['成衣', 'GARMENT']] as const) {
  for (const craftName of ['烫画', '直喷']) {
    const node = buildCheckTechnique(`${craftName}-${name}`, {
      stageCode: 'PROD',
      stage: '生产阶段',
      processCode: 'SPECIAL_CRAFT',
      process: '辅助工艺',
      technique: craftName,
      entryType: 'CRAFT',
      craftCode: craftName === '烫画' ? 'AUX_HEAT_TRANSFER' : 'AUX_DIRECT_PRINT',
      isSpecialCraft: true,
      routeObjectKey: objectType === 'GARMENT' ? 'BOM:garment-1' : 'PATTERN:p1:PIECE:front',
      inputObjectType: objectType,
      outputObjectType: objectType,
    })
    assert.deepEqual(validateProcessRouteGraph([node]), [], `${name}${craftName}必须是合法的类型级工艺节点`)
  }
}

const dynamicPostNode = buildCheckTechnique('post-iron-pack', {
  stageCode: 'POST',
  stage: '后道阶段',
  processCode: 'IRON_PACK',
  process: '烫包',
  technique: '烫包',
  routeObjectKey: 'GARMENT:style-1',
  inputObjectType: 'GARMENT',
  outputObjectType: 'PACKED_GARMENT',
})
assert(
  validateProcessRouteGraph([dynamicPostNode]).some((issue) => issue.code === 'POST_PROCESS_NOT_STATIC_ROUTE'),
  '开扣眼、装扣子、烫包等 QC 动态项目不得进入技术包固定路线',
)

const cycleNodes = materializeLegacyProcessRoutePredecessors([
  { ...dyeNode, predecessorEntryIds: [printNode.id] },
  { ...printNode, predecessorEntryIds: [dyeNode.id] },
])
assert(validateProcessRouteGraph(cycleNodes).some((issue) => issue.code === 'CYCLE'), '路线形成循环时必须阻断')

const legacyRouteMigration = migrateProcessRouteSchema({
  schemaVersion: 1,
  entries: [
    { ...dyeNode, predecessorEntryIds: undefined, routeStepNo: 1, routeLaneNo: 1 },
    { ...printNode, predecessorEntryIds: undefined, routeStepNo: 2, routeLaneNo: 1 },
  ],
})
assert.equal(legacyRouteMigration.schemaVersion, CURRENT_PROCESS_ROUTE_SCHEMA_VERSION, '旧路线必须一次迁移到显式边 V2')
assert.equal(legacyRouteMigration.migrationMarker, PROCESS_ROUTE_EXPLICIT_EDGE_MIGRATION_MARKER, '旧路线迁移必须保存可追踪标记')
assert.equal(legacyRouteMigration.migrationApplied, true, 'V1 路线首次读取必须执行一次迁移')
assert.deepEqual(legacyRouteMigration.entries[1]?.predecessorEntryIds, [dyeNode.id], 'V1 step/lane 必须只在迁移时物化为直接前置')
const repeatedRouteMigration = migrateProcessRouteSchema({
  schemaVersion: legacyRouteMigration.schemaVersion,
  migrationMarker: legacyRouteMigration.migrationMarker,
  entries: legacyRouteMigration.entries,
})
assert.equal(repeatedRouteMigration.migrationApplied, false, 'V2 路线重复读取不得再次命中旧 step/lane fallback')
assert.deepEqual(repeatedRouteMigration.entries, legacyRouteMigration.entries, 'V2 显式边重复读取必须保持幂等')

assert.deepEqual(
  removeProcessRouteEdge(dyeThenPrint.entries, dyeNode.id, printNode.id)
    .find((item) => item.id === printNode.id)?.predecessorEntryIds,
  [],
  '底层删边函数必须与页面动作保持一致',
)

const techPackEventsSource = readFileSync(new URL('../src/pages/tech-pack/events.ts', import.meta.url), 'utf8')
const routeSorterSource = readFileSync(new URL('../src/data/tech-pack-process-route.ts', import.meta.url), 'utf8')
const techPackContextSource = readFileSync(new URL('../src/pages/tech-pack/context.ts', import.meta.url), 'utf8')
const processDomainSource = readFileSync(new URL('../src/pages/tech-pack/process-domain.ts', import.meta.url), 'utf8')
const logicFlowSource = readFileSync(new URL('../src/pages/tech-pack/process-route-logicflow.ts', import.meta.url), 'utf8')
const bomLinkageSource = readFileSync(new URL('../src/pages/tech-pack/bom-process-linkage.ts', import.meta.url), 'utf8')
assert.doesNotMatch(
  routeSorterSource,
  /getDefaultProcessRouteOrder|listDefaultProcessRouteOrders|process-craft-dict/,
  '技术包路线排序不得继续读取工序工艺字典默认顺序',
)
assert.doesNotMatch(
  techPackContextSource,
  /DEFAULT_TECHNIQUES|DICT_DEFAULT|技术包默认烫包工序/,
  '空技术包不得再补入硬编码默认路线，路线来源也不得继续标记为字典默认',
)
assert.match(
  techPackContextSource,
  /syncBomDrivenPrepTechniques\(\[\], bomItems\)/,
  '没有款式工序时只能按 BOM 真实要求补入准备工序，不得虚构生产路线',
)
assert.match(processDomainSource, /DICT_REFERENCE: '工序字典引用'/, '技术包来源文案必须只表达字典引用，不表达默认顺序')
assert.doesNotMatch(techPackEventsSource, /hasInvalidDyePrintOrder|move-up|move-down|make-parallel|remove-from-parallel/, '旧列表排序及统一先染后印逻辑必须删除')
assert.match(processDomainSource, /路线图/, '技术包工序标签必须提供路线图视图')
assert.match(processDomainSource, /工艺明细/, '技术包工序标签必须保留现有工艺明细视图')
assert.match(logicFlowSource, /@logicflow\/core/, '路线图必须使用 LogicFlow 核心画布')
assert.match(logicFlowSource, /@logicflow\/layout/, '路线图必须使用受控的自动布局插件')
assert.doesNotMatch(logicFlowSource, /DndPanel|MiniMap|Bpmn|Control\b|NodeSelection/, '不得向业务人员暴露通用流程设计器能力')
assert.match(bomLinkageSource, /routeObjectKey: `BOM:\$\{bomItemId\}`/, 'BOM 自动节点必须保留 BOM 行对象分支')

const generatedDyePrint = syncTechPackProcessesFromBom<BomDrivenPrepTechnique>([], [
  {
    id: 'bom-main-fabric',
    type: '面料',
    materialName: '主面料',
    dyeRequirement: '匹染',
    printRequirement: '数码印',
  },
  {
    id: 'bom-lace-accessory',
    type: '辅料',
    materialName: '花边',
    dyeRequirement: '匹染',
    printRequirement: '数码印',
  },
])
const generatedPrepNodes = generatedDyePrint.techniques.filter((item) => item.processCode === 'DYE' || item.processCode === 'PRINT')
assert.equal(generatedPrepNodes.length, 4, '同款两条 BOM 各自的染色和印花必须形成四个独立 occurrence')
assert.equal(new Set(generatedPrepNodes.map((item) => item.id)).size, 4, '同工序码不得吞并不同 BOM occurrence')
assert.deepEqual(new Set(generatedPrepNodes.map((item) => item.routeObjectKey)), new Set(['BOM:bom-main-fabric', 'BOM:bom-lace-accessory']), '准备节点必须保持各自 BOM 分支')
assert(generatedPrepNodes.every((item) => (item.predecessorEntryIds ?? []).length === 0), 'BOM 只生成节点，不得偷偷注入统一印染顺序')
assert(generatedPrepNodes.some((item) => item.inputObjectType === 'ACCESSORY'), '花边等辅料的染印节点必须保留真实原物料类别')

const garmentNodes = syncTechPackProcessesFromBom<BomDrivenPrepTechnique>([], [{
  id: 'bom-finished-garment',
  type: '成衣',
  materialName: '待加工成衣',
  usageProcessCodes: ['AUX_HEAT_TRANSFER', 'AUX_DIRECT_PRINT'],
  dyeRequirement: '匹染',
  printRequirement: '数码印',
}]).techniques
assert.deepEqual(garmentNodes.map((item) => item.technique).sort(), ['烫画', '直喷'], '成衣 BOM 只能生成成衣烫画和直喷节点')
assert(garmentNodes.every((item) => item.inputObjectType === 'GARMENT' && item.outputObjectType === 'GARMENT'), '成衣烫画/直喷必须保持成衣→成衣')

const patternNodes = syncPatternDrivenTechniques([], [{
  id: 'PAT-CHECK',
  linkedBomItemId: 'bom-main-fabric',
  pieceRows: [
    { id: 'FRONT', name: '前片', specialCrafts: [{ craftCode: 'AUX_HEAT_TRANSFER', craftName: '烫画' }] },
    { id: 'BACK', name: '后片', specialCrafts: [{ craftCode: 'AUX_HEAT_TRANSFER', craftName: '烫画' }] },
  ],
  pieceInstances: [],
} as unknown as PatternItem])
assert.equal(patternNodes.length, 2, '相同烫画工艺绑定两个纸样部位时必须生成两个 occurrence')
assert.equal(new Set(patternNodes.map((item) => item.routeObjectKey)).size, 2, '纸样工艺 occurrence 必须保留具体裁片部位身份')
assert(patternNodes.every((item) => item.sourceType === 'PATTERN' && item.inputObjectType === 'CUT_PIECE'), '物料与纸样关联必须生成裁片对象生产节点')

assert.equal(
  techPackEventsSource.includes('toggle-parallel-group-acceptance') || techPackEventsSource.includes('routeParallelAcceptanceMode'),
  false,
  '技术包路线只描述先后或并行关系，不得继续提供整体承接或连续任务入口',
)

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
    linkedDesignRevisionTaskIds: [],
    linkedPatternTaskIds: [],
    linkedArtworkTaskIds: [],
    createdFromTaskType: 'ENGINEERING_MASTER',
    createdFromTaskId: '',
    createdFromTaskCode: '',
    baseTechnicalVersionId: '',
    baseTechnicalVersionCode: '',
    changeScope: '工程主单生成',
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
      id: `${id}-process-dye`,
      entryType: 'PROCESS_BASELINE',
      stageCode: 'PREP',
      stageName: '准备阶段',
      processCode: 'DYE',
      processName: '染色',
      assignmentGranularity: 'COLOR',
      defaultDocType: 'PREPARATION_ORDER',
      taskTypeMode: 'PROCESS',
      isSpecialCraft: false,
      routeObjectKey: `BOM:${id}-bom`,
      inputObjectType: 'FABRIC',
      outputObjectType: 'FABRIC',
      consumedBomItemIds: [],
      predecessorEntryIds: [],
      routeStepNo: 1,
      routeLaneNo: 1,
      routeSourceKind: 'DICT_REFERENCE',
      linkedBomItemIds: [`${id}-bom`],
      visibleFactoryTypes: ['DYEING'],
    }],
    processRouteStatus: routeConfirmed ? 'CONFIRMED' : 'UNCONFIRMED',
    processRouteConfirmedBy: routeConfirmed ? 'Budi Santoso' : '',
    processRouteConfirmedAt: routeConfirmed ? '2026-07-07 10:10' : '',
    processRouteUpdatedBy: routeConfirmed ? 'Budi Santoso' : '测试用户',
    processRouteUpdatedAt: routeConfirmed ? '2026-07-07 10:10' : '2026-07-07 10:00',
    processRouteChangeReason: routeConfirmed ? '第 2 批确认检查' : '',
    sizeTable: [{ id: `${id}-size`, part: '胸围', S: 90, M: 94, L: 98, XL: 102, tolerance: 1 }],
    bomItems: [{ id: `${id}-bom`, type: '面料', name: '主面料', spec: '100% 棉', unitConsumption: 1, lossRate: 0.03, supplier: '供应商' }],
    bomCustomCosts: [],
    bomCustomCostDecision: 'NO_CUSTOM_COST',
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

const disconnectedSavedRoute = buildRouteGateContent('disconnected-saved-route', true)
const missingBomPrint = buildRouteGateContent('missing-bom-print', true)
missingBomPrint.bomItems[0].printRequirement = '是'
assert.equal(getTechnicalProcessRouteGate('missing-bom-print', missingBomPrint).confirmed, false,
  'BOM 新增印花但保存路线未包含对应节点时，审核门禁必须取消旧确认')
disconnectedSavedRoute.processEntries.push({
  ...disconnectedSavedRoute.processEntries[0], id: 'disconnected-print', processCode: 'PRINT',
})
assert.equal(getTechnicalProcessRouteGate('disconnected-saved-route', disconnectedSavedRoute).confirmed, false,
  '审核门禁也必须阻断保存为已确认但没有连通的路线，不能只修复页面标签')

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
installTechnicalDataVersionFixtures({
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
assert.equal(roundtripContent?.processRouteSchemaVersion, CURRENT_PROCESS_ROUTE_SCHEMA_VERSION, '技术包仓库必须落盘当前路线 schema')
assert.equal(roundtripContent?.processRouteMigrationMarker, PROCESS_ROUTE_EXPLICIT_EDGE_MIGRATION_MARKER, '技术包仓库必须落盘一次迁移标记')
assert.equal(roundtripContent?.processRouteConfirmedBy, 'Budi Santoso', '仓库读取时应保留路线确认人')
assert.equal(roundtripContent?.processRouteConfirmedAt, '2026-07-07 10:10', '仓库读取时应保留路线确认时间')
assert.equal(roundtripContent?.processRouteUpdatedBy, 'Budi Santoso', '仓库读取时应保留路线更新人')
assert.equal(roundtripContent?.processRouteUpdatedAt, '2026-07-07 10:10', '仓库读取时应保留路线更新时间')
assert.equal(roundtripContent?.processRouteChangeReason, '第 2 批确认检查', '仓库读取时应保留路线变更原因')
assert.equal(roundtripContent?.processEntries[0]?.routeStepNo, 1, '仓库读取时工序条目应保留路线步骤')
assert.equal(roundtripContent?.processEntries[0]?.routeLaneNo, 1, '仓库读取时工序条目应保留路线并行线')
assert.equal(roundtripContent?.processEntries[0]?.routeObjectKey, `BOM:${roundtripId}-bom`, '仓库读取时工序条目应保留对象分支')
assert.equal(roundtripContent?.processEntries[0]?.inputObjectType, 'FABRIC', '仓库读取时工序条目应保留投入对象类型')
assert.equal(roundtripContent?.processEntries[0]?.outputObjectType, 'FABRIC', '仓库读取时工序条目应保留产出对象类型')
assert.deepEqual(roundtripContent?.processEntries[0]?.predecessorEntryIds, [], '仓库读取时工序条目应保留显式前置数组')
assert.equal(roundtripContent?.processEntries[0]?.routeSourceKind, 'DICT_REFERENCE', '仓库读取时工序条目应保留字典引用来源')
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
  /核心域未补全，暂不能发布：工艺路线/,
  '发布正式版前必须把未确认路线计入工艺路线核心缺失',
)

console.log('tech-pack process route checks passed')
