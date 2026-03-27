import { getSettlementPageBoundary } from '../data/fcs/settlement-flow-boundaries.ts'
import {
  getPreSettlementLedgerById,
  listPreSettlementLedgers,
  tracePreSettlementLedgerSource,
  type PreSettlementLedgerSourceTrace,
} from '../data/fcs/pre-settlement-ledger-repository.ts'
import type {
  PreSettlementLedger,
  PreSettlementLedgerStatus,
  PreSettlementLedgerType,
} from '../data/fcs/store-domain-settlement-types.ts'
import { appStore } from '../state/store.ts'
import { escapeHtml, toClassName } from '../utils.ts'

type LedgerWorkbenchView =
  | 'ALL'
  | 'TASK_EARNING'
  | 'QUALITY_DEDUCTION'
  | 'OPEN'
  | 'IN_STATEMENT'
  | 'IN_PREPAYMENT'

type LedgerTypeFilter = '__ALL__' | PreSettlementLedgerType
type LedgerStatusFilter = '__ALL__' | PreSettlementLedgerStatus

interface PreSettlementLedgerPageState {
  activeView: LedgerWorkbenchView
  keyword: string
  filterFactory: string
  filterCycle: string
  filterType: LedgerTypeFilter
  filterStatus: LedgerStatusFilter
  detailLedgerId: string | null
}

const VIEW_LABEL: Record<LedgerWorkbenchView, string> = {
  ALL: '全部正式流水',
  TASK_EARNING: '任务收入流水',
  QUALITY_DEDUCTION: '质量扣款流水',
  OPEN: '待入对账单',
  IN_STATEMENT: '已入对账单',
  IN_PREPAYMENT: '已入预付款批次 / 已预付',
}

const LEDGER_TYPE_LABEL: Record<PreSettlementLedgerType, string> = {
  TASK_EARNING: '任务收入流水',
  QUALITY_DEDUCTION: '质量扣款流水',
}

const LEDGER_TYPE_BADGE: Record<PreSettlementLedgerType, string> = {
  TASK_EARNING: 'border border-green-200 bg-green-50 text-green-700',
  QUALITY_DEDUCTION: 'border border-red-200 bg-red-50 text-red-700',
}

const LEDGER_STATUS_LABEL: Record<PreSettlementLedgerStatus, string> = {
  OPEN: '待入对账单',
  IN_STATEMENT: '已入对账单',
  IN_PREPAYMENT_BATCH: '已入预付款批次',
  PREPAID: '已预付',
  RESERVED_FOR_FINAL_SETTLEMENT: '保留到后续分账',
}

const LEDGER_STATUS_BADGE: Record<PreSettlementLedgerStatus, string> = {
  OPEN: 'border border-amber-200 bg-amber-50 text-amber-700',
  IN_STATEMENT: 'border border-blue-200 bg-blue-50 text-blue-700',
  IN_PREPAYMENT_BATCH: 'border border-violet-200 bg-violet-50 text-violet-700',
  PREPAID: 'border border-green-200 bg-green-50 text-green-700',
  RESERVED_FOR_FINAL_SETTLEMENT: 'border border-slate-200 bg-slate-50 text-slate-700',
}

const PRICE_SOURCE_LABEL: Record<string, string> = {
  DISPATCH: '派单价',
  BID: '竞价中标价',
  OTHER_COMPAT: '兼容快照',
}

const state: PreSettlementLedgerPageState = {
  activeView: 'ALL',
  keyword: '',
  filterFactory: '__ALL__',
  filterCycle: '__ALL__',
  filterType: '__ALL__',
  filterStatus: '__ALL__',
  detailLedgerId: null,
}

function getCurrentSearchParams(): URLSearchParams {
  const [, query = ''] = appStore.getState().pathname.split('?')
  return new URLSearchParams(query)
}

function syncPreSettlementLedgerStateFromPath(): void {
  const params = getCurrentSearchParams()
  const view = params.get('view')
  const keyword = params.get('keyword')

  if (view === 'task') state.activeView = 'TASK_EARNING'
  else if (view === 'quality') state.activeView = 'QUALITY_DEDUCTION'
  else if (view === 'open' || view === 'pending') state.activeView = 'OPEN'
  else if (view === 'statement' || view === 'bound') state.activeView = 'IN_STATEMENT'
  else if (view === 'batch' || view === 'payment' || view === 'effective' || view === 'void') state.activeView = 'IN_PREPAYMENT'
  else if (view === 'all') state.activeView = 'ALL'

  if (keyword !== null) state.keyword = keyword
}

function showLedgerToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'pre-settlement-ledger-toast-root'
  let root = document.getElementById(rootId)
  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-6 top-20 z-[120] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }

  const toast = document.createElement('div')
  toast.className =
    tone === 'error'
      ? 'pointer-events-auto rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-md transition-all duration-200'
      : 'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200'
  toast.textContent = message
  toast.style.opacity = '0'
  toast.style.transform = 'translateY(-6px)'
  root.appendChild(toast)

  window.requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateY(0)'
  })

  window.setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(-6px)'
    window.setTimeout(() => {
      toast.remove()
      if (root && root.childElementCount === 0) root.remove()
    }, 180)
  }, 2200)
}

function formatAmount(amount: number, currency = 'CNY'): string {
  return `${currency} ${amount.toFixed(2)}`
}

function getViewCount(view: LedgerWorkbenchView, ledgers: PreSettlementLedger[]): number {
  return ledgers.filter((ledger) => matchesView(ledger, view)).length
}

function matchesView(ledger: PreSettlementLedger, view: LedgerWorkbenchView): boolean {
  if (view === 'ALL') return true
  if (view === 'TASK_EARNING') return ledger.ledgerType === 'TASK_EARNING'
  if (view === 'QUALITY_DEDUCTION') return ledger.ledgerType === 'QUALITY_DEDUCTION'
  if (view === 'OPEN') return ledger.status === 'OPEN'
  if (view === 'IN_STATEMENT') return ledger.status === 'IN_STATEMENT'
  return ledger.status === 'IN_PREPAYMENT_BATCH' || ledger.status === 'PREPAID'
}

