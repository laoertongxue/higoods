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
  confirmPostFinishingSewingSelfReturnWarehouseRecord,
  getPostFinishingWaitProcessReceiptConfirmStatus,
  listPostFinishingWaitProcessWarehouseRecords,
} from '../data/fcs/post-finishing-domain.ts'
import {
  addWoolYarnReceipt,
  adjustWoolWarehouseStock,
  getWoolWorkOrderById,
  issueWoolYarn,
  listWoolWarehouseStocks,
  listWoolWorkOrders,
  returnWoolYarn,
} from '../data/fcs/wool-task-domain.ts'
import { formatIndonesiaBusinessDateTime } from '../data/fcs/indonesia-business-time.ts'
import {
  listMaterialLedgerProjections,
  type MaterialLedgerProjection,
} from '../data/fcs/cutting/material-ledger.ts'
import {
  getPickupSessionByNodeId,
  getMaterialPrepRecordContext,
  listMaterialPrepOrderProjections,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  recordPickupSessionWarehouseSyncResult,
  updatePickupSessionStorageFootprint,
} from '../data/fcs/cutting/production-material-prep.ts'
import {
  confirmPickupNodeReceiptRuntime,
  listActivePickupNodesRuntime as listActivePickupNodes,
  recoverPendingPickupWarehouseTransaction,
  syncCuttingPickupSessionWarehouseFactsRuntime,
} from '../runtime/fcs/cutting/pickup-management-runtime.ts'
import {
  getBrowserLocalStorage,
} from '../data/browser-storage.ts'
import type { PickupNodeProjection, PickupSession } from '../data/fcs/cutting/pickup-node-domain.ts'
import {
  assertPickupNodeHasNoOpenDiscrepancy,
  listPickupDiscrepancies,
  reportPickupDiscrepancy,
  requestPickupDiscrepancySupervisor,
} from '../data/fcs/cutting/pickup-discrepancy.ts'
import { buildMarkerSpreadingProjection } from './process-factory/cutting/marker-spreading-projection.ts'
import type { SpreadingOrder } from './process-factory/cutting/marker-spreading-model.ts'
import {
  appendCuttingRuntimeEvent,
  CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY,
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
import { executeSpecialCraftWaitProcessIssue } from '../data/fcs/special-craft-pda-warehouse-actions.ts'
import {
  handleWarehouseLocationMapOccupancyEvent,
  renderWarehouseLocationMap,
} from '../components/ui/warehouse-location-map.ts'
import {
  buildWarehouseLocationMapProjection,
  listStableWarehouseLocationRefs,
  listWarehouseLocationMapCells,
  revalidateWarehouseLocationSelection,
  resolveStableWarehouseLocationRef,
  toggleWarehouseLocationSelection,
  type StableWarehouseLocationRef,
  type WarehouseLocationMapCell,
  type WarehouseLocationMapProjection,
  type WarehouseLocationOccupancy,
} from './process-factory/cutting/warehouse-location-map-model.ts'
import { loadWarehouseLayoutSnapshot } from './process-factory/cutting/warehouse-location-layout-store.ts'
import { buildWaitProcessRuntimeOccupancies } from './process-factory/cutting/warehouse-location-map.ts'

type WaitProcessFilter = '全部' | '待接收' | '已入待加工仓' | '差异待处理'

export function revalidatePdaCuttingFootprintAdjustmentSelection(
  projection: WarehouseLocationMapProjection,
  selectedLocationIds: string[],
) {
  return revalidateWarehouseLocationSelection(projection, selectedLocationIds)
}

interface WaitProcessState {
  status: WaitProcessFilter
  detailId: string | null
  locationEditId: string | null
  areaName: string
  shelfNo: string
  locationNo: string
  remark: string
  cuttingPickupSourceNo: string
  cuttingPickupNodeId: string
  cuttingPickupNodeVersion: string
  cuttingPickupWarehouseArea: string
  cuttingPickupLocationCode: string
  cuttingPickupLocationIds: string[]
  cuttingAdjustFootprintSessionId: string
  cuttingAdjustFootprintLocationIds: string[]
  cuttingAdjustRemainingByUnit: Record<string, string>
  cuttingAdjustFootprintFingerprint: string
  cuttingPickupDifferenceOpen: boolean
  cuttingPickupDifferenceDemandLineId: string
  cuttingPickupDifferenceQty: string
  cuttingPickupDifferenceNote: string
  cuttingPickupDifferencePhotoName: string
  cuttingIssueSourceNo: string
  cuttingIssuePickupSessionId: string
  cuttingIssueWarehouseArea: string
  cuttingIssueLocationCode: string
  cuttingIssueQty: string
  cuttingIssueRollCount: string
  cuttingReturnSourceNo: string
  cuttingReturnRelatedDocNo: string
  cuttingReturnLocationIds: string[]
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
  woolReceiveCommandId: string
  woolIssueCommandId: string
  woolReturnCommandId: string
  woolAdjustCommandId: string
  postFinishingConfirmRecordId: string | null
  postFinishingConfirmQty: string
  postFinishingConfirmRemark: string
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
  cuttingPickupNodeId: '',
  cuttingPickupNodeVersion: '',
  cuttingPickupWarehouseArea: '',
  cuttingPickupLocationCode: '',
  cuttingPickupLocationIds: [],
  cuttingAdjustFootprintSessionId: '',
  cuttingAdjustFootprintLocationIds: [],
  cuttingAdjustRemainingByUnit: {},
  cuttingAdjustFootprintFingerprint: '',
  cuttingPickupDifferenceOpen: false,
  cuttingPickupDifferenceDemandLineId: '',
  cuttingPickupDifferenceQty: '',
  cuttingPickupDifferenceNote: '',
  cuttingPickupDifferencePhotoName: '',
  cuttingIssueSourceNo: '',
  cuttingIssuePickupSessionId: '',
  cuttingIssueWarehouseArea: '',
  cuttingIssueLocationCode: '',
  cuttingIssueQty: '',
  cuttingIssueRollCount: '',
  cuttingReturnSourceNo: '',
  cuttingReturnRelatedDocNo: '',
  cuttingReturnLocationIds: [],
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
  woolReceiveCommandId: '',
  woolIssueCommandId: '',
  woolReturnCommandId: '',
  woolAdjustCommandId: '',
  postFinishingConfirmRecordId: null,
  postFinishingConfirmQty: '',
  postFinishingConfirmRemark: '',
}

let cuttingPickupNodeSnapshot: PickupNodeProjection | null = null

const FILTERS: Array<{ value: WaitProcessFilter; label: string }> = [
  { value: '全部', label: '全部' },
  { value: '待接收', label: '中转仓接收' },
  { value: '已入待加工仓', label: '已入待加工仓' },
  { value: '差异待处理', label: '差异待处理' },
]

function listCuttingReceiveLocations(): Array<{ area: string; locations: string[] }> {
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_PROCESS')
  if (!warehouse) return []
  const { snapshot } = loadWarehouseLayoutSnapshot(warehouse)
  const byArea = new Map<string, string[]>()
  listStableWarehouseLocationRefs(warehouse, snapshot)
    .filter((location) => location.status === 'AVAILABLE')
    .forEach((location) => {
      const values = byArea.get(location.areaName) ?? []
      values.push(location.locationNo)
      byArea.set(location.areaName, values)
    })
  return Array.from(byArea, ([area, locations]) => ({ area, locations }))
}

function resolveCurrentWaitProcessLocationRef(areaName: string, locationNo: string) {
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_PROCESS')
  if (!warehouse) return null
  const { snapshot } = loadWarehouseLayoutSnapshot(warehouse)
  return resolveStableWarehouseLocationRef(warehouse, { areaName, locationNo }, snapshot)
}

type AuxiliaryWaitProcessAction = 'receive' | 'issue' | 'return'
type WoolWaitProcessAction = 'receive' | 'issue' | 'return' | 'adjust'

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
    .filter((item) => item.status !== '已领用')
    .filter((item) => (ignoreStatus || state.status === '全部' ? true : item.status === state.status))
}

function getAuxiliaryWaitProcessAction(value?: string | null): AuxiliaryWaitProcessAction | null {
  return value === 'receive' || value === 'issue' || value === 'return' ? value : null
}

function renderGarmentWaitProcessCard(row: FactoryWaitProcessStockItem): string {
  const taskRows = listFactoryWaitProcessStockItems().filter((item) => item.taskId === row.taskId && item.itemKind === '成衣')
  const issuedSkuCount = taskRows.filter((item) => item.status === '已领用').length
  return `
    <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm" data-garment-sku-card="wait-process">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="text-sm font-semibold text-foreground">${escapeHtml(row.productionOrderNo || '-')}</div>
          <div class="mt-1 text-xs text-muted-foreground">SKU：${escapeHtml(row.materialSku || '-')} · ${escapeHtml(row.fabricColor || '-')} / ${escapeHtml(row.sizeCode || '-')}</div>
        </div>
        ${renderStatusPill(row.status)}
      </div>
      <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <div>来源仓：${escapeHtml(row.sourceObjectName || '成衣仓')}</div>
        <div>应收 / 实收件数：${row.expectedQty} / ${row.receivedQty} 件</div>
        <div>当前仓：${escapeHtml(row.warehouseName)} · ${escapeHtml(row.locationText)}</div>
        <div>本单领用进度：${issuedSkuCount} / ${taskRows.length} SKU</div>
        <div>下一动作：加工接收</div>
      </div>
      <div class="mt-4 flex gap-2">
        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-fast-page-render data-pda-warehouse-action="open-wait-process-detail" data-stock-item-id="${escapeAttr(row.stockItemId)}">查看</button>
        <button type="button" class="rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground" data-pda-warehouse-action="special-craft-wait-process-issue" data-stock-item-id="${escapeAttr(row.stockItemId)}" data-task-order-id="${escapeAttr(row.taskId || '')}" data-sku-code="${escapeAttr(row.materialSku || '')}">加工接收</button>
      </div>
    </article>
  `
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
    { key: 'issue', title: '加工接收', desc: '从待加工仓领出给工序使用。' },
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
  const title = action === 'receive' ? '接收入仓' : action === 'issue' ? '加工接收' : '回收入仓'
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
  const qtyLabel = action === 'receive' ? '接收数量' : action === 'issue' ? '接收数量' : '回收数量'
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
    const title = activeAction === 'receive' ? '接收入仓' : activeAction === 'issue' ? '加工接收' : '回收入仓'
    return renderPdaFrame(renderAuxiliaryWaitProcessActionPage(activeAction), 'warehouse', { headerTitle: title, disableTodoAutoOpen: true })
  }
  const runtime = getMobileWarehouseRuntimeContext()
  const runtimeLabel = getCraftWarehouseRuntimeLabel() || '工艺'
  const rows = getAuxiliaryWaitProcessRows()
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${runtime ? renderWarehouseSummaryHeader(`${runtimeLabel}待加工仓`, '接收入仓后进入待加工仓，加工接收扣减，退回物走回收入仓。', runtime.overview) : ''}
      ${renderAuxiliaryWaitProcessActionCards()}
      ${renderSectionFilterChips(state.status, FILTERS, 'wait-process-status')}
      <section class="space-y-3">
        ${
          rows.length > 0
            ? rows.map((row) => {
              const isGarment = row.itemKind === '成衣'
              if (isGarment) return renderGarmentWaitProcessCard(row)
              return `
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
                  ${isGarment
                    ? `<div>来源仓：${escapeHtml(row.sourceObjectName || '成衣仓')}</div>`
                    : `<div>菲票 / 中转袋：${escapeHtml(row.feiTicketNo || '-')} / ${escapeHtml(row.transferBagNo || '-')}</div>`}
                  <div>应收 / 实收：${row.expectedQty} / ${row.receivedQty} ${escapeHtml(row.unit)}</div>
                  <div>差异：${escapeHtml(buildWarehouseDifferenceText(row.differenceQty))}</div>
                  <div>库区 / 货架 / 库位：${escapeHtml(row.areaName)} / ${escapeHtml(row.shelfNo)} / ${escapeHtml(row.locationNo)}</div>
                  ${isGarment ? '' : `<div>接收时间：${escapeHtml(formatWarehouseDateTime(row.receivedAt))}</div>`}
                </div>
                <div class="mt-4 flex flex-wrap gap-2">
                  <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-process-detail" data-stock-item-id="${escapeAttr(row.stockItemId)}">查看</button>
                  <button type="button" class="rounded-full ${isGarment ? 'bg-primary text-primary-foreground' : 'border'} px-3 py-1.5 text-xs" data-nav="/fcs/pda/warehouse/wait-process?action=issue">加工接收</button>
                  ${isGarment ? '' : `
                    <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="/fcs/pda/warehouse/wait-process?action=return">回收入仓</button>
                    <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-process-location" data-stock-item-id="${escapeAttr(row.stockItemId)}">调整位置</button>
                  `}
                </div>
              </article>
            `}).join('')
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
  return formatIndonesiaBusinessDateTime().slice(0, 16)
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
  const fallback = listCuttingReceiveLocations()[0]
  return {
    warehouseArea: area || fallback?.area || '',
    locationCode: location || fallback?.locations[0] || '',
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
    ...listCuttingRuntimeEventsByType('中转仓接收'),
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
  if (event.eventType === '中转仓接收') return `中转仓接收：${runtimeString(payload.pickupRecordNo) || event.refs.cutOrderNo || event.eventNo}`
  if (event.eventType === '待加工仓扫码入仓') return `中转仓接收入库：${runtimeString(payload.inboundRecordNo) || event.refs.cutOrderNo || event.eventNo}`
  if (event.eventType === '待加工仓加工接收') return `加工接收：${runtimeString(payload.issueRecordNo) || event.refs.spreadingOrderNo || event.eventNo}`
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
  const latestIssue = findLatestCuttingRuntimeEvent(row, (event) => event.eventType === '待加工仓加工接收')
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
    ? `接收记录：${row.latestClaimEvent.occurredAt} / ${row.latestClaimEvent.operatorName}`
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
    listCuttingRuntimeEventsByType('中转仓接收')
      .map((event) => event.refs.cutOrderNo)
      .filter(Boolean),
  )
  return rows
    .filter((row) => row.transferWarehouseAllocatedQty > 0)
    .filter((row) => !pickedCutOrders.has(row.cutOrderNo))
}

