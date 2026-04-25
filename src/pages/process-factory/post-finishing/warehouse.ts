import {
  buildHandoverQrLabelPrintLink,
  buildTaskDeliveryCardPrintLink,
  buildPostFinishingWorkOrderDetailLink,
} from '../../../data/fcs/fcs-route-links.ts'
import {
  getHandoverRecordsByWarehouseRecordId,
  listWaitHandoverWarehouseRecords,
  listWaitProcessWarehouseRecords,
} from '../../../data/fcs/process-warehouse-domain.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatGarmentQty,
  renderPostAction,
  renderPostFinishingPageHeader,
  renderPostSection,
  renderPostStatusBadge,
  renderPostTable,
} from './shared.ts'

function getPostOrderIdFilter(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('postOrderId') || ''
}

function matchesPostOrderFilter(record: { sourceWorkOrderId: string; sourceWorkOrderNo: string }, postOrderId: string): boolean {
  return !postOrderId || record.sourceWorkOrderId === postOrderId || record.sourceWorkOrderNo === postOrderId
}

function renderFilterHint(postOrderId: string, empty = false): string {
  if (!postOrderId) return ''
  return `
    <div class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
      已按后道单定位：<span class="font-mono">${escapeHtml(postOrderId)}</span>${empty ? '，当前没有匹配的仓记录。' : ''}
    </div>
  `
}

export function renderPostFinishingWaitProcessWarehousePage(): string {
  const postOrderId = getPostOrderIdFilter()
  const records = listWaitProcessWarehouseRecords({ craftType: 'POST_FINISHING' }).filter((record) =>
    matchesPostOrderFilter(record, postOrderId),
  )
  const rows = records
    .map((record) => `
      <tr class="align-top ${postOrderId ? 'bg-blue-50/60' : ''}">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.warehouseRecordNo)}</td>
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.sourceWorkOrderNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceTaskNo || '—')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.remark.includes('车缝厂已完成后道') ? '车缝厂已完成后道' : '后道工厂执行')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceFactoryName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.targetFactoryName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceProductionOrderNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.skuSummary)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(record.availableObjectQty || record.receivedObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.currentActionName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.warehouseLocation)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.inboundAt || record.createdAt)}</td>
        <td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td>
        <td class="px-3 py-3">${renderPostAction('查看后道单', buildPostFinishingWorkOrderDetailLink(record.sourceWorkOrderId, 'receive'))}</td>
      </tr>
    `)
    .join('')
  const bodyRows =
    rows ||
    `<tr><td colspan="14" class="px-3 py-8 text-center text-sm text-muted-foreground">未找到对应后道单的待加工仓记录。</td></tr>`

  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('后道待加工仓', '承接后道工厂接收领料、质检、后道、复检；车缝厂已完成后道的任务不再进入待后道。')}
      ${renderFilterHint(postOrderId, records.length === 0)}
      ${renderPostSection(
        '待加工仓记录',
        renderPostTable(
          ['入仓记录号', '后道单号', '来源车缝任务', '后道来源', '来源工厂', '后道工厂', '生产单', 'SKU', '待处理成衣件数', '当前待处理动作', '仓内位置', '入仓时间', '状态', '操作'],
          bodyRows,
          'min-w-[1540px]',
        ),
      )}
    </div>
  `
}

export function renderPostFinishingWaitHandoverWarehousePage(): string {
  const postOrderId = getPostOrderIdFilter()
  const records = listWaitHandoverWarehouseRecords({ craftType: 'POST_FINISHING' }).filter((record) =>
    matchesPostOrderFilter(record, postOrderId),
  )
  const rows = records
    .map((record) => {
      const handovers = getHandoverRecordsByWarehouseRecordId(record.warehouseRecordId)
      const printActions = handovers.length > 0
        ? handovers
          .map((handover) => `${renderPostAction('打印任务交货卡', buildTaskDeliveryCardPrintLink(handover.handoverRecordId))}${renderPostAction('打印交出二维码', buildHandoverQrLabelPrintLink(handover.handoverRecordId))}`)
          .join('')
        : renderPostAction('暂无交货卡', '', true)
      return `
        <tr class="align-top ${postOrderId ? 'bg-blue-50/60' : ''}">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.warehouseRecordNo)}</td>
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.sourceWorkOrderNo)}</td>
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.sourceTaskNo || '复检完成记录')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(record.remark.includes('车缝厂已完成后道') ? '车缝厂已完成后道' : '后道工厂执行')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceProductionOrderNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(record.targetFactoryName || record.sourceFactoryName)}</td>
          <td class="px-3 py-3 text-sm">${formatGarmentQty(record.availableObjectQty, record.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatGarmentQty(record.availableObjectQty, record.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatGarmentQty(record.handedOverObjectQty, record.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatGarmentQty(record.writtenBackObjectQty, record.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatGarmentQty(record.diffObjectQty, record.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(handovers.map((item) => `${item.handoverRecordNo} / ${item.status}`).join('、') || '待交出')}</td>
          <td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              ${renderPostAction('查看后道单', buildPostFinishingWorkOrderDetailLink(record.sourceWorkOrderId, 'handover'))}
              ${renderPostAction('查看复检单', buildPostFinishingWorkOrderDetailLink(record.sourceWorkOrderId, 'recheck'))}
              ${printActions}
            </div>
          </td>
        </tr>
      `
    })
    .join('')
  const bodyRows =
    rows ||
    `<tr><td colspan="14" class="px-3 py-8 text-center text-sm text-muted-foreground">未找到对应后道单的交出仓记录。</td></tr>`

  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('后道交出仓', '只承接复检完成后的后道工厂待交出记录。')}
      ${renderFilterHint(postOrderId, records.length === 0)}
      ${renderPostSection(
        '交出仓记录',
        renderPostTable(
          ['交出记录号', '后道单号', '来源车缝任务', '后道来源', '生产单', '后道工厂', '复检确认成衣件数', '待交出成衣件数', '已交出成衣件数', '实收成衣件数', '差异成衣件数', '统一交出记录', '当前状态', '操作'],
          bodyRows,
          'min-w-[1580px]',
        ),
      )}
    </div>
  `
}
