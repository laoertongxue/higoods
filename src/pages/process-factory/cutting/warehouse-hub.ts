import {
  listCuttingSpecialCraftDispatchViews,
  listCuttingSpecialCraftReturnViews,
} from '../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import {
  type CuttingSewingDispatchBatch,
  type HandoverPickingTask,
  type HandoverPickingTaskProjection,
  type CuttingSewingDispatchValidationResult,
  type SewingTaskAllocationProjection,
  buildHandoverPickingTaskProjectionFromAllocationProjection,
  buildSewingTaskAllocationProjectionFromInventory,
  getCuttingSewingDispatchBatchHandoverSummary,
  getCuttingSewingDispatchSummary,
  listAvailableCutPieceInventoryForSewingDispatch,
  listCuttingSewingDispatchBatches,
  listCuttingSewingDispatchOrders,
  listCuttingSewingDispatchValidationResults,
  listCuttingSewingTransferBags,
} from '../../../data/fcs/cutting/sewing-dispatch.ts'
import {
  listSpreadingResultGeneratedFeiTickets,
  type GeneratedFeiTicketSourceRecord,
} from '../../../data/fcs/cutting/generated-fei-tickets.ts'
import {
  buildHandoverAfterRecordResult,
  buildSpecialCraftHandoverGroups,
  buildSpecialCraftReturnProjection,
  buildUniversalHandoverProjection,
  type SpecialCraftHandoverGroup,
  type SpecialCraftReturnInventoryRecord,
  type SpecialCraftReturnProjection,
  type SpecialCraftReturnRecord,
} from '../../../data/fcs/cutting/handover-orders.ts'
import { listMaterialLedgerProjections, type MaterialLedgerProjection } from '../../../data/fcs/cutting/material-ledger.ts'
import { escapeHtml } from '../../../utils.ts'
import { buildCutPieceWarehouseProjection } from './cut-piece-warehouse-projection.ts'
import type { CutPieceWarehouseItem } from './cut-piece-warehouse-model.ts'
import { buildFabricWarehouseProjection } from './fabric-warehouse-projection.ts'
import { renderCompactKpiCard, renderStickyTableScroller } from './layout.helpers.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta.ts'
import { buildTransferBagsProjection } from './transfer-bags-projection.ts'
import {
  buildInboundTempBagInventoryRecords,
  buildInboundTempBagsFromTransferBagViewModel,
  type CutPieceSortingTask,
  type InboundTempBag,
  type InboundTempBagInventoryRecord,
  type TransferBagTicketCandidate,
} from './transfer-bags-model.ts'
import { getWarehouseSearchParams } from './warehouse-shared.ts'
import { renderMaterialIdentityBlock } from './material-identity.ts'
import {
  renderFactoryWarehouseStandardTabs,
  renderWarehouseLocationActions,
  renderWarehouseLocationToolbar,
  type FactoryWarehouseStandardTab,
} from '../shared/warehouse-standard.ts'

type WaitProcessTabKey = 'inventory' | 'receipts' | 'usage' | 'locations'
type WaitHandoverTabKey = 'workbench' | 'inventory' | 'assignment' | 'sorting' | 'special-craft-return' | 'handoverOrders' | 'handoverRecords' | 'locations'

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value)
}

function formatLength(value: number, unit = '米'): string {
  return `${formatNumber(value)} ${unit}`
}

function uniqueCount(values: Array<string | undefined>): number {
  return new Set(values.filter(Boolean)).size
}

function buildWaitProcessMaterialLedgerSummary() {
  const rows = listMaterialLedgerProjections()
  const unit = rows[0]?.unit || '米'
  const requiredQty = rows.reduce((sum, item) => sum + Number(item.requiredMaterialQty || 0), 0)
  const configuredQty = rows.reduce((sum, item) => sum + Number(item.transferWarehouseAllocatedQty || 0), 0)
  const claimedQty = rows.reduce((sum, item) => sum + Number(item.cuttingClaimedQty || 0), 0)
  const lockedQty = rows.reduce((sum, item) => sum + Number(item.markerLockedQty || 0), 0)
  const consumedQty = rows.reduce((sum, item) => sum + Number(item.spreadingConsumedQty || 0), 0)
  const availableQty = rows.reduce((sum, item) => sum + Number(item.availableQty || 0), 0)
  const latestClaimEvent = rows
    .map((item) => item.latestClaimEvent)
    .filter((event): event is NonNullable<typeof event> => Boolean(event))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt, 'zh-CN'))[0] || null

  return {
    requiredQty,
    configuredQty,
    claimedQty,
    lockedQty,
    consumedQty,
    availableQty,
    unit,
    rows,
    latestClaimEvent,
  }
}

