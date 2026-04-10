import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { getPcsWorkItemTemplateConfig } from '../data/pcs-work-items'
import type { FieldConfig, WorkItemTemplateConfig } from '../data/pcs-work-item-configs'

interface WorkItemDetailState {
  workItemId: string
}

const state: WorkItemDetailState = {
  workItemId: '',
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: '单行文本',
  textarea: '多行文本',
  number: '数字',
  select: '下拉选择',
  'multi-select': '多选标签',
  date: '日期',
  datetime: '日期时间',
  image: '图片上传',
  file: '文件上传',
  'cascade-select': '级联选择',
  'single-select': '单选下拉',
  'user-select': '用户选择',
  'user-multi-select': '多用户选择',
  'team-select': '团队选择',
  url: '链接',
  reference: '关联引用',
  'reference-multi': '多项关联',
  system: '系统字段',
}

function renderStatusBadge(enabledFlag: boolean): string {
  return enabledFlag
    ? '<span class="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">启用</span>'
    : '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">停用</span>'
}

function renderNatureBadge(nature: string): string {
  if (nature === '决策类') {
    return '<span class="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs text-orange-700">决策类</span>'
  }
  if (nature === '里程碑类') {
    return '<span class="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs text-violet-700">里程碑类</span>'
  }
  if (nature === '事实类') {
    return '<span class="inline-flex rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2 py-0.5 text-xs text-fuchsia-700">事实类</span>'
  }
  return '<span class="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">执行类</span>'
}

function renderCapability(enabled: boolean, label: string): string {
  return `
    <article class="rounded-md border bg-background p-3">
      <p class="text-xs text-muted-foreground">${label}</p>
      <p class="mt-1 text-sm font-medium ${enabled ? 'text-emerald-700' : 'text-slate-500'}">${enabled ? '是' : '否'}</p>
    </article>
  `
}

function renderFieldRow(field: FieldConfig): string {
  const validationText =
    field.validation && (field.validation.min != null || field.validation.max != null)
      ? `最小值 ${field.validation.min ?? '-'}，最大值 ${field.validation.max ?? '-'}`
      : ''

  return `
    <tr class="border-b last:border-b-0">
      <td class="px-3 py-2 align-top">
        <p class="font-medium">${escapeHtml(field.label)}</p>
        <p class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(field.id)}</p>
      </td>
      <td class="px-3 py-2 align-top text-sm">${escapeHtml(FIELD_TYPE_LABELS[field.type] ?? field.type)}</td>
      <td class="px-3 py-2 align-top">${field.required ? '<span class="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">必填</span>' : '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">选填</span>'}</td>
      <td class="px-3 py-2 align-top text-xs text-muted-foreground">
        <p>${escapeHtml(field.description || '无说明')}</p>
        ${field.conditionalRequired ? `<p class="mt-1 text-orange-600">条件必填：${escapeHtml(field.conditionalRequired)}</p>` : ''}
        ${validationText ? `<p class="mt-1 text-blue-600">校验：${escapeHtml(validationText)}</p>` : ''}
      </td>
    </tr>
  `
}

function renderHeader(config: WorkItemTemplateConfig): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-detail-action="go-list">
          <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回工作项库
        </button>
        <h1 class="text-xl font-semibold">${escapeHtml(config.workItemTypeName)}</h1>
        <p class="text-sm text-muted-foreground">工作项详情只展示统一定义层中的正式字段，不再拼接页面演示对象。</p>
      </div>
      <div class="flex items-center gap-2">
        ${config.isBuiltin ? '<span class="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-xs text-slate-500">内置工作项</span>' : '<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-detail-action="go-edit">编辑工作项</button>'}
      </div>
    </header>
  `
}

function renderSummary(config: WorkItemTemplateConfig): string {
  return `
    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article class="rounded-lg border bg-card p-4">
        <p class="text-xs text-muted-foreground">正式编号</p>
        <p class="mt-1 font-mono text-sm">${escapeHtml(config.workItemId)}</p>
      </article>
      <article class="rounded-lg border bg-card p-4">
        <p class="text-xs text-muted-foreground">正式编码</p>
        <p class="mt-1 font-mono text-sm">${escapeHtml(config.workItemTypeCode)}</p>
      </article>
      <article class="rounded-lg border bg-card p-4">
        <p class="text-xs text-muted-foreground">所属阶段</p>
        <p class="mt-1 text-sm">${escapeHtml(config.defaultPhaseName)}</p>
      </article>
      <article class="rounded-lg border bg-card p-4">
        <p class="text-xs text-muted-foreground">当前状态</p>
        <div class="mt-1">${renderStatusBadge(config.enabledFlag)}</div>
      </article>
    </section>
  `
}

function renderBasicInfo(config: WorkItemTemplateConfig): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">节点基本定义</h2>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">正式名称</p>
          <div class="mt-1 flex items-center gap-2">
            <p class="text-sm font-medium">${escapeHtml(config.workItemTypeName)}</p>
            ${renderNatureBadge(config.workItemNature)}
          </div>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">工作项类别</p>
          <p class="mt-1 text-sm">${escapeHtml(config.categoryName)}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">默认角色</p>
          <p class="mt-1 text-sm">${escapeHtml(config.roleNames.join(' / ') || '未配置')}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">模板可选</p>
          <p class="mt-1 text-sm ${config.isSelectableForTemplate ? 'text-emerald-700' : 'text-slate-500'}">${config.isSelectableForTemplate ? '可供模板选择' : '不可供模板选择'}</p>
        </article>
      </div>
      <div class="mt-3 rounded-md border bg-background p-3 text-sm text-muted-foreground">
        ${escapeHtml(config.description)}
      </div>
      ${
        config.isBuiltin
          ? '<p class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">内置工作项的核心身份字段、字段组和系统限制只能在统一定义层维护，页面中不允许直接修改。</p>'
          : ''
      }
    </section>
  `
}

