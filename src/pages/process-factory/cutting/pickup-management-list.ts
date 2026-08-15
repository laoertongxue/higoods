// @page-pattern: list

import { renderSecondaryButton } from '../../../components/ui/button.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../../../components/ui/list-table.ts'
import {
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  listPickupDiscrepancies,
  reportPickupDiscrepancy,
  resolvePickupDiscrepancy,
} from '../../../data/fcs/cutting/pickup-discrepancy.ts'
import {
  confirmPickupNodeReceiptRuntime,
  listActivePickupNodesRuntime,
} from '../../../runtime/fcs/cutting/pickup-management-runtime.ts'
import {
  handleWarehouseLocationMapViewportEvent,
  renderWarehouseLocationMap,
} from '../../../components/ui/warehouse-location-map.ts'
import {
  getProductionOrderIdentity,
  renderProductionObjectCodeButton,
} from '../../../data/fcs/production-order-identity.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  buildCuttingWarehouseMapProjectionForWarehouse,
  listCuttingWarehouses,
} from './warehouse-location-map.ts'
import {
  listWarehouseLocationMapCells,
  revalidateWarehouseLocationSelection,
  toggleWarehouseLocationSelection,
  type StableWarehouseLocationRef,
  type WarehouseLocationMapProjection,
} from './warehouse-location-map-model.ts'
import {
  listPickupOrderGroups,
  type PickupListKind,
  type PickupMaterialDemandRow,
  type PickupOrderGroup,
} from './pickup-management-projection.ts'
import {
  buildPickupOrderCards,
  type PickupOrderCard,
} from './pickup-management-card-model.ts'

export { buildPickupOrderCards } from './pickup-management-card-model.ts'

const PAGE_SIZES = [10, 20, 50]
const EVENT_PREFIX = 'pickup-list'
export const PICKUP_LIST_FILTER_DEBOUNCE_MS = 120
const PREFERENCE_KEYS: Record<PickupListKind, string> = {
  READY: 'standard-list:/fcs/craft/cutting/pickup-management/ready',
  INCOMPLETE: 'standard-list:/fcs/craft/cutting/pickup-management/incomplete',
  HISTORY: 'standard-list:/fcs/craft/cutting/pickup-management/history',
}

interface PickupListState {
  keyword: string
  materialKeyword: string
  demandSource: string
  processRoute: string
  readySource: string
  palletNumbered: string
  locationKeyword: string
  shortageOnly: string
  historyPath: string
  finalResult: string
  recentDate: string
  currentPage: number
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  columnSettingsOpen: boolean
  draggedColumnKey: string
  selectedRecordGroupKey: string
  imagePreview: { src: string; alt: string } | null
  receiptDraft: PickupReceiptDraft | null
}

interface PickupReceiptDraft {
  groupKey: string
  pickupNodeId: string
  pickupNodeVersion: number
  receiverName: string
  warehouseId: string
  selectedLocationIds: string[]
  differenceOpen: boolean
  differenceDemandLineId: string
  differenceQty: string
  differenceNote: string
  differencePhotoName: string
  feedbackMessage: string
  submitting: boolean
}

interface PickupMaterialCardRow {
  group: PickupOrderGroup
  material: PickupMaterialDemandRow
}

interface PickupGroupSortOption {
  key: string
  label: string
  value: (card: PickupOrderCard) => unknown
}

const states = new Map<PickupListKind, PickupListState>()
const searchDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
const groupSnapshots = new Map<PickupListKind, PickupOrderGroup[]>()

export function pickupListFilterDebounceKey(kind: PickupListKind, field: string): string {
  return `${kind}:${field}`
}

function cancelPickupListDebouncesBeforeRender(): void {
  for (const [key, timer] of searchDebounceTimers) {
    clearTimeout(timer)
    searchDebounceTimers.delete(key)
  }
}

function formatQty(value: number, unit: string): string {
  return `${Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${escapeHtml(unit)}`
}

function toReceiveLabel(value: string): string {
  return value
    .replaceAll('待领', '待接收')
    .replaceAll('可领', '可接收')
    .replaceAll('领后', '接收后')
    .replaceAll('领完', '接收完成')
    .replaceAll('领取', '接收')
}

function renderPickupImage(imageUrl: string, alt: string, sizeClass: string): string {
  if (!imageUrl) {
    return `<div class="${sizeClass} flex shrink-0 items-center justify-center rounded border bg-muted px-1 text-center text-[9px] text-muted-foreground">图片未提供</div>`
  }
  return `<button type="button" class="relative ${sizeClass} shrink-0 overflow-hidden rounded border bg-muted" data-pickup-list-action="open-image-preview" data-image-src="${escapeHtml(imageUrl)}" data-image-alt="${escapeHtml(alt)}" aria-label="查看${escapeHtml(alt)}大图">
    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(alt)}" class="h-full w-full object-cover" loading="lazy" onload="this.nextElementSibling.textContent='';this.nextElementSibling.classList.add('hidden')" onerror="this.classList.add('hidden');this.nextElementSibling.textContent='图片加载失败'">
    <span class="absolute inset-0 flex items-center justify-center bg-muted px-1 text-center text-[9px] text-muted-foreground">图片加载中</span>
  </button>`
}

function renderPickupMaterialImage(row: PickupMaterialDemandRow, sizeClass = 'h-12 w-12'): string {
  return renderPickupImage(
    row.materialImageUrl,
    `${row.materialName}（${row.materialSku}）实物图`,
    sizeClass,
  )
}

function renderStyleImage(group: PickupOrderGroup): string {
  return renderPickupImage(
    group.spuImageUrl,
    `${group.styleName || group.styleNo || group.spu}款式图`,
    'h-16 w-16',
  )
}

function renderMaterialIdentity(row: PickupMaterialDemandRow): string {
  return `<div class="flex items-start gap-2" data-pickup-material-row="${escapeHtml(row.rowKey)}">
    ${renderPickupMaterialImage(row)}
    <div class="min-w-0">
      <div class="font-medium text-foreground">${escapeHtml(row.materialName)}</div>
      <div class="mt-0.5 break-all text-xs text-muted-foreground">${escapeHtml(row.materialSku)}</div>
      <div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(row.color)} / ${escapeHtml(row.spec)} / ${escapeHtml(row.materialType)}</div>
    </div>
  </div>`
}

function renderMaterialSource(group: PickupOrderGroup, row: PickupMaterialDemandRow): string {
  const label = row.demandSource === 'SUPPLEMENT'
    ? `补料第 ${group.supplementSequenceNo || 1} 次`
    : '配料'
  return `<div class="text-xs"><div class="font-medium">${escapeHtml(label)}</div><div class="mt-0.5 break-all text-muted-foreground">${escapeHtml(row.demandSourceNo || row.demandLineId)}</div></div>`
}

function renderMaterialLocations(group: PickupOrderGroup, row: PickupMaterialDemandRow): string {
  if (group.carrierType === 'PALLET') {
    return `<div class="text-xs leading-5"><span class="font-medium text-emerald-700">托盘</span><br><span class="text-muted-foreground">${escapeHtml(toReceiveLabel(group.palletDisplayLabel || '暂未编号'))}</span></div>`
  }
  if (!row.currentLocations.length) return '<span class="text-xs text-muted-foreground">暂无库位</span>'
  return `<div class="space-y-1 text-xs leading-5">
    ${row.currentLocations.map((location) => `<div><span class="font-medium">${escapeHtml(location.sourceWarehouseArea)} / ${escapeHtml(location.sourceLocationCode)}</span><br><span class="text-muted-foreground">${formatQty(location.currentAvailableQty, location.unit)}</span></div>`).join('')}
  </div>`
}

function renderQty(value: number, unit: string, toneClass = ''): string {
  return `<strong class="tabular-nums ${toneClass}">${formatQty(value, unit)}</strong>`
}

function materialColumnsFor(kind: PickupListKind): StandardListColumn<PickupMaterialCardRow>[] {
  return [
    { key: 'material', title: '物料', width: 250, required: true, freezeable: true, render: ({ material }) => renderMaterialIdentity(material) },
    { key: 'source', title: '需求来源', width: 140, freezeable: true, render: ({ group, material }) => renderMaterialSource(group, material) },
    { key: 'location', title: '位置 / 载体', width: 180, required: true, freezeable: true, render: ({ group, material }) => renderMaterialLocations(group, material) },
    { key: 'requiredQty', title: '应配', width: 105, required: true, align: 'right', render: ({ material }) => renderQty(material.requiredQty, material.unit) },
    { key: 'preparedQty', title: '当前配料', width: 105, align: 'right', render: ({ material }) => renderQty(material.preparedQty, material.unit) },
    { key: 'pickedQty', title: '累计接收', width: 110, required: true, align: 'right', render: ({ material }) => renderQty(material.pickedQty, material.unit) },
    { key: 'currentAvailableQty', title: '本轮可接收', width: 115, required: true, align: 'right', render: ({ material }) => renderQty(material.currentAvailableQty, material.unit, material.currentAvailableQty > 0 ? 'text-blue-700' : '') },
    {
      key: 'remainingQty',
      title: kind === 'HISTORY' ? '剩余' : '接收后仍缺',
      width: 115,
      required: true,
      align: 'right',
      render: ({ material }) => renderQty(
        kind === 'HISTORY' ? material.remainingPickupQty : material.afterCurrentPickupRemainingQty,
        material.unit,
        (kind === 'HISTORY' ? material.remainingPickupQty : material.afterCurrentPickupRemainingQty) > 0 ? 'text-amber-700' : 'text-emerald-700',
      ),
    },
  ]
}

