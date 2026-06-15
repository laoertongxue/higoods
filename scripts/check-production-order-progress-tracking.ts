import { menusBySystem } from '../src/data/app-shell-config.ts'
import { routes } from '../src/router/routes-fcs.ts'
import { appStore } from '../src/state/store.ts'
import {
  handleProductionOrderProgressEvent,
  renderProductionOrderProgressTrackingPage,
} from '../src/pages/production-order-progress-tracking.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function assertIncludes(source: string, expected: string, context: string): void {
  assert(source.includes(expected), `${context} 缺少「${expected}」`)
}

async function renderAt(pathname: string): Promise<string> {
  appStore.navigate(pathname, { historyMode: 'replace' })
  return renderProductionOrderProgressTrackingPage()
}

async function main(): Promise<void> {
  const fcsMenus = menusBySystem.fcs ?? []
  const progressGroup = fcsMenus
    .flatMap((group) => group.items)
    .find((item) => item.key === 'fcs-platform-progress')
  assert(progressGroup, '未找到任务进度与异常菜单组')
  assert(
    progressGroup.children?.some((item) => item.title === '生产单进度跟踪' && item.href === '/fcs/progress/production-orders'),
    '任务进度与异常下未注册生产单进度跟踪二级菜单',
  )

  assert(routes.exactRoutes['/fcs/progress/production-orders'], '缺少生产单进度跟踪列表路由')
  assert(routes.exactRoutes['/fcs/progress/production-orders/detail'], '缺少生产单全生命周期详情路由')

  const listHtml = await renderAt('/fcs/progress/production-orders')
  ;[
    '生产单列表',
    '进行中生产单',
    '临期生产单',
    '延误生产单',
    '今日新增',
    '待闭环异常',
    '本周交付数量',
    '生产单号',
    '生产需求单',
    '款式/SPU',
    '风险等级',
    '交付仓',
    '涉及工厂',
    '实际进度',
    '配料进度',
    '裁床进度',
    '车缝进度',
    '质检/交出进度',
    '生产单详情',
    '关键时间',
    '异常与提醒',
    '关联',
    'SO-PRD-202606-0018',
    'data-production-order-progress-action="toggle-row"',
    'data-production-order-progress-action="open-modal"',
    'data-skip-page-rerender="true"',
  ].forEach((text) => assertIncludes(listHtml, text, '列表页'))
  ;[
    '新建生产单',
    '导出生产单列表',
    '表格设置',
    '批量操作',
    '导出当前页',
  ].forEach((text) => assert(!listHtml.includes(text), `列表页不应再展示红框操作入口「${text}」`))

  const overviewHtml = await renderAt('/fcs/progress/production-orders/detail?po=SO-PRD-202606-0018&tab=overview')
  ;[
    '生产单全生命周期跟踪',
    '交付倒计时',
    '多泳道生命周期矩阵',
    '当前卡点详情',
    '关键对象实时账',
    '主线',
    '印花链路',
    '染色链路',
    '物料链路',
    '裁床链路',
    '车缝链路',
    '后道链路',
    'data-production-order-progress-tabs',
    'data-production-order-progress-tab-body',
    'data-production-order-progress-action="switch-tab"',
    'data-production-order-progress-action="select-node"',
    'data-skip-page-rerender="true"',
  ].forEach((text) => assertIncludes(overviewHtml, text, '概览页'))

  const timelineHtml = await renderAt('/fcs/progress/production-orders/detail?po=SO-PRD-202606-0018&tab=timeline')
  ;[
    '时间追踪',
    '生产全生命周期时间轴（计划 vs 实际）',
    '时间节点详情',
    '关键里程碑与节点里程账本',
    '计划开始',
    '当前时间位置',
    '计划交付',
    '预计延期 / 提前',
    'data-tab="timeline"',
  ].forEach((text) => assertIncludes(timelineHtml, text, '时间追踪页'))

  const quantityHtml = await renderAt('/fcs/progress/production-orders/detail?po=SO-PRD-202606-0018&tab=quantity')
  ;[
    '数量流转',
    '数量流转全景图',
    '数量差异详情',
    '数量台账明细',
    '订单总量',
    '已配料',
    '已领料',
    '已裁数量',
    '后道复检通过',
    'data-tab="quantity"',
  ].forEach((text) => assertIncludes(quantityHtml, text, '数量流转页'))

  const workordersHtml = await renderAt('/fcs/progress/production-orders/detail?po=SO-PRD-202606-0018&tab=workorders')
  ;[
    '工单与分支',
    '分支拓扑视图',
    '分支详情',
    '工单对象列表',
    '印花需求',
    '染色需求',
    '印染配料',
    '裁片单',
    '特殊工艺',
    '后道复检交出',
    'data-tab="workorders"',
  ].forEach((text) => assertIncludes(workordersHtml, text, '工单与分支页'))

  const handoverHtml = await renderAt('/fcs/progress/production-orders/detail?po=SO-PRD-202606-0018&tab=handover')
  ;[
    '交接与质检',
    '交接事件时间线',
    '交接 / 质检详情',
    '交接与质检记录明细',
    '裁床 -&gt; 车缝',
    '车缝 -&gt; 后道',
    '复检交出 -&gt; 仓库',
    '差异异议',
    'data-tab="handover"',
  ].forEach((text) => assertIncludes(handoverHtml, text, '交接与质检页'))

  const settlementHtml = await renderAt('/fcs/progress/production-orders/detail?po=SO-PRD-202606-0018&tab=settlement')
  ;[
    '结算与复盘',
    '预计结算金额',
    '完成节点统计',
    '成本构成',
    '质量扣款流程',
    '异议处理进度',
    '交期表现',
    '主要异常原因排行',
    '复盘结论',
    '结算记录',
  ].forEach((text) => assertIncludes(settlementHtml, text, '结算与复盘页'))

  assert(typeof handleProductionOrderProgressEvent === 'function', '缺少生产单进度跟踪局部事件处理器')
  assert(!overviewHtml.includes('data-nav="/fcs/progress/production-orders/detail?po=SO-PRD-202606-0018&tab=timeline"'), '详情页 Tab 不应使用路由跳转做轻交互')
  ;[
    '导出全生命周期跟踪',
    '更多操作',
    '已刷新当前生产单进度跟踪数据',
  ].forEach((text) => assert(!overviewHtml.includes(text), `详情页不应再展示红框操作入口「${text}」`))
  assertIncludes(overviewHtml, '查看详情', '详情页业务弹窗入口')

  console.log([
    '生产单进度跟踪验收通过',
    '菜单：任务进度与异常 / 生产单进度跟踪',
    '路由：列表与详情均已注册',
    '列表页：KPI、筛选、表格、展开行、详情入口均已渲染',
    '详情页：概览、时间追踪、数量流转、工单与分支、交接与质检、结算与复盘均已渲染',
    '交互：Tab、图节点、弹窗、展开行均已接入局部事件并标记跳过整页重绘',
  ].join('\n'))
}

void main()