function renderCuttingPendingPickupList(rows: MaterialLedgerProjection[]): string {
  const nodes = listActivePickupNodes()
  return `
    <section class="space-y-2">
      <div class="space-y-2">
        ${nodes.length
          ? nodes.map((node) => `
              <button
                type="button"
                class="w-full rounded-2xl border bg-card px-4 py-4 text-left shadow-sm"
                data-pda-warehouse-action="cutting-wp-pickup"
                data-pickup-node-id="${escapeAttr(node.nodeId)}"
                data-pickup-node-version="${node.version}"
              >
                <div class="flex items-center gap-2">
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium ${node.nodeType === 'READY_TO_PICKUP' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">${escapeHtml(node.nodeType === 'READY_TO_PICKUP' ? '已配齐待领' : '未配齐清单')}</span>
                  <span class="text-xs text-muted-foreground">第 ${node.sequence} 轮</span>
                </div>
                <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(node.productionOrderNo)} / ${escapeHtml(node.prepOrderNo)}</div>
                <div class="mt-1 text-xs text-muted-foreground">物料：${node.itemCount} 项，当前位置：${escapeHtml(node.carrierType === 'PALLET'
                  ? node.palletDisplayLabel || node.palletId || '待领托盘（暂未编号）'
                  : Array.from(new Set(node.items.flatMap((item) => item.sourceLocations.map((location) => location.sourceLocationCode)))).join('、'))}</div>
                <div class="mt-2 space-y-1">
                  ${node.items.slice(0, 3).map((item) => `
                    <div class="rounded-lg bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                      ${escapeHtml(item.materialName)} / ${formatCuttingWaitProcessQty(item.currentAvailableQty, item.unit)}
                    </div>
                  `).join('')}
                  ${node.items.length > 3 ? `<div class="text-xs text-muted-foreground">还有 ${node.items.length - 3} 项...</div>` : ''}
                </div>
              </button>
            `).join('')
          : '<div class="rounded-xl bg-muted/60 px-3 py-3 text-xs text-muted-foreground">暂无中转仓接收通知。</div>'}
      </div>
    </section>
  `
}

