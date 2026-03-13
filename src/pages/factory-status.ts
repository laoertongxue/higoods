import {
  indonesiaFactories,
  tierLabels,
  typeLabels,
  type IndonesiaFactory,
  type FactoryTier,
} from '../data/fcs/indonesia-factories'
import { escapeHtml } from '../utils'

const PAGE_SIZE = 10

type UserRole = 'ADMIN' | 'OPS' | 'FINANCE' | 'VIEWER'
const currentUser: { role: UserRole; name: string } = {
  role: 'ADMIN',
  name: 'Admin User',
}
const canModify = ['ADMIN', 'OPS'].includes(currentUser.role)

type FactoryStatusType = 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED' | 'INACTIVE'

const statusConfig: Record<FactoryStatusType, { label: string; color: string }> = {
  ACTIVE: { label: '在合作', color: 'bg-green-100 text-green-700 border-green-200' },
  SUSPENDED: { label: '暂停', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  BLACKLISTED: { label: '黑名单', color: 'bg-red-100 text-red-700 border-red-200' },
  INACTIVE: { label: '未激活', color: 'bg-gray-100 text-gray-700 border-gray-200' },
}

interface StatusHistory {
  id: string
  factoryId: string
  oldStatus: FactoryStatusType
  newStatus: FactoryStatusType
  reason: string
  changedBy: string
  changedAt: string
}

interface ChangeLog {
  id: string
  action: 'STATUS_CHANGE' | 'BATCH_STATUS_CHANGE'
  targetIds: string[]
  targetNames: string[]
  oldValue?: string
  newValue: string
  reason: string
  operator: string
  timestamp: string
}

interface FactoryStatusState {
  factories: IndonesiaFactory[]
  historyRecords: StatusHistory[]
  changeLogs: ChangeLog[]

  keyword: string
  statusFilter: string
  tierFilter: string
  currentPage: number

  selectedIds: string[]
  openActionFactoryId: string | null

  changeDialogOpen: boolean
  batchChangeDialogOpen: boolean
  confirmDialogOpen: boolean
  historyDialogOpen: boolean
  changeLogDialogOpen: boolean
  pendingBatchConfirm: boolean

  targetFactoryId: string | null
  pendingStatus: FactoryStatusType
  pendingReason: string
  pendingNote: string
  reasonError: string

  viewingFactoryId: string | null
}

const initialHistoryData: StatusHistory[] = [
  {
    id: 'h1',
    factoryId: 'ID-F003',
    oldStatus: 'ACTIVE',
    newStatus: 'SUSPENDED',
    reason: 'Kapasitas produksi tidak mencukupi',
    changedBy: 'Budi Admin',
    changedAt: '2024-10-20 14:30:00',
  },
  {
    id: 'h2',
    factoryId: 'ID-F023',
    oldStatus: 'SUSPENDED',
    newStatus: 'BLACKLISTED',
    reason: 'Kualitas gagal 3x berturut-turut',
    changedBy: 'Siti OPS',
    changedAt: '2024-09-01 10:15:00',
  },
  {
    id: 'h3',
    factoryId: 'ID-F008',
    oldStatus: 'ACTIVE',
    newStatus: 'SUSPENDED',
    reason: 'Upgrade peralatan',
    changedBy: 'Ahmad Admin',
    changedAt: '2024-10-15 09:00:00',
  },
  {
    id: 'h4',
    factoryId: 'ID-F016',
    oldStatus: 'ACTIVE',
    newStatus: 'SUSPENDED',
    reason: 'Masalah kualitas',
    changedBy: 'Dewi OPS',
    changedAt: '2024-10-10 11:00:00',
  },
  {
    id: 'h5',
    factoryId: 'ID-F026',
    oldStatus: 'ACTIVE',
    newStatus: 'SUSPENDED',
    reason: 'Pemeliharaan peralatan',
    changedBy: 'Rudi Admin',
    changedAt: '2024-10-15 08:30:00',
  },
]

const state: FactoryStatusState = {
  factories: indonesiaFactories.map((factory) => ({ ...factory })),
  historyRecords: [...initialHistoryData],
  changeLogs: [],

  keyword: '',
  statusFilter: 'all',
  tierFilter: 'all',
  currentPage: 1,

  selectedIds: [],
  openActionFactoryId: null,

  changeDialogOpen: false,
  batchChangeDialogOpen: false,
  confirmDialogOpen: false,
  historyDialogOpen: false,
  changeLogDialogOpen: false,
  pendingBatchConfirm: false,

  targetFactoryId: null,
  pendingStatus: 'ACTIVE',
  pendingReason: '',
  pendingNote: '',
  reasonError: '',

  viewingFactoryId: null,
}

function getFilteredFactories(): IndonesiaFactory[] {
  const keyword = state.keyword.trim().toLowerCase()

  const result = state.factories.filter((factory) => {
    const matchKeyword =
      !keyword ||
      factory.name.toLowerCase().includes(keyword) ||
      factory.code.toLowerCase().includes(keyword) ||
      factory.contactName.toLowerCase().includes(keyword) ||
      factory.city.toLowerCase().includes(keyword)

    const matchStatus = state.statusFilter === 'all' || factory.status === state.statusFilter
    const matchTier = state.tierFilter === 'all' || factory.tier === state.tierFilter

    return matchKeyword && matchStatus && matchTier
  })

  result.sort((left, right) => left.code.localeCompare(right.code))
  return result
}

function getPagedFactories(filteredFactories: IndonesiaFactory[]): IndonesiaFactory[] {
  const start = (state.currentPage - 1) * PAGE_SIZE
  return filteredFactories.slice(start, start + PAGE_SIZE)
}

function getNow(): { date: string; full: string } {
  const now = new Date()
  return {
    date: now.toISOString().split('T')[0],
    full: now.toLocaleString('zh-CN'),
  }
}

function resetForm(): void {
  state.pendingStatus = 'ACTIVE'
  state.pendingReason = ''
  state.pendingNote = ''
  state.reasonError = ''
}

function closeAllDialogs(): void {
  state.changeDialogOpen = false
  state.batchChangeDialogOpen = false
  state.confirmDialogOpen = false
  state.historyDialogOpen = false
  state.changeLogDialogOpen = false
  state.pendingBatchConfirm = false
  state.reasonError = ''
  state.openActionFactoryId = null
}

function getTargetFactory(): IndonesiaFactory | null {
  if (!state.targetFactoryId) return null
  return state.factories.find((factory) => factory.id === state.targetFactoryId) ?? null
}

function getViewingFactory(): IndonesiaFactory | null {
  if (!state.viewingFactoryId) return null
  return state.factories.find((factory) => factory.id === state.viewingFactoryId) ?? null
}

function getFactoryHistory(factoryId: string | null): StatusHistory[] {
  if (!factoryId) return []
  return state.historyRecords.filter((record) => record.factoryId === factoryId)
}

function getLastReason(factoryId: string): string {
  const history = state.historyRecords.find((record) => record.factoryId === factoryId)
  return history?.reason ?? '-'
}

function validateForm(): boolean {
  if (!state.pendingReason.trim()) {
    state.reasonError = '变更原因为必填项'
    return false
  }

  if (
    (state.pendingStatus === 'BLACKLISTED' || state.pendingStatus === 'SUSPENDED') &&
    state.pendingReason.trim().length < 5
  ) {
    state.reasonError = '黑名单/暂停状态需要详细说明原因（至少5个字）'
    return false
  }

  state.reasonError = ''
  return true
}

function executeSingleChange(): void {
  const targetFactory = getTargetFactory()
  if (!targetFactory) return

  const { date, full } = getNow()

  state.factories = state.factories.map((factory) =>
    factory.id === targetFactory.id
      ? {
          ...factory,
          status: state.pendingStatus,
          updatedAt: date,
        }
      : factory,
  )

  const history: StatusHistory = {
    id: `h-${Date.now()}`,
    factoryId: targetFactory.id,
    oldStatus: targetFactory.status as FactoryStatusType,
    newStatus: state.pendingStatus,
    reason: state.pendingReason,
    changedBy: currentUser.name,
    changedAt: full,
  }
  state.historyRecords = [history, ...state.historyRecords]

  const log: ChangeLog = {
    id: `log-${Date.now()}`,
    action: 'STATUS_CHANGE',
    targetIds: [targetFactory.id],
    targetNames: [targetFactory.name],
    oldValue: statusConfig[targetFactory.status as FactoryStatusType].label,
    newValue: statusConfig[state.pendingStatus].label,
    reason: state.pendingReason,
    operator: currentUser.name,
    timestamp: full,
  }
  state.changeLogs = [log, ...state.changeLogs]

  closeAllDialogs()
}

function executeBatchChange(): void {
  if (state.selectedIds.length === 0) return

  const { date, full } = getNow()
  const targetFactories = state.factories.filter((factory) => state.selectedIds.includes(factory.id))

  state.factories = state.factories.map((factory) =>
    state.selectedIds.includes(factory.id)
      ? {
          ...factory,
          status: state.pendingStatus,
          updatedAt: date,
        }
      : factory,
  )

  const histories: StatusHistory[] = targetFactories.map((factory, index) => ({
    id: `h-${Date.now()}-${index}`,
    factoryId: factory.id,
    oldStatus: factory.status as FactoryStatusType,
    newStatus: state.pendingStatus,
    reason: state.pendingReason,
    changedBy: currentUser.name,
    changedAt: full,
  }))
  state.historyRecords = [...histories, ...state.historyRecords]

  const log: ChangeLog = {
    id: `log-${Date.now()}`,
    action: 'BATCH_STATUS_CHANGE',
    targetIds: [...state.selectedIds],
    targetNames: targetFactories.map((factory) => factory.name),
    newValue: statusConfig[state.pendingStatus].label,
    reason: state.pendingReason,
    operator: currentUser.name,
    timestamp: full,
  }
  state.changeLogs = [log, ...state.changeLogs]

  state.selectedIds = []
  closeAllDialogs()
}

function renderStatusBadge(status: FactoryStatusType): string {
  return `<span class="inline-flex rounded border px-2 py-0.5 text-xs ${statusConfig[status].color}">${statusConfig[status].label}</span>`
}

function renderSingleChangeDialog(): string {
  if (!state.changeDialogOpen) return ''
  const targetFactory = getTargetFactory()

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-status-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">变更工厂状态</h3>
          <p class="mt-1 text-sm text-muted-foreground">修改工厂的合作状态，黑名单/暂停状态将影响派单资格</p>
        </header>

        <div class="space-y-4 px-6 py-4">
          <label class="space-y-1.5">
            <span class="text-sm font-medium">工厂</span>
            <input class="w-full rounded-md border px-3 py-2 text-sm bg-muted/40" value="${escapeHtml(targetFactory?.name ?? '')}" disabled />
          </label>

          <div class="space-y-1.5">
            <span class="text-sm font-medium">当前状态</span>
            <div>${targetFactory ? renderStatusBadge(targetFactory.status as FactoryStatusType) : '-'}</div>
          </div>

          <div class="h-px bg-border"></div>

          <label class="space-y-1.5">
            <span class="text-sm font-medium">新状态 <span class="text-red-500">*</span></span>
            <select data-status-field="pending-status" class="w-full rounded-md border px-3 py-2 text-sm">
              ${(Object.keys(statusConfig) as FactoryStatusType[])
                .map(
                  (status) =>
                    `<option value="${status}" ${state.pendingStatus === status ? 'selected' : ''}>${statusConfig[status].label}</option>`,
                )
                .join('')}
            </select>
            ${
              state.pendingStatus === 'BLACKLISTED' || state.pendingStatus === 'SUSPENDED'
                ? `<p class="flex items-center gap-1 text-xs text-amber-600"><i data-lucide="alert-triangle" class="h-3 w-3"></i>此状态将阻止工厂接收派单</p>`
                : ''
            }
          </label>

          <label class="space-y-1.5">
            <span class="text-sm font-medium">变更原因 <span class="text-red-500">*</span></span>
            <textarea data-status-field="pending-reason" rows="3" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="请输入变更原因（必填）">${escapeHtml(state.pendingReason)}</textarea>
            ${state.reasonError ? `<p class="text-sm text-red-500">${escapeHtml(state.reasonError)}</p>` : ''}
          </label>

          <label class="space-y-1.5">
            <span class="text-sm font-medium">备注</span>
            <textarea data-status-field="pending-note" rows="2" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="可选备注">${escapeHtml(state.pendingNote)}</textarea>
          </label>

          <p class="text-xs text-muted-foreground">生效时间：立即生效</p>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-status-action="close-dialog">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-status-action="submit-single-change">确认变更</button>
        </footer>
      </section>
    </div>
  `
}

function renderBatchChangeDialog(): string {
  if (!state.batchChangeDialogOpen) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-status-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">批量变更状态</h3>
          <p class="mt-1 text-sm text-muted-foreground">将对 ${state.selectedIds.length} 个工厂进行状态变更</p>
        </header>

        <div class="space-y-4 px-6 py-4">
          <label class="space-y-1.5">
            <span class="text-sm font-medium">新状态 <span class="text-red-500">*</span></span>
            <select data-status-field="pending-status" class="w-full rounded-md border px-3 py-2 text-sm">
              ${(Object.keys(statusConfig) as FactoryStatusType[])
                .map(
                  (status) =>
                    `<option value="${status}" ${state.pendingStatus === status ? 'selected' : ''}>${statusConfig[status].label}</option>`,
                )
                .join('')}
            </select>
            ${
              state.pendingStatus === 'BLACKLISTED' || state.pendingStatus === 'SUSPENDED'
                ? `<p class="flex items-center gap-1 text-xs text-amber-600"><i data-lucide="alert-triangle" class="h-3 w-3"></i>此状态将阻止工厂接收派单</p>`
                : ''
            }
          </label>

          <label class="space-y-1.5">
            <span class="text-sm font-medium">变更原因 <span class="text-red-500">*</span></span>
            <textarea data-status-field="pending-reason" rows="3" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="请输入变更原因（必填）">${escapeHtml(state.pendingReason)}</textarea>
            ${state.reasonError ? `<p class="text-sm text-red-500">${escapeHtml(state.reasonError)}</p>` : ''}
          </label>

          <label class="space-y-1.5">
            <span class="text-sm font-medium">备注</span>
            <textarea data-status-field="pending-note" rows="2" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="可选备注">${escapeHtml(state.pendingNote)}</textarea>
          </label>

          <p class="text-xs text-muted-foreground">生效时间：立即生效</p>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-status-action="close-dialog">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-status-action="submit-batch-change">确认变更</button>
        </footer>
      </section>
    </div>
  `
}

function renderConfirmDialog(): string {
  if (!state.confirmDialogOpen) return ''

  const warningText =
    state.pendingStatus === 'BLACKLISTED'
      ? '将工厂列入黑名单后，该工厂将无法接收新任务。'
      : '暂停合作后，该工厂将暂时无法接收新任务。'

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-status-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="px-6 py-5">
          <h3 class="flex items-center gap-2 text-lg font-semibold">
            <i data-lucide="alert-triangle" class="h-5 w-5 text-yellow-500"></i>
            确认变更为"${statusConfig[state.pendingStatus].label}"？
          </h3>
          <p class="mt-2 text-sm text-muted-foreground">${warningText}</p>
          <p class="mt-2 text-sm"><span class="font-medium">原因：</span>${escapeHtml(state.pendingReason)}</p>
          ${state.pendingBatchConfirm ? `<p class="mt-1 text-sm"><span class="font-medium">影响工厂数：</span>${state.selectedIds.length} 家</p>` : ''}
        </header>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-status-action="back-from-confirm">返回修改</button>
          <button class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700" data-status-action="confirm-execute">确认执行</button>
        </footer>
      </section>
    </div>
  `
}

function renderHistoryDialog(): string {
  if (!state.historyDialogOpen) return ''

  const viewingFactory = getViewingFactory()
  const factoryHistory = getFactoryHistory(state.viewingFactoryId)

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-status-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">状态变更历史 - ${escapeHtml(viewingFactory?.name ?? '')}</h3>
          <p class="mt-1 text-sm text-muted-foreground">工厂编号：${escapeHtml(viewingFactory?.code ?? '')} | 层级：${escapeHtml(viewingFactory ? tierLabels[viewingFactory.tier] : '')} | 类型：${escapeHtml(viewingFactory ? typeLabels[viewingFactory.type] : '')}</p>
        </header>

        <div class="max-h-[400px] overflow-auto px-6 py-4">
          ${
            factoryHistory.length > 0
              ? `
                <table class="w-full text-sm">
                  <thead class="border-b bg-muted/30">
                    <tr>
                      <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">原状态</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">新状态</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">变更原因</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">操作人</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">变更时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${factoryHistory
                      .map(
                        (history) => `
                          <tr class="border-b last:border-0">
                            <td class="px-3 py-2">${renderStatusBadge(history.oldStatus)}</td>
                            <td class="px-3 py-2">${renderStatusBadge(history.newStatus)}</td>
                            <td class="max-w-[200px] truncate px-3 py-2" title="${escapeHtml(history.reason)}">${escapeHtml(history.reason)}</td>
                            <td class="px-3 py-2">${escapeHtml(history.changedBy)}</td>
                            <td class="px-3 py-2 text-sm">${escapeHtml(history.changedAt)}</td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              `
              : '<div class="py-8 text-center text-muted-foreground">暂无变更记录</div>'
          }
        </div>
      </section>
    </div>
  `
}

function renderLogDialog(): string {
  if (!state.changeLogDialogOpen) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-status-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">变更日志</h3>
          <p class="mt-1 text-sm text-muted-foreground">所有状态变更操作的记录</p>
        </header>

        <div class="max-h-[400px] overflow-auto px-6 py-4">
          ${
            state.changeLogs.length > 0
              ? `
                <table class="w-full text-sm">
                  <thead class="border-b bg-muted/30">
                    <tr>
                      <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">操作类型</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">目标工厂</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">变更内容</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">原因</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">操作人</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${state.changeLogs
                      .map((log) => {
                        const targetNames =
                          log.targetNames.length > 2
                            ? `${log.targetNames.slice(0, 2).join(', ')} 等${log.targetNames.length}家`
                            : log.targetNames.join(', ')

                        return `
                          <tr class="border-b last:border-0">
                            <td class="px-3 py-2">
                              <span class="inline-flex rounded border px-2 py-0.5 text-xs">
                                ${log.action === 'BATCH_STATUS_CHANGE' ? '批量变更' : '状态变更'}
                              </span>
                            </td>
                            <td class="max-w-[150px] truncate px-3 py-2" title="${escapeHtml(targetNames)}">${escapeHtml(targetNames)}</td>
                            <td class="px-3 py-2">${log.oldValue ? `${escapeHtml(log.oldValue)} → ` : ''}${escapeHtml(log.newValue)}</td>
                            <td class="max-w-[150px] truncate px-3 py-2">${escapeHtml(log.reason)}</td>
                            <td class="px-3 py-2">${escapeHtml(log.operator)}</td>
                            <td class="px-3 py-2 text-sm">${escapeHtml(log.timestamp)}</td>
                          </tr>
                        `
                      })
                      .join('')}
                  </tbody>
                </table>
              `
              : '<div class="py-8 text-center text-muted-foreground">暂无变更日志</div>'
          }
        </div>
      </section>
    </div>
  `
}

