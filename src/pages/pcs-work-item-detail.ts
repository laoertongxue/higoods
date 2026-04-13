import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { getPcsWorkItemDetailViewModel } from '../data/pcs-work-item-library-view-model.ts'

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

function renderReadonlyBadge(): string {
  return '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">标准只读</span>'
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

function renderHeader(name: string): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-work-item-detail-action="go-list">
          <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回工作项库
        </button>
        <h1 class="text-xl font-semibold">${escapeHtml(name)}</h1>
        <p class="text-sm text-muted-foreground">工作项定义说明书，统一说明正式字段、状态、操作、实例承载方式和旧版字段参考。</p>
      </div>
      <div class="flex items-center gap-2">
        ${renderReadonlyBadge()}
        <span class="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-xs text-slate-500">内置固定标准工作项</span>
      </div>
    </header>
  `
}

function renderBasicDefinition(detail: NonNullable<ReturnType<typeof getPcsWorkItemDetailViewModel>>): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">1. 基本定义</h2>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">正式名称</p>
          <div class="mt-1 flex items-center gap-2">
            <p class="text-sm font-medium">${escapeHtml(detail.item.name)}</p>
            ${renderNatureBadge(detail.item.nature)}
          </div>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">正式编号</p>
          <p class="mt-1 font-mono text-sm">${escapeHtml(detail.item.id)}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">正式编码</p>
          <p class="mt-1 font-mono text-sm">${escapeHtml(detail.item.code)}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">所属阶段</p>
          <p class="mt-1 text-sm">${escapeHtml(detail.item.phaseName)}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">工作项类别</p>
          <p class="mt-1 text-sm">${escapeHtml(detail.contract.categoryName)}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">默认角色</p>
          <p class="mt-1 text-sm">${escapeHtml(detail.contract.roleNames.join(' / '))}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">字段 / 状态 / 操作</p>
          <p class="mt-1 text-sm">${detail.meta.fieldCount} / ${detail.meta.statusCount} / ${detail.meta.operationCount}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">目录属性</p>
          <div class="mt-1">${renderReadonlyBadge()}</div>
        </article>
      </div>
      <div class="mt-3 rounded-md border bg-background p-3 text-sm text-muted-foreground">
        ${escapeHtml(detail.contract.description)}
      </div>
    </section>
  `
}

