import { appStore } from '../state/store.ts'
import { renderDetailDrawer as uiDetailDrawer, renderDrawer as uiDrawer } from '../components/ui/index.ts'
import {
  listPartTemplateRecords,
  recommendPartTemplateRecords,
} from '../data/pcs-part-template-library.ts'
import { getProjectById, listProjects } from '../data/pcs-project-repository.ts'
import {
  createPlateMakingTaskWithProjectRelation,
  savePlateMakingTaskDraft,
  type PlateMakingTaskCreateInput,
} from '../data/pcs-task-project-relation-writeback.ts'
import {
  generateTechPackVersionFromPlateTask,
  getCurrentDraftTechPackVersionByProjectId,
  getTechPackGenerationBlockedReason,
} from '../data/pcs-tech-pack-task-generation.ts'
import {
  getPlateMakingTaskById,
  listPlateMakingTasks,
} from '../data/pcs-plate-making-repository.ts'
import { PLATE_TASK_SOURCE_TYPE_LIST } from '../data/pcs-task-source-normalizer.ts'
import type { PlateMakingTaskRecord } from '../data/pcs-plate-making-types.ts'
import { escapeHtml } from '../utils.ts'
import {
  parsePartTemplateFiles,
  resolveTemplateFilePair,
  type ParsedPartInstance,
  type ParsedPartTemplateResult,
} from '../utils/pcs-part-template-parser.ts'
import { getTemplateMachineSuitabilityLabel } from '../utils/pcs-part-template-shape-description.ts'

interface PlateMakingState {
  search: string
  statusFilter: string
  sourceFilter: string
  selectedTaskId: string | null
  detailOpen: boolean
  createDrawerOpen: boolean
  downstreamDialogOpen: boolean
  recommendationDrawerOpen: boolean
  notice: string | null
  createForm: {
    projectId: string
    title: string
    sourceType: string
    ownerName: string
    priorityLevel: '高' | '中' | '低'
    dueAt: string
    productStyleCode: string
    spuCode: string
    patternType: string
    sizeRange: string
    patternVersion: string
    upstreamObjectCode: string
    upstreamObjectId: string
  }
  recommendationTargetTaskId: string | null
  recommendationSelectedDxfFile: File | null
  recommendationSelectedRulFile: File | null
  recommendationUploadError: string | null
  recommendationParseError: string | null
  recommendationParsing: boolean
  recommendationParseResult: ParsedPartTemplateResult | null
  recommendationMessage: string | null
}

function createDefaultForm() {
  return {
    projectId: '',
    title: '',
    sourceType: '项目模板阶段',
    ownerName: '',
    priorityLevel: '中' as const,
    dueAt: '',
    productStyleCode: '',
    spuCode: '',
    patternType: '',
    sizeRange: '',
    patternVersion: '',
    upstreamObjectCode: '',
    upstreamObjectId: '',
  }
}

let state: PlateMakingState = {
  search: '',
  statusFilter: 'all',
  sourceFilter: 'all',
  selectedTaskId: null,
  detailOpen: false,
  createDrawerOpen: false,
  downstreamDialogOpen: false,
  recommendationDrawerOpen: false,
  notice: null,
  createForm: createDefaultForm(),
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

function requestRender() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(APP_RENDER_EVENT))
}

function getTasks(): PlateMakingTaskRecord[] {
  return listPlateMakingTasks().filter((task) => {
    if (state.search) {
      const keyword = state.search.toLowerCase()
      if (
        ![
          task.plateTaskCode,
          task.title,
          task.projectCode,
          task.projectName,
          task.productStyleCode,
          task.spuCode,
        ].some((text) => text.toLowerCase().includes(keyword))
      ) {
        return false
      }
    }
    if (state.statusFilter !== 'all' && task.status !== state.statusFilter) return false
    if (state.sourceFilter !== 'all' && task.sourceType !== state.sourceFilter) return false
    return true
  })
}

