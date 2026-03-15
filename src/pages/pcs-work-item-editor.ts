import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  createPcsWorkItem,
  getPcsWorkItemEditorData,
  updatePcsWorkItem,
  WORK_ITEM_FIELD_MODEL_OPTIONS,
  WORK_ITEM_ROLE_OPTIONS,
  type WorkItemNature,
  type WorkItemStatus,
} from '../data/pcs-work-items'
import { renderConfirmDialog } from '../components/ui/dialog'

type EditorMode = 'create' | 'edit'

interface WorkItemEditorState {
  initializedKey: string
  mode: EditorMode
  workItemId: string | null
  name: string
  nature: WorkItemNature
  description: string
  status: WorkItemStatus
  roles: string[]
  fieldModels: string[]
  notice: string | null
  cancelDialogOpen: boolean
}

const state: WorkItemEditorState = {
  initializedKey: '',
  mode: 'create',
  workItemId: null,
  name: '',
  nature: '执行类',
  description: '',
  status: '启用',
  roles: [],
  fieldModels: [],
  notice: null,
  cancelDialogOpen: false,
}

function ensureInitialized(mode: EditorMode, workItemId?: string): void {
  const key = `${mode}:${workItemId ?? ''}`
  if (state.initializedKey === key) return

  state.initializedKey = key
  state.mode = mode
  state.workItemId = workItemId ?? null
  state.notice = null
  state.cancelDialogOpen = false

  if (mode === 'create') {
    state.name = ''
    state.nature = '执行类'
    state.description = ''
    state.status = '启用'
    state.roles = []
    state.fieldModels = []
    return
  }

  const data = workItemId ? getPcsWorkItemEditorData(workItemId) : null
  if (!data) {
    state.name = ''
    state.nature = '执行类'
    state.description = ''
    state.status = '启用'
    state.roles = []
    state.fieldModels = []
    return
  }

  state.name = data.name
  state.nature = data.nature
  state.description = data.description
  state.status = data.status
  state.roles = [...data.roles]
  state.fieldModels = [...data.fieldModels]
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-work-item-editor-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  const isCreate = state.mode === 'create'
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-editor-action="go-list">
          <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回工作项库
        </button>
        <h1 class="text-xl font-semibold">${isCreate ? '新增工作项' : '编辑工作项'}</h1>
        <p class="text-sm text-muted-foreground">${isCreate ? '创建可复用的工作项定义，供模板和项目节点复用。' : `工作项编码：${escapeHtml(state.workItemId || '-')}`}</p>
      </div>
      ${!isCreate ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-editor-action="go-detail"><i data-lucide="eye" class="mr-1 h-3.5 w-3.5"></i>查看详情</button>` : ''}
    </header>
  `
}

function renderBasicInfo(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">工作项基础信息</h2>
      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">工作项名称 <span class="text-red-500">*</span></label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.name)}" placeholder="如：制版准备" data-pcs-work-item-editor-field="name" />
        </div>

        <div>
          <label class="mb-1 block text-xs text-muted-foreground">工作项状态</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-work-item-editor-field="status">
            <option value="启用" ${state.status === '启用' ? 'selected' : ''}>启用</option>
            <option value="停用" ${state.status === '停用' ? 'selected' : ''}>停用</option>
          </select>
        </div>

        <div class="md:col-span-2">
          <label class="mb-1 block text-xs text-muted-foreground">工作项类型 <span class="text-red-500">*</span></label>
          <div class="grid gap-2 sm:grid-cols-2">
            <button class="inline-flex h-9 items-center justify-center rounded-md border text-sm ${state.nature === '执行类' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-work-item-editor-action="set-nature" data-nature="执行类">执行类</button>
            <button class="inline-flex h-9 items-center justify-center rounded-md border text-sm ${state.nature === '决策类' ? 'border-orange-300 bg-orange-50 text-orange-700' : 'hover:bg-muted'}" data-pcs-work-item-editor-action="set-nature" data-nature="决策类">决策类</button>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">执行类：需要完成具体操作；决策类：需要做出判断和选择。</p>
        </div>

        <div class="md:col-span-2">
          <label class="mb-1 block text-xs text-muted-foreground">工作项说明</label>
          <textarea class="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="描述该工作项的业务含义和使用场景..." data-pcs-work-item-editor-field="description">${escapeHtml(state.description)}</textarea>
        </div>
      </div>
    </section>
  `
}

function renderFieldModelSection(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-1 text-sm font-semibold">默认字段模型配置</h2>
      <p class="mb-3 text-xs text-muted-foreground">定义该工作项默认需要填写的结构化字段。字段模型定义的是“结构”，不包含业务值。</p>
      <div class="flex flex-wrap gap-2">
        ${WORK_ITEM_FIELD_MODEL_OPTIONS.map((item) => `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs ${state.fieldModels.includes(item) ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-work-item-editor-action="toggle-field-model" data-value="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join('')}
      </div>
    </section>
  `
}

function renderRoleSection(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-1 text-sm font-semibold">默认执行角色 <span class="text-red-500">*</span></h2>
      <p class="mb-3 text-xs text-muted-foreground">选择负责执行此工作项的角色，可多选。</p>
      <div class="flex flex-wrap gap-2">
        ${WORK_ITEM_ROLE_OPTIONS.map((item) => `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs ${state.roles.includes(item) ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-work-item-editor-action="toggle-role" data-value="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join('')}
      </div>
    </section>
  `
}

function renderActionBar(): string {
  const submitText = state.mode === 'create' ? '创建工作项' : '保存修改'
  return `
    <section class="sticky bottom-0 z-20 rounded-lg border bg-background/95 p-3 backdrop-blur">
      <div class="flex items-center justify-end gap-2">
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-work-item-editor-action="open-cancel-dialog">取消</button>
        <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-work-item-editor-action="save">${submitText}</button>
      </div>
    </section>
  `
}

function renderCancelDialog(): string {
  if (!state.cancelDialogOpen) return ''

  return renderConfirmDialog(
    {
      title: '确认取消',
      description: '当前编辑内容不会保存，确定离开吗？',
      closeAction: { prefix: 'pcs-work-item-editor', action: 'close-cancel-dialog' },
      confirmAction: { prefix: 'pcs-work-item-editor', action: 'confirm-cancel', label: '确认离开' },
      cancelLabel: '继续编辑',
      danger: true,
      width: 'sm',
    }
  )
}

function validateBeforeSave(): string | null {
  if (!state.name.trim()) return '请填写工作项名称。'
  if (state.roles.length === 0) return '请至少选择一个执行角色。'
  return null
}

function saveWorkItem(): void {
  const error = validateBeforeSave()
  if (error) {
    state.notice = error
    return
  }

  const payload = {
    name: state.name,
    nature: state.nature,
    description: state.description,
    status: state.status,
    roles: [...state.roles],
    fieldModels: [...state.fieldModels],
  }

  if (state.mode === 'create') {
    const created = createPcsWorkItem(payload)
    appStore.navigate(`/pcs/work-items/${created.id}`)
    return
  }

  if (!state.workItemId) {
    state.notice = '缺少工作项编码，无法保存。'
    return
  }

  const updated = updatePcsWorkItem(state.workItemId, payload)
  if (!updated) {
    state.notice = '未找到待编辑工作项，无法保存。'
    return
  }

  appStore.navigate(`/pcs/work-items/${updated.id}`)
}

function toggleInArray(source: string[], value: string): string[] {
  if (source.includes(value)) return source.filter((item) => item !== value)
  return [...source, value]
}

export function renderPcsWorkItemCreatePage(): string {
  ensureInitialized('create')

  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderBasicInfo()}
      ${renderFieldModelSection()}
      ${renderRoleSection()}
      ${renderActionBar()}
      ${renderCancelDialog()}
    </div>
  `
}

export function renderPcsWorkItemEditPage(workItemId: string): string {
  ensureInitialized('edit', workItemId)

  if (!state.name && !state.workItemId) {
    return `
      <div class="space-y-4">
        <header>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-editor-action="go-list">
            <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回工作项库
          </button>
        </header>
        <section class="rounded-lg border border-dashed bg-card px-4 py-14 text-center text-muted-foreground">
          <i data-lucide="file-x-2" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
          <p class="mt-2">未找到工作项：${escapeHtml(workItemId)}</p>
        </section>
      </div>
    `
  }

  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderBasicInfo()}
      ${renderFieldModelSection()}
      ${renderRoleSection()}
      ${renderActionBar()}
      ${renderCancelDialog()}
    </div>
  `
}

export function handlePcsWorkItemEditorEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-work-item-editor-field]')
  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.pcsWorkItemEditorField
    if (field === 'name') {
      state.name = fieldNode.value
      return true
    }
  }

  if (fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.pcsWorkItemEditorField
    if (field === 'description') {
      state.description = fieldNode.value
      return true
    }
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsWorkItemEditorField
    if (field === 'status') {
      state.status = fieldNode.value === '停用' ? '停用' : '启用'
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-work-item-editor-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsWorkItemEditorAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'go-list') {
    appStore.navigate('/pcs/work-items')
    return true
  }

  if (action === 'go-detail') {
    if (!state.workItemId) return false
    appStore.navigate(`/pcs/work-items/${state.workItemId}`)
    return true
  }

  if (action === 'set-nature') {
    const nextNature = actionNode.dataset.nature
    if (nextNature === '执行类' || nextNature === '决策类') {
      state.nature = nextNature
      return true
    }
    return false
  }

  if (action === 'toggle-role') {
    const value = actionNode.dataset.value
    if (!value) return false
    state.roles = toggleInArray(state.roles, value)
    return true
  }

  if (action === 'toggle-field-model') {
    const value = actionNode.dataset.value
    if (!value) return false
    state.fieldModels = toggleInArray(state.fieldModels, value)
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
    const navTarget = state.mode === 'create' ? '/pcs/work-items' : `/pcs/work-items/${state.workItemId || ''}`
    state.cancelDialogOpen = false
    appStore.navigate(navTarget)
    return true
  }

  if (action === 'save') {
    saveWorkItem()
    return true
  }

  return false
}

export function isPcsWorkItemEditorDialogOpen(): boolean {
  return state.cancelDialogOpen
}
