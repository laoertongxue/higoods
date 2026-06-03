import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { OWN_WOOL_FACTORY_ID, OWN_WOOL_FACTORY_NAME } from '../src/data/fcs/factory-mock-data.ts'
import {
  listWoolWaitHandoverHandoutRecords,
  listWoolWaitHandoverInboundRecords,
  listWoolWaitProcessReceiptRecords,
  listWoolWaitProcessUsageRecords,
  listWoolWarehouseInventory,
  listWoolWarehouseLocations,
  listWoolWorkOrders,
} from '../src/data/fcs/wool-task-domain.ts'
import {
  renderCraftWoolWaitHandoverWarehousePage,
  renderCraftWoolWaitProcessWarehousePage,
} from '../src/pages/process-factory/wool/warehouse.ts'
import { appStore } from '../src/state/store.ts'

const repoRoot = process.cwd()
const src = (path: string) => readFileSync(resolve(repoRoot, path), 'utf8')

const woolOrders = listWoolWorkOrders()
assert.ok(woolOrders.length > 0, '毛织加工单 mock 数据缺失')
assert.ok(woolOrders.some((order) => order.kind === 'WHOLE_GARMENT'), '毛织加工单缺少整件毛织 mock')
assert.ok(woolOrders.some((order) => order.kind === 'PART_PANEL'), '毛织加工单缺少部位毛织片 mock')

const waitProcessInventory = listWoolWarehouseInventory('wait-process')
const waitHandoverInventory = listWoolWarehouseInventory('wait-handover')
assert.ok(waitProcessInventory.length > 0, '毛织待加工仓库存缺失')
assert.ok(waitHandoverInventory.length > 0, '毛织待交出仓库存缺失')
assert.ok(waitProcessInventory.every((item) => item.inventoryObjectType === '纱线' && item.unit === 'kg'), '毛织待加工仓必须只展示纱线 kg 库存')
assert.ok(waitHandoverInventory.some((item) => item.inventoryObjectType === '整件' && item.unit === '件'), '毛织待交出仓缺少整件毛织件库存')
assert.ok(waitHandoverInventory.some((item) => item.inventoryObjectType === '部位' && item.unit === '片'), '毛织待交出仓缺少部位毛织片库存')

assert.ok(listWoolWaitProcessReceiptRecords().length > 0, '毛织领料入仓记录缺失')
assert.ok(listWoolWaitProcessUsageRecords().length > 0, '毛织加工领料记录缺失')
assert.ok(listWoolWaitHandoverInboundRecords().length > 0, '毛织完工入仓记录缺失')
assert.ok(listWoolWaitHandoverHandoutRecords().length > 0, '毛织交出记录缺失')
assert.ok(listWoolWarehouseLocations('wait-process').length > 0, '毛织待加工仓库区库位缺失')
assert.ok(listWoolWarehouseLocations('wait-handover').length > 0, '毛织待交出仓库区库位缺失')

appStore.navigate('/fcs/craft/wool/wait-process-warehouse')
const waitProcessHtml = renderCraftWoolWaitProcessWarehousePage()
for (const label of ['毛织待加工仓', '领料入仓', '加工领料', '回收入仓', '库存明细', '库区库位', 'PDA 现场扫码']) {
  assert.ok(waitProcessHtml.includes(label), `Web 毛织待加工仓缺少：${label}`)
}
assert.ok(!waitProcessHtml.includes('扫码收货</button>'), 'Web 毛织待加工仓顶部不应再使用“扫码收货”作为功能入口')

appStore.navigate('/fcs/craft/wool/wait-process-warehouse?tab=returns')
const returnsHtml = renderCraftWoolWaitProcessWarehousePage()
assert.ok(returnsHtml.includes('回收入仓记录'), 'Web 毛织待加工仓缺少回收入仓记录 Tab')

appStore.navigate('/fcs/craft/wool/wait-handover-warehouse')
const waitHandoverHtml = renderCraftWoolWaitHandoverWarehousePage()
for (const label of ['毛织待交出仓', '完工入仓', '交出确认', '交出记录', '库存明细', '库区库位', 'PDA 现场扫码']) {
  assert.ok(waitHandoverHtml.includes(label), `Web 毛织待交出仓缺少：${label}`)
}

appStore.navigate('/fcs/craft/wool/wait-handover-warehouse?tab=handover-confirm')
const handoverConfirmHtml = renderCraftWoolWaitHandoverWarehousePage()
assert.ok(handoverConfirmHtml.includes('待交出库存'), 'Web 毛织待交出仓缺少交出确认待交出库存列表')
assert.ok(handoverConfirmHtml.includes('交出确认'), 'Web 毛织待交出仓缺少交出确认动作')

