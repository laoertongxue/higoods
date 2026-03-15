import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  TEMPLATE_WORK_ITEM_LIBRARY,
  createEmptyStage,
  createEmptyWorkItem,
  createProjectTemplate,
  getProjectTemplateById,
  getStatusLabel,
  updateProjectTemplate,
  type TemplateRequired,
  type TemplateStage,
  type TemplateStatusCode,
  type TemplateStyleType,
  type TemplateWorkItem,
  type TemplateWorkItemType,
} from '../data/pcs-templates'

type EditorMode = 'create' | 'edit'

interface TemplateEditorState {
  initializedKey: string
  mode: EditorMode
  templateId: string | null
  name: string
  styleType: '' | TemplateStyleType
  description: string
  status: TemplateStatusCode
  stages: TemplateStage[]
  notice: string | null
  cancelDialogOpen: boolean
  libraryDialog: {
    open: boolean
    stageId: string | null
    selectedIds: string[]
  }
}

const state: TemplateEditorState = {
  initializedKey: '',
  mode: 'create',
  templateId: null,
  name: '',
  styleType: '',
  description: '',
  status: 'active',
  stages: [],
  notice: null,
  cancelDialogOpen: false,
  libraryDialog: {
    open: false,
    stageId: null,
    selectedIds: [],
  },
}

function cloneWorkItem(item: TemplateWorkItem): TemplateWorkItem {
  return {
    ...item,
    roles: [...item.roles],
  }
}

function cloneStage(stage: TemplateStage): TemplateStage {
  return {
    ...stage,
    workItems: stage.workItems.map(cloneWorkItem),
  }
}

function makeDefaultStages(): TemplateStage[] {
  const stage = createEmptyStage(0)
  stage.id = `TMP-S${Date.now()}-1`
  stage.name = '01 立项阶段'
  stage.description = '项目立项与信息收集'
  stage.workItems = [
    {
      ...createEmptyWorkItem(0, 0),
      id: `TMP-W${Date.now()}-1`,
      name: '基础信息确认',
      roles: ['商品运营'],
      fieldTemplate: '商品项目基础信息',
      note: '—',
    },
  ]
  return [stage]
}

function formatRoles(roles: string[]): string {
  return roles.join(' / ')
}

