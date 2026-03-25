import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { initialDeductionBasisItems } from '../data/fcs/store-domain-quality-seeds'
import {
  initialStatementAdjustments,
  initialStatementDrafts,
} from '../data/fcs/store-domain-settlement-seeds'
import { buildDeductionEntryHrefByBasisId } from '../data/fcs/quality-chain-adapter'
import type {
  AdjustmentStatus,
  AdjustmentType,
  StatementAdjustment,
  StatementDraft,
} from '../data/fcs/store-domain-settlement-types'
import { escapeHtml } from '../utils'

applyQualitySeedBootstrap()

type FilterType = 'ALL' | AdjustmentType
type FilterStatus = 'ALL' | AdjustmentStatus
type FilterStatementStatus = 'ALL' | 'DRAFT' | 'CONFIRMED' | 'CLOSED'

interface AdjustmentsState {
  formStatementId: string
  formType: AdjustmentType | ''
  formAmount: string
  formBasisId: string
  formRemark: string
  submitting: boolean
  keyword: string
  filterType: FilterType
  filterStatus: FilterStatus
  filterStatementStatus: FilterStatementStatus
}

const TYPE_LABEL: Record<AdjustmentType, string> = {
  DEDUCTION_SUPPLEMENT: '扣款补录',
  COMPENSATION: '补差',
  REVERSAL: '冲销',
}

const STATUS_LABEL: Record<AdjustmentStatus, string> = {
  DRAFT: '草稿',
  EFFECTIVE: '已生效',
  VOID: '已作废',
}

const STATUS_BADGE_CLASS: Record<AdjustmentStatus, string> = {
  DRAFT: 'border bg-muted text-muted-foreground',
  EFFECTIVE: 'border border-green-200 bg-green-50 text-green-700',
  VOID: 'border border-red-200 bg-red-50 text-red-700',
}

const STATEMENT_STATUS_LABEL: Record<'DRAFT' | 'CONFIRMED' | 'CLOSED', string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  CLOSED: '已关闭',
}

const PARTY_TYPE_LABEL: Record<string, string> = {
  FACTORY: '工厂',
  PROCESSOR: '加工方',
  SUPPLIER: '供应商',
  GROUP_INTERNAL: '集团内部',
  OTHER: '其他',
}

