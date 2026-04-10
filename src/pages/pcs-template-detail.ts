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
import { getPcsWorkItemDefinition } from '../data/pcs-work-items'

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

export function renderPcsTemplateDetailPage(templateId: string): string {
  state.templateId = templateId
  const template = getProjectTemplateById(templateId)
  if (!template) return renderNotFound(templateId)

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-template-detail-action="go-list">
            <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回模板列表
          </button>
          <h1 class="text-xl font-semibold">${escapeHtml(template.name)}</h1>
          <p class="text-sm text-muted-foreground">模板详情展示正式阶段定义、模板节点定义以及待补充标准工作项。</p>
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
          <p class="text-xs text-muted-foreground">模板节点数</p>
          <p class="mt-1 text-xl font-semibold">${countTemplateWorkItems(template)}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">标准工作项数</p>
          <p class="mt-1 text-xl font-semibold">${countTemplateReferencedWorkItems(template)}</p>
          <p class="mt-1 text-xs text-muted-foreground">待补充项：${countTemplatePendingNodes(template)}</p>
        </article>
      </section>

      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-sm font-semibold">模板主信息</h2>
        <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article class="rounded-md border bg-background p-3">
            <p class="text-xs text-muted-foreground">适用款式类型</p>
            <p class="mt-1 text-sm">${template.styleType.map((item) => escapeHtml(item)).join('、')}</p>
          </article>
          <article class="rounded-md border bg-background p-3">
            <p class="text-xs text-muted-foreground">创建人</p>
            <p class="mt-1 text-sm">${escapeHtml(template.creator)}</p>
          </article>
          <article class="rounded-md border bg-background p-3">
            <p class="text-xs text-muted-foreground">创建时间</p>
            <p class="mt-1 text-sm">${escapeHtml(template.createdAt)}</p>
          </article>
          <article class="rounded-md border bg-background p-3">
            <p class="text-xs text-muted-foreground">最近更新时间</p>
            <p class="mt-1 text-sm">${escapeHtml(template.updatedAt)}</p>
          </article>
        </div>
        <p class="mt-3 text-sm text-muted-foreground">${escapeHtml(template.description)}</p>
      </section>

      <section class="rounded-lg border bg-card p-4">
        <h2 class="mb-3 text-sm font-semibold">阶段定义</h2>
        <div class="space-y-2">
          ${template.stages
            .map(
              (stage) => `
                <article class="rounded-md border bg-background px-3 py-2 text-sm">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p class="font-medium">${escapeHtml(stage.phaseName)}</p>
                      <p class="mt-1 text-xs text-muted-foreground">阶段编码：${escapeHtml(stage.phaseCode)} ｜ 阶段顺序：${stage.phaseOrder}</p>
                    </div>
                    <span class="inline-flex rounded-full border bg-muted px-2 py-0.5 text-xs">${stage.requiredFlag ? '必经阶段' : '可选阶段'}</span>
                  </div>
                  <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(stage.description || '暂无阶段说明')}</p>
                </article>
              `,
            )
            .join('')}
        </div>
      </section>

      <section class="rounded-lg border bg-card p-4">
        <h2 class="mb-3 text-sm font-semibold">节点定义</h2>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1100px] text-xs">
            <thead>
              <tr class="border-b text-left text-muted-foreground">
                <th class="px-2 py-1.5 font-medium">阶段</th>
                <th class="px-2 py-1.5 font-medium">顺序</th>
                <th class="px-2 py-1.5 font-medium">标准工作项编号</th>
                <th class="px-2 py-1.5 font-medium">标准工作项名称</th>
                <th class="px-2 py-1.5 font-medium">工作项类别</th>
                <th class="px-2 py-1.5 font-medium">是否必做</th>
                <th class="px-2 py-1.5 font-medium">是否允许多次执行</th>
                <th class="px-2 py-1.5 font-medium">角色覆盖</th>
                <th class="px-2 py-1.5 font-medium">节点备注</th>
              </tr>
            </thead>
            <tbody>
              ${template.nodes
                .map((node) => {
                  const workItem = getPcsWorkItemDefinition(node.workItemId)
                  return `
                    <tr class="border-b last:border-b-0">
                      <td class="px-2 py-1.5">${escapeHtml(node.phaseName)}</td>
                      <td class="px-2 py-1.5">${node.sequenceNo}</td>
                      <td class="px-2 py-1.5 font-mono">${escapeHtml(node.workItemId)}</td>
                      <td class="px-2 py-1.5">
                        <p class="font-medium">${escapeHtml(node.workItemTypeName)}</p>
                        <p class="mt-0.5 text-[11px] text-muted-foreground">${escapeHtml(node.workItemTypeCode)}</p>
                      </td>
                      <td class="px-2 py-1.5">${escapeHtml(workItem?.categoryName ?? '-')}</td>
                      <td class="px-2 py-1.5">${node.requiredFlag ? '必做' : '可选'}</td>
                      <td class="px-2 py-1.5">${node.multiInstanceFlag ? '允许' : '单次'}</td>
                      <td class="px-2 py-1.5">${escapeHtml(node.roleOverrideNames.join(' / ') || '沿用默认角色')}</td>
                      <td class="px-2 py-1.5 text-muted-foreground">${escapeHtml(node.note || '—')}</td>
                    </tr>
                  `
                })
                .join('')}
            </tbody>
          </table>
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

