import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  copyProjectTemplate,
  countTemplatePendingNodes,
  countTemplateReferencedWorkItems,
  countTemplateStages,
  countTemplateWorkItems,
  getProjectTemplateById,
  getStatusLabel,
  toggleProjectTemplateStatus,
} from '../data/pcs-templates'
import {
  getProjectPhaseContract,
  getProjectTemplateSchema,
  getProjectWorkItemContract,
  listProjectTemplateSchemas,
} from '../data/pcs-project-domain-contract'
import { listProjectWorkspaceSourceMappings } from '../data/pcs-project-config-workspace-adapter'
import {
  buildTemplateBusinessSummary,
  buildTemplateNodeFieldSourceRows,
  buildTemplateTripletNote,
} from '../data/pcs-template-domain-view-model'

type DetailDialogType = 'copy' | 'toggle'

interface DetailDialogState {
  open: boolean
  type: DetailDialogType
}

interface DetailState {
  templateId: string
  notice: string | null
  dialog: DetailDialogState
}

const state: DetailState = {
  templateId: '',
  notice: null,
  dialog: {
    open: false,
    type: 'copy',
  },
}

function getStatusBadge(status: 'active' | 'inactive'): string {
  if (status === 'active') {
    return '<span class="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">启用</span>'
  }
  return '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">停用</span>'
}

function getClosureBadge(status: '完整闭环' | '仅测款不转档' | '配置异常'): string {
  if (status === '完整闭环') {
    return '<span class="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">完整闭环</span>'
  }
  if (status === '仅测款不转档') {
    return '<span class="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">仅测款不转档</span>'
  }
  return '<span class="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">配置异常</span>'
}

