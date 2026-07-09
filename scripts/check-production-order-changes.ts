import assert from 'node:assert/strict'
import * as changePages from '../src/pages/production/changes-domain.ts'
import { state } from '../src/pages/production/context.ts'
import * as changeDomain from '../src/data/fcs/production-tech-pack-change-domain.ts'

if (typeof (globalThis as any).HTMLInputElement === 'undefined') {
  ;(globalThis as any).HTMLInputElement = function HTMLInputElement() {}
}
if (typeof (globalThis as any).HTMLSelectElement === 'undefined') {
  ;(globalThis as any).HTMLSelectElement = function HTMLSelectElement() {}
}
if (typeof (globalThis as any).HTMLTextAreaElement === 'undefined') {
  ;(globalThis as any).HTMLTextAreaElement = function HTMLTextAreaElement() {}
}

function requireFunction<T extends (...args: never[]) => unknown>(exports: Record<string, unknown>, name: string): T {
  const value = exports[name]
  assert.equal(typeof value, 'function', `缺少 ${name} 导出`)
  return value as T
}

const pageExports = changePages as Record<string, unknown>
const domainExports = changeDomain as Record<string, unknown>

const renderProductionChangesPage = requireFunction<() => string>(pageExports, 'renderProductionChangesPage')
const renderProductionChangeNewPage = requireFunction<() => string>(pageExports, 'renderProductionChangeNewPage')
const renderProductionChangeOrderDetailPage = requireFunction<(id: string) => string>(
  pageExports,
  'renderProductionChangeOrderDetailPage',
)

