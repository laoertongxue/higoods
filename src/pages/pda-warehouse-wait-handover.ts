import {
  listFactoryWaitHandoverStockItems,
  type FactoryWaitHandoverStockItem,
  updateWaitHandoverStockLocation,
} from '../data/fcs/factory-internal-warehouse.ts'
import { getFactoryMasterRecordById } from '../data/fcs/factory-master-store.ts'
import { executeSpecialCraftWaitHandoverSubmit } from '../data/fcs/special-craft-pda-warehouse-actions.ts'
import { OWN_WOOL_FACTORY_ID } from '../data/fcs/factory-mock-data.ts'
import {
  listAuxiliaryCraftTaskOrders,
  listSpecialTypeCraftTaskOrders,
} from '../data/fcs/special-craft-task-orders.ts'
import type { PostFinishingWaitHandoverWarehouseRecord } from '../data/fcs/post-finishing-domain.ts'
import {
  FULL_CAPABILITY_FACTORY_ID,
  listPostFinishingWaitHandoverWarehouseRecords,
} from '../data/fcs/post-finishing-domain.ts'
import {
  adjustWoolWarehouseStock,
  getWoolWorkOrderById,
  listWoolWarehouseFlows,
  listWoolWarehouseStocks,
  transferWoolWarehouseStock,
} from '../data/fcs/wool-task-domain.ts'
import { formatIndonesiaBusinessDateTime } from '../data/fcs/indonesia-business-time.ts'
import { listFactoryInternalWarehouses } from '../data/fcs/factory-internal-warehouse-locations.ts'
import { renderPdaFrame } from './pda-shell'
import {
  buildWarehouseDifferenceText,
  escapeAttr,
  formatWarehouseDateTime,
  getCurrentFactoryWarehouseByKind,
  getMobileWarehouseSearchParams,
  getMobileWarehouseRuntimeContext,
  getWaitHandoverWritebackStatusLabel,
  getWarehouseQrDisplayText,
  getWarehousePositionOptions,
  renderCompactFieldList,
  renderMobilePageEmptyState,
  renderSectionFilterChips,
  renderStatusPill,
  renderWarehouseSummaryHeader,
  resolveTaskRoute,
  resolveWaitHandoverRoute,
  resolveWarehouseOutboundRecordRoute,
} from './pda-warehouse-shared'
import { escapeHtml } from '../utils'
import { getSpecialCraftFeiTicketSummary } from '../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import {
  getPdaCuttingWaitHandoverActions,
  resolvePdaCuttingWaitHandoverLegacyActionRoute,
  type PdaCuttingWaitHandoverAction,
} from './pda-cutting-wait-handover-actions.ts'
import { renderRouteRedirect } from '../router/route-utils.ts'

type WaitHandoverFilter = '全部' | '待交出' | '已交出' | '已回写' | '差异' | '异议中'

interface WaitHandoverState {
  status: WaitHandoverFilter
  detailId: string | null
  locationEditId: string | null
  areaName: string
  shelfNo: string
  locationNo: string
  remark: string
  auxiliaryFinishScan: string
  auxiliaryFinishQty: string
  auxiliaryFinishLossQty: string
  auxiliaryFinishArea: string
  auxiliaryFinishShelf: string
  auxiliaryFinishLocation: string
  auxiliaryHandoverScan: string
  auxiliaryHandoverQty: string
  auxiliaryHandoverReceiver: string
  auxiliaryHandoverArea: string
  auxiliaryHandoverShelf: string
  auxiliaryHandoverLocation: string
  woolStockKey: string
  woolActionQty: string
  woolTransferTarget: string
  woolActionReason: string
  woolActionCommandId: string
}

const state: WaitHandoverState = {
  status: '全部',
  detailId: null,
  locationEditId: null,
  areaName: '',
  shelfNo: '',
  locationNo: '',
  remark: '',
  auxiliaryFinishScan: '',
  auxiliaryFinishQty: '',
  auxiliaryFinishLossQty: '',
  auxiliaryFinishArea: '',
  auxiliaryFinishShelf: '',
  auxiliaryFinishLocation: '',
  auxiliaryHandoverScan: '',
  auxiliaryHandoverQty: '',
  auxiliaryHandoverReceiver: '',
  auxiliaryHandoverArea: '',
  auxiliaryHandoverShelf: '',
  auxiliaryHandoverLocation: '',
  woolStockKey: '',
  woolActionQty: '',
  woolTransferTarget: '',
  woolActionReason: '',
  woolActionCommandId: '',
}

const FILTERS: Array<{ value: WaitHandoverFilter; label: string }> = [
  { value: '全部', label: '全部' },
  { value: '待交出', label: '待交出' },
  { value: '已交出', label: '已交出' },
  { value: '已回写', label: '已回写' },
  { value: '差异', label: '差异' },
  { value: '异议中', label: '异议中' },
]

const LINKED_QR_FIELD = ['handoverRecord', 'QrValue'].join('')

type AuxiliaryWaitHandoverAction = 'finish-inbound' | 'handover-confirm'
type WoolWaitHandoverAction = 'adjust' | 'transfer'

function getCraftWarehouseRuntimeLabel(): '辅助工艺' | '特种工艺' | null {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return null
  const factory = getFactoryMasterRecordById(runtime.factoryId)
  if (factory?.factoryType === 'CENTRAL_AUX') return '辅助工艺'
  if (factory?.factoryType === 'CENTRAL_SPECIAL') return '特种工艺'
  return null
}

function isCraftWarehouseRuntime(): boolean {
  return Boolean(getCraftWarehouseRuntimeLabel())
}

function ensureCraftWarehouseMockData(): void {
  const runtimeLabel = getCraftWarehouseRuntimeLabel()
  if (runtimeLabel === '辅助工艺') {
    listAuxiliaryCraftTaskOrders()
  } else if (runtimeLabel === '特种工艺') {
    listSpecialTypeCraftTaskOrders()
  }
}

function getAuxiliaryWaitHandoverRows(ignoreStatus = false): FactoryWaitHandoverStockItem[] {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return []
  ensureCraftWarehouseMockData()
  return listFactoryWaitHandoverStockItems()
    .filter((item) => item.factoryId === runtime.factoryId && Boolean(item.craftName))
    .filter((item) => (state.status === '已交出' ? true : item.status !== '已交出'))
    .filter((item) => (ignoreStatus || state.status === '全部' ? true : item.status === state.status))
}

function getAuxiliaryWaitHandoverAction(value?: string | null): AuxiliaryWaitHandoverAction | null {
  return value === 'finish-inbound' || value === 'handover-confirm' ? value : null
}

function renderGarmentWaitHandoverCard(row: FactoryWaitHandoverStockItem): string {
  const taskRows = listFactoryWaitHandoverStockItems().filter((item) => item.taskId === row.taskId && item.itemKind === '成衣')
  const handedOverSkuCount = taskRows.filter((item) => item.status === '已交出').length
  return `
    <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm" data-garment-sku-card="wait-handover">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="text-sm font-semibold text-foreground">${escapeHtml(row.productionOrderNo || '-')}</div>
          <div class="mt-1 text-xs text-muted-foreground">SKU：${escapeHtml(row.materialSku || '-')} · ${escapeHtml(row.fabricColor || '-')} / ${escapeHtml(row.sizeCode || '-')}</div>
        </div>
        ${renderStatusPill(row.status)}
      </div>
      <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <div>待交出件数：${row.waitHandoverQty} 件</div>
        <div>当前仓：${escapeHtml(row.warehouseName)} · ${escapeHtml(row.locationText)}</div>
        <div>下一站：${escapeHtml(row.receiverName || '我方后道工厂')}</div>
        <div>本单交出进度：${handedOverSkuCount} / ${taskRows.length} SKU</div>
        <div>下一动作：交出确认</div>
      </div>
      <div class="mt-4 flex gap-2">
        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-fast-page-render data-pda-warehouse-action="open-wait-handover-detail" data-stock-item-id="${escapeAttr(row.stockItemId)}">查看</button>
        <button type="button" class="rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground" data-pda-warehouse-action="special-craft-wait-handover-submit" data-stock-item-id="${escapeAttr(row.stockItemId)}" data-task-order-id="${escapeAttr(row.taskId || '')}" data-sku-code="${escapeAttr(row.materialSku || '')}">交出确认</button>
      </div>
    </article>
  `
}

