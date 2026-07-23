import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
  listFactoryWarehouseOutboundRecords,
  upsertFactoryWaitProcessStockItem,
} from '../src/data/fcs/factory-internal-warehouse.ts'
import { listProcessWorkOrderStockMaterials } from '../src/data/fcs/process-work-order-stock.ts'
import { getProcessWorkOrderById } from '../src/data/fcs/process-work-order-domain.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { createDyeWorkOrderFromStock, listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'
import { createPrintWorkOrderFromStock, listPrintWorkOrders } from '../src/data/fcs/printing-task-domain.ts'
import { listPrepProcessOrders } from '../src/data/fcs/page-adapters/process-prep-pages-adapter.ts'
import { handleProcessDyeOrdersEvent, renderProcessDyeOrdersPage } from '../src/pages/process-dye-orders.ts'
import { handleProcessPrintOrdersEvent, renderProcessPrintOrdersPage } from '../src/pages/process-print-orders.ts'

const rawStock = listFactoryWaitProcessStockItems().find((item) => item.itemKind === '面料' && item.receivedQty > 0 && item.materialSku && (item.processCode === 'CUT_PANEL' || item.status === '差异待处理'))
assert(rawStock, '测试前置：仓库必须存在裁床或差异待处理的不可用面料库存')

function firstDispatchFactoryId(processCode: 'DYE' | 'PRINT'): string {
  return listFactoryMasterRecords()
    .filter((factory) => factory.status === 'active' && factory.eligibility.allowDispatch)
    .find((factory) => factory.processAbilities.some((ability) => (
      ability.processCode === processCode
      && (ability.status ?? 'ACTIVE') === 'ACTIVE'
      && ability.canReceiveTask !== false
    )))!.id
}
const dyeFactoryId = firstDispatchFactoryId('DYE')
const printFactoryId = firstDispatchFactoryId('PRINT')
const finishAt = '2026-08-08 18:30'

assert(listProcessWorkOrderStockMaterials({ factoryId: dyeFactoryId, processCode: 'DYE' }).length > 0, '默认演示数据必须提供当前染色工厂的合格备货库存')
assert(listProcessWorkOrderStockMaterials({ factoryId: printFactoryId, processCode: 'PRINT' }).length > 0, '默认演示数据必须提供当前印花工厂的合格备货库存')

function seedQualifiedStock(processCode: 'DYE' | 'PRINT', factoryId: string) {
  return upsertFactoryWaitProcessStockItem({
    ...rawStock!,
    stockItemId: `WPS-QUALIFIED-${processCode}`,
    sourceRecordId: `INB-QUALIFIED-${processCode}`,
    sourceRecordNo: `RK-QUALIFIED-${processCode}`,
    factoryId,
    factoryName: processCode === 'DYE' ? listDyeWorkOrders()[0]!.dyeFactoryName : listPrintWorkOrders()[0]!.printFactoryName,
    warehouseId: `FIW-${factoryId}-WAIT_PROCESS`,
    warehouseName: `${processCode === 'DYE' ? listDyeWorkOrders()[0]!.dyeFactoryName : listPrintWorkOrders()[0]!.printFactoryName} · 待加工仓`,
    processCode,
    processName: processCode === 'DYE' ? '染色' : '印花',
    itemName: `${processCode === 'DYE' ? '染色' : '印花'}合格备货面料`,
    materialSku: `FAB-QUALIFIED-${processCode}`,
    expectedQty: 120,
    receivedQty: 120,
    differenceQty: 0,
    status: '已入待加工仓',
    abnormalReason: undefined,
  })
}

const dyeStock = seedQualifiedStock('DYE', dyeFactoryId)
const printStock = seedQualifiedStock('PRINT', printFactoryId)

