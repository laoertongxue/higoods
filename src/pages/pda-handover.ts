import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import { renderRealQrPlaceholder } from '../components/real-qr'
import { renderPdaFrame } from './pda-shell'
import {
  deriveHandoutObjectProfile,
  findPdaHandoverHead,
  getPdaHandoverSourceDisplay,
  getPdaCompletedHeads,
  getPdaHandoverRecordsByHead,
  getPdaHandoutHeads,
  getPdaPostFinishingCompletedHeads,
  getPdaPostFinishingHandoutHeads,
  getPdaPostFinishingPickupHeads,
  getPdaPickupHeads,
  syncAllPostFinishingSewingSelfReturnHandoverRecords,
  type PdaHandoverHead,
} from '../data/fcs/pda-handover-events'
import {
  getHandoverOrderQrDisplayValue,
  getHandoverOrderStatusLabel,
  getReceiverDisplayName,
  getReceiverKindLabel,
} from '../data/fcs/task-handover-domain'
import { resolvePdaHandoverDetailPath } from '../data/fcs/pda-cutting-execution-source.ts'
import {
  ensurePdaSessionForAction,
  getPdaRuntimeContext,
  renderPdaLoginRedirect,
} from './pda-runtime'
import {
  FULL_CAPABILITY_FACTORY_ID,
  ensurePostFinishingSewingSelfReturnMockRecords,
  listPostFinishingSewingSelfReturnRecords,
} from '../data/fcs/post-finishing-domain.ts'
import { listWoolWorkOrders } from '../data/fcs/wool-task-domain.ts'
import {
  resolveWoolPdaScan,
  type WoolPdaScanCandidate,
  type WoolPdaScanPurpose,
} from '../data/fcs/wool-pda-scan.ts'
import {
  hasSpecialCraftOrdersForFactory,
  resolveSpecialCraftPdaScan,
  type SpecialCraftPdaScanCandidate,
  type SpecialCraftPdaScanPurpose,
} from '../data/fcs/special-craft-pda-scan.ts'
import {
  handlePdaWoolExecutionEvent,
  renderPdaWoolHandoverContent,
} from './pda-wool-fact-execution.ts'

type HandoverTab = 'pickup' | 'handout' | 'done'

interface PdaHandoverState {
  selectedFactoryId: string
  activeTab: HandoverTab
  woolScanKeyword: string
  woolScanMessage: string
  woolScanTone: 'info' | 'error'
  woolScanCandidates: WoolPdaScanCandidate[]
  woolLastResolvedCode: string
  selectedWoolTaskId: string
  specialCraftScanKeyword: string
  specialCraftScanMessage: string
  specialCraftScanTone: 'info' | 'error'
  specialCraftScanCandidates: SpecialCraftPdaScanCandidate[]
  specialCraftLastResolvedCode: string
}

const state: PdaHandoverState = {
  selectedFactoryId: '',
  activeTab: 'pickup',
  woolScanKeyword: '',
  woolScanMessage: '',
  woolScanTone: 'info',
  woolScanCandidates: [],
  woolLastResolvedCode: '',
  selectedWoolTaskId: '',
  specialCraftScanKeyword: '',
  specialCraftScanMessage: '',
  specialCraftScanTone: 'info',
  specialCraftScanCandidates: [],
  specialCraftLastResolvedCode: '',
}

let specialCraftSeedScheduled = false

const TAB_CONFIG: Array<{ key: HandoverTab; label: string }> = [
  { key: 'pickup', label: '待接收' },
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
  const previousTab = state.activeTab
  const tab = getCurrentSearchParams().get('tab')
  if (!tab) {
    state.activeTab = 'pickup'
  } else if (TAB_CONFIG.some((item) => item.key === tab)) {
    state.activeTab = tab as HandoverTab
  }
  if (state.activeTab !== previousTab) {
    state.woolScanKeyword = ''
    state.woolScanMessage = ''
    state.woolScanCandidates = []
    state.woolLastResolvedCode = ''
    state.specialCraftScanKeyword = ''
    state.specialCraftScanMessage = ''
    state.specialCraftScanCandidates = []
    state.specialCraftLastResolvedCode = ''
  }
  state.selectedWoolTaskId = getCurrentSearchParams().get('taskId') || ''
}

function getCurrentFactoryId(): string {
  const runtime = getPdaRuntimeContext()
  state.selectedFactoryId = runtime?.factoryId ?? ''
  return state.selectedFactoryId
}

export function mergeHandoverHeadsById(...groups: PdaHandoverHead[][]): PdaHandoverHead[] {
  const headsById = new Map<string, PdaHandoverHead>()
  groups.flat().forEach((head) => headsById.set(head.handoverId, head))
  const businessTime = (head: PdaHandoverHead): number => {
    const timestamps = [head.lastRecordAt, head.completedByWarehouseAt]
      .map((value) => value ? new Date(value.replace(' ', 'T')).getTime() : 0)
      .filter(Number.isFinite)
    return timestamps.length > 0 ? Math.max(...timestamps) : 0
  }
  return [...headsById.values()]
    .sort((left, right) => businessTime(right) - businessTime(left))
}

function renderPartyChip(kind: PdaHandoverHead['targetKind'], name: string): string {
  return `
    <span class="inline-flex items-center gap-1 text-xs">
      <i data-lucide="${kind === 'WAREHOUSE' ? 'warehouse' : 'factory'}" class="h-3 w-3 shrink-0 text-muted-foreground"></i>
      <span>${escapeHtml(name)}</span>
    </span>
  `
}

