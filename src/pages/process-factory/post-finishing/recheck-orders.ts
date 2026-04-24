import { listPostFinishingRecheckOrders } from '../../../data/fcs/post-finishing-domain.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatGarmentQty,
  renderPostAction,
  renderPostFinishingPageHeader,
  renderPostSection,
  renderPostStatusBadge,
  renderPostTable,
} from './shared.ts'

export function renderPostFinishingRecheckOrdersPage(): string {
  const rows = listPostFinishingRecheckOrders()
    .map((record) => `
      <tr class="align-top">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.actionId)}</td>
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.postOrderNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.postOrderId.replace('POST-WO', '生产单'))}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.factoryName)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(record.submittedGarmentQty - record.rejectedGarmentQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(record.acceptedGarmentQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(record.diffGarmentQty, record.qtyUnit)}</td>
        <td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.operatorName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.finishedAt || record.startedAt || '—')}</td>
        <td class="px-3 py-3">${renderPostAction('查看交出仓', '/fcs/craft/post-finishing/wait-handover-warehouse')}</td>
      </tr>
    `)
    .join('')

  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('复检单', '复检重点复核成衣数量；复检完成后生成后道交出仓记录。')}
      ${renderPostSection(
        '复检单列表',
        renderPostTable(
          ['复检单号', '后道单号', '生产单', '后道工厂', '质检通过成衣件数', '复检确认成衣件数', '数量差异', '复检状态', '复检人', '复检时间', '操作'],
          rows,
          'min-w-[1280px]',
        ),
      )}
    </div>
  `
}
