// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../components/ui/list-table.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListSortDirection,
  type StandardListSortState,
} from '../components/ui/list-table-model.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import { renderFormDrawer } from '../components/ui/drawer.ts'
import { renderCheckbox, renderFormField, renderInput, renderSelect as renderFormSelect } from '../components/ui/form.ts'
import { renderToast, renderToastContainer } from '../components/ui/toast.ts'
import {
  WOMENSWEAR_CATEGORY_OPTIONS,
  getThirdPartyFactoryComprehensiveAssessment,
  listThirdPartyFactoryComprehensiveAssessments,
  updateThirdPartyFactoryManualAssessment,
  type ComprehensiveAssessmentGrade,
  type ThirdPartyFactoryComprehensiveAssessment,
  type WomenswearCategory,
} from '../data/fcs/third-party-factory-comprehensive-assessment.ts'
import { appStore } from '../state/store.ts'
import { escapeHtml } from '../utils.ts'

const PAGE_PATH = '/fcs/factories/third-party-comprehensive-assessment'
const EVENT_PREFIX = 'third-party-comprehensive-assessment'
const COLUMN_STORAGE_KEY = 'fcs.third-party-comprehensive-assessment.columns.v1'
const PAGE_SIZE_OPTIONS = [10, 20, 50]
const MAX_FROZEN_WIDTH = 360

type CompletionFilter = 'ALL' | 'COMPLETE' | 'INCOMPLETE'

export interface ComprehensiveAssessmentQuery {
  keyword: string
  categories: string[]
  grade: 'ALL' | ComprehensiveAssessmentGrade
  ability: CompletionFilter
  capacity: CompletionFilter
  timeliness: CompletionFilter
  quality: CompletionFilter
  rating: CompletionFilter
  page: number
  pageSize: number
  editFactoryId: string
  sortKey: string
  sortDirection: StandardListSortDirection | ''
  columnSettings: boolean
}

let draggedColumnKey = ''

interface AssessmentEditorState {
  factoryId: string
  dirty: boolean
}

export interface AssessmentEditorInput {
  categoryAbilities: readonly string[]
  machineCount: string
  workerCount: string
  monthlyOutputValueTenThousandIdr: string
  grade: string
}

type AssessmentEditorErrors = Partial<Record<keyof AssessmentEditorInput, string>>

let editorState: AssessmentEditorState | null = null
let assessmentToastGeneration = 0
const ASSESSMENT_TOAST_DURATION = 1500

const columnRules = [
  { key: 'factory', required: true, freezeable: true },
  { key: 'craftAbility', freezeable: true },
  { key: 'categoryAbility', freezeable: true },
  { key: 'machineCount', freezeable: true },
  { key: 'workerCount', freezeable: true },
  { key: 'monthlyOutputValue', freezeable: true },
  { key: 'deliveryCompleted', freezeable: true },
  { key: 'return30', freezeable: true },
  { key: 'return70', freezeable: true },
  { key: 'return100', freezeable: true },
  { key: 'defectiveRate', freezeable: true },
  { key: 'defectRate', freezeable: true },
  { key: 'reworkRate', freezeable: true },
  { key: 'grade', required: true, freezeable: true },
  { key: 'actions', required: true, actionColumn: true },
]

const defaultColumnPreferences: StandardListColumnPreferences = normalizeListColumnPreferences(
  columnRules,
  {
    order: columnRules.map((column) => column.key),
    visibleKeys: columnRules.map((column) => column.key),
    frozenKeys: ['factory'],
    pageSize: 10,
  },
  PAGE_SIZE_OPTIONS,
)

export function getThirdPartyFactoryComprehensiveAssessmentDefaultColumnPreferences(): StandardListColumnPreferences {
  return {
    order: [...defaultColumnPreferences.order],
    visibleKeys: [...defaultColumnPreferences.visibleKeys],
    frozenKeys: [...defaultColumnPreferences.frozenKeys],
    pageSize: defaultColumnPreferences.pageSize,
  }
}

function getListStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function normalizeColumnPreferences(
  raw: Partial<StandardListColumnPreferences> | null | undefined,
): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, raw, PAGE_SIZE_OPTIONS)
}

function getColumnPreferences(): StandardListColumnPreferences {
  const storage = getListStorage()
  if (!storage) return getThirdPartyFactoryComprehensiveAssessmentDefaultColumnPreferences()
  return normalizeColumnPreferences(loadListColumnPreferences(
    storage,
    COLUMN_STORAGE_KEY,
    columnRules,
    defaultColumnPreferences,
    PAGE_SIZE_OPTIONS,
  ))
}

function saveColumnPreferences(preferences: StandardListColumnPreferences): void {
  const storage = getListStorage()
  if (storage) saveListColumnPreferences(storage, COLUMN_STORAGE_KEY, normalizeColumnPreferences(preferences))
}

function readQuery(): ComprehensiveAssessmentQuery {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
  const pageSize = Number(params.get('pageSize') ?? String(getColumnPreferences().pageSize))
  const sortDirection = params.get('sortDirection')
  return {
    keyword: params.get('keyword')?.trim() ?? '',
    categories: [...new Set(params.getAll('categories').filter((value) => WOMENSWEAR_CATEGORY_OPTIONS.includes(value as never)))],
    grade: normalizeGrade(params.get('grade')),
    ability: normalizeCompletionFilter(params.get('ability')),
    capacity: normalizeCompletionFilter(params.get('capacity')),
    timeliness: normalizeCompletionFilter(params.get('timeliness')),
    quality: normalizeCompletionFilter(params.get('quality')),
    rating: normalizeCompletionFilter(params.get('rating')),
    page: Math.max(1, Number(params.get('page') ?? '1') || 1),
    pageSize: PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : 10,
    editFactoryId: params.get('editFactoryId') ?? '',
    sortKey: params.get('sortKey') ?? '',
    sortDirection: sortDirection === 'asc' || sortDirection === 'desc' ? sortDirection : '',
    columnSettings: params.get('columnSettings') === '1',
  }
}

function normalizeGrade(value: string | null): ComprehensiveAssessmentQuery['grade'] {
  return value === 'S' || value === 'A' || value === 'B' || value === 'C' ? value : 'ALL'
}

