import {
  state,
  initialAllocationByTaskId,
  validateRuntimeBatchDispatchSelection,
  listRuntimeTaskAllocatableGroups,
  dispatchRuntimeTaskByDetailGroups,
  setRuntimeTaskAssignMode,
  batchSetRuntimeTaskAssignMode,
  batchDispatchRuntimeTasks,
  isRuntimeTaskExecutionTask,
  getTaskById,
  getVisibleRows,
  getDyePendingTaskIds,
  getQcPendingOrderIds,
  getExceptionTaskIds,
  isAffectedByTaskSet,
  getDispatchDialogTasks,
  getDispatchDialogValidation,
  getFactoryOptions,
  emptyDispatchForm,
  emptyDetailDispatchForm,
  fromDateTimeLocal,
  escapeHtml,
  formatScopeLabel,
  formatTaskNo,
  type RuntimeTaskAllocatableGroup,
  type RuntimeTaskAllocatableGroupAssignment,
  type DispatchTask,
  type DetailDispatchForm,
} from './context'
function setTaskAssignMode(taskId: string, mode: 'BIDDING' | 'HOLD', by: string): void {
  setRuntimeTaskAssignMode(taskId, mode, by)
}

function batchSetTaskAssignMode(taskIds: string[], mode: 'BIDDING' | 'HOLD', by: string): void {
  batchSetRuntimeTaskAssignMode(taskIds, mode, by)
}

function batchDispatch(
  taskIds: string[],
  factoryId: string,
  factoryName: string,
  acceptDeadline: string,
  taskDeadline: string,
  remark: string,
  by: string,
  dispatchPrice: number,
  dispatchPriceCurrency: string,
  dispatchPriceUnit: string,
  priceDiffReason: string,
): { ok: boolean; message?: string } {
  return batchDispatchRuntimeTasks({
    taskIds,
    factoryId,
    factoryName,
    acceptDeadline,
    taskDeadline,
    remark,
    by,
    dispatchPrice,
    dispatchPriceCurrency,
    dispatchPriceUnit,
    priceDiffReason,
  })
}

function openDispatchDialog(taskIds: string[]): void {
  const filtered = taskIds.filter((taskId) => Boolean(getTaskById(taskId)))
  if (filtered.length === 0) return

  state.dispatchDialogTaskIds = filtered
  state.dispatchDialogError = null
  state.dispatchForm = emptyDispatchForm()
  state.actionMenuTaskId = null
}

function closeDispatchDialog(): void {
  state.dispatchDialogTaskIds = null
  state.dispatchDialogError = null
  state.dispatchForm = emptyDispatchForm()
}

function getDetailDispatchTask(): DispatchTask | null {
  return getTaskById(state.detailDispatchTaskId)
}

function getDetailDispatchGroups(task: DispatchTask | null): RuntimeTaskAllocatableGroup[] {
  if (!task) return []
  return listRuntimeTaskAllocatableGroups(task.taskId)
}

function getDetailDispatchAssignments(groups: RuntimeTaskAllocatableGroup[]): RuntimeTaskAllocatableGroupAssignment[] {
  return groups
    .map((group) => {
      const selected = state.detailDispatchForm.factoryByGroupKey[group.groupKey]
      if (!selected?.factoryId || !selected.factoryName) return null
      return {
        groupKey: group.groupKey,
        factoryId: selected.factoryId,
        factoryName: selected.factoryName,
      } satisfies RuntimeTaskAllocatableGroupAssignment
    })
    .filter((item): item is RuntimeTaskAllocatableGroupAssignment => Boolean(item))
}

function openDetailDispatchDialog(taskId: string): void {
  const task = getTaskById(taskId)
  if (!task) return
  if (!isRuntimeTaskExecutionTask(task)) return

  const groups = listRuntimeTaskAllocatableGroups(task.taskId)
  const factoryByGroupKey: DetailDispatchForm['factoryByGroupKey'] = {}
  for (const group of groups) {
    if (task.assignedFactoryId && task.assignedFactoryName) {
      factoryByGroupKey[group.groupKey] = {
        factoryId: task.assignedFactoryId,
        factoryName: task.assignedFactoryName,
      }
    }
  }

  state.detailDispatchTaskId = task.taskId
  state.detailDispatchError = null
  state.detailDispatchForm = {
    factoryByGroupKey,
  }
  state.actionMenuTaskId = null
}

