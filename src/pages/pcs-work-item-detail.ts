import { appStore } from '../state/store'
import {
  getPcsWorkItemById,
  getPcsWorkItemMeta,
  getPcsWorkItemTemplateConfig,
} from '../data/pcs-work-items'
import type { FieldConfig, WorkItemTemplateConfig } from '../data/pcs-work-item-configs'
import { escapeHtml } from '../utils'

interface WorkItemDetailState {
  workItemId: string
}

const state: WorkItemDetailState = {
  workItemId: '',
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: '单行文本',
  textarea: '多行文本',
  select: '下拉选择',
  'single-select': '单选下拉',
  'multi-select': '多选标签',
  'cascade-select': '级联选择',
  number: '数字',
  date: '日期',
  datetime: '日期时间',
  computed: '自动计算',
  image: '图片上传',
  file: '文件上传',
  files: '多文件上传',
  reference: '关联引用',
  'reference-multi': '多关联引用',
  user: '用户选择',
  'user-select': '用户选择',
  'user-multi-select': '多用户选择',
  'team-select': '团队选择',
  url: 'URL 链接',
  URL: 'URL 链接',
  tags: '标签',
  log: '操作日志',
  enum: '枚举',
  枚举: '枚举',
  字符串: '字符串',
  整数: '整数',
  '数字+币种': '数字+币种',
  用户引用: '用户引用',
  'user-reference': '用户引用',
  'size-template': '尺码模板',
  system: '系统字段',
  boolean: '布尔值',
  json: 'JSON',
}

function renderStatusBadge(status: string): string {
  if (status === '启用') {
    return '<span class="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">启用</span>'
  }
  if (status === '停用') {
    return '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">停用</span>'
  }
  return '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">未知</span>'
}

function renderTypeBadge(type: string): string {
  const isDecision = type === 'decision'
  const isFact = type === '事实型'
  if (isFact) {
    return '<span class="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs text-violet-700">事实型</span>'
  }
  if (isDecision) {
    return '<span class="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs text-orange-700">决策类</span>'
  }
  return '<span class="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">执行类</span>'
}

function getFieldTypeLabel(type: string): string {
  return FIELD_TYPE_LABELS[type] ?? type
}

function formatValue(value: unknown): string {
  if (value == null) return '-'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function formatValidation(validation: unknown): string {
  if (!validation) return ''
  if (typeof validation === 'string') return validation
  if (typeof validation === 'object') {
    const record = validation as Record<string, unknown>
    const pieces: string[] = []
    if (typeof record.min === 'number') pieces.push(`最小值 ${record.min}`)
    if (typeof record.max === 'number') pieces.push(`最大值 ${record.max}`)
    return pieces.length > 0 ? pieces.join('，') : JSON.stringify(record)
  }
  return String(validation)
}

function toStatusOptionColorClass(color: unknown): string {
  if (color === 'green') return 'bg-green-500'
  if (color === 'red') return 'bg-red-500'
  if (color === 'yellow') return 'bg-yellow-500'
  if (color === 'blue') return 'bg-blue-500'
  return 'bg-slate-400'
}

function renderBasicCard(config: WorkItemTemplateConfig, status: string): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">基础信息</h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">工作项编码</p>
          <p class="mt-1 font-mono text-sm">${escapeHtml(config.code || config.id)}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">工作项分类</p>
          <p class="mt-1 text-sm">${escapeHtml(config.category || config.stage || '-')}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">默认执行角色</p>
          <p class="mt-1 text-sm">${escapeHtml(config.role || '-')}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">当前状态</p>
          <div class="mt-1">${renderStatusBadge(status)}</div>
        </article>
      </div>
    </section>
  `
}

function renderCapabilitiesCard(config: WorkItemTemplateConfig): string {
  const capabilities = config.capabilities
  if (!capabilities) return ''

  const rows = [
    { label: '可复用', enabled: capabilities.canReuse },
    { label: '可多实例', enabled: capabilities.canMultiInstance },
    { label: '可回退', enabled: capabilities.canRollback },
    { label: '可并行', enabled: capabilities.canParallel },
  ]

  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">工作项能力定义</h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        ${rows
          .map(
            (item) => `
              <article class="rounded-md border bg-background p-3">
                <p class="text-xs text-muted-foreground">${item.label}</p>
                <p class="mt-1 text-sm font-medium ${item.enabled ? 'text-emerald-700' : 'text-slate-500'}">${item.enabled ? '是' : '否'}</p>
              </article>
            `,
          )
          .join('')}
      </div>
      ${config.capabilityDescription || config.capabilityNotes ? `<p class="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">${escapeHtml(config.capabilityDescription || config.capabilityNotes || '')}</p>` : ''}
    </section>
  `
}

