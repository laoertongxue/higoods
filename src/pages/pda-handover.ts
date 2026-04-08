import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import { renderRealQrPlaceholder } from '../components/real-qr'
import { renderPdaFrame } from './pda-shell'
import {
  deriveHandoutObjectProfile,
  getPdaCompletedHeads,
  getPdaHandoverRecordsByHead,
  getPdaHandoutHeads,
  getPdaPickupHeads,
  type PdaHandoverHead,
} from '../data/fcs/pda-handover-events'
import { resolvePdaHandoverDetailPath } from '../data/fcs/pda-cutting-execution-source.ts'

type HandoverTab = 'pickup' | 'handout' | 'done'

interface PdaHandoverState {
  selectedFactoryId: string
  activeTab: HandoverTab
}

const state: PdaHandoverState = {
  selectedFactoryId: '',
  activeTab: 'pickup',
}

const TAB_CONFIG: Array<{ key: HandoverTab; label: string }> = [
  { key: 'pickup', label: '待领料' },
  { key: 'handout', label: '待交出' },
  { key: 'done', label: '已完成' },
]

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return query || ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

function syncTabWithQuery(): void {
  const tab = getCurrentSearchParams().get('tab')
  if (!tab) {
    state.activeTab = 'pickup'
    return
  }
  if (TAB_CONFIG.some((item) => item.key === tab)) {
    state.activeTab = tab as HandoverTab
  }
}

function getCurrentFactoryId(): string {
  if (state.selectedFactoryId) return state.selectedFactoryId
  if (typeof window === 'undefined') return 'ID-F001'

  try {
    const localFactoryId = window.localStorage.getItem('fcs_pda_factory_id')
    if (localFactoryId) {
      state.selectedFactoryId = localFactoryId
      return localFactoryId
    }

    const rawSession = window.localStorage.getItem('fcs_pda_session')
    if (rawSession) {
      const parsed = JSON.parse(rawSession) as { factoryId?: string }
      if (parsed.factoryId) {
        state.selectedFactoryId = parsed.factoryId
        return parsed.factoryId
      }
    }
  } catch {
    // ignore parse errors
  }

  state.selectedFactoryId = 'ID-F001'
  return state.selectedFactoryId
}

function renderPartyChip(kind: PdaHandoverHead['targetKind'], name: string): string {
  return `
    <span class="inline-flex items-center gap-1 text-xs">
      <i data-lucide="${kind === 'WAREHOUSE' ? 'warehouse' : 'factory'}" class="h-3 w-3 shrink-0 text-muted-foreground"></i>
      <span>${escapeHtml(name)}</span>
    </span>
  `
}

function getExecutorLabel(head: PdaHandoverHead): string {
  if (head.executorKind === 'WAREHOUSE_WORKSHOP') return '仓内后道'
  return '外部工厂'
}

function getPickupSummaryMeta(head: PdaHandoverHead): { label: string; className: string; hint: string } {
  if (head.summaryStatus === 'NONE') {
    return {
      label: '暂无仓库领料记录',
      className: 'border-border bg-background text-muted-foreground',
      hint: '领料记录由仓库配料回写后生成',
    }
  }
  if (head.summaryStatus === 'SUBMITTED') {
    return {
      label: '待仓库/工厂处理',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
      hint: '当前仍有记录待仓库发出、待自提或待工厂确认',
    }
  }
  if (head.summaryStatus === 'HAS_OBJECTION') {
    return {
      label: '存在数量差异',
      className: 'border-red-200 bg-red-50 text-red-700',
      hint: '有领料记录已发起数量差异，等待平台处理',
    }
  }
  if (head.summaryStatus === 'PARTIAL_WRITTEN_BACK') {
    return {
      label: '部分已确认',
      className: 'border-blue-200 bg-blue-50 text-blue-700',
      hint: '部分记录已完成确认，仍有记录待处理',
    }
  }
  return {
    label: '已完成确认',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    hint: '领料记录已确认/裁定完成，等待仓库侧发起头单完成',
  }
}

function getHandoutSummaryMeta(head: PdaHandoverHead): { label: string; className: string; hint: string } {
  if (head.summaryStatus === 'NONE') {
    return {
      label: '暂无交出记录',
      className: 'border-border bg-background text-muted-foreground',
      hint: '当前等待仓库收货后自动回写',
    }
  }
  if (head.summaryStatus === 'SUBMITTED') {
    return {
      label: '待仓库回写',
      className: 'border-blue-200 bg-blue-50 text-blue-700',
      hint: '等待仓库回写回货单与数量',
    }
  }
  if (head.summaryStatus === 'PARTIAL_WRITTEN_BACK') {
    return {
      label: '部分已回写',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
      hint: '仍有记录待仓库回写',
    }
  }
  if (head.summaryStatus === 'HAS_OBJECTION') {
    return {
      label: '存在数量异议',
      className: 'border-red-200 bg-red-50 text-red-700',
      hint: '异议未处理完前不可发起完成',
    }
  }
  return {
    label: '已回写',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    hint: '回写已完成，等待仓库侧发起完成',
  }
}

