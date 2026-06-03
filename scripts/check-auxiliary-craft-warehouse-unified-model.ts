import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
  listFactoryWarehouseInboundRecords,
  listFactoryWarehouseNodeRows,
  listFactoryWarehouseOutboundRecords,
} from '../src/data/fcs/factory-internal-warehouse.ts'
import { listAuxiliaryCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'
import {
  renderSpecialCraftDomainWaitHandoverWarehousePage,
  renderSpecialCraftDomainWaitProcessWarehousePage,
} from '../src/pages/process-factory/special-craft/warehouse.ts'
import { appStore } from '../src/state/store.ts'

const repoRoot = process.cwd()
const src = (path: string) => readFileSync(resolve(repoRoot, path), 'utf8')

const auxiliaryTasks = listAuxiliaryCraftTaskOrders()
assert.ok(auxiliaryTasks.length >= 9, `辅助工艺加工单 mock 数据不足：${auxiliaryTasks.length}`)

const auxiliaryFactoryIds = new Set(auxiliaryTasks.map((task) => task.factoryId))
const auxiliaryCraftNames = new Set(auxiliaryTasks.map((task) => task.craftName))
const waitProcessItems = listFactoryWaitProcessStockItems().filter(
  (item) => auxiliaryFactoryIds.has(item.factoryId) && Boolean(item.craftName && auxiliaryCraftNames.has(item.craftName)),
)
const waitHandoverItems = listFactoryWaitHandoverStockItems().filter(
  (item) => auxiliaryFactoryIds.has(item.factoryId) && Boolean(item.craftName && auxiliaryCraftNames.has(item.craftName)),
)
const inboundRecords = listFactoryWarehouseInboundRecords().filter(
  (item) => auxiliaryFactoryIds.has(item.factoryId) && Boolean(item.craftName && auxiliaryCraftNames.has(item.craftName)),
)
const outboundRecords = listFactoryWarehouseOutboundRecords().filter(
  (item) => auxiliaryFactoryIds.has(item.factoryId) && Boolean(item.craftName && auxiliaryCraftNames.has(item.craftName)),
)
const nodeRows = [...auxiliaryFactoryIds].flatMap((factoryId) => listFactoryWarehouseNodeRows(factoryId))

assert.ok(waitProcessItems.length > 0, '辅助工艺待加工仓库存缺失')
assert.ok(waitHandoverItems.length > 0, '辅助工艺待交出仓库存缺失')
assert.ok(inboundRecords.length > 0, '辅助工艺接收入仓记录缺失')
assert.ok(outboundRecords.length > 0, '辅助工艺交出记录缺失')
assert.ok(nodeRows.length > 0, '辅助工艺库区库位 mock 数据缺失')

const waitProcessStatuses = new Set(waitProcessItems.map((item) => item.status))
assert.ok(waitProcessStatuses.has('已入待加工仓'), '辅助工艺待加工仓缺少已入待加工仓状态')
assert.ok(waitProcessStatuses.has('差异待处理'), '辅助工艺待加工仓缺少差异待处理状态')

const waitHandoverStatuses = new Set(waitHandoverItems.map((item) => item.status))
for (const status of ['待交出', '已交出', '已回写', '差异', '异议中']) {
  assert.ok(waitHandoverStatuses.has(status), `辅助工艺待交出仓缺少状态：${status}`)
}

appStore.navigate('/fcs/process-factory/special-craft/auxiliary/wait-process-warehouse')
const waitProcessHtml = renderSpecialCraftDomainWaitProcessWarehousePage('auxiliary')
for (const label of ['库存明细', '接收入仓', '加工领料', '回收入仓', '库区库位']) {
  assert.ok(waitProcessHtml.includes(label), `Web 辅助工艺待加工仓缺少：${label}`)
}
assert.ok(!waitProcessHtml.includes('操作规则'), 'Web 辅助工艺待加工仓不应保留旧的操作规则面板')

for (const [action, label] of [
  ['receive', '确认接收入仓'],
  ['process-issue', '确认加工领料'],
  ['return', '确认回收入仓'],
] as const) {
  appStore.navigate(`/fcs/process-factory/special-craft/auxiliary/wait-process-warehouse?warehouseAction=${action}`)
  const actionHtml = renderSpecialCraftDomainWaitProcessWarehousePage('auxiliary')
  assert.ok(actionHtml.includes(label), `Web 辅助工艺待加工仓弹窗缺少：${label}`)
}

appStore.navigate('/fcs/process-factory/special-craft/auxiliary/wait-handover-warehouse')
const waitHandoverHtml = renderSpecialCraftDomainWaitHandoverWarehousePage('auxiliary')
for (const label of ['库存明细', '完工入仓', '交出确认', '交出记录', '库区库位']) {
  assert.ok(waitHandoverHtml.includes(label), `Web 辅助工艺待交出仓缺少：${label}`)
}
assert.ok(!waitHandoverHtml.includes('操作规则'), 'Web 辅助工艺待交出仓不应保留旧的操作规则面板')

appStore.navigate('/fcs/process-factory/special-craft/auxiliary/wait-handover-warehouse?tab=handover')
const waitHandoverRecordHtml = renderSpecialCraftDomainWaitHandoverWarehousePage('auxiliary')
for (const label of ['打印任务交货卡', '打印交出二维码']) {
  assert.ok(waitHandoverRecordHtml.includes(label), `Web 辅助工艺待交出仓交出记录缺少：${label}`)
}
for (const [action, label] of [
  ['finish-inbound', '确认完工入仓'],
  ['handover-confirm', '确认交出'],
] as const) {
  appStore.navigate(`/fcs/process-factory/special-craft/auxiliary/wait-handover-warehouse?warehouseAction=${action}`)
  const actionHtml = renderSpecialCraftDomainWaitHandoverWarehousePage('auxiliary')
  assert.ok(actionHtml.includes(label), `Web 辅助工艺待交出仓弹窗缺少：${label}`)
}

const pdaWarehouseSource = src('src/pages/pda-warehouse.ts')
for (const label of ['isCraftWarehouseRuntime', 'CENTRAL_AUX', '接收入仓', '加工领料', '回收入仓', '完工入仓', '交出确认']) {
  assert.ok(pdaWarehouseSource.includes(label), `PDA 仓管首页缺少辅助工艺入口：${label}`)
}

const pdaWaitProcessSource = src('src/pages/pda-warehouse-wait-process.ts')
for (const label of [
  'renderAuxiliaryWaitProcessPage',
  'confirm-auxiliary-receive',
  'confirm-auxiliary-issue',
  'confirm-auxiliary-return',
  'auxiliary-receive-area',
  'auxiliary-issue-area',
  'auxiliary-return-area',
]) {
  assert.ok(pdaWaitProcessSource.includes(label), `PDA 辅助工艺待加工仓缺少：${label}`)
}

const pdaWaitHandoverSource = src('src/pages/pda-warehouse-wait-handover.ts')
for (const label of [
  'renderAuxiliaryWaitHandoverPage',
  'confirm-auxiliary-finish',
  'confirm-auxiliary-handover',
  'auxiliary-finish-area',
  'auxiliary-handover-area',
  'auxiliary-handover-receiver',
]) {
  assert.ok(pdaWaitHandoverSource.includes(label), `PDA 辅助工艺待交出仓缺少：${label}`)
}

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
})
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    location: {
      pathname: '/fcs/pda/warehouse',
      search: '',
    },
  },
})

