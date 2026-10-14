// @page-pattern: dashboard

import {
  ensureSewingCutPieceResponsibilityOverviewDemos,
  type SewingCutPieceResponsibilityProjection,
} from '../../data/fcs/sewing-cut-piece-responsibility.ts'
import {
  listSewingOutsourcingWorkbenchPpicOptions,
  listSewingOutsourcingWorkbenchRows,
  SEWING_OUTSOURCING_NEXT_PARTY_LABEL,
  SEWING_OUTSOURCING_WORKBENCH_NOW,
  type SewingOutsourcingNextResponsibleParty,
  type SewingOutsourcingWorkbenchTaskRow,
} from '../../data/fcs/sewing-outsourcing-workbench.ts'
import { escapeHtml } from '../../utils.ts'
import { ensurePpicDailyReturnState, getPpicDailyReturnView, getPpicDailySupervisorView, getCurrentPpicDailyActor } from '../../data/fcs/ppic-daily-return-records.ts'

let dailyReady = false
let dailyReadError = ''
async function prepareDaily(): Promise<void> {
  try { await ensurePpicDailyReturnState(); dailyReady = true; dailyReadError = '' }
  catch (error) { dailyReady = false; dailyReadError = error instanceof Error ? error.message : '每日回货记录读取失败' }
}
function renderDailyTodo(): string {
  if (!dailyReady) return `<section class="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">${escapeHtml(dailyReadError || '正在读取每日回货记录')}<a class="ml-3 font-semibold underline" href="/fcs/sewing-outsourcing/daily-return-report" data-nav="/fcs/sewing-outsourcing/daily-return-report">打开每日填报并重试</a></section>`
  if (state.leaderView) {
    const view = getPpicDailySupervisorView()
    return `<section class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"><div><h2 class="font-semibold">每日回货提交</h2><p class="mt-2 text-sm">${view.stats.submitted}／${view.stats.members} 人已提交 · ${escapeHtml(view.date)} ${escapeHtml(view.config.cutoff)} 截止（${escapeHtml(view.config.timeZone)}）</p></div><a class="rounded bg-blue-600 px-4 py-3 text-sm font-semibold text-white" href="/fcs/sewing-outsourcing/daily-return-summary" data-nav="/fcs/sewing-outsourcing/daily-return-summary">查看每日回货汇总</a></section>`
  }
  const view = getPpicDailyReturnView(), overdue = view.tasks.flatMap(t => t.promises).filter(p => p.result.due && p.result.currentGap > 0), missingReasons = view.tasks.flatMap(t => t.promises).filter(p => p.result.missingReason)
  return `<section class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"><div><h2 class="font-semibold">今日回货填报 · ${escapeHtml(view.actor.name)}</h2><p class="mt-2 text-sm">${escapeHtml(view.submissionStatus)} · ${view.tasks.length} 个任务 · ${overdue.length} 笔到期欠回 · ${missingReasons.length} 笔待补原因 · ${escapeHtml(view.config.timeZone)} ${escapeHtml(view.config.cutoff)} 截止</p></div><a class="rounded bg-blue-600 px-4 py-3 text-sm font-semibold text-white" href="/fcs/sewing-outsourcing/daily-return-report" data-nav="/fcs/sewing-outsourcing/daily-return-report">填写今日回货</a></section>`
}

const state = {
  viewerPpicId: '',
  leaderView: false,
  selectedPpicId: '',
}

type SummaryCard = {
  key: string
  title: string
  description: string
  count: number
  href: string
  tone: 'RED' | 'AMBER' | 'BLUE' | 'VIOLET' | 'SLATE'
}

function baseRows(): SewingOutsourcingWorkbenchTaskRow[] {
  return listSewingOutsourcingWorkbenchRows({
    viewerPpicId: state.viewerPpicId,
    leaderView: state.leaderView,
    selectedPpicId: state.leaderView ? state.selectedPpicId : '',
  })
}

function cutPieceRows(): SewingCutPieceResponsibilityProjection[] {
  return ensureSewingCutPieceResponsibilityOverviewDemos().filter((projection) => {
    if (!state.leaderView) return projection.context.ppicId === state.viewerPpicId
    return !state.selectedPpicId || projection.context.ppicId === state.selectedPpicId
  })
}

function hasSource(row: SewingOutsourcingWorkbenchTaskRow, label: string): boolean {
  return row.sourceLinks.some((source) => source.label === label)
}

function hasConfirmedHandover(projection: SewingCutPieceResponsibilityProjection): boolean {
  return projection.totalHandedOverPieceQty > 0
}

