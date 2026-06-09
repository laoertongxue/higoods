import {
  DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME,
  DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID,
  DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_NAME,
  DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_ID,
  DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_NAME,
  DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_ID,
  DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_NAME,
  formatDispatchAcceptanceTimeout,
  getDispatchAcceptanceSlaConfigById,
  getDispatchAcceptanceSlaGlobalDefaultConfig,
  getFactoryAbilityForDispatchAcceptance,
  listDispatchAcceptanceSlaEffectiveFactoryOverrides,
  listDispatchAcceptanceSlaFactoryOverrideLogs,
  listDispatchAcceptanceSlaCreateOptions,
  listDispatchAcceptanceSlaMissingProcessCraftRows,
  listDispatchAcceptanceSlaPageRows,
  saveDispatchAcceptanceSlaGlobalDefaultConfig,
  saveDispatchAcceptanceSlaConfig,
  saveDispatchAcceptanceSlaFactoryOverride,
  type DispatchAcceptanceSlaFactoryOverrideScopeType,
  type DispatchAcceptanceSlaConfig,
  type DispatchAcceptanceSlaCreateOption,
} from '../data/fcs/dispatch-acceptance-sla.ts'
import type { FactoryTier, FactoryType } from '../data/fcs/factory-types.ts'
import { escapeHtml, toClassName } from '../utils.ts'

type PageRow = ReturnType<typeof listDispatchAcceptanceSlaPageRows>[number]
type FactoryAbilityOption = ReturnType<typeof getFactoryAbilityForDispatchAcceptance>[number]
type CoverageFilter = 'ALL' | 'HAS_OVERRIDE' | 'NO_OVERRIDE'
type TimeoutFilter = 'ALL' | 'AUTO_ACCEPT' | 'LIMITED'
type StatusFilter = 'ALL' | 'ENABLED' | 'DISABLED'
type DialogState = { type: 'none' } | { type: 'global' } | { type: 'create' } | { type: 'overrides'; configId: string }

interface CreateRuleDraft {
  processCode: string
  craftCode: string
  defaultAcceptTimeoutHours: string
  enabled: boolean
  remark: string
}

interface OverrideDraft {
  factoryTier: string
  factoryType: string
  factoryId: string
  protectFromBroadOverrides: boolean
  acceptTimeoutHours: string
  enabled: boolean
  remark: string
}

interface GlobalDefaultDraft {
  defaultAcceptTimeoutHours: string
  enabled: boolean
  remark: string
}

interface AcceptanceSlaPageState {
  keyword: string
  processFilter: string
  coverageFilter: CoverageFilter
  timeoutFilter: TimeoutFilter
  statusFilter: StatusFilter
  dialog: DialogState
  globalDefaultDraft: GlobalDefaultDraft
  createDraft: CreateRuleDraft
  overrideDraft: OverrideDraft
  errorText: string
  noticeText: string
}

function getProcessCraftKey(processCode: string, craftCode: string): string {
  return `${processCode}::${craftCode || '默认工艺'}`
}

function createEmptyRuleDraft(processCraftKey = ''): CreateRuleDraft {
  const options = listDispatchAcceptanceSlaCreateOptions()
  const matched = processCraftKey ? findCreateOptionByKey(processCraftKey, options) : undefined
  const first = matched ?? options[0]
  return {
    processCode: first?.processCode || '',
    craftCode: first?.craftCode || '',
    defaultAcceptTimeoutHours: '4',
    enabled: true,
    remark: '',
  }
}

function createEmptyOverrideDraft(configId = ''): OverrideDraft {
  const config = configId ? getDispatchAcceptanceSlaConfigById(configId) : undefined
  return {
    factoryTier: DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_ID,
    factoryType: DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_ID,
    factoryId: config ? DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID : '',
    protectFromBroadOverrides: false,
    acceptTimeoutHours: '2',
    enabled: true,
    remark: '',
  }
}

function createGlobalDefaultDraft(): GlobalDefaultDraft {
  const config = getDispatchAcceptanceSlaGlobalDefaultConfig()
  return {
    defaultAcceptTimeoutHours: String(config.defaultAcceptTimeoutHours),
    enabled: config.enabled,
    remark: config.remark || '',
  }
}

const state: AcceptanceSlaPageState = {
  keyword: '',
  processFilter: 'ALL',
  coverageFilter: 'ALL',
  timeoutFilter: 'ALL',
  statusFilter: 'ALL',
  dialog: { type: 'none' },
  globalDefaultDraft: createGlobalDefaultDraft(),
  createDraft: createEmptyRuleDraft(),
  overrideDraft: createEmptyOverrideDraft(),
  errorText: '',
  noticeText: '',
}

function parseTimeoutHours(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 10) / 10
}

function findCreateOptionByKey(
  processCraftKey: string,
  options = listDispatchAcceptanceSlaCreateOptions(),
): DispatchAcceptanceSlaCreateOption | undefined {
  return options.find((item) => item.processCraftKey === processCraftKey)
}

function findCreateOption(
  processCode: string,
  craftCode: string,
  options = listDispatchAcceptanceSlaCreateOptions(),
): DispatchAcceptanceSlaCreateOption | undefined {
  return options.find((item) => item.processCode === processCode && item.craftCode === craftCode)
}

function getCreateProcessOptions(options = listDispatchAcceptanceSlaCreateOptions()): Array<{
  processCode: string
  processName: string
}> {
  return Array.from(new Map(options.map((item) => [item.processCode, item.processName])).entries())
    .map(([processCode, processName]) => ({ processCode, processName }))
}

function getCreateCraftOptions(processCode: string, options = listDispatchAcceptanceSlaCreateOptions()): DispatchAcceptanceSlaCreateOption[] {
  return options.filter((item) => item.processCode === processCode)
}

function getFirstCreateCraftCode(processCode: string, options = listDispatchAcceptanceSlaCreateOptions()): string {
  return getCreateCraftOptions(processCode, options)[0]?.craftCode || ''
}

function getOverrideTierOptions(factories: FactoryAbilityOption[]): Array<{
  factoryTier: string
  factoryTierName: string
}> {
  return Array.from(new Map(factories.map((factory) => [factory.factoryTier, factory.factoryTierName])).entries())
    .map(([factoryTier, factoryTierName]) => ({ factoryTier, factoryTierName }))
}

function getOverrideTypeOptions(factories: FactoryAbilityOption[], factoryTier: string): Array<{
  factoryType: string
  factoryTypeName: string
}> {
  const filtered = factoryTier === DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_ID
    ? factories
    : factories.filter((factory) => factory.factoryTier === factoryTier)
  return Array.from(new Map(filtered.map((factory) => [factory.factoryType, factory.factoryTypeName])).entries())
    .map(([factoryType, factoryTypeName]) => ({ factoryType, factoryTypeName }))
}

