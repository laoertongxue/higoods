import {
  listFactoryWaitProcessStockItems,
  type FactoryWaitProcessStockItem,
  updateWaitProcessStockLocation,
} from '../data/fcs/factory-internal-warehouse.ts'
import { getFactoryMasterRecordById } from '../data/fcs/factory-master-store.ts'
import { OWN_WOOL_FACTORY_ID } from '../data/fcs/factory-mock-data.ts'
import {
  listAuxiliaryCraftTaskOrders,
  listSpecialTypeCraftTaskOrders,
} from '../data/fcs/special-craft-task-orders.ts'
import type { PostFinishingWaitProcessWarehouseRecord } from '../data/fcs/post-finishing-domain.ts'
import {
  FULL_CAPABILITY_FACTORY_ID,
  listPostFinishingWaitProcessWarehouseRecords,
} from '../data/fcs/post-finishing-domain.ts'
import {
  completeWoolPickupHead,
  confirmWoolWaitProcessScanReceipt,
  getWoolWorkOrderById,
  getWoolYarnUsageSummary,
  listWoolWaitProcessScanReceipts,
  listWoolWaitProcessReceiptRecords,
  listWoolWaitProcessUsageRecords,
  listWoolWorkOrders,
  listWoolWarehouseInventory,
  listWoolWarehouseLocations,
  recoverWoolYarnToWaitProcessWarehouse,
  scheduleWoolMachines,
  updateWoolWorkOrderNodeStatus,
} from '../data/fcs/wool-task-domain.ts'
import {
  listMaterialLedgerProjections,
  type MaterialLedgerProjection,
} from '../data/fcs/cutting/material-ledger.ts'
import {
  getMaterialPrepRecordContext,
  listPdaTransferPickupCandidates,
} from '../data/fcs/cutting/production-material-prep.ts'
import { buildMarkerSpreadingProjection } from './process-factory/cutting/marker-spreading-projection.ts'
import type { SpreadingOrder } from './process-factory/cutting/marker-spreading-model.ts'
import {
  appendCuttingRuntimeEvent,
  listCuttingRuntimeEventsByInventoryScope,
  listCuttingRuntimeEventsByType,
  type CuttingRuntimeEvent,
  type CuttingRuntimeQtyUnit,
  type RuntimeInventoryEffect,
  type RuntimeMaterialSnapshot,
  type RuntimePatternSnapshot,
} from '../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { renderPdaFrame } from './pda-shell'
import {
  buildWarehouseDifferenceText,
  escapeAttr,
  formatWarehouseDateTime,
  getCurrentFactoryWarehouseByKind,
  getWaitProcessSourceActionLabel,
  getWaitProcessSourceStatusLabel,
  getMobileWarehouseSearchParams,
  getMobileWarehouseRuntimeContext,
  getWarehousePositionOptions,
  renderCompactFieldList,
  renderMobilePageEmptyState,
  renderSectionFilterChips,
  renderStatusPill,
  renderWarehouseSummaryHeader,
  resolveTaskRoute,
  resolveWaitProcessSourceRoute,
  resolveWarehouseInboundRecordRoute,
} from './pda-warehouse-shared'
import { getSpecialCraftFeiTicketSummary } from '../data/fcs/cutting/special-craft-fei-ticket-flow.ts'

type WaitProcessFilter = '全部' | '待领料' | '已入待加工仓' | '差异待处理'

interface WaitProcessState {
  status: WaitProcessFilter
  detailId: string | null
  locationEditId: string | null
  areaName: string
  shelfNo: string
  locationNo: string
  remark: string
  cuttingPickupSourceNo: string
  cuttingPickupPrepRecordId: string
  cuttingPickupPrepLineId: string
  cuttingPickupWarehouseArea: string
  cuttingPickupLocationCode: string
  cuttingPickupQty: string
  cuttingPickupRollCount: string
  cuttingIssueSourceNo: string
  cuttingIssueWarehouseArea: string
  cuttingIssueLocationCode: string
  cuttingIssueQty: string
  cuttingIssueRollCount: string
  cuttingReturnSourceNo: string
  cuttingReturnRelatedDocNo: string
  cuttingReturnWarehouseArea: string
  cuttingReturnLocationCode: string
  cuttingReturnQty: string
  cuttingReturnRollCount: string
  auxiliaryReceiveScan: string
  auxiliaryReceiveQty: string
  auxiliaryReceiveArea: string
  auxiliaryReceiveShelf: string
  auxiliaryReceiveLocation: string
  auxiliaryIssueScan: string
  auxiliaryIssueQty: string
  auxiliaryIssueArea: string
  auxiliaryIssueShelf: string
  auxiliaryIssueLocation: string
  auxiliaryReturnScan: string
  auxiliaryReturnQty: string
  auxiliaryReturnArea: string
  auxiliaryReturnShelf: string
  auxiliaryReturnLocation: string
  woolReturnSourceOrderId: string
  woolReturnSelectedOrderId: string
  woolReturnQty: string
  woolReceiveScan: string
  woolReceiveQty: string
  woolReceiveLocationId: string
  woolIssueOrderId: string
  woolIssueQty: string
  woolIssueLocationId: string
  woolReturnLocationId: string
}

const state: WaitProcessState = {
  status: '全部',
  detailId: null,
  locationEditId: null,
  areaName: '',
  shelfNo: '',
  locationNo: '',
  remark: '',
  cuttingPickupSourceNo: '',
  cuttingPickupPrepRecordId: '',
  cuttingPickupPrepLineId: '',
  cuttingPickupWarehouseArea: '',
  cuttingPickupLocationCode: '',
  cuttingPickupQty: '',
  cuttingPickupRollCount: '',
  cuttingIssueSourceNo: '',
  cuttingIssueWarehouseArea: '',
  cuttingIssueLocationCode: '',
  cuttingIssueQty: '',
  cuttingIssueRollCount: '',
  cuttingReturnSourceNo: '',
  cuttingReturnRelatedDocNo: '',
  cuttingReturnWarehouseArea: '',
  cuttingReturnLocationCode: '',
  cuttingReturnQty: '',
  cuttingReturnRollCount: '',
  auxiliaryReceiveScan: '',
  auxiliaryReceiveQty: '',
  auxiliaryReceiveArea: '',
  auxiliaryReceiveShelf: '',
  auxiliaryReceiveLocation: '',
  auxiliaryIssueScan: '',
  auxiliaryIssueQty: '',
  auxiliaryIssueArea: '',
  auxiliaryIssueShelf: '',
  auxiliaryIssueLocation: '',
  auxiliaryReturnScan: '',
  auxiliaryReturnQty: '',
  auxiliaryReturnArea: '',
  auxiliaryReturnShelf: '',
  auxiliaryReturnLocation: '',
  woolReturnSourceOrderId: '',
  woolReturnSelectedOrderId: '',
  woolReturnQty: '',
  woolReceiveScan: '',
  woolReceiveQty: '',
  woolReceiveLocationId: '',
  woolIssueOrderId: '',
  woolIssueQty: '',
  woolIssueLocationId: '',
  woolReturnLocationId: '',
}

const FILTERS: Array<{ value: WaitProcessFilter; label: string }> = [
  { value: '全部', label: '全部' },
  { value: '待领料', label: '中转仓领料' },
  { value: '已入待加工仓', label: '已入待加工仓' },
  { value: '差异待处理', label: '差异待处理' },
]

const CUTTING_RECEIVE_LOCATIONS = [
  { area: '面料 A 区', locations: ['FAB-A-01', 'FAB-A-02', 'FAB-A-03'] },
  { area: '面料 B 区', locations: ['FAB-B-01', 'FAB-B-02', 'FAB-B-03'] },
  { area: '辅料暂存区', locations: ['ACC-TEMP-01', 'ACC-TEMP-02'] },
  { area: '纱线暂存区', locations: ['YRN-TEMP-01', 'YRN-TEMP-02'] },
  { area: '包材暂存区', locations: ['PKG-TEMP-01', 'PKG-TEMP-02'] },
  { area: '临时收货区', locations: ['TEMP-01', 'TEMP-02'] },
]

function resolveCuttingReceiveLocationByMaterial(materialType?: string) {
  if (materialType === '辅料') return CUTTING_RECEIVE_LOCATIONS.find((item) => item.area === '辅料暂存区') || CUTTING_RECEIVE_LOCATIONS[0]
  if (materialType === '纱线') return CUTTING_RECEIVE_LOCATIONS.find((item) => item.area === '纱线暂存区') || CUTTING_RECEIVE_LOCATIONS[0]
  if (materialType === '包材') return CUTTING_RECEIVE_LOCATIONS.find((item) => item.area === '包材暂存区') || CUTTING_RECEIVE_LOCATIONS[0]
  return CUTTING_RECEIVE_LOCATIONS[0]
}

type AuxiliaryWaitProcessAction = 'receive' | 'issue' | 'return'
type WoolWaitProcessAction = 'receive' | 'issue' | 'return'

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

function getAuxiliaryWaitProcessRows(ignoreStatus = false): FactoryWaitProcessStockItem[] {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return []
  ensureCraftWarehouseMockData()
  return listFactoryWaitProcessStockItems()
    .filter((item) => item.factoryId === runtime.factoryId && Boolean(item.craftName))
    .filter((item) => (ignoreStatus || state.status === '全部' ? true : item.status === state.status))
}

function getAuxiliaryWaitProcessAction(value?: string | null): AuxiliaryWaitProcessAction | null {
  return value === 'receive' || value === 'issue' || value === 'return' ? value : null
}

function getAuxiliaryWaitProcessSample(): FactoryWaitProcessStockItem | undefined {
  return getAuxiliaryWaitProcessRows(true)[0]
}

function ensureAuxiliaryWaitProcessDraft(action: AuxiliaryWaitProcessAction): FactoryWaitProcessStockItem | undefined {
  const sample = getAuxiliaryWaitProcessSample()
  if (!sample) return undefined
  if (action === 'receive') {
    state.auxiliaryReceiveScan ||= sample.sourceRecordNo
    state.auxiliaryReceiveQty ||= String(sample.receivedQty)
    state.auxiliaryReceiveArea ||= sample.areaName
    state.auxiliaryReceiveShelf ||= sample.shelfNo
    state.auxiliaryReceiveLocation ||= sample.locationNo
  }
  if (action === 'issue') {
    state.auxiliaryIssueScan ||= sample.sourceRecordNo
    state.auxiliaryIssueQty ||= String(Math.max(sample.receivedQty - Math.abs(sample.differenceQty || 0), 1))
    state.auxiliaryIssueArea ||= sample.areaName
    state.auxiliaryIssueShelf ||= sample.shelfNo
    state.auxiliaryIssueLocation ||= sample.locationNo
  }
  if (action === 'return') {
    state.auxiliaryReturnScan ||= sample.taskNo || sample.sourceRecordNo
    state.auxiliaryReturnQty ||= String(Math.abs(sample.differenceQty || 0) || Math.max(Math.round(sample.receivedQty * 0.06), 1))
    state.auxiliaryReturnArea ||= sample.areaName
    state.auxiliaryReturnShelf ||= sample.shelfNo
    state.auxiliaryReturnLocation ||= sample.locationNo
  }
  return sample
}

function renderAuxiliaryWaitProcessActionCards(activeAction?: AuxiliaryWaitProcessAction | null): string {
  const actions: Array<{ key: AuxiliaryWaitProcessAction; title: string; desc: string }> = [
    { key: 'receive', title: '接收入仓', desc: '扫交接单或加工单，确认数量和库位。' },
    { key: 'issue', title: '加工领料', desc: '从待加工仓领出给工序使用。' },
    { key: 'return', title: '回收入仓', desc: '未加工完或退回物回到库位。' },
  ]
  return `
    <section class="grid grid-cols-2 gap-2">
      ${actions.map((item) => `
        <button
          type="button"
          class="rounded-2xl border px-4 py-4 text-left shadow-sm ${activeAction === item.key ? 'border-primary bg-primary/5' : 'bg-card'}"
          data-nav="/fcs/pda/warehouse/wait-process?action=${escapeAttr(item.key)}"
        >
          <div class="text-sm font-semibold text-foreground">${escapeHtml(item.title)}</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">${escapeHtml(item.desc)}</div>
        </button>
      `).join('')}
    </section>
  `
}

