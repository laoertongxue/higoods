import { processTasks } from '../data/fcs/process-tasks'
import {
  listMaterialIssueSheetsFromRuntime,
  type MaterialIssueSheet,
  type MaterialIssueStatus,
} from '../data/fcs/store-domain-dispatch-process'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { escapeHtml } from '../utils'

applyQualitySeedBootstrap()

type FilterStatus = MaterialIssueStatus | 'ALL'

interface CreateForm {
  taskId: string
  materialSummaryZh: string
  requestedQty: string
  remark: string
}

interface EditForm {
  materialSummaryZh: string
  requestedQty: string
  issuedQty: string
  remark: string
}

interface MaterialIssueState {
  keyword: string
  filterStatus: FilterStatus

  createOpen: boolean
  createForm: CreateForm

  editIssueId: string | null
  editForm: EditForm

  statusIssueId: string | null
  nextStatus: MaterialIssueStatus | ''
  statusRemark: string
}

const STATUS_LABEL: Record<MaterialIssueStatus, string> = {
  DRAFT: '草稿',
  TO_ISSUE: '待下发',
  PARTIAL: '部分下发',
  ISSUED: '已下发',
}

const STATUS_CLASS: Record<MaterialIssueStatus, string> = {
  DRAFT: 'border bg-secondary text-secondary-foreground',
  TO_ISSUE: 'border bg-background text-foreground',
  PARTIAL: 'border border-blue-200 bg-blue-100 text-blue-700',
  ISSUED: 'border border-blue-200 bg-blue-100 text-blue-700',
}

const NEXT_STATUS: Record<MaterialIssueStatus, MaterialIssueStatus[]> = {
  DRAFT: ['TO_ISSUE'],
  TO_ISSUE: ['PARTIAL', 'ISSUED'],
  PARTIAL: ['TO_ISSUE', 'ISSUED'],
  ISSUED: [],
}

const state: MaterialIssueState = {
  keyword: '',
  filterStatus: 'ALL',
  createOpen: false,
  createForm: emptyCreateForm(),
  editIssueId: null,
  editForm: emptyEditForm(),
  statusIssueId: null,
  nextStatus: '',
  statusRemark: '',
}

// 第6步：页面改为以新链路兼容适配结果为基础数据，不再直接依赖旧静态 seed。
const runtimeMaterialIssueSheets: MaterialIssueSheet[] = listMaterialIssueSheetsFromRuntime()

function emptyCreateForm(): CreateForm {
  return {
    taskId: '',
    materialSummaryZh: '',
    requestedQty: '',
    remark: '',
  }
}

