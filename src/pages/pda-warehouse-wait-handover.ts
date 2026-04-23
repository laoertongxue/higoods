import {
  listFactoryWaitHandoverStockItems,
  updateWaitHandoverStockLocation,
} from '../data/fcs/factory-internal-warehouse.ts'
import { renderPdaFrame } from './pda-shell'
import {
  buildWarehouseDifferenceText,
  escapeAttr,
  formatWarehouseDateTime,
  getCurrentFactoryWarehouseByKind,
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

type WaitHandoverFilter = '全部' | '待交出' | '已交出' | '已回写' | '差异' | '异议中'

interface WaitHandoverState {
  status: WaitHandoverFilter
  detailId: string | null
  locationEditId: string | null
  areaName: string
  shelfNo: string
  locationNo: string
  remark: string
}

const state: WaitHandoverState = {
  status: '全部',
  detailId: null,
  locationEditId: null,
  areaName: '',
  shelfNo: '',
  locationNo: '',
  remark: '',
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
            { label: '原数量 / 当前数量', value: specialCraftSummary ? `${specialCraftSummary.originalQty} / ${specialCraftSummary.currentQty}` : '-' },
            { label: '报废数量 / 货损数量', value: specialCraftSummary ? `${specialCraftSummary.cumulativeScrapQty} / ${specialCraftSummary.cumulativeDamageQty}` : '-' },
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

export function renderPdaWarehouseWaitHandoverPage(): string {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return renderPdaFrame(renderMobilePageEmptyState('未登录', '请先登录工厂端移动应用。'), 'warehouse')

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
                                        <div>原数量 / 当前数量：${specialCraftSummary.originalQty} / ${specialCraftSummary.currentQty}</div>
                                        <div>报废数量 / 货损数量：${specialCraftSummary.cumulativeScrapQty} / ${specialCraftSummary.cumulativeDamageQty}</div>
                                        <div>差异状态：${escapeHtml([specialCraftSummary.receiveDifferenceStatus, specialCraftSummary.returnDifferenceStatus].filter((item) => item && item !== '—').join(' / ') || '无')}</div>
                                        <div>发料状态 / 回仓状态：${escapeHtml(specialCraftSummary.dispatchStatus)} / ${escapeHtml(specialCraftSummary.returnStatus)}</div>`
                              })()
                            : ''
                        }
                        <div>卷号：${escapeHtml(row.fabricRollNo || '-')}</div>
                        <div>加工完成数量 / 损耗数量：${row.completedQty} / ${row.lossQty} ${escapeHtml(row.unit)}</div>
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

  return renderPdaFrame(content, 'warehouse', { headerTitle: '待交出仓' })
}

export function handlePdaWarehouseWaitHandoverEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pda-warehouse-action]')
  const action = actionNode?.dataset.pdaWarehouseAction
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
  return false
}