function getFilteredLedgers(): PreSettlementLedger[] {
  const ledgers = listPreSettlementLedgers()
  const keyword = state.keyword.trim().toLowerCase()

  return ledgers.filter((ledger) => {
    if (!matchesView(ledger, state.activeView)) return false
    if (state.filterFactory !== '__ALL__' && ledger.factoryId !== state.filterFactory) return false
    if (state.filterCycle !== '__ALL__' && ledger.settlementCycleId !== state.filterCycle) return false
    if (state.filterType !== '__ALL__' && ledger.ledgerType !== state.filterType) return false
    if (state.filterStatus !== '__ALL__' && ledger.status !== state.filterStatus) return false
    if (!keyword) return true

    const haystack = [
      ledger.ledgerNo,
      ledger.factoryName,
      ledger.taskNo ?? '',
      ledger.returnInboundBatchNo ?? '',
      ledger.qcRecordId ?? '',
      ledger.statementId ?? '',
      ledger.prepaymentBatchId ?? '',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(keyword)
  })
}

function getFactoryOptions(ledgers: PreSettlementLedger[]): Array<{ id: string; name: string }> {
  return Array.from(new Map(ledgers.map((ledger) => [ledger.factoryId, ledger.factoryName])).entries())
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

function getCycleOptions(ledgers: PreSettlementLedger[]): Array<{ id: string; label: string; endAt: string }> {
  return Array.from(
    new Map(
      ledgers.map((ledger) => [
        ledger.settlementCycleId,
        {
          id: ledger.settlementCycleId,
          label: ledger.settlementCycleLabel,
          endAt: ledger.settlementCycleEndAt,
        },
      ]),
    ).values(),
  ).sort((left, right) => (left.endAt < right.endAt ? 1 : -1))
}

function renderStatsCard(label: string, value: number, subLabel?: string): string {
  return `
    <article class="rounded-lg border bg-card">
      <div class="px-4 pb-4 pt-4">
        <p class="text-xs text-muted-foreground">${escapeHtml(label)}</p>
        <p class="mt-1 text-2xl font-bold text-foreground tabular-nums">${value}</p>
        ${subLabel ? `<p class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(subLabel)}</p>` : ''}
      </div>
    </article>
  `
}

function renderViewChip(view: LedgerWorkbenchView, count: number): string {
  return `
    <button
      class="${toClassName(
        'inline-flex h-9 items-center rounded-full border px-4 text-sm',
        state.activeView === view ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted',
      )}"
      data-adj-action="switch-view"
      data-view="${view}"
      type="button"
    >
      ${escapeHtml(VIEW_LABEL[view])}
      <span class="ml-2 inline-flex rounded-md border bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">${count}</span>
    </button>
  `
}

function renderTypeCell(ledger: PreSettlementLedger): string {
  return `
    <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${LEDGER_TYPE_BADGE[ledger.ledgerType]}">
      ${escapeHtml(LEDGER_TYPE_LABEL[ledger.ledgerType])}
    </span>
  `
}

function renderStatusCell(ledger: PreSettlementLedger): string {
  return `
    <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${LEDGER_STATUS_BADGE[ledger.status]}">
      ${escapeHtml(LEDGER_STATUS_LABEL[ledger.status])}
    </span>
  `
}

function renderLedgerRows(ledgers: PreSettlementLedger[]): string {
  if (!ledgers.length) {
    return '<section class="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">当前视图暂无正式预结算流水</section>'
  }

  return `
    <section class="overflow-x-auto rounded-lg border">
      <table class="w-full min-w-[1660px] text-xs">
        <thead>
          <tr class="border-b bg-muted/40 text-left">
            <th class="px-4 py-2 font-medium">流水号</th>
            <th class="px-4 py-2 font-medium">流水类型</th>
            <th class="px-4 py-2 font-medium">工厂</th>
            <th class="px-4 py-2 font-medium">结算周期</th>
            <th class="px-4 py-2 font-medium">任务 / 质检</th>
            <th class="px-4 py-2 font-medium">回货批次</th>
            <th class="px-4 py-2 text-right font-medium">数量</th>
            <th class="px-4 py-2 font-medium">结算币种</th>
            <th class="px-4 py-2 text-right font-medium">结算金额</th>
            <th class="px-4 py-2 font-medium">当前状态</th>
            <th class="px-4 py-2 font-medium">对账单</th>
            <th class="px-4 py-2 font-medium">预付款批次</th>
            <th class="px-4 py-2 font-medium">发生时间</th>
            <th class="px-4 py-2 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          ${ledgers
            .map(
              (ledger) => `
                <tr class="border-b last:border-b-0">
                  <td class="px-4 py-3 font-mono">${escapeHtml(ledger.ledgerNo)}</td>
                  <td class="px-4 py-3">${renderTypeCell(ledger)}</td>
                  <td class="px-4 py-3">${escapeHtml(ledger.factoryName)}</td>
                  <td class="px-4 py-3 text-[11px] text-muted-foreground">${escapeHtml(ledger.settlementCycleLabel)}</td>
                  <td class="px-4 py-3">
                    <div class="font-medium text-foreground">${escapeHtml(ledger.ledgerType === 'TASK_EARNING' ? (ledger.taskNo ?? '—') : (ledger.qcRecordId ?? '—'))}</div>
                    <div class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(ledger.ledgerType === 'TASK_EARNING' ? (PRICE_SOURCE_LABEL[ledger.priceSourceType] ?? '兼容快照') : (ledger.pendingDeductionRecordId ?? '正式质量扣款流水'))}</div>
                  </td>
                  <td class="px-4 py-3 font-mono text-[11px]">${escapeHtml(ledger.returnInboundBatchNo ?? '—')}</td>
                  <td class="px-4 py-3 text-right font-mono">${ledger.qty}</td>
                  <td class="px-4 py-3">${escapeHtml(ledger.settlementCurrency)}</td>
                  <td class="px-4 py-3 text-right font-mono">${formatAmount(ledger.settlementAmount, ledger.settlementCurrency)}</td>
                  <td class="px-4 py-3">${renderStatusCell(ledger)}</td>
                  <td class="px-4 py-3">${ledger.statementId ? `<button class="text-primary underline underline-offset-2" data-nav="/fcs/settlement/statements">${escapeHtml(ledger.statementId)}</button>` : '—'}</td>
                  <td class="px-4 py-3">${ledger.prepaymentBatchId ? `<button class="text-primary underline underline-offset-2" data-nav="/fcs/settlement/batches">${escapeHtml(ledger.prepaymentBatchId)}</button>` : '—'}</td>
                  <td class="px-4 py-3">${escapeHtml(ledger.occurredAt)}</td>
                  <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1">
                      <button class="inline-flex h-6 items-center rounded-md border px-2 text-xs hover:bg-muted" data-adj-action="open-detail" data-ledger-id="${escapeHtml(ledger.ledgerId)}">查看详情</button>
                    </div>
                  </td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </section>
  `
}

function renderTraceRow(label: string, value: string): string {
  return `<div class="flex items-start justify-between gap-4 border-b py-2 last:border-b-0"><dt class="text-muted-foreground">${escapeHtml(label)}</dt><dd class="text-right text-foreground">${value}</dd></div>`
}

function renderLedgerDetail(trace: PreSettlementLedgerSourceTrace | null): string {
  if (!trace) return ''

  const { ledger, settlementProfile, statement, batch, task, productionOrder, qcRecord, pendingDeductionRecord, disputeCase } = trace
  const isTaskLedger = ledger.ledgerType === 'TASK_EARNING'

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-adj-action="close-detail" aria-label="关闭流水详情"></button>
      <div class="absolute inset-y-0 right-0 flex w-full max-w-[880px] flex-col bg-background shadow-2xl">
        <div class="flex items-start justify-between gap-4 border-b px-4 py-4">
          <div>
            <h2 class="text-sm font-semibold">流水详情</h2>
            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(ledger.ledgerNo)} · ${escapeHtml(LEDGER_TYPE_LABEL[ledger.ledgerType])}</p>
          </div>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-adj-action="close-detail">关闭</button>
        </div>

        <div class="flex-1 overflow-y-auto">
          <div class="grid gap-4 px-4 py-4 lg:grid-cols-[1.2fr_1fr]">
            <section class="rounded-lg border bg-muted/10 p-4">
              <h3 class="text-sm font-semibold">基本信息</h3>
              <dl class="mt-3 space-y-1 text-sm">
                ${renderTraceRow('流水号', escapeHtml(ledger.ledgerNo))}
                ${renderTraceRow('流水类型', escapeHtml(LEDGER_TYPE_LABEL[ledger.ledgerType]))}
                ${renderTraceRow('工厂', escapeHtml(ledger.factoryName))}
                ${renderTraceRow('结算周期', escapeHtml(ledger.settlementCycleLabel))}
                ${renderTraceRow('当前状态', escapeHtml(LEDGER_STATUS_LABEL[ledger.status]))}
                ${renderTraceRow('已入对账单', statement ? escapeHtml(statement.statementId) : '未入对账单')}
                ${renderTraceRow('已入预付款批次', batch ? escapeHtml(batch.batchId) : '未入预付款批次')}
              </dl>
            </section>

            <section class="rounded-lg border bg-muted/10 p-4">
              <h3 class="text-sm font-semibold">金额快照</h3>
              <dl class="mt-3 space-y-1 text-sm">
                ${renderTraceRow('原始金额', escapeHtml(formatAmount(ledger.originalAmount, ledger.originalCurrency)))}
                ${renderTraceRow('预结算金额', escapeHtml(formatAmount(ledger.settlementAmount, ledger.settlementCurrency)))}
                ${renderTraceRow('汇率快照', escapeHtml(String(ledger.fxRate ?? 1)))}
                ${renderTraceRow('汇率应用时间', escapeHtml(ledger.fxAppliedAt ?? '—'))}
                ${renderTraceRow('结算资料版本', escapeHtml(ledger.settlementProfileVersionNo ?? settlementProfile?.versionNo ?? '—'))}
              </dl>
            </section>
          </div>

          <div class="grid gap-4 border-t px-4 py-4 lg:grid-cols-[1.2fr_1fr]">
            <section class="rounded-lg border bg-background p-4">
              <h3 class="text-sm font-semibold">来源追溯</h3>
              <dl class="mt-3 space-y-1 text-sm">
                ${
                  isTaskLedger
                    ? [
                        renderTraceRow('任务号', escapeHtml(task?.taskNo ?? ledger.taskNo ?? '—')),
                        renderTraceRow('生产单号', escapeHtml(productionOrder?.legacyOrderNo ?? ledger.productionOrderNo ?? '—')),
                        renderTraceRow('回货批次号', escapeHtml(ledger.returnInboundBatchNo ?? '—')),
                        renderTraceRow('价格来源', escapeHtml(PRICE_SOURCE_LABEL[ledger.priceSourceType] ?? '兼容快照')),
                        renderTraceRow('单价', escapeHtml(ledger.unitPrice != null ? formatAmount(ledger.unitPrice, ledger.originalCurrency) : '—')),
                        renderTraceRow('数量', escapeHtml(String(ledger.qty))),
                      ].join('')
                    : [
                        renderTraceRow('质检记录', escapeHtml(qcRecord?.qcNo ?? ledger.qcRecordId ?? '—')),
                        renderTraceRow('待确认质量扣款记录', escapeHtml(pendingDeductionRecord?.pendingRecordId ?? ledger.pendingDeductionRecordId ?? '—')),
                        renderTraceRow('质量异议单', escapeHtml(disputeCase?.disputeId ?? ledger.disputeId ?? '—')),
                        renderTraceRow('裁决结果', escapeHtml(disputeCase?.adjudicationResult ?? ledger.sourceReason ?? '—')),
                        renderTraceRow('责任数量', escapeHtml(String(ledger.qty))),
                        renderTraceRow('来源说明', escapeHtml(ledger.sourceReason ?? '正式质量扣款流水')),
                      ].join('')
                }
              </dl>

              <div class="mt-4 flex flex-wrap gap-2">
                <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-nav="${escapeHtml(isTaskLedger ? `/fcs/pda/task-receive/${ledger.taskId ?? ledger.returnInboundBatchId ?? ''}` : `/fcs/quality/qc-records/${encodeURIComponent(qcRecord?.qcId ?? ledger.qcRecordId ?? '')}`)}">
                  查看来源对象
                </button>
                ${statement ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-nav="/fcs/settlement/statements">查看对账单</button>` : ''}
                ${batch ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-nav="/fcs/settlement/batches">查看预付款批次</button>` : ''}
              </div>
            </section>

            <section class="rounded-lg border bg-background p-4">
              <h3 class="text-sm font-semibold">流转说明</h3>
              <dl class="mt-3 space-y-1 text-sm">
                ${renderTraceRow('发生时间', escapeHtml(ledger.occurredAt))}
                ${renderTraceRow('当前说明', escapeHtml(ledger.remark ?? '—'))}
                ${renderTraceRow('入对账单状态', statement ? '已进入对账单' : '待进入对账单')}
                ${renderTraceRow('预付款批次状态', batch ? '已进入预付款批次' : '尚未进入预付款批次')}
                ${renderTraceRow('最终去向', escapeHtml(LEDGER_STATUS_LABEL[ledger.status]))}
              </dl>
            </section>
          </div>
        </div>
      </div>
    </div>
  `
}

