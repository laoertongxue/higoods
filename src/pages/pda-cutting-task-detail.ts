import { escapeHtml } from '../utils'
import { processTasks, type ProcessTask } from '../data/fcs/process-tasks.ts'
import {
  buildCuttingMainlineTaskView,
  buildPdaCuttingMainlineUnitPath,
  isCuttingProcessTask,
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

function getTask(taskId: string): ProcessTask | null {
  const matched = processTasks.find((task) => task.taskId === taskId || task.taskNo === taskId)
  if (matched && isCuttingProcessTask(matched)) return matched

  return {
    taskId,
    taskNo: taskId,
    productionOrderId: '',
    seq: 1,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty: 0,
    qtyUnit: 'PIECE',
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTypes: ['CUTTING_FACTORY'] },
    assignedFactoryId: 'F090',
    assignedFactoryName: '全能力测试工厂',
    qcPoints: [],
    attachments: [],
    status: 'NOT_STARTED',
  }
}

function toneForSession(session: CuttingMainlineSessionView): Tone {
  if (session.statusTab === 'DONE') return 'green'
  if (session.statusTab === 'IN_PROGRESS') return 'blue'
  if (session.statusTab === 'BLOCKED') return 'red'
  return 'amber'
}

function renderMetric(label: string, value: string, hint = ''): string {
  return `
    <article class="rounded-xl border bg-card px-3 py-2 shadow-sm">
      <div class="text-[11px] text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-base font-semibold text-foreground">${escapeHtml(value)}</div>
      ${hint ? `<div class="mt-0.5 text-[11px] text-muted-foreground">${escapeHtml(hint)}</div>` : ''}
    </article>
  `
}

function renderSessionCard(session: CuttingMainlineSessionView): string {
  const href = buildPdaCuttingMainlineUnitPath(session.taskId, session.spreadingSessionId, '/fcs/pda/exec')
  return `
    <article class="rounded-2xl border bg-card p-3 shadow-sm">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="text-[11px] text-muted-foreground">铺布任务</div>
          <div class="mt-0.5 text-base font-semibold text-foreground">${escapeHtml(session.sessionNo)}</div>
          <div class="mt-1 text-xs text-muted-foreground">排唛架方案 ${escapeHtml(session.markerPlanNo)} / 唛架床次 ${escapeHtml(session.markerBedNo)}</div>
        </div>
        ${chip(session.mainStageLabel, toneForSession(session))}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div class="rounded-xl bg-muted/30 px-2.5 py-2">
          <div class="text-muted-foreground">执行裁床</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(session.cuttingTableName)}</div>
        </div>
        <div class="rounded-xl bg-muted/30 px-2.5 py-2">
          <div class="text-muted-foreground">计划时间</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(session.plannedStartAt)}</div>
          <div class="text-muted-foreground">${escapeHtml(session.estimatedDurationMinutes)} 分钟</div>
        </div>
        <div class="rounded-xl bg-muted/30 px-2.5 py-2">
          <div class="text-muted-foreground">来源</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(session.sourceTypeLabel)}</div>
          <div class="truncate text-muted-foreground">${escapeHtml(session.sourceOrderLabel)}</div>
        </div>
        <div class="rounded-xl bg-muted/30 px-2.5 py-2">
          <div class="text-muted-foreground">面料 / 颜色</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(session.materialSku)}</div>
          <div class="text-muted-foreground">${escapeHtml(session.color)}</div>
        </div>
      </div>
      <div class="mt-3 space-y-1.5 text-xs">
        <div class="flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2">
          <span class="text-muted-foreground">WMS 来料</span>
          <span class="font-medium text-foreground">${escapeHtml(session.wmsReceiveStatus)}</span>
        </div>
        <div class="flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2">
          <span class="text-muted-foreground">菲票</span>
          <span class="font-medium text-foreground">${escapeHtml(session.feiTicketStatus)}</span>
        </div>
        <div class="flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2">
          <span class="text-muted-foreground">执行上报配置</span>
          <span class="text-right font-medium text-foreground">${escapeHtml(session.reportConfig.label)}</span>
        </div>
      </div>
      <button class="mt-3 w-full rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" data-nav="${escapeHtml(href)}">
        进入现场执行
      </button>
    </article>
  `
}

export function renderPdaCuttingTaskDetailPage(taskId: string): string {
  const task = getTask(taskId)
  if (!task) {
    return renderPdaFrame(
      `<section class="px-3 py-4"><div class="rounded-2xl border border-dashed px-3 py-8 text-center text-sm">未找到裁片任务</div></section>`,
      'exec',
      { disableTodoAutoOpen: true },
    )
  }

  const view = buildCuttingMainlineTaskView(task)
  const notStarted = view.sessions.filter((item) => item.statusTab === 'NOT_STARTED').length
  const running = view.sessions.filter((item) => item.statusTab === 'IN_PROGRESS').length
  const blocked = view.sessions.filter((item) => item.statusTab === 'BLOCKED').length
  const done = view.sessions.filter((item) => item.statusTab === 'DONE').length

  return renderPdaFrame(
    `
      <section class="space-y-3 px-3 py-3">
        <header class="space-y-2">
          <button class="inline-flex items-center rounded-lg border px-2.5 py-1.5 text-sm" data-nav="/fcs/pda/exec">返回执行列表</button>
          <div class="rounded-2xl border bg-card p-3 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-xs text-muted-foreground">裁片现场主线</div>
                <h1 class="mt-1 text-lg font-semibold text-foreground">${escapeHtml(view.taskNo)}</h1>
                <div class="mt-1 text-xs text-muted-foreground">生产单 ${escapeHtml(view.productionOrderNo || '按铺布任务展开')}</div>
              </div>
              ${chip(view.factoryName ? `${view.factoryName}（${view.factoryId}）` : '全能力测试工厂（F090）', 'blue')}
            </div>
            <div class="mt-3 rounded-xl bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">
              ${escapeHtml(view.summaryLabel)} · ${escapeHtml(view.reportConfig.label)}
            </div>
          </div>
        </header>

        <section class="grid grid-cols-2 gap-2">
          ${renderMetric('待开始', String(notStarted), '等待到床')}
          ${renderMetric('铺布中', String(running), '现场执行')}
          ${renderMetric('异常', String(blocked), '补料或待处理')}
          ${renderMetric('已完成', String(done), '可查看记录')}
        </section>

        <section class="space-y-2">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-foreground">铺布任务</h2>
            <span class="text-xs text-muted-foreground">共 ${view.sessions.length} 个</span>
          </div>
          ${view.sessions.length ? view.sessions.map(renderSessionCard).join('') : '<div class="rounded-2xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">暂无铺布任务</div>'}
        </section>
      </section>
    `,
    'exec',
    { disableTodoAutoOpen: true },
  )
}

export function handlePdaCuttingTaskDetailEvent(_target: HTMLElement): boolean {
  return false
}
