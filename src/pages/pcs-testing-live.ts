import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { renderFormDialog } from '../components/ui/dialog'
import { renderDrawer as uiDrawer } from '../components/ui'
import {
  ACCOUNTING_STATUS_META,
  LIVE_PURPOSE_META,
  SESSION_STATUS_META,
  listLiveSessions,
  type AccountingStatus,
  type LivePurpose,
  type LiveSession,
  type SessionStatus,
} from '../data/pcs-testing'

type QuickFilter = 'all' | 'reconciling' | 'readyToClose' | 'pendingAccounting' | 'accounted' | 'abnormal'

interface CreateFormState {
  title: string
  owner: string
  site: string
  liveAccount: string
  anchor: string
  startAt: string
  endAt: string
  operator: string
  recorder: string
  reviewer: string
  purposes: LivePurpose[]
  isTestAccountingEnabled: boolean
  note: string
}

interface DialogState {
  open: boolean
  sessionId: string | null
}

interface ListPageState {
  searchKeyword: string
  statusFilter: 'all' | SessionStatus
  purposeFilter: 'all' | LivePurpose
  accountingFilter: 'all' | AccountingStatus
  quickFilter: QuickFilter
  currentPage: number
  pageSize: number
  createDrawerOpen: boolean
  closeAccountDialog: DialogState
  testAccountingDialog: DialogState
  createForm: CreateFormState
  closeAccountNote: string
  testAccountingNote: string
  testAccountingConfirmed: boolean
  notice: string | null
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

let sessions: LiveSession[] = listLiveSessions()

const state: ListPageState = {
  searchKeyword: '',
  statusFilter: 'all',
  purposeFilter: 'all',
  accountingFilter: 'all',
  quickFilter: 'all',
  currentPage: 1,
  pageSize: 10,
  createDrawerOpen: false,
  closeAccountDialog: { open: false, sessionId: null },
  testAccountingDialog: { open: false, sessionId: null },
  createForm: {
    title: '',
    owner: '',
    site: '',
    liveAccount: '',
    anchor: '',
    startAt: '',
    endAt: '',
    operator: '',
    recorder: '',
    reviewer: '',
    purposes: [],
    isTestAccountingEnabled: false,
    note: '',
  },
  closeAccountNote: '',
  testAccountingNote: '',
  testAccountingConfirmed: false,
  notice: '已迁移直播场次：列表、新建抽屉、关账弹窗、测款入账弹窗、详情内页。',
}

function getPurposeTags(purposes: LivePurpose[]): string {
  return purposes
    .map((purpose) => {
      const meta = LIVE_PURPOSE_META[purpose]
      return `<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${meta.color}">${meta.label}</span>`
    })
    .join('')
}

function getKpiStats() {
  return {
    reconciling: sessions.filter((item) => item.status === 'RECONCILING').length,
    readyToClose: sessions.filter((item) => item.status === 'RECONCILING' && item.endAt).length,
    pendingAccounting: sessions.filter((item) => item.testAccountingStatus === 'PENDING').length,
    accounted: sessions.filter((item) => item.testAccountingStatus === 'ACCOUNTED').length,
    abnormal: sessions.filter((item) => !item.endAt && item.status !== 'DRAFT').length,
  }
}

function getFilteredSessions(): LiveSession[] {
  const keyword = state.searchKeyword.trim().toLowerCase()

  return sessions.filter((session) => {
    if (
      keyword &&
      !session.id.toLowerCase().includes(keyword) &&
      !session.title.toLowerCase().includes(keyword) &&
      !session.liveAccount.toLowerCase().includes(keyword)
    ) {
      return false
    }

    if (state.statusFilter !== 'all' && session.status !== state.statusFilter) return false
    if (state.purposeFilter !== 'all' && !session.purposes.includes(state.purposeFilter)) return false
    if (state.accountingFilter !== 'all' && session.testAccountingStatus !== state.accountingFilter) return false

    if (state.quickFilter === 'reconciling' && session.status !== 'RECONCILING') return false
    if (state.quickFilter === 'readyToClose' && !(session.status === 'RECONCILING' && session.endAt)) return false
    if (state.quickFilter === 'pendingAccounting' && session.testAccountingStatus !== 'PENDING') return false
    if (state.quickFilter === 'accounted' && session.testAccountingStatus !== 'ACCOUNTED') return false
    if (state.quickFilter === 'abnormal' && !(!session.endAt && session.status !== 'DRAFT')) return false

    return true
  })
}

function getPaging(rows: LiveSession[]) {
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize))
  const currentPage = Math.min(Math.max(1, state.currentPage), totalPages)
  const start = (currentPage - 1) * state.pageSize
  const end = start + state.pageSize

  return {
    rows: rows.slice(start, end),
    total,
    totalPages,
    currentPage,
    from: total === 0 ? 0 : start + 1,
    to: total === 0 ? 0 : Math.min(end, total),
  }
}

