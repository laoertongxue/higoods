import {
  DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_CODE,
  DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME,
  DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_NAME,
  formatDispatchAcceptanceTimeout,
  getDispatchAcceptanceSlaGlobalDefaultConfig,
  listDispatchAcceptanceSlaFactoryAbilityRows,
  listDispatchAcceptanceSlaFactoryLogs,
  listDispatchAcceptanceSlaFactoryRows,
  listDispatchAcceptanceSlaRuleProcessCraftOptions,
  listDispatchAcceptanceSlaRules,
  previewDispatchAcceptanceSlaRuleImpact,
  saveDispatchAcceptanceSlaRule,
  type DispatchAcceptanceSlaFactoryAbilityEffectiveRow,
  type DispatchAcceptanceSlaFactoryPageRow,
  type DispatchAcceptanceSlaFactoryScopeRuleType,
  type DispatchAcceptanceSlaProcessScopeType,
  type DispatchAcceptanceSlaRuleSaveInput,
} from '../data/fcs/dispatch-acceptance-sla.ts'
import type { FactoryTier, FactoryType } from '../data/fcs/factory-types.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import { escapeHtml, toClassName } from '../utils.ts'

type RuleFactoryScopeDraft = DispatchAcceptanceSlaFactoryScopeRuleType
type RuleProcessScopeDraft = DispatchAcceptanceSlaProcessScopeType
type FactoryFilter = 'ALL' | 'HAS_UNCONFIGURED' | 'HAS_FACTORY_RULE' | 'AUTO_ACCEPT'
type DialogState =
  | { type: 'none' }
  | { type: 'create-rule' }
  | { type: 'factory-detail'; factoryId: string }
  | { type: 'factory-logs'; factoryId: string }

interface RuleDraft {
  ruleName: string
  processScopeType: RuleProcessScopeDraft
  processCode: string
  craftCode: string
  factoryScopeType: RuleFactoryScopeDraft
  factoryTier: string
  factoryType: string
  factoryIds: string[]
  acceptTimeoutHours: string
  enabled: boolean
  remark: string
}

interface PageState {
  keyword: string
  factoryTierFilter: string
  factoryTypeFilter: string
  processFilter: string
  factoryFilter: FactoryFilter
  factoryPage: number
  factoryPageSize: number
  detailPage: number
  detailPageSize: number
  dialog: DialogState
  ruleDraft: RuleDraft
  noticeText: string
  errorText: string
}

interface PaginationSlice<T> {
  rows: T[]
  total: number
  currentPage: number
  totalPages: number
  pageSize: number
  from: number
  to: number
}

const FACTORY_PAGE_SIZE_OPTIONS = [10, 20, 50] as const
const DETAIL_PAGE_SIZE_OPTIONS = [10, 20, 50] as const

function createRuleDraft(): RuleDraft {
  const processOptions = getProcessOptions()
  const firstProcess = processOptions[0]
  const firstCraft = firstProcess ? getCraftOptions(firstProcess.processCode)[0] : undefined
  return {
    ruleName: '',
    processScopeType: 'PROCESS_CRAFT',
    processCode: firstProcess?.processCode || '',
    craftCode: firstCraft?.craftCode || '',
    factoryScopeType: 'FACTORIES',
    factoryTier: '',
    factoryType: '',
    factoryIds: [],
    acceptTimeoutHours: '4',
    enabled: true,
    remark: '',
  }
}

const state: PageState = {
  keyword: '',
  factoryTierFilter: 'ALL',
  factoryTypeFilter: 'ALL',
  processFilter: 'ALL',
  factoryFilter: 'ALL',
  factoryPage: 1,
  factoryPageSize: 10,
  detailPage: 1,
  detailPageSize: 10,
  dialog: { type: 'none' },
  ruleDraft: createRuleDraft(),
  noticeText: '',
  errorText: '',
}

function normalizePageSize(value: string, options: readonly number[], fallback: number): number {
  const parsed = Number(value)
  return options.includes(parsed) ? parsed : fallback
}

function paginateRows<T>(rows: T[], currentPage: number, pageSize: number): PaginationSlice<T> {
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = total === 0 ? 0 : Math.min(total, safePage * pageSize)
  return {
    rows: rows.slice(from === 0 ? 0 : from - 1, to),
    total,
    currentPage: safePage,
    totalPages,
    pageSize,
    from,
    to,
  }
}

function renderAcceptanceSlaPagination<T>(
  scope: 'factory-list' | 'factory-detail',
  paging: PaginationSlice<T>,
  pageSizeOptions: readonly number[],
  skipPageRerender = false,
): string {
  let html = renderTablePagination({
    total: paging.total,
    from: paging.from,
    to: paging.to,
    currentPage: paging.currentPage,
    totalPages: paging.totalPages,
    pageSize: paging.pageSize,
    actionPrefix: 'acceptance-sla',
    fieldPrefix: 'acceptance-sla',
    pageSizeOptions,
  })
  if (skipPageRerender) {
    html = html
      .replaceAll('data-acceptance-sla-action=', 'data-skip-page-rerender="true" data-acceptance-sla-action=')
      .replaceAll('data-acceptance-sla-field=', 'data-skip-page-rerender="true" data-acceptance-sla-field=')
  }
  return `<div data-acceptance-sla-pagination-scope="${scope}">${html}</div>`
}

function parseTimeoutHours(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 10) / 10
}

