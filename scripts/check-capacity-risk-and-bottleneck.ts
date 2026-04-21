import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildCapacityBottleneckData,
  buildCapacityRiskData,
  buildFactoryCalendarData,
} from '../src/data/fcs/capacity-calendar.ts'
import { createFreezeFromDirectDispatch } from '../src/data/fcs/capacity-usage-ledger.ts'
import {
  getActiveCraftOptionsByProcess,
  getActiveProcessOptions,
  getCapacityProcessCraftOptions,
  resolveProcessCraft,
} from '../src/data/fcs/process-craft-dict.ts'

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
  const capacityOptions = getCapacityProcessCraftOptions()
  const capacityOptionKeys = new Set(capacityOptions.map((item) => `${item.processCode}::${item.craftCode}`))
  const riskProcessMap = new Map(getActiveProcessOptions().map((item) => [item.processCode, item.processName] as const))
  const riskCraftMap = new Map(
    getActiveCraftOptionsByProcess().map((item) => [item.processCraftKey, item.processCraftLabel] as const),
  )

  assert(dataSource.includes('getActiveProcessOptions()'), '任务工时风险筛选未从工序工艺字典读取')
  assert(dataSource.includes('getActiveCraftOptionsByProcess()'), '任务工时风险工艺筛选未从工序工艺字典读取')
  assert(dataSource.includes('assertProcessCraftExists('), '任务工时风险数据未按工序工艺字典校验')
  assert(dataSource.includes('resolveDemandIdentityFromSourceEntry('), '任务工时风险未补齐 sourceEntryId 的技术包回捞')
  assert(dataSource.includes('getProductionOrderProcessEntries(task.productionOrderId)'), '任务工时风险未从技术包工序定义兜底解析旧任务')
  assert(dataSource.includes('getCapacityProcessCraftOptions()'), '工艺瓶颈筛选未从工序工艺字典读取')
  assert(!dataSource.includes('特殊工艺 / 印花工艺'), '产能风险数据层仍硬编码印花专属筛选')
  assert(!dataSource.includes('特殊工艺 / 染色工艺'), '产能风险数据层仍硬编码染色专属筛选')

  assert(getActiveCraftOptionsByProcess().length > 0, '任务工时风险缺少工序工艺字典选项')
  assert(capacityOptions.length > 0, '工艺瓶颈缺少工序工艺字典选项')
  assert(
    riskData.processOptions.every((option) => riskProcessMap.get(option.value) === option.label),
    '任务工时风险工序筛选未完全来自工序工艺字典',
  )
  assert(
    riskData.craftOptions.every((option) => riskCraftMap.get(option.value) === option.label),
    '任务工时风险工艺筛选未完全来自工序工艺字典',
  )
  assert(
    bottleneckData.processOptions.every((option) => riskProcessMap.get(option.value) === option.label),
    '工艺瓶颈工序筛选未完全来自工序工艺字典',
  )
  assert(
    bottleneckData.craftOptions.every((option) => capacityOptionKeys.has(option.value)),
    '工艺瓶颈工艺筛选未完全来自工序工艺字典',
  )

  ;[
    '任务编号',
    '生产单号',
    '工序',
    '工艺',
    '当前工厂 / 当前承接对象',
    '任务总标准工时',
    '窗口供给标准工时',
    '其他已占用标准工时',
    '其他已冻结标准工时',
    '当前任务计入后剩余标准工时',
    '风险结论',
    '风险原因',
  ].forEach((token) => {
    assert(riskSection.includes(token), `任务工时风险页面缺少字段：${token}`)
  })

  ;[
    '打印机编号',
    '打印速度',
    '完成量',
    '待送货量',
    '待审核量',
    '染缸编号',
    '染缸容量',
    '节点等待',
    '排染缸',
  ].forEach((token) => {
    assert(!riskSection.includes(token), `任务工时风险页面不应展示专属细维度：${token}`)
  })

  assert(riskSection.includes('已冻结待确认任务数'), '任务工时风险页缺少“已冻结待确认”KPI')
  assert(riskSection.includes('data-capacity-risk-task-table'), '任务工时风险表缺少测试锚点')
  assert(riskSection.includes('data-capacity-risk-order-table'), '生产单风险表缺少测试锚点')
  assert(!riskSection.includes('染印'), '任务工时风险页仍残留染印统计')
  assert(!riskSection.includes('质检'), '任务工时风险页仍残留质检统计')
  assert(!riskSection.includes('裁片 - 定位裁'), '任务工时风险页仍残留固定样例')

  assert(bottleneckSection.includes('工艺瓶颈榜'), '工艺瓶颈页缺少工艺瓶颈榜 Tab')
  assert(bottleneckSection.includes('日期瓶颈榜'), '工艺瓶颈页缺少日期瓶颈榜 Tab')
  assert(bottleneckSection.includes('待分配 / 未排期'), '工艺瓶颈页缺少待分配 / 未排期 Tab')
  assert(pageSource.includes('查看明细'), '工艺瓶颈页缺少查看明细动作')
  assert(bottleneckSection.includes("selectedCraftRow ? renderBottleneckCraftDetailPanel(selectedCraftRow) : ''"), '工艺瓶颈页未改为按点击显示明细')
  assert(bottleneckSection.includes("selectedDateRow ? renderBottleneckDateDetailPanel(selectedDateRow) : ''"), '日期瓶颈页未改为按点击显示明细')
  assert(!bottleneckSection.includes('裁片 - 定位裁'), '工艺瓶颈页仍固定展示“裁片 - 定位裁”卡片')
  assert(!/selectedCraftRow\s*=\s*.*\[\s*0\s*\]/.test(pageSource), '工艺瓶颈仍默认选中第一条数据')
  assert(!/selectedDateRow\s*=\s*.*\[\s*0\s*\]/.test(pageSource), '日期瓶颈仍默认选中第一条数据')
  assert(!bottleneckSection.includes('detailCard'), '工艺瓶颈页仍保留固定右侧详情卡片结构')

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

  assert(
    riskData.taskRows.every((row) => {
      const resolved = resolveProcessCraft(row.processCode, row.craftCode)
      return resolved
        && resolved.processName === row.processName
        && resolved.craftName === row.craftName
    }),
    '任务工时风险列表中的工序 / 工艺未完全来自工序工艺字典',
  )
  assert(
    !riskData.taskRows.some((row) => row.processCode === 'POST_FINISHING' && row.craftCode === 'POST_FINISHING'),
    '任务工时风险中仍存在“后道 / 后道”自造组合',
  )
  assert(
    !riskData.taskRows.some((row) =>
      row.processCode === 'WASHING'
      || row.processCode === 'HARDWARE'
      || row.processCode === 'FROG_BUTTON'
      || row.craftName === '鸡眼扣'
      || row.craftName === '手工盘扣'
    ),
    '任务工时风险中仍存在 WASHING / 五金 / 盘扣历史口径',
  )

  const legacyFreeze = createFreezeFromDirectDispatch(
    {
      taskId: 'LEGACY-PROC-SEW-COMPAT',
      processCode: 'PROC_SEW',
      processNameZh: '车缝',
      publishedSamTotal: 180,
      startDueAt: '2026-04-12 09:00:00',
      taskDeadline: '2026-04-12 18:00:00',
    },
    {
      factoryId: 'ID-F011',
      note: '兼容旧系统工序码 PROC_SEW 的回归校验样例。',
    },
  )
  assert(legacyFreeze?.processCode === 'SEW', '旧系统工序码 PROC_SEW 未归一到 SEW')
  assert(legacyFreeze?.craftCode === 'CRAFT_262145', '旧系统工序码 PROC_SEW 未回退到“基础连接”基线工艺')

  const legacyCutFreeze = createFreezeFromDirectDispatch(
    {
      taskId: 'LEGACY-PROC-CUT-COMPAT',
      processCode: 'PROC_CUT',
      processNameZh: '裁片',
      publishedSamTotal: 120,
      startDueAt: '2026-04-12 09:00:00',
      taskDeadline: '2026-04-12 18:00:00',
    },
    {
      factoryId: 'ID-F011',
      note: '兼容旧系统工序码 PROC_CUT 的回归校验样例。',
    },
  )
  assert(legacyCutFreeze?.processCode === 'CUT_PANEL', '旧系统工序码 PROC_CUT 未归一到 CUT_PANEL')
  assert(legacyCutFreeze?.craftCode === 'CRAFT_000001', '旧系统工序码 PROC_CUT 未回退到“定位裁”基线工艺')

  buildFactoryCalendarData({ factoryId: 'ID-F011' })
  buildCapacityRiskData()

  console.log('任务工时风险与工艺瓶颈检查通过：筛选来自工序工艺字典，风险页无印花/染色专属细维度，固定右侧卡片已移除。')
}

main()
