#!/usr/bin/env node

import assert from 'node:assert/strict'

import {
  BUTTON_LOOP_OPERATION_ID,
  applyButtonLoopTaskAction,
  buildButtonLoopTaskOrders,
  type ButtonLoopTaskOrder,
} from '../src/data/fcs/button-loop-craft-flow.ts'
import {
  getCraftManagementDomainName,
  getCraftTargetObject,
  listBindingAreaCrafts,
  listCutPiecePartCrafts,
} from '../src/data/fcs/process-craft-dict.ts'
import {
  getSpecialCraftOperationById,
  listEnabledAuxiliaryCraftOperationDefinitions,
} from '../src/data/fcs/special-craft-operations.ts'
import {
  APF_FACTORY_ID,
  FLOWER_FACTORY_ID,
  SPF_FACTORY_ID,
  getDedicatedSpecialCraftFactoryId,
} from '../src/data/fcs/special-craft-dedicated-factories.ts'

const newCraftNames = ['盘扣', '花朵', '打褶', '烫钻']

newCraftNames.forEach((craftName) => {
  assert.equal(getCraftManagementDomainName(craftName), '辅助工艺工厂管理', `${craftName} 必须进入辅助工艺工厂管理`)
})
assert.equal(getCraftTargetObject('盘扣'), 'BINDING_STRIP', '盘扣加工对象必须是捆条')
assert.deepEqual(
  listBindingAreaCrafts().map((item) => item.craftName),
  ['捆条', '盘扣'],
  '捆条区域必须保留裁床捆条，并新增盘扣',
)
;['花朵', '打褶', '烫钻'].forEach((craftName) => {
  assert(listCutPiecePartCrafts().some((item) => item.craftName === craftName), `${craftName} 必须可在裁片部位选择`)
})

const operationNames = listEnabledAuxiliaryCraftOperationDefinitions().map((item) => item.operationName)
newCraftNames.forEach((craftName) => assert(operationNames.includes(craftName), `${craftName} 缺少独立加工单 operation`))
const buttonLoopOperation = getSpecialCraftOperationById(BUTTON_LOOP_OPERATION_ID)
assert(buttonLoopOperation, '缺少盘扣加工单 operation')
assert.equal(buttonLoopOperation?.quantityMode, 'TICKET_INPUT_OUTPUT')
assert.equal(buttonLoopOperation?.targetObject, '捆条')
assert.equal(buttonLoopOperation?.outputUnit, '个')
assert.equal(buttonLoopOperation?.receiverWarehouseName, '中央辅料仓')

assert.equal(getDedicatedSpecialCraftFactoryId('AUX-OP-HEAT-TRANSFER'), FLOWER_FACTORY_ID)
assert.equal(getDedicatedSpecialCraftFactoryId('AUX-OP-DIRECT-PRINT'), FLOWER_FACTORY_ID)
assert.equal(getDedicatedSpecialCraftFactoryId(BUTTON_LOOP_OPERATION_ID), APF_FACTORY_ID)
assert.equal(getDedicatedSpecialCraftFactoryId('AUX-OP-FLOWER-MAKING'), APF_FACTORY_ID)
assert.equal(getDedicatedSpecialCraftFactoryId('SPC-OP-TEMPLATE-PROCESS'), SPF_FACTORY_ID)

const tasks = buildButtonLoopTaskOrders({
  productionOrderId: 'PO-BUTTON-001',
  productionOrderNo: 'PO-BUTTON-001',
  styleCode: 'ST-BUTTON-001',
  styleName: '盘扣连衣裙',
  techPackSnapshotId: 'TPS-BUTTON-001',
  selectedBindingStrips: [
    {
      patternFileId: 'PATTERN-001',
      patternFileName: '连衣裙纸样包',
      bindingStripId: 'BIND-001',
      bindingStripNo: 'BT-001',
      bindingStripName: '衣身包边捆条',
      lengthCm: 120,
      widthCm: 3,
      requiresButtonLoop: false,
    },
    {
      patternFileId: 'PATTERN-001',
      patternFileName: '连衣裙纸样包',
      bindingStripId: 'BIND-002',
      bindingStripNo: 'BT-002',
      bindingStripName: '前襟盘扣捆条',
      lengthCm: 80,
      widthCm: 2.5,
      requiresButtonLoop: true,
      tickets: [
        { feiTicketId: 'FEI-BIND-001', feiTicketNo: 'FT-BIND-001', actualLengthM: 5.4 },
        { feiTicketId: 'FEI-BIND-002', feiTicketNo: 'FT-BIND-002', actualLengthM: 4.8 },
      ],
    },
  ],
})