function getCuttingWaitProcessActions() {
  return [
    { key: 'pickup', action: 'cutting-wp-pickup', title: '中转仓接收', desc: '按生产单待领节点核对全部实物，并确认入库库区库位。' },
    { key: 'issue', action: 'cutting-wp-issue', title: '加工接收', desc: '扫铺布单，从指定库区库位领走面料。' },
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

interface CuttingIssueSourceGroup {
  sourceKey: string
  cells: Array<{ cell: WarehouseLocationMapCell; occupancies: WarehouseLocationOccupancy[] }>
  sourceInboundEventIds: string[]
  sourcePickupSessionIds: string[]
  inboundAt: string
  remainingQty: number
  unit: string
}

function listCuttingIssueSourceGroups(row: MaterialLedgerProjection | null): CuttingIssueSourceGroup[] {
  if (!row) return []
  const projection = buildCuttingPickupMapProjection()
  if (!projection) return []
  const groups = new Map<string, CuttingIssueSourceGroup>()
  listWarehouseLocationMapCells(projection).forEach((cell) => {
    cell.occupancies
      .filter((occupancy) => occupancy.objectNo === row.materialIdentity.materialSku
        && (!row.productionOrderNo || occupancy.productionOrderNo === row.productionOrderNo))
      .forEach((occupancy) => {
        const sourceKey = occupancy.sourceSessionId || occupancy.sourceEventId
        if (!sourceKey) return
        const group = groups.get(sourceKey) || {
          sourceKey,
          cells: [],
          sourceInboundEventIds: [],
          sourcePickupSessionIds: [],
          inboundAt: '',
          remainingQty: 0,
          unit: occupancy.unit,
        }
        const cellEntry = group.cells.find((entry) => entry.cell.locationId === cell.locationId)
        if (cellEntry) cellEntry.occupancies.push(occupancy)
        else group.cells.push({ cell, occupancies: [occupancy] })
        if (occupancy.sourceEventId && !group.sourceInboundEventIds.includes(occupancy.sourceEventId)) {
          group.sourceInboundEventIds.push(occupancy.sourceEventId)
        }
        if (occupancy.sourceSessionId && !group.sourcePickupSessionIds.includes(occupancy.sourceSessionId)) {
          group.sourcePickupSessionIds.push(occupancy.sourceSessionId)
        }
        if (occupancy.inboundAt > group.inboundAt) group.inboundAt = occupancy.inboundAt
        group.remainingQty = Math.max(group.remainingQty, occupancy.qty)
        groups.set(sourceKey, group)
      })
  })
  return Array.from(groups.values()).sort((left, right) => right.inboundAt.localeCompare(left.inboundAt))
}

function renderCuttingWaitProcessSingleAction(activeAction: string, rows: MaterialLedgerProjection[]): string {
  const action = getCuttingWaitProcessActions().find((item) => item.key === activeAction)
  if (!action) return ''
  const row = activeAction === 'issue'
    ? findCuttingWaitProcessLedgerRow() || rows.find((item) => item.availableQty > 0) || getCuttingWaitProcessActionFallbackRow(rows)
    : null
  const sourceGroups = activeAction === 'issue' ? listCuttingIssueSourceGroups(row) : []
  return `
    <section class="space-y-3" ${activeAction === 'issue' ? `data-cutting-issue-start data-source-no="${escapeAttr(row?.cutOrderNo || '')}"` : ''}>
      ${sourceGroups.length > 1 ? `
        <label class="block space-y-1.5">
          <span class="text-sm font-semibold text-foreground">本次接收批次</span>
          <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-cutting-issue-batch>
            <option value="">请选择本次接收批次</option>
            ${sourceGroups.map((group) => `
              <option value="${escapeAttr(group.sourceKey)}">入仓 ${escapeHtml(formatWarehouseDateTime(group.inboundAt))} · 剩余 ${escapeHtml(formatCuttingWaitProcessQty(group.remainingQty, group.unit))} · 库位 ${escapeHtml(group.cells.map((entry) => entry.cell.locationNo).join('、'))}</option>
            `).join('')}
          </select>
        </label>
      ` : ''}
      <button
        type="button"
        class="min-h-11 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
        data-pda-warehouse-action="${escapeAttr(action.action)}"
      >
        开始${escapeHtml(action.title)}
      </button>
    </section>
  `
}

function getCuttingWaitProcessActionEventType(activeAction: string): string {
  if (activeAction === 'pickup') return '中转仓接收'
  if (activeAction === 'issue') return '待加工仓加工接收'
  if (activeAction === 'return') return '待加工仓回收入仓'
  return ''
}

function getCuttingWaitProcessActionResultTitle(activeAction: string): string {
  if (activeAction === 'pickup') return '中转仓接收后结果'
  if (activeAction === 'issue') return '加工接收后结果'
  if (activeAction === 'return') return '回收入仓后结果'
  return '操作后结果'
}

function getCuttingWaitProcessActionFallbackRow(rows: MaterialLedgerProjection[]): MaterialLedgerProjection | undefined {
  return listCuttingPendingPickupRows(rows)[0] || rows.find((row) => row.cuttingClaimedQty > 0) || rows[0]
}

function openCuttingPickupDraft(pickupNodeId: string, pickupNodeVersion: string): void {
  const nodes = listActivePickupNodes()
  const node = nodes.find((n) => n.nodeId === pickupNodeId)
  if (!node) {
    window.alert('当前节点已不存在，请重新选择。')
    return
  }
  if (String(node.version) !== pickupNodeVersion) {
    window.alert('当前待领物料已更新，请重新核对全部物料后再确认接收。')
    return
  }
  state.cuttingPickupNodeId = pickupNodeId
  state.cuttingPickupNodeVersion = pickupNodeVersion
  state.cuttingPickupSourceNo = node.productionOrderNo
  state.cuttingPickupWarehouseArea = ''
  state.cuttingPickupLocationCode = ''
  state.cuttingPickupLocationIds = []
  state.cuttingPickupDifferenceDemandLineId = node.items[0]?.prepLineId || ''
  state.cuttingPickupDifferenceQty = ''
  state.cuttingPickupDifferenceNote = ''
  state.cuttingPickupDifferencePhotoName = ''
  cuttingPickupNodeSnapshot = structuredClone(node)
}

function clearCuttingPickupDraft(): void {
  state.cuttingPickupSourceNo = ''
  state.cuttingPickupNodeId = ''
  state.cuttingPickupNodeVersion = ''
  state.cuttingPickupWarehouseArea = ''
  state.cuttingPickupLocationCode = ''
  state.cuttingPickupLocationIds = []
  state.cuttingPickupDifferenceOpen = false
  state.cuttingPickupDifferenceDemandLineId = ''
  state.cuttingPickupDifferenceQty = ''
  state.cuttingPickupDifferenceNote = ''
  state.cuttingPickupDifferencePhotoName = ''
  cuttingPickupNodeSnapshot = null
}

function buildCuttingPickupMapProjection(excludePickupSessionId?: string): WarehouseLocationMapProjection | null {
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_PROCESS')
  if (!warehouse) return null
  const { snapshot } = loadWarehouseLayoutSnapshot(warehouse)
  const occupancies: WarehouseLocationOccupancy[] = listFactoryWaitProcessStockItems()
    .filter((item) => item.warehouseId === warehouse.warehouseId)
    .filter((item) => Number(item.availableQty ?? item.receivedQty - Number(item.issuedQty || 0)) > 0)
    .map((item) => {
      const ref = resolveStableWarehouseLocationRef(warehouse, {
        areaName: item.areaName,
        shelfNo: item.shelfNo,
        locationNo: item.locationNo,
      }, snapshot)
      return {
        occupancyId: `wait-process:${item.stockItemId}`,
        footprintId: `wait-process:${item.sourceRecordId}`,
        locationId: ref?.locationId ?? `unresolved:${item.stockItemId}`,
        productionOrderNo: item.productionOrderNo || item.taskNo || '',
        objectNo: item.materialSku || item.sourceRecordNo,
        objectName: item.stockMaterialName || item.itemName,
        qty: Number(item.availableQty ?? item.receivedQty - Number(item.issuedQty || 0)),
        unit: item.unit,
        inboundAt: item.receivedAt,
        inboundBy: item.receiverName || '仓管员',
      }
    })
  const runtimeOccupancies = buildWaitProcessRuntimeOccupancies(
    warehouse,
    snapshot,
    listCuttingRuntimeEventsByInventoryScope('裁床待加工仓'),
    { excludePickupSessionId },
  )
  const runtimeKeys = new Set(runtimeOccupancies.map((item) =>
    `${item.productionOrderNo}:${item.objectNo}:${item.locationId}`))
  return buildWarehouseLocationMapProjection(
    warehouse,
    snapshot,
    [
      ...runtimeOccupancies,
      ...occupancies.filter((item) =>
        !runtimeKeys.has(`${item.productionOrderNo}:${item.objectNo}:${item.locationId}`)),
    ],
  )
}

function getSelectedCuttingPickupLocationRefs(
  projection: WarehouseLocationMapProjection,
  selectedLocationIds: string[] = state.cuttingPickupLocationIds,
): StableWarehouseLocationRef[] {
  const selected = new Set(selectedLocationIds)
  return listWarehouseLocationMapCells(projection)
    .filter((location) => selected.has(location.locationId))
}

function findPickupSessionById(pickupSessionId: string): PickupSession | null {
  return listMaterialPrepOrderProjections()
    .flatMap((projection) => projection.pickupSessions)
    .find((session) => session.pickupSessionId === pickupSessionId) ?? null
}

function openCuttingFootprintAdjustment(pickupSessionId: string): void {
  const session = findPickupSessionById(pickupSessionId)
  if (!session?.storageFootprint) {
    window.alert('当前接收记录没有可调整的存放库位。')
    return
  }
  state.cuttingAdjustFootprintSessionId = pickupSessionId
  state.cuttingAdjustFootprintLocationIds = [...session.storageFootprint.locationIds]
  state.cuttingAdjustRemainingByUnit = Object.fromEntries(
    session.storageFootprint.unitSummaries.map((summary) => [
      summary.unit,
      String(summary.remainingQty),
    ]),
  )
  state.cuttingAdjustFootprintFingerprint = JSON.stringify(session.storageFootprint)
}

function clearCuttingFootprintAdjustment(): void {
  state.cuttingAdjustFootprintSessionId = ''
  state.cuttingAdjustFootprintLocationIds = []
  state.cuttingAdjustRemainingByUnit = {}
  state.cuttingAdjustFootprintFingerprint = ''
}

function renderCuttingFootprintAdjustmentMap(): string {
  const projection = buildCuttingPickupMapProjection(state.cuttingAdjustFootprintSessionId)
  if (!projection) return '<div class="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">当前没有可用库位。</div>'
  return renderWarehouseLocationMap({
    projection,
    mode: 'SELECT',
    factoryName: getMobileWarehouseRuntimeContext()?.factoryName || '当前裁床工厂',
    selectedLocationIds: state.cuttingAdjustFootprintLocationIds,
  })
}

function refreshCuttingFootprintAdjustmentMap(): void {
  if (typeof document === 'undefined') return
  const region = document.querySelector<HTMLElement>('[data-pda-cutting-footprint-map]')
  replaceRegionHtmlPreservingPageScroll(region, renderCuttingFootprintAdjustmentMap())
}

function renderCuttingFootprintAdjustmentPage(): string {
  const session = findPickupSessionById(state.cuttingAdjustFootprintSessionId)
  if (!session?.storageFootprint) {
    clearCuttingFootprintAdjustment()
    return '<div class="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">接收记录已更新，请返回重新选择。</div>'
  }
  return `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderCuttingWaitProcessSubpageHeader('调整剩余存放库位', '按现场剩余实物调整存放库位，并记录每个单位的剩余数量。')}
      <section class="rounded-2xl border bg-card p-4 text-sm">
        <div class="font-semibold">${escapeHtml(session.pickupSessionNo)}</div>
        <div class="mt-1 text-xs text-muted-foreground">原存放库位：${escapeHtml(session.toLocationRefs?.map((ref) => ref.locationNo).join('、') || session.toLocationCode)}</div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          ${session.storageFootprint.unitSummaries.map((summary) => `
            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">${escapeHtml(summary.unit)} 剩余数量</span>
              <input class="h-11 w-full rounded-xl border px-3" inputmode="decimal" value="${escapeAttr(state.cuttingAdjustRemainingByUnit[summary.unit] ?? String(summary.remainingQty))}" data-pda-warehouse-field="cutting-adjust-remaining" data-unit="${escapeAttr(summary.unit)}" />
            </label>
          `).join('')}
        </div>
      </section>
      <div data-pda-cutting-footprint-map>${renderCuttingFootprintAdjustmentMap()}</div>
      <div class="grid grid-cols-2 gap-2">
        <button type="button" class="rounded-xl border px-4 py-3 text-sm" data-pda-warehouse-action="cancel-cutting-footprint-adjustment">取消</button>
        <button type="button" class="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="confirm-cutting-footprint-adjustment">确认调整</button>
      </div>
    </div>
  `
}

function renderCuttingPickupLocationMap(): string {
  const projection = buildCuttingPickupMapProjection()
  if (!projection) {
    return '<div class="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">当前裁床工厂没有可用的待加工仓库位。</div>'
  }
  return renderWarehouseLocationMap({
    projection,
    mode: 'SELECT',
    factoryName: getMobileWarehouseRuntimeContext()?.factoryName || '当前裁床工厂',
    selectedLocationIds: state.cuttingPickupLocationIds,
  })
}

function replaceRegionHtmlPreservingPageScroll(region: HTMLElement | null, html: string): void {
  if (!region) return
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  region.innerHTML = html
  window.scrollTo(scrollX, scrollY)
}

function refreshCuttingPickupLocationMap(): void {
  if (typeof document === 'undefined') return
  const root = document.querySelector<HTMLElement>('[data-pda-cutting-pickup-location-map]')
  replaceRegionHtmlPreservingPageScroll(root, renderCuttingPickupLocationMap())
}

function buildPickupUnitSummaries(node: PickupNodeProjection): Array<{ unit: string; qty: number; rollCount: number }> {
  const summaries = new Map<string, { unit: string; qty: number; rollCount: number }>()
  for (const item of node.items) {
    const summary = summaries.get(item.unit) || { unit: item.unit, qty: 0, rollCount: 0 }
    summary.qty += item.currentAvailableQty
    summary.rollCount += item.rollCount
    summaries.set(item.unit, summary)
  }
  return Array.from(summaries.values())
}

function getPickupCarrierLabel(node: PickupNodeProjection): string {
  if (node.carrierType === 'PALLET') {
    return node.palletDisplayLabel || node.palletId || '待领托盘（暂未编号）'
  }
  return Array.from(new Set(node.items.flatMap((item) =>
    item.sourceLocations.map((location) =>
      `${location.sourceWarehouseName} / ${location.sourceWarehouseArea} / ${location.sourceLocationCode}`
    )
  ))).join('；')
}

function renderCuttingPickupDifference(node: PickupNodeProjection): string {
  const discrepancies = listPickupDiscrepancies().filter((record) =>
    record.pickupNodeId === node.nodeId
    && record.pickupNodeVersion === node.version
    && record.status === '待主管处理'
  )
  const latest = discrepancies[0]
  return `
    ${discrepancies.length ? `
      <section class="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm">
        <div class="font-semibold text-amber-800">差异待主管处理，已阻断接收确认</div>
        ${discrepancies.map((record) => `
          <div class="rounded-xl bg-white/70 px-3 py-2 text-xs text-amber-900">
            <div>${escapeHtml(record.materialName)}：差异 ${formatCuttingWaitProcessQty(record.differenceQty, record.unit)}</div>
            <div class="mt-1">位置：${escapeHtml(record.carrierLabel)}</div>
            <div class="mt-1">现场照片：${escapeHtml(record.photoName || '未上传')}；现场说明：${escapeHtml(record.note || '未填写')}</div>
            <div class="mt-1">上报：${escapeHtml(record.operatorName)} ${escapeHtml(record.reportedAt)}</div>
          </div>
        `).join('')}
        <button type="button" class="w-full rounded-xl border border-amber-400 bg-white px-4 py-3 text-sm font-semibold text-amber-800" data-pda-warehouse-action="call-cutting-pickup-supervisor" data-discrepancy-id="${escapeAttr(latest?.discrepancyId || '')}">
          ${latest?.supervisorRequestedAt ? '已叫主管处理' : '叫主管处理'}
        </button>
      </section>
    ` : ''}
    <section class="space-y-3 rounded-2xl border px-4 py-4">
      <button type="button" class="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800" data-pda-warehouse-action="toggle-cutting-pickup-difference">上报接收差异</button>
      ${state.cuttingPickupDifferenceOpen ? `
        <div class="space-y-3">
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-muted-foreground">差异物料</span>
            <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="cutting-pickup-difference-line" data-skip-page-rerender="true">
              ${node.items.map((item) => `<option value="${escapeAttr(item.prepLineId)}" ${item.prepLineId === state.cuttingPickupDifferenceDemandLineId ? 'selected' : ''}>${escapeHtml(`${item.materialName} / ${item.materialSku} / ${item.currentAvailableQty} ${item.unit}`)}</option>`).join('')}
            </select>
          </label>
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-muted-foreground">差异数量（只记录差异，不修改系统可领数量）</span>
            <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(state.cuttingPickupDifferenceQty)}" data-pda-warehouse-field="cutting-pickup-difference-qty" data-skip-page-rerender="true">
          </label>
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-muted-foreground">现场照片</span>
            <input class="block w-full text-sm" type="file" accept="image/*" capture="environment" data-pda-warehouse-field="cutting-pickup-difference-photo" data-skip-page-rerender="true">
            <span class="text-xs text-muted-foreground ${state.cuttingPickupDifferencePhotoName ? '' : 'hidden'}" data-cutting-pickup-difference-photo-name>已选择：${escapeHtml(state.cuttingPickupDifferencePhotoName)}</span>
          </label>
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-muted-foreground">现场说明</span>
            <textarea class="min-h-20 w-full rounded-xl border bg-background px-3 py-2 text-sm" placeholder="例如：实物少 2 yard，已留在原库位复核" data-pda-warehouse-field="cutting-pickup-difference-note" data-skip-page-rerender="true">${escapeHtml(state.cuttingPickupDifferenceNote)}</textarea>
          </label>
          <button type="button" class="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white" data-pda-warehouse-action="report-cutting-pickup-difference">提交差异并叫主管</button>
        </div>
      ` : ''}
    </section>
  `
}

function renderCuttingPickupDraftPage(): string {
  const nodes = listActivePickupNodes()
  const node = nodes.find((n) => n.nodeId === state.cuttingPickupNodeId)
  if (!node) {
    return `<div class="rounded-xl bg-muted/60 px-4 py-8 text-center text-sm text-muted-foreground">当前节点已不存在，请返回重新选择。</div>`
  }
  const unitSummaries = buildPickupUnitSummaries(node)
  return `
    <section
      class="space-y-4"
      data-cutting-pickup-node-id="${escapeAttr(node.nodeId)}"
      data-cutting-pickup-node-version="${escapeAttr(String(node.version))}"
    >
      <div class="rounded-2xl border bg-card px-4 py-4 text-sm shadow-sm">
        <div class="flex items-center gap-2">
          <span class="rounded-full px-2 py-0.5 text-xs font-medium ${node.nodeType === 'READY_TO_PICKUP' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">${escapeHtml(node.nodeType === 'READY_TO_PICKUP' ? '已配齐待领' : '未配齐清单')}</span>
          <span class="text-xs text-muted-foreground">第 ${node.sequence} 轮</span>
        </div>
        <div class="mt-2 text-base font-semibold text-foreground">${escapeHtml(node.productionOrderNo)}</div>
        <div class="mt-1 text-xs text-muted-foreground">配料单 ${escapeHtml(node.prepOrderNo)}</div>
        <div class="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>物料：${node.itemCount} 项</div>
          <div>节点版本：V${node.version}</div>
          <div class="col-span-2">本次可领：${unitSummaries.map((summary) => `${formatCuttingWaitProcessQty(summary.qty, summary.unit)} / ${summary.rollCount} 卷件`).join('；')}</div>
          <div class="col-span-2">当前位置：<span class="font-medium text-foreground">${escapeHtml(getPickupCarrierLabel(node))}</span></div>
        </div>
      </div>

      <div class="space-y-2 px-1">
        <div class="text-sm font-semibold text-foreground">当前节点全部物料（只读核对）</div>
        ${node.items.map((item) => `
          <div class="rounded-xl border bg-background px-3 py-2.5 text-xs">
            <div class="font-medium">${escapeHtml(item.materialName)} / ${escapeHtml(item.color)}</div>
            <div class="mt-1 grid grid-cols-2 gap-1 text-muted-foreground">
              <div>类型：${escapeHtml(item.materialType)}</div>
              <div>规格：${escapeHtml(item.spec)}</div>
              <div>需求：${formatCuttingWaitProcessQty(item.requiredQty, item.unit)}</div>
              <div>本次可领：<span class="font-medium text-foreground">${formatCuttingWaitProcessQty(item.currentAvailableQty, item.unit)}</span></div>
              ${node.carrierType === 'WAREHOUSE_LOCATIONS' ? `
                <div class="col-span-2 space-y-1">来源库位：${item.sourceLocations.map((location) => `
                  <div>${escapeHtml(location.sourceWarehouseName)} / ${escapeHtml(location.sourceWarehouseArea)} / ${escapeHtml(location.sourceLocationCode)} / ${formatCuttingWaitProcessQty(location.currentAvailableQty, location.unit)} / ${location.rollCount} 卷件</div>
                `).join('')}</div>
              ` : `<div class="col-span-2">待领位置：${escapeHtml(node.palletDisplayLabel || node.palletId || '待领托盘（暂未编号）')}</div>`}
            </div>
          </div>
        `).join('')}
      </div>

      ${renderCuttingPickupDifference(node)}

      <div class="space-y-3 px-1">
        <div>
          <div class="text-base font-semibold text-foreground">确认全部接收</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">确认后当前节点${node.itemCount}项物料将全部领入裁床待加工仓，不可部分领取。</div>
        </div>
        <div data-pda-cutting-pickup-location-map>${renderCuttingPickupLocationMap()}</div>
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button type="button" class="rounded-xl border bg-background px-4 py-3 text-sm font-medium text-foreground" data-pda-warehouse-action="cancel-cutting-wp-pickup">重新选择</button>
          <button type="button" class="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50" data-pda-warehouse-action="confirm-cutting-wp-pickup" ${listPickupDiscrepancies().some((record) => record.pickupNodeId === node.nodeId && record.pickupNodeVersion === node.version && record.status === '待主管处理') ? 'disabled' : ''}>确认全部接收</button>
        </div>
      </div>
    </section>
  `
}

function openCuttingIssueDraft(sourceNo?: string, pickupSessionId?: string): void {
  const rows = listMaterialLedgerProjections()
  const row = findCuttingWaitProcessLedgerRow(sourceNo) || rows.find((item) => item.availableQty > 0) || getCuttingWaitProcessActionFallbackRow(rows)
  const stockQty = row?.availableQty || row?.cuttingClaimedQty || row?.transferWarehouseAllocatedQty || 120
  const defaultQty = row?.availableQty && row.availableQty > 0
    ? Math.max(Math.round(row.availableQty * 0.6), 1)
    : Math.max(Math.round(stockQty * 0.6), 1)
  const defaultRollCount = defaultQty > 0 ? Math.max(Math.ceil(defaultQty / 280), 1) : 1
  const firstLocation = listCuttingReceiveLocations()[0]
  const latestLocation = row
    ? splitCuttingLocationText(getCuttingWaitProcessLocationLabel(row))
    : { warehouseArea: firstLocation?.area || '', locationCode: firstLocation?.locations[0] || '' }
  state.cuttingIssueSourceNo = row?.cutOrderNo || sourceNo || ''
  state.cuttingIssuePickupSessionId = pickupSessionId || ''
  state.cuttingIssueWarehouseArea = latestLocation.warehouseArea
  state.cuttingIssueLocationCode = latestLocation.locationCode
  state.cuttingIssueQty = String(defaultQty)
  state.cuttingIssueRollCount = String(defaultRollCount)
}

function clearCuttingIssueDraft(): void {
  state.cuttingIssueSourceNo = ''
  state.cuttingIssuePickupSessionId = ''
  state.cuttingIssueWarehouseArea = ''
  state.cuttingIssueLocationCode = ''
  state.cuttingIssueQty = ''
  state.cuttingIssueRollCount = ''
}

function getCuttingIssueLocationOptions() {
  const receiveLocations = listCuttingReceiveLocations()
  const currentArea = state.cuttingIssueWarehouseArea || receiveLocations[0]?.area || ''
  const currentAreaConfig = receiveLocations.find((item) => item.area === currentArea) || receiveLocations[0]
  return {
    areaOptions: receiveLocations.map((item) => item.area),
    locationOptions: currentAreaConfig?.locations || [],
  }
}

function renderCuttingIssueDraftPage(): string {
  const row = findCuttingWaitProcessLedgerRow(state.cuttingIssueSourceNo)
  const sourceNo = row?.cutOrderNo || state.cuttingIssueSourceNo
  const materialText = row
    ? `${row.materialIdentity.materialSku} · ${row.materialIdentity.materialName} / ${row.materialIdentity.materialColor || '待补颜色'}`
    : '请重新扫码确认接收对象'
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
          <div class="text-base font-semibold text-foreground">确认加工接收</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">从待加工仓指定库区库位领走面料，用于铺布或加工。</div>
        </div>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">接收库区</span>
          <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="cutting-issue-area">
            ${options.areaOptions.map((area) => `<option value="${escapeAttr(area)}" ${area === state.cuttingIssueWarehouseArea ? 'selected' : ''}>${escapeHtml(area)}</option>`).join('')}
          </select>
        </label>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">接收库位</span>
          <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="cutting-issue-location">
            ${options.locationOptions.map((location) => `<option value="${escapeAttr(location)}" ${location === state.cuttingIssueLocationCode ? 'selected' : ''}>${escapeHtml(location)}</option>`).join('')}
          </select>
        </label>
        <div class="grid grid-cols-2 gap-2">
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-muted-foreground">接收数量（yard）</span>
            <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(state.cuttingIssueQty)}" data-pda-warehouse-field="cutting-issue-qty" />
          </label>
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-muted-foreground">卷数</span>
            <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="numeric" value="${escapeAttr(state.cuttingIssueRollCount)}" data-pda-warehouse-field="cutting-issue-roll-count" />
          </label>
        </div>
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button type="button" class="rounded-xl border bg-background px-4 py-3 text-sm font-medium text-foreground" data-pda-warehouse-action="cancel-cutting-wp-issue">重新扫码</button>
          <button type="button" class="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="confirm-cutting-wp-issue">确认接收</button>
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
  state.cuttingReturnLocationIds = []
  state.cuttingReturnQty = String(defaultQty)
  state.cuttingReturnRollCount = String(defaultRollCount)
}

