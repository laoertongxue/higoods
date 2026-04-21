import { appStore } from '../state/store.ts'
import { ensurePcsSampleDemoDataReady } from '../data/pcs-sample-demo.ts'
import { appendSampleTransition } from '../data/pcs-sample-actions.ts'
import { getSampleAssetByCode, upsertSampleAsset } from '../data/pcs-sample-asset-repository.ts'
import { createPatternAsset, getPatternAssetById, listPatternAssets } from '../data/pcs-pattern-library.ts'
import type { PatternParsedFileResult } from '../data/pcs-pattern-library-types.ts'
import { generateTechPackVersionFromPatternTask, generateTechPackVersionFromPlateTask, generateTechPackVersionFromRevisionTask } from '../data/pcs-project-technical-data-writeback.ts'
import {
  getEngineeringTaskFieldPolicy,
  getPatternTaskCompletionMissingFields,
  getPlateTaskCompletionMissingFields,
  getRevisionTaskCompletionMissingFields,
} from '../data/pcs-engineering-task-field-policy.ts'
import {
  getTechPackGenerationBlockedReason,
  getPatternTechPackActionMeta,
  getRevisionTechPackActionLabel,
  isTechPackGenerationAllowedStatus,
} from '../data/pcs-tech-pack-task-generation.ts'
import { listPatternTasks, getPatternTaskById, updatePatternTask, resetPatternTaskRepository } from '../data/pcs-pattern-task-repository.ts'
import { listPlateMakingTasks, getPlateMakingTaskById, updatePlateMakingTask, resetPlateMakingTaskRepository } from '../data/pcs-plate-making-repository.ts'
import { listRevisionTasks, getRevisionTaskById, updateRevisionTask, resetRevisionTaskRepository } from '../data/pcs-revision-task-repository.ts'
import { listFirstSampleTasks, getFirstSampleTaskById, updateFirstSampleTask, resetFirstSampleTaskRepository } from '../data/pcs-first-sample-repository.ts'
import { listPreProductionSampleTasks, getPreProductionSampleTaskById, updatePreProductionSampleTask, resetPreProductionSampleTaskRepository } from '../data/pcs-pre-production-sample-repository.ts'
import {
  completePatternTaskWithProjectRelationSync,
  completePlateMakingTaskWithProjectRelationSync,
  completeRevisionTaskWithProjectRelationSync,
  createDownstreamTasksFromRevision,
  createFirstSampleTaskWithProjectRelation,
  createPatternTaskWithProjectRelation,
  createPlateMakingTaskWithProjectRelation,
  createPreProductionSampleTaskWithProjectRelation,
  createRevisionTaskWithProjectRelation,
  syncExistingProjectEngineeringTaskNodes,
} from '../data/pcs-task-project-relation-writeback.ts'
import { findStyleArchiveByProjectId, getStyleArchiveById, listStyleArchives } from '../data/pcs-style-archive-repository.ts'
import { getProjectById, listProjects } from '../data/pcs-project-repository.ts'
import { REVISION_TASK_SOURCE_TYPE_LIST, type RevisionTaskSourceType } from '../data/pcs-task-source-normalizer.ts'
import { tokenizePatternFilename } from '../utils/pcs-pattern-library-services.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'

type ModuleKey = 'revision' | 'plate' | 'pattern' | 'firstSample' | 'preProduction'
type RevisionTab = 'plan' | 'issues' | 'samples' | 'outputs' | 'downstream' | 'logs'
type PlateTab = 'overview' | 'version' | 'bom' | 'patterns' | 'outputs' | 'downstream' | 'logs'
type PatternTab = 'plan' | 'color' | 'production' | 'samples' | 'library' | 'logs'
type FirstSampleTab = 'overview' | 'inputs' | 'logistics' | 'stockin' | 'acceptance' | 'logs'
type PreProductionTab = 'overview' | 'version' | 'logistics' | 'stockin' | 'conclusion' | 'gate' | 'logs'

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
  sourceType: RevisionTaskSourceType
  projectId: string
  styleId: string
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
  projectId: string
  title: string
  ownerName: string
  dueAt: string
  productStyleCode: string
  patternType: string
  sizeRange: string
  note: string
}

interface PatternCreateDraft {
  projectId: string
  title: string
  ownerName: string
  dueAt: string
  productStyleCode: string
  artworkType: string
  patternMode: string
  artworkName: string
  note: string
}

interface SampleCreateDraft {
  projectId: string
  title: string
  ownerName: string
  expectedArrival: string
  factoryName: string
  targetSite: string
  note: string
}

interface PreProductionCreateDraft extends SampleCreateDraft {
  patternVersion: string
  artworkVersion: string
}

interface RevisionDetailDraft {
  participantNamesText: string
  revisionVersion: string
}

interface PlateDetailDraft {
  participantNamesText: string
  patternVersion: string
}

interface PatternDetailDraft {
  artworkVersion: string
}

const PAGE_SIZE = 8

const COMMON_STATUS_META: Record<string, { label: string; className: string }> = {
  草稿: { label: '草稿', className: 'bg-slate-100 text-slate-700' },
  未开始: { label: '未开始', className: 'bg-slate-100 text-slate-700' },
  进行中: { label: '进行中', className: 'bg-blue-100 text-blue-700' },
  待确认: { label: '待确认', className: 'bg-amber-100 text-amber-700' },
  已确认: { label: '已确认', className: 'bg-emerald-100 text-emerald-700' },
  已完成: { label: '已完成', className: 'bg-green-100 text-green-700' },
  异常待处理: { label: '阻塞', className: 'bg-rose-100 text-rose-700' },
  已取消: { label: '已取消', className: 'bg-slate-100 text-slate-500' },
}

const SAMPLE_STATUS_META: Record<string, { label: string; className: string }> = {
  草稿: { label: '草稿', className: 'bg-slate-100 text-slate-700' },
  待发样: { label: '待发样', className: 'bg-slate-100 text-slate-700' },
  在途: { label: '在途', className: 'bg-blue-100 text-blue-700' },
  已到样待入库: { label: '已到样待入库', className: 'bg-orange-100 text-orange-700' },
  验收中: { label: '验收中', className: 'bg-violet-100 text-violet-700' },
  已完成: { label: '已完成', className: 'bg-emerald-100 text-emerald-700' },
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

const SAMPLE_SITE_OPTIONS = ['all', '深圳', '雅加达']

const initialRevisionCreateDraft = (): RevisionCreateDraft => ({
  sourceType: '测款触发',
  projectId: '',
  styleId: '',
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

const initialPlateCreateDraft = (): PlateCreateDraft => ({
  projectId: '',
  title: '',
  ownerName: '',
  dueAt: '',
  productStyleCode: '',
  patternType: '',
  sizeRange: '',
  note: '',
})

const initialPatternCreateDraft = (): PatternCreateDraft => ({
  projectId: '',
  title: '',
  ownerName: '',
  dueAt: '',
  productStyleCode: '',
  artworkType: '印花',
  patternMode: '定位印',
  artworkName: '',
  note: '',
})

const initialSampleCreateDraft = (): SampleCreateDraft => ({
  projectId: '',
  title: '',
  ownerName: '',
  expectedArrival: '',
  factoryName: '',
  targetSite: '深圳',
  note: '',
})

const initialPreProductionCreateDraft = (): PreProductionCreateDraft => ({
  ...initialSampleCreateDraft(),
  patternVersion: '',
  artworkVersion: '',
})

const state = {
  notice: null as string | null,
  revisionList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 } as ListState,
  revisionTab: 'plan' as RevisionTab,
  revisionCreateOpen: false,
  revisionCreateDraft: initialRevisionCreateDraft(),
  revisionDetailDraftTaskId: '',
  revisionDetailDraft: { participantNamesText: '', revisionVersion: '' } as RevisionDetailDraft,
  imagePreview: { open: false, url: '', title: '' },

  plateList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 } as ListState,
  plateTab: 'overview' as PlateTab,
  plateCreateOpen: false,
  plateCreateDraft: initialPlateCreateDraft(),
  plateDetailDraftTaskId: '',
  plateDetailDraft: { participantNamesText: '', patternVersion: '' } as PlateDetailDraft,

  patternList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 } as ListState,
  patternTab: 'plan' as PatternTab,
  patternCreateOpen: false,
  patternCreateDraft: initialPatternCreateDraft(),
  patternDetailDraftTaskId: '',
  patternDetailDraft: { artworkVersion: '' } as PatternDetailDraft,

  firstSampleList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1, site: 'all' } as SampleListState,
  firstSampleTab: 'overview' as FirstSampleTab,
  firstSampleCreateOpen: false,
  firstSampleCreateDraft: initialSampleCreateDraft(),
  firstSampleAcceptanceOpen: false,
  firstSampleAcceptanceTaskId: '',
  firstSampleAcceptanceResult: '通过',
  firstSampleAcceptanceNote: '',

  preProductionList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1, site: 'all' } as SampleListState,
  preProductionTab: 'overview' as PreProductionTab,
  preProductionCreateOpen: false,
  preProductionCreateDraft: initialPreProductionCreateDraft(),
  preProductionConclusionOpen: false,
  preProductionConclusionTaskId: '',
  preProductionConclusionResult: '通过',
  preProductionConclusionNote: '',
}

const runtimeLogs: Record<ModuleKey, Map<string, EngineeringLog[]>> = {
  revision: new Map(),
  plate: new Map(),
  pattern: new Map(),
  firstSample: new Map(),
  preProduction: new Map(),
}

const firstSampleAcceptanceMap = new Map<string, { result: string; note: string; updatedAt: string }>()
const preProductionConclusionMap = new Map<string, { result: string; note: string; updatedAt: string }>()
const preProductionGateMap = new Map<string, { confirmedBy: string; confirmedAt: string }>()

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

