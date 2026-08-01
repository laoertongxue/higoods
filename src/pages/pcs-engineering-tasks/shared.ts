// 生产工程专业任务：共享类型、状态、公共渲染与列表公共骨架
// 由 pcs-engineering-tasks.ts（改版/制版/首版样衣/首单样衣）与 pattern-task.ts（花型）共用
// 本文件不依赖任何页面模块，避免循环依赖；页面模块只能单向依赖本文件。

import { renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  resetStandardListEntryTransientStateOnRouteEntry,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListColumnRule,
  type StandardListPageSlice,
  type StandardListSortState,
} from '../../components/ui/list-table-model.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../../components/ui/list-table.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import type {
  PatternTaskColorDepthOption,
  PatternTaskDemandSourceType,
  PatternTaskDifficultyGrade,
  PatternTaskProcessType,
  PatternTaskTeamCode,
} from '../../data/pcs-pattern-task-types.ts'
import type { FirstSamplePurpose, SampleChainMode, SampleMaterialMode, SamplePlanLine, SampleSpecialSceneReasonCode } from '../../data/pcs-sample-chain-types.ts'
import type { FirstSampleTaskRecord } from '../../data/pcs-first-sample-types.ts'
import type { PlateMakingMaterialLine } from '../../data/pcs-plate-making-material-types.ts'
import type { PlateMakingPatternImageLine } from '../../data/pcs-plate-making-pattern-file-types.ts'
import type { RevisionTaskLiveRetestStatus } from '../../data/pcs-revision-task-file-types.ts'
import type { RevisionTaskMaterialLine } from '../../data/pcs-revision-task-material-types.ts'
import type { PatternTaskSourceType, PlateMakingTaskSourceType, RevisionTaskSourceType } from '../../data/pcs-task-source-normalizer.ts'
import { findStyleArchiveByProjectId, listStyleArchives } from '../../data/pcs-style-archive-repository.ts'
import { getProjectById, listProjects } from '../../data/pcs-project-repository.ts'
import { listProjectRelationsBySourceObject } from '../../data/pcs-project-relation-repository.ts'
import { createDefaultSamplePlanLines } from '../../data/pcs-sample-chain-service.ts'
import { escapeHtml, formatDateTime, toClassName } from '../../utils.ts'

export type ModuleKey = 'revision' | 'plate' | 'pattern' | 'firstSample' | 'firstOrder' | 'color' | 'purchase' | 'techPack'
export type TaskBindingMode = 'project' | 'style'
export type RevisionTab = 'plan' | 'issues' | 'samples' | 'outputs' | 'downstream' | 'logs'
export type PlateTab = 'demand' | 'execution' | 'review' | 'outputs' | 'closure' | 'logs'
export type PatternTab = 'demand' | 'execution' | 'review' | 'closure' | 'logs'
export type FirstSampleTab = 'overview' | 'inputs' | 'result' | 'acceptance' | 'logs'
export type FirstOrderTab = 'overview' | 'version' | 'result' | 'conclusion' | 'logs'

export interface EngineeringLog {
  time: string
  action: string
  user: string
  detail: string
}

export interface ListState {
  search: string
  status: string
  owner: string
  source: string
  quickFilter: string
  currentPage: number
}

export interface SampleListState extends ListState {
  site: string
}

export interface EngineeringListRow {
  cells: Record<string, string>
  sortValues: Record<string, unknown>
}

export interface EngineeringListUiState {
  sort: StandardListSortState | null
  columnPreferences: StandardListColumnPreferences
  columnSettingsOpen: boolean
  draggedColumnKey: string
}

export const ENGINEERING_LIST_PAGE_SIZES = [8, 20, 50]
export const ENGINEERING_LIST_MAX_FROZEN_WIDTH = 520
export const ENGINEERING_LIST_STORAGE_KEYS: Record<ModuleKey, string> = {
  revision: 'higood:list-page:/pcs/patterns/revision',
  plate: 'higood:list-page:/pcs/patterns/plate-making',
  pattern: 'higood:list-page:/pcs/patterns/colors',
  firstSample: 'higood:list-page:/pcs/samples/first-sample',
  firstOrder: 'higood:list-page:/pcs/samples/first-order',
  color: 'higood:list-page:/pcs/engineering/color',
  purchase: 'higood:list-page:/pcs/engineering/purchase',
  techPack: 'higood:list-page:/pcs/engineering/tech-pack',
}
export const ENGINEERING_LIST_COLUMN_RULES: Record<ModuleKey, StandardListColumnRule[]> = {
  revision: [
    { key: 'image', required: true, freezeable: true },
    { key: 'task', required: true, freezeable: true },
    { key: 'project', freezeable: true },
    { key: 'style' },
    { key: 'scope' },
    { key: 'retest' },
    { key: 'techPack' },
    { key: 'status', required: true, freezeable: true },
    { key: 'updated', freezeable: true },
    { key: 'actions', required: true, actionColumn: true },
  ],
  plate: [
    { key: 'image', required: true, freezeable: true },
    { key: 'task', required: true, freezeable: true },
    { key: 'projectStyle', freezeable: true },
    { key: 'maker' },
    { key: 'stage' },
    { key: 'next' },
    { key: 'pattern' },
    { key: 'sampleReview' },
    { key: 'techPack' },
    { key: 'updated', freezeable: true },
    { key: 'actions', required: true, actionColumn: true },
  ],
  pattern: [
    { key: 'task', required: true, freezeable: true },
    { key: 'image', required: true, freezeable: true },
    { key: 'project', required: true, freezeable: true },
    { key: 'source' },
    { key: 'process' },
    { key: 'fabric' },
    { key: 'qty' },
    { key: 'difficulty' },
    { key: 'team' },
    { key: 'member' },
    { key: 'buyerReview', required: true, freezeable: true },
    { key: 'library' },
    { key: 'techPack' },
    { key: 'actions', required: true, actionColumn: true },
  ],
  firstSample: [
    { key: 'task', required: true, freezeable: true },
    { key: 'project', freezeable: true },
    { key: 'status', required: true, freezeable: true },
    { key: 'revision' },
    { key: 'site' },
    { key: 'materialMode' },
    { key: 'sampleCode' },
    { key: 'firstOrderBasis' },
    { key: 'actions', required: true, actionColumn: true },
  ],
  firstOrder: [
    { key: 'task', required: true, freezeable: true },
    { key: 'project', freezeable: true },
    { key: 'status', required: true, freezeable: true },
    { key: 'chainMode' },
    { key: 'site' },
    { key: 'patternVersion' },
    { key: 'artworkVersion' },
    { key: 'conclusion' },
    { key: 'actions', required: true, actionColumn: true },
  ],
  color: [
    { key: 'task', required: true, freezeable: true },
    { key: 'master', required: true, freezeable: true },
    { key: 'status', required: true, freezeable: true },
    { key: 'team' },
    { key: 'material' },
    { key: 'rework' },
    { key: 'started' },
    { key: 'actions', required: true, actionColumn: true },
  ],
  purchase: [
    { key: 'task', required: true, freezeable: true },
    { key: 'master', required: true, freezeable: true },
    { key: 'status', required: true, freezeable: true },
    { key: 'team' },
    { key: 'material' },
    { key: 'started' },
    { key: 'actions', required: true, actionColumn: true },
  ],
  techPack: [
    { key: 'task', required: true, freezeable: true },
    { key: 'master', required: true, freezeable: true },
    { key: 'status', required: true, freezeable: true },
    { key: 'team' },
    { key: 'rework' },
    { key: 'started' },
    { key: 'actions', required: true, actionColumn: true },
  ],
}

export function createEngineeringListUiState(module: ModuleKey): EngineeringListUiState {
  const rules = ENGINEERING_LIST_COLUMN_RULES[module]
  return {
    sort: null,
    columnPreferences: normalizeListColumnPreferences(
      rules,
      {
        order: rules.map((rule) => rule.key),
        visibleKeys: rules.map((rule) => rule.key),
        frozenKeys: [],
        pageSize: ENGINEERING_LIST_PAGE_SIZES[0]!,
      },
      ENGINEERING_LIST_PAGE_SIZES,
    ),
    columnSettingsOpen: false,
    draggedColumnKey: '',
  }
}

export interface RevisionCreateDraft {
  bindingMode: TaskBindingMode
  sourceType: RevisionTaskSourceType
  projectId: string
  styleId: string
  upstreamModule: string
  upstreamObjectType: string
  upstreamObjectId: string
  upstreamObjectCode: string
  title: string
  ownerName: string
  dueAt: string
  note: string
  issueSummary: string
  evidenceSummary: string
  evidenceImageUrls: string[]
  scopeCodes: string[]
  createPatternTask: boolean
}

export interface PlateCreateDraft {
  bindingMode: TaskBindingMode
  sourceType: PlateMakingTaskSourceType
  projectId: string
  styleId: string
  title: string
  ownerName: string
  dueAt: string
  productStyleCode: string
  productHistoryType: string
  patternMakerName: string
  patternArea: string
  urgentFlag: boolean
  patternType: string
  sizeRange: string
  note: string
}

export interface PatternCreateDraft {
  bindingMode: TaskBindingMode
  sourceType: PatternTaskSourceType
  projectId: string
  styleId: string
  title: string
  ownerName: string
  dueAt: string
  productStyleCode: string
  demandSourceType: PatternTaskDemandSourceType
  processType: PatternTaskProcessType
  requestQty: string
  fabricSku: string
  fabricName: string
  demandImageIds: string[]
  assignedTeamCode: PatternTaskTeamCode
  assignedMemberId: string
  patternCategoryCode: string
  patternStyleTagsText: string
  hotSellerFlag: boolean
  artworkType: string
  patternMode: string
  artworkName: string
  note: string
}

