import { appStore } from '../state/store'
import { processTasks, type ProcessTask, type TaskAuditLog } from '../data/fcs/process-tasks'
import {
  initialAllocationByTaskId,
  initialAllocationEvents,
  initialDeductionBasisItems,
  initialQualityInspections,
  initialReturnBatches,
} from '../data/fcs/store-domain-quality-seeds'
import {
  type AllocationEvent,
  type AllocationSnapshot,
  type DeductionBasisItem,
  type QualityInspection,
  type ReturnBatch,
  type ReturnBatchQcStatus,
} from '../data/fcs/store-domain-quality-types'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { escapeHtml } from '../utils'

applyQualitySeedBootstrap()

interface StatusWritebackState {
  selectedTaskId: string
  returnedQty: string
}

const BATCH_QC_STATUS_LABEL: Record<ReturnBatchQcStatus, string> = {
  QC_PENDING: '待质检',
  PASS_CLOSED: '合格已放行',
  FAIL_IN_QC: '不合格处理中',
}

const state: StatusWritebackState = {
  selectedTaskId: '',
  returnedQty: '',
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return query ?? ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

function showStatusWritebackToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'status-writeback-toast-root'
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
  }, 2300)
}

function getTasksSorted(): ProcessTask[] {
  return processTasks.slice().sort((a, b) => a.taskId.localeCompare(b.taskId))
}

function getReturnBatches(): ReturnBatch[] {
  return initialReturnBatches
}

function getTaskDependencies(task: ProcessTask): string[] {
  const taskWithCompat = task as ProcessTask & {
    dependencyTaskIds?: string[]
    predecessorTaskIds?: string[]
  }

  return (
    taskWithCompat.dependsOnTaskIds ??
    taskWithCompat.dependencyTaskIds ??
    taskWithCompat.predecessorTaskIds ??
    []
  )
}

function replaceReturnBatch(updated: ReturnBatch): void {
  const index = initialReturnBatches.findIndex((item) => item.batchId === updated.batchId)
  if (index >= 0) {
    initialReturnBatches[index] = updated
  }
}

function pushTaskAudit(task: ProcessTask, action: string, detail: string, by: string): void {
  const audit: TaskAuditLog = {
    id: `AL-${task.taskId}-${Date.now()}`,
    action,
    detail,
    at: nowTimestamp(),
    by,
  }

  task.auditLogs = [...task.auditLogs, audit]
}

function syncAllocationGates(by: string): void {
  const now = nowTimestamp()

  for (const task of processTasks) {
    const depIds = getTaskDependencies(task)
    if (!depIds.length) continue

    const gateOk = depIds.every((depId) => (initialAllocationByTaskId[depId]?.availableQty ?? 0) > 0)

    if (!gateOk) {
      if (task.status === 'DONE' || task.status === 'CANCELLED') continue
      if (task.status === 'BLOCKED' && task.blockReason === 'QUALITY') continue
      if (task.status === 'BLOCKED' && task.blockReason === 'ALLOCATION_GATE') continue

      const depNames = depIds.map((id) => processTasks.find((item) => item.taskId === id)?.processNameZh ?? id)
      const noteZh = `等待上游放行：${depNames.join('、')}（可用量=0）`

      task.status = 'BLOCKED'
      task.blockReason = 'ALLOCATION_GATE'
      task.blockRemark = noteZh
      task.blockNoteZh = noteZh
      task.blockedAt = now
      task.updatedAt = now
      task.auditLogs = [
        ...task.auditLogs,
        {
          id: `AL-GATE-BLOCK-${Date.now()}-${task.taskId}`,
          action: 'BLOCK_BY_ALLOCATION_GATE',
          detail: noteZh,
          at: now,
          by,
        },
      ]
      continue
    }

    if (task.status === 'BLOCKED' && task.blockReason === 'ALLOCATION_GATE') {
      task.status = 'NOT_STARTED'
      task.blockReason = undefined
      task.blockRemark = undefined
      task.blockNoteZh = undefined
      task.blockedAt = undefined
      task.updatedAt = now
      task.auditLogs = [
        ...task.auditLogs,
        {
          id: `AL-GATE-UNBLOCK-${Date.now()}-${task.taskId}`,
          action: 'UNBLOCK_BY_ALLOCATION_GATE',
          detail: '上游已放行，门禁解除',
          at: now,
          by,
        },
      ]
    }
  }
}

