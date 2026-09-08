import { getRuntimeTaskById, recordRuntimeTaskExecution, runRuntimeTaskAction } from '../data/fcs/runtime-process-tasks.ts'
import { getPdaSession, findFactoryPdaRoleById } from '../data/fcs/store-domain-pda.ts'
import { escapeHtml, localDateTimeText } from '../utils'
import {
  buildPdaCuttingRoute,
  getPdaCuttingTaskSnapshot,
  getPdaTaskFlowTaskById,
  isCuttingSpecialTask,
  type PdaCuttingRouteKey,
  type PdaCuttingTaskDetailData,
  type PdaCuttingTaskCutOrderGroup,
  type PdaCuttingTaskOrderLine,
} from '../data/fcs/pda-cutting-execution-source.ts'
import {
  readSelectedExecutionOrderIdFromLocation,
  readSelectedExecutionOrderNoFromLocation,
  resolveSelectedExecutionOrderLine,
} from './pda-cutting-context'
import {
  resolvePdaCuttingRuntimeIdentity,
  resolvePdaCuttingRuntimeOperator,
} from '../data/fcs/pda-cutting-runtime-action-inputs.ts'
import { CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, appendCuttingRuntimeEvent } from '../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import {
  renderPdaCuttingEmptyState,
  renderPdaCuttingStatusChip,
} from './pda-cutting-shared'
import { renderPdaFrame } from './pda-shell'

interface PdaCuttingTaskDetailOptions {
  backHref?: string
}

type ActionRouteKey = Exclude<PdaCuttingRouteKey, 'task' | 'unit'>

function buildPickupHref(taskId: string, backHref: string, line?: PdaCuttingTaskOrderLine): string {
  const params = new URLSearchParams()
  params.set('tab', 'pickup')
  params.set('focusTaskId', taskId)
  if (line?.executionOrderId) params.set('executionOrderId', line.executionOrderId)
  if (line?.executionOrderNo) params.set('executionOrderNo', line.executionOrderNo)
  if (backHref) params.set('returnTo', backHref)
  return `/fcs/pda/handover?${params.toString()}`
}

function buildActionHref(taskId: string, line: PdaCuttingTaskOrderLine, backHref: string): string {
  if (line.currentStepCode === 'START') return backHref || '/fcs/pda/exec?tab=NOT_STARTED'
  if (line.currentStepCode === 'PICKUP') return buildPickupHref(taskId, backHref, line)

  const routeKey = line.primaryExecutionRouteKey as ActionRouteKey
  return buildPdaCuttingRoute(taskId, routeKey, {
    executionOrderId: line.executionOrderId,
    executionOrderNo: line.executionOrderNo,
    cutOrderId: line.cutOrderId,
    cutOrderNo: line.cutOrderNo,
    markerPlanId: line.markerPlanId,
    markerPlanNo: line.markerPlanNo,
    materialSku: line.materialSku,
    returnTo: backHref,
  })
}

function renderMiniField(label: string, value: string): string {
  return `
    <div class="rounded-xl bg-muted/30 px-2.5 py-2">
      <div class="text-[11px] text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 break-words text-sm font-medium text-foreground">${escapeHtml(value || '-')}</div>
    </div>
  `
}

function renderMetric(label: string, value: string, tone: 'default' | 'green' | 'amber' | 'red' = 'default'): string {
  const valueClass =
    tone === 'green'
      ? 'text-emerald-700'
      : tone === 'amber'
        ? 'text-amber-700'
        : tone === 'red'
          ? 'text-red-700'
          : 'text-foreground'
  return `
    <article class="rounded-xl border bg-card px-3 py-2 shadow-sm">
      <div class="text-[11px] text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-base font-semibold ${valueClass}">${escapeHtml(value)}</div>
    </article>
  `
}

function renderActionButton(taskId: string, line: PdaCuttingTaskOrderLine, backHref: string, extraClass = ''): string {
  const actionHref = buildActionHref(taskId, line, backHref)
  const isStartAction = line.nextActionLabel === '开工'
  const className = `inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground ${extraClass}`.trim()
  return isStartAction
    ? `<button class="${className}" data-pda-cutting-task-action="start-work" data-task-id="${escapeHtml(taskId)}" data-execution-order-id="${escapeHtml(line.executionOrderId)}" data-execution-order-no="${escapeHtml(line.executionOrderNo)}">开工</button>`
    : `<button class="${className}" data-nav="${escapeHtml(actionHref)}">${escapeHtml(line.nextActionLabel)}</button>`
}