function renderHandoutQrBlock(head: PdaHandoverHead, objectTypeLabel: string, size: number): string {
  if (!head.qrCodeValue) return ''

  return `
    <div data-testid="handout-head-qr" class="shrink-0 rounded-md border bg-white p-1.5">
      ${renderRealQrPlaceholder({
        value: head.qrCodeValue,
        size,
        title: `交出头二维码 ${head.handoverId}`,
        label: `交出头 ${head.handoverId} 二维码`,
      })}
      <div class="mt-1 space-y-0.5 text-[10px] leading-tight text-muted-foreground">
        <div>交出头编号：${escapeHtml(head.handoverId)}</div>
        <div>任务编号：${escapeHtml(head.taskNo)}</div>
        <div>交出物类型：${escapeHtml(objectTypeLabel)}</div>
      </div>
    </div>
  `
}

function renderHandoutObjectBlock(head: PdaHandoverHead, compact = false): string {
  const records = getPdaHandoverRecordsByHead(head.handoverId)
  const profile = deriveHandoutObjectProfile(head, records)
  const infoLines = profile.objectInfoLines.length
    ? profile.objectInfoLines
        .map((line) => `<div class="truncate">${escapeHtml(line)}</div>`)
        .join('')
    : '<div>当前暂无仓库回写记录</div>'

  return `
    <div data-testid="handout-head-object-profile" class="flex items-start justify-between gap-3 rounded border bg-muted/20 px-2.5 py-2 text-xs">
      <div class="min-w-0 flex-1 space-y-1.5">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="inline-flex items-center rounded border border-border bg-background px-1.5 py-0 text-[10px]">交出物类型：${escapeHtml(profile.objectTypeLabel)}</span>
          ${
            profile.objectType === 'CUT_PIECE' && profile.cutPieceRecordSummary
              ? `
                <span class="inline-flex items-center rounded border border-border bg-background px-1.5 py-0 text-[10px]">涉及部位：${profile.cutPieceRecordSummary.involvedPartCount} 种</span>
                <span class="inline-flex items-center rounded border border-border bg-background px-1.5 py-0 text-[10px]">涉及 SKU：${profile.cutPieceRecordSummary.involvedSkuCount} 个</span>
              `
              : ''
          }
          ${
            typeof profile.garmentEquivalentQtyTotal === 'number'
              ? `<span class="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0 text-[10px] text-blue-700">可折算成衣件数（件）：${profile.garmentEquivalentQtyTotal} 件</span>`
              : ''
          }
        </div>
        <div class="space-y-0.5 text-muted-foreground">${infoLines}</div>
        <div class="grid ${compact ? 'grid-cols-1 gap-y-1' : 'grid-cols-1 gap-y-1 sm:grid-cols-3 sm:gap-2'}">
          <div>${escapeHtml(profile.primaryQtyLabel)}：<span class="font-medium text-foreground">${profile.totalPlannedQty} ${escapeHtml(profile.displayUnit)}</span></div>
          <div>${escapeHtml(profile.writtenQtyLabel)}：<span class="font-medium text-foreground">${profile.totalWrittenQty} ${escapeHtml(profile.displayUnit)}</span></div>
          <div>${escapeHtml(profile.pendingQtyLabel)}：<span class="font-medium text-foreground">${profile.totalPendingQty} ${escapeHtml(profile.displayUnit)}</span></div>
        </div>
      </div>
      ${renderHandoutQrBlock(head, profile.objectTypeLabel, compact ? 72 : 80)}
    </div>
  `
}

