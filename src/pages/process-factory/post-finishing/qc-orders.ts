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
import { renderPostStatusBadge } from './shared.ts'

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

function renderTaskInput(): string {
  const actor = getCurrentPostFinishingActor()
  return `<section class="rounded-lg border border-blue-200 bg-blue-50 p-3" data-qc-task-entry>
    <div class="flex flex-wrap items-center gap-3"><div class="min-w-52"><h2 class="font-semibold text-blue-950">输入质检单号领取</h2><p class="mt-1 text-xs text-blue-800">一张质检单只由一名质检员操作。</p></div><div class="flex min-w-64 flex-1 gap-2"><input class="h-10 min-w-0 flex-1 rounded-md border border-blue-300 bg-white px-3 font-mono text-sm" placeholder="完整质检单号，例如 PO-QC-202608-001-1" data-qc-task-input/><button type="button" class="h-10 rounded-md bg-blue-600 px-5 text-sm font-semibold text-white" data-post-finishing-action="full-flow-claim-qc-from-list">领取并开始质检</button></div><div class="rounded-md bg-white px-3 py-2 text-right text-xs"><strong>${escapeHtml(actor.actorName)}</strong><div class="mt-1 text-muted-foreground">${escapeHtml(actor.roleName)}</div></div></div>
    <p class="mt-2 text-xs text-blue-800">质检单仍由后道待加工仓送检后自动生成；这里不提供手工创建入口。</p>
  </section>`
}

function selectOptions(values: string[], selected: string): string {
  return ['<option value="">全部</option>', ...values.map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`)].join('')
}

function renderSkuLines(row: QcOrderRow): string {
  return `<div class="space-y-2">${row.task.lines.map((line) => `<div class="flex items-center gap-2"><button type="button" class="relative flex h-10 w-10 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(line.sku.imageUrl)}" data-image-label="${escapeHtml(`${line.sku.skuCode} ${line.sku.colorName} ${line.sku.sizeName}`)}"><img src="${escapeHtml(line.sku.imageUrl)}" alt="${escapeHtml(`${line.sku.spuName} ${line.sku.colorName} ${line.sku.sizeName}`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[8px] text-slate-500">加载中</span></button><span class="min-w-0"><span class="block font-mono text-xs">${escapeHtml(line.sku.skuCode)}</span><span class="text-[11px] text-muted-foreground">${line.expectedQty} 件</span></span></div>`).join('')}</div>`
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

const columns: StandardListColumn<QcOrderRow>[] = [
  { key: 'qcOrder', title: '质检单号', width: 160, required: true, freezeable: true, render: (row) => `<div class="break-all font-mono font-semibold">${escapeHtml(row.task.qcTaskNo)}</div><div class="mt-1 text-xs text-muted-foreground">第 ${row.task.returnIndex} 次回货</div>` },
  { key: 'documents', title: '单号', width: 190, required: true, render: (row) => `<div>后道：<span class="font-mono">${escapeHtml(row.delivery?.sewingTaskNo || '—')}</span></div><div class="mt-1">生产：<span class="font-mono text-blue-700">${escapeHtml(row.task.productionOrderNo)}</span></div><div class="mt-1 break-all text-xs text-muted-foreground">回货：${escapeHtml(row.task.deliveryOrderNo)}</div>` },
  { key: 'factory', title: '来源工厂', width: 130, required: true, render: (row) => escapeHtml(row.delivery?.sewingFactoryName || '—') },
  { key: 'station', title: '质检台', width: 120, required: true, render: () => 'FinishingQCunit A' },
  { key: 'sku', title: 'SKU 明细', width: 220, required: true, render: renderSkuLines },
  { key: 'expected', title: '质检数量', width: 90, required: true, align: 'center', render: (row) => `${totalExpected(row.task)} 件` },
  { key: 'passed', title: '合格数量', width: 90, required: true, align: 'center', render: (row) => `${totalPassed(row.task)} 件` },
  { key: 'defect', title: '不合格数量', width: 100, required: true, align: 'center', render: (row) => `${totalDefect(row.task)} 件` },
  { key: 'result', title: '质检结果', width: 105, required: true, render: (row) => row.task.status !== '质检完成' ? '未出结果' : totalDefect(row.task) > 0 ? '部分不合格' : '全数合格' },
  { key: 'status', title: '状态', width: 100, required: true, render: (row) => renderPostStatusBadge(row.task.status) },
  { key: 'inspector', title: '质检人', width: 100, required: true, render: (row) => escapeHtml(row.task.claimedBy?.actorName || '—') },
  { key: 'actions', title: '操作', width: 220, required: true, actionColumn: true, render: (row) => {
    const actor = getCurrentPostFinishingActor()
    const isSupervisor = actor.roleName === 'QC主管'
    const canOperate = row.task.claimedBy?.actorId === actor.actorId || isSupervisor
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
    const searchable = [row.task.qcTaskNo, row.task.deliveryOrderNo, row.task.productionOrderNo, row.task.claimedBy?.actorName, 'FinishingQCunit A', ...row.task.lines.map((line) => line.sku.skuCode)].filter(Boolean).join(' ').toLowerCase()
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
    feedbackHtml: renderMessage(),
    statusTabsHtml: renderTaskInput(),
    filtersHtml: `<form action="/fcs/craft/post-finishing/qc-orders" class="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-3 xl:grid-cols-6"><label class="text-xs text-muted-foreground md:col-span-2">关键词<input name="keyword" value="${escapeHtml(current.get('keyword') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" placeholder="质检单/后道单/生产单/质检台/SKU"/></label><label class="text-xs text-muted-foreground">当前状态<select name="status" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(['待质检','质检中','质检完成'], status)}</select></label><label class="text-xs text-muted-foreground">后道来源<select name="source" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(sources, source)}</select></label><label class="text-xs text-muted-foreground">工厂<select name="factory" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(factories, factory)}</select></label>${isSupervisor ? `<label class="text-xs text-muted-foreground">质检人<input name="owner" value="${escapeHtml(current.get('owner') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm"/></label>` : ''}<div class="flex items-end justify-end gap-2 md:col-span-3 xl:col-span-6"><a data-nav="/fcs/craft/post-finishing/qc-orders" class="inline-flex h-9 items-center rounded-md border px-4 text-sm">重置</a><button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white">查询</button></div></form>`,
    statsHtml: renderStandardListStats([
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
  if (action !== 'full-flow-claim-qc-from-list' && action !== 'full-flow-supervisor-release-qc') return false
  try {
    if (action === 'full-flow-claim-qc-from-list') {
      const claimed = claimPostFinishingQcTask({ qcTaskNo: input?.value.trim() || '', actor: getCurrentPostFinishingActor() })
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