export interface SampleCreateDraft {
  projectId: string
  title: string
  ownerName: string
  sourceTechPackVersionId: string
  sourceTechPackVersionCode: string
  sourceTechPackVersionLabel: string
  factoryId: string
  factoryName: string
  targetSite: string
  sampleMaterialMode: SampleMaterialMode
  samplePurpose: FirstSamplePurpose
  note: string
}

export interface FirstOrderCreateDraft extends SampleCreateDraft {
  sourceFirstSampleTaskId: string
  patternVersion: string
  artworkVersion: string
  sampleChainMode: SampleChainMode
  specialSceneReasonCodes: SampleSpecialSceneReasonCode[]
  productionReferenceRequiredFlag: boolean
  chinaReviewRequiredFlag: boolean
  correctFabricRequiredFlag: boolean
  samplePlanLinesText: string
  finalReferenceNote: string
}

export interface RevisionDetailDraft {
  participantNamesText: string
  revisionVersion: string
  baseStyleCode: string
  baseStyleName: string
  targetStyleCodeCandidate: string
  targetStyleNameCandidate: string
  targetStyleImageIds: string[]
  sampleQty: string
  stylePreference: string
  patternMakerName: string
  revisionSuggestionRichText: string
  paperPrintAt: string
  deliveryAddress: string
  patternArea: string
  materialAdjustmentLines: RevisionTaskMaterialLine[]
  newPatternImageIds: string[]
  newPatternSpuCode: string
  patternChangeNote: string
  patternPieceImageIds: string[]
  patternFileIds: string[]
  mainImageIds: string[]
  designDraftImageIds: string[]
  liveRetestRequired: boolean
  liveRetestStatus: RevisionTaskLiveRetestStatus
  liveRetestRelationIdsText: string
  liveRetestSummary: string
}

export interface PlateDetailDraft {
  participantNamesText: string
  patternVersion: string
  productHistoryType: string
  patternMakerName: string
  sampleConfirmedAt: string
  urgentFlag: boolean
  patternArea: string
  colorRequirementText: string
  newPatternSpuCode: string
  flowerImageIds: string[]
  materialRequirementLines: PlateMakingMaterialLine[]
  patternImageLineItems: PlateMakingPatternImageLine[]
  patternPdfFileIds: string[]
  patternDxfFileIds: string[]
  patternRulFileIds: string[]
  supportImageIds: string[]
  supportVideoIds: string[]
  partTemplateLinksText: string
  sampleReviewNote: string
}

export interface PatternDetailDraft {
  artworkVersion: string
  difficultyGrade: PatternTaskDifficultyGrade
  colorDepthOption: PatternTaskColorDepthOption
  physicalReferenceNote: string
  colorConfirmNote: string
  completionImageIds: string[]
  patternFileIds: string[]
  liveReferenceImageIds: string[]
  imageReferenceIds: string[]
  buyerReviewNote: string
  transferReason: string
  patternCategoryCode: string
  patternStyleTagsText: string
  hotSellerFlag: boolean
}

export interface FirstSampleDetailDraft {
  sampleCode: string
  sampleImageIdsText: string
  fitConfirmationSummary: string
  artworkConfirmationSummary: string
  productionReadinessNote: string
  reuseAsFirstOrderBasisFlag: boolean
  reuseAsFirstOrderBasisConfirmedAt: string
  reuseAsFirstOrderBasisConfirmedBy: string
  reuseAsFirstOrderBasisNote: string
  confirmedAt: string
}

export interface FirstOrderDetailDraft {
  patternVersion: string
  artworkVersion: string
  samplePlanLinesText: string
  finalReferenceNote: string
  sampleCode: string
  conclusionResult: '' | '通过' | '需改版' | '需补首单'
  conclusionNote: string
  confirmedAt: string
  confirmedBy: string
}

export interface FirstSampleStartDraft {
  operatorName: string
  startedAt: string
  planFinishAt: string
  startNote: string
}

export interface FirstSampleResultDraft {
  sampleCode: string
  submittedBy: string
  completedAt: string
  sampleImageIds: string[]
  resultNote: string
}

export interface FirstOrderStartDraft {
  operatorName: string
  startedAt: string
  planFinishAt: string
  factoryConfirmNote: string
}

export interface FirstOrderResultDraft {
  sampleCode: string
  submittedBy: string
  completedAt: string
  finalReferenceNote: string
  samplePlanLinesText: string
  resultNote: string
}

export const COMMON_STATUS_META: Record<string, { label: string; className: string }> = {
  草稿: { label: '草稿', className: 'bg-slate-100 text-slate-700' },
  未开始: { label: '未开始', className: 'bg-slate-100 text-slate-700' },
  进行中: { label: '进行中', className: 'bg-blue-100 text-blue-700' },
  待确认: { label: '待确认', className: 'bg-amber-100 text-amber-700' },
  已确认: { label: '待生成技术包', className: 'bg-emerald-100 text-emerald-700' },
  已生成技术包: { label: '待完成', className: 'bg-cyan-100 text-cyan-700' },
  已完成: { label: '已完成', className: 'bg-green-100 text-green-700' },
  异常待处理: { label: '阻塞', className: 'bg-rose-100 text-rose-700' },
  已取消: { label: '已取消', className: 'bg-slate-100 text-slate-500' },
  未启用: { label: '未启用', className: 'bg-slate-100 text-slate-400' },
  待前置: { label: '待前置', className: 'bg-slate-100 text-slate-700' },
  待开始: { label: '待开始', className: 'bg-slate-100 text-slate-700' },
  待审核: { label: '待审核', className: 'bg-amber-100 text-amber-700' },
  返工中: { label: '返工中', className: 'bg-orange-100 text-orange-700' },
  因需求变更结束: { label: '因需求变更结束', className: 'bg-slate-100 text-slate-500' },
  未提交: { label: '未提交', className: 'bg-slate-100 text-slate-700' },
  待样板确认: { label: '待样板确认', className: 'bg-amber-100 text-amber-700' },
  样板已通过: { label: '样板已通过', className: 'bg-emerald-100 text-emerald-700' },
  样板已驳回: { label: '样板已驳回', className: 'bg-rose-100 text-rose-700' },
  制版执行中: { label: '制版执行中', className: 'bg-blue-100 text-blue-700' },
  待提交样板确认: { label: '待提交样板确认', className: 'bg-indigo-100 text-indigo-700' },
  待生成技术包: { label: '待生成技术包', className: 'bg-emerald-100 text-emerald-700' },
  待完成任务: { label: '待完成任务', className: 'bg-cyan-100 text-cyan-700' },
}

// 专业任务通用状态筛选：保留异常阻塞与已取消，便于筛选历史状态任务
export const ENGINEERING_COMMON_FILTER_STATUS_OPTIONS = ['进行中', '待确认', '已确认', '已生成技术包', '已完成', '异常待处理', '已取消']
export const REVISION_FILTER_STATUS_OPTIONS = ['进行中', '待确认', '已确认', '已生成技术包', '已完成']

export const SAMPLE_STATUS_META: Record<string, { label: string; className: string }> = {
  草稿: { label: '草稿', className: 'bg-slate-100 text-slate-700' },
  待处理: { label: '待处理', className: 'bg-slate-100 text-slate-700' },
  打样中: { label: '打样中', className: 'bg-blue-100 text-blue-700' },
  待确认: { label: '待确认', className: 'bg-amber-100 text-amber-700' },
  已通过: { label: '已通过', className: 'bg-emerald-100 text-emerald-700' },
  需改版: { label: '需改版', className: 'bg-orange-100 text-orange-700' },
  需补样: { label: '需补样', className: 'bg-violet-100 text-violet-700' },
  需补首单: { label: '需补首单', className: 'bg-violet-100 text-violet-700' },
  已取消: { label: '已取消', className: 'bg-slate-100 text-slate-500' },
}

export const REVISION_SCOPE_OPTIONS = [
  { value: 'PATTERN', label: '版型结构' },
  { value: 'SIZE', label: '尺码规格' },
  { value: 'FABRIC', label: '面料' },
  { value: 'ACCESSORIES', label: '辅料' },
  { value: 'CRAFT', label: '工艺' },
  { value: 'PRINT', label: '花型' },
  { value: 'COLOR', label: '颜色' },
  { value: 'PACKAGE', label: '包装标识' },
] as const

export const PATTERN_DEMAND_SOURCE_OPTIONS: PatternTaskDemandSourceType[] = ['预售测款通过', '改版任务', '设计师款']
export const PATTERN_PROCESS_OPTIONS: PatternTaskProcessType[] = ['数码印', '烫画', '直喷']
export const PATTERN_COLOR_DEPTH_OPTIONS: PatternTaskColorDepthOption[] = ['浅色', '深色', '中间值']
export const PATTERN_DIFFICULTY_OPTIONS: PatternTaskDifficultyGrade[] = ['A++', 'A+', 'A', 'B', 'C', 'D']

export const SAMPLE_SITE_OPTIONS = ['all', '深圳', '雅加达']
export const SAMPLE_CHAIN_MODE_OPTIONS: SampleChainMode[] = ['复用首版结论', '新增首单样衣确认', '替代布与正确布双确认']
export const SAMPLE_SPECIAL_REASON_OPTIONS: SampleSpecialSceneReasonCode[] = ['定位印', '大货量大', '工厂参照样', '正确布确认', '其它']

export const initialRevisionCreateDraft = (): RevisionCreateDraft => ({
  bindingMode: 'project',
  sourceType: '测款结论返改',
  projectId: '',
  styleId: '',
  upstreamModule: '',
  upstreamObjectType: '',
  upstreamObjectId: '',
  upstreamObjectCode: '',
  title: '',
  ownerName: '',
  dueAt: '',
  note: '',
  issueSummary: '',
  evidenceSummary: '',
  evidenceImageUrls: [],
  scopeCodes: ['PATTERN'],
  createPatternTask: false,
})