function renderPagination(totalPages: number): string {
  return `
    <div class="flex items-center gap-2">
      <button
        class="inline-flex h-8 w-8 items-center justify-center rounded-md border ${state.currentPage === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}"
        data-status-action="prev-page"
      >
        <i data-lucide="chevron-left" class="h-4 w-4"></i>
      </button>
      <span class="text-sm">${state.currentPage} / ${totalPages || 1}</span>
      <button
        class="inline-flex h-8 w-8 items-center justify-center rounded-md border ${state.currentPage >= totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}"
        data-status-action="next-page"
      >
        <i data-lucide="chevron-right" class="h-4 w-4"></i>
      </button>
    </div>
  `
}

export function renderFactoryStatusPage(): string {
  const filteredFactories = getFilteredFactories()
  const totalPages = Math.ceil(filteredFactories.length / PAGE_SIZE)

  const pagedFactories = getPagedFactories(filteredFactories)
  const allSelected =
    pagedFactories.length > 0 && pagedFactories.every((factory) => state.selectedIds.includes(factory.id))

  return `
    <div class="space-y-6">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">工厂状态</h1>
          <p class="mt-1 text-sm text-muted-foreground">管理工厂合作状态，控制派单资格（变更立即生效）</p>
        </div>
        <div class="flex items-center gap-2">
          ${
            canModify
              ? `<button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${state.selectedIds.length === 0 ? 'pointer-events-none opacity-50' : ''}" data-status-action="open-batch-change">批量变更状态 ${state.selectedIds.length > 0 ? `(${state.selectedIds.length})` : ''}</button>`
              : ''
          }
          <button class="inline-flex items-center rounded-md border px-4 py-2 text-sm hover:bg-muted" data-status-action="open-log">
            <i data-lucide="file-text" class="mr-2 h-4 w-4"></i>
            变更日志
          </button>
        </div>
      </header>

      <section class="flex flex-wrap items-center gap-4 rounded-lg bg-muted/30 p-4">
        <div class="flex min-w-[200px] max-w-sm flex-1 items-center gap-2">
          <i data-lucide="search" class="h-4 w-4 text-muted-foreground"></i>
          <input
            data-status-filter="keyword"
            value="${escapeHtml(state.keyword)}"
            placeholder="搜索工厂名称/编号/联系人/城市..."
            class="w-full flex-1 rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <select data-status-filter="tier" class="w-[140px] rounded-md border px-3 py-2 text-sm">
          <option value="all" ${state.tierFilter === 'all' ? 'selected' : ''}>全部层级</option>
          <option value="CENTRAL" ${state.tierFilter === 'CENTRAL' ? 'selected' : ''}>中央工厂</option>
          <option value="SATELLITE" ${state.tierFilter === 'SATELLITE' ? 'selected' : ''}>卫星工厂</option>
          <option value="THIRD_PARTY" ${state.tierFilter === 'THIRD_PARTY' ? 'selected' : ''}>第三方</option>
        </select>

        <select data-status-filter="status" class="w-[140px] rounded-md border px-3 py-2 text-sm">
          <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
          ${(Object.keys(statusConfig) as FactoryStatusType[])
            .map(
              (status) =>
                `<option value="${status}" ${state.statusFilter === status ? 'selected' : ''}>${statusConfig[status].label}</option>`,
            )
            .join('')}
        </select>

        <div class="flex items-center gap-2">
          <button class="rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-secondary/80" data-status-action="query">查询</button>
          <button class="inline-flex items-center rounded-md px-3 py-2 text-sm hover:bg-muted" data-status-action="reset">
            <i data-lucide="refresh-cw" class="mr-2 h-4 w-4"></i>
            重置
          </button>
        </div>
      </section>

      <section class="overflow-x-auto rounded-lg border">
        <table class="w-full min-w-[1250px] text-sm">
          <thead class="border-b bg-muted/50">
            <tr>
              ${
                canModify
                  ? `<th class="w-12 px-3 py-3 text-left text-xs font-medium text-muted-foreground"><input type="checkbox" ${allSelected ? 'checked' : ''} data-status-action="toggle-all" /></th>`
                  : ''
              }
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">工厂名称</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">编号</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">层级</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">类型</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">当前状态</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">状态原因</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">生效时间</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">最近更新</th>
              <th class="w-[80px] px-3 py-3 text-right text-xs font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              pagedFactories.length === 0
                ? `<tr><td colspan="${canModify ? 10 : 9}" class="h-24 px-3 text-center text-muted-foreground">暂无数据</td></tr>`
                : pagedFactories
                    .map((factory) => {
                      const checked = state.selectedIds.includes(factory.id)
                      return `
                        <tr class="border-b last:border-0">
                          ${
                            canModify
                              ? `<td class="px-3 py-3"><input type="checkbox" ${checked ? 'checked' : ''} data-status-action="toggle-select" data-factory-id="${factory.id}" /></td>`
                              : ''
                          }
                          <td class="px-3 py-3 font-medium">${escapeHtml(factory.name)}</td>
                          <td class="px-3 py-3 font-mono text-sm">${escapeHtml(factory.code)}</td>
                          <td class="px-3 py-3"><span class="inline-flex rounded border px-2 py-0.5 text-xs">${escapeHtml(tierLabels[factory.tier])}</span></td>
                          <td class="px-3 py-3"><span class="inline-flex rounded border bg-secondary px-2 py-0.5 text-xs">${escapeHtml(typeLabels[factory.type])}</span></td>
                          <td class="px-3 py-3">${renderStatusBadge(factory.status as FactoryStatusType)}</td>
                          <td class="max-w-[200px] truncate px-3 py-3 text-sm text-muted-foreground" title="${escapeHtml(getLastReason(factory.id))}">${escapeHtml(getLastReason(factory.id))}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(factory.createdAt)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(factory.updatedAt)}</td>
                          <td class="px-3 py-3 text-right">
                            <div class="relative inline-block text-left" data-status-menu-root="true">
                              <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-status-action="toggle-action-menu" data-factory-id="${factory.id}">
                                <i data-lucide="more-horizontal" class="h-4 w-4"></i>
                              </button>
                              ${
                                state.openActionFactoryId === factory.id
                                  ? `
                                    <div class="absolute right-0 z-20 mt-1 min-w-[130px] rounded-md border bg-background p-1 shadow-lg">
                                      ${
                                        canModify
                                          ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-status-action="open-single-change" data-factory-id="${factory.id}"><i data-lucide="edit" class="mr-2 h-4 w-4"></i>变更状态</button>`
                                          : ''
                                      }
                                      <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-status-action="open-history" data-factory-id="${factory.id}"><i data-lucide="history" class="mr-2 h-4 w-4"></i>查看历史</button>
                                    </div>
                                  `
                                  : ''
                              }
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

      <footer class="flex items-center justify-between">
        <p class="text-sm text-muted-foreground">
          ${canModify && state.selectedIds.length > 0 ? `已选择 ${state.selectedIds.length} 项，` : ''}共 ${filteredFactories.length} 条记录
        </p>
        ${renderPagination(totalPages)}
      </footer>

      ${renderSingleChangeDialog()}
      ${renderBatchChangeDialog()}
      ${renderConfirmDialog()}
      ${renderHistoryDialog()}
      ${renderLogDialog()}
    </div>
  `
}

export function handleFactoryStatusEvent(target: HTMLElement): boolean {
  const statusField = target.closest<HTMLElement>('[data-status-field]')
  if (statusField instanceof HTMLTextAreaElement || statusField instanceof HTMLSelectElement) {
    const field = statusField.dataset.statusField
    const value = statusField.value

    if (field === 'pending-status') state.pendingStatus = value as FactoryStatusType
    if (field === 'pending-reason') {
      state.pendingReason = value
      state.reasonError = ''
    }
    if (field === 'pending-note') state.pendingNote = value
    return true
  }

  const filterNode = target.closest<HTMLElement>('[data-status-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const filter = filterNode.dataset.statusFilter
    const value = filterNode.value

    if (filter === 'keyword') state.keyword = value
    if (filter === 'tier') state.tierFilter = value as 'all' | FactoryTier
    if (filter === 'status') state.statusFilter = value

    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-status-action]')
  if (!actionNode) {
    if (state.openActionFactoryId && !target.closest('[data-status-menu-root]')) {
      state.openActionFactoryId = null
      return true
    }
    return false
  }

  const action = actionNode.dataset.statusAction
  if (!action) return false

  if (action === 'query') {
    state.currentPage = 1
    return true
  }

  if (action === 'reset') {
    state.keyword = ''
    state.statusFilter = 'all'
    state.tierFilter = 'all'
    state.currentPage = 1
    state.selectedIds = []
    state.openActionFactoryId = null
    return true
  }

  if (action === 'toggle-all') {
    const pagedFactories = getPagedFactories(getFilteredFactories())
    const allSelected =
      pagedFactories.length > 0 && pagedFactories.every((factory) => state.selectedIds.includes(factory.id))

    if (allSelected) {
      state.selectedIds = []
    } else {
      state.selectedIds = pagedFactories.map((factory) => factory.id)
    }

    return true
  }

  if (action === 'toggle-select') {
    const factoryId = actionNode.dataset.factoryId
    if (!factoryId) return true

    if (state.selectedIds.includes(factoryId)) {
      state.selectedIds = state.selectedIds.filter((id) => id !== factoryId)
    } else {
      state.selectedIds = [...state.selectedIds, factoryId]
    }
    return true
  }

  if (action === 'toggle-action-menu') {
    const factoryId = actionNode.dataset.factoryId
    if (!factoryId) return true
    state.openActionFactoryId = state.openActionFactoryId === factoryId ? null : factoryId
    return true
  }

  if (action === 'open-single-change') {
    const factoryId = actionNode.dataset.factoryId
    if (!factoryId) return true

    const factory = state.factories.find((item) => item.id === factoryId)
    if (!factory) return true

    state.openActionFactoryId = null
    state.targetFactoryId = factoryId
    state.pendingStatus = factory.status as FactoryStatusType
    state.pendingReason = ''
    state.pendingNote = ''
    state.reasonError = ''
    state.pendingBatchConfirm = false
    state.changeDialogOpen = true
    state.batchChangeDialogOpen = false
    return true
  }

  if (action === 'open-batch-change') {
    if (state.selectedIds.length === 0) return true

    resetForm()
    state.targetFactoryId = null
    state.pendingBatchConfirm = false
    state.batchChangeDialogOpen = true
    state.changeDialogOpen = false
    state.openActionFactoryId = null
    return true
  }

  if (action === 'submit-single-change') {
    if (!validateForm()) return true

    if (state.pendingStatus === 'BLACKLISTED' || state.pendingStatus === 'SUSPENDED') {
      state.pendingBatchConfirm = false
      state.changeDialogOpen = false
      state.confirmDialogOpen = true
      return true
    }

    executeSingleChange()
    return true
  }

  if (action === 'submit-batch-change') {
    if (!validateForm()) return true

    if (state.pendingStatus === 'BLACKLISTED' || state.pendingStatus === 'SUSPENDED') {
      state.pendingBatchConfirm = true
      state.batchChangeDialogOpen = false
      state.confirmDialogOpen = true
      return true
    }

    executeBatchChange()
    return true
  }

  if (action === 'confirm-execute') {
    if (state.pendingBatchConfirm) {
      executeBatchChange()
    } else {
      executeSingleChange()
    }
    return true
  }

  if (action === 'back-from-confirm') {
    state.confirmDialogOpen = false
    if (state.pendingBatchConfirm) {
      state.batchChangeDialogOpen = true
    } else {
      state.changeDialogOpen = true
    }
    return true
  }

  if (action === 'open-history') {
    const factoryId = actionNode.dataset.factoryId
    if (!factoryId) return true
    state.openActionFactoryId = null
    state.viewingFactoryId = factoryId
    state.historyDialogOpen = true
    return true
  }

  if (action === 'open-log') {
    state.openActionFactoryId = null
    state.changeLogDialogOpen = true
    return true
  }

  const totalPages = Math.max(1, Math.ceil(getFilteredFactories().length / PAGE_SIZE))

  if (action === 'prev-page') {
    state.currentPage = Math.max(1, state.currentPage - 1)
    state.openActionFactoryId = null
    return true
  }

  if (action === 'next-page') {
    state.currentPage = Math.min(totalPages, state.currentPage + 1)
    state.openActionFactoryId = null
    return true
  }

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isFactoryStatusDialogOpen(): boolean {
  return (
    state.changeDialogOpen ||
    state.batchChangeDialogOpen ||
    state.confirmDialogOpen ||
    state.historyDialogOpen ||
    state.changeLogDialogOpen
  )
}