function getOverrideFactoryOptions(
  factories: FactoryAbilityOption[],
  factoryTier: string,
  factoryType: string,
): FactoryAbilityOption[] {
  return factories.filter((factory) => {
    if (factoryTier !== DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_ID && factory.factoryTier !== factoryTier) return false
    if (factoryType !== DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_ID && factory.factoryType !== factoryType) return false
    return true
  })
}

function getOverrideScopeType(draft: OverrideDraft): DispatchAcceptanceSlaFactoryOverrideScopeType {
  if (draft.factoryId !== DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID) return 'FACTORY'
  if (draft.factoryType !== DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_ID) return 'FACTORY_TYPE'
  if (draft.factoryTier !== DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_ID) return 'FACTORY_TIER'
  return 'ALL_FACTORIES'
}

function getOverrideScopeText(draft: OverrideDraft, factory?: FactoryAbilityOption): string {
  const tierText = draft.factoryTier === DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_ID
    ? DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_NAME
    : factory?.factoryTierName || draft.factoryTier
  const typeText = draft.factoryType === DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_ID
    ? DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_NAME
    : factory?.factoryTypeName || draft.factoryType
  const factoryText = draft.factoryId === DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID
    ? DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_NAME
    : factory?.name || draft.factoryId
  return `${tierText} / ${typeText} / ${factoryText}`
}