export const initialRevisionDetailDraft = (): RevisionDetailDraft => ({
  participantNamesText: '',
  revisionVersion: '',
  baseStyleCode: '',
  baseStyleName: '',
  targetStyleCodeCandidate: '',
  targetStyleNameCandidate: '',
  targetStyleImageIds: [],
  sampleQty: '',
  stylePreference: '',
  patternMakerName: '',
  revisionSuggestionRichText: '',
  paperPrintAt: '',
  deliveryAddress: '',
  patternArea: '',
  materialAdjustmentLines: [],
  newPatternImageIds: [],
  newPatternSpuCode: '',
  patternChangeNote: '',
  patternPieceImageIds: [],
  patternFileIds: [],
  mainImageIds: [],
  designDraftImageIds: [],
  liveRetestRequired: false,
  liveRetestStatus: '不需要',
  liveRetestRelationIdsText: '',
  liveRetestSummary: '',
})

export const initialPlateCreateDraft = (): PlateCreateDraft => ({
  bindingMode: 'project',
  sourceType: '商品项目',
  projectId: '',
  styleId: '',
  title: '',
  ownerName: '',
  dueAt: '',
  productStyleCode: '',
  productHistoryType: '未卖过',
  patternMakerName: '',
  patternArea: '印尼',
  urgentFlag: false,
  patternType: '',
  sizeRange: '',
  note: '',
})

export const initialPatternCreateDraft = (): PatternCreateDraft => ({
  bindingMode: 'project',
  sourceType: '商品项目',
  projectId: '',
  styleId: '',
  title: '',
  ownerName: '',
  dueAt: '',
  productStyleCode: '',
  demandSourceType: '预售测款通过',
  processType: '数码印',
  requestQty: '1',
  fabricSku: '',
  fabricName: '',
  demandImageIds: [],
  assignedTeamCode: 'CN_TEAM',
  assignedMemberId: 'cn_bing_bing',
  patternCategoryCode: '植物与花卉',
  patternStyleTagsText: '休闲、印花',
  hotSellerFlag: false,
  artworkType: '印花',
  patternMode: '定位印',
  artworkName: '',
  note: '',
})

export const initialPlateDetailDraft = (): PlateDetailDraft => ({
  participantNamesText: '',
  patternVersion: '',
  productHistoryType: '',
  patternMakerName: '',
  sampleConfirmedAt: '',
  urgentFlag: false,
  patternArea: '',
  colorRequirementText: '',
  newPatternSpuCode: '',
  flowerImageIds: [],
  materialRequirementLines: [],
  patternImageLineItems: [],
  patternPdfFileIds: [],
  patternDxfFileIds: [],
  patternRulFileIds: [],
  supportImageIds: [],
  supportVideoIds: [],
  partTemplateLinksText: '',
  sampleReviewNote: '',
})

export const initialPatternDetailDraft = (): PatternDetailDraft => ({
  artworkVersion: '',
  difficultyGrade: 'A',
  colorDepthOption: '中间值',
  physicalReferenceNote: '',
  colorConfirmNote: '',
  completionImageIds: [],
  patternFileIds: [],
  liveReferenceImageIds: [],
  imageReferenceIds: [],
  buyerReviewNote: '',
  transferReason: '',
  patternCategoryCode: '',
  patternStyleTagsText: '',
  hotSellerFlag: false,
})

export const initialSampleCreateDraft = (): SampleCreateDraft => ({
  projectId: '',
  title: '',
  ownerName: '',
  sourceTechPackVersionId: '',
  sourceTechPackVersionCode: '',
  sourceTechPackVersionLabel: '',
  factoryId: '',
  factoryName: '',
  targetSite: '深圳',
  sampleMaterialMode: '正确布',
  samplePurpose: '首版确认',
  note: '',
})

export const initialFirstOrderCreateDraft = (): FirstOrderCreateDraft => ({
  ...initialSampleCreateDraft(),
  sourceFirstSampleTaskId: '',
  patternVersion: '',
  artworkVersion: '',
  sampleChainMode: '复用首版结论',
  specialSceneReasonCodes: [],
  productionReferenceRequiredFlag: false,
  chinaReviewRequiredFlag: false,
  correctFabricRequiredFlag: false,
  samplePlanLinesText: serializeFirstOrderSamplePlanLines(createDefaultSamplePlanLines('复用首版结论')),
  finalReferenceNote: '',
})

export const initialFirstSampleDetailDraft = (): FirstSampleDetailDraft => ({
  sampleCode: '',
  sampleImageIdsText: '',
  fitConfirmationSummary: '',
  artworkConfirmationSummary: '',
  productionReadinessNote: '',
  reuseAsFirstOrderBasisFlag: false,
  reuseAsFirstOrderBasisConfirmedAt: '',
  reuseAsFirstOrderBasisConfirmedBy: '',
  reuseAsFirstOrderBasisNote: '',
  confirmedAt: '',
})

export function buildFirstSampleDetailDraft(task: FirstSampleTaskRecord): FirstSampleDetailDraft {
  return {
    sampleCode: task.sampleCode || '',
    sampleImageIdsText: (task.sampleImageIds || []).join('\n'),
    fitConfirmationSummary: task.fitConfirmationSummary || '',
    artworkConfirmationSummary: task.artworkConfirmationSummary || '',
    productionReadinessNote: task.productionReadinessNote || '',
    reuseAsFirstOrderBasisFlag: Boolean(task.reuseAsFirstOrderBasisFlag),
    reuseAsFirstOrderBasisConfirmedAt: task.reuseAsFirstOrderBasisConfirmedAt || '',
    reuseAsFirstOrderBasisConfirmedBy: task.reuseAsFirstOrderBasisConfirmedBy || '',
    reuseAsFirstOrderBasisNote: task.reuseAsFirstOrderBasisNote || '',
    confirmedAt: task.confirmedAt || '',
  }
}

export const initialFirstOrderDetailDraft = (): FirstOrderDetailDraft => ({
  patternVersion: '',
  artworkVersion: '',
  samplePlanLinesText: '',
  finalReferenceNote: '',
  sampleCode: '',
  conclusionResult: '',
  conclusionNote: '',
  confirmedAt: '',
  confirmedBy: '',
})

export const initialFirstSampleStartDraft = (): FirstSampleStartDraft => ({
  operatorName: '当前用户',
  startedAt: nowText(),
  planFinishAt: '',
  startNote: '',
})

export const initialFirstSampleResultDraft = (): FirstSampleResultDraft => ({
  sampleCode: '',
  submittedBy: '当前用户',
  completedAt: nowText(),
  sampleImageIds: [],
  resultNote: '',
})

export const initialFirstOrderStartDraft = (): FirstOrderStartDraft => ({
  operatorName: '当前用户',
  startedAt: nowText(),
  planFinishAt: '',
  factoryConfirmNote: '',
})

export const initialFirstOrderResultDraft = (): FirstOrderResultDraft => ({
  sampleCode: '',
  submittedBy: '当前用户',
  completedAt: nowText(),
  finalReferenceNote: '',
  samplePlanLinesText: '',
  resultNote: '',
})

export function serializeFirstOrderSamplePlanLines(lines: SamplePlanLine[]): string {
  return (lines || [])
    .map((line) =>
      [
        line.sampleRole,
        line.materialMode,
        line.quantity,
        line.targetFactoryName,
        line.linkedSampleCode,
        line.status,
        line.note,
      ]
        .map((item) => String(item ?? '').trim())
        .join(' | '),
    )
    .join('\n')
}

export const state = {
  notice: null as string | null,
  revisionList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 } as ListState,
  revisionTab: 'plan' as RevisionTab,
  revisionCreateOpen: false,
  revisionCreateDraft: initialRevisionCreateDraft(),
  revisionDetailDraftTaskId: '',
  revisionDetailDraft: initialRevisionDetailDraft(),
  imagePreview: { open: false, url: '', title: '' },

  plateList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 } as ListState,
  plateTab: 'demand' as PlateTab,
  plateCreateOpen: false,
  plateCreateDraft: initialPlateCreateDraft(),
  plateDetailDraftTaskId: '',
  plateDetailDraft: initialPlateDetailDraft(),

  patternList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 } as ListState,
  patternTab: 'demand' as PatternTab,
  patternCreateOpen: false,
  patternCreateDraft: initialPatternCreateDraft(),
  patternDetailDraftTaskId: '',
  patternDetailDraft: initialPatternDetailDraft(),

  firstSampleList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1, site: 'all' } as SampleListState,
  firstSampleTab: 'overview' as FirstSampleTab,
  firstSampleCreateOpen: false,
  firstSampleCreateDraft: initialSampleCreateDraft(),
  firstSampleDetailDraftTaskId: '',
  firstSampleDetailDraft: initialFirstSampleDetailDraft(),
  firstSampleStartOpen: false,
  firstSampleStartTaskId: '',
  firstSampleStartDraft: initialFirstSampleStartDraft(),
  firstSampleResultOpen: false,
  firstSampleResultTaskId: '',
  firstSampleResultDraft: initialFirstSampleResultDraft(),
  firstSampleAcceptanceOpen: false,
  firstSampleAcceptanceTaskId: '',
  firstSampleAcceptanceResult: '通过',
  firstSampleAcceptanceNote: '',
  firstSampleAcceptanceArtworkSummary: '',
  firstSampleAcceptanceConfirmedBy: '当前用户',
  firstSampleAcceptanceConfirmedAt: nowText(),

  firstOrderList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1, site: 'all' } as SampleListState,
  firstOrderTab: 'overview' as FirstOrderTab,
  firstOrderCreateOpen: false,
  firstOrderCreateDraft: initialFirstOrderCreateDraft(),
  firstOrderDetailDraftTaskId: '',
  firstOrderDetailDraft: initialFirstOrderDetailDraft(),
  firstOrderStartOpen: false,
  firstOrderStartTaskId: '',
  firstOrderStartDraft: initialFirstOrderStartDraft(),
  firstOrderResultOpen: false,
  firstOrderResultTaskId: '',
  firstOrderResultDraft: initialFirstOrderResultDraft(),
  firstOrderConclusionOpen: false,
  firstOrderConclusionTaskId: '',
  firstOrderConclusionResult: '通过',
  firstOrderConclusionNote: '',
  firstOrderConclusionConfirmedBy: '当前用户',
  firstOrderConclusionConfirmedAt: nowText(),

  colorList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 } as ListState,
  purchaseList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 } as ListState,
  techPackList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 } as ListState,
}

