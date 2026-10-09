import { confirmPcsAction, requestPcsActionReason } from './pcs-action-dialog.ts'
// @page-pattern: list
// R1 P01-P03 / PROD-001..012: separate lists, read-only details and dedicated editors.
import { escapeHtml } from '../utils.ts'
import { hydrateIcons } from '../components/shell.ts'
import { appStore } from '../state/store.ts'
import { renderStandardListPage, renderStandardListFilters, renderStandardListStats } from '../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../components/ui/list-table.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import { loadListColumnPreferences, saveListColumnPreferences, paginateStandardListRows, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../components/ui/list-table-model.ts'
import { listStyleArchives, getStyleArchiveById } from '../data/pcs-style-archive-repository.ts'
import { listSkuArchives, getSkuArchiveCountsByStyle, listSkuArchivesByStyleId, getSkuArchiveById, createSkuArchiveBatch } from '../data/pcs-sku-archive-repository.ts'
import { listEngineeringBomPricingPlans } from '../data/pcs-engineering-bom-repository.ts'
import { listTechnicalDataVersionsByStyleId } from '../data/pcs-technical-data-version-repository.ts'
import { listChannelMappingsBySkuId, listChannelListingsByStyleId, getChannelArchiveCounts } from '../data/pcs-channel-catalog.ts'
import { listConfigDimensionOptions, listProductCategoryNodes } from '../data/pcs-config-workspace-repository.ts'
import { FLAT_DIMENSION_META, type FlatDimensionId } from '../data/pcs-config-dimensions.ts'
import { APPROVAL_LABELS as approvalLabels, LIFECYCLE_LABELS as lifecycleLabels, DELIVERY_LABELS as deliveryLabels, type SalesBaseContent, resolveProductMainUnit } from '../data/pcs-product-archive-rules.ts'
import { previewProductSkus, saveProductStyleDraft, saveProductSkuDraft, submitProductForApproval, reviewProductArchive, setProductLifecycle, saveProductSalesContent, productDraftCopy, type ProductStyleDraft, type ProductSkuDraft } from '../data/pcs-product-archive-commands.ts'
import { listMaterialUnitDefinitions } from '../data/pcs-material-config.ts'
import { productPackages } from '../data/pcs-product-packaging.ts'
import { listMaterialPatternChoices } from '../data/pcs-material-pattern.ts'
import { getProjectCreateCatalog } from '../data/pcs-project-repository.ts'
import { listAllMaterialSkuRecords } from '../data/pcs-material-archive-repository.ts'
import { runPcsRecordCommand, registerPcsFile, releasePcsPendingFile, getPcsDurableFileReference } from '../data/pcs-record-runtime.ts'
import type { StyleArchiveShellRecord } from '../data/pcs-style-archive-types.ts'
import type { SkuArchiveRecord } from '../data/pcs-sku-archive-types.ts'
import { defaultStyleSalesContent, createStyleSizeChart, styleSizeChartHtml, applyStyleSizeChart, generateStyleSizeChartDraft, defaultStyleDescription, type StyleSizeChartDraft, type StyleSizeChartType } from '../data/pcs-style-size-chart.ts'
import { renderStyleRichEditor, renderStyleSizeChartTool, generateStyleSizeChartImage, styleContentHtml, renderStyleContent, STYLE_CONTENT_CSS } from './pcs-style-content-editor.ts'