function renderNotFound(templateId: string): string {
  return `
    <div class="space-y-4">
      <header class="flex items-center gap-2">
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-template-detail-action="go-list">
          <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回模板列表
        </button>
      </header>
      <section class="rounded-lg border border-dashed bg-card px-4 py-14 text-center text-muted-foreground">
        <i data-lucide="file-x-2" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
        <p class="mt-2">未找到模板：${escapeHtml(templateId)}</p>
      </section>
    </div>
  `
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-template-detail-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderDialog(): string {
  if (!state.dialog.open) return ''
  const template = getProjectTemplateById(state.templateId)
  if (!template) return ''

  const isCopy = state.dialog.type === 'copy'
  const title = isCopy ? '复制模板' : `${template.status === 'active' ? '停用' : '启用'}模板`
  const description = isCopy
    ? '将复制当前模板的阶段定义、节点定义和待处理项。'
    : template.status === 'active'
      ? '停用后将不能用于新建商品项目。'
      : '启用后模板可用于新建商品项目。'

  const confirmText = isCopy ? '确认复制' : template.status === 'active' ? '确认停用' : '确认启用'

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-lg rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">${title}</h3>
          <p class="mt-1 text-xs text-muted-foreground">${description}</p>
        </header>
        <div class="space-y-2 p-4 text-sm">
          <p>模板：<span class="font-medium">${escapeHtml(template.name)}</span></p>
          <p>当前状态：${getStatusLabel(template.status)}</p>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-template-detail-action="close-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-template-detail-action="confirm-dialog">${confirmText}</button>
        </footer>
      </section>
    </div>
  `
}

function renderTextList(items: string[]): string {
  if (items.length === 0) {
    return '<p class="text-sm text-muted-foreground">无</p>'
  }
  return `
    <ul class="space-y-1 text-sm">
      ${items.map((item) => `<li class="flex gap-2"><span class="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400"></span><span>${escapeHtml(item)}</span></li>`).join('')}
    </ul>
  `
}

export function renderPcsTemplateDetailPage(templateId: string): string {
  state.templateId = templateId
  const template = getProjectTemplateById(templateId)
  if (!template) return renderNotFound(templateId)
  const styleType = template.styleType[0]
  const schemaId = listProjectTemplateSchemas().find((item) => styleType && item.styleTypes.includes(styleType))?.templateId
  if (!schemaId) return renderNotFound(templateId)

  const schema = getProjectTemplateSchema(schemaId)
  const summary = buildTemplateBusinessSummary(template)
  const configMappings = listProjectWorkspaceSourceMappings().filter((item) =>
    [
      'categoryId',
      'brandId',
      'styleCodeId',
      'styleTagIds',
      'crowdPositioningIds',
      'ageIds',
      'crowdIds',
      'productPositioningIds',
    ].includes(item.fieldKey),
  )

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-template-detail-action="go-list">
            <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回模板列表
          </button>
          <h1 class="text-xl font-semibold">${escapeHtml(template.name)}</h1>
          <p class="text-sm text-muted-foreground">模板详情统一引用领域契约，展示阶段原因、节点前置条件、字段来源和上下游变化。</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${getStatusBadge(template.status)}
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-template-detail-action="go-edit">
            <i data-lucide="edit-3" class="mr-1 h-3.5 w-3.5"></i>编辑模板
          </button>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-template-detail-action="open-copy-dialog">
            <i data-lucide="copy" class="mr-1 h-3.5 w-3.5"></i>复制模板
          </button>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs ${template.status === 'active' ? 'text-orange-700 hover:bg-orange-50' : 'text-emerald-700 hover:bg-emerald-50'}" data-pcs-template-detail-action="open-toggle-dialog">
            <i data-lucide="${template.status === 'active' ? 'power-off' : 'power'}" class="mr-1 h-3.5 w-3.5"></i>${template.status === 'active' ? '停用模板' : '启用模板'}
          </button>
        </div>
      </header>

      ${renderNotice()}

      <section class="grid gap-3 md:grid-cols-4">
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">模板编码</p>
          <p class="mt-1 font-mono text-sm">${escapeHtml(template.id)}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">阶段数</p>
          <p class="mt-1 text-xl font-semibold">${countTemplateStages(template)}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">启用节点数</p>
          <p class="mt-1 text-xl font-semibold">${countTemplateWorkItems(template)}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">标准工作项数</p>
          <p class="mt-1 text-xl font-semibold">${countTemplateReferencedWorkItems(template)}</p>
          <p class="mt-1 text-xs text-muted-foreground">待补充项：${countTemplatePendingNodes(template)}</p>
        </article>
      </section>

      <section class="rounded-lg border bg-card p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-2">
            <h2 class="text-sm font-semibold">模板主信息</h2>
            <div class="flex flex-wrap gap-2">
              ${getStatusBadge(template.status)}
              ${getClosureBadge(summary.closureStatus)}
            </div>
          </div>
          <div class="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            适用款式类型：${template.styleType.map((item) => escapeHtml(item)).join('、')}
          </div>
        </div>
        <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article class="rounded-md border bg-background p-3">
            <p class="text-xs text-muted-foreground">模板名称</p>
            <p class="mt-1 text-sm font-medium">${escapeHtml(template.name)}</p>
          </article>
          <article class="rounded-md border bg-background p-3">
            <p class="text-xs text-muted-foreground">模板适用场景</p>
            <p class="mt-1 text-sm">${escapeHtml(schema.scenario)}</p>
          </article>
          <article class="rounded-md border bg-background p-3">
            <p class="text-xs text-muted-foreground">闭环说明</p>
            <p class="mt-1 text-sm">${escapeHtml(summary.closureText)}</p>
          </article>
          <article class="rounded-md border bg-background p-3">
            <p class="text-xs text-muted-foreground">模板状态</p>
            <p class="mt-1 text-sm">${getStatusLabel(template.status)}</p>
          </article>
        </div>
        <div class="mt-3 rounded-lg border bg-muted/20 p-3">
          <p class="text-xs text-muted-foreground">模板说明</p>
          <p class="mt-1 text-sm">${escapeHtml(template.description || schema.description)}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            ${summary.pathFlags.map((item) => `<span class="inline-flex rounded-md border bg-background px-2 py-1 text-xs">${escapeHtml(item)}</span>`).join('')}
          </div>
          ${
            summary.issues.length > 0
              ? `<div class="mt-3 rounded-md border border-red-200 bg-red-50 p-3">${renderTextList(summary.issues.map((item) => item.message))}</div>`
              : ''
          }
        </div>
      </section>

      <section class="rounded-lg border bg-card p-4">
        <h2 class="mb-3 text-sm font-semibold">立项字段来源</h2>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          ${configMappings
            .map(
              (item) => `
                <article class="rounded-md border bg-background p-3">
                  <p class="text-xs text-muted-foreground">${escapeHtml(item.fieldLabel)}</p>
                  <p class="mt-1 text-sm font-medium">${escapeHtml(item.sourceRef)}</p>
                  <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.reason)}</p>
                </article>
              `,
            )
            .join('')}
        </div>
      </section>

      <section class="rounded-lg border bg-card p-4">
        <h2 class="mb-3 text-sm font-semibold">阶段定义</h2>
        <div class="space-y-3">
          ${template.stages
            .slice()
            .sort((a, b) => a.phaseOrder - b.phaseOrder)
            .map((stage) => {
              const phaseContract = getProjectPhaseContract(stage.phaseCode as Parameters<typeof getProjectPhaseContract>[0])
              const phaseSchema = schema.phaseSchemas.find((item) => item.phaseCode === stage.phaseCode)
              const stageNodes = template.nodes
                .filter((item) => item.phaseCode === stage.phaseCode && item.enabledFlag !== false)
                .sort((a, b) => a.sequenceNo - b.sequenceNo)
              return `
                <article class="rounded-lg border bg-background p-4">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="space-y-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="text-sm font-medium">${escapeHtml(stage.phaseName)}</p>
                        <span class="inline-flex rounded-full border bg-muted px-2 py-0.5 text-xs">${stage.requiredFlag ? '必经阶段' : '可选阶段'}</span>
                      </div>
                      <p class="text-xs text-muted-foreground">阶段编码：${escapeHtml(stage.phaseCode)} ｜ 阶段顺序：${stage.phaseOrder}</p>
                    </div>
                    <div class="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      启用节点：${stageNodes.map((item) => escapeHtml(item.workItemTypeName)).join('、') || '当前未启用节点'}
                    </div>
                  </div>
                  <div class="mt-3 grid gap-3 md:grid-cols-2">
                    <article class="rounded-md border bg-muted/20 p-3">
                      <p class="text-xs text-muted-foreground">阶段业务场景</p>
                      <p class="mt-1 text-sm">${escapeHtml(phaseContract.businessScenario)}</p>
                    </article>
                    <article class="rounded-md border bg-muted/20 p-3">
                      <p class="text-xs text-muted-foreground">为什么这个模板需要这个阶段</p>
                      <p class="mt-1 text-sm">${escapeHtml(phaseSchema?.whyExists || phaseContract.whyExists || stage.description)}</p>
                    </article>
                    <article class="rounded-md border bg-muted/20 p-3">
                      <p class="mb-2 text-xs text-muted-foreground">本阶段进入条件</p>
                      ${renderTextList(phaseContract.entryConditions)}
                    </article>
                    <article class="rounded-md border bg-muted/20 p-3">
                      <p class="mb-2 text-xs text-muted-foreground">本阶段退出条件</p>
                      ${renderTextList(phaseContract.exitConditions)}
                    </article>
                  </div>
                </article>
              `
            })
            .join('')}
        </div>
      </section>

      <section class="rounded-lg border bg-card p-4">
        <h2 class="mb-3 text-sm font-semibold">节点定义</h2>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1220px] text-xs">
            <thead>
              <tr class="border-b text-left text-muted-foreground">
                <th class="px-2 py-1.5 font-medium">阶段</th>
                <th class="px-2 py-1.5 font-medium">顺序</th>
                <th class="px-2 py-1.5 font-medium">标准工作项编号</th>
                <th class="px-2 py-1.5 font-medium">标准工作项名称</th>
                <th class="px-2 py-1.5 font-medium">是否启用</th>
                <th class="px-2 py-1.5 font-medium">是否必做</th>
                <th class="px-2 py-1.5 font-medium">是否允许多次执行</th>
                <th class="px-2 py-1.5 font-medium">角色覆盖</th>
                <th class="px-2 py-1.5 font-medium">节点备注</th>
              </tr>
            </thead>
            <tbody>
              ${template.nodes
                .slice()
                .sort((a, b) => {
                  if (a.phaseCode === b.phaseCode) return a.sequenceNo - b.sequenceNo
                  return a.phaseCode.localeCompare(b.phaseCode)
                })
                .map((node) => `
                  <tr class="border-b last:border-b-0">
                    <td class="px-2 py-1.5">${escapeHtml(node.phaseName)}</td>
                    <td class="px-2 py-1.5">${node.sequenceNo}</td>
                    <td class="px-2 py-1.5 font-mono">${escapeHtml(node.workItemId)}</td>
                    <td class="px-2 py-1.5">
                      <p class="font-medium">${escapeHtml(node.workItemTypeName)}</p>
                      <p class="mt-0.5 text-[11px] text-muted-foreground">${escapeHtml(node.workItemTypeCode)}</p>
                    </td>
                    <td class="px-2 py-1.5">${node.enabledFlag === false ? '已停用' : '已启用'}</td>
                    <td class="px-2 py-1.5">${node.requiredFlag ? '必做' : '可选'}</td>
                    <td class="px-2 py-1.5">${node.multiInstanceFlag ? '允许' : '单次'}</td>
                    <td class="px-2 py-1.5">${escapeHtml(node.roleOverrideNames.join(' / ') || '沿用默认角色')}</td>
                    <td class="px-2 py-1.5 text-muted-foreground">${escapeHtml(node.note || '—')}</td>
                  </tr>
                `)
                .join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-lg border bg-card p-4">
        <h2 class="mb-3 text-sm font-semibold">节点业务说明</h2>
        <div class="space-y-4">
          ${template.nodes
            .slice()
            .sort((a, b) => {
              if (a.phaseCode === b.phaseCode) return a.sequenceNo - b.sequenceNo
              return a.phaseCode.localeCompare(b.phaseCode)
            })
            .map((node) => {
              const contract = getProjectWorkItemContract(node.workItemTypeCode as Parameters<typeof getProjectWorkItemContract>[0])
              const fieldRows = buildTemplateNodeFieldSourceRows(node.workItemTypeCode as Parameters<typeof buildTemplateNodeFieldSourceRows>[0])
              const allPreconditions = Array.from(new Set(contract.operationDefinitions.flatMap((item) => item.preconditions)))
              return `
                <article class="rounded-lg border bg-background p-4">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="text-sm font-medium">${escapeHtml(contract.workItemTypeName)}</p>
                        <span class="inline-flex rounded-full border bg-muted px-2 py-0.5 text-xs">${escapeHtml(node.phaseName)}</span>
                        <span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${node.enabledFlag === false ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}">${node.enabledFlag === false ? '模板已停用' : '模板已启用'}</span>
                      </div>
                      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(contract.scenario)}</p>
                    </div>
                    <div class="flex flex-wrap gap-2 text-xs">
                      <span class="rounded-md border bg-muted/20 px-2 py-1">${node.requiredFlag ? '必做节点' : '可选节点'}</span>
                      <span class="rounded-md border bg-muted/20 px-2 py-1">${node.multiInstanceFlag ? '允许多实例' : '单次节点'}</span>
                    </div>
                  </div>

                  <div class="mt-3 grid gap-3 md:grid-cols-2">
                    <article class="rounded-md border bg-muted/20 p-3">
                      <p class="text-xs text-muted-foreground">节点业务场景</p>
                      <p class="mt-1 text-sm">${escapeHtml(contract.scenario)}</p>
                    </article>
                    <article class="rounded-md border bg-muted/20 p-3">
                      <p class="text-xs text-muted-foreground">为什么这个模板需要这个节点</p>
                      <p class="mt-1 text-sm">${escapeHtml(contract.keepReason)}</p>
                    </article>
                    <article class="rounded-md border bg-muted/20 p-3">
                      <p class="mb-2 text-xs text-muted-foreground">节点前置条件</p>
                      ${renderTextList(allPreconditions)}
                    </article>
                    <article class="rounded-md border bg-muted/20 p-3">
                      <p class="text-xs text-muted-foreground">节点上下游影响</p>
                      <div class="mt-2 space-y-2">
                        <div>
                          <p class="text-[11px] text-muted-foreground">上游变动</p>
                          ${renderTextList(contract.upstreamChanges)}
                        </div>
                        <div>
                          <p class="text-[11px] text-muted-foreground">下游变动</p>
                          ${renderTextList(contract.downstreamChanges)}
                        </div>
                      </div>
                    </article>
                  </div>

                  ${
                    node.workItemTypeCode === 'CHANNEL_PRODUCT_LISTING'
                      ? `
                        <div class="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                          <p class="text-xs text-blue-700">三码关系说明</p>
                          <p class="mt-1 text-sm text-blue-800">款式档案编码、渠道商品编码、上游渠道商品编码在不同业务时点建立。${escapeHtml(buildTemplateTripletNote())}</p>
                        </div>
                      `
                      : ''
                  }

                  <div class="mt-4">
                    <h3 class="mb-2 text-sm font-medium">节点字段清单</h3>
                    <div class="overflow-x-auto">
                      <table class="w-full min-w-[980px] text-xs">
                        <thead>
                          <tr class="border-b text-left text-muted-foreground">
                            <th class="px-2 py-1.5 font-medium">字段名称</th>
                            <th class="px-2 py-1.5 font-medium">字段来源</th>
                            <th class="px-2 py-1.5 font-medium">字段定义</th>
                            <th class="px-2 py-1.5 font-medium">是否必填</th>
                            <th class="px-2 py-1.5 font-medium">是否只读</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${fieldRows
                            .map(
                              (field) => `
                                <tr class="border-b last:border-b-0">
                                  <td class="px-2 py-1.5 font-medium">${escapeHtml(field.fieldLabel)}</td>
                                  <td class="px-2 py-1.5">${escapeHtml(field.sourceText)}</td>
                                  <td class="px-2 py-1.5 text-muted-foreground">${escapeHtml(field.definitionText)}</td>
                                  <td class="px-2 py-1.5">${escapeHtml(field.requiredText)}</td>
                                  <td class="px-2 py-1.5">${escapeHtml(field.readonlyText)}</td>
                                </tr>
                              `,
                            )
                            .join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div class="mt-4">
                    <h3 class="mb-2 text-sm font-medium">节点可执行操作</h3>
                    <div class="grid gap-3 md:grid-cols-2">
                      ${contract.operationDefinitions
                        .map(
                          (operation) => `
                            <article class="rounded-md border bg-muted/20 p-3">
                              <p class="text-sm font-medium">${escapeHtml(operation.actionName)}</p>
                              <div class="mt-2 space-y-2">
                                <div>
                                  <p class="text-[11px] text-muted-foreground">前置条件</p>
                                  ${renderTextList(operation.preconditions)}
                                </div>
                                <div>
                                  <p class="text-[11px] text-muted-foreground">执行结果</p>
                                  ${renderTextList(operation.effects)}
                                </div>
                                <div>
                                  <p class="text-[11px] text-muted-foreground">写回规则</p>
                                  ${renderTextList(operation.writebackRules)}
                                </div>
                              </div>
                            </article>
                          `,
                        )
                        .join('')}
                    </div>
                  </div>

                  <div class="mt-4">
                    <h3 class="mb-2 text-sm font-medium">节点状态清单</h3>
                    <div class="overflow-x-auto">
                      <table class="w-full min-w-[900px] text-xs">
                        <thead>
                          <tr class="border-b text-left text-muted-foreground">
                            <th class="px-2 py-1.5 font-medium">状态名称</th>
                            <th class="px-2 py-1.5 font-medium">进入条件</th>
                            <th class="px-2 py-1.5 font-medium">退出条件</th>
                            <th class="px-2 py-1.5 font-medium">业务含义</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${contract.statusDefinitions
                            .map(
                              (status) => `
                                <tr class="border-b last:border-b-0">
                                  <td class="px-2 py-1.5 font-medium">${escapeHtml(status.statusName)}</td>
                                  <td class="px-2 py-1.5">${escapeHtml(status.entryConditions.join('；') || '无')}</td>
                                  <td class="px-2 py-1.5">${escapeHtml(status.exitConditions.join('；') || '无')}</td>
                                  <td class="px-2 py-1.5 text-muted-foreground">${escapeHtml(status.businessMeaning)}</td>
                                </tr>
                              `,
                            )
                            .join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </article>
              `
            })
            .join('')}
        </div>
      </section>

      ${
        template.pendingNodes.length > 0
          ? `
            <section class="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h2 class="text-sm font-semibold text-amber-800">待补充标准工作项</h2>
              <div class="mt-3 space-y-2">
                ${template.pendingNodes
                  .map(
                    (node) => `
                      <article class="rounded-md border border-amber-200 bg-white px-3 py-2 text-xs">
                        <p class="font-medium text-amber-800">原始旧名称：${escapeHtml(node.legacyWorkItemName)}</p>
                        <p class="mt-1 text-amber-700">原始旧阶段：${escapeHtml(node.legacyStageName)}</p>
                        <p class="mt-1 text-amber-700">未映射原因：${escapeHtml(node.unresolvedReason)}</p>
                      </article>
                    `,
                  )
                  .join('')}
              </div>
            </section>
          `
          : ''
      }

      ${renderDialog()}
    </div>
  `
}

function closeDialog(): void {
  state.dialog.open = false
}

export function handlePcsTemplateDetailEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-template-detail-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsTemplateDetailAction
  if (!action) return false

  if (action === 'go-list') {
    appStore.navigate('/pcs/templates')
    return true
  }

  if (action === 'go-edit') {
    if (!state.templateId) return false
    appStore.navigate(`/pcs/templates/${state.templateId}/edit`)
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'open-copy-dialog') {
    state.dialog.open = true
    state.dialog.type = 'copy'
    return true
  }

  if (action === 'open-toggle-dialog') {
    state.dialog.open = true
    state.dialog.type = 'toggle'
    return true
  }

  if (action === 'close-dialog') {
    closeDialog()
    return true
  }

  if (action === 'confirm-dialog') {
    if (!state.templateId) return false
    if (state.dialog.type === 'copy') {
      const copied = copyProjectTemplate(state.templateId)
      closeDialog()
      if (!copied) {
        state.notice = '复制模板失败，请重试。'
        return true
      }
      appStore.navigate(`/pcs/templates/${copied.id}`)
      return true
    }

    const toggled = toggleProjectTemplateStatus(state.templateId)
    closeDialog()
    if (!toggled) {
      state.notice = '模板状态更新失败，请重试。'
      return true
    }
    state.notice = `模板已${toggled.status === 'active' ? '启用' : '停用'}。`
    return true
  }

  return false
}

export function isPcsTemplateDetailDialogOpen(): boolean {
  return state.dialog.open
}
