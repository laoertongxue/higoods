import { appStore } from '../state/store.ts'
import {
  FLAT_DIMENSION_META,
  type ConfigOption,
  type ConfigStatus,
  type ConfigLog,
  type FlatDimensionId,
} from '../data/pcs-config-dimensions.ts'
import {
  canDeleteProductCategoryNode,
  canDisableProductCategoryNode,
  deleteProductCategoryNode,
  getConfigDimensionOption,
  getProductCategoryNode,
  listChildProductCategories,
  listConfigDimensionOptions,
  listConfigWorkspaceSummaries,
  listRootProductCategories,
  saveConfigDimensionOption,
  saveProductCategoryNode,
  type ConfigWorkspaceDimensionId,
  type ConfigWorkspaceOptionDraft,
  type ProductCategoryDraft,
  type ProductCategoryNode,
} from '../data/pcs-config-workspace-repository.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'

type WorkspaceStatusFilter = '全部状态' | '启用中' | '停用中'
type FlatModalMode = 'create' | 'edit' | 'logs'
type CategoryModalMode = 'create-root' | 'create-child' | 'edit' | 'logs'

interface FlatModalState {
  mode: FlatModalMode
  dimensionId: FlatDimensionId
  optionId: string | null
}

interface CategoryModalState {
  mode: CategoryModalMode
  nodeId: string | null
  parentId: string | null
}

const PRODUCT_CATEGORY_META = {
  id: 'productCategories' as const,
  name: '商品类目',
  description: '树形结构管理，支持三级类目',
}

const state = {
  activeDimension: PRODUCT_CATEGORY_META.id as ConfigWorkspaceDimensionId,
  search: '',
  statusFilter: '全部状态' as WorkspaceStatusFilter,
  notice: null as string | null,
  flatModal: null as FlatModalState | null,
  categoryModal: null as CategoryModalState | null,
  flatDraft: {
    nameZh: '',
    nameEn: '',
    sortOrder: '1',
    status: 'ENABLED' as ConfigStatus,
  },
  categoryDraft: {
    name: '',
    sortOrder: '1',
    status: 'ENABLED' as ConfigStatus,
  },
  expandedCategoryIds: new Set<string>(['product-category-1', 'product-category-2']),
}

function setNotice(message: string): void {
  state.notice = message
}

function clearNotice(): void {
  state.notice = null
}

function resetDrafts(): void {
  state.flatDraft = {
    nameZh: '',
    nameEn: '',
    sortOrder: '1',
    status: 'ENABLED',
  }
  state.categoryDraft = {
    name: '',
    sortOrder: '1',
    status: 'ENABLED',
  }
}

function getDimensionMeta(dimensionId: FlatDimensionId) {
  return FLAT_DIMENSION_META.find((item) => item.id === dimensionId) || FLAT_DIMENSION_META[0]
}

function getStatusLabel(status: ConfigStatus): string {
  return status === 'ENABLED' ? '启用' : '停用'
}