function renderFieldRow(field: FieldConfig): string {
  const validationText = formatValidation(field.validation)

  return `
    <tr class="border-b last:border-b-0">
      <td class="px-3 py-2 align-top">
        <p class="font-medium">${escapeHtml(field.label)}</p>
        <p class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(field.id)}</p>
      </td>
      <td class="px-3 py-2 align-top text-sm">${escapeHtml(getFieldTypeLabel(field.type))}</td>
      <td class="px-3 py-2 align-top">${field.required ? '<span class="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">必填</span>' : '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">选填</span>'}</td>
      <td class="px-3 py-2 align-top text-xs text-muted-foreground">
        <p>${escapeHtml(field.description || '-')}</p>
        ${field.conditionalRequired ? `<p class="mt-1 text-orange-600">条件必填：${escapeHtml(field.conditionalRequired)}</p>` : ''}
        ${validationText ? `<p class="mt-1 text-blue-600">校验：${escapeHtml(validationText)}</p>` : ''}
        ${field.unit ? `<p class="mt-1">单位：${escapeHtml(field.unit)}</p>` : ''}
      </td>
    </tr>
  `
}

function renderFieldGroups(config: WorkItemTemplateConfig): string {
  if (!config.fieldGroups?.length) {
    return `
      <section class="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        暂无字段定义
      </section>
    `
  }

  return `
    <section class="space-y-4 rounded-lg border bg-card p-4">
      <h2 class="text-sm font-semibold">字段定义</h2>
      ${config.fieldGroups
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
        .join('')}
    </section>
  `
}

