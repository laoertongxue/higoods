import { appStore } from '../state/store.ts'
import { renderDetailDrawer as uiDetailDrawer, renderDrawer as uiDrawer } from '../components/ui/index.ts'
import { listPatternAssetsForSelect } from '../data/pcs-pattern-library.ts'
import { getProjectById, listProjects } from '../data/pcs-project-repository.ts'
import {
  createPatternTaskWithProjectRelation,
  savePatternTaskDraft,
  type PatternTaskCreateInput,
} from '../data/pcs-task-project-relation-writeback.ts'
import {
  generateTechPackVersionFromPatternTask,
  getCurrentDraftTechPackVersionByProjectId,
  getTechPackGenerationBlockedReason,
} from '../data/pcs-tech-pack-task-generation.ts'
import {
  getPatternTaskById,
  listPatternTasks,
} from '../data/pcs-pattern-task-repository.ts'
import { PATTERN_TASK_SOURCE_TYPE_LIST } from '../data/pcs-task-source-normalizer.ts'
import type { PatternTaskRecord } from '../data/pcs-pattern-task-types.ts'
import { escapeHtml } from '../utils.ts'

interface PatternTaskState {
  search: string
  statusFilter: string
  sourceFilter: string
  artworkTypeFilter: string
  selectedTaskId: string | null
  detailOpen: boolean
  createDrawerOpen: boolean
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
    artworkType: string
    patternMode: string
    artworkName: string
    artworkVersion: string
    upstreamObjectCode: string
    upstreamObjectId: string
  }
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
    artworkType: '',
    patternMode: '',
    artworkName: '',
    artworkVersion: '',
    upstreamObjectCode: '',
    upstreamObjectId: '',
  }
}

let state: PatternTaskState = {
  search: '',
  statusFilter: 'all',
  sourceFilter: 'all',
  artworkTypeFilter: 'all',
  selectedTaskId: null,
  detailOpen: false,
  createDrawerOpen: false,
  notice: null,
  createForm: createDefaultForm(),
}

function getTasks(): PatternTaskRecord[] {
  return listPatternTasks().filter((task) => {
    if (state.search) {
      const keyword = state.search.toLowerCase()
      if (
        ![
          task.patternTaskCode,
          task.title,
          task.projectCode,
          task.projectName,
          task.artworkName,
          task.productStyleCode,
          task.spuCode,
        ].some((text) => text.toLowerCase().includes(keyword))
      ) {
        return false
      }
    }
    if (state.statusFilter !== 'all' && task.status !== state.statusFilter) return false
    if (state.sourceFilter !== 'all' && task.sourceType !== state.sourceFilter) return false
    if (state.artworkTypeFilter !== 'all' && task.artworkType !== state.artworkTypeFilter) return false
    return true
  })
}

function getSelectedTask(): PatternTaskRecord | null {
  if (!state.selectedTaskId) return null
  return getPatternTaskById(state.selectedTaskId)
}

