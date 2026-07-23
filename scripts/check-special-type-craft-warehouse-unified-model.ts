import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  deriveFactoryItemKind,
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
  listFactoryWarehouseInboundRecords,
  listFactoryWarehouseNodeRows,
  listFactoryWarehouseOutboundRecords,
} from '../src/data/fcs/factory-internal-warehouse.ts'
import { listSpecialTypeCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'
import {
  renderSpecialCraftDomainWaitHandoverWarehousePage,
  renderSpecialCraftDomainWaitProcessWarehousePage,
} from '../src/pages/process-factory/special-craft/warehouse.ts'
import { appStore } from '../src/state/store.ts'

const repoRoot = process.cwd()
const src = (path: string) => readFileSync(resolve(repoRoot, path), 'utf8')

const specialTypeTasks = listSpecialTypeCraftTaskOrders()
assert.ok(specialTypeTasks.length >= 12, `特种工艺加工单 mock 数据不足：${specialTypeTasks.length}`)
assert.ok(specialTypeTasks.some((task) => task.craftName === '橡筋定长切割'), '特种工艺缺少橡筋定长切割 mock')
assert.ok(specialTypeTasks.some((task) => task.craftName === '激光开袋'), '特种工艺缺少激光开袋 mock')
assert.ok(specialTypeTasks.some((task) => task.craftName === '模板工序'), '特种工艺缺少模板工序 mock')

const specialFactoryIds = new Set(specialTypeTasks.map((task) => task.factoryId))
const specialCraftNames = new Set(specialTypeTasks.map((task) => task.craftName))
const allWaitProcessItems = listFactoryWaitProcessStockItems()
const allWaitHandoverItems = listFactoryWaitHandoverStockItems()
const allInboundRecords = listFactoryWarehouseInboundRecords()
const allOutboundRecords = listFactoryWarehouseOutboundRecords()
const waitProcessItems = allWaitProcessItems.filter(
  (item) => specialFactoryIds.has(item.factoryId) && Boolean(item.craftName && specialCraftNames.has(item.craftName)),
)
const waitHandoverItems = allWaitHandoverItems.filter(
  (item) => specialFactoryIds.has(item.factoryId) && Boolean(item.craftName && specialCraftNames.has(item.craftName)),
)
const inboundRecords = allInboundRecords.filter(
  (item) => specialFactoryIds.has(item.factoryId) && Boolean(item.craftName && specialCraftNames.has(item.craftName)),
)
const outboundRecords = allOutboundRecords.filter(
  (item) => specialFactoryIds.has(item.factoryId) && Boolean(item.craftName && specialCraftNames.has(item.craftName)),
)
const nodeRows = [...specialFactoryIds].flatMap((factoryId) => listFactoryWarehouseNodeRows(factoryId))
const currentWarehouseOutputs = [
  ...waitProcessItems,
  ...waitHandoverItems,
  ...inboundRecords,
  ...outboundRecords,
  ...nodeRows,
]

assert.ok(waitProcessItems.length > 0, '特种工艺待加工仓库存缺失')
assert.ok(waitHandoverItems.length > 0, '特种工艺待交出仓库存缺失')
assert.ok(inboundRecords.length > 0, '特种工艺接收入仓记录缺失')
assert.ok(outboundRecords.length > 0, '特种工艺交出记录缺失')
assert.ok(nodeRows.length > 0, '特种工艺库区库位 mock 数据缺失')
assert.equal(
  deriveFactoryItemKind({ handoutObjectType: 'GARMENT', partName: '成衣包' }),
  '成衣',
  '正式成衣对象必须优先于部位名称归类为成衣',
)
assert.equal(
  deriveFactoryItemKind({ handoutObjectType: 'SEMI_FINISHED_GARMENT', partName: '成衣包' }),
  '成衣',
  '兼容成衣对象必须归一为成衣',
)
const garmentInboundRecords = allInboundRecords.filter((item) => item.partName === '成衣包')
assert.ok(garmentInboundRecords.length > 0, '缺少成衣交出接收入库投影')
assert.ok(
  garmentInboundRecords.every((item) => item.itemKind === '成衣' && item.unit === '件'),
  '成衣交出接收入库投影必须按成衣、件记录',
)
const garmentInboundSourceIds = new Set(garmentInboundRecords.map((item) => item.sourceRecordId))
const garmentWaitProcessItems = allWaitProcessItems.filter((item) => garmentInboundSourceIds.has(item.sourceRecordId))
assert.equal(garmentWaitProcessItems.length, garmentInboundRecords.length, '成衣接收入库必须形成对应待加工库存')
assert.ok(
  garmentWaitProcessItems.every((item) => item.itemKind === '成衣' && item.unit === '件'),
  '成衣待加工库存必须按成衣、件记录',
)
const garmentWaitHandoverItems = allWaitHandoverItems.filter((item) => item.partName === '毛织整件')
assert.ok(garmentWaitHandoverItems.length > 0, '缺少成衣交出待交出库存投影')
assert.ok(
  garmentWaitHandoverItems.every((item) => item.itemKind === '成衣' && item.unit === '件'),
  '成衣待交出库存必须按成衣、件记录',
)
assert.ok(
  !JSON.stringify(currentWarehouseOutputs).includes('成衣半成品'),
  '当前仓储投影不得输出旧标签“成衣半成品”',
)
assert.ok(
  !src('src/data/fcs/factory-internal-warehouse.ts').includes("| '成衣半成品'"),
  '仓储正式物料类型不得继续暴露旧标签“成衣半成品”',
)
assert.ok(
  !src('src/pages/pda-handover-detail.ts').includes("? '成衣半成品'"),
  'PDA 交接当前写入不得继续输出旧标签“成衣半成品”',
)

assert.ok(
  [...waitProcessItems, ...waitHandoverItems].some((item) => item.itemName === '定长橡筋' && item.itemKind === '辅料' && item.unit === '条'),
  '特种工艺缺少辅料类定长橡筋库存 mock',
)
assert.ok(waitHandoverItems.some((item) => item.unit === '片'), '特种工艺待交出仓缺少按片库存 mock')

const waitProcessStatuses = new Set(waitProcessItems.map((item) => item.status))
assert.ok(waitProcessStatuses.has('已入待加工仓'), '特种工艺待加工仓缺少已入待加工仓状态')
assert.ok(waitProcessStatuses.has('差异待处理'), '特种工艺待加工仓缺少差异待处理状态')

const waitHandoverStatuses = new Set(waitHandoverItems.map((item) => item.status))
for (const status of ['待交出', '已交出', '已回写', '差异', '异议中']) {
  assert.ok(waitHandoverStatuses.has(status), `特种工艺待交出仓缺少状态：${status}`)
}

appStore.navigate('/fcs/process-factory/special-craft/special-type/wait-process-warehouse')
const waitProcessHtml = renderSpecialCraftDomainWaitProcessWarehousePage('special-type')
for (const label of ['特种工艺待加工仓', '库存明细', '接收入仓', '加工领料', '回收入仓', '库区库位', 'PDA 现场扫码']) {
  assert.ok(waitProcessHtml.includes(label), `Web 特种工艺待加工仓缺少：${label}`)
}
assert.ok(!waitProcessHtml.includes('操作规则'), 'Web 特种工艺待加工仓不应保留旧的操作规则面板')
assert.ok(!waitProcessHtml.includes('库存</button>'), 'Web 特种工艺待加工仓不应使用旧的“库存”Tab')
assert.ok(!waitProcessHtml.includes('入仓记录</button>'), 'Web 特种工艺待加工仓不应使用旧的“入仓记录”Tab')

for (const [action, label] of [
  ['receive', '确认接收入仓'],
  ['process-issue', '确认加工领料'],
  ['return', '确认回收入仓'],
] as const) {
  appStore.navigate(`/fcs/process-factory/special-craft/special-type/wait-process-warehouse?warehouseAction=${action}`)
  const actionHtml = renderSpecialCraftDomainWaitProcessWarehousePage('special-type')
  assert.ok(actionHtml.includes(label), `Web 特种工艺待加工仓弹窗缺少：${label}`)
  if (action === 'receive') {
    assert.ok(actionHtml.includes('特种工艺仓管'), `Web 特种工艺待加工仓弹窗接收人默认值错误：${label}`)
  }
}

appStore.navigate('/fcs/process-factory/special-craft/special-type/wait-handover-warehouse')
const waitHandoverHtml = renderSpecialCraftDomainWaitHandoverWarehousePage('special-type')
for (const label of ['特种工艺待交出仓', '库存明细', '完工入仓', '交出确认', '交出记录', '库区库位', 'PDA 现场扫码']) {
  assert.ok(waitHandoverHtml.includes(label), `Web 特种工艺待交出仓缺少：${label}`)
}
assert.ok(!waitHandoverHtml.includes('操作规则'), 'Web 特种工艺待交出仓不应保留旧的操作规则面板')

appStore.navigate('/fcs/process-factory/special-craft/special-type/wait-handover-warehouse?tab=handover')
const waitHandoverRecordHtml = renderSpecialCraftDomainWaitHandoverWarehousePage('special-type')
for (const label of ['打印任务交货卡', '打印交出二维码']) {
  assert.ok(waitHandoverRecordHtml.includes(label), `Web 特种工艺待交出仓交出记录缺少：${label}`)
}

for (const [action, label] of [
  ['finish-inbound', '确认完工入仓'],
  ['handover-confirm', '确认交出'],
] as const) {
  appStore.navigate(`/fcs/process-factory/special-craft/special-type/wait-handover-warehouse?warehouseAction=${action}`)
  const actionHtml = renderSpecialCraftDomainWaitHandoverWarehousePage('special-type')
  assert.ok(actionHtml.includes(label), `Web 特种工艺待交出仓弹窗缺少：${label}`)
}

const pdaWarehouseSource = src('src/pages/pda-warehouse.ts')
for (const label of ['CENTRAL_SPECIAL', '接收入仓', '加工领料', '回收入仓', '完工入仓', '交出确认']) {
  assert.ok(pdaWarehouseSource.includes(label), `PDA 仓管首页缺少特种工艺入口：${label}`)
}

const pdaWaitProcessSource = src('src/pages/pda-warehouse-wait-process.ts')
for (const label of [
  'listSpecialTypeCraftTaskOrders',
  '特种工艺',
  'confirm-auxiliary-receive',
  'confirm-auxiliary-issue',
  'confirm-auxiliary-return',
  'auxiliary-receive-area',
  'auxiliary-issue-area',
  'auxiliary-return-area',
]) {
  assert.ok(pdaWaitProcessSource.includes(label), `PDA 特种工艺待加工仓缺少：${label}`)
}

const pdaWaitHandoverSource = src('src/pages/pda-warehouse-wait-handover.ts')
for (const label of [
  'listSpecialTypeCraftTaskOrders',
  '特种工艺',
  'confirm-auxiliary-finish',
  'confirm-auxiliary-handover',
  'auxiliary-finish-area',
  'auxiliary-handover-area',
  'auxiliary-handover-receiver',
]) {
  assert.ok(pdaWaitHandoverSource.includes(label), `PDA 特种工艺待交出仓缺少：${label}`)
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
  userId: 'FAC-SPC-TEMPLATE-PROCESS_admin',
  loginId: 'FAC-SPC-TEMPLATE-PROCESS_admin',
  userName: '模板工序专属工厂_管理员',
  roleId: 'ROLE_ADMIN',
  roleName: '管理员',
  factoryId: 'FAC-SPC-TEMPLATE-PROCESS',
  factoryName: '模板工序专属工厂',
  loggedAt: '2026-06-03 09:20:00',
}))

