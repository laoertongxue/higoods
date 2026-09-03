// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  POST_FINISHING_SEWING_TASK_TYPE_LABEL,
  claimPostFinishingQcTask,
  getCurrentPostFinishingActor,
  getPostFinishingFactoryReturn,
  listPostFinishingFullFlowQcTasks,
  releasePostFinishingQcTask,
  type PostFinishingFactoryReturnDelivery,
  type PostFinishingQcTask,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  getPostFinishingSpuOption,
  getPostFinishingSpuTechnicalParameter,
  isPostFinishingSpuTechnicalParameterMaintained,
  listPostFinishingSpuOptions,
  upsertPostFinishingSpuTechnicalParameter,
} from '../../../data/fcs/post-finishing-spu-technical-parameters.ts'
import { renderPostFinishingQcPrintActions, renderPostStatusBadge } from './shared.ts'

interface QcOrderRow {
  task: PostFinishingQcTask
  delivery?: PostFinishingFactoryReturnDelivery
}

let message = ''
let messageTone: 'success' | 'error' = 'success'

function params(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function navigate(overrides: Record<string, string>): void {
  const current = params()
  Object.entries(overrides).forEach(([key, value]) => current.set(key, value))
  appStore.navigate(`/fcs/craft/post-finishing/qc-orders?${current.toString()}`)
}

function refresh(): void {
  navigate({ refresh: String(Date.now()) })
}

function renderMessage(): string {
  if (!message) return ''
  return `<div role="status" class="rounded-lg border px-4 py-3 text-sm ${messageTone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}">${escapeHtml(message)}</div>`
}

function removeClaimDialog(): void {
  if (typeof document === 'undefined') return
  document.getElementById('post-finishing-qc-claim-modal')?.remove()
}

function openClaimDialog(): void {
  removeClaimDialog()
  const actor = getCurrentPostFinishingActor()
  const host = document.getElementById('app') || document.body
  host.insertAdjacentHTML('beforeend', `<div id="post-finishing-qc-claim-modal" class="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4" data-skip-page-rerender="true"><section class="w-full max-w-xl rounded-lg border bg-background shadow-2xl" role="dialog" aria-modal="true" aria-label="领取质检单"><header class="flex items-center justify-between gap-3 border-b px-4 py-3"><div><h2 class="font-semibold">领取质检单</h2><p class="mt-1 text-xs text-muted-foreground">当前质检员：${escapeHtml(actor.actorName)}</p></div><button type="button" class="rounded-md border px-2 py-1 text-xs" data-post-finishing-action="full-flow-close-qc-claim">关闭</button></header><div class="space-y-3 p-4"><p class="text-sm text-muted-foreground">只能扫描或输入完整质检单号；仅“待质检”且未被领取的单据可领取。</p><input autofocus class="h-10 w-full rounded-md border px-3 font-mono text-sm" placeholder="完整质检单号，例如 PO-QC-202608-001-1" data-qc-task-input/><div class="flex justify-end gap-2"><button type="button" class="rounded-md border px-4 py-2 text-sm" data-post-finishing-action="full-flow-close-qc-claim">取消</button><button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white" data-post-finishing-action="full-flow-claim-qc-from-list">确认领取</button></div></div></section></div>`)
  document.querySelector<HTMLInputElement>('[data-qc-task-input]')?.focus()
}

const SPU_TECH_MODAL_ID = 'post-finishing-spu-tech-modal'

function removeSpuTechnicalParameterDialog(): void {
  document.getElementById(SPU_TECH_MODAL_ID)?.remove()
}

function selectedFileUrl(root: ParentNode, selector: string): string | undefined {
  const file = root.querySelector<HTMLInputElement>(selector)?.files?.[0]
  return file ? URL.createObjectURL(file) : undefined
}

function refreshCurrentRoute(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set('refresh', String(Date.now()))
  appStore.navigate(`${url.pathname}${url.search}`)
}

function renderTechnicalImage(url: string, label: string): string {
  if (!url) return '<div class="flex h-28 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">尚未上传</div>'
  return `<button type="button" class="relative flex h-28 w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(url)}" data-image-label="${escapeHtml(label)}"><img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" class="h-full w-full object-contain" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="text-xs text-slate-500">图片加载中…</span></button>`
}

function openSpuTechnicalParameterDialog(spuCode = ''): void {
  removeSpuTechnicalParameterDialog()
  const option = getPostFinishingSpuOption(spuCode)
  const record = option ? getPostFinishingSpuTechnicalParameter(option.spuCode) : undefined
  const status = isPostFinishingSpuTechnicalParameterMaintained(record) ? '已维护' : '未维护'
  const sizeRows = option?.sizes.map((sizeName) => (
    record?.sizeRows.find((row) => row.sizeName === sizeName)
    || option.suggestedSizeRows.find((row) => row.sizeName === sizeName)
    || { sizeName, backLength: '', shoulderWidth: '', bust: '', sleeveLength: '', cuff: '' }
  )) || []
  const options = listPostFinishingSpuOptions()
  const host = document.getElementById('app') || document.body
  host.insertAdjacentHTML('beforeend', `<div id="${SPU_TECH_MODAL_ID}" class="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 p-4" data-skip-page-rerender="true"><section class="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl" role="dialog" aria-modal="true" aria-label="维护 SPU 技术参数"><header class="flex items-center justify-between gap-3 border-b px-5 py-4"><div><h2 class="text-lg font-semibold">维护 SPU 技术参数</h2><p class="mt-1 text-xs text-muted-foreground">颜色对照图与各尺码尺寸独立维护，不写入技术包。</p></div><button type="button" class="rounded-md border px-3 py-2 text-sm" data-post-finishing-action="close-spu-tech-params">关闭</button></header><div class="min-h-0 flex-1 overflow-y-auto p-5"><label class="block text-sm font-medium">SPU（可输入编码或名称搜索）<input autofocus value="${escapeHtml(option?.spuCode || spuCode)}" list="post-finishing-spu-options" placeholder="请输入或选择完整 SPU" class="mt-1 h-10 w-full rounded-md border px-3" data-spu-tech-field="spuCode"/></label><datalist id="post-finishing-spu-options">${options.map((item) => `<option value="${escapeHtml(item.spuCode)}">${escapeHtml(item.spuName)}</option>`).join('')}</datalist>${option ? `<div class="mt-4 space-y-5" data-spu-tech-form data-spu-code="${escapeHtml(option.spuCode)}"><section class="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-slate-50 p-4"><div class="flex gap-3"><button type="button" class="relative flex h-20 w-20 cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border bg-white" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(option.imageUrl)}" data-image-label="${escapeHtml(option.spuName)}"><img src="${escapeHtml(option.imageUrl)}" alt="${escapeHtml(option.spuName)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片失败';this.nextElementSibling.hidden=false"/><span class="text-[10px] text-slate-500">加载中</span></button><div><div class="text-base font-semibold">${escapeHtml(option.spuCode)}</div><div class="mt-1 text-sm text-muted-foreground">${escapeHtml(option.spuName)}</div><div class="mt-2 text-xs text-muted-foreground">颜色：${escapeHtml(option.colors.join('、'))} · 尺码：${escapeHtml(option.sizes.join('、'))}</div></div></div><span class="rounded-full px-3 py-1 text-xs ${status === '已维护' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">技术参数${status}</span></section><section class="grid gap-4 rounded-xl border p-4 lg:grid-cols-[260px_minmax(0,1fr)]"><div><h3 class="font-semibold">颜色对照图</h3><div class="mt-3">${renderTechnicalImage(record?.colorReferenceImageUrl || '', `${option.spuCode} 颜色对照图`)}</div></div><div class="grid content-start gap-3"><label class="text-xs text-muted-foreground">上传颜色对照图<input type="file" accept="image/*" class="mt-1 block w-full rounded-md border p-2 text-xs" data-spu-tech-file="colorReference"/></label><label class="text-xs text-muted-foreground">或填写图片地址<input value="${escapeHtml(record?.colorReferenceImageUrl || '')}" class="mt-1 h-10 w-full rounded-md border px-3 text-sm" placeholder="/materials/..." data-spu-tech-field="colorReferenceImageUrl"/></label><label class="text-xs text-muted-foreground">颜色判断说明<textarea class="mt-1 min-h-20 w-full rounded-md border px-3 py-2 text-sm" placeholder="说明光源、容差或实物色卡判断要求" data-spu-tech-field="colorReferenceNote">${escapeHtml(record?.colorReferenceNote || '')}</textarea></label></div></section><section class="rounded-xl border p-4"><div><h3 class="font-semibold">各尺码尺寸</h3><p class="mt-1 text-xs text-muted-foreground">每个尺码填写完整尺寸，或上传对应尺码尺寸图。</p></div><div class="mt-3 space-y-3">${sizeRows.map((row) => `<article class="rounded-lg border bg-slate-50 p-3" data-spu-size-row data-size-name="${escapeHtml(row.sizeName)}"><div class="mb-2 font-semibold">${escapeHtml(row.sizeName)} 码</div><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">${[
    ['backLength', '衣长', row.backLength],
    ['shoulderWidth', '肩宽', row.shoulderWidth],
    ['bust', '胸围', row.bust],
    ['sleeveLength', '袖长', row.sleeveLength],
    ['cuff', '袖口', row.cuff],
  ].map(([field, label, value]) => `<label class="text-xs text-muted-foreground">${label}<input value="${escapeHtml(value)}" class="mt-1 h-9 w-full rounded-md border bg-white px-2" data-spu-size-field="${field}"/></label>`).join('')}</div><div class="mt-3 grid gap-2 md:grid-cols-2"><label class="text-xs text-muted-foreground">上传该尺码尺寸图<input type="file" accept="image/*" class="mt-1 block w-full rounded-md border bg-white p-2 text-xs" data-spu-size-file/></label><label class="text-xs text-muted-foreground">或填写图片地址<input value="${escapeHtml(row.imageUrl || '')}" class="mt-1 h-9 w-full rounded-md border bg-white px-2" data-spu-size-field="imageUrl"/></label></div></article>`).join('')}</div></section></div>` : '<div class="mt-4 rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">请输入或选择列表中的完整 SPU，系统将展示商品图片、颜色和尺码。</div>'}</div><footer class="flex justify-end gap-2 border-t px-5 py-4"><button type="button" class="rounded-md border px-4 py-2 text-sm" data-post-finishing-action="close-spu-tech-params">取消</button><button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300" data-post-finishing-action="save-spu-tech-params" ${option ? '' : 'disabled'}>保存 SPU 技术参数</button></footer></section></div>`)
  document.querySelector<HTMLInputElement>('[data-spu-tech-field="spuCode"]')?.focus()
}

