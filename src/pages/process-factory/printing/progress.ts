import { renderCraftPrintingWorkOrdersPage } from './work-orders.ts'

/**
 * 历史“执行进度”入口已并入印花加工单。
 *
 * 路由层会把 /fcs/craft/printing/progress 重定向到加工单列表；保留这个
 * 渲染导出只为兼容旧调用方，避免再维护一套花型、打印、转印和审核状态。
 */
export function renderCraftPrintingProgressPage(): string {
  return renderCraftPrintingWorkOrdersPage()
}
