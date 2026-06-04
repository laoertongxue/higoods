import { escapeHtml } from '../utils'
import {
  completeFeiTicketNumbering,
  getFeiTicketNumberingDemoCases,
  resolveFeiTicketNumberingScan,
  summarizeFeiTicketNumberingByOperator,
  type FeiTicketNumberingScanResult,
} from '../data/fcs/cutting/fei-ticket-numbering.ts'
import { renderPdaFrame } from './pda-shell'

interface PdaNumberingState {
  scanInput: string
  operatorName: string
  feedbackMessage: string
  scanResult: FeiTicketNumberingScanResult | null
}

const state: PdaNumberingState = {
  scanInput: '',
  operatorName: 'Siti Aminah',
  feedbackMessage: '',
  scanResult: null,
}

function statusTone(status: string): string {
  if (status === '已完成') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === '免打编号') return 'border-sky-200 bg-sky-50 text-sky-700'
  if (status === '缺少编号区间') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

function renderDemoButtons(): string {
  const cases = getFeiTicketNumberingDemoCases()
  const buttons = [
    ['未完成', cases.pendingTicket?.feiTicketNo || ''],
    ['已完成', cases.completedTicket?.feiTicketNo || ''],
    ['捆条', cases.bindingStripFeiTicketNo],
  ].filter(([, value]) => Boolean(value))
  return buttons.map(([label, value]) => `
    <button type="button" class="rounded-xl border bg-background px-3 py-2 text-xs font-medium" data-pda-ticket-numbering-action="demo-scan" data-ticket-no="${escapeHtml(value)}">${escapeHtml(label)}</button>
  `).join('')
}

function renderScanResult(result: FeiTicketNumberingScanResult | null): string {
  if (!result) {
    return '<div class="rounded-2xl border border-dashed bg-muted/20 px-4 py-5 text-center text-sm text-muted-foreground">请先扫描菲票。</div>'
  }
  return `
    <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold text-foreground">${escapeHtml(result.ticket?.feiTicketNo || state.scanInput || '-')}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(result.ticket?.productionOrderNo || '按扫码结果识别')}</div>
        </div>
        <span class="shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(result.status)}">${escapeHtml(result.status)}</span>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div class="rounded-xl bg-muted/40 px-3 py-2">
          <div class="text-muted-foreground">部位</div>
          <div class="mt-1 font-semibold text-foreground">${escapeHtml(result.ticket?.partName || '-')}</div>
        </div>
        <div class="rounded-xl bg-muted/40 px-3 py-2">
          <div class="text-muted-foreground">尺码</div>
          <div class="mt-1 font-semibold text-foreground">${escapeHtml(result.ticket?.skuSize || '-')}</div>
        </div>
        <div class="rounded-xl bg-muted/40 px-3 py-2">
          <div class="text-muted-foreground">编号范围</div>
          <div class="mt-1 font-semibold text-foreground">${escapeHtml(result.pieceSequenceLabel || '-')}</div>
        </div>
        <div class="rounded-xl bg-muted/40 px-3 py-2">
          <div class="text-muted-foreground">计件数量</div>
          <div class="mt-1 font-semibold text-foreground">${result.numberCount ? `${result.numberCount} 个` : '-'}</div>
        </div>
      </div>
      <div class="mt-3 rounded-xl border bg-background px-3 py-2 text-xs text-muted-foreground">${escapeHtml(result.message)}</div>
    </section>
  `
}

function renderTodaySummary(): string {
  const summaries = summarizeFeiTicketNumberingByOperator()
  const current = summaries.find((item) => item.operatorName === state.operatorName) || summaries[0]
  return `
    <section class="grid grid-cols-2 gap-2">
      <article class="rounded-2xl border bg-card px-3 py-3 shadow-sm">
        <div class="text-xs text-muted-foreground">今日员工</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(state.operatorName || '-')}</div>
      </article>
      <article class="rounded-2xl border bg-card px-3 py-3 shadow-sm">
        <div class="text-xs text-muted-foreground">已完成</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${current ? `${current.ticketCount} 张 / ${current.numberCount} 个` : '0 张 / 0 个'}</div>
      </article>
    </section>
  `
}

function syncStateFromControls(container: ParentNode = document): void {
  container.querySelectorAll<HTMLElement>('[data-pda-ticket-numbering-field]').forEach((node) => {
    const field = node.dataset.pdaTicketNumberingField
    if (!field) return
    if (node instanceof HTMLInputElement) {
      if (field === 'scanInput') state.scanInput = node.value
      if (field === 'operatorName') state.operatorName = node.value
    }
  })
}

export function renderPdaCuttingFeiTicketNumberingPage(): string {
  const body = `
    <div class="space-y-3 px-4 pb-5 pt-4">
      ${renderTodaySummary()}
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">操作员工</span>
          <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" value="${escapeHtml(state.operatorName)}" data-skip-page-rerender="true" data-pda-ticket-numbering-field="operatorName" placeholder="员工姓名" />
        </label>
        <label class="mt-3 block space-y-1">
          <span class="text-xs text-muted-foreground">菲票号 / 二维码</span>
          <input class="h-12 w-full rounded-xl border bg-background px-3 text-base font-semibold" value="${escapeHtml(state.scanInput)}" data-skip-page-rerender="true" data-pda-ticket-numbering-field="scanInput" placeholder="扫描菲票" />
        </label>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button type="button" class="min-h-11 rounded-xl border px-3 py-2 text-sm font-medium" data-pda-ticket-numbering-action="scan">查询编号</button>
          <button type="button" class="min-h-11 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" data-pda-ticket-numbering-action="complete">完成打编号</button>
        </div>
        <div class="mt-3 flex gap-2">${renderDemoButtons()}</div>
      </section>
      ${state.feedbackMessage ? `<div class="rounded-2xl border bg-muted/20 px-4 py-3 text-sm">${escapeHtml(state.feedbackMessage)}</div>` : ''}
      ${renderScanResult(state.scanResult)}
      <button type="button" class="min-h-11 w-full rounded-xl border bg-background px-3 py-2 text-sm font-medium" data-nav="/fcs/pda/warehouse/wait-handover?scope=cutting">返回待交出仓</button>
    </div>
  `
  return renderPdaFrame(body, 'warehouse', { headerTitle: '菲票打编号' })
}

export function handlePdaCuttingFeiTicketNumberingEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pda-ticket-numbering-action]')
  if (!actionNode) return false
  syncStateFromControls(actionNode.closest('[data-pda-ticket-numbering-action]')?.parentElement || document)
  const action = actionNode.dataset.pdaTicketNumberingAction

  if (action === 'demo-scan') {
    state.scanInput = actionNode.dataset.ticketNo || ''
    state.scanResult = resolveFeiTicketNumberingScan(state.scanInput)
    state.feedbackMessage = state.scanResult.message
    return true
  }

  if (action === 'scan') {
    state.scanResult = resolveFeiTicketNumberingScan(state.scanInput)
    state.feedbackMessage = state.scanResult.message
    return true
  }

  if (action === 'complete') {
    const result = completeFeiTicketNumbering({
      feiTicketNoOrId: state.scanInput,
      operatorName: state.operatorName,
      operatorRole: '打编号员工',
      source: 'PDA',
    })
    state.scanResult = result
    state.feedbackMessage = result.message
    if (result.status === '已完成') state.scanInput = ''
    return true
  }

  return false
}
