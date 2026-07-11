import assert from 'node:assert/strict'

import { routes } from '../src/router/routes-fcs.ts'
import { handleProcessWaterSolubleOrdersEvent, renderProcessWaterSolubleOrdersPage } from '../src/pages/process-water-soluble-orders.ts'
import { closeCraftDyeingWaterSolubleOverlay, handleCraftDyeingWaterSolubleOrdersEvent, renderCraftDyeingWaterSolubleOrdersPage } from '../src/pages/process-factory/dyeing/water-soluble-orders.ts'
import { assignWaterSolubleFactory, canAssignWaterSolubleFactory, getWaterSolubleWorkOrderById, listWaterSolubleWorkOrders, resetWaterSolubleDomainForChecks, WATER_SOLUBLE_STATUS_LABEL } from '../src/data/fcs/water-soluble-task-domain.ts'
import { createPdaSessionFromUser, listFactoryPdaUsers } from '../src/data/fcs/store-domain-pda.ts'
import { listBusinessFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'

async function renderRoute(path: string): Promise<string> {
  const renderer = routes.exactRoutes[path]
  assert(renderer, `缺少真实路由：${path}`)
  const html = await renderer(path)
  assert(html.trim(), `路由未渲染页面：${path}`)
  return html
}

const stateBeforeRendering = listWaterSolubleWorkOrders()
const fcsHtml = await renderRoute('/fcs/process/water-soluble-orders')
const stateAfterFcsRendering = listWaterSolubleWorkOrders()
const pfosHtml = await renderRoute('/fcs/craft/dyeing/water-soluble-orders')
const stateAfterPfosRendering = listWaterSolubleWorkOrders()
await renderRoute('/fcs/process/water-soluble-orders')
const stateAfterRouteRoundTrip = listWaterSolubleWorkOrders()

assert.deepEqual(stateAfterFcsRendering, stateBeforeRendering, '仅渲染 FCS 页面不得修改水溶加工单状态、日志或时间')
assert.deepEqual(stateAfterPfosRendering, stateBeforeRendering, '仅渲染 PFOS 页面不得修改水溶加工单状态、日志或时间')
assert.deepEqual(stateAfterRouteRoundTrip, stateBeforeRendering, 'FCS → PFOS → FCS 浏览往返不得修改领域事实')

assert(fcsHtml.includes('data-testid="water-soluble-orders-page"'), 'FCS 水溶加工单页面未渲染')
assert(fcsHtml.includes('data-testid="water-soluble-pagination"'), 'FCS 水溶加工单缺少分页')
assert(fcsHtml.includes('计划交期') && fcsHtml.includes('未排期'), 'FCS 页面不得伪造计划交期')
assert(fcsHtml.includes('技术包版本') && fcsHtml.includes('分配染厂'), 'FCS 页面缺少管理字段或派厂动作')
assert(fcsHtml.includes('款号或款式'), 'FCS 页面缺少款号或款式字段')
assert(!fcsHtml.includes('需先水溶'), 'FCS 独立水溶页不得混入含水溶染色单')
assert(pfosHtml.includes('data-testid="factory-water-soluble-orders-page"'), 'PFOS 水溶加工单页面未渲染')
assert(pfosHtml.includes('data-testid="factory-water-soluble-pagination"'), 'PFOS 水溶加工单缺少分页')
assert(pfosHtml.includes('管理预览') && pfosHtml.includes('只读'), '无可信工厂 session 时 PFOS 必须明确只读预览')
;['material-ready', 'start', 'complete', 'open-supervisor', 'open-handover', 'confirm-handover'].forEach((action) => {
  assert(!pfosHtml.includes(`data-factory-water-soluble-action="${action}"`), `无可信工厂 session 时 PFOS 不得渲染领域动作 ${action}`)
})
assert(!pfosHtml.includes('需先水溶'), 'PFOS 独立水溶页不得混入含水溶染色单')

const inertTarget = { closest: () => null } as unknown as HTMLElement
assert.equal(handleProcessWaterSolubleOrdersEvent(inertTarget), false, 'FCS handler 应忽略无关事件')
assert.equal(handleCraftDyeingWaterSolubleOrdersEvent(inertTarget), false, 'PFOS handler 应忽略无关事件')

const pending = listWaterSolubleWorkOrders().find((order) => order.status === 'WAIT_FACTORY_ASSIGNMENT')
assert(pending, '演示数据必须保留待分配染厂场景')
const blocked = assignWaterSolubleFactory(pending.waterOrderId, 'NOT-A-FACTORY')
assert.equal(blocked.ok, false, '分配不存在染厂必须由领域拦截')
assert(blocked.message.includes('未找到工厂'), '领域拦截必须是中文可操作提示')
assert.equal(WATER_SOLUBLE_STATUS_LABEL[pending.status], '待分配染厂')

const memoryStorage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => memoryStorage.set(key, value),
    removeItem: (key: string) => memoryStorage.delete(key),
  },
})
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: { querySelector: () => null },
})