function getTechPackActionState(task: PatternTaskRecord) {
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

function renderTechPackSection(task: PatternTaskRecord): string {
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
            : `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-pattern-action="generate-tech-pack" data-task-id="${escapeHtml(task.patternTaskId)}">${escapeHtml(actionState.actionLabel)}</button>`
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

function buildCreateInput(): PatternTaskCreateInput {
  const project = listProjects().find((item) => item.projectId === state.createForm.projectId)
  return {
    projectId: state.createForm.projectId,
    title: state.createForm.title || `花型-${project?.projectName || '待定项目'}`,
    sourceType: state.createForm.sourceType as PatternTaskCreateInput['sourceType'],
    upstreamModule: state.createForm.sourceType === '改版任务' ? '改版任务' : '',
    upstreamObjectType: state.createForm.sourceType === '改版任务' ? '改版任务' : '',
    upstreamObjectId: state.createForm.upstreamObjectId,
    upstreamObjectCode: state.createForm.upstreamObjectCode,
    ownerName: state.createForm.ownerName,
    priorityLevel: state.createForm.priorityLevel,
    dueAt: state.createForm.dueAt,
    productStyleCode: state.createForm.productStyleCode,
    spuCode: state.createForm.spuCode,
    artworkType: state.createForm.artworkType,
    patternMode: state.createForm.patternMode,
    artworkName: state.createForm.artworkName,
    artworkVersion: state.createForm.artworkVersion,
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
  const patternAssets = listPatternAssetsForSelect()
  return uiDrawer(
    {
      title: '新建花型任务',
      subtitle: '正式创建后会写入花型任务记录、商品项目关系，并回写花型任务节点。',
      closeAction: { prefix: 'pattern', action: 'close-create-drawer' },
      width: 'lg',
    },
    `
      <div class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-medium">项目 <span class="text-red-500">*</span></label>
            <select class="h-9 w-full rounded-md border px-3 text-sm" data-pattern-field="create-projectId">
              <option value="">请选择项目</option>
              ${projects.map((item) => `<option value="${item.projectId}" ${state.createForm.projectId === item.projectId ? 'selected' : ''}>${escapeHtml(`${item.projectCode} · ${item.projectName}`)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">任务标题 <span class="text-red-500">*</span></label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.title)}" data-pattern-field="create-title" />
          </div>
        </div>
        <div class="grid gap-4 md:grid-cols-3">
          <div>
            <label class="mb-1 block text-sm font-medium">来源类型</label>
            <select class="h-9 w-full rounded-md border px-3 text-sm" data-pattern-field="create-sourceType">
              ${PATTERN_TASK_SOURCE_TYPE_LIST.map((item) => `<option value="${item}" ${state.createForm.sourceType === item ? 'selected' : ''}>${item}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">负责人</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.ownerName)}" data-pattern-field="create-ownerName" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">优先级</label>
            <select class="h-9 w-full rounded-md border px-3 text-sm" data-pattern-field="create-priorityLevel">
              ${['高', '中', '低'].map((item) => `<option value="${item}" ${state.createForm.priorityLevel === item ? 'selected' : ''}>${item}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid gap-4 md:grid-cols-3">
          <div>
            <label class="mb-1 block text-sm font-medium">截止时间</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" type="datetime-local" value="${escapeHtml(state.createForm.dueAt)}" data-pattern-field="create-dueAt" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">花型类型</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.artworkType)}" data-pattern-field="create-artworkType" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">花型模式</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.patternMode)}" data-pattern-field="create-patternMode" />
          </div>
        </div>
        <div class="grid gap-4 md:grid-cols-3">
          <div>
            <label class="mb-1 block text-sm font-medium">花型名称</label>
            <input list="pattern-library-options" class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.artworkName)}" data-pattern-field="create-artworkName" />
            <datalist id="pattern-library-options">
              ${patternAssets.map((item) => `<option value="${escapeHtml(item.label)}"></option>`).join('')}
            </datalist>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">花型版本</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.artworkVersion)}" data-pattern-field="create-artworkVersion" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">款式编码</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.productStyleCode)}" data-pattern-field="create-productStyleCode" />
          </div>
        </div>
        ${state.createForm.sourceType === '改版任务' ? `
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium">改版任务编号 <span class="text-red-500">*</span></label>
              <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.upstreamObjectCode)}" data-pattern-field="create-upstreamObjectCode" placeholder="请输入改版任务编号" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">改版任务主键</label>
              <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.upstreamObjectId)}" data-pattern-field="create-upstreamObjectId" placeholder="可选，用于精确追溯" />
            </div>
          </div>
        ` : ''}
      </div>
    `,
    {
      cancel: { prefix: 'pattern', action: 'close-create-drawer', label: '取消' },
      extraActions: [{ prefix: 'pattern', action: 'save-draft', label: '保存草稿', variant: 'secondary' }],
      confirm: { prefix: 'pattern', action: 'submit-create', label: '创建并开始', variant: 'primary' },
    },
  )
}

function renderDetailDrawer(): string {
  const task = getSelectedTask()
  if (!state.detailOpen || !task) return ''
  return uiDetailDrawer(
    {
      title: '花型任务详情',
      subtitle: task.patternTaskCode,
      closeAction: { prefix: 'pattern', action: 'close-drawer' },
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
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">花型类型</div><div class="mt-1 font-medium">${escapeHtml(task.artworkType || '—')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">花型模式</div><div class="mt-1 font-medium">${escapeHtml(task.patternMode || '—')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">花型名称</div><div class="mt-1 font-medium">${escapeHtml(task.artworkName || '—')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">花型版本</div><div class="mt-1 font-medium">${escapeHtml(task.artworkVersion || '—')}</div></div>
      </div>
      ${renderTechPackSection(task)}
      </div>
    `,
    `<div class="flex gap-2">
      ${
        task.linkedTechPackVersionId
          ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-pattern-action="view-tech-pack" data-task-id="${task.patternTaskId}">查看技术包版本</button>`
          : ''
      }
      ${
        getTechPackActionState(task).blockedReason
          ? ''
          : `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-pattern-action="generate-tech-pack" data-task-id="${task.patternTaskId}">${escapeHtml(getTechPackActionState(task).actionLabel)}</button>`
      }
      <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-pattern-action="go-pattern-library">查看花型库</button>
      <button class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground" data-pattern-action="deposit-to-library" data-task-id="${task.patternTaskId}">沉淀到花型库</button>
    </div>`,
  )
}

export function handlePatternTaskEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pattern-action]')
  const action = actionNode?.dataset.patternAction
  if (!action) return false

  if (action === 'open-create-drawer') {
    state.createDrawerOpen = true
    state.notice = null
    return true
  }
  if (action === 'close-create-drawer') {
    state.createDrawerOpen = false
    state.createForm = createDefaultForm()
    return true
  }
  if (action === 'close-drawer') {
    state.createDrawerOpen = false
    state.detailOpen = false
    return true
  }
  if (action === 'save-draft') {
    const draft = savePatternTaskDraft(buildCreateInput())
    state.notice = `已保存花型任务草稿：${draft.patternTaskCode}。草稿不会写入项目关系。`
    state.createDrawerOpen = false
    state.createForm = createDefaultForm()
    return true
  }
  if (action === 'submit-create') {
    const result = createPatternTaskWithProjectRelation(buildCreateInput())
    state.notice = result.message
    if (result.ok) {
      state.createDrawerOpen = false
      state.createForm = createDefaultForm()
      state.selectedTaskId = result.task.patternTaskId
    }
    return true
  }
  if (action === 'open-detail') {
    const taskId = actionNode?.dataset.taskId
    if (taskId) {
      state.selectedTaskId = taskId
      state.detailOpen = true
    }
    return true
  }
  if (action === 'generate-tech-pack') {
    const taskId = actionNode?.dataset.taskId
    const task = taskId ? getPatternTaskById(taskId) : null
    if (!task) return true
    const actionState = getTechPackActionState(task)
    if (actionState.blockedReason) {
      state.notice = actionState.blockedReason
      return true
    }
    try {
      const result = generateTechPackVersionFromPatternTask(task.patternTaskId, '商品中心')
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
    const task = taskId ? getPatternTaskById(taskId) : null
    const project = task ? getProjectById(task.projectId) : null
    if (task?.linkedTechPackVersionId && project?.linkedStyleId) {
      appStore.navigate(
        `/pcs/products/styles/${encodeURIComponent(project.linkedStyleId)}/technical-data/${encodeURIComponent(task.linkedTechPackVersionId)}`,
      )
    }
    return true
  }
  if (action === 'go-pattern-library') {
    appStore.navigate('/pcs/pattern-library')
    return true
  }
  if (action === 'deposit-to-library') {
    const taskId = actionNode?.dataset.taskId
    if (!taskId) return false
    appStore.navigate(`/pcs/pattern-library/create?sourceTaskId=${encodeURIComponent(taskId)}`)
    return true
  }
  return false
}

export function handlePatternTaskInput(target: Element): boolean {
  const field = (target as HTMLElement).dataset.patternField
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
  if (field === 'artworkType') {
    const value = (target as HTMLInputElement).value.trim()
    state.artworkTypeFilter = value || 'all'
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
  if (field === 'create-artworkType') {
    state.createForm.artworkType = (target as HTMLInputElement).value
    return true
  }
  if (field === 'create-patternMode') {
    state.createForm.patternMode = (target as HTMLInputElement).value
    return true
  }
  if (field === 'create-artworkName') {
    state.createForm.artworkName = (target as HTMLInputElement).value
    return true
  }
  if (field === 'create-artworkVersion') {
    state.createForm.artworkVersion = (target as HTMLInputElement).value
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

export function isPatternTaskDialogOpen(): boolean {
  return state.createDrawerOpen || state.detailOpen
}

export function renderPatternTaskPage(): string {
  const tasks = getTasks()
  return `
    <div class="space-y-4">
      <header class="flex items-center justify-between">
        <div>
          <p class="text-xs text-gray-500">工程开发与打样管理 / 花型任务</p>
          <h1 class="text-xl font-semibold">花型任务</h1>
          <p class="mt-1 text-sm text-gray-500">正式创建后会同步写入花型任务记录、商品项目关系，并可在确认产出后生成技术包版本。</p>
        </div>
        <div class="flex items-center gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-gray-50" data-pattern-action="go-pattern-library">查看花型库</button>
          <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-pattern-action="open-create-drawer">新建花型任务</button>
        </div>
      </header>

      ${renderNotice()}

      <section class="rounded-lg border bg-white p-4">
        <div class="grid gap-4 md:grid-cols-4">
          <input class="h-9 rounded-md border px-3 text-sm" placeholder="任务编号 / 项目 / 花型名称" value="${escapeHtml(state.search)}" data-pattern-field="search" />
          <select class="h-9 rounded-md border px-3 text-sm" data-pattern-field="status">
            ${['all', '草稿', '未开始', '进行中', '待评审', '已确认', '已完成', '异常待处理', '已取消'].map((item) => `<option value="${item}" ${state.statusFilter === item ? 'selected' : ''}>${item === 'all' ? '全部状态' : item}</option>`).join('')}
          </select>
          <select class="h-9 rounded-md border px-3 text-sm" data-pattern-field="source">
            <option value="all" ${state.sourceFilter === 'all' ? 'selected' : ''}>全部来源</option>
            ${PATTERN_TASK_SOURCE_TYPE_LIST.map((item) => `<option value="${item}" ${state.sourceFilter === item ? 'selected' : ''}>${item}</option>`).join('')}
          </select>
          <input class="h-9 rounded-md border px-3 text-sm" placeholder="花型类型筛选" value="${escapeHtml(state.artworkTypeFilter === 'all' ? '' : state.artworkTypeFilter)}" data-pattern-field="artworkType" />
        </div>
      </section>

      <section class="rounded-lg border bg-white overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b bg-gray-50 text-left text-gray-600">
              <th class="px-4 py-3 font-medium">任务</th>
              <th class="px-4 py-3 font-medium">项目</th>
              <th class="px-4 py-3 font-medium">来源类型</th>
              <th class="px-4 py-3 font-medium">花型类型</th>
              <th class="px-4 py-3 font-medium">花型名称</th>
              <th class="px-4 py-3 font-medium">状态</th>
              <th class="px-4 py-3 font-medium">负责人</th>
              <th class="px-4 py-3 font-medium">技术包版本</th>
              <th class="px-4 py-3 font-medium">最近更新</th>
              <th class="px-4 py-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.length === 0 ? `
              <tr><td colspan="10" class="px-4 py-10 text-center text-sm text-gray-500">暂无花型任务</td></tr>
            ` : tasks.map((task) => `
              <tr class="border-b last:border-b-0 hover:bg-gray-50">
                <td class="px-4 py-3">
                  <div class="font-medium">${escapeHtml(task.patternTaskCode)}</div>
                  <div class="text-xs text-gray-500">${escapeHtml(task.title)}</div>
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium">${escapeHtml(task.projectCode)}</div>
                  <div class="text-xs text-gray-500">${escapeHtml(task.projectName)}</div>
                </td>
                <td class="px-4 py-3">${escapeHtml(task.sourceType)}</td>
                <td class="px-4 py-3">${escapeHtml(task.artworkType || '—')}</td>
                <td class="px-4 py-3">${escapeHtml(task.artworkName || '—')}</td>
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
                        ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-pattern-action="view-tech-pack" data-task-id="${task.patternTaskId}">查看技术包版本</button>`
                        : ''
                    }
                    ${
                      getTechPackActionState(task).blockedReason
                        ? ''
                        : `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-pattern-action="generate-tech-pack" data-task-id="${task.patternTaskId}">${escapeHtml(getTechPackActionState(task).actionLabel)}</button>`
                    }
                    <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-pattern-action="open-detail" data-task-id="${task.patternTaskId}">查看</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>

      ${renderCreateDrawer()}
      ${renderDetailDrawer()}
    </div>
  `
}
