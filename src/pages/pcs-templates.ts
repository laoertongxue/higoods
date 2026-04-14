import { appStore } from '../state/store.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'
import {
  copyProjectTemplate,
  countTemplateStages,
  countTemplateWorkItems,
  createProjectTemplate,
  getProjectTemplateById,
  getStatusLabel,
  listProjectTemplates,
  toggleProjectTemplateStatus,
  updateProjectTemplate,
  type ProjectTemplate,
  type TemplateStatusCode,
  type TemplateStyleType,
} from '../data/pcs-templates.ts'
import type {
  ProjectTemplateNodeDefinition,
  ProjectTemplatePendingNode,
  ProjectTemplateStageDefinition,
} from '../data/pcs-project-definition-normalizer.ts'
import { buildBuiltinProjectTemplateMatrix, listProjectTemplateSchemas } from '../data/pcs-project-domain-contract.ts'
import { getPcsWorkItemDefinition, listSelectableTemplateWorkItems } from '../data/pcs-work-items.ts'
import { buildTemplateBusinessSummary, buildTemplateTripletNote, getTemplateNodeEditRule } from '../data/pcs-template-domain-view-model.ts'

type TemplateStatusFilter = '全部状态' | '启用' | '停用'
type TemplateEditorMode = 'create' | 'edit'

interface TemplateListState {
  search: string
  styleType: string
  status: TemplateStatusFilter
}

interface TemplateEditorState {
  routeKey: string
  mode: TemplateEditorMode
  templateId: string | null
  templateName: string
  styleType: TemplateStyleType
  description: string
  status: TemplateStatusCode
  stages: ProjectTemplateStageDefinition[]
  nodes: ProjectTemplateNodeDefinition[]
  pendingNodes: ProjectTemplatePendingNode[]
  expandedStages: Record<string, boolean>
  selectorStagePhaseCode: string | null
  selectorSelectedIds: string[]
  error: string | null
}

interface TemplatePageState {
  list: TemplateListState
  notice: string | null
  confirmToggleTemplateId: string | null
  cancelDialogOpen: boolean
  editor: TemplateEditorState
}

const STYLE_TYPE_OPTIONS: TemplateStyleType[] = ['基础款', '快时尚款', '改版款', '设计款']
const STATUS_FILTER_OPTIONS: TemplateStatusFilter[] = ['全部状态', '启用', '停用']

const initialListState: TemplateListState = {
  search: '',
  styleType: '全部款式类型',
  status: '全部状态',
}

function createEmptyEditorState(): TemplateEditorState {
  return {
    routeKey: '',
    mode: 'create',
    templateId: null,
    templateName: '',
    styleType: '基础款',
    description: '',
    status: 'active',
    stages: [],
    nodes: [],
    pendingNodes: [],
    expandedStages: {},
    selectorStagePhaseCode: null,
    selectorSelectedIds: [],
    error: null,
  }
}

const state: TemplatePageState = {
  list: { ...initialListState },
  notice: null,
  confirmToggleTemplateId: null,
  cancelDialogOpen: false,
  editor: createEmptyEditorState(),
}

function cloneStage(stage: ProjectTemplateStageDefinition): ProjectTemplateStageDefinition {
  return { ...stage }
}

function cloneNode(node: ProjectTemplateNodeDefinition): ProjectTemplateNodeDefinition {
  return {
    ...node,
    roleOverrideCodes: [...node.roleOverrideCodes],
    roleOverrideNames: [...node.roleOverrideNames],
  }
}

function clonePendingNode(node: ProjectTemplatePendingNode): ProjectTemplatePendingNode {
  return { ...node }
}

function resetListState(): void {
  state.list = { ...initialListState }
}

function clearEditorState(): void {
  state.editor = createEmptyEditorState()
  state.cancelDialogOpen = false
}

function closeAllDialogs(): void {
  state.confirmToggleTemplateId = null
  state.cancelDialogOpen = false
  state.editor.selectorStagePhaseCode = null
  state.editor.selectorSelectedIds = []
}

function getCurrentQueryParams(): URLSearchParams {
  const [, search = ''] = appStore.getState().pathname.split('?')
  return new URLSearchParams(search)
}

function normalizeStyleType(value: string | null): TemplateStyleType | null {
  return STYLE_TYPE_OPTIONS.find((item) => item === value) ?? null
}

function getSchemaByStyleType(styleType: TemplateStyleType) {
  return listProjectTemplateSchemas().find((item) => item.styleTypes.includes(styleType)) ?? null
}

function createExpandedStageMap(stages: ProjectTemplateStageDefinition[]): Record<string, boolean> {
  return Object.fromEntries(stages.map((stage) => [stage.phaseCode, true]))
}

function buildRecommendedDraft(styleType: TemplateStyleType): {
  stages: ProjectTemplateStageDefinition[]
  nodes: ProjectTemplateNodeDefinition[]
} {
  const schema = getSchemaByStyleType(styleType)
  if (!schema) {
    throw new Error(`未找到款式类型 ${styleType} 的正式模板矩阵。`)
  }

  const matrix = buildBuiltinProjectTemplateMatrix().find((item) => item.templateId === schema.templateId)
  if (!matrix) {
    throw new Error(`未找到模板 ${schema.templateId} 的正式阶段矩阵。`)
  }

  const stages = matrix.stages.map((stage) => ({
    templateStageId: '',
    templateId: '',
    phaseCode: stage.phaseCode,
    phaseName: stage.phaseName,
    phaseOrder: stage.phaseOrder,
    requiredFlag: stage.requiredFlag,
    description: stage.description,
  }))

  const nodes = matrix.nodes.map((node) => {
    const rule = getTemplateNodeEditRule(styleType, node.workItemTypeCode)
    return {
      templateNodeId: '',
      templateId: '',
      templateStageId: '',
      phaseCode: node.phaseCode,
      phaseName: node.phaseName,
      workItemId: node.workItemId,
      workItemTypeCode: node.workItemTypeCode,
      workItemTypeName: node.workItemTypeName,
      sequenceNo: node.sequenceNo,
      enabledFlag: true,
      requiredFlag: rule.optional ? false : node.requiredFlag,
      multiInstanceFlag: node.multiInstanceFlag,
      roleOverrideCodes: [],
      roleOverrideNames: [],
      note: node.note,
      sourceWorkItemUpdatedAt: node.sourceWorkItemUpdatedAt,
      templateVersion: '',
    }
  })

  return { stages, nodes }
}