function renderAuxiliaryWaitProcessPositionFields(action: AuxiliaryWaitProcessAction): string {
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_PROCESS')
  if (!warehouse) return ''
  const options = getWarehousePositionOptions(warehouse.warehouseId)
  const areaValue = action === 'receive'
    ? state.auxiliaryReceiveArea
    : action === 'issue'
      ? state.auxiliaryIssueArea
      : state.auxiliaryReturnArea
  const shelfValue = action === 'receive'
    ? state.auxiliaryReceiveShelf
    : action === 'issue'
      ? state.auxiliaryIssueShelf
      : state.auxiliaryReturnShelf
  const locationValue = action === 'receive'
    ? state.auxiliaryReceiveLocation
    : action === 'issue'
      ? state.auxiliaryIssueLocation
      : state.auxiliaryReturnLocation
  const fieldPrefix = `auxiliary-${action}`
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

function updateAuxiliaryWaitProcessArea(action: AuxiliaryWaitProcessAction, value: string): void {
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_PROCESS')
  const options = warehouse ? getWarehousePositionOptions(warehouse.warehouseId) : null
  const nextShelf = options?.shelfOptionsByArea[value]?.[0]?.value || ''
  const nextLocation = options?.locationOptionsByShelf[nextShelf]?.[0]?.value || ''
  if (action === 'receive') {
    state.auxiliaryReceiveArea = value
    state.auxiliaryReceiveShelf = nextShelf
    state.auxiliaryReceiveLocation = nextLocation
  } else if (action === 'issue') {
    state.auxiliaryIssueArea = value
    state.auxiliaryIssueShelf = nextShelf
    state.auxiliaryIssueLocation = nextLocation
  } else {
    state.auxiliaryReturnArea = value
    state.auxiliaryReturnShelf = nextShelf
    state.auxiliaryReturnLocation = nextLocation
  }
}

function updateAuxiliaryWaitProcessShelf(action: AuxiliaryWaitProcessAction, value: string): void {
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_PROCESS')
  const options = warehouse ? getWarehousePositionOptions(warehouse.warehouseId) : null
  const nextLocation = options?.locationOptionsByShelf[value]?.[0]?.value || ''
  if (action === 'receive') {
    state.auxiliaryReceiveShelf = value
    state.auxiliaryReceiveLocation = nextLocation
  } else if (action === 'issue') {
    state.auxiliaryIssueShelf = value
    state.auxiliaryIssueLocation = nextLocation
  } else {
    state.auxiliaryReturnShelf = value
    state.auxiliaryReturnLocation = nextLocation
  }
}

function updateAuxiliaryWaitProcessLocation(action: AuxiliaryWaitProcessAction, value: string): void {
  if (action === 'receive') state.auxiliaryReceiveLocation = value
  else if (action === 'issue') state.auxiliaryIssueLocation = value
  else state.auxiliaryReturnLocation = value
}

function renderAuxiliaryWaitProcessActionPage(action: AuxiliaryWaitProcessAction): string {
  const sample = ensureAuxiliaryWaitProcessDraft(action)
  const runtimeLabel = getCraftWarehouseRuntimeLabel() || '工艺'
  const title = action === 'receive' ? '接收入仓' : action === 'issue' ? '加工领料' : '回收入仓'
  const scanValue = action === 'receive'
    ? state.auxiliaryReceiveScan
    : action === 'issue'
      ? state.auxiliaryIssueScan
      : state.auxiliaryReturnScan
  const qtyValue = action === 'receive'
    ? state.auxiliaryReceiveQty
    : action === 'issue'
      ? state.auxiliaryIssueQty
      : state.auxiliaryReturnQty
  const scanLabel = action === 'receive' ? '交接单 / 加工单' : action === 'issue' ? '库存记录 / 加工单' : '回收来源'
  const qtyLabel = action === 'receive' ? '接收数量' : action === 'issue' ? '领料数量' : '回收数量'
  return `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="flex items-start justify-between gap-3">
        <div>
          <div class="text-xl font-semibold leading-tight text-foreground">${escapeHtml(title)}</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">${escapeHtml(sample ? `${sample.craftName || runtimeLabel} · ${sample.itemName}` : '暂无可用演示记录')}</div>
        </div>
        <button type="button" class="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-medium" data-nav="/fcs/pda/warehouse">返回仓管</button>
      </section>
      ${renderAuxiliaryWaitProcessActionCards(action)}
      <section class="space-y-3 rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">${escapeHtml(scanLabel)}</span>
          <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" value="${escapeAttr(scanValue)}" placeholder="扫码或输入单号" data-pda-warehouse-field="auxiliary-${action}-scan" />
        </label>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">${escapeHtml(qtyLabel)}（${escapeHtml(sample?.unit || '件')}）</span>
          <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(qtyValue)}" data-pda-warehouse-field="auxiliary-${action}-qty" />
        </label>
        ${renderAuxiliaryWaitProcessPositionFields(action)}
        <button type="button" class="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="confirm-auxiliary-${action}">
          确认${escapeHtml(title)}
        </button>
      </section>
    </div>
  `
}

function renderAuxiliaryWaitProcessPage(): string {
  const activeAction = getAuxiliaryWaitProcessAction(getMobileWarehouseSearchParams().get('action'))
  if (activeAction) {
    const title = activeAction === 'receive' ? '接收入仓' : activeAction === 'issue' ? '加工领料' : '回收入仓'
    return renderPdaFrame(renderAuxiliaryWaitProcessActionPage(activeAction), 'warehouse', { headerTitle: title, disableTodoAutoOpen: true })
  }
  const runtime = getMobileWarehouseRuntimeContext()
  const runtimeLabel = getCraftWarehouseRuntimeLabel() || '工艺'
  const rows = getAuxiliaryWaitProcessRows()
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${runtime ? renderWarehouseSummaryHeader(`${runtimeLabel}待加工仓`, '接收入仓后进入待加工仓，加工领料扣减，退回物走回收入仓。', runtime.overview) : ''}
      ${renderAuxiliaryWaitProcessActionCards()}
      ${renderSectionFilterChips(state.status, FILTERS, 'wait-process-status')}
      <section class="space-y-3">
        ${
          rows.length > 0
            ? rows.map((row) => `
              <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-semibold text-foreground">${escapeHtml(row.sourceRecordNo)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.craftName || runtimeLabel)} · ${escapeHtml(row.taskNo || row.productionOrderNo || '-')}</div>
                  </div>
                  ${renderStatusPill(row.status)}
                </div>
                <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <div>库存对象：${escapeHtml(row.itemName)} / ${escapeHtml(row.materialSku || row.partName || '-')}</div>
                  <div>生产单：${escapeHtml(row.productionOrderNo || '-')}</div>
                  <div>菲票 / 中转袋：${escapeHtml(row.feiTicketNo || '-')} / ${escapeHtml(row.transferBagNo || '-')}</div>
                  <div>应收 / 实收：${row.expectedQty} / ${row.receivedQty} ${escapeHtml(row.unit)}</div>
                  <div>差异：${escapeHtml(buildWarehouseDifferenceText(row.differenceQty))}</div>
                  <div>库区 / 货架 / 库位：${escapeHtml(row.areaName)} / ${escapeHtml(row.shelfNo)} / ${escapeHtml(row.locationNo)}</div>
                  <div>接收时间：${escapeHtml(formatWarehouseDateTime(row.receivedAt))}</div>
                </div>
                <div class="mt-4 flex flex-wrap gap-2">
                  <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-process-detail" data-stock-item-id="${escapeAttr(row.stockItemId)}">查看</button>
                  <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="/fcs/pda/warehouse/wait-process?action=issue">加工领料</button>
                  <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="/fcs/pda/warehouse/wait-process?action=return">回收入仓</button>
                  <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-process-location" data-stock-item-id="${escapeAttr(row.stockItemId)}">调整位置</button>
                </div>
              </article>
            `).join('')
            : renderMobilePageEmptyState(`暂无${runtimeLabel}待加工仓记录`, '接收入仓后会形成待加工仓库存。')
        }
      </section>
      ${renderDetailDrawer()}
      ${renderLocationDialog()}
    </div>
  `
  return renderPdaFrame(content, 'warehouse', { headerTitle: `${runtimeLabel}待加工仓`, disableTodoAutoOpen: true })
}

function formatCuttingWaitProcessQty(qty: number, unit = 'yard'): string {
  const rollCount = qty <= 0 ? 0 : Math.max(Math.ceil(qty / 280), 1)
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(qty)} ${unit} / ${rollCount} 卷`
}

function normalizeCuttingRuntimeQtyUnit(unit: string | undefined): CuttingRuntimeQtyUnit {
  return unit === '片' || unit === '件' ? unit : 'yard'
}

function getCuttingRuntimeNowText(): string {
  return new Date().toISOString().slice(0, 16).replace('T', ' ')
}

function parseCuttingQtyAndRoll(rawValue: string | null | undefined, fallbackQty = 0): { qty: number; rollCount: number; displayText: string } {
  const text = (rawValue || '').trim()
  const numberMatches = text.match(/\d+(?:\.\d+)?/g) || []
  const qty = Number(numberMatches[0] || fallbackQty)
  const rollCount = Math.max(Number(numberMatches[1] || 1), qty > 0 ? 1 : 0)
  return {
    qty: Number.isFinite(qty) ? qty : fallbackQty,
    rollCount: Number.isFinite(rollCount) ? rollCount : 1,
    displayText: text || formatCuttingWaitProcessQty(fallbackQty),
  }
}

function splitCuttingLocationText(rawValue: string | null | undefined): { warehouseArea: string; locationCode: string } {
  const text = (rawValue || '').trim()
  const [area, location] = text.split('/').map((item) => item.trim())
  return {
    warehouseArea: area || '面料 A 区',
    locationCode: location || 'FAB-A-01',
  }
}

function findCuttingWaitProcessLedgerRow(sourceNo: string | undefined): MaterialLedgerProjection | undefined {
  const keyword = (sourceNo || '').trim().toLowerCase()
  if (!keyword) return undefined
  return listMaterialLedgerProjections().find((row) => {
    const candidates = [
      row.cutOrderNo,
      row.productionOrderNo,
      row.materialIdentity.materialSku,
      row.materialIdentity.materialName,
      row.materialIdentity.materialColor,
      row.patternIdentity.patternFileId,
      row.patternIdentity.patternFileName,
    ].map((item) => String(item || '').toLowerCase())
    return candidates.some((item) => item && (item === keyword || item.includes(keyword) || keyword.includes(item)))
  })
}

function runtimeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function runtimeString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function runtimeNumber(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function listCuttingWaitProcessRuntimeEvents(): CuttingRuntimeEvent[] {
  const events = [
    ...listCuttingRuntimeEventsByType('中转仓领料'),
    ...listCuttingRuntimeEventsByInventoryScope('裁床待加工仓'),
  ]
  const seen = new Set<string>()
  return events
    .filter((event) => {
      if (!event.eventId || seen.has(event.eventId)) return false
      seen.add(event.eventId)
      return true
    })
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt, 'zh-CN'))
}

function isCuttingRuntimeEventForLedgerRow(event: CuttingRuntimeEvent, row: MaterialLedgerProjection): boolean {
  const payload = runtimeRecord(event.payload)
  const candidates = [
    event.refs.cutOrderNo,
    event.refs.productionOrderNo,
    event.refs.spreadingOrderNo,
    event.material?.materialSku,
    event.material?.materialName,
    runtimeString(payload.materialSku),
    runtimeString(payload.prepOrderNo),
    runtimeString(payload.spreadingOrderNo),
  ].map((item) => String(item || '').toLowerCase())
  const rowKeys = [
    row.cutOrderNo,
    row.productionOrderNo,
    row.materialIdentity.materialSku,
    row.materialIdentity.materialName,
    row.patternIdentity.patternFileId,
    row.patternIdentity.patternFileName,
  ].map((item) => String(item || '').toLowerCase())
  return rowKeys.some((rowKey) => rowKey && candidates.some((candidate) => candidate && (candidate === rowKey || candidate.includes(rowKey) || rowKey.includes(candidate))))
}

function getCuttingRuntimeEventQty(event: CuttingRuntimeEvent): number {
  const payload = runtimeRecord(event.payload)
  return (
    runtimeNumber(event.inventoryEffect?.qty) ||
    runtimeNumber(payload.pickupQty) ||
    runtimeNumber(payload.receivedQty) ||
    runtimeNumber(payload.issuedQty) ||
    runtimeNumber(payload.returnedQty)
  )
}

function getCuttingRuntimeEventRollCount(event: CuttingRuntimeEvent): number {
  const payload = runtimeRecord(event.payload)
  const qty = getCuttingRuntimeEventQty(event)
  return runtimeNumber(event.inventoryEffect?.rollCount) || runtimeNumber(payload.rollCount) || (qty > 0 ? Math.max(Math.ceil(qty / 280), 1) : 0)
}

function getCuttingRuntimeEventSourceText(event: CuttingRuntimeEvent): string {
  const payload = runtimeRecord(event.payload)
  if (event.eventType === '中转仓领料') return `中转仓领料：${runtimeString(payload.pickupRecordNo) || event.refs.cutOrderNo || event.eventNo}`
  if (event.eventType === '待加工仓扫码入仓') return `中转仓领料入库：${runtimeString(payload.inboundRecordNo) || event.refs.cutOrderNo || event.eventNo}`
  if (event.eventType === '待加工仓加工领料') return `加工领料：${runtimeString(payload.issueRecordNo) || event.refs.spreadingOrderNo || event.eventNo}`
  if (event.eventType === '待加工仓回收入仓') return `回收入仓：${runtimeString(payload.returnRecordNo) || event.refs.spreadingOrderNo || event.eventNo}`
  return event.eventType
}

function getCuttingRuntimeEventLocationLabel(event: CuttingRuntimeEvent): string {
  const payload = runtimeRecord(event.payload)
  const area =
    event.inventoryEffect?.toWarehouseArea ||
    event.inventoryEffect?.fromWarehouseArea ||
    runtimeString(payload.warehouseArea) ||
    runtimeString(payload.fromWarehouseArea)
  const location =
    event.inventoryEffect?.toLocationCode ||
    event.inventoryEffect?.fromLocationCode ||
    runtimeString(payload.locationCode) ||
    runtimeString(payload.fromLocationCode)
  return area || location ? `${area || '待补库区'} / ${location || '待补库位'}` : '待扫码确认'
}

function findLatestCuttingRuntimeEvent(
  row: MaterialLedgerProjection,
  predicate?: (event: CuttingRuntimeEvent) => boolean,
): CuttingRuntimeEvent | undefined {
  return listCuttingWaitProcessRuntimeEvents()
    .filter((event) => isCuttingRuntimeEventForLedgerRow(event, row))
    .find((event) => (predicate ? predicate(event) : true))
}

function getCuttingWaitProcessLocationLabel(row: MaterialLedgerProjection): string {
  const latestInbound = findLatestCuttingRuntimeEvent(
    row,
    (event) => event.eventType === '待加工仓扫码入仓' || event.eventType === '待加工仓回收入仓',
  )
  if (latestInbound) return getCuttingRuntimeEventLocationLabel(latestInbound)
  const latestIssue = findLatestCuttingRuntimeEvent(row, (event) => event.eventType === '待加工仓加工领料')
  if (latestIssue && row.availableQty <= 0) return '已领出加工'
  return '待入仓确认'
}

function getCuttingWaitProcessLatestSourceText(row: MaterialLedgerProjection): string {
  const latestEvent = findLatestCuttingRuntimeEvent(row)
  if (latestEvent) {
    const qty = getCuttingRuntimeEventQty(latestEvent)
    const rollCount = getCuttingRuntimeEventRollCount(latestEvent)
    return `${getCuttingRuntimeEventSourceText(latestEvent)} · ${qty} ${latestEvent.inventoryEffect?.unit || normalizeCuttingRuntimeQtyUnit(row.unit)} / ${rollCount} 卷 · ${latestEvent.occurredAt}`
  }
  return row.latestClaimEvent
    ? `领料记录：${row.latestClaimEvent.occurredAt} / ${row.latestClaimEvent.operatorName}`
    : '暂无流水'
}

function buildCuttingRuntimeMaterialSnapshot(row: MaterialLedgerProjection | undefined, fallbackSku = ''): RuntimeMaterialSnapshot | undefined {
  if (!row && !fallbackSku) return undefined
  return {
    materialSku: row?.materialIdentity.materialSku || fallbackSku,
    materialName: row?.materialIdentity.materialName || fallbackSku,
    materialColor: row?.materialIdentity.materialColor || '',
    materialAlias: row?.materialIdentity.materialAlias || '',
    unit: normalizeCuttingRuntimeQtyUnit(row?.unit),
  }
}

