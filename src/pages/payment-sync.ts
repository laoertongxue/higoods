import { initialSettlementBatches } from '../data/fcs/store-domain-settlement-seeds'
import type { SettlementBatch } from '../data/fcs/store-domain-settlement-types'
import { escapeHtml } from '../utils'

type PaymentSyncStatus = 'UNSYNCED' | 'SUCCESS' | 'FAILED' | 'PARTIAL'

interface SyncForm {
  paymentSyncStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL' | ''
  paymentAmount: string
  paymentAt: string
  paymentReferenceNo: string
  paymentRemark: string
}

interface PaymentSyncState {
  keyword: string
  statusFilter: PaymentSyncStatus | 'ALL'
  dialogOpen: boolean
  activeBatchId: string
  form: SyncForm
  formError: string
  saving: boolean
}

const SYNC_STATUS_LABEL: Record<PaymentSyncStatus, string> = {
  UNSYNCED: '未同步',
  SUCCESS: '打款成功',
  FAILED: '打款失败',
  PARTIAL: '部分打款',
}

const SYNC_STATUS_BADGE: Record<PaymentSyncStatus, string> = {
  UNSYNCED: 'border bg-muted text-muted-foreground',
  SUCCESS: 'border border-green-200 bg-green-50 text-green-700',
  FAILED: 'border border-red-200 bg-red-50 text-red-700',
  PARTIAL: 'border border-blue-200 bg-blue-50 text-blue-700',
}

const EMPTY_FORM: SyncForm = {
  paymentSyncStatus: '',
  paymentAmount: '',
  paymentAt: '',
  paymentReferenceNo: '',
  paymentRemark: '',
}