function cardMaterialRows(card: PickupOrderCard): PickupMaterialDemandRow[] {
  return card.groups.flatMap((group) => group.materialRows)
}

function summarizeQtyByUnit<T extends { unit: string }>(
  rows: T[],
  quantity: (row: T) => number,
): string {
  const totals = new Map<string, number>()
  rows.forEach((row) => totals.set(row.unit, (totals.get(row.unit) ?? 0) + quantity(row)))
  return Array.from(totals)
    .filter(([, value]) => value > 0)
    .map(([unit, value]) => formatQty(value, unit))
    .join('；') || '无'
}

function currentLocationKeys(value: PickupOrderCard | PickupOrderGroup): string[] {
  const groups = 'groups' in value ? value.groups : [value]
  return Array.from(new Set(groups.flatMap((group) => group.materialRows.flatMap((row) => row.currentLocations.map((location) =>
    `${location.sourceWarehouseArea}/${location.sourceLocationCode}`
  )))))
}

function latestCardValue(card: PickupOrderCard, value: (group: PickupOrderGroup) => string): string {
  return card.groups.map(value).filter(Boolean).sort((left, right) => right.localeCompare(left))[0] ?? ''
}

function renderCardSummary(kind: PickupListKind, card: PickupOrderCard): string {
  const rows = cardMaterialRows(card)
  const availableRows = rows.filter((row) => row.currentAvailableQty > 0)
  if (kind === 'READY') {
    const sourceLabel = card.groups.some((group) => group.readySource === 'UPGRADED_FROM_INCOMPLETE') ? '由未配齐升级' : '直接配齐'
    return `<div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs" data-pickup-card-summary="READY">
      <strong class="text-emerald-700">${escapeHtml(sourceLabel)}</strong>
      <span>可接收 <strong>${availableRows.length} 种</strong></span>
      <span>数量 <strong>${summarizeQtyByUnit(availableRows, (row) => row.currentAvailableQty)}</strong></span>
      <span class="text-muted-foreground">配齐 ${escapeHtml(latestCardValue(card, (group) => group.currentNodeUpdatedAt) || '—')}</span>
    </div>`
  }
  if (kind === 'INCOMPLETE') {
    const shortageRows = rows.filter((row) => row.afterCurrentPickupRemainingQty > 0)
    return `<div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs" data-pickup-card-summary="INCOMPLETE">
      <span>库位 <strong>${currentLocationKeys(card).length} 个</strong></span>
      <span>可接收 <strong>${availableRows.length} 种</strong></span>
      <span>仍缺 <strong>${shortageRows.length} 种</strong></span>
      <span>缺口 <strong>${summarizeQtyByUnit(shortageRows, (row) => row.afterCurrentPickupRemainingQty)}</strong></span>
      <span class="text-muted-foreground">配料 ${escapeHtml(latestCardValue(card, (group) => group.currentNodeUpdatedAt) || '—')}</span>
    </div>`
  }
  const primary = card.primaryGroup
  const pathLabel = historyPathLabel(primary)
  const resultLabel = historyResultLabel(primary)
  return `<div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs" data-pickup-card-summary="HISTORY">
    <strong>${escapeHtml(pathLabel)}</strong>
    <strong class="${primary.finalResult === 'ALL_PICKED' ? 'text-emerald-700' : 'text-amber-700'}">${escapeHtml(resultLabel)}</strong>
    <span>接收 <strong>${primary.pickupSessionCount} 次</strong></span>
    <span>${escapeHtml(primary.latestPickerName || '暂无')} · ${escapeHtml(primary.latestPickedAt || '暂无')}</span>
  </div>`
}

function historyPathLabel(group: PickupOrderGroup): string {
  return group.historyPath === 'INCOMPLETE_PICKUP' ? '未配齐先接收' : '已配齐后接收'
}

function historyResultLabel(group: PickupOrderGroup): string {
  if (group.finalResult === 'ALL_PICKED') return '全部接收'
  if (group.finalResult === 'NEW_SUPPLEMENT_WAIT_PICKUP') return '新增补料待接收'
  return '尚未全部接收'
}

function renderPickupAction(group: PickupOrderGroup): string {
  if (!group.pickupNodeId) {
    return '<span class="inline-flex h-8 items-center rounded border border-dashed px-3 text-xs text-muted-foreground">暂不可接收</span>'
  }
  return `<button type="button" class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700" data-pickup-list-action="open-web-receipt" data-group-key="${escapeHtml(group.groupKey)}" title="${escapeHtml(group.supplementOrderNo ? `接收补料单 ${group.supplementOrderNo}` : `接收配料单 ${group.prepOrderNo}`)}">接收</button>`
}

function renderCardActions(kind: PickupListKind, card: PickupOrderCard): string {
  const actionable = card.groups.filter((group) => group.pickupNodeId)
  const receiptActions = kind === 'HISTORY'
    ? actionable.map(renderPickupAction).join('')
    : actionable.length ? actionable.map(renderPickupAction).join('') : renderPickupAction(card.primaryGroup)
  return `<div class="flex flex-wrap items-center justify-end gap-2">
    ${receiptActions}
    <button type="button" class="inline-flex h-8 items-center rounded-md border bg-background px-3 text-xs font-medium text-blue-700 hover:bg-muted" data-pickup-list-action="open-pickup-records" data-group-key="${escapeHtml(card.primaryGroup.groupKey)}">接收记录</button>
  </div>`
}

function renderCompactProductionIdentity(group: PickupOrderGroup): string {
  const identity = getProductionOrderIdentity(group.productionOrderNo)
  const productionOrder = renderProductionObjectCodeButton({
    objectType: 'PRODUCTION_ORDER',
    objectId: identity.productionOrderNo,
    className: 'font-mono font-medium text-blue-600 hover:underline',
  })
  const demandOrders = identity.demandNos.map((demandNo) => renderProductionObjectCodeButton({
    objectType: 'DEMAND',
    objectId: demandNo,
    className: 'font-mono text-blue-600 hover:underline',
  })).join('<span class="text-muted-foreground">、</span>')
  return `<div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs" data-pickup-production-identity>
    <span class="whitespace-nowrap"><span class="text-muted-foreground">生产单</span> ${productionOrder}</span>
    <span class="min-w-0 truncate"><span class="text-muted-foreground">需求单</span> ${demandOrders || '—'}</span>
    <span class="whitespace-nowrap"><span class="text-muted-foreground">售卖</span> <strong class="font-medium">${escapeHtml(identity.saleType)}</strong></span>
    <span class="whitespace-nowrap rounded border bg-background px-2 py-1">${escapeHtml(toReceiveLabel(group.currentNodeState))}</span>
  </div>`
}

function renderStyleSummary(group: PickupOrderGroup): string {
  return `<div class="flex min-w-0 items-center gap-3" data-pickup-style-summary>
    ${renderStyleImage(group)}
    <div class="min-w-0 text-sm">
      <div class="font-medium">${escapeHtml(group.styleNo || '—')} ${escapeHtml(group.styleName || '')}</div>
      <div class="mt-1 break-all text-xs text-muted-foreground">SPU ${escapeHtml(group.spu || '—')}</div>
    </div>
  </div>`
}

function renderDemandSegment(kind: PickupListKind, group: PickupOrderGroup, state: PickupListState): string {
  const segmentTitle = group.supplementOrderNo
    ? `补料单：${group.supplementOrderNo} · 第 ${group.supplementSequenceNo || 1} 次`
    : `配料单：${group.prepOrderNo}`
  const rows = group.materialRows.map((material) => ({ group, material }))
  const historyBadges = kind === 'HISTORY'
    ? `<span class="rounded border bg-background px-2 py-1 text-xs">${escapeHtml(historyPathLabel(group))}</span>
       <span class="rounded border bg-background px-2 py-1 text-xs ${group.finalResult === 'ALL_PICKED' ? 'text-emerald-700' : 'text-amber-700'}">${escapeHtml(historyResultLabel(group))}</span>`
    : ''
  return `<section class="overflow-hidden rounded-md border" data-pickup-demand-segment="${escapeHtml(group.groupKey)}">
    <header class="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
      <div>
        <div class="text-sm font-medium ${group.supplementOrderNo ? 'text-blue-700' : ''}">${escapeHtml(segmentTitle)}</div>
        ${group.supplementOrderNo ? `<div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(group.originalCutOrderNo || '原裁片单未记录')} · ${escapeHtml(group.supplementReason || '原因未记录')}</div>` : ''}
      </div>
      <div class="flex flex-wrap items-center gap-2">
        ${historyBadges}
        <span class="rounded border bg-background px-2 py-1 text-xs">${escapeHtml(toReceiveLabel(group.currentNodeState))}</span>
      </div>
    </header>
    ${renderStandardListTable({
      columns: materialColumnsFor(kind),
      rows,
      preferences: state.preferences,
      sort: null,
      eventPrefix: EVENT_PREFIX,
      emptyText: '当前需求段暂无物料。',
      skipPageRerender: true,
    })}
  </section>`
}