export const engineeringListUiState: Record<ModuleKey, EngineeringListUiState> = {
  revision: createEngineeringListUiState('revision'),
  plate: createEngineeringListUiState('plate'),
  pattern: createEngineeringListUiState('pattern'),
  firstSample: createEngineeringListUiState('firstSample'),
  firstOrder: createEngineeringListUiState('firstOrder'),
  color: createEngineeringListUiState('color'),
  purchase: createEngineeringListUiState('purchase'),
  techPack: createEngineeringListUiState('techPack'),
}
export const engineeringListPreferencesLoaded: Record<ModuleKey, boolean> = {
  revision: false,
  plate: false,
  pattern: false,
  firstSample: false,
  firstOrder: false,
  color: false,
  purchase: false,
  techPack: false,
}

export const runtimeLogs: Record<ModuleKey, Map<string, EngineeringLog[]>> = {
  revision: new Map(),
  plate: new Map(),
  pattern: new Map(),
  firstSample: new Map(),
  firstOrder: new Map(),
  color: new Map(),
  purchase: new Map(),
  techPack: new Map(),
}

export const firstSampleAcceptanceMap = new Map<string, { result: string; note: string; updatedAt: string }>()
export const firstOrderConclusionMap = new Map<string, { result: string; note: string; updatedAt: string }>()
export function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

export function todayText(): string {
  return nowText().slice(0, 10)
}

export function setNotice(message: string): void {
  state.notice = message
}

export function clearNotice(): void {
  state.notice = null
}

export function pushRuntimeLog(module: ModuleKey, taskId: string, action: string, detail: string, user = '当前用户'): void {
  const logs = runtimeLogs[module].get(taskId) || []
  runtimeLogs[module].set(taskId, [{ time: nowText(), action, detail, user }, ...logs])
}

export function baseLogs(task: { createdAt: string; createdBy: string; updatedAt: string; updatedBy: string; title: string }): EngineeringLog[] {
  const logs: EngineeringLog[] = [
    { time: task.updatedAt, action: '最近更新', user: task.updatedBy || '系统初始化', detail: `已更新：${task.title}` },
    { time: task.createdAt, action: '创建任务', user: task.createdBy || '系统初始化', detail: `已建立正式任务：${task.title}` },
  ]
  return logs.sort((left, right) => right.time.localeCompare(left.time))
}

export function mergeLogs(module: ModuleKey, taskId: string, logs: EngineeringLog[]): EngineeringLog[] {
  return [...(runtimeLogs[module].get(taskId) || []), ...logs].sort((left, right) => right.time.localeCompare(left.time))
}

export function getCommonStatusMeta(status: string): { label: string; className: string } {
  return COMMON_STATUS_META[status] || { label: status || '-', className: 'bg-slate-100 text-slate-600' }
}

export function getStatusFilterLabel(status: string): string {
  return COMMON_STATUS_META[status]?.label || status
}

export function getSampleStatusMeta(status: string): { label: string; className: string } {
  return SAMPLE_STATUS_META[status] || { label: status || '-', className: 'bg-slate-100 text-slate-600' }
}

export function renderStatusBadge(status: string, sample = false): string {
  const meta = sample ? getSampleStatusMeta(status) : getCommonStatusMeta(status)
  return `<span class="${escapeHtml(toClassName('inline-flex rounded-full px-2.5 py-1 text-xs font-medium', meta.className))}">${escapeHtml(meta.label)}</span>`
}

