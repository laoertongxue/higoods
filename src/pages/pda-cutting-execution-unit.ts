import { escapeHtml } from '../utils'
import {
  getCuttingMainlineSession,
  listCuttingMainlineSessions,
  type CuttingMainlineSessionView,
} from '../data/fcs/cutting/cutting-mainline.ts'
import { renderPdaFrame } from './pda-shell'

type Tone = 'blue' | 'green' | 'amber' | 'red' | 'slate'

function chip(label: string, tone: Tone = 'slate'): string {
  const className =
    tone === 'blue'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : tone === 'green'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : tone === 'amber'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : tone === 'red'
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-slate-200 bg-slate-50 text-slate-700'
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}">${escapeHtml(label)}</span>`
}

function toneForSession(session: CuttingMainlineSessionView): Tone {
  if (session.statusTab === 'DONE') return 'green'
  if (session.statusTab === 'IN_PROGRESS') return 'blue'
  if (session.statusTab === 'BLOCKED') return 'red'
  return 'amber'
}

function field(label: string, value: string, hint = ''): string {
  return `
    <article class="rounded-xl border bg-card px-2.5 py-2 shadow-sm">
      <div class="text-[11px] text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(value)}</div>
      ${hint ? `<div class="mt-0.5 text-[11px] text-muted-foreground">${escapeHtml(hint)}</div>` : ''}
    </article>
  `
}

function renderStep(label: string, status: string, action: string, enabled = true): string {
  return `
    <div class="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
      <div>
        <div class="text-sm font-medium text-foreground">${escapeHtml(label)}</div>
        <div class="text-[11px] text-muted-foreground">${escapeHtml(status)}</div>
      </div>
      <button class="rounded-lg ${enabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} px-2.5 py-1.5 text-xs font-semibold" ${enabled ? '' : 'disabled'} data-skip-page-rerender="true" data-pda-cutting-unit-action="${escapeHtml(action)}">
        ${escapeHtml(action)}
      </button>
    </div>
  `
}

function getActualTimeText(session: CuttingMainlineSessionView): string {
  if (session.actualStartAt && session.actualEndAt) return `${session.actualStartAt} 至 ${session.actualEndAt}`
  if (session.actualStartAt) return `${session.actualStartAt} 起`
  return '未开始'
}

function getSession(taskId: string, sessionId: string): CuttingMainlineSessionView | null {
  return getCuttingMainlineSession(taskId, sessionId)
    || listCuttingMainlineSessions(taskId).find((item) => item.sessionNo === sessionId || item.spreadingSessionId === sessionId)
    || null
}

export function renderPdaCuttingExecutionUnitPage(taskId: string, executionOrderId: string): string {
  const session = getSession(taskId, executionOrderId)
  if (!session) {
    return renderPdaFrame(
      `<section class="space-y-3 px-3 py-3"><button class="rounded-lg border px-2.5 py-1.5 text-sm" data-nav="/fcs/pda/exec">返回</button><div class="rounded-2xl border border-dashed px-3 py-8 text-center text-sm">未找到铺布现场任务</div></section>`,
      'exec',
      { disableTodoAutoOpen: true },
    )
  }

  const taskHref = `/fcs/pda/cutting/task/${encodeURIComponent(taskId)}`

  return renderPdaFrame(
    `
      <section class="space-y-3 px-3 py-3">
        <header class="space-y-2">
          <button class="inline-flex items-center rounded-lg border px-2.5 py-1.5 text-sm" data-nav="${escapeHtml(taskHref)}">返回任务</button>
          <section class="rounded-2xl border bg-card p-3 shadow-sm">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="text-xs text-muted-foreground">铺布任务</div>
                <h1 class="mt-1 text-lg font-semibold text-foreground">${escapeHtml(session.sessionNo)}</h1>
                <div class="mt-1 text-xs text-muted-foreground">排唛架方案 ${escapeHtml(session.markerPlanNo)} / 唛架编号 ${escapeHtml(session.markerBedNo)}</div>
              </div>
              ${chip(session.mainStageLabel, toneForSession(session))}
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              ${field('执行裁床', session.cuttingTableName || '待选择')}
              ${field('预计耗时', `${session.estimatedDurationMinutes} 分钟`)}
              ${field('铺布状态', session.mainStageLabel)}
              ${field('裁剪状态', session.cuttingStageLabel)}
              ${field('实际时间', getActualTimeText(session))}
              ${field('来源', session.sourceTypeLabel, session.sourceOrderLabel)}
              ${field('面料 / 颜色', session.materialSku, session.color)}
            </div>
          </section>
        </header>

        <section class="grid grid-cols-2 gap-2">
          ${field('WMS 来料接收', session.wmsReceiveStatus)}
          ${field('待加工仓', '铺布扣出')}
        </section>

        <section class="rounded-2xl border bg-card p-3 shadow-sm">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold text-foreground">执行上报配置</h2>
            ${chip(session.reportConfig.enabled ? '已启用' : '已关联', session.reportConfig.enabled ? 'green' : 'amber')}
          </div>
          <div class="mt-2 rounded-xl bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">
            ${escapeHtml(session.reportConfig.label)}
          </div>
        </section>

        <section class="space-y-2 rounded-2xl border bg-card p-3 shadow-sm">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-foreground">现场动作</h2>
          </div>
          ${renderStep('开始铺布', session.markerBedNo, '开始铺布', session.statusTab === 'NOT_STARTED')}
          ${renderStep('完成铺布', '铺布完成后进入待裁剪', '完成铺布', session.statusTab === 'IN_PROGRESS')}
          ${renderStep('开始裁剪', '铺布完成后可开始裁剪', '开始裁剪', session.cuttingStageLabel === '待裁剪')}
          ${renderStep('完成裁剪', '记录裁剪完成数量', '完成裁剪', session.cuttingStageLabel === '裁剪中')}
          ${renderStep('异常反馈', '补料 / 长度差异 / 裁床冲突', '反馈异常')}
          <div class="hidden rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" data-pda-cutting-action-feedback></div>
        </section>
      </section>
    `,
    'exec',
    { disableTodoAutoOpen: true },
  )
}

export function handlePdaCuttingExecutionUnitEvent(target: HTMLElement): boolean {
  const button = target.closest<HTMLElement>('[data-pda-cutting-unit-action]')
  if (!button) return false

  const action = button.dataset.pdaCuttingUnitAction || '现场动作'
  const feedback = document.querySelector<HTMLElement>('[data-pda-cutting-action-feedback]')
  if (feedback) {
    feedback.classList.remove('hidden')
    feedback.textContent = `${action}已记录。`
  }
  return true
}
