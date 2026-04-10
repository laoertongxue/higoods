import { renderDetailDrawer as uiDetailDrawer, renderDrawer as uiDrawer } from '../components/ui/index.ts'
import { listProjects } from '../data/pcs-project-repository.ts'
import {
  createDownstreamTasksFromRevision,
  createRevisionTaskWithProjectRelation,
  saveRevisionTaskDraft,
  type RevisionTaskCreateInput,
} from '../data/pcs-task-project-relation-writeback.ts'
import {
  getRevisionTaskById,
  listRevisionTaskPendingItems,
  listRevisionTasks,
} from '../data/pcs-revision-task-repository.ts'
import { REVISION_TASK_SOURCE_TYPE_LIST } from '../data/pcs-task-source-normalizer.ts'
import type { RevisionTaskRecord } from '../data/pcs-revision-task-types.ts'
import { escapeHtml } from '../utils'

const REVISION_SCOPE_OPTIONS = [
  { value: 'PATTERN', label: '版型结构' },
  { value: 'SIZE', label: '尺码规格' },
  { value: 'FABRIC', label: '面料' },
  { value: 'ACCESSORIES', label: '辅料' },
  { value: 'CRAFT', label: '工艺' },
  { value: 'PRINT', label: '花型' },
  { value: 'COLOR', label: '颜色' },
  { value: 'PACKAGE', label: '包装标识' },
]

const DOWNSTREAM_TASK_TYPES = [
  { value: 'PATTERN', label: '制版任务' },
  { value: 'PRINT', label: '花型任务' },
  { value: 'SAMPLE', label: '首版样衣打样' },
  { value: 'PRE_PRODUCTION', label: '产前版样衣' },
] as const

interface RevisionState {
  search: string
  statusFilter: string
  sourceFilter: string
  selectedTaskId: string | null
  detailOpen: boolean
  createOpen: boolean
  downstreamOpen: boolean
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
    upstreamObjectCode: string
    upstreamObjectId: string
    revisionScopeCodes: string[]
  }
  downstreamSelections: string[]
}

function createDefaultForm() {
  return {
    projectId: '',
    title: '',
    sourceType: '人工创建',
    ownerName: '',
    priorityLevel: '中' as const,
    dueAt: '',
    productStyleCode: '',
    spuCode: '',
    upstreamObjectCode: '',
    upstreamObjectId: '',
    revisionScopeCodes: [] as string[],
  }
}

let state: RevisionState = {
  search: '',
  statusFilter: 'all',
  sourceFilter: 'all',
  selectedTaskId: null,
  detailOpen: false,
  createOpen: false,
  downstreamOpen: false,
  notice: null,
  createForm: createDefaultForm(),
  downstreamSelections: [],
}