export function renderAdjustmentsPage(): string {
  syncPreSettlementLedgerStateFromPath()

  const allLedgers = listPreSettlementLedgers()
  const filtered = getFilteredLedgers()
  const pageBoundary = getSettlementPageBoundary('adjustments')
  const factoryOptions = getFactoryOptions(allLedgers)
  const cycleOptions = getCycleOptions(allLedgers)
  const detailTrace = state.detailLedgerId ? tracePreSettlementLedgerSource(state.detailLedgerId) : null

  return `
    <div class="flex flex-col gap-6 p-6">
      <section>
        <h1 class="text-xl font-semibold text-foreground">预结算流水</h1>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(pageBoundary.pageIntro)}</p>
      </section>

      <section class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        ${renderStatsCard('全部正式流水', allLedgers.length, '统一承接任务收入与质量扣款')}
        ${renderStatsCard('任务收入流水', allLedgers.filter((item) => item.ledgerType === 'TASK_EARNING').length)}
        ${renderStatsCard('质量扣款流水', allLedgers.filter((item) => item.ledgerType === 'QUALITY_DEDUCTION').length)}
        ${renderStatsCard('待入对账单', allLedgers.filter((item) => item.status === 'OPEN').length)}
        ${renderStatsCard('已入对账单', allLedgers.filter((item) => item.status === 'IN_STATEMENT').length)}
        ${renderStatsCard(
          '已入预付款批次 / 已预付',
          allLedgers.filter((item) => item.status === 'IN_PREPAYMENT_BATCH' || item.status === 'PREPAID').length,
        )}
      </section>

      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-sm font-semibold">对象说明</h2>
        <p class="mt-1 text-xs text-muted-foreground">
          当前页面只展示正式预结算流水。任务收入流水来自回货批次与价格快照，质量扣款流水只来自已正式成立的质量扣款流水；待确认质量扣款记录和质量异议单不会进入本页正式流水池。
        </p>
      </section>

      <section class="rounded-xl border bg-background p-4">
        <div class="flex flex-wrap items-center gap-2">
          ${renderViewChip('ALL', getViewCount('ALL', allLedgers))}
          ${renderViewChip('TASK_EARNING', getViewCount('TASK_EARNING', allLedgers))}
          ${renderViewChip('QUALITY_DEDUCTION', getViewCount('QUALITY_DEDUCTION', allLedgers))}
          ${renderViewChip('OPEN', getViewCount('OPEN', allLedgers))}
          ${renderViewChip('IN_STATEMENT', getViewCount('IN_STATEMENT', allLedgers))}
          ${renderViewChip('IN_PREPAYMENT', getViewCount('IN_PREPAYMENT', allLedgers))}
        </div>
      </section>

      <section class="flex flex-wrap gap-2">
        <input class="h-8 w-56 rounded-md border bg-background px-2 text-xs" placeholder="流水号 / 任务号 / 回货批次号 / 质检记录号" data-adj-filter="keyword" value="${escapeHtml(state.keyword)}" />
        <select class="h-8 w-48 rounded-md border bg-background px-2 text-xs" data-adj-filter="factory">
          <option value="__ALL__" ${state.filterFactory === '__ALL__' ? 'selected' : ''}>全部工厂</option>
          ${factoryOptions.map((item) => `<option value="${escapeHtml(item.id)}" ${state.filterFactory === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
        </select>
        <select class="h-8 w-56 rounded-md border bg-background px-2 text-xs" data-adj-filter="cycle">
          <option value="__ALL__" ${state.filterCycle === '__ALL__' ? 'selected' : ''}>全部结算周期</option>
          ${cycleOptions.map((item) => `<option value="${escapeHtml(item.id)}" ${state.filterCycle === item.id ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
        </select>
        <select class="h-8 w-40 rounded-md border bg-background px-2 text-xs" data-adj-filter="type">
          <option value="__ALL__" ${state.filterType === '__ALL__' ? 'selected' : ''}>全部类型</option>
          <option value="TASK_EARNING" ${state.filterType === 'TASK_EARNING' ? 'selected' : ''}>任务收入流水</option>
          <option value="QUALITY_DEDUCTION" ${state.filterType === 'QUALITY_DEDUCTION' ? 'selected' : ''}>质量扣款流水</option>
        </select>
        <select class="h-8 w-44 rounded-md border bg-background px-2 text-xs" data-adj-filter="status">
          <option value="__ALL__" ${state.filterStatus === '__ALL__' ? 'selected' : ''}>全部状态</option>
          <option value="OPEN" ${state.filterStatus === 'OPEN' ? 'selected' : ''}>待入对账单</option>
          <option value="IN_STATEMENT" ${state.filterStatus === 'IN_STATEMENT' ? 'selected' : ''}>已入对账单</option>
          <option value="IN_PREPAYMENT_BATCH" ${state.filterStatus === 'IN_PREPAYMENT_BATCH' ? 'selected' : ''}>已入预付款批次</option>
          <option value="PREPAID" ${state.filterStatus === 'PREPAID' ? 'selected' : ''}>已预付</option>
          <option value="RESERVED_FOR_FINAL_SETTLEMENT" ${state.filterStatus === 'RESERVED_FOR_FINAL_SETTLEMENT' ? 'selected' : ''}>保留到后续分账</option>
        </select>
      </section>

      ${renderLedgerRows(filtered)}
      ${renderLedgerDetail(detailTrace)}
    </div>
  `
}

export function handleAdjustmentsEvent(target: HTMLElement): boolean {
  const filterNode = target.closest<HTMLElement>('[data-adj-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const field = filterNode.dataset.adjFilter
    if (!field) return true
    if (field === 'keyword') state.keyword = filterNode.value
    if (field === 'factory') state.filterFactory = filterNode.value
    if (field === 'cycle') state.filterCycle = filterNode.value
    if (field === 'type') state.filterType = filterNode.value as LedgerTypeFilter
    if (field === 'status') state.filterStatus = filterNode.value as LedgerStatusFilter
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-adj-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.adjAction
  if (!action) return false

  if (action === 'switch-view') {
    const view = actionNode.dataset.view as LedgerWorkbenchView | undefined
    if (view) state.activeView = view
    return true
  }

  if (action === 'open-detail') {
    const ledgerId = actionNode.dataset.ledgerId
    if (!ledgerId || !getPreSettlementLedgerById(ledgerId)) {
      showLedgerToast('未找到对应的正式流水', 'error')
      return true
    }
    state.detailLedgerId = ledgerId
    return true
  }

  if (action === 'close-detail') {
    state.detailLedgerId = null
    return true
  }

  return false
}

export function isAdjustmentsDialogOpen(): boolean {
  return Boolean(state.detailLedgerId)
}
