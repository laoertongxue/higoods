import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { initialDeductionBasisItems } from '../data/fcs/store-domain-quality-seeds'
import type { DeductionBasisItem } from '../data/fcs/store-domain-quality-types'
import { escapeHtml } from '../utils'

applyQualitySeedBootstrap()

type SourceFilter = 'ALL' | 'DYE_PRINT' | 'QC_FAIL' | 'HANDOVER_DIFF' | 'OTHER'
type SettleFilter = 'ALL' | 'READY' | 'FROZEN'
type StatusFilter = 'ALL' | 'DRAFT' | 'CONFIRMED' | 'DISPUTED' | 'VOID'
type PartyFilter = 'ALL' | 'FACTORY' | 'PROCESSOR' | 'SUPPLIER' | 'GROUP_INTERNAL'
type ActiveTab = 'detail' | 'summary'

interface PenaltyOutputState {
  activeTab: ActiveTab
  keyword: string
  sourceFilter: SourceFilter
  settleFilter: SettleFilter
  statusFilter: StatusFilter
  partyFilter: PartyFilter
}

interface SummaryRow {
  label: string
  count: number
  totalQty: number
  totalAmount: number
  readyCount: number
  frozenCount: number
}

const BASIS_STATUS_ZH: Record<string, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  DISPUTED: '争议中',
  VOID: '已作废',
}

const SETTLEMENT_PARTY_TYPE_ZH: Record<string, string> = {
  FACTORY: '工厂',
  PROCESSOR: '加工方',
  SUPPLIER: '供应商',
  GROUP_INTERNAL: '内部主体',
  INTERNAL: '内部主体',
  OTHER: '其他',
}

const state: PenaltyOutputState = {
  activeTab: 'detail',
  keyword: '',
  sourceFilter: 'ALL',
  settleFilter: 'ALL',
  statusFilter: 'ALL',
  partyFilter: 'ALL',
}