function emptyEditForm(): EditForm {
  return {
    materialSummaryZh: '',
    requestedQty: '',
    issuedQty: '',
    remark: '',
  }
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function showMaterialIssueToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'material-issue-toast-root'
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

function getSheets(): MaterialIssueSheet[] {
  return runtimeMaterialIssueSheets
}

function getSheetById(issueId: string | null): MaterialIssueSheet | null {
  if (!issueId) return null
  return getSheets().find((sheet) => sheet.issueId === issueId) ?? null
}

function createMaterialIssueSheet(
  input: {
    taskId: string
    materialSummaryZh: string
    requestedQty: number
    remark?: string
  },
  by: string,
): { ok: boolean; issueId?: string; message?: string } {
  const { taskId, materialSummaryZh, requestedQty, remark } = input
  if (!taskId.trim()) return { ok: false, message: '任务ID不能为空' }

  const task = processTasks.find((item) => item.taskId === taskId)
  if (!task) return { ok: false, message: `任务 ${taskId} 不存在` }

  if (!materialSummaryZh.trim()) return { ok: false, message: '用料摘要不能为空' }
  if (!Number.isInteger(requestedQty) || requestedQty <= 0) {
    return { ok: false, message: '需求数量必须为大于0的整数' }
  }

  const ts = nowTimestamp()
  const month = ts.slice(0, 7).replace('-', '')
  const issueId = `MIS-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`

  getSheets().push({
    issueId,
    productionOrderId: task.productionOrderId,
    taskId,
    materialSummaryZh: materialSummaryZh.trim(),
    requestedQty,
    issuedQty: 0,
    status: 'DRAFT',
    remark,
    createdAt: ts,
    createdBy: by,
  })

  return { ok: true, issueId }
}

function updateMaterialIssueSheet(
  input: {
    issueId: string
    materialSummaryZh?: string
    requestedQty?: number
    issuedQty?: number
    remark?: string
  },
  by: string,
): { ok: boolean; message?: string } {
  const { issueId, materialSummaryZh, requestedQty, issuedQty, remark } = input
  const sheet = getSheets().find((item) => item.issueId === issueId)
  if (!sheet) return { ok: false, message: `领料需求单 ${issueId} 不存在` }

  if (requestedQty !== undefined && requestedQty <= 0) {
    return { ok: false, message: '需求数量必须大于 0' }
  }

  if (issuedQty !== undefined && issuedQty < 0) {
    return { ok: false, message: '已下发数量不能为负数' }
  }

  const ts = nowTimestamp()
  const newRequestedQty = requestedQty ?? sheet.requestedQty
  const newIssuedQty = issuedQty ?? sheet.issuedQty

  let newStatus: MaterialIssueStatus = sheet.status
  if (issuedQty !== undefined) {
    if (newIssuedQty <= 0) {
      // 与原逻辑一致：保持当前状态
    } else if (newIssuedQty >= newRequestedQty) {
      newStatus = 'ISSUED'
    } else {
      newStatus = 'PARTIAL'
    }
  }

  sheet.materialSummaryZh = materialSummaryZh?.trim() ?? sheet.materialSummaryZh
  sheet.requestedQty = newRequestedQty
  sheet.issuedQty = newIssuedQty
  sheet.status = newStatus
  sheet.remark = remark ?? sheet.remark
  sheet.updatedAt = ts
  sheet.updatedBy = by

  return { ok: true }
}

function updateMaterialIssueStatus(
  input: { issueId: string; nextStatus: MaterialIssueStatus; remark?: string },
  by: string,
): { ok: boolean; message?: string } {
  const { issueId, nextStatus, remark } = input
  const sheet = getSheets().find((item) => item.issueId === issueId)
  if (!sheet) return { ok: false, message: `领料需求单 ${issueId} 不存在` }
  if (!nextStatus) return { ok: false, message: '目标状态不能为空' }

  if (!NEXT_STATUS[sheet.status].includes(nextStatus)) {
    return { ok: false, message: '当前领料状态不允许切换到目标状态' }
  }

  sheet.status = nextStatus
  sheet.remark = remark ?? sheet.remark
  sheet.updatedAt = nowTimestamp()
  sheet.updatedBy = by

  return { ok: true }
}

function renderCreateDialog(): string {
  if (!state.createOpen) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-mis-action="close-create" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 max-h-[86vh] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-mis-action="close-create" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <h3 class="text-lg font-semibold">新建领料需求</h3>

        <div class="mt-4 space-y-4">
          <div class="space-y-1.5">
            <label class="text-sm font-medium">任务 <span class="text-red-600">*</span></label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-mis-field="create.taskId">
              <option value="" ${state.createForm.taskId === '' ? 'selected' : ''}>选择任务</option>
              ${processTasks
                .map(
                  (task) =>
                    `<option value="${escapeHtml(task.taskId)}" ${
                      state.createForm.taskId === task.taskId ? 'selected' : ''
                    }>${escapeHtml(task.taskId)} ${escapeHtml(task.processNameZh)}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">用料摘要 <span class="text-red-600">*</span></label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="例：主面料 × 100m"
              data-mis-field="create.materialSummaryZh"
              value="${escapeHtml(state.createForm.materialSummaryZh)}"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">需求数量 <span class="text-red-600">*</span></label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              type="number"
              min="1"
              placeholder="大于 0 的整数"
              data-mis-field="create.requestedQty"
              value="${escapeHtml(state.createForm.requestedQty)}"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">备注</label>
            <textarea
              rows="2"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="可选"
              data-mis-field="create.remark"
            >${escapeHtml(state.createForm.remark)}</textarea>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-mis-action="close-create">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-mis-action="submit-create">保存</button>
        </div>
      </div>
    </div>
  `
}

function renderEditDialog(editSheet: MaterialIssueSheet | null): string {
  if (!editSheet) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-mis-action="close-edit" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 max-h-[86vh] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-mis-action="close-edit" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <h3 class="text-lg font-semibold">编辑领料需求</h3>

        <div class="mt-4 space-y-4">
          <div class="space-y-1.5">
            <label class="text-sm font-medium">用料摘要</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              data-mis-field="edit.materialSummaryZh"
              value="${escapeHtml(state.editForm.materialSummaryZh)}"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">需求数量</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              type="number"
              min="1"
              data-mis-field="edit.requestedQty"
              value="${escapeHtml(state.editForm.requestedQty)}"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">已下发数量</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              type="number"
              min="0"
              data-mis-field="edit.issuedQty"
              value="${escapeHtml(state.editForm.issuedQty)}"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">备注</label>
            <textarea
              rows="2"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
              data-mis-field="edit.remark"
            >${escapeHtml(state.editForm.remark)}</textarea>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-mis-action="close-edit">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-mis-action="submit-edit">保存</button>
        </div>
      </div>
    </div>
  `
}

function renderStatusDialog(statusSheet: MaterialIssueSheet | null): string {
  if (!statusSheet) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-mis-action="close-status" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-mis-action="close-status" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <h3 class="text-lg font-semibold">变更领料状态</h3>

        <div class="mt-4 space-y-4">
          <div class="space-y-1.5">
            <label class="text-sm font-medium">当前状态</label>
            <input class="h-9 w-full rounded-md border bg-muted px-3 text-sm" readonly value="${escapeHtml(STATUS_LABEL[statusSheet.status])}" />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">目标状态 <span class="text-red-600">*</span></label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-mis-field="status.nextStatus">
              <option value="" ${state.nextStatus === '' ? 'selected' : ''}>选择目标状态</option>
              ${NEXT_STATUS[statusSheet.status]
                .map(
                  (value) =>
                    `<option value="${value}" ${state.nextStatus === value ? 'selected' : ''}>${STATUS_LABEL[value]}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">备注</label>
            <textarea
              rows="2"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="可选"
              data-mis-field="status.remark"
            >${escapeHtml(state.statusRemark)}</textarea>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-mis-action="close-status">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            !state.nextStatus ? 'pointer-events-none opacity-50' : ''
          }" data-mis-action="submit-status">保存</button>
        </div>
      </div>
    </div>
  `
}

export function renderMaterialIssuePage(): string {
  const sheets = getSheets()
  const keyword = state.keyword.trim().toLowerCase()

  const filtered = sheets.filter((sheet) => {
    const matchStatus = state.filterStatus === 'ALL' || sheet.status === state.filterStatus
    const matchKeyword =
      !keyword ||
      [sheet.issueId, sheet.productionOrderId ?? '', sheet.taskId, sheet.materialSummaryZh]
        .join(' ')
        .toLowerCase()
        .includes(keyword)

    return matchStatus && matchKeyword
  })

  const stats = {
    draft: sheets.filter((sheet) => sheet.status === 'DRAFT').length,
    toIssue: sheets.filter((sheet) => sheet.status === 'TO_ISSUE').length,
    partial: sheets.filter((sheet) => sheet.status === 'PARTIAL').length,
    issued: sheets.filter((sheet) => sheet.status === 'ISSUED').length,
  }

  const editSheet = getSheetById(state.editIssueId)
  const statusSheet = getSheetById(state.statusIssueId)

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">用料清单下发</h1>
          <p class="mt-0.5 text-sm text-muted-foreground">共 ${sheets.length} 条</p>
        </div>
        <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-mis-action="open-create">新建领料需求</button>
      </div>

      <section class="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
        用料清单下发用于记录任务级领料需求；原型阶段仅做台账管理，不联动仓储执行与 BOM 明细
      </section>

      <section class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article class="rounded-lg border bg-card">
          <header class="px-4 pb-1 pt-4"><h2 class="text-sm font-medium text-muted-foreground">草稿数</h2></header>
          <div class="px-4 pb-4"><p class="text-2xl font-bold">${stats.draft}</p></div>
        </article>
        <article class="rounded-lg border bg-card">
          <header class="px-4 pb-1 pt-4"><h2 class="text-sm font-medium text-muted-foreground">待下发数</h2></header>
          <div class="px-4 pb-4"><p class="text-2xl font-bold">${stats.toIssue}</p></div>
        </article>
        <article class="rounded-lg border bg-card">
          <header class="px-4 pb-1 pt-4"><h2 class="text-sm font-medium text-muted-foreground">部分下发数</h2></header>
          <div class="px-4 pb-4"><p class="text-2xl font-bold">${stats.partial}</p></div>
        </article>
        <article class="rounded-lg border bg-card">
          <header class="px-4 pb-1 pt-4"><h2 class="text-sm font-medium text-muted-foreground">已下发数</h2></header>
          <div class="px-4 pb-4"><p class="text-2xl font-bold">${stats.issued}</p></div>
        </article>
      </section>

      <section class="flex flex-wrap gap-3">
        <input
          class="h-9 w-72 rounded-md border bg-background px-3 text-sm"
          data-mis-filter="keyword"
          value="${escapeHtml(state.keyword)}"
          placeholder="关键词（领料单号/生产单号/任务ID/用料摘要）"
        />
        <select class="h-9 w-36 rounded-md border bg-background px-3 text-sm" data-mis-filter="status">
          <option value="ALL" ${state.filterStatus === 'ALL' ? 'selected' : ''}>全部</option>
          <option value="DRAFT" ${state.filterStatus === 'DRAFT' ? 'selected' : ''}>草稿</option>
          <option value="TO_ISSUE" ${state.filterStatus === 'TO_ISSUE' ? 'selected' : ''}>待下发</option>
          <option value="PARTIAL" ${state.filterStatus === 'PARTIAL' ? 'selected' : ''}>部分下发</option>
          <option value="ISSUED" ${state.filterStatus === 'ISSUED' ? 'selected' : ''}>已下发</option>
        </select>
      </section>

      <section class="rounded-lg border bg-card">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-muted/40 text-left">
                <th class="px-4 py-2 font-medium">领料单号</th>
                <th class="px-4 py-2 font-medium">生产单号</th>
                <th class="px-4 py-2 font-medium">任务ID</th>
                <th class="px-4 py-2 font-medium">用料摘要</th>
                <th class="px-4 py-2 text-right font-medium">需求数量</th>
                <th class="px-4 py-2 text-right font-medium">已下发数量</th>
                <th class="px-4 py-2 font-medium">状态</th>
                <th class="px-4 py-2 font-medium">更新时间</th>
                <th class="px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>

            <tbody>
              ${
                filtered.length === 0
                  ? '<tr><td colspan="9" class="py-10 text-center text-sm text-muted-foreground">暂无领料需求数据</td></tr>'
                  : filtered
                      .map((sheet) => {
                        const canStatus = NEXT_STATUS[sheet.status].length > 0
                        return `
                          <tr class="border-b last:border-b-0">
                            <td class="px-4 py-3 font-mono text-xs">${escapeHtml(sheet.issueId)}</td>
                            <td class="px-4 py-3 text-sm">${escapeHtml(sheet.productionOrderId ?? '—')}</td>
                            <td class="px-4 py-3 font-mono text-xs">${escapeHtml(sheet.taskId)}</td>
                            <td class="max-w-[180px] truncate px-4 py-3 text-sm" title="${escapeHtml(sheet.materialSummaryZh)}">${escapeHtml(sheet.materialSummaryZh)}</td>
                            <td class="px-4 py-3 text-right text-sm">${sheet.requestedQty}</td>
                            <td class="px-4 py-3 text-right text-sm">${sheet.issuedQty}</td>
                            <td class="px-4 py-3"><span class="inline-flex rounded-md px-2 py-0.5 text-xs ${STATUS_CLASS[sheet.status]}">${STATUS_LABEL[sheet.status]}</span></td>
                            <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(sheet.updatedAt ?? sheet.createdAt)}</td>
                            <td class="px-4 py-3">
                              <div class="flex flex-wrap gap-1">
                                <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-mis-action="open-edit" data-issue-id="${escapeHtml(sheet.issueId)}">编辑需求</button>
                                <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${
                                  !canStatus ? 'pointer-events-none opacity-50' : ''
                                }" data-mis-action="open-status" data-issue-id="${escapeHtml(sheet.issueId)}">状态变更</button>
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
        </div>
      </section>

      ${renderCreateDialog()}
      ${renderEditDialog(editSheet)}
      ${renderStatusDialog(statusSheet)}
    </div>
  `
}

function updateField(field: string, node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
  const value = node.value

  if (field === 'create.taskId') {
    state.createForm.taskId = value
    return
  }

  if (field === 'create.materialSummaryZh') {
    state.createForm.materialSummaryZh = value
    return
  }

  if (field === 'create.requestedQty') {
    state.createForm.requestedQty = value
    return
  }

  if (field === 'create.remark') {
    state.createForm.remark = value
    return
  }

  if (field === 'edit.materialSummaryZh') {
    state.editForm.materialSummaryZh = value
    return
  }

  if (field === 'edit.requestedQty') {
    state.editForm.requestedQty = value
    return
  }

  if (field === 'edit.issuedQty') {
    state.editForm.issuedQty = value
    return
  }

  if (field === 'edit.remark') {
    state.editForm.remark = value
    return
  }

  if (field === 'status.nextStatus') {
    state.nextStatus = value as MaterialIssueStatus | ''
    return
  }

  if (field === 'status.remark') {
    state.statusRemark = value
  }
}

function openEdit(issueId: string): boolean {
  const sheet = getSheetById(issueId)
  if (!sheet) return false

  state.editIssueId = sheet.issueId
  state.editForm = {
    materialSummaryZh: sheet.materialSummaryZh,
    requestedQty: String(sheet.requestedQty),
    issuedQty: String(sheet.issuedQty),
    remark: sheet.remark ?? '',
  }
  return true
}

function openStatus(issueId: string): boolean {
  const sheet = getSheetById(issueId)
  if (!sheet) return false

  state.statusIssueId = sheet.issueId
  state.nextStatus = NEXT_STATUS[sheet.status][0] ?? ''
  state.statusRemark = ''
  return true
}

export function handleMaterialIssueEvent(target: HTMLElement): boolean {
  const filterNode = target.closest<HTMLElement>('[data-mis-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const field = filterNode.dataset.misFilter
    if (field === 'keyword') {
      state.keyword = filterNode.value
      return true
    }
    if (field === 'status') {
      state.filterStatus = filterNode.value as FilterStatus
      return true
    }
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-mis-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.misField
    if (!field) return true
    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-mis-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.misAction
  if (!action) return false

  if (action === 'open-create') {
    state.createOpen = true
    return true
  }

  if (action === 'close-create') {
    state.createOpen = false
    return true
  }

  if (action === 'submit-create') {
    const result = createMaterialIssueSheet(
      {
        taskId: state.createForm.taskId,
        materialSummaryZh: state.createForm.materialSummaryZh,
        requestedQty: Number(state.createForm.requestedQty),
        remark: state.createForm.remark.trim() || undefined,
      },
      '管理员',
    )

    if (!result.ok) {
      showMaterialIssueToast(`创建失败：${result.message ?? '未知错误'}`, 'error')
      return true
    }

    showMaterialIssueToast(`领料需求已创建：${result.issueId}`)
    state.createOpen = false
    state.createForm = emptyCreateForm()
    return true
  }

  if (action === 'open-edit') {
    const issueId = actionNode.dataset.issueId
    if (!issueId) return true
    if (!openEdit(issueId)) {
      showMaterialIssueToast('打开编辑失败：数据不存在', 'error')
    }
    return true
  }

  if (action === 'close-edit') {
    state.editIssueId = null
    state.editForm = emptyEditForm()
    return true
  }

  if (action === 'submit-edit') {
    if (!state.editIssueId) return true

    const result = updateMaterialIssueSheet(
      {
        issueId: state.editIssueId,
        materialSummaryZh: state.editForm.materialSummaryZh,
        requestedQty:
          state.editForm.requestedQty === '' ? undefined : Number(state.editForm.requestedQty),
        issuedQty: state.editForm.issuedQty === '' ? undefined : Number(state.editForm.issuedQty),
        remark: state.editForm.remark,
      },
      '管理员',
    )

    if (!result.ok) {
      showMaterialIssueToast(`更新失败：${result.message ?? '未知错误'}`, 'error')
      return true
    }

    showMaterialIssueToast('领料需求已更新')
    state.editIssueId = null
    state.editForm = emptyEditForm()
    return true
  }

  if (action === 'open-status') {
    const issueId = actionNode.dataset.issueId
    if (!issueId) return true
    if (!openStatus(issueId)) {
      showMaterialIssueToast('打开状态变更失败：数据不存在', 'error')
    }
    return true
  }

  if (action === 'close-status') {
    state.statusIssueId = null
    state.nextStatus = ''
    state.statusRemark = ''
    return true
  }

  if (action === 'submit-status') {
    if (!state.statusIssueId || !state.nextStatus) return true

    const result = updateMaterialIssueStatus(
      {
        issueId: state.statusIssueId,
        nextStatus: state.nextStatus,
        remark: state.statusRemark.trim() || undefined,
      },
      '管理员',
    )

    if (!result.ok) {
      showMaterialIssueToast(`状态变更失败：${result.message ?? '未知错误'}`, 'error')
      return true
    }

    showMaterialIssueToast('领料状态已更新')
    state.statusIssueId = null
    state.nextStatus = ''
    state.statusRemark = ''
    return true
  }

  if (action === 'close-dialog') {
    state.createOpen = false
    state.editIssueId = null
    state.statusIssueId = null
    state.nextStatus = ''
    state.statusRemark = ''
    return true
  }

  return false
}

export function isMaterialIssueDialogOpen(): boolean {
  return state.createOpen || state.editIssueId !== null || state.statusIssueId !== null
}
