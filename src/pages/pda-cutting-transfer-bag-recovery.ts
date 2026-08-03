// @page-pattern: pda
import { escapeHtml } from '../utils'
import { listCuttingRuntimeEvents } from '../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import {
  recoverTransferBag,
  resolveTransferBagCurrentUse,
} from '../data/fcs/cutting/transfer-bag-operations.ts'
import { resolvePdaCuttingRuntimeOperator } from '../data/fcs/pda-cutting-runtime-action-inputs.ts'
import { PDA_PAGE_HANDLED_LOCALLY, type PdaPageEventResult } from '../main-handlers/pda-local-action-result.ts'
import { renderPdaFrame } from './pda-shell'

interface PdaTransferBagRecoveryState {
  bagCode: string
  physicalBagReceived: boolean
  physicalBagEmpty: boolean
  recoveryNode: string
  recoveryLocation: string
  recoveryMode: 'NORMAL' | 'FORCED'
  reason: string
  latestHandoverSummary: string
  productionOrderNo: string
  ticketCount: number
  statusLabel: string
  feedback: string
  recoveryRecordNo: string
  identified: boolean
}

const initialState = (): PdaTransferBagRecoveryState => ({
  bagCode: '',
  physicalBagReceived: false,
  physicalBagEmpty: false,
  recoveryNode: '裁床',
  recoveryLocation: '裁床空袋回收点',
  recoveryMode: 'NORMAL',
  reason: '',
  latestHandoverSummary: '',
  productionOrderNo: '',
  ticketCount: 0,
  statusLabel: '',
  feedback: '',
  recoveryRecordNo: '',
  identified: false,
})

let recoveryState = initialState()

function nowIndonesia(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date())
}

function latestHandoverSummary(bagCode: string): string {
  const event = listCuttingRuntimeEvents().filter((item) =>
    item.eventType === '新增交出记录' && item.refs.transferBagCode === bagCode).at(-1)
  if (!event) return '未找到最近交出记录'
  const payload = event.payload as Record<string, unknown>
  return `${event.eventNo} / ${String(payload.receiverName || '接收工厂待核对')} / ${event.occurredAt}`
}

export function scanPdaTransferBagForRecovery(bagCode: string): PdaTransferBagRecoveryState {
  const normalized = bagCode.trim().toUpperCase()
  const current = resolveTransferBagCurrentUse(normalized)
  const base = { ...initialState(), bagCode: normalized }
  if (!normalized) return { ...base, feedback: '请扫描中转袋。' }
  if (current.mainStatus === 'DISABLED') return { ...base, feedback: '这个中转袋已报废，不能回收。' }
  if (current.flowStage !== 'HANDED_OVER_WAITING_RETURN' || !current.usageCycleId) {
    const message = current.tickets.length
      ? `这个中转袋还有 ${current.tickets.length} 张有效菲票，请先拆袋重装。`
      : current.mainStatus === 'IDLE'
        ? '这个中转袋已经空闲，不需要重复回收。'
        : '这个中转袋当前不是已交出待回收，不能回收。'
    return { ...base, feedback: message }
  }
  return {
    ...base,
    identified: true,
    productionOrderNo: current.productionOrderNo,
    ticketCount: current.tickets.length,
    statusLabel: '使用中 / 已交出待回收',
    latestHandoverSummary: latestHandoverSummary(normalized),
    feedback: '袋信息已识别。只在实物袋已经收到并且为空时确认回收。',
  }
}