function renderCapabilities(config: WorkItemTemplateConfig): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">能力与约束</h2>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        ${renderCapability(config.capabilities.canReuse, '是否可复用')}
        ${renderCapability(config.capabilities.canMultiInstance, '是否允许多次执行')}
        ${renderCapability(config.capabilities.canRollback, '是否允许回退')}
        ${renderCapability(config.capabilities.canParallel, '是否允许并行')}
      </div>
      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <article class="rounded-md border bg-background p-3">
          <h3 class="text-sm font-medium">业务规则</h3>
          ${
            config.businessRules.length > 0
              ? `<ul class="mt-2 space-y-2 text-sm text-muted-foreground">${config.businessRules.map((item) => `<li class="rounded-md border bg-card px-3 py-2">${escapeHtml(item)}</li>`).join('')}</ul>`
              : '<p class="mt-2 text-sm text-muted-foreground">暂无业务规则说明</p>'
          }
        </article>
        <article class="rounded-md border bg-background p-3">
          <h3 class="text-sm font-medium">系统限制</h3>
          ${
            config.systemConstraints.length > 0
              ? `<ul class="mt-2 space-y-2 text-sm text-muted-foreground">${config.systemConstraints.map((item) => `<li class="rounded-md border bg-card px-3 py-2">${escapeHtml(item)}</li>`).join('')}</ul>`
              : '<p class="mt-2 text-sm text-muted-foreground">暂无系统限制说明</p>'
          }
        </article>
      </div>
    </section>
  `
}

function renderFieldGroups(config: WorkItemTemplateConfig): string {
  return `
    <section class="space-y-4 rounded-lg border bg-card p-4">
      <h2 class="text-sm font-semibold">字段组定义</h2>
      ${
        config.fieldGroups.length > 0
          ? config.fieldGroups
              .map(
                (group, index) => `
                  <article class="rounded-lg border bg-background p-3">
                    <header class="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <h3 class="text-sm font-medium">${index + 1}. ${escapeHtml(group.title)}</h3>
                        ${group.description ? `<p class="mt-1 text-xs text-muted-foreground">${escapeHtml(group.description)}</p>` : ''}
                      </div>
                      <span class="inline-flex rounded-full border bg-muted px-2 py-0.5 text-xs">${group.fields.length} 个字段</span>
                    </header>
                    <div class="overflow-x-auto">
                      <table class="min-w-full text-sm">
                        <thead>
                          <tr class="border-b bg-muted/30 text-left text-muted-foreground">
                            <th class="px-3 py-2 font-medium">字段</th>
                            <th class="px-3 py-2 font-medium">类型</th>
                            <th class="px-3 py-2 font-medium">必填</th>
                            <th class="px-3 py-2 font-medium">说明 / 校验</th>
                          </tr>
                        </thead>
                        <tbody>${group.fields.map((field) => renderFieldRow(field)).join('')}</tbody>
                      </table>
                    </div>
                  </article>
                `,
              )
              .join('')
          : '<section class="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">暂无字段组定义</section>'
      }
    </section>
  `
}

function renderMeta(config: WorkItemTemplateConfig): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">维护信息</h2>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">工作项性质</p>
          <p class="mt-1 text-sm">${escapeHtml(config.workItemNature)}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">是否内置</p>
          <p class="mt-1 text-sm">${config.isBuiltin ? '内置工作项' : '自定义工作项'}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">创建时间</p>
          <p class="mt-1 text-sm">${escapeHtml(config.createdAt)}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">最近更新时间</p>
          <p class="mt-1 text-sm">${escapeHtml(config.updatedAt)}</p>
        </article>
      </div>
    </section>
  `
}

export function renderPcsWorkItemDetailPage(workItemId: string): string {
  state.workItemId = workItemId
  const config = getPcsWorkItemTemplateConfig(workItemId)

  if (!config) {
    return `
      <div class="space-y-4">
        <header>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-detail-action="go-list">
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
      ${renderHeader(config)}
      ${renderSummary(config)}
      ${renderBasicInfo(config)}
      ${renderCapabilities(config)}
      ${renderFieldGroups(config)}
      ${renderMeta(config)}
    </div>
  `
}

export function handlePcsWorkItemDetailEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-work-item-detail-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsWorkItemDetailAction
  if (!action) return false

  if (action === 'go-list') {
    appStore.navigate('/pcs/work-items')
    return true
  }

  if (action === 'go-edit' && state.workItemId) {
    appStore.navigate(`/pcs/work-items/${state.workItemId}/edit`)
    return true
  }

  return false
}
