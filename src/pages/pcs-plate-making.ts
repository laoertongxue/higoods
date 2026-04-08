import { escapeHtml, formatDateTime } from '../utils'
import {
  renderDrawer as uiDrawer,
  renderFormDialog as uiFormDialog,
  renderSecondaryButton,
} from '../components/ui'
import { listPartTemplateRecords, recommendPartTemplateRecords } from '../data/pcs-part-template-library'
import {
  parsePartTemplateFiles,
  resolveTemplateFilePair,
  type ParsedPartTemplateResult,
  type ParsedPartInstance,
} from '../utils/pcs-part-template-parser'
import { getTemplateMachineSuitabilityLabel } from '../utils/pcs-part-template-shape-description'

// ============ 常量定义 ============

const STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'NOT_STARTED', label: '未开始' },
  { value: 'IN_PROGRESS', label: '进行中' },
  { value: 'PENDING_REVIEW', label: '待评审' },
  { value: 'APPROVED', label: '已确认' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'BLOCKED', label: '阻塞' },
  { value: 'CANCELLED', label: '已取消' },
]

const SOURCE_TYPE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: '改版任务', label: '改版任务' },
  { value: '项目模板阶段', label: '项目模板阶段' },
  { value: '既有商品二次开发', label: '既有商品二次开发' },
]

const SITE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: '深圳', label: '深圳' },
  { value: '雅加达', label: '雅加达' },
]

// ============ Mock 数据 ============

const mockTasks = [
  {
    id: 'PT-20260109-002',
    instance_code: 'PT-20260109-002',
    title: '制版-印尼碎花连衣裙(P1)',
    status: 'APPROVED',
    project_ref: { id: 'PRJ-20251216-001', name: '印尼风格碎花连衣裙' },
    source_type: '改版任务',
    upstream_instance_ref: { id: 'RT-20260109-003', title: 'V领印花改版' },
    product_ref: { id: 'SPU-001', name: '碎花连衣裙', spu: 'DRS-001' },
    pattern_type: '连衣裙',
    size_range: 'S-XL',
    owner: '王版师',
    due_at: '2026-01-15',
    pattern_version: 'P1',
    downstream_count: 2,
    updated_at: '2026-01-09 14:30',
    priority: '高',
    participants: ['张工', '李工'],
  },
  {
    id: 'PT-20260109-001',
    instance_code: 'PT-20260109-001',
    title: '制版-基础款白T恤',
    status: 'IN_PROGRESS',
    project_ref: { id: 'PRJ-20251216-002', name: '基础款白色T恤' },
    source_type: '项目模板阶段',
    product_ref: { id: 'SPU-002', name: '白T恤', spu: 'TSH-001' },
    pattern_type: '上衣',
    size_range: 'XS-XXL',
    owner: '李版师',
    due_at: '2026-01-12',
    pattern_version: '-',
    downstream_count: 0,
    updated_at: '2026-01-09 10:00',
    priority: '中',
    participants: [],
  },
  {
    id: 'PT-20260108-005',
    instance_code: 'PT-20260108-005',
    title: '制版-牛仔短裤放码',
    status: 'PENDING_REVIEW',
    project_ref: { id: 'PRJ-20251215-003', name: '夏季牛仔短裤' },
    source_type: '既有商品二次开发',
    product_ref: { id: 'SPU-003', name: '牛仔短裤', spu: 'SHO-003' },
    pattern_type: '裤装',
    size_range: '26-34',
    owner: '张版师',
    due_at: '2026-01-10',
    pattern_version: '-',
    downstream_count: 0,
    updated_at: '2026-01-08 16:45',
    priority: '高',
    participants: ['王工'],
  },
  {
    id: 'PT-20260107-012',
    instance_code: 'PT-20260107-012',
    title: '制版-羽绒外套(P2)',
    status: 'APPROVED',
    project_ref: { id: 'PRJ-20251210-008', name: '冬季羽绒外套' },
    source_type: '改版任务',
    upstream_instance_ref: { id: 'RT-20260105-008', title: '袖长调整' },
    product_ref: { id: 'SPU-008', name: '羽绒外套', spu: 'JKT-008' },
    pattern_type: '外套',
    size_range: 'S-XXXL',
    owner: '陈版师',
    due_at: '2026-01-08',
    pattern_version: 'P2',
    downstream_count: 3,
    updated_at: '2026-01-07 18:00',
    priority: '中',
    participants: ['李工', '赵工'],
  },
  {
    id: 'PT-20260106-008',
    instance_code: 'PT-20260106-008',
    title: '制版-休闲衬衫',
    status: 'NOT_STARTED',
    project_ref: { id: 'PRJ-20251212-006', name: '商务休闲衬衫' },
    source_type: '项目模板阶段',
    product_ref: null,
    pattern_type: '上衣',
    size_range: '38-44',
    owner: '赵版师',
    due_at: '2026-01-18',
    pattern_version: '-',
    downstream_count: 0,
    updated_at: '2026-01-06 09:15',
    priority: '低',
    participants: [],
  },
  {
    id: 'PT-20260105-003',
    instance_code: 'PT-20260105-003',
    title: '制版-波西米亚长裙',
    status: 'BLOCKED',
    project_ref: { id: 'PRJ-20251213-005', name: '波西米亚风长裙' },
    source_type: '改版任务',
    upstream_instance_ref: { id: 'RT-20260103-015', title: '腰线调整' },
    product_ref: { id: 'SPU-005', name: '波西米亚长裙', spu: 'DRS-005' },
    pattern_type: '连衣裙',
    size_range: 'S-L',
    owner: '刘版师',
    due_at: '2026-01-09',
    pattern_version: '-',
    downstream_count: 0,
    updated_at: '2026-01-05 14:20',
    priority: '高',
    participants: ['王工'],
  },
]

