// @page-pattern: list
// 技术资料统一结果页：技术包、BOM 与价格、技术包模板库。

import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../components/ui/list-table-model.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import { listEngineeringMasterOrders } from '../data/pcs-engineering-master-repository.ts'
import { ensureEngineeringMasterDemoData } from '../data/pcs-engineering-master-view-model.ts'
import { getStyleArchiveById } from '../data/pcs-style-archive-repository.ts'
import { getTechnicalDataVersionContent, listTechnicalDataVersions } from '../data/pcs-technical-data-version-repository.ts'
import type { TechnicalDataVersionRecord } from '../data/pcs-technical-data-version-types.ts'
import { escapeHtml } from '../utils.ts'

const PAGE_SIZE_OPTIONS = [10, 20, 50]
const listState = {
  keyword: '',
  status: '',
  review: '',
  brand: '',
  completeness: '',
  difficulty: '',
  merchandiser: '',
  patternMaker: '',
  createdFrom: '',
  createdTo: '',
  needMyAudit: false,
  currentPage: 1,
  pageSize: 20,
  spuDistinct: false,
}
let imagePreview: { url: string; title: string } | null = null

type TechPackRow = TechnicalDataVersionRecord & {
  imageUrl: string
  brandName: string
  merchandiserName: string
  patternMakerName: string
}

const columns: StandardListColumn<TechPackRow>[] = [
  { key: 'id', title: '技术包 ID', width: 150, required: true, freezeable: true, render: (row) => escapeHtml(row.technicalVersionCode) },
  { key: 'style', title: '商品信息', width: 260, required: true, freezeable: true, render: (row) => `<div class="flex items-center gap-3">${row.imageUrl ? `<button type="button" class="h-12 w-12 overflow-hidden rounded border" aria-label="查看${escapeHtml(row.styleName)}大图" data-tech-data-action="open-image" data-image-url="${escapeHtml(row.imageUrl)}" data-image-title="${escapeHtml(row.styleName)}"><img class="h-full w-full object-cover" src="${escapeHtml(row.imageUrl)}" alt="${escapeHtml(row.styleName)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="text-[10px] text-slate-500">图片失败</span></button>` : '<span class="flex h-12 w-12 items-center justify-center rounded border text-[10px] text-slate-400">暂无图片</span>'}<div><p class="font-medium">${escapeHtml(row.styleName)}</p><p class="text-xs text-slate-500">${escapeHtml(row.styleCode)} · ${escapeHtml(row.brandName || '未设置品牌')}</p></div></div>` },
  { key: 'status', title: '状态', width: 120, render: (row) => escapeHtml(row.versionStatus === 'PUBLISHED' ? '已发布' : row.versionStatus === 'ARCHIVED' ? '已归档' : '草稿') },
  { key: 'version', title: '版本', width: 100, render: (row) => escapeHtml(row.versionLabel) },
  { key: 'complete', title: '完整度', width: 100, render: (row) => `${row.completenessScore}%` },
  { key: 'difficulty', title: '做货难度', width: 100, render: (row) => escapeHtml(row.garmentDifficultyGrade) },
  { key: 'merchandiser', title: '跟单', width: 130, render: (row) => escapeHtml(row.merchandiserName || '-') },
  { key: 'patternMaker', title: '版师', width: 130, render: (row) => escapeHtml(row.patternMakerName || '-') },
  { key: 'source', title: '来源', width: 180, render: (row) => escapeHtml(row.sourceProjectCode || '-') },
  { key: 'created', title: '创建时间', width: 170, render: (row) => escapeHtml(row.createdAt) },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true, render: (row) => `<button type="button" class="rounded border px-3 py-1 text-xs text-blue-700" data-nav="/pcs/products/styles/${escapeHtml(row.styleId)}/technical-data/${escapeHtml(row.technicalVersionId)}">查看</button>` },
]

const preferences: StandardListColumnPreferences = {
  order: columns.map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: ['id', 'style'],
  pageSize: 20,
}

function engineeringVersions(): TechPackRow[] {
  ensureEngineeringMasterDemoData()
  const masters = listEngineeringMasterOrders()
  return listTechnicalDataVersions()
    .filter((row) => row.createdFromTaskType === 'ENGINEERING_MASTER' || row.createdFromTaskType === 'ENGINEERING_CHANGE')
    .map((row) => {
      const style = getStyleArchiveById(row.styleId)
      const master = masters.find((item) => item.masterOrderId === row.sourceProjectId || item.styleId === row.styleId)
      return {
        ...row,
        imageUrl: style?.mainImageUrl || style?.galleryImageUrls[0] || '',
        brandName: style?.brandName || '',
        merchandiserName: master?.merchandiserName || row.merchandiserReview?.assignedReviewerName || '',
        patternMakerName: row.patternMakerReview?.assignedReviewerName || '',
      }
    })
}