storage.set('fcs_pda_session', JSON.stringify({
  userId: 'FAC-AUX-EMBROIDERY_admin',
  loginId: 'FAC-AUX-EMBROIDERY_admin',
  userName: '绣花专属工厂_管理员',
  roleId: 'ROLE_ADMIN',
  roleName: '管理员',
  factoryId: 'FAC-AUX-EMBROIDERY',
  factoryName: '绣花专属工厂',
  loggedAt: '2026-06-03 06:50:00',
}))

const pdaWindow = globalThis.window as unknown as { location: { pathname: string; search: string } }
const { renderPdaWarehousePage } = await import('../src/pages/pda-warehouse.ts')
const { renderPdaWarehouseWaitProcessPage } = await import('../src/pages/pda-warehouse-wait-process.ts')
const { renderPdaWarehouseWaitHandoverPage } = await import('../src/pages/pda-warehouse-wait-handover.ts')

const pdaHomeHtml = renderPdaWarehousePage()
for (const label of ['绣花专属工厂', '接收入仓', '加工领料', '回收入仓', '完工入仓', '交出确认']) {
  assert.ok(pdaHomeHtml.includes(label), `PDA 辅助工艺首页渲染缺少：${label}`)
}

pdaWindow.location.pathname = '/fcs/pda/warehouse/wait-process'
pdaWindow.location.search = '?action=receive'
const pdaWaitProcessHtml = renderPdaWarehouseWaitProcessPage()
for (const label of ['接收入仓', '接收数量', '库区', '货架', '库位', '确认接收入仓']) {
  assert.ok(pdaWaitProcessHtml.includes(label), `PDA 辅助工艺接收入仓页渲染缺少：${label}`)
}

pdaWindow.location.pathname = '/fcs/pda/warehouse/wait-handover'
pdaWindow.location.search = '?action=handover-confirm'
const pdaWaitHandoverHtml = renderPdaWarehouseWaitHandoverPage()
for (const label of ['交出确认', '交出数量', '接收方', '库区', '货架', '库位', '确认交出']) {
  assert.ok(pdaWaitHandoverHtml.includes(label), `PDA 辅助工艺交出确认页渲染缺少：${label}`)
}

console.log('辅助工艺 Web/PDA 仓管统一模型验收通过')
console.table({
  auxiliaryTasks: auxiliaryTasks.length,
  waitProcessItems: waitProcessItems.length,
  waitHandoverItems: waitHandoverItems.length,
  inboundRecords: inboundRecords.length,
  outboundRecords: outboundRecords.length,
  nodeRows: nodeRows.length,
})
