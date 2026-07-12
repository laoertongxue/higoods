import assert from 'node:assert/strict'
import { getRuntimeTaskById } from '../src/data/fcs/runtime-process-tasks.ts'
import { getFactoryMasterRecordById } from '../src/data/fcs/factory-master-store.ts'
import { listProductionOrderSewingFactories, productionOrders } from '../src/data/fcs/production-orders.ts'
import {
  authenticateFactoryPdaUserByLoginId,
  createPdaSessionFromUser,
  listFactoryPdaUsers,
  setPdaSession,
} from '../src/data/fcs/store-domain-pda.ts'
import {
  handlePdaTaskReceiveEvent,
  listPdaAwardedTendersForFactory,
  renderPdaTaskReceivePage,
} from '../src/pages/pda-task-receive.ts'
import { appStore } from '../src/state/store.ts'

const FACTORY_ID = 'ID-F021'
const TASK_ID = 'TASKGEN-202603-083-002__ORDER'
const PRODUCTION_ORDER_ID = 'PO-202603-083'

const storageValues = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storageValues.get(key) ?? null,
    setItem: (key: string, value: string) => storageValues.set(key, value),
    removeItem: (key: string) => storageValues.delete(key),
  },
})

const factory = getFactoryMasterRecordById(FACTORY_ID)
assert.ok(factory, '中标工厂必须来自当前工厂主档')
assert.equal(factory.status, 'active', '中标工厂主档必须为 ACTIVE')
assert.match(factory.factoryType, /SEWING/, '中标工厂类型必须为 SEWING')
const adminLoginId = `${FACTORY_ID}_admin`
assert.ok(listFactoryPdaUsers(FACTORY_ID).some((user) => user.loginId === adminLoginId), '中标工厂必须存在 PDA 管理员账号')
assert.ok(authenticateFactoryPdaUserByLoginId(adminLoginId).user, '中标工厂管理员账号必须能被登录认证解析')
const admin = authenticateFactoryPdaUserByLoginId(adminLoginId).user
assert.ok(admin)

const seededTask = getRuntimeTaskById(TASK_ID)
assert.ok(seededTask, '稳定原型任务必须进入统一运行时任务仓')
assert.equal(seededTask.taskUnitType, 'SINGLE_PROCESS_TASK', '稳定原型必须复用独立车缝任务')
assert.ok(seededTask.coveredProcesses?.some((process) => process.processCode === 'SEW'), '稳定原型必须覆盖车缝')
assert.equal(seededTask.assignmentMode, 'BIDDING', '稳定原型必须来自竞价分配')
assert.equal(seededTask.assignmentStatus, 'AWARDED', '稳定原型必须已中标')
assert.equal(seededTask.assignedFactoryId, FACTORY_ID, '稳定原型必须归属明确的中标工厂')
assert.equal(seededTask.acceptanceStatus, 'PENDING', '中标后必须等待工厂确认接单')

const awardedPreview = listPdaAwardedTendersForFactory(FACTORY_ID)
  .find((item) => item.taskId === TASK_ID)
assert.ok(awardedPreview, '中标工厂的已中标任务必须展示稳定原型')
assert.equal(awardedPreview.execStatus, '待接单', '已中标任务预览必须展示确认接单状态')
assert.equal(awardedPreview.tenderId, seededTask.tenderId, 'PDA 预览必须复用运行时竞价单号')

setPdaSession(createPdaSessionFromUser(admin))
appStore.navigate('/fcs/pda/task-receive?tab=awarded')
class FakeInputElement {}
class FakeSelectElement {}
class FakeTextAreaElement {}
Object.defineProperty(globalThis, 'HTMLInputElement', { configurable: true, value: FakeInputElement })
Object.defineProperty(globalThis, 'HTMLSelectElement', { configurable: true, value: FakeSelectElement })
Object.defineProperty(globalThis, 'HTMLTextAreaElement', { configurable: true, value: FakeTextAreaElement })
const actionTarget = (action: string, dataset: Record<string, string> = {}) => ({
  closest(selector: string) {
    if (selector === '[data-pda-tr-field]') return null
    if (selector === '[data-pda-tr-action]') return { dataset: { pdaTrAction: action, ...dataset } }
    return null
  },
} as unknown as HTMLElement)
handlePdaTaskReceiveEvent(actionTarget('switch-tab', { tab: 'awarded' }))
const awardedPageHtml = renderPdaTaskReceivePage()
const awardedCardHtml = awardedPageHtml.match(new RegExp(`<article[^>]*>[\\s\\S]*?${seededTask.tenderId}[\\s\\S]*?</article>`))?.[0] ?? ''
assert.match(awardedCardHtml, /data-pda-tr-action="accept-task"[\s\S]*>确认接单</, '已中标待接单卡必须展示确认接单入口')
assert.doesNotMatch(awardedCardHtml, />\s*去执行\s*</, '未确认接单前不得展示去执行')

const mainFactoryBeforeAcceptance = productionOrders.find((order) => order.productionOrderId === PRODUCTION_ORDER_ID)?.mainFactoryId
assert.equal(mainFactoryBeforeAcceptance, FACTORY_ID, '含车缝竞价中标后必须已确定生产单唯一主工厂')
handlePdaTaskReceiveEvent(actionTarget('accept-task', { taskId: TASK_ID }))
assert.equal(getRuntimeTaskById(TASK_ID)?.acceptanceStatus, 'PENDING', '打开确认预览不得提前写入接单状态')
const acceptPreviewHtml = renderPdaTaskReceivePage()
assert.match(acceptPreviewHtml, /data-pda-tr-accept-dialog="true"[\s\S]*确认接单时间/, '点击确认接单入口必须先打开时间预览')
assert.doesNotMatch(acceptPreviewHtml.match(/data-pda-tr-accept-dialog="true"[\s\S]*$/)?.[0] ?? '', /PIECE/, '确认弹窗不得直接展示英文数量单位')
assert.match(acceptPreviewHtml, /4100 件/, '确认弹窗必须使用中文成衣数量单位')
assert.match(acceptPreviewHtml, new RegExp(`data-pda-tr-action="confirm-accept-task"[^>]*data-task-id="${TASK_ID}"`), '预览弹窗必须提供二次确认动作')
handlePdaTaskReceiveEvent(actionTarget('confirm-accept-task', { taskId: TASK_ID }))
const accepted = getRuntimeTaskById(TASK_ID)
assert.equal(accepted?.acceptanceStatus, 'ACCEPTED', '二次确认后必须写回统一运行时任务仓')
assert.ok(accepted?.acceptedAt, '二次确认必须记录实际确认时间作为履约起点')
assert.ok(listProductionOrderSewingFactories(PRODUCTION_ORDER_ID).some((item) => item.id === FACTORY_ID), '确认接单工厂必须登记为生产单车缝分配关系')
assert.equal(productionOrders.find((order) => order.productionOrderId === PRODUCTION_ORDER_ID)?.mainFactoryId, mainFactoryBeforeAcceptance, '确认接单不得改变已确定的唯一主工厂')
assert.equal(listPdaAwardedTendersForFactory(FACTORY_ID).find((item) => item.taskId === TASK_ID)?.execStatus, '待开工', '确认后已中标预览必须进入待开工')

console.log('[check-sewing-awarded-pda-seed] PASS')
