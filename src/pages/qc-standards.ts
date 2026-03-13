import { processTasks } from '../data/fcs/process-tasks'
import {
  initialQcStandardSheets,
  type QcStandardSheet,
  type QcStandardStatus,
} from '../data/fcs/store-domain-dispatch-process'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { escapeHtml } from '../utils'

applyQualitySeedBootstrap()

type StatusFilter = 'ALL' | QcStandardStatus

interface CreateForm {
  taskId: string
  checkpointSummaryZh: string
  acceptanceSummaryZh: string
  samplingSummaryZh: string
  remark: string
}

interface EditForm {
  checkpointSummaryZh: string
  acceptanceSummaryZh: string
  samplingSummaryZh: string
  remark: string
}

interface QcStandardsState {
  keyword: string
  statusFilter: StatusFilter

  createOpen: boolean
  createForm: CreateForm

  editOpen: boolean
  editTargetId: string | null
  editForm: EditForm

  statusOpen: boolean
  statusTargetId: string | null
  nextStatus: QcStandardStatus | ''
  statusRemark: string
}

const STATUS_LABEL: Record<QcStandardStatus, string> = {
  DRAFT: '草稿',
  TO_RELEASE: '待下发',
  RELEASED: '已下发',
  VOID: '已作废',
}

const STATUS_CLASS: Record<QcStandardStatus, string> = {
  DRAFT: 'border bg-secondary text-secondary-foreground',
  TO_RELEASE: 'border bg-background text-foreground',
  RELEASED: 'border border-blue-200 bg-blue-100 text-blue-700',
  VOID: 'border border-red-200 bg-red-100 text-red-700',
}

const ALLOWED_NEXT: Record<QcStandardStatus, QcStandardStatus[]> = {
  DRAFT: ['TO_RELEASE', 'VOID'],
  TO_RELEASE: ['RELEASED', 'VOID'],
  RELEASED: [],
  VOID: [],
}

const state: QcStandardsState = {
  keyword: '',
  statusFilter: 'ALL',

  createOpen: false,
  createForm: emptyCreateForm(),

  editOpen: false,
  editTargetId: null,
  editForm: emptyEditForm(),

  statusOpen: false,
  statusTargetId: null,
  nextStatus: '',
  statusRemark: '',
}

function emptyCreateForm(): CreateForm {
  return {
    taskId: '',
    checkpointSummaryZh: '',
    acceptanceSummaryZh: '',
    samplingSummaryZh: '',
    remark: '',
  }
}

function emptyEditForm(): EditForm {
  return {
    checkpointSummaryZh: '',
    acceptanceSummaryZh: '',
    samplingSummaryZh: '',
    remark: '',
  }
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function showQcStandardsToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'qc-standards-toast-root'
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
      if (root && root.childElementCount === 0) {
        root.remove()
      }
    }, 180)
  }, 2200)
}

function getSheets(): QcStandardSheet[] {
  return initialQcStandardSheets
}

function getSheetById(standardId: string | null): QcStandardSheet | null {
  if (!standardId) return null
  return getSheets().find((item) => item.standardId === standardId) ?? null
}

