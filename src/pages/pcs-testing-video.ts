import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { renderFormDialog } from '../components/ui/dialog'
import { renderDrawer as uiDrawer } from '../components/ui'
import { renderTablePagination } from '../components/ui/pagination'
import {
  DEFAULT_PAGE_SIZE_OPTIONS,
  getNextPage,
  getPrevPage,
  paginateRows,
  parsePageSize,
} from '../utils/paging'
import {
  ACCOUNTING_STATUS_META,
  SESSION_STATUS_META,
  VIDEO_PLATFORM_META,
  VIDEO_PURPOSE_META,
  listVideoRecords,
  type AccountingStatus,
  type SessionStatus,
  type VideoPurpose,
  type VideoRecord,
} from '../data/pcs-testing'

type QuickFilter = 'all' | 'reconciling' | 'canClose' | 'pendingAccounting' | 'accounted'

interface CreateFormState {
  title: string
  owner: string
  recorder: string
  platform: VideoRecord['platform'] | ''
  account: string
  creator: string
  publishedAt: string
  videoUrl: string
  purposes: VideoPurpose[]
  isTestAccountingEnabled: boolean
  note: string
}

interface DialogState {
  open: boolean
  recordId: string | null
}

interface PageState {
  searchKeyword: string
  statusFilter: 'all' | SessionStatus
  purposeFilter: 'all' | VideoPurpose
  platformFilter: 'all' | VideoRecord['platform']
  accountingFilter: 'all' | AccountingStatus
  quickFilter: QuickFilter
  currentPage: number
  pageSize: number
  createDrawerOpen: boolean
  closeDialog: DialogState
  accountingDialog: DialogState
  createForm: CreateFormState
  closeReason: string
  closeNote: string
  accountingNote: string
  accountingConfirmed: boolean
  notice: string | null
}

let records: VideoRecord[] = listVideoRecords()

const state: PageState = {
  searchKeyword: '',
  statusFilter: 'all',
  purposeFilter: 'all',
  platformFilter: 'all',
  accountingFilter: 'all',
  quickFilter: 'all',
  currentPage: 1,
  pageSize: 10,
  createDrawerOpen: false,
  closeDialog: { open: false, recordId: null },
  accountingDialog: { open: false, recordId: null },
  createForm: {
    title: '',
    owner: '',
    recorder: '',
    platform: '',
    account: '',
    creator: '',
    publishedAt: '',
    videoUrl: '',
    purposes: [],
    isTestAccountingEnabled: false,
    note: '',
  },
  closeReason: '',
  closeNote: '',
  accountingNote: '',
  accountingConfirmed: false,
  notice: '已迁移短视频记录：列表、创建抽屉、关账弹窗、测款入账弹窗、详情内页。',
}

function getRecordById(recordId: string | null): VideoRecord | null {
  if (!recordId) return null
  return records.find((item) => item.id === recordId) ?? null
}

function getKpis() {
  return {
    reconciling: records.filter((item) => item.status === 'RECONCILING').length,
    canClose: records.filter((item) => item.status === 'RECONCILING' && item.itemCount > 0).length,
    pendingAccounting: records.filter((item) => item.testAccountingStatus === 'PENDING').length,
    accounted: records.filter((item) => item.testAccountingStatus === 'ACCOUNTED').length,
  }
}

function getFilteredRows(): VideoRecord[] {
  const keyword = state.searchKeyword.trim().toLowerCase()

  return records.filter((row) => {
    if (
      keyword &&
      !row.id.toLowerCase().includes(keyword) &&
      !row.title.toLowerCase().includes(keyword) &&
      !row.account.toLowerCase().includes(keyword)
    ) {
      return false
    }

    if (state.statusFilter !== 'all' && row.status !== state.statusFilter) return false
    if (state.purposeFilter !== 'all' && !row.purposes.includes(state.purposeFilter)) return false
    if (state.platformFilter !== 'all' && row.platform !== state.platformFilter) return false
    if (state.accountingFilter !== 'all' && row.testAccountingStatus !== state.accountingFilter) return false

    if (state.quickFilter === 'reconciling' && row.status !== 'RECONCILING') return false
    if (state.quickFilter === 'canClose' && !(row.status === 'RECONCILING' && row.itemCount > 0)) return false
    if (state.quickFilter === 'pendingAccounting' && row.testAccountingStatus !== 'PENDING') return false
    if (state.quickFilter === 'accounted' && row.testAccountingStatus !== 'ACCOUNTED') return false

    return true
  })
}

