import {
  RETURN_INBOUND_PROCESS_LABEL,
  RETURN_INBOUND_QC_POLICY_LABEL,
  escapeHtml,
  formatDateTime,
  RESULT_LABEL,
  DISPOSITION_LABEL,
  listState,
  toInputValue,
  getFilteredQcRows,
  getFactoryOptions,
  getWarehouseOptions,
  getInspectorOptions,
  getWorkbenchStats,
  getWorkbenchTabCounts,
  type QcDisplayResult,
  type QcDisposition,
  type ReturnInboundQcPolicy,
} from './context'
import { buildQcDeductionHref, buildQcDetailHref } from '../../data/fcs/quality-chain-adapter'
import {
  PLATFORM_QC_WORKBENCH_VIEW_LABEL,
  QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL,
  QUALITY_DEDUCTION_FACTORY_RESPONSE_STATUS_LABEL,
  QUALITY_DEDUCTION_LIABILITY_STATUS_LABEL,
  QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL,
  type PlatformQcWorkbenchViewKey,
} from '../../data/fcs/quality-deduction-selectors'

import {
  renderBadge,
  renderSelect,
  renderSecondaryButton,
  renderTable,
  type TableColumn,
} from '../../components/ui'

// ============ 类型 ============

type QcRow = ReturnType<typeof getFilteredQcRows>[number]

// ============ 常量映射 ============

const INSPECTION_SCENE_LABEL: Record<string, string> = {
  RETURN_INBOUND: '回货质检',
  SEW_RETURN_RECEIVING_QC: '回货质检',
  POST_FINAL_RECHECK: '后道复检',
  PRINT_RECEIVING_QC: '印花回货质检',
  DYE_RECEIVING_QC: '染色回货质检',
  CUT_PIECE_RECEIVING_QC: '裁片回货质检',
}

const INSPECTION_METHOD_LABEL: Record<string, string> = {
  COUNT_ONLY: '数量复核',
  SAMPLING: '抽检',
  FULL_INSPECTION: '全检',
}

// ============ 业务徽章（QC 状态 → 组件变体） ============

function renderResultBadge(result: QcDisplayResult): string {
  const variant = result === 'PASS' ? 'success' : result === 'FAIL' ? 'danger' : 'warning'
  return renderBadge(RESULT_LABEL[result], variant)
}

function renderDispositionBadge(result: QcDisplayResult, disposition?: QcDisposition): string {
  if (result === 'PASS' || !disposition) {
    return '<span class="text-xs text-muted-foreground">—</span>'
  }
  return renderBadge(DISPOSITION_LABEL[disposition], 'warning')
}

function renderPolicyBadge(policy: ReturnInboundQcPolicy): string {
  return renderBadge(RETURN_INBOUND_QC_POLICY_LABEL[policy], 'neutral')
}

function renderLiabilityBadge(row: QcRow): string {
  const variant =
    row.liabilityStatus === 'FACTORY' ? 'danger' :
    row.liabilityStatus === 'NON_FACTORY' ? 'success' :
    row.liabilityStatus === 'MIXED' ? 'info' : 'neutral'
  return renderBadge(row.liabilityStatusLabel, variant)
}

function renderFactoryResponseBadge(row: QcRow): string {
  const variant =
    row.factoryResponseStatus === 'PENDING_RESPONSE' ? 'warning' :
    row.factoryResponseStatus === 'CONFIRMED' ? 'success' :
    row.factoryResponseStatus === 'AUTO_CONFIRMED' ? 'info' :
    row.factoryResponseStatus === 'DISPUTED' ? 'danger' : 'neutral'
  return renderBadge(row.factoryResponseStatusLabel, variant)
}

function renderDisputeBadge(row: QcRow): string {
  const variant =
    row.disputeStatus === 'PENDING_REVIEW' || row.disputeStatus === 'IN_REVIEW' ? 'warning' :
    row.disputeStatus === 'PARTIALLY_ADJUSTED' || row.disputeStatus === 'REVERSED' ? 'info' :
    row.disputeStatus === 'UPHELD' ? 'danger' : 'neutral'
  return renderBadge(row.disputeStatusLabel, variant)
}

function renderSettlementBadge(row: QcRow): string {
  const variant =
    row.settlementImpactStatus === 'BLOCKED' ? 'warning' :
    row.settlementImpactStatus === 'ELIGIBLE' || row.settlementImpactStatus === 'INCLUDED_IN_STATEMENT' ? 'success' :
    row.settlementImpactStatus === 'SETTLED' ? 'info' : 'neutral'
  return renderBadge(row.settlementImpactStatusLabel, variant)
}

// ============ 辅助函数 ============

