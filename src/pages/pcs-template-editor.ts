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
import { listProjectPhaseDefinitions } from '../data/pcs-project-phase-definitions'
import { getPcsWorkItemDefinition, listSelectableTemplateWorkItems } from '../data/pcs-work-items'

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
  libraryDialog: {
    open: boolean
    templateStageId: string | null
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
  nodes: [],
  pendingNodes: [],
  notice: null,
  cancelDialogOpen: false,
  libraryDialog: {
    open: false,
    templateStageId: null,
    selectedIds: [],
  },
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

function createStageDraft(phaseCode: string): ProjectTemplateStageDefinition {
  const phase = listProjectPhaseDefinitions().find((item) => item.phaseCode === phaseCode)
  if (!phase) {
    throw new Error(`未找到标准阶段：${phaseCode}`)
  }
  return {
    templateStageId: `TMP-STAGE-${phase.phaseCode}`,
    templateId: '',
    phaseCode: phase.phaseCode,
    phaseName: phase.phaseName,
    phaseOrder: phase.phaseOrder,
    requiredFlag: true,
    description: phase.description,
  }
}

function getNodesByStage(templateStageId: string): ProjectTemplateNodeDefinition[] {
  return state.nodes
    .filter((node) => node.templateStageId === templateStageId)
    .sort((a, b) => a.sequenceNo - b.sequenceNo)
}

function getAvailablePhaseDefinitions() {
  const selected = new Set(state.stages.map((item) => item.phaseCode))
  return listProjectPhaseDefinitions().filter((item) => !selected.has(item.phaseCode))
}

function ensureInitialized(mode: EditorMode, templateId?: string): void {
  const key = `${mode}:${templateId ?? ''}`
  if (state.initializedKey === key) return

  state.initializedKey = key
  state.mode = mode
  state.templateId = templateId ?? null
  state.notice = null
  state.cancelDialogOpen = false
  state.libraryDialog = { open: false, templateStageId: null, selectedIds: [] }

  if (mode === 'create') {
    state.name = ''
    state.styleType = ''
    state.description = ''
    state.status = 'active'
    state.stages = [createStageDraft('PHASE_01')]
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
    state.stages = [createStageDraft('PHASE_01')]
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
        <p class="text-sm text-muted-foreground">${isCreate ? '通过标准阶段和标准工作项组合模板节点。' : '模板只负责组织阶段和节点，不再维护第二套工作项定义。'}</p>
      </div>
      ${!isCreate ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-template-editor-action="go-detail">查看详情</button>` : ''}
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

function renderPendingNodeSection(): string {
  if (state.pendingNodes.length === 0) return ''
  return `
    <section class="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h2 class="text-sm font-semibold text-amber-800">待补充标准工作项</h2>
      <p class="mt-1 text-xs text-amber-700">以下旧模板行尚未标准化，不能作为正式模板节点生成项目节点。</p>
      <div class="mt-3 space-y-2">
        ${state.pendingNodes
          .map(
            (item) => `
              <article class="rounded-md border border-amber-200 bg-white px-3 py-2 text-xs">
                <p class="font-medium text-amber-800">原始旧名称：${escapeHtml(item.legacyWorkItemName)}</p>
                <p class="mt-1 text-amber-700">原始旧阶段：${escapeHtml(item.legacyStageName)}</p>
                <p class="mt-1 text-amber-700">未映射原因：${escapeHtml(item.unresolvedReason)}</p>
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
  if (!workItem) return ''

  const canMultiInstance = workItem.capabilities.canMultiInstance

  return `
    <tr class="border-b last:border-b-0">
      <td class="px-2 py-1.5">
        <input class="h-8 w-16 rounded-md border bg-background px-2 text-xs" value="${node.sequenceNo}" type="number" min="1" data-pcs-template-editor-field="nodeSequenceNo" data-template-stage-id="${escapeHtml(stage.templateStageId)}" data-template-node-id="${escapeHtml(node.templateNodeId)}" />
      </td>
      <td class="px-2 py-1.5 font-mono text-xs">${escapeHtml(workItem.workItemId)}</td>
      <td class="px-2 py-1.5">
        <p class="font-medium">${escapeHtml(workItem.workItemTypeName)}</p>
        <p class="mt-0.5 text-[11px] text-muted-foreground">${escapeHtml(workItem.workItemTypeCode)}</p>
      </td>
      <td class="px-2 py-1.5">${escapeHtml(workItem.categoryName)}</td>
      <td class="px-2 py-1.5">
        <select class="h-8 w-full rounded-md border bg-background px-2 text-xs" data-pcs-template-editor-field="nodeRequiredFlag" data-template-stage-id="${escapeHtml(stage.templateStageId)}" data-template-node-id="${escapeHtml(node.templateNodeId)}">
          <option value="true" ${node.requiredFlag ? 'selected' : ''}>必做</option>
          <option value="false" ${!node.requiredFlag ? 'selected' : ''}>可选</option>
        </select>
      </td>
      <td class="px-2 py-1.5">
        <label class="inline-flex items-center gap-1 text-xs ${canMultiInstance ? '' : 'text-muted-foreground'}">
          <input type="checkbox" class="h-4 w-4 rounded border" ${node.multiInstanceFlag ? 'checked' : ''} ${canMultiInstance ? '' : 'disabled'} data-pcs-template-editor-field="nodeMultiInstanceFlag" data-template-stage-id="${escapeHtml(stage.templateStageId)}" data-template-node-id="${escapeHtml(node.templateNodeId)}" />
          ${canMultiInstance ? '允许多次执行' : '标准工作项不允许多次执行'}
        </label>
      </td>
      <td class="px-2 py-1.5">
        <input class="h-8 w-full rounded-md border bg-background px-2 text-xs" value="${escapeHtml(node.roleOverrideNames.join(' / '))}" placeholder="如需覆盖角色，请输入" data-pcs-template-editor-field="nodeRoleOverride" data-template-stage-id="${escapeHtml(stage.templateStageId)}" data-template-node-id="${escapeHtml(node.templateNodeId)}" />
      </td>
      <td class="px-2 py-1.5">
        <input class="h-8 w-full rounded-md border bg-background px-2 text-xs" value="${escapeHtml(node.note)}" placeholder="节点备注" data-pcs-template-editor-field="nodeNote" data-template-stage-id="${escapeHtml(stage.templateStageId)}" data-template-node-id="${escapeHtml(node.templateNodeId)}" />
      </td>
      <td class="px-2 py-1.5 text-right">
        <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs text-red-700 hover:bg-red-50" data-pcs-template-editor-action="remove-node" data-template-stage-id="${escapeHtml(stage.templateStageId)}" data-template-node-id="${escapeHtml(node.templateNodeId)}">删除</button>
      </td>
    </tr>
  `
}

function renderStageCard(stage: ProjectTemplateStageDefinition): string {
  const nodes = getNodesByStage(stage.templateStageId)
  const availableWorkItems = listSelectableTemplateWorkItems(stage.phaseCode)

  return `
    <article class="rounded-lg border bg-background p-3">
      <div class="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div class="space-y-1">
          <p class="text-xs text-muted-foreground">正式阶段</p>
          <h3 class="text-sm font-medium">${escapeHtml(stage.phaseName)}</h3>
          <p class="text-xs text-muted-foreground">阶段编码：${escapeHtml(stage.phaseCode)}</p>
          <textarea class="mt-1 min-h-[56px] w-full rounded-md border bg-background px-2 py-1 text-xs" placeholder="阶段说明" data-pcs-template-editor-field="stageDescription" data-template-stage-id="${escapeHtml(stage.templateStageId)}">${escapeHtml(stage.description)}</textarea>
        </div>
        <div class="flex items-center gap-2">
          <label class="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <input type="checkbox" class="h-4 w-4 rounded border" ${stage.requiredFlag ? 'checked' : ''} data-pcs-template-editor-field="stageRequiredFlag" data-template-stage-id="${escapeHtml(stage.templateStageId)}" />
            必经阶段
          </label>
          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-template-editor-action="open-library" data-template-stage-id="${escapeHtml(stage.templateStageId)}">
            从工作项库选择
          </button>
          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs text-red-700 hover:bg-red-50 ${state.stages.length <= 1 ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-template-editor-action="remove-stage" data-template-stage-id="${escapeHtml(stage.templateStageId)}" ${state.stages.length <= 1 ? 'disabled' : ''}>
            删除阶段
          </button>
        </div>
      </div>

      <div class="mb-3 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        本阶段可选标准工作项：${availableWorkItems.length > 0 ? availableWorkItems.map((item) => escapeHtml(item.workItemTypeName)).join('、') : '暂无可选工作项'}
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[1100px] text-xs">
          <thead>
            <tr class="border-b text-left text-muted-foreground">
              <th class="px-2 py-1.5 font-medium">阶段内顺序</th>
              <th class="px-2 py-1.5 font-medium">标准工作项编号</th>
              <th class="px-2 py-1.5 font-medium">标准工作项名称</th>
              <th class="px-2 py-1.5 font-medium">工作项类别</th>
              <th class="px-2 py-1.5 font-medium">是否必做</th>
              <th class="px-2 py-1.5 font-medium">是否允许多次执行</th>
              <th class="px-2 py-1.5 font-medium">角色覆盖</th>
              <th class="px-2 py-1.5 font-medium">节点备注</th>
              <th class="px-2 py-1.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              nodes.length > 0
                ? nodes.map((node) => renderNodeRow(stage, node)).join('')
                : `
                  <tr>
                    <td colspan="9" class="px-2 py-4 text-center text-muted-foreground">暂无模板节点，请从标准工作项库选择。</td>
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
        <h2 class="text-sm font-semibold">阶段与模板节点配置</h2>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-template-editor-action="add-stage">
          <i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>新增阶段
        </button>
      </div>
      <div class="space-y-3">
        ${state.stages.map((stage) => renderStageCard(stage)).join('')}
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
  if (!state.libraryDialog.open || !state.libraryDialog.templateStageId) return ''
  const stage = state.stages.find((item) => item.templateStageId === state.libraryDialog.templateStageId)
  if (!stage) return ''
  const selectable = listSelectableTemplateWorkItems(stage.phaseCode)

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-2xl rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">从标准工作项库选择</h3>
          <p class="mt-1 text-xs text-muted-foreground">目标阶段：${escapeHtml(stage.phaseName)}</p>
        </header>
        <div class="max-h-[60vh] overflow-y-auto p-4">
          <div class="space-y-2">
            ${
              selectable.length > 0
                ? selectable
                    .map((item) => {
                      const checked = state.libraryDialog.selectedIds.includes(item.workItemId)
                      return `
                        <label class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/30">
                          <input type="checkbox" class="mt-0.5 h-4 w-4 rounded border" data-pcs-template-editor-field="librarySelect" data-library-item-id="${escapeHtml(item.workItemId)}" ${checked ? 'checked' : ''} />
                          <div class="space-y-1">
                            <p class="text-sm font-medium">${escapeHtml(item.workItemTypeName)}</p>
                            <p class="text-xs text-muted-foreground">编号：${escapeHtml(item.workItemId)} ｜ 编码：${escapeHtml(item.workItemTypeCode)}</p>
                            <p class="text-xs text-muted-foreground">类别：${escapeHtml(item.categoryName)} ｜ 默认角色：${escapeHtml(item.roleNames.join(' / '))}</p>
                            <p class="text-xs text-muted-foreground">允许多次执行：${item.capabilities.canMultiInstance ? '是' : '否'}</p>
                          </div>
                        </label>
                      `
                    })
                    .join('')
                : `<div class="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">当前阶段暂无可选标准工作项。</div>`
            }
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

  const orderedStages = state.stages
    .map(cloneStage)
    .sort((a, b) => a.phaseOrder - b.phaseOrder)
  const orderedNodes = state.nodes
    .map(cloneNode)
    .sort((a, b) => {
      if (a.phaseCode === b.phaseCode) return a.sequenceNo - b.sequenceNo
      return a.phaseCode.localeCompare(b.phaseCode)
    })

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
}

export function renderPcsTemplateCreatePage(): string {
  ensureInitialized('create')
  return `
    <div class="space-y-4 pb-16">
      ${renderHeader()}
      ${renderNotice()}
      ${renderBasicInfo()}
      ${renderPendingNodeSection()}
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
      ${renderPendingNodeSection()}
      ${renderStageSection()}
      ${renderActionBar()}
      ${renderCancelDialog()}
      ${renderLibraryDialog()}
    </div>
  `
}

function findStage(templateStageId: string): ProjectTemplateStageDefinition | null {
  return state.stages.find((stage) => stage.templateStageId === templateStageId) ?? null
}

function findNode(templateNodeId: string): ProjectTemplateNodeDefinition | null {
  return state.nodes.find((node) => node.templateNodeId === templateNodeId) ?? null
}

function parseRoleOverride(value: string): string[] {
  return value
    .split(/[、,/，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function handlePcsTemplateEditorEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-template-editor-field]')

  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.pcsTemplateEditorField
    if (field === 'name') {
      state.name = fieldNode.value
      return true
    }
    if (field === 'librarySelect') {
      const itemId = fieldNode.dataset.libraryItemId
      if (!itemId) return false
      state.libraryDialog.selectedIds = fieldNode.checked
        ? Array.from(new Set([...state.libraryDialog.selectedIds, itemId]))
        : state.libraryDialog.selectedIds.filter((id) => id !== itemId)
      return true
    }
    if (field === 'stageRequiredFlag') {
      const templateStageId = fieldNode.dataset.templateStageId
      if (!templateStageId) return false
      const stage = findStage(templateStageId)
      if (!stage) return false
      stage.requiredFlag = fieldNode.checked
      return true
    }
    if (field === 'nodeSequenceNo') {
      const templateNodeId = fieldNode.dataset.templateNodeId
      if (!templateNodeId) return false
      const node = findNode(templateNodeId)
      if (!node) return false
      node.sequenceNo = Math.max(1, Number(fieldNode.value) || 1)
      return true
    }
    if (field === 'nodeMultiInstanceFlag') {
      const templateNodeId = fieldNode.dataset.templateNodeId
      if (!templateNodeId) return false
      const node = findNode(templateNodeId)
      if (!node) return false
      const workItem = getPcsWorkItemDefinition(node.workItemId)
      node.multiInstanceFlag = workItem?.capabilities.canMultiInstance ? fieldNode.checked : false
      return true
    }
    if (field === 'nodeRoleOverride') {
      const templateNodeId = fieldNode.dataset.templateNodeId
      if (!templateNodeId) return false
      const node = findNode(templateNodeId)
      if (!node) return false
      const roles = parseRoleOverride(fieldNode.value)
      node.roleOverrideCodes = [...roles]
      node.roleOverrideNames = [...roles]
      return true
    }
    if (field === 'nodeNote') {
      const templateNodeId = fieldNode.dataset.templateNodeId
      if (!templateNodeId) return false
      const node = findNode(templateNodeId)
      if (!node) return false
      node.note = fieldNode.value
      return true
    }
  }

  if (fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.pcsTemplateEditorField
    if (field === 'description') {
      state.description = fieldNode.value
      return true
    }
    if (field === 'stageDescription') {
      const templateStageId = fieldNode.dataset.templateStageId
      if (!templateStageId) return false
      const stage = findStage(templateStageId)
      if (!stage) return false
      stage.description = fieldNode.value
      return true
    }
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
    if (field === 'nodeRequiredFlag') {
      const templateNodeId = fieldNode.dataset.templateNodeId
      if (!templateNodeId) return false
      const node = findNode(templateNodeId)
      if (!node) return false
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
  if (action === 'add-stage') {
    const available = getAvailablePhaseDefinitions()
    if (available.length === 0) {
      state.notice = '标准阶段目录只有 5 个，当前模板已全部使用。'
      return true
    }
    state.stages = [...state.stages, createStageDraft(available[0].phaseCode)]
    return true
  }
  if (action === 'remove-stage') {
    const templateStageId = actionNode.dataset.templateStageId
    if (!templateStageId || state.stages.length <= 1) return false
    state.stages = state.stages.filter((stage) => stage.templateStageId !== templateStageId)
    state.nodes = state.nodes.filter((node) => node.templateStageId !== templateStageId)
    state.pendingNodes = state.pendingNodes.filter((node) => node.templateStageId !== templateStageId)
    return true
  }
  if (action === 'open-library') {
    const templateStageId = actionNode.dataset.templateStageId
    if (!templateStageId) return false
    state.libraryDialog = {
      open: true,
      templateStageId,
      selectedIds: [],
    }
    return true
  }
  if (action === 'close-library') {
    state.libraryDialog = {
      open: false,
      templateStageId: null,
      selectedIds: [],
    }
    return true
  }
  if (action === 'confirm-library') {
    const templateStageId = state.libraryDialog.templateStageId
    if (!templateStageId) return false
    const stage = findStage(templateStageId)
    if (!stage) return false
    const currentNodes = getNodesByStage(templateStageId)
    const selected = listSelectableTemplateWorkItems(stage.phaseCode).filter((item) =>
      state.libraryDialog.selectedIds.includes(item.workItemId),
    )
    const appended = selected.map((item, index) => ({
      templateNodeId: `TMP-NODE-${stage.phaseCode}-${Date.now()}-${index + 1}`,
      templateId: '',
      templateStageId: stage.templateStageId,
      phaseCode: stage.phaseCode,
      phaseName: stage.phaseName,
      workItemId: item.workItemId,
      workItemTypeCode: item.workItemTypeCode,
      workItemTypeName: item.workItemTypeName,
      sequenceNo: currentNodes.length + index + 1,
      requiredFlag: true,
      multiInstanceFlag: item.capabilities.canMultiInstance,
      roleOverrideCodes: [],
      roleOverrideNames: [],
      note: '',
      sourceWorkItemUpdatedAt: item.updatedAt,
      templateVersion: '',
    }))
    state.nodes = [...state.nodes, ...appended]
    state.libraryDialog = {
      open: false,
      templateStageId: null,
      selectedIds: [],
    }
    return true
  }
  if (action === 'remove-node') {
    const templateNodeId = actionNode.dataset.templateNodeId
    if (!templateNodeId) return false
    state.nodes = state.nodes.filter((node) => node.templateNodeId !== templateNodeId)
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