function filteredRows(): TechPackRow[] {
  const keyword = listState.keyword.trim().toLowerCase()
  let rows = engineeringVersions().filter((row) => {
    if (keyword && ![row.technicalVersionCode, row.styleCode, row.styleName, row.sourceProjectCode].join(' ').toLowerCase().includes(keyword)) return false
    if (listState.status && row.versionStatus !== listState.status) return false
    if (listState.review && row.reviewStage !== listState.review) return false
    if (listState.brand && row.brandName !== listState.brand) return false
    if (listState.completeness === 'COMPLETE' && row.completenessScore !== 100) return false
    if (listState.completeness === 'INCOMPLETE' && row.completenessScore === 100) return false
    if (listState.difficulty && row.garmentDifficultyGrade !== listState.difficulty) return false
    if (listState.merchandiser && row.merchandiserName !== listState.merchandiser) return false
    if (listState.patternMaker && row.patternMakerName !== listState.patternMaker) return false
    if (listState.createdFrom && row.createdAt.slice(0, 10) < listState.createdFrom) return false
    if (listState.createdTo && row.createdAt.slice(0, 10) > listState.createdTo) return false
    if (listState.needMyAudit && !['第一阶段并行审核', '跟单复核'].includes(row.reviewStage)) return false
    return true
  })
  if (listState.spuDistinct) {
    const seen = new Set<string>()
    rows = rows.filter((row) => seen.has(row.styleId) ? false : (seen.add(row.styleId), true))
  }
  return rows
}

function renderFilters(): string {
  const rows = engineeringVersions()
  const options = (values: string[]) => [...new Set(values.filter(Boolean))].map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')
  return `<div class="grid grid-cols-2 gap-2 xl:grid-cols-6"><input class="h-9 rounded border px-3 text-sm xl:col-span-2" placeholder="技术包 ID / SPU / 工程主单" value="${escapeHtml(listState.keyword)}" data-tech-data-field="keyword"><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="status"><option value="">全部状态</option><option value="DRAFT" ${listState.status === 'DRAFT' ? 'selected' : ''}>草稿</option><option value="PUBLISHED" ${listState.status === 'PUBLISHED' ? 'selected' : ''}>已发布</option><option value="ARCHIVED" ${listState.status === 'ARCHIVED' ? 'selected' : ''}>已归档</option></select><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="review"><option value="">全部审核阶段</option>${['未提交审核','第一阶段并行审核','跟单复核','待发布','已发布'].map((value) => `<option value="${value}" ${listState.review === value ? 'selected' : ''}>${value}</option>`).join('')}</select><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="brand"><option value="">全部品牌</option>${options(rows.map((row) => row.brandName))}</select><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="completeness"><option value="">全部完整度</option><option value="COMPLETE" ${listState.completeness === 'COMPLETE' ? 'selected' : ''}>100%</option><option value="INCOMPLETE" ${listState.completeness === 'INCOMPLETE' ? 'selected' : ''}>未完整</option></select><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="difficulty"><option value="">全部做货难度</option>${['A','A+','A++','B','C','D'].map((value) => `<option value="${value}" ${listState.difficulty === value ? 'selected' : ''}>${value}</option>`).join('')}</select><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="merchandiser"><option value="">全部跟单</option>${options(rows.map((row) => row.merchandiserName))}</select><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="patternMaker"><option value="">全部版师</option>${options(rows.map((row) => row.patternMakerName))}</select><input type="date" aria-label="创建开始日期" class="h-9 rounded border px-2 text-sm" value="${listState.createdFrom}" data-tech-data-field="createdFrom"><input type="date" aria-label="创建结束日期" class="h-9 rounded border px-2 text-sm" value="${listState.createdTo}" data-tech-data-field="createdTo"><div class="flex items-center gap-2 xl:col-span-2"><label class="flex h-9 items-center gap-2 rounded border px-3 text-sm"><input type="checkbox" data-tech-data-field="needMyAudit" ${listState.needMyAudit ? 'checked' : ''}>待我审核</label><label class="flex h-9 items-center gap-2 rounded border px-3 text-sm"><input type="checkbox" data-tech-data-field="spuDistinct" ${listState.spuDistinct ? 'checked' : ''}>SPU 去重</label><button type="button" class="h-9 rounded bg-blue-600 px-4 text-sm text-white" data-tech-data-action="search">查询</button></div></div>`
}