for (const [processCode, factoryId, qualifiedStock] of [
  ['DYE', dyeFactoryId, dyeStock],
  ['PRINT', printFactoryId, printStock],
] as const) {
  const candidates = listProcessWorkOrderStockMaterials({ processCode, factoryId })
  const candidate = candidates.find((item) => item.stockMaterialId === qualifiedStock.stockItemId)
  assert(candidate, `${processCode} 必须返回同工厂同工序的合格库存`)
  assert.deepEqual(
    [candidate.factoryId, candidate.processCode, candidate.status, candidate.differenceQty, candidate.availableQty],
    [factoryId, processCode, '已入待加工仓', 0, qualifiedStock.receivedQty],
    `${processCode} 候选必须保留库存资格与真实可用数量`,
  )
  assert(!candidates.some((item) => item.stockMaterialId === rawStock!.stockItemId), `${processCode} 不得返回裁床差异库存`)
}

function stockInput(factoryId: string, stock: typeof dyeStock) {
  return {
    stockMaterialId: stock.stockItemId,
    stockMaterialName: stock.itemName,
    materialSku: stock.materialSku!,
    factoryId,
    plannedQty: 12,
    qtyUnit: stock.unit,
    plannedFinishAt: finishAt,
    processName: '库存建单校验',
  }
}

function creationFactCounts() {
  return {
    dyeWorkOrders: listDyeWorkOrders().length,
    printWorkOrders: listPrintWorkOrders().length,
    pdaTasks: listPdaGenericProcessTasks().length,
    waitHandoverStockItems: listFactoryWaitHandoverStockItems().length,
    warehouseOutboundRecords: listFactoryWarehouseOutboundRecords().length,
  }
}

for (const [label, create, factoryId, stock] of [
  ['染色', (input: ReturnType<typeof stockInput>) => createDyeWorkOrderFromStock({ ...input, targetColor: '藏青' }), dyeFactoryId, dyeStock],
  ['印花', (input: ReturnType<typeof stockInput>) => createPrintWorkOrderFromStock(input), printFactoryId, printStock],
] as const) {
  const valid = stockInput(factoryId, stock)
  assert.equal(create({ ...valid, stockMaterialId: 'NOT-FOUND' }).ok, false, `${label}必须拒绝不存在的库存 ID`)
  assert.equal(create({ ...valid, stockMaterialName: `${stock.itemName}-篡改` }).ok, false, `${label}必须拒绝库存名称不匹配`)
  assert.equal(create({ ...valid, qtyUnit: `${stock.unit}-篡改` }).ok, false, `${label}必须拒绝库存单位不匹配`)
  assert.equal(create({ ...valid, factoryId: 'FACTORY-NOT-STOCK-OWNER' }).ok, false, `${label}必须拒绝不属于所选工厂的库存`)
  assert.equal(create({ ...valid, stockMaterialId: rawStock!.stockItemId, stockMaterialName: rawStock!.itemName, materialSku: rawStock!.materialSku!, qtyUnit: rawStock!.unit }).ok, false, `${label}必须拒绝工序不匹配或差异待处理库存`)
  assert.equal(create({ ...valid, plannedQty: 0 }).ok, false, `${label}必须拒绝零数量`)
  assert.equal(create({ ...valid, plannedFinishAt: '   ' }).ok, false, `${label}必须拒绝空计划完成时间`)
  assert.equal(create({ ...valid, plannedFinishAt: 'not-a-date' }).ok, false, `${label}必须拒绝无法解析的计划完成时间`)
  assert.equal(create({ ...valid, plannedFinishAt: '2026-02-30 18:00' }).ok, false, `${label}必须拒绝不存在的日期`)
  const factsBeforeOverstock = creationFactCounts()
  const overstock = create({ ...valid, plannedQty: stock.receivedQty + 1 })
  assert.equal(overstock.ok, false, `${label}必须拒绝超过可用库存的计划数量`)
  assert.match(overstock.message, /超过可用库存/, `${label}超库存必须返回中文原因`)
  assert.deepEqual(creationFactCounts(), factsBeforeOverstock, `${label}超库存失败不得创建加工单、PDA 任务或仓库事实`)

  const created = create({ ...valid, plannedQty: stock.receivedQty })
  assert(created.ok && created.order, `${label}必须允许计划数量等于可用库存`)
  assert.equal(created.order.plannedQty, stock.receivedQty, `${label}等于可用库存时必须保留计划数量`)
  assert.equal(created.order.qtyUnit, stock.unit, `${label}加工单必须保留库存单位`)
  assert.equal(created.order.plannedFinishAt, finishAt, `${label}加工单必须保留计划完成时间`)
  const createdWorkOrderId = 'dyeOrderId' in created.order! ? created.order.dyeOrderId : created.order.printOrderId
  const unifiedOrder = getProcessWorkOrderById(createdWorkOrderId)
  assert.deepEqual(unifiedOrder?.sourceSnapshot, {
    sourceType: 'STOCK',
    stockMaterialId: stock.stockItemId,
    stockMaterialName: stock.itemName,
  }, `${label}备货入口必须通过统一服务保存备货来源快照`)
  const fact = listPrepProcessOrders(label === '染色' ? 'DYE' : 'PRINT').find((item) => item.workOrderId === createdWorkOrderId)
  assert.equal(fact?.unit, stock.unit, `${label}列表适配器必须保留库存单位`)
  assert.equal(fact?.plannedFinishAt, finishAt, `${label}列表适配器必须读取计划完成时间而非更新时间`)
}