function setEditorDraft(input: {
  routeKey: string
  mode: TemplateEditorMode
  templateId: string | null
  templateName: string
  styleType: TemplateStyleType
  description: string
  status: TemplateStatusCode
  stages: ProjectTemplateStageDefinition[]
  nodes: ProjectTemplateNodeDefinition[]
  pendingNodes: ProjectTemplatePendingNode[]
}): void {
  state.editor = {
    routeKey: input.routeKey,
    mode: input.mode,
    templateId: input.templateId,
    templateName: input.templateName,
    styleType: input.styleType,
    description: input.description,
    status: input.status,
    stages: input.stages.map(cloneStage),
    nodes: input.nodes.map(cloneNode),
    pendingNodes: input.pendingNodes.map(clonePendingNode),
    expandedStages: createExpandedStageMap(input.stages),
    selectorStagePhaseCode: null,
    selectorSelectedIds: [],
    error: null,
  }
}

function ensureEditorState(mode: TemplateEditorMode, templateId?: string): void {
  const queryParams = getCurrentQueryParams()
  const routeKey = `${mode}:${templateId ?? 'new'}:${queryParams.toString()}`
  if (state.editor.routeKey === routeKey) return

  if (mode === 'edit') {
    const template = templateId ? getProjectTemplateById(templateId) : null
    if (!template) {
      state.editor = {
        ...createEmptyEditorState(),
        routeKey,
        mode,
        templateId: templateId ?? null,
      }
      return
    }

    setEditorDraft({
      routeKey,
      mode,
      templateId: template.id,
      templateName: template.name,
      styleType: template.styleType[0] ?? '基础款',
      description: template.description,
      status: template.status,
      stages: template.stages,
      nodes: template.nodes,
      pendingNodes: template.pendingNodes,
    })
    return
  }

  const preferredStyleType = normalizeStyleType(queryParams.get('styleType')) ?? '基础款'
  const recommendedDraft = buildRecommendedDraft(preferredStyleType)
  setEditorDraft({
    routeKey,
    mode,
    templateId: null,
    templateName: '',
    styleType: preferredStyleType,
    description: '',
    status: 'active',
    stages: recommendedDraft.stages,
    nodes: recommendedDraft.nodes,
    pendingNodes: [],
  })
}

function applyRecommendedDraft(styleType: TemplateStyleType): void {
  const recommendedDraft = buildRecommendedDraft(styleType)
  state.editor.styleType = styleType
  state.editor.stages = recommendedDraft.stages
  state.editor.nodes = recommendedDraft.nodes
  state.editor.pendingNodes = []
  state.editor.expandedStages = createExpandedStageMap(recommendedDraft.stages)
  state.editor.selectorStagePhaseCode = null
  state.editor.selectorSelectedIds = []
  state.editor.error = null
}

function getTemplates(): ProjectTemplate[] {
  return listProjectTemplates()
}

function getFilteredTemplates(): ProjectTemplate[] {
  const keyword = state.list.search.trim().toLowerCase()
  return getTemplates().filter((template) => {
    const matchesKeyword =
      keyword.length === 0 ||
      [template.id, template.name, template.creator, template.description].join(' ').toLowerCase().includes(keyword)
    const matchesStyleType =
      state.list.styleType === '全部款式类型' || template.styleType.includes(state.list.styleType as TemplateStyleType)
    const matchesStatus = state.list.status === '全部状态' || getStatusLabel(template.status) === state.list.status
    return matchesKeyword && matchesStyleType && matchesStatus
  })
}

function getNatureBadgeClass(nature: string): string {
  if (nature === '决策类') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (nature === '执行类') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (nature === '里程碑类') return 'border-violet-200 bg-violet-50 text-violet-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function getStatusBadgeClass(status: TemplateStatusCode): string {
  return status === 'inactive' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'
}

function getConfirmTemplate(): ProjectTemplate | null {
  return state.confirmToggleTemplateId ? getProjectTemplateById(state.confirmToggleTemplateId) : null
}

function getNodeKey(node: Pick<ProjectTemplateNodeDefinition, 'phaseCode' | 'workItemId'>): string {
  return `${node.phaseCode}::${node.workItemId}`
}

function getStageNodes(phaseCode: string, includeDisabled = true): ProjectTemplateNodeDefinition[] {
  return state.editor.nodes
    .filter((node) => node.phaseCode === phaseCode && (includeDisabled || node.enabledFlag !== false))
    .sort((a, b) => a.sequenceNo - b.sequenceNo)
}

function getTemplateStageNodes(template: ProjectTemplate, phaseCode: string, includeDisabled = true): ProjectTemplateNodeDefinition[] {
  return template.nodes
    .filter((node) => node.phaseCode === phaseCode && (includeDisabled || node.enabledFlag !== false))
    .sort((a, b) => a.sequenceNo - b.sequenceNo)
}

function getDefaultRoleNames(node: Pick<ProjectTemplateNodeDefinition, 'workItemId'>): string[] {
  return getPcsWorkItemDefinition(node.workItemId)?.roleNames ?? []
}

function getEffectiveRoleNames(node: ProjectTemplateNodeDefinition): string[] {
  return node.roleOverrideNames.length > 0 ? [...node.roleOverrideNames] : getDefaultRoleNames(node)
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((item, index) => item === right[index])
}