assert.equal(tasks.length, 1, '一张生产单只能生成一张盘扣加工单')
assert.equal(tasks[0].inputLines.length, 2, '只有选择盘扣的捆条菲票进入投入明细')
assert.equal(tasks[0].inputTicketCount, 2)
assert.equal(tasks[0].inputLengthM, 10.2)
assert.equal(tasks[0].outputQty, 0)
assert.equal(tasks[0].outputUnit, '个')

let task: ButtonLoopTaskOrder = applyButtonLoopTaskAction(tasks[0], {
  action: 'CONFIRM_RECEIVE',
  feiTicketNos: ['FT-BIND-001'],
  operatorName: 'APF 收货员',
  operatedAt: '2026-08-20 09:00:00',
})
assert.equal(task.receivedTicketCount, 1)
task = applyButtonLoopTaskAction(task, {
  action: 'CONFIRM_RECEIVE',
  feiTicketNos: ['FT-BIND-001', 'FT-BIND-002'],
  operatorName: 'APF 收货员',
  operatedAt: '2026-08-20 09:05:00',
})
assert.equal(task.receivedTicketCount, 2, '重复扫描不得重复接收')

task = applyButtonLoopTaskAction(task, {
  action: 'PROCESS_REPORT',
  outputQty: 30,
  operatorName: 'APF 操作员',
  operatedAt: '2026-08-20 11:00:00',
})
task = applyButtonLoopTaskAction(task, {
  action: 'PROCESS_REPORT',
  outputQty: 18,
  operatorName: 'APF 操作员',
  operatedAt: '2026-08-20 12:00:00',
})
assert.equal(task.outputQty, 48, '盘扣产出必须按个数累计，不按米数换算')

task = applyButtonLoopTaskAction(task, {
  action: 'SUBMIT_HANDOVER',
  outputQty: 30,
  operatorName: 'APF 交出员',
  operatedAt: '2026-08-20 13:00:00',
})
assert.equal(task.waitHandoverQty, 18)
task = applyButtonLoopTaskAction(task, {
  action: 'COMPLETE',
  operatorName: 'APF 主管',
  operatedAt: '2026-08-20 13:05:00',
})
assert.equal(task.status, '已完结')
task = applyButtonLoopTaskAction(task, {
  action: 'SUBMIT_HANDOVER',
  outputQty: 18,
  operatorName: 'APF 交出员',
  operatedAt: '2026-08-20 13:10:00',
})
assert.equal(task.status, '已完结')
assert.equal(task.receiverWarehouseName, '中央辅料仓')
assert.equal(task.events.filter((item) => item.action === 'PROCESS_REPORT').length, 2)

const invalidInputTask = applyButtonLoopTaskAction(tasks[0], {
  action: 'CONFIRM_RECEIVE',
  feiTicketNos: ['FT-BIND-001', 'FT-BIND-002'],
  operatorName: 'APF 收货员',
  operatedAt: '2026-08-20 09:05:00',
})
assert.throws(
  () => applyButtonLoopTaskAction(invalidInputTask, {
    action: 'PROCESS_REPORT',
    outputQty: 1.5,
    operatorName: 'APF 操作员',
    operatedAt: '2026-08-20 11:00:00',
  }),
  /正整数/,
)

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
}

Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true })
Object.defineProperty(globalThis, 'sessionStorage', { value: new MemoryStorage(), configurable: true })

const [
  taskOrderModule,
  bindingOrderModule,
  factoryMasterModule,
  warehouseModule,
  menuModule,
  printModule,
  accessoryReceiptModule,
  webDetailModule,
  pdaDetailModule,
  wlsPageModule,
  pdaStoreModule,
  factoryWarehouseProjectionModule,
] = await Promise.all([
  import('../src/data/fcs/special-craft-task-orders.ts'),
  import('../src/pages/process-factory/cutting/binding-strip-orders.ts'),
  import('../src/data/fcs/factory-master-store.ts'),
  import('../src/data/fcs/factory-internal-warehouse-locations.ts'),
  import('../src/data/app-shell-config.ts'),
  import('../src/pages/print/templates/label-print-template.ts'),
  import('../src/data/fcs/button-loop-accessory-receipts.ts'),
  import('../src/pages/process-factory/special-craft/task-detail.ts'),
  import('../src/pages/pda-exec-detail.ts'),
  import('../src/pages/wls-accessory-receipts.ts'),
  import('../src/data/fcs/store-domain-pda.ts'),
  import('../src/data/fcs/factory-internal-warehouse.ts'),
])