function getOverrideScopeBadgeLabel(scopeType?: DispatchAcceptanceSlaFactoryOverrideScopeType): string {
  if (scopeType === 'FACTORY') return '指定工厂'
  if (scopeType === 'FACTORY_TYPE') return '工厂类型'
  if (scopeType === 'FACTORY_TIER') return '工厂层级'
  return '全部工厂'
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

function renderStatusBadge(enabled: boolean): string {
  return enabled ? renderBadge('启用', 'green') : renderBadge('停用', 'slate')
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

function getFilteredRows(rows: PageRow[]): PageRow[] {
  const keyword = state.keyword.trim().toLowerCase()
  return rows.filter((row) => {
    if (keyword) {
      const haystack = [
        row.processName,
        row.processCode,
        row.craftName,
        row.craftCode,
        row.factoryOverrides.map((item) => item.factoryName).join(' '),
      ].join(' ').toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (state.processFilter !== 'ALL' && row.processCode !== state.processFilter) return false
    if (state.coverageFilter === 'HAS_OVERRIDE' && row.activeOverrideCount === 0) return false
    if (state.coverageFilter === 'NO_OVERRIDE' && row.activeOverrideCount > 0) return false
    if (state.timeoutFilter === 'AUTO_ACCEPT') {
      const hasAutoAccept = row.defaultAcceptTimeoutHours === 0 || row.autoAcceptOverrideCount > 0
      if (!hasAutoAccept) return false
    }
    if (state.timeoutFilter === 'LIMITED' && row.defaultAcceptTimeoutHours === 0) return false
    if (state.statusFilter === 'ENABLED' && !row.enabled) return false
    if (state.statusFilter === 'DISABLED' && row.enabled) return false
    return true
  })
}

function renderPageHeader(): string {
  return `
    <section class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs text-slate-500">任务分配 / 配置</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900">接单时效配置</h1>
        <p class="mt-1 text-sm text-slate-500">维护直接派单后的工厂接单时限；时效为 0 时，派单成功即系统自动接单。</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-acceptance-sla-action="open-create">
          <i data-lucide="plus" class="h-4 w-4"></i>新增规则
        </button>
        <button type="button" class="inline-flex h-10 items-center rounded-md border bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/fcs/dispatch/non-sewing">返回任务分配</button>
      </div>
    </section>
  `
}

function renderSummary(rows: PageRow[]): string {
  const activeRows = rows.filter((row) => row.enabled)
  const overrideCount = rows.reduce((total, row) => total + row.activeOverrideCount, 0)
  const autoAcceptCount = rows.reduce(
    (total, row) => total + (row.defaultAcceptTimeoutHours === 0 ? 1 : 0) + row.autoAcceptOverrideCount,
    0,
  )
  const fallbackCount = listDispatchAcceptanceSlaMissingProcessCraftRows().length
  const globalDefault = getDispatchAcceptanceSlaGlobalDefaultConfig()
  return `
    <section class="grid gap-3 md:grid-cols-4">
      ${renderStatCard('已配置规则', `${activeRows.length}`, '按工序工艺默认规则统计', 'blue')}
      ${renderStatCard('工厂覆盖', `${overrideCount}`, '同工序工艺下按工厂细分', 'green')}
      ${renderStatCard('自动接单', `${autoAcceptCount + (globalDefault.defaultAcceptTimeoutHours === 0 ? 1 : 0)}`, '时效为 0 的规则', 'amber')}
      ${renderStatCard('走全局默认', `${fallbackCount}`, `未自定义时按 ${formatDispatchAcceptanceTimeout(globalDefault.defaultAcceptTimeoutHours)}`, 'slate')}
    </section>
  `
}

function renderGlobalDefaultPanel(): string {
  const config = getDispatchAcceptanceSlaGlobalDefaultConfig()
  const fallbackCount = listDispatchAcceptanceSlaMissingProcessCraftRows().length
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-base font-semibold text-slate-900">全局兜底规则</h2>
            ${renderStatusBadge(config.enabled)}
            ${renderBadge('最后命中', 'blue')}
          </div>
          <p class="mt-1 text-sm text-slate-600">未命中工厂覆盖、也未命中工序工艺自定义规则时，按全局默认接单时效执行。</p>
        </div>
        <button type="button" class="inline-flex h-9 items-center rounded-md border border-blue-200 bg-white px-3 text-sm text-blue-700 hover:bg-blue-50" data-acceptance-sla-action="open-global">调整全局规则</button>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-4">
        <div class="rounded-md border border-blue-100 bg-white px-3 py-3">
          <div class="text-xs text-slate-500">全局默认时效</div>
          <div class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(formatDispatchAcceptanceTimeout(config.defaultAcceptTimeoutHours))}</div>
        </div>
        <div class="rounded-md border border-blue-100 bg-white px-3 py-3">
          <div class="text-xs text-slate-500">当前兜底项</div>
          <div class="mt-1 text-lg font-semibold text-slate-900">${fallbackCount} 个</div>
        </div>
        <div class="rounded-md border border-blue-100 bg-white px-3 py-3">
          <div class="text-xs text-slate-500">更新时间</div>
          <div class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(config.updatedBy)}</div>
          <div class="mt-1 text-xs text-slate-500">${escapeHtml(config.updatedAt)}</div>
        </div>
        <div class="rounded-md border border-blue-100 bg-white px-3 py-3">
          <div class="text-xs text-slate-500">说明</div>
          <div class="mt-1 text-sm text-slate-700">${escapeHtml(config.remark || '未维护说明')}</div>
        </div>
      </div>
    </section>
  `
}

function renderFilters(rows: PageRow[]): string {
  const processOptions = Array.from(
    new Map(rows.map((row) => [row.processCode, row.processName])).entries(),
  )
  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="grid gap-3 xl:grid-cols-[minmax(240px,1fr)_160px_160px_160px_160px_160px]">
        <label class="space-y-1">
          <span class="text-xs text-slate-500">搜索规则</span>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"></i>
            <input class="h-10 w-full rounded-md border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(state.keyword)}" placeholder="工序 / 工艺 / 工厂 / 编码" data-acceptance-sla-field="filter.keyword" data-skip-page-rerender="true" />
          </div>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">工序</span>
          <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-acceptance-sla-field="filter.process">
            <option value="ALL" ${state.processFilter === 'ALL' ? 'selected' : ''}>全部工序</option>
            ${processOptions.map(([code, name]) => `<option value="${escapeHtml(code)}" ${state.processFilter === code ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">工厂覆盖</span>
          <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-acceptance-sla-field="filter.coverage">
            <option value="ALL" ${state.coverageFilter === 'ALL' ? 'selected' : ''}>全部</option>
            <option value="HAS_OVERRIDE" ${state.coverageFilter === 'HAS_OVERRIDE' ? 'selected' : ''}>有覆盖</option>
            <option value="NO_OVERRIDE" ${state.coverageFilter === 'NO_OVERRIDE' ? 'selected' : ''}>无覆盖</option>
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">时效类型</span>
          <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-acceptance-sla-field="filter.timeout">
            <option value="ALL" ${state.timeoutFilter === 'ALL' ? 'selected' : ''}>全部</option>
            <option value="AUTO_ACCEPT" ${state.timeoutFilter === 'AUTO_ACCEPT' ? 'selected' : ''}>自动接单</option>
            <option value="LIMITED" ${state.timeoutFilter === 'LIMITED' ? 'selected' : ''}>限时接单</option>
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">状态</span>
          <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-acceptance-sla-field="filter.status">
            <option value="ALL" ${state.statusFilter === 'ALL' ? 'selected' : ''}>全部状态</option>
            <option value="ENABLED" ${state.statusFilter === 'ENABLED' ? 'selected' : ''}>启用</option>
            <option value="DISABLED" ${state.statusFilter === 'DISABLED' ? 'selected' : ''}>停用</option>
          </select>
        </label>
        <div class="flex items-end gap-2">
          <button type="button" class="h-10 flex-1 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-acceptance-sla-action="apply-filters">查询</button>
          <button type="button" class="h-10 rounded-md border px-3 text-sm text-slate-700 hover:bg-slate-50" data-acceptance-sla-action="reset-filters">重置</button>
        </div>
      </div>
    </section>
  `
}

function renderOverrideSummary(row: PageRow): string {
  const activeOverrides = listDispatchAcceptanceSlaEffectiveFactoryOverrides(row).filter((item) => item.enabled)
  if (activeOverrides.length === 0) {
    return '<p class="text-sm text-slate-500">未设置工厂覆盖</p>'
  }
  const tags = activeOverrides.slice(0, 2).map((override) => `
    <span class="inline-flex rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">${escapeHtml(override.factoryName)}</span>
  `).join('')
  return `
    <div class="space-y-1">
      <p class="font-medium text-slate-900">${row.activeOverrideCount} 个启用覆盖</p>
      <div class="flex flex-wrap gap-1">${tags}${activeOverrides.length > 2 ? `<span class="text-xs text-slate-500">+${activeOverrides.length - 2}</span>` : ''}</div>
      ${row.autoAcceptOverrideCount > 0 ? `<p class="text-xs text-amber-700">${row.autoAcceptOverrideCount} 个覆盖为派单后自动接单</p>` : ''}
    </div>
  `
}

function renderRuleRows(rows: PageRow[]): string {
  if (rows.length === 0) {
    return `
      <tr>
        <td colspan="7" class="px-4 py-12 text-center text-sm text-slate-500">暂无匹配规则，请调整筛选条件。</td>
      </tr>
    `
  }
  return rows.map((row) => `
    <tr class="border-b border-slate-100 hover:bg-slate-50/80">
      <td class="px-4 py-4 align-top">
        <div class="font-medium text-slate-900">${escapeHtml(row.processName)} / ${escapeHtml(row.craftName)}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(row.processCode)} · ${escapeHtml(row.craftCode)}</div>
      </td>
      <td class="px-4 py-4 align-top">
        <div class="font-medium text-slate-900">${escapeHtml(formatDispatchAcceptanceTimeout(row.defaultAcceptTimeoutHours))}</div>
        <div class="mt-1">${row.defaultAcceptTimeoutHours === 0 ? renderBadge('派单即接单', 'amber') : renderBadge('默认规则', 'blue')}</div>
      </td>
      <td class="px-4 py-4 align-top">${renderOverrideSummary(row)}</td>
      <td class="px-4 py-4 align-top">
        <div class="font-medium text-slate-900">${row.abilityFactoryCount} 家</div>
        <div class="mt-1 text-xs text-slate-500">仅允许具备该工序工艺能力的工厂覆盖</div>
      </td>
      <td class="px-4 py-4 align-top">${renderStatusBadge(row.enabled)}</td>
      <td class="px-4 py-4 align-top text-xs text-slate-500">
        <div class="text-sm text-slate-700">${escapeHtml(row.updatedBy)}</div>
        <div class="mt-1">${escapeHtml(row.updatedAt)}</div>
      </td>
      <td class="px-4 py-4 align-top text-right">
        <button type="button" class="inline-flex h-8 items-center rounded-md border px-3 text-xs text-slate-700 hover:bg-slate-50" data-acceptance-sla-action="open-overrides" data-config-id="${escapeHtml(row.configId)}">维护覆盖</button>
      </td>
    </tr>
  `).join('')
}

function renderRuleTable(rows: PageRow[], filteredRows: PageRow[]): string {
  return `
    <section class="rounded-lg border bg-white">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 class="text-base font-semibold text-slate-900">规则列表</h2>
          <p class="mt-1 text-xs text-slate-500">一行代表一个工序工艺默认规则；工厂覆盖在行内维护，派单时覆盖优先。</p>
        </div>
        <div class="text-xs text-slate-500">共 ${filteredRows.length} / ${rows.length} 条</div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-[1040px] w-full text-sm">
          <thead class="border-b bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th class="px-4 py-3">工序 / 工艺</th>
              <th class="px-4 py-3">默认接单时效</th>
              <th class="px-4 py-3">工厂覆盖</th>
              <th class="px-4 py-3">适用工厂</th>
              <th class="px-4 py-3">状态</th>
              <th class="px-4 py-3">最后更新</th>
              <th class="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>${renderRuleRows(filteredRows)}</tbody>
        </table>
      </div>
    </section>
  `
}

function renderRiskPanel(): string {
  const missingRows = listDispatchAcceptanceSlaMissingProcessCraftRows()
  const globalDefault = getDispatchAcceptanceSlaGlobalDefaultConfig()
  return `
    <aside class="space-y-4">
      <section class="rounded-lg border bg-white p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-slate-900">未自定义项</h2>
            <p class="mt-1 text-xs text-slate-500">这些外部任务工序工艺未单独配置，会按全局默认 ${escapeHtml(formatDispatchAcceptanceTimeout(globalDefault.defaultAcceptTimeoutHours))} 执行。</p>
          </div>
          ${renderBadge(`${missingRows.length} 项`, missingRows.length > 0 ? 'blue' : 'green')}
        </div>
        <div class="mt-4 space-y-3">
          ${
            missingRows.length === 0
              ? '<div class="rounded-md border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-700">当前外部任务工序工艺已全部设置自定义规则。</div>'
              : missingRows.slice(0, 6).map((row) => `
                <div class="rounded-md border border-blue-100 bg-blue-50/60 px-3 py-3">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <p class="text-sm font-medium text-slate-900">${escapeHtml(row.processName)} / ${escapeHtml(row.craftName)}</p>
                      <p class="mt-1 text-xs text-slate-500">${escapeHtml(row.processCode)} · ${escapeHtml(row.craftCode)}</p>
                      <p class="mt-1 text-xs text-blue-700">当前按全局默认执行</p>
                    </div>
                    <button type="button" class="shrink-0 text-xs font-medium text-blue-700 hover:underline" data-acceptance-sla-action="open-create" data-process-craft-key="${escapeHtml(getProcessCraftKey(row.processCode, row.craftCode))}">新增</button>
                  </div>
                </div>
              `).join('')
          }
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <h2 class="text-base font-semibold text-slate-900">派单命中逻辑</h2>
        <div class="mt-4 space-y-3 text-sm text-slate-600">
          <div class="flex gap-3">
            <span class="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs text-white">1</span>
            <p>先判断承接工厂是否存在启用的覆盖规则。</p>
          </div>
          <div class="flex gap-3">
            <span class="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs text-white">2</span>
            <p>未命中工厂覆盖时，按工序工艺自定义规则执行。</p>
          </div>
          <div class="flex gap-3">
            <span class="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs text-white">3</span>
            <p>未命中工序工艺自定义规则时，按全局默认规则执行。</p>
          </div>
          <div class="flex gap-3">
            <span class="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs text-white">4</span>
            <p>任一命中规则时效为 0，则派单成功后直接写入系统自动接单。</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600">
            多能力工厂按任务的工序工艺先定位规则；同一工厂在印花、裁片、车缝等不同工序工艺下可以有不同接单时效，不跨工序工艺串用。
          </div>
        </div>
      </section>
    </aside>
  `
}

function renderNotice(): string {
  if (!state.noticeText && !state.errorText) return ''
  if (state.errorText) {
    return `<section class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">${escapeHtml(state.errorText)}</section>`
  }
  return `<section class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">${escapeHtml(state.noticeText)}</section>`
}

