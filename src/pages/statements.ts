import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { initialDeductionBasisItems } from '../data/fcs/store-domain-quality-seeds'
import { buildDeductionEntryHrefByBasisId } from '../data/fcs/quality-chain-adapter'
import { initialStatementDrafts } from '../data/fcs/store-domain-settlement-seeds'
import type {
  StatementDraft,
  StatementDraftItem,
  StatementStatus,
} from '../data/fcs/store-domain-settlement-types'
import type {
  DeductionBasisItem,
  SettlementPartyType,
} from '../data/fcs/store-domain-quality-types'
import { escapeHtml } from '../utils'

applyQualitySeedBootstrap()

type SourceFilter = '__ALL__' | 'DYE_PRINT' | 'QC_FAIL' | 'HANDOVER_DIFF' | 'OTHER'
type StatusBadgeClass = Record<StatementStatus, string>

interface StatementsState {
  keyword: string
  filterParty: string
  filterSource: SourceFilter
  selected: Set<string>
  remark: string
  detailStatementId: string | null
}

const SOURCE_TYPE_ZH: Record<string, string> = {
  QC_FAIL: '质检不合格',
  HANDOVER_DIFF: '交接差异',
  DYE_PRINT: '染印加工单',
}

const PARTY_TYPE_ZH: Record<string, string> = {
  FACTORY: '工厂',
  PROCESSOR: '加工方',
  SUPPLIER: '供应商',
  GROUP_INTERNAL: '内部主体',
  INTERNAL: '内部主体',
  OTHER: '其他',
}

const STATUS_ZH: Record<StatementStatus, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  CLOSED: '已关闭',
}

const STATUS_BADGE_CLASS: StatusBadgeClass = {
  DRAFT: 'border bg-muted text-muted-foreground',
  CONFIRMED: 'border border-blue-200 bg-blue-50 text-blue-700',
  CLOSED: 'border border-slate-200 bg-slate-50 text-slate-600',
}

