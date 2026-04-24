import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  createProcessHandoverRecord,
  createWaitHandoverWarehouseRecord,
  createWaitProcessWarehouseRecord,
  listProcessHandoverRecords,
  listProcessWarehouseReviewRecords,
  listWaitHandoverWarehouseRecords,
  listWaitProcessWarehouseRecords,
  writeBackProcessHandoverRecord,
} from '../src/data/fcs/process-warehouse-domain.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`待加工仓 / 待交出仓统一模型检查失败：${message}`)
  }
}

function includes(path: string, needles: string[]): void {
  const source = read(path)
  for (const needle of needles) {
    assert(source.includes(needle), `${path} 缺少 ${needle}`)
  }
}

function assertNoForbidden(source: string, forbidden: string[], scope: string): void {
  for (const word of forbidden) {
    assert(!source.includes(word), `${scope} 不应出现 ${word}`)
  }
}

const domainPath = 'src/data/fcs/process-warehouse-domain.ts'
assert(existsSync(join(root, domainPath)), '缺少统一仓模型文件')
includes(domainPath, [
  'export interface ProcessWarehouseRecord',
  'export interface ProcessHandoverRecord',
  'export interface ProcessWarehouseReviewRecord',
  'listProcessWarehouseRecords',
  'listWaitProcessWarehouseRecords',
  'listWaitHandoverWarehouseRecords',
  'listProcessHandoverRecords',
  'listProcessWarehouseReviewRecords',
  'getProcessWarehouseRecordById',
  'getProcessHandoverRecordById',
  'getWarehouseRecordsByWorkOrderId',
  'getHandoverRecordsByWorkOrderId',
  'getReviewRecordsByWorkOrderId',
  'createWaitProcessWarehouseRecord',
  'createWaitHandoverWarehouseRecord',
  'createProcessHandoverRecord',
  'writeBackProcessHandoverRecord',
  'createProcessWarehouseReviewRecord',
])

includes('src/data/fcs/printing-warehouse-view.ts', ['listWaitProcessWarehouseRecords', "craftType: 'PRINT'", 'listWaitHandoverWarehouseRecords'])
includes('src/data/fcs/dyeing-warehouse-view.ts', ['listWaitProcessWarehouseRecords', "craftType: 'DYE'", 'listWaitHandoverWarehouseRecords'])
includes('src/pages/process-factory/special-craft/warehouse.ts', ['listWaitProcessWarehouseRecords', "craftType: 'SPECIAL_CRAFT'", 'listProcessHandoverRecords'])
includes('src/pages/process-factory/post-finishing/warehouse.ts', ['listWaitProcessWarehouseRecords', "craftType: 'POST_FINISHING'", 'listWaitHandoverWarehouseRecords'])

includes('src/pages/process-factory/printing/work-order-detail.ts', ['getHandoverRecordsByWorkOrderId', 'getReviewRecordsByWorkOrderId', '交出面料米数'])
includes('src/pages/process-factory/dyeing/work-order-detail.ts', ['getHandoverRecordsByWorkOrderId', 'getReviewRecordsByWorkOrderId', '染色统计'])
includes('src/pages/process-factory/special-craft/work-order-detail.ts', ['getWarehouseRecordsByWorkOrderId', 'getHandoverRecordsByWorkOrderId', '统一仓记录'])

includes('src/data/fcs/process-execution-writeback.ts', [
  'createWaitProcessWarehouseRecord',
  'createWaitHandoverWarehouseRecord',
  'createProcessHandoverRecord',
  'writeBackProcessHandoverRecord',
])

includes('src/data/fcs/process-statistics-domain.ts', ['listWaitProcessWarehouseRecords', 'listWaitHandoverWarehouseRecords'])
includes('src/pages/process-factory/printing/statistics.ts', ['getPrintingExecutionStatistics', '待加工面料米数', '待交出面料米数'])
includes('src/pages/process-factory/dyeing/reports.ts', ['getDyeingExecutionStatistics', '染色统计', '待交出面料米数'])
includes('src/pages/process-factory/special-craft/statistics.ts', ['getSpecialCraftExecutionStatistics', '待加工裁片数量', '关联菲票数量'])
includes('src/pages/process-factory/post-finishing/statistics.ts', ['getPostFinishingExecutionStatistics', '待质检成衣件数', '差异成衣件数'])

