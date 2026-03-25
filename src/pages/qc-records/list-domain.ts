import {
  RETURN_INBOUND_PROCESS_LABEL,
  RETURN_INBOUND_QC_POLICY_LABEL,
  escapeHtml,
  formatDateTime,
  RESULT_LABEL,
  RESULT_CLASS,
  DISPOSITION_LABEL,
  DISPOSITION_CLASS,
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

type QcRow = ReturnType<typeof getFilteredQcRows>[number]

function renderTextBadge(label: string, className: string): string {
  return `<span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function renderResultBadge(result: QcDisplayResult): string {
  return renderTextBadge(RESULT_LABEL[result], RESULT_CLASS[result])
}

function renderDispositionBadge(result: QcDisplayResult, disposition?: QcDisposition): string {
  if (result === 'PASS' || !disposition) {
    return '<span class="text-xs text-muted-foreground">—</span>'
  }
  return renderTextBadge(DISPOSITION_LABEL[disposition], DISPOSITION_CLASS[disposition])
}

function renderPolicyBadge(policy: ReturnInboundQcPolicy): string {
  return renderTextBadge(RETURN_INBOUND_QC_POLICY_LABEL[policy], 'border-slate-200 bg-slate-50 text-slate-700')
}

function renderLiabilityBadge(row: QcRow): string {
  const className =
    row.liabilityStatus === 'FACTORY'
      ? 'border-red-200 bg-red-50 text-red-700'
      : row.liabilityStatus === 'NON_FACTORY'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : row.liabilityStatus === 'MIXED'
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : 'border-slate-200 bg-slate-50 text-slate-600'
  return renderTextBadge(row.liabilityStatusLabel, className)
}

function renderFactoryResponseBadge(row: QcRow): string {
  const className =
    row.factoryResponseStatus === 'PENDING_RESPONSE'
      ? 'border-orange-200 bg-orange-50 text-orange-700'
      : row.factoryResponseStatus === 'AUTO_CONFIRMED'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : row.factoryResponseStatus === 'CONFIRMED'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : row.factoryResponseStatus === 'DISPUTED'
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : 'border-slate-200 bg-slate-50 text-slate-600'
  return renderTextBadge(row.factoryResponseStatusLabel, className)
}

function renderDisputeBadge(row: QcRow): string {
  const className =
    row.disputeStatus === 'PENDING_REVIEW' || row.disputeStatus === 'IN_REVIEW'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : row.disputeStatus === 'PARTIALLY_ADJUSTED' || row.disputeStatus === 'REVERSED'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : row.disputeStatus === 'UPHELD'
          ? 'border-red-200 bg-red-50 text-red-700'
          : row.disputeStatus === 'CLOSED'
            ? 'border-slate-200 bg-slate-50 text-slate-600'
            : 'border-slate-200 bg-slate-50 text-slate-600'
  return renderTextBadge(row.disputeStatusLabel, className)
}

function renderSettlementBadge(row: QcRow): string {
  const className =
    row.settlementImpactStatus === 'BLOCKED'
      ? 'border-orange-200 bg-orange-50 text-orange-700'
      : row.settlementImpactStatus === 'ELIGIBLE' || row.settlementImpactStatus === 'INCLUDED_IN_STATEMENT'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : row.settlementImpactStatus === 'SETTLED'
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : row.settlementImpactStatus === 'NEXT_CYCLE_ADJUSTMENT_PENDING'
            ? 'border-violet-200 bg-violet-50 text-violet-700'
            : 'border-slate-200 bg-slate-50 text-slate-600'
  return renderTextBadge(row.settlementImpactStatusLabel, className)
}

function formatDeadlineSummary(deadline?: string, isOverdue?: boolean): string {
  if (!deadline) return '—'
  const timestamp = new Date(deadline.replace(' ', 'T')).getTime()
  if (!Number.isFinite(timestamp)) {
    return formatDateTime(deadline)
  }

  const diff = timestamp - Date.now()
  const abs = Math.abs(diff)
  const day = 24 * 60 * 60 * 1000
  const hour = 60 * 60 * 1000
  const amount = abs >= day ? Math.ceil(abs / day) : Math.ceil(abs / hour)
  const unit = abs >= day ? '天' : '小时'
  const overdue = isOverdue ?? diff < 0
  const summary = overdue ? `已超时 ${amount}${unit}` : `剩余 ${amount}${unit}`
  return `${formatDateTime(deadline)} · ${summary}`
}

function renderViewTabs(tabCounts: Record<PlatformQcWorkbenchViewKey, number>): string {
  const views: PlatformQcWorkbenchViewKey[] = [
    'ALL',
    'WAIT_FACTORY_RESPONSE',
    'AUTO_CONFIRMED',
    'DISPUTING',
    'WAIT_PLATFORM_REVIEW',
    'CLOSED',
  ]

  return `
    <section class="rounded-md border bg-card px-4 py-3">
      <div class="flex flex-wrap gap-2">
        ${views
          .map((view) => {
            const active = listState.activeView === view
            return `
              <button
                class="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm ${
                  active
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-background text-slate-600 hover:bg-muted'
                }"
                data-qcr-action="set-view"
                data-qcr-view="${view}"
              >
                <span>${PLATFORM_QC_WORKBENCH_VIEW_LABEL[view]}</span>
                <span class="rounded bg-background/70 px-1.5 py-0.5 text-xs">${tabCounts[view] ?? 0}</span>
              </button>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderStatCard(params: {
  title: string
  value: number
  tone?: 'default' | 'orange' | 'amber' | 'blue'
  description?: string
}): string {
  const toneClass =
    params.tone === 'orange'
      ? 'text-orange-600'
      : params.tone === 'amber'
        ? 'text-amber-600'
        : params.tone === 'blue'
          ? 'text-blue-600'
          : 'text-foreground'

  return `
    <article class="rounded-md border bg-card px-4 py-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(params.title)}</div>
      <div class="mt-1 text-2xl font-semibold ${toneClass}">${params.value}</div>
      ${
        params.description
          ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(params.description)}</div>`
          : ''
      }
    </article>
  `
}

function renderQuantitySummary(row: QcRow): string {
  return `
    <div class="space-y-1">
      <div class="flex flex-wrap items-center gap-2">
        ${renderPolicyBadge(row.qcPolicy)}
        ${renderResultBadge(row.result)}
      </div>
      <div class="text-xs text-muted-foreground">
        总检 ${row.inspectedQty} · 合格 ${row.qualifiedQty} · 不合格 ${row.unqualifiedQty}
      </div>
    </div>
  `
}

function renderFactoryResponseSummary(row: QcRow): string {
  return `
    <div class="space-y-1">
      ${renderFactoryResponseBadge(row)}
      <div class="text-xs text-muted-foreground">
        ${
          row.factoryResponseStatus === 'PENDING_RESPONSE'
            ? `截止 ${escapeHtml(formatDeadlineSummary(row.responseDeadlineAt, row.isResponseOverdue))}`
            : row.autoConfirmedAt
              ? `自动确认 ${escapeHtml(formatDateTime(row.autoConfirmedAt))}`
              : row.respondedAt
                ? `响应时间 ${escapeHtml(formatDateTime(row.respondedAt))}`
                : '当前无需工厂确认'
        }
      </div>
      ${
        row.responderUserName
          ? `<div class="text-xs text-muted-foreground">响应人：${escapeHtml(row.responderUserName)}</div>`
          : ''
      }
    </div>
  `
}

function renderDisputeSummary(row: QcRow): string {
  return `
    <div class="space-y-1">
      ${renderDisputeBadge(row)}
      <div class="text-xs text-muted-foreground">
        ${
          row.hasDispute
            ? row.canHandleDispute
              ? '平台需进入详情处理异议'
              : QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL[row.disputeStatus]
            : '当前无异议单'
        }
      </div>
    </div>
  `
}

function renderDeductionSummary(row: QcRow): string {
  if (!row.canViewDeduction || !row.basisId) {
    return '<div class="space-y-1"><div class="text-xs text-muted-foreground">未生成扣款依据</div><div class="text-xs text-muted-foreground">冻结加工费与质量扣款均未形成依据</div></div>'
  }

  return `
    <div class="space-y-1">
      <div class="font-mono text-xs font-semibold text-primary">${escapeHtml(row.basisId)}</div>
      <div class="text-xs text-muted-foreground">${escapeHtml(row.deductionBasisStatusLabel)}</div>
      <div class="text-xs text-muted-foreground">
        冻结加工费 ${row.blockedProcessingFeeAmount} CNY · 生效质量扣款 ${row.effectiveQualityDeductionAmount} CNY
      </div>
    </div>
  `
}

function renderSettlementSummary(row: QcRow): string {
  return `
    <div class="space-y-1">
      ${renderSettlementBadge(row)}
      <div class="text-xs text-muted-foreground">${escapeHtml(row.settlementImpactSummary)}</div>
      <div class="text-xs text-muted-foreground">
        ${row.settlementReady ? '已进入可结算口径' : '当前仍影响结算'}
      </div>
    </div>
  `
}

export function renderQcRecordsPage(): string {
  const rows = getFilteredQcRows()
  const stats = getWorkbenchStats()
  const tabCounts = getWorkbenchTabCounts()
  const factoryOptions = getFactoryOptions()
  const warehouseOptions = getWarehouseOptions()
  const inspectorOptions = getInspectorOptions()

  return `
    <div class="flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">质检记录</h1>
          <p class="mt-1 text-sm text-muted-foreground">
            以共享质量事件事实源为底座，统一查看仓库质检、工厂响应、异议处理、扣款依据与结算影响。
          </p>
        </div>
      </div>

      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderStatCard({
          title: '质检记录总数',
          value: stats.totalCount,
          description: `当前视图基数（${listState.showLegacy ? '含旧记录' : '不含旧记录'}）`,
        })}
        ${renderStatCard({
          title: '待工厂响应',
          value: stats.waitFactoryResponseCount,
          tone: 'orange',
          description: `已自动确认 ${stats.autoConfirmedCount} 条`,
        })}
        ${renderStatCard({
          title: '异议中 / 待平台处理',
          value: stats.waitPlatformReviewCount,
          tone: 'amber',
          description: `异议链路共 ${stats.disputingCount} 条`,
        })}
        ${renderStatCard({
          title: '冻结中 / 待结算',
          value: stats.blockedOrReadyCount,
          tone: 'blue',
          description: `冻结 ${stats.blockedCount} 条 · 待结算 ${stats.readyForSettlementCount} 条`,
        })}
      </section>

      ${renderViewTabs(tabCounts)}

      <section class="rounded-md border bg-card p-4">
        <div class="grid gap-3 xl:grid-cols-6">
          <div class="xl:col-span-2">
            <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              data-qcr-filter="keyword"
              value="${toInputValue(listState.keyword)}"
              placeholder="质检单号 / 回货批次号 / 生产单号"
            />
          </div>

          <div>
            <label class="mb-1 block text-xs text-muted-foreground">回货环节</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="processType">
              <option value="ALL" ${listState.filterProcessType === 'ALL' ? 'selected' : ''}>全部</option>
              ${Object.entries(RETURN_INBOUND_PROCESS_LABEL)
                .map(
                  ([key, label]) =>
                    `<option value="${key}" ${listState.filterProcessType === key ? 'selected' : ''}>${label}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div>
            <label class="mb-1 block text-xs text-muted-foreground">回货工厂</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="factory">
              <option value="ALL" ${listState.filterFactory === 'ALL' ? 'selected' : ''}>全部</option>
              ${factoryOptions
                .map(
                  (item) =>
                    `<option value="${escapeHtml(item)}" ${listState.filterFactory === item ? 'selected' : ''}>${escapeHtml(item)}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div>
            <label class="mb-1 block text-xs text-muted-foreground">入仓仓库</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="warehouse">
              <option value="ALL" ${listState.filterWarehouse === 'ALL' ? 'selected' : ''}>全部</option>
              ${warehouseOptions
                .map(
                  (item) =>
                    `<option value="${escapeHtml(item)}" ${listState.filterWarehouse === item ? 'selected' : ''}>${escapeHtml(item)}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div>
            <label class="mb-1 block text-xs text-muted-foreground">质检策略</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="policy">
              <option value="ALL" ${listState.filterPolicy === 'ALL' ? 'selected' : ''}>全部</option>
              ${Object.entries(RETURN_INBOUND_QC_POLICY_LABEL)
                .map(
                  ([key, label]) =>
                    `<option value="${key}" ${listState.filterPolicy === key ? 'selected' : ''}>${label}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div>
            <label class="mb-1 block text-xs text-muted-foreground">质检结果</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="result">
              <option value="ALL" ${listState.filterResult === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="PASS" ${listState.filterResult === 'PASS' ? 'selected' : ''}>合格</option>
              <option value="PARTIAL_PASS" ${listState.filterResult === 'PARTIAL_PASS' ? 'selected' : ''}>部分合格</option>
              <option value="FAIL" ${listState.filterResult === 'FAIL' ? 'selected' : ''}>不合格</option>
            </select>
          </div>

          <div>
            <label class="mb-1 block text-xs text-muted-foreground">责任状态</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="liabilityStatus">
              <option value="ALL" ${listState.filterLiabilityStatus === 'ALL' ? 'selected' : ''}>全部</option>
              ${Object.entries(QUALITY_DEDUCTION_LIABILITY_STATUS_LABEL)
                .map(
                  ([key, label]) =>
                    `<option value="${key}" ${listState.filterLiabilityStatus === key ? 'selected' : ''}>${label}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div>
            <label class="mb-1 block text-xs text-muted-foreground">工厂响应状态</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="factoryResponseStatus">
              <option value="ALL" ${listState.filterFactoryResponseStatus === 'ALL' ? 'selected' : ''}>全部</option>
              ${Object.entries(QUALITY_DEDUCTION_FACTORY_RESPONSE_STATUS_LABEL)
                .map(
                  ([key, label]) =>
                    `<option value="${key}" ${listState.filterFactoryResponseStatus === key ? 'selected' : ''}>${label}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div>
            <label class="mb-1 block text-xs text-muted-foreground">异议状态</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="disputeStatus">
              <option value="ALL" ${listState.filterDisputeStatus === 'ALL' ? 'selected' : ''}>全部</option>
              ${Object.entries(QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL)
                .map(
                  ([key, label]) =>
                    `<option value="${key}" ${listState.filterDisputeStatus === key ? 'selected' : ''}>${label}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div>
            <label class="mb-1 block text-xs text-muted-foreground">结算影响状态</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="settlementImpactStatus">
              <option value="ALL" ${listState.filterSettlementImpactStatus === 'ALL' ? 'selected' : ''}>全部</option>
              ${Object.entries(QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL)
                .map(
                  ([key, label]) =>
                    `<option value="${key}" ${listState.filterSettlementImpactStatus === key ? 'selected' : ''}>${label}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div>
            <label class="mb-1 block text-xs text-muted-foreground">不合格品处置方式</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="disposition">
              <option value="ALL" ${listState.filterDisposition === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="ACCEPT_AS_DEFECT" ${listState.filterDisposition === 'ACCEPT_AS_DEFECT' ? 'selected' : ''}>接受瑕疵品</option>
              <option value="SCRAP" ${listState.filterDisposition === 'SCRAP' ? 'selected' : ''}>报废</option>
              <option value="ACCEPT" ${listState.filterDisposition === 'ACCEPT' ? 'selected' : ''}>接受（不合格品免扣）</option>
            </select>
          </div>

          <div>
            <label class="mb-1 block text-xs text-muted-foreground">质检人</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="inspector">
              <option value="ALL" ${listState.filterInspector === 'ALL' ? 'selected' : ''}>全部</option>
              ${inspectorOptions
                .map(
                  (item) =>
                    `<option value="${escapeHtml(item)}" ${listState.filterInspector === item ? 'selected' : ''}>${escapeHtml(item)}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div class="flex items-end gap-3 xl:col-span-2">
            <label class="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
              <input type="checkbox" data-qcr-filter="showLegacy" ${listState.showLegacy ? 'checked' : ''} />
              显示旧记录
            </label>
            <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-qcr-action="reset-filters">
              <i data-lucide="rotate-ccw" class="mr-1 h-4 w-4"></i>
              重置
            </button>
          </div>
        </div>
      </section>

      ${
        rows.length === 0
          ? `
            <section class="rounded-md border bg-card">
              <div class="py-16 text-center text-sm text-muted-foreground">当前工作台视图下暂无质检记录</div>
            </section>
          `
          : `
            <section class="overflow-x-auto rounded-md border bg-card">
              <table class="w-full min-w-[2200px] text-sm">
                <thead>
                  <tr class="border-b bg-muted/40 text-left">
                    <th class="px-4 py-2 font-medium">质检单号</th>
                    <th class="px-4 py-2 font-medium">回货批次号</th>
                    <th class="px-4 py-2 font-medium">生产单号</th>
                    <th class="px-4 py-2 font-medium">回货环节</th>
                    <th class="px-4 py-2 font-medium">回货工厂 / 入仓仓库</th>
                    <th class="px-4 py-2 font-medium">质检结论</th>
                    <th class="px-4 py-2 font-medium">质检人 / 时间</th>
                    <th class="px-4 py-2 font-medium">责任状态</th>
                    <th class="px-4 py-2 font-medium">不合格品处置方式</th>
                    <th class="px-4 py-2 font-medium">工厂响应</th>
                    <th class="px-4 py-2 font-medium">异议状态</th>
                    <th class="px-4 py-2 font-medium">扣款依据</th>
                    <th class="px-4 py-2 font-medium">结算影响</th>
                    <th class="px-4 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows
                    .map((row) => {
                      const detailHref = buildQcDetailHref(row.qcId)
                      const disputeHref = `${detailHref}?focus=dispute`

                      return `
                        <tr class="border-b last:border-b-0 hover:bg-muted/30">
                          <td class="px-4 py-3 align-top">
                            <button
                              type="button"
                              class="font-mono text-xs font-semibold text-primary hover:underline"
                              data-qcr-action="open-detail"
                              data-qcr-href="${escapeHtml(detailHref)}"
                            >
                              ${escapeHtml(row.qcNo)}
                            </button>
                            ${
                              row.isLegacy
                                ? '<div class="mt-1 inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">旧质检记录</div>'
                                : ''
                            }
                          </td>
                          <td class="px-4 py-3 align-top font-mono text-xs">${escapeHtml(row.batchId || '-')}</td>
                          <td class="px-4 py-3 align-top font-mono text-xs">${escapeHtml(row.productionOrderId || '-')}</td>
                          <td class="px-4 py-3 align-top">${escapeHtml(row.processLabel)}</td>
                          <td class="px-4 py-3 align-top">
                            <div class="space-y-1">
                              <div>${escapeHtml(row.returnFactoryName || '-')}</div>
                              <div class="text-xs text-muted-foreground">${escapeHtml(row.warehouseName || '-')}</div>
                            </div>
                          </td>
                          <td class="px-4 py-3 align-top">${renderQuantitySummary(row)}</td>
                          <td class="px-4 py-3 align-top">
                            <div class="space-y-1">
                              <div>${escapeHtml(row.inspector || '-')}</div>
                              <div class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(row.inspectedAt))}</div>
                            </div>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <div class="space-y-1">
                              ${renderLiabilityBadge(row)}
                              <div class="text-xs text-muted-foreground">工厂责任 ${row.factoryLiabilityQty} · 非工厂责任 ${row.nonFactoryLiabilityQty}</div>
                            </div>
                          </td>
                          <td class="px-4 py-3 align-top">${renderDispositionBadge(row.result, row.disposition as QcDisposition | undefined)}</td>
                          <td class="px-4 py-3 align-top">${renderFactoryResponseSummary(row)}</td>
                          <td class="px-4 py-3 align-top">${renderDisputeSummary(row)}</td>
                          <td class="px-4 py-3 align-top">${renderDeductionSummary(row)}</td>
                          <td class="px-4 py-3 align-top">${renderSettlementSummary(row)}</td>
                          <td class="px-4 py-3 align-top">
                            <div class="flex flex-wrap gap-2">
                              <button
                                type="button"
                                class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted"
                                data-nav="${escapeHtml(detailHref)}"
                              >
                                查看详情
                              </button>
                              ${
                                row.canViewDeduction && row.basisId
                                  ? `
                                    <button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(buildQcDeductionHref(row.qcId))}">
                                      查看扣款
                                    </button>
                                  `
                                  : ''
                              }
                              ${
                                row.canHandleDispute
                                  ? `
                                    <button
                                      type="button"
                                      class="inline-flex h-8 items-center rounded-md border px-2 text-xs text-amber-700 hover:bg-amber-50"
                                      data-nav="${escapeHtml(disputeHref)}"
                                    >
                                      处理异议
                                    </button>
                                  `
                                  : ''
                              }
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')}
                </tbody>
              </table>
            </section>
          `
      }
    </div>
  `
}
