import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import * as changePages from '../src/pages/production/changes-domain.ts'
import { state } from '../src/pages/production/context.ts'
import * as changeDomain from '../src/data/fcs/production-tech-pack-change-domain.ts'

function requireFunction<T extends (...args: never[]) => unknown>(exports: Record<string, unknown>, name: string): T {
  const value = exports[name]
  assert.equal(typeof value, 'function', `缺少 ${name} 导出`)
  return value as T
}

function getStatValue(html: string, label: string): string {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = html.match(new RegExp(`<p class="text-xs text-muted-foreground">${escapedLabel}</p>\\s*<p class="mt-1 text-2xl font-semibold">([^<]+)</p>`))
  assert.ok(match, `缺少统计卡「${label}」`)
  return match[1]
}

const pageExports = changePages as Record<string, unknown>
const domainExports = changeDomain as Record<string, unknown>

const renderProductionChangesPage = requireFunction<() => string>(pageExports, 'renderProductionChangesPage')
const renderProductionChangeNewPage = requireFunction<() => string>(pageExports, 'renderProductionChangeNewPage')
const renderProductionChangeOrderDetailPage = requireFunction<(id: string) => string>(
  pageExports,
  'renderProductionChangeOrderDetailPage',
)
const renderProductionChangeEditPage = requireFunction<(id: string) => string>(pageExports, 'renderProductionChangeEditPage')

const listProductionOrderChangeOrders = requireFunction<() => Array<Record<string, any>>>(
  domainExports,
  'listProductionOrderChangeOrders',
)
const listProductionOrderChangeScenarioCatalog = requireFunction<() => Array<Record<string, any>>>(
  domainExports,
  'listProductionOrderChangeScenarioCatalog',
)
const listProductionOrderChangeImpactRows = requireFunction<() => Array<Record<string, any>>>(
  domainExports,
  'listProductionOrderChangeImpactRows',
)
const listProductionOrderChangeDocumentActions = requireFunction<(id?: string) => Array<Record<string, any>>>(
  domainExports,
  'listProductionOrderChangeDocumentActions',
)
const listProductionOrderChangeCostImpacts = requireFunction<() => Array<Record<string, any>>>(
  domainExports,
  'listProductionOrderChangeCostImpacts',
)
const listProductionOrderChangeTimingImpacts = requireFunction<() => Array<Record<string, any>>>(
  domainExports,
  'listProductionOrderChangeTimingImpacts',
)
const listProductionOrderTechPackRelations = requireFunction<() => Array<Record<string, any>>>(
  domainExports,
  'listProductionOrderTechPackRelations',
)
const getProductionOrderChangeOrder = requireFunction<(id: string) => Record<string, any> | undefined>(
  domainExports,
  'getProductionOrderChangeOrder',
)
const submitProductionOrderChangeOrder = requireFunction<(input: Record<string, any>) => Record<string, any>>(
  domainExports,
  'submitProductionOrderChangeOrder',
)

state.productionChangeListTab = 'change-orders'
state.techPackChangeKeyword = ''
state.productionChangeOrderPage = 1

const listHtml = renderProductionChangesPage()

;[
  '生产单变更管理',
  '新增变更',
  '变更单列表',
  '待处理生产单',
  '搜索生产单号 / 变更单号 / 需求单号 / SPU / 款式 / 负责人',
  '变更单号',
  '生产单号',
  '系统反推结果',
  '执行策略',
  '锁定状态',
].forEach((text) => {
  assert.ok(listHtml.includes(text), `列表页缺少「${text}」`)
})

assert.ok(!listHtml.includes('当前展示变更单详情'), '列表页不应内嵌变更单详情')
assert.ok(!listHtml.includes('系统读取的现场事实'), '列表页不应内嵌详情事实区')
assert.ok(!listHtml.includes('data-prod-action="open-tech-pack-version-change"'), '变更单列表不应直接展示变更版本按钮')
assert.ok(!listHtml.includes('data-prod-action="open-production-patch"'), '变更单列表不应直接展示发起补丁按钮')
assert.ok(!listHtml.includes('场景覆盖面板'), '业务场景覆盖说明应留在文档中，不应展示在页面')
assert.ok(!listHtml.includes('80 个场景'), '80 个业务场景目录不应作为页面演示信息展示')

const newHtml = renderProductionChangeNewPage()
;['选择生产单', '填写变更内容', '系统计算影响', '确认单据处理', '料工费与时效', '提交审核'].forEach((text) => {
  assert.ok(newHtml.includes(text), `新增页缺少步骤「${text}」`)
})
assert.ok(newHtml.includes('系统反推，不要求业务人员先选版本关系或补丁'), '新增页必须说明系统反推口径')

const firstOrder = listProductionOrderChangeOrders()[0]
assert.ok(firstOrder, '至少需要一张变更单')

const detailHtml = renderProductionChangeOrderDetailPage(firstOrder.id)
;['变更内容', '生产影响', '单据处理', '料工费', '时效影响', '审核执行', '处理记录'].forEach((text) => {
  assert.ok(detailHtml.includes(text), `详情页缺少 Tab「${text}」`)
})
assert.ok(detailHtml.includes(firstOrder.id), '详情页必须展示变更单号')
assert.ok(!detailHtml.includes('变更单列表'), '详情页不应混入列表')

const editHtml = renderProductionChangeEditPage(firstOrder.id)
assert.ok(editHtml.includes('编辑变更单'), '编辑页必须展示编辑标题')
assert.ok(editHtml.includes(firstOrder.id), '编辑页必须展示当前变更单号')

