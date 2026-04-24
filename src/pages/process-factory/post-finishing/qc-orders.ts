import { listPostFinishingQcOrders } from '../../../data/fcs/post-finishing-domain.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatGarmentQty,
  renderPostAction,
  renderPostFinishingPageHeader,
  renderPostSection,
  renderPostStatusBadge,
  renderPostTable,
} from './shared.ts'

export function renderPostFinishingQcOrdersPage(): string {
  const rows = listPostFinishingQcOrders()
    .map((record) => `
      <tr class="align-top">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.actionId)}</td>
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.postOrderNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.postOrderId.replace('POST-WO', '生产单'))}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.factoryName)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(record.submittedGarmentQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(record.acceptedGarmentQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(record.rejectedGarmentQty, record.qtyUnit)}</td>
        <td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.operatorName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.finishedAt || record.startedAt || '—')}</td>
        <td class="px-3 py-3">${renderPostAction('查看后道单', '/fcs/craft/post-finishing/work-orders')}</td>
      </tr>
    `)
    .join('')

  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('质检单', '质检单只针对后道工厂，非专门工厂完成后道后交由后道工厂质检。')}
      ${renderPostSection(
        '质检单列表',
        renderPostTable(
          ['质检单号', '后道单号', '生产单', '后道工厂', '待质检成衣件数', '已质检成衣件数', '不合格成衣件数', '质检状态', '质检人', '质检时间', '操作'],
          rows,
          'min-w-[1280px]',
        ),
      )}
    </div>
  `
}
