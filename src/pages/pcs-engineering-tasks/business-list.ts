import { getEngineeringTechPackTaskView } from '../../data/pcs-engineering-tech-pack-workspace.ts'
import { getMaterialArchiveById, getMaterialSkuRecordById } from '../../data/pcs-material-archive-repository.ts'
// 七类专业任务的只读业务列表；复用染色加工单的标准列表与查询呈现。
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import { renderProcessOrderStats, renderProcessFilterToggle, handleProcessFilterPresentation } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { getEngineeringMasterOrderById } from '../../data/pcs-engineering-master-repository.ts'
import { listEngineeringIndependentSamplingRecords, getEngineeringIndependentProfessionalTaskCurrentTeam } from '../../data/pcs-engineering-master-sampling.ts'
import { getStyleArchiveById } from '../../data/pcs-style-archive-repository.ts'
import { listEngineeringPatternResultVersions } from '../../data/pcs-engineering-pattern-result.ts'
import { computeAccessoryPurchaseTaskLinkage } from '../../data/pcs-engineering-purchase-linkage.ts'
import { summarizeEngineeringTaskItems } from '../../data/pcs-engineering-task-item-progress.ts'
import type { EngineeringTaskType } from '../../data/pcs-engineering-master-types.ts'
import { listEngineeringTasksByType, getEngineeringTaskListDetailPath, getEngineeringTaskSourceSummary } from './master-task-common.ts'
import { renderStatusBadge } from './shared.ts'
import { escapeHtml } from '../../utils.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'