function clearCuttingReturnDraft(): void {
  state.cuttingReturnSourceNo = ''
  state.cuttingReturnRelatedDocNo = ''
  state.cuttingReturnLocationIds = []
  state.cuttingReturnQty = ''
  state.cuttingReturnRollCount = ''
}

function renderCuttingReturnLocationMap(): string {
  const projection = buildCuttingPickupMapProjection()
  if (!projection) return '<div class="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">当前没有可用库位。</div>'
  return renderWarehouseLocationMap({
    projection,
    mode: 'SELECT',
    factoryName: getMobileWarehouseRuntimeContext()?.factoryName || '当前裁床工厂',
    selectedLocationIds: state.cuttingReturnLocationIds,
  })
}

function refreshCuttingReturnLocationMap(): void {
  if (typeof document === 'undefined') return
  const region = document.querySelector<HTMLElement>('[data-pda-cutting-return-location-map]')
  replaceRegionHtmlPreservingPageScroll(region, renderCuttingReturnLocationMap())
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
          <div class="mt-1 text-xs leading-5 text-muted-foreground">选择关联单据不是必填；请选择实际存放的全部库位，再确认数量和卷数。</div>
        </div>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">关联单据（可选）</span>
          <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="cutting-return-related-doc">
            <option value="">不关联单据</option>
            ${documentOptions.map((item) => `<option value="${escapeAttr(item.docNo)}" ${item.docNo === state.cuttingReturnRelatedDocNo ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
          </select>
        </label>
        <div data-pda-cutting-return-location-map>${renderCuttingReturnLocationMap()}</div>
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
  const pickupSession = getPickupSessionByNodeId(runtimeString(payload.pickupNodeId))
  const warehouseSyncStatus = pickupSession?.warehouseSyncStatus || runtimeString(payload.warehouseSyncStatus)
  const unit = event.inventoryEffect?.unit || runtimeString(payload.unit) || 'yard'
  const locationLine = `库区库位：${getCuttingRuntimeEventLocationLabel(event)}`
  return `
    <div class="space-y-1.5 border-t py-3 text-xs text-muted-foreground first:border-t-0 first:pt-0 last:pb-0">
      <div class="text-sm font-semibold text-foreground">${escapeHtml(getCuttingRuntimeEventSourceText(event))}</div>
      <div>数量：${escapeHtml(`${qty} ${unit} / ${rollCount} 卷`)}</div>
      <div>${escapeHtml(locationLine)}</div>
      <div>同步状态：${escapeHtml(warehouseSyncStatus || event.eventStatus)} · ${escapeHtml(event.occurredAt)}</div>
      ${warehouseSyncStatus === '回写异常待重试' ? `
        <button type="button" class="mt-2 rounded-full border border-amber-300 px-3 py-1.5 text-xs text-amber-700" data-pda-warehouse-action="retry-cutting-pickup-sync" data-pickup-session-id="${escapeAttr(runtimeString(payload.pickupSessionId))}">重试仓储回写</button>
      ` : ''}
      ${pickupSession?.storageFootprint ? `
        <button type="button" class="mt-2 rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-cutting-footprint-adjustment" data-pickup-session-id="${escapeAttr(pickupSession.pickupSessionId)}">调整剩余存放库位</button>
      ` : ''}
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
  const availableLocations = listCuttingReceiveLocations()
    .flatMap((group) => group.locations.map((location) => `${group.area} / ${location}`))
  const location = activeAction === 'return'
    ? availableLocations[1] || availableLocations[0] || '待选择库位'
    : availableLocations[0] || '待选择库位'
  const sourceText = activeAction === 'pickup'
      ? `中转仓接收：${row.cutOrderNo}`
      : activeAction === 'issue'
        ? `加工接收：${row.cutOrderNo}`
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
        { label: '去加工接收', route: '/fcs/pda/warehouse/wait-process?scope=cutting&action=issue' },
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
  if (state.cuttingAdjustFootprintSessionId) return renderCuttingFootprintAdjustmentPage()
  if (state.cuttingPickupSourceNo) {
    return `
      <div class="space-y-4 px-4 pb-5 pt-4">
        ${renderCuttingWaitProcessSubpageHeader('中转仓接收', '只读核对生产单当前待领节点的全部实物，选择库位后一次性确认全部领取。')}
        ${renderCuttingPickupDraftPage()}
      </div>
    `
  }
  const failedSessions = listMaterialPrepOrderProjections()
    .flatMap((projection) => projection.pickupSessions)
    .filter((session) => session.warehouseSyncStatus === '回写异常待重试')
  return `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderCuttingWaitProcessSubpageHeader('中转仓接收', '中转仓确认配料后，裁床仓管按生产单待领节点核对并一次性领取全部实物。')}
      ${renderCuttingPendingPickupList(rows)}
      ${failedSessions.length ? `
        <section class="space-y-2">
          <div class="text-sm font-semibold text-amber-700">接收已完成，待补写入仓流水</div>
          ${failedSessions.map((session) => `
            <div class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs">
              <div class="font-medium">${escapeHtml(session.pickupSessionNo)}</div>
              <div class="mt-1 text-amber-700">${escapeHtml(session.warehouseSyncMessage || '回写异常待重试')}</div>
              <button type="button" class="mt-2 rounded-full border border-amber-300 px-3 py-1.5" data-pda-warehouse-action="retry-cutting-pickup-sync" data-pickup-session-id="${escapeAttr(session.pickupSessionId)}">重试仓储回写</button>
            </div>
          `).join('')}
        </section>
      ` : ''}
      ${renderCuttingWaitProcessActionResult('pickup', rows)}
      ${renderCuttingWaitProcessNextActions('pickup')}
    </div>
  `
}

function renderCuttingWaitProcessActionPage(activeAction: string): string {
  const actions = [
    { key: 'issue', title: '加工接收', desc: '铺布或加工前从待加工仓领走面料，必须记录来源库区库位。' },
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
      ${renderCuttingWaitProcessSingleAction(activeAction, rows)}
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
  const deepLinkedPickupNodeId = params.get('pickupNodeId') || ''
  const deepLinkedPickupNodeVersion = params.get('version') || ''
  if (
    activeAction === 'pickup'
    && deepLinkedPickupNodeId
    && state.cuttingPickupNodeId !== deepLinkedPickupNodeId
  ) {
    openCuttingPickupDraft(deepLinkedPickupNodeId, deepLinkedPickupNodeVersion)
    state.cuttingPickupDifferenceOpen = params.get('difference') === '1'
  }
  if (activeView === 'pickup' || activeAction === 'pickup') {
    return renderPdaFrame(renderCuttingPickupTaskPage(rows), 'warehouse', { headerTitle: '中转仓接收', disableTodoAutoOpen: true })
  }
  if (activeAction && ['issue', 'return'].includes(activeAction)) {
    return renderPdaFrame(renderCuttingWaitProcessActionPage(activeAction), 'warehouse', { headerTitle: '裁床待加工仓', disableTodoAutoOpen: true })
  }
  const stockedRows = rows.filter((row) => row.cuttingClaimedQty > 0 || row.availableQty >= 0)
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderCuttingWaitProcessSubpageHeader('裁床待加工仓', '处理中转仓接收、加工接收和回收入仓。')}
      ${renderCuttingWaitProcessActionCards(null)}
      <section class="space-y-3">
        ${stockedRows.length
          ? stockedRows.slice(0, 8).map((row) => renderCuttingWaitProcessRow(row)).join('')
          : renderMobilePageEmptyState('暂无裁床待加工库存', '中转仓接收确认后会形成裁床待加工仓库存。')}
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
  if (row.itemKind === '成衣') {
    return `
      <div class="fixed inset-0 z-[120]">
        <button type="button" class="absolute inset-0 bg-black/40" data-fast-page-render data-pda-warehouse-action="close-wait-process-detail"></button>
        <section class="absolute inset-x-0 bottom-[72px] rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-base font-semibold text-foreground">成衣 SKU 待加工详情</h2>
            <button type="button" class="rounded-full border px-3 py-1 text-xs" data-fast-page-render data-pda-warehouse-action="close-wait-process-detail">关闭</button>
          </div>
          <div class="mt-4 rounded-2xl border bg-card px-4 py-4 shadow-sm">
            ${renderCompactFieldList([
              { label: '生产单', value: row.productionOrderNo || '-' },
              { label: 'SKU', value: row.materialSku || '-' },
              { label: '颜色 / 尺码', value: `${row.fabricColor || '-'} / ${row.sizeCode || '-'}` },
              { label: '来源仓', value: row.sourceObjectName || '成衣仓' },
              { label: '应收 / 实收', value: `${row.expectedQty} / ${row.receivedQty} 件` },
              { label: '当前仓', value: `${row.warehouseName} · ${row.locationText}` },
              { label: '下一动作', value: '加工接收' },
            ])}
          </div>
        </section>
      </div>
    `
  }
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

function renderPostFinishingReceiptStatus(record: PostFinishingWaitProcessWarehouseRecord): string {
  const status = getPostFinishingWaitProcessReceiptConfirmStatus(record)
  if (status === '待后道确认') return renderStatusPill('待后道确认')
  if (status === '数量差异待处理') return renderStatusPill('数量差异待处理')
  if (status === '已驳回') return renderStatusPill('已驳回')
  return renderStatusPill(record.availableGarmentQty > 0 ? '可质检' : '已占用')
}

function renderPostFinishingSelfReturnConfirmDrawer(): string {
  const row = getPostFinishingWaitProcessRows().find((item) => item.warehouseRecordId === state.postFinishingConfirmRecordId)
  if (!row) return ''
  const submittedQty = row.submittedGarmentQty ?? row.inboundGarmentQty
  const defaultQty = state.postFinishingConfirmQty || String(row.confirmedGarmentQty ?? submittedQty)
  return `
    <div class="fixed inset-0 z-[130]">
      <button type="button" class="absolute inset-0 bg-black/40" data-pda-warehouse-action="close-post-self-return-confirm"></button>
      <section class="absolute inset-x-0 bottom-[72px] max-h-[78vh] overflow-y-auto rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-foreground">确认车缝自助回货入库</h2>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-warehouse-action="close-post-self-return-confirm">关闭</button>
        </div>
        <div class="mt-4 rounded-2xl border bg-card px-4 py-4 text-xs leading-5 shadow-sm">
          <div class="flex gap-3">
            ${row.skuImageUrl
              ? `<img src="${escapeHtml(row.skuImageUrl)}" alt="${escapeHtml(row.skuCode)}" class="h-16 w-16 flex-shrink-0 rounded-xl border object-cover" loading="lazy" referrerpolicy="no-referrer" />`
              : ''}
            <div class="min-w-0 flex-1">
              <div class="font-semibold text-foreground">${escapeHtml(row.skuCode)} / ${escapeHtml(row.colorName)} / ${escapeHtml(row.sizeName)}</div>
              <div class="mt-1 text-muted-foreground">自助登记：${submittedQty} ${escapeHtml(row.qtyUnit)} · 来源：${escapeHtml(row.selfReturnRecordNo || row.postOrderNo)}</div>
              <div class="text-muted-foreground">默认库位：${escapeHtml(row.areaName || '-')} / ${escapeHtml(row.locationCode || '-')}</div>
            </div>
          </div>
        </div>
        <div class="mt-4 space-y-3">
          <label class="block text-xs font-medium text-muted-foreground">
            后道确认数量
            <input
              type="number"
              min="0"
              step="1"
              class="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value="${escapeAttr(defaultQty)}"
              data-pda-warehouse-field="post-self-return-confirm-qty"
              data-skip-page-rerender="true"
            />
          </label>
          <label class="block text-xs font-medium text-muted-foreground">
            确认备注
            <textarea
              class="mt-1 min-h-20 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              data-pda-warehouse-field="post-self-return-confirm-remark"
              data-skip-page-rerender="true"
              placeholder="如有数量差异，请说明现场核对原因"
            >${escapeHtml(state.postFinishingConfirmRemark)}</textarea>
          </label>
        </div>
        <button
          type="button"
          class="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
          data-pda-warehouse-action="confirm-post-self-return"
        >确认入库</button>
      </section>
    </div>
  `
}

function renderPostFinishingWaitProcessDetailDrawer(): string {
  const row = getPostFinishingWaitProcessRows().find((item) => item.warehouseRecordId === state.detailId)
  if (!row) return ''
  const submittedQty = row.submittedGarmentQty ?? row.inboundGarmentQty
  const status = getPostFinishingWaitProcessReceiptConfirmStatus(row)
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
            { label: '后道阶段处理记录', value: row.sourceTaskNo },
            { label: '款式', value: `${row.spuCode} / ${row.spuName}` },
            { label: 'SKU', value: row.skuSummary },
            { label: '确认状态', value: status },
            { label: '自助登记数量', value: `${submittedQty} ${row.qtyUnit}` },
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
  const totalInbound = rows
    .filter((item) => {
      const status = getPostFinishingWaitProcessReceiptConfirmStatus(item)
      return status !== '待后道确认' && status !== '已驳回'
    })
    .reduce((sum, item) => sum + item.inboundGarmentQty, 0)
  const flowCount = rows.reduce((sum, item) => sum + item.flowRecords.length, 0)
  const selfReturnRows = rows.filter((item) => item.postSourceLabel === '车缝自助回货')
  const pendingSelfReturnRows = selfReturnRows.filter((item) => getPostFinishingWaitProcessReceiptConfirmStatus(item) === '待后道确认')
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="grid grid-cols-2 gap-2">
        <button type="button" class="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground" data-nav="/fcs/pda/warehouse/wait-process">待加工仓</button>
        <button type="button" class="rounded-2xl border bg-background px-4 py-3 text-sm font-medium" data-nav="/fcs/pda/warehouse/wait-handover">待交出仓</button>
      </section>
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <div class="text-base font-semibold">后道待加工仓</div>
        <div class="mt-1 text-xs text-muted-foreground">上游交出扫码收货后进入待加工仓；车缝自助回货先待后道确认，确认后才计入可用数量。</div>
        <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${rows.length}</div><div class="text-muted-foreground">SKU</div></div>
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${totalAvailable}</div><div class="text-muted-foreground">可用件数</div></div>
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${flowCount}</div><div class="text-muted-foreground">流水</div></div>
        </div>
        <div class="mt-2 text-xs text-muted-foreground">累计确认入仓 ${totalInbound} 件；车缝自助回货待确认 ${pendingSelfReturnRows.length} 条。</div>
      </section>
      <section class="space-y-3">
        ${rows.length > 0 ? rows.map((item) => {
          const receiptStatus = getPostFinishingWaitProcessReceiptConfirmStatus(item)
          const submittedQty = item.submittedGarmentQty ?? item.inboundGarmentQty
          return `
          <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
            <div class="flex items-start gap-3">
              ${item.skuImageUrl
                ? `<img src="${escapeHtml(item.skuImageUrl)}" alt="${escapeHtml(item.skuCode)}" class="mt-0.5 h-14 w-14 flex-shrink-0 rounded-xl border object-cover" loading="lazy" referrerpolicy="no-referrer" />`
                : ''}
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-semibold">${escapeHtml(item.skuCode)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.spuName)} · ${escapeHtml(item.colorName)} / ${escapeHtml(item.sizeName)}</div>
                  </div>
                  ${renderPostFinishingReceiptStatus(item)}
                </div>
              </div>
            </div>
            <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <div>生产单：${escapeHtml(item.sourceProductionOrderNo)}</div>
              <div>来源类型：${escapeHtml(item.postSourceLabel)}</div>
              <div>来源交出记录：${escapeHtml(item.upstreamHandoverRecordNo || '-')}</div>
              ${item.selfReturnRecordNo ? `<div>自助回货记录：${escapeHtml(item.selfReturnRecordNo)}</div>` : ''}
              <div>登记 / 确认 / 可用：${submittedQty} / ${item.confirmedGarmentQty ?? (receiptStatus === '待后道确认' ? 0 : item.inboundGarmentQty)} / ${item.availableGarmentQty} ${escapeHtml(item.qtyUnit)}</div>
              <div>入仓 / 可用：${item.inboundGarmentQty} / ${item.availableGarmentQty} ${escapeHtml(item.qtyUnit)}</div>
              <div>库区库位：${escapeHtml(item.areaName || '-')} / ${escapeHtml(item.locationCode || '-')}</div>
              <div>最近流水：${escapeHtml(renderPostFinishingFlowSummary(item))}</div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              ${receiptStatus === '待后道确认' && item.selfReturnRecordId ? `
                <button type="button" class="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700" data-pda-warehouse-action="open-post-self-return-confirm" data-stock-item-id="${escapeAttr(item.warehouseRecordId)}">确认入库</button>
              ` : ''}
              <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-process-detail" data-stock-item-id="${escapeAttr(item.warehouseRecordId)}">查看流水</button>
              <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveTaskRoute(item.sourceTaskNo))}">查看任务</button>
            </div>
          </article>
        `}).join('') : renderMobilePageEmptyState('暂无后道待加工库存', '扫码收货确认后，会进入后道待加工仓。')}
      </section>
      ${renderPostFinishingWaitProcessDetailDrawer()}
      ${renderPostFinishingSelfReturnConfirmDrawer()}
    </div>
  `
  return renderPdaFrame(content, 'warehouse', { headerTitle: '后道待加工仓', disableTodoAutoOpen: true })
}

function getWoolWaitProcessAction(value?: string | null): WoolWaitProcessAction | null {
  return value === 'receive' || value === 'issue' || value === 'return' || value === 'adjust'
    ? value
    : null
}

function getWoolWaitProcessStocks() {
  return listWoolWarehouseStocks('WAIT_PROCESS')
}

export function resolveWoolWaitProcessStockSelection(stockKey: string) {
  return getWoolWaitProcessStocks().find((item) => item.stockKey === stockKey)
}

function getWoolPdaWarehouseNowText(): string {
  return formatIndonesiaBusinessDateTime()
}

function createWoolPdaWarehouseCommandId(action: string): string {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `PDA-WOOL-${action}-${suffix}`
}

function ensureWoolReceiveDraft(): void {
  const order = listWoolWorkOrders()[0]
  const yarnSkuCode = order?.outputPlanLines.flatMap((line) => line.requiredYarnSkus)[0] || ''
  state.woolReceiveScan ||= order?.woolOrderId || ''
  state.woolReceiveQty ||= '1'
  state.woolReceiveLocationId ||= yarnSkuCode
  state.woolReceiveCommandId ||= createWoolPdaWarehouseCommandId('RECEIVE')
}

function ensureWoolIssueDraft(): void {
  const inventory = getWoolWaitProcessStocks()
  const first = inventory.find((item) => item.currentQty > 0) || inventory[0]
  const order = first ? getWoolWorkOrderById(first.woolOrderId) : listWoolWorkOrders()[0]
  state.woolIssueOrderId ||= order?.woolOrderId || ''
  state.woolIssueQty ||= String(Math.max(Math.min(first?.currentQty || 1, 1), 0.1))
  state.woolIssueLocationId ||= first
    ? `${first.objectSkuCode}|${first.batchNo || ''}`
    : ''
  state.woolIssueCommandId ||= createWoolPdaWarehouseCommandId('ISSUE')
}

function ensureWoolReturnActionDraft(): void {
  const first = getWoolWaitProcessStocks()[0]
  state.woolReturnSourceOrderId ||= first?.woolOrderId || ''
  state.woolReturnSelectedOrderId ||= first?.woolOrderId || ''
  state.woolReturnQty ||= '0.1'
  state.woolReturnLocationId ||= first
    ? `${first.objectSkuCode}|${first.batchNo || ''}`
    : ''
  state.woolReturnCommandId ||= createWoolPdaWarehouseCommandId('RETURN')
}

function renderWoolWaitProcessActionCards(activeAction?: WoolWaitProcessAction | null): string {
  const actions: Array<{ key: WoolWaitProcessAction; title: string; desc: string }> = [
    { key: 'receive', title: '确认接收', desc: '确认加工单收到的纱线 SKU 和重量。' },
    { key: 'issue', title: '纱线领用', desc: '从纱线默认库位领出本次加工用纱。' },
    { key: 'return', title: '纱线退回', desc: '将已领但未使用的纱线退回默认库位。' },
    { key: 'adjust', title: '库存调整', desc: '盘点有误时由仓管填写原因后调整。' },
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

function renderWoolStockSelect(field: string, value: string): string {
  const stocks = getWoolWaitProcessStocks()
  return `
    <label class="block space-y-1.5">
      <span class="text-xs font-medium text-muted-foreground">纱线库存</span>
      <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="${escapeAttr(field)}">
        ${stocks.map((stock) => {
          const optionValue = `${stock.objectSkuCode}|${stock.batchNo || ''}`
          return `
          <option value="${escapeAttr(optionValue)}" ${optionValue === value ? 'selected' : ''}>
            ${escapeHtml(`${stock.objectSkuCode} / ${stock.batchNo || '无批次'} / ${stock.currentQty}${stock.unit}`)}
          </option>
        `}).join('')}
      </select>
    </label>
  `
}

function renderWoolAdjustmentStockSelect(value: string): string {
  const stocks = getWoolWaitProcessStocks()
  return `
    <label class="block space-y-1.5">
      <span class="text-xs font-medium text-muted-foreground">纱线库存</span>
      <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wool-issue-location">
        ${stocks.map((stock) => `
          <option value="${escapeAttr(stock.stockKey)}" ${stock.stockKey === value ? 'selected' : ''}>
            ${escapeHtml(`${stock.woolOrderNo} / ${stock.objectSkuCode} / ${stock.batchNo || '无批次'} / ${stock.currentQty}${stock.unit}`)}
          </option>
        `).join('')}
      </select>
    </label>
  `
}

function renderWoolWaitProcessActionPage(action: WoolWaitProcessAction): string {
  if (action === 'receive') ensureWoolReceiveDraft()
  if (action === 'issue') ensureWoolIssueDraft()
  if (action === 'return') ensureWoolReturnActionDraft()
  if (action === 'adjust') {
    const first = getWoolWaitProcessStocks().find((item) => item.currentQty > 0)
      || getWoolWaitProcessStocks()[0]
    if (!resolveWoolWaitProcessStockSelection(state.woolIssueLocationId)) {
      state.woolIssueLocationId = first?.stockKey || ''
      state.woolIssueQty = String(first?.currentQty || 0)
    }
    state.woolAdjustCommandId ||= createWoolPdaWarehouseCommandId('ADJUST')
  }
  const title = action === 'receive'
    ? '确认接收'
    : action === 'issue'
      ? '纱线领用'
      : action === 'return'
        ? '纱线退回'
        : '库存调整'
  const receiveOrder = getWoolWorkOrderById(state.woolReceiveScan)
  const receiveOrderOptions = listWoolWorkOrders().slice(0, 24).map((order) => `
    <option value="${escapeAttr(order.woolOrderId)}" ${order.woolOrderId === state.woolReceiveScan ? 'selected' : ''}>
      ${escapeHtml(`${order.woolOrderNo} / ${order.productionOrderNo}`)}
    </option>
  `).join('')
  const receiveYarnOptions = [...new Set(
    receiveOrder?.outputPlanLines.flatMap((line) => line.requiredYarnSkus) || [],
  )].map((yarnSkuCode) => `
    <option value="${escapeAttr(yarnSkuCode)}" ${yarnSkuCode === state.woolReceiveLocationId ? 'selected' : ''}>
      ${escapeHtml(yarnSkuCode)}
    </option>
  `).join('')
  const issueOptions = listWoolWorkOrders().slice(0, 24).map((order) => `
    <option value="${escapeAttr(order.woolOrderId)}" ${order.woolOrderId === state.woolIssueOrderId ? 'selected' : ''}>
      ${escapeHtml(`${order.woolOrderNo} / ${order.productionOrderNo}`)}
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
    ? `${returnActiveOrder.outputPlanLines.flatMap((line) => line.requiredYarnSkus).join(' / ')}`
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
                <span class="text-xs font-medium text-muted-foreground">毛织加工单</span>
                <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wool-receive-scan">${receiveOrderOptions}</select>
              </label>
              <label class="block space-y-1.5">
                <span class="text-xs font-medium text-muted-foreground">纱线 SKU</span>
                <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wool-receive-location">${receiveYarnOptions}</select>
              </label>
              <label class="block space-y-1.5">
                <span class="text-xs font-medium text-muted-foreground">确认接收重量（kg）</span>
                <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(state.woolReceiveQty)}" data-pda-warehouse-field="wool-receive-qty" />
              </label>
              <button type="button" class="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="confirm-wool-receive">确认接收纱线</button>
            `
            : action === 'issue'
              ? `
                <label class="block space-y-1.5">
                  <span class="text-xs font-medium text-muted-foreground">毛织加工单</span>
                  <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wool-issue-order">${issueOptions}</select>
                </label>
                <label class="block space-y-1.5">
                  <span class="text-xs font-medium text-muted-foreground">本次领用重量（kg）</span>
                  <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(state.woolIssueQty)}" data-pda-warehouse-field="wool-issue-qty" />
                </label>
                ${renderWoolStockSelect('wool-issue-location', state.woolIssueLocationId)}
                <button type="button" class="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="confirm-wool-issue">确认纱线领用</button>
              `
              : action === 'return'
                ? `
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
                  <div class="mt-1">退回必须对应同一加工单、纱线 SKU 和批次，且不能超过累计领用。</div>
                </div>
                <label class="block space-y-1.5">
                  <span class="text-xs font-medium text-muted-foreground">本次退回重量（kg）</span>
                  <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(state.woolReturnQty)}" data-pda-warehouse-field="wool-return-qty" />
                </label>
                ${renderWoolStockSelect('wool-return-location', state.woolReturnLocationId)}
                <button type="button" class="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="confirm-wool-return">确认纱线退回</button>
                `
                : `
                  ${renderWoolAdjustmentStockSelect(state.woolIssueLocationId)}
                  <label class="block space-y-1.5">
                    <span class="text-xs font-medium text-muted-foreground">调整后数量（kg）</span>
                    <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(state.woolIssueQty)}" data-pda-warehouse-field="wool-issue-qty" />
                  </label>
                  <label class="block space-y-1.5">
                    <span class="text-xs font-medium text-muted-foreground">调整原因</span>
                    <textarea class="min-h-20 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-warehouse-field="wait-process-remark">${escapeHtml(state.remark)}</textarea>
                  </label>
                  <button type="button" class="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="confirm-wool-adjust">确认库存调整</button>
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
  const stockedOrderIds = new Set(getWoolWaitProcessStocks().map((item) => item.woolOrderId))
  return listWoolWorkOrders()
    .filter((order) => stockedOrderIds.has(order.woolOrderId) || order.woolOrderId === sourceOrderId)
    .slice(0, 24)
    .map((order) => ({
      woolOrderId: order.woolOrderId,
      woolOrderNo: order.woolOrderNo,
      productionOrderNo: order.productionOrderNo,
      yarnSku: [...new Set(order.outputPlanLines.flatMap((line) => line.requiredYarnSkus))].join(' / '),
      yarnName: '技术包必需纱线',
      colorName: [...new Set(order.outputPlanLines.map((line) => line.colorName))].join(' / '),
      lossWeightKg: 0,
      recoveredWeightKg: 0,
    }))
}