function getPaging(rows: VideoRecord[]) {
  return paginateRows(rows, state.currentPage, state.pageSize)
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-video-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">短视频记录</h1>
        <p class="mt-1 text-sm text-muted-foreground">迁移旧版短视频测款链路，保留内容记录、关账、测款入账和详情审计。</p>
      </div>
      <button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-pcs-video-action="open-create">
        <i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>新建记录
      </button>
    </header>
  `
}

function renderKpis(): string {
  const kpis = getKpis()
  const cards: Array<{ key: QuickFilter; title: string; value: number; tone: string }> = [
    { key: 'reconciling', title: '核对中', value: kpis.reconciling, tone: 'text-blue-700' },
    { key: 'canClose', title: '可关账', value: kpis.canClose, tone: 'text-emerald-700' },
    { key: 'pendingAccounting', title: '待入账', value: kpis.pendingAccounting, tone: 'text-amber-700' },
    { key: 'accounted', title: '已入账', value: kpis.accounted, tone: 'text-emerald-700' },
  ]

  return `
    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      ${cards
        .map(
          (card) => `
            <button class="rounded-lg border bg-card p-3 text-left transition hover:border-blue-300 ${state.quickFilter === card.key ? 'border-blue-300 bg-blue-50' : ''}" data-pcs-video-action="set-quick" data-quick-key="${card.key}">
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
            <input class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" placeholder="记录ID / 标题 / 账号" value="${escapeHtml(state.searchKeyword)}" data-pcs-video-field="searchKeyword" />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">记录状态</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-video-field="statusFilter">
            <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
            ${Object.entries(SESSION_STATUS_META)
              .map(([key, meta]) => `<option value="${key}" ${state.statusFilter === key ? 'selected' : ''}>${meta.label}</option>`)
              .join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">用途</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-video-field="purposeFilter">
            <option value="all" ${state.purposeFilter === 'all' ? 'selected' : ''}>全部用途</option>
            ${Object.entries(VIDEO_PURPOSE_META)
              .map(([key, meta]) => `<option value="${key}" ${state.purposeFilter === key ? 'selected' : ''}>${meta.label}</option>`)
              .join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">平台</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-video-field="platformFilter">
            <option value="all" ${state.platformFilter === 'all' ? 'selected' : ''}>全部平台</option>
            ${Object.entries(VIDEO_PLATFORM_META)
              .map(([key, meta]) => `<option value="${key}" ${state.platformFilter === key ? 'selected' : ''}>${meta.label}</option>`)
              .join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">测款入账</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-video-field="accountingFilter">
            <option value="all" ${state.accountingFilter === 'all' ? 'selected' : ''}>全部</option>
            ${Object.entries(ACCOUNTING_STATUS_META)
              .map(([key, meta]) => `<option value="${key}" ${state.accountingFilter === key ? 'selected' : ''}>${meta.label}</option>`)
              .join('')}
          </select>
        </div>
      </div>
      <div class="mt-3 flex justify-end gap-2">
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-video-action="reset-filters">重置筛选</button>
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-video-action="set-quick" data-quick-key="all">清除快捷筛选</button>
      </div>
    </section>
  `
}

function renderPurposeTags(purposes: VideoPurpose[]): string {
  return purposes
    .map((purpose) => `<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${VIDEO_PURPOSE_META[purpose].color}">${VIDEO_PURPOSE_META[purpose].label}</span>`)
    .join('')
}

function renderRows(rows: VideoRecord[]): string {
  if (!rows.length) {
    return `
      <tr>
        <td colspan="11" class="px-4 py-12 text-center text-muted-foreground">
          <i data-lucide="video-off" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
          <p class="mt-2 text-sm">暂无符合条件的短视频记录</p>
        </td>
      </tr>
    `
  }

  return rows
    .map((row) => {
      const canClose = row.status === 'RECONCILING'
      const canAccounting =
        (row.status === 'RECONCILING' || row.status === 'COMPLETED') && row.testAccountingStatus === 'PENDING'

      return `
        <tr class="border-b last:border-b-0 hover:bg-muted/40">
          <td class="px-3 py-3 align-top">
            <button class="font-medium text-blue-700 hover:underline" data-pcs-video-action="go-detail" data-record-id="${escapeHtml(row.id)}">${escapeHtml(row.id)}</button>
            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.title)}</p>
          </td>
          <td class="px-3 py-3 align-top"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${SESSION_STATUS_META[row.status].color}">${SESSION_STATUS_META[row.status].label}</span></td>
          <td class="px-3 py-3 align-top"><div class="flex flex-wrap gap-1">${renderPurposeTags(row.purposes)}</div></td>
          <td class="px-3 py-3 align-top"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${VIDEO_PLATFORM_META[row.platform].color}">${VIDEO_PLATFORM_META[row.platform].label}</span></td>
          <td class="px-3 py-3 align-top text-xs">${escapeHtml(row.account)}<br/>${escapeHtml(row.creator)}</td>
          <td class="px-3 py-3 text-right align-top">${row.views.toLocaleString()}</td>
          <td class="px-3 py-3 text-right align-top">${row.likes.toLocaleString()}</td>
          <td class="px-3 py-3 text-right align-top">${row.gmv.toLocaleString()}</td>
          <td class="px-3 py-3 align-top"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${ACCOUNTING_STATUS_META[row.testAccountingStatus].color}">${ACCOUNTING_STATUS_META[row.testAccountingStatus].label}</span></td>
          <td class="px-3 py-3 align-top text-xs text-muted-foreground">${escapeHtml(row.updatedAt)}</td>
          <td class="px-3 py-3 align-top">
            <div class="flex flex-wrap gap-1">
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-video-action="go-detail" data-record-id="${escapeHtml(row.id)}">查看</button>
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-video-action="import-data" data-record-id="${escapeHtml(row.id)}">导入数据</button>
              ${canClose ? `<button class="inline-flex h-7 items-center rounded-md border border-emerald-300 px-2 text-xs text-emerald-700 hover:bg-emerald-50" data-pcs-video-action="open-close" data-record-id="${escapeHtml(row.id)}">完成关账</button>` : ''}
              ${canAccounting ? `<button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-50" data-pcs-video-action="open-accounting" data-record-id="${escapeHtml(row.id)}">完成测款入账</button>` : ''}
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderTable(): string {
  const filtered = getFilteredRows()
  const paging = getPaging(filtered)
  state.currentPage = paging.currentPage

  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1340px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">记录ID / 标题</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">用途</th>
              <th class="px-3 py-2 font-medium">平台</th>
              <th class="px-3 py-2 font-medium">账号 / 创作者</th>
              <th class="px-3 py-2 text-right font-medium">播放量</th>
              <th class="px-3 py-2 text-right font-medium">点赞</th>
              <th class="px-3 py-2 text-right font-medium">GMV</th>
              <th class="px-3 py-2 font-medium">测款入账</th>
              <th class="px-3 py-2 font-medium">更新时间</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${renderRows(paging.rows)}</tbody>
        </table>
      </div>
      ${renderTablePagination({
        total: paging.total,
        from: paging.from,
        to: paging.to,
        currentPage: paging.currentPage,
        totalPages: paging.totalPages,
        pageSize: state.pageSize,
        actionPrefix: 'pcs-video',
        pageSizeOptions: DEFAULT_PAGE_SIZE_OPTIONS,
      })}
    </section>
  `
}

function renderPurposeSelector(): string {
  return `
    <div>
      <label class="mb-1 block text-xs text-muted-foreground">记录用途</label>
      <div class="grid grid-cols-2 gap-2 rounded-md border bg-background p-2">
        ${Object.entries(VIDEO_PURPOSE_META)
          .map(([key, meta]) => {
            const checked = state.createForm.purposes.includes(key as VideoPurpose)
            return `<button class="inline-flex h-8 items-center justify-center rounded-md border text-xs ${checked ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-video-action="toggle-purpose" data-purpose="${key}">${meta.label}</button>`
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
        <label class="mb-1 block text-xs text-muted-foreground">记录标题</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.title)}" data-pcs-video-field="create-title" />
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">负责人</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.owner)}" data-pcs-video-field="create-owner" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">记录人</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.recorder)}" data-pcs-video-field="create-recorder" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">平台</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-video-field="create-platform">
            <option value="">请选择平台</option>
            ${Object.entries(VIDEO_PLATFORM_META).map(([key, meta]) => `<option value="${key}" ${state.createForm.platform === key ? 'selected' : ''}>${meta.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">账号</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.account)}" data-pcs-video-field="create-account" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">创作者</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.creator)}" data-pcs-video-field="create-creator" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">发布时间</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="2026-01-25 10:00" value="${escapeHtml(state.createForm.publishedAt)}" data-pcs-video-field="create-published-at" />
        </div>
      </div>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">视频链接</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.videoUrl)}" data-pcs-video-field="create-video-url" />
      </div>
      ${renderPurposeSelector()}
      <label class="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" class="h-4 w-4 rounded border" ${state.createForm.isTestAccountingEnabled ? 'checked' : ''} data-pcs-video-field="create-accounting-enabled" />
        <span>启用测款入账</span>
      </label>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">备注</label>
        <textarea class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" data-pcs-video-field="create-note">${escapeHtml(state.createForm.note)}</textarea>
      </div>
    </div>
  `

  return uiDrawer(
    {
      title: '新建短视频记录',
      subtitle: '支持草稿保存和直接进入核对。',
      closeAction: { prefix: 'pcs-video', action: 'close-create' },
      width: 'lg',
    },
    formContent,
    {
      extra: '<button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-video-action="save-draft">保存草稿</button>',
      cancel: { prefix: 'pcs-video', action: 'close-create', label: '取消' },
      confirm: { prefix: 'pcs-video', action: 'save-reconciling', label: '创建并进入核对', variant: 'primary' },
    }
  )
}

function renderCloseDialog(): string {
  if (!state.closeDialog.open) return ''
  const selected = getRecordById(state.closeDialog.recordId)
  if (!selected) return ''

  const formContent = `
    <div class="space-y-3">
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">未发布原因（可选）</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.closeReason)}" data-pcs-video-field="close-reason" />
      </div>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">关账备注</label>
        <textarea class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" data-pcs-video-field="close-note">${escapeHtml(state.closeNote)}</textarea>
      </div>
    </div>
  `

  return renderFormDialog(
    {
      title: '完成记录（关账）',
      description: `${selected.id} ｜ ${selected.title}`,
      closeAction: { prefix: 'pcs-video', action: 'close-close' },
      submitAction: { prefix: 'pcs-video', action: 'confirm-close', label: '确认关账' },
      width: 'md',
    },
    formContent
  )
}

function renderAccountingDialog(): string {
  if (!state.accountingDialog.open) return ''
  const selected = getRecordById(state.accountingDialog.recordId)
  if (!selected) return ''

  const formContent = `
    <div class="space-y-3">
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">入账说明</label>
        <textarea class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" data-pcs-video-field="accounting-note">${escapeHtml(state.accountingNote)}</textarea>
      </div>
      <label class="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" class="h-4 w-4 rounded border" ${state.accountingConfirmed ? 'checked' : ''} data-pcs-video-field="accounting-confirmed" />
        <span>确认测款条目已核对</span>
      </label>
    </div>
  `

  return renderFormDialog(
    {
      title: '完成测款核对（入账）',
      description: `${selected.id} ｜ 测款条目 ${selected.testItemCount} 条`,
      closeAction: { prefix: 'pcs-video', action: 'close-accounting' },
      submitAction: { prefix: 'pcs-video', action: 'confirm-accounting', label: '确认入账' },
      width: 'md',
    },
    formContent
  )
}

function resetCreateForm(): void {
  state.createForm = {
    title: '',
    owner: '',
    recorder: '',
    platform: '',
    account: '',
    creator: '',
    publishedAt: '',
    videoUrl: '',
    purposes: [],
    isTestAccountingEnabled: false,
    note: '',
  }
}

function createRecord(status: SessionStatus): void {
  const id = `SV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(records.length + 1).padStart(3, '0')}`

  const newRecord: VideoRecord = {
    id,
    title: state.createForm.title || '新短视频记录',
    status,
    purposes: state.createForm.purposes.length ? state.createForm.purposes : ['OTHER'],
    platform: (state.createForm.platform || 'OTHER') as VideoRecord['platform'],
    account: state.createForm.account || '待补充账号',
    creator: state.createForm.creator || '待补充创作者',
    publishedAt: state.createForm.publishedAt || null,
    owner: state.createForm.owner || '未填写',
    recorder: state.createForm.recorder || '未填写',
    itemCount: 0,
    testItemCount: 0,
    testAccountingStatus: state.createForm.isTestAccountingEnabled ? 'PENDING' : 'NONE',
    sampleCount: 0,
    views: 0,
    likes: 0,
    gmv: 0,
    isTestAccountingEnabled: state.createForm.isTestAccountingEnabled,
    videoUrl: state.createForm.videoUrl,
    updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    note: state.createForm.note,
  }

  records = [newRecord, ...records]
  state.createDrawerOpen = false
  state.currentPage = 1
  state.notice = `${newRecord.id} 已${status === 'DRAFT' ? '保存为草稿' : '创建并进入核对'}（演示态）。`
  resetCreateForm()
}

function closeAllDialogs(): void {
  state.createDrawerOpen = false
  state.closeDialog = { open: false, recordId: null }
  state.accountingDialog = { open: false, recordId: null }
}

export function renderPcsVideoRecordsPage(): string {
  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderKpis()}
      ${renderFilters()}
      ${renderTable()}
      ${renderCreateDrawer()}
      ${renderCloseDialog()}
      ${renderAccountingDialog()}
    </div>
  `
}

export function handlePcsVideoRecordsEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-video-field]')

  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.pcsVideoField
    if (field === 'searchKeyword') {
      state.searchKeyword = fieldNode.value
      state.currentPage = 1
      return true
    }
    if (field === 'create-title') state.createForm.title = fieldNode.value
    if (field === 'create-owner') state.createForm.owner = fieldNode.value
    if (field === 'create-recorder') state.createForm.recorder = fieldNode.value
    if (field === 'create-account') state.createForm.account = fieldNode.value
    if (field === 'create-creator') state.createForm.creator = fieldNode.value
    if (field === 'create-published-at') state.createForm.publishedAt = fieldNode.value
    if (field === 'create-video-url') state.createForm.videoUrl = fieldNode.value
    if (field === 'create-accounting-enabled') state.createForm.isTestAccountingEnabled = fieldNode.checked
    if (field === 'close-reason') state.closeReason = fieldNode.value
    if (field === 'accounting-confirmed') state.accountingConfirmed = fieldNode.checked
    return true
  }

  if (fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.pcsVideoField
    if (field === 'create-note') state.createForm.note = fieldNode.value
    if (field === 'close-note') state.closeNote = fieldNode.value
    if (field === 'accounting-note') state.accountingNote = fieldNode.value
    return true
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsVideoField
    if (field === 'statusFilter') state.statusFilter = fieldNode.value as PageState['statusFilter']
    if (field === 'purposeFilter') state.purposeFilter = fieldNode.value as PageState['purposeFilter']
    if (field === 'platformFilter') state.platformFilter = fieldNode.value as PageState['platformFilter']
    if (field === 'accountingFilter') state.accountingFilter = fieldNode.value as PageState['accountingFilter']
    if (field === 'pageSize') state.pageSize = parsePageSize(fieldNode.value)
    if (field === 'create-platform') state.createForm.platform = fieldNode.value as CreateFormState['platform']
    state.currentPage = 1
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-video-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsVideoAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'set-quick') {
    state.quickFilter = (actionNode.dataset.quickKey as QuickFilter | undefined) ?? 'all'
    state.currentPage = 1
    return true
  }

  if (action === 'reset-filters') {
    state.searchKeyword = ''
    state.statusFilter = 'all'
    state.purposeFilter = 'all'
    state.platformFilter = 'all'
    state.accountingFilter = 'all'
    state.quickFilter = 'all'
    state.currentPage = 1
    return true
  }

  if (action === 'go-detail') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return false
    appStore.navigate(`/pcs/testing/video/${recordId}`)
    return true
  }

  if (action === 'import-data') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return false
    state.notice = `${recordId} 已触发导入数据（演示态）。`
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
    const purpose = actionNode.dataset.purpose as VideoPurpose | undefined
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
    createRecord('DRAFT')
    return true
  }

  if (action === 'save-reconciling') {
    createRecord('RECONCILING')
    return true
  }

  if (action === 'open-close') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return false
    state.closeDialog = { open: true, recordId }
    state.closeReason = ''
    state.closeNote = ''
    return true
  }

  if (action === 'close-close') {
    state.closeDialog = { open: false, recordId: null }
    state.closeReason = ''
    state.closeNote = ''
    return true
  }

  if (action === 'confirm-close') {
    const selected = getRecordById(state.closeDialog.recordId)
    if (!selected) return false
    if (!state.closeNote.trim()) {
      state.notice = '请先填写关账备注。'
      return true
    }
    selected.status = 'COMPLETED'
    selected.updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
    state.closeDialog = { open: false, recordId: null }
    state.notice = `${selected.id} 已完成关账（演示态）。`
    return true
  }

  if (action === 'open-accounting') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return false
    state.accountingDialog = { open: true, recordId }
    state.accountingNote = ''
    state.accountingConfirmed = false
    return true
  }

  if (action === 'close-accounting') {
    state.accountingDialog = { open: false, recordId: null }
    state.accountingNote = ''
    state.accountingConfirmed = false
    return true
  }

  if (action === 'confirm-accounting') {
    const selected = getRecordById(state.accountingDialog.recordId)
    if (!selected) return false
    if (!state.accountingNote.trim()) {
      state.notice = '请先填写入账说明。'
      return true
    }
    if (!state.accountingConfirmed) {
      state.notice = '请确认测款条目已核对。'
      return true
    }
    selected.testAccountingStatus = 'ACCOUNTED'
    selected.updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
    state.accountingDialog = { open: false, recordId: null }
    state.notice = `${selected.id} 已完成测款入账（演示态）。`
    return true
  }

  if (action === 'prev-page') {
    state.currentPage = getPrevPage(state.currentPage)
    return true
  }

  if (action === 'next-page') {
    state.currentPage = getNextPage(state.currentPage, getFilteredRows().length, state.pageSize)
    return true
  }

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsVideoRecordsDialogOpen(): boolean {
  return state.createDrawerOpen || state.closeDialog.open || state.accountingDialog.open
}