function actionTarget(scope: 'dye' | 'print', action: string, workOrderId?: string): HTMLElement {
  return {
    closest(selector: string) {
      if (selector.includes(`[data-${scope}-create-field]`)) return null
      if (selector.includes(`[data-${scope}-order-field]`)) return null
      if (selector.includes(`[data-${scope}-order-action]`)) return { dataset: { [`${scope}OrderAction`]: action, workOrderId } }
      return null
    },
  } as unknown as HTMLElement
}

function fieldTarget(scope: 'dye' | 'print', field: string, value: string): HTMLElement {
  return {
    value,
    dataset: { [`${scope}CreateField`]: field },
    closest(selector: string) {
      return selector.includes(`[data-${scope}-create-field]`) ? this : null
    },
  } as unknown as HTMLElement
}

function exerciseDrawer(scope: 'dye' | 'print'): void {
  const stock = scope === 'dye' ? dyeStock : printStock
  const handle = scope === 'dye' ? handleProcessDyeOrdersEvent : handleProcessPrintOrdersEvent
  const render = scope === 'dye' ? renderProcessDyeOrdersPage : renderProcessPrintOrdersPage
  handle(actionTarget(scope, 'create-new'))
  let html = render()
  assert.match(html, new RegExp(`value="${stock.stockItemId}"`), `${scope} 抽屉必须提供同工厂同工序的真实库存选项`)
  assert.match(html, new RegExp(`可用 ${stock.receivedQty} ${stock.unit}`), `${scope} 抽屉必须显示可用库存数量`)
  assert.doesNotMatch(html, new RegExp(rawStock!.stockItemId), `${scope} 抽屉不得提供裁床差异库存`)
  assert.doesNotMatch(html, /备货物料 ID<\/span><input/, `${scope} 抽屉不得自由填写库存 ID`)
  assert.match(html, /data-skip-page-rerender="true"[^>]*data-(?:dye|print)-create-field/, `${scope} 抽屉输入必须跳过整页重渲染`)
  assert.doesNotMatch(html, /data-skip-page-rerender="true"[^>]*data-(?:dye|print)-order-action="submit-create"/, `${scope} 提交必须允许刷新列表和关闭抽屉`)

  handle(fieldTarget(scope, 'stockMaterialId', stock.stockItemId))
  html = render()
  const plannedQtyInput = html.match(new RegExp(`<input[^>]*data-${scope}-create-field="plannedQty"[^>]*>`))?.[0] || ''
  assert.match(plannedQtyInput, new RegExp(`max="${stock.receivedQty}"`), `${scope} 计划数量输入必须用可用库存辅助限制 max`)
  handle(fieldTarget(scope, 'plannedQty', '16'))
  handle(fieldTarget(scope, 'plannedFinishAt', ''))
  html = render()
  assert.equal((html.match(/新建(?:染色|印花)加工单/g) ?? []).length, 1, `${scope} 输入后抽屉不得重复重建`)
  assert.match(html, new RegExp(stock.itemName), `${scope} 输入后必须保留已选库存`)
  handle(actionTarget(scope, 'submit-create'))
  html = render()
  assert.match(html, /data-(?:dye|print)-create-error[^>]*>[\s\S]*计划完成时间/, `${scope} 提交失败必须在抽屉按钮附近显示错误`)

  handle(fieldTarget(scope, 'plannedFinishAt', '2026-08-09T17:20'))
  html = render()
  assert.doesNotMatch(html, /data-(?:dye|print)-create-error/, `${scope} 纠正字段后必须清除旧错误`)

  handle(fieldTarget(scope, 'plannedQty', String(stock.receivedQty + 1)))
  const factsBeforeDrawerOverstock = creationFactCounts()
  handle(actionTarget(scope, 'submit-create'))
  html = render()
  assert.match(html, /data-(?:dye|print)-create-error[^>]*>[\s\S]*超过可用库存/, `${scope} 超库存必须在抽屉按钮附近显示中文错误`)
  assert.deepEqual(creationFactCounts(), factsBeforeDrawerOverstock, `${scope} 抽屉超库存失败不得创建任何事实`)

  const drawerCreatedQty = Math.min(16, stock.receivedQty)
  handle(fieldTarget(scope, 'plannedQty', String(drawerCreatedQty)))
  html = render()
  assert.doesNotMatch(html, /data-(?:dye|print)-create-error/, `${scope} 纠正超库存数量后必须清除旧错误`)
  handle(actionTarget(scope, 'submit-create'))
  html = render()
  assert.doesNotMatch(html, /新建(?:染色|印花)加工单/, `${scope} 成功后必须关闭抽屉`)
  assert.match(html, new RegExp(stock.itemName), `${scope} 成功列表必须显示真实库存`)
  assert.match(html, new RegExp(`${drawerCreatedQty} ${stock.unit}`), `${scope} 成功列表必须显示真实库存单位`)
  assert.match(html, /2026-08-09 17:20/, `${scope} 成功列表必须显示计划完成时间`)

  const created = (scope === 'dye' ? listDyeWorkOrders() : listPrintWorkOrders()).filter((item) => item.sourceType === 'STOCK').at(-1)!
  const workOrderId = 'dyeOrderId' in created ? created.dyeOrderId : created.printOrderId
  handle(actionTarget(scope, 'open-detail', workOrderId))
  html = render()
  assert.match(html, new RegExp(stock.itemName), `${scope} 详情必须显示真实库存`)
  assert.match(html, new RegExp(`${drawerCreatedQty} ${stock.unit}`), `${scope} 详情必须显示真实库存单位`)
  assert.match(html, /2026-08-09 17:20/, `${scope} 详情必须显示计划完成时间`)
  handle(actionTarget(scope, 'close-all'))
}

const mainSource = readFileSync('src/main.ts', 'utf8')
assert.match(mainSource, /const skipPageRerender = Boolean\(target\.closest<HTMLElement>\('\[data-skip-page-rerender="true"\]'\)\)/, '全局事件分发必须识别跳过页面重渲染的输入标记')
assert.match(mainSource, /if \(skipPageRerender\) \{\s*return/, '全局事件分发处理输入后必须跳过页面重渲染')

exerciseDrawer('dye')
exerciseDrawer('print')

console.log('check:stock-process-work-order-creation passed')
