// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  listPostFinishingDefectRecords,
  listPostFinishingFactoryReturns,
  tracePostFinishingFullFlow,
  type PostFinishingAcceptanceSku,
  type PostFinishingFactoryReturnDelivery,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import {
  listPostFinishingOperationLogs,
  type PostFinishingOperationLogEntry,
} from '../../../data/fcs/post-finishing-operation-log.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostStatusBadge } from './shared.ts'

type FlowTrace = ReturnType<typeof tracePostFinishingFullFlow>

interface DifferenceLine {
  stage: string
  sku: PostFinishingAcceptanceSku
  expectedQty: number
  actualQty: number
  direction: '多' | '少'
  differenceQty: number
  authorization: string
}

interface ChainRow {
  delivery: PostFinishingFactoryReturnDelivery
  trace: FlowTrace
  differences: DifferenceLine[]
  logs: PostFinishingOperationLogEntry[]
  currentStage: string
  currentStatus: string
}

type AuditDetailTab = 'overview' | 'differences' | 'timeline'

const AUDIT_DETAIL_TABS: Array<{ key: AuditDetailTab; label: string }> = [
  { key: 'overview', label: '业务链总览' },
  { key: 'differences', label: '差异与瑕疵' },
  { key: 'timeline', label: '操作时间线' },
]

function query(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function navigate(overrides: Record<string, string | undefined>): void {
  const params = query()
  Object.entries(overrides).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key))
  appStore.navigate(`/fcs/craft/post-finishing/audit-records?${params.toString()}`)
}

