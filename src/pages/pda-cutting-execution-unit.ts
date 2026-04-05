import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import type { PdaCuttingTaskOrderLine } from '../data/fcs/pda-cutting-execution-source.ts'
import { buildPdaCuttingExecutionUnitContext } from './pda-cutting-context'
import { buildPdaCuttingExecutionNavHref } from './pda-cutting-nav-context'
import {
  resolvePdaCuttingTaskOrderCurrentStepCode,
  resolvePdaCuttingTaskOrderCurrentStepLabel,
  type PdaCuttingExecutionRouteKey,
} from './pda-cutting-task-detail-helpers'
import {
  renderPdaCuttingEmptyState,
  renderPdaCuttingOrderSelectionPrompt,
  renderPdaCuttingPageLayout,
  renderPdaCuttingStatusChip,
} from './pda-cutting-shared'

type ExecutionUnitStepCode = 'PICKUP' | 'SPREADING' | 'REPLENISHMENT' | 'HANDOVER' | 'INBOUND'

interface ExecutionUnitStepDefinition {
  code: ExecutionUnitStepCode
  label: string
  routeKey: PdaCuttingExecutionRouteKey
}

const executionUnitSteps: ExecutionUnitStepDefinition[] = [
  { code: 'PICKUP', label: '领料', routeKey: 'pickup' },
  { code: 'SPREADING', label: '铺布', routeKey: 'spreading' },
  { code: 'REPLENISHMENT', label: '补料反馈', routeKey: 'replenishment-feedback' },
  { code: 'HANDOVER', label: '交接', routeKey: 'handover' },
  { code: 'INBOUND', label: '入仓', routeKey: 'inbound' },
]

function includesAny(value: string | undefined, keywords: string[]): boolean {
  if (!value) return false
  return keywords.some((keyword) => value.includes(keyword))
}

function hasPendingReplenishment(line: PdaCuttingTaskOrderLine): boolean {
  return !includesAny(line.replenishmentRiskLabel, ['当前无', '暂无', '无需', '已关闭'])
}

function isStepDone(line: PdaCuttingTaskOrderLine, stepCode: ExecutionUnitStepCode): boolean {
  if (stepCode === 'PICKUP') return includesAny(line.currentReceiveStatus, ['领取成功', '已回执', '已领取'])
  if (stepCode === 'SPREADING') return includesAny(line.currentExecutionStatus, ['铺布已完成'])
  if (stepCode === 'REPLENISHMENT') return includesAny(line.currentExecutionStatus, ['铺布已完成']) && !hasPendingReplenishment(line)
  if (stepCode === 'HANDOVER') return includesAny(line.currentHandoverStatus, ['已交接'])
  return includesAny(line.currentInboundStatus, ['已入仓'])
}

function resolveStepStatus(line: PdaCuttingTaskOrderLine, stepCode: ExecutionUnitStepCode): 'current' | 'done' | 'waiting' {
  if (resolvePdaCuttingTaskOrderCurrentStepCode(line) === stepCode) return 'current'
  if (isStepDone(line, stepCode)) return 'done'
  return 'waiting'
}

function resolveStepStatusLabel(status: 'current' | 'done' | 'waiting'): string {
  if (status === 'current') return '当前步骤'
  if (status === 'done') return '已完成'
  return '待执行'
}

function resolveStepCardClass(status: 'current' | 'done' | 'waiting'): string {
  if (status === 'current') return 'border-blue-300 bg-blue-50 ring-1 ring-blue-100'
  if (status === 'done') return 'border-emerald-200 bg-emerald-50'
  return 'border-slate-200 bg-slate-50'
}

function resolveStepChip(status: 'current' | 'done' | 'waiting'): string {
  if (status === 'current') return renderPdaCuttingStatusChip('当前步骤', 'blue')
  if (status === 'done') return renderPdaCuttingStatusChip('已完成', 'green')
  return renderPdaCuttingStatusChip('待执行', 'amber')
}

function getLatestRollSummary(detail: NonNullable<ReturnType<typeof buildPdaCuttingExecutionUnitContext>['detail']>): { rollNo: string; recordedAt: string } {
  const latest = [...detail.spreadingRecords].sort((a, b) => b.enteredAt.localeCompare(a.enteredAt))[0]
  return {
    rollNo: latest?.fabricRollNo || '暂无卷记录',
    recordedAt: latest?.enteredAt || '-',
  }
}

function getLatestHandoverSummary(detail: NonNullable<ReturnType<typeof buildPdaCuttingExecutionUnitContext>['detail']>): string {
  const latest = [...detail.handoverRecords].sort((a, b) => b.handoverAt.localeCompare(a.handoverAt))[0]
  if (!latest) return '暂无换班记录'
  return `${latest.operatorName} / ${latest.handoverAt}`
}

