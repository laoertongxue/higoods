import {
  initialMaterialIssueSheets,
  type MaterialIssueSheet,
  type MaterialStatementDraft,
  type MaterialStatementItem,
  type MaterialStatementStatus,
} from '../data/fcs/store-domain-dispatch-process'
import { initialMaterialStatementDrafts } from '../data/fcs/store-domain-settlement-seeds'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { escapeHtml, toClassName } from '../utils'

applyQualitySeedBootstrap()

type ActiveTab = 'pool' | 'draft'

interface MaterialStatementsState {
  activeTab: ActiveTab
  poolKeyword: string
  poolOrder: 'ALL' | string
  selected: string[]
  remark: string
  draftKeyword: string
  draftStatusFilter: 'ALL' | MaterialStatementStatus
  detailStatementId: string | null
}

const STATUS_LABEL: Record<MaterialStatementStatus, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  CLOSED: '已关闭',
}

const STATUS_BADGE_CLASS: Record<MaterialStatementStatus, string> = {
  DRAFT: 'border bg-muted text-muted-foreground',
  CONFIRMED: 'border border-blue-200 bg-blue-50 text-blue-700',
  CLOSED: 'border border-slate-200 bg-slate-50 text-slate-600',
}

const ISSUE_STATUS_LABEL: Record<string, string> = {
  PARTIAL: '部分下发',
  ISSUED: '已下发',
}