function getTasks(): RevisionTaskRecord[] {
  return listRevisionTasks().filter((task) => {
    if (state.search) {
      const keyword = state.search.toLowerCase()
      if (
        ![
          task.revisionTaskCode,
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

function getSelectedTask(): RevisionTaskRecord | null {
  if (!state.selectedTaskId) return null
  return getRevisionTaskById(state.selectedTaskId)
}

function renderNotice(): string {
  const pendingCount = listRevisionTaskPendingItems().length
  return `
    ${state.notice ? `<div class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">${escapeHtml(state.notice)}</div>` : ''}
    ${pendingCount > 0 ? `<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">当前还有 ${pendingCount} 条待补齐记录，未满足正式创建条件的旧数据已转入待补齐清单。</div>` : ''}
  `
}

function buildCreateInput(): RevisionTaskCreateInput {
  const project = listProjects().find((item) => item.projectId === state.createForm.projectId)
  const scopeNames = state.createForm.revisionScopeCodes
    .map((code) => REVISION_SCOPE_OPTIONS.find((item) => item.value === code)?.label || code)
  return {
    projectId: state.createForm.projectId,
    title: state.createForm.title || `改版任务-${project?.projectName || '待定项目'}`,
    sourceType: state.createForm.sourceType as RevisionTaskCreateInput['sourceType'],
    upstreamModule: state.createForm.sourceType === '测款触发' ? '测款结论' : '',
    upstreamObjectType: state.createForm.sourceType === '测款触发' ? '测款结论判定' : '',
    upstreamObjectId: state.createForm.upstreamObjectId,
    upstreamObjectCode: state.createForm.upstreamObjectCode,
    ownerName: state.createForm.ownerName,
    priorityLevel: state.createForm.priorityLevel,
    dueAt: state.createForm.dueAt,
    productStyleCode: state.createForm.productStyleCode,
    spuCode: state.createForm.spuCode,
    revisionScopeCodes: state.createForm.revisionScopeCodes,
    revisionScopeNames: scopeNames,
    operatorName: '当前用户',
  }
}

function renderCreateDrawer(): string {
  if (!state.createOpen) return ''
  const projects = listProjects()
  return uiDrawer(
    {
      title: '新建改版任务',
      subtitle: '正式创建后会写入改版任务记录、商品项目关系，并回写测款结论节点。',
      closeAction: { prefix: 'revision', action: 'close-create' },
      width: 'lg',
    },
    `
      <div class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-medium">项目 <span class="text-red-500">*</span></label>
            <select class="h-9 w-full rounded-md border px-3 text-sm" data-revision-field="create-projectId">
              <option value="">请选择项目</option>
              ${projects.map((item) => `<option value="${item.projectId}" ${state.createForm.projectId === item.projectId ? 'selected' : ''}>${escapeHtml(`${item.projectCode} · ${item.projectName}`)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">标题 <span class="text-red-500">*</span></label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.title)}" data-revision-field="create-title" />
          </div>
        </div>
        <div class="grid gap-4 md:grid-cols-3">
          <div>
            <label class="mb-1 block text-sm font-medium">来源类型</label>
            <select class="h-9 w-full rounded-md border px-3 text-sm" data-revision-field="create-sourceType">
              ${REVISION_TASK_SOURCE_TYPE_LIST.map((item) => `<option value="${item}" ${state.createForm.sourceType === item ? 'selected' : ''}>${item}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">负责人</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.ownerName)}" data-revision-field="create-ownerName" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">优先级</label>
            <select class="h-9 w-full rounded-md border px-3 text-sm" data-revision-field="create-priorityLevel">
              ${['高', '中', '低'].map((item) => `<option value="${item}" ${state.createForm.priorityLevel === item ? 'selected' : ''}>${item}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid gap-4 md:grid-cols-3">
          <div>
            <label class="mb-1 block text-sm font-medium">截止时间</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" type="datetime-local" value="${escapeHtml(state.createForm.dueAt)}" data-revision-field="create-dueAt" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">款式编码</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.productStyleCode)}" data-revision-field="create-productStyleCode" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">商品编码</label>
            <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.spuCode)}" data-revision-field="create-spuCode" />
          </div>
        </div>
        ${state.createForm.sourceType === '测款触发' ? `
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium">来源编号 <span class="text-red-500">*</span></label>
              <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.upstreamObjectCode)}" data-revision-field="create-upstreamObjectCode" placeholder="请输入测款结论编号" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">来源主键</label>
              <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.createForm.upstreamObjectId)}" data-revision-field="create-upstreamObjectId" placeholder="可选，用于精确追溯" />
            </div>
          </div>
        ` : ''}
        <div>
          <label class="mb-2 block text-sm font-medium">改版范围</label>
          <div class="flex flex-wrap gap-2">
            ${REVISION_SCOPE_OPTIONS.map((item) => {
              const active = state.createForm.revisionScopeCodes.includes(item.value)
              return `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs ${active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}" data-revision-action="toggle-scope" data-scope="${item.value}">${item.label}</button>`
            }).join('')}
          </div>
        </div>
      </div>
    `,
    {
      cancel: { prefix: 'revision', action: 'close-create', label: '取消' },
      extraActions: [{ prefix: 'revision', action: 'save-draft', label: '保存草稿', variant: 'secondary' }],
      confirm: { prefix: 'revision', action: 'submit-create', label: '创建并开始', variant: 'primary' },
    },
  )
}

function renderDetailDrawer(): string {
  const task = getSelectedTask()
  if (!state.detailOpen || !task) return ''
  return uiDetailDrawer(
    {
      title: '改版任务详情',
      subtitle: task.revisionTaskCode,
      closeAction: { prefix: 'revision', action: 'close-detail' },
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
          <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">改版版本</div><div class="mt-1 font-medium">${escapeHtml(task.revisionVersion || '—')}</div></div>
          <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">最近更新时间</div><div class="mt-1 font-medium">${escapeHtml(task.updatedAt)}</div></div>
        </div>
        <div>
          <div class="mb-2 text-sm font-medium">改版范围</div>
          <div class="flex flex-wrap gap-2">
            ${(task.revisionScopeNames.length > 0 ? task.revisionScopeNames : task.revisionScopeCodes).map((item) => `<span class="inline-flex rounded-full border px-3 py-1 text-xs">${escapeHtml(item)}</span>`).join('') || '<span class="text-gray-500">未填写改版范围</span>'}
          </div>
        </div>
      </div>
    `,
    `<button class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground" data-revision-action="open-downstream">创建下游任务</button>`,
  )
}

function renderDownstreamDialog(): string {
  const task = getSelectedTask()
  if (!state.downstreamOpen || !task) return ''
  return uiDrawer(
    {
      title: '创建下游任务',
      subtitle: `将基于 ${task.revisionTaskCode} 批量创建正式下游任务，并自动写入商品项目关系。`,
      closeAction: { prefix: 'revision', action: 'close-downstream' },
      width: 'md',
    },
    `
      <div class="space-y-4">
        <div class="rounded-lg border bg-muted/20 px-3 py-3 text-sm">
          <div>改版任务：<span class="font-medium">${escapeHtml(task.revisionTaskCode)}</span></div>
          <div class="mt-1">项目：<span class="font-medium">${escapeHtml(`${task.projectCode} · ${task.projectName}`)}</span></div>
        </div>
        <div class="space-y-2">
          ${DOWNSTREAM_TASK_TYPES.map((item) => {
            const checked = state.downstreamSelections.includes(item.value)
            return `
              <label class="flex items-center justify-between rounded-lg border px-3 py-3 text-sm">
                <span>${item.label}</span>
                <input type="checkbox" class="h-4 w-4" data-revision-action="toggle-downstream" data-downstream="${item.value}" ${checked ? 'checked' : ''} />
              </label>
            `
          }).join('')}
        </div>
      </div>
    `,
    {
      cancel: { prefix: 'revision', action: 'close-downstream', label: '取消' },
      confirm: { prefix: 'revision', action: 'confirm-downstream', label: '确认创建下游任务', variant: 'primary' },
    },
  )
}

export function handleRevisionTaskEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-revision-action]')
  const action = actionNode?.dataset.revisionAction
  if (!action) return false

  if (action === 'open-create') {
    state.createOpen = true
    state.notice = null
    return true
  }
  if (action === 'close-create') {
    state.createOpen = false
    state.createForm = createDefaultForm()
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
  if (action === 'close-detail') {
    state.detailOpen = false
    return true
  }
  if (action === 'close-drawer') {
    state.detailOpen = false
    state.createOpen = false
    state.downstreamOpen = false
    return true
  }
  if (action === 'toggle-scope') {
    const scope = actionNode?.dataset.scope
    if (!scope) return false
    state.createForm.revisionScopeCodes = state.createForm.revisionScopeCodes.includes(scope)
      ? state.createForm.revisionScopeCodes.filter((item) => item !== scope)
      : [...state.createForm.revisionScopeCodes, scope]
    return true
  }
  if (action === 'save-draft') {
    const draft = saveRevisionTaskDraft(buildCreateInput())
    state.notice = `已保存改版任务草稿：${draft.revisionTaskCode}。草稿不会写入项目关系。`
    state.createOpen = false
    state.createForm = createDefaultForm()
    return true
  }
  if (action === 'submit-create') {
    const result = createRevisionTaskWithProjectRelation(buildCreateInput())
    state.notice = result.message
    if (result.ok) {
      state.createOpen = false
      state.createForm = createDefaultForm()
      state.selectedTaskId = result.task.revisionTaskId
    }
    return true
  }
  if (action === 'open-downstream') {
    state.downstreamOpen = true
    state.downstreamSelections = []
    return true
  }
  if (action === 'close-downstream') {
    state.downstreamOpen = false
    state.downstreamSelections = []
    return true
  }
  if (action === 'toggle-downstream') {
    const value = actionNode?.dataset.downstream
    if (!value) return false
    state.downstreamSelections = state.downstreamSelections.includes(value)
      ? state.downstreamSelections.filter((item) => item !== value)
      : [...state.downstreamSelections, value]
    return true
  }
  if (action === 'confirm-downstream') {
    if (!state.selectedTaskId) return true
    const result = createDownstreamTasksFromRevision(state.selectedTaskId, state.downstreamSelections as Array<(typeof DOWNSTREAM_TASK_TYPES)[number]['value']>)
    const successText = result.successCount > 0 ? `已创建 ${result.successCount} 条下游任务：${result.createdTaskCodes.join('、')}。` : '本次没有成功创建下游任务。'
    const failureText = result.failureMessages.length > 0 ? ` 未创建原因：${result.failureMessages.join('；')}` : ''
    state.notice = `${successText}${failureText}`
    state.downstreamOpen = false
    state.downstreamSelections = []
    return true
  }
  return false
}

export function handleRevisionTaskInput(target: Element): boolean {
  const field = (target as HTMLElement).dataset.revisionField
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

export function isRevisionTaskDialogOpen(): boolean {
  return state.detailOpen || state.createOpen || state.downstreamOpen
}

export function renderRevisionTaskPage(): string {
  const tasks = getTasks()
  return `
    <div class="space-y-4">
      <header class="flex items-center justify-between">
        <div>
          <p class="text-xs text-gray-500">工程开发与打样管理 / 改版任务</p>
          <h1 class="text-xl font-semibold">改版任务</h1>
          <p class="mt-1 text-sm text-gray-500">正式创建后会同步写入改版任务记录、商品项目关系，并回写测款结论判定节点。</p>
        </div>
        <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-revision-action="open-create">新建改版任务</button>
      </header>

      ${renderNotice()}

      <section class="rounded-lg border bg-white p-4">
        <div class="grid gap-4 md:grid-cols-3">
          <input class="h-9 rounded-md border px-3 text-sm" placeholder="任务编号 / 项目 / 款式编码" value="${escapeHtml(state.search)}" data-revision-field="search" />
          <select class="h-9 rounded-md border px-3 text-sm" data-revision-field="status">
            ${['all', '草稿', '未开始', '进行中', '待评审', '已确认', '已完成', '异常待处理', '已取消'].map((item) => `<option value="${item}" ${state.statusFilter === item ? 'selected' : ''}>${item === 'all' ? '全部状态' : item}</option>`).join('')}
          </select>
          <select class="h-9 rounded-md border px-3 text-sm" data-revision-field="source">
            <option value="all" ${state.sourceFilter === 'all' ? 'selected' : ''}>全部来源</option>
            ${REVISION_TASK_SOURCE_TYPE_LIST.map((item) => `<option value="${item}" ${state.sourceFilter === item ? 'selected' : ''}>${item}</option>`).join('')}
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
              <th class="px-4 py-3 font-medium">改版范围</th>
              <th class="px-4 py-3 font-medium">状态</th>
              <th class="px-4 py-3 font-medium">负责人</th>
              <th class="px-4 py-3 font-medium">截止时间</th>
              <th class="px-4 py-3 font-medium">最近更新</th>
              <th class="px-4 py-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.length === 0 ? `
              <tr><td colspan="9" class="px-4 py-10 text-center text-sm text-gray-500">暂无改版任务</td></tr>
            ` : tasks.map((task) => `
              <tr class="border-b last:border-b-0 hover:bg-gray-50">
                <td class="px-4 py-3">
                  <div class="font-medium">${escapeHtml(task.revisionTaskCode)}</div>
                  <div class="text-xs text-gray-500">${escapeHtml(task.title)}</div>
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium">${escapeHtml(task.projectCode)}</div>
                  <div class="text-xs text-gray-500">${escapeHtml(task.projectName)}</div>
                </td>
                <td class="px-4 py-3">${escapeHtml(task.sourceType)}</td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1">
                    ${(task.revisionScopeNames.length > 0 ? task.revisionScopeNames : task.revisionScopeCodes).slice(0, 2).map((item) => `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs">${escapeHtml(item)}</span>`).join('')}
                    ${(task.revisionScopeNames.length || task.revisionScopeCodes.length) > 2 ? `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs">+${(task.revisionScopeNames.length || task.revisionScopeCodes.length) - 2}</span>` : ''}
                  </div>
                </td>
                <td class="px-4 py-3">${escapeHtml(task.status)}</td>
                <td class="px-4 py-3">${escapeHtml(task.ownerName || '—')}</td>
                <td class="px-4 py-3">${escapeHtml(task.dueAt || '—')}</td>
                <td class="px-4 py-3 text-gray-500">${escapeHtml(task.updatedAt)}</td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-revision-action="open-detail" data-task-id="${task.revisionTaskId}">查看</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>

      ${renderCreateDrawer()}
      ${renderDetailDrawer()}
      ${renderDownstreamDialog()}
    </div>
  `
}