function getSessionById(sessionId: string | null): LiveSession | null {
  if (!sessionId) return null
  return sessions.find((item) => item.id === sessionId) ?? null
}

function renderNotice(): string {
  if (!state.notice) return ''

  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-live-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">直播场次</h1>
        <p class="mt-1 text-sm text-muted-foreground">迁移旧版 PCS 的场次管理结构与 Mock 数据，保留关账和测款入账闭环。</p>
      </div>
      <button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-pcs-live-action="open-create">
        <i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>新建场次
      </button>
    </header>
  `
}

function renderKpiCards(): string {
  const stats = getKpiStats()

  const cards: Array<{ key: QuickFilter; title: string; value: number; tone: string }> = [
    { key: 'reconciling', title: '核对中', value: stats.reconciling, tone: 'text-blue-700' },
    { key: 'readyToClose', title: '可关账', value: stats.readyToClose, tone: 'text-emerald-700' },
    { key: 'pendingAccounting', title: '待入账', value: stats.pendingAccounting, tone: 'text-amber-700' },
    { key: 'accounted', title: '已入账', value: stats.accounted, tone: 'text-emerald-700' },
    { key: 'abnormal', title: '异常场次', value: stats.abnormal, tone: 'text-rose-700' },
  ]

  return `
    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      ${cards
        .map(
          (card) => `
            <button class="rounded-lg border bg-card p-3 text-left transition hover:border-blue-300 ${state.quickFilter === card.key ? 'border-blue-300 bg-blue-50' : ''}" data-pcs-live-action="set-quick-filter" data-filter-key="${card.key}">
              <p class="text-xs text-muted-foreground">${card.title}</p>
              <p class="mt-1 text-xl font-semibold ${card.tone}">${card.value}</p>
            </button>
          `,
        )
        .join('')}
    </section>
  `
}

function renderFilters(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <div class="xl:col-span-2">
          <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
            <input class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" placeholder="场次ID / 标题 / 账号" value="${escapeHtml(state.searchKeyword)}" data-pcs-live-field="searchKeyword" />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">场次状态</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-live-field="statusFilter">
            <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
            ${Object.entries(SESSION_STATUS_META)
              .map(
                ([key, meta]) =>
                  `<option value="${key}" ${state.statusFilter === key ? 'selected' : ''}>${meta.label}</option>`,
              )
              .join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">场次用途</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-live-field="purposeFilter">
            <option value="all" ${state.purposeFilter === 'all' ? 'selected' : ''}>全部用途</option>
            ${Object.entries(LIVE_PURPOSE_META)
              .map(
                ([key, meta]) =>
                  `<option value="${key}" ${state.purposeFilter === key ? 'selected' : ''}>${meta.label}</option>`,
              )
              .join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">测款入账</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-live-field="accountingFilter">
            <option value="all" ${state.accountingFilter === 'all' ? 'selected' : ''}>全部</option>
            ${Object.entries(ACCOUNTING_STATUS_META)
              .map(
                ([key, meta]) =>
                  `<option value="${key}" ${state.accountingFilter === key ? 'selected' : ''}>${meta.label}</option>`,
              )
              .join('')}
          </select>
        </div>
        <div class="flex items-end justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-live-action="reset-filters">重置筛选</button>
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-live-action="set-quick-filter" data-filter-key="all">清除快捷筛选</button>
        </div>
      </div>
    </section>
  `
}

