import { runPostFinishingCommand } from '../../../data/fcs/post-finishing-records.ts'
// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderProductionObjectCodeButton } from '../../../data/fcs/production-order-identity.ts'
import { productionOrders } from '../../../data/fcs/production-orders.ts'
import { productionDemands } from '../../../data/fcs/production-demands.ts'
import { POST_FINISHING_PRODUCTION_SOURCE_FIXTURES } from '../../../data/fcs/post-finishing-production-source-fixtures.ts'
import {
  POST_FINISHING_SEWING_TASK_TYPE_LABEL,
  getCurrentPostFinishingActor,
  getPostFinishingFactoryReturn,
  listPostFinishingFullFlowQcTasks,
  releasePostFinishingQcTask,
  type PostFinishingFactoryReturnDelivery,
  type PostFinishingQcTask,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostFinishingQcPrintActions, renderPostStatusBadge } from './shared.ts'

interface QcOrderRow {
  task: PostFinishingQcTask
  delivery?: PostFinishingFactoryReturnDelivery
  qcLinked: boolean
  productionLinked: boolean
  mockSource: boolean
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

function totalExpected(task: PostFinishingQcTask): number {
  return task.lines.reduce((sum, line) => sum + line.expectedQty, 0)
}

function totalPassed(task: PostFinishingQcTask): number {
  return (task.results || []).reduce((sum, line) => sum + line.passedQty, 0)
}

function totalDefect(task: PostFinishingQcTask): number {
  return (task.results || []).reduce((sum, line) => sum + line.defectQty + line.returnQty, 0)
}

function selectOptions(values: string[], selected: string): string {
  return `<option value="">全部</option>${values.map(value => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}`
}

function renderSkuLines(row: QcOrderRow): string {
  return row.task.lines.map(line => `<div class="py-1 text-xs"><strong>${escapeHtml(line.sku.skuCode)}</strong><div class="text-muted-foreground">${escapeHtml(line.sku.colorName)} · ${escapeHtml(line.sku.sizeName)} · ${line.expectedQty} 件</div></div>`).join('')
}

const columns: StandardListColumn<QcOrderRow>[] = [
  { key: 'qcOrder', title: '质检单号', width: 160, required: true, freezeable: true, render: (row) => {
    const linked = row.qcLinked
    return `<div class="break-all font-mono font-semibold">${linked ? renderProductionObjectCodeButton({ objectType: 'QC_ORDER', objectId: row.task.qcTaskNo, relatedProductionOrderNo: row.task.productionOrderNo }) : escapeHtml(row.task.qcTaskNo)}</div><div class="mt-1 text-xs text-muted-foreground">第 ${row.task.returnIndex} 次回货${linked ? '' : ' · 生产主线关联待补'}</div>`
  } },
  { key: 'documents', title: '单号', width: 190, required: true, render: (row) => {
    return `<div>后道：<span class="font-mono">${escapeHtml(row.delivery?.sewingTaskNo || '—')}</span></div><div class="mt-1">生产：${row.productionLinked ? renderProductionObjectCodeButton({ objectType: 'PRODUCTION_ORDER', objectId: row.task.productionOrderNo }) : escapeHtml(row.task.productionOrderNo)}</div>${row.mockSource ? '<div class="mt-1 text-xs text-muted-foreground">后道验收 Mock 来源；生产主线已关联</div>' : ''}<div class="mt-1 break-all text-xs text-muted-foreground">回货：${escapeHtml(row.task.deliveryOrderNo)}</div>`
  } },
  { key: 'factory', title: '来源工厂', width: 110, required: true, render: (row) => escapeHtml(row.delivery?.sewingFactoryName || '—') },
  { key: 'responsibility', title: '后道责任 / 完成去向', width: 190, required: true, render: (row) => {
    const destination = row.task.status === '质检完成'
      ? (row.task.postTaskNo
          ? `生成加工单 ${row.task.postTaskNo}`
          : row.task.outboundOrderNo
            ? `成衣仓待接收 ${row.task.outboundOrderNo}`
            : '本次无合格数量，不生成交接单')
      : '按实际项目加工；无项目则交成衣仓'
    return `<div class="text-xs font-medium ${row.task.responsibility.responsibilityMode === 'POST_FACTORY' ? 'text-blue-700' : 'text-slate-700'}">${escapeHtml(`${row.task.responsibility.taskTypeLabel} · ${row.task.responsibility.responsibilityLabel}`)}</div><div class="mt-1 text-[11px] text-muted-foreground">${row.task.status === '质检完成' ? row.task.frozenProcessItems?.length ? escapeHtml(row.task.frozenProcessItems.join(' → ')) : '不涉及后道加工' : '由质检员按实物确认加工项目'}</div><div class="mt-1 text-[11px] text-blue-700">${escapeHtml(destination)}</div>`
  } },
  { key: 'station', title: '质检员', width: 100, required: true, render: (row) => escapeHtml(row.task.claimedBy?.actorName || '待领取') },
  { key: 'sku', title: 'SKU 明细', width: 220, required: true, render: renderSkuLines },
  { key: 'expected', title: '质检数量', width: 80, required: true, align: 'center', render: (row) => `${totalExpected(row.task)} 件` },
  { key: 'passed', title: '合格数量', width: 80, required: true, align: 'center', render: (row) => `${totalPassed(row.task)} 件` },
  { key: 'defect', title: '不合格数量', width: 90, required: true, align: 'center', render: (row) => `${totalDefect(row.task)} 件` },
  { key: 'result', title: '质检结果', width: 95, required: true, render: (row) => row.task.status === '待送检' ? '待送检出库' : row.task.status !== '质检完成' ? '未出结果' : totalDefect(row.task) > 0 ? '部分不合格' : '全数合格' },
  { key: 'status', title: '状态', width: 90, required: true, render: (row) => renderPostStatusBadge(row.task.status) },
  { key: 'actions', title: '操作', width: 200, required: true, actionColumn: true, render: (row) => {
    const actor = getCurrentPostFinishingActor()
    const isSupervisor = actor.roleName === 'QC主管'
    const canOperate = row.task.claimedBy?.actorId === actor.actorId
    if (row.task.status === '待送检') {
      return `<a data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=returns&deliveryId=${encodeURIComponent(row.task.deliveryId)}" class="whitespace-nowrap text-xs font-medium text-blue-700 hover:underline">去待加工仓送检</a>`
    }
    return `<div class="grid grid-cols-2 gap-x-3 gap-y-2">${row.task.status === '质检中' && canOperate ? `<a data-nav="/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(row.task.qcTaskNo)}" class="whitespace-nowrap text-xs font-medium text-blue-700 hover:underline">完成质检</a>` : ''}<a data-nav="/fcs/craft/post-finishing/qc-workbench?view=detail&taskNo=${encodeURIComponent(row.task.qcTaskNo)}" class="whitespace-nowrap text-xs text-blue-600 hover:underline">查看质检单</a><a data-nav="/fcs/craft/post-finishing/print?type=QC_ORDER&id=${encodeURIComponent(row.task.qcTaskNo)}" class="whitespace-nowrap text-xs text-blue-600 hover:underline">打印质检单</a><a data-nav="/fcs/craft/post-finishing/print?type=QC_DETAIL&id=${encodeURIComponent(row.task.qcTaskNo)}" class="whitespace-nowrap text-xs text-blue-600 hover:underline">打印质检详情单</a>${isSupervisor && row.task.status === '质检中' ? `<button type="button" class="whitespace-nowrap text-xs text-amber-700 hover:underline" data-post-finishing-action="full-flow-supervisor-release-qc" data-task-id="${escapeHtml(row.task.qcTaskId)}">主管释放</button>` : ''}</div>`
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
  // 清单只需确认实际生产来源是否存在。打开编号后由原概览入口读取
  // 物料、收货和结算详情，避免为每个单号先生成整份生产概览。
  const orders = [...productionOrders]
  const byNo = new Map(orders.map(order => [order.productionOrderNo, order]))
  const byId = new Map(orders.map(order => [order.productionOrderId, order]))
  const records = countSource.map((task): QcOrderRow => {
    const source = byNo.get(task.productionOrderNo) || byId.get(task.productionOrderNo)
    return { task, delivery: getPostFinishingFactoryReturn(task.deliveryId),
      qcLinked: Boolean(byId.get(task.productionOrderId) || source), productionLinked: Boolean(source),
      mockSource: Boolean(source && POST_FINISHING_PRODUCTION_SOURCE_FIXTURES.some(item => item.productionOrderId === source.productionOrderId)
        && productionDemands.some(item => item.demandId === source.demandId)) }
  }).filter((row) => {
    const sourceLabel = row.delivery ? POST_FINISHING_SEWING_TASK_TYPE_LABEL[row.delivery.sewingTaskType] : ''
    const searchable = [row.task.qcTaskNo, row.task.deliveryOrderNo, row.task.productionOrderNo, row.task.claimedBy?.actorName, ...row.task.lines.map((line) => line.sku.skuCode)].filter(Boolean).join(' ').toLowerCase()
    return (!keyword || searchable.includes(keyword))
      && (!status || row.task.status === status)
      && (!source || sourceLabel === source)
      && (!factory || row.delivery?.sewingFactoryName === factory)
      && (!owner || row.task.claimedBy?.actorName.toLowerCase().includes(owner))
  })
  const counts = records.reduce<Record<string, number>>((result, { task }) => {
    result[task.status] = (result[task.status] || 0) + 1
    return result
  }, {})
  const pageSize = Math.max(10, Math.min(50, Number(current.get('pageSize') || 20)))
  const slice = paginateStandardListRows(records, Number(current.get('page') || 1), pageSize)
  const preferences: StandardListColumnPreferences = { order: columns.map((column) => column.key), visibleKeys: columns.map((column) => column.key), frozenKeys: ['qcOrder'], pageSize }
  const sources = [...new Set(allRecords.map((task) => getPostFinishingFactoryReturn(task.deliveryId)).filter(Boolean).map((delivery) => POST_FINISHING_SEWING_TASK_TYPE_LABEL[delivery!.sewingTaskType]))]
  const factories = [...new Set(allRecords.map((task) => getPostFinishingFactoryReturn(task.deliveryId)?.sewingFactoryName).filter((value): value is string => Boolean(value)))]
  return renderStandardListPage({
    title: '质检清单',
    primaryActionsHtml: `<div class="flex flex-wrap items-center justify-end gap-2">${renderPostFinishingQcPrintActions()}<a data-nav="/fcs/craft/post-finishing/qc-workbench" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white">执行质检</a></div>`,
    feedbackHtml: `${renderMessage()}<div class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900"><strong>返工扣款边界：</strong>本页只记录返工数量、原因和接收工厂；返工扣款由后续财务事实承接，对账单确认后才影响本期应付。</div>`,
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

export async function handlePostFinishingQcOrdersEvent(target: HTMLElement, event?: Event): Promise<boolean> {
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
  const actionNode = target.closest<HTMLElement>('[data-post-finishing-action]')
  if (actionNode?.dataset.postFinishingAction !== 'full-flow-supervisor-release-qc') return false
  if (getCurrentPostFinishingActor().roleName !== 'QC主管') return false
  if (!window.confirm('确认释放这张质检单？释放后原质检员不能继续提交，单据回到待质检。')) return true
  try {
    const task = await runPostFinishingCommand(() => releasePostFinishingQcTask({
      qcTaskId: actionNode?.dataset.taskId || '',
      actor: getCurrentPostFinishingActor(),
      reason: '主管释放异常占用',
      supervisor: true,
    }))
    message = `${task.qcTaskNo} 已由主管释放并回到待质检。`
    messageTone = 'success'
  } catch (error) {
    message = error instanceof Error ? error.message : '质检单操作失败。'
    messageTone = 'error'
  }
  refresh()
  return true
}
