import { getPostFinishingExecutionStatistics } from '../../../data/fcs/process-statistics-domain.ts'
import {
  formatGarmentQty,
  renderPostFinishingPageHeader,
  renderPostMetricCard,
  renderPostSection,
} from './shared.ts'

export function renderPostFinishingStatisticsPage(): string {
  const statistics = getPostFinishingExecutionStatistics()

  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('后道统计')}
      <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        ${renderPostMetricCard('后道单总数', String(statistics.postOrderCount), '统一后道单')}
        ${renderPostMetricCard('待接收领料任务数', String(statistics.waitReceiveTaskCount), '接收领料')}
        ${renderPostMetricCard('已接收成衣件数', formatGarmentQty(statistics.receiveDoneGarmentQty), '接收领料')}
        ${renderPostMetricCard('接收差异成衣件数', formatGarmentQty(statistics.receiveDiffGarmentQty), '接收领料')}
        ${renderPostMetricCard('待后道任务数', String(statistics.waitPostTaskCount), '状态分布')}
        ${renderPostMetricCard('后道中任务数', String(statistics.postDoingTaskCount), '状态分布')}
        ${renderPostMetricCard('后道完成任务数', String(statistics.postDoneTaskCount), '状态分布')}
        ${renderPostMetricCard('待质检任务数', String(statistics.waitQcTaskCount), '状态分布')}
        ${renderPostMetricCard('质检中任务数', String(statistics.qcDoingTaskCount), '状态分布')}
        ${renderPostMetricCard('质检完成任务数', String(statistics.qcDoneTaskCount), '状态分布')}
        ${renderPostMetricCard('待复检任务数', String(statistics.waitRecheckTaskCount), '状态分布')}
        ${renderPostMetricCard('复检中任务数', String(statistics.recheckDoingTaskCount), '状态分布')}
        ${renderPostMetricCard('复检完成任务数', String(statistics.recheckDoneTaskCount), '状态分布')}
        ${renderPostMetricCard('待交出任务数', String(statistics.waitHandoverTaskCount), '复检完成后')}
        ${renderPostMetricCard('已交出任务数', String(statistics.handedOverTaskCount), '统一交出记录')}
        ${renderPostMetricCard('已完成任务数', String(statistics.completedTaskCount), '已回写或完成')}
        ${renderPostMetricCard('待后道成衣件数', formatGarmentQty(statistics.waitPostGarmentQty), '统一待加工仓')}
        ${renderPostMetricCard('后道完成成衣件数', formatGarmentQty(statistics.postDoneGarmentQty), '后道记录')}
        ${renderPostMetricCard('待质检成衣件数', formatGarmentQty(statistics.waitQcGarmentQty), '统一待加工仓')}
        ${renderPostMetricCard('质检通过成衣件数', formatGarmentQty(statistics.qcPassGarmentQty), '质检记录')}
        ${renderPostMetricCard('质检不合格成衣件数', formatGarmentQty(statistics.qcRejectedGarmentQty), '质检记录')}
        ${renderPostMetricCard('待复检成衣件数', formatGarmentQty(statistics.waitRecheckGarmentQty), '统一待加工仓')}
        ${renderPostMetricCard('复检确认成衣件数', formatGarmentQty(statistics.recheckConfirmedGarmentQty), '复检记录')}
        ${renderPostMetricCard('待交出成衣件数', formatGarmentQty(statistics.waitHandoverGarmentQty), '复检完成待交出')}
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
        ${renderPostMetricCard('后道工厂执行后道任务数', String(statistics.postFactoryExecutedTaskCount), '流程来源')}
        ${renderPostMetricCard('车缝厂已完成后道任务数', String(statistics.sewingFactoryPostDoneTaskCount), '流程来源')}
        ${renderPostMetricCard('专门后道工厂待质检成衣件数', formatGarmentQty(statistics.dedicatedWaitQcGarmentQty), '后道工厂直管')}
        ${renderPostMetricCard('专门后道工厂待复检成衣件数', formatGarmentQty(statistics.dedicatedWaitRecheckGarmentQty), '后道工厂直管')}
        ${renderPostMetricCard('非专门工厂已完成后道待交给后道工厂任务数', String(statistics.transferWaitManagedFactoryTaskCount), '车缝等工厂转入')}
        ${renderPostMetricCard('非专门工厂转入后道工厂待质检成衣件数', formatGarmentQty(statistics.transferInWaitQcGarmentQty), '转入待处理')}
        ${renderPostMetricCard('非专门工厂转入后道工厂待复检成衣件数', formatGarmentQty(statistics.transferInWaitRecheckGarmentQty), '转入待处理')}
      </section>
      ${renderPostSection(
        '节点平均耗时',
        `
          <div class="grid gap-3 md:grid-cols-3">
            ${renderPostMetricCard('后道平均耗时', `${statistics.postAverageHours} 小时`, '按后道记录计算')}
            ${renderPostMetricCard('质检平均耗时', `${statistics.qcAverageHours} 小时`, '按后道工厂质检记录计算')}
            ${renderPostMetricCard('复检平均耗时', `${statistics.recheckAverageHours} 小时`, '按后道工厂复检记录计算')}
            ${renderPostMetricCard('交出平均回写耗时', `${statistics.handoverAverageWritebackHours} 小时`, '统一交出记录')}
            ${renderPostMetricCard('待回写超时记录数', String(statistics.overdueWritebackCount), '超过 48 小时')}
          </div>
        `,
      )}
    </div>
  `
}
