import assert from 'node:assert/strict'
import * as changePages from '../src/pages/production/changes-domain.ts'
import { state } from '../src/pages/production/context.ts'
import * as changeDomain from '../src/data/fcs/production-tech-pack-change-domain.ts'
import {
  buildProductionChangePreview,
  inferProductionChangeResult,
  productionChangeResultLabels,
  quantityChangeRequiresNewFormalVersion,
  validateProductionChangeDecisions,
  type ProductionChangeDraft,
} from '../src/data/fcs/production-order-change-workflow.ts'

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

const quantityLines: ProductionChangeDraft['quantityLines'] = [
  {
    id: 'QTY-LINE-001',
    skuCode: 'SKU-BLK-M',
    color: '黑色',
    size: 'M',
    originalQty: 120,
    currentQty: 120,
    targetQty: 90,
    unit: '件',
    isNew: false,
    coveredByCurrentVersion: true,
  },
]

assert.deepEqual(
  productionChangeResultLabels,
  {
    PRODUCTION_PATCH: '生产单打补丁',
    VERSION_RELATION: '正式版本绑定调整',
    VERSION_AND_PATCH: '生产单打补丁 + 正式版本绑定调整',
  },
  '生产单变更最终结果只能使用新工作流定义的三个结果',
)

;[
  [
    '数量变更且无需新正式版本',
    inferProductionChangeResult({ changeType: 'QUANTITY_CHANGE', requiresNewFormalVersion: false }),
    'PRODUCTION_PATCH',
  ],
  [
    '数量变更且需要新正式版本',
    inferProductionChangeResult({ changeType: 'QUANTITY_CHANGE', requiresNewFormalVersion: true }),
    'VERSION_AND_PATCH',
  ],
  [
    '物料剩余数量替换 + 当前生产单',
    inferProductionChangeResult({
      changeType: 'MATERIAL_REPLACEMENT',
      replacementMode: 'REMAINING',
      scope: 'CURRENT_ONLY',
    }),
    'PRODUCTION_PATCH',
  ],
  [
    '物料剩余数量替换 + 当前及后续生产单',
    inferProductionChangeResult({
      changeType: 'MATERIAL_REPLACEMENT',
      replacementMode: 'REMAINING',
      scope: 'CURRENT_AND_FOLLOWING',
    }),
    'VERSION_AND_PATCH',
  ],
  [
    '物料全部数量替换 + 当前及后续生产单',
    inferProductionChangeResult({
      changeType: 'MATERIAL_REPLACEMENT',
      replacementMode: 'FULL',
      scope: 'CURRENT_AND_FOLLOWING',
    }),
    'VERSION_RELATION',
  ],
].forEach(([scenario, actual, expected]) => {
  assert.equal(actual, expected, `${scenario}的最终结果不正确`)
})

assert.equal(
  quantityChangeRequiresNewFormalVersion([
    ...quantityLines,
    {
      ...quantityLines[0],
      id: 'QTY-LINE-NEW',
      size: 'XXL',
      isNew: true,
      coveredByCurrentVersion: false,
    },
  ]),
  true,
  '新增且未被当前正式版本覆盖的数量明细必须触发新正式版本',
)

const materialDraft: ProductionChangeDraft = {
  productionOrderId: 'PO-202603-004',
  changeType: 'MATERIAL_REPLACEMENT',
  reason: '原面料供应不足，替换未生产数量。',
  quantityLines: [],
  materialReplacement: {
    originalMaterialId: 'MAT-FAB-018',
    replacementMaterialId: 'MAT-FAB-026',
    replacementMode: 'REMAINING',
    scope: 'CURRENT_AND_FOLLOWING',
    suggestedProductionQty: 180,
    confirmedProductionQty: 180,
    allocations: [
      {
        id: 'ALLOC-001',
        skuCode: 'SKU-BLK-M',
        color: '黑色',
        size: 'M',
        demandQty: 120,
        oldMaterialFactQty: 30,
        suggestedReplacementQty: 90,
        confirmedReplacementQty: 90,
      },
    ],
    followingOrders: [
      {
        productionOrderId: 'PO-202603-005',
        progressText: '已领料，尚未裁剪',
        started: true,
        suggestedMode: 'REMAINING',
        confirmedMode: 'REMAINING',
      },
    ],
  },
  decisionValues: {},
}

