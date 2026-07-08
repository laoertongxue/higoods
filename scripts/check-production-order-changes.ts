import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import * as changePages from '../src/pages/production/changes-domain.ts'
import { state } from '../src/pages/production/context.ts'
import { handleProductionEvent } from '../src/pages/production/events.ts'
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

function makeProductionActionTarget(action: string, dataset: Record<string, string> = {}): HTMLElement {
  return {
    closest(selector: string) {
      if (selector === '[data-prod-action]') return { dataset: { prodAction: action, ...dataset } }
      return null
    },
  } as unknown as HTMLElement
}

function getStatValue(html: string, label: string): string {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const articleMatch = html.match(new RegExp(`<article\\b[^>]*data-stat-label="${escapedLabel}"[^>]*>[\\s\\S]*?</article>`))
  assert.ok(articleMatch, `缺少统计卡「${label}」`)
  const valueMatch = articleMatch[0].match(/\bdata-stat-value="([^"]*)"/)
  assert.ok(valueMatch, `统计卡「${label}」缺少数值`)
  return valueMatch[1]
}

const pageExports = changePages as Record<string, unknown>
const domainExports = changeDomain as Record<string, unknown>

const renderProductionChangesPage = requireFunction<() => string>(pageExports, 'renderProductionChangesPage')
const renderProductionChangeNewPage = requireFunction<() => string>(pageExports, 'renderProductionChangeNewPage')
const renderProductionChangeOrderDetailPage = requireFunction<(id: string) => string>(
  pageExports,
  'renderProductionChangeOrderDetailPage',
)
const renderProductionChangeRelationDetailPage = requireFunction<(id: string) => string>(
  pageExports,
  'renderProductionChangeRelationDetailPage',
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
const listProductionOrderChangeImpactRows = requireFunction<(id?: string) => Array<Record<string, any>>>(
  domainExports,
  'listProductionOrderChangeImpactRows',
)
const listProductionOrderChangeDocumentActions = requireFunction<(id?: string) => Array<Record<string, any>>>(
  domainExports,
  'listProductionOrderChangeDocumentActions',
)
const listProductionOrderChangeCostImpacts = requireFunction<(id?: string) => Array<Record<string, any>>>(
  domainExports,
  'listProductionOrderChangeCostImpacts',
)
const listProductionOrderChangeTimingImpacts = requireFunction<(id?: string) => Array<Record<string, any>>>(
  domainExports,
  'listProductionOrderChangeTimingImpacts',
)
const listProductionOrderTechPackRelations = requireFunction<() => Array<Record<string, any>>>(
  domainExports,
  'listProductionOrderTechPackRelations',
)
const listProductionPatchesByOrder = requireFunction<(id: string) => Array<Record<string, any>>>(
  domainExports,
  'listProductionPatchesByOrder',
)
const getProductionOrderChangeOrder = requireFunction<(id: string) => Record<string, any> | undefined>(
  domainExports,
  'getProductionOrderChangeOrder',
)
const submitProductionOrderChangeOrder = requireFunction<(input: Record<string, any>) => Record<string, any>>(
  domainExports,
  'submitProductionOrderChangeOrder',
)
const updateProductionOrderChangeOrder = requireFunction<(id: string, input: Record<string, any>) => Record<string, any>>(
  domainExports,
  'updateProductionOrderChangeOrder',
)

state.productionChangeListTab = 'change-orders'
state.techPackChangeKeyword = ''
state.productionChangeOrderPage = 1

const firstRelation = listProductionOrderTechPackRelations()[0]
assert.ok(firstRelation, '至少需要一张生产单版本关系样本')

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
assert.ok(!listHtml.includes('submit-tech-pack-version-change'), '变更单列表不应渲染旧版本变更弹窗提交入口')
assert.ok(!listHtml.includes('submit-production-patch'), '变更单列表不应渲染旧生产补丁弹窗提交入口')
assert.ok(!listHtml.includes('场景覆盖面板'), '业务场景覆盖说明应留在文档中，不应展示在页面')
assert.ok(!listHtml.includes('80 个场景'), '80 个业务场景目录不应作为页面演示信息展示')

state.techPackChangeVersionDialogOrderId = firstRelation.productionOrderId
state.productionPatchDialogOrderId = firstRelation.productionOrderId
const listWithLegacyDialogStateHtml = renderProductionChangesPage()
assert.ok(
  !listWithLegacyDialogStateHtml.includes('submit-tech-pack-version-change'),
  '变更单列表即使残留旧弹窗状态，也不应渲染旧版本变更提交入口',
)
assert.ok(
  !listWithLegacyDialogStateHtml.includes('submit-production-patch'),
  '变更单列表即使残留旧弹窗状态，也不应渲染旧生产补丁提交入口',
)
state.techPackChangeVersionDialogOrderId = null
state.productionPatchDialogOrderId = null

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
assert.ok(!detailHtml.includes('submit-tech-pack-version-change'), '变更单详情页不应渲染旧版本变更弹窗提交入口')
assert.ok(!detailHtml.includes('submit-production-patch'), '变更单详情页不应渲染旧生产补丁弹窗提交入口')

state.techPackChangeVersionDialogOrderId = firstRelation.productionOrderId
state.productionPatchDialogOrderId = firstRelation.productionOrderId
const detailWithLegacyDialogStateHtml = renderProductionChangeOrderDetailPage(firstOrder.id)
assert.ok(
  !detailWithLegacyDialogStateHtml.includes('submit-tech-pack-version-change'),
  '变更单详情页即使残留旧弹窗状态，也不应渲染旧版本变更提交入口',
)
assert.ok(
  !detailWithLegacyDialogStateHtml.includes('submit-production-patch'),
  '变更单详情页即使残留旧弹窗状态，也不应渲染旧生产补丁提交入口',
)
state.techPackChangeVersionDialogOrderId = null
state.productionPatchDialogOrderId = null

state.techPackChangeDetailTab = 'relation'
const relationDetailHtml = renderProductionChangeRelationDetailPage(firstRelation.productionOrderId)
assert.ok(relationDetailHtml.includes('生产单版本关系诊断'), '生产单关系诊断页必须展示诊断标题')
assert.ok(relationDetailHtml.includes('>发起变更<'), '生产单关系诊断页必须展示统一发起变更动作')
assert.ok(!relationDetailHtml.includes('>变更版本<'), '生产单关系诊断页不应展示旧变更版本主按钮')
assert.ok(!relationDetailHtml.includes('>发起补丁<'), '生产单关系诊断页不应展示旧发起补丁主按钮')
assert.ok(
  !relationDetailHtml.includes('data-prod-action="open-tech-pack-version-change"'),
  '生产单关系诊断页不应展示旧变更版本 action',
)
assert.ok(
  !relationDetailHtml.includes('data-prod-action="open-production-patch"'),
  '生产单关系诊断页不应展示旧发起补丁 action',
)

const relationWithPatch = listProductionOrderTechPackRelations().find(
  (item) => listProductionPatchesByOrder(item.productionOrderId).length > 0,
)
assert.ok(relationWithPatch, '至少需要一个带生产补丁的生产单关系样本')
state.techPackChangeDetailTab = 'patch'
const patchTabHtml = renderProductionChangeRelationDetailPage(relationWithPatch.productionOrderId)
assert.ok(
  patchTabHtml.includes('data-prod-action="open-production-patch-notice"'),
  '生产补丁 Tab 必须保留查看通知入口',
)
assert.ok(
  patchTabHtml.includes(`data-order-id="${relationWithPatch.productionOrderId}"`),
  '生产补丁查看通知入口必须携带生产单 ID',
)
state.techPackChangeDetailTab = 'relation'

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
const relation = firstRelation

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

const draft = submitProductionOrderChangeOrder({
  productionOrderId: relation.productionOrderId,
  source: 'MATERIAL_SHORTAGE',
  changeModules: ['BOM'],
  reason: '补丁草稿：待补充业务原因',
  expectedEffectiveMode: 'FROM_NEXT_PREP',
  effectiveDescription: '从下一次配料开始',
  changeResult: 'PRODUCTION_PATCH',
  executionStrategy: 'AFTER_APPROVAL',
  operatorName: '自动检查',
  status: 'DRAFT',
})

assert.equal(draft.status, 'DRAFT', '保存补丁草稿创建的变更单必须保持草稿状态')

const editBeforeCount = listProductionOrderChangeOrders().length
const updatedDraft = updateProductionOrderChangeOrder(draft.id, {
  productionOrderId: relation.productionOrderId,
  source: 'FACTORY_PROCESS_EXCEPTION',
  changeModules: ['PROCESS'],
  reason: '编辑草稿：现场工序调整，待主管补充确认。',
  expectedEffectiveMode: 'FROM_NEXT_PROCESS_ORDER',
  effectiveDescription: '从下一张工艺单开始',
  changeResult: 'PRODUCTION_PATCH',
  executionStrategy: 'AFTER_APPROVAL',
  operatorName: '自动检查',
  status: 'DRAFT',
})
assert.equal(updatedDraft.id, draft.id, '编辑保存草稿必须更新当前变更单')
assert.equal(updatedDraft.status, 'DRAFT', '编辑保存草稿必须保持草稿状态')
assert.equal(updatedDraft.reason, '编辑草稿：现场工序调整，待主管补充确认。', '编辑保存草稿必须更新主字段')
assert.equal(listProductionOrderChangeOrders().length, editBeforeCount, '编辑保存草稿不应新增变更单')

assert.ok(listProductionOrderChangeImpactRows(draft.id).length > 0, '生产补丁草稿应先存在生产影响明细')
assert.ok(listProductionOrderChangeTimingImpacts(draft.id).length > 0, '生产补丁草稿应先存在时效明细')
assert.equal(listProductionOrderChangeCostImpacts(draft.id).length, 0, '生产补丁草稿无成本模块时不应先生成成本明细')
const costOnlyUpdateBeforeCount = listProductionOrderChangeOrders().length
const costOnlyDraft = updateProductionOrderChangeOrder(draft.id, {
  productionOrderId: relation.productionOrderId,
  source: 'COST_EXCEPTION',
  changeModules: ['COST'],
  reason: '编辑草稿：核价漏计印花费，只影响本次结算差异。',
  expectedEffectiveMode: 'FROM_SPECIFIED_DATE',
  effectiveDescription: '仅影响本次结算',
  changeResult: 'COST_ONLY',
  executionStrategy: 'AFTER_APPROVAL',
  operatorName: '自动检查',
  status: 'DRAFT',
})
assert.equal(costOnlyDraft.id, draft.id, '编辑为仅成本差异必须更新当前变更单')
assert.equal(costOnlyDraft.changeResult, 'COST_ONLY', '编辑为仅成本差异必须更新主单结果')
assert.equal(listProductionOrderChangeOrders().length, costOnlyUpdateBeforeCount, '编辑为仅成本差异不应新增变更单')
assert.equal(listProductionOrderChangeImpactRows(draft.id).length, 0, '编辑为仅成本差异后不应残留生产影响明细')
assert.equal(listProductionOrderChangeTimingImpacts(draft.id).length, 0, '编辑为仅成本差异后不应残留时效明细')
assert.ok(listProductionOrderChangeCostImpacts(draft.id).length > 0, '编辑为仅成本差异后必须生成成本明细')
assert.ok(listProductionOrderChangeDocumentActions(draft.id).length > 0, '编辑为仅成本差异后仍应保留单据处理建议')

const startChangeFromOrderTarget = makeProductionActionTarget('start-production-change-from-order', {
  orderId: relation.productionOrderId,
})
const startChangeFromOrderNode = startChangeFromOrderTarget.closest('[data-prod-action]') as HTMLElement | null
assert.equal(startChangeFromOrderNode?.dataset.prodAction, 'start-production-change-from-order', '测试目标必须携带生产变更动作')
assert.equal(startChangeFromOrderNode?.dataset.orderId, relation.productionOrderId, '测试目标必须携带生产单 ID')
assert.equal(handleProductionEvent(startChangeFromOrderTarget), true, '从生产单发起新增事件必须被处理')
assert.equal(
  state.productionChangeForm.productionOrderId,
  relation.productionOrderId,
  '从生产单发起新增必须真实预填生产单 ID',
)
renderProductionChangeNewPage()
assert.equal(state.productionChangeSelectedOrderId, '', '从生产单发起新增后不应残留编辑态 ID')
assert.equal(
  state.productionChangeForm.productionOrderId,
  relation.productionOrderId,
  '从生产单发起新增后新增页重渲染不应清空预填生产单',
)
assert.equal(state.productionChangeFormStep, 'content', '从生产单发起新增后新增页重渲染不应重置预填步骤')

const inProgressNewReason = '新增页重渲染：正在填写的新增表单不应被清空。'
state.productionChangeSelectedOrderId = ''
state.productionChangeForm = {
  productionOrderId: relation.productionOrderId,
  source: 'MATERIAL_SHORTAGE',
  modules: ['BOM'],
  reason: inProgressNewReason,
  effectiveMode: 'FROM_NEXT_PICKUP',
  executionStrategy: 'AFTER_APPROVAL',
  changeResult: 'PRODUCTION_PATCH',
}
state.productionChangeFormStep = 'impact'
renderProductionChangeNewPage()
assert.equal(state.productionChangeForm.productionOrderId, relation.productionOrderId, '新增页重渲染不应清空正在填写的生产单')
assert.equal(state.productionChangeForm.reason, inProgressNewReason, '新增页重渲染不应清空正在填写的原因')
assert.equal(state.productionChangeFormStep, 'impact', '新增页重渲染不应重置正在填写的步骤')

renderProductionChangeEditPage(draft.id)
assert.equal(state.productionChangeSelectedOrderId, draft.id, '编辑页会设置当前编辑变更单 ID')
const staleDraftBeforeNewSubmit = getProductionOrderChangeOrder(draft.id)
assert.ok(staleDraftBeforeNewSubmit, '编辑残留测试需要可查询的草稿变更单')
const newHtmlAfterEditResidue = renderProductionChangeNewPage()
assert.equal(state.productionChangeSelectedOrderId, '', '新增页渲染必须清空编辑页残留的变更单 ID')
assert.equal(state.productionChangeForm.productionOrderId, '', '新增页从编辑态切入时必须清空编辑单生产单')
assert.equal(state.productionChangeForm.reason, '', '新增页从编辑态切入时必须清空编辑单原因')
assert.equal(state.productionChangeFormStep, 'order', '新增页从编辑态切入时必须回到选择生产单步骤')
assert.equal(state.productionChangeFormError, '', '新增页从编辑态切入时必须清空错误态')
assert.ok(
  !newHtmlAfterEditResidue.includes(`value="${staleDraftBeforeNewSubmit.productionOrderId}" selected`),
  '新增页从编辑态切入时 HTML 不应选中编辑单生产单号',
)
assert.ok(!newHtmlAfterEditResidue.includes(staleDraftBeforeNewSubmit.reason), '新增页 HTML 不应残留编辑单原因')

renderProductionChangeEditPage(draft.id)
assert.equal(state.productionChangeSelectedOrderId, draft.id, '编辑页会再次设置当前编辑变更单 ID')
const newReasonAfterEditResidue = '新增提交：编辑页残留后仍应创建新变更单。'
renderProductionChangeNewPage()
assert.equal(state.productionChangeSelectedOrderId, '', '新增页渲染必须清空编辑页残留的变更单 ID')
state.productionChangeForm = {
  productionOrderId: relation.productionOrderId,
  source: 'MATERIAL_SHORTAGE',
  modules: ['BOM'],
  reason: newReasonAfterEditResidue,
  effectiveMode: 'FROM_NEXT_PICKUP',
  executionStrategy: 'AFTER_APPROVAL',
  changeResult: 'PRODUCTION_PATCH',
}
state.productionChangeFormStep = 'submit'
const newSubmitBeforeCount = listProductionOrderChangeOrders().length
assert.equal(handleProductionEvent(makeProductionActionTarget('submit-production-change-order')), true, '新增页提交事件必须被处理')
assert.equal(listProductionOrderChangeOrders().length, newSubmitBeforeCount + 1, '编辑页残留后进入新增页提交必须新增变更单')
assert.equal(
  getProductionOrderChangeOrder(draft.id)?.reason,
  staleDraftBeforeNewSubmit.reason,
  '新增页提交不应覆盖原编辑变更单主字段',
)
const createdAfterEditResidue = listProductionOrderChangeOrders().find(
  (order) => order.reason === newReasonAfterEditResidue,
)
assert.ok(createdAfterEditResidue, '编辑页残留后新增提交必须可查询到新变更单')
assert.notEqual(createdAfterEditResidue.id, draft.id, '编辑页残留后新增提交不能复用旧变更单 ID')

const editSubmitBeforeCount = listProductionOrderChangeOrders().length
const updatedSubmit = updateProductionOrderChangeOrder(draft.id, {
  productionOrderId: relation.productionOrderId,
  source: 'FACTORY_PROCESS_EXCEPTION',
  changeModules: ['PROCESS'],
  reason: '编辑提交：现场工序调整，主管审核后执行。',
  expectedEffectiveMode: 'FROM_NEXT_PROCESS_ORDER',
  effectiveDescription: '从下一张工艺单开始',
  changeResult: 'PRODUCTION_PATCH',
  executionStrategy: 'IMMEDIATE_EXECUTION',
  operatorName: '自动检查',
  status: 'SUBMITTED',
})
assert.equal(updatedSubmit.id, draft.id, '编辑提交审核必须更新当前变更单')
assert.equal(updatedSubmit.status, 'SUBMITTED', '编辑页提交审核应进入已提交状态')
assert.equal(listProductionOrderChangeOrders().length, editSubmitBeforeCount, '编辑提交审核不应新增变更单')

assert.throws(
  () =>
    submitProductionOrderChangeOrder({
      productionOrderId: relation.productionOrderId,
      source: 'MATERIAL_SHORTAGE',
      changeModules: ['BOM'],
      reason: '自动检查：不允许新建为终态。',
      expectedEffectiveMode: 'FROM_NEXT_PREP',
      effectiveDescription: '从下一次配料开始',
      changeResult: 'PRODUCTION_PATCH',
      executionStrategy: 'AFTER_APPROVAL',
      operatorName: '自动检查',
      status: 'DONE',
    }),
  /新建变更单只允许保存为草稿状态。/,
  '新建变更单不允许直接创建为完成态',
)

const doneOrder = listProductionOrderChangeOrders().find((order) => order.status === 'DONE')
assert.ok(doneOrder, '至少需要一张已完成变更单样本')
assert.throws(
  () =>
    updateProductionOrderChangeOrder(doneOrder.id, {
      productionOrderId: doneOrder.productionOrderId,
      source: doneOrder.source,
      changeModules: doneOrder.changeModules,
      reason: '自动检查：已完成单不允许编辑。',
      expectedEffectiveMode: doneOrder.expectedEffectiveMode,
      effectiveDescription: doneOrder.effectiveDescription,
      changeResult: doneOrder.changeResult,
      executionStrategy: doneOrder.executionStrategy,
      operatorName: '自动检查',
      status: 'DRAFT',
    }),
  /当前变更单状态不允许编辑。/,
  '已完成变更单不允许编辑',
)

const productionEventsSource = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/production/events.ts'), 'utf8')
const patchNoticeBlock = productionEventsSource.match(
  /if \(action === 'open-production-patch-notice'\) \{[\s\S]*?\n  \}/,
)?.[0] ?? ''
assert.ok(patchNoticeBlock.includes("state.techPackChangeDetailTab = 'notice'"), '查看通知事件必须切到 notice Tab')
assert.ok(
  patchNoticeBlock.includes('`/fcs/production/changes/orders/${orderId}`'),
  '查看通知事件必须打开生产单关系诊断页',
)
assert.ok(
  !patchNoticeBlock.includes('`/fcs/production/changes/${orderId}`'),
  '查看通知事件不应跳到变更单详情路由',
)

const appShellConfig = fs.readFileSync(path.resolve(process.cwd(), 'src/data/app-shell-config.ts'), 'utf8')
assert.ok(appShellConfig.includes('生产单变更管理'), '菜单配置必须包含「生产单变更管理」')
assert.ok(!appShellConfig.includes('生产单变更影响台账'), '菜单配置不应包含「生产单变更影响台账」')

assert.ok(
  fs.existsSync(path.resolve(process.cwd(), 'docs/prototype-review-records/2026-07-08-production-order-change-management-ia-refactor.md')),
  '缺少生产单变更管理 IA 重构原型审查记录',
)

console.log('production order changes check passed')