function renderWaitProcessLedgerPreview(rows: MaterialLedgerProjection[]): string {
  const visibleRows = rows
    .filter((row) => row.cuttingClaimedQty > 0 || row.availableQty > 0)
    .sort((left, right) => right.availableQty - left.availableQty || left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN'))
    .slice(0, 4)
  return `
    <article class="rounded-lg border bg-card p-4 xl:col-span-2">
      <h2 class="text-base font-semibold">裁片单待加工仓数量账</h2>
      <div class="mt-4 grid gap-3 md:grid-cols-2">
        ${visibleRows
          .map((row) => `
            <div class="rounded-md border bg-background p-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">${renderMaterialIdentityBlock(row.materialIdentity, { compact: true, imageSizeClass: 'h-9 w-9', showCategory: false })}</div>
                <div class="shrink-0 text-right text-xs">
                  <div class="font-medium text-blue-600">${escapeHtml(row.cutOrderNo)}</div>
                  <div class="mt-1 text-muted-foreground">${escapeHtml(row.patternIdentity.patternFileName || '待补纸样')}</div>
                </div>
              </div>
              <dl class="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><dt class="text-muted-foreground">中转仓已配数量</dt><dd class="font-semibold tabular-nums">${escapeHtml(formatLength(row.transferWarehouseAllocatedQty, row.unit))}</dd></div>
                <div><dt class="text-muted-foreground">裁床已领数量</dt><dd class="font-semibold tabular-nums">${escapeHtml(formatLength(row.cuttingClaimedQty, row.unit))}</dd></div>
                <div><dt class="text-muted-foreground">可用余额</dt><dd class="font-semibold tabular-nums text-emerald-600">${escapeHtml(formatLength(row.availableQty, row.unit))}</dd></div>
              </dl>
              <div class="mt-2 text-xs text-muted-foreground">最近领料记录：${escapeHtml(row.latestClaimEvent ? `${row.latestClaimEvent.occurredAt} · ${row.latestClaimEvent.operatorName}` : '暂无')}</div>
            </div>
          `)
          .join('') || '<div class="text-sm text-muted-foreground">暂无裁床领料数量账。</div>'}
      </div>
    </article>
  `
}

function getSafeCuttingSewingDispatchSummary(): ReturnType<typeof getCuttingSewingDispatchSummary> {
  try {
    return getCuttingSewingDispatchSummary()
  } catch {
    return {
      waitingCompleteOrderCount: 0,
      readyBatchCount: 0,
      handedOverBatchCount: 0,
      writtenBackBatchCount: 0,
      differenceBatchCount: 0,
      objectionBatchCount: 0,
      remainingGarmentQty: 0,
    }
  }
}

function renderHubActionCard(options: {
  title: string
  rows: Array<[string, string | number]>
}): string {
  return `
    <article class="rounded-lg border bg-card p-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 class="text-base font-semibold">${escapeHtml(options.title)}</h2>
        </div>
      </div>
      <dl class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        ${options.rows
          .map(
            ([label, value]) => `
              <div class="rounded-md border bg-background px-3 py-2">
                <dt class="text-xs text-muted-foreground">${escapeHtml(label)}</dt>
                <dd class="mt-1 text-base font-semibold tabular-nums">${escapeHtml(String(value))}</dd>
              </div>
            `,
          )
          .join('')}
      </dl>
    </article>
  `
}

function renderHubGuideCard(title: string, lines: string[]): string {
  return `
    <article class="rounded-lg border border-dashed bg-muted/20 p-4 xl:col-span-2">
      <h2 class="text-base font-semibold">${escapeHtml(title)}</h2>
      <ul class="mt-3 space-y-2 text-sm text-muted-foreground">
        ${lines
          .map(
            (line) => `
              <li class="flex gap-2">
                <span class="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                <span>${escapeHtml(line)}</span>
              </li>
            `,
          )
          .join('')}
      </ul>
    </article>
  `
}

function renderHubTable(headers: string[], rows: string[][], emptyText = '暂无数据'): string {
  if (!rows.length) {
    return `<div class="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`
  }
  const tableHtml = `
    <table class="min-w-[960px] w-full text-left text-sm">
      <thead class="sticky top-0 z-10 bg-slate-50 text-xs text-muted-foreground">
        <tr>
          ${headers.map((header) => `<th class="px-3 py-2 font-medium">${escapeHtml(header)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => `
            <tr class="border-b last:border-b-0">
              ${row.map((cell) => `<td class="px-3 py-3 align-top">${escapeHtml(cell)}</td>`).join('')}
            </tr>
          `)
          .join('')}
      </tbody>
    </table>
  `
  return `
    <div class="rounded-lg border bg-card">
      ${renderStickyTableScroller(tableHtml, 'max-h-[28rem]')}
    </div>
  `
}

function renderLocationRows(scopeLabel: string, rows: Array<[string, string, string, string]>): string {
  const tableHtml = `
    <table class="min-w-[960px] w-full text-left text-sm">
      <thead class="sticky top-0 z-10 bg-slate-50 text-xs text-muted-foreground">
        <tr>
          <th class="px-3 py-2 font-medium">仓库</th>
          <th class="px-3 py-2 font-medium">库区</th>
          <th class="px-3 py-2 font-medium">库位</th>
          <th class="px-3 py-2 font-medium">承载对象</th>
          <th class="px-3 py-2 font-medium">操作</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(([warehouse, area, location, object]) => `
            <tr class="border-b last:border-b-0">
              <td class="px-3 py-3">${escapeHtml(warehouse)}</td>
              <td class="px-3 py-3">${escapeHtml(area)}</td>
              <td class="px-3 py-3">${escapeHtml(location)}</td>
              <td class="px-3 py-3">${escapeHtml(object)}</td>
              <td class="px-3 py-3">${renderWarehouseLocationActions(scopeLabel, `${area}/${location}`)}</td>
            </tr>
          `)
          .join('')}
      </tbody>
    </table>
  `
  return `
    <div class="rounded-lg border bg-card">
      ${renderStickyTableScroller(tableHtml, 'max-h-[28rem]')}
    </div>
  `
}

function readTabKey<T extends string>(fallback: T, supportedTabs: readonly T[]): T {
  const raw = getWarehouseSearchParams().get('tab')
  return supportedTabs.includes(raw as T) ? (raw as T) : fallback
}

function buildHubTabHref(
  pageKey: 'warehouse-management-wait-process' | 'warehouse-management-wait-handover',
  tabKey: string,
): string {
  const basePath = getCanonicalCuttingPath(pageKey)
  return tabKey === 'overview' ? basePath : `${basePath}?tab=${encodeURIComponent(tabKey)}`
}

function renderHubTabs(
  pageKey: 'warehouse-management-wait-process' | 'warehouse-management-wait-handover',
  activeTab: string,
  tabs: Array<{ key: string; label: string }>,
): string {
  return `
    <section class="rounded-lg border bg-card p-2">
      <div class="flex flex-wrap gap-2">
        ${tabs
          .map((tab) => {
            const isActive = tab.key === activeTab
            return `
              <button
                type="button"
                class="rounded-md px-3 py-2 text-sm ${isActive ? 'bg-slate-900 text-white' : 'border bg-background text-slate-700 hover:bg-muted'}"
                data-nav="${escapeHtml(buildHubTabHref(pageKey, tab.key))}"
              >
                ${escapeHtml(tab.label)}
              </button>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderHubShell(options: {
  metaKey: 'warehouse-management-wait-process' | 'warehouse-management-wait-handover'
  description: string
  kpis: string
  tabs: string
  content: string
}): string {
  const meta = getCanonicalCuttingMeta('', options.metaKey)
  return `
    <div class="space-y-5">
      ${renderCuttingPageHeader(meta)}
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${options.kpis}
      </section>
      ${options.tabs}
      ${options.content}
    </div>
  `
}

type WaitHandoverWorkbenchItemType =
  | '待入仓确认'
  | '待二次分拣'
  | '待重新装袋'
  | '待新增交出记录'
  | '接收差异 / 交出后缺口'

interface WaitHandoverOverviewCard {
  label: string
  value: string | number
  hint: string
  tone: string
}

interface WaitHandoverWorkbenchItem {
  itemId: string
  itemType: WaitHandoverWorkbenchItemType
  urgentLevel: string
  updatedAt: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  spreadingOrderId: string
  spreadingOrderNo: string
  feiTicketIds: string[]
  feiTicketNos: string[]
  spuCode: string
  color: string
  size: string
  partName: string
  pieceQty: number
  pieceSequenceLabel: string
  hasSpecialCraft: boolean
  specialCraftDisplay: string
  receiverFactoryDisplay: string
  currentWarehouseArea: string
  tempBagCodes: string[]
  targetTaskId: string
  targetReceiver: string
  shortageAfterHandover: string
  nextAction: string
  nextActionHref: string
  evidenceLines: string[]
}

interface WaitHandoverWorkbenchProjection {
  overviewCards: WaitHandoverOverviewCard[]
  pendingInboundItems: WaitHandoverWorkbenchItem[]
  pendingSortingItems: WaitHandoverWorkbenchItem[]
  pendingRebaggingItems: WaitHandoverWorkbenchItem[]
  pendingHandoverRecordItems: WaitHandoverWorkbenchItem[]
  discrepancyAndShortageItems: WaitHandoverWorkbenchItem[]
  specialCraftHandoverGroups: SpecialCraftHandoverGroup[]
  specialCraftReturnProjection: SpecialCraftReturnProjection
  inboundTempBags: InboundTempBag[]
  inboundInventoryRecords: InboundTempBagInventoryRecord[]
  specialCraftReturnInventoryRecords: SpecialCraftReturnInventoryRecord[]
  sewingAllocationProjection: SewingTaskAllocationProjection
  handoverPickingProjection: HandoverPickingTaskProjection
  inventorySnapshot: {
    pieceQty: number
    itemCount: number
    unassignedCount: number
  }
  tempBagSnapshot: {
    tempBagCount: number
    bagCount: number
    tempBagCodes: string[]
    totalPieceQty: number
    mixedBagCount: number
    discrepancyCount: number
  }
  specialCraftSnapshot: {
    waitingReturnCount: number
    returnedCount: number
    differenceCount: number
    hint: string
  }
  handoverSnapshot: {
    handoverOrderCount: number
    handoverRecordCount: number
    shortageCount: number
    discrepancyCount: number
  }
  updatedAt: string
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
}

function formatPieceQty(value: number): string {
  return `${formatNumber(value)} 片`
}

function getSpecialCraftDisplay(ticket?: GeneratedFeiTicketSourceRecord): string {
  if (!ticket?.hasSpecialCraft || !ticket.specialCrafts.length) return '无'
  return uniqueStrings(ticket.specialCrafts.map((craft) => craft.craftType || craft.craftName)).join('、') || '无'
}

function getReceiverFactoryDisplay(ticket?: GeneratedFeiTicketSourceRecord): string {
  if (!ticket?.hasSpecialCraft || !ticket.specialCrafts.length) return '无'
  return (
    uniqueStrings(ticket.specialCrafts.map((craft) => craft.receiverFactoryName || '承接工厂待补充')).join('、') ||
    '承接工厂待补充'
  )
}

function createWaitHandoverItemFromTicket(
  candidate: TransferBagTicketCandidate,
  generatedTicket: GeneratedFeiTicketSourceRecord | undefined,
  options: {
    itemType: WaitHandoverWorkbenchItemType
    targetTaskId?: string
    targetReceiver?: string
    currentWarehouseArea?: string
    tempBagCodes?: string[]
    shortageAfterHandover?: string
    nextAction: string
    nextActionHref: string
    evidenceLines?: string[]
  },
): WaitHandoverWorkbenchItem {
  return {
    itemId: `${options.itemType}-${candidate.ticketRecordId}`,
    itemType: options.itemType,
    urgentLevel: '普通',
    updatedAt: generatedTicket?.issuedAt || '最近更新',
    productionOrderId: candidate.productionOrderId,
    productionOrderNo: candidate.productionOrderNo,
    cutOrderId: candidate.cutOrderId,
    cutOrderNo: candidate.cutOrderNo,
    spreadingOrderId: generatedTicket?.spreadingOrderId || candidate.sourceSpreadingSessionId,
    spreadingOrderNo: generatedTicket?.spreadingOrderNo || candidate.sourceSpreadingSessionNo,
    feiTicketIds: [candidate.feiTicketId],
    feiTicketNos: [candidate.ticketNo],
    spuCode: candidate.spuCode || generatedTicket?.sourceTechPackSpuCode || '未关联 SPU',
    color: candidate.color || candidate.fabricColor || generatedTicket?.skuColor || '未标记',
    size: candidate.size || generatedTicket?.skuSize || '未标记',
    partName: candidate.partName || generatedTicket?.partName || '未标记',
    pieceQty: Number(candidate.actualCutPieceQty || candidate.qty || generatedTicket?.actualCutPieceQty || 0),
    pieceSequenceLabel: generatedTicket?.pieceSequenceLabel || generatedTicket?.pieceSetNoRange || '按菲票追踪',
    hasSpecialCraft: Boolean(generatedTicket?.hasSpecialCraft),
    specialCraftDisplay: getSpecialCraftDisplay(generatedTicket),
    receiverFactoryDisplay: getReceiverFactoryDisplay(generatedTicket),
    currentWarehouseArea: options.currentWarehouseArea || '裁床待交出仓',
    tempBagCodes: options.tempBagCodes || [],
    targetTaskId: options.targetTaskId || '',
    targetReceiver: options.targetReceiver || '',
    shortageAfterHandover: options.shortageAfterHandover || '交出后计算',
    nextAction: options.nextAction,
    nextActionHref: options.nextActionHref,
    evidenceLines: options.evidenceLines || [],
  }
}

function createWaitHandoverItemFromSortingTask(
  task: CutPieceSortingTask,
  batch: CuttingSewingDispatchBatch | undefined,
  generatedTicketsByNo: Record<string, GeneratedFeiTicketSourceRecord>,
  options: {
    itemType: WaitHandoverWorkbenchItemType
    nextAction: string
    nextActionHref: string
    evidenceLines?: string[]
  },
): WaitHandoverWorkbenchItem {
  const relatedTicket = task.targetTransferBagNos
    .concat(task.sourceTempBagNos)
    .map((value) => generatedTicketsByNo[value])
    .filter(Boolean)[0]
  const skuLine = batch?.plannedSkuQtyLines[0]
  const pendingPieceQty = Math.max((task.expectedTicketCount - task.pickedTicketCount) || task.expectedTicketCount, 0)
  return {
    itemId: `${options.itemType}-${task.sortingTaskId}`,
    itemType: options.itemType,
    urgentLevel: '普通',
    updatedAt: batch?.updatedAt || '最近更新',
    productionOrderId: batch?.productionOrderId || '',
    productionOrderNo: task.productionOrderNo || batch?.productionOrderNo || '未关联生产单',
    cutOrderId: '',
    cutOrderNo: batch?.transferOrderNo || '按交出任务汇总',
    spreadingOrderId: relatedTicket?.spreadingOrderId || '',
    spreadingOrderNo: relatedTicket?.spreadingOrderNo || '',
    feiTicketIds: [],
    feiTicketNos: batch?.feiTicketNos || [],
    spuCode: task.skuSummary || relatedTicket?.sourceTechPackSpuCode || '按车缝任务汇总',
    color: skuLine?.colorName || relatedTicket?.skuColor || '多颜色',
    size: skuLine?.sizeCode || relatedTicket?.skuSize || '多尺码',
    partName: skuLine?.partName || relatedTicket?.partName || '多部位',
    pieceQty: pendingPieceQty,
    pieceSequenceLabel: relatedTicket?.pieceSequenceLabel || '按菲票追踪',
    hasSpecialCraft: Boolean(relatedTicket?.hasSpecialCraft),
    specialCraftDisplay: getSpecialCraftDisplay(relatedTicket),
    receiverFactoryDisplay: getReceiverFactoryDisplay(relatedTicket),
    currentWarehouseArea: '裁床待交出仓',
    tempBagCodes: task.sourceTempBagNos,
    targetTaskId: task.sortingTaskNo,
    targetReceiver: task.targetFactoryName,
    shortageAfterHandover: '交出后计算',
    nextAction: options.nextAction,
    nextActionHref: options.nextActionHref,
    evidenceLines: options.evidenceLines || [
      `来源暂存袋：${task.sourceTempBagNos.join('、') || '待确认'}`,
      `已分拣菲票：${task.pickedTicketCount}/${task.expectedTicketCount} 张`,
      `目标中转袋：${task.targetTransferBagNos.join('、') || '待重新装袋'}`,
    ],
  }
}

function createWaitHandoverItemFromPickingTask(
  task: HandoverPickingTask,
  itemType: WaitHandoverWorkbenchItemType,
  nextAction: string,
  nextActionHref: string,
): WaitHandoverWorkbenchItem {
  const firstAllocated = task.allocatedInventoryItems[0]
  const totalPickedQty = task.pickedItems.reduce((total, item) => total + item.pickedQty, 0)
  const shortagePreview = task.shortageItems
    .slice(0, 2)
    .map((item) => `${item.size}/${item.partName} 缺 ${formatPieceQty(item.shortageQty)}`)
    .join('；') || '暂无缺口'

  return {
    itemId: `${itemType}-${task.pickingTaskId}`,
    itemType,
    urgentLevel: task.shortageItems.length ? '高' : '普通',
    updatedAt: task.updatedAt,
    productionOrderId: '',
    productionOrderNo: firstAllocated?.feiTicketNo ? '按菲票来源追踪' : '待关联生产单',
    cutOrderId: '',
    cutOrderNo: firstAllocated?.feiTicketNo ? '按分配库存追踪' : '待关联裁片单',
    spreadingOrderId: '',
    spreadingOrderNo: '',
    feiTicketIds: task.allocatedInventoryItems.map((item) => item.feiTicketId),
    feiTicketNos: task.allocatedInventoryItems.map((item) => item.feiTicketNo),
    spuCode: task.sewingTaskNo,
    color: '按配料任务汇总',
    size: firstAllocated?.size || '多尺码',
    partName: firstAllocated?.partName || '多部位',
    pieceQty: totalPickedQty || task.allocatedInventoryItems.reduce((total, item) => total + item.pieceQty, 0),
    pieceSequenceLabel: firstAllocated?.pieceSequenceLabel || '按菲票追踪',
    hasSpecialCraft: task.allocatedInventoryItems.some((item) => item.specialCraftReturnStatus !== '不需要特殊工艺'),
    specialCraftDisplay: task.allocatedInventoryItems.some((item) => item.specialCraftReturnStatus !== '不需要特殊工艺') ? '特殊工艺已回仓或已排除' : '无',
    receiverFactoryDisplay: task.receiverFactoryName,
    currentWarehouseArea: task.sourceWarehouseName,
    tempBagCodes: task.tempBagSources.map((item) => item.tempBagCode),
    targetTaskId: task.pickingTaskNo,
    targetReceiver: task.receiverFactoryName,
    shortageAfterHandover: shortagePreview,
    nextAction,
    nextActionHref,
    evidenceLines: [
      `车缝任务：${task.sewingTaskNo}`,
      `来源暂存袋：${task.tempBagSources.map((item) => item.tempBagCode).join('、') || '待扫描'}`,
      `已分拣：${formatPieceQty(totalPickedQty)}`,
      `目标中转袋：${task.targetTransferBags.map((bag) => bag.bagCode).join('、') || '待重新装袋'}`,
      `分拣后缺口：${shortagePreview}`,
    ],
  }
}

function createWaitHandoverItemFromBatch(
  batch: CuttingSewingDispatchBatch,
  itemType: WaitHandoverWorkbenchItemType,
  nextAction: string,
  nextActionHref: string,
): WaitHandoverWorkbenchItem {
  const summary = getCuttingSewingDispatchBatchHandoverSummary(batch.dispatchBatchId)
  const skuLine = batch.plannedSkuQtyLines[0]
  const gapPreview = summary?.gapLines
    .slice(0, 2)
    .map((line) => `${line.colorName}/${line.sizeCode}/${line.partName} 缺 ${line.missingPieceQty} 片`)
    .join('；')
  return {
    itemId: `${itemType}-${batch.dispatchBatchId}`,
    itemType,
    urgentLevel: '普通',
    updatedAt: batch.updatedAt,
    productionOrderId: batch.productionOrderId,
    productionOrderNo: batch.productionOrderNo,
    cutOrderId: '',
    cutOrderNo: batch.transferOrderNo,
    spreadingOrderId: '',
    spreadingOrderNo: '',
    feiTicketIds: [],
    feiTicketNos: batch.feiTicketNos,
    spuCode: skuLine?.skuCode || '按交出任务汇总',
    color: skuLine?.colorName || '多颜色',
    size: skuLine?.sizeCode || '多尺码',
    partName: skuLine?.partName || '多部位',
    pieceQty: summary?.currentSubmittedPieceQty || batch.feiTicketNos.length,
    pieceSequenceLabel: '按菲票追踪',
    hasSpecialCraft: batch.plannedSkuQtyLines.some((line) => line.specialCraftRequired),
    specialCraftDisplay: batch.plannedSkuQtyLines.some((line) => line.specialCraftRequired) ? '含特殊工艺部位' : '无',
    receiverFactoryDisplay: '接收对象见交出单',
    currentWarehouseArea: '裁床待交出仓',
    tempBagCodes: batch.transferBagIds,
    targetTaskId: batch.dispatchBatchNo,
    targetReceiver: '车缝厂',
    shortageAfterHandover: summary?.completeAfterSubmit ? '交出后无缺口' : gapPreview || '交出后仍有缺口',
    nextAction,
    nextActionHref,
    evidenceLines: [
      `已装袋数量：${batch.transferBagIds.length} 袋`,
      `本次可交出：${formatPieceQty(summary?.currentSubmittedPieceQty || batch.feiTicketNos.length)}`,
      `上次交出：${formatPieceQty(summary?.previousSubmittedPieceQty || 0)}`,
    ],
  }
}

function createWaitHandoverItemFromValidation(
  result: CuttingSewingDispatchValidationResult,
  batch: CuttingSewingDispatchBatch | undefined,
): WaitHandoverWorkbenchItem {
  return {
    itemId: `discrepancy-${result.validationId}`,
    itemType: '接收差异 / 交出后缺口',
    urgentLevel: result.blocking ? '高' : '普通',
    updatedAt: '最近更新',
    productionOrderId: result.productionOrderId,
    productionOrderNo: result.productionOrderNo,
    cutOrderId: '',
    cutOrderNo: batch?.transferOrderNo || '按交出记录追踪',
    spreadingOrderId: '',
    spreadingOrderNo: '',
    feiTicketIds: [],
    feiTicketNos: batch?.feiTicketNos || [],
    spuCode: batch?.plannedSkuQtyLines[0]?.skuCode || '按接收差异汇总',
    color: result.colorName,
    size: result.sizeCode,
    partName: result.partName,
    pieceQty: Math.max(result.missingPieceQty || result.overPieceQty || result.scannedPieceQty, 0),
    pieceSequenceLabel: '按菲票追踪',
    hasSpecialCraft: result.specialCraftRequired,
    specialCraftDisplay: result.specialCraftRequired ? result.specialCraftStatus : '无',
    receiverFactoryDisplay: '接收对象见交出单',
    currentWarehouseArea: '裁床待交出仓',
    tempBagCodes: [result.transferBagId],
    targetTaskId: batch?.dispatchBatchNo || result.dispatchBatchId,
    targetReceiver: '接收方',
    shortageAfterHandover:
      result.missingPieceQty > 0
        ? `缺 ${formatPieceQty(result.missingPieceQty)}`
        : result.overPieceQty > 0
          ? `多 ${formatPieceQty(result.overPieceQty)}`
          : result.validationType,
    nextAction: '查看处理记录',
    nextActionHref: buildHubTabHref('warehouse-management-wait-handover', 'handoverRecords'),
    evidenceLines: [
      `差异类型：${result.validationType}`,
      `差异数量：${formatPieceQty(Math.max(result.missingPieceQty || result.overPieceQty || 0, 0))}`,
      `异议状态：${result.validationMessage}`,
    ],
  }
}

function buildWaitHandoverWorkbenchProjection(options: {
  ticketCandidates: TransferBagTicketCandidate[]
  generatedTickets: GeneratedFeiTicketSourceRecord[]
  inboundTempBags: InboundTempBag[]
  inboundInventoryRecords: InboundTempBagInventoryRecord[]
  specialCraftReturnProjection: SpecialCraftReturnProjection
  specialCraftReturnInventoryRecords: SpecialCraftReturnInventoryRecord[]
  sewingAllocationProjection: SewingTaskAllocationProjection
  handoverPickingProjection: HandoverPickingTaskProjection
  cutPieceItems: CutPieceWarehouseItem[]
  cutPieceSummary: { totalItemCount: number; pieceQtyTotal: number }
  transferBagSummary: { bagCount: number }
  sortingTaskSummary: {
    pendingCount: number
    sortingCount: number
    packedCount: number
    handedOverCount: number
    sourceTempBagCount: number
    targetTransferBagCount: number
  }
  sortingTasks: CutPieceSortingTask[]
  dispatchBatches: CuttingSewingDispatchBatch[]
  validationResults: CuttingSewingDispatchValidationResult[]
  returnRows: ReturnType<typeof listCuttingSpecialCraftReturnViews>
  dispatchOrderCount: number
  sewingSummary: ReturnType<typeof getSafeCuttingSewingDispatchSummary>
}): WaitHandoverWorkbenchProjection {
  const generatedTicketsByNo = Object.fromEntries(options.generatedTickets.map((ticket) => [ticket.feiTicketNo, ticket]))
  const printedCandidates = options.ticketCandidates
    .filter((ticket) => ticket.ticketStatus === 'PRINTED' || ticket.ticketStatus === 'REPRINTED')
    .slice(0, 2)
  const pendingInboundItems = printedCandidates.map((ticket) =>
    createWaitHandoverItemFromTicket(ticket, generatedTicketsByNo[ticket.ticketNo], {
      itemType: '待入仓确认',
      currentWarehouseArea: '待入仓确认区',
      nextAction: '确认入仓 / 查看菲票',
      nextActionHref: '/fcs/craft/cutting/fei-tickets',
      evidenceLines: [
        '已打印菲票，等待裁床待交出仓确认入仓。',
        `来源铺布单：${generatedTicketsByNo[ticket.ticketNo]?.spreadingOrderNo || ticket.sourceSpreadingSessionNo}`,
      ],
    }),
  )
  const pendingSortingItems = options.handoverPickingProjection.tasks
    .filter((task) => task.taskStatus === '待分拣' || task.taskStatus === '分拣中' || task.shortageItems.length > 0)
    .slice(0, 2)
    .map((task) =>
      createWaitHandoverItemFromPickingTask(
        task,
        '待二次分拣',
        '去二次分拣',
        buildHubTabHref('warehouse-management-wait-handover', 'sorting'),
      ),
    )
  const pendingRebaggingItems = options.handoverPickingProjection.tasks
    .filter((task) => task.taskStatus === '已分拣待装袋' || task.taskStatus === '已装袋待交出' || task.targetTransferBags.length > 0)
    .slice(0, 2)
    .map((task) =>
      createWaitHandoverItemFromPickingTask(
        task,
        '待重新装袋',
        '重新装袋',
        buildHubTabHref('warehouse-management-wait-handover', 'sorting'),
      ),
    )
  const pendingHandoverRecordItems = options.dispatchBatches
    .filter((batch) => batch.transferBagIds.length > 0 && !batch.handoverRecordNo)
    .slice(0, 2)
    .map((batch) =>
      createWaitHandoverItemFromBatch(
        batch,
        '待新增交出记录',
        '新增交出记录',
        buildHubTabHref('warehouse-management-wait-handover', 'handoverRecords'),
      ),
    )
  const exceptionValidations = options.validationResults
    .filter((result) => result.validationType !== '通过')
    .slice(0, 3)
  const discrepancyAndShortageItems = exceptionValidations.map((result) =>
    createWaitHandoverItemFromValidation(
      result,
      options.dispatchBatches.find((batch) => batch.dispatchBatchId === result.dispatchBatchId),
    ),
  )
  const tempBagCodes = uniqueStrings(options.inboundTempBags.map((bag) => bag.bagCode))
  const inboundTempPieceQty = options.inboundTempBags.reduce((sum, bag) => sum + bag.totalPieceQty, 0)
  const specialCraftReturnPieceQty = options.specialCraftReturnInventoryRecords.reduce((sum, record) => sum + record.pieceQty, 0)
  const inboundTempDiscrepancyCount = options.inboundTempBags.reduce((sum, bag) => sum + bag.discrepancyRecords.length, 0)
  const waitingReturnCount =
    options.returnRows.filter((row) => row.returnStatus !== '已回仓').length +
    options.specialCraftReturnProjection.summary.waitingReturnCount
  const returnedCount =
    options.returnRows.filter((row) => row.returnStatus === '已回仓').length +
    options.specialCraftReturnProjection.summary.returnedCount
  const differenceCount =
    options.returnRows.filter((row) => row.returnStatus === '差异' || row.differenceQty > 0).length +
    options.specialCraftReturnProjection.summary.discrepancyCount
  const specialCraftHandoverGroups = buildSpecialCraftHandoverGroups()
  const readySpecialCraftGroups = specialCraftHandoverGroups.filter((group) => group.canCreateHandover).length
  const shortageCount = discrepancyAndShortageItems.filter((item) => item.shortageAfterHandover.includes('缺')).length
  const overviewCards: WaitHandoverOverviewCard[] = [
    { label: '待入仓确认裁片数量', value: formatPieceQty(pendingInboundItems.reduce((sum, item) => sum + item.pieceQty, 0)), hint: '已打印菲票进入裁后仓前确认', tone: 'text-blue-600' },
    { label: '入仓暂存袋数量', value: options.inboundTempBags.length, hint: `${formatPieceQty(inboundTempPieceQty)} 已扫码入仓`, tone: 'text-slate-700' },
    { label: '裁片库存数量', value: formatPieceQty(Math.max(options.cutPieceSummary.pieceQtyTotal, inboundTempPieceQty + specialCraftReturnPieceQty)), hint: `${options.inboundInventoryRecords.length + options.specialCraftReturnInventoryRecords.length} 条入仓 / 回仓库存记录`, tone: 'text-emerald-600' },
    { label: '待二次分拣任务数量', value: pendingSortingItems.length || options.handoverPickingProjection.pendingCount + options.handoverPickingProjection.sortingCount, hint: '车缝任务分配后触发', tone: 'text-amber-600' },
    { label: '待重新装袋数量', value: pendingRebaggingItems.length || options.handoverPickingProjection.packedCount, hint: '二次分拣后重新装中转袋', tone: 'text-violet-600' },
    { label: '待新增交出记录数量', value: pendingHandoverRecordItems.length || options.sewingSummary.readyBatchCount, hint: '齐套不是交出前置条件', tone: 'text-blue-600' },
    { label: '接收差异数量', value: discrepancyAndShortageItems.length + options.sewingSummary.differenceBatchCount + options.sewingSummary.objectionBatchCount, hint: '接收回写和异议提示', tone: 'text-rose-600' },
    { label: '交出后缺口数量', value: shortageCount, hint: '缺口作为交出后结果展示', tone: 'text-orange-600' },
    { label: '特殊工艺待交出归组', value: specialCraftHandoverGroups.length, hint: `${readySpecialCraftGroups} 组可生成通用交出单`, tone: 'text-violet-600' },
  ]
  return {
    overviewCards,
    pendingInboundItems,
    pendingSortingItems,
    pendingRebaggingItems,
    pendingHandoverRecordItems,
    discrepancyAndShortageItems,
    specialCraftHandoverGroups,
    specialCraftReturnProjection: options.specialCraftReturnProjection,
    inboundTempBags: options.inboundTempBags,
    inboundInventoryRecords: options.inboundInventoryRecords,
    specialCraftReturnInventoryRecords: options.specialCraftReturnInventoryRecords,
    sewingAllocationProjection: options.sewingAllocationProjection,
    handoverPickingProjection: options.handoverPickingProjection,
    inventorySnapshot: {
      pieceQty: Math.max(
        options.cutPieceSummary.pieceQtyTotal,
        inboundTempPieceQty + options.specialCraftReturnInventoryRecords.reduce((sum, record) => sum + record.pieceQty, 0),
      ),
      itemCount: Math.max(options.cutPieceSummary.totalItemCount, options.inboundInventoryRecords.length + options.specialCraftReturnInventoryRecords.length),
      unassignedCount: options.cutPieceItems.filter((item) => item.zoneCode === 'UNASSIGNED').length,
    },
    tempBagSnapshot: {
      tempBagCount: options.inboundTempBags.length,
      bagCount: options.transferBagSummary.bagCount,
      tempBagCodes: tempBagCodes.slice(0, 6),
      totalPieceQty: inboundTempPieceQty,
      mixedBagCount: options.inboundTempBags.filter((bag) => bag.mixedFlag).length,
      discrepancyCount: inboundTempDiscrepancyCount,
    },
    specialCraftSnapshot: {
      waitingReturnCount,
      returnedCount,
      differenceCount,
      hint: '特殊工艺未回仓不影响其他已裁出部位交出；回仓后重新进入裁床待交出仓库存。',
    },
    handoverSnapshot: {
      handoverOrderCount: options.dispatchOrderCount,
      handoverRecordCount: options.dispatchBatches.filter((batch) => batch.handoverRecordNo).length,
      shortageCount,
      discrepancyCount: discrepancyAndShortageItems.length,
    },
    updatedAt: new Date().toISOString().slice(0, 10),
  }
}

function renderWaitHandoverItemCard(item: WaitHandoverWorkbenchItem): string {
  return `
    <article class="rounded-lg border bg-background p-3">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <div class="text-xs text-muted-foreground">${escapeHtml(item.itemType)} · ${escapeHtml(item.updatedAt)}</div>
          <h4 class="mt-1 truncate text-sm font-semibold">${escapeHtml(item.targetTaskId || item.feiTicketNos[0] || item.cutOrderNo)}</h4>
        </div>
        <button type="button" class="shrink-0 rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(item.nextActionHref)}">${escapeHtml(item.nextAction)}</button>
      </div>
      <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div><span class="font-medium text-foreground">来源：</span>${escapeHtml(item.productionOrderNo)} / ${escapeHtml(item.cutOrderNo || '按任务汇总')}</div>
        <div><span class="font-medium text-foreground">裁片：</span>${escapeHtml(item.spuCode)} ${escapeHtml(item.color)} ${escapeHtml(item.size)} ${escapeHtml(item.partName)} · ${escapeHtml(formatPieceQty(item.pieceQty))}</div>
        <div><span class="font-medium text-foreground">编号范围：</span>${escapeHtml(item.pieceSequenceLabel)}</div>
        <div><span class="font-medium text-foreground">暂存袋：</span>${escapeHtml(item.tempBagCodes.join('、') || '待确认')}</div>
        <div><span class="font-medium text-foreground">特殊工艺：</span>${escapeHtml(item.specialCraftDisplay)}</div>
        <div><span class="font-medium text-foreground">承接工厂：</span>${escapeHtml(item.receiverFactoryDisplay || item.targetReceiver || '待确认')}</div>
        <div><span class="font-medium text-foreground">接收对象：</span>${escapeHtml(item.targetReceiver || '待确认')}</div>
        <div><span class="font-medium text-foreground">交出后缺口：</span>${escapeHtml(item.shortageAfterHandover)}</div>
      </div>
      ${
        item.evidenceLines.length
          ? `<ul class="mt-3 space-y-1 text-xs text-muted-foreground">${item.evidenceLines
              .slice(0, 3)
              .map((line) => `<li>${escapeHtml(line)}</li>`)
              .join('')}</ul>`
          : ''
      }
    </article>
  `
}

function renderWaitHandoverWorkArea(title: string, subtitle: string, items: WaitHandoverWorkbenchItem[], emptyText: string): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-base font-semibold">${escapeHtml(title)}</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(subtitle)}</p>
        </div>
        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">${items.length} 项</span>
      </div>
      <div class="mt-4 space-y-3">
        ${
          items.length
            ? items.slice(0, 3).map((item) => renderWaitHandoverItemCard(item)).join('')
            : `<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`
        }
      </div>
    </section>
  `
}

function renderSpecialCraftHandoverArea(groups: SpecialCraftHandoverGroup[]): string {
  return `
    <section class="rounded-lg border bg-card p-4 xl:col-span-2" data-section="special-craft-handover-candidates">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="text-base font-semibold">特殊工艺待交出列表</h3>
          <p class="mt-1 text-xs text-muted-foreground">基于菲票特殊工艺字段、承接工厂和裁床待交出仓库存，归入通用交出单和交出记录。</p>
        </div>
        <span class="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">${groups.length} 组</span>
      </div>
      <div class="mt-4 grid gap-3 lg:grid-cols-2">
        ${
          groups.length
            ? groups.slice(0, 8).map((group) => {
                const feiTicketCount = uniqueStrings(group.candidates.map((item) => item.feiTicketNo)).length
                const statusText = group.handoverRecordNo
                  ? `已生成交出记录 ${group.handoverRecordNo}`
                  : group.canCreateHandover
                    ? '可生成特殊工艺交出单'
                    : group.reasonTexts.join('；') || '不可生成正式交出单'
                const operationText = group.handoverOrderNo
                  ? '查看交出单'
                  : group.canCreateHandover
                    ? '生成特殊工艺交出单'
                    : '补充承接工厂'
                const operationHref = group.handoverOrderId
                  ? `/fcs/craft/cutting/handover-orders/${encodeURIComponent(group.handoverOrderId)}`
                  : '/fcs/craft/cutting/fei-tickets'
                return `
                  <article class="rounded-lg border bg-background p-3">
                    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div class="min-w-0">
                        <div class="text-xs text-muted-foreground">${escapeHtml(group.craftCategory)} / ${escapeHtml(group.craftType)}</div>
                        <h4 class="mt-1 truncate text-sm font-semibold">${escapeHtml(group.receiverFactoryName)}</h4>
                        <div class="mt-1 text-xs text-muted-foreground">接收对象：${escapeHtml(group.receiverType)} / 承接工厂：${escapeHtml(group.receiverFactoryCode)}</div>
                      </div>
                      <button type="button" class="shrink-0 rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(operationHref)}">${escapeHtml(operationText)}</button>
                    </div>
                    <dl class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div><span class="font-medium text-foreground">菲票：</span>${feiTicketCount} 张</div>
                      <div><span class="font-medium text-foreground">裁片数量：</span>${escapeHtml(formatPieceQty(group.totalPieceQty))}</div>
                      <div><span class="font-medium text-foreground">通用交出单：</span>${escapeHtml(group.handoverOrderNo || '待生成')}</div>
                      <div><span class="font-medium text-foreground">当前状态：</span>${escapeHtml(statusText)}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">候选菲票：</span>${escapeHtml(group.candidates.slice(0, 3).map((item) => `${item.feiTicketNo}/${item.partName}/${item.size}/${item.currentInventoryStatus}`).join('；'))}</div>
                    </dl>
                  </article>
                `
              }).join('')
            : '<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground lg:col-span-2">暂无特殊工艺待交出候选。</div>'
        }
      </div>
      <div class="mt-3 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        特殊工艺未回仓不影响其他部位交给车缝厂；中转袋仍按使用阶段管理，不做物理分类。
      </div>
    </section>
  `
}

function renderSpecialCraftReturnRecordCard(record: SpecialCraftReturnRecord): string {
  const returnedQty = record.returnedFeiTicketItems.reduce((sum, item) => sum + item.returnedQty, 0)
  const expectedQty = record.returnedFeiTicketItems.reduce((sum, item) => sum + item.pieceQty, 0)
  const differenceQty = returnedQty - expectedQty
  const firstItem = record.returnedFeiTicketItems[0]
  const nextAction =
    record.returnStatus === '已回仓'
      ? '查看回仓库存'
      : record.returnStatus === '部分回仓'
        ? '继续回仓 / 处理差异'
        : '处理回仓差异'
  return `
    <article class="rounded-lg border bg-background p-3">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <div class="text-xs text-muted-foreground">${escapeHtml(record.craftCategory)} / ${escapeHtml(record.craftType)} · ${escapeHtml(record.returnedAt)}</div>
          <h4 class="mt-1 truncate text-sm font-semibold">${escapeHtml(record.returnRecordNo)}</h4>
          <div class="mt-1 text-xs text-muted-foreground">来源交出单：${escapeHtml(record.sourceHandoverOrderNo)} / 来源交出记录：${escapeHtml(record.sourceHandoverRecordNo)}</div>
        </div>
        <span class="rounded-full px-2.5 py-1 text-xs font-medium ${
          record.returnStatus === '已回仓'
            ? 'bg-emerald-100 text-emerald-700'
            : record.returnStatus === '部分回仓'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-rose-100 text-rose-700'
        }">${escapeHtml(record.returnStatus)}</span>
      </div>
      <dl class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div><span class="font-medium text-foreground">承接工厂：</span>${escapeHtml(record.receiverFactoryName)}</div>
        <div><span class="font-medium text-foreground">回仓库区：</span>${escapeHtml(record.receivedWarehouseArea)} / ${escapeHtml(record.receivedLocationCode)}</div>
        <div><span class="font-medium text-foreground">菲票数量：</span>${record.returnedFeiTicketItems.length} 张</div>
        <div><span class="font-medium text-foreground">应回 / 实回：</span>${escapeHtml(formatPieceQty(expectedQty))} / ${escapeHtml(formatPieceQty(returnedQty))}</div>
        <div><span class="font-medium text-foreground">差异数量：</span>${escapeHtml(formatPieceQty(Math.abs(differenceQty)))}</div>
        <div><span class="font-medium text-foreground">回仓人：</span>${escapeHtml(record.returnedBy)}</div>
        <div class="sm:col-span-2"><span class="font-medium text-foreground">菲票：</span>${escapeHtml(record.returnedFeiTicketItems.map((item) => `${item.feiTicketNo}/${item.partName}/${item.size}/${item.returnCheckResult}`).join('；'))}</div>
        <div class="sm:col-span-2"><span class="font-medium text-foreground">可参与车缝分配：</span>${firstItem?.allRequiredCraftsReturned ? '是，已重新进入裁床待交出仓库存' : `暂不可，仍有${escapeHtml(firstItem?.remainingSpecialCrafts.join('、') || '回仓差异')}需处理`}</div>
      </dl>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHubTabHref('warehouse-management-wait-handover', record.returnStatus === '已回仓' ? 'assignment' : 'special-craft-return'))}">${escapeHtml(nextAction)}</button>
        <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">模拟回仓确认</button>
      </div>
    </article>
  `
}

function renderSpecialCraftReturnArea(projection: SpecialCraftReturnProjection): string {
  return `
    <section class="space-y-4" data-section="special-craft-return">
      <article class="rounded-lg border bg-card p-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 class="text-base font-semibold">特殊工艺回仓</h3>
            <p class="mt-1 text-xs text-muted-foreground">特殊工艺完成后关联原特殊工艺交出单和交出记录；回仓裁片重新进入裁床待交出仓库存。</p>
          </div>
          <span class="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">${projection.summary.returnRecordCount} 条回仓记录</span>
        </div>
        <dl class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">待回仓</dt><dd class="mt-1 text-base font-semibold tabular-nums">${projection.summary.waitingReturnCount}</dd></div>
          <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">已回仓</dt><dd class="mt-1 text-base font-semibold tabular-nums">${projection.summary.returnedCount}</dd></div>
          <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">部分回仓</dt><dd class="mt-1 text-base font-semibold tabular-nums">${projection.summary.partialReturnCount}</dd></div>
          <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">回仓差异</dt><dd class="mt-1 text-base font-semibold tabular-nums">${projection.summary.discrepancyCount}</dd></div>
          <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">回仓库存</dt><dd class="mt-1 text-base font-semibold tabular-nums">${projection.summary.returnedInventoryCount}</dd></div>
          <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">可参与车缝</dt><dd class="mt-1 text-base font-semibold tabular-nums">${projection.summary.readyForSewingCount}</dd></div>
        </dl>
      </article>

      <section class="grid gap-4 xl:grid-cols-2">
        <article class="rounded-lg border bg-card p-4">
          <h4 class="text-sm font-semibold">待回仓 / 部分回仓</h4>
          <div class="mt-3 space-y-3">
            ${
              projection.records.filter((record) => record.returnStatus !== '已回仓').length
                ? projection.records.filter((record) => record.returnStatus !== '已回仓').map((record) => renderSpecialCraftReturnRecordCard(record)).join('')
                : '<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">暂无待回仓记录。</div>'
            }
          </div>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <h4 class="text-sm font-semibold">已回仓库存</h4>
          <div class="mt-3 space-y-3">
            ${
              projection.returnedRecords.length
                ? projection.returnedRecords.map((record) => renderSpecialCraftReturnRecordCard(record)).join('')
                : '<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">暂无已回仓记录。</div>'
            }
          </div>
        </article>
      </section>

      ${renderHubTable(
        ['回仓记录', '来源交出单', '来源交出记录', '承接工厂', '工艺类型', '菲票', '应回 / 实回', '差异', '回仓状态', '回仓库区', '下一动作'],
        projection.records.map((record) => {
          const expectedQty = record.returnedFeiTicketItems.reduce((sum, item) => sum + item.pieceQty, 0)
          const returnedQty = record.returnedFeiTicketItems.reduce((sum, item) => sum + item.returnedQty, 0)
          return [
            record.returnRecordNo,
            record.sourceHandoverOrderNo,
            record.sourceHandoverRecordNo,
            record.receiverFactoryName,
            record.craftType,
            record.returnedFeiTicketItems.map((item) => item.feiTicketNo).join('、'),
            `${formatPieceQty(expectedQty)} / ${formatPieceQty(returnedQty)}`,
            record.discrepancyItems.length ? record.discrepancyItems.map((item) => `${item.discrepancyType} ${formatPieceQty(Math.abs(item.differenceQty))}`).join('；') : '无',
            record.returnStatus,
            `${record.receivedWarehouseArea} / ${record.receivedLocationCode}`,
            record.returnStatus === '已回仓' ? '进入车缝任务分配' : '处理回仓差异',
          ]
        }),
        '暂无特殊工艺回仓记录',
      )}
    </section>
  `
}

function renderWaitHandoverSnapshotCard(title: string, rows: Array<[string, string | number, boolean?]>): string {
  return `
    <article class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">${escapeHtml(title)}</h3>
      <dl class="mt-4 grid gap-3 sm:grid-cols-3">
        ${rows
          .map(([label, value, fullWidth]) => `
            <div class="rounded-md border bg-background px-3 py-2 ${fullWidth ? 'sm:col-span-3' : ''}">
              <dt class="text-xs text-muted-foreground">${escapeHtml(label)}</dt>
              <dd class="mt-1 break-words text-base font-semibold tabular-nums">${escapeHtml(String(value))}</dd>
            </div>
          `)
          .join('')}
      </dl>
    </article>
  `
}

function renderWaitHandoverSnapshot(projection: WaitHandoverWorkbenchProjection): string {
  return `
    <section class="grid gap-4 xl:grid-cols-3">
      ${renderWaitHandoverSnapshotCard('裁片库存快照', [
        ['裁片库存数量', formatPieceQty(projection.inventorySnapshot.pieceQty)],
        ['库存记录数', projection.inventorySnapshot.itemCount],
        ['未分区记录', projection.inventorySnapshot.unassignedCount],
      ])}
      ${renderWaitHandoverSnapshotCard('入仓暂存袋快照', [
        ['入仓暂存袋数量', projection.tempBagSnapshot.tempBagCount],
        ['暂存裁片数量', formatPieceQty(projection.tempBagSnapshot.totalPieceQty)],
        ['混装袋数量', projection.tempBagSnapshot.mixedBagCount],
        ['入仓差异记录', projection.tempBagSnapshot.discrepancyCount],
        ['中转袋总数', projection.tempBagSnapshot.bagCount],
        ['示例暂存袋', projection.tempBagSnapshot.tempBagCodes.join('、') || '暂无', true],
      ])}
      ${renderWaitHandoverSnapshotCard('特殊工艺回仓提示', [
        ['特殊工艺未回仓', projection.specialCraftSnapshot.waitingReturnCount],
        ['特殊工艺已回仓', projection.specialCraftSnapshot.returnedCount],
        ['特殊工艺差异', projection.specialCraftSnapshot.differenceCount],
        ['处理口径', projection.specialCraftSnapshot.hint, true],
      ])}
    </section>
  `
}

function renderInboundTempBagArea(bags: InboundTempBag[], inventoryRecords: InboundTempBagInventoryRecord[]): string {
  const totalInventoryQty = inventoryRecords.reduce((sum, record) => sum + record.pieceQty, 0)
  return `
    <section class="rounded-lg border bg-card p-4" data-section="inbound-temp-bags">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="text-base font-semibold">入仓暂存袋</h3>
          <p class="mt-1 text-xs text-muted-foreground">裁剪后打完菲票先扫码入仓暂存；此阶段允许不同生产单、SKU、颜色、尺码、部位和特殊工艺要求混装。</p>
        </div>
        <div class="text-xs text-muted-foreground">已形成库存：${escapeHtml(formatPieceQty(totalInventoryQty))}</div>
      </div>
      <div class="mt-4 grid gap-3 xl:grid-cols-2">
        ${
          bags.length
            ? bags.slice(0, 4).map((bag) => {
                const productionOrderCount = uniqueStrings(bag.containedFeiTickets.map((ticket) => ticket.productionOrderNo)).length
                const cutOrderCount = uniqueStrings(bag.containedFeiTickets.map((ticket) => ticket.cutOrderNo)).length
                const partCount = uniqueStrings(bag.containedFeiTickets.map((ticket) => ticket.partName)).length
                const hasSpecialCraft = bag.containedFeiTickets.some((ticket) => ticket.hasSpecialCraft)
                return `
                  <article class="rounded-lg border bg-background p-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="text-xs text-muted-foreground">${escapeHtml(bag.useStage)} · ${escapeHtml(bag.inboundAt || '待记录入仓时间')}</div>
                        <h4 class="mt-1 truncate text-sm font-semibold">${escapeHtml(bag.bagCode)}</h4>
                      </div>
                      <span class="rounded-full px-2.5 py-1 text-xs font-medium ${bag.mixedFlag ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}">${bag.mixedFlag ? '混装' : '单一来源'}</span>
                    </div>
                    <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div><span class="font-medium text-foreground">入仓人：</span>${escapeHtml(bag.inboundBy)}</div>
                      <div><span class="font-medium text-foreground">库区 / 位置：</span>${escapeHtml(bag.warehouseArea)} / ${escapeHtml(bag.locationCode)}</div>
                      <div><span class="font-medium text-foreground">菲票数量：</span>${bag.containedFeiTickets.length} 张</div>
                      <div><span class="font-medium text-foreground">裁片数量：</span>${escapeHtml(formatPieceQty(bag.totalPieceQty))}</div>
                      <div><span class="font-medium text-foreground">生产单：</span>${productionOrderCount} 个</div>
                      <div><span class="font-medium text-foreground">裁片单：</span>${cutOrderCount} 张</div>
                      <div><span class="font-medium text-foreground">部位：</span>${partCount} 个</div>
                      <div><span class="font-medium text-foreground">特殊工艺：</span>${hasSpecialCraft ? '包含特殊工艺裁片' : '无'}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">混装概况：</span>${escapeHtml(bag.mixedSummary)}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">后续二次分拣：</span>${escapeHtml(bag.nextSortingStatus)}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">入仓差异：</span>${bag.discrepancyRecords.length ? `${bag.discrepancyRecords.length} 条待处理` : '无'}</div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHubTabHref('warehouse-management-wait-handover', 'inventory'))}">查看详情</button>
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">核对</button>
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">处理差异</button>
                    </div>
                  </article>
                `
              }).join('')
            : '<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground xl:col-span-2">暂无入仓暂存袋。</div>'
        }
      </div>
    </section>
  `
}

function renderSewingAllocationArea(projection: SewingTaskAllocationProjection): string {
  return `
    <section class="rounded-lg border bg-card p-4" data-section="sewing-allocation">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="text-base font-semibold">车缝任务分配</h3>
          <p class="mt-1 text-xs text-muted-foreground">基于裁片库存分配，只读取裁床待交出仓已有菲票 / 裁片库存；不以需求数作为分配来源。</p>
        </div>
        <button type="button" class="rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHubTabHref('warehouse-management-wait-handover', 'assignment'))}">进入车缝任务分配</button>
      </div>
      <dl class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">可分配库存记录</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.availableInventoryCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">可分配裁片数量</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${escapeHtml(formatPieceQty(projection.availablePieceQty))}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">库存占用记录</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.reservedInventoryCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">特殊工艺未回仓</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.specialCraftPendingCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">分配后缺口</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.shortageCount}</dd>
        </div>
      </dl>
      <div class="mt-4 grid gap-3 xl:grid-cols-2">
        ${
          projection.allocations.length
            ? projection.allocations.slice(0, 4).map((allocation) => {
                const allocatedQty = allocation.allocatedItems.reduce((sum, item) => sum + item.pieceQty, 0)
                const shortagePreview = allocation.shortageItems
                  .slice(0, 2)
                  .map((item) => `${item.size}/${item.partName} 缺 ${formatPieceQty(item.shortageQty)}`)
                  .join('；') || '暂无缺口'
                const pendingPreview = allocation.specialCraftPendingItems
                  .slice(0, 2)
                  .map((item) => `${item.partName} ${item.specialCraftType} ${formatPieceQty(item.pendingQty)}`)
                  .join('；') || '无'
                return `
                  <article class="rounded-lg border bg-background p-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="text-xs text-muted-foreground">${escapeHtml(allocation.sourceType)} · ${escapeHtml(allocation.allocationStatus)}</div>
                        <h4 class="mt-1 truncate text-sm font-semibold">${escapeHtml(allocation.sewingTaskNo)}</h4>
                      </div>
                      <span class="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">基于裁片库存分配</span>
                    </div>
                    <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div><span class="font-medium text-foreground">分配依据：</span>${escapeHtml(allocation.allocationBasis)}</div>
                      <div><span class="font-medium text-foreground">接收车缝厂：</span>${escapeHtml(allocation.receiverFactoryName)}</div>
                      <div><span class="font-medium text-foreground">SPU / 颜色：</span>${escapeHtml(allocation.spuCode)} / ${escapeHtml(allocation.color)}</div>
                      <div><span class="font-medium text-foreground">裁片数量：</span>${escapeHtml(formatPieceQty(allocatedQty))}</div>
                      <div><span class="font-medium text-foreground">涉及菲票：</span>${allocation.allocatedItems.length} 张</div>
                      <div><span class="font-medium text-foreground">库存占用：</span>${allocation.inventoryReservationIds.length} 条</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">分配后缺口：</span>${escapeHtml(shortagePreview)}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">特殊工艺未回仓：</span>${escapeHtml(pendingPreview)}</div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">生成待交出仓裁片配料任务</button>
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">查看分配后缺口</button>
                    </div>
                  </article>
                `
              }).join('')
            : '<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground xl:col-span-2">暂无可分配裁片库存。</div>'
        }
      </div>
      <div class="mt-4 grid gap-3 xl:grid-cols-2">
        <div class="rounded-lg border bg-background p-3">
          <h4 class="text-sm font-semibold">分配规则</h4>
          <ul class="mt-2 space-y-1 text-xs text-muted-foreground">
            ${projection.ruleNotes.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
          </ul>
        </div>
        <div class="rounded-lg border bg-background p-3">
          <h4 class="text-sm font-semibold">特殊工艺未回仓</h4>
          <ul class="mt-2 space-y-1 text-xs text-muted-foreground">
            ${
              projection.specialCraftPendingItems.length
                ? projection.specialCraftPendingItems
                    .slice(0, 4)
                    .map((item) => `<li>${escapeHtml(item.partName)}：${escapeHtml(item.specialCraftType)} / ${escapeHtml(item.receiverFactoryName)}，待回仓 ${escapeHtml(formatPieceQty(item.pendingQty))}</li>`)
                    .join('')
                : '<li>暂无特殊工艺未回仓库存。</li>'
            }
          </ul>
          <h4 class="mt-3 text-sm font-semibold">不参与本次分配</h4>
          <ul class="mt-2 space-y-1 text-xs text-muted-foreground">
            ${
              projection.excludedItems.length
                ? projection.excludedItems
                    .slice(0, 5)
                    .map((item) => `<li>${escapeHtml(item.feiTicketNo)}：${escapeHtml(item.exclusionReason)}</li>`)
                    .join('')
                : '<li>暂无被排除的库存记录。</li>'
            }
          </ul>
          <div class="mt-2 text-xs text-muted-foreground">任务取消释放占用：${projection.releasedReservations.length ? '已有释放记录' : '暂无释放记录'}</div>
        </div>
      </div>
    </section>
  `
}

function renderHandoverPickingArea(projection: HandoverPickingTaskProjection): string {
  return `
    <section class="rounded-lg border bg-card p-4" data-section="handover-picking">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="text-base font-semibold">待交出仓裁片配料</h3>
          <p class="mt-1 text-xs text-muted-foreground">车缝任务分配后，从裁床待交出仓已有菲票 / 裁片库存中二次分拣；这是裁片配料，不是前段面料配料。</p>
        </div>
        <button type="button" class="rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHubTabHref('warehouse-management-wait-handover', 'sorting'))}">打开裁片配料任务</button>
      </div>
      <dl class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">裁片配料任务</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.taskCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">分拣中任务</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.sortingCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">已装袋待交出</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.packedCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">目标中转袋</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.targetTransferBagCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">PDA 同步失败</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.syncFailedCount}</dd>
        </div>
      </dl>
      <div class="mt-4 grid gap-3 xl:grid-cols-2">
        ${
          projection.tasks.length
            ? projection.tasks.slice(0, 4).map((task) => {
                const requiredQty = task.requiredItems.reduce((total, item) => total + item.requiredQty, 0)
                const allocatedQty = task.allocatedInventoryItems.reduce((total, item) => total + item.pieceQty, 0)
                const pickedQty = task.pickedItems.reduce((total, item) => total + item.pickedQty, 0)
                const packedQty = task.targetTransferBags.reduce((total, bag) => total + bag.totalPieceQty, 0)
                const shortagePreview = task.shortageItems
                  .slice(0, 2)
                  .map((item) => `${item.size}/${item.partName} 缺 ${formatPieceQty(item.shortageQty)}`)
                  .join('；') || '暂无缺口'
                return `
                  <article class="rounded-lg border bg-background p-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="text-xs text-muted-foreground">${escapeHtml(task.taskStatus)} · ${escapeHtml(task.updatedAt)}</div>
                        <h4 class="mt-1 truncate text-sm font-semibold">${escapeHtml(task.pickingTaskNo)}</h4>
                      </div>
                      <span class="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">二次分拣</span>
                    </div>
                    <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div><span class="font-medium text-foreground">车缝任务：</span>${escapeHtml(task.sewingTaskNo)}</div>
                      <div><span class="font-medium text-foreground">接收工厂：</span>${escapeHtml(task.receiverFactoryName)}</div>
                      <div><span class="font-medium text-foreground">需要数量：</span>${escapeHtml(formatPieceQty(requiredQty))}</div>
                      <div><span class="font-medium text-foreground">已分配库存：</span>${escapeHtml(formatPieceQty(allocatedQty))}</div>
                      <div><span class="font-medium text-foreground">已分拣数量：</span>${escapeHtml(formatPieceQty(pickedQty))}</div>
                      <div><span class="font-medium text-foreground">已装袋数量：</span>${escapeHtml(formatPieceQty(packedQty))}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">来源暂存袋：</span>${escapeHtml(task.tempBagSources.map((item) => item.tempBagCode).join('、') || '待扫描')}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">目标中转袋：</span>${escapeHtml(task.targetTransferBags.map((bag) => bag.bagCode).join('、') || '待重新装袋')}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">分拣后缺口：</span>${escapeHtml(shortagePreview)}</div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">扫码分拣</button>
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">确认装袋</button>
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">查看缺口</button>
                    </div>
                  </article>
                `
              }).join('')
            : '<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground xl:col-span-2">暂无待交出仓裁片配料任务。</div>'
        }
      </div>
      <div class="mt-4 grid gap-3 xl:grid-cols-2">
        <div class="rounded-lg border bg-background p-3">
          <h4 class="text-sm font-semibold">扫码校验</h4>
          <ul class="mt-2 space-y-1 text-xs text-muted-foreground">
            ${
              projection.scanChecks.length
                ? projection.scanChecks
                    .slice(0, 8)
                    .map((check) => `<li>${escapeHtml(check.scanObject)} ${escapeHtml(check.scannedValue)}：${escapeHtml(check.checkResult)}，${escapeHtml(check.reason)}，同步：${escapeHtml(check.syncStatus)}</li>`)
                    .join('')
                : '<li>暂无扫码校验记录。</li>'
            }
          </ul>
        </div>
        <div class="rounded-lg border bg-background p-3">
          <h4 class="text-sm font-semibold">装袋规则</h4>
          <ul class="mt-2 space-y-1 text-xs text-muted-foreground">
            ${projection.ruleNotes.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
          </ul>
        </div>
      </div>
    </section>
  `
}

function renderWaitHandoverWorkbench(projection: WaitHandoverWorkbenchProjection): string {
  return `
    <section class="space-y-4">
      ${renderWaitHandoverSnapshot(projection)}
      ${renderInboundTempBagArea(projection.inboundTempBags, projection.inboundInventoryRecords)}
      ${renderSewingAllocationArea(projection.sewingAllocationProjection)}
      ${renderSpecialCraftHandoverArea(projection.specialCraftHandoverGroups)}
      ${renderSpecialCraftReturnArea(projection.specialCraftReturnProjection)}
      ${renderHandoverPickingArea(projection.handoverPickingProjection)}
      <section class="grid gap-4 xl:grid-cols-2">
        ${renderWaitHandoverWorkArea('待入仓确认', '已打印菲票进入裁床待交出仓前的确认入口。', projection.pendingInboundItems, '暂无待入仓确认菲票。')}
        ${renderWaitHandoverWorkArea('待二次分拣', '车缝任务分配后，从入仓暂存袋按任务拣出裁片。', projection.pendingSortingItems, '暂无待二次分拣任务。')}
        ${renderWaitHandoverWorkArea('待重新装袋', '二次分拣后重新装入中转袋，准备交出。', projection.pendingRebaggingItems, '暂无待重新装袋任务。')}
        ${renderWaitHandoverWorkArea('待新增交出记录', '已装袋后新增交出记录；齐套和缺口在交出后计算。', projection.pendingHandoverRecordItems, '暂无待新增交出记录。')}
        <div class="xl:col-span-2">
          ${renderWaitHandoverWorkArea('接收差异 / 交出后缺口', '展示接收回写差异、异议和交出后缺口。', projection.discrepancyAndShortageItems, '暂无接收差异或交出后缺口。')}
        </div>
      </section>
    </section>
  `
}

function mapSpecialCraftReturnInventoryForWaitHandover(
  records: SpecialCraftReturnInventoryRecord[],
): InboundTempBagInventoryRecord[] {
  return records.map((record) => ({
    inventoryRecordId: record.inventoryRecordId,
    feiTicketId: record.feiTicketId,
    feiTicketNo: record.feiTicketNo,
    cutOrderId: record.cutOrderId,
    cutOrderNo: record.cutOrderNo,
    productionOrderId: record.productionOrderId,
    productionOrderNo: record.productionOrderNo,
    spuCode: record.spuCode,
    color: record.color,
    size: record.size,
    partName: record.partName,
    pieceQty: record.pieceQty,
    pieceSequenceLabel: record.pieceSequenceLabel,
    hasSpecialCraft: !record.specialCraftReadyForSewing,
    specialCraftDisplay: record.specialCraftReadyForSewing
      ? `${record.specialCraftDisplay}，可参与车缝任务分配`
      : `${record.specialCraftDisplay}，仍有${record.remainingSpecialCraftDisplay || '回仓差异'}待处理`,
    receiverFactoryDisplay: record.receiverFactoryDisplay,
    printStatus: '已首打',
    voidStatus: '有效',
    tempBagCode: '特殊工艺回仓',
    warehouseArea: record.warehouseArea,
    locationCode: record.locationCode,
    inboundAt: record.inboundAt,
    inventoryStatus: record.inventoryStatus === '待分配' ? '待分配' : '已作废或不可用',
  }))
}

export function renderCraftCuttingWarehouseManagementWaitProcessPage(): string {
  const fabricSummary = buildFabricWarehouseProjection().viewModel.summary
  const materialLedgerSummary = buildWaitProcessMaterialLedgerSummary()
  const dispatchRows = listCuttingSpecialCraftDispatchViews()
  const generatedDispatchCount = dispatchRows.filter((row) => row.handoverRecordNo && row.handoverRecordNo !== '未创建').length
  const operationCount = uniqueCount(dispatchRows.map((row) => row.operationName))
  const factoryCount = uniqueCount(dispatchRows.map((row) => row.targetFactoryName))
  const activeTab = readTabKey<WaitProcessTabKey>('inventory', ['inventory', 'receipts', 'usage', 'locations'])

  const fabricWarehouseCard = renderHubActionCard({
    title: '待加工仓面料数量账',
    rows: [
      ['需求用量', formatLength(materialLedgerSummary.requiredQty, materialLedgerSummary.unit)],
      ['中转仓已配数量', formatLength(materialLedgerSummary.configuredQty, materialLedgerSummary.unit)],
      ['裁床已领数量', formatLength(materialLedgerSummary.claimedQty, materialLedgerSummary.unit)],
      ['已锁定数量', formatLength(materialLedgerSummary.lockedQty, materialLedgerSummary.unit)],
      ['已消耗数量', formatLength(materialLedgerSummary.consumedQty, materialLedgerSummary.unit)],
      ['可用余额', formatLength(materialLedgerSummary.availableQty, materialLedgerSummary.unit)],
    ],
  })

  const specialCraftDispatchCard = renderHubActionCard({
    title: '特殊工艺待加工 / 交出',
    rows: [
      ['待发记录数', dispatchRows.length],
      ['已生成交出单数', generatedDispatchCount],
      ['涉及工艺数', operationCount],
      ['涉及工厂数', factoryCount],
    ],
  })

  const standardTabs: FactoryWarehouseStandardTab[] = [
    {
      key: 'inventory',
      label: '库存',
      count: fabricSummary.stockItemCount + dispatchRows.length,
      content: `<section class="grid gap-4 xl:grid-cols-2">${fabricWarehouseCard}${specialCraftDispatchCard}${renderWaitProcessLedgerPreview(materialLedgerSummary.rows)}</section>`,
    },
    {
      key: 'receipts',
      label: '领料记录',
      count: fabricSummary.rollCount + generatedDispatchCount,
      content: `<section class="grid gap-4 xl:grid-cols-2">
        ${renderHubActionCard({
          title: '面料领料记录',
          rows: [
            ['领料卷数', fabricSummary.rollCount],
            ['面料 SKU 数', fabricSummary.stockItemCount],
            ['裁床已领数量', formatLength(materialLedgerSummary.claimedQty, materialLedgerSummary.unit)],
            ['可用余额', formatLength(materialLedgerSummary.availableQty, materialLedgerSummary.unit)],
            ['最近领料记录', materialLedgerSummary.latestClaimEvent ? `${materialLedgerSummary.latestClaimEvent.cutOrderNo} · ${materialLedgerSummary.latestClaimEvent.occurredAt}` : '暂无'],
          ],
        })}
        ${renderHubActionCard({
          title: '特殊工艺交出记录',
          rows: [
            ['待发记录数', dispatchRows.length],
            ['已生成交出单数', generatedDispatchCount],
            ['涉及工艺数', operationCount],
            ['涉及工厂数', factoryCount],
          ],
        })}
      </section>`,
    },
    {
      key: 'usage',
      label: '加工用料记录',
      count: fabricSummary.stockItemCount,
      content: `<section class="grid gap-4 xl:grid-cols-2">
        ${renderHubActionCard({
          title: '铺布裁剪用料',
          rows: [
            ['配置长度总量', `${formatNumber(fabricSummary.configuredLengthTotal)} m`],
            ['剩余长度总量', `${formatNumber(fabricSummary.remainingLengthTotal)} m`],
            ['已消耗数量', formatLength(materialLedgerSummary.consumedQty, materialLedgerSummary.unit)],
            ['低余量项数', fabricSummary.lowRemainingItemCount],
          ],
        })}
        ${renderHubGuideCard('用料口径', ['待加工仓库存由领料形成。', '铺布、裁剪、特殊工艺交出会扣减待加工仓库存。'])}
      </section>`,
    },
    {
      key: 'locations',
      label: '库区库位',
      count: 3,
      content: `<div class="border-b px-4 py-3">${renderWarehouseLocationToolbar('裁床待加工仓')}</div>${renderLocationRows('裁床待加工仓', [
        ['裁床待加工仓', '面料 A 区', 'FAB-A-01', '待裁面料'],
        ['裁床待加工仓', '面料 B 区', 'FAB-B-02', '补料 / 余料'],
        ['特殊工艺待交出区', '交出暂存区', 'SP-DISPATCH-01', '待交出特殊工艺裁片'],
      ])}`,
    },
  ]

  return renderHubShell({
    metaKey: 'warehouse-management-wait-process',
    description: '查看领料接收后的待加工仓、裁床仓和特殊工艺待加工。',
    kpis: [
      renderCompactKpiCard('面料 SKU 数', fabricSummary.stockItemCount, '裁床仓', 'text-blue-600'),
      renderCompactKpiCard('中转仓已配数量', formatLength(materialLedgerSummary.configuredQty, materialLedgerSummary.unit), '待加工仓面料数量账', 'text-blue-600'),
      renderCompactKpiCard('裁床已领数量', formatLength(materialLedgerSummary.claimedQty, materialLedgerSummary.unit), '待加工仓面料数量账', 'text-slate-700'),
      renderCompactKpiCard('可用余额', formatLength(materialLedgerSummary.availableQty, materialLedgerSummary.unit), '待加工仓面料数量账', 'text-emerald-600'),
      renderCompactKpiCard('待交出特殊工艺记录数', dispatchRows.length, '特殊工艺交出', 'text-amber-600'),
    ].join(''),
    tabs: '',
    content: renderFactoryWarehouseStandardTabs(
      standardTabs.sort((a, b) => Number(b.key === activeTab) - Number(a.key === activeTab)),
      'cutting-wait-process-standard-tabs',
    ),
  })
}

export function renderCraftCuttingWarehouseManagementWaitHandoverPage(): string {
  const cutPieceViewModel = buildCutPieceWarehouseProjection().viewModel
  const cutPieceSummary = cutPieceViewModel.summary
  const transferBagViewModel = buildTransferBagsProjection().viewModel
  const generatedTickets = listSpreadingResultGeneratedFeiTickets()
  const dispatchOrders = listCuttingSewingDispatchOrders()
  const dispatchBatches = listCuttingSewingDispatchBatches()
  const transferBags = listCuttingSewingTransferBags()
  const validationResults = listCuttingSewingDispatchValidationResults()
  const availableSewingPieceInventory = listAvailableCutPieceInventoryForSewingDispatch()
  const returnRows = listCuttingSpecialCraftReturnViews()
  const sewingSummary = getSafeCuttingSewingDispatchSummary()
  const completedReturnCount = returnRows.filter((row) => row.returnStatus === '已回仓').length
  const returnDifferenceCount = returnRows.filter((row) => row.returnStatus === '差异' || row.differenceQty > 0).length
  const sortingTaskSummary = transferBagViewModel.sortingTaskSummary
  const pendingSortingUsageCount = sortingTaskSummary.pendingCount + sortingTaskSummary.sortingCount
  const sortedUsageCount = sortingTaskSummary.packedCount + sortingTaskSummary.handedOverCount
  const exceptionValidationCount = validationResults.filter((result) => result.validationType !== '通过').length
  const inboundTempBags = buildInboundTempBagsFromTransferBagViewModel(transferBagViewModel)
  const inboundInventoryRecords = buildInboundTempBagInventoryRecords(inboundTempBags)
  const specialCraftReturnProjection = buildSpecialCraftReturnProjection()
  const specialCraftReturnInventoryRecords = specialCraftReturnProjection.inventoryRecords
  const effectiveInventoryRecords = [
    ...inboundInventoryRecords,
    ...mapSpecialCraftReturnInventoryForWaitHandover(specialCraftReturnInventoryRecords),
  ]
  const sewingAllocationProjection = buildSewingTaskAllocationProjectionFromInventory(effectiveInventoryRecords)
  const handoverPickingProjection = buildHandoverPickingTaskProjectionFromAllocationProjection(sewingAllocationProjection)
  const universalHandoverProjection = buildUniversalHandoverProjection()
  const activeTab = readTabKey<WaitHandoverTabKey>('workbench', ['workbench', 'inventory', 'assignment', 'sorting', 'special-craft-return', 'handoverOrders', 'handoverRecords', 'locations'])
  const assignedTaskCount = sewingAllocationProjection.allocations.length
  const workbenchProjection = buildWaitHandoverWorkbenchProjection({
    ticketCandidates: transferBagViewModel.ticketCandidates,
    generatedTickets,
    inboundTempBags,
    inboundInventoryRecords,
    specialCraftReturnProjection,
    specialCraftReturnInventoryRecords,
    sewingAllocationProjection,
    handoverPickingProjection,
    cutPieceItems: cutPieceViewModel.items,
    cutPieceSummary,
    transferBagSummary: transferBagViewModel.summary,
    sortingTaskSummary,
    sortingTasks: transferBagViewModel.sortingTasks,
    dispatchBatches,
    validationResults,
    returnRows,
    dispatchOrderCount: dispatchOrders.length,
    sewingSummary,
  })

  const cutPieceWarehouseCard = renderHubActionCard({
    title: '裁片库存',
    rows: [
      ['记录数', cutPieceSummary.totalItemCount],
      ['裁片总数量', cutPieceSummary.totalQuantity],
      ['菲票库存', transferBagViewModel.ticketCandidates.length],
      ['已入仓数量', cutPieceSummary.inWarehouseCount],
      ['待交出数量', cutPieceSummary.waitingHandoffCount],
    ],
  })

  const specialCraftReturnCard = renderHubActionCard({
    title: '特殊工艺回仓补入库存',
    rows: [
      ['回仓记录数', returnRows.length + specialCraftReturnProjection.summary.returnRecordCount],
      ['已完成回仓数', completedReturnCount + specialCraftReturnProjection.summary.returnedCount],
      ['差异数', returnDifferenceCount + specialCraftReturnProjection.summary.discrepancyCount],
      ['回仓库存记录', specialCraftReturnProjection.summary.returnedInventoryCount],
      ['可参与车缝分配', specialCraftReturnProjection.summary.readyForSewingCount],
    ],
  })

  const sewingAssignmentCard = renderHubActionCard({
    title: '车缝任务分配',
    rows: [
      ['可分配库存记录', sewingAllocationProjection.availableInventoryCount],
      ['可分配裁片数量', formatPieceQty(sewingAllocationProjection.availablePieceQty)],
      ['库存占用记录', sewingAllocationProjection.reservedInventoryCount],
      ['已释放占用', sewingAllocationProjection.releasedReservations.length],
      ['特殊工艺未回仓', sewingAllocationProjection.specialCraftPendingCount],
    ],
  })

  const sortingCard = renderHubActionCard({
    title: '待交出仓配料',
    rows: [
      ['裁片配料任务', handoverPickingProjection.taskCount],
      ['待分拣 / 分拣中', handoverPickingProjection.pendingCount + handoverPickingProjection.sortingCount],
      ['已装袋待交出', handoverPickingProjection.packedCount],
      ['分拣后缺口', handoverPickingProjection.shortageCount],
      ['目标中转袋数', handoverPickingProjection.targetTransferBagCount],
      ['PDA 同步失败', handoverPickingProjection.syncFailedCount],
    ],
  })

  const sewingDispatchCard = renderHubActionCard({
    title: '交出单',
    rows: [
      ['交出单数', universalHandoverProjection.summary.orderCount],
      ['待核对 / 待扫码', sewingSummary.waitingCompleteOrderCount],
      ['可新增交出记录', sewingSummary.readyBatchCount],
      ['交出记录数', universalHandoverProjection.summary.recordCount],
      ['差异 / 异议', universalHandoverProjection.summary.discrepancyCount + universalHandoverProjection.summary.objectionCount],
    ],
  })

  const cutPieceInventoryRows = cutPieceViewModel.items.slice(0, 8).map((item) => [
    item.cutOrderNo,
    item.productionOrderNo,
    item.materialSku,
    `${item.quantity} 片`,
    item.warehouseStatus.label.replace('交接', '交出'),
    item.bagCode ? `${item.bagCode}${item.bagUsageStageLabel ? ` / ${item.bagUsageStageLabel}` : ''}` : '未入暂存袋',
  ])
  const sortingRows = handoverPickingProjection.tasks.slice(0, 8).map((task) => [
    task.pickingTaskNo,
    task.sewingTaskNo,
    task.tempBagSources.map((item) => item.tempBagCode).join('、') || '待扫来源暂存袋',
    task.targetTransferBags.map((bag) => bag.bagCode).join('、') || '待扫目标中转袋',
    `${task.pickedItems.length}/${task.allocatedInventoryItems.length} 张`,
    task.receiverFactoryName,
    task.shortageItems.length
      ? task.shortageItems.slice(0, 2).map((item) => `${item.size}/${item.partName}缺${item.shortageQty}`).join('；')
      : '暂无缺口',
    task.taskStatus,
  ])
  const handoverOrderRows = universalHandoverProjection.orders.slice(0, 8).map((order) => [
    order.handoverOrderNo,
    order.relatedProductionOrderIds.join('、'),
    `${order.receiverType} / ${order.receiverName}`,
    `${order.totalHandedOverPieceQty} 片`,
    `${order.totalRecordCount} 条记录`,
    order.status,
  ])
  const handoverRecordRows = universalHandoverProjection.records.slice(0, 8).map((record) => [
    record.handoverOrderNo,
    record.relatedProductionOrderIds.join('、'),
    record.handoverRecordNo,
    record.previousHandedOverSummary.map((item) => item.summaryText).join('；') || '0 片',
    record.currentHandedOverSummary.map((item) => item.summaryText).join('；') || '0 片',
    record.cumulativeHandedOverSummary.map((item) => item.summaryText).join('；') || '0 片',
    buildHandoverAfterRecordResult(record).completenessResult.summaryText,
    record.transferBagUses.map((bag) => bag.bagCode).join('、') || '未装袋',
    record.recordStatus,
  ])

  const standardTabs: FactoryWarehouseStandardTab[] = [
    {
      key: 'workbench',
      label: '裁后工作台',
      count:
        workbenchProjection.pendingInboundItems.length +
        workbenchProjection.pendingSortingItems.length +
        workbenchProjection.pendingRebaggingItems.length +
        workbenchProjection.pendingHandoverRecordItems.length +
        workbenchProjection.discrepancyAndShortageItems.length,
      content: renderWaitHandoverWorkbench(workbenchProjection),
    },
    {
      key: 'inventory',
      label: '裁片库存',
      count: cutPieceSummary.totalItemCount,
      content: `<section class="space-y-4">
        <div class="grid gap-4 xl:grid-cols-2">${cutPieceWarehouseCard}${specialCraftReturnCard}</div>
        ${renderHubTable(['裁片单', '生产单', '面料', '库存数量', '库存状态', '入仓暂存袋'], cutPieceInventoryRows)}
      </section>`,
    },
    {
      key: 'assignment',
      label: '车缝任务分配',
      count: assignedTaskCount,
      content: `<section class="space-y-4">
        ${sewingAssignmentCard}
        ${renderSewingAllocationArea(sewingAllocationProjection)}
      </section>`,
    },
    {
      key: 'sorting',
      label: '待交出仓配料',
      count: handoverPickingProjection.taskCount,
      content: `<section class="space-y-4">
        ${sortingCard}
        ${renderHandoverPickingArea(handoverPickingProjection)}
        ${renderHubTable(['配料任务', '车缝任务', '来源暂存袋', '目标中转袋', '已分拣菲票', '接收对象', '分拣后缺口', '状态'], sortingRows)}
      </section>`,
    },
    {
      key: 'special-craft-return',
      label: '特殊工艺回仓',
      count: specialCraftReturnProjection.summary.returnRecordCount,
      content: renderSpecialCraftReturnArea(specialCraftReturnProjection),
    },
    {
      key: 'handoverOrders',
      label: '交出单',
      count: universalHandoverProjection.summary.orderCount,
      content: `<section class="space-y-4">
        ${sewingDispatchCard}
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/cutting/handover-orders">打开交出单列表</button>
        </div>
        ${renderHubTable(['交出单', '生产单', '接收对象', '累计已交', '交出记录', '状态'], handoverOrderRows)}
      </section>`,
    },
    {
      key: 'handoverRecords',
      label: '交出记录',
      count: universalHandoverProjection.summary.recordCount,
      content: `<section class="space-y-4">
        ${renderHubActionCard({
          title: '交出记录',
          rows: [
            ['已生成记录数', universalHandoverProjection.summary.recordCount],
            ['已交出批次', sewingSummary.handedOverBatchCount],
            ['已回写批次', sewingSummary.writtenBackBatchCount],
            ['差异 / 异议记录', universalHandoverProjection.summary.discrepancyCount + universalHandoverProjection.summary.objectionCount],
          ],
        })}
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/cutting/handover-orders">打开交出单列表</button>
        </div>
        ${renderHubTable(['交出记录来源', '生产单', '交出记录', '之前已交', '本次交出', '累计交出', '交出后结果', '中转袋', '状态'], handoverRecordRows)}
      </section>`,
    },
    {
      key: 'locations',
      label: '库区库位',
      count: 3,
      content: `<div class="border-b px-4 py-3">${renderWarehouseLocationToolbar('裁床待交出仓')}</div>${renderLocationRows('裁床待交出仓', [
        ['裁床待交出仓', '裁片 A 区', 'CUT-A-01', '待交出裁片'],
        ['裁床待交出仓', '特殊工艺回仓区', 'SP-RETURN-01', '回仓裁片'],
        ['裁床待交出仓', '中转袋暂存区', 'BAG-A-01', '待交出中转袋'],
      ])}`,
    },
  ]

  return renderHubShell({
    metaKey: 'warehouse-management-wait-handover',
    description: '聚合已打印菲票、裁片库存、入仓暂存袋、二次分拣、重新装袋、交出记录和接收差异。',
    kpis: workbenchProjection.overviewCards
      .map((card) => renderCompactKpiCard(card.label, card.value, card.hint, card.tone))
      .join(''),
    tabs: '',
    content: renderFactoryWarehouseStandardTabs(
      standardTabs.sort((a, b) => Number(b.key === activeTab) - Number(a.key === activeTab)),
      'cutting-wait-handover-standard-tabs',
    ),
  })
}