function getInspectionSceneLabel(row: QcRow): string {
  const scene = row.qc.inspectionScene
  if (!scene) return '回货质检'
  return INSPECTION_SCENE_LABEL[scene] ?? '回货质检'
}

function getInspectionMethodLabel(row: QcRow): string {
  const method = row.qc.inspectionMethod
  if (!method) return '抽检'
  return INSPECTION_METHOD_LABEL[method] ?? '抽检'
}

function formatDeadlineSummary(deadline?: string, isOverdue?: boolean): string {
  if (!deadline) return '—'
  const timestamp = new Date(deadline.replace(' ', 'T')).getTime()
  if (!Number.isFinite(timestamp)) return formatDateTime(deadline)
  const diff = timestamp - Date.now()
  const abs = Math.abs(diff)
  const day = 24 * 60 * 60 * 1000
  const hour = 60 * 60 * 1000
  const amount = abs >= day ? Math.ceil(abs / day) : Math.ceil(abs / hour)
  const unit = abs >= day ? '天' : '小时'
  const overdue = isOverdue ?? diff < 0
  return `${formatDateTime(deadline)} · ${overdue ? `已超时 ${amount}${unit}` : `剩余 ${amount}${unit}`}`
}

function renderLabeledFilter(label: string, selectHtml: string): string {
  return `<div><label class="mb-1 block text-xs text-muted-foreground">${escapeHtml(label)}</label>${selectHtml}</div>`
}

// ============ 统计卡片 ============

function renderStatCards(stats: ReturnType<typeof getWorkbenchStats>): string {
  const cards = [
    { t: '质检记录总数', v: stats.totalCount, d: `当前视图基数（${listState.showLegacy ? '含旧记录' : '不含旧记录'}）` },
    { t: '待工厂响应', v: stats.waitFactoryResponseCount, o: 'text-orange-600', d: `已自动确认 ${stats.autoConfirmedCount} 条` },
    { t: '异议中 / 待平台处理', v: stats.waitPlatformReviewCount, o: 'text-amber-600', d: `异议链路共 ${stats.disputingCount} 条` },
    { t: '冻结中 / 待结算', v: stats.blockedOrReadyCount, o: 'text-blue-600', d: `冻结 ${stats.blockedCount} 条 · 待结算 ${stats.readyForSettlementCount} 条` },
  ]
  return cards.map((c) => `
    <article class="rounded-md border bg-card px-4 py-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(c.t)}</div>
      <div class="mt-1 text-2xl font-semibold ${c.o ?? 'text-foreground'}">${c.v}</div>
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(c.d)}</div>
    </article>`).join('')
}

// ============ 视图标签页 ============

function renderViewTabs(tabCounts: Record<PlatformQcWorkbenchViewKey, number>): string {
  const views: PlatformQcWorkbenchViewKey[] = [
    'ALL', 'WAIT_FACTORY_RESPONSE', 'AUTO_CONFIRMED',
    'DISPUTING', 'WAIT_PLATFORM_REVIEW', 'CLOSED',
  ]
  return `
    <section class="rounded-md border bg-card px-4 py-3">
      <div class="flex flex-wrap gap-2">
        ${views.map((view) => {
          const active = listState.activeView === view
          return `<button class="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm ${active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-background text-slate-600 hover:bg-muted'}"
            data-qcr-action="set-view" data-qcr-view="${view}">
            <span>${PLATFORM_QC_WORKBENCH_VIEW_LABEL[view]}</span>
            <span class="rounded bg-background/70 px-1.5 py-0.5 text-xs">${tabCounts[view] ?? 0}</span></button>`
        }).join('')}
      </div>
    </section>`
}

// ============ 筛选区 ============

function renderFilterSelect(opts: Array<{ value: string; label: string }>, value: string, filter: string): string {
  return renderSelect({ options: opts, value, prefix: 'qcr', filter })
}

