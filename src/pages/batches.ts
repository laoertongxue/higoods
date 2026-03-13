import {
  initialSettlementBatches,
  initialStatementDrafts,
} from '../data/fcs/store-domain-settlement-seeds'
import type {
  SettlementBatch,
  SettlementBatchItem,
  SettlementBatchStatus,
  StatementDraft,
  StatementStatus,
} from '../data/fcs/store-domain-settlement-types'
import { escapeHtml } from '../utils'

type PoolPartyFilter = '__all__' | string
type BatchStatusFilter = '__all__' | SettlementBatchStatus

interface BatchesState {
  poolKeyword: string
  poolParty: PoolPartyFilter
  batchKeyword: string
  batchStatus: BatchStatusFilter
  selected: Set<string>
  batchName: string
  remark: string
  detailBatchId: string | null
}

const PARTY_LABEL: Record<string, string> = {
  FACTORY: '工厂',
  PROCESSOR: '加工方',
  SUPPLIER: '供应商',
  GROUP_INTERNAL: '内部主体',
  INTERNAL: '内部主体',
  OTHER: '其他',
}

const BATCH_STATUS_LABEL: Record<SettlementBatchStatus, string> = {
  PENDING: '待提交',
  PROCESSING: '处理中',
  COMPLETED: '已完成',
}

const BATCH_STATUS_BADGE: Record<SettlementBatchStatus, string> = {
  PENDING: 'border border-slate-200 bg-slate-50 text-slate-700',
  PROCESSING: 'border border-blue-200 bg-blue-50 text-blue-700',
  COMPLETED: 'border border-green-200 bg-green-50 text-green-700',
}

