import {
  initialSettlementBatches,
  initialStatementAdjustments,
  initialStatementDrafts,
} from '../data/fcs/store-domain-settlement-seeds'
import type {
  SettlementBatch,
  StatementAdjustment,
  StatementDraft,
} from '../data/fcs/store-domain-settlement-types'
import { escapeHtml, toClassName } from '../utils'

type ActiveTab = 'statements' | 'batches'
type PartyTypeFilter = 'ALL' | 'FACTORY' | 'PROCESSOR' | 'SUPPLIER' | 'GROUP_INTERNAL'

interface HistoryStatementRow {
  statementId: string
  settlementPartyType: string
  settlementPartyId: string
  itemCount: number
  totalQty: number
  totalAmount: number
  adjustmentCount: number
  effectiveAdjustmentAmount: number
  relatedBatchId: string | null
  closedAt: string | null
  accountingSummaryZh: string
}

interface HistoryBatchRow {
  batchId: string
  batchName: string | null
  itemCount: number
  totalAmount: number
  statementCount: number
  settlementPartySummaryZh: string
  completedAt: string | null
}

interface HistoryState {
  activeTab: ActiveTab
  keyword: string
  partyType: PartyTypeFilter
}

const PARTY_TYPE_ZH: Record<string, string> = {
  FACTORY: '工厂',
  PROCESSOR: '加工方',
  SUPPLIER: '供应商',
  GROUP_INTERNAL: '内部主体',
  INTERNAL: '内部主体',
  OTHER: '其他',
}

const state: HistoryState = {
  activeTab: 'statements',
  keyword: '',
  partyType: 'ALL',
}

function partyZh(type: string, id: string): string {
  return `${PARTY_TYPE_ZH[type] ?? type} / ${id}`
}

function getStatementHistoryRows(): HistoryStatementRow[] {
  const closedStatements = initialStatementDrafts.filter(
    (statement) => statement.status === 'CLOSED',
  )

  return closedStatements.map((statement) => {
    const adjustments = initialStatementAdjustments.filter(
      (adjustment) => adjustment.statementId === statement.statementId,
    )
    const adjustmentCount = adjustments.length
    const effectiveAdjustmentAmount = adjustments
      .filter((adjustment) => adjustment.status === 'EFFECTIVE')
      .reduce((sum, adjustment) => {
        return adjustment.adjustmentType === 'REVERSAL'
          ? sum - adjustment.amount
          : sum + adjustment.amount
      }, 0)

    let accountingSummaryZh: string
    if (adjustmentCount === 0) {
      accountingSummaryZh = '无调整'
    } else if (effectiveAdjustmentAmount === 0) {
      accountingSummaryZh = '含调整记录'
    } else if (effectiveAdjustmentAmount > 0) {
      accountingSummaryZh = '含已生效调整'
    } else {
      accountingSummaryZh = '含冲销调整'
    }

    const relatedBatch = initialSettlementBatches.find((batch) =>
      Array.isArray(batch.statementIds) && batch.statementIds.includes(statement.statementId),
    )
    const relatedBatchId = relatedBatch?.batchId ?? null
    const closedAt = statement.updatedAt ?? statement.createdAt ?? null

    return {
      statementId: statement.statementId,
      settlementPartyType: statement.settlementPartyType,
      settlementPartyId: statement.settlementPartyId,
      itemCount: statement.itemCount ?? statement.items?.length ?? 0,
      totalQty: statement.totalQty ?? 0,
      totalAmount: statement.totalAmount ?? 0,
      adjustmentCount,
      effectiveAdjustmentAmount,
      relatedBatchId,
      closedAt,
      accountingSummaryZh,
    }
  })
}

function getBatchHistoryRows(): HistoryBatchRow[] {
  const completedBatches = initialSettlementBatches.filter((batch) => batch.status === 'COMPLETED')
  return completedBatches.map((batch) => {
    const statementCount = Array.isArray(batch.statementIds)
      ? batch.statementIds.length
      : (batch.itemCount ?? 0)

    const items = Array.isArray(batch.items) ? batch.items : []
    const uniqueParties = new Set(items.map((item) => item.settlementPartyId))
    const partyCount = uniqueParties.size
    const settlementPartySummaryZh =
      partyCount <= 1 ? '单一结算对象' : `多结算对象（${partyCount}个）`

    return {
      batchId: batch.batchId,
      batchName: batch.batchName ?? null,
      itemCount: batch.itemCount ?? 0,
      totalAmount: batch.totalAmount ?? 0,
      statementCount,
      settlementPartySummaryZh,
      completedAt: batch.updatedAt ?? batch.createdAt ?? null,
    }
  })
}

function getFilteredStatements(rows: HistoryStatementRow[]): HistoryStatementRow[] {
  const keyword = state.keyword.trim().toLowerCase()
  return rows.filter((row) => {
    const matchParty = state.partyType === 'ALL' || row.settlementPartyType === state.partyType
    const matchKeyword =
      !keyword ||
      [row.statementId, row.settlementPartyId, row.relatedBatchId ?? '']
        .some((value) => value.toLowerCase().includes(keyword))
    return matchParty && matchKeyword
  })
}

