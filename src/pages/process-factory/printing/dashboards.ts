import { escapeHtml } from '../../../utils'
import {
  listPrintingDashboardBuckets,
  listPrintWorkOrders,
} from '../../../data/fcs/printing-task-domain.ts'
import {
  formatPrintQty,
  getPrintPrinterSummary,
  renderMetricCard,
  renderPageHeader,
  renderSection,
  renderWorkOrderStatusBadge,
} from './shared'

function renderBuckets(): string {
  return `
    <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
      ${listPrintingDashboardBuckets()
        .map((bucket) => renderMetricCard(bucket.label, String(bucket.count), '当前待处理'))
        .join('')}
    </section>
  `
}

function renderBoardList(): string {
  const rows = listPrintWorkOrders()
    .map((order) => {
      const printer = getPrintPrinterSummary(order)
      const pendingText =
        order.status === 'WAIT_HANDOVER'
          ? '待送货'
          : order.status === 'HANDOVER_SUBMITTED'
            ? '待回写'
            : order.status === 'WAIT_REVIEW'
              ? '待审核'
              : order.status === 'REJECTED'
                ? '已驳回'
                : '跟进中'
      return `
        <tr class="border-b last:border-b-0">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.printOrderNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.taskNo)}</td>
          <td class="px-3 py-3">${renderWorkOrderStatusBadge(order.status)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.printFactoryName)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(printer.printerNo)}</td>
          <td class="px-3 py-3 text-sm">${formatPrintQty(order.plannedQty, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatPrintQty(printer.outputQty, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(pendingText)}</td>
        </tr>
      `
    })
    .join('')

  return renderSection(
    '印花大屏',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">印花单号</th>
              <th class="px-3 py-2 font-medium">印花任务</th>
              <th class="px-3 py-2 font-medium">当前状态</th>
              <th class="px-3 py-2 font-medium">工厂</th>
              <th class="px-3 py-2 font-medium">打印机</th>
              <th class="px-3 py-2 font-medium">计划数量</th>
              <th class="px-3 py-2 font-medium">完成数量</th>
              <th class="px-3 py-2 font-medium">待处理</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
  )
}

export function renderCraftPrintingDashboardsPage(): string {
  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader('印花大屏', '')}
      ${renderBuckets()}
      ${renderBoardList()}
    </div>
  `
}