export function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p>${escapeHtml(state.notice)}</p>
        </div>
        <button type="button" class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-engineering-action="close-notice">关闭</button>
      </div>
    </section>
  `
}

export function renderMetricButton(label: string, value: number, active: boolean, quickFilter: string, actionPrefix: string): string {
  return `
    <button
      type="button"
      class="${escapeHtml(
        toClassName(
          'flex h-12 min-w-[12rem] flex-[1_1_12rem] items-center justify-between gap-3 rounded-lg border px-3 text-left transition hover:border-blue-300',
          active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white',
        ),
      )}"
      data-pcs-engineering-action="${escapeHtml(actionPrefix)}"
      data-quick-filter="${escapeHtml(quickFilter)}"
    >
      <span class="whitespace-nowrap text-xs text-slate-500">${escapeHtml(label)}</span>
      <strong class="whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">${escapeHtml(value)}</strong>
    </button>
  `
}

export function createEngineeringListColumns(
  specs: Array<Omit<StandardListColumn<EngineeringListRow>, 'render' | 'sortValue'>>,
): StandardListColumn<EngineeringListRow>[] {
  return specs.map((spec) => ({
    ...spec,
    render: (row) => row.cells[spec.key] || '<span class="text-slate-400">-</span>',
    sortValue: spec.sortable ? (row) => row.sortValues[spec.key] : undefined,
  }))
}

export function getEngineeringListStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function normalizeEngineeringListPreferences(
  module: ModuleKey,
  columns: readonly StandardListColumn<EngineeringListRow>[],
  raw: Partial<StandardListColumnPreferences> | null | undefined,
): StandardListColumnPreferences {
  const normalized = normalizeListColumnPreferences(
    ENGINEERING_LIST_COLUMN_RULES[module],
    raw,
    ENGINEERING_LIST_PAGE_SIZES,
  )
  const columnsByKey = new Map(columns.map((column) => [column.key, column]))
  const visibleKeys = new Set(normalized.visibleKeys)
  const requestedFrozenKeys = new Set(normalized.frozenKeys)
  const frozenColumns = normalized.order
    .map((key) => columnsByKey.get(key))
    .filter((column): column is StandardListColumn<EngineeringListRow> => Boolean(
      column
      && column.freezeable
      && !column.actionColumn
      && visibleKeys.has(column.key)
      && requestedFrozenKeys.has(column.key),
    ))
  let frozenWidth = frozenColumns.reduce(
    (sum, column) => sum + Math.max(column.width, column.minWidth ?? 0),
    0,
  )
  while (frozenWidth > ENGINEERING_LIST_MAX_FROZEN_WIDTH && frozenColumns.length > 0) {
    const removed = frozenColumns.pop()
    if (removed) frozenWidth -= Math.max(removed.width, removed.minWidth ?? 0)
  }
  return {
    ...normalized,
    frozenKeys: frozenColumns.map((column) => column.key),
  }
}

export function ensureEngineeringListPreferences(
  module: ModuleKey,
  columns: readonly StandardListColumn<EngineeringListRow>[],
): void {
  if (engineeringListPreferencesLoaded[module]) return
  engineeringListPreferencesLoaded[module] = true
  const storage = getEngineeringListStorage()
  const loaded = storage
    ? loadListColumnPreferences(
        storage,
        ENGINEERING_LIST_STORAGE_KEYS[module],
        ENGINEERING_LIST_COLUMN_RULES[module],
        engineeringListUiState[module].columnPreferences,
        ENGINEERING_LIST_PAGE_SIZES,
      )
    : engineeringListUiState[module].columnPreferences
  engineeringListUiState[module].columnPreferences = normalizeEngineeringListPreferences(module, columns, loaded)
}

export function saveEngineeringListPreferences(module: ModuleKey): void {
  const storage = getEngineeringListStorage()
  if (storage) {
    saveListColumnPreferences(
      storage,
      ENGINEERING_LIST_STORAGE_KEYS[module],
      engineeringListUiState[module].columnPreferences,
    )
  }
}

export function withEngineeringListLocalInteractions(module: ModuleKey, html: string): string {
  return html
    .replace(/data-pcs-engineering-action="([^"]+)"/g, (attribute, action: string) => {
      const localActions = new Set([
        'sort-column',
        'prev-page',
        'next-page',
        'open-column-settings',
        'close-column-settings',
        'restore-column-settings',
        'toggle-column-visibility',
        'toggle-column-freeze',
      ])
      if (!localActions.has(action) && !/^set-(revision|plate|pattern|first-sample|first-order|color|purchase|tech-pack)-quick-filter$/.test(action)) {
        return attribute
      }
      return `data-skip-page-rerender="true" data-pcs-engineering-list-module="${module}" ${attribute}`
    })
    .replace(/data-pcs-engineering-field="([^"]+)"/g, (attribute, field: string) => {
      if (field !== 'pageSize' && !/^(revision|plate|pattern|first-sample|first-order|color|purchase|tech-pack)-(search|status|owner|source|site)$/.test(field)) {
        return attribute
      }
      return `data-skip-page-rerender="true" data-pcs-engineering-list-module="${module}" ${attribute}`
    })
}

export function renderEngineeringListPrimaryActions(actionLabel: string, action: string): string {
  // 以 nav: 前缀声明的动作渲染为页面导航按钮（走全局 data-nav 处理）
  const isNav = action.startsWith('nav:')
  const navPath = isNav ? action.slice(4) : ''
  return `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="refresh-page">
        <i data-lucide="refresh-cw" class="h-4 w-4"></i>刷新
      </button>
      <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" ${isNav ? `data-nav="${escapeHtml(navPath)}"` : `data-pcs-engineering-action="${escapeHtml(action)}"`}>
        <i data-lucide="plus" class="h-4 w-4"></i>${escapeHtml(actionLabel)}
      </button>
    </div>
  `
}

export interface EngineeringListView {
  rows: EngineeringListRow[]
  paging: StandardListPageSlice<EngineeringListRow>
}

export function getEngineeringListView(
  module: ModuleKey,
  rows: EngineeringListRow[],
  columns: readonly StandardListColumn<EngineeringListRow>[],
  listState: ListState | SampleListState,
): EngineeringListView {
  ensureEngineeringListPreferences(module, columns)
  const uiState = engineeringListUiState[module]
  const sorted = sortStandardListRows(
    rows,
    uiState.sort,
    (row, key) => row.sortValues[key],
  )
  const paging = paginateStandardListRows(
    sorted,
    listState.currentPage,
    uiState.columnPreferences.pageSize,
  )
  listState.currentPage = paging.currentPage
  return { rows: sorted, paging }
}

export function renderEngineeringListTable(
  module: ModuleKey,
  columns: readonly StandardListColumn<EngineeringListRow>[],
  paging: StandardListPageSlice<EngineeringListRow>,
  emptyText: string,
): string {
  return withEngineeringListLocalInteractions(module, renderStandardListTable({
    columns,
    rows: paging.rows,
    preferences: engineeringListUiState[module].columnPreferences,
    sort: engineeringListUiState[module].sort,
    eventPrefix: 'pcs-engineering',
    emptyText,
  }))
}

export function renderEngineeringListPagination(
  module: ModuleKey,
  paging: StandardListPageSlice<EngineeringListRow>,
): string {
  return withEngineeringListLocalInteractions(module, renderTablePagination({
    total: paging.total,
    from: paging.from,
    to: paging.to,
    currentPage: paging.currentPage,
    totalPages: paging.totalPages,
    pageSize: paging.pageSize,
    actionPrefix: 'pcs-engineering',
    fieldPrefix: 'pcs-engineering',
    pageSizeOptions: ENGINEERING_LIST_PAGE_SIZES,
  }))
}

export function renderEngineeringListColumnOverlay(
  module: ModuleKey,
  columns: readonly StandardListColumn<EngineeringListRow>[],
): string {
  if (!engineeringListUiState[module].columnSettingsOpen) return ''
  return withEngineeringListLocalInteractions(module, renderStandardListColumnSettings({
    title: '列设置',
    columns,
    preferences: engineeringListUiState[module].columnPreferences,
    eventPrefix: 'pcs-engineering',
    maxFrozenWidth: ENGINEERING_LIST_MAX_FROZEN_WIDTH,
  }))
}

export interface EngineeringStandardListPageConfig {
  module: ModuleKey
  title: string
  createLabel: string
  createAction: string
  filtersHtml: string
  statsHtml: string
  rows: EngineeringListRow[]
  columns: readonly StandardListColumn<EngineeringListRow>[]
  listState: ListState | SampleListState
  emptyText: string
  overlaysHtml?: string
}

export function renderEngineeringStandardListPage(config: EngineeringStandardListPageConfig): string {
  ensureEngineeringListPreferences(config.module, config.columns)
  const transient = {
    currentPage: config.listState.currentPage,
    sort: engineeringListUiState[config.module].sort,
  }
  const hasMountedRoot = typeof document !== 'undefined'
    && Boolean(document.querySelector(`[data-pcs-engineering-list-module="${config.module}"]`))
  resetStandardListEntryTransientStateOnRouteEntry(transient, hasMountedRoot)
  config.listState.currentPage = transient.currentPage
  engineeringListUiState[config.module].sort = transient.sort
  const view = getEngineeringListView(config.module, config.rows, config.columns, config.listState)
  const columnSettingsButton = withEngineeringListLocalInteractions(
    config.module,
    renderSecondaryButton(
      '列设置',
      { prefix: 'pcs-engineering', action: 'open-column-settings' },
      'settings-2',
    ),
  )

  return `
    <div class="min-w-0 max-w-full" data-pcs-engineering-list-module="${config.module}">
      ${renderStandardListPage({
        title: config.title,
        primaryActionsHtml: renderEngineeringListPrimaryActions(config.createLabel, config.createAction),
        feedbackHtml: renderNotice(),
        filtersHtml: withEngineeringListLocalInteractions(config.module, config.filtersHtml),
        statsHtml: `<div data-pcs-engineering-list-region="${config.module}-stats">${withEngineeringListLocalInteractions(config.module, config.statsHtml)}</div>`,
        listTitle: `${config.title}列表`,
        listActionsHtml: columnSettingsButton,
        tableHtml: `<div data-pcs-engineering-list-region="${config.module}-table">${renderEngineeringListTable(config.module, config.columns, view.paging, config.emptyText)}</div>`,
        paginationHtml: `<div data-pcs-engineering-list-region="${config.module}-pagination">${renderEngineeringListPagination(config.module, view.paging)}</div>`,
        overlaysHtml: `
          <div data-pcs-engineering-list-region="${config.module}-column-overlay">${renderEngineeringListColumnOverlay(config.module, config.columns)}</div>
          ${config.overlaysHtml || ''}
        `,
        className: 'min-w-0 max-w-full',
      })}
    </div>
  `
}

export function isOverdue(dateTime: string, done: boolean): boolean {
  if (!dateTime || done) return false
  return dateTime.slice(0, 10) < todayText()
}

export function projectButton(projectId: string, projectCode: string, projectName: string): string {
  if (!projectId) return '<span class="text-slate-400">未关联商品项目</span>'
  return `<button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(projectId)}">${escapeHtml(projectCode || projectName)}</button>`
}

export function hasCompletedProjectRelation(
  sourceModule: string,
  sourceObjectType: string,
  sourceObjectId: string,
): boolean {
  return listProjectRelationsBySourceObject({
    sourceModule,
    sourceObjectType,
    sourceObjectId,
  }).some((relation) => relation.projectId && relation.sourceStatus === '已完成')
}

export function styleArchiveButton(styleId: string, styleCode: string, styleName: string): string {
  if (!styleId) return '<span class="text-slate-400">待选择款式档案</span>'
  return `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/products/styles/${escapeHtml(styleId)}">${escapeHtml(styleCode || styleName || '查看款式档案')}</button>`
}

export function styleArchiveLinkByProject(projectId: string): string {
  const style = findStyleArchiveByProjectId(projectId)
  if (!style) return '<span class="text-slate-400">待建立</span>'
  return `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/products/styles/${escapeHtml(style.styleId)}">${escapeHtml(style.styleCode)}</button>`
}

export function revisionTaskNewTabLink(revisionTaskId: string, revisionTaskCode: string): string {
  if (!revisionTaskId) return '<span class="text-slate-400">未创建改版任务</span>'
  return `<a class="font-medium text-blue-700 hover:underline" href="/pcs/patterns/revision/${escapeHtml(revisionTaskId)}" target="_blank" rel="noreferrer">${escapeHtml(revisionTaskCode || '查看改版任务')}</a>`
}

export function styleArchiveLink(
  styleId: string,
  styleCode: string,
  styleName: string,
  projectId = '',
): string {
  if (styleId) return styleArchiveButton(styleId, styleCode, styleName)
  if (projectId) return styleArchiveLinkByProject(projectId)
  return '<span class="text-slate-400">未关联款式档案</span>'
}

export function getTaskStyleInfo(task: {
  styleId?: string
  styleCode?: string
  styleName?: string
  projectId: string
  productStyleCode?: string
  spuCode?: string
}): { styleId: string; styleCode: string; styleName: string } {
  if (task.styleId) {
    return {
      styleId: task.styleId,
      styleCode: task.styleCode || task.productStyleCode || task.spuCode || '',
      styleName: task.styleName || '',
    }
  }
  const style = findStyleArchiveByProjectId(task.projectId)
  return {
    styleId: style?.styleId || '',
    styleCode: style?.styleCode || task.styleCode || task.productStyleCode || task.spuCode || '',
    styleName: style?.styleName || task.styleName || '',
  }
}

export function techPackLinkByProject(projectId: string, technicalVersionId: string, fallbackLabel: string): string {
  const style = findStyleArchiveByProjectId(projectId)
  if (!style || !technicalVersionId) return '<span class="text-slate-400">未生成</span>'
  return `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/products/styles/${escapeHtml(style.styleId)}/technical-data/${escapeHtml(technicalVersionId)}">${escapeHtml(fallbackLabel)}</button>`
}

export function getOwners(items: Array<{ ownerName: string }>): string[] {
  return Array.from(new Set(items.map((item) => item.ownerName).filter(Boolean))).sort((left, right) => left.localeCompare(right))
}

export function getSources(items: Array<{ sourceType: string }>): string[] {
  return Array.from(new Set(items.map((item) => item.sourceType).filter(Boolean))).sort((left, right) => left.localeCompare(right))
}

export function buildStyleArchiveOptions(): Array<{ value: string; label: string }> {
  return listStyleArchives().map((style) => ({
    value: style.styleId,
    label: `${style.styleCode} · ${style.styleName}`,
  }))
}