function dateBoundary(value: string | null, endOfDay = false): string | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+08:00`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function matchesOperationFilters(row: ChainRow, params: URLSearchParams): boolean {
  const startedAt = dateBoundary(params.get('startedAt'))
  const endedAt = dateBoundary(params.get('endedAt'), true)
  const operator = params.get('operator')?.trim().toLowerCase() || ''
  const authorizer = params.get('authorizer')?.trim().toLowerCase() || ''
  const direction = params.get('direction') || ''
  const authorizationResult = params.get('authorizationResult') || ''
  if (direction && !row.differences.some((line) => line.direction === direction)) return false
  const hasLogFilter = Boolean(startedAt || endedAt || operator || authorizer || authorizationResult)
  if (!hasLogFilter) return true
  return row.logs.some((log) => {
    if (startedAt && log.operatedAt < startedAt) return false
    if (endedAt && log.operatedAt > endedAt) return false
    if (operator && !log.operatorName.toLowerCase().includes(operator)) return false
    if (authorizer && !String(log.authorizerName || '').toLowerCase().includes(authorizer)) return false
    if (authorizationResult) {
      if (log.stage !== '授权') return false
      if (authorizationResult === '成功' && log.result !== '成功') return false
      if (authorizationResult === '过期' && !log.remark?.includes('过期')) return false
      if (authorizationResult === '已使用' && !log.remark?.includes('已使用')) return false
      if (authorizationResult === '无效' && (log.result === '成功' || log.remark?.includes('过期') || log.remark?.includes('已使用'))) return false
    }
    return true
  })
}

function authorizationFor(trace: FlowTrace, stage: string): string {
  if (stage === '回货确认') return trace.delivery?.returnAuthorizedBy?.authorizerName || '无需授权'
  if (stage === '质检') return trace.qcTask?.qcAuthorizedBy?.authorizerName || '无需授权'
  if (stage === '后道') return trace.postTask?.postAuthorizedBy?.authorizerName || '无需授权'
  if (stage === '复检') return trace.recheckOrder?.recheckAuthorizedBy?.authorizerName || '无需授权'
  if (stage === '仓库收货') return trace.outboundOrder?.warehouseAuthorizedBy?.authorizerName || '无需授权'
  return '无需授权'
}

function buildDifferences(trace: FlowTrace): DifferenceLine[] {
  const result: DifferenceLine[] = []
  const add = (stage: string, sku: PostFinishingAcceptanceSku, expectedQty: number, actualQty: number) => {
    if (expectedQty === actualQty) return
    result.push({
      stage,
      sku,
      expectedQty,
      actualQty,
      direction: actualQty > expectedQty ? '多' : '少',
      differenceQty: Math.abs(actualQty - expectedQty),
      authorization: authorizationFor(trace, stage),
    })
  }
  trace.delivery?.lines.forEach((line) => {
    if (line.confirmedQty !== undefined) add('回货确认', line.sku, line.registeredQty, line.confirmedQty)
  })
  trace.qcTask?.results?.forEach((line) => add('质检', line.sku, line.expectedQty, line.passedQty + line.defectQty + line.returnQty))
  trace.postTask?.results?.forEach((line) => add('后道', line.sku, line.expectedQty, line.passedQty + line.defectQty + line.returnQty))
  trace.recheckOrder?.lines.forEach((line) => {
    if (line.passedQty !== undefined || line.defectQty !== undefined) {
      add('复检', line.sku, line.expectedQty, (line.passedQty || 0) + (line.defectQty || 0))
    }
  })
  trace.outboundOrder?.lines.forEach((line) => {
    if (line.receivedQty !== undefined) add('仓库收货', line.sku, line.outboundQty, line.receivedQty)
  })
  return result
}

function currentFlowState(trace: FlowTrace): { stage: string; status: string } {
  if (trace.receipt) return { stage: '仓库收货', status: '全流程完成' }
  if (trace.waitHandoverRecord) return { stage: '后道待交出仓', status: trace.waitHandoverRecord.status }
  if (trace.outboundOrder) return { stage: '后道出货', status: trace.outboundOrder.status }
  if (trace.recheckOrder) return { stage: '复检', status: trace.recheckOrder.status }
  if (trace.postTask) return { stage: '后道加工', status: trace.postTask.status }
  if (trace.qcTask) return { stage: '质检', status: trace.qcTask.status }
  return { stage: '后道待加工仓', status: trace.delivery?.status || '待确认' }
}

function buildRows(): ChainRow[] {
  return listPostFinishingFactoryReturns()
    .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
    .map((delivery) => {
      const trace = tracePostFinishingFullFlow(delivery.deliveryOrderNo)
      const state = currentFlowState(trace)
      return {
        delivery,
        trace,
        differences: buildDifferences(trace),
        logs: listPostFinishingOperationLogs({ keyword: delivery.deliveryOrderNo }),
        currentStage: state.stage,
        currentStatus: state.status,
      }
    })
}

const columns: StandardListColumn<ChainRow>[] = [
  {
    key: 'delivery',
    title: '生产单 / 回货',
    width: 230,
    required: true,
    freezeable: true,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.delivery.productionOrderNo)}</div><div class="mt-1 font-mono text-xs text-blue-700">${escapeHtml(row.delivery.deliveryOrderNo)}</div><div class="mt-1 text-[11px] text-muted-foreground">第 ${row.delivery.returnIndex} 次回货 · ${row.delivery.lines.length} SKU</div>`,
  },
  {
    key: 'documents',
    title: '业务链单据',
    width: 280,
    required: true,
    render: (row) => `<div class="space-y-1 font-mono text-[11px]"><div>质检：${escapeHtml(row.trace.qcTask?.qcTaskNo || '未生成')}</div><div>后道：${escapeHtml(row.trace.postTask?.postTaskNo || '未生成 / 不适用')}</div><div>复检：${escapeHtml(row.trace.recheckOrder?.recheckOrderNo || '未生成')}</div><div>待交出仓：${escapeHtml(row.trace.waitHandoverRecord?.warehouseRecordId || '未入仓')}</div><div>出货：${escapeHtml(row.trace.outboundOrder?.outboundOrderNo || '未生成')}</div></div>`,
  },
  {
    key: 'state',
    title: '当前环节 / 状态',
    width: 170,
    required: true,
    render: (row) => `<div class="text-xs text-muted-foreground">${escapeHtml(row.currentStage)}</div><div class="mt-1">${renderPostStatusBadge(row.currentStatus)}</div>`,
  },
  {
    key: 'difference',
    title: '逐 SKU 差异',
    width: 140,
    required: true,
    render: (row) => row.differences.length
      ? `<span class="font-semibold text-amber-700">${row.differences.length} 条差异</span>`
      : '<span class="text-emerald-700">当前一致</span>',
  },
  {
    key: 'lastOperation',
    title: '最后操作',
    width: 250,
    render: (row) => row.logs[0]
      ? `<div class="text-xs">${escapeHtml(row.logs[0].action)} · ${escapeHtml(row.logs[0].operatorName)}</div><div class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(new Date(row.logs[0].operatedAt).toLocaleString('zh-CN'))}</div>`
      : '—',
  },
  {
    key: 'action',
    title: '操作',
    width: 100,
    required: true,
    actionColumn: true,
    render: (row) => `<a href="/fcs/craft/post-finishing/audit-records?deliveryId=${encodeURIComponent(row.delivery.deliveryId)}" data-nav="/fcs/craft/post-finishing/audit-records?deliveryId=${encodeURIComponent(row.delivery.deliveryId)}" class="font-medium text-blue-700 hover:underline">查看详情</a>`,
  },
]