function renderPickupOrderCard(kind: PickupListKind, card: PickupOrderCard, state: PickupListState): string {
  const primary = card.primaryGroup
  return `<article class="overflow-hidden rounded-lg border bg-card" data-pickup-order-card="${escapeHtml(card.cardKey)}" data-production-order-id="${escapeHtml(card.productionOrderId)}" data-production-order-no="${escapeHtml(primary.productionOrderNo)}">
    <header class="grid min-h-12 items-center gap-2 border-b bg-muted/15 px-3 py-2 lg:grid-cols-[minmax(0,1fr)_auto]" data-pickup-card-header>
      ${renderCompactProductionIdentity(primary)}
      <div class="shrink-0">${renderCardActions(kind, card)}</div>
    </header>
    <section class="grid min-h-20 items-center gap-3 border-b px-4 py-2.5 lg:grid-cols-[minmax(280px,0.9fr)_minmax(420px,1.4fr)]" data-pickup-card-summary-band>
      ${renderStyleSummary(primary)}
      <div>${renderCardSummary(kind, card)}</div>
    </section>
    <div class="space-y-2 p-3">
      ${card.groups.map((group) => renderDemandSegment(kind, group, state)).join('')}
    </div>
  </article>`
}

function sortOptionsFor(kind: PickupListKind): PickupGroupSortOption[] {
  const common: PickupGroupSortOption[] = [
    { key: 'productionOrder', label: '生产单号', value: (card) => card.primaryGroup.productionOrderNo },
    { key: 'style', label: '款式 / SPU', value: (card) => `${card.primaryGroup.styleNo}:${card.primaryGroup.spu}` },
    { key: 'nodeState', label: '当前节点状态', value: (card) => card.primaryGroup.currentNodeState },
  ]
  if (kind === 'READY') return [
    ...common,
    { key: 'readySource', label: '配齐方式', value: (card) => card.primaryGroup.readySource },
    { key: 'businessAt', label: '最近配齐时间', value: (card) => latestCardValue(card, (group) => group.currentNodeUpdatedAt) },
  ]
  if (kind === 'INCOMPLETE') return [
    ...common,
    { key: 'businessAt', label: '最近配料时间', value: (card) => latestCardValue(card, (group) => group.currentNodeUpdatedAt) },
  ]
  return [
    ...common,
    { key: 'finalResult', label: '最终结果', value: (card) => card.primaryGroup.finalResult },
    { key: 'businessAt', label: '最近接收时间', value: (card) => card.primaryGroup.latestPickedAt },
  ]
}

function titleFor(kind: PickupListKind): string {
  if (kind === 'READY') return '已配齐待接收'
  if (kind === 'INCOMPLETE') return '未配齐配料'
  return '已接收'
}

function getState(kind: PickupListKind): PickupListState {
  const existing = states.get(kind)
  if (existing) return existing
  const columns = materialColumnsFor(kind)
  const defaults = normalizeListColumnPreferences(
    columns,
    {
      order: columns.map((column) => column.key),
      visibleKeys: columns.map((column) => column.key),
      frozenKeys: ['material'],
      pageSize: PAGE_SIZES[0],
    },
    PAGE_SIZES,
  )
  const preferences = typeof localStorage === 'undefined'
    ? defaults
    : loadListColumnPreferences(localStorage, PREFERENCE_KEYS[kind], columns, defaults, PAGE_SIZES)
  const created: PickupListState = {
    keyword: '',
    materialKeyword: '',
    demandSource: 'ALL',
    processRoute: 'ALL',
    readySource: 'ALL',
    palletNumbered: 'ALL',
    locationKeyword: '',
    shortageOnly: 'ALL',
    historyPath: 'ALL',
    finalResult: 'ALL',
    recentDate: '',
    currentPage: 1,
    sort: null,
    preferences,
    columnSettingsOpen: false,
    draggedColumnKey: '',
    selectedRecordGroupKey: '',
    imagePreview: null,
    receiptDraft: null,
  }
  states.set(kind, created)
  return created
}

function matchesFilters(kind: PickupListKind, group: PickupOrderGroup, state: PickupListState): boolean {
  const keyword = state.keyword.toLowerCase()
  const materialKeyword = state.materialKeyword.toLowerCase()
  if (keyword && !`${group.productionOrderNo} ${group.prepOrderNo}`.toLowerCase().includes(keyword)) return false
  if (materialKeyword) {
    const materialText = `${group.supplementOrderNo || ''} ${group.materialRows
      .map((row) => `${row.materialName} ${row.materialSku} ${row.demandSourceNo}`)
      .join(' ')}`
      .toLowerCase()
    if (!materialText.includes(materialKeyword)) return false
  }
  if (state.demandSource !== 'ALL' && !group.materialRows.some((row) => row.demandSource === state.demandSource)) return false
  if (state.processRoute !== 'ALL' && !group.materialRows.some((row) => row.processRoute === state.processRoute)) return false
  if (kind === 'READY') {
    if (state.readySource !== 'ALL' && group.readySource !== state.readySource) return false
    if (state.palletNumbered === 'NUMBERED' && !group.palletId) return false
    if (state.palletNumbered === 'UNNUMBERED' && group.palletId) return false
  }
  if (kind === 'INCOMPLETE') {
    const locationText = group.materialRows
      .flatMap((row) => row.currentLocations)
      .map((location) => `${location.sourceWarehouseName} ${location.sourceWarehouseArea} ${location.sourceLocationCode}`)
      .join(' ')
      .toLowerCase()
    if (state.locationKeyword && !locationText.includes(state.locationKeyword.toLowerCase())) return false
    if (state.shortageOnly === 'SHORTAGE' && !group.materialRows.some((row) => row.afterCurrentPickupRemainingQty > 0)) return false
  }
  if (kind === 'HISTORY') {
    if (state.historyPath !== 'ALL' && group.historyPath !== state.historyPath) return false
    if (state.finalResult !== 'ALL' && group.finalResult !== state.finalResult) return false
  }
  const latestBusinessAt = kind === 'HISTORY' ? group.latestPickedAt : group.currentNodeUpdatedAt
  if (state.recentDate && (!latestBusinessAt || latestBusinessAt.substring(0, 10) < state.recentDate)) return false
  return true
}

function getPickupGroupSnapshot(kind: PickupListKind): PickupOrderGroup[] {
  const existing = groupSnapshots.get(kind)
  if (existing) return existing
  const created = listPickupOrderGroups(kind)
  groupSnapshots.set(kind, created)
  return created
}

function getView(kind: PickupListKind): {
  groups: PickupOrderGroup[]
  cards: PickupOrderCard[]
  paging: ReturnType<typeof paginateStandardListRows<PickupOrderCard>>
} {
  const state = getState(kind)
  const groups = getPickupGroupSnapshot(kind).filter((group) => matchesFilters(kind, group, state))
  const cards = buildPickupOrderCards(groups)
  const sortOptions = sortOptionsFor(kind)
  const sorted = sortStandardListRows(cards, state.sort, (card, key) => {
    const option = sortOptions.find((candidate) => candidate.key === key)
    return option?.value(card)
  })
  return {
    groups,
    cards,
    paging: paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize),
  }
}

function renderStats(kind: PickupListKind, groups: PickupOrderGroup[]): string {
  if (kind === 'READY') {
    return renderStandardListStats([
      { label: '待领生产单', value: `${groups.length} 个` },
      { label: '一次直接配齐', value: `${groups.filter((group) => group.readySource === 'DIRECT_READY').length} 个生产单` },
      { label: '从未配齐升级', value: `${groups.filter((group) => group.readySource === 'UPGRADED_FROM_INCOMPLETE').length} 个生产单` },
      { label: '当前未编号托盘', value: `${groups.filter((group) => !group.palletId).length} 个生产单` },
    ])
  }
  if (kind === 'INCOMPLETE') {
    return renderStandardListStats([
      { label: '未配齐生产单', value: `${groups.length} 个` },
      { label: '当前占用库位', value: `${new Set(groups.flatMap(currentLocationKeys)).size} 个` },
      { label: '可整批接收生产单', value: `${groups.filter((group) => group.materialRows.some((row) => row.currentAvailableQty > 0)).length} 个` },
      { label: '含补料生产单', value: `${groups.filter((group) => group.materialRows.some((row) => row.demandSource === 'SUPPLEMENT')).length} 个` },
    ])
  }
  return renderStandardListStats([
    { label: '有接收记录生产单', value: `${groups.length} 个` },
    { label: '已配齐后接收', value: `${groups.filter((group) => group.historyPath === 'READY_PICKUP').length} 个` },
    { label: '未配齐先领', value: `${groups.filter((group) => group.historyPath === 'INCOMPLETE_PICKUP').length} 个` },
    { label: '尚未全部领完', value: `${groups.filter((group) => group.finalResult === 'NOT_ALL_PICKED').length} 个` },
    { label: '新增补料待领', value: `${groups.filter((group) => group.finalResult === 'NEW_SUPPLEMENT_WAIT_PICKUP').length} 个` },
  ])
}