function actionTarget(action: string, orderId: string, overlayToken = ''): HTMLElement {
  const actionNode = { dataset: { factoryWaterSolubleAction: action, orderId, overlayToken } }
  return { closest: (selector: string) => selector === '[data-factory-water-soluble-action]' ? actionNode : null } as unknown as HTMLElement
}

function getOverlayToken(action: string): string {
  const html = renderCraftDyeingWaterSolubleOrdersPage()
  const token = html.match(new RegExp(`data-factory-water-soluble-action="${action}"[^>]*data-overlay-token="([^"]+)"`))?.[1]
  assert(token, `缺少 ${action} overlay token`)
  return token
}

function fieldTarget(field: string, value: string): HTMLElement {
  const fieldNode = { dataset: { factoryWaterSolubleField: field }, value }
  return { closest: (selector: string) => selector === '[data-factory-water-soluble-field]' ? fieldNode : null } as unknown as HTMLElement
}

function arrangeTrustedInProgressOrder() {
  resetWaterSolubleDomainForChecks({ seedDemo: true })
  const order = listWaterSolubleWorkOrders().find((item) => item.status === 'WATER_SOLUBLE_IN_PROGRESS' && item.factoryId)
  assert(order?.factoryId, '确定性 seed 必须包含已归属工厂的水溶中加工单')
  const user = listFactoryPdaUsers(order.factoryId).find((item) => item.status === 'ACTIVE')
  assert(user, '确定性 seed 工厂必须有可用 PDA 用户')
  memoryStorage.set('fcs_pda_session', JSON.stringify(createPdaSessionFromUser(user)))
  closeCraftDyeingWaterSolubleOverlay()
  return order
}

const invalidOrder = arrangeTrustedInProgressOrder()
const invalidBefore = getWaterSolubleWorkOrderById(invalidOrder.waterOrderId)
handleCraftDyeingWaterSolubleOrdersEvent(actionTarget('complete', invalidOrder.waterOrderId))
handleCraftDyeingWaterSolubleOrdersEvent(fieldTarget('completedQty', 'Infinity'))
handleCraftDyeingWaterSolubleOrdersEvent(actionTarget('confirm-completion', invalidOrder.waterOrderId, getOverlayToken('confirm-completion')))
assert.deepEqual(getWaterSolubleWorkOrderById(invalidOrder.waterOrderId), invalidBefore, 'handler 必须在调用领域前阻断 Infinity')
handleCraftDyeingWaterSolubleOrdersEvent(fieldTarget('completedQty', '0'))
handleCraftDyeingWaterSolubleOrdersEvent(actionTarget('confirm-completion', invalidOrder.waterOrderId, getOverlayToken('confirm-completion')))
assert.deepEqual(getWaterSolubleWorkOrderById(invalidOrder.waterOrderId), invalidBefore, 'handler 必须在调用领域前阻断 0')

const shortOrder = arrangeTrustedInProgressOrder()
handleCraftDyeingWaterSolubleOrdersEvent(actionTarget('complete', shortOrder.waterOrderId))
handleCraftDyeingWaterSolubleOrdersEvent(fieldTarget('completedQty', String(shortOrder.plannedQty - 1)))
handleCraftDyeingWaterSolubleOrdersEvent(fieldTarget('completionReason', 'Node handler 现场短量原因'))
handleCraftDyeingWaterSolubleOrdersEvent(actionTarget('confirm-completion', shortOrder.waterOrderId, getOverlayToken('confirm-completion')))
const shortUpdated = getWaterSolubleWorkOrderById(shortOrder.waterOrderId)
assert.equal(shortUpdated?.status, 'PRODUCTION_PAUSED', 'handler 短量有原因后必须进入生产暂停')
assert.equal(shortUpdated?.exceptionReason, 'Node handler 现场短量原因', 'handler 必须保存用户输入的真实短量原因')
assert(shortUpdated?.actionLogs.at(-1)?.detail.includes('Node handler 现场短量原因'), 'handler 短量日志必须保留真实原因')

