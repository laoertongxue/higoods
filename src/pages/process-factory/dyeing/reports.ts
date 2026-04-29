import { escapeHtml } from '../../../utils'
import {
  buildCapacityProfileLink,
  buildDyeingWorkOrderDetailLink,
  buildHandoverOrderLink,
  buildTaskDetailLink,
} from '../../../data/fcs/fcs-route-links.ts'
import {
  getDyeOrderHandoverSummary,
  getDyeReviewRecordByOrderId,
  listDyeFormulaRecords,
  listDyeReportRows,
  listDyeReviewRecords,
  listDyeVatSchedules,
  listDyeWorkOrders,
} from '../../../data/fcs/dyeing-task-domain.ts'
import { TEST_FACTORY_ID } from '../../../data/fcs/factory-mock-data.ts'
import { getDyeingExecutionStatistics } from '../../../data/fcs/process-statistics-domain.ts'
import {
  formatDyeQty,
  getDyeVatSummary,
  getSelectedDyeOrderId,
  renderActionButton,
  renderMetricCard,
  renderPageHeader,
  renderReviewStatusBadge,
  renderSection,
  renderWorkOrderStatusBadge,
} from './shared'

function renderNodeOverview(): string {
  const statistics = getDyeingExecutionStatistics()
  const countByLabel = (label: string) => statistics.statusCounts[label] || 0

  return renderSection(
    '节点分布',
    `
      <div class="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        ${renderMetricCard('待样衣染色加工单数', String(countByLabel('待样衣')), '统一加工单')}
        ${renderMetricCard('待原料染色加工单数', String(countByLabel('待原料')), '统一加工单')}
        ${renderMetricCard('打样中染色加工单数', String(countByLabel('打样中')), '打样执行中')}
        ${renderMetricCard('待排缸染色加工单数', String(countByLabel('待排缸')), '备料完成待排缸')}
        ${renderMetricCard('染色中染色加工单数', String(countByLabel('染色中')), '染缸执行中')}
        ${renderMetricCard('脱水中染色加工单数', String(countByLabel('脱水中')), '后处理节点')}
        ${renderMetricCard('烘干中染色加工单数', String(countByLabel('烘干中')), '后处理节点')}
        ${renderMetricCard('定型中染色加工单数', String(countByLabel('定型中')), '后处理节点')}
        ${renderMetricCard('打卷中染色加工单数', String(countByLabel('打卷中')), '后处理节点')}
        ${renderMetricCard('包装中染色加工单数', String(countByLabel('包装中')), '包装完成前')}
        ${renderMetricCard('待送货染色加工单数', String(countByLabel('待送货')), '包装完成待交出')}
        ${renderMetricCard('待交出染色加工单数', String(statistics.waitHandoverRecordCount), '统一待交出仓')}
        ${renderMetricCard('待审核染色加工单数', String(statistics.waitReviewCount), '统一审核记录')}
        ${renderMetricCard('已完成染色加工单数', String(countByLabel('已完成')), '审核通过')}
      </div>
    `,
  )
}