function renderOpenHeadCard(head: PdaHandoverHead): string {
  const meta = head.headType === 'PICKUP' ? getPickupSummaryMeta(head) : getHandoutSummaryMeta(head)
  const headLabel = head.headType === 'PICKUP' ? '领料头' : '交出头'
  const actionLabel = head.headType === 'PICKUP' ? '去领料' : '查看交出详情'

  if (head.headType === 'PICKUP') {
    const pickupHint =
      head.objectionCount > 0
        ? `有 ${head.objectionCount} 条记录在处理差异`
        : head.pendingWritebackCount > 0
          ? `还有 ${head.pendingWritebackCount} 条记录待处理`
          : '当前等待仓库完成头单'

    return `
      <article
        class="cursor-pointer rounded-lg border transition-colors hover:border-primary"
        data-pda-handover-action="open-detail"
        data-event-id="${escapeHtml(head.handoverId)}"
      >
        <div class="space-y-2 p-3">
          <div class="flex items-center justify-between gap-2">
            <div class="flex min-w-0 items-center gap-1.5">
              <span class="inline-flex shrink-0 items-center rounded border border-border bg-muted px-1.5 py-0 text-[10px]">${headLabel}</span>
              <span class="inline-flex shrink-0 items-center rounded border px-1.5 py-0 text-[10px] ${meta.className}">${escapeHtml(meta.label)}</span>
            </div>
            <i data-lucide="chevron-right" class="h-4 w-4 shrink-0 text-muted-foreground"></i>
          </div>

          <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            <div><span class="text-muted-foreground">任务编号：</span>${escapeHtml(head.taskNo)}</div>
            <div><span class="text-muted-foreground">生产单号：</span>${escapeHtml(head.productionOrderNo)}</div>
            <div class="col-span-2"><span class="text-muted-foreground">当前工序：</span>${escapeHtml(head.processName)}</div>
          </div>

          <div class="flex items-center gap-2 py-0.5 text-xs">
            <span class="shrink-0 text-muted-foreground">来源仓库：</span>
            ${renderPartyChip('WAREHOUSE', head.sourceFactoryName)}
            <i data-lucide="arrow-right" class="h-3 w-3 shrink-0 text-muted-foreground"></i>
            <span class="shrink-0 text-muted-foreground">领料工厂：</span>
            ${renderPartyChip(head.targetKind, head.targetName)}
          </div>

          <div class="grid grid-cols-2 gap-2 rounded border bg-muted/20 px-2.5 py-2 text-xs">
            <div>累计记录数：<span class="font-medium">${head.recordCount} 次</span></div>
            <div>待处理记录数：<span class="font-medium">${head.pendingWritebackCount} 次</span></div>
            <div class="col-span-2">累计最终确认总量：<span class="font-medium">${head.qtyActualTotal} ${escapeHtml(head.qtyUnit)}</span></div>
          </div>

          <div class="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] text-blue-700">${escapeHtml(pickupHint)}</div>

          <button
            class="mt-1 inline-flex h-8 w-full items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            data-pda-handover-action="open-detail"
            data-event-id="${escapeHtml(head.handoverId)}"
          >${actionLabel}</button>
        </div>
      </article>
    `
  }

  return `
    <article
      class="cursor-pointer rounded-lg border transition-colors hover:border-primary"
      data-testid="handout-head-card"
      data-pda-handover-action="open-detail"
      data-event-id="${escapeHtml(head.handoverId)}"
    >
      <div class="space-y-2 p-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="inline-flex shrink-0 items-center rounded border border-border bg-muted px-1.5 py-0 text-[10px]">${headLabel}</span>
            <span class="inline-flex shrink-0 items-center rounded border px-1.5 py-0 text-[10px] ${meta.className}">${escapeHtml(meta.label)}</span>
          </div>
          <i data-lucide="chevron-right" class="h-4 w-4 shrink-0 text-muted-foreground"></i>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          <div><span class="text-muted-foreground">任务编号：</span>${escapeHtml(head.taskNo)}</div>
          <div><span class="text-muted-foreground">交出头编号：</span>${escapeHtml(head.handoverId)}</div>
          <div><span class="text-muted-foreground">原始任务：</span>${escapeHtml(head.rootTaskNo || head.taskNo)}</div>
          <div><span class="text-muted-foreground">生产单号：</span>${escapeHtml(head.productionOrderNo)}</div>
          <div><span class="text-muted-foreground">当前工序：</span>${escapeHtml(head.processName)}</div>
          <div><span class="text-muted-foreground">任务状态：</span>${head.taskStatus === 'DONE' ? '已完工' : '进行中'}</div>
          <div><span class="text-muted-foreground">交接范围：</span>${escapeHtml(head.scopeLabel || '整单')}</div>
          <div><span class="text-muted-foreground">交接方式：</span>${escapeHtml(getExecutorLabel(head))}</div>
          <div class="col-span-2"><span class="text-muted-foreground">来源单据：</span>${escapeHtml(head.sourceDocNo || '—')}</div>
        </div>

        <div class="flex items-center gap-2 py-0.5 text-xs">
          <span class="shrink-0 text-muted-foreground">${head.headType === 'PICKUP' ? '来源仓库：' : '交出工厂：'}</span>
          ${renderPartyChip(head.headType === 'PICKUP' ? 'WAREHOUSE' : 'FACTORY', head.sourceFactoryName)}
          <i data-lucide="arrow-right" class="h-3 w-3 shrink-0 text-muted-foreground"></i>
          <span class="shrink-0 text-muted-foreground">${head.headType === 'PICKUP' ? '领料工厂：' : '去向：'}</span>
          ${renderPartyChip(head.targetKind, head.targetName)}
        </div>

        <div class="grid grid-cols-2 gap-2 rounded border bg-muted/20 px-2.5 py-2 text-xs">
          <div>累计记录：<span class="font-medium">${head.recordCount} 次</span></div>
          <div>${head.headType === 'PICKUP' ? '待处理记录：' : '待仓库回写：'}<span class="font-medium">${head.pendingWritebackCount} 次</span></div>
          <div>${head.headType === 'PICKUP' ? '累计最终确认：' : '累计回写：'}<span class="font-medium">${head.qtyActualTotal} ${escapeHtml(head.qtyUnit)}</span></div>
          <div>数量差异：<span class="font-medium ${head.qtyDiffTotal !== 0 ? 'text-red-600' : ''}">${head.qtyDiffTotal > 0 ? '-' : head.qtyDiffTotal < 0 ? '+' : ''}${Math.abs(head.qtyDiffTotal)} ${escapeHtml(head.qtyUnit)}</span></div>
        </div>

        ${renderHandoutObjectBlock(head, true)}

        <div class="text-[10px] text-muted-foreground">${escapeHtml(meta.hint)}</div>
        <div class="rounded border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] text-blue-700">
          当前头单仅可由仓库侧发起完成，工厂不可主动关闭
        </div>

        <button
          class="mt-1 inline-flex h-8 w-full items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          data-pda-handover-action="open-detail"
          data-event-id="${escapeHtml(head.handoverId)}"
        >${actionLabel}</button>
      </div>
    </article>
  `
}

