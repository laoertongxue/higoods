// @page-pattern: pda
import { escapeHtml } from '../utils'
import {
  recoverThenScrapTransferBag,
  resolveTransferBagCurrentUse,
  submitTransferBagScrap,
} from '../data/fcs/cutting/transfer-bag-operations.ts'
import { resolvePdaCuttingRuntimeOperator } from '../data/fcs/pda-cutting-runtime-action-inputs.ts'
import { PDA_PAGE_HANDLED_LOCALLY, type PdaPageEventResult } from '../main-handlers/pda-local-action-result.ts'
import { renderPdaFrame } from './pda-shell'

interface PdaTransferBagScrapState {
  bagCode: string
  mode: 'DIRECT' | 'RECOVER_THEN_SCRAP' | 'BLOCKED' | ''
  statusLabel: string
  productionOrderNo: string
  ticketCount: number
  physicalBagReceived: boolean
  physicalBagEmpty: boolean
  reason: string
  authorizedBy: string
  finalConfirmed: boolean
  feedback: string
  recoveryRecordNo: string
  scrapRecordNo: string
}

const initialState = (): PdaTransferBagScrapState => ({
  bagCode: '', mode: '', statusLabel: '', productionOrderNo: '', ticketCount: 0,
  physicalBagReceived: false, physicalBagEmpty: false, reason: '', authorizedBy: '',
  finalConfirmed: false, feedback: '', recoveryRecordNo: '', scrapRecordNo: '',
})
let scrapState = initialState()

function nowIndonesia(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date())
}

export function scanPdaTransferBagForScrap(bagCode: string): PdaTransferBagScrapState {
  const normalized = bagCode.trim().toUpperCase()
  const current = resolveTransferBagCurrentUse(normalized)
  const base = { ...initialState(), bagCode: normalized, productionOrderNo: current.productionOrderNo, ticketCount: current.tickets.length }
  if (!normalized) return { ...base, mode: 'BLOCKED', feedback: '请扫描中转袋。' }
  if (current.mainStatus === 'DISABLED') return { ...base, mode: 'BLOCKED', statusLabel: '已报废', feedback: '这个中转袋已经报废，不能重复报废。' }
  if (current.mainStatus === 'IDLE' && current.tickets.length === 0) {
    return { ...base, mode: 'DIRECT', statusLabel: '空闲', feedback: '空闲袋可以直接报废，请填写原因、授权人并二次确认。' }
  }
  if (current.flowStage === 'HANDED_OVER_WAITING_RETURN' && current.tickets.length === 0) {
    return { ...base, mode: 'RECOVER_THEN_SCRAP', statusLabel: '使用中 / 已交出待回收', feedback: '实物空袋已回到现场时，系统将依次记录“回收为空闲”和“报废”。' }
  }
  if (current.tickets.length || ['PACKED', 'INBOUND_STORED', 'READY_HANDOVER'].includes(current.flowStage || '')) {
    return { ...base, mode: 'BLOCKED', statusLabel: '使用中', feedback: `这个中转袋还有 ${current.tickets.length} 张有效菲票，请先拆袋重装并转移全部菲票。` }
  }
  return { ...base, mode: 'BLOCKED', feedback: '这个中转袋当前不能报废，请先核对袋状态。' }
}