const pdaWindow = globalThis.window as unknown as { location: { pathname: string; search: string } }
const { renderPdaWarehousePage } = await import('../src/pages/pda-warehouse.ts')
const { renderPdaWarehouseWaitProcessPage } = await import('../src/pages/pda-warehouse-wait-process.ts')
const { renderPdaWarehouseWaitHandoverPage } = await import('../src/pages/pda-warehouse-wait-handover.ts')

const pdaHomeHtml = renderPdaWarehousePage()
for (const label of ['模板工序专属工厂', '接收入仓', '加工领料', '回收入仓', '完工入仓', '交出确认']) {
  assert.ok(pdaHomeHtml.includes(label), `PDA 特种工艺首页渲染缺少：${label}`)
}

pdaWindow.location.pathname = '/fcs/pda/warehouse/wait-process'
pdaWindow.location.search = '?action=receive'
const pdaWaitProcessHtml = renderPdaWarehouseWaitProcessPage()
for (const label of ['接收入仓', '接收数量', '库区', '货架', '库位', '确认接收入仓']) {
  assert.ok(pdaWaitProcessHtml.includes(label), `PDA 特种工艺接收入仓页渲染缺少：${label}`)
}

pdaWindow.location.pathname = '/fcs/pda/warehouse/wait-process'
pdaWindow.location.search = '?action=issue'
const pdaIssueHtml = renderPdaWarehouseWaitProcessPage()
for (const label of ['加工领料', '领料数量', '库区', '货架', '库位', '确认加工领料']) {
  assert.ok(pdaIssueHtml.includes(label), `PDA 特种工艺加工领料页渲染缺少：${label}`)
}