function createQcStandardSheet(
  input: {
    taskId: string
    productionOrderId?: string
    checkpointSummaryZh: string
    acceptanceSummaryZh: string
    samplingSummaryZh?: string
    remark?: string
  },
  by: string,
): { ok: boolean; standardId?: string; message?: string } {
  const { taskId, checkpointSummaryZh, acceptanceSummaryZh, samplingSummaryZh, remark } = input

  if (!taskId.trim()) return { ok: false, message: '任务ID不能为空' }

  const task = processTasks.find((item) => item.taskId === taskId)
  if (!task) return { ok: false, message: `任务 ${taskId} 不存在` }

  if (!checkpointSummaryZh.trim()) return { ok: false, message: '质检点摘要不能为空' }
  if (!acceptanceSummaryZh.trim()) return { ok: false, message: '验收标准摘要不能为空' }

  const ts = nowTimestamp()
  const month = ts.slice(0, 7).replace('-', '')
  const standardId = `QCS-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
  const productionOrderId = input.productionOrderId ?? task.productionOrderId

  getSheets().push({
    standardId,
    productionOrderId,
    taskId,
    checkpointSummaryZh: checkpointSummaryZh.trim(),
    acceptanceSummaryZh: acceptanceSummaryZh.trim(),
    samplingSummaryZh: samplingSummaryZh?.trim(),
    status: 'DRAFT',
    remark,
    createdAt: ts,
    createdBy: by,
  })

  return { ok: true, standardId }
}

function updateQcStandardSheet(
  input: {
    standardId: string
    checkpointSummaryZh?: string
    acceptanceSummaryZh?: string
    samplingSummaryZh?: string
    remark?: string
  },
  by: string,
): { ok: boolean; message?: string } {
  const { standardId, checkpointSummaryZh, acceptanceSummaryZh, samplingSummaryZh, remark } = input

  const sheet = getSheets().find((item) => item.standardId === standardId)
  if (!sheet) return { ok: false, message: `质检标准单 ${standardId} 不存在` }

  if (checkpointSummaryZh !== undefined && !checkpointSummaryZh.trim()) {
    return { ok: false, message: '质检点摘要不能为空' }
  }

  if (acceptanceSummaryZh !== undefined && !acceptanceSummaryZh.trim()) {
    return { ok: false, message: '验收标准摘要不能为空' }
  }

  sheet.checkpointSummaryZh = checkpointSummaryZh?.trim() ?? sheet.checkpointSummaryZh
  sheet.acceptanceSummaryZh = acceptanceSummaryZh?.trim() ?? sheet.acceptanceSummaryZh
  sheet.samplingSummaryZh = samplingSummaryZh?.trim() ?? sheet.samplingSummaryZh
  sheet.remark = remark ?? sheet.remark
  sheet.updatedAt = nowTimestamp()
  sheet.updatedBy = by

  return { ok: true }
}

function updateQcStandardStatus(
  input: { standardId: string; nextStatus: QcStandardStatus; remark?: string },
  by: string,
): { ok: boolean; message?: string } {
  const { standardId, nextStatus, remark } = input

  const sheet = getSheets().find((item) => item.standardId === standardId)
  if (!sheet) return { ok: false, message: `质检标准单 ${standardId} 不存在` }

  if (!nextStatus) return { ok: false, message: '目标状态不能为空' }

  if (!ALLOWED_NEXT[sheet.status].includes(nextStatus)) {
    return { ok: false, message: '当前标准状态不允许切换到目标状态' }
  }

  sheet.status = nextStatus
  sheet.remark = remark ?? sheet.remark
  sheet.updatedAt = nowTimestamp()
  sheet.updatedBy = by

  return { ok: true }
}

function openEditDialog(sheet: QcStandardSheet): void {
  state.editOpen = true
  state.editTargetId = sheet.standardId
  state.editForm = {
    checkpointSummaryZh: sheet.checkpointSummaryZh,
    acceptanceSummaryZh: sheet.acceptanceSummaryZh,
    samplingSummaryZh: sheet.samplingSummaryZh ?? '',
    remark: sheet.remark ?? '',
  }
}

function openStatusDialog(sheet: QcStandardSheet): void {
  state.statusOpen = true
  state.statusTargetId = sheet.standardId
  state.nextStatus = ''
  state.statusRemark = ''
}

function closeCreateDialog(): void {
  state.createOpen = false
}

function closeEditDialog(): void {
  state.editOpen = false
  state.editTargetId = null
  state.editForm = emptyEditForm()
}

function closeStatusDialog(): void {
  state.statusOpen = false
  state.statusTargetId = null
  state.nextStatus = ''
  state.statusRemark = ''
}

function renderCreateDialog(): string {
  if (!state.createOpen) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-qcs-action="close-create" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 max-h-[86vh] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-qcs-action="close-create" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <h3 class="text-lg font-semibold">新建质检标准</h3>

        <div class="mt-4 space-y-4">
          <div class="space-y-1.5">
            <label class="text-sm font-medium">任务 <span class="text-red-600">*</span></label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcs-field="create.taskId">
              <option value="" ${state.createForm.taskId === '' ? 'selected' : ''}>选择任务</option>
              ${processTasks
                .map(
                  (task) =>
                    `<option value="${escapeHtml(task.taskId)}" ${
                      state.createForm.taskId === task.taskId ? 'selected' : ''
                    }>${escapeHtml(task.taskId)}${task.processNameZh ? ` - ${escapeHtml(task.processNameZh)}` : ''}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">质检点摘要 <span class="text-red-600">*</span></label>
            <textarea
              rows="2"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="请输入质检点摘要"
              data-qcs-field="create.checkpointSummaryZh"
            >${escapeHtml(state.createForm.checkpointSummaryZh)}</textarea>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">验收标准摘要 <span class="text-red-600">*</span></label>
            <textarea
              rows="2"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="请输入验收标准摘要"
              data-qcs-field="create.acceptanceSummaryZh"
            >${escapeHtml(state.createForm.acceptanceSummaryZh)}</textarea>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">抽检说明</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="可选"
              data-qcs-field="create.samplingSummaryZh"
              value="${escapeHtml(state.createForm.samplingSummaryZh)}"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">备注</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="可选"
              data-qcs-field="create.remark"
              value="${escapeHtml(state.createForm.remark)}"
            />
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-qcs-action="close-create">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-qcs-action="submit-create">保存</button>
        </div>
      </div>
    </div>
  `
}

function renderEditDialog(editTarget: QcStandardSheet | null): string {
  if (!state.editOpen || !editTarget) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-qcs-action="close-edit" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 max-h-[86vh] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-qcs-action="close-edit" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <h3 class="text-lg font-semibold">编辑质检标准</h3>

        <div class="mt-4 space-y-4">
          <div class="space-y-1.5">
            <label class="text-sm font-medium">质检点摘要 <span class="text-red-600">*</span></label>
            <textarea
              rows="2"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
              data-qcs-field="edit.checkpointSummaryZh"
            >${escapeHtml(state.editForm.checkpointSummaryZh)}</textarea>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">验收标准摘要 <span class="text-red-600">*</span></label>
            <textarea
              rows="2"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
              data-qcs-field="edit.acceptanceSummaryZh"
            >${escapeHtml(state.editForm.acceptanceSummaryZh)}</textarea>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">抽检说明</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="可选"
              data-qcs-field="edit.samplingSummaryZh"
              value="${escapeHtml(state.editForm.samplingSummaryZh)}"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">备注</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="可选"
              data-qcs-field="edit.remark"
              value="${escapeHtml(state.editForm.remark)}"
            />
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-qcs-action="close-edit">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-qcs-action="submit-edit">保存</button>
        </div>
      </div>
    </div>
  `
}

