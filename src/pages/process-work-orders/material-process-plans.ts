// @page-pattern: list, detail, form
import { appStore } from '../../state/store.ts'
import { escapeHtml as h } from '../../utils.ts'
import { renderStandardListFilters, renderStandardListPage, renderStandardListStats } from '../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import { getMaterialProcessDefinition } from '../../data/pcs-material-archive-repository.ts'
import type { MaterialProcessType } from '../../data/pcs-material-archive-types.ts'
import { MATERIAL_PROCESS_NAMES } from '../../data/pcs-material-rules.ts'
import { readPcsMaterialHandoff } from '../../data/pcs-material-handoff.ts'
import { registerPcsUnsavedChanges } from '../../data/pcs-unsaved-changes.ts'
import { runPcsRecordCommand, resolvePcsFileReference, retryPcsRecordState } from '../../data/pcs-record-runtime.ts'
import { createFcsMaterialProcessPlan, updateFcsMaterialProcessPlan, readFcsMaterialProcessPlanSource, listFcsMaterialProcessPlans, getFcsMaterialProcessPlanById, listFcsMaterialPlanTargets, listFcsMaterialPlanFactoryOptions, fcsMaterialProfessionalOrdersPath, fcsMaterialProcessPlanDetailPath, FCS_MATERIAL_PROCESS_PLAN_PATH, type FcsMaterialProcessPlan, type FcsMaterialProcessPlanDraft, type FcsMaterialProcessPlanSource, type FcsMaterialPlanSkuSnapshot, type FcsMaterialProcessPlanStatus } from '../../data/fcs/material-process-plans.ts'

