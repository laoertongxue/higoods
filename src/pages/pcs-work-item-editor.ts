import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  createPcsWorkItem,
  getPcsWorkItemEditorData,
  getProjectWorkItemOptions,
  updatePcsWorkItem,
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
  code: string
  name: string
  nature: WorkItemNature
  description: string
  status: WorkItemStatus
  phaseCode: string
  categoryName: string
  roleNames: string[]
  fieldGroupTitles: string[]
  fieldGroupsText: string
  canReuse: boolean
  canMultiInstance: boolean
  canRollback: boolean
  canParallel: boolean
  isSelectableForTemplate: boolean
  isBuiltin: boolean
  notice: string | null
  cancelDialogOpen: boolean
}

const state: WorkItemEditorState = {
  initializedKey: '',
  mode: 'create',
  workItemId: null,
  code: '',
  name: '',
  nature: '执行类',
  description: '',
  status: '启用',
  phaseCode: 'PHASE_01',
  categoryName: '',
  roleNames: [],
  fieldGroupTitles: [],
  fieldGroupsText: '',
  canReuse: false,
  canMultiInstance: false,
  canRollback: false,
  canParallel: false,
  isSelectableForTemplate: true,
  isBuiltin: false,
  notice: null,
  cancelDialogOpen: false,
}

function resetEditorState(): void {
  state.code = ''
  state.name = ''
  state.nature = '执行类'
  state.description = ''
  state.status = '启用'
  state.phaseCode = 'PHASE_01'
  state.categoryName = ''
  state.roleNames = []
  state.fieldGroupTitles = []
  state.fieldGroupsText = ''
  state.canReuse = false
  state.canMultiInstance = false
  state.canRollback = false
  state.canParallel = false
  state.isSelectableForTemplate = true
  state.isBuiltin = false
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
    resetEditorState()
    return
  }

  const data = workItemId ? getPcsWorkItemEditorData(workItemId) : null
  if (!data) {
    resetEditorState()
    state.workItemId = null
    return
  }

  state.code = data.code
  state.name = data.name
  state.nature = data.nature
  state.description = data.description
  state.status = data.status
  state.phaseCode = data.phaseCode
  state.categoryName = data.categoryName
  state.roleNames = [...data.roleNames]
  state.fieldGroupTitles = [...data.fieldGroupTitles]
  state.fieldGroupsText = data.fieldGroupTitles.join('\n')
  state.canReuse = data.canReuse
  state.canMultiInstance = data.canMultiInstance
  state.canRollback = data.canRollback
  state.canParallel = data.canParallel
  state.isBuiltin = data.isBuiltin
  state.isSelectableForTemplate = data.isSelectableForTemplate
}