function buildCuttingRuntimePatternSnapshot(row: MaterialLedgerProjection | undefined): RuntimePatternSnapshot | undefined {
  if (!row) return undefined
  return {
    patternFileId: row.patternIdentity.patternFileId,
    patternFileName: row.patternIdentity.patternFileName,
    patternVersion: row.patternIdentity.patternVersion,
    effectiveWidth: `${row.patternIdentity.effectiveWidthValue}${row.patternIdentity.effectiveWidthUnit}`,
    partNames: row.patternIdentity.piecePartNames,
  }
}

function buildCuttingRuntimeRefs(row: MaterialLedgerProjection | undefined, sourceNo: string) {
  const isSpreadingOrder = /^PB-|铺布/i.test(sourceNo)
  return {
    productionOrderId: row?.productionOrderId || '',
    productionOrderNo: row?.productionOrderNo || '',
    cutOrderId: row?.cutOrderId || '',
    cutOrderNo: row?.cutOrderNo || (isSpreadingOrder ? '' : sourceNo),
    spreadingOrderNo: isSpreadingOrder ? sourceNo : '',
  }
}

function buildCuttingRollNos(sourceNo: string, rollCount: number): string[] {
  return Array.from({ length: Math.max(Math.round(rollCount), 1) }, (_, index) => `${sourceNo || 'ROLL'}-${String(index + 1).padStart(2, '0')}`)
}

function listCuttingPendingPickupRows(rows: MaterialLedgerProjection[]): MaterialLedgerProjection[] {
  const pickedCutOrders = new Set(
    listCuttingRuntimeEventsByType('中转仓领料')
      .map((event) => event.refs.cutOrderNo)
      .filter(Boolean),
  )
  return rows
    .filter((row) => row.transferWarehouseAllocatedQty > 0)
    .filter((row) => !pickedCutOrders.has(row.cutOrderNo))
}

function renderCuttingPendingPickupList(rows: MaterialLedgerProjection[]): string {
  const pendingCandidates = listPdaTransferPickupCandidates()
  const pendingRows = listCuttingPendingPickupRows(rows)
  return `
    <section class="space-y-2">
      <div class="space-y-2">
        ${pendingCandidates.length
          ? pendingCandidates.map((candidate) => `
              <button
                type="button"
                class="w-full rounded-2xl border bg-card px-4 py-4 text-left shadow-sm"
                data-pda-warehouse-action="cutting-wp-pickup"
                data-source-no="${escapeAttr(candidate.defaultCutOrderNo)}"
                data-prep-record-id="${escapeAttr(candidate.prepRecordId)}"
                data-prep-line-id="${escapeAttr(candidate.defaultPrepLineId)}"
              >
                <div class="text-xs font-medium text-muted-foreground">配料记录待领料通知</div>
                <div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(candidate.batchNo)} / ${escapeHtml(candidate.prepOrderNo)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(candidate.productionOrderNo)} / ${escapeHtml(candidate.styleNo)} ${escapeHtml(candidate.styleName)}</div>
                <div class="mt-1 text-xs text-muted-foreground">明细：${candidate.materialCount} 项，来源仓库：${escapeHtml(candidate.warehouseNames.join('、'))}</div>
                <div class="mt-2 space-y-1">
                  ${candidate.items.slice(0, 3).map((item) => `
                    <div class="rounded-lg bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                      ${escapeHtml(item.materialSku)} / ${escapeHtml(item.stockWarehouseName)} / 可领 ${escapeHtml(formatCuttingWaitProcessQty(item.availableToPickupQty, item.unit))}
                    </div>
                  `).join('')}
                </div>
              </button>
            `).join('')
          : pendingRows.length
            ? pendingRows.map((row) => `
              <button
                type="button"
                class="w-full rounded-2xl border bg-card px-4 py-4 text-left shadow-sm"
                data-pda-warehouse-action="cutting-wp-pickup"
                data-source-no="${escapeAttr(row.cutOrderNo)}"
              >
                <div class="text-xs font-medium text-muted-foreground">裁片任务</div>
                <div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(row.cutOrderNo)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.materialIdentity.materialSku)} · ${escapeHtml(row.materialIdentity.materialName)}</div>
                <div class="mt-1 text-xs text-muted-foreground">按裁片任务已配：${escapeHtml(formatCuttingWaitProcessQty(row.transferWarehouseAllocatedQty, row.unit))}</div>
              </button>
            `).join('')
            : '<div class="rounded-xl bg-muted/60 px-3 py-3 text-xs text-muted-foreground">暂无中转仓领料通知。</div>'}
      </div>
    </section>
  `
}

function getCuttingWaitProcessActions() {
  return [
    { key: 'pickup', action: 'cutting-wp-pickup', title: '中转仓领料', desc: '按裁片任务领回物料，并确认入库库区库位。' },
    { key: 'issue', action: 'cutting-wp-issue', title: '加工领料', desc: '扫铺布单，从指定库区库位领走面料。' },
    { key: 'return', action: 'cutting-wp-return', title: '回收入仓', desc: '铺布剩余面料扫码回收，写回库区库位。' },
  ]
}

function renderCuttingWaitProcessActionCards(activeAction?: string | null): string {
  const actions = getCuttingWaitProcessActions()
  return `
    <section class="grid grid-cols-1 gap-2">
      ${actions.map((item) => `
        <button
          type="button"
          class="rounded-2xl border px-4 py-4 text-left shadow-sm ${activeAction === item.key ? 'border-primary bg-primary/5' : 'bg-card'}"
          data-pda-warehouse-action="${escapeAttr(item.action)}"
        >
          <div class="text-base font-semibold text-foreground">${escapeHtml(item.title)}</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">${escapeHtml(item.desc)}</div>
        </button>
      `).join('')}
    </section>
  `
}

function renderCuttingWaitProcessSingleAction(activeAction: string): string {
  const action = getCuttingWaitProcessActions().find((item) => item.key === activeAction)
  if (!action) return ''
  return `
    <section class="space-y-3">
      <button
        type="button"
        class="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
        data-pda-warehouse-action="${escapeAttr(action.action)}"
      >
        开始${escapeHtml(action.title)}
      </button>
    </section>
  `
}

function getCuttingWaitProcessActionEventType(activeAction: string): string {
  if (activeAction === 'pickup') return '中转仓领料'
  if (activeAction === 'issue') return '待加工仓加工领料'
  if (activeAction === 'return') return '待加工仓回收入仓'
  return ''
}

function getCuttingWaitProcessActionResultTitle(activeAction: string): string {
  if (activeAction === 'pickup') return '中转仓领料后结果'
  if (activeAction === 'issue') return '加工领料后结果'
  if (activeAction === 'return') return '回收入仓后结果'
  return '操作后结果'
}

function getCuttingWaitProcessActionFallbackRow(rows: MaterialLedgerProjection[]): MaterialLedgerProjection | undefined {
  return listCuttingPendingPickupRows(rows)[0] || rows.find((row) => row.cuttingClaimedQty > 0) || rows[0]
}

function openCuttingPickupDraft(sourceNo?: string, prepRecordId?: string, prepLineId?: string): void {
  const rows = listMaterialLedgerProjections()
  const prepContext = prepRecordId ? getMaterialPrepRecordContext(prepRecordId, prepLineId || '') : null
  const row = prepContext?.ledgerRow || findCuttingWaitProcessLedgerRow(sourceNo) || getCuttingWaitProcessActionFallbackRow(rows)
  const defaultQty = prepContext?.availableToPickupQty || row?.transferWarehouseAllocatedQty || 120
  const defaultRollCount = prepContext?.item.rollCount || (defaultQty > 0 ? Math.max(Math.ceil(defaultQty / 280), 1) : 1)
  state.cuttingPickupSourceNo = prepContext?.line.cutOrderNo || row?.cutOrderNo || sourceNo || ''
  state.cuttingPickupPrepRecordId = prepContext?.record.prepRecordId || ''
  state.cuttingPickupPrepLineId = prepContext?.item.prepLineId || ''
  const receiveLocation = resolveCuttingReceiveLocationByMaterial(prepContext?.line.materialType)
  state.cuttingPickupWarehouseArea = receiveLocation?.area || '面料 A 区'
  state.cuttingPickupLocationCode = receiveLocation?.locations[0] || 'FAB-A-01'
  state.cuttingPickupQty = String(defaultQty)
  state.cuttingPickupRollCount = String(defaultRollCount)
}

function clearCuttingPickupDraft(): void {
  state.cuttingPickupSourceNo = ''
  state.cuttingPickupPrepRecordId = ''
  state.cuttingPickupPrepLineId = ''
  state.cuttingPickupWarehouseArea = ''
  state.cuttingPickupLocationCode = ''
  state.cuttingPickupQty = ''
  state.cuttingPickupRollCount = ''
}

function getCuttingPickupLocationOptions() {
  const currentArea = state.cuttingPickupWarehouseArea || CUTTING_RECEIVE_LOCATIONS[0]?.area || ''
  const currentAreaConfig = CUTTING_RECEIVE_LOCATIONS.find((item) => item.area === currentArea) || CUTTING_RECEIVE_LOCATIONS[0]
  return {
    areaOptions: CUTTING_RECEIVE_LOCATIONS.map((item) => item.area),
    locationOptions: currentAreaConfig?.locations || [],
  }
}

function renderCuttingPickupDraftPage(): string {
  const row = findCuttingWaitProcessLedgerRow(state.cuttingPickupSourceNo)
  const prepContext = state.cuttingPickupPrepRecordId ? getMaterialPrepRecordContext(state.cuttingPickupPrepRecordId, state.cuttingPickupPrepLineId) : null
  const sourceNo = row?.cutOrderNo || state.cuttingPickupSourceNo
  const materialText = prepContext
    ? `${prepContext.line.materialSku} · ${prepContext.line.materialName} / ${prepContext.line.color}`
    : row
    ? `${row.materialIdentity.materialSku} · ${row.materialIdentity.materialName} / ${row.materialIdentity.materialColor || '待补颜色'}`
    : '请重新选择中转仓领料裁片任务'
  const preparedQty = prepContext ? formatCuttingWaitProcessQty(prepContext.item.preparedQty, prepContext.line.unit) : row ? formatCuttingWaitProcessQty(row.transferWarehouseAllocatedQty, row.unit) : '-'
  const claimedQty = prepContext ? formatCuttingWaitProcessQty(prepContext.pickedQty, prepContext.line.unit) : row ? formatCuttingWaitProcessQty(row.cuttingClaimedQty, row.unit) : '-'
  const options = getCuttingPickupLocationOptions()
  return `
    <section class="space-y-4">
      <div class="space-y-2 px-1">
        <div class="text-base font-semibold text-foreground">中转仓领料裁片任务</div>
        <div class="rounded-2xl border bg-background px-4 py-4 text-sm shadow-sm">
          <div class="text-xs font-medium text-muted-foreground">裁片任务</div>
          <div class="mt-1 text-base font-semibold text-foreground">${escapeHtml(sourceNo || '未识别')}</div>
          <div class="mt-2 text-xs leading-5 text-muted-foreground">${escapeHtml(materialText)}</div>
          ${prepContext ? `<div class="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">配料单：${escapeHtml(prepContext.projection.order.prepOrderNo)} / 配料记录：${escapeHtml(prepContext.record.prepRecordId)} / 记录内物料 ${prepContext.items.length} 项；当前执行：${escapeHtml(prepContext.line.materialSku)}，整条记录待领 ${escapeHtml(String(prepContext.totalAvailableToPickupQty))}。</div>` : ''}
          <div class="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>中转仓已配：${escapeHtml(preparedQty)}</div>
            <div>已领料：${escapeHtml(claimedQty)}</div>
          </div>
        </div>
      </div>

      <div class="space-y-3 px-1">
        <div>
          <div class="text-base font-semibold text-foreground">确认中转仓领料</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">确认从中转仓领回的数量和卷数，并直接写入裁床待加工仓库区库位。</div>
        </div>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">入库库区</span>
          <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="cutting-pickup-area">
            ${options.areaOptions.map((area) => `<option value="${escapeAttr(area)}" ${area === state.cuttingPickupWarehouseArea ? 'selected' : ''}>${escapeHtml(area)}</option>`).join('')}
          </select>
        </label>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">入库库位</span>
          <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="cutting-pickup-location">
            ${options.locationOptions.map((location) => `<option value="${escapeAttr(location)}" ${location === state.cuttingPickupLocationCode ? 'selected' : ''}>${escapeHtml(location)}</option>`).join('')}
          </select>
        </label>
        <div class="grid grid-cols-2 gap-2">
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-muted-foreground">领料数量（yard）</span>
            <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(state.cuttingPickupQty)}" data-pda-warehouse-field="cutting-pickup-qty" />
          </label>
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-muted-foreground">卷数</span>
            <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="numeric" value="${escapeAttr(state.cuttingPickupRollCount)}" data-pda-warehouse-field="cutting-pickup-roll-count" />
          </label>
        </div>
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button type="button" class="rounded-xl border bg-background px-4 py-3 text-sm font-medium text-foreground" data-pda-warehouse-action="cancel-cutting-wp-pickup">重新选择</button>
          <button type="button" class="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="confirm-cutting-wp-pickup">确认领料</button>
        </div>
      </div>
    </section>
  `
}

function openCuttingIssueDraft(sourceNo?: string): void {
  const rows = listMaterialLedgerProjections()
  const row = findCuttingWaitProcessLedgerRow(sourceNo) || rows.find((item) => item.availableQty > 0) || getCuttingWaitProcessActionFallbackRow(rows)
  const stockQty = row?.availableQty || row?.cuttingClaimedQty || row?.transferWarehouseAllocatedQty || 120
  const defaultQty = row?.availableQty && row.availableQty > 0
    ? Math.max(Math.round(row.availableQty * 0.6), 1)
    : Math.max(Math.round(stockQty * 0.6), 1)
  const defaultRollCount = defaultQty > 0 ? Math.max(Math.ceil(defaultQty / 280), 1) : 1
  const latestLocation = row ? splitCuttingLocationText(getCuttingWaitProcessLocationLabel(row)) : { warehouseArea: '面料 A 区', locationCode: 'FAB-A-01' }
  state.cuttingIssueSourceNo = row?.cutOrderNo || sourceNo || ''
  state.cuttingIssueWarehouseArea = latestLocation.warehouseArea
  state.cuttingIssueLocationCode = latestLocation.locationCode
  state.cuttingIssueQty = String(defaultQty)
  state.cuttingIssueRollCount = String(defaultRollCount)
}

function clearCuttingIssueDraft(): void {
  state.cuttingIssueSourceNo = ''
  state.cuttingIssueWarehouseArea = ''
  state.cuttingIssueLocationCode = ''
  state.cuttingIssueQty = ''
  state.cuttingIssueRollCount = ''
}