function renderBadge(label: string, tone: 'green' | 'blue' | 'amber' | 'slate' | 'rose' = 'slate'): string {
  const className = {
    green: 'border-green-200 bg-green-50 text-green-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
  }[tone]
  return `<span class="inline-flex rounded border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function renderStatCard(label: string, value: string, helper: string, tone: 'blue' | 'green' | 'amber' | 'slate'): string {
  const toneClass = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-green-200 bg-green-50 text-green-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-white text-slate-700',
  }[tone]
  return `
    <div class="rounded-lg border px-4 py-3 ${toneClass}">
      <div class="text-xs opacity-80">${escapeHtml(label)}</div>
      <div class="mt-1 text-2xl font-semibold tabular-nums">${escapeHtml(value)}</div>
      <div class="mt-1 text-xs opacity-80">${escapeHtml(helper)}</div>
    </div>
  `
}

let factoryRowsCache: DispatchAcceptanceSlaFactoryPageRow[] | null = null

function invalidateFactoryRowsCache(): void {
  factoryRowsCache = null
}

function getFactoryRows(): DispatchAcceptanceSlaFactoryPageRow[] {
  if (!factoryRowsCache) factoryRowsCache = listDispatchAcceptanceSlaFactoryRows()
  return factoryRowsCache
}

function getProcessOptions(): Array<{ processCode: string; processName: string }> {
  return Array.from(new Map(listDispatchAcceptanceSlaRuleProcessCraftOptions()
    .map((item) => [item.processCode, item.processName])).entries())
    .map(([processCode, processName]) => ({ processCode, processName }))
}

function getCraftOptions(processCode: string): Array<{ craftCode: string; craftName: string }> {
  return listDispatchAcceptanceSlaRuleProcessCraftOptions()
    .filter((item) => item.processCode === processCode && item.craftCode !== DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_CODE)
    .map((item) => ({ craftCode: item.craftCode, craftName: item.craftName }))
}

function getTierOptions(rows = getFactoryRows()): Array<{ factoryTier: string; factoryTierName: string }> {
  return Array.from(new Map(rows.map((row) => [row.factoryTier, row.factoryTierName])).entries())
    .map(([factoryTier, factoryTierName]) => ({ factoryTier, factoryTierName }))
}

function getTypeOptions(rows = getFactoryRows()): Array<{ factoryType: string; factoryTypeName: string }> {
  return Array.from(new Map(rows.map((row) => [row.factoryType, row.factoryTypeName])).entries())
    .map(([factoryType, factoryTypeName]) => ({ factoryType, factoryTypeName }))
}

function getFilteredRows(rows: DispatchAcceptanceSlaFactoryPageRow[]): DispatchAcceptanceSlaFactoryPageRow[] {
  const keyword = state.keyword.trim().toLowerCase()
  return rows.filter((row) => {
    if (keyword) {
      const haystack = [
        row.factoryName,
        row.factoryId,
        row.factoryTierName,
        row.factoryTypeName,
        row.abilityRows.map((item) => `${item.processName} ${item.craftName} ${item.ruleName || ''}`).join(' '),
      ].join(' ').toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (state.factoryTierFilter !== 'ALL' && row.factoryTier !== state.factoryTierFilter) return false
    if (state.factoryTypeFilter !== 'ALL' && row.factoryType !== state.factoryTypeFilter) return false
    if (state.processFilter !== 'ALL' && !row.abilityRows.some((item) => item.processCode === state.processFilter)) return false
    if (state.factoryFilter === 'HAS_UNCONFIGURED' && row.unconfiguredCount === 0) return false
    if (state.factoryFilter === 'HAS_FACTORY_RULE' && row.factorySpecificRuleCount === 0) return false
    if (state.factoryFilter === 'AUTO_ACCEPT' && row.autoAcceptCount === 0) return false
    return true
  })
}

function getFactoryById(factoryId: string): DispatchAcceptanceSlaFactoryPageRow | undefined {
  return getFactoryRows().find((row) => row.factoryId === factoryId)
}

function renderPageHeader(): string {
  return `
    <section class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs text-slate-500">任务分配 / 配置</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900">接单时效配置</h1>
        <p class="mt-1 text-sm text-slate-500">按工厂查看直接派单后的最终接单时效；规则维护支持工序工艺、工厂层级、工厂类型和单个 / 多个工厂。</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-skip-page-rerender="true" data-acceptance-sla-action="open-create-rule">
          <i data-lucide="plus" class="h-4 w-4"></i>新增规则
        </button>
      </div>
    </section>
  `
}

function renderSummary(rows: DispatchAcceptanceSlaFactoryPageRow[]): string {
  const unconfiguredFactoryCount = rows.filter((row) => row.unconfiguredCount > 0).length
  const autoAcceptFactoryCount = rows.filter((row) => row.autoAcceptCount > 0).length
  const factoryRuleCount = rows.filter((row) => row.factorySpecificRuleCount > 0).length
  const globalDefault = getDispatchAcceptanceSlaGlobalDefaultConfig()
  return `
    <section class="grid gap-3 md:grid-cols-4">
      ${renderStatCard('工厂数', `${rows.length}`, '按可派单工厂统计', 'blue')}
      ${renderStatCard('未配置工厂', `${unconfiguredFactoryCount}`, '存在能力走全局默认', 'amber')}
      ${renderStatCard('单厂规则工厂', `${factoryRuleCount}`, '含指定工厂规则', 'green')}
      ${renderStatCard('全局默认', formatDispatchAcceptanceTimeout(globalDefault.defaultAcceptTimeoutHours), `自动接单工厂 ${autoAcceptFactoryCount} 家`, 'slate')}
    </section>
  `
}

function renderFilters(rows: DispatchAcceptanceSlaFactoryPageRow[]): string {
  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))_auto]">
        <label class="space-y-1">
          <span class="text-xs text-slate-500">搜索</span>
          <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(state.keyword)}" placeholder="工厂 / 工序 / 工艺 / 规则" data-acceptance-sla-field="filter.keyword" data-skip-page-rerender="true" />
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">工厂层级</span>
          <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-acceptance-sla-field="filter.factoryTier">
            <option value="ALL" ${state.factoryTierFilter === 'ALL' ? 'selected' : ''}>全部层级</option>
            ${getTierOptions(rows).map((item) => `<option value="${escapeHtml(item.factoryTier)}" ${state.factoryTierFilter === item.factoryTier ? 'selected' : ''}>${escapeHtml(item.factoryTierName)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">工厂类型</span>
          <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-acceptance-sla-field="filter.factoryType">
            <option value="ALL" ${state.factoryTypeFilter === 'ALL' ? 'selected' : ''}>全部类型</option>
            ${getTypeOptions(rows).map((item) => `<option value="${escapeHtml(item.factoryType)}" ${state.factoryTypeFilter === item.factoryType ? 'selected' : ''}>${escapeHtml(item.factoryTypeName)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">工序</span>
          <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-acceptance-sla-field="filter.process">
            <option value="ALL" ${state.processFilter === 'ALL' ? 'selected' : ''}>全部工序</option>
            ${getProcessOptions().map((item) => `<option value="${escapeHtml(item.processCode)}" ${state.processFilter === item.processCode ? 'selected' : ''}>${escapeHtml(item.processName)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">状态</span>
          <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-acceptance-sla-field="filter.factoryStatus">
            <option value="ALL" ${state.factoryFilter === 'ALL' ? 'selected' : ''}>全部</option>
            <option value="HAS_UNCONFIGURED" ${state.factoryFilter === 'HAS_UNCONFIGURED' ? 'selected' : ''}>有未配置</option>
            <option value="HAS_FACTORY_RULE" ${state.factoryFilter === 'HAS_FACTORY_RULE' ? 'selected' : ''}>有单厂规则</option>
            <option value="AUTO_ACCEPT" ${state.factoryFilter === 'AUTO_ACCEPT' ? 'selected' : ''}>含自动接单</option>
          </select>
        </label>
        <div class="flex items-end gap-2">
          <button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-acceptance-sla-action="apply-filters">查询</button>
          <button type="button" class="h-10 rounded-md border px-3 text-sm text-slate-700 hover:bg-slate-50" data-acceptance-sla-action="reset-filters">重置</button>
        </div>
      </div>
    </section>
  `
}

function renderNotice(): string {
  if (state.errorText) return `<section class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">${escapeHtml(state.errorText)}</section>`
  if (state.noticeText) return `<section class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">${escapeHtml(state.noticeText)}</section>`
  return ''
}

function renderTimeoutSummary(row: DispatchAcceptanceSlaFactoryPageRow): string {
  const tags = row.timeoutSummary.slice(0, 4).map((item) => renderBadge(`${item.label} ${item.count} 项`, item.label.includes('自动接单') ? 'amber' : 'blue')).join('')
  return `<div class="flex flex-wrap gap-1">${tags}${row.timeoutSummary.length > 4 ? `<span class="text-xs text-slate-500">+${row.timeoutSummary.length - 4}</span>` : ''}</div>`
}

function renderSourceSummary(row: DispatchAcceptanceSlaFactoryPageRow): string {
  return row.sourceSummary.slice(0, 3).map((item) => `${escapeHtml(item.label)} ${item.count}`).join(' / ')
}

function renderFactoryRows(rows: DispatchAcceptanceSlaFactoryPageRow[]): string {
  if (rows.length === 0) {
    return `<tr><td colspan="8" class="px-4 py-12 text-center text-sm text-slate-500">暂无匹配工厂，请调整筛选条件。</td></tr>`
  }
  return rows.map((row) => `
    <tr class="border-b border-slate-100 hover:bg-slate-50/80">
      <td class="px-4 py-4 align-top">
        <div class="font-medium text-slate-900">${escapeHtml(row.factoryName)}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(row.factoryId)}</div>
      </td>
      <td class="px-4 py-4 align-top">
        <div class="font-medium text-slate-900">${escapeHtml(row.factoryTierName)}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(row.factoryTypeName)}</div>
      </td>
      <td class="px-4 py-4 align-top">
        <div class="font-medium text-slate-900">${row.abilityCount} 项</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(row.abilityRows.slice(0, 3).map((item) => item.processName).join('、'))}${row.abilityRows.length > 3 ? ' 等' : ''}</div>
      </td>
      <td class="px-4 py-4 align-top">${renderTimeoutSummary(row)}</td>
      <td class="px-4 py-4 align-top">
        ${row.unconfiguredCount > 0 ? renderBadge(`未配置 ${row.unconfiguredCount} 项`, 'amber') : renderBadge('无未配置', 'green')}
      </td>
      <td class="px-4 py-4 align-top text-xs text-slate-500">
        <div>${renderSourceSummary(row)}</div>
        ${row.factorySpecificRuleCount > 0 ? `<div class="mt-1">${renderBadge('含单厂规则', 'blue')}</div>` : ''}
      </td>
      <td class="px-4 py-4 align-top text-xs text-slate-500">
        <div class="text-sm text-slate-700">${escapeHtml(row.lastChangedBy)}</div>
        <div class="mt-1">${escapeHtml(row.lastChangedAt)}</div>
      </td>
      <td class="px-4 py-4 align-top text-right">
        <div class="flex justify-end gap-2">
          <button type="button" class="inline-flex h-8 items-center rounded-md border px-3 text-xs text-slate-700 hover:bg-slate-50" data-skip-page-rerender="true" data-acceptance-sla-action="open-detail" data-factory-id="${escapeHtml(row.factoryId)}">查看明细</button>
          <button type="button" class="inline-flex h-8 items-center rounded-md border px-3 text-xs text-blue-700 hover:bg-blue-50" data-skip-page-rerender="true" data-acceptance-sla-action="open-logs" data-factory-id="${escapeHtml(row.factoryId)}">查看日志</button>
        </div>
      </td>
    </tr>
  `).join('')
}

function renderFactoryTable(rows: DispatchAcceptanceSlaFactoryPageRow[], filteredRows: DispatchAcceptanceSlaFactoryPageRow[]): string {
  const paging = paginateRows(filteredRows, state.factoryPage, state.factoryPageSize)
  state.factoryPage = paging.currentPage
  return `
    <section class="rounded-lg border bg-white">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 class="text-base font-semibold text-slate-900">工厂列表</h2>
          <p class="mt-1 text-xs text-slate-500">同一个工厂只展示一行；展开后查看该工厂所有工序工艺的最终接单时效。</p>
        </div>
        <div class="text-xs text-slate-500">共 ${filteredRows.length} / ${rows.length} 家</div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-4 py-3">工厂</th>
              <th class="px-4 py-3">层级 / 类型</th>
              <th class="px-4 py-3">可接工序工艺</th>
              <th class="px-4 py-3">接单时效概览</th>
              <th class="px-4 py-3">未配置项</th>
              <th class="px-4 py-3">规则来源</th>
              <th class="px-4 py-3">最后变更</th>
              <th class="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>${renderFactoryRows(paging.rows)}</tbody>
        </table>
      </div>
      ${renderAcceptanceSlaPagination('factory-list', paging, FACTORY_PAGE_SIZE_OPTIONS)}
    </section>
  `
}

function renderAbilityRows(rows: DispatchAcceptanceSlaFactoryAbilityEffectiveRow[]): string {
  return rows.map((row) => `
    <tr class="border-b border-slate-100">
      <td class="px-4 py-3">
        <div class="font-medium text-slate-900">${escapeHtml(row.processName)} / ${escapeHtml(row.craftName)}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(row.processCode)} · ${escapeHtml(row.craftCode)}</div>
      </td>
      <td class="px-4 py-3">
        <div class="font-medium text-slate-900">${escapeHtml(row.acceptTimeoutText)}</div>
        ${row.autoAccept ? `<div class="mt-1">${renderBadge('派单即接单', 'amber')}</div>` : ''}
      </td>
      <td class="px-4 py-3">
        <div class="font-medium text-slate-900">${escapeHtml(row.ruleSourceLabel)}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(row.ruleName || '未配置')}</div>
      </td>
      <td class="px-4 py-3 text-xs text-slate-500">${escapeHtml(row.ruleScopeLabel || '')}</td>
      <td class="px-4 py-3">${row.isUnconfigured ? renderBadge('走全局默认', 'amber') : renderBadge('已配置', 'green')}</td>
    </tr>
  `).join('')
}

function renderFactoryDetailDrawer(): string {
  if (state.dialog.type !== 'factory-detail') return ''
  const factory = getFactoryById(state.dialog.factoryId)
  if (!factory) return ''
  const rows = listDispatchAcceptanceSlaFactoryAbilityRows(factory.factoryId)
  const paging = paginateRows(rows, state.detailPage, state.detailPageSize)
  state.detailPage = paging.currentPage
  return `
    <div class="fixed inset-0 z-50 flex justify-end">
      <button type="button" class="absolute inset-0 bg-slate-900/35" data-skip-page-rerender="true" data-acceptance-sla-action="close-dialog" aria-label="关闭工厂明细"></button>
      <section class="relative z-10 flex h-full w-full max-w-5xl flex-col overflow-hidden border-l bg-white shadow-2xl">
        <div class="flex items-start justify-between gap-3 border-b px-6 py-4">
          <div>
            <p class="text-xs text-slate-500">工厂接单时效明细</p>
            <h2 class="mt-1 text-xl font-semibold text-slate-900">${escapeHtml(factory.factoryName)}</h2>
            <p class="mt-1 text-sm text-slate-500">${escapeHtml(factory.factoryTierName)} / ${escapeHtml(factory.factoryTypeName)} · ${rows.length} 项可接工序工艺</p>
          </div>
          <button type="button" class="inline-flex h-9 items-center rounded-md border px-3 text-sm text-slate-700 hover:bg-slate-50" data-skip-page-rerender="true" data-acceptance-sla-action="close-dialog">关闭</button>
        </div>
        <div class="flex-1 overflow-auto p-6">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th class="px-4 py-3">工序 / 工艺</th>
                <th class="px-4 py-3">当前接单时效</th>
                <th class="px-4 py-3">规则来源</th>
                <th class="px-4 py-3">命中范围</th>
                <th class="px-4 py-3">状态</th>
              </tr>
            </thead>
            <tbody>${renderAbilityRows(paging.rows)}</tbody>
          </table>
          ${renderAcceptanceSlaPagination('factory-detail', paging, DETAIL_PAGE_SIZE_OPTIONS, true)}
        </div>
      </section>
    </div>
  `
}

function renderFactoryLogsDrawer(): string {
  if (state.dialog.type !== 'factory-logs') return ''
  const factory = getFactoryById(state.dialog.factoryId)
  if (!factory) return ''
  const logs = listDispatchAcceptanceSlaFactoryLogs(factory.factoryId)
  return `
    <div class="fixed inset-0 z-50 flex justify-end">
      <button type="button" class="absolute inset-0 bg-slate-900/35" data-skip-page-rerender="true" data-acceptance-sla-action="close-dialog" aria-label="关闭工厂日志"></button>
      <section class="relative z-10 flex h-full w-full max-w-4xl flex-col overflow-hidden border-l bg-white shadow-2xl">
        <div class="flex items-start justify-between gap-3 border-b px-6 py-4">
          <div>
            <p class="text-xs text-slate-500">工厂接单时效日志</p>
            <h2 class="mt-1 text-xl font-semibold text-slate-900">${escapeHtml(factory.factoryName)}</h2>
            <p class="mt-1 text-sm text-slate-500">记录直接维护、广域规则影响、全局兜底变化和未生效原因。</p>
          </div>
          <button type="button" class="inline-flex h-9 items-center rounded-md border px-3 text-sm text-slate-700 hover:bg-slate-50" data-skip-page-rerender="true" data-acceptance-sla-action="close-dialog">关闭</button>
        </div>
        <div class="flex-1 overflow-auto p-6">
          <div class="space-y-3">
            ${logs.map((log) => `
              <article class="rounded-lg border ${log.effective ? 'bg-white' : 'bg-slate-50'} p-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="font-semibold text-slate-900">${escapeHtml(log.action)}</h3>
                      ${log.effective ? renderBadge('最终生效', 'green') : renderBadge('未生效', 'slate')}
                    </div>
                    <p class="mt-1 text-sm text-slate-700">${escapeHtml(log.processCraftLabel)}：${log.beforeTimeoutText ? `${escapeHtml(log.beforeTimeoutText)} -> ` : ''}${escapeHtml(log.afterTimeoutText)}</p>
                    <p class="mt-2 text-xs text-slate-500">${escapeHtml(log.ruleName)} · ${escapeHtml(log.ruleScopeLabel)}</p>
                    <p class="mt-1 text-xs text-slate-500">${escapeHtml(log.reason)}</p>
                  </div>
                  <div class="text-right text-xs text-slate-500">
                    <div>${escapeHtml(log.updatedBy)}</div>
                    <div class="mt-1">${escapeHtml(log.updatedAt)}</div>
                  </div>
                </div>
              </article>
            `).join('')}
          </div>
        </div>
      </section>
    </div>
  `
}

function normalizeRuleDraft(): RuleDraft {
  const processOptions = getProcessOptions()
  const processCode = processOptions.some((item) => item.processCode === state.ruleDraft.processCode)
    ? state.ruleDraft.processCode
    : processOptions[0]?.processCode || ''
  const craftOptions = getCraftOptions(processCode)
  const craftCode = craftOptions.some((item) => item.craftCode === state.ruleDraft.craftCode)
    ? state.ruleDraft.craftCode
    : craftOptions[0]?.craftCode || ''
  const tierOptions = getTierOptions()
  const typeOptions = getTypeOptions()
  return {
    ...state.ruleDraft,
    processCode,
    craftCode,
    factoryTier: tierOptions.some((item) => item.factoryTier === state.ruleDraft.factoryTier) ? state.ruleDraft.factoryTier : tierOptions[0]?.factoryTier || '',
    factoryType: typeOptions.some((item) => item.factoryType === state.ruleDraft.factoryType) ? state.ruleDraft.factoryType : typeOptions[0]?.factoryType || '',
    factoryIds: state.ruleDraft.factoryIds.filter((id) => getFactoryRows().some((row) => row.factoryId === id)),
  }
}

function buildRuleInputFromDraft(draft: RuleDraft): DispatchAcceptanceSlaRuleSaveInput | null {
  const timeout = parseTimeoutHours(draft.acceptTimeoutHours)
  if (timeout == null) return null
  const process = getProcessOptions().find((item) => item.processCode === draft.processCode)
  const craft = getCraftOptions(draft.processCode).find((item) => item.craftCode === draft.craftCode)
  const tier = getTierOptions().find((item) => item.factoryTier === draft.factoryTier)
  const type = getTypeOptions().find((item) => item.factoryType === draft.factoryType)
  const selectedFactories = getFactoryRows().filter((row) => draft.factoryIds.includes(row.factoryId))
  if (draft.factoryScopeType === 'FACTORIES' && selectedFactories.length === 0) return null
  return {
    ruleName: draft.ruleName,
    processScopeType: draft.processScopeType,
    processCode: draft.processScopeType === 'ALL_PROCESS_CRAFTS' ? undefined : draft.processCode,
    processName: draft.processScopeType === 'ALL_PROCESS_CRAFTS' ? undefined : process?.processName,
    craftCode: draft.processScopeType === 'PROCESS_CRAFT' ? draft.craftCode : undefined,
    craftName: draft.processScopeType === 'PROCESS_CRAFT' ? craft?.craftName : draft.processScopeType === 'PROCESS_ALL_CRAFTS' ? DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME : undefined,
    factoryScopeType: draft.factoryScopeType,
    factoryTier: draft.factoryScopeType === 'FACTORY_TIER' ? draft.factoryTier as FactoryTier : undefined,
    factoryTierName: draft.factoryScopeType === 'FACTORY_TIER' ? tier?.factoryTierName : undefined,
    factoryType: draft.factoryScopeType === 'FACTORY_TYPE' ? draft.factoryType as FactoryType : undefined,
    factoryTypeName: draft.factoryScopeType === 'FACTORY_TYPE' ? type?.factoryTypeName : undefined,
    factoryIds: draft.factoryScopeType === 'FACTORIES' ? selectedFactories.map((row) => row.factoryId) : undefined,
    factoryNames: draft.factoryScopeType === 'FACTORIES' ? selectedFactories.map((row) => row.factoryName) : undefined,
    acceptTimeoutHours: timeout,
    enabled: draft.enabled,
    remark: draft.remark,
  }
}

function renderFactoryCheckboxes(draft: RuleDraft): string {
  const rows = getFactoryRows()
  return `
    <div class="max-h-56 space-y-2 overflow-auto rounded-md border border-slate-200 p-3">
      ${rows.map((row) => `
        <label class="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50">
          <input type="checkbox" class="mt-0.5 h-4 w-4 rounded border-slate-300" data-skip-page-rerender="true" data-acceptance-sla-field="rule.factoryId" value="${escapeHtml(row.factoryId)}" ${draft.factoryIds.includes(row.factoryId) ? 'checked' : ''} />
          <span>
            <span class="block text-sm font-medium text-slate-900">${escapeHtml(row.factoryName)}</span>
            <span class="block text-xs text-slate-500">${escapeHtml(row.factoryTierName)} / ${escapeHtml(row.factoryTypeName)} · ${row.abilityCount} 项能力</span>
          </span>
        </label>
      `).join('')}
    </div>
  `
}

function renderRuleImpactPreview(draft: RuleDraft): { html: string; canSave: boolean } {
  const input = buildRuleInputFromDraft(draft)
  const impact = input ? previewDispatchAcceptanceSlaRuleImpact(input) : undefined
  const timeoutText = input ? formatDispatchAcceptanceTimeout(input.acceptTimeoutHours) : ''
  const timeoutEffectText = input?.acceptTimeoutHours === 0
    ? '保存后，命中该规则的派单任务会直接进入已接单。'
    : '保存后，超过接单截止时间仍未接单时由系统自动接单。'
  return {
    canSave: Boolean(input),
    html: `
      <h3 class="font-semibold text-slate-900">保存前影响预览</h3>
      ${impact ? `
        <div class="mt-4 rounded-lg border ${input?.acceptTimeoutHours === 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-200 bg-blue-50 text-blue-800'} px-3 py-3">
          <div class="text-xs opacity-80">本次规则时效</div>
          <div class="mt-1 text-lg font-semibold">${escapeHtml(timeoutText)}</div>
          <div class="mt-1 text-xs leading-5 opacity-80">${escapeHtml(timeoutEffectText)}</div>
        </div>
        <div class="mt-4 grid gap-3">
          ${renderStatCard('命中工厂', `${impact.matchedFactoryCount}`, '符合工厂范围', 'blue')}
          ${renderStatCard('命中能力', `${impact.matchedAbilityCount}`, '工厂 × 工序工艺', 'slate')}
          ${renderStatCard('预计生效', `${impact.effectiveAbilityCount}`, '保存后成为最终规则', 'green')}
          ${renderStatCard('被覆盖 / 保护', `${impact.overriddenAbilityCount}`, `单厂保护 ${impact.protectedAbilityCount} 项`, 'amber')}
        </div>
      ` : '<div class="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">请补齐规则范围和接单时效。</div>'}
      <p class="mt-4 text-xs leading-5 text-slate-500">同一优先级后保存覆盖先保存；指定工厂规则优先于工厂层级、工厂类型和全部工厂规则。</p>
    `,
  }
}

function renderSaveRuleButton(canSave: boolean): string {
  return `<button type="button" class="${toClassName('h-10 rounded-md px-4 text-sm font-medium text-white', canSave ? 'bg-blue-600 hover:bg-blue-700' : 'pointer-events-none bg-slate-300')}" data-acceptance-sla-action="save-rule">保存规则</button>`
}

function renderRuleDialog(): string {
  if (state.dialog.type !== 'create-rule') return ''
  const draft = normalizeRuleDraft()
  const preview = renderRuleImpactPreview(draft)
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" class="absolute inset-0 bg-slate-900/40" data-skip-page-rerender="true" data-acceptance-sla-action="close-dialog" aria-label="关闭新增规则"></button>
      <section class="relative z-10 flex w-full max-w-5xl flex-col overflow-hidden rounded-lg border bg-white shadow-2xl">
        <div class="flex items-start justify-between gap-3 border-b px-6 py-4">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">新增接单时效规则</h2>
            <p class="mt-1 text-sm text-slate-500">用工序工艺范围 + 工厂范围维护规则；保存前先确认影响范围。</p>
          </div>
          <button type="button" class="inline-flex h-9 items-center rounded-md border px-3 text-sm text-slate-700 hover:bg-slate-50" data-skip-page-rerender="true" data-acceptance-sla-action="close-dialog">关闭</button>
        </div>
        <div class="grid max-h-[70vh] overflow-auto lg:grid-cols-[minmax(0,1fr)_320px]">
          <div class="space-y-4 p-6">
            <label class="space-y-1">
              <span class="text-xs text-slate-500">规则名称</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" value="${escapeHtml(draft.ruleName)}" placeholder="不填则按范围自动生成" data-acceptance-sla-field="rule.ruleName" data-skip-page-rerender="true" />
            </label>
            <div class="grid gap-3 md:grid-cols-3">
              <label class="space-y-1">
                <span class="text-xs text-slate-500">工序工艺范围</span>
                <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-skip-page-rerender="true" data-acceptance-sla-field="rule.processScopeType">
                  <option value="ALL_PROCESS_CRAFTS" ${draft.processScopeType === 'ALL_PROCESS_CRAFTS' ? 'selected' : ''}>全部工序工艺</option>
                  <option value="PROCESS_ALL_CRAFTS" ${draft.processScopeType === 'PROCESS_ALL_CRAFTS' ? 'selected' : ''}>某工序 / 全部工艺</option>
                  <option value="PROCESS_CRAFT" ${draft.processScopeType === 'PROCESS_CRAFT' ? 'selected' : ''}>某工序 / 某工艺</option>
                </select>
              </label>
              <label class="space-y-1">
                <span class="text-xs text-slate-500">工序</span>
                <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-skip-page-rerender="true" data-acceptance-sla-field="rule.processCode" ${draft.processScopeType === 'ALL_PROCESS_CRAFTS' ? 'disabled' : ''}>
                  ${getProcessOptions().map((item) => `<option value="${escapeHtml(item.processCode)}" ${draft.processCode === item.processCode ? 'selected' : ''}>${escapeHtml(item.processName)}</option>`).join('')}
                </select>
              </label>
              <label class="space-y-1">
                <span class="text-xs text-slate-500">工艺</span>
                <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-skip-page-rerender="true" data-acceptance-sla-field="rule.craftCode" ${draft.processScopeType !== 'PROCESS_CRAFT' ? 'disabled' : ''}>
                  <option value="${DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_CODE}" ${draft.processScopeType !== 'PROCESS_CRAFT' ? 'selected' : ''}>${DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME}</option>
                  ${getCraftOptions(draft.processCode).map((item) => `<option value="${escapeHtml(item.craftCode)}" ${draft.craftCode === item.craftCode ? 'selected' : ''}>${escapeHtml(item.craftName)}</option>`).join('')}
                </select>
              </label>
            </div>
            <div class="grid gap-3 md:grid-cols-3">
              <label class="space-y-1">
                <span class="text-xs text-slate-500">工厂范围</span>
                <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-skip-page-rerender="true" data-acceptance-sla-field="rule.factoryScopeType">
                  <option value="ALL_FACTORIES" ${draft.factoryScopeType === 'ALL_FACTORIES' ? 'selected' : ''}>全部工厂</option>
                  <option value="FACTORY_TIER" ${draft.factoryScopeType === 'FACTORY_TIER' ? 'selected' : ''}>工厂层级</option>
                  <option value="FACTORY_TYPE" ${draft.factoryScopeType === 'FACTORY_TYPE' ? 'selected' : ''}>工厂类型</option>
                  <option value="FACTORIES" ${draft.factoryScopeType === 'FACTORIES' ? 'selected' : ''}>单个 / 多个工厂</option>
                </select>
              </label>
              <label class="space-y-1 ${draft.factoryScopeType === 'FACTORY_TIER' ? '' : 'hidden'}">
                <span class="text-xs text-slate-500">工厂层级</span>
                <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-skip-page-rerender="true" data-acceptance-sla-field="rule.factoryTier">
                  ${getTierOptions().map((item) => `<option value="${escapeHtml(item.factoryTier)}" ${draft.factoryTier === item.factoryTier ? 'selected' : ''}>${escapeHtml(item.factoryTierName)}</option>`).join('')}
                </select>
              </label>
              <label class="space-y-1 ${draft.factoryScopeType === 'FACTORY_TYPE' ? '' : 'hidden'}">
                <span class="text-xs text-slate-500">工厂类型</span>
                <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-skip-page-rerender="true" data-acceptance-sla-field="rule.factoryType">
                  ${getTypeOptions().map((item) => `<option value="${escapeHtml(item.factoryType)}" ${draft.factoryType === item.factoryType ? 'selected' : ''}>${escapeHtml(item.factoryTypeName)}</option>`).join('')}
                </select>
              </label>
            </div>
            ${draft.factoryScopeType === 'FACTORIES' ? renderFactoryCheckboxes(draft) : ''}
            <div class="grid gap-3 md:grid-cols-2">
              <label class="space-y-1">
                <span class="text-xs text-slate-500">接单时效（小时）</span>
                <input type="number" min="0" step="0.5" class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" value="${escapeHtml(draft.acceptTimeoutHours)}" placeholder="填 0 表示派单后自动接单" data-acceptance-sla-field="rule.acceptTimeoutHours" data-skip-page-rerender="true" />
                <span class="block text-xs leading-5 text-slate-500">填 0 表示派单后自动接单；大于 0 时，超过接单截止时间仍未接单则系统自动接单。</span>
              </label>
              <label class="space-y-1">
                <span class="text-xs text-slate-500">状态</span>
                <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-skip-page-rerender="true" data-acceptance-sla-field="rule.enabled">
                  <option value="true" ${draft.enabled ? 'selected' : ''}>启用</option>
                  <option value="false" ${!draft.enabled ? 'selected' : ''}>停用</option>
                </select>
              </label>
            </div>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">备注</span>
              <textarea class="min-h-[76px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm" data-acceptance-sla-field="rule.remark" data-skip-page-rerender="true" placeholder="说明规则维护原因">${escapeHtml(draft.remark)}</textarea>
            </label>
          </div>
          <aside class="border-l bg-slate-50 p-6" data-acceptance-sla-rule-impact>
            ${preview.html}
          </aside>
        </div>
        <div class="flex justify-end gap-2 border-t px-6 py-4">
          <button type="button" class="h-10 rounded-md border px-4 text-sm text-slate-700 hover:bg-slate-50" data-skip-page-rerender="true" data-acceptance-sla-action="close-dialog">取消</button>
          <span data-acceptance-sla-save-slot>${renderSaveRuleButton(preview.canSave)}</span>
        </div>
      </section>
    </div>
  `
}

function renderDialogOverlays(): string {
  return `
    ${renderRuleDialog()}
    ${renderFactoryDetailDrawer()}
    ${renderFactoryLogsDrawer()}
  `
}

function renderDialogOverlayContainer(): string {
  return `<div data-acceptance-sla-overlay>${renderDialogOverlays()}</div>`
}

function renderAcceptanceSlaOverlayIntoDom(): void {
  if (typeof document === 'undefined') return
  const overlayRoot = document.querySelector<HTMLElement>('[data-acceptance-sla-overlay]')
  if (!overlayRoot) return
  overlayRoot.innerHTML = renderDialogOverlays()
}

function renderRuleDialogDynamicRegionsIntoDom(): void {
  if (typeof document === 'undefined' || state.dialog.type !== 'create-rule') return
  const draft = normalizeRuleDraft()
  const preview = renderRuleImpactPreview(draft)
  const previewRoot = document.querySelector<HTMLElement>('[data-acceptance-sla-rule-impact]')
  if (previewRoot) previewRoot.innerHTML = preview.html
  const saveSlot = document.querySelector<HTMLElement>('[data-acceptance-sla-save-slot]')
  if (saveSlot) saveSlot.innerHTML = renderSaveRuleButton(preview.canSave)
}

function isHtmlInputElement(node: Element): node is HTMLInputElement {
  return typeof HTMLInputElement !== 'undefined' && node instanceof HTMLInputElement
}

function isHtmlSelectElement(node: Element): node is HTMLSelectElement {
  return typeof HTMLSelectElement !== 'undefined' && node instanceof HTMLSelectElement
}

function isHtmlTextAreaElement(node: Element): node is HTMLTextAreaElement {
  return typeof HTMLTextAreaElement !== 'undefined' && node instanceof HTMLTextAreaElement
}

function updateField(field: string, node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): boolean {
  state.noticeText = ''
  state.errorText = ''
  if (field === 'filter.keyword') {
    state.keyword = node.value
    state.factoryPage = 1
  }
  if (field === 'filter.factoryTier') {
    state.factoryTierFilter = node.value
    state.factoryPage = 1
  }
  if (field === 'filter.factoryType') {
    state.factoryTypeFilter = node.value
    state.factoryPage = 1
  }
  if (field === 'filter.process') {
    state.processFilter = node.value
    state.factoryPage = 1
  }
  if (field === 'filter.factoryStatus') {
    state.factoryFilter = node.value as FactoryFilter
    state.factoryPage = 1
  }
  if (field === 'rule.ruleName') state.ruleDraft.ruleName = node.value
  if (field === 'rule.processScopeType') {
    state.ruleDraft.processScopeType = node.value as RuleProcessScopeDraft
    if (state.ruleDraft.processScopeType === 'PROCESS_ALL_CRAFTS') state.ruleDraft.craftCode = DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_CODE
  }
  if (field === 'rule.processCode') {
    state.ruleDraft.processCode = node.value
    state.ruleDraft.craftCode = getCraftOptions(node.value)[0]?.craftCode || ''
  }
  if (field === 'rule.craftCode') state.ruleDraft.craftCode = node.value
  if (field === 'rule.factoryScopeType') {
    state.ruleDraft.factoryScopeType = node.value as RuleFactoryScopeDraft
    state.ruleDraft.factoryIds = []
  }
  if (field === 'rule.factoryTier') state.ruleDraft.factoryTier = node.value
  if (field === 'rule.factoryType') state.ruleDraft.factoryType = node.value
  if (field === 'rule.factoryId' && isHtmlInputElement(node)) {
    const ids = new Set(state.ruleDraft.factoryIds)
    if (node.checked) ids.add(node.value)
    else ids.delete(node.value)
    state.ruleDraft.factoryIds = Array.from(ids)
  }
  if (field === 'rule.acceptTimeoutHours') state.ruleDraft.acceptTimeoutHours = node.value
  if (field === 'rule.enabled') state.ruleDraft.enabled = node.value === 'true'
  if (field === 'rule.remark') state.ruleDraft.remark = node.value
  return true
}

function handleSaveRule(): boolean {
  const draft = normalizeRuleDraft()
  state.ruleDraft = draft
  const input = buildRuleInputFromDraft(draft)
  if (!input) {
    state.errorText = '请补齐规则范围和接单时效。'
    return true
  }
  const saved = saveDispatchAcceptanceSlaRule(input)
  invalidateFactoryRowsCache()
  state.factoryPage = 1
  state.dialog = { type: 'none' }
  state.ruleDraft = createRuleDraft()
  state.noticeText = `已保存规则：${saved.ruleName}。`
  state.errorText = ''
  return true
}

const RULE_LAYOUT_FIELDS = new Set([
  'rule.processScopeType',
  'rule.processCode',
  'rule.factoryScopeType',
])

export function handleDispatchAcceptanceSlaEvent(target: HTMLElement): boolean {
  const paginationScope = target.closest<HTMLElement>('[data-acceptance-sla-pagination-scope]')?.dataset.acceptanceSlaPaginationScope
  const fieldNode = target.closest<HTMLElement>('[data-acceptance-sla-field]')
  if (
    fieldNode
    && (isHtmlInputElement(fieldNode) || isHtmlSelectElement(fieldNode) || isHtmlTextAreaElement(fieldNode))
  ) {
    const field = fieldNode.dataset.acceptanceSlaField
    if (!field) return false
    if (field === 'pageSize') {
      if (paginationScope === 'factory-detail') {
        state.detailPageSize = normalizePageSize(fieldNode.value, DETAIL_PAGE_SIZE_OPTIONS, state.detailPageSize)
        state.detailPage = 1
        renderAcceptanceSlaOverlayIntoDom()
        return false
      }
      state.factoryPageSize = normalizePageSize(fieldNode.value, FACTORY_PAGE_SIZE_OPTIONS, state.factoryPageSize)
      state.factoryPage = 1
      return true
    }
    updateField(field, fieldNode)
    if (field.startsWith('rule.')) {
      if (RULE_LAYOUT_FIELDS.has(field)) renderAcceptanceSlaOverlayIntoDom()
      else renderRuleDialogDynamicRegionsIntoDom()
      return false
    }
    return fieldNode.dataset.skipPageRerender === 'true' ? false : true
  }

  const actionNode = target.closest<HTMLElement>('[data-acceptance-sla-action]')
  const action = actionNode?.dataset.acceptanceSlaAction
  if (!action) return false
  if (action === 'prev-page' || action === 'next-page') {
    const direction = action === 'prev-page' ? -1 : 1
    if (paginationScope === 'factory-detail') {
      state.detailPage += direction
      renderAcceptanceSlaOverlayIntoDom()
      return true
    }
    state.factoryPage += direction
    return true
  }
  if (action === 'apply-filters') {
    state.factoryPage = 1
    return true
  }
  if (action === 'reset-filters') {
    state.keyword = ''
    state.factoryTierFilter = 'ALL'
    state.factoryTypeFilter = 'ALL'
    state.processFilter = 'ALL'
    state.factoryFilter = 'ALL'
    state.factoryPage = 1
    state.noticeText = ''
    state.errorText = ''
    return true
  }
  if (action === 'open-create-rule') {
    state.dialog = { type: 'create-rule' }
    state.ruleDraft = createRuleDraft()
    state.noticeText = ''
    state.errorText = ''
    renderAcceptanceSlaOverlayIntoDom()
    return true
  }
  if (action === 'open-detail') {
    const factoryId = actionNode?.dataset.factoryId
    if (!factoryId) return false
    state.dialog = { type: 'factory-detail', factoryId }
    state.detailPage = 1
    renderAcceptanceSlaOverlayIntoDom()
    return true
  }
  if (action === 'open-logs') {
    const factoryId = actionNode?.dataset.factoryId
    if (!factoryId) return false
    state.dialog = { type: 'factory-logs', factoryId }
    renderAcceptanceSlaOverlayIntoDom()
    return true
  }
  if (action === 'close-dialog') {
    state.dialog = { type: 'none' }
    state.errorText = ''
    renderAcceptanceSlaOverlayIntoDom()
    return true
  }
  if (action === 'save-rule') return handleSaveRule()
  return false
}

export function isDispatchAcceptanceSlaDialogOpen(): boolean {
  return state.dialog.type !== 'none'
}

export function renderDispatchAcceptanceSlaPage(): string {
  const rows = getFactoryRows()
  const filteredRows = getFilteredRows(rows)
  return `
    <div class="space-y-5 p-6" data-testid="dispatch-acceptance-sla-page">
      ${renderPageHeader()}
      ${renderNotice()}
      ${renderSummary(rows)}
      ${renderFilters(rows)}
      ${renderFactoryTable(rows, filteredRows)}
      ${renderDialogOverlayContainer()}
    </div>
  `
}

export function renderDispatchAcceptanceSlaUnconfiguredPage(): string {
  return renderDispatchAcceptanceSlaPage()
}