function parseRoles(input: string): string[] {
  return input
    .split(/[、,/，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function createStageDraft(index: number): TemplateStage {
  const stage = createEmptyStage(index)
  stage.id = `TMP-S${Date.now()}-${index + 1}`
  return stage
}

function createWorkItemDraft(stageIndex: number, itemIndex: number): TemplateWorkItem {
  const item = createEmptyWorkItem(stageIndex, itemIndex)
  item.id = `TMP-W${Date.now()}-${stageIndex + 1}-${itemIndex + 1}`
  return item
}

function ensureInitialized(mode: EditorMode, templateId?: string): void {
  const key = `${mode}:${templateId ?? ''}`
  if (state.initializedKey === key) return

  state.initializedKey = key
  state.mode = mode
  state.templateId = templateId ?? null
  state.notice = null
  state.cancelDialogOpen = false
  state.libraryDialog = { open: false, stageId: null, selectedIds: [] }

  if (mode === 'create') {
    state.name = ''
    state.styleType = ''
    state.description = ''
    state.status = 'active'
    state.stages = makeDefaultStages()
    return
  }

  const template = templateId ? getProjectTemplateById(templateId) : null
  if (!template) {
    state.name = ''
    state.styleType = ''
    state.description = ''
    state.status = 'active'
    state.stages = makeDefaultStages()
    return
  }

  state.name = template.name
  state.styleType = (template.styleType[0] ?? '') as '' | TemplateStyleType
  state.description = template.description
  state.status = template.status
  state.stages = template.stages.map(cloneStage)
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-template-editor-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  const isCreate = state.mode === 'create'
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-template-editor-action="go-list">
          <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回模板列表
        </button>
        <h1 class="text-xl font-semibold">${isCreate ? '新增模板' : '编辑模板'}</h1>
        <p class="text-sm text-muted-foreground">${isCreate ? '创建新的商品项目模板，配置阶段与工作项。' : '更新模板基础信息与阶段配置。'}</p>
      </div>
      <div class="flex items-center gap-2">
        ${
          !isCreate
            ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-template-editor-action="go-detail">查看详情</button>`
            : ''
        }
      </div>
    </header>
  `
}

function renderBasicInfo(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">模板基本信息</h2>
      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">模板名称 <span class="text-red-500">*</span></label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.name)}" placeholder="如：基础款-完整流程模板" data-pcs-template-editor-field="name" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">适用款式类型 <span class="text-red-500">*</span></label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-template-editor-field="styleType">
            <option value="" ${state.styleType === '' ? 'selected' : ''}>请选择款式类型</option>
            <option value="基础款" ${state.styleType === '基础款' ? 'selected' : ''}>基础款</option>
            <option value="快时尚款" ${state.styleType === '快时尚款' ? 'selected' : ''}>快时尚款</option>
            <option value="改版款" ${state.styleType === '改版款' ? 'selected' : ''}>改版款</option>
            <option value="设计款" ${state.styleType === '设计款' ? 'selected' : ''}>设计款</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">模板状态</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-template-editor-field="status">
            <option value="active" ${state.status === 'active' ? 'selected' : ''}>${getStatusLabel('active')}</option>
            <option value="inactive" ${state.status === 'inactive' ? 'selected' : ''}>${getStatusLabel('inactive')}</option>
          </select>
        </div>
        <div class="md:col-span-2">
          <label class="mb-1 block text-xs text-muted-foreground">模板说明</label>
          <textarea class="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="描述模板适用场景..." data-pcs-template-editor-field="description">${escapeHtml(state.description)}</textarea>
        </div>
      </div>
    </section>
  `
}

function renderWorkItemRow(stage: TemplateStage, stageIndex: number, item: TemplateWorkItem): string {
  return `
    <tr class="border-b last:border-b-0">
      <td class="px-2 py-1.5">
        <input class="h-8 w-full rounded-md border bg-background px-2 text-xs" value="${escapeHtml(item.name)}" data-pcs-template-editor-field="workItemName" data-stage-id="${escapeHtml(stage.id)}" data-work-item-id="${escapeHtml(item.id)}" />
      </td>
      <td class="px-2 py-1.5">
        <select class="h-8 w-full rounded-md border bg-background px-2 text-xs" data-pcs-template-editor-field="workItemType" data-stage-id="${escapeHtml(stage.id)}" data-work-item-id="${escapeHtml(item.id)}">
          <option value="执行类" ${item.type === '执行类' ? 'selected' : ''}>执行类</option>
          <option value="决策类" ${item.type === '决策类' ? 'selected' : ''}>决策类</option>
          <option value="里程碑类" ${item.type === '里程碑类' ? 'selected' : ''}>里程碑类</option>
          <option value="事实类" ${item.type === '事实类' ? 'selected' : ''}>事实类</option>
        </select>
      </td>
      <td class="px-2 py-1.5">
        <select class="h-8 w-full rounded-md border bg-background px-2 text-xs" data-pcs-template-editor-field="workItemRequired" data-stage-id="${escapeHtml(stage.id)}" data-work-item-id="${escapeHtml(item.id)}">
          <option value="必做" ${item.required === '必做' ? 'selected' : ''}>必做</option>
          <option value="可选" ${item.required === '可选' ? 'selected' : ''}>可选</option>
        </select>
      </td>
      <td class="px-2 py-1.5">
        <input class="h-8 w-full rounded-md border bg-background px-2 text-xs" value="${escapeHtml(formatRoles(item.roles))}" placeholder="用 / 或逗号分隔" data-pcs-template-editor-field="workItemRoles" data-stage-id="${escapeHtml(stage.id)}" data-work-item-id="${escapeHtml(item.id)}" />
      </td>
      <td class="px-2 py-1.5">
        <input class="h-8 w-full rounded-md border bg-background px-2 text-xs" value="${escapeHtml(item.fieldTemplate)}" data-pcs-template-editor-field="workItemFieldTemplate" data-stage-id="${escapeHtml(stage.id)}" data-work-item-id="${escapeHtml(item.id)}" />
      </td>
      <td class="px-2 py-1.5">
        <input class="h-8 w-full rounded-md border bg-background px-2 text-xs" value="${escapeHtml(item.note)}" data-pcs-template-editor-field="workItemNote" data-stage-id="${escapeHtml(stage.id)}" data-work-item-id="${escapeHtml(item.id)}" />
      </td>
      <td class="px-2 py-1.5 text-right">
        <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs text-red-700 hover:bg-red-50" data-pcs-template-editor-action="remove-work-item" data-stage-id="${escapeHtml(stage.id)}" data-work-item-id="${escapeHtml(item.id)}">删除</button>
      </td>
    </tr>
  `
}

function renderStageCard(stage: TemplateStage, stageIndex: number): string {
  return `
    <article class="rounded-lg border bg-background p-3">
      <div class="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div class="space-y-1">
          <p class="text-xs text-muted-foreground">阶段 ${stageIndex + 1}</p>
          <div class="grid gap-2 md:grid-cols-2">
            <input class="h-8 w-full rounded-md border bg-background px-2 text-xs" value="${escapeHtml(stage.name)}" placeholder="阶段名称" data-pcs-template-editor-field="stageName" data-stage-id="${escapeHtml(stage.id)}" />
            <input class="h-8 w-full rounded-md border bg-background px-2 text-xs" value="${escapeHtml(stage.description)}" placeholder="阶段说明" data-pcs-template-editor-field="stageDescription" data-stage-id="${escapeHtml(stage.id)}" />
          </div>
        </div>
        <div class="flex items-center gap-2">
          <label class="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <input type="checkbox" class="h-4 w-4 rounded border" ${stage.required ? 'checked' : ''} data-pcs-template-editor-field="stageRequired" data-stage-id="${escapeHtml(stage.id)}" />
            必经
          </label>
          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-template-editor-action="add-work-item" data-stage-id="${escapeHtml(stage.id)}">
            新增工作项
          </button>
          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-template-editor-action="open-library" data-stage-id="${escapeHtml(stage.id)}">
            从工作项库选择
          </button>
          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs text-red-700 hover:bg-red-50 ${state.stages.length <= 1 ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-template-editor-action="remove-stage" data-stage-id="${escapeHtml(stage.id)}" ${state.stages.length <= 1 ? 'disabled' : ''}>
            删除阶段
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[980px] text-xs">
          <thead>
            <tr class="border-b text-left text-muted-foreground">
              <th class="px-2 py-1.5 font-medium">工作项名称</th>
              <th class="px-2 py-1.5 font-medium">类型</th>
              <th class="px-2 py-1.5 font-medium">必做</th>
              <th class="px-2 py-1.5 font-medium">执行角色</th>
              <th class="px-2 py-1.5 font-medium">关联字段模板</th>
              <th class="px-2 py-1.5 font-medium">备注</th>
              <th class="px-2 py-1.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              stage.workItems.length > 0
                ? stage.workItems.map((item) => renderWorkItemRow(stage, stageIndex, item)).join('')
                : `
                  <tr>
                    <td colspan="7" class="px-2 py-4 text-center text-muted-foreground">暂无工作项，可新增或从工作项库选择</td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>
    </article>
  `
}

function renderStageSection(): string {
  return `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold">阶段 & 工作项配置</h2>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-template-editor-action="add-stage">
          <i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>新增阶段
        </button>
      </div>
      <div class="space-y-3">
        ${state.stages.map((stage, index) => renderStageCard(stage, index)).join('')}
      </div>
    </section>
  `
}

function renderActionBar(): string {
  return `
    <section class="sticky bottom-0 z-20 rounded-lg border bg-background/95 p-3 backdrop-blur">
      <div class="flex items-center justify-end gap-2">
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-template-editor-action="open-cancel-dialog">取消</button>
        <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-template-editor-action="save-template">${state.mode === 'create' ? '创建模板' : '保存模板'}</button>
      </div>
    </section>
  `
}

function renderCancelDialog(): string {
  if (!state.cancelDialogOpen) return ''
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-md rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">确认取消</h3>
          <p class="mt-1 text-xs text-muted-foreground">未保存的修改将会丢失，确认离开当前页面？</p>
        </header>
        <footer class="flex items-center justify-end gap-2 px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-template-editor-action="close-cancel-dialog">继续编辑</button>
          <button class="inline-flex h-9 items-center rounded-md border border-red-300 px-3 text-sm text-red-700 hover:bg-red-50" data-pcs-template-editor-action="confirm-cancel">确认离开</button>
        </footer>
      </section>
    </div>
  `
}

function renderLibraryDialog(): string {
  if (!state.libraryDialog.open || !state.libraryDialog.stageId) return ''
  const stage = state.stages.find((item) => item.id === state.libraryDialog.stageId)
  if (!stage) return ''

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-2xl rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">从工作项库选择</h3>
          <p class="mt-1 text-xs text-muted-foreground">目标阶段：${escapeHtml(stage.name)}</p>
        </header>
        <div class="max-h-[60vh] overflow-y-auto p-4">
          <div class="space-y-2">
            ${TEMPLATE_WORK_ITEM_LIBRARY.map((item) => {
              const checked = state.libraryDialog.selectedIds.includes(item.id)
              return `
                <label class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/30">
                  <input type="checkbox" class="mt-0.5 h-4 w-4 rounded border" data-pcs-template-editor-field="librarySelect" data-library-item-id="${escapeHtml(item.id)}" ${checked ? 'checked' : ''} />
                  <div class="space-y-1">
                    <p class="text-sm font-medium">${escapeHtml(item.name)}</p>
                    <p class="text-xs text-muted-foreground">类型：${escapeHtml(item.type)} ｜ 角色：${escapeHtml(item.roles.join(' / '))}</p>
                    <p class="text-xs text-muted-foreground">字段模板：${escapeHtml(item.fieldTemplate)}</p>
                  </div>
                </label>
              `
            }).join('')}
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-template-editor-action="close-library">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-template-editor-action="confirm-library">添加已选工作项</button>
        </footer>
      </section>
    </div>
  `
}

function findStage(stageId: string): TemplateStage | null {
  return state.stages.find((stage) => stage.id === stageId) ?? null
}

function findWorkItem(stage: TemplateStage, workItemId: string): TemplateWorkItem | null {
  return stage.workItems.find((item) => item.id === workItemId) ?? null
}

function saveTemplate(): boolean {
  const name = state.name.trim()
  if (!name) {
    state.notice = '模板名称不能为空。'
    return false
  }
  if (!state.styleType) {
    state.notice = '请选择适用款式类型。'
    return false
  }
  if (state.stages.length === 0) {
    state.notice = '至少需要一个阶段。'
    return false
  }

  const normalizedStages = state.stages.map((stage, stageIndex) => ({
    ...stage,
    name: stage.name.trim() || `${String(stageIndex + 1).padStart(2, '0')} 新阶段`,
    description: stage.description.trim(),
    workItems:
      stage.workItems.length > 0
        ? stage.workItems.map((item, itemIndex) => ({
            ...item,
            name: item.name.trim() || `工作项${itemIndex + 1}`,
            roles: item.roles.length > 0 ? item.roles : ['待分配角色'],
            fieldTemplate: item.fieldTemplate.trim() || '待补充',
            note: item.note.trim(),
          }))
        : [createWorkItemDraft(stageIndex, 0)],
  }))

  if (state.mode === 'create') {
    const created = createProjectTemplate({
      name,
      styleType: [state.styleType],
      description: state.description.trim(),
      status: state.status,
      stages: normalizedStages,
      creator: '当前用户',
    })
    appStore.navigate(`/pcs/templates/${created.id}`)
    return true
  }

  if (!state.templateId) return false
  const updated = updateProjectTemplate(state.templateId, {
    name,
    styleType: [state.styleType],
    description: state.description.trim(),
    status: state.status,
    stages: normalizedStages,
  })
  if (!updated) {
    state.notice = '模板不存在，保存失败。'
    return false
  }
  appStore.navigate(`/pcs/templates/${updated.id}`)
  return true
}

export function renderPcsTemplateCreatePage(): string {
  ensureInitialized('create')
  return `
    <div class="space-y-4 pb-16">
      ${renderHeader()}
      ${renderNotice()}
      ${renderBasicInfo()}
      ${renderStageSection()}
      ${renderActionBar()}
      ${renderCancelDialog()}
      ${renderLibraryDialog()}
    </div>
  `
}

export function renderPcsTemplateEditPage(templateId: string): string {
  ensureInitialized('edit', templateId)
  const target = getProjectTemplateById(templateId)
  if (!target) {
    return `
      <div class="space-y-4">
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-template-editor-action="go-list">
          <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回模板列表
        </button>
        <section class="rounded-lg border border-dashed bg-card px-4 py-14 text-center text-muted-foreground">
          <i data-lucide="file-x-2" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
          <p class="mt-2">未找到模板：${escapeHtml(templateId)}</p>
        </section>
      </div>
    `
  }

  return `
    <div class="space-y-4 pb-16">
      ${renderHeader()}
      ${renderNotice()}
      ${renderBasicInfo()}
      ${renderStageSection()}
      ${renderActionBar()}
      ${renderCancelDialog()}
      ${renderLibraryDialog()}
    </div>
  `
}

export function handlePcsTemplateEditorEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-template-editor-field]')

  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.pcsTemplateEditorField
    if (field === 'name') {
      state.name = fieldNode.value
      return true
    }
    if (field === 'stageName') {
      const stageId = fieldNode.dataset.stageId
      if (!stageId) return false
      const stage = findStage(stageId)
      if (!stage) return false
      stage.name = fieldNode.value
      return true
    }
    if (field === 'stageDescription') {
      const stageId = fieldNode.dataset.stageId
      if (!stageId) return false
      const stage = findStage(stageId)
      if (!stage) return false
      stage.description = fieldNode.value
      return true
    }
    if (field === 'stageRequired') {
      const stageId = fieldNode.dataset.stageId
      if (!stageId) return false
      const stage = findStage(stageId)
      if (!stage) return false
      stage.required = fieldNode.checked
      return true
    }
    if (field === 'workItemName') {
      const stageId = fieldNode.dataset.stageId
      const workItemId = fieldNode.dataset.workItemId
      if (!stageId || !workItemId) return false
      const stage = findStage(stageId)
      if (!stage) return false
      const item = findWorkItem(stage, workItemId)
      if (!item) return false
      item.name = fieldNode.value
      return true
    }
    if (field === 'workItemRoles') {
      const stageId = fieldNode.dataset.stageId
      const workItemId = fieldNode.dataset.workItemId
      if (!stageId || !workItemId) return false
      const stage = findStage(stageId)
      if (!stage) return false
      const item = findWorkItem(stage, workItemId)
      if (!item) return false
      item.roles = parseRoles(fieldNode.value)
      return true
    }
    if (field === 'workItemFieldTemplate') {
      const stageId = fieldNode.dataset.stageId
      const workItemId = fieldNode.dataset.workItemId
      if (!stageId || !workItemId) return false
      const stage = findStage(stageId)
      if (!stage) return false
      const item = findWorkItem(stage, workItemId)
      if (!item) return false
      item.fieldTemplate = fieldNode.value
      return true
    }
    if (field === 'workItemNote') {
      const stageId = fieldNode.dataset.stageId
      const workItemId = fieldNode.dataset.workItemId
      if (!stageId || !workItemId) return false
      const stage = findStage(stageId)
      if (!stage) return false
      const item = findWorkItem(stage, workItemId)
      if (!item) return false
      item.note = fieldNode.value
      return true
    }
    if (field === 'librarySelect') {
      const itemId = fieldNode.dataset.libraryItemId
      if (!itemId) return false
      if (fieldNode.checked) {
        if (!state.libraryDialog.selectedIds.includes(itemId)) {
          state.libraryDialog.selectedIds = [...state.libraryDialog.selectedIds, itemId]
        }
      } else {
        state.libraryDialog.selectedIds = state.libraryDialog.selectedIds.filter((id) => id !== itemId)
      }
      return true
    }
  }

  if (fieldNode instanceof HTMLTextAreaElement && fieldNode.dataset.pcsTemplateEditorField === 'description') {
    state.description = fieldNode.value
    return true
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsTemplateEditorField
    if (field === 'styleType') {
      state.styleType = fieldNode.value as '' | TemplateStyleType
      return true
    }
    if (field === 'status') {
      state.status = fieldNode.value as TemplateStatusCode
      return true
    }
    if (field === 'workItemType') {
      const stageId = fieldNode.dataset.stageId
      const workItemId = fieldNode.dataset.workItemId
      if (!stageId || !workItemId) return false
      const stage = findStage(stageId)
      if (!stage) return false
      const item = findWorkItem(stage, workItemId)
      if (!item) return false
      item.type = fieldNode.value as TemplateWorkItemType
      return true
    }
    if (field === 'workItemRequired') {
      const stageId = fieldNode.dataset.stageId
      const workItemId = fieldNode.dataset.workItemId
      if (!stageId || !workItemId) return false
      const stage = findStage(stageId)
      if (!stage) return false
      const item = findWorkItem(stage, workItemId)
      if (!item) return false
      item.required = fieldNode.value as TemplateRequired
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-template-editor-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsTemplateEditorAction
  if (!action) return false

  if (action === 'go-list') {
    appStore.navigate('/pcs/templates')
    return true
  }

  if (action === 'go-detail') {
    if (!state.templateId) return false
    appStore.navigate(`/pcs/templates/${state.templateId}`)
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'add-stage') {
    const next = createStageDraft(state.stages.length)
    state.stages = [...state.stages, next]
    return true
  }

  if (action === 'remove-stage') {
    const stageId = actionNode.dataset.stageId
    if (!stageId || state.stages.length <= 1) return false
    state.stages = state.stages.filter((stage) => stage.id !== stageId)
    return true
  }

  if (action === 'add-work-item') {
    const stageId = actionNode.dataset.stageId
    if (!stageId) return false
    const stageIndex = state.stages.findIndex((stage) => stage.id === stageId)
    if (stageIndex < 0) return false
    const stage = state.stages[stageIndex]
    const nextItem = createWorkItemDraft(stageIndex, stage.workItems.length)
    stage.workItems = [...stage.workItems, nextItem]
    return true
  }

  if (action === 'remove-work-item') {
    const stageId = actionNode.dataset.stageId
    const workItemId = actionNode.dataset.workItemId
    if (!stageId || !workItemId) return false
    const stage = findStage(stageId)
    if (!stage) return false
    stage.workItems = stage.workItems.filter((item) => item.id !== workItemId)
    return true
  }

  if (action === 'open-library') {
    const stageId = actionNode.dataset.stageId
    if (!stageId) return false
    state.libraryDialog.open = true
    state.libraryDialog.stageId = stageId
    state.libraryDialog.selectedIds = []
    return true
  }

  if (action === 'close-library') {
    state.libraryDialog.open = false
    state.libraryDialog.stageId = null
    state.libraryDialog.selectedIds = []
    return true
  }

  if (action === 'confirm-library') {
    const stageId = state.libraryDialog.stageId
    if (!stageId) return false
    const stage = findStage(stageId)
    if (!stage) return false
    const selected = TEMPLATE_WORK_ITEM_LIBRARY.filter((item) => state.libraryDialog.selectedIds.includes(item.id))
    const appended = selected.map((item, index) => ({
      id: `TMP-W${Date.now()}-${index + 1}`,
      name: item.name,
      type: item.type,
      required: '必做' as const,
      roles: [...item.roles],
      fieldTemplate: item.fieldTemplate,
      note: '来自工作项库',
    }))
    stage.workItems = [...stage.workItems, ...appended]
    state.libraryDialog.open = false
    state.libraryDialog.stageId = null
    state.libraryDialog.selectedIds = []
    return true
  }

  if (action === 'open-cancel-dialog') {
    state.cancelDialogOpen = true
    return true
  }

  if (action === 'close-cancel-dialog') {
    state.cancelDialogOpen = false
    return true
  }

  if (action === 'confirm-cancel') {
    state.cancelDialogOpen = false
    if (state.mode === 'edit' && state.templateId) {
      appStore.navigate(`/pcs/templates/${state.templateId}`)
      return true
    }
    appStore.navigate('/pcs/templates')
    return true
  }

  if (action === 'save-template') {
    return saveTemplate()
  }

  return false
}

export function isPcsTemplateEditorDialogOpen(): boolean {
  return state.cancelDialogOpen || state.libraryDialog.open
}