function getSelectedTask(): PlateMakingTaskRecord | null {
  if (!state.selectedTaskId) return null
  return getPlateMakingTaskById(state.selectedTaskId)
}

function getTechPackActionState(task: PlateMakingTaskRecord) {
  const blockedReason = getTechPackGenerationBlockedReason(task.status)
  const project = getProjectById(task.projectId)
  if (!project?.linkedStyleId) {
    return {
      actionLabel: '生成技术包版本',
      blockedReason: blockedReason || '当前任务未绑定正式项目和款式档案，不能生成技术包版本',
      currentDraftCode: '',
      currentDraftLabel: '',
    }
  }

  try {
    const currentDraft = getCurrentDraftTechPackVersionByProjectId(task.projectId)
    return {
      actionLabel: currentDraft ? '写入当前草稿技术包' : '生成技术包版本',
      blockedReason,
      currentDraftCode: currentDraft?.technicalVersionCode || '',
      currentDraftLabel: currentDraft?.versionLabel || '',
    }
  } catch (error) {
    return {
      actionLabel: '写入当前草稿技术包',
      blockedReason: error instanceof Error ? error.message : '当前技术包草稿状态异常，不能继续生成',
      currentDraftCode: '',
      currentDraftLabel: '',
    }
  }
}

function renderTechPackSection(task: PlateMakingTaskRecord): string {
  const actionState = getTechPackActionState(task)
  const linkedVersionText = task.linkedTechPackVersionCode
    ? `${task.linkedTechPackVersionCode} / ${task.linkedTechPackVersionLabel || '未命名版本'}`
    : '未关联技术包版本'
  const currentDraftText = actionState.currentDraftCode
    ? `${actionState.currentDraftCode} / ${actionState.currentDraftLabel || '草稿'}`
    : '当前无草稿技术包版本'

  return `
    <section class="rounded-lg border bg-muted/20 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-sm font-medium">技术包版本</div>
          <div class="mt-1 text-xs text-muted-foreground">已关联：${escapeHtml(linkedVersionText)}</div>
          <div class="mt-1 text-xs text-muted-foreground">当前草稿：${escapeHtml(currentDraftText)}</div>
        </div>
        ${
          actionState.blockedReason
            ? `<div class="text-xs text-amber-700">${escapeHtml(actionState.blockedReason)}</div>`
            : `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-plate-action="generate-tech-pack" data-task-id="${escapeHtml(task.plateTaskId)}">${escapeHtml(actionState.actionLabel)}</button>`
        }
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <div class="rounded-lg border bg-white p-3">
          <div class="text-xs text-muted-foreground">已关联技术包版本</div>
          <div class="mt-1 font-medium">${escapeHtml(task.linkedTechPackVersionCode || '未关联')}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.linkedTechPackVersionStatus || '暂无状态')}</div>
        </div>
        <div class="rounded-lg border bg-white p-3">
          <div class="text-xs text-muted-foreground">最近写入时间</div>
          <div class="mt-1 font-medium">${escapeHtml(task.linkedTechPackUpdatedAt || '暂无写入记录')}</div>
        </div>
      </div>
    </section>
  `
}

function buildCreateInput(): PlateMakingTaskCreateInput {
  const project = listProjects().find((item) => item.projectId === state.createForm.projectId)
  return {
    projectId: state.createForm.projectId,
    title: state.createForm.title || `制版-${project?.projectName || '待定项目'}`,
    sourceType: state.createForm.sourceType as PlateMakingTaskCreateInput['sourceType'],
    upstreamModule: state.createForm.sourceType === '改版任务' ? '改版任务' : '',
    upstreamObjectType: state.createForm.sourceType === '改版任务' ? '改版任务' : '',
    upstreamObjectId: state.createForm.upstreamObjectId,
    upstreamObjectCode: state.createForm.upstreamObjectCode,
    ownerName: state.createForm.ownerName,
    priorityLevel: state.createForm.priorityLevel,
    dueAt: state.createForm.dueAt,
    productStyleCode: state.createForm.productStyleCode,
    spuCode: state.createForm.spuCode,
    patternType: state.createForm.patternType,
    sizeRange: state.createForm.sizeRange,
    patternVersion: state.createForm.patternVersion,
    operatorName: '当前用户',
  }
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `<div class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">${escapeHtml(state.notice)}</div>`
}

