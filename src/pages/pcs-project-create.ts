import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  getProjectWorkspaceCategoryCompatibilityNote,
  getProjectWorkspaceSourceHintText,
  listProjectWorkspaceSourceSummaries,
  listProjectWorkspaceSourceMappings,
} from '../data/pcs-project-config-workspace-adapter'
import {
  createEmptyProjectDraft,
  createProject,
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
import { buildTemplateBusinessSummary } from '../data/pcs-template-domain-view-model'
import type { PcsProjectCreateDraft, ProjectCreateCatalog } from '../data/pcs-project-types'

const FLASH_NOTICE_KEY = 'pcs_project_flash_notice'

interface ProjectCreatePageState {
  initialized: boolean
  form: PcsProjectCreateDraft
  notice: string | null
}

const state: ProjectCreatePageState = {
  initialized: false,
  form: createEmptyProjectDraft(),
  notice: null,
}

const PROJECT_CREATE_SOURCE_FIELD_KEYS = [
  'projectName',
  'templateId',
  'projectSourceType',
  'categoryId',
  'brandId',
  'styleCodeId',
  'styleTagIds',
  'crowdPositioningIds',
  'ageIds',
  'crowdIds',
  'productPositioningIds',
  'targetChannelCodes',
  'sampleSourceType',
  'sampleSupplierId',
  'sampleLink',
  'sampleUnitPrice',
  'ownerId',
  'teamId',
  'collaboratorIds',
  'priorityLevel',
  'remark',
] as const

function ensureInitialized(): void {
  if (state.initialized) return
  state.initialized = true
  state.form = createEmptyProjectDraft()
  state.notice = null
}

function resetState(): void {
  state.initialized = false
  state.form = createEmptyProjectDraft()
  state.notice = null
}

function getCatalog(): ProjectCreateCatalog {
  return getProjectCreateCatalog()
}

function setFlashNotice(message: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(FLASH_NOTICE_KEY, message)
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
  hint = '',
): string {
  return `
    <div>
      <label class="mb-1 block text-xs text-muted-foreground">${label}${required ? ' <span class="text-red-500">*</span>' : ''}</label>
      <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" data-pcs-project-create-field="${field}" />
      ${hint ? `<p class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(hint)}</p>` : ''}
    </div>
  `
}

function renderTextAreaField(
  label: string,
  field: string,
  value: string,
  placeholder: string,
  rows = 4,
  hint = '',
): string {
  return `
    <div>
      <label class="mb-1 block text-xs text-muted-foreground">${label}</label>
      <textarea class="min-h-[${rows * 24}px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="${escapeHtml(placeholder)}" data-pcs-project-create-field="${field}">${escapeHtml(value)}</textarea>
      ${hint ? `<p class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(hint)}</p>` : ''}
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
  hint = '',
): string {
  return `
    <div>
      <label class="mb-1 block text-xs text-muted-foreground">${label}${required ? ' <span class="text-red-500">*</span>' : ''}</label>
      <select class="h-9 w-full rounded-md border bg-background px-3 text-sm ${disabled ? 'cursor-not-allowed bg-muted/40' : ''}" data-pcs-project-create-field="${field}" ${disabled ? 'disabled' : ''}>
        ${renderSelectOptions(options, value, placeholder)}
      </select>
      ${hint ? `<p class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(hint)}</p>` : ''}
    </div>
  `
}

function renderToggleGroup(
  label: string,
  values: string[],
  selected: string[],
  field: string,
  hint = '',
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
      ${hint ? `<p class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(hint)}</p>` : ''}
    </div>
  `
}

