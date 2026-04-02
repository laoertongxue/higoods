import fs from 'node:fs'
import path from 'node:path'

import { menusBySystem } from '../src/data/app-shell-config.ts'

const ROOT = '/Users/laoer/Documents/higoods'
const CAPACITY_PAGE_PATH = path.join(ROOT, 'src/pages/capacity.ts')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function main(): void {
  const capacityMenus = menusBySystem.fcs
    .flatMap((group) => group.items)
    .find((item) => item.key === 'fcs-platform-capacity')

  assert(capacityMenus && capacityMenus.children, '未找到产能日历菜单组')

  const titles = capacityMenus.children.map((item) => item.title)
  assert(
    JSON.stringify(titles) === JSON.stringify(['供需总览', '工厂日历', '任务工时风险', '工艺瓶颈与待分配', '暂停例外']),
    `产能日历菜单名称或顺序不正确：${titles.join(' / ')}`,
  )

  const capacitySource = fs.readFileSync(CAPACITY_PAGE_PATH, 'utf8')

  assert(capacitySource.includes('type OverviewTab = \'comparison\' | \'unallocated\' | \'unscheduled\''), 'overviewTab 未收口成 3 个 Tab')
  assert(capacitySource.includes('renderTabButton(\'overview\', \'comparison\''), '缺少“工厂供需明细”Tab')
  assert(capacitySource.includes('renderTabButton(\'overview\', \'unallocated\''), '缺少“待分配需求”Tab')
  assert(capacitySource.includes('renderTabButton(\'overview\', \'unscheduled\''), '缺少“未排期需求”Tab')
  assert(capacitySource.includes('data-capacity-overview-panel="comparison"'), '缺少工厂供需明细面板')
  assert(capacitySource.includes('data-capacity-overview-panel="unallocated"'), '缺少待分配需求面板')
  assert(capacitySource.includes('data-capacity-overview-panel="unscheduled"'), '缺少未排期需求面板')
  assert(!capacitySource.includes('规则与例外'), 'capacity 页面源码里仍残留“规则与例外”标题')
  assert(capacitySource.includes('<h1 class="text-2xl font-semibold text-foreground">暂停例外</h1>'), '暂停例外页面标题未更新')
  assert(capacitySource.includes('data-testid="capacity-policies-tips-section"'), '缺少暂停例外顶部轻量规则提示')
  assert(capacitySource.includes('data-testid="capacity-policies-overrides-section"'), '缺少暂停例外主表区')
  assert(!capacitySource.includes('data-testid="capacity-policies-rules-section"'), '仍残留规则大文档区')
  assert(!capacitySource.includes('data-testid="capacity-policies-thresholds-section"'), '仍残留阈值说明大区块')
  assert(capacitySource.includes('当前阶段人工动态例外只支持整厂、工序、工艺三级暂停。'), '顶部轻量规则提示未明确当前阶段只支持暂停')

  console.log('产能日历信息架构检查通过：菜单、overview Tabs、暂停例外页面收口均已生效。')
}

main()