const listProductionOrderChangeOrders = requireFunction<() => Array<Record<string, any>>>(
  domainExports,
  'listProductionOrderChangeOrders',
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

const relation = listProductionOrderTechPackRelations()[0]
assert.ok(relation, '至少需要一张可发起变更的生产单样本')

const listHtml = renderProductionChangesPage()

;[
  '生产单变更管理',
  '新增变更',
  '变更单列表',
  '待处理生产单',
  '搜索生产单号 / 变更单号 / 需求单号 / SPU / 款式 / 负责人',
  '变更单号',
  '生产单号',
].forEach((text) => {
  assert.ok(listHtml.includes(text), `列表页缺少「${text}」`)
})

assert.ok(listHtml.includes('修改生产单需求数量'), '首页必须有修改生产单需求数量入口')
assert.ok(listHtml.includes('替换物料'), '首页必须有替换物料入口')
assert.ok(!listHtml.includes('已分发委托'), '首页不应出现抽象文案：已分发委托')
assert.ok(!listHtml.includes('执行对象'), '首页不应出现抽象文案：执行对象')
assert.ok(!listHtml.includes('来源记录'), '首页不应出现抽象文案：来源记录')
assert.ok(!listHtml.includes('状态流转'), '首页不应出现抽象文案：状态流转')
assert.ok(!listHtml.includes('写回'), '首页不应出现抽象文案：写回')
assert.ok(!listHtml.includes('投影'), '首页不应出现抽象文案：投影')

const newHtml = renderProductionChangeNewPage()
;['待主管确认', '需要处理的事', '相关负责人', '处理记录', '相关单据记录'].forEach((text) => {
  assert.ok(newHtml.includes(text), `新增页缺少两类场景共用文案「${text}」`)
})
assert.ok(!newHtml.includes('系统反推，不要求业务人员先选版本关系或补丁'), '新增页不应展示旧系统反推说明')
assert.ok(!newHtml.includes('系统反推结果'), '新增页不应展示旧系统反推结果')
assert.ok(!newHtml.includes('执行策略'), '新增页不应展示旧执行策略')
assert.ok(!newHtml.includes('是否生产补丁'), '新增页不应要求选择是否生产补丁')
assert.ok(!newHtml.includes('是否版本关系变更'), '新增页不应要求选择是否版本关系变更')

;(state.productionChangeForm as any).changeType = 'QUANTITY_CHANGE'
state.productionChangeFormStep = 'content'
const quantityFormHtml = renderProductionChangeNewPage()
assert.ok(quantityFormHtml.includes('颜色'), '数量变更表单必须按颜色填写')
assert.ok(quantityFormHtml.includes('尺码'), '数量变更表单必须按尺码填写')
assert.ok(quantityFormHtml.includes('当前数量'), '数量变更表单必须显示当前数量')
assert.ok(quantityFormHtml.includes('新数量'), '数量变更表单必须填写新数量')
assert.ok(quantityFormHtml.includes('多') || quantityFormHtml.includes('少'), '数量变更表单必须展示差异')
assert.ok(!quantityFormHtml.includes('只填总数'), '数量变更不允许只填总数后自动拆分')

;(state.productionChangeForm as any).changeType = 'MATERIAL_REPLACEMENT'
state.productionChangeFormStep = 'content'
const materialFormHtml = renderProductionChangeNewPage()
assert.ok(materialFormHtml.includes('原物料'), '替换物料表单必须显示原物料')
assert.ok(materialFormHtml.includes('替代物料'), '替换物料表单必须显示替代物料')
assert.ok(materialFormHtml.includes('适用颜色'), '替换物料表单必须按颜色确认范围')
assert.ok(materialFormHtml.includes('适用尺码'), '替换物料表单必须按尺码确认范围')
assert.ok(materialFormHtml.includes('从哪里开始用新物料'), '替换物料表单必须确认开始使用节点')
assert.ok(!materialFormHtml.includes('适用批次'), '替换物料不应出现适用批次字段')

const orders = listProductionOrderChangeOrders()
assert.ok(
  orders.some((order) => order.changeType === 'QUANTITY_CHANGE'),
  '生产单变更必须覆盖修改生产单需求数量',
)
assert.ok(
  orders.some((order) => order.changeType === 'MATERIAL_REPLACEMENT'),
  '生产单变更必须覆盖替换物料',
)

const quantityOrder = orders.find((order) => order.changeType === 'QUANTITY_CHANGE')
assert.ok(quantityOrder, '需要一张数量变更样例')
const quantityDetailHtml = renderProductionChangeOrderDetailPage(quantityOrder.id)
;['变更内容', '当前事实', '需要处理的事', '处理记录', '相关单据记录'].forEach((text) => {
  assert.ok(quantityDetailHtml.includes(text), `数量变更详情缺少「${text}」`)
})
assert.ok(
  quantityDetailHtml.includes('来自哪张变更单') || quantityDetailHtml.includes('本单已按变更单'),
  '被改单据必须能反查变更单',
)
assert.ok(quantityDetailHtml.includes('原数量'), '数量变更留痕必须展示原数量')
assert.ok(quantityDetailHtml.includes('新数量'), '数量变更留痕必须展示新数量')

const materialOrder = orders.find((order) => order.changeType === 'MATERIAL_REPLACEMENT')
assert.ok(materialOrder, '需要一张物料替换样例')
const materialDetailHtml = renderProductionChangeOrderDetailPage(materialOrder.id)
;['变更内容', '当前事实', '需要处理的事', '处理记录', '相关单据记录'].forEach((text) => {
  assert.ok(materialDetailHtml.includes(text), `物料替换详情缺少「${text}」`)
})
assert.ok(
  materialDetailHtml.includes('来自哪张变更单') || materialDetailHtml.includes('本单已按变更单'),
  '被改单据必须能反查变更单',
)
assert.ok(materialDetailHtml.includes('原物料'), '物料替换详情必须展示原物料')
assert.ok(materialDetailHtml.includes('替代物料'), '物料替换详情必须展示替代物料')
assert.ok(materialDetailHtml.includes('旧料') || materialDetailHtml.includes('新物料'), '物料替换详情必须展示旧料/新物料处理事项')
assert.ok(!materialDetailHtml.includes('适用批次'), '物料替换详情不应出现适用批次')

const beforeCount = listProductionOrderChangeOrders().length
const created = submitProductionOrderChangeOrder({
  productionOrderId: relation.productionOrderId,
  source: 'MATERIAL_SHORTAGE',
  changeModules: ['BOM'],
  reason: '自动检查：替换物料后可查询变更单。',
  expectedEffectiveMode: 'FROM_NEXT_PICKUP',
  effectiveDescription: '从下一次领料开始',
  operatorName: '自动检查',
})
assert.equal(listProductionOrderChangeOrders().length, beforeCount + 1, '新增变更必须进入变更单列表')
assert.equal(getProductionOrderChangeOrder(created.id)?.id, created.id, '新增变更必须可按变更单号查询')

console.log('production order changes check passed')
