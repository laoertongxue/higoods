import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import { renderRealQrPlaceholder } from '../components/real-qr'
import { renderPdaFrame } from './pda-shell'
import {
  canCompletePdaHandoutHead,
  canCompletePdaPickupHead,
  deriveHandoutObjectProfile,
  findPdaHandoverHead,
  getPdaHandoverSourceDisplay,
  getPdaHandoverRecordsByHead,
  getPdaHandoutHeads,
  getPdaPostFinishingHandoutHeads,
  getPdaPostFinishingPickupHeads,
  getPdaPickupHeads,
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
  FULL_CAPABILITY_FACTORY_NAME,
  isPostFinishingFactoryId,
  listPostFinishingSkuOptions,
} from '../data/fcs/post-finishing-domain.ts'
import {
  listPostFinishingOutboundOrders,
  type PostFinishingOutboundOrder,
} from '../data/fcs/post-finishing-outbound-orders.ts'
import { activatePdaSewingSelfReturnMode } from '../data/fcs/pda-sewing-self-return-mode.ts'
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
  hasBindingProcessOrdersForFactory,
  resolveBindingProcessPdaScan,
  type BindingProcessPdaScanCandidate,
  type BindingProcessPdaScanPurpose,
} from '../data/fcs/binding-process-pda-scan.ts'
import {
  handlePdaWoolExecutionEvent,
  renderPdaWoolHandoverContent,
} from './pda-wool-fact-execution.ts'
import { KOL_GOTO_FACTORY_ID } from '../data/fcs/factory-mock-data.ts'
import { isKolGotoFactory, isKolGotoWholeOrderTask } from '../data/fcs/kol-goto-special-flow.ts'
import { ensureKolGotoPdaScenarios } from '../data/fcs/kol-goto-pda-domain.ts'
import { processTasks } from '../data/fcs/process-tasks.ts'
import {
  getPostFinishingMaterialTransferOrder,
  listPostFinishingMaterialTransferOrders,
  receivePostFinishingMaterialTransfer,
  type PostFinishingMaterialTransferOrder,
} from '../data/fcs/post-finishing-full-flow.ts'

type HandoverTab = 'pickup' | 'handout' | 'shipped'

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
  bindingScanKeyword: string
  bindingScanMessage: string
  bindingScanTone: 'info' | 'error'
  bindingScanCandidates: BindingProcessPdaScanCandidate[]
  bindingLastResolvedCode: string
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
  bindingScanKeyword: '',
  bindingScanMessage: '',
  bindingScanTone: 'info',
  bindingScanCandidates: [],
  bindingLastResolvedCode: '',
}

let specialCraftSeedScheduled = false
let materialInboundMessage = ''

const DEFAULT_TAB_CONFIG: Array<{ key: HandoverTab; label: string }> = [
  { key: 'pickup', label: '待接收' },
  { key: 'handout', label: '待交出' },
]

const POST_FINISHING_TAB_CONFIG: Array<{ key: HandoverTab; label: string }> = [
  { key: 'pickup', label: '待接收' },
  { key: 'shipped', label: '已交出' },
]

function getTabConfig(isPostFinishingFactory: boolean): Array<{ key: HandoverTab; label: string }> {
  return isPostFinishingFactory ? POST_FINISHING_TAB_CONFIG : DEFAULT_TAB_CONFIG
}

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return query || ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