function createReturnBatch(
  taskId: string,
  returnedQty: number,
  by: string,
): { ok: boolean; batchId?: string; message?: string } {
  const task = processTasks.find((item) => item.taskId === taskId)
  if (!task) return { ok: false, message: `任务 ${taskId} 不存在` }

  if (!Number.isInteger(returnedQty) || returnedQty <= 0) {
    return { ok: false, message: '回货数量必须为正整数' }
  }

  const seq = String(Date.now()).slice(-4)
  const ym = new Date().toISOString().slice(0, 7).replace('-', '')
  const batchId = `RB-${ym}-${seq}`
  const ts = nowTimestamp()

  initialReturnBatches.push({
    batchId,
    taskId,
    returnedQty,
    qcStatus: 'QC_PENDING',
    createdAt: ts,
    createdBy: by,
  })

  return { ok: true, batchId }
}

function markReturnBatchPass(batchId: string, by: string): { ok: boolean; message?: string } {
  const batch = initialReturnBatches.find((item) => item.batchId === batchId)
  if (!batch) return { ok: false, message: `批次 ${batchId} 不存在` }
  if (batch.qcStatus !== 'QC_PENDING') return { ok: false, message: '该批次不在待质检状态' }

  const ts = nowTimestamp()

  replaceReturnBatch({
    ...batch,
    qcStatus: 'PASS_CLOSED',
    updatedAt: ts,
    updatedBy: by,
  })

  const oldSnapshot = initialAllocationByTaskId[batch.taskId] ?? {
    taskId: batch.taskId,
    availableQty: 0,
    acceptedAsDefectQty: 0,
    scrappedQty: 0,
    updatedAt: ts,
    updatedBy: by,
  }

  const nextSnapshot: AllocationSnapshot = {
    ...oldSnapshot,
    availableQty: oldSnapshot.availableQty + batch.returnedQty,
    updatedAt: ts,
    updatedBy: by,
  }

  initialAllocationByTaskId[batch.taskId] = nextSnapshot

  const event: AllocationEvent = {
    eventId: `ALLOC-RB-PASS-${Date.now()}`,
    taskId: batch.taskId,
    refType: 'RETURN_BATCH',
    refId: batchId,
    deltaAvailableQty: batch.returnedQty,
    deltaAcceptedAsDefectQty: 0,
    deltaScrappedQty: 0,
    noteZh: `回货批次 ${batchId} 合格放行：可用量+${batch.returnedQty}`,
    createdAt: ts,
    createdBy: by,
  }

  initialAllocationEvents.push(event)
  syncAllocationGates(by)
  return { ok: true }
}

function startReturnBatchFailQc(batchId: string, by: string): { ok: boolean; qcId?: string; message?: string } {
  const batch = initialReturnBatches.find((item) => item.batchId === batchId)
  if (!batch) return { ok: false, message: `批次 ${batchId} 不存在` }
  if (batch.qcStatus !== 'QC_PENDING') return { ok: false, message: '该批次不在待质检状态' }

  const task = processTasks.find((item) => item.taskId === batch.taskId)
  if (!task) return { ok: false, message: `任务 ${batch.taskId} 不存在` }

  const ts = nowTimestamp()
  const qcId = `QC-RB-${Date.now()}`

  const qcRecord: QualityInspection = {
    qcId,
    refType: 'RETURN_BATCH',
    refId: batchId,
    refTaskId: batch.taskId,
    productionOrderId: task.productionOrderId,
    inspector: by,
    inspectedAt: ts,
    result: 'FAIL',
    defectItems: [],
    status: 'SUBMITTED',
    rootCauseType: 'UNKNOWN',
    liabilityStatus: 'DRAFT',
    affectedQty: batch.returnedQty,
    auditLogs: [
      {
        id: `QAL-RB-CREATE-${Date.now()}`,
        action: 'CREATE_FROM_RETURN_BATCH',
        detail: `回货批次 ${batchId} 不合格，系统创建质检单`,
        at: ts,
        by,
      },
    ],
    createdAt: ts,
    updatedAt: ts,
  }

  initialQualityInspections.push(qcRecord)

  const basisItem: DeductionBasisItem = {
    basisId: `DBI-RB-${Date.now()}`,
    sourceType: 'QC_FAIL',
    sourceRefId: qcId,
    sourceId: qcId,
    productionOrderId: task.productionOrderId,
    taskId: task.taskId,
    factoryId: task.assignedFactoryId ?? 'ID-F001',
    reasonCode: 'QUALITY_FAIL',
    qty: batch.returnedQty,
    uom: 'PIECE',
    evidenceRefs: [],
    status: 'DRAFT',
    deepLinks: { qcHref: `/fcs/quality/qc-records/${qcId}` },
    createdAt: ts,
    createdBy: by,
    auditLogs: [
      {
        id: `DBIL-RB-${Date.now()}`,
        action: 'CREATE_BASIS_FROM_QC',
        detail: `由回货批次 ${batchId} 的质检单 ${qcId} 生成扣款依据`,
        at: ts,
        by,
      },
    ],
  }

  initialDeductionBasisItems.push(basisItem)

  replaceReturnBatch({
    ...batch,
    qcStatus: 'FAIL_IN_QC',
    linkedQcId: qcId,
    updatedAt: ts,
    updatedBy: by,
  })

  task.status = 'BLOCKED'
  task.blockReason = 'QUALITY'
  task.blockRemark = `回货批次 ${batchId} 质检不合格，已进入处理`
  task.blockedAt = ts
  task.updatedAt = ts
  pushTaskAudit(task, 'BLOCK_TASK', `回货批次 ${batchId} 不合格，任务阻塞`, by)

  return { ok: true, qcId }
}

