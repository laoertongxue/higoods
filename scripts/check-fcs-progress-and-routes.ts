import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)

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
const handoverSource =
  read('src/pages/progress-handover.ts') +
  read('src/pages/progress-handover-order.ts')
const materialSource = read('src/pages/progress-material.ts')
const printingStatsSource = read('src/pages/process-factory/printing/statistics.ts')
const printingDashboardsSource = read('src/pages/process-factory/printing/dashboards.ts')
const dyeingReportsSource = read('src/pages/process-factory/dyeing/reports.ts')
const cuttingProgressSource = read('src/pages/process-factory/cutting/production-progress.ts')
const cuttingSummarySource = read('src/pages/process-factory/cutting/cutting-summary.ts')
const capacitySource =
  read('src/pages/capacity.ts') +
  read('src/pages/factory-capacity-profile.ts') +
  read('src/data/fcs/capacity-calendar.ts')
const routeSources =
  read('src/data/app-shell-config.ts') +
  read('src/router/routes.ts') +
  read('src/router/routes-fcs.ts') +
  read('src/router/routes-pcs.ts') +
  read('src/router/routes-pda.ts') +
  read('src/router/route-renderers.ts') +
  read('src/router/route-renderers-fcs.ts')
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
    '/fcs/progress/material',
    '/fcs/craft/printing/statistics',
    '/fcs/craft/printing/dashboards',
    '/fcs/craft/dyeing/reports',
    '/fcs/craft/cutting/production-progress',
    '/fcs/craft/cutting/material-prep',
    '/fcs/craft/cutting/summary',
    '/fcs/quality/qc-records',
    '/fcs/production/orders',
    '/confirmation-print',
    '/fcs/pda/exec',
    '/fcs/pda/handover',
  ],
  '路由注册',
)
assertIncludes(routeSources, 'pattern: /^\\/fcs\\/production\\/orders\\/([^/]+)\\/confirmation-print$/', '缺少生产确认单打印预览动态路由')
assertIncludes(routeSources, 'pattern: /^\\/fcs\\/production\\/orders\\/([^/]+)$/', '缺少生产单详情动态路由')
assertIncludes(routeSources, 'pattern: /^\\/fcs\\/quality\\/qc-records\\/([^/]+)$/', '缺少质检详情动态路由')
assertIncludes(routeSources, 'pattern: /^\\/fcs\\/progress\\/handover\\/order\\/([^/]+)$/', '缺少交接详情动态路由')
assertIncludes(routeSources, 'pattern: /^\\/fcs\\/pda\\/exec\\/([^/]+)$/', '缺少任务详情动态路由')
assertIncludes(routeSources, 'pattern: /^\\/fcs\\/pda\\/handover\\/([^/]+)$/', '缺少交出单详情动态路由')

;[
  '去交接（待交出）',
  '交出头',
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