// ============ 类型定义 ============

interface PlateMakingState {
  search: string
  statusFilter: string
  ownerFilter: string
  sourceFilter: string
  siteFilter: string
  kpiFilter: string
  selectedTasks: string[]
  currentPage: number
  createDrawerOpen: boolean
  downstreamDialogOpen: boolean
  selectedTaskId: string | null
  recommendationDrawerOpen: boolean
  recommendationTargetTaskId: string | null
  recommendationSelectedDxfFile: File | null
  recommendationSelectedRulFile: File | null
  recommendationUploadError: string | null
  recommendationParseError: string | null
  recommendationParsing: boolean
  recommendationParseResult: ParsedPartTemplateResult | null
  recommendationMessage: string | null
}

let state: PlateMakingState = {
  search: '',
  statusFilter: 'all',
  ownerFilter: 'all',
  sourceFilter: 'all',
  siteFilter: 'all',
  kpiFilter: 'all',
  selectedTasks: [],
  currentPage: 1,
  createDrawerOpen: false,
  downstreamDialogOpen: false,
  selectedTaskId: null,
  recommendationDrawerOpen: false,
  recommendationTargetTaskId: null,
  recommendationSelectedDxfFile: null,
  recommendationSelectedRulFile: null,
  recommendationUploadError: null,
  recommendationParseError: null,
  recommendationParsing: false,
  recommendationParseResult: null,
  recommendationMessage: null,
}

const APP_RENDER_EVENT = 'higood:request-render'
let recommendationParseRequestId = 0

// ============ 工具函数 ============

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    NOT_STARTED: { label: '未开始', className: 'bg-slate-100 text-slate-700' },
    IN_PROGRESS: { label: '进行中', className: 'bg-blue-100 text-blue-700' },
    PENDING_REVIEW: { label: '待评审', className: 'bg-amber-100 text-amber-700' },
    APPROVED: { label: '已确认', className: 'bg-green-100 text-green-700' },
    COMPLETED: { label: '已完成', className: 'bg-emerald-100 text-emerald-700' },
    BLOCKED: { label: '阻塞', className: 'bg-red-100 text-red-700' },
    CANCELLED: { label: '已取消', className: 'bg-gray-100 text-gray-500' },
  }
  return map[status] || { label: status, className: 'bg-gray-100 text-gray-700' }
}

function getFilteredTasks() {
  return mockTasks.filter((task) => {
    const matchSearch =
      state.search === '' ||
      task.title.toLowerCase().includes(state.search.toLowerCase()) ||
      task.instance_code.toLowerCase().includes(state.search.toLowerCase()) ||
      task.project_ref.name.toLowerCase().includes(state.search.toLowerCase())

    const matchStatus = state.statusFilter === 'all' || task.status === state.statusFilter
    const matchOwner = state.ownerFilter === 'all' || task.owner === state.ownerFilter
    const matchSource = state.sourceFilter === 'all' || task.source_type === state.sourceFilter

    // KPI filters
    if (state.kpiFilter === 'mine') return task.owner === '王版师' && matchSearch && matchStatus
    if (state.kpiFilter === 'pending_review') return task.status === 'PENDING_REVIEW' && matchSearch
    if (state.kpiFilter === 'frozen_no_downstream')
      return task.status === 'APPROVED' && task.downstream_count === 0 && matchSearch
    if (state.kpiFilter === 'blocked') return task.status === 'BLOCKED' && matchSearch
    if (state.kpiFilter === 'overdue') {
      const dueDate = new Date(task.due_at)
      const today = new Date()
      return dueDate < today && task.status !== 'COMPLETED' && matchSearch
    }

    return matchSearch && matchStatus && matchOwner && matchSource
  })
}

function getKpiStats() {
  return {
    all: mockTasks.length,
    mine: mockTasks.filter((t) => t.owner === '王版师').length,
    pending_review: mockTasks.filter((t) => t.status === 'PENDING_REVIEW').length,
    frozen_no_downstream: mockTasks.filter((t) => t.status === 'APPROVED' && t.downstream_count === 0).length,
    blocked: mockTasks.filter((t) => t.status === 'BLOCKED').length,
    overdue: 1,
  }
}

function requestRender(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(APP_RENDER_EVENT))
  }
}

function resetRecommendationState(): void {
  recommendationParseRequestId += 1
  state.recommendationTargetTaskId = null
  state.recommendationSelectedDxfFile = null
  state.recommendationSelectedRulFile = null
  state.recommendationUploadError = null
  state.recommendationParseError = null
  state.recommendationParsing = false
  state.recommendationParseResult = null
  state.recommendationMessage = null
}

function getRecommendationTargetTask() {
  return mockTasks.find((task) => task.id === state.recommendationTargetTaskId) ?? null
}

function getFileExtension(fileName: string): string {
  const match = /\.([^.]+)$/.exec(fileName)
  return match ? match[1].toLowerCase() : ''
}

function getSelectedRecommendationFiles(): File[] {
  return [state.recommendationSelectedDxfFile, state.recommendationSelectedRulFile].filter(
    (file): file is File => file instanceof File,
  )
}

function getSingleRecommendationUploadError(
  file: File | null,
  expectedExtension: 'dxf' | 'rul',
  label: string,
): string | null {
  if (!file) return null
  if (getFileExtension(file.name) !== expectedExtension) {
    return `${label}必须上传 .${expectedExtension} 文件。`
  }
  return null
}

function getRecommendationUploadError(): string | null {
  return (
    getSingleRecommendationUploadError(state.recommendationSelectedDxfFile, 'dxf', 'DXF 文件') ??
    getSingleRecommendationUploadError(state.recommendationSelectedRulFile, 'rul', 'RUL 文件')
  )
}