function renderCreateDialog(): string {
  if (state.dialog.type !== 'create') return ''
  const options = listDispatchAcceptanceSlaCreateOptions()
  const draft = state.createDraft
  const processOptions = getCreateProcessOptions(options)
  const selectedProcessCode = processOptions.some((option) => option.processCode === draft.processCode)
    ? draft.processCode
    : processOptions[0]?.processCode || ''
  const craftOptions = getCreateCraftOptions(selectedProcessCode, options)
  const selectedCraftCode = craftOptions.some((option) => option.craftCode === draft.craftCode)
    ? draft.craftCode
    : craftOptions[0]?.craftCode || ''
  const selected = findCreateOption(selectedProcessCode, selectedCraftCode, options)
  const timeout = parseTimeoutHours(draft.defaultAcceptTimeoutHours)
  const canSave = Boolean(selected && timeout != null)
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" class="absolute inset-0 bg-slate-900/40" data-acceptance-sla-action="close-dialog" aria-label="关闭新增规则"></button>
      <section class="relative z-10 flex w-full max-w-3xl flex-col overflow-hidden rounded-lg border bg-white shadow-2xl">
        <div class="flex items-start justify-between gap-3 border-b px-6 py-4">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">新增接单时效规则</h3>
            <p class="mt-1 text-sm text-slate-500">先补工序工艺默认规则，工厂差异在规则行内维护覆盖。</p>
          </div>
          <button type="button" class="inline-flex h-9 items-center rounded-md border px-3 text-sm text-slate-700 hover:bg-slate-50" data-acceptance-sla-action="close-dialog">关闭</button>
        </div>
        <div class="grid max-h-[74vh] gap-5 overflow-y-auto px-6 py-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <section class="space-y-4">
            <div class="grid gap-4 md:grid-cols-2">
              <label class="space-y-1">
                <span class="text-xs text-slate-500">工序</span>
                <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-acceptance-sla-field="create.processCode" ${processOptions.length === 0 ? 'disabled' : ''}>
                  ${processOptions.length === 0 ? '<option value="">暂无待新增规则</option>' : processOptions.map((option) => `<option value="${escapeHtml(option.processCode)}" ${selectedProcessCode === option.processCode ? 'selected' : ''}>${escapeHtml(option.processName)}</option>`).join('')}
                </select>
              </label>
              <label class="space-y-1">
                <span class="text-xs text-slate-500">工艺</span>
                <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-acceptance-sla-field="create.craftCode" ${craftOptions.length === 0 ? 'disabled' : ''}>
                  ${craftOptions.length === 0 ? '<option value="">暂无可选工艺</option>' : craftOptions.map((option) => `<option value="${escapeHtml(option.craftCode)}" ${selectedCraftCode === option.craftCode ? 'selected' : ''}>${escapeHtml(option.craftName)}</option>`).join('')}
                </select>
              </label>
            </div>
            <div class="rounded-md border border-blue-100 bg-blue-50 px-3 py-3 text-xs leading-5 text-blue-700">
              工艺选择“${DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME}”时，作为该工序下未命中具体工艺规则的默认接单时效；具体工艺规则仍优先命中。
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <label class="space-y-1">
                <span class="text-xs text-slate-500">默认接单时效（小时）</span>
                <input type="number" min="0" step="0.5" class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.defaultAcceptTimeoutHours)}" data-acceptance-sla-field="create.defaultAcceptTimeoutHours" data-skip-page-rerender="true" />
              </label>
              <label class="space-y-1">
                <span class="text-xs text-slate-500">状态</span>
                <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-acceptance-sla-field="create.enabled">
                  <option value="true" ${draft.enabled ? 'selected' : ''}>启用</option>
                  <option value="false" ${!draft.enabled ? 'selected' : ''}>停用</option>
                </select>
              </label>
            </div>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">备注</span>
              <textarea class="min-h-[96px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="说明该工序工艺的接单确认要求" data-acceptance-sla-field="create.remark" data-skip-page-rerender="true">${escapeHtml(draft.remark)}</textarea>
            </label>
          </section>

          <section class="rounded-lg border bg-slate-50 p-4">
            <h4 class="text-sm font-semibold text-slate-900">保存后效果</h4>
            <dl class="mt-4 space-y-3 text-sm">
              <div>
                <dt class="text-xs text-slate-500">规则对象</dt>
                <dd class="mt-1 font-medium text-slate-900">${escapeHtml(selected?.processCraftLabel || '请选择工序工艺')}</dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">默认时效</dt>
                <dd class="mt-1 font-medium text-slate-900">${escapeHtml(formatDispatchAcceptanceTimeout(timeout))}</dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">自动接单</dt>
                <dd class="mt-1 text-slate-700">${timeout === 0 ? '派单成功即系统自动接单' : '超过截止时间仍未接单时系统自动接单'}</dd>
              </div>
            </dl>
          </section>
        </div>
        <div class="flex justify-end gap-2 border-t px-6 py-4">
          <button type="button" class="h-10 rounded-md border px-4 text-sm text-slate-700 hover:bg-slate-50" data-acceptance-sla-action="close-dialog">取消</button>
          <button type="button" class="${toClassName('h-10 rounded-md px-4 text-sm font-medium text-white', canSave ? 'bg-blue-600 hover:bg-blue-700' : 'pointer-events-none bg-slate-300')}" data-acceptance-sla-action="save-create">保存规则</button>
        </div>
      </section>
    </div>
  `
}

function renderGlobalDefaultDialog(): string {
  if (state.dialog.type !== 'global') return ''
  const draft = state.globalDefaultDraft
  const timeout = parseTimeoutHours(draft.defaultAcceptTimeoutHours)
  const canSave = timeout != null
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" class="absolute inset-0 bg-slate-900/40" data-acceptance-sla-action="close-dialog" aria-label="关闭全局默认规则"></button>
      <section class="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-lg border bg-white shadow-2xl">
        <div class="flex items-start justify-between gap-3 border-b px-6 py-4">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">调整全局兜底规则</h3>
            <p class="mt-1 text-sm text-slate-500">未命中工厂覆盖和工序工艺自定义规则时，按这里的默认接单时效执行。</p>
          </div>
          <button type="button" class="inline-flex h-9 items-center rounded-md border px-3 text-sm text-slate-700 hover:bg-slate-50" data-acceptance-sla-action="close-dialog">关闭</button>
        </div>
        <div class="space-y-4 px-6 py-5">
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1">
              <span class="text-xs text-slate-500">全局默认接单时效（小时）</span>
              <input type="number" min="0" step="0.5" class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.defaultAcceptTimeoutHours)}" data-acceptance-sla-field="global.defaultAcceptTimeoutHours" data-skip-page-rerender="true" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">状态</span>
              <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-acceptance-sla-field="global.enabled">
                <option value="true" ${draft.enabled ? 'selected' : ''}>启用</option>
                <option value="false" ${!draft.enabled ? 'selected' : ''}>停用</option>
              </select>
            </label>
          </div>
          <label class="space-y-1">
            <span class="text-xs text-slate-500">规则说明</span>
            <textarea class="min-h-[96px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-acceptance-sla-field="global.remark" data-skip-page-rerender="true">${escapeHtml(draft.remark)}</textarea>
          </label>
          <div class="rounded-md border border-blue-100 bg-blue-50 px-3 py-3 text-sm text-blue-700">
            ${timeout === 0 ? '当前设置会让所有未自定义命中的派单任务，在派单成功后自动接单。' : `当前设置会让所有未自定义命中的派单任务，按 ${escapeHtml(formatDispatchAcceptanceTimeout(timeout))} 计算接单截止。`}
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t px-6 py-4">
          <button type="button" class="h-10 rounded-md border px-4 text-sm text-slate-700 hover:bg-slate-50" data-acceptance-sla-action="close-dialog">取消</button>
          <button type="button" class="${toClassName('h-10 rounded-md px-4 text-sm font-medium text-white', canSave ? 'bg-blue-600 hover:bg-blue-700' : 'pointer-events-none bg-slate-300')}" data-acceptance-sla-action="save-global">保存全局规则</button>
        </div>
      </section>
    </div>
  `
}