const requiredCrafts = [
  ['PRINT', '印花'],
  ['DYE', '染色'],
  ['SPECIAL_CRAFT', '特殊工艺'],
  ['POST_FINISHING', '后道'],
] as const

for (const [craftType, label] of requiredCrafts) {
  assert(listWaitProcessWarehouseRecords({ craftType }).length >= 3, `${label} 待加工仓记录少于 3 条`)
  assert(listWaitHandoverWarehouseRecords({ craftType }).length >= 3, `${label} 待交出仓记录少于 3 条`)
  assert(listProcessHandoverRecords({ craftType }).length >= 3, `${label} 交出记录少于 3 条`)
  assert(listProcessWarehouseReviewRecords({ craftType }).length >= 3, `${label} 审核或差异记录少于 3 条`)
}

const postWaitProcess = listWaitProcessWarehouseRecords({ craftType: 'POST_FINISHING' })
const postWaitHandover = listWaitHandoverWarehouseRecords({ craftType: 'POST_FINISHING' })
assert(postWaitProcess.some((record) => record.currentActionName === '待后道'), '后道待加工仓缺少待后道记录')
assert(postWaitProcess.some((record) => record.currentActionName === '待质检'), '后道待加工仓缺少待质检记录')
assert(postWaitProcess.some((record) => record.currentActionName === '待复检'), '后道待加工仓缺少待复检记录')
assert(postWaitHandover.every((record) => record.currentActionName === '后道待交出'), '后道交出仓必须只承接复检完成后的记录')

assert(typeof createWaitProcessWarehouseRecord === 'function', 'createWaitProcessWarehouseRecord 不是函数')
assert(typeof createWaitHandoverWarehouseRecord === 'function', 'createWaitHandoverWarehouseRecord 不是函数')
assert(typeof createProcessHandoverRecord === 'function', 'createProcessHandoverRecord 不是函数')
assert(typeof writeBackProcessHandoverRecord === 'function', 'writeBackProcessHandoverRecord 不是函数')

const postWarehouseSource = read('src/pages/process-factory/post-finishing/warehouse.ts')
const postDomainSource = read('src/data/fcs/post-finishing-domain.ts')
const unifiedDomainSource = read(domainPath)
assertNoForbidden(`${postWarehouseSource}\n${postDomainSource}\n${unifiedDomainSource}`, ['开扣眼', '装扣子', '熨烫'], '后道仓记录和后道任务动作')
assert(!postWarehouseSource.includes('包装'), '后道仓页面不应把包装作为后道动作')

const dyeVisibleSource = [
  'src/pages/process-factory/dyeing/work-orders.ts',
  'src/pages/process-factory/dyeing/work-order-detail.ts',
  'src/pages/process-factory/dyeing/reports.ts',
  'src/data/app-shell-config.ts',
  'src/router/routes-fcs.ts',
].map(read).join('\n')
assert(!dyeVisibleSource.includes('染色报表'), '用户可见文案不得出现染色报表')

const modifiedPages = [
  'src/pages/process-factory/printing/warehouse.ts',
  'src/pages/process-factory/dyeing/warehouse.ts',
  'src/pages/process-factory/special-craft/warehouse.ts',
  'src/pages/process-factory/post-finishing/warehouse.ts',
  'src/pages/process-factory/printing/work-order-detail.ts',
  'src/pages/process-factory/dyeing/work-order-detail.ts',
].map(read).join('\n')
assert(!/>\s*数量：/.test(modifiedPages), '页面不得只显示“数量：”，必须带对象和单位')

assert(existsSync(join(root, 'docs/fcs-process-warehouse-unification.md')), '缺少统一仓流程文档')

console.log('待加工仓 / 待交出仓统一模型检查通过')