function parseFieldGroupsText(value: string): string[] {
  return value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
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
        <h1 class="text-xl font-semibold">${isCreate ? '新增自定义工作项' : '编辑工作项'}</h1>
        <p class="text-sm text-muted-foreground">${isCreate ? '创建可供模板选择的自定义工作项正式定义。' : `当前工作项：${escapeHtml(state.name || state.workItemId || '-')}`}</p>
      </div>
      ${!isCreate && state.workItemId ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-editor-action="go-detail"><i data-lucide="eye" class="mr-1 h-3.5 w-3.5"></i>查看详情</button>` : ''}
    </header>
  `
}

function renderReadonlyIdentityNotice(): string {
  if (!state.isBuiltin) return ''
  return `
    <section class="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h2 class="text-sm font-semibold text-amber-800">内置工作项核心字段不可在页面修改</h2>
      <p class="mt-1 text-xs text-amber-700">正式编号、正式编码、正式名称、工作项性质、字段组和系统限制由统一定义层维护。页面仅展示，不允许改动。</p>
    </section>
  `
}

function renderInputField(
  label: string,
  field: string,
  value: string,
  placeholder: string,
  required = false,
  disabled = false,
): string {
  return `
    <div>
      <label class="mb-1 block text-xs text-muted-foreground">${label}${required ? ' <span class="text-red-500">*</span>' : ''}</label>
      <input class="h-9 w-full rounded-md border bg-background px-3 text-sm ${disabled ? 'cursor-not-allowed bg-muted/40' : ''}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" data-pcs-work-item-editor-field="${field}" ${disabled ? 'disabled' : ''} />
    </div>
  `
}

function renderSelectField(
  label: string,
  field: string,
  value: string,
  options: Array<{ value: string; label: string }>,
  placeholder: string,
  required = false,
  disabled = false,
): string {
  return `
    <div>
      <label class="mb-1 block text-xs text-muted-foreground">${label}${required ? ' <span class="text-red-500">*</span>' : ''}</label>
      <select class="h-9 w-full rounded-md border bg-background px-3 text-sm ${disabled ? 'cursor-not-allowed bg-muted/40' : ''}" data-pcs-work-item-editor-field="${field}" ${disabled ? 'disabled' : ''}>
        <option value="">${escapeHtml(placeholder)}</option>
        ${options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
      </select>
    </div>
  `
}

function renderBasicInfo(): string {
  const phaseOptions = getProjectWorkItemOptions()
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">工作项基础信息</h2>
      <div class="grid gap-3 md:grid-cols-2">
        ${renderInputField('正式编号', 'workItemId', state.workItemId ?? '系统生成', '系统生成', false, true)}
        ${renderInputField('正式编码', 'code', state.code || '系统生成', '系统生成', false, true)}
        ${renderInputField('正式名称', 'name', state.name, '如：渠道铺货确认', true, state.isBuiltin)}
        ${renderSelectField('所属阶段', 'phaseCode', state.phaseCode, phaseOptions, '请选择所属阶段', true, state.isBuiltin)}
        ${renderSelectField('工作项性质', 'nature', state.nature, [
          { value: '执行类', label: '执行类' },
          { value: '决策类', label: '决策类' },
          { value: '里程碑类', label: '里程碑类' },
          { value: '事实类', label: '事实类' },
        ], '请选择工作项性质', true, state.isBuiltin)}
        ${renderInputField('工作项类别', 'categoryName', state.categoryName, '如：商品开发 / 渠道准备', true, state.isBuiltin)}
        <div class="md:col-span-2">
          <label class="mb-1 block text-xs text-muted-foreground">工作项说明</label>
          <textarea class="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm ${state.isBuiltin ? 'cursor-not-allowed bg-muted/40' : ''}" placeholder="描述该工作项的业务含义和使用场景..." data-pcs-work-item-editor-field="description" ${state.isBuiltin ? 'disabled' : ''}>${escapeHtml(state.description)}</textarea>
        </div>
      </div>
    </section>
  `
}

function renderRoleSection(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-1 text-sm font-semibold">默认角色与字段组</h2>
      <p class="mb-3 text-xs text-muted-foreground">${state.isBuiltin ? '内置工作项的默认角色与字段组来自统一定义层。' : '自定义工作项需要补齐默认角色和字段组标题。'}</p>
      <div class="grid gap-4 lg:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">默认角色 <span class="text-red-500">*</span></label>
          <div class="flex flex-wrap gap-2 rounded-md border bg-background p-3">
            ${WORK_ITEM_ROLE_OPTIONS.map((item) => `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs ${state.roleNames.includes(item) ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'} ${state.isBuiltin ? 'pointer-events-none opacity-70' : ''}" data-pcs-work-item-editor-action="toggle-role" data-value="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join('')}
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">字段组标题</label>
          <textarea class="min-h-[160px] w-full rounded-md border bg-background px-3 py-2 text-sm ${state.isBuiltin ? 'cursor-not-allowed bg-muted/40' : ''}" placeholder="每行一个字段组标题，如：样衣来源信息" data-pcs-work-item-editor-field="fieldGroupsText" ${state.isBuiltin ? 'disabled' : ''}>${escapeHtml(state.fieldGroupsText)}</textarea>
        </div>
      </div>
    </section>
  `
}

function renderCapabilitySection(): string {
  const capabilityRows = [
    { field: 'canReuse', label: '是否可复用', value: state.canReuse },
    { field: 'canMultiInstance', label: '是否允许多次执行', value: state.canMultiInstance },
    { field: 'canRollback', label: '是否允许回退', value: state.canRollback },
    { field: 'canParallel', label: '是否允许并行', value: state.canParallel },
    { field: 'isSelectableForTemplate', label: '是否可供模板选择', value: state.isSelectableForTemplate },
  ]

  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-1 text-sm font-semibold">能力标记</h2>
      <p class="mb-3 text-xs text-muted-foreground">${state.isBuiltin ? '内置工作项的能力标记由统一定义层维护。' : '自定义工作项可按业务需要配置是否复用、多次执行和模板可选。'}</p>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${capabilityRows
          .map(
            (item) => `
              <label class="rounded-md border bg-background p-3 text-sm ${state.isBuiltin ? 'opacity-70' : ''}">
                <span class="flex items-center justify-between gap-3">
                  <span>${item.label}</span>
                  <input type="checkbox" class="h-4 w-4 rounded border" ${item.value ? 'checked' : ''} data-pcs-work-item-editor-field="${item.field}" ${state.isBuiltin ? 'disabled' : ''} />
                </span>
              </label>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderStatusSection(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">状态与说明</h2>
      <div class="grid gap-3 md:grid-cols-2">
        ${renderSelectField('状态', 'status', state.status, [
          { value: '启用', label: '启用' },
          { value: '停用', label: '停用' },
        ], '请选择状态', false, state.isBuiltin)}
        <div class="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
          ${state.isBuiltin ? '内置工作项不能在页面停用或改名；如需调整，请修改统一定义层。' : '自定义工作项保存后会形成完整正式定义对象，可在模板中选择。'}
        </div>
      </div>
    </section>
  `
}

function renderActionBar(): string {
  const submitText = state.mode === 'create' ? '创建工作项' : state.isBuiltin ? '返回详情' : '保存修改'
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
  return renderConfirmDialog({
    title: '确认取消',
    description: '当前编辑内容不会保存，确定离开吗？',
    closeAction: { prefix: 'pcs-work-item-editor', action: 'close-cancel-dialog' },
    confirmAction: { prefix: 'pcs-work-item-editor', action: 'confirm-cancel', label: '确认离开' },
    cancelLabel: '继续编辑',
    danger: true,
    width: 'sm',
  })
}

function validateBeforeSave(): string | null {
  if (state.isBuiltin) return null
  if (!state.name.trim()) return '请填写正式名称。'
  if (!state.phaseCode) return '请选择所属阶段。'
  if (!state.categoryName.trim()) return '请填写工作项类别。'
  if (state.roleNames.length === 0) return '请至少选择一个默认角色。'
  return null
}

function saveWorkItem(): void {
  if (state.isBuiltin && state.workItemId) {
    appStore.navigate(`/pcs/work-items/${state.workItemId}`)
    return
  }

  const error = validateBeforeSave()
  if (error) {
    state.notice = error
    return
  }

  const payload = {
    name: state.name.trim(),
    nature: state.nature,
    description: state.description.trim(),
    status: state.status,
    phaseCode: state.phaseCode,
    categoryName: state.categoryName.trim(),
    roleNames: [...state.roleNames],
    fieldGroupTitles: parseFieldGroupsText(state.fieldGroupsText),
    canReuse: state.canReuse,
    canMultiInstance: state.canMultiInstance,
    canRollback: state.canRollback,
    canParallel: state.canParallel,
    isSelectableForTemplate: state.isSelectableForTemplate,
  }

  if (state.mode === 'create') {
    const created = createPcsWorkItem(payload)
    appStore.navigate(`/pcs/work-items/${created.workItemId}`)
    return
  }

  if (!state.workItemId) {
    state.notice = '缺少工作项编号，无法保存。'
    return
  }

  const updated = updatePcsWorkItem(state.workItemId, payload)
  if (!updated) {
    state.notice = '未找到待编辑工作项，无法保存。'
    return
  }
  appStore.navigate(`/pcs/work-items/${updated.workItemId}`)
}

function toggleInArray(source: string[], value: string): string[] {
  return source.includes(value) ? source.filter((item) => item !== value) : [...source, value]
}

function renderPageBody(): string {
  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderReadonlyIdentityNotice()}
      ${renderBasicInfo()}
      ${renderRoleSection()}
      ${renderCapabilitySection()}
      ${renderStatusSection()}
      ${renderActionBar()}
      ${renderCancelDialog()}
    </div>
  `
}

export function renderPcsWorkItemCreatePage(): string {
  ensureInitialized('create')
  return renderPageBody()
}

export function renderPcsWorkItemEditPage(workItemId: string): string {
  ensureInitialized('edit', workItemId)

  if (!state.workItemId && !state.name) {
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

  return renderPageBody()
}

export function handlePcsWorkItemEditorEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-work-item-editor-field]')
  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.pcsWorkItemEditorField
    if (field === 'name') {
      state.name = fieldNode.value
      return true
    }
    if (field === 'categoryName') {
      state.categoryName = fieldNode.value
      return true
    }
    if (field === 'canReuse') {
      state.canReuse = fieldNode.checked
      return true
    }
    if (field === 'canMultiInstance') {
      state.canMultiInstance = fieldNode.checked
      return true
    }
    if (field === 'canRollback') {
      state.canRollback = fieldNode.checked
      return true
    }
    if (field === 'canParallel') {
      state.canParallel = fieldNode.checked
      return true
    }
    if (field === 'isSelectableForTemplate') {
      state.isSelectableForTemplate = fieldNode.checked
      return true
    }
  }

  if (fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.pcsWorkItemEditorField
    if (field === 'description') {
      state.description = fieldNode.value
      return true
    }
    if (field === 'fieldGroupsText') {
      state.fieldGroupsText = fieldNode.value
      return true
    }
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsWorkItemEditorField
    if (field === 'phaseCode') {
      state.phaseCode = fieldNode.value
      return true
    }
    if (field === 'status') {
      state.status = fieldNode.value === '停用' ? '停用' : '启用'
      return true
    }
    if (field === 'nature') {
      const nextValue = fieldNode.value
      if (nextValue === '决策类' || nextValue === '里程碑类' || nextValue === '事实类' || nextValue === '执行类') {
        state.nature = nextValue
        return true
      }
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-work-item-editor-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsWorkItemEditorAction
  if (!action) return false

  if (action === 'go-list') {
    appStore.navigate('/pcs/work-items')
    return true
  }

  if (action === 'go-detail' && state.workItemId) {
    appStore.navigate(`/pcs/work-items/${state.workItemId}`)
    return true
  }

  if (action === 'toggle-role') {
    if (state.isBuiltin) return true
    const value = actionNode.dataset.value
    if (!value) return false
    state.roleNames = toggleInArray(state.roleNames, value)
    return true
  }

  if (action === 'save') {
    saveWorkItem()
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
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
    appStore.navigate(state.workItemId ? `/pcs/work-items/${state.workItemId}` : '/pcs/work-items')
    return true
  }

  return false
}

export function isPcsWorkItemEditorDialogOpen(): boolean {
  return state.cancelDialogOpen
}