function renderPageHeader(title: string, description: string, actionLabel: string, action: string): string {
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

function renderMetricButton(label: string, value: number, active: boolean, quickFilter: string, actionPrefix: string, description: string): string {
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
    <div class="grid gap-4 ${columns === 4 ? 'md:grid-cols-4' : columns === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}">
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

function ensureRevisionDetailDraft(task: ReturnType<typeof getRevisionTaskById>): RevisionDetailDraft {
  if (!task) return { participantNamesText: '', revisionVersion: '' }
  if (state.revisionDetailDraftTaskId !== task.revisionTaskId) {
    state.revisionDetailDraftTaskId = task.revisionTaskId
    state.revisionDetailDraft = {
      participantNamesText: task.participantNames.join('、'),
      revisionVersion: task.revisionVersion,
    }
  }
  return state.revisionDetailDraft
}

function ensurePlateDetailDraft(task: ReturnType<typeof getPlateMakingTaskById>): PlateDetailDraft {
  if (!task) return { participantNamesText: '', patternVersion: '' }
  if (state.plateDetailDraftTaskId !== task.plateTaskId) {
    state.plateDetailDraftTaskId = task.plateTaskId
    state.plateDetailDraft = {
      participantNamesText: task.participantNames.join('、'),
      patternVersion: task.patternVersion,
    }
  }
  return state.plateDetailDraft
}

function ensurePatternDetailDraft(task: ReturnType<typeof getPatternTaskById>): PatternDetailDraft {
  if (!task) return { artworkVersion: '' }
  if (state.patternDetailDraftTaskId !== task.patternTaskId) {
    state.patternDetailDraftTaskId = task.patternTaskId
    state.patternDetailDraft = {
      artworkVersion: task.artworkVersion,
    }
  }
  return state.patternDetailDraft
}

function renderTaskCompletionSection(
  policy: ReturnType<typeof getEngineeringTaskFieldPolicy>,
  completionMissingFields: string[],
  detailEditorHtml: string,
): string {
  return renderSectionCard(
    '任务补齐项',
    `
      <div class="grid gap-4 xl:grid-cols-3">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p class="text-sm font-medium text-slate-900">节点创建必填</p>
          <ul class="mt-3 space-y-2 text-sm text-slate-600">
            ${policy.createRequiredFields.map((field) => `<li><span class="font-medium text-slate-900">${escapeHtml(field.label)}</span></li>`).join('')}
          </ul>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p class="text-sm font-medium text-slate-900">实例详情补齐</p>
          <ul class="mt-3 space-y-2 text-sm text-slate-600">
            ${policy.detailEditableFields.map((field) => `<li><span class="font-medium text-slate-900">${escapeHtml(field.label)}</span></li>`).join('')}
          </ul>
          <div class="mt-4 border-t border-slate-200 pt-4">${detailEditorHtml}</div>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p class="text-sm font-medium text-slate-900">完成回写</p>
          <ul class="mt-3 space-y-2 text-sm text-slate-600">
            ${policy.nodeWritebacks.map((item) => `<li><span class="font-medium text-slate-900">${escapeHtml(item.phase)}</span><span class="text-slate-500">：${escapeHtml(item.resultType)} / ${escapeHtml(item.pendingActionType || '无待办')}</span></li>`).join('')}
          </ul>
          <div class="mt-4 rounded-lg border ${completionMissingFields.length === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'} px-3 py-3 text-sm">
            ${
              completionMissingFields.length === 0
                ? '当前实例补齐字段已满足，允许完成任务。'
                : `当前仍缺少：${escapeHtml(completionMissingFields.join('、'))}。完成任务前需要先补齐。`
            }
          </div>
        </div>
      </div>
    `,
  )
}

function renderTextInput(label: string, field: string, value: string, placeholder: string): string {
  return `
    <label class="flex flex-col gap-2 text-sm text-slate-600">
      <span>${escapeHtml(label)}</span>
      <input class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" data-pcs-engineering-field="${escapeHtml(field)}" />
    </label>
  `
}

function renderTextarea(label: string, field: string, value: string, placeholder: string): string {
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
        <div>
          <p class="text-sm font-medium text-slate-900">证据图片</p>
          <p class="mt-1 text-xs text-slate-500">支持上传多张图片，默认展示缩略图，点击可查看大图。</p>
        </div>
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

function getRevisionDownstreamTasks(task: { revisionTaskId: string; revisionTaskCode: string }) {
  return listPatternTasks().filter(
    (item) => item.upstreamObjectId === task.revisionTaskId || item.upstreamObjectCode === task.revisionTaskCode,
  )
}

function getRevisionDownstreamFlag(task: { revisionTaskId: string; revisionTaskCode: string }): string {
  const count = getRevisionDownstreamTasks(task).length
  return count > 0
    ? `<span class="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">有 ${count} 个</span>`
    : '<span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">无</span>'
}

function getRevisionScopeText(scopeCodes: string[], scopeNames: string[]): string {
  return scopeNames.join('、') || scopeCodes.join('、') || '-'
}

function canCreateRevisionPatternTask(scopeCodes: string[], sourceType: RevisionTaskSourceType, projectId: string): boolean {
  return scopeCodes.includes('PRINT') && sourceType === '测款触发' && Boolean(projectId)
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
      artworkType: task.artworkType,
      patternMode: task.patternMode,
      artworkVersion: task.artworkVersion,
    },
  }

  const asset = createPatternAsset({
    patternName: task.artworkName || task.title,
    aliases: [task.patternTaskCode],
    usageType: task.patternMode || '定位印',
    category: task.artworkType || '几何图形',
    categoryPrimary: task.artworkType === '印花' ? '植物与花卉' : '几何与抽象',
    categorySecondary: task.artworkType === '印花' ? '写实花卉' : '几何图形',
    styleTags: [task.artworkType, task.patternMode].filter(Boolean),
    colorTags: ['综合色'],
    hotFlag: false,
    sourceType: '自研',
    sourceNote: `由花型任务 ${task.patternTaskCode} 沉淀`,
    applicableCategories: [task.productStyleCode || '成衣'],
    applicableParts: ['前片', '后片'],
    relatedPartTemplateIds: [],
    processDirection: task.note || '按花型任务输出使用',
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
    status: task.status === '已完成' ? task.status : '已完成',
    note: `${task.note ? `${task.note}；` : ''}已沉淀花型库：${asset.pattern_code}`,
    updatedAt: nowText(),
    updatedBy: '当前用户',
  })
  pushRuntimeLog('pattern', task.patternTaskId, '沉淀花型库', `已生成花型主档 ${asset.pattern_code}。`)
  return { ok: true, message: `花型已进入花型库：${asset.pattern_code}`, assetId: asset.id }
}

function ensureSampleAssetForTask(input: {
  module: 'firstSample' | 'preProduction'
  taskId: string
  sampleCode: string
  sampleName: string
  responsibleSite: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemTypeCode: string
  workItemTypeName: string
  sourceDocType: '首版样衣打样任务' | '产前版样衣任务'
  sourceDocCode: string
}): { assetId: string; assetCode: string; existed: boolean } {
  ensurePcsSampleDemoDataReady()
  const existed = getSampleAssetByCode(input.sampleCode)
  if (existed) {
    return { assetId: existed.sampleAssetId, assetCode: existed.sampleCode, existed: true }
  }

  const assetId = `${input.module}_${input.taskId}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
  upsertSampleAsset({
    sampleAssetId: assetId,
    sampleCode: input.sampleCode,
    sampleName: input.sampleName,
    sampleType: input.module === 'firstSample' ? '首版样衣' : '产前版样衣',
    responsibleSite: input.responsibleSite,
    inventoryStatus: '在库待核对',
    availabilityStatus: '不可用',
    locationType: '仓库',
    locationCode: `${input.responsibleSite}-RECV`.replace(/[^a-zA-Z0-9]/g, '-'),
    locationDisplay: `${input.responsibleSite}收货区`,
    custodianType: '仓管',
    custodianName: `${input.responsibleSite}仓管`,
    projectId: input.projectId,
    projectCode: input.projectCode,
    projectName: input.projectName,
    projectNodeId: input.projectNodeId,
    workItemTypeCode: input.workItemTypeCode,
    workItemTypeName: input.workItemTypeName,
    sourceDocType: input.sourceDocType,
    sourceDocId: input.taskId,
    sourceDocCode: input.sourceDocCode,
    lastEventId: '',
    lastEventType: '',
    lastEventTime: nowText(),
    createdAt: nowText(),
    createdBy: '当前用户',
    updatedAt: nowText(),
    updatedBy: '当前用户',
    legacyProjectRef: '',
    legacyWorkItemInstanceId: '',
  })

  return { assetId, assetCode: input.sampleCode, existed: false }
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

function renderProjectContext(task: { projectId: string; projectCode: string; projectName: string; projectNodeId: string; workItemTypeName: string; sourceType: string; productStyleCode?: string; spuCode?: string }): string {
  return renderSectionCard(
    '项目与来源',
    renderKeyValueGrid(
      [
        { label: '商品项目', value: projectButton(task.projectId, task.projectCode, task.projectName) },
        { label: '工作项节点', value: projectNodeButton(task.projectId, task.projectNodeId, task.workItemTypeName) },
        { label: '来源类型', value: escapeHtml(task.sourceType) },
        { label: '款式档案', value: styleArchiveLinkByProject(task.projectId) },
        { label: '款式编码', value: escapeHtml(task.productStyleCode || task.spuCode || '-') },
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
    return `
      <tr class="hover:bg-slate-50/70">
        <td class="px-4 py-4">
          <div class="space-y-1">
            <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/patterns/revision/${escapeHtml(task.revisionTaskId)}">${escapeHtml(task.revisionTaskCode)}</button>
            <p class="text-xs text-slate-500">${escapeHtml(task.title)}</p>
          </div>
        </td>
        <td class="px-4 py-4">${escapeHtml(task.sourceType)}</td>
        <td class="px-4 py-4">
          <div class="space-y-1">
            <div>${styleArchiveButton(style.styleId, style.styleCode, style.styleName)}</div>
            <p class="text-xs text-slate-500">${escapeHtml(style.styleName || '未补充款式名称')}</p>
          </div>
        </td>
        <td class="px-4 py-4">${projectButton(task.projectId, task.projectCode, task.projectName)}</td>
        <td class="px-4 py-4">${escapeHtml(getRevisionScopeText(task.revisionScopeCodes, task.revisionScopeNames))}</td>
        <td class="px-4 py-4">${getRevisionDownstreamFlag(task)}</td>
        <td class="px-4 py-4">${renderStatusBadge(task.status)}</td>
        <td class="px-4 py-4">${escapeHtml(task.ownerName)}</td>
        <td class="px-4 py-4">${escapeHtml(formatDateTime(task.dueAt))}${overdue ? '<span class="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] text-rose-700">超期</span>' : ''}</td>
        <td class="px-4 py-4">${task.linkedTechPackVersionId ? `${techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, task.linkedTechPackVersionCode || task.linkedTechPackVersionLabel || '查看关联技术包')}<div class="mt-1">${techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, '查看版本日志')}</div>` : '<span class="text-slate-400">未生成</span>'}</td>
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
      ${renderPageHeader('改版任务', '改版任务由商品项目节点推进自动创建；本页仅查看任务结果、补充问题信息和跟踪下游花型任务。', '', '')}
      ${renderListFilters({
        searchPlaceholder: '搜索任务编号 / 商品项目 / 款式 / 负责人 / 参考对象',
        listState: state.revisionList,
        searchField: 'revision-search',
        statusField: 'revision-status',
        ownerField: 'revision-owner',
        sourceField: 'revision-source',
        statusOptions: ['未开始', '进行中', '待确认', '已确认', '已完成', '异常待处理', '已取消'],
        ownerOptions: owners,
        sourceOptions: sources,
      })}
      <section class="grid gap-4 md:grid-cols-5">
        ${renderMetricButton('全部任务', tasks.length, state.revisionList.quickFilter === 'all', 'all', 'set-revision-quick-filter', '当前改版任务总量')}
        ${renderMetricButton('我的任务', tasks.filter((item) => item.ownerName === '李版师').length, state.revisionList.quickFilter === 'mine', 'mine', 'set-revision-quick-filter', '当前用户默认视角')}
        ${renderMetricButton('待确认', tasks.filter((item) => item.status === '待确认').length, state.revisionList.quickFilter === 'pending-review', 'pending-review', 'set-revision-quick-filter', '待确认改版输出')}
        ${renderMetricButton('已确认未写包', tasks.filter((item) => item.projectId && item.status === '已确认' && !item.linkedTechPackVersionId).length, state.revisionList.quickFilter === 'confirmed-no-output', 'confirmed-no-output', 'set-revision-quick-filter', '确认后待写技术包')}
        ${renderMetricButton('超期任务', tasks.filter((item) => isOverdue(item.dueAt, item.status === '已完成' || item.status === '已取消')).length, state.revisionList.quickFilter === 'overdue', 'overdue', 'set-revision-quick-filter', '超过计划完成时间')}
      </section>
      ${renderDataTable(['改版任务', '来源', '关联款式', '关联商品项目', '改版范围', '是否有下游任务', '状态', '负责人', '截止时间', '技术包', '操作'], rows, '暂无改版任务数据', renderPagination(state.revisionList.currentPage, filtered.length, 'change-revision-page'))}
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

function renderRevisionDownstream(task: ReturnType<typeof getRevisionTaskById>): string {
  if (!task) return ''
  const rows = getRevisionDownstreamTasks(task).map((item) => ({
    type: '花型任务',
    code: item.patternTaskCode,
    title: item.title,
    status: item.status,
    path: `/pcs/patterns/colors/${item.patternTaskId}`,
  }))
  const emptyText = !task.projectId
    ? '当前改版任务未关联商品项目，不能创建花型下游任务。'
    : !task.revisionScopeCodes.includes('PRINT')
      ? '当前改版范围未涉及花型，未生成花型下游任务。'
      : '当前改版任务尚未生成花型下游任务。'
  return renderSectionCard(
    '下游任务',
    rows.length > 0
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
      : `<div class="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">${escapeHtml(emptyText)}</div>`,
  )
}

function renderRevisionDetailPage(revisionTaskId: string): string {
  syncExistingProjectEngineeringTaskNodes('系统同步')
  const task = getRevisionTaskById(revisionTaskId)
  if (!task) return renderEmptyDetail('改版任务', '/pcs/patterns/revision')
  const detailDraft = ensureRevisionDetailDraft(task)
  const fieldPolicy = getEngineeringTaskFieldPolicy('REVISION_TASK')
  const completionMissingFields = getRevisionTaskCompletionMissingFields(task)

  const style = getRevisionTaskStyle(task)
  const downstreamTasks = getRevisionDownstreamTasks(task)
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
      ? [`<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="complete-revision-task" data-task-id="${escapeHtml(task.revisionTaskId)}">完成任务</button>`]
      : []),
    ...(task.projectId && isTechPackGenerationAllowedStatus(task.status)
      ? [`<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="revision-generate-tech-pack" data-task-id="${escapeHtml(task.revisionTaskId)}">${escapeHtml(getRevisionTechPackActionLabel())}</button>`]
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
    { key: 'plan', label: '改版方案' },
    { key: 'issues', label: '问题点与证据' },
    { key: 'samples', label: '关联样衣' },
    { key: 'outputs', label: '产出物' },
    { key: 'downstream', label: '下游任务' },
    { key: 'logs', label: '日志与审批' },
  ], 'set-revision-tab')

  const plan = renderSectionCard(
    '改版方案',
    `
      ${renderKeyValueGrid(
        [
          { label: '商品项目', value: projectButton(task.projectId, task.projectCode, task.projectName) },
          { label: '工作项节点', value: projectNodeButton(task.projectId, task.projectNodeId, task.workItemTypeName) },
          { label: '改版范围', value: escapeHtml(getRevisionScopeText(task.revisionScopeCodes, task.revisionScopeNames)) },
          { label: '来源类型', value: escapeHtml(task.sourceType) },
          { label: '来源对象', value: escapeHtml(task.upstreamObjectCode || task.upstreamObjectId || '—') },
          { label: '款式档案', value: styleArchiveButton(style.styleId, style.styleCode, style.styleName) },
        ],
        3,
      )}
      <div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p class="font-medium text-slate-900">参考对象</p>
        <p class="mt-2">${escapeHtml(task.referenceObjectId ? `${task.referenceObjectType || '参考对象'} · ${task.referenceObjectCode || task.referenceObjectId}${task.referenceObjectName ? ` · ${task.referenceObjectName}` : ''}` : '当前任务未单独选择参考对象。')}</p>
      </div>
      <div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p class="font-medium text-slate-900">改版说明</p>
        <p class="mt-2">${escapeHtml(task.note || '已记录改版方案，等待责任人继续推进。')}</p>
      </div>
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
      : '<div class="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">当前商品项目暂无关联打样记录。</div>',
  )

  const outputs = renderSectionCard(
    '产出物',
    `
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">技术包产出</p>
          <div class="mt-2 text-sm text-slate-900">${task.linkedTechPackVersionId ? `${techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, task.linkedTechPackVersionCode || task.linkedTechPackVersionLabel || '查看关联技术包')}<span class="mx-2 text-slate-300">/</span>${techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, '查看版本日志')}` : '尚未建立技术包版本'}</div>
          <p class="mt-2 text-xs text-slate-500">${escapeHtml(task.linkedTechPackUpdatedAt ? `最近写回：${formatDateTime(task.linkedTechPackUpdatedAt)}` : getTechPackGenerationBlockedReason(task.status) || (task.projectId ? '当前任务可写入技术包版本。' : '当前任务未关联商品项目，暂不写入技术包版本。'))}</p>
        </div>
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">花型下游状态</p>
          <p class="mt-2 text-sm text-slate-900">${downstreamTasks.length > 0 ? `已生成 ${downstreamTasks.length} 个花型任务` : '当前未生成花型下游任务'}</p>
          <p class="mt-2 text-xs text-slate-500">${escapeHtml(
            !task.projectId
              ? '未关联商品项目，当前不创建花型下游任务。'
              : !task.revisionScopeCodes.includes('PRINT')
                ? '改版范围未涉及花型，当前不创建花型下游任务。'
                : '涉及花型的改版任务可在创建时同步生成花型任务。',
          )}</p>
        </div>
      </div>
    `,
  )
  const completionSection = renderTaskCompletionSection(
    fieldPolicy,
    completionMissingFields,
    `
      <div class="grid gap-4 md:grid-cols-2">
        ${renderTextInput('参与人', 'revision-detail-participants', detailDraft.participantNamesText, '多个姓名请用顿号分隔')}
        ${renderTextInput('改版版次', 'revision-detail-version', detailDraft.revisionVersion, '例如：R2')}
      </div>
      <div class="mt-4 flex justify-end">
        <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="save-revision-detail-fields" data-task-id="${escapeHtml(task.revisionTaskId)}">保存实例补齐字段</button>
      </div>
    `,
  )

  const mainContent = state.revisionTab === 'plan'
    ? `${plan}${completionSection}${renderRevisionContext(task)}`
    : state.revisionTab === 'issues'
      ? renderRevisionIssues(task)
      : state.revisionTab === 'samples'
        ? samples
        : state.revisionTab === 'outputs'
          ? outputs
          : state.revisionTab === 'downstream'
            ? renderRevisionDownstream(task)
            : renderSectionCard('日志与审批', renderLogs(logs))

  const aside = `
    <div class="space-y-4">
      ${renderSectionCard(
        '关键摘要',
        renderKeyValueGrid(
          [
            { label: '负责人', value: escapeHtml(task.ownerName) },
            { label: '参与人', value: escapeHtml(task.participantNames.join('、') || '-') },
            { label: '截止时间', value: escapeHtml(formatDateTime(task.dueAt)) },
            { label: '技术包状态', value: escapeHtml(task.linkedTechPackVersionStatus || '未写回') },
            { label: '下游任务', value: downstreamTasks.length > 0 ? escapeHtml(`花型任务 ${downstreamTasks.length} 个`) : '无' },
            { label: '当前动作', value: escapeHtml(isTechPackGenerationAllowedStatus(task.status) && task.projectId ? getRevisionTechPackActionLabel() : '暂无可执行技术包动作') },
          ],
          2,
        ),
      )}
      ${renderSectionCard(
        '正式对象核对',
        renderKeyValueGrid(
          [
            { label: '正式工作项', value: projectNodeButton(task.projectId, task.projectNodeId, '关联测款结论记录') },
            { label: '款式档案', value: styleArchiveButton(style.styleId, style.styleCode, style.styleName) },
            { label: '来源任务编号', value: escapeHtml(task.upstreamObjectCode || task.upstreamObjectId || '-') },
            { label: '正式状态', value: renderStatusBadge(task.status) },
          ],
          2,
        ),
      )}
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
      ${renderPreviewImageModal()}
    </div>
  `
}

function renderRevisionCreateDialog(): string {
  const draft = state.revisionCreateDraft
  const selectedStyle = getStyleArchiveById(draft.styleId)
  const selectedProjectDefaults = draft.projectId ? getProjectDefaultValues(draft.projectId) : { ownerName: '', styleId: '', styleCode: '', styleName: '' }
  const projectStyle = selectedProjectDefaults.styleId ? getStyleArchiveById(selectedProjectDefaults.styleId) : null
  const showProjectField = draft.sourceType === '测款触发'
  const showStyleField = draft.sourceType !== '测款触发'
  const canCreatePatternTask = canCreateRevisionPatternTask(draft.scopeCodes, draft.sourceType, draft.projectId)
  const body = `
    <div class="grid gap-4 md:grid-cols-2">
      ${renderSelectInput('来源类型', 'revision-create-source-type', draft.sourceType, REVISION_TASK_SOURCE_TYPE_LIST.map((item) => ({ value: item, label: item })))}
      ${showProjectField ? renderSelectInput('商品项目', 'revision-create-project', draft.projectId, buildProjectOptions()) : showStyleField ? renderSelectInput('款式档案', 'revision-create-style-id', draft.styleId, buildStyleArchiveOptions()) : ''}
      ${renderSelectInput('负责人', 'revision-create-owner', draft.ownerName, buildRevisionOwnerOptions())}
      ${renderTextInput('任务标题', 'revision-create-title', draft.title, '例如：碎花连衣裙改版（腰节与花型）')}
      ${renderDateTimeInput('截止时间', 'revision-create-due-at', draft.dueAt)}
    </div>
    <div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <p class="text-xs text-slate-500">当前款式</p>
          <p class="mt-1 text-sm text-slate-900">${showProjectField ? escapeHtml(projectStyle?.styleCode ? `${projectStyle.styleCode} · ${projectStyle.styleName}` : '所选项目暂未关联款式档案') : escapeHtml(selectedStyle?.styleCode ? `${selectedStyle.styleCode} · ${selectedStyle.styleName}` : '请先选择款式档案')}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">下游创建</p>
          <p class="mt-1 text-sm text-slate-900">${escapeHtml(canCreatePatternTask ? '涉及花型调整，将同步创建花型任务' : draft.scopeCodes.includes('PRINT') ? '涉及花型但未关联商品项目，暂不自动创建花型任务' : '当前范围未涉及花型')}</p>
        </div>
      </div>
    </div>
    <div class="mt-4">
      <div class="space-y-2 text-sm text-slate-600">
        <span>改版范围</span>
        <div class="grid gap-2 sm:grid-cols-2">
          ${REVISION_SCOPE_OPTIONS.map((option) => `
            <label class="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" ${draft.scopeCodes.includes(option.value) ? 'checked' : ''} data-pcs-engineering-action="toggle-revision-scope" data-scope-code="${escapeHtml(option.value)}" />
              <span>${escapeHtml(option.label)}</span>
            </label>
          `).join('')}
        </div>
      </div>
    </div>
    <div class="mt-4 grid gap-4 md:grid-cols-2">
      ${renderTextarea('问题点', 'revision-create-issue-summary', draft.issueSummary, '补充本次改版要解决的核心问题')}
      <div class="space-y-4">
        ${renderTextarea('证据说明', 'revision-create-evidence-summary', draft.evidenceSummary, '补充评审、反馈、对比记录等证据')}
        ${renderRevisionEvidenceUploader(draft.evidenceImageUrls)}
      </div>
    </div>
    <div class="mt-4">
      ${renderTextarea('说明', 'revision-create-note', draft.note, '补充改版方案、边界说明和执行要求')}
    </div>
    ${draft.scopeCodes.includes('PRINT')
      ? `
        <div class="mt-4 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700">
          <label class="inline-flex items-center gap-2">
            <input type="checkbox" ${draft.createPatternTask ? 'checked' : ''} ${canCreatePatternTask ? '' : 'disabled'} data-pcs-engineering-action="toggle-revision-create-pattern-task" />
            <span>创建改版任务后同步创建花型任务</span>
          </label>
          <p class="mt-2 text-xs text-slate-500">${escapeHtml(canCreatePatternTask ? '本次改版涉及花型变更，创建后会同步生成花型任务。' : '只有测款触发且已关联商品项目的改版任务，才可同步创建花型下游任务。')}</p>
        </div>
      `
      : ''}
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

function renderPlatePieces(task: ReturnType<typeof getPlateMakingTaskById>): string {
  if (!task) return ''
  const pieces = [
    { name: '前后主身片', format: 'DXF', count: 2, size: task.sizeRange || '待补充', note: '主版片' },
    { name: '袖片', format: 'DXF', count: 2, size: task.sizeRange || '待补充', note: '袖型跟随主版' },
    { name: '领口/贴边', format: 'PDF', count: 2, size: task.sizeRange || '待补充', note: '需配合工艺说明' },
  ]
  return renderSectionCard(
    '纸样与版片',
    `
      <div class="space-y-3">
        ${pieces.map((piece) => `
          <div class="grid gap-3 rounded-lg border border-slate-200 px-4 py-3 md:grid-cols-4">
            <div>
              <p class="text-xs text-slate-500">版片名称</p>
              <p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(piece.name)}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">文件格式</p>
              <p class="mt-1 text-sm text-slate-900">${escapeHtml(piece.format)}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">适用尺码</p>
              <p class="mt-1 text-sm text-slate-900">${escapeHtml(piece.size)}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">说明</p>
              <p class="mt-1 text-sm text-slate-900">${escapeHtml(piece.note)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `,
  )
}

function renderPlateListPage(): string {
  const tasks = listPlateMakingTasks()
  const filtered = getPlateTasksFiltered()
  const owners = getOwners(tasks)
  const sources = getSources(tasks)
  const paged = paginate(filtered, state.plateList.currentPage)
  const rows = paged.map((task) => `
    <tr class="hover:bg-slate-50/70">
      <td class="px-4 py-4">
        <div class="space-y-1">
          <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/patterns/plate-making/${escapeHtml(task.plateTaskId)}">${escapeHtml(task.plateTaskCode)}</button>
          <p class="text-xs text-slate-500">${escapeHtml(task.title)}</p>
        </div>
      </td>
      <td class="px-4 py-4">${projectButton(task.projectId, task.projectCode, task.projectName)}</td>
      <td class="px-4 py-4">${renderStatusBadge(task.status)}</td>
      <td class="px-4 py-4">${escapeHtml(task.patternType || '-')}</td>
      <td class="px-4 py-4">${escapeHtml(task.sizeRange || '-')}</td>
      <td class="px-4 py-4">${escapeHtml(task.patternVersion || '-')}</td>
      <td class="px-4 py-4">${escapeHtml(task.ownerName)}</td>
      <td class="px-4 py-4">${task.linkedTechPackVersionId ? `${techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, task.linkedTechPackVersionCode || task.linkedTechPackVersionLabel || '查看关联技术包')}<div class="mt-1">${techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, '查看版本日志')}</div>` : '<span class="text-slate-400">未写回</span>'}</td>
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
      ${renderPageHeader('制版任务', '制版任务由商品项目节点推进自动创建；本页仅查看任务状态、纸样输出和技术包写入结果。', '', '')}
      ${renderListFilters({
        searchPlaceholder: '搜索任务编号 / 商品项目 / 款式 / 负责人',
        listState: state.plateList,
        searchField: 'plate-search',
        statusField: 'plate-status',
        ownerField: 'plate-owner',
        sourceField: 'plate-source',
        statusOptions: ['未开始', '进行中', '待确认', '已确认', '已完成', '异常待处理', '已取消'],
        ownerOptions: owners,
        sourceOptions: sources,
      })}
      <section class="grid gap-4 md:grid-cols-5">
        ${renderMetricButton('全部任务', tasks.length, state.plateList.quickFilter === 'all', 'all', 'set-plate-quick-filter', '制版任务总量')}
        ${renderMetricButton('我的任务', tasks.filter((item) => item.ownerName === '王版师').length, state.plateList.quickFilter === 'mine', 'mine', 'set-plate-quick-filter', '当前默认个人视角')}
        ${renderMetricButton('待确认', tasks.filter((item) => item.status === '待确认').length, state.plateList.quickFilter === 'pending-review', 'pending-review', 'set-plate-quick-filter', '等待版师确认')}
        ${renderMetricButton('已确认待写包', tasks.filter((item) => item.status === '已确认' && !item.linkedTechPackVersionId).length, state.plateList.quickFilter === 'confirmed-no-output', 'confirmed-no-output', 'set-plate-quick-filter', '待回写技术包')}
        ${renderMetricButton('超期任务', tasks.filter((item) => isOverdue(item.dueAt, item.status === '已完成' || item.status === '已取消')).length, state.plateList.quickFilter === 'overdue', 'overdue', 'set-plate-quick-filter', '超过计划完成时间')}
      </section>
      ${renderDataTable(['制版任务', '商品项目', '状态', '版型类型', '尺码范围', '版次', '负责人', '技术包', '操作'], rows, '暂无制版任务数据', renderPagination(state.plateList.currentPage, filtered.length, 'change-plate-page'))}
      ${renderPlateCreateDialog()}
    </div>
  `
}

function renderPlateCreateDialog(): string {
  const draft = state.plateCreateDraft
  const body = `
    <div class="grid gap-4 md:grid-cols-2">
      ${renderSelectInput('商品项目', 'plate-create-project', draft.projectId, buildProjectOptions())}
      ${renderTextInput('负责人', 'plate-create-owner', draft.ownerName, '默认取项目负责人')}
      ${renderTextInput('任务标题', 'plate-create-title', draft.title, '例如：制版-碎花连衣裙(P1)')}
      ${renderTextInput('截止时间', 'plate-create-due-at', draft.dueAt, 'YYYY-MM-DD HH:mm:ss')}
      ${renderTextInput('款式编码', 'plate-create-style-code', draft.productStyleCode, 'SPU-xxxx')}
      ${renderTextInput('版型类型', 'plate-create-pattern-type', draft.patternType, '连衣裙 / 衬衫 / 外套')}
      ${renderTextInput('尺码范围', 'plate-create-size-range', draft.sizeRange, 'S-XL / M-2XL')}
    </div>
    <div class="mt-4">
      ${renderTextarea('说明', 'plate-create-note', draft.note, '项目模板阶段制版，后续可继续写入正式技术包')}
    </div>
  `
  return renderDialog(state.plateCreateOpen, '新建制版任务', body, 'close-plate-create', 'submit-plate-create', '创建制版任务')
}

function renderPlateDetailPage(plateTaskId: string): string {
  syncExistingProjectEngineeringTaskNodes('系统同步')
  const task = getPlateMakingTaskById(plateTaskId)
  if (!task) return renderEmptyDetail('制版任务', '/pcs/patterns')
  const detailDraft = ensurePlateDetailDraft(task)
  const fieldPolicy = getEngineeringTaskFieldPolicy('PATTERN_TASK')
  const completionMissingFields = getPlateTaskCompletionMissingFields(task)
  const downstreamFirst = listFirstSampleTasks().filter((item) => item.upstreamObjectId === task.plateTaskId || item.upstreamObjectCode === task.plateTaskCode)
  const downstreamPre = listPreProductionSampleTasks().filter((item) => item.upstreamObjectId === task.plateTaskId || item.upstreamObjectCode === task.plateTaskCode)
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

  const tabBar = renderTabBar(state.plateTab, [
    { key: 'overview', label: '概览' },
    { key: 'version', label: '版次与输入' },
    { key: 'bom', label: '技术包写回' },
    { key: 'patterns', label: '纸样版本' },
    { key: 'outputs', label: '产出物' },
    { key: 'downstream', label: '下游打样' },
    { key: 'logs', label: '日志' },
  ], 'set-plate-tab')

  const overview = `${renderProjectContext(task)}${renderSectionCard('版型信息', renderKeyValueGrid([
    { label: '版型类型', value: escapeHtml(task.patternType || '-') },
    { label: '尺码范围', value: escapeHtml(task.sizeRange || '-') },
    { label: '当前版次', value: escapeHtml(task.patternVersion || '-') },
    { label: '来源对象', value: escapeHtml(task.upstreamObjectCode || task.upstreamObjectId || '-') },
    { label: '负责人', value: escapeHtml(task.ownerName) },
    { label: '参与人', value: escapeHtml(task.participantNames.join('、') || '-') },
  ], 3))}${renderTaskCompletionSection(
    fieldPolicy,
    completionMissingFields,
    `
      <div class="grid gap-4 md:grid-cols-2">
        ${renderTextInput('参与人', 'plate-detail-participants', detailDraft.participantNamesText, '多个姓名请用顿号分隔')}
        ${renderTextInput('制版版次', 'plate-detail-version', detailDraft.patternVersion, '例如：P2')}
      </div>
      <div class="mt-4 flex justify-end">
        <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="save-plate-detail-fields" data-task-id="${escapeHtml(task.plateTaskId)}">保存实例补齐字段</button>
      </div>
    `,
  )}`

  const version = renderSectionCard(
    '版次与输入',
    `
      <div class="space-y-4">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p class="font-medium text-slate-900">输入来源</p>
          <p class="mt-2">来源类型：${escapeHtml(task.sourceType)}，来源对象：${escapeHtml(task.upstreamObjectCode || task.upstreamObjectId || '项目模板阶段')}</p>
          <p class="mt-2">正式款式：${styleArchiveLinkByProject(task.projectId)}</p>
        </div>
        ${renderKeyValueGrid([
          { label: '计划完成时间', value: escapeHtml(formatDateTime(task.dueAt)) },
          { label: '优先级', value: escapeHtml(task.priorityLevel) },
          { label: '当前状态', value: renderStatusBadge(task.status) },
          { label: '最近更新时间', value: escapeHtml(formatDateTime(task.updatedAt)) },
        ], 2)}
      </div>
    `,
  )

  const bom = renderSectionCard(
    '技术包写回',
    `
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">正式技术包版本</p>
          <div class="mt-2 text-sm text-slate-900">${task.linkedTechPackVersionId ? `${techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, task.linkedTechPackVersionCode || task.linkedTechPackVersionLabel || '查看关联技术包')}<span class="mx-2 text-slate-300">/</span>${techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, '查看版本日志')}` : '尚未写入'}</div>
          <p class="mt-2 text-xs text-slate-500">${escapeHtml(task.linkedTechPackUpdatedAt ? `最近写回：${formatDateTime(task.linkedTechPackUpdatedAt)}` : '状态达到已确认/已完成后可写入正式技术包。')}</p>
        </div>
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">FCS 对齐要求</p>
          <p class="mt-2 text-sm text-slate-900">制版任务写回的是 PCS 正式技术包版本，页面与内容沿用 FCS 技术包结构，不另造副本。</p>
        </div>
      </div>
    `,
  )

  const outputs = renderSectionCard(
    '产出物',
    `
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">纸样输出</p>
          <p class="mt-2 text-sm text-slate-900">${escapeHtml(task.patternType || '纸样')} · ${escapeHtml(task.patternVersion || '待确认')}</p>
          <p class="mt-2 text-xs text-slate-500">尺码范围：${escapeHtml(task.sizeRange || '-')}</p>
        </div>
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">下游联动</p>
          <p class="mt-2 text-sm text-slate-900">${escapeHtml(downstreamFirst.length + downstreamPre.length)} 条样衣任务已与当前制版任务串联。</p>
        </div>
      </div>
    `,
  )

  const downstream = renderSectionCard(
    '下游打样',
    downstreamFirst.length + downstreamPre.length > 0
      ? `
          <div class="space-y-3">
            ${[
              ...downstreamFirst.map((item) => ({ label: '首版样衣打样', code: item.firstSampleTaskCode, title: item.title, status: item.status, path: `/pcs/samples/first-sample/${item.firstSampleTaskId}` })),
              ...downstreamPre.map((item) => ({ label: '产前版样衣', code: item.preProductionSampleTaskCode, title: item.title, status: item.status, path: `/pcs/samples/pre-production/${item.preProductionSampleTaskId}` })),
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
      : '<div class="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">当前制版任务尚未关联正式打样任务。</div>',
  )

  const mainContent = state.plateTab === 'overview'
    ? overview
    : state.plateTab === 'version'
      ? version
      : state.plateTab === 'bom'
        ? bom
        : state.plateTab === 'patterns'
          ? renderPlatePieces(task)
          : state.plateTab === 'outputs'
            ? outputs
            : state.plateTab === 'downstream'
              ? downstream
              : renderSectionCard('操作日志', renderLogs(logs))

  const aside = `
    <div class="space-y-4">
      ${renderSectionCard('任务摘要', renderKeyValueGrid([
        { label: '负责人', value: escapeHtml(task.ownerName) },
        { label: '截止时间', value: escapeHtml(formatDateTime(task.dueAt)) },
        { label: '款式档案', value: styleArchiveLinkByProject(task.projectId) },
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
      ${tabBar}
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
      const haystack = [task.patternTaskCode, task.title, task.projectCode, task.projectName, task.ownerName, task.artworkName, task.productStyleCode].join(' ').toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (state.patternList.status !== 'all' && task.status !== state.patternList.status) return false
    if (state.patternList.owner !== 'all' && task.ownerName !== state.patternList.owner) return false
    if (state.patternList.source !== 'all' && task.sourceType !== state.patternList.source) return false
    if (state.patternList.quickFilter === 'mine' && task.ownerName !== '林小美') return false
    if (state.patternList.quickFilter === 'pending-review' && task.status !== '待确认') return false
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
        <td class="px-4 py-4">${projectButton(task.projectId, task.projectCode, task.projectName)}</td>
        <td class="px-4 py-4">${renderStatusBadge(task.status)}</td>
        <td class="px-4 py-4">${escapeHtml(task.artworkType || '-')}</td>
        <td class="px-4 py-4">${escapeHtml(task.patternMode || '-')}</td>
        <td class="px-4 py-4">${escapeHtml(task.artworkVersion || '-')}</td>
        <td class="px-4 py-4">${escapeHtml(task.ownerName)}</td>
        <td class="px-4 py-4">${asset ? `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/pattern-library/${escapeHtml(asset.id)}">${escapeHtml(asset.pattern_code)}</button>` : '<span class="text-slate-400">未沉淀</span>'}</td>
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
      ${renderPageHeader('花型任务', '花型任务由商品项目节点推进自动创建；本页仅查看花型输出、生产文件和技术包写入结果。', '', '')}
      ${renderListFilters({
        searchPlaceholder: '搜索任务编号 / 花型名称 / 商品项目 / 负责人',
        listState: state.patternList,
        searchField: 'pattern-search',
        statusField: 'pattern-status',
        ownerField: 'pattern-owner',
        sourceField: 'pattern-source',
        statusOptions: ['未开始', '进行中', '待确认', '已确认', '已完成', '异常待处理', '已取消'],
        ownerOptions: owners,
        sourceOptions: sources,
      })}
      <section class="grid gap-4 md:grid-cols-5">
        ${renderMetricButton('全部任务', tasks.length, state.patternList.quickFilter === 'all', 'all', 'set-pattern-quick-filter', '花型任务总量')}
        ${renderMetricButton('我的任务', tasks.filter((item) => item.ownerName === '林小美').length, state.patternList.quickFilter === 'mine', 'mine', 'set-pattern-quick-filter', '默认个人视角')}
        ${renderMetricButton('待确认', tasks.filter((item) => item.status === '待确认').length, state.patternList.quickFilter === 'pending-review', 'pending-review', 'set-pattern-quick-filter', '待确认花型输出')}
        ${renderMetricButton('已确认待沉淀', tasks.filter((item) => item.status === '已确认' && !listPatternAssets().find((asset) => asset.source_task_id === item.patternTaskId)).length, state.patternList.quickFilter === 'confirmed-no-output', 'confirmed-no-output', 'set-pattern-quick-filter', '确认后待进入花型库')}
        ${renderMetricButton('超期任务', tasks.filter((item) => isOverdue(item.dueAt, item.status === '已完成' || item.status === '已取消')).length, state.patternList.quickFilter === 'overdue', 'overdue', 'set-pattern-quick-filter', '超过计划完成时间')}
      </section>
      ${renderDataTable(['花型任务', '商品项目', '状态', '花型类型', '图案方式', '版本', '负责人', '花型库', '操作'], rows, '暂无花型任务数据', renderPagination(state.patternList.currentPage, filtered.length, 'change-pattern-page'))}
      ${renderPatternCreateDialog()}
    </div>
  `
}

function renderPatternCreateDialog(): string {
  const draft = state.patternCreateDraft
  const body = `
    <div class="grid gap-4 md:grid-cols-2">
      ${renderSelectInput('商品项目', 'pattern-create-project', draft.projectId, buildProjectOptions())}
      ${renderTextInput('负责人', 'pattern-create-owner', draft.ownerName, '默认取项目负责人')}
      ${renderTextInput('任务标题', 'pattern-create-title', draft.title, '例如：花型-碎花连衣裙（定位印 A1）')}
      ${renderTextInput('截止时间', 'pattern-create-due-at', draft.dueAt, 'YYYY-MM-DD HH:mm:ss')}
      ${renderTextInput('款式编码', 'pattern-create-style-code', draft.productStyleCode, 'SPU-xxxx')}
      ${renderTextInput('花型名称', 'pattern-create-artwork-name', draft.artworkName, '例如：Bunga Tropis A1')}
      ${renderSelectInput('花型类型', 'pattern-create-artwork-type', draft.artworkType, [{ value: '印花', label: '印花' }, { value: '贴章', label: '贴章' }, { value: '绣花', label: '绣花' }, { value: '烫画', label: '烫画' }])}
      ${renderSelectInput('图案方式', 'pattern-create-pattern-mode', draft.patternMode, [{ value: '定位印', label: '定位印' }, { value: '满印', label: '满印' }, { value: '局部', label: '局部' }])}
    </div>
    <div class="mt-4">
      ${renderTextarea('说明', 'pattern-create-note', draft.note, '项目模板阶段花型任务，后续可回写技术包并沉淀花型库')}
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
  const fieldPolicy = getEngineeringTaskFieldPolicy('PATTERN_ARTWORK_TASK')
  const completionMissingFields = getPatternTaskCompletionMissingFields(task)
  const asset = listPatternAssets().find((item) => item.source_task_id === task.patternTaskId)
  const sampleTasks = listFirstSampleTasks().filter((item) => item.upstreamObjectId === task.patternTaskId || item.upstreamObjectCode === task.patternTaskCode)
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
  const tabBar = renderTabBar(state.patternTab, [
    { key: 'plan', label: '花型方案' },
    { key: 'color', label: '色彩与色卡' },
    { key: 'production', label: '生产文件与工艺' },
    { key: 'samples', label: '关联样衣与参考' },
    { key: 'library', label: '花型库沉淀' },
    { key: 'logs', label: '日志与评审' },
  ], 'set-pattern-tab')

  const plan = `${renderProjectContext(task)}${renderSectionCard('花型定义', renderKeyValueGrid([
    { label: '花型名称', value: escapeHtml(task.artworkName || task.title) },
    { label: '花型类型', value: escapeHtml(task.artworkType || '-') },
    { label: '图案方式', value: escapeHtml(task.patternMode || '-') },
    { label: '版本号', value: escapeHtml(task.artworkVersion || '-') },
    { label: '来源对象', value: escapeHtml(task.upstreamObjectCode || task.upstreamObjectId || '项目模板阶段') },
    { label: '款式档案', value: styleArchiveLinkByProject(task.projectId) },
  ], 3))}
  ${renderSectionCard('花型文件', `<div class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><p>${escapeHtml(task.note || '暂无备注')}</p></div>`)}
  ${renderTaskCompletionSection(
    fieldPolicy,
    completionMissingFields,
    `
      <div class="grid gap-4 md:grid-cols-2">
        ${renderTextInput('花型版次', 'pattern-detail-version', detailDraft.artworkVersion, '例如：A2')}
      </div>
      <div class="mt-4 flex justify-end">
        <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="save-pattern-detail-fields" data-task-id="${escapeHtml(task.patternTaskId)}">保存实例补齐字段</button>
      </div>
    `,
  )}`

  const color = renderSectionCard(
    '色彩与色卡',
    `
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">主色方案</p>
          <div class="mt-3 flex flex-wrap gap-2">
            ${['#D32F2F', '#F59E0B', '#10B981', '#0F766E'].map((colorValue) => `<span class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700"><span class="h-3 w-3 rounded-full" style="background:${colorValue}"></span>${escapeHtml(colorValue)}</span>`).join('')}
          </div>
        </div>
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">色卡状态</p>
          <p class="mt-2 text-sm text-slate-900">${escapeHtml(task.status === '已确认' || task.status === '已完成' ? '已确认' : '待确认')}</p>
          <p class="mt-2 text-xs text-slate-500">花型类型为 ${escapeHtml(task.artworkType || '-') }，图案方式为 ${escapeHtml(task.patternMode || '-')}。</p>
        </div>
      </div>
    `,
  )

  const production = renderSectionCard(
    '生产文件与工艺',
    `
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">花型生产文件</p>
          <p class="mt-2 text-sm text-slate-900">${escapeHtml(task.artworkName || task.patternTaskCode)}.pdf</p>
          <p class="mt-2 text-xs text-slate-500">可作为花型包、生产文件和 FCS 技术包附件来源。</p>
        </div>
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">技术包状态</p>
          <div class="mt-2 text-sm text-slate-900">${task.linkedTechPackVersionId ? `${techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, task.linkedTechPackVersionCode || task.linkedTechPackVersionLabel || '查看关联技术包')}<span class="mx-2 text-slate-300">/</span>${techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, '查看版本日志')}` : '尚未写入正式技术包'}</div>
        </div>
      </div>
    `,
  )

  const samples = renderSectionCard(
    '关联样衣与参考',
    sampleTasks.length > 0
      ? `
          <div class="space-y-3">
            ${sampleTasks.map((item) => `
              <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3">
                <div>
                  <p class="text-sm font-medium text-slate-900">${escapeHtml(item.firstSampleTaskCode)}</p>
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
      : '<div class="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">当前花型任务尚未关联正式样衣任务。</div>',
  )

  const library = renderSectionCard(
    '花型库沉淀',
    asset
      ? `
          <div class="grid gap-4 md:grid-cols-2">
            <div class="rounded-lg border border-slate-200 p-4">
              <p class="text-xs text-slate-500">花型资产编号</p>
              <p class="mt-2 text-sm font-medium text-slate-900">${escapeHtml(asset.pattern_code)}</p>
              <p class="mt-2 text-xs text-slate-500">维护状态：${escapeHtml(asset.maintenance_status)}；审核状态：${escapeHtml(asset.review_status)}</p>
            </div>
            <div class="rounded-lg border border-slate-200 p-4">
              <p class="text-xs text-slate-500">打开花型库</p>
              <button type="button" class="mt-2 text-sm font-medium text-blue-700 hover:underline" data-nav="/pcs/pattern-library/${escapeHtml(asset.id)}">查看花型详情</button>
              <p class="mt-2 text-xs text-slate-500">当前花型任务已与花型库正式串联。</p>
            </div>
          </div>
        `
      : `
          <div class="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
            当前花型尚未进入花型库。点击右上角“沉淀花型库”即可直接建立花型主档。
          </div>
        `,
  )

  const mainContent = state.patternTab === 'plan'
    ? plan
    : state.patternTab === 'color'
      ? color
      : state.patternTab === 'production'
        ? production
        : state.patternTab === 'samples'
          ? samples
          : state.patternTab === 'library'
            ? library
            : renderSectionCard('日志与评审', renderLogs(logs))

  const aside = `
    <div class="space-y-4">
      ${renderSectionCard('任务摘要', renderKeyValueGrid([
        { label: '负责人', value: escapeHtml(task.ownerName) },
        { label: '截止时间', value: escapeHtml(formatDateTime(task.dueAt)) },
        { label: '款式档案', value: styleArchiveLinkByProject(task.projectId) },
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
      ${tabBar}
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div class="space-y-6">${mainContent}</div>
        ${aside}
      </div>
    </div>
  `
}

function buildSampleMilestones(task: { status: string; createdAt: string; expectedArrival: string; trackingNo: string; sampleAssetId: string }): Array<{ label: string; done: boolean; time: string }> {
  const arrived = task.status === '已到样待入库' || task.status === '验收中' || task.status === '已完成'
  const stocked = task.status === '验收中' || task.status === '已完成'
  const accepted = task.status === '已完成'
  return [
    { label: '创建', done: true, time: task.createdAt },
    { label: '发样', done: task.status !== '待发样' && task.status !== '草稿', time: task.trackingNo ? task.createdAt : '' },
    { label: '到样签收', done: arrived, time: arrived ? task.expectedArrival : '' },
    { label: '核对入库', done: stocked, time: stocked ? task.expectedArrival : '' },
    { label: '验收完成', done: accepted, time: accepted ? task.expectedArrival : '' },
  ]
}

function renderTimeline(milestones: Array<{ label: string; done: boolean; time: string }>): string {
  return `
    <div class="grid gap-4 md:grid-cols-5">
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
    if (state.firstSampleList.quickFilter === 'in-transit' && task.status !== '在途') return false
    if (state.firstSampleList.quickFilter === 'arrived' && task.status !== '已到样待入库') return false
    if (state.firstSampleList.quickFilter === 'accepting' && task.status !== '验收中') return false
    if (state.firstSampleList.quickFilter === 'overdue' && !isOverdue(task.expectedArrival, task.status === '已完成' || task.status === '已取消')) return false
    return true
  })
}

function renderFirstSampleListPage(): string {
  ensurePcsSampleDemoDataReady()
  const tasks = listFirstSampleTasks()
  const filtered = getFirstSampleTasksFiltered()
  const owners = getOwners(tasks)
  const sources = getSources(tasks)
  const paged = paginate(filtered, state.firstSampleList.currentPage)
  const rows = paged.map((task) => {
    const asset = task.sampleCode ? getSampleAssetByCode(task.sampleCode) : null
    return `
      <tr class="hover:bg-slate-50/70">
        <td class="px-4 py-4">
          <div class="space-y-1">
            <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/samples/first-sample/${escapeHtml(task.firstSampleTaskId)}">${escapeHtml(task.firstSampleTaskCode)}</button>
            <p class="text-xs text-slate-500">${escapeHtml(task.title)}</p>
          </div>
        </td>
        <td class="px-4 py-4">${projectButton(task.projectId, task.projectCode, task.projectName)}</td>
        <td class="px-4 py-4">${renderStatusBadge(task.status, true)}</td>
        <td class="px-4 py-4">${escapeHtml(task.targetSite)}</td>
        <td class="px-4 py-4">${escapeHtml(formatDateTime(task.expectedArrival))}</td>
        <td class="px-4 py-4">${escapeHtml(task.trackingNo || '-')}</td>
        <td class="px-4 py-4">${escapeHtml(asset?.sampleCode || task.sampleCode || '-')}</td>
        <td class="px-4 py-4">
          <div class="flex flex-wrap gap-2">
            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/first-sample/${escapeHtml(task.firstSampleTaskId)}">查看</button>
            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="first-sample-advance-logistics" data-task-id="${escapeHtml(task.firstSampleTaskId)}">${escapeHtml(task.status === '待发样' ? '录入运单' : task.status === '在途' ? '到样签收' : task.status === '已到样待入库' ? '核对入库' : task.status === '验收中' ? '填写验收' : '已完成')}</button>
          </div>
        </td>
      </tr>
    `
  }).join('')

  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${renderPageHeader('首版样衣打样', '参照首单样衣打样原型，跟踪发样、到样、入库和验收闭环，并将样衣信息回写到商品项目。', '新建首版打样', 'open-first-sample-create')}
      ${renderListFilters({
        searchPlaceholder: '搜索任务编号 / 商品项目 / 工厂 / 运单 / 样衣编号',
        listState: state.firstSampleList,
        searchField: 'first-sample-search',
        statusField: 'first-sample-status',
        ownerField: 'first-sample-owner',
        sourceField: 'first-sample-source',
        siteField: 'first-sample-site',
        siteOptions: SAMPLE_SITE_OPTIONS,
        statusOptions: ['待发样', '在途', '已到样待入库', '验收中', '已完成', '已取消'],
        ownerOptions: owners,
        sourceOptions: sources,
      })}
      <section class="grid gap-4 md:grid-cols-4">
        ${renderMetricButton('在途', tasks.filter((item) => item.status === '在途').length, state.firstSampleList.quickFilter === 'in-transit', 'in-transit', 'set-first-sample-quick-filter', '样衣运输途中')}
        ${renderMetricButton('已到样待入库', tasks.filter((item) => item.status === '已到样待入库').length, state.firstSampleList.quickFilter === 'arrived', 'arrived', 'set-first-sample-quick-filter', '等待核对入库')}
        ${renderMetricButton('验收中', tasks.filter((item) => item.status === '验收中').length, state.firstSampleList.quickFilter === 'accepting', 'accepting', 'set-first-sample-quick-filter', '等待填写验收结论')}
        ${renderMetricButton('超期', tasks.filter((item) => isOverdue(item.expectedArrival, item.status === '已完成' || item.status === '已取消')).length, state.firstSampleList.quickFilter === 'overdue', 'overdue', 'set-first-sample-quick-filter', '超过预计到样时间')}
      </section>
      ${renderDataTable(['首版打样任务', '商品项目', '状态', '目标站点', '预计到样', '运单号', '样衣编号', '操作'], rows, '暂无首版样衣打样数据', renderPagination(state.firstSampleList.currentPage, filtered.length, 'change-first-sample-page'))}
      ${renderFirstSampleCreateDialog()}
      ${renderFirstSampleAcceptanceDialog()}
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
      ${renderTextInput('预计到样', 'first-sample-create-expected-arrival', draft.expectedArrival, 'YYYY-MM-DD HH:mm:ss')}
      ${renderTextInput('工厂', 'first-sample-create-factory', draft.factoryName, '例如：深圳工厂02')}
      ${renderSelectInput('目标站点', 'first-sample-create-site', draft.targetSite, [{ value: '深圳', label: '深圳' }, { value: '雅加达', label: '雅加达' }])}
    </div>
    <div class="mt-4">
      ${renderTextarea('说明', 'first-sample-create-note', draft.note, '人工创建的首版样衣打样任务，可后续录入运单、到样签收和入库')}
    </div>
  `
  return renderDialog(state.firstSampleCreateOpen, '新建首版样衣打样', body, 'close-first-sample-create', 'submit-first-sample-create', '创建首版打样')
}

function renderFirstSampleAcceptanceDialog(): string {
  const body = `
    <div class="space-y-4">
      ${renderSelectInput('验收结论', 'first-sample-acceptance-result', state.firstSampleAcceptanceResult, [
        { value: '通过', label: '通过' },
        { value: '需改版', label: '需改版' },
        { value: '需补测', label: '需补测' },
      ])}
      ${renderTextarea('验收说明', 'first-sample-acceptance-note', state.firstSampleAcceptanceNote, '补充样衣验收说明、问题点和后续建议')}
    </div>
  `
  return renderDialog(state.firstSampleAcceptanceOpen, '填写首版验收结论', body, 'close-first-sample-acceptance', 'submit-first-sample-acceptance', '提交验收')
}

function renderFirstSampleDetailPage(firstSampleTaskId: string): string {
  ensurePcsSampleDemoDataReady()
  const task = getFirstSampleTaskById(firstSampleTaskId)
  if (!task) return renderEmptyDetail('首版样衣打样', '/pcs/samples/first-sample')
  const asset = task.sampleCode ? getSampleAssetByCode(task.sampleCode) : null
  const acceptance = firstSampleAcceptanceMap.get(task.firstSampleTaskId) || (task.status === '已完成' ? { result: '通过', note: task.note || '样衣验收已通过。', updatedAt: task.updatedAt } : null)
  const logs = mergeLogs('firstSample', task.firstSampleTaskId, [
    ...(asset ? [{ time: asset.updatedAt, action: '项目样衣信息回写', user: asset.updatedBy, detail: `已回写样衣编号 ${asset.sampleCode} 到商品项目。` }] : []),
    ...(acceptance ? [{ time: acceptance.updatedAt, action: '填写验收', user: '当前用户', detail: `验收结论：${acceptance.result}。${acceptance.note}` }] : []),
    ...baseLogs(task),
  ])
  const header = renderHeaderMeta(
    `${task.firstSampleTaskCode} · ${task.title}`,
    `${task.projectCode} · ${task.projectName} · ${formatDateTime(task.updatedAt)}`,
    `${renderStatusBadge(task.status, true)}<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">${escapeHtml(task.targetSite)}</span>`,
    [
      `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/first-sample">返回列表</button>`,
      `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="first-sample-advance-logistics" data-task-id="${escapeHtml(task.firstSampleTaskId)}">${escapeHtml(task.status === '待发样' ? '录入运单' : task.status === '在途' ? '到样签收' : task.status === '已到样待入库' ? '核对入库' : task.status === '验收中' ? '填写验收' : '已完成')}</button>`,
      `<button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-nav="/pcs/projects/${encodeURIComponent(task.projectId)}">查看商品项目</button>`,
    ].join(''),
  )
  const tabBar = renderTabBar(state.firstSampleTab, [
    { key: 'overview', label: '概览' },
    { key: 'inputs', label: '输入包' },
    { key: 'logistics', label: '物流与到样' },
    { key: 'stockin', label: '入库建档' },
    { key: 'acceptance', label: '验收与结论' },
    { key: 'logs', label: '日志' },
  ], 'set-first-sample-tab')

  const overview = renderSectionCard('里程碑进度', renderTimeline(buildSampleMilestones(task)))
  const inputs = `${renderProjectContext(task)}${renderSectionCard('来源输入', renderKeyValueGrid([
    { label: '来源类型', value: escapeHtml(task.sourceType) },
    { label: '上游对象', value: escapeHtml(task.upstreamObjectCode || task.upstreamObjectId || '人工创建') },
    { label: '工厂', value: escapeHtml(task.factoryName || '-') },
    { label: '预计到样', value: escapeHtml(formatDateTime(task.expectedArrival)) },
  ], 2))}`
  const logistics = renderSectionCard('物流与到样', renderKeyValueGrid([
    { label: '运单号', value: escapeHtml(task.trackingNo || '-') },
    { label: '目标站点', value: escapeHtml(task.targetSite) },
    { label: '状态', value: renderStatusBadge(task.status, true) },
    { label: '预计到样', value: escapeHtml(formatDateTime(task.expectedArrival)) },
  ], 2))
  const stockin = renderSectionCard(
    '入库建档',
    `
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">项目样衣信息</p>
          <p class="mt-2 text-sm text-slate-900">${asset ? escapeHtml(asset.sampleCode) : '尚未建立'}</p>
          <p class="mt-2 text-xs text-slate-500">${asset ? '已回写到商品项目样衣字段。' : '执行“核对入库”后会自动回写商品项目样衣字段。'}</p>
        </div>
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">商品项目</p>
          ${task.projectId ? `<button type="button" class="mt-2 text-sm font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${encodeURIComponent(task.projectId)}">查看商品项目</button>` : '<p class="mt-2 text-sm text-slate-900">待关联项目后查看</p>'}
        </div>
      </div>
    `,
  )
  const acceptanceSection = renderSectionCard(
    '验收与结论',
    `
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">验收状态</p>
          <p class="mt-2 text-sm text-slate-900">${acceptance ? escapeHtml(acceptance.result) : '待填写'}</p>
          <p class="mt-2 text-xs text-slate-500">${escapeHtml(acceptance?.note || '样衣进入验收后可填写正式结论。')}</p>
        </div>
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">正式对象核对</p>
          <p class="mt-2 text-sm text-slate-900">工作项状态：${escapeHtml(task.status)}</p>
          <p class="mt-2 text-xs text-slate-500">样衣编号：${escapeHtml(asset?.sampleCode || task.sampleCode || '-')}</p>
        </div>
      </div>
    `,
  )
  const mainContent = state.firstSampleTab === 'overview'
    ? overview
    : state.firstSampleTab === 'inputs'
      ? inputs
      : state.firstSampleTab === 'logistics'
        ? logistics
        : state.firstSampleTab === 'stockin'
          ? stockin
          : state.firstSampleTab === 'acceptance'
            ? acceptanceSection
            : renderSectionCard('日志', renderLogs(logs))
  const aside = `
    <div class="space-y-4">
      ${renderSectionCard('任务摘要', renderKeyValueGrid([
        { label: '负责人', value: escapeHtml(task.ownerName) },
        { label: '工厂', value: escapeHtml(task.factoryName || '-') },
        { label: '站点', value: escapeHtml(task.targetSite) },
        { label: '项目样衣', value: asset ? '已回写' : '待入库' },
      ], 2))}
      ${renderSectionCard('正式对象核对', renderKeyValueGrid([
        { label: '商品项目', value: projectButton(task.projectId, task.projectCode, task.projectName) },
        { label: '工作项节点', value: projectNodeButton(task.projectId, task.projectNodeId, task.workItemTypeName) },
        { label: '样衣编号', value: escapeHtml(asset?.sampleCode || task.sampleCode || '-') },
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
      ${renderFirstSampleAcceptanceDialog()}
    </div>
  `
}

function getPreProductionTasksFiltered() {
  const tasks = listPreProductionSampleTasks()
  const keyword = state.preProductionList.search.trim().toLowerCase()
  return tasks.filter((task) => {
    if (keyword) {
      const haystack = [task.preProductionSampleTaskCode, task.title, task.projectCode, task.projectName, task.ownerName, task.factoryName, task.sampleCode].join(' ').toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (state.preProductionList.status !== 'all' && task.status !== state.preProductionList.status) return false
    if (state.preProductionList.owner !== 'all' && task.ownerName !== state.preProductionList.owner) return false
    if (state.preProductionList.source !== 'all' && task.sourceType !== state.preProductionList.source) return false
    if (state.preProductionList.site !== 'all' && task.targetSite !== state.preProductionList.site) return false
    if (state.preProductionList.quickFilter === 'in-transit' && task.status !== '在途') return false
    if (state.preProductionList.quickFilter === 'arrived' && task.status !== '已到样待入库') return false
    if (state.preProductionList.quickFilter === 'accepting' && task.status !== '验收中') return false
    if (state.preProductionList.quickFilter === 'overdue' && !isOverdue(task.expectedArrival, task.status === '已完成' || task.status === '已取消')) return false
    return true
  })
}

function renderPreProductionListPage(): string {
  ensurePcsSampleDemoDataReady()
  const tasks = listPreProductionSampleTasks()
  const filtered = getPreProductionTasksFiltered()
  const owners = getOwners(tasks)
  const sources = getSources(tasks)
  const paged = paginate(filtered, state.preProductionList.currentPage)
  const rows = paged.map((task) => {
    const conclusion = preProductionConclusionMap.get(task.preProductionSampleTaskId)
    return `
      <tr class="hover:bg-slate-50/70">
        <td class="px-4 py-4">
          <div class="space-y-1">
            <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/samples/pre-production/${escapeHtml(task.preProductionSampleTaskId)}">${escapeHtml(task.preProductionSampleTaskCode)}</button>
            <p class="text-xs text-slate-500">${escapeHtml(task.title)}</p>
          </div>
        </td>
        <td class="px-4 py-4">${projectButton(task.projectId, task.projectCode, task.projectName)}</td>
        <td class="px-4 py-4">${renderStatusBadge(task.status, true)}</td>
        <td class="px-4 py-4">${escapeHtml(task.targetSite)}</td>
        <td class="px-4 py-4">${escapeHtml(task.patternVersion || '-')}</td>
        <td class="px-4 py-4">${escapeHtml(task.artworkVersion || '-')}</td>
        <td class="px-4 py-4">${escapeHtml(conclusion?.result || (task.status === '已完成' ? '通过' : '-'))}</td>
        <td class="px-4 py-4">
          <div class="flex flex-wrap gap-2">
            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/pre-production/${escapeHtml(task.preProductionSampleTaskId)}">查看</button>
            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="pre-production-advance-logistics" data-task-id="${escapeHtml(task.preProductionSampleTaskId)}">${escapeHtml(task.status === '待发样' ? '录入运单' : task.status === '在途' ? '到样签收' : task.status === '已到样待入库' ? '核对入库' : task.status === '验收中' ? '填写结论' : '已完成')}</button>
          </div>
        </td>
      </tr>
    `
  }).join('')

  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${renderPageHeader('产前版样衣打样', '参照产前版样衣原型，管理版本输入、物流、入库、产前结论和门禁确认。', '新建产前打样', 'open-pre-production-create')}
      ${renderListFilters({
        searchPlaceholder: '搜索任务编号 / 商品项目 / 工厂 / 运单 / 样衣编号',
        listState: state.preProductionList,
        searchField: 'pre-production-search',
        statusField: 'pre-production-status',
        ownerField: 'pre-production-owner',
        sourceField: 'pre-production-source',
        siteField: 'pre-production-site',
        siteOptions: SAMPLE_SITE_OPTIONS,
        statusOptions: ['待发样', '在途', '已到样待入库', '验收中', '已完成', '已取消'],
        ownerOptions: owners,
        sourceOptions: sources,
      })}
      <section class="grid gap-4 md:grid-cols-4">
        ${renderMetricButton('在途', tasks.filter((item) => item.status === '在途').length, state.preProductionList.quickFilter === 'in-transit', 'in-transit', 'set-pre-production-quick-filter', '产前样衣运输途中')}
        ${renderMetricButton('已到样待入库', tasks.filter((item) => item.status === '已到样待入库').length, state.preProductionList.quickFilter === 'arrived', 'arrived', 'set-pre-production-quick-filter', '等待核对入库')}
        ${renderMetricButton('验收中', tasks.filter((item) => item.status === '验收中').length, state.preProductionList.quickFilter === 'accepting', 'accepting', 'set-pre-production-quick-filter', '等待产前结论与门禁确认')}
        ${renderMetricButton('超期', tasks.filter((item) => isOverdue(item.expectedArrival, item.status === '已完成' || item.status === '已取消')).length, state.preProductionList.quickFilter === 'overdue', 'overdue', 'set-pre-production-quick-filter', '超过预计到样时间')}
      </section>
      ${renderDataTable(['产前版任务', '商品项目', '状态', '目标站点', '版次', '花型版次', '产前结论', '操作'], rows, '暂无产前版样衣数据', renderPagination(state.preProductionList.currentPage, filtered.length, 'change-pre-production-page'))}
      ${renderPreProductionCreateDialog()}
      ${renderPreProductionConclusionDialog()}
    </div>
  `
}

function renderPreProductionCreateDialog(): string {
  const draft = state.preProductionCreateDraft
  const body = `
    <div class="grid gap-4 md:grid-cols-2">
      ${renderSelectInput('商品项目', 'pre-production-create-project', draft.projectId, buildProjectOptions())}
      ${renderTextInput('负责人', 'pre-production-create-owner', draft.ownerName, '默认取项目负责人')}
      ${renderTextInput('任务标题', 'pre-production-create-title', draft.title, '例如：产前版样衣-碎花连衣裙')}
      ${renderTextInput('预计到样', 'pre-production-create-expected-arrival', draft.expectedArrival, 'YYYY-MM-DD HH:mm:ss')}
      ${renderTextInput('工厂', 'pre-production-create-factory', draft.factoryName, '例如：雅加达工厂03')}
      ${renderSelectInput('目标站点', 'pre-production-create-site', draft.targetSite, [{ value: '深圳', label: '深圳' }, { value: '雅加达', label: '雅加达' }])}
      ${renderTextInput('制版版次', 'pre-production-create-pattern-version', draft.patternVersion, 'P2')}
      ${renderTextInput('花型版次', 'pre-production-create-artwork-version', draft.artworkVersion, 'A1')}
    </div>
    <div class="mt-4">
      ${renderTextarea('说明', 'pre-production-create-note', draft.note, '人工创建的产前版样衣任务，后续可填写结论并进行门禁确认')}
    </div>
  `
  return renderDialog(state.preProductionCreateOpen, '新建产前版样衣', body, 'close-pre-production-create', 'submit-pre-production-create', '创建产前任务')
}

function renderPreProductionConclusionDialog(): string {
  const body = `
    <div class="space-y-4">
      ${renderSelectInput('产前结论', 'pre-production-conclusion-result', state.preProductionConclusionResult, [
        { value: '通过', label: '通过' },
        { value: '不通过', label: '不通过' },
        { value: '需补产前', label: '需补产前' },
        { value: '需改版', label: '需改版' },
      ])}
      ${renderTextarea('说明', 'pre-production-conclusion-note', state.preProductionConclusionNote, '补充产前验收记录、问题点和量产建议')}
    </div>
  `
  return renderDialog(state.preProductionConclusionOpen, '填写产前结论', body, 'close-pre-production-conclusion', 'submit-pre-production-conclusion', '提交产前结论')
}

function renderPreProductionDetailPage(preProductionSampleTaskId: string): string {
  ensurePcsSampleDemoDataReady()
  const task = getPreProductionSampleTaskById(preProductionSampleTaskId)
  if (!task) return renderEmptyDetail('产前版样衣', '/pcs/samples/pre-production')
  const asset = task.sampleCode ? getSampleAssetByCode(task.sampleCode) : null
  const conclusion = preProductionConclusionMap.get(task.preProductionSampleTaskId) || (task.status === '已完成' ? { result: '通过', note: task.note || '产前结论通过。', updatedAt: task.updatedAt } : null)
  const gate = preProductionGateMap.get(task.preProductionSampleTaskId) || (task.status === '已完成' ? { confirmedBy: '当前用户', confirmedAt: task.updatedAt } : null)
  const logs = mergeLogs('preProduction', task.preProductionSampleTaskId, [
    ...(asset ? [{ time: asset.updatedAt, action: '项目样衣信息回写', user: asset.updatedBy, detail: `已回写样衣编号 ${asset.sampleCode} 到商品项目。` }] : []),
    ...(conclusion ? [{ time: conclusion.updatedAt, action: '产前结论', user: '当前用户', detail: `结论：${conclusion.result}。${conclusion.note}` }] : []),
    ...(gate ? [{ time: gate.confirmedAt, action: '门禁确认', user: gate.confirmedBy, detail: '已确认满足量产前门禁条件。' }] : []),
    ...baseLogs(task),
  ])
  const gateConditions = [
    { label: '已核对入库', met: task.status === '验收中' || task.status === '已完成' },
    { label: '产前结论已填写', met: Boolean(conclusion) },
    { label: '产前结论=通过', met: conclusion?.result === '通过' },
    { label: '版本信息已补齐', met: Boolean(task.patternVersion || task.artworkVersion) },
  ]
  const header = renderHeaderMeta(
    `${task.preProductionSampleTaskCode} · ${task.title}`,
    `${task.projectCode} · ${task.projectName} · ${formatDateTime(task.updatedAt)}`,
    `${renderStatusBadge(task.status, true)}${conclusion ? `<span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">${escapeHtml(conclusion.result)}</span>` : ''}`,
    [
      `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/pre-production">返回列表</button>`,
      `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="pre-production-advance-logistics" data-task-id="${escapeHtml(task.preProductionSampleTaskId)}">${escapeHtml(task.status === '待发样' ? '录入运单' : task.status === '在途' ? '到样签收' : task.status === '已到样待入库' ? '核对入库' : task.status === '验收中' ? '填写结论' : '已完成')}</button>`,
      `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/projects/${encodeURIComponent(task.projectId)}">查看商品项目</button>`,
      ...(task.status === '验收中' ? [`<button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-engineering-action="pre-production-confirm-gate" data-task-id="${escapeHtml(task.preProductionSampleTaskId)}">门禁确认</button>`] : []),
    ].join(''),
  )
  const tabBar = renderTabBar(state.preProductionTab, [
    { key: 'overview', label: '概览' },
    { key: 'version', label: '版本与输入' },
    { key: 'logistics', label: '物流与到样' },
    { key: 'stockin', label: '入库建档' },
    { key: 'conclusion', label: '产前验收' },
    { key: 'gate', label: '门禁与下游' },
    { key: 'logs', label: '日志' },
  ], 'set-pre-production-tab')

  const overview = `${renderSectionCard('里程碑进度', renderTimeline(buildSampleMilestones({ ...task, sampleAssetId: asset?.sampleAssetId || task.sampleAssetId })))}
  ${renderSectionCard('门禁状态', `
    <div class="rounded-lg border ${gate ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'} p-4">
      <p class="text-sm font-medium ${gate ? 'text-emerald-800' : 'text-rose-800'}">${gate ? '已满足门禁，可进入量产阶段' : '门禁未满足，仍需补齐结论或版本信息'}</p>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        ${gateConditions.map((item) => `<div class="flex items-center gap-2 text-sm ${item.met ? 'text-emerald-700' : 'text-rose-700'}"><span>${item.met ? '●' : '○'}</span><span>${escapeHtml(item.label)}</span></div>`).join('')}
      </div>
    </div>
  `)}`
  const version = `${renderProjectContext(task)}${renderSectionCard('版本与输入', renderKeyValueGrid([
    { label: '来源类型', value: escapeHtml(task.sourceType) },
    { label: '上游对象', value: escapeHtml(task.upstreamObjectCode || task.upstreamObjectId || '人工创建') },
    { label: '制版版次', value: escapeHtml(task.patternVersion || '-') },
    { label: '花型版次', value: escapeHtml(task.artworkVersion || '-') },
    { label: '工厂', value: escapeHtml(task.factoryName || '-') },
    { label: '目标站点', value: escapeHtml(task.targetSite) },
  ], 3))}`
  const logistics = renderSectionCard('物流与到样', renderKeyValueGrid([
    { label: '运单号', value: escapeHtml(task.trackingNo || '-') },
    { label: '预计到样', value: escapeHtml(formatDateTime(task.expectedArrival)) },
    { label: '目标站点', value: escapeHtml(task.targetSite) },
    { label: '当前状态', value: renderStatusBadge(task.status, true) },
  ], 2))
  const stockin = renderSectionCard(
    '入库建档',
    `
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">项目样衣信息</p>
          <p class="mt-2 text-sm text-slate-900">${escapeHtml(asset?.sampleCode || task.sampleCode || '待建立')}</p>
          <p class="mt-2 text-xs text-slate-500">${asset ? '已回写到商品项目样衣字段。' : '执行核对入库后自动回写。'}</p>
        </div>
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">商品项目</p>
          ${task.projectId ? `<button type="button" class="mt-2 text-sm font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${encodeURIComponent(task.projectId)}">查看商品项目</button>` : '<p class="mt-2 text-sm text-slate-900">待关联项目后查看</p>'}
        </div>
      </div>
    `,
  )
  const conclusionSection = renderSectionCard(
    '产前验收',
    `
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">产前结论</p>
          <p class="mt-2 text-sm text-slate-900">${escapeHtml(conclusion?.result || '待填写')}</p>
          <p class="mt-2 text-xs text-slate-500">${escapeHtml(conclusion?.note || '核对入库后可填写正式产前结论。')}</p>
        </div>
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">门禁状态</p>
          <p class="mt-2 text-sm text-slate-900">${gate ? '已确认通过' : '未确认'}</p>
          <p class="mt-2 text-xs text-slate-500">${gate ? `${gate.confirmedBy} 于 ${formatDateTime(gate.confirmedAt)} 确认` : '结论通过后可执行门禁确认。'}</p>
        </div>
      </div>
    `,
  )
  const gateSection = renderSectionCard(
    '门禁与下游',
    `
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">门禁条件</p>
          <div class="mt-3 space-y-2">
            ${gateConditions.map((item) => `<div class="flex items-center gap-2 text-sm ${item.met ? 'text-emerald-700' : 'text-rose-700'}"><span>${item.met ? '●' : '○'}</span><span>${escapeHtml(item.label)}</span></div>`).join('')}
          </div>
        </div>
        <div class="rounded-lg border border-slate-200 p-4">
          <p class="text-xs text-slate-500">下游准备</p>
          <p class="mt-2 text-sm text-slate-900">${gate ? '可进入量产阶段。' : '当前仍停留在商品中心产前验证阶段。'}</p>
          <p class="mt-2 text-xs text-slate-500">门禁确认仅在产前结论通过后可执行。</p>
        </div>
      </div>
    `,
  )

  const mainContent = state.preProductionTab === 'overview'
    ? overview
    : state.preProductionTab === 'version'
      ? version
      : state.preProductionTab === 'logistics'
        ? logistics
        : state.preProductionTab === 'stockin'
          ? stockin
          : state.preProductionTab === 'conclusion'
            ? conclusionSection
            : state.preProductionTab === 'gate'
              ? gateSection
              : renderSectionCard('日志', renderLogs(logs))
  const aside = `
    <div class="space-y-4">
      ${renderSectionCard('任务摘要', renderKeyValueGrid([
        { label: '负责人', value: escapeHtml(task.ownerName) },
        { label: '工厂', value: escapeHtml(task.factoryName || '-') },
        { label: '站点', value: escapeHtml(task.targetSite) },
        { label: '门禁状态', value: gate ? '已通过' : '待确认' },
      ], 2))}
      ${renderSectionCard('正式对象核对', renderKeyValueGrid([
        { label: '商品项目', value: projectButton(task.projectId, task.projectCode, task.projectName) },
        { label: '工作项节点', value: projectNodeButton(task.projectId, task.projectNodeId, task.workItemTypeName) },
        { label: '样衣编号', value: escapeHtml(asset?.sampleCode || task.sampleCode || '-') },
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
      ${renderPreProductionConclusionDialog()}
    </div>
  `
}

function closeAllDialogs(): void {
  state.revisionCreateOpen = false
  state.plateCreateOpen = false
  state.patternCreateOpen = false
  state.firstSampleCreateOpen = false
  state.firstSampleAcceptanceOpen = false
  state.preProductionCreateOpen = false
  state.preProductionConclusionOpen = false
}

function updateListPage(listState: ListState | SampleListState, step: number, total: number): void {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  listState.currentPage = Math.min(totalPages, Math.max(1, listState.currentPage + step))
}

function updateSampleTaskByFlow(taskId: string, module: 'firstSample' | 'preProduction'): void {
  if (module === 'firstSample') {
    const task = getFirstSampleTaskById(taskId)
    if (!task) return
    if (task.status === '待发样') {
      updateFirstSampleTask(taskId, { trackingNo: task.trackingNo || `FS-TRK-${task.firstSampleTaskCode.slice(-3)}`, status: '在途', updatedAt: nowText(), updatedBy: '当前用户' })
      pushRuntimeLog('firstSample', taskId, '录入运单', `已录入运单 ${task.trackingNo || `FS-TRK-${task.firstSampleTaskCode.slice(-3)}`}。`)
      setNotice(`首版样衣任务 ${task.firstSampleTaskCode} 已录入运单并进入在途。`)
      return
    }
    if (task.status === '在途') {
      updateFirstSampleTask(taskId, { status: '已到样待入库', acceptedAt: task.acceptedAt || nowText(), updatedAt: nowText(), updatedBy: '当前用户' })
      pushRuntimeLog('firstSample', taskId, '到样签收', '已完成到样签收，等待核对入库。')
      setNotice(`首版样衣任务 ${task.firstSampleTaskCode} 已完成到样签收。`)
      return
    }
    if (task.status === '已到样待入库') {
      const assetInfo = ensureSampleAssetForTask({
        module: 'firstSample',
        taskId: task.firstSampleTaskId,
        sampleCode: task.sampleCode || `SY-${task.targetSite === '雅加达' ? 'JKT' : 'SZ'}-${task.firstSampleTaskCode.slice(-3)}`,
        sampleName: task.title,
        responsibleSite: task.targetSite,
        projectId: task.projectId,
        projectCode: task.projectCode,
        projectName: task.projectName,
        projectNodeId: task.projectNodeId,
        workItemTypeCode: task.workItemTypeCode,
        workItemTypeName: task.workItemTypeName,
        sourceDocType: '首版样衣打样任务',
        sourceDocCode: task.firstSampleTaskCode,
      })
      appendSampleTransition({
        sampleAssetId: assetInfo.assetId,
        eventType: 'CHECKIN_VERIFY',
        inventoryStatusAfter: '在库可用',
        availabilityAfter: '可用',
        locationType: '仓库',
        locationDisplay: `${task.targetSite}样衣主仓`,
        custodianType: '仓管',
        custodianName: `${task.targetSite}仓管`,
        operatorName: '当前用户',
        note: `由首版样衣打样任务 ${task.firstSampleTaskCode} 核对入库。`,
        sourceModule: '首版样衣打样',
        sourceDocType: '首版样衣打样任务',
        sourceDocCode: task.firstSampleTaskCode,
        sourceDocId: task.firstSampleTaskId,
      })
      updateFirstSampleTask(taskId, { sampleAssetId: assetInfo.assetId, sampleCode: assetInfo.assetCode, status: '验收中', acceptedAt: task.acceptedAt || nowText(), updatedAt: nowText(), updatedBy: '当前用户' })
      pushRuntimeLog('firstSample', taskId, '核对入库', `已回写商品项目样衣字段，样衣编号 ${assetInfo.assetCode}。`)
      setNotice(`首版样衣任务 ${task.firstSampleTaskCode} 已完成核对入库。`)
      return
    }
    if (task.status === '验收中') {
      state.firstSampleAcceptanceOpen = true
      state.firstSampleAcceptanceTaskId = taskId
      state.firstSampleAcceptanceResult = '通过'
      state.firstSampleAcceptanceNote = ''
      return
    }
    setNotice(`首版样衣任务 ${task.firstSampleTaskCode} 当前已完成，无需继续推进。`)
    return
  }

  const task = getPreProductionSampleTaskById(taskId)
  if (!task) return
  if (task.status === '待发样') {
    updatePreProductionSampleTask(taskId, { trackingNo: task.trackingNo || `PP-TRK-${task.preProductionSampleTaskCode.slice(-3)}`, status: '在途', updatedAt: nowText(), updatedBy: '当前用户' })
    pushRuntimeLog('preProduction', taskId, '录入运单', `已录入运单 ${task.trackingNo || `PP-TRK-${task.preProductionSampleTaskCode.slice(-3)}`}。`)
    setNotice(`产前版样衣任务 ${task.preProductionSampleTaskCode} 已录入运单并进入在途。`)
    return
  }
  if (task.status === '在途') {
    updatePreProductionSampleTask(taskId, { status: '已到样待入库', acceptedAt: task.acceptedAt || nowText(), updatedAt: nowText(), updatedBy: '当前用户' })
    pushRuntimeLog('preProduction', taskId, '到样签收', '已完成到样签收，等待核对入库。')
    setNotice(`产前版样衣任务 ${task.preProductionSampleTaskCode} 已完成到样签收。`)
    return
  }
  if (task.status === '已到样待入库') {
    const assetInfo = ensureSampleAssetForTask({
      module: 'preProduction',
      taskId: task.preProductionSampleTaskId,
      sampleCode: task.sampleCode || `SY-${task.targetSite === '雅加达' ? 'JKT' : 'SZ'}-${task.preProductionSampleTaskCode.slice(-3)}`,
      sampleName: task.title,
      responsibleSite: task.targetSite,
      projectId: task.projectId,
      projectCode: task.projectCode,
      projectName: task.projectName,
      projectNodeId: task.projectNodeId,
      workItemTypeCode: task.workItemTypeCode,
      workItemTypeName: task.workItemTypeName,
      sourceDocType: '产前版样衣任务',
      sourceDocCode: task.preProductionSampleTaskCode,
    })
    appendSampleTransition({
      sampleAssetId: assetInfo.assetId,
      eventType: 'CHECKIN_VERIFY',
      inventoryStatusAfter: '在库可用',
      availabilityAfter: '可用',
      locationType: '仓库',
      locationDisplay: `${task.targetSite}样衣主仓`,
      custodianType: '仓管',
      custodianName: `${task.targetSite}仓管`,
      operatorName: '当前用户',
      note: `由产前版样衣任务 ${task.preProductionSampleTaskCode} 核对入库。`,
      sourceModule: '产前版样衣',
      sourceDocType: '产前版样衣任务',
      sourceDocCode: task.preProductionSampleTaskCode,
      sourceDocId: task.preProductionSampleTaskId,
    })
    updatePreProductionSampleTask(taskId, { sampleAssetId: assetInfo.assetId, sampleCode: assetInfo.assetCode, status: '验收中', acceptedAt: task.acceptedAt || nowText(), updatedAt: nowText(), updatedBy: '当前用户' })
    pushRuntimeLog('preProduction', taskId, '核对入库', `已回写商品项目样衣字段，样衣编号 ${assetInfo.assetCode}。`)
    setNotice(`产前版样衣任务 ${task.preProductionSampleTaskCode} 已完成核对入库。`)
    return
  }
  if (task.status === '验收中') {
    state.preProductionConclusionOpen = true
    state.preProductionConclusionTaskId = taskId
    state.preProductionConclusionResult = '通过'
    state.preProductionConclusionNote = ''
    return
  }
  setNotice(`产前版样衣任务 ${task.preProductionSampleTaskCode} 当前已完成，无需继续推进。`)
}

function confirmPreProductionGate(taskId: string): void {
  const task = getPreProductionSampleTaskById(taskId)
  if (!task) return
  const conclusion = preProductionConclusionMap.get(task.preProductionSampleTaskId)
  if (!conclusion || conclusion.result !== '通过') {
    setNotice(`产前版样衣任务 ${task.preProductionSampleTaskCode} 尚未形成“通过”的产前结论，不能门禁确认。`)
    return
  }
  preProductionGateMap.set(task.preProductionSampleTaskId, { confirmedBy: '当前用户', confirmedAt: nowText() })
  updatePreProductionSampleTask(taskId, { status: '已完成', confirmedAt: nowText(), updatedAt: nowText(), updatedBy: '当前用户', note: `${task.note ? `${task.note}；` : ''}门禁确认通过` })
  pushRuntimeLog('preProduction', taskId, '门禁确认', '已确认满足量产前门禁条件。')
  setNotice(`产前版样衣任务 ${task.preProductionSampleTaskCode} 已通过门禁确认。`)
}

function submitRevisionCreate(): void {
  const draft = state.revisionCreateDraft
  const projectDefaults = draft.projectId ? getProjectDefaultValues(draft.projectId) : { ownerName: '', styleId: '', styleCode: '', styleName: '' }
  const selectedStyle = draft.sourceType === '测款触发'
    ? (projectDefaults.styleId ? getStyleArchiveById(projectDefaults.styleId) : null)
    : (draft.styleId ? getStyleArchiveById(draft.styleId) : null)

  if (draft.sourceType === '测款触发' && !draft.projectId) {
    setNotice('测款触发的改版任务必须先选择商品项目。')
    return
  }
  if (draft.sourceType !== '测款触发' && !selectedStyle) {
    setNotice('请先选择正式款式档案。')
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
  const result = createRevisionTaskWithProjectRelation({
    projectId: draft.sourceType === '测款触发' ? draft.projectId : '',
    title: draft.title.trim() || '新建改版任务',
    sourceType: draft.sourceType,
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
  pushRuntimeLog('revision', result.task.revisionTaskId, '新建任务', result.task.projectId ? '已创建改版任务并写入项目关系。' : '已创建改版任务。')
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
  if (!draft.projectId) {
    setNotice('请先选择商品项目。')
    return
  }
  const project = getProjectById(draft.projectId)
  const defaults = getProjectDefaultValues(draft.projectId)
  const result = createPlateMakingTaskWithProjectRelation({
    projectId: draft.projectId,
    title: draft.title.trim() || '新建制版任务',
    sourceType: '项目模板阶段',
    upstreamModule: '项目模板',
    upstreamObjectType: '模板阶段',
    upstreamObjectId: project?.templateId || '',
    upstreamObjectCode: project?.templateVersion || '',
    ownerName: draft.ownerName.trim() || defaults.ownerName || '当前用户',
    priorityLevel: '中',
    dueAt: draft.dueAt.trim() || '',
    productStyleCode: draft.productStyleCode.trim() || defaults.styleCode,
    spuCode: draft.productStyleCode.trim() || defaults.styleCode,
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
  pushRuntimeLog('plate', result.task.plateTaskId, '新建任务', '已创建制版任务并写入项目关系。')
  setNotice(result.message)
  appStore.navigate(`/pcs/patterns/plate-making/${encodeURIComponent(result.task.plateTaskId)}`)
}

function submitPatternCreate(): void {
  const draft = state.patternCreateDraft
  if (!draft.projectId) {
    setNotice('请先选择商品项目。')
    return
  }
  const project = getProjectById(draft.projectId)
  const defaults = getProjectDefaultValues(draft.projectId)
  const result = createPatternTaskWithProjectRelation({
    projectId: draft.projectId,
    title: draft.title.trim() || '新建花型任务',
    sourceType: '项目模板阶段',
    upstreamModule: '项目模板',
    upstreamObjectType: '模板阶段',
    upstreamObjectId: project?.templateId || '',
    upstreamObjectCode: project?.templateVersion || '',
    ownerName: draft.ownerName.trim() || defaults.ownerName || '当前用户',
    priorityLevel: '中',
    dueAt: draft.dueAt.trim() || '',
    productStyleCode: draft.productStyleCode.trim() || defaults.styleCode,
    spuCode: draft.productStyleCode.trim() || defaults.styleCode,
    artworkType: draft.artworkType || '印花',
    patternMode: draft.patternMode || '定位印',
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
  pushRuntimeLog('pattern', result.task.patternTaskId, '新建任务', '已创建花型任务并写入项目关系。')
  setNotice(result.message)
  appStore.navigate(`/pcs/patterns/colors/${encodeURIComponent(result.task.patternTaskId)}`)
}

function submitFirstSampleCreate(): void {
  const draft = state.firstSampleCreateDraft
  if (!draft.projectId) {
    setNotice('请先选择商品项目。')
    return
  }
  const project = getProjectById(draft.projectId)
  const result = createFirstSampleTaskWithProjectRelation({
    projectId: draft.projectId,
    title: draft.title.trim() || '新建首版样衣打样',
    sourceType: '人工创建',
    ownerName: draft.ownerName.trim() || project?.ownerName || '当前用户',
    priorityLevel: '中',
    expectedArrival: draft.expectedArrival.trim() || '',
    factoryName: draft.factoryName.trim() || '',
    targetSite: draft.targetSite || '深圳',
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

function submitPreProductionCreate(): void {
  const draft = state.preProductionCreateDraft
  if (!draft.projectId) {
    setNotice('请先选择商品项目。')
    return
  }
  const project = getProjectById(draft.projectId)
  const result = createPreProductionSampleTaskWithProjectRelation({
    projectId: draft.projectId,
    title: draft.title.trim() || '新建产前版样衣',
    sourceType: '人工创建',
    ownerName: draft.ownerName.trim() || project?.ownerName || '当前用户',
    priorityLevel: '中',
    expectedArrival: draft.expectedArrival.trim() || '',
    factoryName: draft.factoryName.trim() || '',
    targetSite: draft.targetSite || '深圳',
    patternVersion: draft.patternVersion.trim(),
    artworkVersion: draft.artworkVersion.trim(),
    note: draft.note.trim(),
    operatorName: '当前用户',
  })
  if (!result.ok) {
    setNotice(result.message)
    return
  }
  state.preProductionCreateOpen = false
  state.preProductionCreateDraft = initialPreProductionCreateDraft()
  pushRuntimeLog('preProduction', result.task.preProductionSampleTaskId, '新建任务', '已创建产前版样衣任务并写入项目关系。')
  setNotice(result.message)
  appStore.navigate(`/pcs/samples/pre-production/${encodeURIComponent(result.task.preProductionSampleTaskId)}`)
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

export function renderPcsPreProductionSampleTaskPage(): string {
  return renderPreProductionListPage()
}

export function renderPcsPreProductionSampleTaskDetailPage(preProductionSampleTaskId: string): string {
  return renderPreProductionDetailPage(preProductionSampleTaskId)
}

export function handlePcsEngineeringTaskInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-engineering-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsEngineeringField
  if (!field) return false

  if (field === 'revision-create-evidence-images' && fieldNode instanceof HTMLInputElement) {
    const files = Array.from(fieldNode.files || []).filter((file) => file.type.startsWith('image/'))
    if (files.length === 0) return true
    state.revisionCreateDraft.evidenceImageUrls = [
      ...state.revisionCreateDraft.evidenceImageUrls,
      ...files.map((file) => URL.createObjectURL(file)),
    ]
    fieldNode.value = ''
    return true
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
  if (field === 'pre-production-search' && fieldNode instanceof HTMLInputElement) { state.preProductionList.search = fieldNode.value; state.preProductionList.currentPage = 1; return true }
  if (field === 'pre-production-status' && fieldNode instanceof HTMLSelectElement) { state.preProductionList.status = fieldNode.value; state.preProductionList.currentPage = 1; return true }
  if (field === 'pre-production-owner' && fieldNode instanceof HTMLSelectElement) { state.preProductionList.owner = fieldNode.value; state.preProductionList.currentPage = 1; return true }
  if (field === 'pre-production-source' && fieldNode instanceof HTMLSelectElement) { state.preProductionList.source = fieldNode.value; state.preProductionList.currentPage = 1; return true }
  if (field === 'pre-production-site' && fieldNode instanceof HTMLSelectElement) { state.preProductionList.site = fieldNode.value; state.preProductionList.currentPage = 1; return true }

  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLTextAreaElement || fieldNode instanceof HTMLSelectElement) {
    const value = fieldNode.value
    switch (field) {
      case 'revision-create-source-type':
        state.revisionCreateDraft.sourceType = value as RevisionTaskSourceType
        state.revisionCreateDraft.projectId = ''
        state.revisionCreateDraft.styleId = ''
        state.revisionCreateDraft.ownerName = ''
        state.revisionCreateDraft.createPatternTask = false
        return true
      case 'revision-create-project': {
        state.revisionCreateDraft.projectId = value
        const defaults = getProjectDefaultValues(value)
        state.revisionCreateDraft.ownerName = defaults.ownerName
        state.revisionCreateDraft.styleId = defaults.styleId
        state.revisionCreateDraft.createPatternTask = canCreateRevisionPatternTask(
          state.revisionCreateDraft.scopeCodes,
          state.revisionCreateDraft.sourceType,
          value,
        )
        return true
      }
      case 'revision-create-style-id': state.revisionCreateDraft.styleId = value; return true
      case 'revision-create-owner': state.revisionCreateDraft.ownerName = value; return true
      case 'revision-create-title': state.revisionCreateDraft.title = value; return true
      case 'revision-create-due-at': state.revisionCreateDraft.dueAt = fromDateTimeLocalValue(value); return true
      case 'revision-create-issue-summary': state.revisionCreateDraft.issueSummary = value; return true
      case 'revision-create-evidence-summary': state.revisionCreateDraft.evidenceSummary = value; return true
      case 'revision-create-note': state.revisionCreateDraft.note = value; return true
      case 'revision-detail-participants': state.revisionDetailDraft.participantNamesText = value; return true
      case 'revision-detail-version': state.revisionDetailDraft.revisionVersion = value; return true
      case 'plate-create-project': {
        state.plateCreateDraft.projectId = value
        const defaults = getProjectDefaultValues(value)
        state.plateCreateDraft.ownerName = defaults.ownerName
        state.plateCreateDraft.productStyleCode = defaults.styleCode
        return true
      }
      case 'plate-create-owner': state.plateCreateDraft.ownerName = value; return true
      case 'plate-create-title': state.plateCreateDraft.title = value; return true
      case 'plate-create-due-at': state.plateCreateDraft.dueAt = value; return true
      case 'plate-create-style-code': state.plateCreateDraft.productStyleCode = value; return true
      case 'plate-create-pattern-type': state.plateCreateDraft.patternType = value; return true
      case 'plate-create-size-range': state.plateCreateDraft.sizeRange = value; return true
      case 'plate-create-note': state.plateCreateDraft.note = value; return true
      case 'plate-detail-participants': state.plateDetailDraft.participantNamesText = value; return true
      case 'plate-detail-version': state.plateDetailDraft.patternVersion = value; return true
      case 'pattern-create-project': {
        state.patternCreateDraft.projectId = value
        const defaults = getProjectDefaultValues(value)
        state.patternCreateDraft.ownerName = defaults.ownerName
        state.patternCreateDraft.productStyleCode = defaults.styleCode
        return true
      }
      case 'pattern-create-owner': state.patternCreateDraft.ownerName = value; return true
      case 'pattern-create-title': state.patternCreateDraft.title = value; return true
      case 'pattern-create-due-at': state.patternCreateDraft.dueAt = value; return true
      case 'pattern-create-style-code': state.patternCreateDraft.productStyleCode = value; return true
      case 'pattern-create-artwork-name': state.patternCreateDraft.artworkName = value; return true
      case 'pattern-create-artwork-type': state.patternCreateDraft.artworkType = value; return true
      case 'pattern-create-pattern-mode': state.patternCreateDraft.patternMode = value; return true
      case 'pattern-create-note': state.patternCreateDraft.note = value; return true
      case 'pattern-detail-version': state.patternDetailDraft.artworkVersion = value; return true
      case 'first-sample-create-project': {
        state.firstSampleCreateDraft.projectId = value
        state.firstSampleCreateDraft.ownerName = getProjectById(value)?.ownerName || ''
        return true
      }
      case 'first-sample-create-owner': state.firstSampleCreateDraft.ownerName = value; return true
      case 'first-sample-create-title': state.firstSampleCreateDraft.title = value; return true
      case 'first-sample-create-expected-arrival': state.firstSampleCreateDraft.expectedArrival = value; return true
      case 'first-sample-create-factory': state.firstSampleCreateDraft.factoryName = value; return true
      case 'first-sample-create-site': state.firstSampleCreateDraft.targetSite = value; return true
      case 'first-sample-create-note': state.firstSampleCreateDraft.note = value; return true
      case 'first-sample-acceptance-result': state.firstSampleAcceptanceResult = value; return true
      case 'first-sample-acceptance-note': state.firstSampleAcceptanceNote = value; return true
      case 'pre-production-create-project': {
        state.preProductionCreateDraft.projectId = value
        state.preProductionCreateDraft.ownerName = getProjectById(value)?.ownerName || ''
        return true
      }
      case 'pre-production-create-owner': state.preProductionCreateDraft.ownerName = value; return true
      case 'pre-production-create-title': state.preProductionCreateDraft.title = value; return true
      case 'pre-production-create-expected-arrival': state.preProductionCreateDraft.expectedArrival = value; return true
      case 'pre-production-create-factory': state.preProductionCreateDraft.factoryName = value; return true
      case 'pre-production-create-site': state.preProductionCreateDraft.targetSite = value; return true
      case 'pre-production-create-pattern-version': state.preProductionCreateDraft.patternVersion = value; return true
      case 'pre-production-create-artwork-version': state.preProductionCreateDraft.artworkVersion = value; return true
      case 'pre-production-create-note': state.preProductionCreateDraft.note = value; return true
      case 'pre-production-conclusion-result': state.preProductionConclusionResult = value; return true
      case 'pre-production-conclusion-note': state.preProductionConclusionNote = value; return true
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

  if (action === 'open-revision-create') { setNotice('请在商品项目对应节点中推进并自动创建改版任务。'); return true }
  if (action === 'close-revision-create') { state.revisionCreateOpen = false; return true }
  if (action === 'submit-revision-create') { submitRevisionCreate(); return true }
  if (action === 'open-plate-create') { setNotice('请在商品项目对应节点中推进并自动创建制版任务。'); return true }
  if (action === 'close-plate-create') { state.plateCreateOpen = false; return true }
  if (action === 'submit-plate-create') { submitPlateCreate(); return true }
  if (action === 'open-pattern-create') { setNotice('请在商品项目对应节点中推进并自动创建花型任务。'); return true }
  if (action === 'close-pattern-create') { state.patternCreateOpen = false; return true }
  if (action === 'submit-pattern-create') { submitPatternCreate(); return true }
  if (action === 'open-first-sample-create') { state.firstSampleCreateOpen = true; return true }
  if (action === 'close-first-sample-create') { state.firstSampleCreateOpen = false; return true }
  if (action === 'submit-first-sample-create') { submitFirstSampleCreate(); return true }
  if (action === 'open-pre-production-create') { state.preProductionCreateOpen = true; return true }
  if (action === 'close-pre-production-create') { state.preProductionCreateOpen = false; return true }
  if (action === 'submit-pre-production-create') { submitPreProductionCreate(); return true }

  if (action === 'set-revision-quick-filter') { state.revisionList.quickFilter = actionNode.dataset.quickFilter || 'all'; state.revisionList.currentPage = 1; return true }
  if (action === 'set-plate-quick-filter') { state.plateList.quickFilter = actionNode.dataset.quickFilter || 'all'; state.plateList.currentPage = 1; return true }
  if (action === 'set-pattern-quick-filter') { state.patternList.quickFilter = actionNode.dataset.quickFilter || 'all'; state.patternList.currentPage = 1; return true }
  if (action === 'set-first-sample-quick-filter') { state.firstSampleList.quickFilter = actionNode.dataset.quickFilter || 'all'; state.firstSampleList.currentPage = 1; return true }
  if (action === 'set-pre-production-quick-filter') { state.preProductionList.quickFilter = actionNode.dataset.quickFilter || 'all'; state.preProductionList.currentPage = 1; return true }

  if (action === 'change-revision-page') { updateListPage(state.revisionList, Number(actionNode.dataset.pageStep || '0'), getRevisionTasksFiltered().length); return true }
  if (action === 'change-plate-page') { updateListPage(state.plateList, Number(actionNode.dataset.pageStep || '0'), getPlateTasksFiltered().length); return true }
  if (action === 'change-pattern-page') { updateListPage(state.patternList, Number(actionNode.dataset.pageStep || '0'), getPatternTasksFiltered().length); return true }
  if (action === 'change-first-sample-page') { updateListPage(state.firstSampleList, Number(actionNode.dataset.pageStep || '0'), getFirstSampleTasksFiltered().length); return true }
  if (action === 'change-pre-production-page') { updateListPage(state.preProductionList, Number(actionNode.dataset.pageStep || '0'), getPreProductionTasksFiltered().length); return true }

  if (action === 'set-revision-tab') { state.revisionTab = (actionNode.dataset.tab as RevisionTab) || 'plan'; return true }
  if (action === 'set-plate-tab') { state.plateTab = (actionNode.dataset.tab as PlateTab) || 'overview'; return true }
  if (action === 'set-pattern-tab') { state.patternTab = (actionNode.dataset.tab as PatternTab) || 'plan'; return true }
  if (action === 'set-first-sample-tab') { state.firstSampleTab = (actionNode.dataset.tab as FirstSampleTab) || 'overview'; return true }
  if (action === 'set-pre-production-tab') { state.preProductionTab = (actionNode.dataset.tab as PreProductionTab) || 'overview'; return true }

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

  if (action === 'remove-revision-evidence-image') {
    const index = Number(actionNode.dataset.imageIndex || '-1')
    if (index >= 0) {
      state.revisionCreateDraft.evidenceImageUrls = state.revisionCreateDraft.evidenceImageUrls.filter((_, itemIndex) => itemIndex !== index)
    }
    return true
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

  if (action === 'save-revision-detail-fields') {
    const taskId = actionNode.dataset.taskId || ''
    const draft = state.revisionDetailDraft
    const participants = draft.participantNamesText.split(/[、,，]/).map((item) => item.trim()).filter(Boolean)
    updateRevisionTask(taskId, {
      participantNames: participants,
      revisionVersion: draft.revisionVersion.trim(),
      updatedAt: nowText(),
      updatedBy: '当前用户',
    })
    setNotice('改版任务实例补齐字段已保存。')
    return true
  }
  if (action === 'save-plate-detail-fields') {
    const taskId = actionNode.dataset.taskId || ''
    const draft = state.plateDetailDraft
    const participants = draft.participantNamesText.split(/[、,，]/).map((item) => item.trim()).filter(Boolean)
    updatePlateMakingTask(taskId, {
      participantNames: participants,
      patternVersion: draft.patternVersion.trim(),
      updatedAt: nowText(),
      updatedBy: '当前用户',
    })
    setNotice('制版任务实例补齐字段已保存。')
    return true
  }
  if (action === 'save-pattern-detail-fields') {
    const taskId = actionNode.dataset.taskId || ''
    const draft = state.patternDetailDraft
    updatePatternTask(taskId, {
      artworkVersion: draft.artworkVersion.trim(),
      updatedAt: nowText(),
      updatedBy: '当前用户',
    })
    setNotice('花型任务实例补齐字段已保存。')
    return true
  }

  if (action === 'revision-generate-tech-pack') { generateRevisionTechPack(actionNode.dataset.taskId || ''); return true }
  if (action === 'plate-generate-tech-pack') { generatePlateTechPack(actionNode.dataset.taskId || ''); return true }
  if (action === 'pattern-generate-tech-pack') { generatePatternTechPack(actionNode.dataset.taskId || ''); return true }
  if (action === 'complete-revision-task') {
    const taskId = actionNode.dataset.taskId || ''
    try {
      const result = completeRevisionTaskWithProjectRelationSync(taskId, '当前用户')
      pushRuntimeLog('revision', taskId, '完成任务', '已完成改版任务并同步商品项目节点。')
      setNotice(`改版任务 ${result.task.revisionTaskCode} 已完成，并同步更新商品项目节点。`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '改版任务完成失败。')
    }
    return true
  }
  if (action === 'complete-plate-task') {
    const taskId = actionNode.dataset.taskId || ''
    try {
      const result = completePlateMakingTaskWithProjectRelationSync(taskId, '当前用户')
      pushRuntimeLog('plate', taskId, '完成任务', '已完成制版任务并同步商品项目节点。')
      setNotice(`制版任务 ${result.task.plateTaskCode} 已完成，并同步更新商品项目节点。`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '制版任务完成失败。')
    }
    return true
  }
  if (action === 'complete-pattern-task') {
    const taskId = actionNode.dataset.taskId || ''
    try {
      const result = completePatternTaskWithProjectRelationSync(taskId, '当前用户')
      pushRuntimeLog('pattern', taskId, '完成任务', '已完成花型任务并同步商品项目节点。')
      setNotice(`花型任务 ${result.task.patternTaskCode} 已完成，并同步更新商品项目节点。`)
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

  if (action === 'first-sample-advance-logistics') { updateSampleTaskByFlow(actionNode.dataset.taskId || '', 'firstSample'); return true }
  if (action === 'close-first-sample-acceptance') { state.firstSampleAcceptanceOpen = false; return true }
  if (action === 'submit-first-sample-acceptance') {
    const task = getFirstSampleTaskById(state.firstSampleAcceptanceTaskId)
    if (!task) { setNotice('未找到首版样衣任务。'); return true }
    firstSampleAcceptanceMap.set(task.firstSampleTaskId, { result: state.firstSampleAcceptanceResult, note: state.firstSampleAcceptanceNote.trim(), updatedAt: nowText() })
    updateFirstSampleTask(task.firstSampleTaskId, { status: '已完成', confirmedAt: nowText(), updatedAt: nowText(), updatedBy: '当前用户', note: `${task.note ? `${task.note}；` : ''}验收结论：${state.firstSampleAcceptanceResult}` })
    pushRuntimeLog('firstSample', task.firstSampleTaskId, '填写验收', `验收结论：${state.firstSampleAcceptanceResult}。${state.firstSampleAcceptanceNote.trim() || '已完成验收。'}`)
    state.firstSampleAcceptanceOpen = false
    setNotice(`首版样衣任务 ${task.firstSampleTaskCode} 已提交验收结论。`)
    return true
  }

  if (action === 'pre-production-advance-logistics') { updateSampleTaskByFlow(actionNode.dataset.taskId || '', 'preProduction'); return true }
  if (action === 'close-pre-production-conclusion') { state.preProductionConclusionOpen = false; return true }
  if (action === 'submit-pre-production-conclusion') {
    const task = getPreProductionSampleTaskById(state.preProductionConclusionTaskId)
    if (!task) { setNotice('未找到产前版样衣任务。'); return true }
    preProductionConclusionMap.set(task.preProductionSampleTaskId, { result: state.preProductionConclusionResult, note: state.preProductionConclusionNote.trim(), updatedAt: nowText() })
    updatePreProductionSampleTask(task.preProductionSampleTaskId, { status: '验收中', updatedAt: nowText(), updatedBy: '当前用户', note: `${task.note ? `${task.note}；` : ''}产前结论：${state.preProductionConclusionResult}` })
    pushRuntimeLog('preProduction', task.preProductionSampleTaskId, '产前结论', `结论：${state.preProductionConclusionResult}。${state.preProductionConclusionNote.trim() || '已记录产前结论。'}`)
    state.preProductionConclusionOpen = false
    setNotice(`产前版样衣任务 ${task.preProductionSampleTaskCode} 已提交产前结论。`)
    return true
  }
  if (action === 'pre-production-confirm-gate') { confirmPreProductionGate(actionNode.dataset.taskId || ''); return true }

  if (action === 'close-all-engineering-dialogs') { closeAllDialogs(); return true }
  return false
}

export function isPcsEngineeringTaskDialogOpen(): boolean {
  return (
    state.revisionCreateOpen
    || state.plateCreateOpen
    || state.patternCreateOpen
    || state.firstSampleCreateOpen
    || state.firstSampleAcceptanceOpen
    || state.preProductionCreateOpen
    || state.preProductionConclusionOpen
  )
}

export function resetPcsEngineeringTaskState(): void {
  clearNotice()
  state.revisionList = { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 }
  state.revisionTab = 'plan'
  state.revisionCreateOpen = false
  state.revisionCreateDraft = initialRevisionCreateDraft()
  state.revisionDetailDraftTaskId = ''
  state.revisionDetailDraft = { participantNamesText: '', revisionVersion: '' }
  state.plateList = { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 }
  state.plateTab = 'overview'
  state.plateCreateOpen = false
  state.plateCreateDraft = initialPlateCreateDraft()
  state.plateDetailDraftTaskId = ''
  state.plateDetailDraft = { participantNamesText: '', patternVersion: '' }
  state.patternList = { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 }
  state.patternTab = 'plan'
  state.patternCreateOpen = false
  state.patternCreateDraft = initialPatternCreateDraft()
  state.patternDetailDraftTaskId = ''
  state.patternDetailDraft = { artworkVersion: '' }
  state.firstSampleList = { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1, site: 'all' }
  state.firstSampleTab = 'overview'
  state.firstSampleCreateOpen = false
  state.firstSampleCreateDraft = initialSampleCreateDraft()
  state.firstSampleAcceptanceOpen = false
  state.firstSampleAcceptanceTaskId = ''
  state.firstSampleAcceptanceResult = '通过'
  state.firstSampleAcceptanceNote = ''
  state.preProductionList = { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1, site: 'all' }
  state.preProductionTab = 'overview'
  state.preProductionCreateOpen = false
  state.preProductionCreateDraft = initialPreProductionCreateDraft()
  state.preProductionConclusionOpen = false
  state.preProductionConclusionTaskId = ''
  state.preProductionConclusionResult = '通过'
  state.preProductionConclusionNote = ''
  Object.values(runtimeLogs).forEach((map) => map.clear())
  firstSampleAcceptanceMap.clear()
  preProductionConclusionMap.clear()
  preProductionGateMap.clear()
}

export function resetPcsEngineeringTaskRepositories(): void {
  resetRevisionTaskRepository()
  resetPlateMakingTaskRepository()
  resetPatternTaskRepository()
  resetFirstSampleTaskRepository()
  resetPreProductionSampleTaskRepository()
}