function renderBusinessDefinition(detail: NonNullable<ReturnType<typeof getPcsWorkItemDetailViewModel>>): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">2. 业务场景与保留原因</h2>
      <div class="grid gap-3 lg:grid-cols-2">
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">业务场景</p>
          <p class="mt-1 text-sm">${escapeHtml(detail.contract.scenario)}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">保留原因</p>
          <p class="mt-1 text-sm">${escapeHtml(detail.contract.keepReason)}</p>
        </article>
      </div>
    </section>
  `
}

function renderFieldGroups(detail: NonNullable<ReturnType<typeof getPcsWorkItemDetailViewModel>>): string {
  if (detail.fieldGroups.length === 0) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h2 class="mb-3 text-sm font-semibold">3. 字段清单</h2>
        <div class="rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">当前工作项未配置字段清单。</div>
      </section>
    `
  }

  return `
    <section class="space-y-4 rounded-lg border bg-card p-4">
      <h2 class="text-sm font-semibold">3. 字段清单</h2>
      ${detail.fieldGroups
        .map(
          (group, index) => `
            <article class="rounded-lg border bg-background p-3">
              <header class="mb-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <h3 class="text-sm font-medium">${index + 1}. ${escapeHtml(group.groupTitle)}</h3>
                  <span class="inline-flex rounded-full border bg-muted px-2 py-0.5 text-xs">${group.rows.length} 个字段</span>
                </div>
                <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(group.groupDescription)}</p>
              </header>
              <div class="overflow-x-auto">
                <table class="min-w-full text-sm">
                  <thead>
                    <tr class="border-b bg-muted/30 text-left text-muted-foreground">
                      <th class="px-3 py-2 font-medium">字段名称</th>
                      <th class="px-3 py-2 font-medium">字段键</th>
                      <th class="px-3 py-2 font-medium">类型</th>
                      <th class="px-3 py-2 font-medium">是否必填</th>
                      <th class="px-3 py-2 font-medium">字段定义</th>
                      <th class="px-3 py-2 font-medium">字段来源</th>
                      <th class="px-3 py-2 font-medium">是否来自旧版参考</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${group.rows
                      .map(
                        (field) => `
                          <tr class="border-b last:border-b-0">
                            <td class="px-3 py-2 align-top">
                              <p class="font-medium">${escapeHtml(field.label)}</p>
                              ${field.readonly ? '<p class="mt-1 text-xs text-slate-500">只读字段</p>' : ''}
                            </td>
                            <td class="px-3 py-2 align-top font-mono text-xs text-muted-foreground">${escapeHtml(field.fieldKey)}</td>
                            <td class="px-3 py-2 align-top">${escapeHtml(FIELD_TYPE_LABELS[field.type] ?? field.type)}</td>
                            <td class="px-3 py-2 align-top">${field.required ? '<span class="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">必填</span>' : '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">选填</span>'}</td>
                            <td class="px-3 py-2 align-top text-sm">${escapeHtml(field.meaning)}</td>
                            <td class="px-3 py-2 align-top text-xs text-muted-foreground">
                              <p>${escapeHtml(field.sourceText)}</p>
                            </td>
                            <td class="px-3 py-2 align-top">${field.fromLegacyReference ? '<span class="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">是</span>' : '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">否</span>'}</td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            </article>
          `,
        )
        .join('')}
    </section>
  `
}

function renderStatuses(detail: NonNullable<ReturnType<typeof getPcsWorkItemDetailViewModel>>): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">4. 状态定义</h2>
      ${
        detail.statusDefinitions.length > 0
          ? `
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="border-b bg-muted/30 text-left text-muted-foreground">
                    <th class="px-3 py-2 font-medium">状态名称</th>
                    <th class="px-3 py-2 font-medium">业务含义</th>
                    <th class="px-3 py-2 font-medium">进入条件</th>
                    <th class="px-3 py-2 font-medium">退出触发</th>
                  </tr>
                </thead>
                <tbody>
                  ${detail.statusDefinitions
                    .map(
                      (status) => `
                        <tr class="border-b last:border-b-0">
                          <td class="px-3 py-2 align-top font-medium">${escapeHtml(status.statusName)}</td>
                          <td class="px-3 py-2 align-top">${escapeHtml(status.businessMeaning)}</td>
                          <td class="px-3 py-2 align-top text-xs text-muted-foreground">${status.entryConditions.length > 0 ? escapeHtml(status.entryConditions.join('；')) : '—'}</td>
                          <td class="px-3 py-2 align-top text-xs text-muted-foreground">${status.exitConditions.length > 0 ? escapeHtml(status.exitConditions.join('；')) : '—'}</td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          : '<div class="rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">当前工作项未配置独立状态机，跟随项目节点状态执行。</div>'
      }
    </section>
  `
}

function renderOperations(detail: NonNullable<ReturnType<typeof getPcsWorkItemDetailViewModel>>): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">5. 可操作项</h2>
      ${
        detail.operationDefinitions.length > 0
          ? `
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="border-b bg-muted/30 text-left text-muted-foreground">
                    <th class="px-3 py-2 font-medium">操作名称</th>
                    <th class="px-3 py-2 font-medium">前置条件</th>
                    <th class="px-3 py-2 font-medium">执行效果</th>
                    <th class="px-3 py-2 font-medium">写回规则</th>
                  </tr>
                </thead>
                <tbody>
                  ${detail.operationDefinitions
                    .map(
                      (operation) => `
                        <tr class="border-b last:border-b-0">
                          <td class="px-3 py-2 align-top font-medium">${escapeHtml(operation.actionName)}</td>
                          <td class="px-3 py-2 align-top text-xs text-muted-foreground">${operation.preconditions.length > 0 ? escapeHtml(operation.preconditions.join('；')) : '—'}</td>
                          <td class="px-3 py-2 align-top text-xs text-muted-foreground">${operation.effects.length > 0 ? escapeHtml(operation.effects.join('；')) : '—'}</td>
                          <td class="px-3 py-2 align-top text-xs text-muted-foreground">${operation.writebackRules.length > 0 ? escapeHtml(operation.writebackRules.join('；')) : '—'}</td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          : '<div class="rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">当前工作项无独立页面动作，由项目节点流转驱动。</div>'
      }
    </section>
  `
}

function renderCarrier(detail: NonNullable<ReturnType<typeof getPcsWorkItemDetailViewModel>>): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">6. 实例承载方式</h2>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">实例承载方式</p>
          <p class="mt-1 text-sm font-medium">${escapeHtml(detail.meta.libraryDisplayKind)}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">运行时承载</p>
          <p class="mt-1 text-sm">${escapeHtml(detail.meta.runtimeCarrierLabel)}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">是否有独立实例列表</p>
          <p class="mt-1 text-sm">${detail.meta.hasStandaloneInstanceList ? '是' : '否'}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">主实例模块</p>
          <p class="mt-1 text-sm">${escapeHtml(detail.meta.moduleName)}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">列表入口</p>
          <p class="mt-1 text-sm">${escapeHtml(detail.meta.listRoute || '项目内查看，无独立列表入口')}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">项目节点默认展示方式</p>
          <p class="mt-1 text-sm">${escapeHtml(detail.meta.projectDisplayRequirementLabel)}</p>
        </article>
      </div>
      <div class="mt-3 rounded-md border bg-background p-3 text-sm text-muted-foreground">
        ${escapeHtml(detail.meta.carrierReason)}
      </div>
    </section>
  `
}

