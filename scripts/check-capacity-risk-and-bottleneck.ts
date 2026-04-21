import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildCapacityBottleneckData,
  buildFactoryCalendarData,
  buildCapacityRiskData,
} from '../src/data/fcs/capacity-calendar.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CAPACITY_PAGE_PATH = path.join(ROOT, 'src/pages/capacity.ts')
const CAPACITY_DATA_PATH = path.join(ROOT, 'src/data/fcs/capacity-calendar.ts')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function main(): void {
  const pageSource = fs.readFileSync(CAPACITY_PAGE_PATH, 'utf8')
  const dataSource = fs.readFileSync(CAPACITY_DATA_PATH, 'utf8')
  const bottleneckData = buildCapacityBottleneckData()
  const riskData = buildCapacityRiskData()
  const washCalendar = buildFactoryCalendarData({ factoryId: 'ID-F008' })

  const riskSectionMatch = pageSource.match(/export function renderCapacityRiskPage\(\): string \{[\s\S]*?function filterBottleneckCraftRows/)
  const bottleneckSectionMatch = pageSource.match(/export function renderCapacityBottleneckPage\(\): string \{[\s\S]*?export function renderCapacityConstraintsPage/)

  assert(riskSectionMatch, '未找到任务工时风险页面渲染函数')
  assert(bottleneckSectionMatch, '未找到工艺瓶颈与待分配页面渲染函数')

  const riskSection = riskSectionMatch[0]
  const bottleneckSection = bottleneckSectionMatch[0]

  assert(dataSource.includes("export function resolveTaskWindow"), '缺少 resolveTaskWindow helper')
  assert(dataSource.includes("export function resolveTaskBindingState"), '缺少 resolveTaskBindingState helper')
  assert(dataSource.includes("export function resolveTaskRisk"), '缺少 resolveTaskRisk helper')
  assert(dataSource.includes("export function resolveProductionOrderRisk"), '缺少 resolveProductionOrderRisk helper')
  assert(dataSource.includes("function aggregateCraftBottlenecks("), '缺少 aggregateCraftBottlenecks helper')
  assert(dataSource.includes("function aggregateDateBottlenecks("), '缺少 aggregateDateBottlenecks helper')
  assert(dataSource.includes("function aggregateUnallocatedDemand("), '缺少 aggregateUnallocatedDemand helper')
  assert(dataSource.includes("function aggregateUnscheduledDemand("), '缺少 aggregateUnscheduledDemand helper')

  assert(dataSource.includes("FROZEN_PENDING"), '任务风险未引入“已冻结待确认”结论')
  assert(dataSource.includes("frozenPendingStandardTime"), '生产单风险未聚合已冻结待确认标准工时')
  assert(dataSource.includes("assignmentStatusLabel: unallocatedStageLabel"), '待分配需求未统一使用当前分配阶段口径')
  assert(
    dataSource.includes("已在 ${frozenFactoryCount} 家工厂形成冻结，能力已预留，但业务仍未最终落厂。"),
    '待分配需求未保留“已冻结但仍在待分配池”文案',
  )

  assert(riskSection.includes('已冻结待确认任务数'), '任务风险页缺少“已冻结待确认”KPI')
  assert(riskSection.includes('当前工厂 / 当前承接对象'), '任务风险页未改成承接对象列')
  assert(riskSection.includes('已冻结待确认标准工时'), '生产单风险页缺少冻结待确认列')
  assert(riskSection.includes('data-capacity-risk-task-table'), '任务风险表缺少测试锚点')
  assert(riskSection.includes('data-capacity-risk-order-table'), '生产单风险表缺少测试锚点')
  assert(!riskSection.includes('染印'), '任务风险页仍残留染印统计')
  assert(!riskSection.includes('质检'), '任务风险页仍残留质检统计')
  assert(!riskSection.includes('异常数'), '任务风险页仍残留旧异常统计')

  assert(bottleneckSection.includes('工艺瓶颈榜'), '工艺瓶颈页缺少工艺瓶颈榜 Tab')
  assert(bottleneckSection.includes('日期瓶颈榜'), '工艺瓶颈页缺少日期瓶颈榜 Tab')
  assert(bottleneckSection.includes('待分配 / 未排期'), '工艺瓶颈页缺少待分配 / 未排期 Tab')
  assert(pageSource.includes('已冻结工厂数'), '待分配需求表缺少已冻结工厂数列')
  assert(pageSource.includes('windowFrozenSam'), '工艺瓶颈页未展示已冻结标准工时主线')
  assert(pageSource.includes('unallocatedSam'), '工艺瓶颈页未展示待分配标准工时主线')
  assert(pageSource.includes('unscheduledSam'), '工艺瓶颈页未展示未排期标准工时主线')
  assert(
    bottleneckData.craftRows.some((row) => row.processCode === 'POST_FINISHING' && row.craftCode === 'BUTTONHOLE'),
    '工艺瓶颈数据缺少“后道 / 开扣眼”节点',
  )
  assert(
    !bottleneckData.craftRows.some((row) => ['BUTTONHOLE', 'BUTTON_ATTACH', 'IRONING', 'PACKAGING'].includes(row.processCode)),
    '工艺瓶颈数据仍把后道节点当成独立任务工序',
  )
  assert(
    washCalendar.rows.some((row) => row.processCode === 'SPECIAL_CRAFT' && row.craftName === '洗水'),
    '产能日历未按“特殊工艺 - 洗水”纳入能力计算',
  )
  assert(!bottleneckSection.includes('染印'), '工艺瓶颈页仍残留染印统计')
  assert(!bottleneckSection.includes('质检'), '工艺瓶颈页仍残留质检统计')
  assert(!bottleneckSection.includes('异常数'), '工艺瓶颈页仍残留旧异常统计')

  assert(!dataSource.includes('复盘工时'), '不应引入复盘工时字段或说明')
  assert(!dataSource.includes('replaySam'), '不应引入复盘工时 SAM 逻辑')

  console.log('任务工时风险与工艺瓶颈源码检查通过：helper、字段、列定义与页面主线均已收口。')
}

main()