function renderDoneHeadCard(head: PdaHandoverHead): string {
  const doneTypeLabel = head.headType === 'PICKUP' ? '领料完成' : '交出完成'
  const diffLabel = `${head.qtyDiffTotal > 0 ? '-' : head.qtyDiffTotal < 0 ? '+' : ''}${Math.abs(head.qtyDiffTotal)} ${head.qtyUnit}`

  return `
    <article
      class="cursor-pointer rounded-lg border transition-colors hover:border-primary"
      ${head.headType === 'HANDOUT' ? 'data-testid="handout-head-card"' : ''}
      data-pda-handover-action="open-detail"
      data-event-id="${escapeHtml(head.handoverId)}"
    >
      <div class="space-y-2 p-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="inline-flex shrink-0 items-center rounded border border-green-200 bg-green-50 px-1.5 py-0 text-[10px] text-green-700">${doneTypeLabel}</span>
            <span class="inline-flex shrink-0 items-center rounded border border-border bg-muted px-1.5 py-0 text-[10px]">仓库发起完成</span>
          </div>
          <i data-lucide="chevron-right" class="h-4 w-4 shrink-0 text-muted-foreground"></i>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          <div><span class="text-muted-foreground">任务编号：</span>${escapeHtml(head.taskNo)}</div>
          <div><span class="text-muted-foreground">原始任务：</span>${escapeHtml(head.rootTaskNo || head.taskNo)}</div>
          <div><span class="text-muted-foreground">生产单号：</span>${escapeHtml(head.productionOrderNo)}</div>
          <div><span class="text-muted-foreground">当前工序：</span>${escapeHtml(head.processName)}</div>
          <div><span class="text-muted-foreground">完成时间：</span>${escapeHtml(head.completedByWarehouseAt || '—')}</div>
          <div><span class="text-muted-foreground">交接范围：</span>${escapeHtml(head.scopeLabel || '整单')}</div>
          <div><span class="text-muted-foreground">交接方式：</span>${escapeHtml(getExecutorLabel(head))}</div>
          <div class="col-span-2"><span class="text-muted-foreground">来源单据：</span>${escapeHtml(head.sourceDocNo || '—')}</div>
        </div>

        <div class="grid grid-cols-2 gap-2 rounded border bg-muted/20 px-2.5 py-2 text-xs">
          <div>${head.headType === 'PICKUP' ? '应领数量：' : '应交数量：'}<span class="font-medium">${head.qtyExpectedTotal} ${escapeHtml(head.qtyUnit)}</span></div>
          <div>${head.headType === 'PICKUP' ? '累计实领：' : '累计回写：'}<span class="font-medium">${head.qtyActualTotal} ${escapeHtml(head.qtyUnit)}</span></div>
          <div class="col-span-2 rounded-md border px-2 py-1 ${head.qtyDiffTotal !== 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}">
            ${head.qtyDiffTotal !== 0 ? `数量有差异（差异 ${escapeHtml(diffLabel)}）` : '数量一致'}
          </div>
        </div>

        ${head.headType === 'HANDOUT' ? renderHandoutObjectBlock(head) : ''}
      </div>
    </article>
  `
}