function closeDetailDispatchDialog(): void {
  state.detailDispatchTaskId = null
  state.detailDispatchError = null
  state.detailDispatchForm = emptyDetailDispatchForm()
}

function confirmDetailDispatch(): void {
  const task = getDetailDispatchTask()
  if (!task) return

  const groups = getDetailDispatchGroups(task)
  const assignments = getDetailDispatchAssignments(groups)
  const assignmentGranularity = task.assignmentGranularity ?? 'ORDER'
  const uniqueFactoryIds = Array.from(new Set(assignments.map((item) => item.factoryId)))

  if (assignmentGranularity === 'ORDER' && uniqueFactoryIds.length > 1) {
    state.detailDispatchError = '该任务仅支持整任务分配，请选择同一工厂'
    return
  }

  const result = dispatchRuntimeTaskByDetailGroups({
    taskId: task.taskId,
    assignments,
    by: '跟单A',
  })
  if (!result.ok) {
    state.detailDispatchError = result.message ?? '按明细分配失败，请检查后重试'
    return
  }

  closeDetailDispatchDialog()
  state.selectedIds = new Set<string>()
}
function applyAutoAssign(): void {
  const rows = getVisibleRows()
  const dyePendingTaskIds = getDyePendingTaskIds()
  const qcPendingOrderIds = getQcPendingOrderIds()
  const exceptionTaskIds = getExceptionTaskIds()

  const unsetRows = rows.filter((task) => {
    const lastLog = task.auditLogs[task.auditLogs.length - 1]
    return !(lastLog?.action === 'SET_ASSIGN_MODE') && task.assignmentStatus === 'UNASSIGNED'
  })

  const bidTaskIds = unsetRows
    .filter((task) => {
      const alloc = initialAllocationByTaskId[task.taskId] ?? initialAllocationByTaskId[task.baseTaskId]
      return (
        isAffectedByTaskSet(task, dyePendingTaskIds) ||
        qcPendingOrderIds.has(task.productionOrderId) ||
        Boolean(alloc && (alloc.availableQty ?? 1) <= 0)
      )
    })
    .map((task) => task.taskId)

  const holdTaskIds = unsetRows
    .filter((task) => task.status === 'BLOCKED' || isAffectedByTaskSet(task, exceptionTaskIds))
    .map((task) => task.taskId)

  if (bidTaskIds.length > 0) {
    batchSetTaskAssignMode(bidTaskIds, 'BIDDING', '自动分配')
  }

  if (holdTaskIds.length > 0) {
    batchSetTaskAssignMode(holdTaskIds, 'HOLD', '自动分配')
  }

  state.autoAssignDone = true
}

function confirmDirectDispatch(): void {
  const tasks = getDispatchDialogTasks()
  if (tasks.length === 0) return

  const selectionValidation = validateRuntimeBatchDispatchSelection(tasks.map((task) => task.taskId))
  if (!selectionValidation.valid) {
    state.dispatchDialogError = selectionValidation.reason ?? '批量派单条件不满足'
    return
  }

  const validation = getDispatchDialogValidation(tasks)
  if (!validation.valid || validation.dispatchPrice == null) return

  const acceptDeadline = fromDateTimeLocal(state.dispatchForm.acceptDeadline)
  const taskDeadline = fromDateTimeLocal(state.dispatchForm.taskDeadline)

  const result = batchDispatch(
    tasks.map((task) => task.taskId),
    state.dispatchForm.factoryId,
    state.dispatchForm.factoryName,
    acceptDeadline,
    taskDeadline,
    state.dispatchForm.remark,
    '跟单A',
    validation.dispatchPrice,
    validation.stdCurrency,
    validation.stdUnit,
    state.dispatchForm.priceDiffReason,
  )

  if (!result.ok) {
    state.dispatchDialogError = result.message ?? '派单失败，请调整后重试'
    return
  }

  closeDispatchDialog()
  state.selectedIds = new Set<string>()
}