function renderStatusBadge(status: ConfigStatus): string {
  return `<span class="${escapeHtml(toClassName('inline-flex rounded-full px-3 py-1 text-xs font-medium', status === 'ENABLED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'))}">${escapeHtml(getStatusLabel(status))}</span>`
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-2">
          <i data-lucide="info" class="mt-0.5 h-4 w-4"></i>
          <p>${escapeHtml(state.notice)}</p>
        </div>
        <button type="button" class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-config-workspace-action="close-notice">关闭</button>
      </div>
    </section>
  `
}

function renderAuditPanel(dimensionName: string, updatedAt: string, updatedBy: string, logCount: number): string {
  return `
    <section class="rounded-xl border bg-slate-50 px-4 py-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-slate-900">审计信息</h3>
        </div>
        <span class="text-sm text-slate-500">${escapeHtml(dimensionName)}</span>
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <p class="text-sm text-slate-500">更新时间</p>
          <p class="mt-1.5 text-xl font-semibold text-slate-900">${escapeHtml(formatDateTime(updatedAt))}</p>
        </div>
        <div>
          <p class="text-sm text-slate-500">更新人</p>
          <p class="mt-1.5 text-xl font-semibold text-slate-900">${escapeHtml(updatedBy || '-')}</p>
        </div>
        <div>
          <p class="text-sm text-slate-500">日志条数</p>
          <p class="mt-1.5 text-xl font-semibold text-slate-900">${escapeHtml(String(logCount))} 条</p>
        </div>
      </div>
    </section>
  `
}

function renderLogCards(logs: ConfigLog[]): string {
  return `
    <div class="space-y-3">
      ${logs.map((log) => `
        <article class="rounded-xl border border-slate-200 px-4 py-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h4 class="text-sm font-semibold text-slate-900">${escapeHtml(log.action)}</h4>
            <p class="text-sm text-slate-500">${escapeHtml(formatDateTime(log.time))} ｜ ${escapeHtml(log.operator)}</p>
          </div>
          <p class="mt-2 text-sm leading-6 text-slate-600">${escapeHtml(log.detail)}</p>
        </article>
      `).join('')}
    </div>
  `
}

function renderModalShell(title: string, subtitle: string, body: string, closeAction: string, footer = ''): string {
  return `
    <div class="fixed inset-0 z-50">
      <button type="button" class="absolute inset-0 bg-slate-900/40" data-pcs-config-workspace-action="${escapeHtml(closeAction)}" aria-label="关闭侧栏"></button>
      <aside class="absolute inset-y-0 right-0 flex h-full w-full max-w-4xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div class="border-b border-slate-200 px-6 py-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-[24px] font-semibold leading-none text-slate-900">${escapeHtml(title)}</h2>
              <p class="mt-2 text-sm text-slate-500">${escapeHtml(subtitle)}</p>
            </div>
            <button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700" data-pcs-config-workspace-action="${escapeHtml(closeAction)}" aria-label="关闭侧栏">
              <i data-lucide="x" class="h-5 w-5"></i>
            </button>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">${body}</div>
        <div class="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          ${footer || `<button type="button" class="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50" data-pcs-config-workspace-action="${escapeHtml(closeAction)}">关闭</button>`}
        </div>
      </aside>
    </div>
  `
}

function renderReadonlyField(label: string, value: string): string {
  return `
    <label class="block">
      <span class="mb-2 block text-base font-semibold text-slate-900">${escapeHtml(label)}</span>
      <input class="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-500" value="${escapeHtml(value)}" disabled />
    </label>
  `
}

function renderEditableInput(label: string, field: string, value: string, required = false, placeholder = ''): string {
  return `
    <label class="block">
      <span class="mb-2 block text-base font-semibold text-slate-900">${escapeHtml(label)}${required ? '<span class="ml-1 text-rose-500">*</span>' : ''}</span>
      <input class="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-700 outline-none focus:border-blue-500" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" data-pcs-config-workspace-field="${escapeHtml(field)}" />
    </label>
  `
}

function renderEditableSelect(label: string, field: string, value: ConfigStatus): string {
  return `
    <label class="block">
      <span class="mb-2 block text-base font-semibold text-slate-900">${escapeHtml(label)}<span class="ml-1 text-rose-500">*</span></span>
      <select class="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-700 outline-none focus:border-blue-500" data-pcs-config-workspace-field="${escapeHtml(field)}">
        <option value="ENABLED" ${value === 'ENABLED' ? 'selected' : ''}>启用</option>
        <option value="DISABLED" ${value === 'DISABLED' ? 'selected' : ''}>停用</option>
      </select>
    </label>
  `
}

function renderSidebar(): string {
  const summaries = listConfigWorkspaceSummaries()
  return `
    <aside class="w-[238px] shrink-0 border-r border-slate-200 px-4 py-5">
      <h1 class="text-[18px] font-semibold text-slate-900">基础配置</h1>
      <div class="mt-5 space-y-1">
        ${summaries.map((summary) => `
          <button
            type="button"
            class="${escapeHtml(toClassName('flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-[15px] transition', state.activeDimension === summary.id ? 'bg-blue-50 text-blue-700' : 'text-slate-800 hover:bg-slate-50'))}"
            data-pcs-config-workspace-action="switch-dimension"
            data-dimension-id="${escapeHtml(summary.id)}"
          >
            <span class="${state.activeDimension === summary.id ? 'font-semibold' : 'font-medium'}">${escapeHtml(summary.name)}</span>
            ${typeof summary.count === 'number' ? `<span class="inline-flex min-w-8 items-center justify-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-sm text-slate-700">${escapeHtml(String(summary.count))}</span>` : ''}
          </button>
        `).join('')}
      </div>
    </aside>
  `
}

function getFilteredFlatOptions(dimensionId: FlatDimensionId): ConfigOption[] {
  const items = listConfigDimensionOptions(dimensionId)
  const keyword = state.search.trim().toLowerCase()
  return items.filter((item) => {
    const matchKeyword =
      keyword.length === 0 ||
      [item.code, item.name_zh, item.name_en, item.updatedBy].join(' ').toLowerCase().includes(keyword)
    const matchStatus =
      state.statusFilter === '全部状态' ||
      (state.statusFilter === '启用中' ? item.status === 'ENABLED' : item.status === 'DISABLED')
    return matchKeyword && matchStatus
  })
}

function renderMetricCards(items: ConfigOption[]): string {
  const enabledCount = items.filter((item) => item.status === 'ENABLED').length
  const latest = [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
  return `
    <section class="grid gap-3 xl:grid-cols-4">
      <article class="rounded-xl border border-slate-200 bg-white p-4">
        <p class="text-sm text-slate-500">配置项总数</p>
        <p class="mt-3 text-[32px] font-semibold leading-none text-slate-900">${items.length}</p>
      </article>
      <article class="rounded-xl border border-slate-200 bg-white p-4">
        <p class="text-sm text-slate-500">启用中</p>
        <p class="mt-3 text-[32px] font-semibold leading-none text-emerald-600">${enabledCount}</p>
      </article>
      <article class="rounded-xl border border-slate-200 bg-white p-4">
        <p class="text-sm text-slate-500">停用中</p>
        <p class="mt-3 text-[32px] font-semibold leading-none text-slate-700">${items.length - enabledCount}</p>
      </article>
      <article class="rounded-xl border border-slate-200 bg-white p-4">
        <p class="text-sm text-slate-500">最近更新时间</p>
        <p class="mt-3 text-base font-semibold text-slate-900">${escapeHtml(formatDateTime(latest?.updatedAt || ''))}</p>
      </article>
    </section>
  `
}

function renderFlatDimensionContent(dimensionId: FlatDimensionId): string {
  const meta = getDimensionMeta(dimensionId)
  const allItems = listConfigDimensionOptions(dimensionId)
  const items = getFilteredFlatOptions(dimensionId)

  return `
    <div class="space-y-4">
      <header class="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-[22px] font-semibold text-slate-900">${escapeHtml(meta.name)}</h2>
            <p class="mt-1 text-sm text-slate-500">${escapeHtml(meta.description)}</p>
          </div>
        </div>
      </header>

      ${renderMetricCards(allItems)}

      <section class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        <div class="flex items-start gap-3">
          <i data-lucide="shield-check" class="mt-0.5 h-5 w-5"></i>
          <p>${escapeHtml(`${meta.name}维度全部配置项均记录更新时间、更新人和操作日志；Code 由系统按维度自动递增生成，不允许手工维护。`)}</p>
        </div>
      </section>

      <section class="flex flex-wrap items-center gap-3">
        <label class="relative min-w-[300px] flex-1">
          <i data-lucide="search" class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"></i>
          <input
            class="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-700 outline-none focus:border-blue-500"
            placeholder="搜索 code、配置名称或更新人"
            value="${escapeHtml(state.search)}"
            data-pcs-config-workspace-field="search"
          />
        </label>
        <select class="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-blue-500" data-pcs-config-workspace-field="status-filter">
          ${(['全部状态', '启用中', '停用中'] as WorkspaceStatusFilter[]).map((item) => `<option value="${escapeHtml(item)}" ${state.statusFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
        </select>
        <button type="button" class="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-config-workspace-action="open-flat-create" data-dimension-id="${escapeHtml(dimensionId)}">
          <i data-lucide="plus" class="h-5 w-5"></i>新建配置项
        </button>
      </section>

      <section class="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-slate-50">
            <tr class="text-left text-[13px] font-semibold text-slate-500">
              <th class="px-4 py-3">CODE</th>
              <th class="px-4 py-3">配置名称</th>
              <th class="px-4 py-3">别名 / 英文名</th>
              <th class="px-4 py-3">排序</th>
              <th class="px-4 py-3">状态</th>
              <th class="px-4 py-3">更新时间</th>
              <th class="px-4 py-3">更新人</th>
              <th class="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${items.length > 0 ? items.map((item) => `
              <tr>
                <td class="px-4 py-4 text-[15px] font-semibold text-slate-800">${escapeHtml(item.code)}</td>
                <td class="px-4 py-4">
                  <p class="text-base font-semibold text-slate-900">${escapeHtml(item.name_zh)}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(`${meta.name}配置`)}</p>
                </td>
                <td class="px-4 py-4 text-[15px] text-slate-500">${escapeHtml(item.name_en || '-')}</td>
                <td class="px-4 py-4 text-[15px] text-slate-900">${escapeHtml(String(item.sortOrder))}</td>
                <td class="px-4 py-4">${renderStatusBadge(item.status)}</td>
                <td class="px-4 py-4 text-[15px] text-slate-900">${escapeHtml(formatDateTime(item.updatedAt))}</td>
                <td class="px-4 py-4 text-[15px] text-slate-900">${escapeHtml(item.updatedBy)}</td>
                <td class="px-4 py-4">
                  <div class="flex justify-end gap-3">
                    <button type="button" class="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-config-workspace-action="open-flat-edit" data-dimension-id="${escapeHtml(dimensionId)}" data-option-id="${escapeHtml(item.id)}">编辑</button>
                    <button type="button" class="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-config-workspace-action="open-flat-logs" data-dimension-id="${escapeHtml(dimensionId)}" data-option-id="${escapeHtml(item.id)}">日志</button>
                  </div>
                  <p class="mt-2 text-right text-xs text-slate-400">${escapeHtml(`${item.logs.length} 条日志`)}</p>
                </td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="8" class="px-4 py-12 text-center text-sm text-slate-500">当前筛选下暂无配置项。</td>
              </tr>
            `}
          </tbody>
        </table>
      </section>
    </div>
  `
}

function renderCategoryHeader(): string {
  return `
    <header class="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-[22px] font-semibold text-slate-900">商品类目</h2>
          <p class="mt-1 text-sm text-slate-500">树形结构管理，支持三级类目</p>
        </div>
        <button type="button" class="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-config-workspace-action="open-category-root-create">
          <i data-lucide="plus" class="h-5 w-5"></i>新建一级类目
        </button>
      </div>
    </header>
  `
}

function renderCategoryRuleNotice(): string {
  return `
    <section class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
      <div class="flex items-start gap-3">
        <i data-lucide="info" class="mt-0.5 h-5 w-5"></i>
        <p>删除规则：只能删除叶子类目（没有子类目）且该类目下没有商品的类目；停用规则：类目及下级类目存在商品时不允许停用。</p>
      </div>
    </section>
  `
}

function renderCategoryActionButton(icon: string, action: string, dataset: Record<string, string>, danger = false, disabled = false): string {
  const dataAttributes = Object.entries(dataset)
    .map(([key, value]) => `data-${key}="${escapeHtml(value)}"`)
    .join(' ')
  return `
    <button
      type="button"
      class="${escapeHtml(toClassName('inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent', disabled ? 'cursor-not-allowed text-slate-300' : danger ? 'text-rose-500 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100'))}"
      data-pcs-config-workspace-action="${escapeHtml(action)}"
      ${dataAttributes}
      ${disabled ? 'disabled' : ''}
    >
      <i data-lucide="${escapeHtml(icon)}" class="h-5 w-5"></i>
    </button>
  `
}

function renderCategoryNode(node: ProductCategoryNode, depth = 0): string {
  const children = listChildProductCategories(node.id)
  const expanded = state.expandedCategoryIds.has(node.id)
  const canDisable = canDisableProductCategoryNode(node.id)
  const canDelete = canDeleteProductCategoryNode(node.id)

  return `
    <div class="${depth > 0 ? 'ml-6 mt-3' : 'mt-3'}">
      <article class="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-3">
              ${children.length > 0
                ? `
                    <button type="button" class="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" data-pcs-config-workspace-action="toggle-category-expand" data-node-id="${escapeHtml(node.id)}">
                      <i data-lucide="${expanded ? 'chevron-down' : 'chevron-right'}" class="h-4 w-4"></i>
                    </button>
                  `
                : '<span class="inline-flex h-6 w-6"></span>'}
              <span class="text-base font-semibold text-slate-900">${escapeHtml(node.name)}</span>
              <span class="text-sm text-slate-400">(${escapeHtml(node.code)})</span>
              ${node.productCount > 0 ? `<span class="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">${escapeHtml(`${node.productCount}个商品`)}</span>` : ''}
              ${renderStatusBadge(node.status)}
              <span class="text-xs text-slate-400">L${escapeHtml(String(node.level))}</span>
              <span class="${escapeHtml(toClassName('inline-flex rounded-full px-2.5 py-0.5 text-xs', canDisable ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'))}">${canDisable ? '可停用' : '不可停用'}</span>
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-3 pl-8 text-xs text-slate-500">
              <span>更新时间：${escapeHtml(formatDateTime(node.updatedAt))}</span>
              <span>更新人：${escapeHtml(node.updatedBy)}</span>
              <button type="button" class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50" data-pcs-config-workspace-action="open-category-logs" data-node-id="${escapeHtml(node.id)}">日志 ${escapeHtml(String(node.logs.length))} 条</button>
            </div>
          </div>
          <div class="flex items-center gap-1">
            ${node.level < 3 ? renderCategoryActionButton('plus', 'open-category-child-create', { 'node-id': node.id }) : ''}
            ${renderCategoryActionButton('pencil', 'open-category-edit', { 'node-id': node.id })}
            ${renderCategoryActionButton('trash-2', 'delete-category', { 'node-id': node.id }, true, !canDelete)}
          </div>
        </div>
      </article>
      ${expanded && children.length > 0 ? children.map((item) => renderCategoryNode(item, depth + 1)).join('') : ''}
    </div>
  `
}

function renderCategoryContent(): string {
  return `
    <div class="space-y-4">
      ${renderCategoryHeader()}
      ${renderCategoryRuleNotice()}
      <section class="rounded-xl border border-slate-200 bg-white p-4">
        ${listRootProductCategories().map((node) => renderCategoryNode(node)).join('')}
      </section>
    </div>
  `
}

function renderFlatLogsModal(): string {
  if (!state.flatModal) return ''
  const option = state.flatModal.optionId ? getConfigDimensionOption(state.flatModal.dimensionId, state.flatModal.optionId) : null
  if (!option) return ''
  const meta = getDimensionMeta(state.flatModal.dimensionId)

  if (state.flatModal.mode === 'logs') {
    return renderModalShell(
      `${meta.name}日志详情`,
      `${option.name_zh} ｜ ${option.code}`,
      `
        <div class="space-y-8">
          <div class="grid gap-8 md:grid-cols-2">
            ${renderReadonlyField('Code（系统自增）', option.code)}
            ${renderReadonlyField('配置名称', option.name_zh)}
            ${renderReadonlyField('别名 / 英文名', option.name_en || '')}
            ${renderReadonlyField('排序', String(option.sortOrder))}
          </div>
          <div class="grid gap-8 md:grid-cols-2">
            ${renderReadonlyField('状态', getStatusLabel(option.status))}
          </div>
          ${renderAuditPanel(meta.name, option.updatedAt, option.updatedBy, option.logs.length)}
          <section>
            <div class="mb-5 flex items-center justify-between">
              <h3 class="text-[20px] font-semibold text-slate-900">操作日志</h3>
              <span class="text-sm text-slate-500">${escapeHtml(String(option.logs.length))} 条</span>
            </div>
            ${renderLogCards(option.logs)}
          </section>
        </div>
      `,
      'close-flat-modal',
    )
  }

  return renderModalShell(
    `编辑${meta.name}`,
    `${option.name_zh} ｜ ${option.code}`,
    `
      <div class="space-y-8">
        <div class="grid gap-8 md:grid-cols-2">
          ${renderReadonlyField('Code（系统自增）', option.code)}
          ${renderEditableInput('配置名称', 'flat-name-zh', state.flatDraft.nameZh, true)}
          ${renderEditableInput('别名 / 英文名', 'flat-name-en', state.flatDraft.nameEn)}
        </div>
        <div class="grid gap-8 md:grid-cols-2">
          ${renderEditableInput('排序', 'flat-sort-order', state.flatDraft.sortOrder, true)}
          ${renderEditableSelect('状态', 'flat-status', state.flatDraft.status)}
        </div>
        ${renderAuditPanel(meta.name, option.updatedAt, option.updatedBy, option.logs.length)}
        <section>
          <div class="mb-5 flex items-center justify-between">
            <h3 class="text-[20px] font-semibold text-slate-900">操作日志</h3>
            <span class="text-sm text-slate-500">${escapeHtml(String(option.logs.length))} 条</span>
          </div>
          ${renderLogCards(option.logs)}
        </section>
      </div>
    `,
    'close-flat-modal',
    `
      <button type="button" class="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50" data-pcs-config-workspace-action="close-flat-modal">取消</button>
      <button type="button" class="inline-flex h-11 items-center rounded-xl bg-blue-600 px-5 text-sm font-medium text-white hover:bg-blue-700" data-pcs-config-workspace-action="save-flat-modal">保存</button>
    `,
  )
}

function renderFlatCreateModal(): string {
  if (!state.flatModal || state.flatModal.mode !== 'create') return ''
  const meta = getDimensionMeta(state.flatModal.dimensionId)

  return renderModalShell(
    `新建${meta.name}`,
    `${meta.description}`,
    `
      <div class="space-y-8">
        <div class="grid gap-8 md:grid-cols-2">
          ${renderReadonlyField('Code（系统自增）', '保存后自动生成')}
          ${renderEditableInput('配置名称', 'flat-name-zh', state.flatDraft.nameZh, true, `请输入${meta.name}`)}
          ${renderEditableInput('别名 / 英文名', 'flat-name-en', state.flatDraft.nameEn, false, '可选')}
        </div>
        <div class="grid gap-8 md:grid-cols-2">
          ${renderEditableInput('排序', 'flat-sort-order', state.flatDraft.sortOrder, true)}
          ${renderEditableSelect('状态', 'flat-status', state.flatDraft.status)}
        </div>
      </div>
    `,
    'close-flat-modal',
    `
      <button type="button" class="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50" data-pcs-config-workspace-action="close-flat-modal">取消</button>
      <button type="button" class="inline-flex h-11 items-center rounded-xl bg-blue-600 px-5 text-sm font-medium text-white hover:bg-blue-700" data-pcs-config-workspace-action="save-flat-modal">保存</button>
    `,
  )
}

function renderCategoryModal(): string {
  if (!state.categoryModal) return ''
  const node = state.categoryModal.nodeId ? getProductCategoryNode(state.categoryModal.nodeId) : null
  const parent = state.categoryModal.parentId ? getProductCategoryNode(state.categoryModal.parentId) : node?.parentId ? getProductCategoryNode(node.parentId) : null

  if (state.categoryModal.mode === 'logs' && node) {
    return renderModalShell(
      '商品类目日志详情',
      `${node.name} ｜ ${node.code}`,
      `
        <div class="space-y-8">
          <div class="grid gap-8 md:grid-cols-2">
            ${renderReadonlyField('类目名称', node.name)}
            ${renderReadonlyField('父级类目', parent?.name || '一级类目')}
            ${renderReadonlyField('层级', `L${node.level}`)}
            ${renderReadonlyField('排序', String(node.sortOrder))}
            ${renderReadonlyField('状态', getStatusLabel(node.status))}
          </div>
          ${renderAuditPanel('商品类目', node.updatedAt, node.updatedBy, node.logs.length)}
          <section>
            <div class="mb-5 flex items-center justify-between">
              <h3 class="text-[20px] font-semibold text-slate-900">操作日志</h3>
              <span class="text-sm text-slate-500">${escapeHtml(String(node.logs.length))} 条</span>
            </div>
            ${renderLogCards(node.logs)}
          </section>
        </div>
      `,
      'close-category-modal',
    )
  }

  const title = state.categoryModal.mode === 'create-root'
    ? '新建一级类目'
    : state.categoryModal.mode === 'create-child'
      ? '新建下级类目'
      : '编辑商品类目'

  const subtitle = state.categoryModal.mode === 'create-root'
    ? '新增一级类目后，可继续在右侧添加二级和三级类目。'
    : state.categoryModal.mode === 'create-child'
      ? `父级类目：${parent?.name || node?.name || '-'}`
      : `${node?.name || '-'} ｜ ${node?.code || '-'}`

  return renderModalShell(
    title,
    subtitle,
    `
      <div class="space-y-8">
        <div class="grid gap-8 md:grid-cols-2">
          ${renderReadonlyField('父级类目', parent?.name || (state.categoryModal.mode === 'create-root' ? '一级类目' : node?.parentId ? parent?.name || '一级类目' : '一级类目'))}
          ${renderEditableInput('类目名称', 'category-name', state.categoryDraft.name, true, '请输入类目名称')}
          ${renderEditableInput('排序', 'category-sort-order', state.categoryDraft.sortOrder, true)}
          ${renderEditableSelect('状态', 'category-status', state.categoryDraft.status)}
        </div>
        ${node ? renderAuditPanel('商品类目', node.updatedAt, node.updatedBy, node.logs.length) : ''}
      </div>
    `,
    'close-category-modal',
    `
      <button type="button" class="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50" data-pcs-config-workspace-action="close-category-modal">取消</button>
      <button type="button" class="inline-flex h-11 items-center rounded-xl bg-blue-600 px-5 text-sm font-medium text-white hover:bg-blue-700" data-pcs-config-workspace-action="save-category-modal">保存</button>
    `,
  )
}

function renderWorkspaceModal(): string {
  return renderFlatCreateModal() || renderFlatLogsModal() || renderCategoryModal()
}

function openFlatModal(mode: FlatModalMode, dimensionId: FlatDimensionId, optionId: string | null = null): void {
  const option = optionId ? getConfigDimensionOption(dimensionId, optionId) : null
  state.flatModal = { mode, dimensionId, optionId }
  state.categoryModal = null
  state.flatDraft = {
    nameZh: option?.name_zh || '',
    nameEn: option?.name_en || '',
    sortOrder: String(option?.sortOrder || listConfigDimensionOptions(dimensionId).length + 1),
    status: option?.status || 'ENABLED',
  }
}

function openCategoryModal(mode: CategoryModalMode, nodeId: string | null = null, parentId: string | null = null): void {
  const node = nodeId ? getProductCategoryNode(nodeId) : null
  state.categoryModal = { mode, nodeId, parentId }
  state.flatModal = null
  state.categoryDraft = {
    name: node?.name || '',
    sortOrder: String(node?.sortOrder || 1),
    status: node?.status || 'ENABLED',
  }
}

function closeAllDialogs(): void {
  state.flatModal = null
  state.categoryModal = null
  resetDrafts()
}

function saveFlatModal(): void {
  if (!state.flatModal) return
  const dimensionId = state.flatModal.dimensionId
  const dimensionName = getDimensionMeta(dimensionId).name
  const draft: ConfigWorkspaceOptionDraft = {
    nameZh: state.flatDraft.nameZh.trim(),
    nameEn: state.flatDraft.nameEn.trim(),
    sortOrder: Number(state.flatDraft.sortOrder) || 1,
    status: state.flatDraft.status,
  }
  if (!draft.nameZh) {
    setNotice('请填写配置名称。')
    return
  }
  const result = saveConfigDimensionOption(
    dimensionId,
    state.flatModal.mode === 'create' ? null : state.flatModal.optionId,
    draft,
    '当前用户',
  )
  closeAllDialogs()
  setNotice(`已保存${dimensionName}配置「${result.name_zh}」。`)
}

function saveCategoryModal(): void {
  if (!state.categoryModal) return
  const draft: ProductCategoryDraft = {
    name: state.categoryDraft.name.trim(),
    sortOrder: Number(state.categoryDraft.sortOrder) || 1,
    status: state.categoryDraft.status,
  }
  if (!draft.name) {
    setNotice('请填写类目名称。')
    return
  }

  try {
    const result = saveProductCategoryNode(
      state.categoryModal.mode === 'edit' ? state.categoryModal.nodeId : null,
      state.categoryModal.mode === 'create-root' ? null : state.categoryModal.mode === 'create-child' ? state.categoryModal.parentId : getProductCategoryNode(state.categoryModal.nodeId || '')?.parentId || null,
      draft,
      '当前用户',
    )
    if (result.parentId) {
      state.expandedCategoryIds.add(result.parentId)
    }
    closeAllDialogs()
    setNotice(`已保存商品类目「${result.name}」。`)
  } catch (error) {
    setNotice(error instanceof Error ? error.message : '保存商品类目失败。')
  }
}

export function renderPcsConfigWorkspacePage(): string {
  return `
    <div class="p-4">
      ${renderNotice()}
      <div class="mt-3 overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
        <div class="flex min-h-[calc(100vh-156px)]">
          ${renderSidebar()}
          <main class="min-w-0 flex-1 bg-slate-50 px-4 py-4">
            ${state.activeDimension === 'productCategories'
              ? renderCategoryContent()
              : renderFlatDimensionContent(state.activeDimension)}
          </main>
        </div>
      </div>
      ${renderWorkspaceModal()}
    </div>
  `
}

export function handlePcsConfigWorkspaceEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-config-workspace-action]')
  const action = actionNode?.dataset.pcsConfigWorkspaceAction
  if (!actionNode || !action) return false

  if (action === 'close-notice') {
    clearNotice()
    return true
  }

  if (action === 'switch-dimension') {
    const dimensionId = actionNode.dataset.dimensionId as ConfigWorkspaceDimensionId
    if (dimensionId) {
      state.activeDimension = dimensionId
      state.search = ''
      state.statusFilter = '全部状态'
      closeAllDialogs()
      clearNotice()
    }
    return true
  }

  if (action === 'open-flat-create') {
    const dimensionId = actionNode.dataset.dimensionId as FlatDimensionId
    if (dimensionId) openFlatModal('create', dimensionId)
    return true
  }

  if (action === 'open-flat-edit') {
    const dimensionId = actionNode.dataset.dimensionId as FlatDimensionId
    const optionId = actionNode.dataset.optionId || null
    if (dimensionId && optionId) openFlatModal('edit', dimensionId, optionId)
    return true
  }

  if (action === 'open-flat-logs') {
    const dimensionId = actionNode.dataset.dimensionId as FlatDimensionId
    const optionId = actionNode.dataset.optionId || null
    if (dimensionId && optionId) openFlatModal('logs', dimensionId, optionId)
    return true
  }

  if (action === 'close-flat-modal') {
    state.flatModal = null
    resetDrafts()
    return true
  }

  if (action === 'save-flat-modal') {
    saveFlatModal()
    return true
  }

  if (action === 'toggle-category-expand') {
    const nodeId = actionNode.dataset.nodeId || ''
    if (state.expandedCategoryIds.has(nodeId)) state.expandedCategoryIds.delete(nodeId)
    else state.expandedCategoryIds.add(nodeId)
    return true
  }

  if (action === 'open-category-root-create') {
    openCategoryModal('create-root')
    return true
  }

  if (action === 'open-category-child-create') {
    openCategoryModal('create-child', null, actionNode.dataset.nodeId || null)
    return true
  }

  if (action === 'open-category-edit') {
    const nodeId = actionNode.dataset.nodeId || null
    if (nodeId) openCategoryModal('edit', nodeId)
    return true
  }

  if (action === 'open-category-logs') {
    const nodeId = actionNode.dataset.nodeId || null
    if (nodeId) openCategoryModal('logs', nodeId)
    return true
  }

  if (action === 'close-category-modal') {
    state.categoryModal = null
    resetDrafts()
    return true
  }

  if (action === 'save-category-modal') {
    saveCategoryModal()
    return true
  }

  if (action === 'delete-category') {
    const nodeId = actionNode.dataset.nodeId || ''
    try {
      const node = getProductCategoryNode(nodeId)
      if (!node) throw new Error('未找到商品类目。')
      deleteProductCategoryNode(nodeId, '当前用户')
      setNotice(`已删除商品类目「${node.name}」。`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '删除商品类目失败。')
    }
    return true
  }

  if (action === 'close-all-dialogs') {
    closeAllDialogs()
    return true
  }

  if (action === 'go-pattern-library') {
    appStore.navigate('/pcs/pattern-library')
    return true
  }

  return false
}

export function handlePcsConfigWorkspaceInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-config-workspace-field]')
  const field = fieldNode?.dataset.pcsConfigWorkspaceField
  if (!fieldNode || !field) return false

  const value = 'value' in fieldNode ? String((fieldNode as HTMLInputElement | HTMLSelectElement).value) : ''

  if (field === 'search') {
    state.search = value
    return true
  }

  if (field === 'status-filter') {
    state.statusFilter = value as WorkspaceStatusFilter
    return true
  }

  if (field === 'flat-name-zh') { state.flatDraft.nameZh = value; return true }
  if (field === 'flat-name-en') { state.flatDraft.nameEn = value; return true }
  if (field === 'flat-sort-order') { state.flatDraft.sortOrder = value; return true }
  if (field === 'flat-status') { state.flatDraft.status = value as ConfigStatus; return true }
  if (field === 'category-name') { state.categoryDraft.name = value; return true }
  if (field === 'category-sort-order') { state.categoryDraft.sortOrder = value; return true }
  if (field === 'category-status') { state.categoryDraft.status = value as ConfigStatus; return true }

  return false
}

export function isPcsConfigWorkspaceDialogOpen(): boolean {
  return Boolean(state.flatModal || state.categoryModal)
}

export function resetPcsConfigWorkspaceState(): void {
  state.activeDimension = PRODUCT_CATEGORY_META.id
  state.search = ''
  state.statusFilter = '全部状态'
  state.notice = null
  state.flatModal = null
  state.categoryModal = null
  state.expandedCategoryIds = new Set(['product-category-1', 'product-category-2'])
  resetDrafts()
}
