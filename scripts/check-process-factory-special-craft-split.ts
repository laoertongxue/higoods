import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  getCraftManagementDomain,
  listSelectableSpecialCraftDefinitions,
} from '../src/data/fcs/process-craft-dict.ts'
import {
  listAuxiliaryCraftOperationDefinitions,
  listSpecialCraftOperationDefinitions,
  listSpecialTypeCraftOperationDefinitions,
  buildSpecialCraftTaskOrdersPath,
  buildSpecialCraftDomainWaitHandoverWarehousePath,
  buildSpecialCraftDomainWaitProcessWarehousePath,
} from '../src/data/fcs/special-craft-operations.ts'
import {
  getSpecialCraftTaskOrders,
  listAuxiliaryCraftTaskOrders,
  listSpecialCraftTaskOrders,
  listSpecialTypeCraftTaskOrders,
} from '../src/data/fcs/special-craft-task-orders.ts'
import { renderSpecialCraftTaskOrdersPage } from '../src/pages/process-factory/special-craft/task-orders.ts'
import {
  renderSpecialCraftDomainWaitHandoverWarehousePage,
  renderSpecialCraftDomainWaitProcessWarehousePage,
} from '../src/pages/process-factory/special-craft/warehouse.ts'
import { routes } from '../src/router/routes-fcs.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}
const assertIncludes = (source: string, needle: string, message: string) => {
  assert(source.includes(needle), message)
}
const assertNotIncludes = (source: string, needle: string, message: string) => {
  assert(!source.includes(needle), message)
}

const expectedAuxiliaryCrafts = ['绣花', '打条', '压褶', '打揽', '烫画', '直喷', '贝壳绣', '曲牙绣', '一字贝绣花']
const expectedSpecialTypeCrafts = ['模板工序', '激光开袋', '特种车缝（花样机）', '橡筋定长切割']

const dictionaryDefinitions = listSelectableSpecialCraftDefinitions()
const allOperations = listSpecialCraftOperationDefinitions()
const auxiliaryOperations = listAuxiliaryCraftOperationDefinitions()
const specialTypeOperations = listSpecialTypeCraftOperationDefinitions()
const allTaskOrders = listSpecialCraftTaskOrders()
const auxiliaryTaskOrders = listAuxiliaryCraftTaskOrders()
const specialTypeTaskOrders = listSpecialTypeCraftTaskOrders()

for (const craftName of expectedAuxiliaryCrafts) {
  assert(
    getCraftManagementDomain(craftName) === 'AUXILIARY_CRAFT_FACTORY',
    `${craftName} 必须归属辅助工艺工厂管理`,
  )
  assert(
    auxiliaryOperations.some((operation) => operation.operationName === craftName),
    `${craftName} 必须存在辅助工艺 operation`,
  )
}

for (const craftName of expectedSpecialTypeCrafts) {
  assert(
    getCraftManagementDomain(craftName) === 'SPECIAL_CRAFT_FACTORY',
    `${craftName} 必须归属特种工艺工厂管理`,
  )
  assert(
    specialTypeOperations.some((operation) => operation.operationName === craftName),
    `${craftName} 必须存在特种工艺 operation`,
  )
}

assert(getCraftManagementDomain('捆条') === 'CUTTING_FACTORY', '捆条必须归属裁床厂管理')
assert(!allOperations.some((operation) => operation.operationName === '捆条'), '捆条不得出现在特殊工艺 operation 中')
assert(dictionaryDefinitions.some((definition) => definition.craftName === '捆条'), '工序工艺字典必须保留捆条定义')

assert(auxiliaryOperations.length >= expectedAuxiliaryCrafts.length, '辅助工艺 operation 数量不足')
assert(specialTypeOperations.length >= expectedSpecialTypeCrafts.length, '特种工艺 operation 数量不足')
assert(
  allOperations.every(
    (operation) =>
      operation.managementDomain === 'AUXILIARY_CRAFT_FACTORY' ||
      operation.managementDomain === 'SPECIAL_CRAFT_FACTORY',
  ),
  '特殊工艺 operation 只能归属辅助工艺或特种工艺管理域',
)