function renderDirectDispatchDialog(tasks: DispatchTask[], factoryOptions: Array<{ id: string; name: string }>): string {
  if (!state.dispatchDialogTaskIds) return ''
  if (tasks.length === 0) return ''

  const isBatch = tasks.length > 1
  const selectionValidation = validateRuntimeBatchDispatchSelection(tasks.map((task) => task.taskId))
  const validation = getDispatchDialogValidation(tasks)
  const refTask = tasks[0]
  const canSubmit = selectionValidation.valid && validation.valid
  const selectionError =
    state.dispatchDialogError ??
    (!selectionValidation.valid ? selectionValidation.reason ?? '批量派单条件不满足' : '')

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-dispatch-action="close-direct-dispatch" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 max-h-[90vh] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-dispatch-action="close-direct-dispatch" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <h3 class="text-lg font-semibold">${isBatch ? '批量直接派单' : '直接派单'}</h3>

        <div class="mt-4 space-y-4">
          ${
            isBatch
              ? `<div class="rounded-md border bg-muted/40 px-3 py-2 text-sm">已选择 <span class="font-semibold">${tasks.length}</span> 个任务</div>`
              : `<div class="rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1">
                  <div class="flex justify-between gap-2"><span class="text-muted-foreground">任务编号</span><span class="font-mono text-xs">${escapeHtml(refTask.taskId)}</span></div>
                  <div class="flex justify-between gap-2"><span class="text-muted-foreground">生产单号</span><span class="font-mono text-xs">${escapeHtml(refTask.productionOrderId)}</span></div>
                  <div class="flex justify-between gap-2"><span class="text-muted-foreground">工序</span><span class="font-mono text-xs">${escapeHtml(refTask.processNameZh)}</span></div>
                  <div class="flex justify-between gap-2"><span class="text-muted-foreground">执行范围</span><span class="font-mono text-xs">${escapeHtml(formatScopeLabel(refTask))}</span></div>
                  <div class="flex justify-between gap-2"><span class="text-muted-foreground">数量</span><span class="font-mono text-xs">${refTask.scopeQty} 件</span></div>
                </div>`
          }
          ${
            selectionError
              ? `<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">${escapeHtml(selectionError)}</div>`
              : ''
          }

          <div class="space-y-1.5">
            <label class="text-sm font-medium">承接工厂 <span class="text-red-500">*</span></label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-dispatch-field="dispatch.factoryId">
              <option value="" ${state.dispatchForm.factoryId === '' ? 'selected' : ''}>请选择承接工厂</option>
              ${factoryOptions
                .map(
                  (factory) =>
                    `<option value="${escapeHtml(factory.id)}" ${state.dispatchForm.factoryId === factory.id ? 'selected' : ''}>${escapeHtml(factory.name)}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">接单截止时间 <span class="text-red-500">*</span></label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="datetime-local" data-dispatch-field="dispatch.acceptDeadline" value="${escapeHtml(state.dispatchForm.acceptDeadline)}" />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">任务截止时间 <span class="text-red-500">*</span></label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="datetime-local" data-dispatch-field="dispatch.taskDeadline" value="${escapeHtml(state.dispatchForm.taskDeadline)}" />
          </div>

          <div class="rounded-md border bg-muted/20 p-3 space-y-3">
            <p class="text-sm font-medium">价格信息</p>

            <div class="flex items-center justify-between gap-2">
              <span class="text-sm text-muted-foreground">工序标准价</span>
              <span class="text-sm font-medium tabular-nums">${validation.stdPrice.toLocaleString()} ${escapeHtml(validation.stdCurrency)}/${escapeHtml(validation.stdUnit)}</span>
            </div>

            <div class="space-y-1.5">
              <label class="text-sm font-medium">直接派单价 <span class="text-red-500">*</span></label>
              <div class="flex items-center gap-2">
                <input class="h-9 flex-1 rounded-md border bg-background px-3 text-sm" type="number" min="0" step="100" placeholder="${validation.stdPrice}" data-dispatch-field="dispatch.dispatchPrice" value="${escapeHtml(state.dispatchForm.dispatchPrice)}" />
                <span class="shrink-0 whitespace-nowrap text-sm text-muted-foreground">${escapeHtml(validation.stdCurrency)}/${escapeHtml(validation.stdUnit)}</span>
              </div>
            </div>

            ${
              validation.dispatchPrice != null && validation.diffPct != null
                ? `<div class="flex items-center justify-between gap-2">
                    <span class="text-sm text-muted-foreground">价格偏差</span>
                    <span class="text-sm font-medium tabular-nums ${
                      !validation.changed
                        ? 'text-green-700'
                        : (validation.diff ?? 0) > 0
                          ? 'text-amber-700'
                          : 'text-blue-700'
                    }">
                      ${
                        !validation.changed
                          ? '0（0%）'
                          : `${(validation.diff ?? 0) > 0 ? '+' : ''}${(validation.diff ?? 0).toLocaleString()} ${escapeHtml(validation.stdCurrency)}/${escapeHtml(validation.stdUnit)}（${(validation.diff ?? 0) > 0 ? '+' : ''}${validation.diffPct}%）`
                      }
                    </span>
                  </div>`
                : ''
            }

            ${
              validation.needDiffReason
                ? `<div class="space-y-1.5">
                    <label class="text-sm font-medium">价格偏差原因 <span class="text-red-500">*</span></label>
                    <textarea class="w-full rounded-md border bg-background px-3 py-2 text-sm" rows="2" data-dispatch-field="dispatch.priceDiffReason" placeholder="请说明偏差原因，如：急单加价、特殊工艺、产能紧张、历史协议价等">${escapeHtml(state.dispatchForm.priceDiffReason)}</textarea>
                  </div>`
                : ''
            }
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">派单备注 <span class="text-xs text-muted-foreground">（选填）</span></label>
            <textarea class="w-full rounded-md border bg-background px-3 py-2 text-sm" rows="2" data-dispatch-field="dispatch.remark" placeholder="填写派单说明、注意事项等...">${escapeHtml(state.dispatchForm.remark)}</textarea>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-dispatch-action="close-direct-dispatch">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            canSubmit ? '' : 'pointer-events-none opacity-50'
          }" data-dispatch-action="confirm-direct-dispatch">确认派单</button>
        </div>
      </section>
    </div>
  `
}

function renderDetailDispatchDialog(
  task: DispatchTask | null,
  groups: RuntimeTaskAllocatableGroup[],
  factoryOptions: Array<{ id: string; name: string }>,
): string {
  if (!task || !state.detailDispatchTaskId) return ''

  const assignmentGranularity = task.assignmentGranularity ?? 'ORDER'
  const assignmentGranularityLabel: Record<string, string> = {
    ORDER: '按生产单',
    COLOR: '按颜色',
    SKU: '按SKU',
    DETAIL: '按明细行',
  }
  const detailSplitDimensionsText =
    task.detailSplitDimensions && task.detailSplitDimensions.length > 0
      ? task.detailSplitDimensions.join(' + ')
      : 'GARMENT_SKU'
  const assignments = getDetailDispatchAssignments(groups)
  const selectedFactoryIds = Array.from(new Set(assignments.map((item) => item.factoryId)))
  const isOrderBlocked = assignmentGranularity === 'ORDER' && selectedFactoryIds.length > 1
  const canSubmit = groups.length > 0 && assignments.length === groups.length && !isOrderBlocked

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-dispatch-action="close-detail-dispatch" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 max-h-[90vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-dispatch-action="close-detail-dispatch" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <h3 class="text-lg font-semibold">按明细分配</h3>

        <div class="mt-4 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <div class="grid gap-1 sm:grid-cols-2">
            <div>任务编号：<span class="font-mono text-xs">${escapeHtml(formatTaskNo(task))}</span></div>
            <div>生产单号：<span class="font-mono text-xs">${escapeHtml(task.productionOrderId)}</span></div>
            <div>所属阶段：${escapeHtml(task.stageName ?? '-')}</div>
            <div>工序/工艺：${escapeHtml(task.processNameZh)} / ${escapeHtml(task.craftName ?? task.processNameZh)}</div>
            <div>任务类型：${escapeHtml(task.taskCategoryZh ?? task.processNameZh)}</div>
            <div>最小可分配粒度：${escapeHtml(assignmentGranularityLabel[assignmentGranularity] ?? assignmentGranularity)}</div>
            <div class="sm:col-span-2">任务明细拆分方式：组合维度（${escapeHtml(detailSplitDimensionsText)}）</div>
          </div>
        </div>

        ${
          assignmentGranularity === 'ORDER'
            ? '<div class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">该任务仅支持整任务分配。可查看明细行，但不能将不同分配单元分配给不同工厂。</div>'
            : ''
        }
        ${
          state.detailDispatchError
            ? `<div class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${escapeHtml(state.detailDispatchError)}</div>`
            : ''
        }

        <div class="mt-4 overflow-x-auto rounded-md border">
          <table class="w-full min-w-[820px] text-sm">
            <thead>
              <tr class="border-b bg-muted/40 text-xs">
                <th class="px-3 py-2 text-left font-medium">分配单元</th>
                <th class="px-3 py-2 text-left font-medium">数量</th>
                <th class="px-3 py-2 text-left font-medium">维度说明</th>
                <th class="px-3 py-2 text-left font-medium">目标工厂</th>
              </tr>
            </thead>
            <tbody>
              ${
                groups.length === 0
                  ? '<tr><td colspan="4" class="py-8 text-center text-sm text-muted-foreground">暂无可分配单元</td></tr>'
                  : groups
                      .map((group) => {
                        const selectedFactory = state.detailDispatchForm.factoryByGroupKey[group.groupKey]
                        const dimensionsText = Object.entries(group.dimensions)
                          .map(([key, value]) => `${key}:${value}`)
                          .join('；')
                        return `
                          <tr class="border-b last:border-b-0">
                            <td class="px-3 py-2">${escapeHtml(group.groupLabel)}</td>
                            <td class="px-3 py-2 font-mono text-xs">${group.qty} 件</td>
                            <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(dimensionsText || '-')}</td>
                            <td class="px-3 py-2">
                              <select class="h-8 w-full rounded-md border bg-background px-2 text-xs" data-dispatch-field="detail.factoryId" data-group-key="${escapeHtml(group.groupKey)}">
                                <option value="">请选择工厂</option>
                                ${factoryOptions
                                  .map(
                                    (factory) => `
                                    <option
                                      value="${escapeHtml(factory.id)}"
                                      ${selectedFactory?.factoryId === factory.id ? 'selected' : ''}
                                    >${escapeHtml(factory.name)}</option>
                                  `,
                                  )
                                  .join('')}
                              </select>
                            </td>
                          </tr>
                        `
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-dispatch-action="close-detail-dispatch">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            canSubmit ? '' : 'pointer-events-none opacity-50'
          }" data-dispatch-action="confirm-detail-dispatch">确认分配</button>
        </div>
      </section>
    </div>
  `
}

export {
  setTaskAssignMode,
  batchSetTaskAssignMode,
  batchDispatch,
  openDispatchDialog,
  closeDispatchDialog,
  getDetailDispatchTask,
  getDetailDispatchGroups,
  getDetailDispatchAssignments,
  openDetailDispatchDialog,
  closeDetailDispatchDialog,
  confirmDetailDispatch,
  applyAutoAssign,
  confirmDirectDispatch,
  renderDirectDispatchDialog,
  renderDetailDispatchDialog,
}
