// @page-pattern: list
// 技术包列表轻量入口：只读取已存在的技术包快照，不在列表冷启动时初始化生产准备生命周期。
import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../components/ui/list-table-model.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import { listStyleArchives } from '../data/pcs-style-archive-repository.ts'
import { resolveStableStyleImage } from '../data/pcs-style-demo-image.ts'
import { listTechPackVersionLogsByVersionId } from '../data/pcs-tech-pack-version-log-repository.ts'
import { listTechPackReviewersByRole } from '../data/pcs-tech-pack-reviewer-directory.ts'
import { productionDemands } from '../data/fcs/production-demands.ts'
import { productionOrderRuntimeStore } from '../data/fcs/production-order-runtime-store.ts'
import { listTechnicalDataVersions } from '../data/pcs-technical-data-version-repository.ts'
import type { TechnicalDataVersionRecord } from '../data/pcs-technical-data-version-types.ts'
import { escapeHtml } from '../utils.ts'

const PAGE_SIZE_OPTIONS = [10, 20, 50]
export const technicalListState = { keyword: '', status: '', review: '', brand: '', completeness: '', difficulty: '', merchandiser: '', patternMaker: '', createdFrom: '', createdTo: '', needMyAudit: false, currentPage: 1, pageSize: 20, spuDistinct: false }
export const technicalLogModal = { versionId: '' }
export const technicalAssignmentFeedback = { message: '', ok: true }
export const technicalImagePreview = { value: null as { url: string; title: string } | null }

type TechPackRow = TechnicalDataVersionRecord & { imageUrl: string; brandName: string; merchandiserName: string; patternMakerName: string; buyerName: string; productionOrderIds: string[] }

