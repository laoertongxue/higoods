// @page-pattern: list
import { appStore } from '../state/store.ts'
import { escapeHtml as e } from '../utils.ts'
import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../components/ui/list-table.ts'
import { loadListColumnPreferences, normalizeListColumnPreferences, saveListColumnPreferences, paginateStandardListRows, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../components/ui/list-table-model.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import { FLAT_DIMENSION_META, type FlatDimensionId, type ConfigLog, type ConfigOption } from '../data/pcs-config-dimensions.ts'
import { getConfigDimensionOption, getConfigOptionUsage, listConfigDimensionOptions, listProductCategoryNodes, getProductCategoryNode, saveConfigDimensionOption, saveProductCategoryNode, deleteProductCategoryNode, canDeleteProductCategoryNode, type ProductCategoryNode } from '../data/pcs-config-workspace-repository.ts'
import { getLatestPcsExchangeRate, updateLatestPcsExchangeRate } from '../data/pcs-exchange-rate-config.ts'
import { listMaterialTemplates, listMaterialAttributeUnitDefinitions, getMaterialBoundFieldDefaults, getMaterialBoundFields, getMaterialTemplateUsage, saveMaterialTemplateVersion, approveMaterialTemplate, listMaterialUnitDefinitions, saveMaterialUnit, getMaterialUnitUsage, listFixedMaterialConversions, listMaterialProcessConfigurations, saveMaterialProcessConfiguration, listMaterialEquipmentModels, saveMaterialEquipmentModel, type MaterialEquipmentModel, type MaterialTemplate, type MaterialTemplateField, type MaterialUnitDefinition, type MaterialProcessConfiguration } from '../data/pcs-material-config.ts'
import { buildProcessedMaterialCode, MATERIAL_CODE_RULE_VERSION } from '../data/pcs-material-rules.ts'
import type { MaterialArchiveKind, MaterialProcessDraft } from '../data/pcs-material-archive-types.ts'
import { CURRENT_CHANNELS, CURRENT_MARKETS, listChannelStores, channelLabel } from '../data/pcs-channel-store-repository.ts'
import { CHANNEL_CONTENT_SYNC_FIELDS, CHANNEL_VARIANT_SYNC_FIELDS, channelFieldSupported } from '../data/pcs-channel-sync.ts'
import { runPcsRecordCommand, retryPcsRecordState } from '../data/pcs-record-runtime.ts'

type Section = FlatDimensionId | 'productCategories' | 'templates' | 'units' | 'fixedConversions' | 'processes' | 'encoding' | 'exchangeRate' | 'channels'
type View = 'list' | 'detail' | 'edit'
const KIND_NAMES: Record<MaterialArchiveKind, string> = { fabric: '面料', accessory: '辅料', yarn: '纱线', consumable: '耗材', parts: '配件' }
const TYPE_NAMES: Record<MaterialTemplateField['type'], string> = { text: '文本', number: '数值', select: '单选', multiSelect: '多选', composition: '成分与比例', reference: '资料引用' }
const REQUIRED_NAMES = { always: '总是必填', optional: '可选', dyed: '染色时必填', patterned: '有花型时必填', 'button-hole': '孔式纽扣必填' }
const SHAPE_NAMES = { namedDimensions: '多项尺寸（名称、数值、单位）', equipmentCompatibility: '适配设备（类型、型号）' }
const DIMENSION_NAMES: Record<MaterialUnitDefinition['dimension'], string> = { length: '长度', area: '面积', mass: '重量', count: '计数', package: '包装', volume: '体积' }
const GROUPS: Array<{ name: string; items: Section[] }> = [
  { name: '商品属性', items: ['productCategories', 'brands', 'categories', 'styles', 'categoryNumbers', 'productPositioning', 'sizes', 'trendElements', 'specialCrafts', 'fabrics', 'crowds', 'ages', 'crowdPositioning'] },
  { name: '物料属性', items: ['templates', 'colors', 'pantone', 'compositions', 'constructions', 'materialConstructions', 'materialStructures', 'zipperTeeth', 'zipperOpenings', 'zipperGauges', 'yarnCountSystems', 'yarnUses', 'equipmentTypes'] },
  { name: '单位与包装', items: ['units', 'fixedConversions', 'packageTypes'] },
  { name: '加工与编码', items: ['processes', 'encoding'] },
  { name: '渠道与价格展示', items: ['channels', 'exchangeRate'] },
]
const EXTRA_NAMES: Partial<Record<Section, string>> = { productCategories: '商品主分类', templates: '分类与属性模板', units: '计量单位', fixedConversions: '固定单位换算', processes: '加工工艺', encoding: '编码规则', exchangeRate: '标准成本展示汇率', channels: '渠道与市场' }
const state = { section: 'productCategories' as Section, view: 'list' as View, tab: 'base', search: '', status: 'all', page: 1, selectedId: '', selectedVersion: 0,
  notice: '', error: false, busy: false, dirty: false, parentId: null as string | null, kind: 'fabric' as MaterialArchiveKind,
  draft: {} as Record<string, string>, template: null as MaterialTemplate | null, fieldIndex: -1,
  modelView: 'list' as View, model: null as MaterialEquipmentModel | null,
  preview: { inputSkuId: '', processType: 'EMBROIDERY', objectType: 'MATERIAL', patternCode: 'pl001197', colorCode: 'black', pantoneSystem: 'TCX', pantoneCode: '19-4003', printSide: 'A', penetration: false, backPatternCode: '' } as MaterialProcessDraft,
  predecessor: 'CNIDML160-black-19-4003PT', codePreview: '' }
const inputClass = 'h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50'
type ListValue = string | number | (() => string | number)
type ListRow = { cells: ListValue[]; values: ListValue[]; enabled?: boolean }
const listValue = (value: ListValue | undefined): string | number => typeof value === 'function' ? value() : value ?? ''
type ListState = { preferences: StandardListColumnPreferences; sort: StandardListSortState | null; columns: StandardListColumn<ListRow>[]; rows: ListRow[]; showSettings: boolean }
let categoryLanguageRows: Array<{ language: string; name: string; aliases: string }> = []
const PAGE_SIZES = [20, 50, 100]
const lists = new Map<string, ListState>()
let currentListKey = '', draggedColumnKey = '', dragEventsInstalled = false
// Small, disposable UI preferences only: one bounded key per built-in list, at most 4 KiB each.
const preferenceKey = (key: string) => `higood-pcs-config-list-prefs-v1:${key}`
const attrs = (values: Record<string, string | number>) => Object.entries(values).map(([k, v]) => `data-${k}="${e(String(v))}"`).join(' ')
function button(label: string, action: string, values: Record<string, string | number> = {}, primary = false, disabled = false): string { return `<button type="button" class="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md ${primary ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'} px-3 text-sm disabled:opacity-40" data-pcs-config-workspace-action="${action}" ${attrs(values)} ${disabled || state.busy ? 'disabled' : ''}>${e(label)}</button>` }
function field(label: string, key: string, value: unknown, options: { type?: string; readonly?: boolean; help?: string; required?: boolean } = {}): string { return `<label class="block min-w-0 text-sm"><span class="mb-1.5 block font-medium text-slate-700">${e(label)}${options.required ? '<span class="ml-1 text-red-500">*</span>' : ''}</span><input class="${inputClass}" type="${options.type || 'text'}" value="${e(String(value ?? ''))}" data-pcs-config-workspace-field="${e(key)}" ${options.readonly ? 'readonly' : ''} ${state.busy ? 'disabled' : ''}>${options.help ? `<span class="mt-1 block text-xs leading-5 text-slate-500">${e(options.help)}</span>` : ''}</label>` }
function select(label: string, key: string, value: unknown, values: Array<[string, string]>, disabled = false): string { return `<label class="block min-w-0 text-sm"><span class="mb-1.5 block font-medium text-slate-700">${e(label)}</span><select class="${inputClass}" data-pcs-config-workspace-field="${e(key)}" ${disabled || state.busy ? 'disabled' : ''}>${values.map(([id, name]) => `<option value="${e(id)}" ${id === value ? 'selected' : ''}>${e(name)}</option>`).join('')}</select></label>` }
function checkbox(label: string, key: string, value: boolean): string { return `<label class="flex items-center gap-2 text-sm"><input type="checkbox" data-preserve-native-click="true" data-pcs-config-workspace-field="${e(key)}" ${value ? 'checked' : ''} ${state.busy ? 'disabled' : ''}>${e(label)}</label>` }
function badge(enabled: boolean, yes = '启用', no = '停用'): string { return `<span class="inline-flex rounded px-2 py-1 text-xs ${enabled ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}">${e(enabled ? yes : no)}</span>` }
function table(headers: string[], rows: string[][]): string { return `<div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr>${headers.map(h => `<th class="whitespace-nowrap border-b px-3 py-3 font-medium">${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr class="border-b last:border-0 hover:bg-slate-50/50">${row.map(cell => `<td class="px-3 py-3 align-top">${cell}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" class="p-10 text-center text-slate-400">暂无匹配记录</td></tr>`}</tbody></table></div>` }
function tabs(values: Array<[string, string]>): string { return `<nav class="flex flex-wrap gap-1 border-b bg-white px-2" aria-label="配置视图">${values.map(([id, label]) => `<button type="button" class="border-b-2 px-3 py-3 text-sm ${state.tab === id ? 'border-blue-600 font-semibold text-blue-600' : 'border-transparent text-slate-500'}" data-pcs-config-workspace-action="tab" data-tab="${id}" aria-selected="${state.tab === id}">${e(label)}</button>`).join('')}</nav>` }
function name(section = state.section): string { return EXTRA_NAMES[section] || FLAT_DIMENSION_META.find(item => item.id === section)?.name || '' }
function isFlat(section = state.section): section is FlatDimensionId { return FLAT_DIMENSION_META.some(item => item.id === section) }
function readOnly(label: string, value: unknown): string { return `<div><dt class="mb-1 text-xs text-slate-500">${e(label)}</dt><dd class="break-words text-sm text-slate-900">${e(String(value ?? '—') || '—')}</dd></div>` }
function logs(items: ConfigLog[]): string { return table(['时间', '操作', '操作人', '内容'], [...items].reverse().map(item => [e(item.time), e(item.action), e(item.operator), `${e(item.detail)}${item.changes?.length ? `<details class="mt-2"><summary>查看原值与新值</summary>${item.changes.map(change => `<div class="mt-2 break-words">${e(change.field)}：${e(typeof change.before === 'object' ? JSON.stringify(change.before) : change.before || '空')} → ${e(typeof change.after === 'object' ? JSON.stringify(change.after) : change.after || '空')}</div>`).join('')}<div class="mt-2">原因：${e(item.reason || '资料维护')}</div></details>` : ''}`])) }
function usage(items: Array<{ id: string; label: string; kind?: string; href?: string }>): string { return `<p class="mb-4 text-sm text-slate-500">当前引用 ${items.length} 条。停用后保留已有引用，新建时不可选。</p>${table(['对象', '当前引用'], items.map(item => [e(item.kind || '物料档案'), item.href ? `<a class="text-blue-600 hover:underline" href="${e(item.href)}" data-nav="${e(item.href)}">${e(item.label)}</a>` : e(item.label)]))}` }
function filterMatches(values: unknown[], enabled?: boolean): boolean { return values.join(' ').toLowerCase().includes(state.search.trim().toLowerCase()) && (enabled === undefined || state.status === 'all' || (state.status === 'enabled') === enabled) }
function plainCell(html: string): string { return html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim() }
function listRow(cells: ListValue[], enabled?: boolean, values?: ListValue[]): ListRow { return { cells, enabled, values: values || cells.map(cell => typeof cell === 'function' ? () => plainCell(String(cell())) : plainCell(String(cell))) } }
function persistListPreferences(): void {
  const list = lists.get(currentListKey)
  if (!list || typeof window === 'undefined') return
  try { if (JSON.stringify(list.preferences).length <= 4096) saveListColumnPreferences(window.localStorage, preferenceKey(currentListKey), list.preferences) } catch { /* UI preferences may be unavailable; business data is unaffected. */ }
}
function managedList(key: string, headers: string[], rows: ListRow[], options: { title?: string; createAction?: string; beforeFilters?: string; hasActions?: boolean; status?: boolean } = {}): string {
  currentListKey = key
  const hasActions = options.hasActions !== false
  const columns: StandardListColumn<ListRow>[] = headers.map((title, index) => ({ key: hasActions && index === headers.length - 1 ? 'actions' : `column-${index}`, title, width: index === 0 ? 210 : index === headers.length - 1 && hasActions ? 180 : 140, required: index === 0, freezeable: index === 0 || index === 1, actionColumn: hasActions && index === headers.length - 1, sortable: !(hasActions && index === headers.length - 1), render: row => String(listValue(row.cells[index])), sortValue: row => listValue(row.values[index]) }))
  let list = lists.get(key)
  if (!list) {
    const defaults = { order: columns.map(c => c.key), visibleKeys: columns.map(c => c.key), frozenKeys: [], pageSize: 20 }
    let preferences = normalizeListColumnPreferences(columns, defaults, PAGE_SIZES)
    try { if (typeof window !== 'undefined') preferences = loadListColumnPreferences({ getItem: name => { const raw = window.localStorage.getItem(name); return raw && raw.length <= 4096 ? raw : null } }, preferenceKey(key), columns, defaults, PAGE_SIZES) } catch { /* Default UI preferences remain available. */ }
    list = { preferences, sort: null, columns, rows, showSettings: false }; lists.set(key, list)
  }
  list.columns = columns; list.rows = rows
  const ordered = sortStandardListRows(rows, list.sort, (row, columnKey) => columns.find(c => c.key === columnKey)?.sortValue?.(row))
  const paging = paginateStandardListRows(ordered, state.page, list.preferences.pageSize); state.page = paging.currentPage
  const filtersHtml = `<div class="space-y-3 rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="flex flex-wrap items-end gap-3"><div class="min-w-[180px] flex-1">${field('搜索', 'search', state.search, { help: '名称、业务编码或别名' })}</div>${options.status === false ? '' : `<div class="w-32">${select('状态', 'filter-status', state.status, [['all', '全部'], ['enabled', '启用'], ['disabled', '停用']])}</div>`}</div><div class="flex gap-2 border-t pt-3">${button('查询', 'query', {}, true)}${button('重置', 'reset-query')}${button('导出', 'export-list')}</div></div>`
  const stats = [{ label: '匹配记录', value: rows.length }]
  if (rows.some(row => row.enabled !== undefined)) stats.push({ label: '启用', value: rows.filter(row => row.enabled).length }, { label: '停用', value: rows.filter(row => row.enabled === false).length })
  installColumnDragEvents()
  return renderStandardListPage({ title: options.title || name(), primaryActionsHtml: options.createAction ? button('新增', options.createAction, {}, true) : '', statusTabsHtml: options.beforeFilters, filtersHtml, statsHtml: renderStandardListStats(stats, { compact: true }), listTitle: `${options.title || name()} · ${rows.length} 条`, listActionsHtml: button('列设置', 'open-column-settings'), tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: list.preferences, sort: list.sort, eventPrefix: 'pcs-config-workspace', emptyText: '暂无匹配记录', skipPageRerender: true }), paginationHtml: renderTablePagination({ ...paging, actionPrefix: 'pcs-config-workspace', fieldPrefix: 'pcs-config-workspace', pageSizeOptions: PAGE_SIZES, skipPageRerender: true }), overlaysHtml: list.showSettings ? renderStandardListColumnSettings({ title: `${options.title || name()}列设置`, columns, preferences: list.preferences, eventPrefix: 'pcs-config-workspace', maxFrozenWidth: 420, skipPageRerender: true }) : '' })
}
function installColumnDragEvents(): void {
  if (dragEventsInstalled || typeof document === 'undefined') return
  dragEventsInstalled = true
  const rootSelector = '#pcs-config-workspace-root'
  document.addEventListener('dragstart', event => { const node = event.target instanceof Element ? event.target.closest<HTMLElement>(`${rootSelector} [data-standard-list-column-drag]`) : null; if (node) { event.stopPropagation(); draggedColumnKey = node.dataset.dragSource || ''; event.dataTransfer?.setData('text/plain', draggedColumnKey) } }, true)
  document.addEventListener('dragover', event => { if (event.target instanceof Element && event.target.closest(`${rootSelector} [data-drop-target]`)) { event.preventDefault(); event.stopPropagation() } }, true)
  document.addEventListener('drop', event => {
    const node = event.target instanceof Element ? event.target.closest<HTMLElement>(`${rootSelector} [data-drop-target]`) : null
    const list = lists.get(currentListKey), from = draggedColumnKey || event.dataTransfer?.getData('text/plain'), to = node?.dataset.dropTarget; draggedColumnKey = ''
    if (!node || !list || !from || !to || from === to || from === 'actions') return
    const order = list.preferences.order.filter(key => key !== from), index = order.indexOf(to)
    if (index < 0) return
    order.splice(index, 0, from); list.preferences = normalizeListColumnPreferences(list.columns, { ...list.preferences, order }, PAGE_SIZES)
    event.preventDefault(); event.stopPropagation(); persistListPreferences(); rerender()
  }, true)
}
function exportList(): void {
  const list = lists.get(currentListKey)
  if (!list?.rows.length) throw new Error('当前查询没有可导出的配置。')
  const indices = list.columns.map((c, index) => ({ c, index })).filter(({ c }) => !c.actionColumn)
  const csvCell = (value: unknown) => { const text = String(value ?? ''); return '"' + (/^[=+@-]/.test(text) ? "'" : '') + text.replace(/"/g, '""') + '"' }
  const csv = [indices.map(({ c }) => c.title), ...list.rows.map(row => indices.map(({ index }) => listValue(row.values[index])))].map(row => row.map(csvCell).join(',')).join('\r\n')
  if (typeof document === 'undefined') return
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })), link = document.createElement('a')
  link.href = url; link.download = `${name()}-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0)
  state.notice = `已导出当前查询的 ${list.rows.length} 条配置。`
}
function listFlat(): string {
  const dimension = state.section as FlatDimensionId
  const rows = listConfigDimensionOptions(dimension).filter(item => filterMatches([item.code, item.name_zh, item.name_en, ...(item.aliases || [])], item.status === 'ENABLED'))
  return managedList(dimension, ['业务编码', '名称', '排序', '状态', '引用', '操作'], rows.map(item => {
    let usageCount: number | undefined
    const count = () => usageCount ??= getConfigOptionUsage(dimension, item.id).length
    return listRow([e(item.code), `<div class="font-medium">${e(item.name_zh)}</div><div class="mt-1 text-xs text-slate-500">${e(item.name_en || '')}</div>`, e(String(item.sortOrder)), badge(item.status === 'ENABLED'), () => String(count()), button('详情', 'detail', { id: item.id })], item.status === 'ENABLED', [item.code, `${item.name_zh} ${item.name_en || ''}`, item.sortOrder, item.status === 'ENABLED' ? '启用' : '停用', count])
  }), { createAction: 'create' })
}
function categoryList(): string {
  const all = listProductCategoryNodes(), ordered: Array<{ node: ProductCategoryNode; depth: number }> = []
  const walk = (parent: string | null, depth: number) => all.filter(item => item.parentId === parent).forEach(node => { ordered.push({ node, depth }); walk(node.id, depth + 1) }); walk(null, 0)
  const rows = ordered.filter(({ node }) => filterMatches([node.code, node.name], node.status === 'ENABLED'))
  return managedList('productCategories', ['分类', '编码', '状态', '款式引用', '操作'], rows.map(({ node, depth }) => listRow([`<span style="padding-left:${depth * 18}px" class="block font-medium">${depth ? '└ ' : ''}${e(node.name)}</span>`, e(node.code), badge(node.status === 'ENABLED'), String(node.productCount), `<div class="flex gap-2">${button('详情', 'detail', { id: node.id })}${node.level < 3 ? button('下级', 'create-category', { parent: node.id }) : ''}</div>`], node.status === 'ENABLED', [node.name, node.code, node.status === 'ENABLED' ? '启用' : '停用', node.productCount])), { createAction: 'create-category' })
}
function templateList(): string {
  const byId = new Map<string, MaterialTemplate>()
  for (const template of listMaterialTemplates()) if ((byId.get(template.templateId)?.version || 0) < template.version) byId.set(template.templateId, template)
  const rows = [...byId.values()].filter(item => item.kind === state.kind && filterMatches([item.category, item.name, item.categoryCode, ...Object.values(item.categoryNames || {}), ...Object.values(item.categoryAliases || {}).flat()], item.enabled !== false))
  const kinds = `<div class="flex flex-wrap gap-2">${Object.entries(KIND_NAMES).map(([id, label]) => button(label, 'kind', { kind: id }, state.kind === id)).join('')}</div>`
  return managedList('templates', ['分类模板', '当前版本', '根属性 / SKU 属性', '版本状态', '当前引用', '操作'], rows.map(item => listRow([`<div class="font-medium">${e(item.category)}</div><div class="mt-1 text-xs text-slate-500">${e(item.name)} · ${e(item.categoryCode || '')}</div>`, `v${item.version}`, `${item.fields.filter(f => f.level === 'root').length} / ${item.fields.filter(f => f.level === 'sku').length}`, `${badge(item.status === 'APPROVED', '已审核', '草稿')} ${item.enabled === false ? badge(false) : ''}`, () => String(getMaterialTemplateUsage(item.templateId, item.version).length), button('详情', 'detail', { id: item.templateId, version: item.version })], item.enabled !== false)), { createAction: 'create', beforeFilters: kinds })
}
function unitList(): string {
  const rows = listMaterialUnitDefinitions().filter(item => filterMatches([item.code, item.label, ...(item.aliases || [])], item.enabled))
  return managedList('units', ['单位编码', '名称', '量纲', '数量小数位', '状态', 'SKU 引用', '操作'], rows.map(item => listRow([e(item.code), e(item.label), e(DIMENSION_NAMES[item.dimension]), String(item.precision), badge(item.enabled), () => String(getMaterialUnitUsage(item.code).length), button('详情', 'detail', { id: item.id })], item.enabled)), { createAction: 'create' })
}
function processList(): string {
  return managedList('processes', ['工艺', '加工对象', '新增物料 SKU', '编码段', '状态', '操作'], listMaterialProcessConfigurations().filter(item => filterMatches([item.name, item.id], item.enabled)).map(item => listRow([e(item.name), e([item.material ? '物料' : '', item.cutPiece ? '裁片' : ''].filter(Boolean).join('、')), item.material ? '是' : '否', e(item.segment || '不生成物料编码'), badge(item.enabled), button('详情', 'detail', { id: item.id })], item.enabled)))
}
function selectedTemplate(): MaterialTemplate | undefined { return listMaterialTemplates().find(item => item.templateId === state.selectedId && item.version === state.selectedVersion) }
function selectedLogs(): ConfigLog[] {
  if (isFlat(state.section)) return getConfigDimensionOption(state.section, state.selectedId)?.logs || []
  if (state.section === 'productCategories') return getProductCategoryNode(state.selectedId)?.logs || []
  if (state.section === 'templates') return selectedTemplate()?.logs || []
  if (state.section === 'units') return listMaterialUnitDefinitions().find(item => item.id === state.selectedId)?.logs || []
  if (state.section === 'processes') return listMaterialProcessConfigurations().find(item => item.id === state.selectedId)?.logs || []
  return getLatestPcsExchangeRate().logs || []
}
function detailBody(): string {
  if (state.tab === 'logs') return logs(selectedLogs())
  if (state.section === 'templates') return templateBody()
  if (state.section === 'equipmentTypes' && state.tab === 'models') return equipmentModelsBody()
  if (state.tab === 'usage') {
    if (isFlat(state.section)) return usage(getConfigOptionUsage(state.section, state.selectedId))
    if (state.section === 'units') return usage(getMaterialUnitUsage(state.draft.code))
  }
  const edit = state.view === 'edit'
  if (isFlat(state.section)) {
    if (!edit) return `<dl class="grid grid-cols-2 gap-x-8 gap-y-5">${readOnly('稳定标识', state.selectedId)}${readOnly('业务编码', state.draft.code)}${readOnly('中文名称', state.draft.nameZh)}${readOnly('英文名称', state.draft.nameEn)}${readOnly('印尼语名称', state.draft.nameId)}${readOnly('马来语名称', state.draft.nameMs)}${readOnly('旧值 / 别名', state.draft.aliases)}${readOnly('排序', state.draft.sortOrder)}${readOnly('状态', state.draft.status === 'ENABLED' ? '启用' : '停用')}</dl>`
    return `<div class="grid grid-cols-2 gap-5">${field('业务编码', 'code', state.draft.code, { required: true, readonly: Boolean(state.selectedId), help: state.section === 'pantone' ? '例如 TCX 19-4003。体系与色号共同识别颜色标准。' : state.section === 'categoryNumbers' ? '正式品类编号，例如 89；独立于名称和数组顺序。' : '首次建立后保持稳定。' })}${field('中文名称', 'nameZh', state.draft.nameZh, { required: true })}${field('英文名称', 'nameEn', state.draft.nameEn)}${field('印尼语名称', 'nameId', state.draft.nameId)}${field('马来语名称', 'nameMs', state.draft.nameMs)}${field('修改原因', 'changeReason', state.draft.changeReason, { help: '选填；未填时记录为资料维护。' })}${field('旧值 / 别名', 'aliases', state.draft.aliases, { help: '多个值用中文逗号分隔；保留历史检索语义。' })}${field('排序', 'sortOrder', state.draft.sortOrder, { type: 'number' })}${select('状态', 'status', state.draft.status, [['ENABLED', '启用'], ['DISABLED', '停用']])}</div>`
  }
  if (state.section === 'productCategories') {
    return edit ? `<div class="grid grid-cols-2 gap-5">${field('上级分类', 'parentName', state.parentId ? getProductCategoryNode(state.parentId)?.name : '根分类', { readonly: true })}${field('分类名称', 'nameZh', state.draft.nameZh, { required: true })}${field('排序', 'sortOrder', state.draft.sortOrder, { type: 'number' })}${select('状态', 'status', state.draft.status, [['ENABLED', '启用'], ['DISABLED', '停用']])}</div>` : `<dl class="grid grid-cols-2 gap-5">${readOnly('分类名称', state.draft.nameZh)}${readOnly('分类编码', getProductCategoryNode(state.selectedId)?.code)}${readOnly('款式引用', getProductCategoryNode(state.selectedId)?.productCount)}${readOnly('选择规则', '商品主分类选择末级；渠道平台分类分别维护。')}</dl>`
  }
  if (state.section === 'units') return edit ? `<div class="grid grid-cols-2 gap-5">${field('单位编码', 'code', state.draft.code, { readonly: Boolean(state.selectedId), required: true })}${field('名称', 'label', state.draft.label, { required: true })}${select('量纲', 'dimension', state.draft.dimension, Object.entries(DIMENSION_NAMES), Boolean(state.selectedId))}${field('数量小数位', 'precision', state.draft.precision, { type: 'number' })}${field('别名', 'aliases', state.draft.aliases)}${select('状态', 'enabled', state.draft.enabled, [['true', '启用'], ['false', '停用']])}</div>` : `<dl class="grid grid-cols-2 gap-5">${readOnly('单位编码', state.draft.code)}${readOnly('名称', state.draft.label)}${readOnly('量纲', DIMENSION_NAMES[state.draft.dimension as MaterialUnitDefinition['dimension']])}${readOnly('数量小数位', state.draft.precision)}${readOnly('别名', state.draft.aliases)}${readOnly('用途', '物料 SKU 的主单位、辅助单位、用途与换算关系在“计量单位”Tab 中维护。')}</dl>`
  if (state.section === 'processes') {
    const process = listMaterialProcessConfigurations().find(item => item.id === state.selectedId)!
    return `<div class="grid grid-cols-2 gap-5">${edit ? field('工艺名称', 'nameZh', state.draft.nameZh, { required: true }) : readOnly('工艺名称', process.name)}${edit ? select('状态', 'enabled', state.draft.enabled, [['true', '启用'], ['false', '停用']]) : readOnly('状态', process.enabled ? '启用' : '停用')}${readOnly('作用对象', [process.material ? '物料' : '', process.cutPiece ? '裁片' : ''].filter(Boolean).join('、'))}${readOnly('物料编码段', process.segment || '不新增物料 SKU')}${readOnly('物料身份', process.material ? '加工后形成新的物料 SKU，保留投入对象。' : '裁片加工保留在技术 / 生产对象。')}</div>`
  }
  return ''
}
function equipmentModelsBody(): string {
  const equipmentType = getConfigDimensionOption('equipmentTypes', state.selectedId)
  if (!equipmentType) throw new Error('设备类型不存在，请返回列表重新选择。')
  if (state.modelView === 'list') {
    const rows = listMaterialEquipmentModels(equipmentType.id).filter(item => filterMatches([item.code, item.name], item.enabled))
    return managedList('equipmentModels', ['型号编码', '型号名称', '状态', '最近维护', '操作'], rows.map(item => listRow([e(item.code), e(item.name), badge(item.enabled), e([item.updatedAt, item.updatedBy].filter(Boolean).join(' · ') || '—'), button('详情', 'model-detail', { id: item.id })], item.enabled)), { title: `${equipmentType.name_zh} · 设备型号`, createAction: equipmentType.status === 'ENABLED' ? 'model-create' : undefined })
  }
  const model = state.model!
  const edit = state.modelView === 'edit'
  return `<div class="space-y-5" data-equipment-model-view="${state.modelView}"><header class="flex flex-wrap items-start justify-between gap-3"><div><h3 class="font-semibold">${edit ? model.id ? '编辑设备型号' : '新增设备型号' : model.name}</h3><p class="mt-1 text-xs text-slate-500">${e(equipmentType.name_zh)} / ${e(model.code || '填写型号')}</p></div><div class="flex gap-2">${button(edit ? '取消' : '返回型号列表', 'model-back')}${edit ? button('保存型号', 'model-save', {}, true) : button('编辑型号', 'model-edit', {}, true, equipmentType.status !== 'ENABLED')}</div></header>${edit ? `<div class="grid grid-cols-2 gap-5">${field('设备类型', 'model-typeLabel', equipmentType.name_zh, { readonly: true })}${field('型号编码', 'model-code', model.code, { readonly: Boolean(model.id), required: true, help: '同一设备类型内唯一，保存后不可修改。' })}${field('型号名称', 'model-name', model.name, { required: true })}${select('状态', 'model-enabled', String(model.enabled), [['true', '启用'], ['false', '停用']])}</div>` : `<dl class="grid grid-cols-2 gap-5">${readOnly('稳定标识', model.id)}${readOnly('设备类型', equipmentType.name_zh)}${readOnly('型号编码', model.code)}${readOnly('型号名称', model.name)}${readOnly('状态', model.enabled ? '启用' : '停用')}${readOnly('最近维护', [model.updatedAt, model.updatedBy].filter(Boolean).join(' · '))}</dl>`}<p class="text-xs text-slate-500">配件在适配设备属性中关联设备类型与型号。停用后保留既有引用，新建时不可选。</p><span data-pcs-config-save-status class="text-xs text-amber-700">${state.dirty ? '有未保存修改' : ''}</span></div>`
}
function conversionBody(template: MaterialTemplate): string {
  const edit = state.view === 'edit', rows = template.previousVersionConversions || []
  return `<p class="mb-4 text-sm text-slate-500">明确从前一版本到本版本的属性单位换算依据。已有物料仍保留锁定版本与原值；读取和普通保存不会执行换算。</p>${edit ? `<div class="mb-4">${button('新增换算依据', 'add-conversion', {}, true)}</div>` : ''}${table(['属性', '原单位', '新单位', '换算系数', ...(edit ? ['操作'] : [])], rows.map((item, index) => edit ? [select('属性', `conversion-${index}-key`, item.key, [['', '请选择数值属性'], ...template.fields.filter(f => f.type === 'number').map(f => [f.key, f.label] as [string, string])]), field('原单位', `conversion-${index}-fromUnit`, item.fromUnit, { required: true }), field('新单位', `conversion-${index}-toUnit`, item.toUnit, { required: true }), field('新值 = 原值 × 系数', `conversion-${index}-factor`, item.factor, { type: 'number', required: true }), button('移除', 'remove-conversion', { index })] : [e(template.fields.find(f => f.key === item.key)?.label || item.key), e(item.fromUnit), e(item.toUnit), `${e(item.factor)}（新值 = 原值 × ${e(item.factor)}）`]))}`
}
function templateLanguages(template: MaterialTemplate): string {
  const edit = state.view === 'edit'
  const values = edit ? categoryLanguageRows : Object.entries(template.categoryNames || { zh: template.category }).map(([language, name]) => ({ language, name, aliases: (template.categoryAliases?.[language] || []).join('，') }))
  return `<p class="mb-4 text-sm text-slate-500">同一稳定分类身份可维护多语名称与别名；新版本生效后，已有档案仍保留采用时名称。</p>${edit ? `<div class="mb-4">${button('增加语言', 'add-category-language', {}, true)}</div>` : ''}${table(['语言代码', '分类名称', '别名', ...(edit ? ['操作'] : [])], values.map((row, index) => edit ? [field('语言代码', `language-${index}-language`, row.language, { readonly: row.language === 'zh', help: '例如 en、id、ms' }), field('分类名称', `language-${index}-name`, row.name, { readonly: row.language === 'zh' }), field('语言别名', `language-${index}-aliases`, row.aliases), row.language === 'zh' ? '默认中文' : button('移除语言', 'remove-category-language', { index })] : [e(row.language), e(row.name), e(row.aliases || '—')]))}`
}
function templateFieldsBody(template: MaterialTemplate): string {
  const edit = state.view === 'edit', level = state.tab === 'package-fields' ? 'package' : state.tab === 'process-fields' ? 'process' : null
  const levelNames = { root: '主档', sku: 'SKU', package: '包装', process: '工艺' }
  if (state.fieldIndex >= 0 && edit) {
    const item = template.fields[state.fieldIndex], bound = Boolean(item.modelBinding)
    const contract = bound ? getMaterialBoundFieldDefaults(item.level as 'package'|'process').find(row => row.modelBinding === item.modelBinding) : undefined
    const unitChoices = listMaterialAttributeUnitDefinitions().filter(row => row.enabled || row.id === item.unitId)
    return `<div class="mb-5 flex items-center justify-between"><h3 class="font-medium">编辑属性：${e(item.label || '新属性')}</h3>${button('返回属性列表', 'close-field')}</div><div class="grid grid-cols-2 gap-5">${field('属性键', 'field-key', item.key, { required: true, readonly: bound, help: '采用稳定键，避免更名破坏既有属性值。' })}${field('属性名称', 'field-label', item.label, { required: true })}${select('归属层级', 'field-level', item.level, Object.entries(levelNames).filter(([key]) => bound || key === 'root' || key === 'sku'), bound)}${select('字段类型', 'field-type', item.type, Object.entries(TYPE_NAMES), bound)}${select('属性单位', 'field-unitId', item.unitId || '', [['', item.unit ? `待匹配旧单位：${item.unit}` : '不适用'], ...unitChoices.map(row => [row.id, `${row.code} · ${row.label}`] as [string,string])], bound)}${item.unitId ? readOnly('单位稳定引用', item.unitId) : ''}${select('必填条件', 'field-requiredWhen', item.requiredWhen || (item.required ? 'always' : 'optional'), Object.entries(REQUIRED_NAMES).filter(([key]) => !bound || contract?.required || ['always','optional'].includes(key)), Boolean(contract?.required))}${!bound ? select('取值字典', 'field-dictionaryId', item.dictionaryId || '', [['', item.enumDefinition ? '保留旧版枚举' : '请选择独立字典'], ...FLAT_DIMENSION_META.map(row => [row.id, row.name] as [string, string])]) : readOnly('字段绑定', item.modelBinding)}${item.enumDefinition && !item.dictionaryId ? `${readOnly('旧版枚举引用', `${item.enumDefinition.id} · v${item.enumDefinition.version}`)}${field('版本枚举选项', 'field-options', (item.options || item.enumDefinition.options.map(row => row.value)).join('，'), { help: '本版本内维护；新版本保留已有选项ID，旧版本不被覆盖。' })}` : ''}${!bound ? select('结构化值格式', 'field-valueShape', item.valueShape || '', [['', '不使用结构化格式'], ...Object.entries(SHAPE_NAMES)], item.type !== 'reference') : ''}${item.type === 'number' && !bound ? `${checkbox('仅允许整数', 'field-integer', Boolean(item.integer))}${field('最小值', 'field-minimum', item.minimum, { type: 'number', help: '留空表示未设置；0 是有效约束。' })}` : ''}${field('帮助说明', 'field-help', item.help)}${!bound ? checkbox('参与物料身份判定', 'field-identity', item.identity) : readOnly('业务约束', '核心身份、单位及必要关系由所属业务模型校验。')}</div>`
  }
  const fields = level ? getMaterialBoundFields(template, level) : template.fields.filter(item => item.level === 'root' || item.level === 'sku')
  return `${level ? '<p class="mb-4 text-sm text-slate-500">采用现有专用业务字段。可按模板版本维护名称、说明及更严格必填；不会新增一套物料身份或改写历史记录。</p>' : ''}${edit && !level ? `<div class="mb-4">${button('添加属性', 'add-field', {}, true)}</div>` : ''}${table(['属性', '归属', '类型 / 单位', '必填条件', '引用与约束', '身份', edit ? '操作' : '说明'], fields.map(item => { const index=template.fields.findIndex(row => row.key === item.key); return [`<div class="font-medium">${e(item.label)}</div><div class="text-xs text-slate-500">${e(item.key)}</div>`, levelNames[item.level], `${e(TYPE_NAMES[item.type])}${item.unit ? ` / ${e(item.unit)}` : ''}`, e(REQUIRED_NAMES[item.requiredWhen || (item.required ? 'always' : 'optional')]), e([item.dictionaryId || (item.enumDefinition ? `${item.enumDefinition.id} v${item.enumDefinition.version}` : ''), item.unitId || '', item.valueShape ? SHAPE_NAMES[item.valueShape] : '', item.integer ? '整数' : '', item.minimum !== undefined ? `最小值 ${item.minimum}` : '', item.modelBinding || ''].filter(Boolean).join('；') || '—'), item.identity ? '参与' : '不参与', edit ? `<div class="flex gap-1">${button('编辑', 'edit-field', { index })}${!level ? `${button('上移', 'move-field', { index, direction: -1 }, false, index === 0)}${button('移除', 'remove-field', { index })}` : ''}</div>` : e(item.help || '—')] }))}`
}
function templateBody(): string {
  const template = state.view === 'edit' ? state.template! : selectedTemplate()!
  if (state.tab === 'conversions') return conversionBody(template)
  if (state.tab === 'languages') return templateLanguages(template)
  if (state.tab === 'usage') return usage(getMaterialTemplateUsage(template.templateId, template.version))
  if (state.tab === 'versions') {
    const versions = listMaterialTemplates().filter(item => item.templateId === template.templateId).sort((a, b) => b.version - a.version)
    return `<p class="mb-4 text-sm text-slate-500">审核后的版本供新建使用。已有物料保留其引用版本，升级需要明确操作。</p>${table(['版本', '状态', '变更说明', '引用', '更新', '操作'], versions.map(item => [`v${item.version}`, badge(item.status === 'APPROVED', '已审核', '草稿'), e(item.changeNote), String(getMaterialTemplateUsage(item.templateId, item.version).length), `${e(item.updatedAt)}<br>${e(item.updatedBy)}`, button('查看', 'detail', { id: item.templateId, version: item.version })]))}`
  }
  if (['fields', 'package-fields', 'process-fields'].includes(state.tab)) return templateFieldsBody(template)
  if (state.view === 'edit') return `<div class="grid grid-cols-2 gap-5">${select('物料大类', 'template-kind', template.kind, Object.entries(KIND_NAMES), Boolean(state.selectedId))}${field('分类名称', 'template-category', template.category, { readonly: Boolean(state.selectedId), required: true })}${field('分类业务编码', 'template-categoryCode', template.categoryCode, { readonly: Boolean(state.selectedId), help: '首次保存后保持稳定；新分类留空则自动生成。' })}${readOnly('分类稳定标识', template.categoryId || '首次保存后生成')}${field('模板名称', 'template-name', template.name, { required: true })}${field('变更说明', 'template-changeNote', template.changeNote, { required: true })}${select('发布后状态', 'template-enabled', String(template.enabled !== false), [['true', '启用'], ['false', '停用']])}${readOnly('版本规则', template.status === 'APPROVED' ? `从 v${template.version} 创建待审核新版本` : `维护 v${template.version || 1} 草稿`)}</div>`
  return `<dl class="grid grid-cols-2 gap-x-8 gap-y-5">${readOnly('物料大类', KIND_NAMES[template.kind])}${readOnly('分类', template.category)}${readOnly('分类业务编码', template.categoryCode)}${readOnly('分类稳定标识', template.categoryId)}${readOnly('模板名称', template.name)}${readOnly('版本', `v${template.version} · ${template.status === 'APPROVED' ? '已审核' : '草稿'}`)}${readOnly('状态', template.enabled === false ? '停用' : '启用')}${readOnly('最近更新', `${template.updatedAt} · ${template.updatedBy}`)}${readOnly('变更说明', template.changeNote)}${readOnly('维护规则', '受控字段类型、明确层级与单位；物料档案引用固定版本。')}</dl>`
}
function detail(): string {
  const isTemplate = state.section === 'templates'
  const values: Array<[string, string]> = [['base', '基本信息']]
  if (isTemplate) values.push(['fields', '主档与 SKU 属性'], ['package-fields', '包装属性'], ['process-fields', '工艺属性'], ['languages', '分类多语名称'], ['conversions', '版本换算依据'])
  if (state.section === 'equipmentTypes' && state.view !== 'edit') values.push(['models', '设备型号'])
  if (state.view !== 'edit') {
    if (isTemplate || isFlat(state.section) || state.section === 'units') values.push(['usage', '使用情况'])
    if (isTemplate) values.push(['versions', '版本记录'])
    values.push(['logs', '操作日志'])
  }
  const template = isTemplate ? selectedTemplate() : null
  return `<header class="flex flex-wrap items-start justify-between gap-3 border-b p-5"><div><div class="text-xs text-slate-500">${e(name())} / ${state.view === 'edit' ? state.selectedId ? '编辑' : '新增' : '详情'}</div><h2 class="mt-1 text-lg font-semibold">${e(isTemplate ? state.template?.category || template?.category || '新分类模板' : state.draft.nameZh || state.draft.label || name())}</h2><p data-pcs-config-save-status class="mt-1 text-xs ${state.dirty ? 'text-amber-700' : 'text-slate-500'}">${state.busy ? '正在保存…' : state.dirty ? '有未保存修改' : state.view === 'edit' ? '填写完成后保存' : '当前资料'}</p></div><div class="flex flex-wrap gap-2">${button(state.view === 'edit' ? '取消' : '返回列表', 'back')}${state.view === 'edit' ? button(isTemplate ? '保存草稿' : '保存', 'save', {}, true) : `${state.tab === 'models' ? '' : button(isTemplate ? template?.status === 'DRAFT' ? '编辑草稿' : '新建版本' : '编辑', 'edit', {}, true)}${isTemplate && template?.status === 'DRAFT' ? button('审核通过', 'approve-template') : ''}${state.section === 'productCategories' && canDeleteProductCategoryNode(state.selectedId) ? button('删除', 'delete-category') : ''}`}</div></header>${tabs(values)}<div class="p-5">${detailBody()}</div>`
}
function exchangeRate(): string {
  const current = getLatestPcsExchangeRate()
  return `${tabs([['base', '当前汇率'], ['logs', '操作日志']])}${state.tab === 'logs' ? `<div class="p-5">${logs(current.logs || [])}</div>` : `<div class="space-y-5 p-5"><p class="text-sm text-slate-500">仅用于综合标准成本的币种展示。标准成本基数、历史快照和渠道售价不因展示汇率改变。</p><div class="grid max-w-3xl grid-cols-2 gap-5">${field('1 RMB = IDR', 'fx-idr', state.draft.idr ?? (Number.isFinite(current.idrPerCny) ? current.idrPerCny : ''), { type: 'number', required: true })}${field('1 RMB = USD', 'fx-usd', state.draft.usd ?? (Number.isFinite(current.usdPerCny) ? current.usdPerCny : ''), { type: 'number', required: true })}${field('汇率来源', 'fx-source', state.draft.source ?? current.source)}${readOnly('最近维护', `${current.updatedAt} · ${current.updatedBy}`)}</div>${!Number.isFinite(current.idrPerCny) || !Number.isFinite(current.usdPerCny) ? '<p role="status" class="text-sm text-amber-700">部分币种未配置有效汇率，请补充后保存。人民币标准成本仍可正常查看。</p>' : ''}<div class="flex items-center gap-3">${button('保存展示汇率', 'save-exchange-rate', {}, true)}<span data-pcs-config-save-status class="text-xs text-amber-700">${state.dirty ? '有未保存修改' : ''}</span></div></div>`}`
}
function encoding(): string {
  const draft = state.preview
  return `${tabs([['base', '规则说明'], ['preview', '编码预览']])}<div class="space-y-5 p-5">${state.tab === 'base' ? `<dl class="grid grid-cols-2 gap-5">${readOnly('规则版本', MATERIAL_CODE_RULE_VERSION)}${readOnly('层级关系', '在投入物料 SKU 编码后追加本次加工段；顺序由加工关系保存。')}</dl>${table(['工艺', '编码构成', '说明'], [['染色', '颜色-PantonePT', 'TCX 使用确认规则；其他色卡体系显式带入。'], ['印花', '花型-A/AB-[ST]YH', 'A 单面，AB 双面；渗透印加入 ST；正反不同花分别标明。'], ['绣花', '花型XH', '加工前对象以投入 SKU 关联识别。'], ['烫画', '花型TH', '物料烫画形成新 SKU。'], ['交付修订', '花型R02…', '可入编码的交付差异；资料纠错不新增 SKU。']].map(row => row.map(e)))}<p class="text-xs leading-6 text-slate-500">旧编码保留为查询、扫码别名。加工关系不通过解析旧编码推断。花型编号和执行资料版本分别关联。</p>${button('进入花型库', 'go-pattern-library')}` : `<div class="grid grid-cols-2 gap-5">${field('投入物料 SKU 编码', 'preview-predecessor', state.predecessor, { required: true })}${select('本次工艺', 'preview-processType', draft.processType, [['DYEING', '染色'], ['PRINTING', '印花'], ['EMBROIDERY', '绣花'], ['HEAT_TRANSFER', '烫画']])}${draft.processType === 'DYEING' ? `${field('颜色编码', 'preview-colorCode', draft.colorCode, { required: true })}${select('Pantone 体系', 'preview-pantoneSystem', draft.pantoneSystem, [['TCX', 'TCX'], ['TPX', 'TPX']])}${field('Pantone 色号', 'preview-pantoneCode', draft.pantoneCode, { required: true })}` : `${field('花型编号', 'preview-patternCode', draft.patternCode, { required: true })}${field('交付修订段', 'preview-deliveryRevisionSegment', draft.deliveryRevisionSegment, { help: '选填，例如 R02。' })}${draft.processType === 'PRINTING' ? `${select('印花面数', 'preview-printSide', draft.printSide, [['A', '单面 A'], ['AB', '双面 AB']])}${draft.printSide === 'AB' ? field('反面花型编号', 'preview-backPatternCode', draft.backPatternCode, { required: true }) : ''}${checkbox('渗透印（ST）', 'preview-penetration', Boolean(draft.penetration))}` : ''}`}</div>${button('生成预览', 'preview-code', {}, true)}${state.codePreview ? `<div class="break-all rounded-lg border border-blue-200 bg-blue-50 p-4 font-mono text-sm text-blue-700">${e(state.codePreview)}</div>` : ''}<p class="text-xs text-slate-500">此处仅预览编码，不新增物料档案。</p>`}</div>`
}
function renderList(): string {
  if (isFlat(state.section)) return listFlat()
  if (state.section === 'productCategories') return categoryList()
  if (state.section === 'templates') return templateList()
  if (state.section === 'units') return unitList()
  if (state.section === 'processes') return processList()
  if (state.section === 'exchangeRate') return exchangeRate()
  if (state.section === 'encoding') return encoding()
  if (state.section === 'fixedConversions') return `<div class="p-5"><p class="mb-5 text-sm text-slate-500">固定物理换算不按物料重复维护。跨量纲换算、每包含量和包装版本在物料 SKU 的计量单位 Tab 中维护。</p>${table(['辅助单位', '方向', '主单位', '换算'], listFixedMaterialConversions().map(item => [e(item.fromUnit), '→', e(item.toUnit), `1 ${e(item.fromUnit)} = ${item.factor} ${e(item.toUnit)}`]))}</div>`
  const labels: Record<string, string> = { title: '标题', description: '详情描述', handle: '页面别名', platformCategoryId: '平台分类', platformBrandId: '平台品牌', platformAttributes: '平台属性', media: '商品媒体', sellerSku: '卖家 SKU', displayColor: '展示颜色', displaySize: '展示尺码', displayPattern: '展示花型', imageUrl: '规格图片', platformAttributeValues: '平台规格属性', 'price.regular': '日常售价', 'price.retail': '建议零售价', 'price.live': '直播价', 'price.wholesale': '批发价', 'price.clearance': '清仓价' }
  const channelRows = [...new Set(listChannelStores(true).map(item => item.channelCode))]
  for (const item of CURRENT_CHANNELS) if (!channelRows.includes(item.code)) channelRows.push(item.code)
  return `${tabs([['base', '渠道与市场'], ['capabilities', '平台字段能力']])}<div class="space-y-5 p-5">${state.tab === 'capabilities' ? `<p class="text-sm text-slate-500">原型字段能力 R1。用于演示支持范围，正式平台 schema 与 API 尚未接入。</p>${table(['字段', ...CURRENT_CHANNELS.map(item => item.name)], [...CHANNEL_CONTENT_SYNC_FIELDS, ...CHANNEL_VARIANT_SYNC_FIELDS].map(key => [e(labels[key] || key), ...CURRENT_CHANNELS.map(channel => channelFieldSupported(channel.code, key) ? '支持' : '仅 PCS 保留')]))}` : `<p class="text-sm text-slate-500">一店通常面向一个区域市场；停用渠道和市场保留历史查询。</p>${table(['渠道', '经营范围', '当前店铺数'], channelRows.map(code => [e(channelLabel(code)), CURRENT_CHANNELS.some(item => item.code === code) ? '当前经营' : '仅保留历史', String(listChannelStores(true).filter(item => item.channelCode === code).length)]))}${table(['市场', '语言', '销售币种', '时区'], CURRENT_MARKETS.map(item => [e(`${item.code} · ${item.name}`), e(item.language === 'id' ? '印尼语' : '马来语'), e(item.currency), e(item.zone)]))}${button('进入渠道店铺管理', 'go-stores')}`}</div>`
}
function renderSidebar(): string {
  return `<aside class="w-[190px] shrink-0 overflow-y-auto border-r bg-white" style="max-height:calc(100vh - 142px)" aria-label="配置分组"><div class="border-b px-4 py-4 text-sm font-semibold">基础配置</div>${GROUPS.map(group => `<section class="px-2 py-2"><h2 class="px-2 py-2 text-xs font-semibold text-slate-400">${e(group.name)}</h2>${group.items.map(id => `<button type="button" class="flex w-full rounded-md px-3 py-2 text-left text-sm ${state.section === id ? 'bg-blue-50 font-semibold text-blue-600' : 'text-slate-600 hover:bg-slate-50'}" data-pcs-config-workspace-action="switch-dimension" data-dimension-id="${id}">${e(name(id))}</button>`).join('')}</section>`).join('')}</aside>`
}
function renderNotice(): string { return state.notice ? `<div role="status" class="mb-3 rounded-lg border ${state.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'} px-4 py-3 text-sm">${e(state.notice)}</div>` : '' }
function renderMain(): string {
  if (state.view !== 'list') return detail()
  const standard = isFlat() || ['productCategories', 'templates', 'units', 'processes'].includes(state.section)
  return `${standard ? '' : `<header class="border-b px-5 py-4"><h1 class="text-lg font-semibold">${e(name())}</h1><p class="mt-1 text-xs text-slate-500">维护当前配置，已有档案保留引用。</p></header>`}${renderList()}`
}
export function renderPcsConfigWorkspacePage(): string {
  try {
    return `<div id="pcs-config-workspace-root" data-skip-page-rerender="true" class="p-4"><div data-config-notice>${renderNotice()}</div><div class="flex min-h-[calc(100vh-154px)] overflow-hidden rounded-lg border border-slate-200 bg-white">${renderSidebar()}<main class="min-w-0 flex-1" data-config-main>${renderMain()}</main></div></div>`
  } catch (error) {
    return `<div id="pcs-config-workspace-root" data-skip-page-rerender="true" class="p-5"><section class="rounded-lg border border-amber-200 bg-amber-50 p-5"><h1 class="font-semibold">基础配置暂时无法读取</h1><p class="my-3 text-sm">${e(error instanceof Error ? error.message : '请重新读取。')}</p>${button('重新读取', 'retry')}</section></div>`
  }
}
function rerender(): void {
  if (typeof document === 'undefined') return
  const root = document.getElementById('pcs-config-workspace-root'), main = root?.querySelector<HTMLElement>('[data-config-main]')
  if (!root) return
  if (!main) { root.outerHTML = renderPcsConfigWorkspacePage(); return }
  const scrollLeft = main.querySelector<HTMLElement>('[data-standard-list-scroll]')?.scrollLeft || 0
  try { main.innerHTML = renderMain() } catch (error) { state.error = true; state.notice = error instanceof Error ? error.message : '当前配置无法读取，请重试。'; main.innerHTML = button('重新读取', 'retry') }
  const nextScroll = main.querySelector<HTMLElement>('[data-standard-list-scroll]'); if (nextScroll) nextScroll.scrollLeft = scrollLeft
  const notice = root.querySelector<HTMLElement>('[data-config-notice]'); if (notice) notice.innerHTML = renderNotice()
  for (const item of root.querySelectorAll<HTMLElement>('[data-dimension-id]')) item.className = `flex w-full rounded-md px-3 py-2 text-left text-sm ${item.dataset.dimensionId === state.section ? 'bg-blue-50 font-semibold text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`
}
function split(value: string): string[] { return [...new Set(value.split(/[,，\n]/).map(item => item.trim()).filter(Boolean))] }
function openDetail(id: string, version = 0): void {
  state.selectedId = id; state.selectedVersion = version; state.view = 'detail'; state.tab = 'base'; state.dirty = false; state.template = null; state.fieldIndex = -1; state.modelView = 'list'; state.model = null
  if (isFlat(state.section)) {
    const item = getConfigDimensionOption(state.section, id)!
    state.draft = { code: item.code, nameZh: item.name_zh, nameEn: item.name_en || '', nameId: item.name_id || '', nameMs: item.name_ms || '', changeReason: '', aliases: (item.aliases || []).join('，'), sortOrder: String(item.sortOrder), status: item.status }
  } else if (state.section === 'productCategories') {
    const item = getProductCategoryNode(id)!
    state.parentId = item.parentId; state.draft = { nameZh: item.name, sortOrder: String(item.sortOrder), status: item.status }
  } else if (state.section === 'templates') {
    const item = selectedTemplate()!
    if (!item) throw new Error('模板版本不存在，请重新读取。')
    state.template = structuredClone(item)
    categoryLanguageRows = Object.entries(item.categoryNames || { zh:item.category }).map(([language,name])=>({language,name,aliases:(item.categoryAliases?.[language]||[]).join('，')}))
  } else if (state.section === 'units') {
    const item = listMaterialUnitDefinitions().find(row => row.id === id)!
    state.draft = { code: item.code, label: item.label, dimension: item.dimension, precision: String(item.precision), enabled: String(item.enabled), aliases: (item.aliases || []).join('，') }
  } else if (state.section === 'processes') {
    const item = listMaterialProcessConfigurations().find(row => row.id === id)!
    state.draft = { nameZh: item.name, enabled: String(item.enabled) }
  }
}
function create(parentId: string | null = null): void {
  state.selectedId = ''; state.selectedVersion = 0; state.view = 'edit'; state.tab = 'base'; state.dirty = false; state.parentId = parentId; state.fieldIndex = -1
  state.draft = { code: '', nameZh: '', nameEn: '', nameId: '', nameMs: '', changeReason: '', aliases: '', sortOrder: '1', status: 'ENABLED', dimension: 'length', precision: '4', enabled: 'true', label: '' }
  if (state.section === 'templates') state.template = { templateId: `material-template-${crypto.randomUUID()}`, version: 0, kind: state.kind, category: '', name: '', status: 'DRAFT', fields: [...getMaterialBoundFieldDefaults('package'), ...getMaterialBoundFieldDefaults('process')], updatedAt: '', updatedBy: '', changeNote: '', enabled: true }
  categoryLanguageRows = [{ language:'zh', name:'', aliases:'' }]
}
async function save(): Promise<void> {
  const draft = { ...state.draft }, id = state.selectedId
  if (isFlat(state.section)) {
    const dimension = state.section
    const item = await runPcsRecordCommand(() => saveConfigDimensionOption(dimension, id || null, { code: draft.code, nameZh: draft.nameZh, nameEn: draft.nameEn, nameId: draft.nameId, nameMs: draft.nameMs, changeReason: draft.changeReason, aliases: split(draft.aliases), sortOrder: Number(draft.sortOrder), status: draft.status as ConfigOption['status'] }))
    openDetail(item.id)
  } else if (state.section === 'productCategories') {
    const item = await runPcsRecordCommand(() => saveProductCategoryNode(id || null, state.parentId, { name: draft.nameZh, sortOrder: Number(draft.sortOrder), status: draft.status as ConfigOption['status'] }))
    openDetail(item.id)
  } else if (state.section === 'templates') {
    const template = structuredClone(state.template!)
    if (new Set(categoryLanguageRows.map(row=>row.language)).size!==categoryLanguageRows.length) throw new Error('分类语言代码不能重复。')
    template.categoryNames = Object.fromEntries(categoryLanguageRows.map(row=>[row.language,row.language==='zh'?template.category:row.name.trim()]))
    template.categoryAliases = Object.fromEntries(categoryLanguageRows.map(row=>[row.language,split(row.aliases)]))
    if (!template.name.trim() || !template.changeNote.trim()) throw new Error('请填写模板名称和变更说明。')
    for (const item of template.previousVersionConversions || []) {
      const target = template.fields.find(f => f.key === item.key && f.type === 'number')
      if (!target || !item.fromUnit.trim() || !item.toUnit.trim() || item.toUnit.trim() !== target.unit || !Number.isFinite(item.factor) || item.factor <= 0) throw new Error('版本换算需要数值属性、明确原单位、与属性一致的新单位和大于 0 的系数。')
    }
    const item = await runPcsRecordCommand(() => saveMaterialTemplateVersion(template, '当前用户'))
    openDetail(item.templateId, item.version)
  } else if (state.section === 'units') {
    const unit = { id: id || `unit-${crypto.randomUUID()}`, code: draft.code.trim(), label: draft.label.trim(), dimension: draft.dimension as MaterialUnitDefinition['dimension'], precision: Number(draft.precision), enabled: draft.enabled === 'true', aliases: split(draft.aliases) }
    await runPcsRecordCommand(() => saveMaterialUnit(unit)); openDetail(unit.id)
  } else if (state.section === 'processes') {
    const current = listMaterialProcessConfigurations().find(item => item.id === id)!
    await runPcsRecordCommand(() => saveMaterialProcessConfiguration({ ...current, name: draft.nameZh, enabled: draft.enabled === 'true' })); openDetail(id)
  }
  state.notice = '已保存。'; state.error = false; state.dirty = false
}
function handleListAction(action: string, node: HTMLElement): boolean {
  const list = lists.get(currentListKey)
  if (!list) return false
  if (action === 'open-column-settings') list.showSettings = true
  else if (action === 'close-column-settings') list.showSettings = false
  else if (action === 'prev-page' || action === 'next-page') state.page = Math.max(1, state.page + (action === 'prev-page' ? -1 : 1))
  else if (action === 'sort-column') { const key = node.dataset.columnKey || ''; list.sort = list.sort?.key !== key ? { key, direction: 'asc' } : list.sort.direction === 'asc' ? { key, direction: 'desc' } : null; state.page = 1 }
  else if (action === 'restore-column-settings') { list.preferences = normalizeListColumnPreferences(list.columns, { order: list.columns.map(c => c.key), visibleKeys: list.columns.map(c => c.key), frozenKeys: [], pageSize: 20 }, PAGE_SIZES); list.sort = null; state.page = 1; persistListPreferences() }
  else if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = node.dataset.pcsConfigWorkspaceColumnKey || '', column = list.columns.find(c => c.key === key)
    if (!column || column.actionColumn) return true
    const field = action === 'toggle-column-visibility' ? 'visibleKeys' : 'frozenKeys'
    if (field === 'visibleKeys' && column.required || field === 'frozenKeys' && !column.freezeable) return true
    const enabled = (node as HTMLInputElement).checked
    if (field === 'frozenKeys' && enabled && list.columns.filter(c => list.preferences.frozenKeys.includes(c.key) || c.key === key).reduce((n, c) => n + c.width, 0) > 420) throw new Error('冻结列宽度合计不能超过 420 像素。')
    list.preferences = normalizeListColumnPreferences(list.columns, { ...list.preferences, [field]: enabled ? [...new Set([...list.preferences[field], key])] : list.preferences[field].filter(c => c !== key) }, PAGE_SIZES); persistListPreferences()
  } else if (action === 'export-list') exportList()
  else return false
  return true
}
function canLeave(): boolean { return !state.dirty || typeof window === 'undefined' || window.confirm('当前修改尚未保存，确定离开并放弃修改吗？') }
export async function handlePcsConfigWorkspaceEvent(target: HTMLElement): Promise<boolean> {
  const node = target.closest<HTMLElement>('[data-pcs-config-workspace-action]')
  const action = node?.dataset.pcsConfigWorkspaceAction
  if (!node || !action) return false
  if (state.busy) return true
  try {
    state.notice = ''; state.error = false
    if (handleListAction(action, node)) { rerender(); return true }
    if (action === 'retry') await retryPcsRecordState()
    else if (action === 'switch-dimension') {
      if (!canLeave()) return true
      state.section = node.dataset.dimensionId as Section; state.view = 'list'; state.search = ''; state.status = 'all'; state.page = 1; state.tab = 'base'; state.dirty = false; state.draft = {}; state.template = null; state.modelView = 'list'; state.model = null
    } else if (action === 'query') state.page = 1
    else if (action === 'reset-query') { state.search = ''; state.status = 'all'; state.page = 1 }
    else if (action === 'kind') { state.kind = node.dataset.kind as MaterialArchiveKind; state.page = 1 }
    else if (action === 'tab') {
      if (state.modelView === 'edit' && !canLeave()) return true
      if (state.section === 'equipmentTypes') { state.modelView = 'list'; state.model = null; state.dirty = false; state.search = ''; state.status = 'all'; state.page = 1 }
      state.tab = node.dataset.tab || 'base'; state.fieldIndex = -1
    }
    else if (action === 'detail') { if (!canLeave()) return true; openDetail(node.dataset.id || '', Number(node.dataset.version || 0)) }
    else if (action === 'create' || action === 'create-category') create(node.dataset.parent || null)
    else if (action === 'edit') { state.view = 'edit'; state.tab = 'base'; state.dirty = false; if(state.template) for(const level of ['package','process'] as const) if(!state.template.fields.some(item=>item.level===level)) state.template.fields.push(...getMaterialBoundFieldDefaults(level)) }
    else if (action === 'back' || action === 'close-all-dialogs') { if (!canLeave()) return true; state.view = 'list'; state.dirty = false; state.template = null; state.fieldIndex = -1; state.modelView = 'list'; state.model = null }
    else if (action === 'save') { state.busy = true; rerender(); await save() }
    else if (action === 'approve-template') {
      state.busy = true; rerender(); await runPcsRecordCommand(() => approveMaterialTemplate(state.selectedId, state.selectedVersion, '当前用户'))
      openDetail(state.selectedId, state.selectedVersion); state.notice = '模板版本已审核，新建档案可使用。'
    } else if (action === 'delete-category') {
      if (!window.confirm('确定删除此无引用的末级分类吗？')) return true
      state.busy = true; rerender(); await runPcsRecordCommand(() => deleteProductCategoryNode(state.selectedId)); state.view = 'list'; state.notice = '分类已删除。'
    } else if (action === 'model-create') { state.model = { id: '', equipmentTypeId: state.selectedId, code: '', name: '', enabled: true }; state.modelView = 'edit'; state.dirty = false }
    else if (action === 'model-detail') { state.model = listMaterialEquipmentModels(state.selectedId).find(item => item.id === node.dataset.id) || null; if (!state.model) throw new Error('型号不存在，请重新读取。'); state.modelView = 'detail'; state.dirty = false }
    else if (action === 'model-edit') { if (!state.model) throw new Error('请先选择型号。'); state.modelView = 'edit'; state.dirty = false }
    else if (action === 'model-back') { if (!canLeave()) return true; state.modelView = 'list'; state.model = null; state.dirty = false }
    else if (action === 'model-save') {
      if (!state.model || state.model.equipmentTypeId !== state.selectedId) throw new Error('设备类型与当前型号不一致，请重新选择。')
      const model = structuredClone(state.model); state.busy = true; rerender()
      state.model = await runPcsRecordCommand(() => saveMaterialEquipmentModel(model, '当前用户')); state.modelView = 'detail'; state.dirty = false; state.notice = '设备型号已保存。'
    }
    else if (action === 'add-category-language') { categoryLanguageRows.push({language:'',name:'',aliases:''}); state.dirty=true }
    else if (action === 'remove-category-language') { if(categoryLanguageRows[Number(node.dataset.index)]?.language!=='zh') categoryLanguageRows.splice(Number(node.dataset.index),1); state.dirty=true }
    else if (action === 'add-conversion') { (state.template!.previousVersionConversions ||= []).push({ key: '', fromUnit: '', toUnit: '', factor: 1 }); state.dirty = true }
    else if (action === 'remove-conversion') { state.template!.previousVersionConversions?.splice(Number(node.dataset.index), 1); state.dirty = true }
    else if (action === 'add-field') { state.template!.fields.push({ key: '', label: '', level: 'root', type: 'text', required: true, identity: true }); state.fieldIndex = state.template!.fields.length - 1; state.dirty = true }
    else if (action === 'edit-field') state.fieldIndex = Number(node.dataset.index)
    else if (action === 'close-field') state.fieldIndex = -1
    else if (action === 'remove-field') { if (window.confirm('从当前模板草稿中移除此属性吗？已有版本不变。')) { state.template!.fields.splice(Number(node.dataset.index), 1); state.dirty = true } }
    else if (action === 'move-field') { const index = Number(node.dataset.index), to = index + Number(node.dataset.direction); const fields = state.template!.fields; if (to >= 0 && to < fields.length) { [fields[index], fields[to]] = [fields[to], fields[index]]; state.dirty = true } }
    else if (action === 'save-exchange-rate') {
      const current = getLatestPcsExchangeRate(); state.busy = true; rerender()
      await runPcsRecordCommand(() => updateLatestPcsExchangeRate({ idrPerCny: Number(state.draft.idr ?? current.idrPerCny), usdPerCny: Number(state.draft.usd ?? current.usdPerCny), source: state.draft.source ?? current.source, updatedBy: '当前用户' }))
      state.dirty = false; state.draft = {}; state.notice = '展示汇率已保存。'
    } else if (action === 'preview-code') state.codePreview = buildProcessedMaterialCode(state.predecessor, state.preview)
    else if (action === 'go-pattern-library') { appStore.navigate('/pcs/pattern-library'); return true }
    else if (action === 'go-stores') { appStore.navigate('/pcs/channels/stores'); return true }
    else return false
  } catch (error) { state.notice = error instanceof Error ? error.message : '本次未保存，请重试。'; state.error = true }
  finally { state.busy = false }
  rerender(); return true
}
export function handlePcsConfigWorkspaceInput(target: Element): boolean {
  const node = target.closest<HTMLInputElement | HTMLSelectElement>('[data-pcs-config-workspace-field]')
  const key = node?.dataset.pcsConfigWorkspaceField
  if (!node || !key) return false
  if (state.busy) return true
  const value = node.value
  if (key === 'pageSize') { const list = lists.get(currentListKey); if (list) { list.preferences.pageSize = PAGE_SIZES.includes(Number(value)) ? Number(value) : 20; state.page = 1; persistListPreferences(); rerender() } }
  else if (key === 'search') state.search = value
  else if (key === 'filter-status') { state.status = value; state.page = 1 }
  else if (key.startsWith('model-')) {
    const prop = key.slice(6)
    if (state.model && ['name', 'enabled', 'code'].includes(prop) && !(prop === 'code' && state.model.id)) { Object.assign(state.model, { [prop]: prop === 'enabled' ? value === 'true' : value }); state.dirty = true }
  }
  else if (key.startsWith('language-')) { const match=/^language-(\d+)-(language|name|aliases)$/.exec(key); if(match&&categoryLanguageRows[Number(match[1])]) { Object.assign(categoryLanguageRows[Number(match[1])],{[match[2]]:value}); state.dirty=true } }
  else if (key.startsWith('conversion-')) {
    const match = /^conversion-(\d+)-(key|fromUnit|toUnit|factor)$/.exec(key), rows = state.template?.previousVersionConversions
    if (match && rows?.[Number(match[1])]) { Object.assign(rows[Number(match[1])], { [match[2]]: match[2] === 'factor' ? value.trim() ? Number(value) : NaN : value }); state.dirty = true }
  }
  else if (key.startsWith('preview-')) {
    const prop = key.slice(8); state.codePreview = ''
    if (prop === 'predecessor') state.predecessor = value
    else Object.assign(state.preview, { [prop]: node.type === 'checkbox' ? (node as HTMLInputElement).checked : value })
    if (['processType', 'printSide', 'penetration'].includes(prop)) rerender()
  } else if (key.startsWith('fx-')) { state.draft[key.slice(3)] = value; state.dirty = true }
  else if (key.startsWith('template-')) { const prop = key.slice(9); Object.assign(state.template!, { [prop]: prop === 'enabled' ? value === 'true' : value }); state.dirty = true }
  else if (key.startsWith('field-')) {
    const prop = key.slice(6), item = state.template!.fields[state.fieldIndex]
    Object.assign(item, { [prop]: prop === 'options' ? split(value) : ['identity', 'integer'].includes(prop) ? (node as HTMLInputElement).checked : ['dictionaryId', 'unitId', 'valueShape'].includes(prop) ? value || undefined : prop === 'minimum' ? value.trim() ? Number(value) : undefined : value })
    if (prop === 'requiredWhen') item.required = value !== 'optional'
    if (prop === 'unitId') { const unit=listMaterialAttributeUnitDefinitions().find(row=>row.id===value); item.unit=unit?.code || ''; item.unitId=unit?.id }
    if (prop === 'dictionaryId' && value) item.enumDefinition=undefined
    state.dirty = true
    if (prop === 'dictionaryId' || prop === 'unitId') rerender()
    if (prop === 'type') { if (value !== 'number') { delete item.minimum; delete item.integer }; if (value !== 'reference') delete item.valueShape; rerender() }
  } else { state.draft[key] = value; state.dirty = true }
  if (state.dirty && typeof document !== 'undefined') { const marker = document.querySelector<HTMLElement>('[data-pcs-config-save-status]'); if (marker) { marker.textContent = '有未保存修改'; marker.classList.add('text-amber-700') } }
  return true
}
export function isPcsConfigWorkspaceDialogOpen(): boolean { return state.view === 'edit' || state.modelView === 'edit' }
export function resetPcsConfigWorkspaceState(): void { state.section = 'productCategories'; state.view = 'list'; state.tab = 'base'; state.search = ''; state.status = 'all'; state.page = 1; state.selectedId = ''; state.selectedVersion = 0; state.notice = ''; state.error = false; state.busy = false; state.dirty = false; state.draft = {}; state.template = null; state.fieldIndex = -1; state.modelView = 'list'; state.model = null; lists.clear(); currentListKey = '' }