function openWoolReturnDraft(sourceOrderId: string): void {
  const stock = getWoolWaitProcessStocks().find((item) => item.woolOrderId === sourceOrderId)
  state.woolReturnSourceOrderId = sourceOrderId
  state.woolReturnSelectedOrderId = sourceOrderId
  state.woolReturnQty = '0.1'
  state.woolReturnLocationId = stock
    ? `${stock.objectSkuCode}|${stock.batchNo || ''}`
    : ''
}

function clearWoolReturnDraft(): void {
  state.woolReturnSourceOrderId = ''
  state.woolReturnSelectedOrderId = ''
  state.woolReturnQty = ''
  state.woolReturnLocationId = ''
  state.woolReturnCommandId = ''
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
    ? `${[...new Set(activeOrder.outputPlanLines.flatMap((line) => line.requiredYarnSkus))].join(' / ')}`
    : '请选择或保留当前来源'
  return `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="flex items-start justify-between gap-3 border-b pb-4">
        <div class="min-w-0">
          <div class="text-xl font-semibold text-foreground">纱线退回</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">将本加工单已领但未使用的同一纱线和批次退回默认库位。</div>
        </div>
        <button type="button" class="shrink-0 rounded-full bg-muted px-3 py-2 text-xs font-medium" data-pda-warehouse-action="cancel-wool-return">返回仓管</button>
      </section>

      <section class="space-y-3">
        <div>
          <div class="text-sm font-semibold text-foreground">回收来源</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">${escapeHtml(sourceText)}</div>
        </div>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">关联毛织加工单</span>
          <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wool-return-selected-order">
            ${options.map((order) => `
              <option value="${escapeAttr(order.woolOrderId)}" ${order.woolOrderId === state.woolReturnSelectedOrderId ? 'selected' : ''}>
                ${escapeHtml(`${order.woolOrderNo} / ${order.productionOrderNo} / ${order.yarnSku}`)}
              </option>
            `).join('')}
          </select>
        </label>
        <div class="rounded-2xl bg-muted/50 px-4 py-3 text-xs leading-5 text-muted-foreground">
          <div class="font-semibold text-foreground">${escapeHtml(yarnText)}</div>
          <div class="mt-1">系统会校验累计退回不超过累计领用。</div>
        </div>
      </section>

      <section class="space-y-3">
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">退回重量（kg）</span>
          <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(state.woolReturnQty)}" data-pda-warehouse-field="wool-return-qty" />
        </label>
        ${renderWoolStockSelect('wool-return-location', state.woolReturnLocationId)}
        <button type="button" class="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="confirm-wool-return">确认纱线退回</button>
      </section>
    </div>
  `
}

