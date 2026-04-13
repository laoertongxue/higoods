import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  createProjectTemplate,
  getProjectTemplateById,
  getStatusLabel,
  updateProjectTemplate,
  type ProjectTemplateNodeDefinition,
  type ProjectTemplatePendingNode,
  type ProjectTemplateStageDefinition,
  type TemplateStatusCode,
  type TemplateStyleType,
} from '../data/pcs-templates'
import {
  getProjectPhaseContract,
  getProjectTemplateSchema,
  getProjectWorkItemContract,
  listProjectTemplateSchemas,
} from '../data/pcs-project-domain-contract'
import { getPcsWorkItemDefinition } from '../data/pcs-work-items'
import {
  buildTemplateBusinessSummary,
  getTemplateNodeEditRule,
  validateTemplateBusinessIntegrity,
} from '../data/pcs-template-domain-view-model'

type EditorMode = 'create' | 'edit'

interface TemplateEditorState {
  initializedKey: string
  mode: EditorMode
  templateId: string | null
  name: string
  styleType: '' | TemplateStyleType
  description: string
  status: TemplateStatusCode
  stages: ProjectTemplateStageDefinition[]
  nodes: ProjectTemplateNodeDefinition[]
  pendingNodes: ProjectTemplatePendingNode[]
  notice: string | null
  cancelDialogOpen: boolean
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
  nodes: [],
  pendingNodes: [],
  notice: null,
  cancelDialogOpen: false,
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

function getNodesByStage(templateStageId: string): ProjectTemplateNodeDefinition[] {
  return state.nodes
    .filter((node) => node.templateStageId === templateStageId)
    .sort((a, b) => a.sequenceNo - b.sequenceNo)
}

function findSchemaByStyleType(styleType: TemplateStyleType) {
  const schema = listProjectTemplateSchemas().find((item) => item.styleTypes.includes(styleType))
  if (!schema) {
    throw new Error(`未找到适用款式类型的正式模板矩阵：${styleType}`)
  }
  return getProjectTemplateSchema(schema.templateId)
}

function applySchemaToState(styleType: TemplateStyleType): void {
  const schema = findSchemaByStyleType(styleType)
  const builtinTemplate = getProjectTemplateById(schema.templateId)
  if (!builtinTemplate) {
    throw new Error(`未找到正式模板：${schema.templateId}`)
  }
  state.stages = builtinTemplate.stages.map(cloneStage)
  state.nodes = builtinTemplate.nodes.map(cloneNode)
  state.pendingNodes = []
  if (state.mode === 'create' && !state.name.trim()) {
    state.name = schema.templateName
  }
  if (!state.description.trim()) {
    state.description = schema.description
  }
}

function buildCurrentTemplateSummary() {
  if (!state.styleType) return null
  return buildTemplateBusinessSummary({
    id: state.templateId ?? 'TMP',
    name: state.name.trim() || '未命名模板',
    styleType: [state.styleType],
    creator: '当前用户',
    createdAt: '',
    updatedAt: '',
    status: state.status,
    description: state.description,
    scenario: findSchemaByStyleType(state.styleType).scenario,
    stages: state.stages.map(cloneStage),
    nodes: state.nodes.map(cloneNode),
    pendingNodes: state.pendingNodes.map(clonePendingNode),
  })
}

function ensureInitialized(mode: EditorMode, templateId?: string): void {
  const key = `${mode}:${templateId ?? ''}`
  if (state.initializedKey === key) return

  state.initializedKey = key
  state.mode = mode
  state.templateId = templateId ?? null
  state.notice = null
  state.cancelDialogOpen = false

  if (mode === 'create') {
    state.name = ''
    state.styleType = ''
    state.description = ''
    state.status = 'active'
    state.stages = []
    state.nodes = []
    state.pendingNodes = []
    return
  }

  const template = templateId ? getProjectTemplateById(templateId) : null
  if (!template) {
    state.name = ''
    state.styleType = ''
    state.description = ''
    state.status = 'active'
    state.stages = []
    state.nodes = []
    state.pendingNodes = []
    return
  }

  state.name = template.name
  state.styleType = (template.styleType[0] ?? '') as '' | TemplateStyleType
  state.description = template.description
  state.status = template.status
  state.stages = template.stages.map(cloneStage)
  state.nodes = template.nodes.map(cloneNode)
  state.pendingNodes = template.pendingNodes.map(clonePendingNode)
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
        <p class="text-sm text-muted-foreground">${isCreate ? '第一步先选择适用款式类型，系统将加载该类型的正式推荐模板骨架。' : '编辑页只允许调整正式矩阵允许变动的可选节点、节点顺序、多实例和模板说明。'}</p>
      </div>
      ${!isCreate ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-template-editor-action="go-detail">查看详情</button>` : ''}
    </header>
  `
}

function renderBasicInfo(): string {
  const basicInfoLocked = state.mode === 'edit'
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">模板基本信息</h2>
      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">模板名称 <span class="text-red-500">*</span></label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm ${basicInfoLocked ? 'cursor-not-allowed bg-muted/40' : ''}" value="${escapeHtml(state.name)}" placeholder="如：基础款-完整测款转档模板" data-pcs-template-editor-field="name" ${basicInfoLocked ? 'disabled' : ''} />
          ${basicInfoLocked ? '<p class="mt-1 text-[11px] text-muted-foreground">编辑页不修改模板名称；如需停用请回详情页或列表页操作。</p>' : ''}
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">适用款式类型 <span class="text-red-500">*</span></label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm ${basicInfoLocked ? 'cursor-not-allowed bg-muted/40' : ''}" data-pcs-template-editor-field="styleType" ${basicInfoLocked ? 'disabled' : ''}>
            <option value="" ${state.styleType === '' ? 'selected' : ''}>请选择款式类型</option>
            <option value="基础款" ${state.styleType === '基础款' ? 'selected' : ''}>基础款</option>
            <option value="快时尚款" ${state.styleType === '快时尚款' ? 'selected' : ''}>快时尚款</option>
            <option value="改版款" ${state.styleType === '改版款' ? 'selected' : ''}>改版款</option>
            <option value="设计款" ${state.styleType === '设计款' ? 'selected' : ''}>设计款</option>
          </select>
          <p class="mt-1 text-xs text-muted-foreground">${basicInfoLocked ? '编辑页不切换款式类型，避免脱离正式模板矩阵。' : state.styleType ? '已按所选款式类型载入正式推荐模板骨架。' : '选择款式类型后，系统将自动加载对应阶段和节点骨架。'}</p>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">模板状态</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm ${basicInfoLocked ? 'cursor-not-allowed bg-muted/40' : ''}" data-pcs-template-editor-field="status" ${basicInfoLocked ? 'disabled' : ''}>
            <option value="active" ${state.status === 'active' ? 'selected' : ''}>${getStatusLabel('active')}</option>
            <option value="inactive" ${state.status === 'inactive' ? 'selected' : ''}>${getStatusLabel('inactive')}</option>
          </select>
          ${basicInfoLocked ? '<p class="mt-1 text-[11px] text-muted-foreground">模板启停统一在模板列表和模板详情页处理。</p>' : ''}
        </div>
        <div class="md:col-span-2">
          <label class="mb-1 block text-xs text-muted-foreground">模板说明</label>
          <textarea class="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="请说明模板适用场景、节奏和差异点。" data-pcs-template-editor-field="description">${escapeHtml(state.description)}</textarea>
        </div>
      </div>
    </section>
  `
}

function renderReasonPanel(): string {
  if (!state.styleType) {
    return `
      <section class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
        请先选择适用款式类型，系统会显示正式模板骨架、闭环状态和阶段节点业务理由。
      </section>
    `
  }

  const summary = buildCurrentTemplateSummary()
  if (!summary) return ''

  const closureClass =
    summary.closureStatus === '完整闭环'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : summary.closureStatus === '仅测款不转档'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-red-200 bg-red-50 text-red-700'

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold">阶段与节点业务理由面板</h2>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(summary.scenarioSummary)}</p>
        </div>
        <span class="inline-flex rounded-full border px-2 py-1 text-xs ${closureClass}">${escapeHtml(summary.closureStatus)}</span>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <article class="rounded-md border bg-muted/20 p-3">
          <p class="text-xs text-muted-foreground">闭环说明</p>
          <p class="mt-1 text-sm">${escapeHtml(summary.closureText)}</p>
        </article>
        <article class="rounded-md border bg-muted/20 p-3">
          <p class="text-xs text-muted-foreground">测款路径说明</p>
          <div class="mt-2 flex flex-wrap gap-2">
            ${summary.pathFlags.map((item) => `<span class="inline-flex rounded-md border bg-background px-2 py-1 text-xs">${escapeHtml(item)}</span>`).join('')}
          </div>
        </article>
      </div>
      ${
        summary.issues.length > 0
          ? `
            <div class="mt-3 rounded-md border border-red-200 bg-red-50 p-3">
              <p class="text-xs text-red-700">当前模板存在以下校验问题，保存前必须修正：</p>
              <ul class="mt-2 space-y-1 text-sm text-red-700">
                ${summary.issues.map((item) => `<li>• ${escapeHtml(item.message)}</li>`).join('')}
              </ul>
            </div>
          `
          : ''
      }
      <div class="mt-3 space-y-3">
        ${summary.previewPhases
          .map(
            (phase) => `
              <article class="rounded-md border bg-background p-3">
                <p class="text-xs text-muted-foreground">${escapeHtml(phase.phaseCode)}</p>
                <p class="mt-1 text-sm font-medium">${escapeHtml(phase.phaseName)}</p>
                <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(phase.nodeNames.join('、') || '当前未启用节点')}</p>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderNodeRow(stage: ProjectTemplateStageDefinition, node: ProjectTemplateNodeDefinition): string {
  const workItem = getPcsWorkItemDefinition(node.workItemId)
  if (!workItem || !state.styleType) return ''

  const contract = getProjectWorkItemContract(node.workItemTypeCode as Parameters<typeof getProjectWorkItemContract>[0])
  const editRule = getTemplateNodeEditRule(state.styleType, node.workItemTypeCode as Parameters<typeof getTemplateNodeEditRule>[1])
  const allowMultiInstance = workItem.capabilities.canMultiInstance && node.enabledFlag !== false

  return `
    <tr class="border-b last:border-b-0 ${node.enabledFlag === false ? 'opacity-60' : ''}">
      <td class="px-2 py-1.5">
        ${
          editRule.allowDisable
            ? `<label class="inline-flex items-center gap-1 text-xs">
                <input type="checkbox" class="h-4 w-4 rounded border" ${node.enabledFlag !== false ? 'checked' : ''} data-pcs-template-editor-field="nodeEnabledFlag" data-template-node-id="${escapeHtml(node.templateNodeId)}" />
                ${node.enabledFlag === false ? '已停用' : '已启用'}
              </label>`
            : '<span class="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">正式必留</span>'
        }
      </td>
      <td class="px-2 py-1.5">
        <input class="h-8 w-16 rounded-md border bg-background px-2 text-xs ${editRule.allowReorder && node.enabledFlag !== false ? '' : 'cursor-not-allowed bg-muted/40'}" value="${node.sequenceNo}" type="number" min="1" ${editRule.allowReorder && node.enabledFlag !== false ? '' : 'disabled'} data-pcs-template-editor-field="nodeSequenceNo" data-template-node-id="${escapeHtml(node.templateNodeId)}" />
      </td>
      <td class="px-2 py-1.5 font-mono text-xs">${escapeHtml(workItem.workItemId)}</td>
      <td class="px-2 py-1.5">
        <p class="font-medium">${escapeHtml(workItem.workItemTypeName)}</p>
        <p class="mt-0.5 text-[11px] text-muted-foreground">${escapeHtml(workItem.workItemTypeCode)}</p>
      </td>
      <td class="px-2 py-1.5">${escapeHtml(workItem.categoryName)}</td>
      <td class="px-2 py-1.5">
        <select class="h-8 w-full rounded-md border bg-background px-2 text-xs ${editRule.allowRequiredSwitch && node.enabledFlag !== false ? '' : 'cursor-not-allowed bg-muted/40'}" data-pcs-template-editor-field="nodeRequiredFlag" data-template-node-id="${escapeHtml(node.templateNodeId)}" ${editRule.allowRequiredSwitch && node.enabledFlag !== false ? '' : 'disabled'}>
          <option value="true" ${node.requiredFlag ? 'selected' : ''}>必做</option>
          <option value="false" ${!node.requiredFlag ? 'selected' : ''}>可选</option>
        </select>
      </td>
      <td class="px-2 py-1.5">
        <label class="inline-flex items-center gap-1 text-xs ${allowMultiInstance ? '' : 'text-muted-foreground'}">
          <input type="checkbox" class="h-4 w-4 rounded border" ${node.multiInstanceFlag ? 'checked' : ''} ${allowMultiInstance ? '' : 'disabled'} data-pcs-template-editor-field="nodeMultiInstanceFlag" data-template-node-id="${escapeHtml(node.templateNodeId)}" />
          ${allowMultiInstance ? '允许多次执行' : '当前节点固定单次'}
        </label>
      </td>
      <td class="px-2 py-1.5">
        <span class="text-xs text-muted-foreground">${escapeHtml(node.roleOverrideNames.join(' / ') || '沿用默认角色')}</span>
      </td>
      <td class="px-2 py-1.5">
        <span class="text-xs text-muted-foreground">${escapeHtml(node.note || '沿用正式说明')}</span>
      </td>
      <td class="px-2 py-1.5 text-xs text-muted-foreground">${escapeHtml(contract.keepReason)}</td>
    </tr>
  `
}

function renderStageCard(stage: ProjectTemplateStageDefinition): string {
  if (!state.styleType) return ''
  const phaseContract = getProjectPhaseContract(stage.phaseCode as Parameters<typeof getProjectPhaseContract>[0])
  const schema = findSchemaByStyleType(state.styleType)
  const phaseSchema = schema.phaseSchemas.find((item) => item.phaseCode === stage.phaseCode)
  const nodes = getNodesByStage(stage.templateStageId)

  return `
    <article class="rounded-lg border bg-background p-3">
      <div class="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-sm font-medium">${escapeHtml(stage.phaseName)}</p>
            <span class="inline-flex rounded-full border bg-muted px-2 py-0.5 text-xs">${stage.requiredFlag ? '正式必经阶段' : '可选阶段'}</span>
          </div>
          <p class="text-xs text-muted-foreground">阶段编码：${escapeHtml(stage.phaseCode)}</p>
        </div>
        <div class="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          启用节点：${nodes.filter((item) => item.enabledFlag !== false).map((item) => escapeHtml(item.workItemTypeName)).join('、') || '当前未启用节点'}
        </div>
      </div>

      <div class="mb-3 grid gap-3 md:grid-cols-2">
        <article class="rounded-md border bg-muted/20 p-3">
          <p class="text-xs text-muted-foreground">阶段业务场景</p>
          <p class="mt-1 text-sm">${escapeHtml(phaseContract.businessScenario)}</p>
        </article>
        <article class="rounded-md border bg-muted/20 p-3">
          <p class="text-xs text-muted-foreground">为什么需要这个阶段</p>
          <p class="mt-1 text-sm">${escapeHtml(phaseSchema?.whyExists || phaseContract.whyExists)}</p>
        </article>
        <article class="rounded-md border bg-muted/20 p-3">
          <p class="mb-2 text-xs text-muted-foreground">进入条件</p>
          <ul class="space-y-1 text-sm text-muted-foreground">
            ${phaseContract.entryConditions.map((item) => `<li>• ${escapeHtml(item)}</li>`).join('')}
          </ul>
        </article>
        <article class="rounded-md border bg-muted/20 p-3">
          <p class="mb-2 text-xs text-muted-foreground">退出条件</p>
          <ul class="space-y-1 text-sm text-muted-foreground">
            ${phaseContract.exitConditions.map((item) => `<li>• ${escapeHtml(item)}</li>`).join('')}
          </ul>
        </article>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[1240px] text-xs">
          <thead>
            <tr class="border-b text-left text-muted-foreground">
              <th class="px-2 py-1.5 font-medium">启用状态</th>
              <th class="px-2 py-1.5 font-medium">阶段内顺序</th>
              <th class="px-2 py-1.5 font-medium">标准工作项编号</th>
              <th class="px-2 py-1.5 font-medium">标准工作项名称</th>
              <th class="px-2 py-1.5 font-medium">工作项类别</th>
              <th class="px-2 py-1.5 font-medium">是否必做</th>
              <th class="px-2 py-1.5 font-medium">多实例</th>
              <th class="px-2 py-1.5 font-medium">角色覆盖</th>
              <th class="px-2 py-1.5 font-medium">节点备注</th>
              <th class="px-2 py-1.5 font-medium">节点业务理由</th>
            </tr>
          </thead>
          <tbody>
            ${nodes.map((node) => renderNodeRow(stage, node)).join('')}
          </tbody>
        </table>
      </div>

      <div class="mt-3 grid gap-3 md:grid-cols-2">
        ${nodes
          .map((node) => {
            const contract = getProjectWorkItemContract(node.workItemTypeCode as Parameters<typeof getProjectWorkItemContract>[0])
            const allPreconditions = Array.from(new Set(contract.operationDefinitions.flatMap((item) => item.preconditions)))
            return `
              <article class="rounded-md border bg-muted/20 p-3 ${node.enabledFlag === false ? 'opacity-60' : ''}">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-sm font-medium">${escapeHtml(contract.workItemTypeName)}</p>
                  <span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${node.enabledFlag === false ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}">${node.enabledFlag === false ? '当前停用' : '当前启用'}</span>
                </div>
                <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(contract.keepReason)}</p>
                <div class="mt-2 space-y-2 text-xs text-muted-foreground">
                  <p>前置条件：${escapeHtml(allPreconditions.join('；') || '无固定前置条件')}</p>
                  <p>上游变动：${escapeHtml(contract.upstreamChanges.join('；') || '无')}</p>
                  <p>下游变动：${escapeHtml(contract.downstreamChanges.join('；') || '无')}</p>
                </div>
              </article>
            `
          })
          .join('')}
      </div>
    </article>
  `
}

function renderStageSection(): string {
  return `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold">正式阶段与节点配置</h2>
        <span class="rounded-md border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">正式矩阵锁定，只能在正式矩阵允许的节点上做启用、顺序、必做和多实例调整</span>
      </div>
      <div class="space-y-3">
        ${
          state.stages.length > 0
            ? state.stages
                .slice()
                .sort((a, b) => a.phaseOrder - b.phaseOrder)
                .map((stage) => renderStageCard(stage))
                .join('')
            : '<div class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">请先选择适用款式类型，系统将加载正式模板矩阵。</div>'
        }
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
  if (state.nodes.length === 0) {
    state.notice = '至少需要一个模板节点。'
    return false
  }

  const issues = validateTemplateBusinessIntegrity({
    styleType: state.styleType,
    stages: state.stages.map(cloneStage),
    nodes: state.nodes.map(cloneNode),
  })
  if (issues.length > 0) {
    state.notice = issues[0].message
    return false
  }

  const orderedStages = state.stages
    .map(cloneStage)
    .sort((a, b) => a.phaseOrder - b.phaseOrder)
  const orderedNodes = state.nodes
    .map(cloneNode)
    .sort((a, b) => {
      if (a.phaseCode === b.phaseCode) return a.sequenceNo - b.sequenceNo
      return a.phaseCode.localeCompare(b.phaseCode)
    })

  try {
    if (state.mode === 'create') {
      const created = createProjectTemplate({
        name,
        styleType: [state.styleType],
        description: state.description.trim(),
        status: state.status,
        stages: orderedStages,
        nodes: orderedNodes,
        pendingNodes: state.pendingNodes.map(clonePendingNode),
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
      stages: orderedStages,
      nodes: orderedNodes,
      pendingNodes: state.pendingNodes.map(clonePendingNode),
    })
    if (!updated) {
      state.notice = '模板不存在，保存失败。'
      return false
    }
    appStore.navigate(`/pcs/templates/${updated.id}`)
    return true
  } catch (error) {
    state.notice = error instanceof Error ? error.message : '模板保存失败，请重试。'
    return false
  }
}

export function renderPcsTemplateCreatePage(): string {
  ensureInitialized('create')
  return `
    <div class="space-y-4 pb-16">
      ${renderHeader()}
      ${renderNotice()}
      ${renderBasicInfo()}
      ${renderReasonPanel()}
      ${renderStageSection()}
      ${renderActionBar()}
      ${renderCancelDialog()}
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
      ${renderReasonPanel()}
      ${renderStageSection()}
      ${renderActionBar()}
      ${renderCancelDialog()}
    </div>
  `
}

function findNode(templateNodeId: string): ProjectTemplateNodeDefinition | null {
  return state.nodes.find((node) => node.templateNodeId === templateNodeId) ?? null
}

export function handlePcsTemplateEditorEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-template-editor-field]')

  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.pcsTemplateEditorField
    if (field === 'name') {
      state.name = fieldNode.value
      return true
    }
    if (field === 'nodeEnabledFlag') {
      const templateNodeId = fieldNode.dataset.templateNodeId
      if (!templateNodeId || !state.styleType) return false
      const node = findNode(templateNodeId)
      if (!node) return false
      const editRule = getTemplateNodeEditRule(state.styleType, node.workItemTypeCode as Parameters<typeof getTemplateNodeEditRule>[1])
      if (!editRule.allowDisable) return true
      node.enabledFlag = fieldNode.checked
      if (!node.enabledFlag) {
        node.requiredFlag = false
        node.multiInstanceFlag = false
      }
      return true
    }
    if (field === 'nodeSequenceNo') {
      const templateNodeId = fieldNode.dataset.templateNodeId
      if (!templateNodeId || !state.styleType) return false
      const node = findNode(templateNodeId)
      if (!node) return false
      const editRule = getTemplateNodeEditRule(state.styleType, node.workItemTypeCode as Parameters<typeof getTemplateNodeEditRule>[1])
      if (!editRule.allowReorder || node.enabledFlag === false) return true
      node.sequenceNo = Math.max(1, Number(fieldNode.value) || 1)
      return true
    }
    if (field === 'nodeMultiInstanceFlag') {
      const templateNodeId = fieldNode.dataset.templateNodeId
      if (!templateNodeId) return false
      const node = findNode(templateNodeId)
      if (!node) return false
      const workItem = getPcsWorkItemDefinition(node.workItemId)
      node.multiInstanceFlag = node.enabledFlag !== false && workItem?.capabilities.canMultiInstance ? fieldNode.checked : false
      return true
    }
  }

  if (fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.pcsTemplateEditorField
    if (field === 'description') {
      state.description = fieldNode.value
      return true
    }
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsTemplateEditorField
    if (field === 'styleType') {
      state.styleType = fieldNode.value as '' | TemplateStyleType
      if (state.styleType) {
        applySchemaToState(state.styleType)
      } else {
        state.stages = []
        state.nodes = []
      }
      return true
    }
    if (field === 'status') {
      state.status = fieldNode.value as TemplateStatusCode
      return true
    }
    if (field === 'nodeRequiredFlag') {
      const templateNodeId = fieldNode.dataset.templateNodeId
      if (!templateNodeId || !state.styleType) return false
      const node = findNode(templateNodeId)
      if (!node) return false
      const editRule = getTemplateNodeEditRule(state.styleType, node.workItemTypeCode as Parameters<typeof getTemplateNodeEditRule>[1])
      if (!editRule.allowRequiredSwitch || node.enabledFlag === false) return true
      node.requiredFlag = fieldNode.value === 'true'
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
  return state.cancelDialogOpen
}