function syncTabWithQuery(isPostFinishingFactory: boolean): void {
  const previousTab = state.activeTab
  const tab = getCurrentSearchParams().get('tab')
  const tabConfig = getTabConfig(isPostFinishingFactory)
  if (!tab || !tabConfig.some((item) => item.key === tab)) {
    state.activeTab = 'pickup'
  } else {
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
    state.bindingScanKeyword = ''
    state.bindingScanMessage = ''
    state.bindingScanCandidates = []
    state.bindingLastResolvedCode = ''
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

function isPhysicalScanWorkOrderHead(head: PdaHandoverHead): boolean {
  return head.processBusinessCode === 'SPECIAL_CRAFT'
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

function renderCompactOpenHeadCard(head: PdaHandoverHead): string {
  const meta = head.headType === 'PICKUP' ? getPickupSummaryMeta(head) : getHandoutSummaryMeta(head)
  const source = getPdaHandoverSourceDisplay(head)
  const receiverName = getReceiverDisplayName(head)
  const isPickup = head.headType === 'PICKUP'
  const profile = isPickup
    ? null
    : deriveHandoutObjectProfile(head, getPdaHandoverRecordsByHead(head.handoverId))
  const primaryValue = isPickup ? head.qtyExpectedTotal : profile?.totalPlannedQty || 0
  const actualValue = isPickup ? head.qtyActualTotal : profile?.totalWrittenQty || 0
  const pendingValue = isPickup
    ? Math.max(head.qtyExpectedTotal - head.qtyActualTotal, 0)
    : profile?.totalPendingQty || 0
  const unit = profile?.displayUnit || head.qtyUnit
  const canComplete = isPickup
    ? canCompletePdaPickupHead(head.handoverId).ok
    : canCompletePdaHandoutHead(head.handoverId).ok
  const action = isPickup || head.processBusinessCode === 'WOOL' || canComplete ? 'open-detail' : 'open-new-record'
  const actionLabel = isPickup
    ? canComplete ? '完成接收单' : '确认接收'
    : canComplete ? '完成交出单' : head.processBusinessCode === 'WOOL' ? '查看交出' : '发起交出'

  return `
    <article
      class="cursor-pointer rounded-xl border bg-card p-3 shadow-sm transition-colors hover:border-primary"
      data-testid="${isPickup ? 'pickup-head-card' : 'handout-head-card'}"
      data-pda-handover-action="open-detail"
      data-event-id="${escapeHtml(head.handoverId)}"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold">${escapeHtml(head.processName)}</div>
          <div class="mt-1 truncate text-xs text-muted-foreground">${escapeHtml(source.value)}</div>
        </div>
        <span class="shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${meta.className}">${escapeHtml(meta.label)}</span>
      </div>

      <div class="mt-3 flex items-center gap-2 text-xs">
        ${renderPartyChip('FACTORY', head.sourceFactoryName)}
        <i data-lucide="arrow-right" class="h-3.5 w-3.5 shrink-0 text-muted-foreground"></i>
        ${renderPartyChip(head.targetKind, receiverName)}
      </div>

      <div class="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/30 px-2 py-2 text-center text-xs">
        <div><div class="text-[10px] text-muted-foreground">${isPickup ? '应收' : '计划'}</div><div class="mt-1 font-semibold">${primaryValue} ${escapeHtml(unit)}</div></div>
        <div><div class="text-[10px] text-muted-foreground">${isPickup ? '已收' : '已确认'}</div><div class="mt-1 font-semibold">${actualValue} ${escapeHtml(unit)}</div></div>
        <div><div class="text-[10px] text-muted-foreground">${isPickup ? '待收' : '待确认'}</div><div class="mt-1 font-semibold ${pendingValue > 0 ? 'text-amber-700' : 'text-emerald-700'}">${pendingValue} ${escapeHtml(unit)}</div></div>
      </div>

      <button
        type="button"
        class="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
        data-pda-handover-action="${action}"
        data-event-id="${escapeHtml(head.handoverId)}"
      >${actionLabel}</button>
    </article>
  `
}

function renderEmptyState(message: string): string {
  return `<div class="py-10 text-center text-sm text-muted-foreground">${escapeHtml(message)}</div>`
}

function getKolGotoTaskByHead(head: PdaHandoverHead) {
  const task = processTasks.find((item) => item.taskId === (head.sourceTaskId || head.taskId))
  return isKolGotoWholeOrderTask(task) ? task : null
}

function renderKolGotoHandoverPage(): string {
  if (state.activeTab === 'pickup') state.activeTab = 'handout'
  const openHeads = getPdaHandoutHeads(KOL_GOTO_FACTORY_ID).filter((head) => Boolean(getKolGotoTaskByHead(head)))
  const content = `
    <div class="flex min-h-[760px] flex-col bg-background">
      <header class="border-b bg-blue-50 px-4 py-3"><h1 class="font-semibold text-blue-950">KOL 整单交接</h1><p class="mt-1 text-xs text-blue-700">这里只查看每次发起交出的现场事实。</p></header>
      <div class="grid grid-cols-1 border-b bg-background" data-testid="pda-handover-tabs">
        <button class="border-b-2 border-primary py-3 text-sm font-medium text-primary" data-pda-handover-action="switch-tab" data-tab="handout">待交出${openHeads.length ? ` <span class="rounded-full bg-muted px-1.5 text-[10px]">${openHeads.length}</span>` : ''}</button>
      </div>
      <main class="flex-1 space-y-3 p-4">
        ${openHeads.length === 0
          ? renderEmptyState('尚未发起交出，请在执行任务中操作')
          : openHeads.map((head) => {
              const task = getKolGotoTaskByHead(head)!
              const records = getPdaHandoverRecordsByHead(head.handoverId)
              const effectiveRecords = records.filter((record) => record.handoverRecordStatus !== 'VOIDED')
              const handedQty = effectiveRecords.reduce((sum, record) => sum + Number(record.submittedQty || 0), 0)
              return `<article class="rounded-xl border bg-card p-4"><div class="flex items-center justify-between gap-2"><div class="font-mono text-sm font-semibold">${escapeHtml(head.handoverOrderNo || head.handoverId)}</div><span class="rounded-full ${task.status === 'DONE' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'} px-2 py-1 text-[11px]">${task.status === 'DONE' ? '已完成' : '可继续交出'}</span></div><div class="mt-3 grid grid-cols-2 gap-2 text-xs"><div>生产单：<b>${escapeHtml(task.productionOrderNo || task.productionOrderId)}</b></div><div>有效交出：<b>${effectiveRecords.length} 次</b>${records.length !== effectiveRecords.length ? ` <span class="text-muted-foreground">（历史 ${records.length} 次）</span>` : ''}</div><div>任务数量：<b>${task.qty} ${escapeHtml(task.qtyDisplayUnit || '件')}</b></div><div>累计交出：<b>${handedQty} ${escapeHtml(task.qtyDisplayUnit || '件')}</b></div></div><div class="mt-3 space-y-1 rounded-lg bg-muted/50 p-3 text-xs">${records.map((record) => `<div class="${record.handoverRecordStatus === 'VOIDED' ? 'text-muted-foreground line-through' : ''}">第 ${record.sequenceNo} 次：${record.submittedQty} ${escapeHtml(record.qtyUnit || '件')} · ${escapeHtml(record.factorySubmittedAt)}${record.handoverRecordStatus === 'VOIDED' ? ' · 已作废（不计入累计）' : ''}</div>`).join('')}</div><button class="mt-3 h-10 w-full rounded-xl border text-sm font-medium" data-nav="/fcs/pda/exec/${escapeHtml(task.taskId)}">${task.status === 'DONE' ? '查看任务' : '返回任务继续处理'}</button></article>`
            }).join('')}
      </main>
    </div>`
  return renderPdaFrame(content, 'handover', { disableTodoAutoOpen: true })
}

function renderPostFinishingReturnReceivingPanel(canOpenSelfReturnMode: boolean): string {
  const pendingMaterialTransfers = listPostFinishingMaterialTransferOrders().filter((order) => order.status === '待入库')
  return `
    <section class="grid grid-cols-3 gap-2" data-pda-post-finishing-receiving data-testid="pda-pickup-entry-grid" aria-label="待接收功能入口">
      <button type="button" class="flex h-[68px] min-w-0 flex-col items-center justify-center rounded-xl bg-blue-600 px-1.5 text-center text-white shadow-sm" data-nav="/fcs/pda/post-finishing/return-confirm" data-pda-pickup-entry="return" aria-label="回货接收：扫描送货单点数确认">
        <i data-lucide="scan-line" class="h-4 w-4 shrink-0"></i>
        <span class="mt-1 text-[13px] font-semibold leading-4">回货接收</span>
        <span class="mt-0.5 truncate text-[10px] leading-3 text-blue-100">扫描送货单</span>
      </button>
      <button type="button" class="flex h-[68px] min-w-0 flex-col items-center justify-center rounded-xl border ${canOpenSelfReturnMode ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-amber-200 bg-amber-50 text-amber-800'} px-1.5 text-center shadow-sm" data-pda-handover-action="open-sewing-self-return-mode" data-pda-pickup-entry="self-return" aria-label="自助回货：开启车缝自助回货${canOpenSelfReturnMode ? '' : '，需管理员'}">
        <i data-lucide="user-round-check" class="h-4 w-4 shrink-0"></i>
        <span class="mt-1 text-[13px] font-semibold leading-4">自助回货</span>
        <span class="mt-0.5 truncate text-[10px] leading-3">${canOpenSelfReturnMode ? '开启登记' : '需管理员'}</span>
      </button>
      <button type="button" class="flex h-[68px] min-w-0 flex-col items-center justify-center rounded-xl border border-blue-200 bg-white px-1.5 text-center text-blue-800 shadow-sm" data-pda-handover-action="open-material-transfer-scan" data-pda-pickup-entry="material" data-skip-page-rerender="true" aria-label="辅料接收：扫描后道辅料待入库调拨单">
        <i data-lucide="package-check" class="h-4 w-4 shrink-0"></i>
        <span class="mt-1 text-[13px] font-semibold leading-4">辅料接收</span>
        <span class="mt-0.5 text-[10px] leading-3">待入库 ${pendingMaterialTransfers.length} 张</span>
      </button>
    </section>
    <div class="fixed inset-0 z-50 hidden items-end bg-black/40 p-3" data-pda-material-transfer-scan role="dialog" aria-modal="true" aria-labelledby="pda-material-transfer-scan-title">
      <button type="button" class="absolute inset-0" data-pda-handover-action="close-material-transfer-scan" data-skip-page-rerender="true" aria-label="关闭辅料接收"></button>
      <section class="relative z-10 w-full rounded-2xl bg-white p-4 shadow-xl">
        <div class="flex items-start justify-between gap-3">
          <div><h2 id="pda-material-transfer-scan-title" class="font-semibold">辅料接收</h2><p class="mt-1 text-xs text-muted-foreground">扫描或输入完整后道辅料调拨单号。</p></div>
          <button type="button" class="h-8 rounded-lg border px-3 text-xs" data-pda-handover-action="close-material-transfer-scan" data-skip-page-rerender="true">关闭</button>
        </div>
        <div class="mt-3 flex gap-2">
          <input class="h-11 min-w-0 flex-1 rounded-xl border px-3 font-mono text-sm" placeholder="DB-PF-…" data-pda-handover-field="materialTransferNo"/>
          <button type="button" class="shrink-0 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white" data-pda-handover-action="scan-material-transfer">查询</button>
        </div>
        <p class="mt-2 text-[11px] text-muted-foreground">只接受完整单号，不提供模糊候选。</p>
      </section>
    </div>
  `
}

function renderPostFinishingMaterialTransferCard(order: PostFinishingMaterialTransferOrder): string {
  const total = order.lines.reduce((sum, line) => sum + line.preparedQty, 0)
  return `<article class="rounded-xl border bg-card p-3 shadow-sm" data-pda-material-transfer-card="${escapeHtml(order.transferOrderNo)}"><div class="flex items-start justify-between gap-3"><div><div class="font-mono text-sm font-semibold">${escapeHtml(order.transferOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.productionOrderNo)} · ${escapeHtml(order.styleNo)}</div></div><span class="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] text-blue-700">${escapeHtml(order.status)}</span></div><div class="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/30 px-2 py-2 text-center text-xs"><div><div class="text-[10px] text-muted-foreground">物料</div><div class="mt-1 font-semibold">${order.lines.length} 种</div></div><div><div class="text-[10px] text-muted-foreground">调出方实配</div><div class="mt-1 font-semibold">${total}</div></div><div><div class="text-[10px] text-muted-foreground">目标库位</div><div class="mt-1 truncate font-semibold">${escapeHtml(order.targetLocationCode)}</div></div></div><a data-nav="/fcs/pda/handover?tab=pickup&materialOrderNo=${encodeURIComponent(order.transferOrderNo)}" class="mt-3 flex h-10 w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white">查看并整单入库</a></article>`
}

function renderPostFinishingMaterialTransfersPanel(): string {
  const pending = listPostFinishingMaterialTransferOrders().filter((order) => order.status === '待入库')
  return `<section class="space-y-2" data-pda-material-transfer-list><div class="flex items-center justify-between"><h2 class="text-sm font-semibold">后道辅料待入库</h2><span class="rounded-full bg-blue-50 px-2 py-1 text-[10px] text-blue-700">${pending.length} 张</span></div>${pending.length ? pending.map(renderPostFinishingMaterialTransferCard).join('') : '<div class="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">暂无待入库的后道辅料调拨单</div>'}</section>`
}

function renderPostFinishingMaterialTransferDetail(order: PostFinishingMaterialTransferOrder): string {
  const runtime = getPdaRuntimeContext()!
  const body = `<div class="flex min-h-[760px] flex-col bg-slate-100"><header class="sticky top-0 z-20 border-b bg-white px-4 py-3"><div class="flex items-center gap-3"><a data-nav="/fcs/pda/handover?tab=pickup" class="inline-flex h-9 items-center rounded-xl border px-3 text-sm">← 返回</a><div><div class="text-[11px] text-slate-500">后道辅料整单入库 · ${escapeHtml(runtime.userName)}</div><h1 class="font-semibold">确认辅料入库</h1></div></div></header><main class="flex-1 space-y-3 p-4">${materialInboundMessage ? `<div class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">${escapeHtml(materialInboundMessage)}</div>` : ''}<section class="rounded-2xl border bg-white p-4"><div class="flex items-start justify-between gap-3"><div><div class="font-mono font-semibold">${escapeHtml(order.transferOrderNo)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(order.productionOrderNo)} · ${escapeHtml(order.styleNo)}</div></div><span class="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">${escapeHtml(order.status)}</span></div><div class="mt-3 text-xs text-slate-600">${escapeHtml(order.sourceWarehouseName)} → ${escapeHtml(order.targetWarehouseName)}</div><div class="mt-1 text-xs text-slate-600">入库位置：${escapeHtml(order.targetAreaName)} / ${escapeHtml(order.targetLocationCode)}</div></section><section class="overflow-hidden rounded-2xl border bg-white"><div class="border-b px-4 py-3"><h2 class="font-semibold">物料明细</h2><p class="mt-1 text-xs text-slate-500">数量以调出方实际配料为准，不分批、不修改。</p></div>${order.lines.map((line) => `<div class="flex gap-3 border-b p-3 last:border-b-0"><button type="button" class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-slate-50" data-pda-image-preview-url="${escapeHtml(line.imageUrl)}" data-pda-image-preview-title="${escapeHtml(`${line.materialCode} ${line.materialName}`)}" data-skip-page-rerender="true"><img src="${escapeHtml(line.imageUrl)}" alt="${escapeHtml(`${line.materialName} 物料图`)}" class="h-full w-full object-cover" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button><div class="min-w-0 flex-1"><div class="text-sm font-semibold">${escapeHtml(line.materialName)}</div><div class="mt-1 break-all font-mono text-[11px] text-slate-500">${escapeHtml(line.materialCode)}</div><div class="mt-1 font-mono text-[11px] text-slate-500">SPU ${escapeHtml(line.materialSpuCode)}</div><div class="mt-1 text-xs text-slate-600">${escapeHtml(line.specification)}</div></div><div class="shrink-0 text-right"><div class="font-semibold">${line.preparedQty} ${escapeHtml(line.unit)}</div><div class="mt-1 text-[10px] text-slate-500">调出方实配</div></div></div>`).join('')}</section>${order.status === '待入库' ? `<button type="button" class="h-12 w-full rounded-2xl bg-blue-600 text-base font-semibold text-white" data-pda-handover-action="confirm-material-inbound" data-material-order-no="${escapeHtml(order.transferOrderNo)}">确认全部物料已领回并整单入库</button>` : '<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">该调拨单已整单入库。</div>'}</main></div>`
  return renderPdaFrame(body, 'handover', { disableTodoAutoOpen: true })
}

function renderPostFinishingOutboundLine(order: PostFinishingOutboundOrder, line: PostFinishingOutboundOrder['lines'][number]): string {
  const imageTitle = `${line.spuCode} / ${line.skuCode}`
  const imageUrl = line.skuImageUrl
    || listPostFinishingSkuOptions(line.spuCode).find((item) => item.skuCode === line.skuCode)?.imageUrl
    || ''
  return `<div class="flex gap-2.5 border-t px-3 py-2.5" data-pda-post-outbound-line="${escapeHtml(line.outboundLineId)}">
    ${imageUrl
      ? `<button type="button" class="flex h-14 w-14 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border bg-muted/30" data-pda-image-preview-url="${escapeHtml(imageUrl)}" data-pda-image-preview-title="${escapeHtml(imageTitle)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(imageTitle)}大图"><img class="h-full w-full object-cover" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(`${line.spuName} ${line.colorName} ${line.sizeName}`)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>`
      : '<div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border bg-muted/30 px-1 text-center text-[10px] text-amber-700">暂无款式图</div>'}
    <div class="min-w-0 flex-1 text-xs">
      <div class="truncate font-semibold">${escapeHtml(line.spuCode)} · ${escapeHtml(line.spuName)}</div>
      <div class="mt-1 break-all font-mono text-[11px]">${escapeHtml(line.skuCode)}</div>
      <div class="mt-1 text-muted-foreground">${escapeHtml(line.colorName)} / ${escapeHtml(line.sizeName)}</div>
    </div>
    <div class="shrink-0 text-right text-xs"><div class="font-semibold">${line.plannedQty} ${escapeHtml(line.qtyUnit)}</div><div class="mt-1 text-[10px] text-muted-foreground">交出数量</div></div>
  </div>`
}

function renderPostFinishingOutboundCard(order: PostFinishingOutboundOrder): string {
  const statusClass = order.status === '已确认'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-amber-200 bg-amber-50 text-amber-800'
  return `<article class="overflow-hidden rounded-xl border bg-card shadow-sm" data-pda-post-outbound-card="${escapeHtml(order.outboundOrderNo)}">
    <div class="p-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0"><div class="font-mono text-sm font-semibold">${escapeHtml(order.outboundOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.productionOrderNo)} · ${escapeHtml(order.recheckOrderNo)}</div></div>
        <span class="shrink-0 rounded-full border px-2 py-1 text-[10px] ${statusClass}">${escapeHtml(order.status)}</span>
      </div>
      <div class="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/30 px-2 py-2 text-center text-xs">
        <div><div class="text-[10px] text-muted-foreground">SKU</div><div class="mt-1 font-semibold">${order.lines.length} 个</div></div>
        <div><div class="text-[10px] text-muted-foreground">已交出</div><div class="mt-1 font-semibold">${order.outboundQty} ${escapeHtml(order.qtyUnit)}</div></div>
        <div><div class="text-[10px] text-muted-foreground">成衣仓确认</div><div class="mt-1 font-semibold">${order.inboundQty} ${escapeHtml(order.qtyUnit)}</div></div>
      </div>
      <div class="mt-2 text-[11px] text-muted-foreground">${escapeHtml(order.createdAt)} · ${escapeHtml(order.operatorName)}</div>
    </div>
    <details data-pda-post-outbound-details>
      <summary class="cursor-pointer list-none border-t px-3 py-2.5 text-xs font-medium text-blue-700"><span class="flex items-center justify-between"><span>查看出货 SKU 明细</span><i data-lucide="chevron-down" class="h-4 w-4"></i></span></summary>
      <div>${order.lines.map((line) => renderPostFinishingOutboundLine(order, line)).join('')}</div>
    </details>
  </article>`
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

function buildSpecialCraftHandoverWorkOrderPath(workOrderId: string): string {
  const handoverAction = state.activeTab === 'pickup' ? 'receive' : 'handout'
  const returnTo = `/fcs/pda/handover?tab=${state.activeTab}`
  return `/fcs/pda/exec/SPECIAL_CRAFT/${encodeURIComponent(workOrderId)}?surface=handover&handoverAction=${handoverAction}&returnTo=${encodeURIComponent(returnTo)}`
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
    <button type="button" class="mt-3 h-10 w-full rounded bg-primary text-sm font-medium text-primary-foreground" data-pda-handover-action="select-special-craft-order" data-source-type="${candidate.sourceType}" data-work-order-id="${escapeHtml(candidate.workOrderId)}" data-source-task-id="${escapeHtml(candidate.sourceTaskId)}">选择此加工单</button>
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
      <div class="text-sm font-semibold text-blue-950">扫码${isReceive ? '确认接收' : '发起交出'}</div>
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
    appStore.navigate(buildSpecialCraftHandoverWorkOrderPath(result.candidates[0].workOrderId))
  }
}

function updateSpecialCraftHandoverScanFeedbackInPlace(): void {
  const target = document.querySelector<HTMLElement>('[data-pda-handover-special-craft-scan-feedback]')
  if (target) target.outerHTML = renderSpecialCraftHandoverScanFeedback()
}

function getBindingScanPurpose(tab: HandoverTab): BindingProcessPdaScanPurpose | null {
  if (tab === 'pickup') return 'RECEIVE'
  if (tab === 'handout') return 'HANDOVER'
  return null
}

function buildBindingHandoverWorkOrderPath(workOrderId: string): string {
  const handoverAction = state.activeTab === 'pickup' ? 'receive' : 'handout'
  const returnTo = `/fcs/pda/handover?tab=${state.activeTab}`
  return `/fcs/pda/exec/BINDING_PROCESS_ORDER/${encodeURIComponent(workOrderId)}?surface=handover&handoverAction=${handoverAction}&returnTo=${encodeURIComponent(returnTo)}`
}

function renderBindingScanCandidate(candidate: BindingProcessPdaScanCandidate): string {
  const { order } = candidate
  return `<article class="rounded-lg border bg-background p-3" data-pda-binding-scan-candidate><div class="text-xs"><div class="font-semibold">${escapeHtml(order.bindingOrderNo)}</div><div class="mt-1 text-muted-foreground">生产单：${escapeHtml(order.sourceProductionOrderNo)}</div><div class="mt-1">${escapeHtml(order.materialIdentity.materialSku)} · ${order.bindingSpecificationCount} 个规格 · ${order.plannedOutputQty} 米</div></div><button type="button" class="mt-3 h-10 w-full rounded bg-primary text-sm font-medium text-primary-foreground" data-pda-handover-action="select-binding-order" data-source-type="${candidate.sourceType}" data-work-order-id="${escapeHtml(candidate.workOrderId)}">选择此捆条加工单</button></article>`
}

function renderBindingHandoverScanFeedback(): string {
  const message = state.bindingScanMessage
    ? `<div class="rounded border px-3 py-2 text-xs ${state.bindingScanTone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-800'}">${escapeHtml(state.bindingScanMessage)}</div>`
    : ''
  const candidates = state.bindingScanCandidates.length
    ? `<div class="space-y-2">${state.bindingScanCandidates.map(renderBindingScanCandidate).join('')}</div>`
    : ''
  return `<div class="mt-3 space-y-2" data-pda-handover-binding-scan-feedback>${message}${candidates}</div>`
}

function renderBindingHandoverScanPanel(): string {
  const purpose = getBindingScanPurpose(state.activeTab)
  if (!purpose) return ''
  const isReceive = purpose === 'RECEIVE'
  return `<section class="rounded-xl border border-blue-200 bg-blue-50/70 p-3" data-pda-handover-binding-scan><div class="flex items-start gap-2"><i data-lucide="scan-line" class="mt-0.5 h-5 w-5 shrink-0 text-blue-700"></i><div class="text-sm font-semibold text-blue-950">扫码${isReceive ? '接收捆条面料' : '交出加工后捆条'}</div></div><div class="mt-3 flex gap-2"><input class="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" placeholder="扫描捆条加工单 / 菲票" data-pda-handover-field="bindingScanKeyword" data-pda-scan-enter="true" data-skip-page-rerender="true" value="${escapeHtml(state.bindingScanKeyword)}"><button type="button" class="h-10 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-handover-action="scan-binding-order">识别加工单</button></div>${renderBindingHandoverScanFeedback()}</section>`
}

function runBindingHandoverScan(rawCode: string): void {
  const purpose = getBindingScanPurpose(state.activeTab)
  if (!purpose) return
  state.bindingLastResolvedCode = rawCode.trim()
  const result = resolveBindingProcessPdaScan(rawCode, getCurrentFactoryId(), purpose)
  state.bindingScanMessage = result.message
  state.bindingScanTone = result.status === 'MATCH' || result.status === 'MULTIPLE' ? 'info' : 'error'
  state.bindingScanCandidates = result.candidates
  if (result.status === 'MATCH') appStore.navigate(buildBindingHandoverWorkOrderPath(result.candidates[0].workOrderId))
}

function updateBindingHandoverScanFeedbackInPlace(): void {
  const target = document.querySelector<HTMLElement>('[data-pda-handover-binding-scan-feedback]')
  if (target) target.outerHTML = renderBindingHandoverScanFeedback()
}

export function renderPdaHandoverPage(): string {
  const runtime = getPdaRuntimeContext()
  if (!runtime) {
    return renderPdaLoginRedirect()
  }

  const selectedFactoryId = getCurrentFactoryId()
  const isPostFinishingFactory = isPostFinishingFactoryId(selectedFactoryId)
  syncTabWithQuery(isPostFinishingFactory)
  const materialOrderNo = getCurrentSearchParams().get('materialOrderNo') || ''
  const selectedMaterialOrder = materialOrderNo ? getPostFinishingMaterialTransferOrder(materialOrderNo) : undefined
  if (isPostFinishingFactory && selectedMaterialOrder) return renderPostFinishingMaterialTransferDetail(selectedMaterialOrder)
  if (isKolGotoFactory(selectedFactoryId)) {
    ensureKolGotoPdaScenarios()
    return renderKolGotoHandoverPage()
  }
  const hasWoolOrders = hasWoolOrdersForFactory(selectedFactoryId)
  const hasBindingOrders = hasBindingProcessOrdersForFactory(selectedFactoryId)
  const hasSpecialCraftOrders = hasSpecialCraftOrdersForFactory(selectedFactoryId)
  const canManageSewingSelfReturnMode = isPostFinishingFactory && runtime.roleId === 'ROLE_ADMIN'
  if (!isPostFinishingFactory) {
    scheduleSpecialCraftHandoverSeed()
  }
  const pickupHeads = isPostFinishingFactory
    ? getPdaPostFinishingPickupHeads().filter((head) => head.pickupSourceType !== 'SEWING_SELF_RETURN')
    : getPdaPickupHeads(selectedFactoryId)
  const visiblePickupHeads = pickupHeads.filter((head) => !isPhysicalScanWorkOrderHead(head))
  const factoryWoolHandoutHeads = getPdaHandoutHeads(selectedFactoryId)
    .filter((head) => head.processBusinessCode === 'WOOL')
  const handoutHeads = isPostFinishingFactory
    ? mergeHandoverHeadsById(getPdaPostFinishingHandoutHeads(), factoryWoolHandoutHeads)
    : getPdaHandoutHeads(selectedFactoryId)
  const visibleHandoutHeads = handoutHeads.filter((head) => !isPhysicalScanWorkOrderHead(head))
  const shippedOrders = isPostFinishingFactory
    ? listPostFinishingOutboundOrders().filter((order) => (
        order.managedPostFactoryName === FULL_CAPABILITY_FACTORY_NAME
        || isPostFinishingFactoryId(order.managedPostFactoryId)
      ))
    : []
  const tabConfig = getTabConfig(isPostFinishingFactory)

  const tabCounts: Record<HandoverTab, number> = {
    pickup: visiblePickupHeads.length + (isPostFinishingFactory ? listPostFinishingMaterialTransferOrders().filter((order) => order.status === '待入库').length : 0),
    handout: visibleHandoutHeads.length,
    shipped: shippedOrders.length,
  }

// 裁床中转袋交接状态：待装袋 / 待收中转袋
  const content = `
    <div class="flex min-h-[760px] flex-col bg-background">
      <div class="sticky top-[auto] z-20 flex border-b bg-background" data-testid="pda-handover-tabs">
        ${tabConfig.map((tab) => {
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
        ${hasBindingOrders ? renderBindingHandoverScanPanel() : ''}
        ${hasWoolOrders ? renderWoolHandoverScanPanel() : ''}
        ${hasWoolOrders ? renderSelectedWoolHandoverOrder() : ''}
        ${hasSpecialCraftOrders ? renderSpecialCraftHandoverScanPanel() : ''}
        ${isPostFinishingFactory && state.activeTab === 'pickup' ? renderPostFinishingReturnReceivingPanel(canManageSewingSelfReturnMode) : ''}
        ${isPostFinishingFactory && state.activeTab === 'pickup' ? renderPostFinishingMaterialTransfersPanel() : ''}
        ${
          state.activeTab === 'pickup'
            ? `
              ${
                visiblePickupHeads.length === 0
                  ? renderEmptyState(hasWoolOrders || hasSpecialCraftOrders || hasBindingOrders ? '可先扫码确认接收；暂无其他待处理接收单' : '暂无待处理接收单')
                  : visiblePickupHeads.map((head) => renderCompactOpenHeadCard(head)).join('')
              }
            `
            : ''
        }

        ${
          state.activeTab === 'handout'
            ? `
              ${
                visibleHandoutHeads.length === 0
                  ? renderEmptyState(hasWoolOrders || hasSpecialCraftOrders || hasBindingOrders ? '可先扫码发起交出；暂无其他待处理交出单' : '暂无待处理交出单')
                  : visibleHandoutHeads.map((head) => renderCompactOpenHeadCard(head)).join('')
              }
            `
            : ''
        }

        ${
          state.activeTab === 'shipped'
            ? `
              <section class="rounded-xl border border-blue-100 bg-blue-50/60 p-3" data-pda-post-shipped-note>
                <div class="text-sm font-semibold text-blue-950">已交出记录</div>
                <p class="mt-1 text-xs leading-5 text-blue-700">与 Web“后道出货单”共用同一组单据；此处只查看，不再发起交出。</p>
              </section>
              ${shippedOrders.length === 0
                ? renderEmptyState('暂无已生成的后道出货单')
                : shippedOrders.map(renderPostFinishingOutboundCard).join('')}
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

  const bindingFieldNode = target.closest<HTMLInputElement>('[data-pda-handover-field="bindingScanKeyword"]')
  if (bindingFieldNode) {
    state.bindingScanKeyword = bindingFieldNode.value
    if (event?.type === 'keydown' && (event as KeyboardEvent).key === 'Enter') {
      runBindingHandoverScan(bindingFieldNode.value)
      return true
    }
    if (bindingFieldNode.value.trim() !== state.bindingLastResolvedCode) {
      state.bindingScanMessage = ''
      state.bindingScanCandidates = []
      updateBindingHandoverScanFeedbackInPlace()
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

  if (action === 'open-material-transfer-scan') {
    const dialog = document.querySelector<HTMLElement>('[data-pda-material-transfer-scan]')
    dialog?.classList.remove('hidden')
    dialog?.classList.add('flex')
    window.setTimeout(() => dialog?.querySelector<HTMLInputElement>('[data-pda-handover-field="materialTransferNo"]')?.focus(), 0)
    return true
  }

  if (action === 'close-material-transfer-scan') {
    const dialog = document.querySelector<HTMLElement>('[data-pda-material-transfer-scan]')
    dialog?.classList.add('hidden')
    dialog?.classList.remove('flex')
    return true
  }

  if (action === 'scan-material-transfer') {
    const input = document.querySelector<HTMLInputElement>('[data-pda-material-transfer-scan] [data-pda-handover-field="materialTransferNo"]')
    const raw = input?.value.trim() || ''
    const record = getPostFinishingMaterialTransferOrder(raw)
    if (!raw || !record || record.transferOrderNo !== raw) {
      window.alert('未找到完整后道辅料调拨单号，不提供模糊候选。')
      return false
    }
    if (record.status !== '待入库') {
      window.alert(`该调拨单当前为${record.status}，只有待入库调拨单可执行整单入库。`)
      return false
    }
    materialInboundMessage = ''
    appStore.navigate(`/fcs/pda/handover?tab=pickup&materialOrderNo=${encodeURIComponent(record.transferOrderNo)}`)
    return true
  }

  if (action === 'confirm-material-inbound') {
    const runtime = getPdaRuntimeContext()
    if (!runtime || !isPostFinishingFactoryId(runtime.factoryId)) {
      window.alert('当前账号不属于后道工厂，不能确认辅料入库。')
      return true
    }
    if (!window.confirm('确认已领回本单全部物料，并按调出方实配数量一次性入库？入库后不支持分批修改。')) return true
    try {
      const result = receivePostFinishingMaterialTransfer({
        transferOrderNo: actionNode.dataset.materialOrderNo || '',
        actor: { actorId: runtime.userId, actorName: runtime.userName, roleName: '后道仓管' },
      })
      materialInboundMessage = result.alreadyInbound ? '该调拨单已入库，无需重复提交。' : '整单入库成功，辅料库存已按调出方实配数量登记。'
      appStore.navigate(`/fcs/pda/handover?tab=pickup&materialOrderNo=${encodeURIComponent(result.transfer.transferOrderNo)}&refresh=${Date.now()}`)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '辅料入库失败，请重新核对。')
    }
    return true
  }

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

  if (action === 'scan-binding-order') {
    const input = document.querySelector<HTMLInputElement>('[data-pda-handover-binding-scan] [data-pda-handover-field="bindingScanKeyword"]')
    state.bindingScanKeyword = input?.value || state.bindingScanKeyword
    runBindingHandoverScan(state.bindingScanKeyword)
    return true
  }

  if (action === 'select-binding-order') {
    const workOrderId = actionNode.dataset.workOrderId
    if (workOrderId) appStore.navigate(buildBindingHandoverWorkOrderPath(workOrderId))
    return true
  }

  if (action === 'select-special-craft-order') {
    const workOrderId = actionNode.dataset.workOrderId
    if (workOrderId) appStore.navigate(buildSpecialCraftHandoverWorkOrderPath(workOrderId))
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
    if (isKolGotoFactory(getCurrentFactoryId()) && tab === 'pickup') return true
    const tabConfig = getTabConfig(isPostFinishingFactoryId(getCurrentFactoryId()))
    if (tab && tabConfig.some((item) => item.key === tab)) {
      state.activeTab = tab
      state.woolScanKeyword = ''
      state.woolScanMessage = ''
      state.woolScanCandidates = []
      state.woolLastResolvedCode = ''
      state.specialCraftScanKeyword = ''
      state.specialCraftScanMessage = ''
      state.specialCraftScanCandidates = []
      state.specialCraftLastResolvedCode = ''
      state.bindingScanKeyword = ''
      state.bindingScanMessage = ''
      state.bindingScanCandidates = []
      state.bindingLastResolvedCode = ''
      appStore.navigate(`/fcs/pda/handover?tab=${tab}`)
    }
    return true
  }

  if (action === 'open-sewing-self-return-mode') {
    if (!isCurrentPdaAdmin()) {
      window.alert('请由后道工厂管理员开启车缝自助回货。')
      return true
    }
    const runtime = getPdaRuntimeContext()
    if (!runtime || !isPostFinishingFactoryId(runtime.factoryId)) {
      window.alert('当前账号不属于后道工厂，不能开启车缝自助回货。')
      return true
    }
    activatePdaSewingSelfReturnMode({
      factoryId: runtime.factoryId,
      factoryName: runtime.factoryName,
      openedBy: runtime.userName,
    })
    appStore.navigate('/fcs/pda/handover/sewing-self-return')
    return true
  }

  if (action === 'open-detail') {
    const eventId = actionNode.dataset.eventId
    if (eventId) {
      const head = findPdaHandoverHead(eventId)
      const kolTask = head ? getKolGotoTaskByHead(head) : null
      if (kolTask) {
        appStore.navigate(`/fcs/pda/exec/${kolTask.taskId}`)
        return true
      }
      appStore.navigate(resolvePdaHandoverDetailPath(eventId, appStore.getState().pathname))
    }
    return true
  }

  if (action === 'open-new-record') {
    const eventId = actionNode.dataset.eventId
    if (eventId) {
      const head = findPdaHandoverHead(eventId)
      if (head && getKolGotoTaskByHead(head)) {
        appStore.navigate(`/fcs/pda/exec/${head.sourceTaskId || head.taskId}`)
        return true
      }
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