function renderStatusDialog(statusTarget: QcStandardSheet | null): string {
  if (!state.statusOpen || !statusTarget) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-qcs-action="close-status" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-qcs-action="close-status" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <h3 class="text-lg font-semibold">变更标准状态</h3>

        <div class="mt-4 space-y-4">
          <div class="space-y-1.5">
            <label class="text-sm font-medium">当前状态</label>
            <input class="h-9 w-full cursor-default rounded-md border bg-muted px-3 text-sm" readonly value="${escapeHtml(STATUS_LABEL[statusTarget.status])}" />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">目标状态 <span class="text-red-600">*</span></label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcs-field="status.nextStatus">
              <option value="" ${state.nextStatus === '' ? 'selected' : ''}>选择目标状态</option>
              ${ALLOWED_NEXT[statusTarget.status]
                .map(
                  (status) =>
                    `<option value="${status}" ${state.nextStatus === status ? 'selected' : ''}>${STATUS_LABEL[status]}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">备注</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="可选"
              data-qcs-field="status.remark"
              value="${escapeHtml(state.statusRemark)}"
            />
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-qcs-action="close-status">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            !state.nextStatus ? 'pointer-events-none opacity-50' : ''
          }" data-qcs-action="submit-status">保存</button>
        </div>
      </div>
    </div>
  `
}

export function renderQcStandardsPage(): string {
  const sheets = getSheets()
  const keyword = state.keyword.trim().toLowerCase()

  const filtered = sheets.filter((sheet) => {
    if (state.statusFilter !== 'ALL' && sheet.status !== state.statusFilter) return false

    if (!keyword) return true

    return (
      sheet.standardId.toLowerCase().includes(keyword) ||
      (sheet.productionOrderId ?? '').toLowerCase().includes(keyword) ||
      sheet.taskId.toLowerCase().includes(keyword) ||
      sheet.checkpointSummaryZh.toLowerCase().includes(keyword) ||
      sheet.acceptanceSummaryZh.toLowerCase().includes(keyword)
    )
  })

  const stats = {
    draft: sheets.filter((sheet) => sheet.status === 'DRAFT').length,
    toRelease: sheets.filter((sheet) => sheet.status === 'TO_RELEASE').length,
    released: sheets.filter((sheet) => sheet.status === 'RELEASED').length,
    void: sheets.filter((sheet) => sheet.status === 'VOID').length,
  }

  const editTarget = getSheetById(state.editTargetId)
  const statusTarget = getSheetById(state.statusTargetId)

  return `
    <div class="flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">质检点/验收标准下发</h1>
          <p class="mt-1 text-sm text-muted-foreground">共 ${sheets.length} 条</p>
        </div>
        <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-qcs-action="open-create">新建标准</button>
      </div>

      <section class="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
        质检点/验收标准下发用于记录任务级质检要求；原型阶段仅做台账管理，不联动 PDA 执行与复杂抽检规则
      </section>

      <section class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article class="rounded-lg border bg-card">
          <header class="px-4 pb-1 pt-4"><h2 class="text-sm font-medium text-muted-foreground">草稿数</h2></header>
          <div class="px-4 pb-4"><p class="text-2xl font-bold">${stats.draft}</p></div>
        </article>
        <article class="rounded-lg border bg-card">
          <header class="px-4 pb-1 pt-4"><h2 class="text-sm font-medium text-muted-foreground">待下发数</h2></header>
          <div class="px-4 pb-4"><p class="text-2xl font-bold">${stats.toRelease}</p></div>
        </article>
        <article class="rounded-lg border bg-card">
          <header class="px-4 pb-1 pt-4"><h2 class="text-sm font-medium text-muted-foreground">已下发数</h2></header>
          <div class="px-4 pb-4"><p class="text-2xl font-bold">${stats.released}</p></div>
        </article>
        <article class="rounded-lg border bg-card">
          <header class="px-4 pb-1 pt-4"><h2 class="text-sm font-medium text-muted-foreground">已作废数</h2></header>
          <div class="px-4 pb-4"><p class="text-2xl font-bold">${stats.void}</p></div>
        </article>
      </section>

      <section class="flex flex-wrap gap-3">
        <input
          class="h-9 w-80 rounded-md border bg-background px-3 text-sm"
          data-qcs-filter="keyword"
          value="${escapeHtml(state.keyword)}"
          placeholder="关键词（标准单号 / 生产单号 / 任务ID / 摘要）"
        />

        <select class="h-9 w-36 rounded-md border bg-background px-3 text-sm" data-qcs-filter="status">
          <option value="ALL" ${state.statusFilter === 'ALL' ? 'selected' : ''}>全部</option>
          <option value="DRAFT" ${state.statusFilter === 'DRAFT' ? 'selected' : ''}>草稿</option>
          <option value="TO_RELEASE" ${state.statusFilter === 'TO_RELEASE' ? 'selected' : ''}>待下发</option>
          <option value="RELEASED" ${state.statusFilter === 'RELEASED' ? 'selected' : ''}>已下发</option>
          <option value="VOID" ${state.statusFilter === 'VOID' ? 'selected' : ''}>已作废</option>
        </select>
      </section>

      <section class="overflow-x-auto rounded-md border">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="px-4 py-2 font-medium">标准单号</th>
              <th class="px-4 py-2 font-medium">生产单号</th>
              <th class="px-4 py-2 font-medium">任务ID</th>
              <th class="px-4 py-2 font-medium">质检点摘要</th>
              <th class="px-4 py-2 font-medium">验收标准摘要</th>
              <th class="px-4 py-2 font-medium">抽检说明</th>
              <th class="px-4 py-2 font-medium">状态</th>
              <th class="px-4 py-2 font-medium">更新时间</th>
              <th class="px-4 py-2 font-medium">操作</th>
            </tr>
          </thead>

          <tbody>
            ${
              filtered.length === 0
                ? '<tr><td colspan="9" class="py-10 text-center text-sm text-muted-foreground">暂无质检标准数据</td></tr>'
                : filtered
                    .map((sheet) => {
                      const canChange = ALLOWED_NEXT[sheet.status].length > 0
                      const editDisabled = sheet.status === 'VOID' || sheet.status === 'RELEASED'

                      return `
                        <tr class="border-b last:border-b-0">
                          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(sheet.standardId)}</td>
                          <td class="px-4 py-3 text-sm">${escapeHtml(sheet.productionOrderId ?? '—')}</td>
                          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(sheet.taskId)}</td>
                          <td class="max-w-[200px] truncate px-4 py-3 text-sm" title="${escapeHtml(sheet.checkpointSummaryZh)}">${escapeHtml(sheet.checkpointSummaryZh)}</td>
                          <td class="max-w-[200px] truncate px-4 py-3 text-sm" title="${escapeHtml(sheet.acceptanceSummaryZh)}">${escapeHtml(sheet.acceptanceSummaryZh)}</td>
                          <td class="px-4 py-3 text-sm text-muted-foreground">${escapeHtml(sheet.samplingSummaryZh ?? '—')}</td>
                          <td class="px-4 py-3"><span class="inline-flex rounded-md px-2 py-0.5 text-xs ${STATUS_CLASS[sheet.status]}">${STATUS_LABEL[sheet.status]}</span></td>
                          <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(sheet.updatedAt ?? sheet.createdAt)}</td>
                          <td class="px-4 py-3">
                            <div class="flex flex-wrap gap-1">
                              <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${
                                editDisabled ? 'pointer-events-none opacity-50' : ''
                              }" data-qcs-action="open-edit" data-standard-id="${escapeHtml(sheet.standardId)}">编辑标准</button>

                              ${
                                canChange
                                  ? `<button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-qcs-action="open-status" data-standard-id="${escapeHtml(sheet.standardId)}">状态变更</button>`
                                  : ''
                              }

                              <button class="inline-flex h-8 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/process/task-breakdown">查看任务</button>

                              ${
                                sheet.productionOrderId
                                  ? `<button class="inline-flex h-8 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/production/orders/${escapeHtml(sheet.productionOrderId)}">查看生产单</button>`
                                  : '<span class="px-2 py-1 text-xs text-muted-foreground">—</span>'
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

      ${renderCreateDialog()}
      ${renderEditDialog(editTarget)}
      ${renderStatusDialog(statusTarget)}
    </div>
  `
}

function updateField(field: string, node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
  const value = node.value

  if (field === 'create.taskId') {
    state.createForm.taskId = value
    return
  }

  if (field === 'create.checkpointSummaryZh') {
    state.createForm.checkpointSummaryZh = value
    return
  }

  if (field === 'create.acceptanceSummaryZh') {
    state.createForm.acceptanceSummaryZh = value
    return
  }

  if (field === 'create.samplingSummaryZh') {
    state.createForm.samplingSummaryZh = value
    return
  }

  if (field === 'create.remark') {
    state.createForm.remark = value
    return
  }

  if (field === 'edit.checkpointSummaryZh') {
    state.editForm.checkpointSummaryZh = value
    return
  }

  if (field === 'edit.acceptanceSummaryZh') {
    state.editForm.acceptanceSummaryZh = value
    return
  }

  if (field === 'edit.samplingSummaryZh') {
    state.editForm.samplingSummaryZh = value
    return
  }

  if (field === 'edit.remark') {
    state.editForm.remark = value
    return
  }

  if (field === 'status.nextStatus') {
    state.nextStatus = value as QcStandardStatus | ''
    return
  }

  if (field === 'status.remark') {
    state.statusRemark = value
  }
}

export function handleQcStandardsEvent(target: HTMLElement): boolean {
  const filterNode = target.closest<HTMLElement>('[data-qcs-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const field = filterNode.dataset.qcsFilter
    if (field === 'keyword') {
      state.keyword = filterNode.value
      return true
    }
    if (field === 'status') {
      state.statusFilter = filterNode.value as StatusFilter
      return true
    }
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-qcs-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.qcsField
    if (!field) return true
    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-qcs-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.qcsAction
  if (!action) return false

  if (action === 'open-create') {
    state.createOpen = true
    return true
  }

  if (action === 'close-create') {
    closeCreateDialog()
    return true
  }

  if (action === 'submit-create') {
    const result = createQcStandardSheet(
      {
        taskId: state.createForm.taskId,
        checkpointSummaryZh: state.createForm.checkpointSummaryZh,
        acceptanceSummaryZh: state.createForm.acceptanceSummaryZh,
        samplingSummaryZh: state.createForm.samplingSummaryZh || undefined,
        remark: state.createForm.remark || undefined,
      },
      '管理员',
    )

    if (!result.ok) {
      showQcStandardsToast(`创建失败：${result.message ?? '未知错误'}`, 'error')
      return true
    }

    showQcStandardsToast('质检标准已创建')
    closeCreateDialog()
    state.createForm = emptyCreateForm()
    return true
  }

  if (action === 'open-edit') {
    const standardId = actionNode.dataset.standardId
    if (!standardId) return true

    const targetSheet = getSheetById(standardId)
    if (!targetSheet) {
      showQcStandardsToast('打开编辑失败：数据不存在', 'error')
      return true
    }

    openEditDialog(targetSheet)
    return true
  }

  if (action === 'close-edit') {
    closeEditDialog()
    return true
  }

  if (action === 'submit-edit') {
    if (!state.editTargetId) return true

    const result = updateQcStandardSheet(
      {
        standardId: state.editTargetId,
        checkpointSummaryZh: state.editForm.checkpointSummaryZh,
        acceptanceSummaryZh: state.editForm.acceptanceSummaryZh,
        samplingSummaryZh: state.editForm.samplingSummaryZh || undefined,
        remark: state.editForm.remark || undefined,
      },
      '管理员',
    )

    if (!result.ok) {
      showQcStandardsToast(`更新失败：${result.message ?? '未知错误'}`, 'error')
      return true
    }

    showQcStandardsToast('质检标准已更新')
    closeEditDialog()
    return true
  }

  if (action === 'open-status') {
    const standardId = actionNode.dataset.standardId
    if (!standardId) return true

    const targetSheet = getSheetById(standardId)
    if (!targetSheet) {
      showQcStandardsToast('打开状态变更失败：数据不存在', 'error')
      return true
    }

    openStatusDialog(targetSheet)
    return true
  }

  if (action === 'close-status') {
    closeStatusDialog()
    return true
  }

  if (action === 'submit-status') {
    if (!state.statusTargetId || !state.nextStatus) return true

    const result = updateQcStandardStatus(
      {
        standardId: state.statusTargetId,
        nextStatus: state.nextStatus,
        remark: state.statusRemark || undefined,
      },
      '管理员',
    )

    if (!result.ok) {
      showQcStandardsToast(`状态变更失败：${result.message ?? '未知错误'}`, 'error')
      return true
    }

    showQcStandardsToast('标准状态已更新')
    closeStatusDialog()
    return true
  }

  if (action === 'close-dialog') {
    closeCreateDialog()
    closeEditDialog()
    closeStatusDialog()
    return true
  }

  return false
}

export function isQcStandardsDialogOpen(): boolean {
  return state.createOpen || state.editOpen || state.statusOpen
}