function auditDetailHref(row: ChainRow, detailTab: AuditDetailTab): string {
  return `/fcs/craft/post-finishing/audit-records?deliveryId=${encodeURIComponent(row.delivery.deliveryId)}&detailTab=${detailTab}`
}

function selectedAuditDetailTab(params: URLSearchParams): AuditDetailTab {
  const tab = params.get('detailTab') || 'overview'
  return AUDIT_DETAIL_TABS.some((item) => item.key === tab) ? tab as AuditDetailTab : 'overview'
}

function renderDetailTabs(row: ChainRow, activeTab: AuditDetailTab): string {
  return `<nav class="flex overflow-hidden rounded-lg border bg-white" aria-label="业务链详情分类">${AUDIT_DETAIL_TABS.map((tab) => `<a href="${escapeHtml(auditDetailHref(row, tab.key))}" data-nav="${escapeHtml(auditDetailHref(row, tab.key))}" class="flex-1 border-r px-3 py-2.5 text-center text-sm last:border-r-0 ${tab.key === activeTab ? 'bg-blue-600 font-semibold text-white' : 'text-slate-600 hover:bg-slate-50'}">${escapeHtml(tab.label)}${tab.key === 'differences' && row.differences.length ? ` (${row.differences.length})` : ''}</a>`).join('')}</nav>`
}

function renderChainNode(label: string, no: string, status: string): string {
  return `<div class="min-w-0 rounded-lg bg-slate-50 px-3 py-3"><div class="text-xs text-muted-foreground">${escapeHtml(label)}</div><div class="mt-1 truncate font-mono text-xs font-semibold" title="${escapeHtml(no)}">${escapeHtml(no)}</div><div class="mt-2 text-xs">${escapeHtml(status)}</div></div>`
}