pdaWindow.location.pathname = '/fcs/pda/warehouse/wait-handover'
pdaWindow.location.search = '?action=finish-inbound'
const pdaFinishHtml = renderPdaWarehouseWaitHandoverPage()
for (const label of ['完工入仓', '完工数量', '损耗数量', '库区', '货架', '库位', '确认完工入仓']) {
  assert.ok(pdaFinishHtml.includes(label), `PDA 特种工艺完工入仓页渲染缺少：${label}`)
}

pdaWindow.location.pathname = '/fcs/pda/warehouse/wait-handover'
pdaWindow.location.search = '?action=handover-confirm'
const pdaHandoverHtml = renderPdaWarehouseWaitHandoverPage()
for (const label of ['交出确认', '交出数量', '接收方', '库区', '货架', '库位', '确认交出']) {
  assert.ok(pdaHandoverHtml.includes(label), `PDA 特种工艺交出确认页渲染缺少：${label}`)
}

console.log('特种工艺 Web/PDA 仓管统一模型验收通过')
console.table({
  specialTypeTasks: specialTypeTasks.length,
  waitProcessItems: waitProcessItems.length,
  waitHandoverItems: waitHandoverItems.length,
  inboundRecords: inboundRecords.length,
  outboundRecords: outboundRecords.length,
  nodeRows: nodeRows.length,
})