const workOrdersSource = src('src/pages/process-factory/wool/work-orders.ts')
for (const label of [
  'openWoolYarnIssueDialog',
  'openWoolFinishInboundDialog',
  'openWoolHandoverConfirmDialog',
  '确认领料入仓',
  '确认加工领料',
  '确认完工入仓',
  '确认交出',
]) {
  assert.ok(workOrdersSource.includes(label), `Web 毛织仓管动作缺少：${label}`)
}

const pdaWarehouseSource = src('src/pages/pda-warehouse.ts')
for (const label of ['isWoolWarehouseRuntime', '领料入仓', '加工领料', '回收入仓', '完工入仓', '交出确认']) {
  assert.ok(pdaWarehouseSource.includes(label), `PDA 仓管首页缺少毛织入口：${label}`)
}

const pdaWaitProcessSource = src('src/pages/pda-warehouse-wait-process.ts')
for (const label of [
  'renderWoolWaitProcessActionPage',
  'confirm-wool-receive',
  'confirm-wool-issue',
  'confirm-wool-return',
  'wool-receive-location',
  'wool-issue-location',
  'wool-return-location',
]) {
  assert.ok(pdaWaitProcessSource.includes(label), `PDA 毛织待加工仓缺少：${label}`)
}

const pdaWaitHandoverSource = src('src/pages/pda-warehouse-wait-handover.ts')
for (const label of [
  'renderWoolWaitHandoverActionPage',
  'confirm-wool-finish-inbound',
  'confirm-wool-handover',
  'wool-finish-location',
  'wool-handover-location',
  'wool-handover-receiver',
]) {
  assert.ok(pdaWaitHandoverSource.includes(label), `PDA 毛织待交出仓缺少：${label}`)
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
  userId: `${OWN_WOOL_FACTORY_ID}_admin`,
  loginId: `${OWN_WOOL_FACTORY_ID}_admin`,
  userName: `${OWN_WOOL_FACTORY_NAME}_管理员`,
  roleId: 'ROLE_ADMIN',
  roleName: '管理员',
  factoryId: OWN_WOOL_FACTORY_ID,
  factoryName: OWN_WOOL_FACTORY_NAME,
  loggedAt: '2026-06-03 09:20:00',
}))

const pdaWindow = globalThis.window as unknown as { location: { pathname: string; search: string } }
const { renderPdaWarehousePage } = await import('../src/pages/pda-warehouse.ts')
const { renderPdaWarehouseWaitProcessPage } = await import('../src/pages/pda-warehouse-wait-process.ts')
const { renderPdaWarehouseWaitHandoverPage } = await import('../src/pages/pda-warehouse-wait-handover.ts')

const pdaHomeHtml = renderPdaWarehousePage()
for (const label of [OWN_WOOL_FACTORY_NAME, '领料入仓', '加工领料', '回收入仓', '完工入仓', '交出确认']) {
  assert.ok(pdaHomeHtml.includes(label), `PDA 毛织首页渲染缺少：${label}`)
}

pdaWindow.location.pathname = '/fcs/pda/warehouse/wait-process'
pdaWindow.location.search = '?action=receive'
const pdaReceiveHtml = renderPdaWarehouseWaitProcessPage()
for (const label of ['领料入仓', '实入重量', '库区库位', '确认领料入仓']) {
  assert.ok(pdaReceiveHtml.includes(label), `PDA 毛织领料入仓页渲染缺少：${label}`)
}

pdaWindow.location.pathname = '/fcs/pda/warehouse/wait-process'
pdaWindow.location.search = '?action=issue'
const pdaIssueHtml = renderPdaWarehouseWaitProcessPage()
for (const label of ['加工领料', '领料重量', '库区库位', '确认加工领料']) {
  assert.ok(pdaIssueHtml.includes(label), `PDA 毛织加工领料页渲染缺少：${label}`)
}

pdaWindow.location.pathname = '/fcs/pda/warehouse/wait-handover'
pdaWindow.location.search = '?action=finish-inbound'
const pdaFinishHtml = renderPdaWarehouseWaitHandoverPage()
for (const label of ['完工入仓', '完工数量', '库区库位', '确认完工入仓']) {
  assert.ok(pdaFinishHtml.includes(label), `PDA 毛织完工入仓页渲染缺少：${label}`)
}

pdaWindow.location.pathname = '/fcs/pda/warehouse/wait-handover'
pdaWindow.location.search = '?action=handover-confirm'
const pdaHandoverHtml = renderPdaWarehouseWaitHandoverPage()
for (const label of ['交出确认', '交出数量', '接收方', '库区库位', '确认交出']) {
  assert.ok(pdaHandoverHtml.includes(label), `PDA 毛织交出确认页渲染缺少：${label}`)
}

console.log('毛织 Web/PDA 仓管统一模型验收通过')
console.table({
  woolOrders: woolOrders.length,
  waitProcessInventory: waitProcessInventory.length,
  waitHandoverInventory: waitHandoverInventory.length,
  waitProcessLocations: listWoolWarehouseLocations('wait-process').length,
  waitHandoverLocations: listWoolWarehouseLocations('wait-handover').length,
})