function normalizeCompletionFilter(value: string | null): CompletionFilter {
  return value === 'COMPLETE' || value === 'INCOMPLETE' ? value : 'ALL'
}

function matchesCompletion(value: boolean, filter: CompletionFilter): boolean {
  return filter === 'ALL' || (filter === 'COMPLETE' ? value : !value)
}

export function filterThirdPartyFactoryComprehensiveAssessments(
  rows: readonly ThirdPartyFactoryComprehensiveAssessment[],
  query: Pick<ComprehensiveAssessmentQuery, 'keyword' | 'categories' | 'grade' | 'ability' | 'capacity' | 'timeliness' | 'quality' | 'rating'>,
): ThirdPartyFactoryComprehensiveAssessment[] {
  const keyword = query.keyword.trim().toLowerCase()
  return rows.filter((row) => {
    const matchesKeyword = !keyword || [row.factoryName, row.factoryCode, row.factoryId]
      .some((value) => value.toLowerCase().includes(keyword))
    const matchesCategory = query.categories.length === 0 || row.categoryAbilities.some((category) => query.categories.includes(category))
    return matchesKeyword && matchesCategory &&
      (query.grade === 'ALL' || row.grade === query.grade) &&
      matchesCompletion(row.completion.ability, query.ability) &&
      matchesCompletion(row.completion.capacity, query.capacity) &&
      matchesCompletion(row.completion.timeliness, query.timeliness) &&
      matchesCompletion(row.completion.quality, query.quality) &&
      matchesCompletion(row.completion.grade, query.rating)
  })
}

function getSortState(query: ComprehensiveAssessmentQuery): StandardListSortState | null {
  return query.sortKey && query.sortDirection ? { key: query.sortKey, direction: query.sortDirection } : null
}

function buildHref(query: ComprehensiveAssessmentQuery, patch: Partial<ComprehensiveAssessmentQuery>): string {
  const next = { ...query, ...patch }
  const params = new URLSearchParams()
  if (next.keyword) params.set('keyword', next.keyword)
  next.categories.forEach((category) => params.append('categories', category))
  if (next.grade !== 'ALL') params.set('grade', next.grade)
  ;(['ability', 'capacity', 'timeliness', 'quality', 'rating'] as const).forEach((key) => {
    if (next[key] !== 'ALL') params.set(key, next[key])
  })
  if (next.page > 1) params.set('page', String(next.page))
  if (next.pageSize !== 10) params.set('pageSize', String(next.pageSize))
  if (next.editFactoryId) params.set('editFactoryId', next.editFactoryId)
  if (next.sortKey && next.sortDirection) {
    params.set('sortKey', next.sortKey)
    params.set('sortDirection', next.sortDirection)
  }
  if (next.columnSettings) params.set('columnSettings', '1')
  const search = params.toString()
  return search ? `${PAGE_PATH}?${search}` : PAGE_PATH
}