export type ProfessionalListKind = 'plate' | 'pattern' | 'color' | 'purchase' | 'firstSample' | 'displaySample' | 'techPack'
const CONFIG: Record<ProfessionalListKind, { title: string; path: string; types: EngineeringTaskType[] }> = {
  plate: { title: '制版任务', path: 'plate-making', types: ['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT', 'SIZE_PATTERN_WOVEN', 'SIZE_PATTERN_KNIT'] },
  pattern: { title: '花型任务', path: 'artwork', types: ['PATTERN_ARTWORK'] },
  color: { title: '调色任务', path: 'color', types: ['COLOR_YARN', 'COLOR_FABRIC'] },
  purchase: { title: '辅料下单任务', path: 'purchase', types: ['ACCESSORY_PURCHASE'] },
  firstSample: { title: '首单样衣任务', path: 'first-sample', types: ['PRE_PRODUCTION_SAMPLE'] },
  displaySample: { title: '销售展示样衣任务', path: 'display-sample', types: [] },
  techPack: { title: '技术包确认任务', path: 'tech-pack', types: ['TECH_PACK_CONFIRMATION'] },
}
interface BusinessRow {
  id: string; name: string; path: string; source: string; sourceType: string; sourcePath: string
  style: string; styleImage: string; status: string; team: string; assignee: string; merchandiser: string
  planned: string; started: string; submitted: string; completed: string
  requirementHtml: string; requirementText: string; progress: string; next: string; result: string
}
const small = (text: string) => `<p class="mt-1 text-xs text-slate-500">${escapeHtml(text)}</p>`
const link = (path: string, label: string) => `<a href="${escapeHtml(path)}" class="font-medium text-blue-700 hover:underline">${escapeHtml(label)}</a>`
function requirements(items: string[], summary: string): string {
  if (!items.length) return small('未登记具体要求')
  return `<div class="space-y-2">${items.slice(0, 1).join('')}${items.length > 1 ? `<details><summary class="cursor-pointer text-xs text-blue-700">${escapeHtml(summary)} · 展开其余 ${items.length - 1} 项</summary><div class="mt-2 space-y-3">${items.slice(1).join('')}</div></details>` : ''}</div>`
}
function image(url: string, title: string): string {
  if (!url) return '<span class="text-xs text-amber-700">缺少对应图片</span>'
  return `<button type="button" class="relative h-16 w-12 shrink-0 overflow-hidden rounded border" data-business-image="${escapeHtml(url)}" data-image-title="${escapeHtml(title)}" aria-label="查看${escapeHtml(title)}大图"><img src="${escapeHtml(url)}" alt="${escapeHtml(title)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败'"><span class="absolute inset-0 flex items-center justify-center bg-white text-[10px]">图片加载中</span></button>`
}
export function buildProfessionalBusinessRows(kind: ProfessionalListKind): BusinessRow[] {
  if (kind === 'displaySample') return listEngineeringIndependentSamplingRecords().flatMap(record => record.professionalTasks.filter(task => task.taskType === 'DISPLAY_SAMPLE').map(task => {
    const style = getStyleArchiveById(record.targetStyleId)
    const needs = task.sampleRequirements || []
    const details = needs.map(need => {
      const actual = task.results.filter(result => result.requirementLineId === need.requirementLineId)
      const quantity = actual.reduce((sum, result) => sum + result.sampleQuantity, 0)
      return `${need.targetColor} / ${need.targetSize}：应做 ${need.requiredQuantity} 件，已提交 ${quantity} 件${actual.some(result => result.differenceNote) ? '；有差异说明' : ''}`
    })
    const statuses = { WAIT_DEPENDENCY: '待前置', WAIT_START: '待开始', IN_PROGRESS: '进行中', WAIT_REVIEW: '待审核', REWORK: '返工中', COMPLETED: '已完成' }
    return {
      id: task.taskId, name: '销售展示样衣', path: `/pcs/production-preparation/display-sample/${task.taskId}`,
      source: record.samplingTaskCode, sourceType: '设计改款任务', sourcePath: `/pcs/production-preparation/design-revision/${record.samplingTaskId}`,
      style: `${record.targetStyleCode || '线下临时 SPU'} · ${record.temporarySpuName || record.targetStyleName}`, styleImage: style?.mainImageUrl || record.designFiles.at(-1)?.dataUrl || '',
      status: statuses[task.status], team: getEngineeringIndependentProfessionalTaskCurrentTeam(task), assignee: '', merchandiser: record.merchandiserName,
      planned: task.plannedCompleteAt, started: task.startedAt, submitted: task.submittedAt, completed: task.completedAt,
      requirementHtml: requirements(details.map(text => `<p class="text-xs">${escapeHtml(text)}</p>`), `${needs.length} 个颜色尺码要求`), requirementText: details.join('；'),
      progress: `应做 ${needs.reduce((sum, need) => sum + need.requiredQuantity, 0)} 件 / 已提交 ${task.results.reduce((sum, result) => sum + result.sampleQuantity, 0)} 件`,
      next: task.status === 'COMPLETED' ? '查看样衣成果' : task.status === 'WAIT_DEPENDENCY' ? '等待前置工作完成' : task.status === 'WAIT_REVIEW' ? '买手审核样衣成果' : task.status === 'REWORK' ? '按退回意见重新制作' : '制作并逐项提交样衣',
      result: task.results.map(result => `${result.title} ${result.version}${result.rejectReason ? `；退回：${result.rejectReason}` : ''}`).join('；') || '尚未提交样衣成果',
    }
  }))
  return listEngineeringTasksByType(CONFIG[kind].types).map(task => {
    const master = getEngineeringMasterOrderById(task.masterOrderId)
    const source = getEngineeringTaskSourceSummary(task)
    const style = getStyleArchiveById(master?.styleId || task.targetStyleId)
    const purchase = kind === 'purchase' && master ? computeAccessoryPurchaseTaskLinkage(master.masterOrderId, task.taskId) : null
    const progress = summarizeEngineeringTaskItems(task, purchase?.gate.coveredMaterialSkuIds || [])
    let requirementText = '', requirementHtml = '', progressText = '', result = task.resultSummary || '尚未登记成果'
    if (progress.applicable) {
      const lines = progress.lines.map(line => {
        const done = kind === 'purchase' ? purchase?.gate.coveredMaterialSkuIds.includes(line.materialSkuId) : line.reviewStatus === '通过'
        const info = [line.materialSkuId, line.productColor && `成衣色 ${line.productColor}`, line.printProcess, line.colorName, line.pantoneColorCode, line.dyeFactoryName, kind === 'purchase' ? done ? '已覆盖下单' : '尚未覆盖下单' : line.reviewStatus, line.reviewReason].filter(Boolean).join(' · ')
        const sku = getMaterialSkuRecordById(line.materialSkuId), material = sku ? getMaterialArchiveById(sku.materialId) : null
        return { text: `${line.materialName} ${info}`, html: `<div class="flex items-start gap-2">${image(sku?.skuImageUrl || material?.mainImageUrl || '', line.materialName)}<div><p>${escapeHtml(line.materialName)}</p>${small(info)}</div></div>` }
      })
      requirementText = lines.map(line => line.text).join('；')
      requirementHtml = requirements(lines.map(line => line.html), `共 ${progress.total} 条有效要求`)
      progressText = progress.total ? `${kind === 'purchase' ? '已覆盖' : '已通过'} ${progress.completed}/${progress.total} 项 · 剩余 ${progress.remaining.length} 项` : '尚无有效明细，不能判定完成'
      if (kind === 'purchase') result = purchase?.purchaseOrders.map(order => order.accessStatus === '可读取' ? `${order.purchaseOrderNo} · ${order.supplierName} · ${order.status} · 下单 ${order.orderedAt || '未登记'}` : `${order.purchaseOrderNo} · 无权读取`).join('；') || '尚未绑定采购单'
      else result = `${progress.pendingReview} 项待审核 · ${progress.rework} 项返工；${kind === 'color' ? `染色要求${task.colorRequirementConfirmedAt ? `已由 ${task.colorRequirementConfirmedBy} 确认` : '未确认'}` : `第 ${task.currentRoundNo} 轮成果`}`
    } else if (kind === 'plate') {
      const version = listEngineeringPatternResultVersions(task.taskId)[0]
      const independent = !master ? listEngineeringIndependentSamplingRecords().find(record => record.samplingTaskId === task.sourceId)?.professionalTasks.find(item => item.taskId === task.taskId) : null
      requirementText = `${task.taskName}；尺码 ${version?.applicableSizes.join('、') || independent?.results.map(item => item.applicablePartOrSize).filter(Boolean).join('、') || '尚未登记'} `
      requirementHtml = `<p>${escapeHtml(requirementText)}</p>`
      result = version ? `${version.versionLabel} · ${version.sourceFiles.length} 份纸样文件 · ${version.submittedBy}` : independent?.results.length ? independent.results.map(item => `${item.title} · ${item.version} · ${item.files.filter(file => file.purpose === 'PATTERN_SOURCE').length} 份纸样文件`).join('；') : task.resultSummary || '尚未提交纸样版本'
    } else if (kind === 'firstSample') {
      const needs = task.sampleRequirements || []
      const details = needs.map(need => `${need.targetColor} / ${need.targetSize}：应做 ${need.requiredQuantity} 件，实做 ${(task.sampleActuals || []).filter(actual => actual.requirementLineId === need.requirementLineId).reduce((sum, actual) => sum + actual.actualQuantity, 0)} 件`)
      requirementText = details.join('；')
      requirementHtml = requirements(details.map(text => `<p>${escapeHtml(text)}</p>`), `${needs.length} 个颜色尺码要求`)
      progressText = `应做 ${needs.reduce((sum, need) => sum + need.requiredQuantity, 0)} 件 / 实做 ${(task.sampleActuals || []).reduce((sum, actual) => sum + actual.actualQuantity, 0)} 件`
      result = (task.sampleActuals || []).map(actual => `${actual.actualColor}/${actual.actualSize} · 纸样 ${actual.sourcePatternVersion || '未登记'}${actual.differenceNote ? ` · 差异 ${actual.differenceNote}` : ''}`).join('；') || result
    } else if (kind === 'techPack') {
      const dependencies = task.dependsOnTaskIds.map(id => master?.tasks.find(item => item.taskId === id))
      const done = dependencies.filter(item => item && ['已完成', '因需求变更结束'].includes(item.status)).length
      const details = dependencies.map(item => {
        if (!item) return '前置记录缺失'
        const covered = item.taskType === 'ACCESSORY_PURCHASE' && master ? computeAccessoryPurchaseTaskLinkage(master.masterOrderId, item.taskId).gate.coveredMaterialSkuIds : []
        const items = summarizeEngineeringTaskItems(item, covered)
        return `${item.taskName}：${item.status}${items.applicable ? `（明细 ${items.completed}/${items.total} 项）` : ''}`
      })
      requirementText = details.join('；'); requirementHtml = requirements(details.map(text => `<p>${escapeHtml(text)}</p>`), `${dependencies.length} 项前置`)
      progressText = `前置完成 ${done}/${dependencies.length} 项`
      const view = master ? getEngineeringTechPackTaskView(master.masterOrderId) : null
      result = view?.latestVersion ? `${view.latestVersion.versionLabel} · ${({ DRAFT: '草稿', PUBLISHED: '已发布', ARCHIVED: '已归档' })[view.latestVersion.versionStatus]}；${view.reviews.map(item => `${item.role} ${item.status}`).join('；')}` : `BOM ${master?.bomVersionIds.length || 0} 个版本；尚未生成技术包`
    }
    const pending = task.dependsOnTaskIds.map(id => master?.tasks.find(item => item.taskId === id)).filter(item => !item || !['已完成', '因需求变更结束'].includes(item.status))
    const ended = ['已完成', '未启用', '因需求变更结束'].includes(task.status)
    const next = purchase && !purchase.gate.complete ? purchase.gate.blockReason
      : ended ? task.status === '已完成' ? '查看已完成成果' : task.status
      : task.status === '待前置' ? `等待：${pending.map(item => item?.taskName || '缺失的前置记录').join('、')}`
      : task.status === '待审核' ? '审核全部待审核成果' : task.status === '返工中' ? '处理未通过明细' : task.status === '待开始' ? '开始任务' : '继续办理并提交成果'
    return {
      id: task.taskId, name: task.taskName, path: getEngineeringTaskListDetailPath(task, `/pcs/production-preparation/${CONFIG[kind].path}`),
      source: source.code, sourceType: source.label, sourcePath: master ? `/pcs/production-preparation/orders/${master.masterOrderId}` : `/pcs/production-preparation/design-revision/${task.sourceId}`,
      style: `${master?.styleCode || task.targetStyleCode} · ${master?.styleName || task.targetStyleName}`, styleImage: style?.mainImageUrl || '',
      status: task.status, team: ended ? '' : task.status === '待审核' && ['pattern', 'color'].includes(kind) ? '买手' : kind === 'color' && !task.colorRequirementConfirmedAt ? '跟单' : task.ownerTeamName, assignee: task.assigneeName, merchandiser: master?.merchandiserName || '',
      planned: task.plannedCompleteAt, started: task.startedAt, submitted: task.submittedAt, completed: task.effectiveCompletedAt,
      requirementHtml, requirementText, progress: progressText, next, result,
    }
  })
}

