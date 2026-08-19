import type {
  FactoryInternalWarehouse,
  FactoryWaitHandoverStockItem,
  FactoryWaitProcessStockItem,
  FactoryWarehouseInboundRecord,
  FactoryWarehouseOutboundRecord,
  FactoryWarehouseStocktakeLine,
  FactoryWarehouseStocktakeOrder,
} from '../data/fcs/factory-internal-warehouse.ts'
import {
  findFactoryInternalWarehouseById,
  findFactoryWarehouseInboundRecordBySourceRecordId,
  findFactoryWarehouseOutboundRecordByHandoverRecordId,
  getFactoryWarehousePositionStatusOptions,
  listFactoryInternalWarehouses,
} from '../data/fcs/factory-internal-warehouse.ts'
import { getFactoryMobileWarehouseCards, getFactoryMobileWarehouseOverview } from '../data/fcs/factory-mobile-warehouse.ts'
import type { FactoryMobileWarehouseCard, FactoryMobileWarehouseOverview } from '../data/fcs/factory-mobile-warehouse.ts'
import { findPdaHandoverRecord, findPdaPickupRecord } from '../data/fcs/pda-handover-events.ts'
import { getPdaRuntimeContext, renderPdaLoginRedirect } from './pda-runtime'
import { escapeHtml, formatDateTime, toClassName } from '../utils'

export function escapeAttr(value: string | number | undefined | null): string {
  return escapeHtml(value ?? '')
}

export function renderPdaWarehouseBusinessImage(input: {
  imageUrl?: string
  imageAlt: string
  openAction: string
  className?: string
}): string {
  const className = input.className ?? 'h-16 w-16'
  if (!input.imageUrl) {
    return `<div class="${className} flex shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 p-1 text-center text-[10px] text-red-700">缺少对应实物图</div>`
  }
  return `<button type="button" class="${className} relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted" data-pda-warehouse-action="${escapeAttr(input.openAction)}" data-image-url="${escapeAttr(input.imageUrl)}" data-image-alt="${escapeAttr(input.imageAlt)}"><img src="${escapeAttr(input.imageUrl)}" alt="${escapeAttr(input.imageAlt)}" class="h-full w-full object-cover" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>`
}

export function renderPdaWarehouseImagePreview(input: {
  imageUrl?: string
  imageAlt?: string
  closeAction: string
}): string {
  if (!input.imageUrl) return ''
  return `<div class="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 p-4" data-pda-warehouse-action="${escapeAttr(input.closeAction)}"><button type="button" class="absolute right-4 top-4 rounded-full bg-white px-3 py-2 text-sm" data-pda-warehouse-action="${escapeAttr(input.closeAction)}">关闭</button><img src="${escapeAttr(input.imageUrl)}" alt="${escapeAttr(input.imageAlt || '实物高清图')}" class="max-h-[85vh] max-w-full rounded-xl object-contain" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><div hidden class="rounded-xl bg-white p-8 text-sm text-red-700">图片加载失败，请核对原图素材。</div></div>`
}

export function showPdaWarehouseActionToast(message: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  const rootId = 'pda-warehouse-action-toast-root'
  let root = document.getElementById(rootId)
  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-4 top-20 z-[140] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }
  const toast = document.createElement('div')
  toast.className = 'pointer-events-auto rounded-md border border-destructive/30 bg-background px-4 py-3 text-sm text-destructive shadow-md'
  toast.textContent = message
  root.appendChild(toast)
  window.setTimeout(() => {
    toast.remove()
    if (root?.childElementCount === 0) root.remove()
  }, 3000)
}

export interface MobileWarehouseRuntimeContext {
  factoryId: string
  factoryName: string
  roleId: string
  overview: FactoryMobileWarehouseOverview
  cards: FactoryMobileWarehouseCard[]
  warehouses: FactoryInternalWarehouse[]
}

export function getMobileWarehouseRuntimeContext(): MobileWarehouseRuntimeContext | null {
  const runtime = getPdaRuntimeContext()
  if (!runtime) return null
  const warehouses = listFactoryInternalWarehouses().filter((item) => item.factoryId === runtime.factoryId)
  return {
    factoryId: runtime.factoryId,
    factoryName: runtime.factoryName,
    roleId: runtime.roleId,
    overview: getFactoryMobileWarehouseOverview(runtime.factoryId, runtime.factoryName),
    cards: getFactoryMobileWarehouseCards(runtime.factoryId, runtime.factoryName),
    warehouses,
  }
}