function renderOverviewDetail(row: ChainRow): string {
  const groups = [
    {
      title: '1. 回货与质检',
      description: '工厂回货进入待加工仓，确认后发起质检。',
      nodes: [
        ['回货单', row.delivery.deliveryOrderNo, row.delivery.status],
        ['质检任务', row.trace.qcTask?.qcTaskNo || '未生成', row.trace.qcTask?.status || '未开始'],
      ],
    },
    {
      title: '2. 后道与复检',
      description: '质检通过后进入后道；完成后生成复检单。',
      nodes: [
        ['后道任务', row.trace.postTask?.postTaskNo || '未生成 / 不适用', row.trace.postTask?.status || '未开始'],
        ['复检单', row.trace.recheckOrder?.recheckOrderNo || '未生成', row.trace.recheckOrder?.status || '未开始'],
      ],
    },
    {
      title: '3. 交出与收货',
      description: '复检通过后进入待交出仓，出货并由仓库确认收货。',
      nodes: [
        ['待交出仓', row.trace.waitHandoverRecord?.warehouseRecordId || '未入仓', row.trace.waitHandoverRecord?.status || '未开始'],
        ['出货单', row.trace.outboundOrder?.outboundOrderNo || '未生成', row.trace.outboundOrder?.status || '未开始'],
      ],
    },
  ]
  return `<section class="rounded-xl border bg-white p-4"><div class="flex flex-wrap items-center justify-between gap-3"><div><h3 class="font-semibold">按阶段查看单据链</h3><p class="mt-1 text-xs text-muted-foreground">同一次回货按三个业务阶段归组；不再将所有单据平铺在一行。</p></div><div class="text-right text-xs text-muted-foreground">当前环节<div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(row.currentStage)}</div></div></div><div class="mt-4 grid gap-3 xl:grid-cols-3">${groups.map((group) => `<section class="rounded-xl border p-3"><h4 class="text-sm font-semibold">${escapeHtml(group.title)}</h4><p class="mt-1 min-h-8 text-xs text-muted-foreground">${escapeHtml(group.description)}</p><div class="mt-3 space-y-2">${group.nodes.map(([label, no, status]) => renderChainNode(label, no, status)).join('')}</div></section>`).join('')}</div></section>`
}

function renderDifferenceDetail(row: ChainRow): string {
  const defects = listPostFinishingDefectRecords().filter((record) => record.deliveryOrderNo === row.delivery.deliveryOrderNo)
  return `<div class="space-y-4"><section class="rounded-xl border bg-white p-4"><div class="flex items-center justify-between gap-3"><div><h3 class="font-semibold">逐 SKU 数量差异</h3><p class="mt-1 text-xs text-muted-foreground">这里只显示有差异的 SKU；授权人和数量口径保留在同一行。</p></div><span class="rounded-full px-3 py-1 text-sm font-semibold ${row.differences.length ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">${row.differences.length} 条</span></div><div class="mt-3 overflow-x-auto"><table class="min-w-[820px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">环节</th><th class="px-3 py-2">SKU</th><th class="px-3 py-2">应有</th><th class="px-3 py-2">实有</th><th class="px-3 py-2">差异</th><th class="px-3 py-2">授权人</th></tr></thead><tbody class="divide-y">${row.differences.map((line) => `<tr><td class="px-3 py-3">${escapeHtml(line.stage)}</td><td class="px-3 py-3"><div class="flex items-center gap-2"><img src="${escapeHtml(line.sku.imageUrl)}" alt="${escapeHtml(`${line.sku.spuName} ${line.sku.colorName} ${line.sku.sizeName}`)}" class="h-10 w-10 rounded-md border object-cover" /><div><div class="font-mono text-xs font-semibold">${escapeHtml(line.sku.skuCode)}</div><div class="text-[11px] text-muted-foreground">${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div></div></div></td><td class="px-3 py-3">${line.expectedQty} 件</td><td class="px-3 py-3">${line.actualQty} 件</td><td class="px-3 py-3 font-semibold text-amber-700">${line.direction} ${line.differenceQty} 件</td><td class="px-3 py-3">${escapeHtml(line.authorization)}</td></tr>`).join('') || '<tr><td colspan="6" class="px-6 py-10 text-center text-emerald-700">当前已发生环节没有逐 SKU 数量差异。</td></tr>'}</tbody></table></div></section><section class="rounded-xl border bg-white p-4"><h3 class="font-semibold">瑕疵记录</h3><p class="mt-1 text-xs text-muted-foreground">按 SKU 展示质检和后道记录；没有记录时保持空态。</p><div class="mt-3 grid gap-2 lg:grid-cols-2">${defects.map((record) => `<div class="rounded-lg border p-3 text-sm"><div class="flex items-center justify-between gap-2"><span class="font-semibold">${escapeHtml(record.sku.skuCode)} · ${record.defectQty} 件瑕疵</span><span class="text-xs text-muted-foreground">${escapeHtml(record.discoveryStage)}</span></div><div class="mt-1 text-xs">${escapeHtml(record.defectReason)} · ${escapeHtml(record.responsibleParty || '责任待确认')}</div><div class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(record.sourceObjectNo)} / ${escapeHtml(record.recordedBy.actorName)}</div></div>`).join('') || '<div class="text-sm text-muted-foreground">本次业务链暂无瑕疵记录。</div>'}</div></section></div>`
}