function getRecommendationFileStatus(): string {
  if (state.recommendationUploadError) return state.recommendationUploadError
  return `DXF：${state.recommendationSelectedDxfFile?.name ?? '未上传'}；RUL：${state.recommendationSelectedRulFile?.name ?? '未上传'}`
}

function formatTemplateMetric(value?: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '-'
  return String(value)
}

function renderRecommendationReasons(reasons: string[]): string {
  return reasons
    .slice(0, 4)
    .map((reason) => `<p>${escapeHtml(reason)}</p>`)
    .join('')
}

function renderRecommendationShapeTags(values: string[]): string {
  if (values.length === 0) return '<span class="text-xs text-gray-400">待补充</span>'
  return values
    .slice(0, 3)
    .map(
      (value) =>
        `<span class="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">${escapeHtml(
          value,
        )}</span>`,
    )
    .join('')
}

function renderRecommendationList(part: ParsedPartInstance): string {
  const recommendations = recommendPartTemplateRecords(part, 3)

  if (recommendations.length === 0) {
    return '<p class="text-sm text-gray-500">当前部位模板库暂无已保存的部位模板，请先去“部位模板库”保存模板后再匹配。</p>'
  }

  return recommendations
    .map(
      (recommendation) => `
        <article class="rounded-lg border bg-slate-50 p-3">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-sm font-medium">${escapeHtml(recommendation.record.templateName)} / ${escapeHtml(recommendation.record.standardPartName)}</p>
              <p class="mt-1 text-xs text-gray-500">${escapeHtml(recommendation.record.sourcePartName)} · 尺码 ${escapeHtml(recommendation.record.sizeCode ?? '-')}</p>
            </div>
            <span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">${recommendation.matchScore} 分</span>
          </div>
          <div class="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div class="space-y-1 text-xs text-gray-600">
              <div class="flex flex-wrap gap-1">${renderRecommendationShapeTags(recommendation.record.shapeDescription?.shapeTags ?? [])}</div>
              <p class="pt-1 text-slate-700">${escapeHtml(recommendation.record.shapeDescription?.autoDescription ?? '待补充')}</p>
              ${renderRecommendationReasons(recommendation.reasons)}
            </div>
            <div class="rounded-lg border bg-white p-3 text-xs text-gray-500">
              <p>宽高：${formatTemplateMetric(recommendation.record.width)} × ${formatTemplateMetric(recommendation.record.height)}</p>
              <p class="mt-1">模板机适配：${escapeHtml(
                recommendation.record.shapeDescription
                  ? getTemplateMachineSuitabilityLabel(recommendation.record.shapeDescription.templateMachineSuitability)
                  : recommendation.record.machineReadyStatus,
              )}</p>
              <p class="mt-1">历史命中：${recommendation.record.reuseHitCount}</p>
              <p class="mt-1">爆款次数：${recommendation.record.hotStyleCount}</p>
              <p class="mt-1">累计下单：${recommendation.record.cumulativeOrderQty}</p>
              <button class="mt-3 h-8 rounded-md border px-3 text-xs hover:bg-slate-50" data-plate-action="use-template" data-template-record-id="${escapeHtml(recommendation.record.id)}" data-template-label="${escapeHtml(`${recommendation.record.templateName} / ${recommendation.record.standardPartName}`)}">使用模板</button>
            </div>
          </div>
        </article>
      `,
    )
    .join('')
}

function renderRecommendationPartCards(result: ParsedPartTemplateResult): string {
  return result.parts
    .map(
      (part) => `
        <article class="rounded-lg border bg-white p-4">
          <div class="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
            <div class="overflow-hidden rounded-lg border bg-slate-50 p-3">
              <div class="aspect-[11/8]">${part.previewSvg ?? '<div class="flex h-full items-center justify-center text-xs text-gray-400">暂无预览</div>'}</div>
            </div>
            <div class="space-y-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 class="text-base font-semibold">${escapeHtml(part.sourcePartName)}</h3>
                  <p class="mt-1 text-xs text-gray-500">${escapeHtml(part.systemPieceName ? `系统 Piece Name：${part.systemPieceName}` : '未识别系统 Piece Name')}</p>
                </div>
                <div class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(part.sizeCode ?? '未识别尺码')}</div>
              </div>
              <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                <div>
                  <p class="text-xs text-gray-500">候选名称</p>
                  <p class="mt-1">${escapeHtml(part.candidatePartNames.join(' / ') || '未识别')}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">宽高</p>
                  <p class="mt-1">${formatTemplateMetric(part.metrics?.width)} × ${formatTemplateMetric(part.metrics?.height)}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">面积</p>
                  <p class="mt-1">${formatTemplateMetric(part.metrics?.area)}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">几何哈希</p>
                  <p class="mt-1 break-all">${escapeHtml(part.geometryHash ?? '-')}</p>
                </div>
              </div>
              <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_240px]">
                <div class="rounded-lg border bg-slate-50 px-3 py-3">
                  <p class="text-xs text-gray-500">形状判断</p>
                  <div class="mt-2 flex flex-wrap gap-1">${renderRecommendationShapeTags(part.shapeDescription?.shapeTags ?? [])}</div>
                  <p class="mt-2 text-xs text-gray-600">${escapeHtml(part.shapeDescription?.autoDescription ?? '待补充')}</p>
                </div>
                <div class="rounded-lg border bg-slate-50 px-3 py-3 text-xs text-gray-600">
                  <p>对称度：${formatTemplateMetric(part.geometryFeatures?.symmetryScore)}</p>
                  <p class="mt-1">收窄比：${formatTemplateMetric(part.geometryFeatures?.taperRatio)}</p>
                  <p class="mt-1">主弧段：${part.geometryFeatures?.majorArcCount ?? '-'}</p>
                  <p class="mt-1">弯曲等级：${escapeHtml(part.geometryFeatures?.curvatureLevel ?? '-')}</p>
                </div>
              </div>
              <div class="space-y-2">
                <h4 class="text-sm font-medium text-gray-900">推荐模板（前 3 名）</h4>
                ${renderRecommendationList(part)}
              </div>
            </div>
          </div>
        </article>
      `,
    )
    .join('')
}