const incompletePreview = buildProductionChangePreview(materialDraft)
assert.ok(incompletePreview.autoItems.length > 0, '预览必须生成系统自动处理项')
assert.ok(incompletePreview.decisionItems.length > 0, '业务无法自动判断时必须生成待跟单判断项')
assert.ok(incompletePreview.autoItems.every((item) => item.kind === 'AUTO'), 'autoItems 只能包含系统自动处理项')
assert.ok(
  incompletePreview.decisionItems.every((item) => item.kind === 'MERCHANDISER_DECISION'),
  'decisionItems 只能包含待跟单判断项',
)
assert.deepEqual(
  validateProductionChangeDecisions(incompletePreview).sort(),
  incompletePreview.decisionItems.map((item) => item.id).sort(),
  '未选择或未填写必要原因的判断项必须被校验发现',
)
assert.ok(incompletePreview.lockObjectIds.includes(materialDraft.productionOrderId), '锁定对象必须包含当前生产单')
assert.ok(incompletePreview.lockObjectIds.every((id) => id.trim().length > 0), '锁定对象不得包含空值')

const completedDecisionValues = Object.fromEntries(
  incompletePreview.decisionItems.map((item) => [
    item.id,
    { value: item.options[item.options.length - 1]?.value ?? '', reason: '跟单已核对现场事实。' },
  ]),
)
const completedPreview = buildProductionChangePreview({
  ...materialDraft,
  decisionValues: completedDecisionValues,
})
completedPreview.decisionItems.forEach((item) => {
  assert.equal(item.selectedValue, completedDecisionValues[item.id]?.value, 'decisionValues 必须覆盖判断项默认选择')
  assert.equal(item.reason, completedDecisionValues[item.id]?.reason, 'decisionValues 必须覆盖判断项原因')
})
assert.deepEqual(validateProductionChangeDecisions(completedPreview), [], '必要判断完成后校验必须通过')

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
const removedCopy = [
  '待主管确认',
  '主管确认',
  '主管确认需要处理的事',
  '相关负责人',
  '通知相关负责人处理',
  '系统建议',
  '相关单据留痕',
  '预览并提交',
  '适用颜色',
  '适用尺码',
  '从哪里开始用新物料',
  '提交审核',
]
;['选择生产单', '填写变更内容', '确认处理方案', '同步执行'].forEach((text) => {
  assert.ok(newHtml.includes(text), `新增页缺少统一四步文案「${text}」`)
})
assert.ok(newHtml.includes('跟单'), '新增页角色必须包含跟单')
assert.ok(!newHtml.includes('系统反推，不要求业务人员先选版本关系或补丁'), '新增页不应展示旧系统反推说明')
assert.ok(!newHtml.includes('系统反推结果'), '新增页不应展示旧系统反推结果')
assert.ok(!newHtml.includes('执行策略'), '新增页不应展示旧执行策略')
assert.ok(!newHtml.includes('是否生产补丁'), '新增页不应要求选择是否生产补丁')
assert.ok(!newHtml.includes('是否版本关系变更'), '新增页不应要求选择是否版本关系变更')

state.productionChangeForm.productionOrderId = relation.productionOrderId
;(state.productionChangeForm as any).changeType = 'QUANTITY_CHANGE'
state.productionChangeFormStep = 'content'
const quantityFormHtml = renderProductionChangeNewPage()
;['商品编码', '颜色', '尺码', '原需求', '变更后数量', '变更原因'].forEach((text) => {
  assert.ok(quantityFormHtml.includes(text), `数量变更表单缺少「${text}」`)
})
assert.ok(quantityFormHtml.includes('新增明细'), '数量变更表单必须支持新增明细')
assertIncludesAny(quantityFormHtml, ['已取消', '改为 0'], '数量变更表单必须表达取消明细或数量改为 0')
assert.ok(!quantityFormHtml.includes('变更后总数'), '数量变更表单不得出现变更后总数')

;(state.productionChangeForm as any).changeType = 'MATERIAL_REPLACEMENT'
state.productionChangeFormStep = 'content'
const materialFormHtml = renderProductionChangeNewPage()
;[
  '原面料',
  '新面料',
  '剩余数量替换',
  '全部数量替换',
  '只处理当前生产单',
  '后续生产单也替换',
  '建议替换生产数量',
].forEach((text) => {
  assert.ok(materialFormHtml.includes(text), `替换物料表单缺少「${text}」`)
})
;['适用批次', '适用颜色', '适用尺码'].forEach((text) => {
  assert.ok(!materialFormHtml.includes(text), `替换物料表单不得出现「${text}」`)
})

state.productionChangeFormStep = 'handling'
const handlingHtml = renderProductionChangeNewPage()
;['系统自动处理', '待跟单判断'].forEach((text) => {
  assert.ok(handlingHtml.includes(text), `确认处理方案步骤缺少「${text}」`)
})
assert.ok(!handlingHtml.includes('逐项确认'), '确认处理方案步骤不得要求逐项确认')