function getAuxiliaryWaitHandoverSample(): FactoryWaitHandoverStockItem | undefined {
  return getAuxiliaryWaitHandoverRows(true)[0]
}

function ensureAuxiliaryWaitHandoverDraft(action: AuxiliaryWaitHandoverAction): FactoryWaitHandoverStockItem | undefined {
  const sample = getAuxiliaryWaitHandoverSample()
  if (!sample) return undefined
  if (action === 'finish-inbound') {
    state.auxiliaryFinishScan ||= sample.taskNo || sample.stockItemId
    state.auxiliaryFinishQty ||= String(sample.completedQty)
    state.auxiliaryFinishLossQty ||= String(sample.lossQty)
    state.auxiliaryFinishArea ||= sample.areaName
    state.auxiliaryFinishShelf ||= sample.shelfNo
    state.auxiliaryFinishLocation ||= sample.locationNo
  } else {
    state.auxiliaryHandoverScan ||= sample.handoverOrderNo || sample.taskNo || sample.stockItemId
    state.auxiliaryHandoverQty ||= String(sample.waitHandoverQty || sample.completedQty)
    state.auxiliaryHandoverReceiver ||= sample.receiverName
    state.auxiliaryHandoverArea ||= sample.areaName
    state.auxiliaryHandoverShelf ||= sample.shelfNo
    state.auxiliaryHandoverLocation ||= sample.locationNo
  }
  return sample
}

function renderAuxiliaryWaitHandoverActionCards(activeAction?: AuxiliaryWaitHandoverAction | null): string {
  const actions: Array<{ key: AuxiliaryWaitHandoverAction; title: string; desc: string }> = [
    { key: 'finish-inbound', title: '完工入仓', desc: '确认加工完成数量、损耗和库位。' },
    { key: 'handover-confirm', title: '交出确认', desc: '确认接收方和数量，形成交出记录。' },
  ]
  return `
    <section class="grid grid-cols-2 gap-2">
      ${actions.map((item) => `
        <button
          type="button"
          class="rounded-2xl border px-4 py-4 text-left shadow-sm ${activeAction === item.key ? 'border-primary bg-primary/5' : 'bg-card'}"
          data-nav="/fcs/pda/warehouse/wait-handover?action=${escapeAttr(item.key)}"
        >
          <div class="text-sm font-semibold text-foreground">${escapeHtml(item.title)}</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">${escapeHtml(item.desc)}</div>
        </button>
      `).join('')}
    </section>
  `
}

