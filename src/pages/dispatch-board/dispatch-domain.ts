import {
  state,
  initialAllocationByTaskId,
  validateRuntimeBatchDispatchSelection,
  createDispatchCapacityEvaluationContext,
  createDispatchStandardTimeEvaluationContext,
  getTaskAllocatableGroups,
  supportsDetailAssignment,
  dispatchRuntimeTaskByDetailGroups,
  applyRuntimeDirectDispatchMeta,
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
  describeDispatchCapacityConstraintDecision,
  formatPublishedSamNumber,
  fromDateTimeLocal,
  escapeHtml,
  formatScopeLabel,
  formatTaskNo,
  createFreezeFromDirectDispatch,
  resolveAllocatableGroupPublishedSam,
  resolveAllocatableGroupFactoryCapacityConstraint,
  resolveAllocatableGroupFactoryStandardTimeJudgement,
  resolveTaskPublishedSam,
  resolveTaskFactoryCapacityConstraint,
  resolveTaskFactoryStandardTimeJudgement,
  syncDispatchCapacityUsageLedger,
  type RuntimeTaskAllocatableGroup,
  type RuntimeTaskAllocatableGroupAssignment,
  type DispatchCapacityConstraintSnapshot,
  type DispatchStandardTimeJudgementSnapshot,
  type DispatchTask,
} from './context.ts'

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

function getDispatchSingleTask(): DispatchTask | null {
  const tasks = getDispatchDialogTasks()
  return tasks.length === 1 ? tasks[0] : null
}

function getDirectDispatchGroups(task: DispatchTask | null): RuntimeTaskAllocatableGroup[] {
  return getTaskAllocatableGroups(task)
}

function getDirectDispatchAssignments(
  groups: RuntimeTaskAllocatableGroup[],
): RuntimeTaskAllocatableGroupAssignment[] {
  return groups
    .map((group) => {
      const selected = state.dispatchForm.factoryByGroupKey[group.groupKey]
      if (!selected?.factoryId || !selected.factoryName) return null
      return {
        groupKey: group.groupKey,
        factoryId: selected.factoryId,
        factoryName: selected.factoryName,
      } satisfies RuntimeTaskAllocatableGroupAssignment
    })
    .filter((item): item is RuntimeTaskAllocatableGroupAssignment => Boolean(item))
}

function getConstraintTone(snapshot: DispatchCapacityConstraintSnapshot | null): string {
  if (!snapshot) return 'border-slate-200 bg-slate-50 text-slate-600'
  if (snapshot.status === 'PAUSED') return 'border-red-200 bg-red-50 text-red-700'
  if (snapshot.status === 'OVERLOADED') return 'border-red-200 bg-red-50 text-red-700'
  if (snapshot.status === 'TIGHT') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (snapshot.status === 'DATE_INCOMPLETE' || snapshot.status === 'SAM_MISSING') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  return 'border-green-200 bg-green-50 text-green-700'
}

function renderCapacityConstraintSummary(
  snapshot: DispatchCapacityConstraintSnapshot | null,
  placeholder: string,
  testId?: string,
): string {
  if (!snapshot) {
    return `<div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground"${testId ? ` data-${testId}="empty"` : ''}>${escapeHtml(placeholder)}</div>`
  }

  return `
    <div class="rounded-md border px-3 py-2 text-xs ${getConstraintTone(snapshot)}" ${testId ? `data-${testId}="${escapeHtml(snapshot.status)}"` : ''}>
      <div class="flex items-center gap-2">
        <span class="inline-flex rounded border px-2 py-0.5 text-[10px] font-medium ${getConstraintTone(snapshot)}">${escapeHtml(snapshot.statusLabel)}</span>
        <span class="font-medium">${escapeHtml(describeDispatchCapacityConstraintDecision(snapshot))}</span>
      </div>
      <p class="mt-1 leading-5">${escapeHtml(snapshot.reason)}</p>
    </div>
  `
}