const PREFIX = 'fcs-material-plan'
const PROCESS_TYPES: MaterialProcessType[] = ['DYEING', 'PRINTING', 'EMBROIDERY', 'HEAT_TRANSFER']
const PREF_KEY = 'higood:list-page:/fcs/process/material-plans'
const preferenceStorage = {
  getItem(key: string): string | null { try { return typeof window === 'undefined' ? null : window.localStorage.getItem(key) } catch { return null } },
  setItem(key: string, value: string): void { try { if (typeof window !== 'undefined' && value.length < 4000) window.localStorage.setItem(key, value) } catch { /* Optional bounded UI preference. */ } },
}
const stat = { DRAFT: '草稿', PLANNED: '已计划' }
const state = {
  formKey: '', mode: 'list' as 'list' | 'new' | 'edit' | 'detail', planId: '', tab: 'plan', source: null as FcsMaterialProcessPlanSource | null,
  fields: {} as Record<string, string>, dirty: false, saving: false, operationId: '', expectedVersion: 0,
  notice: '', image: '', query: { keyword: '', processType: '', status: '' }, filter: { keyword: '', processType: '', status: '' },
  page: 1, sort: null as StandardListSortState | null, columnsOpen: false, prefsLoaded: false, queryKey: '',
  prefs: { order: [], visibleKeys: [], frozenKeys: ['identity'], pageSize: 20 } as StandardListColumnPreferences,
}
registerPcsUnsavedChanges('fcs-material-process-plan', { isDirty: () => state.dirty, discard: () => { state.dirty = false; state.formKey = ''; state.source = null; state.fields = {} } })
const types = (raw: string): MaterialProcessType | undefined => PROCESS_TYPES.includes(raw as MaterialProcessType) ? raw as MaterialProcessType : undefined
const search = () => (appStore.getState().pathname || '').split('?')[1] || (typeof window === 'undefined' ? '' : window.location.search.slice(1))
const btn = (label: string, action: string, attrs = '', primary = false) => `<button type="button" class="rounded-md border px-3 py-2 text-sm ${primary ? 'border-blue-600 bg-blue-600 text-white' : 'bg-white text-slate-700'}" data-${PREFIX}-action="${h(action)}" ${attrs} ${state.saving ? 'disabled' : ''}>${h(label)}</button>`
const nav = (label: string, path: string, primary = false) => `<button type="button" class="rounded-md border px-3 py-2 text-sm ${primary ? 'border-blue-600 bg-blue-600 text-white' : 'bg-white text-slate-700'}" data-nav="${h(path)}">${h(label)}</button>`
const notice = () => state.notice ? `<div role="status" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">${h(state.notice)}</div>` : ''
const card = (title: string, content: string) => `<section class="rounded-lg border bg-white"><h2 class="border-b px-5 py-3 font-semibold">${h(title)}</h2><div class="p-5">${content}</div></section>`
const dataRows = (items: Array<[string, unknown]>) => `<dl class="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">${items.map(([label, value]) => `<div class="min-w-0"><dt class="text-xs text-slate-500">${h(label)}</dt><dd class="mt-1 break-words text-sm">${h(value === null || value === undefined || value === '' ? '未维护' : String(value))}</dd></div>`).join('')}</dl>`
function image(reference: string, name: string, size = 'h-16 w-16'): string {
  if (!reference) return `<span class="inline-flex ${size} items-center justify-center rounded border text-xs text-slate-500">暂无图片</span>`
  try { const url = resolvePcsFileReference(reference); return `<button type="button" data-${PREFIX}-action="image" data-url="${h(url)}" aria-label="查看${h(name)}大图" class="${size} shrink-0 overflow-hidden rounded border bg-white"><img class="h-full w-full object-cover" src="${h(url)}" alt="${h(name)}" loading="lazy" /></button>` }
  catch { return `<span class="inline-flex ${size} items-center justify-center rounded border text-xs text-amber-700">图片无法读取</span>` }
}
function overlay(): string {
  return state.image ? `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8" data-${PREFIX}-action="close-image"><div class="relative max-h-[90vh] max-w-[90vw] bg-white p-3"><button aria-label="关闭大图" class="absolute right-3 top-3 rounded bg-white px-3 py-2 shadow" data-${PREFIX}-action="close-image">关闭</button><img class="max-h-[82vh] max-w-[85vw] object-contain" src="${h(state.image)}" alt="物料大图" /></div></div>` : ''
}
function skuCard(sku: FcsMaterialPlanSkuSnapshot, label: string): string {
  return `<div class="flex min-w-0 gap-4 rounded-lg border p-4">${image(sku.imageReference, sku.materialName, 'h-20 w-20')}<div class="min-w-0"><p class="mb-1 text-xs text-slate-500">${h(label)}</p><button class="break-all text-left text-sm font-medium text-blue-700 hover:underline" data-nav="${h(sku.archivePath)}">${h(sku.materialSkuCode)}</button><p class="mt-1 text-sm">${h(sku.materialName)}</p><p class="mt-1 text-xs text-slate-500">${h(sku.colorName || '未指定颜色')} · ${h(sku.mainUnit)}</p></div></div>`
}
function sourceCards(source: FcsMaterialProcessPlanSource): string {
  return `<div class="grid gap-4 lg:grid-cols-2">${skuCard(source.input, '直接投入物料')}${skuCard(source.output, '目标物料')}</div>`
}
function processDetails(source: FcsMaterialProcessPlanSource): string {
  const p = source.process
  return card('加工定义', `${dataRows([['工艺', MATERIAL_PROCESS_NAMES[p.processType]], ['加工对象', '物料'], ['加工资料版本', p.processVersionId], ['Pantone', [p.pantoneSystem, p.pantoneCode].filter(Boolean).join(' ')], ['花型编号', p.patternCode], ['花型版本', p.patternVersionId], ['背面花型', p.backPatternCode], ['印花面', p.printSide === 'A' ? '单面 A' : p.printSide === 'AB' ? '双面 AB' : '不适用'], ['渗透印', p.processType === 'PRINTING' ? p.penetration ? '是' : '否' : '不适用']])}${p.patternImageUrl ? `<div class="mt-5 flex items-center gap-3">${image(p.patternImageUrl, '花型', 'h-24 w-24')}<span class="text-sm text-slate-500">花型展示图</span></div>` : ''}`)
    + card('加工执行资料', source.executionAssets.length ? `<div class="divide-y">${source.executionAssets.map(asset => {
      let url = ''; try { url = resolvePcsFileReference(asset.fileReference) } catch { /* Inline missing-file feedback keeps the plan readable. */ }
      return `<div class="flex items-center justify-between gap-4 py-3 text-sm"><span>${h(asset.name)} · v${h(asset.version)}</span>${url ? `<a href="${h(url)}" target="_blank" rel="noopener" class="text-blue-700 hover:underline">查看资料</a>` : '<span class="text-amber-700">资料无法读取</span>'}</div>`
    }).join('')}</div>` : '<p class="text-sm text-slate-500">尚未关联执行稿，可先安排物料加工计划；实际开工前由加工业务确认执行资料。</p>')
}
function field(key: string, label: string, kind = 'text', options?: Array<{ value: string; label: string }>, area = 'form'): string {
  const value = area === 'filter' ? state.query[key as keyof typeof state.query] : state.fields[key] || ''
  const attributes = `data-${PREFIX}-field="${h(key)}" data-area="${area}" data-skip-page-rerender="true"`
  return `<label class="block min-w-0 space-y-1.5 text-sm"><span class="text-slate-600">${h(label)}</span>${options ? `<select class="h-10 w-full rounded border bg-white px-3" ${attributes}>${options.map(option => `<option value="${h(option.value)}" ${value === option.value ? 'selected' : ''}>${h(option.label)}</option>`).join('')}</select>` : `<input class="h-10 w-full rounded border px-3" type="${kind}" value="${h(value)}" ${kind === 'number' ? 'min="0" step="any"' : ''} ${attributes}/>`}</label>`
}
function tabs(): string { return `<nav class="flex gap-6 border-b" aria-label="加工计划视图">${[['plan', '计划信息'], ['process', '工艺资料'], ...(state.mode === 'detail' ? [['records', '操作记录']] : [])].map(([key, label]) => `<button type="button" class="border-b-2 px-1 py-3 text-sm ${state.tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}" data-${PREFIX}-action="tab" data-value="${key}">${label}</button>`).join('')}</nav>` }
function header(title: string, actions: string): string { return `<header class="flex flex-wrap items-start justify-between gap-4"><div><p class="mb-1 text-xs text-slate-500">工厂生产协同 / 物料加工计划</p><h1 class="text-xl font-semibold">${h(title)}</h1></div><div class="flex flex-wrap gap-2">${actions}</div></header>` }
function frame(content: string): string { return `<div class="space-y-4 p-4" data-fcs-material-plan-root data-skip-page-rerender="true">${content}${overlay()}</div>` }
const columns: StandardListColumn<FcsMaterialProcessPlan>[] = [
  { key: 'identity', title: '加工计划 / 目标物料', width: 315, required: true, freezeable: true, sortValue: row => row.planNo, render: row => `<div class="flex gap-3">${image(row.source.output.imageReference, row.source.output.materialName)}<div class="min-w-0"><button class="text-blue-700 hover:underline" data-nav="${h(fcsMaterialProcessPlanDetailPath(row.planId))}">${h(row.planNo)}</button><p class="mt-1 break-all text-xs">${h(row.source.output.materialSkuCode)}</p><p class="mt-1 text-xs text-slate-500">${h(row.source.output.materialName)}</p></div></div>` },
  { key: 'processType', title: '工艺', width: 85, sortValue: row => row.processType, render: row => h(MATERIAL_PROCESS_NAMES[row.processType]) },
  { key: 'input', title: '直接投入 SKU', width: 255, render: row => `<div class="flex gap-2">${image(row.source.input.imageReference, row.source.input.materialName, 'h-10 w-10')}<button class="break-all text-left text-xs text-blue-700 hover:underline" data-nav="${h(row.source.input.archivePath)}">${h(row.source.input.materialSkuCode)}</button></div>` },
  { key: 'factory', title: '加工工厂', width: 125, sortValue: row => row.factoryName, render: row => h(row.factoryName || '未指定') },
  { key: 'quantity', title: '计划投入 / 产出', width: 160, render: row => `<div class="space-y-1 text-xs"><p>投入 ${row.plannedInputQty ?? '未维护'} ${h(row.source.input.mainUnit)}</p><p>产出 ${row.plannedOutputQty ?? '未维护'} ${h(row.source.output.mainUnit)}</p></div>` },
  { key: 'date', title: '计划完成日期', width: 130, sortValue: row => row.plannedFinishDate, render: row => h(row.plannedFinishDate || '未维护') },
  { key: 'status', title: '状态', width: 90, sortValue: row => row.status, render: row => `<span class="rounded px-2 py-1 text-xs ${row.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700'}">${stat[row.status]}</span>` },
  { key: 'actions', title: '操作', width: 140, required: true, actionColumn: true, render: row => `<button class="mr-3 text-blue-700 hover:underline" data-nav="${h(fcsMaterialProcessPlanDetailPath(row.planId))}">查看</button>${row.status === 'DRAFT' ? `<button class="text-blue-700 hover:underline" data-nav="${h(fcsMaterialProcessPlanDetailPath(row.planId) + '/edit')}">编辑</button>` : ''}` },
]
function ensurePrefs(): void {
  if (state.prefsLoaded) return
  state.prefs = loadListColumnPreferences(preferenceStorage, PREF_KEY, columns, { order: columns.map(x => x.key), visibleKeys: columns.map(x => x.key), frozenKeys: ['identity'], pageSize: 20 }, [20, 50, 100]); state.prefsLoaded = true
}
export function renderFcsMaterialProcessPlansPage(): string {
  state.mode = 'list'; ensurePrefs()
  const q = search()
  if (state.queryKey !== q) { state.queryKey = q; state.query = { keyword: '', processType: types(new URLSearchParams(q).get('processType') || '') || '', status: '' }; state.filter = { ...state.query }; state.page = 1 }
  const rows = listFcsMaterialProcessPlans({ keyword: state.filter.keyword, processType: types(state.filter.processType), status: state.filter.status as FcsMaterialProcessPlanStatus || undefined })
  const sorted = state.sort ? sortStandardListRows(rows, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row)) : rows
  const slice = paginateStandardListRows(sorted, state.page, state.prefs.pageSize); state.page = slice.currentPage
  const filters = field('keyword', '计划编号 / SKU / 名称', 'text', undefined, 'filter') + field('processType', '加工工艺', 'text', [{ value: '', label: '全部' }, ...PROCESS_TYPES.map(value => ({ value, label: MATERIAL_PROCESS_NAMES[value] }))], 'filter') + field('status', '状态', 'text', [{ value: '', label: '全部' }, { value: 'DRAFT', label: '草稿' }, { value: 'PLANNED', label: '已计划' }], 'filter')
  return frame(renderStandardListPage({ title: '物料加工计划', primaryActionsHtml: nav('新建加工计划', `${FCS_MATERIAL_PROCESS_PLAN_PATH}/new${state.filter.processType ? '?processType=' + state.filter.processType : ''}`, true) + (types(state.filter.processType) ? nav('专业加工单', fcsMaterialProfessionalOrdersPath(types(state.filter.processType)!)) : ''),
    feedbackHtml: notice(), filtersHtml: renderStandardListFilters({ fieldsHtml: `<div class="grid w-full gap-3 md:grid-cols-3">${filters}</div>`, actionPrefix: PREFIX }),
    statsHtml: renderStandardListStats([{ label: '当前筛选', value: rows.length }, { label: '草稿', value: rows.filter(row => row.status === 'DRAFT').length }, { label: '已计划', value: rows.filter(row => row.status === 'PLANNED').length }], { compact: true }),
    listTitle: '计划列表', listActionsHtml: btn('列设置', 'columns'), tableHtml: renderStandardListTable({ columns, rows: slice.rows, preferences: state.prefs, sort: state.sort, eventPrefix: PREFIX, emptyText: '暂无物料加工计划，可从物料 SKU 发起或新建计划。' }),
    paginationHtml: renderTablePagination({ total: slice.total, from: slice.from, to: slice.to, currentPage: slice.currentPage, totalPages: slice.totalPages, pageSize: slice.pageSize, pageSizeOptions: [20, 50, 100], actionPrefix: PREFIX, fieldPrefix: PREFIX }),
    overlaysHtml: state.columnsOpen ? renderStandardListColumnSettings({ title: '加工计划列设置', maxFrozenWidth: 420, columns, preferences: state.prefs, eventPrefix: PREFIX }) : '', className: '!p-0',
  }))
}
function formFields(plan?: FcsMaterialProcessPlan): Record<string, string> {
  return plan ? { inputSkuId: plan.source.input.materialSkuId, outputSkuId: plan.source.output.materialSkuId, processDefinitionId: plan.source.process.processDefinitionId, processVersionId: plan.source.process.processVersionId,
    plannedInputQty: String(plan.plannedInputQty ?? ''), plannedOutputQty: String(plan.plannedOutputQty ?? ''), factoryId: plan.factoryId, plannedStartDate: plan.plannedStartDate, plannedFinishDate: plan.plannedFinishDate, responsibleName: plan.responsibleName, remark: plan.remark }
    : { inputSkuId: '', outputSkuId: '', processDefinitionId: '', processVersionId: '', plannedInputQty: '', plannedOutputQty: '', factoryId: '', plannedStartDate: '', plannedFinishDate: '', responsibleName: '', remark: '' }
}
function setTarget(outputSkuId: string): void {
  const process = getMaterialProcessDefinition(outputSkuId)
  if (!process) throw new Error('请选择有加工定义的目标物料 SKU。')
  const draft = { inputSkuId: process.inputSkuId, outputSkuId, processDefinitionId: process.processDefinitionId, processVersionId: process.processVersionId }
  const source = readFcsMaterialProcessPlanSource(draft)
  state.source = source; Object.assign(state.fields, draft); state.fields.factoryId = ''
}
function ensureForm(mode: 'new' | 'edit', planId = ''): void {
  const key = mode + ':' + planId + ':' + search()
  state.mode = mode; state.planId = planId
  if (state.formKey === key) return
  state.formKey = key; state.tab = 'plan'; state.source = null; state.notice = ''; state.dirty = false; state.operationId = crypto.randomUUID()
  if (mode === 'edit') {
    const plan = getFcsMaterialProcessPlanById(planId)
    if (!plan) throw new Error('加工计划不存在，请重新读取。')
    if (plan.status !== 'DRAFT') throw new Error('该计划已确认，请从详情查看。')
    state.fields = formFields(plan); state.source = plan.source; state.expectedVersion = plan.version
  } else {
    state.fields = formFields()
    const handoff = readPcsMaterialHandoff(search())
    if (handoff?.kind === 'PROCESS' && handoff.input && handoff.process) {
      const requestedVersion = new URLSearchParams(search()).get('processVersionId')
      if (requestedVersion && requestedVersion !== handoff.process.processVersionId) throw new Error('加工资料版本已变化，请返回目标料重新发起。')
      setTarget(handoff.target.materialSkuId)
    }
  }
}
function renderForm(): string {
  const source = state.source, type = source?.process.processType
  const selectTarget = !source && state.mode === 'new' ? card('选择加工目标', field('outputSkuId', '目标物料 SKU', 'text', [{ value: '', label: '请选择加工后的目标 SKU' }, ...listFcsMaterialPlanTargets(types(new URLSearchParams(search()).get('processType') || '')).map(sku => ({ value: sku.materialSkuId, label: `${sku.materialSkuCode} · ${sku.materialName}` }))])) : ''
  const planFields = source ? card('计划安排', `<div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">${field('plannedInputQty', `计划投入数量（${source.input.mainUnit}）*`, 'number')}${field('plannedOutputQty', `计划产出数量（${source.output.mainUnit}）*`, 'number')}${field('factoryId', '加工工厂 *', 'text', [{ value: '', label: '请选择' }, ...listFcsMaterialPlanFactoryOptions(type!).map(item => ({ value: item.id, label: `${item.name}（${item.code}）` }))])}${field('plannedStartDate', '计划开始日期 *', 'date')}${field('plannedFinishDate', '计划完成日期 *', 'date')}${field('responsibleName', '计划负责人 *')}</div><label class="mt-5 block text-sm text-slate-600">备注<textarea rows="3" class="mt-2 w-full rounded border p-3" data-${PREFIX}-field="remark" data-skip-page-rerender="true">${h(state.fields.remark)}</textarea></label><p class="mt-3 text-xs text-slate-500">数量按各自主单位填写。未确定的安排可以保存草稿。</p>`) : ''
  return frame(`${header(state.mode === 'new' ? `${type ? MATERIAL_PROCESS_NAMES[type] : '物料'}加工计划 / 新建` : '物料加工计划 / 编辑草稿', btn('取消', 'cancel') + btn(state.saving ? '正在保存…' : '保存草稿', 'save-draft') + btn('确认计划', 'confirm', '', true))}${notice()}<p class="text-sm text-slate-500">计划安排与现场收料、领料和开工分别管理。</p>${selectTarget}${source ? `${tabs()}${state.tab === 'process' ? processDetails(source) : `${sourceCards(source)}${state.mode === 'new' ? `<div>${btn('重新选择目标', 'change-target')}</div>` : ''}${planFields}`}` : ''}`)
}
export function renderFcsMaterialProcessPlanCreatePage(): string { try { ensureForm('new'); return renderForm() } catch (error) { state.formKey = ''; return renderError(error) } }
export function renderFcsMaterialProcessPlanEditPage(id: string): string { try { ensureForm('edit', id); return renderForm() } catch (error) { state.formKey = ''; return renderError(error) } }
function renderError(error: unknown): string { return frame(`${header('物料加工计划', nav('返回列表', FCS_MATERIAL_PROCESS_PLAN_PATH))}<div class="rounded border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">${h(error instanceof Error ? error.message : '资料无法读取，请重试。')}</div>${btn('重新读取', 'reload')}`) }
export function renderFcsMaterialProcessPlanDetailPage(id: string): string {
  try {
    if (state.mode !== 'detail' || state.planId !== id) { state.tab = 'plan'; state.notice = ''; state.mode = 'detail'; state.planId = id }
    const plan = getFcsMaterialProcessPlanById(id)
    if (!plan) return renderError(new Error('加工计划不存在，请返回列表重新读取。'))
    let content = ''
    if (state.tab === 'process') content = processDetails(plan.source)
    else if (state.tab === 'records') content = card('操作记录', `<div class="divide-y">${plan.records.slice().reverse().map(record => `<div class="grid gap-3 py-3 text-sm md:grid-cols-3"><span>${h(record.action)}</span><span>${h(record.operator)}</span><span class="text-slate-500">${h(record.at.replace('T', ' ').slice(0, 19))}</span></div>`).join('')}</div>`)
    else content = `${sourceCards(plan.source)}${card('计划安排', dataRows([['状态', stat[plan.status]], ['加工工厂', plan.factoryName], ['计划负责人', plan.responsibleName], ['计划投入数量', plan.plannedInputQty === null ? null : `${plan.plannedInputQty} ${plan.source.input.mainUnit}`], ['计划产出数量', plan.plannedOutputQty === null ? null : `${plan.plannedOutputQty} ${plan.source.output.mainUnit}`], ['计划日期', `${plan.plannedStartDate || '未维护'} ～ ${plan.plannedFinishDate || '未维护'}`], ['备注', plan.remark], ['加工资料版本', plan.source.process.processVersionId]]))}`
    return frame(`${header(plan.planNo, nav('返回列表', `${FCS_MATERIAL_PROCESS_PLAN_PATH}?processType=${plan.processType}`) + nav('目标物料', plan.source.output.archivePath) + (plan.status === 'DRAFT' ? nav('编辑草稿', `${fcsMaterialProcessPlanDetailPath(id)}/edit`, true) : ''))}${notice()}<p class="text-sm text-slate-500">${MATERIAL_PROCESS_NAMES[plan.processType]} · ${stat[plan.status]} · 现场尚未确认开工</p>${tabs()}${content}`)
  } catch (error) { return renderError(error) }
}
function refresh(): void {
  if (typeof document === 'undefined') return
  const root = document.querySelector('[data-fcs-material-plan-root]')
  if (!root) return
  root.outerHTML = state.mode === 'list' ? renderFcsMaterialProcessPlansPage() : state.mode === 'detail' ? renderFcsMaterialProcessPlanDetailPage(state.planId) : state.mode === 'edit' ? renderFcsMaterialProcessPlanEditPage(state.planId) : renderFcsMaterialProcessPlanCreatePage()
}
export function handleFcsMaterialProcessPlanInput(target: Element): boolean {
  const input = target.closest<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-${PREFIX}-field]`)
  if (!input) return false
  const key = input.getAttribute(`data-${PREFIX}-field`)!
  if (key === 'pageSize') { state.prefs.pageSize = Number(input.value); state.page = 1; saveListColumnPreferences(preferenceStorage, PREF_KEY, state.prefs); refresh(); return true }
  if (input.dataset.area === 'filter') { state.query[key as keyof typeof state.query] = input.value; return true }
  try {
    if (key === 'outputSkuId') { setTarget(input.value); state.dirty = true; state.notice = ''; refresh() }
    else { state.fields[key] = input.value; state.dirty = true }
  } catch (error) { state.notice = error instanceof Error ? error.message : '请选择有效目标物料。'; refresh() }
  return true
}
function draft(): FcsMaterialProcessPlanDraft {
  const quantity = (key: string) => state.fields[key]?.trim() ? Number(state.fields[key]) : null
  return { inputSkuId: state.fields.inputSkuId, outputSkuId: state.fields.outputSkuId, processDefinitionId: state.fields.processDefinitionId, processVersionId: state.fields.processVersionId,
    plannedInputQty: quantity('plannedInputQty'), plannedOutputQty: quantity('plannedOutputQty'), factoryId: state.fields.factoryId || '',
    plannedStartDate: state.fields.plannedStartDate || '', plannedFinishDate: state.fields.plannedFinishDate || '', responsibleName: state.fields.responsibleName || '', remark: state.fields.remark || '' }
}
export async function handleFcsMaterialProcessPlanEvent(target: Element, event?: Event): Promise<boolean> {
  if (event?.type === 'drop') {
    const cell = target.closest<HTMLElement>('[data-fcs-material-plan-root] [data-standard-list-column-drag]')
    const source = (event as DragEvent & { higoodStandardListColumnKey?: string }).higoodStandardListColumnKey, destination = cell?.dataset.dropTarget
    if (!source || !destination || source === destination || source === 'actions' || destination === 'actions') return false
    const order = state.prefs.order.filter(key => key !== source), index = order.indexOf(destination)
    if (index < 0) return false
    event.preventDefault(); order.splice(index, 0, source); state.prefs = normalizeListColumnPreferences(columns, { ...state.prefs, order }, [20, 50, 100]); saveListColumnPreferences(preferenceStorage, PREF_KEY, state.prefs); refresh(); return true
  }
  if (event?.type.startsWith('drag')) return false
  const element = target.closest<HTMLElement>(`[data-${PREFIX}-action]`)
  if (!element) return false
  const action = element.getAttribute(`data-${PREFIX}-action`)!
  if (state.saving) return true
  try {
    if (action === 'save-draft' || action === 'confirm') {
      const input = draft(), status = action === 'confirm' ? 'PLANNED' : 'DRAFT'
      state.saving = true; state.notice = ''; refresh()
      const plan = await runPcsRecordCommand(() => state.mode === 'edit' ? updateFcsMaterialProcessPlan(state.planId, input, status, state.expectedVersion) : createFcsMaterialProcessPlan(input, status, state.operationId), `material-process-plan:${state.operationId}`)
      state.dirty = false; state.saving = false; state.formKey = ''; appStore.navigate(fcsMaterialProcessPlanDetailPath(plan.planId)); return true
    }
    if (action === 'tab') state.tab = element.dataset.value || 'plan'
    else if (action === 'change-target') { state.source = null; for (const key of ['inputSkuId', 'outputSkuId', 'processDefinitionId', 'processVersionId', 'plannedInputQty', 'plannedOutputQty', 'factoryId']) state.fields[key] = ''; state.dirty = true }
    else if (action === 'image') state.image = element.dataset.url || ''
    else if (action === 'close-image') state.image = ''
    else if (action === 'cancel') { appStore.navigate(state.mode === 'edit' ? fcsMaterialProcessPlanDetailPath(state.planId) : state.source?.output.archivePath || FCS_MATERIAL_PROCESS_PLAN_PATH); return true }
    else if (action === 'reload') { await retryPcsRecordState(); state.formKey = ''; refresh(); return true }
    else if (action === 'query') { state.filter = { ...state.query }; state.page = 1 }
    else if (action === 'reset') { state.query = { keyword: '', processType: '', status: '' }; state.filter = { ...state.query }; state.page = 1 }
    else if (action === 'prev-page') state.page--
    else if (action === 'next-page') state.page++
    else if (action === 'columns') state.columnsOpen = true
    else if (action === 'close-column-settings') state.columnsOpen = false
    else if (action === 'restore-column-settings') state.prefs = normalizeListColumnPreferences(columns, { order: columns.map(x => x.key), visibleKeys: columns.map(x => x.key), frozenKeys: ['identity'], pageSize: 20 }, [20, 50, 100])
    else if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') { const key = element.getAttribute(`data-${PREFIX}-column-key`) || '', property = action === 'toggle-column-visibility' ? 'visibleKeys' : 'frozenKeys'; state.prefs[property] = (element as HTMLInputElement).checked ? [...state.prefs[property], key] : state.prefs[property].filter(x => x !== key); saveListColumnPreferences(preferenceStorage, PREF_KEY, state.prefs) }
    else if (action === 'sort-column') { const key = element.dataset.columnKey || ''; state.sort = state.sort?.key !== key ? { key, direction: 'asc' } : state.sort.direction === 'asc' ? { key, direction: 'desc' } : null }
    else return false
  } catch (error) { state.notice = `本次未保存：${error instanceof Error ? error.message : '请重试。'}` }
  finally { state.saving = false }
  refresh(); return true
}