export function renderMobileWarehouseLoginRedirect(): string {
  return renderPdaLoginRedirect()
}

export function getCurrentFactoryWarehouseByKind(
  warehouseKind: FactoryInternalWarehouse['warehouseKind'],
): FactoryInternalWarehouse | undefined {
  const runtime = getPdaRuntimeContext()
  if (!runtime) return undefined
  return listFactoryInternalWarehouses().find(
    (item) => item.factoryId === runtime.factoryId && item.warehouseKind === warehouseKind,
  )
}

export function renderWarehouseSummaryHeader(
  title: string,
  subtitle: string,
  overview: FactoryMobileWarehouseOverview,
): string {
  return `
    <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-lg font-semibold text-foreground">${escapeHtml(title)}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(subtitle)}</div>
        </div>
        <div class="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">${escapeHtml(overview.factoryName)}</div>
      </div>
      <div class="mt-4 grid grid-cols-3 gap-2">
        ${[
          { label: '待加工数量', value: `${overview.waitProcessQty}` },
          { label: '待交出数量', value: `${overview.waitHandoverQty}` },
          { label: '今日入库', value: `${overview.todayInboundCount}` },
          { label: '今日出库', value: `${overview.todayOutboundCount}` },
          { label: '差异', value: `${overview.differenceCount}` },
          { label: '异议中', value: `${overview.objectionCount}` },
        ]
          .map(
            (item) => `
              <div class="rounded-2xl bg-muted/50 px-3 py-3">
                <div class="text-[11px] text-muted-foreground">${escapeHtml(item.label)}</div>
                <div class="mt-1 text-base font-semibold text-foreground">${escapeHtml(item.value)}</div>
              </div>
            `,
          )
          .join('')}
      </div>
      ${
        !overview.isSewingLightweight
          ? `
            <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div class="rounded-2xl border bg-background px-3 py-2">
                <div class="text-muted-foreground">已完成接收单</div>
                <div class="mt-1 font-semibold">${overview.pickupCompletedOrderCount} 单</div>
              </div>
              <div class="rounded-2xl border bg-background px-3 py-2">
                <div class="text-muted-foreground">已完成交出单</div>
                <div class="mt-1 font-semibold">${overview.handoutCompletedOrderCount} 单</div>
              </div>
              <div class="rounded-2xl border bg-background px-3 py-2">
                <div class="text-muted-foreground">待处理差异</div>
                <div class="mt-1 font-semibold">${overview.stocktakeWaitReviewCount} 条</div>
              </div>
              <div class="rounded-2xl border bg-background px-3 py-2">
                <div class="text-muted-foreground">已调整差异</div>
                <div class="mt-1 font-semibold">${overview.stocktakeAdjustedCount} 条</div>
              </div>
            </div>
          `
          : ''
      }
      ${
        overview.isSewingLightweight
          ? `
            <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div class="rounded-2xl border bg-background px-3 py-2">
                <div class="text-muted-foreground">待收中转袋</div>
                <div class="mt-1 font-semibold">${overview.pendingTransferBagReceiveCount} 袋</div>
              </div>
              <div class="rounded-2xl border bg-background px-3 py-2">
                <div class="text-muted-foreground">已收中转袋</div>
                <div class="mt-1 font-semibold">${overview.receivedTransferBagCount} 袋</div>
              </div>
              <div class="rounded-2xl border bg-background px-3 py-2">
                <div class="text-muted-foreground">菲票回写</div>
                <div class="mt-1 font-semibold">${overview.feiTicketWritebackCount} 张</div>
              </div>
              <div class="rounded-2xl border bg-background px-3 py-2">
                <div class="text-muted-foreground">中转袋差异</div>
                <div class="mt-1 font-semibold">${overview.transferBagDifferenceCount} 条</div>
              </div>
            </div>
          `
          : ''
      }
    </section>
  `
}

export function renderWarehouseActionCards(cards: FactoryMobileWarehouseCard[]): string {
  return `
    <section class="grid grid-cols-2 gap-3" data-pda-warehouse-cards="true">
      ${cards
        .map(
          (card) => `
            <button
              type="button"
              class="rounded-2xl border bg-card px-4 py-4 text-left shadow-sm transition hover:border-primary/40 hover:bg-primary/5"
              data-nav="${escapeAttr(card.route)}"
              data-pda-warehouse-card="${escapeAttr(card.cardId)}"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="text-sm font-semibold text-foreground">${escapeHtml(card.title)}</div>
                <span class="rounded-full px-2 py-0.5 text-[11px] ${toClassName(
                  card.status === 'danger'
                    ? 'bg-destructive/10 text-destructive'
                    : card.status === 'warning'
                      ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-muted text-muted-foreground',
                )}">${escapeHtml(card.countText)}</span>
              </div>
              <div class="mt-2 text-xs leading-5 text-muted-foreground">${escapeHtml(card.subText)}</div>
            </button>
          `,
        )
        .join('')}
    </section>
  `
}

