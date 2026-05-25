import {
  listFactoryWaitProcessStockItems,
  updateWaitProcessStockLocation,
} from '../data/fcs/factory-internal-warehouse.ts'
import { OWN_WOOL_FACTORY_ID } from '../data/fcs/factory-mock-data.ts'
import type { PostFinishingWaitProcessWarehouseRecord } from '../data/fcs/post-finishing-domain.ts'
import {
  FULL_CAPABILITY_FACTORY_ID,
  listPostFinishingWaitProcessWarehouseRecords,
} from '../data/fcs/post-finishing-domain.ts'
import {
  getWoolWorkOrderById,
  getWoolYarnUsageSummary,
  listWoolWaitProcessReceiptRecords,
  listWoolWaitProcessUsageRecords,
  listWoolWorkOrders,
  listWoolWarehouseInventory,
  recoverWoolYarnToWaitProcessWarehouse,
} from '../data/fcs/wool-task-domain.ts'
import {
  listMaterialLedgerProjections,
  type MaterialLedgerProjection,
} from '../data/fcs/cutting/material-ledger.ts'
import {
  appendCuttingRuntimeEvent,
  listCuttingRuntimeEventsByType,
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
}

const state: WaitProcessState = {
  status: '全部',
  detailId: null,
  locationEditId: null,
  areaName: '',
  shelfNo: '',
  locationNo: '',
  remark: '',
}

const FILTERS: Array<{ value: WaitProcessFilter; label: string }> = [
  { value: '全部', label: '全部' },
  { value: '待领料', label: '待领料' },
  { value: '已入待加工仓', label: '已入待加工仓' },
  { value: '差异待处理', label: '差异待处理' },
]

function formatCuttingWaitProcessQty(qty: number, unit = '米'): string {
  const rollCount = qty <= 0 ? 0 : Math.max(Math.ceil(qty / 280), 1)
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(qty)} ${unit} / ${rollCount} 卷`
}

function normalizeCuttingRuntimeQtyUnit(unit: string | undefined): CuttingRuntimeQtyUnit {
  return unit === '片' || unit === '件' ? unit : '米'
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

function renderCuttingPendingPickupList(rows: MaterialLedgerProjection[]): string {
  const pickedCutOrders = new Set(
    listCuttingRuntimeEventsByType('中转仓领料')
      .map((event) => event.refs.cutOrderNo)
      .filter(Boolean),
  )
  const pendingRows = rows
    .filter((row) => row.transferWarehouseAllocatedQty > 0)
    .filter((row) => !pickedCutOrders.has(row.cutOrderNo))
    .slice(0, 4)

  return `
    <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-base font-semibold text-foreground">待领料</div>
          <div class="mt-1 text-xs text-muted-foreground">上游已配料，仓管先确认中转仓领料，再扫码入待加工仓。</div>
        </div>
        ${renderStatusPill(`${pendingRows.length} 条`)}
      </div>
      <div class="mt-3 space-y-2">
        ${pendingRows.length
          ? pendingRows.map((row) => `
              <button
                type="button"
                class="w-full rounded-xl border bg-background px-3 py-3 text-left"
                data-pda-warehouse-action="cutting-wp-pickup"
                data-source-no="${escapeAttr(row.cutOrderNo)}"
              >
                <div class="text-sm font-semibold text-foreground">${escapeHtml(row.cutOrderNo)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.materialIdentity.materialSku)} · ${escapeHtml(row.materialIdentity.materialName)}</div>
                <div class="mt-1 text-xs text-muted-foreground">中转仓已配：${escapeHtml(formatCuttingWaitProcessQty(row.transferWarehouseAllocatedQty, row.unit))}</div>
              </button>
            `).join('')
          : '<div class="rounded-xl bg-muted/60 px-3 py-3 text-xs text-muted-foreground">暂无待领料通知。</div>'}
      </div>
    </section>
  `
}

function renderCuttingWaitProcessActionCards(): string {
  const actions = [
    { action: 'cutting-wp-pickup', title: '中转仓领料', desc: '按待领料通知到中转仓领料，记录领料数量和卷数。' },
    { action: 'cutting-wp-receive', title: '扫码入仓', desc: '扫领料单或裁片单，确认收货库区、库位和卷数。' },
    { action: 'cutting-wp-issue', title: '加工领料', desc: '扫铺布单，从指定库区库位领走面料去加工。' },
    { action: 'cutting-wp-return', title: '回收入仓', desc: '铺布剩余面料扫码回收，记录回收库区库位。' },
  ]
  return `
    <section class="grid grid-cols-1 gap-2">
      ${actions.map((item) => `
        <button
          type="button"
          class="rounded-2xl border bg-card px-4 py-4 text-left shadow-sm"
          data-pda-warehouse-action="${escapeAttr(item.action)}"
        >
          <div class="text-base font-semibold text-foreground">${escapeHtml(item.title)}</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">${escapeHtml(item.desc)}</div>
        </button>
      `).join('')}
    </section>
  `
}

function renderCuttingWaitProcessRow(row: MaterialLedgerProjection, index: number): string {
  const area = index % 2 === 0 ? '面料 A 区' : '面料 B 区'
  const location = `FAB-${index % 2 === 0 ? 'A' : 'B'}-${String((index % 6) + 1).padStart(2, '0')}`
  const latestClaimText = row.latestClaimEvent
    ? `${row.latestClaimEvent.occurredAt} / ${row.latestClaimEvent.operatorName}`
    : '暂无领料记录'
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
        <div>库区库位：${escapeHtml(area)} / ${escapeHtml(location)}</div>
        <div>裁床已领：${escapeHtml(formatCuttingWaitProcessQty(row.cuttingClaimedQty, row.unit))}</div>
        <div>可用余额：${escapeHtml(formatCuttingWaitProcessQty(row.availableQty, row.unit))}</div>
        <div>最近领料：${escapeHtml(latestClaimText)}</div>
      </div>
    </article>
  `
}