function getStandardTimeJudgementTone(snapshot: DispatchStandardTimeJudgementSnapshot | null): string {
  if (!snapshot) return 'border-slate-200 bg-slate-50 text-slate-600'
  if (snapshot.status === 'EXCEEDS_WINDOW') return 'border-red-200 bg-red-50 text-red-700'
  if (snapshot.status === 'RISK' || snapshot.status === 'DATE_INCOMPLETE' || snapshot.status === 'SAM_MISSING') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  return 'border-green-200 bg-green-50 text-green-700'
}

function renderStandardTimeJudgementSummary(
  snapshot: DispatchStandardTimeJudgementSnapshot | null,
  placeholder: string,
  testId?: string,
): string {
  if (!snapshot) {
    return `<div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground"${testId ? ` data-${testId}="empty"` : ''}>${escapeHtml(placeholder)}</div>`
  }

  const tone = getStandardTimeJudgementTone(snapshot)
  const estimatedDaysText = snapshot.estimatedDays != null ? `${formatPublishedSamNumber(snapshot.estimatedDays)} 天` : '--'
  const windowText = snapshot.windowDays > 0 ? `未来 ${snapshot.windowDays} 天` : '未来 0 天'

  return `
    <div class="rounded-md border px-3 py-2 text-xs ${tone}" ${testId ? `data-${testId}="${escapeHtml(snapshot.status)}"` : ''}>
      <div class="flex items-center gap-2 flex-wrap">
        <span class="inline-flex rounded border px-2 py-0.5 text-[10px] font-medium ${tone}">${escapeHtml(snapshot.statusLabel)}</span>
        <span class="font-medium">${escapeHtml(snapshot.reason)}</span>
      </div>
      <div class="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div><span class="text-muted-foreground">窗口天数：</span><span class="font-medium">${escapeHtml(windowText)}</span></div>
        <div><span class="text-muted-foreground">窗口总供给：</span><span class="font-medium">${formatPublishedSamNumber(snapshot.windowSupplySam)} 标准工时</span></div>
        <div><span class="text-muted-foreground">已占用：</span><span class="font-medium">${formatPublishedSamNumber(snapshot.windowCommittedSam)} 标准工时</span></div>
        <div><span class="text-muted-foreground">已冻结：</span><span class="font-medium">${formatPublishedSamNumber(snapshot.windowFrozenSam)} 标准工时</span></div>
        <div><span class="text-muted-foreground">窗口剩余：</span><span class="font-medium">${formatPublishedSamNumber(snapshot.windowRemainingSam)} 标准工时</span></div>
        <div><span class="text-muted-foreground">当前任务：</span><span class="font-medium">${formatPublishedSamNumber(snapshot.taskDemandSam)} 标准工时</span></div>
        <div><span class="text-muted-foreground">预计消耗：</span><span class="font-medium">${escapeHtml(estimatedDaysText)}</span></div>
        <div><span class="text-muted-foreground">日供给：</span><span class="font-medium">${formatPublishedSamNumber(snapshot.dailySupplySam)} 标准工时</span></div>
      </div>
      ${
        snapshot.fallbackRuleLabel || snapshot.note
          ? `<p class="mt-2 leading-5">${escapeHtml([snapshot.fallbackRuleLabel, snapshot.note].filter(Boolean).join(' '))}</p>`
          : ''
      }
    </div>
  `
}

function openDispatchDialog(taskIds: string[]): void {
  const filtered = taskIds
    .map((taskId) => getTaskById(taskId))
    .filter((task): task is DispatchTask => Boolean(task))

  if (filtered.length === 0) return

  const nextForm = emptyDispatchForm()
  if (filtered.length === 1) {
    const task = filtered[0]
    const detailSupported = supportsDetailAssignment(task)
    nextForm.mode = detailSupported ? 'DETAIL' : 'TASK'

    if (task.assignedFactoryId && task.assignedFactoryName) {
      nextForm.factoryId = task.assignedFactoryId
      nextForm.factoryName = task.assignedFactoryName
      for (const group of getDirectDispatchGroups(task)) {
        nextForm.factoryByGroupKey[group.groupKey] = {
          factoryId: task.assignedFactoryId,
          factoryName: task.assignedFactoryName,
        }
      }
    }
  }

  state.dispatchDialogTaskIds = filtered.map((task) => task.taskId)
  state.dispatchDialogError = null
  state.dispatchForm = nextForm
  state.actionMenuTaskId = null
}