function isPostFinishingPickupHead(head: PdaHandoverHead): boolean {
  return head.headType === 'PICKUP' && head.processBusinessCode === 'POST_FINISHING' && head.targetKind === 'FACTORY'
}

function isCurrentPdaAdmin(): boolean {
  return getPdaRuntimeContext()?.roleId === 'ROLE_ADMIN'
}

function isSewingSelfReturnPickupHead(head: PdaHandoverHead): boolean {
  return isPostFinishingPickupHead(head) && head.pickupSourceType === 'SEWING_SELF_RETURN'
}

function getPickupSourceBadge(head: PdaHandoverHead): { label: string; className: string } {
  if (isSewingSelfReturnPickupHead(head)) {
    return {
      label: '车缝自助回货',
      className: 'border-blue-200 bg-blue-50 text-blue-700',
    }
  }
  return {
    label: '正常接收',
    className: 'border-slate-200 bg-slate-50 text-slate-700',
  }
}

function getPickupPartyDisplay(head: PdaHandoverHead): {
  sourceLabel: string
  sourceKind: PdaHandoverHead['targetKind']
  targetLabel: string
  targetKind: PdaHandoverHead['targetKind']
} {
  if (isPostFinishingPickupHead(head)) {
    return {
      sourceLabel: '来源车缝厂',
      sourceKind: 'FACTORY',
      targetLabel: '后道工厂',
      targetKind: 'FACTORY',
    }
  }
  return {
    sourceLabel: '来源仓库',
    sourceKind: 'WAREHOUSE',
    targetLabel: '接收工厂',
    targetKind: head.targetKind,
  }
}

function getExecutorLabel(head: PdaHandoverHead): string {
  if (head.executorKind === 'WAREHOUSE_WORKSHOP') return '仓内后道'
  return '外部工厂'
}

function getHandoverSourceTypeLabel(head: PdaHandoverHead): string {
  if (head.sourceBusinessType === 'WATER_SOLUBLE_WORK_ORDER') return '水溶加工单'
  if (head.sourceBusinessType === 'DYE_WORK_ORDER') return '染色加工单'
  return '工序任务'
}

function renderHandoverSourceField(head: PdaHandoverHead): string {
  const source = getPdaHandoverSourceDisplay(head)
  return `<div><span class="text-muted-foreground">${source.label}：</span>${escapeHtml(source.value)}</div>`
}

function scheduleSpecialCraftHandoverSeed(): void {
  if (specialCraftSeedScheduled || typeof window === 'undefined') return
  specialCraftSeedScheduled = true

  window.setTimeout(async () => {
    try {
      const module = await import('../data/fcs/cutting/special-craft-fei-ticket-flow.ts')
      module.ensureSpecialCraftFeiTicketFlowSeeded()
      window.dispatchEvent(new CustomEvent('higood:request-render'))
    } catch (error) {
      specialCraftSeedScheduled = false
      console.warn('特殊工艺交接数据预热失败', error)
    }
  }, 0)
}