function getDeductionAmount(item: DeductionBasisItem): number {
  const value = (item as DeductionBasisItem & { deductionAmount?: number }).deductionAmount
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function sourceLabelOf(item: DeductionBasisItem): string {
  if (item.sourceProcessType === 'DYE_PRINT') return '染印加工单'
  if (item.sourceType === 'QC_FAIL' || item.sourceType === 'QC_DEFECT_ACCEPT') return '质检不合格'
  if (item.sourceType === 'HANDOVER_DIFF') return '交接差异'
  return '其他'
}

function sourceKey(item: DeductionBasisItem): SourceFilter {
  if (item.sourceProcessType === 'DYE_PRINT') return 'DYE_PRINT'
  if (item.sourceType === 'QC_FAIL' || item.sourceType === 'QC_DEFECT_ACCEPT') return 'QC_FAIL'
  if (item.sourceType === 'HANDOVER_DIFF') return 'HANDOVER_DIFF'
  return 'OTHER'
}

function sourceObjectOf(item: DeductionBasisItem): string {
  if (item.sourceProcessType === 'DYE_PRINT' && item.sourceOrderId) return item.sourceOrderId
  const qcId = item.sourceRefId || item.sourceId
  if (qcId) return qcId
  return '—'
}

function qcIdOf(item: DeductionBasisItem): string | undefined {
  if (item.sourceProcessType === 'DYE_PRINT') return undefined
  return item.sourceRefId || item.sourceId || item.deepLinks?.qcHref?.split('/').pop()
}

function settlementPartyLabel(item: DeductionBasisItem): string {
  if (!item.settlementPartyType) return '—'
  const typeZh = SETTLEMENT_PARTY_TYPE_ZH[item.settlementPartyType] ?? item.settlementPartyType
  return item.settlementPartyId ? `${typeZh} / ${item.settlementPartyId}` : typeZh
}

function getStatusClass(status: string): string {
  if (status === 'CONFIRMED') return 'bg-green-100 text-green-700 border-green-200'
  if (status === 'DISPUTED') return 'bg-red-100 text-red-700 border-red-200'
  if (status === 'VOID') return 'bg-slate-100 text-slate-500 border-slate-200'
  return 'bg-muted text-muted-foreground border'
}

function getResultItems(): DeductionBasisItem[] {
  return initialDeductionBasisItems.filter((item) => {
    const qty = item.deductionQty ?? item.qty ?? 0
    const amount = getDeductionAmount(item)
    return qty > 0 || amount !== 0
  })
}

function getFilteredItems(items: DeductionBasisItem[]): DeductionBasisItem[] {
  const keyword = state.keyword.trim().toLowerCase()

  return items.filter((item) => {
    if (keyword) {
      const haystack = [
        item.basisId,
        item.productionOrderId,
        item.sourceOrderId,
        item.settlementPartyId,
        item.processorFactoryId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(keyword)) return false
    }

    if (state.sourceFilter !== 'ALL' && sourceKey(item) !== state.sourceFilter) return false
    if (state.settleFilter === 'READY' && item.settlementReady !== true) return false
    if (state.settleFilter === 'FROZEN' && item.settlementReady === true) return false
    if (state.statusFilter !== 'ALL' && item.status !== state.statusFilter) return false
    if (state.partyFilter !== 'ALL' && item.settlementPartyType !== state.partyFilter) return false

    return true
  })
}

function getSummaryRows(items: DeductionBasisItem[]): SummaryRow[] {
  const map = new Map<string, SummaryRow>()

  for (const item of items) {
    const key = `${item.settlementPartyType ?? ''}|${item.settlementPartyId ?? ''}`
    const label = settlementPartyLabel(item)
    const current = map.get(key) ?? {
      label,
      count: 0,
      totalQty: 0,
      totalAmount: 0,
      readyCount: 0,
      frozenCount: 0,
    }

    map.set(key, {
      label,
      count: current.count + 1,
      totalQty: current.totalQty + (item.deductionQty ?? item.qty ?? 0),
      totalAmount: current.totalAmount + getDeductionAmount(item),
      readyCount: current.readyCount + (item.settlementReady === true ? 1 : 0),
      frozenCount: current.frozenCount + (item.settlementReady !== true ? 1 : 0),
    })
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

function hasFilterApplied(): boolean {
  return (
    state.keyword.trim().length > 0 ||
    state.sourceFilter !== 'ALL' ||
    state.settleFilter !== 'ALL' ||
    state.statusFilter !== 'ALL' ||
    state.partyFilter !== 'ALL'
  )
}

function resetFilters(): void {
  state.keyword = ''
  state.sourceFilter = 'ALL'
  state.settleFilter = 'ALL'
  state.statusFilter = 'ALL'
  state.partyFilter = 'ALL'
}

export function renderPenaltyOutputPage(): string {
  const resultItems = getResultItems()
  const filtered = getFilteredItems(resultItems)
  const summaryRows = getSummaryRows(filtered)

  const stats = {
    count: filtered.length,
    ready: filtered.filter((item) => item.settlementReady === true).length,
    frozen: filtered.filter((item) => item.settlementReady !== true).length,
    amount: filtered.reduce((sum, item) => sum + getDeductionAmount(item), 0),
  }

  return `
    <div class="flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold">扣款结果输出</h1>
          <p class="mt-0.5 text-sm text-muted-foreground">基于扣款依据的结果汇总与筛选视图</p>
        </div>
        <span class="text-sm text-muted-foreground">共 ${filtered.length} 条</span>
      </div>

      <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <article class="rounded-lg border bg-card">
          <div class="pb-4 pl-4 pr-4 pt-5">
            <p class="mb-1 text-xs text-muted-foreground">结果条数</p>
            <p class="text-2xl font-semibold leading-none tabular-nums">${stats.count}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="pb-4 pl-4 pr-4 pt-5">
            <p class="mb-1 text-xs text-muted-foreground">可进入结算数</p>
            <p class="text-2xl font-semibold leading-none tabular-nums">${stats.ready}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="pb-4 pl-4 pr-4 pt-5">
            <p class="mb-1 text-xs text-muted-foreground">冻结中数</p>
            <p class="text-2xl font-semibold leading-none tabular-nums">${stats.frozen}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="pb-4 pl-4 pr-4 pt-5">
            <p class="mb-1 text-xs text-muted-foreground">扣款总金额</p>
            <p class="text-2xl font-semibold leading-none tabular-nums">${stats.amount.toFixed(2)}</p>
            <p class="mt-1 text-xs text-muted-foreground">（无金额按 0 计）</p>
          </div>
        </article>
      </section>

      <section class="rounded-lg border bg-card">
        <div class="flex flex-wrap items-end gap-2 pb-4 pl-4 pr-4 pt-4">
          <div class="relative min-w-[180px] flex-1">
            <i data-lucide="search" class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"></i>
            <input
              class="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm"
              data-pout-filter="keyword"
              placeholder="搜索依据ID / 生产单 / 结算对象..."
              value="${escapeHtml(state.keyword)}"
            />
          </div>

          <select class="h-9 w-[130px] rounded-md border bg-background px-3 text-sm" data-pout-filter="source">
            <option value="ALL" ${state.sourceFilter === 'ALL' ? 'selected' : ''}>全部来源</option>
            <option value="DYE_PRINT" ${state.sourceFilter === 'DYE_PRINT' ? 'selected' : ''}>染印加工单</option>
            <option value="QC_FAIL" ${state.sourceFilter === 'QC_FAIL' ? 'selected' : ''}>质检不合格</option>
            <option value="HANDOVER_DIFF" ${state.sourceFilter === 'HANDOVER_DIFF' ? 'selected' : ''}>交接差异</option>
            <option value="OTHER" ${state.sourceFilter === 'OTHER' ? 'selected' : ''}>其他</option>
          </select>

          <select class="h-9 w-[130px] rounded-md border bg-background px-3 text-sm" data-pout-filter="settle">
            <option value="ALL" ${state.settleFilter === 'ALL' ? 'selected' : ''}>全部结算状态</option>
            <option value="READY" ${state.settleFilter === 'READY' ? 'selected' : ''}>可进入结算</option>
            <option value="FROZEN" ${state.settleFilter === 'FROZEN' ? 'selected' : ''}>冻结中</option>
          </select>

          <select class="h-9 w-[120px] rounded-md border bg-background px-3 text-sm" data-pout-filter="status">
            <option value="ALL" ${state.statusFilter === 'ALL' ? 'selected' : ''}>全部状态</option>
            <option value="DRAFT" ${state.statusFilter === 'DRAFT' ? 'selected' : ''}>草稿</option>
            <option value="CONFIRMED" ${state.statusFilter === 'CONFIRMED' ? 'selected' : ''}>已确认</option>
            <option value="DISPUTED" ${state.statusFilter === 'DISPUTED' ? 'selected' : ''}>争议中</option>
            <option value="VOID" ${state.statusFilter === 'VOID' ? 'selected' : ''}>已作废</option>
          </select>

          <select class="h-9 w-[120px] rounded-md border bg-background px-3 text-sm" data-pout-filter="party">
            <option value="ALL" ${state.partyFilter === 'ALL' ? 'selected' : ''}>全部类型</option>
            <option value="FACTORY" ${state.partyFilter === 'FACTORY' ? 'selected' : ''}>工厂</option>
            <option value="PROCESSOR" ${state.partyFilter === 'PROCESSOR' ? 'selected' : ''}>加工方</option>
            <option value="SUPPLIER" ${state.partyFilter === 'SUPPLIER' ? 'selected' : ''}>供应商</option>
            <option value="GROUP_INTERNAL" ${state.partyFilter === 'GROUP_INTERNAL' ? 'selected' : ''}>内部主体</option>
          </select>

          ${
            hasFilterApplied()
              ? `
                <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-pout-action="reset-filters">
                  <i data-lucide="rotate-ccw" class="mr-1 h-3.5 w-3.5"></i>
                  重置
                </button>
              `
              : ''
          }
        </div>
      </section>

      <section>
        <div class="inline-flex rounded-md bg-muted p-1">
          <button
            class="${
              state.activeTab === 'detail'
                ? 'rounded-md bg-background px-3 py-1.5 text-sm shadow-sm'
                : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
            }"
            data-pout-tab="detail"
          >
            明细视图
          </button>
          <button
            class="${
              state.activeTab === 'summary'
                ? 'rounded-md bg-background px-3 py-1.5 text-sm shadow-sm'
                : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
            }"
            data-pout-tab="summary"
          >
            结算对象汇总
          </button>
        </div>
      </section>

      ${
        state.activeTab === 'detail'
          ? `
            ${
              filtered.length === 0
                ? `
                  <section class="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    暂无扣款结果
                  </section>
                `
                : `
                  <section class="overflow-x-auto rounded-md border">
                    <table class="w-full min-w-[1480px] text-sm">
                      <thead>
                        <tr class="border-b bg-muted/40 text-left">
                          <th class="whitespace-nowrap px-4 py-2 font-medium">扣款依据ID</th>
                          <th class="whitespace-nowrap px-4 py-2 font-medium">来源流程</th>
                          <th class="whitespace-nowrap px-4 py-2 font-medium">来源对象</th>
                          <th class="whitespace-nowrap px-4 py-2 font-medium">生产单</th>
                          <th class="whitespace-nowrap px-4 py-2 font-medium">结算对象</th>
                          <th class="whitespace-nowrap px-4 py-2 text-right font-medium">扣款数量</th>
                          <th class="whitespace-nowrap px-4 py-2 text-right font-medium">扣款金额</th>
                          <th class="whitespace-nowrap px-4 py-2 font-medium">依据状态</th>
                          <th class="whitespace-nowrap px-4 py-2 font-medium">结算状态</th>
                          <th class="whitespace-nowrap px-4 py-2 font-medium">冻结原因</th>
                          <th class="whitespace-nowrap px-4 py-2 font-medium">更新时间</th>
                          <th class="whitespace-nowrap px-4 py-2 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${filtered
                          .map((item) => {
                            const qcId = qcIdOf(item)
                            const isDyePrint = item.sourceProcessType === 'DYE_PRINT' && !!item.sourceOrderId
                            return `
                              <tr class="border-b last:border-b-0">
                                <td class="whitespace-nowrap px-4 py-3 font-mono text-xs">${escapeHtml(item.basisId)}</td>
                                <td class="whitespace-nowrap px-4 py-3">${escapeHtml(sourceLabelOf(item))}</td>
                                <td class="whitespace-nowrap px-4 py-3 font-mono text-xs">${escapeHtml(sourceObjectOf(item))}</td>
                                <td class="whitespace-nowrap px-4 py-3 font-mono text-xs">${escapeHtml(item.productionOrderId)}</td>
                                <td class="whitespace-nowrap px-4 py-3 text-sm">${escapeHtml(settlementPartyLabel(item))}</td>
                                <td class="px-4 py-3 text-right tabular-nums">${item.deductionQty ?? item.qty ?? 0}</td>
                                <td class="px-4 py-3 text-right tabular-nums">${getDeductionAmount(item).toFixed(2)}</td>
                                <td class="px-4 py-3">
                                  <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${getStatusClass(item.status)}">${escapeHtml(BASIS_STATUS_ZH[item.status] ?? item.status)}</span>
                                </td>
                                <td class="px-4 py-3">
                                  ${
                                    item.settlementReady === true
                                      ? '<span class="inline-flex rounded-md border border-green-200 bg-green-100 px-2 py-0.5 text-xs text-green-700">可进入结算</span>'
                                      : '<span class="inline-flex rounded-md border bg-muted px-2 py-0.5 text-xs text-muted-foreground">冻结中</span>'
                                  }
                                </td>
                                <td class="max-w-[120px] truncate px-4 py-3 text-xs text-muted-foreground" title="${escapeHtml(item.settlementFreezeReason ?? '')}">
                                  ${escapeHtml(item.settlementFreezeReason ?? '—')}
                                </td>
                                <td class="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.updatedAt ?? item.createdAt)}</td>
                                <td class="px-4 py-3">
                                  <div class="flex items-center gap-1">
                                    <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/quality/deduction-calc/${escapeHtml(item.basisId)}">查看依据</button>
                                    ${
                                      qcId
                                        ? `<button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/quality/qc-records/${escapeHtml(qcId)}">查看质检</button>`
                                        : '<span class="px-2 text-xs text-muted-foreground">—</span>'
                                    }
                                    ${
                                      isDyePrint
                                        ? '<button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/process/dye-print-orders">查看加工单</button>'
                                        : '<span class="px-2 text-xs text-muted-foreground">—</span>'
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
          `
          : `
            ${
              summaryRows.length === 0
                ? `
                  <section class="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    暂无汇总结果
                  </section>
                `
                : `
                  <section class="overflow-x-auto rounded-md border">
                    <table class="w-full min-w-[900px] text-sm">
                      <thead>
                        <tr class="border-b bg-muted/40 text-left">
                          <th class="px-4 py-2 font-medium">结算对象</th>
                          <th class="px-4 py-2 text-right font-medium">条目数</th>
                          <th class="px-4 py-2 text-right font-medium">扣款总数量</th>
                          <th class="px-4 py-2 text-right font-medium">扣款总金额</th>
                          <th class="px-4 py-2 text-right font-medium">可进入结算条数</th>
                          <th class="px-4 py-2 text-right font-medium">冻结中条数</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${summaryRows
                          .map(
                            (row) => `
                              <tr class="border-b last:border-b-0">
                                <td class="px-4 py-3 font-medium">${escapeHtml(row.label)}</td>
                                <td class="px-4 py-3 text-right tabular-nums">${row.count}</td>
                                <td class="px-4 py-3 text-right tabular-nums">${row.totalQty}</td>
                                <td class="px-4 py-3 text-right tabular-nums">${row.totalAmount.toFixed(2)}</td>
                                <td class="px-4 py-3 text-right tabular-nums">${row.readyCount}</td>
                                <td class="px-4 py-3 text-right tabular-nums">${row.frozenCount}</td>
                              </tr>
                            `,
                          )
                          .join('')}
                      </tbody>
                    </table>
                  </section>
                `
            }
          `
      }
    </div>
  `
}

export function handlePenaltyOutputEvent(target: HTMLElement): boolean {
  const tabNode = target.closest<HTMLElement>('[data-pout-tab]')
  if (tabNode) {
    const next = tabNode.dataset.poutTab
    if (next === 'detail' || next === 'summary') {
      state.activeTab = next
    }
    return true
  }

  const filterNode = target.closest<HTMLElement>('[data-pout-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const field = filterNode.dataset.poutFilter
    if (field === 'keyword') {
      state.keyword = filterNode.value
      return true
    }
    if (field === 'source') {
      state.sourceFilter = filterNode.value as SourceFilter
      return true
    }
    if (field === 'settle') {
      state.settleFilter = filterNode.value as SettleFilter
      return true
    }
    if (field === 'status') {
      state.statusFilter = filterNode.value as StatusFilter
      return true
    }
    if (field === 'party') {
      state.partyFilter = filterNode.value as PartyFilter
      return true
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pout-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.poutAction
  if (!action) return false

  if (action === 'reset-filters') {
    resetFilters()
    return true
  }

  return true
}

export function isPenaltyOutputDialogOpen(): boolean {
  return false
}