function renderTopMetrics(): string {
  const statistics = getDyeingExecutionStatistics()
  return `
    <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
      ${renderMetricCard('染色加工单总数', String(statistics.workOrderCount), '统一加工单')}
      ${renderMetricCard('计划染色面料米数', `${statistics.plannedDyeFabricMeters} 米`, '统一加工单计划')}
      ${renderMetricCard('待加工面料米数', `${statistics.waitProcessFabricMeters} 米`, '统一待加工仓')}
      ${renderMetricCard('备料面料米数', `${statistics.materialReadyFabricMeters} 米`, '执行节点')}
      ${renderMetricCard('染色完成面料米数', `${statistics.dyeCompletedFabricMeters} 米`, '执行节点')}
      ${renderMetricCard('包装完成面料米数', `${statistics.finalPackedFabricMeters} 米`, '执行节点')}
      ${renderMetricCard('待交出面料米数', `${statistics.waitHandoverFabricMeters} 米`, '统一待交出仓')}
      ${renderMetricCard('已交出面料米数', `${statistics.handedOverFabricMeters} 米`, '统一交出记录')}
      ${renderMetricCard('实收面料米数', `${statistics.receivedFabricMeters} 米`, '接收方回写')}
      ${renderMetricCard('差异面料米数', `${statistics.diffFabricMeters} 米`, '统一差异口径')}
      ${renderMetricCard('染色待加工仓记录数', String(statistics.waitProcessRecordCount), '统一待加工仓')}
      ${renderMetricCard('染色待交出仓记录数', String(statistics.waitHandoverRecordCount), '统一待交出仓')}
      ${renderMetricCard('染色待回写交出记录数', String(statistics.waitWritebackHandoverCount), '统一交出记录')}
      ${renderMetricCard('染色已回写交出记录数', String(statistics.writtenBackHandoverCount), '统一交出记录')}
      ${renderMetricCard('染色有差异交出记录数', String(statistics.differenceHandoverCount), '统一交出记录')}
      ${renderMetricCard('染色数量差异记录数', String(statistics.differenceRecordCount), '统一差异记录')}
      ${renderMetricCard('染色待处理差异记录数', String(statistics.pendingDifferenceRecordCount), '统一差异记录')}
      ${renderMetricCard('染色需重新交出记录数', String(statistics.reworkDifferenceRecordCount), '统一差异记录')}
      ${renderMetricCard('染色待审核记录数', String(statistics.waitReviewCount), '统一审核记录')}
      ${renderMetricCard('染色审核通过记录数', String(statistics.reviewPassCount), '统一审核记录')}
      ${renderMetricCard('染色审核驳回记录数', String(statistics.reviewRejectCount), '统一审核记录')}
      ${renderMetricCard('当前排缸记录数', String(statistics.currentVatScheduleCount), '染缸排程')}
      ${renderMetricCard('染色平均耗时', `${statistics.dyeAverageHours} 小时`, '执行节点')}
      ${renderMetricCard('脱水平均耗时', `${statistics.dehydrateAverageHours} 小时`, '执行节点')}
      ${renderMetricCard('烘干平均耗时', `${statistics.dryAverageHours} 小时`, '执行节点')}
      ${renderMetricCard('定型平均耗时', `${statistics.setAverageHours} 小时`, '执行节点')}
      ${renderMetricCard('包装平均耗时', `${statistics.packAverageHours} 小时`, '执行节点')}
      ${renderMetricCard('交出平均回写耗时', `${statistics.handoverAverageWritebackHours} 小时`, '统一交出记录')}
      ${renderMetricCard('待回写超时记录数', String(statistics.overdueWritebackCount), '超过 48 小时')}
    </section>
  `
}

function renderDurationTable(): string {
  const rows = listDyeReportRows()
    .map((row) => {
      const order = listDyeWorkOrders().find((item) => item.dyeOrderId === row.dyeOrderId)
      return `
        <tr class="border-b last:border-b-0">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.dyeOrderNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.taskNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.currentNode)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.waitingReason)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.startedAt || '—')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.finishedAt || '—')}</td>
          <td class="px-3 py-3 text-sm">${row.durationHours.toFixed(1)} 小时</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.dyeVatNo || '未排缸')}</td>
          <td class="px-3 py-3 text-sm">${formatDyeQty(row.plannedQty, order?.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatDyeQty(row.outputQty, order?.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${row.diffQty}</td>
          <td class="px-3 py-3 text-sm">${row.objectionCount}</td>
        </tr>
      `
    })
    .join('')

  return renderSection(
    '等待原因与节点耗时',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">染色加工单号</th>
              <th class="px-3 py-2 font-medium">染色任务</th>
              <th class="px-3 py-2 font-medium">当前节点</th>
              <th class="px-3 py-2 font-medium">等待原因</th>
              <th class="px-3 py-2 font-medium">开始时间</th>
              <th class="px-3 py-2 font-medium">完成时间</th>
              <th class="px-3 py-2 font-medium">节点耗时</th>
              <th class="px-3 py-2 font-medium">染缸编号</th>
              <th class="px-3 py-2 font-medium">计划染色面料米数</th>
              <th class="px-3 py-2 font-medium">染色完成面料米数</th>
              <th class="px-3 py-2 font-medium">差异面料米数</th>
              <th class="px-3 py-2 font-medium">交出异议记录数</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
  )
}