const factoryRecords = factoryMasterModule.listFactoryMasterRecords()
assert.equal(factoryRecords.find((item) => item.id === FLOWER_FACTORY_ID)?.name, 'FLOWER')
assert.equal(factoryRecords.find((item) => item.id === APF_FACTORY_ID)?.name, 'APF - 辅助工艺')
assert.equal(factoryRecords.find((item) => item.id === SPF_FACTORY_ID)?.name, 'SPF - 特种工艺')
assert(!factoryRecords.some((item) => ['FAC-AUX-CRAFT', 'FAC-SPC-CRAFT'].includes(item.id)), '旧辅助/特种工艺工厂档案必须完成迁移')

const internalWarehouses = warehouseModule.listFactoryInternalWarehouses()
;[FLOWER_FACTORY_ID, APF_FACTORY_ID, SPF_FACTORY_ID].forEach((factoryId) => {
  const rows = internalWarehouses.filter((item) => item.factoryId === factoryId)
  assert.deepEqual(rows.map((item) => item.warehouseKind).sort(), ['WAIT_HANDOVER', 'WAIT_PROCESS'], `${factoryId} 缺少默认待加工仓或待交出仓`)
})
const apfAreas = internalWarehouses
  .filter((item) => item.factoryId === APF_FACTORY_ID)
  .flatMap((item) => item.areaList.map((area) => area.areaName))
newCraftNames.forEach((craftName) => assert(apfAreas.some((areaName) => areaName.includes(craftName)), `APF 默认库区缺少 ${craftName}`))
const flowerAreas = internalWarehouses
  .filter((item) => item.factoryId === FLOWER_FACTORY_ID)
  .flatMap((item) => item.areaList.map((area) => area.areaName))
;['烫画-成衣库区', '直喷-成衣库区'].forEach((areaName) => {
  assert(flowerAreas.includes(areaName), `FLOWER 默认库区缺少 ${areaName}`)
})
;['烫画-裁片库区', '直喷-裁片库区'].forEach((areaName) => {
  assert(!flowerAreas.includes(areaName), `FLOWER 不应保留已失效的裁片库区 ${areaName}`)
})

const menuGroups = menuModule.buildSpecialCraftMenuGroups()
const auxiliaryMenu = menuGroups.find((group) => group.title === '辅助工艺工厂管理')
const specialMenu = menuGroups.find((group) => group.title === '特种工艺工厂管理')
assert(auxiliaryMenu, '菜单组名称必须继续使用辅助工艺工厂管理')
assert(specialMenu, '菜单组名称必须继续使用特种工艺工厂管理')
newCraftNames.forEach((craftName) => {
  assert(auxiliaryMenu?.items.some((item) => item.title === `${craftName}加工单`), `${craftName} 缺少独立菜单`)
})
assert(!menuGroups.some((group) => ['APF', 'SPF'].includes(group.title)), '运营菜单组不得改名为 APF 或 SPF')

const runtimeTasks = taskOrderModule.listSpecialCraftTaskOrders()
const runtimeButtonTasks = runtimeTasks.filter((item) => item.operationId === BUTTON_LOOP_OPERATION_ID)
assert(runtimeButtonTasks.length > 0, '真实生产单与技术包快照未生成盘扣加工单')
const buttonTaskCountByProduction = new Map<string, number>()
runtimeButtonTasks.forEach((item) => buttonTaskCountByProduction.set(item.productionOrderId, (buttonTaskCountByProduction.get(item.productionOrderId) || 0) + 1))
assert([...buttonTaskCountByProduction.values()].every((count) => count === 1), '同一生产单必须只有一张盘扣加工单')
const runtimeButtonTask = runtimeButtonTasks.find((item) => (item.buttonLoopInputLines?.length || 0) > 0)
assert(runtimeButtonTask, '盘扣加工单缺少捆条菲票投入明细')
assert.equal(runtimeButtonTask.factoryId, APF_FACTORY_ID)
assert.equal(runtimeButtonTask.inputUnit, '张')
assert.equal(runtimeButtonTask.outputUnit, '个')
assert.equal(runtimeButtonTask.receiverWarehouseName, '中央辅料仓')
const webDetailHtml = webDetailModule.renderSpecialCraftTaskDetailPage('aux-op-button-loop', runtimeButtonTask.taskOrderId)
;['捆条投入与盘扣产出', '投入菲票', '盘扣产出', '中央辅料仓', '确认接收'].forEach((token) => {
  assert(webDetailHtml.includes(token), `盘扣 Web 加工单详情缺少 ${token}`)
})
const apfPdaUser = pdaStoreModule.listFactoryPdaUsers(APF_FACTORY_ID)[0]
assert(apfPdaUser, 'APF - 辅助工艺缺少默认 PDA 用户')
pdaStoreModule.setPdaSession(pdaStoreModule.createPdaSessionFromUser(apfPdaUser))
const pdaDetailHtml = pdaDetailModule.renderPdaWorkOrderExecDetailPage('SPECIAL_CRAFT', runtimeButtonTask.taskOrderId)
;['盘扣', '加工单执行'].forEach((token) => {
  assert(pdaDetailHtml.includes(token), `盘扣 PDA 详情缺少 ${token}`)
})
;['花朵', '打褶', '烫钻'].forEach((craftName) => {
  const generated = runtimeTasks.find((item) => item.operationName === craftName)
  assert(generated, `${craftName} 未生成裁片辅助工艺加工单`)
  assert.equal(generated?.factoryId, APF_FACTORY_ID, `${craftName} 必须分配 APF - 辅助工艺`)
  assert.equal(generated?.targetObject, '已裁部位', `${craftName} 加工对象必须为裁片部位`)
})

