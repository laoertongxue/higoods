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
        ${renderPostMetricCard('仅车缝生产任务', String(sourceTasks.filter((order) => order.taskType === 'INDEPENDENT_SEWING').length), '后道按质检勾选的实际项目执行')}
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
        ${renderPostMetricCard('待成衣仓接收任务数', String(statistics.waitHandoverTaskCount), '存在尚未实收的出货单')}
        ${renderPostMetricCard('全部出货已收任务数', String(statistics.handedOverTaskCount), '全量加工及后续已闭环，待生产任务人工完成')}
        ${renderPostMetricCard('已完成任务数', String(statistics.completedTaskCount), '生产单已人工完成')}
        ${renderPostMetricCard('尚未完成全部后道件数', formatGarmentQty(statistics.waitPostGarmentQty), '逐SKU应加工量减全部适用项完成量')}
        ${renderPostMetricCard('后道完成成衣件数', formatGarmentQty(statistics.postDoneGarmentQty), '后道记录')}
        ${renderPostMetricCard('待质检成衣件数', formatGarmentQty(statistics.waitQcGarmentQty), '统一待加工仓')}
        ${renderPostMetricCard('实检合格成衣件数', formatGarmentQty(statistics.qcPassGarmentQty), '质检记录')}
        ${renderPostMetricCard('实际检查成衣件数', formatGarmentQty(statistics.qcInspectedGarmentQty), '只统计已记录的真实实检量')}
        ${renderPostMetricCard('未抽随批放行件数', formatGarmentQty(statistics.qcUninspectedReleaseGarmentQty), '已完成QC中未实际抽检的正常放行量')}
        ${renderPostMetricCard('正常放行件数', formatGarmentQty(statistics.qcReleasedGarmentQty), '实检合格加未抽随批放行')}
        ${renderPostMetricCard('历史实检量未知单数', String(statistics.unknownQcInspectionCount), '未按应检量补齐，未知历史不计入实检数量')}
        ${renderPostMetricCard('加工完成待实际发出件数', formatGarmentQty(statistics.waitOutboundGarmentQty), '含待准备出货和已准备未发出的成衣')}
        ${renderPostMetricCard('待实际发出单数', String(statistics.waitOutboundOrderCount), '已生成出货单，尚未实际发出')}
        ${renderPostMetricCard('实检不合格成衣件数', formatGarmentQty(statistics.qcRejectedGarmentQty), '质检记录')}
        ${renderPostMetricCard('待成衣仓接收件数', formatGarmentQty(statistics.waitHandoverGarmentQty), '已实际发出，尚未实收')}
        ${renderPostMetricCard('已实际发出件数', formatGarmentQty(statistics.handedOverGarmentQty), '已确认实际发出，包含待仓库实收的成衣')}
        ${renderPostMetricCard('成衣仓实收件数', formatGarmentQty(statistics.receivedGarmentQty), '逐张出货的实际接收')}
        ${renderPostMetricCard('成衣仓收货差异件数', formatGarmentQty(statistics.diffGarmentQty), '实际接收与本次出货之差')}
        ${renderPostMetricCard('成衣仓收货差异单数', String(statistics.differenceRecordCount), '按有差异的出货单计数')}
        ${renderPostMetricCard('成衣仓少收件数', formatGarmentQty(statistics.lessReceiveGarmentQty), '逐张出货的实际接收差异')}
        ${renderPostMetricCard('成衣仓多收件数', formatGarmentQty(statistics.moreReceiveGarmentQty), '逐张出货的实际接收差异')}
        ${renderPostMetricCard('后道需重新交出记录数', String(statistics.reworkDifferenceRecordCount), '统一差异记录')}
        ${renderPostMetricCard('后道平台处理中记录数', String(statistics.platformProcessingDifferenceRecordCount), '统一差异记录')}
        ${renderPostMetricCard('待实收出货单数', String(statistics.waitWritebackHandoverCount), '逐张出货单')}
        ${renderPostMetricCard('已完成实收出货单数', String(statistics.writtenBackHandoverCount), '逐张出货单')}
        ${renderPostMetricCard('专门后道工厂任务数', String(statistics.dedicatedTaskCount), '后道工厂直管')}
        ${renderPostMetricCard('后道工厂加工任务数', String(statistics.postFactoryExecutedTaskCount), '流程来源')}
        ${renderPostMetricCard('QC 直达生产任务数', String(statistics.sewingFactoryPostDoneTaskCount), '流程来源')}
        ${renderPostMetricCard('专门后道工厂待质检成衣件数', formatGarmentQty(statistics.dedicatedWaitQcGarmentQty), '后道工厂直管')}
        ${renderPostMetricCard('非专门工厂已完成实际工序待交接数', String(statistics.transferWaitManagedFactoryTaskCount), '车缝等工厂转入')}
        ${renderPostMetricCard('非专门工厂转入后道工厂待质检成衣件数', formatGarmentQty(statistics.transferInWaitQcGarmentQty), '转入待处理')}
      </section>
      ${renderPostSection(
        '节点平均耗时',
        `
          <div class="grid gap-3 md:grid-cols-3">
            ${renderPostMetricCard('后道平均耗时', `${statistics.postAverageHours} 小时`, '按后道记录计算')}
            ${renderPostMetricCard('质检平均耗时', `${statistics.qcAverageHours} 小时`, '按后道工厂质检记录计算')}
            ${renderPostMetricCard('交出平均回写耗时', `${statistics.handoverAverageWritebackHours} 小时`, '实际发出至仓库实收')}
            ${renderPostMetricCard('待回写超时记录数', String(statistics.overdueWritebackCount), '超过 48 小时')}
          </div>
        `,
      )}
    </div>
  `
}