function getPickupSummaryMeta(head: PdaHandoverHead): { label: string; className: string; hint: string } {
  if (head.summaryStatus === 'NONE') {
    return {
      label: '暂无仓库接收记录',
      className: 'border-border bg-background text-muted-foreground',
      hint: '接收记录由仓库配料送料后生成',
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
      hint: '有接收记录已发起数量差异，等待平台处理',
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
    hint: '接收记录已确认/裁定完成，等待完成接收单',
  }
}

function getHandoutSummaryMeta(head: PdaHandoverHead): { label: string; className: string; hint: string } {
  if (head.summaryStatus === 'NONE') {
    return {
      label: '暂无交出记录',
      className: 'border-border bg-background text-muted-foreground',
      hint: '当前可新增交出记录，也可按交出对象数量完成交出单',
    }
  }
  if (head.summaryStatus === 'SUBMITTED') {
    return {
      label: '待收货确认',
      className: 'border-blue-200 bg-blue-50 text-blue-700',
      hint: '等待接收方确认本次实收数量',
    }
  }
  if (head.summaryStatus === 'PARTIAL_WRITTEN_BACK') {
    return {
      label: '部分收货',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
      hint: '仍有记录待接收方确认收货',
    }
  }
  if (head.summaryStatus === 'HAS_OBJECTION') {
    return {
      label: '存在数量异议',
      className: 'border-red-200 bg-red-50 text-red-700',
      hint: '异议可继续处理，交出单仍可按交出对象数量完成',
    }
  }
  return {
    label: '全部收货',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    hint: '收货确认已完成，可继续关闭交出单',
  }
}

function renderHandoutQrBlock(head: PdaHandoverHead, objectTypeLabel: string, size: number): string {
  const qrValue = getHandoverOrderQrDisplayValue(head)
  if (!qrValue) return ''

  return `
    <div data-testid="handout-head-qr" class="shrink-0 rounded-md border bg-white p-1.5">
      ${renderRealQrPlaceholder({
        value: qrValue,
        size,
        title: `交出单二维码 ${head.handoverId}`,
        label: `交出单 ${head.handoverId} 二维码`,
      })}
      <div class="mt-1 space-y-0.5 text-[10px] leading-tight text-muted-foreground">
        <div>交出单号：${escapeHtml(head.handoverOrderNo || head.handoverId)}</div>
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
    : '<div>当前暂无交出记录</div>'

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
  const headLabel = head.headType === 'PICKUP' ? '接收单' : '交出单'
  const selfReturnPickup = head.headType === 'PICKUP' && isSewingSelfReturnPickupHead(head)
  const actionLabel = head.headType === 'PICKUP' ? (selfReturnPickup ? '确认回货' : '查看来料单') : '查看交出单'

  if (head.headType === 'PICKUP') {
    const partyDisplay = getPickupPartyDisplay(head)
    const sourceBadge = getPickupSourceBadge(head)
    const pickupHint =
      head.objectionCount > 0
        ? `有 ${head.objectionCount} 条记录在处理差异`
        : head.pendingWritebackCount > 0
          ? selfReturnPickup
            ? `还有 ${head.pendingWritebackCount} 条车缝自助回货待确认`
            : `还有 ${head.pendingWritebackCount} 条记录待处理`
          : '当前等待完成接收单'

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
              <span class="inline-flex shrink-0 items-center rounded border px-1.5 py-0 text-[10px] ${sourceBadge.className}">${escapeHtml(sourceBadge.label)}</span>
              <span class="inline-flex shrink-0 items-center rounded border px-1.5 py-0 text-[10px] ${meta.className}">${escapeHtml(meta.label)}</span>
            </div>
            <i data-lucide="chevron-right" class="h-4 w-4 shrink-0 text-muted-foreground"></i>
          </div>

          <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            <div><span class="text-muted-foreground">任务编号：</span>${escapeHtml(head.taskNo)}</div>
            ${renderHandoverSourceField(head)}
            <div class="col-span-2"><span class="text-muted-foreground">当前工序：</span>${escapeHtml(head.processName)}</div>
            ${selfReturnPickup ? `<div class="col-span-2"><span class="text-muted-foreground">自助回货单：</span>${escapeHtml(head.sourceDocNo || '—')}</div>` : ''}
          </div>

          <div class="flex items-center gap-2 py-0.5 text-xs">
            <span class="shrink-0 text-muted-foreground">${partyDisplay.sourceLabel}：</span>
            ${renderPartyChip(partyDisplay.sourceKind, head.sourceFactoryName)}
            <i data-lucide="arrow-right" class="h-3 w-3 shrink-0 text-muted-foreground"></i>
            <span class="shrink-0 text-muted-foreground">${partyDisplay.targetLabel}：</span>
            ${renderPartyChip(partyDisplay.targetKind, head.targetName)}
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

  const receiverName = getReceiverDisplayName(head)
  const receiverKindLabel = getReceiverKindLabel(head.receiverKind)
  const orderStatusLabel = getHandoverOrderStatusLabel(head.handoverOrderStatus || head.status)

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
          <div><span class="text-muted-foreground">交出单号：</span>${escapeHtml(head.handoverOrderNo || head.handoverId)}</div>
          <div><span class="text-muted-foreground">原始任务：</span>${escapeHtml(head.rootTaskNo || head.taskNo)}</div>
          ${renderHandoverSourceField(head)}
          <div><span class="text-muted-foreground">当前工序：</span>${escapeHtml(head.processName)}</div>
          <div><span class="text-muted-foreground">状态：</span>${escapeHtml(orderStatusLabel)}</div>
          <div><span class="text-muted-foreground">交接范围：</span>${escapeHtml(head.scopeLabel || '整单')}</div>
          <div><span class="text-muted-foreground">交接方式：</span>${escapeHtml(getExecutorLabel(head))}</div>
          <div class="col-span-2"><span class="text-muted-foreground">来源单据：</span>${escapeHtml(head.sourceDocNo || '—')}</div>
          <div><span class="text-muted-foreground">来源类型：</span>${escapeHtml(getHandoverSourceTypeLabel(head))}</div>
          ${head.sourceBusinessType === 'WATER_SOLUBLE_WORK_ORDER' ? `<div><span class="text-muted-foreground">物料：</span>${escapeHtml(`${head.materialName || '—'} / ${head.materialCode || '—'}`)}</div>` : ''}
        </div>

        <div class="flex items-center gap-2 py-0.5 text-xs">
          <span class="shrink-0 text-muted-foreground">交出工厂：</span>
          ${renderPartyChip('FACTORY', head.sourceFactoryName)}
          <i data-lucide="arrow-right" class="h-3 w-3 shrink-0 text-muted-foreground"></i>
          <span class="shrink-0 text-muted-foreground">接收方：</span>
          ${renderPartyChip(head.targetKind, receiverName)}
          <span class="inline-flex items-center rounded border border-border bg-background px-1.5 py-0 text-[10px] text-muted-foreground">${escapeHtml(receiverKindLabel)}</span>
        </div>

        <div class="grid grid-cols-2 gap-2 rounded border bg-muted/20 px-2.5 py-2 text-xs">
          <div>记录数：<span class="font-medium">${head.recordCount} 条</span></div>
          <div>待收货：<span class="font-medium">${head.pendingWritebackCount} 条</span></div>
          <div>已交出：<span class="font-medium">${head.submittedQtyTotal ?? 0} ${escapeHtml(head.qtyUnit)}</span></div>
          <div>已收货：<span class="font-medium">${head.writtenBackQtyTotal ?? 0} ${escapeHtml(head.qtyUnit)}</span></div>
          <div>差异：<span class="font-medium ${head.qtyDiffTotal !== 0 ? 'text-red-600' : ''}">${head.qtyDiffTotal > 0 ? '-' : head.qtyDiffTotal < 0 ? '+' : ''}${Math.abs(head.qtyDiffTotal)} ${escapeHtml(head.qtyUnit)}</span></div>
          <div>异议：<span class="font-medium">${head.objectionCount} 条</span></div>
        </div>

        ${renderHandoutObjectBlock(head, true)}

        <div class="text-[10px] text-muted-foreground">${escapeHtml(meta.hint)}</div>

        <div class="mt-1 grid ${head.processBusinessCode === 'WOOL' ? 'grid-cols-1' : 'grid-cols-2'} gap-2">
          <button
            class="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            data-pda-handover-action="open-detail"
            data-event-id="${escapeHtml(head.handoverId)}"
          >${actionLabel}</button>
          ${head.processBusinessCode === 'WOOL'
            ? ''
            : `<button
                class="inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium hover:bg-muted"
                data-pda-handover-action="open-new-record"
                data-event-id="${escapeHtml(head.handoverId)}"
              >新增交出记录</button>`}
        </div>
      </div>
    </article>
  `
}

function renderDoneHeadCard(head: PdaHandoverHead): string {
  const doneTypeLabel = head.headType === 'PICKUP' ? '接收单已完成' : '交出单已完成'
  const diffLabel = `${head.qtyDiffTotal > 0 ? '-' : head.qtyDiffTotal < 0 ? '+' : ''}${Math.abs(head.qtyDiffTotal)} ${head.qtyUnit}`
  const receiverName = getReceiverDisplayName(head)

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
            <span class="inline-flex shrink-0 items-center rounded border border-border bg-muted px-1.5 py-0 text-[10px]">${head.headType === 'HANDOUT' && !head.receiverClosedAt ? '接收方确认中' : '已完成'}</span>
          </div>
          <i data-lucide="chevron-right" class="h-4 w-4 shrink-0 text-muted-foreground"></i>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          <div><span class="text-muted-foreground">任务编号：</span>${escapeHtml(head.taskNo)}</div>
          <div><span class="text-muted-foreground">原始任务：</span>${escapeHtml(head.rootTaskNo || head.taskNo)}</div>
          ${renderHandoverSourceField(head)}
          <div><span class="text-muted-foreground">当前工序：</span>${escapeHtml(head.processName)}</div>
          <div><span class="text-muted-foreground">完成时间：</span>${escapeHtml(head.completedByWarehouseAt || '—')}</div>
          <div><span class="text-muted-foreground">交接范围：</span>${escapeHtml(head.scopeLabel || '整单')}</div>
          <div><span class="text-muted-foreground">交接方式：</span>${escapeHtml(getExecutorLabel(head))}</div>
          <div class="col-span-2"><span class="text-muted-foreground">${head.headType === 'PICKUP' ? '接收单号' : '交出单号'}：</span>${escapeHtml(head.headType === 'PICKUP' ? head.handoverId : head.handoverOrderNo || head.handoverId)}</div>
        </div>

        <div class="grid grid-cols-2 gap-2 rounded border bg-muted/20 px-2.5 py-2 text-xs">
          <div>${head.headType === 'PICKUP' ? '应领对象数量：' : '已交出：'}<span class="font-medium">${head.headType === 'PICKUP' ? head.qtyExpectedTotal : head.submittedQtyTotal ?? 0} ${escapeHtml(head.qtyUnit)}</span></div>
          <div>${head.headType === 'PICKUP' ? '累计实领：' : '已收货：'}<span class="font-medium">${head.qtyActualTotal} ${escapeHtml(head.qtyUnit)}</span></div>
          <div class="col-span-2 rounded-md border px-2 py-1 ${head.qtyDiffTotal !== 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}">
            ${head.qtyDiffTotal !== 0 ? `数量有差异（差异 ${escapeHtml(diffLabel)}）` : '数量一致'}
          </div>
        </div>

        ${
          head.headType === 'HANDOUT'
            ? `
              <div class="flex items-center gap-2 py-0.5 text-xs">
                <span class="shrink-0 text-muted-foreground">接收方：</span>
                ${renderPartyChip(head.targetKind, receiverName)}
              </div>
            `
            : ''
        }
        ${head.headType === 'HANDOUT' ? renderHandoutObjectBlock(head) : ''}
      </div>
    </article>
  `
}

function renderEmptyState(message: string): string {
  return `<div class="py-10 text-center text-sm text-muted-foreground">${escapeHtml(message)}</div>`
}

function renderPostFinishingSewingSelfReturnPanel(): string {
  const records = listPostFinishingSewingSelfReturnRecords()
  const pendingCount = records.filter((record) => record.status === '待后道确认').length
  return `
    <section class="rounded-2xl border border-blue-100 bg-blue-50/60 px-3 py-3 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-blue-950">车缝现场交货登记模式</h2>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
          data-pda-handover-action="open-sewing-self-return-mode"
        >开启</button>
      </div>
      <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div class="rounded-xl bg-white px-2 py-2"><div class="font-semibold">${records.length}</div><div class="text-blue-700">自助记录</div></div>
        <div class="rounded-xl bg-white px-2 py-2"><div class="font-semibold">${pendingCount}</div><div class="text-blue-700">待确认</div></div>
        <div class="rounded-xl bg-white px-2 py-2"><div class="font-semibold">固定</div><div class="text-blue-700">暂存库位</div></div>
      </div>
      <div class="mt-3 space-y-2">
        ${records.slice(0, 3).map((record) => `
          <div class="rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs leading-5">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-blue-950">${escapeHtml(record.recordNo)}</span>
              <span class="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">${escapeHtml(record.status)}</span>
            </div>
            <div class="mt-1 text-blue-700">${escapeHtml(record.sourceFactoryName)} · ${escapeHtml(record.productionOrderNo)} · ${record.items.length} 个 SKU</div>
            <div class="text-blue-600">默认入库：${escapeHtml(record.defaultWarehouseName)} / ${escapeHtml(record.defaultAreaName)} / ${escapeHtml(record.defaultLocationCode)}</div>
          </div>
        `).join('') || '<div class="rounded-xl bg-white px-3 py-3 text-center text-xs text-blue-700">暂无车缝自助回货记录</div>'}
      </div>
    </section>
  `
}

function getWoolScanPurpose(tab: HandoverTab): WoolPdaScanPurpose | null {
  if (tab === 'pickup') return 'RECEIVE'
  if (tab === 'handout') return 'HANDOVER'
  return null
}

function hasWoolOrdersForFactory(factoryId: string): boolean {
  return listWoolWorkOrders().some((order) => order.factoryId === factoryId)
}

function renderWoolScanCandidate(candidate: WoolPdaScanCandidate): string {
  const order = candidate.order
  const imageUrl = /^(?:https?:\/\/|\/|data:image\/)/i.test(order.styleImageUrl?.trim() || '')
    ? order.styleImageUrl!.trim()
    : ''
  const outputSummary = order.outputPlanLines
    .map((line) => [line.colorName, line.sizeCode, line.woolPartName].filter(Boolean).join('/'))
    .filter(Boolean)
    .join('、') || '待核对加工对象'
  const imageTitle = `${order.styleNo} · ${order.styleName}`
  return `<article class="rounded-lg border bg-background p-3" data-pda-wool-scan-candidate>
    <div class="flex gap-3">
      ${imageUrl ? `<button type="button" class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/30" data-pda-image-preview-url="${escapeHtml(imageUrl)}" data-pda-image-preview-title="${escapeHtml(imageTitle)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(imageTitle)}大图"><img class="h-full w-full object-cover" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(`${order.styleName}款式图片`)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>` : '<div class="flex h-16 w-16 shrink-0 items-center justify-center rounded border bg-muted/30"><span class="px-1 text-center text-[10px] text-muted-foreground">暂无款式图</span></div>'}
      <div class="min-w-0 flex-1 text-xs">
        <div class="font-semibold">${escapeHtml(order.woolOrderNo)}</div>
        <div class="mt-1 text-muted-foreground">生产单：${escapeHtml(order.productionOrderNo)}</div>
        <div class="mt-1">${escapeHtml(order.styleNo)} · ${escapeHtml(outputSummary)}</div>
      </div>
    </div>
    <button type="button" class="mt-3 h-10 w-full rounded bg-primary text-sm font-medium text-primary-foreground" data-pda-handover-action="select-wool-order" data-task-id="${escapeHtml(order.taskId)}">选择此加工单</button>
  </article>`
}

function renderWoolHandoverScanFeedback(): string {
  const message = state.woolScanMessage
    ? `<div class="rounded border px-3 py-2 text-xs ${state.woolScanTone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-800'}">${escapeHtml(state.woolScanMessage)}</div>`
    : ''
  const candidates = state.woolScanCandidates.length > 0
    ? `<div class="space-y-2">${state.woolScanCandidates.map(renderWoolScanCandidate).join('')}</div>`
    : ''
  return `<div class="mt-3 space-y-2" data-pda-handover-wool-scan-feedback>${message}${candidates}</div>`
}

function renderWoolHandoverScanPanel(): string {
  const purpose = getWoolScanPurpose(state.activeTab)
  if (!purpose) return ''
  const isReceive = purpose === 'RECEIVE'
  return `<section class="rounded-xl border border-blue-200 bg-blue-50/70 p-3" data-pda-handover-wool-scan>
    <div class="flex items-start gap-2">
      <i data-lucide="scan-line" class="mt-0.5 h-5 w-5 shrink-0 text-blue-700"></i>
      <div><div class="text-sm font-semibold text-blue-950">扫码${isReceive ? '确认接收' : '发起交出'}</div><div class="mt-1 text-xs text-blue-800">优先扫描生产单码或毛织加工单码；一个生产单有多张加工单时再选择。</div></div>
    </div>
    <div class="mt-3 flex gap-2">
      <input
        class="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
        placeholder="扫描生产单 / 加工单"
        data-pda-handover-field="woolScanKeyword"
        data-pda-scan-enter="true"
        data-skip-page-rerender="true"
        value="${escapeHtml(state.woolScanKeyword)}"
      />
      <button type="button" class="h-10 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-handover-action="scan-wool-order">识别加工单</button>
    </div>
    <div class="mt-2 text-[11px] text-blue-700">“交接”只处理毛织确认接收和发起交出。</div>
    ${renderWoolHandoverScanFeedback()}
  </section>`
}

function renderSelectedWoolHandoverOrder(): string {
  if (!state.selectedWoolTaskId) return ''
  const mode = state.activeTab === 'pickup' ? 'RECEIVE' : 'HANDOVER'
  return `<section class="overflow-hidden rounded-xl border bg-background" data-pda-selected-wool-order>
    <div class="flex items-center justify-between border-b bg-muted/20 px-4 py-3">
      <span class="text-sm font-semibold">已识别加工单</span>
      <button type="button" class="rounded border px-3 py-1 text-xs" data-pda-handover-action="clear-wool-order">重新扫码</button>
    </div>
    ${renderPdaWoolHandoverContent(state.selectedWoolTaskId, mode)}
  </section>`
}

function runWoolHandoverScan(rawCode: string): void {
  const purpose = getWoolScanPurpose(state.activeTab)
  if (!purpose) return
  state.woolLastResolvedCode = rawCode.trim()
  const result = resolveWoolPdaScan(rawCode, getCurrentFactoryId(), purpose)
  state.woolScanMessage = result.message
  state.woolScanTone = result.status === 'MATCH' || result.status === 'MULTIPLE' ? 'info' : 'error'
  state.woolScanCandidates = result.candidates
  if (result.status === 'MATCH') {
    state.woolScanMessage = ''
    state.woolScanCandidates = []
    appStore.navigate(`/fcs/pda/handover?tab=${state.activeTab}&taskId=${encodeURIComponent(result.candidates[0].order.taskId)}`)
  }
}

function updateWoolHandoverScanFeedbackInPlace(): void {
  const target = document.querySelector<HTMLElement>('[data-pda-handover-wool-scan-feedback]')
  if (target) target.outerHTML = renderWoolHandoverScanFeedback()
}

function getSpecialCraftScanPurpose(tab: HandoverTab): SpecialCraftPdaScanPurpose | null {
  if (tab === 'pickup') return 'RECEIVE'
  if (tab === 'handout') return 'HANDOVER'
  return null
}

function buildSpecialCraftHandoverTaskPath(taskId: string): string {
  const handoverAction = state.activeTab === 'pickup' ? 'receive' : 'handout'
  const returnTo = `/fcs/pda/handover?tab=${state.activeTab}`
  return `/fcs/pda/exec/${encodeURIComponent(taskId)}?surface=handover&handoverAction=${handoverAction}&returnTo=${encodeURIComponent(returnTo)}`
}

function renderSpecialCraftScanCandidate(candidate: SpecialCraftPdaScanCandidate): string {
  const { order } = candidate
  const imageTitle = `${candidate.styleNo} · ${candidate.styleName}`
  return `<article class="rounded-lg border bg-background p-3" data-pda-special-craft-scan-candidate>
    <div class="flex gap-3">
      ${candidate.styleImageUrl ? `<button type="button" class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/30" data-pda-image-preview-url="${escapeHtml(candidate.styleImageUrl)}" data-pda-image-preview-title="${escapeHtml(imageTitle)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(imageTitle)}大图"><img class="h-full w-full object-cover" src="${escapeHtml(candidate.styleImageUrl)}" alt="${escapeHtml(imageTitle)}款式图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>` : '<div class="flex h-16 w-16 shrink-0 items-center justify-center rounded border bg-muted/30"><span class="px-1 text-center text-[10px] text-muted-foreground">款式图缺失</span></div>'}
      <div class="min-w-0 flex-1 text-xs">
        <div class="font-semibold">${escapeHtml(order.taskOrderNo)}</div>
        <div class="mt-1 text-muted-foreground">生产单：${escapeHtml(order.productionOrderNo)}</div>
        <div class="mt-1">${escapeHtml(order.operationName)} · ${escapeHtml(order.targetObject)} · ${order.planQty} ${escapeHtml(order.unit)}</div>
      </div>
    </div>
    <button type="button" class="mt-3 h-10 w-full rounded bg-primary text-sm font-medium text-primary-foreground" data-pda-handover-action="select-special-craft-order" data-task-id="${escapeHtml(candidate.taskId)}">选择此加工单</button>
  </article>`
}

function renderSpecialCraftHandoverScanFeedback(): string {
  const message = state.specialCraftScanMessage
    ? `<div class="rounded border px-3 py-2 text-xs ${state.specialCraftScanTone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-800'}">${escapeHtml(state.specialCraftScanMessage)}</div>`
    : ''
  const candidates = state.specialCraftScanCandidates.length > 0
    ? `<div class="space-y-2">${state.specialCraftScanCandidates.map(renderSpecialCraftScanCandidate).join('')}</div>`
    : ''
  return `<div class="mt-3 space-y-2" data-pda-handover-special-craft-scan-feedback>${message}${candidates}</div>`
}

function renderSpecialCraftHandoverScanPanel(): string {
  const purpose = getSpecialCraftScanPurpose(state.activeTab)
  if (!purpose) return ''
  const isReceive = purpose === 'RECEIVE'
  return `<section class="rounded-xl border border-blue-200 bg-blue-50/70 p-3" data-pda-handover-special-craft-scan>
    <div class="flex items-start gap-2">
      <i data-lucide="scan-line" class="mt-0.5 h-5 w-5 shrink-0 text-blue-700"></i>
      <div><div class="text-sm font-semibold text-blue-950">扫码${isReceive ? '确认接收' : '发起交出'}</div><div class="mt-1 text-xs text-blue-800">优先扫描生产单码或加工单码；一个生产单有多张加工单时再选择。</div></div>
    </div>
    <div class="mt-3 flex gap-2">
      <input
        class="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
        placeholder="扫描生产单 / 加工单"
        data-pda-handover-field="specialCraftScanKeyword"
        data-pda-scan-enter="true"
        data-skip-page-rerender="true"
        value="${escapeHtml(state.specialCraftScanKeyword)}"
      />
      <button type="button" class="h-10 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-handover-action="scan-special-craft-order">识别加工单</button>
    </div>
    <div class="mt-2 text-[11px] text-blue-700">“交接”只处理确认接收和发起交出。</div>
    ${renderSpecialCraftHandoverScanFeedback()}
  </section>`
}

function runSpecialCraftHandoverScan(rawCode: string): void {
  const purpose = getSpecialCraftScanPurpose(state.activeTab)
  if (!purpose) return
  state.specialCraftLastResolvedCode = rawCode.trim()
  const result = resolveSpecialCraftPdaScan(rawCode, getCurrentFactoryId(), purpose)
  state.specialCraftScanMessage = result.message
  state.specialCraftScanTone = result.status === 'MATCH' || result.status === 'MULTIPLE' ? 'info' : 'error'
  state.specialCraftScanCandidates = result.candidates
  if (result.status === 'MATCH') {
    appStore.navigate(buildSpecialCraftHandoverTaskPath(result.candidates[0].taskId))
  }
}

function updateSpecialCraftHandoverScanFeedbackInPlace(): void {
  const target = document.querySelector<HTMLElement>('[data-pda-handover-special-craft-scan-feedback]')
  if (target) target.outerHTML = renderSpecialCraftHandoverScanFeedback()
}

export function renderPdaHandoverPage(): string {
  const runtime = getPdaRuntimeContext()
  if (!runtime) {
    return renderPdaLoginRedirect()
  }

  syncTabWithQuery()
  const selectedFactoryId = getCurrentFactoryId()
  const hasWoolOrders = hasWoolOrdersForFactory(selectedFactoryId)
  const hasSpecialCraftOrders = hasSpecialCraftOrdersForFactory(selectedFactoryId)
  const isPostFinishingFactory = selectedFactoryId === FULL_CAPABILITY_FACTORY_ID
  const canManageSewingSelfReturnMode = isPostFinishingFactory && runtime.roleId === 'ROLE_ADMIN'
  if (!isPostFinishingFactory) {
    scheduleSpecialCraftHandoverSeed()
  }
  if (isPostFinishingFactory) {
    ensurePostFinishingSewingSelfReturnMockRecords()
  }
  syncAllPostFinishingSewingSelfReturnHandoverRecords()
  const pickupHeads = isPostFinishingFactory ? getPdaPostFinishingPickupHeads() : getPdaPickupHeads(selectedFactoryId)
  const factoryWoolHandoutHeads = getPdaHandoutHeads(selectedFactoryId)
    .filter((head) => head.processBusinessCode === 'WOOL')
  const factoryWoolCompletedHeads = getPdaCompletedHeads(selectedFactoryId)
    .filter((head) => head.processBusinessCode === 'WOOL')
  const handoutHeads = isPostFinishingFactory
    ? mergeHandoverHeadsById(getPdaPostFinishingHandoutHeads(), factoryWoolHandoutHeads)
    : getPdaHandoutHeads(selectedFactoryId)
  const doneHeads = isPostFinishingFactory
    ? mergeHandoverHeadsById(getPdaPostFinishingCompletedHeads(), factoryWoolCompletedHeads)
    : getPdaCompletedHeads(selectedFactoryId)

  const tabCounts: Record<HandoverTab, number> = {
    pickup: pickupHeads.length,
    handout: handoutHeads.length,
    done: doneHeads.length,
  }

// 裁床中转袋交接状态：待装袋 / 待收中转袋
  const content = `
    <div class="flex min-h-[760px] flex-col bg-background">
      <div class="sticky top-[auto] z-20 flex border-b bg-background" data-testid="pda-handover-tabs">
        ${TAB_CONFIG.map((tab) => {
          const active = state.activeTab === tab.key
          return `
            <button
              class="flex-1 border-b-2 py-2.5 text-xs font-medium transition-colors ${toClassName(
                active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
              )}"
              data-pda-handover-action="switch-tab"
              data-tab="${tab.key}"
            >
              ${escapeHtml(tab.label)}
              ${
                tabCounts[tab.key] > 0
                  ? `<span class="ml-1 inline-block rounded-full px-1.5 py-0 text-[10px] leading-4 ${toClassName(
                      active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}">${tabCounts[tab.key]}</span>`
                  : ''
              }
            </button>
          `
        }).join('')}
      </div>

      <div class="flex-1 space-y-3 overflow-y-auto p-4">
        ${hasWoolOrders && state.activeTab !== 'done' ? renderWoolHandoverScanPanel() : ''}
        ${hasWoolOrders && state.activeTab !== 'done' ? renderSelectedWoolHandoverOrder() : ''}
        ${hasSpecialCraftOrders && state.activeTab !== 'done' ? renderSpecialCraftHandoverScanPanel() : ''}
        ${canManageSewingSelfReturnMode && state.activeTab === 'pickup' ? renderPostFinishingSewingSelfReturnPanel() : ''}
        ${
          state.activeTab === 'pickup'
            ? `
              ${
                pickupHeads.length === 0
                  ? renderEmptyState(hasWoolOrders || hasSpecialCraftOrders ? '可先扫码确认接收；暂无其他待处理接收单' : '暂无待处理接收单')
                  : pickupHeads.map((head) => renderOpenHeadCard(head)).join('')
              }
            `
            : ''
        }

        ${
          state.activeTab === 'handout'
            ? `
              ${
                handoutHeads.length === 0
                  ? renderEmptyState(hasWoolOrders || hasSpecialCraftOrders ? '可先扫码发起交出；暂无其他待处理交出单' : '暂无待处理交出单')
                  : handoutHeads.map((head) => renderOpenHeadCard(head)).join('')
              }
            `
            : ''
        }

        ${
          state.activeTab === 'done'
            ? `
              ${
                doneHeads.length === 0
                  ? renderEmptyState('暂无已完成交接单')
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

export function handlePdaHandoverEvent(target: HTMLElement, event?: Event): boolean {
  if (!ensurePdaSessionForAction()) return true
  if (handlePdaWoolExecutionEvent(target)) return true

  const specialCraftFieldNode = target.closest<HTMLInputElement>('[data-pda-handover-field="specialCraftScanKeyword"]')
  if (specialCraftFieldNode) {
    state.specialCraftScanKeyword = specialCraftFieldNode.value
    if (event?.type === 'keydown' && (event as KeyboardEvent).key === 'Enter') {
      runSpecialCraftHandoverScan(specialCraftFieldNode.value)
      return true
    }
    if (specialCraftFieldNode.value.trim() !== state.specialCraftLastResolvedCode) {
      state.specialCraftScanMessage = ''
      state.specialCraftScanCandidates = []
      updateSpecialCraftHandoverScanFeedbackInPlace()
    }
    return true
  }

  const fieldNode = target.closest<HTMLInputElement>('[data-pda-handover-field="woolScanKeyword"]')
  if (fieldNode) {
    state.woolScanKeyword = fieldNode.value
    if (event?.type === 'keydown' && (event as KeyboardEvent).key === 'Enter') {
      runWoolHandoverScan(fieldNode.value)
      return true
    }
    if (fieldNode.value.trim() !== state.woolLastResolvedCode) {
      state.woolScanMessage = ''
      state.woolScanCandidates = []
      updateWoolHandoverScanFeedbackInPlace()
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-handover-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaHandoverAction
  if (!action) return false

  if (action === 'scan-wool-order') {
    const input = document.querySelector<HTMLInputElement>('[data-pda-handover-wool-scan] [data-pda-handover-field="woolScanKeyword"]')
    state.woolScanKeyword = input?.value || state.woolScanKeyword
    runWoolHandoverScan(state.woolScanKeyword)
    return true
  }

  if (action === 'scan-special-craft-order') {
    const input = document.querySelector<HTMLInputElement>('[data-pda-handover-special-craft-scan] [data-pda-handover-field="specialCraftScanKeyword"]')
    state.specialCraftScanKeyword = input?.value || state.specialCraftScanKeyword
    runSpecialCraftHandoverScan(state.specialCraftScanKeyword)
    return true
  }

  if (action === 'select-special-craft-order') {
    const taskId = actionNode.dataset.taskId
    if (taskId) appStore.navigate(buildSpecialCraftHandoverTaskPath(taskId))
    return true
  }

  if (action === 'select-wool-order') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      state.woolScanKeyword = ''
      state.woolScanMessage = ''
      state.woolScanCandidates = []
      state.woolLastResolvedCode = ''
      appStore.navigate(`/fcs/pda/handover?tab=${state.activeTab}&taskId=${encodeURIComponent(taskId)}`)
    }
    return true
  }

  if (action === 'clear-wool-order') {
    state.woolScanKeyword = ''
    state.woolScanMessage = ''
    state.woolScanCandidates = []
    state.woolLastResolvedCode = ''
    appStore.navigate(`/fcs/pda/handover?tab=${state.activeTab}`)
    return true
  }

  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab as HandoverTab | undefined
    if (tab && TAB_CONFIG.some((item) => item.key === tab)) {
      state.activeTab = tab
      state.woolScanKeyword = ''
      state.woolScanMessage = ''
      state.woolScanCandidates = []
      state.woolLastResolvedCode = ''
      state.specialCraftScanKeyword = ''
      state.specialCraftScanMessage = ''
      state.specialCraftScanCandidates = []
      state.specialCraftLastResolvedCode = ''
      appStore.navigate(`/fcs/pda/handover?tab=${tab}`)
    }
    return true
  }

  if (action === 'open-sewing-self-return-mode') {
    if (!isCurrentPdaAdmin()) {
      window.alert('只有后道工厂管理员可以开启车缝现场交货登记模式。')
      return true
    }
    appStore.navigate('/fcs/pda/handover/sewing-self-return')
    return true
  }

  if (action === 'open-detail') {
    const eventId = actionNode.dataset.eventId
    if (eventId) {
      appStore.navigate(resolvePdaHandoverDetailPath(eventId, appStore.getState().pathname))
    }
    return true
  }

  if (action === 'open-new-record') {
    const eventId = actionNode.dataset.eventId
    if (eventId) {
      const head = findPdaHandoverHead(eventId)
      if (head?.processBusinessCode === 'WOOL') {
        appStore.navigate(resolvePdaHandoverDetailPath(eventId, appStore.getState().pathname))
        return true
      }
      appStore.navigate(`${resolvePdaHandoverDetailPath(eventId, appStore.getState().pathname)}?action=new-record`)
    }
    return true
  }

  return false
}