function renderOptionToggleGroup(
  label: string,
  values: Array<{ value: string; label: string }>,
  selected: string[],
  field: string,
  hint = '',
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
      ${hint ? `<p class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(hint)}</p>` : ''}
    </div>
  `
}

function deriveProjectTypeByStyleType(styleType: string): string {
  if (styleType === '快时尚款') return '快反上新'
  if (styleType === '改版款') return '改版开发'
  if (styleType === '设计款') return '设计研发'
  return '商品开发'
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

  const summary = buildTemplateBusinessSummary(template)
  const closureClass =
    summary.closureStatus === '完整闭环'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : summary.closureStatus === '仅测款不转档'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-red-200 bg-red-50 text-red-700'

  return `
    <section class="rounded-lg border bg-muted/20 p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm font-medium">${escapeHtml(template.name)}</p>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(template.description)}</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${closureClass}">${escapeHtml(summary.closureStatus)}</span>
            ${summary.hasChannelProductListing ? '<span class="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">需要商品上架</span>' : '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">不含商品上架</span>'}
            ${summary.hasLiveTest ? '<span class="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">直播测款</span>' : ''}
            ${summary.hasVideoTest ? '<span class="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">短视频测款</span>' : ''}
          </div>
          ${
            hasTemplatePendingNodes(template)
              ? `<p class="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">当前模板存在未完成标准化的节点，请先处理模板中的待补充标准工作项。</p>`
              : ''
          }
          ${
            summary.issues.length > 0
              ? `<div class="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${summary.issues.map((item) => escapeHtml(item.message)).join('；')}</div>`
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
      <div class="mt-4 grid gap-3 md:grid-cols-2">
        <article class="rounded-lg border bg-background p-3">
          <p class="text-xs text-muted-foreground">测款路径说明</p>
          <div class="mt-2 flex flex-wrap gap-2">
            ${summary.pathFlags.map((item) => `<span class="inline-flex rounded-md border px-2 py-1 text-xs">${escapeHtml(item)}</span>`).join('')}
          </div>
        </article>
        <article class="rounded-lg border bg-background p-3">
          <p class="text-xs text-muted-foreground">阶段与节点预览</p>
          <div class="mt-2 space-y-2">
            ${summary.previewPhases
              .map(
                (phase) => `
                  <div>
                    <p class="text-sm font-medium">${escapeHtml(phase.phaseName)}</p>
                    <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(phase.nodeNames.join('、') || '当前未启用节点')}</p>
                  </div>
                `,
              )
              .join('')}
          </div>
        </article>
      </div>
    </section>
  `
}

function renderBasicSection(): string {
  const templates = listActiveProjectTemplates()
  const templateOptions = templates.map((template) => ({ value: template.id, label: template.name }))
  const sourceTypes = getCatalog().projectSourceTypes.map((item) => ({ value: item, label: item }))

  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">基础信息</h2>
      <div class="grid gap-3 md:grid-cols-2">
        ${renderInputField('项目名称', 'projectName', state.form.projectName, '请输入项目名称', true, 'text', getProjectWorkspaceSourceHintText('projectName'))}
        ${renderSelectField('项目来源类型', 'projectSourceType', state.form.projectSourceType, sourceTypes, '请选择项目来源类型', true, false, getProjectWorkspaceSourceHintText('projectSourceType'))}
        ${renderSelectField('项目模板', 'templateId', state.form.templateId, templateOptions, '请选择项目模板', true, false, getProjectWorkspaceSourceHintText('templateId'))}
      </div>
      <div class="mt-4">${renderTemplateSummary()}</div>
    </section>
  `
}