assert(allTaskOrders.length > 0, '必须存在特殊工艺加工单 mock 数据')
assert(auxiliaryTaskOrders.length > 0, '必须存在辅助工艺加工单 mock 数据')
assert(specialTypeTaskOrders.length > 0, '必须存在特种工艺加工单 mock 数据')
assert(!allTaskOrders.some((taskOrder) => taskOrder.operationName === '捆条'), '捆条不得进入特殊工艺加工单池')
assert(
  allTaskOrders.every((taskOrder) => taskOrder.generationSource === 'PRODUCTION_ORDER'),
  '特殊工艺加工单必须由生产单自动拆分生成',
)
assert(
  allTaskOrders.every((taskOrder) => taskOrder.assignmentStatus === 'WAIT_ASSIGN' || taskOrder.assignmentStatus === 'ASSIGNED'),
  '特殊工艺加工单初始分配状态必须可解释',
)
for (const operation of allOperations) {
  const operationTaskOrders = getSpecialCraftTaskOrders(operation.operationId)
  assert(operationTaskOrders.length > 0, `${operation.operationName} 必须存在从生产单技术包生成的加工单数据`)
  assert(
    operationTaskOrders.every((taskOrder) => taskOrder.generationSource === 'PRODUCTION_ORDER'),
    `${operation.operationName} 加工单必须来自生产单自动拆分任务`,
  )
}

const menuSource = read('src/data/app-shell-config.ts')
const routesSource = read('src/router/routes-fcs.ts')
const renderersSource = read('src/router/route-renderers-fcs.ts')
const taskOrdersSource = read('src/pages/process-factory/special-craft/task-orders.ts')
const warehouseSource = read('src/pages/process-factory/special-craft/warehouse.ts')
const cuttingBindingSource = read('src/pages/process-factory/cutting/special-processes.ts')
const bindingOrderSource = read('src/pages/process-factory/cutting/binding-strip-orders.ts')
const pdaExecSource = read('src/pages/pda-exec.ts')
const pdaReceiveSource = read('src/pages/pda-task-receive-detail.ts')

assertIncludes(menuSource, '辅助工艺工厂管理', '菜单必须存在辅助工艺工厂管理')
assertIncludes(menuSource, '特种工艺工厂管理', '菜单必须存在特种工艺工厂管理')
assertIncludes(menuSource, '捆条加工单', '裁床厂管理菜单必须存在捆条加工单')
assertIncludes(menuSource, '/fcs/craft/cutting/special-processes', '捆条加工单必须使用裁床路由')
assertNotIncludes(menuSource, '特殊工艺统计', '菜单不得保留特殊工艺统计')
assertNotIncludes(menuSource, '特殊工艺任务单', '菜单不得保留旧特殊工艺任务单入口')
assertNotIncludes(menuSource, '特殊工艺待加工仓', '菜单不得保留旧特殊工艺待加工仓入口')
assertNotIncludes(menuSource, '特殊工艺待交出仓', '菜单不得保留旧特殊工艺待交出仓入口')

assertIncludes(routesSource, 'specialCraftExactRoutes', '分工艺加工单路由必须通过 specialCraftExactRoutes 注册')
assertIncludes(routesSource, 'buildSpecialCraftTaskOrdersPath(operation)', '分工艺加工单路由必须来自 operation 定义')
for (const operation of allOperations) {
  const taskOrdersPath = buildSpecialCraftTaskOrdersPath(operation)
  assert(routes.exactRoutes[taskOrdersPath], `${operation.operationName} 必须存在分工艺加工单路由`)
}
assert(
  routes.exactRoutes[buildSpecialCraftDomainWaitProcessWarehousePath('AUXILIARY_CRAFT_FACTORY')],
  '必须存在辅助工艺待加工仓路由',
)
assert(
  routes.exactRoutes[buildSpecialCraftDomainWaitHandoverWarehousePath('AUXILIARY_CRAFT_FACTORY')],
  '必须存在辅助工艺待交出仓路由',
)
assert(
  routes.exactRoutes[buildSpecialCraftDomainWaitProcessWarehousePath('SPECIAL_CRAFT_FACTORY')],
  '必须存在特种工艺待加工仓路由',
)
assert(
  routes.exactRoutes[buildSpecialCraftDomainWaitHandoverWarehousePath('SPECIAL_CRAFT_FACTORY')],
  '必须存在特种工艺待交出仓路由',
)
assertIncludes(routesSource, '/fcs/craft/cutting/special-processes', '必须存在裁床捆条加工单路由')
assertIncludes(renderersSource, 'renderSpecialCraftTaskOrdersPage', '路由渲染器必须接入加工单页面')
assertIncludes(renderersSource, 'renderSpecialCraftDomainWaitProcessWarehousePage', '路由渲染器必须接入分域待加工仓')
assertIncludes(renderersSource, 'renderSpecialCraftDomainWaitHandoverWarehousePage', '路由渲染器必须接入分域待交出仓')

