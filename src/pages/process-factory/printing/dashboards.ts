import { escapeHtml } from '../../../utils'
import { listPrintWorkOrders } from '../../../data/fcs/printing-task-domain.ts'
import { getPrintingDashboardMetrics } from '../../../data/fcs/process-statistics-domain.ts'
import {
  formatPrintQty,
  getPrintPrinterSummary,
  renderMetricCard,
  renderPageHeader,
  renderSection,
  renderWorkOrderStatusBadge,
} from './shared'

function renderBuckets(): string {
  const { statistics } = getPrintingDashboardMetrics()
  return `
    <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
      ${renderMetricCard('今日待打印面料米数', `${statistics.waitProcessFabricMeters} 米`, '统一待加工仓')}
      ${renderMetricCard('今日打印完成面料米数', `${statistics.printCompletedFabricMeters} 米`, '执行节点')}
      ${renderMetricCard('今日转印完成面料米数', `${statistics.transferCompletedFabricMeters} 米`, '执行节点')}
      ${renderMetricCard('当前待交出面料米数', `${statistics.waitHandoverFabricMeters} 米`, '统一待交出仓')}
      ${renderMetricCard('当前待审核记录数', String(statistics.waitReviewCount), '统一审核记录')}
      ${renderMetricCard('当前有差异记录数', String(statistics.differenceRecordCount), '统一差异记录')}
      ${renderMetricCard('已交出面料米数', `${statistics.handedOverFabricMeters} 米`, '统一交出记录')}
      ${renderMetricCard('实收面料米数', `${statistics.receivedFabricMeters} 米`, '接收方回写')}
    </section>
  `
}

function renderDistribution(): string {
  const { statusRows, factoryRows } = getPrintingDashboardMetrics()
  const statusHtml = statusRows
    .map((row) => `
      <div class="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
        <span>${escapeHtml(row.label)}</span>
        <span class="font-semibold">${row.count}</span>
      </div>
    `)
    .join('')
  const factoryHtml = factoryRows
    .map((row) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3 text-sm">${escapeHtml(row.factoryName)}</td>
        <td class="px-3 py-3 text-sm">${row.workOrderCount}</td>
        <td class="px-3 py-3 text-sm">${row.plannedQty} 米</td>
        <td class="px-3 py-3 text-sm">${row.doneQty} 米</td>
        <td class="px-3 py-3 text-sm">${row.handoverQty} 米</td>
        <td class="px-3 py-3 text-sm">${row.diffQty} 米</td>
        <td class="px-3 py-3 text-sm">${row.completionRate}%</td>
      </tr>
    `)
    .join('')

  return `
    <div class="grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
      ${renderSection('按状态维度的印花加工单分布', `<div class="grid gap-2 md:grid-cols-2">${statusHtml}</div>`)}
      ${renderSection(
        '按工厂维度的印花执行进度',
        `
          <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="bg-slate-50 text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 font-medium">工厂</th>
                  <th class="px-3 py-2 font-medium">加工单数</th>
                  <th class="px-3 py-2 font-medium">计划印花面料米数</th>
                  <th class="px-3 py-2 font-medium">执行完成面料米数</th>
                  <th class="px-3 py-2 font-medium">已交出面料米数</th>
                  <th class="px-3 py-2 font-medium">差异面料米数</th>
                  <th class="px-3 py-2 font-medium">完成率</th>
                </tr>
              </thead>
              <tbody>${factoryHtml}</tbody>
            </table>
          </div>
        `,
      )}
    </div>
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
              <th class="px-3 py-2 font-medium">计划印花面料米数</th>
              <th class="px-3 py-2 font-medium">打印完成面料米数</th>
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
      ${renderDistribution()}
      ${renderBoardList()}
    </div>
  `
}