function renderTimelineDetail(row: ChainRow): string {
  const timeline = [...row.logs].sort((a, b) => a.operatedAt.localeCompare(b.operatedAt))
  const stageOrder = ['回货登记', '回货确认', '送检', '质检', '后道', '复检', '待交出仓', '出货', '仓库收货', '授权']
  const stages = Array.from(new Set([...stageOrder, ...timeline.map((log) => log.stage)]))
    .map((stage) => ({ stage, logs: timeline.filter((log) => log.stage === stage) }))
    .filter((group) => group.logs.length)
  let sequence = 0
  return `<section class="rounded-xl border bg-white p-4"><h3 class="font-semibold">按环节归组的操作记录</h3><p class="mt-1 text-xs text-muted-foreground">先选择业务环节，再查看该环节内的操作人、时间、状态、数量差异和授权事实。</p><div class="mt-4 space-y-3">${stages.map((group, groupIndex) => `<details class="rounded-xl border" ${groupIndex === stages.length - 1 ? 'open' : ''}><summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3"><span class="font-semibold">${escapeHtml(group.stage)}</span><span class="text-xs text-muted-foreground">${group.logs.length} 条操作</span></summary><ol class="space-y-2 border-t bg-slate-50/50 p-3">${group.logs.map((log) => { sequence += 1; return `<li class="grid gap-2 rounded-lg bg-white p-3 md:grid-cols-[32px_170px_1fr]"><span class="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-800">${sequence}</span><div class="text-xs"><div class="font-semibold">${escapeHtml(new Date(log.operatedAt).toLocaleString('zh-CN'))}</div><div class="mt-1 text-muted-foreground">${escapeHtml(log.operatorName)}</div></div><div class="text-sm"><div class="font-semibold">${escapeHtml(log.action)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${log.beforeStatus || '—'} → ${log.afterStatus || '—'}`)}${log.differenceQuantity === undefined ? '' : ` · 差异 ${log.differenceQuantity} 件`}${log.authorizerName ? ` · 授权人 ${escapeHtml(log.authorizerName)}` : ''}</div>${log.remark ? `<div class="mt-1 text-xs">${escapeHtml(log.remark)}</div>` : ''}</div></li>` }).join('')}</ol></details>`).join('') || '<div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">暂无操作记录。</div>'}</div></section>`
}

function renderDetail(row: ChainRow, activeTab: AuditDetailTab): string {
  const content = activeTab === 'differences'
    ? renderDifferenceDetail(row)
    : activeTab === 'timeline'
      ? renderTimelineDetail(row)
      : renderOverviewDetail(row)
  return `<section class="space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4" data-audit-chain-detail="${escapeHtml(row.delivery.deliveryId)}" data-audit-detail-tab="${activeTab}"><div class="flex flex-wrap items-start justify-between gap-3"><div><a href="/fcs/craft/post-finishing/audit-records" data-nav="/fcs/craft/post-finishing/audit-records" class="text-sm text-blue-700 hover:underline">← 返回业务链列表</a><h2 class="mt-2 text-lg font-semibold">${escapeHtml(row.delivery.productionOrderNo)} · 第 ${row.delivery.returnIndex} 次回货</h2><p class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(row.delivery.deliveryOrderNo)}</p></div><div class="text-right"><div class="text-xs text-muted-foreground">${escapeHtml(row.currentStage)}</div><div class="mt-1">${renderPostStatusBadge(row.currentStatus)}</div></div></div>${renderDetailTabs(row, activeTab)}${content}</section>`
}