function closeDispatchDialog(): void {
  state.dispatchDialogTaskIds = null
  state.dispatchDialogError = null
  state.dispatchForm = emptyDispatchForm()
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
  if (!validation.valid || validation.dispatchPrice == null) {
    state.dispatchDialogError = '请先补齐派单必填信息'
    return
  }

  const acceptDeadline = fromDateTimeLocal(state.dispatchForm.acceptDeadline)
  const taskDeadline = fromDateTimeLocal(state.dispatchForm.taskDeadline)
  const singleTask = tasks.length === 1 ? tasks[0] : null
  const groups = getDirectDispatchGroups(singleTask)
  const detailMode = Boolean(singleTask && supportsDetailAssignment(singleTask) && state.dispatchForm.mode === 'DETAIL')
  const evaluationContext = singleTask ? createDispatchCapacityEvaluationContext() : null

  if (detailMode && singleTask) {
    const assignments = getDirectDispatchAssignments(groups)
    if (assignments.length !== groups.length) {
      state.dispatchDialogError = '请为每个明细分配单元选择目标工厂'
      return
    }

    for (const group of groups) {
      const selected = state.dispatchForm.factoryByGroupKey[group.groupKey]
      if (!selected?.factoryId) continue
      const constraint = resolveAllocatableGroupFactoryCapacityConstraint(
        singleTask,
        group,
        selected.factoryId,
        selected.factoryName,
        evaluationContext ?? undefined,
      )
      if (constraint?.hardBlocked) {
        state.dispatchDialogError = `${group.groupLabel} 不可派给 ${selected.factoryName}：${constraint.reason}`
        return
      }
    }

    const result = dispatchRuntimeTaskByDetailGroups({
      taskId: singleTask.taskId,
      assignments,
      by: '跟单A',
    })
    if (!result.ok || !result.resultAssignments) {
      state.dispatchDialogError = result.message ?? '按明细派单失败，请检查后重试'
      return
    }

    const assignmentsByTaskId = new Map<string, (typeof result.resultAssignments)[number]>()
    for (const assignment of result.resultAssignments) {
      const current = assignmentsByTaskId.get(assignment.taskId)
      if (!current) {
        assignmentsByTaskId.set(assignment.taskId, { ...assignment })
        continue
      }

      assignmentsByTaskId.set(assignment.taskId, {
        ...current,
        publishedSamTotal:
          (current.publishedSamTotal ?? 0) + (assignment.publishedSamTotal ?? 0),
      })
    }

    for (const assignment of assignmentsByTaskId.values()) {
      applyRuntimeDirectDispatchMeta({
        taskId: assignment.taskId,
        factoryId: assignment.factoryId,
        factoryName: assignment.factoryName,
        acceptDeadline,
        taskDeadline,
        remark: state.dispatchForm.remark,
        by: '跟单A',
        dispatchPrice: validation.dispatchPrice,
        dispatchPriceCurrency: validation.stdCurrency,
        dispatchPriceUnit: validation.stdUnit,
        priceDiffReason: state.dispatchForm.priceDiffReason,
        publishedSamPerUnit: assignment.publishedSamPerUnit,
        publishedSamUnit: assignment.publishedSamUnit,
        publishedSamTotal: assignment.publishedSamTotal,
        publishedSamDifficulty: assignment.publishedSamDifficulty,
      })
    }

    for (const assignment of result.resultAssignments) {
      const resolvedTask = getTaskById(assignment.taskId) ?? singleTask
      createFreezeFromDirectDispatch(resolvedTask, {
        factoryId: assignment.factoryId,
        allocationUnitId: assignment.allocationUnitId,
        standardSamTotal: assignment.publishedSamTotal,
        note: assignment.allocationUnitId
          ? '按明细直接派单后，分配单元进入待接单冻结。'
          : '直接派单后进入待接单冻结。',
      })
    }

    syncDispatchCapacityUsageLedger()
    closeDispatchDialog()
    state.selectedIds = new Set<string>()
    return
  }

  if (state.dispatchForm.factoryId.trim() === '' || state.dispatchForm.factoryName.trim() === '') {
    state.dispatchDialogError = '请选择承接工厂'
    return
  }

  if (singleTask) {
    const constraint = resolveTaskFactoryCapacityConstraint(
      singleTask,
      state.dispatchForm.factoryId,
      state.dispatchForm.factoryName,
      evaluationContext ?? undefined,
    )
    if (constraint?.hardBlocked) {
      state.dispatchDialogError = `当前工厂不可派单：${constraint.reason}`
      return
    }
  }

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

  syncDispatchCapacityUsageLedger()
  closeDispatchDialog()
  state.selectedIds = new Set<string>()
}