function fieldValue(root: ParentNode, selector: string): string {
  return root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)?.value.trim() || ''
}

function showSpuTechnicalParameterToast(text: string): void {
  const toast = document.createElement('div')
  toast.className = 'fixed right-4 top-4 z-[260] rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-lg'
  toast.textContent = text
  document.body.appendChild(toast)
  window.setTimeout(() => toast.remove(), 2400)
}

function selectOptions(values: string[], selected: string): string {
  return ['<option value="">全部</option>', ...values.map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`)].join('')
}

function renderSkuLines(row: QcOrderRow): string {
  return `<div class="space-y-2">${renderSpuTechnicalStatus(row)}<div class="space-y-2 border-t pt-2">${row.task.lines.map((line) => `<div class="flex items-center gap-2"><button type="button" class="relative flex h-10 w-10 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(line.sku.imageUrl)}" data-image-label="${escapeHtml(`${line.sku.skuCode} ${line.sku.colorName} ${line.sku.sizeName}`)}"><img src="${escapeHtml(line.sku.imageUrl)}" alt="${escapeHtml(`${line.sku.spuName} ${line.sku.colorName} ${line.sku.sizeName}`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[8px] text-slate-500">加载中</span></button><span class="min-w-0"><span class="block font-mono text-xs">${escapeHtml(line.sku.skuCode)}</span><span class="text-[11px] text-muted-foreground">${line.expectedQty} 件</span></span></div>`).join('')}</div></div>`
}

function totalExpected(task: PostFinishingQcTask): number {
  return task.lines.reduce((sum, line) => sum + line.expectedQty, 0)
}

function totalPassed(task: PostFinishingQcTask): number {
  return (task.results || []).reduce((sum, line) => sum + line.passedQty, 0)
}

function totalDefect(task: PostFinishingQcTask): number {
  return (task.results || []).reduce((sum, line) => sum + line.defectQty + line.returnQty, 0)
}

function renderSpuTechnicalStatus(row: QcOrderRow): string {
  const spuCodes = [...new Set(row.task.lines.map((line) => line.sku.spuCode))]
  return `<div class="space-y-2">${spuCodes.map((spuCode) => {
    const maintained = isPostFinishingSpuTechnicalParameterMaintained(getPostFinishingSpuTechnicalParameter(spuCode))
    return `<button type="button" class="flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] ${maintained ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}" data-post-finishing-action="open-spu-tech-params" data-spu-code="${escapeHtml(spuCode)}" data-skip-page-rerender="true"><span class="font-mono">${escapeHtml(spuCode)}</span><span class="whitespace-nowrap">${maintained ? '技术参数已维护' : '技术参数未维护'}</span></button>`
  }).join('')}</div>`
}

const columns: StandardListColumn<QcOrderRow>[] = [
  { key: 'qcOrder', title: '质检单号', width: 160, required: true, freezeable: true, render: (row) => `<div class="break-all font-mono font-semibold">${escapeHtml(row.task.qcTaskNo)}</div><div class="mt-1 text-xs text-muted-foreground">第 ${row.task.returnIndex} 次回货</div>` },
  { key: 'documents', title: '单号', width: 190, required: true, render: (row) => `<div>后道：<span class="font-mono">${escapeHtml(row.delivery?.sewingTaskNo || '—')}</span></div><div class="mt-1">生产：<span class="font-mono text-blue-700">${escapeHtml(row.task.productionOrderNo)}</span></div><div class="mt-1 break-all text-xs text-muted-foreground">回货：${escapeHtml(row.task.deliveryOrderNo)}</div>` },
  { key: 'factory', title: '来源工厂', width: 130, required: true, render: (row) => escapeHtml(row.delivery?.sewingFactoryName || '—') },
  { key: 'station', title: '质检员', width: 120, required: true, render: (row) => escapeHtml(row.task.claimedBy?.actorName || '待领取') },
  { key: 'sku', title: 'SKU 明细 / SPU 技术参数', width: 220, required: true, render: renderSkuLines },
  { key: 'expected', title: '质检数量', width: 90, required: true, align: 'center', render: (row) => `${totalExpected(row.task)} 件` },
  { key: 'passed', title: '合格数量', width: 90, required: true, align: 'center', render: (row) => `${totalPassed(row.task)} 件` },
  { key: 'defect', title: '不合格数量', width: 100, required: true, align: 'center', render: (row) => `${totalDefect(row.task)} 件` },
  { key: 'result', title: '质检结果', width: 105, required: true, render: (row) => row.task.status === '待送检' ? '待送检出库' : row.task.status !== '质检完成' ? '未出结果' : totalDefect(row.task) > 0 ? '部分不合格' : '全数合格' },
  { key: 'status', title: '状态', width: 100, required: true, render: (row) => renderPostStatusBadge(row.task.status) },
  { key: 'actions', title: '操作', width: 220, required: true, actionColumn: true, render: (row) => {
    const actor = getCurrentPostFinishingActor()
    const isSupervisor = actor.roleName === 'QC主管'
    const canOperate = row.task.claimedBy?.actorId === actor.actorId
    if (row.task.status === '待送检') {
      return `<a data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=returns&deliveryId=${encodeURIComponent(row.task.deliveryId)}" class="whitespace-nowrap text-xs font-medium text-blue-700 hover:underline">去待加工仓送检</a>`
    }
    return `<div class="grid grid-cols-2 gap-x-3 gap-y-2">${row.task.status === '质检中' && canOperate ? `<a data-nav="/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(row.task.qcTaskNo)}" class="whitespace-nowrap text-xs font-medium text-blue-700 hover:underline">完成质检</a>` : ''}<a data-nav="/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(row.task.qcTaskNo)}" class="whitespace-nowrap text-xs text-blue-600 hover:underline">查看质检单</a><a data-nav="/fcs/craft/post-finishing/print?type=QC_ORDER&id=${encodeURIComponent(row.task.qcTaskNo)}" class="whitespace-nowrap text-xs text-blue-600 hover:underline">打印质检单</a><a data-nav="/fcs/craft/post-finishing/print?type=QC_DETAIL&id=${encodeURIComponent(row.task.qcTaskNo)}" class="whitespace-nowrap text-xs text-blue-600 hover:underline">打印质检详情单</a>${isSupervisor && row.task.status === '质检中' ? `<button type="button" class="whitespace-nowrap text-xs text-amber-700 hover:underline" data-post-finishing-action="full-flow-supervisor-release-qc" data-task-id="${escapeHtml(row.task.qcTaskId)}">主管释放</button>` : ''}</div>`
  } },
]