function sortLabels(values: string[]): string[] {
  return values.slice().sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

function getEditorRoleCatalog(): string[] {
  const roleSet = new Set<string>()
  listSelectableTemplateWorkItems().forEach((item) => {
    item.roleNames.forEach((role) => roleSet.add(role))
  })
  state.editor.nodes.forEach((node) => {
    getEffectiveRoleNames(node).forEach((role) => roleSet.add(role))
  })
  return sortLabels(Array.from(roleSet))
}

function getFieldTemplateLabels(workItemId: string): string[] {
  const definition = getPcsWorkItemDefinition(workItemId)
  if (!definition) return []
  return Array.from(
    new Set(definition.fieldGroups.map((group) => group.title).filter(Boolean)),
  )
}

function getEditorStage(phaseCode: string): ProjectTemplateStageDefinition | null {
  return state.editor.stages.find((stage) => stage.phaseCode === phaseCode) ?? null
}

function getStageSelectorItems(phaseCode: string) {
  const schema = getSchemaByStyleType(state.editor.styleType)
  const phaseSchema = schema?.phaseSchemas.find((item) => item.phaseCode === phaseCode)
  const allowedCodes = new Set(phaseSchema?.nodeCodes ?? [])
  return listSelectableTemplateWorkItems(phaseCode)
    .filter((item) => allowedCodes.has(item.workItemTypeCode as never))
    .filter((item) => {
      const existingNode = state.editor.nodes.find((node) => node.phaseCode === phaseCode && node.workItemId === item.workItemId)
      return !existingNode || existingNode.enabledFlag === false
    })
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-blue-300 bg-white px-3 text-xs text-blue-700 hover:bg-blue-100" data-pcs-template-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderListHeader(): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs text-slate-500">商品中心 / 模板配置</p>
        <h1 class="mt-2 text-2xl font-semibold text-slate-900">商品项目模板</h1>
        <p class="mt-1 text-sm text-slate-500">管理商品项目模板，快速生成标准化流程结构。</p>
      </div>
      <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-nav="/pcs/templates/new">
        <i data-lucide="plus" class="h-4 w-4"></i>新增模板
      </button>
    </header>
  `
}

function renderListFilters(): string {
  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="grid gap-4 md:grid-cols-4">
        <label class="space-y-1">
          <span class="text-xs text-slate-500">搜索模板名称</span>
          <input
            class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="搜索模板名称"
            value="${escapeHtml(state.list.search)}"
            data-pcs-template-field="list-search"
          />
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">适用款式类型</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-template-field="list-styleType">
            <option value="全部款式类型" ${state.list.styleType === '全部款式类型' ? 'selected' : ''}>全部款式类型</option>
            ${STYLE_TYPE_OPTIONS.map(
              (option) =>
                `<option value="${escapeHtml(option)}" ${state.list.styleType === option ? 'selected' : ''}>${escapeHtml(option)}</option>`,
            ).join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">状态</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-template-field="list-status">
            ${STATUS_FILTER_OPTIONS.map(
              (option) =>
                `<option value="${escapeHtml(option)}" ${state.list.status === option ? 'selected' : ''}>${escapeHtml(option)}</option>`,
            ).join('')}
          </select>
        </label>
        <div class="flex items-end">
          <button type="button" class="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" data-pcs-template-action="list-reset">重置</button>
        </div>
      </div>
    </section>
  `
}

function renderListTable(): string {
  const templates = getFilteredTemplates()

  return `
    <section class="overflow-hidden rounded-lg border bg-white">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50">
            <tr class="border-b border-slate-200 text-left text-slate-600">
              <th class="px-4 py-3 font-medium">模板名称</th>
              <th class="px-4 py-3 font-medium">适用款式类型</th>
              <th class="px-4 py-3 text-center font-medium">阶段数量</th>
              <th class="px-4 py-3 text-center font-medium">工作项数量</th>
              <th class="px-4 py-3 font-medium">创建人</th>
              <th class="px-4 py-3 font-medium">最近更新时间</th>
              <th class="px-4 py-3 text-center font-medium">状态</th>
              <th class="px-4 py-3 text-center font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${
              templates.length === 0
                ? `
                  <tr>
                    <td colspan="8" class="px-4 py-16 text-center">
                      <p class="text-sm font-medium text-slate-700">未找到符合条件的模板</p>
                      <p class="mt-1 text-xs text-slate-500">可以调整搜索词、款式类型或状态后重新查看。</p>
                    </td>
                  </tr>
                `
                : templates
                    .map(
                      (template) => `
                        <tr class="hover:bg-slate-50">
                          <td class="px-4 py-3 align-top">
                            <button type="button" class="text-left text-sm font-medium text-blue-700 hover:underline" data-nav="/pcs/templates/${escapeHtml(template.id)}">${escapeHtml(template.name)}</button>
                            <p class="mt-1 text-xs text-slate-400">${escapeHtml(template.id)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <div class="flex flex-wrap gap-1.5">
                              ${template.styleType
                                .map(
                                  (item) =>
                                    `<span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(item)}</span>`,
                                )
                                .join('')}
                            </div>
                          </td>
                          <td class="px-4 py-3 text-center align-top text-slate-700">${countTemplateStages(template)}</td>
                          <td class="px-4 py-3 text-center align-top text-slate-700">${countTemplateWorkItems(template)}</td>
                          <td class="px-4 py-3 align-top text-slate-700">${escapeHtml(template.creator)}</td>
                          <td class="px-4 py-3 align-top text-slate-500">${escapeHtml(formatDateTime(template.updatedAt))}</td>
                          <td class="px-4 py-3 align-top text-center">
                            <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getStatusBadgeClass(template.status)}">${escapeHtml(getStatusLabel(template.status))}</span>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <div class="flex flex-wrap justify-center gap-2">
                              <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/templates/${escapeHtml(template.id)}/edit">编辑</button>
                              <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-template-action="copy-template" data-template-id="${escapeHtml(template.id)}">复制</button>
                              <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-template-action="open-toggle" data-template-id="${escapeHtml(template.id)}">${template.status === 'active' ? '停用' : '启用'}</button>
                            </div>
                          </td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
      <div class="border-t border-slate-200 px-4 py-3 text-sm text-slate-500">共 ${templates.length} 个模板</div>
    </section>
  `
}

function renderBaseInfoCard(label: string, value: string, helper?: string): string {
  return `
    <article class="rounded-lg border bg-white p-4">
      <p class="text-xs text-slate-500">${escapeHtml(label)}</p>
      <p class="mt-2 text-sm font-medium text-slate-900">${escapeHtml(value || '-')}</p>
      ${helper ? `<p class="mt-1 text-xs leading-5 text-slate-500">${escapeHtml(helper)}</p>` : ''}
    </article>
  `
}

function renderDetailSummary(template: ProjectTemplate): string {
  const summary = buildTemplateBusinessSummary(template)

  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      ${renderBaseInfoCard('适用款式类型', template.styleType.join(' / '))}
      ${renderBaseInfoCard('阶段数量', String(countTemplateStages(template)))}
      ${renderBaseInfoCard('工作项数量', String(countTemplateWorkItems(template)))}
      ${renderBaseInfoCard('状态', getStatusLabel(template.status))}
      ${renderBaseInfoCard('创建人', template.creator)}
      ${renderBaseInfoCard('创建时间', formatDateTime(template.createdAt))}
      ${renderBaseInfoCard('最近更新时间', formatDateTime(template.updatedAt))}
      ${renderBaseInfoCard('业务闭环', summary.closureStatus, summary.closureText)}
    </section>
  `
}

function renderBusinessSections(template: ProjectTemplate): string {
  const summary = buildTemplateBusinessSummary(template)
  const issues = summary.issues

  return `
    <section class="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <article class="rounded-lg border bg-white p-4">
        <h2 class="text-lg font-semibold text-slate-900">模板说明</h2>
        <p class="mt-3 text-sm leading-6 text-slate-700">${escapeHtml(template.description)}</p>
        <div class="mt-4 flex flex-wrap gap-2">
          ${summary.pathFlags
            .map(
              (flag) =>
                `<span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">${escapeHtml(flag)}</span>`,
            )
            .join('')}
        </div>
        <div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p class="text-xs text-slate-500">三码关系说明</p>
          <p class="mt-2 text-sm leading-6 text-slate-700">${escapeHtml(buildTemplateTripletNote())}</p>
        </div>
      </article>
      <article class="rounded-lg border bg-white p-4">
        <h2 class="text-lg font-semibold text-slate-900">业务链路摘要</h2>
        <p class="mt-3 text-sm leading-6 text-slate-700">${escapeHtml(summary.scenarioSummary)}</p>
        ${
          issues.length === 0
            ? `<div class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">当前模板结构满足正式矩阵校验，可直接用于商品项目建模。</div>`
            : `
              <div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p class="text-sm font-medium text-amber-800">存在 ${issues.length} 项配置提醒</p>
                <ul class="mt-2 space-y-2 text-sm text-amber-700">
                  ${issues.map((issue) => `<li>• ${escapeHtml(issue.message)}</li>`).join('')}
                </ul>
              </div>
            `
        }
      </article>
    </section>
  `
}

function renderPendingNodes(template: ProjectTemplate): string {
  if (template.pendingNodes.length === 0) return ''

  return `
    <section class="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h2 class="text-sm font-semibold text-amber-800">待补充映射工作项</h2>
      <div class="mt-3 overflow-x-auto rounded-lg border border-amber-200 bg-white">
        <table class="min-w-full text-sm">
          <thead class="bg-amber-50 text-left text-amber-800">
            <tr>
              <th class="px-4 py-3 font-medium">旧阶段</th>
              <th class="px-4 py-3 font-medium">旧工作项</th>
              <th class="px-4 py-3 font-medium">未映射原因</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-amber-100">
            ${template.pendingNodes
              .map(
                (node) => `
                  <tr>
                    <td class="px-4 py-3">${escapeHtml(node.legacyStageName)}</td>
                    <td class="px-4 py-3">${escapeHtml(node.legacyWorkItemName)}</td>
                    <td class="px-4 py-3 text-amber-700">${escapeHtml(node.unresolvedReason)}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderTemplateWorkItemRows(template: ProjectTemplate, stage: ProjectTemplateStageDefinition): string {
  const nodes = getTemplateStageNodes(template, stage.phaseCode, false)
  const disabledCount = getTemplateStageNodes(template, stage.phaseCode, true).filter((node) => node.enabledFlag === false).length

  return `
    <article class="rounded-lg border bg-white p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-base font-semibold text-slate-900">${escapeHtml(`${String(stage.phaseOrder).padStart(2, '0')} ${stage.phaseName}`)}</h3>
            <span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">${stage.requiredFlag ? '必经' : '可跳过'}</span>
            ${disabledCount > 0 ? `<span class="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">已停用 ${disabledCount} 项</span>` : ''}
          </div>
          <p class="mt-2 text-sm text-slate-500">${escapeHtml(stage.description)}</p>
        </div>
        <div class="rounded-lg border bg-slate-50 px-3 py-2 text-right">
          <p class="text-xs text-slate-500">当前启用工作项</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">${nodes.length}</p>
        </div>
      </div>
      <div class="mt-4 overflow-x-auto rounded-lg border">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50 text-left text-slate-600">
            <tr>
              <th class="px-4 py-3 font-medium">工作项名称</th>
              <th class="px-4 py-3 font-medium">类型</th>
              <th class="px-4 py-3 font-medium">必做 / 可选</th>
              <th class="px-4 py-3 font-medium">执行角色</th>
              <th class="px-4 py-3 font-medium">字段模板</th>
              <th class="px-4 py-3 font-medium">说明</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${
              nodes.length === 0
                ? `
                  <tr>
                    <td colspan="6" class="px-4 py-12 text-center text-sm text-slate-500">当前阶段暂无启用工作项。</td>
                  </tr>
                `
                : nodes
                    .map((node) => {
                      const definition = getPcsWorkItemDefinition(node.workItemId)
                      const roleText = getEffectiveRoleNames(node).join(' / ') || '-'
                      const fieldLabels = getFieldTemplateLabels(node.workItemId).join(' / ') || '—'
                      return `
                        <tr class="align-top">
                          <td class="px-4 py-3">
                            <p class="font-medium text-slate-900">${escapeHtml(node.workItemTypeName)}</p>
                            <p class="mt-1 text-xs text-slate-400">${escapeHtml(node.workItemId)}</p>
                          </td>
                          <td class="px-4 py-3">
                            <span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${getNatureBadgeClass(definition?.workItemNature ?? node.workItemTypeName)}">${escapeHtml(definition?.workItemNature ?? '标准工作项')}</span>
                          </td>
                          <td class="px-4 py-3 text-slate-700">${node.requiredFlag ? '必做' : '可选'}</td>
                          <td class="px-4 py-3 text-slate-600">${escapeHtml(roleText)}</td>
                          <td class="px-4 py-3 text-slate-600">${escapeHtml(fieldLabels)}</td>
                          <td class="px-4 py-3 text-slate-600">${escapeHtml(node.note || '—')}</td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </article>
  `
}

function renderEditorError(): string {
  if (!state.editor.error) return ''
  return `
    <section class="rounded-lg border border-rose-200 bg-rose-50 p-4">
      <p class="text-sm text-rose-700">${escapeHtml(state.editor.error)}</p>
    </section>
  `
}

function renderEditorPendingNodes(): string {
  if (state.editor.pendingNodes.length === 0) return ''
  return `
    <section class="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p class="text-sm text-amber-800">当前模板存在 ${state.editor.pendingNodes.length} 项待补充映射工作项，保存时会一并保留。</p>
    </section>
  `
}

function renderReadonlyField(label: string, value: string): string {
  return `
    <label class="space-y-1.5">
      <span class="text-xs text-slate-500">${escapeHtml(label)}</span>
      <input class="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600" value="${escapeHtml(value)}" readonly />
    </label>
  `
}

function renderRoleBadges(node: ProjectTemplateNodeDefinition): string {
  const allRoles = getEditorRoleCatalog()
  const effectiveRoles = new Set(getEffectiveRoleNames(node))
  return allRoles
    .map((role) => {
      const active = effectiveRoles.has(role)
      return `
        <button
          type="button"
          class="${toClassName(
            'inline-flex rounded-full border px-2 py-0.5 text-xs transition',
            active
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
          )}"
          data-pcs-template-action="toggle-node-role"
          data-node-key="${escapeHtml(getNodeKey(node))}"
          data-role-name="${escapeHtml(role)}"
        >${escapeHtml(role)}</button>
      `
    })
    .join('')
}

function renderFieldTemplateBadges(workItemId: string): string {
  const labels = getFieldTemplateLabels(workItemId)
  if (labels.length === 0) {
    return '<span class="text-xs text-slate-400">无独立字段模板</span>'
  }

  return labels
    .map(
      (label) =>
        `<span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(label)}</span>`,
    )
    .join('')
}

function renderEditorNodeCard(node: ProjectTemplateNodeDefinition): string {
  const definition = getPcsWorkItemDefinition(node.workItemId)
  const editRule = getTemplateNodeEditRule(state.editor.styleType, node.workItemTypeCode as never)

  return `
    <article class="rounded-lg bg-slate-50 p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-semibold text-slate-900">${escapeHtml(node.workItemTypeName)}</span>
            <span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${getNatureBadgeClass(definition?.workItemNature ?? '执行类')}">${escapeHtml(definition?.workItemNature ?? '标准工作项')}</span>
            ${definition?.capabilities.canMultiInstance ? '<span class="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">支持多次执行</span>' : ''}
          </div>
          <p class="mt-1 text-xs text-slate-400">${escapeHtml(node.workItemId)} / ${escapeHtml(node.workItemTypeCode)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${
            editRule.allowDisable
              ? `<button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-template-action="toggle-node-enabled" data-node-key="${escapeHtml(getNodeKey(node))}">${node.enabledFlag === false ? '启用' : '停用'}</button>`
              : '<span class="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs text-emerald-700">正式必做</span>'
          }
          ${
            editRule.allowRequiredSwitch
              ? `<button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-template-action="toggle-node-required" data-node-key="${escapeHtml(getNodeKey(node))}">${node.requiredFlag ? '改为可选' : '改为必做'}</button>`
              : `<span class="inline-flex h-8 items-center rounded-md border ${node.requiredFlag ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'} px-3 text-xs">${node.requiredFlag ? '必做' : '可选'}</span>`
          }
        </div>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-3">
        ${renderReadonlyField('工作项名称', node.workItemTypeName)}
        ${renderReadonlyField('工作项类型', definition?.workItemNature ?? '标准工作项')}
        ${renderReadonlyField('执行方式', definition?.capabilities.canMultiInstance ? (node.multiInstanceFlag ? '多次执行' : '单次执行') : '单次执行')}
      </div>
      <div class="mt-4 space-y-1.5">
        <p class="text-xs text-slate-500">执行角色</p>
        <div class="flex flex-wrap gap-2">${renderRoleBadges(node)}</div>
      </div>
      <div class="mt-4 space-y-1.5">
        <p class="text-xs text-slate-500">关联字段模板</p>
        <div class="flex flex-wrap gap-2">${renderFieldTemplateBadges(node.workItemId)}</div>
      </div>
      <label class="mt-4 block space-y-1.5">
        <span class="text-xs text-slate-500">节点说明</span>
        <textarea
          class="min-h-[88px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="补充该工作项在当前模板中的执行口径"
          data-pcs-template-field="node-note"
          data-node-key="${escapeHtml(getNodeKey(node))}"
        >${escapeHtml(node.note)}</textarea>
      </label>
    </article>
  `
}

function renderEditorStage(stage: ProjectTemplateStageDefinition): string {
  const expanded = state.editor.expandedStages[stage.phaseCode] !== false
  const activeNodes = getStageNodes(stage.phaseCode, false)
  const disabledCount = getStageNodes(stage.phaseCode, true).filter((node) => node.enabledFlag === false).length

  return `
    <article class="rounded-lg border bg-white p-4">
      <div class="flex flex-wrap items-start gap-4">
        <div class="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <i data-lucide="grip-vertical" class="h-4 w-4"></i>
          <span>阶段 ${stage.phaseOrder}</span>
        </div>
        <div class="min-w-0 flex-1 grid gap-4 md:grid-cols-2">
          ${renderReadonlyField('阶段名称', `${String(stage.phaseOrder).padStart(2, '0')} ${stage.phaseName}`)}
          <label class="space-y-1.5">
            <span class="text-xs text-slate-500">阶段说明</span>
            <input
              class="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value="${escapeHtml(stage.description)}"
              data-pcs-template-field="stage-description"
              data-stage-phase-code="${escapeHtml(stage.phaseCode)}"
            />
          </label>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-template-action="toggle-stage-required" data-stage-phase-code="${escapeHtml(stage.phaseCode)}">${stage.requiredFlag ? '必经' : '可跳过'}</button>
          <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-template-action="toggle-stage-expand" data-stage-phase-code="${escapeHtml(stage.phaseCode)}">${expanded ? '收起' : '展开'}</button>
        </div>
      </div>
      ${
        expanded
          ? `
            <div class="mt-6 ml-0 space-y-4 border-l-2 border-slate-100 pl-6">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-medium text-slate-900">工作项列表</p>
                  <p class="mt-1 text-xs text-slate-500">阶段由正式矩阵生成，允许按规则启停可选节点并补充执行说明。${disabledCount > 0 ? `当前已停用 ${disabledCount} 项。` : ''}</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-template-action="show-add-stage-hint">
                    <i data-lucide="plus" class="h-3.5 w-3.5"></i>新增阶段
                  </button>
                  <button type="button" class="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-template-action="open-selector" data-stage-phase-code="${escapeHtml(stage.phaseCode)}">
                    <i data-lucide="library" class="h-3.5 w-3.5"></i>从工作项库选择
                  </button>
                </div>
              </div>
              ${
                activeNodes.length === 0
                  ? '<div class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">当前阶段暂无启用工作项，可从工作项库补回已停用的可选节点。</div>'
                  : activeNodes.map((node) => renderEditorNodeCard(node)).join('')
              }
            </div>
          `
          : ''
      }
    </article>
  `
}

function renderDialogShell(title: string, description: string, body: string, footer: string): string {
  return `
    <div class="fixed inset-0 z-50">
      <button type="button" class="absolute inset-0 bg-slate-900/40" data-pcs-template-action="close-dialogs" aria-label="关闭侧栏"></button>
      <aside class="absolute inset-y-0 right-0 flex h-full w-full max-w-3xl flex-col border-l bg-white shadow-xl">
        <div class="border-b border-slate-200 px-6 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">${escapeHtml(title)}</h2>
              <p class="mt-1 text-sm text-slate-500">${escapeHtml(description)}</p>
            </div>
            <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-template-action="close-dialogs">关闭</button>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">${body}</div>
        <div class="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">${footer}</div>
      </aside>
    </div>
  `
}

function renderToggleDialog(): string {
  const template = getConfirmTemplate()
  if (!template) return ''
  const targetStatus = template.status === 'active' ? '停用' : '启用'
  return renderDialogShell(
    `确认${targetStatus}`,
    `确定要${targetStatus}模板「${template.name}」吗？`,
    `<div class="rounded-lg border bg-slate-50 p-4 text-sm leading-6 text-slate-600">模板状态切换仅影响后续项目选用，不会删除现有模板结构和工作项配置。</div>`,
    `
      <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-template-action="close-dialogs">取消</button>
      <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-pcs-template-action="confirm-toggle">确认${targetStatus}</button>
    `,
  )
}

function renderCancelDialog(): string {
  if (!state.cancelDialogOpen) return ''
  return renderDialogShell(
    '确认取消',
    '当前编辑的内容将不会被保存，确定要取消吗？',
    '<div class="rounded-lg border bg-slate-50 p-4 text-sm leading-6 text-slate-600">取消后将返回模板列表，当前页面内的改动不会写入模板数据。</div>',
    `
      <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-template-action="close-dialogs">继续编辑</button>
      <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-pcs-template-action="confirm-cancel">确定取消</button>
    `,
  )
}

function renderSelectorDialog(): string {
  const phaseCode = state.editor.selectorStagePhaseCode
  if (!phaseCode) return ''

  const stage = getEditorStage(phaseCode)
  const items = getStageSelectorItems(phaseCode)

  return renderDialogShell(
    '从工作项库选择',
    stage ? `选择需要补回到「${stage.phaseName}」阶段的工作项。` : '选择需要补回的工作项。',
    items.length === 0
      ? '<div class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">当前阶段暂无可补回的可选工作项。</div>'
      : items
          .map((item) => {
            const selected = state.editor.selectorSelectedIds.includes(item.workItemId)
            return `
              <button
                type="button"
                class="${toClassName(
                  'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition',
                  selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50',
                )}"
                data-pcs-template-action="selector-toggle-item"
                data-work-item-id="${escapeHtml(item.workItemId)}"
              >
                <span class="${toClassName('mt-1 inline-flex h-4 w-4 rounded border', selected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white')}"></span>
                <span class="min-w-0 flex-1">
                  <span class="flex flex-wrap items-center gap-2">
                    <span class="font-medium text-slate-900">${escapeHtml(item.workItemTypeName)}</span>
                    <span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${getNatureBadgeClass(item.workItemNature)}">${escapeHtml(item.workItemNature)}</span>
                  </span>
                  <span class="mt-2 flex flex-wrap gap-2">
                    ${item.roleNames
                      .map(
                        (role) =>
                          `<span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(role)}</span>`,
                      )
                      .join('')}
                  </span>
                  <span class="mt-2 block text-xs leading-5 text-slate-500">${escapeHtml(item.description)}</span>
                </span>
              </button>
            `
          })
          .join(''),
    `
      <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-template-action="close-dialogs">取消</button>
      <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700 ${state.editor.selectorSelectedIds.length === 0 ? 'opacity-50' : ''}" data-pcs-template-action="selector-confirm" ${state.editor.selectorSelectedIds.length === 0 ? 'disabled' : ''}>添加${state.editor.selectorSelectedIds.length > 0 ? `（${state.editor.selectorSelectedIds.length}）` : ''}</button>
    `,
  )
}

function renderDialogs(): string {
  return `${renderToggleDialog()}${renderCancelDialog()}${renderSelectorDialog()}`
}

export function renderPcsTemplateListPage(): string {
  return `
    <div class="space-y-5 p-4">
      ${renderListHeader()}
      ${renderNotice()}
      ${renderListFilters()}
      ${renderListTable()}
    </div>
    ${renderDialogs()}
  `
}

export function renderPcsTemplateDetailPage(templateId: string): string {
  const template = getProjectTemplateById(templateId)

  if (!template) {
    return `
      <div class="space-y-5 p-4">
        ${renderNotice()}
        <section class="rounded-lg border bg-white p-4">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 class="text-xl font-semibold text-slate-900">模板不存在</h1>
              <p class="mt-1 text-sm text-slate-500">未找到对应的商品项目模板，请返回列表重新选择。</p>
            </div>
            <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/templates">
              <i data-lucide="arrow-left" class="h-4 w-4"></i>返回模板列表
            </button>
          </div>
        </section>
      </div>
      ${renderDialogs()}
    `
  }

  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      <section class="rounded-lg border bg-white p-4">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/templates">
                <i data-lucide="arrow-left" class="h-4 w-4"></i>返回模板列表
              </button>
              <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/templates/${escapeHtml(template.id)}/edit">
                <i data-lucide="square-pen" class="h-4 w-4"></i>编辑
              </button>
              <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-template-action="copy-template" data-template-id="${escapeHtml(template.id)}">
                <i data-lucide="copy" class="h-4 w-4"></i>复制
              </button>
              <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-template-action="open-toggle" data-template-id="${escapeHtml(template.id)}">
                <i data-lucide="${template.status === 'active' ? 'power-off' : 'power'}" class="h-4 w-4"></i>${template.status === 'active' ? '停用' : '启用'}
              </button>
            </div>
            <div>
              <p class="text-xs text-slate-500">项目模板管理 / 详情</p>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <h1 class="text-2xl font-semibold text-slate-900">${escapeHtml(template.name)}</h1>
                ${template.styleType
                  .map(
                    (item) =>
                      `<span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(item)}</span>`,
                  )
                  .join('')}
                <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getStatusBadgeClass(template.status)}">${escapeHtml(getStatusLabel(template.status))}</span>
              </div>
              <p class="mt-2 text-sm text-slate-500">${escapeHtml(template.description)}</p>
            </div>
          </div>
          <div class="rounded-lg border bg-slate-50 px-4 py-3 text-right">
            <p class="text-xs text-slate-500">模板编号</p>
            <p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(template.id)}</p>
          </div>
        </div>
      </section>

      ${renderDetailSummary(template)}
      ${renderBusinessSections(template)}
      ${renderPendingNodes(template)}

      <section class="space-y-4">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">阶段与工作项配置</h2>
          <p class="mt-1 text-sm text-slate-500">按模板阶段查看工作项配置、执行角色和字段口径。</p>
        </div>
        ${template.stages
          .slice()
          .sort((a, b) => a.phaseOrder - b.phaseOrder)
          .map((stage) => renderTemplateWorkItemRows(template, stage))
          .join('')}
      </section>
    </div>
    ${renderDialogs()}
  `
}

export function renderPcsTemplateEditorPage(templateId?: string): string {
  const mode: TemplateEditorMode = templateId ? 'edit' : 'create'
  ensureEditorState(mode, templateId)

  if (mode === 'edit' && templateId && !getProjectTemplateById(templateId)) {
    return `
      <div class="space-y-5 p-4">
        ${renderNotice()}
        <section class="rounded-lg border bg-white p-4">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 class="text-xl font-semibold text-slate-900">模板不存在</h1>
              <p class="mt-1 text-sm text-slate-500">未找到需要编辑的模板，请返回模板列表重新选择。</p>
            </div>
            <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/templates">
              <i data-lucide="arrow-left" class="h-4 w-4"></i>返回模板列表
            </button>
          </div>
        </section>
      </div>
      ${renderDialogs()}
    `
  }

  return `
    <div class="space-y-5 p-4 pb-24">
      ${renderNotice()}
      <header class="space-y-3">
        <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/templates">
          <i data-lucide="arrow-left" class="h-4 w-4"></i>返回模板列表
        </button>
        <div>
          <p class="text-xs text-slate-500">项目模板管理 / ${mode === 'create' ? '新增模板' : '编辑模板'}</p>
          <h1 class="mt-2 text-2xl font-semibold text-slate-900">${mode === 'create' ? '新增模板' : '编辑模板'}</h1>
          <p class="mt-1 text-sm text-slate-500">${mode === 'create' ? '创建新的商品项目模板。' : '调整模板基础信息和阶段工作项配置。'}</p>
        </div>
      </header>

      ${renderEditorError()}
      ${renderEditorPendingNodes()}

      <section class="rounded-lg border bg-white p-4">
        <h2 class="text-lg font-semibold text-slate-900">模板基本信息</h2>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <label class="space-y-1.5">
            <span class="text-sm font-medium text-slate-700">模板名称 <span class="text-rose-500">*</span></span>
            <input
              class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="如：基础款-完整流程模板"
              value="${escapeHtml(state.editor.templateName)}"
              data-pcs-template-field="editor-name"
            />
          </label>
          <label class="space-y-1.5">
            <span class="text-sm font-medium text-slate-700">适用款式类型 <span class="text-rose-500">*</span></span>
            <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-template-field="editor-styleType">
              ${STYLE_TYPE_OPTIONS.map(
                (option) =>
                  `<option value="${escapeHtml(option)}" ${state.editor.styleType === option ? 'selected' : ''}>${escapeHtml(option)}</option>`,
              ).join('')}
            </select>
          </label>
          <label class="space-y-1.5 md:col-span-2">
            <span class="text-sm font-medium text-slate-700">模板说明</span>
            <textarea
              class="min-h-[96px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="描述模板适用场景..."
              data-pcs-template-field="editor-description"
            >${escapeHtml(state.editor.description)}</textarea>
          </label>
          <label class="space-y-1.5">
            <span class="text-sm font-medium text-slate-700">启用状态</span>
            <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-template-field="editor-status">
              <option value="active" ${state.editor.status === 'active' ? 'selected' : ''}>启用</option>
              <option value="inactive" ${state.editor.status === 'inactive' ? 'selected' : ''}>停用</option>
            </select>
          </label>
        </div>
      </section>

      <section class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">阶段 & 工作项配置</h2>
            <p class="mt-1 text-sm text-slate-500">沿用 PCS 正式阶段矩阵编排模板节点，支持按规则启停可选工作项并补充执行说明。</p>
          </div>
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-template-action="show-add-stage-hint">
            <i data-lucide="plus" class="h-4 w-4"></i>新增阶段
          </button>
        </div>
        ${state.editor.stages
          .slice()
          .sort((a, b) => a.phaseOrder - b.phaseOrder)
          .map((stage) => renderEditorStage(stage))
          .join('')}
      </section>

      <div class="sticky bottom-0 z-20 -mx-6 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div class="flex flex-wrap items-center justify-end gap-3">
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-template-action="open-cancel">取消</button>
          <button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-template-action="save-editor">${mode === 'create' ? '创建模板' : '保存模板'}</button>
        </div>
      </div>
    </div>
    ${renderDialogs()}
  `
}

function updateEditorStage(phaseCode: string, updater: (stage: ProjectTemplateStageDefinition) => ProjectTemplateStageDefinition): void {
  state.editor.stages = state.editor.stages.map((stage) => (stage.phaseCode === phaseCode ? updater(stage) : stage))
}

function updateEditorNode(nodeKey: string, updater: (node: ProjectTemplateNodeDefinition) => ProjectTemplateNodeDefinition): void {
  state.editor.nodes = state.editor.nodes.map((node) => (getNodeKey(node) === nodeKey ? updater(node) : node))
}

function saveEditorDraft(): void {
  const templateName = state.editor.templateName.trim()
  if (!templateName) {
    state.editor.error = '请填写模板名称。'
    return
  }

  try {
    const payload = {
      name: templateName,
      styleType: [state.editor.styleType],
      description: state.editor.description,
      status: state.editor.status,
      stages: state.editor.stages.map(cloneStage),
      nodes: state.editor.nodes.map(cloneNode),
      pendingNodes: state.editor.pendingNodes.map(clonePendingNode),
    } as const

    if (state.editor.mode === 'create') {
      const created = createProjectTemplate({
        ...payload,
        creator: '当前用户',
      })
      state.notice = `模板「${created.name}」已创建。`
      clearEditorState()
      appStore.navigate(`/pcs/templates/${created.id}`)
      return
    }

    const templateId = state.editor.templateId
    if (!templateId) {
      state.editor.error = '未找到需要保存的模板编号。'
      return
    }

    const updated = updateProjectTemplate(templateId, payload)
    if (!updated) {
      state.editor.error = '模板已不存在，请返回列表重新选择。'
      return
    }

    state.notice = `模板「${updated.name}」已保存。`
    clearEditorState()
    appStore.navigate(`/pcs/templates/${updated.id}`)
  } catch (error) {
    state.editor.error = error instanceof Error ? error.message : '保存模板失败，请稍后重试。'
  }
}

export function handlePcsTemplatesInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-template-field]')
  if (!fieldNode) return false

  const field = fieldNode.dataset.pcsTemplateField
  if (!field) return false

  if (field === 'list-search' && fieldNode instanceof HTMLInputElement) {
    state.list.search = fieldNode.value
    return true
  }

  if (field === 'list-styleType' && fieldNode instanceof HTMLSelectElement) {
    state.list.styleType = fieldNode.value
    return true
  }

  if (field === 'list-status' && fieldNode instanceof HTMLSelectElement) {
    state.list.status = fieldNode.value as TemplateStatusFilter
    return true
  }

  if (field === 'editor-name' && fieldNode instanceof HTMLInputElement) {
    state.editor.templateName = fieldNode.value
    state.editor.error = null
    return true
  }

  if (field === 'editor-styleType' && fieldNode instanceof HTMLSelectElement) {
    const nextStyleType = normalizeStyleType(fieldNode.value)
    if (!nextStyleType) return true
    if (state.editor.styleType !== nextStyleType) {
      applyRecommendedDraft(nextStyleType)
      state.notice = `已切换为「${nextStyleType}」正式模板矩阵。`
    }
    return true
  }

  if (field === 'editor-description' && fieldNode instanceof HTMLTextAreaElement) {
    state.editor.description = fieldNode.value
    return true
  }

  if (field === 'editor-status' && fieldNode instanceof HTMLSelectElement) {
    state.editor.status = fieldNode.value === 'inactive' ? 'inactive' : 'active'
    return true
  }

  if (field === 'stage-description' && fieldNode instanceof HTMLInputElement) {
    const phaseCode = fieldNode.dataset.stagePhaseCode
    if (!phaseCode) return true
    updateEditorStage(phaseCode, (stage) => ({ ...stage, description: fieldNode.value }))
    return true
  }

  if (field === 'node-note' && fieldNode instanceof HTMLTextAreaElement) {
    const nodeKey = fieldNode.dataset.nodeKey
    if (!nodeKey) return true
    updateEditorNode(nodeKey, (node) => ({ ...node, note: fieldNode.value }))
    return true
  }

  return false
}

export function handlePcsTemplatesEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-template-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsTemplateAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'list-reset') {
    resetListState()
    return true
  }

  if (action === 'copy-template') {
    const templateId = actionNode.dataset.templateId
    if (!templateId) return true
    const duplicated = copyProjectTemplate(templateId)
    if (!duplicated) {
      state.notice = '模板不存在，无法复制。'
      return true
    }

    state.notice = `已复制模板为「${duplicated.name}」。`
    const currentPath = appStore.getState().pathname.split('?')[0]
    if (currentPath !== '/pcs/templates') {
      appStore.navigate(`/pcs/templates/${duplicated.id}`)
    }
    return true
  }

  if (action === 'open-toggle') {
    const templateId = actionNode.dataset.templateId
    if (!templateId) return true
    state.confirmToggleTemplateId = templateId
    return true
  }

  if (action === 'confirm-toggle') {
    const templateId = state.confirmToggleTemplateId
    if (!templateId) return true
    const updated = toggleProjectTemplateStatus(templateId)
    state.confirmToggleTemplateId = null
    state.notice = updated ? `模板「${updated.name}」已${getStatusLabel(updated.status)}。` : '模板不存在，无法切换状态。'
    return true
  }

  if (action === 'close-dialogs') {
    closeAllDialogs()
    return true
  }

  if (action === 'show-add-stage-hint') {
    state.notice = '当前 PCS 模板按正式阶段矩阵维护，暂不支持自由新增阶段。'
    return true
  }

  if (action === 'toggle-stage-expand') {
    const phaseCode = actionNode.dataset.stagePhaseCode
    if (!phaseCode) return true
    state.editor.expandedStages[phaseCode] = state.editor.expandedStages[phaseCode] === false
    return true
  }

  if (action === 'toggle-stage-required') {
    const phaseCode = actionNode.dataset.stagePhaseCode
    if (!phaseCode) return true
    updateEditorStage(phaseCode, (stage) => ({ ...stage, requiredFlag: !stage.requiredFlag }))
    return true
  }

  if (action === 'toggle-node-enabled') {
    const nodeKey = actionNode.dataset.nodeKey
    if (!nodeKey) return true
    updateEditorNode(nodeKey, (node) => ({ ...node, enabledFlag: !node.enabledFlag }))
    return true
  }

  if (action === 'toggle-node-required') {
    const nodeKey = actionNode.dataset.nodeKey
    if (!nodeKey) return true
    updateEditorNode(nodeKey, (node) => ({ ...node, requiredFlag: !node.requiredFlag }))
    return true
  }

  if (action === 'toggle-node-role') {
    const nodeKey = actionNode.dataset.nodeKey
    const roleName = actionNode.dataset.roleName
    if (!nodeKey || !roleName) return true
    const targetNode = state.editor.nodes.find((node) => getNodeKey(node) === nodeKey)
    if (!targetNode) return true

    const currentRoles = getEffectiveRoleNames(targetNode)
    const nextRoles = currentRoles.includes(roleName)
      ? currentRoles.filter((item) => item !== roleName)
      : [...currentRoles, roleName]
    const normalizedRoles = sortLabels(nextRoles)
    const defaultRoles = sortLabels(getDefaultRoleNames(targetNode))

    updateEditorNode(nodeKey, (node) => ({
      ...node,
      roleOverrideCodes: arraysEqual(normalizedRoles, defaultRoles) ? [] : normalizedRoles,
      roleOverrideNames: arraysEqual(normalizedRoles, defaultRoles) ? [] : normalizedRoles,
    }))
    return true
  }

  if (action === 'open-selector') {
    const phaseCode = actionNode.dataset.stagePhaseCode
    if (!phaseCode) return true
    state.editor.selectorStagePhaseCode = phaseCode
    state.editor.selectorSelectedIds = []
    return true
  }

  if (action === 'selector-toggle-item') {
    const workItemId = actionNode.dataset.workItemId
    if (!workItemId) return true
    state.editor.selectorSelectedIds = state.editor.selectorSelectedIds.includes(workItemId)
      ? state.editor.selectorSelectedIds.filter((item) => item !== workItemId)
      : [...state.editor.selectorSelectedIds, workItemId]
    return true
  }

  if (action === 'selector-confirm') {
    const phaseCode = state.editor.selectorStagePhaseCode
    if (!phaseCode) return true
    const stage = getEditorStage(phaseCode)
    if (!stage) {
      closeAllDialogs()
      return true
    }

    const maxSequenceNo = getStageNodes(phaseCode, true).reduce((max, node) => Math.max(max, node.sequenceNo), 0)
    let sequenceNo = maxSequenceNo

    state.editor.selectorSelectedIds.forEach((workItemId) => {
      const existingNode = state.editor.nodes.find((node) => node.phaseCode === phaseCode && node.workItemId === workItemId)
      if (existingNode) {
        updateEditorNode(getNodeKey(existingNode), (node) => ({ ...node, enabledFlag: true }))
        return
      }

      const definition = getPcsWorkItemDefinition(workItemId)
      if (!definition) return
      sequenceNo += 1
      const editRule = getTemplateNodeEditRule(state.editor.styleType, definition.workItemTypeCode as never)
      state.editor.nodes = [
        ...state.editor.nodes,
        {
          templateNodeId: '',
          templateId: '',
          templateStageId: '',
          phaseCode: stage.phaseCode,
          phaseName: stage.phaseName,
          workItemId: definition.workItemId,
          workItemTypeCode: definition.workItemTypeCode,
          workItemTypeName: definition.workItemTypeName,
          sequenceNo,
          enabledFlag: true,
          requiredFlag: editRule.optional ? false : true,
          multiInstanceFlag: definition.capabilities.canMultiInstance,
          roleOverrideCodes: [],
          roleOverrideNames: [],
          note: definition.description,
          sourceWorkItemUpdatedAt: definition.updatedAt,
          templateVersion: '',
        },
      ]
    })

    state.notice = `已补回 ${state.editor.selectorSelectedIds.length} 个工作项。`
    state.editor.selectorSelectedIds = []
    state.editor.selectorStagePhaseCode = null
    return true
  }

  if (action === 'open-cancel') {
    state.cancelDialogOpen = true
    return true
  }

  if (action === 'confirm-cancel') {
    state.notice = null
    clearEditorState()
    appStore.navigate('/pcs/templates')
    return true
  }

  if (action === 'save-editor') {
    saveEditorDraft()
    return true
  }

  return false
}

export function isPcsTemplatesDialogOpen(): boolean {
  return Boolean(state.confirmToggleTemplateId || state.cancelDialogOpen || state.editor.selectorStagePhaseCode)
}
