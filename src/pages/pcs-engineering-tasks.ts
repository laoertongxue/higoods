import { appStore } from '../state/store.ts'
import { createPatternAsset, getPatternAssetById, listPatternAssets } from '../data/pcs-pattern-library.ts'
import type { PatternParsedFileResult } from '../data/pcs-pattern-library-types.ts'
import { generateTechPackVersionFromPatternTask, generateTechPackVersionFromPlateTask, generateTechPackVersionFromRevisionTask } from '../data/pcs-project-technical-data-writeback.ts'
import {
  PATTERN_TASK_TEAMS,
  listPatternTaskMembersByTeam,
} from '../data/pcs-pattern-task-team-config.ts'
import {
  reviewPatternTaskByBuyer,
  transferPatternTaskToChinaTeam,
} from '../data/pcs-pattern-task-flow-service.ts'
import type {
  PatternTaskColorDepthOption,
  PatternTaskDemandSourceType,
  PatternTaskDifficultyGrade,
  PatternTaskProcessType,
  PatternTaskTeamCode,
} from '../data/pcs-pattern-task-types.ts'
import {
  getTechPackGenerationBlockedReason,
  getPatternTechPackActionMeta,
  getRevisionTechPackActionLabel,
  isTechPackGenerationAllowedStatus,
} from '../data/pcs-tech-pack-task-generation.ts'
import { listPatternTasks, getPatternTaskById, updatePatternTask, resetPatternTaskRepository } from '../data/pcs-pattern-task-repository.ts'
import { listPlateMakingTasks, getPlateMakingTaskById, updatePlateMakingTask, resetPlateMakingTaskRepository } from '../data/pcs-plate-making-repository.ts'
import { listRevisionTasks, getRevisionTaskById, updateRevisionTask, resetRevisionTaskRepository } from '../data/pcs-revision-task-repository.ts'
import { listFirstSampleTasks, getFirstSampleTaskById, resetFirstSampleTaskRepository } from '../data/pcs-first-sample-repository.ts'
import { listFirstOrderSampleTasks, getFirstOrderSampleTaskById, resetFirstOrderSampleTaskRepository } from '../data/pcs-first-order-sample-repository.ts'
import {
  getRevisionTaskCompletionMissingFields,
} from '../data/pcs-engineering-task-field-policy.ts'
import {
  FIRST_SAMPLE_FACTORY_OPTIONS,
  updateFirstSampleTaskDetailAndSync,
} from '../data/pcs-first-sample-project-writeback.ts'
import {
  FIRST_ORDER_SAMPLE_FACTORY_OPTIONS,
  updateFirstOrderSampleTaskDetailAndSync,
} from '../data/pcs-first-order-sample-project-writeback.ts'
import {
  completePatternTask,
  completePlateMakingTask,
  completeRevisionTask,
  createDownstreamTasksFromRevision,
  createFirstSampleTaskWithProjectRelation,
  createPatternTask,
  createPlateMakingTask,
  createFirstOrderSampleTaskWithProjectRelation,
  createRevisionTask,
  confirmRevisionTaskOutput,
  inferDownstreamTypesFromRevisionTask,
  submitRevisionTaskForConfirmation,
  syncExistingProjectEngineeringTaskNodes,
} from '../data/pcs-task-project-relation-writeback.ts'
import { findStyleArchiveByProjectId, getStyleArchiveById, listStyleArchives } from '../data/pcs-style-archive-repository.ts'
import { getProjectById, listProjects } from '../data/pcs-project-repository.ts'
import {
  PATTERN_TASK_SOURCE_TYPE_LIST,
  PLATE_TASK_SOURCE_TYPE_LIST,
  REVISION_TASK_SOURCE_TYPE_LIST,
  type PatternTaskSourceType,
  type PlateMakingTaskSourceType,
  type RevisionTaskSourceType,
} from '../data/pcs-task-source-normalizer.ts'
import type { RevisionTaskLiveRetestStatus, RevisionTaskPatternArea } from '../data/pcs-revision-task-file-types.ts'
import type { RevisionTaskMaterialLine } from '../data/pcs-revision-task-material-types.ts'
import type { PlateMakingMaterialLine } from '../data/pcs-plate-making-material-types.ts'
import type { PlateMakingPatternImageLine } from '../data/pcs-plate-making-pattern-file-types.ts'
import { createDefaultSamplePlanLines, getFirstOrderSampleChainMissingFields } from '../data/pcs-sample-chain-service.ts'
import type { FirstSamplePurpose, SampleChainMode, SampleMaterialMode, SamplePlanLine, SampleSpecialSceneReasonCode } from '../data/pcs-sample-chain-types.ts'
import type { FirstSampleTaskRecord } from '../data/pcs-first-sample-types.ts'
import type { FirstOrderSampleTaskRecord } from '../data/pcs-first-order-sample-types.ts'
import { tokenizePatternFilename } from '../utils/pcs-pattern-library-services.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'

type ModuleKey = 'revision' | 'plate' | 'pattern' | 'firstSample' | 'firstOrder'
type TaskBindingMode = 'project' | 'style'
type RevisionTab = 'plan' | 'issues' | 'samples' | 'outputs' | 'downstream' | 'logs'
type PlateTab = 'overview' | 'version' | 'bom' | 'patterns' | 'outputs' | 'downstream' | 'logs'
type PatternTab = 'plan' | 'color' | 'production' | 'samples' | 'library' | 'logs'
type FirstSampleTab = 'overview' | 'inputs' | 'result' | 'acceptance' | 'logs'
type FirstOrderTab = 'overview' | 'version' | 'result' | 'conclusion' | 'logs'

interface EngineeringLog {
  time: string
  action: string
  user: string
  detail: string
}

interface ListState {
  search: string
  status: string
  owner: string
  source: string
  quickFilter: string
  currentPage: number
}

interface SampleListState extends ListState {
  site: string
}