type Kind = 'style' | 'sku'
type Row = StyleArchiveShellRecord | SkuArchiveRecord
const PREFIX = 'pcs-product-archive'
const STYLE_PATH = '/pcs/products/styles', SKU_PATH = '/pcs/products/specifications'
let listContext: { styles: Map<string, StyleArchiveShellRecord>; skuCounts: Map<string, number>; channelCounts: Map<string, number>; categoryNumbers: Map<string, ReturnType<typeof listConfigDimensionOptions>[number]>; specialCrafts: Map<string, string> } | null = null
const cls = 'h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100 disabled:text-slate-500'
const state = {
  kind: 'style' as Kind, view: 'list' as 'list' | 'detail' | 'edit', id: '', tab: 'basic', editorTab: 'identity', editorKey: '',
  query: {} as Record<string, string>, filter: {} as Record<string, string>, page: 1, sort: null as StandardListSortState | null,
  preferences: {} as Partial<Record<Kind, StandardListColumnPreferences>>, columnsOpen: false, more: false, notice: '', error: false,
  selected: new Set<string>(), image: '', imageName: '', dirty: false, saving: false,
  styleDraft: { styleName: '' } as ProductStyleDraft, skuDraft: {} as Partial<SkuArchiveRecord> & { changeReason?: string },
  colors: [] as string[], sizes: [] as string[], pattern: '', difference: '', preview: [] as SkuArchiveRecord[],
  sales: null as SalesBaseContent | null, salesLanguage: 'id', pendingFileIds: [] as string[],
  chart: null as StyleSizeChartDraft | null, chartPreview: '', chartImageBlob: null as Blob | null, chartImageUrl: '', richSources: new Set<string>(),
  importOpen: false, importText: '', importRows: [] as ProductSkuDraft[], importErrors: [] as string[],
  batchResults: [] as Array<{ code: string; success: boolean; message: string }>,
}
const e = (v: unknown) => escapeHtml(String(v ?? ''))
const path = (kind = state.kind) => kind === 'style' ? STYLE_PATH : SKU_PATH
const idOf = (r: Row) => 'skuId' in r ? r.skuId : r.styleId
const codeOf = (r: Row) => 'skuCode' in r ? r.skuCode : r.styleCode
const nameOf = (r: Row) => 'skuName' in r ? r.skuName : r.styleName
const imageOf = (r: Row) => 'skuImageUrl' in r ? r.skuImageUrl : r.mainImageUrl
function btn(label: string, action: string, attrs = '', primary = false): string { return `<button type="button" class="inline-flex h-9 shrink-0 items-center justify-center rounded-md border px-3 text-sm font-medium ${primary ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'} disabled:opacity-50" data-${PREFIX}-action="${action}" data-skip-page-rerender="true" ${attrs}>${e(label)}</button>` }
function link(label: string, href: string, extra = ''): string { return `<a href="${e(href)}" data-nav="${e(href)}" class="text-blue-600 hover:underline ${extra}">${e(label)}</a>` }
function field(label: string, control: string, help = ''): string {
  const grouped = /<label|<details/.test(control), tag = grouped ? 'fieldset' : 'label'
  return `<${tag} class="block min-w-0 space-y-1.5 text-sm"><${grouped ? 'legend' : 'span'} class="font-medium text-slate-700">${e(label)}</${grouped ? 'legend' : 'span'}>${control}${help ? `<span class="block text-xs leading-5 text-slate-500">${e(help)}</span>` : ''}</${tag}>`
}
function input(key: string, value: unknown, type = 'text', disabled = false, placeholder = ''): string { return `<input class="${cls}" type="${type}" data-${PREFIX}-field="${e(key)}" value="${e(value)}" ${disabled ? 'disabled' : ''} placeholder="${e(placeholder)}" ${type === 'number' ? 'min="0" step="any"' : ''}>` }
function textarea(key: string, value: unknown): string { return `<textarea class="min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" data-${PREFIX}-field="${e(key)}">${e(value)}</textarea>` }
function select(key: string, value: unknown, options: Array<[string, string]>, empty = '请选择', disabled = false): string { return `<select class="${cls}" data-${PREFIX}-field="${e(key)}" ${disabled ? 'disabled' : ''}><option value="">${e(empty)}</option>${options.map(([v, l]) => `<option value="${e(v)}" ${v === value ? 'selected' : ''}>${e(l)}</option>`).join('')}</select>` }
function badge(label: string, tone = 'slate'): string { return `<span class="inline-flex whitespace-nowrap rounded border px-2 py-0.5 text-xs ${tone === 'green' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}">${e(label)}</span>` }
function statuses(r: Row): string { return `${badge(approvalLabels[r.approvalStatus || 'DRAFT'], r.approvalStatus === 'APPROVED' ? 'green' : r.approvalStatus === 'PENDING' ? 'amber' : 'slate')} ${badge(lifecycleLabels[r.lifecycleStatus || 'NOT_ENABLED'], r.lifecycleStatus === 'ACTIVE' ? 'green' : 'slate')}` }
function photo(url: string, name: string, big = false): string { return url ? `<button type="button" class="shrink-0 overflow-hidden rounded-md border bg-slate-50 ${big ? 'h-20 w-20' : 'h-12 w-12'}" data-${PREFIX}-action="image" data-url="${e(url)}" data-name="${e(name)}"><img src="${e(url)}" alt="${e(name)}" class="h-full w-full object-cover" loading="${big ? 'eager' : 'lazy'}"></button>` : `<span class="flex ${big ? 'h-20 w-20' : 'h-12 w-12'} shrink-0 items-center justify-center rounded border bg-slate-50 text-xs text-slate-400">待补图片</span>` }
function notice(): string { return (state.notice ? `<div role="${state.error ? 'alert' : 'status'}" class="flex items-center justify-between rounded-md border px-4 py-3 text-sm ${state.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'}"><span>${e(state.notice)}</span>${btn('关闭', 'dismiss')}</div>` : '') + (state.batchResults.length ? `<details class="mt-3 rounded-md border bg-white p-3" open><summary class="cursor-pointer text-sm font-medium">批量提交结果</summary><div class="mt-3 max-h-56 overflow-auto">${table(['档案编码', '结果', '说明'], state.batchResults.map(r => [e(r.code), badge(r.success ? '成功' : '失败', r.success ? 'green' : 'amber'), e(r.message)]))}</div></details>` : '') }
function panel(title: string, body: string, action = ''): string { return `<section class="overflow-hidden rounded-lg border bg-white"><header class="flex items-center justify-between gap-3 border-b px-5 py-3"><h2 class="font-semibold">${e(title)}</h2>${action}</header><div class="p-5">${body}</div></section>` }
function grid(items: Array<[string, unknown]>): string { return `<dl class="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">${items.map(([k, v]) => `<div class="min-w-0"><dt class="text-xs text-slate-500">${e(k)}</dt><dd class="mt-1.5 break-words text-sm text-slate-900">${e(Array.isArray(v) ? v.join('、') || '—' : (v === 0 ? 0 : v || '—'))}</dd></div>`).join('')}</dl>` }
function table(headers: string[], rows: string[][]): string { return `<div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr>${headers.map(h => `<th class="whitespace-nowrap px-4 py-3 font-medium">${e(h)}</th>`).join('')}</tr></thead><tbody class="divide-y">${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td class="px-4 py-3 align-middle">${cell}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" class="p-10 text-center text-slate-500">暂无记录</td></tr>`}</tbody></table></div>` }
function tabBar(tabs: Array<[string, string]>, value: string, action: string): string { return `<nav class="flex gap-6 overflow-x-auto border-b bg-white px-5" aria-label="资料视图">${tabs.map(([k, label]) => `<button type="button" class="shrink-0 border-b-2 px-1 py-3 text-sm ${value === k ? 'border-blue-600 font-semibold text-blue-600' : 'border-transparent text-slate-500 hover:text-blue-600'}" aria-selected="${value === k}" data-${PREFIX}-action="${action}" data-tab="${k}">${e(label)}</button>`).join('')}</nav>` }
function wrap(html: string): string { return `${STYLE_CONTENT_CSS}<div data-pcs-product-archive-root data-skip-page-rerender="true">${html}<div data-product-overlays>${overlays()}</div></div>` }
function categoryNumberLabel(r: StyleArchiveShellRecord): string {
  const options = (r.productConfigRefs?.categoryNumbers || []).map(id => listContext?.categoryNumbers.get(id)).filter(Boolean)
  return options.length ? options.map(option => [option!.code, option!.name_en, option!.name_zh].filter(Boolean).join(' · ')).join('、') : [r.categoryCode, r.categoryCodeName].filter(Boolean).join(' · ')
}
function styleAttributeLines(r: StyleArchiveShellRecord, group: 'designAttributes' | 'audienceAttributes'): Array<[string, string]> {
  return group === 'designAttributes'
    ? [['品类', (r.categoryTags || []).join('、')], ['风格', (r.styleTags || []).join('、')], ['面料', (r.fabricTags || []).join('、')], ['流行元素', (r.popularElementTags || []).join('、')], ['商品定位', r.productPosition || ''], ['特种工艺', (r.productConfigRefs?.specialCrafts || []).map(id => listContext?.specialCrafts.get(id) || '配置项已删除').join('、')]]
    : [['人群', (r.targetAudienceTags || []).join('、')], ['年龄', (r.ageTags || []).join('、')], ['人群定位', (r.audiencePositionTags || []).join('、')]]
}
function attributeColumn(key: 'designAttributes' | 'audienceAttributes', title: string): StandardListColumn<Row> {
  return { key, title, width: key === 'designAttributes' ? 220 : 165, sortable: true,
    sortValue: r => styleAttributeLines(r as StyleArchiveShellRecord, key).map(([name, value]) => `${name}：${value || '—'}`).join('；'),
    render: r => `<dl class="space-y-1 text-xs leading-5" data-style-attribute-group="${key}">${styleAttributeLines(r as StyleArchiveShellRecord, key).map(([name, value]) => `<div class="flex items-start gap-2"><dt class="shrink-0 text-slate-500">${e(name)}</dt><dd class="min-w-0 break-words text-slate-700">${e(value || '—')}</dd></div>`).join('')}</dl>` }
}
function columns(): StandardListColumn<Row>[] {
  const textCol = (key: string, title: string, value: (r: Row) => unknown, width = 130): StandardListColumn<Row> => ({ key, title, width, sortable: true, render: r => e(value(r) || '—'), sortValue: value })
  const list: StandardListColumn<Row>[] = [
    { key: 'select', title: '', width: 40, required: true, leadingControlColumn: true, renderHeader: rows => `<input type="checkbox" aria-label="选择本页" data-${PREFIX}-action="select-page" ${rows.length && rows.every(r => state.selected.has(idOf(r))) ? 'checked' : ''}>`, render: r => `<input type="checkbox" aria-label="选择 ${e(codeOf(r))}" data-${PREFIX}-action="select-row" data-id="${e(idOf(r))}" ${state.selected.has(idOf(r)) ? 'checked' : ''}>` },
    { key: 'identity', title: state.kind === 'style' ? '款式' : '商品规格', width: state.kind === 'style' ? 240 : 280, minWidth: 230, required: true, freezeable: true, sortable: true, sortValue: codeOf, render: r => `<div class="flex items-center gap-3">${photo(imageOf(r), nameOf(r))}<div class="min-w-0">${link(codeOf(r), `${path()}/${idOf(r)}`, 'font-medium break-all')}<div class="mt-1 line-clamp-2 text-xs text-slate-500">${e(nameOf(r))}</div>${state.kind === 'style' ? `<div class="mt-2 flex flex-wrap gap-1">${statuses(r)}</div>` : ''}</div></div>` },
  ]
  if (state.kind === 'style') list.push(textCol('brand', '品牌', r => (r as StyleArchiveShellRecord).brandName, 100), textCol('category', '正式类目', r => (r as StyleArchiveShellRecord).thirdCategoryName || (r as StyleArchiveShellRecord).categoryName, 150), textCol('categories', '品类', r => (r as StyleArchiveShellRecord).categoryTags?.join('、')), textCol('styles', '风格', r => (r as StyleArchiveShellRecord).styleTags?.join('、'), 100), textCol('categoryNumber', '品类编号', r => categoryNumberLabel(r as StyleArchiveShellRecord), 200), attributeColumn('designAttributes', '款式属性'), attributeColumn('audienceAttributes', '适用人群'), textCol('productPosition', '商品定位', r => (r as StyleArchiveShellRecord).productPosition, 100), textCol('skus', 'SKU 数', r => listContext?.skuCounts.get(r.styleId) || 0, 80))
  else list.push({ key: 'style', title: '所属款式', width: 175, sortable: true, sortValue: r => r.styleCode, render: r => link(r.styleCode, `${STYLE_PATH}/${r.styleId}`) }, textCol('color', '颜色', r => (r as SkuArchiveRecord).colorName, 110), textCol('size', '尺码', r => (r as SkuArchiveRecord).sizeName, 80), textCol('unit', '主单位', r => (r as SkuArchiveRecord).pricingUnit, 80), textCol('channels', '平台规格数', r => listContext?.channelCounts.get(idOf(r)) || 0, 100))
  if (state.kind === 'style') list.push(textCol('technicalVersion', '当前技术包', r => (r as StyleArchiveShellRecord).currentTechPackVersionCode, 180), textCol('channelCount', '渠道商品数', r => listContext?.channelCounts.get(r.styleId) || 0, 100))
  list.push({ key: 'approval', title: '审核', width: 100, sortable: true, sortValue: r => r.approvalStatus, render: r => badge(approvalLabels[r.approvalStatus || 'DRAFT'], r.approvalStatus === 'APPROVED' ? 'green' : 'amber') }, { key: 'lifecycle', title: '使用状态', width: 100, sortable: true, sortValue: r => r.lifecycleStatus, render: r => badge(lifecycleLabels[r.lifecycleStatus || 'NOT_ENABLED'], r.lifecycleStatus === 'ACTIVE' ? 'green' : 'slate') }, textCol('updatedAt', '更新时间', r => r.updatedAt, 165), textCol('remark', '备注', r => r.remark, 180), { key: 'actions', title: '操作', width: 130, required: true, actionColumn: true, render: r => `<div class="flex gap-3">${link('详情', `${path()}/${idOf(r)}`)}${link('编辑', `${path()}/${idOf(r)}/edit`)}</div>` })
  return list
}
function preferences(): StandardListColumnPreferences {
  if (!state.preferences[state.kind]) {
    const cols = columns(), defaults = { order: state.kind === 'style' ? ['select', 'identity', 'designAttributes', 'audienceAttributes', 'categoryNumber', ...cols.map(c => c.key).filter(key => !['select', 'identity', 'designAttributes', 'audienceAttributes', 'categoryNumber'].includes(key))] : cols.map(c => c.key), visibleKeys: state.kind === 'style' ? ['select', 'identity', 'designAttributes', 'audienceAttributes', 'categoryNumber', 'actions'] : cols.filter(c => !['remark', 'technicalVersion', 'channelCount'].includes(c.key)).map(c => c.key), frozenKeys: ['identity'], pageSize: 20 }
    let storage: Pick<Storage, 'getItem'> = { getItem: () => null }; try { storage = window.localStorage } catch { /* bounded optional preference */ }
    // Old column preferences predate the added attributes. Show new columns once,
    // without resetting existing order, hidden columns or subsequent user choices.
    const compatibleStorage = { getItem: (key: string) => {
      const raw = storage.getItem(key); if (!raw || state.kind !== 'style') return raw
      try { const parsed = JSON.parse(raw); if (!Array.isArray(parsed.order) || !Array.isArray(parsed.visibleKeys)) return raw
        const added = ['designAttributes', 'audienceAttributes', 'productPosition'].filter(key => !parsed.order.includes(key))
        return JSON.stringify({ ...parsed, order: [...parsed.order, ...added], visibleKeys: [...parsed.visibleKeys, ...added] })
      } catch { return raw }
    } }
    state.preferences[state.kind] = loadListColumnPreferences(compatibleStorage, `higood-pcs-${state.kind}-list-r1`, cols, defaults, [20, 50, 100])
  }
  return state.preferences[state.kind]!
}
function savePreferences(): void { try { saveListColumnPreferences(window.localStorage, `higood-pcs-${state.kind}-list-r1`, preferences()) } catch { /* preference unavailable */ } }
function filteredRows(all: Row[] = state.kind === 'style' ? listStyleArchives() : listSkuArchives()): Row[] {
  const f = state.filter
  return all.filter(r => {
    const style = 'skuId' in r ? (listContext?.styles.get(r.styleId) || getStyleArchiveById(r.styleId)) : r
    if (!style) return false
    if (f.keyword && ![codeOf(r), nameOf(r), 'legacyCode' in r ? [r.legacyCode, r.barcode, ...(r.barcodeAliases || [])].join(' ') : (r.legacyCodes || []).join(' '), r.styleCode].join(' ').toLowerCase().includes(f.keyword.toLowerCase())) return false
    if (f.approval && r.approvalStatus !== f.approval || f.lifecycle && r.lifecycleStatus !== f.lifecycle || f.styleId && r.styleId !== f.styleId) return false
    if (f.formalCategory && style.productCategoryId !== f.formalCategory || f.year && style.yearTag !== f.year || f.material && style.materialType !== f.material || f.owner && !r.updatedBy.includes(f.owner)) return false
    for (const dim of ['brands', 'categories', 'styles', 'categoryNumbers', 'productPositioning'] as FlatDimensionId[]) if (f[dim] && !style.productConfigRefs?.[dim]?.includes(f[dim])) return false
    return !f.season || style.seasonTags?.includes(f.season)
  })
}
function configOptions(dim: FlatDimensionId, selected: string[] = []): Array<[string, string]> { return listConfigDimensionOptions(dim).filter(v => v.status === 'ENABLED' || selected.includes(v.id)).map(v => [v.id, `${dim === 'categoryNumbers' ? `${v.code} · ` : ''}${v.name_zh}${v.status !== 'ENABLED' ? '（已停用）' : ''}`]) }
function leafOptions(): Array<[string, string]> { const all = listProductCategoryNodes(); return all.filter(n => !all.some(c => c.parentId === n.id)).map(n => [n.id, [all.find(p => p.id === all.find(p => p.id === n.parentId)?.parentId)?.name, all.find(p => p.id === n.parentId)?.name, n.name].filter(Boolean).join(' / ')]) }
function renderList(kind: Kind): string {
  const styles = listStyleArchives(), skus = kind === 'sku' ? listSkuArchives() : [], channels = getChannelArchiveCounts()
  listContext = { styles: new Map(styles.map(s => [s.styleId, s])), skuCounts: getSkuArchiveCountsByStyle(), channelCounts: kind === 'style' ? channels.byStyle : channels.bySku, categoryNumbers: new Map(listConfigDimensionOptions('categoryNumbers').map(o => [o.id, o])), specialCrafts: new Map(listConfigDimensionOptions('specialCrafts').map(o => [o.id, o.name_zh])) }
  if (state.view !== 'list' || state.kind !== kind) { state.page = 1; state.sort = null; state.selected.clear(); state.filter = {}; state.query = {}; const parent = typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('styleId'); if (parent) state.query.styleId = state.filter.styleId = parent }
  state.kind = kind; state.view = 'list'; state.id = ''; state.dirty = false
  const cols = columns(), prefs = preferences(), all = kind === 'style' ? styles : skus
  const filtered = sortStandardListRows(filteredRows(all), state.sort, (r, k) => cols.find(c => c.key === k)?.sortValue?.(r))
  const page = paginateStandardListRows(filtered, state.page, prefs.pageSize); state.page = page.currentPage
  const basic = field('编码 / 名称 / 旧码', input('filter.keyword', state.query.keyword, 'text', false, '支持模糊查询')) + (kind === 'style' ? field('品牌', select('filter.brands', state.query.brands, configOptions('brands'), '全部品牌')) : field('所属款式', select('filter.styleId', state.query.styleId, listStyleArchives().map(s => [s.styleId, s.styleCode]), '全部款式'))) + field('审核状态', select('filter.approval', state.query.approval, Object.entries(approvalLabels), '全部审核')) + field('使用状态', select('filter.lifecycle', state.query.lifecycle, Object.entries(lifecycleLabels), '全部状态'))
  const more = state.more ? `<div class="mt-3 grid gap-3 border-t pt-3 md:grid-cols-4">${['categories', 'styles', 'categoryNumbers', 'productPositioning'].map(dim => field(FLAT_DIMENSION_META.find(v => v.id === dim)!.name, select(`filter.${dim}`, state.query[dim], configOptions(dim as FlatDimensionId), '全部'))).join('')}${field('正式类目', select('filter.formalCategory', state.query.formalCategory, leafOptions(), '全部'))}${field('年份', input('filter.year', state.query.year))}${field('季节', input('filter.season', state.query.season))}${field('材质类型', select('filter.material', state.query.material, [['毛织', '毛织'], ['非毛织', '非毛织']], '全部'))}${field('维护人', input('filter.owner', state.query.owner))}</div>` : ''
  const filters = renderStandardListFilters({ fieldsHtml: `<div class="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4">${basic}</div>${more}`, actionPrefix: PREFIX, extraActionsHtml: btn(state.more ? '收起筛选' : '更多筛选', 'more') + btn('导出', 'export') })
  return wrap(renderStandardListPage({ title: kind === 'style' ? '款式档案' : '规格档案', primaryActionsHtml: `<div class="flex gap-2">${kind === 'sku' ? btn('导入规格', 'import') : ''}${link(kind === 'style' ? '新增款式' : '新增规格', `${path()}/new`, 'rounded-md bg-blue-600 px-4 py-2 text-white hover:text-white')}</div>`, feedbackHtml: notice(), filtersHtml: filters, statsHtml: renderStandardListStats([{ label: '当前结果', value: filtered.length }, { label: '待审核', value: filtered.filter(r => r.approvalStatus === 'PENDING').length }, { label: '启用', value: filtered.filter(r => r.lifecycleStatus === 'ACTIVE').length }, { label: '停用', value: filtered.filter(r => r.lifecycleStatus === 'INACTIVE').length }, { label: '归档', value: filtered.filter(r => r.lifecycleStatus === 'ARCHIVED').length }], { compact: true }), listTitle: `${kind === 'style' ? '款式' : '规格'}列表`, listActionsHtml: `<div class="flex items-center gap-2"><span class="text-xs text-slate-500">已选 ${state.selected.size} 条</span>${btn('提交审核', 'batch-submit', state.selected.size ? '' : 'disabled')}${btn('列设置', 'columns')}</div>`, tableHtml: renderStandardListTable({ columns: cols, rows: page.rows, preferences: prefs, sort: state.sort, eventPrefix: PREFIX, skipPageRerender: true }), paginationHtml: renderTablePagination({ ...page, actionPrefix: PREFIX, skipPageRerender: true, pageSizeOptions: [20, 50, 100] }) }))
}
export function renderPcsStyleArchiveListPage(): string { return renderList('style') }
export function renderPcsSpecificationListPage(): string { return renderList('sku') }
function detailActions(r: Row): string {
  return `<div class="flex flex-wrap gap-2">${link('编辑', `${path()}/${idOf(r)}/edit`, 'rounded-md border px-3 py-2')}${r.approvalStatus === 'DRAFT' ? btn('提交审核', 'submit', '', true) : r.approvalStatus === 'PENDING' ? btn('审核通过', 'approve', '', true) + btn('驳回', 'reject') : r.lifecycleStatus === 'NOT_ENABLED' || r.lifecycleStatus === 'INACTIVE' ? btn('启用', 'activate', '', true) : ''}${r.lifecycleStatus === 'ACTIVE' ? btn('停用', 'deactivate') : ''}${r.lifecycleStatus !== 'ARCHIVED' ? btn('归档', 'archive') : ''}${btn('复制', 'copy')}</div>`
}
function productChangeLabel(key: string): string { return ({"styleName": "款式名称", "styleCode": "款式编码", "styleNameTranslations": "多语名称", "materialType": "材质类型", "brandName": "品牌", "mainImageUrl": "主图", "galleryImageUrls": "图片", "productConfigRefs": "分类与属性", "productCategoryId": "正式类目", "skuName": "规格名称", "skuCode": "规格编码", "colorId": "颜色", "sizeId": "尺码", "colorName": "颜色名称", "sizeName": "尺码名称", "patternId": "花型编号", "patternIdentityId": "花型", "printName": "花型名称", "barcode": "条码", "barcodeAliases": "条码别名", "pricingUnit": "主单位编码", "mainUnitId": "主单位", "packageSpecs": "包装规格", "packageSpecHistory": "历史包装", "weightKg": "净重", "remark": "备注", "approvalStatus": "审核状态", "lifecycleStatus": "使用状态", "archiveStatus": "档案状态", "salesContents": "销售基础内容", "factorySizeChartHtml": "工厂做货尺码表", "sizeChartDraft": "尺码表测量值", "salesCountrySettings": "国家设置", "salesCountryDescriptions": "国家商品描述", "sameStyleIds": "同款关联", "substitutionRelations": "替代关联", "updatedBy": "更新人", "deliveryMode": "交付方式", "buyerId": "买手", "buyerName": "买手名称", "yearTag": "年份", "seasonTags": "季节", "extraIdentityValues": "交付差异", "deliveryDifference": "交付差异", "bundleComponents": "组合组成"} as Record<string, string>)[key] || '其他资料' }
function formatChangeValue(value: unknown): string { return value == null || value === '' ? '空' : typeof value === 'object' ? JSON.stringify(value) : String(value) }
function recordTab(r: Row): string { return panel('记录', table(['动作', '说明', '操作人', '时间'], (r.archiveLogs || []).slice().reverse().map(l => [e(l.action), `${e(l.detail)}${l.changes?.length ? `<details class="mt-2"><summary>查看原值与新值</summary><div class="max-w-lg break-words">${l.changes.map(change => `<div class="mt-2">${e(productChangeLabel(change.field))}：${e(formatChangeValue(change.before))} → ${e(formatChangeValue(change.after))}</div>`).join('')}<div class="mt-2">原因：${e(l.reason || l.detail)}</div></div></details>` : ''}`, e(l.operator), e(l.time)])) + `<div class="mt-5">${grid([['内部身份', idOf(r)], ['来源系统', r.sourceSystem || ('legacySystem' in r ? r.legacySystem : r.identitySource === 'MANUAL' ? 'PCS手工建档' : '原型演示资料')], ['原记录 ID', r.sourceId || ('sourceProjectId' in r ? r.sourceProjectId : '')], ['来源旧码', 'legacyCode' in r ? [r.legacyCode, r.barcode, ...(r.barcodeAliases || [])].join(' ') : r.legacyCodes || r.legacyOriginProject], ['建立时间', 'createdAt' in r ? r.createdAt : r.generatedAt], ['更新人', r.updatedBy], ['更新时间', r.updatedAt]])}</div>${r.legacyValues?.length ? `<details class="mt-5"><summary>必要历史原值</summary>${table(['来源字段', '原值', '原单位 / 币种'], r.legacyValues.map(v => [e(v.field), e(formatChangeValue(v.value)), e([v.unit, v.currency].filter(Boolean).join(' / '))]))}</details>` : ''}`) }
function technicalTab(styleId: string): string { return panel('技术包引用', table(['版本', '状态', 'BOM 条数', '尺寸 / 工艺', '更新', '操作'], listTechnicalDataVersionsByStyleId(styleId).map(v => [e(`${v.technicalVersionCode} · ${v.versionLabel}`), e(v.versionStatus === 'PUBLISHED' ? '已发布' : v.versionStatus === 'DRAFT' ? '草稿' : '归档'), e(v.bomItemCount), e(`${v.gradingRuleCount} / ${v.processEntryCount}`), e(v.updatedAt), link('查看技术包', `${STYLE_PATH}/${styleId}/technical-data/${v.technicalVersionId}`)]))) + '<div class="mt-4"></div>' + panel('核价引用', table(['核价方案', '业务来源', '采用版本', '更新', '操作'], listEngineeringBomPricingPlans().filter(p => p.styleId === styleId).map(p => [e(p.ownerCode), e(({ INDEPENDENT_SAMPLING: '设计改款', ENGINEERING_MASTER: '生产准备', TECH_PACK_DRAFT: '技术包草稿' })[p.ownerStage]), e(p.publishedSnapshotId || (p.status === 'DRAFT' ? '准备中' : p.completedConfirmedAt ? '已确认' : '当前方案')), e(p.updatedAt), link('查看核价', `/pcs/technical-data/bom-pricing/owner/${encodeURIComponent(p.ownerStage)}/${encodeURIComponent(p.ownerId)}`)]))) }
function channelTab(skuId: string): string { return panel('渠道关联', table(['渠道 / 店铺', 'PID', '平台规格 ID', '平台颜色 / 尺码', '售价', '状态', '操作'], listChannelMappingsBySkuId(skuId).map(m => [e(`${m.channelCode} / ${m.storeName}`), e(m.platformProductId || '待发布'), e(m.platformVariantId || '待分配'), e(`${m.displayColor} / ${m.displaySize}`), e(m.effectivePrice == null ? '未维护' : `${m.effectivePrice} ${m.currency}`), e(m.platformStatus), link('查看渠道商品', `/pcs/products/channel-products/${m.listingId}`)]))) }

function translationsPanel(kind: Kind, record: Partial<StyleArchiveShellRecord> | Partial<SkuArchiveRecord>, editing: boolean): string {
  const names = kind === 'style' ? { en: (record as Partial<StyleArchiveShellRecord>).styleNameEn || '', ...(record as Partial<StyleArchiveShellRecord>).styleNameTranslations } : { en: (record as Partial<SkuArchiveRecord>).skuNameEn || '', ...(record as Partial<SkuArchiveRecord>).skuNameTranslations }
  const languages = [['en', '英文'], ['id', '印尼语'], ['ms', '马来语']] as const
  return panel('多语名称', editing ? `<div class="grid gap-5 md:grid-cols-2">${languages.map(([key, label]) => field(`${label}名称`, input(`translation.${key}`, names[key]))).join('')}</div>` : grid(languages.map(([key, label]) => [`${label}名称`, names[key]])))
}

function styleBody(r: StyleArchiveShellRecord): string {
  if (state.tab === 'translations') return translationsPanel('style', r, false)
  if (state.tab === 'technical') return technicalTab(r.styleId)
  if (state.tab === 'records') return recordTab(r)
  if (state.tab === 'skus') return panel('规格清单', table(['规格', '颜色', '尺码', '交付方式', '审核 / 使用状态', '操作'], listSkuArchivesByStyleId(r.styleId).map(s => [link(s.skuCode, `${SKU_PATH}/${s.skuId}`), e(s.colorName), e(s.sizeName), e(deliveryLabels[s.deliveryMode || 'SINGLE']), statuses(s), link('编辑', `${SKU_PATH}/${s.skuId}/edit`)])), link('新增规格', `${SKU_PATH}/new?styleId=${r.styleId}`))
  if (state.tab === 'sales') {
    const selected = defaultStyleSalesContent(r, state.salesLanguage as SalesBaseContent['language'])
    return panel('商品描述与尺码资料', `<div class="mb-5 flex flex-wrap items-center justify-between gap-3"><div class="w-48">${select('salesLanguage', state.salesLanguage, [['zh', '中文'], ['en', '英语'], ['id', '印尼语'], ['ms', '马来语']])}</div>${link('编辑描述与尺码资料', `${STYLE_PATH}/${r.styleId}/edit?tab=sales`)}</div>${grid([['销售标题', selected.title], ['卖点', selected.sellingPoints], ['内容版本', selected.version || '默认内容']])}<h3 class="mb-3 mt-6 font-medium">商品描述</h3>${renderStyleContent(selected.description)}<h3 class="mb-3 mt-6 font-medium">工厂做货尺码表</h3>${renderStyleContent(r.factorySizeChartHtml || '')}<div class="mt-5 flex flex-wrap items-center gap-3">${selected.sizeChartUrl ? photo(selected.sizeChartUrl, `${r.styleName} 尺码表图片`, true) : '<span class="text-sm text-slate-400">尚未生成或上传尺码表图片</span>'}${selected.imageUrls.map(url => photo(url, r.styleName, true)).join('')}</div><p class="mt-5 text-xs text-slate-500">关联渠道商品 ${listChannelListingsByStyleId(r.styleId).length} 个；渠道独立覆盖的内容继续保留。</p>`)
  }
  if (state.tab === 'relations') return substitutionView(r) + panel('同款与组合', grid([['交付方式', deliveryLabels[r.deliveryMode || 'SINGLE']]]) + table(['同款编码', '名称', '品牌'], (r.sameStyleIds || []).map(id => getStyleArchiveById(id)).filter((x): x is StyleArchiveShellRecord => !!x).map(s => [link(s.styleCode, `${STYLE_PATH}/${s.styleId}`), e(s.styleName), e(s.brandName)])) + `<div class="mt-4 text-sm text-slate-500">${r.deliveryMode === 'VIRTUAL_BUNDLE' ? '每个组合规格分别维护组件与组成版本。' : r.deliveryMode === 'PHYSICAL_SET' ? '固定实物套装以套作为交付单位。' : '同款关联保留各自的款式和规格身份。'}</div>`, link('编辑关系', `${STYLE_PATH}/${r.styleId}/edit?tab=relations`))
  return panel('基本资料', grid([['款式编码', r.styleCode], ['款式名称', r.styleName], ['英文名称', r.styleNameEn], ['款号', r.styleNumber], ['品牌', r.brandName], ['正式类目', [r.categoryName, r.subCategoryName, r.thirdCategoryName].filter(Boolean).join(' / ')], ['品类', r.categoryTags], ['风格', r.styleTags], ['品类编号', `${r.categoryCode || ''} ${r.categoryCodeName || ''}`], ['商品定位', r.productPosition], ['流行元素', r.popularElementTags], ['营销面料', r.fabricTags], ['特殊工艺标签', configOptions('specialCrafts', r.productConfigRefs?.specialCrafts).filter(([id]) => r.productConfigRefs?.specialCrafts?.includes(id)).map(([, label]) => label)], ['材质类型', r.materialType], ['人群', r.targetAudienceTags], ['年龄', r.ageTags], ['人群定位', r.audiencePositionTags], ['年份 / 季节', [r.yearTag, ...(r.seasonTags || [])].join(' / ')], ['买手 / 资料责任人', r.buyerName], ['交付方式', deliveryLabels[r.deliveryMode || 'SINGLE']], ['备注', r.remark]]) + `<div class="mt-5 flex flex-wrap gap-3">${(r.galleryImageUrls || []).map((u, i) => `<figure>${photo(u, `${r.styleName} ${r.galleryImagePurposes?.[i] || '补充图'}`, true)}<figcaption class="mt-1 text-xs text-slate-500">${e(r.galleryImagePurposes?.[i] || '补充识别图')}</figcaption></figure>`).join('')}</div>`)
}
function skuBody(r: SkuArchiveRecord): string {
  if (state.tab === 'translations') return translationsPanel('sku', r, false)
  if (state.tab === 'technical') return technicalTab(r.styleId)
  if (state.tab === 'channels') return channelTab(r.skuId)
  if (state.tab === 'records') return recordTab(r)
  if (state.tab === 'packaging') return productPackagingView(r)
  return panel('规格资料', grid([['SKU', r.skuCode], ['规格名称', r.skuName], ['英文名称', r.skuNameEn], ['所属款式', r.styleCode], ['颜色', r.colorName], ['统一尺码', r.sizeName], ['花型', r.patternId || r.printName], ['交付差异', r.deliveryDifference], ['条码', r.barcode], ['条码 / 旧码别名', [...new Set([r.legacyCode, ...(r.barcodeAliases || [])].filter(Boolean))]], ['主单位', r.pricingUnit], ['交付方式', deliveryLabels[r.deliveryMode || 'SINGLE']], ['备注', r.remark]]) + (r.deliveryMode === 'VIRTUAL_BUNDLE' ? `<h3 class="mb-3 mt-6 font-semibold">组件 · 组成版本 ${r.compositionVersion || 1}</h3>${table(['组件 SKU', '规格', '每组合数量'], (r.bundleComponents || []).map(c => { const s = getSkuArchiveById(c.skuId); return [s ? link(s.skuCode, `${SKU_PATH}/${s.skuId}`) : e(c.skuId), e(s?.skuName), e(`${c.quantity} ${s?.pricingUnit || '件'}`)] }))}` : ''))
}
function renderDetail(kind: Kind, id: string): string {
  if (state.id !== id || state.view !== 'detail') state.tab = 'basic'
  state.kind = kind; state.view = 'detail'; state.id = id; state.dirty = false
  const r = kind === 'style' ? getStyleArchiveById(id) : getSkuArchiveById(id)
  if (!r) return wrap(`<div class="p-6">${link('返回列表', path())}<p class="mt-6">档案不存在，请重新读取列表。</p></div>`)
  const tabs: Array<[string, string]> = kind === 'style' ? [['basic', '基本资料'], ['translations', '多语名称'], ['sales', '商品描述与尺码'], ['skus', '规格'], ['technical', '技术引用'], ['relations', '同款与组合'], ['records', '记录']] : [['basic', '规格资料'], ['translations', '多语名称'], ['packaging', '包装物流'], ['channels', '渠道关联'], ['technical', '技术引用'], ['records', '记录']]
  return wrap(`<div class="space-y-4 p-4"><div class="flex items-center justify-between">${link('← 返回列表', path())}<span class="text-xs text-slate-400">${kind === 'style' ? '款式档案' : '规格档案'}</span></div><div data-product-notice>${notice()}</div><header class="flex flex-wrap items-center justify-between gap-5 rounded-lg border bg-white p-5"><div class="flex min-w-0 items-center gap-4">${photo(imageOf(r), nameOf(r), true)}<div class="min-w-0"><h1 class="break-all text-xl font-semibold">${e(codeOf(r))}</h1><p class="my-2 text-sm text-slate-600">${e(nameOf(r))}</p><div class="flex gap-2">${statuses(r)}</div></div></div>${detailActions(r)}</header>${tabBar(tabs, state.tab, 'tab')}<div data-product-detail-body>${kind === 'style' ? styleBody(r as StyleArchiveShellRecord) : skuBody(r as SkuArchiveRecord)}</div></div>`)
}
export function renderPcsStyleArchiveDetailPage(id: string): string { return renderDetail('style', id) }
export function renderPcsSpecificationDetailPage(id: string): string { return renderDetail('sku', id) }
function choices(key: string, options: Array<[string, string]>, selected: string[], locked = false): string {
  const names = options.filter(([id]) => selected.includes(id)).map(([, name]) => name)
  return `<details class="rounded-md border bg-white" data-product-choice><summary class="cursor-pointer px-3 py-2 text-sm text-slate-600"><span data-product-choice-summary>${e(names.join('、') || '请选择，可多选')}</span></summary><div class="border-t p-3"><input type="search" class="${cls} mb-3" aria-label="搜索选项" placeholder="输入名称筛选" data-${PREFIX}-choice-search><div class="grid max-h-44 grid-cols-2 gap-3 overflow-auto">${options.map(([id, name]) => `<label class="flex items-center gap-2 text-sm" data-product-choice-option><input type="checkbox" aria-label="${e(name)}" data-${PREFIX}-field="${key}" value="${e(id)}" ${selected.includes(id) ? 'checked' : ''} ${locked ? 'disabled' : ''}><span>${e(name)}</span></label>`).join('')}</div></div></details>`
}
function multiConfig(dim: FlatDimensionId, selected: string[], locked = false): string { return choices(`ref.${dim}`, configOptions(dim, selected), selected, locked) }
function upload(key: string, url: string, name: string): string { return `<div class="flex items-center gap-3">${photo(url, name, true)}<div><input type="file" accept="image/jpeg,image/png,image/webp" data-${PREFIX}-upload="${key}" class="max-w-64 text-xs"><p class="mt-2 text-xs text-slate-500">JPG / PNG / WebP，单张不超过 10 MB</p></div></div>` }
function initEditor(kind: Kind, id = '', parentId = ''): void {
  const key = `${kind}:${id || 'new'}:${id ? '' : parentId}`
  if (state.editorKey === key && state.view === 'edit') return
  if (state.chartImageUrl) URL.revokeObjectURL(state.chartImageUrl)
  state.chartImageBlob = null; state.chartImageUrl = ''
  state.editorKey = key; state.kind = kind; state.view = 'edit'; state.id = id; state.colors = []; state.sizes = []; state.preview = []; state.pattern = ''; state.difference = ''; state.dirty = false; state.sales = null; state.chart = null; state.chartPreview = ''; state.richSources.clear(); state.salesLanguage = 'id'
  state.editorTab = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('tab') || 'identity' : 'identity'
  if (kind === 'style') state.styleDraft = id ? structuredClone(getStyleArchiveById(id) || { styleName: '' }) : { styleName: '', styleCode: '', styleNameEn: '', styleNumber: '', deliveryMode: 'SINGLE', materialType: '非毛织', mainImageUrl: '', galleryImageUrls: [], productConfigRefs: {}, seasonTags: [], sameStyleIds: [] }
  else state.skuDraft = id ? structuredClone(getSkuArchiveById(id) || {}) : { styleId: parentId, deliveryMode: getStyleArchiveById(parentId)?.deliveryMode || 'SINGLE', bundleComponents: [] }
}
function salesDraft(): SalesBaseContent {
  if (!state.sales) state.sales = defaultStyleSalesContent(state.styleDraft, state.salesLanguage as SalesBaseContent['language'])
  return state.sales
}
function chartDraft(): StyleSizeChartDraft {
  if (!state.chart) state.chart = createStyleSizeChart(state.styleDraft, state.id ? listSkuArchivesByStyleId(state.id).map(sku => sku.sizeName).filter(Boolean) : state.preview.map(sku => sku.sizeName))
  return state.chart
}
function generatePanel(style: StyleArchiveShellRecord | null): string {
  return panel(state.kind === 'sku' ? '选择新增规格' : '选择首批规格', `<div class="grid gap-5 md:grid-cols-2">${field('颜色', multiChoice('color', configOptions('colors'), state.colors))}${field('尺码', multiChoice('size', configOptions('sizes'), state.sizes))}${field('花型编号（构成交付差异时）', patternChoice('generate.pattern', state.pattern))}${field('其他交付差异', input('generate.difference', state.difference), '同色同尺仅在实物交付有差异时增加；营销标题不构成新规格。')}</div><div class="my-5 flex gap-2">${btn('生成规格预览', 'preview', '', true)}${state.preview.length ? `<span class="self-center text-sm text-slate-500">${state.preview.length} 条，保存后建立草稿</span>` : ''}</div>${table(['SKU 预览', '颜色', '尺码', '实物差异'], state.preview.map(s => [e(s.skuCode), e(s.colorName), e(s.sizeName), e(s.deliveryDifference || s.patternId || '—')]))}${style?.deliveryMode === 'VIRTUAL_BUNDLE' ? '<p class="mt-4 text-sm text-amber-700">请先为每条组合规格选择至少两条组件，再保存。</p>' + bundleEditor(state.skuDraft.bundleComponents || []) : ''}`)
}
function multiChoice(type: string, options: Array<[string, string]>, selected: string[]): string { return choices(`generate.${type}`, options, selected) }
function bundleEditor(components: Array<{ skuId: string; quantity: number }>): string {
  const options: Array<[string, string]> = listSkuArchives().filter(s => s.skuId !== state.id && s.deliveryMode !== 'VIRTUAL_BUNDLE').map(s => [s.skuId, `${s.skuCode} · ${s.colorName}/${s.sizeName}`])
  return `<div class="space-y-3">${components.map((c, i) => `<div class="grid grid-cols-[1fr_100px_60px] gap-3">${select(`component.${i}.skuId`, c.skuId, options)}${input(`component.${i}.quantity`, c.quantity, 'number')}${btn('移除', 'remove-component', `data-index="${i}"`)}</div>`).join('')}${btn('添加组件', 'add-component')}</div>`
}
function styleEditorBody(): string {
  const d = state.styleDraft, locked = d.approvalStatus === 'APPROVED'
  if (state.editorTab === 'attributes') {
    const singles: FlatDimensionId[] = ['brands', 'categoryNumbers', 'productPositioning']
    const buyers: Array<[string, string]> = getProjectCreateCatalog().owners.map(o => [o.id, o.name])
    if (d.buyerId && !buyers.some(([id]) => id === d.buyerId)) buyers.push([d.buyerId, d.buyerName || d.buyerId])
    return panel('分类与属性', `<div class="grid gap-5 md:grid-cols-2">${singles.map(dim => field(FLAT_DIMENSION_META.find(o => o.id === dim)!.name, select(`ref.${dim}`, d.productConfigRefs?.[dim]?.[0], configOptions(dim, d.productConfigRefs?.[dim]), '请选择'))).join('')}${field('正式类目', select('style.productCategoryId', d.productCategoryId, leafOptions()))}${field('材质类型', select('style.materialType', d.materialType, [['毛织', '毛织'], ['非毛织', '非毛织']]))}${field('年份', input('style.yearTag', d.yearTag, 'number'))}${field('季节', choices('season', [...new Set([...getProjectCreateCatalog().seasonTags, ...(d.seasonTags || [])])].map(name => [name, name]), d.seasonTags || []))}${field('买手 / 资料责任人', select('style.buyerId', d.buyerId, buyers, d.buyerName && !d.buyerId ? `${d.buyerName}（原资料，未核实人员）` : '请选择人员'))}</div><div class="mt-6 grid gap-5 md:grid-cols-2">${(['categories', 'styles', 'trendElements', 'fabrics', 'specialCrafts', 'crowds', 'ages', 'crowdPositioning'] as FlatDimensionId[]).map(dim => field(FLAT_DIMENSION_META.find(o => o.id === dim)!.name, multiConfig(dim, d.productConfigRefs?.[dim] || []))).join('')}</div>`)
  }
  if (state.editorTab === 'skus') return state.id ? panel('规格维护', `<p class="mb-4 text-sm text-slate-500">每条规格独立维护。后续新增规格独立提交审核。</p>${link('进入规格清单', `${SKU_PATH}?styleId=${state.id}`)}<span class="mx-3">·</span>${link('新增规格', `${SKU_PATH}/new?styleId=${state.id}`)}`) : generatePanel({ ...d, styleId: 'draft', styleCode: d.styleCode || '待生成SPU', mainImageUrl: d.mainImageUrl || '' } as StyleArchiveShellRecord)
  if (state.editorTab === 'sales') {
    const s = salesDraft()
    return panel('商品描述与尺码资料', `<div class="mb-5 flex items-center gap-3">${photo(d.mainImageUrl || '', d.styleName, true)}<div><p class="font-medium">${e(d.styleCode || '新款式')}</p><p class="mt-1 text-sm text-slate-500">${e(d.styleName)}</p></div></div><div class="mb-5 w-48">${field('语言', select('salesLanguage', s.language, [['zh', '中文'], ['en', '英语'], ['id', '印尼语'], ['ms', '马来语']]))}</div><div class="space-y-5">${field('销售标题', input('sales.title', s.title))}${field('卖点', textarea('sales.sellingPoints', s.sellingPoints))}${renderStyleRichEditor('商品描述', 'sales.description', s.description, state.richSources.has('sales.description'))}${btn('恢复默认商品描述', 'description-default')}<fieldset class="flex flex-wrap items-center gap-3 text-sm"><legend class="mb-2 font-medium">更多国家设置</legend>${['ID','MY','PH','VN'].map(country => `<label class="flex items-center gap-1"><input type="checkbox" value="${country}" data-${PREFIX}-field="countryEnabled" ${(d.salesCountrySettings || []).includes(country) ? 'checked' : ''}>${country}</label>`).join('')}</fieldset>${(d.salesCountrySettings || []).map(country=>renderStyleRichEditor(`商品描述_${country}`,`country.${country}`,d.salesCountryDescriptions?.[country] || s.description,state.richSources.has(`country.${country}`))).join('')}${renderStyleRichEditor('工厂做货尺码表', 'style.factorySizeChartHtml', d.factorySizeChartHtml || '', state.richSources.has('style.factorySizeChartHtml'))}<p class="text-xs text-slate-500">修改尺码后，请用下方尺码表生成工具重新生成，或重新上传尺码图片。</p><div class="flex flex-wrap items-center gap-3">${field('重新上传尺码图片', '<input type="file" accept="image/jpeg,image/png,image/webp" data-pcs-product-archive-upload="sizeChart" class="max-w-64 text-sm">')}${s.sizeChartUrl ? photo(s.sizeChartUrl, `${d.styleName} 尺码表图片`, true) + btn('查看尺码表图片', 'image', `data-url="${e(s.sizeChartUrl)}" data-name="${e(d.styleName)} 尺码表图片"`) : '<span class="text-sm text-slate-400">尚未生成或上传尺码表图片</span>'}</div><details class="rounded-md border p-3"><summary class="cursor-pointer text-sm text-slate-600">其他销售素材</summary><div class="mt-4 space-y-5">${field('尺码图引用', input('sales.sizeChartUrl', s.sizeChartUrl))}${field('图片地址（每行一条）', textarea('sales.imageUrls', s.imageUrls.join('\n')))}${field('视频地址（每行一条）', textarea('sales.videoUrls', s.videoUrls.join('\n')))}</div></details></div><p class="mt-5 text-xs text-slate-500">${state.id ? `关联 ${listChannelListingsByStyleId(state.id).filter(l => l.platformStatus === '在售').length} 个在售链接、${listChannelListingsByStyleId(state.id).filter(l => l.reviewStatus === '草稿').length} 个渠道草稿。` : ''}保存基础内容后，店铺已覆盖的内容保持其经营版本；发布操作在渠道商品中完成。</p>`) + `<div class="mt-4">${renderStyleSizeChartTool(chartDraft(), state.chartPreview, state.chartImageUrl, d.salesCountrySettings || [])}</div>`
  }
  if (state.editorTab === 'relations') return substitutionEditor(d) + '<div class="mt-4"></div>' + panel('同款与交付方式', `<div class="max-w-md">${field('交付方式', select('style.deliveryMode', d.deliveryMode, Object.entries(deliveryLabels), '请选择', locked), locked ? '审核后交付方式锁定；交付定义改变请新建款式。' : '')}</div><div class="mt-5">${field('关联同款', multiChoice('sameStyle', listStyleArchives().filter(s => s.styleId !== state.id).map(s => [s.styleId, `${s.styleCode} · ${s.brandName}`]), d.sameStyleIds || []))}</div>`)
  return panel('身份与图片', `<div class="grid gap-5 md:grid-cols-2">${field('款式名称 *', input('style.styleName', d.styleName))}${field('款式编码', input('style.styleCode', d.styleCode, 'text', locked, '留空按 SPU-年份-流水号生成'), locked ? '审核通过后编码锁定。' : '可使用已存在的来源编码；新编码必须唯一。')}${field('款号', input('style.styleNumber', d.styleNumber))}${field('交付方式', select('style.deliveryMode', d.deliveryMode, Object.entries(deliveryLabels), '请选择', locked))}</div><div class="mt-6 grid gap-6 md:grid-cols-2">${field('主识别图', upload('styleMain', d.mainImageUrl || '', d.styleName))}${field('补充图片', `<input type="file" multiple accept="image/jpeg,image/png,image/webp" data-${PREFIX}-upload="styleGallery" class="text-sm"><div class="mt-3 flex flex-wrap gap-2">${(d.galleryImageUrls || []).map((u, i) => `<div class="flex items-center gap-2">${photo(u, d.styleName)}${select(`gallery.${i}`, d.galleryImagePurposes?.[i] || '补充识别图', ['补充识别图', '正面', '背面', '细节', '包装'].map(v => [v, v]))}${btn('前移', 'gallery-up', `data-index="${i}" ${i === 0 ? 'disabled' : ''}`)}${btn('移除', 'gallery-remove', `data-index="${i}"`)}</div>`).join('')}</div>`)}</div><div class="mt-6">${field('备注', textarea('style.remark', d.remark))}</div>`)
}
function substitutionView(r: StyleArchiveShellRecord): string {
  return panel('替代关系', table(['目标', '适用条件', '版本'], (r.substitutionRelations || []).map(row => [e(row.targetKind === 'PRODUCT_SKU' ? getSkuArchiveById(row.targetId)?.skuCode || row.targetId : listAllMaterialSkuRecords().find(s => s.materialSkuId === row.targetId)?.materialSkuCode || row.targetId), e(row.conditions), e(row.version)])))
}
function substitutionEditor(d: ProductStyleDraft): string {
  return panel('有条件替代', `<p class="mb-4 text-sm text-slate-500">同款不自动视为替代。每条替代关系单独维护适用条件和版本。</p>${(d.substitutionRelations || []).map((row, i) => `<div class="mb-4 grid gap-3 rounded border p-4 md:grid-cols-2">${field('目标类型', select(`substitute.${i}.targetKind`, row.targetKind, [['PRODUCT_SKU', '商品规格'], ['MATERIAL_SKU', '物料规格']]))}${field('目标', select(`substitute.${i}.targetId`, row.targetId, row.targetKind === 'PRODUCT_SKU' ? listSkuArchives().map(s => [s.skuId, s.skuCode]) : listAllMaterialSkuRecords().map(s => [s.materialSkuId, s.materialSkuCode])))}${field('适用条件', textarea(`substitute.${i}.conditions`, row.conditions))}${field('版本', input(`substitute.${i}.version`, row.version, 'number'))}${btn('移除关系', 'remove-substitute', `data-index="${i}"`)}</div>`).join('')}${btn('添加替代关系', 'add-substitute')}`)
}
function patternChoice(key: string, value: string, locked = false, legacy = ''): string {
  const options: Array<[string, string]> = listMaterialPatternChoices().map(p => [p.id, `${p.pattern_code} · ${p.pattern_name}`])
  return select(key, value, options, legacy ? `${legacy}（原花型编号）` : '无花型差异', locked)
}
function productPackagingView(record: SkuArchiveRecord): string {
  const rows = productPackages(record)
  const data = (p: typeof rows[number]) => [e(`${p.packageTypeId} · v${p.version} · ${p.status === 'ACTIVE' ? '启用' : '停用'}`), e(`${p.contentQty} ${p.contentUnitId}`), e(p.grossWeightKg ?? '—'), e([p.lengthCm, p.widthCm, p.heightCm].map(v => v ?? '—').join(' × ')), e(p.volumeM3 ?? '—'), e(p.measurementBasis)]
  return panel('包装物流', grid([['主计量单位', record.pricingUnit], ['每主单位净重 KG', record.weightKg], ['包装说明', record.packagingInfo]]) + `<div class="mt-5">${table(['包装 / 版本', '标准含量', '毛重 KG', '长 × 宽 × 高 cm', '体积 m³（尺寸计算）', '测量基准'], rows.map(data))}</div>` + (record.packageSpecHistory?.length ? `<details class="mt-5"><summary class="cursor-pointer text-sm">历史包装版本 ${record.packageSpecHistory.length} 条</summary>${table(['包装 / 版本', '标准含量', '毛重 KG', '长 × 宽 × 高 cm', '体积 m³', '测量基准'], record.packageSpecHistory.map(data))}</details>` : ''))
}
function productPackagingEditor(d: Partial<SkuArchiveRecord>): string {
  const rows = d.packageSpecs || productPackages(d)
  return panel('包装物流', `<div class="grid gap-5 md:grid-cols-2">${field('主计量单位', select('sku.mainUnitId', d.mainUnitId || resolveProductMainUnit(d.pricingUnit)?.id, listMaterialUnitDefinitions().filter(unit => unit.enabled || unit.id === d.mainUnitId).map(unit => [unit.id, `${unit.label}（${unit.code}）`]), '请选择主单位', d.approvalStatus === 'APPROVED'))}${field('每主单位净重 KG', input('sku.weightKg', d.weightKg, 'number'))}</div><div class="mt-5 space-y-3">${rows.map((p, i) => `<details class="rounded-lg border" ${i === 0 ? 'open' : ''}><summary class="cursor-pointer bg-slate-50 px-4 py-3 text-sm font-medium">${e(p.packageTypeId)} · ${e(p.contentQty)} ${e(p.contentUnitId)} · v${p.version}</summary><div class="grid gap-4 p-4 md:grid-cols-3">${field('包装类型', select(`package.${i}.packageTypeId`, p.packageTypeId, ['包', '箱', '卷', '筒', '瓶', '件', '套'].map(v => [v, v])))}${field('标准包装含量', input(`package.${i}.contentQty`, p.contentQty, 'number'))}${field('含量单位', input(`package.${i}.contentUnitId`, p.contentUnitId, 'text', true))}${field('包装毛重 KG', input(`package.${i}.grossWeightKg`, p.grossWeightKg, 'number'))}${field('包装长 cm', input(`package.${i}.lengthCm`, p.lengthCm, 'number'))}${field('包装宽 cm', input(`package.${i}.widthCm`, p.widthCm, 'number'))}${field('包装高 cm', input(`package.${i}.heightCm`, p.heightCm, 'number'))}${field('测量基准', input(`package.${i}.measurementBasis`, p.measurementBasis))}${field('状态', select(`package.${i}.status`, p.status, [['ACTIVE', '启用'], ['INACTIVE', '停用']]))}</div></details>`).join('')}${btn('添加包装规格', 'add-package')}</div><p class="my-4 text-xs text-slate-500">体积按长、宽、高计算；未知尺寸留空。保存变更形成新包装版本，保留原版本。</p>${field('包装说明', textarea('sku.packagingInfo', d.packagingInfo))}`)
}
function skuEditorBody(): string {
  const d = state.skuDraft, parent = getStyleArchiveById(d.styleId || ''), locked = d.approvalStatus === 'APPROVED'
  if (!state.id) return panel('所属款式', field('款式 *', select('sku.styleId', d.styleId, listStyleArchives().filter(s => s.lifecycleStatus !== 'ARCHIVED').map(s => [s.styleId, `${s.styleCode} · ${s.styleName}`])))) + (parent ? `<div class="mt-4">${generatePanel(parent)}</div>` : '')
  if (state.editorTab === 'packaging') return productPackagingEditor(d)
  if (state.editorTab === 'components') return panel('组合组件', locked ? table(['组件', '每组合数量'], (d.bundleComponents || []).map(c => [e(getSkuArchiveById(c.skuId)?.skuCode || c.skuId), e(c.quantity)])) + '<p class="mt-4 text-sm text-slate-500">已审核组成不可替换，请复制为新的交付规格。</p>' : bundleEditor(d.bundleComponents || []))
  return panel('规格资料', `<div class="mb-5 text-sm">所属款式：${parent ? link(parent.styleCode, `${STYLE_PATH}/${parent.styleId}`) : e(d.styleCode)}</div><div class="grid gap-5 md:grid-cols-2">${field('SKU 编码', input('sku.skuCode', d.skuCode, 'text', locked))}${field('规格名称', input('sku.skuName', d.skuName))}${field('颜色', select('sku.colorId', d.colorId, configOptions('colors', [d.colorId || '']), d.colorName || '请选择', locked))}${field('尺码', select('sku.sizeId', d.sizeId, configOptions('sizes', [d.sizeId || '']), d.sizeName || '请选择', locked))}${field('花型编号', patternChoice('sku.patternIdentityId', d.patternIdentityId || '', locked, d.patternId || d.printName))}${field('交付差异', input('sku.deliveryDifference', d.deliveryDifference, 'text', locked))}${field('条码', input('sku.barcode', d.barcode))}${field('条码 / 旧码别名', textarea('sku.barcodeAliases', (d.barcodeAliases || []).join('\n')), '每行一个识别码；不能关联其他 SKU。')}</div><div class="mt-6">${field('识别图', upload('skuMain', d.skuImageUrl || '', d.skuName || '规格图'))}</div><div class="mt-5">${field('备注', textarea('sku.remark', d.remark))}</div>`)
}
function renderEditor(kind: Kind, id = '', parentId = ''): string {
  initEditor(kind, id, parentId)
  const tabs: Array<[string, string]> = kind === 'style' ? [['identity', '身份与图片'], ['translations', '多语名称'], ['attributes', '分类与属性'], ['skus', '规格'], ['sales', '商品描述与尺码'], ['relations', '同款与组合']] : id ? [['identity', '规格资料'], ['translations', '多语名称'], ['packaging', '包装物流'], ...(state.skuDraft.deliveryMode === 'VIRTUAL_BUNDLE' ? [['components', '组合组件'] as [string, string]] : [])] : [['identity', '新增规格']]
  return wrap(`<div class="space-y-4 p-4 pb-24"><div class="flex items-center justify-between"><div><h1 class="text-xl font-semibold">${id ? '编辑' : '新增'}${kind === 'style' ? '款式' : '规格'}</h1><p data-product-edit-status class="mt-1 text-xs text-slate-500">${state.dirty ? '有未保存修改' : '保存草稿后可继续完善，再提交审核。'}</p></div>${btn('返回', 'cancel-edit')}</div><div data-product-notice>${notice()}</div>${tabBar(tabs, state.editorTab, 'editor-tab')}<div data-product-editor-body>${state.editorTab === 'translations' ? translationsPanel(kind, kind === 'style' ? state.styleDraft : state.skuDraft, true) : kind === 'style' ? styleEditorBody() : skuEditorBody()}</div>${id ? panel('修改说明', field('修改原因', input(kind === 'style' ? 'style.changeReason' : 'sku.changeReason', kind === 'style' ? state.styleDraft.changeReason : state.skuDraft.changeReason), '选填；未填时记录为资料维护。')) : ''}<footer class="sticky bottom-0 flex items-center justify-end gap-3 rounded-lg border bg-white p-4 shadow-sm">${btn('取消', 'cancel-edit')}${btn(state.saving ? '保存中…' : '保存草稿', 'save', state.saving ? 'disabled' : '', true)}</footer></div>`)
}
export function renderPcsStyleArchiveEditPage(id?: string): string { return renderEditor('style', id) }
export function renderPcsSpecificationEditPage(id?: string, parentId?: string): string { return renderEditor('sku', id, parentId || (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('styleId') || '' : '')) }
function overlays(): string {
  if (state.image) return `<div class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-8" role="dialog" aria-modal="true" aria-label="图片预览"><button class="absolute inset-0" data-${PREFIX}-action="close-image-preview" aria-label="关闭预览"></button><div class="relative flex max-h-full max-w-full flex-col items-center gap-3"><img src="${e(state.image)}" alt="${e(state.imageName)}" class="max-h-[80vh] max-w-[85vw] rounded object-contain"><p class="text-white">${e(state.imageName)}</p>${btn('关闭 Esc', 'close-image-preview')}</div></div>`
  if (state.columnsOpen) return renderStandardListColumnSettings({ title: '显示列与固定列', columns: columns(), preferences: preferences(), eventPrefix: PREFIX, maxFrozenWidth: 450, skipPageRerender: true })
  if (state.importOpen) return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-5" role="dialog" aria-modal="true" aria-label="导入商品规格"><section class="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-lg bg-white p-6"><div class="mb-4 flex justify-between"><h2 class="text-lg font-semibold">导入规格</h2>${btn('关闭', 'close-drawers')}</div>${field('所属款式', select('importStyle', state.skuDraft.styleId, listStyleArchives().map(s => [s.styleId, s.styleCode])))}<p class="my-4 text-sm text-slate-500">CSV 列：SKU编码,颜色名称,尺码,图片地址,花型编号,交付差异。首行为标题；先校验预览，有错误时不会写入。</p>${field('CSV 文件', '<input type="file" accept=".csv,text/csv" data-pcs-product-archive-upload="import" class="text-sm">')}${textarea('importText', state.importText)}<div class="my-4 flex gap-3">${btn('校验预览', 'import-preview', '', true)}${btn('确认导入', 'import-confirm', state.importRows.length && !state.importErrors.length ? '' : 'disabled')}</div>${state.importErrors.map(m => `<p class="text-sm text-red-600">${e(m)}</p>`).join('')}${table(['行', 'SKU', '颜色', '尺码'], state.importRows.slice(0, 100).map((r, i) => [e(i + 2), e(r.skuCode), e(configOptions('colors').find(([id]) => id === r.colorId)?.[1]), e(configOptions('sizes').find(([id]) => id === r.sizeId)?.[1])]))}<p class="mt-3 text-xs text-slate-500">已校验 ${state.importRows.length} 条，预览最多展示 100 条。</p></section></div>`
  return ''
}
function rerender(): void {
  const root = document.querySelector<HTMLElement>('[data-pcs-product-archive-root]'); if (!root) return
  const scroll = root.parentElement?.scrollTop || 0
  const html = state.view === 'list' ? renderList(state.kind) : state.view === 'detail' ? renderDetail(state.kind, state.id) : renderEditor(state.kind, state.id, state.kind === 'sku' ? state.skuDraft.styleId : '')
  root.outerHTML = html
  const next = document.querySelector<HTMLElement>('[data-pcs-product-archive-root]'); if (next) { hydrateIcons(next); if (next.parentElement) next.parentElement.scrollTop = scroll }
}
function refreshEditorBody(): void {
  const body = document.querySelector<HTMLElement>('[data-product-editor-body]'); if (!body) return
  body.innerHTML = state.editorTab === 'translations' ? translationsPanel(state.kind, state.kind === 'style' ? state.styleDraft : state.skuDraft, true) : state.kind === 'style' ? styleEditorBody() : skuEditorBody()
  hydrateIcons(body)
}
function refreshArchiveNotice(): void {
  const current = document.querySelector<HTMLElement>('[data-product-notice]'); if (current) current.innerHTML = notice()
  const status = document.querySelector('[data-product-edit-status]'); if (status) status.textContent = state.dirty ? '有未保存修改' : '保存草稿后可继续完善，再提交审核。'
}
function refreshDetailBody(): void {
  const body = document.querySelector<HTMLElement>('[data-product-detail-body]'), record = state.kind === 'style' ? getStyleArchiveById(state.id) : getSkuArchiveById(state.id)
  if (body && record) { body.innerHTML = state.kind === 'style' ? styleBody(record as StyleArchiveShellRecord) : skuBody(record as SkuArchiveRecord); hydrateIcons(body) }
}
function refreshArchiveTabs(action: string): void {
  for (const tab of document.querySelectorAll<HTMLElement>(`[data-${PREFIX}-action="${action}"]`)) {
    const selected = tab.dataset.tab === (action === 'editor-tab' ? state.editorTab : state.tab)
    tab.setAttribute('aria-selected', String(selected)); tab.classList.toggle('border-blue-600', selected); tab.classList.toggle('font-semibold', selected); tab.classList.toggle('text-blue-600', selected); tab.classList.toggle('border-transparent', !selected); tab.classList.toggle('text-slate-500', !selected)
  }
}
function releaseUnusedChartFile(url: string): void {
  const retained = { ...state.styleDraft, salesContents: state.styleDraft.salesContents?.filter(content => content.language !== state.sales?.language) }
  if (!url || JSON.stringify([retained, state.sales]).includes(url)) return
  const id = getPcsDurableFileReference(url).replace(/^pcs-file:/, '')
  if (state.pendingFileIds.includes(id)) { releasePcsPendingFile(id); state.pendingFileIds = state.pendingFileIds.filter(item => item !== id) }
}
function go(href: string, title: string): void { state.dirty = false; appStore.openTab({ key: href.split('?')[0], title, href, closable: true }) }
function fail(error: unknown): void { state.notice = error instanceof Error ? `${error.message} 当前输入仍保留，尚未保存。` : '操作未保存，请重试。'; state.error = true }
async function save(): Promise<void> {
  if (state.saving) return
  state.saving = true; state.notice = ''; const operationId = crypto.randomUUID()
  try {
    let savedId = state.id
    await runPcsRecordCommand(() => {
      if (state.kind === 'style') {
        const contents = [...(state.styleDraft.salesContents || []).filter(s => s.language !== state.sales?.language), ...(state.sales ? [state.sales] : [])]
        const { salesContents: _contents, ...fields } = state.styleDraft
        const draft = { ...fields, initialSkus: state.id ? undefined : state.preview.map(s => ({ colorId: s.colorId!, sizeId: s.sizeId!, imageUrl: s.skuImageUrl, patternId: s.patternId, patternIdentityId: s.patternIdentityId, deliveryDifference: s.deliveryDifference, bundleComponents: state.skuDraft.bundleComponents })) }
        const result = saveProductStyleDraft(draft, state.id || undefined); savedId = result.styleId
        for (const content of contents) if (JSON.stringify(result.salesContents?.find(s => s.language === content.language)) !== JSON.stringify(content)) saveProductSalesContent(savedId, content)
      } else if (state.id) saveProductSkuDraft(state.id, state.skuDraft)
      else {
        const parent = getStyleArchiveById(state.skuDraft.styleId || ''); if (!parent) throw new Error('请选择所属款式。')
        if (!state.preview.length) throw new Error('先选择颜色和尺码，生成规格预览。')
        const result = createSkuArchiveBatch(state.preview.map(s => ({ ...s, bundleComponents: state.skuDraft.bundleComponents, compositionVersion: parent.deliveryMode === 'VIRTUAL_BUNDLE' ? 1 : undefined })))
        savedId = state.preview[0].skuId
      }
    }, operationId)
    state.notice = '已保存'; state.error = false; state.dirty = false; state.editorKey = ''; state.pendingFileIds = []
    go(`${path()}/${savedId}`, state.kind === 'style' ? '款式详情' : '规格详情')
  } catch (error) { fail(error) } finally { state.saving = false; refreshArchiveNotice() }
}
export async function handlePcsProductArchiveInput(target: HTMLElement): Promise<boolean> {
  if (state.saving) return true
  const rich = target.closest<HTMLElement>('[data-style-rich-editor]')
  if (rich) { const key = rich.dataset.styleRichEditor!; if (key === 'sales.description') salesDraft().description = styleContentHtml(rich.innerHTML); else if (key.startsWith('country.')) { state.styleDraft.salesCountryDescriptions ||= {}; state.styleDraft.salesCountryDescriptions[key.slice(8)] = styleContentHtml(rich.innerHTML) } else state.styleDraft.factorySizeChartHtml = styleContentHtml(rich.innerHTML); state.dirty = true; refreshArchiveNotice(); return true }
  const choiceSearch = target.closest<HTMLInputElement>(`[data-${PREFIX}-choice-search]`)
  if (choiceSearch) {
    choiceSearch.closest('[data-product-choice]')?.querySelectorAll<HTMLElement>('[data-product-choice-option]').forEach(option => { option.hidden = !(option.textContent || '').toLowerCase().includes(choiceSearch.value.trim().toLowerCase()) })
    return true
  }
  const uploadNode = target.closest<HTMLInputElement>(`[data-${PREFIX}-upload]`)
  if (uploadNode) {
    try {
      const key = uploadNode.dataset.pcsProductArchiveUpload!, files = Array.from(uploadNode.files || [])
      if (!files.length) return true
      state.notice = ''; state.error = false
      if (key === 'import') { state.importText = await files[0].text(); state.importRows = []; state.importErrors = []; rerender(); return true }
      for (const file of files) if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('请选择不超过 10 MB 的 JPG、PNG 或 WebP 图片。')
      if (key === 'sizeChart') { try { const bitmap = await createImageBitmap(files[0]); bitmap.close() } catch { throw new Error('所选尺码图片无法读取，请更换有效图片后重新上传。') } }
      const refs = files.map(f => registerPcsFile(f)); state.pendingFileIds.push(...refs.map(f => f.fileId))
      if (key === 'styleMain') { state.styleDraft.mainImageId = refs[0].fileId; state.styleDraft.mainImageUrl = refs[0].url }
      else if (key === 'styleGallery') { state.styleDraft.galleryImagePurposes = [...(state.styleDraft.galleryImageUrls || []).map((_, i) => state.styleDraft.galleryImagePurposes?.[i] || '补充识别图'), ...refs.map(() => '补充识别图')]; state.styleDraft.galleryImageIds = [...(state.styleDraft.galleryImageIds || []), ...refs.map(f => f.fileId)]; state.styleDraft.galleryImageUrls = [...(state.styleDraft.galleryImageUrls || []), ...refs.map(f => f.url)] }
      else if (key === 'sizeChart') { const previous = salesDraft().sizeChartUrl; salesDraft().sizeChartUrl = refs[0].url; releaseUnusedChartFile(previous) }
      else state.skuDraft.skuImageUrl = refs[0].url
      state.dirty = true; if (key === 'sizeChart') { refreshEditorBody(); refreshArchiveNotice() } else rerender()
    } catch (error) { fail(error); refreshArchiveNotice() }
    return true
  }
  const el = target.closest<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-${PREFIX}-field]`); if (!el) return false
  const key = el.dataset.pcsProductArchiveField!, value = el.value
  if (key.startsWith('rich.')) {
    const editor = document.querySelector<HTMLElement>(`[data-style-rich-editor="${el.dataset.editor}"]`)
    document.execCommand('styleWithCSS', false, 'true')
    editor?.focus(); document.execCommand(key === 'rich.justify' ? value : key.slice(5), false, key === 'rich.justify' ? '' : value); if (editor) await handlePcsProductArchiveInput(editor)
  } else if (key === 'countryEnabled') {
    const selected = new Set(state.styleDraft.salesCountrySettings || [])
    ;(el as HTMLInputElement).checked ? selected.add(value) : selected.delete(value)
    state.styleDraft.salesCountrySettings = [...selected]; state.styleDraft.salesCountryDescriptions ||= {}
    if ((el as HTMLInputElement).checked && !Object.hasOwn(state.styleDraft.salesCountryDescriptions,value)) state.styleDraft.salesCountryDescriptions[value] = salesDraft().description
    state.dirty = true; refreshEditorBody(); refreshArchiveNotice()
  } else if (key.startsWith('country.')) {
    state.styleDraft.salesCountryDescriptions ||= {}; state.styleDraft.salesCountryDescriptions[key.slice(8)] = styleContentHtml(value); state.dirty = true; refreshArchiveNotice()
  } else if (key.startsWith('chart.')) {
    const chart = chartDraft(), [, kind, row, ci] = key.split('.')
    if (kind === 'type') chart.garmentType = value as StyleSizeChartType
    else if (kind === 'value') chart.rows[Number(row)].values[Number(ci)] = value
    else if (kind === 'fit') chart.fit = value
    else if (kind === 'stretch') chart.stretch = value
    else if (kind === 'transparency') chart.transparency = value
    state.styleDraft.sizeChartDraft = structuredClone(chart); state.chartPreview = ''; state.dirty = true; refreshArchiveNotice()
    const preview = document.querySelector('[data-style-chart-preview]'); if (preview) preview.innerHTML = ''
  }
  else if (key.startsWith('filter.')) state.query[key.slice(7)] = value
  else if (key === 'pageSize') { preferences().pageSize = Number(value); state.page = 1; savePreferences(); rerender() }
  else if (key.startsWith('ref.')) {
    const dim = key.slice(4) as FlatDimensionId, refs = state.styleDraft.productConfigRefs ||= {}
    if (el instanceof HTMLInputElement && el.type === 'checkbox') { const selected = new Set(refs[dim] || []); el.checked ? selected.add(value) : selected.delete(value); refs[dim] = [...selected] }
    else refs[dim] = value ? [value] : []
    state.dirty = true
  } else if (key.startsWith('translation.')) {
    const language = key.slice(12) as 'en' | 'id' | 'ms'
    if (state.kind === 'style') { state.styleDraft.styleNameTranslations = { en: state.styleDraft.styleNameEn || '', ...state.styleDraft.styleNameTranslations, [language]: value }; if (language === 'en') state.styleDraft.styleNameEn = value }
    else { state.skuDraft.skuNameTranslations = { en: state.skuDraft.skuNameEn || '', ...state.skuDraft.skuNameTranslations, [language]: value }; if (language === 'en') state.skuDraft.skuNameEn = value }
    state.dirty = true
  } else if (key === 'season') { const selected = new Set(state.styleDraft.seasonTags || []); (el as HTMLInputElement).checked ? selected.add(value) : selected.delete(value); state.styleDraft.seasonTags = [...selected]; state.dirty = true
  } else if (key.startsWith('style.')) { const f = key.slice(6); Object.assign(state.styleDraft, { [f]: f === 'seasonTags' ? value.split(/[、,]/).filter(Boolean) : f === 'factorySizeChartHtml' ? styleContentHtml(value) : value }); state.dirty = true; refreshArchiveNotice(); if (f === 'deliveryMode') { state.preview = []; rerender() } }
  else if (key.startsWith('gallery.')) { const index = Number(key.split('.')[1]); const purposes = (state.styleDraft.galleryImageUrls || []).map((_, i) => state.styleDraft.galleryImagePurposes?.[i] || '补充识别图'); purposes[index] = value; state.styleDraft.galleryImagePurposes = purposes; state.dirty = true }
  else if (key.startsWith('package.')) { const [, index, f] = key.split('.'); state.skuDraft.packageSpecs ||= productPackages(state.skuDraft); const row = state.skuDraft.packageSpecs[Number(index)]; Object.assign(row, { [f]: ['contentQty', 'grossWeightKg', 'lengthCm', 'widthCm', 'heightCm'].includes(f) ? (value === '' ? null : Number(value)) : value }); state.dirty = true }
  else if (key.startsWith('sku.')) { const f = key.slice(4); Object.assign(state.skuDraft, { [f]: f === 'barcodeAliases' ? value.split(/\n/).map(v => v.trim()).filter(Boolean) : ['weightKg', 'packageQuantity', 'packageGrossWeightKg', 'lengthCm', 'widthCm', 'heightCm'].includes(f) ? (value === '' ? undefined : Number(value)) : value }); state.dirty = true; if (f === 'mainUnitId') { state.skuDraft.pricingUnit = resolveProductMainUnit(value)?.code || ''; state.skuDraft.packageSpecs = productPackages(state.skuDraft).map(row => ({ ...row, contentUnitId: state.skuDraft.pricingUnit || '' })); for (const unit of document.querySelectorAll<HTMLInputElement>('[data-pcs-product-archive-field$=".contentUnitId"]')) unit.value = state.skuDraft.pricingUnit || '' } if (f === 'styleId') { state.preview = []; state.editorKey = `sku:new:${value}`; rerender() } }
  else if (key.startsWith('generate.')) {
    const f = key.slice(9)
    if (['color', 'size', 'sameStyle'].includes(f)) {
      const values = new Set(f === 'color' ? state.colors : f === 'size' ? state.sizes : state.styleDraft.sameStyleIds || [])
      ;(el as HTMLInputElement).checked ? values.add(value) : values.delete(value)
      if (f === 'color') state.colors = [...values]; else if (f === 'size') state.sizes = [...values]; else state.styleDraft.sameStyleIds = [...values]
    } else if (f === 'pattern') state.pattern = value; else state.difference = value
    state.preview = []; state.dirty = true
  } else if (key === 'salesLanguage') { if (state.view === 'edit' && state.sales) state.styleDraft.salesContents = [...(state.styleDraft.salesContents || []).filter(s => s.language !== state.sales!.language), state.sales]; state.sales = null; state.salesLanguage = value; if (state.view === 'edit') refreshEditorBody(); else refreshDetailBody() }
  else if (key.startsWith('sales.')) { const f = key.slice(6); Object.assign(salesDraft(), { [f]: ['imageUrls', 'videoUrls'].includes(f) ? value.split('\n').filter(Boolean) : f === 'description' ? styleContentHtml(value) : value }); state.dirty = true; refreshArchiveNotice() }
  else if (key.startsWith('substitute.')) { const [, index, field] = key.split('.'); const row = state.styleDraft.substitutionRelations![Number(index)]; Object.assign(row, { [field]: field === 'version' ? Number(value) : value }); if (field === 'targetKind') { row.targetId = ''; rerender() } state.dirty = true }
  else if (key.startsWith('component.')) { const [, index, f] = key.split('.'); const rows = state.skuDraft.bundleComponents ||= []; Object.assign(rows[Number(index)], { [f]: f === 'quantity' ? Number(value) : value }); state.dirty = true }
  else if (key === 'importText') { state.importText = value; state.importRows = []; state.importErrors = [] }
  else if (key === 'importStyle') { state.skuDraft.styleId = value; state.importRows = []; state.importErrors = [] }
  const choice = el.closest('[data-product-choice]'), summary = choice?.querySelector('[data-product-choice-summary]')
  if (choice && summary) summary.textContent = [...choice.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')].map(c => c.getAttribute('aria-label')).join('、') || '请选择，可多选'
  return true
}
function csvValues(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) { const ch = text[i]; if (ch === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++ } else quoted = !quoted } else if (ch === ',' && !quoted) { row.push(cell); cell = '' } else if (ch === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); if (row.some(Boolean)) rows.push(row); row = []; cell = '' } else cell += ch }
  if (quoted) throw new Error('CSV 引号未闭合。'); row.push(cell.replace(/\r$/, '')); if (row.some(Boolean)) rows.push(row)
  return rows
}
function importPreview(): void {
  state.importRows = []; state.importErrors = []
  const parent = getStyleArchiveById(state.skuDraft.styleId || ''); if (!parent) throw new Error('请选择导入规格所属款式。')
  const rows = csvValues(state.importText.replace(/^\uFEFF/, '')); if (!rows.length) throw new Error('请选择 CSV 文件或粘贴内容。')
  const colors = listConfigDimensionOptions('colors'), sizes = listConfigDimensionOptions('sizes')
  if (/SKU|编码/i.test(rows[0][0])) rows.shift()
  if (rows.length > 1000) throw new Error('每次最多导入 1000 条规格。')
  rows.forEach((r, i) => {
    const color = colors.find(c => [c.code, c.name_zh, c.name_en, ...(c.aliases || [])].some(n => n?.toLowerCase() === r[1]?.trim().toLowerCase()) && c.status === 'ENABLED')
    const size = sizes.find(s => [s.code, s.name_zh, s.name_en, ...(s.aliases || [])].some(n => n?.toLowerCase() === r[2]?.trim().toLowerCase()) && s.status === 'ENABLED')
    if (!color || !size) state.importErrors.push(`第 ${i + 2} 行：颜色或尺码不在启用字典中。`)
    else state.importRows.push({ skuCode: r[0]?.trim(), colorId: color.id, sizeId: size.id, imageUrl: r[3]?.trim() || parent.mainImageUrl, patternId: r[4]?.trim(), deliveryDifference: r[5]?.trim() })
  })
  if (!state.importErrors.length) { try { previewProductSkus(parent, state.importRows) } catch (error) { state.importErrors.push(error instanceof Error ? error.message : '规格有重复，请核查。') } }
}
function exportList(): void {
  const cols = columns().filter(c => !c.actionColumn && !c.leadingControlColumn && preferences().visibleKeys.includes(c.key))
  const fields = cols.flatMap(c => c.key === 'designAttributes' || c.key === 'audienceAttributes'
    ? styleAttributeLines({} as StyleArchiveShellRecord, c.key).map(([title], index) => ({ title, value: (r: Row) => styleAttributeLines(r as StyleArchiveShellRecord, c.key as 'designAttributes' | 'audienceAttributes')[index][1] }))
    : [{ title: c.title, value: (r: Row) => c.key === 'identity' ? `${codeOf(r)} ${nameOf(r)}` : c.key === 'approval' ? approvalLabels[r.approvalStatus || 'DRAFT'] : c.key === 'lifecycle' ? lifecycleLabels[r.lifecycleStatus || 'NOT_ENABLED'] : c.sortValue?.(r) ?? '' }]).filter((field, index, all) => all.findIndex(other => other.title === field.title) === index)
  const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = filteredRows(), data = [fields.map(c => csv(c.title)).join(','), ...rows.map(r => fields.map(c => csv(c.value(r))).join(','))].join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', data], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a'); a.href = url; a.download = `${state.kind === 'style' ? '款式档案' : '规格档案'}.csv`; a.click(); URL.revokeObjectURL(url)
  state.notice = `已导出当前筛选的全部 ${rows.length} 条记录。`; state.error = false
}
export async function handlePcsProductArchiveEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  if (event?.type === 'drop') {
    const drag = event as DragEvent & { higoodStandardListColumnKey?: string }, destination = target.closest<HTMLElement>('[data-drop-target]')?.dataset.dropTarget
    const from = drag.higoodStandardListColumnKey, order = preferences().order
    if (from && destination && from !== destination && order.includes(from) && order.includes(destination)) { order.splice(order.indexOf(from), 1); order.splice(order.indexOf(destination), 0, from); savePreferences(); rerender() }
    return true
  }
  if (event && ['dragstart', 'dragover', 'dragend'].includes(event.type)) return true
  const node = target.closest<HTMLElement>(`[data-${PREFIX}-action]`); if (!node) return false
  const action = node.dataset.pcsProductArchiveAction!
  try {
    if (action === 'save') { await save(); return true }
    if (action === 'rich-source') { const key = node.dataset.editor!; state.richSources.has(key) ? state.richSources.delete(key) : state.richSources.add(key); refreshEditorBody(); return true }
    if (action === 'description-default') {
      if (!(await confirmPcsAction('用默认文案和参考尺码表替换当前商品描述？当前修改尚未保存。'))) return true
      salesDraft().description = defaultStyleDescription(); state.dirty = true; refreshEditorBody(); refreshArchiveNotice(); return true
    }
    if (action === 'rich-fullscreen') { document.querySelector(`[data-style-rich-section="${node.dataset.editor}"]`)?.classList.toggle('style-rich-fullscreen'); return true }
    if (action === 'rich-format') {
      const key = node.dataset.editor!, editor = document.querySelector<HTMLElement>(`[data-style-rich-editor="${key}"]`)
      if (!editor) return true
      const command = node.dataset.command!; let html = '', value = ''
      if (command === 'table') {
        const dimensions = prompt('表格行数 × 列数', '2x2'); if (dimensions === null) return true
        const match = dimensions.match(/^(\d{1,2})\s*[x×*]\s*(\d{1,2})$/i)
        if (!match || Number(match[1]) > 20 || Number(match[2]) > 20 || Number(match[1]) < 1 || Number(match[2]) < 1) throw new Error('请输入 1～20 行、1～20 列，例如 2x2。')
        html = `<table style="border-collapse:collapse;width:100%"><tbody>${Array.from({length:Number(match[1])},()=>`<tr>${Array.from({length:Number(match[2])},()=>'<td style="border:1px solid #ddd;padding:8px">&nbsp;</td>').join('')}</tr>`).join('')}</tbody></table>`
      } else if (['link','picture','video'].includes(command)) {
        const url = prompt(command === 'link' ? '链接地址' : command === 'picture' ? '图片地址' : '视频地址', 'https://'); if (url === null) return true
        if (!/^(https?:\/\/|\/[^/])/i.test(url) || /[\u0000-\u0020\u007f]/.test(url)) throw new Error('请输入有效的图片、视频或网页地址。')
        value = url
        if (command === 'picture') html = `<img src="${e(url)}" alt="商品描述图片">`
        if (command === 'video') html = `<video src="${e(url)}" controls></video>`
      }
      editor.focus(); document.execCommand('styleWithCSS', false, 'true')
      if (html) {
        const template = document.createElement('template'); template.innerHTML = styleContentHtml(html)
        const selection = getSelection(), current = selection?.rangeCount ? selection.getRangeAt(0) : null
        const range = current && editor.contains(current.commonAncestorContainer) ? current : document.createRange()
        if (range !== current) { range.selectNodeContents(editor); range.collapse(false) }
        const last = template.content.lastChild
        if (command === 'table' && range.commonAncestorContainer !== editor) {
          let block: Node = range.commonAncestorContainer
          while (block.parentNode && block.parentNode !== editor) block = block.parentNode
          editor.insertBefore(template.content, block.nextSibling)
        } else { range.deleteContents(); range.insertNode(template.content) }
        if (last) { const caret = document.createRange(); caret.setStartAfter(last); caret.collapse(true); selection?.removeAllRanges(); selection?.addRange(caret) }
      } else document.execCommand(command === 'link' ? 'createLink' : command,false,value)
      await handlePcsProductArchiveInput(editor); return true
    }
    if (action.startsWith('chart-')) {
      state.notice = ''; state.error = false
      const chart = chartDraft()
      if (action === 'chart-select') {
        const kind = node.dataset.kind as 'selectedSizes' | 'selectedParameters' | 'reservedSizes', value = node.dataset.value!
        const selected = new Set(chart[kind] || []); selected.has(value) ? selected.delete(value) : selected.add(value); chart[kind] = [...selected]
        node.setAttribute('aria-pressed',String(selected.has(value)))
      } else if (action === 'chart-generate') {
        generateStyleSizeChartDraft(chart); state.chartPreview = ''; refreshEditorBody()
      } else if (action === 'chart-delete-image') {
        if (!(await confirmPcsAction('删除当前尺码图片及生成预览？保存草稿后生效。'))) return true
        if (state.chartImageUrl) URL.revokeObjectURL(state.chartImageUrl)
        state.chartImageUrl = ''; state.chartImageBlob = null; const previous = salesDraft().sizeChartUrl; salesDraft().sizeChartUrl = ''; releaseUnusedChartFile(previous); refreshEditorBody()
      } else if (action === 'chart-image') {
        if (!state.chartImageBlob) throw new Error('尺寸图未生成或者生成失败，请先填写测量值并插入尺码表。')
        const previous = salesDraft().sizeChartUrl, file = registerPcsFile(state.chartImageBlob)
        state.pendingFileIds.push(file.fileId); salesDraft().sizeChartUrl = file.url; releaseUnusedChartFile(previous)
        state.notice = '尺码图片已添加到当前档案，请保存草稿。'; state.error = false; refreshEditorBody()
      } else {
        const html = styleSizeChartHtml(chart)
        const blob = state.chartPreview === html && state.chartImageBlob ? state.chartImageBlob : await generateStyleSizeChartImage(chart)
        if (action === 'chart-description') salesDraft().description = applyStyleSizeChart(salesDraft().description,chart)
        else if (action === 'chart-factory') state.styleDraft.factorySizeChartHtml = applyStyleSizeChart(state.styleDraft.factorySizeChartHtml || '',chart)
        else if (action === 'chart-country') {
          const country = node.dataset.country!
          if (!(state.styleDraft.salesCountrySettings || []).includes(country)) throw new Error('请先启用对应国家设置。')
          state.styleDraft.salesCountryDescriptions ||= {}
          state.styleDraft.salesCountryDescriptions[country] = applyStyleSizeChart(state.styleDraft.salesCountryDescriptions[country] || salesDraft().description,chart)
        }
        state.chartPreview = html
        if (state.chartImageUrl) URL.revokeObjectURL(state.chartImageUrl)
        state.chartImageBlob = blob; state.chartImageUrl = URL.createObjectURL(blob); refreshEditorBody()
      }
      state.styleDraft.sizeChartDraft = structuredClone(chart); state.dirty = true
      refreshArchiveNotice(); return true
    }
    if (action === 'editor-tab' || action === 'tab') {
      if (action === 'editor-tab') { state.editorTab = node.dataset.tab!; refreshEditorBody() }
      else { state.tab = node.dataset.tab!; state.sales = null; refreshDetailBody() }
      refreshArchiveTabs(action); return true
    }
    if (['image', 'close-image-preview', 'dismiss'].includes(action)) {
      if (action === 'image') { state.image = node.dataset.url || ''; state.imageName = node.dataset.name || '' }
      else if (action === 'close-image-preview') state.image = ''
      else { state.notice = ''; state.batchResults = []; node.closest('[role="status"], [role="alert"]')?.remove() }
      const overlaysNode = document.querySelector('[data-product-overlays]'); if (overlaysNode) overlaysNode.innerHTML = overlays(); return true
    }
    if (action === 'columns') state.columnsOpen = true
    else if (action === 'close-column-settings' || action === 'close-drawers') { state.columnsOpen = false; state.importOpen = false; state.image = '' }
    else if (action === 'query') { state.filter = { ...state.query }; state.page = 1; state.selected.clear() }
    else if (action === 'reset') { state.query = {}; state.filter = {}; state.page = 1; state.sort = null; state.selected.clear() }
    else if (action === 'more') state.more = !state.more
    else if (action === 'prev-page') state.page--
    else if (action === 'next-page') state.page++
    else if (action === 'sort-column') { const k = node.dataset.columnKey!; state.sort = state.sort?.key !== k ? { key: k, direction: 'asc' } : state.sort.direction === 'asc' ? { key: k, direction: 'desc' } : null; state.page = 1 }
    else if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
      const key = node.dataset.pcsProductArchiveColumnKey!, prefs = preferences(), list = action === 'toggle-column-visibility' ? prefs.visibleKeys : prefs.frozenKeys
      if (list.includes(key)) list.splice(list.indexOf(key), 1); else { if (action === 'toggle-column-freeze' && [...list, key].reduce((n, k) => n + (columns().find(c => c.key === k)?.width || 0), 0) > 450) throw new Error('固定列总宽不能超过 450 像素。'); list.push(key) }
      savePreferences()
    } else if (action === 'restore-column-settings') { delete state.preferences[state.kind]; try { localStorage.removeItem(`higood-pcs-${state.kind}-list-r1`) } catch { /* optional preference */ } preferences() }
    else if (action === 'select-row') { const id = node.dataset.id!; state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id) }
    else if (action === 'select-page') { const cols = columns(), rows = paginateStandardListRows(sortStandardListRows(filteredRows(), state.sort, (r, k) => cols.find(c => c.key === k)?.sortValue?.(r)), state.page, preferences().pageSize).rows; const all = rows.every(r => state.selected.has(idOf(r))); rows.forEach(r => all ? state.selected.delete(idOf(r)) : state.selected.add(idOf(r))) }
    else if (action === 'export') exportList()
    else if (action === 'preview') {
      if (!state.colors.length || !state.sizes.length) throw new Error('请至少选择一种颜色和一个尺码。')
      const parent = state.kind === 'sku' ? getStyleArchiveById(state.skuDraft.styleId || '') : { ...state.styleDraft, styleId: 'draft', styleCode: state.styleDraft.styleCode || '待生成SPU' } as StyleArchiveShellRecord
      if (!parent) throw new Error('请选择所属款式。')
      state.preview = previewProductSkus(parent, state.colors.flatMap(colorId => state.sizes.map(sizeId => ({ colorId, sizeId, patternIdentityId: state.pattern, deliveryDifference: state.difference }))))
      state.notice = ''; state.dirty = true
    } else if (action === 'add-substitute') { (state.styleDraft.substitutionRelations ||= []).push({ id: crypto.randomUUID(), targetKind: 'PRODUCT_SKU', targetId: '', conditions: '', version: 1 }); state.dirty = true }
    else if (action === 'remove-substitute') { state.styleDraft.substitutionRelations?.splice(Number(node.dataset.index), 1); state.dirty = true }
    else if (action === 'add-package') { (state.skuDraft.packageSpecs ||= productPackages(state.skuDraft)).push({ packageSpecId: crypto.randomUUID(), ownerSkuId: state.id, packageTypeId: '包', contentQty: 1, contentUnitId: state.skuDraft.pricingUnit || '件', grossWeightKg: null, lengthCm: null, widthCm: null, heightCm: null, volumeM3: null, measurementBasis: '每包装', version: 1, status: 'ACTIVE' }); state.dirty = true }
    else if (action === 'gallery-up' || action === 'gallery-remove') { const i = Number(node.dataset.index), d = state.styleDraft; d.galleryImagePurposes = (d.galleryImageUrls || []).map((_, n) => d.galleryImagePurposes?.[n] || '补充识别图'); for (const rows of [d.galleryImageIds || [], d.galleryImageUrls || [], d.galleryImagePurposes]) { if (action === 'gallery-up' && i > 0) [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; else if (action === 'gallery-remove') rows.splice(i, 1) } state.dirty = true }
    else if (action === 'add-component') { (state.skuDraft.bundleComponents ||= []).push({ skuId: '', quantity: 1 }); state.dirty = true }
    else if (action === 'remove-component') { state.skuDraft.bundleComponents?.splice(Number(node.dataset.index), 1); state.dirty = true }
    else if (action === 'import') { state.importOpen = true; state.importRows = []; state.importErrors = []; state.importText = ''; state.skuDraft = { styleId: state.filter.styleId || '' } }
    else if (action === 'import-preview') importPreview()
    else if (action === 'import-confirm') {
      importPreview(); if (!state.importRows.length || state.importErrors.length) throw new Error('请先处理导入校验错误。')
      await runPcsRecordCommand(() => createSkuArchiveBatch(previewProductSkus(getStyleArchiveById(state.skuDraft.styleId!)!, state.importRows)))
      state.notice = `已导入 ${state.importRows.length} 条草稿规格。`; state.error = false; state.importOpen = false
    } else if (action === 'cancel-edit') {
      if (state.dirty && !await confirmPcsAction('修改尚未保存，确定离开并放弃本次输入？')) return true
      state.pendingFileIds.forEach(releasePcsPendingFile); state.pendingFileIds = []; state.editorKey = ''; state.dirty = false
      go(state.id ? `${path()}/${state.id}` : path(), state.kind === 'style' ? '款式档案' : '规格档案'); return true
    } else if (action === 'copy') {
      if (state.kind === 'style') { const copied = productDraftCopy(state.id); state.editorKey = ''; initEditor('style'); state.styleDraft = copied; state.dirty = true; go(`${STYLE_PATH}/new`, '复制款式'); state.dirty = true }
      else { const source = getSkuArchiveById(state.id)!; state.editorKey = ''; initEditor('sku', '', source.styleId); state.colors = source.colorId ? [source.colorId] : []; state.sizes = source.sizeId ? [source.sizeId] : []; state.pattern = source.patternIdentityId || ''; state.notice = '请选择不同颜色、尺码或交付差异，然后生成规格预览。'; go(`${SKU_PATH}/new?styleId=${source.styleId}`, '复制规格') }
      return true
    } else if (['submit', 'approve', 'reject', 'activate', 'deactivate', 'archive', 'batch-submit'].includes(action)) {
      if (action === 'batch-submit') {
        if (state.saving) return true
        state.saving = true; state.batchResults = []
        try {
          for (const id of [...state.selected]) {
            const row = state.kind === 'style' ? getStyleArchiveById(id) : getSkuArchiveById(id)
            try { await runPcsRecordCommand(() => submitProductForApproval(state.kind, id)); state.batchResults.push({ code: row ? codeOf(row) : id, success: true, message: '已提交审核' }); state.selected.delete(id) }
            catch (error) { state.batchResults.push({ code: row ? codeOf(row) : id, success: false, message: error instanceof Error ? error.message : '本条未保存，请重试。' }) }
          }
          const success = state.batchResults.filter(r => r.success).length
          state.notice = `提交成功 ${success} 条，失败 ${state.batchResults.length - success} 条。`; state.error = false
        } finally { state.saving = false }
        rerender(); return true
      }
      let reason = ''
      if (action === 'reject') { const entered = await requestPcsActionReason('请填写驳回原因'); if (entered === null) return true; reason = entered }
      if (['deactivate', 'archive'].includes(action) && !await confirmPcsAction(action === 'archive' ? '归档后不再用于新业务，已有记录保留。确定归档？' : '停用后不再用于新业务；已有关联渠道商品保留。确定停用？')) return true
      if (action === 'archive') {
        const { getProductExternalActiveReferences } = await import('../data/pcs-product-reference-check.ts')
        const references = await getProductExternalActiveReferences(state.kind, state.id)
        if (references.length) throw new Error(`仍有活动引用，不能归档：${references.slice(0, 3).join('、')}${references.length > 3 ? `等 ${references.length} 项` : ''}。`)
      }
      await runPcsRecordCommand(() => {
        if (action === 'submit') submitProductForApproval(state.kind, state.id)
        else if (action === 'approve' || action === 'reject') reviewProductArchive(state.kind, state.id, action === 'approve', reason)
        else {
          setProductLifecycle(state.kind, state.id, action === 'activate' ? 'ACTIVE' : action === 'deactivate' ? 'INACTIVE' : 'ARCHIVED')
        }
      })
      state.notice = '操作已保存。'; state.error = false
    }
  } catch (error) { fail(error); if (action.startsWith('chart-')) { refreshArchiveNotice(); return true } }
  rerender(); return true
}
export function resetPcsProductArchiveState(): void { state.view = 'list'; state.id = ''; state.tab = 'basic'; state.query = {}; state.filter = {}; state.page = 1; state.sort = null; state.notice = ''; state.batchResults = []; state.selected.clear(); state.columnsOpen = false; state.image = ''; state.dirty = false; state.editorKey = ''; state.importOpen = false }
export function isPcsProductArchiveDialogOpen(): boolean { return state.columnsOpen || state.importOpen || !!state.image }
export function isPcsProductArchiveDirty(): boolean { return state.dirty }
registerPcsUnsavedChanges('product-archives', { isDirty: () => state.dirty, discard: () => { state.dirty = false; state.editorKey = ''; state.pendingFileIds.forEach(releasePcsPendingFile); state.pendingFileIds = [] } })
if (typeof window !== 'undefined') {
  document.addEventListener('error', event => {
    const image = event.target; if (!(image instanceof HTMLImageElement) || !image.closest('[data-pcs-product-archive-root]')) return
    image.hidden = true; const parent = image.parentElement
    if (parent && !parent.querySelector('[data-product-image-error]')) { const message = document.createElement('span'); message.dataset.productImageError = ''; message.className = 'block p-2 text-xs text-red-600'; message.textContent = '图片加载失败，请重新上传'; parent.append(message) }
  }, true)
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && isPcsProductArchiveDialogOpen()) { const imageOnly = !!state.image && !state.columnsOpen && !state.importOpen; state.image = ''; state.columnsOpen = false; state.importOpen = false; if (imageOnly) { const overlay = document.querySelector('[data-product-overlays]'); if (overlay) overlay.innerHTML = '' } else rerender() } })
  document.addEventListener('mousedown', event => { if ((event.target as HTMLElement).closest?.('[data-pcs-product-archive-action="rich-format"]')) event.preventDefault() })
  document.addEventListener('paste', event => {
    const editor = (event.target as HTMLElement).closest?.<HTMLElement>('[data-style-rich-editor]'); if (!editor) return
    event.preventDefault(); const html = event.clipboardData?.getData('text/html')
    if (html) document.execCommand('insertHTML', false, styleContentHtml(html)); else document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') || '')
    void handlePcsProductArchiveInput(editor)
  })
}
import { registerPcsUnsavedChanges } from '../data/pcs-unsaved-changes.ts'