export function renderStatusPill(status: string): string {
  const className =
    status.includes('差异') || status.includes('异议')
      ? 'bg-destructive/10 text-destructive'
      : status.includes('待')
        ? 'bg-amber-500/10 text-amber-700'
        : 'bg-emerald-500/10 text-emerald-700'
  return `<span class="inline-flex rounded-full px-2 py-0.5 text-[11px] ${className}">${escapeHtml(status)}</span>`
}

export function renderSectionFilterChips<T extends string>(
  activeValue: T,
  options: Array<{ value: T; label: string }>,
  field: string,
): string {
  return `
    <div class="flex gap-2 overflow-x-auto pb-1">
      ${options
        .map(
          (option) => `
            <button
              type="button"
              class="whitespace-nowrap rounded-full border px-3 py-1.5 text-xs ${toClassName(
                option.value === activeValue ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground',
              )}"
              data-pda-warehouse-field="${escapeAttr(field)}"
              data-value="${escapeAttr(option.value)}"
            >
              ${escapeHtml(option.label)}
            </button>
          `,
        )
        .join('')}
    </div>
  `
}

export function renderMobilePageEmptyState(title: string, description: string): string {
  return `
    <div class="rounded-2xl border border-dashed bg-card px-4 py-10 text-center">
      <div class="text-sm font-medium text-foreground">${escapeHtml(title)}</div>
      <div class="mt-2 text-xs leading-5 text-muted-foreground">${escapeHtml(description)}</div>
    </div>
  `
}