function getCuttingIssueLocationOptions() {
  const currentArea = state.cuttingIssueWarehouseArea || CUTTING_RECEIVE_LOCATIONS[0]?.area || ''
  const currentAreaConfig = CUTTING_RECEIVE_LOCATIONS.find((item) => item.area === currentArea) || CUTTING_RECEIVE_LOCATIONS[0]
  return {
    areaOptions: CUTTING_RECEIVE_LOCATIONS.map((item) => item.area),
    locationOptions: currentAreaConfig?.locations || [],
  }
}

function renderCuttingIssueDraftPage(): string {
  const row = findCuttingWaitProcessLedgerRow(state.cuttingIssueSourceNo)
  const sourceNo = row?.cutOrderNo || state.cuttingIssueSourceNo
  const materialText = row
    ? `${row.materialIdentity.materialSku} · ${row.materialIdentity.materialName} / ${row.materialIdentity.materialColor || '待补颜色'}`
    : '请重新扫码确认领料对象'
  const availableQty = row ? formatCuttingWaitProcessQty(row.availableQty, row.unit) : '-'
  const latestLocation = row ? getCuttingWaitProcessLocationLabel(row) : '-'
  const options = getCuttingIssueLocationOptions()
  return `
    <section class="space-y-4">
      <div class="space-y-2 px-1">
        <div class="text-base font-semibold text-foreground">已扫对象</div>
        <div class="rounded-2xl border bg-background px-4 py-4 text-sm shadow-sm">
          <div class="text-xs font-medium text-muted-foreground">铺布用料来源</div>
          <div class="mt-1 text-base font-semibold text-foreground">${escapeHtml(sourceNo || '未识别')}</div>
          <div class="mt-2 text-xs leading-5 text-muted-foreground">${escapeHtml(materialText)}</div>
          <div class="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>在库可用：${escapeHtml(availableQty)}</div>
            <div>最近库位：${escapeHtml(latestLocation)}</div>
          </div>
        </div>
      </div>

      <div class="space-y-3 px-1">
        <div>
          <div class="text-base font-semibold text-foreground">确认加工领料</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">从待加工仓指定库区库位领走面料，用于铺布或加工。</div>
        </div>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">领料库区</span>
          <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="cutting-issue-area">
            ${options.areaOptions.map((area) => `<option value="${escapeAttr(area)}" ${area === state.cuttingIssueWarehouseArea ? 'selected' : ''}>${escapeHtml(area)}</option>`).join('')}
          </select>
        </label>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">领料库位</span>
          <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="cutting-issue-location">
            ${options.locationOptions.map((location) => `<option value="${escapeAttr(location)}" ${location === state.cuttingIssueLocationCode ? 'selected' : ''}>${escapeHtml(location)}</option>`).join('')}
          </select>
        </label>
        <div class="grid grid-cols-2 gap-2">
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-muted-foreground">领料数量（yard）</span>
            <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(state.cuttingIssueQty)}" data-pda-warehouse-field="cutting-issue-qty" />
          </label>
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-muted-foreground">卷数</span>
            <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="numeric" value="${escapeAttr(state.cuttingIssueRollCount)}" data-pda-warehouse-field="cutting-issue-roll-count" />
          </label>
        </div>
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button type="button" class="rounded-xl border bg-background px-4 py-3 text-sm font-medium text-foreground" data-pda-warehouse-action="cancel-cutting-wp-issue">重新扫码</button>
          <button type="button" class="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="confirm-cutting-wp-issue">确认领料</button>
        </div>
      </div>
    </section>
  `
}

interface CuttingReturnDocumentOption {
  docNo: string
  docId: string
  label: string
  materialSku: string
  materialName: string
  cutOrderNo: string
  productionOrderNo: string
  plannedUsage: number
}

function listCuttingReturnDocumentOptions(): CuttingReturnDocumentOption[] {
  return buildMarkerSpreadingProjection({ includeCreateSources: false, includeViewModel: false })
    .spreadingOrders
    .slice(0, 24)
    .map((order: SpreadingOrder) => ({
      docNo: order.spreadingOrderNo,
      docId: order.spreadingOrderId,
      label: `${order.spreadingOrderNo} / ${order.markerPlanNo} / ${order.materialIdentity.materialSku}`,
      materialSku: order.materialIdentity.materialSku,
      materialName: order.materialIdentity.materialName,
      cutOrderNo: order.sourceCutOrderNos[0] || '',
      productionOrderNo: order.productionOrderNos[0] || '',
      plannedUsage: order.plannedMaterialUsage,
    }))
}

function findCuttingLedgerRowByReturnDocument(docNo: string): MaterialLedgerProjection | undefined {
  if (!docNo) return undefined
  const option = listCuttingReturnDocumentOptions().find((item) => item.docNo === docNo)
  if (!option) return undefined
  return listMaterialLedgerProjections().find((row) => {
    return (
      row.cutOrderNo === option.cutOrderNo ||
      row.productionOrderNo === option.productionOrderNo ||
      row.materialIdentity.materialSku === option.materialSku ||
      row.materialIdentity.materialName === option.materialName
    )
  })
}

function openCuttingReturnDraft(sourceNo?: string): void {
  const rows = listMaterialLedgerProjections()
  const row = findCuttingWaitProcessLedgerRow(sourceNo) || rows.find((item) => item.spreadingConsumedQty > 0 || item.cuttingClaimedQty > 0) || getCuttingWaitProcessActionFallbackRow(rows)
  const baseQty = row?.spreadingConsumedQty || row?.cuttingClaimedQty || row?.transferWarehouseAllocatedQty || 420
  const defaultQty = Math.max(Math.round(baseQty * 0.08), 1)
  const defaultRollCount = defaultQty > 0 ? Math.max(Math.ceil(defaultQty / 280), 1) : 1
  state.cuttingReturnSourceNo = row?.cutOrderNo || sourceNo || ''
  state.cuttingReturnRelatedDocNo = ''
  state.cuttingReturnWarehouseArea = '面料 A 区'
  state.cuttingReturnLocationCode = 'FAB-A-02'
  state.cuttingReturnQty = String(defaultQty)
  state.cuttingReturnRollCount = String(defaultRollCount)
}

function clearCuttingReturnDraft(): void {
  state.cuttingReturnSourceNo = ''
  state.cuttingReturnRelatedDocNo = ''
  state.cuttingReturnWarehouseArea = ''
  state.cuttingReturnLocationCode = ''
  state.cuttingReturnQty = ''
  state.cuttingReturnRollCount = ''
}

function getCuttingReturnLocationOptions() {
  const currentArea = state.cuttingReturnWarehouseArea || CUTTING_RECEIVE_LOCATIONS[0]?.area || ''
  const currentAreaConfig = CUTTING_RECEIVE_LOCATIONS.find((item) => item.area === currentArea) || CUTTING_RECEIVE_LOCATIONS[0]
  return {
    areaOptions: CUTTING_RECEIVE_LOCATIONS.map((item) => item.area),
    locationOptions: currentAreaConfig?.locations || [],
  }
}

function renderCuttingReturnDraftPage(): string {
  const documentOptions = listCuttingReturnDocumentOptions()
  const selectedDocument = documentOptions.find((item) => item.docNo === state.cuttingReturnRelatedDocNo)
  const row = selectedDocument
    ? findCuttingLedgerRowByReturnDocument(selectedDocument.docNo)
    : findCuttingWaitProcessLedgerRow(state.cuttingReturnSourceNo)
  const sourceNo = row?.cutOrderNo || state.cuttingReturnSourceNo || '未选择裁片任务'
  const materialText = selectedDocument
    ? `${selectedDocument.materialSku} · ${selectedDocument.materialName}`
    : row
      ? `${row.materialIdentity.materialSku} · ${row.materialIdentity.materialName} / ${row.materialIdentity.materialColor || '待补颜色'}`
      : '可不关联单据，直接按现场剩余面料回收入仓'
  const options = getCuttingReturnLocationOptions()
  return `
    <section class="space-y-4">
      <div class="space-y-2 px-1">
        <div class="text-base font-semibold text-foreground">回收对象</div>
        <div class="rounded-2xl border bg-background px-4 py-4 text-sm shadow-sm">
          <div class="text-xs font-medium text-muted-foreground">${selectedDocument ? '关联铺布单' : '来源裁片任务'}</div>
          <div class="mt-1 text-base font-semibold text-foreground">${escapeHtml(selectedDocument?.docNo || sourceNo)}</div>
          <div class="mt-2 text-xs leading-5 text-muted-foreground">${escapeHtml(materialText)}</div>
          ${selectedDocument
            ? `<div class="mt-2 text-xs text-muted-foreground">来源裁片任务：${escapeHtml(selectedDocument.cutOrderNo || '-')} · 计划用量：${escapeHtml(String(selectedDocument.plannedUsage))} yard</div>`
            : '<div class="mt-2 text-xs text-muted-foreground">铺布单为可选项，没有对应单据时可直接回收现场剩余面料。</div>'}
        </div>
      </div>

      <div class="space-y-3 px-1">
        <div>
          <div class="text-base font-semibold text-foreground">确认回收入仓</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">选择关联单据不是必填；必须确认回收入库区、库位、数量和卷数。</div>
        </div>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">关联单据（可选）</span>
          <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="cutting-return-related-doc">
            <option value="">不关联单据</option>
            ${documentOptions.map((item) => `<option value="${escapeAttr(item.docNo)}" ${item.docNo === state.cuttingReturnRelatedDocNo ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
          </select>
        </label>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">回收入库区</span>
          <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="cutting-return-area">
            ${options.areaOptions.map((area) => `<option value="${escapeAttr(area)}" ${area === state.cuttingReturnWarehouseArea ? 'selected' : ''}>${escapeHtml(area)}</option>`).join('')}
          </select>
        </label>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">回收入库位</span>
          <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="cutting-return-location">
            ${options.locationOptions.map((location) => `<option value="${escapeAttr(location)}" ${location === state.cuttingReturnLocationCode ? 'selected' : ''}>${escapeHtml(location)}</option>`).join('')}
          </select>
        </label>
        <div class="grid grid-cols-2 gap-2">
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-muted-foreground">回收数量（yard）</span>
            <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(state.cuttingReturnQty)}" data-pda-warehouse-field="cutting-return-qty" />
          </label>
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-muted-foreground">卷数</span>
            <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="numeric" value="${escapeAttr(state.cuttingReturnRollCount)}" data-pda-warehouse-field="cutting-return-roll-count" />
          </label>
        </div>
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button type="button" class="rounded-xl border bg-background px-4 py-3 text-sm font-medium text-foreground" data-pda-warehouse-action="cancel-cutting-wp-return">重新选择</button>
          <button type="button" class="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="confirm-cutting-wp-return">确认回收入仓</button>
        </div>
      </div>
    </section>
  `
}

function renderCuttingWaitProcessEventResult(event: CuttingRuntimeEvent): string {
  const qty = getCuttingRuntimeEventQty(event)
  const rollCount = getCuttingRuntimeEventRollCount(event)
  const payload = runtimeRecord(event.payload)
  const unit = event.inventoryEffect?.unit || runtimeString(payload.unit) || 'yard'
  const locationLine = `库区库位：${getCuttingRuntimeEventLocationLabel(event)}`
  return `
    <div class="space-y-1.5 border-t py-3 text-xs text-muted-foreground first:border-t-0 first:pt-0 last:pb-0">
      <div class="text-sm font-semibold text-foreground">${escapeHtml(getCuttingRuntimeEventSourceText(event))}</div>
      <div>数量：${escapeHtml(`${qty} ${unit} / ${rollCount} 卷`)}</div>
      <div>${escapeHtml(locationLine)}</div>
      <div>同步状态：${escapeHtml(event.eventStatus)} · ${escapeHtml(event.occurredAt)}</div>
    </div>
  `
}

function renderCuttingWaitProcessFallbackResult(activeAction: string, rows: MaterialLedgerProjection[]): string {
  const row = getCuttingWaitProcessActionFallbackRow(rows)
  if (!row) return '<div class="py-3 text-xs text-muted-foreground">暂无可演示的裁片任务。</div>'
  const qty = activeAction === 'pickup'
      ? row.transferWarehouseAllocatedQty
    : activeAction === 'return'
      ? Math.max(Math.round((row.cuttingClaimedQty || row.transferWarehouseAllocatedQty) * 0.08), 35)
      : Math.max(Math.round((row.availableQty || row.cuttingClaimedQty || row.transferWarehouseAllocatedQty) * 0.6), 120)
  const location = activeAction === 'return' ? '面料 A 区 / FAB-A-02' : '面料 A 区 / FAB-A-01'
  const sourceText = activeAction === 'pickup'
      ? `中转仓领料：${row.cutOrderNo}`
      : activeAction === 'issue'
        ? `加工领料：${row.cutOrderNo}`
        : `回收入仓：${row.cutOrderNo}`
  return `
    <div class="space-y-1.5 py-3 text-xs text-muted-foreground">
      <div class="text-sm font-semibold text-foreground">${escapeHtml(sourceText)}</div>
      <div>面料：${escapeHtml(row.materialIdentity.materialSku)} · ${escapeHtml(row.materialIdentity.materialName)}</div>
      <div>数量：${escapeHtml(formatCuttingWaitProcessQty(qty, row.unit))}</div>
      <div>${escapeHtml(`库区库位：${location}`)}</div>
      <div>同步状态：演示数据，扫码提交后会写入事件账。</div>
    </div>
  `
}

function renderCuttingWaitProcessActionResult(activeAction: string, rows: MaterialLedgerProjection[]): string {
  const eventType = getCuttingWaitProcessActionEventType(activeAction)
  const recentEvents = eventType
    ? listCuttingWaitProcessRuntimeEvents().filter((event) => event.eventType === eventType).slice(0, 2)
    : []
  return `
    <section class="space-y-2">
      <div class="px-1 text-base font-semibold text-foreground">${escapeHtml(getCuttingWaitProcessActionResultTitle(activeAction))}</div>
      <div class="rounded-2xl bg-muted/50 px-4 py-1">
        ${recentEvents.length
          ? recentEvents.map((event) => renderCuttingWaitProcessEventResult(event)).join('')
          : renderCuttingWaitProcessFallbackResult(activeAction, rows)}
      </div>
    </section>
  `
}

function renderCuttingWaitProcessNextActions(activeAction: string): string {
  const actions = activeAction === 'pickup'
    ? [
        { label: '去加工领料', route: '/fcs/pda/warehouse/wait-process?scope=cutting&action=issue' },
        { label: '查看待加工仓库存', route: '/fcs/pda/warehouse/wait-process?scope=cutting' },
      ]
    : activeAction === 'issue'
      ? [
          { label: '去回收入仓', route: '/fcs/pda/warehouse/wait-process?scope=cutting&action=return' },
          { label: '查看待加工仓库存', route: '/fcs/pda/warehouse/wait-process?scope=cutting' },
        ]
      : [
          { label: '查看待加工仓库存', route: '/fcs/pda/warehouse/wait-process?scope=cutting' },
          { label: '返回仓管', route: '/fcs/pda/warehouse' },
        ]
  return `
    <section class="space-y-2">
      <div class="px-1 text-base font-semibold text-foreground">后续操作</div>
      <div class="grid grid-cols-1 gap-2">
        ${actions.map((item) => `
          <button
            type="button"
            class="w-full rounded-xl border bg-background px-4 py-3 text-left text-sm font-medium text-foreground"
            data-nav="${escapeAttr(item.route)}"
          >
            ${escapeHtml(item.label)}
          </button>
        `).join('')}
      </div>
    </section>
  `
}

function renderCuttingWaitProcessSubpageHeader(title: string, description: string): string {
  return `
    <div class="flex items-start justify-between gap-3 px-1 pb-1 pt-1">
      <div class="min-w-0">
        <div class="text-xl font-semibold leading-tight text-foreground">${escapeHtml(title)}</div>
        <div class="mt-1 max-w-[260px] text-xs leading-5 text-muted-foreground">${escapeHtml(description)}</div>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground"
        data-nav="/fcs/pda/warehouse"
      >
        返回仓管
      </button>
    </div>
  `
}

function renderCuttingPickupTaskPage(rows: MaterialLedgerProjection[]): string {
  if (state.cuttingPickupSourceNo) {
    return `
      <div class="space-y-4 px-4 pb-5 pt-4">
        ${renderCuttingWaitProcessSubpageHeader('中转仓领料', '确认按裁片任务从中转仓领回的数量、卷数和库区库位。')}
        ${renderCuttingPickupDraftPage()}
      </div>
    `
  }
  return `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderCuttingWaitProcessSubpageHeader('中转仓领料', '中转仓按裁片任务配料后，裁床仓管在这里确认领料数量、卷数和入库位置。')}
      ${renderCuttingPendingPickupList(rows)}
      ${renderCuttingWaitProcessActionResult('pickup', rows)}
      ${renderCuttingWaitProcessNextActions('pickup')}
    </div>
  `
}

function renderCuttingWaitProcessActionPage(activeAction: string): string {
  const actions = [
    { key: 'issue', title: '加工领料', desc: '铺布或加工前从待加工仓领走面料，必须记录来源库区库位。' },
    { key: 'return', title: '回收入仓', desc: '铺布剩余面料回收入仓，必须写回库区库位。' },
  ]
  const current = actions.find((item) => item.key === activeAction)
  if (!current) return ''
  const rows = listMaterialLedgerProjections()
  if (activeAction === 'issue' && state.cuttingIssueSourceNo) {
    return `
      <div class="space-y-4 px-4 pb-5 pt-4">
        ${renderCuttingWaitProcessSubpageHeader(current.title, current.desc)}
        ${renderCuttingIssueDraftPage()}
      </div>
    `
  }
  if (activeAction === 'return' && (state.cuttingReturnSourceNo || state.cuttingReturnRelatedDocNo)) {
    return `
      <div class="space-y-4 px-4 pb-5 pt-4">
        ${renderCuttingWaitProcessSubpageHeader(current.title, current.desc)}
        ${renderCuttingReturnDraftPage()}
      </div>
    `
  }
  return `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderCuttingWaitProcessSubpageHeader(current.title, current.desc)}
      ${renderCuttingWaitProcessSingleAction(activeAction)}
      ${renderCuttingWaitProcessActionResult(activeAction, rows)}
      ${renderCuttingWaitProcessNextActions(activeAction)}
    </div>
  `
}

function renderCuttingWaitProcessRow(row: MaterialLedgerProjection): string {
  const latestSourceText = getCuttingWaitProcessLatestSourceText(row)
  const locationLabel = getCuttingWaitProcessLocationLabel(row)
  const status = row.cuttingClaimedQty <= 0 ? '未收货' : row.availableQty > 0 ? '在库可用' : '无可用'

  return `
    <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="text-sm font-semibold text-foreground">${escapeHtml(row.materialIdentity.materialSku)}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.materialIdentity.materialName)} / ${escapeHtml(row.materialIdentity.materialColor || '待补颜色')}</div>
        </div>
        ${renderStatusPill(status)}
      </div>
      <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <div>裁片单：${escapeHtml(row.cutOrderNo)}</div>
        <div>生产单：${escapeHtml(row.productionOrderNo)}</div>
        <div>库区库位：${escapeHtml(locationLabel)}</div>
        <div>裁床已领：${escapeHtml(formatCuttingWaitProcessQty(row.cuttingClaimedQty, row.unit))}</div>
        <div>可用余额：${escapeHtml(formatCuttingWaitProcessQty(row.availableQty, row.unit))}</div>
        <div>最近流水：${escapeHtml(latestSourceText)}</div>
      </div>
    </article>
  `
}

function renderCuttingWaitProcessPage(): string {
  const params = getMobileWarehouseSearchParams()
  const activeAction = params.get('action')
  const activeView = params.get('view')
  const rows = listMaterialLedgerProjections()
  if (activeView === 'pickup' || activeAction === 'pickup') {
    return renderPdaFrame(renderCuttingPickupTaskPage(rows), 'warehouse', { headerTitle: '中转仓领料', disableTodoAutoOpen: true })
  }
  if (activeAction && ['issue', 'return'].includes(activeAction)) {
    return renderPdaFrame(renderCuttingWaitProcessActionPage(activeAction), 'warehouse', { headerTitle: '裁床待加工仓', disableTodoAutoOpen: true })
  }
  const stockedRows = rows.filter((row) => row.cuttingClaimedQty > 0 || row.availableQty >= 0)
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderCuttingWaitProcessSubpageHeader('裁床待加工仓', '处理中转仓领料、加工领料和回收入仓。')}
      ${renderCuttingWaitProcessActionCards(null)}
      <section class="space-y-3">
        ${stockedRows.length
          ? stockedRows.slice(0, 8).map((row) => renderCuttingWaitProcessRow(row)).join('')
          : renderMobilePageEmptyState('暂无裁床待加工库存', '中转仓领料确认后会形成裁床待加工仓库存。')}
      </section>
    </div>
  `
  return renderPdaFrame(content, 'warehouse', { headerTitle: '裁床待加工仓', disableTodoAutoOpen: true })
}