function joinDisplayText(parts: Array<string | undefined | null>): string {
  return parts.map((part) => String(part || '').trim()).filter(Boolean).join(' / ')
}

function renderOrderLine(taskId: string, line: PdaCuttingTaskOrderLine, backHref: string, selected: boolean): string {
  const tone = line.isDone ? 'green' : line.hasException ? 'red' : line.currentStepCode === 'PICKUP' ? 'amber' : 'blue'
  return `
    <article class="rounded-2xl border bg-card p-3 shadow-sm ${selected ? 'border-blue-300 ring-2 ring-blue-100' : ''}" data-pda-cutting-order-line="${escapeHtml(line.executionOrderId)}">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="text-[11px] text-muted-foreground">铺布单</div>
          <div class="mt-0.5 break-words text-base font-semibold text-foreground">${escapeHtml(line.executionOrderNo)}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(joinDisplayText([line.materialAlias || line.materialSku, line.colorLabel]) || '面料待确认')}</div>
        </div>
        ${renderPdaCuttingStatusChip(line.currentStepLabel, tone)}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
        ${renderMiniField('计划数量', `${line.plannedQty.toLocaleString('zh-CN')} 件`)}
        ${renderMiniField('当前状态', line.currentStateLabel)}
      </div>
      ${renderActionButton(taskId, line, backHref, 'mt-3')}
      <div class="mt-2 hidden rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800" data-pda-cutting-task-feedback></div>
    </article>
  `
}

function renderCutOrderGroup(
  taskId: string,
  group: PdaCuttingTaskCutOrderGroup,
  backHref: string,
  selectedLine: PdaCuttingTaskOrderLine | null,
  showGroupCount: boolean,
): string {
  const tone = group.exceptionSpreadingOrderCount ? 'red' : group.pendingSpreadingOrderCount ? 'blue' : 'green'
  const materialText = joinDisplayText([group.materialAlias || group.materialSku, group.colorLabel, group.materialTypeLabel])
  return `
    <section class="space-y-2 rounded-2xl border bg-card p-3 shadow-sm ${group.isSelected ? 'border-blue-300 ring-2 ring-blue-100' : ''}">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-[11px] text-muted-foreground">${showGroupCount ? '裁片单' : '当前裁片单'}</div>
          <h2 class="mt-0.5 break-words text-base font-semibold text-foreground">${escapeHtml(group.cutOrderNo || '待绑定裁片单')}</h2>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(materialText || '面料待确认')}</div>
        </div>
        ${renderPdaCuttingStatusChip(group.currentStateLabel, tone)}
      </div>
      <div class="grid grid-cols-3 gap-2 text-xs">
        ${renderMiniField('铺布单', `${group.spreadingOrderCount} 张`)}
        ${renderMiniField('未完成', `${group.pendingSpreadingOrderCount} 张`)}
        ${renderMiniField('下一步', group.nextActionLabel)}
      </div>
      <div class="space-y-2">
        ${group.spreadingOrders.map((line) => renderOrderLine(taskId, line, backHref, selectedLine?.executionOrderId === line.executionOrderId)).join('')}
      </div>
    </section>
  `
}

