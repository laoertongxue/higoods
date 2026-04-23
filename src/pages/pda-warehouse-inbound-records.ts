import { listFactoryWarehouseInboundRecords } from '../data/fcs/factory-internal-warehouse.ts'
import { renderPdaFrame } from './pda-shell'
import {
  buildWarehouseDifferenceText,
  escapeAttr,
  formatWarehouseDateTime,
  getMobileWarehouseSearchParams,
  getMobileWarehouseRuntimeContext,
  getWarehouseGeneratedModeLabel,
  getWaitProcessSourceActionLabel,
  renderCompactFieldList,
  renderMobilePageEmptyState,
  renderSectionFilterChips,
  renderStatusPill,
  renderWarehouseSummaryHeader,
  resolveInboundSourceRoute,
} from './pda-warehouse-shared'
import { escapeHtml } from '../utils'
import { getSpecialCraftFeiTicketSummary } from '../data/fcs/cutting/special-craft-fei-ticket-flow.ts'

type InboundFilter = '全部' | '已入库' | '差异待处理'

interface InboundState {
  status: InboundFilter
  detailId: string | null
  querySyncKey: string
}

const state: InboundState = {
  status: '全部',
  detailId: null,
  querySyncKey: '',
}

const FILTERS: Array<{ value: InboundFilter; label: string }> = [
  { value: '全部', label: '全部' },
  { value: '已入库', label: '已入库' },
  { value: '差异待处理', label: '差异待处理' },
]

function getRows() {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return []
  return listFactoryWarehouseInboundRecords()
    .filter((item) => item.factoryId === runtime.factoryId)
    .filter((item) => (state.status === '全部' ? true : item.status === state.status))
}

function syncStateFromQuery(): void {
  const params = getMobileWarehouseSearchParams()
  const nextKey = params.toString()
  if (state.querySyncKey === nextKey) return
  state.querySyncKey = nextKey
  const status = params.get('status')
  if (status && FILTERS.some((item) => item.value === status)) {
    state.status = status as InboundFilter
  }
  const recordId = params.get('recordId')
  state.detailId = recordId || null
}

function renderDetailDrawer(): string {
  const row = getRows().find((item) => item.inboundRecordId === state.detailId)
  if (!row) return ''
  const specialCraftSummary = row.feiTicketNo ? getSpecialCraftFeiTicketSummary(row.feiTicketNo) : null
  return `
    <div class="fixed inset-0 z-[120]">
      <button type="button" class="absolute inset-0 bg-black/40" data-pda-warehouse-action="close-inbound-detail"></button>
      <section class="absolute inset-x-0 bottom-[72px] rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-foreground">入库记录</h2>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-warehouse-action="close-inbound-detail">关闭</button>
        </div>
        <div class="mt-4 rounded-2xl border bg-card px-4 py-4 shadow-sm">
          ${renderCompactFieldList([
            { label: '入库单号', value: row.inboundRecordNo },
            { label: '来源动作', value: getWaitProcessSourceActionLabel({ sourceRecordType: row.sourceRecordType }) },
            { label: '生成方式', value: getWarehouseGeneratedModeLabel() },
            { label: '入库仓', value: row.warehouseName },
            { label: '来源单号', value: row.sourceRecordNo },
            { label: '来源对象', value: row.sourceObjectName },
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
            { label: '原数量 / 当前数量', value: specialCraftSummary ? `${specialCraftSummary.originalQty} / ${specialCraftSummary.currentQty}` : '-' },
            { label: '报废数量 / 货损数量', value: specialCraftSummary ? `${specialCraftSummary.cumulativeScrapQty} / ${specialCraftSummary.cumulativeDamageQty}` : '-' },
            { label: '差异状态', value: specialCraftSummary ? [specialCraftSummary.receiveDifferenceStatus, specialCraftSummary.returnDifferenceStatus].filter((item) => item && item !== '—').join(' / ') || '无' : '-' },
            { label: '发料状态 / 回仓状态', value: specialCraftSummary ? `${specialCraftSummary.dispatchStatus} / ${specialCraftSummary.returnStatus}` : '-' },
            { label: '中转袋号', value: row.transferBagNo || '-' },
            { label: '卷号', value: row.fabricRollNo || '-' },
            { label: '应收数量', value: `${row.expectedQty} ${row.unit}` },
            { label: '实收数量', value: `${row.receivedQty} ${row.unit}` },
            { label: '差异数量', value: buildWarehouseDifferenceText(row.differenceQty) },
            { label: '库区 / 货架 / 库位', value: `${row.areaName} / ${row.shelfNo} / ${row.locationNo}` },
            { label: '操作人', value: row.receiverName },
            { label: '操作时间', value: formatWarehouseDateTime(row.receivedAt) },
            { label: '状态', value: row.status },
          ])}
          <div class="mt-4 flex gap-2">
            <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-nav="${escapeAttr(resolveInboundSourceRoute(row))}">查看来源</button>
            ${
              row.differenceQty !== 0
                ? '<button type="button" class="flex-1 rounded-xl border border-destructive/30 px-3 py-2.5 text-sm text-destructive">查看差异</button>'
                : ''
            }
          </div>
        </div>
      </section>
    </div>
  `
}