function renderOverrideRows(config: DispatchAcceptanceSlaConfig): string {
  const overrides = listDispatchAcceptanceSlaEffectiveFactoryOverrides(config)
  if (overrides.length === 0) {
    return '<tr><td colspan="6" class="px-3 py-8 text-center text-sm text-slate-500">暂无工厂覆盖，全部使用工序工艺默认时效。</td></tr>'
  }
  return overrides.map((override) => {
    const scopeType = override.scopeType ?? (override.factoryId === DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID ? 'ALL_FACTORIES' : 'FACTORY')
    return `
    <tr class="border-b border-slate-100">
      <td class="px-3 py-3">
        <div class="font-medium text-slate-900">${escapeHtml(override.factoryName)}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml([
          override.factoryTierName,
          override.factoryTypeName,
          override.factoryId,
        ].filter(Boolean).join(' · ') || override.factoryId)}</div>
      </td>
      <td class="px-3 py-3">
        <div>${renderBadge(getOverrideScopeBadgeLabel(scopeType), scopeType === 'FACTORY' ? 'slate' : 'blue')}</div>
        ${override.protectFromBroadOverrides ? '<div class="mt-1">' + renderBadge('单厂独立', 'amber') + '</div>' : ''}
      </td>
      <td class="px-3 py-3">${escapeHtml(formatDispatchAcceptanceTimeout(override.acceptTimeoutHours))}</td>
      <td class="px-3 py-3">${renderStatusBadge(override.enabled)}</td>
      <td class="px-3 py-3 text-xs text-slate-500">${escapeHtml(override.updatedBy)}<br />${escapeHtml(override.updatedAt)}</td>
      <td class="px-3 py-3 text-xs text-slate-500">${escapeHtml(override.remark || '-')}</td>
    </tr>
  `
  }).join('')
}