function renderSelect(
  name: string,
  value: string,
  options: Array<[string, string]>,
  completionFilter?: string,
): string {
  return `
    <select name="${escapeHtml(name)}" class="h-9 min-w-0 rounded-md border bg-background px-3 text-sm" ${completionFilter ? `data-completion-filter="${completionFilter}"` : ''}>
      ${options.map(([optionValue, label]) => `<option value="${escapeHtml(optionValue === 'ALL' ? '' : optionValue)}" ${optionValue === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
    </select>
  `
}

function renderFilters(query: ComprehensiveAssessmentQuery): string {
  return `
    <form action="${PAGE_PATH}" method="get" class="space-y-3 rounded-lg border bg-card p-4" data-third-party-comprehensive-assessment-filters>
      <input type="hidden" name="page" value="1">
      <input type="hidden" name="pageSize" value="${query.pageSize}">
      <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-[minmax(230px,1.3fr)_minmax(230px,1.5fr)_repeat(6,minmax(120px,1fr))_auto]">
        <input name="keyword" value="${escapeHtml(query.keyword)}" class="h-9 min-w-0 rounded-md border bg-background px-3 text-sm" placeholder="工厂名称 / 编码" data-third-party-comprehensive-assessment-field="keyword">
        <div class="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-background px-3 text-xs">
          <span class="text-muted-foreground">品类能力</span>
          ${WOMENSWEAR_CATEGORY_OPTIONS.map((category) => `<label class="inline-flex items-center gap-1"><input type="checkbox" name="categories" value="${escapeHtml(category)}" ${query.categories.includes(category) ? 'checked' : ''}>${escapeHtml(category)}</label>`).join('')}
        </div>
        ${renderSelect('grade', query.grade, [['ALL', '综合评级'], ['S', 'S 级'], ['A', 'A 级'], ['B', 'B 级'], ['C', 'C 级']])}
        ${renderSelect('ability', query.ability, [['ALL', '能力全部'], ['COMPLETE', '能力已完善'], ['INCOMPLETE', '能力待完善']], 'ability')}
        ${renderSelect('capacity', query.capacity, [['ALL', '产能全部'], ['COMPLETE', '产能已完善'], ['INCOMPLETE', '产能待完善']], 'capacity')}
        ${renderSelect('timeliness', query.timeliness, [['ALL', '时效全部'], ['COMPLETE', '时效已完善'], ['INCOMPLETE', '时效待完善']], 'timeliness')}
        ${renderSelect('quality', query.quality, [['ALL', '品控全部'], ['COMPLETE', '品控已完善'], ['INCOMPLETE', '品控待完善']], 'quality')}
        ${renderSelect('rating', query.rating, [['ALL', '评级全部'], ['COMPLETE', '评级已完善'], ['INCOMPLETE', '评级待完善']], 'rating')}
        <button type="submit" class="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">筛选</button>
      </div>
    </form>
  `
}

function renderSource(label: string, tone: 'system' | 'manual' | 'empty'): string {
  const toneClass = tone === 'system'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : tone === 'manual'
      ? 'border-sky-200 bg-sky-50 text-sky-700'
      : 'border-slate-200 bg-slate-50 text-slate-500'
  return `<span class="mt-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] leading-none ${toneClass}">${escapeHtml(label)}</span>`
}

function renderManualValue(value: string | number | null, suffix = ''): string {
  return value === null
    ? `<div class="text-sm text-muted-foreground">—</div>${renderSource('待完善', 'empty')}`
    : `<div class="text-sm tabular-nums">${escapeHtml(value)}${suffix}</div>${renderSource('人工填写', 'manual')}`
}

function renderSystemRate(value: number | null): string {
  return value === null
    ? `<div class="text-sm text-muted-foreground">—</div>${renderSource('暂无业务数据', 'empty')}`
    : `<div class="text-sm tabular-nums">${(value * 100).toFixed(1)}%</div>${renderSource('时效业务数据', 'system')}`
}

function renderQualityRate(value: number | null): string {
  return value === null
    ? `<div class="text-sm text-muted-foreground">—</div>${renderSource('暂无业务数据', 'empty')}`
    : `<div class="text-sm tabular-nums">${(value * 100).toFixed(1)}%</div>${renderSource('质检业务数据', 'system')}`
}

function renderGrade(row: ThirdPartyFactoryComprehensiveAssessment): string {
  return row.grade === null
    ? `<div class="text-sm text-muted-foreground">待评定</div>${renderSource('待完善', 'empty')}`
    : `<div class="font-semibold">${escapeHtml(row.grade)} 级</div>${renderSource('人工填写', 'manual')}`
}

function formatUpdatedAt(value: string | null): string {
  if (!value) return '未记录'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function validateThirdPartyFactoryComprehensiveAssessmentInput(
  input: AssessmentEditorInput,
): AssessmentEditorErrors {
  const errors: AssessmentEditorErrors = {}
  if (!input.categoryAbilities.some((category) => WOMENSWEAR_CATEGORY_OPTIONS.includes(category as WomenswearCategory))) {
    errors.categoryAbilities = '至少选择 1 个品类能力'
  }
  if (!/^[1-9]\d*$/.test(input.machineCount)) errors.machineCount = '机器台数必须为正整数'
  if (!/^[1-9]\d*$/.test(input.workerCount)) errors.workerCount = '工人人数必须为正整数'
  if (!/^\d+(?:\.\d{1,2})?$/.test(input.monthlyOutputValueTenThousandIdr) || Number(input.monthlyOutputValueTenThousandIdr) <= 0) {
    errors.monthlyOutputValueTenThousandIdr = '月产值必须大于 0，最多保留 2 位小数'
  }
  if (!['S', 'A', 'B', 'C'].includes(input.grade)) errors.grade = '请选择综合评级'
  return errors
}

function renderEditorErrors(errors: AssessmentEditorErrors): string {
  const messages = Object.values(errors)
  return `<div data-assessment-form-errors>${messages.length > 0
    ? `<div class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"><p class="font-medium">请修正后再保存</p><ul class="mt-1 list-disc space-y-0.5 pl-5">${messages.map((message) => `<li>${escapeHtml(message)}</li>`).join('')}</ul></div>`
    : ''}</div>`
}

function renderNumberEditorField(
  label: string,
  field: 'machineCount' | 'workerCount' | 'monthlyOutputValueTenThousandIdr',
  value: number | null,
  suffix: string,
  step: string,
): string {
  const input = renderInput({
    name: field,
    value: value === null ? '' : String(value),
    type: 'number',
    required: true,
    prefix: EVENT_PREFIX,
    field,
    className: 'border-sky-200 bg-sky-50/40 pr-28',
  }).replace('<input type="number"', `<input type="number" min="${step === '1' ? '1' : '0.01'}" step="${step}"`)
  return renderFormField({ label, required: true, hint: `人工填写 · ${suffix}` }, `
    <div class="relative">${input}<span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sky-700">${escapeHtml(suffix)}</span></div>
  `)
}

function renderReadonlyRate(label: string, value: number | null, source: string): string {
  return `<div class="rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2">
    <div class="text-xs text-emerald-700">${escapeHtml(label)}</div>
    <div class="mt-1 font-medium tabular-nums">${value === null ? '暂无业务数据' : `${(value * 100).toFixed(1)}%`}</div>
    <div class="mt-1 text-[11px] text-emerald-700">${escapeHtml(source)}</div>
  </div>`
}

function renderAssessmentEditor(factoryId: string, errors: AssessmentEditorErrors = {}): string {
  const row = getThirdPartyFactoryComprehensiveAssessment(factoryId)
  if (!row) return ''
  const categories = WOMENSWEAR_CATEGORY_OPTIONS.map((category) => renderCheckbox({
    id: `assessment-category-${WOMENSWEAR_CATEGORY_OPTIONS.indexOf(category)}`,
    name: 'categoryAbilities',
    checked: row.categoryAbilities.includes(category),
    label: category,
    prefix: EVENT_PREFIX,
    field: 'categoryAbilities',
  }).replace('type="checkbox"', `type="checkbox" value="${escapeHtml(category)}"`)).join('')
  const gradeSelect = renderFormSelect({
    name: 'grade',
    value: row.grade ?? '',
    options: ['S', 'A', 'B', 'C'].map((grade) => ({ value: grade, label: `${grade} 级` })),
    placeholder: '请选择综合评级',
    required: true,
    prefix: EVENT_PREFIX,
    field: 'grade',
    className: 'border-sky-200 bg-sky-50/40',
  }).replace('value="" disabled', 'value=""')
  const content = `
    <div data-third-party-comprehensive-assessment-editor class="space-y-5">
      ${renderEditorErrors(errors)}
      <section class="rounded-lg border p-4">
        <div class="flex items-start justify-between gap-3"><div><h3 class="text-sm font-semibold">能力</h3><p class="mt-1 text-xs text-muted-foreground">工艺能力只读，品类能力由业务人员维护。</p></div><div class="flex gap-1">${renderSource('工厂档案', 'system')}${renderSource('人工填写', 'manual')}</div></div>
        <div class="mt-3 rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2"><div class="text-xs text-emerald-700">工艺能力 · 工厂档案</div><div class="mt-1 text-sm font-medium">${escapeHtml(row.processAbilities.join('、') || '暂无')}</div><div class="mt-1 text-[11px] text-emerald-700">系统数据，只读</div></div>
        <div class="mt-3 rounded-md border border-sky-200 bg-sky-50/30 p-3"><div class="text-sm font-medium text-sky-800">品类能力 <span class="text-rose-500">*</span></div><div class="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">${categories}</div><p class="mt-2 text-xs text-sky-700">人工填写 · 至少选择 1 项</p></div>
      </section>
      <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">产能</h3><p class="mt-1 text-xs text-sky-700">以下字段均为人工填写。</p><div class="mt-3 grid gap-4 sm:grid-cols-2">${renderNumberEditorField('机器台数', 'machineCount', row.machineCount, '台', '1')}${renderNumberEditorField('工人人数', 'workerCount', row.workerCount, '人', '1')}<div class="sm:col-span-2">${renderNumberEditorField('月产值', 'monthlyOutputValueTenThousandIdr', row.monthlyOutputValueTenThousandIdr, '万印尼盾／月', '0.01')}</div></div></section>
      <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">时效</h3><p class="mt-1 text-xs text-emerald-700">系统计算，只读；沿用生产交付与回货节点口径。</p><div class="mt-3 grid grid-cols-2 gap-3">${renderReadonlyRate('交付完成', row.timeliness.deliveryOnTimeRate, '时效业务数据')}${renderReadonlyRate('30% 回货', row.timeliness.receipt30OnTimeRate, '时效业务数据')}${renderReadonlyRate('70% 回货', row.timeliness.receipt70OnTimeRate, '时效业务数据')}${renderReadonlyRate('100% 回货', row.timeliness.receipt100OnTimeRate, '时效业务数据')}</div></section>
      <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">品控</h3><p class="mt-1 text-xs text-emerald-700">系统计算，只读；沿用质检业务数据口径。</p><div class="mt-3 grid grid-cols-3 gap-3">${renderReadonlyRate('不良品率', row.quality.defectiveRate, '质检业务数据')}${renderReadonlyRate('瑕疵率', row.quality.defectRate, '质检业务数据')}${renderReadonlyRate('返工率', row.quality.reworkRate, '质检业务数据')}</div></section>
      <section class="rounded-lg border border-sky-200 bg-sky-50/30 p-4">${renderFormField({ label: '独立综合评级', required: true, hint: '人工填写 · 与三方工厂初评评级独立维护' }, gradeSelect)}</section>
    </div>`
  return `<form data-third-party-comprehensive-assessment-editor-form>${renderFormDrawer({
    title: '编辑综合评定',
    subtitle: `${row.factoryName}（${row.factoryCode}）`,
    closeAction: { prefix: EVENT_PREFIX, action: 'close-editor' },
    submitAction: { prefix: EVENT_PREFIX, action: 'save-editor', label: '保存评定' },
    width: 'lg',
  }, content)}</form>`
}

const columns: readonly StandardListColumn<ThirdPartyFactoryComprehensiveAssessment>[] = [
  {
    key: 'factory', title: '工厂', width: 248, minWidth: 248, required: true, freezeable: true, sortable: true,
    render: (row) => `
      <div class="space-y-1" data-assessment-factory-id="${escapeHtml(row.factoryId)}">
        <div class="font-medium">${escapeHtml(row.factoryName)}</div>
        <div class="font-mono text-xs text-muted-foreground">${escapeHtml(row.factoryCode)}</div>
        <div class="text-xs ${row.completion.incompleteCount === 0 ? 'text-emerald-700' : 'text-amber-700'}">${row.completion.incompleteCount === 0 ? '评定已完善' : `待完善 ${row.completion.incompleteCount} 项`}</div>
        <div class="text-[11px] text-muted-foreground">${escapeHtml(row.updatedBy ?? '未记录')} / ${escapeHtml(formatUpdatedAt(row.updatedAt))}</div>
        ${renderSource('工厂档案', 'system')}
      </div>`,
    sortValue: (row) => row.factoryName,
  },
  { key: 'craftAbility', title: '工艺能力', width: 150, freezeable: true, sortable: true, render: (row) => `<div class="text-sm">${escapeHtml(row.processAbilities.join('、') || '—')}</div>${renderSource('工厂档案', 'system')}`, sortValue: (row) => row.processAbilities.join('、') },
  { key: 'categoryAbility', title: '品类能力', width: 180, freezeable: true, sortable: true, render: (row) => renderManualValue(row.categoryAbilities.join('、') || null), sortValue: (row) => row.categoryAbilities.join('、') },
  { key: 'machineCount', title: '机器数', width: 110, freezeable: true, align: 'right', sortable: true, render: (row) => renderManualValue(row.machineCount, ' 台'), sortValue: (row) => row.machineCount },
  { key: 'workerCount', title: '工人数', width: 110, freezeable: true, align: 'right', sortable: true, render: (row) => renderManualValue(row.workerCount, ' 人'), sortValue: (row) => row.workerCount },
  { key: 'monthlyOutputValue', title: '月产值', width: 160, freezeable: true, align: 'right', sortable: true, render: (row) => renderManualValue(row.monthlyOutputValueTenThousandIdr, ' 万印尼盾／月'), sortValue: (row) => row.monthlyOutputValueTenThousandIdr },
  { key: 'deliveryCompleted', title: '交期完成', width: 126, freezeable: true, align: 'right', sortable: true, render: (row) => renderSystemRate(row.timeliness.deliveryOnTimeRate), sortValue: (row) => row.timeliness.deliveryOnTimeRate },
  { key: 'return30', title: '回货 30%', width: 118, freezeable: true, align: 'right', sortable: true, render: (row) => renderSystemRate(row.timeliness.receipt30OnTimeRate), sortValue: (row) => row.timeliness.receipt30OnTimeRate },
  { key: 'return70', title: '回货 70%', width: 118, freezeable: true, align: 'right', sortable: true, render: (row) => renderSystemRate(row.timeliness.receipt70OnTimeRate), sortValue: (row) => row.timeliness.receipt70OnTimeRate },
  { key: 'return100', title: '回货 100%', width: 122, freezeable: true, align: 'right', sortable: true, render: (row) => renderSystemRate(row.timeliness.receipt100OnTimeRate), sortValue: (row) => row.timeliness.receipt100OnTimeRate },
  { key: 'defectiveRate', title: '不良率', width: 112, freezeable: true, align: 'right', sortable: true, render: (row) => renderQualityRate(row.quality.defectiveRate), sortValue: (row) => row.quality.defectiveRate },
  { key: 'defectRate', title: '工厂责任瑕疵率', width: 146, freezeable: true, align: 'right', sortable: true, render: (row) => renderQualityRate(row.quality.defectRate), sortValue: (row) => row.quality.defectRate },
  { key: 'reworkRate', title: '返工率', width: 112, freezeable: true, align: 'right', sortable: true, render: (row) => renderQualityRate(row.quality.reworkRate), sortValue: (row) => row.quality.reworkRate },
  { key: 'grade', title: '综合评级', width: 116, required: true, freezeable: true, sortable: true, render: renderGrade, sortValue: (row) => row.grade },
  { key: 'actions', title: '操作', width: 108, required: true, actionColumn: true, render: (row) => `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-${EVENT_PREFIX}-action="open-editor" data-factory-id="${escapeHtml(row.factoryId)}">编辑评定</button>` },
]

const headerGroups = [
  { key: 'factory', title: '工厂信息', columnKeys: ['factory'], toneClass: 'bg-slate-50 text-slate-600' },
  { key: 'ability', title: '能力', columnKeys: ['craftAbility', 'categoryAbility'], toneClass: 'bg-emerald-50/70 text-emerald-700' },
  { key: 'capacity', title: '产能', columnKeys: ['machineCount', 'workerCount', 'monthlyOutputValue'], toneClass: 'bg-sky-50/70 text-sky-700' },
  { key: 'timeliness', title: '时效', columnKeys: ['deliveryCompleted', 'return30', 'return70', 'return100'], toneClass: 'bg-amber-50/70 text-amber-700' },
  { key: 'quality', title: '品控', columnKeys: ['defectiveRate', 'defectRate', 'reworkRate'], toneClass: 'bg-violet-50/70 text-violet-700' },
  { key: 'grade', title: '评级', columnKeys: ['grade'], toneClass: 'bg-slate-50 text-slate-600' },
  { key: 'actions', title: '操作', columnKeys: ['actions'], toneClass: 'bg-slate-50 text-slate-600' },
] as const

function getSortValue(row: ThirdPartyFactoryComprehensiveAssessment, key: string): unknown {
  return columns.find((column) => column.key === key)?.sortValue?.(row)
}

function renderStats(rows: readonly ThirdPartyFactoryComprehensiveAssessment[]): string {
  const completeCount = rows.filter((row) => row.completion.incompleteCount === 0).length
  const gradeCounts = ['S', 'A', 'B', 'C'].map((grade) => `${grade} ${rows.filter((row) => row.grade === grade).length}`).join(' / ')
  return renderStandardListStats([
    { label: '全部工厂', value: `${rows.length} 家` },
    { label: '评定已完善', value: `${completeCount} 家` },
    { label: '待完善', value: `${rows.length - completeCount} 家` },
    { label: '评级分布', value: gradeCounts },
  ])
}

function renderPagination(query: ComprehensiveAssessmentQuery, paging: ReturnType<typeof paginateStandardListRows<ThirdPartyFactoryComprehensiveAssessment>>): string {
  const raw = renderTablePagination({
    total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages,
    pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: PAGE_SIZE_OPTIONS,
  })
  return raw
    .replace(`data-${EVENT_PREFIX}-action="prev-page"`, `data-nav="${escapeHtml(buildHref(query, { page: Math.max(1, paging.currentPage - 1) }))}"`)
    .replace(`data-${EVENT_PREFIX}-action="next-page"`, `data-nav="${escapeHtml(buildHref(query, { page: Math.min(paging.totalPages, paging.currentPage + 1) }))}"`)
}

function renderColumnSettingsOverlay(query: ComprehensiveAssessmentQuery, preferences: StandardListColumnPreferences): string {
  if (!query.columnSettings) return ''
  return renderStandardListColumnSettings({
    title: '列设置', columns, preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: MAX_FROZEN_WIDTH,
  })
}

function renderAssessmentOverlays(query: ComprehensiveAssessmentQuery, preferences: StandardListColumnPreferences): string {
  if (editorState) return renderAssessmentEditor(editorState.factoryId)
  return renderColumnSettingsOverlay(query, preferences)
}

function getAssessmentTableState(query: ComprehensiveAssessmentQuery): {
  filteredRows: ThirdPartyFactoryComprehensiveAssessment[]
  paging: ReturnType<typeof paginateStandardListRows<ThirdPartyFactoryComprehensiveAssessment>>
} {
  const filteredRows = filterThirdPartyFactoryComprehensiveAssessments(listThirdPartyFactoryComprehensiveAssessments(), query)
  const sortedRows = sortStandardListRows(filteredRows, getSortState(query), getSortValue)
  return { filteredRows, paging: paginateStandardListRows(sortedRows, query.page, query.pageSize) }
}

function renderAssessmentTable(query: ComprehensiveAssessmentQuery, preferences: StandardListColumnPreferences): string {
  const { paging } = getAssessmentTableState(query)
  return renderStandardListTable({
    columns,
    rows: paging.rows,
    preferences,
    sort: getSortState(query),
    eventPrefix: EVENT_PREFIX,
    headerGroups,
    emptyText: '暂无符合条件的三方车缝工厂',
  })
}

function nextSortPatch(query: ComprehensiveAssessmentQuery, columnKey: string): Partial<ComprehensiveAssessmentQuery> {
  if (query.sortKey !== columnKey || !query.sortDirection) return { sortKey: columnKey, sortDirection: 'asc', page: 1 }
  if (query.sortDirection === 'asc') return { sortKey: columnKey, sortDirection: 'desc', page: 1 }
  return { sortKey: '', sortDirection: '', page: 1 }
}

function navigateAssessmentList(href: string): void {
  appStore.navigate(href)
}

function replaceAssessmentUrl(query: ComprehensiveAssessmentQuery): void {
  if (typeof window === 'undefined') return
  const href = buildHref(query, {})
  if (`${window.location.pathname}${window.location.search}` !== href) {
    window.history.replaceState({}, '', href)
  }
}

function hydrateInsertedIcons(root: ParentNode): void {
  void import('../components/shell.ts')
    .then(({ hydrateIcons }) => hydrateIcons(root))
    .catch(() => undefined)
}

function refreshAssessmentOverlaysLocally(query: ComprehensiveAssessmentQuery, errors: AssessmentEditorErrors = {}): boolean {
  if (typeof document === 'undefined') return false
  const overlays = document.querySelector<HTMLElement>('[data-third-party-comprehensive-assessment-overlays]')
  if (!overlays) return false
  overlays.innerHTML = editorState
    ? renderAssessmentEditor(editorState.factoryId, errors)
    : renderColumnSettingsOverlay(query, getColumnPreferences())
  if (overlays.innerHTML) hydrateInsertedIcons(overlays)
  return true
}

function readEditorInput(root: ParentNode = document): AssessmentEditorInput | null {
  if (typeof document === 'undefined') return null
  const editor = root.querySelector<HTMLElement>('[data-third-party-comprehensive-assessment-editor]')
  if (!editor) return null
  const read = (field: string) => editor.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="${field}"]`)?.value ?? ''
  return {
    categoryAbilities: [...editor.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="categoryAbilities"]:checked`)].map((item) => item.value),
    machineCount: read('machineCount').trim(),
    workerCount: read('workerCount').trim(),
    monthlyOutputValueTenThousandIdr: read('monthlyOutputValueTenThousandIdr').trim(),
    grade: read('grade'),
  }
}

function refreshSavedAssessmentLocally(query: ComprehensiveAssessmentQuery, factoryId: string): boolean {
  if (typeof document === 'undefined') return false
  const root = document.querySelector<HTMLElement>('[data-third-party-comprehensive-assessment-page]')
  const stats = root?.querySelector<HTMLElement>('[data-assessment-stats-surface]')
  const table = root?.querySelector<HTMLElement>('[data-assessment-table-surface]')
  const pagination = root?.querySelector<HTMLElement>('[data-assessment-pagination-surface]')
  if (!stats || !table || !pagination) return false

  const { filteredRows, paging } = getAssessmentTableState(query)
  stats.innerHTML = renderStats(filteredRows)
  pagination.innerHTML = renderPagination(query, paging)

  const currentIds = [...table.querySelectorAll<HTMLElement>('[data-assessment-factory-id]')].map((node) => node.dataset.assessmentFactoryId ?? '')
  const nextIds = paging.rows.map((row) => row.factoryId)
  const currentRow = table.querySelector<HTMLElement>(`[data-assessment-factory-id="${CSS.escape(factoryId)}"]`)?.closest<HTMLTableRowElement>('tr')
  const nextRow = paging.rows.find((row) => row.factoryId === factoryId)
  if (currentRow && nextRow && currentIds.join('|') === nextIds.join('|')) {
    const visibleColumnKeys = [...table.querySelectorAll<HTMLElement>('thead tr:last-child th[data-column-key]')]
      .map((header) => header.dataset.columnKey ?? '')
    ;[...currentRow.cells].forEach((cell, index) => {
      const column = columns.find((item) => item.key === visibleColumnKeys[index])
      if (column) cell.innerHTML = column.render(nextRow, 0)
    })
  } else {
    const scroll = table.querySelector<HTMLElement>('[data-standard-list-scroll]')
    const scrollLeft = scroll?.scrollLeft ?? 0
    table.innerHTML = renderAssessmentTable(query, getColumnPreferences())
    const nextScroll = table.querySelector<HTMLElement>('[data-standard-list-scroll]')
    if (nextScroll) nextScroll.scrollLeft = Math.min(scrollLeft, Math.max(0, nextScroll.scrollWidth - nextScroll.clientWidth))
  }
  return true
}

function showAssessmentSavedToast(factoryName: string): void {
  if (typeof document === 'undefined') return
  const container = document.querySelector<HTMLElement>('[data-toast-container]')
  if (!container) return
  const generation = ++assessmentToastGeneration
  const toastId = `assessment-toast-${generation}`
  container.innerHTML = renderToast({
    title: '评定已保存',
    description: `${factoryName} 的人工评定已更新`,
    variant: 'success',
    duration: ASSESSMENT_TOAST_DURATION,
  }, toastId)
  window.setTimeout(() => {
    if (generation !== assessmentToastGeneration) return
    container.querySelector<HTMLElement>(`[data-toast="${toastId}"]`)?.remove()
  }, ASSESSMENT_TOAST_DURATION)
}

function dismissAssessmentToast(toastId?: string): void {
  if (typeof document === 'undefined') return
  const container = document.querySelector<HTMLElement>('[data-toast-container]')
  if (!container) return
  if (toastId) container.querySelector<HTMLElement>(`[data-toast="${CSS.escape(toastId)}"]`)?.remove()
  else container.innerHTML = ''
  assessmentToastGeneration += 1
}

function saveAssessmentEditor(form: HTMLFormElement): void {
  if (!editorState) return
  const input = readEditorInput(form)
  if (!input) return
  const errors = validateThirdPartyFactoryComprehensiveAssessmentInput(input)
  const errorSurface = form.querySelector<HTMLElement>('[data-assessment-form-errors]')
  if (Object.keys(errors).length > 0) {
    if (errorSurface) errorSurface.innerHTML = renderEditorErrors(errors).replace(/^<div data-assessment-form-errors>|<\/div>$/g, '')
    return
  }
  const factoryId = editorState.factoryId
  try {
    const saved = updateThirdPartyFactoryManualAssessment(factoryId, {
      categoryAbilities: input.categoryAbilities as WomenswearCategory[],
      machineCount: Number(input.machineCount),
      workerCount: Number(input.workerCount),
      monthlyOutputValueTenThousandIdr: Number(input.monthlyOutputValueTenThousandIdr),
      grade: input.grade as ComprehensiveAssessmentGrade,
      updatedBy: '当前登录用户',
      updatedAt: new Date().toISOString(),
    })
    editorState = null
    const query = readQuery()
    refreshAssessmentOverlaysLocally(query)
    refreshSavedAssessmentLocally(query, factoryId)
    showAssessmentSavedToast(saved.factoryName)
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存失败，请稍后重试'
    if (errorSurface) errorSurface.innerHTML = renderEditorErrors({ grade: message }).replace(/^<div data-assessment-form-errors>|<\/div>$/g, '')
  }
}

export function handleThirdPartyFactoryComprehensiveAssessmentSubmit(form: HTMLFormElement): boolean {
  if (!form.matches('[data-third-party-comprehensive-assessment-editor-form]')) return false
  saveAssessmentEditor(form)
  return true
}

function refreshColumnSettingsLocally(query: ComprehensiveAssessmentQuery): boolean {
  if (typeof document === 'undefined') return false
  const root = document.querySelector<HTMLElement>('[data-third-party-comprehensive-assessment-page]')
  const table = root?.querySelector<HTMLElement>('[data-assessment-table-surface]')
  const pagination = root?.querySelector<HTMLElement>('[data-assessment-pagination-surface]')
  const overlays = root?.querySelector<HTMLElement>('[data-third-party-comprehensive-assessment-overlays]')
  if (!table || !pagination || !overlays) return false

  const scrollLeft = table.querySelector<HTMLElement>('[data-standard-list-scroll]')?.scrollLeft ?? 0
  const preferences = getColumnPreferences()
  table.innerHTML = renderAssessmentTable(query, preferences)
  const nextScroll = table.querySelector<HTMLElement>('[data-standard-list-scroll]')
  if (nextScroll) {
    const maxScrollLeft = Math.max(0, nextScroll.scrollWidth - nextScroll.clientWidth)
    nextScroll.scrollLeft = Math.max(0, Math.min(scrollLeft, maxScrollLeft))
  }
  const { paging } = getAssessmentTableState(query)
  pagination.innerHTML = renderPagination(query, paging)
  overlays.innerHTML = renderColumnSettingsOverlay(query, preferences)
  hydrateInsertedIcons(table)
  hydrateInsertedIcons(pagination)
  hydrateInsertedIcons(overlays)
  return true
}

function getActionColumnKey(actionNode: HTMLElement): string {
  return actionNode.dataset.thirdPartyComprehensiveAssessmentColumnKey || actionNode.dataset.columnKey || ''
}

function getDragColumnKey(dragNode: HTMLElement): string {
  return dragNode.dataset.thirdPartyComprehensiveAssessmentColumnKey
    || dragNode.dataset.dragSource
    || dragNode.dataset.dropTarget
    || ''
}

function getDraggableColumn(columnKey: string): StandardListColumn<ThirdPartyFactoryComprehensiveAssessment> | undefined {
  return columns.find((column) => column.key === columnKey && !column.actionColumn)
}

function canFreezeColumn(
  preferences: StandardListColumnPreferences,
  column: StandardListColumn<ThirdPartyFactoryComprehensiveAssessment>,
): boolean {
  if (!column.freezeable || column.actionColumn) return false
  if (preferences.frozenKeys.includes(column.key)) return true
  const currentFrozenWidth = columns.reduce((total, item) =>
    total + (preferences.frozenKeys.includes(item.key) && !item.actionColumn ? item.width : 0), 0)
  return currentFrozenWidth + column.width <= MAX_FROZEN_WIDTH
}

export function handleThirdPartyFactoryComprehensiveAssessmentEvent(target: HTMLElement, event?: Event): boolean {
  const dragEvent = event as (DragEvent & {
    higoodStandardListColumnDrag?: true
    higoodStandardListColumnKey?: string
  }) | undefined

  const toastClose = target.closest<HTMLElement>('[data-toast-close]')
  if (toastClose) {
    event?.preventDefault()
    dismissAssessmentToast(toastClose.dataset.toastClose)
    return true
  }

  if (event?.type === 'dragend') {
    if (!draggedColumnKey && !dragEvent?.higoodStandardListColumnDrag) return false
    draggedColumnKey = ''
    return true
  }

  const dragNode = target.closest<HTMLElement>('[data-standard-list-column-drag]')
  if (dragNode && event && ['dragstart', 'dragover', 'drop'].includes(event.type)) {
    const columnKey = getDragColumnKey(dragNode)
    const column = getDraggableColumn(columnKey)

    if (event.type === 'dragstart') {
      draggedColumnKey = column?.key || ''
      if (!column) return false
      dragEvent?.dataTransfer?.setData('application/x-higood-list-column-key', column.key)
      if (dragEvent?.dataTransfer) dragEvent.dataTransfer.effectAllowed = 'move'
      return true
    }

    const sourceKey = dragEvent?.higoodStandardListColumnKey
      || dragEvent?.dataTransfer?.getData('application/x-higood-list-column-key')
      || draggedColumnKey
    const sourceColumn = getDraggableColumn(sourceKey)
    const targetColumn = getDraggableColumn(columnKey)
    if (
      !sourceColumn ||
      !targetColumn ||
      (draggedColumnKey !== '' && draggedColumnKey !== sourceColumn.key) ||
      sourceColumn.key === targetColumn.key
    ) {
      if (event.type === 'drop') draggedColumnKey = ''
      return false
    }

    if (event.type === 'dragover') {
      event.preventDefault()
      if (dragEvent?.dataTransfer) dragEvent.dataTransfer.dropEffect = 'move'
      return true
    }

    draggedColumnKey = ''
    event.preventDefault()
    const preferences = getColumnPreferences()
    const order = preferences.order.filter((key) => key !== sourceColumn.key)
    const targetIndex = order.indexOf(targetColumn.key)
    if (targetIndex < 0) return false
    order.splice(targetIndex, 0, sourceColumn.key)
    saveColumnPreferences(normalizeColumnPreferences({ ...preferences, order }))
    refreshColumnSettingsLocally({ ...readQuery(), columnSettings: true })
    return true
  }

  const query = readQuery()
  const fieldNode = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (fieldNode && fieldNode.dataset.thirdPartyComprehensiveAssessmentField !== 'pageSize' && editorState) {
    if (event?.type !== 'input' && event?.type !== 'change') return false
    editorState.dirty = true
    const errors = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-assessment-form-errors]')
    if (errors) errors.innerHTML = ''
    return true
  }
  if (fieldNode?.dataset.thirdPartyComprehensiveAssessmentField === 'pageSize') {
    if (event?.type !== 'change') return false
    const pageSize = Number(fieldNode.value)
    if (!PAGE_SIZE_OPTIONS.includes(pageSize)) return true
    saveColumnPreferences(normalizeColumnPreferences({ ...getColumnPreferences(), pageSize }))
    event.preventDefault()
    navigateAssessmentList(buildHref(query, { page: 1, pageSize }))
    return true
  }

  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.getAttribute(`data-${EVENT_PREFIX}-action`)
  if (!actionNode || !action) return false
  if (action === 'open-editor') {
    const factoryId = actionNode.dataset.factoryId ?? ''
    if (!getThirdPartyFactoryComprehensiveAssessment(factoryId)) return true
    event?.preventDefault()
    dismissAssessmentToast()
    editorState = { factoryId, dirty: false }
    refreshAssessmentOverlaysLocally(query)
    return true
  }
  if (action === 'close-editor') {
    event?.preventDefault()
    if (editorState?.dirty && typeof window !== 'undefined' && !window.confirm('当前评定尚未保存，确认放弃修改吗？')) return true
    editorState = null
    refreshAssessmentOverlaysLocally(query)
    return true
  }
  if (action === 'save-editor') {
    event?.preventDefault()
    const form = actionNode.closest<HTMLFormElement>('[data-third-party-comprehensive-assessment-editor-form]')
    if (form) handleThirdPartyFactoryComprehensiveAssessmentSubmit(form)
    return true
  }
  if (action === 'sort-column') {
    const columnKey = actionNode.dataset.columnKey ?? ''
    if (!columns.some((column) => column.key === columnKey && column.sortable)) return true
    event?.preventDefault()
    navigateAssessmentList(buildHref(query, nextSortPatch(query, columnKey)))
    return true
  }
  if (action === 'open-column-settings' || action === 'close-column-settings') {
    event?.preventDefault()
    refreshColumnSettingsLocally({ ...query, columnSettings: action === 'open-column-settings' })
    return true
  }
  if (action === 'restore-column-settings') {
    event?.preventDefault()
    const storage = getListStorage()
    if (storage) clearListColumnPreferences(storage, COLUMN_STORAGE_KEY)
    const resetQuery = { ...query, page: 1, pageSize: defaultColumnPreferences.pageSize, columnSettings: true }
    replaceAssessmentUrl(resetQuery)
    refreshColumnSettingsLocally(resetQuery)
    return true
  }
  if (action === 'toggle-column-visibility') {
    if (event?.type !== 'change') return false
    const columnKey = getActionColumnKey(actionNode)
    const rule = columnRules.find((column) => column.key === columnKey)
    if (!rule || rule.required || rule.actionColumn) return true
    const preferences = getColumnPreferences()
    const visibleKeys = new Set(preferences.visibleKeys)
    const frozenKeys = new Set(preferences.frozenKeys)
    if (visibleKeys.has(columnKey)) {
      visibleKeys.delete(columnKey)
      frozenKeys.delete(columnKey)
    } else {
      visibleKeys.add(columnKey)
    }
    saveColumnPreferences(normalizeColumnPreferences({
      ...preferences,
      visibleKeys: [...visibleKeys],
      frozenKeys: [...frozenKeys],
    }))
    event.preventDefault()
    refreshColumnSettingsLocally({
      ...query,
      columnSettings: true,
      ...(visibleKeys.has(columnKey) || query.sortKey !== columnKey ? {} : { sortKey: '', sortDirection: '', page: 1 }),
    })
    return true
  }
  if (action === 'toggle-column-freeze') {
    if (event?.type !== 'change') return false
    const column = columns.find((item) => item.key === getActionColumnKey(actionNode))
    if (!column || !canFreezeColumn(getColumnPreferences(), column)) return true
    const preferences = getColumnPreferences()
    const frozenKeys = new Set(preferences.frozenKeys)
    if (frozenKeys.has(column.key)) frozenKeys.delete(column.key)
    else frozenKeys.add(column.key)
    saveColumnPreferences(normalizeColumnPreferences({ ...preferences, frozenKeys: [...frozenKeys] }))
    event.preventDefault()
    refreshColumnSettingsLocally({ ...query, columnSettings: true })
    return true
  }
  return false
}

export function renderThirdPartyFactoryComprehensiveAssessmentPage(): string {
  const query = readQuery()
  if (!editorState && query.editFactoryId && getThirdPartyFactoryComprehensiveAssessment(query.editFactoryId)) {
    editorState = { factoryId: query.editFactoryId, dirty: false }
  }
  const { filteredRows, paging } = getAssessmentTableState(query)
  const preferences = getColumnPreferences()
  return `<div data-third-party-comprehensive-assessment-page>${renderStandardListPage({
    title: '第三方车缝厂综合评定',
    primaryActionsHtml: `<div class="flex flex-wrap items-center gap-2 text-xs"><span class="text-muted-foreground">来源图例</span>${renderSource('系统获取', 'system')}${renderSource('人工填写', 'manual')}</div>`,
    filtersHtml: renderFilters(query),
    statsHtml: `<div data-assessment-stats-surface>${renderStats(filteredRows)}</div>`,
    listTitle: '综合评定列表',
    listActionsHtml: `<button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-${EVENT_PREFIX}-action="open-column-settings">列设置</button>`,
    tableHtml: `<div data-third-party-comprehensive-assessment-table data-assessment-table-surface>${renderAssessmentTable(query, preferences)}</div>`,
    paginationHtml: `<div data-assessment-pagination-surface>${renderPagination(query, paging)}</div>`,
    overlaysHtml: `<div data-third-party-comprehensive-assessment-overlays>${renderAssessmentOverlays(query, preferences)}</div>`,
  })}${renderToastContainer()}</div>`
}