function renderGateBlockedCard(tasks: ProcessTask[]): string {
  const gatedTasks = tasks
    .filter((item) => item.status === 'BLOCKED' && item.blockReason === 'ALLOCATION_GATE')
    .slice(0, 20)

  return `
    <section class="rounded-lg border bg-card">
      <header class="px-4 pb-3 pt-4">
        <h2 class="text-base font-semibold">门禁阻塞任务</h2>
        <p class="mt-1 text-sm text-muted-foreground">上游染印/印花工序未放行时，下游任务将自动阻塞</p>
      </header>

      <div class="px-4 pb-4">
        ${
          gatedTasks.length === 0
            ? '<p class="py-4 text-center text-sm text-muted-foreground">暂无门禁阻塞任务</p>'
            : `<div class="divide-y divide-border rounded-md border">${gatedTasks
                .map((task) => {
                  const dependencies = getTaskDependencies(task).join('、')
                  return `
                    <article class="space-y-1 px-4 py-3 text-sm">
                      <div class="flex items-center justify-between gap-4">
                        <span class="font-medium text-foreground">${escapeHtml(task.processNameZh)}</span>
                        <span class="inline-flex rounded-md border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs text-orange-800">门禁阻塞</span>
                      </div>
                      ${
                        dependencies
                          ? `<p class="text-xs text-muted-foreground">任务依赖：${escapeHtml(dependencies)}</p>`
                          : ''
                      }
                      <p class="text-xs text-orange-700">${escapeHtml(task.blockNoteZh ?? '等待上游放行')}</p>
                    </article>
                  `
                })
                .join('')}</div>`
        }
      </div>
    </section>
  `
}