function renderRecentActions(detail: PdaCuttingTaskDetailData): string {
  if (!detail.recentActions.length) return renderPdaCuttingEmptyState('暂无操作记录', '')
  return `
    <section class="rounded-2xl border bg-card p-3 shadow-sm">
      <h2 class="text-sm font-semibold text-foreground">最近操作</h2>
      <div class="mt-3 space-y-2">
        ${detail.recentActions.slice(0, 4).map((action) => `
          <div class="rounded-xl border bg-muted/20 px-2.5 py-2 text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-foreground">${escapeHtml(action.actionTypeLabel)}</span>
              <span class="text-muted-foreground">${escapeHtml(action.operatedAt)}</span>
            </div>
            <div class="mt-1 text-muted-foreground">${escapeHtml(action.operatedBy)} / ${escapeHtml(action.summary)}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `
}

export function renderPdaCuttingTaskDetailPage(taskId: string, options: PdaCuttingTaskDetailOptions = {}): string {
  const decodedTaskId = decodeURIComponent(taskId)
  const selectedExecutionKey = readSelectedExecutionOrderIdFromLocation() || readSelectedExecutionOrderNoFromLocation() || undefined
  const detail = getPdaCuttingTaskSnapshot(decodedTaskId, selectedExecutionKey)
  const backHref = options.backHref || '/fcs/pda/exec'

  if (!detail) {
    const task = getPdaTaskFlowTaskById(decodedTaskId)
    if (task && isCuttingSpecialTask(task)) return renderPdaFrame(
      `<section class="space-y-3 px-3 py-4">
        <button class="rounded-lg border px-3 py-2" data-nav="${escapeHtml(backHref)}">返回</button>
        <h1 class="text-lg font-semibold">裁片任务 ${escapeHtml(task.taskNo || task.taskId)}</h1>
        ${renderMiniField('生产单', task.productionOrderNo || task.productionOrderId || '-')}
        ${renderMiniField('裁片单', (task.cutOrderNos || []).join(' / '))}
        ${renderPdaCuttingEmptyState('待生成唛架/铺布单', '')}
        <p class="text-sm text-muted-foreground">请联系主管生成唛架并安排铺布。尚无铺布单，不能开工或放行；已领取来料可在配料领取记录中查看。</p>
      </section>`, 'exec', { disableTodoAutoOpen: true })
    return renderPdaFrame(
      `<section class="space-y-3 px-3 py-4">
        <button class="inline-flex items-center rounded-lg border px-2.5 py-1.5 text-sm" data-nav="${escapeHtml(backHref)}">返回</button>
        ${renderPdaCuttingEmptyState('未找到裁片任务', '')}
      </section>`,
      'exec',
      { disableTodoAutoOpen: true },
    )
  }

  const runtimeTask = getRuntimeTaskById(decodedTaskId)
  let completionBlock = runtimeTask ? getCuttingTaskManualCompletionBlock(runtimeTask, detail) : ''
  if (runtimeTask) {
    try { requireCuttingTaskActor(decodedTaskId, 'TASK_FINISH', runtimeTask) }
    catch (error) { completionBlock = error instanceof Error ? error.message : '当前账号不能完成该任务。' }
  }

  const selectedLine = resolveSelectedExecutionOrderLine(
    detail,
    readSelectedExecutionOrderIdFromLocation(),
    readSelectedExecutionOrderNoFromLocation(),
  ) || detail.cutPieceOrders.find((line) => line.executionOrderId === detail.currentSelectedExecutionOrderId) || detail.cutPieceOrders[0] || null

  return renderPdaFrame(
    `
      <section class="space-y-3 px-3 py-3">
        <header class="space-y-2">
          <button class="inline-flex items-center rounded-lg border px-2.5 py-1.5 text-sm" data-nav="${escapeHtml(backHref)}">返回</button>
          <section class="rounded-2xl border bg-card p-3 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-xs text-muted-foreground">裁片任务</div>
                <h1 class="mt-1 break-words text-lg font-semibold text-foreground">${escapeHtml(detail.taskNo)}</h1>
                <div class="mt-1 text-xs text-muted-foreground">生产单 ${escapeHtml(detail.productionOrderNo)} / 当前 ${escapeHtml(detail.currentStage)}</div>
              </div>
              <span data-cutting-task-state>${renderPdaCuttingStatusChip(detail.taskStatusLabel, detail.taskStatusLabel === '已完成' ? 'green' : detail.taskStatusLabel === '有异常' ? 'red' : 'blue')}</span>
            </div>
          </section>
        </header>

        <section class="grid grid-cols-2 gap-2">
          ${renderMetric('裁片单', `${detail.cutOrderGroups.length} 张`)}
          ${renderMetric('铺布单', `${detail.cutPieceOrderCount} 张`)}
          ${renderMetric('未完成', `${detail.pendingCutPieceOrderCount} 张`, detail.pendingCutPieceOrderCount ? 'amber' : 'green')}
          ${renderMetric('异常', `${detail.exceptionCutPieceOrderCount} 张`, detail.exceptionCutPieceOrderCount ? 'red' : 'default')}
        </section>

        <section class="space-y-2">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-foreground">裁片单与铺布单</h2>
            <span class="text-xs text-muted-foreground">${escapeHtml(detail.cutOrderGroups.length > 1 ? '按裁片单分组，避免选错' : '直接进入铺布操作')}</span>
          </div>
          ${detail.cutOrderGroups.map((group) => renderCutOrderGroup(decodedTaskId, group, backHref, selectedLine, detail.cutOrderGroups.length > 1)).join('')}
        </section>

        ${runtimeTask ? `<section class="rounded-xl border p-3" data-skip-page-rerender="true"><button class="min-h-10 w-full rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" data-pda-cutting-task-action="complete-task" data-task-id="${escapeHtml(decodedTaskId)}" ${completionBlock ? 'disabled' : ''}>人工完成整体任务</button><p class="mt-2 text-xs" data-pda-cutting-complete-feedback>${escapeHtml(completionBlock || '请确认本任务所有床次已完成；尚未发生的交接仍需原交接动作。')}</p></section>` : ''}
        ${renderRecentActions(detail)}
      </section>
    `,
    'exec',
    { disableTodoAutoOpen: true },
  )
}

function requireCuttingTaskActor(taskId: string, permission: 'TASK_START' | 'TASK_FINISH', runtimeTask = getRuntimeTaskById(taskId)) {
  const projected = getPdaTaskFlowTaskById(taskId)
  const task = runtimeTask || projected
  const session = getPdaSession()
  const role = session ? findFactoryPdaRoleById(session.roleId, session.factoryId) : undefined
  if (!task || !projected || !isCuttingSpecialTask(projected) || !session || !session.userName.trim() || !role || role.status !== 'ACTIVE' || !role.permissionKeys.includes(permission) || session.factoryId !== task.assignedFactoryId || task.assignmentStatus !== 'ASSIGNED' || task.acceptanceStatus !== 'ACCEPTED') throw new Error('请由已接单工厂的具名执行人员打开原裁片任务。')
  if (permission === 'TASK_FINISH' && !runtimeTask) throw new Error('当前任务请使用原专属完成入口。')
  return { task, session, runtimeTask }
}

export function getCuttingTaskManualCompletionBlock(task: { status: string }, detail: PdaCuttingTaskDetailData | null): string {
  if (task.status !== 'IN_PROGRESS') return task.status === 'DONE' ? '该加工任务已人工完成。' : '请先完成加工任务开工，再确认整体完成。'
  if (!detail || !detail.cutPieceOrders.length) return '尚无本任务铺布单，不能完成。'
  if (detail.cutPieceOrders.some(line => !line.isDone)) return '本任务还有未完成裁剪的铺布单，请逐床完成后再确认。'
  if (detail.exceptionCutPieceOrderCount) return '本任务仍有未处理异常，请联系主管。'
  return ''
}

export function completePdaCuttingTaskManually(taskId: string): void {
  const { task, session } = requireCuttingTaskActor(taskId, 'TASK_FINISH')
  const detail = getPdaCuttingTaskSnapshot(taskId)
  const block = getCuttingTaskManualCompletionBlock(task, detail)
  if (block) throw new Error(block)
  if (detail!.productionOrderId !== task.productionOrderId) throw new Error('裁片任务来源已变化，请重新打开原单。')
  const at = localDateTimeText()
  recordRuntimeTaskExecution(taskId, { status: 'DONE', finishedAt: at, updatedAt: at, auditLogs: [...task.auditLogs, { id: `${taskId}-manual-finish-${at}`, action: 'FINISH', detail: `人工确认整体裁片任务完成；覆盖 ${detail!.cutPieceOrders.length} 张铺布单，不更改原裁剪及交接数量。`, at, by: session.userName }] })
}

export function handlePdaCuttingTaskDetailEvent(target: HTMLElement): boolean {
  const button = target.closest<HTMLElement>('[data-pda-cutting-task-action]')
  if (!button) return false
  const taskId = button.dataset.taskId || ''
  if (button.dataset.pdaCuttingTaskAction === 'complete-task') {
    const feedback = button.parentElement?.querySelector<HTMLElement>('[data-pda-cutting-complete-feedback]')
    try {
      const { session } = requireCuttingTaskActor(taskId, 'TASK_FINISH')
      if (!window.confirm(`确认由 ${session.userName} 人工完成整个裁片加工任务？该动作不会替代尚未发生的交接。`)) return true
      if (getPdaSession()?.userId !== session.userId) throw new Error('操作账号已变化，请重新确认。')
      completePdaCuttingTaskManually(taskId)
      button.textContent = '整体任务已人工完成'
      button.setAttribute('disabled', 'true')
      if (feedback) feedback.textContent = `已保存：${session.userName}，${getRuntimeTaskById(taskId)?.finishedAt || ''}`
      const state = document.querySelector<HTMLElement>('[data-cutting-task-state]')
      if (state) state.innerHTML = renderPdaCuttingStatusChip('已完成', 'green')
    } catch (error) { if (feedback) feedback.textContent = error instanceof Error ? error.message : '保存失败，请重试' }
    return true
  }
  if (button.dataset.pdaCuttingTaskAction !== 'start-work') return false

  const executionOrderId = button.dataset.executionOrderId || ''
  const executionOrderNo = button.dataset.executionOrderNo || ''
  const identity = resolvePdaCuttingRuntimeIdentity(taskId, {
    executionOrderId,
    executionOrderNo,
  })
  const feedback = button.closest<HTMLElement>('[data-pda-cutting-order-line]')?.querySelector<HTMLElement>('[data-pda-cutting-task-feedback]')
  if (!identity) {
    if (feedback) {
      feedback.classList.remove('hidden', 'border-emerald-200', 'bg-emerald-50', 'text-emerald-800')
      feedback.classList.add('border-amber-200', 'bg-amber-50', 'text-amber-800')
      feedback.textContent = '同步失败：当前铺布单无法识别。'
    }
    return true
  }
  let actor: ReturnType<typeof requireCuttingTaskActor>
  try { actor = requireCuttingTaskActor(taskId, 'TASK_START') } catch (error) { if (feedback) { feedback.classList.remove('hidden'); feedback.textContent = error instanceof Error ? error.message : '当前账号不能开工' }; return true }
  if (identity.productionOrderId !== actor.task.productionOrderId) { if (feedback) { feedback.classList.remove('hidden'); feedback.textContent = '原生产单不一致，不能开工。' }; return true }
  const currentLine = getPdaCuttingTaskSnapshot(taskId, executionOrderId)?.cutPieceOrders.find(line => line.executionOrderId === executionOrderId)
  if (!currentLine || currentLine.nextActionLabel !== '开工') { if (feedback) { feedback.classList.remove('hidden'); feedback.textContent = '该床当前不能重复开工，请刷新原任务。' }; return true }
  const operator = resolvePdaCuttingRuntimeOperator(taskId)
  let ledgerBefore: string | null
  try { ledgerBefore = localStorage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) } catch { if (feedback) { feedback.classList.remove('hidden'); feedback.textContent = '无法读取原开工记录，请检查本机存储后重试。' }; return true }
  try {
  const event = runRuntimeTaskAction(() => {
  const startedAt = localDateTimeText().slice(0, 16)
  const event = appendCuttingRuntimeEvent({
    eventType: '裁片单开工',
    eventSource: 'PDA',
    eventStatus: '已同步',
    occurredAt: startedAt,
    operatorId: operator.operatorAccountId,
    operatorName: operator.operatorName,
    operatorRole: operator.operatorRole || '裁床组长',
    refs: {
      productionOrderId: identity.productionOrderId,
      productionOrderNo: identity.productionOrderNo,
      cutOrderId: identity.cutOrderId,
      cutOrderNo: identity.cutOrderNo,
      markerPlanId: identity.markerPlanId,
      markerPlanNo: identity.markerPlanNo,
      spreadingOrderId: identity.executionOrderId,
      spreadingOrderNo: identity.executionOrderNo,
    },
    payload: {
      cutOrderId: identity.cutOrderId,
      cutOrderNo: identity.cutOrderNo,
      startedAt,
      startedBy: operator.operatorName,
      startSource: 'PDA',
    },
  })
  if (actor.runtimeTask && actor.task.status === 'NOT_STARTED') recordRuntimeTaskExecution(taskId, { status: 'IN_PROGRESS', startedAt, updatedAt: startedAt, auditLogs: [...actor.task.auditLogs, { id: `${taskId}-start-${event.eventId}`, action: 'START', detail: `原铺布单 ${identity.executionOrderNo} 开工；事件 ${event.eventId}`, at: startedAt, by: operator.operatorName }] })
  else if (actor.runtimeTask && actor.task.status !== 'IN_PROGRESS') throw new Error('当前整体任务不允许新开工。')
  return event
  })
  if (feedback) {
    feedback.classList.remove('hidden')
    feedback.textContent = `已同步：开工已提交，${event.occurredAt}`
  }
  button.textContent = '已开工'
  button.setAttribute('disabled', 'true')
  button.classList.add('opacity-70')
  const state = document.querySelector<HTMLElement>('[data-cutting-task-state]')
  if (state) state.innerHTML = renderPdaCuttingStatusChip('进行中', 'blue')
  } catch (error) {
    try { if (ledgerBefore === null) localStorage.removeItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY); else localStorage.setItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, ledgerBefore) }
    catch { if (feedback) { feedback.classList.remove('hidden'); feedback.textContent = '开工未保存，原记录回退未核实，请保留页面并联系主管。' }; return true }
    if (feedback) { feedback.classList.remove('hidden'); feedback.textContent = error instanceof Error ? error.message : '开工未保存，请重试' }
  }
  return true
}