function renderCuttingWaitProcessPage(): string {
  const rows = listMaterialLedgerProjections()
  const stockedRows = rows.filter((row) => row.cuttingClaimedQty > 0 || row.availableQty >= 0)
  const totalAvailable = rows.reduce((sum, row) => sum + row.availableQty, 0)
  const totalClaimed = rows.reduce((sum, row) => sum + row.cuttingClaimedQty, 0)
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="grid grid-cols-2 gap-2">
        <button type="button" class="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground" data-nav="/fcs/pda/warehouse/wait-process?scope=cutting">裁床待加工仓</button>
        <button type="button" class="rounded-2xl border bg-background px-4 py-3 text-sm font-medium" data-nav="/fcs/pda/warehouse/wait-handover?scope=cutting">裁床待交出仓</button>
      </section>
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <div class="text-lg font-semibold text-foreground">裁床待加工仓</div>
        <div class="mt-1 text-xs text-muted-foreground">仓管按顺序处理：待领料、中转仓领料、扫码入仓、加工领料、回收入仓。</div>
        <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div class="rounded-xl bg-muted/60 px-3 py-3">
            <div class="text-muted-foreground">裁床已领</div>
            <div class="mt-1 text-base font-semibold">${escapeHtml(formatCuttingWaitProcessQty(totalClaimed))}</div>
          </div>
          <div class="rounded-xl bg-muted/60 px-3 py-3">
            <div class="text-muted-foreground">当前可用</div>
            <div class="mt-1 text-base font-semibold">${escapeHtml(formatCuttingWaitProcessQty(totalAvailable))}</div>
          </div>
        </div>
      </section>
      ${renderCuttingPendingPickupList(rows)}
      ${renderCuttingWaitProcessActionCards()}
      <section class="space-y-3">
        ${stockedRows.length
          ? stockedRows.slice(0, 8).map((row, index) => renderCuttingWaitProcessRow(row, index)).join('')
          : renderMobilePageEmptyState('暂无裁床待加工库存', '扫码收货后会形成裁床待加工仓库存。')}
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

function renderWoolWaitProcessPage(): string {
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

  const rows = getRows()
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderWarehouseSummaryHeader('待加工仓', '待领料确认后进入待加工仓，并承接入库记录。', runtime.overview)}
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
            : renderMobilePageEmptyState('暂无待加工仓记录', '待领料确认后，会自动生成入库记录并进入待加工仓。')
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
    const sourceNo = actionNode?.dataset.sourceNo || window.prompt('请扫描待领料通知、配料单或裁片单二维码')?.trim()
    if (!sourceNo) return true
    const row = findCuttingWaitProcessLedgerRow(sourceNo)
    const qtyText = window.prompt('请输入中转仓领料数量和卷数', formatCuttingWaitProcessQty(row?.transferWarehouseAllocatedQty || 120, row?.unit))?.trim()
    if (!qtyText) return true
    const occurredAt = getCuttingRuntimeNowText()
    const { qty, rollCount, displayText } = parseCuttingQtyAndRoll(qtyText, row?.transferWarehouseAllocatedQty || 0)
    const rollNos = buildCuttingRollNos(sourceNo, rollCount)
    const event = appendCuttingRuntimeEvent({
      eventType: '中转仓领料',
      operatorName: '裁床仓管',
      operatorRole: 'PDA 仓管',
      occurredAt,
      refs: buildCuttingRuntimeRefs(row, sourceNo),
      material: buildCuttingRuntimeMaterialSnapshot(row, sourceNo),
      pattern: buildCuttingRuntimePatternSnapshot(row),
      payload: {
        pickupRecordId: `pickup:${sourceNo}:${occurredAt}`,
        pickupRecordNo: `领料-${sourceNo}`,
        prepNoticeId: `prep:${sourceNo}`,
        prepOrderNo: sourceNo,
        pickupQty: qty,
        unit: '米',
        rollCount,
        rollNos,
        pickupBy: '裁床仓管',
        pickupAt: occurredAt,
        hasDifference: false,
      },
    })
    window.alert(`已记录中转仓领料：${sourceNo}，领料 ${displayText}。事件：${event.eventNo}，同步状态：${event.eventStatus}。`)
    return true
  }
  if (action === 'cutting-wp-receive') {
    const sourceNo = window.prompt('请扫描领料单或裁片单二维码')?.trim()
    if (!sourceNo) return true
    const location = window.prompt('请输入收货库区库位', '面料 A 区 / FAB-A-01')?.trim()
    if (!location) return true
    const row = findCuttingWaitProcessLedgerRow(sourceNo)
    const qtyText = window.prompt('请输入扫码入仓数量和卷数', formatCuttingWaitProcessQty(row?.cuttingClaimedQty || row?.transferWarehouseAllocatedQty || 120, row?.unit))?.trim()
    if (!qtyText) return true
    const occurredAt = getCuttingRuntimeNowText()
    const { qty, rollCount, displayText } = parseCuttingQtyAndRoll(qtyText, row?.cuttingClaimedQty || 0)
    const { warehouseArea, locationCode } = splitCuttingLocationText(location)
    const inventoryEffect: RuntimeInventoryEffect = {
      inventoryScope: '裁床待加工仓',
      direction: 'IN',
      qty,
      unit: '米',
      rollCount,
      toWarehouseArea: warehouseArea,
      toLocationCode: locationCode,
    }
    const event = appendCuttingRuntimeEvent({
      eventType: '待加工仓扫码入仓',
      operatorName: '裁床仓管',
      operatorRole: 'PDA 仓管',
      occurredAt,
      refs: buildCuttingRuntimeRefs(row, sourceNo),
      material: buildCuttingRuntimeMaterialSnapshot(row, sourceNo),
      pattern: buildCuttingRuntimePatternSnapshot(row),
      inventoryEffect,
      payload: {
        inboundRecordId: `wp-in:${sourceNo}:${occurredAt}`,
        inboundRecordNo: `入仓-${sourceNo}`,
        pickupRecordId: `pickup:${sourceNo}`,
        materialSku: row?.materialIdentity.materialSku || sourceNo,
        receivedQty: qty,
        unit: '米',
        rollCount,
        rollNos: buildCuttingRollNos(sourceNo, rollCount),
        warehouseArea,
        locationCode,
        receivedBy: '裁床仓管',
        receivedAt: occurredAt,
        checkResult: '正常',
      },
    })
    window.alert(`已记录扫码入仓：${sourceNo}，入库位置：${warehouseArea} / ${locationCode}，数量 ${displayText}。事件：${event.eventNo}，同步状态：${event.eventStatus}。`)
    return true
  }
  if (action === 'cutting-wp-issue') {
    const sourceNo = window.prompt('请扫描铺布单或裁片单二维码')?.trim()
    if (!sourceNo) return true
    const location = window.prompt('请输入领料库区库位', '面料 A 区 / FAB-A-01')?.trim()
    if (!location) return true
    const qty = window.prompt('请输入加工领料数量和卷数', '120 米 / 1 卷')?.trim()
    if (!qty) return true
    const row = findCuttingWaitProcessLedgerRow(sourceNo)
    const occurredAt = getCuttingRuntimeNowText()
    const { qty: issuedQty, rollCount, displayText } = parseCuttingQtyAndRoll(qty, 120)
    const { warehouseArea, locationCode } = splitCuttingLocationText(location)
    const inventoryEffect: RuntimeInventoryEffect = {
      inventoryScope: '裁床待加工仓',
      direction: 'OUT',
      qty: issuedQty,
      unit: '米',
      rollCount,
      fromWarehouseArea: warehouseArea,
      fromLocationCode: locationCode,
    }
    const event = appendCuttingRuntimeEvent({
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
        unit: '米',
        rollCount,
        rollNos: buildCuttingRollNos(sourceNo, rollCount),
        fromWarehouseArea: warehouseArea,
        fromLocationCode: locationCode,
        issuedBy: '裁床仓管',
        issuedAt: occurredAt,
        purpose: '铺布用料',
      },
    })
    window.alert(`已记录加工领料：${sourceNo}，从 ${warehouseArea} / ${locationCode} 领用 ${displayText}。事件：${event.eventNo}，同步状态：${event.eventStatus}。`)
    return true
  }
  if (action === 'cutting-wp-return') {
    const sourceNo = window.prompt('请扫描铺布单或布卷码')?.trim()
    if (!sourceNo) return true
    const qty = window.prompt('请输入回收入仓数量和卷数', '35 米 / 1 卷')?.trim()
    if (!qty) return true
    const location = window.prompt('请输入回收入库区库位', '面料 A 区 / FAB-A-02')?.trim()
    if (!location) return true
    const row = findCuttingWaitProcessLedgerRow(sourceNo)
    const occurredAt = getCuttingRuntimeNowText()
    const { qty: returnedQty, rollCount, displayText } = parseCuttingQtyAndRoll(qty, 35)
    const { warehouseArea, locationCode } = splitCuttingLocationText(location)
    const inventoryEffect: RuntimeInventoryEffect = {
      inventoryScope: '裁床待加工仓',
      direction: 'IN',
      qty: returnedQty,
      unit: '米',
      rollCount,
      toWarehouseArea: warehouseArea,
      toLocationCode: locationCode,
    }
    const event = appendCuttingRuntimeEvent({
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
        spreadingOrderId: sourceNo,
        spreadingOrderNo: sourceNo,
        materialSku: row?.materialIdentity.materialSku || sourceNo,
        returnedQty,
        unit: '米',
        rollCount,
        rollNos: buildCuttingRollNos(sourceNo, rollCount),
        warehouseArea,
        locationCode,
        returnedBy: '裁床仓管',
        returnedAt: occurredAt,
        reason: '铺布剩余',
      },
    })
    window.alert(`已记录回收入仓：${sourceNo}，回收 ${displayText} 到 ${warehouseArea} / ${locationCode}。事件：${event.eventNo}，同步状态：${event.eventStatus}。`)
    return true
  }
  if (action === 'recover-wool-yarn' && actionNode.dataset.woolOrderId) {
    const relatedOrderNos = (actionNode.dataset.relatedOrderNos || '')
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean)
    const selectedOrderNo = relatedOrderNos.length > 1
      ? window.prompt('请输入回收来源毛织单号', relatedOrderNos[0])?.trim()
      : relatedOrderNos[0]
    if (selectedOrderNo === undefined) return true
    const order = selectedOrderNo
      ? listWoolWorkOrders().find((item) => item.woolOrderNo === selectedOrderNo || item.woolOrderId === selectedOrderNo)
      : getWoolWorkOrderById(actionNode.dataset.woolOrderId)
    if (!order) {
      window.alert('未找到该毛织加工单，请重新选择来源毛织单。')
      return true
    }
    const usage = order ? getWoolYarnUsageSummary(order) : null
    const defaultQty = usage ? Math.max(usage.linkingLossWeightKg - usage.recoveredWeightKg, 0) : 0
    const rawValue = window.prompt('请输入回收入仓纱线重量（kg）', String(defaultQty))?.trim()
    if (rawValue === undefined) return true
    const recoveredWeightKg = Number(rawValue.replace(/kg|公斤/g, '').trim())
    if (!Number.isFinite(recoveredWeightKg) || recoveredWeightKg <= 0) {
      window.alert('请输入大于 0 的重量。')
      return true
    }
    recoverWoolYarnToWaitProcessWarehouse(order.woolOrderId, Math.round(recoveredWeightKg * 100) / 100, '工厂端仓管')
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

  return false
}