const state: MaterialStatementsState = {
  activeTab: 'pool',
  poolKeyword: '',
  poolOrder: 'ALL',
  selected: [],
  remark: '',
  draftKeyword: '',
  draftStatusFilter: 'ALL',
  detailStatementId: null,
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function randomSuffix(length = 4): string {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase()
}

function showMaterialStatementsToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'material-statements-toast-root'
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

function getOccupiedIssueIds(): Set<string> {
  const set = new Set<string>()
  for (const draft of initialMaterialStatementDrafts) {
    if (draft.status !== 'CLOSED') {
      draft.issueIds.forEach((issueId) => set.add(issueId))
    }
  }
  return set
}

function getPoolIssues(): MaterialIssueSheet[] {
  const occupiedIds = getOccupiedIssueIds()
  return initialMaterialIssueSheets.filter(
    (issue) =>
      (issue.status === 'PARTIAL' || issue.status === 'ISSUED') &&
      !!issue.productionOrderId &&
      !occupiedIds.has(issue.issueId),
  )
}

function getPoolOrderOptions(poolIssues: MaterialIssueSheet[]): string[] {
  return Array.from(new Set(poolIssues.map((issue) => issue.productionOrderId!).filter(Boolean))).sort()
}

function getFilteredPool(poolIssues: MaterialIssueSheet[]): MaterialIssueSheet[] {
  const keyword = state.poolKeyword.trim().toLowerCase()
  return poolIssues.filter((issue) => {
    const matchKeyword =
      !keyword ||
      issue.issueId.toLowerCase().includes(keyword) ||
      (issue.productionOrderId ?? '').toLowerCase().includes(keyword) ||
      issue.taskId.toLowerCase().includes(keyword) ||
      issue.materialSummaryZh.toLowerCase().includes(keyword)

    const matchOrder = state.poolOrder === 'ALL' || issue.productionOrderId === state.poolOrder
    return matchKeyword && matchOrder
  })
}

function getSelectedOrder(): string | null {
  if (state.selected.length === 0) return null
  const firstIssue = initialMaterialIssueSheets.find((issue) => issue.issueId === state.selected[0])
  return firstIssue?.productionOrderId ?? null
}

function getSelectedTotalRequested(): number {
  return state.selected.reduce((sum, issueId) => {
    const issue = initialMaterialIssueSheets.find((item) => item.issueId === issueId)
    return sum + (issue?.requestedQty ?? 0)
  }, 0)
}

function getSelectedTotalIssued(): number {
  return state.selected.reduce((sum, issueId) => {
    const issue = initialMaterialIssueSheets.find((item) => item.issueId === issueId)
    return sum + (issue?.issuedQty ?? 0)
  }, 0)
}

function generateMaterialStatementDraft(
  input: { productionOrderId: string; issueIds: string[]; remark?: string },
  by: string,
): { ok: boolean; materialStatementId?: string; message?: string } {
  const { productionOrderId, issueIds, remark } = input
  if (!productionOrderId.trim()) return { ok: false, message: '生产单号不能为空' }
  if (!issueIds.length) return { ok: false, message: '至少选择一条领料需求' }

  for (const issueId of issueIds) {
    const issue = initialMaterialIssueSheets.find((item) => item.issueId === issueId)
    if (!issue) return { ok: false, message: `领料需求 ${issueId} 不存在` }
    if (issue.productionOrderId !== productionOrderId) {
      return { ok: false, message: `领料需求 ${issueId} 不属于生产单 ${productionOrderId}` }
    }
    if (issue.status !== 'PARTIAL' && issue.status !== 'ISSUED') {
      return { ok: false, message: `领料需求 ${issueId} 状态不符，仅允许部分下发或已下发` }
    }
  }

  const occupiedIds = getOccupiedIssueIds()
  for (const issueId of issueIds) {
    if (occupiedIds.has(issueId)) {
      return { ok: false, message: '存在已纳入未关闭领料对账单的领料需求' }
    }
  }

  const timestamp = nowTimestamp()
  const month = timestamp.slice(0, 7).replace('-', '')
  let materialStatementId = `MST-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
  while (
    initialMaterialStatementDrafts.some(
      (draft) => draft.materialStatementId === materialStatementId,
    )
  ) {
    materialStatementId = `MST-${month}-${randomSuffix(4)}`
  }

  const items: MaterialStatementItem[] = issueIds.map((issueId) => {
    const issue = initialMaterialIssueSheets.find((item) => item.issueId === issueId)!
    return {
      issueId: issue.issueId,
      taskId: issue.taskId,
      materialSummaryZh: issue.materialSummaryZh,
      requestedQty: issue.requestedQty,
      issuedQty: issue.issuedQty,
    }
  })

  const draft: MaterialStatementDraft = {
    materialStatementId,
    productionOrderId,
    itemCount: items.length,
    totalRequestedQty: items.reduce((sum, item) => sum + item.requestedQty, 0),
    totalIssuedQty: items.reduce((sum, item) => sum + item.issuedQty, 0),
    status: 'DRAFT',
    issueIds,
    items,
    remark,
    createdAt: timestamp,
    createdBy: by,
  }
  initialMaterialStatementDrafts.push(draft)
  return { ok: true, materialStatementId }
}

function confirmMaterialStatementDraft(
  materialStatementId: string,
  by: string,
): { ok: boolean; message?: string } {
  const draft = initialMaterialStatementDrafts.find(
    (item) => item.materialStatementId === materialStatementId,
  )
  if (!draft) return { ok: false, message: `领料对账单 ${materialStatementId} 不存在` }
  if (draft.status === 'CONFIRMED') return { ok: true }
  if (draft.status === 'CLOSED') return { ok: false, message: '已关闭的领料对账单不允许确认' }
  draft.status = 'CONFIRMED'
  draft.updatedAt = nowTimestamp()
  draft.updatedBy = by
  return { ok: true }
}

function closeMaterialStatementDraft(
  materialStatementId: string,
  by: string,
): { ok: boolean; message?: string } {
  const draft = initialMaterialStatementDrafts.find(
    (item) => item.materialStatementId === materialStatementId,
  )
  if (!draft) return { ok: false, message: `领料对账单 ${materialStatementId} 不存在` }
  if (draft.status === 'CLOSED') return { ok: true }
  draft.status = 'CLOSED'
  draft.updatedAt = nowTimestamp()
  draft.updatedBy = by
  return { ok: true }
}

function getFilteredDrafts(): MaterialStatementDraft[] {
  const keyword = state.draftKeyword.trim().toLowerCase()
  return initialMaterialStatementDrafts.filter((draft) => {
    const matchKeyword =
      !keyword ||
      draft.materialStatementId.toLowerCase().includes(keyword) ||
      draft.productionOrderId.toLowerCase().includes(keyword) ||
      (draft.remark ?? '').toLowerCase().includes(keyword)
    const matchStatus =
      state.draftStatusFilter === 'ALL' || draft.status === state.draftStatusFilter
    return matchKeyword && matchStatus
  })
}

function getDetailDraft(): MaterialStatementDraft | null {
  if (!state.detailStatementId) return null
  return (
    initialMaterialStatementDrafts.find(
      (draft) => draft.materialStatementId === state.detailStatementId,
    ) ?? null
  )
}

function renderDetailDialog(detailDraft: MaterialStatementDraft | null): string {
  if (!detailDraft) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-mst-action="close-detail" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-mst-action="close-detail" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <header class="mb-3">
          <h3 class="text-lg font-semibold">领料明细 — ${escapeHtml(detailDraft.materialStatementId)}</h3>
        </header>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[880px] text-sm">
            <thead>
              <tr class="border-b bg-muted/40 text-left">
                <th class="px-4 py-2 font-medium">领料单号</th>
                <th class="px-4 py-2 font-medium">任务ID</th>
                <th class="px-4 py-2 font-medium">用料摘要</th>
                <th class="px-4 py-2 text-center font-medium">需求数量</th>
                <th class="px-4 py-2 text-center font-medium">已下发数量</th>
                <th class="px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${detailDraft.items
                .map(
                  (item) => `
                    <tr class="border-b last:border-b-0">
                      <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.issueId)}</td>
                      <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.taskId)}</td>
                      <td class="max-w-[160px] truncate px-4 py-3 text-sm" title="${escapeHtml(item.materialSummaryZh)}">${escapeHtml(item.materialSummaryZh)}</td>
                      <td class="px-4 py-3 text-center">${item.requestedQty}</td>
                      <td class="px-4 py-3 text-center">${item.issuedQty}</td>
                      <td class="px-4 py-3">
                        <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/process/material-issue">查看领料需求</button>
                      </td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>

        <footer class="mt-4 flex justify-end">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-mst-action="close-detail">关闭</button>
        </footer>
      </section>
    </div>
  `
}

export function renderMaterialStatementsPage(): string {
  const poolIssues = getPoolIssues()
  const stats = {
    pool: poolIssues.length,
    draft: initialMaterialStatementDrafts.filter((draft) => draft.status === 'DRAFT').length,
    confirmed: initialMaterialStatementDrafts.filter((draft) => draft.status === 'CONFIRMED').length,
    closed: initialMaterialStatementDrafts.filter((draft) => draft.status === 'CLOSED').length,
  }

  const orderOptions = getPoolOrderOptions(poolIssues)
  const filteredPool = getFilteredPool(poolIssues)
  const selectedOrder = getSelectedOrder()
  const selectedTotalRequested = getSelectedTotalRequested()
  const selectedTotalIssued = getSelectedTotalIssued()
  const filteredDrafts = getFilteredDrafts()
  const detailDraft = getDetailDraft()

  return `
    <div class="flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold">领料对账单生成</h1>
      </div>

      <section class="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
        领料对账单生成用于汇总已下发的领料需求；原型阶段仅做数量口径的对账单草稿管理，不联动仓储与财务系统
      </section>

      <section class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">可对账领料需求数</p>
            <p class="text-2xl font-bold tabular-nums">${stats.pool}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">领料对账单草稿数</p>
            <p class="text-2xl font-bold tabular-nums">${stats.draft}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">已确认领料对账单数</p>
            <p class="text-2xl font-bold tabular-nums">${stats.confirmed}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">已关闭领料对账单数</p>
            <p class="text-2xl font-bold tabular-nums">${stats.closed}</p>
          </div>
        </article>
      </section>

      <section>
        <div class="inline-flex rounded-md bg-muted p-1">
          <button
            class="${toClassName(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              state.activeTab === 'pool'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}"
            data-mst-tab="pool"
          >
            候选领料需求
          </button>
          <button
            class="${toClassName(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              state.activeTab === 'draft'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}"
            data-mst-tab="draft"
          >
            领料对账单草稿
          </button>
        </div>
      </section>

      ${
        state.activeTab === 'pool'
          ? `
            <section class="flex flex-wrap gap-3">
              <input
                class="h-9 w-64 rounded-md border bg-background px-3 text-sm"
                placeholder="关键词（单号 / 任务 / 摘要）"
                data-mst-pool-filter="keyword"
                value="${escapeHtml(state.poolKeyword)}"
              />
              <select class="h-9 w-48 rounded-md border bg-background px-3 text-sm" data-mst-pool-filter="order">
                <option value="ALL" ${state.poolOrder === 'ALL' ? 'selected' : ''}>全部生产单</option>
                ${orderOptions
                  .map(
                    (orderId) =>
                      `<option value="${escapeHtml(orderId)}" ${state.poolOrder === orderId ? 'selected' : ''}>${escapeHtml(orderId)}</option>`,
                  )
                  .join('')}
              </select>
            </section>

            ${
              state.selected.length > 0
                ? `
                  <section class="flex flex-wrap items-center gap-4 rounded-md border bg-muted/50 px-4 py-2 text-sm">
                    <span>已选 <strong>${state.selected.length}</strong> 条</span>
                    <span>生产单号：<strong>${escapeHtml(selectedOrder ?? '-')}</strong></span>
                    <span>合计需求数量：<strong>${selectedTotalRequested}</strong></span>
                    <span>合计已下发数量：<strong>${selectedTotalIssued}</strong></span>
                  </section>
                `
                : ''
            }

            <section class="overflow-x-auto rounded-md border">
              <table class="w-full min-w-[1340px] text-sm">
                <thead>
                  <tr class="border-b bg-muted/40 text-left">
                    <th class="w-10 px-4 py-2"></th>
                    <th class="px-4 py-2 font-medium">领料单号</th>
                    <th class="px-4 py-2 font-medium">生产单号</th>
                    <th class="px-4 py-2 font-medium">任务ID</th>
                    <th class="px-4 py-2 font-medium">用料摘要</th>
                    <th class="px-4 py-2 text-center font-medium">需求数量</th>
                    <th class="px-4 py-2 text-center font-medium">已下发数量</th>
                    <th class="px-4 py-2 font-medium">领料状态</th>
                    <th class="px-4 py-2 font-medium">更新时间</th>
                    <th class="px-4 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    filteredPool.length === 0
                      ? `
                        <tr>
                          <td colspan="10" class="py-10 text-center text-sm text-muted-foreground">
                            暂无可生成领料对账单的领料需求
                          </td>
                        </tr>
                      `
                      : filteredPool
                          .map(
                            (issue) => `
                              <tr class="border-b last:border-b-0">
                                <td class="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    class="h-4 w-4 rounded border-border align-middle"
                                    data-mst-action="toggle-select"
                                    data-issue-id="${escapeHtml(issue.issueId)}"
                                    ${state.selected.includes(issue.issueId) ? 'checked' : ''}
                                  />
                                </td>
                                <td class="px-4 py-3 font-mono text-xs">${escapeHtml(issue.issueId)}</td>
                                <td class="px-4 py-3 text-sm">${escapeHtml(issue.productionOrderId ?? '—')}</td>
                                <td class="px-4 py-3 font-mono text-xs">${escapeHtml(issue.taskId)}</td>
                                <td class="max-w-[180px] truncate px-4 py-3 text-sm" title="${escapeHtml(issue.materialSummaryZh)}">${escapeHtml(issue.materialSummaryZh)}</td>
                                <td class="px-4 py-3 text-center">${issue.requestedQty}</td>
                                <td class="px-4 py-3 text-center">${issue.issuedQty}</td>
                                <td class="px-4 py-3">
                                  <span class="inline-flex rounded-md border px-2 py-0.5 text-xs">
                                    ${escapeHtml(ISSUE_STATUS_LABEL[issue.status] ?? issue.status)}
                                  </span>
                                </td>
                                <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(issue.updatedAt ?? '—')}</td>
                                <td class="px-4 py-3">
                                  <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/process/material-issue">查看领料需求</button>
                                </td>
                              </tr>
                            `,
                          )
                          .join('')
                  }
                </tbody>
              </table>
            </section>

            <section class="flex max-w-lg flex-col gap-2">
              <textarea
                rows="2"
                class="w-full rounded-md border bg-background px-3 py-2 text-sm"
                data-mst-field="remark"
                placeholder="备注（可选）"
              >${escapeHtml(state.remark)}</textarea>
              <button
                class="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 ${
                  state.selected.length === 0 ? 'pointer-events-none opacity-50' : ''
                }"
                data-mst-action="generate"
              >
                生成领料对账单草稿
              </button>
            </section>
          `
          : `
            <section class="flex flex-wrap gap-3">
              <input
                class="h-9 w-64 rounded-md border bg-background px-3 text-sm"
                placeholder="关键词（对账单号 / 生产单号 / 备注）"
                data-mst-draft-filter="keyword"
                value="${escapeHtml(state.draftKeyword)}"
              />
              <select class="h-9 w-40 rounded-md border bg-background px-3 text-sm" data-mst-draft-filter="status">
                <option value="ALL" ${state.draftStatusFilter === 'ALL' ? 'selected' : ''}>全部</option>
                <option value="DRAFT" ${state.draftStatusFilter === 'DRAFT' ? 'selected' : ''}>草稿</option>
                <option value="CONFIRMED" ${state.draftStatusFilter === 'CONFIRMED' ? 'selected' : ''}>已确认</option>
                <option value="CLOSED" ${state.draftStatusFilter === 'CLOSED' ? 'selected' : ''}>已关闭</option>
              </select>
            </section>

            <section class="overflow-x-auto rounded-md border">
              <table class="w-full min-w-[1200px] text-sm">
                <thead>
                  <tr class="border-b bg-muted/40 text-left">
                    <th class="px-4 py-2 font-medium">对账单号</th>
                    <th class="px-4 py-2 font-medium">生产单号</th>
                    <th class="px-4 py-2 text-center font-medium">条目数</th>
                    <th class="px-4 py-2 text-center font-medium">需求总数量</th>
                    <th class="px-4 py-2 text-center font-medium">已下发总数量</th>
                    <th class="px-4 py-2 font-medium">状态</th>
                    <th class="px-4 py-2 font-medium">创建时间</th>
                    <th class="px-4 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    filteredDrafts.length === 0
                      ? `
                        <tr>
                          <td colspan="8" class="py-10 text-center text-sm text-muted-foreground">
                            暂无领料对账单草稿
                          </td>
                        </tr>
                      `
                      : filteredDrafts
                          .map(
                            (draft) => `
                              <tr class="border-b last:border-b-0">
                                <td class="px-4 py-3 font-mono text-xs">${escapeHtml(draft.materialStatementId)}</td>
                                <td class="px-4 py-3 text-sm">${escapeHtml(draft.productionOrderId)}</td>
                                <td class="px-4 py-3 text-center">${draft.itemCount}</td>
                                <td class="px-4 py-3 text-center">${draft.totalRequestedQty}</td>
                                <td class="px-4 py-3 text-center">${draft.totalIssuedQty}</td>
                                <td class="px-4 py-3">
                                  <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[draft.status]}">
                                    ${STATUS_LABEL[draft.status]}
                                  </span>
                                </td>
                                <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(draft.createdAt)}</td>
                                <td class="px-4 py-3">
                                  <div class="flex flex-wrap gap-1">
                                    <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-mst-action="open-detail" data-material-statement-id="${escapeHtml(draft.materialStatementId)}">
                                      查看明细
                                    </button>
                                    ${
                                      draft.status === 'DRAFT'
                                        ? `<button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-mst-action="confirm" data-material-statement-id="${escapeHtml(draft.materialStatementId)}">确认</button>`
                                        : ''
                                    }
                                    ${
                                      draft.status === 'DRAFT' || draft.status === 'CONFIRMED'
                                        ? `<button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-mst-action="close" data-material-statement-id="${escapeHtml(draft.materialStatementId)}">关闭</button>`
                                        : ''
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
      }

      ${renderDetailDialog(detailDraft)}
    </div>
  `
}

export function handleMaterialStatementsEvent(target: HTMLElement): boolean {
  const tabNode = target.closest<HTMLElement>('[data-mst-tab]')
  if (tabNode) {
    const tab = tabNode.dataset.mstTab as ActiveTab | undefined
    if (tab === 'pool' || tab === 'draft') {
      state.activeTab = tab
      return true
    }
  }

  const poolFilterNode = target.closest<HTMLElement>('[data-mst-pool-filter]')
  if (poolFilterNode instanceof HTMLInputElement || poolFilterNode instanceof HTMLSelectElement) {
    const field = poolFilterNode.dataset.mstPoolFilter
    if (field === 'keyword') {
      state.poolKeyword = poolFilterNode.value
      return true
    }
    if (field === 'order') {
      state.poolOrder = poolFilterNode.value
      return true
    }
    return true
  }

  const draftFilterNode = target.closest<HTMLElement>('[data-mst-draft-filter]')
  if (
    draftFilterNode instanceof HTMLInputElement ||
    draftFilterNode instanceof HTMLSelectElement
  ) {
    const field = draftFilterNode.dataset.mstDraftFilter
    if (field === 'keyword') {
      state.draftKeyword = draftFilterNode.value
      return true
    }
    if (field === 'status') {
      state.draftStatusFilter = draftFilterNode.value as 'ALL' | MaterialStatementStatus
      return true
    }
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-mst-field]')
  if (fieldNode instanceof HTMLTextAreaElement || fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.mstField
    if (field === 'remark') {
      state.remark = fieldNode.value
      return true
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-mst-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.mstAction
  if (!action) return false

  if (action === 'toggle-select') {
    const issueId = actionNode.dataset.issueId
    if (!issueId) return true
    const issue = initialMaterialIssueSheets.find((item) => item.issueId === issueId)
    if (!issue) return true

    if (state.selected.includes(issueId)) {
      state.selected = state.selected.filter((id) => id !== issueId)
      return true
    }

    const selectedOrder = getSelectedOrder()
    if (selectedOrder && issue.productionOrderId !== selectedOrder) {
      showMaterialStatementsToast('一次只能生成同一生产单的领料对账单', 'error')
      return true
    }

    state.selected = [...state.selected, issueId]
    return true
  }

  if (action === 'generate') {
    const selectedOrder = getSelectedOrder()
    if (state.selected.length === 0) {
      showMaterialStatementsToast('请至少选择一条领料需求', 'error')
      return true
    }
    if (!selectedOrder) {
      showMaterialStatementsToast('生产单号不能为空', 'error')
      return true
    }

    const result = generateMaterialStatementDraft(
      {
        productionOrderId: selectedOrder,
        issueIds: state.selected,
        remark: state.remark.trim() || undefined,
      },
      '管理员',
    )
    if (!result.ok) {
      showMaterialStatementsToast(result.message ?? '生成失败', 'error')
      return true
    }
    showMaterialStatementsToast('已生成领料对账单草稿')
    state.selected = []
    state.remark = ''
    return true
  }

  if (action === 'confirm') {
    const materialStatementId = actionNode.dataset.materialStatementId
    if (!materialStatementId) return true
    const result = confirmMaterialStatementDraft(materialStatementId, '管理员')
    if (result.ok) showMaterialStatementsToast('领料对账单已确认')
    else showMaterialStatementsToast(result.message ?? '操作失败', 'error')
    return true
  }

  if (action === 'close') {
    const materialStatementId = actionNode.dataset.materialStatementId
    if (!materialStatementId) return true
    const result = closeMaterialStatementDraft(materialStatementId, '管理员')
    if (result.ok) showMaterialStatementsToast('领料对账单已关闭')
    else showMaterialStatementsToast(result.message ?? '操作失败', 'error')
    return true
  }

  if (action === 'open-detail') {
    const materialStatementId = actionNode.dataset.materialStatementId
    if (materialStatementId) {
      state.detailStatementId = materialStatementId
    }
    return true
  }

  if (action === 'close-detail') {
    state.detailStatementId = null
    return true
  }

  return true
}

export function isMaterialStatementsDialogOpen(): boolean {
  return state.detailStatementId !== null
}