function getPostFinishingWaitProcessRows(): PostFinishingWaitProcessWarehouseRecord[] {
  return listPostFinishingWaitProcessWarehouseRecords()
}

function getRows() {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return []
  return listFactoryWaitProcessStockItems()
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
  const specialCraftSummary = row.feiTicketNo ? getSpecialCraftFeiTicketSummary(row.feiTicketNo) : null
  const inboundRoute = resolveWarehouseInboundRecordRoute(row.sourceRecordId)
  return `
    <div class="fixed inset-0 z-[120]">
      <button type="button" class="absolute inset-0 bg-black/40" data-pda-warehouse-action="close-wait-process-detail"></button>
      <section class="absolute inset-x-0 bottom-[72px] rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-foreground">待加工仓详情</h2>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-warehouse-action="close-wait-process-detail">关闭</button>
        </div>
        <div class="mt-4 rounded-2xl border bg-card px-4 py-4 shadow-sm">
          ${renderCompactFieldList([
            { label: '来源单号', value: row.sourceRecordNo },
            { label: '来源动作', value: getWaitProcessSourceActionLabel(row) },
            { label: '来源对象', value: row.sourceObjectName },
            { label: '入库记录', value: row.sourceRecordId ? '点击查看' : '未入库' },
            { label: '来源状态', value: getWaitProcessSourceStatusLabel(row) },
            { label: '所属任务', value: row.taskNo || '-' },
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
            { label: '应收数量', value: `${row.expectedQty} ${row.unit}` },
            { label: '实收数量', value: `${row.receivedQty} ${row.unit}` },
            { label: '差异数量', value: buildWarehouseDifferenceText(row.differenceQty) },
            { label: '库区', value: row.areaName },
            { label: '货架', value: row.shelfNo },
            { label: '库位', value: row.locationNo },
            { label: '状态', value: row.status },
          ])}
          <div class="mt-4 flex gap-2">
            <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-nav="${escapeAttr(inboundRoute)}">查看入库</button>
            <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-nav="${escapeAttr(resolveWaitProcessSourceRoute(row))}">查看来源</button>
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
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_PROCESS')
  if (!warehouse) return ''
  const options = getWarehousePositionOptions(warehouse.warehouseId)
  const shelfOptions = options.shelfOptionsByArea[state.areaName] || []
  const locationOptions = options.locationOptionsByShelf[state.shelfNo] || []
  return `
    <div class="fixed inset-0 z-[125]">
      <button type="button" class="absolute inset-0 bg-black/40" data-pda-warehouse-action="close-wait-process-location"></button>
      <section class="absolute inset-x-0 bottom-[72px] rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-foreground">调整位置</h2>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-warehouse-action="close-wait-process-location">关闭</button>
        </div>
        <div class="mt-4 space-y-3">
          <label class="block text-xs text-muted-foreground">库区</label>
          <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wait-process-area">
            ${options.areaOptions.map((option) => `<option value="${escapeAttr(option.value)}" ${option.value === state.areaName ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
          </select>
          <label class="block text-xs text-muted-foreground">货架</label>
          <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wait-process-shelf">
            ${shelfOptions.map((option) => `<option value="${escapeAttr(option.value)}" ${option.value === state.shelfNo ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
          </select>
          <label class="block text-xs text-muted-foreground">库位</label>
          <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wait-process-location">
            ${locationOptions.map((option) => `<option value="${escapeAttr(option.value)}" ${option.value === state.locationNo ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
          </select>
          <label class="block text-xs text-muted-foreground">备注</label>
          <textarea class="min-h-20 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-warehouse-field="wait-process-remark">${escapeHtml(state.remark)}</textarea>
        </div>
        <div class="mt-4 flex gap-2">
          <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-pda-warehouse-action="close-wait-process-location">取消</button>
          <button type="button" class="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground" data-pda-warehouse-action="save-wait-process-location">保存</button>
        </div>
      </section>
    </div>
  `
}

function renderPostFinishingFlowSummary(record: PostFinishingWaitProcessWarehouseRecord): string {
  return record.flowRecords
    .slice(-3)
    .map((flow) => `${flow.flowType}${flow.qty}${flow.qtyUnit}`)
    .join(' / ') || '-'
}

function renderPostFinishingWaitProcessDetailDrawer(): string {
  const row = getPostFinishingWaitProcessRows().find((item) => item.warehouseRecordId === state.detailId)
  if (!row) return ''
  return `
    <div class="fixed inset-0 z-[120]">
      <button type="button" class="absolute inset-0 bg-black/40" data-pda-warehouse-action="close-wait-process-detail"></button>
      <section class="absolute inset-x-0 bottom-[72px] max-h-[78vh] overflow-y-auto rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-foreground">后道待加工仓详情</h2>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-warehouse-action="close-wait-process-detail">关闭</button>
        </div>
        <div class="mt-4 rounded-2xl border bg-card px-4 py-4 shadow-sm">
          ${renderCompactFieldList([
            { label: '仓库记录', value: row.warehouseRecordNo },
            { label: '来源交出记录', value: row.upstreamHandoverRecordNo || '-' },
            { label: '生产单', value: row.sourceProductionOrderNo },
            { label: '后道任务', value: row.sourceTaskNo },
            { label: '款式', value: `${row.spuCode} / ${row.spuName}` },
            { label: 'SKU', value: row.skuSummary },
            { label: '入仓数量', value: `${row.inboundGarmentQty} ${row.qtyUnit}` },
            { label: '可用数量', value: `${row.availableGarmentQty} ${row.qtyUnit}` },
            { label: '已占用数量', value: `${Math.max(row.inboundGarmentQty - row.availableGarmentQty, 0)} ${row.qtyUnit}` },
            { label: '库区库位', value: `${row.areaName || '-'} / ${row.locationCode || '-'}` },
            { label: '更新时间', value: formatWarehouseDateTime(row.updatedAt) },
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

function renderPostFinishingWaitProcessPage(): string {
  const rows = getPostFinishingWaitProcessRows()
  const totalAvailable = rows.reduce((sum, item) => sum + item.availableGarmentQty, 0)
  const totalInbound = rows.reduce((sum, item) => sum + item.inboundGarmentQty, 0)
  const flowCount = rows.reduce((sum, item) => sum + item.flowRecords.length, 0)
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="grid grid-cols-2 gap-2">
        <button type="button" class="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground" data-nav="/fcs/pda/warehouse/wait-process">待加工仓</button>
        <button type="button" class="rounded-2xl border bg-background px-4 py-3 text-sm font-medium" data-nav="/fcs/pda/warehouse/wait-handover">待交出仓</button>
      </section>
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <div class="text-base font-semibold">后道待加工仓</div>
        <div class="mt-1 text-xs text-muted-foreground">上游交出扫码收货后进入待加工仓，质检创建时锁定对应数量。</div>
        <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${rows.length}</div><div class="text-muted-foreground">SKU</div></div>
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${totalAvailable}</div><div class="text-muted-foreground">可用件数</div></div>
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${flowCount}</div><div class="text-muted-foreground">流水</div></div>
        </div>
        <div class="mt-2 text-xs text-muted-foreground">累计扫码收货 ${totalInbound} 件。</div>
      </section>
      <section class="space-y-3">
        ${rows.length > 0 ? rows.map((item) => `
          <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold">${escapeHtml(item.skuCode)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.spuName)} · ${escapeHtml(item.colorName)} / ${escapeHtml(item.sizeName)}</div>
              </div>
              ${renderStatusPill(item.availableGarmentQty > 0 ? '可质检' : '已占用')}
            </div>
            <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <div>生产单：${escapeHtml(item.sourceProductionOrderNo)}</div>
              <div>来源交出记录：${escapeHtml(item.upstreamHandoverRecordNo || '-')}</div>
              <div>入仓 / 可用：${item.inboundGarmentQty} / ${item.availableGarmentQty} ${escapeHtml(item.qtyUnit)}</div>
              <div>库区库位：${escapeHtml(item.areaName || '-')} / ${escapeHtml(item.locationCode || '-')}</div>
              <div>最近流水：${escapeHtml(renderPostFinishingFlowSummary(item))}</div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-process-detail" data-stock-item-id="${escapeAttr(item.warehouseRecordId)}">查看流水</button>
              <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveTaskRoute(item.sourceTaskNo))}">查看任务</button>
            </div>
          </article>
        `).join('') : renderMobilePageEmptyState('暂无后道待加工库存', '扫码收货确认后，会进入后道待加工仓。')}
      </section>
      ${renderPostFinishingWaitProcessDetailDrawer()}
    </div>
  `
  return renderPdaFrame(content, 'warehouse', { headerTitle: '后道待加工仓', disableTodoAutoOpen: true })
}

function getWoolWaitProcessAction(value?: string | null): WoolWaitProcessAction | null {
  return value === 'receive' || value === 'issue' || value === 'return' ? value : null
}

function getWoolWaitProcessLocations() {
  return listWoolWarehouseLocations('wait-process')
}

function ensureWoolReceiveDraft(): void {
  const receipt = listWoolWaitProcessScanReceipts().find((item) => item.lines.some((line) => line.currentReceivedWeightKg <= 0)) || listWoolWaitProcessScanReceipts()[0]
  const line = receipt?.lines[0]
  const location = getWoolWaitProcessLocations()[0]
  state.woolReceiveScan ||= receipt?.qrCode || receipt?.receiptNo || ''
  state.woolReceiveQty ||= String(line?.plannedWeightKg || 0)
  state.woolReceiveLocationId ||= location?.locationId || ''
}

function ensureWoolIssueDraft(): void {
  const inventory = listWoolWarehouseInventory('wait-process')
  const first = inventory.find((item) => item.currentQty > 0) || inventory[0]
  const order = first ? getWoolWorkOrderById(first.woolOrderId) : listWoolWorkOrders()[0]
  const location = getWoolWaitProcessLocations()[0]
  state.woolIssueOrderId ||= order?.woolOrderId || ''
  state.woolIssueQty ||= String(Math.max(Math.round((first?.currentQty || order?.yarnReceipt.receivedWeightKg || 1) * 0.8 * 100) / 100, 0.1))
  state.woolIssueLocationId ||= location?.locationId || ''
}

function ensureWoolReturnActionDraft(): void {
  const sourceOrder = getWoolWorkOrderById(state.woolReturnSourceOrderId) || listWoolWorkOrders()[0]
  const location = getWoolWaitProcessLocations()[0]
  if (sourceOrder && !state.woolReturnSourceOrderId) openWoolReturnDraft(sourceOrder.woolOrderId)
  state.woolReturnLocationId ||= location?.locationId || ''
}

function renderWoolWaitProcessActionCards(activeAction?: WoolWaitProcessAction | null): string {
  const actions: Array<{ key: WoolWaitProcessAction; title: string; desc: string }> = [
    { key: 'receive', title: '领料入仓', desc: '确认纱线重量和库区库位。' },
    { key: 'issue', title: '加工领料', desc: '从待加工仓领出纱线给横机使用。' },
    { key: 'return', title: '回收入仓', desc: '毛织剩余纱线回收入仓。' },
  ]
  return `
    <section class="grid grid-cols-1 gap-2">
      ${actions.map((item) => `
        <button
          type="button"
          class="rounded-2xl border px-4 py-4 text-left shadow-sm ${activeAction === item.key ? 'border-primary bg-primary/5' : 'bg-card'}"
          data-nav="/fcs/pda/warehouse/wait-process?action=${escapeAttr(item.key)}"
        >
          <div class="text-base font-semibold text-foreground">${escapeHtml(item.title)}</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">${escapeHtml(item.desc)}</div>
        </button>
      `).join('')}
    </section>
  `
}

function renderWoolLocationSelect(field: string, value: string): string {
  const locations = getWoolWaitProcessLocations()
  return `
    <label class="block space-y-1.5">
      <span class="text-xs font-medium text-muted-foreground">库区库位</span>
      <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="${escapeAttr(field)}">
        ${locations.map((location) => `
          <option value="${escapeAttr(location.locationId)}" ${location.locationId === value ? 'selected' : ''}>
            ${escapeHtml(`${location.areaName} / ${location.locationCode}`)}
          </option>
        `).join('')}
      </select>
    </label>
  `
}

function ensureWoolOrderScheduledForPdaIssue(orderId: string, yarnUsageWeightKg: number): void {
  let order = getWoolWorkOrderById(orderId)
  if (!order) return
  if (order.status === 'WAIT_PICKUP' || order.status === 'PICKUP_IN_PROGRESS' || order.status === 'WAIT_ACCEPT') {
    completeWoolPickupHead(orderId, 'PDA 毛织仓管')
    order = getWoolWorkOrderById(orderId)
  }
  if (order?.status === 'WAIT_MACHINE_SCHEDULE') {
    scheduleWoolMachines(orderId, 'PDA 毛织仓管')
    order = getWoolWorkOrderById(orderId)
  }
  if (order?.status === 'MACHINE_SCHEDULED') {
    updateWoolWorkOrderNodeStatus(orderId, '横机成片', '进行中', 'PDA 毛织仓管', undefined, { yarnUsageWeightKg })
  }
}

function renderWoolWaitProcessActionPage(action: WoolWaitProcessAction): string {
  if (action === 'receive') ensureWoolReceiveDraft()
  if (action === 'issue') ensureWoolIssueDraft()
  if (action === 'return') ensureWoolReturnActionDraft()
  const title = action === 'receive' ? '领料入仓' : action === 'issue' ? '加工领料' : '回收入仓'
  const receipt = listWoolWaitProcessScanReceipts().find((item) => item.qrCode === state.woolReceiveScan || item.receiptNo === state.woolReceiveScan) || listWoolWaitProcessScanReceipts()[0]
  const issueOptions = listWoolWorkOrders().slice(0, 24).map((order) => `
    <option value="${escapeAttr(order.woolOrderId)}" ${order.woolOrderId === state.woolIssueOrderId ? 'selected' : ''}>
      ${escapeHtml(`${order.woolOrderNo} / ${order.yarnReceipt.yarnSku} / ${order.status}`)}
    </option>
  `).join('')
  const returnSourceOrder = getWoolWorkOrderById(state.woolReturnSourceOrderId)
  const returnSelectedOrder = state.woolReturnSelectedOrderId ? getWoolWorkOrderById(state.woolReturnSelectedOrderId) : undefined
  const returnActiveOrder = returnSelectedOrder || returnSourceOrder
  const returnOptions = action === 'return' ? listWoolReturnDocumentOptions(state.woolReturnSourceOrderId) : []
  const returnCurrentOption = returnOptions.find((item) => item.woolOrderId === (returnActiveOrder?.woolOrderId || ''))
  const returnSourceText = returnSourceOrder
    ? `${returnSourceOrder.woolOrderNo} / ${returnSourceOrder.productionOrderNo}`
    : '未识别来源毛织加工单'
  const returnYarnText = returnActiveOrder
    ? `${returnActiveOrder.yarnReceipt.yarnSku} / ${returnActiveOrder.yarnReceipt.yarnName} / ${returnActiveOrder.yarnReceipt.colorName}`
    : '请选择或保留当前来源'
  return `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="flex items-start justify-between gap-3">
        <div>
          <div class="text-xl font-semibold leading-tight text-foreground">${escapeHtml(title)}</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">毛织待加工仓只处理纱线，库存单位固定为 kg。</div>
        </div>
        <button type="button" class="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-medium" data-nav="/fcs/pda/warehouse">返回仓管</button>
      </section>
      ${renderWoolWaitProcessActionCards(action)}
      <section class="space-y-3 rounded-2xl border bg-card px-4 py-4 shadow-sm">
        ${
          action === 'receive'
            ? `
              <label class="block space-y-1.5">
                <span class="text-xs font-medium text-muted-foreground">毛织领料单 / 二维码</span>
                <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" value="${escapeAttr(state.woolReceiveScan)}" data-pda-warehouse-field="wool-receive-scan" />
              </label>
              <div class="rounded-xl bg-muted/50 px-3 py-3 text-xs leading-5 text-muted-foreground">
                ${escapeHtml(receipt ? `${receipt.receiptNo} / ${receipt.sourceName} / ${receipt.lines[0]?.yarnSku || '-'}` : '暂无待领料入仓记录')}
              </div>
              <label class="block space-y-1.5">
                <span class="text-xs font-medium text-muted-foreground">实入重量（kg）</span>
                <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(state.woolReceiveQty)}" data-pda-warehouse-field="wool-receive-qty" />
              </label>
              ${renderWoolLocationSelect('wool-receive-location', state.woolReceiveLocationId)}
              <button type="button" class="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="confirm-wool-receive">确认领料入仓</button>
            `
            : action === 'issue'
              ? `
                <label class="block space-y-1.5">
                  <span class="text-xs font-medium text-muted-foreground">毛织加工单</span>
                  <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wool-issue-order">${issueOptions}</select>
                </label>
                <label class="block space-y-1.5">
                  <span class="text-xs font-medium text-muted-foreground">领料重量（kg）</span>
                  <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(state.woolIssueQty)}" data-pda-warehouse-field="wool-issue-qty" />
                </label>
                ${renderWoolLocationSelect('wool-issue-location', state.woolIssueLocationId)}
                <button type="button" class="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="confirm-wool-issue">确认加工领料</button>
              `
              : `
                <div class="space-y-1.5">
                  <div class="text-xs font-medium text-muted-foreground">回收来源</div>
                  <div class="rounded-xl bg-muted/50 px-3 py-3 text-xs leading-5 text-muted-foreground">${escapeHtml(returnSourceText)}</div>
                </div>
                <label class="block space-y-1.5">
                  <span class="text-xs font-medium text-muted-foreground">关联毛织加工单（可选）</span>
                  <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wool-return-selected-order">
                    <option value="">不关联加工单</option>
                    ${returnOptions.map((order) => `
                      <option value="${escapeAttr(order.woolOrderId)}" ${order.woolOrderId === state.woolReturnSelectedOrderId ? 'selected' : ''}>
                        ${escapeHtml(`${order.woolOrderNo} / ${order.productionOrderNo} / ${order.yarnSku}`)}
                      </option>
                    `).join('')}
                  </select>
                </label>
                <div class="rounded-xl bg-muted/50 px-3 py-3 text-xs leading-5 text-muted-foreground">
                  <div class="font-semibold text-foreground">${escapeHtml(returnYarnText)}</div>
                  <div class="mt-1">可回收参考：损耗 ${escapeHtml(String(returnCurrentOption?.lossWeightKg || 0))} kg / 已回收 ${escapeHtml(String(returnCurrentOption?.recoveredWeightKg || 0))} kg</div>
                </div>
                <label class="block space-y-1.5">
                  <span class="text-xs font-medium text-muted-foreground">回收重量（kg）</span>
                  <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(state.woolReturnQty)}" data-pda-warehouse-field="wool-return-qty" />
                </label>
                ${renderWoolLocationSelect('wool-return-location', state.woolReturnLocationId)}
                <button type="button" class="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="confirm-wool-return">确认回收入仓</button>
              `
        }
      </section>
    </div>
  `
}

