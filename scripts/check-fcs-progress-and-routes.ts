import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

function assertIncludes(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertIncludesAll(source: string, tokens: string[], scope: string): void {
  tokens.forEach((token) => assertIncludes(source, token, `${scope}缺少：${token}`))
}

function assertIncludesAny(source: string, tokens: string[], scope: string): void {
  assert(tokens.some((token) => source.includes(token)), `${scope}缺少：${tokens.join(' / ')}`)
}

function assertNotIncludes(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

function stripNonUiSource(source: string): string {
  return source
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"]\s*;?/g, '')
    .replace(/^export\s.+$/gm, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

const progressBoardSource = read('src/pages/progress-board/order-domain.ts')
const progressTaskSource = read('src/pages/progress-board/task-domain.ts') + read('src/pages/progress-board/events.ts')
const progressBoardContextSource = read('src/pages/progress-board/context.ts')
const handoverSource =
  read('src/pages/progress-handover.ts') +
  read('src/pages/progress-handover-order.ts')
const materialSource = read('src/pages/progress-material.ts')
const printingStatsSource = read('src/pages/process-factory/printing/statistics.ts')
const printingDashboardsSource = read('src/pages/process-factory/printing/dashboards.ts')
const dyeingReportsSource = read('src/pages/process-factory/dyeing/reports.ts')
const cuttingProgressSource = read('src/pages/process-factory/cutting/production-progress.ts')
const cuttingSummarySource = read('src/pages/process-factory/cutting/cutting-summary.ts')
const pfosTaskPrintEntrySource =
  read('src/pages/process-factory/printing/work-orders.ts') +
  read('src/pages/process-factory/printing/warehouse.ts') +
  read('src/pages/process-factory/dyeing/work-orders.ts') +
  read('src/pages/process-factory/dyeing/warehouse.ts') +
  read('src/pages/process-factory/special-craft/task-orders.ts') +
  read('src/pages/process-factory/special-craft/task-detail.ts') +
  read('src/pages/process-factory/special-craft/warehouse.ts') +
  read('src/pages/process-factory/cutting/original-orders.ts') +
  read('src/pages/process-factory/cutting/merge-batches.ts')
const specialCraftGuardSource =
  read('src/pages/process-factory/special-craft/shared.ts') +
  read('src/pages/process-factory/special-craft/task-orders.ts') +
  read('src/pages/process-factory/special-craft/task-detail.ts') +
  read('src/pages/process-factory/special-craft/warehouse.ts') +
  read('src/pages/process-factory/special-craft/statistics.ts')
const capacitySource =
  read('src/pages/capacity.ts') +
  read('src/pages/factory-capacity-profile.ts') +
  read('src/data/fcs/capacity-calendar.ts') +
  read('src/data/fcs/process-craft-dict.ts')
const routeSources =
  read('src/data/app-shell-config.ts') +
  read('src/data/fcs/fcs-route-links.ts') +
  read('src/router/routes.ts') +
  read('src/router/routes-fcs.ts') +
  read('src/router/routes-pcs.ts') +
  read('src/router/routes-pda.ts') +
  read('src/router/route-renderers.ts') +
  read('src/router/route-renderers-fcs.ts')
const stateStoreSource = read('src/state/store.ts')
const uiSources = [
  progressBoardSource,
  handoverSource,
  materialSource,
  printingStatsSource,
  printingDashboardsSource,
  dyeingReportsSource,
  cuttingProgressSource,
  cuttingSummarySource,
  capacitySource,
].join('\n')
const uiDisplaySource = stripNonUiSource(uiSources)

assertIncludesAll(
  progressBoardSource,
  ['已开工', '已完工', '待交出', '待回写', '差异', '异议', '回货质检', '后道复检', '交期风险'],
  '生产进度看板',
)
assertIncludesAll(
  handoverSource,
  ['buildProductionOrderLink', 'buildTaskDetailLink', 'buildHandoverOrderLink', '质检记录', '复检记录'],
  '交接链路',
)
assertIncludesAll(
  materialSource,
  ['配料进度', '领料状态', '配置状态', '配置卷数', '配置长度', '实领卷数', '差异', '补料状态', '裁片单二维码'],
  '领料/配料进度',
)
assertIncludesAll(
  printingStatsSource,
  ['待送货', '待回写', '待审核', '打印机编号', '打印速度', '差异数量', '异议数量', '查看任务', '查看交出单', '查看审核'],
  '印花统计',
)
assertIncludesAll(
  printingDashboardsSource,
  ['待送货', '待回写', '待审核', '印花大屏', '待处理'],
  '印花大屏',
)
assertIncludesAll(
  dyeingReportsSource,
  ['等待原因', '节点耗时', '染缸利用', '交出差异', '数量异议', '待送货', '待回写', '待审核'],
  '染色报表',
)
assertIncludesAll(
  cuttingProgressSource,
  ['配料状态', '领料状态', '唛架状态', '铺布状态', '菲票状态', '补料状态', '裁片仓状态'],
  '裁床进度',
)
assertIncludesAll(
  cuttingSummarySource,
  ['配料状态', '领料状态', '唛架状态', '铺布状态', '菲票状态', '补料状态', '裁片仓状态'],
  '裁剪总结',
)
assertIncludes(progressBoardSource, '默认按交期排序', '生产进度缺少默认按交期排序提示')
assertIncludes(progressBoardContextSource, 'sortProductionProgressByDefaultDueDate', '生产进度上下文缺少默认交期排序 helper')
assertIncludes(progressTaskSource, '打印任务流转卡', '任务进度看板缺少打印任务流转卡入口')
assertIncludes(progressTaskSource, "buildTaskRouteCardPrintLink('RUNTIME_TASK', task.taskId)", '任务进度看板打印任务流转卡入口必须使用 RUNTIME_TASK + taskId')
assertIncludes(progressTaskSource, '打印任务交货卡', '任务进度看板详情交出记录缺少打印任务交货卡入口')
assertIncludes(progressTaskSource, 'buildTaskDeliveryCardPrintLink(recordId)', '任务进度看板详情交出记录必须按 recordId 打印任务交货卡')
assertIncludes(progressTaskSource, 'renderTaskDeliveryCardAction(record.recordId)', '任务进度看板详情交出记录必须传入 record.recordId')
assertIncludes(handoverSource, '打印任务交货卡', '交接链路页缺少打印任务交货卡入口')
assertIncludes(handoverSource, 'buildTaskDeliveryCardPrintLink(recordId)', '交接链路页打印任务交货卡入口必须按交出记录进入')
assertIncludes(pfosTaskPrintEntrySource, "buildTaskRouteCardPrintLink('PRINTING_WORK_ORDER', order.printOrderId)", '印花加工单打印入口必须可达任务流转卡')
assertIncludes(pfosTaskPrintEntrySource, "buildTaskRouteCardPrintLink('DYEING_WORK_ORDER', order.dyeOrderId)", '染色加工单打印入口必须可达任务流转卡')
assertIncludes(pfosTaskPrintEntrySource, "buildTaskRouteCardPrintLink('SPECIAL_CRAFT_TASK_ORDER', taskOrder.taskOrderId)", '特殊工艺任务打印入口必须可达任务流转卡')
assertIncludes(pfosTaskPrintEntrySource, "buildTaskRouteCardPrintLink('CUTTING_ORIGINAL_ORDER', row.originalCutOrderId)", '原始裁片单打印入口必须可达任务流转卡')
assertIncludes(pfosTaskPrintEntrySource, "buildTaskRouteCardPrintLink('CUTTING_MERGE_BATCH', batch.mergeBatchId)", '裁片批次打印入口必须可达任务流转卡')
assertIncludes(pfosTaskPrintEntrySource, 'buildTaskDeliveryCardPrintLink(item.handoverRecordId)', '特殊工艺仓库出库记录必须可达任务交货卡')
assertIncludes(pfosTaskPrintEntrySource, 'renderCraftPrintingWaitHandoverWarehousePage', '印花待交出仓页面必须可达')
assertIncludes(pfosTaskPrintEntrySource, 'renderCraftDyeingWaitHandoverWarehousePage', '染色待交出仓页面必须可达')
assertIncludes(cuttingProgressSource, "viewDimension: 'CUT_ORDER'", '裁床进度默认视图必须为裁片单维度')
assertIncludes(cuttingProgressSource, '裁片单维度', '裁床进度缺少裁片单维度')
assertIncludes(cuttingProgressSource, '生产单维度', '裁床进度缺少生产单维度')
assertIncludes(cuttingProgressSource, 'originalCutOrderNo', '裁床进度裁片单维度缺少原始裁片单来源')
assertIncludes(specialCraftGuardSource, 'resolveSpecialCraftFactoryContextGuard', '特殊工艺页面缺少工厂上下文 guard')
assertIncludes(specialCraftGuardSource, '当前工厂无该特殊工艺入口', '特殊工艺页面缺少工厂上下文空态')

assertIncludesAny(capacitySource, ['后道 - 开扣眼', '后道 / 开扣眼', '开扣眼'], '产能口径')
assertIncludesAny(capacitySource, ['后道 - 装扣子', '后道 / 装扣子', '装扣子'], '产能口径')
assertIncludesAny(capacitySource, ['后道 - 熨烫', '后道 / 熨烫', '熨烫'], '产能口径')
assertIncludesAny(capacitySource, ['后道 - 包装', '后道 / 包装', '包装'], '产能口径')
assertIncludes(capacitySource, '印花打印机', '产能口径缺少印花打印机')
assertIncludes(capacitySource, '染缸', '产能口径缺少染缸')

assertIncludesAll(
  routeSources,
  [
    '/fcs/progress/board',
    '/fcs/progress/handover',
    '/fcs/print/task-route-card',
    '/fcs/print/task-delivery-card',
    '/fcs/progress/material',
    '/fcs/craft/printing/wait-process-warehouse',
    '/fcs/craft/printing/wait-handover-warehouse',
    '/fcs/craft/dyeing/wait-process-warehouse',
    '/fcs/craft/dyeing/wait-handover-warehouse',
    '/fcs/craft/printing/statistics',
    '/fcs/craft/printing/dashboards',
    '/fcs/craft/dyeing/reports',
    '/fcs/craft/cutting/production-progress',
    '/fcs/craft/cutting/material-prep',
    '/fcs/craft/cutting/summary',
    '/fcs/craft/cutting/warehouse-management/wait-process',
    '/fcs/craft/cutting/warehouse-management/wait-handover',
    '/fcs/craft/cutting/warehouse-management/sample-warehouse',
    '/fcs/quality/qc-records',
    '/fcs/production/orders',
    '/confirmation-print',
    '/fcs/pda/exec',
    '/fcs/pda/handover',
  ],
  '路由注册',
)
assertIncludes(routeSources, 'buildSpecialCraftWaitProcessWarehousePath', '缺少特殊工艺待加工仓路由生成')
assertIncludes(routeSources, 'buildSpecialCraftWaitHandoverWarehousePath', '缺少特殊工艺待交出仓路由生成')
assertIncludes(routeSources, 'renderRouteRedirect(buildSpecialCraftWaitProcessWarehousePath(operation)', '旧特殊工艺 warehouse 路由必须重定向')
assertIncludes(routeSources, 'renderCraftCuttingWarehouseManagementWaitProcessPage', '缺少裁床待加工仓汇总渲染器')
assertIncludes(routeSources, 'renderCraftCuttingWarehouseManagementWaitHandoverPage', '缺少裁床待交出仓汇总渲染器')
assertIncludes(routeSources, "renderRouteRedirect('/fcs/craft/printing/wait-process-warehouse', '正在跳转到印花待加工仓')", '印花旧 warehouse alias 必须重定向到印花待加工仓')
assertIncludes(routeSources, "renderRouteRedirect('/fcs/craft/dyeing/wait-process-warehouse', '正在跳转到染色待加工仓')", '染色旧 warehouse alias 必须重定向到染色待加工仓')
assertIncludes(routeSources, "renderRouteRedirect('/fcs/craft/cutting/warehouse-management/wait-process', '正在跳转到待加工仓')", '裁床旧 warehouse alias 必须重定向到待加工仓')
assertIncludes(stateStoreSource, "'/fcs/craft/cutting/warehouse-management/wait-process'", '裁床旧 tab redirect 必须指向待加工仓汇总页')
assertIncludes(routeSources, 'pattern: /^\\/fcs\\/production\\/orders\\/([^/]+)\\/confirmation-print$/', '缺少生产确认单打印预览动态路由')
assertIncludes(routeSources, 'pattern: /^\\/fcs\\/production\\/orders\\/([^/]+)$/', '缺少生产单详情动态路由')
assertIncludes(routeSources, 'pattern: /^\\/fcs\\/quality\\/qc-records\\/([^/]+)$/', '缺少质检详情动态路由')
assertIncludes(routeSources, 'pattern: /^\\/fcs\\/progress\\/handover\\/order\\/([^/]+)$/', '缺少交接详情动态路由')
assertIncludes(routeSources, 'pattern: /^\\/fcs\\/pda\\/exec\\/([^/]+)$/', '缺少任务详情动态路由')
assertIncludes(routeSources, 'pattern: /^\\/fcs\\/pda\\/handover\\/([^/]+)$/', '缺少交出单详情动态路由')
assertIncludes(routeSources, 'renderTaskRouteCardPrintPage', '缺少任务流转卡打印预览渲染器')
assertIncludes(routeSources, 'renderTaskDeliveryCardPrintPage', '缺少任务交货卡打印预览渲染器')

;[
  '去交接（待交出）',
  ['交出', '头'].join(''),
  '仓库自动回写',
  '印花 PDA',
  '染色 PDA',
  'PDA质检',
  'mock',
  'scaffold',
  'deprecated',
].forEach((token) => {
  assertNotIncludes(uiDisplaySource, token, `当前 prompt 页面源码不应出现：${token}`)
})

execSync('npm run check:menu-routes', {
  cwd: repoRoot,
  stdio: 'pipe',
  encoding: 'utf8',
})

console.log('check-fcs-progress-and-routes.ts PASS')