export function renderPostFinishingQcOrdersPage(): string {
  const current = params()
  const actor = getCurrentPostFinishingActor()
  const isSupervisor = actor.roleName === 'QC主管'
  const keyword = current.get('keyword')?.trim().toLowerCase() || ''
  const status = current.get('status') || ''
  const source = current.get('source') || ''
  const factory = current.get('factory') || ''
  const owner = current.get('owner')?.trim().toLowerCase() || ''
  const allRecords = listPostFinishingFullFlowQcTasks()
  const countSource = isSupervisor ? allRecords : allRecords.filter((task) => task.claimedBy?.actorId === actor.actorId)
  const records = countSource.map((task): QcOrderRow => ({ task, delivery: getPostFinishingFactoryReturn(task.deliveryId) })).filter((row) => {
    const sourceLabel = row.delivery ? POST_FINISHING_SEWING_TASK_TYPE_LABEL[row.delivery.sewingTaskType] : ''
    const searchable = [row.task.qcTaskNo, row.task.deliveryOrderNo, row.task.productionOrderNo, row.task.claimedBy?.actorName, ...row.task.lines.map((line) => line.sku.skuCode)].filter(Boolean).join(' ').toLowerCase()
    return (!keyword || searchable.includes(keyword))
      && (!status || row.task.status === status)
      && (!source || sourceLabel === source)
      && (!factory || row.delivery?.sewingFactoryName === factory)
      && (!owner || row.task.claimedBy?.actorName.toLowerCase().includes(owner))
  })
  const counts = countSource.reduce<Record<string, number>>((result, task) => {
    result[task.status] = (result[task.status] || 0) + 1
    return result
  }, {})
  const pageSize = Math.max(10, Math.min(50, Number(current.get('pageSize') || 20)))
  const slice = paginateStandardListRows(records, Number(current.get('page') || 1), pageSize)
  const preferences: StandardListColumnPreferences = { order: columns.map((column) => column.key), visibleKeys: columns.map((column) => column.key), frozenKeys: ['qcOrder'], pageSize }
  const sources = [...new Set(allRecords.map((task) => getPostFinishingFactoryReturn(task.deliveryId)).filter(Boolean).map((delivery) => POST_FINISHING_SEWING_TASK_TYPE_LABEL[delivery!.sewingTaskType]))]
  const factories = [...new Set(allRecords.map((task) => getPostFinishingFactoryReturn(task.deliveryId)?.sewingFactoryName).filter((value): value is string => Boolean(value)))]
  return renderStandardListPage({
    title: '质检单',
    primaryActionsHtml: `<div class="flex flex-wrap items-center justify-end gap-2">${renderPostFinishingQcPrintActions()}<button type="button" class="inline-flex h-9 items-center rounded-md border border-blue-200 bg-blue-50 px-4 text-sm font-medium text-blue-700" data-post-finishing-action="open-spu-tech-params" data-skip-page-rerender="true">新增 SPU 技术参数</button><button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-post-finishing-action="full-flow-open-qc-claim" data-skip-page-rerender="true">领取质检单</button></div>`,
    feedbackHtml: renderMessage(),
    filtersHtml: `<form action="/fcs/craft/post-finishing/qc-orders" class="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-3 xl:grid-cols-6"><label class="text-xs text-muted-foreground md:col-span-2">关键词<input name="keyword" value="${escapeHtml(current.get('keyword') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" placeholder="质检单/后道加工单/生产单/质检员/SKU"/></label><label class="text-xs text-muted-foreground">当前状态<select name="status" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(['待送检','待质检','质检中','质检完成'], status)}</select></label><label class="text-xs text-muted-foreground">后道来源<select name="source" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(sources, source)}</select></label><label class="text-xs text-muted-foreground">工厂<select name="factory" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(factories, factory)}</select></label>${isSupervisor ? `<label class="text-xs text-muted-foreground">质检员<input name="owner" value="${escapeHtml(current.get('owner') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm"/></label>` : ''}<div class="flex items-end justify-end gap-2 md:col-span-3 xl:col-span-6"><a data-nav="/fcs/craft/post-finishing/qc-orders" class="inline-flex h-9 items-center rounded-md border px-4 text-sm">重置</a><button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white">查询</button></div></form>`,
    statsHtml: renderStandardListStats([
      { label: '待送检', value: counts['待送检'] || 0 },
      { label: '待质检', value: counts['待质检'] || 0 },
      { label: '质检中', value: counts['质检中'] || 0 },
      { label: '质检完成', value: counts['质检完成'] || 0 },
    ]),
    tableHtml: renderStandardListTable({ columns, rows: slice.rows, preferences, sort: null, eventPrefix: 'post-finishing-qc-orders', emptyText: '暂无符合条件的质检单；待质检单请使用完整单号领取。' }),
    paginationHtml: renderTablePagination({ total: slice.total, from: slice.from, to: slice.to, currentPage: slice.currentPage, totalPages: slice.totalPages, pageSize: slice.pageSize, actionPrefix: 'post-finishing-qc-orders', fieldPrefix: 'post-finishing-qc-orders' }),
  })
}