function listWoolReturnDocumentOptions(sourceOrderId: string): Array<{
  woolOrderId: string
  woolOrderNo: string
  productionOrderNo: string
  yarnSku: string
  yarnName: string
  colorName: string
  lossWeightKg: number
  recoveredWeightKg: number
}> {
  const sourceOrder = getWoolWorkOrderById(sourceOrderId)
  const sourceYarnSku = sourceOrder?.yarnReceipt.yarnSku || ''
  return listWoolWorkOrders()
    .filter((order) => !sourceYarnSku || order.yarnReceipt.yarnSku === sourceYarnSku || order.woolOrderId === sourceOrderId)
    .slice(0, 24)
    .map((order) => {
      const usage = getWoolYarnUsageSummary(order)
      return {
        woolOrderId: order.woolOrderId,
        woolOrderNo: order.woolOrderNo,
        productionOrderNo: order.productionOrderNo,
        yarnSku: order.yarnReceipt.yarnSku,
        yarnName: order.yarnReceipt.yarnName,
        colorName: order.yarnReceipt.colorName,
        lossWeightKg: usage.linkingLossWeightKg,
        recoveredWeightKg: usage.recoveredWeightKg,
      }
    })
}

function openWoolReturnDraft(sourceOrderId: string): void {
  const sourceOrder = getWoolWorkOrderById(sourceOrderId)
  const usage = sourceOrder ? getWoolYarnUsageSummary(sourceOrder) : null
  const defaultQty = usage ? Math.max(usage.linkingLossWeightKg - usage.recoveredWeightKg, 0.1) : 0.1
  state.woolReturnSourceOrderId = sourceOrderId
  state.woolReturnSelectedOrderId = ''
  state.woolReturnQty = String(Math.round(defaultQty * 100) / 100)
}

function clearWoolReturnDraft(): void {
  state.woolReturnSourceOrderId = ''
  state.woolReturnSelectedOrderId = ''
  state.woolReturnQty = ''
}

function renderWoolReturnDraftPage(): string {
  const sourceOrder = getWoolWorkOrderById(state.woolReturnSourceOrderId)
  const selectedOrder = state.woolReturnSelectedOrderId ? getWoolWorkOrderById(state.woolReturnSelectedOrderId) : undefined
  const activeOrder = selectedOrder || sourceOrder
  const options = listWoolReturnDocumentOptions(state.woolReturnSourceOrderId)
  const sourceText = sourceOrder
    ? `${sourceOrder.woolOrderNo} · ${sourceOrder.productionOrderNo}`
    : '未识别来源毛织加工单'
  const yarnText = activeOrder
    ? `${activeOrder.yarnReceipt.yarnSku} · ${activeOrder.yarnReceipt.yarnName} / ${activeOrder.yarnReceipt.colorName}`
    : '请选择或保留当前来源'
  return `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="flex items-start justify-between gap-3 border-b pb-4">
        <div class="min-w-0">
          <div class="text-xl font-semibold text-foreground">回收入仓</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">毛织损耗或剩余纱线回收入仓。关联毛织加工单可选，不选则按当前来源记录。</div>
        </div>
        <button type="button" class="shrink-0 rounded-full bg-muted px-3 py-2 text-xs font-medium" data-pda-warehouse-action="cancel-wool-return">返回仓管</button>
      </section>

      <section class="space-y-3">
        <div>
          <div class="text-sm font-semibold text-foreground">回收来源</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">${escapeHtml(sourceText)}</div>
        </div>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">关联毛织加工单（可选）</span>
          <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wool-return-selected-order">
            <option value="">不关联加工单</option>
            ${options.map((order) => `
              <option value="${escapeAttr(order.woolOrderId)}" ${order.woolOrderId === state.woolReturnSelectedOrderId ? 'selected' : ''}>
                ${escapeHtml(`${order.woolOrderNo} / ${order.productionOrderNo} / ${order.yarnSku}`)}
              </option>
            `).join('')}
          </select>
        </label>
        <div class="rounded-2xl bg-muted/50 px-4 py-3 text-xs leading-5 text-muted-foreground">
          <div class="font-semibold text-foreground">${escapeHtml(yarnText)}</div>
          <div class="mt-1">可回收参考：损耗 ${escapeHtml(String(options.find((item) => item.woolOrderId === (activeOrder?.woolOrderId || ''))?.lossWeightKg || 0))} kg / 已回收 ${escapeHtml(String(options.find((item) => item.woolOrderId === (activeOrder?.woolOrderId || ''))?.recoveredWeightKg || 0))} kg</div>
        </div>
      </section>

      <section class="space-y-3">
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">回收重量（kg）</span>
          <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(state.woolReturnQty)}" data-pda-warehouse-field="wool-return-qty" />
        </label>
        <button type="button" class="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="confirm-wool-return">确认回收入仓</button>
      </section>
    </div>
  `
}