function renderCreateDrawer(): string {
  if (!state.createDrawerOpen) return ''
  const projects = listProjects()
  return uiDrawer(
    {
      title: '新建制版任务',
      subtitle: '正式创建后会写入制版任务记录、商品项目关系，并回写制版任务节点。',
      closeAction: { prefix: 'plate', action: 'close-create-drawer' },
      width: 'lg',
    },
    `
      <div class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-medium">项目 <span class="text-red-500">*</span></label>
            <select class="h-9 w-full rounded-md border px-3 text-sm" data-plate-field="create-projectId">
              <option value="">请选择项目</option>
              ${projects.map((item) => `<option value="${item.projectId}" ${state.createForm.projectId === item.projectId ? 'selected' : ''}>${escapeHtml(`${item.projectCode} · ${item.projectName}`)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">任务标题 <span class="text-red-500">*</span></label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.title)}" data-plate-field="create-title" />
          </div>
        </div>
        <div class="grid gap-4 md:grid-cols-3">
          <div>
            <label class="mb-1 block text-sm font-medium">来源类型</label>
            <select class="h-9 w-full rounded-md border px-3 text-sm" data-plate-field="create-sourceType">
              ${PLATE_TASK_SOURCE_TYPE_LIST.map((item) => `<option value="${item}" ${state.createForm.sourceType === item ? 'selected' : ''}>${item}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">负责人</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.ownerName)}" data-plate-field="create-ownerName" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">优先级</label>
            <select class="h-9 w-full rounded-md border px-3 text-sm" data-plate-field="create-priorityLevel">
              ${['高', '中', '低'].map((item) => `<option value="${item}" ${state.createForm.priorityLevel === item ? 'selected' : ''}>${item}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid gap-4 md:grid-cols-3">
          <div>
            <label class="mb-1 block text-sm font-medium">截止时间</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" type="datetime-local" value="${escapeHtml(state.createForm.dueAt)}" data-plate-field="create-dueAt" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">版型类型</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.patternType)}" data-plate-field="create-patternType" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">目标尺码段</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.sizeRange)}" data-plate-field="create-sizeRange" />
          </div>
        </div>
        <div class="grid gap-4 md:grid-cols-3">
          <div>
            <label class="mb-1 block text-sm font-medium">款式编码</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.productStyleCode)}" data-plate-field="create-productStyleCode" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">商品编码</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.spuCode)}" data-plate-field="create-spuCode" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">制版版本</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.patternVersion)}" data-plate-field="create-patternVersion" />
          </div>
        </div>
        ${state.createForm.sourceType === '改版任务' ? `
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium">改版任务编号 <span class="text-red-500">*</span></label>
              <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.upstreamObjectCode)}" data-plate-field="create-upstreamObjectCode" placeholder="请输入改版任务编号" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">改版任务主键</label>
              <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.upstreamObjectId)}" data-plate-field="create-upstreamObjectId" placeholder="可选，用于精确追溯" />
            </div>
          </div>
        ` : ''}
      </div>
    `,
    {
      cancel: { prefix: 'plate', action: 'close-create-drawer', label: '取消' },
      extraActions: [{ prefix: 'plate', action: 'save-draft', label: '保存草稿', variant: 'secondary' }],
      confirm: { prefix: 'plate', action: 'submit-create', label: '创建并开始', variant: 'primary' },
    },
  )
}

function renderDetailDrawer(): string {
  const task = getSelectedTask()
  if (!state.detailOpen || !task) return ''
  return uiDetailDrawer(
    {
      title: '制版任务详情',
      subtitle: task.plateTaskCode,
      closeAction: { prefix: 'plate', action: 'close-create-drawer' },
      width: 'lg',
    },
    `
      <div class="space-y-4 text-sm">
        <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">任务标题</div><div class="mt-1 font-medium">${escapeHtml(task.title)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">当前状态</div><div class="mt-1 font-medium">${escapeHtml(task.status)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">项目</div><div class="mt-1 font-medium">${escapeHtml(`${task.projectCode} · ${task.projectName}`)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">来源类型</div><div class="mt-1 font-medium">${escapeHtml(task.sourceType)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">来源对象编号</div><div class="mt-1 font-medium">${escapeHtml(task.upstreamObjectCode || '—')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">负责人</div><div class="mt-1 font-medium">${escapeHtml(task.ownerName || '—')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">版型类型</div><div class="mt-1 font-medium">${escapeHtml(task.patternType || '—')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">目标尺码段</div><div class="mt-1 font-medium">${escapeHtml(task.sizeRange || '—')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">制版版本</div><div class="mt-1 font-medium">${escapeHtml(task.patternVersion || '—')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">最近更新时间</div><div class="mt-1 font-medium">${escapeHtml(task.updatedAt)}</div></div>
      </div>
      ${renderTechPackSection(task)}
      </div>
    `,
    `<div class="flex flex-wrap gap-2">
      ${
        task.linkedTechPackVersionId
          ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-plate-action="view-tech-pack" data-task-id="${escapeHtml(task.plateTaskId)}">查看技术包版本</button>`
          : ''
      }
      ${
        getTechPackActionState(task).blockedReason
          ? ''
          : `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-plate-action="generate-tech-pack" data-task-id="${escapeHtml(task.plateTaskId)}">${escapeHtml(getTechPackActionState(task).actionLabel)}</button>`
      }
      <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-plate-action="open-downstream-dialog">查看下游接入说明</button>
    </div>`,
  )
}

function getSelectedRecommendationFiles() {
  return [state.recommendationSelectedDxfFile, state.recommendationSelectedRulFile].filter(Boolean) as File[]
}

function getRecommendationUploadError(): string | null {
  const files = getSelectedRecommendationFiles()
  if (files.length === 0) return null
  try {
    resolveTemplateFilePair(files)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : '请上传一对 .dxf + .rul 文件。'
  }
}

function resetRecommendationState() {
  state.recommendationSelectedDxfFile = null
  state.recommendationSelectedRulFile = null
  state.recommendationUploadError = null
  state.recommendationParseError = null
  state.recommendationParseResult = null
  state.recommendationMessage = null
  state.recommendationParsing = false
}

function renderRecommendationCard(part: ParsedPartInstance): string {
  const recommendations = recommendPartTemplateRecords(part, 3)
  return `
    <div class="rounded-lg border p-4">
      <div class="grid gap-4 md:grid-cols-[180px,1fr]">
        <div class="rounded-lg border bg-gray-50 p-3">
          ${part.previewSvg ? part.previewSvg : '<div class="flex h-32 items-center justify-center text-xs text-gray-400">暂无预览</div>'}
        </div>
        <div class="space-y-3 text-sm">
          <div>
            <div class="font-medium">${escapeHtml(part.sourcePartName || part.systemPieceName || '未识别部位')}</div>
            <div class="mt-1 text-xs text-gray-500">候选名称：${escapeHtml(part.candidatePartNames.join(' / ') || '—')}</div>
          </div>
          <div class="grid gap-2 md:grid-cols-2">
            <div class="rounded-md bg-muted/20 px-3 py-2"><span class="text-gray-500">尺码：</span>${escapeHtml(part.sizeCode || '—')}</div>
            <div class="rounded-md bg-muted/20 px-3 py-2"><span class="text-gray-500">模板机适配：</span>${escapeHtml(getTemplateMachineSuitabilityLabel(part.machineReadyStatus))}</div>
          </div>
          <div>
            <div class="mb-2 font-medium">推荐模板</div>
            ${recommendations.length === 0 ? `
              <div class="rounded-md border border-dashed px-3 py-3 text-xs text-gray-500">当前模板库暂无可推荐的部位模板。</div>
            ` : recommendations.map((item) => `
              <div class="mb-2 rounded-md border px-3 py-3 last:mb-0">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="font-medium">${escapeHtml(item.record.templateName)} / ${escapeHtml(item.record.standardPartName)}</div>
                    <div class="mt-1 text-xs text-gray-500">${escapeHtml(item.record.sourcePartName)}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-sm font-semibold text-blue-700">${item.matchScore} 分</div>
                    <button class="mt-1 inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-gray-50" data-plate-action="use-template" data-template-label="${escapeHtml(`${item.record.templateName} / ${item.record.standardPartName}`)}">使用模板</button>
                  </div>
                </div>
                <div class="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                  ${item.reasons.map((reason) => `<span class="inline-flex rounded-full bg-gray-100 px-2 py-1">${escapeHtml(reason)}</span>`).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `
}

function renderRecommendationDrawer(): string {
  if (!state.recommendationDrawerOpen) return ''
  const targetTask = state.recommendationTargetTaskId ? getPlateMakingTaskById(state.recommendationTargetTaskId) : null
  return uiDrawer(
    {
      title: '匹配部位模板',
      subtitle: targetTask ? `${targetTask.plateTaskCode} · ${targetTask.title}` : '开发态上传一对纸样文件，按部位推荐模板库记录。',
      closeAction: { prefix: 'plate', action: 'close-recommendation-drawer' },
      width: 'xl',
    },
    `
      <div class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <label class="rounded-lg border border-dashed p-4 text-sm">
            <div class="font-medium">选择 DXF 文件</div>
            <div class="mt-1 text-xs text-gray-500">${escapeHtml(state.recommendationSelectedDxfFile?.name || '未选择 DXF 文件')}</div>
            <input class="mt-3 block w-full text-xs" type="file" accept=".dxf" data-plate-action="select-recommend-dxf-file" />
          </label>
          <label class="rounded-lg border border-dashed p-4 text-sm">
            <div class="font-medium">选择 RUL 文件</div>
            <div class="mt-1 text-xs text-gray-500">${escapeHtml(state.recommendationSelectedRulFile?.name || '未选择 RUL 文件')}</div>
            <input class="mt-3 block w-full text-xs" type="file" accept=".rul" data-plate-action="select-recommend-rul-file" />
          </label>
        </div>
        ${state.recommendationUploadError ? `<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">${escapeHtml(state.recommendationUploadError)}</div>` : ''}
        ${state.recommendationParseError ? `<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">${escapeHtml(state.recommendationParseError)}</div>` : ''}
        ${state.recommendationMessage ? `<div class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">${escapeHtml(state.recommendationMessage)}</div>` : ''}
        <div class="flex items-center gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-gray-50" data-plate-action="clear-recommendation-files">清空上传文件</button>
          <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700 ${state.recommendationParsing ? 'opacity-70' : ''}" data-plate-action="parse-recommendation">${state.recommendationParsing ? '解析中...' : '解析并推荐模板'}</button>
          <div class="text-xs text-gray-500">${listPartTemplateRecords().length} 条部位模板记录可参与推荐</div>
        </div>
        ${state.recommendationParseResult ? `
          <div class="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
            <div>模板名称：<span class="font-medium">${escapeHtml(state.recommendationParseResult.templateName)}</span></div>
            <div class="mt-1">解析部位：<span class="font-medium">${state.recommendationParseResult.parts.length}</span> 个</div>
          </div>
          <div class="space-y-4">
            ${state.recommendationParseResult.parts.map(renderRecommendationCard).join('')}
          </div>
        ` : ''}
      </div>
    `,
  )
}

function renderDownstreamDialog(): string {
  if (!state.downstreamDialogOpen) return ''
  return uiDrawer(
    {
      title: '下游任务接入说明',
      subtitle: '放码任务、工艺单任务、物料清单任务本轮未接入正式项目关系。',
      closeAction: { prefix: 'plate', action: 'close-downstream-dialog' },
      width: 'md',
    },
    `
      <div class="space-y-3 text-sm">
        <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">当前页面仍保留下游入口，但本轮仅正式接入制版任务自身的创建与项目关系写入。</div>
        <ul class="list-disc space-y-1 pl-5 text-gray-600">
          <li>放码任务：本轮未接入正式项目关系</li>
          <li>工艺单任务：本轮未接入正式项目关系</li>
          <li>物料清单任务：本轮未接入正式项目关系</li>
        </ul>
      </div>
    `,
  )
}

export function handlePlateMakingEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-plate-action]')
  const action = actionNode?.dataset.plateAction
  if (!action) return false

  if (action === 'open-create-drawer') {
    state.createDrawerOpen = true
    state.notice = null
    return true
  }
  if (action === 'close-create-drawer') {
    state.createDrawerOpen = false
    state.detailOpen = false
    state.createForm = createDefaultForm()
    return true
  }
  if (action === 'save-draft') {
    const draft = savePlateMakingTaskDraft(buildCreateInput())
    state.notice = `已保存制版任务草稿：${draft.plateTaskCode}。草稿不会写入项目关系。`
    state.createDrawerOpen = false
    state.createForm = createDefaultForm()
    return true
  }
  if (action === 'submit-create') {
    const result = createPlateMakingTaskWithProjectRelation(buildCreateInput())
    state.notice = result.message
    if (result.ok) {
      state.createDrawerOpen = false
      state.createForm = createDefaultForm()
      state.selectedTaskId = result.task.plateTaskId
    }
    return true
  }
  if (action === 'view-task') {
    const taskId = actionNode?.dataset.taskId
    if (taskId) {
      state.selectedTaskId = taskId
      state.detailOpen = true
    }
    return true
  }
  if (action === 'generate-tech-pack') {
    const taskId = actionNode?.dataset.taskId
    const task = taskId ? getPlateMakingTaskById(taskId) : null
    if (!task) return true
    const actionState = getTechPackActionState(task)
    if (actionState.blockedReason) {
      state.notice = actionState.blockedReason
      return true
    }
    try {
      const result = generateTechPackVersionFromPlateTask(task.plateTaskId, '商品中心')
      const project = getProjectById(task.projectId)
      state.notice =
        result.action === 'CREATED'
          ? `已生成技术包版本：${result.record.technicalVersionCode}`
          : `已写入当前草稿技术包：${result.record.technicalVersionCode}`
      if (project?.linkedStyleId) {
        appStore.navigate(
          `/pcs/products/styles/${encodeURIComponent(project.linkedStyleId)}/technical-data/${encodeURIComponent(result.record.technicalVersionId)}`,
        )
      }
    } catch (error) {
      state.notice = error instanceof Error ? error.message : '生成技术包版本失败'
    }
    return true
  }
  if (action === 'view-tech-pack') {
    const taskId = actionNode?.dataset.taskId
    const task = taskId ? getPlateMakingTaskById(taskId) : null
    const project = task ? getProjectById(task.projectId) : null
    if (task?.linkedTechPackVersionId && project?.linkedStyleId) {
      appStore.navigate(
        `/pcs/products/styles/${encodeURIComponent(project.linkedStyleId)}/technical-data/${encodeURIComponent(task.linkedTechPackVersionId)}`,
      )
    }
    return true
  }
  if (action === 'open-downstream-dialog') {
    state.downstreamDialogOpen = true
    return true
  }
  if (action === 'close-downstream-dialog') {
    state.downstreamDialogOpen = false
    return true
  }
  if (action === 'submit-downstream') {
    state.notice = '制版任务下游入口已保留，但放码、工艺单、物料清单本轮未接入正式项目关系。'
    state.downstreamDialogOpen = false
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
    state.recommendationTargetTaskId = null
    resetRecommendationState()
    return true
  }
  if (action === 'select-recommend-dxf-file' && actionNode instanceof HTMLInputElement) {
    state.recommendationSelectedDxfFile = actionNode.files?.[0] ?? null
    state.recommendationUploadError = getRecommendationUploadError()
    state.recommendationParseError = null
    state.recommendationParseResult = null
    return true
  }
  if (action === 'select-recommend-rul-file' && actionNode instanceof HTMLInputElement) {
    state.recommendationSelectedRulFile = actionNode.files?.[0] ?? null
    state.recommendationUploadError = getRecommendationUploadError()
    state.recommendationParseError = null
    state.recommendationParseResult = null
    return true
  }
  if (action === 'clear-recommendation-files') {
    resetRecommendationState()
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
    const targetTask = state.recommendationTargetTaskId ? getPlateMakingTaskById(state.recommendationTargetTaskId) : null
    state.recommendationParsing = true
    state.recommendationParseError = null
    state.recommendationParseResult = null
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
    state.recommendationMessage = templateLabel ? `已选用模板：${templateLabel}。当前为原型态演示，后续可继续补充自动回填链路。` : null
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
  if (field === 'source') {
    state.sourceFilter = (target as HTMLSelectElement).value
    return true
  }
  if (field === 'create-projectId') {
    state.createForm.projectId = (target as HTMLSelectElement).value
    return true
  }
  if (field === 'create-title') {
    state.createForm.title = (target as HTMLInputElement).value
    return true
  }
  if (field === 'create-sourceType') {
    state.createForm.sourceType = (target as HTMLSelectElement).value
    return true
  }
  if (field === 'create-ownerName') {
    state.createForm.ownerName = (target as HTMLInputElement).value
    return true
  }
  if (field === 'create-priorityLevel') {
    state.createForm.priorityLevel = (target as HTMLSelectElement).value as '高' | '中' | '低'
    return true
  }
  if (field === 'create-dueAt') {
    state.createForm.dueAt = (target as HTMLInputElement).value
    return true
  }
  if (field === 'create-productStyleCode') {
    state.createForm.productStyleCode = (target as HTMLInputElement).value
    return true
  }
  if (field === 'create-spuCode') {
    state.createForm.spuCode = (target as HTMLInputElement).value
    return true
  }
  if (field === 'create-patternType') {
    state.createForm.patternType = (target as HTMLInputElement).value
    return true
  }
  if (field === 'create-sizeRange') {
    state.createForm.sizeRange = (target as HTMLInputElement).value
    return true
  }
  if (field === 'create-patternVersion') {
    state.createForm.patternVersion = (target as HTMLInputElement).value
    return true
  }
  if (field === 'create-upstreamObjectCode') {
    state.createForm.upstreamObjectCode = (target as HTMLInputElement).value
    return true
  }
  if (field === 'create-upstreamObjectId') {
    state.createForm.upstreamObjectId = (target as HTMLInputElement).value
    return true
  }
  return false
}

export function isPlateMakingDialogOpen(): boolean {
  return state.detailOpen || state.createDrawerOpen || state.downstreamDialogOpen || state.recommendationDrawerOpen
}

export function renderPlateMakingPage(): string {
  const tasks = getTasks()
  return `
    <div class="space-y-4">
      <header class="flex items-center justify-between">
        <div>
          <p class="text-xs text-gray-500">工程开发与打样管理 / 制版任务</p>
          <h1 class="text-xl font-semibold">制版任务</h1>
          <p class="mt-1 text-sm text-gray-500">正式创建后会同步写入制版任务记录、商品项目关系，并可在确认产出后生成技术包版本。</p>
        </div>
        <div class="flex items-center gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-gray-50" data-plate-action="open-recommendation-drawer">匹配部位模板</button>
          <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-plate-action="open-create-drawer">新建制版任务</button>
        </div>
      </header>

      ${renderNotice()}

      <section class="rounded-lg border bg-white p-4">
        <div class="grid gap-4 md:grid-cols-3">
          <input class="h-9 rounded-md border px-3 text-sm" placeholder="任务编号 / 项目 / 款式编码" value="${escapeHtml(state.search)}" data-plate-field="search" />
          <select class="h-9 rounded-md border px-3 text-sm" data-plate-field="status">
            ${['all', '草稿', '未开始', '进行中', '待评审', '已确认', '已完成', '异常待处理', '已取消'].map((item) => `<option value="${item}" ${state.statusFilter === item ? 'selected' : ''}>${item === 'all' ? '全部状态' : item}</option>`).join('')}
          </select>
          <select class="h-9 rounded-md border px-3 text-sm" data-plate-field="source">
            <option value="all" ${state.sourceFilter === 'all' ? 'selected' : ''}>全部来源</option>
            ${PLATE_TASK_SOURCE_TYPE_LIST.map((item) => `<option value="${item}" ${state.sourceFilter === item ? 'selected' : ''}>${item}</option>`).join('')}
          </select>
        </div>
      </section>

      <section class="rounded-lg border bg-white overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b bg-gray-50 text-left text-gray-600">
              <th class="px-4 py-3 font-medium">任务</th>
              <th class="px-4 py-3 font-medium">项目</th>
              <th class="px-4 py-3 font-medium">来源类型</th>
              <th class="px-4 py-3 font-medium">版型类型</th>
              <th class="px-4 py-3 font-medium">目标尺码段</th>
              <th class="px-4 py-3 font-medium">状态</th>
              <th class="px-4 py-3 font-medium">负责人</th>
              <th class="px-4 py-3 font-medium">技术包版本</th>
              <th class="px-4 py-3 font-medium">最近更新</th>
              <th class="px-4 py-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.length === 0 ? `
              <tr><td colspan="10" class="px-4 py-10 text-center text-sm text-gray-500">暂无制版任务</td></tr>
            ` : tasks.map((task) => `
              <tr class="border-b last:border-b-0 hover:bg-gray-50">
                <td class="px-4 py-3">
                  <div class="font-medium">${escapeHtml(task.plateTaskCode)}</div>
                  <div class="text-xs text-gray-500">${escapeHtml(task.title)}</div>
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium">${escapeHtml(task.projectCode)}</div>
                  <div class="text-xs text-gray-500">${escapeHtml(task.projectName)}</div>
                </td>
                <td class="px-4 py-3">${escapeHtml(task.sourceType)}</td>
                <td class="px-4 py-3">${escapeHtml(task.patternType || '—')}</td>
                <td class="px-4 py-3">${escapeHtml(task.sizeRange || '—')}</td>
                <td class="px-4 py-3">${escapeHtml(task.status)}</td>
                <td class="px-4 py-3">${escapeHtml(task.ownerName || '—')}</td>
                <td class="px-4 py-3">
                  <div class="font-medium">${escapeHtml(task.linkedTechPackVersionCode || '未关联')}</div>
                  <div class="text-xs text-gray-500">${escapeHtml(getTechPackActionState(task).currentDraftCode || '当前无草稿技术包版本')}</div>
                </td>
                <td class="px-4 py-3 text-gray-500">${escapeHtml(task.updatedAt)}</td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    ${
                      task.linkedTechPackVersionId
                        ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-plate-action="view-tech-pack" data-task-id="${task.plateTaskId}">查看技术包版本</button>`
                        : ''
                    }
                    ${
                      getTechPackActionState(task).blockedReason
                        ? ''
                        : `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-plate-action="generate-tech-pack" data-task-id="${task.plateTaskId}">${escapeHtml(getTechPackActionState(task).actionLabel)}</button>`
                    }
                    <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-plate-action="view-task" data-task-id="${task.plateTaskId}">查看</button>
                    <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-plate-action="open-recommendation-drawer" data-task-id="${task.plateTaskId}">模板推荐</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>

      ${renderCreateDrawer()}
      ${renderDetailDrawer()}
      ${renderRecommendationDrawer()}
      ${renderDownstreamDialog()}
    </div>
  `
}