function renderCategorySection(): string {
  const catalog = getCatalog()
  const categoryOptions = catalog.categories.map((item) => ({ value: item.id, label: item.name }))
  const brandOptions = catalog.brands.map((item) => ({ value: item.id, label: item.name }))
  const styleCodeOptions = catalog.styleCodes.map((item) => ({ value: item.id, label: item.name }))
  const compatibilityNote = getProjectWorkspaceCategoryCompatibilityNote()
  const targetChannelNames = catalog.channelOptions
    .filter((item) => state.form.targetChannelCodes.includes(item.code))
    .map((item) => item.name)

  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">分类与定位</h2>
      <p class="mb-3 text-xs text-muted-foreground">配置工作台字段只标注真正来自配置工作台的维度；目标测款渠道继续来自渠道主数据。</p>
      <div class="grid gap-3 md:grid-cols-2">
        ${renderSelectField('品类', 'categoryId', state.form.categoryId, categoryOptions, '请选择品类', true, false, getProjectWorkspaceSourceHintText('categoryId'))}
        ${renderSelectField('品牌', 'brandId', state.form.brandId, brandOptions, '请选择品牌', true, false, getProjectWorkspaceSourceHintText('brandId'))}
        ${renderSelectField('风格编号', 'styleCodeId', state.form.styleCodeId, styleCodeOptions, '请选择风格编号', false, false, getProjectWorkspaceSourceHintText('styleCodeId'))}
      </div>
      <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(compatibilityNote)}</p>
      <div class="mt-4 grid gap-4">
        ${renderOptionToggleGroup(
          '风格标签',
          catalog.styles.map((item) => ({ value: item.id, label: item.name })),
          state.form.styleTagIds,
          'styleTagIds',
          getProjectWorkspaceSourceHintText('styleTagIds'),
        )}
        ${renderOptionToggleGroup(
          '人群定位',
          catalog.crowdPositioning.map((item) => ({ value: item.id, label: item.name })),
          state.form.crowdPositioningIds,
          'crowdPositioningIds',
          getProjectWorkspaceSourceHintText('crowdPositioningIds'),
        )}
        ${renderOptionToggleGroup(
          '年龄带',
          catalog.ages.map((item) => ({ value: item.id, label: item.name })),
          state.form.ageIds,
          'ageIds',
          getProjectWorkspaceSourceHintText('ageIds'),
        )}
        ${renderOptionToggleGroup(
          '人群',
          catalog.crowds.map((item) => ({ value: item.id, label: item.name })),
          state.form.crowdIds,
          'crowdIds',
          getProjectWorkspaceSourceHintText('crowdIds'),
        )}
        ${renderOptionToggleGroup(
          '商品定位',
          catalog.productPositioning.map((item) => ({ value: item.id, label: item.name })),
          state.form.productPositioningIds,
          'productPositioningIds',
          getProjectWorkspaceSourceHintText('productPositioningIds'),
        )}
        ${renderOptionToggleGroup(
          '目标渠道',
          catalog.channelOptions.map((item) => ({ value: item.code, label: item.name })),
          state.form.targetChannelCodes,
          'targetChannelCodes',
          getProjectWorkspaceSourceHintText('targetChannelCodes'),
        )}
        ${
          targetChannelNames.length > 0
            ? `<div class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">后续商品上架节点只允许从这些渠道中创建渠道商品：${escapeHtml(targetChannelNames.join('、'))}</div>`
            : ''
        }
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
      <p class="mb-3 text-xs text-muted-foreground">样衣来源方式沿用固定枚举；样衣来源方来自样衣供应商主数据；链接和单价继续按本地表单录入。</p>
      <div class="grid gap-3 md:grid-cols-2">
        ${renderSelectField('样衣来源方式', 'sampleSourceType', state.form.sampleSourceType, sampleSourceOptions, '请选择样衣来源方式', false, false, getProjectWorkspaceSourceHintText('sampleSourceType'))}
        ${renderSelectField('样衣来源方', 'sampleSupplierId', state.form.sampleSupplierId, supplierOptions, isExternal ? '请选择样衣来源方' : '可选', false, false, getProjectWorkspaceSourceHintText('sampleSupplierId'))}
        ${renderInputField('外采链接', 'sampleLink', state.form.sampleLink, isExternal ? '外采时建议填写链接' : '可选', false, 'url', getProjectWorkspaceSourceHintText('sampleLink'))}
        ${renderInputField('样衣单价', 'sampleUnitPrice', state.form.sampleUnitPrice, isExternal ? '外采时建议填写单价' : '可选', false, 'number', getProjectWorkspaceSourceHintText('sampleUnitPrice'))}
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
      <p class="mb-3 text-xs text-muted-foreground">负责人、执行团队、协作人来自本地组织主数据；优先级沿用固定枚举。</p>
      <div class="grid gap-3 md:grid-cols-2">
        ${renderSelectField('负责人', 'ownerId', state.form.ownerId, ownerOptions, '请选择负责人', true, false, getProjectWorkspaceSourceHintText('ownerId'))}
        ${renderSelectField('执行团队', 'teamId', state.form.teamId, teamOptions, '请选择执行团队', catalog.teams.length > 0, false, getProjectWorkspaceSourceHintText('teamId'))}
        ${renderSelectField('优先级', 'priorityLevel', state.form.priorityLevel, priorityOptions, '请选择优先级', false, false, getProjectWorkspaceSourceHintText('priorityLevel'))}
      </div>
      <div class="mt-4">
        ${renderOptionToggleGroup(
          '协作人',
          catalog.collaborators.map((item) => ({ value: item.id, label: item.name })),
          state.form.collaboratorIds,
          'collaboratorIds',
          getProjectWorkspaceSourceHintText('collaboratorIds'),
        )}
      </div>
    </section>
  `
}

function renderRemarkSection(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">备注</h2>
      <div class="grid gap-3">
        ${renderTextAreaField('备注', 'remark', state.form.remark, '请输入项目备注。', 4, getProjectWorkspaceSourceHintText('remark'))}
      </div>
    </section>
  `
}