function renderPreview(): string {
  if (!imagePreview) return ''
  return `<div class="fixed inset-0 z-[80] flex items-center justify-center p-5" role="dialog" aria-modal="true"><button class="absolute inset-0 bg-slate-950/70" data-tech-data-action="close-image" aria-label="关闭大图"></button><section class="relative z-10 max-h-full max-w-5xl overflow-auto rounded-lg bg-white p-4"><div class="mb-3 flex items-center justify-between gap-4"><h2 class="font-semibold">${escapeHtml(imagePreview.title)}</h2><button class="rounded border px-3 py-1" data-tech-data-action="close-image">关闭</button></div><img class="max-h-[80vh] max-w-full object-contain" src="${escapeHtml(imagePreview.url)}" alt="${escapeHtml(imagePreview.title)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><p hidden class="p-12 text-slate-500">图片加载失败，请检查原图地址。</p></section></div>`
}

export function renderPcsTechnicalDataTechPackListPage(): string {
  const rows = filteredRows()
  const paging = paginateStandardListRows(rows, listState.currentPage, listState.pageSize)
  listState.currentPage = paging.currentPage
  preferences.pageSize = listState.pageSize
  return `<div data-pcs-technical-data-page>${renderStandardListPage({
    title: '技术包列表',
    primaryActionsHtml: '<span class="text-sm text-slate-500">技术包仅由工程主单或工程变更生成</span>',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([{ label: '技术包数量', value: rows.length }, { label: 'SPU 数量', value: new Set(rows.map((row) => row.styleId)).size }, { label: '待审核', value: rows.filter((row) => row.versionStatus === 'DRAFT' && row.reviewStage !== '未提交审核').length }]),
    listTitle: '技术包',
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences, sort: null, eventPrefix: 'tech-data', emptyText: '暂无符合条件的技术包' }),
    paginationHtml: `<div aria-label="技术包分页">${renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: 'tech-data', pageSizeOptions: PAGE_SIZE_OPTIONS })}</div>`,
    overlaysHtml: renderPreview(),
  })}</div>`
}

export function renderPcsTechnicalDataBomPricingPage(): string {
  const rows = engineeringVersions().map((record) => ({ record, content: getTechnicalDataVersionContent(record.technicalVersionId) }))
  return `<div class="space-y-4 p-4"><header><h1 class="text-xl font-semibold">BOM 与价格</h1><p class="mt-1 text-sm text-slate-500">草稿实时读取物料标准单价；正式技术包展示发布快照。</p></header><section class="overflow-hidden rounded-lg border bg-white"><div class="overflow-x-auto"><table class="w-full min-w-[980px] text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="px-4 py-3">款式 / 技术包</th><th class="px-4 py-3">状态</th><th class="px-4 py-3">BOM 行</th><th class="px-4 py-3">人民币物料成本</th><th class="px-4 py-3">印尼盾费用</th><th class="px-4 py-3">汇率</th><th class="px-4 py-3">综合成本</th><th class="px-4 py-3">操作</th></tr></thead><tbody>${rows.length ? rows.map(({ record, content }) => { const snapshot = content?.bomPricingSnapshot; return `<tr class="border-t"><td class="px-4 py-3"><p class="font-medium">${escapeHtml(record.styleName)}</p><p class="text-xs text-slate-500">${escapeHtml(record.styleCode)} · ${escapeHtml(record.versionLabel)}</p></td><td class="px-4 py-3">${record.versionStatus === 'PUBLISHED' ? '正式版本' : '草稿'}</td><td class="px-4 py-3">${content?.bomItems.length || 0}</td><td class="px-4 py-3">¥ ${snapshot?.materialCostCny.toFixed(2) || '实时计算'}</td><td class="px-4 py-3">Rp ${snapshot?.cost.customCostIdr.toLocaleString('id-ID') || '实时计算'}</td><td class="px-4 py-3">1 CNY = ${snapshot?.exchangeRateIdrPerCny.toLocaleString('id-ID') || '系统最新'} IDR</td><td class="px-4 py-3">${snapshot ? `¥ ${snapshot.comprehensiveCostCny.toFixed(2)} / Rp ${snapshot.comprehensiveCostIdr.toLocaleString('id-ID')}` : '进入技术包查看'}</td><td class="px-4 py-3"><button class="text-blue-700" data-nav="/pcs/products/styles/${escapeHtml(record.styleId)}/technical-data/${escapeHtml(record.technicalVersionId)}">查看</button></td></tr>` }).join('') : '<tr><td colspan="8" class="px-4 py-12 text-center text-slate-500">暂无 BOM 与价格版本</td></tr>'}</tbody></table></div></section></div>`
}