function renderOverrideLogRows(configId: string): string {
  const logs = listDispatchAcceptanceSlaFactoryOverrideLogs(configId)
  if (logs.length === 0) {
    return '<tr><td colspan="5" class="px-3 py-8 text-center text-sm text-slate-500">暂无工厂维度变更日志。</td></tr>'
  }
  return logs.slice(0, 8).map((log) => `
    <tr class="border-b border-slate-100">
      <td class="px-3 py-3">
        <div class="font-medium text-slate-900">${escapeHtml(log.factoryName)}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(log.scopeLabel)} · ${escapeHtml(log.factoryId)}</div>
      </td>
      <td class="px-3 py-3">
        <div class="text-sm text-slate-900">${escapeHtml(log.action)}</div>
        <div class="mt-1 text-xs text-slate-500">
          ${escapeHtml(log.previousAcceptTimeoutHours == null ? '无' : formatDispatchAcceptanceTimeout(log.previousAcceptTimeoutHours))}
          →
          ${escapeHtml(formatDispatchAcceptanceTimeout(log.nextAcceptTimeoutHours))}
        </div>
      </td>
      <td class="px-3 py-3">
        ${renderStatusBadge(log.nextEnabled)}
        <div class="mt-1 text-xs text-slate-500">原状态：${log.previousEnabled == null ? '无' : log.previousEnabled ? '启用' : '停用'}</div>
      </td>
      <td class="px-3 py-3 text-xs text-slate-500">${escapeHtml(log.updatedBy)}<br />${escapeHtml(log.updatedAt)}</td>
      <td class="px-3 py-3 text-xs text-slate-500">${escapeHtml(log.remark || '-')}</td>
    </tr>
  `).join('')
}

function renderOverrideDrawer(): string {
  if (state.dialog.type !== 'overrides') return ''
  const config = getDispatchAcceptanceSlaConfigById(state.dialog.configId)
  if (!config) return ''
  const factories = getFactoryAbilityForDispatchAcceptance(config.processCode, config.craftCode)
  const tierOptions = getOverrideTierOptions(factories)
  const selectedTier = state.overrideDraft.factoryTier === DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_ID
    || tierOptions.some((option) => option.factoryTier === state.overrideDraft.factoryTier)
    ? state.overrideDraft.factoryTier
    : DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_ID
  const typeOptions = getOverrideTypeOptions(factories, selectedTier)
  const selectedType = state.overrideDraft.factoryType === DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_ID
    || typeOptions.some((option) => option.factoryType === state.overrideDraft.factoryType)
    ? state.overrideDraft.factoryType
    : DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_ID
  const factoryOptions = getOverrideFactoryOptions(factories, selectedTier, selectedType)
  const selectedFactory = factoryOptions.find((factory) => factory.id === state.overrideDraft.factoryId)
  const selectedFactoryId = selectedFactory ? state.overrideDraft.factoryId : DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID
  const normalizedDraft: OverrideDraft = {
    ...state.overrideDraft,
    factoryTier: selectedTier,
    factoryType: selectedType,
    factoryId: selectedFactoryId,
  }
  const scopeType = getOverrideScopeType(normalizedDraft)
  const selectedAllFactories = selectedFactoryId === DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID
  const timeout = parseTimeoutHours(state.overrideDraft.acceptTimeoutHours)
  const canSave = Boolean(timeout != null && (scopeType !== 'FACTORY' || selectedFactory))
  const scopeText = getOverrideScopeText(normalizedDraft, selectedFactory)
  return `
    <div class="fixed inset-0 z-50 flex justify-end">
      <button type="button" class="absolute inset-0 bg-slate-900/35" data-acceptance-sla-action="close-dialog" aria-label="关闭工厂覆盖"></button>
      <section class="relative z-10 flex h-full w-full max-w-3xl flex-col overflow-hidden border-l bg-white shadow-2xl">
        <div class="flex items-start justify-between gap-3 border-b px-6 py-4">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">工厂覆盖规则</h3>
            <p class="mt-1 text-sm text-slate-500">${escapeHtml(config.processName)} / ${escapeHtml(config.craftName)}，默认 ${escapeHtml(formatDispatchAcceptanceTimeout(config.defaultAcceptTimeoutHours))}</p>
          </div>
          <button type="button" class="inline-flex h-9 items-center rounded-md border px-3 text-sm text-slate-700 hover:bg-slate-50" data-acceptance-sla-action="close-dialog">关闭</button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <section class="rounded-lg border bg-slate-50 p-4">
            <div class="grid gap-4 md:grid-cols-3">
              <label class="space-y-1">
                <span class="text-xs text-slate-500">工厂层级</span>
                <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-acceptance-sla-field="override.factoryTier">
                  <option value="${escapeHtml(DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_ID)}" ${selectedTier === DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_ID ? 'selected' : ''}>${escapeHtml(DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_NAME)}</option>
                  ${tierOptions.map((option) => `<option value="${escapeHtml(option.factoryTier)}" ${selectedTier === option.factoryTier ? 'selected' : ''}>${escapeHtml(option.factoryTierName)}</option>`).join('')}
                </select>
              </label>
              <label class="space-y-1">
                <span class="text-xs text-slate-500">工厂类型</span>
                <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-acceptance-sla-field="override.factoryType">
                  <option value="${escapeHtml(DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_ID)}" ${selectedType === DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_ID ? 'selected' : ''}>${escapeHtml(DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_NAME)}</option>
                  ${typeOptions.map((option) => `<option value="${escapeHtml(option.factoryType)}" ${selectedType === option.factoryType ? 'selected' : ''}>${escapeHtml(option.factoryTypeName)}</option>`).join('')}
                </select>
              </label>
              <label class="space-y-1">
                <span class="text-xs text-slate-500">工厂</span>
                <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-acceptance-sla-field="override.factoryId">
                  <option value="${escapeHtml(DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID)}" ${selectedAllFactories ? 'selected' : ''}>${escapeHtml(DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_NAME)}</option>
                  ${factoryOptions.map((factory) => `<option value="${escapeHtml(factory.id)}" ${selectedFactoryId === factory.id ? 'selected' : ''}>${escapeHtml(factory.name)}</option>`).join('')}
                </select>
              </label>
            </div>
            <div class="mt-4 grid gap-4 md:grid-cols-[150px_120px_minmax(0,1fr)]">
              <label class="space-y-1">
                <span class="text-xs text-slate-500">覆盖时效（小时）</span>
                <input type="number" min="0" step="0.5" class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(state.overrideDraft.acceptTimeoutHours)}" data-acceptance-sla-field="override.acceptTimeoutHours" data-skip-page-rerender="true" />
              </label>
              <label class="space-y-1">
                <span class="text-xs text-slate-500">状态</span>
                <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-acceptance-sla-field="override.enabled">
                  <option value="true" ${state.overrideDraft.enabled ? 'selected' : ''}>启用</option>
                  <option value="false" ${!state.overrideDraft.enabled ? 'selected' : ''}>停用</option>
                </select>
              </label>
              <div class="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                <div class="font-medium text-slate-900">覆盖范围</div>
                <div>${escapeHtml(scopeText)}</div>
                <div class="mt-1">${renderBadge(getOverrideScopeBadgeLabel(scopeType), scopeType === 'FACTORY' ? 'slate' : 'blue')}</div>
              </div>
            </div>
            ${
              selectedFactory
                ? `<label class="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                    <input type="checkbox" class="mt-0.5 h-4 w-4 rounded border-amber-300" data-acceptance-sla-field="override.protectFromBroadOverrides" ${state.overrideDraft.protectFromBroadOverrides ? 'checked' : ''} />
                    <span>
                      <span class="font-medium">设为单厂独立规则</span>
                      <span class="mt-1 block text-xs leading-5 text-amber-700">启用后，后续按全部层级、全部工厂类型或全部工厂维护的广域规则不会覆盖该工厂；只有再次指定该工厂维护才会更新。</span>
                    </span>
                  </label>`
                : ''
            }
            <label class="mt-4 block space-y-1">
              <span class="text-xs text-slate-500">覆盖备注</span>
              <textarea class="min-h-[72px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-acceptance-sla-field="override.remark" data-skip-page-rerender="true" placeholder="说明该工厂为何采用不同接单时效">${escapeHtml(state.overrideDraft.remark)}</textarea>
            </label>
            <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p class="text-xs text-slate-500">${selectedAllFactories ? '广域规则会命中当前范围内承接该工序工艺的工厂；已设为单厂独立规则的工厂不会被广域规则覆盖。' : timeout === 0 ? '当前覆盖为派单后自动接单。' : '保存后，派给该工厂时优先使用覆盖时效；勾选单厂独立后，后续广域规则不会覆盖它。'}</p>
              <button type="button" class="${toClassName('h-9 rounded-md px-4 text-sm font-medium text-white', canSave ? 'bg-blue-600 hover:bg-blue-700' : 'pointer-events-none bg-slate-300')}" data-acceptance-sla-action="save-override">保存工厂覆盖</button>
            </div>
          </section>

          <section class="mt-5 rounded-lg border bg-white">
            <div class="border-b px-4 py-3">
              <h4 class="text-sm font-semibold text-slate-900">当前最新覆盖记录</h4>
              <p class="mt-1 text-xs text-slate-500">同一覆盖对象只展示最后一次维护结果；派单命中时仍按最后添加的适用记录执行。</p>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-[860px] w-full text-sm">
                <thead class="border-b bg-slate-50 text-left text-xs font-medium text-slate-500">
                  <tr>
                    <th class="px-3 py-2">工厂</th>
                    <th class="px-3 py-2">覆盖范围</th>
                    <th class="px-3 py-2">覆盖时效</th>
                    <th class="px-3 py-2">状态</th>
                    <th class="px-3 py-2">更新</th>
                    <th class="px-3 py-2">备注</th>
                  </tr>
                </thead>
                <tbody>${renderOverrideRows(config)}</tbody>
              </table>
            </div>
          </section>

          <section class="mt-5 rounded-lg border bg-white">
            <div class="border-b px-4 py-3">
              <h4 class="text-sm font-semibold text-slate-900">工厂维度变更日志</h4>
              <p class="mt-1 text-xs text-slate-500">同一工厂或全部工厂重复添加时，后添加的记录覆盖之前记录；日志保留每次变更。</p>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-[860px] w-full text-sm">
                <thead class="border-b bg-slate-50 text-left text-xs font-medium text-slate-500">
                  <tr>
                    <th class="px-3 py-2">工厂</th>
                    <th class="px-3 py-2">变更</th>
                    <th class="px-3 py-2">状态</th>
                    <th class="px-3 py-2">操作人 / 时间</th>
                    <th class="px-3 py-2">备注</th>
                  </tr>
                </thead>
                <tbody>${renderOverrideLogRows(config.configId)}</tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </div>
  `
}