const orders = listProductionOrderChangeOrders()
const scenarios = listProductionOrderChangeScenarioCatalog()
const impacts = listProductionOrderChangeImpactRows()
const documentActions = listProductionOrderChangeDocumentActions()
const costImpacts = listProductionOrderChangeCostImpacts()
const timingImpacts = listProductionOrderChangeTimingImpacts()

assert.equal(scenarios.length, 80, '生产单变更场景目录必须正好 80 条')
assert.ok(orders.length >= 30, '变更单样例至少 30 条')

const ordersByProductionOrder = new Map<string, number>()
orders.forEach((order) => {
  ordersByProductionOrder.set(order.productionOrderId, (ordersByProductionOrder.get(order.productionOrderId) ?? 0) + 1)
})
assert.ok([...ordersByProductionOrder.values()].some((count) => count >= 3), '必须覆盖同一生产单多次变更')

const versionAndPatchOrder = orders.find((order) => order.changeResult === 'VERSION_AND_PATCH')
assert.ok(versionAndPatchOrder, '必须覆盖版本关系变更 + 生产单层补丁')
assert.ok(versionAndPatchOrder.hasVersionRelationChange, '组合变更单必须包含版本关系变更标识')
assert.ok(versionAndPatchOrder.hasProductionPatch, '组合变更单必须包含生产补丁标识')

const documentActionIds = new Set(documentActions.map((row) => row.changeOrderId))
orders
  .filter((order) => order.changeResult !== 'RECORD_ONLY')
  .forEach((order) => {
    assert.ok(documentActionIds.has(order.id), `${order.id} 缺少单据处理明细`)
  })

const costIds = new Set(costImpacts.map((row) => row.changeOrderId))
orders
  .filter((order) => order.changeResult === 'COST_ONLY' || order.costDeltaAmount !== 0)
  .forEach((order) => {
    assert.ok(costIds.has(order.id), `${order.id} 缺少料工费差异`)
  })

const timingIds = new Set(timingImpacts.map((row) => row.changeOrderId))
orders
  .filter((order) => order.changeResult !== 'COST_ONLY' && order.changeResult !== 'RECORD_ONLY')
  .forEach((order) => {
    assert.ok(timingIds.has(order.id), `${order.id} 缺少时效影响`)
  })

state.techPackChangeKeyword = firstOrder.id
state.productionChangeOrderPage = 1
const singleOrderListHtml = renderProductionChangesPage()
const singleOrderSettlementIds = new Set([
  ...documentActions
    .filter((item) => item.changeOrderId === firstOrder.id && item.documentType === 'SETTLEMENT')
    .map((item) => item.changeOrderId),
  ...costImpacts.filter((item) => item.changeOrderId === firstOrder.id).map((item) => item.changeOrderId),
])
const singleOrderTimingIds = new Set(
  timingImpacts
    .filter(
      (item) =>
        item.changeOrderId === firstOrder.id &&
        (item.delayDays > 0 || item.affectsProductionDelivery || item.affectsFulfillmentDelivery),
    )
    .map((item) => item.changeOrderId),
)
assert.equal(getStatValue(singleOrderListHtml, '变更单数'), '1', '搜索单张变更单时统计应只计算命中变更单')
assert.equal(
  getStatValue(singleOrderListHtml, '影响结算'),
  String(singleOrderSettlementIds.size),
  '搜索单张变更单时影响结算统计应跟随过滤结果',
)
assert.equal(
  getStatValue(singleOrderListHtml, '影响交期'),
  String(singleOrderTimingIds.size),
  '搜索单张变更单时影响交期统计应跟随过滤结果',
)
state.techPackChangeKeyword = ''

const beforeCount = listProductionOrderChangeOrders().length
const relation = listProductionOrderTechPackRelations()[0]
assert.ok(relation, '至少需要一张生产单版本关系样本')

const created = submitProductionOrderChangeOrder({
  productionOrderId: relation.productionOrderId,
  source: 'MATERIAL_SHORTAGE',
  changeModules: ['BOM'],
  reason: '自动检查：主面料短缺，指定后续领料改用替代料。',
  expectedEffectiveMode: 'FROM_NEXT_PICKUP',
  effectiveDescription: '从下一次领料开始',
  changeResult: 'PRODUCTION_PATCH',
  executionStrategy: 'AFTER_APPROVAL',
  operatorName: '自动检查',
})

assert.equal(listProductionOrderChangeOrders().length, beforeCount + 1, '新增变更必须进入变更单列表')
assert.equal(getProductionOrderChangeOrder(created.id)?.id, created.id, '新增变更必须可按变更单号查询')
assert.ok(listProductionOrderChangeDocumentActions(created.id).length > 0, '新增变更必须生成单据处理建议')

const appShellConfig = fs.readFileSync(path.resolve(process.cwd(), 'src/data/app-shell-config.ts'), 'utf8')
assert.ok(appShellConfig.includes('生产单变更管理'), '菜单配置必须包含「生产单变更管理」')
assert.ok(!appShellConfig.includes('生产单变更影响台账'), '菜单配置不应包含「生产单变更影响台账」')

assert.ok(
  fs.existsSync(path.resolve(process.cwd(), 'docs/prototype-review-records/2026-07-08-production-order-change-management-ia-refactor.md')),
  '缺少生产单变更管理 IA 重构原型审查记录',
)

console.log('production order changes check passed')