const overOrder = arrangeTrustedInProgressOrder()
const overBefore = getWaterSolubleWorkOrderById(overOrder.waterOrderId)
handleCraftDyeingWaterSolubleOrdersEvent(actionTarget('complete', overOrder.waterOrderId))
handleCraftDyeingWaterSolubleOrdersEvent(fieldTarget('completedQty', String(overOrder.plannedQty + 1)))
handleCraftDyeingWaterSolubleOrdersEvent(fieldTarget('completionReason', 'Node handler 超量复尺原因'))
handleCraftDyeingWaterSolubleOrdersEvent(actionTarget('confirm-completion', overOrder.waterOrderId, getOverlayToken('confirm-completion')))
assert.deepEqual(getWaterSolubleWorkOrderById(overOrder.waterOrderId), overBefore, 'handler 超量首次确认只能打开二次确认，不得写领域')
handleCraftDyeingWaterSolubleOrdersEvent(actionTarget('cancel-completion-overage', overOrder.waterOrderId))
assert.deepEqual(getWaterSolubleWorkOrderById(overOrder.waterOrderId), overBefore, 'handler 取消超量确认不得产生副作用')
handleCraftDyeingWaterSolubleOrdersEvent(actionTarget('confirm-completion', overOrder.waterOrderId, getOverlayToken('confirm-completion')))
handleCraftDyeingWaterSolubleOrdersEvent(actionTarget('confirm-completion-overage', overOrder.waterOrderId, getOverlayToken('confirm-completion-overage')))
const overUpdated = getWaterSolubleWorkOrderById(overOrder.waterOrderId)
assert.equal(overUpdated?.status, 'WAIT_HANDOVER', 'handler 超量二次确认后必须进入待交出')
assert.equal(overUpdated?.exceptionReason, 'Node handler 超量复尺原因', 'handler 必须保存用户输入的真实超量原因')

const injectedOverOrder = arrangeTrustedInProgressOrder()
const injectedOverBefore = getWaterSolubleWorkOrderById(injectedOverOrder.waterOrderId)
handleCraftDyeingWaterSolubleOrdersEvent(actionTarget('complete', injectedOverOrder.waterOrderId))
handleCraftDyeingWaterSolubleOrdersEvent(fieldTarget('completedQty', String(injectedOverOrder.plannedQty + 1)))
handleCraftDyeingWaterSolubleOrdersEvent(fieldTarget('completionReason', '直接注入超量确认'))
handleCraftDyeingWaterSolubleOrdersEvent(actionTarget('confirm-completion-overage', injectedOverOrder.waterOrderId))
assert.deepEqual(getWaterSolubleWorkOrderById(injectedOverOrder.waterOrderId), injectedOverBefore, '未进入超量确认 overlay 时不得注入最终确认动作')

const pausedOrder = listWaterSolubleWorkOrders().find((item) => item.status === 'PRODUCTION_PAUSED' && item.factoryId === injectedOverOrder.factoryId)
assert(pausedOrder, '确定性 seed 必须包含同厂生产暂停加工单')
const pausedBefore = getWaterSolubleWorkOrderById(pausedOrder.waterOrderId)
const injectedSupervisorTarget = actionTarget('confirm-supervisor-decision', pausedOrder.waterOrderId)
const injectedSupervisorNode = injectedSupervisorTarget.closest('[data-factory-water-soluble-action]') as unknown as { dataset: Record<string, string> }
injectedSupervisorNode.dataset.decision = 'CONTINUE_PROCESSING'
handleCraftDyeingWaterSolubleOrdersEvent(injectedSupervisorTarget)
assert.deepEqual(getWaterSolubleWorkOrderById(pausedOrder.waterOrderId), pausedBefore, '未进入主管二次确认 overlay 时不得注入最终决定')

resetWaterSolubleDomainForChecks({ seedDemo: true })
const assignableOrder = listWaterSolubleWorkOrders().find((item) => item.status === 'WAIT_FACTORY_ASSIGNMENT')
assert(assignableOrder, '确定性 seed 必须保留待分配染厂加工单')
const fcsActionNode = { dataset: { waterSolubleAction: 'open-assign', orderId: assignableOrder.waterOrderId } }
handleProcessWaterSolubleOrdersEvent({ closest: (selector: string) => selector === '[data-water-soluble-action]' ? fcsActionNode : null } as unknown as HTMLElement)
const assignHtml = renderProcessWaterSolubleOrdersPage()
const assignOptionsHtml = assignHtml.match(/<select[^>]*data-water-soluble-field="assignFactoryId"[^>]*>([\s\S]*?)<\/select>/)?.[1] || ''
const renderedFactoryIds = [...assignOptionsHtml.matchAll(/<option value="([^"]+)">/g)].map((match) => match[1]).filter(Boolean)
const assignableFactoryIds = listBusinessFactoryMasterRecords({ includeTestFactories: true })
  .filter((factory) => canAssignWaterSolubleFactory(factory.id).ok)
  .map((factory) => factory.id)
assert(assignableFactoryIds.every((factoryId) => renderedFactoryIds.includes(factoryId)), 'FCS 派厂抽屉必须展示全部可派水溶染厂')
assert(renderedFactoryIds.every((factoryId) => assignableFactoryIds.includes(factoryId)), 'FCS 派厂抽屉不得展示不可派或无水溶能力工厂')

console.log('water-soluble pages check passed')