function summaryCards(rows: SewingOutsourcingWorkbenchTaskRow[], cutPieces: SewingCutPieceResponsibilityProjection[]): SummaryCard[] {
  const pendingApproval = rows.filter((row) => hasSource(row, '批版建议') && !/按已反馈的批版建议/.test(row.nextAction)).length
  const returnTasks = rows.filter((row) => hasSource(row, '回货跟进'))
  const dueReturn = returnTasks.filter((row) => row.health !== 'NORMAL' || /今日|立即|2026-09-0[1-3]/.test(row.dueAt)).length
  return [
    {
      key: 'UNHANDED',
      title: '车缝任务还未交出',
      description: '裁床尚未形成确认交出记录，PPIC先跟进交出。',
      count: cutPieces.filter((item) => !hasConfirmedHandover(item)).length,
      href: '/fcs/sewing-outsourcing/cut-piece-handover?tab=UNHANDED',
      tone: 'AMBER',
    },
    {
      key: 'HANDED_WITH_DEBT',
      title: '已交出且仍欠片',
      description: '已确认交出，但至少一个裁片部位仍有欠片。',
      count: cutPieces.filter((item) => hasConfirmedHandover(item) && item.totalDebtPieceQty > 0).length,
      href: '/fcs/sewing-outsourcing/cut-piece-handover?tab=HANDED_WITH_DEBT',
      tone: 'RED',
    },
    {
      key: 'PENDING_APPROVAL',
      title: '产前版样衣待批版闭环',
      description: '待带回、待转交、待上传批版建议或待反馈工厂。',
      count: pendingApproval,
      href: '/fcs/sewing-outsourcing/sample-approval-suggestions?tab=PENDING',
      tone: 'VIOLET',
    },
    {
      key: 'DUE_RETURN',
      title: '回货节点临近或未达成',
      description: '按任务类型分别关注35%、100%节点。',
      count: dueReturn,
      href: '/fcs/sewing-outsourcing/returns?tab=DUE_FOLLOW_UP',
      tone: 'RED',
    },
    {
      key: 'UNFINISHED',
      title: '尚未完成的车缝任务',
      description: '进入车缝任务主清单查看执行任务明细。',
      count: rows.length,
      href: '/fcs/sewing-outsourcing/tasks?status=UNFINISHED',
      tone: 'BLUE',
    },
    {
      key: 'ABNORMAL',
      title: '异常或数据不完整',
      description: '需要PPIC或负责人立即核查责任和业务事实。',
      count: rows.filter((row) => row.health === 'ABNORMAL' || row.health === 'DATA_INCOMPLETE').length,
      href: '/fcs/sewing-outsourcing/tasks?health=ABNORMAL',
      tone: 'RED',
    },
  ]
}

function cardTone(tone: SummaryCard['tone']): string {
  if (tone === 'RED') return 'border-red-200 bg-red-50 text-red-800'
  if (tone === 'AMBER') return 'border-amber-200 bg-amber-50 text-amber-900'
  if (tone === 'VIOLET') return 'border-violet-200 bg-violet-50 text-violet-800'
  if (tone === 'BLUE') return 'border-blue-200 bg-blue-50 text-blue-800'
  return 'border-slate-200 bg-slate-50 text-slate-800'
}

function renderSummaryCards(cards: SummaryCard[]): string {
  return `<section aria-label="待跟进情况" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">${cards.map((card) => `<a class="group rounded-xl border p-5 transition hover:-translate-y-0.5 hover:shadow-sm ${cardTone(card.tone)}" href="${escapeHtml(card.href)}" data-workbench-summary="${escapeHtml(card.key)}"><div class="flex items-start justify-between gap-4"><div><h2 class="font-semibold">${escapeHtml(card.title)}</h2><p class="mt-2 text-sm opacity-80">${escapeHtml(card.description)}</p></div><strong class="text-3xl tabular-nums">${card.count}</strong></div><span class="mt-4 inline-flex text-sm font-semibold group-hover:underline">进入跟进 →</span></a>`).join('')}</section>`
}

function renderResponsibilitySummary(rows: SewingOutsourcingWorkbenchTaskRow[]): string {
  const parties = Object.keys(SEWING_OUTSOURCING_NEXT_PARTY_LABEL) as SewingOutsourcingNextResponsibleParty[]
  return `<section class="rounded-xl border bg-white p-5"><div class="flex flex-wrap items-end justify-between gap-2"><div><h2 class="font-semibold">下一步需要跟进谁</h2><p class="mt-1 text-sm text-slate-500">只做责任汇总；具体执行任务统一进入“车缝任务”查看。</p></div><a class="text-sm font-semibold text-blue-700 hover:underline" href="/fcs/sewing-outsourcing/tasks">打开车缝任务</a></div><div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">${parties.map((party) => `<article class="rounded-lg border bg-slate-50 p-3"><span class="text-xs text-slate-500">${escapeHtml(SEWING_OUTSOURCING_NEXT_PARTY_LABEL[party])}</span><b class="mt-2 block text-xl">${rows.filter((row) => row.nextResponsibleParty === party).length}</b></article>`).join('')}</div></section>`
}