export function renderPdaWarehouseInboundRecordsPage(): string {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return renderPdaFrame(renderMobilePageEmptyState('未登录', '请先登录工厂端移动应用。'), 'warehouse')
  syncStateFromQuery()
  const rows = getRows()
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderWarehouseSummaryHeader('入库记录', '待领料确认和交出接收后，自动生成入库记录。', runtime.overview)}
      ${renderSectionFilterChips(state.status, FILTERS, 'inbound-status')}
      <section class="space-y-3">
        ${
          rows.length > 0
            ? rows
                .map(
                  (row) => `
                    <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0 flex-1">
                          <div class="text-sm font-semibold text-foreground">${escapeHtml(row.inboundRecordNo)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.sourceRecordNo)} · ${escapeHtml(row.sourceObjectName)}</div>
                        </div>
                        ${renderStatusPill(row.status)}
                      </div>
                      <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
                        <div>来源动作：${escapeHtml(getWaitProcessSourceActionLabel({ sourceRecordType: row.sourceRecordType }))}</div>
                        <div>生成方式：${escapeHtml(getWarehouseGeneratedModeLabel())}</div>
                        <div>入库仓：${escapeHtml(row.warehouseName)}</div>
                        <div>所属任务：${escapeHtml(row.taskNo || '-')}</div>
                        <div>物料 / 裁片类型：${escapeHtml(`${row.itemKind} / ${row.itemName}`)}</div>
                        <div>面料 SKU / 裁片部位：${escapeHtml(row.materialSku || row.partName || '-')}</div>
                        <div>颜色 / 尺码：${escapeHtml(row.fabricColor || '-')} / ${escapeHtml(row.sizeCode || '-')}</div>
                        <div>菲票号 / 中转袋号 / 袋内菲票数：${escapeHtml(row.feiTicketNo || '-')} / ${escapeHtml(row.transferBagNo || '-')} / ${row.transferBagNo ? '查看中转袋' : '-'}</div>
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
                        <div>应收数量 / 实收数量：${row.expectedQty} / ${row.receivedQty} ${escapeHtml(row.unit)}</div>
                        <div>库区 / 货架 / 库位：${escapeHtml(row.areaName)} / ${escapeHtml(row.shelfNo)} / ${escapeHtml(row.locationNo)}</div>
                        <div>操作时间：${escapeHtml(formatWarehouseDateTime(row.receivedAt))}</div>
                      </div>
                      <div class="mt-4 flex flex-wrap gap-2">
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-inbound-detail" data-record-id="${escapeAttr(row.inboundRecordId)}">查看</button>
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveInboundSourceRoute(row))}">查看来源</button>
                        ${
                          row.differenceQty !== 0
                            ? `<button type="button" class="rounded-full border border-destructive/30 px-3 py-1.5 text-xs text-destructive" data-pda-warehouse-action="open-inbound-detail" data-record-id="${escapeAttr(row.inboundRecordId)}">查看差异</button>`
                            : ''
                        }
                      </div>
                    </article>
                  `,
                )
                .join('')
            : renderMobilePageEmptyState('暂无入库记录', '待领料确认或交出接收后，会自动生成入库记录。')
        }
      </section>
      ${renderDetailDrawer()}
    </div>
  `

  return renderPdaFrame(content, 'warehouse', { headerTitle: '入库记录' })
}

export function handlePdaWarehouseInboundRecordsEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pda-warehouse-action]')
  const action = actionNode?.dataset.pdaWarehouseAction
  if (action === 'open-inbound-detail' && actionNode.dataset.recordId) {
    state.detailId = actionNode.dataset.recordId
    return true
  }
  if (action === 'close-inbound-detail') {
    state.detailId = null
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-pda-warehouse-field]')
  if (fieldNode?.dataset.pdaWarehouseField === 'inbound-status') {
    state.status = (fieldNode.dataset.value || '') as InboundFilter
    return true
  }
  return false
}
