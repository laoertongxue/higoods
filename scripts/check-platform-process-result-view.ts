import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  getPlatformFollowUpTasks,
  getPlatformProcessResultView,
  getPlatformRiskSummary,
  listPlatformDyeResultViews,
  listPlatformPrintResultViews,
  listPlatformProcessResultViews,
  type PlatformProcessResultView,
} from '../src/data/fcs/platform-process-result-view.ts'
import {
  listPlatformStatusOptions,
  mapCraftStatusToPlatformStatus,
  type PlatformProcessStatus,
} from '../src/data/fcs/process-platform-status-adapter.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`平台侧同步看结果检查失败：${message}`)
}

function assertIncludes(path: string, expected: string, message: string): void {
  const content = read(path)
  assert(content.includes(expected), `${message}：${path} 缺少 ${expected}`)
}

function assertNotIncludes(path: string, forbidden: string, message: string): void {
  const content = read(path)
  assert(!content.includes(forbidden), `${message}：${path} 不应出现 ${forbidden}`)
}

function assertAllowedStatus(view: PlatformProcessResultView): void {
  assert(
    listPlatformStatusOptions().includes(view.platformStatusLabel as PlatformProcessStatus),
    `${view.workOrderNo} 平台主状态不在允许集合：${view.platformStatusLabel}`,
  )
}

function assertCommonViewFields(view: PlatformProcessResultView): void {
  assert(view.platformStatusLabel, `${view.workOrderNo} 缺少 platformStatusLabel`)
  assert(view.factoryInternalStatusLabel, `${view.workOrderNo} 缺少 factoryInternalStatusLabel`)
  assert(view.platformRiskLabel, `${view.workOrderNo} 缺少 platformRiskLabel`)
  assert(view.platformActionHint, `${view.workOrderNo} 缺少 platformActionHint`)
  assert(view.platformOwnerHint, `${view.workOrderNo} 缺少 platformOwnerHint`)
  assert(view.quantityDisplayFields.length >= 6, `${view.workOrderNo} 缺少对象化数量字段`)
  assert(view.quantityDisplayFields.every((item) => item.label && item.unit && !['数量', '完成数量', '交出数量', '实收数量', '差异数量'].includes(item.label)), `${view.workOrderNo} 存在泛化数量文案`)
  assert(view.followUpActionCode && view.followUpActionLabel, `${view.workOrderNo} 缺少跟单动作`)
  assertAllowedStatus(view)
}

function assertMappedStatus(processType: 'PRINT' | 'DYE', status: string, expected: PlatformProcessStatus): void {
  const mapped = mapCraftStatusToPlatformStatus({
    sourceType: 'CHECK_PLATFORM_PROCESS_RESULT_VIEW',
    sourceId: `${processType}-${status}`,
    processType,
    status,
  })
  assert(mapped.platformStatusLabel === expected, `${processType} ${status} 应映射为 ${expected}，实际为 ${mapped.platformStatusLabel}`)
}

const forbiddenVisibleTerms = [
  ['待', '送货'].join(''),
  ['待', '回写'].join(''),
  ['待', '审核'].join(''),
  ['接收方', '回写'].join(''),
  ['处理', '审核'].join(''),
  ['审核', '记录'].join(''),
  ['回写', '实收'].join(''),
  ['回写', '差异'].join(''),
  ['审核', '驳回'].join(''),
  ['回', '货'].join(''),
]

const modulePath = 'src/data/fcs/platform-process-result-view.ts'
assert(existsSync(join(root, modulePath)), '缺少 platform-process-result-view 模块')
assert(typeof getPlatformProcessResultView === 'function', '缺少 getPlatformProcessResultView')
assert(typeof listPlatformProcessResultViews === 'function', '缺少 listPlatformProcessResultViews')
assert(typeof listPlatformPrintResultViews === 'function', '缺少 listPlatformPrintResultViews')
assert(typeof listPlatformDyeResultViews === 'function', '缺少 listPlatformDyeResultViews')
assert(typeof getPlatformRiskSummary === 'function', '缺少 getPlatformRiskSummary')
assert(typeof getPlatformFollowUpTasks === 'function', '缺少 getPlatformFollowUpTasks')

assertMappedStatus('PRINT', 'WAIT_HANDOVER', '待交出')
assertMappedStatus('PRINT', 'HANDOVER_WAIT_RECEIVE', '交出待收货')
assertMappedStatus('PRINT', 'PARTIAL_HANDOVER', '部分交出')
assertMappedStatus('PRINT', 'FULL_HANDOVER', '全部交出')
assertMappedStatus('PRINT', 'HANDOVER_DIFFERENCE', '收货差异')
assertMappedStatus('DYE', 'WAIT_HANDOVER', '待交出')
assertMappedStatus('DYE', 'HANDOVER_WAIT_RECEIVE', '交出待收货')
assertMappedStatus('DYE', 'PARTIAL_HANDOVER', '部分交出')
assertMappedStatus('DYE', 'FULL_HANDOVER', '全部交出')
assertMappedStatus('DYE', 'HANDOVER_DIFFERENCE', '收货差异')

const printViews = listPlatformPrintResultViews()
const dyeViews = listPlatformDyeResultViews()
assert(printViews.length > 0, '印花平台结果视图为空')
assert(dyeViews.length > 0, '染色平台结果视图为空')
;[...printViews, ...dyeViews].forEach(assertCommonViewFields)