export function renderPostFinishingAuditRecordsPage(): string {
  const params = query()
  const keyword = params.get('keyword')?.trim().toLowerCase() || ''
  const status = params.get('status') || ''
  const allRows = buildRows()
  const rows = allRows.filter((row) => {
    const text = [row.delivery.productionOrderNo, row.delivery.deliveryOrderNo, row.trace.qcTask?.qcTaskNo, row.trace.postTask?.postTaskNo, row.trace.recheckOrder?.recheckOrderNo, row.trace.outboundOrder?.outboundOrderNo].filter(Boolean).join(' ').toLowerCase()
    return (!keyword || text.includes(keyword))
      && (!status || row.currentStatus === status)
      && matchesOperationFilters(row, params)
  })
  const pageSize = Math.max(10, Math.min(50, Number(params.get('pageSize') || 10)))
  const slice = paginateStandardListRows(rows, Number(params.get('page') || 1), pageSize)
  const preferences: StandardListColumnPreferences = { order: columns.map((column) => column.key), visibleKeys: columns.map((column) => column.key), frozenKeys: ['delivery'], pageSize }
  const selected = allRows.find((row) => row.delivery.deliveryId === params.get('deliveryId'))
  const activeDetailTab = selectedAuditDetailTab(params)
  const filtersHtml = `<form action="/fcs/craft/post-finishing/audit-records" class="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-4 xl:grid-cols-8"><label class="text-xs text-muted-foreground xl:col-span-2">生产单 / 回货单 / 下游单号<input name="keyword" value="${escapeHtml(params.get('keyword') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" placeholder="按业务链查询" /></label><label class="text-xs text-muted-foreground">当前状态<select name="status" class="mt-1 h-9 w-full rounded-md border px-3 text-sm"><option value="">全部</option>${Array.from(new Set(allRows.map((row) => row.currentStatus))).map((value) => `<option ${value === status ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label><label class="text-xs text-muted-foreground">开始日期<input type="date" name="startedAt" value="${escapeHtml(params.get('startedAt') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label><label class="text-xs text-muted-foreground">结束日期<input type="date" name="endedAt" value="${escapeHtml(params.get('endedAt') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label><label class="text-xs text-muted-foreground">操作人<input name="operator" value="${escapeHtml(params.get('operator') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label><label class="text-xs text-muted-foreground">授权人<input name="authorizer" value="${escapeHtml(params.get('authorizer') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label><label class="text-xs text-muted-foreground">差异方向<select name="direction" class="mt-1 h-9 w-full rounded-md border px-3 text-sm"><option value="">全部</option>${['多','少'].map((value) => `<option ${value === params.get('direction') ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label class="text-xs text-muted-foreground">授权结果<select name="authorizationResult" class="mt-1 h-9 w-full rounded-md border px-3 text-sm"><option value="">全部</option>${['成功','过期','已使用','无效'].map((value) => `<option ${value === params.get('authorizationResult') ? 'selected' : ''}>${value}</option>`).join('')}</select></label><button class="h-9 self-end rounded-md border px-5 text-sm md:col-span-4 xl:col-span-8">查询</button></form>`
  return renderStandardListPage({
    title: '差异与操作日志',
    feedbackHtml: selected ? renderDetail(selected, activeDetailTab) : '',
    filtersHtml,
    statsHtml: renderStandardListStats([
      { label: '业务链（每次回货一条）', value: allRows.length },
      { label: '涉及生产单', value: new Set(allRows.map((row) => row.delivery.productionOrderNo)).size },
      { label: '存在逐 SKU 差异的链路', value: allRows.filter((row) => row.differences.length > 0).length },
    ]),
    listTitle: '回货全链路总览',
    tableHtml: renderStandardListTable({ columns, rows: slice.rows, preferences, sort: null, eventPrefix: 'post-finishing', emptyText: '暂无符合条件的业务链。' }),
    paginationHtml: renderTablePagination({ total: slice.total, from: slice.from, to: slice.to, currentPage: slice.currentPage, totalPages: slice.totalPages, pageSize: slice.pageSize, actionPrefix: 'post-finishing', fieldPrefix: 'post-finishing' }),
  })
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
