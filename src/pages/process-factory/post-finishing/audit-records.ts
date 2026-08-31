// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { getPostFinishingAuthorizationDisplay, listPostFinishingAuthorizationConsumptions, listPostFinishingAuthorizedPeople } from '../../../data/fcs/post-finishing-authorization.ts'
import { listPostFinishingDefectRecords } from '../../../data/fcs/post-finishing-full-flow.ts'
import { listPostFinishingOperationLogs, type PostFinishingFullFlowStage, type PostFinishingOperationLogEntry } from '../../../data/fcs/post-finishing-operation-log.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'

let refreshTimer: number | undefined

function query(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function navigate(overrides: Record<string, string | undefined>): void {
  const params = query()
  Object.entries(overrides).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key))
  appStore.navigate(`/fcs/craft/post-finishing/audit-records?${params.toString()}`)
}

function toOperationLogBoundary(value: string | null, endOfDay = false): string | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+08:00`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

const columns: StandardListColumn<PostFinishingOperationLogEntry>[] = [
  { key: 'operatedAt', title: '操作时间', width: 170, required: true, freezeable: true, render: (row) => escapeHtml(new Date(row.operatedAt).toLocaleString('zh-CN')) },
  { key: 'stage', title: '环节', width: 110, required: true, render: (row) => escapeHtml(row.stage) },
  { key: 'objectNo', title: '业务单号', width: 210, required: true, freezeable: true, render: (row) => `<div class="font-mono text-xs font-semibold">${escapeHtml(row.objectNo)}</div><div class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(row.productionOrderNo)}</div>` },
  { key: 'action', title: '动作', width: 170, required: true, render: (row) => escapeHtml(row.action) },
  { key: 'operatorName', title: '操作人', width: 130, required: true, render: (row) => escapeHtml(row.operatorName) },
  { key: 'quantity', title: '数量与差异', width: 160, render: (row) => row.differenceQuantity === undefined ? '—' : `${escapeHtml(row.differenceDirection || '一致')} ${Math.abs(row.differenceQuantity)} 件` },
  { key: 'differenceReason', title: '差异原因', width: 180, render: (row) => escapeHtml(row.differenceReason || '—') },
  { key: 'authorizerName', title: '授权人', width: 130, render: (row) => escapeHtml(row.authorizerName || '—') },
  { key: 'status', title: '状态变化', width: 190, render: (row) => escapeHtml(`${row.beforeStatus || '—'} → ${row.afterStatus || '—'}`) },
  { key: 'result', title: '结果', width: 90, required: true, render: (row) => escapeHtml(row.result) },
  { key: 'remark', title: '备注', width: 260, render: (row) => escapeHtml(row.remark || '—') },
]

function renderAuthorizationPanel(): string {
  const people = listPostFinishingAuthorizedPeople()
  if (people.length === 0) {
    return '<section class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">尚未配置后道差异授权人员。</section>'
  }
  const selectedId = query().get('authorizerId') || ''
  if (!people.some((person) => person.authorizerId === selectedId)) {
    return '<section class="rounded-xl border border-slate-200 bg-slate-50 p-4" data-testid="post-finishing-authorization-panel"><h2 class="font-semibold text-slate-900">指定人员动态授权码</h2><p class="mt-1 text-xs text-slate-600">授权码仅在指定授权人本人的授权身份下显示；操作日志页不会公开任何人的当前授权码。</p></section>'
  }
  const selected = getPostFinishingAuthorizationDisplay(selectedId)
  if (typeof window !== 'undefined') {
    window.clearTimeout(refreshTimer)
    refreshTimer = window.setTimeout(() => navigate({ authorizerId: selectedId, refresh: String(Date.now()) }), Math.max(250, selected.validUntilMs - Date.now() + 50))
  }
  return `<section class="rounded-xl border border-amber-200 bg-amber-50 p-4" data-testid="post-finishing-authorization-panel"><div><h2 class="font-semibold text-amber-950">指定人员动态授权码</h2><p class="mt-1 text-xs text-amber-800">仅当前指定授权人本人可见；每 30 秒自动刷新；一经使用不可重复。日志不保存可复用明文码。</p></div><div class="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"><div><div class="text-xs text-amber-800">${escapeHtml(selected.authorizerName)} · ${escapeHtml(selected.roleName)}</div><div class="mt-1 font-mono text-4xl font-bold tracking-[0.2em] text-amber-950" data-authorization-code>${escapeHtml(selected.code)}</div><div class="mt-2 break-all font-mono text-[11px] text-amber-800" data-authorization-scan-payload>${escapeHtml(selected.scanPayload)}</div></div><div class="rounded-xl bg-white px-4 py-3 text-center"><div class="text-xs text-muted-foreground">本时段剩余</div><strong class="mt-1 block text-2xl">${selected.remainingSeconds} 秒</strong></div></div></section>`
}

export function renderPostFinishingAuditRecordsPage(): string {
  const params = query()
  const filters = {
    keyword: params.get('keyword') || undefined,
    stage: (params.get('stage') || undefined) as PostFinishingFullFlowStage | undefined,
    operatorName: params.get('operator') || undefined,
    authorizerName: params.get('authorizer') || undefined,
    differenceDirection: (params.get('direction') || undefined) as '多' | '少' | '一致' | undefined,
    startedAt: toOperationLogBoundary(params.get('startedAt')),
    endedAt: toOperationLogBoundary(params.get('endedAt'), true),
  }
  const authorizationResult = params.get('authorizationResult') || ''
  const rows = listPostFinishingOperationLogs(filters).filter((row) => {
    if (!authorizationResult) return true
    if (row.stage !== '授权') return false
    if (authorizationResult === '成功') return row.result === '成功'
    if (authorizationResult === '过期') return Boolean(row.remark?.includes('已过期') || row.remark?.includes('过期'))
    if (authorizationResult === '已使用') return Boolean(row.remark?.includes('已使用'))
    return row.result !== '成功' && !row.remark?.includes('已过期') && !row.remark?.includes('已使用')
  })
  const pageSize = Math.max(10, Math.min(50, Number(params.get('pageSize') || 20)))
  const slice = paginateStandardListRows(rows, Number(params.get('page') || 1), pageSize)
  const preferences: StandardListColumnPreferences = { order: columns.map((column) => column.key), visibleKeys: columns.map((column) => column.key), frozenKeys: ['operatedAt', 'objectNo'], pageSize }
  const consumptions = listPostFinishingAuthorizationConsumptions()
  const defects = listPostFinishingDefectRecords()
  const filtersHtml = `<form action="/fcs/craft/post-finishing/audit-records" class="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-4 xl:grid-cols-8"><label class="text-xs text-muted-foreground">开始日期<input type="date" name="startedAt" value="${escapeHtml(params.get('startedAt') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label><label class="text-xs text-muted-foreground">结束日期<input type="date" name="endedAt" value="${escapeHtml(params.get('endedAt') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label><label class="text-xs text-muted-foreground">单号 / 动作<input name="keyword" value="${escapeHtml(params.get('keyword') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label><label class="text-xs text-muted-foreground">环节<select name="stage" class="mt-1 h-9 w-full rounded-md border px-3 text-sm"><option value="">全部</option>${['送货登记','回货确认','送检','质检','后道','复检','出货','仓库收货','授权','质检参考资料'].map((stage) => `<option ${stage === params.get('stage') ? 'selected' : ''}>${stage}</option>`).join('')}</select></label><label class="text-xs text-muted-foreground">操作人<input name="operator" value="${escapeHtml(params.get('operator') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label><label class="text-xs text-muted-foreground">授权人<input name="authorizer" value="${escapeHtml(params.get('authorizer') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label><label class="text-xs text-muted-foreground">差异方向<select name="direction" class="mt-1 h-9 w-full rounded-md border px-3 text-sm"><option value="">全部</option>${['多','少','一致'].map((value) => `<option ${value === params.get('direction') ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label class="text-xs text-muted-foreground">授权结果<select name="authorizationResult" class="mt-1 h-9 w-full rounded-md border px-3 text-sm"><option value="">全部</option>${['成功','过期','已使用','无效'].map((value) => `<option ${value === authorizationResult ? 'selected' : ''}>${value}</option>`).join('')}</select></label><button class="h-9 rounded-md border text-sm md:col-span-4 xl:col-span-8">查询</button></form>`
  return `${renderAuthorizationPanel()}${renderStandardListPage({
    title: '后道差异与操作日志',
    filtersHtml,
    statsHtml: renderStandardListStats([{ label: '当前筛选日志', value: rows.length }, { label: '已消费授权', value: consumptions.length }, { label: '统一瑕疵记录', value: defects.length }]),
    listTitle: '可回溯操作事实',
    tableHtml: renderStandardListTable({ columns, rows: slice.rows, preferences, sort: null, eventPrefix: 'post-finishing', emptyText: '暂无符合条件的操作日志。' }),
    paginationHtml: renderTablePagination({ total: slice.total, from: slice.from, to: slice.to, currentPage: slice.currentPage, totalPages: slice.totalPages, pageSize: slice.pageSize, actionPrefix: 'post-finishing', fieldPrefix: 'post-finishing' }),
    overlaysHtml: `<section class="rounded-xl border bg-card p-4"><h2 class="font-semibold">统一瑕疵记录</h2><p class="mt-1 text-xs text-muted-foreground">质检和后道使用同一结构，保留发现阶段、原因、证据、责任方和处理状态。</p><div class="mt-3 grid gap-2 lg:grid-cols-2">${defects.slice(0, 12).map((record) => `<div class="rounded-lg border p-3 text-sm"><div class="flex items-center justify-between gap-2"><span class="font-semibold">${escapeHtml(record.sku.skuCode)} · ${record.defectQty} 件瑕疵</span><span class="text-xs text-muted-foreground">${escapeHtml(record.discoveryStage)}</span></div><div class="mt-1 text-xs">${escapeHtml(record.defectReason)} · ${escapeHtml(record.responsibleParty || '责任待确认')}</div><div class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(record.sourceObjectNo)} / ${escapeHtml(record.recordedBy.actorName)}</div></div>`).join('') || '<div class="text-sm text-muted-foreground">暂无瑕疵记录。</div>'}</div></section>`,
  })}`
}

export function handlePostFinishingAuditRecordsEvent(target: HTMLElement, event?: Event): boolean {
  if (typeof window === 'undefined' || window.location.pathname !== '/fcs/craft/post-finishing/audit-records') return false
  const action = target.closest<HTMLElement>('[data-post-finishing-action]')?.dataset.postFinishingAction
  if (action === 'prev-page' || action === 'next-page') {
    const page = Number(query().get('page') || 1) + (action === 'prev-page' ? -1 : 1)
    navigate({ page: String(Math.max(1, page)) })
    return true
  }
  const pageSize = target.closest<HTMLSelectElement>('[data-post-finishing-field="pageSize"]')
  if (pageSize && event?.type === 'change') {
    navigate({ page: '1', pageSize: pageSize.value })
    return true
  }
  return false
}