const state: AdjustmentsState = {
  formStatementId: '',
  formType: '',
  formAmount: '',
  formBasisId: '',
  formRemark: '',
  submitting: false,
  keyword: '',
  filterType: 'ALL',
  filterStatus: 'ALL',
  filterStatementStatus: 'ALL',
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function randomSuffix(length = 4): string {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase()
}

function showAdjustToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'adjustments-toast-root'
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

function getStatement(statementId: string): StatementDraft | undefined {
  return initialStatementDrafts.find((item) => item.statementId === statementId)
}

function recomputeStatementTotals(statementId: string): void {
  const statement = getStatement(statementId)
  if (!statement) return

  const baseAmount = statement.items.reduce((sum, item) => sum + item.deductionAmount, 0)
  const effectiveAdjustments = initialStatementAdjustments.filter(
    (item) => item.statementId === statementId && item.status === 'EFFECTIVE',
  )
  const delta = effectiveAdjustments.reduce((sum, item) => {
    if (item.adjustmentType === 'REVERSAL') return sum - item.amount
    return sum + item.amount
  }, 0)

  statement.totalAmount = baseAmount + delta
  statement.updatedAt = nowTimestamp()
  statement.updatedBy = 'SYSTEM'
}

function createStatementAdjustment(
  input: {
    statementId: string
    adjustmentType: AdjustmentType
    amount: number
    remark: string
    relatedBasisId?: string
  },
  by: string,
): { ok: boolean; adjustmentId?: string; message?: string } {
  const statement = getStatement(input.statementId)
  if (!statement) return { ok: false, message: `对账单 ${input.statementId} 不存在` }
  if (statement.status === 'CLOSED') return { ok: false, message: '已关闭的对账单不可新增调整项' }
  if (!input.amount || input.amount <= 0) return { ok: false, message: '金额必须大于 0' }
  if (!input.remark.trim()) return { ok: false, message: '说明不能为空' }

  if (input.relatedBasisId) {
    const basis = initialDeductionBasisItems.find((item) => item.basisId === input.relatedBasisId)
    if (!basis) return { ok: false, message: `扣款依据 ${input.relatedBasisId} 不存在` }
  }

  const timestamp = nowTimestamp()
  const month = timestamp.slice(0, 7).replace('-', '')
  let adjustmentId = `ADJ-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
  while (initialStatementAdjustments.some((item) => item.adjustmentId === adjustmentId)) {
    adjustmentId = `ADJ-${month}-${randomSuffix(4)}`
  }

  const adjustment: StatementAdjustment = {
    adjustmentId,
    statementId: input.statementId,
    adjustmentType: input.adjustmentType,
    amount: input.amount,
    remark: input.remark,
    relatedBasisId: input.relatedBasisId,
    status: 'DRAFT',
    createdAt: timestamp,
    createdBy: by,
  }

  initialStatementAdjustments.push(adjustment)
  return { ok: true, adjustmentId }
}

function effectStatementAdjustment(adjustmentId: string, by: string): { ok: boolean; message?: string } {
  const adjustment = initialStatementAdjustments.find((item) => item.adjustmentId === adjustmentId)
  if (!adjustment) return { ok: false, message: `调整项 ${adjustmentId} 不存在` }
  if (adjustment.status === 'EFFECTIVE') return { ok: true }
  if (adjustment.status === 'VOID') return { ok: false, message: '已作废的调整项不可生效' }

  const statement = getStatement(adjustment.statementId)
  if (statement?.status === 'CLOSED') return { ok: false, message: '对应对账单已关闭，不可生效' }

  adjustment.status = 'EFFECTIVE'
  adjustment.updatedAt = nowTimestamp()
  adjustment.updatedBy = by
  recomputeStatementTotals(adjustment.statementId)
  return { ok: true }
}

function voidStatementAdjustment(adjustmentId: string, by: string): { ok: boolean; message?: string } {
  const adjustment = initialStatementAdjustments.find((item) => item.adjustmentId === adjustmentId)
  if (!adjustment) return { ok: false, message: `调整项 ${adjustmentId} 不存在` }
  if (adjustment.status === 'VOID') return { ok: true }

  const statement = getStatement(adjustment.statementId)
  if (statement?.status === 'CLOSED') return { ok: false, message: '对应对账单已关闭，不可作废' }

  const wasEffective = adjustment.status === 'EFFECTIVE'
  adjustment.status = 'VOID'
  adjustment.updatedAt = nowTimestamp()
  adjustment.updatedBy = by

  if (wasEffective) recomputeStatementTotals(adjustment.statementId)
  return { ok: true }
}

function resetForm(): void {
  state.formStatementId = ''
  state.formType = ''
  state.formAmount = ''
  state.formBasisId = ''
  state.formRemark = ''
}

function getFilteredAdjustments(): StatementAdjustment[] {
  const keyword = state.keyword.trim().toLowerCase()

  return initialStatementAdjustments.filter((item) => {
    if (keyword) {
      const haystack = [item.adjustmentId, item.statementId, item.relatedBasisId ?? '', item.remark]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(keyword)) return false
    }

    if (state.filterType !== 'ALL' && item.adjustmentType !== state.filterType) return false
    if (state.filterStatus !== 'ALL' && item.status !== state.filterStatus) return false

    if (state.filterStatementStatus !== 'ALL') {
      const statement = getStatement(item.statementId)
      if (!statement || statement.status !== state.filterStatementStatus) return false
    }

    return true
  })
}

function renderStatsCard(label: string, value: number): string {
  return `
    <article class="rounded-lg border bg-card">
      <div class="px-4 pb-4 pt-4">
        <p class="text-xs text-muted-foreground">${escapeHtml(label)}</p>
        <p class="mt-1 text-2xl font-bold text-foreground tabular-nums">${value}</p>
      </div>
    </article>
  `
}

export function renderAdjustmentsPage(): string {
  const openStatements = initialStatementDrafts.filter((item) => item.status !== 'CLOSED')
  const filtered = getFilteredAdjustments()
  const stats = {
    total: initialStatementAdjustments.length,
    effective: initialStatementAdjustments.filter((item) => item.status === 'EFFECTIVE').length,
    draft: initialStatementAdjustments.filter((item) => item.status === 'DRAFT').length,
    void: initialStatementAdjustments.filter((item) => item.status === 'VOID').length,
  }

  return `
    <div class="flex flex-col gap-6 p-6">
      <h1 class="text-xl font-semibold text-foreground">扣款/补差管理</h1>

      <section class="grid grid-cols-2 gap-3 md:grid-cols-4">
        ${renderStatsCard('调整项总数', stats.total)}
        ${renderStatsCard('已生效数', stats.effective)}
        ${renderStatsCard('草稿数', stats.draft)}
        ${renderStatsCard('已作废数', stats.void)}
      </section>

      <section class="rounded-lg border bg-card">
        <header class="px-4 pb-2 pt-4">
          <h2 class="text-sm font-semibold">新建调整项</h2>
        </header>

        <div class="px-4 pb-4">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs">对账单 <span class="text-red-600">*</span></label>
              <select class="h-8 rounded-md border bg-background px-2 text-xs" data-adj-form="statementId">
                <option value="" ${state.formStatementId === '' ? 'selected' : ''}>请选择对账单</option>
                ${
                  openStatements.length === 0
                    ? '<option value="__none__" disabled>暂无可用对账单</option>'
                    : openStatements
                        .map(
                          (item) => `
                            <option value="${escapeHtml(item.statementId)}" ${state.formStatementId === item.statementId ? 'selected' : ''}>
                              ${escapeHtml(item.statementId)} / ${escapeHtml(PARTY_TYPE_LABEL[item.settlementPartyType] ?? item.settlementPartyType)} ${escapeHtml(item.settlementPartyId)} / ¥${item.totalAmount.toFixed(2)}
                            </option>
                          `,
                        )
                        .join('')
                }
              </select>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs">调整类型 <span class="text-red-600">*</span></label>
              <select class="h-8 rounded-md border bg-background px-2 text-xs" data-adj-form="type">
                <option value="" ${state.formType === '' ? 'selected' : ''}>请选择类型</option>
                <option value="DEDUCTION_SUPPLEMENT" ${state.formType === 'DEDUCTION_SUPPLEMENT' ? 'selected' : ''}>扣款补录</option>
                <option value="COMPENSATION" ${state.formType === 'COMPENSATION' ? 'selected' : ''}>补差</option>
                <option value="REVERSAL" ${state.formType === 'REVERSAL' ? 'selected' : ''}>冲销</option>
              </select>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs">金额 <span class="text-red-600">*</span></label>
              <input
                class="h-8 rounded-md border bg-background px-2 text-xs"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="请输入金额"
                data-adj-form="amount"
                value="${escapeHtml(state.formAmount)}"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs">关联扣款依据（可选）</label>
              <select class="h-8 rounded-md border bg-background px-2 text-xs" data-adj-form="basisId">
                <option value="" ${state.formBasisId === '' ? 'selected' : ''}>不关联</option>
                ${initialDeductionBasisItems
                  .map(
                    (item) =>
                      `<option value="${escapeHtml(item.basisId)}" ${state.formBasisId === item.basisId ? 'selected' : ''}>${escapeHtml(item.basisId)}</option>`,
                  )
                  .join('')}
              </select>
            </div>

            <div class="flex flex-col gap-1.5 md:col-span-2">
              <label class="text-xs">说明 <span class="text-red-600">*</span></label>
              <textarea
                class="min-h-[60px] resize-none rounded-md border bg-background px-2 py-2 text-xs"
                placeholder="请填写调整说明"
                data-adj-form="remark"
              >${escapeHtml(state.formRemark)}</textarea>
            </div>
          </div>

          <div class="mt-4 flex gap-2">
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60" data-adj-action="save-draft" ${state.submitting ? 'disabled' : ''}>
              保存草稿
            </button>
            <button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" data-adj-action="save-effect" ${state.submitting ? 'disabled' : ''}>
              保存并生效
            </button>
          </div>
        </div>
      </section>

      <section class="flex flex-wrap gap-2">
        <input
          class="h-8 w-44 rounded-md border bg-background px-2 text-xs"
          placeholder="关键词搜索"
          data-adj-filter="keyword"
          value="${escapeHtml(state.keyword)}"
        />

        <select class="h-8 w-32 rounded-md border bg-background px-2 text-xs" data-adj-filter="type">
          <option value="ALL" ${state.filterType === 'ALL' ? 'selected' : ''}>全部类型</option>
          <option value="DEDUCTION_SUPPLEMENT" ${state.filterType === 'DEDUCTION_SUPPLEMENT' ? 'selected' : ''}>扣款补录</option>
          <option value="COMPENSATION" ${state.filterType === 'COMPENSATION' ? 'selected' : ''}>补差</option>
          <option value="REVERSAL" ${state.filterType === 'REVERSAL' ? 'selected' : ''}>冲销</option>
        </select>

        <select class="h-8 w-28 rounded-md border bg-background px-2 text-xs" data-adj-filter="status">
          <option value="ALL" ${state.filterStatus === 'ALL' ? 'selected' : ''}>全部状态</option>
          <option value="DRAFT" ${state.filterStatus === 'DRAFT' ? 'selected' : ''}>草稿</option>
          <option value="EFFECTIVE" ${state.filterStatus === 'EFFECTIVE' ? 'selected' : ''}>已生效</option>
          <option value="VOID" ${state.filterStatus === 'VOID' ? 'selected' : ''}>已作废</option>
        </select>

        <select class="h-8 w-36 rounded-md border bg-background px-2 text-xs" data-adj-filter="statementStatus">
          <option value="ALL" ${state.filterStatementStatus === 'ALL' ? 'selected' : ''}>全部对账单状态</option>
          <option value="DRAFT" ${state.filterStatementStatus === 'DRAFT' ? 'selected' : ''}>草稿</option>
          <option value="CONFIRMED" ${state.filterStatementStatus === 'CONFIRMED' ? 'selected' : ''}>已确认</option>
          <option value="CLOSED" ${state.filterStatementStatus === 'CLOSED' ? 'selected' : ''}>已关闭</option>
        </select>
      </section>

      ${
        filtered.length === 0
          ? `
            <section class="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
              暂无调整项
            </section>
          `
          : `
            <section class="overflow-x-auto rounded-lg border">
              <table class="w-full min-w-[1500px] text-xs">
                <thead>
                  <tr class="border-b bg-muted/40 text-left">
                    <th class="px-4 py-2 font-medium">调整项ID</th>
                    <th class="px-4 py-2 font-medium">对账单号</th>
                    <th class="px-4 py-2 font-medium">结算对象</th>
                    <th class="px-4 py-2 font-medium">调整类型</th>
                    <th class="px-4 py-2 text-right font-medium">金额</th>
                    <th class="px-4 py-2 font-medium">关联扣款依据</th>
                    <th class="px-4 py-2 font-medium">状态</th>
                    <th class="px-4 py-2 font-medium">创建时间</th>
                    <th class="px-4 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered
                    .map((adjustment) => {
                      const statement = getStatement(adjustment.statementId)
                      const partyLabel = statement
                        ? `${PARTY_TYPE_LABEL[statement.settlementPartyType] ?? statement.settlementPartyType} ${statement.settlementPartyId}`
                        : '—'
                      const statementStatus = statement ? STATEMENT_STATUS_LABEL[statement.status] : '—'

                      return `
                        <tr class="border-b last:border-b-0">
                          <td class="px-4 py-3 font-mono">${escapeHtml(adjustment.adjustmentId)}</td>
                          <td class="px-4 py-3 font-mono">
                            <div class="flex flex-col gap-0.5">
                              <span>${escapeHtml(adjustment.statementId)}</span>
                              <span class="text-[11px] text-muted-foreground">${escapeHtml(statementStatus)}</span>
                            </div>
                          </td>
                          <td class="px-4 py-3">${escapeHtml(partyLabel)}</td>
                          <td class="px-4 py-3">${TYPE_LABEL[adjustment.adjustmentType]}</td>
                          <td class="px-4 py-3 text-right font-mono">
                            ${adjustment.adjustmentType === 'REVERSAL' ? '-' : '+'}¥${adjustment.amount.toFixed(2)}
                          </td>
                          <td class="px-4 py-3">
                            ${
                              adjustment.relatedBasisId
                                ? `<button class="text-primary underline underline-offset-2" data-nav="${escapeHtml(buildDeductionEntryHrefByBasisId(adjustment.relatedBasisId))}">${escapeHtml(adjustment.relatedBasisId)}</button>`
                                : '—'
                            }
                          </td>
                          <td class="px-4 py-3">
                            <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[adjustment.status]}">
                              ${STATUS_LABEL[adjustment.status]}
                            </span>
                          </td>
                          <td class="px-4 py-3">${escapeHtml(adjustment.createdAt)}</td>
                          <td class="px-4 py-3">
                            <div class="flex flex-wrap gap-1">
                              <button class="inline-flex h-6 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/settlement/statements">查看对账单</button>
                              ${
                                adjustment.relatedBasisId
                                  ? `<button class="inline-flex h-6 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(buildDeductionEntryHrefByBasisId(adjustment.relatedBasisId))}">查看依据</button>`
                                  : ''
                              }
                              ${
                                adjustment.status === 'DRAFT'
                                  ? `<button class="inline-flex h-6 items-center rounded-md border px-2 text-xs hover:bg-muted" data-adj-action="effect-item" data-adjustment-id="${escapeHtml(adjustment.adjustmentId)}">生效</button>`
                                  : ''
                              }
                              ${
                                adjustment.status === 'DRAFT' || adjustment.status === 'EFFECTIVE'
                                  ? `<button class="inline-flex h-6 items-center rounded-md px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700" data-adj-action="void-item" data-adjustment-id="${escapeHtml(adjustment.adjustmentId)}">作废</button>`
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

function submitAdjustment(andEffect: boolean): void {
  if (!state.formStatementId) {
    showAdjustToast('请选择对账单', 'error')
    return
  }
  if (!state.formType) {
    showAdjustToast('请选择调整类型', 'error')
    return
  }
  const amount = Number.parseFloat(state.formAmount)
  if (!state.formAmount || Number.isNaN(amount) || amount <= 0) {
    showAdjustToast('金额必须大于 0', 'error')
    return
  }
  if (!state.formRemark.trim()) {
    showAdjustToast('说明不能为空', 'error')
    return
  }

  state.submitting = true
  const created = createStatementAdjustment(
    {
      statementId: state.formStatementId,
      adjustmentType: state.formType,
      amount,
      remark: state.formRemark.trim(),
      relatedBasisId: state.formBasisId || undefined,
    },
    'ADMIN',
  )

  if (!created.ok) {
    state.submitting = false
    showAdjustToast(created.message ?? '创建失败', 'error')
    return
  }

  if (andEffect && created.adjustmentId) {
    const effected = effectStatementAdjustment(created.adjustmentId, 'ADMIN')
    if (!effected.ok) {
      state.submitting = false
      showAdjustToast(effected.message ?? '生效失败', 'error')
      return
    }
    showAdjustToast('调整项已生效')
  } else {
    showAdjustToast('草稿已保存')
  }

  resetForm()
  state.submitting = false
}

export function handleAdjustmentsEvent(target: HTMLElement): boolean {
  const formNode = target.closest<HTMLElement>('[data-adj-form]')
  if (
    formNode instanceof HTMLInputElement ||
    formNode instanceof HTMLSelectElement ||
    formNode instanceof HTMLTextAreaElement
  ) {
    const field = formNode.dataset.adjForm
    if (!field) return true

    if (field === 'statementId') {
      state.formStatementId = formNode.value
      return true
    }
    if (field === 'type') {
      state.formType = formNode.value as AdjustmentType | ''
      return true
    }
    if (field === 'amount') {
      state.formAmount = formNode.value
      return true
    }
    if (field === 'basisId') {
      state.formBasisId = formNode.value
      return true
    }
    if (field === 'remark') {
      state.formRemark = formNode.value
      return true
    }
    return true
  }

  const filterNode = target.closest<HTMLElement>('[data-adj-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const field = filterNode.dataset.adjFilter
    if (!field) return true

    if (field === 'keyword') {
      state.keyword = filterNode.value
      return true
    }
    if (field === 'type') {
      state.filterType = filterNode.value as FilterType
      return true
    }
    if (field === 'status') {
      state.filterStatus = filterNode.value as FilterStatus
      return true
    }
    if (field === 'statementStatus') {
      state.filterStatementStatus = filterNode.value as FilterStatementStatus
      return true
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-adj-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.adjAction
  if (!action) return false

  if (action === 'save-draft') {
    submitAdjustment(false)
    return true
  }
  if (action === 'save-effect') {
    submitAdjustment(true)
    return true
  }
  if (action === 'effect-item') {
    const adjustmentId = actionNode.dataset.adjustmentId
    if (!adjustmentId) return true
    const result = effectStatementAdjustment(adjustmentId, 'ADMIN')
    if (result.ok) showAdjustToast('调整项已生效')
    else showAdjustToast(result.message ?? '操作失败', 'error')
    return true
  }
  if (action === 'void-item') {
    const adjustmentId = actionNode.dataset.adjustmentId
    if (!adjustmentId) return true
    const result = voidStatementAdjustment(adjustmentId, 'ADMIN')
    if (result.ok) showAdjustToast('已作废')
    else showAdjustToast(result.message ?? '操作失败', 'error')
    return true
  }

  return true
}

export function isAdjustmentsDialogOpen(): boolean {
  return false
}