const state: BatchesState = {
  poolKeyword: '',
  poolParty: '__all__',
  batchKeyword: '',
  batchStatus: '__all__',
  selected: new Set<string>(),
  batchName: '',
  remark: '',
  detailBatchId: null,
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function randomSuffix(length = 4): string {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase()
}

function showBatchesToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'batches-toast-root'
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

function partyLabel(type: string, id: string): string {
  return `${PARTY_LABEL[type] ?? type} / ${id}`
}

function getOccupiedStatementIds(): Set<string> {
  return new Set(
    initialSettlementBatches
      .filter((item) => item.status !== 'COMPLETED')
      .flatMap((item) => item.statementIds),
  )
}

function getCandidateStatements(): StatementDraft[] {
  const occupiedIds = getOccupiedStatementIds()
  return initialStatementDrafts.filter(
    (item) => item.status === 'CONFIRMED' && !occupiedIds.has(item.statementId),
  )
}

function getPartyOptions(
  candidates: StatementDraft[],
): Array<{ key: string; label: string }> {
  const seen = new Map<string, string>()
  for (const item of candidates) {
    const key = `${item.settlementPartyType}|${item.settlementPartyId}`
    if (!seen.has(key)) {
      seen.set(key, partyLabel(item.settlementPartyType, item.settlementPartyId))
    }
  }
  return Array.from(seen.entries()).map(([key, label]) => ({ key, label }))
}

function getFilteredPool(candidates: StatementDraft[]): StatementDraft[] {
  const keyword = state.poolKeyword.trim().toLowerCase()

  return candidates.filter((item) => {
    if (keyword) {
      const matched =
        item.statementId.toLowerCase().includes(keyword) ||
        item.settlementPartyId.toLowerCase().includes(keyword) ||
        (item.remark ?? '').toLowerCase().includes(keyword)
      if (!matched) return false
    }

    if (state.poolParty !== '__all__') {
      const key = `${item.settlementPartyType}|${item.settlementPartyId}`
      if (key !== state.poolParty) return false
    }

    return true
  })
}

function getFilteredBatches(): SettlementBatch[] {
  const keyword = state.batchKeyword.trim().toLowerCase()
  return initialSettlementBatches
    .filter((item) => {
      if (keyword) {
        const matched =
          item.batchId.toLowerCase().includes(keyword) ||
          (item.batchName ?? '').toLowerCase().includes(keyword) ||
          (item.remark ?? '').toLowerCase().includes(keyword)
        if (!matched) return false
      }

      if (state.batchStatus !== '__all__' && item.status !== state.batchStatus) return false
      return true
    })
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function getStats(): {
  total: number
  pending: number
  processing: number
  completed: number
} {
  return {
    total: initialSettlementBatches.length,
    pending: initialSettlementBatches.filter((item) => item.status === 'PENDING').length,
    processing: initialSettlementBatches.filter((item) => item.status === 'PROCESSING').length,
    completed: initialSettlementBatches.filter((item) => item.status === 'COMPLETED').length,
  }
}

function getSelectedAmount(candidates: StatementDraft[]): number {
  return Array.from(state.selected).reduce((sum, statementId) => {
    const statement = candidates.find((item) => item.statementId === statementId)
    return sum + (statement?.totalAmount ?? 0)
  }, 0)
}

function createSettlementBatch(
  input: { statementIds: string[]; remark?: string; batchName?: string },
  by: string,
): { ok: boolean; batchId?: string; message?: string } {
  const { statementIds, remark, batchName } = input
  if (!statementIds.length) return { ok: false, message: '请至少选择一张对账单' }

  for (const statementId of statementIds) {
    const statement = initialStatementDrafts.find((item) => item.statementId === statementId)
    if (!statement) return { ok: false, message: `对账单 ${statementId} 不存在` }
    if (statement.status !== 'CONFIRMED') {
      return { ok: false, message: `对账单 ${statementId} 状态不是已确认，不可纳入结算批次` }
    }
  }

  const occupiedIds = getOccupiedStatementIds()
  if (statementIds.some((statementId) => occupiedIds.has(statementId))) {
    return { ok: false, message: '存在已纳入未完成结算批次的对账单' }
  }

  const timestamp = nowTimestamp()
  const month = timestamp.slice(0, 7).replace('-', '')
  let batchId = `SB-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
  while (initialSettlementBatches.some((item) => item.batchId === batchId)) {
    batchId = `SB-${month}-${randomSuffix(4)}`
  }

  const items: SettlementBatchItem[] = statementIds.map((statementId) => {
    const statement = initialStatementDrafts.find((item) => item.statementId === statementId)!
    return {
      statementId,
      settlementPartyType: statement.settlementPartyType,
      settlementPartyId: statement.settlementPartyId,
      totalAmount: statement.totalAmount,
    }
  })

  const batch: SettlementBatch = {
    batchId,
    batchName,
    itemCount: items.length,
    totalAmount: items.reduce((sum, item) => sum + item.totalAmount, 0),
    status: 'PENDING',
    statementIds,
    items,
    remark,
    createdAt: timestamp,
    createdBy: by,
  }

  initialSettlementBatches.push(batch)
  return { ok: true, batchId }
}

function startSettlementBatch(batchId: string, by: string): { ok: boolean; message?: string } {
  const batch = initialSettlementBatches.find((item) => item.batchId === batchId)
  if (!batch) return { ok: false, message: `结算批次 ${batchId} 不存在` }
  if (batch.status === 'PROCESSING') return { ok: true }
  if (batch.status === 'COMPLETED') return { ok: false, message: '已完成的结算批次不可重新开始' }

  batch.status = 'PROCESSING'
  batch.updatedAt = nowTimestamp()
  batch.updatedBy = by
  return { ok: true }
}

function completeSettlementBatch(batchId: string, by: string): { ok: boolean; message?: string } {
  const batch = initialSettlementBatches.find((item) => item.batchId === batchId)
  if (!batch) return { ok: false, message: `结算批次 ${batchId} 不存在` }
  if (batch.status === 'COMPLETED') return { ok: true }

  const timestamp = nowTimestamp()
  batch.status = 'COMPLETED'
  batch.updatedAt = timestamp
  batch.updatedBy = by

  for (const statementId of batch.statementIds) {
    const statement = initialStatementDrafts.find((item) => item.statementId === statementId)
    if (!statement) continue
    statement.status = 'CLOSED' as StatementStatus
    statement.updatedAt = timestamp
    statement.updatedBy = by
  }

  return { ok: true }
}

function getDetailBatch(): SettlementBatch | null {
  if (!state.detailBatchId) return null
  return initialSettlementBatches.find((item) => item.batchId === state.detailBatchId) ?? null
}

function renderStatsCard(label: string, value: number): string {
  return `
    <article class="rounded-lg border bg-card">
      <div class="px-4 pb-3 pt-3">
        <p class="text-xs font-normal text-muted-foreground">${escapeHtml(label)}</p>
        <p class="text-2xl font-semibold tabular-nums">${value}</p>
      </div>
    </article>
  `
}

function renderDetailDialog(detailBatch: SettlementBatch | null): string {
  if (!detailBatch) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-batch-action="close-detail" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-batch-action="close-detail" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <header class="mb-3">
          <h3 class="text-lg font-semibold">
            批次详情 — ${escapeHtml(detailBatch.batchId)}${detailBatch.batchName ? ` (${escapeHtml(detailBatch.batchName)})` : ''}
          </h3>
        </header>

        <p class="mb-2 text-xs text-muted-foreground">
          状态：${escapeHtml(BATCH_STATUS_LABEL[detailBatch.status])}
          &nbsp;&nbsp;对账单数：${detailBatch.itemCount}
          &nbsp;&nbsp;总金额：¥${detailBatch.totalAmount.toLocaleString()}
        </p>

        <div class="overflow-x-auto rounded-md border">
          <table class="w-full min-w-[760px] text-sm">
            <thead>
              <tr class="border-b bg-muted/40 text-left">
                <th class="px-4 py-2 font-medium">对账单号</th>
                <th class="px-4 py-2 font-medium">结算对象</th>
                <th class="px-4 py-2 text-right font-medium">金额</th>
                <th class="px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${detailBatch.items
                .map(
                  (item) => `
                    <tr class="border-b last:border-b-0">
                      <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.statementId)}</td>
                      <td class="px-4 py-3 text-sm">${escapeHtml(
                        partyLabel(item.settlementPartyType, item.settlementPartyId),
                      )}</td>
                      <td class="px-4 py-3 text-right">¥${item.totalAmount.toLocaleString()}</td>
                      <td class="px-4 py-3">
                        <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/settlement/statements">查看对账单</button>
                      </td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>

        ${
          detailBatch.remark
            ? `<p class="mt-2 text-xs text-muted-foreground">备注：${escapeHtml(detailBatch.remark)}</p>`
            : ''
        }
      </section>
    </div>
  `
}

export function renderBatchesPage(): string {
  const candidates = getCandidateStatements()
  const partyOptions = getPartyOptions(candidates)
  const filteredPool = getFilteredPool(candidates)
  const filteredBatches = getFilteredBatches()
  const stats = getStats()
  const selectedAmount = getSelectedAmount(candidates)
  const detailBatch = getDetailBatch()

  const allSelected =
    filteredPool.length > 0 &&
    filteredPool.every((item) => state.selected.has(item.statementId))

  return `
    <div class="flex flex-col gap-6 p-6">
      <h1 class="text-xl font-semibold">结算批次进度</h1>

      <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        ${renderStatsCard('批次总数', stats.total)}
        ${renderStatsCard('待提交', stats.pending)}
        ${renderStatsCard('处理中', stats.processing)}
        ${renderStatsCard('已完成', stats.completed)}
      </section>

      <section class="space-y-3">
        <h2 class="text-base font-medium">候选对账单池</h2>

        <div class="flex flex-wrap gap-2">
          <input
            class="h-9 w-48 rounded-md border bg-background px-3 text-sm"
            data-batch-field="poolKeyword"
            placeholder="搜索对账单号/结算对象/备注"
            value="${escapeHtml(state.poolKeyword)}"
          />
          <select class="h-9 w-52 rounded-md border bg-background px-3 text-sm" data-batch-field="poolParty">
            <option value="__all__" ${state.poolParty === '__all__' ? 'selected' : ''}>全部对象</option>
            ${partyOptions
              .map(
                (item) =>
                  `<option value="${escapeHtml(item.key)}" ${state.poolParty === item.key ? 'selected' : ''}>${escapeHtml(item.label)}</option>`,
              )
              .join('')}
          </select>
        </div>

        ${
          state.selected.size > 0
            ? `
              <div class="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
                <div class="text-sm text-muted-foreground">
                  已选数量：<span class="font-medium text-foreground">${state.selected.size}</span>
                  &nbsp;&nbsp;合计金额：<span class="font-medium text-foreground">¥${selectedAmount.toLocaleString()}</span>
                </div>
                <div class="flex flex-1 flex-wrap items-end gap-2">
                  <div class="space-y-1">
                    <label class="text-xs text-muted-foreground">批次名称</label>
                    <input
                      class="h-8 w-44 rounded-md border bg-background px-2 text-sm"
                      data-batch-field="batchName"
                      placeholder="可选"
                      value="${escapeHtml(state.batchName)}"
                    />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs text-muted-foreground">备注</label>
                    <input
                      class="h-8 w-44 rounded-md border bg-background px-2 text-sm"
                      data-batch-field="remark"
                      placeholder="可选"
                      value="${escapeHtml(state.remark)}"
                    />
                  </div>
                  <button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-batch-action="create-batch">创建结算批次</button>
                </div>
              </div>
            `
            : ''
        }

        ${
          filteredPool.length === 0
            ? `
              <p class="py-8 text-center text-sm text-muted-foreground">暂无可纳入批次的对账单</p>
            `
            : `
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full min-w-[1200px] text-sm">
                  <thead>
                    <tr class="border-b bg-muted/40 text-left">
                      <th class="w-10 px-4 py-2">
                        <input
                          type="checkbox"
                          class="h-4 w-4 rounded border-border align-middle"
                          data-batch-action="toggle-select-all"
                          ${allSelected ? 'checked' : ''}
                        />
                      </th>
                      <th class="px-4 py-2 font-medium">对账单号</th>
                      <th class="px-4 py-2 font-medium">结算对象</th>
                      <th class="px-4 py-2 text-right font-medium">条目数</th>
                      <th class="px-4 py-2 text-right font-medium">总数量</th>
                      <th class="px-4 py-2 text-right font-medium">总金额</th>
                      <th class="px-4 py-2 font-medium">状态</th>
                      <th class="px-4 py-2 font-medium">更新时间</th>
                      <th class="px-4 py-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredPool
                      .map(
                        (item) => `
                          <tr class="border-b last:border-b-0">
                            <td class="px-4 py-3">
                              <input
                                type="checkbox"
                                class="h-4 w-4 rounded border-border align-middle"
                                data-batch-action="toggle-select"
                                data-statement-id="${escapeHtml(item.statementId)}"
                                ${state.selected.has(item.statementId) ? 'checked' : ''}
                              />
                            </td>
                            <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.statementId)}</td>
                            <td class="px-4 py-3 text-sm">${escapeHtml(
                              partyLabel(item.settlementPartyType, item.settlementPartyId),
                            )}</td>
                            <td class="px-4 py-3 text-right tabular-nums">${item.itemCount}</td>
                            <td class="px-4 py-3 text-right tabular-nums">${item.totalQty}</td>
                            <td class="px-4 py-3 text-right tabular-nums">¥${item.totalAmount.toLocaleString()}</td>
                            <td class="px-4 py-3">
                              <span class="inline-flex rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">已确认</span>
                            </td>
                            <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.updatedAt ?? item.createdAt)}</td>
                            <td class="px-4 py-3">
                              <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/settlement/statements">查看对账单</button>
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

      <section class="space-y-3">
        <h2 class="text-base font-medium">结算批次列表</h2>

        <div class="flex flex-wrap gap-2">
          <input
            class="h-9 w-48 rounded-md border bg-background px-3 text-sm"
            data-batch-field="batchKeyword"
            placeholder="搜索批次号/名称/备注"
            value="${escapeHtml(state.batchKeyword)}"
          />
          <select class="h-9 w-36 rounded-md border bg-background px-3 text-sm" data-batch-field="batchStatus">
            <option value="__all__" ${state.batchStatus === '__all__' ? 'selected' : ''}>全部状态</option>
            <option value="PENDING" ${state.batchStatus === 'PENDING' ? 'selected' : ''}>待提交</option>
            <option value="PROCESSING" ${state.batchStatus === 'PROCESSING' ? 'selected' : ''}>处理中</option>
            <option value="COMPLETED" ${state.batchStatus === 'COMPLETED' ? 'selected' : ''}>已完成</option>
          </select>
        </div>

        ${
          filteredBatches.length === 0
            ? `
              <p class="py-8 text-center text-sm text-muted-foreground">暂无结算批次</p>
            `
            : `
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr class="border-b bg-muted/40 text-left">
                      <th class="px-4 py-2 font-medium">批次号</th>
                      <th class="px-4 py-2 font-medium">批次名称</th>
                      <th class="px-4 py-2 text-right font-medium">对账单数</th>
                      <th class="px-4 py-2 text-right font-medium">总金额</th>
                      <th class="px-4 py-2 font-medium">状态</th>
                      <th class="px-4 py-2 font-medium">创建时间</th>
                      <th class="px-4 py-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredBatches
                      .map(
                        (item) => `
                          <tr class="border-b last:border-b-0">
                            <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.batchId)}</td>
                            <td class="px-4 py-3 text-sm">${escapeHtml(item.batchName ?? '—')}</td>
                            <td class="px-4 py-3 text-right tabular-nums">${item.itemCount}</td>
                            <td class="px-4 py-3 text-right tabular-nums">¥${item.totalAmount.toLocaleString()}</td>
                            <td class="px-4 py-3">
                              <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${BATCH_STATUS_BADGE[item.status]}">
                                ${BATCH_STATUS_LABEL[item.status]}
                              </span>
                            </td>
                            <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.createdAt)}</td>
                            <td class="px-4 py-3">
                              <div class="flex flex-wrap gap-1">
                                <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-batch-action="open-detail" data-batch-id="${escapeHtml(item.batchId)}">查看详情</button>
                                ${
                                  item.status === 'PENDING'
                                    ? `<button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-batch-action="start-batch" data-batch-id="${escapeHtml(item.batchId)}">开始处理</button>`
                                    : ''
                                }
                                ${
                                  item.status === 'PENDING' || item.status === 'PROCESSING'
                                    ? `<button class="inline-flex h-7 items-center rounded-md bg-blue-600 px-2 text-xs font-medium text-white hover:bg-blue-700" data-batch-action="complete-batch" data-batch-id="${escapeHtml(item.batchId)}">完成结算</button>`
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

      ${renderDetailDialog(detailBatch)}
    </div>
  `
}

export function handleBatchesEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-batch-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.batchField
    if (!field) return true

    if (field === 'poolKeyword') {
      state.poolKeyword = fieldNode.value
      return true
    }
    if (field === 'poolParty') {
      state.poolParty = fieldNode.value
      return true
    }
    if (field === 'batchKeyword') {
      state.batchKeyword = fieldNode.value
      return true
    }
    if (field === 'batchStatus') {
      state.batchStatus = fieldNode.value as BatchStatusFilter
      return true
    }
    if (field === 'batchName') {
      state.batchName = fieldNode.value
      return true
    }
    if (field === 'remark') {
      state.remark = fieldNode.value
      return true
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-batch-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.batchAction
  if (!action) return false

  if (action === 'toggle-select') {
    const statementId = actionNode.dataset.statementId
    if (!statementId) return true

    if (state.selected.has(statementId)) {
      state.selected.delete(statementId)
    } else {
      state.selected.add(statementId)
    }
    return true
  }

  if (action === 'toggle-select-all') {
    const filteredPool = getFilteredPool(getCandidateStatements())
    const allSelected =
      filteredPool.length > 0 &&
      filteredPool.every((item) => state.selected.has(item.statementId))

    if (allSelected) {
      state.selected = new Set<string>()
    } else {
      state.selected = new Set<string>(filteredPool.map((item) => item.statementId))
    }
    return true
  }

  if (action === 'create-batch') {
    if (!state.selected.size) {
      showBatchesToast('请先选择对账单', 'error')
      return true
    }

    const result = createSettlementBatch(
      {
        statementIds: Array.from(state.selected),
        batchName: state.batchName.trim() || undefined,
        remark: state.remark.trim() || undefined,
      },
      'Admin',
    )

    if (!result.ok) {
      showBatchesToast(result.message ?? '创建失败', 'error')
      return true
    }

    showBatchesToast('已创建结算批次')
    state.selected = new Set<string>()
    state.batchName = ''
    state.remark = ''
    return true
  }

  if (action === 'start-batch') {
    const batchId = actionNode.dataset.batchId
    if (!batchId) return true
    const result = startSettlementBatch(batchId, 'Admin')
    if (result.ok) showBatchesToast('结算批次已开始处理')
    else showBatchesToast(result.message ?? '操作失败', 'error')
    return true
  }

  if (action === 'complete-batch') {
    const batchId = actionNode.dataset.batchId
    if (!batchId) return true
    const result = completeSettlementBatch(batchId, 'Admin')
    if (result.ok) showBatchesToast('结算批次已完成')
    else showBatchesToast(result.message ?? '操作失败', 'error')
    return true
  }

  if (action === 'open-detail') {
    const batchId = actionNode.dataset.batchId
    if (batchId) state.detailBatchId = batchId
    return true
  }

  if (action === 'close-detail') {
    state.detailBatchId = null
    return true
  }

  return true
}

export function isBatchesDialogOpen(): boolean {
  return state.detailBatchId !== null
}
