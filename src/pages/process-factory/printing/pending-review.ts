import { escapeHtml } from '../../../utils'
import {
  getPrintOrderHandoverSummary,
  getPrintReviewRecordByOrderId,
  listPrintReviewRecords,
  listPrintWorkOrders,
} from '../../../data/fcs/printing-task-domain.ts'
import {
  buildPrintingHref,
  formatPrintQty,
  getSelectedPrintOrderId,
  renderActionButton,
  renderPageHeader,
  renderReviewStatusBadge,
  renderSection,
  renderWorkOrderStatusBadge,
} from './shared'

function renderReviewList(selectedId: string): string {
  const rows = listPrintReviewRecords()
    .map((review) => {
      const order = listPrintWorkOrders().find((item) => item.printOrderId === review.printOrderId)
      if (!order) return ''
      const active = review.printOrderId === selectedId
      return `
        <tr class="border-b last:border-b-0 ${active ? 'bg-blue-50/70' : ''}">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.printOrderNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.handoverOrderNo || order.handoverOrderId || '—')}</td>
          <td class="px-3 py-3 text-sm">${review.handoverRecordIds?.length ?? 0} 条</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.printFactoryName)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(review.receiverName)}</td>
          <td class="px-3 py-3 text-sm">${formatPrintQty(review.submittedQty, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatPrintQty(review.receivedQty, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${review.receivedRollCount ?? 0}</td>
          <td class="px-3 py-3 text-sm">${review.receivedLength ? `${review.receivedLength} ${review.lengthUnit || '米'}` : '—'}</td>
          <td class="px-3 py-3 text-sm">${review.diffQty}</td>
          <td class="px-3 py-3">${renderReviewStatusBadge(review.reviewStatus)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              ${renderActionButton({
                label: '审核通过',
                action: 'approve-review',
                attrs: { 'print-order-id': review.printOrderId },
                tone: 'primary',
              })}
              ${renderActionButton({
                label: '审核驳回',
                action: 'reject-review',
                attrs: { 'print-order-id': review.printOrderId },
                tone: 'danger',
              })}
              ${renderActionButton({
                label: '查看交出单',
                action: 'navigate',
                attrs: { href: order.handoverOrderId ? `/fcs/pda/handover/${order.handoverOrderId}` : '' },
                disabled: !order.handoverOrderId,
              })}
            </div>
          </td>
        </tr>
      `
    })
    .join('')

  return renderSection(
    '审核列表',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">印花单号</th>
              <th class="px-3 py-2 font-medium">交出单</th>
              <th class="px-3 py-2 font-medium">交出记录</th>
              <th class="px-3 py-2 font-medium">印花工厂</th>
              <th class="px-3 py-2 font-medium">接收方</th>
              <th class="px-3 py-2 font-medium">交出数量</th>
              <th class="px-3 py-2 font-medium">实收数量</th>
              <th class="px-3 py-2 font-medium">卷数</th>
              <th class="px-3 py-2 font-medium">长度</th>
              <th class="px-3 py-2 font-medium">差异</th>
              <th class="px-3 py-2 font-medium">审核状态</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="12">暂无数据</td></tr>'}</tbody>
        </table>
      </div>
    `,
  )
}

export function renderCraftPrintingPendingReviewPage(): string {
  const reviews = listPrintReviewRecords()
  const orders = listPrintWorkOrders()
  const selectedOrderId = getSelectedPrintOrderId(reviews[0]?.printOrderId || orders[0]?.printOrderId)
  const selectedOrder = orders.find((item) => item.printOrderId === selectedOrderId)
  const selectedReview = selectedOrder ? getPrintReviewRecordByOrderId(selectedOrder.printOrderId) : undefined
  const handoverSummary = selectedOrder ? getPrintOrderHandoverSummary(selectedOrder.printOrderId) : undefined

  const detail =
    selectedOrder && selectedReview
      ? renderSection(
          '审核明细',
          `
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <article class="rounded-md border bg-background px-3 py-3 text-sm">
                <div class="text-xs text-muted-foreground">印花单号</div>
                <div class="mt-1 font-mono text-xs font-medium">${escapeHtml(selectedOrder.printOrderNo)}</div>
                <div class="mt-2">${renderWorkOrderStatusBadge(selectedOrder.status)}</div>
              </article>
              <article class="rounded-md border bg-background px-3 py-3 text-sm">
                <div class="text-xs text-muted-foreground">接收方回写</div>
                <div class="mt-1">${formatPrintQty(selectedReview.receivedQty, selectedOrder.qtyUnit)}</div>
                <div class="mt-1 text-xs text-muted-foreground">交出 ${formatPrintQty(selectedReview.submittedQty, selectedOrder.qtyUnit)}</div>
              </article>
              <article class="rounded-md border bg-background px-3 py-3 text-sm">
                <div class="text-xs text-muted-foreground">卷数 / 长度</div>
                <div class="mt-1">${selectedReview.receivedRollCount ?? 0} 卷</div>
                <div class="mt-1 text-xs text-muted-foreground">${selectedReview.receivedLength ? `${selectedReview.receivedLength} ${selectedReview.lengthUnit || '米'}` : '暂无数据'}</div>
              </article>
              <article class="rounded-md border bg-background px-3 py-3 text-sm">
                <div class="text-xs text-muted-foreground">差异</div>
                <div class="mt-1">${selectedReview.diffQty}</div>
                <div class="mt-1 text-xs text-muted-foreground">待回写 ${handoverSummary?.pendingWritebackCount ?? 0} 条</div>
              </article>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              ${renderActionButton({
                label: '审核通过',
                action: 'approve-review',
                attrs: { 'print-order-id': selectedOrder.printOrderId },
                tone: 'primary',
              })}
              ${renderActionButton({
                label: '审核驳回',
                action: 'reject-review',
                attrs: { 'print-order-id': selectedOrder.printOrderId },
                tone: 'danger',
              })}
              ${renderActionButton({
                label: '查看交出单',
                action: 'navigate',
                attrs: { href: selectedOrder.handoverOrderId ? `/fcs/pda/handover/${selectedOrder.handoverOrderId}` : '' },
                disabled: !selectedOrder.handoverOrderId,
              })}
              ${renderActionButton({
                label: '查看进度',
                action: 'navigate',
                attrs: { href: buildPrintingHref('/fcs/craft/printing/progress', selectedOrder.printOrderId) },
              })}
            </div>
            ${
              selectedReview.rejectReason
                ? `<div class="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">驳回原因：${escapeHtml(selectedReview.rejectReason)}</div>`
                : ''
            }
          `,
        )
      : ''

  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader('印花审核', '')}
      ${renderReviewList(selectedOrderId)}
      ${detail}
    </div>
  `
}