function renderObjectBar(line: PdaCuttingTaskOrderLine, detail: NonNullable<ReturnType<typeof buildPdaCuttingExecutionUnitContext>['detail']>): string {
  const sourceMarker = detail.spreadingTargets[0]?.markerNo || detail.markerSummary || '待绑定参考唛架'
  const currentSpreadingObject = detail.spreadingTargets[0]?.title || detail.latestSpreadingRecordNo || '待选择铺布对象'

  return `
    <section class="rounded-xl border bg-card px-2 py-2" data-pda-cutting-execution-unit-card="object">
      <div class="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-6">
        <div><div class="text-muted-foreground">当前任务号</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(line.executionOrderNo)}</div></div>
        <div><div class="text-muted-foreground">裁片单</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(line.originalCutOrderNo || '—')}</div></div>
        <div><div class="text-muted-foreground">合并裁剪批次</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(line.mergeBatchNo || '—')}</div></div>
        <div><div class="text-muted-foreground">当前铺布</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(currentSpreadingObject)}</div></div>
        <div><div class="text-muted-foreground">参考唛架</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(sourceMarker)}</div></div>
        <div><div class="text-muted-foreground">当前状态</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(line.currentStateLabel)}</div></div>
      </div>
    </section>
  `
}

function renderCurrentStepBar(line: PdaCuttingTaskOrderLine): string {
  return `
    <section class="rounded-xl border bg-card px-2 py-2">
      <div class="flex items-center justify-between gap-2">
        <div>
          <div class="text-xs text-muted-foreground">当前步骤</div>
          <div class="mt-0.5 text-sm font-semibold text-foreground" data-pda-cutting-unit-current-step>${escapeHtml(resolvePdaCuttingTaskOrderCurrentStepLabel(line))}</div>
        </div>
        ${renderPdaCuttingStatusChip(resolvePdaCuttingTaskOrderCurrentStepLabel(line), 'blue')}
      </div>
    </section>
  `
}

function renderStepList(taskId: string, line: PdaCuttingTaskOrderLine): string {
  const returnTo = appStore.getState().pathname
  return `
    <section class="rounded-xl border bg-card px-2 py-1.5">
      <div class="space-y-1">
        ${executionUnitSteps
          .map((step) => {
            const status = resolveStepStatus(line, step.code)
            const href = buildPdaCuttingExecutionNavHref(taskId, step.routeKey, {
              executionOrderId: line.executionOrderId,
              executionOrderNo: line.executionOrderNo,
              originalCutOrderId: line.originalCutOrderId,
              originalCutOrderNo: line.originalCutOrderNo,
              mergeBatchId: line.mergeBatchId,
              mergeBatchNo: line.mergeBatchNo,
              materialSku: line.materialSku,
              returnTo,
              sourcePageKey: 'execution-unit',
              focusTaskId: taskId,
              focusExecutionOrderId: line.executionOrderId,
              focusExecutionOrderNo: line.executionOrderNo,
              highlightCutPieceOrder: true,
              autoFocus: true,
            })

            return `
              <button
                class="flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-left ${resolveStepCardClass(status)}"
                data-nav="${escapeHtml(href)}"
                data-pda-cutting-unit-step="${escapeHtml(step.code)}"
                data-step-status="${escapeHtml(status)}"
              >
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-foreground">${escapeHtml(step.label)}</div>
                  <div class="mt-0.5 text-[11px] text-muted-foreground">${escapeHtml(resolveStepStatusLabel(status))}</div>
                </div>
                ${resolveStepChip(status)}
              </button>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderRecentRecord(detail: NonNullable<ReturnType<typeof buildPdaCuttingExecutionUnitContext>['detail']>): string {
  const latestRoll = getLatestRollSummary(detail)
  return `
    <section class="rounded-xl border bg-card px-2 py-2">
      <div class="grid gap-2 text-xs sm:grid-cols-2">
        <div><div class="text-muted-foreground">最近卷号</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(latestRoll.rollNo)}</div></div>
        <div><div class="text-muted-foreground">最近记录时间</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(latestRoll.recordedAt)}</div></div>
        <div><div class="text-muted-foreground">最近交接</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(getLatestHandoverSummary(detail))}</div></div>
        <div><div class="text-muted-foreground">补料情况</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(detail.replenishmentRiskSummary)}</div></div>
      </div>
    </section>
  `
}

export function renderPdaCuttingExecutionUnitPage(taskId: string, executionOrderId: string): string {
  const context = buildPdaCuttingExecutionUnitContext(taskId, executionOrderId)
  const detail = context.detail

  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '当前任务',
      subtitle: '',
      activeTab: 'exec',
      body: renderPdaCuttingEmptyState('未找到当前任务', ''),
      backHref: context.backHref,
    })
  }

  if (context.requiresCutPieceOrderSelection) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '当前任务',
      subtitle: '',
      activeTab: 'exec',
      body: renderPdaCuttingOrderSelectionPrompt(detail, context.backHref, context.selectionNotice || undefined),
      backHref: context.backHref,
    })
  }

  const selectedLine = context.selectedExecutionOrderLine
  if (!selectedLine) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '当前任务',
      subtitle: '',
      activeTab: 'exec',
      body: renderPdaCuttingEmptyState('当前任务不存在', ''),
      backHref: context.backHref,
    })
  }

  const body = `
    <div class="space-y-2" data-pda-cutting-execution-unit-root="${escapeHtml(taskId)}">
      ${renderObjectBar(selectedLine, detail)}
      ${renderCurrentStepBar(selectedLine)}
      ${renderStepList(taskId, selectedLine)}
      ${renderRecentRecord(detail)}
    </div>
  `

  return renderPdaCuttingPageLayout({
    taskId,
      title: '当前任务',
    subtitle: '',
    activeTab: 'exec',
    body,
    backHref: context.backHref,
  })
}