function renderScrapContent(state: PdaTransferBagScrapState): string {
  const canSubmit = state.mode === 'DIRECT' || state.mode === 'RECOVER_THEN_SCRAP'
  return `
    <main class="space-y-4 px-4 py-4" data-pda-transfer-bag-scrap-page data-skip-page-rerender="true">
      <a class="text-sm text-blue-700" data-nav="/fcs/pda/warehouse/wait-handover?scope=cutting">返回待交出仓</a>
      <section class="rounded-2xl border bg-card p-4">
        <h1 class="text-lg font-semibold">中转袋报废</h1>
        <p class="mt-1 text-xs text-muted-foreground">只有空闲袋可以报废；袋内有菲票时必须先拆袋重装。</p>
        ${state.scrapRecordNo ? `<div class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><div class="font-semibold">报废成功，中转袋已报废</div>${state.recoveryRecordNo ? `<div class="mt-1">先回收记录：${escapeHtml(state.recoveryRecordNo)}</div>` : ''}<div class="mt-1">报废记录：${escapeHtml(state.scrapRecordNo)}</div></div>` : ''}
        <label class="mt-4 block space-y-2"><span class="text-sm font-medium">1 扫描或填写中转袋</span><input class="h-12 w-full rounded-xl border px-3" data-pda-scrap-field="bagCode" data-skip-page-rerender="true" value="${escapeHtml(state.bagCode)}" placeholder="扫描或填写中转袋编号" /><span class="text-xs text-muted-foreground">填写后按 Enter 读取当前事实</span></label>
        ${state.mode ? `<div class="mt-4 rounded-xl border bg-muted/20 p-3 text-xs"><div>线上状态：<b>${escapeHtml(state.statusLabel || '-')}</b></div><div class="mt-1">生产单：${escapeHtml(state.productionOrderNo || '-')}</div><div class="mt-1">当前有效菲票：${state.ticketCount} 张</div></div>` : ''}
        ${state.mode === 'BLOCKED' && state.ticketCount > 0 ? `<a class="mt-3 flex h-11 items-center justify-center rounded-xl border border-blue-300 text-sm font-medium text-blue-700" data-nav="/fcs/pda/cutting/transfer-bag/repack">前往拆袋重装</a>` : ''}
        ${canSubmit ? `<div class="mt-4 grid gap-3 text-sm">
          ${state.mode === 'RECOVER_THEN_SCRAP' ? `<label class="flex items-start gap-2"><input class="mt-1" type="checkbox" data-pda-scrap-field="physicalBagReceived" ${state.physicalBagReceived ? 'checked' : ''}/><span>我已收到实物中转袋</span></label><label class="flex items-start gap-2"><input class="mt-1" type="checkbox" data-pda-scrap-field="physicalBagEmpty" ${state.physicalBagEmpty ? 'checked' : ''}/><span>我已确认实物袋内没有菲票或裁片</span></label>` : ''}
          <label>报废原因（必填）<textarea class="mt-1 min-h-20 w-full rounded-xl border px-3 py-2" data-pda-scrap-field="reason" placeholder="例如：袋体破损，无法继续使用">${escapeHtml(state.reason)}</textarea></label>
          <label>授权人（必填）<input class="mt-1 h-11 w-full rounded-xl border px-3" data-pda-scrap-field="authorizedBy" value="${escapeHtml(state.authorizedBy)}" placeholder="填写主管姓名" /></label>
          <label class="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-900"><input class="mt-1" type="checkbox" data-pda-scrap-field="finalConfirmed" ${state.finalConfirmed ? 'checked' : ''}/><span>我确认报废后该袋永久不能再次装袋、回收或流转</span></label>
        </div>` : ''}
        ${state.feedback ? `<div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">${escapeHtml(state.feedback)}</div>` : ''}
        <button class="mt-4 h-12 w-full rounded-xl bg-red-600 text-white disabled:opacity-40" type="button" data-pda-scrap-action="confirm" ${canSubmit ? '' : 'disabled'}>确认报废</button>
      </section>
    </main>
  `
}

export function renderPdaCuttingTransferBagScrapPage(): string {
  return renderPdaFrame(renderScrapContent(scrapState), 'warehouse', { headerTitle: '中转袋报废', disableTodoAutoOpen: true })
}

function refreshScrapPage(node: HTMLElement): void {
  const container = node.closest<HTMLElement>('[data-pda-transfer-bag-scrap-page]')
  if (container) container.outerHTML = renderScrapContent(scrapState)
}

export function handlePdaCuttingTransferBagScrapEvent(target: HTMLElement, event?: Event): PdaPageEventResult {
  const field = target.closest<HTMLInputElement | HTMLTextAreaElement>('[data-pda-scrap-field]')
  if (field) {
    const key = field.dataset.pdaScrapField as keyof PdaTransferBagScrapState
    ;(scrapState as unknown as Record<string, unknown>)[key] = field instanceof HTMLInputElement && field.type === 'checkbox' ? field.checked : field.value
    if (key === 'bagCode' && event?.type === 'keydown' && 'key' in event && event.key === 'Enter') {
      scrapState = scanPdaTransferBagForScrap(field.value)
      refreshScrapPage(field)
    }
    return PDA_PAGE_HANDLED_LOCALLY
  }
  const action = target.closest<HTMLElement>('[data-pda-scrap-action="confirm"]')
  if (!action) return false
  try {
    if (!scrapState.finalConfirmed) throw new Error('请勾选报废二次确认。')
    const operator = resolvePdaCuttingRuntimeOperator('', '中转袋报废员')
    const common = {
      reason: scrapState.reason,
      authorizedBy: scrapState.authorizedBy,
      occurredAt: nowIndonesia(),
    }
    if (scrapState.mode === 'RECOVER_THEN_SCRAP') {
      const result = recoverThenScrapTransferBag({
        recovery: {
          bagCode: scrapState.bagCode,
          physicalBagReceived: scrapState.physicalBagReceived,
          physicalBagEmpty: scrapState.physicalBagEmpty,
          recoveryMode: 'NORMAL',
          recoveryNode: '裁床',
          recoveryLocation: '裁床报废处理点',
          reason: `报废前回收：${scrapState.reason}`,
          occurredAt: common.occurredAt,
          source: 'PDA',
          operator: { operatorId: operator.operatorAccountId, operatorName: operator.operatorName, operatorRole: operator.operatorRole },
        },
        scrap: common,
      })
      scrapState = { ...scrapState, mode: 'BLOCKED', feedback: '报废成功，中转袋已永久停用。', recoveryRecordNo: result.recoveryEvent.eventNo, scrapRecordNo: result.scrapEvent.eventNo }
    } else if (scrapState.mode === 'DIRECT') {
      const result = submitTransferBagScrap({
        bagCode: scrapState.bagCode, source: 'PDA', operator: { operatorId: operator.operatorAccountId, operatorName: operator.operatorName, operatorRole: operator.operatorRole }, ...common,
      })
      scrapState = { ...scrapState, mode: 'BLOCKED', feedback: '报废成功，中转袋已永久停用。', scrapRecordNo: result.eventNo }
    } else {
      throw new Error('当前中转袋不能报废。')
    }
  } catch (error) {
    scrapState = { ...scrapState, feedback: error instanceof Error ? error.message : '报废失败，请检查后重试。' }
  }
  refreshScrapPage(action)
  return PDA_PAGE_HANDLED_LOCALLY
}