const bindingOrders = bindingOrderModule.buildBindingProcessOrders()
const bindingDetails = bindingOrders.flatMap((order) => order.bindingDetails)
const yellowBindingTicket = bindingDetails.find((detail) => detail.requiresButtonLoop)
const whiteBindingTicket = bindingDetails.find((detail) => !detail.requiresButtonLoop)
assert(yellowBindingTicket, '缺少需要盘扣的捆条黄色菲票')
assert(whiteBindingTicket, '缺少衣服用普通捆条白色菲票')
const yellowPrint = printModule.buildFeiTicketLabelPrintDocument({
  documentType: 'FEI_TICKET_LABEL',
  sourceType: 'FEI_TICKET_RECORD',
  sourceId: yellowBindingTicket.feiTicketId,
  paperColor: 'YELLOW',
})
assert.equal(yellowPrint.paperType, 'LABEL_100_100')
assert.equal(yellowPrint.thermalPaperColor, 'YELLOW')
assert(`${yellowPrint.documentTitle} ${yellowPrint.printTitle}`.includes('盘扣'), '盘扣捆条黄色菲票标题必须显著标记盘扣')
const yellowPrintHtml = printModule.renderLabelPrintTemplate(yellowPrint)
;['盘扣', 'APF - 辅助工艺', '中央辅料仓', 'data-thermal-paper-color="YELLOW"'].forEach((token) => {
  assert(yellowPrintHtml.includes(token), `盘扣捆条黄色菲票缺少 ${token}`)
})
const whitePrint = printModule.buildFeiTicketLabelPrintDocument({
  documentType: 'FEI_TICKET_LABEL',
  sourceType: 'FEI_TICKET_RECORD',
  sourceId: whiteBindingTicket.feiTicketId,
  paperColor: 'WHITE',
})
assert.equal(whitePrint.paperType, 'LABEL_100_100')
assert.equal(whitePrint.thermalPaperColor, 'WHITE')
assert.throws(
  () => printModule.buildFeiTicketLabelPrintDocument({
    documentType: 'FEI_TICKET_LABEL',
    sourceType: 'FEI_TICKET_RECORD',
    sourceId: `${whiteBindingTicket.feiTicketId},${yellowBindingTicket.feiTicketId}`,
  }),
  /不能合并打印/,
)

const allInputTicketNos = (runtimeButtonTask.buttonLoopInputLines || []).map((line) => line.feiTicketNo)
let runtimeTask = taskOrderModule.executeButtonLoopSpecialCraftAction({
  taskOrderId: runtimeButtonTask.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_CONFIRM_RECEIVE',
  feiTicketNos: allInputTicketNos,
  operatorName: 'APF 收货员',
  operatedAt: '2026-08-20 09:00:00',
})
assert.equal(runtimeTask.receivedTicketCount, allInputTicketNos.length)
runtimeTask = taskOrderModule.executeButtonLoopSpecialCraftAction({
  taskOrderId: runtimeTask.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_PROCESS_REPORT',
  outputQty: 24,
  operatorName: 'APF 操作员',
  operatedAt: '2026-08-20 10:00:00',
})
runtimeTask = taskOrderModule.executeButtonLoopSpecialCraftAction({
  taskOrderId: runtimeTask.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
  outputQty: 10,
  operatorName: 'APF 交出员',
  operatedAt: '2026-08-20 11:00:00',
})
assert.equal(runtimeTask.waitHandoverQty, 14)
const partialWaitHandoverItem = factoryWarehouseProjectionModule
  .listFactoryWaitHandoverStockItems()
  .find((item) => item.stockItemId === `SC-WHS-${runtimeTask.taskOrderId}`)
