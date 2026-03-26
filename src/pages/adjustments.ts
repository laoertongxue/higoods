import { appStore } from '../state/store'
import { buildDeductionEntryHrefByBasisId } from '../data/fcs/quality-chain-adapter'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { initialDeductionBasisItems } from '../data/fcs/store-domain-quality-seeds'
import type { SettlementPartyType } from '../data/fcs/store-domain-quality-types'
import {
  initialPayableAdjustments,
  initialStatementDrafts,
} from '../data/fcs/store-domain-settlement-seeds'
import { getSettlementPageBoundary } from '../data/fcs/settlement-flow-boundaries'
import type {
  AdjustmentStatus,
  AdjustmentType,
  PayableAdjustment,
} from '../data/fcs/store-domain-settlement-types'
import { escapeHtml, toClassName } from '../utils'

applyQualitySeedBootstrap()

type FilterType = 'ALL' | AdjustmentType
type AdjustmentWorkbenchView = 'PENDING_BIND' | 'BOUND' | 'EFFECTIVE' | 'VOID'

interface AdjustmentsState {
  activeView: AdjustmentWorkbenchView
  formPartyType: SettlementPartyType
  formPartyId: string
  formProductionOrderId: string
  formType: AdjustmentType | ''
  formAmount: string
  formBasisId: string
  formRemark: string
  submitting: boolean
  keyword: string
  filterType: FilterType
}

const TYPE_LABEL: Record<AdjustmentType, string> = {
  DEDUCTION_SUPPLEMENT: '扣款补录',
  COMPENSATION: '补差',
  REVERSAL: '冲销',
}

const PARTY_TYPE_LABEL: Record<string, string> = {
  FACTORY: '工厂',
  PROCESSOR: '加工方',
  SUPPLIER: '供应商',
  GROUP_INTERNAL: '内部主体',
  INTERNAL: '内部主体',
  OTHER: '其他',
}

const STATUS_BADGE_CLASS: Record<AdjustmentWorkbenchView, string> = {
  PENDING_BIND: 'border bg-muted text-muted-foreground',
  BOUND: 'border border-blue-200 bg-blue-50 text-blue-700',
  EFFECTIVE: 'border border-green-200 bg-green-50 text-green-700',
  VOID: 'border border-red-200 bg-red-50 text-red-700',
}

const VIEW_LABEL: Record<AdjustmentWorkbenchView, string> = {
  PENDING_BIND: '待入对账单',
  BOUND: '已入对账单',
  EFFECTIVE: '已生效',
  VOID: '已作废',
}