function renderVatUtilization(): string {
  const rows = listDyeVatSchedules()
    .map((schedule) => {
      const order = listDyeWorkOrders().find((item) => item.dyeOrderId === schedule.dyeOrderId)
      const formula = listDyeFormulaRecords().find((item) => item.dyeOrderId === schedule.dyeOrderId)
      return `
        <tr class="border-b last:border-b-0">
          <td class="px-3 py-3 text-sm font-medium">${escapeHtml(schedule.dyeVatNo)}</td>
          <td class="px-3 py-3 text-sm">${schedule.capacityQty} ${escapeHtml(schedule.capacityUnit)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(schedule.supportedMaterialTypes.join(' / '))}</td>
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order?.dyeOrderNo || '暂无数据')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(schedule.plannedStartAt)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(schedule.actualEndAt || schedule.plannedEndAt)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(schedule.status === 'IN_USE' ? '使用中' : schedule.status === 'DONE' ? '已完成' : schedule.status === 'DELAYED' ? '延迟' : '计划中')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(formula?.colorNo || '暂无数据')}</td>
          <td class="px-3 py-3 text-right">
            ${renderActionButton({
              label: '查看产能',
              action: 'navigate',
              attrs: { href: buildCapacityProfileLink(order?.dyeFactoryId || TEST_FACTORY_ID) },
            })}
          </td>
        </tr>
      `
    })
    .join('')

  return renderSection(
    '染缸利用',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">染缸编号</th>
              <th class="px-3 py-2 font-medium">染缸容量</th>
              <th class="px-3 py-2 font-medium">可染类型</th>
              <th class="px-3 py-2 font-medium">染色加工单号</th>
              <th class="px-3 py-2 font-medium">计划开始</th>
              <th class="px-3 py-2 font-medium">结束时间</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">色号</th>
              <th class="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
  )
}

