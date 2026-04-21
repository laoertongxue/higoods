import { escapeHtml } from '../../../utils'
import {
  getDyeOrderHandoverSummary,
  getDyeWorkOrderSummary,
  listDyeWorkOrders,
} from '../../../data/fcs/dyeing-task-domain.ts'
import {
  formatDyeQty,
  getDyeVatSummary,
  renderActionButton,
  renderMetricCard,
  renderPageHeader,
  renderSection,
  renderWorkOrderStatusBadge,
} from './shared'

function renderSummaryCards(): string {
  const summary = getDyeWorkOrderSummary()
  return `
    <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
      ${renderMetricCard('染色任务', String(summary.total), '加工单数')}
      ${renderMetricCard('等样衣/色样', String(summary.waitSampleCount), '首单待确认')}
      ${renderMetricCard('等原料', String(summary.waitMaterialCount), '原料待到位')}
      ${renderMetricCard('待排染缸', String(summary.waitVatPlanCount), '备料完成待排缸')}
      ${renderMetricCard('待送货', String(summary.waitHandoverCount), '包装完成待交出')}
      ${renderMetricCard('待回写', String(summary.waitWritebackCount), '交出后待接收方回写')}
      ${renderMetricCard('待审核', String(summary.waitReviewCount), '中转区域待审核')}
      ${renderMetricCard('已完成', String(summary.completedCount), '审核通过')}
      ${renderMetricCard('已驳回', String(summary.rejectedCount), '审核驳回')}
      ${renderMetricCard('染缸利用', String(summary.vatUtilizationCount), '当前排缸数')}
      ${renderMetricCard('差异', String(summary.diffQty), '交出与实收差异')}
      ${renderMetricCard('异议', String(summary.objectionCount), '交出链路异议')}
    </section>
  `
}

function renderOrdersTable(): string {
  const rows = listDyeWorkOrders()
    .map((order) => {
      const handover = getDyeOrderHandoverSummary(order.dyeOrderId)
      const vat = getDyeVatSummary(order)
      const handoverText = order.handoverOrderId ? escapeHtml(order.handoverOrderNo || order.handoverOrderId) : '未生成'
      const orderTypeText = order.isFirstOrder ? '首单' : '翻单'

      return `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3">
            <div class="font-mono text-xs font-medium">${escapeHtml(order.dyeOrderNo)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.taskNo)}</div>
          </td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.taskNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(orderTypeText)}</td>
          <td class="px-3 py-3 text-sm">
            <div>${escapeHtml(order.rawMaterialSku)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.composition || '暂无数据')}</div>
          </td>
          <td class="px-3 py-3 text-sm">
            <div>${escapeHtml(order.targetColor)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.colorNo || '待确认')}</div>
          </td>
          <td class="px-3 py-3 text-sm">${formatDyeQty(order.plannedQty, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.dyeFactoryName)}</td>
          <td class="px-3 py-3">${renderWorkOrderStatusBadge(order.status)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(vat.dyeVatNo)}</td>
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
                label: '查看报表',
                action: 'navigate',
                attrs: { href: `/fcs/craft/dyeing/reports?dyeOrderId=${encodeURIComponent(order.dyeOrderId)}` },
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
              <th class="px-3 py-2 font-medium">染色单号</th>
              <th class="px-3 py-2 font-medium">染色任务</th>
              <th class="px-3 py-2 font-medium">首单/翻单</th>
              <th class="px-3 py-2 font-medium">原料面料</th>
              <th class="px-3 py-2 font-medium">目标颜色</th>
              <th class="px-3 py-2 font-medium">计划数量</th>
              <th class="px-3 py-2 font-medium">染色工厂</th>
              <th class="px-3 py-2 font-medium">当前状态</th>
              <th class="px-3 py-2 font-medium">染缸</th>
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
  )
}

export function renderCraftDyeingWorkOrdersPage(): string {
  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader('染色加工单', '')}
      ${renderSummaryCards()}
      ${renderOrdersTable()}
    </div>
  `
}
