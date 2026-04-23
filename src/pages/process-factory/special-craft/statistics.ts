import { getSpecialCraftOperationBySlug } from '../../../data/fcs/special-craft-operations.ts'
import {
  getSpecialCraftStatistics,
  getSpecialCraftTaskOrders,
} from '../../../data/fcs/special-craft-task-orders.ts'
import { getSpecialCraftProgressSnapshots } from '../../../data/fcs/progress-statistics-linkage.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatQty,
  renderEmptyState,
  renderSpecialCraftFactoryContextBlockedLayout,
  renderFilterGrid,
  renderMetricCards,
  renderSpecialCraftPageLayout,
  resolveSpecialCraftFactoryContextGuard,
  renderStatusBadge,
  renderTable,
} from './shared.ts'

export function renderSpecialCraftStatisticsPage(operationSlug: string): string {
  const operation = getSpecialCraftOperationBySlug(operationSlug)
  if (!operation) {
    return renderEmptyState('未找到对应特殊工艺统计页面。')
  }
  const factoryGuard = resolveSpecialCraftFactoryContextGuard(operation)
  if (factoryGuard.blocked) {
    return renderSpecialCraftFactoryContextBlockedLayout({
      operation,
      title: `${operation.operationName}统计`,
      description: '按工艺汇总当前特殊工艺的任务量、数量变化和差异状态。',
      activeSubNav: 'statistics',
      factoryName: factoryGuard.factoryName,
    })
  }

  const taskOrders = getSpecialCraftTaskOrders(operation.operationId)
  const statistics = getSpecialCraftStatistics(operation.operationId, { timeRange: '30D' })
  const progressSnapshots = getSpecialCraftProgressSnapshots().filter((item) => item.operationId === operation.operationId)

  const totalPlanQty = statistics.reduce((sum, item) => sum + item.planQty, 0)
  const totalReceivedQty = statistics.reduce((sum, item) => sum + item.receivedQty, 0)
  const totalCompletedQty = statistics.reduce((sum, item) => sum + item.completedQty, 0)
  const totalWaitHandoverQty = statistics.reduce((sum, item) => sum + item.waitHandoverQty, 0)
  const totalDifferenceCount = statistics.reduce((sum, item) => sum + item.differenceTaskCount, 0)
  const totalObjectionCount = statistics.reduce((sum, item) => sum + item.objectionTaskCount, 0)
  const totalAbnormalCount = statistics.reduce((sum, item) => sum + item.abnormalTaskCount, 0)
  const feiTicketTotals = progressSnapshots.reduce(
    (result, item) => {
      result.waitDispatch += item.waitDispatchFeiTicketCount
      result.dispatched += item.dispatchedFeiTicketCount
      result.received += item.receivedFeiTicketCount
      result.processing += item.processingFeiTicketCount
      result.waitReturn += item.waitReturnFeiTicketCount
      result.returned += item.returnedFeiTicketCount
      result.difference += item.differenceFeiTicketCount
      result.objection += item.objectionFeiTicketCount
      result.receiveDifference += item.receiveDifferenceTicketCount
      result.returnDifference += item.returnDifferenceTicketCount
      result.scrapQty += item.scrapQty
      result.damageQty += item.damageQty
      result.currentQty += item.currentQty
      return result
    },
    { waitDispatch: 0, dispatched: 0, received: 0, processing: 0, waitReturn: 0, returned: 0, difference: 0, objection: 0, receiveDifference: 0, returnDifference: 0, scrapQty: 0, damageQty: 0, currentQty: 0 },
  )
  const targetObjectSummary = Array.from(
    new Set(progressSnapshots.flatMap((item) => item.targetObjectSummary).filter(Boolean)),
  )
  const supportedTargetObjectSummary = Array.from(
    new Set(progressSnapshots.flatMap((item) => item.supportedTargetObjectSummary).filter(Boolean)),
  )
  const totalWorkOrderCount = progressSnapshots.reduce((sum, item) => sum + item.workOrderCount, 0)
  const bundleWidthValues = Array.from(
    new Set(progressSnapshots.flatMap((item) => item.bundleWidthCmValues).filter((value) => value > 0)),
  )
  const bundleLengthValues = Array.from(
    new Set(progressSnapshots.flatMap((item) => item.bundleLengthCmValues).filter((value) => value > 0)),
  )
  const stripCountTotal = progressSnapshots.reduce((sum, item) => sum + item.stripCountTotal, 0)

  const filters = renderFilterGrid([
    { label: '时间周期', value: '今日 / 近 7 天 / 近 30 天 / 自定义' },
    { label: '工厂', value: '全部关联工厂' },
    { label: '生产单', value: '全部生产单' },
    { label: '默认分组', value: '按工艺分组' },
    { label: '状态', value: '全部状态' },
    { label: '异常类型', value: '全部异常类型' },
    { label: '是否已回仓', value: '全部 / 已回仓 / 未回仓' },
  ])

  const metrics = renderMetricCards([
    { label: '任务总数', value: String(taskOrders.length), tone: 'blue' },
    { label: '子工艺单数', value: String(totalWorkOrderCount), tone: 'violet' },
    { label: '计划数量', value: formatQty(totalPlanQty), tone: 'blue' },
    { label: '已接收数量', value: formatQty(totalReceivedQty), tone: 'green' },
    { label: '已完成数量', value: formatQty(totalCompletedQty), tone: 'green' },
    { label: '待交出数量', value: formatQty(totalWaitHandoverQty), tone: 'amber' },
    { label: '差异数量', value: String(totalDifferenceCount), tone: 'red' },
    { label: '异常数量', value: String(totalAbnormalCount), tone: 'red' },
    { label: '待发料菲票', value: String(feiTicketTotals.waitDispatch), tone: 'amber' },
    { label: '已发料菲票', value: String(feiTicketTotals.dispatched), tone: 'blue' },
    { label: '已接收菲票', value: String(feiTicketTotals.received), tone: 'blue' },
    { label: '待回仓菲票', value: String(feiTicketTotals.waitReturn), tone: 'amber' },
    { label: '已回仓菲票', value: String(feiTicketTotals.returned), tone: 'green' },
    { label: '差异菲票', value: String(feiTicketTotals.difference || totalDifferenceCount), tone: 'red' },
    { label: '接收差异菲票', value: String(feiTicketTotals.receiveDifference), tone: 'red' },
    { label: '回仓差异菲票', value: String(feiTicketTotals.returnDifference), tone: 'red' },
    { label: '异议中菲票', value: String(feiTicketTotals.objection || totalObjectionCount), tone: 'red' },
    { label: '报废数量', value: formatQty(feiTicketTotals.scrapQty), tone: 'red' },
    { label: '货损数量', value: formatQty(feiTicketTotals.damageQty), tone: 'red' },
    { label: '当前数量', value: formatQty(feiTicketTotals.currentQty), tone: 'blue' },
    { label: '异常', value: String(totalAbnormalCount), tone: 'red' },
  ])

  const nodeStatusCards = renderMetricCards([
    { label: '待领料', value: String(taskOrders.filter((item) => item.status === '待领料').length), tone: 'amber' },
    { label: '已入待加工仓', value: String(taskOrders.filter((item) => item.status === '已入待加工仓').length), tone: 'blue' },
    { label: '加工中', value: String(taskOrders.filter((item) => item.status === '加工中').length), tone: 'blue' },
    { label: '已完成', value: String(taskOrders.filter((item) => item.status === '已完成').length), tone: 'green' },
    { label: '待交出', value: String(taskOrders.filter((item) => item.status === '待交出').length), tone: 'amber' },
    { label: '已交出', value: String(taskOrders.filter((item) => item.status === '已交出').length), tone: 'blue' },
    { label: '已回写', value: String(taskOrders.filter((item) => item.status === '已回写').length), tone: 'green' },
    { label: '差异', value: String(taskOrders.filter((item) => item.status === '差异').length), tone: 'red' },
    { label: '异议中', value: String(taskOrders.filter((item) => item.status === '异议中').length), tone: 'red' },
    { label: '异常', value: String(taskOrders.filter((item) => item.status === '异常').length), tone: 'red' },
  ])

  const rows = statistics
    .map(
      (item) => {
        const matchedSnapshots = progressSnapshots.filter((snapshot) => snapshot.factoryId === item.factoryId)
        return `
        <tr>
          <td class="px-3 py-3">${escapeHtml(item.date)}</td>
          <td class="px-3 py-3">${escapeHtml(item.factoryName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.operationName)}</td>
          <td class="px-3 py-3">${escapeHtml(Array.from(new Set(matchedSnapshots.flatMap((snapshot) => snapshot.targetObjectSummary))).join('、') || '—')}</td>
          <td class="px-3 py-3">${String(matchedSnapshots.reduce((sum, snapshot) => sum + snapshot.workOrderCount, 0))}</td>
          <td class="px-3 py-3">${String(item.taskCount)}</td>
          <td class="px-3 py-3">${formatQty(item.planQty)}</td>
          <td class="px-3 py-3">${formatQty(item.receivedQty)}</td>
          <td class="px-3 py-3">${formatQty(item.completedQty)}</td>
          <td class="px-3 py-3">${formatQty(item.waitHandoverQty)}</td>
          <td class="px-3 py-3">${String(matchedSnapshots.filter((snapshot) => snapshot.returnedFeiTicketCount > 0).reduce((sum, snapshot) => sum + snapshot.returnedFeiTicketCount, 0))}</td>
          <td class="px-3 py-3">${renderStatusBadge(String(matchedSnapshots.reduce((sum, snapshot) => sum + snapshot.differenceFeiTicketCount, 0) || item.differenceTaskCount))}</td>
          <td class="px-3 py-3">${renderStatusBadge(String(item.abnormalTaskCount))}</td>
        </tr>
      `
      },
    )
    .join('')

  const content = `
    ${filters}
    ${metrics}
    <section class="rounded-2xl border bg-white p-4 shadow-sm">
      <h2 class="text-base font-semibold text-foreground">节点状态</h2>
      <p class="mt-1 text-xs text-muted-foreground">默认按工艺分组，状态分布同步任务单节点，并补充菲票回仓、作用对象和数量变化。</p>
      <div class="mt-4">${nodeStatusCards}</div>
    </section>
    <section class="rounded-2xl border bg-white p-4 shadow-sm">
      <h2 class="text-base font-semibold text-foreground">工艺补充口径</h2>
      <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-2xl border bg-slate-50/60 p-3">
          <div class="text-xs text-muted-foreground">作用对象</div>
          <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(targetObjectSummary.join('、') || '—')}</div>
        </div>
        <div class="rounded-2xl border bg-slate-50/60 p-3">
          <div class="text-xs text-muted-foreground">支持作用对象</div>
          <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(supportedTargetObjectSummary.join('、') || '—')}</div>
        </div>
        ${
          bundleWidthValues.length || bundleLengthValues.length
            ? `
              <div class="rounded-2xl border bg-slate-50/60 p-3">
                <div class="text-xs text-muted-foreground">捆条宽度（厘米）</div>
                <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(bundleWidthValues.join(' / ') || '—')}</div>
              </div>
              <div class="rounded-2xl border bg-slate-50/60 p-3">
                <div class="text-xs text-muted-foreground">捆条长度 / 条数</div>
                <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(
                  `${bundleLengthValues.join(' / ') || '—'}${stripCountTotal > 0 ? ` · ${stripCountTotal} 条` : ''}`,
                )}</div>
              </div>
            `
            : ''
        }
      </div>
    </section>
    ${
      statistics.length > 0
        ? renderTable(['日期', '工厂', '特殊工艺', '作用对象', '子工艺单数', '任务数', '计划数量', '已接收数量', '已完成数量', '待交出数量', '已回仓菲票', '差异菲票', '异常'], rows, 'min-w-[1440px]')
        : renderEmptyState()
    }
  `

  return renderSpecialCraftPageLayout({
    operation,
    title: `${operation.operationName}统计`,
    description: '按时间周期汇总当前特殊工艺的任务量、节点状态与差异情况。',
    activeSubNav: 'statistics',
    content,
  })
}
