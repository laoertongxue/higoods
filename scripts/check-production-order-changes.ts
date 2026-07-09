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

function assertIncludesAny(html: string, texts: string[], message: string): void {
  assert.ok(texts.some((text) => html.includes(text)), message)
}

function assertHomeDoesNotIncludeLegacyEntries(html: string, label: string): void {
  ;[
    '查看发布待评估',
    '冻结版本',
    '最新正式版',
    '版本关系状态',
    '补丁',
    '查看关系',
    '是否存在新正式版',
    '是否存在补丁',
  ].forEach((text) => {
    assert.ok(!html.includes(text), `${label}不应出现旧技术包/版本关系/补丁入口：${text}`)
  })
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
assertHomeDoesNotIncludeLegacyEntries(listHtml, '默认首页')
assert.ok(!listHtml.includes('已分发委托'), '首页不应出现抽象文案：已分发委托')
assert.ok(!listHtml.includes('执行对象'), '首页不应出现抽象文案：执行对象')
assert.ok(!listHtml.includes('来源记录'), '首页不应出现抽象文案：来源记录')
assert.ok(!listHtml.includes('状态流转'), '首页不应出现抽象文案：状态流转')
assert.ok(!listHtml.includes('写回'), '首页不应出现抽象文案：写回')
assert.ok(!listHtml.includes('投影'), '首页不应出现抽象文案：投影')

state.productionChangeListTab = 'candidate-orders'
const candidateListHtml = renderProductionChangesPage()
assert.ok(candidateListHtml.includes('待处理生产单'), '待处理生产单页签必须保留业务入口')
assert.ok(candidateListHtml.includes('修改生产单需求数量'), '待处理生产单页签必须提供修改生产单需求数量入口')
assert.ok(candidateListHtml.includes('替换物料'), '待处理生产单页签必须提供替换物料入口')
assert.ok(
  candidateListHtml.includes(`data-change-type="QUANTITY_CHANGE" data-order-id="${relation.productionOrderId}"`),
  '待处理生产单的修改数量入口必须带入生产单号',
)
assert.ok(
  candidateListHtml.includes(`data-change-type="MATERIAL_REPLACEMENT" data-order-id="${relation.productionOrderId}"`),
  '待处理生产单的替换物料入口必须带入生产单号',
)
assertHomeDoesNotIncludeLegacyEntries(candidateListHtml, '待处理生产单页签')
state.productionChangeListTab = 'change-orders'

const newHtml = renderProductionChangeNewPage()
;['待主管确认', '需要处理的事', '相关负责人', '处理记录', '相关单据记录'].forEach((text) => {
  assert.ok(newHtml.includes(text), `新增页缺少两类场景共用文案「${text}」`)
})
assertIncludesAny(newHtml, ['变更内容', '提交变更内容', '填写变更内容'], '新增页必须表达业务提交变更内容')
assertIncludesAny(newHtml, ['系统建议', '系统给出建议', '系统给建议', '建议处理'], '新增页必须表达系统给建议')
assert.ok(newHtml.includes('主管确认需要处理的事'), '新增页必须表达主管确认需要处理的事')
assert.ok(newHtml.includes('相关负责人处理'), '新增页必须表达相关负责人处理')
assert.ok(newHtml.includes('相关单据留痕'), '新增页必须表达相关单据留痕')
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
assertIncludesAny(quantityFormHtml, ['差异', '多出', '减少', '本次变化'], '数量变更表单必须展示差异')
;['只填总数', '总数量', '汇总数量', '变更后总数'].forEach((text) => {
  assert.ok(!quantityFormHtml.includes(text), `数量变更不允许使用总数填写口径：${text}`)
})

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
assertIncludesAny(quantityDetailHtml, ['变更单记录', '变更单留痕'], '数量变更详情必须展示变更单记录或留痕')
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
assertIncludesAny(materialDetailHtml, ['变更单记录', '变更单留痕'], '物料替换详情必须展示变更单记录或留痕')
assert.ok(
  materialDetailHtml.includes('来自哪张变更单') || materialDetailHtml.includes('本单已按变更单'),
  '被改单据必须能反查变更单',
)
assert.ok(materialDetailHtml.includes('原物料'), '物料替换详情必须展示原物料')
assert.ok(materialDetailHtml.includes('替代物料'), '物料替换详情必须展示替代物料')
assert.ok(materialDetailHtml.includes('旧料') || materialDetailHtml.includes('新物料'), '物料替换详情必须展示旧料/新物料处理事项')
assert.ok(!materialDetailHtml.includes('适用批次'), '物料替换详情不应出现适用批次')

;[
  ['首页', listHtml],
  ['新增页', newHtml],
  ['数量变更表单', quantityFormHtml],
  ['替换物料表单', materialFormHtml],
  ['数量变更详情', quantityDetailHtml],
  ['物料替换详情', materialDetailHtml],
].forEach(([label, html]) => {
  ;['已分发委托', '执行对象', '来源记录', '状态流转', '写回', '投影'].forEach((text) => {
    assert.ok(!html.includes(text), `${label}不应出现抽象文案：${text}`)
  })
})

const beforeCount = listProductionOrderChangeOrders().length
const createdQuantity = submitProductionOrderChangeOrder({
  productionOrderId: relation.productionOrderId,
  changeType: 'QUANTITY_CHANGE',
  source: 'DELIVERY_REQUIREMENT_CHANGE',
  changeModules: ['BOM', 'PROCESS'],
  reason: '自动检查：按颜色尺码修改生产单需求数量。',
  expectedEffectiveMode: 'FROM_NEXT_PREP',
  effectiveDescription: '从下一次配料开始',
  changeResult: 'PRODUCTION_PATCH',
  executionStrategy: 'AFTER_APPROVAL',
  operatorName: '自动检查',
  quantityLines: [
    { color: '黑色', size: 'M', currentQty: 120, newQty: 90, unit: '件' },
    { color: '藏青色', size: 'L', currentQty: 100, newQty: 80, unit: '件' },
  ],
})
assert.equal(createdQuantity.changeType, 'QUANTITY_CHANGE', '数量变更提交必须保留业务类型')
assert.equal(createdQuantity.quantityLines?.[0]?.newQty, 90, '数量变更提交必须保留颜色尺码新数量')
assert.equal(createdQuantity.materialReplacement, undefined, '数量变更提交不应挂物料替换明细')

const createdMaterial = submitProductionOrderChangeOrder({
  productionOrderId: relation.productionOrderId,
  changeType: 'MATERIAL_REPLACEMENT',
  source: 'MATERIAL_SHORTAGE',
  changeModules: ['BOM'],
  reason: '自动检查：替换物料后可查询变更单。',
  expectedEffectiveMode: 'FROM_NEXT_PICKUP',
  effectiveDescription: '从下一次领料开始',
  changeResult: 'PRODUCTION_PATCH',
  executionStrategy: 'AFTER_APPROVAL',
  operatorName: '自动检查',
  materialReplacement: {
    originalMaterial: '自动检查原物料 A',
    replacementMaterial: '自动检查替代物料 B',
    colors: ['黑色'],
    sizes: ['M', 'L'],
    effectiveFromText: '从下一次领料开始用新物料',
  },
})
assert.equal(createdMaterial.changeType, 'MATERIAL_REPLACEMENT', '物料替换提交必须保留业务类型')
assert.equal(createdMaterial.materialReplacement?.replacementMaterial, '自动检查替代物料 B', '物料替换提交必须保留替代物料')
assert.equal(createdMaterial.quantityLines, undefined, '物料替换提交不应挂数量变更明细')

assert.equal(listProductionOrderChangeOrders().length, beforeCount + 2, '新增变更必须进入变更单列表')
assert.equal(getProductionOrderChangeOrder(createdQuantity.id)?.id, createdQuantity.id, '新增数量变更必须可按变更单号查询')
assert.equal(getProductionOrderChangeOrder(createdMaterial.id)?.id, createdMaterial.id, '新增物料替换必须可按变更单号查询')

console.log('production order changes check passed')