function renderFilters(): string {
  const toKV = (e: Record<string, string>) =>
    [{ value: 'ALL', label: '全部' }, ...Object.entries(e).map(([k, v]) => ({ value: k, label: v }))]
  const toStr = (v: string[]) =>
    [{ value: 'ALL', label: '全部' }, ...v.map((x) => ({ value: x, label: x }))]

  return `
    <section class="rounded-md border bg-card p-4">
      <div class="grid gap-3 xl:grid-cols-6">
        <div class="xl:col-span-2">
          <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            data-qcr-filter="keyword" value="${toInputValue(listState.keyword)}"
            placeholder="质检单号 / 回货批次号 / 生产单号" />
        </div>
        ${renderLabeledFilter('回货环节', renderFilterSelect(toKV(RETURN_INBOUND_PROCESS_LABEL), listState.filterProcessType, 'processType'))}
        ${renderLabeledFilter('回货工厂', renderFilterSelect(toStr(getFactoryOptions()), listState.filterFactory, 'factory'))}
        ${renderLabeledFilter('接收方', renderFilterSelect(toStr(getWarehouseOptions()), listState.filterWarehouse, 'warehouse'))}
        ${renderLabeledFilter('检查策略', renderFilterSelect(toKV(RETURN_INBOUND_QC_POLICY_LABEL), listState.filterPolicy, 'policy'))}
        ${renderLabeledFilter('检查结果', renderFilterSelect([
          { value: 'ALL', label: '全部' }, { value: 'PASS', label: '合格' },
          { value: 'PARTIAL_PASS', label: '部分合格' }, { value: 'FAIL', label: '不合格' },
        ], listState.filterResult, 'result'))}
        ${renderLabeledFilter('责任状态', renderFilterSelect(toKV(QUALITY_DEDUCTION_LIABILITY_STATUS_LABEL), listState.filterLiabilityStatus, 'liabilityStatus'))}
        ${renderLabeledFilter('工厂响应状态', renderFilterSelect(toKV(QUALITY_DEDUCTION_FACTORY_RESPONSE_STATUS_LABEL), listState.filterFactoryResponseStatus, 'factoryResponseStatus'))}
        ${renderLabeledFilter('异议状态', renderFilterSelect(toKV(QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL), listState.filterDisputeStatus, 'disputeStatus'))}
        ${renderLabeledFilter('结算影响状态', renderFilterSelect(toKV(QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL), listState.filterSettlementImpactStatus, 'settlementImpactStatus'))}
        ${renderLabeledFilter('不合格品处置方式', renderFilterSelect([
          { value: 'ALL', label: '全部' }, { value: 'ACCEPT_AS_DEFECT', label: '接受瑕疵品' },
          { value: 'SCRAP', label: '报废' }, { value: 'ACCEPT', label: '接受（不合格品免扣）' },
        ], listState.filterDisposition, 'disposition'))}
        ${renderLabeledFilter('质检人', renderFilterSelect(toStr(getInspectorOptions()), listState.filterInspector, 'inspector'))}
        <div class="flex items-end gap-3 xl:col-span-2">
          <label class="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
            <input type="checkbox" data-qcr-filter="showLegacy" ${listState.showLegacy ? 'checked' : ''} />显示旧记录
          </label>
          ${renderSecondaryButton('重置', { prefix: 'qcr', action: 'reset-filters' })}
        </div>
      </div>
    </section>`
}

// ============ 表格列定义（14 列） ============