function renderWoolWaitProcessPage(): string {
  const params = getMobileWarehouseSearchParams()
  const activeAction = getWoolWaitProcessAction(params.get('action'))
  if (activeAction) {
    const title = activeAction === 'receive'
      ? '毛织确认接收'
      : activeAction === 'issue'
        ? '毛织纱线领用'
        : activeAction === 'return'
          ? '毛织纱线退回'
          : '毛织库存调整'
    return renderPdaFrame(renderWoolWaitProcessActionPage(activeAction), 'warehouse', { headerTitle: title, disableTodoAutoOpen: true })
  }
  if (state.woolReturnSourceOrderId) {
    return renderPdaFrame(renderWoolReturnDraftPage(), 'warehouse', { headerTitle: '毛织纱线退回', disableTodoAutoOpen: true })
  }
  const inventory = getWoolWaitProcessStocks()
  const pageSize = 8
  const totalPages = Math.max(1, Math.ceil(inventory.length / pageSize))
  const currentPage = Math.min(Math.max(Number(params.get('page')) || 1, 1), totalPages)
  const pageRows = inventory.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="grid grid-cols-2 gap-2">
        <button type="button" class="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground" data-nav="/fcs/pda/warehouse/wait-process">待加工仓</button>
        <button type="button" class="rounded-2xl border bg-background px-4 py-3 text-sm font-medium" data-nav="/fcs/pda/warehouse/wait-handover">待交出仓</button>
      </section>
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <div class="text-base font-semibold">毛织待加工仓</div>
        <div class="mt-1 text-xs text-muted-foreground">确认接收进入纱线默认库位；领用、退回和库存调整只形成仓库事实。</div>
        <div class="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${inventory.length}</div><div class="text-muted-foreground">库存</div></div>
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">WOOL-WP-YARN-DEFAULT</div><div class="text-muted-foreground">默认库位</div></div>
        </div>
      </section>
      ${renderWoolWaitProcessActionCards()}
      <section class="space-y-3">
        ${pageRows.map((item) => {
          const order = getWoolWorkOrderById(item.woolOrderId)
          return `
          <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-sm font-semibold">${escapeHtml(item.objectSkuCode)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.objectName)} · ${escapeHtml(item.batchNo || '无批次')}</div>
              </div>
              ${renderStatusPill(item.currentQty > 0 ? '有库存' : '无库存')}
            </div>
            <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <div>关联毛织单：${escapeHtml(item.woolOrderNo)}</div>
              <div>来源生产单：${escapeHtml(item.productionOrderNo)}</div>
              <div>当前库存：${item.currentQty} ${escapeHtml(item.unit)}</div>
              <div>默认库位：${escapeHtml(item.defaultLocationId)}</div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveTaskRoute(order?.taskId))}">查看任务</button>
              <button
                type="button"
                class="rounded-full border border-emerald-200 px-3 py-1.5 text-xs text-emerald-700"
                data-pda-warehouse-action="open-wool-return"
                data-wool-order-id="${escapeAttr(item.woolOrderId)}"
                data-related-order-nos="${escapeAttr((item.relatedOrderNos || [item.woolOrderNo]).join('|'))}"
              >纱线退回</button>
            </div>
          </article>
        `}).join('')}
      </section>
      <section class="flex items-center justify-between rounded-xl border bg-card px-3 py-2 text-xs">
        <span>第 ${currentPage} / ${totalPages} 页 · 共 ${inventory.length} 条</span>
        <div class="flex gap-2">
          <button type="button" class="rounded-full border px-3 py-1.5 disabled:opacity-40" data-nav="/fcs/pda/warehouse/wait-process?page=${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>上一页</button>
          <button type="button" class="rounded-full border px-3 py-1.5 disabled:opacity-40" data-nav="/fcs/pda/warehouse/wait-process?page=${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
        </div>
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
      ${renderWarehouseSummaryHeader('待加工仓', '中转仓接收确认后进入待加工仓，并承接入库记录。', runtime.overview)}
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
            : renderMobilePageEmptyState('暂无待加工仓记录', '中转仓接收确认后，会自动生成入库记录并进入待加工仓。')
        }
      </section>
      ${renderDetailDrawer()}
      ${renderLocationDialog()}
    </div>
  `

  return renderPdaFrame(content, 'warehouse', { headerTitle: '待加工仓', disableTodoAutoOpen: true })
}

export function handlePdaWarehouseWaitProcessEvent(target: HTMLElement): boolean {
  const warehouseMapNode = target.closest<HTMLElement>('[data-warehouse-map-action]')
  if (warehouseMapNode && (state.cuttingPickupNodeId || state.cuttingAdjustFootprintSessionId || state.cuttingReturnSourceNo)) {
    const projection = buildCuttingPickupMapProjection(
      state.cuttingAdjustFootprintSessionId || undefined,
    )
    if (projection && handleWarehouseLocationMapOccupancyEvent(warehouseMapNode, projection)) return true
  }
  if (
    warehouseMapNode
    && (state.cuttingPickupNodeId || state.cuttingAdjustFootprintSessionId || state.cuttingReturnSourceNo)
    && ['toggle-location', 'clear-selection'].includes(warehouseMapNode.dataset.warehouseMapAction || '')
  ) {
    const adjusting = Boolean(state.cuttingAdjustFootprintSessionId)
    const returning = !adjusting && Boolean(state.cuttingReturnSourceNo)
    const projection = buildCuttingPickupMapProjection(
      adjusting ? state.cuttingAdjustFootprintSessionId : undefined,
    )
    if (!projection) return true
    const currentIds = adjusting
      ? state.cuttingAdjustFootprintLocationIds
      : returning ? state.cuttingReturnLocationIds : state.cuttingPickupLocationIds
    if (warehouseMapNode.dataset.warehouseMapAction === 'clear-selection') {
      if (adjusting) {
        state.cuttingAdjustFootprintLocationIds = []
        refreshCuttingFootprintAdjustmentMap()
      } else if (returning) {
        state.cuttingReturnLocationIds = []
        refreshCuttingReturnLocationMap()
      } else {
        state.cuttingPickupLocationIds = []
        refreshCuttingPickupLocationMap()
      }
      return true
    }
    const result = toggleWarehouseLocationSelection(
      projection,
      currentIds,
      warehouseMapNode.dataset.locationId || '',
    )
    if (!result.ok) {
      window.alert(result.message)
      return true
    }
    if (adjusting) {
      state.cuttingAdjustFootprintLocationIds = result.selectedLocationIds
      refreshCuttingFootprintAdjustmentMap()
    } else if (returning) {
      state.cuttingReturnLocationIds = result.selectedLocationIds
      refreshCuttingReturnLocationMap()
    } else {
      state.cuttingPickupLocationIds = result.selectedLocationIds
      const refs = getSelectedCuttingPickupLocationRefs(projection)
      state.cuttingPickupWarehouseArea = refs[0]?.areaName || ''
      state.cuttingPickupLocationCode = refs[0]?.locationNo || ''
      refreshCuttingPickupLocationMap()
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-pda-warehouse-action]')
  const action = actionNode?.dataset.pdaWarehouseAction
  if (action === 'open-cutting-footprint-adjustment') {
    openCuttingFootprintAdjustment(actionNode?.dataset.pickupSessionId || '')
    return true
  }
  if (action === 'cancel-cutting-footprint-adjustment') {
    clearCuttingFootprintAdjustment()
    return true
  }
  if (action === 'confirm-cutting-footprint-adjustment') {
    const session = findPickupSessionById(state.cuttingAdjustFootprintSessionId)
    const projection = buildCuttingPickupMapProjection(state.cuttingAdjustFootprintSessionId)
    if (!session?.storageFootprint || !projection) {
      window.alert('接收记录或库位图已更新，请返回重试。')
      return true
    }
    if (JSON.stringify(session.storageFootprint) !== state.cuttingAdjustFootprintFingerprint) {
      window.alert('接收记录已被其他页面更新，请退出后重新调整。')
      return true
    }
    const remainingByUnit = session.storageFootprint.unitSummaries.map((summary) => ({
      unit: summary.unit,
      remainingQty: Number(state.cuttingAdjustRemainingByUnit[summary.unit]),
    }))
    if (remainingByUnit.some((item) => !Number.isFinite(item.remainingQty) || item.remainingQty < 0)) {
      window.alert('请输入正确的剩余数量。')
      return true
    }
    const hasRemaining = remainingByUnit.some((item) => item.remainingQty > 0)
    const selection = hasRemaining
      ? revalidatePdaCuttingFootprintAdjustmentSelection(projection, state.cuttingAdjustFootprintLocationIds)
      : { ok: true, message: '', selectedLocationIds: [] }
    if (!selection.ok) {
      window.alert(selection.message)
      return true
    }
    const selectedRefs = getSelectedCuttingPickupLocationRefs(
      projection,
      selection.selectedLocationIds,
    )
    const occurredAt = getCuttingRuntimeNowText()
    const transactionStorage = getBrowserLocalStorage()
    const beforePrepStore = transactionStorage?.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY) ?? null
    const beforeEventStore = transactionStorage?.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) ?? null
    try {
      updatePickupSessionStorageFootprint({
        pickupSessionId: session.pickupSessionId,
        locationRefs: selectedRefs.map((ref) => ({
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
        remainingByUnit,
      })
      const afterPrepStore = transactionStorage?.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY) ?? null
      appendCuttingRuntimeEvent({
        eventType: '待加工仓位置调整',
        operatorName: '裁床仓管',
        operatorRole: 'PDA 仓管',
        occurredAt,
        refs: {
          productionOrderId: session.productionOrderId,
          handoverRecordId: session.pickupSessionId,
        },
        inventoryEffect: {
          inventoryScope: '裁床待加工仓',
          direction: 'ADJUST',
          qty: remainingByUnit.reduce((sum, item) => sum + item.remainingQty, 0),
          unit: (remainingByUnit[0]?.unit || '件') as CuttingRuntimeQtyUnit,
          toWarehouseArea: selectedRefs[0]?.areaName || '',
          toLocationCode: selectedRefs[0]?.locationNo || '',
        },
        payload: {
          pickupSessionId: session.pickupSessionId,
          factoryId: projection.factoryId,
          warehouseId: projection.warehouseId,
          warehouseKind: projection.warehouseKind,
          previousLocationIds: session.storageFootprint.locationIds,
          warehouseLocations: selectedRefs.map((ref) => ({
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
          remainingByUnit,
          adjustedAt: occurredAt,
          adjustedBy: '裁床仓管',
        },
      })
      clearCuttingFootprintAdjustment()
    } catch (error) {
      if (transactionStorage) {
        const currentPrepStore = transactionStorage.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY) ?? null
        if (currentPrepStore === afterPrepStore) {
          if (beforePrepStore === null) transactionStorage.removeItem?.(PRODUCTION_MATERIAL_PREP_STORAGE_KEY)
          else transactionStorage.setItem?.(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, beforePrepStore)
        }
        const currentEventStore = transactionStorage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) ?? null
        if (currentEventStore === beforeEventStore) {
          if (beforeEventStore === null) transactionStorage.removeItem?.(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)
          else transactionStorage.setItem?.(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, beforeEventStore)
        }
      }
      window.alert(error instanceof Error ? error.message : '存放库位调整失败，请重试。')
    }
    return true
  }
  if (action === 'special-craft-wait-process-issue') {
    executeSpecialCraftWaitProcessIssue({
      stockItemId: actionNode.dataset.stockItemId || '',
      taskOrderId: actionNode.dataset.taskOrderId || '',
      skuCode: actionNode.dataset.skuCode || '',
    })
    return true
  }
  if (action === 'cutting-wp-pickup') {
    const pickupNodeId = actionNode?.dataset.pickupNodeId
    const pickupNodeVersion = actionNode?.dataset.pickupNodeVersion
    if (!pickupNodeId) {
      window.location.href = '/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup'
      return true
    }
    openCuttingPickupDraft(pickupNodeId, pickupNodeVersion || '')
    return true
  }
  if (action === 'cancel-cutting-wp-pickup') {
    clearCuttingPickupDraft()
    return true
  }
  if (action === 'toggle-cutting-pickup-difference') {
    state.cuttingPickupDifferenceOpen = !state.cuttingPickupDifferenceOpen
    return true
  }
  if (action === 'report-cutting-pickup-difference') {
    const node = listActivePickupNodes().find((item) => item.nodeId === state.cuttingPickupNodeId)
    if (!node || node.version !== Number(state.cuttingPickupNodeVersion)) {
      window.alert('当前待领物料已更新，请重新核对后再上报差异。')
      clearCuttingPickupDraft()
      return true
    }
    const item = node.items.find((candidate) => candidate.prepLineId === state.cuttingPickupDifferenceDemandLineId)
    if (!item) {
      window.alert('请选择存在差异的物料。')
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
        differenceQty: Number(state.cuttingPickupDifferenceQty),
        unit: item.unit,
        carrierType: node.carrierType,
        carrierLabel: getPickupCarrierLabel(node),
        palletUnnumbered: node.carrierType === 'PALLET' && !node.palletId,
        operatorName: '裁床仓管',
        note: state.cuttingPickupDifferenceNote.trim(),
        photoName: state.cuttingPickupDifferencePhotoName,
      }, undefined, (nodeId) => listActivePickupNodes().find((candidate) => candidate.nodeId === nodeId) ?? null)
      state.cuttingPickupDifferenceOpen = false
      window.alert('接收差异已上报，已阻断本节点接收确认，请等待主管处理。')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '接收差异上报失败。')
    }
    return true
  }
  if (action === 'call-cutting-pickup-supervisor') {
    const discrepancyId = actionNode?.dataset.discrepancyId || ''
    if (discrepancyId) {
      requestPickupDiscrepancySupervisor(discrepancyId, '裁床仓管')
      window.alert('已通知裁床主管处理，并记录通知人和时间。')
    }
    return true
  }
  if (action === 'confirm-cutting-wp-pickup') {
    recoverPendingPickupWarehouseTransaction()
    const pickupNodeId = state.cuttingPickupNodeId
    if (!pickupNodeId) {
      window.alert('请先选择中转仓接收节点。')
      return true
    }
    const pickupNodeVersion = Number(state.cuttingPickupNodeVersion)
    const projection = buildCuttingPickupMapProjection()
    if (!projection) {
      window.alert('当前裁床工厂没有可用的待加工仓库位。')
      return true
    }
    const selection = revalidateWarehouseLocationSelection(projection, state.cuttingPickupLocationIds)
    if (!selection.ok) {
      state.cuttingPickupLocationIds = selection.selectedLocationIds
      refreshCuttingPickupLocationMap()
      window.alert(selection.message)
      return true
    }
    const selectedRefs = getSelectedCuttingPickupLocationRefs(projection, selection.selectedLocationIds)
    try {
      assertPickupNodeHasNoOpenDiscrepancy(pickupNodeId, pickupNodeVersion)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '当前节点存在接收差异，不可确认接收。')
      return true
    }
    try {
      confirmPickupNodeReceiptRuntime({
        pickupNodeId,
        pickupNodeVersion,
        receiverName: '裁床仓管',
        eventSource: 'PDA',
        operatorRole: 'PDA 仓管',
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
      window.history.replaceState({}, '', '/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup')
    } catch (e) {
      window.alert(e instanceof Error ? `接收流水写入失败：${e.message}。当前选择已保留，可直接重试。` : '接收流水写入失败，当前选择已保留，可直接重试。')
      return true
    }
    clearCuttingPickupDraft()
    return true
  }
  if (action === 'retry-cutting-pickup-sync') {
    const pickupSessionId = actionNode?.dataset.pickupSessionId || ''
    if (!pickupSessionId) return true
    const session = listMaterialPrepOrderProjections()
      .flatMap((projection) => projection.pickupSessions)
      .find((item) => item.pickupSessionId === pickupSessionId)
    if (!session) return true
    try {
      syncCuttingPickupSessionWarehouseFactsRuntime(session)
      recordPickupSessionWarehouseSyncResult(pickupSessionId, { status: '已回写' })
    } catch (error) {
      recordPickupSessionWarehouseSyncResult(pickupSessionId, {
        status: '回写异常待重试',
        message: error instanceof Error ? error.message : '待加工仓流水写入失败',
      })
    }
    return true
  }
  if (action === 'cutting-wp-issue') {
    const startContainer = actionNode?.closest<HTMLElement>('[data-cutting-issue-start]')
    const sourceNo = startContainer?.dataset.sourceNo || actionNode?.dataset.sourceNo || ''
    const row = findCuttingWaitProcessLedgerRow(sourceNo)
      || listMaterialLedgerProjections().find((item) => item.availableQty > 0)
      || getCuttingWaitProcessActionFallbackRow(listMaterialLedgerProjections())
    const sourceGroups = listCuttingIssueSourceGroups(row)
    const selectedBatch = startContainer
      ?.querySelector<HTMLSelectElement>('[data-cutting-issue-batch]')?.value || ''
    if (sourceGroups.length > 1 && !selectedBatch) {
      window.alert('请选择本次接收批次。')
      return true
    }
    const sourceKey = sourceGroups.length === 1 ? sourceGroups[0].sourceKey : selectedBatch
    openCuttingIssueDraft(row?.cutOrderNo || sourceNo, sourceKey)
    return true
  }
  if (action === 'cancel-cutting-wp-issue') {
    clearCuttingIssueDraft()
    return true
  }
  if (action === 'confirm-cutting-wp-issue') {
    const sourceNo = state.cuttingIssueSourceNo.trim()
    if (!sourceNo) {
      window.alert('请先扫码确认加工接收对象。')
      return true
    }
    const row = findCuttingWaitProcessLedgerRow(sourceNo)
    const issuedQty = Number(state.cuttingIssueQty)
    const rollCount = Number(state.cuttingIssueRollCount)
    if (!Number.isFinite(issuedQty) || issuedQty <= 0) {
      window.alert('请输入大于 0 的接收数量。')
      return true
    }
    if (!Number.isFinite(rollCount) || rollCount <= 0) {
      window.alert('请输入大于 0 的卷数。')
      return true
    }
    const sourceGroups = listCuttingIssueSourceGroups(row)
    const selectedSourceKey = state.cuttingIssuePickupSessionId
      || (sourceGroups.length === 1 ? sourceGroups[0].sourceKey : '')
    if (!state.cuttingIssuePickupSessionId && sourceGroups.length > 1) {
      window.alert('存在多次入仓记录，请先选择具体入仓记录。')
      return true
    }
    const selectedGroup = sourceGroups.find((group) => group.sourceKey === selectedSourceKey)
    const warehouseLocations = selectedGroup?.cells.map((entry) => entry.cell) || []
    if (!warehouseLocations.length) {
      window.alert('来源库位已更新，请重新选择加工接收对象。')
      return true
    }
    const warehouseArea = warehouseLocations[0].areaName
    const locationCode = warehouseLocations[0].locationNo
    const sourceInboundEventIds = selectedGroup?.sourceInboundEventIds || []
    const sourcePickupSessionIds = selectedGroup?.sourcePickupSessionIds || []
    if (!sourceInboundEventIds.length) {
      window.alert('当前存放记录缺少可核对的入仓关联，请刷新后重试。')
      return true
    }
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
      eventType: '待加工仓加工接收',
      operatorName: '裁床仓管',
      operatorRole: 'PDA 仓管',
      occurredAt,
      refs: buildCuttingRuntimeRefs(row, sourceNo),
      material: buildCuttingRuntimeMaterialSnapshot(row, sourceNo),
      pattern: buildCuttingRuntimePatternSnapshot(row),
      inventoryEffect,
      payload: {
        issueRecordId: `wp-out:${sourceNo}:${occurredAt}`,
        issueRecordNo: `加工接收-${sourceNo}`,
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
        pickupSessionId: sourcePickupSessionIds.length === 1 ? sourcePickupSessionIds[0] : undefined,
        sourceInboundEventIds,
        warehouseLocations: warehouseLocations.map((location) => ({
          factoryId: location.factoryId,
          warehouseId: location.warehouseId,
          warehouseKind: 'WAIT_PROCESS',
          areaId: location.areaId,
          areaName: location.areaName,
          shelfId: location.shelfId,
          shelfNo: location.shelfNo,
          locationId: location.locationId,
          locationNo: location.locationNo,
        })),
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
    const latestProjection = buildCuttingPickupMapProjection()
    if (!latestProjection) {
      window.alert('当前裁床工厂没有可用的待加工仓库位。')
      return true
    }
    const selection = revalidateWarehouseLocationSelection(latestProjection, state.cuttingReturnLocationIds)
    if (!selection.ok) {
      window.alert(selection.message)
      return true
    }
    const warehouseLocations = getSelectedCuttingPickupLocationRefs(latestProjection, selection.selectedLocationIds)
    const warehouseArea = warehouseLocations[0]?.areaName || ''
    const locationCode = warehouseLocations[0]?.locationNo || ''
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
        warehouseLocations: warehouseLocations.map((location) => ({
          factoryId: location.factoryId,
          warehouseId: location.warehouseId,
          warehouseKind: 'WAIT_PROCESS',
          areaId: location.areaId,
          areaName: location.areaName,
          shelfId: location.shelfId,
          shelfNo: location.shelfNo,
          locationId: location.locationId,
          locationNo: location.locationNo,
        })),
        storageFootprint: {
          footprintId: `wp-return:${sourceNo}:${occurredAt}`,
          sourceType: 'PICKUP_SESSION',
          sourceId: `wp-return:${sourceNo}:${occurredAt}`,
          locationIds: warehouseLocations.map((location) => location.locationId),
          totalQty: returnedQty,
          remainingQty: returnedQty,
          unit: 'yard',
          inboundAt: occurredAt,
          inboundBy: '裁床仓管',
        },
      },
    })
    clearCuttingReturnDraft()
    return true
  }
  if (action === 'open-wool-return' && actionNode.dataset.woolOrderId) {
    openWoolReturnDraft(actionNode.dataset.woolOrderId)
    return true
  }
  if (action === 'cancel-wool-return') {
    clearWoolReturnDraft()
    return true
  }
  if (action === 'confirm-wool-return') {
    const orderId = state.woolReturnSelectedOrderId || state.woolReturnSourceOrderId
    const runtime = getMobileWarehouseRuntimeContext()
    if (runtime?.factoryId !== OWN_WOOL_FACTORY_ID) {
      window.alert('当前账号不是毛织仓管，不能退回纱线。')
      return true
    }
    const [yarnSkuCode, batchNoValue] = state.woolReturnLocationId.split('|')
    if (!getWoolWorkOrderById(orderId) || !yarnSkuCode) {
      window.alert('未找到该毛织加工单，请重新选择来源毛织单。')
      return true
    }
    const recoveredWeightKg = Number(state.woolReturnQty.replace(/kg|公斤/g, '').trim())
    if (!Number.isFinite(recoveredWeightKg) || recoveredWeightKg <= 0) {
      window.alert('请输入大于 0 的重量。')
      return true
    }
    try {
      returnWoolYarn(orderId, {
        commandId: state.woolReturnCommandId || createWoolPdaWarehouseCommandId('RETURN'),
        yarnSkuCode,
        batchNo: batchNoValue || undefined,
        returnedQty: Math.round(recoveredWeightKg * 100) / 100,
        returnedAt: getWoolPdaWarehouseNowText(),
        returnedBy: 'PDA 毛织仓管',
      })
      clearWoolReturnDraft()
      state.woolReturnLocationId = ''
      state.woolReturnCommandId = ''
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '纱线退回失败，请叫主管处理。')
    }
    return true
  }
  if (action === 'confirm-wool-receive') {
    const runtime = getMobileWarehouseRuntimeContext()
    const order = getWoolWorkOrderById(state.woolReceiveScan)
    const qty = Number(state.woolReceiveQty)
    if (runtime?.factoryId !== OWN_WOOL_FACTORY_ID) {
      window.alert('当前账号不是毛织仓管，不能确认接收。')
      return true
    }
    if (!order || !state.woolReceiveLocationId) {
      window.alert('请选择毛织加工单和纱线 SKU。')
      return true
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      window.alert('请输入大于 0 的实入重量。')
      return true
    }
    try {
      const now = getWoolPdaWarehouseNowText()
      addWoolYarnReceipt(order.woolOrderId, {
        commandId: state.woolReceiveCommandId || createWoolPdaWarehouseCommandId('RECEIVE'),
        receiptNo: `PDA-${now.replace(/\D/g, '')}`,
        receivedAt: now,
        receivedBy: 'PDA 毛织仓管',
        lines: [{
          yarnSkuCode: state.woolReceiveLocationId,
          yarnName: state.woolReceiveLocationId,
          receivedQty: Math.round(qty * 100) / 100,
        }],
      })
      state.woolReceiveScan = ''
      state.woolReceiveQty = ''
      state.woolReceiveLocationId = ''
      state.woolReceiveCommandId = ''
      window.location.href = '/fcs/pda/warehouse/wait-process'
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '确认接收失败，请叫主管处理。')
    }
    return true
  }
  if (action === 'confirm-wool-issue') {
    const runtime = getMobileWarehouseRuntimeContext()
    const qty = Number(state.woolIssueQty)
    const [yarnSkuCode, batchNoValue] = state.woolIssueLocationId.split('|')
    if (runtime?.factoryId !== OWN_WOOL_FACTORY_ID) {
      window.alert('当前账号不是毛织仓管，不能领用纱线。')
      return true
    }
    if (!state.woolIssueOrderId || !yarnSkuCode) {
      window.alert('请选择毛织加工单和纱线库存。')
      return true
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      window.alert('请输入大于 0 的接收重量。')
      return true
    }
    try {
      issueWoolYarn(state.woolIssueOrderId, {
        commandId: state.woolIssueCommandId || createWoolPdaWarehouseCommandId('ISSUE'),
        yarnSkuCode,
        batchNo: batchNoValue || undefined,
        issuedQty: Math.round(qty * 100) / 100,
        issuedAt: getWoolPdaWarehouseNowText(),
        issuedBy: 'PDA 毛织仓管',
      })
      state.woolIssueOrderId = ''
      state.woolIssueQty = ''
      state.woolIssueLocationId = ''
      state.woolIssueCommandId = ''
      window.location.href = '/fcs/pda/warehouse/wait-process'
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '纱线领用失败，请叫主管处理。')
    }
    return true
  }
  if (action === 'confirm-wool-adjust') {
    const runtime = getMobileWarehouseRuntimeContext()
    const qty = Number(state.woolIssueQty)
    const stock = resolveWoolWaitProcessStockSelection(state.woolIssueLocationId)
    if (runtime?.factoryId !== OWN_WOOL_FACTORY_ID || !stock) {
      window.alert('当前账号或纱线库存已变化，请重新选择。')
      return true
    }
    if (!Number.isFinite(qty) || qty < 0 || !state.remark.trim()) {
      window.alert('请输入调整后数量和调整原因。')
      return true
    }
    if (!window.confirm(`确认将 ${stock.objectSkuCode} 调整为 ${qty} ${stock.unit}？`)) return true
    try {
      adjustWoolWarehouseStock({
        commandId: state.woolAdjustCommandId || createWoolPdaWarehouseCommandId('ADJUST'),
        woolOrderId: stock.woolOrderId,
        objectSkuCode: stock.objectSkuCode,
        batchNo: stock.batchNo,
        defaultLocationId: stock.defaultLocationId,
        afterQty: qty,
        reason: state.remark,
        operatedAt: getWoolPdaWarehouseNowText(),
        operatedBy: 'PDA 毛织仓管',
      })
      state.woolIssueQty = ''
      state.woolIssueLocationId = ''
      state.woolAdjustCommandId = ''
      state.remark = ''
      window.location.href = '/fcs/pda/warehouse/wait-process'
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '库存调整失败，请叫主管处理。')
    }
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
    const actionLabel = actionKey === 'receive' ? '接收入仓' : actionKey === 'issue' ? '加工接收' : '回收入仓'
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
  if (action === 'open-post-self-return-confirm' && actionNode.dataset.stockItemId) {
    const row = getPostFinishingWaitProcessRows().find((item) => item.warehouseRecordId === actionNode.dataset.stockItemId)
    if (!row) return true
    state.postFinishingConfirmRecordId = row.warehouseRecordId
    state.postFinishingConfirmQty = String(row.confirmedGarmentQty ?? row.submittedGarmentQty ?? row.inboundGarmentQty)
    state.postFinishingConfirmRemark = ''
    return true
  }
  if (action === 'close-post-self-return-confirm') {
    state.postFinishingConfirmRecordId = null
    state.postFinishingConfirmQty = ''
    state.postFinishingConfirmRemark = ''
    return true
  }
  if (action === 'confirm-post-self-return') {
    if (!state.postFinishingConfirmRecordId) return true
    const confirmedQty = Number(state.postFinishingConfirmQty)
    if (!Number.isFinite(confirmedQty) || confirmedQty < 0) {
      window.alert('请输入不小于 0 的后道确认数量。')
      return true
    }
    confirmPostFinishingSewingSelfReturnWarehouseRecord({
      warehouseRecordId: state.postFinishingConfirmRecordId,
      confirmedQty: Math.round(confirmedQty * 100) / 100,
      confirmerName: '后道仓管员',
      remark: state.postFinishingConfirmRemark,
    })
    state.postFinishingConfirmRecordId = null
    state.postFinishingConfirmQty = ''
    state.postFinishingConfirmRemark = ''
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
  if (field === 'cutting-adjust-remaining') {
    const unit = fieldNode?.dataset.unit || ''
    if (unit) state.cuttingAdjustRemainingByUnit[unit] = value
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
  if (field === 'post-self-return-confirm-qty') {
    state.postFinishingConfirmQty = value
    return true
  }
  if (field === 'post-self-return-confirm-remark') {
    state.postFinishingConfirmRemark = value
    return true
  }
  if (field === 'cutting-adjust-remaining') {
    const unit = fieldNode.dataset.unit || ''
    if (unit) state.cuttingAdjustRemainingByUnit[unit] = value
    return true
  }
  if (field === 'cutting-pickup-difference-line') {
    state.cuttingPickupDifferenceDemandLineId = value
    return true
  }
  if (field === 'cutting-pickup-difference-qty') {
    state.cuttingPickupDifferenceQty = value
    return true
  }
  if (field === 'cutting-pickup-difference-note') {
    state.cuttingPickupDifferenceNote = value
    return true
  }
  if (field === 'cutting-pickup-difference-photo') {
    state.cuttingPickupDifferencePhotoName = fieldNode instanceof HTMLInputElement
      ? fieldNode.files?.[0]?.name || ''
      : ''
    const selectedFileLabel = fieldNode
      .closest<HTMLElement>('[data-cutting-pickup-node-id]')
      ?.querySelector<HTMLElement>('[data-cutting-pickup-difference-photo-name]')
    if (selectedFileLabel) {
      selectedFileLabel.textContent = state.cuttingPickupDifferencePhotoName
        ? `已选择：${state.cuttingPickupDifferencePhotoName}`
        : ''
      selectedFileLabel.classList.toggle('hidden', !state.cuttingPickupDifferencePhotoName)
    }
    return true
  }
  if (field === 'cutting-issue-area') {
    state.cuttingIssueWarehouseArea = value
    const nextArea = listCuttingReceiveLocations().find((item) => item.area === value)
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
    const stock = getWoolWaitProcessStocks().find((item) => item.woolOrderId === value)
    if (stock) state.woolReturnLocationId = `${stock.objectSkuCode}|${stock.batchNo || ''}`
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
    const order = getWoolWorkOrderById(value)
    state.woolReceiveLocationId = order?.outputPlanLines.flatMap((line) => line.requiredYarnSkus)[0] || ''
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
    const stock = getWoolWaitProcessStocks().find((item) => item.woolOrderId === value && item.currentQty > 0)
    if (stock) {
      state.woolIssueLocationId = `${stock.objectSkuCode}|${stock.batchNo || ''}`
      state.woolIssueQty = String(Math.min(stock.currentQty, 1))
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
