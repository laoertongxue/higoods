import { escapeHtml } from '../../../utils'
import {
  getPrintOrderHandoverSummary,
  getPrintWorkOrderSummary,
  listPrintWorkOrders,
} from '../../../data/fcs/printing-task-domain.ts'
import {
  buildPrintingHref,
  formatPrintQty,
  getPrintPrinterSummary,
  renderActionButton,
  renderMetricCard,
  renderPageHeader,
  renderSection,
  renderWorkOrderStatusBadge,
} from './shared'

function renderSummaryCards(): string {
  const summary = getPrintWorkOrderSummary()
  return `
    <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
      ${renderMetricCard('印花任务', String(summary.total), '加工单数')}
      ${renderMetricCard('等打印', String(summary.waitPrintCount), '花型测试已完成')}
      ${renderMetricCard('打印中', String(summary.printingCount), '当前机台执行')}
      ${renderMetricCard('待送货', String(summary.waitHandoverCount), '转印结束待交出')}
      ${renderMetricCard('待回写', String(summary.waitWritebackCount), '交出后待接收方回写')}
      ${renderMetricCard('待审核', String(summary.waitReviewCount), '中转区域待审核')}
      ${renderMetricCard('差异', String(summary.diffQty), '交出与实收差异')}
    </section>
  `
}

function renderOrdersTable(): string {
  const rows = listPrintWorkOrders()
    .map((order) => {
      const handover = getPrintOrderHandoverSummary(order.printOrderId)
      const printer = getPrintPrinterSummary(order)
      const handoverText = order.handoverOrderId ? escapeHtml(order.handoverOrderNo || order.handoverOrderId) : '未生成'

      return `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3">
            <div class="font-mono text-xs font-medium">${escapeHtml(order.printOrderNo)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.patternNo)} / ${escapeHtml(order.patternVersion)}</div>
          </td>
          <td class="px-3 py-3">
            <div class="text-sm font-medium">${escapeHtml(order.taskNo)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.materialSku)}${order.materialColor ? ` / ${escapeHtml(order.materialColor)}` : ''}</div>
          </td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.patternNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.materialSku)}</td>
          <td class="px-3 py-3 text-sm">${formatPrintQty(order.plannedQty, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.printFactoryName)}</td>
          <td class="px-3 py-3">${renderWorkOrderStatusBadge(order.status)}</td>
          <td class="px-3 py-3 text-sm">
            <div>${escapeHtml(printer.printerNo)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(printer.speedText)}</div>
          </td>
          <td class="px-3 py-3 text-sm">${formatPrintQty(printer.outputQty, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${handoverText}</td>
          <td class="px-3 py-3 text-sm">${handover.pendingWritebackCount} 条</td>
          <td class="px-3 py-3 text-sm">${handover.diffQty}</td>
          <td class="px-3 py-3 text-sm">${handover.objectionCount}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              ${renderActionButton({
                label: '查看任务',
                action: 'navigate',
                attrs: { href: `/fcs/pda/exec/${order.taskId}` },
              })}
              ${renderActionButton({
                label: '查看交出单',
                action: 'navigate',
                attrs: { href: order.handoverOrderId ? `/fcs/pda/handover/${order.handoverOrderId}` : '' },
                disabled: !order.handoverOrderId,
              })}
              ${renderActionButton({
                label: '查看进度',
                action: 'navigate',
                attrs: { href: buildPrintingHref('/fcs/craft/printing/progress', order.printOrderId) },
              })}
            </div>
          </td>
        </tr>
      `
    })
    .join('')

  return renderSection(
    '加工单列表',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">印花单号</th>
              <th class="px-3 py-2 font-medium">印花任务</th>
              <th class="px-3 py-2 font-medium">花型</th>
              <th class="px-3 py-2 font-medium">面料</th>
              <th class="px-3 py-2 font-medium">计划数量</th>
              <th class="px-3 py-2 font-medium">印花工厂</th>
              <th class="px-3 py-2 font-medium">当前状态</th>
              <th class="px-3 py-2 font-medium">打印机</th>
              <th class="px-3 py-2 font-medium">转印完成</th>
              <th class="px-3 py-2 font-medium">交出单</th>
              <th class="px-3 py-2 font-medium">待回写</th>
              <th class="px-3 py-2 font-medium">差异</th>
              <th class="px-3 py-2 font-medium">异议</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
    `<div class="text-xs text-muted-foreground">转印完成后先进入待送货，再走交出单和接收方回写</div>`,
  )
}

export function renderCraftPrintingWorkOrdersPage(): string {
  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader('印花加工单', '印花加工单创建印花任务，工厂在工厂端移动应用执行印花任务。')}
      ${renderSummaryCards()}
      ${renderOrdersTable()}
    </div>
  `
}