function getFilteredBatches(rows: HistoryBatchRow[]): HistoryBatchRow[] {
  const keyword = state.keyword.trim().toLowerCase()
  return rows.filter((row) => {
    if (!keyword) return true
    return [row.batchId, row.batchName ?? ''].some((value) =>
      value.toLowerCase().includes(keyword),
    )
  })
}

function renderStatsCard(label: string, value: string): string {
  return `
    <article class="rounded-lg border bg-card">
      <div class="px-4 pb-4 pt-4">
        <p class="text-sm font-medium text-muted-foreground">${escapeHtml(label)}</p>
        <p class="text-2xl font-bold tabular-nums">${escapeHtml(value)}</p>
      </div>
    </article>
  `
}

export function renderHistoryPage(): string {
  const statementHistory = getStatementHistoryRows()
  const batchHistory = getBatchHistoryRows()
  const filteredStatements = getFilteredStatements(statementHistory)
  const filteredBatches = getFilteredBatches(batchHistory)

  const stats = {
    closedCount: statementHistory.length,
    completedCount: batchHistory.length,
    totalAmount: statementHistory.reduce((sum, row) => sum + row.totalAmount, 0),
    adjustedCount: statementHistory.filter((row) => row.adjustmentCount > 0).length,
  }

  return `
    <div class="flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-foreground">历史对账与核算</h1>
          <p class="mt-0.5 text-sm text-muted-foreground">历史对账与核算用于回看已关闭对账单与已完成结算批次；原型阶段仅做历史汇总展示，不包含真实财务核算</p>
        </div>
      </div>

      <section class="grid grid-cols-2 gap-4 md:grid-cols-4">
        ${renderStatsCard('已关闭对账单数', String(stats.closedCount))}
        ${renderStatsCard('已完成结算批次数', String(stats.completedCount))}
        ${renderStatsCard(
          '历史金额合计',
          stats.totalAmount.toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
        )}
        ${renderStatsCard('含调整历史单数', String(stats.adjustedCount))}
      </section>

      <section class="flex flex-wrap gap-3">
        <input
          class="h-9 w-64 rounded-md border bg-background px-3 text-sm"
          placeholder="搜索对账单号/批次号/结算对象ID"
          data-his-filter="keyword"
          value="${escapeHtml(state.keyword)}"
        />
        <select class="h-9 w-44 rounded-md border bg-background px-3 text-sm" data-his-filter="partyType">
          <option value="ALL" ${state.partyType === 'ALL' ? 'selected' : ''}>全部</option>
          <option value="FACTORY" ${state.partyType === 'FACTORY' ? 'selected' : ''}>工厂</option>
          <option value="PROCESSOR" ${state.partyType === 'PROCESSOR' ? 'selected' : ''}>加工方</option>
          <option value="SUPPLIER" ${state.partyType === 'SUPPLIER' ? 'selected' : ''}>供应商</option>
          <option value="GROUP_INTERNAL" ${state.partyType === 'GROUP_INTERNAL' ? 'selected' : ''}>内部主体</option>
        </select>
      </section>

      <section>
        <div class="inline-flex rounded-md bg-muted p-1">
          <button
            class="${toClassName(
              'inline-flex items-center rounded-md px-3 py-1.5 text-sm transition-colors',
              state.activeTab === 'statements'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}"
            data-his-tab="statements"
          >
            对账单历史
            <span class="ml-2 inline-flex rounded-md border bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
              ${filteredStatements.length}
            </span>
          </button>
          <button
            class="${toClassName(
              'inline-flex items-center rounded-md px-3 py-1.5 text-sm transition-colors',
              state.activeTab === 'batches'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}"
            data-his-tab="batches"
          >
            结算批次历史
            <span class="ml-2 inline-flex rounded-md border bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
              ${filteredBatches.length}
            </span>
          </button>
        </div>
      </section>

      ${
        state.activeTab === 'statements'
          ? `
            <section class="overflow-x-auto rounded-md border">
              <table class="w-full min-w-[1480px] text-sm">
                <thead>
                  <tr class="border-b bg-muted/40 text-left">
                    <th class="px-4 py-2 font-medium">对账单号</th>
                    <th class="px-4 py-2 font-medium">结算对象</th>
                    <th class="px-4 py-2 text-center font-medium">条目数</th>
                    <th class="px-4 py-2 text-center font-medium">扣款总数量</th>
                    <th class="px-4 py-2 font-medium">最终金额</th>
                    <th class="px-4 py-2 text-center font-medium">调整项数</th>
                    <th class="px-4 py-2 font-medium">核算情况</th>
                    <th class="px-4 py-2 font-medium">关联批次</th>
                    <th class="px-4 py-2 font-medium">关闭时间</th>
                    <th class="px-4 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    filteredStatements.length === 0
                      ? `
                        <tr>
                          <td colspan="10" class="py-10 text-center text-sm text-muted-foreground">
                            暂无对账单历史数据
                          </td>
                        </tr>
                      `
                      : filteredStatements
                          .map(
                            (row) => `
                              <tr class="border-b last:border-b-0">
                                <td class="px-4 py-3 font-mono text-xs">${escapeHtml(row.statementId)}</td>
                                <td class="px-4 py-3 text-sm">${escapeHtml(
                                  partyZh(row.settlementPartyType, row.settlementPartyId),
                                )}</td>
                                <td class="px-4 py-3 text-center">${row.itemCount}</td>
                                <td class="px-4 py-3 text-center">${row.totalQty}</td>
                                <td class="px-4 py-3 font-medium">${row.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td class="px-4 py-3 text-center">
                                  ${
                                    row.adjustmentCount > 0
                                      ? `<span class="inline-flex rounded-md border bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">${row.adjustmentCount}</span>`
                                      : '<span class="text-muted-foreground">0</span>'
                                  }
                                </td>
                                <td class="px-4 py-3 text-sm">${escapeHtml(row.accountingSummaryZh)}</td>
                                <td class="px-4 py-3 font-mono text-xs">
                                  ${
                                    row.relatedBatchId
                                      ? escapeHtml(row.relatedBatchId)
                                      : '<span class="text-muted-foreground">—</span>'
                                  }
                                </td>
                                <td class="px-4 py-3 text-xs text-muted-foreground">
                                  ${
                                    row.closedAt
                                      ? escapeHtml(row.closedAt)
                                      : '<span>—</span>'
                                  }
                                </td>
                                <td class="px-4 py-3">
                                  <div class="flex flex-wrap gap-1">
                                    <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-nav="/fcs/settlement/statements">查看对账单</button>
                                    ${
                                      row.relatedBatchId
                                        ? '<button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/settlement/batches">查看批次</button>'
                                        : '<span class="px-2 py-1 text-xs text-muted-foreground">—</span>'
                                    }
                                  </div>
                                </td>
                              </tr>
                            `,
                          )
                          .join('')
                  }
                </tbody>
              </table>
            </section>
          `
          : `
            <section class="overflow-x-auto rounded-md border">
              <table class="w-full min-w-[1120px] text-sm">
                <thead>
                  <tr class="border-b bg-muted/40 text-left">
                    <th class="px-4 py-2 font-medium">批次号</th>
                    <th class="px-4 py-2 font-medium">批次名称</th>
                    <th class="px-4 py-2 text-center font-medium">对账单数</th>
                    <th class="px-4 py-2 font-medium">总金额</th>
                    <th class="px-4 py-2 font-medium">结算对象说明</th>
                    <th class="px-4 py-2 font-medium">完成时间</th>
                    <th class="px-4 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    filteredBatches.length === 0
                      ? `
                        <tr>
                          <td colspan="7" class="py-10 text-center text-sm text-muted-foreground">
                            暂无结算批次历史数据
                          </td>
                        </tr>
                      `
                      : filteredBatches
                          .map(
                            (row) => `
                              <tr class="border-b last:border-b-0">
                                <td class="px-4 py-3 font-mono text-xs">${escapeHtml(row.batchId)}</td>
                                <td class="px-4 py-3 text-sm">${
                                  row.batchName
                                    ? escapeHtml(row.batchName)
                                    : '<span class="text-muted-foreground">—</span>'
                                }</td>
                                <td class="px-4 py-3 text-center">${row.statementCount}</td>
                                <td class="px-4 py-3 font-medium">${row.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td class="px-4 py-3 text-sm">${escapeHtml(row.settlementPartySummaryZh)}</td>
                                <td class="px-4 py-3 text-xs text-muted-foreground">${
                                  row.completedAt
                                    ? escapeHtml(row.completedAt)
                                    : '<span>—</span>'
                                }</td>
                                <td class="px-4 py-3">
                                  <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-nav="/fcs/settlement/batches">查看批次</button>
                                </td>
                              </tr>
                            `,
                          )
                          .join('')
                  }
                </tbody>
              </table>
            </section>
          `
      }
    </div>
  `
}

export function handleHistoryEvent(target: HTMLElement): boolean {
  const tabNode = target.closest<HTMLElement>('[data-his-tab]')
  if (tabNode) {
    const tab = tabNode.dataset.hisTab as ActiveTab | undefined
    if (tab === 'statements' || tab === 'batches') {
      state.activeTab = tab
      return true
    }
  }

  const filterNode = target.closest<HTMLElement>('[data-his-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const field = filterNode.dataset.hisFilter
    if (field === 'keyword') {
      state.keyword = filterNode.value
      return true
    }
    if (field === 'partyType') {
      state.partyType = filterNode.value as PartyTypeFilter
      return true
    }
    return true
  }

  return false
}

export function isHistoryDialogOpen(): boolean {
  return false
}