interface Filters { keyword: string; status: string; team: string; source: string; assignee: string; dateFrom: string; dateTo: string }
const emptyFilters = (): Filters => ({ keyword: '', status: '', team: '', source: '', assignee: '', dateFrom: '', dateTo: '' })
export function filterProfessionalBusinessRows(rows: BusinessRow[], filters: Filters): BusinessRow[] {
  return rows.filter(row => (!filters.keyword || [row.id, row.name, row.source, row.style, row.requirementText, row.result, row.merchandiser].join(' ').toLowerCase().includes(filters.keyword.trim().toLowerCase()))
    && (!filters.status || row.status === filters.status) && (!filters.team || row.team === filters.team) && (!filters.source || row.sourceType === filters.source)
    && (!filters.assignee || row.assignee.includes(filters.assignee.trim()))
    && (!filters.dateFrom || Boolean(row.planned) && row.planned.slice(0, 10) >= filters.dateFrom)
    && (!filters.dateTo || Boolean(row.planned) && row.planned.slice(0, 10) <= filters.dateTo))
}
const pages = new Map<ProfessionalListKind, ReturnType<typeof createPage>>()
function createPage(kind: ProfessionalListKind) {
  const config = CONFIG[kind], prefix = `pcs-business-${CONFIG[kind].path}`, rootSelector = `[data-professional-list="${kind}"]`
  let applied = emptyFilters(), notice = '', installed = false
  const state: ProcessOrderListControllerState = { currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false }
  const rows = () => filterProfessionalBusinessRows(buildProfessionalBusinessRows(kind), applied)
  const columns: StandardListColumn<BusinessRow>[] = [
    { key: 'identity', title: '任务／款式与来源', width: 270, required: true, freezeable: true, sortable: true, sortValue: row => row.id, render: row => `${link(row.path, row.name)}${small(row.id)}<div class="my-2 flex items-center gap-2">${image(row.styleImage, row.style)}<span class="text-xs">${escapeHtml(row.style)}</span></div>${link(row.sourcePath, row.source)}${small(`${row.sourceType} · 跟单 ${row.merchandiser || '未登记'}`)}` },
    { key: 'requirements', title: '业务要求／执行明细', width: 340, required: true, render: row => row.requirementHtml || small('具体要求见任务详情') },
    { key: 'progress', title: '进度／当前事项', width: 230, required: true, sortable: true, sortValue: row => row.status, render: row => `${renderStatusBadge(row.status)}${small(row.progress)}<p class="mt-2 text-xs">${escapeHtml(row.next)}</p>` },
    { key: 'responsibility', title: '责任／计划', width: 185, sortable: true, sortValue: row => row.planned, render: row => `<p>${escapeHtml(row.team || '当前无待办团队')}</p>${small(`执行人 ${row.assignee || '未登记'}`)}${small(`计划完成 ${row.planned || '未设置'}`)}` },
    { key: 'results', title: '成果／时间', width: 270, render: row => `<p class="whitespace-normal text-xs">${escapeHtml(row.result)}</p>${small(`开始 ${row.started || '未开始'}`)}${small(`提交 ${row.submitted || '未提交'}`)}${small(`完成 ${row.completed || '未完成'}`)}` },
    { key: 'actions', title: '操作', width: 110, required: true, actionColumn: true, render: row => link(row.path, row.status === '已完成' ? '查看成果' : '进入任务') },
  ]
  const controller = createProcessOrderListController({ state, columns, preferenceKey: `higood:pcs:${config.path}:business-list:v1`, pageSizeOptions: [10, 20, 50], eventPrefix: prefix, rootSelector, tableSurfaceSelector: '[data-business-table]', paginationSurfaceSelector: '[data-business-pagination]', overlaysSurfaceSelector: '[data-business-overlay]', defaultFrozenKeys: [], columnSettingsTitle: `${config.title}列设置`, emptyText: '暂无符合查询条件的任务', getRows: rows, locallyManagedEvents: true })
  const stats = () => { const data = rows(); return renderProcessOrderStats([{ label: '查询任务', value: data.length }, ...['待开始', '进行中', '待审核', '返工中', '已完成'].map(status => ({ label: status, value: data.filter(row => row.status === status).length }))]) }
  function filters() {
    const all = buildProfessionalBusinessRows(kind)
    const field = (label: string, html: string) => `<label class="block space-y-1 text-sm"><span class="text-slate-600">${label}</span>${html}</label>`
    const input = (key: keyof Filters, type = 'text') => `<input type="${type}" class="h-9 w-full rounded-md border px-3 text-sm" data-business-filter="${key}" value="${escapeHtml(applied[key])}" data-skip-page-rerender="true">`
    const select = (key: keyof Filters, values: string[]) => `<select class="h-9 w-full rounded-md border px-3 text-sm" data-business-filter="${key}" data-skip-page-rerender="true"><option value="">全部</option>${[...new Set(values.filter(Boolean))].map(value => `<option value="${escapeHtml(value)}" ${applied[key] === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select>`
    return `<div class="rounded-lg border bg-white p-4"><div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">${field('关键词（任务／来源／款式／明细）', input('keyword'))}${field('任务状态', select('status', ['待前置', '待开始', '进行中', '待审核', '返工中', '已完成', '未启用', '因需求变更结束']))}${field('当前责任团队', select('team', all.map(row => row.team)))}${field('任务来源', select('source', all.map(row => row.sourceType)))}<div class="[&:not([hidden])]:contents" data-process-advanced hidden>${field('执行人', input('assignee'))}${field('计划完成起始日', input('dateFrom', 'date'))}${field('计划完成截止日', input('dateTo', 'date'))}</div></div><div class="mt-3 flex flex-wrap gap-2">${renderPrimaryButton('查询', { prefix, action: 'query' }, 'search')}${renderSecondaryButton('重置', { prefix, action: 'reset' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix, action: 'export' }, 'download')}${renderProcessFilterToggle(0, 'button')}</div><p class="mt-2 text-xs text-amber-700" role="status" data-business-notice>${escapeHtml(notice)}</p></div>`
  }
  function refresh() {
    controller.refresh({ overlays: true })
    const root = document.querySelector(rootSelector)
    const box = root?.querySelector('[data-business-stats]'); if (box) box.innerHTML = stats()
    const feedback = root?.querySelector('[data-business-notice]'); if (feedback) feedback.textContent = notice
    bindImages()
  }
  function bindImages() {
    document.querySelectorAll<HTMLImageElement>(`${rootSelector} img`).forEach(img => { if (img.complete && img.naturalWidth) { const note = img.nextElementSibling as HTMLElement | null; if (note?.tagName === 'SPAN') note.hidden = true } })
  }
  function install() {
    if (installed || typeof document === 'undefined') return
    installed = true; controller.installColumnDragEvents()
    document.addEventListener('click', event => {
      const target = event.target instanceof HTMLElement ? event.target : null
      const root = target?.closest<HTMLElement>(rootSelector); if (!target || !root) return
      if (handleProcessFilterPresentation(root, target)) { event.stopPropagation(); return }
      const picture = target.closest<HTMLElement>('[data-business-image], [data-engineering-task-action="preview-image"]')
      if (picture) {
        event.stopPropagation()
        const url = picture.dataset.businessImage || picture.dataset.imageUrl || '', title = picture.dataset.imageTitle || ''
        const host = root.querySelector('[data-business-image-dialog]')!
        host.innerHTML = `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" data-business-close-image><div role="dialog" aria-label="${escapeHtml(title)}" class="max-h-full max-w-full rounded bg-white p-3"><button class="mb-2 rounded border px-3 py-1" data-business-close-image>关闭大图</button><img src="${escapeHtml(url)}" alt="${escapeHtml(title)}" class="max-h-[80vh] max-w-[85vw] object-contain" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败，请关闭后重试'"><p class="text-sm text-slate-500">图片加载中</p></div></div>`
        return
      }
      if (target.closest('[data-business-close-image]') && (target.matches('[data-business-close-image]') || target.closest('button[data-business-close-image]'))) { root.querySelector('[data-business-image-dialog]')!.innerHTML = ''; event.stopPropagation(); return }
      const button = target.closest<HTMLElement>(`[data-${prefix}-action]`); if (!button) return
      event.stopPropagation()
      const action = button.getAttribute(`data-${prefix}-action`) || '', key = button.getAttribute(`data-${prefix}-column-key`) || button.dataset.columnKey || ''
      notice = ''
      if (action === 'query') {
        const next = emptyFilters(); root.querySelectorAll<HTMLInputElement>('[data-business-filter]').forEach(field => { next[field.dataset.businessFilter as keyof Filters] = field.value })
        if (next.dateFrom && next.dateTo && next.dateFrom > next.dateTo) notice = '起始日期不能晚于截止日期，请调整后查询。'
        else { applied = next; state.currentPage = 1 }
      } else if (action === 'reset') { applied = emptyFilters(); state.currentPage = 1; root.querySelector('[data-business-filters]')!.innerHTML = filters() }
      else if (action === 'export') { const data = rows(); if (!data.length) notice = '当前查询没有可导出的任务。'; else downloadPmsCsv(`${config.title}.csv`, ['任务号', '任务名称', '来源单号', '来源类型', '款式', '状态', '责任团队', '执行人', '计划完成', '业务要求', '明细进度', '当前事项', '成果', '完成时间'], data.map(row => [row.id, row.name, row.source, row.sourceType, row.style, row.status, row.team, row.assignee, row.planned, row.requirementText, row.progress, row.next, row.result, row.completed])) }
      else if (action === 'open-column-settings') state.showColumnSettings = true
      else if (action === 'close-column-settings') state.showColumnSettings = false
      else if (action === 'restore-column-settings') controller.restorePreferences()
      else if (action === 'sort-column') controller.cycleSort(key)
      else if (action === 'prev-page') controller.stepPage(-1)
      else if (action === 'next-page') controller.stepPage(1)
      else if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') controller.updateColumnPreference(action, key, button instanceof HTMLInputElement ? button.checked : undefined)
      else return
      refresh()
    }, true)
    document.addEventListener('change', event => {
      const target = event.target instanceof HTMLSelectElement ? event.target : null
      if (!target?.closest(rootSelector) || target.getAttribute(`data-${prefix}-field`) !== 'pageSize') return
      event.stopPropagation(); controller.setPageSize(Number(target.value)); refresh()
    }, true)
    document.addEventListener('keydown', event => { if (event.key === 'Escape') { const host = document.querySelector(`${rootSelector} [data-business-image-dialog]`); if (host) host.innerHTML = '' } })
  }
  function render() {
    if (typeof document !== 'undefined' && !document.querySelector(rootSelector)) { state.currentPage = 1; state.sort = null; state.showColumnSettings = false }
    install(); const view = controller.getView()
    return `<div data-professional-list="${kind}" class="min-w-0 max-w-full">${renderStandardListPage({ title: config.title,
      filtersHtml: `<div data-business-filters>${filters()}</div>`, statsHtml: `<div data-business-stats>${stats()}</div>`,
      listTitle: `${config.title}列表`, listActionsHtml: renderSecondaryButton('列设置', { prefix, action: 'open-column-settings' }, 'settings-2'),
      tableHtml: `<div data-business-table>${view.tableHtml}</div>`, paginationHtml: `<div data-business-pagination>${view.paginationHtml}</div>`,
      overlaysHtml: `<div data-business-overlay>${controller.renderColumnSettings()}</div><div data-business-image-dialog></div>`, className: 'min-w-0 max-w-full',
    })}</div>`
  }
  return { render }
}
export function renderProfessionalBusinessList(kind: ProfessionalListKind): string {
  let page = pages.get(kind); if (!page) { page = createPage(kind); pages.set(kind, page) }
  return page.render()
}