interface RevisionCreateDraft {
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

interface PlateCreateDraft {
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

interface PatternCreateDraft {
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

interface SampleCreateDraft {
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

interface FirstOrderCreateDraft extends SampleCreateDraft {
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

interface RevisionDetailDraft {
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

interface PlateDetailDraft {
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
}

interface PatternDetailDraft {
  artworkVersion: string
  difficultyGrade: PatternTaskDifficultyGrade
  colorDepthOption: PatternTaskColorDepthOption
  physicalReferenceNote: string
  colorConfirmNote: string
  completionImageIds: string[]
  liveReferenceImageIds: string[]
  imageReferenceIds: string[]
  buyerReviewNote: string
  transferReason: string
  patternCategoryCode: string
  patternStyleTagsText: string
  hotSellerFlag: boolean
}

interface FirstSampleDetailDraft {
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

interface FirstOrderDetailDraft {
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

interface FirstSampleStartDraft {
  operatorName: string
  startedAt: string
  planFinishAt: string
  startNote: string
}

interface FirstSampleResultDraft {
  sampleCode: string
  submittedBy: string
  completedAt: string
  sampleImageIds: string[]
  resultNote: string
}

interface FirstOrderStartDraft {
  operatorName: string
  startedAt: string
  planFinishAt: string
  factoryConfirmNote: string
}

interface FirstOrderResultDraft {
  sampleCode: string
  submittedBy: string
  completedAt: string
  finalReferenceNote: string
  samplePlanLinesText: string
  resultNote: string
}

const PAGE_SIZE = 8

const COMMON_STATUS_META: Record<string, { label: string; className: string }> = {
  草稿: { label: '草稿', className: 'bg-slate-100 text-slate-700' },
  未开始: { label: '未开始', className: 'bg-slate-100 text-slate-700' },
  进行中: { label: '进行中', className: 'bg-blue-100 text-blue-700' },
  待确认: { label: '待确认', className: 'bg-amber-100 text-amber-700' },
  已确认: { label: '已确认', className: 'bg-emerald-100 text-emerald-700' },
  已生成技术包: { label: '已生成技术包', className: 'bg-cyan-100 text-cyan-700' },
  已完成: { label: '已完成', className: 'bg-green-100 text-green-700' },
  异常待处理: { label: '阻塞', className: 'bg-rose-100 text-rose-700' },
  已取消: { label: '已取消', className: 'bg-slate-100 text-slate-500' },
}

const SAMPLE_STATUS_META: Record<string, { label: string; className: string }> = {
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

const REVISION_SCOPE_OPTIONS = [
  { value: 'PATTERN', label: '版型结构' },
  { value: 'SIZE', label: '尺码规格' },
  { value: 'FABRIC', label: '面料' },
  { value: 'ACCESSORIES', label: '辅料' },
  { value: 'CRAFT', label: '工艺' },
  { value: 'PRINT', label: '花型' },
  { value: 'COLOR', label: '颜色' },
  { value: 'PACKAGE', label: '包装标识' },
] as const

const PATTERN_DEMAND_SOURCE_OPTIONS: PatternTaskDemandSourceType[] = ['预售测款通过', '改版任务', '设计师款']
const PATTERN_PROCESS_OPTIONS: PatternTaskProcessType[] = ['数码印', '烫画', '直喷']
const PATTERN_COLOR_DEPTH_OPTIONS: PatternTaskColorDepthOption[] = ['浅色', '深色', '中间值']
const PATTERN_DIFFICULTY_OPTIONS: PatternTaskDifficultyGrade[] = ['A++', 'A+', 'A', 'B', 'C', 'D']

const SAMPLE_SITE_OPTIONS = ['all', '深圳', '雅加达']
const SAMPLE_CHAIN_MODE_OPTIONS: SampleChainMode[] = ['复用首版结论', '新增首单样衣确认', '替代布与正确布双确认']
const SAMPLE_SPECIAL_REASON_OPTIONS: SampleSpecialSceneReasonCode[] = ['定位印', '大货量大', '工厂参照样', '正确布确认', '其它']

const initialRevisionCreateDraft = (): RevisionCreateDraft => ({
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

const initialRevisionDetailDraft = (): RevisionDetailDraft => ({
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

const initialPlateCreateDraft = (): PlateCreateDraft => ({
  bindingMode: 'project',
  sourceType: '项目模板阶段',
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

const initialPatternCreateDraft = (): PatternCreateDraft => ({
  bindingMode: 'project',
  sourceType: '项目模板阶段',
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

const initialPlateDetailDraft = (): PlateDetailDraft => ({
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
})

const initialPatternDetailDraft = (): PatternDetailDraft => ({
  artworkVersion: '',
  difficultyGrade: 'A',
  colorDepthOption: '中间值',
  physicalReferenceNote: '',
  colorConfirmNote: '',
  completionImageIds: [],
  liveReferenceImageIds: [],
  imageReferenceIds: [],
  buyerReviewNote: '',
  transferReason: '',
  patternCategoryCode: '',
  patternStyleTagsText: '',
  hotSellerFlag: false,
})

const initialSampleCreateDraft = (): SampleCreateDraft => ({
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

const initialFirstOrderCreateDraft = (): FirstOrderCreateDraft => ({
  ...initialSampleCreateDraft(),
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

const initialFirstSampleDetailDraft = (): FirstSampleDetailDraft => ({
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

function buildFirstSampleDetailDraft(task: FirstSampleTaskRecord): FirstSampleDetailDraft {
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

const initialFirstOrderDetailDraft = (): FirstOrderDetailDraft => ({
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

const initialFirstSampleStartDraft = (): FirstSampleStartDraft => ({
  operatorName: '当前用户',
  startedAt: nowText(),
  planFinishAt: '',
  startNote: '',
})

const initialFirstSampleResultDraft = (): FirstSampleResultDraft => ({
  sampleCode: '',
  submittedBy: '当前用户',
  completedAt: nowText(),
  sampleImageIds: [],
  resultNote: '',
})

const initialFirstOrderStartDraft = (): FirstOrderStartDraft => ({
  operatorName: '当前用户',
  startedAt: nowText(),
  planFinishAt: '',
  factoryConfirmNote: '',
})

const initialFirstOrderResultDraft = (): FirstOrderResultDraft => ({
  sampleCode: '',
  submittedBy: '当前用户',
  completedAt: nowText(),
  finalReferenceNote: '',
  samplePlanLinesText: '',
  resultNote: '',
})

function serializeFirstOrderSamplePlanLines(lines: SamplePlanLine[]): string {
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

function parseFirstOrderSamplePlanLines(text: string, fallback: SamplePlanLine[]): SamplePlanLine[] {
  const lines = text
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((line, index): SamplePlanLine => {
      const [sampleRole, materialMode, quantityText, targetFactoryName, linkedSampleCode, status, note] = line.split('|').map((item) => item.trim())
      const fallbackLine = fallback[index]
      const resolvedTargetFactoryName = targetFactoryName || fallbackLine?.targetFactoryName || ''
      return {
        lineId: fallbackLine?.lineId || `fos-plan-${index + 1}`,
        sampleRole: (sampleRole || fallbackLine?.sampleRole || '复用首版结论') as SamplePlanLine['sampleRole'],
        materialMode: (materialMode || fallbackLine?.materialMode || '沿用首版') as SamplePlanLine['materialMode'],
        quantity: Number(quantityText || fallbackLine?.quantity || 1),
        targetFactoryId: fallbackLine?.targetFactoryId || getFirstOrderFactoryIdByName(resolvedTargetFactoryName),
        targetFactoryName: resolvedTargetFactoryName,
        linkedSampleCode: linkedSampleCode || fallbackLine?.linkedSampleCode || '',
        status: (status || fallbackLine?.status || '待确认') as SamplePlanLine['status'],
        note: note || fallbackLine?.note || '',
      }
    })
  return lines.length > 0 ? lines : fallback
}

const SAMPLE_PLAN_ROLE_OPTIONS: SamplePlanLine['sampleRole'][] = ['复用首版结论', '替代布确认样', '正确布确认样', '工厂参照确认']
const SAMPLE_PLAN_MATERIAL_OPTIONS: SamplePlanLine['materialMode'][] = ['沿用首版', '替代布', '正确布']
const SAMPLE_PLAN_STATUS_OPTIONS: SamplePlanLine['status'][] = ['待确认', '已确认', '需补样', '已取消']

function buildEmptyFirstOrderSamplePlanLine(index: number): SamplePlanLine {
  return {
    lineId: `fos-plan-${Date.now()}-${index + 1}`,
    sampleRole: '复用首版结论',
    materialMode: '沿用首版',
    quantity: 1,
    targetFactoryId: '',
    targetFactoryName: '',
    linkedSampleCode: '',
    status: '待确认',
    note: '',
  }
}

function getFirstOrderSamplePlanLinesFromText(text: string, fallback: SamplePlanLine[]): SamplePlanLine[] {
  return parseFirstOrderSamplePlanLines(text, fallback).map((line, index) => ({
    ...line,
    lineId: line.lineId || `fos-plan-${index + 1}`,
    quantity: Number.isFinite(Number(line.quantity)) ? Number(line.quantity) : 1,
  }))
}

function updateFirstOrderSamplePlanLineText(
  text: string,
  fallback: SamplePlanLine[],
  index: number,
  key: keyof SamplePlanLine,
  value: string,
): string {
  const lines = getFirstOrderSamplePlanLinesFromText(text, fallback)
  const target = lines[index]
  if (!target) return text
  const nextLine: SamplePlanLine = { ...target }
  if (key === 'quantity') {
    nextLine.quantity = Math.max(0, Math.floor(Number(value || 0)))
  } else if (key === 'sampleRole') {
    nextLine.sampleRole = value as SamplePlanLine['sampleRole']
    if (nextLine.sampleRole !== '工厂参照确认') {
      nextLine.targetFactoryId = ''
      nextLine.targetFactoryName = ''
    }
  } else if (key === 'materialMode') {
    nextLine.materialMode = value as SamplePlanLine['materialMode']
  } else if (key === 'status') {
    nextLine.status = value as SamplePlanLine['status']
  } else if (key === 'targetFactoryName') {
    nextLine.targetFactoryName = value
    nextLine.targetFactoryId = getFirstOrderFactoryIdByName(value)
  } else if (key === 'linkedSampleCode' || key === 'note') {
    nextLine[key] = value
  }
  return serializeFirstOrderSamplePlanLines(lines.map((line, itemIndex) => (itemIndex === index ? nextLine : line)))
}

function addFirstOrderSamplePlanLineText(text: string, fallback: SamplePlanLine[]): string {
  const lines = getFirstOrderSamplePlanLinesFromText(text, fallback)
  return serializeFirstOrderSamplePlanLines([...lines, buildEmptyFirstOrderSamplePlanLine(lines.length)])
}

function removeFirstOrderSamplePlanLineText(text: string, fallback: SamplePlanLine[], index: number): string {
  const lines = getFirstOrderSamplePlanLinesFromText(text, fallback)
  if (lines.length <= 1) return serializeFirstOrderSamplePlanLines(lines)
  return serializeFirstOrderSamplePlanLines(lines.filter((_, itemIndex) => itemIndex !== index))
}

function buildFirstOrderDetailDraft(task: FirstOrderSampleTaskRecord): FirstOrderDetailDraft {
  return {
    patternVersion: task.patternVersion || '',
    artworkVersion: task.artworkVersion || '',
    samplePlanLinesText: serializeFirstOrderSamplePlanLines(task.samplePlanLines),
    finalReferenceNote: task.finalReferenceNote || '',
    sampleCode: task.sampleCode || '',
    conclusionResult: task.conclusionResult || '',
    conclusionNote: task.conclusionNote || '',
    confirmedAt: task.confirmedAt || '',
    confirmedBy: task.confirmedBy || '',
  }
}

function buildFirstOrderResultDraft(task: FirstOrderSampleTaskRecord): FirstOrderResultDraft {
  return {
    sampleCode: task.sampleCode || `FOS-RESULT-${task.firstOrderSampleTaskCode.slice(-3)}`,
    submittedBy: task.confirmedBy || '当前用户',
    completedAt: nowText(),
    finalReferenceNote: task.finalReferenceNote || '',
    samplePlanLinesText: serializeFirstOrderSamplePlanLines(task.samplePlanLines),
    resultNote: '',
  }
}

function getFirstOrderSourceFirstSampleLabel(projectId: string): string {
  const matched = listFirstSampleTasks()
    .filter((task) => task.projectId === projectId)
    .find((task) => task.workItemTypeCode === 'FIRST_SAMPLE')
  if (!matched) return '未找到同商品项目的首版样衣结果'
  return `${matched.firstSampleTaskCode}${matched.sampleCode ? ` · ${matched.sampleCode}` : ''}`
}

const state = {
  notice: null as string | null,
  revisionList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 } as ListState,
  revisionTab: 'plan' as RevisionTab,
  revisionCreateOpen: false,
  revisionCreateDraft: initialRevisionCreateDraft(),
  revisionDetailDraftTaskId: '',
  revisionDetailDraft: initialRevisionDetailDraft(),
  imagePreview: { open: false, url: '', title: '' },

  plateList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 } as ListState,
  plateTab: 'overview' as PlateTab,
  plateCreateOpen: false,
  plateCreateDraft: initialPlateCreateDraft(),
  plateDetailDraftTaskId: '',
  plateDetailDraft: initialPlateDetailDraft(),

  patternList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 } as ListState,
  patternTab: 'plan' as PatternTab,
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
}

const runtimeLogs: Record<ModuleKey, Map<string, EngineeringLog[]>> = {
  revision: new Map(),
  plate: new Map(),
  pattern: new Map(),
  firstSample: new Map(),
  firstOrder: new Map(),
}

const firstSampleAcceptanceMap = new Map<string, { result: string; note: string; updatedAt: string }>()
const firstOrderConclusionMap = new Map<string, { result: string; note: string; updatedAt: string }>()
function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function todayText(): string {
  return nowText().slice(0, 10)
}

function setNotice(message: string): void {
  state.notice = message
}

function clearNotice(): void {
  state.notice = null
}

function pushRuntimeLog(module: ModuleKey, taskId: string, action: string, detail: string, user = '当前用户'): void {
  const logs = runtimeLogs[module].get(taskId) || []
  runtimeLogs[module].set(taskId, [{ time: nowText(), action, detail, user }, ...logs])
}

function baseLogs(task: { createdAt: string; createdBy: string; updatedAt: string; updatedBy: string; title: string }): EngineeringLog[] {
  const logs: EngineeringLog[] = [
    { time: task.updatedAt, action: '最近更新', user: task.updatedBy || '系统初始化', detail: `已更新：${task.title}` },
    { time: task.createdAt, action: '创建任务', user: task.createdBy || '系统初始化', detail: `已建立正式任务：${task.title}` },
  ]
  return logs.sort((left, right) => right.time.localeCompare(left.time))
}

function mergeLogs(module: ModuleKey, taskId: string, logs: EngineeringLog[]): EngineeringLog[] {
  return [...(runtimeLogs[module].get(taskId) || []), ...logs].sort((left, right) => right.time.localeCompare(left.time))
}

function getCommonStatusMeta(status: string): { label: string; className: string } {
  return COMMON_STATUS_META[status] || { label: status || '-', className: 'bg-slate-100 text-slate-600' }
}

function getSampleStatusMeta(status: string): { label: string; className: string } {
  return SAMPLE_STATUS_META[status] || { label: status || '-', className: 'bg-slate-100 text-slate-600' }
}

function renderStatusBadge(status: string, sample = false): string {
  const meta = sample ? getSampleStatusMeta(status) : getCommonStatusMeta(status)
  return `<span class="${escapeHtml(toClassName('inline-flex rounded-full px-2.5 py-1 text-xs font-medium', meta.className))}">${escapeHtml(meta.label)}</span>`
}

function renderNotice(): string {
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

function renderPageHeader(title: string, actionLabel: string, action: string): string {
  const createAction = actionLabel && action
    ? `
        <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-engineering-action="${escapeHtml(action)}">
          <i data-lucide="plus" class="h-4 w-4"></i>${escapeHtml(actionLabel)}
        </button>
      `
    : ''
  return `
    <section class="rounded-xl border bg-white px-4 py-4 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs text-slate-500">商品中心 / 打版与样衣工程</p>
          <h1 class="mt-1 text-2xl font-semibold text-slate-900">${escapeHtml(title)}</h1>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="refresh-page">
            <i data-lucide="refresh-cw" class="h-4 w-4"></i>刷新
          </button>
          ${createAction}
        </div>
      </div>
    </section>
  `
}

function renderMetricButton(label: string, value: number, active: boolean, quickFilter: string, actionPrefix: string): string {
  return `
    <button
      type="button"
      class="${escapeHtml(
        toClassName(
          'rounded-xl border px-4 py-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow',
          active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white',
        ),
      )}"
      data-pcs-engineering-action="${escapeHtml(actionPrefix)}"
      data-quick-filter="${escapeHtml(quickFilter)}"
    >
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm text-slate-500">${escapeHtml(label)}</p>
          <p class="mt-2 text-2xl font-semibold text-slate-900">${escapeHtml(value)}</p>
        </div>
        <i data-lucide="bar-chart-3" class="h-5 w-5 ${active ? 'text-blue-600' : 'text-slate-300'}"></i>
      </div>
    </button>
  `
}

function renderPagination(currentPage: number, total: number, actionPrefix: string): string {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  return `
    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
      <p>共 ${escapeHtml(total)} 条，当前第 ${escapeHtml(currentPage)} / ${escapeHtml(totalPages)} 页</p>
      <div class="flex items-center gap-2">
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" data-pcs-engineering-action="${escapeHtml(actionPrefix)}" data-page-step="-1" ${currentPage <= 1 ? 'disabled' : ''}>上一页</button>
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" data-pcs-engineering-action="${escapeHtml(actionPrefix)}" data-page-step="1" ${currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
      </div>
    </div>
  `
}

function paginate<T>(items: T[], currentPage: number): T[] {
  const start = (currentPage - 1) * PAGE_SIZE
  return items.slice(start, start + PAGE_SIZE)
}

function isOverdue(dateTime: string, done: boolean): boolean {
  if (!dateTime || done) return false
  return dateTime.slice(0, 10) < todayText()
}

function projectButton(projectId: string, projectCode: string, projectName: string): string {
  if (!projectId) return '<span class="text-slate-400">未关联商品项目</span>'
  return `<button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(projectId)}">${escapeHtml(projectCode || projectName)}</button>`
}

function projectNodeButton(projectId: string, projectNodeId: string, label: string): string {
  if (!projectId || !projectNodeId) return '<span class="text-slate-400">未关联项目节点</span>'
  return `<button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(projectId)}">${escapeHtml(label)}</button>`
}

function styleArchiveButton(styleId: string, styleCode: string, styleName: string): string {
  if (!styleId) return '<span class="text-slate-400">待选择款式档案</span>'
  return `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/products/styles/${escapeHtml(styleId)}">${escapeHtml(styleCode || styleName || '查看款式档案')}</button>`
}

function styleArchiveLinkByProject(projectId: string): string {
  const style = findStyleArchiveByProjectId(projectId)
  if (!style) return '<span class="text-slate-400">待建立</span>'
  return `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/products/styles/${escapeHtml(style.styleId)}">${escapeHtml(style.styleCode)}</button>`
}

function revisionTaskNewTabLink(revisionTaskId: string, revisionTaskCode: string): string {
  if (!revisionTaskId) return '<span class="text-slate-400">未创建改版任务</span>'
  return `<a class="font-medium text-blue-700 hover:underline" href="/pcs/patterns/revision/${escapeHtml(revisionTaskId)}" target="_blank" rel="noreferrer">${escapeHtml(revisionTaskCode || '查看改版任务')}</a>`
}

function styleArchiveLink(
  styleId: string,
  styleCode: string,
  styleName: string,
  projectId = '',
): string {
  if (styleId) return styleArchiveButton(styleId, styleCode, styleName)
  if (projectId) return styleArchiveLinkByProject(projectId)
  return '<span class="text-slate-400">未关联款式档案</span>'
}

function getTaskStyleInfo(task: {
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

function techPackLinkByProject(projectId: string, technicalVersionId: string, fallbackLabel: string): string {
  const style = findStyleArchiveByProjectId(projectId)
  if (!style || !technicalVersionId) return '<span class="text-slate-400">未生成</span>'
  return `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/products/styles/${escapeHtml(style.styleId)}/technical-data/${escapeHtml(technicalVersionId)}">${escapeHtml(fallbackLabel)}</button>`
}

function getOwners(items: Array<{ ownerName: string }>): string[] {
  return Array.from(new Set(items.map((item) => item.ownerName).filter(Boolean))).sort((left, right) => left.localeCompare(right))
}

function getSources(items: Array<{ sourceType: string }>): string[] {
  return Array.from(new Set(items.map((item) => item.sourceType).filter(Boolean))).sort((left, right) => left.localeCompare(right))
}

function buildStyleArchiveOptions(): Array<{ value: string; label: string }> {
  return listStyleArchives().map((style) => ({
    value: style.styleId,
    label: `${style.styleCode} · ${style.styleName}`,
  }))
}

function renderListFilters(input: {
  searchPlaceholder: string
  listState: ListState | SampleListState
  searchField: string
  statusField: string
  ownerField: string
  sourceField: string
  statusOptions: string[]
  ownerOptions: string[]
  sourceOptions: string[]
  siteField?: string
  siteOptions?: string[]
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
            ${input.statusOptions.map((option) => `<option value="${escapeHtml(option)}" ${listState.status === option ? 'selected' : ''}>${escapeHtml(option === '异常待处理' ? '阻塞' : option)}</option>`).join('')}
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

function renderTabBar<T extends string>(current: T, options: Array<{ key: T; label: string }>, action: string): string {
  return `
    <div class="grid gap-2 rounded-xl border bg-white p-2 shadow-sm" style="grid-template-columns: repeat(${Math.min(options.length, 7)}, minmax(0, 1fr));">
      ${options.map((option) => `
        <button type="button" class="${escapeHtml(toClassName('inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium transition', current === option.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'))}" data-pcs-engineering-action="${escapeHtml(action)}" data-tab="${escapeHtml(option.key)}">${escapeHtml(option.label)}</button>
      `).join('')}
    </div>
  `
}

function renderKeyValueGrid(items: Array<{ label: string; value: string }>, columns = 3): string {
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

function renderSectionCard(title: string, body: string, subtitle?: string): string {
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

function renderDialog(open: boolean, title: string, body: string, closeAction: string, submitAction: string, submitLabel: string): string {
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

function splitLines(value: string): string[] {
  return value.split(/\n|,|，|、/).map((item) => item.trim()).filter(Boolean)
}

function serializePlateTemplateLinks(links: Array<{ templateId: string; templateCode: string; templateName: string; matchedPartNames: string[] }>): string {
  return links.map((link) => [
    link.templateId,
    link.templateCode,
    link.templateName,
    link.matchedPartNames.join('、'),
  ].join(' | ')).join('\n')
}

function parsePlateTemplateLinks(value: string) {
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

function ensureRevisionDetailDraft(task: ReturnType<typeof getRevisionTaskById>): RevisionDetailDraft {
  if (!task) return initialRevisionDetailDraft()
  if (state.revisionDetailDraftTaskId !== task.revisionTaskId) {
    state.revisionDetailDraftTaskId = task.revisionTaskId
    state.revisionDetailDraft = {
      participantNamesText: task.participantNames.join('、'),
      revisionVersion: task.revisionVersion,
      baseStyleCode: task.baseStyleCode || task.styleCode || task.productStyleCode || '',
      baseStyleName: task.baseStyleName || task.styleName || '',
      targetStyleCodeCandidate: task.targetStyleCodeCandidate || '',
      targetStyleNameCandidate: task.targetStyleNameCandidate || '',
      targetStyleImageIds: [...(task.targetStyleImageIds || [])],
      sampleQty: task.sampleQty ? String(task.sampleQty) : '',
      stylePreference: task.stylePreference || '',
      patternMakerName: task.patternMakerName || task.ownerName || '',
      revisionSuggestionRichText: task.revisionSuggestionRichText || task.issueSummary || '',
      paperPrintAt: task.paperPrintAt || '',
      deliveryAddress: task.deliveryAddress || '',
      patternArea: task.patternArea || '',
      materialAdjustmentLines: [...(task.materialAdjustmentLines || [])],
      newPatternImageIds: [...(task.newPatternImageIds || [])],
      newPatternSpuCode: task.newPatternSpuCode || '',
      patternChangeNote: task.patternChangeNote || '',
      patternPieceImageIds: [...(task.patternPieceImageIds || [])],
      patternFileIds: [...(task.patternFileIds || [])],
      mainImageIds: [...(task.mainImageIds || task.evidenceImageUrls || [])],
      designDraftImageIds: [...(task.designDraftImageIds || [])],
      liveRetestRequired: Boolean(task.liveRetestRequired),
      liveRetestStatus: task.liveRetestStatus || '不需要',
      liveRetestRelationIdsText: (task.liveRetestRelationIds || []).join('\n'),
      liveRetestSummary: task.liveRetestSummary || '',
    }
  }
  return state.revisionDetailDraft
}

function ensurePlateDetailDraft(task: ReturnType<typeof getPlateMakingTaskById>): PlateDetailDraft {
  if (!task) return initialPlateDetailDraft()
  if (state.plateDetailDraftTaskId !== task.plateTaskId) {
    state.plateDetailDraftTaskId = task.plateTaskId
    state.plateDetailDraft = {
      participantNamesText: task.participantNames.join('、'),
      patternVersion: task.patternVersion,
      productHistoryType: task.productHistoryType || '',
      patternMakerName: task.patternMakerName || task.ownerName || '',
      sampleConfirmedAt: task.sampleConfirmedAt || '',
      urgentFlag: Boolean(task.urgentFlag),
      patternArea: task.patternArea || '',
      colorRequirementText: task.colorRequirementText || '',
      newPatternSpuCode: task.newPatternSpuCode || '',
      flowerImageIds: [...(task.flowerImageIds || [])],
      materialRequirementLines: [...(task.materialRequirementLines || [])],
      patternImageLineItems: [...(task.patternImageLineItems || [])],
      patternPdfFileIds: [...(task.patternPdfFileIds || [])],
      patternDxfFileIds: [...(task.patternDxfFileIds || [])],
      patternRulFileIds: [...(task.patternRulFileIds || [])],
      supportImageIds: [...(task.supportImageIds || [])],
      supportVideoIds: [...(task.supportVideoIds || [])],
      partTemplateLinksText: serializePlateTemplateLinks(task.partTemplateLinks || []),
    }
  }
  return state.plateDetailDraft
}

function ensurePatternDetailDraft(task: ReturnType<typeof getPatternTaskById>): PatternDetailDraft {
  if (!task) {
    return initialPatternDetailDraft()
  }
  if (state.patternDetailDraftTaskId !== task.patternTaskId) {
    state.patternDetailDraftTaskId = task.patternTaskId
    state.patternDetailDraft = {
      artworkVersion: task.artworkVersion,
      difficultyGrade: task.difficultyGrade,
      colorDepthOption: task.colorDepthOption,
      physicalReferenceNote: task.physicalReferenceNote,
      colorConfirmNote: task.colorConfirmNote,
      completionImageIds: [...task.completionImageIds],
      liveReferenceImageIds: [...task.liveReferenceImageIds],
      imageReferenceIds: [...task.imageReferenceIds],
      buyerReviewNote: task.buyerReviewNote,
      transferReason: task.transferReason,
      patternCategoryCode: task.patternCategoryCode,
      patternStyleTagsText: task.patternStyleTags.join('、'),
      hotSellerFlag: task.hotSellerFlag,
    }
  }
  return state.patternDetailDraft
}

function renderTaskSaveBar(action: string, taskId: string, label = '保存任务'): string {
  return `
    <div class="mt-4 flex justify-end">
      <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="${escapeHtml(action)}" data-task-id="${escapeHtml(taskId)}">${escapeHtml(label)}</button>
    </div>
  `
}

function renderTextInput(label: string, field: string, value: string, placeholder = ''): string {
  return `
    <label class="flex flex-col gap-2 text-sm text-slate-600">
      <span>${escapeHtml(label)}</span>
      <input class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" data-pcs-engineering-field="${escapeHtml(field)}" />
    </label>
  `
}

function renderTextarea(label: string, field: string, value: string, placeholder = ''): string {
  return `
    <label class="flex flex-col gap-2 text-sm text-slate-600">
      <span>${escapeHtml(label)}</span>
      <textarea class="min-h-[96px] rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" placeholder="${escapeHtml(placeholder)}" data-pcs-engineering-field="${escapeHtml(field)}">${escapeHtml(value)}</textarea>
    </label>
  `
}

function renderSelectInput(label: string, field: string, value: string, options: Array<{ value: string; label: string }>): string {
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

function buildFirstOrderFactoryOptions(): Array<{ value: string; label: string }> {
  return FIRST_ORDER_SAMPLE_FACTORY_OPTIONS.map((item) => ({ value: item.factoryId, label: item.factoryName }))
}

function buildFirstSampleFactoryOptions(): Array<{ value: string; label: string }> {
  return FIRST_SAMPLE_FACTORY_OPTIONS.map((item) => ({ value: item.factoryId, label: item.factoryName }))
}

function getFirstOrderFactoryName(factoryId: string): string {
  return FIRST_ORDER_SAMPLE_FACTORY_OPTIONS.find((item) => item.factoryId === factoryId)?.factoryName || ''
}

function getFirstSampleFactoryName(factoryId: string): string {
  return FIRST_SAMPLE_FACTORY_OPTIONS.find((item) => item.factoryId === factoryId)?.factoryName || ''
}

function getFirstOrderFactoryIdByName(factoryName: string): string {
  return FIRST_ORDER_SAMPLE_FACTORY_OPTIONS.find((item) => item.factoryName === factoryName)?.factoryId || ''
}

function buildProjectOptions(): Array<{ value: string; label: string }> {
  return listProjects().map((project) => ({ value: project.projectId, label: `${project.projectCode} · ${project.projectName}` }))
}

function buildRevisionOwnerOptions(): Array<{ value: string; label: string }> {
  const ownerNames = new Set<string>()
  listProjects().forEach((project) => {
    if (project.ownerName) ownerNames.add(project.ownerName)
  })
  listRevisionTasks().forEach((task) => {
    if (task.ownerName) ownerNames.add(task.ownerName)
  })
  ;['当前用户', '李版师', '商品负责人', '运营负责人', '设计负责人', '花型设计师'].forEach((name) => ownerNames.add(name))
  return Array.from(ownerNames)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({ value: name, label: name }))
}

function toDateTimeLocalValue(value: string): string {
  if (!value) return ''
  if (value.includes('T')) return value.slice(0, 16)
  return value.replace(' ', 'T').slice(0, 16)
}

function fromDateTimeLocalValue(value: string): string {
  if (!value) return ''
  const normalized = value.replace('T', ' ')
  return normalized.length === 16 ? `${normalized}:00` : normalized
}

function renderDateTimeInput(label: string, field: string, value: string): string {
  return `
    <label class="flex flex-col gap-2 text-sm text-slate-600">
      <span>${escapeHtml(label)}</span>
      <input type="datetime-local" class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" value="${escapeHtml(toDateTimeLocalValue(value))}" data-pcs-engineering-field="${escapeHtml(field)}" />
    </label>
  `
}

function buildSelectOptions(values: readonly string[]): Array<{ value: string; label: string }> {
  return values.map((value) => ({ value, label: value }))
}

function parseTagsText(value: string): string[] {
  return value.split(/[、,，]/).map((item) => item.trim()).filter(Boolean)
}

function renderImageList(imageIds: string[], emptyText = '暂无图片'): string {
  if (imageIds.length === 0) {
    return `<div class="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500">${escapeHtml(emptyText)}</div>`
  }
  return `
    <div class="flex flex-wrap gap-3">
      ${imageIds.map((imageId, index) => `
        <button type="button" class="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50" data-pcs-engineering-action="open-image-preview" data-url="${escapeHtml(imageId)}" data-title="图片 ${index + 1}">
          <img src="${escapeHtml(imageId)}" alt="花型图片${index + 1}" class="h-20 w-20 object-cover" />
        </button>
      `).join('')}
    </div>
  `
}

function renderSmallImage(imageId: string): string {
  if (!imageId) return '<span class="text-slate-400">未上传</span>'
  return `<button type="button" class="overflow-hidden rounded-md border border-slate-200 bg-slate-50" data-pcs-engineering-action="open-image-preview" data-url="${escapeHtml(imageId)}" data-title="需求图"><img src="${escapeHtml(imageId)}" alt="需求图" class="h-12 w-12 object-cover" /></button>`
}

function renderImageUploader(label: string, field: string, imageIds: string[], emptyText = '暂无图片'): string {
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
              ${imageIds.map((imageId, index) => `
                <div class="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <button type="button" class="block h-20 w-20 overflow-hidden" data-pcs-engineering-action="open-image-preview" data-url="${escapeHtml(imageId)}" data-title="${escapeHtml(label)} ${index + 1}">
                    <img src="${escapeHtml(imageId)}" alt="${escapeHtml(label)} ${index + 1}" class="h-full w-full object-cover transition group-hover:scale-105" />
                  </button>
                  <button type="button" class="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-xs text-slate-600 shadow hover:bg-white" data-pcs-engineering-action="remove-list-item" data-scope="${escapeHtml(field)}" data-index="${index}" aria-label="删除图片">×</button>
                </div>
              `).join('')}
            </div>`
          : renderImageList(imageIds, emptyText)
      }
    </div>
  `
}

function extractFileLabel(fileId: string): string {
  if (!fileId) return ''
  const match = fileId.match(/[^/]+$/)
  const raw = match ? match[0] : fileId
  return decodeURIComponent(raw.replace(/^mock-file:\/\//, ''))
}

function renderFileUploader(label: string, field: string, fileIds: string[], emptyText = '未上传', accept = ''): string {
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

function buildMockFileId(file: File): string {
  return `mock-file://${Date.now()}-${encodeURIComponent(file.name)}`
}

function appendImageValues(field: string, values: string[]): boolean {
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

function appendFileValues(field: string, values: string[]): boolean {
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
  return false
}

function removeListValue(scope: string, index: number): boolean {
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

function updateRevisionMaterialLine(index: number, key: string, value: string): void {
  const line = state.revisionDetailDraft.materialAdjustmentLines[index]
  if (!line) return
  if (key === 'quantity' || key === 'unitPrice') {
    line[key] = Number(value || 0)
    line.amount = Number((line.quantity || 0) * (line.unitPrice || 0))
    return
  }
  if (key === 'note' || key === 'materialName' || key === 'materialSku' || key === 'printRequirement') {
    ;(line[key] as string) = value
  }
}

function updatePlateMaterialLine(index: number, key: string, value: string): void {
  const line = state.plateDetailDraft.materialRequirementLines[index]
  if (!line) return
  if (key === 'quantity' || key === 'unitPrice') {
    line[key] = Number(value || 0)
    line.amount = Number((line.quantity || 0) * (line.unitPrice || 0))
    return
  }
  if (key === 'note' || key === 'materialName' || key === 'materialSku' || key === 'printRequirement') {
    ;(line[key] as string) = value
  }
}

function updatePlatePatternImageLine(index: number, key: string, value: string): void {
  const line = state.plateDetailDraft.patternImageLineItems[index]
  if (!line) return
  if (key === 'pieceCount') {
    line.pieceCount = Number(value || 0)
    return
  }
  if (key === 'materialPartName' || key === 'materialDescription') {
    ;(line[key] as string) = value
  }
}

function newRevisionMaterialLine(prefix: string): RevisionTaskMaterialLine {
  return {
    lineId: `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    materialImageId: '',
    materialName: '',
    materialSku: '',
    printRequirement: '',
    quantity: 0,
    unitPrice: 0,
    amount: 0,
    note: '',
  }
}

function newPlateMaterialLine(prefix: string): PlateMakingMaterialLine {
  return {
    lineId: `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    materialImageId: '',
    materialName: '',
    materialSku: '',
    printRequirement: '',
    quantity: 0,
    unitPrice: 0,
    amount: 0,
    note: '',
  }
}

function newPlatePatternImageLine(prefix: string): PlateMakingPatternImageLine {
  return {
    lineId: `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    imageId: '',
    materialPartName: '',
    materialDescription: '',
    pieceCount: 0,
  }
}

function getPatternMemberOptions(teamCode: string): Array<{ value: string; label: string }> {
  return listPatternTaskMembersByTeam(teamCode).map((item) => ({ value: item.memberId, label: item.memberName }))
}

function renderPreviewImageModal(): string {
  if (!state.imagePreview.open || !state.imagePreview.url) return ''
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button type="button" class="absolute inset-0 bg-slate-900/70" data-pcs-engineering-action="close-image-preview" aria-label="关闭图片预览"></button>
      <div class="relative w-full max-w-5xl rounded-2xl bg-white p-4 shadow-2xl">
        <div class="mb-3 flex items-center justify-between gap-3">
          <p class="text-sm font-medium text-slate-900">${escapeHtml(state.imagePreview.title || '图片预览')}</p>
          <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" data-pcs-engineering-action="close-image-preview" aria-label="关闭图片预览">×</button>
        </div>
        <div class="flex max-h-[75vh] items-center justify-center overflow-auto rounded-xl bg-slate-100 p-3">
          <img src="${escapeHtml(state.imagePreview.url)}" alt="${escapeHtml(state.imagePreview.title || '图片预览')}" class="max-h-[70vh] max-w-full rounded-lg object-contain" />
        </div>
      </div>
    </div>
  `
}

function renderImageThumbnailGrid(imageUrls: string[], removable = false): string {
  if (!imageUrls.length) return ''
  return `
    <div class="grid grid-cols-4 gap-3 sm:grid-cols-5">
      ${imageUrls.map((url, index) => `
        <div class="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <button type="button" class="block h-20 w-full overflow-hidden" data-pcs-engineering-action="open-image-preview" data-url="${escapeHtml(url)}" data-title="证据图片 ${index + 1}">
            <img src="${escapeHtml(url)}" alt="证据图片 ${index + 1}" class="h-full w-full object-cover transition group-hover:scale-105" />
          </button>
          ${
            removable
              ? `<button type="button" class="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-xs text-slate-600 shadow hover:bg-white" data-pcs-engineering-action="remove-revision-evidence-image" data-image-index="${index}" aria-label="删除证据图片">×</button>`
              : ''
          }
        </div>
      `).join('')}
    </div>
  `
}

function renderRevisionEvidenceUploader(imageUrls: string[]): string {
  return `
    <div class="space-y-3 rounded-lg border border-slate-200 px-3 py-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm font-medium text-slate-900">证据图片</p>
        <label class="inline-flex h-9 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">
          上传图片
          <input type="file" accept="image/*" multiple class="hidden" data-pcs-engineering-field="revision-create-evidence-images" />
        </label>
      </div>
      ${
        imageUrls.length > 0
          ? renderImageThumbnailGrid(imageUrls, true)
          : '<div class="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">暂未上传证据图片</div>'
      }
    </div>
  `
}

function getProjectDefaultValues(projectId: string): { ownerName: string; styleId: string; styleCode: string; styleName: string } {
  const project = getProjectById(projectId)
  const style = findStyleArchiveByProjectId(projectId)
  return {
    ownerName: project?.ownerName || '',
    styleId: style?.styleId || '',
    styleCode: style?.styleCode || '',
    styleName: style?.styleName || '',
  }
}

function getRevisionTaskStyle(task: { styleId: string; styleCode: string; styleName: string; projectId: string }) {
  if (task.styleId) {
    return {
      styleId: task.styleId,
      styleCode: task.styleCode,
      styleName: task.styleName,
    }
  }
  const style = findStyleArchiveByProjectId(task.projectId)
  return {
    styleId: style?.styleId || '',
    styleCode: style?.styleCode || task.styleCode || '',
    styleName: style?.styleName || task.styleName || '',
  }
}

function getRevisionDownstreamFlag(task: { revisionTaskId: string; revisionTaskCode: string; projectId: string }): string {
  const count = getRevisionDownstreamRows(task).length
  return count > 0
    ? `<span class="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">有 ${count} 个</span>`
    : '<span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">无</span>'
}

function getRevisionScopeText(scopeCodes: string[], scopeNames: string[]): string {
  return scopeNames.join('、') || scopeCodes.join('、') || '-'
}

function canCreateRevisionPatternTask(scopeCodes: string[], sourceType: RevisionTaskSourceType, projectId: string): boolean {
  return scopeCodes.includes('PRINT') && (sourceType === '测款结论返改' || sourceType === '首版样衣返改') && Boolean(projectId)
}

function renderRevisionMaterialLineEditor(lines: RevisionTaskMaterialLine[]): string {
  return `
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-medium text-slate-900">明细编辑</p>
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="add-revision-material-line">新增面辅料</button>
      </div>
      ${
        lines.length
          ? lines.map((line, index) => `
              <div class="rounded-lg border border-slate-200 p-4">
                <div class="grid gap-4 md:grid-cols-[88px_1fr_1fr]">
                  <div class="space-y-2">
                    ${line.materialImageId ? renderSmallImage(line.materialImageId) : '<div class="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-slate-200 text-xs text-slate-400">未上传</div>'}
                    <label class="inline-flex h-8 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50">
                      上传图片
                      <input type="file" accept="image/*" class="hidden" data-pcs-engineering-field="revision-material-line-image" data-line-index="${index}" />
                    </label>
                  </div>
                  <div class="grid gap-3 md:grid-cols-2">
                    ${renderLineInput('materialName', index, 'revision-material', '名称', line.materialName)}
                    ${renderLineInput('materialSku', index, 'revision-material', 'SKU', line.materialSku)}
                    ${renderLineInput('printRequirement', index, 'revision-material', '印花要求', line.printRequirement)}
                    ${renderLineInput('quantity', index, 'revision-material', '数量', String(line.quantity || ''))}
                    ${renderLineInput('unitPrice', index, 'revision-material', '单价', String(line.unitPrice || ''))}
                    <div class="flex flex-col gap-2 text-sm text-slate-600">
                      <span>金额</span>
                      <div class="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm leading-10 text-slate-900">${escapeHtml(String(line.amount || (Number(line.quantity || 0) * Number(line.unitPrice || 0)) || ''))}</div>
                    </div>
                  </div>
                  <div class="flex flex-col gap-2 text-sm text-slate-600">
                    <span>备注</span>
                    <textarea class="min-h-[96px] rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-engineering-line-module="revision-material" data-line-index="${index}" data-line-key="note">${escapeHtml(line.note || '')}</textarea>
                  </div>
                </div>
                <div class="mt-3 flex justify-end">
                  <button type="button" class="text-xs text-rose-600 hover:text-rose-700" data-pcs-engineering-action="remove-revision-material-line" data-line-index="${index}">删除</button>
                </div>
              </div>
            `).join('')
          : '<div class="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">暂无面辅料变化</div>'
      }
    </div>
  `
}

function renderPlateMaterialLineEditor(lines: PlateMakingMaterialLine[]): string {
  return `
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-medium text-slate-900">面辅料明细</p>
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="add-plate-material-line">新增面辅料</button>
      </div>
      ${
        lines.length
          ? lines.map((line, index) => `
              <div class="rounded-lg border border-slate-200 p-4">
                <div class="grid gap-4 md:grid-cols-[88px_1fr_1fr]">
                  <div class="space-y-2">
                    ${line.materialImageId ? renderSmallImage(line.materialImageId) : '<div class="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-slate-200 text-xs text-slate-400">未上传</div>'}
                    <label class="inline-flex h-8 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50">
                      上传图片
                      <input type="file" accept="image/*" class="hidden" data-pcs-engineering-field="plate-material-line-image" data-line-index="${index}" />
                    </label>
                  </div>
                  <div class="grid gap-3 md:grid-cols-2">
                    ${renderLineInput('materialName', index, 'plate-material', '名称', line.materialName)}
                    ${renderLineInput('materialSku', index, 'plate-material', 'SKU', line.materialSku)}
                    ${renderLineInput('printRequirement', index, 'plate-material', '印花要求', line.printRequirement)}
                    ${renderLineInput('quantity', index, 'plate-material', '数量', String(line.quantity || ''))}
                    ${renderLineInput('unitPrice', index, 'plate-material', '单价', String(line.unitPrice || ''))}
                    <div class="flex flex-col gap-2 text-sm text-slate-600">
                      <span>金额</span>
                      <div class="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm leading-10 text-slate-900">${escapeHtml(String(line.amount || (Number(line.quantity || 0) * Number(line.unitPrice || 0)) || ''))}</div>
                    </div>
                  </div>
                  <div class="flex flex-col gap-2 text-sm text-slate-600">
                    <span>备注</span>
                    <textarea class="min-h-[96px] rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-engineering-line-module="plate-material" data-line-index="${index}" data-line-key="note">${escapeHtml(line.note || '')}</textarea>
                  </div>
                </div>
                <div class="mt-3 flex justify-end">
                  <button type="button" class="text-xs text-rose-600 hover:text-rose-700" data-pcs-engineering-action="remove-plate-material-line" data-line-index="${index}">删除</button>
                </div>
              </div>
            `).join('')
          : '<div class="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">暂无面辅料明细</div>'
      }
    </div>
  `
}

function renderPlatePatternImageLineEditor(lines: PlateMakingPatternImageLine[]): string {
  return `
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-medium text-slate-900">唛架图片</p>
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="add-plate-pattern-image-line">新增纸样图</button>
      </div>
      ${
        lines.length
          ? lines.map((line, index) => `
              <div class="rounded-lg border border-slate-200 p-4">
                <div class="grid gap-4 md:grid-cols-[88px_1fr_1fr_120px]">
                  <div class="space-y-2">
                    ${line.imageId ? renderSmallImage(line.imageId) : '<div class="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-slate-200 text-xs text-slate-400">未上传</div>'}
                    <label class="inline-flex h-8 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50">
                      上传图片
                      <input type="file" accept="image/*" class="hidden" data-pcs-engineering-field="plate-pattern-line-image" data-line-index="${index}" />
                    </label>
                  </div>
                  ${renderLineInput('materialPartName', index, 'plate-pattern-image', '部位说明', line.materialPartName)}
                  ${renderLineInput('materialDescription', index, 'plate-pattern-image', '描述', line.materialDescription)}
                  ${renderLineInput('pieceCount', index, 'plate-pattern-image', '片数', String(line.pieceCount || ''))}
                </div>
                <div class="mt-3 flex justify-end">
                  <button type="button" class="text-xs text-rose-600 hover:text-rose-700" data-pcs-engineering-action="remove-plate-pattern-image-line" data-line-index="${index}">删除</button>
                </div>
              </div>
            `).join('')
          : '<div class="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">暂无唛架图片</div>'
      }
    </div>
  `
}

function renderLineInput(
  key: string,
  index: number,
  module: string,
  label: string,
  value: string,
): string {
  return `
    <label class="flex flex-col gap-2 text-sm text-slate-600">
      <span>${escapeHtml(label)}</span>
      <input class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" value="${escapeHtml(value)}" data-pcs-engineering-line-module="${escapeHtml(module)}" data-line-index="${index}" data-line-key="${escapeHtml(key)}" />
    </label>
  `
}

function renderLogs(logs: EngineeringLog[]): string {
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

function buildPatternPreviewDataUrl(taskName: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
      <rect width="640" height="420" fill="#f7f3ee"/>
      <circle cx="120" cy="110" r="42" fill="#ec4899" fill-opacity="0.75"/>
      <circle cx="220" cy="180" r="58" fill="#0f766e" fill-opacity="0.78"/>
      <circle cx="350" cy="120" r="48" fill="#f97316" fill-opacity="0.68"/>
      <circle cx="470" cy="220" r="62" fill="#7c3aed" fill-opacity="0.65"/>
      <circle cx="540" cy="110" r="36" fill="#ef4444" fill-opacity="0.72"/>
      <text x="40" y="380" fill="#334155" font-size="28" font-family="Arial, sans-serif">${taskName.replace(/[<&>"]/g, '')}</text>
    </svg>
  `.trim()
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function createPatternAssetFromTask(taskId: string): { ok: boolean; message: string; assetId?: string } {
  const task = getPatternTaskById(taskId)
  if (!task) return { ok: false, message: '未找到花型任务。' }
  const existed = listPatternAssets().find((item) => item.source_task_id === task.patternTaskId)
  if (existed) {
    return { ok: true, message: `花型已进入花型库：${existed.pattern_code}`, assetId: existed.id }
  }

  const parsedFile: PatternParsedFileResult = {
    originalFilename: `${task.patternTaskCode}.png`,
    fileExt: 'png',
    mimeType: 'image/png',
    fileSize: 128000,
    imageWidth: 640,
    imageHeight: 420,
    aspectRatio: 640 / 420,
    colorMode: 'RGB',
    dpiX: 300,
    dpiY: 300,
    frameCount: 1,
    hasAlpha: false,
    filenameTokens: tokenizePatternFilename(`${task.patternTaskCode}-${task.artworkName || task.title}.png`),
    previewUrl: buildPatternPreviewDataUrl(task.artworkName || task.title),
    thumbnailUrl: buildPatternPreviewDataUrl(task.patternTaskCode),
    parseStatus: 'success',
    parseSummary: `${task.artworkType || '花型'} 文件解析完成，版本 ${task.artworkVersion || 'A1'}，可沉淀至花型库。`,
    dominantColors: ['综合色'],
    parseWarnings: [],
    parseResultJson: {
      sourceTaskId: task.patternTaskId,
      processType: task.processType,
      demandSourceType: task.demandSourceType,
      artworkVersion: task.artworkVersion,
      buyerReviewStatus: task.buyerReviewStatus,
    },
  }

  const asset = createPatternAsset({
    patternName: task.artworkName || task.title,
    aliases: [task.patternTaskCode],
    usageType: task.processType || task.patternMode || '数码印',
    category: task.patternCategoryCode || task.processType || '花型',
    categoryPrimary: task.patternCategoryCode || '花型分类',
    categorySecondary: task.processType || '数码印',
    styleTags: task.patternStyleTags.length > 0 ? task.patternStyleTags : [task.processType, task.colorDepthOption].filter(Boolean),
    colorTags: ['综合色'],
    hotFlag: task.hotSellerFlag,
    sourceType: '自研',
    sourceNote: `由花型任务 ${task.patternTaskCode} 沉淀`,
    sourceTaskCode: task.patternTaskCode,
    sourceTaskType: task.workItemTypeCode,
    sourceTaskName: task.title,
    sourceTechPackVersionId: task.linkedTechPackVersionId,
    sourceTechPackVersionCode: task.linkedTechPackVersionCode,
    buyerReviewStatus: task.buyerReviewStatus,
    difficultyGrade: task.difficultyGrade,
    assignedTeamCode: task.assignedTeamCode,
    assignedTeamName: task.assignedTeamName,
    assignedMemberId: task.assignedMemberId,
    assignedMemberName: task.assignedMemberName,
    sourcePatternTaskSnapshot: {
      demand_source_type: task.demandSourceType,
      process_type: task.processType,
      request_qty: task.requestQty,
      fabric_sku: task.fabricSku,
      fabric_name: task.fabricName,
      assigned_team_name: task.assignedTeamName,
      assigned_member_name: task.assignedMemberName,
      buyer_review_status: task.buyerReviewStatus,
    },
    applicableCategories: [task.productStyleCode || '成衣'],
    applicableParts: ['前片', '后片'],
    relatedPartTemplateIds: [],
    processDirection: task.colorConfirmNote || task.note || '按花型任务输出使用',
    maintenanceStatus: '已维护',
    createdBy: '当前用户',
    submitForReview: false,
    parsedFile,
    sourceTaskId: task.patternTaskId,
    sourceProjectId: task.projectId,
    license: {
      license_status: 'authorized',
      attachment_urls: [],
      copyright_owner: 'HiGood',
      license_scope: '内部研发使用',
    },
  })

  updatePatternTask(task.patternTaskId, {
    patternAssetId: asset.id,
    patternAssetCode: asset.pattern_code,
    patternCategoryCode: task.patternCategoryCode || asset.category_primary,
    patternStyleTags: task.patternStyleTags.length > 0 ? task.patternStyleTags : asset.style_tags,
    hotSellerFlag: task.hotSellerFlag,
    note: `${task.note ? `${task.note}；` : ''}已沉淀花型库：${asset.pattern_code}`,
    updatedAt: nowText(),
    updatedBy: '当前用户',
  })
  pushRuntimeLog('pattern', task.patternTaskId, '沉淀花型库', `已生成花型主档 ${asset.pattern_code}。`)
  return { ok: true, message: `花型已进入花型库：${asset.pattern_code}`, assetId: asset.id }
}

function renderEmptyDetail(title: string, listPath: string): string {
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

function renderHeaderMeta(title: string, subtitle: string, badges: string, actions: string): string {
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

function renderDataTable(headers: string[], rows: string, emptyText: string, footer = ''): string {
  return `
    <section class="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              ${headers.map((header) => `<th class="px-4 py-3 text-left font-medium text-slate-500">${escapeHtml(header)}</th>`).join('')}
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 bg-white">
            ${rows || `<tr><td colspan="${headers.length}" class="px-4 py-10 text-center text-sm text-slate-500">${escapeHtml(emptyText)}</td></tr>`}
          </tbody>
        </table>
      </div>
      ${footer}
    </section>
  `
}

function renderProjectContext(task: {
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemTypeName: string
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
        { label: '工作项节点', value: projectNodeButton(task.projectId, task.projectNodeId, task.workItemTypeName) },
        { label: '来源类型', value: escapeHtml(task.sourceType) },
        { label: '款式档案', value: styleArchiveLink(style.styleId, style.styleCode, style.styleName, task.projectId) },
        { label: '款式编码', value: escapeHtml(style.styleCode || task.productStyleCode || task.spuCode || '-') },
      ],
      3,
    ),
  )
}

function renderRevisionContext(task: ReturnType<typeof getRevisionTaskById>): string {
  if (!task) return ''
  const style = getRevisionTaskStyle(task)
  const referenceObjectText = task.referenceObjectId
    ? `${task.referenceObjectType || '参考对象'} · ${task.referenceObjectCode || task.referenceObjectId}${task.referenceObjectName ? ` · ${task.referenceObjectName}` : ''}`
    : '—'
  return renderSectionCard(
    '来源与关联',
    renderKeyValueGrid(
      [
        { label: '来源类型', value: escapeHtml(task.sourceType) },
        { label: '关联商品项目', value: projectButton(task.projectId, task.projectCode, task.projectName) },
        { label: '关联项目节点', value: projectNodeButton(task.projectId, task.projectNodeId, task.workItemTypeName) },
        { label: '关联款式档案', value: styleArchiveButton(style.styleId, style.styleCode, style.styleName) },
        { label: '款式编码', value: escapeHtml(style.styleCode || '-') },
        { label: '来源对象', value: escapeHtml(task.upstreamObjectCode || task.upstreamObjectId || '—') },
        { label: '参考对象', value: escapeHtml(referenceObjectText) },
        { label: '是否有下游任务', value: getRevisionDownstreamFlag(task) },
      ],
      4,
    ),
  )
}

function getRevisionTasksFiltered() {
  const tasks = listRevisionTasks()
  const keyword = state.revisionList.search.trim().toLowerCase()
  return tasks.filter((task) => {
    if (keyword) {
      const style = getRevisionTaskStyle(task)
      const haystack = [
        task.revisionTaskCode,
        task.title,
        task.projectCode,
        task.projectName,
        task.ownerName,
        style.styleCode,
        style.styleName,
        task.referenceObjectCode,
        task.referenceObjectName,
      ].join(' ').toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (state.revisionList.status !== 'all' && task.status !== state.revisionList.status) return false
    if (state.revisionList.owner !== 'all' && task.ownerName !== state.revisionList.owner) return false
    if (state.revisionList.source !== 'all' && task.sourceType !== state.revisionList.source) return false
    if (state.revisionList.quickFilter === 'mine' && task.ownerName !== '李版师') return false
    if (state.revisionList.quickFilter === 'pending-review' && task.status !== '待确认') return false
    if (state.revisionList.quickFilter === 'confirmed-no-output' && !(task.projectId && task.status === '已确认' && !task.linkedTechPackVersionId)) return false
    if (state.revisionList.quickFilter === 'blocked' && task.status !== '异常待处理') return false
    if (state.revisionList.quickFilter === 'overdue' && !isOverdue(task.dueAt, task.status === '已完成' || task.status === '已取消')) return false
    return true
  })
}

function renderRevisionListPage(): string {
  const tasks = listRevisionTasks()
  const filtered = getRevisionTasksFiltered()
  const owners = getOwners(tasks)
  const sources = getSources(tasks)
  const paged = paginate(filtered, state.revisionList.currentPage)
  const rows = paged.map((task) => {
    const overdue = isOverdue(task.dueAt, task.status === '已完成' || task.status === '已取消')
    const style = getRevisionTaskStyle(task)
    const showTechPackAction = Boolean(task.projectId) && isTechPackGenerationAllowedStatus(task.status)
    const imageId = task.targetStyleImageIds[0] || task.mainImageIds[0] || task.evidenceImageUrls[0] || ''
    return `
      <tr class="hover:bg-slate-50/70">
        <td class="px-4 py-4">${renderSmallImage(imageId)}</td>
        <td class="px-4 py-4">
          <div class="space-y-1">
            <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/patterns/revision/${escapeHtml(task.revisionTaskId)}">${escapeHtml(task.revisionTaskCode)}</button>
            <p class="text-xs text-slate-500">${escapeHtml(task.title)}</p>
          </div>
        </td>
        <td class="px-4 py-4">${projectButton(task.projectId, task.projectCode, task.projectName)}</td>
        <td class="px-4 py-4">
          <div class="space-y-1">
            <div>${styleArchiveButton(style.styleId, style.styleCode, style.styleName)}</div>
            <p class="text-xs text-slate-500">${escapeHtml(task.targetStyleCodeCandidate || task.targetStyleNameCandidate || '未补充新款候选')}</p>
          </div>
        </td>
        <td class="px-4 py-4">${escapeHtml(getRevisionScopeText(task.revisionScopeCodes, task.revisionScopeNames))}</td>
        <td class="px-4 py-4">${escapeHtml(task.liveRetestStatus || '不需要')}</td>
        <td class="px-4 py-4">${task.linkedTechPackVersionId ? `${techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, task.linkedTechPackVersionCode || task.linkedTechPackVersionLabel || '查看关联技术包')}` : '<span class="text-slate-400">未生成</span>'}</td>
        <td class="px-4 py-4">${renderStatusBadge(task.status)}</td>
        <td class="px-4 py-4">${escapeHtml(formatDateTime(task.updatedAt || task.dueAt))}${overdue ? '<span class="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] text-rose-700">超期</span>' : ''}</td>
        <td class="px-4 py-4">
          <div class="flex flex-wrap gap-2">
            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/patterns/revision/${escapeHtml(task.revisionTaskId)}">查看</button>
            ${showTechPackAction
              ? `<button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="revision-generate-tech-pack" data-task-id="${escapeHtml(task.revisionTaskId)}">${escapeHtml(getRevisionTechPackActionLabel())}</button>`
              : ''}
          </div>
        </td>
      </tr>
    `
  }).join('')

  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${renderPageHeader('改版任务', '新建改版任务', 'open-revision-create')}
      ${renderListFilters({
        searchPlaceholder: '搜索任务编号 / 商品项目 / 款式 / 负责人 / 参考对象',
        listState: state.revisionList,
        searchField: 'revision-search',
        statusField: 'revision-status',
        ownerField: 'revision-owner',
        sourceField: 'revision-source',
        statusOptions: ['未开始', '进行中', '待确认', '已确认', '已生成技术包', '已完成', '异常待处理', '已取消'],
        ownerOptions: owners,
        sourceOptions: REVISION_TASK_SOURCE_TYPE_LIST,
      })}
      <section class="grid gap-4 md:grid-cols-5">
        ${renderMetricButton('全部任务', tasks.length, state.revisionList.quickFilter === 'all', 'all', 'set-revision-quick-filter')}
        ${renderMetricButton('我的任务', tasks.filter((item) => item.ownerName === '李版师').length, state.revisionList.quickFilter === 'mine', 'mine', 'set-revision-quick-filter')}
        ${renderMetricButton('待确认', tasks.filter((item) => item.status === '待确认').length, state.revisionList.quickFilter === 'pending-review', 'pending-review', 'set-revision-quick-filter')}
        ${renderMetricButton('已确认未写包', tasks.filter((item) => item.projectId && item.status === '已确认' && !item.linkedTechPackVersionId).length, state.revisionList.quickFilter === 'confirmed-no-output', 'confirmed-no-output', 'set-revision-quick-filter')}
        ${renderMetricButton('超期任务', tasks.filter((item) => isOverdue(item.dueAt, item.status === '已完成' || item.status === '已取消')).length, state.revisionList.quickFilter === 'overdue', 'overdue', 'set-revision-quick-filter')}
      </section>
      ${renderDataTable(['商品图', '任务编号', '所属项目', '款式编码', '改版范围', '回直播验证状态', '技术包状态', '当前状态', '更新时间', '操作'], rows, '暂无改版任务数据', renderPagination(state.revisionList.currentPage, filtered.length, 'change-revision-page'))}
      ${renderRevisionCreateDialog()}
      ${renderPreviewImageModal()}
    </div>
  `
}

function renderRevisionIssues(task: ReturnType<typeof getRevisionTaskById>): string {
  if (!task) return ''
  return renderSectionCard(
    '问题点与证据',
    `
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 px-4 py-4">
          <p class="text-sm font-medium text-slate-900">问题点</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">${escapeHtml(task.issueSummary || '暂未补充问题点。')}</p>
        </div>
        <div class="rounded-lg border border-slate-200 px-4 py-4">
          <p class="text-sm font-medium text-slate-900">证据说明</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">${escapeHtml(task.evidenceSummary || '暂未补充问题点证据。')}</p>
          ${task.evidenceImageUrls.length > 0 ? `<div class="mt-4">${renderImageThumbnailGrid(task.evidenceImageUrls)}</div>` : '<p class="mt-3 text-xs text-slate-400">暂未上传证据图片。</p>'}
        </div>
      </div>
    `,
  )
}

function renderRevisionMaterialRows(task: ReturnType<typeof getRevisionTaskById>): string {
  const lines = task?.materialAdjustmentLines || []
  if (lines.length === 0) return '<div class="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">暂无面辅料变化</div>'
  return `
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50"><tr>${['面辅料', 'SKU', '印花要求', '数量', '单价', '金额', '备注'].map((item) => `<th class="px-3 py-2 text-left font-medium text-slate-500">${item}</th>`).join('')}</tr></thead>
        <tbody class="divide-y divide-slate-200">
          ${lines.map((line) => `
            <tr>
              <td class="px-3 py-2">${escapeHtml(line.materialName || '-')}</td>
              <td class="px-3 py-2">${escapeHtml(line.materialSku || '-')}</td>
              <td class="px-3 py-2">${escapeHtml(line.printRequirement || '-')}</td>
              <td class="px-3 py-2">${escapeHtml(String(line.quantity || '-'))}</td>
              <td class="px-3 py-2">${escapeHtml(String(line.unitPrice || '-'))}</td>
              <td class="px-3 py-2">${escapeHtml(String(line.amount || '-'))}</td>
              <td class="px-3 py-2">${escapeHtml(line.note || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderRevisionDownstream(task: ReturnType<typeof getRevisionTaskById>): string {
  if (!task) return ''
  const rows = getRevisionDownstreamRows(task)
  const suggestedTypes = inferDownstreamTypesFromRevisionTask(task)
  const emptyText = !task.projectId
    ? '未关联商品项目'
    : suggestedTypes.length === 0
      ? '当前改版范围暂无可创建的下游任务'
      : '暂无下游任务'
  return renderSectionCard(
    '下游任务',
    `
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-slate-600">${escapeHtml(suggestedTypes.length ? `建议下游：${suggestedTypes.map(getDownstreamTypeLabel).join('、')}` : emptyText)}</p>
        ${task.projectId && suggestedTypes.length
          ? `<button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="revision-create-downstream" data-task-id="${escapeHtml(task.revisionTaskId)}">创建建议下游</button>`
          : ''}
      </div>
      ${rows.length > 0
      ? `
          <div class="space-y-3">
            ${rows.map((row) => `
              <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3">
                <div>
                  <p class="text-sm font-medium text-slate-900">${escapeHtml(row.type)} · ${escapeHtml(row.code)}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(row.title)}</p>
                </div>
                <div class="flex items-center gap-3">
                  ${renderStatusBadge(row.status, row.type.includes('样衣'))}
                  <button type="button" class="text-sm font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(row.path)}">打开详情</button>
                </div>
              </div>
            `).join('')}
          </div>
        `
      : `<div class="rounded-lg border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">${escapeHtml(emptyText)}</div>`}
    `,
  )
}

function getDownstreamTypeLabel(type: string): string {
  if (type === 'PLATE') return '制版任务'
  if (type === 'PRINT') return '花型任务'
  if (type === 'FIRST_SAMPLE') return '首版样衣'
  if (type === 'FIRST_ORDER_SAMPLE') return '首单样衣'
  return type
}

function getRevisionDownstreamRows(task: { revisionTaskId: string; revisionTaskCode: string; projectId: string }) {
  const matchesRevision = (item: { upstreamObjectId: string; upstreamObjectCode: string }) =>
    item.upstreamObjectId === task.revisionTaskId || item.upstreamObjectCode === task.revisionTaskCode
  return [
    ...listPlateMakingTasks().filter(matchesRevision).map((item) => ({
      type: '制版任务',
      code: item.plateTaskCode,
      title: item.title,
      status: item.status,
      path: `/pcs/patterns/plate-making/${item.plateTaskId}`,
    })),
    ...listPatternTasks().filter(matchesRevision).map((item) => ({
      type: '花型任务',
      code: item.patternTaskCode,
      title: item.title,
      status: item.status,
      path: `/pcs/patterns/colors/${item.patternTaskId}`,
    })),
    ...listFirstSampleTasks().filter(matchesRevision).map((item) => ({
      type: '首版样衣',
      code: item.firstSampleTaskCode,
      title: item.title,
      status: item.status,
      path: `/pcs/samples/first-sample/${item.firstSampleTaskId}`,
    })),
    ...listFirstOrderSampleTasks().filter(matchesRevision).map((item) => ({
      type: '首单样衣',
      code: item.firstOrderSampleTaskCode,
      title: item.title,
      status: item.status,
      path: `/pcs/samples/first-order/${item.firstOrderSampleTaskId}`,
    })),
  ]
}

function getRevisionBusinessSource(task: ReturnType<typeof getRevisionTaskById>): { purpose: string; sourceText: string; sourceObject: string } {
  if (!task) return { purpose: '-', sourceText: '-', sourceObject: '-' }
  const sourceObject = task.upstreamObjectCode || task.upstreamObjectId || task.referenceObjectCode || task.referenceObjectName || '-'
  if (task.sourceType === '首版样衣返改') {
    return { purpose: '首版样衣返改', sourceText: '来源于首版样衣验收结论', sourceObject }
  }
  if (task.sourceType === '既有商品改款') {
    return { purpose: '既有商品二次开发', sourceText: '来源于正式款式档案', sourceObject: task.styleCode || sourceObject }
  }
  if (task.sourceType === '人工改版需求') {
    return { purpose: '人工改版需求', sourceText: '来源于人工参考或评审纪要', sourceObject }
  }
  return { purpose: '测款结论返改', sourceText: '来源于测款结论或项目节点', sourceObject }
}

function getRevisionTechPackStatusText(task: ReturnType<typeof getRevisionTaskById>): string {
  if (!task) return '-'
  if (task.linkedTechPackVersionId) {
    return task.linkedTechPackVersionStatus === 'DRAFT'
      ? '技术包草稿已生成'
      : task.linkedTechPackVersionStatus || '技术包已生成'
  }
  return '技术包暂未生成'
}

function getRevisionMissingItems(task: ReturnType<typeof getRevisionTaskById>, style: { styleId: string; styleCode: string }): string[] {
  if (!task) return []
  const missing: string[] = []
  if (!task.projectId) missing.push('关联商品项目')
  if (!style.styleId && !style.styleCode) missing.push('关联款式档案')
  if (!(task.issueSummary || '').trim()) missing.push('问题点')
  if (!(task.evidenceSummary || '').trim()) missing.push('证据说明')
  if ((task.revisionScopeNames || []).length === 0 && (task.revisionScopeCodes || []).length === 0) missing.push('改版范围')
  if (!(task.revisionSuggestionRichText || task.issueSummary || '').trim()) missing.push('修改建议')
  if (task.liveRetestRequired && task.liveRetestStatus === '待回直播验证') missing.push('回直播验证结论')
  if ((task.status === '已确认' || task.status === '待确认') && !task.linkedTechPackVersionId && !task.generatedNewTechPackVersionFlag) missing.push('生成改版技术包版本')
  if (task.status === '已生成技术包') {
    getRevisionTaskCompletionMissingFields(task).forEach((item) => {
      if (!missing.includes(item)) missing.push(item)
    })
  }
  return missing
}

function getRevisionNextActionText(task: ReturnType<typeof getRevisionTaskById>, missingItems: string[]): string {
  if (!task) return '-'
  if (!task.projectId) return '先补齐正式商品项目链路'
  if (task.status === '草稿' || task.status === '未开始') return '补齐字段后创建正式改版任务'
  if (task.status === '进行中') return missingItems.length ? '补齐改版资料后提交确认' : '提交确认'
  if (task.status === '待确认') return '确认改版产出'
  if (task.status === '已确认') return '生成改版技术包版本'
  if (task.status === '已生成技术包') return missingItems.length ? '补齐缺失项后完成任务' : '完成任务'
  if (task.status === '异常待处理') return '处理异常后恢复推进'
  if (task.status === '已取消') return '任务已取消'
  return '已完成收口'
}

function renderRevisionMissingItems(items: string[]): string {
  if (items.length === 0) return '<span class="text-emerald-700">当前无阻塞缺失项</span>'
  return `
    <div class="flex flex-wrap gap-2">
      ${items.map((item) => `<span class="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">${escapeHtml(item)}</span>`).join('')}
    </div>
  `
}

function renderRevisionDetailPage(revisionTaskId: string): string {
  syncExistingProjectEngineeringTaskNodes('系统同步')
  const task = getRevisionTaskById(revisionTaskId)
  if (!task) return renderEmptyDetail('改版任务', '/pcs/patterns/revision')
  const detailDraft = ensureRevisionDetailDraft(task)
  const style = getRevisionTaskStyle(task)
  const downstreamRows = getRevisionDownstreamRows(task)
  const businessSource = getRevisionBusinessSource(task)
  const missingItems = getRevisionMissingItems(task, style)
  const nextActionText = getRevisionNextActionText(task, missingItems)
  const relatedSamples = listFirstSampleTasks().filter((item) => item.projectId === task.projectId).slice(0, 3)
  const logs = mergeLogs('revision', task.revisionTaskId, [
    ...(task.linkedTechPackVersionId
      ? [{ time: task.linkedTechPackUpdatedAt || task.updatedAt, action: '技术包写回', user: task.updatedBy, detail: `已关联技术包 ${task.linkedTechPackVersionCode || task.linkedTechPackVersionLabel || task.linkedTechPackVersionId}。` }]
      : []),
    ...baseLogs(task),
  ])
  const actions = [
    `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/patterns/revision">返回列表</button>`,
    ...(task.status !== '已完成' && task.status !== '已取消'
      ? [`<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="save-revision-detail-fields" data-task-id="${escapeHtml(task.revisionTaskId)}">保存任务</button>`]
      : []),
    ...(task.status === '进行中'
      ? [`<button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-engineering-action="submit-revision-confirmation" data-task-id="${escapeHtml(task.revisionTaskId)}">提交确认</button>`]
      : []),
    ...(task.status === '待确认'
      ? [`<button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-engineering-action="confirm-revision-output" data-task-id="${escapeHtml(task.revisionTaskId)}">确认产出</button>`]
      : []),
    ...(task.projectId && task.status === '已确认'
      ? [`<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="revision-generate-tech-pack" data-task-id="${escapeHtml(task.revisionTaskId)}">${escapeHtml(getRevisionTechPackActionLabel())}</button>`]
      : []),
    ...(task.status === '已生成技术包'
      ? [`<button type="button" class="inline-flex h-10 items-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700" data-pcs-engineering-action="complete-revision-task" data-task-id="${escapeHtml(task.revisionTaskId)}">完成任务</button>`]
      : []),
  ].join('')
  const subtitleParts = [
    task.projectCode || '未关联商品项目',
    style.styleCode || '未关联款式档案',
    formatDateTime(task.updatedAt),
  ]

  const header = renderHeaderMeta(
    `${task.revisionTaskCode} · ${task.title}`,
    subtitleParts.join(' · '),
    `${renderStatusBadge(task.status)}<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">${escapeHtml(task.priorityLevel)}优先</span>`,
    actions,
  )

  const tabBar = renderTabBar(state.revisionTab, [
    { key: 'plan', label: '任务总览' },
    { key: 'issues', label: '改版内容' },
    { key: 'samples', label: '关联样衣' },
    { key: 'outputs', label: '产出与验证' },
    { key: 'downstream', label: '下游任务' },
    { key: 'logs', label: '日志' },
  ], 'set-revision-tab')

  const taskOverview = renderSectionCard('任务推进摘要', `
    <div class="grid gap-4 lg:grid-cols-4">
      <div class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <p class="text-xs text-slate-500">为什么改</p>
        <p class="mt-2 text-sm font-medium leading-6 text-slate-900">${escapeHtml(task.issueSummary || '待补充问题点')}</p>
      </div>
      <div class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <p class="text-xs text-slate-500">改什么</p>
        <p class="mt-2 text-sm font-medium leading-6 text-slate-900">${escapeHtml(getRevisionScopeText(task.revisionScopeCodes, task.revisionScopeNames))}</p>
      </div>
      <div class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <p class="text-xs text-slate-500">当前下一步</p>
        <p class="mt-2 text-sm font-medium leading-6 text-slate-900">${escapeHtml(nextActionText)}</p>
      </div>
      <div class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <p class="text-xs text-slate-500">技术包</p>
        <p class="mt-2 text-sm font-medium leading-6 text-slate-900">${escapeHtml(getRevisionTechPackStatusText(task))}</p>
      </div>
    </div>
    <div class="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
      <p class="text-xs font-medium text-amber-700">完成前缺失项</p>
      <div class="mt-2 text-sm">${renderRevisionMissingItems(missingItems)}</div>
    </div>
  `)

  const businessInfo = renderSectionCard('业务来源', renderKeyValueGrid([
    { label: '任务目的', value: escapeHtml(businessSource.purpose) },
    { label: '业务来源', value: escapeHtml(businessSource.sourceText) },
    { label: '来源对象', value: escapeHtml(businessSource.sourceObject) },
    { label: '所属项目', value: projectButton(task.projectId, task.projectCode, task.projectName) },
    { label: '所属款式', value: styleArchiveButton(style.styleId, style.styleCode, style.styleName) },
    { label: '任务编号', value: escapeHtml(task.revisionTaskCode) },
  ], 3))

  const styleCompare = renderSectionCard(
    '旧款 / 新款对比',
    `
      ${renderKeyValueGrid([
        { label: '旧款编码', value: escapeHtml(task.baseStyleCode || task.styleCode || '-') },
        { label: '旧款名称', value: escapeHtml(task.baseStyleName || task.styleName || '-') },
        { label: '新款候选编码', value: escapeHtml(task.targetStyleCodeCandidate || '-') },
        { label: '新款候选名称', value: escapeHtml(task.targetStyleNameCandidate || '-') },
      ], 4)}
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        ${renderFileChips('旧款图片', task.baseStyleImageIds || [])}
        ${renderFileChips('新款参考图', task.targetStyleImageIds || [])}
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        ${renderTextInput('旧款编码', 'revision-detail-base-style-code', detailDraft.baseStyleCode)}
        ${renderTextInput('旧款名称', 'revision-detail-base-style-name', detailDraft.baseStyleName)}
        ${renderTextInput('新款候选编码', 'revision-detail-target-style-code', detailDraft.targetStyleCodeCandidate)}
        ${renderTextInput('新款候选名称', 'revision-detail-target-style-name', detailDraft.targetStyleNameCandidate)}
      </div>
      <div class="mt-4">
        ${renderImageUploader('新款参考图', 'revision-detail-target-style-images', detailDraft.targetStyleImageIds, '未上传')}
      </div>
    `,
  )

  const revisionPlan = renderSectionCard(
    '改版说明',
    `
      ${renderKeyValueGrid([
        { label: '改版范围', value: escapeHtml(getRevisionScopeText(task.revisionScopeCodes, task.revisionScopeNames)) },
        { label: '改版版本', value: escapeHtml(task.revisionVersion || '-') },
        { label: '样衣数量', value: escapeHtml(task.sampleQty ? String(task.sampleQty) : '-') },
        { label: '风格偏好', value: escapeHtml(task.stylePreference || '-') },
      ], 4)}
      <div class="mt-4 rounded-lg border border-slate-200 p-4">
        <p class="text-xs text-slate-500">修改建议</p>
        <p class="mt-2 whitespace-pre-wrap text-sm text-slate-900">${escapeHtml(task.revisionSuggestionRichText || task.issueSummary || '-')}</p>
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        ${renderTextInput('参与人', 'revision-detail-participants', detailDraft.participantNamesText)}
        ${renderTextInput('改版版次', 'revision-detail-version', detailDraft.revisionVersion)}
        ${renderTextInput('样衣数量', 'revision-detail-sample-qty', detailDraft.sampleQty)}
        ${renderTextInput('打版人', 'revision-detail-pattern-maker-name', detailDraft.patternMakerName)}
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        ${renderTextarea('风格偏好', 'revision-detail-style-preference', detailDraft.stylePreference, '')}
        ${renderTextarea('修改建议', 'revision-detail-suggestion', detailDraft.revisionSuggestionRichText, '')}
      </div>
    `,
  )

  const materialChanges = renderSectionCard(
    '面辅料变化',
    `
      ${renderRevisionMaterialRows(task)}
      <div class="mt-4">
        ${renderRevisionMaterialLineEditor(detailDraft.materialAdjustmentLines)}
      </div>
    `,
  )
  const patternChanges = renderSectionCard(
    '花型变化',
    `
      ${renderKeyValueGrid([
        { label: '新花型 SPU', value: escapeHtml(task.newPatternSpuCode || '-') },
        { label: '花型变化说明', value: escapeHtml(task.patternChangeNote || '-') },
      ], 2)}
      <div class="mt-4">${renderFileChips('新花型图片', task.newPatternImageIds || [])}</div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        ${renderTextInput('新花型 SPU', 'revision-detail-new-pattern-spu', detailDraft.newPatternSpuCode, '')}
        ${renderTextarea('花型变化说明', 'revision-detail-pattern-change-note', detailDraft.patternChangeNote, '')}
      </div>
      <div class="mt-4">
        ${renderImageUploader('新花型图片', 'revision-detail-new-pattern-images', detailDraft.newPatternImageIds, '未上传')}
      </div>
    `,
  )

  const patternAndDrafts = renderSectionCard(
    '纸样与设计稿',
    `
      ${renderKeyValueGrid([
        { label: '纸样打印时间', value: escapeHtml(formatDateTime(task.paperPrintAt) || '-') },
        { label: '寄送地址', value: escapeHtml(task.deliveryAddress || '-') },
        { label: '打版区域', value: escapeHtml(task.patternArea || '-') },
        { label: '打版人', value: escapeHtml(task.patternMakerName || '-') },
      ], 4)}
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        ${renderFileChips('纸样图片', task.patternPieceImageIds || [])}
        ${renderFileChips('纸样文件', task.patternFileIds || [])}
        ${renderFileChips('主图图片', task.mainImageIds || [])}
        ${renderFileChips('新图设计稿', task.designDraftImageIds || [])}
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        ${renderDateTimeInput('纸样打印时间', 'revision-detail-paper-print-at', detailDraft.paperPrintAt)}
        ${renderSelectInput('打版区域', 'revision-detail-pattern-area', detailDraft.patternArea, buildSelectOptions(['', '印尼', '深圳']))}
      </div>
      <div class="mt-4">
        ${renderTextarea('寄送地址', 'revision-detail-delivery-address', detailDraft.deliveryAddress, '')}
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        ${renderImageUploader('纸样图片', 'revision-detail-pattern-piece-images', detailDraft.patternPieceImageIds, '未上传')}
        ${renderFileUploader('纸样文件', 'revision-detail-pattern-files', detailDraft.patternFileIds)}
        ${renderImageUploader('主图图片', 'revision-detail-main-images', detailDraft.mainImageIds, '未上传')}
        ${renderImageUploader('新图设计稿', 'revision-detail-design-drafts', detailDraft.designDraftImageIds, '未上传')}
      </div>
    `,
  )

  const liveRetest = renderSectionCard(
    '回直播验证',
    `
      ${renderKeyValueGrid([
        { label: '是否需要回直播验证', value: escapeHtml(task.liveRetestRequired ? '需要' : '不需要') },
        { label: '回直播验证状态', value: escapeHtml(task.liveRetestStatus || '不需要') },
        { label: '关联直播 / 测款记录', value: escapeHtml((task.liveRetestRelationIds || []).join('、') || '-') },
        { label: '验证说明', value: escapeHtml(task.liveRetestSummary || '-') },
      ], 2)}
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        ${renderSelectInput('回直播验证状态', 'revision-detail-live-retest-status', detailDraft.liveRetestStatus, buildSelectOptions(['不需要', '待回直播验证', '已回直播验证', '验证通过', '验证未通过']))}
        ${renderTextarea('回直播验证关系', 'revision-detail-live-retest-relations', detailDraft.liveRetestRelationIdsText, '')}
        ${renderTextarea('回直播验证说明', 'revision-detail-live-retest-summary', detailDraft.liveRetestSummary, '')}
      </div>
      <div class="mt-4 flex flex-wrap items-center gap-3">
        <label class="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" ${detailDraft.liveRetestRequired ? 'checked' : ''} data-pcs-engineering-field="revision-detail-live-retest-required" />
          <span>需要回直播验证</span>
        </label>
      </div>
      ${renderTaskSaveBar('save-revision-detail-fields', task.revisionTaskId)}
    `,
  )

  const samples = renderSectionCard(
    '关联样衣',
    relatedSamples.length > 0
      ? `
          <div class="space-y-3">
            ${relatedSamples.map((item) => `
              <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3">
                <div>
                  <p class="text-sm font-medium text-slate-900">${escapeHtml(item.sampleCode || item.firstSampleTaskCode)}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(item.title)}</p>
                </div>
                <div class="flex items-center gap-3">
                  ${renderStatusBadge(item.status, true)}
                  <button type="button" class="text-sm font-medium text-blue-700 hover:underline" data-nav="/pcs/samples/first-sample/${escapeHtml(item.firstSampleTaskId)}">打开详情</button>
                </div>
              </div>
            `).join('')}
          </div>
        `
      : '<div class="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">暂无关联样衣</div>',
  )

  const outputs = renderSectionCard(
    '产出物',
    `
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">技术包产出</p>
          <div class="mt-2 text-sm text-slate-900">${task.linkedTechPackVersionId ? `${techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, task.linkedTechPackVersionCode || task.linkedTechPackVersionLabel || '查看关联技术包')}<span class="mx-2 text-slate-300">/</span>${techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, '查看版本日志')}` : '尚未建立技术包版本'}</div>
        </div>
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">花型下游状态</p>
	          <p class="mt-2 text-sm text-slate-900">${downstreamRows.length > 0 ? `已生成 ${downstreamRows.length} 个下游任务` : '当前未生成下游任务'}</p>
        </div>
      </div>
    `,
  )
  const mainContent = state.revisionTab === 'plan'
    ? `${taskOverview}${businessInfo}${styleCompare}${revisionPlan}${renderTaskSaveBar('save-revision-detail-fields', task.revisionTaskId)}`
    : state.revisionTab === 'issues'
      ? `${renderRevisionIssues(task)}${materialChanges}${patternChanges}${patternAndDrafts}${renderTaskSaveBar('save-revision-detail-fields', task.revisionTaskId)}`
      : state.revisionTab === 'samples'
        ? samples
        : state.revisionTab === 'outputs'
          ? `${outputs}${liveRetest}${renderTaskSaveBar('save-revision-detail-fields', task.revisionTaskId)}`
          : state.revisionTab === 'downstream'
            ? renderRevisionDownstream(task)
            : renderSectionCard('日志与审批', renderLogs(logs))

  const aside = `
    <div class="space-y-4 xl:sticky xl:top-4">
      ${renderSectionCard(
        '推进状态',
        renderKeyValueGrid(
          [
            { label: '当前状态', value: renderStatusBadge(task.status) },
            { label: '负责人', value: escapeHtml(task.ownerName) },
            { label: '截止时间', value: escapeHtml(formatDateTime(task.dueAt)) },
            { label: '下一步', value: escapeHtml(nextActionText) },
            { label: '技术包', value: escapeHtml(getRevisionTechPackStatusText(task)) },
            { label: '下游任务', value: downstreamRows.length > 0 ? escapeHtml(`${downstreamRows.length} 个`) : '暂无' },
          ],
          1,
        ),
      )}
      ${renderSectionCard(
        '缺失项',
        `<div class="text-sm">${renderRevisionMissingItems(missingItems)}</div>`,
      )}
      ${renderSectionCard(
        '关联对象',
        renderKeyValueGrid(
          [
            { label: '项目', value: projectButton(task.projectId, task.projectCode, task.projectName) },
            { label: '款式', value: styleArchiveButton(style.styleId, style.styleCode, style.styleName) },
            { label: '业务来源', value: escapeHtml(businessSource.purpose) },
          ],
          1,
        ),
      )}
    </div>
  `

  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${header}
      ${tabBar}
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div class="space-y-6">${mainContent}</div>
        ${aside}
      </div>
      ${renderPreviewImageModal()}
    </div>
  `
}

function renderRevisionCreateDialog(): string {
  const draft = state.revisionCreateDraft
  const selectedStyle = getStyleArchiveById(draft.styleId)
  const selectedProjectDefaults = draft.projectId ? getProjectDefaultValues(draft.projectId) : { ownerName: '', styleId: '', styleCode: '', styleName: '' }
  const projectStyle = selectedProjectDefaults.styleId ? getStyleArchiveById(selectedProjectDefaults.styleId) : null
  const showProjectField = draft.bindingMode === 'project'
  const canCreatePatternTask = canCreateRevisionPatternTask(draft.scopeCodes, draft.sourceType, showProjectField ? draft.projectId : '')
  const body = `
    <div class="grid gap-4 md:grid-cols-2">
      ${renderSelectInput('创建方式', 'revision-create-binding-mode', draft.bindingMode, [
        { value: 'project', label: '关联商品项目' },
        { value: 'style', label: '独立任务' },
      ])}
      ${renderSelectInput('来源类型', 'revision-create-source-type', draft.sourceType, REVISION_TASK_SOURCE_TYPE_LIST.map((item) => ({ value: item, label: item })))}
      ${showProjectField ? renderSelectInput('商品项目', 'revision-create-project', draft.projectId, buildProjectOptions()) : renderSelectInput('款式档案', 'revision-create-style-id', draft.styleId, buildStyleArchiveOptions())}
      ${renderSelectInput('负责人', 'revision-create-owner', draft.ownerName, buildRevisionOwnerOptions())}
      ${renderTextInput('任务标题', 'revision-create-title', draft.title)}
      ${renderDateTimeInput('截止时间', 'revision-create-due-at', draft.dueAt)}
    </div>
    <div class="mt-4 grid gap-4 md:grid-cols-2">
      <div class="rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700">${escapeHtml(showProjectField ? (projectStyle?.styleCode ? `${projectStyle.styleCode} · ${projectStyle.styleName}` : '未绑定款式档案') : (selectedStyle?.styleCode ? `${selectedStyle.styleCode} · ${selectedStyle.styleName}` : '未选择款式档案'))}</div>
      ${draft.scopeCodes.includes('PRINT')
        ? `<label class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <input type="checkbox" ${draft.createPatternTask ? 'checked' : ''} ${canCreatePatternTask ? '' : 'disabled'} data-pcs-engineering-action="toggle-revision-create-pattern-task" />
            <span>同步创建花型任务</span>
          </label>`
        : '<div></div>'}
    </div>
    ${draft.upstreamObjectId || draft.upstreamObjectCode
      ? `<div class="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          来源对象：${escapeHtml(draft.upstreamModule || '上游任务')} · ${escapeHtml(draft.upstreamObjectCode || draft.upstreamObjectId)}
        </div>`
      : ''}
    <div class="mt-4">
      <div class="grid gap-2 sm:grid-cols-2">
        ${REVISION_SCOPE_OPTIONS.map((option) => `
          <label class="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" ${draft.scopeCodes.includes(option.value) ? 'checked' : ''} data-pcs-engineering-action="toggle-revision-scope" data-scope-code="${escapeHtml(option.value)}" />
            <span>${escapeHtml(option.label)}</span>
          </label>
        `).join('')}
      </div>
    </div>
    <div class="mt-4 grid gap-4 md:grid-cols-2">
      ${renderTextarea('问题点', 'revision-create-issue-summary', draft.issueSummary)}
      <div class="space-y-4">
        ${renderTextarea('证据说明', 'revision-create-evidence-summary', draft.evidenceSummary)}
        ${renderRevisionEvidenceUploader(draft.evidenceImageUrls)}
      </div>
    </div>
    <div class="mt-4">
      ${renderTextarea('备注', 'revision-create-note', draft.note)}
    </div>
  `
  return renderDialog(state.revisionCreateOpen, '新建改版任务', body, 'close-revision-create', 'submit-revision-create', '创建改版任务')
}

function getPlateTasksFiltered() {
  const tasks = listPlateMakingTasks()
  const keyword = state.plateList.search.trim().toLowerCase()
  return tasks.filter((task) => {
    if (keyword) {
      const haystack = [task.plateTaskCode, task.title, task.projectCode, task.projectName, task.ownerName, task.productStyleCode].join(' ').toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (state.plateList.status !== 'all' && task.status !== state.plateList.status) return false
    if (state.plateList.owner !== 'all' && task.ownerName !== state.plateList.owner) return false
    if (state.plateList.source !== 'all' && task.sourceType !== state.plateList.source) return false
    if (state.plateList.quickFilter === 'mine' && task.ownerName !== '王版师') return false
    if (state.plateList.quickFilter === 'pending-review' && task.status !== '待确认') return false
    if (state.plateList.quickFilter === 'confirmed-no-output' && !(task.status === '已确认' && !task.linkedTechPackVersionId)) return false
    if (state.plateList.quickFilter === 'blocked' && task.status !== '异常待处理') return false
    if (state.plateList.quickFilter === 'overdue' && !isOverdue(task.dueAt, task.status === '已完成' || task.status === '已取消')) return false
    return true
  })
}

function renderPlateMaterialRows(task: ReturnType<typeof getPlateMakingTaskById>): string {
  const lines = task?.materialRequirementLines || []
  if (lines.length === 0) return '<div class="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">暂无面辅料明细</div>'
  return `
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50"><tr>${['面辅料', 'SKU', '印花要求', '数量', '单价', '金额', '备注'].map((item) => `<th class="px-3 py-2 text-left font-medium text-slate-500">${item}</th>`).join('')}</tr></thead>
        <tbody class="divide-y divide-slate-200">
          ${lines.map((line) => `
            <tr>
              <td class="px-3 py-2">${escapeHtml(line.materialName || '-')}</td>
              <td class="px-3 py-2">${escapeHtml(line.materialSku || '-')}</td>
              <td class="px-3 py-2">${escapeHtml(line.printRequirement || '-')}</td>
              <td class="px-3 py-2">${escapeHtml(String(line.quantity || '-'))}</td>
              <td class="px-3 py-2">${escapeHtml(String(line.unitPrice || '-'))}</td>
              <td class="px-3 py-2">${escapeHtml(String(line.amount || '-'))}</td>
              <td class="px-3 py-2">${escapeHtml(line.note || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderPlatePatternImageRows(task: ReturnType<typeof getPlateMakingTaskById>): string {
  const lines = task?.patternImageLineItems || []
  if (lines.length === 0) return '<div class="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">暂无唛架图片</div>'
  return `
    <div class="space-y-3">
      ${lines.map((line) => `
        <div class="grid gap-3 rounded-lg border border-slate-200 px-4 py-3 md:grid-cols-[80px_1fr_1fr_80px]">
          <div>${renderSmallImage(line.imageId)}</div>
          <div><p class="text-xs text-slate-500">部位说明</p><p class="mt-1 text-sm text-slate-900">${escapeHtml(line.materialPartName || '-')}</p></div>
          <div><p class="text-xs text-slate-500">描述</p><p class="mt-1 text-sm text-slate-900">${escapeHtml(line.materialDescription || '-')}</p></div>
          <div><p class="text-xs text-slate-500">片数</p><p class="mt-1 text-sm text-slate-900">${escapeHtml(String(line.pieceCount || '-'))}</p></div>
        </div>
      `).join('')}
    </div>
  `
}

function renderFileChips(title: string, fileIds: string[]): string {
  return `
    <div class="rounded-lg border border-slate-200 p-4">
      <p class="text-xs text-slate-500">${escapeHtml(title)}</p>
      <div class="mt-2 flex flex-wrap gap-2">
        ${fileIds.length ? fileIds.map((fileId) => `<span class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">${escapeHtml(fileId)}</span>`).join('') : '<span class="text-sm text-slate-400">未上传</span>'}
      </div>
    </div>
  `
}

function renderPlateTemplateRows(task: ReturnType<typeof getPlateMakingTaskById>): string {
  const links = task?.partTemplateLinks || []
  if (links.length === 0) return '<div class="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">暂无模板关联</div>'
  return `
    <div class="space-y-3">
      ${links.map((link) => `
        <div class="rounded-lg border border-slate-200 px-4 py-3">
          <p class="text-sm font-medium text-slate-900">${escapeHtml(link.templateCode || link.templateId)} · ${escapeHtml(link.templateName || '-')}</p>
          <p class="mt-1 text-xs text-slate-500">匹配部位：${escapeHtml(link.matchedPartNames.join('、') || '-')}</p>
        </div>
      `).join('')}
    </div>
  `
}

function renderPlateListPage(): string {
  const tasks = listPlateMakingTasks()
  const filtered = getPlateTasksFiltered()
  const owners = getOwners(tasks)
  const sources = getSources(tasks)
  const paged = paginate(filtered, state.plateList.currentPage)
  const rows = paged.map((task) => `
    <tr class="hover:bg-slate-50/70">
      <td class="px-4 py-4">${renderSmallImage((task.patternImageLineItems || [])[0]?.imageId || (task.flowerImageIds || [])[0] || '')}</td>
      <td class="px-4 py-4">
        <div class="space-y-1">
          <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/patterns/plate-making/${escapeHtml(task.plateTaskId)}">${escapeHtml(task.plateTaskCode)}</button>
          <p class="text-xs text-slate-500">${escapeHtml(task.title)}</p>
        </div>
      </td>
      <td class="px-4 py-4">${projectButton(task.projectId, task.projectCode, task.projectName)}</td>
      <td class="px-4 py-4">${escapeHtml(task.productStyleCode || '-')}</td>
      <td class="px-4 py-4">${escapeHtml(task.patternMakerName || task.ownerName || '-')}</td>
      <td class="px-4 py-4">${escapeHtml(task.patternArea || '-')}</td>
      <td class="px-4 py-4">${task.urgentFlag ? '<span class="rounded-full bg-rose-50 px-2 py-1 text-xs text-rose-600">紧急</span>' : '<span class="text-slate-400">普通</span>'}</td>
      <td class="px-4 py-4">${escapeHtml(task.patternVersion || '-')}</td>
      <td class="px-4 py-4">${task.linkedTechPackVersionId ? `${techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, task.linkedTechPackVersionCode || task.linkedTechPackVersionLabel || '查看技术包')}` : '<span class="text-slate-400">未生成</span>'}</td>
      <td class="px-4 py-4">${renderStatusBadge(task.status)}</td>
      <td class="px-4 py-4">
        <div class="flex flex-wrap gap-2">
          <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/patterns/plate-making/${escapeHtml(task.plateTaskId)}">查看</button>
          <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="plate-generate-tech-pack" data-task-id="${escapeHtml(task.plateTaskId)}">生成技术包版本</button>
        </div>
      </td>
    </tr>
  `).join('')

  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${renderPageHeader('制版任务', '新建制版任务', 'open-plate-create')}
      ${renderListFilters({
        searchPlaceholder: '搜索任务编号 / 商品项目 / 款式 / 负责人',
        listState: state.plateList,
        searchField: 'plate-search',
        statusField: 'plate-status',
        ownerField: 'plate-owner',
        sourceField: 'plate-source',
        statusOptions: ['未开始', '进行中', '待确认', '已确认', '已生成技术包', '已完成', '异常待处理', '已取消'],
        ownerOptions: owners,
        sourceOptions: sources,
      })}
      <section class="grid gap-4 md:grid-cols-5">
        ${renderMetricButton('全部任务', tasks.length, state.plateList.quickFilter === 'all', 'all', 'set-plate-quick-filter')}
        ${renderMetricButton('我的任务', tasks.filter((item) => item.ownerName === '王版师').length, state.plateList.quickFilter === 'mine', 'mine', 'set-plate-quick-filter')}
        ${renderMetricButton('待确认', tasks.filter((item) => item.status === '待确认').length, state.plateList.quickFilter === 'pending-review', 'pending-review', 'set-plate-quick-filter')}
        ${renderMetricButton('已确认待写包', tasks.filter((item) => item.status === '已确认' && !item.linkedTechPackVersionId).length, state.plateList.quickFilter === 'confirmed-no-output', 'confirmed-no-output', 'set-plate-quick-filter')}
        ${renderMetricButton('超期任务', tasks.filter((item) => isOverdue(item.dueAt, item.status === '已完成' || item.status === '已取消')).length, state.plateList.quickFilter === 'overdue', 'overdue', 'set-plate-quick-filter')}
      </section>
      ${renderDataTable(['商品图', '任务编号', '所属项目', '款式编码', '版师', '打版区域', '是否紧急', '纸样版次', '技术包状态', '当前状态', '操作'], rows, '暂无制版任务数据', renderPagination(state.plateList.currentPage, filtered.length, 'change-plate-page'))}
      ${renderPlateCreateDialog()}
    </div>
  `
}

function renderPlateCreateDialog(): string {
  const draft = state.plateCreateDraft
  const showProjectField = draft.bindingMode === 'project'
  const selectedStyle = getStyleArchiveById(draft.styleId)
  const selectedProjectDefaults = draft.projectId ? getProjectDefaultValues(draft.projectId) : { ownerName: '', styleId: '', styleCode: '', styleName: '' }
  const projectStyle = selectedProjectDefaults.styleId ? getStyleArchiveById(selectedProjectDefaults.styleId) : null
  const body = `
    <div class="grid gap-4 md:grid-cols-2">
      ${renderSelectInput('创建方式', 'plate-create-binding-mode', draft.bindingMode, [
        { value: 'project', label: '关联商品项目' },
        { value: 'style', label: '独立任务' },
      ])}
      ${renderSelectInput('来源类型', 'plate-create-source-type', draft.sourceType, PLATE_TASK_SOURCE_TYPE_LIST.map((item) => ({ value: item, label: item })))}
      ${showProjectField ? renderSelectInput('商品项目', 'plate-create-project', draft.projectId, buildProjectOptions()) : renderSelectInput('款式档案', 'plate-create-style-id', draft.styleId, buildStyleArchiveOptions())}
      ${renderTextInput('负责人', 'plate-create-owner', draft.ownerName, '')}
      ${renderTextInput('版师', 'plate-create-pattern-maker', draft.patternMakerName, '')}
      ${renderTextInput('任务标题', 'plate-create-title', draft.title, '')}
      ${renderDateTimeInput('截止时间', 'plate-create-due-at', draft.dueAt)}
      ${renderSelectInput('产品历史属性', 'plate-create-product-history-type', draft.productHistoryType, ['未卖过', '已卖过补纸样'].map((item) => ({ value: item, label: item })))}
      ${renderSelectInput('打版区域', 'plate-create-pattern-area', draft.patternArea, ['印尼', '深圳'].map((item) => ({ value: item, label: item })))}
      ${renderTextInput('版型类型', 'plate-create-pattern-type', draft.patternType, '')}
      ${renderTextInput('尺码范围', 'plate-create-size-range', draft.sizeRange, '')}
    </div>
    <div class="mt-4 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700">
      ${escapeHtml(showProjectField ? (projectStyle?.styleCode ? `${projectStyle.styleCode} · ${projectStyle.styleName}` : '未绑定款式档案') : (selectedStyle?.styleCode ? `${selectedStyle.styleCode} · ${selectedStyle.styleName}` : '未选择款式档案'))}
    </div>
    <label class="mt-4 inline-flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" ${draft.urgentFlag ? 'checked' : ''} data-pcs-engineering-action="toggle-plate-create-urgent" />
      <span>是否紧急</span>
    </label>
    <div class="mt-4">
      ${renderTextarea('备注', 'plate-create-note', draft.note, '')}
    </div>
  `
  return renderDialog(state.plateCreateOpen, '新建制版任务', body, 'close-plate-create', 'submit-plate-create', '创建制版任务')
}

function renderPlateDetailPage(plateTaskId: string): string {
  syncExistingProjectEngineeringTaskNodes('系统同步')
  const task = getPlateMakingTaskById(plateTaskId)
  if (!task) return renderEmptyDetail('制版任务', '/pcs/patterns')
  const detailDraft = ensurePlateDetailDraft(task)
  const style = getTaskStyleInfo(task)
  const downstreamFirst = listFirstSampleTasks().filter((item) => item.upstreamObjectId === task.plateTaskId || item.upstreamObjectCode === task.plateTaskCode)
  const downstreamPre = listFirstOrderSampleTasks().filter((item) => item.upstreamObjectId === task.plateTaskId || item.upstreamObjectCode === task.plateTaskCode)
  const logs = mergeLogs('plate', task.plateTaskId, [
    ...(task.linkedTechPackVersionId ? [{ time: task.linkedTechPackUpdatedAt || task.updatedAt, action: '技术包写回', user: task.updatedBy, detail: `已写入技术包 ${task.linkedTechPackVersionCode || task.linkedTechPackVersionLabel || task.linkedTechPackVersionId}。` }] : []),
    ...baseLogs(task),
  ])

  const header = renderHeaderMeta(
    `${task.plateTaskCode} · ${task.title}`,
    `${task.projectCode} · ${task.projectName} · ${formatDateTime(task.updatedAt)}`,
    `${renderStatusBadge(task.status)}<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">${escapeHtml(task.patternVersion || '待定版次')}</span>`,
    [
      `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/patterns">返回列表</button>`,
      ...(task.status !== '已完成' && task.status !== '已取消'
        ? [`<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="complete-plate-task" data-task-id="${escapeHtml(task.plateTaskId)}">完成任务</button>`]
        : []),
      `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="plate-generate-tech-pack" data-task-id="${escapeHtml(task.plateTaskId)}">生成技术包版本</button>`,
    ].join(''),
  )

  const downstream = renderSectionCard(
    '下游打样',
    downstreamFirst.length + downstreamPre.length > 0
      ? `
          <div class="space-y-3">
            ${[
              ...downstreamFirst.map((item) => ({ label: '首版样衣打样', code: item.firstSampleTaskCode, title: item.title, status: item.status, path: `/pcs/samples/first-sample/${item.firstSampleTaskId}` })),
              ...downstreamPre.map((item) => ({ label: '首单样衣打样', code: item.firstOrderSampleTaskCode, title: item.title, status: item.status, path: `/pcs/samples/first-order/${item.firstOrderSampleTaskId}` })),
            ].map((item) => `
              <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3">
                <div>
                  <p class="text-sm font-medium text-slate-900">${escapeHtml(item.label)} · ${escapeHtml(item.code)}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(item.title)}</p>
                </div>
                <div class="flex items-center gap-3">
                  ${renderStatusBadge(item.status, true)}
                  <button type="button" class="text-sm font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(item.path)}">打开详情</button>
                </div>
              </div>
            `).join('')}
          </div>
        `
      : '<div class="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">暂无下游样衣任务</div>',
  )

  const mainContent = [
    renderSectionCard('任务基本信息', renderKeyValueGrid([
      { label: '任务编号', value: escapeHtml(task.plateTaskCode) },
      { label: '所属项目', value: projectButton(task.projectId, task.projectCode, task.projectName) },
      { label: '所属款式', value: styleArchiveLink(style.styleId, style.styleCode, style.styleName, task.projectId) },
      { label: '来源对象', value: escapeHtml(task.upstreamObjectCode || task.upstreamObjectId || '-') },
      { label: '当前状态', value: renderStatusBadge(task.status) },
    ], 3)),
    renderSectionCard('制版执行', `
      ${renderKeyValueGrid([
        { label: '产品历史属性', value: escapeHtml(task.productHistoryType || '-') },
        { label: '版师', value: escapeHtml(task.patternMakerName || task.ownerName || '-') },
        { label: '打版区域', value: escapeHtml(task.patternArea || '-') },
        { label: '是否紧急', value: escapeHtml(task.urgentFlag ? '是' : '否') },
        { label: '样板确认时间', value: escapeHtml(formatDateTime(task.sampleConfirmedAt || '')) },
        { label: '版型类型', value: escapeHtml(task.patternType || '-') },
        { label: '尺码范围', value: escapeHtml(task.sizeRange || '-') },
        { label: '制版版次', value: escapeHtml(task.patternVersion || '-') },
      ], 4)}
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        ${renderTextInput('参与人', 'plate-detail-participants', detailDraft.participantNamesText, '')}
        ${renderTextInput('制版版次', 'plate-detail-version', detailDraft.patternVersion, '')}
        ${renderSelectInput('产品历史属性', 'plate-detail-product-history-type', detailDraft.productHistoryType, [{ value: '', label: '请选择' }, ...['未卖过', '已卖过补纸样'].map((item) => ({ value: item, label: item }))])}
        ${renderTextInput('版师', 'plate-detail-pattern-maker', detailDraft.patternMakerName, '')}
        ${renderSelectInput('打版区域', 'plate-detail-pattern-area', detailDraft.patternArea, [{ value: '', label: '请选择' }, ...['印尼', '深圳'].map((item) => ({ value: item, label: item }))])}
        ${renderDateTimeInput('样板确认时间', 'plate-detail-sample-confirmed-at', detailDraft.sampleConfirmedAt)}
      </div>
      <label class="mt-4 inline-flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" ${detailDraft.urgentFlag ? 'checked' : ''} data-pcs-engineering-action="toggle-plate-detail-urgent" />
        <span>是否紧急</span>
      </label>
    `),
    renderSectionCard('面辅料与花色', `
      ${renderPlateMaterialRows(task)}
      <div class="mt-4">${renderKeyValueGrid([
        { label: '花色需求', value: escapeHtml(task.colorRequirementText || '-') },
        { label: '新花型 SPU', value: escapeHtml(task.newPatternSpuCode || '-') },
        { label: '花型图片', value: task.flowerImageIds.length ? `${task.flowerImageIds.length} 张` : '未上传' },
      ], 3)}</div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        ${renderTextarea('花色需求', 'plate-detail-color-requirement', detailDraft.colorRequirementText, '')}
        ${renderTextInput('新花型 SPU', 'plate-detail-new-pattern-spu', detailDraft.newPatternSpuCode, '')}
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        ${renderImageUploader('花型图片', 'plate-detail-flower-images', detailDraft.flowerImageIds, '未上传')}
        ${renderPlateMaterialLineEditor(detailDraft.materialRequirementLines)}
      </div>
    `),
    renderSectionCard('唛架图片', `
      ${renderPlatePatternImageRows(task)}
      <div class="mt-4">
        ${renderPlatePatternImageLineEditor(detailDraft.patternImageLineItems)}
      </div>
    `),
    renderSectionCard('纸样文件', `
      <div class="grid gap-4 md:grid-cols-3">
        ${renderFileChips('PDF', task.patternPdfFileIds || [])}
        ${renderFileChips('DXF', task.patternDxfFileIds || [])}
        ${renderFileChips('RUL', task.patternRulFileIds || [])}
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        ${renderFileChips('补充图片', task.supportImageIds || [])}
        ${renderFileChips('补充视频', task.supportVideoIds || [])}
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        ${renderFileUploader('PDF 文件', 'plate-detail-pdf-files', detailDraft.patternPdfFileIds, '未上传', '.pdf,application/pdf')}
        ${renderFileUploader('DXF 文件', 'plate-detail-dxf-files', detailDraft.patternDxfFileIds, '未上传', '.dxf')}
        ${renderFileUploader('RUL 文件', 'plate-detail-rul-files', detailDraft.patternRulFileIds, '未上传', '.rul')}
        ${renderImageUploader('补充图片', 'plate-detail-support-images', detailDraft.supportImageIds, '未上传')}
        ${renderFileUploader('补充视频', 'plate-detail-support-videos', detailDraft.supportVideoIds, '未上传', 'video/*')}
      </div>
    `),
    renderSectionCard('模板关联', `
      ${renderPlateTemplateRows(task)}
      <div class="mt-4">
        ${renderTextarea('部位模板关联', 'plate-detail-template-links', detailDraft.partTemplateLinksText, '')}
      </div>
      ${renderTaskSaveBar('save-plate-detail-fields', task.plateTaskId)}
    `),
    renderSectionCard('技术包', renderKeyValueGrid([
      { label: '当前关联技术包版本', value: task.linkedTechPackVersionId ? `${techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, task.linkedTechPackVersionCode || task.linkedTechPackVersionLabel || '查看关联技术包')}<span class="mx-2 text-slate-300">/</span>${techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, '查看版本日志')}` : '<span class="text-slate-400">尚未生成</span>' },
      { label: '是否主挂载生成', value: escapeHtml(task.primaryTechPackGeneratedFlag ? '是' : '否') },
      { label: '主挂载生成时间', value: escapeHtml(formatDateTime(task.primaryTechPackGeneratedAt || '')) },
    ], 3)),
    downstream,
    renderSectionCard('操作记录', renderLogs(logs)),
  ].join('')

  const aside = `
    <div class="space-y-4">
      ${renderSectionCard('任务摘要', renderKeyValueGrid([
        { label: '负责人', value: escapeHtml(task.ownerName) },
        { label: '截止时间', value: escapeHtml(formatDateTime(task.dueAt)) },
        { label: '款式档案', value: styleArchiveLink(style.styleId, style.styleCode, style.styleName, task.projectId) },
        { label: '技术包状态', value: escapeHtml(task.linkedTechPackVersionStatus || '未写回') },
      ], 2))}
      ${renderSectionCard('正式对象核对', renderKeyValueGrid([
        { label: '商品项目', value: projectButton(task.projectId, task.projectCode, task.projectName) },
        { label: '工作项节点', value: projectNodeButton(task.projectId, task.projectNodeId, task.workItemTypeName) },
        { label: '上游对象', value: escapeHtml(task.upstreamObjectCode || task.upstreamObjectId || '-') },
        { label: '制版状态', value: renderStatusBadge(task.status) },
      ], 2))}
    </div>
  `

  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${header}
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div class="space-y-6">${mainContent}</div>
        ${aside}
      </div>
    </div>
  `
}

function getPatternTasksFiltered() {
  const tasks = listPatternTasks()
  const keyword = state.patternList.search.trim().toLowerCase()
  return tasks.filter((task) => {
    if (keyword) {
      const haystack = [task.patternTaskCode, task.title, task.projectCode, task.projectName, task.ownerName, task.artworkName, task.productStyleCode, task.demandSourceType, task.processType, task.assignedTeamName, task.assignedMemberName].join(' ').toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (state.patternList.status !== 'all' && task.status !== state.patternList.status) return false
    if (state.patternList.owner !== 'all' && task.ownerName !== state.patternList.owner) return false
    if (state.patternList.source !== 'all' && task.sourceType !== state.patternList.source) return false
    if (state.patternList.quickFilter === 'mine' && task.ownerName !== '林小美') return false
    if (state.patternList.quickFilter === 'pending-review' && task.buyerReviewStatus !== '待买手确认') return false
    if (state.patternList.quickFilter === 'confirmed-no-output' && !(task.status === '已确认' && !task.linkedTechPackVersionId)) return false
    if (state.patternList.quickFilter === 'blocked' && task.status !== '异常待处理') return false
    if (state.patternList.quickFilter === 'overdue' && !isOverdue(task.dueAt, task.status === '已完成' || task.status === '已取消')) return false
    return true
  })
}

function renderPatternListPage(): string {
  const tasks = listPatternTasks()
  const filtered = getPatternTasksFiltered()
  const owners = getOwners(tasks)
  const sources = getSources(tasks)
  const paged = paginate(filtered, state.patternList.currentPage)
  const rows = paged.map((task) => {
    const asset = listPatternAssets().find((item) => item.source_task_id === task.patternTaskId)
    const techPackAction = getPatternTechPackActionMeta(task.patternTaskId)
    return `
      <tr class="hover:bg-slate-50/70">
        <td class="px-4 py-4">
          <div class="space-y-1">
            <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/patterns/colors/${escapeHtml(task.patternTaskId)}">${escapeHtml(task.patternTaskCode)}</button>
            <p class="text-xs text-slate-500">${escapeHtml(task.title)}</p>
          </div>
        </td>
        <td class="px-4 py-4">${renderSmallImage(task.demandImageIds[0] || '')}</td>
        <td class="px-4 py-4">${escapeHtml(task.demandSourceType)}</td>
        <td class="px-4 py-4">${escapeHtml(task.processType)}</td>
        <td class="px-4 py-4">${escapeHtml(task.fabricSku || task.fabricName || '-')}</td>
        <td class="px-4 py-4">${escapeHtml(task.requestQty || '-')}</td>
        <td class="px-4 py-4">${escapeHtml(task.difficultyGrade || '-')}</td>
        <td class="px-4 py-4">${escapeHtml(task.assignedTeamName || '-')}</td>
        <td class="px-4 py-4">${escapeHtml(task.assignedMemberName || '-')}</td>
        <td class="px-4 py-4">${renderStatusBadge(task.buyerReviewStatus)}</td>
        <td class="px-4 py-4">${asset ? `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/pattern-library/${escapeHtml(asset.id)}">${escapeHtml(asset.pattern_code)}</button>` : '<span class="text-slate-400">未沉淀</span>'}</td>
        <td class="px-4 py-4">${task.linkedTechPackVersionId ? techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, task.linkedTechPackVersionCode || task.linkedTechPackVersionLabel || '查看技术包') : '<span class="text-slate-400">未写入</span>'}</td>
        <td class="px-4 py-4">
          <div class="flex flex-wrap gap-2">
            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/patterns/colors/${escapeHtml(task.patternTaskId)}">查看</button>
            <button
              type="button"
              class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white"
              data-pcs-engineering-action="pattern-generate-tech-pack"
              data-task-id="${escapeHtml(task.patternTaskId)}"
              ${techPackAction.disabled ? `disabled title="${escapeHtml(techPackAction.disabledReason)}"` : ''}
            >${escapeHtml(techPackAction.label)}</button>
            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="pattern-publish-library" data-task-id="${escapeHtml(task.patternTaskId)}">${escapeHtml(asset ? '打开花型库' : '沉淀花型库')}</button>
          </div>
        </td>
      </tr>
    `
  }).join('')

  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${renderPageHeader('花型任务', '新建花型任务', 'open-pattern-create')}
      ${renderListFilters({
        searchPlaceholder: '搜索任务编号 / 花型名称 / 商品项目 / 团队 / 花型师',
        listState: state.patternList,
        searchField: 'pattern-search',
        statusField: 'pattern-status',
        ownerField: 'pattern-owner',
        sourceField: 'pattern-source',
        statusOptions: ['未开始', '进行中', '待确认', '已确认', '已生成技术包', '已完成', '异常待处理', '已取消'],
        ownerOptions: owners,
        sourceOptions: sources,
      })}
      <section class="grid gap-4 md:grid-cols-5">
        ${renderMetricButton('全部任务', tasks.length, state.patternList.quickFilter === 'all', 'all', 'set-pattern-quick-filter')}
        ${renderMetricButton('我的任务', tasks.filter((item) => item.ownerName === '林小美').length, state.patternList.quickFilter === 'mine', 'mine', 'set-pattern-quick-filter')}
        ${renderMetricButton('待买手确认', tasks.filter((item) => item.buyerReviewStatus === '待买手确认').length, state.patternList.quickFilter === 'pending-review', 'pending-review', 'set-pattern-quick-filter')}
        ${renderMetricButton('已确认待沉淀', tasks.filter((item) => item.status === '已确认' && !listPatternAssets().find((asset) => asset.source_task_id === item.patternTaskId)).length, state.patternList.quickFilter === 'confirmed-no-output', 'confirmed-no-output', 'set-pattern-quick-filter')}
        ${renderMetricButton('超期任务', tasks.filter((item) => isOverdue(item.dueAt, item.status === '已完成' || item.status === '已取消')).length, state.patternList.quickFilter === 'overdue', 'overdue', 'set-pattern-quick-filter')}
      </section>
      ${renderDataTable(['花型任务', '需求图', '来源', '工艺', '面料', '数量', '难易程度', '团队', '花型师', '买手确认状态', '花型库状态', '技术包状态', '操作'], rows, '暂无花型任务数据', renderPagination(state.patternList.currentPage, filtered.length, 'change-pattern-page'))}
      ${renderPatternCreateDialog()}
    </div>
  `
}

function renderPatternCreateDialog(): string {
  const draft = state.patternCreateDraft
  const teamOptions = PATTERN_TASK_TEAMS.map((team) => ({ value: team.teamCode, label: team.teamName }))
  const showProjectField = draft.bindingMode === 'project'
  const selectedStyle = getStyleArchiveById(draft.styleId)
  const selectedProjectDefaults = draft.projectId ? getProjectDefaultValues(draft.projectId) : { ownerName: '', styleId: '', styleCode: '', styleName: '' }
  const projectStyle = selectedProjectDefaults.styleId ? getStyleArchiveById(selectedProjectDefaults.styleId) : null
  const body = `
    <div class="grid gap-4 md:grid-cols-2">
      ${renderSelectInput('创建方式', 'pattern-create-binding-mode', draft.bindingMode, [
        { value: 'project', label: '关联商品项目' },
        { value: 'style', label: '独立任务' },
      ])}
      ${renderSelectInput('来源类型', 'pattern-create-source-type', draft.sourceType, PATTERN_TASK_SOURCE_TYPE_LIST.map((item) => ({ value: item, label: item })))}
      ${showProjectField ? renderSelectInput('商品项目', 'pattern-create-project', draft.projectId, buildProjectOptions()) : renderSelectInput('款式档案', 'pattern-create-style-id', draft.styleId, buildStyleArchiveOptions())}
      ${renderTextInput('负责人', 'pattern-create-owner', draft.ownerName, '')}
      ${renderTextInput('任务标题', 'pattern-create-title', draft.title, '')}
      ${renderDateTimeInput('截止时间', 'pattern-create-due-at', draft.dueAt)}
      ${renderSelectInput('需求来源', 'pattern-create-demand-source', draft.demandSourceType, buildSelectOptions(PATTERN_DEMAND_SOURCE_OPTIONS))}
      ${renderSelectInput('工艺类型', 'pattern-create-process-type', draft.processType, buildSelectOptions(PATTERN_PROCESS_OPTIONS))}
      ${renderTextInput('需求数量', 'pattern-create-request-qty', draft.requestQty, '')}
      ${renderTextInput('面料 SKU', 'pattern-create-fabric-sku', draft.fabricSku, '')}
      ${renderTextInput('面料名称', 'pattern-create-fabric-name', draft.fabricName, '')}
      ${renderSelectInput('团队', 'pattern-create-team', draft.assignedTeamCode, teamOptions)}
      ${renderSelectInput('花型师', 'pattern-create-member', draft.assignedMemberId, getPatternMemberOptions(draft.assignedTeamCode))}
      ${renderTextInput('花型名称', 'pattern-create-artwork-name', draft.artworkName, '')}
      ${renderTextInput('花型库分类', 'pattern-create-category', draft.patternCategoryCode, '')}
      ${renderTextInput('风格标签', 'pattern-create-style-tags', draft.patternStyleTagsText, '')}
    </div>
    <div class="mt-4 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700">
      ${escapeHtml(showProjectField ? (projectStyle?.styleCode ? `${projectStyle.styleCode} · ${projectStyle.styleName}` : '未绑定款式档案') : (selectedStyle?.styleCode ? `${selectedStyle.styleCode} · ${selectedStyle.styleName}` : '未选择款式档案'))}
    </div>
    <div class="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
      ${renderImageUploader('需求图片', 'pattern-create-demand-images', draft.demandImageIds, '暂未上传需求图片')}
      <label class="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700">
        <input type="checkbox" ${draft.hotSellerFlag ? 'checked' : ''} data-pcs-engineering-field="pattern-create-hot-flag" />
        <span>标记为爆款花型</span>
      </label>
    </div>
    <div class="mt-4">
      ${renderTextarea('备注', 'pattern-create-note', draft.note, '')}
    </div>
  `
  return renderDialog(state.patternCreateOpen, '新建花型任务', body, 'close-pattern-create', 'submit-pattern-create', '创建花型任务')
}

function renderPatternDetailPage(patternTaskId: string): string {
  syncExistingProjectEngineeringTaskNodes('系统同步')
  const task = getPatternTaskById(patternTaskId)
  if (!task) return renderEmptyDetail('花型任务', '/pcs/patterns/colors')
  const techPackAction = getPatternTechPackActionMeta(task.patternTaskId)
  const detailDraft = ensurePatternDetailDraft(task)
  const asset = listPatternAssets().find((item) => item.source_task_id === task.patternTaskId)
  const sampleTasks = listFirstSampleTasks().filter((item) => item.upstreamObjectId === task.patternTaskId || item.upstreamObjectCode === task.patternTaskCode)
  const style = getTaskStyleInfo(task)
  const logs = mergeLogs('pattern', task.patternTaskId, [
    ...(task.linkedTechPackVersionId ? [{ time: task.linkedTechPackUpdatedAt || task.updatedAt, action: '技术包写回', user: task.updatedBy, detail: `已写入技术包 ${task.linkedTechPackVersionCode || task.linkedTechPackVersionLabel || task.linkedTechPackVersionId}。` }] : []),
    ...(asset ? [{ time: asset.updated_at, action: '花型库沉淀', user: asset.updated_by, detail: `已形成花型资产 ${asset.pattern_code}。` }] : []),
    ...baseLogs(task),
  ])
  const header = renderHeaderMeta(
    `${task.patternTaskCode} · ${task.title}`,
    `${task.projectCode} · ${task.projectName} · ${formatDateTime(task.updatedAt)}`,
    `${renderStatusBadge(task.status)}<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">${escapeHtml(task.artworkVersion || '待确认版本')}</span>`,
    [
      `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/patterns/colors">返回列表</button>`,
      ...(task.status !== '已完成' && task.status !== '已取消'
        ? [`<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="complete-pattern-task" data-task-id="${escapeHtml(task.patternTaskId)}">完成任务</button>`]
        : []),
      `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white" data-pcs-engineering-action="pattern-generate-tech-pack" data-task-id="${escapeHtml(task.patternTaskId)}" ${techPackAction.disabled ? `disabled title="${escapeHtml(techPackAction.disabledReason)}"` : ''}>${escapeHtml(techPackAction.label)}</button>`,
      `<button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-engineering-action="pattern-publish-library" data-task-id="${escapeHtml(task.patternTaskId)}">${escapeHtml(asset ? '打开花型库' : '沉淀花型库')}</button>`,
    ].join(''),
  )
  const demandSection = `${renderProjectContext(task)}${renderSectionCard('需求来源', renderKeyValueGrid([
    { label: '来源', value: escapeHtml(task.demandSourceType) },
    { label: '来源编号', value: escapeHtml(task.demandSourceRefCode || task.upstreamObjectCode || '-') },
    { label: '来源名称', value: escapeHtml(task.demandSourceRefName || task.upstreamObjectType || '-') },
    { label: '款式编码', value: escapeHtml(task.productStyleCode || '-') },
  ], 2))}`

  const processSection = renderSectionCard('工艺与面料', renderKeyValueGrid([
    { label: '工艺类型', value: escapeHtml(task.processType) },
    { label: '需求数量', value: escapeHtml(task.requestQty || '-') },
    { label: '面料 SKU', value: escapeHtml(task.fabricSku || '-') },
    { label: '面料名称', value: escapeHtml(task.fabricName || '-') },
    { label: '花型名称', value: escapeHtml(task.artworkName || task.title) },
    { label: '花型版次', value: escapeHtml(task.artworkVersion || '-') },
  ], 3))

  const demandImagesSection = renderSectionCard('需求图片', renderImageList(task.demandImageIds, '暂未上传需求图片'))

  const assignmentSection = renderSectionCard(
    '团队与成员分配',
    `
      ${renderKeyValueGrid([
        { label: '团队', value: escapeHtml(task.assignedTeamName || '-') },
        { label: '花型师', value: escapeHtml(task.assignedMemberName || '-') },
        { label: '分配时间', value: escapeHtml(formatDateTime(task.assignedAt)) },
        { label: '转派团队', value: escapeHtml(task.transferToTeamName || '-') },
        { label: '转派原因', value: escapeHtml(task.transferReason || '-') },
        { label: '原团队', value: escapeHtml(task.transferFromTeamName || '-') },
      ], 3)}
      <div class="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
        ${renderTextarea('转派原因', 'pattern-detail-transfer-reason', detailDraft.transferReason, '')}
        <div class="flex items-end">
          <button type="button" class="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="pattern-transfer-to-cn" data-task-id="${escapeHtml(task.patternTaskId)}">转中国团队</button>
        </div>
      </div>
    `,
  )

  const colorReviewSection = renderSectionCard(
    '难易程度与颜色确认',
    `
      <div class="grid gap-4 md:grid-cols-2">
        ${renderSelectInput('难易程度', 'pattern-detail-difficulty', detailDraft.difficultyGrade, buildSelectOptions(PATTERN_DIFFICULTY_OPTIONS))}
        ${renderSelectInput('颜色深浅', 'pattern-detail-color-depth', detailDraft.colorDepthOption, buildSelectOptions(PATTERN_COLOR_DEPTH_OPTIONS))}
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        ${renderImageUploader('直播参考图', 'pattern-detail-live-reference-images', detailDraft.liveReferenceImageIds, '暂未上传直播参考图')}
        ${renderImageUploader('图片参考图', 'pattern-detail-image-reference-images', detailDraft.imageReferenceIds, '暂未上传图片参考图')}
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        ${renderTextarea('实物图说明', 'pattern-detail-physical-note', detailDraft.physicalReferenceNote, '')}
        ${renderTextarea('颜色确认说明', 'pattern-detail-color-note', detailDraft.colorConfirmNote, '')}
      </div>
    `,
  )

  const buyerReviewSection = renderSectionCard(
    '买手确认',
    `
      ${renderKeyValueGrid([
        { label: '确认状态', value: renderStatusBadge(task.buyerReviewStatus) },
        { label: '确认人', value: escapeHtml(task.buyerReviewerName || '-') },
        { label: '确认时间', value: escapeHtml(formatDateTime(task.buyerReviewAt)) },
        { label: '审核说明', value: escapeHtml(task.buyerReviewNote || '-') },
      ], 2)}
      <div class="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
        ${renderTextarea('买手审核说明', 'pattern-detail-buyer-note', detailDraft.buyerReviewNote, '')}
        <div class="flex items-end">
          <button type="button" class="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700" data-pcs-engineering-action="pattern-buyer-approve" data-task-id="${escapeHtml(task.patternTaskId)}">买手通过</button>
        </div>
        <div class="flex items-end">
          <button type="button" class="inline-flex h-10 w-full items-center justify-center rounded-md border border-rose-200 bg-white px-4 text-sm font-medium text-rose-700 hover:bg-rose-50" data-pcs-engineering-action="pattern-buyer-reject" data-task-id="${escapeHtml(task.patternTaskId)}">买手驳回</button>
        </div>
      </div>
    `,
  )

  const completionReviewSection = renderSectionCard(
    '完成确认',
    `
      <div class="grid gap-4 md:grid-cols-2">
        ${renderTextInput('花型版次', 'pattern-detail-version', detailDraft.artworkVersion, '')}
        ${renderImageUploader('完成确认图片', 'pattern-detail-completion-images', detailDraft.completionImageIds, '暂未上传完成确认图片')}
      </div>
      ${renderTaskSaveBar('save-pattern-detail-fields', task.patternTaskId)}
    `,
  )

  const librarySection = renderSectionCard(
    '花型库沉淀',
    `
      ${asset
        ? renderKeyValueGrid([
            { label: '花型资产', value: `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/pattern-library/${escapeHtml(asset.id)}">${escapeHtml(asset.pattern_code)}</button>` },
            { label: '维护状态', value: escapeHtml(asset.maintenance_status) },
            { label: '分类', value: escapeHtml(asset.category_primary || task.patternCategoryCode || '-') },
            { label: '风格标签', value: escapeHtml(asset.style_tags.join('、') || task.patternStyleTags.join('、') || '-') },
          ], 2)
        : '<div class="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">未沉淀花型库</div>'}
      <div class="mt-4 grid gap-4 md:grid-cols-3">
        ${renderTextInput('花型库分类', 'pattern-detail-category', detailDraft.patternCategoryCode)}
        ${renderTextInput('风格标签', 'pattern-detail-style-tags', detailDraft.patternStyleTagsText)}
        <label class="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700">
          <input type="checkbox" ${detailDraft.hotSellerFlag ? 'checked' : ''} data-pcs-engineering-field="pattern-detail-hot-flag" />
          <span>爆款花型</span>
        </label>
      </div>
    `,
  )

  const techPackSection = renderSectionCard('技术包写入', renderKeyValueGrid([
    { label: '关联技术包', value: task.linkedTechPackVersionId ? techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, task.linkedTechPackVersionCode || task.linkedTechPackVersionLabel || '查看技术包') : '未写入' },
    { label: '技术包状态', value: escapeHtml(task.linkedTechPackVersionStatus || '未写入') },
    { label: '写入动作', value: escapeHtml(techPackAction.label) },
    { label: '限制原因', value: escapeHtml(techPackAction.disabledReason || '-') },
  ], 2))

  const mainContent = [
    demandSection,
    processSection,
    demandImagesSection,
    assignmentSection,
    colorReviewSection,
    buyerReviewSection,
    completionReviewSection,
    librarySection,
    techPackSection,
    renderSectionCard('操作记录', renderLogs(logs)),
  ].join('')

  const aside = `
    <div class="space-y-4">
      ${renderSectionCard('任务摘要', renderKeyValueGrid([
        { label: '负责人', value: escapeHtml(task.ownerName) },
        { label: '截止时间', value: escapeHtml(formatDateTime(task.dueAt)) },
        { label: '款式档案', value: styleArchiveLink(style.styleId, style.styleCode, style.styleName, task.projectId) },
        { label: '花型库状态', value: asset ? '已沉淀' : '待沉淀' },
      ], 2))}
      ${renderSectionCard('正式对象核对', renderKeyValueGrid([
        { label: '商品项目', value: projectButton(task.projectId, task.projectCode, task.projectName) },
        { label: '工作项节点', value: projectNodeButton(task.projectId, task.projectNodeId, task.workItemTypeName) },
        { label: '技术包状态', value: escapeHtml(task.linkedTechPackVersionStatus || '未写回') },
        { label: '正式状态', value: renderStatusBadge(task.status) },
      ], 2))}
    </div>
  `

  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${header}
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div class="space-y-6">${mainContent}</div>
        ${aside}
      </div>
    </div>
  `
}

function buildSampleMilestones(task: { status: string; createdAt: string; updatedAt: string; confirmedAt?: string }): Array<{ label: string; done: boolean; time: string }> {
  const inProgress = ['打样中', '待确认', '已通过', '需改版', '需补首单'].includes(task.status)
  const waitingConfirm = ['待确认', '已通过', '需改版', '需补首单'].includes(task.status)
  const finished = ['已通过', '需改版', '需补首单'].includes(task.status)
  return [
    { label: '创建', done: true, time: task.createdAt },
    { label: '开始打样', done: inProgress, time: inProgress ? task.updatedAt : '' },
    { label: '提交结果', done: waitingConfirm, time: waitingConfirm ? task.updatedAt : '' },
    { label: '确认结论', done: finished, time: finished ? task.confirmedAt || task.updatedAt : '' },
  ]
}

function renderTimeline(milestones: Array<{ label: string; done: boolean; time: string }>): string {
  return `
    <div class="grid gap-4 md:grid-cols-4">
      ${milestones.map((item) => `
        <div class="rounded-lg border ${item.done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'} px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="${item.done ? 'text-emerald-700' : 'text-slate-400'}">${item.done ? '●' : '○'}</span>
            <span class="text-sm font-medium ${item.done ? 'text-emerald-800' : 'text-slate-600'}">${escapeHtml(item.label)}</span>
          </div>
          <p class="mt-2 text-xs text-slate-500">${escapeHtml(item.time ? formatDateTime(item.time) : '待推进')}</p>
        </div>
      `).join('')}
    </div>
  `
}

function renderSamplePlanLines(lines: Array<{ sampleRole: string; materialMode: string; quantity: number; targetFactoryName: string; linkedSampleCode: string; status: string; note: string }>): string {
  const rows = lines.map((line) => {
    const referenceFactoryName = line.sampleRole === '工厂参照确认' ? (line.targetFactoryName || '待选择') : '-'
    return `
      <tr class="border-t border-slate-100">
        <td class="px-3 py-3 text-sm text-slate-900">${escapeHtml(line.sampleRole)}</td>
        <td class="px-3 py-3 text-sm text-slate-700">${escapeHtml(line.materialMode)}</td>
        <td class="px-3 py-3 text-sm text-slate-700">${escapeHtml(String(line.quantity || 0))}</td>
        <td class="px-3 py-3 text-sm text-slate-700">${escapeHtml(referenceFactoryName)}</td>
        <td class="px-3 py-3 text-sm text-slate-700">${escapeHtml(line.linkedSampleCode || '待关联')}</td>
        <td class="px-3 py-3 text-sm text-slate-700">${escapeHtml(line.status || '待计划')}</td>
      </tr>
    `
  }).join('')
  return `
    <div class="overflow-hidden rounded-lg border border-slate-200">
      <table class="min-w-full divide-y divide-slate-100">
        <thead class="bg-slate-50 text-left text-xs font-medium text-slate-500">
          <tr>
            <th class="px-3 py-2">样衣角色</th>
            <th class="px-3 py-2">材质模式</th>
            <th class="px-3 py-2">数量</th>
            <th class="px-3 py-2">参照接收工厂</th>
            <th class="px-3 py-2">关联结果</th>
            <th class="px-3 py-2">状态</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white">${rows || '<tr><td class="px-3 py-4 text-sm text-slate-500" colspan="6">暂无样衣计划</td></tr>'}</tbody>
      </table>
    </div>
  `
}

function renderFirstOrderPlanCellSelect(
  scope: 'create' | 'result',
  index: number,
  key: keyof SamplePlanLine,
  value: string,
  options: string[],
): string {
  return `
    <select class="h-9 w-full min-w-[120px] rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-blue-500" data-pcs-engineering-field="first-order-${scope}-plan-line" data-line-index="${index}" data-line-key="${escapeHtml(String(key))}">
      ${options.map((option) => `<option value="${escapeHtml(option)}" ${value === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
    </select>
  `
}

function renderFirstOrderPlanCellInput(
  scope: 'create' | 'result',
  index: number,
  key: keyof SamplePlanLine,
  value: string | number,
  placeholder = '',
  type = 'text',
): string {
  return `
    <input type="${escapeHtml(type)}" ${type === 'number' ? 'min="0" step="1"' : ''} class="h-9 w-full min-w-[92px] rounded-md border border-slate-200 px-2 text-xs text-slate-900 outline-none focus:border-blue-500" value="${escapeHtml(String(value ?? ''))}" placeholder="${escapeHtml(placeholder)}" data-pcs-engineering-field="first-order-${scope}-plan-line" data-line-index="${index}" data-line-key="${escapeHtml(String(key))}" />
  `
}

function renderFirstOrderReferenceFactorySelect(scope: 'create' | 'result', index: number, line: SamplePlanLine): string {
  const enabled = line.sampleRole === '工厂参照确认'
  const options = FIRST_ORDER_SAMPLE_FACTORY_OPTIONS.map((item) => ({ value: item.factoryName, label: item.factoryName }))
  return `
    <select class="h-9 w-full min-w-[150px] rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400" data-pcs-engineering-field="first-order-${scope}-plan-line" data-line-index="${index}" data-line-key="targetFactoryName" ${enabled ? '' : 'disabled'}>
      <option value="">${enabled ? '请选择参照接收工厂' : '不适用'}</option>
      ${options.map((option) => `<option value="${escapeHtml(option.value)}" ${line.targetFactoryName === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
    </select>
  `
}

function renderFirstOrderSamplePlanEditTable(scope: 'create' | 'result', lines: SamplePlanLine[]): string {
  const actionPrefix = scope === 'create' ? 'create' : 'result'
  const rows = lines.map((line, index) => `
    <tr class="border-t border-slate-100 align-top">
      <td class="px-2 py-2">${renderFirstOrderPlanCellSelect(scope, index, 'sampleRole', line.sampleRole, SAMPLE_PLAN_ROLE_OPTIONS)}</td>
      <td class="px-2 py-2">${renderFirstOrderPlanCellSelect(scope, index, 'materialMode', line.materialMode, SAMPLE_PLAN_MATERIAL_OPTIONS)}</td>
      <td class="px-2 py-2">${renderFirstOrderPlanCellInput(scope, index, 'quantity', line.quantity || 0, '1', 'number')}</td>
      <td class="px-2 py-2">${renderFirstOrderReferenceFactorySelect(scope, index, line)}</td>
      <td class="px-2 py-2">${renderFirstOrderPlanCellInput(scope, index, 'linkedSampleCode', line.linkedSampleCode || '', '结果编号')}</td>
      <td class="px-2 py-2">${renderFirstOrderPlanCellSelect(scope, index, 'status', line.status, SAMPLE_PLAN_STATUS_OPTIONS)}</td>
      <td class="px-2 py-2">${renderFirstOrderPlanCellInput(scope, index, 'note', line.note || '', '说明')}</td>
      <td class="px-2 py-2 text-right">
        <button type="button" class="text-xs text-rose-600 hover:text-rose-700" data-pcs-engineering-action="remove-first-order-${actionPrefix}-plan-line" data-line-index="${index}">删除</button>
      </td>
    </tr>
  `).join('')

  return `
    <div class="space-y-2">
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs text-slate-500">${scope === 'create' ? '样衣计划行' : '样衣计划行结果'}</p>
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="add-first-order-${actionPrefix}-plan-line">新增计划行</button>
      </div>
      <div class="overflow-x-auto rounded-lg border border-slate-200">
        <table class="min-w-[980px] w-full divide-y divide-slate-100">
          <thead class="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th class="px-2 py-2">样衣角色</th>
              <th class="px-2 py-2">材质模式</th>
              <th class="px-2 py-2">数量</th>
              <th class="px-2 py-2">参照接收工厂</th>
              <th class="px-2 py-2">结果编号</th>
              <th class="px-2 py-2">状态</th>
              <th class="px-2 py-2">说明</th>
              <th class="px-2 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 bg-white">
            ${rows || '<tr><td class="px-3 py-4 text-sm text-slate-500" colspan="8">暂无样衣计划行，请新增后填写。</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function getFirstSampleActionLabel(status: string): string {
  if (status === '草稿' || status === '待处理') return '开始打样'
  if (status === '打样中') return '提交结果'
  if (status === '待确认') return '填写结论'
  if (status === '需改版') return '去创建改版任务'
  return '查看结果'
}

function getFirstOrderActionLabel(status: string): string {
  if (status === '草稿' || status === '待处理') return '开始首单'
  if (status === '打样中') return '提交首单结果'
  if (status === '待确认') return '填写结论'
  return '查看结果'
}

function getFirstSampleTasksFiltered() {
  const tasks = listFirstSampleTasks()
  const keyword = state.firstSampleList.search.trim().toLowerCase()
  return tasks.filter((task) => {
    if (keyword) {
      const haystack = [task.firstSampleTaskCode, task.title, task.projectCode, task.projectName, task.ownerName, task.factoryName, task.sampleCode].join(' ').toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (state.firstSampleList.status !== 'all' && task.status !== state.firstSampleList.status) return false
    if (state.firstSampleList.owner !== 'all' && task.ownerName !== state.firstSampleList.owner) return false
    if (state.firstSampleList.source !== 'all' && task.sourceType !== state.firstSampleList.source) return false
    if (state.firstSampleList.site !== 'all' && task.targetSite !== state.firstSampleList.site) return false
    if (state.firstSampleList.quickFilter === 'sampling' && task.status !== '打样中') return false
    if (state.firstSampleList.quickFilter === 'confirming' && task.status !== '待确认') return false
    if (state.firstSampleList.quickFilter === 'rework' && task.status !== '需改版') return false
    if (state.firstSampleList.quickFilter === 'passed' && task.status !== '已通过') return false
    return true
  })
}

function renderFirstSampleRevisionCell(task: FirstSampleTaskRecord): string {
  if (task.status !== '需改版') return '<span class="text-slate-400">-</span>'
  const revision = findRevisionTaskByFirstSample(task)
  if (!revision) return '<span class="text-xs font-medium text-orange-700">未创建改版任务</span>'
  return `
    <div class="space-y-1">
      ${revisionTaskNewTabLink(revision.revisionTaskId, revision.revisionTaskCode)}
      <p class="text-xs text-slate-500">${escapeHtml(revision.status)}</p>
    </div>
  `
}

function renderFirstSampleRevisionAction(task: FirstSampleTaskRecord): string {
  if (task.status !== '需改版') return ''
  const revision = findRevisionTaskByFirstSample(task)
  if (revision) {
    return `<button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/patterns/revision/${escapeHtml(revision.revisionTaskId)}">查看改版任务</button>`
  }
  return `<button type="button" class="inline-flex h-8 items-center px-1 text-xs font-medium text-blue-700 hover:text-blue-800" data-pcs-engineering-action="create-revision-from-first-sample" data-task-id="${escapeHtml(task.firstSampleTaskId)}">去创建改版任务</button>`
}

function renderFirstSampleListPage(): string {
  const tasks = listFirstSampleTasks()
  const filtered = getFirstSampleTasksFiltered()
  const owners = getOwners(tasks)
  const sources = getSources(tasks)
  const paged = paginate(filtered, state.firstSampleList.currentPage)
  const rows = paged.map((task) => `
      <tr class="hover:bg-slate-50/70">
        <td class="px-4 py-4">
          <div class="space-y-1">
            <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/samples/first-sample/${escapeHtml(task.firstSampleTaskId)}">${escapeHtml(task.firstSampleTaskCode)}</button>
            <p class="text-xs text-slate-500">${escapeHtml(task.title)}</p>
          </div>
        </td>
        <td class="px-4 py-4">${projectButton(task.projectId, task.projectCode, task.projectName)}</td>
        <td class="px-4 py-4">${renderStatusBadge(task.status, true)}</td>
        <td class="px-4 py-4">${renderFirstSampleRevisionCell(task)}</td>
        <td class="px-4 py-4">${escapeHtml(task.targetSite)}</td>
        <td class="px-4 py-4">${escapeHtml(task.sampleMaterialMode)}</td>
        <td class="px-4 py-4">${escapeHtml(task.sampleCode || '-')}</td>
        <td class="px-4 py-4">${task.reuseAsFirstOrderBasisFlag ? '<span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">可做首单依据</span>' : '<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">仅首版确认</span>'}</td>
        <td class="px-4 py-4">
          <div class="flex flex-wrap gap-2">
            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/first-sample/${escapeHtml(task.firstSampleTaskId)}">查看</button>
            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="first-sample-advance" data-task-id="${escapeHtml(task.firstSampleTaskId)}">${escapeHtml(getFirstSampleActionLabel(task.status))}</button>
            ${renderFirstSampleRevisionAction(task)}
          </div>
        </td>
      </tr>
    `).join('')

  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${renderPageHeader('首版样衣打样', '新建首版打样', 'open-first-sample-create')}
      ${renderListFilters({
        searchPlaceholder: '搜索任务编号 / 商品项目 / 打样工厂 / 结果编号',
        listState: state.firstSampleList,
        searchField: 'first-sample-search',
        statusField: 'first-sample-status',
        ownerField: 'first-sample-owner',
        sourceField: 'first-sample-source',
        siteField: 'first-sample-site',
        siteOptions: SAMPLE_SITE_OPTIONS,
        statusOptions: ['待处理', '打样中', '待确认', '已通过', '需改版', '已取消'],
        ownerOptions: owners,
        sourceOptions: sources,
      })}
      <section class="grid gap-4 md:grid-cols-4">
        ${renderMetricButton('打样中', tasks.filter((item) => item.status === '打样中').length, state.firstSampleList.quickFilter === 'sampling', 'sampling', 'set-first-sample-quick-filter')}
        ${renderMetricButton('待确认', tasks.filter((item) => item.status === '待确认').length, state.firstSampleList.quickFilter === 'confirming', 'confirming', 'set-first-sample-quick-filter')}
        ${renderMetricButton('需改版', tasks.filter((item) => item.status === '需改版').length, state.firstSampleList.quickFilter === 'rework', 'rework', 'set-first-sample-quick-filter')}
        ${renderMetricButton('已通过', tasks.filter((item) => item.status === '已通过').length, state.firstSampleList.quickFilter === 'passed', 'passed', 'set-first-sample-quick-filter')}
      </section>
      ${renderDataTable(['首版打样任务', '商品项目', '结论', '改版处理', '打样区域', '面料模式', '结果编号', '首单依据', '操作'], rows, '暂无首版样衣打样数据', renderPagination(state.firstSampleList.currentPage, filtered.length, 'change-first-sample-page'))}
      ${renderFirstSampleCreateDialog()}
      ${renderFirstSampleStartDialog()}
      ${renderFirstSampleResultDialog()}
      ${renderFirstSampleAcceptanceDialog()}
      ${renderRevisionCreateDialog()}
    </div>
  `
}

function renderFirstSampleCreateDialog(): string {
  const draft = state.firstSampleCreateDraft
  const body = `
    <div class="grid gap-4 md:grid-cols-2">
      ${renderSelectInput('商品项目', 'first-sample-create-project', draft.projectId, buildProjectOptions())}
      ${renderTextInput('负责人', 'first-sample-create-owner', draft.ownerName, '默认取项目负责人')}
      ${renderTextInput('任务标题', 'first-sample-create-title', draft.title, '例如：首版样衣打样-碎花连衣裙')}
      ${renderTextInput('来源技术包版本ID', 'first-sample-create-tech-pack-id', draft.sourceTechPackVersionId, '选择商品项目后自动带出')}
      ${renderTextInput('来源技术包版本标签', 'first-sample-create-tech-pack-label', draft.sourceTechPackVersionLabel || draft.sourceTechPackVersionCode, '选择商品项目后自动带出')}
      ${renderSelectInput('打样工厂', 'first-sample-create-factory', draft.factoryId, buildFirstSampleFactoryOptions())}
      ${renderSelectInput('打样区域', 'first-sample-create-site', draft.targetSite, [{ value: '深圳', label: '深圳' }, { value: '雅加达', label: '雅加达' }])}
      ${renderSelectInput('样衣材质模式', 'first-sample-create-material-mode', draft.sampleMaterialMode, [
        { value: '替代布', label: '替代布' },
        { value: '正确布', label: '正确布' },
      ])}
      ${renderSelectInput('样衣用途', 'first-sample-create-purpose', draft.samplePurpose, [
        { value: '首版确认', label: '首版确认' },
        { value: '首单复用候选', label: '首单复用候选' },
      ])}
    </div>
    <div class="mt-4">
      ${renderTextarea('说明', 'first-sample-create-note', draft.note, '')}
    </div>
    <p class="mt-2 text-xs text-slate-400">创建时必须明确打样工厂、打样区域、材质模式和样衣用途；开始打样、提交结果和填写结论在详情页按动作弹窗完成。</p>
  `
  return renderDialog(state.firstSampleCreateOpen, '新建首版样衣打样', body, 'close-first-sample-create', 'submit-first-sample-create', '创建首版打样')
}

function renderFirstSampleStartDialog(): string {
  const draft = state.firstSampleStartDraft
  const body = `
    <div class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        ${renderTextInput('开始人', 'first-sample-start-operator', draft.operatorName, '例如：张娜')}
        ${renderDateTimeInput('开始时间', 'first-sample-start-at', draft.startedAt)}
        ${renderDateTimeInput('计划完成时间', 'first-sample-start-plan-finish-at', draft.planFinishAt)}
      </div>
      ${renderTextarea('开始说明', 'first-sample-start-note', draft.startNote, '记录样衣资料、面辅料和打样窗口已确认')}
    </div>
  `
  return renderDialog(state.firstSampleStartOpen, '开始首版打样', body, 'close-first-sample-start', 'submit-first-sample-start', '确认开始')
}

function renderFirstSampleResultDialog(): string {
  const draft = state.firstSampleResultDraft
  const body = `
    <div class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        ${renderTextInput('结果编号', 'first-sample-result-sample-code', draft.sampleCode, '例如：FS-RESULT-25001')}
        ${renderTextInput('提交人', 'first-sample-result-submitted-by', draft.submittedBy, '例如：张娜')}
        ${renderDateTimeInput('完成时间', 'first-sample-result-completed-at', draft.completedAt)}
      </div>
      ${renderImageUploader('样衣图片', 'first-sample-result-sample-images', draft.sampleImageIds, '请上传至少 1 张样衣图片')}
      ${renderTextarea('提交说明', 'first-sample-result-note', draft.resultNote, '记录首版样衣打样完成情况、异常或待确认点')}
    </div>
  `
  return renderDialog(state.firstSampleResultOpen, '提交首版打样结果', body, 'close-first-sample-result', 'submit-first-sample-result', '提交结果')
}

function renderFirstSampleAcceptanceDialog(): string {
  const reuseHint = state.firstSampleAcceptanceTaskId
    ? getFirstSampleTaskById(state.firstSampleAcceptanceTaskId)?.samplePurpose === '首单复用候选'
    : false
  const body = `
    <div class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        ${renderTextInput('确认人', 'first-sample-acceptance-confirmed-by', state.firstSampleAcceptanceConfirmedBy, '例如：张娜')}
        ${renderDateTimeInput('确认时间', 'first-sample-acceptance-confirmed-at', state.firstSampleAcceptanceConfirmedAt)}
      </div>
      ${renderSelectInput('验收结论', 'first-sample-acceptance-result', state.firstSampleAcceptanceResult, [
        { value: '通过', label: '通过' },
        { value: '需改版', label: '需改版' },
      ])}
      ${renderTextarea('版型确认说明', 'first-sample-acceptance-note', state.firstSampleAcceptanceNote, '记录版型、尺寸、穿着效果和需改版点')}
      ${renderTextarea('花型确认说明', 'first-sample-acceptance-artwork-summary', state.firstSampleAcceptanceArtworkSummary, '记录花型位置、颜色、外观效果；无花型时可写无')}
      <div class="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
        ${escapeHtml(reuseHint ? '当前样衣用途为首单复用候选。验收通过后会同步写入首单复用依据、复用确认时间、复用确认人和复用说明。' : '当前样衣用途不是首单复用候选。验收通过只记录首版确认结论，不自动写入首单复用依据。')}
      </div>
    </div>
  `
  return renderDialog(state.firstSampleAcceptanceOpen, '填写首版验收结论', body, 'close-first-sample-acceptance', 'submit-first-sample-acceptance', '提交验收')
}

function getFirstSampleDetailDraft(task: FirstSampleTaskRecord): FirstSampleDetailDraft {
  if (state.firstSampleDetailDraftTaskId !== task.firstSampleTaskId) {
    state.firstSampleDetailDraftTaskId = task.firstSampleTaskId
    state.firstSampleDetailDraft = buildFirstSampleDetailDraft(task)
  }
  return state.firstSampleDetailDraft
}

function parseSampleImageIdsText(value: string): string[] {
  return value
    .split(/[\n,，、]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function saveFirstSampleDetail(taskId: string): void {
  const task = getFirstSampleTaskById(taskId)
  if (!task) {
    setNotice('未找到首版样衣打样任务。')
    return
  }
  const draft = getFirstSampleDetailDraft(task)
  const result = updateFirstSampleTaskDetailAndSync(taskId, {
    sampleCode: draft.sampleCode.trim(),
    sampleImageIds: parseSampleImageIdsText(draft.sampleImageIdsText),
    fitConfirmationSummary: draft.fitConfirmationSummary.trim(),
    artworkConfirmationSummary: draft.artworkConfirmationSummary.trim(),
    productionReadinessNote: draft.productionReadinessNote.trim(),
    reuseAsFirstOrderBasisFlag: draft.reuseAsFirstOrderBasisFlag,
    reuseAsFirstOrderBasisConfirmedAt: draft.reuseAsFirstOrderBasisConfirmedAt.trim(),
    reuseAsFirstOrderBasisConfirmedBy: draft.reuseAsFirstOrderBasisConfirmedBy.trim(),
    reuseAsFirstOrderBasisNote: draft.reuseAsFirstOrderBasisNote.trim(),
    confirmedAt: draft.confirmedAt.trim(),
  }, '当前用户')
  if (!result.ok || !result.task) {
    setNotice(result.message)
    return
  }
  state.firstSampleDetailDraftTaskId = result.task.firstSampleTaskId
  state.firstSampleDetailDraft = buildFirstSampleDetailDraft(result.task)
  pushRuntimeLog('firstSample', result.task.firstSampleTaskId, '保存详情', '已保存首版样衣详情字段并同步商品项目节点。')
  setNotice('首版样衣打样详情已保存，并同步商品项目节点。')
}

function getFirstOrderDetailDraft(task: FirstOrderSampleTaskRecord): FirstOrderDetailDraft {
  if (state.firstOrderDetailDraftTaskId !== task.firstOrderSampleTaskId) {
    state.firstOrderDetailDraftTaskId = task.firstOrderSampleTaskId
    state.firstOrderDetailDraft = buildFirstOrderDetailDraft(task)
  }
  return state.firstOrderDetailDraft
}

function saveFirstOrderDetail(taskId: string): void {
  const task = getFirstOrderSampleTaskById(taskId)
  if (!task) {
    setNotice('未找到首单样衣打样任务。')
    return
  }
  const draft = getFirstOrderDetailDraft(task)
  const samplePlanLines = parseFirstOrderSamplePlanLines(draft.samplePlanLinesText, task.samplePlanLines)
  const nextStatus = draft.conclusionResult === '通过'
    ? '待确认'
    : draft.conclusionResult === '需改版'
      ? '需改版'
      : draft.conclusionResult === '需补首单'
        ? '需补首单'
        : task.status
  const result = updateFirstOrderSampleTaskDetailAndSync(taskId, {
    patternVersion: draft.patternVersion.trim(),
    artworkVersion: draft.artworkVersion.trim(),
    samplePlanLines,
    finalReferenceNote: draft.finalReferenceNote.trim(),
    sampleCode: draft.sampleCode.trim(),
    conclusionResult: draft.conclusionResult,
    conclusionNote: draft.conclusionNote.trim(),
    confirmedAt: draft.confirmedAt.trim(),
    confirmedBy: draft.confirmedBy.trim(),
    status: nextStatus,
  }, '当前用户')
  if (!result.ok || !result.task) {
    setNotice(result.message)
    return
  }
  state.firstOrderDetailDraftTaskId = result.task.firstOrderSampleTaskId
  state.firstOrderDetailDraft = buildFirstOrderDetailDraft(result.task)
  if (result.task.conclusionResult) {
    firstOrderConclusionMap.set(result.task.firstOrderSampleTaskId, {
      result: result.task.conclusionResult,
      note: result.task.conclusionNote,
      updatedAt: result.task.confirmedAt || result.task.updatedAt,
    })
  }
  pushRuntimeLog('firstOrder', result.task.firstOrderSampleTaskId, '保存详情', '已保存首单样衣详情字段并同步商品项目节点。')
  setNotice('首单样衣打样详情已保存，并同步商品项目节点。')
}

function renderFirstSampleReworkCard(task: FirstSampleTaskRecord): string {
  if (task.status !== '需改版') return ''
  const revision = findRevisionTaskByFirstSample(task)
  const reworkReason = [
    task.fitConfirmationSummary ? `版型：${task.fitConfirmationSummary}` : '',
    task.artworkConfirmationSummary ? `花型：${task.artworkConfirmationSummary}` : '',
    task.productionReadinessNote || '',
  ].filter(Boolean).join(' ')
  return `
    <article class="rounded-lg border border-orange-200 bg-orange-50 p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <p class="text-sm font-semibold text-orange-900">改版处理</p>
          <p class="text-xs leading-5 text-orange-800">${escapeHtml(reworkReason || '首版样衣验收结论为需改版，需要创建或跟进关联改版任务。')}</p>
        </div>
        ${revision
          ? `<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700" data-nav="/pcs/patterns/revision/${escapeHtml(revision.revisionTaskId)}">查看改版任务</button>`
          : `<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700" data-pcs-engineering-action="create-revision-from-first-sample" data-task-id="${escapeHtml(task.firstSampleTaskId)}">去创建改版任务</button>`}
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-3">
        <div class="rounded-md border border-orange-100 bg-white/70 px-3 py-2">
          <p class="text-xs text-slate-500">改版任务</p>
          <p class="mt-1 text-sm text-slate-900">${revision ? revisionTaskNewTabLink(revision.revisionTaskId, revision.revisionTaskCode) : '<span class="text-orange-700">未创建改版任务</span>'}</p>
        </div>
        <div class="rounded-md border border-orange-100 bg-white/70 px-3 py-2">
          <p class="text-xs text-slate-500">处理状态</p>
          <p class="mt-1 text-sm text-slate-900">${escapeHtml(revision?.status || '待创建')}</p>
        </div>
        <div class="rounded-md border border-orange-100 bg-white/70 px-3 py-2">
          <p class="text-xs text-slate-500">来源首版样衣</p>
          <p class="mt-1 text-sm text-slate-900">${escapeHtml(task.firstSampleTaskCode)}</p>
        </div>
      </div>
    </article>
  `
}

function renderFirstSampleDetailPage(firstSampleTaskId: string): string {
  const task = getFirstSampleTaskById(firstSampleTaskId)
  if (!task) return renderEmptyDetail('首版样衣打样', '/pcs/samples/first-sample')
  getFirstSampleDetailDraft(task)
  const acceptance =
    firstSampleAcceptanceMap.get(task.firstSampleTaskId) ||
    (task.confirmedAt || task.fitConfirmationSummary || task.productionReadinessNote
      ? {
          result: task.status === '已通过' ? '通过' : task.status,
          note: task.fitConfirmationSummary || task.productionReadinessNote || task.note || '首版样衣已记录验收结论。',
          updatedAt: task.confirmedAt || task.updatedAt,
        }
      : null)
  const logs = mergeLogs('firstSample', task.firstSampleTaskId, [
    ...(acceptance ? [{ time: acceptance.updatedAt, action: '填写验收', user: '当前用户', detail: `验收结论：${acceptance.result}。${acceptance.note}` }] : []),
    ...baseLogs(task),
  ])
  const resultImages = task.sampleImageIds || []
  const header = renderHeaderMeta(
    `${task.firstSampleTaskCode} · ${task.title}`,
    `${task.projectCode} · ${task.projectName} · ${formatDateTime(task.updatedAt)}`,
    `${renderStatusBadge(task.status, true)}<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">${escapeHtml(task.targetSite)}</span>`,
    [
      `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/first-sample">返回列表</button>`,
      `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="first-sample-advance" data-task-id="${escapeHtml(task.firstSampleTaskId)}">${escapeHtml(getFirstSampleActionLabel(task.status))}</button>`,
      `<button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-nav="/pcs/projects/${encodeURIComponent(task.projectId)}">查看商品项目</button>`,
    ].join(''),
  )
  const tabBar = renderTabBar(state.firstSampleTab, [
    { key: 'overview', label: '概览' },
    { key: 'inputs', label: '输入包' },
    { key: 'result', label: '打样结果' },
    { key: 'acceptance', label: '验收与结论' },
    { key: 'logs', label: '日志' },
  ], 'set-first-sample-tab')

  const overview = renderSectionCard('里程碑进度', renderTimeline(buildSampleMilestones(task)))
  const inputs = `${renderProjectContext(task)}${renderSectionCard('任务基本信息', renderKeyValueGrid([
    { label: '来源类型', value: escapeHtml(task.sourceType) },
    { label: '来源任务', value: escapeHtml(task.sourceTaskCode || task.upstreamObjectCode || task.upstreamObjectId || '人工创建') },
    { label: '来源技术包版本', value: escapeHtml(task.sourceTechPackVersionLabel || task.sourceTechPackVersionCode || '未关联') },
    { label: '打样工厂', value: escapeHtml(task.factoryName || '-') },
    { label: '打样区域', value: escapeHtml(task.targetSite || '-') },
  ], 2))}`
  const resultSection = renderSectionCard(
    '打样结果',
    `
      <div class="space-y-4">
        ${renderKeyValueGrid([
          { label: '结果编号', value: escapeHtml(task.sampleCode || '待提交') },
          { label: '样衣图片', value: resultImages.length > 0 ? escapeHtml(`${resultImages.length} 张`) : '待提交' },
          { label: '样衣材质模式', value: escapeHtml(task.sampleMaterialMode) },
          { label: '样衣用途', value: escapeHtml(task.samplePurpose) },
        ], 2)}
        <article class="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
          ${task.status === '打样中'
            ? '当前节点需要点击右上角“提交打样结果”，填写结果编号、样衣图片、提交人和完成时间后进入待确认。'
            : task.status === '待确认' || task.status === '已通过'
              ? '首版打样结果已提交；完整结论通过右上角“填写验收结论”动作维护。'
              : '首版开始打样后，再提交正式打样结果。'}
        </article>
        ${resultImages.length > 0
          ? `<div class="rounded-lg border border-slate-200 bg-white p-4">${renderImageList(resultImages, '暂无样衣图片')}</div>`
          : ''}
      </div>
    `,
  )
  const acceptanceSection = renderSectionCard(
    '验收与结论',
    `
      <div class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="rounded-lg border border-slate-200 p-4">
            <p class="text-xs text-slate-500">验收状态</p>
            <p class="mt-2 text-sm text-slate-900">${acceptance ? escapeHtml(acceptance.result) : '待填写'}</p>
            <p class="mt-2 text-xs text-slate-500">${escapeHtml(acceptance?.note || '样衣进入验收后可填写正式结论。')}</p>
          </div>
          <div class="rounded-lg border border-slate-200 p-4">
            <p class="text-xs text-slate-500">正式对象核对</p>
            <p class="mt-2 text-sm text-slate-900">工作项状态：${escapeHtml(task.status)}</p>
            <p class="mt-2 text-xs text-slate-500">结果编号：${escapeHtml(task.sampleCode || '-')}</p>
          </div>
        </div>
        ${renderKeyValueGrid([
          { label: '版型确认说明', value: escapeHtml(task.fitConfirmationSummary || '-') },
          { label: '花型确认说明', value: escapeHtml(task.artworkConfirmationSummary || '-') },
          { label: '生产准备说明', value: escapeHtml(task.productionReadinessNote || '-') },
          { label: '复用为首单依据', value: task.reuseAsFirstOrderBasisFlag ? '是' : '否' },
          { label: '复用确认时间', value: escapeHtml(task.reuseAsFirstOrderBasisConfirmedAt || '-') },
          { label: '复用确认人', value: escapeHtml(task.reuseAsFirstOrderBasisConfirmedBy || '-') },
          { label: '复用说明', value: escapeHtml(task.reuseAsFirstOrderBasisNote || '-') },
          { label: '确认时间', value: escapeHtml(task.confirmedAt || '-') },
        ], 2)}
        <article class="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
          结论信息由右上角“填写验收结论”动作写入。不同动作只填写当前节点需要的信息，不再在 Tab 中补录完整字段。
        </article>
      </div>
    `,
  )
  const mainContent = state.firstSampleTab === 'overview'
    ? overview
    : state.firstSampleTab === 'inputs'
      ? inputs
      : state.firstSampleTab === 'result'
        ? resultSection
        : state.firstSampleTab === 'acceptance'
          ? acceptanceSection
          : renderSectionCard('日志', renderLogs(logs))
  const aside = `
    <div class="space-y-4">
      ${renderSectionCard('任务摘要', renderKeyValueGrid([
        { label: '负责人', value: escapeHtml(task.ownerName) },
        { label: '打样工厂', value: escapeHtml(task.factoryName || '-') },
        { label: '打样区域', value: escapeHtml(task.targetSite) },
        { label: '结果编号', value: escapeHtml(task.sampleCode || '-') },
      ], 2))}
      ${renderSectionCard('正式对象核对', renderKeyValueGrid([
        { label: '商品项目', value: projectButton(task.projectId, task.projectCode, task.projectName) },
        { label: '工作项节点', value: projectNodeButton(task.projectId, task.projectNodeId, task.workItemTypeName) },
        { label: '正式状态', value: renderStatusBadge(task.status, true) },
      ], 2))}
    </div>
  `
  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${header}
      ${tabBar}
      ${renderFirstSampleReworkCard(task)}
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div class="space-y-6">${mainContent}</div>
        ${aside}
      </div>
      ${renderFirstSampleStartDialog()}
      ${renderFirstSampleResultDialog()}
      ${renderFirstSampleAcceptanceDialog()}
      ${renderRevisionCreateDialog()}
    </div>
  `
}

function getFirstOrderTasksFiltered() {
  const tasks = listFirstOrderSampleTasks()
  const keyword = state.firstOrderList.search.trim().toLowerCase()
  return tasks.filter((task) => {
    if (keyword) {
      const haystack = [task.firstOrderSampleTaskCode, task.title, task.projectCode, task.projectName, task.ownerName, task.factoryName, task.sampleCode].join(' ').toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (state.firstOrderList.status !== 'all' && task.status !== state.firstOrderList.status) return false
    if (state.firstOrderList.owner !== 'all' && task.ownerName !== state.firstOrderList.owner) return false
    if (state.firstOrderList.source !== 'all' && task.sourceType !== state.firstOrderList.source) return false
    if (state.firstOrderList.site !== 'all' && task.targetSite !== state.firstOrderList.site) return false
    if (state.firstOrderList.quickFilter === 'sampling' && task.status !== '打样中') return false
    if (state.firstOrderList.quickFilter === 'confirming' && task.status !== '待确认') return false
    if (state.firstOrderList.quickFilter === 'rework' && task.status !== '需改版') return false
    if (state.firstOrderList.quickFilter === 'passed' && task.status !== '已通过') return false
    return true
  })
}

function renderFirstOrderListPage(): string {
  const tasks = listFirstOrderSampleTasks()
  const filtered = getFirstOrderTasksFiltered()
  const owners = getOwners(tasks)
  const sources = getSources(tasks)
  const paged = paginate(filtered, state.firstOrderList.currentPage)
  const rows = paged.map((task) => {
    const conclusion =
      firstOrderConclusionMap.get(task.firstOrderSampleTaskId) ||
      (task.conclusionResult ? { result: task.conclusionResult, note: task.conclusionNote, updatedAt: task.confirmedAt || task.updatedAt } : null)
    return `
      <tr class="hover:bg-slate-50/70">
        <td class="px-4 py-4">
          <div class="space-y-1">
            <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/samples/first-order/${escapeHtml(task.firstOrderSampleTaskId)}">${escapeHtml(task.firstOrderSampleTaskCode)}</button>
            <p class="text-xs text-slate-500">${escapeHtml(task.title)}</p>
          </div>
        </td>
        <td class="px-4 py-4">${projectButton(task.projectId, task.projectCode, task.projectName)}</td>
        <td class="px-4 py-4">${renderStatusBadge(task.status, true)}</td>
        <td class="px-4 py-4">${escapeHtml(task.sampleChainMode)}</td>
        <td class="px-4 py-4">${escapeHtml(task.targetSite)}</td>
        <td class="px-4 py-4">${escapeHtml(task.patternVersion || '-')}</td>
        <td class="px-4 py-4">${escapeHtml(task.artworkVersion || '-')}</td>
        <td class="px-4 py-4">${escapeHtml(conclusion?.result || '-')}</td>
        <td class="px-4 py-4">
          <div class="flex flex-wrap gap-2">
            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/first-order/${escapeHtml(task.firstOrderSampleTaskId)}">查看</button>
            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="first-order-advance" data-task-id="${escapeHtml(task.firstOrderSampleTaskId)}">${escapeHtml(getFirstOrderActionLabel(task.status))}</button>
          </div>
        </td>
      </tr>
    `
  }).join('')

  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${renderPageHeader('首单样衣打样', '新建首单打样', 'open-first-order-create')}
      ${renderListFilters({
        searchPlaceholder: '搜索任务编号 / 商品项目 / 打样工厂 / 结果编号',
        listState: state.firstOrderList,
        searchField: 'first-order-search',
        statusField: 'first-order-status',
        ownerField: 'first-order-owner',
        sourceField: 'first-order-source',
        siteField: 'first-order-site',
        siteOptions: SAMPLE_SITE_OPTIONS,
        statusOptions: ['待处理', '打样中', '待确认', '已通过', '需改版', '需补首单', '已取消'],
        ownerOptions: owners,
        sourceOptions: sources,
      })}
      <section class="grid gap-4 md:grid-cols-4">
        ${renderMetricButton('打样中', tasks.filter((item) => item.status === '打样中').length, state.firstOrderList.quickFilter === 'sampling', 'sampling', 'set-first-order-quick-filter')}
        ${renderMetricButton('待确认', tasks.filter((item) => item.status === '待确认').length, state.firstOrderList.quickFilter === 'confirming', 'confirming', 'set-first-order-quick-filter')}
        ${renderMetricButton('需改版', tasks.filter((item) => item.status === '需改版').length, state.firstOrderList.quickFilter === 'rework', 'rework', 'set-first-order-quick-filter')}
        ${renderMetricButton('已通过', tasks.filter((item) => item.status === '已通过').length, state.firstOrderList.quickFilter === 'passed', 'passed', 'set-first-order-quick-filter')}
      </section>
      ${renderDataTable(['首单任务', '商品项目', '状态', '确认方式', '打样区域', '版次', '花型版次', '首单结论', '操作'], rows, '暂无首单样衣打样数据', renderPagination(state.firstOrderList.currentPage, filtered.length, 'change-first-order-page'))}
      ${renderFirstOrderCreateDialog()}
      ${renderFirstOrderStartDialog()}
      ${renderFirstOrderResultDialog()}
      ${renderFirstOrderConclusionDialog()}
    </div>
  `
}

function renderFirstOrderCreateDialog(): string {
  const draft = state.firstOrderCreateDraft
  const sourceFirstSampleLabel = draft.projectId ? getFirstOrderSourceFirstSampleLabel(draft.projectId) : '选择商品项目后自动带出'
  const body = `
    <div class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        ${renderSelectInput('商品项目', 'first-order-create-project', draft.projectId, buildProjectOptions())}
        ${renderTextInput('负责人', 'first-order-create-owner', draft.ownerName, '默认取项目负责人')}
        ${renderTextInput('任务标题', 'first-order-create-title', draft.title, '例如：首单样衣打样-碎花连衣裙')}
        ${renderSelectInput('打样工厂', 'first-order-create-factory', draft.factoryId, buildFirstOrderFactoryOptions())}
        ${renderSelectInput('打样区域', 'first-order-create-site', draft.targetSite, [{ value: '深圳', label: '深圳' }, { value: '雅加达', label: '雅加达' }])}
        ${renderSelectInput('首单确认方式', 'first-order-create-chain-mode', draft.sampleChainMode, SAMPLE_CHAIN_MODE_OPTIONS.map((item) => ({ value: item, label: item })))}
        ${renderTextInput('制版版次', 'first-order-create-pattern-version', draft.patternVersion, 'P2')}
        ${renderTextInput('花型版次', 'first-order-create-artwork-version', draft.artworkVersion, 'A1')}
      </div>
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <p class="text-xs text-slate-500">来源首版样衣</p>
        <p class="mt-1 text-slate-900">${escapeHtml(sourceFirstSampleLabel)}</p>
      </div>
      ${renderTextarea('最终参照说明', 'first-order-create-final-reference-note', draft.finalReferenceNote, '说明本次首单引用的首版结果、技术包版本或特殊限制')}
      <div>
        ${renderFirstOrderSamplePlanEditTable('create', getFirstOrderSamplePlanLinesFromText(draft.samplePlanLinesText, createDefaultSamplePlanLines(draft.sampleChainMode)))}
        <p class="mt-1 text-xs text-slate-400">创建时必须明确样衣计划行，后续提交首单结果时只补实际结果。</p>
      </div>
    </div>
    <div class="mt-4 grid gap-3 md:grid-cols-3">
      <label class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
        <input type="checkbox" ${draft.productionReferenceRequiredFlag ? 'checked' : ''} data-pcs-engineering-action="toggle-first-order-reference-required" />
        <span>需要工厂参照确认</span>
      </label>
      <label class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
        <input type="checkbox" ${draft.chinaReviewRequiredFlag ? 'checked' : ''} data-pcs-engineering-action="toggle-first-order-china-review" />
        <span>需要中国确认</span>
      </label>
      <label class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
        <input type="checkbox" ${draft.correctFabricRequiredFlag ? 'checked' : ''} data-pcs-engineering-action="toggle-first-order-correct-fabric" />
        <span>需要正确布确认</span>
      </label>
    </div>
    <div class="mt-4">
      <p class="mb-2 text-xs text-slate-500">特殊场景原因</p>
      <div class="flex flex-wrap gap-2">
        ${SAMPLE_SPECIAL_REASON_OPTIONS.map((item) => `
          <label class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700">
            <input type="checkbox" ${draft.specialSceneReasonCodes.includes(item) ? 'checked' : ''} data-pcs-engineering-action="toggle-first-order-special-reason" data-reason="${escapeHtml(item)}" />
            <span>${escapeHtml(item)}</span>
          </label>
        `).join('')}
      </div>
    </div>
    <div class="mt-4">
      ${renderTextarea('说明', 'first-order-create-note', draft.note, '')}
    </div>
  `
  return renderDialog(state.firstOrderCreateOpen, '新建首单样衣打样', body, 'close-first-order-create', 'submit-first-order-create', '创建首单任务')
}

function renderFirstOrderStartDialog(): string {
  const draft = state.firstOrderStartDraft
  const body = `
    <div class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        ${renderTextInput('开始人', 'first-order-start-operator', draft.operatorName, '例如：张娜')}
        ${renderDateTimeInput('开始时间', 'first-order-start-at', draft.startedAt)}
        ${renderDateTimeInput('计划完成时间', 'first-order-start-plan-finish-at', draft.planFinishAt)}
      </div>
      ${renderTextarea('工厂确认说明', 'first-order-start-factory-note', draft.factoryConfirmNote, '记录工厂已确认接收首单打样任务、材料和打样窗口')}
    </div>
  `
  return renderDialog(state.firstOrderStartOpen, '开始首单', body, 'close-first-order-start', 'submit-first-order-start', '确认开始')
}

function renderFirstOrderResultDialog(): string {
  const draft = state.firstOrderResultDraft
  const body = `
    <div class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        ${renderTextInput('结果编号', 'first-order-result-sample-code', draft.sampleCode, '例如：FOS-RESULT-002')}
        ${renderTextInput('提交人', 'first-order-result-submitted-by', draft.submittedBy, '例如：张娜')}
        ${renderDateTimeInput('完成时间', 'first-order-result-completed-at', draft.completedAt)}
      </div>
      ${renderTextarea('最终参照说明', 'first-order-result-final-reference-note', draft.finalReferenceNote, '记录最终参照样衣和使用限制')}
      <div>
        ${renderFirstOrderSamplePlanEditTable('result', getFirstOrderSamplePlanLinesFromText(draft.samplePlanLinesText, []))}
        <p class="mt-1 text-xs text-slate-400">提交结果时必须记录实际结果编号和每条样衣计划行状态。</p>
      </div>
      ${renderTextarea('提交说明', 'first-order-result-note', draft.resultNote, '记录打样完成情况、异常或待确认点')}
    </div>
  `
  return renderDialog(state.firstOrderResultOpen, '提交首单结果', body, 'close-first-order-result', 'submit-first-order-result', '提交结果')
}

function renderFirstOrderConclusionDialog(): string {
  const body = `
    <div class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        ${renderSelectInput('首单结论', 'first-order-conclusion-result', state.firstOrderConclusionResult, [
          { value: '通过', label: '通过' },
          { value: '需改版', label: '需改版' },
          { value: '需补首单', label: '需补首单' },
        ])}
        ${renderTextInput('确认人', 'first-order-conclusion-confirmed-by', state.firstOrderConclusionConfirmedBy, '例如：张娜')}
        ${renderDateTimeInput('确认时间', 'first-order-conclusion-confirmed-at', state.firstOrderConclusionConfirmedAt)}
      </div>
      ${renderTextarea('说明', 'first-order-conclusion-note', state.firstOrderConclusionNote, '')}
    </div>
  `
  return renderDialog(state.firstOrderConclusionOpen, '填写首单结论', body, 'close-first-order-conclusion', 'submit-first-order-conclusion', '提交首单结论')
}

function renderFirstOrderDetailPage(firstOrderSampleTaskId: string): string {
  const task = getFirstOrderSampleTaskById(firstOrderSampleTaskId)
  if (!task) return renderEmptyDetail('首单样衣打样', '/pcs/samples/first-order')
  if (state.firstOrderDetailDraftTaskId !== task.firstOrderSampleTaskId) {
    state.firstOrderDetailDraftTaskId = task.firstOrderSampleTaskId
    state.firstOrderDetailDraft = buildFirstOrderDetailDraft(task)
  }
  const conclusion =
    firstOrderConclusionMap.get(task.firstOrderSampleTaskId) ||
    (task.conclusionResult
      ? { result: task.conclusionResult, note: task.conclusionNote, updatedAt: task.confirmedAt || task.updatedAt }
      : null)
  const logs = mergeLogs('firstOrder', task.firstOrderSampleTaskId, [
    ...(conclusion ? [{ time: conclusion.updatedAt, action: '首单结论', user: '当前用户', detail: `结论：${conclusion.result}。${conclusion.note}` }] : []),
    ...baseLogs(task),
  ])
  const chainMissing = getFirstOrderSampleChainMissingFields(task)
  const chainSection = renderSectionCard('首单确认方式', renderKeyValueGrid([
    { label: '确认方式', value: escapeHtml(task.sampleChainMode) },
    { label: '特殊场景原因', value: escapeHtml(task.specialSceneReasonCodes.join('、') || '无') },
    { label: '需要中国确认', value: task.chinaReviewRequiredFlag ? '是' : '否' },
    { label: '需要工厂参照确认', value: task.productionReferenceRequiredFlag ? '是' : '否' },
    { label: '需要正确布确认', value: task.correctFabricRequiredFlag ? '是' : '否' },
    { label: '完整性', value: chainMissing.length > 0 ? escapeHtml(chainMissing.join('、')) : '<span class="text-emerald-700">已完整</span>' },
  ], 2))
  const samplePlanSection = renderSectionCard('确认项', renderSamplePlanLines(task.samplePlanLines))
  const resultSection = renderSectionCard('打样结果', renderKeyValueGrid([
    { label: '结果编号', value: escapeHtml(task.sampleCode || '待提交') },
    { label: '来源首版任务', value: escapeHtml(task.sourceFirstSampleTaskCode || task.sourceFirstSampleTaskId || task.upstreamObjectCode || '人工创建') },
    { label: '来源首版结果', value: escapeHtml(task.sourceFirstSampleCode || '-') },
    { label: '最终参照说明', value: escapeHtml(task.finalReferenceNote || task.specialSceneReasonText || '-') },
  ], 2))
  const header = renderHeaderMeta(
    `${task.firstOrderSampleTaskCode} · ${task.title}`,
    `${task.projectCode} · ${task.projectName} · ${formatDateTime(task.updatedAt)}`,
    `${renderStatusBadge(task.status, true)}${conclusion ? `<span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">${escapeHtml(conclusion.result)}</span>` : ''}`,
    [
      `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/first-order">返回列表</button>`,
      `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="first-order-advance" data-task-id="${escapeHtml(task.firstOrderSampleTaskId)}">${escapeHtml(getFirstOrderActionLabel(task.status))}</button>`,
      `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/projects/${encodeURIComponent(task.projectId)}">查看商品项目</button>`,
    ].join(''),
  )
  const tabBar = renderTabBar(state.firstOrderTab, [
    { key: 'overview', label: '概览' },
    { key: 'version', label: '版本与输入' },
    { key: 'result', label: '打样结果' },
    { key: 'conclusion', label: '首单确认' },
    { key: 'logs', label: '日志' },
  ], 'set-first-order-tab')

  const overview = `${chainSection}${samplePlanSection}${resultSection}${renderSectionCard('里程碑进度', renderTimeline(buildSampleMilestones(task)))}`
  const version = `${renderProjectContext(task)}${renderSectionCard('版本与输入', renderKeyValueGrid([
    { label: '来源类型', value: escapeHtml(task.sourceType) },
    { label: '来源首版任务', value: escapeHtml(task.sourceFirstSampleTaskCode || task.upstreamObjectCode || task.upstreamObjectId || '人工创建') },
    { label: '来源技术包版本', value: escapeHtml(task.sourceTechPackVersionLabel || task.sourceTechPackVersionCode || '未关联') },
    { label: '制版版次', value: escapeHtml(task.patternVersion || '-') },
    { label: '花型版次', value: escapeHtml(task.artworkVersion || '-') },
    { label: '打样工厂', value: escapeHtml(task.factoryName || '-') },
    { label: '打样区域', value: escapeHtml(task.targetSite) },
  ], 3))}`
  const conclusionSection = renderSectionCard(
    '首单确认',
    `
      <div class="grid gap-4 md:grid-cols-1">
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">首单结论</p>
          <p class="mt-2 text-sm text-slate-900">${escapeHtml(conclusion?.result || '待填写')}</p>
          <p class="mt-2 text-xs text-slate-500">${escapeHtml(conclusion?.note || '首单结果提交后可填写正式结论。')}</p>
        </div>
      </div>
    `,
  )
  const mainContent = state.firstOrderTab === 'overview'
    ? overview
    : state.firstOrderTab === 'version'
      ? version
      : state.firstOrderTab === 'result'
        ? resultSection
        : state.firstOrderTab === 'conclusion'
          ? conclusionSection
          : renderSectionCard('日志', renderLogs(logs))
  const aside = `
    <div class="space-y-4">
      ${renderSectionCard('任务摘要', renderKeyValueGrid([
        { label: '负责人', value: escapeHtml(task.ownerName) },
        { label: '打样工厂', value: escapeHtml(task.factoryName || '-') },
        { label: '打样区域', value: escapeHtml(task.targetSite) },
      ], 2))}
      ${renderSectionCard('正式对象核对', renderKeyValueGrid([
        { label: '商品项目', value: projectButton(task.projectId, task.projectCode, task.projectName) },
        { label: '工作项节点', value: projectNodeButton(task.projectId, task.projectNodeId, task.workItemTypeName) },
        { label: '结果编号', value: escapeHtml(task.sampleCode || '-') },
        { label: '正式状态', value: renderStatusBadge(task.status, true) },
      ], 2))}
    </div>
  `
  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${header}
      ${tabBar}
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div class="space-y-6">${mainContent}</div>
        ${aside}
      </div>
      ${renderFirstOrderStartDialog()}
      ${renderFirstOrderResultDialog()}
      ${renderFirstOrderConclusionDialog()}
    </div>
  `
}

function closeAllDialogs(): void {
  state.revisionCreateOpen = false
  state.plateCreateOpen = false
  state.patternCreateOpen = false
  state.firstSampleCreateOpen = false
  state.firstSampleStartOpen = false
  state.firstSampleResultOpen = false
  state.firstSampleAcceptanceOpen = false
  state.firstOrderCreateOpen = false
  state.firstOrderStartOpen = false
  state.firstOrderResultOpen = false
  state.firstOrderConclusionOpen = false
}

function updateListPage(listState: ListState | SampleListState, step: number, total: number): void {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  listState.currentPage = Math.min(totalPages, Math.max(1, listState.currentPage + step))
}

function findRevisionTaskByFirstSample(task: FirstSampleTaskRecord) {
  return listRevisionTasks().find((revision) =>
    revision.projectId === task.projectId &&
    (
      revision.upstreamObjectId === task.firstSampleTaskId ||
      revision.upstreamObjectCode === task.firstSampleTaskCode
    ),
  )
}

function buildRevisionDraftFromFirstSampleRework(
  task: FirstSampleTaskRecord,
  operatorName: string,
  fitSummary: string,
  artworkSummary: string,
): RevisionCreateDraft {
  const defaults = getProjectDefaultValues(task.projectId)
  const issueSummary = [
    '首版样衣验收结论为需改版。',
    fitSummary ? `版型问题：${fitSummary}` : '',
    artworkSummary ? `花型问题：${artworkSummary}` : '',
    task.sampleCode ? `结果编号：${task.sampleCode}` : '',
  ].filter(Boolean).join(' ')
  const scopeCodes = artworkSummary ? ['PATTERN', 'PRINT'] : ['PATTERN']
  return {
    ...initialRevisionCreateDraft(),
    bindingMode: 'project',
    sourceType: '首版样衣返改',
    projectId: task.projectId,
    styleId: defaults.styleId,
    upstreamModule: '首版样衣打样',
    upstreamObjectType: '首版样衣打样任务',
    upstreamObjectId: task.firstSampleTaskId,
    upstreamObjectCode: task.firstSampleTaskCode,
    title: `首版样衣需改版-${task.firstSampleTaskCode}`,
    ownerName: task.ownerName || defaults.ownerName || operatorName,
    note: `由首版样衣任务 ${task.firstSampleTaskCode} 验收需改版创建。`,
    scopeCodes,
    issueSummary,
    evidenceSummary: [
      '来源：首版样衣验收结论。',
      fitSummary ? `版型确认：${fitSummary}` : '',
      artworkSummary ? `花型确认：${artworkSummary}` : '',
    ].filter(Boolean).join(' '),
    evidenceImageUrls: [...(task.sampleImageIds || [])],
  }
}

function openRevisionCreateFromFirstSampleRework(task: FirstSampleTaskRecord, operatorName: string): void {
  const existing = findRevisionTaskByFirstSample(task)
  if (existing) {
    appStore.navigate(`/pcs/patterns/revision/${encodeURIComponent(existing.revisionTaskId)}`)
    return
  }
  state.revisionCreateOpen = true
  state.revisionCreateDraft = buildRevisionDraftFromFirstSampleRework(
    task,
    operatorName,
    task.fitConfirmationSummary || task.productionReadinessNote || task.note || '首版样衣验收需改版。',
    task.artworkConfirmationSummary,
  )
  setNotice('已根据首版样衣需改版结论预填改版任务，请确认后创建。')
}

function advanceFirstSampleTask(taskId: string): void {
  const task = getFirstSampleTaskById(taskId)
  if (!task) return
  if (task.status === '草稿' || task.status === '待处理') {
    state.firstSampleStartOpen = true
    state.firstSampleStartTaskId = taskId
    state.firstSampleStartDraft = {
      ...initialFirstSampleStartDraft(),
      operatorName: task.ownerName || '当前用户',
    }
    return
  }
  if (task.status === '打样中') {
    state.firstSampleResultOpen = true
    state.firstSampleResultTaskId = taskId
    state.firstSampleResultDraft = {
      ...initialFirstSampleResultDraft(),
      sampleCode: task.sampleCode || `FS-RESULT-${task.firstSampleTaskCode.slice(-3)}`,
      submittedBy: task.ownerName || '当前用户',
      sampleImageIds: task.sampleImageIds || [],
    }
    return
  }
  if (task.status === '待确认') {
    state.firstSampleAcceptanceOpen = true
    state.firstSampleAcceptanceTaskId = taskId
    state.firstSampleAcceptanceResult = '通过'
    state.firstSampleAcceptanceNote = ''
    state.firstSampleAcceptanceArtworkSummary = task.artworkConfirmationSummary || ''
    state.firstSampleAcceptanceConfirmedBy = task.ownerName || '当前用户'
    state.firstSampleAcceptanceConfirmedAt = nowText()
    return
  }
  if (task.status === '需改版') {
    openRevisionCreateFromFirstSampleRework(task, task.ownerName || '当前用户')
    return
  }
  setNotice(`首版样衣任务 ${task.firstSampleTaskCode} 当前无需继续推进。`)
}

function advanceFirstOrderTask(taskId: string): void {
  const task = getFirstOrderSampleTaskById(taskId)
  if (!task) return
  if (task.status === '草稿' || task.status === '待处理') {
    state.firstOrderStartOpen = true
    state.firstOrderStartTaskId = taskId
    state.firstOrderStartDraft = {
      ...initialFirstOrderStartDraft(),
      operatorName: task.ownerName || '当前用户',
    }
    return
  }
  if (task.status === '打样中') {
    state.firstOrderResultOpen = true
    state.firstOrderResultTaskId = taskId
    state.firstOrderResultDraft = buildFirstOrderResultDraft(task)
    return
  }
  if (task.status === '待确认') {
    state.firstOrderConclusionOpen = true
    state.firstOrderConclusionTaskId = taskId
    state.firstOrderConclusionResult = '通过'
    state.firstOrderConclusionNote = ''
    state.firstOrderConclusionConfirmedBy = task.confirmedBy || task.ownerName || '当前用户'
    state.firstOrderConclusionConfirmedAt = nowText()
    return
  }
  setNotice(`首单样衣任务 ${task.firstOrderSampleTaskCode} 当前无需继续推进。`)
}

function submitRevisionCreate(): void {
  const draft = state.revisionCreateDraft
  const projectMode = draft.bindingMode === 'project'
  const projectDefaults = projectMode && draft.projectId
    ? getProjectDefaultValues(draft.projectId)
    : { ownerName: '', styleId: '', styleCode: '', styleName: '' }
  const selectedStyle = projectMode
    ? (projectDefaults.styleId ? getStyleArchiveById(projectDefaults.styleId) : null)
    : (draft.styleId ? getStyleArchiveById(draft.styleId) : null)

  if (projectMode && !draft.projectId) {
    setNotice('请先选择商品项目。')
    return
  }
  if (!projectMode && !selectedStyle) {
    setNotice('请先选择正式款式档案。')
    return
  }
  if (!projectMode && (draft.sourceType === '测款结论返改' || draft.sourceType === '首版样衣返改')) {
    setNotice('测款结论返改和首版样衣返改必须关联商品项目。')
    return
  }
  if (!draft.issueSummary.trim()) {
    setNotice('请先填写问题点。')
    return
  }
  if (!draft.evidenceSummary.trim()) {
    setNotice('请先填写证据说明。')
    return
  }
  const result = createRevisionTask({
    projectId: projectMode ? draft.projectId : '',
    title: draft.title.trim() || '新建改版任务',
    sourceType: draft.sourceType,
    upstreamModule: draft.upstreamModule,
    upstreamObjectType: draft.upstreamObjectType,
    upstreamObjectId: draft.upstreamObjectId,
    upstreamObjectCode: draft.upstreamObjectCode,
    ownerName: draft.ownerName.trim() || projectDefaults.ownerName || '当前用户',
    priorityLevel: '中',
    dueAt: draft.dueAt.trim() || '',
    styleId: selectedStyle?.styleId || '',
    styleCode: selectedStyle?.styleCode || projectDefaults.styleCode,
    styleName: selectedStyle?.styleName || projectDefaults.styleName,
    referenceObjectType: '',
    referenceObjectId: '',
    referenceObjectCode: '',
    referenceObjectName: '',
    productStyleCode: selectedStyle?.styleCode || projectDefaults.styleCode,
    spuCode: selectedStyle?.styleCode || projectDefaults.styleCode,
    revisionScopeCodes: [...draft.scopeCodes],
    revisionScopeNames: REVISION_SCOPE_OPTIONS.filter((option) => draft.scopeCodes.includes(option.value)).map((option) => option.label),
    issueSummary: draft.issueSummary.trim(),
    evidenceSummary: draft.evidenceSummary.trim(),
    evidenceImageUrls: [...draft.evidenceImageUrls],
    note: draft.note.trim(),
    operatorName: '当前用户',
  })
  if (!result.ok) {
    setNotice(result.message)
    return
  }
  state.revisionCreateOpen = false
  state.revisionCreateDraft = initialRevisionCreateDraft()
  pushRuntimeLog('revision', result.task.revisionTaskId, '新建任务', result.task.projectId ? '已创建改版任务并同步商品项目。' : '已创建改版任务。')
  let notice = result.message
  if (draft.createPatternTask && canCreateRevisionPatternTask(draft.scopeCodes, draft.sourceType, result.task.projectId)) {
    const downstreamResult = createDownstreamTasksFromRevision(result.task.revisionTaskId, ['PRINT'])
    if (downstreamResult.successCount > 0) {
      pushRuntimeLog('revision', result.task.revisionTaskId, '创建花型任务', `已创建花型任务：${downstreamResult.createdTaskCodes.join('、')}。`)
      notice += ` 已同步创建花型任务：${downstreamResult.createdTaskCodes.join('、')}。`
    }
    if (downstreamResult.failureMessages.length > 0) {
      notice += ` 花型任务未创建：${downstreamResult.failureMessages.join('；')}。`
    }
  }
  setNotice(notice)
  appStore.navigate(`/pcs/patterns/revision/${encodeURIComponent(result.task.revisionTaskId)}`)
}

function submitPlateCreate(): void {
  const draft = state.plateCreateDraft
  const projectMode = draft.bindingMode === 'project'
  const project = projectMode && draft.projectId ? getProjectById(draft.projectId) : null
  const defaults = projectMode && draft.projectId
    ? getProjectDefaultValues(draft.projectId)
    : { ownerName: '', styleId: '', styleCode: '', styleName: '' }
  const selectedStyle = projectMode
    ? (defaults.styleId ? getStyleArchiveById(defaults.styleId) : null)
    : (draft.styleId ? getStyleArchiveById(draft.styleId) : null)

  if (projectMode && !draft.projectId) {
    setNotice('请先选择商品项目。')
    return
  }
  if (!projectMode && !selectedStyle) {
    setNotice('请先选择正式款式档案。')
    return
  }
  const result = createPlateMakingTask({
    projectId: projectMode ? draft.projectId : '',
    title: draft.title.trim() || '新建制版任务',
    sourceType: draft.sourceType,
    upstreamModule: projectMode ? '项目模板' : '款式档案',
    upstreamObjectType: projectMode ? '模板阶段' : '款式档案',
    upstreamObjectId: projectMode ? (project?.templateId || '') : (selectedStyle?.styleId || ''),
    upstreamObjectCode: projectMode ? (project?.templateVersion || '') : (selectedStyle?.styleCode || ''),
    styleId: selectedStyle?.styleId || defaults.styleId,
    styleCode: selectedStyle?.styleCode || defaults.styleCode,
    styleName: selectedStyle?.styleName || defaults.styleName,
    ownerName: draft.ownerName.trim() || defaults.ownerName || '当前用户',
    priorityLevel: '中',
    dueAt: draft.dueAt.trim() || '',
    productStyleCode: selectedStyle?.styleCode || defaults.styleCode,
    spuCode: selectedStyle?.styleCode || defaults.styleCode,
    productHistoryType: draft.productHistoryType as '未卖过' | '已卖过补纸样',
    patternMakerName: draft.patternMakerName.trim() || draft.ownerName.trim() || defaults.ownerName,
    patternArea: draft.patternArea as '印尼' | '深圳',
    urgentFlag: draft.urgentFlag,
    patternType: draft.patternType.trim() || '常规制版',
    sizeRange: draft.sizeRange.trim() || '待补充',
    note: draft.note.trim(),
    operatorName: '当前用户',
  })
  if (!result.ok) {
    setNotice(result.message)
    return
  }
  state.plateCreateOpen = false
  state.plateCreateDraft = initialPlateCreateDraft()
  pushRuntimeLog('plate', result.task.plateTaskId, '新建任务', result.task.projectId ? '已创建制版任务并同步商品项目。' : '已创建制版任务。')
  setNotice(result.message)
  appStore.navigate(`/pcs/patterns/plate-making/${encodeURIComponent(result.task.plateTaskId)}`)
}

function submitPatternCreate(): void {
  const draft = state.patternCreateDraft
  const projectMode = draft.bindingMode === 'project'
  const project = projectMode && draft.projectId ? getProjectById(draft.projectId) : null
  const defaults = projectMode && draft.projectId
    ? getProjectDefaultValues(draft.projectId)
    : { ownerName: '', styleId: '', styleCode: '', styleName: '' }
  const selectedStyle = projectMode
    ? (defaults.styleId ? getStyleArchiveById(defaults.styleId) : null)
    : (draft.styleId ? getStyleArchiveById(draft.styleId) : null)

  if (projectMode && !draft.projectId) {
    setNotice('请先选择商品项目。')
    return
  }
  if (!projectMode && !selectedStyle) {
    setNotice('请先选择正式款式档案。')
    return
  }
  const requestQty = Number(draft.requestQty)
  if (!Number.isFinite(requestQty) || requestQty <= 0) {
    setNotice('请填写有效的需求数量。')
    return
  }
  if (!draft.fabricSku.trim() && !draft.fabricName.trim()) {
    setNotice('请填写面料信息。')
    return
  }
  if (draft.demandImageIds.length === 0) {
    setNotice('请至少上传 1 张需求图片。')
    return
  }
  const selectedMember = listPatternTaskMembersByTeam(draft.assignedTeamCode).find((item) => item.memberId === draft.assignedMemberId)
  if (!selectedMember) {
    setNotice('请选择该团队下的花型师。')
    return
  }
  const result = createPatternTask({
    projectId: projectMode ? draft.projectId : '',
    title: draft.title.trim() || '新建花型任务',
    sourceType: draft.sourceType,
    upstreamModule: projectMode ? '项目模板' : '款式档案',
    upstreamObjectType: projectMode ? '模板阶段' : '款式档案',
    upstreamObjectId: projectMode ? (project?.templateId || '') : (selectedStyle?.styleId || ''),
    upstreamObjectCode: projectMode ? (project?.templateVersion || '') : (selectedStyle?.styleCode || ''),
    styleId: selectedStyle?.styleId || defaults.styleId,
    styleCode: selectedStyle?.styleCode || defaults.styleCode,
    styleName: selectedStyle?.styleName || defaults.styleName,
    ownerName: draft.ownerName.trim() || defaults.ownerName || '当前用户',
    priorityLevel: '中',
    dueAt: draft.dueAt.trim() || '',
    productStyleCode: selectedStyle?.styleCode || defaults.styleCode,
    spuCode: selectedStyle?.styleCode || defaults.styleCode,
    demandSourceType: draft.demandSourceType,
    demandSourceRefId: project?.projectId || selectedStyle?.styleId || '',
    demandSourceRefCode: project?.projectCode || selectedStyle?.styleCode || '',
    demandSourceRefName: project?.projectName || selectedStyle?.styleName || '',
    processType: draft.processType,
    requestQty,
    fabricSku: draft.fabricSku.trim(),
    fabricName: draft.fabricName.trim(),
    demandImageIds: [...draft.demandImageIds],
    patternSpuCode: selectedStyle?.styleCode || defaults.styleCode,
    assignedTeamCode: draft.assignedTeamCode,
    assignedMemberId: draft.assignedMemberId,
    patternCategoryCode: draft.patternCategoryCode.trim(),
    patternStyleTags: parseTagsText(draft.patternStyleTagsText),
    hotSellerFlag: draft.hotSellerFlag,
    artworkType: draft.processType === '烫画' ? '烫画' : '印花',
    patternMode: draft.processType,
    artworkName: draft.artworkName.trim() || draft.title.trim() || '新建花型',
    note: draft.note.trim(),
    operatorName: '当前用户',
  })
  if (!result.ok) {
    setNotice(result.message)
    return
  }
  state.patternCreateOpen = false
  state.patternCreateDraft = initialPatternCreateDraft()
  pushRuntimeLog('pattern', result.task.patternTaskId, '新建任务', result.task.projectId ? '已创建花型任务并同步商品项目。' : '已创建花型任务。')
  setNotice(result.message)
  appStore.navigate(`/pcs/patterns/colors/${encodeURIComponent(result.task.patternTaskId)}`)
}

function submitFirstSampleCreate(): void {
  const draft = state.firstSampleCreateDraft
  if (!draft.projectId) {
    setNotice('请先选择商品项目。')
    return
  }
  if (!draft.title.trim()) {
    setNotice('请填写任务标题。')
    return
  }
  if (!draft.ownerName.trim()) {
    setNotice('请填写负责人。')
    return
  }
  if (!draft.sourceTechPackVersionId.trim()) {
    setNotice('请填写来源技术包版本ID。')
    return
  }
  if (!draft.factoryId || !draft.factoryName.trim()) {
    setNotice('请选择打样工厂。')
    return
  }
  if (!draft.targetSite) {
    setNotice('请选择打样区域。')
    return
  }
  if (!draft.sampleMaterialMode) {
    setNotice('请选择样衣材质模式。')
    return
  }
  if (!draft.samplePurpose) {
    setNotice('请选择样衣用途。')
    return
  }
  const project = getProjectById(draft.projectId)
  const result = createFirstSampleTaskWithProjectRelation({
    projectId: draft.projectId,
    title: draft.title.trim(),
    sourceType: '人工创建',
    ownerName: draft.ownerName.trim() || project?.ownerName || '当前用户',
    priorityLevel: '中',
    sourceTechPackVersionId: draft.sourceTechPackVersionId.trim(),
    sourceTechPackVersionCode: draft.sourceTechPackVersionCode.trim(),
    sourceTechPackVersionLabel: draft.sourceTechPackVersionLabel.trim(),
    factoryId: draft.factoryId,
    factoryName: draft.factoryName.trim(),
    targetSite: draft.targetSite || '深圳',
    sampleMaterialMode: draft.sampleMaterialMode,
    samplePurpose: draft.samplePurpose,
    note: draft.note.trim(),
    operatorName: '当前用户',
  })
  if (!result.ok) {
    setNotice(result.message)
    return
  }
  state.firstSampleCreateOpen = false
  state.firstSampleCreateDraft = initialSampleCreateDraft()
  pushRuntimeLog('firstSample', result.task.firstSampleTaskId, '新建任务', '已创建首版样衣打样任务并写入项目关系。')
  setNotice(result.message)
  appStore.navigate(`/pcs/samples/first-sample/${encodeURIComponent(result.task.firstSampleTaskId)}`)
}

function submitFirstSampleStart(): void {
  const task = getFirstSampleTaskById(state.firstSampleStartTaskId)
  if (!task) {
    setNotice('未找到首版样衣打样任务。')
    return
  }
  const draft = state.firstSampleStartDraft
  if (!draft.operatorName.trim()) {
    setNotice('请填写开始人。')
    return
  }
  if (!draft.startedAt.trim()) {
    setNotice('请填写开始时间。')
    return
  }
  if (!draft.planFinishAt.trim()) {
    setNotice('请填写计划完成时间。')
    return
  }
  if (!draft.startNote.trim()) {
    setNotice('请填写开始说明。')
    return
  }
  const result = updateFirstSampleTaskDetailAndSync(task.firstSampleTaskId, {
    status: '打样中',
    note: `${task.note ? `${task.note}；` : ''}开始首版打样：${draft.startNote.trim()}`,
  }, draft.operatorName.trim())
  if (result.task) {
    state.firstSampleDetailDraftTaskId = result.task.firstSampleTaskId
    state.firstSampleDetailDraft = buildFirstSampleDetailDraft(result.task)
  }
  state.firstSampleStartOpen = false
  pushRuntimeLog('firstSample', task.firstSampleTaskId, '开始打样', `开始人：${draft.operatorName.trim()}；开始时间：${draft.startedAt}；计划完成：${draft.planFinishAt}；${draft.startNote.trim()}`)
  setNotice(result.ok ? `首版样衣任务 ${task.firstSampleTaskCode} 已开始打样。` : result.message)
}

function submitFirstSampleResult(): void {
  const task = getFirstSampleTaskById(state.firstSampleResultTaskId)
  if (!task) {
    setNotice('未找到首版样衣打样任务。')
    return
  }
  const draft = state.firstSampleResultDraft
  const sampleImageIds = draft.sampleImageIds
  if (!draft.sampleCode.trim()) {
    setNotice('请填写结果编号。')
    return
  }
  if (!draft.submittedBy.trim()) {
    setNotice('请填写提交人。')
    return
  }
  if (!draft.completedAt.trim()) {
    setNotice('请填写完成时间。')
    return
  }
  if (sampleImageIds.length === 0) {
    setNotice('请上传样衣图片。')
    return
  }
  if (!draft.resultNote.trim()) {
    setNotice('请填写提交说明。')
    return
  }
  const result = updateFirstSampleTaskDetailAndSync(task.firstSampleTaskId, {
    status: '待确认',
    sampleCode: draft.sampleCode.trim(),
    sampleImageIds,
    note: `${task.note ? `${task.note}；` : ''}提交首版打样结果：${draft.sampleCode.trim()}，${draft.resultNote.trim()}`,
  }, draft.submittedBy.trim())
  if (result.task) {
    state.firstSampleDetailDraftTaskId = result.task.firstSampleTaskId
    state.firstSampleDetailDraft = buildFirstSampleDetailDraft(result.task)
  }
  state.firstSampleResultOpen = false
  pushRuntimeLog('firstSample', task.firstSampleTaskId, '提交打样结果', `结果编号：${draft.sampleCode.trim()}；提交人：${draft.submittedBy.trim()}；完成时间：${draft.completedAt}。${draft.resultNote.trim()}`)
  setNotice(result.ok ? `首版样衣任务 ${task.firstSampleTaskCode} 已提交打样结果。` : result.message)
}

function submitFirstOrderCreate(): void {
  const draft = state.firstOrderCreateDraft
  if (!draft.projectId) {
    setNotice('请先选择商品项目。')
    return
  }
  if (!draft.title.trim()) {
    setNotice('请填写任务标题。')
    return
  }
  if (!draft.ownerName.trim()) {
    setNotice('请填写负责人。')
    return
  }
  if (!draft.factoryId || !draft.factoryName.trim()) {
    setNotice('请选择打样工厂。')
    return
  }
  if (!draft.targetSite) {
    setNotice('请选择打样区域。')
    return
  }
  if (!draft.sampleChainMode) {
    setNotice('请选择首单确认方式。')
    return
  }
  if (!draft.patternVersion.trim()) {
    setNotice('请填写制版版次。')
    return
  }
  if (!draft.finalReferenceNote.trim()) {
    setNotice('请填写最终参照说明。')
    return
  }
  if (draft.sampleChainMode === '复用首版结论' && getFirstOrderSourceFirstSampleLabel(draft.projectId).startsWith('未找到')) {
    setNotice('当前商品项目未找到可复用的首版样衣结果，不能创建复用首版结论的首单任务。')
    return
  }
  const samplePlanLines = parseFirstOrderSamplePlanLines(draft.samplePlanLinesText, [])
  if (samplePlanLines.length === 0) {
    setNotice('请填写样衣计划行。')
    return
  }
  const invalidLine = samplePlanLines.find((line) => !line.sampleRole || !line.materialMode || !Number.isFinite(line.quantity) || line.quantity <= 0)
  if (invalidLine) {
    setNotice('样衣计划行必须包含样衣角色、材质模式和大于 0 的数量。')
    return
  }
  const missingReferenceFactoryLine = samplePlanLines.find((line) => line.sampleRole === '工厂参照确认' && !line.targetFactoryName.trim())
  if (missingReferenceFactoryLine) {
    setNotice('工厂参照确认计划行必须选择参照接收工厂。')
    return
  }
  const project = getProjectById(draft.projectId)
  const result = createFirstOrderSampleTaskWithProjectRelation({
    projectId: draft.projectId,
    title: draft.title.trim(),
    sourceType: '人工创建',
    ownerName: draft.ownerName.trim() || project?.ownerName || '当前用户',
    priorityLevel: '中',
    factoryId: draft.factoryId,
    factoryName: draft.factoryName.trim(),
    targetSite: draft.targetSite || '深圳',
    patternVersion: draft.patternVersion.trim(),
    artworkVersion: draft.artworkVersion.trim(),
    sampleChainMode: draft.sampleChainMode,
    specialSceneReasonCodes: [...draft.specialSceneReasonCodes],
    productionReferenceRequiredFlag: draft.productionReferenceRequiredFlag,
    chinaReviewRequiredFlag: draft.chinaReviewRequiredFlag,
    correctFabricRequiredFlag: draft.correctFabricRequiredFlag,
    samplePlanLines,
    finalReferenceNote: draft.finalReferenceNote.trim(),
    note: draft.note.trim(),
    operatorName: '当前用户',
  })
  if (!result.ok) {
    setNotice(result.message)
    return
  }
  state.firstOrderCreateOpen = false
  state.firstOrderCreateDraft = initialFirstOrderCreateDraft()
  pushRuntimeLog('firstOrder', result.task.firstOrderSampleTaskId, '新建任务', '已创建首单样衣打样任务并写入项目关系。')
  setNotice(result.message)
  appStore.navigate(`/pcs/samples/first-order/${encodeURIComponent(result.task.firstOrderSampleTaskId)}`)
}

function submitFirstOrderStart(): void {
  const task = getFirstOrderSampleTaskById(state.firstOrderStartTaskId)
  if (!task) {
    setNotice('未找到首单样衣打样任务。')
    return
  }
  const draft = state.firstOrderStartDraft
  if (!draft.operatorName.trim()) {
    setNotice('请填写开始人。')
    return
  }
  if (!draft.startedAt.trim()) {
    setNotice('请填写开始时间。')
    return
  }
  if (!draft.planFinishAt.trim()) {
    setNotice('请填写计划完成时间。')
    return
  }
  if (!draft.factoryConfirmNote.trim()) {
    setNotice('请填写工厂确认说明。')
    return
  }
  const result = updateFirstOrderSampleTaskDetailAndSync(task.firstOrderSampleTaskId, {
    status: '打样中',
    note: `${task.note ? `${task.note}；` : ''}开始首单：${draft.factoryConfirmNote.trim()}`,
  }, draft.operatorName.trim())
  if (result.task) {
    state.firstOrderDetailDraftTaskId = result.task.firstOrderSampleTaskId
    state.firstOrderDetailDraft = buildFirstOrderDetailDraft(result.task)
  }
  state.firstOrderStartOpen = false
  pushRuntimeLog('firstOrder', task.firstOrderSampleTaskId, '开始首单', `开始人：${draft.operatorName.trim()}；开始时间：${draft.startedAt}；计划完成：${draft.planFinishAt}；${draft.factoryConfirmNote.trim()}`)
  setNotice(result.ok ? `首单样衣任务 ${task.firstOrderSampleTaskCode} 已开始打样。` : result.message)
}

function submitFirstOrderResult(): void {
  const task = getFirstOrderSampleTaskById(state.firstOrderResultTaskId)
  if (!task) {
    setNotice('未找到首单样衣打样任务。')
    return
  }
  const draft = state.firstOrderResultDraft
  if (!draft.sampleCode.trim()) {
    setNotice('请填写结果编号。')
    return
  }
  if (!draft.submittedBy.trim()) {
    setNotice('请填写提交人。')
    return
  }
  if (!draft.completedAt.trim()) {
    setNotice('请填写完成时间。')
    return
  }
  if (!draft.finalReferenceNote.trim()) {
    setNotice('请填写最终参照说明。')
    return
  }
  const samplePlanLines = parseFirstOrderSamplePlanLines(draft.samplePlanLinesText, task.samplePlanLines)
  if (samplePlanLines.length === 0) {
    setNotice('请填写样衣计划行结果。')
    return
  }
  const invalidLine = samplePlanLines.find((line) => !line.sampleRole || !line.materialMode || !Number.isFinite(line.quantity) || line.quantity <= 0)
  if (invalidLine) {
    setNotice('样衣计划行结果必须包含样衣角色、材质模式和大于 0 的数量。')
    return
  }
  const missingReferenceFactoryLine = samplePlanLines.find((line) => line.sampleRole === '工厂参照确认' && !line.targetFactoryName.trim())
  if (missingReferenceFactoryLine) {
    setNotice('工厂参照确认计划行必须选择参照接收工厂。')
    return
  }
  const result = updateFirstOrderSampleTaskDetailAndSync(task.firstOrderSampleTaskId, {
    status: '待确认',
    sampleCode: draft.sampleCode.trim(),
    samplePlanLines: samplePlanLines.map((line) => ({
      ...line,
      linkedSampleCode: line.linkedSampleCode || draft.sampleCode.trim(),
      status: line.status === '待确认' ? '已确认' : line.status,
    })),
    finalReferenceNote: draft.finalReferenceNote.trim(),
    confirmedAt: draft.completedAt.trim(),
    confirmedBy: draft.submittedBy.trim(),
    note: `${task.note ? `${task.note}；` : ''}提交首单结果：${draft.sampleCode.trim()}${draft.resultNote.trim() ? `，${draft.resultNote.trim()}` : ''}`,
  }, draft.submittedBy.trim())
  if (result.task) {
    state.firstOrderDetailDraftTaskId = result.task.firstOrderSampleTaskId
    state.firstOrderDetailDraft = buildFirstOrderDetailDraft(result.task)
  }
  state.firstOrderResultOpen = false
  pushRuntimeLog('firstOrder', task.firstOrderSampleTaskId, '提交首单结果', `结果编号：${draft.sampleCode.trim()}；提交人：${draft.submittedBy.trim()}；完成时间：${draft.completedAt}。${draft.resultNote.trim() || '已提交首单打样结果。'}`)
  setNotice(result.ok ? `首单样衣任务 ${task.firstOrderSampleTaskCode} 已提交首单结果。` : result.message)
}

function generateRevisionTechPack(taskId: string): void {
  const task = getRevisionTaskById(taskId)
  if (!task) return
  try {
    const result = generateTechPackVersionFromRevisionTask(taskId, '当前用户')
    pushRuntimeLog('revision', taskId, result.logType, `已处理技术包 ${result.record.technicalVersionCode}。`)
    setNotice(`改版任务 ${task.revisionTaskCode} 已生成改版技术包版本 ${result.record.technicalVersionCode}。`)
  } catch (error) {
    setNotice(error instanceof Error ? error.message : '建立技术包失败。')
  }
}

function generatePlateTechPack(taskId: string): void {
  const task = getPlateMakingTaskById(taskId)
  if (!task) return
  try {
    const result = generateTechPackVersionFromPlateTask(taskId, '当前用户')
    pushRuntimeLog('plate', taskId, result.logType, `已处理技术包 ${result.record.technicalVersionCode}。`)
    setNotice(`制版任务 ${task.plateTaskCode} 已建立技术包版本 ${result.record.technicalVersionCode}。`)
  } catch (error) {
    setNotice(error instanceof Error ? error.message : '建立技术包失败。')
  }
}

function generatePatternTechPack(taskId: string): void {
  const task = getPatternTaskById(taskId)
  if (!task) return
  try {
    const result = generateTechPackVersionFromPatternTask(taskId, '当前用户')
    pushRuntimeLog('pattern', taskId, result.logType, `已处理技术包 ${result.record.technicalVersionCode}。`)
    setNotice(
      result.logType === '花型写入技术包'
        ? `花型任务 ${task.patternTaskCode} 已写入技术包花型 ${result.record.technicalVersionCode}。`
        : `花型任务 ${task.patternTaskCode} 已生成花型新版本 ${result.record.technicalVersionCode}。`,
    )
  } catch (error) {
    setNotice(error instanceof Error ? error.message : '处理技术包花型失败。')
  }
}

export function renderPcsRevisionTaskPage(): string {
  syncExistingProjectEngineeringTaskNodes('系统同步')
  return renderRevisionListPage()
}

export function renderPcsRevisionTaskDetailPage(revisionTaskId: string): string {
  return renderRevisionDetailPage(revisionTaskId)
}

export function renderPcsPlateMakingTaskPage(): string {
  syncExistingProjectEngineeringTaskNodes('系统同步')
  return renderPlateListPage()
}

export function renderPcsPlateMakingTaskDetailPage(plateTaskId: string): string {
  return renderPlateDetailPage(plateTaskId)
}

export function renderPcsPatternTaskPage(): string {
  syncExistingProjectEngineeringTaskNodes('系统同步')
  return renderPatternListPage()
}

export function renderPcsPatternTaskDetailPage(patternTaskId: string): string {
  return renderPatternDetailPage(patternTaskId)
}

export function renderPcsFirstSampleTaskPage(): string {
  return renderFirstSampleListPage()
}

export function renderPcsFirstSampleTaskDetailPage(firstSampleTaskId: string): string {
  return renderFirstSampleDetailPage(firstSampleTaskId)
}

export function renderPcsFirstOrderSampleTaskPage(): string {
  return renderFirstOrderListPage()
}

export function renderPcsFirstOrderSampleTaskDetailPage(firstOrderSampleTaskId: string): string {
  return renderFirstOrderDetailPage(firstOrderSampleTaskId)
}

export function handlePcsEngineeringTaskInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-engineering-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsEngineeringField
  if (!field) return false

  if (fieldNode instanceof HTMLInputElement && fieldNode.type === 'file') {
    const files = Array.from(fieldNode.files || [])
    if (files.length === 0) return true
    const lineIndex = Number(fieldNode.dataset.lineIndex || '-1')
    if (field === 'revision-create-evidence-images') {
      state.revisionCreateDraft.evidenceImageUrls = [
        ...state.revisionCreateDraft.evidenceImageUrls,
        ...files.filter((file) => file.type.startsWith('image/')).map((file) => URL.createObjectURL(file)),
      ]
      fieldNode.value = ''
      return true
    }
    if (field === 'revision-material-line-image' && lineIndex >= 0) {
      const imageUrl = files.find((file) => file.type.startsWith('image/'))
      if (imageUrl) state.revisionDetailDraft.materialAdjustmentLines[lineIndex]!.materialImageId = URL.createObjectURL(imageUrl)
      fieldNode.value = ''
      return true
    }
    if (field === 'plate-material-line-image' && lineIndex >= 0) {
      const imageUrl = files.find((file) => file.type.startsWith('image/'))
      if (imageUrl) state.plateDetailDraft.materialRequirementLines[lineIndex]!.materialImageId = URL.createObjectURL(imageUrl)
      fieldNode.value = ''
      return true
    }
    if (field === 'plate-pattern-line-image' && lineIndex >= 0) {
      const imageUrl = files.find((file) => file.type.startsWith('image/'))
      if (imageUrl) state.plateDetailDraft.patternImageLineItems[lineIndex]!.imageId = URL.createObjectURL(imageUrl)
      fieldNode.value = ''
      return true
    }
    const imageUrls = files.filter((file) => file.type.startsWith('image/')).map((file) => URL.createObjectURL(file))
    if (imageUrls.length > 0 && appendImageValues(field, imageUrls)) {
      fieldNode.value = ''
      return true
    }
    const fileIds = files.map((file) => buildMockFileId(file))
    if (appendFileValues(field, fileIds)) {
      fieldNode.value = ''
      return true
    }
    fieldNode.value = ''
    return true
  }

  if (fieldNode instanceof HTMLInputElement && fieldNode.type === 'checkbox') {
    if (field === 'revision-detail-live-retest-required') {
      state.revisionDetailDraft.liveRetestRequired = fieldNode.checked
      state.revisionDetailDraft.liveRetestStatus = fieldNode.checked && state.revisionDetailDraft.liveRetestStatus === '不需要'
        ? '待回直播验证'
        : state.revisionDetailDraft.liveRetestStatus
      return true
    }
    if (field === 'pattern-create-hot-flag') {
      state.patternCreateDraft.hotSellerFlag = fieldNode.checked
      return true
    }
    if (field === 'pattern-detail-hot-flag') {
      state.patternDetailDraft.hotSellerFlag = fieldNode.checked
      return true
    }
    if (field === 'first-sample-detail-reuse-flag') {
      state.firstSampleDetailDraft.reuseAsFirstOrderBasisFlag = fieldNode.checked
      return true
    }
  }

  if (
    fieldNode instanceof HTMLInputElement
    || fieldNode instanceof HTMLTextAreaElement
    || fieldNode instanceof HTMLSelectElement
  ) {
    const module = fieldNode.dataset.pcsEngineeringLineModule
    const index = Number(fieldNode.dataset.lineIndex || '-1')
    const key = fieldNode.dataset.lineKey || ''
    if (module && index >= 0 && key) {
      const value = fieldNode.value
      if (module === 'revision-material') {
        updateRevisionMaterialLine(index, key, value)
        return true
      }
      if (module === 'plate-material') {
        updatePlateMaterialLine(index, key, value)
        return true
      }
      if (module === 'plate-pattern-image') {
        updatePlatePatternImageLine(index, key, value)
        return true
      }
    }
    if (field === 'first-order-create-plan-line' && index >= 0 && key) {
      state.firstOrderCreateDraft.samplePlanLinesText = updateFirstOrderSamplePlanLineText(
        state.firstOrderCreateDraft.samplePlanLinesText,
        createDefaultSamplePlanLines(state.firstOrderCreateDraft.sampleChainMode),
        index,
        key as keyof SamplePlanLine,
        fieldNode.value,
      )
      return true
    }
    if (field === 'first-order-result-plan-line' && index >= 0 && key) {
      state.firstOrderResultDraft.samplePlanLinesText = updateFirstOrderSamplePlanLineText(
        state.firstOrderResultDraft.samplePlanLinesText,
        [],
        index,
        key as keyof SamplePlanLine,
        fieldNode.value,
      )
      return true
    }
  }

  if (field === 'revision-search' && fieldNode instanceof HTMLInputElement) { state.revisionList.search = fieldNode.value; state.revisionList.currentPage = 1; return true }
  if (field === 'revision-status' && fieldNode instanceof HTMLSelectElement) { state.revisionList.status = fieldNode.value; state.revisionList.currentPage = 1; return true }
  if (field === 'revision-owner' && fieldNode instanceof HTMLSelectElement) { state.revisionList.owner = fieldNode.value; state.revisionList.currentPage = 1; return true }
  if (field === 'revision-source' && fieldNode instanceof HTMLSelectElement) { state.revisionList.source = fieldNode.value; state.revisionList.currentPage = 1; return true }
  if (field === 'plate-search' && fieldNode instanceof HTMLInputElement) { state.plateList.search = fieldNode.value; state.plateList.currentPage = 1; return true }
  if (field === 'plate-status' && fieldNode instanceof HTMLSelectElement) { state.plateList.status = fieldNode.value; state.plateList.currentPage = 1; return true }
  if (field === 'plate-owner' && fieldNode instanceof HTMLSelectElement) { state.plateList.owner = fieldNode.value; state.plateList.currentPage = 1; return true }
  if (field === 'plate-source' && fieldNode instanceof HTMLSelectElement) { state.plateList.source = fieldNode.value; state.plateList.currentPage = 1; return true }
  if (field === 'pattern-search' && fieldNode instanceof HTMLInputElement) { state.patternList.search = fieldNode.value; state.patternList.currentPage = 1; return true }
  if (field === 'pattern-status' && fieldNode instanceof HTMLSelectElement) { state.patternList.status = fieldNode.value; state.patternList.currentPage = 1; return true }
  if (field === 'pattern-owner' && fieldNode instanceof HTMLSelectElement) { state.patternList.owner = fieldNode.value; state.patternList.currentPage = 1; return true }
  if (field === 'pattern-source' && fieldNode instanceof HTMLSelectElement) { state.patternList.source = fieldNode.value; state.patternList.currentPage = 1; return true }
  if (field === 'first-sample-search' && fieldNode instanceof HTMLInputElement) { state.firstSampleList.search = fieldNode.value; state.firstSampleList.currentPage = 1; return true }
  if (field === 'first-sample-status' && fieldNode instanceof HTMLSelectElement) { state.firstSampleList.status = fieldNode.value; state.firstSampleList.currentPage = 1; return true }
  if (field === 'first-sample-owner' && fieldNode instanceof HTMLSelectElement) { state.firstSampleList.owner = fieldNode.value; state.firstSampleList.currentPage = 1; return true }
  if (field === 'first-sample-source' && fieldNode instanceof HTMLSelectElement) { state.firstSampleList.source = fieldNode.value; state.firstSampleList.currentPage = 1; return true }
  if (field === 'first-sample-site' && fieldNode instanceof HTMLSelectElement) { state.firstSampleList.site = fieldNode.value; state.firstSampleList.currentPage = 1; return true }
  if (field === 'first-order-search' && fieldNode instanceof HTMLInputElement) { state.firstOrderList.search = fieldNode.value; state.firstOrderList.currentPage = 1; return true }
  if (field === 'first-order-status' && fieldNode instanceof HTMLSelectElement) { state.firstOrderList.status = fieldNode.value; state.firstOrderList.currentPage = 1; return true }
  if (field === 'first-order-owner' && fieldNode instanceof HTMLSelectElement) { state.firstOrderList.owner = fieldNode.value; state.firstOrderList.currentPage = 1; return true }
  if (field === 'first-order-source' && fieldNode instanceof HTMLSelectElement) { state.firstOrderList.source = fieldNode.value; state.firstOrderList.currentPage = 1; return true }
  if (field === 'first-order-site' && fieldNode instanceof HTMLSelectElement) { state.firstOrderList.site = fieldNode.value; state.firstOrderList.currentPage = 1; return true }

  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLTextAreaElement || fieldNode instanceof HTMLSelectElement) {
    const value = fieldNode.value
    switch (field) {
      case 'revision-create-binding-mode':
        state.revisionCreateDraft.bindingMode = value as TaskBindingMode
        state.revisionCreateDraft.projectId = ''
        state.revisionCreateDraft.styleId = ''
        state.revisionCreateDraft.upstreamModule = ''
        state.revisionCreateDraft.upstreamObjectType = ''
        state.revisionCreateDraft.upstreamObjectId = ''
        state.revisionCreateDraft.upstreamObjectCode = ''
        state.revisionCreateDraft.createPatternTask = false
        if (
          value === 'style' &&
          (state.revisionCreateDraft.sourceType === '测款结论返改' || state.revisionCreateDraft.sourceType === '首版样衣返改')
        ) {
          state.revisionCreateDraft.sourceType = '既有商品改款'
        }
        return true
      case 'revision-create-source-type':
        state.revisionCreateDraft.sourceType = value as RevisionTaskSourceType
        state.revisionCreateDraft.projectId = ''
        state.revisionCreateDraft.styleId = ''
        state.revisionCreateDraft.ownerName = ''
        state.revisionCreateDraft.upstreamModule = ''
        state.revisionCreateDraft.upstreamObjectType = ''
        state.revisionCreateDraft.upstreamObjectId = ''
        state.revisionCreateDraft.upstreamObjectCode = ''
        state.revisionCreateDraft.createPatternTask = false
        return true
      case 'revision-create-project': {
        const projectChanged = state.revisionCreateDraft.projectId !== value
        state.revisionCreateDraft.projectId = value
        const defaults = getProjectDefaultValues(value)
        state.revisionCreateDraft.ownerName = defaults.ownerName
        state.revisionCreateDraft.styleId = defaults.styleId
        if (projectChanged) {
          state.revisionCreateDraft.upstreamModule = ''
          state.revisionCreateDraft.upstreamObjectType = ''
          state.revisionCreateDraft.upstreamObjectId = ''
          state.revisionCreateDraft.upstreamObjectCode = ''
        }
        state.revisionCreateDraft.createPatternTask = canCreateRevisionPatternTask(
          state.revisionCreateDraft.scopeCodes,
          state.revisionCreateDraft.sourceType,
          value,
        )
        return true
      }
      case 'revision-create-style-id': {
        state.revisionCreateDraft.styleId = value
        return true
      }
      case 'revision-create-owner': state.revisionCreateDraft.ownerName = value; return true
      case 'revision-create-title': state.revisionCreateDraft.title = value; return true
      case 'revision-create-due-at': state.revisionCreateDraft.dueAt = fromDateTimeLocalValue(value); return true
      case 'revision-create-issue-summary': state.revisionCreateDraft.issueSummary = value; return true
      case 'revision-create-evidence-summary': state.revisionCreateDraft.evidenceSummary = value; return true
      case 'revision-create-note': state.revisionCreateDraft.note = value; return true
      case 'revision-detail-participants': state.revisionDetailDraft.participantNamesText = value; return true
      case 'revision-detail-version': state.revisionDetailDraft.revisionVersion = value; return true
      case 'revision-detail-base-style-code': state.revisionDetailDraft.baseStyleCode = value; return true
      case 'revision-detail-base-style-name': state.revisionDetailDraft.baseStyleName = value; return true
      case 'revision-detail-target-style-code': state.revisionDetailDraft.targetStyleCodeCandidate = value; return true
      case 'revision-detail-target-style-name': state.revisionDetailDraft.targetStyleNameCandidate = value; return true
      case 'revision-detail-sample-qty': state.revisionDetailDraft.sampleQty = value; return true
      case 'revision-detail-style-preference': state.revisionDetailDraft.stylePreference = value; return true
      case 'revision-detail-pattern-maker-name': state.revisionDetailDraft.patternMakerName = value; return true
      case 'revision-detail-suggestion': state.revisionDetailDraft.revisionSuggestionRichText = value; return true
      case 'revision-detail-paper-print-at': state.revisionDetailDraft.paperPrintAt = fromDateTimeLocalValue(value); return true
      case 'revision-detail-delivery-address': state.revisionDetailDraft.deliveryAddress = value; return true
      case 'revision-detail-pattern-area': state.revisionDetailDraft.patternArea = value; return true
      case 'revision-detail-new-pattern-spu': state.revisionDetailDraft.newPatternSpuCode = value; return true
      case 'revision-detail-pattern-change-note': state.revisionDetailDraft.patternChangeNote = value; return true
      case 'revision-detail-live-retest-status': state.revisionDetailDraft.liveRetestStatus = value as RevisionTaskLiveRetestStatus; return true
      case 'revision-detail-live-retest-relations': state.revisionDetailDraft.liveRetestRelationIdsText = value; return true
      case 'revision-detail-live-retest-summary': state.revisionDetailDraft.liveRetestSummary = value; return true
      case 'plate-create-binding-mode':
        state.plateCreateDraft.bindingMode = value as TaskBindingMode
        state.plateCreateDraft.projectId = ''
        state.plateCreateDraft.styleId = ''
        state.plateCreateDraft.productStyleCode = ''
        state.plateCreateDraft.sourceType = value === 'project' ? '项目模板阶段' : '人工创建'
        return true
      case 'plate-create-source-type':
        state.plateCreateDraft.sourceType = value as PlateMakingTaskSourceType
        return true
      case 'plate-create-project': {
        state.plateCreateDraft.projectId = value
        const defaults = getProjectDefaultValues(value)
        state.plateCreateDraft.ownerName = defaults.ownerName
        state.plateCreateDraft.styleId = defaults.styleId
        state.plateCreateDraft.productStyleCode = defaults.styleCode
        return true
      }
      case 'plate-create-style-id': {
        state.plateCreateDraft.styleId = value
        state.plateCreateDraft.productStyleCode = getStyleArchiveById(value)?.styleCode || ''
        return true
      }
      case 'plate-create-owner': state.plateCreateDraft.ownerName = value; return true
      case 'plate-create-pattern-maker': state.plateCreateDraft.patternMakerName = value; return true
      case 'plate-create-title': state.plateCreateDraft.title = value; return true
      case 'plate-create-due-at': state.plateCreateDraft.dueAt = fromDateTimeLocalValue(value); return true
      case 'plate-create-style-code': state.plateCreateDraft.productStyleCode = value; return true
      case 'plate-create-product-history-type': state.plateCreateDraft.productHistoryType = value; return true
      case 'plate-create-pattern-area': state.plateCreateDraft.patternArea = value; return true
      case 'plate-create-pattern-type': state.plateCreateDraft.patternType = value; return true
      case 'plate-create-size-range': state.plateCreateDraft.sizeRange = value; return true
      case 'plate-create-note': state.plateCreateDraft.note = value; return true
      case 'plate-detail-participants': state.plateDetailDraft.participantNamesText = value; return true
      case 'plate-detail-version': state.plateDetailDraft.patternVersion = value; return true
      case 'plate-detail-product-history-type': state.plateDetailDraft.productHistoryType = value; return true
      case 'plate-detail-pattern-maker': state.plateDetailDraft.patternMakerName = value; return true
      case 'plate-detail-sample-confirmed-at': state.plateDetailDraft.sampleConfirmedAt = fromDateTimeLocalValue(value); return true
      case 'plate-detail-pattern-area': state.plateDetailDraft.patternArea = value; return true
      case 'plate-detail-color-requirement': state.plateDetailDraft.colorRequirementText = value; return true
      case 'plate-detail-new-pattern-spu': state.plateDetailDraft.newPatternSpuCode = value; return true
      case 'plate-detail-template-links': state.plateDetailDraft.partTemplateLinksText = value; return true
      case 'pattern-create-binding-mode':
        state.patternCreateDraft.bindingMode = value as TaskBindingMode
        state.patternCreateDraft.projectId = ''
        state.patternCreateDraft.styleId = ''
        state.patternCreateDraft.productStyleCode = ''
        state.patternCreateDraft.sourceType = value === 'project' ? '项目模板阶段' : '人工创建'
        return true
      case 'pattern-create-source-type':
        state.patternCreateDraft.sourceType = value as PatternTaskSourceType
        return true
      case 'pattern-create-project': {
        state.patternCreateDraft.projectId = value
        const defaults = getProjectDefaultValues(value)
        state.patternCreateDraft.ownerName = defaults.ownerName
        state.patternCreateDraft.styleId = defaults.styleId
        state.patternCreateDraft.productStyleCode = defaults.styleCode
        return true
      }
      case 'pattern-create-style-id':
        state.patternCreateDraft.styleId = value
        state.patternCreateDraft.productStyleCode = getStyleArchiveById(value)?.styleCode || ''
        return true
      case 'pattern-create-owner': state.patternCreateDraft.ownerName = value; return true
      case 'pattern-create-title': state.patternCreateDraft.title = value; return true
      case 'pattern-create-due-at': state.patternCreateDraft.dueAt = fromDateTimeLocalValue(value); return true
      case 'pattern-create-style-code': state.patternCreateDraft.productStyleCode = value; return true
      case 'pattern-create-demand-source': state.patternCreateDraft.demandSourceType = value as PatternTaskDemandSourceType; return true
      case 'pattern-create-process-type': {
        state.patternCreateDraft.processType = value as PatternTaskProcessType
        state.patternCreateDraft.artworkType = value === '烫画' ? '烫画' : '印花'
        state.patternCreateDraft.patternMode = value
        return true
      }
      case 'pattern-create-request-qty': state.patternCreateDraft.requestQty = value; return true
      case 'pattern-create-fabric-sku': state.patternCreateDraft.fabricSku = value; return true
      case 'pattern-create-fabric-name': state.patternCreateDraft.fabricName = value; return true
      case 'pattern-create-team': {
        const nextTeamCode = value as PatternTaskTeamCode
        state.patternCreateDraft.assignedTeamCode = nextTeamCode
        state.patternCreateDraft.assignedMemberId = getPatternMemberOptions(nextTeamCode)[0]?.value || ''
        return true
      }
      case 'pattern-create-member': state.patternCreateDraft.assignedMemberId = value; return true
      case 'pattern-create-artwork-name': state.patternCreateDraft.artworkName = value; return true
      case 'pattern-create-artwork-type': state.patternCreateDraft.artworkType = value; return true
      case 'pattern-create-pattern-mode': state.patternCreateDraft.patternMode = value; return true
      case 'pattern-create-category': state.patternCreateDraft.patternCategoryCode = value; return true
      case 'pattern-create-style-tags': state.patternCreateDraft.patternStyleTagsText = value; return true
      case 'pattern-create-note': state.patternCreateDraft.note = value; return true
      case 'pattern-detail-version': state.patternDetailDraft.artworkVersion = value; return true
      case 'pattern-detail-difficulty': state.patternDetailDraft.difficultyGrade = value as PatternTaskDifficultyGrade; return true
      case 'pattern-detail-color-depth': state.patternDetailDraft.colorDepthOption = value as PatternTaskColorDepthOption; return true
      case 'pattern-detail-physical-note': state.patternDetailDraft.physicalReferenceNote = value; return true
      case 'pattern-detail-color-note': state.patternDetailDraft.colorConfirmNote = value; return true
      case 'pattern-detail-buyer-note': state.patternDetailDraft.buyerReviewNote = value; return true
      case 'pattern-detail-transfer-reason': state.patternDetailDraft.transferReason = value; return true
      case 'pattern-detail-category': state.patternDetailDraft.patternCategoryCode = value; return true
      case 'pattern-detail-style-tags': state.patternDetailDraft.patternStyleTagsText = value; return true
      case 'first-sample-create-project': {
        state.firstSampleCreateDraft.projectId = value
        const project = getProjectById(value)
        state.firstSampleCreateDraft.ownerName = project?.ownerName || ''
        state.firstSampleCreateDraft.sourceTechPackVersionId = project?.linkedTechPackVersionId || ''
        state.firstSampleCreateDraft.sourceTechPackVersionCode = project?.linkedTechPackVersionCode || ''
        state.firstSampleCreateDraft.sourceTechPackVersionLabel = project?.linkedTechPackVersionLabel || ''
        return true
      }
      case 'first-sample-create-owner': state.firstSampleCreateDraft.ownerName = value; return true
      case 'first-sample-create-title': state.firstSampleCreateDraft.title = value; return true
      case 'first-sample-create-tech-pack-id': state.firstSampleCreateDraft.sourceTechPackVersionId = value; return true
      case 'first-sample-create-tech-pack-label':
        state.firstSampleCreateDraft.sourceTechPackVersionLabel = value
        state.firstSampleCreateDraft.sourceTechPackVersionCode = value
        return true
      case 'first-sample-create-factory':
        state.firstSampleCreateDraft.factoryId = value
        state.firstSampleCreateDraft.factoryName = getFirstSampleFactoryName(value)
        return true
      case 'first-sample-create-site': state.firstSampleCreateDraft.targetSite = value; return true
      case 'first-sample-create-material-mode': state.firstSampleCreateDraft.sampleMaterialMode = value as SampleMaterialMode; return true
      case 'first-sample-create-purpose': state.firstSampleCreateDraft.samplePurpose = value as FirstSamplePurpose; return true
      case 'first-sample-create-note': state.firstSampleCreateDraft.note = value; return true
      case 'first-sample-start-operator': state.firstSampleStartDraft.operatorName = value; return true
      case 'first-sample-start-at': state.firstSampleStartDraft.startedAt = fromDateTimeLocalValue(value); return true
      case 'first-sample-start-plan-finish-at': state.firstSampleStartDraft.planFinishAt = fromDateTimeLocalValue(value); return true
      case 'first-sample-start-note': state.firstSampleStartDraft.startNote = value; return true
      case 'first-sample-result-sample-code': state.firstSampleResultDraft.sampleCode = value; return true
      case 'first-sample-result-submitted-by': state.firstSampleResultDraft.submittedBy = value; return true
      case 'first-sample-result-completed-at': state.firstSampleResultDraft.completedAt = fromDateTimeLocalValue(value); return true
      case 'first-sample-result-note': state.firstSampleResultDraft.resultNote = value; return true
      case 'first-sample-acceptance-confirmed-by': state.firstSampleAcceptanceConfirmedBy = value; return true
      case 'first-sample-acceptance-confirmed-at': state.firstSampleAcceptanceConfirmedAt = fromDateTimeLocalValue(value); return true
      case 'first-sample-acceptance-result': state.firstSampleAcceptanceResult = value; return true
      case 'first-sample-acceptance-note': state.firstSampleAcceptanceNote = value; return true
      case 'first-sample-acceptance-artwork-summary': state.firstSampleAcceptanceArtworkSummary = value; return true
      case 'first-sample-detail-sample-code': state.firstSampleDetailDraft.sampleCode = value; return true
      case 'first-sample-detail-sample-images': state.firstSampleDetailDraft.sampleImageIdsText = value; return true
      case 'first-sample-detail-fit-summary': state.firstSampleDetailDraft.fitConfirmationSummary = value; return true
      case 'first-sample-detail-artwork-summary': state.firstSampleDetailDraft.artworkConfirmationSummary = value; return true
      case 'first-sample-detail-production-note': state.firstSampleDetailDraft.productionReadinessNote = value; return true
      case 'first-sample-detail-reuse-note': state.firstSampleDetailDraft.reuseAsFirstOrderBasisNote = value; return true
      case 'first-sample-detail-reuse-confirmed-at': state.firstSampleDetailDraft.reuseAsFirstOrderBasisConfirmedAt = value; return true
      case 'first-sample-detail-reuse-confirmed-by': state.firstSampleDetailDraft.reuseAsFirstOrderBasisConfirmedBy = value; return true
      case 'first-sample-detail-confirmed-at': state.firstSampleDetailDraft.confirmedAt = value; return true
      case 'first-order-create-project': {
        state.firstOrderCreateDraft.projectId = value
        state.firstOrderCreateDraft.ownerName = getProjectById(value)?.ownerName || ''
        return true
      }
      case 'first-order-create-owner': state.firstOrderCreateDraft.ownerName = value; return true
      case 'first-order-create-title': state.firstOrderCreateDraft.title = value; return true
      case 'first-order-create-factory':
        state.firstOrderCreateDraft.factoryId = value
        state.firstOrderCreateDraft.factoryName = getFirstOrderFactoryName(value)
        return true
      case 'first-order-create-site': state.firstOrderCreateDraft.targetSite = value; return true
      case 'first-order-create-chain-mode':
        state.firstOrderCreateDraft.sampleChainMode = value as SampleChainMode
        state.firstOrderCreateDraft.samplePlanLinesText = serializeFirstOrderSamplePlanLines(createDefaultSamplePlanLines(state.firstOrderCreateDraft.sampleChainMode))
        return true
      case 'first-order-create-pattern-version': state.firstOrderCreateDraft.patternVersion = value; return true
      case 'first-order-create-artwork-version': state.firstOrderCreateDraft.artworkVersion = value; return true
      case 'first-order-create-final-reference-note': state.firstOrderCreateDraft.finalReferenceNote = value; return true
      case 'first-order-create-note': state.firstOrderCreateDraft.note = value; return true
      case 'first-order-start-operator': state.firstOrderStartDraft.operatorName = value; return true
      case 'first-order-start-at': state.firstOrderStartDraft.startedAt = fromDateTimeLocalValue(value); return true
      case 'first-order-start-plan-finish-at': state.firstOrderStartDraft.planFinishAt = fromDateTimeLocalValue(value); return true
      case 'first-order-start-factory-note': state.firstOrderStartDraft.factoryConfirmNote = value; return true
      case 'first-order-result-sample-code': state.firstOrderResultDraft.sampleCode = value; return true
      case 'first-order-result-submitted-by': state.firstOrderResultDraft.submittedBy = value; return true
      case 'first-order-result-completed-at': state.firstOrderResultDraft.completedAt = fromDateTimeLocalValue(value); return true
      case 'first-order-result-final-reference-note': state.firstOrderResultDraft.finalReferenceNote = value; return true
      case 'first-order-result-note': state.firstOrderResultDraft.resultNote = value; return true
      case 'first-order-conclusion-result': state.firstOrderConclusionResult = value; return true
      case 'first-order-conclusion-note': state.firstOrderConclusionNote = value; return true
      case 'first-order-conclusion-confirmed-by': state.firstOrderConclusionConfirmedBy = value; return true
      case 'first-order-conclusion-confirmed-at': state.firstOrderConclusionConfirmedAt = fromDateTimeLocalValue(value); return true
      case 'first-order-detail-pattern-version': state.firstOrderDetailDraft.patternVersion = value; return true
      case 'first-order-detail-artwork-version': state.firstOrderDetailDraft.artworkVersion = value; return true
      case 'first-order-detail-sample-code': state.firstOrderDetailDraft.sampleCode = value; return true
      case 'first-order-detail-final-reference-note': state.firstOrderDetailDraft.finalReferenceNote = value; return true
      case 'first-order-detail-sample-plan-lines': state.firstOrderDetailDraft.samplePlanLinesText = value; return true
      case 'first-order-detail-conclusion-result': state.firstOrderDetailDraft.conclusionResult = value as FirstOrderDetailDraft['conclusionResult']; return true
      case 'first-order-detail-conclusion-note': state.firstOrderDetailDraft.conclusionNote = value; return true
      case 'first-order-detail-confirmed-at': state.firstOrderDetailDraft.confirmedAt = fromDateTimeLocalValue(value); return true
      case 'first-order-detail-confirmed-by': state.firstOrderDetailDraft.confirmedBy = value; return true
      default: return false
    }
  }
  return false
}

export function handlePcsEngineeringTaskEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-engineering-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsEngineeringAction
  if (!action) return false

  if (action === 'close-notice') { clearNotice(); return true }
  if (action === 'refresh-page') { setNotice('已刷新当前任务页面。'); return true }

  if (action === 'open-revision-create') { state.revisionCreateOpen = true; state.revisionCreateDraft = initialRevisionCreateDraft(); clearNotice(); return true }
  if (action === 'close-revision-create') { state.revisionCreateOpen = false; return true }
  if (action === 'submit-revision-create') { submitRevisionCreate(); return true }
  if (action === 'open-plate-create') { state.plateCreateOpen = true; state.plateCreateDraft = initialPlateCreateDraft(); clearNotice(); return true }
  if (action === 'close-plate-create') { state.plateCreateOpen = false; return true }
  if (action === 'submit-plate-create') { submitPlateCreate(); return true }
  if (action === 'open-pattern-create') { state.patternCreateOpen = true; state.patternCreateDraft = initialPatternCreateDraft(); clearNotice(); return true }
  if (action === 'close-pattern-create') { state.patternCreateOpen = false; return true }
  if (action === 'submit-pattern-create') { submitPatternCreate(); return true }
  if (action === 'open-first-sample-create') { state.firstSampleCreateOpen = true; return true }
  if (action === 'close-first-sample-create') { state.firstSampleCreateOpen = false; return true }
  if (action === 'submit-first-sample-create') { submitFirstSampleCreate(); return true }
  if (action === 'close-first-sample-start') { state.firstSampleStartOpen = false; return true }
  if (action === 'submit-first-sample-start') { submitFirstSampleStart(); return true }
  if (action === 'close-first-sample-result') { state.firstSampleResultOpen = false; return true }
  if (action === 'submit-first-sample-result') { submitFirstSampleResult(); return true }
  if (action === 'open-first-order-create') { state.firstOrderCreateOpen = true; return true }
  if (action === 'close-first-order-create') { state.firstOrderCreateOpen = false; return true }
  if (action === 'submit-first-order-create') { submitFirstOrderCreate(); return true }
  if (action === 'add-first-order-create-plan-line') {
    state.firstOrderCreateDraft.samplePlanLinesText = addFirstOrderSamplePlanLineText(
      state.firstOrderCreateDraft.samplePlanLinesText,
      createDefaultSamplePlanLines(state.firstOrderCreateDraft.sampleChainMode),
    )
    return true
  }
  if (action === 'remove-first-order-create-plan-line') {
    state.firstOrderCreateDraft.samplePlanLinesText = removeFirstOrderSamplePlanLineText(
      state.firstOrderCreateDraft.samplePlanLinesText,
      createDefaultSamplePlanLines(state.firstOrderCreateDraft.sampleChainMode),
      Number(actionNode.dataset.lineIndex || '-1'),
    )
    return true
  }
  if (action === 'add-first-order-result-plan-line') {
    state.firstOrderResultDraft.samplePlanLinesText = addFirstOrderSamplePlanLineText(state.firstOrderResultDraft.samplePlanLinesText, [])
    return true
  }
  if (action === 'remove-first-order-result-plan-line') {
    state.firstOrderResultDraft.samplePlanLinesText = removeFirstOrderSamplePlanLineText(
      state.firstOrderResultDraft.samplePlanLinesText,
      [],
      Number(actionNode.dataset.lineIndex || '-1'),
    )
    return true
  }

  if (action === 'set-revision-quick-filter') { state.revisionList.quickFilter = actionNode.dataset.quickFilter || 'all'; state.revisionList.currentPage = 1; return true }
  if (action === 'set-plate-quick-filter') { state.plateList.quickFilter = actionNode.dataset.quickFilter || 'all'; state.plateList.currentPage = 1; return true }
  if (action === 'set-pattern-quick-filter') { state.patternList.quickFilter = actionNode.dataset.quickFilter || 'all'; state.patternList.currentPage = 1; return true }
  if (action === 'set-first-sample-quick-filter') { state.firstSampleList.quickFilter = actionNode.dataset.quickFilter || 'all'; state.firstSampleList.currentPage = 1; return true }
  if (action === 'set-first-order-quick-filter') { state.firstOrderList.quickFilter = actionNode.dataset.quickFilter || 'all'; state.firstOrderList.currentPage = 1; return true }

  if (action === 'change-revision-page') { updateListPage(state.revisionList, Number(actionNode.dataset.pageStep || '0'), getRevisionTasksFiltered().length); return true }
  if (action === 'change-plate-page') { updateListPage(state.plateList, Number(actionNode.dataset.pageStep || '0'), getPlateTasksFiltered().length); return true }
  if (action === 'change-pattern-page') { updateListPage(state.patternList, Number(actionNode.dataset.pageStep || '0'), getPatternTasksFiltered().length); return true }
  if (action === 'change-first-sample-page') { updateListPage(state.firstSampleList, Number(actionNode.dataset.pageStep || '0'), getFirstSampleTasksFiltered().length); return true }
  if (action === 'change-first-order-page') { updateListPage(state.firstOrderList, Number(actionNode.dataset.pageStep || '0'), getFirstOrderTasksFiltered().length); return true }

  if (action === 'set-revision-tab') { state.revisionTab = (actionNode.dataset.tab as RevisionTab) || 'plan'; return true }
  if (action === 'set-plate-tab') { state.plateTab = (actionNode.dataset.tab as PlateTab) || 'overview'; return true }
  if (action === 'set-pattern-tab') { state.patternTab = (actionNode.dataset.tab as PatternTab) || 'plan'; return true }
  if (action === 'set-first-sample-tab') { state.firstSampleTab = (actionNode.dataset.tab as FirstSampleTab) || 'overview'; return true }
  if (action === 'set-first-order-tab') { state.firstOrderTab = (actionNode.dataset.tab as FirstOrderTab) || 'overview'; return true }

  if (action === 'toggle-revision-scope') {
    const scopeCode = actionNode.dataset.scopeCode || ''
    state.revisionCreateDraft.scopeCodes = state.revisionCreateDraft.scopeCodes.includes(scopeCode)
      ? state.revisionCreateDraft.scopeCodes.filter((item) => item !== scopeCode)
      : [...state.revisionCreateDraft.scopeCodes, scopeCode]
    state.revisionCreateDraft.createPatternTask = canCreateRevisionPatternTask(
      state.revisionCreateDraft.scopeCodes,
      state.revisionCreateDraft.sourceType,
      state.revisionCreateDraft.projectId,
    )
    return true
  }

  if (action === 'toggle-revision-create-pattern-task') {
    if (!canCreateRevisionPatternTask(state.revisionCreateDraft.scopeCodes, state.revisionCreateDraft.sourceType, state.revisionCreateDraft.projectId)) {
      state.revisionCreateDraft.createPatternTask = false
      return true
    }
    state.revisionCreateDraft.createPatternTask = true
    return true
  }

  if (action === 'toggle-plate-create-urgent') {
    state.plateCreateDraft.urgentFlag = !state.plateCreateDraft.urgentFlag
    return true
  }

  if (action === 'toggle-plate-detail-urgent') {
    state.plateDetailDraft.urgentFlag = !state.plateDetailDraft.urgentFlag
    return true
  }

  if (action === 'toggle-first-order-reference-required') {
    state.firstOrderCreateDraft.productionReferenceRequiredFlag = !state.firstOrderCreateDraft.productionReferenceRequiredFlag
    if (state.firstOrderCreateDraft.productionReferenceRequiredFlag && !state.firstOrderCreateDraft.specialSceneReasonCodes.includes('工厂参照样')) {
      state.firstOrderCreateDraft.specialSceneReasonCodes.push('工厂参照样')
    }
    return true
  }

  if (action === 'toggle-first-order-china-review') {
    state.firstOrderCreateDraft.chinaReviewRequiredFlag = !state.firstOrderCreateDraft.chinaReviewRequiredFlag
    return true
  }

  if (action === 'toggle-first-order-correct-fabric') {
    state.firstOrderCreateDraft.correctFabricRequiredFlag = !state.firstOrderCreateDraft.correctFabricRequiredFlag
    if (state.firstOrderCreateDraft.correctFabricRequiredFlag && !state.firstOrderCreateDraft.specialSceneReasonCodes.includes('正确布确认')) {
      state.firstOrderCreateDraft.specialSceneReasonCodes.push('正确布确认')
    }
    return true
  }

  if (action === 'toggle-first-order-special-reason') {
    const reason = actionNode.dataset.reason as SampleSpecialSceneReasonCode
    if (state.firstOrderCreateDraft.specialSceneReasonCodes.includes(reason)) {
      state.firstOrderCreateDraft.specialSceneReasonCodes = state.firstOrderCreateDraft.specialSceneReasonCodes.filter((item) => item !== reason)
    } else {
      state.firstOrderCreateDraft.specialSceneReasonCodes.push(reason)
    }
    return true
  }

  if (action === 'remove-revision-evidence-image') {
    const index = Number(actionNode.dataset.imageIndex || '-1')
    if (index >= 0) {
      state.revisionCreateDraft.evidenceImageUrls = state.revisionCreateDraft.evidenceImageUrls.filter((_, itemIndex) => itemIndex !== index)
    }
    return true
  }
  if (action === 'remove-list-item') {
    return removeListValue(actionNode.dataset.scope || '', Number(actionNode.dataset.index || '-1'))
  }

  if (action === 'open-image-preview') {
    state.imagePreview = {
      open: true,
      url: actionNode.dataset.url || '',
      title: actionNode.dataset.title || '图片预览',
    }
    return true
  }

  if (action === 'close-image-preview') {
    state.imagePreview = { open: false, url: '', title: '' }
    return true
  }

  if (action === 'add-revision-material-line') {
    state.revisionDetailDraft.materialAdjustmentLines = [
      ...state.revisionDetailDraft.materialAdjustmentLines,
      newRevisionMaterialLine('revision_material'),
    ]
    return true
  }
  if (action === 'remove-revision-material-line') {
    const index = Number(actionNode.dataset.lineIndex || '-1')
    if (index >= 0) {
      state.revisionDetailDraft.materialAdjustmentLines = state.revisionDetailDraft.materialAdjustmentLines.filter((_, itemIndex) => itemIndex !== index)
    }
    return true
  }
  if (action === 'add-plate-material-line') {
    state.plateDetailDraft.materialRequirementLines = [
      ...state.plateDetailDraft.materialRequirementLines,
      newPlateMaterialLine('plate_material'),
    ]
    return true
  }
  if (action === 'remove-plate-material-line') {
    const index = Number(actionNode.dataset.lineIndex || '-1')
    if (index >= 0) {
      state.plateDetailDraft.materialRequirementLines = state.plateDetailDraft.materialRequirementLines.filter((_, itemIndex) => itemIndex !== index)
    }
    return true
  }
  if (action === 'add-plate-pattern-image-line') {
    state.plateDetailDraft.patternImageLineItems = [
      ...state.plateDetailDraft.patternImageLineItems,
      newPlatePatternImageLine('plate_pattern_image'),
    ]
    return true
  }
  if (action === 'remove-plate-pattern-image-line') {
    const index = Number(actionNode.dataset.lineIndex || '-1')
    if (index >= 0) {
      state.plateDetailDraft.patternImageLineItems = state.plateDetailDraft.patternImageLineItems.filter((_, itemIndex) => itemIndex !== index)
    }
    return true
  }

  if (action === 'save-revision-detail-fields') {
    const taskId = actionNode.dataset.taskId || ''
    const draft = state.revisionDetailDraft
    const participants = draft.participantNamesText.split(/[、,，]/).map((item) => item.trim()).filter(Boolean)
    updateRevisionTask(taskId, {
      participantNames: participants,
      revisionVersion: draft.revisionVersion.trim(),
      baseStyleCode: draft.baseStyleCode.trim(),
      baseStyleName: draft.baseStyleName.trim(),
      targetStyleCodeCandidate: draft.targetStyleCodeCandidate.trim(),
      targetStyleNameCandidate: draft.targetStyleNameCandidate.trim(),
      targetStyleImageIds: [...draft.targetStyleImageIds],
      sampleQty: Number(draft.sampleQty || 0),
      stylePreference: draft.stylePreference.trim(),
      patternMakerName: draft.patternMakerName.trim(),
      revisionSuggestionRichText: draft.revisionSuggestionRichText.trim(),
      paperPrintAt: draft.paperPrintAt.trim(),
      deliveryAddress: draft.deliveryAddress.trim(),
      patternArea: draft.patternArea as RevisionTaskPatternArea,
      materialAdjustmentLines: draft.materialAdjustmentLines.map((line) => ({
        ...line,
        materialName: line.materialName.trim(),
        materialSku: line.materialSku.trim(),
        printRequirement: line.printRequirement.trim(),
        note: line.note.trim(),
      })),
      newPatternImageIds: [...draft.newPatternImageIds],
      newPatternSpuCode: draft.newPatternSpuCode.trim(),
      patternChangeNote: draft.patternChangeNote.trim(),
      patternPieceImageIds: [...draft.patternPieceImageIds],
      patternFileIds: [...draft.patternFileIds],
      mainImageIds: [...draft.mainImageIds],
      designDraftImageIds: [...draft.designDraftImageIds],
      liveRetestRequired: draft.liveRetestRequired,
      liveRetestStatus: draft.liveRetestStatus,
      liveRetestRelationIds: splitLines(draft.liveRetestRelationIdsText),
      liveRetestSummary: draft.liveRetestSummary.trim(),
      updatedAt: nowText(),
      updatedBy: '当前用户',
    })
    pushRuntimeLog('revision', taskId, '保存任务', '已保存改版任务。')
    setNotice('改版任务已保存。')
    return true
  }
  if (action === 'save-plate-detail-fields') {
    const taskId = actionNode.dataset.taskId || ''
    const draft = state.plateDetailDraft
    const participants = draft.participantNamesText.split(/[、,，]/).map((item) => item.trim()).filter(Boolean)
    updatePlateMakingTask(taskId, {
      participantNames: participants,
      patternVersion: draft.patternVersion.trim(),
      productHistoryType: draft.productHistoryType as '未卖过' | '已卖过补纸样' | '',
      patternMakerName: draft.patternMakerName.trim(),
      sampleConfirmedAt: draft.sampleConfirmedAt.trim(),
      urgentFlag: draft.urgentFlag,
      patternArea: draft.patternArea as '印尼' | '深圳' | '',
      colorRequirementText: draft.colorRequirementText.trim(),
      newPatternSpuCode: draft.newPatternSpuCode.trim(),
      flowerImageIds: [...draft.flowerImageIds],
      materialRequirementLines: draft.materialRequirementLines.map((line) => ({
        ...line,
        materialName: line.materialName.trim(),
        materialSku: line.materialSku.trim(),
        printRequirement: line.printRequirement.trim(),
        note: line.note.trim(),
      })),
      patternImageLineItems: draft.patternImageLineItems.map((line) => ({
        ...line,
        materialPartName: line.materialPartName.trim(),
        materialDescription: line.materialDescription.trim(),
      })),
      patternPdfFileIds: [...draft.patternPdfFileIds],
      patternDxfFileIds: [...draft.patternDxfFileIds],
      patternRulFileIds: [...draft.patternRulFileIds],
      supportImageIds: [...draft.supportImageIds],
      supportVideoIds: [...draft.supportVideoIds],
      partTemplateLinks: parsePlateTemplateLinks(draft.partTemplateLinksText),
      updatedAt: nowText(),
      updatedBy: '当前用户',
    })
    pushRuntimeLog('plate', taskId, '保存任务', '已保存制版任务。')
    setNotice('制版任务已保存。')
    return true
  }
  if (action === 'save-pattern-detail-fields') {
    const taskId = actionNode.dataset.taskId || ''
    const draft = state.patternDetailDraft
    updatePatternTask(taskId, {
      artworkVersion: draft.artworkVersion.trim(),
      difficultyGrade: draft.difficultyGrade,
      colorDepthOption: draft.colorDepthOption,
      physicalReferenceNote: draft.physicalReferenceNote.trim(),
      colorConfirmNote: draft.colorConfirmNote.trim(),
      completionImageIds: [...draft.completionImageIds],
      liveReferenceImageIds: [...draft.liveReferenceImageIds],
      imageReferenceIds: [...draft.imageReferenceIds],
      buyerReviewNote: draft.buyerReviewNote.trim(),
      transferReason: draft.transferReason.trim(),
      patternCategoryCode: draft.patternCategoryCode.trim(),
      patternStyleTags: parseTagsText(draft.patternStyleTagsText),
      hotSellerFlag: draft.hotSellerFlag,
      updatedAt: nowText(),
      updatedBy: '当前用户',
    })
    pushRuntimeLog('pattern', taskId, '保存任务', '已保存花型任务。')
    setNotice('花型任务已保存。')
    return true
  }

  if (action === 'pattern-buyer-approve') {
    const taskId = actionNode.dataset.taskId || ''
    try {
      const task = reviewPatternTaskByBuyer(taskId, '买手已通过', '文锋', state.patternDetailDraft.buyerReviewNote.trim())
      pushRuntimeLog('pattern', taskId, '买手确认', '买手已通过。')
      setNotice(`花型任务 ${task.patternTaskCode} 已通过买手确认。`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '买手确认失败。')
    }
    return true
  }

  if (action === 'pattern-buyer-reject') {
    const taskId = actionNode.dataset.taskId || ''
    try {
      const task = reviewPatternTaskByBuyer(taskId, '买手已驳回', '文锋', state.patternDetailDraft.buyerReviewNote.trim())
      pushRuntimeLog('pattern', taskId, '买手驳回', state.patternDetailDraft.buyerReviewNote.trim() || '买手已驳回，退回花型师调整。')
      setNotice(`花型任务 ${task.patternTaskCode} 已驳回，回到进行中。`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '买手驳回失败。')
    }
    return true
  }

  if (action === 'pattern-transfer-to-cn') {
    const taskId = actionNode.dataset.taskId || ''
    try {
      const task = transferPatternTaskToChinaTeam(taskId, state.patternDetailDraft.transferReason.trim(), 'cn_bing_bing', '当前用户')
      pushRuntimeLog('pattern', taskId, '转派中国团队', state.patternDetailDraft.transferReason.trim())
      setNotice(`花型任务 ${task.patternTaskCode} 已转派中国团队。`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '转派失败。')
    }
    return true
  }

  if (action === 'revision-generate-tech-pack') { generateRevisionTechPack(actionNode.dataset.taskId || ''); return true }
  if (action === 'submit-revision-confirmation') {
    const taskId = actionNode.dataset.taskId || ''
    const result = submitRevisionTaskForConfirmation(taskId, '当前用户')
    if (result.ok && result.task) {
      pushRuntimeLog('revision', taskId, '提交确认', '改版任务已提交产出确认。')
    }
    setNotice(result.message)
    return true
  }
  if (action === 'confirm-revision-output') {
    const taskId = actionNode.dataset.taskId || ''
    const result = confirmRevisionTaskOutput(taskId, '当前用户')
    if (result.ok && result.task) {
      pushRuntimeLog('revision', taskId, '确认产出', '改版产出已确认，可生成技术包版本。')
    }
    setNotice(result.message)
    return true
  }
  if (action === 'revision-create-downstream') {
    const taskId = actionNode.dataset.taskId || ''
    const task = getRevisionTaskById(taskId)
    if (!task) {
      setNotice('未找到改版任务。')
      return true
    }
    const result = createDownstreamTasksFromRevision(taskId, inferDownstreamTypesFromRevisionTask(task))
    if (result.successCount > 0) {
      pushRuntimeLog('revision', taskId, '创建下游任务', `已创建：${result.createdTaskCodes.join('、')}。`)
    }
    const messages = [
      result.successCount > 0 ? `已创建下游任务：${result.createdTaskCodes.join('、')}。` : '',
      result.failureMessages.length > 0 ? `未创建项：${result.failureMessages.join('；')}。` : '',
    ].filter(Boolean).join(' ')
    setNotice(messages || '当前没有可创建的下游任务。')
    return true
  }
  if (action === 'plate-generate-tech-pack') { generatePlateTechPack(actionNode.dataset.taskId || ''); return true }
  if (action === 'pattern-generate-tech-pack') { generatePatternTechPack(actionNode.dataset.taskId || ''); return true }
  if (action === 'complete-revision-task') {
    const taskId = actionNode.dataset.taskId || ''
    try {
      const result = completeRevisionTask(taskId, '当前用户')
      if (!result.ok || !result.task) {
        setNotice(result.message)
        return true
      }
      const synced = Boolean(result.task.projectId && result.task.projectNodeId)
      pushRuntimeLog('revision', taskId, '完成任务', synced ? '已完成改版任务并同步商品项目节点。' : '已完成改版任务。')
      setNotice(`改版任务 ${result.task.revisionTaskCode} 已完成${synced ? '，并同步更新商品项目节点' : ''}。`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '改版任务完成失败。')
    }
    return true
  }
  if (action === 'complete-plate-task') {
    const taskId = actionNode.dataset.taskId || ''
    try {
      const result = completePlateMakingTask(taskId, '当前用户')
      if (!result.ok || !result.task) {
        setNotice(result.message)
        return true
      }
      const synced = Boolean(result.task.projectId && result.task.projectNodeId)
      pushRuntimeLog('plate', taskId, '完成任务', synced ? '已完成制版任务并同步商品项目节点。' : '已完成制版任务。')
      setNotice(`制版任务 ${result.task.plateTaskCode} 已完成${synced ? '，并同步更新商品项目节点' : ''}。`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '制版任务完成失败。')
    }
    return true
  }
  if (action === 'complete-pattern-task') {
    const taskId = actionNode.dataset.taskId || ''
    try {
      const result = completePatternTask(taskId, '当前用户')
      if (!result.ok || !result.task) {
        setNotice(result.message)
        return true
      }
      const synced = Boolean(result.task.projectId && result.task.projectNodeId)
      pushRuntimeLog('pattern', taskId, '完成任务', synced ? '已完成花型任务并同步商品项目节点。' : '已完成花型任务。')
      setNotice(`花型任务 ${result.task.patternTaskCode} 已完成${synced ? '，并同步更新商品项目节点' : ''}。`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '花型任务完成失败。')
    }
    return true
  }
  if (action === 'pattern-publish-library') {
    const taskId = actionNode.dataset.taskId || ''
    const result = createPatternAssetFromTask(taskId)
    if (result.ok && result.assetId) {
      setNotice(result.message)
      appStore.navigate(`/pcs/pattern-library/${result.assetId}`)
      return true
    }
    setNotice(result.message)
    return true
  }

  if (action === 'create-revision-from-first-sample') {
    const task = getFirstSampleTaskById(actionNode.dataset.taskId || '')
    if (!task) {
      setNotice('未找到首版样衣任务。')
      return true
    }
    openRevisionCreateFromFirstSampleRework(task, '当前用户')
    return true
  }
  if (action === 'first-sample-advance') { advanceFirstSampleTask(actionNode.dataset.taskId || ''); return true }
  if (action === 'save-first-sample-detail') { saveFirstSampleDetail(actionNode.dataset.taskId || state.firstSampleDetailDraftTaskId); return true }
  if (action === 'close-first-sample-acceptance') { state.firstSampleAcceptanceOpen = false; return true }
  if (action === 'submit-first-sample-acceptance') {
    const task = getFirstSampleTaskById(state.firstSampleAcceptanceTaskId)
    if (!task) { setNotice('未找到首版样衣任务。'); return true }
    const confirmer = state.firstSampleAcceptanceConfirmedBy.trim()
    const timestamp = state.firstSampleAcceptanceConfirmedAt.trim()
    const acceptanceNote = state.firstSampleAcceptanceNote.trim()
    const artworkSummary = state.firstSampleAcceptanceArtworkSummary.trim()
    if (!confirmer) { setNotice('请填写确认人。'); return true }
    if (!timestamp) { setNotice('请填写确认时间。'); return true }
    if (!acceptanceNote) { setNotice('请填写验收说明。'); return true }
    if (state.firstSampleAcceptanceResult !== '通过' && state.firstSampleAcceptanceResult !== '需改版') {
      setNotice('首版验收结论只能选择通过或需改版。')
      return true
    }
    firstSampleAcceptanceMap.set(task.firstSampleTaskId, { result: state.firstSampleAcceptanceResult, note: acceptanceNote, updatedAt: timestamp })
    const passed = state.firstSampleAcceptanceResult === '通过'
    const nextStatus = passed ? '已通过' : '需改版'
    const canReuseAsFirstOrderBasis = passed && task.samplePurpose === '首单复用候选'
    const result = updateFirstSampleTaskDetailAndSync(task.firstSampleTaskId, {
      status: nextStatus,
      confirmedAt: timestamp,
      reuseAsFirstOrderBasisFlag: canReuseAsFirstOrderBasis,
      reuseAsFirstOrderBasisConfirmedAt: canReuseAsFirstOrderBasis ? timestamp : '',
      reuseAsFirstOrderBasisConfirmedBy: canReuseAsFirstOrderBasis ? confirmer : '',
      reuseAsFirstOrderBasisNote: canReuseAsFirstOrderBasis ? '首版样衣已确认，可直接作为首单参照。' : '',
      fitConfirmationSummary: passed ? acceptanceNote || task.fitConfirmationSummary || '版型确认通过。' : acceptanceNote || task.fitConfirmationSummary,
      artworkConfirmationSummary: passed
        ? artworkSummary || task.artworkConfirmationSummary || '花型与外观确认通过。'
        : artworkSummary || task.artworkConfirmationSummary,
      productionReadinessNote: passed
        ? task.productionReadinessNote || (canReuseAsFirstOrderBasis ? '可作为首单复用候选。' : '首版样衣确认通过，当前仅作为首版确认结论。')
        : '首版样衣验收需改版，待改版任务完成后重新确认。',
      note: `${task.note ? `${task.note}；` : ''}验收结论：${state.firstSampleAcceptanceResult}`,
    }, confirmer)
    if (result.task) {
      state.firstSampleDetailDraftTaskId = result.task.firstSampleTaskId
      state.firstSampleDetailDraft = buildFirstSampleDetailDraft(result.task)
    }
    pushRuntimeLog('firstSample', task.firstSampleTaskId, '填写验收', `确认人：${confirmer}；确认时间：${timestamp}；验收结论：${state.firstSampleAcceptanceResult}。${acceptanceNote}`, confirmer)
    state.firstSampleAcceptanceOpen = false
    state.firstSampleTab = 'acceptance'
    setNotice(result.ok
      ? `首版样衣任务 ${task.firstSampleTaskCode} 已提交验收结论并同步商品项目节点。${passed ? '' : '请在改版处理入口创建或跟进改版任务。'}`
      : result.message)
    return true
  }

  if (action === 'first-order-advance') { advanceFirstOrderTask(actionNode.dataset.taskId || ''); return true }
  if (action === 'close-first-order-start') { state.firstOrderStartOpen = false; return true }
  if (action === 'submit-first-order-start') { submitFirstOrderStart(); return true }
  if (action === 'close-first-order-result') { state.firstOrderResultOpen = false; return true }
  if (action === 'submit-first-order-result') { submitFirstOrderResult(); return true }
  if (action === 'close-first-order-conclusion') { state.firstOrderConclusionOpen = false; return true }
  if (action === 'submit-first-order-conclusion') {
    const task = getFirstOrderSampleTaskById(state.firstOrderConclusionTaskId)
    if (!task) { setNotice('未找到首单样衣打样任务。'); return true }
    if (!state.firstOrderConclusionConfirmedBy.trim()) { setNotice('请填写确认人。'); return true }
    if (!state.firstOrderConclusionConfirmedAt.trim()) { setNotice('请填写确认时间。'); return true }
    const conclusionResult = state.firstOrderConclusionResult === '通过'
      ? '通过'
      : state.firstOrderConclusionResult === '需改版'
        ? '需改版'
        : '需补首单'
    const timestamp = state.firstOrderConclusionConfirmedAt.trim()
    firstOrderConclusionMap.set(task.firstOrderSampleTaskId, { result: conclusionResult, note: state.firstOrderConclusionNote.trim(), updatedAt: timestamp })
    const nextStatus = state.firstOrderConclusionResult === '通过'
      ? '已通过'
      : state.firstOrderConclusionResult === '需改版'
        ? '需改版'
        : '需补首单'
    const result = updateFirstOrderSampleTaskDetailAndSync(task.firstOrderSampleTaskId, {
      status: nextStatus,
      conclusionResult,
      conclusionNote: state.firstOrderConclusionNote.trim(),
      confirmedAt: timestamp,
      confirmedBy: state.firstOrderConclusionConfirmedBy.trim(),
      note: `${task.note ? `${task.note}；` : ''}首单结论：${conclusionResult}`,
    }, state.firstOrderConclusionConfirmedBy.trim())
    if (result.task) {
      state.firstOrderDetailDraftTaskId = result.task.firstOrderSampleTaskId
      state.firstOrderDetailDraft = buildFirstOrderDetailDraft(result.task)
    }
    pushRuntimeLog('firstOrder', task.firstOrderSampleTaskId, '首单结论', `确认人：${state.firstOrderConclusionConfirmedBy.trim()}；确认时间：${timestamp}；结论：${conclusionResult}。${state.firstOrderConclusionNote.trim() || '已记录首单结论。'}`)
    state.firstOrderConclusionOpen = false
    setNotice(result.ok ? `首单样衣打样任务 ${task.firstOrderSampleTaskCode} 已提交首单结论并同步商品项目节点。` : result.message)
    return true
  }

  if (action === 'close-all-engineering-dialogs') { closeAllDialogs(); return true }
  return false
}

export function isPcsEngineeringTaskDialogOpen(): boolean {
  return (
    state.revisionCreateOpen
    || state.plateCreateOpen
    || state.patternCreateOpen
    || state.firstSampleCreateOpen
    || state.firstSampleStartOpen
    || state.firstSampleResultOpen
    || state.firstSampleAcceptanceOpen
    || state.firstOrderCreateOpen
    || state.firstOrderStartOpen
    || state.firstOrderResultOpen
    || state.firstOrderConclusionOpen
  )
}

export function resetPcsEngineeringTaskState(): void {
  clearNotice()
  state.revisionList = { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 }
  state.revisionTab = 'plan'
  state.revisionCreateOpen = false
  state.revisionCreateDraft = initialRevisionCreateDraft()
  state.revisionDetailDraftTaskId = ''
  state.revisionDetailDraft = initialRevisionDetailDraft()
  state.plateList = { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 }
  state.plateTab = 'overview'
  state.plateCreateOpen = false
  state.plateCreateDraft = initialPlateCreateDraft()
  state.plateDetailDraftTaskId = ''
  state.plateDetailDraft = initialPlateDetailDraft()
  state.patternList = { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 }
  state.patternTab = 'plan'
  state.patternCreateOpen = false
  state.patternCreateDraft = initialPatternCreateDraft()
  state.patternDetailDraftTaskId = ''
  state.patternDetailDraft = initialPatternDetailDraft()
  state.firstSampleList = { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1, site: 'all' }
  state.firstSampleTab = 'overview'
  state.firstSampleCreateOpen = false
  state.firstSampleCreateDraft = initialSampleCreateDraft()
  state.firstSampleStartOpen = false
  state.firstSampleStartTaskId = ''
  state.firstSampleStartDraft = initialFirstSampleStartDraft()
  state.firstSampleResultOpen = false
  state.firstSampleResultTaskId = ''
  state.firstSampleResultDraft = initialFirstSampleResultDraft()
  state.firstSampleAcceptanceOpen = false
  state.firstSampleAcceptanceTaskId = ''
  state.firstSampleAcceptanceResult = '通过'
  state.firstSampleAcceptanceNote = ''
  state.firstSampleAcceptanceArtworkSummary = ''
  state.firstSampleAcceptanceConfirmedBy = '当前用户'
  state.firstSampleAcceptanceConfirmedAt = nowText()
  state.firstOrderList = { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1, site: 'all' }
  state.firstOrderTab = 'overview'
  state.firstOrderCreateOpen = false
  state.firstOrderCreateDraft = initialFirstOrderCreateDraft()
  state.firstOrderDetailDraftTaskId = ''
  state.firstOrderDetailDraft = initialFirstOrderDetailDraft()
  state.firstOrderStartOpen = false
  state.firstOrderStartTaskId = ''
  state.firstOrderStartDraft = initialFirstOrderStartDraft()
  state.firstOrderResultOpen = false
  state.firstOrderResultTaskId = ''
  state.firstOrderResultDraft = initialFirstOrderResultDraft()
  state.firstOrderConclusionOpen = false
  state.firstOrderConclusionTaskId = ''
  state.firstOrderConclusionResult = '通过'
  state.firstOrderConclusionNote = ''
  state.firstOrderConclusionConfirmedBy = '当前用户'
  state.firstOrderConclusionConfirmedAt = nowText()
  Object.values(runtimeLogs).forEach((map) => map.clear())
  firstSampleAcceptanceMap.clear()
  firstOrderConclusionMap.clear()
}

export function resetPcsEngineeringTaskRepositories(): void {
  resetRevisionTaskRepository()
  resetPlateMakingTaskRepository()
  resetPatternTaskRepository()
  resetFirstSampleTaskRepository()
  resetFirstOrderSampleTaskRepository()
}