function renderIdentityControls(rows: SewingOutsourcingWorkbenchTaskRow[]): string {
  const ppicOptions = listSewingOutsourcingWorkbenchPpicOptions()
  if (!state.leaderView) {
    const currentName = getCurrentPpicDailyActor().name
    return `<div class="flex flex-wrap items-center gap-3"><span class="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">当前登录：${escapeHtml(currentName)}（PPIC）</span><span class="text-sm text-slate-500">仅汇总本人当前负责的任务</span></div>`
  }
  const actor = getCurrentPpicDailyActor()
  return `<div class="flex flex-wrap items-center gap-3"><span class="rounded border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800">当前登录：${escapeHtml(actor.name)}（PPIC组长）</span><label class="text-sm">查看范围<select class="ml-2 h-9 rounded border px-3" data-ppic-workbench-field="selectedPpicId"><option value="">整个PPIC团队</option>${ppicOptions.map((option) => `<option value="${escapeHtml(option.ppicId)}"${state.selectedPpicId === option.ppicId ? ' selected' : ''}>${escapeHtml(option.ppicName)}（${option.taskCount}）</option>`).join('')}</select></label><span class="ml-auto text-xs text-slate-500">当前范围${rows.length}个未完执行任务</span></div>`
}

function renderWorkbenchPage(): string {
  const rows = baseRows()
  const cutPieces = cutPieceRows()
  const cards = summaryCards(rows, cutPieces)
  return `<div class="space-y-5" data-ppic-workbench-page data-skip-page-rerender="true">
    <header class="flex flex-wrap items-start justify-between gap-4"><div><p class="text-xs text-slate-500">车缝外发协同 / 工作台</p><h1 class="mt-1 text-2xl font-semibold">${state.leaderView ? '团队工作台' : '我的工作台'}</h1><p class="mt-2 text-sm text-slate-500">汇总当前登录人需要关注的业务情况，并提供对应专业页面入口；执行任务明细只在“车缝任务”展示。</p></div><span class="rounded bg-slate-100 px-3 py-2 text-xs text-slate-600">原型核查时点：${escapeHtml(SEWING_OUTSOURCING_WORKBENCH_NOW)}</span></header>
    <section class="rounded-xl border bg-white p-4">${renderIdentityControls(rows)}</section>
    <div data-workbench-daily>${renderDailyTodo()}</div>
    ${renderSummaryCards(cards)}
    ${renderResponsibilitySummary(rows)}
  </div>`
}

export async function renderSewingOutsourcingWorkbenchPage(): Promise<string> {
  state.viewerPpicId = getCurrentPpicDailyActor().id
  state.leaderView = false
  state.selectedPpicId = ''
  await prepareDaily()
  return renderWorkbenchPage()
}

export async function renderSewingOutsourcingTeamWorkbenchPage(): Promise<string> {
  const actor = getCurrentPpicDailyActor()
  if (!actor.leader) return `<main class="space-y-4 p-4" data-ppic-workbench-page><h1 class="text-xl font-semibold">团队工作台</h1><p class="rounded bg-amber-50 p-3 text-sm text-amber-800">当前登录：${escapeHtml(actor.name)}。团队工作台由PPIC组长查看。</p><a class="text-blue-700" href="/fcs/sewing-outsourcing/workbench" data-nav="/fcs/sewing-outsourcing/workbench">打开我的工作台</a></main>`
  state.leaderView = true
  state.viewerPpicId = actor.id
  state.selectedPpicId = ''
  await prepareDaily()
  return renderWorkbenchPage()
}

function refresh(): void {
  const root = document.querySelector<HTMLElement>('[data-ppic-workbench-page]')
  if (root) root.outerHTML = renderWorkbenchPage()
}

export function isSewingOutsourcingWorkbenchDialogOpen(): boolean { return false }
export function closeSewingOutsourcingWorkbenchDialog(): boolean { return false }

export function handleSewingOutsourcingWorkbenchEvent(target: HTMLElement): boolean {
  const field = target.closest<HTMLSelectElement>('[data-ppic-workbench-field]')
  if (!field || !state.leaderView || !getCurrentPpicDailyActor().leader) return false
  if (field.dataset.ppicWorkbenchField !== 'selectedPpicId') return false
  state.selectedPpicId = field.value
  refresh()
  return true
}

if (typeof window !== 'undefined') window.setInterval(() => {
  const region = document.querySelector<HTMLElement>('[data-workbench-daily]')
  if (!region || !dailyReady) return
  try { region.innerHTML = renderDailyTodo() }
  catch (error) { region.innerHTML = `<p role="alert" class="rounded bg-red-50 p-3 text-sm text-red-700">${escapeHtml(error instanceof Error ? error.message : '每日回货待办读取失败')}</p>` }
}, 30000)
