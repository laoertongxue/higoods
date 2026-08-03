import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { listCuttingRuntimeEvents, type CuttingRuntimeEvent } from '../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { resolveTransferBagCurrentUse } from '../data/fcs/cutting/transfer-bag-operations.ts'
import type { TransferBagFlowStageKey, TransferBagLifecycleAction, TransferBagMainStatusKey } from '../data/fcs/cutting/transfer-bag-lifecycle.ts'
import { renderPdaFrame } from './pda-shell'
import { buildWaitHandoverLifecycleByBagCode } from './process-factory/cutting/wait-handover-runtime.ts'

type PdaTransferBagActionContext = {
  mainStatus: TransferBagMainStatusKey
  flowStage: TransferBagFlowStageKey | null
  allowedActions: TransferBagLifecycleAction[]
}

export function getPdaTransferBagVisibleActionLabels(
  _lifecycle: PdaTransferBagActionContext,
  _receiveWritebackStatus: string,
): string[] {
  return []
}

function getQueryValue(name: string): string {
  const query = appStore.getState().pathname.split('?')[1] || ''
  return new URLSearchParams(query).get(name) || ''
}

function eventPayload(event: CuttingRuntimeEvent): Record<string, unknown> {
  return event.payload && typeof event.payload === 'object' ? event.payload as Record<string, unknown> : {}
}

function factLabel(event: CuttingRuntimeEvent): string {
  if (event.eventType === '菲票装袋') return '菲票装袋'
  if (event.eventType === '中转袋入仓') return '中转袋入仓'
  if (event.eventType === '中转袋拆袋重装') return '拆袋重装'
  if (event.eventType === '新增交出记录') return '中转袋交出'
  if (event.eventType === '中转袋回收') return '中转袋回收'
  if (event.eventType === '中转袋报废') return '中转袋报废'
  return event.eventType
}

export function renderPdaTransferBagDetailPage(routeBagNo?: string): string {
  const bagCode = (routeBagNo || getQueryValue('bagNo')).trim().toUpperCase()
  const current = resolveTransferBagCurrentUse(bagCode)
  const lifecycle = buildWaitHandoverLifecycleByBagCode(bagCode)
  const history = listCuttingRuntimeEvents().filter((event) =>
    event.refs.transferBagCode === bagCode || event.refs.transferBagCodes?.includes(bagCode))
  const latestHandover = history.filter((event) => event.eventType === '新增交出记录').at(-1)
  const latestHandoverPayload = latestHandover ? eventPayload(latestHandover) : {}
  const recoveryRecords = history.filter((event) => event.eventType === '中转袋回收')
  const scrapRecords = history.filter((event) => event.eventType === '中转袋报废')
  const pieceQty = current.tickets.reduce((sum, ticket) => sum + ticket.pieceQty, 0)

  const content = `
    <main class="space-y-4 px-4 pb-5 pt-4">
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div><h1 class="text-lg font-semibold">中转袋扫码详情</h1><p class="mt-1 text-xs text-muted-foreground">只读展示系统能够观察到的袋票、交出、回收和报废事实。</p></div>
          <span class="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary">${escapeHtml(lifecycle.mainStatusLabel)}</span>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div class="col-span-2"><span class="text-muted-foreground">中转袋编号：</span><b>${escapeHtml(bagCode || '未识别')}</b></div>
          <div><span class="text-muted-foreground">主状态：</span>${escapeHtml(lifecycle.mainStatusLabel)}</div>
          <div><span class="text-muted-foreground">当前阶段：</span>${escapeHtml(lifecycle.flowStageLabel)}</div>
          <div class="col-span-2"><span class="text-muted-foreground">当前使用周期：</span>${escapeHtml(current.usageCycleId || '无')}</div>
          <div><span class="text-muted-foreground">当前生产单：</span>${escapeHtml(current.productionOrderNo || '无')}</div>
          <div><span class="text-muted-foreground">当前菲票 / 裁片：</span>${current.tickets.length} 张 / ${pieceQty} 片</div>
        </div>
      </section>

      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <h2 class="text-sm font-semibold">当前袋内菲票</h2>
        <div class="mt-3 space-y-2">
          ${current.tickets.length ? current.tickets.map((ticket) => `
            <article class="rounded-xl border px-3 py-3 text-xs">
              <div class="font-semibold">${escapeHtml(ticket.feiTicketNo)}</div>
              <div class="mt-2 grid grid-cols-2 gap-1 text-muted-foreground">
                <div>颜色：${escapeHtml(ticket.color)}</div><div>尺码：${escapeHtml(ticket.size)}</div>
                <div>部位：${escapeHtml(ticket.partName)}</div><div>数量：${ticket.pieceQty} 片</div>
                <div class="col-span-2">车缝任务：${escapeHtml(ticket.sewingTaskNo || '未分配')}</div>
                <div class="col-span-2">计划接收工厂：${escapeHtml(ticket.receiverFactoryName || '未分配')}</div>
              </div>
            </article>
          `).join('') : '<div class="rounded-xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">当前袋内没有有效菲票</div>'}
        </div>
      </section>

      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <h2 class="text-sm font-semibold">最近交出快照</h2>
        ${latestHandover ? `<div class="mt-3 rounded-xl border px-3 py-3 text-xs"><div>交出记录：${escapeHtml(latestHandover.eventNo)}</div><div class="mt-1">交出时间：${escapeHtml(latestHandover.occurredAt)}</div><div class="mt-1">交给：${escapeHtml(String(latestHandoverPayload.receiverName || '待核对'))}</div><div class="mt-1">车缝任务：${escapeHtml((latestHandover.refs.sewingTaskNos || []).join('、') || '无')}</div></div>` : '<div class="mt-3 rounded-xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">暂无交出记录</div>'}
      </section>

      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <h2 class="text-sm font-semibold">回收和报废记录</h2>
        <div class="mt-3 space-y-2 text-xs">
          ${[...recoveryRecords, ...scrapRecords].length ? [...recoveryRecords, ...scrapRecords].map((event) => `<div class="rounded-xl border px-3 py-3"><b>${escapeHtml(factLabel(event))}</b><div class="mt-1">${escapeHtml(event.eventNo)} / ${escapeHtml(event.occurredAt)} / ${escapeHtml(event.operatorName)}</div></div>`).join('') : '<div class="rounded-xl border border-dashed px-3 py-6 text-center text-muted-foreground">暂无回收或报废记录</div>'}
        </div>
      </section>

      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <div class="flex items-center justify-between"><h2 class="text-sm font-semibold">完整历史</h2><span class="text-xs text-muted-foreground">${history.length} 条</span></div>
        <div class="mt-3 space-y-2 text-xs">${history.length ? history.map((event) => `<div class="rounded-xl border px-3 py-2"><b>${escapeHtml(factLabel(event))}</b><div class="mt-1 text-muted-foreground">${escapeHtml(event.occurredAt)} · ${escapeHtml(event.operatorName)}</div></div>`).join('') : '<div class="rounded-xl border border-dashed px-3 py-6 text-center text-muted-foreground">未找到该袋的受管事实</div>'}</div>
      </section>
    </main>
  `
  return renderPdaFrame(content, 'warehouse', { headerTitle: '中转袋详情' })
}