export function renderListFilters(input: {
  searchPlaceholder: string
  listState: ListState | SampleListState
  searchField: string
  statusField: string
  ownerField: string
  sourceField: string
  statusOptions: readonly string[]
  ownerOptions: readonly string[]
  sourceOptions: readonly string[]
  siteField?: string
  siteOptions?: readonly string[]
}): string {
  const listState = input.listState
  const isSample = 'site' in listState
  return `
    <section class="rounded-xl border bg-white px-4 py-4 shadow-sm">
      <div class="grid gap-4 ${isSample ? 'xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]' : 'xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]'}">
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>搜索</span>
          <input type="search" class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" placeholder="${escapeHtml(input.searchPlaceholder)}" value="${escapeHtml(listState.search)}" data-pcs-engineering-field="${escapeHtml(input.searchField)}" />
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>状态</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-engineering-field="${escapeHtml(input.statusField)}">
            <option value="all" ${listState.status === 'all' ? 'selected' : ''}>全部</option>
            ${input.statusOptions.map((option) => `<option value="${escapeHtml(option)}" ${listState.status === option ? 'selected' : ''}>${escapeHtml(getStatusFilterLabel(option))}</option>`).join('')}
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>负责人</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-engineering-field="${escapeHtml(input.ownerField)}">
            <option value="all" ${listState.owner === 'all' ? 'selected' : ''}>全部</option>
            ${input.ownerOptions.map((option) => `<option value="${escapeHtml(option)}" ${listState.owner === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>来源</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-engineering-field="${escapeHtml(input.sourceField)}">
            <option value="all" ${listState.source === 'all' ? 'selected' : ''}>全部</option>
            ${input.sourceOptions.map((option) => `<option value="${escapeHtml(option)}" ${listState.source === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
          </select>
        </label>
        ${
          isSample && input.siteField && input.siteOptions
            ? `
              <label class="flex flex-col gap-2 text-sm text-slate-600">
                <span>目标站点</span>
                <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-engineering-field="${escapeHtml(input.siteField)}">
                  ${input.siteOptions.map((option) => `<option value="${escapeHtml(option)}" ${String((listState as SampleListState).site) === option ? 'selected' : ''}>${escapeHtml(option === 'all' ? '全部' : option)}</option>`).join('')}
                </select>
              </label>
            `
            : ''
        }
      </div>
    </section>
  `
}

export function renderTabBar<T extends string>(current: T, options: Array<{ key: T; label: string }>, action: string): string {
  return `
    <div class="grid gap-2 rounded-xl border bg-white p-2 shadow-sm" style="grid-template-columns: repeat(${Math.min(options.length, 7)}, minmax(0, 1fr));">
      ${options.map((option) => `
        <button type="button" class="${escapeHtml(toClassName('inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium transition', current === option.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'))}" data-pcs-engineering-action="${escapeHtml(action)}" data-tab="${escapeHtml(option.key)}">${escapeHtml(option.label)}</button>
      `).join('')}
    </div>
  `
}

export function renderKeyValueGrid(items: Array<{ label: string; value: string }>, columns = 3): string {
  return `
    <div class="grid gap-4 ${columns === 4 ? 'md:grid-cols-4' : columns === 2 ? 'md:grid-cols-2' : columns === 1 ? 'grid-cols-1' : 'md:grid-cols-3'}">
      ${items.map((item) => `
        <div>
          <p class="text-xs text-slate-500">${escapeHtml(item.label)}</p>
          <div class="mt-1 text-sm text-slate-900">${item.value}</div>
        </div>
      `).join('')}
    </div>
  `
}

export function renderSectionCard(title: string, body: string, subtitle?: string): string {
  return `
    <section class="rounded-xl border bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-slate-900">${escapeHtml(title)}</h2>
          ${subtitle ? `<p class="mt-1 text-xs text-slate-500">${escapeHtml(subtitle)}</p>` : ''}
        </div>
      </div>
      <div class="mt-4">${body}</div>
    </section>
  `
}

export function renderDialog(open: boolean, title: string, body: string, closeAction: string, submitAction: string, submitLabel: string): string {
  if (!open) return ''
  return `
    <div class="fixed inset-0 z-40">
      <button type="button" class="absolute inset-0 bg-slate-900/40" data-pcs-engineering-action="${escapeHtml(closeAction)}" aria-label="关闭侧栏"></button>
      <aside class="absolute inset-y-0 right-0 flex h-full w-full max-w-2xl flex-col border-l bg-white shadow-2xl">
        <div class="border-b px-6 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-slate-900">${escapeHtml(title)}</h3>
            </div>
            <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600" data-pcs-engineering-action="${escapeHtml(closeAction)}" aria-label="关闭侧栏">×</button>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">${body}</div>
        <div class="flex justify-end gap-2 border-t px-6 py-4">
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="${escapeHtml(closeAction)}">取消</button>
          <button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-engineering-action="${escapeHtml(submitAction)}">${escapeHtml(submitLabel)}</button>
        </div>
      </aside>
    </div>
  `
}

export function splitLines(value: string): string[] {
  return value.split(/\n|,|，|、/).map((item) => item.trim()).filter(Boolean)
}

export function serializePlateTemplateLinks(links: Array<{ templateId: string; templateCode: string; templateName: string; matchedPartNames: string[] }>): string {
  return links.map((link) => [
    link.templateId,
    link.templateCode,
    link.templateName,
    link.matchedPartNames.join('、'),
  ].join(' | ')).join('\n')
}

export function parsePlateTemplateLinks(value: string) {
  return value.split('\n').map((row) => row.trim()).filter(Boolean).map((row) => {
    const [templateId = '', templateCode = '', templateName = '', matchedPartNamesText = ''] = row.split('|').map((item) => item.trim())
    return {
      templateId,
      templateCode,
      templateName,
      matchedPartNames: splitLines(matchedPartNamesText),
    }
  })
}

export function renderTaskSaveBar(action: string, taskId: string, label = '保存任务'): string {
  return `
    <div class="mt-4 flex justify-end">
      <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="${escapeHtml(action)}" data-task-id="${escapeHtml(taskId)}">${escapeHtml(label)}</button>
    </div>
  `
}

export function renderTextInput(label: string, field: string, value: string, placeholder = ''): string {
  return `
    <label class="flex flex-col gap-2 text-sm text-slate-600">
      <span>${escapeHtml(label)}</span>
      <input class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" data-pcs-engineering-field="${escapeHtml(field)}" />
    </label>
  `
}

export function renderTextarea(label: string, field: string, value: string, placeholder = ''): string {
  return `
    <label class="flex flex-col gap-2 text-sm text-slate-600">
      <span>${escapeHtml(label)}</span>
      <textarea class="min-h-[96px] rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" placeholder="${escapeHtml(placeholder)}" data-pcs-engineering-field="${escapeHtml(field)}">${escapeHtml(value)}</textarea>
    </label>
  `
}

export function renderSelectInput(label: string, field: string, value: string, options: Array<{ value: string; label: string }>): string {
  return `
    <label class="flex flex-col gap-2 text-sm text-slate-600">
      <span>${escapeHtml(label)}</span>
      <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-engineering-field="${escapeHtml(field)}">
        <option value="">请选择</option>
        ${options.map((option) => `<option value="${escapeHtml(option.value)}" ${value === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
      </select>
    </label>
  `
}

export function buildProjectOptions(): Array<{ value: string; label: string }> {
  return listProjects().map((project) => ({ value: project.projectId, label: `${project.projectCode} · ${project.projectName}` }))
}

export function toDateTimeLocalValue(value: string): string {
  if (!value) return ''
  if (value.includes('T')) return value.slice(0, 16)
  return value.replace(' ', 'T').slice(0, 16)
}

export function fromDateTimeLocalValue(value: string): string {
  if (!value) return ''
  const normalized = value.replace('T', ' ')
  return normalized.length === 16 ? `${normalized}:00` : normalized
}

export function renderDateTimeInput(label: string, field: string, value: string): string {
  return `
    <label class="flex flex-col gap-2 text-sm text-slate-600">
      <span>${escapeHtml(label)}</span>
      <input type="datetime-local" class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" value="${escapeHtml(toDateTimeLocalValue(value))}" data-pcs-engineering-field="${escapeHtml(field)}" />
    </label>
  `
}

export function buildSelectOptions(values: readonly string[]): Array<{ value: string; label: string }> {
  return values.map((value) => ({ value, label: value }))
}

export function parseTagsText(value: string): string[] {
  return value.split(/[、,，]/).map((item) => item.trim()).filter(Boolean)
}

export function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function getDisplayImageUrl(imageId: string, fallbackTitle = '图片'): string {
  if (!imageId || !imageId.startsWith('mock://')) return imageId
  const rawLabel = imageId.split('/').filter(Boolean).pop() || fallbackTitle
  const label = rawLabel.length > 28 ? `${rawLabel.slice(0, 28)}...` : rawLabel
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
      <rect width="320" height="240" rx="18" fill="#f8fafc"/>
      <rect x="18" y="18" width="284" height="204" rx="16" fill="#e2e8f0"/>
      <path d="M80 154l46-48 36 34 28-26 50 56H80z" fill="#94a3b8"/>
      <circle cx="226" cy="76" r="18" fill="#cbd5e1"/>
      <text x="160" y="190" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#334155">花型图片</text>
      <text x="160" y="212" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#64748b">${escapeSvgText(label)}</text>
    </svg>
  `
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function renderImageList(imageIds: string[], emptyText = '暂无图片'): string {
  if (imageIds.length === 0) {
    return `<div class="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500">${escapeHtml(emptyText)}</div>`
  }
  return `
    <div class="flex flex-wrap gap-3">
      ${imageIds.map((imageId, index) => {
        const displayUrl = getDisplayImageUrl(imageId, `图片 ${index + 1}`)
        return `
          <button type="button" class="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50" data-pcs-engineering-action="open-image-preview" data-url="${escapeHtml(imageId)}" data-title="图片 ${index + 1}">
            <img src="${escapeHtml(displayUrl)}" alt="花型图片${index + 1}" class="h-20 w-20 object-cover" />
          </button>
        `
      }).join('')}
    </div>
  `
}

export function renderSmallImage(imageId: string): string {
  if (!imageId) return '<span class="text-slate-400">未上传</span>'
  const displayUrl = getDisplayImageUrl(imageId, '需求图')
  return `<button type="button" class="overflow-hidden rounded-md border border-slate-200 bg-slate-50" data-pcs-engineering-action="open-image-preview" data-url="${escapeHtml(imageId)}" data-title="需求图"><img src="${escapeHtml(displayUrl)}" alt="需求图" class="h-12 w-12 object-cover" /></button>`
}

export function renderImageUploader(label: string, field: string, imageIds: string[], emptyText = '暂无图片'): string {
  return `
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm font-medium text-slate-900">${escapeHtml(label)}</p>
        <label class="inline-flex h-8 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50">
          上传图片
          <input type="file" accept="image/*" multiple class="hidden" data-pcs-engineering-field="${escapeHtml(field)}" />
        </label>
      </div>
      ${
        imageIds.length
          ? `<div class="flex flex-wrap gap-3">
              ${imageIds.map((imageId, index) => {
                const displayUrl = getDisplayImageUrl(imageId, `${label} ${index + 1}`)
                return `
                  <div class="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <button type="button" class="block h-20 w-20 overflow-hidden" data-pcs-engineering-action="open-image-preview" data-url="${escapeHtml(imageId)}" data-title="${escapeHtml(label)} ${index + 1}">
                      <img src="${escapeHtml(displayUrl)}" alt="${escapeHtml(label)} ${index + 1}" class="h-full w-full object-cover transition group-hover:scale-105" />
                    </button>
                    <button type="button" class="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-xs text-slate-600 shadow hover:bg-white" data-pcs-engineering-action="remove-list-item" data-scope="${escapeHtml(field)}" data-index="${index}" aria-label="删除图片">×</button>
                  </div>
                `
              }).join('')}
            </div>`
          : renderImageList(imageIds, emptyText)
      }
    </div>
  `
}

export function extractFileLabel(fileId: string): string {
  if (!fileId) return ''
  const match = fileId.match(/[^/]+$/)
  const raw = match ? match[0] : fileId
  return decodeURIComponent(raw.replace(/^mock-file:\/\//, ''))
}

export function renderFileUploader(label: string, field: string, fileIds: string[], emptyText = '未上传', accept = ''): string {
  return `
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm font-medium text-slate-900">${escapeHtml(label)}</p>
        <label class="inline-flex h-8 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50">
          上传文件
          <input type="file" ${accept ? `accept="${escapeHtml(accept)}"` : ''} multiple class="hidden" data-pcs-engineering-field="${escapeHtml(field)}" />
        </label>
      </div>
      ${
        fileIds.length
          ? `<div class="flex flex-wrap gap-2">${fileIds.map((fileId, index) => `
              <span class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                <span>${escapeHtml(extractFileLabel(fileId))}</span>
                <button type="button" class="text-slate-500 hover:text-slate-700" data-pcs-engineering-action="remove-list-item" data-scope="${escapeHtml(field)}" data-index="${index}">×</button>
              </span>
            `).join('')}</div>`
          : `<div class="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500">${escapeHtml(emptyText)}</div>`
      }
    </div>
  `
}

export function buildMockFileId(file: File): string {
  return `mock-file://${Date.now()}-${encodeURIComponent(file.name)}`
}

export function appendImageValues(field: string, values: string[]): boolean {
  if (field === 'first-sample-result-sample-images') {
    state.firstSampleResultDraft.sampleImageIds = [...state.firstSampleResultDraft.sampleImageIds, ...values]
    return true
  }
  if (field === 'revision-detail-target-style-images') {
    state.revisionDetailDraft.targetStyleImageIds = [...state.revisionDetailDraft.targetStyleImageIds, ...values]
    return true
  }
  if (field === 'revision-detail-new-pattern-images') {
    state.revisionDetailDraft.newPatternImageIds = [...state.revisionDetailDraft.newPatternImageIds, ...values]
    return true
  }
  if (field === 'revision-detail-pattern-piece-images') {
    state.revisionDetailDraft.patternPieceImageIds = [...state.revisionDetailDraft.patternPieceImageIds, ...values]
    return true
  }
  if (field === 'revision-detail-main-images') {
    state.revisionDetailDraft.mainImageIds = [...state.revisionDetailDraft.mainImageIds, ...values]
    return true
  }
  if (field === 'revision-detail-design-drafts') {
    state.revisionDetailDraft.designDraftImageIds = [...state.revisionDetailDraft.designDraftImageIds, ...values]
    return true
  }
  if (field === 'plate-detail-flower-images') {
    state.plateDetailDraft.flowerImageIds = [...state.plateDetailDraft.flowerImageIds, ...values]
    return true
  }
  if (field === 'plate-detail-support-images') {
    state.plateDetailDraft.supportImageIds = [...state.plateDetailDraft.supportImageIds, ...values]
    return true
  }
  if (field === 'pattern-create-demand-images') {
    state.patternCreateDraft.demandImageIds = [...state.patternCreateDraft.demandImageIds, ...values]
    return true
  }
  if (field === 'pattern-detail-completion-images') {
    state.patternDetailDraft.completionImageIds = [...state.patternDetailDraft.completionImageIds, ...values]
    return true
  }
  if (field === 'pattern-detail-live-reference-images') {
    state.patternDetailDraft.liveReferenceImageIds = [...state.patternDetailDraft.liveReferenceImageIds, ...values]
    return true
  }
  if (field === 'pattern-detail-image-reference-images') {
    state.patternDetailDraft.imageReferenceIds = [...state.patternDetailDraft.imageReferenceIds, ...values]
    return true
  }
  return false
}

export function appendFileValues(field: string, values: string[]): boolean {
  if (field === 'revision-detail-pattern-files') {
    state.revisionDetailDraft.patternFileIds = [...state.revisionDetailDraft.patternFileIds, ...values]
    return true
  }
  if (field === 'plate-detail-pdf-files') {
    state.plateDetailDraft.patternPdfFileIds = [...state.plateDetailDraft.patternPdfFileIds, ...values]
    return true
  }
  if (field === 'plate-detail-dxf-files') {
    state.plateDetailDraft.patternDxfFileIds = [...state.plateDetailDraft.patternDxfFileIds, ...values]
    return true
  }
  if (field === 'plate-detail-rul-files') {
    state.plateDetailDraft.patternRulFileIds = [...state.plateDetailDraft.patternRulFileIds, ...values]
    return true
  }
  if (field === 'plate-detail-support-videos') {
    state.plateDetailDraft.supportVideoIds = [...state.plateDetailDraft.supportVideoIds, ...values]
    return true
  }
  if (field === 'pattern-detail-pattern-files') {
    state.patternDetailDraft.patternFileIds = [...state.patternDetailDraft.patternFileIds, ...values]
    return true
  }
  return false
}

export function removeListValue(scope: string, index: number): boolean {
  if (index < 0) return false
  if (scope === 'first-sample-result-sample-images') {
    state.firstSampleResultDraft.sampleImageIds = state.firstSampleResultDraft.sampleImageIds.filter((_, itemIndex) => itemIndex !== index)
    return true
  }
  if (scope === 'revision-detail-target-style-images') {
    state.revisionDetailDraft.targetStyleImageIds = state.revisionDetailDraft.targetStyleImageIds.filter((_, itemIndex) => itemIndex !== index)
    return true
  }
  if (scope === 'revision-detail-new-pattern-images') {
    state.revisionDetailDraft.newPatternImageIds = state.revisionDetailDraft.newPatternImageIds.filter((_, itemIndex) => itemIndex !== index)
    return true
  }
  if (scope === 'revision-detail-pattern-piece-images') {
    state.revisionDetailDraft.patternPieceImageIds = state.revisionDetailDraft.patternPieceImageIds.filter((_, itemIndex) => itemIndex !== index)
    return true
  }
  if (scope === 'revision-detail-main-images') {
    state.revisionDetailDraft.mainImageIds = state.revisionDetailDraft.mainImageIds.filter((_, itemIndex) => itemIndex !== index)
    return true
  }
  if (scope === 'revision-detail-design-drafts') {
    state.revisionDetailDraft.designDraftImageIds = state.revisionDetailDraft.designDraftImageIds.filter((_, itemIndex) => itemIndex !== index)
    return true
  }
  if (scope === 'revision-detail-pattern-files') {
    state.revisionDetailDraft.patternFileIds = state.revisionDetailDraft.patternFileIds.filter((_, itemIndex) => itemIndex !== index)
    return true
  }
  if (scope === 'plate-detail-flower-images') {
    state.plateDetailDraft.flowerImageIds = state.plateDetailDraft.flowerImageIds.filter((_, itemIndex) => itemIndex !== index)
    return true
  }
  if (scope === 'plate-detail-pdf-files') {
    state.plateDetailDraft.patternPdfFileIds = state.plateDetailDraft.patternPdfFileIds.filter((_, itemIndex) => itemIndex !== index)
    return true
  }
  if (scope === 'plate-detail-dxf-files') {
    state.plateDetailDraft.patternDxfFileIds = state.plateDetailDraft.patternDxfFileIds.filter((_, itemIndex) => itemIndex !== index)
    return true
  }
  if (scope === 'plate-detail-rul-files') {
    state.plateDetailDraft.patternRulFileIds = state.plateDetailDraft.patternRulFileIds.filter((_, itemIndex) => itemIndex !== index)
    return true
  }
  if (scope === 'plate-detail-support-images') {
    state.plateDetailDraft.supportImageIds = state.plateDetailDraft.supportImageIds.filter((_, itemIndex) => itemIndex !== index)
    return true
  }
  if (scope === 'plate-detail-support-videos') {
    state.plateDetailDraft.supportVideoIds = state.plateDetailDraft.supportVideoIds.filter((_, itemIndex) => itemIndex !== index)
    return true
  }
  if (scope === 'pattern-create-demand-images') {
    state.patternCreateDraft.demandImageIds = state.patternCreateDraft.demandImageIds.filter((_, itemIndex) => itemIndex !== index)
    return true
  }
  if (scope === 'pattern-detail-completion-images') {
    state.patternDetailDraft.completionImageIds = state.patternDetailDraft.completionImageIds.filter((_, itemIndex) => itemIndex !== index)
    return true
  }
  if (scope === 'pattern-detail-pattern-files') {
    state.patternDetailDraft.patternFileIds = state.patternDetailDraft.patternFileIds.filter((_, itemIndex) => itemIndex !== index)
    return true
  }
  if (scope === 'pattern-detail-live-reference-images') {
    state.patternDetailDraft.liveReferenceImageIds = state.patternDetailDraft.liveReferenceImageIds.filter((_, itemIndex) => itemIndex !== index)
    return true
  }
  if (scope === 'pattern-detail-image-reference-images') {
    state.patternDetailDraft.imageReferenceIds = state.patternDetailDraft.imageReferenceIds.filter((_, itemIndex) => itemIndex !== index)
    return true
  }
  return false
}

export function renderPreviewImageModal(): string {
  if (!state.imagePreview.open || !state.imagePreview.url) return ''
  const displayUrl = getDisplayImageUrl(state.imagePreview.url, state.imagePreview.title || '图片预览')
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button type="button" class="absolute inset-0 bg-slate-900/70" data-pcs-engineering-action="close-image-preview" aria-label="关闭图片预览"></button>
      <div class="relative w-full max-w-5xl rounded-2xl bg-white p-4 shadow-2xl">
        <div class="mb-3 flex items-center justify-between gap-3">
          <p class="text-sm font-medium text-slate-900">${escapeHtml(state.imagePreview.title || '图片预览')}</p>
          <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" data-pcs-engineering-action="close-image-preview" aria-label="关闭图片预览">×</button>
        </div>
        <div class="flex max-h-[75vh] items-center justify-center overflow-auto rounded-xl bg-slate-100 p-3">
          <img src="${escapeHtml(displayUrl)}" alt="${escapeHtml(state.imagePreview.title || '图片预览')}" class="max-h-[70vh] max-w-full rounded-lg object-contain" />
        </div>
      </div>
    </div>
  `
}

export function renderImageThumbnailGrid(imageUrls: string[], removable = false): string {
  if (!imageUrls.length) return ''
  return `
    <div class="grid grid-cols-4 gap-3 sm:grid-cols-5">
      ${imageUrls.map((url, index) => {
        const displayUrl = getDisplayImageUrl(url, `证据图片 ${index + 1}`)
        return `
          <div class="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            <button type="button" class="block h-20 w-full overflow-hidden" data-pcs-engineering-action="open-image-preview" data-url="${escapeHtml(url)}" data-title="证据图片 ${index + 1}">
              <img src="${escapeHtml(displayUrl)}" alt="证据图片 ${index + 1}" class="h-full w-full object-cover transition group-hover:scale-105" />
            </button>
            ${
              removable
                ? `<button type="button" class="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-xs text-slate-600 shadow hover:bg-white" data-pcs-engineering-action="remove-revision-evidence-image" data-image-index="${index}" aria-label="删除证据图片">×</button>`
                : ''
            }
          </div>
        `
      }).join('')}
    </div>
  `
}

export function getProjectDefaultValues(projectId: string): { ownerName: string; styleId: string; styleCode: string; styleName: string } {
  const project = getProjectById(projectId)
  const style = findStyleArchiveByProjectId(projectId)
  return {
    ownerName: project?.ownerName || '',
    styleId: style?.styleId || '',
    styleCode: style?.styleCode || '',
    styleName: style?.styleName || '',
  }
}

export function renderLogs(logs: EngineeringLog[]): string {
  return `
    <div class="space-y-3">
      ${logs.map((log) => `
        <div class="rounded-lg border border-slate-200 px-4 py-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-slate-900">${escapeHtml(log.action)}</span>
              <span class="text-xs text-slate-500">${escapeHtml(log.user)}</span>
            </div>
            <span class="text-xs text-slate-500">${escapeHtml(formatDateTime(log.time))}</span>
          </div>
          <p class="mt-2 text-sm text-slate-600">${escapeHtml(log.detail)}</p>
        </div>
      `).join('')}
    </div>
  `
}

export function renderEmptyDetail(title: string, listPath: string): string {
  return `
    <div class="space-y-5 p-4">
      <section class="rounded-xl border bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold text-slate-900">${escapeHtml(title)}不存在</h1>
            <p class="mt-1 text-sm text-slate-500">未找到对应记录，请返回列表重新选择。</p>
          </div>
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="${escapeHtml(listPath)}">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>返回列表
          </button>
        </div>
      </section>
    </div>
  `
}

export function renderHeaderMeta(title: string, subtitle: string, badges: string, actions: string): string {
  return `
    <section class="rounded-xl border bg-white px-4 py-4 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900">${escapeHtml(title)}</h1>
          <div class="mt-2 flex flex-wrap items-center gap-2">${badges}</div>
          <p class="mt-3 text-sm text-slate-500">${escapeHtml(subtitle)}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">${actions}</div>
      </div>
    </section>
  `
}

export function renderProjectContext(task: {
  projectId: string
  projectCode: string
  projectName: string
  sourceType: string
  productStyleCode?: string
  spuCode?: string
  styleId?: string
  styleCode?: string
  styleName?: string
}): string {
  const style = getTaskStyleInfo(task)
  return renderSectionCard(
    '项目与来源',
    renderKeyValueGrid(
      [
        { label: '商品项目', value: projectButton(task.projectId, task.projectCode, task.projectName) },
        { label: '来源类型', value: escapeHtml(task.sourceType) },
        { label: '款式档案', value: styleArchiveLink(style.styleId, style.styleCode, style.styleName, task.projectId) },
        { label: '款式编码', value: escapeHtml(style.styleCode || task.productStyleCode || task.spuCode || '-') },
      ],
      3,
    ),
  )
}

// 供列表分派使用的公共函数（各模块在 pcs-engineering-tasks.ts / pattern-task.ts 中按模块分派）
export function getEngineeringListModule(node: HTMLElement): ModuleKey | null {
  const value = node.dataset.pcsEngineeringListModule
    || node.closest<HTMLElement>('[data-pcs-engineering-list-module]')?.dataset.pcsEngineeringListModule
  return value === 'revision' || value === 'plate' || value === 'pattern' || value === 'firstSample' || value === 'firstOrder' || value === 'color' || value === 'purchase' || value === 'techPack'
    ? value
    : null
}

export function refreshEngineeringList(module: ModuleKey, refreshStats = false): void {
  if (typeof document === 'undefined') return
  const columns = getEngineeringListColumns(module)
  const listState = getEngineeringListState(module)
  const view = getEngineeringListView(module, getEngineeringListRows(module), columns, listState)
  const tableHost = document.querySelector<HTMLElement>(`[data-pcs-engineering-list-region="${module}-table"]`)
  const paginationHost = document.querySelector<HTMLElement>(`[data-pcs-engineering-list-region="${module}-pagination"]`)
  if (tableHost) tableHost.innerHTML = renderEngineeringListTable(module, columns, view.paging, getEngineeringListEmptyText(module))
  if (paginationHost) paginationHost.innerHTML = renderEngineeringListPagination(module, view.paging)
  if (refreshStats) {
    const statsHost = document.querySelector<HTMLElement>(`[data-pcs-engineering-list-region="${module}-stats"]`)
    if (statsHost) statsHost.innerHTML = withEngineeringListLocalInteractions(module, renderEngineeringListStats(module))
  }
}

export function refreshEngineeringColumnOverlay(module: ModuleKey): void {
  if (typeof document === 'undefined') return
  const host = document.querySelector<HTMLElement>(`[data-pcs-engineering-list-region="${module}-column-overlay"]`)
  if (host) host.innerHTML = renderEngineeringListColumnOverlay(module, getEngineeringListColumns(module))
}

// 列表分派钩子：由主文件与 pattern-task.ts 注册各模块的列定义与数据读取
export interface EngineeringListModuleHooks {
  getColumns: () => readonly StandardListColumn<EngineeringListRow>[]
  getRows: () => EngineeringListRow[]
  getState: () => ListState | SampleListState
  getEmptyText: () => string
  getStatsHtml: () => string
}

const engineeringListModuleHooks: Partial<Record<ModuleKey, EngineeringListModuleHooks>> = {}

export function registerEngineeringListModule(module: ModuleKey, hooks: EngineeringListModuleHooks): void {
  engineeringListModuleHooks[module] = hooks
}

export function getEngineeringListColumns(module: ModuleKey): readonly StandardListColumn<EngineeringListRow>[] {
  return engineeringListModuleHooks[module]?.getColumns() || []
}

export function getEngineeringListRows(module: ModuleKey): EngineeringListRow[] {
  return engineeringListModuleHooks[module]?.getRows() || []
}

export function getEngineeringListState(module: ModuleKey): ListState | SampleListState {
  return engineeringListModuleHooks[module]?.getState() || state.revisionList
}

export function getEngineeringListEmptyText(module: ModuleKey): string {
  return engineeringListModuleHooks[module]?.getEmptyText() || '暂无数据'
}

export function renderEngineeringListStats(module: ModuleKey): string {
  return engineeringListModuleHooks[module]?.getStatsHtml() || ''
}

// clearListColumnPreferences 转发：供列表设置恢复使用（restore-column-settings 动作）
export function clearEngineeringListPreferences(module: ModuleKey): void {
  const storage = getEngineeringListStorage()
  if (storage) clearListColumnPreferences(storage, ENGINEERING_LIST_STORAGE_KEYS[module])
}