for (const operation of allOperations) {
  const route = buildSpecialCraftTaskOrdersPath(operation)
  const html = renderSpecialCraftTaskOrdersPage(route.split('/').at(-2) ?? '')
  assertIncludes(html, `${operation.operationName}加工单`, `${operation.operationName} 页面标题必须是加工单`)
  assertNotIncludes(html, `${operation.operationName}任务单`, `${operation.operationName} 页面不得展示任务单标题`)
}

const auxiliaryWaitProcessHtml = renderSpecialCraftDomainWaitProcessWarehousePage('auxiliary')
const auxiliaryWaitHandoverHtml = renderSpecialCraftDomainWaitHandoverWarehousePage('auxiliary')
const specialWaitProcessHtml = renderSpecialCraftDomainWaitProcessWarehousePage('special-type')
const specialWaitHandoverHtml = renderSpecialCraftDomainWaitHandoverWarehousePage('special-type')
assertIncludes(auxiliaryWaitProcessHtml, '辅助工艺待加工仓', '辅助工艺待加工仓页面必须可渲染')
assertIncludes(auxiliaryWaitHandoverHtml, '辅助工艺待交出仓', '辅助工艺待交出仓页面必须可渲染')
assertIncludes(specialWaitProcessHtml, '特种工艺待加工仓', '特种工艺待加工仓页面必须可渲染')
assertIncludes(specialWaitHandoverHtml, '特种工艺待交出仓', '特种工艺待交出仓页面必须可渲染')
assertIncludes(buildSpecialCraftDomainWaitProcessWarehousePath('AUXILIARY_CRAFT_FACTORY'), '/auxiliary/wait-process-warehouse', '辅助工艺待加工仓路径错误')
assertIncludes(buildSpecialCraftDomainWaitHandoverWarehousePath('SPECIAL_CRAFT_FACTORY'), '/special-type/wait-handover-warehouse', '特种工艺待交出仓路径错误')

assertIncludes(taskOrdersSource, '加工单', '特殊工艺页面必须使用加工单口径')
assertNotIncludes(taskOrdersSource, '新增任务', '特殊工艺页面不得出现新增任务动作')
assertNotIncludes(taskOrdersSource, '从裁片仓生成', '特殊工艺页面不得从裁片仓手工生成')
assertIncludes(warehouseSource, '查看加工单', '仓库页面必须能追溯加工单')
assertNotIncludes(warehouseSource, '特殊工艺待加工仓', '仓库页面不得保留旧统一特殊工艺待加工仓文案')
assertNotIncludes(warehouseSource, '特殊工艺待交出仓', '仓库页面不得保留旧统一特殊工艺待交出仓文案')

assertIncludes(cuttingBindingSource, '捆条加工单', '裁床捆条加工单页面必须存在')
assertIncludes(bindingOrderSource, 'getProductionOrderTechPackSnapshot', '捆条加工单必须来自生产单技术包快照')
assertIncludes(bindingOrderSource, 'source.productionOrderId', '捆条技术包快照必须按来源生产单读取')
assertNotIncludes(cuttingBindingSource, 'listEnabledSpecialCraftOperationDefinitions', '捆条加工单不得复用特殊工艺 operation')
assertNotIncludes(cuttingBindingSource, '打揽', '裁床捆条页面不得展示辅助工艺 operation')
assertNotIncludes(cuttingBindingSource, '烫画', '裁床捆条页面不得展示辅助工艺 operation')
assertNotIncludes(cuttingBindingSource, '任务单', '裁床捆条页面不得使用任务单口径')

assertIncludes(pdaExecSource, 'canFactoryAccessSpecialCraftPdaTask', 'PDA 执行必须按当前工厂和特殊工艺管理域过滤')
assertIncludes(pdaReceiveSource, 'pending-quote', 'PDA 接单必须保留报价竞标 Tab')
assertIncludes(pdaReceiveSource, 'quoted', 'PDA 接单必须保留已报价 Tab')
assertIncludes(pdaReceiveSource, 'awarded', 'PDA 接单必须识别已定标任务')
assertIncludes(pdaReceiveSource, "assignmentStatus === 'AWARDED'", '竞价定标后必须进入已定标口径')

console.log('process-factory-special-craft-split checks passed')
