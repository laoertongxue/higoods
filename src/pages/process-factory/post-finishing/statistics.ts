import { listPostFinishingTasks } from '../../../data/fcs/post-finishing-current-read-model.ts'
// @page-pattern: dashboard

import { getPostFinishingExecutionStatistics } from '../../../data/fcs/process-statistics-domain.ts'
import {
  listPostFinishingFullFlowOutboundOrders,
  listPostFinishingFullFlowPostTasks,
  listPostFinishingMaterialTransferOrders,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import {
  formatGarmentQty,
  renderPostFinishingPageHeader,
  renderPostMetricCard,
  renderPostSection,
} from './shared.ts'

export function renderPostFinishingStatisticsPage(): string {
  const statistics = getPostFinishingExecutionStatistics()
  const sourceTasks = [...new Map(listPostFinishingTasks().flatMap(task => task.sourceTasks).map(task => [task.taskId, task])).values()]
  const postTasks = listPostFinishingFullFlowPostTasks()
  const outboundOrders = listPostFinishingFullFlowOutboundOrders()
  const materialTransfers = listPostFinishingMaterialTransferOrders()

  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('后道统计')}
      ${renderPostSection('任务责任与质检分支', `<div class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        ${renderPostMetricCard('仅车缝生产任务', String(sourceTasks.filter((order) => order.taskType === 'INDEPENDENT_SEWING').length), '后道工厂负责烫包')}
        ${renderPostMetricCard('车缝＋烫包生产任务', String(sourceTasks.filter((order) => order.taskType === 'SEWING_TO_IRON_PACK').length), '三方工厂负责烫包')}
        ${renderPostMetricCard('裁剪＋车缝＋烫包任务', String(sourceTasks.filter((order) => order.taskType === 'CUTTING_TO_IRON_PACK').length), '与车缝＋烫包同规则')}
        ${renderPostMetricCard('质检直达成衣仓', String(outboundOrders.filter((order) => order.sourceType === '质检直达').length), '无需我方后道处理')}
        ${renderPostMetricCard('质检补加工', String(postTasks.filter((task) => task.sourceType === '质检补加工').length), '按质检勾选项目')}
        ${renderPostMetricCard('待入库辅料调拨单', String(materialTransfers.filter((order) => order.status === '待入库').length), '不计入成衣库存')}
      </div>`)}
      <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        ${renderPostMetricCard('后道生产任务总数', String(statistics.workOrderCount), '生产单级流程记录')}
        ${renderPostMetricCard('后道加工单总数', String(statistics.postOrderCount), '质检勾选实际工序后生成')}
        ${renderPostMetricCard('待接收入仓任务数', String(statistics.waitReceiveTaskCount), '接收入仓')}
        ${renderPostMetricCard('已接收成衣件数', formatGarmentQty(statistics.receiveDoneGarmentQty), '接收入仓')}
        ${renderPostMetricCard('接收差异成衣件数', formatGarmentQty(statistics.receiveDiffGarmentQty), '接收入仓')}
        ${renderPostMetricCard('待加工单数', String(statistics.waitPostTaskCount), '状态分布')}
        ${renderPostMetricCard('加工中单数', String(statistics.postDoingTaskCount), '状态分布')}
        ${renderPostMetricCard('加工完成单数', String(statistics.postDoneTaskCount), '状态分布')}
        ${renderPostMetricCard('待质检单数', String(statistics.waitQcTaskCount), '状态分布')}
        ${renderPostMetricCard('质检中任务数', String(statistics.qcDoingTaskCount), '状态分布')}
        ${renderPostMetricCard('质检完成任务数', String(statistics.qcDoneTaskCount), '状态分布')}
        ${renderPostMetricCard('待处理后复核任务数', String(statistics.waitRecheckTaskCount), '状态分布')}
        ${renderPostMetricCard('处理后复核中任务数', String(statistics.recheckDoingTaskCount), '状态分布')}
        ${renderPostMetricCard('处理后复核完成任务数', String(statistics.recheckDoneTaskCount), '状态分布')}
        ${renderPostMetricCard('待交出任务数', String(statistics.waitHandoverTaskCount), '处理后复核完成后')}
        ${renderPostMetricCard('已交出任务数', String(statistics.handedOverTaskCount), '统一交出记录')}
        ${renderPostMetricCard('已完成任务数', String(statistics.completedTaskCount), '生产单已人工完成')}
        ${renderPostMetricCard('待执行实际工序成衣件数', formatGarmentQty(statistics.waitPostGarmentQty), '统一待加工仓')}
        ${renderPostMetricCard('后道完成成衣件数', formatGarmentQty(statistics.postDoneGarmentQty), '后道记录')}
        ${renderPostMetricCard('待质检成衣件数', formatGarmentQty(statistics.waitQcGarmentQty), '统一待加工仓')}
        ${renderPostMetricCard('质检通过成衣件数', formatGarmentQty(statistics.qcPassGarmentQty), '质检记录')}
        ${renderPostMetricCard('质检不合格成衣件数', formatGarmentQty(statistics.qcRejectedGarmentQty), '质检记录')}
        ${renderPostMetricCard('待处理后复核成衣件数', formatGarmentQty(statistics.waitRecheckGarmentQty), '后道加工完成')}
        ${renderPostMetricCard('处理后复核确认成衣件数', formatGarmentQty(statistics.recheckConfirmedGarmentQty), '数量与条码记录')}
        ${renderPostMetricCard('待交出成衣件数', formatGarmentQty(statistics.waitHandoverGarmentQty), '处理后复核完成待交出')}
        ${renderPostMetricCard('已交出成衣件数', formatGarmentQty(statistics.handedOverGarmentQty), '统一交出记录')}
        ${renderPostMetricCard('实收成衣件数', formatGarmentQty(statistics.receivedGarmentQty), '接收方回写')}
        ${renderPostMetricCard('差异成衣件数', formatGarmentQty(statistics.diffGarmentQty), '统一差异记录')}
        ${renderPostMetricCard('后道交出差异记录数', String(statistics.differenceRecordCount), '统一差异记录')}
        ${renderPostMetricCard('后道少收成衣件数', formatGarmentQty(statistics.lessReceiveGarmentQty), '统一差异记录')}
        ${renderPostMetricCard('后道多收成衣件数', formatGarmentQty(statistics.moreReceiveGarmentQty), '统一差异记录')}
        ${renderPostMetricCard('后道需重新交出记录数', String(statistics.reworkDifferenceRecordCount), '统一差异记录')}
        ${renderPostMetricCard('后道平台处理中记录数', String(statistics.platformProcessingDifferenceRecordCount), '统一差异记录')}
        ${renderPostMetricCard('待回写交出记录数', String(statistics.waitWritebackHandoverCount), '统一交出记录')}
        ${renderPostMetricCard('已回写交出记录数', String(statistics.writtenBackHandoverCount), '统一交出记录')}
        ${renderPostMetricCard('专门后道工厂任务数', String(statistics.dedicatedTaskCount), '后道工厂直管')}
        ${renderPostMetricCard('后道工厂加工任务数', String(statistics.postFactoryExecutedTaskCount), '流程来源')}
        ${renderPostMetricCard('QC 直达生产任务数', String(statistics.sewingFactoryPostDoneTaskCount), '流程来源')}
        ${renderPostMetricCard('专门后道工厂待质检成衣件数', formatGarmentQty(statistics.dedicatedWaitQcGarmentQty), '后道工厂直管')}
        ${renderPostMetricCard('专门后道工厂待处理后复核成衣件数', formatGarmentQty(statistics.dedicatedWaitRecheckGarmentQty), '后道工厂直管')}
        ${renderPostMetricCard('非专门工厂已完成实际工序待交接数', String(statistics.transferWaitManagedFactoryTaskCount), '车缝等工厂转入')}
        ${renderPostMetricCard('非专门工厂转入后道工厂待质检成衣件数', formatGarmentQty(statistics.transferInWaitQcGarmentQty), '转入待处理')}
        ${renderPostMetricCard('非专门工厂转入后道工厂待处理后复核成衣件数', formatGarmentQty(statistics.transferInWaitRecheckGarmentQty), '转入待处理')}
      </section>
      ${renderPostSection(
        '节点平均耗时',
        `
          <div class="grid gap-3 md:grid-cols-3">
            ${renderPostMetricCard('后道平均耗时', `${statistics.postAverageHours} 小时`, '按后道记录计算')}
            ${renderPostMetricCard('质检平均耗时', `${statistics.qcAverageHours} 小时`, '按后道工厂质检记录计算')}
            ${renderPostMetricCard('处理后复核平均耗时', `${statistics.recheckAverageHours} 小时`, '按数量与条码复核记录计算')}
            ${renderPostMetricCard('交出平均回写耗时', `${statistics.handoverAverageWritebackHours} 小时`, '统一交出记录')}
            ${renderPostMetricCard('待回写超时记录数', String(statistics.overdueWritebackCount), '超过 48 小时')}
          </div>
        `,
      )}
    </div>
  `
}
