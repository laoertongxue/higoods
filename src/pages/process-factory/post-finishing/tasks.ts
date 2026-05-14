import {
  buildPostFinishingTaskLink,
  buildTaskRouteCardPrintLink,
} from '../../../data/fcs/fcs-route-links.ts'
import {
  getPostFinishingTaskById,
  listPostFinishingQcOrderEntities,
  listPostFinishingRecheckOrderEntities,
  listPostFinishingTasks,
  listPostFinishingWaitQcSkuItems,
  listPostFinishingWorkOrders,
  type PostFinishingTaskView,
} from '../../../data/fcs/post-finishing-domain.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatGarmentQty,
  getPostListFilters,
  paginatePostRows,
  postFilterTextMatches,
  renderPostAction,
  renderPostFilterPanel,
  renderPostFinishingPageHeader,
  renderPostMetricCard,
  renderPostPagination,
  renderPostSection,
  renderPostStatusBadge,
  renderPostTable,
} from './shared.ts'

function currentParams(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function createQcLink(task: PostFinishingTaskView): string {
  return `/fcs/craft/post-finishing/qc-orders?postTaskId=${encodeURIComponent(task.postTaskId)}&createQc=1`
}

function taskQcListLink(task: PostFinishingTaskView): string {
  return `/fcs/craft/post-finishing/qc-orders?postTaskId=${encodeURIComponent(task.postTaskId)}&tab=qc&keyword=${encodeURIComponent(task.productionOrderNo)}`
}

function filterTasks(tasks: PostFinishingTaskView[], filters: ReturnType<typeof getPostListFilters>): PostFinishingTaskView[] {
  return tasks.filter((task) => {
    const sourceLabel = task.sourceFactoryNames.join('、') || '待上游交出'
    if (filters.status !== '全部' && task.currentStatus !== filters.status) return false
    if (filters.source !== '全部' && sourceLabel !== filters.source) return false
    if (filters.factory !== '全部' && task.managedPostFactoryName !== filters.factory) return false
    return postFilterTextMatches(filters.keyword, [
      task.postTaskNo,
      task.productionOrderNo,
      task.styleNo,
      task.styleName,
      task.spuCode,
      task.spuName,
      task.techPackVersionLabel,
      sourceLabel,
      task.currentStatus,
      task.currentNode,
    ])
  })
}

function renderTaskRows(tasks: PostFinishingTaskView[]): string {
  return tasks.map((task) => {
    const sourceLabel = task.sourceFactoryNames.join('、') || '待上游交出'
    const unQcQty = Math.max(task.receivedQty - task.qcDoneQty, task.waitQcQty + task.qcInProgressQty)
    return `
      <tr class="align-top">
        <td class="px-3 py-3">
          <div class="font-mono text-xs font-semibold">${escapeHtml(task.postTaskNo)}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.postTaskId)}</div>
        </td>
        <td class="px-3 py-3 text-sm">
          <div class="font-semibold">${escapeHtml(task.productionOrderNo)}</div>
          <div class="text-xs text-muted-foreground">${escapeHtml(task.techPackVersionLabel)}</div>
        </td>
        <td class="px-3 py-3 text-sm">
          <div class="font-semibold">${escapeHtml(task.spuName)}</div>
          <div class="text-xs text-muted-foreground">${escapeHtml(task.spuCode)}</div>
        </td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(task.plannedGarmentQty, task.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(unQcQty, task.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(task.qcDoneQty, task.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(task.waitHandoverQty, task.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(sourceLabel)}</td>
        <td class="px-3 py-3">
          <div class="flex flex-wrap gap-2">
            ${renderPostAction('查看任务', buildPostFinishingTaskLink(task.postTaskId))}
            ${renderPostAction('创建质检单', createQcLink(task), task.waitQcQty <= 0)}
            ${renderPostAction('查看质检单', taskQcListLink(task))}
            ${renderPostAction('打印流转卡', buildTaskRouteCardPrintLink('POST_FINISHING_TASK', task.postTaskId))}
          </div>
        </td>
      </tr>
    `
  }).join('')
}

function renderTaskDetail(task: PostFinishingTaskView): string {
  const waitItems = listPostFinishingWaitQcSkuItems({ postTaskId: task.postTaskId })
  const qcOrders = listPostFinishingQcOrderEntities().filter((item) => item.postTaskId === task.postTaskId || item.productionOrderNo === task.productionOrderNo)
  const postOrders = listPostFinishingWorkOrders().filter((item) => item.postTaskId === task.postTaskId || item.sourceProductionOrderNo === task.productionOrderNo)
  const recheckOrders = listPostFinishingRecheckOrderEntities().filter((item) => item.postTaskId === task.postTaskId || item.productionOrderNo === task.productionOrderNo)
  const waitRows = waitItems.map((item) => `
    <tr>
      <td class="px-3 py-2">${escapeHtml(item.skuCode)}</td>
      <td class="px-3 py-2">${escapeHtml(item.colorName)} / ${escapeHtml(item.sizeName)}</td>
      <td class="px-3 py-2">${formatGarmentQty(item.waitQcQty, item.qtyUnit)}</td>
      <td class="px-3 py-2">${escapeHtml(item.locationCode ? `${item.areaName || '未分区'} / ${item.locationCode}` : item.areaName || '未分区')}</td>
    </tr>
  `).join('')
  const qcRows = qcOrders.map((item) => `
    <tr>
      <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.qcOrderNo)}</td>
      <td class="px-3 py-2">${renderPostStatusBadge(item.qcStatus)}</td>
      <td class="px-3 py-2">${formatGarmentQty(item.inspectedGarmentQty)}</td>
      <td class="px-3 py-2">${formatGarmentQty(item.passedGarmentQty)}</td>
      <td class="px-3 py-2">${escapeHtml(item.inspectorName || '—')}</td>
    </tr>
  `).join('')
  const postRows = postOrders.map((item) => `
    <tr>
      <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.postOrderNo)}</td>
      <td class="px-3 py-2">${escapeHtml(item.postProcessItems.join('、') || '无需后道单')}</td>
      <td class="px-3 py-2">${renderPostStatusBadge(item.postStatus)}</td>
      <td class="px-3 py-2">${formatGarmentQty(item.plannedGarmentQty, item.plannedGarmentQtyUnit)}</td>
    </tr>
  `).join('')
  const recheckRows = recheckOrders.map((item) => `
    <tr>
      <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.recheckOrderNo)}</td>
      <td class="px-3 py-2">${escapeHtml(item.sourceType)}</td>
      <td class="px-3 py-2">${renderPostStatusBadge(item.recheckStatus)}</td>
      <td class="px-3 py-2">${formatGarmentQty(item.passedGarmentQty)}</td>
    </tr>
  `).join('')

  return renderPostSection('任务详情', `
    <div class="space-y-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderPostMetricCard('生产单', task.productionOrderNo, task.spuName)}
        ${renderPostMetricCard('计划数量', formatGarmentQty(task.plannedGarmentQty, task.qtyUnit), task.techPackVersionLabel)}
        ${renderPostMetricCard('未质检数量', formatGarmentQty(Math.max(task.receivedQty - task.qcDoneQty, task.waitQcQty + task.qcInProgressQty), task.qtyUnit), `${task.qcOrderCount} 张质检单`)}
        ${renderPostMetricCard('待交出数量', formatGarmentQty(task.waitHandoverQty, task.qtyUnit), `${task.recheckOrderCount} 张复检单`)}
      </div>
      <div class="flex flex-wrap gap-2">
        ${renderPostAction('创建质检单', createQcLink(task), task.waitQcQty <= 0)}
        ${renderPostAction('查看质检单', taskQcListLink(task))}
        ${renderPostAction('查看后道单', `/fcs/craft/post-finishing/work-orders?keyword=${encodeURIComponent(task.productionOrderNo)}`)}
        ${renderPostAction('查看复检单', `/fcs/craft/post-finishing/recheck-orders?keyword=${encodeURIComponent(task.productionOrderNo)}`)}
        ${renderPostAction('打印流转卡', buildTaskRouteCardPrintLink('POST_FINISHING_TASK', task.postTaskId))}
      </div>
      <div class="grid gap-4 xl:grid-cols-2">
        ${renderPostSection('待质检库存', renderPostTable(['SKU', '颜色 / 尺码', '待质检数量', '库区 / 库位'], waitRows || '<tr><td colspan="4" class="px-3 py-6 text-center text-sm text-muted-foreground">暂无待质检库存</td></tr>', 'min-w-[620px]'))}
        ${renderPostSection('质检单', renderPostTable(['质检单号', '状态', '质检数量', '合格数量', '质检人'], qcRows || '<tr><td colspan="5" class="px-3 py-6 text-center text-sm text-muted-foreground">暂无质检单</td></tr>', 'min-w-[720px]'))}
        ${renderPostSection('后道单', renderPostTable(['后道单号', '后道项目', '状态', '数量'], postRows || '<tr><td colspan="4" class="px-3 py-6 text-center text-sm text-muted-foreground">暂无后道单</td></tr>', 'min-w-[620px]'))}
        ${renderPostSection('复检单', renderPostTable(['复检单号', '来源', '状态', '合格数量'], recheckRows || '<tr><td colspan="4" class="px-3 py-6 text-center text-sm text-muted-foreground">暂无复检单</td></tr>', 'min-w-[620px]'))}
      </div>
    </div>
  `)
}

export function renderPostFinishingTasksPage(): string {
  const tasks = listPostFinishingTasks()
  const filters = getPostListFilters()
  const filteredTasks = filterTasks(tasks, filters)
  const pagination = paginatePostRows(filteredTasks, filters)
  const selectedTaskId = currentParams().get('taskId') || ''
  const selectedTask = selectedTaskId ? getPostFinishingTaskById(selectedTaskId) : undefined
  const totalPlannedQty = tasks.reduce((sum, task) => sum + task.plannedGarmentQty, 0)
  const totalWaitQcQty = tasks.reduce((sum, task) => sum + task.waitQcQty + task.qcInProgressQty, 0)
  const totalWaitHandoverQty = tasks.reduce((sum, task) => sum + task.waitHandoverQty, 0)
  const rows = renderTaskRows(pagination.rows)
  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('后道任务')}
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderPostMetricCard('后道任务', String(tasks.length), '生产单级主线')}
        ${renderPostMetricCard('计划数量', formatGarmentQty(totalPlannedQty), '全部生产单')}
        ${renderPostMetricCard('未质检数量', formatGarmentQty(totalWaitQcQty), '待质检与质检中')}
        ${renderPostMetricCard('待交出数量', formatGarmentQty(totalWaitHandoverQty), '复检完成待交出')}
      </div>
      ${renderPostFilterPanel({
        filters,
        statusOptions: tasks.map((task) => task.currentStatus),
        sourceOptions: tasks.map((task) => task.sourceFactoryNames.join('、') || '待上游交出'),
        factoryOptions: tasks.map((task) => task.managedPostFactoryName),
        keywordPlaceholder: '后道任务 / 生产单 / 款式 / 技术包版本',
      })}
      ${renderPostSection('后道任务列表', `${renderPostTable(
        ['后道任务', '生产单 / 技术包', '款式衣服', '计划数量', '未质检', '已质检', '待交出', '上游来源', '操作'],
        rows || '<tr><td colspan="9" class="px-3 py-8 text-center text-sm text-muted-foreground">暂无后道任务</td></tr>',
        'min-w-[1280px]',
      )}<div class="mt-4">${renderPostPagination(pagination)}</div>`)}
      ${selectedTask ? renderTaskDetail(selectedTask) : ''}
    </div>
  `
}
