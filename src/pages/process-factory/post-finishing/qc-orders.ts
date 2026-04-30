import { buildPostFinishingWorkOrderDetailLink } from '../../../data/fcs/fcs-route-links.ts'
import {
  getPostFinishingSourceLabel,
  getPostFinishingWorkOrderById,
  listPostFinishingQcOrders,
} from '../../../data/fcs/post-finishing-domain.ts'
import { getAvailablePostFinishingWebActions } from '../../../data/fcs/process-web-status-actions.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatGarmentQty,
  renderPostAction,
  renderPostFinishingPageHeader,
  renderPostSection,
  renderPostStatusBadge,
  renderPostTable,
} from './shared.ts'

function renderQcActionButtons(postOrderId: string): string {
  const order = getPostFinishingWorkOrderById(postOrderId)
  if (!order) return '—'
  const actions = getAvailablePostFinishingWebActions(postOrderId)
    .filter((action) => ['POST_QC_START', 'POST_QC_FINISH', 'POST_REPORT_DIFFERENCE'].includes(action.actionCode))
  if (!actions.length) return '暂无可执行动作'
  return actions.map((action) => `
    <button
      type="button"
      class="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
      data-post-finishing-action="open-web-status-action-dialog"
      data-source-id="${escapeHtml(order.postOrderId)}"
      data-action-code="${escapeHtml(action.actionCode)}"
      data-action-label="${escapeHtml(action.actionLabel)}"
      data-from-status="${escapeHtml(action.fromStatus)}"
      data-to-status="${escapeHtml(action.toStatus)}"
      data-required-fields="${escapeHtml(action.requiredFields.join('|'))}"
      data-optional-fields="${escapeHtml(action.optionalFields.join('|'))}"
      data-confirm-text="${escapeHtml(action.confirmText)}"
      data-object-type="成衣"
      data-object-qty="${escapeHtml(String(order.plannedGarmentQty))}"
      data-qty-unit="件"
      data-testid="web-status-action-button"
    >${escapeHtml(action.actionLabel)}</button>
  `).join('')
}

export function renderPostFinishingQcOrdersPage(): string {
  const rows = listPostFinishingQcOrders()
    .map((record) => {
      const order = getPostFinishingWorkOrderById(record.postOrderId)
      return `
        <tr class="align-top">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.actionId)}</td>
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.postOrderNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order?.sourceProductionOrderNo || record.postOrderId.replace('POST-WO', '生产单'))}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order?.sourceSewingTaskNo || '—')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order ? getPostFinishingSourceLabel(order) : '—')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(record.factoryName)}</td>
          <td class="px-3 py-3 text-sm">${formatGarmentQty(record.submittedGarmentQty, record.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatGarmentQty(record.acceptedGarmentQty, record.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatGarmentQty(record.rejectedGarmentQty, record.qtyUnit)}</td>
          <td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(record.operatorName)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(record.finishedAt || record.startedAt || '—')}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              ${renderQcActionButtons(record.postOrderId)}
              ${renderPostAction('查看后道单', buildPostFinishingWorkOrderDetailLink(record.postOrderId, 'qc'))}
            </div>
          </td>
        </tr>
      `
    })
    .join('')

  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('质检单', '质检单只针对后道工厂，非专门工厂完成后道后交由后道工厂质检。')}
      ${renderPostSection(
        '质检单列表',
        renderPostTable(
          ['质检单号', '后道单号', '生产单', '来源车缝任务', '后道来源', '后道工厂', '待质检成衣件数', '质检通过成衣件数', '质检不合格成衣件数', '质检状态', '质检人', '质检时间', '操作'],
          rows,
          'min-w-[1480px]',
        ),
      )}
    </div>
  `
}