const state: StatementsState = {
  keyword: '',
  filterParty: '__ALL__',
  filterSource: '__ALL__',
  selected: new Set<string>(),
  remark: '',
  detailStatementId: null,
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function randomSuffix(length = 4): string {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase()
}

function showStatementsToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'statements-toast-root'
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

function sourceLabel(item: DeductionBasisItem | StatementDraftItem): string {
  if (item.sourceProcessType === 'DYE_PRINT') return '染印加工单'
  if (item.sourceType) return SOURCE_TYPE_ZH[item.sourceType] ?? item.sourceType
  return '其他'
}

function sourceKey(item: DeductionBasisItem): SourceFilter {
  if (item.sourceProcessType === 'DYE_PRINT') return 'DYE_PRINT'
  if (item.sourceType === 'QC_FAIL' || item.sourceType === 'QC_DEFECT_ACCEPT') return 'QC_FAIL'
  if (item.sourceType === 'HANDOVER_DIFF') return 'HANDOVER_DIFF'
  return 'OTHER'
}

function partyLabel(type?: string, id?: string): string {
  if (!type || !id) return '-'
  return `${PARTY_TYPE_ZH[type] ?? type} / ${id}`
}

function getDeductionAmount(item: DeductionBasisItem): number {
  const value = (item as DeductionBasisItem & { deductionAmount?: number }).deductionAmount
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function getOccupiedBasisIds(): Set<string> {
  return new Set(
    initialStatementDrafts
      .filter((statement) => statement.status !== 'CLOSED')
      .flatMap((statement) => statement.itemBasisIds),
  )
}

function getCandidateItems(): DeductionBasisItem[] {
  const occupiedIds = getOccupiedBasisIds()
  return initialDeductionBasisItems.filter((item) => {
    const qty = item.deductionQty ?? item.qty ?? 0
    return (
      item.settlementReady === true &&
      item.status !== 'VOID' &&
      qty > 0 &&
      !occupiedIds.has(item.basisId)
    )
  })
}

function getPartyOptions(candidates: DeductionBasisItem[]): Array<{ key: string; type: string; id: string }> {
  const map = new Map<string, { type: string; id: string }>()
  for (const item of candidates) {
    if (!item.settlementPartyType || !item.settlementPartyId) continue
    const key = `${item.settlementPartyType}|${item.settlementPartyId}`
    map.set(key, { type: item.settlementPartyType, id: item.settlementPartyId })
  }
  return Array.from(map.entries()).map(([key, value]) => ({ key, type: value.type, id: value.id }))
}

function getFilteredCandidates(candidates: DeductionBasisItem[]): DeductionBasisItem[] {
  const keyword = state.keyword.trim().toLowerCase()

  return candidates.filter((item) => {
    if (state.filterParty !== '__ALL__') {
      const [type, id] = state.filterParty.split('|')
      if (item.settlementPartyType !== type || item.settlementPartyId !== id) return false
    }

    if (state.filterSource !== '__ALL__' && sourceKey(item) !== state.filterSource) return false

    if (keyword) {
      const haystack = [
        item.basisId,
        item.productionOrderId,
        item.sourceOrderId,
        item.settlementPartyId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(keyword)) return false
    }

    return true
  })
}

function getSelectedBases(filtered: DeductionBasisItem[]): DeductionBasisItem[] {
  return filtered.filter((item) => state.selected.has(item.basisId))
}

function generateStatementDraft(
  input: {
    settlementPartyType: SettlementPartyType
    settlementPartyId: string
    basisIds: string[]
    remark?: string
  },
  by: string,
): { ok: boolean; statementId?: string; message?: string } {
  const { settlementPartyType, settlementPartyId, basisIds, remark } = input
  if (!basisIds.length) return { ok: false, message: '请先选择至少一条扣款依据' }

  for (const basisId of basisIds) {
    const basis = initialDeductionBasisItems.find((item) => item.basisId === basisId)
    if (!basis) return { ok: false, message: `扣款依据 ${basisId} 不存在` }
    if (!basis.settlementReady) {
      return { ok: false, message: `扣款依据 ${basisId} 未满足可进入结算条件` }
    }
    if (basis.status === 'VOID') {
      return { ok: false, message: `扣款依据 ${basisId} 已作废，不可纳入对账单` }
    }
    if (
      basis.settlementPartyType !== settlementPartyType ||
      basis.settlementPartyId !== settlementPartyId
    ) {
      return { ok: false, message: `扣款依据 ${basisId} 的结算对象与选定对象不一致` }
    }
  }

  const occupiedIds = getOccupiedBasisIds()
  if (basisIds.some((basisId) => occupiedIds.has(basisId))) {
    return { ok: false, message: '存在已纳入未关闭对账单的扣款依据' }
  }

  const timestamp = nowTimestamp()
  const month = timestamp.slice(0, 7).replace('-', '')
  let statementId = `ST-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
  while (initialStatementDrafts.some((item) => item.statementId === statementId)) {
    statementId = `ST-${month}-${randomSuffix(4)}`
  }

  const items: StatementDraftItem[] = basisIds.map((basisId) => {
    const basis = initialDeductionBasisItems.find((item) => item.basisId === basisId)!
    return {
      basisId,
      deductionQty: basis.deductionQty ?? basis.qty ?? 0,
      deductionAmount: getDeductionAmount(basis),
      sourceProcessType: basis.sourceProcessType,
      sourceType: basis.sourceType,
      productionOrderId: basis.productionOrderId,
      sourceOrderId: basis.sourceOrderId,
    }
  })

  const draft: StatementDraft = {
    statementId,
    settlementPartyType,
    settlementPartyId,
    itemCount: items.length,
    totalQty: items.reduce((sum, item) => sum + item.deductionQty, 0),
    totalAmount: items.reduce((sum, item) => sum + item.deductionAmount, 0),
    status: 'DRAFT',
    itemBasisIds: basisIds,
    items,
    remark,
    createdAt: timestamp,
    createdBy: by,
  }

  initialStatementDrafts.push(draft)
  return { ok: true, statementId }
}

function confirmStatementDraft(statementId: string, by: string): { ok: boolean; message?: string } {
  const draft = initialStatementDrafts.find((item) => item.statementId === statementId)
  if (!draft) return { ok: false, message: `对账单 ${statementId} 不存在` }
  if (draft.status === 'CONFIRMED') return { ok: true }
  if (draft.status === 'CLOSED') return { ok: false, message: '已关闭的对账单不可确认' }

  draft.status = 'CONFIRMED'
  draft.updatedAt = nowTimestamp()
  draft.updatedBy = by
  return { ok: true }
}

function closeStatementDraft(statementId: string, by: string): { ok: boolean; message?: string } {
  const draft = initialStatementDrafts.find((item) => item.statementId === statementId)
  if (!draft) return { ok: false, message: `对账单 ${statementId} 不存在` }
  if (draft.status === 'CLOSED') return { ok: true }

  draft.status = 'CLOSED'
  draft.updatedAt = nowTimestamp()
  draft.updatedBy = by
  return { ok: true }
}

function renderDetailDialog(detailDraft: StatementDraft | null): string {
  if (!detailDraft) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-stm-action="close-detail" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-5xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-stm-action="close-detail" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <header class="mb-4 space-y-1">
          <h3 class="text-lg font-semibold">对账单明细 — ${escapeHtml(detailDraft.statementId)}</h3>
          <p class="text-xs text-muted-foreground">
            结算对象：${escapeHtml(partyLabel(detailDraft.settlementPartyType, detailDraft.settlementPartyId))}
            · 条目数：${detailDraft.itemCount}
            · 扣款总金额：${detailDraft.totalAmount.toFixed(2)}
          </p>
        </header>

        <div class="max-h-[60vh] overflow-auto rounded-md border">
          <table class="w-full min-w-[940px] text-sm">
            <thead>
              <tr class="border-b bg-muted/40 text-left">
                <th class="px-4 py-2 font-medium">扣款依据ID</th>
                <th class="px-4 py-2 font-medium">来源流程</th>
                <th class="px-4 py-2 font-medium">生产单</th>
                <th class="px-4 py-2 text-right font-medium">扣款数量</th>
                <th class="px-4 py-2 text-right font-medium">扣款金额</th>
                <th class="px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${detailDraft.items
                .map(
                  (item) => `
                    <tr class="border-b last:border-b-0">
                      <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.basisId)}</td>
                      <td class="px-4 py-3 text-sm">${escapeHtml(sourceLabel(item))}</td>
                      <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.productionOrderId ?? '-')}</td>
                      <td class="px-4 py-3 text-right tabular-nums">${item.deductionQty}</td>
                      <td class="px-4 py-3 text-right tabular-nums">${item.deductionAmount.toFixed(2)}</td>
                      <td class="px-4 py-3">
                        <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(buildDeductionEntryHrefByBasisId(item.basisId))}">查看依据</button>
                      </td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `
}

export function renderStatementsPage(): string {
  const candidates = getCandidateItems()
  const filtered = getFilteredCandidates(candidates)
  const partyOptions = getPartyOptions(candidates)
  const selectedBases = getSelectedBases(filtered)
  const firstSelected = selectedBases[0]
  const selectedQty = selectedBases.reduce((sum, item) => sum + (item.deductionQty ?? item.qty ?? 0), 0)
  const selectedAmount = selectedBases.reduce((sum, item) => sum + getDeductionAmount(item), 0)
  const detailDraft =
    state.detailStatementId == null
      ? null
      : initialStatementDrafts.find((item) => item.statementId === state.detailStatementId) ?? null

  return `
    <div class="flex flex-col gap-6 p-6">
      <section>
        <h2 class="mb-3 text-base font-semibold">候选扣款结果</h2>

        <div class="mb-3 flex flex-wrap items-center gap-3">
          <input
            class="h-9 w-44 rounded-md border bg-background px-3 text-sm"
            data-stm-filter="keyword"
            placeholder="关键词"
            value="${escapeHtml(state.keyword)}"
          />

          <select class="h-9 w-52 rounded-md border bg-background px-3 text-sm" data-stm-filter="party">
            <option value="__ALL__" ${state.filterParty === '__ALL__' ? 'selected' : ''}>全部结算对象</option>
            ${partyOptions
              .map(
                (item) =>
                  `<option value="${escapeHtml(item.key)}" ${state.filterParty === item.key ? 'selected' : ''}>${escapeHtml(
                    partyLabel(item.type, item.id),
                  )}</option>`,
              )
              .join('')}
          </select>

          <select class="h-9 w-40 rounded-md border bg-background px-3 text-sm" data-stm-filter="source">
            <option value="__ALL__" ${state.filterSource === '__ALL__' ? 'selected' : ''}>全部来源</option>
            <option value="DYE_PRINT" ${state.filterSource === 'DYE_PRINT' ? 'selected' : ''}>染印加工单</option>
            <option value="QC_FAIL" ${state.filterSource === 'QC_FAIL' ? 'selected' : ''}>质检不合格</option>
            <option value="HANDOVER_DIFF" ${state.filterSource === 'HANDOVER_DIFF' ? 'selected' : ''}>交接差异</option>
            <option value="OTHER" ${state.filterSource === 'OTHER' ? 'selected' : ''}>其他</option>
          </select>
        </div>

        ${
          selectedBases.length > 0
            ? `
              <div class="mb-3 flex flex-wrap items-center gap-4 rounded-md border bg-muted/40 px-4 py-2 text-sm">
                <span>已选 <strong>${selectedBases.length}</strong> 条</span>
                <span>结算对象：<strong>${escapeHtml(
                  partyLabel(firstSelected?.settlementPartyType, firstSelected?.settlementPartyId),
                )}</strong></span>
                <span>合计数量：<strong>${selectedQty}</strong></span>
                <span>合计金额：<strong>${selectedAmount.toFixed(2)}</strong></span>
                <input
                  class="h-9 w-44 rounded-md border bg-background px-3 text-sm"
                  data-stm-field="remark"
                  placeholder="备注（可选）"
                  value="${escapeHtml(state.remark)}"
                />
                <button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-stm-action="generate">
                  生成对账单草稿
                </button>
              </div>
            `
            : ''
        }

        ${
          filtered.length === 0
            ? `
              <p class="py-6 text-center text-sm text-muted-foreground">暂无可生成对账单的扣款结果</p>
            `
            : `
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full min-w-[1180px] text-sm">
                  <thead>
                    <tr class="border-b bg-muted/40 text-left">
                      <th class="w-10 px-4 py-2"></th>
                      <th class="px-4 py-2 font-medium">扣款依据ID</th>
                      <th class="px-4 py-2 font-medium">来源流程</th>
                      <th class="px-4 py-2 font-medium">生产单</th>
                      <th class="px-4 py-2 font-medium">结算对象</th>
                      <th class="px-4 py-2 text-right font-medium">扣款数量</th>
                      <th class="px-4 py-2 text-right font-medium">扣款金额</th>
                      <th class="px-4 py-2 font-medium">更新时间</th>
                      <th class="px-4 py-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filtered
                      .map(
                        (item) => `
                          <tr class="border-b last:border-b-0">
                            <td class="px-4 py-3">
                              <input
                                type="checkbox"
                                class="h-4 w-4 rounded border-border align-middle"
                                data-stm-field="candidate-check"
                                data-basis-id="${escapeHtml(item.basisId)}"
                                ${state.selected.has(item.basisId) ? 'checked' : ''}
                              />
                            </td>
                            <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.basisId)}</td>
                            <td class="px-4 py-3 text-sm">${escapeHtml(sourceLabel(item))}</td>
                            <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.productionOrderId)}</td>
                            <td class="px-4 py-3 text-xs">${escapeHtml(
                              partyLabel(item.settlementPartyType, item.settlementPartyId),
                            )}</td>
                            <td class="px-4 py-3 text-right tabular-nums">${item.deductionQty ?? item.qty ?? 0}</td>
                            <td class="px-4 py-3 text-right tabular-nums">${getDeductionAmount(item).toFixed(2)}</td>
                            <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.updatedAt ?? item.createdAt)}</td>
                            <td class="px-4 py-3">
                              <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(buildDeductionEntryHrefByBasisId(item.basisId))}">查看依据</button>
                            </td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
        }
      </section>

      <section>
        <h2 class="mb-3 text-base font-semibold">对账单草稿</h2>
        ${
          initialStatementDrafts.length === 0
            ? `
              <p class="py-6 text-center text-sm text-muted-foreground">暂无对账单草稿</p>
            `
            : `
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full min-w-[1140px] text-sm">
                  <thead>
                    <tr class="border-b bg-muted/40 text-left">
                      <th class="px-4 py-2 font-medium">对账单号</th>
                      <th class="px-4 py-2 font-medium">结算对象</th>
                      <th class="px-4 py-2 text-right font-medium">条目数</th>
                      <th class="px-4 py-2 text-right font-medium">扣款总数量</th>
                      <th class="px-4 py-2 text-right font-medium">扣款总金额</th>
                      <th class="px-4 py-2 font-medium">状态</th>
                      <th class="px-4 py-2 font-medium">创建时间</th>
                      <th class="px-4 py-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${initialStatementDrafts
                      .map(
                        (item) => `
                          <tr class="border-b last:border-b-0">
                            <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.statementId)}</td>
                            <td class="px-4 py-3 text-xs">${escapeHtml(
                              partyLabel(item.settlementPartyType, item.settlementPartyId),
                            )}</td>
                            <td class="px-4 py-3 text-right tabular-nums">${item.itemCount}</td>
                            <td class="px-4 py-3 text-right tabular-nums">${item.totalQty}</td>
                            <td class="px-4 py-3 text-right tabular-nums">${item.totalAmount.toFixed(2)}</td>
                            <td class="px-4 py-3">
                              <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[item.status]}">
                                ${STATUS_ZH[item.status]}
                              </span>
                            </td>
                            <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.createdAt)}</td>
                            <td class="px-4 py-3">
                              <div class="flex items-center gap-1">
                                <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-stm-action="open-detail" data-statement-id="${escapeHtml(item.statementId)}">查看明细</button>
                                ${
                                  item.status === 'DRAFT'
                                    ? `<button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-stm-action="confirm-draft" data-statement-id="${escapeHtml(item.statementId)}">确认</button>`
                                    : ''
                                }
                                ${
                                  item.status === 'DRAFT' || item.status === 'CONFIRMED'
                                    ? `<button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-stm-action="close-draft" data-statement-id="${escapeHtml(item.statementId)}">关闭</button>`
                                    : ''
                                }
                              </div>
                            </td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
        }
      </section>

      ${renderDetailDialog(detailDraft)}
    </div>
  `
}

export function handleStatementsEvent(target: HTMLElement): boolean {
  const filterNode = target.closest<HTMLElement>('[data-stm-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const field = filterNode.dataset.stmFilter
    if (field === 'keyword') {
      state.keyword = filterNode.value
      return true
    }
    if (field === 'party') {
      state.filterParty = filterNode.value
      return true
    }
    if (field === 'source') {
      state.filterSource = filterNode.value as SourceFilter
      return true
    }
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-stm-field]')
  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.stmField
    if (field === 'remark') {
      state.remark = fieldNode.value
      return true
    }

    if (field === 'candidate-check') {
      const basisId = fieldNode.dataset.basisId
      if (!basisId) return true

      const candidates = getCandidateItems()
      const filtered = getFilteredCandidates(candidates)
      const basis = filtered.find((item) => item.basisId === basisId)

      if (!fieldNode.checked) {
        state.selected.delete(basisId)
        return true
      }

      if (!basis) {
        state.selected.delete(basisId)
        return true
      }

      const selectedBases = getSelectedBases(filtered)
      const firstSelected = selectedBases[0]
      const sameParty =
        !firstSelected ||
        (firstSelected.settlementPartyType === basis.settlementPartyType &&
          firstSelected.settlementPartyId === basis.settlementPartyId)

      if (!sameParty) {
        showStatementsToast('一次只能生成同一结算对象的对账单', 'error')
        state.selected.delete(basisId)
        return true
      }

      state.selected.add(basisId)
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-stm-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.stmAction
  if (!action) return false

  if (action === 'generate') {
    const candidates = getCandidateItems()
    const filtered = getFilteredCandidates(candidates)
    const selectedBases = getSelectedBases(filtered)
    const firstSelected = selectedBases[0]

    if (!selectedBases.length || !firstSelected?.settlementPartyType || !firstSelected.settlementPartyId) {
      showStatementsToast('请先选择至少一条扣款依据', 'error')
      return true
    }

    const result = generateStatementDraft(
      {
        settlementPartyType: firstSelected.settlementPartyType as SettlementPartyType,
        settlementPartyId: firstSelected.settlementPartyId,
        basisIds: selectedBases.map((item) => item.basisId),
        remark: state.remark.trim() ? state.remark.trim() : undefined,
      },
      '操作员',
    )

    if (!result.ok) {
      showStatementsToast(result.message ?? '生成失败', 'error')
      return true
    }

    showStatementsToast('已生成对账单草稿')
    state.selected = new Set<string>()
    state.remark = ''
    return true
  }

  if (action === 'open-detail') {
    const statementId = actionNode.dataset.statementId
    if (statementId) state.detailStatementId = statementId
    return true
  }

  if (action === 'close-detail') {
    state.detailStatementId = null
    return true
  }

  if (action === 'confirm-draft') {
    const statementId = actionNode.dataset.statementId
    if (!statementId) return true
    const result = confirmStatementDraft(statementId, '操作员')
    if (result.ok) showStatementsToast('对账单已确认')
    else showStatementsToast(result.message ?? '操作失败', 'error')
    return true
  }

  if (action === 'close-draft') {
    const statementId = actionNode.dataset.statementId
    if (!statementId) return true
    const result = closeStatementDraft(statementId, '操作员')
    if (result.ok) showStatementsToast('对账单已关闭')
    else showStatementsToast(result.message ?? '操作失败', 'error')
    return true
  }

  return true
}

export function isStatementsDialogOpen(): boolean {
  return state.detailStatementId !== null
}