function renderAuxiliaryWaitHandoverPositionFields(action: AuxiliaryWaitHandoverAction): string {
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_HANDOVER')
  if (!warehouse) return ''
  const options = getWarehousePositionOptions(warehouse.warehouseId)
  const areaValue = action === 'finish-inbound' ? state.auxiliaryFinishArea : state.auxiliaryHandoverArea
  const shelfValue = action === 'finish-inbound' ? state.auxiliaryFinishShelf : state.auxiliaryHandoverShelf
  const locationValue = action === 'finish-inbound' ? state.auxiliaryFinishLocation : state.auxiliaryHandoverLocation
  const fieldPrefix = action === 'finish-inbound' ? 'auxiliary-finish' : 'auxiliary-handover'
  const shelfOptions = options.shelfOptionsByArea[areaValue] || []
  const locationOptions = options.locationOptionsByShelf[shelfValue] || []
  return `
    <div class="grid grid-cols-1 gap-3">
      <label class="block space-y-1.5">
        <span class="text-xs font-medium text-muted-foreground">库区</span>
        <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="${fieldPrefix}-area">
          ${options.areaOptions.map((option) => `<option value="${escapeAttr(option.value)}" ${option.value === areaValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
        </select>
      </label>
      <label class="block space-y-1.5">
        <span class="text-xs font-medium text-muted-foreground">货架</span>
        <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="${fieldPrefix}-shelf">
          ${shelfOptions.map((option) => `<option value="${escapeAttr(option.value)}" ${option.value === shelfValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
        </select>
      </label>
      <label class="block space-y-1.5">
        <span class="text-xs font-medium text-muted-foreground">库位</span>
        <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="${fieldPrefix}-location">
          ${locationOptions.map((option) => `<option value="${escapeAttr(option.value)}" ${option.value === locationValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
        </select>
      </label>
    </div>
  `
}

function updateAuxiliaryWaitHandoverArea(action: AuxiliaryWaitHandoverAction, value: string): void {
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_HANDOVER')
  const options = warehouse ? getWarehousePositionOptions(warehouse.warehouseId) : null
  const nextShelf = options?.shelfOptionsByArea[value]?.[0]?.value || ''
  const nextLocation = options?.locationOptionsByShelf[nextShelf]?.[0]?.value || ''
  if (action === 'finish-inbound') {
    state.auxiliaryFinishArea = value
    state.auxiliaryFinishShelf = nextShelf
    state.auxiliaryFinishLocation = nextLocation
  } else {
    state.auxiliaryHandoverArea = value
    state.auxiliaryHandoverShelf = nextShelf
    state.auxiliaryHandoverLocation = nextLocation
  }
}

function updateAuxiliaryWaitHandoverShelf(action: AuxiliaryWaitHandoverAction, value: string): void {
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_HANDOVER')
  const options = warehouse ? getWarehousePositionOptions(warehouse.warehouseId) : null
  const nextLocation = options?.locationOptionsByShelf[value]?.[0]?.value || ''
  if (action === 'finish-inbound') {
    state.auxiliaryFinishShelf = value
    state.auxiliaryFinishLocation = nextLocation
  } else {
    state.auxiliaryHandoverShelf = value
    state.auxiliaryHandoverLocation = nextLocation
  }
}

function updateAuxiliaryWaitHandoverLocation(action: AuxiliaryWaitHandoverAction, value: string): void {
  if (action === 'finish-inbound') state.auxiliaryFinishLocation = value
  else state.auxiliaryHandoverLocation = value
}

function renderCuttingWaitHandoverActionCards(actions: PdaCuttingWaitHandoverAction[]): string {
  return `
    <section class="grid grid-cols-2 gap-2">
      ${actions.map((item) => `
        <button
          type="button"
          class="rounded-2xl border bg-card px-4 py-4 text-left shadow-sm"
          data-nav="${escapeAttr(item.route)}"
          data-pda-cutting-wait-handover-entry="${escapeAttr(item.key)}"
        >
          <div class="text-sm font-semibold text-foreground">${escapeHtml(item.title)}</div>
        </button>
      `).join('')}
    </section>
  `
}

function renderAuxiliaryWaitHandoverActionPage(action: AuxiliaryWaitHandoverAction): string {
  const sample = ensureAuxiliaryWaitHandoverDraft(action)
  const runtimeLabel = getCraftWarehouseRuntimeLabel() || '工艺'
  const isFinishInbound = action === 'finish-inbound'
  const title = isFinishInbound ? '完工入仓' : '交出确认'
  const scanValue = isFinishInbound ? state.auxiliaryFinishScan : state.auxiliaryHandoverScan
  const qtyValue = isFinishInbound ? state.auxiliaryFinishQty : state.auxiliaryHandoverQty
  return `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="flex items-start justify-between gap-3">
        <div>
          <div class="text-xl font-semibold leading-tight text-foreground">${escapeHtml(title)}</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">${escapeHtml(sample ? `${sample.craftName || runtimeLabel} · ${sample.itemName}` : '暂无可用演示记录')}</div>
        </div>
        <button type="button" class="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-medium" data-nav="/fcs/pda/warehouse">返回仓管</button>
      </section>
      ${renderAuxiliaryWaitHandoverActionCards(action)}
      <section class="space-y-3 rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">${isFinishInbound ? '加工任务 / 完工单' : '交出单 / 加工任务'}</span>
          <input
            class="h-11 w-full rounded-xl border bg-background px-3 text-sm"
            value="${escapeAttr(scanValue)}"
            placeholder="扫码或输入单号"
            data-pda-warehouse-field="${isFinishInbound ? 'auxiliary-finish-scan' : 'auxiliary-handover-scan'}"
          />
        </label>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">${isFinishInbound ? '完工数量' : '交出数量'}（${escapeHtml(sample?.unit || '件')}）</span>
          <input
            class="h-11 w-full rounded-xl border bg-background px-3 text-sm"
            inputmode="decimal"
            value="${escapeAttr(qtyValue)}"
            data-pda-warehouse-field="${isFinishInbound ? 'auxiliary-finish-qty' : 'auxiliary-handover-qty'}"
          />
        </label>
        ${
          isFinishInbound
            ? `<label class="block space-y-1.5">
                <span class="text-xs font-medium text-muted-foreground">损耗数量（${escapeHtml(sample?.unit || '件')}）</span>
                <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(state.auxiliaryFinishLossQty)}" data-pda-warehouse-field="auxiliary-finish-loss-qty" />
              </label>`
            : `<label class="block space-y-1.5">
                <span class="text-xs font-medium text-muted-foreground">接收方</span>
                <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" value="${escapeAttr(state.auxiliaryHandoverReceiver)}" data-pda-warehouse-field="auxiliary-handover-receiver" />
              </label>`
        }
        ${renderAuxiliaryWaitHandoverPositionFields(action)}
        <button type="button" class="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="confirm-auxiliary-${isFinishInbound ? 'finish' : 'handover'}">
          ${escapeHtml(isFinishInbound ? '确认完工入仓' : '确认交出')}
        </button>
      </section>
    </div>
  `
}

function renderAuxiliaryWaitHandoverPage(): string {
  const activeAction = getAuxiliaryWaitHandoverAction(getMobileWarehouseSearchParams().get('action'))
  if (activeAction) {
    const title = activeAction === 'finish-inbound' ? '完工入仓' : '交出确认'
    return renderPdaFrame(renderAuxiliaryWaitHandoverActionPage(activeAction), 'warehouse', { headerTitle: title, disableTodoAutoOpen: true })
  }
  const runtime = getMobileWarehouseRuntimeContext()
  const runtimeLabel = getCraftWarehouseRuntimeLabel() || '工艺'
  const rows = getAuxiliaryWaitHandoverRows()
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${runtime ? renderWarehouseSummaryHeader(`${runtimeLabel}待交出仓`, '完工入仓生成待交出库存，交出确认后形成交出记录。', runtime.overview) : ''}
      ${renderAuxiliaryWaitHandoverActionCards()}
      ${renderSectionFilterChips(state.status, FILTERS, 'wait-handover-status')}
      <section class="space-y-3">
        ${
          rows.length > 0
            ? rows.map((row) => {
              const isGarment = row.itemKind === '成衣'
              if (isGarment) return renderGarmentWaitHandoverCard(row)
              return `
              <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-semibold text-foreground">${escapeHtml(row.taskNo || row.stockItemId)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.craftName || runtimeLabel)} · ${escapeHtml(row.handoverOrderNo || '待交出')}</div>
                  </div>
                  ${renderStatusPill(row.status)}
                </div>
                <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <div>库存对象：${escapeHtml(row.itemName)} / ${escapeHtml(row.materialSku || row.partName || '-')}</div>
                  <div>生产单：${escapeHtml(row.productionOrderNo || '-')}</div>
                  ${isGarment ? '' : `<div>菲票 / 中转袋：${escapeHtml(row.feiTicketNo || '-')} / ${escapeHtml(row.transferBagNo || '-')}</div>`}
                  <div>完工 / 损耗：${row.completedQty} / ${row.lossQty} ${escapeHtml(row.unit)}</div>
                  <div>待交出 / 回写：${row.waitHandoverQty} / ${row.receiverWrittenQty ?? '-'} ${escapeHtml(row.unit)}</div>
                  ${isGarment
                    ? `<div>下一站：${escapeHtml(row.receiverName || '我方后道工厂')}</div>`
                    : `<div>接收方：${escapeHtml(row.receiverName || '-')}</div>`}
                  ${isGarment ? '' : `<div>交出记录：${escapeHtml(row.handoverRecordNo || '待提交')}</div>`}
                  <div>库区 / 货架 / 库位：${escapeHtml(row.areaName)} / ${escapeHtml(row.shelfNo)} / ${escapeHtml(row.locationNo)}</div>
                  <div>差异 / 异议：${escapeHtml(buildWarehouseDifferenceText(row.differenceQty))}${row.objectionStatus ? ` · ${escapeHtml(row.objectionStatus)}` : ''}</div>
                </div>
                <div class="mt-4 flex flex-wrap gap-2">
                  <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-handover-detail" data-stock-item-id="${escapeAttr(row.stockItemId)}">查看</button>
                  ${isGarment ? '' : `<button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="/fcs/pda/warehouse/wait-handover?action=finish-inbound">完工入仓</button>`}
                  <button type="button" class="rounded-full ${isGarment ? 'bg-primary text-primary-foreground' : 'border'} px-3 py-1.5 text-xs" data-nav="/fcs/pda/warehouse/wait-handover?action=handover-confirm">交出确认</button>
                  ${isGarment ? '' : `<button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-handover-location" data-stock-item-id="${escapeAttr(row.stockItemId)}">调整位置</button>`}
                </div>
              </article>
            `}).join('')
            : renderMobilePageEmptyState(`暂无${runtimeLabel}待交出仓记录`, '完工入仓后会形成待交出库存。')
        }
      </section>
      ${renderDetailDrawer()}
      ${renderLocationDialog()}
    </div>
  `
  return renderPdaFrame(content, 'warehouse', { headerTitle: `${runtimeLabel}待交出仓`, disableTodoAutoOpen: true })
}

function renderCuttingWarehouseSwitch(active: 'wait-process' | 'wait-handover'): string {
  return `
    <section class="grid grid-cols-2 gap-2">
      <button type="button" class="rounded-2xl ${active === 'wait-process' ? 'bg-primary text-primary-foreground' : 'border bg-background'} px-4 py-3 text-sm font-medium" data-nav="/fcs/pda/warehouse/wait-process?scope=cutting">裁床待加工仓</button>
      <button type="button" class="rounded-2xl ${active === 'wait-handover' ? 'bg-primary text-primary-foreground' : 'border bg-background'} px-4 py-3 text-sm font-medium" data-nav="/fcs/pda/warehouse/wait-handover?scope=cutting">裁床待交出仓</button>
    </section>
  `
}

function renderCuttingWaitHandoverRootContent(): string {
  return `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderCuttingWarehouseSwitch('wait-handover')}
      ${renderCuttingWaitHandoverActionCards(getPdaCuttingWaitHandoverActions())}
    </div>
  `
}

function renderCuttingWaitHandoverPage(): string {
  const activeAction = getMobileWarehouseSearchParams().get('action')
  const legacyActionRoute = resolvePdaCuttingWaitHandoverLegacyActionRoute(activeAction)
  if (legacyActionRoute) return renderRouteRedirect(legacyActionRoute, '正在进入裁床操作')

  return renderPdaFrame(
    renderCuttingWaitHandoverRootContent(),
    'warehouse',
    { headerTitle: '裁床待交出仓', disableTodoAutoOpen: true },
  )
}

function normalizePostFinishingIdSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').slice(-16) || 'UNKNOWN'
}

function buildPostFinishingPdaHandoverRoute(recheckOrderNo: string): string {
  return `/fcs/pda/handover/HOH-POST-${normalizePostFinishingIdSegment(recheckOrderNo)}`
}

function getLinkedQrValue(source: Record<string, unknown>): string | undefined {
  const value = source[LINKED_QR_FIELD]
  return typeof value === 'string' ? value : undefined
}

function getRows() {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return []
  return listFactoryWaitHandoverStockItems()
    .filter((item) => item.factoryId === runtime.factoryId)
    .filter((item) => (state.status === '全部' ? true : item.status === state.status))
}

function openLocationEditor(stockItemId: string): void {
  const row = getRows().find((item) => item.stockItemId === stockItemId)
  if (!row) return
  state.locationEditId = row.stockItemId
  state.areaName = row.areaName
  state.shelfNo = row.shelfNo
  state.locationNo = row.locationNo
  state.remark = row.remark || ''
}

function renderDetailDrawer(): string {
  const row = getRows().find((item) => item.stockItemId === state.detailId)
  if (!row) return ''
  if (row.itemKind === '成衣') {
    return `
      <div class="fixed inset-0 z-[120]">
        <button type="button" class="absolute inset-0 bg-black/40" data-fast-page-render data-pda-warehouse-action="close-wait-handover-detail"></button>
        <section class="absolute inset-x-0 bottom-[72px] rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-base font-semibold text-foreground">成衣 SKU 待交出详情</h2>
            <button type="button" class="rounded-full border px-3 py-1 text-xs" data-fast-page-render data-pda-warehouse-action="close-wait-handover-detail">关闭</button>
          </div>
          <div class="mt-4 rounded-2xl border bg-card px-4 py-4 shadow-sm">
            ${renderCompactFieldList([
              { label: '生产单', value: row.productionOrderNo || '-' },
              { label: 'SKU', value: row.materialSku || '-' },
              { label: '颜色 / 尺码', value: `${row.fabricColor || '-'} / ${row.sizeCode || '-'}` },
              { label: '待交出', value: `${row.waitHandoverQty} 件` },
              { label: '当前仓', value: `${row.warehouseName} · ${row.locationText}` },
              { label: '下一站', value: row.receiverName || '我方后道工厂' },
              { label: '下一动作', value: '交出确认' },
            ])}
          </div>
        </section>
      </div>
    `
  }
  const specialCraftSummary = row.feiTicketNo ? getSpecialCraftFeiTicketSummary(row.feiTicketNo) : null
  const outboundRoute = resolveWarehouseOutboundRecordRoute(row.handoverRecordId)
  return `
    <div class="fixed inset-0 z-[120]">
      <button type="button" class="absolute inset-0 bg-black/40" data-pda-warehouse-action="close-wait-handover-detail"></button>
      <section class="absolute inset-x-0 bottom-[72px] rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-foreground">待交出仓详情</h2>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-warehouse-action="close-wait-handover-detail">关闭</button>
        </div>
        <div class="mt-4 rounded-2xl border bg-card px-4 py-4 shadow-sm">
          ${renderCompactFieldList([
            { label: '来源任务', value: row.taskNo || '-' },
            { label: '物料 / 裁片类型', value: `${row.itemKind} / ${row.itemName}` },
            { label: '面料 SKU / 裁片部位', value: row.materialSku || row.partName || '-' },
            { label: '颜色', value: row.fabricColor || '-' },
            { label: '尺码', value: row.sizeCode || '-' },
            { label: '菲票号', value: row.feiTicketNo || '-' },
            { label: '特殊工艺', value: specialCraftSummary ? specialCraftSummary.operationNames.join(' / ') || '无' : '-' },
            { label: '当前所在', value: specialCraftSummary?.currentLocation || '-' },
            { label: '已完成特殊工艺', value: specialCraftSummary?.completedOperationNames.join(' / ') || '-' },
            { label: '当前特殊工艺', value: specialCraftSummary?.currentOperationName || '-' },
            { label: '原裁片数量 / 当前裁片数量', value: specialCraftSummary ? `${specialCraftSummary.originalQty} / ${specialCraftSummary.currentQty}` : '-' },
            { label: '报废裁片数量 / 货损裁片数量', value: specialCraftSummary ? `${specialCraftSummary.cumulativeScrapQty} / ${specialCraftSummary.cumulativeDamageQty}` : '-' },
            { label: '差异状态', value: specialCraftSummary ? [specialCraftSummary.receiveDifferenceStatus, specialCraftSummary.returnDifferenceStatus].filter((item) => item && item !== '—').join(' / ') || '无' : '-' },
            { label: '发料状态 / 回仓状态', value: specialCraftSummary ? `${specialCraftSummary.dispatchStatus} / ${specialCraftSummary.returnStatus}` : '-' },
            { label: '中转袋号', value: row.transferBagNo || '-' },
            { label: '卷号', value: row.fabricRollNo || '-' },
            { label: '加工完成数量', value: `${row.completedQty} ${row.unit}` },
            { label: '损耗数量', value: `${row.lossQty} ${row.unit}` },
            { label: '待交出数量', value: `${row.waitHandoverQty} ${row.unit}` },
            { label: '接收方', value: row.receiverName || '-' },
            { label: '交出单', value: row.handoverOrderNo || '-' },
            { label: '交出记录', value: row.handoverRecordNo || '-' },
            { label: '出库记录', value: outboundRoute.includes('recordId=') ? '点击查看' : '未出库' },
            { label: '交出二维码', value: getWarehouseQrDisplayText(getLinkedQrValue(row)) },
            { label: '回写状态', value: getWaitHandoverWritebackStatusLabel(row) },
            { label: '回写数量', value: row.receiverWrittenQty === undefined ? '-' : `${row.receiverWrittenQty} ${row.unit}` },
            { label: '差异 / 异议', value: buildWarehouseDifferenceText(row.differenceQty) },
            { label: '库区', value: row.areaName },
            { label: '货架', value: row.shelfNo },
            { label: '库位', value: row.locationNo },
            { label: '状态', value: row.status },
          ])}
          <div class="mt-4 flex gap-2">
            <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-nav="${escapeAttr(outboundRoute)}">查看出库</button>
            <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-nav="${escapeAttr(resolveWaitHandoverRoute(row))}">查看交出</button>
            <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-nav="${escapeAttr(resolveTaskRoute(row.taskId))}">查看任务</button>
          </div>
        </div>
      </section>
    </div>
  `
}

function renderLocationDialog(): string {
  const row = getRows().find((item) => item.stockItemId === state.locationEditId)
  if (!row) return ''
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_HANDOVER')
  if (!warehouse) return ''
  const options = getWarehousePositionOptions(warehouse.warehouseId)
  const shelfOptions = options.shelfOptionsByArea[state.areaName] || []
  const locationOptions = options.locationOptionsByShelf[state.shelfNo] || []
  return `
    <div class="fixed inset-0 z-[125]">
      <button type="button" class="absolute inset-0 bg-black/40" data-pda-warehouse-action="close-wait-handover-location"></button>
      <section class="absolute inset-x-0 bottom-[72px] rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-foreground">调整位置</h2>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-warehouse-action="close-wait-handover-location">关闭</button>
        </div>
        <div class="mt-4 space-y-3">
          <label class="block text-xs text-muted-foreground">库区</label>
          <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wait-handover-area">
            ${options.areaOptions.map((option) => `<option value="${escapeAttr(option.value)}" ${option.value === state.areaName ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
          </select>
          <label class="block text-xs text-muted-foreground">货架</label>
          <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wait-handover-shelf">
            ${shelfOptions.map((option) => `<option value="${escapeAttr(option.value)}" ${option.value === state.shelfNo ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
          </select>
          <label class="block text-xs text-muted-foreground">库位</label>
          <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wait-handover-location">
            ${locationOptions.map((option) => `<option value="${escapeAttr(option.value)}" ${option.value === state.locationNo ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
          </select>
          <label class="block text-xs text-muted-foreground">备注</label>
          <textarea class="min-h-20 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-warehouse-field="wait-handover-remark">${escapeHtml(state.remark)}</textarea>
        </div>
        <div class="mt-4 flex gap-2">
          <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-pda-warehouse-action="close-wait-handover-location">取消</button>
          <button type="button" class="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground" data-pda-warehouse-action="save-wait-handover-location">保存</button>
        </div>
      </section>
    </div>
  `
}

function getPostFinishingWaitHandoverRows(): PostFinishingWaitHandoverWarehouseRecord[] {
  return listPostFinishingWaitHandoverWarehouseRecords()
}

function getPostFinishingWaitHandoverStatus(row: PostFinishingWaitHandoverWarehouseRecord): string {
  if (row.diffGarmentQty !== 0) return '差异'
  if (row.submittedHandoverGarmentQty <= 0) return '待交出'
  if (row.submittedHandoverGarmentQty >= row.waitHandoverGarmentQty && row.receivedHandoverGarmentQty >= row.submittedHandoverGarmentQty) return '已回写'
  if (row.submittedHandoverGarmentQty >= row.waitHandoverGarmentQty) return '已交出'
  return '部分交出'
}

function renderPostFinishingWaitHandoverDetailDrawer(): string {
  const row = getPostFinishingWaitHandoverRows().find((item) => item.warehouseRecordId === state.detailId)
  if (!row) return ''
  return `
    <div class="fixed inset-0 z-[120]">
      <button type="button" class="absolute inset-0 bg-black/40" data-pda-warehouse-action="close-wait-handover-detail"></button>
      <section class="absolute inset-x-0 bottom-[72px] max-h-[78vh] overflow-y-auto rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-foreground">后道待交出仓详情</h2>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-warehouse-action="close-wait-handover-detail">关闭</button>
        </div>
        <div class="mt-4 rounded-2xl border bg-card px-4 py-4 shadow-sm">
          ${renderCompactFieldList([
            { label: '仓库记录', value: row.warehouseRecordNo },
            { label: '复检单', value: row.recheckOrderNo },
            { label: '生产单', value: row.sourceProductionOrderNo },
            { label: '后道任务', value: row.sourceTaskNo },
            { label: '款式', value: `${row.spuCode} / ${row.spuName}` },
            { label: 'SKU', value: row.skuSummary },
            { label: '待交出', value: `${row.waitHandoverGarmentQty} ${row.qtyUnit}` },
            { label: '已交出', value: `${row.submittedHandoverGarmentQty} ${row.qtyUnit}` },
            { label: '已回写', value: `${row.receivedHandoverGarmentQty} ${row.qtyUnit}` },
            { label: '差异', value: `${row.diffGarmentQty} ${row.qtyUnit}` },
            { label: '最新交出记录', value: row.handoverRecordNo || '-' },
            { label: '状态', value: getPostFinishingWaitHandoverStatus(row) },
          ])}
        </div>
        <div class="mt-3 space-y-2">
          ${row.flowRecords.map((flow) => `
            <div class="rounded-xl border bg-card px-3 py-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="font-medium">${escapeHtml(flow.flowType)}</span>
                <span class="text-muted-foreground">${escapeHtml(formatWarehouseDateTime(flow.operatedAt))}</span>
              </div>
              <div class="mt-1 text-muted-foreground">${escapeHtml(flow.sourceActionRecordNo)} · ${flow.qty} ${escapeHtml(flow.qtyUnit)} · ${escapeHtml(flow.remark)}</div>
              <div class="mt-1 text-muted-foreground">变动前后：${flow.beforeQty} → ${flow.afterQty}</div>
            </div>
          `).join('')}
        </div>
      </section>
    </div>
  `
}

function renderPostFinishingWaitHandoverPage(): string {
  const rows = getPostFinishingWaitHandoverRows()
  const waitQty = rows.reduce((sum, item) => sum + Math.max(item.waitHandoverGarmentQty - item.submittedHandoverGarmentQty, 0), 0)
  const submittedQty = rows.reduce((sum, item) => sum + item.submittedHandoverGarmentQty, 0)
  const flowCount = rows.reduce((sum, item) => sum + item.flowRecords.length, 0)
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="grid grid-cols-2 gap-2">
        <button type="button" class="rounded-2xl border bg-background px-4 py-3 text-sm font-medium" data-nav="/fcs/pda/warehouse/wait-process">待加工仓</button>
        <button type="button" class="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground" data-nav="/fcs/pda/warehouse/wait-handover">待交出仓</button>
      </section>
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <div class="text-base font-semibold">后道待交出仓</div>
        <div class="mt-1 text-xs text-muted-foreground">复检完成入待交出仓，交出记录提交后扣减。</div>
        <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${rows.length}</div><div class="text-muted-foreground">SKU</div></div>
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${waitQty}</div><div class="text-muted-foreground">待交出</div></div>
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${submittedQty}</div><div class="text-muted-foreground">已交出</div></div>
        </div>
        <div class="mt-2 text-xs text-muted-foreground">累计流水 ${flowCount} 条。</div>
      </section>
      <section class="space-y-3">
        ${rows.length > 0 ? rows.map((item) => `
          <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold">${escapeHtml(item.skuCode)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.spuName)} · ${escapeHtml(item.colorName)} / ${escapeHtml(item.sizeName)}</div>
              </div>
              ${renderStatusPill(getPostFinishingWaitHandoverStatus(item))}
            </div>
            <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <div>生产单：${escapeHtml(item.sourceProductionOrderNo)}</div>
              <div>复检单：${escapeHtml(item.recheckOrderNo)}</div>
              <div>待交出 / 已交出：${item.waitHandoverGarmentQty} / ${item.submittedHandoverGarmentQty} ${escapeHtml(item.qtyUnit)}</div>
              <div>已回写 / 差异：${item.receivedHandoverGarmentQty} / ${item.diffGarmentQty} ${escapeHtml(item.qtyUnit)}</div>
              <div>最新交出记录：${escapeHtml(item.handoverRecordNo || '待提交')}</div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-handover-detail" data-stock-item-id="${escapeAttr(item.warehouseRecordId)}">查看流水</button>
              <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(buildPostFinishingPdaHandoverRoute(item.recheckOrderNo))}">去交出</button>
              <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveTaskRoute(item.sourceTaskNo))}">查看任务</button>
            </div>
          </article>
        `).join('') : renderMobilePageEmptyState('暂无后道待交出库存', '复检完成后，会进入后道待交出仓。')}
      </section>
      ${renderPostFinishingWaitHandoverDetailDrawer()}
    </div>
  `
  return renderPdaFrame(content, 'warehouse', { headerTitle: '后道待交出仓', disableTodoAutoOpen: true })
}

function getWoolWaitHandoverAction(value?: string | null): WoolWaitHandoverAction | null {
  return value === 'adjust' || value === 'transfer' ? value : null
}

function getWoolWaitHandoverStocks() {
  return listWoolWarehouseStocks('WAIT_HANDOVER')
}

function renderWoolWaitHandoverActionCards(activeAction?: WoolWaitHandoverAction | null): string {
  const actions: Array<{ key: WoolWaitHandoverAction; title: string; desc: string }> = [
    { key: 'adjust', title: '库存调整', desc: '盘点有误时填写原因并调整当前数量。' },
    { key: 'transfer', title: '库存转移', desc: '将默认库位库存转到公共仓库启用库位。' },
  ]
  return `
    <section class="grid grid-cols-2 gap-2">
      ${actions.map((item) => `
        <button
          type="button"
          class="rounded-2xl border px-4 py-4 text-left shadow-sm ${activeAction === item.key ? 'border-primary bg-primary/5' : 'bg-card'}"
          data-nav="/fcs/pda/warehouse/wait-handover?action=${escapeAttr(item.key)}"
        >
          <div class="text-sm font-semibold text-foreground">${escapeHtml(item.title)}</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">${escapeHtml(item.desc)}</div>
        </button>
      `).join('')}
    </section>
  `
}

function renderWoolWaitHandoverStockSelect(value: string): string {
  const stocks = getWoolWaitHandoverStocks()
  return `
    <label class="block space-y-1.5">
      <span class="text-xs font-medium text-muted-foreground">库存对象</span>
      <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wool-stock-key">
        ${stocks.map((stock) => `
          <option value="${escapeAttr(stock.stockKey)}" ${stock.stockKey === value ? 'selected' : ''}>
            ${escapeHtml(`${stock.woolOrderNo} / ${stock.objectSkuCode} / ${stock.currentQty}${stock.unit}`)}
          </option>
        `).join('')}
      </select>
    </label>
  `
}

function createWoolWaitHandoverCommandId(action: string): string {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `PDA-WOOL-${action}-${suffix}`
}

function ensureWoolWaitHandoverDraft(action: WoolWaitHandoverAction): void {
  const item = getWoolWaitHandoverStocks().find((stock) => stock.currentQty > 0)
    || getWoolWaitHandoverStocks()[0]
  state.woolStockKey ||= item?.stockKey || ''
  state.woolActionQty ||= String(item?.currentQty || 0)
  state.woolActionCommandId ||= createWoolWaitHandoverCommandId(action.toUpperCase())
  if (action === 'transfer' && !state.woolTransferTarget) {
    const target = listFactoryInternalWarehouses()
      .filter((warehouse) => warehouse.isEnabled)
      .flatMap((warehouse) => warehouse.areaList
        .filter((area) => area.status === 'AVAILABLE')
        .flatMap((area) => area.shelfList
          .filter((shelf) => shelf.status === 'AVAILABLE')
          .flatMap((shelf) => shelf.locationList
            .filter((location) => location.status === 'AVAILABLE')
            .map((location) => `${warehouse.warehouseId}|${location.locationId}`))))
      .find(Boolean)
    state.woolTransferTarget = target || ''
  }
}

function renderWoolWaitHandoverActionPage(action: WoolWaitHandoverAction): string {
  ensureWoolWaitHandoverDraft(action)
  const isAdjust = action === 'adjust'
  const targetOptions = listFactoryInternalWarehouses()
    .filter((warehouse) => warehouse.isEnabled)
    .flatMap((warehouse) => warehouse.areaList
      .filter((area) => area.status === 'AVAILABLE')
      .flatMap((area) => area.shelfList
        .filter((shelf) => shelf.status === 'AVAILABLE')
        .flatMap((shelf) => shelf.locationList
          .filter((location) => location.status === 'AVAILABLE')
          .map((location) => {
            const value = `${warehouse.warehouseId}|${location.locationId}`
            return `<option value="${escapeAttr(value)}" ${value === state.woolTransferTarget ? 'selected' : ''}>${escapeHtml(`${warehouse.warehouseName} / ${area.areaName} / ${location.locationName}`)}</option>`
          }))))
    .join('')
  return `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="flex items-start justify-between gap-3">
        <div>
          <div class="text-xl font-semibold leading-tight text-foreground">${escapeHtml(isAdjust ? '库存调整' : '库存转移')}</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">加工填报自动入库、发起交出出库均为只读事实；仓管只处理独立库存修正。</div>
        </div>
        <button type="button" class="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-medium" data-nav="/fcs/pda/warehouse">返回仓管</button>
      </section>
      ${renderWoolWaitHandoverActionCards(action)}
      <section class="space-y-3 rounded-2xl border bg-card px-4 py-4 shadow-sm">
        ${renderWoolWaitHandoverStockSelect(state.woolStockKey)}
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">${isAdjust ? '调整后数量' : '转移数量'}</span>
          <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(state.woolActionQty)}" data-pda-warehouse-field="wool-action-qty" />
        </label>
        ${isAdjust ? '' : `
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-muted-foreground">目标公共库位</span>
            <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wool-transfer-target">${targetOptions}</select>
          </label>
        `}
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">${isAdjust ? '调整原因' : '转移原因'}</span>
          <textarea class="min-h-20 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-warehouse-field="wool-action-reason">${escapeHtml(state.woolActionReason)}</textarea>
        </label>
        <button type="button" class="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="${isAdjust ? 'confirm-wool-adjust' : 'confirm-wool-transfer'}">
          ${escapeHtml(isAdjust ? '确认库存调整' : '确认库存转移')}
        </button>
      </section>
    </div>
  `
}

function renderWoolWaitHandoverPage(): string {
  const params = getMobileWarehouseSearchParams()
  const activeAction = getWoolWaitHandoverAction(params.get('action'))
  if (activeAction) {
    const title = activeAction === 'adjust' ? '毛织库存调整' : '毛织库存转移'
    return renderPdaFrame(renderWoolWaitHandoverActionPage(activeAction), 'warehouse', { headerTitle: title, disableTodoAutoOpen: true })
  }
  const inventory = getWoolWaitHandoverStocks()
  const flows = listWoolWarehouseFlows({ warehouseMode: 'WAIT_HANDOVER' })
    .sort((left, right) => right.operatedAt.localeCompare(left.operatedAt))
  const inboundFlows = flows.filter((flow) => flow.businessType === 'PROCESS_REPORT')
  const outboundFlows = flows.filter((flow) => flow.businessType === 'HANDOVER')
  const pageSize = 6
  const stockTotalPages = Math.max(1, Math.ceil(inventory.length / pageSize))
  const flowTotalPages = Math.max(1, Math.ceil(flows.length / pageSize))
  const stockPage = Math.min(Math.max(Number(params.get('stockPage')) || 1, 1), stockTotalPages)
  const flowPage = Math.min(Math.max(Number(params.get('flowPage')) || 1, 1), flowTotalPages)
  const stockRows = inventory.slice((stockPage - 1) * pageSize, stockPage * pageSize)
  const flowRows = flows.slice((flowPage - 1) * pageSize, flowPage * pageSize)
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="grid grid-cols-2 gap-2">
        <button type="button" class="rounded-2xl border bg-background px-4 py-3 text-sm font-medium" data-nav="/fcs/pda/warehouse/wait-process">待加工仓</button>
        <button type="button" class="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground" data-nav="/fcs/pda/warehouse/wait-handover">待交出仓</button>
      </section>
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <div class="text-base font-semibold">毛织待交出仓</div>
        <div class="mt-1 text-xs text-muted-foreground">加工填报自动入库，发起交出自动出库；这里查看库存和事实流水。</div>
        <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${inventory.length}</div><div class="text-muted-foreground">库存</div></div>
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${inboundFlows.length}</div><div class="text-muted-foreground">加工填报自动入库</div></div>
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${outboundFlows.length}</div><div class="text-muted-foreground">发起交出出库</div></div>
        </div>
      </section>
      ${renderWoolWaitHandoverActionCards()}
      <div class="px-1 text-sm font-semibold">待交出库存</div>
      <section class="space-y-3">
        ${stockRows.map((item) => {
          const order = getWoolWorkOrderById(item.woolOrderId)
          return `
          <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-sm font-semibold">${escapeHtml(item.woolOrderNo)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.objectSkuCode)} · ${escapeHtml(item.objectName)}</div>
              </div>
              ${renderStatusPill(item.completed ? '已完成加工单剩余库存' : item.currentQty > 0 ? '有库存' : '无库存')}
            </div>
            <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <div>生产单：${escapeHtml(item.productionOrderNo)}</div>
              <div>当前库存：${item.currentQty} ${escapeHtml(item.unit)}</div>
              <div>对象类型：${escapeHtml(item.objectType === 'CUT_PIECE' ? '裁片' : '成衣')}</div>
              <div>默认库位：${escapeHtml(item.defaultLocationId)}</div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveTaskRoute(order?.taskId))}">查看任务</button>
            </div>
          </article>
        `}).join('')}
      </section>
      <section class="flex items-center justify-between rounded-xl border bg-card px-3 py-2 text-xs">
        <span>库存第 ${stockPage} / ${stockTotalPages} 页 · 共 ${inventory.length} 条</span>
        <div class="flex gap-2">
          <button type="button" class="rounded-full border px-3 py-1.5 disabled:opacity-40" data-nav="/fcs/pda/warehouse/wait-handover?stockPage=${stockPage - 1}&flowPage=${flowPage}" ${stockPage <= 1 ? 'disabled' : ''}>上一页</button>
          <button type="button" class="rounded-full border px-3 py-1.5 disabled:opacity-40" data-nav="/fcs/pda/warehouse/wait-handover?stockPage=${stockPage + 1}&flowPage=${flowPage}" ${stockPage >= stockTotalPages ? 'disabled' : ''}>下一页</button>
        </div>
      </section>
      <div class="px-1 text-sm font-semibold">库存流水</div>
      <section class="space-y-3">
        ${flowRows.map((flow) => `
          <article class="rounded-2xl border bg-card px-4 py-3 text-xs shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div class="font-semibold">${escapeHtml(flow.objectSkuCode)}</div>
              ${renderStatusPill(
                flow.businessType === 'PROCESS_REPORT'
                  ? '加工填报自动入库'
                  : flow.businessType === 'HANDOVER'
                    ? '发起交出出库'
                    : flow.businessType === 'STOCK_ADJUSTMENT'
                      ? '库存调整'
                      : '库存转移',
              )}
            </div>
            <div class="mt-2 space-y-1 text-muted-foreground">
              <div>数量：${flow.qty} ${escapeHtml(flow.unit)}</div>
              <div>库位：${escapeHtml(flow.defaultLocationId)}</div>
              <div>操作：${escapeHtml(flow.operatedBy)} · ${escapeHtml(flow.operatedAt)}</div>
              ${flow.reason ? `<div>原因：${escapeHtml(flow.reason)}</div>` : ''}
            </div>
          </article>
        `).join('')}
      </section>
      <section class="flex items-center justify-between rounded-xl border bg-card px-3 py-2 text-xs">
        <span>流水第 ${flowPage} / ${flowTotalPages} 页 · 共 ${flows.length} 条</span>
        <div class="flex gap-2">
          <button type="button" class="rounded-full border px-3 py-1.5 disabled:opacity-40" data-nav="/fcs/pda/warehouse/wait-handover?stockPage=${stockPage}&flowPage=${flowPage - 1}" ${flowPage <= 1 ? 'disabled' : ''}>上一页</button>
          <button type="button" class="rounded-full border px-3 py-1.5 disabled:opacity-40" data-nav="/fcs/pda/warehouse/wait-handover?stockPage=${stockPage}&flowPage=${flowPage + 1}" ${flowPage >= flowTotalPages ? 'disabled' : ''}>下一页</button>
        </div>
      </section>
    </div>
  `
  return renderPdaFrame(content, 'warehouse', { headerTitle: '毛织待交出仓', disableTodoAutoOpen: true })
}

export function renderPdaWarehouseWaitHandoverPage(): string {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return renderPdaFrame(renderMobilePageEmptyState('未登录', '请先登录工厂端移动应用。'), 'warehouse', { disableTodoAutoOpen: true })
  if (getMobileWarehouseSearchParams().get('scope') === 'cutting') return renderCuttingWaitHandoverPage()
  if (runtime.factoryId === FULL_CAPABILITY_FACTORY_ID) return renderPostFinishingWaitHandoverPage()
  if (runtime.factoryId === OWN_WOOL_FACTORY_ID) return renderWoolWaitHandoverPage()
  if (isCraftWarehouseRuntime()) return renderAuxiliaryWaitHandoverPage()

  const rows = getRows()
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderWarehouseSummaryHeader('待交出仓', '完工后进入待交出仓，交出记录提交后生成出库记录。', runtime.overview)}
      ${renderSectionFilterChips(state.status, FILTERS, 'wait-handover-status')}
      <section class="space-y-3">
        ${
          rows.length > 0
            ? rows
                .map(
                  (row) => `
                    <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0 flex-1">
                          <div class="text-sm font-semibold text-foreground">${escapeHtml(row.taskNo || row.productionOrderNo || row.stockItemId)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.receiverName || '待确认接收方')} · ${escapeHtml(row.handoverOrderNo || '待交出')}</div>
                        </div>
                        ${renderStatusPill(row.status)}
                      </div>
                      <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
                        <div>物料 / 裁片类型：${escapeHtml(`${row.itemKind} / ${row.itemName}`)}</div>
                        <div>面料 SKU / 裁片部位：${escapeHtml(row.materialSku || row.partName || '-')}</div>
                        <div>颜色 / 尺码：${escapeHtml(row.fabricColor || '-')} / ${escapeHtml(row.sizeCode || '-')}</div>
                        <div>菲票号 / 中转袋号：${escapeHtml(row.feiTicketNo || '-')} / ${escapeHtml(row.transferBagNo || '-')}</div>
                        ${
                          row.feiTicketNo
                            ? (() => {
                                const specialCraftSummary = getSpecialCraftFeiTicketSummary(row.feiTicketNo)
                                return `<div>特殊工艺 / 当前所在：${escapeHtml(specialCraftSummary.operationNames.join(' / ') || '无')} / ${escapeHtml(specialCraftSummary.currentLocation)}</div>
                                        <div>当前特殊工艺 / 已完成特殊工艺：${escapeHtml(specialCraftSummary.currentOperationName)} / ${escapeHtml(specialCraftSummary.completedOperationNames.join(' / ') || '无')}</div>
                                        <div>原裁片数量 / 当前裁片数量：${specialCraftSummary.originalQty} / ${specialCraftSummary.currentQty}</div>
                                        <div>报废裁片数量 / 货损裁片数量：${specialCraftSummary.cumulativeScrapQty} / ${specialCraftSummary.cumulativeDamageQty}</div>
                                        <div>差异状态：${escapeHtml([specialCraftSummary.receiveDifferenceStatus, specialCraftSummary.returnDifferenceStatus].filter((item) => item && item !== '—').join(' / ') || '无')}</div>
                                        <div>发料状态 / 回仓状态：${escapeHtml(specialCraftSummary.dispatchStatus)} / ${escapeHtml(specialCraftSummary.returnStatus)}</div>`
                              })()
                            : ''
                        }
                        <div>卷号：${escapeHtml(row.fabricRollNo || '-')}</div>
                        <div>加工完成对象数量 / 损耗对象数量：${row.completedQty} / ${row.lossQty} ${escapeHtml(row.unit)}</div>
                        <div>待交出数量 / 回写数量：${row.waitHandoverQty} / ${row.receiverWrittenQty ?? '-'} ${escapeHtml(row.unit)}</div>
                        <div>出库记录：${escapeHtml(resolveWarehouseOutboundRecordRoute(row.handoverRecordId).includes('recordId=') ? '已生成' : '未出库')}</div>
                        <div>交出二维码：${escapeHtml(getWarehouseQrDisplayText(getLinkedQrValue(row)))}</div>
                        <div>回写状态：${escapeHtml(getWaitHandoverWritebackStatusLabel(row))}</div>
                        <div>差异 / 异议：${escapeHtml(buildWarehouseDifferenceText(row.differenceQty))}${row.objectionStatus ? ` · ${escapeHtml(row.objectionStatus)}` : ''}</div>
                        <div>库区 / 货架 / 库位：${escapeHtml(row.areaName)} / ${escapeHtml(row.shelfNo)} / ${escapeHtml(row.locationNo)}</div>
                        <div>交出记录：${escapeHtml(row.handoverRecordNo || '待提交')}</div>
                      </div>
                      <div class="mt-4 flex flex-wrap gap-2">
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-handover-detail" data-stock-item-id="${escapeAttr(row.stockItemId)}">查看</button>
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveWaitHandoverRoute(row))}">去交出</button>
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveWarehouseOutboundRecordRoute(row.handoverRecordId))}">查看出库</button>
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveWaitHandoverRoute(row))}">查看交出</button>
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-handover-detail" data-stock-item-id="${escapeAttr(row.stockItemId)}">查看回写</button>
                        ${
                          row.status === '异议中'
                            ? `<button type="button" class="rounded-full border border-destructive/30 px-3 py-1.5 text-xs text-destructive" data-pda-warehouse-action="open-wait-handover-detail" data-stock-item-id="${escapeAttr(row.stockItemId)}">查看异议</button>`
                            : ''
                        }
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-handover-location" data-stock-item-id="${escapeAttr(row.stockItemId)}">调整位置</button>
                      </div>
                    </article>
                  `,
                )
                .join('')
            : renderMobilePageEmptyState('暂无待交出仓记录', '任务完工后，会在待交出仓承接待交出内容。')
        }
      </section>
      ${renderDetailDrawer()}
      ${renderLocationDialog()}
    </div>
  `

  return renderPdaFrame(content, 'warehouse', { headerTitle: '待交出仓', disableTodoAutoOpen: true })
}

export function handlePdaWarehouseWaitHandoverEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pda-warehouse-action]')
  const action = actionNode?.dataset.pdaWarehouseAction
  if (action === 'special-craft-wait-handover-submit') {
    executeSpecialCraftWaitHandoverSubmit({
      stockItemId: actionNode.dataset.stockItemId || '',
      taskOrderId: actionNode.dataset.taskOrderId || '',
      skuCode: actionNode.dataset.skuCode || '',
    })
    return true
  }
  if (action === 'confirm-wool-adjust' || action === 'confirm-wool-transfer') {
    const runtime = getMobileWarehouseRuntimeContext()
    const stock = getWoolWaitHandoverStocks().find((item) => item.stockKey === state.woolStockKey)
    const qty = Number(state.woolActionQty)
    if (runtime?.factoryId !== OWN_WOOL_FACTORY_ID || !stock) {
      window.alert('当前账号或库存已变化，请返回后重新选择。')
      return true
    }
    if (!Number.isFinite(qty) || qty < 0 || !state.woolActionReason.trim()) {
      window.alert('请输入有效数量和原因。')
      return true
    }
    if (action === 'confirm-wool-transfer' && qty <= 0) {
      window.alert('转移数量必须大于 0。')
      return true
    }
    if (!window.confirm(`确认${action === 'confirm-wool-adjust' ? '调整' : '转移'} ${stock.objectSkuCode} ${qty} ${stock.unit}？`)) {
      return true
    }
    try {
      const operatedAt = formatIndonesiaBusinessDateTime()
      if (action === 'confirm-wool-adjust') {
        adjustWoolWarehouseStock({
          commandId: state.woolActionCommandId || createWoolWaitHandoverCommandId('ADJUST'),
          woolOrderId: stock.woolOrderId,
          objectSkuCode: stock.objectSkuCode,
          batchNo: stock.batchNo,
          defaultLocationId: stock.defaultLocationId,
          afterQty: qty,
          reason: state.woolActionReason,
          operatedAt,
          operatedBy: 'PDA 毛织仓管',
        })
      } else {
        const [toWarehouseId = '', toLocationId = ''] = state.woolTransferTarget.split('|')
        transferWoolWarehouseStock({
          commandId: state.woolActionCommandId || createWoolWaitHandoverCommandId('TRANSFER'),
          woolOrderId: stock.woolOrderId,
          objectSkuCode: stock.objectSkuCode,
          batchNo: stock.batchNo,
          defaultLocationId: stock.defaultLocationId,
          fromLocationId: stock.defaultLocationId,
          toWarehouseId,
          toLocationId,
          qty,
          reason: state.woolActionReason,
          operatedAt,
          operatedBy: 'PDA 毛织仓管',
        })
      }
      state.woolStockKey = ''
      state.woolActionQty = ''
      state.woolTransferTarget = ''
      state.woolActionReason = ''
      state.woolActionCommandId = ''
      window.location.href = '/fcs/pda/warehouse/wait-handover'
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '库存操作失败，请叫主管处理。')
    }
    return true
  }
  if (action === 'confirm-auxiliary-finish' || action === 'confirm-auxiliary-handover') {
    const actionKey: AuxiliaryWaitHandoverAction = action === 'confirm-auxiliary-finish' ? 'finish-inbound' : 'handover-confirm'
    const scanValue = actionKey === 'finish-inbound' ? state.auxiliaryFinishScan : state.auxiliaryHandoverScan
    const qtyValue = Number(actionKey === 'finish-inbound' ? state.auxiliaryFinishQty : state.auxiliaryHandoverQty)
    const areaValue = actionKey === 'finish-inbound' ? state.auxiliaryFinishArea : state.auxiliaryHandoverArea
    const locationValue = actionKey === 'finish-inbound' ? state.auxiliaryFinishLocation : state.auxiliaryHandoverLocation
    if (!scanValue.trim()) {
      window.alert('请先扫码或输入单号。')
      return true
    }
    if (!Number.isFinite(qtyValue) || qtyValue <= 0) {
      window.alert('请输入大于 0 的数量。')
      return true
    }
    if (actionKey === 'handover-confirm' && !state.auxiliaryHandoverReceiver.trim()) {
      window.alert('请输入接收方。')
      return true
    }
    if (!areaValue || !locationValue) {
      window.alert('请选择库区库位。')
      return true
    }
    const actionLabel = actionKey === 'finish-inbound' ? '完工入仓' : '交出确认'
    window.alert(`${actionLabel}已记录为演示数据。`)
    window.location.href = '/fcs/pda/warehouse/wait-handover'
    return true
  }
  if (action === 'open-wait-handover-detail' && actionNode.dataset.stockItemId) {
    state.detailId = actionNode.dataset.stockItemId
    return true
  }
  if (action === 'close-wait-handover-detail') {
    state.detailId = null
    return true
  }
  if (action === 'open-wait-handover-location' && actionNode.dataset.stockItemId) {
    openLocationEditor(actionNode.dataset.stockItemId)
    return true
  }
  if (action === 'close-wait-handover-location') {
    state.locationEditId = null
    return true
  }
  if (action === 'save-wait-handover-location' && state.locationEditId) {
    updateWaitHandoverStockLocation(state.locationEditId, {
      areaName: state.areaName,
      shelfNo: state.shelfNo,
      locationNo: state.locationNo,
      remark: state.remark,
    })
    state.locationEditId = null
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-pda-warehouse-field]')
  const field = fieldNode?.dataset.pdaWarehouseField
  const value =
    fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement || fieldNode instanceof HTMLTextAreaElement
      ? fieldNode.value
      : fieldNode?.dataset.value || ''
  if (field === 'wait-handover-status') {
    state.status = value as WaitHandoverFilter
    return true
  }
  if (field === 'wait-handover-area') {
    state.areaName = value
    state.shelfNo = ''
    state.locationNo = ''
    return true
  }
  if (field === 'wait-handover-shelf') {
    state.shelfNo = value
    state.locationNo = ''
    return true
  }
  if (field === 'wait-handover-location') {
    state.locationNo = value
    return true
  }
  if (field === 'wait-handover-remark') {
    state.remark = value
    return true
  }
  if (field === 'wool-stock-key') {
    state.woolStockKey = value
    const stock = getWoolWaitHandoverStocks().find((item) => item.stockKey === value)
    if (stock) state.woolActionQty = String(stock.currentQty)
    return true
  }
  if (field === 'wool-action-qty') {
    state.woolActionQty = value
    return true
  }
  if (field === 'wool-transfer-target') {
    state.woolTransferTarget = value
    return true
  }
  if (field === 'wool-action-reason') {
    state.woolActionReason = value
    return true
  }
  if (field === 'auxiliary-finish-scan') {
    state.auxiliaryFinishScan = value
    return true
  }
  if (field === 'auxiliary-finish-qty') {
    state.auxiliaryFinishQty = value
    return true
  }
  if (field === 'auxiliary-finish-loss-qty') {
    state.auxiliaryFinishLossQty = value
    return true
  }
  if (field === 'auxiliary-finish-area') {
    updateAuxiliaryWaitHandoverArea('finish-inbound', value)
    return true
  }
  if (field === 'auxiliary-finish-shelf') {
    updateAuxiliaryWaitHandoverShelf('finish-inbound', value)
    return true
  }
  if (field === 'auxiliary-finish-location') {
    updateAuxiliaryWaitHandoverLocation('finish-inbound', value)
    return true
  }
  if (field === 'auxiliary-handover-scan') {
    state.auxiliaryHandoverScan = value
    return true
  }
  if (field === 'auxiliary-handover-qty') {
    state.auxiliaryHandoverQty = value
    return true
  }
  if (field === 'auxiliary-handover-receiver') {
    state.auxiliaryHandoverReceiver = value
    return true
  }
  if (field === 'auxiliary-handover-area') {
    updateAuxiliaryWaitHandoverArea('handover-confirm', value)
    return true
  }
  if (field === 'auxiliary-handover-shelf') {
    updateAuxiliaryWaitHandoverShelf('handover-confirm', value)
    return true
  }
  if (field === 'auxiliary-handover-location') {
    updateAuxiliaryWaitHandoverLocation('handover-confirm', value)
    return true
  }
  return false
}