function updateField(field: string, node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): boolean {
  if (field === 'filter.keyword') state.keyword = node.value
  if (field === 'filter.process') state.processFilter = node.value
  if (field === 'filter.coverage') state.coverageFilter = node.value as CoverageFilter
  if (field === 'filter.timeout') state.timeoutFilter = node.value as TimeoutFilter
  if (field === 'filter.status') state.statusFilter = node.value as StatusFilter

  if (field === 'global.defaultAcceptTimeoutHours') state.globalDefaultDraft.defaultAcceptTimeoutHours = node.value
  if (field === 'global.enabled') state.globalDefaultDraft.enabled = node.value === 'true'
  if (field === 'global.remark') state.globalDefaultDraft.remark = node.value

  if (field === 'create.processCode') {
    state.createDraft.processCode = node.value
    state.createDraft.craftCode = getFirstCreateCraftCode(node.value)
  }
  if (field === 'create.craftCode') state.createDraft.craftCode = node.value
  if (field === 'create.defaultAcceptTimeoutHours') state.createDraft.defaultAcceptTimeoutHours = node.value
  if (field === 'create.enabled') state.createDraft.enabled = node.value === 'true'
  if (field === 'create.remark') state.createDraft.remark = node.value

  if (field === 'override.factoryTier') {
    state.overrideDraft.factoryTier = node.value
    state.overrideDraft.factoryType = DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_ID
    state.overrideDraft.factoryId = DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID
    state.overrideDraft.protectFromBroadOverrides = false
  }
  if (field === 'override.factoryType') {
    state.overrideDraft.factoryType = node.value
    state.overrideDraft.factoryId = DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID
    state.overrideDraft.protectFromBroadOverrides = false
  }
  if (field === 'override.factoryId') {
    state.overrideDraft.factoryId = node.value
    if (node.value === DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID) state.overrideDraft.protectFromBroadOverrides = false
  }
  if (field === 'override.protectFromBroadOverrides') {
    state.overrideDraft.protectFromBroadOverrides = node instanceof HTMLInputElement ? node.checked : node.value === 'true'
  }
  if (field === 'override.acceptTimeoutHours') state.overrideDraft.acceptTimeoutHours = node.value
  if (field === 'override.enabled') state.overrideDraft.enabled = node.value === 'true'
  if (field === 'override.remark') state.overrideDraft.remark = node.value

  state.errorText = ''
  return true
}

function handleSaveGlobalDefault(): boolean {
  const timeout = parseTimeoutHours(state.globalDefaultDraft.defaultAcceptTimeoutHours)
  if (timeout == null) {
    state.errorText = '全局默认接单时效必须是不小于 0 的数字。'
    return true
  }
  const saved = saveDispatchAcceptanceSlaGlobalDefaultConfig({
    enabled: state.globalDefaultDraft.enabled,
    defaultAcceptTimeoutHours: timeout,
    remark: state.globalDefaultDraft.remark,
  })
  state.dialog = { type: 'none' }
  state.globalDefaultDraft = createGlobalDefaultDraft()
  state.errorText = ''
  state.noticeText = `已保存全局默认接单时效：${formatDispatchAcceptanceTimeout(saved.defaultAcceptTimeoutHours)}。`
  return true
}