const printWaitReceiveView = getPlatformProcessResultView('PRINT', 'PWO-PRINT-006')
assert(printWaitReceiveView?.platformStatusLabel === '交出待收货', '印花交出后平台侧必须看到交出待收货')
assert(printWaitReceiveView.followUpActionLabel === '跟进接收方确认收货', '印花交出待收货必须给出跟进接收方确认收货动作')
assert(printWaitReceiveView.platformOwnerHint === '接收方 / 仓库', '印花交出待收货责任方必须指向接收方或仓库')

const dyeWaitHandoverView = getPlatformProcessResultView('DYE', 'DWO-007')
assert(dyeWaitHandoverView?.platformStatusLabel === '待交出', '染色包装完成后平台侧必须看到待交出')
assert(dyeWaitHandoverView.followUpActionLabel === '跟进工厂交出', '染色待交出必须给出跟进工厂交出动作')
assert(dyeWaitHandoverView.quantityDisplayFields.some((field) => field.label === '待交出面料米数'), '染色待交出必须显示待交出面料米数')

const dyeWaitReceiveView = getPlatformProcessResultView('DYE', 'DWO-008')
assert(dyeWaitReceiveView?.platformStatusLabel === '交出待收货', '染色交出后平台侧必须看到交出待收货')
assert(dyeWaitReceiveView.followUpActionLabel === '跟进接收方确认收货', '染色交出待收货必须给出跟进接收方确认收货动作')

const dyePartialView = getPlatformProcessResultView('DYE', 'DWO-009')
assert(dyePartialView?.platformStatusLabel === '部分交出', '染色部分收货后平台侧必须看到部分交出')
assert(dyePartialView.followUpActionLabel === '继续交出剩余数量', '部分交出必须给出继续交出剩余数量动作')

const dyeDifferenceView = getPlatformProcessResultView('DYE', 'DWO-010')
assert(dyeDifferenceView?.platformStatusLabel === '收货差异', '染色收货差异后平台侧必须看到收货差异')
assert(dyeDifferenceView.followUpActionLabel === '处理收货差异', '收货差异必须给出处理收货差异动作')

const dyeFullView = getPlatformProcessResultView('DYE', 'DWO-011')
assert(dyeFullView?.platformStatusLabel === '全部交出', '染色全部收货后平台侧必须看到全部交出')
assert(['查看交出记录', '查看详情'].includes(dyeFullView.followUpActionLabel), '全部交出必须只保留查看类动作')

const summary = getPlatformRiskSummary({ sourceType: 'DYE' })
assert(summary.waitHandoverCount >= 1, '风险摘要必须统计待交出')
assert(summary.waitReceiveCount >= 1, '风险摘要必须统计交出待收货')
assert(summary.partialHandoverCount >= 1, '风险摘要必须统计部分交出')
assert(summary.receiptDifferenceCount >= 1, '风险摘要必须统计收货差异')

const followUpLabels = getPlatformFollowUpTasks({ sourceType: 'DYE' }).map((view) => view.followUpActionLabel)
assert(followUpLabels.includes('跟进工厂交出'), '跟单任务必须包含跟进工厂交出')
assert(followUpLabels.includes('跟进接收方确认收货'), '跟单任务必须包含跟进接收方确认收货')
assert(followUpLabels.includes('继续交出剩余数量'), '跟单任务必须包含继续交出剩余数量')
assert(followUpLabels.includes('处理收货差异'), '跟单任务必须包含处理收货差异')

assertIncludes('src/data/fcs/page-adapters/process-prep-pages-adapter.ts', 'getPlatformProcessResultView', '平台侧印花/染色 adapter 必须读取统一结果视图')
assertIncludes('src/pages/process-print-orders.ts', 'renderPlatformSyncSection', '平台侧印花页面必须展示同步结果')
assertIncludes('src/pages/process-print-orders.ts', 'followUpActionLabel', '平台侧印花页面必须展示跟单动作')
assertIncludes('src/pages/process-dye-orders.ts', 'renderPlatformSyncSection', '平台侧染色页面必须展示同步结果')
assertIncludes('src/pages/process-dye-orders.ts', 'followUpActionLabel', '平台侧染色页面必须展示跟单动作')
assertIncludes('src/pages/progress-board/task-domain.ts', 'listPlatformProcessResultViews', '任务进度看板必须读取统一结果视图')

for (const path of [
  'src/data/fcs/platform-process-result-view.ts',
  'src/data/fcs/page-adapters/process-prep-pages-adapter.ts',
  'src/data/fcs/process-platform-status-adapter.ts',
  'src/pages/process-print-orders.ts',
  'src/pages/process-dye-orders.ts',
]) {
  assertIncludes(path, 'platformStatusLabel', '平台页面必须保留平台聚合状态字段')
  for (const forbidden of forbiddenVisibleTerms) {
    assertNotIncludes(path, forbidden, '平台侧不得继续展示旧状态或旧动作')
  }
}

for (const forbidden of ['待花型', '待调色测试', '等打印', '打印中', '转印中']) {
  assertNotIncludes('src/pages/process-print-orders.ts', forbidden, '平台侧印花主页面不得硬编码印花细状态作为主状态')
}

console.log('check:platform-process-result-view passed')