function renderEmptyState(message: string): string {
  return `<div class="py-10 text-center text-sm text-muted-foreground">${escapeHtml(message)}</div>`
}

export function renderPdaHandoverPage(): string {
  syncTabWithQuery()
  const selectedFactoryId = getCurrentFactoryId()
  const pickupHeads = getPdaPickupHeads(selectedFactoryId)
  const handoutHeads = getPdaHandoutHeads(selectedFactoryId)
  const doneHeads = getPdaCompletedHeads(selectedFactoryId)

  const donePickupCount = doneHeads.filter((head) => head.headType === 'PICKUP').length
  const doneHandoutCount = doneHeads.filter((head) => head.headType === 'HANDOUT').length

  const tabCounts: Record<HandoverTab, number> = {
    pickup: pickupHeads.length,
    handout: handoutHeads.length,
    done: doneHeads.length,
  }

  const content = `
    <div class="flex min-h-[760px] flex-col bg-background">
      <div class="shrink-0 px-4 pb-2 pt-4">
        <h1 class="mb-3 text-lg font-semibold">交接</h1>

        <div class="mb-3 grid grid-cols-3 gap-1.5">
          ${TAB_CONFIG.map((tab) => {
            const active = state.activeTab === tab.key
            return `
              <button
                class="${toClassName(
                  'rounded-lg border p-2 text-center transition-colors',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-transparent bg-muted/40',
                )}"
                data-pda-handover-action="switch-tab"
                data-tab="${tab.key}"
              >
                <p class="text-base font-bold tabular-nums">${tabCounts[tab.key]}</p>
                <p class="mt-0.5 text-[9px] leading-tight opacity-80">${escapeHtml(tab.label)}</p>
              </button>
            `
          }).join('')}
        </div>
      </div>

      <div class="flex-1 space-y-3 overflow-y-auto px-4 pb-4 pt-3">
        ${
          state.activeTab === 'pickup'
            ? `
              <p class="text-xs text-muted-foreground">仓库回写生成领料记录；交付后确认数量或发起差异。</p>
              ${
                pickupHeads.length === 0
                  ? renderEmptyState('暂无待领料头单')
                  : pickupHeads.map((head) => renderOpenHeadCard(head)).join('')
              }
            `
            : ''
        }

        ${
          state.activeTab === 'handout'
            ? `
              <p class="text-xs text-muted-foreground">一个任务对应一个交出头，交出记录由仓库收货后自动回写，工厂只查看交出详情。</p>
              ${
                handoutHeads.length === 0
                  ? renderEmptyState('暂无待交出头单')
                  : handoutHeads.map((head) => renderOpenHeadCard(head)).join('')
              }
            `
            : ''
        }

        ${
          state.activeTab === 'done'
            ? `
              <div class="grid grid-cols-2 gap-2 rounded border bg-muted/20 px-3 py-2 text-xs">
                <div>领料完成：<span class="font-medium">${donePickupCount}</span></div>
                <div>交出完成：<span class="font-medium">${doneHandoutCount}</span></div>
              </div>
              ${
                doneHeads.length === 0
                  ? renderEmptyState('暂无已完成头单')
                  : doneHeads.map((head) => renderDoneHeadCard(head)).join('')
              }
            `
            : ''
        }
      </div>
    </div>
  `

  return renderPdaFrame(content, 'handover')
}

export function handlePdaHandoverEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pda-handover-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaHandoverAction
  if (!action) return false

  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab as HandoverTab | undefined
    if (tab && TAB_CONFIG.some((item) => item.key === tab)) {
      state.activeTab = tab
      appStore.navigate(`/fcs/pda/handover?tab=${tab}`)
    }
    return true
  }

  if (action === 'open-detail') {
    const eventId = actionNode.dataset.eventId
    if (eventId) {
      appStore.navigate(resolvePdaHandoverDetailPath(eventId, appStore.getState().pathname))
    }
    return true
  }

  return false
}