assert.equal(partialWaitHandoverItem?.waitHandoverQty, 14, '分次交出后待交出仓必须保留尚未交出的盘扣')
assert.equal(partialWaitHandoverItem?.status, '待交出')
const firstAccessoryReceiptRow = accessoryReceiptModule.listButtonLoopAccessoryReceiptRows().find((row) => row.task.taskOrderId === runtimeTask.taskOrderId)
assert.equal(firstAccessoryReceiptRow?.handedOverQty, 10)
assert.equal(firstAccessoryReceiptRow?.pendingReceiptQty, 10)
const firstReceipt = accessoryReceiptModule.confirmButtonLoopAccessoryReceipt({
  taskOrderId: runtimeTask.taskOrderId,
  receivedBy: '中央辅料仓收货人员',
  receivedAt: '2026-08-20 11:02:00',
})
assert.equal(firstReceipt.receivedQty, 10)
runtimeTask = taskOrderModule.executeButtonLoopSpecialCraftAction({
  taskOrderId: runtimeTask.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_COMPLETE_ORDER',
  operatorName: 'APF 主管',
  operatedAt: '2026-08-20 11:04:00',
})
runtimeTask = taskOrderModule.executeButtonLoopSpecialCraftAction({
  taskOrderId: runtimeTask.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
  outputQty: 14,
  operatorName: 'APF 交出员',
  operatedAt: '2026-08-20 11:05:00',
})
assert.equal(runtimeTask.status, '已完结')
assert.equal(runtimeTask.handedOverQty, 24)
const buttonLoopInboundRecord = factoryWarehouseProjectionModule
  .listFactoryWarehouseInboundRecords()
  .find((item) => item.inboundRecordId === `SC-INB-${runtimeTask.taskOrderId}`)
assert(buttonLoopInboundRecord, '盘扣确认接收后必须生成待加工仓入库记录')
assert.equal(buttonLoopInboundRecord?.areaName, '盘扣-捆条库区', '盘扣投入不得落到其他辅助工艺或通用库区')
assert.equal(buttonLoopInboundRecord?.unit, '张', '待加工仓必须按捆条菲票张数记录投入')
const buttonLoopWaitHandoverItem = factoryWarehouseProjectionModule
  .listFactoryWaitHandoverStockItems()
  .find((item) => item.stockItemId === `SC-WHS-${runtimeTask.taskOrderId}`)
assert(buttonLoopWaitHandoverItem, '盘扣加工填报后必须生成待交出仓库存')
assert.equal(buttonLoopWaitHandoverItem?.areaName, '盘扣-捆条库区', '盘扣成品不得落到其他辅助工艺或通用库区')
assert.equal(buttonLoopWaitHandoverItem?.unit, '个', '待交出仓必须按盘扣成品个数记录')
assert.equal(buttonLoopWaitHandoverItem?.waitHandoverQty, 0, '全部交出后待交出仓剩余数量必须归零')
assert.equal(buttonLoopWaitHandoverItem?.status, '已交出')
assert.equal(buttonLoopWaitHandoverItem?.receiverName, '中央辅料仓')
const accessoryReceiptRow = accessoryReceiptModule.listButtonLoopAccessoryReceiptRows().find((row) => row.task.taskOrderId === runtimeTask.taskOrderId)
assert(accessoryReceiptRow, '盘扣发起交出后必须进入中央辅料仓待收货')
assert.equal(accessoryReceiptRow?.handedOverQty, 24)
assert.equal(accessoryReceiptRow?.receipt?.receivedQty, 10)
assert.equal(accessoryReceiptRow?.pendingReceiptQty, 14, '第二次交出后中央辅料仓必须只提示新增待收 14 个')
assert.equal(accessoryReceiptRow?.status, '待收货')
const receipt = accessoryReceiptModule.confirmButtonLoopAccessoryReceipt({
  taskOrderId: runtimeTask.taskOrderId,
  receivedBy: '中央辅料仓收货人员',
  receivedAt: '2026-08-20 11:10:00',
})
assert.equal(receipt.receivedQty, 24)
assert.equal(receipt.unit, '个')
assert.equal(receipt.toWarehouseName, '中央辅料仓')
const wlsHtml = wlsPageModule.renderWlsAccessoryReceiptsPage()
;['盘扣成品收货', runtimeTask.taskOrderNo, '已收货 24 个', '中央辅料仓'].forEach((token) => {
  assert(wlsHtml.includes(token), `中央辅料仓收货页缺少 ${token}`)
})

console.log('check:button-loop-auxiliary-crafts passed')
