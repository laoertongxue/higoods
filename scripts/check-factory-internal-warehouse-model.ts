#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { menusBySystem } from '../src/data/app-shell-config.ts'
import { mockFactories } from '../src/data/fcs/factory-mock-data.ts'
import { listBusinessFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import {
  approveFactoryWarehouseStocktakeDifferenceReview,
  buildDefaultFactoryInternalWarehouses,
  buildInboundRecordFromPickup,
  buildOutboundRecordFromHandoverRecord,
  executeFactoryWarehouseAdjustmentOrder,
  getFactoryWarehouseKindLabel,
  getFactoryWarehouseCurrentQtyByStockItemId,
  listFactoryInternalWarehouses,
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
  listFactoryWarehouseAdjustmentOrders,
  listFactoryWarehouseInboundRecords,
  listFactoryWarehouseOutboundRecords,
  listFactoryWarehouseStocktakeDifferenceReviews,
  listFactoryWarehouseStocktakeOrders,
} from '../src/data/fcs/factory-internal-warehouse.ts'
import { getFactoryWarehouseProgressSnapshots } from '../src/data/fcs/progress-statistics-linkage.ts'
import { getPdaHandoverRecordsByHead, listPdaHandoverHeads } from '../src/data/fcs/pda-handover-events.ts'
import { listWarehouseIssueOrders } from '../src/data/fcs/warehouse-material-execution.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SEWING_FACTORY_TYPES = new Set(['CENTRAL_GARMENT', 'SATELLITE_SEWING', 'THIRD_SEWING'])

function resolveRepoPath(relativePath: string): string {
  return path.join(ROOT, relativePath)
}

function read(relativePath: string): string {
  return fs.readFileSync(resolveRepoPath(relativePath), 'utf8')
}

function joinText(parts: string[]): string {
  return parts.join('')
}

function buildToken(...parts: string[]): string {
  return parts.join('')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function flattenMenuItems(menuGroups: typeof menusBySystem.fcs) {
  return menuGroups.flatMap((group) => group.items).flatMap((item) => item.children || [item])
}

function assertContains(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNoTerms(source: string, terms: string[], message: string): void {
  const pattern = new RegExp(terms.map((term) => escapeRegExp(term)).join('|'))
  assert(!pattern.test(source), message)
}

const dataSource = read('src/data/fcs/factory-internal-warehouse.ts')
const pageSource = read('src/pages/factory-internal-warehouse.ts')
const routeSource = read('src/router/routes-fcs.ts')
const rendererSource = read('src/router/route-renderers-fcs.ts')
const pdaShellSource = read('src/pages/pda-shell.ts')
const linkageSource = read('src/data/fcs/factory-warehouse-linkage.ts')
const handoverDetailSource = read('src/pages/pda-handover-detail.ts')
const specialCraftTaskSource = read('src/data/fcs/special-craft-task-orders.ts')
const specialCraftWarehouseSource = read('src/pages/process-factory/special-craft/warehouse.ts')
const printingWarehouseViewSource = read('src/data/fcs/printing-warehouse-view.ts')
const dyeingWarehouseViewSource = read('src/data/fcs/dyeing-warehouse-view.ts')
const printingWarehousePageSource = read('src/pages/process-factory/printing/warehouse.ts')
const dyeingWarehousePageSource = read('src/pages/process-factory/dyeing/warehouse.ts')
const specialCraftFeiFlowSource = read('src/data/fcs/cutting/special-craft-fei-ticket-flow.ts')
const sewingDispatchSource = read('src/data/fcs/cutting/sewing-dispatch.ts')
const packageSource = read('package.json')
const progressStatisticsSource = read('src/data/fcs/progress-statistics-linkage.ts')

const legacyWarehouseTerms = [joinText(['来', '料仓']), joinText(['半成品', '仓'])]
const noWmsTerms = [
  joinText(['库存', '三态']),
  joinText(['可用', '库存']),
  joinText(['占用', '库存']),
  joinText(['在途', '库存']),
  ['available', 'Stock'].join(''),
  ['occupied', 'Stock'].join(''),
  ['inTransit', 'Stock'].join(''),
  joinText(['上架', '任务']),
  joinText(['拣货', '波次']),
  joinText(['拣货', '路径']),
  joinText(['库位', '规则']),
  joinText(['完整', '库存账']),
  joinText(['完整', '入库']),
]
const noCycleTerms = [joinText(['抽', '盘']), joinText(['循环', '盘'])]

const defaultWarehouses = buildDefaultFactoryInternalWarehouses(mockFactories)
const seededWarehouses = listFactoryInternalWarehouses()
const waitProcessItems = listFactoryWaitProcessStockItems()
const waitHandoverItems = listFactoryWaitHandoverStockItems()
const inboundRecords = listFactoryWarehouseInboundRecords()
const outboundRecords = listFactoryWarehouseOutboundRecords()
const stocktakeOrders = listFactoryWarehouseStocktakeOrders()
const businessFactories = listBusinessFactoryMasterRecords()
const factoryWarehouseSnapshots = getFactoryWarehouseProgressSnapshots()

const nonSewingFactories = mockFactories.filter((factory) => !SEWING_FACTORY_TYPES.has(factory.factoryType))
const sewingFactories = mockFactories.filter((factory) => SEWING_FACTORY_TYPES.has(factory.factoryType))
const testFactories = mockFactories.filter((factory) => factory.isTestFactory)

assertContains(packageSource, 'check:factory-internal-warehouse-model', 'package.json 缺少工厂内部仓检查命令')
assertContains(packageSource, 'check:factory-handover-warehouse-linkage', 'package.json 缺少交接与仓管联动检查命令')
assertContains(packageSource, 'check:special-craft-operation-menus', 'package.json 缺少特殊工艺一级菜单检查命令')
assertContains(packageSource, 'check:process-factory-warehouse-menu-consolidation', 'package.json 缺少 PFOS 仓库菜单收口检查命令')
assertContains(packageSource, 'check:cutting-sewing-dispatch', 'package.json 缺少裁片发料检查命令')

assertContains(dataSource, 'export interface FactoryInternalWarehouse', '缺少工厂内部仓数据模型')
assertContains(dataSource, 'export interface FactoryWaitProcessStockItem', '缺少待加工仓库存明细模型')
assertContains(dataSource, 'export interface FactoryWaitHandoverStockItem', '缺少待交出仓库存明细模型')
assertContains(dataSource, 'export interface FactoryWarehouseInboundRecord', '缺少入库记录模型')
assertContains(dataSource, 'export interface FactoryWarehouseOutboundRecord', '缺少出库记录模型')
assertContains(dataSource, 'export interface FactoryWarehouseStocktakeOrder', '缺少盘点模型')
assertContains(dataSource, 'export interface FactoryWarehouseArea', '缺少库区模型')
assertContains(dataSource, 'export interface FactoryWarehouseShelf', '缺少货架模型')
assertContains(dataSource, 'export interface FactoryWarehouseLocation', '缺少库位模型')
;[
  'listFactoryInternalWarehouses',
  'listFactoryWaitProcessStockItems',
  'listFactoryWaitHandoverStockItems',
  'listFactoryWarehouseInboundRecords',
  'listFactoryWarehouseOutboundRecords',
  'listFactoryWarehouseStocktakeOrders',
  'listFactoryWarehouseNodeRows',
].forEach((token) => {
  assertContains(printingWarehouseViewSource + dyeingWarehouseViewSource, token, `印花/染色仓库视图未复用工厂内部仓底座：${token}`)
})
assertContains(specialCraftTaskSource, 'getSpecialCraftWarehouseView', '特殊工艺仓库页必须继续复用特殊工艺仓库视图')
assertContains(printingWarehousePageSource, 'getPrintingWarehouseView', '印花仓库页未使用印花仓库视图适配层')
assertContains(dyeingWarehousePageSource, 'getDyeingWarehouseView', '染色仓库页未使用染色仓库视图适配层')
;['printWarehouses', 'dyeWarehouses', 'specialCraftWarehouses'].forEach((token) => {
  assert(!printingWarehouseViewSource.includes(token), `印花仓库视图不得新造库存模型：${token}`)
  assert(!dyeingWarehouseViewSource.includes(token), `染色仓库视图不得新造库存模型：${token}`)
  assert(!specialCraftWarehouseSource.includes(token), `特殊工艺仓库页不得新造库存模型：${token}`)
})

assert(defaultWarehouses.length === nonSewingFactories.length * 2, '默认工厂仓库数量应等于非车缝工厂数量的两倍')
assert(testFactories.length === 1, '默认工厂池中只能存在一个测试工厂')
assert(businessFactories.every((factory) => !factory.isTestFactory), '默认业务工厂列表必须排除测试工厂')
assert(!factoryWarehouseSnapshots.some((snapshot) => testFactories.some((factory) => factory.id === snapshot.factoryId)), '默认工厂仓库统计不得混入测试工厂')
nonSewingFactories.forEach((factory) => {
  const warehouseRows = defaultWarehouses.filter((item) => item.factoryId === factory.id)
  assert(warehouseRows.some((item) => item.warehouseKind === 'WAIT_PROCESS'), `${factory.name} 缺少待加工仓`)
  assert(warehouseRows.some((item) => item.warehouseKind === 'WAIT_HANDOVER'), `${factory.name} 缺少待交出仓`)
})
sewingFactories.forEach((factory) => {
  assert(!defaultWarehouses.some((item) => item.factoryId === factory.id), `${factory.name} 不应默认生成工厂内部仓`)
})
assert(defaultWarehouses.every((item) => item.warehouseName.includes(item.warehouseShortName)), '仓库名称应包含仓库短名')
assert(defaultWarehouses.every((item) => getFactoryWarehouseKindLabel(item.warehouseKind) === item.warehouseShortName), '仓库短名与仓库类型标签不一致')
assert(defaultWarehouses.every((item) => item.areaList.length >= 8), '默认仓库必须包含 A-F、异常区、待确认区')
;['A区', 'B区', 'C区', 'D区', 'E区', 'F区', '异常区', '待确认区'].forEach((areaName) => {
  assert(defaultWarehouses.every((warehouse) => warehouse.areaList.some((area) => area.areaName === areaName)), `默认仓库缺少库区：${areaName}`)
})
assert(defaultWarehouses.every((item) => item.areaList.every((area) => area.shelfList.length > 0)), '默认库区缺少货架')
assert(
  defaultWarehouses.every((item) => item.areaList.every((area) => area.shelfList.every((shelf) => shelf.locationList.length > 0))),
  '默认货架缺少库位',
)

assert(seededWarehouses.length >= defaultWarehouses.length, '种子仓库数据未初始化')
assert(seededWarehouses.some((item) => item.warehouseKind === 'WAIT_PROCESS'), '缺少待加工仓种子数据')
assert(seededWarehouses.some((item) => item.warehouseKind === 'WAIT_HANDOVER'), '缺少待交出仓种子数据')
assert(!seededWarehouses.some((item) => SEWING_FACTORY_TYPES.has(item.factoryKind)), '车缝厂不应存在工厂内部仓种子数据')
assert(!sewingDispatchSource.includes(buildToken('车', '缝厂', ' · ', '待加工仓')), `裁片发料不应为${buildToken('车', '缝')}接收方生成${buildToken('待加工', '仓')}`)
assert(!sewingDispatchSource.includes(buildToken('车', '缝厂', ' · ', '待交出仓')), `裁片发料不应为${buildToken('车', '缝')}接收方生成${buildToken('待交出', '仓')}`)
assert(!sewingDispatchSource.includes('sewingFactoryWarehouse'), `裁片发料不应为${buildToken('车', '缝')}接收方生成内部仓`)

assert(waitProcessItems.length > 0, '缺少待加工仓库存明细')
assert(waitHandoverItems.length > 0, '缺少待交出仓库存明细')
assert(inboundRecords.length > 0, '缺少入库记录')
assert(outboundRecords.length > 0, '缺少出库记录')
assert(stocktakeOrders.length > 0, '缺少盘点记录')
assertContains(dataSource, 'FactoryWarehouseStocktakeDifferenceReview', '缺少盘点差异审核模型')
assertContains(dataSource, 'FactoryWarehouseAdjustmentOrder', '缺少盘点调整单模型')
assertContains(dataSource, 'approveFactoryWarehouseStocktakeDifferenceReview', '缺少盘点差异审核通过 helper')
assertContains(dataSource, 'executeFactoryWarehouseAdjustmentOrder', '缺少调整单执行 helper')
const review = listFactoryWarehouseStocktakeDifferenceReviews().find((item) => item.reviewStatus === '待审核')
assert(review, '缺少待审核盘点差异样例')
const adjustmentOrder = approveFactoryWarehouseStocktakeDifferenceReview({
  reviewId: review!.reviewId,
  reviewedBy: '检查脚本',
  reviewRemark: '工厂内部仓检查生成调整单',
})
assert(adjustmentOrder, '审核通过后必须生成调整单')
assert(listFactoryWarehouseAdjustmentOrders().some((item) => item.adjustmentOrderId === adjustmentOrder!.adjustmentOrderId), '调整单未进入列表')
const executedAdjustment = executeFactoryWarehouseAdjustmentOrder({
  adjustmentOrderId: adjustmentOrder!.adjustmentOrderId,
  executedBy: '检查脚本',
  remark: '工厂内部仓检查执行调整单',
})
assert(executedAdjustment?.status === '已完成', '执行调整单后状态必须为已完成')
assert.equal(getFactoryWarehouseCurrentQtyByStockItemId(review!.stockItemId), review!.countedQty, '执行调整单后轻量库存数量未更新')

assert(waitProcessItems.every((item) => item.warehouseName.includes('待加工仓')), '待加工仓库存未落入待加工仓')
assert(waitHandoverItems.every((item) => item.warehouseName.includes('待交出仓')), '待交出仓库存未落入待交出仓')
assert(inboundRecords.every((item) => item.warehouseName.includes('待加工仓')), '入库记录未关联待加工仓')
assert(outboundRecords.every((item) => item.warehouseName.includes('待交出仓')), '出库记录未关联待交出仓')
assert(inboundRecords.some((item) => item.sourceRecordType === 'MATERIAL_PICKUP'), '入库记录缺少领料转单来源')
assert(inboundRecords.some((item) => item.sourceRecordType === 'HANDOVER_RECEIVE'), '入库记录缺少交出接收转单来源')
assert(outboundRecords.every((item) => !!item.handoverOrderNo && !!item.handoverRecordNo && !!item.handoverRecordQrValue), '出库记录必须关联交出单、交出记录与交出二维码')

const pickupDoc = listWarehouseIssueOrders().find((doc) => doc.lines.length > 0)
assert(pickupDoc, '缺少可校验的领料记录样例')
const pickupFactory = nonSewingFactories[0]
assert(pickupFactory && !SEWING_FACTORY_TYPES.has(pickupFactory.factoryType), '领料转单样例未指向非车缝工厂')
const pickupWarehouse = defaultWarehouses.find((item) => item.factoryId === pickupFactory?.id && item.warehouseKind === 'WAIT_PROCESS')
assert(pickupWarehouse, '领料转单样例缺少待加工仓')
const inboundFromPickup = buildInboundRecordFromPickup(pickupDoc!, pickupDoc!.lines[0], pickupFactory!, pickupWarehouse!, 0)
assert(inboundFromPickup.warehouseId === pickupWarehouse?.warehouseId, '领料转单未进入待加工仓')
assert(inboundFromPickup.remark === '由领料记录生成', '领料转单来源文案不正确')

const handoverHead = listPdaHandoverHeads().find(
  (head) =>
    head.headType === 'HANDOUT'
    && getPdaHandoverRecordsByHead(head.handoverId).length > 0
    && !!mockFactories.find((factory) => factory.id === head.factoryId && !SEWING_FACTORY_TYPES.has(factory.factoryType)),
)
assert(handoverHead, '缺少可校验的交出记录样例')
const handoverRecord = getPdaHandoverRecordsByHead(handoverHead!.handoverId)[0]
assert(handoverRecord, '交出记录样例缺少明细')
const sourceFactory = mockFactories.find((factory) => factory.id === handoverHead?.factoryId)
assert(sourceFactory && !SEWING_FACTORY_TYPES.has(sourceFactory.factoryType), '交出转单样例未指向非车缝工厂')
const handoverWarehouse = defaultWarehouses.find((item) => item.factoryId === sourceFactory?.id && item.warehouseKind === 'WAIT_HANDOVER')
assert(handoverWarehouse, '交出转单样例缺少待交出仓')
const outboundFromHandover = buildOutboundRecordFromHandoverRecord(handoverHead!, handoverRecord, sourceFactory!, handoverWarehouse!, 0)
assert(outboundFromHandover.warehouseId === handoverWarehouse?.warehouseId, '交出转单未进入待交出仓')
assert(outboundFromHandover.remark === '由交出记录生成', '交出转单来源文案不正确')

assertContains(dataSource, 'buildInboundRecordFromPickup', '缺少领料转单 helper')
assertContains(dataSource, 'buildInboundRecordFromHandoverReceive', '缺少接收转单 helper')
assertContains(dataSource, 'buildOutboundRecordFromHandoverRecord', '缺少交出转单 helper')
assertContains(linkageSource, 'linkPickupConfirmToInboundRecord', '缺少待领料确认到入库联动 helper')
assertContains(linkageSource, 'linkHandoverReceiveToInboundRecord', '缺少交出接收到入库联动 helper')
assertContains(linkageSource, 'linkHandoverRecordToOutboundRecord', '缺少交出到出库联动 helper')
assertContains(linkageSource, 'syncReceiverWritebackToOutboundRecord', '缺少回写同步出库联动 helper')
assertContains(linkageSource, 'syncQuantityObjectionToOutboundRecord', '缺少异议同步出库联动 helper')
assertContains(handoverDetailSource, '已入待加工仓', '交接详情缺少待加工仓联动提示')
assertContains(handoverDetailSource, '已生成出库记录', '交接详情缺少出库联动提示')

;[
  '待加工仓',
  '待交出仓',
  '入库记录',
  '出库记录',
  '库区库位',
  '盘点',
  '工厂',
  '工艺',
  '仓库类型',
  '状态',
  '关键字',
  '时间范围',
  '待接收数量',
  '已入待加工仓数量',
  '待交出数量',
  '已交出数量',
  '差异数量',
  '异常数量',
  '盘点差异数量',
  '待加工数量',
  '今日入库',
  '今日出库',
  '入库差异',
  '出库差异',
  '超时未处理',
].forEach((token) => {
  assertContains(pageSource, token, `工厂仓库总览页面缺少：${token}`)
})
assertContains(progressStatisticsSource, 'buildFactoryWarehouseProgressSnapshots', '统计联动缺少工厂仓库统计 helper')
assertContains(progressStatisticsSource, 'stocktakeDifferenceCount', '工厂仓库统计缺少盘点差异指标')

;[
  '来源单号',
  '来源对象',
  '所属任务',
  '物料 / 裁片类型',
  '面料 SKU / 裁片部位',
  '颜色',
  '尺码',
  '菲票号',
  '中转袋号',
  '卷号',
  '应收数量',
  '实收数量',
  '差异数量',
  '接收人',
  '接收时间',
].forEach((token) => {
  assertContains(pageSource, token, `待加工仓字段缺少：${token}`)
})

;[
  '来源任务',
  '加工完成数量',
  '损耗数量',
  '待交出数量',
  '接收方',
  '交出单',
  '交出记录',
  '交出二维码',
  '回写数量',
  '差异 / 异议',
].forEach((token) => {
  assertContains(pageSource + dataSource, token, `待交出仓字段缺少：${token}`)
})

;[
  '新增库区',
  '新增货架',
  '新增库位',
  '编辑备注',
  '停用',
  '启用',
  '创建全盘',
  '盘点范围',
  '账面数量',
  '实盘数量',
  '差异原因',
].forEach((token) => {
  assertContains(pageSource, token, `页面缺少能力：${token}`)
})

assertContains(dataSource, "stocktakeScope: '全盘'", '盘点范围必须是全盘')
assert(stocktakeOrders.every((item) => item.stocktakeScope === '全盘'), '盘点模型只允许全盘')

assertContains(routeSource, '/fcs/factory/warehouse', '缺少工厂仓库路由注册')
assertContains(rendererSource, 'renderFactoryInternalWarehousePage', '缺少工厂仓库页面渲染器')
assertContains(specialCraftTaskSource, 'FactoryWaitProcessStockItem', '特殊工艺页面未复用待加工仓模型')
assertContains(specialCraftTaskSource, 'FactoryWaitHandoverStockItem', '特殊工艺页面未复用待交出仓模型')
assertContains(specialCraftTaskSource, 'FactoryWarehouseInboundRecord', '特殊工艺页面未复用入库记录模型')
assertContains(specialCraftTaskSource, 'FactoryWarehouseOutboundRecord', '特殊工艺页面未复用出库记录模型')
assertContains(specialCraftTaskSource, 'FactoryWarehouseStocktakeOrder', '特殊工艺页面未复用盘点模型')
assertContains(specialCraftFeiFlowSource, 'FactoryWarehouseInboundRecord', '裁床特殊工艺菲票流转未复用入库记录模型')
assertContains(specialCraftFeiFlowSource, 'FactoryWarehouseOutboundRecord', '裁床特殊工艺菲票流转未复用出库记录模型')
;['待加工仓', '待交出仓', '入库记录', '出库记录', '库区库位', '盘点'].forEach((token) => {
  assertContains(specialCraftWarehouseSource, token, `特殊工艺仓库管理缺少：${token}`)
})
;[
  buildToken('新增', '库存'),
  buildToken('手动', '入库'),
  buildToken('手动', '出库'),
  buildToken('新增', '入库'),
  buildToken('新增', '出库'),
].forEach((token) => {
  assert(!specialCraftWarehouseSource.includes(token), `特殊工艺仓库管理不应出现：${token}`)
})

const fcsMenus = flattenMenuItems(menusBySystem.fcs)
assert(fcsMenus.some((item) => item.href === '/fcs/factory/warehouse' && item.title === '工厂仓库'), 'FCS 菜单缺少工厂仓库入口')
Object.entries(menusBySystem)
  .filter(([systemId]) => systemId !== 'fcs')
  .forEach(([systemId, groups]) => {
    const menuItems = flattenMenuItems(groups as typeof menusBySystem.fcs)
    assert(!menuItems.some((item) => item.href === '/fcs/factory/warehouse'), `工厂仓库不应挂在 ${systemId} 菜单下`)
  })

assertNoTerms(pageSource + dataSource, legacyWarehouseTerms, '页面或数据源码仍保留旧仓库主文案')
assertNoTerms(pageSource + dataSource, noWmsTerms, '工厂内部仓源码不应扩展为 WMS 能力')
assertNoTerms(pageSource + dataSource, noCycleTerms, '盘点不应包含抽盘或循环盘')
assertNoTerms(pdaShellSource, ['工厂仓库', '/fcs/factory/warehouse'], '本轮不应改动工厂端底部 Tab')
assert(!pageSource.includes(buildToken('新增', '库存')), `页面不应出现${buildToken('手工', '新增', '库存')}按钮`)
assert(!pageSource.includes(buildToken('新增', '入库记录')), '页面不应出现手工新增入库记录主按钮')
assert(!pageSource.includes(buildToken('新增', '出库记录')), '页面不应出现手工新增出库记录主按钮')
assert(!pageSource.includes(buildToken('确认', '领料')), '工厂仓库总览不应替代交接主流程')
assert(!pageSource.includes(buildToken('新增', '交出记录')), '工厂仓库总览不应替代交出主流程')

console.log(
  JSON.stringify(
    {
      工厂内部仓模型: '通过',
      自动转单: '通过',
      轻量位置: '通过',
      盘点范围: '通过',
      页面与菜单: '通过',
    },
    null,
    2,
  ),
)