function renderRecoveryContent(state: PdaTransferBagRecoveryState): string {
  return `
    <main class="space-y-4 px-4 py-4" data-pda-transfer-bag-recovery-page data-skip-page-rerender="true">
      <a class="text-sm text-blue-700" data-nav="/fcs/pda/warehouse/wait-handover?scope=cutting">返回待交出仓</a>
      <section class="rounded-2xl border bg-card p-4">
        <h1 class="text-lg font-semibold">中转袋回收</h1>
        <p class="mt-1 text-xs text-muted-foreground">只记录已经回到受管现场的实物空袋，不补录外部工厂之间的流转。</p>
        ${state.recoveryRecordNo ? `<div class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><div class="font-semibold">回收成功，中转袋已空闲</div><div class="mt-1">回收记录：${escapeHtml(state.recoveryRecordNo)}</div><div class="mt-1">中转袋：${escapeHtml(state.bagCode)}</div></div>` : ''}
        <label class="mt-4 block space-y-2">
          <span class="text-sm font-medium">1 扫描或填写中转袋</span>
          <input class="h-12 w-full rounded-xl border px-3" data-pda-recovery-field="bagCode" data-skip-page-rerender="true" value="${escapeHtml(state.bagCode)}" placeholder="扫描或填写中转袋编号" />
          <span class="text-xs text-muted-foreground">填写后按 Enter 读取当前事实</span>
        </label>
        ${state.identified ? `
          <div class="mt-4 rounded-xl border bg-muted/20 p-3 text-xs">
            <div>线上状态：<b>${escapeHtml(state.statusLabel)}</b></div>
            <div class="mt-1">原生产单：${escapeHtml(state.productionOrderNo || '-')}</div>
            <div class="mt-1">当前有效菲票：${state.ticketCount} 张（交出后袋票关系已解除）</div>
            <div class="mt-1">最近交出：${escapeHtml(state.latestHandoverSummary)}</div>
          </div>
          <div class="mt-4 grid gap-3 text-sm">
            <label class="flex items-start gap-2"><input class="mt-1" type="checkbox" data-pda-recovery-field="physicalBagReceived" ${state.physicalBagReceived ? 'checked' : ''}/><span>我已收到实物中转袋</span></label>
            <label class="flex items-start gap-2"><input class="mt-1" type="checkbox" data-pda-recovery-field="physicalBagEmpty" ${state.physicalBagEmpty ? 'checked' : ''}/><span>我已确认实物袋内没有菲票或裁片</span></label>
            <label>回收方式<select class="mt-1 h-11 w-full rounded-xl border bg-background px-3" data-pda-recovery-field="recoveryMode"><option value="NORMAL" ${state.recoveryMode === 'NORMAL' ? 'selected' : ''}>正常回收</option><option value="FORCED" ${state.recoveryMode === 'FORCED' ? 'selected' : ''}>强制回收</option></select></label>
            <label>回收节点<input class="mt-1 h-11 w-full rounded-xl border px-3" data-pda-recovery-field="recoveryNode" value="${escapeHtml(state.recoveryNode)}" /></label>
            <label>回收位置<input class="mt-1 h-11 w-full rounded-xl border px-3" data-pda-recovery-field="recoveryLocation" value="${escapeHtml(state.recoveryLocation)}" /></label>
            <label>回收原因${state.recoveryMode === 'FORCED' ? '（强制回收必填）' : ''}<textarea class="mt-1 min-h-20 w-full rounded-xl border px-3 py-2" data-pda-recovery-field="reason" placeholder="正常回收可填写备注；强制回收必须说明原因">${escapeHtml(state.reason)}</textarea></label>
          </div>
        ` : ''}
        ${state.feedback ? `<div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">${escapeHtml(state.feedback)}</div>` : ''}
        <button class="mt-4 h-12 w-full rounded-xl bg-blue-600 text-white disabled:opacity-40" type="button" data-pda-recovery-action="confirm" ${state.identified ? '' : 'disabled'}>确认回收</button>
      </section>
    </main>
  `
}

export function renderPdaCuttingTransferBagRecoveryPage(): string {
  return renderPdaFrame(renderRecoveryContent(recoveryState), 'warehouse', {
    headerTitle: '中转袋回收', disableTodoAutoOpen: true,
  })
}

function refreshRecoveryPage(node: HTMLElement): void {
  const container = node.closest<HTMLElement>('[data-pda-transfer-bag-recovery-page]')
  if (container) container.outerHTML = renderRecoveryContent(recoveryState)
}

export function handlePdaCuttingTransferBagRecoveryEvent(target: HTMLElement, event?: Event): PdaPageEventResult {
  const field = target.closest<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-pda-recovery-field]')
  if (field) {
    const key = field.dataset.pdaRecoveryField as keyof PdaTransferBagRecoveryState
    if (field instanceof HTMLInputElement && field.type === 'checkbox') {
      ;(recoveryState as unknown as Record<string, unknown>)[key] = field.checked
    } else {
      ;(recoveryState as unknown as Record<string, unknown>)[key] = field.value
    }
    if (key === 'bagCode' && event?.type === 'keydown' && 'key' in event && event.key === 'Enter') {
      recoveryState = scanPdaTransferBagForRecovery(field.value)
      refreshRecoveryPage(field)
    }
    return PDA_PAGE_HANDLED_LOCALLY
  }
  const action = target.closest<HTMLElement>('[data-pda-recovery-action="confirm"]')
  if (!action) return false
  try {
    const operator = resolvePdaCuttingRuntimeOperator('', '中转袋回收员')
    const eventRecord = recoverTransferBag({
      bagCode: recoveryState.bagCode,
      physicalBagReceived: recoveryState.physicalBagReceived,
      physicalBagEmpty: recoveryState.physicalBagEmpty,
      recoveryMode: recoveryState.recoveryMode,
      recoveryNode: recoveryState.recoveryNode,
      recoveryLocation: recoveryState.recoveryLocation,
      reason: recoveryState.reason,
      occurredAt: nowIndonesia(),
      source: 'PDA',
      operator: { operatorId: operator.operatorAccountId, operatorName: operator.operatorName, operatorRole: operator.operatorRole },
    })
    recoveryState = { ...recoveryState, identified: false, feedback: '回收成功，中转袋已变为空闲。', recoveryRecordNo: eventRecord.eventNo }
  } catch (error) {
    recoveryState = { ...recoveryState, feedback: error instanceof Error ? error.message : '回收失败，请检查后重试。' }
  }
  refreshRecoveryPage(action)
  return PDA_PAGE_HANDLED_LOCALLY
}