function renderReturnBatchCard(): string {
  const tasks = getTasksSorted()

  const batches = getReturnBatches()
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20)

  return `
    <section class="rounded-lg border bg-card">
      <header class="px-4 pb-3 pt-4">
        <h2 class="text-base font-semibold">分批回货（按批质检放行）</h2>
        <p class="mt-1 text-sm text-muted-foreground">逐批登记回货，选择合格放行或不合格处理</p>
      </header>

      <div class="space-y-5 px-4 pb-4">
        <div class="grid grid-cols-1 items-end gap-3 rounded-md border bg-muted/40 p-4 sm:grid-cols-[1fr_120px_auto]">
          <div class="space-y-1">
            <label class="text-xs">任务</label>
            <select class="h-8 w-full rounded-md border bg-background px-2 text-sm" data-swb-field="selectedTaskId">
              <option value="" ${state.selectedTaskId === '' ? 'selected' : ''}>选择任务</option>
              ${tasks
                .map(
                  (task) =>
                    `<option value="${escapeHtml(task.taskId)}" ${
                      state.selectedTaskId === task.taskId ? 'selected' : ''
                    }>${escapeHtml(task.processNameZh ?? task.taskId)}（${escapeHtml(task.taskId)}）</option>`,
                )
                .join('')}
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-xs">回货数量</label>
            <input
              type="number"
              min="1"
              step="1"
              class="h-8 w-full rounded-md border bg-background px-2 text-sm"
              placeholder="整数"
              data-swb-field="returnedQty"
              value="${escapeHtml(state.returnedQty)}"
            />
          </div>

          <button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-swb-action="create-batch">登记回货</button>
        </div>

        ${
          batches.length === 0
            ? '<p class="py-4 text-center text-sm text-muted-foreground">暂无回货批次</p>'
            : `
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b bg-muted/40 text-left">
                      <th class="px-3 py-2 font-medium">批次号</th>
                      <th class="px-3 py-2 font-medium">任务</th>
                      <th class="px-3 py-2 text-right font-medium">回货数量</th>
                      <th class="px-3 py-2 font-medium">质检状态</th>
                      <th class="px-3 py-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${batches
                      .map((batch) => {
                        const taskName =
                          processTasks.find((item) => item.taskId === batch.taskId)?.processNameZh ?? batch.taskId

                        const badgeClass =
                          batch.qcStatus === 'PASS_CLOSED'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : batch.qcStatus === 'FAIL_IN_QC'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-yellow-50 text-yellow-700 border-yellow-200'

                        return `
                          <tr class="border-b last:border-b-0">
                            <td class="px-3 py-2 font-mono text-xs">${escapeHtml(batch.batchId)}</td>
                            <td class="px-3 py-2 text-sm">${escapeHtml(taskName)}</td>
                            <td class="px-3 py-2 text-right text-sm">${batch.returnedQty}</td>
                            <td class="px-3 py-2">
                              <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${badgeClass}">${BATCH_QC_STATUS_LABEL[batch.qcStatus]}</span>
                            </td>
                            <td class="px-3 py-2">
                              ${
                                batch.qcStatus === 'QC_PENDING'
                                  ? `
                                    <div class="flex items-center gap-2">
                                      <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-swb-action="pass-batch" data-batch-id="${escapeHtml(batch.batchId)}">合格放行</button>
                                      <button class="inline-flex h-7 items-center rounded-md border border-red-200 px-2 text-xs text-red-700 hover:bg-red-50" data-swb-action="fail-batch" data-batch-id="${escapeHtml(batch.batchId)}">不合格处理</button>
                                    </div>
                                  `
                                  : batch.qcStatus === 'FAIL_IN_QC'
                                    ? batch.linkedQcId
                                      ? `<button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-nav="/fcs/quality/qc-records/${escapeHtml(batch.linkedQcId)}">去处理</button>`
                                      : '<span class="text-xs text-muted-foreground">未生成质检单</span>'
                                    : '<span class="text-xs text-muted-foreground">已放行</span>'
                              }
                            </td>
                          </tr>
                        `
                      })
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
        }
      </div>
    </section>
  `
}

function renderAllocationEventsCard(): string {
  const events = initialAllocationEvents
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20)

  const dyePrintCount = initialAllocationEvents.filter((item) => item.refType === 'DYE_PRINT_ORDER').length

  return `
    <section class="rounded-lg border bg-card">
      <header class="px-4 pb-3 pt-4">
        <h2 class="text-base font-semibold">Allocation 回写事件</h2>
        <p class="mt-1 text-sm text-muted-foreground">质检结案或批次放行后自动写入，记录可用量变更</p>
      </header>

      <div class="px-4 pb-4">
        ${
          events.length === 0
            ? '<p class="py-4 text-center text-sm text-muted-foreground">暂无 Allocation 回写事件</p>'
            : `
              ${
                dyePrintCount > 0
                  ? `<div class="mb-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">染印加工单回写次数：${dyePrintCount}</div>`
                  : ''
              }
              <div class="divide-y divide-border rounded-md border">
                ${events
                  .map((event) => {
                    const sourceLabel =
                      event.refType === 'DYE_PRINT_ORDER'
                        ? '染印加工单'
                        : event.refType === 'RETURN_BATCH'
                          ? '回货批次'
                          : '质检单'

                    const refLabel =
                      event.refType === 'DYE_PRINT_ORDER'
                        ? '加工单'
                        : event.refType === 'RETURN_BATCH'
                          ? '批次'
                          : '质检单'

                    return `
                      <article class="space-y-0.5 px-4 py-3 text-sm">
                        <div class="flex items-center justify-between gap-4">
                          <span class="text-xs text-muted-foreground">${escapeHtml(event.createdAt)}</span>
                          <span class="text-xs text-muted-foreground">任务：${escapeHtml(event.taskId)}</span>
                        </div>
                        <div class="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>来源：${sourceLabel}</span>
                          <span class="text-border">|</span>
                          <span>${refLabel}：${escapeHtml(event.refId)}</span>
                        </div>
                        <p class="font-medium text-foreground">${escapeHtml(event.noteZh)}</p>
                      </article>
                    `
                  })
                  .join('')}
              </div>
            `
        }
      </div>
    </section>
  `
}

export function renderProgressStatusWritebackPage(): string {
  const params = getCurrentSearchParams()
  const taskId = params.get('taskId')
  const poId = params.get('po')

  return `
    <div class="space-y-4">
      <div class="flex items-center gap-4">
        <button class="inline-flex h-8 items-center rounded-md px-3 text-sm hover:bg-muted" data-nav="/fcs/progress/board">
          <i data-lucide="arrow-left" class="mr-1.5 h-4 w-4"></i>
          返回看板
        </button>

        <h1 class="flex items-center gap-2 text-xl font-semibold">
          <i data-lucide="refresh-cw" class="h-5 w-5"></i>
          状态回写
        </h1>
      </div>

      ${renderReturnBatchCard()}
      ${renderGateBlockedCard(processTasks)}
      ${renderAllocationEventsCard()}

      <section class="rounded-lg border bg-card">
        <header class="px-4 pb-2 pt-4">
          <h2 class="text-base font-semibold">状态回写</h2>
          <p class="mt-1 text-sm text-muted-foreground">任务状态变更后会自动同步回写到生产单，计算生产单进度百分比和状态流转。</p>
        </header>

        <div class="px-4 pb-4">
          ${
            taskId || poId
              ? `
                <div class="rounded-lg bg-muted p-4">
                  <h4 class="mb-2 font-medium">来自看板快捷入口</h4>
                  <div class="space-y-1 text-sm">
                    ${
                      taskId
                        ? `<div>任务ID: <code class="rounded bg-background px-1">${escapeHtml(taskId)}</code></div>`
                        : ''
                    }
                    ${
                      poId
                        ? `<div>生产单: <code class="rounded bg-background px-1">${escapeHtml(poId)}</code></div>`
                        : ''
                    }
                  </div>
                </div>
              `
              : ''
          }
        </div>
      </section>
    </div>
  `
}

function updateField(field: string, node: HTMLInputElement | HTMLSelectElement): void {
  if (field === 'selectedTaskId') {
    state.selectedTaskId = node.value
    return
  }

  if (field === 'returnedQty') {
    if (node.value === '') {
      state.returnedQty = ''
      return
    }

    const value = Math.max(1, Math.floor(Number(node.value)))
    state.returnedQty = Number.isFinite(value) ? String(value) : ''
  }
}

export function handleProgressStatusWritebackEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-swb-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.swbField
    if (!field) return true

    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-swb-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.swbAction
  if (!action) return false

  if (action === 'create-batch') {
    if (!state.selectedTaskId) {
      showStatusWritebackToast('请选择任务', 'error')
      return true
    }

    const qty = Number(state.returnedQty)
    if (!Number.isInteger(qty) || qty <= 0) {
      showStatusWritebackToast('回货数量必须为正整数', 'error')
      return true
    }

    const result = createReturnBatch(state.selectedTaskId, qty, '管理员')

    if (result.ok) {
      showStatusWritebackToast(`回货批次已登记，批次号：${result.batchId}`)
      state.returnedQty = ''
    } else {
      showStatusWritebackToast(result.message ?? '登记失败', 'error')
    }

    return true
  }

  if (action === 'pass-batch') {
    const batchId = actionNode.dataset.batchId
    if (!batchId) return true

    const result = markReturnBatchPass(batchId, '管理员')
    if (result.ok) {
      showStatusWritebackToast('已合格放行，Allocation 已更新')
    } else {
      showStatusWritebackToast(result.message ?? '操作失败', 'error')
    }

    return true
  }

  if (action === 'fail-batch') {
    const batchId = actionNode.dataset.batchId
    if (!batchId) return true

    const result = startReturnBatchFailQc(batchId, '管理员')
    if (result.ok && result.qcId) {
      showStatusWritebackToast(`已创建质检单 ${result.qcId}，任务已阻塞`)
    } else {
      showStatusWritebackToast(result.message ?? '操作失败', 'error')
    }

    return true
  }

  return false
}