function renderConfigSourceSection(): string {
  const mappings = listProjectWorkspaceSourceMappings().filter((item) =>
    PROJECT_CREATE_SOURCE_FIELD_KEYS.includes(item.fieldKey as (typeof PROJECT_CREATE_SOURCE_FIELD_KEYS)[number]),
  )
  const summaries = listProjectWorkspaceSourceSummaries([...PROJECT_CREATE_SOURCE_FIELD_KEYS])

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="mb-3 space-y-2">
        <h2 class="text-sm font-semibold">字段来源说明</h2>
        <p class="text-xs text-muted-foreground">这里只展示当前新增页真正使用的字段来源。能对到配置工作台的才标“配置工作台”，其余按渠道主数据、本地组织主数据、样衣供应商主数据、固定枚举或本地主数据如实标注。</p>
      </div>
      <div class="mb-4 flex flex-wrap gap-2">
        ${summaries
          .map(
            (item) =>
              `<span class="inline-flex rounded-full border px-2.5 py-1 text-xs ${item.sourceKind === '配置工作台' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-700'}">${escapeHtml(item.sourceKind)} · ${item.fieldCount} 个字段</span>`,
          )
          .join('')}
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${mappings
          .map(
            (item) => `
              <article class="rounded-lg border bg-muted/20 p-3">
                <p class="text-xs text-muted-foreground">${escapeHtml(item.fieldLabel)}</p>
                <p class="mt-1 text-sm font-medium">${escapeHtml(item.sourceKind)} / ${escapeHtml(item.sourceRef)}</p>
                <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.reason)}</p>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderActionBar(): string {
  const selectedTemplate = state.form.templateId ? getProjectTemplateById(state.form.templateId) : null
  const disabledByTemplate = selectedTemplate
    ? hasTemplatePendingNodes(selectedTemplate) || buildTemplateBusinessSummary(selectedTemplate).closureStatus === '配置异常'
    : false
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

function syncSimpleOption(field: 'brandId' | 'sampleSupplierId' | 'ownerId' | 'teamId' | 'styleCodeId'): void {
  const catalog = getCatalog()

  if (field === 'brandId') {
    state.form.brandName = catalog.brands.find((item) => item.id === state.form.brandId)?.name ?? ''
    return
  }
  if (field === 'styleCodeId') {
    state.form.styleCodeName = catalog.styleCodes.find((item) => item.id === state.form.styleCodeId)?.name ?? ''
    state.form.styleNumber = state.form.styleCodeName
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

function syncArrayOptionNames(
  idField:
    | 'styleTagIds'
    | 'crowdPositioningIds'
    | 'ageIds'
    | 'crowdIds'
    | 'productPositioningIds',
): void {
  const catalog = getCatalog()
  const mapping = {
    styleTagIds: {
      options: catalog.styles,
      nameField: 'styleTagNames',
      compatibility: 'styleTags',
    },
    crowdPositioningIds: {
      options: catalog.crowdPositioning,
      nameField: 'crowdPositioningNames',
    },
    ageIds: {
      options: catalog.ages,
      nameField: 'ageNames',
    },
    crowdIds: {
      options: catalog.crowds,
      nameField: 'crowdNames',
    },
    productPositioningIds: {
      options: catalog.productPositioning,
      nameField: 'productPositioningNames',
    },
  } as const
  const definition = mapping[idField]
  const selectedIds = state.form[idField]
  const names = definition.options.filter((item) => selectedIds.includes(item.id)).map((item) => item.name)
  ;(state.form as unknown as Record<string, string[]>)[definition.nameField] = names
  if (idField === 'styleTagIds') {
    state.form.styleTags = names
  }
  state.form.targetAudienceTags = Array.from(
    new Set([...state.form.crowdPositioningNames, ...state.form.ageNames, ...state.form.crowdNames]),
  )
}

function handleTemplateChanged(templateId: string): void {
  state.form.templateId = templateId
  const template = getProjectTemplateById(templateId)
  if (template) {
    state.form.styleType = template.styleType[0] ?? ''
    state.form.projectType = deriveProjectTypeByStyleType(state.form.styleType)
  } else {
    state.form.styleType = ''
    state.form.projectType = ''
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
  if (
    field === 'styleTagIds' ||
    field === 'crowdPositioningIds' ||
    field === 'ageIds' ||
    field === 'crowdIds' ||
    field === 'productPositioningIds'
  ) {
    syncArrayOptionNames(field)
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

  if (
    field === 'brandId' ||
    field === 'sampleSupplierId' ||
    field === 'ownerId' ||
    field === 'teamId' ||
    field === 'styleCodeId'
  ) {
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
      ${renderConfigSourceSection()}
      ${renderRemarkSection()}
      ${renderActionBar()}
    </div>
  `
}