function buildTableColumns(): TableColumn<QcRow>[] {
  return [
    {
      key: 'qcNo', title: '检查单号', className: 'align-top',
      render: (row) => {
        const href = buildQcDetailHref(row.qcId)
        return `<button type="button" class="font-mono text-xs font-semibold text-primary hover:underline"
            data-qcr-action="open-detail" data-qcr-href="${escapeHtml(href)}">${escapeHtml(row.qcNo)}</button>
          ${row.isLegacy ? '<div class="mt-1 inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">旧质检记录</div>' : ''}`
      },
    },
    {
      key: 'batchId', title: '回货批次号', className: 'align-top',
      render: (row) => `<span class="font-mono text-xs">${escapeHtml(row.batchId || '-')}</span>`,
    },
    {
      key: 'productionOrderId', title: '生产单号', className: 'align-top',
      render: (row) => `<span class="font-mono text-xs">${escapeHtml(row.productionOrderId || '-')}</span>`,
    },
    {
      key: 'scene', title: '检查场景 / 回货环节', className: 'align-top',
      render: (row) => `<div class="space-y-1"><div>${escapeHtml(getInspectionSceneLabel(row))}</div>
          <div class="text-xs text-muted-foreground">${escapeHtml(row.processLabel)} · ${escapeHtml(getInspectionMethodLabel(row))}</div></div>`,
    },
    {
      key: 'factory', title: '工厂 / 接收方', className: 'align-top',
      render: (row) => `<div class="space-y-1"><div>${escapeHtml(row.returnFactoryName || '-')}</div>
          <div class="text-xs text-muted-foreground">${escapeHtml(row.qc.receiverName || row.warehouseName || '-')}</div></div>`,
    },
    {
      key: 'result', title: '检查结果', className: 'align-top',
      render: (row) => `<div class="space-y-1"><div class="flex flex-wrap items-center gap-2">${renderPolicyBadge(row.qcPolicy)}${renderResultBadge(row.result)}</div>
          <div class="text-xs text-muted-foreground">总检 ${row.inspectedQty} · 合格 ${row.qualifiedQty} · 不合格 ${row.unqualifiedQty}</div></div>`,
    },
    {
      key: 'inspector', title: '检查人 / 时间', className: 'align-top',
      render: (row) => `<div class="space-y-1"><div>${escapeHtml(row.inspector || '-')}</div>
          <div class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(row.inspectedAt))}</div></div>`,
    },
    {
      key: 'liability', title: '责任状态', className: 'align-top',
      render: (row) => `<div class="space-y-1">${renderLiabilityBadge(row)}
          <div class="text-xs text-muted-foreground">工厂责任 ${row.factoryLiabilityQty} · 非工厂责任 ${row.nonFactoryLiabilityQty}</div></div>`,
    },
    {
      key: 'disposition', title: '不合格品处置方式', className: 'align-top',
      render: (row) => renderDispositionBadge(row.result, row.disposition as QcDisposition | undefined),
    },
    {
      key: 'factoryResponse', title: '工厂响应', className: 'align-top',
      render: (row) => {
        const info = row.factoryResponseStatus === 'PENDING_RESPONSE'
          ? `截止 ${escapeHtml(formatDeadlineSummary(row.responseDeadlineAt, row.isResponseOverdue))}`
          : row.autoConfirmedAt ? `自动确认 ${escapeHtml(formatDateTime(row.autoConfirmedAt))}`
          : row.respondedAt ? `响应时间 ${escapeHtml(formatDateTime(row.respondedAt))}` : '当前无需工厂确认'
        return `<div class="space-y-1">${renderFactoryResponseBadge(row)}
          <div class="text-xs text-muted-foreground">${info}</div>
          ${row.responderUserName ? `<div class="text-xs text-muted-foreground">响应人：${escapeHtml(row.responderUserName)}</div>` : ''}</div>`
      },
    },
    {
      key: 'dispute', title: '异议状态', className: 'align-top',
      render: (row) => `<div class="space-y-1">${renderDisputeBadge(row)}
          <div class="text-xs text-muted-foreground">${row.hasDispute
            ? (row.canHandleDispute ? '平台需进入详情处理异议' : QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL[row.disputeStatus])
            : '当前无异议单'}</div></div>`,
    },
    {
      key: 'deduction', title: '扣款依据', className: 'align-top',
      render: (row) => {
        if (!row.canViewDeduction || !row.basisId) {
          return '<div class="text-xs text-muted-foreground">未生成扣款依据 · 冻结加工费与质量扣款均未形成依据</div>'
        }
        return `<div class="space-y-1"><div class="font-mono text-xs font-semibold text-primary">${escapeHtml(row.basisId)}</div>
          <div class="text-xs text-muted-foreground">${escapeHtml(row.deductionBasisStatusLabel)}</div>
          <div class="text-xs text-muted-foreground">冻结加工费 ${row.blockedProcessingFeeAmount} CNY · 生效质量扣款 ${row.effectiveQualityDeductionAmount} CNY</div></div>`
      },
    },
    {
      key: 'settlement', title: '结算影响', className: 'align-top',
      render: (row) => `<div class="space-y-1">${renderSettlementBadge(row)}
          <div class="text-xs text-muted-foreground">${escapeHtml(row.settlementImpactSummary)}</div>
          <div class="text-xs text-muted-foreground">${row.settlementReady ? '已进入可结算口径' : '当前仍影响结算'}</div></div>`,
    },
    {
      key: 'actions', title: '操作', className: 'align-top',
      render: (row) => {
        const detailHref = buildQcDetailHref(row.qcId)
        const disputeHref = `${detailHref}?focus=dispute`
        const parts = [`<button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">查看详情</button>`]
        if (row.canViewDeduction && row.basisId) {
          parts.push(`<button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(buildQcDeductionHref(row.qcId))}">查看扣款</button>`)
        }
        if (row.canHandleDispute) {
          parts.push(`<button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs text-amber-700 hover:bg-amber-50" data-nav="${escapeHtml(disputeHref)}">处理异议</button>`)
        }
        return `<div class="flex flex-wrap gap-2">${parts.join('')}</div>`
      },
    },
  ]
}

// ============ 页面主入口 ============

export function renderQcRecordsPage(): string {
  const rows = getFilteredQcRows()
  const stats = getWorkbenchStats()
  const tabCounts = getWorkbenchTabCounts()

  return `
    <div class="flex flex-col gap-6 p-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">质检记录</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          统一查看回货质检、后道复检、工厂响应、异议处理、扣款依据与结算影响。
        </p>
      </div>

      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderStatCards(stats)}
      </section>

      ${renderViewTabs(tabCounts)}
      ${renderFilters()}

      <section class="overflow-x-auto rounded-md border bg-card">
        ${renderTable(buildTableColumns(), rows, { emptyText: '当前工作台视图下暂无质检记录', striped: true })}
      </section>
    </div>`
}