function withSkipPageRerender(html: string): string {
  return html
    .replaceAll('data-pickup-list-action=', 'data-skip-page-rerender="true" data-pickup-list-action=')
    .replaceAll('data-pickup-list-field=', 'data-skip-page-rerender="true" data-pickup-list-field=')
}

function renderSelect(label: string, field: string, value: string, options: Array<[string, string]>): string {
  return `<label class="space-y-1 text-sm">
    <span class="font-medium">${escapeHtml(label)}</span>
    <select class="h-10 w-full rounded-md border bg-background px-3" data-skip-page-rerender="true" data-pickup-list-field="${escapeHtml(field)}">
      ${options.map(([optionValue, optionLabel]) => `<option value="${escapeHtml(optionValue)}"${value === optionValue ? ' selected' : ''}>${escapeHtml(optionLabel)}</option>`).join('')}
    </select>
  </label>`
}

function renderFilters(kind: PickupListKind, state: PickupListState): string {
  const extraFilters = kind === 'READY'
    ? `${renderSelect('配齐方式', 'readySource', state.readySource, [['ALL', '全部'], ['DIRECT_READY', '一次直接配齐'], ['UPGRADED_FROM_INCOMPLETE', '从未配齐升级']])}
       ${renderSelect('托盘是否编号', 'palletNumbered', state.palletNumbered, [['ALL', '全部'], ['NUMBERED', '已编号'], ['UNNUMBERED', '未编号']])}
       <label class="space-y-1 text-sm"><span class="font-medium">最近配齐时间</span><input type="date" class="h-10 w-full rounded-md border bg-background px-3" value="${escapeHtml(state.recentDate)}" data-skip-page-rerender="true" data-pickup-list-filter="recentDate"></label>`
    : kind === 'INCOMPLETE'
      ? `<label class="space-y-1 text-sm"><span class="font-medium">库区 / 库位</span><input class="h-10 w-full rounded-md border bg-background px-3" value="${escapeHtml(state.locationKeyword)}" placeholder="输入库区或库位" data-skip-page-rerender="true" data-pickup-list-filter="locationKeyword"></label>
         ${renderSelect('仍缺物料', 'shortageOnly', state.shortageOnly, [['ALL', '全部'], ['SHORTAGE', '有缺料']])}
         <label class="space-y-1 text-sm"><span class="font-medium">最近配料时间</span><input type="date" class="h-10 w-full rounded-md border bg-background px-3" value="${escapeHtml(state.recentDate)}" data-skip-page-rerender="true" data-pickup-list-filter="recentDate"></label>`
      : `${renderSelect('接收路径', 'historyPath', state.historyPath, [['ALL', '全部'], ['READY_PICKUP', '已配齐后接收'], ['INCOMPLETE_PICKUP', '未配齐先领']])}
         ${renderSelect('最终结果', 'finalResult', state.finalResult, [['ALL', '全部'], ['ALL_PICKED', '全部领完'], ['NOT_ALL_PICKED', '尚未全部领完'], ['NEW_SUPPLEMENT_WAIT_PICKUP', '新增补料待领']])}
         <label class="space-y-1 text-sm"><span class="font-medium">最近接收时间</span><input type="date" class="h-10 w-full rounded-md border bg-background px-3" value="${escapeHtml(state.recentDate)}" data-skip-page-rerender="true" data-pickup-list-filter="recentDate"></label>`
  return `<section class="rounded-lg border bg-card p-3">
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <label class="space-y-1 text-sm">
        <span class="font-medium">生产单 / 配料单</span>
        <input class="h-10 w-full rounded-md border bg-background px-3" value="${escapeHtml(state.keyword)}" placeholder="输入编号搜索" data-skip-page-rerender="true" data-pickup-list-filter="keyword">
      </label>
      <label class="space-y-1 text-sm">
        <span class="font-medium">物料</span>
        <input class="h-10 w-full rounded-md border bg-background px-3" value="${escapeHtml(state.materialKeyword)}" placeholder="输入物料名称、编码或补料单号" data-skip-page-rerender="true" data-pickup-list-filter="materialKeyword">
      </label>
      ${renderSelect('需求来源', 'demandSource', state.demandSource, [['ALL', '全部'], ['NORMAL', '计划需求'], ['SUPPLEMENT', '补料需求']])}
      ${renderSelect('加工路线', 'processRoute', state.processRoute, [['ALL', '全部'], ['NONE', '无需染色 / 印花'], ['DYE', '染色'], ['PRINT', '印花'], ['DYE_PRINT', '染色 → 印花']])}
      ${extraFilters}
    </div>
  </section>`
}

function renderColumnSettings(kind: PickupListKind): string {
  const state = getState(kind)
  if (!state.columnSettingsOpen) return ''
  return withSkipPageRerender(renderStandardListColumnSettings({
    title: `${titleFor(kind)}物料明细列设置`,
    columns: materialColumnsFor(kind),
    preferences: state.preferences,
    eventPrefix: EVENT_PREFIX,
    maxFrozenWidth: 520,
  }))
}

function renderPickupRecordsDrawer(kind: PickupListKind): string {
  const state = getState(kind)
  if (!state.selectedRecordGroupKey) return ''
  const group = (groupSnapshots.get(kind) ?? []).find((item) => item.groupKey === state.selectedRecordGroupKey)
  if (!group) return ''
  const discrepancies = listPickupDiscrepancies()
  const groupDiscrepancies = discrepancies.filter((record) =>
    record.productionOrderId === group.productionOrderId
  )
  return `<div class="fixed inset-0 z-50 flex justify-end bg-black/30" data-skip-page-rerender="true">
    <section class="h-full w-full max-w-2xl overflow-y-auto bg-background shadow-xl">
      <div class="sticky top-0 z-10 flex items-start justify-between border-b bg-background px-5 py-4">
        <div>
          <div class="text-lg font-semibold">接收记录</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(group.productionOrderNo)} · ${escapeHtml(group.prepOrderNo)}</div>
        </div>
        <button type="button" class="rounded-md border px-3 py-2 text-sm" data-pickup-list-action="close-pickup-records">关闭</button>
      </div>
      <div class="space-y-3 p-5">
        ${groupDiscrepancies.length ? `<section class="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div class="text-sm font-semibold text-amber-800">接收差异与主管处理</div>
          ${groupDiscrepancies.map((record) => `<div class="rounded-md bg-white p-3 text-xs">
            <div class="font-medium">${escapeHtml(record.materialName)} · 差异 ${formatQty(record.differenceQty, record.unit)}</div>
            <div class="mt-1 text-muted-foreground">${escapeHtml(record.carrierLabel)} · ${escapeHtml(record.operatorName)} ${escapeHtml(record.reportedAt)}</div>
            <div class="mt-1">现场证据：${escapeHtml(record.photoName || '无照片')}；${escapeHtml(record.note || '无说明')}</div>
            ${record.status === '待主管处理'
              ? `<button type="button" class="mt-2 rounded-md bg-amber-600 px-3 py-2 font-medium text-white" data-pickup-list-action="resolve-pickup-discrepancy" data-discrepancy-id="${escapeHtml(record.discrepancyId)}">主管处理完成</button>`
              : `<div class="mt-2 text-emerald-700">已处理：${escapeHtml(record.handledBy)} ${escapeHtml(record.handledAt)} · ${escapeHtml(record.resolution)}</div>`}
          </div>`).join('')}
        </section>` : ''}
        ${group.pickupSessions.length ? group.pickupSessions.map((session) => {
          const snapshot = session.pickupNodeSnapshot
          const evidence = discrepancies.filter((record) =>
            record.pickupNodeId === session.pickupNodeId
            && record.pickupNodeVersion === session.pickupNodeVersion
          )
          const carrierLabel = snapshot?.carrierType === 'PALLET'
            ? toReceiveLabel(snapshot.palletDisplayLabel || snapshot.palletId || '待接收托盘（暂未编号）')
            : Array.from(new Set(snapshot?.items.flatMap((item) =>
                item.sourceLocations.map((location) =>
                  `${location.sourceWarehouseName} / ${location.sourceWarehouseArea} / ${location.sourceLocationCode}`
                )
              ) ?? [])).join('；') || '来源库位未记录'
          return `<article class="rounded-lg border bg-card p-4 text-sm">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="font-medium">${escapeHtml(session.pickupSessionNo)}</div>
              <div class="text-xs text-muted-foreground">节点 V${session.pickupNodeVersion}</div>
            </div>
            <div class="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <div>接收人：<span class="text-foreground">${escapeHtml(session.receiverName)}</span></div>
              <div>接收时间：<span class="text-foreground">${escapeHtml(session.pickedAt)}</span></div>
              <div class="sm:col-span-2">来源库位或托盘：<span class="text-foreground">${escapeHtml(carrierLabel)}</span></div>
              <div class="sm:col-span-2">接收位置：<span class="text-foreground">${escapeHtml(`${session.toWarehouseArea} / ${session.toLocationCode}`)}</span></div>
            </div>
            <div class="mt-3 space-y-1">
              ${(snapshot?.items ?? []).map((item) => `<div class="rounded bg-muted/50 px-2 py-1.5 text-xs">${escapeHtml(item.materialName)} · ${escapeHtml(item.materialSku)} · ${formatQty(item.currentAvailableQty, item.unit)}</div>`).join('')}
            </div>
            <div class="mt-3 text-xs">
              <span class="font-medium">异常证据：</span>
              ${evidence.length
                ? evidence.map((record) => `${record.photoName || '无照片'}；${record.note || '无说明'}；${record.supervisorRequestedBy || '待主管响应'}`).map(escapeHtml).join('<br>')
                : '<span class="text-muted-foreground">无</span>'}
            </div>
          </article>`
        }).join('') : '<div class="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">当前生产单尚无接收记录。</div>'}
      </div>
    </section>
  </div>`
}