const state: AdjustmentsState = {
  activeView: 'PENDING_BIND',
  formPartyType: 'FACTORY',
  formPartyId: '',
  formProductionOrderId: '',
  formType: '',
  formAmount: '',
  formBasisId: '',
  formRemark: '',
  submitting: false,
  keyword: '',
  filterType: 'ALL',
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function randomSuffix(length = 4): string {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase()
}

function getCurrentSearchParams(): URLSearchParams {
  const [, query = ''] = appStore.getState().pathname.split('?')
  return new URLSearchParams(query)
}

function syncAdjustmentsStateFromPath(): void {
  const params = getCurrentSearchParams()
  const view = params.get('view')
  const keyword = params.get('keyword')

  if (view === 'pending') state.activeView = 'PENDING_BIND'
  if (view === 'bound') state.activeView = 'BOUND'
  if (view === 'effective') state.activeView = 'EFFECTIVE'
  if (view === 'void') state.activeView = 'VOID'
  if (keyword !== null) state.keyword = keyword
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

function resetForm(): void {
  state.formPartyType = 'FACTORY'
  state.formPartyId = ''
  state.formProductionOrderId = ''
  state.formType = ''
  state.formAmount = ''
  state.formBasisId = ''
  state.formRemark = ''
}

function getLinkedStatementId(adjustment: PayableAdjustment): string | null {
  if (adjustment.linkedStatementId) return adjustment.linkedStatementId
  const linked = initialStatementDrafts.find(
    (statement) =>
      statement.status !== 'CLOSED'
      && statement.items.some((item) => item.sourceItemId === adjustment.adjustmentId),
  )
  return linked?.statementId ?? null
}

function getAdjustmentView(adjustment: PayableAdjustment): AdjustmentWorkbenchView {
  if (adjustment.status === 'VOID') return 'VOID'
  if (adjustment.status === 'EFFECTIVE') return 'EFFECTIVE'
  if (getLinkedStatementId(adjustment)) return 'BOUND'
  return 'PENDING_BIND'
}

function getFilteredAdjustments(): PayableAdjustment[] {
  const keyword = state.keyword.trim().toLowerCase()
  return initialPayableAdjustments
    .filter((item) => {
      if (getAdjustmentView(item) !== state.activeView) return false
      if (state.filterType !== 'ALL' && item.adjustmentType !== state.filterType) return false
      if (!keyword) return true
      const linkedStatementId = getLinkedStatementId(item) ?? ''
      const haystack = [
        item.adjustmentId,
        item.productionOrderId ?? '',
        item.settlementPartyId,
        item.relatedBasisId ?? '',
        linkedStatementId,
        item.remark,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(keyword)
    })
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1))
}

function createPayableAdjustment(
  input: {
    adjustmentType: AdjustmentType
    settlementPartyType: SettlementPartyType
    settlementPartyId: string
    productionOrderId?: string
    amount: number
    remark: string
    relatedBasisId?: string
  },
  by: string,
): { ok: boolean; adjustmentId?: string; message?: string } {
  if (!input.settlementPartyId.trim()) return { ok: false, message: '结算对象不能为空' }
  if (!input.amount || input.amount <= 0) return { ok: false, message: '金额必须大于 0' }
  if (!input.remark.trim()) return { ok: false, message: '说明不能为空' }

  if (input.relatedBasisId) {
    const basis = initialDeductionBasisItems.find((item) => item.basisId === input.relatedBasisId)
    if (!basis) return { ok: false, message: `关联依据 ${input.relatedBasisId} 不存在` }
  }

  const timestamp = nowTimestamp()
  const month = timestamp.slice(0, 7).replace('-', '')
  let adjustmentId = `PAD-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
  while (initialPayableAdjustments.some((item) => item.adjustmentId === adjustmentId)) {
    adjustmentId = `PAD-${month}-${randomSuffix(4)}`
  }

  initialPayableAdjustments.push({
    adjustmentId,
    adjustmentType: input.adjustmentType,
    settlementPartyType: input.settlementPartyType,
    settlementPartyId: input.settlementPartyId,
    productionOrderId: input.productionOrderId || undefined,
    amount: input.amount,
    currency: 'CNY',
    remark: input.remark,
    relatedBasisId: input.relatedBasisId,
    status: 'DRAFT',
    createdAt: timestamp,
    createdBy: by,
  })

  return { ok: true, adjustmentId }
}

function effectPayableAdjustment(adjustmentId: string, by: string): { ok: boolean; message?: string } {
  const adjustment = initialPayableAdjustments.find((item) => item.adjustmentId === adjustmentId)
  if (!adjustment) return { ok: false, message: `调整项 ${adjustmentId} 不存在` }
  if (adjustment.status === 'EFFECTIVE') return { ok: true }
  if (adjustment.status === 'VOID') return { ok: false, message: '已作废的调整项不可生效' }
  adjustment.status = 'EFFECTIVE'
  adjustment.updatedAt = nowTimestamp()
  adjustment.updatedBy = by
  return { ok: true }
}

function voidPayableAdjustment(adjustmentId: string, by: string): { ok: boolean; message?: string } {
  const adjustment = initialPayableAdjustments.find((item) => item.adjustmentId === adjustmentId)
  if (!adjustment) return { ok: false, message: `调整项 ${adjustmentId} 不存在` }
  if (adjustment.status === 'VOID') return { ok: true }
  adjustment.status = 'VOID'
  adjustment.updatedAt = nowTimestamp()
  adjustment.updatedBy = by
  return { ok: true }
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

function renderViewChip(view: AdjustmentWorkbenchView, count: number): string {
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

export function renderAdjustmentsPage(): string {
  syncAdjustmentsStateFromPath()

  const pageBoundary = getSettlementPageBoundary('adjustments')
  const filtered = getFilteredAdjustments()
  const counts = {
    pending: initialPayableAdjustments.filter((item) => getAdjustmentView(item) === 'PENDING_BIND').length,
    bound: initialPayableAdjustments.filter((item) => getAdjustmentView(item) === 'BOUND').length,
    effective: initialPayableAdjustments.filter((item) => getAdjustmentView(item) === 'EFFECTIVE').length,
    void: initialPayableAdjustments.filter((item) => getAdjustmentView(item) === 'VOID').length,
  }

  return `
    <div class="flex flex-col gap-6 p-6">
      <section>
        <h1 class="text-xl font-semibold text-foreground">应付调整</h1>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(pageBoundary.pageIntro)}</p>
      </section>

      <section class="grid grid-cols-2 gap-3 md:grid-cols-4">
        ${renderStatsCard('待入对账单', counts.pending)}
        ${renderStatsCard('已入对账单', counts.bound)}
        ${renderStatsCard('已生效', counts.effective)}
        ${renderStatsCard('已作废', counts.void)}
      </section>

      <section class="rounded-lg border bg-card">
        <header class="px-4 pb-2 pt-4">
          <h2 class="text-sm font-semibold">新建应付调整来源项</h2>
          <p class="mt-1 text-xs text-muted-foreground">先形成独立调整来源项，再由对账单工作台选择纳入，不再要求先指定对账单。</p>
        </header>

        <div class="px-4 pb-4">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs">结算对象类型 <span class="text-red-600">*</span></label>
              <select class="h-8 rounded-md border bg-background px-2 text-xs" data-adj-form="partyType">
                <option value="FACTORY" ${state.formPartyType === 'FACTORY' ? 'selected' : ''}>工厂</option>
                <option value="PROCESSOR" ${state.formPartyType === 'PROCESSOR' ? 'selected' : ''}>加工方</option>
                <option value="SUPPLIER" ${state.formPartyType === 'SUPPLIER' ? 'selected' : ''}>供应商</option>
                <option value="GROUP_INTERNAL" ${state.formPartyType === 'GROUP_INTERNAL' ? 'selected' : ''}>内部主体</option>
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs">结算对象 <span class="text-red-600">*</span></label>
              <input class="h-8 rounded-md border bg-background px-2 text-xs" data-adj-form="partyId" placeholder="如 ID-F001 / PROC-DP-001" value="${escapeHtml(state.formPartyId)}" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs">生产单（可选）</label>
              <input class="h-8 rounded-md border bg-background px-2 text-xs" data-adj-form="productionOrderId" placeholder="如 PO-0001" value="${escapeHtml(state.formProductionOrderId)}" />
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
              <input class="h-8 rounded-md border bg-background px-2 text-xs" type="number" min="0.01" step="0.01" placeholder="请输入金额" data-adj-form="amount" value="${escapeHtml(state.formAmount)}" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs">关联质量来源（可选）</label>
              <select class="h-8 rounded-md border bg-background px-2 text-xs" data-adj-form="basisId">
                <option value="" ${state.formBasisId === '' ? 'selected' : ''}>不关联</option>
                ${initialDeductionBasisItems.map((item) => `<option value="${escapeHtml(item.basisId)}" ${state.formBasisId === item.basisId ? 'selected' : ''}>${escapeHtml(item.basisId)}</option>`).join('')}
              </select>
            </div>
            <div class="flex flex-col gap-1.5 md:col-span-2 lg:col-span-3">
              <label class="text-xs">说明 <span class="text-red-600">*</span></label>
              <textarea class="min-h-[60px] resize-none rounded-md border bg-background px-2 py-2 text-xs" placeholder="请填写调整说明" data-adj-form="remark">${escapeHtml(state.formRemark)}</textarea>
            </div>
          </div>

          <div class="mt-4 flex gap-2">
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60" data-adj-action="save-draft" ${state.submitting ? 'disabled' : ''}>保存来源项</button>
            <button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" data-adj-action="save-effect" ${state.submitting ? 'disabled' : ''}>保存并生效</button>
          </div>
        </div>
      </section>

      <section class="rounded-xl border bg-background p-4">
        <div class="flex flex-wrap items-center gap-2">
          ${renderViewChip('PENDING_BIND', counts.pending)}
          ${renderViewChip('BOUND', counts.bound)}
          ${renderViewChip('EFFECTIVE', counts.effective)}
          ${renderViewChip('VOID', counts.void)}
        </div>
      </section>

      <section class="flex flex-wrap gap-2">
        <input class="h-8 w-52 rounded-md border bg-background px-2 text-xs" placeholder="关键词搜索" data-adj-filter="keyword" value="${escapeHtml(state.keyword)}" />
        <select class="h-8 w-32 rounded-md border bg-background px-2 text-xs" data-adj-filter="type">
          <option value="ALL" ${state.filterType === 'ALL' ? 'selected' : ''}>全部类型</option>
          <option value="DEDUCTION_SUPPLEMENT" ${state.filterType === 'DEDUCTION_SUPPLEMENT' ? 'selected' : ''}>扣款补录</option>
          <option value="COMPENSATION" ${state.filterType === 'COMPENSATION' ? 'selected' : ''}>补差</option>
          <option value="REVERSAL" ${state.filterType === 'REVERSAL' ? 'selected' : ''}>冲销</option>
        </select>
      </section>

      ${
        filtered.length === 0
          ? `<section class="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">当前视图暂无应付调整来源项</section>`
          : `
            <section class="overflow-x-auto rounded-lg border">
              <table class="w-full min-w-[1560px] text-xs">
                <thead>
                  <tr class="border-b bg-muted/40 text-left">
                    <th class="px-4 py-2 font-medium">调整项ID</th>
                    <th class="px-4 py-2 font-medium">结算对象</th>
                    <th class="px-4 py-2 font-medium">生产单</th>
                    <th class="px-4 py-2 font-medium">调整类型</th>
                    <th class="px-4 py-2 text-right font-medium">金额</th>
                    <th class="px-4 py-2 font-medium">关联质量来源</th>
                    <th class="px-4 py-2 font-medium">当前状态</th>
                    <th class="px-4 py-2 font-medium">已入对账单</th>
                    <th class="px-4 py-2 font-medium">创建时间</th>
                    <th class="px-4 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered
                    .map((adjustment) => {
                      const linkedStatementId = getLinkedStatementId(adjustment)
                      const view = getAdjustmentView(adjustment)
                      return `
                        <tr class="border-b last:border-b-0">
                          <td class="px-4 py-3 font-mono">${escapeHtml(adjustment.adjustmentId)}</td>
                          <td class="px-4 py-3">${escapeHtml(`${PARTY_TYPE_LABEL[adjustment.settlementPartyType] ?? adjustment.settlementPartyType} / ${adjustment.settlementPartyId}`)}</td>
                          <td class="px-4 py-3 font-mono text-[11px]">${escapeHtml(adjustment.productionOrderId ?? '—')}</td>
                          <td class="px-4 py-3">${escapeHtml(TYPE_LABEL[adjustment.adjustmentType])}</td>
                          <td class="px-4 py-3 text-right font-mono">${adjustment.adjustmentType === 'REVERSAL' ? '-' : '+'}¥${adjustment.amount.toFixed(2)}</td>
                          <td class="px-4 py-3">
                            ${
                              adjustment.relatedBasisId
                                ? `<button class="text-primary underline underline-offset-2" data-nav="${escapeHtml(buildDeductionEntryHrefByBasisId(adjustment.relatedBasisId))}">${escapeHtml(adjustment.relatedBasisId)}</button>`
                                : '—'
                            }
                          </td>
                          <td class="px-4 py-3">
                            <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[view]}">${escapeHtml(VIEW_LABEL[view])}</span>
                          </td>
                          <td class="px-4 py-3">
                            ${
                              linkedStatementId
                                ? `<button class="text-primary underline underline-offset-2" data-nav="/fcs/settlement/statements">${escapeHtml(linkedStatementId)}</button>`
                                : '—'
                            }
                          </td>
                          <td class="px-4 py-3">${escapeHtml(adjustment.createdAt)}</td>
                          <td class="px-4 py-3">
                            <div class="flex flex-wrap gap-1">
                              ${
                                linkedStatementId
                                  ? `<button class="inline-flex h-6 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/settlement/statements">查看对账单</button>`
                                  : ''
                              }
                              ${
                                adjustment.relatedBasisId
                                  ? `<button class="inline-flex h-6 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(buildDeductionEntryHrefByBasisId(adjustment.relatedBasisId))}">查看来源</button>`
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
  if (!state.formPartyId.trim()) {
    showAdjustToast('请填写结算对象', 'error')
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
  const created = createPayableAdjustment(
    {
      adjustmentType: state.formType,
      settlementPartyType: state.formPartyType,
      settlementPartyId: state.formPartyId.trim(),
      productionOrderId: state.formProductionOrderId.trim() || undefined,
      amount,
      remark: state.formRemark.trim(),
      relatedBasisId: state.formBasisId || undefined,
    },
    'ADMIN',
  )

  if (!created.ok || !created.adjustmentId) {
    state.submitting = false
    showAdjustToast(created.message ?? '创建失败', 'error')
    return
  }

  if (andEffect) {
    const effected = effectPayableAdjustment(created.adjustmentId, 'ADMIN')
    if (!effected.ok) {
      state.submitting = false
      showAdjustToast(effected.message ?? '生效失败', 'error')
      return
    }
    state.activeView = 'EFFECTIVE'
    showAdjustToast('应付调整已生效')
  } else {
    state.activeView = 'PENDING_BIND'
    showAdjustToast('已生成应付调整来源项')
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
    if (field === 'partyType') state.formPartyType = formNode.value as SettlementPartyType
    if (field === 'partyId') state.formPartyId = formNode.value
    if (field === 'productionOrderId') state.formProductionOrderId = formNode.value
    if (field === 'type') state.formType = formNode.value as AdjustmentType | ''
    if (field === 'amount') state.formAmount = formNode.value
    if (field === 'basisId') state.formBasisId = formNode.value
    if (field === 'remark') state.formRemark = formNode.value
    return true
  }

  const filterNode = target.closest<HTMLElement>('[data-adj-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const field = filterNode.dataset.adjFilter
    if (!field) return true
    if (field === 'keyword') state.keyword = filterNode.value
    if (field === 'type') state.filterType = filterNode.value as FilterType
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-adj-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.adjAction
  if (!action) return false

  if (action === 'switch-view') {
    const view = actionNode.dataset.view as AdjustmentWorkbenchView | undefined
    if (view) state.activeView = view
    return true
  }
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
    const result = effectPayableAdjustment(adjustmentId, 'ADMIN')
    if (result.ok) {
      state.activeView = 'EFFECTIVE'
      showAdjustToast('调整项已生效')
    } else showAdjustToast(result.message ?? '操作失败', 'error')
    return true
  }
  if (action === 'void-item') {
    const adjustmentId = actionNode.dataset.adjustmentId
    if (!adjustmentId) return true
    const result = voidPayableAdjustment(adjustmentId, 'ADMIN')
    if (result.ok) {
      state.activeView = 'VOID'
      showAdjustToast('已作废')
    } else showAdjustToast(result.message ?? '操作失败', 'error')
    return true
  }

  return true
}

export function isAdjustmentsDialogOpen(): boolean {
  return false
}
