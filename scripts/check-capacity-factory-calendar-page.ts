import fs from 'node:fs'
import path from 'node:path'

const ROOT = '/Users/laoer/Documents/higoods'
const CAPACITY_PAGE_PATH = path.join(ROOT, 'src/pages/capacity.ts')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function main(): void {
  const source = fs.readFileSync(CAPACITY_PAGE_PATH, 'utf8')
  const detailPanelMatch = source.match(/function renderFactoryCalendarDetailPanel[\s\S]*?function getOverviewStats/)
  const sourceTableMatch = source.match(/function renderFactoryCalendarSourceTable[\s\S]*?function renderFactoryCalendarDetailPanel/)

  assert(detailPanelMatch, '未找到工厂日历详情区渲染函数')
  assert(sourceTableMatch, '未找到工厂日历来源表渲染函数')

  const detailPanelSource = detailPanelMatch[0]
  const sourceTableSource = sourceTableMatch[0]

  assert(!source.includes('type ConstraintsTab ='), '仍残留 ConstraintsTab 类型定义')
  assert(!source.includes('constraintsTab:'), '仍残留 constraintsTab 状态或赋值')
  assert(!source.includes('constraintsKeyword:'), '仍残留 constraintsKeyword 状态或赋值')
  assert(!source.includes('data-capacity-filter="constraints-keyword"'), '仍残留 constraints-keyword 无效筛选器')

  assert(source.includes('data-testid="capacity-constraints-page"'), '缺少工厂日历页面测试锚点')
  assert(source.includes('data-testid="capacity-constraints-header"'), '缺少工厂日历标题区测试锚点')
  assert(source.includes('data-testid="capacity-constraints-hint"'), '缺少工厂日历说明区测试锚点')
  assert(source.includes('data-testid="capacity-constraints-kpis"'), '缺少工厂日历 KPI 区测试锚点')
  assert(source.includes('data-testid="capacity-constraints-filters"'), '缺少工厂日历筛选区测试锚点')
  assert(source.includes('data-testid="capacity-constraints-main"'), '缺少工厂日历主区测试锚点')
  assert(source.includes('data-testid="factory-calendar-detail-panel"'), '缺少工厂日历详情区测试锚点')

  assert(
    source.includes('当前页展示选定工厂在窗口内各工序 / 工艺的标准工时供需事实，待分配需求不扣到工厂。'),
    '工厂日历说明文案未收短成当前业务页提示',
  )
  assert(
    !source.includes('当前页只看选定工厂在未来窗口内的标准工时事实表：供给来自产能档案自动计算结果，已占用来自占用工时对象，已冻结来自冻结工时对象；待分配需求不会混入工厂负载。'),
    '工厂日历仍残留旧的长说明文案',
  )

  assert(source.includes('data-testid="factory-calendar-table-section"'), '主表区域未单独收平')
  assert(source.includes('data-testid="factory-calendar-detail-summary"'), '详情摘要区缺少测试锚点')
  assert(source.includes('data-testid="factory-calendar-committed-section"'), '详情已占用来源区缺少测试锚点')
  assert(source.includes('data-testid="factory-calendar-frozen-section"'), '详情已冻结来源区缺少测试锚点')
  assert(source.includes('data-testid="factory-calendar-source-table"'), '来源表缺少测试锚点')

  assert(!detailPanelSource.includes('rounded-md border bg-card p-4'), '详情区仍残留旧的重卡片样式')
  assert(!sourceTableSource.includes('rounded-md border border-dashed'), '来源空态仍残留旧的虚线重边框样式')
  assert(detailPanelSource.includes('xl:border-l xl:border-t-0 xl:pl-6'), '详情区未收成附属说明面板样式')

  console.log('工厂日历页面收平检查通过：长说明已收短、层级已减重、无效状态已清理。')
}

main()