function getReceiptNode(draft: PickupReceiptDraft) {
  return listActivePickupNodesRuntime().find((node) =>
    node.nodeId === draft.pickupNodeId && node.version === draft.pickupNodeVersion)
}

function getReceiptWarehouseProjection(draft: PickupReceiptDraft): WarehouseLocationMapProjection | null {
  if (!draft.warehouseId) return null
  return buildCuttingWarehouseMapProjectionForWarehouse('WAIT_PROCESS', draft.warehouseId)?.projection ?? null
}

function selectedReceiptLocationRefs(
  projection: WarehouseLocationMapProjection,
  selectedLocationIds: string[],
): StableWarehouseLocationRef[] {
  const selected = new Set(selectedLocationIds)
  return listWarehouseLocationMapCells(projection).filter((cell) => selected.has(cell.locationId))
}

function receiptCarrierLabel(node: NonNullable<ReturnType<typeof getReceiptNode>>): string {
  if (node.carrierType === 'PALLET') return toReceiveLabel(node.palletDisplayLabel || node.palletId || '待接收托盘（暂未编号）')
  return Array.from(new Set(node.items.flatMap((item) => item.sourceLocations.map((location) =>
    `${location.sourceWarehouseName} / ${location.sourceWarehouseArea} / ${location.sourceLocationCode}`
  )))).join('；') || '来源库位未记录'
}

function renderPickupReceiptModal(kind: PickupListKind): string {
  const state = getState(kind)
  const draft = state.receiptDraft
  if (!draft) return ''
  const group = (groupSnapshots.get(kind) ?? []).find((item) => item.groupKey === draft.groupKey)
  const node = getReceiptNode(draft)
  const warehouses = listCuttingWarehouses('WAIT_PROCESS')
  const projection = getReceiptWarehouseProjection(draft)
  const openDiscrepancies = listPickupDiscrepancies().filter((record) =>
    record.pickupNodeId === draft.pickupNodeId
    && record.pickupNodeVersion === draft.pickupNodeVersion
    && record.status === '待主管处理'
  )
  const unitSummary = node ? summarizeQtyByUnit(node.items, (item) => item.currentAvailableQty) : '无'
  const nodeInvalid = !node
  return `<div class="fixed inset-0 z-[60] flex items-center justify-center p-4" data-pickup-receipt-modal data-pickup-node-id="${escapeHtml(draft.pickupNodeId)}" data-pickup-node-version="${draft.pickupNodeVersion}" data-skip-page-rerender="true">
    <button type="button" class="absolute inset-0 bg-black/55" data-pickup-list-action="close-web-receipt" aria-label="关闭接收弹窗"></button>
    <section class="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-background shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="pickup-receipt-title">
      <header class="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4">
        <div>
          <h2 id="pickup-receipt-title" class="text-lg font-semibold">接收 · ${escapeHtml(group?.productionOrderNo || '生产单')}</h2>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(group?.supplementOrderNo ? `补料单 ${group.supplementOrderNo}` : `配料单 ${group?.prepOrderNo || '—'}`)} · 节点 V${draft.pickupNodeVersion}</div>
        </div>
        <button type="button" class="rounded-md border px-3 py-2 text-sm" data-pickup-list-action="close-web-receipt">关闭</button>
      </header>
      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        ${draft.feedbackMessage ? `<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">${escapeHtml(draft.feedbackMessage)}</div>` : ''}
        ${nodeInvalid ? `<div class="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">当前接收节点已变化或关闭，请关闭弹窗后重新核对列表。</div>` : `
          <section class="rounded-lg border p-3" data-pickup-receipt-node-summary>
            <div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <strong>${node.itemCount} 种物料</strong>
              <span>本轮 ${unitSummary}</span>
              <span class="text-muted-foreground">${escapeHtml(receiptCarrierLabel(node))}</span>
            </div>
            <div class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3" data-pickup-receipt-readonly-items>
              ${node.items.map((item) => `<article class="flex min-w-0 items-start gap-2 rounded-md bg-muted/35 p-2 text-xs" data-pickup-receipt-item="${escapeHtml(item.prepLineId)}">
                ${renderPickupImage(item.materialImageUrl, `${item.materialName}（${item.materialSku}）实物图`, 'h-10 w-10')}
                <div class="min-w-0"><div class="font-medium">${escapeHtml(item.materialName)}</div><div class="truncate text-muted-foreground">${escapeHtml(item.materialSku)} · ${escapeHtml(item.color)} · ${escapeHtml(item.spec)}</div><div class="mt-1">${formatQty(item.currentAvailableQty, item.unit)}</div></div>
              </article>`).join('')}
            </div>
          </section>

          <section class="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
            <label class="space-y-1 text-sm"><span class="font-medium">接收人</span><input class="h-10 w-full rounded-md border bg-background px-3" value="${escapeHtml(draft.receiverName)}" data-pickup-receive-field="receiverName" data-skip-page-rerender="true"></label>
            <label class="space-y-1 text-sm"><span class="font-medium">裁床待加工仓</span><select class="h-10 w-full rounded-md border bg-background px-3" data-pickup-receive-field="warehouseId" data-skip-page-rerender="true"><option value="">请选择待加工仓</option>${warehouses.map((warehouse) => `<option value="${escapeHtml(warehouse.warehouseId)}"${warehouse.warehouseId === draft.warehouseId ? ' selected' : ''}>${escapeHtml(warehouse.factoryName)} · ${escapeHtml(warehouse.warehouseName)}</option>`).join('')}</select></label>
          </section>

          ${warehouses.length === 0 ? '<div class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">当前没有可用的裁床待加工仓。</div>' : !draft.warehouseId ? '<div class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">请选择接收仓库，再选择空闲库位。</div>' : projection ? `<div data-pickup-receipt-location-map>${renderWarehouseLocationMap({ projection, mode: 'SELECT', factoryName: warehouses.find((warehouse) => warehouse.warehouseId === draft.warehouseId)?.factoryName || '', selectedLocationIds: draft.selectedLocationIds, showOccupancySummary: false })}</div>` : '<div class="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">所选仓库已不可用，请重新选择。</div>'}

          <section class="rounded-lg border ${openDiscrepancies.length ? 'border-amber-300 bg-amber-50' : ''}">
            <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium" data-pickup-list-action="toggle-web-receipt-difference"><span>上报接收差异${openDiscrepancies.length ? `（待处理 ${openDiscrepancies.length} 条）` : ''}</span><span>${draft.differenceOpen ? '收起' : '展开'}</span></button>
            ${openDiscrepancies.length ? `<div class="border-t border-amber-200 px-4 py-3 text-xs text-amber-800">差异待主管处理，当前节点不可确认接收。</div>` : ''}
            ${draft.differenceOpen ? `<div class="grid gap-3 border-t p-4 md:grid-cols-2">
              <label class="space-y-1 text-sm"><span class="font-medium">差异物料</span><select class="h-10 w-full rounded-md border bg-background px-3" data-pickup-receive-field="differenceDemandLineId" data-skip-page-rerender="true">${node.items.map((item) => `<option value="${escapeHtml(item.prepLineId)}"${item.prepLineId === draft.differenceDemandLineId ? ' selected' : ''}>${escapeHtml(item.materialName)} · ${formatQty(item.currentAvailableQty, item.unit)}</option>`).join('')}</select></label>
              <label class="space-y-1 text-sm"><span class="font-medium">差异数量</span><input class="h-10 w-full rounded-md border bg-background px-3" inputmode="decimal" value="${escapeHtml(draft.differenceQty)}" data-pickup-receive-field="differenceQty" data-skip-page-rerender="true"></label>
              <label class="space-y-1 text-sm"><span class="font-medium">现场照片</span><input class="block w-full text-sm" type="file" accept="image/*" data-pickup-receive-field="differencePhoto" data-skip-page-rerender="true"><span class="text-xs text-muted-foreground" data-pickup-receive-photo-name>${escapeHtml(draft.differencePhotoName || '未选择')}</span></label>
              <label class="space-y-1 text-sm"><span class="font-medium">现场说明</span><textarea class="min-h-20 w-full rounded-md border bg-background px-3 py-2" data-pickup-receive-field="differenceNote" data-skip-page-rerender="true">${escapeHtml(draft.differenceNote)}</textarea></label>
              <button type="button" class="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white md:col-span-2" data-pickup-list-action="report-web-receipt-difference">提交差异并阻断接收</button>
            </div>` : ''}
          </section>
        `}
      </div>
      <footer class="flex shrink-0 justify-end gap-2 border-t bg-background px-5 py-4">
        <button type="button" class="rounded-md border px-4 py-2 text-sm" data-pickup-list-action="close-web-receipt">取消</button>
        <button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" data-pickup-list-action="confirm-web-receipt" ${nodeInvalid || openDiscrepancies.length || draft.submitting ? 'disabled' : ''}>${draft.submitting ? '接收中…' : '确认接收'}</button>
      </footer>
    </section>
  </div>`
}

function renderAllPickupOverlays(kind: PickupListKind): string {
  const preview = getState(kind).imagePreview
  const previewHtml = preview ? `<div class="fixed inset-0 z-[70] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="${escapeHtml(preview.alt)}"><button type="button" class="absolute inset-0 bg-black/75" data-pickup-list-action="close-image-preview" aria-label="关闭大图"></button><div class="relative z-10 max-h-[90vh] max-w-[90vw] rounded-xl bg-background p-4 shadow-xl"><button type="button" class="absolute right-3 top-3 rounded border bg-background px-3 py-1" data-pickup-list-action="close-image-preview">关闭</button><img class="max-h-[82vh] max-w-[84vw] object-contain" src="${escapeHtml(preview.src)}" alt="${escapeHtml(preview.alt)}" onerror="this.classList.add('hidden');this.nextElementSibling.classList.remove('hidden')"><div class="hidden px-10 py-20 text-sm text-red-700">图片加载失败，请核对素材。</div></div></div>` : ''
  return `${renderColumnSettings(kind)}${renderPickupRecordsDrawer(kind)}${renderPickupReceiptModal(kind)}${previewHtml}`
}