function renderValidationRules(config: WorkItemTemplateConfig): string {
  if (!config.validationRules?.length) return ''
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">条件必填与校验规则</h2>
      <ul class="space-y-2 text-sm">
        ${config.validationRules.map((rule) => `<li class="rounded-md border bg-background px-3 py-2">${escapeHtml(rule)}</li>`).join('')}
      </ul>
    </section>
  `
}

function renderStatusDefinitions(config: WorkItemTemplateConfig): string {
  const hasStatus =
    (Array.isArray(config.statusOptions) && config.statusOptions.length > 0) ||
    Boolean(config.statusFlow) ||
    (Array.isArray(config.rollbackRules) && config.rollbackRules.length > 0)
  if (!hasStatus) return ''

  const statusFlowText = Array.isArray(config.statusFlow)
    ? config.statusFlow
        .map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object') {
            const record = item as Record<string, unknown>
            if (record.from && record.to) {
              return `${String(record.from)} -> ${String(record.to)}${record.action ? `（${String(record.action)}）` : ''}`
            }
          }
          return String(item)
        })
        .join('；')
    : typeof config.statusFlow === 'string'
      ? config.statusFlow
      : ''

  return `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <h2 class="text-sm font-semibold">状态定义</h2>
      ${statusFlowText ? `<p class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">状态流转：${escapeHtml(statusFlowText)}</p>` : ''}
      ${
        config.statusOptions?.length
          ? `<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">${config.statusOptions
              .map(
                (status) => `
                  <article class="rounded-md border bg-background p-3">
                    <div class="flex items-center gap-2">
                      <span class="h-2.5 w-2.5 rounded-full ${toStatusOptionColorClass(status.color)}"></span>
                      <p class="text-sm font-medium">${escapeHtml(status.label)}</p>
                    </div>
                    ${status.description ? `<p class="mt-1 text-xs text-muted-foreground">${escapeHtml(status.description)}</p>` : ''}
                  </article>
                `,
              )
              .join('')}</div>`
          : ''
      }
      ${
        config.rollbackRules?.length
          ? `<div class="rounded-md border border-orange-200 bg-orange-50 p-3">
               <p class="mb-2 text-xs font-medium text-orange-700">回退规则</p>
               <ul class="space-y-1 text-xs text-orange-700">${config.rollbackRules.map((rule) => `<li>• ${escapeHtml(rule)}</li>`).join('')}</ul>
             </div>`
          : ''
      }
    </section>
  `
}

function renderPermissions(config: WorkItemTemplateConfig): string {
  if (!config.permissions?.length) return ''
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">权限与可编辑性</h2>
      <div class="grid gap-2 md:grid-cols-2">
        ${config.permissions
          .map(
            (permission) => `
              <article class="rounded-md border bg-background p-3">
                <p class="text-sm font-medium">${escapeHtml(permission.role)}</p>
                <div class="mt-2 flex flex-wrap gap-1">
                  ${permission.actions.map((action) => `<span class="inline-flex rounded-md border bg-muted px-2 py-0.5 text-xs">${escapeHtml(action)}</span>`).join('')}
                </div>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderStringListCard(title: string, rows: string[]): string {
  if (!rows.length) return ''
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">${escapeHtml(title)}</h2>
      <ul class="space-y-2 text-sm">
        ${rows.map((row) => `<li class="rounded-md border bg-background px-3 py-2">${escapeHtml(row)}</li>`).join('')}
      </ul>
    </section>
  `
}

function renderExampleCard(config: WorkItemTemplateConfig): string {
  if (!config.example || Object.keys(config.example).length === 0) return ''

  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">示例数据</h2>
      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        ${Object.entries(config.example)
          .map(
            ([key, value]) => `
              <article class="rounded-md border bg-background p-3">
                <p class="text-xs text-muted-foreground">${escapeHtml(key)}</p>
                <p class="mt-1 text-sm">${escapeHtml(formatValue(value))}</p>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderApiHints(config: WorkItemTemplateConfig): string {
  if (!config.apiHints?.requiredFields?.length && !config.apiHints?.optionalFields?.length) return ''

  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">API / 表结构提示</h2>
      <div class="space-y-3">
        ${
          config.apiHints?.requiredFields?.length
            ? `<div>
                 <p class="mb-2 text-xs text-muted-foreground">必存字段</p>
                 <div class="flex flex-wrap gap-1">${config.apiHints.requiredFields.map((field) => `<span class="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-xs text-emerald-700">${escapeHtml(field)}</span>`).join('')}</div>
               </div>`
            : ''
        }
        ${
          config.apiHints?.optionalFields?.length
            ? `<div>
                 <p class="mb-2 text-xs text-muted-foreground">可选字段</p>
                 <div class="flex flex-wrap gap-1">${config.apiHints.optionalFields.map((field) => `<span class="inline-flex rounded-md border bg-muted px-2 py-0.5 font-mono text-xs">${escapeHtml(field)}</span>`).join('')}</div>
               </div>`
            : ''
        }
      </div>
    </section>
  `
}

function renderConfigDetail(config: WorkItemTemplateConfig, status: string): string {
  return `
    <div class="space-y-4">
      ${renderBasicCard(config, status)}
      ${renderCapabilitiesCard(config)}
      ${renderFieldGroups(config)}
      ${renderValidationRules(config)}
      ${renderStatusDefinitions(config)}
      ${renderPermissions(config)}
      ${renderStringListCard('系统约束说明', config.systemConstraints ?? [])}
      ${renderStringListCard('业务规则', config.businessRules ?? [])}
      ${renderStringListCard('交互说明', config.interactions ?? [])}
      ${renderStringListCard('页面限制说明', config.pageLimitations ?? config.pageConstraints ?? [])}
      ${renderStringListCard('UI 呈现建议', config.uiSuggestions ?? [])}
      ${renderExampleCard(config)}
      ${renderApiHints(config)}
      ${renderStringListCard('扩展建议', config.extensionSuggestions ?? [])}
    </div>
  `
}

function renderCustomWorkItemDetail(workItemId: string): string {
  const workItem = getPcsWorkItemById(workItemId)
  if (!workItem) {
    return `
      <section class="rounded-lg border border-dashed bg-card px-4 py-14 text-center text-muted-foreground">
        <i data-lucide="file-x-2" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
        <p class="mt-2">未找到工作项：${escapeHtml(workItemId)}</p>
      </section>
    `
  }

  const meta = getPcsWorkItemMeta(workItemId)

  return `
    <section class="space-y-4 rounded-lg border bg-card p-4">
      <h2 class="text-sm font-semibold">工作项基础信息</h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">工作项编码</p>
          <p class="mt-1 font-mono text-sm">${escapeHtml(workItem.id)}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">工作项分类</p>
          <p class="mt-1 text-sm">${escapeHtml(workItem.category)}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">工作项性质</p>
          <div class="mt-1">${renderTypeBadge(workItem.nature === '决策类' ? 'decision' : 'execute')}</div>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">状态</p>
          <div class="mt-1">${renderStatusBadge(workItem.status)}</div>
        </article>
      </div>

      <article class="rounded-md border bg-background p-3">
        <p class="text-xs text-muted-foreground">工作项说明</p>
        <p class="mt-1 text-sm">${escapeHtml(workItem.desc)}</p>
      </article>

      <article class="rounded-md border bg-background p-3">
        <p class="text-xs text-muted-foreground">默认执行角色</p>
        <div class="mt-2 flex flex-wrap gap-1">
          ${(meta?.roles ?? workItem.role.split(/[、,/，\s]+/).filter(Boolean)).map((role) => `<span class="inline-flex rounded-md border bg-muted px-2 py-0.5 text-xs">${escapeHtml(role)}</span>`).join('')}
        </div>
      </article>

      <article class="rounded-md border bg-background p-3">
        <p class="text-xs text-muted-foreground">默认字段模型</p>
        <div class="mt-2 flex flex-wrap gap-1">
          ${(meta?.fieldModels ?? []).length > 0 ? (meta?.fieldModels ?? []).map((model) => `<span class="inline-flex rounded-md border bg-muted px-2 py-0.5 text-xs">${escapeHtml(model)}</span>`).join('') : '<span class="text-xs text-muted-foreground">暂无字段模型配置</span>'}
        </div>
      </article>

      <p class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">该工作项为演示态新增项，尚无系统内置的字段分组模板，后续可在编辑页补充配置并在模板中复用。</p>
    </section>
  `
}

export function renderPcsWorkItemDetailPage(workItemId: string): string {
  state.workItemId = workItemId

  const workItem = getPcsWorkItemById(workItemId)
  const config = getPcsWorkItemTemplateConfig(workItemId)

  if (!workItem && !config) {
    return `
      <div class="space-y-4">
        <header class="flex items-center gap-2">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-detail-action="go-list">
            <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回工作项库
          </button>
        </header>
        ${renderCustomWorkItemDetail(workItemId)}
      </div>
    `
  }

  const title = workItem?.name || config?.name || workItemId
  const status = workItem?.status || '启用'
  const typeLabel =
    config?.type === 'decision' || workItem?.nature === '决策类'
      ? 'decision'
      : config?.type === '事实型'
        ? '事实型'
        : 'execute'

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
        <div class="space-y-2">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-detail-action="go-list">
            <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回工作项库
          </button>
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-xl font-semibold">${escapeHtml(title)}</h1>
            ${config?.code ? `<span class="inline-flex rounded-md border bg-muted px-2 py-0.5 font-mono text-xs">${escapeHtml(config.code)}</span>` : ''}
            ${renderTypeBadge(typeLabel)}
            ${config?.isBuiltin ? '<span class="inline-flex rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">系统内置</span>' : ''}
            ${renderStatusBadge(status)}
          </div>
          <p class="text-sm text-muted-foreground">${escapeHtml(config?.description || workItem?.desc || '工作项详情')}</p>
        </div>
        <div class="flex items-center gap-2">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-detail-action="go-edit">
            <i data-lucide="edit-3" class="mr-1 h-3.5 w-3.5"></i>编辑工作项
          </button>
        </div>
      </header>

      ${config ? renderConfigDetail(config, status) : renderCustomWorkItemDetail(workItemId)}
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

  if (action === 'go-edit') {
    if (!state.workItemId) return false
    appStore.navigate(`/pcs/work-items/${state.workItemId}/edit`)
    return true
  }

  return false
}