function renderProjectDisplay(detail: NonNullable<ReturnType<typeof getPcsWorkItemDetailViewModel>>): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">7. 项目内展示要求</h2>
      <div class="grid gap-3 lg:grid-cols-2">
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">默认展示方式</p>
          <p class="mt-1 text-sm font-medium">${escapeHtml(detail.meta.projectDisplayRequirementLabel)}</p>
          <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(detail.projectDisplayRequirementText)}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">当前目录说明</p>
          <p class="mt-1 text-sm">${escapeHtml(detail.meta.projectDisplayMode)}</p>
        </article>
      </div>
    </section>
  `
}

function renderConstraints(detail: NonNullable<ReturnType<typeof getPcsWorkItemDetailViewModel>>): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">8. 系统约束</h2>
      <div class="grid gap-4 lg:grid-cols-2">
        <article class="rounded-md border bg-background p-3">
          <h3 class="text-sm font-medium">业务规则</h3>
          ${
            detail.contract.businessRules.length > 0
              ? `<ul class="mt-2 space-y-2 text-sm text-muted-foreground">${detail.contract.businessRules.map((item) => `<li class="rounded-md border bg-card px-3 py-2">${escapeHtml(item)}</li>`).join('')}</ul>`
              : '<p class="mt-2 text-sm text-muted-foreground">当前工作项未配置业务规则。</p>'
          }
        </article>
        <article class="rounded-md border bg-background p-3">
          <h3 class="text-sm font-medium">系统限制</h3>
          ${
            detail.contract.systemConstraints.length > 0
              ? `<ul class="mt-2 space-y-2 text-sm text-muted-foreground">${detail.contract.systemConstraints.map((item) => `<li class="rounded-md border bg-card px-3 py-2">${escapeHtml(item)}</li>`).join('')}</ul>`
              : '<p class="mt-2 text-sm text-muted-foreground">当前工作项未配置系统限制。</p>'
          }
        </article>
      </div>
    </section>
  `
}

function renderLegacyReference(detail: NonNullable<ReturnType<typeof getPcsWorkItemDetailViewModel>>): string {
  if (!detail.legacyReference) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h2 class="mb-3 text-sm font-semibold">9. 旧版字段参考</h2>
        <div class="rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">当前工作项未配置旧版字段参考。</div>
      </section>
    `
  }

  const modeText =
    detail.legacyReference.referenceUseMode === 'DIRECT_MAPPING'
      ? '直接映射'
      : detail.legacyReference.referenceUseMode === 'PARTIAL_REFERENCE'
        ? '部分参考'
        : '仅展示参考'

  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-semibold">9. 旧版字段参考</h2>
      <details class="rounded-md border bg-background">
        <summary class="cursor-pointer list-none px-3 py-3 text-sm font-medium">
          <div class="flex items-center justify-between gap-3">
            <span>展开查看旧版字段参考</span>
            <span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(modeText)}</span>
          </div>
        </summary>
        <div class="space-y-4 border-t px-3 py-3">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <article class="rounded-md border bg-card p-3">
              <p class="text-xs text-muted-foreground">旧版工作项编码</p>
              <p class="mt-1 text-sm">${escapeHtml(detail.legacyReference.legacyCodes.join(' / ') || '无')}</p>
            </article>
            <article class="rounded-md border bg-card p-3">
              <p class="text-xs text-muted-foreground">旧版工作项名称</p>
              <p class="mt-1 text-sm">${escapeHtml(detail.legacyReference.legacyNames.join(' / ') || '无')}</p>
            </article>
            <article class="rounded-md border bg-card p-3">
              <p class="text-xs text-muted-foreground">当前采用方式</p>
              <p class="mt-1 text-sm">${escapeHtml(modeText)}</p>
            </article>
          </div>
          <div class="grid gap-4 lg:grid-cols-2">
            <article class="rounded-md border bg-card p-3">
              <h3 class="text-sm font-medium">旧版字段组标题</h3>
              <ul class="mt-2 space-y-2 text-sm text-muted-foreground">
                ${detail.legacyReference.legacyFieldGroupTitles.map((item) => `<li class="rounded-md border bg-background px-3 py-2">${escapeHtml(item)}</li>`).join('')}
              </ul>
            </article>
            <article class="rounded-md border bg-card p-3">
              <h3 class="text-sm font-medium">旧版字段标签</h3>
              <div class="mt-2 flex flex-wrap gap-2">
                ${detail.legacyReference.legacyFieldLabels.map((item) => `<span class="inline-flex rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground">${escapeHtml(item)}</span>`).join('')}
              </div>
            </article>
          </div>
        </div>
      </details>
    </section>
  `
}

export function renderPcsWorkItemDetailPage(workItemId: string): string {
  state.workItemId = workItemId
  const detail = getPcsWorkItemDetailViewModel(workItemId)

  if (!detail) {
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
      ${renderHeader(detail.item.name)}
      ${renderBasicDefinition(detail)}
      ${renderBusinessDefinition(detail)}
      ${renderFieldGroups(detail)}
      ${renderStatuses(detail)}
      ${renderOperations(detail)}
      ${renderCarrier(detail)}
      ${renderProjectDisplay(detail)}
      ${renderConstraints(detail)}
      ${renderLegacyReference(detail)}
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

  return false
}