export function renderCompactFieldList(rows: Array<{ label: string; value: string }>): string {
  return `
    <div class="space-y-2 text-xs">
      ${rows
        .map(
          (row) => `
            <div class="flex items-start justify-between gap-3">
              <span class="text-muted-foreground">${escapeHtml(row.label)}</span>
              <span class="max-w-[62%] text-right text-foreground">${escapeHtml(row.value || '-')}</span>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

export function getMobileWarehouseSearchParams(): URLSearchParams {
  const pathname =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : ''
  const query = pathname.split('?')[1] || ''
  return new URLSearchParams(query)
}

export function getWaitProcessSourceActionLabel(item: Pick<FactoryWaitProcessStockItem, 'sourceRecordType'>): string {
  if (item.sourceRecordType === 'KOL_PROCESSING_PICKUP') return '加工领料'
  return item.sourceRecordType === 'HANDOVER_RECEIVE' ? '交出接收' : '接收记录'
}

export function getWaitProcessSourceStatusLabel(item: Pick<FactoryWaitProcessStockItem, 'status'>): string {
  return item.status === '差异待处理' ? '差异待处理' : '已确认'
}

export function getWaitHandoverWritebackStatusLabel(
  item: Pick<FactoryWaitHandoverStockItem, 'status' | 'receiverWrittenQty'>,
): string {
  if (item.status === '异议中') return '异议中'
  if (item.status === '差异') return '差异'
  if (item.status === '已回写') return '已回写'
  if (typeof item.receiverWrittenQty === 'number') return '已回写'
  return '未回写'
}

export function getWarehouseGeneratedModeLabel(sourceRecordType?: FactoryWaitProcessStockItem['sourceRecordType']): string {
  if (sourceRecordType === 'KOL_PROCESSING_PICKUP') return '加工领料自动写入'
  return '自动转单'
}

export function getWarehouseQrDisplayText(value?: string): string {
  return value ? '已生成' : '—'
}

export function resolveWarehouseInboundRecordRoute(sourceRecordId?: string): string {
  if (!sourceRecordId) return '/fcs/pda/warehouse/inbound-records'
  const inboundRecord = findFactoryWarehouseInboundRecordBySourceRecordId(sourceRecordId)
  if (!inboundRecord) return '/fcs/pda/warehouse/inbound-records'
  return `/fcs/pda/warehouse/inbound-records?recordId=${encodeURIComponent(inboundRecord.inboundRecordId)}`
}

export function resolveWarehouseOutboundRecordRoute(handoverRecordId?: string): string {
  if (!handoverRecordId) return '/fcs/pda/warehouse/outbound-records'
  const outboundRecord = findFactoryWarehouseOutboundRecordByHandoverRecordId(handoverRecordId)
  if (!outboundRecord) return '/fcs/pda/warehouse/outbound-records'
  return `/fcs/pda/warehouse/outbound-records?recordId=${encodeURIComponent(outboundRecord.outboundRecordId)}`
}

export function resolveInboundSourceRoute(record: FactoryWarehouseInboundRecord): string {
  if (record.sourceRecordType === 'HANDOVER_RECEIVE' && record.sourceRecordId) {
    const handoverRecord = findPdaHandoverRecord(record.sourceRecordId)
    if (handoverRecord?.handoverId) return `/fcs/pda/handover/${handoverRecord.handoverId}`
    return '/fcs/pda/handover?tab=handout'
  }
  if (record.sourceRecordType === 'MATERIAL_PICKUP' && record.sourceRecordId) {
    const pickupRecord = findPdaPickupRecord(record.sourceRecordId)
    if (pickupRecord?.handoverId) return `/fcs/pda/handover/${pickupRecord.handoverId}`
  }
  return '/fcs/pda/handover?tab=pickup'
}

export function resolveTaskRoute(taskId?: string): string {
  return taskId ? `/fcs/pda/exec/${taskId}` : '/fcs/pda/exec'
}

export function resolveOutboundRoute(record: FactoryWarehouseOutboundRecord): string {
  if (record.handoverOrderId) return `/fcs/pda/handover/${record.handoverOrderId}`
  return '/fcs/pda/handover'
}

export function resolveWaitProcessSourceRoute(item: FactoryWaitProcessStockItem): string {
  if (item.sourceRecordType === 'HANDOVER_RECEIVE' && item.sourceRecordId) {
    const handoverRecord = findPdaHandoverRecord(item.sourceRecordId)
    if (handoverRecord?.handoverId) return `/fcs/pda/handover/${handoverRecord.handoverId}`
    return '/fcs/pda/handover?tab=handout'
  }
  if (item.sourceRecordType === 'MATERIAL_PICKUP' && item.sourceRecordId) {
    const pickupRecord = findPdaPickupRecord(item.sourceRecordId)
    if (pickupRecord?.handoverId) return `/fcs/pda/handover/${pickupRecord.handoverId}`
  }
  return '/fcs/pda/handover?tab=pickup'
}

export function resolveWaitHandoverRoute(item: FactoryWaitHandoverStockItem): string {
  if (item.handoverOrderId) return `/fcs/pda/handover/${item.handoverOrderId}`
  return '/fcs/pda/handover'
}

export function getWarehousePositionOptions(warehouseId: string): {
  areaOptions: Array<{ value: string; label: string }>
  shelfOptionsByArea: Record<string, Array<{ value: string; label: string }>>
  locationOptionsByShelf: Record<string, Array<{ value: string; label: string }>>
} {
  const warehouse = findFactoryInternalWarehouseById(warehouseId)
  if (!warehouse) {
    return { areaOptions: [], shelfOptionsByArea: {}, locationOptionsByShelf: {} }
  }
  const areaOptions = warehouse.areaList.map((area) => ({ value: area.areaName, label: area.areaName }))
  const shelfOptionsByArea = Object.fromEntries(
    warehouse.areaList.map((area) => [
      area.areaName,
      area.shelfList.map((shelf) => ({ value: shelf.shelfNo, label: shelf.shelfName })),
    ]),
  )
  const locationOptionsByShelf = Object.fromEntries(
    warehouse.areaList.flatMap((area) =>
      area.shelfList.map((shelf) => [
        shelf.shelfNo,
        shelf.locationList.map((location) => ({ value: location.locationNo, label: location.locationName })),
      ]),
    ),
  )
  return { areaOptions, shelfOptionsByArea, locationOptionsByShelf }
}

export function getWarehousePositionStatusLabels(): Array<{ value: string; label: string }> {
  return getFactoryWarehousePositionStatusOptions()
}

export function formatWarehouseDateTime(value?: string): string {
  return value ? formatDateTime(value) : '-'
}

export function buildWarehouseDifferenceText(value?: number): string {
  if (typeof value !== 'number') return '-'
  return `${value}`
}

export function buildStocktakeStatusText(line: FactoryWarehouseStocktakeLine): string {
  return line.status
}

export function buildStocktakeOrderSummary(order: FactoryWarehouseStocktakeOrder): string {
  const diffCount = order.lineList.filter((line) => (line.differenceQty ?? 0) !== 0).length
  return `${order.lineList.length} 条 / 差异 ${diffCount} 条`
}