function handleSaveCreate(): boolean {
  const option = findCreateOption(state.createDraft.processCode, state.createDraft.craftCode)
  const timeout = parseTimeoutHours(state.createDraft.defaultAcceptTimeoutHours)
  if (!option) {
    state.errorText = '请选择需要新增规则的工序和工艺。'
    return true
  }
  if (timeout == null) {
    state.errorText = '默认接单时效必须是不小于 0 的数字。'
    return true
  }
  const saved = saveDispatchAcceptanceSlaConfig({
    processCode: option.processCode,
    processName: option.processName,
    craftCode: option.craftCode,
    craftName: option.craftName,
    defaultAcceptTimeoutHours: timeout,
    enabled: state.createDraft.enabled,
    remark: state.createDraft.remark,
  })
  state.dialog = { type: 'none' }
  state.createDraft = createEmptyRuleDraft()
  state.errorText = ''
  state.noticeText = `已新增 ${saved.processName} / ${saved.craftName} 接单时效规则。`
  return true
}

function handleSaveOverride(): boolean {
  if (state.dialog.type !== 'overrides') return false
  const config = getDispatchAcceptanceSlaConfigById(state.dialog.configId)
  const timeout = parseTimeoutHours(state.overrideDraft.acceptTimeoutHours)
  if (!config) {
    state.errorText = '未找到当前规则，无法维护工厂覆盖。'
    return true
  }
  const factories = getFactoryAbilityForDispatchAcceptance(config.processCode, config.craftCode)
  const tierOptions = getOverrideTierOptions(factories)
  const selectedTier = state.overrideDraft.factoryTier === DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_ID
    || tierOptions.some((option) => option.factoryTier === state.overrideDraft.factoryTier)
    ? state.overrideDraft.factoryTier
    : DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_ID
  const typeOptions = getOverrideTypeOptions(factories, selectedTier)
  const selectedType = state.overrideDraft.factoryType === DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_ID
    || typeOptions.some((option) => option.factoryType === state.overrideDraft.factoryType)
    ? state.overrideDraft.factoryType
    : DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_ID
  const factoryOptions = getOverrideFactoryOptions(factories, selectedTier, selectedType)
  const selectedFactory = factoryOptions.find((item) => item.id === state.overrideDraft.factoryId)
  const normalizedDraft: OverrideDraft = {
    ...state.overrideDraft,
    factoryTier: selectedTier,
    factoryType: selectedType,
    factoryId: selectedFactory ? state.overrideDraft.factoryId : DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID,
    protectFromBroadOverrides: Boolean(selectedFactory && state.overrideDraft.protectFromBroadOverrides),
  }
  const scopeType = getOverrideScopeType(normalizedDraft)
  if (scopeType === 'FACTORY' && !selectedFactory) {
    state.errorText = '请选择具备该工序工艺承接能力的工厂。'
    return true
  }
  if (timeout == null) {
    state.errorText = '覆盖接单时效必须是不小于 0 的数字。'
    return true
  }
  const selectedTierOption = tierOptions.find((option) => option.factoryTier === selectedTier)
  const selectedTypeOption = typeOptions.find((option) => option.factoryType === selectedType)
  const scopeFactoryId = scopeType === 'FACTORY'
    ? selectedFactory?.id || DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID
    : scopeType === 'FACTORY_TYPE'
      ? `${selectedTier || DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_ID}::${selectedType}`
      : scopeType === 'FACTORY_TIER'
        ? selectedTier
        : DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID
  const scopeFactoryName = scopeType === 'FACTORY'
    ? selectedFactory?.name || DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_NAME
    : getOverrideScopeText(normalizedDraft, selectedFactory)
  saveDispatchAcceptanceSlaFactoryOverride(config.configId, {
    scopeType,
    factoryTier: selectedTier === DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_ID ? undefined : selectedTier as FactoryTier,
    factoryTierName: selectedTierOption?.factoryTierName,
    factoryType: selectedType === DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_ID ? undefined : selectedType as FactoryType,
    factoryTypeName: selectedTypeOption?.factoryTypeName,
    factoryId: scopeFactoryId,
    factoryName: scopeFactoryName,
    protectFromBroadOverrides: normalizedDraft.protectFromBroadOverrides,
    acceptTimeoutHours: timeout,
    enabled: state.overrideDraft.enabled,
    remark: state.overrideDraft.remark,
  })
  state.overrideDraft = createEmptyOverrideDraft(config.configId)
  state.errorText = ''
  state.noticeText = `已保存 ${scopeFactoryName} 的接单时效覆盖。`
  return true
}

export function handleDispatchAcceptanceSlaEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-acceptance-sla-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.acceptanceSlaField
    return field ? updateField(field, fieldNode) : false
  }

  const actionNode = target.closest<HTMLElement>('[data-acceptance-sla-action]')
  const action = actionNode?.dataset.acceptanceSlaAction
  if (!action) return false

  if (action === 'apply-filters') return true
  if (action === 'reset-filters') {
    state.keyword = ''
    state.processFilter = 'ALL'
    state.coverageFilter = 'ALL'
    state.timeoutFilter = 'ALL'
    state.statusFilter = 'ALL'
    state.errorText = ''
    return true
  }
  if (action === 'open-create') {
    state.dialog = { type: 'create' }
    state.createDraft = createEmptyRuleDraft(actionNode?.dataset.processCraftKey || '')
    state.errorText = ''
    return true
  }
  if (action === 'open-global') {
    state.dialog = { type: 'global' }
    state.globalDefaultDraft = createGlobalDefaultDraft()
    state.errorText = ''
    return true
  }
  if (action === 'open-overrides') {
    const configId = actionNode?.dataset.configId
    if (!configId) return false
    state.dialog = { type: 'overrides', configId }
    state.overrideDraft = createEmptyOverrideDraft(configId)
    state.errorText = ''
    return true
  }
  if (action === 'close-dialog') {
    state.dialog = { type: 'none' }
    state.errorText = ''
    return true
  }
  if (action === 'save-global') return handleSaveGlobalDefault()
  if (action === 'save-create') return handleSaveCreate()
  if (action === 'save-override') return handleSaveOverride()

  return false
}

export function isDispatchAcceptanceSlaDialogOpen(): boolean {
  return state.dialog.type !== 'none'
}

export function renderDispatchAcceptanceSlaPage(): string {
  const rows = listDispatchAcceptanceSlaPageRows()
  const filteredRows = getFilteredRows(rows)

  return `
    <div class="space-y-5 p-6" data-testid="dispatch-acceptance-sla-page">
      ${renderPageHeader()}
      ${renderNotice()}
      ${renderSummary(rows)}
      ${renderGlobalDefaultPanel()}
      ${renderFilters(rows)}
      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        ${renderRuleTable(rows, filteredRows)}
        ${renderRiskPanel()}
      </div>
      ${renderGlobalDefaultDialog()}
      ${renderCreateDialog()}
      ${renderOverrideDrawer()}
    </div>
  `
}