function renderTableRegion(
  kind: PickupListKind,
  view = getView(kind),
): string {
  const state = getState(kind)
  if (!view.paging.rows.length) {
    return `<div class="px-4 py-14 text-center text-sm text-muted-foreground" data-pickup-card-list="${kind}">当前暂无${escapeHtml(titleFor(kind))}生产单。</div>`
  }
  return withSkipPageRerender(`<div class="space-y-3 p-3" data-pickup-card-list="${kind}">
    ${view.paging.rows.map((card) => renderPickupOrderCard(kind, card, state)).join('')}
  </div>`)
}

function renderListActions(kind: PickupListKind, state: PickupListState): string {
  const options = sortOptionsFor(kind)
  const selectedKey = state.sort?.key ?? ''
  const directionLabel = state.sort?.direction === 'desc' ? '降序' : '升序'
  return withSkipPageRerender(`<div class="flex flex-wrap items-center gap-2">
    <label class="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span>排序</span>
      <select class="h-9 rounded-md border bg-background px-2 text-sm text-foreground" data-pickup-list-field="sortKey" data-pickup-sort-select>
        <option value="">默认顺序</option>
        ${options.map((option) => `<option value="${escapeHtml(option.key)}"${option.key === selectedKey ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
      </select>
    </label>
    <button type="button" class="h-9 rounded-md border bg-background px-3 text-sm disabled:opacity-50" data-pickup-list-action="toggle-sort-direction"${state.sort ? '' : ' disabled'}>${escapeHtml(directionLabel)}</button>
    ${renderSecondaryButton(
      '物料明细列设置',
      { prefix: EVENT_PREFIX, action: 'open-column-settings' },
      'columns-3',
    )}
  </div>`)
}

function renderPaginationRegion(
  kind: PickupListKind,
  view = getView(kind),
): string {
  const state = getState(kind)
  const { paging } = view
  return withSkipPageRerender(renderTablePagination({
    total: paging.total,
    from: paging.from,
    to: paging.to,
    currentPage: paging.currentPage,
    totalPages: paging.totalPages,
    pageSize: state.preferences.pageSize,
    actionPrefix: EVENT_PREFIX,
    pageSizeOptions: PAGE_SIZES,
  }))
}

function renderPickupList(kind: PickupListKind): string {
  cancelPickupListDebouncesBeforeRender()
  groupSnapshots.set(kind, listPickupOrderGroups(kind))
  const state = getState(kind)
  state.currentPage = 1
  state.sort = null
  state.keyword = ''
  state.materialKeyword = ''
  state.demandSource = 'ALL'
  state.processRoute = 'ALL'
  state.readySource = 'ALL'
  state.palletNumbered = 'ALL'
  state.locationKeyword = ''
  state.shortageOnly = 'ALL'
  state.historyPath = 'ALL'
  state.finalResult = 'ALL'
  state.recentDate = ''
  const view = getView(kind)
  return `<div data-pickup-list-root="${kind}">
    ${renderStandardListPage({
      title: titleFor(kind),
      filtersHtml: renderFilters(kind, state),
      statsHtml: `<div data-pickup-list-region="stats">${renderStats(kind, view.groups)}</div>`,
      listTitle: `${titleFor(kind)}生产单`,
      listActionsHtml: `<div data-pickup-list-region="actions">${renderListActions(kind, state)}</div>`,
      tableHtml: `<div data-pickup-list-region="table">${renderTableRegion(kind, view)}</div>`,
      paginationHtml: `<div data-pickup-list-region="pagination">${renderPaginationRegion(kind, view)}</div>`,
      overlaysHtml: `<div data-pickup-list-region="overlay">${renderAllPickupOverlays(kind)}</div>`,
    })}
  </div>`
}

export function renderCraftCuttingPickupReadyPage(): string {
  return renderPickupList('READY')
}

export function renderCraftCuttingPickupIncompletePage(): string {
  return renderPickupList('INCOMPLETE')
}

export function renderCraftCuttingPickupHistoryPage(): string {
  return renderPickupList('HISTORY')
}

function kindFromPathname(): PickupListKind | null {
  const pathname = typeof window === 'undefined' ? '' : window.location.pathname
  if (pathname === '/fcs/craft/cutting/pickup-management/ready') return 'READY'
  if (pathname === '/fcs/craft/cutting/pickup-management/incomplete') return 'INCOMPLETE'
  if (pathname === '/fcs/craft/cutting/pickup-management/history') return 'HISTORY'
  return null
}

function savePreferences(kind: PickupListKind): void {
  if (typeof localStorage === 'undefined') return
  saveListColumnPreferences(localStorage, PREFERENCE_KEYS[kind], getState(kind).preferences)
}

function refreshPickupListRegions(kind: PickupListKind): void {
  const root = document.querySelector<HTMLElement>(`[data-pickup-list-root="${kind}"]`)
  if (!root) return
  const view = getView(kind)
  const stats = root.querySelector<HTMLElement>('[data-pickup-list-region="stats"]')
  const actions = root.querySelector<HTMLElement>('[data-pickup-list-region="actions"]')
  const table = root.querySelector<HTMLElement>('[data-pickup-list-region="table"]')
  const pagination = root.querySelector<HTMLElement>('[data-pickup-list-region="pagination"]')
  if (stats) stats.innerHTML = renderStats(kind, view.groups)
  if (actions) actions.innerHTML = renderListActions(kind, getState(kind))
  if (table) table.innerHTML = renderTableRegion(kind, view)
  if (pagination) pagination.innerHTML = renderPaginationRegion(kind, view)
}

function refreshPickupListOverlay(kind: PickupListKind): void {
  const root = document.querySelector<HTMLElement>(`[data-pickup-list-root="${kind}"]`)
  const overlay = root?.querySelector<HTMLElement>('[data-pickup-list-region="overlay"]')
  if (overlay) overlay.innerHTML = renderAllPickupOverlays(kind)
}

export function closeCraftCuttingPickupListImagePreview(): boolean {
  const kind = kindFromPathname()
  if (!kind) return false
  const state = states.get(kind)
  if (!state?.imagePreview) return false
  state.imagePreview = null
  refreshPickupListOverlay(kind)
  return true
}

export function closeCraftCuttingPickupListOverlay(): boolean {
  const kind = kindFromPathname()
  if (!kind) return false
  const state = states.get(kind)
  if (!state) return false
  if (state.imagePreview) return closeCraftCuttingPickupListImagePreview()
  if (state.receiptDraft) state.receiptDraft = null
  else if (state.selectedRecordGroupKey) state.selectedRecordGroupKey = ''
  else if (state.columnSettingsOpen) state.columnSettingsOpen = false
  else return false
  refreshPickupListOverlay(kind)
  return true
}

export function handleCraftCuttingPickupListEvent(target: HTMLElement, event?: Event): boolean {
  const kind = kindFromPathname()
  if (!kind) return false
  const state = getState(kind)
  if (typeof KeyboardEvent !== 'undefined' && event instanceof KeyboardEvent && event.key === 'Escape') {
    return closeCraftCuttingPickupListOverlay()
  }
  const columns = materialColumnsFor(kind)
  const sortOptions = sortOptionsFor(kind)
  const receiptField = target.closest<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-pickup-receive-field]')
  if (receiptField && state.receiptDraft && (event?.type === 'input' || event?.type === 'change')) {
    const fieldName = receiptField.dataset.pickupReceiveField || ''
    const draft = state.receiptDraft
    if (fieldName === 'receiverName') draft.receiverName = receiptField.value
    if (fieldName === 'differenceDemandLineId') draft.differenceDemandLineId = receiptField.value
    if (fieldName === 'differenceQty') draft.differenceQty = receiptField.value
    if (fieldName === 'differenceNote') draft.differenceNote = receiptField.value
    if (fieldName === 'differencePhoto' && event.type === 'change' && receiptField instanceof HTMLInputElement) {
      draft.differencePhotoName = receiptField.files?.[0]?.name || ''
      const photoName = receiptField.closest('label')?.querySelector<HTMLElement>('[data-pickup-receive-photo-name]')
      if (photoName) photoName.textContent = draft.differencePhotoName || '未选择'
    }
    if (fieldName === 'warehouseId' && draft.warehouseId !== receiptField.value) {
      draft.warehouseId = receiptField.value
      draft.selectedLocationIds = []
      draft.feedbackMessage = ''
      refreshPickupListOverlay(kind)
    }
    return true
  }
  const filter = target.closest<HTMLInputElement>('[data-pickup-list-filter]')
  if (filter && event?.type === 'input') {
    const filterField = filter.dataset.pickupListFilter || ''
    const debounceKey = pickupListFilterDebounceKey(kind, filterField)
    const existingTimer = searchDebounceTimers.get(debounceKey)
    if (existingTimer) clearTimeout(existingTimer)
    const nextValue = filter.value.trim()
    const applyFilter = (): void => {
      searchDebounceTimers.delete(debounceKey)
      if (filterField === 'keyword') state.keyword = nextValue
      if (filterField === 'materialKeyword') state.materialKeyword = nextValue
      if (filterField === 'locationKeyword') state.locationKeyword = nextValue
      if (filterField === 'recentDate') state.recentDate = nextValue
      state.currentPage = 1
      refreshPickupListRegions(kind)
    }
    if (!nextValue) {
      applyFilter()
      return true
    }
    searchDebounceTimers.set(debounceKey, setTimeout(() => {
      if (kindFromPathname() !== kind) {
        searchDebounceTimers.delete(debounceKey)
        return
      }
      applyFilter()
    }, PICKUP_LIST_FILTER_DEBOUNCE_MS))
    return true
  }

  const field = target.closest<HTMLSelectElement>('[data-pickup-list-field]')
  // 浏览器选择下拉项时会先触发 input、再触发 change。部分浏览器在两次异步
  // 分发之间会重建列表，因此 input 阶段就保存筛选值，change 再做幂等确认。
  if (field && field.dataset.pickupListField !== 'pageSize' && event?.type === 'input') {
    const filterField = field.dataset.pickupListField || ''
    if (filterField === 'demandSource') state.demandSource = field.value
    if (filterField === 'processRoute') state.processRoute = field.value
    if (filterField === 'readySource') state.readySource = field.value
    if (filterField === 'palletNumbered') state.palletNumbered = field.value
    if (filterField === 'shortageOnly') state.shortageOnly = field.value
    if (filterField === 'historyPath') state.historyPath = field.value
    if (filterField === 'finalResult') state.finalResult = field.value
    if (filterField === 'sortKey') {
      state.sort = field.value
        ? { key: field.value, direction: state.sort?.key === field.value ? state.sort.direction : 'asc' }
        : null
    }
    state.currentPage = 1
    refreshPickupListRegions(kind)
    return true
  }
  if (field?.dataset.pickupListField === 'pageSize' && event?.type === 'input') return true
  if (field && field.dataset.pickupListField !== 'pageSize' && event?.type === 'change') {
    const filterField = field.dataset.pickupListField || ''
    if (filterField === 'demandSource') state.demandSource = field.value
    if (filterField === 'processRoute') state.processRoute = field.value
    if (filterField === 'readySource') state.readySource = field.value
    if (filterField === 'palletNumbered') state.palletNumbered = field.value
    if (filterField === 'shortageOnly') state.shortageOnly = field.value
    if (filterField === 'historyPath') state.historyPath = field.value
    if (filterField === 'finalResult') state.finalResult = field.value
    if (filterField === 'sortKey') {
      state.sort = field.value
        ? { key: field.value, direction: state.sort?.key === field.value ? state.sort.direction : 'asc' }
        : null
    }
    state.currentPage = 1
    refreshPickupListRegions(kind)
    return true
  }
  if (field?.dataset.pickupListField === 'pageSize' && event?.type === 'change') {
    const pageSize = Number(field.value)
    if (PAGE_SIZES.includes(pageSize)) {
      state.preferences = normalizeListColumnPreferences(
        columns,
        { ...state.preferences, pageSize },
        PAGE_SIZES,
      )
      state.currentPage = 1
      savePreferences(kind)
      refreshPickupListRegions(kind)
    }
    return true
  }

  const dragEvent = event as (DragEvent & { higoodStandardListColumnKey?: string }) | undefined
  const dragNode = target.closest<HTMLElement>('[data-standard-list-column-drag]')
  if (dragNode && event && ['dragstart', 'dragover', 'drop'].includes(event.type)) {
    const targetKey = dragNode.dataset.pickupListColumnKey
      || dragNode.dataset.dragSource
      || dragNode.dataset.dropTarget
      || ''
    if (event.type === 'dragstart') {
      state.draggedColumnKey = targetKey
      dragEvent?.dataTransfer?.setData('application/x-higood-list-column-key', targetKey)
      return true
    }
    const sourceKey = dragEvent?.higoodStandardListColumnKey || state.draggedColumnKey
    if (!sourceKey || !targetKey || sourceKey === targetKey) return false
    if (event.type === 'dragover') {
      event.preventDefault()
      return true
    }
    event.preventDefault()
    const order = state.preferences.order.filter((key) => key !== sourceKey)
    const targetIndex = order.indexOf(targetKey)
    if (targetIndex >= 0) order.splice(targetIndex, 0, sourceKey)
    state.preferences = normalizeListColumnPreferences(columns, { ...state.preferences, order }, PAGE_SIZES)
    state.draggedColumnKey = ''
    savePreferences(kind)
    refreshPickupListRegions(kind)
    refreshPickupListOverlay(kind)
    return true
  }
  if (event?.type === 'dragend' && state.draggedColumnKey) {
    state.draggedColumnKey = ''
    return true
  }

  const warehouseMapActionNode = target.closest<HTMLElement>('[data-warehouse-map-action]')
  if (warehouseMapActionNode && state.receiptDraft) {
    const projection = getReceiptWarehouseProjection(state.receiptDraft)
    if (!projection) return true
    if (handleWarehouseLocationMapViewportEvent(target, projection)) return true
    const warehouseAction = warehouseMapActionNode.dataset.warehouseMapAction || ''
    if (warehouseAction === 'clear-selection') {
      state.receiptDraft.selectedLocationIds = []
      state.receiptDraft.feedbackMessage = ''
      refreshPickupListOverlay(kind)
      return true
    }
    if (warehouseAction === 'toggle-location') {
      const result = toggleWarehouseLocationSelection(
        projection,
        state.receiptDraft.selectedLocationIds,
        warehouseMapActionNode.dataset.locationId || '',
      )
      state.receiptDraft.selectedLocationIds = result.selectedLocationIds
      state.receiptDraft.feedbackMessage = result.ok ? '' : result.message
      refreshPickupListOverlay(kind)
      return true
    }
    if (warehouseAction === 'open-occupancy') {
      state.receiptDraft.feedbackMessage = '该库位已占用，请选择绿色空闲库位。'
      refreshPickupListOverlay(kind)
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pickup-list-action]')
  const action = actionNode?.dataset.pickupListAction
  if (!actionNode || !action) return false

  if (action === 'open-web-receipt') {
    const groupKey = actionNode.dataset.groupKey || ''
    const group = (groupSnapshots.get(kind) ?? []).find((item) => item.groupKey === groupKey)
    const node = group?.pickupNodeId
      ? listActivePickupNodesRuntime().find((candidate) =>
          candidate.nodeId === group.pickupNodeId && candidate.version === group.pickupNodeVersion)
      : null
    if (!group || !node) {
      groupSnapshots.delete(kind)
      refreshPickupListRegions(kind)
      window.alert('当前接收节点已变化，请重新核对列表。')
      return true
    }
    const warehouses = listCuttingWarehouses('WAIT_PROCESS')
    state.receiptDraft = {
      groupKey,
      pickupNodeId: node.nodeId,
      pickupNodeVersion: node.version,
      receiverName: '裁床仓管',
      warehouseId: warehouses.length === 1 ? warehouses[0].warehouseId : '',
      selectedLocationIds: [],
      differenceOpen: false,
      differenceDemandLineId: node.items[0]?.prepLineId || '',
      differenceQty: '',
      differenceNote: '',
      differencePhotoName: '',
      feedbackMessage: '',
      submitting: false,
    }
    refreshPickupListOverlay(kind)
    return true
  }
  if (action === 'close-web-receipt') {
    state.receiptDraft = null
    refreshPickupListOverlay(kind)
    return true
  }
  if (action === 'toggle-web-receipt-difference' && state.receiptDraft) {
    state.receiptDraft.differenceOpen = !state.receiptDraft.differenceOpen
    state.receiptDraft.feedbackMessage = ''
    refreshPickupListOverlay(kind)
    return true
  }
  if (action === 'report-web-receipt-difference' && state.receiptDraft) {
    const draft = state.receiptDraft
    const node = getReceiptNode(draft)
    const item = node?.items.find((candidate) => candidate.prepLineId === draft.differenceDemandLineId)
    if (!node || !item) {
      draft.feedbackMessage = '当前接收节点或差异物料已变化，请重新核对。'
      refreshPickupListOverlay(kind)
      return true
    }
    try {
      reportPickupDiscrepancy({
        productionOrderId: node.productionOrderId,
        productionOrderNo: node.productionOrderNo,
        pickupNodeId: node.nodeId,
        pickupNodeVersion: node.version,
        demandLineId: item.prepLineId,
        materialSku: item.materialSku,
        materialName: item.materialName,
        differenceQty: Number(draft.differenceQty),
        unit: item.unit,
        carrierType: node.carrierType,
        carrierLabel: receiptCarrierLabel(node),
        palletUnnumbered: node.carrierType === 'PALLET' && !node.palletId,
        operatorName: draft.receiverName.trim() || '裁床仓管',
        note: draft.differenceNote.trim(),
        photoName: draft.differencePhotoName,
      }, undefined, (nodeId) => listActivePickupNodesRuntime().find((candidate) => candidate.nodeId === nodeId) ?? null)
      draft.differenceOpen = false
      draft.feedbackMessage = '接收差异已上报，当前节点已阻断接收，请等待主管处理。'
    } catch (error) {
      draft.feedbackMessage = error instanceof Error ? error.message : '接收差异上报失败。'
    }
    refreshPickupListOverlay(kind)
    return true
  }
  if (action === 'confirm-web-receipt' && state.receiptDraft) {
    const draft = state.receiptDraft
    const node = getReceiptNode(draft)
    if (!node) {
      draft.feedbackMessage = '当前待接收物料已更新，请关闭后重新核对列表。'
      refreshPickupListOverlay(kind)
      return true
    }
    const projection = getReceiptWarehouseProjection(draft)
    if (!projection) {
      draft.feedbackMessage = draft.warehouseId ? '所选待加工仓已不可用，请重新选择。' : '请选择裁床待加工仓。'
      refreshPickupListOverlay(kind)
      return true
    }
    const selection = revalidateWarehouseLocationSelection(projection, draft.selectedLocationIds)
    if (!selection.ok) {
      draft.selectedLocationIds = selection.selectedLocationIds
      draft.feedbackMessage = selection.message
      refreshPickupListOverlay(kind)
      return true
    }
    const selectedRefs = selectedReceiptLocationRefs(projection, selection.selectedLocationIds)
    draft.submitting = true
    draft.feedbackMessage = ''
    try {
      confirmPickupNodeReceiptRuntime({
        pickupNodeId: draft.pickupNodeId,
        pickupNodeVersion: draft.pickupNodeVersion,
        receiverName: draft.receiverName,
        eventSource: 'WEB',
        operatorRole: 'Web 裁床仓管',
        toLocationRefs: selectedRefs.map((ref) => ({
          factoryId: ref.factoryId,
          warehouseId: ref.warehouseId,
          warehouseKind: 'WAIT_PROCESS',
          areaId: ref.areaId,
          areaName: ref.areaName,
          shelfId: ref.shelfId,
          shelfNo: ref.shelfNo,
          locationId: ref.locationId,
          locationNo: ref.locationNo,
        })),
      })
      state.receiptDraft = null
      groupSnapshots.clear()
      const nextView = getView(kind)
      state.currentPage = nextView.paging.currentPage
      refreshPickupListRegions(kind)
      refreshPickupListOverlay(kind)
      window.alert('接收完成，接收记录和裁床待加工仓已同步。')
    } catch (error) {
      draft.submitting = false
      draft.feedbackMessage = error instanceof Error ? error.message : '接收失败，当前选择已保留，可直接重试。'
      refreshPickupListOverlay(kind)
    }
    return true
  }

  if (action === 'resolve-pickup-discrepancy') {
    const discrepancyId = actionNode.dataset.discrepancyId || ''
    const resolution = window.prompt('请填写主管处理结论 / 说明', '已现场复核并处理差异')
    if (!resolution?.trim()) return true
    resolvePickupDiscrepancy(discrepancyId, {
      handledBy: '裁床主管 王芳',
      resolution,
    })
    groupSnapshots.set(kind, listPickupOrderGroups(kind))
    refreshPickupListRegions(kind)
    refreshPickupListOverlay(kind)
    return true
  }
  if (action === 'open-image-preview') {
    state.imagePreview = { src: actionNode.dataset.imageSrc || '', alt: actionNode.dataset.imageAlt || '物料实物图' }
    refreshPickupListOverlay(kind)
    return true
  }
  if (action === 'close-image-preview') {
    state.imagePreview = null
    refreshPickupListOverlay(kind)
    return true
  }
  if (action === 'open-pickup-records') {
    state.selectedRecordGroupKey = actionNode.dataset.groupKey || ''
    refreshPickupListOverlay(kind)
    return true
  }
  if (action === 'close-pickup-records') {
    state.selectedRecordGroupKey = ''
    refreshPickupListOverlay(kind)
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    const totalPages = getView(kind).paging.totalPages
    state.currentPage = action === 'prev-page'
      ? Math.max(1, state.currentPage - 1)
      : Math.min(totalPages, state.currentPage + 1)
    refreshPickupListRegions(kind)
    return true
  }
  if (action === 'sort-column') {
    const columnKey = actionNode.dataset.columnKey || ''
    const option = sortOptions.find((candidate) => candidate.key === columnKey)
    if (!option) return true
    state.sort = state.sort?.key !== columnKey
      ? { key: columnKey, direction: 'asc' }
      : state.sort.direction === 'asc'
        ? { key: columnKey, direction: 'desc' }
        : null
    state.currentPage = 1
    refreshPickupListRegions(kind)
    return true
  }
  if (action === 'toggle-sort-direction') {
    if (!state.sort) return true
    state.sort = {
      ...state.sort,
      direction: state.sort.direction === 'asc' ? 'desc' : 'asc',
    }
    state.currentPage = 1
    refreshPickupListRegions(kind)
    return true
  }
  if (action === 'open-column-settings' || action === 'close-column-settings') {
    state.columnSettingsOpen = action === 'open-column-settings'
    refreshPickupListOverlay(kind)
    return true
  }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    if (event?.type !== 'change') return false
    const columnKey = actionNode.dataset.pickupListColumnKey || actionNode.dataset.columnKey || ''
    const column = columns.find((candidate) => candidate.key === columnKey)
    if (!column || column.actionColumn) return true
    const visibleKeys = new Set(state.preferences.visibleKeys)
    const frozenKeys = new Set(state.preferences.frozenKeys)
    if (action === 'toggle-column-visibility' && !column.required) {
      visibleKeys.has(columnKey) ? visibleKeys.delete(columnKey) : visibleKeys.add(columnKey)
      if (!visibleKeys.has(columnKey)) frozenKeys.delete(columnKey)
    }
    if (action === 'toggle-column-freeze' && column.freezeable) {
      frozenKeys.has(columnKey) ? frozenKeys.delete(columnKey) : frozenKeys.add(columnKey)
    }
    state.preferences = normalizeListColumnPreferences(columns, {
      ...state.preferences,
      visibleKeys: [...visibleKeys],
      frozenKeys: [...frozenKeys],
    }, PAGE_SIZES)
    savePreferences(kind)
    refreshPickupListRegions(kind)
    refreshPickupListOverlay(kind)
    return true
  }
  if (action === 'restore-column-settings') {
    state.preferences = normalizeListColumnPreferences(columns, {
      order: columns.map((column) => column.key),
      visibleKeys: columns.map((column) => column.key),
      frozenKeys: ['material'],
      pageSize: PAGE_SIZES[0],
    }, PAGE_SIZES)
    state.currentPage = 1
    state.sort = null
    savePreferences(kind)
    refreshPickupListRegions(kind)
    refreshPickupListOverlay(kind)
    return true
  }
  return false
}
