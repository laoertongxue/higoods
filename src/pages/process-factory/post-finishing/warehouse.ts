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

export function renderPostFinishingWaitProcessWarehousePage(): string {
  const rows = listWaitProcessWarehouseRecords({ craftType: 'POST_FINISHING' })
    .map((record) => `
      <tr class="align-top">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.warehouseRecordNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceFactoryName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.targetFactoryName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceProductionOrderNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.skuSummary)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(record.availableObjectQty || record.receivedObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.currentActionName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.warehouseLocation)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.inboundAt || record.createdAt)}</td>
        <td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td>
        <td class="px-3 py-3">${renderPostAction('查看后道单', '/fcs/craft/post-finishing/work-orders')}</td>
      </tr>
    `)
    .join('')

  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('后道待加工仓', '承接专门后道工厂待后道任务，也承接非专门工厂完成后道后转入的质检、复检任务。')}
      ${renderPostSection(
        '待加工仓记录',
        renderPostTable(
          ['入仓记录号', '来源工厂', '后道工厂', '生产单', 'SKU', '待处理成衣件数', '当前待处理动作', '仓内位置', '入仓时间', '状态', '操作'],
          rows,
          'min-w-[1320px]',
        ),
      )}
    </div>
  `
}

export function renderPostFinishingWaitHandoverWarehousePage(): string {
  const rows = listWaitHandoverWarehouseRecords({ craftType: 'POST_FINISHING' })
    .map((record) => {
      const handovers = getHandoverRecordsByWarehouseRecordId(record.warehouseRecordId)
      return `
        <tr class="align-top">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.warehouseRecordNo)}</td>
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.sourceWorkOrderNo)}</td>
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.sourceTaskNo || '复检完成记录')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceProductionOrderNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(record.targetFactoryName || record.sourceFactoryName)}</td>
          <td class="px-3 py-3 text-sm">${formatGarmentQty(record.availableObjectQty, record.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatGarmentQty(record.handedOverObjectQty, record.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatGarmentQty(record.writtenBackObjectQty, record.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatGarmentQty(record.diffObjectQty, record.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(handovers.map((item) => `${item.handoverRecordNo} / ${item.status}`).join('、') || '待交出')}</td>
          <td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td>
          <td class="px-3 py-3">${renderPostAction('查看复检单', '/fcs/craft/post-finishing/recheck-orders')}</td>
        </tr>
      `
    })
    .join('')

  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('后道交出仓', '只承接复检完成后的后道工厂待交出记录。')}
      ${renderPostSection(
        '交出仓记录',
        renderPostTable(
          ['交出记录号', '后道单号', '复检单号', '生产单', '后道工厂', '待交出成衣件数', '已交出成衣件数', '实收成衣件数', '差异成衣件数', '统一交出记录', '当前状态', '操作'],
          rows,
          'min-w-[1380px]',
        ),
      )}
    </div>
  `
}