function renderReviewTable(selectedId: string): string {
  const rows = listDyeReviewRecords()
    .map((review) => {
      const order = listDyeWorkOrders().find((item) => item.dyeOrderId === review.dyeOrderId)
      if (!order) return ''
      const active = review.dyeOrderId === selectedId
      return `
        <tr class="border-b last:border-b-0 ${active ? 'bg-blue-50/70' : ''}">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.dyeOrderNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.handoverOrderNo || order.handoverOrderId || '—')}</td>
          <td class="px-3 py-3 text-sm">${review.handoverRecordIds?.length ?? 0} 条</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.receiverName)}</td>
          <td class="px-3 py-3 text-sm">${formatDyeQty(review.submittedQty, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${formatDyeQty(review.receivedQty, order.qtyUnit)}</td>
          <td class="px-3 py-3 text-sm">${review.receivedRollCount ?? 0}</td>
          <td class="px-3 py-3 text-sm">${review.receivedLength ? `${review.receivedLength} ${review.lengthUnit || '米'}` : '—'}</td>
          <td class="px-3 py-3 text-sm">${review.diffQty}</td>
          <td class="px-3 py-3">${renderReviewStatusBadge(review.reviewStatus)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              ${renderActionButton({
                label: '审核通过',
                action: 'approve-review',
                attrs: { 'dye-order-id': review.dyeOrderId },
                tone: 'primary',
                disabled: review.reviewStatus !== 'WAIT_REVIEW',
              })}
              ${renderActionButton({
                label: '审核驳回',
                action: 'reject-review',
                attrs: { 'dye-order-id': review.dyeOrderId },
                tone: 'danger',
                disabled: review.reviewStatus !== 'WAIT_REVIEW',
              })}
              ${renderActionButton({
                label: '打开移动端交出页',
                action: 'navigate',
                attrs: { href: order.handoverOrderId ? buildHandoverOrderLink(order.handoverOrderId) : '' },
                disabled: !order.handoverOrderId,
              })}
            </div>
          </td>
        </tr>
      `
    })
    .join('')

  return renderSection(
    '中转审核',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">染色加工单号</th>
              <th class="px-3 py-2 font-medium">交出单</th>
              <th class="px-3 py-2 font-medium">交出记录</th>
              <th class="px-3 py-2 font-medium">接收方</th>
              <th class="px-3 py-2 font-medium">交出面料米数</th>
              <th class="px-3 py-2 font-medium">实收面料米数</th>
              <th class="px-3 py-2 font-medium">卷数</th>
              <th class="px-3 py-2 font-medium">长度</th>
              <th class="px-3 py-2 font-medium">差异面料米数</th>
              <th class="px-3 py-2 font-medium">审核状态</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="11">暂无数据</td></tr>'}</tbody>
        </table>
      </div>
    `,
  )
}

function renderSelectedDetail(selectedId: string): string {
  const order = listDyeWorkOrders().find((item) => item.dyeOrderId === selectedId) || listDyeWorkOrders()[0]
  if (!order) return ''

  const review = getDyeReviewRecordByOrderId(order.dyeOrderId)
  const handover = getDyeOrderHandoverSummary(order.dyeOrderId)
  const vat = getDyeVatSummary(order)

  return renderSection(
    '审核明细',
    `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-md border bg-background px-3 py-3 text-sm">
          <div class="text-xs text-muted-foreground">染色加工单号</div>
          <div class="mt-1 font-mono text-xs font-medium">${escapeHtml(order.dyeOrderNo)}</div>
          <div class="mt-2">${renderWorkOrderStatusBadge(order.status)}</div>
        </article>
        <article class="rounded-md border bg-background px-3 py-3 text-sm">
          <div class="text-xs text-muted-foreground">接收方回写</div>
          <div class="mt-1">${formatDyeQty(review?.receivedQty ?? handover.writtenBackQty, order.qtyUnit)}</div>
          <div class="mt-1 text-xs text-muted-foreground">交出面料米数 ${formatDyeQty(review?.submittedQty ?? handover.submittedQty, order.qtyUnit)}</div>
        </article>
        <article class="rounded-md border bg-background px-3 py-3 text-sm">
          <div class="text-xs text-muted-foreground">卷数 / 长度</div>
          <div class="mt-1">${review?.receivedRollCount ?? order.plannedRollCount ?? 0} 卷</div>
          <div class="mt-1 text-xs text-muted-foreground">${review?.receivedLength ? `${review.receivedLength} ${review.lengthUnit || '米'}` : '暂无数据'}</div>
        </article>
        <article class="rounded-md border bg-background px-3 py-3 text-sm">
          <div class="text-xs text-muted-foreground">染缸 / 差异面料米数</div>
          <div class="mt-1">${escapeHtml(vat.dyeVatNo)}</div>
          <div class="mt-1 text-xs text-muted-foreground">差异面料米数 ${review?.diffQty ?? handover.diffQty} ${escapeHtml(order.qtyUnit || '米')}</div>
        </article>
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        ${renderActionButton({
          label: '打开移动端执行页',
          action: 'navigate',
          attrs: { href: buildTaskDetailLink(order.taskId) },
        })}
        ${renderActionButton({
          label: '打开移动端交出页',
          action: 'navigate',
          attrs: { href: order.handoverOrderId ? buildHandoverOrderLink(order.handoverOrderId) : '' },
          disabled: !order.handoverOrderId,
        })}
        ${renderActionButton({
          label: '查看加工单',
          action: 'navigate',
          attrs: { href: buildDyeingWorkOrderDetailLink(order.dyeOrderId) },
        })}
      </div>
      ${
        review?.rejectReason
          ? `<div class="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">驳回原因：${escapeHtml(review.rejectReason)}</div>`
          : ''
      }
    `,
  )
}

export function renderCraftDyeingReportsPage(): string {
  const orders = listDyeWorkOrders()
  const selectedId = getSelectedDyeOrderId(orders[0]?.dyeOrderId || '')

  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader('染色统计', '')}
      ${renderTopMetrics()}
      ${renderNodeOverview()}
      ${renderDurationTable()}
      ${renderVatUtilization()}
      ${renderReviewTable(selectedId)}
      ${renderSelectedDetail(selectedId)}
    </div>
  `
}