function renderRows(rows: LiveSession[]): string {
  if (rows.length === 0) {
    return `
      <tr>
        <td colspan="11" class="px-4 py-12 text-center text-sm text-muted-foreground">
          <i data-lucide="calendar-x-2" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
          <p class="mt-2">暂无符合条件的场次</p>
        </td>
      </tr>
    `
  }

  return rows
    .map((session) => {
      const statusMeta = SESSION_STATUS_META[session.status]
      const accountingMeta = ACCOUNTING_STATUS_META[session.testAccountingStatus]
      const canClose = session.status === 'RECONCILING'
      const canAccounting =
        (session.status === 'RECONCILING' || session.status === 'COMPLETED') &&
        session.testAccountingStatus === 'PENDING'

      return `
        <tr class="border-b last:border-b-0 hover:bg-muted/40">
          <td class="px-3 py-3 align-top">
            <button class="font-medium text-blue-700 hover:underline" data-pcs-live-action="go-detail" data-session-id="${escapeHtml(session.id)}">${escapeHtml(session.id)}</button>
            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(session.title)}</p>
          </td>
          <td class="px-3 py-3 align-top">
            <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${statusMeta.color}">${statusMeta.label}</span>
          </td>
          <td class="px-3 py-3 align-top"><div class="flex flex-wrap gap-1">${getPurposeTags(session.purposes)}</div></td>
          <td class="px-3 py-3 align-top text-xs">${escapeHtml(session.liveAccount)}<br/>${escapeHtml(session.anchor)}</td>
          <td class="px-3 py-3 align-top text-xs">${escapeHtml(session.startAt)}<br/>${escapeHtml(session.endAt ?? '进行中')}</td>
          <td class="px-3 py-3 text-center align-top">${session.itemCount}</td>
          <td class="px-3 py-3 text-center align-top">${session.testItemCount}</td>
          <td class="px-3 py-3 align-top"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${accountingMeta.color}">${accountingMeta.label}</span></td>
          <td class="px-3 py-3 text-right align-top">${session.gmvTotal === null ? '-' : session.gmvTotal.toLocaleString()}</td>
          <td class="px-3 py-3 align-top text-xs text-muted-foreground">${escapeHtml(session.updatedAt)}</td>
          <td class="px-3 py-3 align-top">
            <div class="flex flex-wrap gap-1">
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-live-action="go-detail" data-session-id="${escapeHtml(session.id)}">查看</button>
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-live-action="import" data-session-id="${escapeHtml(session.id)}">导入数据</button>
              ${canClose ? `<button class="inline-flex h-7 items-center rounded-md border border-emerald-300 px-2 text-xs text-emerald-700 hover:bg-emerald-50" data-pcs-live-action="open-close-account" data-session-id="${escapeHtml(session.id)}">完成关账</button>` : ''}
              ${canAccounting ? `<button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-50" data-pcs-live-action="open-test-accounting" data-session-id="${escapeHtml(session.id)}">完成测款入账</button>` : ''}
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderTable(): string {
  const filtered = getFilteredSessions()
  const paging = getPaging(filtered)
  state.currentPage = paging.currentPage

  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1320px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">场次ID / 标题</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">用途</th>
              <th class="px-3 py-2 font-medium">账号 / 主播</th>
              <th class="px-3 py-2 font-medium">开播 / 下播</th>
              <th class="px-3 py-2 text-center font-medium">条目数</th>
              <th class="px-3 py-2 text-center font-medium">测款条目</th>
              <th class="px-3 py-2 font-medium">测款入账</th>
              <th class="px-3 py-2 text-right font-medium">GMV</th>
              <th class="px-3 py-2 font-medium">更新时间</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${renderRows(paging.rows)}</tbody>
        </table>
      </div>
      <footer class="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-3">
        <p class="text-xs text-muted-foreground">共 ${paging.total} 条${paging.total ? `，当前 ${paging.from}-${paging.to}` : ''}</p>
        <div class="flex flex-wrap items-center gap-2">
          <select class="h-8 rounded-md border bg-background px-2 text-xs" data-pcs-live-field="pageSize">
            ${PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${size === state.pageSize ? 'selected' : ''}>${size} 条/页</option>`).join('')}
          </select>
          <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${paging.currentPage <= 1 ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-live-action="prev-page" ${paging.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
          <span class="text-xs text-muted-foreground">${paging.currentPage} / ${paging.totalPages}</span>
          <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${paging.currentPage >= paging.totalPages ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-live-action="next-page" ${paging.currentPage >= paging.totalPages ? 'disabled' : ''}>下一页</button>
        </div>
      </footer>
    </section>
  `
}

function renderPurposeSelector(): string {
  return `
    <div>
      <label class="mb-1 block text-xs text-muted-foreground">场次用途</label>
      <div class="grid grid-cols-2 gap-2 rounded-md border bg-background p-2">
        ${Object.entries(LIVE_PURPOSE_META)
          .map(([key, meta]) => {
            const checked = state.createForm.purposes.includes(key as LivePurpose)
            return `
              <button class="inline-flex h-8 items-center justify-center rounded-md border text-xs ${checked ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-live-action="toggle-purpose" data-purpose="${key}">
                ${meta.label}
              </button>
            `
          })
          .join('')}
      </div>
    </div>
  `
}

function renderCreateDrawer(): string {
  if (!state.createDrawerOpen) return ''

  const formContent = `
    <div class="space-y-3">
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">场次标题</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="请输入场次标题" value="${escapeHtml(state.createForm.title)}" data-pcs-live-field="create-title" />
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">负责人</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.owner)}" data-pcs-live-field="create-owner" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">站点</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.site)}" data-pcs-live-field="create-site" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">直播账号</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.liveAccount)}" data-pcs-live-field="create-live-account" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">主播</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.anchor)}" data-pcs-live-field="create-anchor" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">开播时间</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="2026-01-25 19:00" value="${escapeHtml(state.createForm.startAt)}" data-pcs-live-field="create-start" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">预计下播时间</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="2026-01-25 22:30" value="${escapeHtml(state.createForm.endAt)}" data-pcs-live-field="create-end" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">操作人</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.operator)}" data-pcs-live-field="create-operator" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">记录人</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.recorder)}" data-pcs-live-field="create-recorder" />
        </div>
      </div>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">复核人</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.reviewer)}" data-pcs-live-field="create-reviewer" />
      </div>
      ${renderPurposeSelector()}
      <label class="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" class="h-4 w-4 rounded border" ${state.createForm.isTestAccountingEnabled ? 'checked' : ''} data-pcs-live-field="create-test-accounting" />
        <span>启用测款入账</span>
      </label>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">备注</label>
        <textarea class="min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm" data-pcs-live-field="create-note">${escapeHtml(state.createForm.note)}</textarea>
      </div>
    </div>
  `

  return uiDrawer(
    {
      title: '新建场次',
      subtitle: '保留旧 PCS 的创建参数，支持保存草稿和直接进入核对。',
      closeAction: { prefix: 'pcs-live', action: 'close-create' },
      width: 'lg',
    },
    formContent,
    {
      extra: '<button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-live-action="save-draft">保存草稿</button>',
      cancel: { prefix: 'pcs-live', action: 'close-create', label: '取消' },
      confirm: { prefix: 'pcs-live', action: 'save-reconciling', label: '创建并进入核对', variant: 'primary' },
    }
  )
}

function renderCloseAccountDialog(): string {
  if (!state.closeAccountDialog.open) return ''

  const selected = getSessionById(state.closeAccountDialog.sessionId)
  if (!selected) return ''

  const formContent = `
    <div class="space-y-3">
      <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">关账后状态将进入"已关账"，如包含测款条目可继续执行"测款入账"。</div>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">关账备注</label>
        <textarea class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" data-pcs-live-field="close-account-note">${escapeHtml(state.closeAccountNote)}</textarea>
      </div>
    </div>
  `

  return renderFormDialog(
    {
      title: '完成场次（关账）',
      description: `场次：${selected.id} ｜ ${selected.title}`,
      closeAction: { prefix: 'pcs-live', action: 'close-close-account' },
      submitAction: { prefix: 'pcs-live', action: 'confirm-close-account', label: '确认关账' },
      width: 'md',
    },
    formContent
  )
}

function renderTestAccountingDialog(): string {
  if (!state.testAccountingDialog.open) return ''

  const selected = getSessionById(state.testAccountingDialog.sessionId)
  if (!selected) return ''

  const formContent = `
    <div class="space-y-3">
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">入账说明</label>
        <textarea class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" data-pcs-live-field="test-accounting-note">${escapeHtml(state.testAccountingNote)}</textarea>
      </div>
      <label class="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" class="h-4 w-4 rounded border" ${state.testAccountingConfirmed ? 'checked' : ''} data-pcs-live-field="test-accounting-confirmed" />
        <span>我已确认测款结果与场次明细一致</span>
      </label>
    </div>
  `

  return renderFormDialog(
    {
      title: '完成测款核对（入账）',
      description: `场次：${selected.id} ｜ 测款条目 ${selected.testItemCount} 条`,
      closeAction: { prefix: 'pcs-live', action: 'close-test-accounting' },
      submitAction: { prefix: 'pcs-live', action: 'confirm-test-accounting', label: '确认入账' },
      width: 'md',
    },
    formContent
  )
}

function resetCreateForm(): void {
  state.createForm = {
    title: '',
    owner: '',
    site: '',
    liveAccount: '',
    anchor: '',
    startAt: '',
    endAt: '',
    operator: '',
    recorder: '',
    reviewer: '',
    purposes: [],
    isTestAccountingEnabled: false,
    note: '',
  }
}

function closeAllDialogs(): void {
  state.createDrawerOpen = false
  state.closeAccountDialog = { open: false, sessionId: null }
  state.testAccountingDialog = { open: false, sessionId: null }
}

function createSession(status: SessionStatus): void {
  const id = `LS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(sessions.length + 1).padStart(3, '0')}`
  const newRow: LiveSession = {
    id,
    title: state.createForm.title || '新直播场次',
    status,
    purposes: state.createForm.purposes.length ? state.createForm.purposes : ['SELL'],
    liveAccount: state.createForm.liveAccount || '待补充账号',
    anchor: state.createForm.anchor || '待分配主播',
    startAt: state.createForm.startAt || '待定',
    endAt: state.createForm.endAt || null,
    owner: state.createForm.owner || '未填写',
    operator: state.createForm.operator || '未填写',
    recorder: state.createForm.recorder || '未填写',
    reviewer: state.createForm.reviewer || '未填写',
    site: state.createForm.site || '未填写',
    itemCount: 0,
    testItemCount: 0,
    testAccountingStatus: state.createForm.isTestAccountingEnabled ? 'PENDING' : 'NONE',
    sampleCount: 0,
    gmvTotal: null,
    orderTotal: null,
    exposureTotal: 0,
    clickTotal: 0,
    cartTotal: 0,
    isTestAccountingEnabled: state.createForm.isTestAccountingEnabled,
    note: state.createForm.note,
    createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
  }

  sessions = [newRow, ...sessions]
  state.notice = `${newRow.id} 已${status === 'DRAFT' ? '保存为草稿' : '创建并进入核对'}（演示态）。`
  state.currentPage = 1
  state.createDrawerOpen = false
  resetCreateForm()
}

function handleCloseAccount(): void {
  const selected = getSessionById(state.closeAccountDialog.sessionId)
  if (!selected) return
  if (!state.closeAccountNote.trim()) {
    state.notice = '请先填写关账备注。'
    return
  }

  selected.status = 'COMPLETED'
  selected.updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
  state.closeAccountDialog = { open: false, sessionId: null }
  state.closeAccountNote = ''
  state.notice = `${selected.id} 已完成关账（演示态）。`
}

function handleAccounting(): void {
  const selected = getSessionById(state.testAccountingDialog.sessionId)
  if (!selected) return

  if (!state.testAccountingNote.trim()) {
    state.notice = '请先填写入账说明。'
    return
  }
  if (!state.testAccountingConfirmed) {
    state.notice = '请确认测款结果与明细一致。'
    return
  }

  selected.testAccountingStatus = 'ACCOUNTED'
  selected.updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
  state.testAccountingDialog = { open: false, sessionId: null }
  state.testAccountingNote = ''
  state.testAccountingConfirmed = false
  state.notice = `${selected.id} 的测款结果已入账（演示态）。`
}

export function renderPcsLiveSessionsPage(): string {
  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderKpiCards()}
      ${renderFilters()}
      ${renderTable()}
      ${renderCreateDrawer()}
      ${renderCloseAccountDialog()}
      ${renderTestAccountingDialog()}
    </div>
  `
}

export function handlePcsLiveSessionsEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-live-field]')

  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.pcsLiveField
    if (field === 'searchKeyword') {
      state.searchKeyword = fieldNode.value
      state.currentPage = 1
      return true
    }
    if (field === 'create-title') state.createForm.title = fieldNode.value
    if (field === 'create-owner') state.createForm.owner = fieldNode.value
    if (field === 'create-site') state.createForm.site = fieldNode.value
    if (field === 'create-live-account') state.createForm.liveAccount = fieldNode.value
    if (field === 'create-anchor') state.createForm.anchor = fieldNode.value
    if (field === 'create-start') state.createForm.startAt = fieldNode.value
    if (field === 'create-end') state.createForm.endAt = fieldNode.value
    if (field === 'create-operator') state.createForm.operator = fieldNode.value
    if (field === 'create-recorder') state.createForm.recorder = fieldNode.value
    if (field === 'create-reviewer') state.createForm.reviewer = fieldNode.value
    if (field === 'create-test-accounting') state.createForm.isTestAccountingEnabled = fieldNode.checked
    if (field === 'test-accounting-confirmed') state.testAccountingConfirmed = fieldNode.checked
    return true
  }

  if (fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.pcsLiveField
    if (field === 'create-note') state.createForm.note = fieldNode.value
    if (field === 'close-account-note') state.closeAccountNote = fieldNode.value
    if (field === 'test-accounting-note') state.testAccountingNote = fieldNode.value
    return true
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsLiveField
    if (field === 'statusFilter') state.statusFilter = fieldNode.value as ListPageState['statusFilter']
    if (field === 'purposeFilter') state.purposeFilter = fieldNode.value as ListPageState['purposeFilter']
    if (field === 'accountingFilter') state.accountingFilter = fieldNode.value as ListPageState['accountingFilter']
    if (field === 'pageSize') state.pageSize = Number(fieldNode.value) || 10
    state.currentPage = 1
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-live-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsLiveAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'set-quick-filter') {
    state.quickFilter = (actionNode.dataset.filterKey as QuickFilter) ?? 'all'
    state.currentPage = 1
    return true
  }

  if (action === 'reset-filters') {
    state.searchKeyword = ''
    state.statusFilter = 'all'
    state.purposeFilter = 'all'
    state.accountingFilter = 'all'
    state.quickFilter = 'all'
    state.currentPage = 1
    return true
  }

  if (action === 'go-detail') {
    const sessionId = actionNode.dataset.sessionId
    if (!sessionId) return false
    appStore.navigate(`/pcs/testing/live/${sessionId}`)
    return true
  }

  if (action === 'import') {
    const sessionId = actionNode.dataset.sessionId
    if (!sessionId) return false
    state.notice = `${sessionId} 已触发“导入数据”（演示态）。`
    return true
  }

  if (action === 'open-create') {
    state.createDrawerOpen = true
    return true
  }

  if (action === 'close-create') {
    state.createDrawerOpen = false
    return true
  }

  if (action === 'toggle-purpose') {
    const purpose = actionNode.dataset.purpose as LivePurpose | undefined
    if (!purpose) return false
    if (state.createForm.purposes.includes(purpose)) {
      state.createForm.purposes = state.createForm.purposes.filter((item) => item !== purpose)
    } else {
      state.createForm.purposes = [...state.createForm.purposes, purpose]
    }
    state.createForm.isTestAccountingEnabled = state.createForm.purposes.includes('TEST')
    return true
  }

  if (action === 'save-draft') {
    createSession('DRAFT')
    return true
  }

  if (action === 'save-reconciling') {
    createSession('RECONCILING')
    return true
  }

  if (action === 'open-close-account') {
    const sessionId = actionNode.dataset.sessionId
    if (!sessionId) return false
    state.closeAccountDialog = { open: true, sessionId }
    state.closeAccountNote = ''
    return true
  }

  if (action === 'close-close-account') {
    state.closeAccountDialog = { open: false, sessionId: null }
    state.closeAccountNote = ''
    return true
  }

  if (action === 'confirm-close-account') {
    handleCloseAccount()
    return true
  }

  if (action === 'open-test-accounting') {
    const sessionId = actionNode.dataset.sessionId
    if (!sessionId) return false
    state.testAccountingDialog = { open: true, sessionId }
    state.testAccountingNote = ''
    state.testAccountingConfirmed = false
    return true
  }

  if (action === 'close-test-accounting') {
    state.testAccountingDialog = { open: false, sessionId: null }
    state.testAccountingNote = ''
    state.testAccountingConfirmed = false
    return true
  }

  if (action === 'confirm-test-accounting') {
    handleAccounting()
    return true
  }

  if (action === 'prev-page') {
    state.currentPage = Math.max(1, state.currentPage - 1)
    return true
  }

  if (action === 'next-page') {
    const totalPages = Math.max(1, Math.ceil(getFilteredSessions().length / state.pageSize))
    state.currentPage = Math.min(totalPages, state.currentPage + 1)
    return true
  }

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsLiveSessionsDialogOpen(): boolean {
  return state.createDrawerOpen || state.closeAccountDialog.open || state.testAccountingDialog.open
}