const state: PaymentSyncState = {
  keyword: '',
  statusFilter: 'ALL',
  dialogOpen: false,
  activeBatchId: '',
  form: { ...EMPTY_FORM },
  formError: '',
  saving: false,
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function showPaymentSyncToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'payment-sync-toast-root'
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

function getCompletedBatches(): SettlementBatch[] {
  return initialSettlementBatches
    .filter((batch) => batch.status === 'COMPLETED')
    .slice()
    .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
}

function getFilteredBatches(completedBatches: SettlementBatch[]): SettlementBatch[] {
  const keyword = state.keyword.trim().toLowerCase()
  return completedBatches.filter((batch) => {
    const effectiveStatus: PaymentSyncStatus = batch.paymentSyncStatus ?? 'UNSYNCED'
    if (state.statusFilter !== 'ALL' && effectiveStatus !== state.statusFilter) return false

    if (keyword) {
      const haystack = [
        batch.batchId,
        batch.batchName ?? '',
        batch.paymentReferenceNo ?? '',
        batch.remark ?? '',
        batch.paymentRemark ?? '',
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    return true
  })
}

function getStats(completedBatches: SettlementBatch[]): {
  unsynced: number
  success: number
  failed: number
  partial: number
} {
  const unsynced = completedBatches.filter(
    (batch) => !batch.paymentSyncStatus || batch.paymentSyncStatus === 'UNSYNCED',
  ).length
  const success = completedBatches.filter((batch) => batch.paymentSyncStatus === 'SUCCESS').length
  const failed = completedBatches.filter((batch) => batch.paymentSyncStatus === 'FAILED').length
  const partial = completedBatches.filter((batch) => batch.paymentSyncStatus === 'PARTIAL').length
  return { unsynced, success, failed, partial }
}

function syncSettlementPaymentResult(
  input: {
    batchId: string
    paymentSyncStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL'
    paymentAmount?: number
    paymentAt?: string
    paymentReferenceNo?: string
    paymentRemark?: string
  },
  by: string,
): { ok: boolean; message?: string } {
  const {
    batchId,
    paymentSyncStatus,
    paymentAmount,
    paymentAt,
    paymentReferenceNo,
    paymentRemark,
  } = input

  const batch = initialSettlementBatches.find((item) => item.batchId === batchId)
  if (!batch) return { ok: false, message: `结算批次 ${batchId} 不存在` }
  if (batch.status !== 'COMPLETED') {
    return { ok: false, message: '仅已完成结算批次允许同步打款结果' }
  }
  if (!['SUCCESS', 'FAILED', 'PARTIAL'].includes(paymentSyncStatus)) {
    return { ok: false, message: '同步状态无效' }
  }
  if (paymentAmount !== undefined && paymentAmount < 0) {
    return { ok: false, message: '打款金额不能为负数' }
  }
  if (paymentSyncStatus === 'PARTIAL' && (!paymentAmount || paymentAmount <= 0)) {
    return { ok: false, message: '部分打款必须填写打款金额且大于 0' }
  }

  const timestamp = nowTimestamp()
  batch.paymentSyncStatus = paymentSyncStatus
  batch.paymentAmount = paymentAmount
  batch.paymentAt = paymentAt
  batch.paymentReferenceNo = paymentReferenceNo
  batch.paymentRemark = paymentRemark
  batch.paymentUpdatedAt = timestamp
  batch.paymentUpdatedBy = by
  batch.updatedAt = timestamp
  batch.updatedBy = by
  return { ok: true }
}

function openDialog(batchId: string): void {
  const completedBatches = getCompletedBatches()
  const batch = completedBatches.find((item) => item.batchId === batchId)
  state.activeBatchId = batchId
  state.form = {
    paymentSyncStatus: (batch?.paymentSyncStatus as SyncForm['paymentSyncStatus']) ?? '',
    paymentAmount: batch?.paymentAmount !== undefined ? String(batch.paymentAmount) : '',
    paymentAt: batch?.paymentAt ?? '',
    paymentReferenceNo: batch?.paymentReferenceNo ?? '',
    paymentRemark: batch?.paymentRemark ?? '',
  }
  state.formError = ''
  state.dialogOpen = true
}

function closeDialog(): void {
  state.dialogOpen = false
  state.activeBatchId = ''
  state.form = { ...EMPTY_FORM }
  state.formError = ''
  state.saving = false
}

function handleSave(): void {
  if (!state.form.paymentSyncStatus) {
    state.formError = '请选择同步状态'
    return
  }
  if (
    state.form.paymentSyncStatus === 'PARTIAL' &&
    (!state.form.paymentAmount || Number(state.form.paymentAmount) <= 0)
  ) {
    state.formError = '部分打款必须填写大于 0 的打款金额'
    return
  }
  if (state.form.paymentAmount && Number(state.form.paymentAmount) < 0) {
    state.formError = '打款金额不能为负数'
    return
  }

  state.formError = ''
  state.saving = true
  const result = syncSettlementPaymentResult(
    {
      batchId: state.activeBatchId,
      paymentSyncStatus: state.form.paymentSyncStatus,
      paymentAmount: state.form.paymentAmount ? Number(state.form.paymentAmount) : undefined,
      paymentAt: state.form.paymentAt || undefined,
      paymentReferenceNo: state.form.paymentReferenceNo || undefined,
      paymentRemark: state.form.paymentRemark || undefined,
    },
    '管理员',
  )
  state.saving = false

  if (!result.ok) {
    state.formError = result.message ?? '同步失败'
    return
  }

  closeDialog()
  showPaymentSyncToast('打款结果已同步更新')
}

function renderDialog(): string {
  if (!state.dialogOpen) return ''
  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-pay-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-pay-action="close-dialog" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>
        <header class="mb-3">
          <h3 class="text-lg font-semibold">同步打款结果</h3>
        </header>

        <div class="flex flex-col gap-4 py-2">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">同步状态 <span class="text-red-600">*</span></label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pay-field="paymentSyncStatus">
              <option value="" ${state.form.paymentSyncStatus === '' ? 'selected' : ''}>请选择同步状态</option>
              <option value="SUCCESS" ${state.form.paymentSyncStatus === 'SUCCESS' ? 'selected' : ''}>打款成功</option>
              <option value="FAILED" ${state.form.paymentSyncStatus === 'FAILED' ? 'selected' : ''}>打款失败</option>
              <option value="PARTIAL" ${state.form.paymentSyncStatus === 'PARTIAL' ? 'selected' : ''}>部分打款</option>
            </select>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">
              打款金额${state.form.paymentSyncStatus === 'PARTIAL' ? ' <span class="text-red-600">*</span>' : ''}
            </label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              type="number"
              min="0"
              placeholder="请输入打款金额"
              data-pay-field="paymentAmount"
              value="${escapeHtml(state.form.paymentAmount)}"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">打款时间</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="例：2026-03-10 15:30:00"
              data-pay-field="paymentAt"
              value="${escapeHtml(state.form.paymentAt)}"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">打款参考号</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="银行流水号或参考号"
              data-pay-field="paymentReferenceNo"
              value="${escapeHtml(state.form.paymentReferenceNo)}"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">备注</label>
            <textarea
              rows="2"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="可选备注"
              data-pay-field="paymentRemark"
            >${escapeHtml(state.form.paymentRemark)}</textarea>
          </div>

          ${
            state.formError
              ? `<p class="text-sm text-red-600">${escapeHtml(state.formError)}</p>`
              : ''
          }
        </div>

        <footer class="mt-2 flex justify-end gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-pay-action="close-dialog">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            state.saving ? 'pointer-events-none opacity-50' : ''
          }" data-pay-action="save-dialog">保存</button>
        </footer>
      </section>
    </div>
  `
}

export function renderPaymentSyncPage(): string {
  const completedBatches = getCompletedBatches()
  const filtered = getFilteredBatches(completedBatches)
  const stats = getStats(completedBatches)

  return `
    <div class="flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold tracking-tight">打款结果同步更新</h1>
        <span class="text-sm text-muted-foreground">共 ${completedBatches.length} 条</span>
      </div>

      <section class="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
        打款结果同步更新用于记录已完成结算批次的支付结果；原型阶段仅做结果登记与回看，不接真实支付系统
      </section>

      <section class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">未同步数</p>
            <p class="text-2xl font-bold tabular-nums">${stats.unsynced}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">打款成功数</p>
            <p class="text-2xl font-bold tabular-nums">${stats.success}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">打款失败数</p>
            <p class="text-2xl font-bold tabular-nums">${stats.failed}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">部分打款数</p>
            <p class="text-2xl font-bold tabular-nums">${stats.partial}</p>
          </div>
        </article>
      </section>

      <section class="flex flex-wrap items-center gap-3">
        <input
          class="h-9 w-64 rounded-md border bg-background px-3 text-sm"
          placeholder="关键词（批次号 / 名称 / 参考号 / 备注）"
          data-pay-filter="keyword"
          value="${escapeHtml(state.keyword)}"
        />
        <select class="h-9 w-36 rounded-md border bg-background px-3 text-sm" data-pay-filter="status">
          <option value="ALL" ${state.statusFilter === 'ALL' ? 'selected' : ''}>全部</option>
          <option value="UNSYNCED" ${state.statusFilter === 'UNSYNCED' ? 'selected' : ''}>未同步</option>
          <option value="SUCCESS" ${state.statusFilter === 'SUCCESS' ? 'selected' : ''}>打款成功</option>
          <option value="FAILED" ${state.statusFilter === 'FAILED' ? 'selected' : ''}>打款失败</option>
          <option value="PARTIAL" ${state.statusFilter === 'PARTIAL' ? 'selected' : ''}>部分打款</option>
        </select>
      </section>

      <section class="overflow-x-auto rounded-md border">
        <table class="w-full min-w-[1480px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="px-4 py-2 font-medium">批次号</th>
              <th class="px-4 py-2 font-medium">批次名称</th>
              <th class="px-4 py-2 text-center font-medium">对账单数</th>
              <th class="px-4 py-2 font-medium">总金额</th>
              <th class="px-4 py-2 font-medium">同步状态</th>
              <th class="px-4 py-2 font-medium">打款金额</th>
              <th class="px-4 py-2 font-medium">打款时间</th>
              <th class="px-4 py-2 font-medium">打款参考号</th>
              <th class="px-4 py-2 font-medium">更新时间</th>
              <th class="px-4 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              filtered.length === 0
                ? `
                  <tr>
                    <td colspan="10" class="py-10 text-center text-sm text-muted-foreground">
                      暂无可同步打款结果的结算批次
                    </td>
                  </tr>
                `
                : filtered
                    .map((batch) => {
                      const syncStatus: PaymentSyncStatus = batch.paymentSyncStatus ?? 'UNSYNCED'
                      const statementCount = batch.statementIds?.length ?? batch.itemCount ?? 0
                      return `
                        <tr class="border-b last:border-b-0">
                          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(batch.batchId)}</td>
                          <td class="px-4 py-3 text-sm">${escapeHtml(batch.batchName ?? '—')}</td>
                          <td class="px-4 py-3 text-center">${statementCount}</td>
                          <td class="px-4 py-3">${batch.totalAmount !== undefined ? `¥ ${batch.totalAmount.toLocaleString()}` : '—'}</td>
                          <td class="px-4 py-3">
                            <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${SYNC_STATUS_BADGE[syncStatus]}">
                              ${SYNC_STATUS_LABEL[syncStatus]}
                            </span>
                          </td>
                          <td class="px-4 py-3">${batch.paymentAmount !== undefined ? `¥ ${batch.paymentAmount.toLocaleString()}` : '—'}</td>
                          <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(batch.paymentAt ?? '—')}</td>
                          <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(batch.paymentReferenceNo ?? '—')}</td>
                          <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(batch.paymentUpdatedAt ?? batch.updatedAt ?? batch.createdAt)}</td>
                          <td class="px-4 py-3">
                            <div class="flex flex-wrap gap-1">
                              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pay-action="open-dialog" data-batch-id="${escapeHtml(batch.batchId)}">同步结果</button>
                              <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/settlement/batches">查看批次</button>
                              <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/settlement/history">查看历史</button>
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </section>

      ${renderDialog()}
    </div>
  `
}

export function handlePaymentSyncEvent(target: HTMLElement): boolean {
  const filterNode = target.closest<HTMLElement>('[data-pay-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const field = filterNode.dataset.payFilter
    if (field === 'keyword') {
      state.keyword = filterNode.value
      return true
    }
    if (field === 'status') {
      state.statusFilter = filterNode.value as PaymentSyncStatus | 'ALL'
      return true
    }
    return true
  }

  const formNode = target.closest<HTMLElement>('[data-pay-field]')
  if (
    formNode instanceof HTMLInputElement ||
    formNode instanceof HTMLSelectElement ||
    formNode instanceof HTMLTextAreaElement
  ) {
    const field = formNode.dataset.payField
    if (!field) return true

    if (field === 'paymentSyncStatus') {
      state.form.paymentSyncStatus = formNode.value as SyncForm['paymentSyncStatus']
      return true
    }
    if (field === 'paymentAmount') {
      state.form.paymentAmount = formNode.value
      return true
    }
    if (field === 'paymentAt') {
      state.form.paymentAt = formNode.value
      return true
    }
    if (field === 'paymentReferenceNo') {
      state.form.paymentReferenceNo = formNode.value
      return true
    }
    if (field === 'paymentRemark') {
      state.form.paymentRemark = formNode.value
      return true
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pay-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.payAction
  if (!action) return false

  if (action === 'open-dialog') {
    const batchId = actionNode.dataset.batchId
    if (batchId) openDialog(batchId)
    return true
  }

  if (action === 'close-dialog') {
    closeDialog()
    return true
  }

  if (action === 'save-dialog') {
    handleSave()
    return true
  }

  return true
}

export function isPaymentSyncDialogOpen(): boolean {
  return state.dialogOpen
}