function renderRecommendationDrawer() {
  if (!state.recommendationDrawerOpen) return ''

  const targetTask = getRecommendationTargetTask()
  const libraryCount = listPartTemplateRecords().length
  const canParse = !state.recommendationParsing

  const content = `
    <div class="space-y-6">
      <section class="rounded-lg border bg-slate-50 p-4">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p class="text-xs text-gray-500">当前任务</p>
            <p class="mt-1 text-sm font-medium">${escapeHtml(targetTask?.title ?? '通用模板匹配')}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">目标尺码段</p>
            <p class="mt-1 text-sm font-medium">${escapeHtml(targetTask?.size_range ?? '-')}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">负责人</p>
            <p class="mt-1 text-sm font-medium">${escapeHtml(targetTask?.owner ?? '-')}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">模板库可用记录</p>
            <p class="mt-1 text-sm font-medium">${libraryCount} 条部位模板</p>
          </div>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-900">开发态上传待匹配纸样</label>
            <div class="grid gap-3 md:grid-cols-2">
              <div class="rounded-lg border bg-slate-50 p-3">
                <label class="mb-2 block text-sm font-medium text-gray-900">DXF 文件</label>
                <input type="file" class="w-full text-sm" accept=".dxf" data-plate-action="select-recommend-dxf-file" />
                <p class="mt-2 text-xs text-gray-500">${escapeHtml(state.recommendationSelectedDxfFile?.name ?? '未上传 DXF 文件')}</p>
              </div>
              <div class="rounded-lg border bg-slate-50 p-3">
                <label class="mb-2 block text-sm font-medium text-gray-900">RUL 文件</label>
                <input type="file" class="w-full text-sm" accept=".rul" data-plate-action="select-recommend-rul-file" />
                <p class="mt-2 text-xs text-gray-500">${escapeHtml(state.recommendationSelectedRulFile?.name ?? '未上传 RUL 文件')}</p>
              </div>
            </div>
          </div>
          <p class="text-xs ${state.recommendationUploadError ? 'text-rose-600' : 'text-gray-500'}">${escapeHtml(getRecommendationFileStatus())}</p>
          <div class="flex flex-wrap gap-2">
            <button class="h-9 rounded-md border px-3 text-sm hover:bg-slate-50 ${canParse ? '' : 'cursor-not-allowed opacity-60'}" data-plate-action="parse-recommendation">${state.recommendationParsing ? '解析中...' : '解析并推荐'}</button>
            <button class="h-9 rounded-md border px-3 text-sm hover:bg-slate-50" data-plate-action="clear-recommendation-files">清空已上传文件</button>
          </div>
          ${state.recommendationParseError ? `<p class="text-sm text-rose-600">${escapeHtml(state.recommendationParseError)}</p>` : ''}
          ${state.recommendationMessage ? `<p class="text-sm text-emerald-700">${escapeHtml(state.recommendationMessage)}</p>` : ''}
        </div>
      </section>

      ${
        state.recommendationParseResult
          ? `
            <section class="rounded-lg border bg-slate-50 p-4">
              <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p class="text-xs text-gray-500">模板名 / 款式名</p>
                  <p class="mt-1 text-sm font-medium">${escapeHtml(state.recommendationParseResult.templateName)}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">单位 / 基码</p>
                  <p class="mt-1 text-sm font-medium">${escapeHtml(state.recommendationParseResult.rul.units ?? '-')} / ${escapeHtml(state.recommendationParseResult.rul.sampleSize ?? '-')}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">尺码列表</p>
                <p class="mt-1 text-sm font-medium">${escapeHtml(state.recommendationParseResult.rul.sizeList.join(', ') || '-')}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">待匹配部位数</p>
                <p class="mt-1 text-sm font-medium">${state.recommendationParseResult.parts.length}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">解析时间</p>
                <p class="mt-1 text-sm font-medium">${escapeHtml(formatDateTime(state.recommendationParseResult.parsedAt))}</p>
              </div>
            </div>
          </section>

          <section class="space-y-3">
            <div>
              <h3 class="text-base font-semibold">部位推荐结果</h3>
              <p class="mt-1 text-xs text-gray-500">推荐结果仅来源于已保存的部位模板记录，综合标准部位、候选名、尺码、几何特征与历史价值固定打分。</p>
            </div>
              <div class="space-y-3">${renderRecommendationPartCards(state.recommendationParseResult)}</div>
            </section>
          `
          : ''
      }
    </div>
  `

  return uiDrawer(
    {
      title: '模板推荐',
      subtitle: '上传一对待匹配纸样，按部位给出模板推荐列表。',
      closeAction: { prefix: 'plate', action: 'close-recommendation-drawer' },
      width: 'xl',
    },
    content,
    {
      cancel: { prefix: 'plate', action: 'close-recommendation-drawer', label: '关闭' },
    },
  )
}

// ============ 渲染函数 ============