function renderDetailDispatchMode(
  task: DispatchTask,
  groups: RuntimeTaskAllocatableGroup[],
  factoryOptions: Array<{ id: string; name: string }>,
  evaluationContext?: ReturnType<typeof createDispatchCapacityEvaluationContext>,
  samEvaluationContext?: ReturnType<typeof createDispatchStandardTimeEvaluationContext>,
): string {
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

  return `
    <div class="space-y-3 rounded-md border bg-muted/15 p-3">
      <div class="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div>最小可分配粒度：${escapeHtml(assignmentGranularityLabel[assignmentGranularity] ?? assignmentGranularity)}</div>
        <div>明细拆分方式：${escapeHtml(detailSplitDimensionsText)}</div>
      </div>

      <div class="overflow-x-auto rounded-md border">
        <table class="w-full min-w-[980px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-xs">
              <th class="px-3 py-2 text-left font-medium">分配单元</th>
              <th class="px-3 py-2 text-left font-medium">数量</th>
              <th class="px-3 py-2 text-left font-medium">当前明细总标准工时</th>
              <th class="px-3 py-2 text-left font-medium">维度说明</th>
              <th class="px-3 py-2 text-left font-medium">目标工厂</th>
            </tr>
          </thead>
          <tbody>
            ${groups
              .map((group) => {
                const selectedFactory = state.dispatchForm.factoryByGroupKey[group.groupKey]
                const dimensionsText = Object.entries(group.dimensions)
                  .map(([key, value]) => `${key}:${value}`)
                  .join('；')
                const groupSam = resolveAllocatableGroupPublishedSam(task, group)
                const selectedFactoryId = selectedFactory?.factoryId ?? ''
                const selectedConstraint = selectedFactoryId
                  ? resolveAllocatableGroupFactoryCapacityConstraint(
                      task,
                      group,
                      selectedFactoryId,
                      selectedFactory?.factoryName,
                      evaluationContext,
                    )
                  : null
                const selectedSamJudgement = selectedFactoryId
                  ? resolveAllocatableGroupFactoryStandardTimeJudgement(
                      task,
                      group,
                      selectedFactoryId,
                      samEvaluationContext,
                    )
                  : null
                const unitSamText =
                  groupSam.publishedSamPerUnit && groupSam.publishedSamUnit
                    ? `${formatPublishedSamNumber(groupSam.publishedSamPerUnit)} ${escapeHtml(groupSam.publishedSamUnit)}`
                    : '--'
                const totalSamText =
                  groupSam.publishedSamTotal != null && groupSam.publishedSamUnit
                    ? `${formatPublishedSamNumber(groupSam.publishedSamTotal)} ${escapeHtml(groupSam.publishedSamUnit.replace(/^分钟\//, '分钟'))}`
                    : '--'

                return `
                  <tr class="border-b last:border-b-0" data-dispatch-group="${escapeHtml(group.groupKey)}">
                    <td class="px-3 py-2">${escapeHtml(group.groupLabel)}</td>
                    <td class="px-3 py-2 font-mono text-xs">${group.qty} 件</td>
                    <td class="px-3 py-2 text-xs" data-dispatch-group-sam="${escapeHtml(group.groupKey)}">
                        <div class="space-y-1">
                          <div><span class="text-muted-foreground">单位标准工时：</span><span class="font-medium">${unitSamText}</span></div>
                          <div><span class="text-muted-foreground">当前明细总标准工时：</span><span class="font-medium text-blue-700">${totalSamText}</span></div>
                        </div>
                      </td>
                      <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(dimensionsText || '-')}</td>
                      <td class="px-3 py-2">
                        <select class="h-8 w-full rounded-md border bg-background px-2 text-xs" data-dispatch-field="dispatch.groupFactoryId" data-group-key="${escapeHtml(group.groupKey)}">
                          <option value="">请选择工厂</option>
                          ${factoryOptions
                          .map((factory) => {
                            const optionConstraint = resolveAllocatableGroupFactoryCapacityConstraint(
                              task,
                              group,
                              factory.id,
                              factory.name,
                              evaluationContext,
                            )
                            const disabled = optionConstraint?.hardBlocked ?? false
                            const labelSuffix =
                              optionConstraint && optionConstraint.status !== 'NORMAL'
                                ? `（${optionConstraint.statusLabel}）`
                                : ''
                            return `
                              <option value="${escapeHtml(factory.id)}" ${selectedFactory?.factoryId === factory.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${escapeHtml(factory.name)}${escapeHtml(labelSuffix)}</option>
                            `
                          })
                          .join('')}
                        </select>
                        <div class="mt-2" data-dispatch-group-constraint="${escapeHtml(group.groupKey)}">
                          ${renderCapacityConstraintSummary(
                            selectedConstraint,
                            '选择工厂后，将按该分配单元的任务日期窗口校验产能日历状态。',
                          )}
                        </div>
                        <div class="mt-2" data-dispatch-group-sam-judgement="${escapeHtml(group.groupKey)}">
                          ${renderStandardTimeJudgementSummary(
                            selectedSamJudgement,
                            '选择工厂后，将显示该分配单元在未来窗口内的标准工时判断。',
                          )}
                        </div>
                      </td>
                    </tr>
                  `
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderDirectDispatchDialog(tasks: DispatchTask[], factoryOptions: Array<{ id: string; name: string }>): string {
  if (!state.dispatchDialogTaskIds || tasks.length === 0) return ''

  const isBatch = tasks.length > 1
  const refTask = tasks[0]
  const selectionValidation = validateRuntimeBatchDispatchSelection(tasks.map((task) => task.taskId))
  const validation = getDispatchDialogValidation(tasks)
  const detailSupported = !isBatch && supportsDetailAssignment(refTask)
  const detailMode = detailSupported && state.dispatchForm.mode === 'DETAIL'
  const groups = detailSupported ? getDirectDispatchGroups(refTask) : []
  const detailAssignments = detailMode ? getDirectDispatchAssignments(groups) : []
  const taskSam = !isBatch ? resolveTaskPublishedSam(refTask) : {}
  const evaluationContext = !isBatch ? createDispatchCapacityEvaluationContext() : undefined
  const samEvaluationContext = !isBatch ? createDispatchStandardTimeEvaluationContext() : undefined
  const taskFactoryConstraints = !isBatch
    ? new Map(
        factoryOptions.map((factory) => [
          factory.id,
          resolveTaskFactoryCapacityConstraint(refTask, factory.id, factory.name, evaluationContext),
        ]),
      )
    : new Map<string, DispatchCapacityConstraintSnapshot | null>()
  const taskFactorySamJudgements = !isBatch
    ? new Map(
        factoryOptions.map((factory) => [
          factory.id,
          resolveTaskFactoryStandardTimeJudgement(refTask, factory.id, samEvaluationContext),
        ]),
      )
    : new Map<string, DispatchStandardTimeJudgementSnapshot | null>()
  const selectedTaskConstraint =
    !isBatch && state.dispatchForm.factoryId
      ? (taskFactoryConstraints.get(state.dispatchForm.factoryId) ?? null)
      : null
  const selectedTaskSamJudgement =
    !isBatch && state.dispatchForm.factoryId
      ? (taskFactorySamJudgements.get(state.dispatchForm.factoryId) ?? null)
      : null
  const detailBlocked =
    detailMode &&
    groups.some((group) => {
      const selected = state.dispatchForm.factoryByGroupKey[group.groupKey]
      if (!selected?.factoryId) return false
      const constraint = resolveAllocatableGroupFactoryCapacityConstraint(
        refTask,
        group,
        selected.factoryId,
        selected.factoryName,
        evaluationContext,
      )
      return Boolean(constraint?.hardBlocked)
    })
  const unitSamText =
    taskSam.publishedSamPerUnit && taskSam.publishedSamUnit
      ? `${formatPublishedSamNumber(taskSam.publishedSamPerUnit)} ${escapeHtml(taskSam.publishedSamUnit)}`
      : '--'
  const totalSamText =
    taskSam.publishedSamTotal != null && taskSam.publishedSamUnit
      ? `${formatPublishedSamNumber(taskSam.publishedSamTotal)} ${escapeHtml(taskSam.publishedSamUnit.replace(/^分钟\//, '分钟'))}`
      : '--'
  const selectionError =
    state.dispatchDialogError ??
    (!selectionValidation.valid ? selectionValidation.reason ?? '批量派单条件不满足' : '')

  const canSubmit =
    selectionValidation.valid &&
    validation.valid &&
    (detailMode ? groups.length > 0 && detailAssignments.length === groups.length : state.dispatchForm.factoryId.trim() !== '') &&
    !Boolean(selectedTaskConstraint?.hardBlocked) &&
    !detailBlocked

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-dispatch-action="close-direct-dispatch" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 max-h-[90vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-dispatch-action="close-direct-dispatch" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <h3 class="text-lg font-semibold">${isBatch ? '批量直接派单' : '直接派单'}</h3>

        <div class="mt-4 space-y-4">
          ${
            isBatch
              ? `<div class="rounded-md border bg-muted/40 px-3 py-2 text-sm">已选择 <span class="font-semibold">${tasks.length}</span> 个任务，批量场景仅支持整任务派单。</div>`
              : `<div class="rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1">
                  <div class="flex justify-between gap-2"><span class="text-muted-foreground">任务编号</span><span class="font-mono text-xs">${escapeHtml(formatTaskNo(refTask))}</span></div>
                  <div class="flex justify-between gap-2"><span class="text-muted-foreground">生产单号</span><span class="font-mono text-xs">${escapeHtml(refTask.productionOrderId)}</span></div>
                  <div class="flex justify-between gap-2"><span class="text-muted-foreground">工序</span><span class="font-mono text-xs">${escapeHtml(refTask.processNameZh)}</span></div>
                  <div class="flex justify-between gap-2"><span class="text-muted-foreground">执行范围</span><span class="font-mono text-xs">${escapeHtml(formatScopeLabel(refTask))}</span></div>
                  <div class="flex justify-between gap-2"><span class="text-muted-foreground">数量</span><span class="font-mono text-xs">${refTask.scopeQty} 件</span></div>
                  <div class="flex justify-between gap-2" data-dispatch-task-sam="per-unit"><span class="text-muted-foreground">单位标准工时</span><span class="font-mono text-xs">${unitSamText}</span></div>
                  <div class="flex justify-between gap-2" data-dispatch-task-sam="total"><span class="text-muted-foreground">任务总标准工时</span><span class="font-mono text-xs text-blue-700">${totalSamText}</span></div>
                </div>`
          }

          ${
            detailSupported
              ? `<div class="space-y-1.5">
                  <label class="text-sm font-medium">派单模式</label>
                  <div class="inline-flex rounded-md bg-muted p-1 text-sm">
                    <button class="rounded-md px-3 py-1.5 ${state.dispatchForm.mode === 'TASK' ? 'bg-background shadow-sm' : 'text-muted-foreground'}" data-dispatch-action="switch-dispatch-mode" data-mode="TASK" data-dispatch-mode="TASK">整任务派单</button>
                    <button class="rounded-md px-3 py-1.5 ${state.dispatchForm.mode === 'DETAIL' ? 'bg-background shadow-sm' : 'text-muted-foreground'}" data-dispatch-action="switch-dispatch-mode" data-mode="DETAIL" data-dispatch-mode="DETAIL">按明细派单</button>
                  </div>
                </div>`
              : !isBatch
                ? '<p class="text-xs text-muted-foreground">当前任务仅支持整任务派单。</p>'
                : ''
          }

          ${
            selectionError
              ? `<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">${escapeHtml(selectionError)}</div>`
              : ''
          }

          ${
            detailMode
              ? renderDetailDispatchMode(refTask, groups, factoryOptions, evaluationContext, samEvaluationContext)
              : `<div class="space-y-1.5">
                  <label class="text-sm font-medium">承接工厂 <span class="text-red-500">*</span></label>
                  <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-dispatch-field="dispatch.factoryId">
                    <option value="" ${state.dispatchForm.factoryId === '' ? 'selected' : ''}>请选择承接工厂</option>
                    ${factoryOptions
                      .map((factory) => {
                        const constraint = taskFactoryConstraints.get(factory.id)
                        const disabled = constraint?.hardBlocked ?? false
                        const labelSuffix =
                          constraint && constraint.status !== 'NORMAL'
                            ? `（${constraint.statusLabel}）`
                            : ''
                        return `<option value="${escapeHtml(factory.id)}" ${state.dispatchForm.factoryId === factory.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${escapeHtml(factory.name)}${escapeHtml(labelSuffix)}</option>`
                      })
                      .join('')}
                  </select>
                  <div data-dispatch-task-constraint="selected-factory">
                    ${renderCapacityConstraintSummary(
                      selectedTaskConstraint,
                      isBatch
                        ? '批量派单当前不逐任务做产能日历校验。'
                        : '选择工厂后，将按当前任务日期窗口校验产能日历状态。',
                    )}
                  </div>
                  <div data-dispatch-task-sam-judgement="selected-factory">
                    ${renderStandardTimeJudgementSummary(
                      selectedTaskSamJudgement,
                      isBatch
                        ? '批量派单当前不逐任务做未来窗口标准工时判断。'
                        : '选择工厂后，将显示未来窗口内的可用标准工时、冻结、占用与预计消耗天数。',
                    )}
                  </div>
                </div>`
          }

          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-1.5">
              <label class="text-sm font-medium">接单截止时间 <span class="text-red-500">*</span></label>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="datetime-local" data-dispatch-field="dispatch.acceptDeadline" value="${escapeHtml(state.dispatchForm.acceptDeadline)}" />
            </div>
            <div class="space-y-1.5">
              <label class="text-sm font-medium">任务截止时间 <span class="text-red-500">*</span></label>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="datetime-local" data-dispatch-field="dispatch.taskDeadline" value="${escapeHtml(state.dispatchForm.taskDeadline)}" />
            </div>
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
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${canSubmit ? '' : 'pointer-events-none opacity-50'}" data-dispatch-action="confirm-direct-dispatch">确认派单</button>
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
  applyAutoAssign,
  confirmDirectDispatch,
  renderDirectDispatchDialog,
}
