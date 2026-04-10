import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  createEmptyProjectDraft,
  createProject,
  getProjectCategoryChildren,
  getProjectCreateCatalog,
  listActiveProjectTemplates,
} from '../data/pcs-project-repository'
import {
  countTemplatePendingNodes,
  countTemplateStages,
  countTemplateWorkItems,
  getProjectTemplateById,
  hasTemplatePendingNodes,
} from '../data/pcs-templates'
import type { PcsProjectCreateDraft, ProjectCreateCatalog } from '../data/pcs-project-types'

const FLASH_NOTICE_KEY = 'pcs_project_flash_notice'

interface ProjectCreatePageState {
  initialized: boolean
  form: PcsProjectCreateDraft
  referenceImagesText: string
  notice: string | null
}

const state: ProjectCreatePageState = {
  initialized: false,
  form: createEmptyProjectDraft(),
  referenceImagesText: '',
  notice: null,
}

function ensureInitialized(): void {
  if (state.initialized) return
  state.initialized = true
  state.form = createEmptyProjectDraft()
  state.referenceImagesText = ''
  state.notice = null
}

function resetState(): void {
  state.initialized = false
  state.form = createEmptyProjectDraft()
  state.referenceImagesText = ''
  state.notice = null
}

function getCatalog(): ProjectCreateCatalog {
  return getProjectCreateCatalog()
}

function setFlashNotice(message: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(FLASH_NOTICE_KEY, message)
}