function renderSelectOptions(options: { value: string; label: string }[], selected: string) {
  return options.map((opt) => `<option value="${opt.value}" ${selected === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')
}

function renderPlateCreateDrawer() {
  if (!state.createDrawerOpen) return ''

  const formContent = `
    <div class="space-y-6">
      <!-- 基本信息 -->
      <div class="space-y-4">
        <h3 class="font-medium text-gray-900">基本信息</h3>
        <div class="space-y-2">
          <label class="block text-sm font-medium">标题 <span class="text-red-500">*</span></label>
          <input type="text" class="w-full h-9 px-3 border rounded-md text-sm" placeholder="制版-{{款号/项目名}}" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium">优先级</label>
            <select class="w-full h-9 px-3 border rounded-md text-sm">
              <option value="低">低</option>
              <option value="中" selected>中</option>
              <option value="高">高</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium">负责人 <span class="text-red-500">*</span></label>
            <select class="w-full h-9 px-3 border rounded-md text-sm">
              <option value="">选择负责人</option>
              <option value="王版师">王版师</option>
              <option value="李版师">李版师</option>
              <option value="张版师">张版师</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium">参与人</label>
            <input type="text" class="w-full h-9 px-3 border rounded-md text-sm" placeholder="多人用逗号分隔" />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium">截止时间</label>
            <input type="date" class="w-full h-9 px-3 border rounded-md text-sm" />
          </div>
        </div>
      </div>

      <!-- 来源与绑定 -->
      <div class="space-y-4 border-t pt-4">
        <h3 class="font-medium text-gray-900">来源与绑定</h3>
        <div class="space-y-2">
          <label class="block text-sm font-medium">来源类型 <span class="text-red-500">*</span></label>
          <select class="w-full h-9 px-3 border rounded-md text-sm">
            <option value="">选择来源</option>
            <option value="改版任务">改版任务</option>
            <option value="项目模板阶段">项目模板阶段</option>
            <option value="既有商品二次开发">既有商品二次开发</option>
          </select>
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium">商品项目 <span class="text-red-500">*</span></label>
          <select class="w-full h-9 px-3 border rounded-md text-sm">
            <option value="">选择项目</option>
            <option value="PRJ-001">印尼风格碎花连衣裙</option>
            <option value="PRJ-002">基础款白色T恤</option>
          </select>
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium">上游实例 (条件必填)</label>
          <select class="w-full h-9 px-3 border rounded-md text-sm">
            <option value="">改版来源建议必填</option>
            <option value="RT-001">V领印花改版</option>
            <option value="RT-002">袖长调整</option>
          </select>
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium">商品引用 (可选)</label>
          <input type="text" class="w-full h-9 px-3 border rounded-md text-sm" placeholder="款号/SPU (既有商品二次开发时建议必填)" />
        </div>
      </div>

      <!-- 制版输入 -->
      <div class="space-y-4 border-t pt-4">
        <h3 class="font-medium text-gray-900">制版输入（参考资料）</h3>
        <div class="space-y-2">
          <label class="block text-sm font-medium">设计稿/改版包/尺寸意向</label>
          <div class="border-2 border-dashed rounded-lg p-4 text-center">
            <i data-lucide="upload" class="h-8 w-8 mx-auto text-gray-400 mb-2"></i>
            <p class="text-sm text-gray-500">点击或拖拽上传附件</p>
          </div>
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium">参考版型</label>
          <input type="text" class="w-full h-9 px-3 border rounded-md text-sm" placeholder="引用历史纸样/历史商品" />
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium">约束条件</label>
          <textarea class="w-full px-3 py-2 border rounded-md text-sm min-h-[80px]" placeholder="目标成本/面料限制/工艺限制"></textarea>
        </div>
      </div>

      <!-- 关联样衣 -->
      <div class="space-y-4 border-t pt-4">
        <h3 class="font-medium text-gray-900">关联样衣（可选）</h3>
        <div class="space-y-2">
          <p class="text-sm text-gray-500">选择需要测量/试穿的样衣</p>
          <button type="button" class="h-8 px-3 text-sm border rounded-md hover:bg-gray-50">选择样衣</button>
        </div>
        <label class="flex items-center gap-2">
          <input type="checkbox" class="h-4 w-4 rounded border" />
          <span class="text-sm">需要测量/试穿</span>
        </label>
      </div>
    </div>
  `

  return uiDrawer(
    {
      title: '新建制版任务',
      closeAction: { prefix: 'plate', action: 'close-create-drawer' },
      width: 'sm',
    },
    formContent,
    {
      extra: renderSecondaryButton('保存草稿', { prefix: 'plate', action: 'close-create-drawer' }),
      confirm: { prefix: 'plate', action: 'submit-create', label: '创建并开始', variant: 'primary' as const },
    }
  )
}

function renderPlateDownstreamDialog() {
  if (!state.downstreamDialogOpen) return ''

  const formContent = `
    <div class="space-y-2">
      ${[
        { value: 'sample_order', label: '首单样衣打样', recommended: true },
        { value: 'grading', label: '放码任务', recommended: true },
        { value: 'process', label: '工艺单任务', recommended: false },
        { value: 'bom', label: 'BOM任务', recommended: false },
        { value: 'pattern_design', label: '花型任务', recommended: false },
      ].map((task) => `
        <div class="flex items-center gap-3 p-3 border rounded-lg">
          <input type="checkbox" id="${task.value}" class="h-4 w-4 rounded border" ${task.recommended ? 'checked' : ''} />
          <label for="${task.value}" class="flex-1 text-sm">
            ${task.label}
            ${task.recommended ? '<span class="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">建议</span>' : ''}
          </label>
        </div>
      `).join('')}
    </div>
  `

  return uiFormDialog(
    {
      title: '创建下游任务',
      description: '根据验收标准/规格表/放码需求，系统建议创建以下下游任务：',
      closeAction: { prefix: 'plate', action: 'close-downstream-dialog' },
      width: 'md',
      submitAction: { prefix: 'plate', action: 'submit-downstream', label: '确认创建' },
      cancelLabel: '取消',
    },
    formContent
  )
}

function renderTaskRow(task: typeof mockTasks[0]) {
  const statusInfo = getStatusBadge(task.status)
  const isSelected = state.selectedTasks.includes(task.id)
  return `
    <tr class="border-b hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}">
      <td class="px-3 py-3">
        <input type="checkbox" class="h-4 w-4 rounded border" ${isSelected ? 'checked' : ''} data-plate-action="toggle-task" data-task-id="${task.id}" />
      </td>
      <td class="px-3 py-3">
        <button class="text-sm font-medium text-blue-600 hover:underline" data-plate-action="view-task" data-task-id="${task.id}">${task.instance_code}</button>
        <p class="text-xs text-gray-500 mt-0.5">${escapeHtml(task.title)}</p>
      </td>
      <td class="px-3 py-3">
        <span class="inline-flex px-2 py-0.5 text-xs rounded ${statusInfo.className}">${statusInfo.label}</span>
      </td>
      <td class="px-3 py-3">
        <button class="text-sm text-blue-600 hover:underline">${escapeHtml(task.project_ref.name)}</button>
      </td>
      <td class="px-3 py-3 text-sm">${task.source_type}</td>
      <td class="px-3 py-3">
        ${task.product_ref ? `
          <div>
            <p class="text-sm">${escapeHtml(task.product_ref.name)}</p>
            <p class="text-xs text-gray-500">${task.product_ref.spu}</p>
          </div>
        ` : '<span class="text-gray-400 text-sm">-</span>'}
      </td>
      <td class="px-3 py-3 text-sm">${task.pattern_type}</td>
      <td class="px-3 py-3 text-sm">${task.size_range}</td>
      <td class="px-3 py-3 text-sm">${task.owner}</td>
      <td class="px-3 py-3 text-sm text-gray-500">${task.due_at}</td>
      <td class="px-3 py-3">
        ${task.pattern_version === '-' ? '<span class="text-gray-400 text-sm">-</span>' : `<span class="inline-flex px-2 py-0.5 text-xs bg-gray-100 rounded font-mono">${task.pattern_version}</span>`}
      </td>
      <td class="px-3 py-3">
        ${task.downstream_count > 0 ? `<span class="inline-flex px-2 py-0.5 text-xs border rounded">${task.downstream_count}</span>` : '<span class="text-gray-400 text-sm">-</span>'}
      </td>
      <td class="px-3 py-3 text-sm text-gray-500">${task.updated_at}</td>
      <td class="px-3 py-3">
        <div class="flex items-center gap-1">
          <button class="h-8 w-8 flex items-center justify-center hover:bg-gray-100 rounded" data-plate-action="view-task" data-task-id="${task.id}" title="查看">
            <i data-lucide="eye" class="h-4 w-4"></i>
          </button>
          <button class="h-8 rounded-md border px-2 text-xs hover:bg-gray-100" data-plate-action="open-recommendation-drawer" data-task-id="${task.id}" title="模板推荐">
            模板推荐
          </button>
          ${['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED'].includes(task.status) ? `
            <button class="h-8 w-8 flex items-center justify-center hover:bg-gray-100 rounded" data-plate-action="start-task" data-task-id="${task.id}" title="开始">
              <i data-lucide="play" class="h-4 w-4"></i>
            </button>
          ` : ''}
          ${task.status === 'IN_PROGRESS' ? `
            <button class="h-8 w-8 flex items-center justify-center hover:bg-gray-100 rounded" data-plate-action="submit-review" data-task-id="${task.id}" title="提交评审">
              <i data-lucide="send" class="h-4 w-4"></i>
            </button>
          ` : ''}
          ${['APPROVED', 'COMPLETED'].includes(task.status) ? `
            <button class="h-8 w-8 flex items-center justify-center hover:bg-gray-100 rounded" data-plate-action="open-downstream-dialog" data-task-id="${task.id}" title="创建下游">
              <i data-lucide="link" class="h-4 w-4"></i>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `
}

function renderPage(): string {
  const filteredTasks = getFilteredTasks()
  const kpiStats = getKpiStats()

  return `
    <div class="space-y-4">
      <!-- Header -->
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold">制版任务</h1>
          <p class="mt-1 text-sm text-gray-500">将设计/改版方案转化为可生产的纸样/版型/规格成果，输出制版包并驱动下游打样/放码/工艺/BOM等工作</p>
        </div>
        <div class="flex items-center gap-2">
          <button class="h-9 px-4 text-sm border rounded-md hover:bg-gray-50 flex items-center gap-2" data-plate-action="open-recommendation-drawer">
            <i data-lucide="scan-search" class="h-4 w-4"></i>
            匹配部位模板
          </button>
          <button class="h-9 px-4 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2" data-plate-action="open-create-drawer">
            <i data-lucide="plus" class="h-4 w-4"></i>
            新建制版任务
          </button>
        </div>
      </header>

      <!-- Filter Bar -->
      <section class="rounded-lg border bg-white p-4 space-y-4">
        <div class="grid grid-cols-6 gap-4">
          <div class="col-span-2 relative">
            <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"></i>
            <input
              type="text"
              class="w-full h-9 pl-10 pr-3 border rounded-md text-sm"
              placeholder="任务编号/标题/项目/款号/SPU/SKU/样衣编号"
              value="${escapeHtml(state.search)}"
              data-plate-field="search"
            />
          </div>
          <select class="h-9 px-3 border rounded-md text-sm" data-plate-field="status">
            ${renderSelectOptions(STATUS_OPTIONS, state.statusFilter)}
          </select>
          <select class="h-9 px-3 border rounded-md text-sm" data-plate-field="owner">
            <option value="all">全部</option>
            <option value="me">我</option>
            <option value="王版师" ${state.ownerFilter === '王版师' ? 'selected' : ''}>王版师</option>
            <option value="李版师" ${state.ownerFilter === '李版师' ? 'selected' : ''}>李版师</option>
          </select>
          <select class="h-9 px-3 border rounded-md text-sm" data-plate-field="source">
            ${renderSelectOptions(SOURCE_TYPE_OPTIONS, state.sourceFilter)}
          </select>
          <select class="h-9 px-3 border rounded-md text-sm" data-plate-field="site">
            ${renderSelectOptions(SITE_OPTIONS, state.siteFilter)}
          </select>
        </div>
        <div class="flex items-center gap-2">
          <button class="h-8 px-3 text-sm border rounded-md hover:bg-gray-50" data-plate-action="reset-filters">重置</button>
        </div>
      </section>

      <!-- KPI Quick Filters -->
      <section class="flex items-center gap-2">
        ${[
          { value: 'all', label: '全部', count: kpiStats.all },
          { value: 'mine', label: '我的', count: kpiStats.mine },
          { value: 'pending_review', label: '待评审', count: kpiStats.pending_review },
          { value: 'frozen_no_downstream', label: '已冻结未建下游', count: kpiStats.frozen_no_downstream },
          { value: 'blocked', label: '阻塞', count: kpiStats.blocked },
          { value: 'overdue', label: '超期', count: kpiStats.overdue },
        ].map((kpi) => `
          <button
            class="h-8 px-3 text-sm rounded-md flex items-center gap-2 ${state.kpiFilter === kpi.value ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50'}"
            data-plate-action="set-kpi-filter"
            data-kpi="${kpi.value}"
          >
            ${kpi.label}
            <span class="${state.kpiFilter === kpi.value ? 'bg-blue-500' : 'bg-gray-100'} px-1.5 py-0.5 text-xs rounded">${kpi.count}</span>
          </button>
        `).join('')}
      </section>

      <!-- Batch Actions -->
      ${state.selectedTasks.length > 0 ? `
        <section class="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <span class="text-sm">已选择 ${state.selectedTasks.length} 个任务</span>
          <div class="flex gap-2">
            <button class="h-8 px-3 text-sm border rounded-md hover:bg-white" data-plate-action="batch-assign">批量分派</button>
            <button class="h-8 px-3 text-sm border rounded-md hover:bg-white" data-plate-action="batch-due">批量截止</button>
            <button class="h-8 px-3 text-sm border rounded-md hover:bg-white" data-plate-action="batch-block">批量阻塞</button>
            <button class="h-8 px-3 text-sm border rounded-md hover:bg-white flex items-center gap-1" data-plate-action="export">
              <i data-lucide="download" class="h-4 w-4"></i>
              导出
            </button>
          </div>
        </section>
      ` : ''}

      <!-- Table -->
      <section class="rounded-lg border bg-white overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1400px] text-sm">
            <thead>
              <tr class="border-b bg-gray-50 text-left text-gray-600">
                <th class="px-3 py-3 w-12">
                  <input type="checkbox" class="h-4 w-4 rounded border" data-plate-action="toggle-all" ${state.selectedTasks.length === filteredTasks.length && filteredTasks.length > 0 ? 'checked' : ''} />
                </th>
                <th class="px-3 py-3 font-medium">任务</th>
                <th class="px-3 py-3 font-medium">状态</th>
                <th class="px-3 py-3 font-medium">项目</th>
                <th class="px-3 py-3 font-medium">来源</th>
                <th class="px-3 py-3 font-medium">商品</th>
                <th class="px-3 py-3 font-medium">版型类型</th>
                <th class="px-3 py-3 font-medium">目标尺码段</th>
                <th class="px-3 py-3 font-medium">负责人</th>
                <th class="px-3 py-3 font-medium">截止时间</th>
                <th class="px-3 py-3 font-medium">制版版本</th>
                <th class="px-3 py-3 font-medium">下游任务</th>
                <th class="px-3 py-3 font-medium">最近更新</th>
                <th class="px-3 py-3 font-medium w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTasks.length > 0 ? filteredTasks.map(renderTaskRow).join('') : `
                <tr>
                  <td colspan="14" class="px-4 py-12 text-center text-gray-500">
                    <i data-lucide="inbox" class="h-10 w-10 mx-auto text-gray-300 mb-2"></i>
                    <p>暂无数据</p>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
        <footer class="flex items-center justify-between border-t px-4 py-3">
          <p class="text-sm text-gray-500">共 ${filteredTasks.length} 条，当前第 ${state.currentPage} / 1 页</p>
          <div class="flex items-center gap-2">
            <button class="h-8 px-2 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50" disabled>
              <i data-lucide="chevron-left" class="h-4 w-4"></i>
            </button>
            <button class="h-8 px-3 text-sm bg-blue-600 text-white rounded-md">1</button>
            <button class="h-8 px-2 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50" disabled>
              <i data-lucide="chevron-right" class="h-4 w-4"></i>
            </button>
          </div>
        </footer>
      </section>
    </div>

    ${renderPlateCreateDrawer()}
    ${renderPlateDownstreamDialog()}
    ${renderRecommendationDrawer()}
  `
}

// ============ 事件处理 ============

export function handlePlateMakingEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-plate-action]')
  const action = actionNode?.dataset.plateAction

  if (action === 'open-create-drawer') {
    state.createDrawerOpen = true
    return true
  }

  if (action === 'close-create-drawer') {
    state.createDrawerOpen = false
    return true
  }

  if (action === 'submit-create') {
    state.createDrawerOpen = false
    console.log('制版任务已创建')
    return true
  }

  if (action === 'open-downstream-dialog') {
    state.downstreamDialogOpen = true
    state.selectedTaskId = actionNode?.dataset.taskId || null
    return true
  }

  if (action === 'open-recommendation-drawer') {
    resetRecommendationState()
    state.recommendationDrawerOpen = true
    state.recommendationTargetTaskId = actionNode?.dataset.taskId || null
    return true
  }

  if (action === 'close-recommendation-drawer') {
    state.recommendationDrawerOpen = false
    resetRecommendationState()
    return true
  }

  if (action === 'select-recommend-dxf-file') {
    if (actionNode instanceof HTMLInputElement) {
      state.recommendationSelectedDxfFile = actionNode.files?.[0] ?? null
      state.recommendationParseError = null
      state.recommendationMessage = null
      state.recommendationUploadError = getRecommendationUploadError()
      return true
    }
  }

  if (action === 'select-recommend-rul-file') {
    if (actionNode instanceof HTMLInputElement) {
      state.recommendationSelectedRulFile = actionNode.files?.[0] ?? null
      state.recommendationParseError = null
      state.recommendationMessage = null
      state.recommendationUploadError = getRecommendationUploadError()
      return true
    }
  }

  if (action === 'clear-recommendation-files') {
    state.recommendationSelectedDxfFile = null
    state.recommendationSelectedRulFile = null
    state.recommendationUploadError = null
    state.recommendationParseError = null
    state.recommendationParseResult = null
    state.recommendationMessage = null
    return true
  }

  if (action === 'parse-recommendation') {
    let resolvedFiles

    try {
      resolvedFiles = resolveTemplateFilePair(getSelectedRecommendationFiles())
    } catch (error) {
      state.recommendationParseError = error instanceof Error ? error.message : '文件校验失败。'
      return true
    }

    if (!resolvedFiles) {
      state.recommendationParseError = '请先选择一对 .dxf + .rul 文件。'
      return true
    }

    const targetTask = getRecommendationTargetTask()
    state.recommendationParsing = true
    state.recommendationParseError = null
    state.recommendationParseResult = null
    state.recommendationMessage = null
    recommendationParseRequestId += 1
    const requestId = recommendationParseRequestId

    void parsePartTemplateFiles({
      templateName: targetTask?.title ?? '待匹配纸样',
      dxfFile: resolvedFiles.dxfFile,
      rulFile: resolvedFiles.rulFile,
    })
      .then((result) => {
        if (requestId !== recommendationParseRequestId) return
        state.recommendationParseResult = result
      })
      .catch((error) => {
        if (requestId !== recommendationParseRequestId) return
        state.recommendationParseResult = null
        state.recommendationParseError = error instanceof Error ? error.message : '待匹配纸样解析失败。'
      })
      .finally(() => {
        if (requestId !== recommendationParseRequestId) return
        state.recommendationParsing = false
        requestRender()
      })

    return true
  }

  if (action === 'use-template') {
    const templateLabel = actionNode?.dataset.templateLabel
    if (templateLabel) {
      state.recommendationMessage = `已选用模板：${templateLabel}。当前为演示态，后续可继续补充回填链路。`
      return true
    }
  }

  if (action === 'close-downstream-dialog') {
    state.downstreamDialogOpen = false
    return true
  }

  if (action === 'submit-downstream') {
    state.downstreamDialogOpen = false
    console.log('下游任务已创建')
    return true
  }

  if (action === 'set-kpi-filter') {
    state.kpiFilter = actionNode?.dataset.kpi || 'all'
    return true
  }

  if (action === 'reset-filters') {
    state.search = ''
    state.statusFilter = 'all'
    state.ownerFilter = 'all'
    state.sourceFilter = 'all'
    state.siteFilter = 'all'
    state.kpiFilter = 'all'
    return true
  }

  if (action === 'toggle-task') {
    const taskId = actionNode?.dataset.taskId
    if (taskId) {
      if (state.selectedTasks.includes(taskId)) {
        state.selectedTasks = state.selectedTasks.filter((id) => id !== taskId)
      } else {
        state.selectedTasks = [...state.selectedTasks, taskId]
      }
      return true
    }
  }

  if (action === 'toggle-all') {
    const filteredTasks = getFilteredTasks()
    if (state.selectedTasks.length === filteredTasks.length) {
      state.selectedTasks = []
    } else {
      state.selectedTasks = filteredTasks.map((t) => t.id)
    }
    return true
  }

  if (action === 'view-task') {
    const taskId = actionNode?.dataset.taskId
    console.log(`查看任务: ${taskId}`)
    return true
  }

  if (action === 'start-task') {
    const taskId = actionNode?.dataset.taskId
    console.log(`开始任务: ${taskId}`)
    return true
  }

  if (action === 'submit-review') {
    const taskId = actionNode?.dataset.taskId
    console.log(`提交评审: ${taskId}`)
    return true
  }

  return false
}

export function handlePlateMakingInput(target: Element): boolean {
  const field = (target as HTMLElement).dataset.plateField
  if (!field) return false

  if (field === 'search') {
    state.search = (target as HTMLInputElement).value
    return true
  }

  if (field === 'status') {
    state.statusFilter = (target as HTMLSelectElement).value
    return true
  }

  if (field === 'owner') {
    state.ownerFilter = (target as HTMLSelectElement).value
    return true
  }

  if (field === 'source') {
    state.sourceFilter = (target as HTMLSelectElement).value
    return true
  }

  if (field === 'site') {
    state.siteFilter = (target as HTMLSelectElement).value
    return true
  }

  return false
}

export function isPlateMakingDialogOpen(): boolean {
  return state.createDrawerOpen || state.downstreamDialogOpen || state.recommendationDrawerOpen
}

export function renderPlateMakingPage(): string {
  return renderPage()
}