state.productionChangeFormStep = 'execution'
const executionHtml = renderProductionChangeNewPage()
assert.ok(executionHtml.includes('data-production-change-execution'), '同步执行步骤必须渲染独立第四步主体')
;['全部成功才生效', '生产单正在变更，请稍后再试'].forEach((text) => {
  assert.ok(executionHtml.includes(text), `同步执行步骤缺少「${text}」`)
})

const newFlowStepHtml: Array<[string, string]> = [
  ['选择生产单', newHtml],
  ['数量变更内容', quantityFormHtml],
  ['物料替换内容', materialFormHtml],
  ['确认处理方案', handlingHtml],
  ['同步执行', executionHtml],
]
newFlowStepHtml.forEach(([step, html]) => {
  removedCopy.forEach((text) => {
    assert.ok(!html.includes(text), `${step}步骤不应出现旧文案「${text}」`)
  })
})

assert.deepEqual(
  Object.keys(productionChangeResultLabels).sort(),
  ['PRODUCTION_PATCH', 'VERSION_AND_PATCH', 'VERSION_RELATION'].sort(),
  '生产单变更最终结果只能有三种',
)

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
assert.ok(quantityDetailHtml.includes('差异'), '数量变更留痕必须展示数量差异')
;['需要谁处理', '要做什么', '当前做到哪了', '调整原因'].forEach((text) => {
  assert.ok(quantityDetailHtml.includes(text), `数量变更详情处理事项缺少「${text}」`)
})
;['相关单据', '原来', '现在', '谁确认', '确认时间', '原因'].forEach((text) => {
  assert.ok(quantityDetailHtml.includes(text), `数量变更相关单据记录缺少「${text}」`)
})

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
;['适用颜色', '适用尺码', '从哪里开始用新物料'].forEach((text) => {
  assert.ok(materialDetailHtml.includes(text), `物料替换详情缺少「${text}」`)
})
;['需要谁处理', '要做什么', '当前做到哪了', '调整原因'].forEach((text) => {
  assert.ok(materialDetailHtml.includes(text), `物料替换详情处理事项缺少「${text}」`)
})
;['相关单据', '原来', '现在', '谁确认', '确认时间', '原因'].forEach((text) => {
  assert.ok(materialDetailHtml.includes(text), `物料替换相关单据记录缺少「${text}」`)
})
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
assert.throws(
  () =>
    submitProductionOrderChangeOrder({
      productionOrderId: relation.productionOrderId,
      source: 'DELIVERY_REQUIREMENT_CHANGE',
      changeModules: ['BOM'],
      reason: '自动检查：缺少变更类型必须失败。',
      expectedEffectiveMode: 'FROM_NEXT_PREP',
      effectiveDescription: '从下一次配料开始',
      changeResult: 'PRODUCTION_PATCH',
      executionStrategy: 'AFTER_APPROVAL',
      operatorName: '自动检查',
    }),
  /请选择生产单变更类型/,
  '创建生产单变更单必须显式选择改数量或换物料',
)
assert.throws(
  () =>
    submitProductionOrderChangeOrder({
      productionOrderId: relation.productionOrderId,
      changeType: 'QUANTITY_CHANGE',
      source: 'DELIVERY_REQUIREMENT_CHANGE',
      changeModules: ['BOM'],
      reason: '自动检查：数量变更缺少色码明细必须失败。',
      expectedEffectiveMode: 'FROM_NEXT_PREP',
      effectiveDescription: '从下一次配料开始',
      changeResult: 'PRODUCTION_PATCH',
      executionStrategy: 'AFTER_APPROVAL',
      operatorName: '自动检查',
    }),
  /修改生产单需求数量必须填写颜色尺码数量明细/,
  '修改生产单需求数量必须携带颜色尺码明细',
)
assert.throws(
  () =>
    submitProductionOrderChangeOrder({
      productionOrderId: relation.productionOrderId,
      changeType: 'MATERIAL_REPLACEMENT',
      source: 'MATERIAL_SHORTAGE',
      changeModules: ['BOM'],
      reason: '自动检查：替换物料缺少明细必须失败。',
      expectedEffectiveMode: 'FROM_NEXT_PICKUP',
      effectiveDescription: '从下一次领料开始',
      changeResult: 'PRODUCTION_PATCH',
      executionStrategy: 'AFTER_APPROVAL',
      operatorName: '自动检查',
    }),
  /替换物料必须填写原物料、替代物料、适用颜色、适用尺码和开始使用节点/,
  '替换物料必须携带原物料和替代物料明细',
)

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