function renderWoolWaitProcessPage(): string {
  const activeAction = getWoolWaitProcessAction(getMobileWarehouseSearchParams().get('action'))
  if (activeAction) {
    const title = activeAction === 'receive' ? '毛织领料入仓' : activeAction === 'issue' ? '毛织加工领料' : '毛织回收入仓'
    return renderPdaFrame(renderWoolWaitProcessActionPage(activeAction), 'warehouse', { headerTitle: title, disableTodoAutoOpen: true })
  }
  if (state.woolReturnSourceOrderId) {
    return renderPdaFrame(renderWoolReturnDraftPage(), 'warehouse', { headerTitle: '毛织回收入仓', disableTodoAutoOpen: true })
  }
  const inventory = listWoolWarehouseInventory('wait-process')
  const receipts = listWoolWaitProcessReceiptRecords()
  const usage = listWoolWaitProcessUsageRecords()
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="grid grid-cols-2 gap-2">
        <button type="button" class="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground" data-nav="/fcs/pda/warehouse/wait-process">待加工仓</button>
        <button type="button" class="rounded-2xl border bg-background px-4 py-3 text-sm font-medium" data-nav="/fcs/pda/warehouse/wait-handover">待交出仓</button>
      </section>
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <div class="text-base font-semibold">毛织待加工仓</div>
        <div class="mt-1 text-xs text-muted-foreground">库存对象为纱线，开工领用和缝盘损耗扣减，损耗回收后回收入仓。</div>
        <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${inventory.length}</div><div class="text-muted-foreground">库存</div></div>
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${receipts.length}</div><div class="text-muted-foreground">领料</div></div>
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${usage.length}</div><div class="text-muted-foreground">用料</div></div>
        </div>
      </section>
      ${renderWoolWaitProcessActionCards()}
      <section class="space-y-3">
        ${inventory.map((item) => `
          <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-sm font-semibold">${escapeHtml(item.yarnSku || item.itemName)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.itemName)} · ${escapeHtml(item.itemSpec)}</div>
              </div>
              ${renderStatusPill(item.statusText)}
            </div>
            <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <div>关联毛织单：${escapeHtml(item.woolOrderNo)}</div>
              <div>来源生产单：${escapeHtml(item.productionOrderNo)}</div>
              <div>当前库存：${item.currentQty} ${escapeHtml(item.unit)}</div>
              <div>库区库位：${escapeHtml(item.locationText)}</div>
              <div>流水：${item.flowRecords.map((flow) => `${flow.flowType}${flow.qty}${flow.unit}`).join(' / ') || '-'}</div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveTaskRoute(item.taskNo))}">查看任务</button>
              <button
                type="button"
                class="rounded-full border border-emerald-200 px-3 py-1.5 text-xs text-emerald-700"
                data-pda-warehouse-action="recover-wool-yarn"
                data-wool-order-id="${escapeAttr(item.woolOrderId)}"
                data-related-order-nos="${escapeAttr((item.relatedOrderNos || [item.woolOrderNo]).join('|'))}"
              >回收入仓</button>
            </div>
          </article>
        `).join('')}
      </section>
    </div>
  `
  return renderPdaFrame(content, 'warehouse', { headerTitle: '毛织待加工仓', disableTodoAutoOpen: true })
}

export function renderPdaWarehouseWaitProcessPage(): string {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return renderPdaFrame(renderMobilePageEmptyState('未登录', '请先登录工厂端移动应用。'), 'warehouse', { disableTodoAutoOpen: true })
  if (getMobileWarehouseSearchParams().get('scope') === 'cutting') return renderCuttingWaitProcessPage()
  if (runtime.factoryId === FULL_CAPABILITY_FACTORY_ID) return renderPostFinishingWaitProcessPage()
  if (runtime.factoryId === OWN_WOOL_FACTORY_ID) return renderWoolWaitProcessPage()
  if (isCraftWarehouseRuntime()) return renderAuxiliaryWaitProcessPage()

  const rows = getRows()
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderWarehouseSummaryHeader('待加工仓', '中转仓领料确认后进入待加工仓，并承接入库记录。', runtime.overview)}
      ${renderSectionFilterChips(state.status, FILTERS, 'wait-process-status')}
      <section class="space-y-3">
        ${
          rows.length > 0
            ? rows
                .map(
                  (row) => `
                    <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0 flex-1">
                          <div class="text-sm font-semibold text-foreground">${escapeHtml(row.sourceRecordNo)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.sourceObjectName)} · ${escapeHtml(row.taskNo || row.productionOrderNo || '-')}</div>
                        </div>
                        ${renderStatusPill(row.status)}
                      </div>
                      <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
                        <div>物料 / 裁片类型：${escapeHtml(`${row.itemKind} / ${row.itemName}`)}</div>
                        <div>来源动作：${escapeHtml(getWaitProcessSourceActionLabel(row))}</div>
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
                        <div>入库记录：${escapeHtml(resolveWarehouseInboundRecordRoute(row.sourceRecordId).includes('recordId=') ? '已生成' : '未入库')}</div>
                        <div>来源状态：${escapeHtml(getWaitProcessSourceStatusLabel(row))}</div>
                        <div>应收数量 / 实收数量：${row.expectedQty} / ${row.receivedQty} ${escapeHtml(row.unit)}</div>
                        <div>差异数量：${escapeHtml(buildWarehouseDifferenceText(row.differenceQty))}</div>
                        <div>库区 / 货架 / 库位：${escapeHtml(row.areaName)} / ${escapeHtml(row.shelfNo)} / ${escapeHtml(row.locationNo)}</div>
                        <div>接收时间：${escapeHtml(formatWarehouseDateTime(row.receivedAt))}</div>
                      </div>
                      <div class="mt-4 flex flex-wrap gap-2">
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-process-detail" data-stock-item-id="${escapeAttr(row.stockItemId)}">查看</button>
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-process-location" data-stock-item-id="${escapeAttr(row.stockItemId)}">调整位置</button>
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveWarehouseInboundRecordRoute(row.sourceRecordId))}">查看入库</button>
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveWaitProcessSourceRoute(row))}">查看来源</button>
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveTaskRoute(row.taskId))}">查看任务</button>
                        ${
                          row.status === '差异待处理'
                            ? `<button type="button" class="rounded-full border border-destructive/30 px-3 py-1.5 text-xs text-destructive" data-pda-warehouse-action="open-wait-process-detail" data-stock-item-id="${escapeAttr(row.stockItemId)}">处理差异</button>`
                            : ''
                        }
                      </div>
                    </article>
                  `,
                )
                .join('')
            : renderMobilePageEmptyState('暂无待加工仓记录', '中转仓领料确认后，会自动生成入库记录并进入待加工仓。')
        }
      </section>
      ${renderDetailDrawer()}
      ${renderLocationDialog()}
    </div>
  `

  return renderPdaFrame(content, 'warehouse', { headerTitle: '待加工仓', disableTodoAutoOpen: true })
}

export function handlePdaWarehouseWaitProcessEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pda-warehouse-action]')
  const action = actionNode?.dataset.pdaWarehouseAction
  if (action === 'cutting-wp-pickup') {
    const sourceNo = actionNode?.dataset.sourceNo
    const prepRecordId = actionNode?.dataset.prepRecordId
    const prepLineId = actionNode?.dataset.prepLineId
    if (!sourceNo) {
      window.location.href = '/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup'
      return true
    }
    openCuttingPickupDraft(sourceNo, prepRecordId, prepLineId)
    return true
  }
  if (action === 'cancel-cutting-wp-pickup') {
    clearCuttingPickupDraft()
    return true
  }
  if (action === 'confirm-cutting-wp-pickup') {
    const sourceNo = state.cuttingPickupSourceNo.trim()
    if (!sourceNo) {
      window.alert('请先选择中转仓领料裁片任务。')
      return true
    }
    const row = findCuttingWaitProcessLedgerRow(sourceNo)
    const qty = Number(state.cuttingPickupQty)
    const rollCount = Number(state.cuttingPickupRollCount)
    if (!Number.isFinite(qty) || qty <= 0) {
      window.alert('请输入大于 0 的领料数量。')
      return true
    }
    if (!Number.isFinite(rollCount) || rollCount <= 0) {
      window.alert('请输入大于 0 的卷数。')
      return true
    }
    const warehouseArea = state.cuttingPickupWarehouseArea || '面料 A 区'
    const locationCode = state.cuttingPickupLocationCode || 'FAB-A-01'
    if (!warehouseArea || !locationCode) {
      window.alert('请选择入库库区和库位。')
      return true
    }
    const occurredAt = getCuttingRuntimeNowText()
    const rollNos = buildCuttingRollNos(sourceNo, rollCount)
    const prepContext = state.cuttingPickupPrepRecordId ? getMaterialPrepRecordContext(state.cuttingPickupPrepRecordId, state.cuttingPickupPrepLineId) : null
    const inventoryEffect: RuntimeInventoryEffect = {
      inventoryScope: '裁床待加工仓',
      direction: 'IN',
      qty,
      unit: 'yard',
      rollCount,
      toWarehouseArea: warehouseArea,
      toLocationCode: locationCode,
    }
    appendCuttingRuntimeEvent({
      eventType: '中转仓领料',
      operatorName: '裁床仓管',
      operatorRole: 'PDA 仓管',
      occurredAt,
      refs: buildCuttingRuntimeRefs(row, sourceNo),
      material: buildCuttingRuntimeMaterialSnapshot(row, sourceNo),
      pattern: buildCuttingRuntimePatternSnapshot(row),
      inventoryEffect,
      payload: {
        pickupRecordId: prepContext ? `pickup:${prepContext.record.prepRecordId}:${prepContext.item.prepLineId}:${occurredAt}` : `pickup:${sourceNo}:${occurredAt}`,
        pickupRecordNo: `领料-${sourceNo}`,
        prepNoticeId: prepContext?.record.prepRecordId || `prep:${sourceNo}`,
        prepOrderNo: prepContext?.projection.order.prepOrderNo || sourceNo,
        prepOrderId: prepContext?.projection.order.prepOrderId,
        prepLineId: prepContext?.line.prepLineId,
        prepRecordId: prepContext?.record.prepRecordId,
        pickupQty: qty,
        unit: 'yard',
        rollCount,
        rollNos,
        warehouseArea,
        locationCode,
        pickupBy: '裁床仓管',
        pickupAt: occurredAt,
        hasDifference: row ? qty !== row.transferWarehouseAllocatedQty : false,
        differenceReason: row && qty !== row.transferWarehouseAllocatedQty ? '现场按实领料' : '',
      },
    })
    clearCuttingPickupDraft()
    return true
  }
  if (action === 'cutting-wp-issue') {
    openCuttingIssueDraft(actionNode?.dataset.sourceNo)
    return true
  }
  if (action === 'cancel-cutting-wp-issue') {
    clearCuttingIssueDraft()
    return true
  }
  if (action === 'confirm-cutting-wp-issue') {
    const sourceNo = state.cuttingIssueSourceNo.trim()
    if (!sourceNo) {
      window.alert('请先扫码确认加工领料对象。')
      return true
    }
    const row = findCuttingWaitProcessLedgerRow(sourceNo)
    const issuedQty = Number(state.cuttingIssueQty)
    const rollCount = Number(state.cuttingIssueRollCount)
    if (!Number.isFinite(issuedQty) || issuedQty <= 0) {
      window.alert('请输入大于 0 的领料数量。')
      return true
    }
    if (!Number.isFinite(rollCount) || rollCount <= 0) {
      window.alert('请输入大于 0 的卷数。')
      return true
    }
    const warehouseArea = state.cuttingIssueWarehouseArea || '面料 A 区'
    const locationCode = state.cuttingIssueLocationCode || 'FAB-A-01'
    const occurredAt = getCuttingRuntimeNowText()
    const inventoryEffect: RuntimeInventoryEffect = {
      inventoryScope: '裁床待加工仓',
      direction: 'OUT',
      qty: issuedQty,
      unit: 'yard',
      rollCount,
      fromWarehouseArea: warehouseArea,
      fromLocationCode: locationCode,
    }
    appendCuttingRuntimeEvent({
      eventType: '待加工仓加工领料',
      operatorName: '裁床仓管',
      operatorRole: 'PDA 仓管',
      occurredAt,
      refs: buildCuttingRuntimeRefs(row, sourceNo),
      material: buildCuttingRuntimeMaterialSnapshot(row, sourceNo),
      pattern: buildCuttingRuntimePatternSnapshot(row),
      inventoryEffect,
      payload: {
        issueRecordId: `wp-out:${sourceNo}:${occurredAt}`,
        issueRecordNo: `加工领料-${sourceNo}`,
        spreadingOrderId: sourceNo,
        spreadingOrderNo: sourceNo,
        materialSku: row?.materialIdentity.materialSku || sourceNo,
        issuedQty,
        unit: 'yard',
        rollCount,
        rollNos: buildCuttingRollNos(sourceNo, rollCount),
        fromWarehouseArea: warehouseArea,
        fromLocationCode: locationCode,
        issuedBy: '裁床仓管',
        issuedAt: occurredAt,
        purpose: '铺布用料',
      },
    })
    clearCuttingIssueDraft()
    return true
  }
  if (action === 'cutting-wp-return') {
    openCuttingReturnDraft(actionNode?.dataset.sourceNo)
    return true
  }
  if (action === 'cancel-cutting-wp-return') {
    clearCuttingReturnDraft()
    return true
  }
  if (action === 'confirm-cutting-wp-return') {
    const selectedDocument = state.cuttingReturnRelatedDocNo
      ? listCuttingReturnDocumentOptions().find((item) => item.docNo === state.cuttingReturnRelatedDocNo)
      : undefined
    const sourceNo = selectedDocument?.docNo || state.cuttingReturnSourceNo.trim()
    if (!sourceNo) {
      window.alert('请先选择回收对象。')
      return true
    }
    const row = selectedDocument
      ? findCuttingLedgerRowByReturnDocument(selectedDocument.docNo)
      : findCuttingWaitProcessLedgerRow(sourceNo)
    const returnedQty = Number(state.cuttingReturnQty)
    const rollCount = Number(state.cuttingReturnRollCount)
    if (!Number.isFinite(returnedQty) || returnedQty <= 0) {
      window.alert('请输入大于 0 的回收数量。')
      return true
    }
    if (!Number.isFinite(rollCount) || rollCount <= 0) {
      window.alert('请输入大于 0 的卷数。')
      return true
    }
    const warehouseArea = state.cuttingReturnWarehouseArea || '面料 A 区'
    const locationCode = state.cuttingReturnLocationCode || 'FAB-A-02'
    const occurredAt = getCuttingRuntimeNowText()
    const inventoryEffect: RuntimeInventoryEffect = {
      inventoryScope: '裁床待加工仓',
      direction: 'IN',
      qty: returnedQty,
      unit: 'yard',
      rollCount,
      toWarehouseArea: warehouseArea,
      toLocationCode: locationCode,
    }
    appendCuttingRuntimeEvent({
      eventType: '待加工仓回收入仓',
      operatorName: '裁床仓管',
      operatorRole: 'PDA 仓管',
      occurredAt,
      refs: buildCuttingRuntimeRefs(row, sourceNo),
      material: buildCuttingRuntimeMaterialSnapshot(row, sourceNo),
      pattern: buildCuttingRuntimePatternSnapshot(row),
      inventoryEffect,
      payload: {
        returnRecordId: `wp-return:${sourceNo}:${occurredAt}`,
        returnRecordNo: `回收-${sourceNo}`,
        spreadingOrderId: selectedDocument?.docId || (sourceNo.startsWith('PB-') ? sourceNo : ''),
        spreadingOrderNo: selectedDocument?.docNo || (sourceNo.startsWith('PB-') ? sourceNo : ''),
        materialSku: row?.materialIdentity.materialSku || sourceNo,
        returnedQty,
        unit: 'yard',
        rollCount,
        rollNos: buildCuttingRollNos(sourceNo, rollCount),
        warehouseArea,
        locationCode,
        returnedBy: '裁床仓管',
        returnedAt: occurredAt,
        reason: '铺布剩余',
      },
    })
    clearCuttingReturnDraft()
    return true
  }
  if (action === 'recover-wool-yarn' && actionNode.dataset.woolOrderId) {
    openWoolReturnDraft(actionNode.dataset.woolOrderId)
    return true
  }
  if (action === 'cancel-wool-return') {
    clearWoolReturnDraft()
    return true
  }
  if (action === 'confirm-wool-return') {
    const orderId = state.woolReturnSelectedOrderId || state.woolReturnSourceOrderId
    const order = getWoolWorkOrderById(orderId)
    if (!order) {
      window.alert('未找到该毛织加工单，请重新选择来源毛织单。')
      return true
    }
    const recoveredWeightKg = Number(state.woolReturnQty.replace(/kg|公斤/g, '').trim())
    if (!Number.isFinite(recoveredWeightKg) || recoveredWeightKg <= 0) {
      window.alert('请输入大于 0 的重量。')
      return true
    }
    if (!state.woolReturnLocationId) {
      window.alert('请选择库区库位。')
      return true
    }
    recoverWoolYarnToWaitProcessWarehouse(order.woolOrderId, Math.round(recoveredWeightKg * 100) / 100, '工厂端仓管')
    clearWoolReturnDraft()
    state.woolReturnLocationId = ''
    return true
  }
  if (action === 'confirm-wool-receive') {
    const receipt = listWoolWaitProcessScanReceipts().find((item) => item.qrCode === state.woolReceiveScan || item.receiptNo === state.woolReceiveScan) || listWoolWaitProcessScanReceipts()[0]
    const line = receipt?.lines[0]
    const location = getWoolWaitProcessLocations().find((item) => item.locationId === state.woolReceiveLocationId) || getWoolWaitProcessLocations()[0]
    const qty = Number(state.woolReceiveQty)
    if (!receipt || !line) {
      window.alert('暂无可领料入仓的毛织领料单。')
      return true
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      window.alert('请输入大于 0 的实入重量。')
      return true
    }
    if (!location) {
      window.alert('请选择库区库位。')
      return true
    }
    confirmWoolWaitProcessScanReceipt({
      receiptNo: receipt.receiptNo,
      receiverName: 'PDA 毛织仓管',
      lines: [{
        receiptLineId: line.receiptLineId,
        actualWeightKg: Math.round(qty * 100) / 100,
        areaId: location.areaId,
        locationId: location.locationId,
        evidenceText: 'PDA 现场扫码确认领料入仓。',
      }],
    })
    state.woolReceiveScan = ''
    state.woolReceiveQty = ''
    state.woolReceiveLocationId = ''
    window.location.href = '/fcs/pda/warehouse/wait-process'
    return true
  }
  if (action === 'confirm-wool-issue') {
    const qty = Number(state.woolIssueQty)
    if (!state.woolIssueOrderId) {
      window.alert('请选择毛织加工单。')
      return true
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      window.alert('请输入大于 0 的领料重量。')
      return true
    }
    if (!state.woolIssueLocationId) {
      window.alert('请选择库区库位。')
      return true
    }
    ensureWoolOrderScheduledForPdaIssue(state.woolIssueOrderId, Math.round(qty * 100) / 100)
    state.woolIssueOrderId = ''
    state.woolIssueQty = ''
    state.woolIssueLocationId = ''
    window.location.href = '/fcs/pda/warehouse/wait-process'
    return true
  }
  if (action === 'confirm-auxiliary-receive' || action === 'confirm-auxiliary-issue' || action === 'confirm-auxiliary-return') {
    const actionKey: AuxiliaryWaitProcessAction = action === 'confirm-auxiliary-receive'
      ? 'receive'
      : action === 'confirm-auxiliary-issue'
        ? 'issue'
        : 'return'
    const scanValue = actionKey === 'receive'
      ? state.auxiliaryReceiveScan
      : actionKey === 'issue'
        ? state.auxiliaryIssueScan
        : state.auxiliaryReturnScan
    const qtyValue = Number(actionKey === 'receive'
      ? state.auxiliaryReceiveQty
      : actionKey === 'issue'
        ? state.auxiliaryIssueQty
        : state.auxiliaryReturnQty)
    const areaValue = actionKey === 'receive'
      ? state.auxiliaryReceiveArea
      : actionKey === 'issue'
        ? state.auxiliaryIssueArea
        : state.auxiliaryReturnArea
    const locationValue = actionKey === 'receive'
      ? state.auxiliaryReceiveLocation
      : actionKey === 'issue'
        ? state.auxiliaryIssueLocation
        : state.auxiliaryReturnLocation
    if (!scanValue.trim()) {
      window.alert('请先扫码或输入单号。')
      return true
    }
    if (!Number.isFinite(qtyValue) || qtyValue <= 0) {
      window.alert('请输入大于 0 的数量。')
      return true
    }
    if (!areaValue || !locationValue) {
      window.alert('请选择库区库位。')
      return true
    }
    const actionLabel = actionKey === 'receive' ? '接收入仓' : actionKey === 'issue' ? '加工领料' : '回收入仓'
    window.alert(`${actionLabel}已记录为演示数据。`)
    window.location.href = '/fcs/pda/warehouse/wait-process'
    return true
  }
  if (action === 'open-wait-process-detail' && actionNode.dataset.stockItemId) {
    state.detailId = actionNode.dataset.stockItemId
    return true
  }
  if (action === 'close-wait-process-detail') {
    state.detailId = null
    return true
  }
  if (action === 'open-wait-process-location' && actionNode.dataset.stockItemId) {
    openLocationEditor(actionNode.dataset.stockItemId)
    return true
  }
  if (action === 'close-wait-process-location') {
    state.locationEditId = null
    return true
  }
  if (action === 'save-wait-process-location' && state.locationEditId) {
    updateWaitProcessStockLocation(state.locationEditId, {
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

  if (field === 'wait-process-status') {
    state.status = value as WaitProcessFilter
    return true
  }
  if (field === 'wait-process-area') {
    state.areaName = value
    state.shelfNo = ''
    state.locationNo = ''
    return true
  }
  if (field === 'wait-process-shelf') {
    state.shelfNo = value
    state.locationNo = ''
    return true
  }
  if (field === 'wait-process-location') {
    state.locationNo = value
    return true
  }
  if (field === 'wait-process-remark') {
    state.remark = value
    return true
  }
  if (field === 'cutting-pickup-area') {
    state.cuttingPickupWarehouseArea = value
    const nextArea = CUTTING_RECEIVE_LOCATIONS.find((item) => item.area === value)
    state.cuttingPickupLocationCode = nextArea?.locations[0] || ''
    return true
  }
  if (field === 'cutting-pickup-location') {
    state.cuttingPickupLocationCode = value
    return true
  }
  if (field === 'cutting-pickup-qty') {
    state.cuttingPickupQty = value
    return true
  }
  if (field === 'cutting-pickup-roll-count') {
    state.cuttingPickupRollCount = value
    return true
  }
  if (field === 'cutting-issue-area') {
    state.cuttingIssueWarehouseArea = value
    const nextArea = CUTTING_RECEIVE_LOCATIONS.find((item) => item.area === value)
    state.cuttingIssueLocationCode = nextArea?.locations[0] || ''
    return true
  }
  if (field === 'cutting-issue-location') {
    state.cuttingIssueLocationCode = value
    return true
  }
  if (field === 'cutting-issue-qty') {
    state.cuttingIssueQty = value
    return true
  }
  if (field === 'cutting-issue-roll-count') {
    state.cuttingIssueRollCount = value
    return true
  }
  if (field === 'cutting-return-related-doc') {
    state.cuttingReturnRelatedDocNo = value
    const row = value ? findCuttingLedgerRowByReturnDocument(value) : findCuttingWaitProcessLedgerRow(state.cuttingReturnSourceNo)
    if (row) state.cuttingReturnSourceNo = row.cutOrderNo
    return true
  }
  if (field === 'cutting-return-area') {
    state.cuttingReturnWarehouseArea = value
    const nextArea = CUTTING_RECEIVE_LOCATIONS.find((item) => item.area === value)
    state.cuttingReturnLocationCode = nextArea?.locations[0] || ''
    return true
  }
  if (field === 'cutting-return-location') {
    state.cuttingReturnLocationCode = value
    return true
  }
  if (field === 'cutting-return-qty') {
    state.cuttingReturnQty = value
    return true
  }
  if (field === 'cutting-return-roll-count') {
    state.cuttingReturnRollCount = value
    return true
  }
  if (field === 'wool-return-selected-order') {
    state.woolReturnSelectedOrderId = value
    const selectedOrder = value ? getWoolWorkOrderById(value) : getWoolWorkOrderById(state.woolReturnSourceOrderId)
    if (selectedOrder) {
      const usage = getWoolYarnUsageSummary(selectedOrder)
      state.woolReturnQty = String(Math.round(Math.max(usage.linkingLossWeightKg - usage.recoveredWeightKg, 0.1) * 100) / 100)
    }
    return true
  }
  if (field === 'wool-return-qty') {
    state.woolReturnQty = value
    return true
  }
  if (field === 'wool-return-location') {
    state.woolReturnLocationId = value
    return true
  }
  if (field === 'wool-receive-scan') {
    state.woolReceiveScan = value
    return true
  }
  if (field === 'wool-receive-qty') {
    state.woolReceiveQty = value
    return true
  }
  if (field === 'wool-receive-location') {
    state.woolReceiveLocationId = value
    return true
  }
  if (field === 'wool-issue-order') {
    state.woolIssueOrderId = value
    const order = getWoolWorkOrderById(value)
    if (order) {
      const usage = getWoolYarnUsageSummary(order)
      state.woolIssueQty = String(Math.round((usage.processingUsageWeightKg || order.yarnReceipt.receivedWeightKg || order.yarnReceipt.plannedWeightKg) * 100) / 100)
    }
    return true
  }
  if (field === 'wool-issue-qty') {
    state.woolIssueQty = value
    return true
  }
  if (field === 'wool-issue-location') {
    state.woolIssueLocationId = value
    return true
  }
  if (field === 'auxiliary-receive-scan') {
    state.auxiliaryReceiveScan = value
    return true
  }
  if (field === 'auxiliary-receive-qty') {
    state.auxiliaryReceiveQty = value
    return true
  }
  if (field === 'auxiliary-receive-area') {
    updateAuxiliaryWaitProcessArea('receive', value)
    return true
  }
  if (field === 'auxiliary-receive-shelf') {
    updateAuxiliaryWaitProcessShelf('receive', value)
    return true
  }
  if (field === 'auxiliary-receive-location') {
    updateAuxiliaryWaitProcessLocation('receive', value)
    return true
  }
  if (field === 'auxiliary-issue-scan') {
    state.auxiliaryIssueScan = value
    return true
  }
  if (field === 'auxiliary-issue-qty') {
    state.auxiliaryIssueQty = value
    return true
  }
  if (field === 'auxiliary-issue-area') {
    updateAuxiliaryWaitProcessArea('issue', value)
    return true
  }
  if (field === 'auxiliary-issue-shelf') {
    updateAuxiliaryWaitProcessShelf('issue', value)
    return true
  }
  if (field === 'auxiliary-issue-location') {
    updateAuxiliaryWaitProcessLocation('issue', value)
    return true
  }
  if (field === 'auxiliary-return-scan') {
    state.auxiliaryReturnScan = value
    return true
  }
  if (field === 'auxiliary-return-qty') {
    state.auxiliaryReturnQty = value
    return true
  }
  if (field === 'auxiliary-return-area') {
    updateAuxiliaryWaitProcessArea('return', value)
    return true
  }
  if (field === 'auxiliary-return-shelf') {
    updateAuxiliaryWaitProcessShelf('return', value)
    return true
  }
  if (field === 'auxiliary-return-location') {
    updateAuxiliaryWaitProcessLocation('return', value)
    return true
  }

  return false
}