const columns: StandardListColumn<TechPackRow>[] = [
  { key: 'id', title: '技术包 ID', width: 150, required: true, freezeable: true, render: (row) => escapeHtml(row.technicalVersionCode) },
  { key: 'style', title: '商品信息', width: 260, required: true, freezeable: true, render: (row) => `<div class="flex items-center gap-3">${row.imageUrl ? `<button type="button" class="h-12 w-12 overflow-hidden rounded border" aria-label="查看${escapeHtml(row.styleName)}大图" data-tech-data-action="open-image" data-image-url="${escapeHtml(row.imageUrl)}" data-image-title="${escapeHtml(row.styleName)}"><img loading="lazy" class="h-full w-full object-cover" src="${escapeHtml(row.imageUrl)}" alt="${escapeHtml(row.styleName)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="text-[10px] text-slate-500">图片失败</span></button>` : '<span class="flex h-12 w-12 items-center justify-center rounded border text-[10px] text-slate-400">暂无图片</span>'}<div><p class="font-medium">${escapeHtml(row.styleName)}</p><p class="text-xs text-slate-500">${escapeHtml(row.styleCode)} · ${escapeHtml(row.brandName || '未设置品牌')}</p></div></div>` },
  { key: 'status', title: '状态', width: 120, render: (row) => escapeHtml(row.versionStatus === 'PUBLISHED' ? (row.missingItemCodes.length ? '已发布 · 资料待补齐' : '已发布') : row.versionStatus === 'ARCHIVED' ? '已归档' : '草稿') },
  { key: 'version', title: '版本', width: 100, render: (row) => escapeHtml(row.versionLabel) },
  { key: 'complete', title: '完整度', width: 100, render: (row) => `${row.completenessScore}%` },
  { key: 'difficulty', title: '做货难度', width: 100, render: (row) => escapeHtml(row.garmentDifficultyGrade) },
  { key: 'merchandiser', title: '跟单', width: 130, render: (row) => responsibleSelect(row, '跟单') },
  { key: 'patternMaker', title: '版师', width: 130, render: (row) => responsibleSelect(row, '版师') },
  { key: 'buyer', title: '买手', width: 130, render: (row) => escapeHtml(row.buyerName || '-') },
  { key: 'productionOrders', title: '关联生产单', width: 240, render: (row) => row.productionOrderIds.length ? `<div class="flex flex-wrap gap-1">${row.productionOrderIds.map(id => `<a class="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700" href="/fcs/production/orders/${escapeHtml(id)}" data-nav="/fcs/production/orders/${escapeHtml(id)}">${escapeHtml(id)}</a>`).join('')}</div>` : '<span class="text-slate-400">暂无关联生产单</span>' },
  { key: 'source', title: '来源', width: 180, render: (row) => escapeHtml(row.createdFromTaskType === 'ENGINEERING_MASTER' ? `生产准备单 · ${row.sourceProjectCode}` : `${row.createdFromTaskType === 'PLATE' ? '历史制版' : row.createdFromTaskType === 'REVISION' ? '历史改款' : '历史来源'} · ${row.createdFromTaskCode || row.sourceProjectCode || '-'}`) },
  { key: 'created', title: '时间', width: 220, render: (row) => `<p>创建：${escapeHtml(row.createdAt)}</p><p class="mt-1 text-xs text-slate-500">更新：${escapeHtml(row.updatedAt)}</p>` },
  { key: 'actions', title: '操作', width: 140, required: true, actionColumn: true, render: (row) => `<button type="button" class="rounded border px-3 py-1 text-xs text-blue-700" data-nav="/pcs/products/styles/${escapeHtml(row.styleId)}/technical-data/${escapeHtml(row.technicalVersionId)}">查看</button><button type="button" class="ml-2 rounded border px-3 py-1 text-xs" data-tech-data-action="open-log" data-technical-version-id="${escapeHtml(row.technicalVersionId)}">日志</button>` },
]
const preferences: StandardListColumnPreferences = { order: columns.map((column) => column.key), visibleKeys: columns.map((column) => column.key), frozenKeys: ['id', 'style'], pageSize: 20 }

function responsibleSelect(row: TechPackRow, role: '跟单' | '版师'): string {
  const currentName = role === '跟单' ? row.merchandiserName : row.patternMakerName
  const currentId = role === '跟单' ? row.merchandiserId || row.merchandiserReview?.assignedReviewerId : row.patternMakerId || row.patternMakerReview?.assignedReviewerId
  const people = listTechPackReviewersByRole(role)
  const historicalOption = currentName && !people.some(person => person.reviewerId === currentId) ? `<option value="" selected>${escapeHtml(currentName)}</option>` : ''
  return `<select class="h-8 w-full rounded border bg-white px-2 text-xs" aria-label="技术包 ${escapeHtml(row.technicalVersionCode)} ${role}" data-tech-data-action="assign-person" data-technical-version-id="${escapeHtml(row.technicalVersionId)}" data-person-role="${role}">${historicalOption || '<option value="">请选择</option>'}${people.map(person => `<option value="${escapeHtml(person.reviewerId)}" ${person.reviewerId === currentId ? 'selected' : ''}>${escapeHtml(person.reviewerName)}</option>`).join('')}</select>`
}

function engineeringVersions(): TechPackRow[] {
  // Resolve the shared attribute dictionary once for this render, rather than once per row.
  const styles = new Map(listStyleArchives().map(style => [style.styleId, style]))
  return listTechnicalDataVersions().map((row) => {
    const style = styles.get(row.styleId)
    return { ...row, imageUrl: resolveStableStyleImage(row.styleName, style?.mainImageUrl || style?.galleryImageUrls[0] || ''), brandName: style?.brandName || '', merchandiserName: row.merchandiserName || row.merchandiserReview?.assignedReviewerName || '', patternMakerName: row.patternMakerName || row.patternMakerReview?.assignedReviewerName || '', buyerName: style?.buyerName || '', productionOrderIds: [...new Set([...productionDemands.filter(demand => demand.spuCode === row.styleCode && demand.techPackVersionLabel.toLowerCase() === row.versionLabel.toLowerCase() && row.versionStatus === 'PUBLISHED' && demand.hasProductionOrder && demand.productionOrderId).map(demand => demand.productionOrderId!), ...productionOrderRuntimeStore.filter(order => order.demandSnapshot.spuCode === row.styleCode && (order.selectedTechPackVersionId === row.technicalVersionId || order.techPackSnapshot?.sourceTechPackVersionId === row.technicalVersionId)).map(order => order.productionOrderId)])] }
  })
}
export function renderTechnicalLogModal(): string {
  if (!technicalLogModal.versionId) return ''
  const record = listTechnicalDataVersions().find(item => item.technicalVersionId === technicalLogModal.versionId)
  if (!record) return ''
  const logs = listTechPackVersionLogsByVersionId(record.technicalVersionId)
  const baselineLogs = [{ time: record.createdAt, type: '创建技术包', text: record.createdFromTaskType === 'ENGINEERING_MASTER' ? `由生产准备单 ${record.sourceProjectCode} 生成。` : `历史来源：${record.createdFromTaskType === 'PLATE' ? '制版任务' : record.createdFromTaskType === 'REVISION' ? '改款任务' : '历史任务'} ${record.createdFromTaskCode || record.sourceProjectCode}。`, actor: record.createdBy }, ...(record.reviewSubmittedAt ? [{ time: record.reviewSubmittedAt, type: '提交审核', text: `审核阶段：${record.reviewStage || '未提交审核'}`, actor: record.reviewSubmittedBy || record.createdBy }] : []), ...(record.versionStatus === 'PUBLISHED' ? [{ time: record.publishedAt, type: '发布正式版本', text: `${record.versionLabel} · 完整度 ${record.completenessScore}%`, actor: record.publishedBy }] : [])]
  const rows = [...logs.map(log => ({ time: log.createdAt, type: log.logType, text: log.changeText, actor: log.createdBy })), ...baselineLogs].sort((a, b) => b.time.localeCompare(a.time))
  return `<div class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-5" role="dialog" aria-modal="true" aria-labelledby="technical-pack-log-title"><section class="max-h-[80vh] w-full max-w-4xl overflow-auto rounded-lg bg-white shadow-xl"><header class="flex items-center justify-between border-b p-4"><h2 id="technical-pack-log-title" class="font-semibold">日志 · 技术包 ${escapeHtml(record.technicalVersionCode)} · ${escapeHtml(record.styleCode)}</h2><button type="button" class="rounded border px-3 py-1" data-tech-data-action="close-log">关闭</button></header><table class="w-full text-left text-sm"><thead class="bg-slate-50"><tr><th class="p-3">时间</th><th class="p-3">操作类型</th><th class="p-3">说明</th><th class="p-3">操作人</th></tr></thead><tbody>${rows.map(row => `<tr class="border-t"><td class="whitespace-nowrap p-3">${escapeHtml(row.time)}</td><td class="whitespace-nowrap p-3">${escapeHtml(row.type)}</td><td class="p-3">${escapeHtml(row.text)}</td><td class="whitespace-nowrap p-3">${escapeHtml(row.actor)}</td></tr>`).join('')}</tbody></table></section></div>`
}

function filteredRows(sourceRows: TechPackRow[]): TechPackRow[] {
  const keyword = technicalListState.keyword.trim().toLowerCase()
  let rows = sourceRows.filter((row) => {
    if (keyword && ![row.technicalVersionCode, row.styleCode, row.styleName, row.sourceProjectCode, ...row.productionOrderIds].join(' ').toLowerCase().includes(keyword)) return false
    if (technicalListState.status && row.versionStatus !== technicalListState.status) return false
    if (technicalListState.review && row.reviewStage !== technicalListState.review) return false
    if (technicalListState.brand && row.brandName !== technicalListState.brand) return false
    if (technicalListState.completeness === 'COMPLETE' && row.completenessScore !== 100) return false
    if (technicalListState.completeness === 'INCOMPLETE' && row.completenessScore === 100) return false
    if (technicalListState.difficulty && row.garmentDifficultyGrade !== technicalListState.difficulty) return false
    if (technicalListState.merchandiser && row.merchandiserName !== technicalListState.merchandiser) return false
    if (technicalListState.patternMaker && row.patternMakerName !== technicalListState.patternMaker) return false
    if (technicalListState.createdFrom && (row.createdAt || '').slice(0, 10) < technicalListState.createdFrom) return false
    if (technicalListState.createdTo && (row.createdAt || '').slice(0, 10) > technicalListState.createdTo) return false
    if (technicalListState.needMyAudit && !['第一阶段并行审核', '跟单复核'].includes(row.reviewStage || '')) return false
    return true
  })
  if (technicalListState.spuDistinct) { const seen = new Set<string>(); rows = rows.filter((row) => seen.has(row.styleId) ? false : (seen.add(row.styleId), true)) }
  return rows
}
function renderFilters(rows: TechPackRow[]): string {
  const options = (values: string[], selected: string) => [...new Set(values.filter(Boolean))].map((value) => `<option value="${escapeHtml(value)}" ${selected === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')
  return `<div class="grid grid-cols-2 gap-2 xl:grid-cols-6"><input class="h-9 rounded border px-3 text-sm xl:col-span-2" placeholder="技术包 ID / SPU / 生产准备单 / 生产单" value="${escapeHtml(technicalListState.keyword)}" data-tech-data-field="keyword"><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="status"><option value="">全部状态</option><option value="DRAFT" ${technicalListState.status === 'DRAFT' ? 'selected' : ''}>草稿</option><option value="PUBLISHED" ${technicalListState.status === 'PUBLISHED' ? 'selected' : ''}>已发布</option><option value="ARCHIVED" ${technicalListState.status === 'ARCHIVED' ? 'selected' : ''}>已归档</option></select><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="review"><option value="">全部审核阶段</option>${['未提交审核','第一阶段并行审核','跟单复核','待发布','已发布'].map((value) => `<option value="${value}" ${technicalListState.review === value ? 'selected' : ''}>${value}</option>`).join('')}</select><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="brand"><option value="">全部品牌</option>${options(rows.map((row) => row.brandName), technicalListState.brand)}</select><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="completeness"><option value="">全部完整度</option><option value="COMPLETE" ${technicalListState.completeness === 'COMPLETE' ? 'selected' : ''}>100%</option><option value="INCOMPLETE" ${technicalListState.completeness === 'INCOMPLETE' ? 'selected' : ''}>未完整</option></select><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="difficulty"><option value="">全部做货难度</option>${['A','A+','A++','B','C','D'].map((value) => `<option value="${value}" ${technicalListState.difficulty === value ? 'selected' : ''}>${value}</option>`).join('')}</select><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="merchandiser"><option value="">全部跟单</option>${options(rows.map((row) => row.merchandiserName), technicalListState.merchandiser)}</select><select class="h-9 rounded border px-2 text-sm" data-tech-data-field="patternMaker"><option value="">全部版师</option>${options(rows.map((row) => row.patternMakerName), technicalListState.patternMaker)}</select><input type="date" aria-label="创建开始日期" class="h-9 rounded border px-2 text-sm" value="${technicalListState.createdFrom}" data-tech-data-field="createdFrom"><input type="date" aria-label="创建结束日期" class="h-9 rounded border px-2 text-sm" value="${technicalListState.createdTo}" data-tech-data-field="createdTo"><div class="flex items-center gap-2 xl:col-span-2"><label class="flex h-9 items-center gap-2 rounded border px-3 text-sm"><input type="checkbox" data-tech-data-field="needMyAudit" ${technicalListState.needMyAudit ? 'checked' : ''}>待我审核</label><label class="flex h-9 items-center gap-2 rounded border px-3 text-sm"><input type="checkbox" data-tech-data-field="spuDistinct" ${technicalListState.spuDistinct ? 'checked' : ''}>SPU 去重</label><button type="button" class="h-9 rounded bg-blue-600 px-4 text-sm text-white" data-tech-data-action="search">查询</button></div></div>`
}
export function renderTechnicalImagePreview(): string {
  if (!technicalImagePreview.value) return ''
  return `<div class="fixed inset-0 z-[80] flex items-center justify-center p-5" role="dialog" aria-modal="true"><button class="absolute inset-0 bg-slate-950/70" data-tech-data-action="close-image" aria-label="关闭大图"></button><section class="relative z-10 max-h-full max-w-5xl overflow-auto rounded-lg bg-white p-4"><div class="mb-3 flex items-center justify-between gap-4"><h2 class="font-semibold">${escapeHtml(technicalImagePreview.value.title)}</h2><button class="rounded border px-3 py-1" data-tech-data-action="close-image">关闭</button></div><img class="max-h-[80vh] max-w-full object-contain" src="${escapeHtml(technicalImagePreview.value.url)}" alt="${escapeHtml(technicalImagePreview.value.title)}"></section></div>`
}
export function renderPcsTechnicalDataTechPackListPage(): string {
  const sourceRows = engineeringVersions(); const rows = filteredRows(sourceRows); const paging = paginateStandardListRows(rows, technicalListState.currentPage, technicalListState.pageSize); technicalListState.currentPage = paging.currentPage; preferences.pageSize = technicalListState.pageSize
  return `<div data-pcs-technical-data-page>${technicalAssignmentFeedback.message ? `<p role="status" class="mb-3 rounded border p-3 text-sm ${technicalAssignmentFeedback.ok ? 'text-green-700' : 'text-red-700'}">${escapeHtml(technicalAssignmentFeedback.message)}</p>` : ''}${renderStandardListPage({ title: '技术包列表', primaryActionsHtml: '<span class="text-sm text-slate-500">技术包仅由生产准备单生成</span>', filtersHtml: renderFilters(sourceRows), statsHtml: renderStandardListStats([{ label: '技术包数量', value: rows.length }, { label: 'SPU 数量', value: new Set(rows.map((row) => row.styleId)).size }, { label: '待审核', value: rows.filter((row) => row.versionStatus === 'DRAFT' && row.reviewStage !== '未提交审核').length }]), listTitle: '技术包', tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences, sort: null, eventPrefix: 'tech-data', emptyText: '暂无符合条件的技术包' }), paginationHtml: `<div aria-label="技术包分页">${renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: 'tech-data', pageSizeOptions: PAGE_SIZE_OPTIONS })}</div>`, overlaysHtml: renderTechnicalImagePreview() + renderTechnicalLogModal() })}</div>`
}
