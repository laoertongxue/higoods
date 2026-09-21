// @page-pattern: list
// 技术包列表轻量入口：只读取已存在的技术包快照，不在列表冷启动时初始化生产准备生命周期。
import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../components/ui/list-table-model.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import { getStyleArchiveById } from '../data/pcs-style-archive-repository.ts'
import { resolveStableStyleImage } from '../data/pcs-style-demo-image.ts'
import { listTechnicalDataVersions } from '../data/pcs-technical-data-version-repository.ts'
import type { TechnicalDataVersionRecord } from '../data/pcs-technical-data-version-types.ts'
import { escapeHtml } from '../utils.ts'

const PAGE_SIZE_OPTIONS = [10, 20, 50]
const listState = { keyword: '', status: '', review: '', brand: '', completeness: '', difficulty: '', merchandiser: '', patternMaker: '', createdFrom: '', createdTo: '', needMyAudit: false, currentPage: 1, pageSize: 20, spuDistinct: false }
let imagePreview: { url: string; title: string } | null = null

type TechPackRow = TechnicalDataVersionRecord & { imageUrl: string; brandName: string; merchandiserName: string; patternMakerName: string }

const columns: StandardListColumn<TechPackRow>[] = [
  { key: 'id', title: '技术包 ID', width: 150, required: true, freezeable: true, render: (row) => escapeHtml(row.technicalVersionCode) },
  { key: 'style', title: '商品信息', width: 260, required: true, freezeable: true, render: (row) => `<div class="flex items-center gap-3">${row.imageUrl ? `<button type="button" class="h-12 w-12 overflow-hidden rounded border" aria-label="查看${escapeHtml(row.styleName)}大图" data-tech-data-action="open-image" data-image-url="${escapeHtml(row.imageUrl)}" data-image-title="${escapeHtml(row.styleName)}"><img loading="lazy" class="h-full w-full object-cover" src="${escapeHtml(row.imageUrl)}" alt="${escapeHtml(row.styleName)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="text-[10px] text-slate-500">图片失败</span></button>` : '<span class="flex h-12 w-12 items-center justify-center rounded border text-[10px] text-slate-400">暂无图片</span>'}<div><p class="font-medium">${escapeHtml(row.styleName)}</p><p class="text-xs text-slate-500">${escapeHtml(row.styleCode)} · ${escapeHtml(row.brandName || '未设置品牌')}</p></div></div>` },
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
const preferences: StandardListColumnPreferences = { order: columns.map((column) => column.key), visibleKeys: columns.map((column) => column.key), frozenKeys: ['id', 'style'], pageSize: 20 }

function engineeringVersions(): TechPackRow[] {
  return listTechnicalDataVersions().filter((row) => row.createdFromTaskType === 'ENGINEERING_MASTER').map((row) => {
    const style = getStyleArchiveById(row.styleId)
    return { ...row, imageUrl: resolveStableStyleImage(row.styleName, style?.mainImageUrl || style?.galleryImageUrls[0] || ''), brandName: style?.brandName || '', merchandiserName: row.merchandiserReview?.assignedReviewerName || '', patternMakerName: row.patternMakerReview?.assignedReviewerName || '' }
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
    if (listState.createdFrom && (row.createdAt || '').slice(0, 10) < listState.createdFrom) return false
    if (listState.createdTo && (row.createdAt || '').slice(0, 10) > listState.createdTo) return false
    if (listState.needMyAudit && !['第一阶段并行审核', '跟单复核'].includes(row.reviewStage || '')) return false
    return true
  })
  if (listState.spuDistinct) { const seen = new Set<string>(); rows = rows.filter((row) => seen.has(row.styleId) ? false : (seen.add(row.styleId), true)) }
  return rows
}
function renderFilters(rows: TechPackRow[]): string {
  const options = (values: string[]) => [...new Set(values.filter(Boolean))].map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')
  return `<div class="grid grid-cols-2 gap-2 xl:grid-cols-6"><input class="h-9 rounded border px-3 text-sm xl:col-span-2" placeholder="技术包 ID / SPU / 生产准备单" value="${escapeHtml(listState.keyword)}" data-tech-data-field="keyword"><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="status"><option value="">全部状态</option><option value="DRAFT">草稿</option><option value="PUBLISHED">已发布</option><option value="ARCHIVED">已归档</option></select><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="review"><option value="">全部审核阶段</option>${['未提交审核','第一阶段并行审核','跟单复核','待发布','已发布'].map((value) => `<option value="${value}">${value}</option>`).join('')}</select><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="brand"><option value="">全部品牌</option>${options(rows.map((row) => row.brandName))}</select><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="completeness"><option value="">全部完整度</option><option value="COMPLETE">100%</option><option value="INCOMPLETE">未完整</option></select><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="difficulty"><option value="">全部做货难度</option>${['A','A+','A++','B','C','D'].map((value) => `<option value="${value}">${value}</option>`).join('')}</select><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="merchandiser"><option value="">全部跟单</option>${options(rows.map((row) => row.merchandiserName))}</select><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="patternMaker"><option value="">全部版师</option>${options(rows.map((row) => row.patternMakerName))}</select><input type="date" aria-label="创建开始日期" class="h-9 rounded border px-2 text-sm" value="${listState.createdFrom}" data-tech-data-field="createdFrom"><input type="date" aria-label="创建结束日期" class="h-9 rounded border px-2 text-sm" value="${listState.createdTo}" data-tech-data-field="createdTo"><div class="flex items-center gap-2 xl:col-span-2"><label class="flex h-9 items-center gap-2 rounded border px-3 text-sm"><input type="checkbox" data-tech-data-field="needMyAudit">待我审核</label><label class="flex h-9 items-center gap-2 rounded border px-3 text-sm"><input type="checkbox" data-tech-data-field="spuDistinct">SPU 去重</label><button type="button" class="h-9 rounded bg-blue-600 px-4 text-sm text-white" data-tech-data-action="search">查询</button></div></div>`
}
function renderPreview(): string {
  if (!imagePreview) return ''
  return `<div class="fixed inset-0 z-[80] flex items-center justify-center p-5" role="dialog" aria-modal="true"><button class="absolute inset-0 bg-slate-950/70" data-tech-data-action="close-image" aria-label="关闭大图"></button><section class="relative z-10 max-h-full max-w-5xl overflow-auto rounded-lg bg-white p-4"><div class="mb-3 flex items-center justify-between gap-4"><h2 class="font-semibold">${escapeHtml(imagePreview.title)}</h2><button class="rounded border px-3 py-1" data-tech-data-action="close-image">关闭</button></div><img class="max-h-[80vh] max-w-full object-contain" src="${escapeHtml(imagePreview.url)}" alt="${escapeHtml(imagePreview.title)}"></section></div>`
}
export function renderPcsTechnicalDataTechPackListPage(): string {
  const rows = filteredRows(); const paging = paginateStandardListRows(rows, listState.currentPage, listState.pageSize); listState.currentPage = paging.currentPage; preferences.pageSize = listState.pageSize
  return `<div data-pcs-technical-data-page>${renderStandardListPage({ title: '技术包列表', primaryActionsHtml: '<span class="text-sm text-slate-500">技术包仅由生产准备单生成</span>', filtersHtml: renderFilters(rows), statsHtml: renderStandardListStats([{ label: '技术包数量', value: rows.length }, { label: 'SPU 数量', value: new Set(rows.map((row) => row.styleId)).size }, { label: '待审核', value: rows.filter((row) => row.versionStatus === 'DRAFT' && row.reviewStage !== '未提交审核').length }]), listTitle: '技术包', tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences, sort: null, eventPrefix: 'tech-data', emptyText: '暂无符合条件的技术包' }), paginationHtml: `<div aria-label="技术包分页">${renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: 'tech-data', pageSizeOptions: PAGE_SIZE_OPTIONS })}</div>`, overlaysHtml: renderPreview() })}</div>`
}