export function handlePostFinishingQcOrdersEvent(target: HTMLElement, event?: Event): boolean {
  const pageAction = target.closest<HTMLElement>('[data-post-finishing-qc-orders-action]')?.dataset.postFinishingQcOrdersAction
  if (pageAction === 'prev-page' || pageAction === 'next-page') {
    navigate({ page: String(Math.max(1, Number(params().get('page') || 1) + (pageAction === 'prev-page' ? -1 : 1))) })
    return true
  }
  const pageSize = target.closest<HTMLSelectElement>('[data-post-finishing-qc-orders-field="pageSize"]')
  if (pageSize && event?.type === 'change') {
    navigate({ page: '1', pageSize: pageSize.value })
    return true
  }
  const input = target.closest<HTMLInputElement>('[data-qc-task-input]') || document.querySelector<HTMLInputElement>('[data-qc-task-input]')
  const actionNode = target.closest<HTMLElement>('[data-post-finishing-action]')
  const action = actionNode?.dataset.postFinishingAction
    || (target.matches('[data-qc-task-input]') && event?.type === 'keydown' && (event as KeyboardEvent).key === 'Enter' ? 'full-flow-claim-qc-from-list' : undefined)
  const spuSelection = target.closest<HTMLInputElement>('[data-spu-tech-field="spuCode"]')
  if (spuSelection && (event?.type === 'input' || event?.type === 'change')) {
    const selected = listPostFinishingSpuOptions().find((item) => (
      item.spuCode === spuSelection.value.trim() || item.spuName === spuSelection.value.trim()
    ))
    const currentCode = document.querySelector<HTMLElement>('[data-spu-tech-form]')?.dataset.spuCode || ''
    if (selected && selected.spuCode !== currentCode) openSpuTechnicalParameterDialog(selected.spuCode)
    return true
  }
  if (action === 'open-spu-tech-params') {
    openSpuTechnicalParameterDialog(actionNode?.dataset.spuCode || '')
    return true
  }
  if (action === 'close-spu-tech-params') {
    removeSpuTechnicalParameterDialog()
    return true
  }
  if (action === 'save-spu-tech-params') {
    try {
      const form = document.querySelector<HTMLElement>('[data-spu-tech-form]')
      if (!form) throw new Error('请先选择完整 SPU。')
      const sizeRows = Array.from(form.querySelectorAll<HTMLElement>('[data-spu-size-row]')).map((row) => ({
        sizeName: row.dataset.sizeName || '',
        backLength: fieldValue(row, '[data-spu-size-field="backLength"]'),
        shoulderWidth: fieldValue(row, '[data-spu-size-field="shoulderWidth"]'),
        bust: fieldValue(row, '[data-spu-size-field="bust"]'),
        sleeveLength: fieldValue(row, '[data-spu-size-field="sleeveLength"]'),
        cuff: fieldValue(row, '[data-spu-size-field="cuff"]'),
        imageUrl: selectedFileUrl(row, '[data-spu-size-file]')
          || fieldValue(row, '[data-spu-size-field="imageUrl"]')
          || undefined,
      }))
      const saved = upsertPostFinishingSpuTechnicalParameter({
        spuCode: form.dataset.spuCode || '',
        colorReferenceImageUrl: selectedFileUrl(form, '[data-spu-tech-file="colorReference"]')
          || fieldValue(form, '[data-spu-tech-field="colorReferenceImageUrl"]'),
        colorReferenceNote: fieldValue(form, '[data-spu-tech-field="colorReferenceNote"]'),
        sizeRows,
        updatedBy: getCurrentPostFinishingActor().actorName,
      })
      removeSpuTechnicalParameterDialog()
      message = `${saved.spuCode} 技术参数保存成功。`
      messageTone = 'success'
      showSpuTechnicalParameterToast(message)
      refreshCurrentRoute()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'SPU 技术参数保存失败。'
      const modal = document.getElementById(SPU_TECH_MODAL_ID)
      modal?.querySelector('[data-spu-tech-error]')?.remove()
      modal?.querySelector('header')?.insertAdjacentHTML('afterend', `<div class="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700" data-spu-tech-error>${escapeHtml(text)}</div>`)
    }
    return true
  }
  if (action === 'full-flow-open-qc-claim') {
    openClaimDialog()
    return true
  }
  if (action === 'full-flow-close-qc-claim') {
    removeClaimDialog()
    return true
  }
  if (action !== 'full-flow-claim-qc-from-list' && action !== 'full-flow-supervisor-release-qc') return false
  try {
    if (action === 'full-flow-claim-qc-from-list') {
      const claimed = claimPostFinishingQcTask({ qcTaskNo: input?.value.trim() || '', actor: getCurrentPostFinishingActor() })
      removeClaimDialog()
      message = `领取成功：${claimed.qcTaskNo}`
      messageTone = 'success'
      appStore.navigate(`/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(claimed.qcTaskNo)}`)
      return true
    }
    const task = releasePostFinishingQcTask({
      qcTaskId: actionNode?.dataset.taskId || '',
      actor: POST_FINISHING_ACCEPTANCE_ACTORS.qcSupervisor,
      reason: '主管释放异常占用',
      supervisor: true,
    })
    message = `${task.qcTaskNo} 已由主管释放并回到待质检。`
    messageTone = 'success'
  } catch (error) {
    message = error instanceof Error ? error.message : '质检单操作失败。'
    messageTone = 'error'
  }
  refresh()
  return true
}