function parseMultilineValues(value: string): string[] {
  return value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-red-200 bg-red-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-red-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-red-300 px-2 text-xs text-red-700 hover:bg-red-100" data-pcs-project-create-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-create-action="go-list">
          <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回商品项目列表
        </button>
        <h1 class="text-xl font-semibold">新建商品项目</h1>
        <p class="text-sm text-muted-foreground">完成立项基础信息录入后，系统将同步生成项目主记录、阶段记录和工作项节点。</p>
      </div>
      <div class="rounded-lg border bg-card px-4 py-3 text-right">
        <p class="text-xs text-muted-foreground">创建后系统自动生成</p>
        <p class="mt-1 text-sm font-medium">项目编号、当前阶段、项目状态</p>
      </div>
    </header>
  `
}

function renderSelectOptions(
  options: Array<{ value: string; label: string }>,
  currentValue: string,
  placeholder: string,
): string {
  return [
    `<option value="">${escapeHtml(placeholder)}</option>`,
    ...options.map(
      (option) =>
        `<option value="${escapeHtml(option.value)}" ${option.value === currentValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>`,
    ),
  ].join('')
}

function renderInputField(
  label: string,
  field: string,
  value: string,
  placeholder: string,
  required = false,
  type: 'text' | 'number' | 'url' = 'text',
): string {
  return `
    <div>
      <label class="mb-1 block text-xs text-muted-foreground">${label}${required ? ' <span class="text-red-500">*</span>' : ''}</label>
      <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" data-pcs-project-create-field="${field}" />
    </div>
  `
}

function renderTextAreaField(
  label: string,
  field: string,
  value: string,
  placeholder: string,
  rows = 4,
): string {
  return `
    <div>
      <label class="mb-1 block text-xs text-muted-foreground">${label}</label>
      <textarea class="min-h-[${rows * 24}px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="${escapeHtml(placeholder)}" data-pcs-project-create-field="${field}">${escapeHtml(value)}</textarea>
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
      <select class="h-9 w-full rounded-md border bg-background px-3 text-sm ${disabled ? 'cursor-not-allowed bg-muted/40' : ''}" data-pcs-project-create-field="${field}" ${disabled ? 'disabled' : ''}>
        ${renderSelectOptions(options, value, placeholder)}
      </select>
    </div>
  `
}

function renderToggleGroup(
  label: string,
  values: string[],
  selected: string[],
  field: string,
): string {
  return `
    <div>
      <label class="mb-1 block text-xs text-muted-foreground">${label}</label>
      <div class="flex flex-wrap gap-2">
        ${values
          .map((value) => {
            const active = selected.includes(value)
            return `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs ${active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-project-create-action="toggle-array" data-array-field="${escapeHtml(field)}" data-array-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`
          })
          .join('')}
      </div>
    </div>
  `
}

function renderOptionToggleGroup(
  label: string,
  values: Array<{ value: string; label: string }>,
  selected: string[],
  field: string,
): string {
  return `
    <div>
      <label class="mb-1 block text-xs text-muted-foreground">${label}</label>
      <div class="flex flex-wrap gap-2">
        ${values
          .map((value) => {
            const active = selected.includes(value.value)
            return `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs ${active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-project-create-action="toggle-array" data-array-field="${escapeHtml(field)}" data-array-value="${escapeHtml(value.value)}">${escapeHtml(value.label)}</button>`
          })
          .join('')}
      </div>
    </div>
  `
}

function renderTemplateSummary(): string {
  if (!state.form.templateId) {
    return `
      <section class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
        请选择项目模板，系统将按模板生成项目阶段和工作项节点。
      </section>
    `
  }

  const template = getProjectTemplateById(state.form.templateId)
  if (!template) {
    return `
      <section class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        未找到所选项目模板，请重新选择。
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-muted/20 p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm font-medium">${escapeHtml(template.name)}</p>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(template.description)}</p>
          ${
            hasTemplatePendingNodes(template)
              ? `<p class="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">当前模板存在未完成标准化的节点，请先处理模板中的待补充标准工作项。</p>`
              : ''
          }
        </div>
        <div class="grid gap-2 text-right text-xs text-muted-foreground">
          <p>适用款式：${template.styleType.map((item) => escapeHtml(item)).join('、')}</p>
          <p>阶段数：${countTemplateStages(template)} 个</p>
          <p>模板节点：${countTemplateWorkItems(template)} 个</p>
          <p>待补充标准工作项：${countTemplatePendingNodes(template)} 个</p>
        </div>
      </div>
    </section>
  `
}

function renderBasicSection(): string {
  const templates = listActiveProjectTemplates()
  const templateOptions = templates.map((template) => ({ value: template.id, label: template.name }))
  const projectTypes = getCatalog().projectTypes.map((item) => ({ value: item, label: item }))
  const sourceTypes = getCatalog().projectSourceTypes.map((item) => ({ value: item, label: item }))

  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">基础信息</h2>
      <div class="grid gap-3 md:grid-cols-2">
        ${renderInputField('项目名称', 'projectName', state.form.projectName, '请输入项目名称', true)}
        ${renderSelectField('项目类型', 'projectType', state.form.projectType, projectTypes, '请选择项目类型', true)}
        ${renderSelectField('项目来源类型', 'projectSourceType', state.form.projectSourceType, sourceTypes, '请选择项目来源类型', true)}
        ${renderSelectField('项目模板', 'templateId', state.form.templateId, templateOptions, '请选择项目模板', true)}
      </div>
      <div class="mt-4">${renderTemplateSummary()}</div>
    </section>
  `
}

function renderCategorySection(): string {
  const catalog = getCatalog()
  const categoryOptions = catalog.categories.map((item) => ({ value: item.id, label: item.name }))
  const secondaryOptions = getProjectCategoryChildren(state.form.categoryId).map((item) => ({
    value: item.id,
    label: item.name,
  }))
  const brandOptions = catalog.brands.map((item) => ({ value: item.id, label: item.name }))
  const styleTypeOptions = catalog.styleTypes.map((item) => ({ value: item, label: item }))
  const priceRangeOptions = catalog.priceRanges.map((item) => ({ value: item, label: item }))

  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">分类与定位</h2>
      <div class="grid gap-3 md:grid-cols-2">
        ${renderSelectField('一级分类', 'categoryId', state.form.categoryId, categoryOptions, '请选择一级分类', true)}
        ${renderSelectField('二级分类', 'subCategoryId', state.form.subCategoryId, secondaryOptions, state.form.categoryId ? '请选择二级分类' : '请先选择一级分类', false, !state.form.categoryId)}
        ${renderSelectField('品牌', 'brandId', state.form.brandId, brandOptions, '请选择品牌')}
        ${renderInputField('风格编号', 'styleNumber', state.form.styleNumber, '请输入风格编号')}
        ${renderSelectField('款式类型', 'styleType', state.form.styleType, styleTypeOptions, '请选择款式类型')}
        ${renderInputField('年份', 'yearTag', state.form.yearTag, '如：2026')}
        ${renderSelectField('价格带', 'priceRangeLabel', state.form.priceRangeLabel, priceRangeOptions, '请选择价格带')}
      </div>
      <div class="mt-4 grid gap-4">
        ${renderToggleGroup('季节标签', catalog.seasonTags, state.form.seasonTags, 'seasonTags')}
        ${renderToggleGroup('风格标签', catalog.styleTags, state.form.styleTags, 'styleTags')}
        ${renderToggleGroup('目标人群标签', catalog.targetAudienceTags, state.form.targetAudienceTags, 'targetAudienceTags')}
        ${renderOptionToggleGroup(
          '目标渠道',
          catalog.channelOptions.map((item) => ({ value: item.code, label: item.name })),
          state.form.targetChannelCodes,
          'targetChannelCodes',
        )}
      </div>
    </section>
  `
}

function renderSampleSection(): string {
  const catalog = getCatalog()
  const sampleSourceOptions = catalog.sampleSourceTypes.map((item) => ({ value: item, label: item }))
  const supplierOptions = catalog.sampleSuppliers.map((item) => ({ value: item.id, label: item.name }))
  const isExternal = state.form.sampleSourceType === '外采'

  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">样衣来源</h2>
      <div class="grid gap-3 md:grid-cols-2">
        ${renderSelectField('样衣来源方式', 'sampleSourceType', state.form.sampleSourceType, sampleSourceOptions, '请选择样衣来源方式')}
        ${renderSelectField('样衣来源方', 'sampleSupplierId', state.form.sampleSupplierId, supplierOptions, isExternal ? '请选择样衣来源方' : '可选')}
        ${renderInputField('外采链接', 'sampleLink', state.form.sampleLink, isExternal ? '外采时建议填写链接' : '可选', false, 'url')}
        ${renderInputField('样衣单价', 'sampleUnitPrice', state.form.sampleUnitPrice, isExternal ? '外采时建议填写单价' : '可选', false, 'number')}
      </div>
      <p class="mt-2 text-xs text-muted-foreground">当样衣来源方式为外采时，外采链接和样衣单价至少填写一项。</p>
    </section>
  `
}

function renderCollaborationSection(): string {
  const catalog = getCatalog()
  const ownerOptions = catalog.owners.map((item) => ({ value: item.id, label: item.name }))
  const teamOptions = catalog.teams.map((item) => ({ value: item.id, label: item.name }))
  const priorityOptions = catalog.priorityLevels.map((item) => ({ value: item, label: item }))

  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">协作信息</h2>
      <div class="grid gap-3 md:grid-cols-2">
        ${renderSelectField('负责人', 'ownerId', state.form.ownerId, ownerOptions, '请选择负责人', true)}
        ${renderSelectField('执行团队', 'teamId', state.form.teamId, teamOptions, '请选择执行团队', catalog.teams.length > 0)}
        ${renderSelectField('优先级', 'priorityLevel', state.form.priorityLevel, priorityOptions, '请选择优先级')}
      </div>
      <div class="mt-4">
        ${renderOptionToggleGroup(
          '协作人',
          catalog.collaborators.map((item) => ({ value: item.id, label: item.name })),
          state.form.collaboratorIds,
          'collaboratorIds',
        )}
      </div>
    </section>
  `
}

function renderRemarkSection(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">备注与附件</h2>
      <div class="grid gap-3">
        ${renderTextAreaField('参考图片', 'referenceImagesText', state.referenceImagesText, '请输入参考图片链接，每行一条。', 5)}
        ${renderTextAreaField('备注', 'remark', state.form.remark, '请输入项目备注。', 4)}
      </div>
    </section>
  `
}

function renderActionBar(): string {
  const selectedTemplate = state.form.templateId ? getProjectTemplateById(state.form.templateId) : null
  const disabledByTemplate = selectedTemplate ? hasTemplatePendingNodes(selectedTemplate) : false
  return `
    <section class="sticky bottom-0 z-20 rounded-lg border bg-background/95 p-3 backdrop-blur">
      <div class="flex items-center justify-end gap-2">
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-project-create-action="go-list">取消</button>
        <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50 ${disabledByTemplate ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-project-create-action="submit" ${disabledByTemplate ? 'disabled' : ''}>
          创建商品项目
        </button>
      </div>
    </section>
  `
}

function syncCategoryNames(): void {
  const category = getCatalog().categories.find((item) => item.id === state.form.categoryId)
  state.form.categoryName = category?.name ?? ''
  const subCategory = category?.children.find((item) => item.id === state.form.subCategoryId)
  state.form.subCategoryName = subCategory?.name ?? ''
}

function syncSimpleOption(field: 'brandId' | 'sampleSupplierId' | 'ownerId' | 'teamId'): void {
  const catalog = getCatalog()

  if (field === 'brandId') {
    state.form.brandName = catalog.brands.find((item) => item.id === state.form.brandId)?.name ?? ''
    return
  }
  if (field === 'sampleSupplierId') {
    state.form.sampleSupplierName =
      catalog.sampleSuppliers.find((item) => item.id === state.form.sampleSupplierId)?.name ?? ''
    return
  }
  if (field === 'ownerId') {
    state.form.ownerName = catalog.owners.find((item) => item.id === state.form.ownerId)?.name ?? ''
    return
  }
  state.form.teamName = catalog.teams.find((item) => item.id === state.form.teamId)?.name ?? ''
}

function syncCollaboratorNames(): void {
  const selected = getCatalog().collaborators.filter((item) => state.form.collaboratorIds.includes(item.id))
  state.form.collaboratorNames = selected.map((item) => item.name)
}

function handleTemplateChanged(templateId: string): void {
  state.form.templateId = templateId
  const template = getProjectTemplateById(templateId)
  if (template && !state.form.styleType) {
    state.form.styleType = template.styleType[0] ?? ''
  }
}

function toggleArrayValue(field: keyof PcsProjectCreateDraft, value: string): void {
  const currentValue = state.form[field]
  if (!Array.isArray(currentValue)) return
  const nextValues = currentValue.includes(value)
    ? currentValue.filter((item) => item !== value)
    : [...currentValue, value]
  ;(state.form as unknown as Record<string, unknown>)[field] = nextValues
  if (field === 'collaboratorIds') {
    syncCollaboratorNames()
  }
}

function submitCreate(): void {
  try {
    const result = createProject(state.form, state.form.ownerName || '当前用户')
    const message = `项目已创建，已生成项目主记录、${result.phases.length} 个阶段记录、${result.nodes.length} 个节点记录，所用模板版本：${result.project.templateVersion}。`
    setFlashNotice(message)
    resetState()
    appStore.navigate(`/pcs/projects/${result.project.projectId}`)
  } catch (error) {
    state.notice = error instanceof Error ? error.message : '创建商品项目失败，请重试。'
  }
}

export function handlePcsProjectCreateEvent(target: HTMLElement): boolean {
  ensureInitialized()
  const actionNode = target.closest<HTMLElement>('[data-pcs-project-create-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsProjectCreateAction
  if (!action) return false

  if (action === 'go-list') {
    resetState()
    appStore.navigate('/pcs/projects')
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'toggle-array') {
    const field = actionNode.dataset.arrayField as keyof PcsProjectCreateDraft | undefined
    const value = actionNode.dataset.arrayValue
    if (field && value) {
      toggleArrayValue(field, value)
    }
    return true
  }

  if (action === 'submit') {
    submitCreate()
    return true
  }

  return false
}

export function handlePcsProjectCreateInput(target: Element): boolean {
  ensureInitialized()
  const field = (target as HTMLElement).dataset.pcsProjectCreateField
  if (!field) return false
  const value = (target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value

  if (field === 'referenceImagesText') {
    state.referenceImagesText = value
    state.form.projectAlbumUrls = parseMultilineValues(value)
    return true
  }

  if (field === 'templateId') {
    handleTemplateChanged(value)
    return true
  }

  if (field === 'categoryId') {
    state.form.categoryId = value
    state.form.subCategoryId = ''
    syncCategoryNames()
    return true
  }

  if (field === 'subCategoryId') {
    state.form.subCategoryId = value
    syncCategoryNames()
    return true
  }

  if (field === 'brandId' || field === 'sampleSupplierId' || field === 'ownerId' || field === 'teamId') {
    ;(state.form as unknown as Record<string, string>)[field] = value
    syncSimpleOption(field)
    return true
  }

  ;(state.form as unknown as Record<string, string>)[field] = value
  return true
}

export function isPcsProjectCreateDialogOpen(): boolean {
  return false
}

export function renderPcsProjectCreatePage(): string {
  ensureInitialized()

  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderBasicSection()}
      ${renderCategorySection()}
      ${renderSampleSection()}
      ${renderCollaborationSection()}
      ${renderRemarkSection()}
      ${renderActionBar()}
    </div>
  `
}