export function renderPcsTechnicalDataTemplateLibraryPage(): string {
  const templates = [
    ['TP-TPL-WOVEN-01', '纯梭织技术包模板', '梭织', 'BOM、纸样、工艺、尺码、质量'],
    ['TP-TPL-KNIT-01', '毛织技术包模板', '毛织', 'BOM、毛织纸样、工艺、尺码、质量'],
    ['TP-TPL-MIXED-01', '毛织与梭织组合模板', '毛织&梭织', '双纸样、BOM、工艺、尺码、质量'],
  ]
  return `<div class="space-y-4 p-4"><header><h1 class="text-xl font-semibold">技术包模板库</h1><p class="mt-1 text-sm text-slate-500">用于工程主单生成技术包时确定资料结构。</p></header><section class="overflow-hidden rounded-lg border bg-white"><table class="w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="px-4 py-3">模板编号</th><th class="px-4 py-3">模板名称</th><th class="px-4 py-3">适用类型</th><th class="px-4 py-3">资料范围</th><th class="px-4 py-3">状态</th></tr></thead><tbody>${templates.map((row) => `<tr class="border-t"><td class="px-4 py-3">${row[0]}</td><td class="px-4 py-3 font-medium">${row[1]}</td><td class="px-4 py-3">${row[2]}</td><td class="px-4 py-3">${row[3]}</td><td class="px-4 py-3 text-emerald-700">启用</td></tr>`).join('')}</tbody></table></section></div>`
}

function rerender(): void {
  const host = document.querySelector<HTMLElement>('[data-pcs-technical-data-page]')
  if (host) host.outerHTML = renderPcsTechnicalDataTechPackListPage()
}

export function handlePcsTechnicalDataInput(target: Element): boolean {
  const node = target.closest<HTMLInputElement | HTMLSelectElement>('[data-tech-data-field]')
  if (!node) return false
  if (node.dataset.techDataField === 'keyword') listState.keyword = node.value
  if (node.dataset.techDataField === 'status') listState.status = node.value
  if (node.dataset.techDataField === 'review') listState.review = node.value
  if (node.dataset.techDataField === 'brand') listState.brand = node.value
  if (node.dataset.techDataField === 'completeness') listState.completeness = node.value
  if (node.dataset.techDataField === 'difficulty') listState.difficulty = node.value
  if (node.dataset.techDataField === 'merchandiser') listState.merchandiser = node.value
  if (node.dataset.techDataField === 'patternMaker') listState.patternMaker = node.value
  if (node.dataset.techDataField === 'createdFrom') listState.createdFrom = node.value
  if (node.dataset.techDataField === 'createdTo') listState.createdTo = node.value
  if (node.dataset.techDataField === 'needMyAudit') listState.needMyAudit = (node as HTMLInputElement).checked
  if (node.dataset.techDataField === 'spuDistinct') listState.spuDistinct = (node as HTMLInputElement).checked
  return true
}

export function handlePcsTechnicalDataEvent(target: HTMLElement, event?: Event): boolean {
  if (event?.type === 'keydown' && (event as KeyboardEvent).key === 'Escape' && imagePreview) { imagePreview = null; rerender(); return true }
  const node = target.closest<HTMLElement>('[data-tech-data-action], [data-tech-data-field]')
  const action = node?.dataset.techDataAction || ''
  if (action === 'open-image') { imagePreview = { url: node?.dataset.imageUrl || '', title: node?.dataset.imageTitle || '款式图片' }; rerender(); return true }
  if (action === 'close-image') { imagePreview = null; rerender(); return true }
  if (action === 'search') { listState.currentPage = 1; rerender(); return true }
  if (action === 'prev-page') { listState.currentPage = Math.max(1, listState.currentPage - 1); rerender(); return true }
  if (action === 'next-page') { listState.currentPage += 1; rerender(); return true }
  if (node?.dataset.techDataField === 'pageSize') { listState.pageSize = Number((node as HTMLSelectElement).value) || 20; listState.currentPage = 1; rerender(); return true }
  return false
}

export function isPcsTechnicalDataDialogOpen(): boolean { return imagePreview !== null }
