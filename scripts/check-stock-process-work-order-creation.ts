import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { listFactoryWaitProcessStockItems } from '../src/data/fcs/factory-internal-warehouse.ts'
import { createDyeWorkOrderFromStock, listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import { createPrintWorkOrderFromStock, listPrintWorkOrders } from '../src/data/fcs/printing-task-domain.ts'
import { listPrepProcessOrders } from '../src/data/fcs/page-adapters/process-prep-pages-adapter.ts'
import { handleProcessDyeOrdersEvent, renderProcessDyeOrdersPage } from '../src/pages/process-dye-orders.ts'
import { handleProcessPrintOrdersEvent, renderProcessPrintOrdersPage } from '../src/pages/process-print-orders.ts'

const stock = listFactoryWaitProcessStockItems().find((item) => item.itemKind === '面料' && item.receivedQty > 0 && item.materialSku)
assert(stock, '测试前置：仓库必须存在数量大于 0 的真实面料库存')

const dyeFactoryId = listDyeWorkOrders()[0]!.dyeFactoryId
const printFactoryId = listPrintWorkOrders()[0]!.printFactoryId
const finishAt = '2026-08-08 18:30'

function stockInput(factoryId: string) {
  return {
    stockMaterialId: stock!.stockItemId,
    stockMaterialName: stock!.itemName,
    materialSku: stock!.materialSku!,
    factoryId,
    plannedQty: 12,
    qtyUnit: stock!.unit,
    plannedFinishAt: finishAt,
    processName: '库存建单校验',
  }
}

for (const [label, create, factoryId] of [
  ['染色', (input: ReturnType<typeof stockInput>) => createDyeWorkOrderFromStock({ ...input, targetColor: '藏青' }), dyeFactoryId],
  ['印花', (input: ReturnType<typeof stockInput>) => createPrintWorkOrderFromStock(input), printFactoryId],
] as const) {
  const valid = stockInput(factoryId)
  assert.equal(create({ ...valid, stockMaterialId: 'NOT-FOUND' }).ok, false, `${label}必须拒绝不存在的库存 ID`)
  assert.equal(create({ ...valid, stockMaterialName: `${stock!.itemName}-篡改` }).ok, false, `${label}必须拒绝库存名称不匹配`)
  assert.equal(create({ ...valid, qtyUnit: `${stock!.unit}-篡改` }).ok, false, `${label}必须拒绝库存单位不匹配`)
  assert.equal(create({ ...valid, plannedQty: 0 }).ok, false, `${label}必须拒绝零数量`)
  assert.equal(create({ ...valid, plannedFinishAt: '   ' }).ok, false, `${label}必须拒绝空计划完成时间`)
  assert.equal(create({ ...valid, plannedFinishAt: 'not-a-date' }).ok, false, `${label}必须拒绝无法解析的计划完成时间`)
  assert.equal(create({ ...valid, plannedFinishAt: '2026-02-30 18:00' }).ok, false, `${label}必须拒绝不存在的日期`)
  const created = create(valid)
  assert(created.ok && created.order, `${label}必须允许真实库存建单`)
  assert.equal(created.order.qtyUnit, stock!.unit, `${label}加工单必须保留库存单位`)
  assert.equal(created.order.plannedFinishAt, finishAt, `${label}加工单必须保留计划完成时间`)
  const fact = listPrepProcessOrders(label === '染色' ? 'DYE' : 'PRINT').find((item) => item.workOrderId === ('dyeOrderId' in created.order! ? created.order.dyeOrderId : created.order.printOrderId))
  assert.equal(fact?.unit, stock!.unit, `${label}列表适配器必须保留库存单位`)
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
  const handle = scope === 'dye' ? handleProcessDyeOrdersEvent : handleProcessPrintOrdersEvent
  const render = scope === 'dye' ? renderProcessDyeOrdersPage : renderProcessPrintOrdersPage
  handle(actionTarget(scope, 'create-new'))
  let html = render()
  assert.match(html, new RegExp(`value="${stock!.stockItemId}"`), `${scope} 抽屉必须提供真实库存选项`)
  assert.doesNotMatch(html, /备货物料 ID<\/span><input/, `${scope} 抽屉不得自由填写库存 ID`)
  assert.match(html, /data-skip-page-rerender="true"[^>]*data-(?:dye|print)-create-field/, `${scope} 抽屉输入必须跳过整页重渲染`)
  assert.doesNotMatch(html, /data-skip-page-rerender="true"[^>]*data-(?:dye|print)-order-action="submit-create"/, `${scope} 提交必须允许刷新列表和关闭抽屉`)

  handle(fieldTarget(scope, 'stockMaterialId', stock!.stockItemId))
  handle(fieldTarget(scope, 'plannedQty', '16'))
  handle(fieldTarget(scope, 'plannedFinishAt', ''))
  html = render()
  assert.equal((html.match(/新建(?:染色|印花)加工单/g) ?? []).length, 1, `${scope} 输入后抽屉不得重复重建`)
  assert.match(html, new RegExp(stock!.itemName), `${scope} 输入后必须保留已选库存`)
  handle(actionTarget(scope, 'submit-create'))
  html = render()
  assert.match(html, /data-(?:dye|print)-create-error[^>]*>[\s\S]*计划完成时间/, `${scope} 提交失败必须在抽屉按钮附近显示错误`)

  handle(fieldTarget(scope, 'plannedFinishAt', '2026-08-09T17:20'))
  html = render()
  assert.doesNotMatch(html, /data-(?:dye|print)-create-error/, `${scope} 纠正字段后必须清除旧错误`)
  handle(actionTarget(scope, 'submit-create'))
  html = render()
  assert.doesNotMatch(html, /新建(?:染色|印花)加工单/, `${scope} 成功后必须关闭抽屉`)
  assert.match(html, new RegExp(stock!.itemName), `${scope} 成功列表必须显示真实库存`)
  assert.match(html, new RegExp(`16 ${stock!.unit}`), `${scope} 成功列表必须显示真实库存单位`)
  assert.match(html, /2026-08-09 17:20/, `${scope} 成功列表必须显示计划完成时间`)

  const created = (scope === 'dye' ? listDyeWorkOrders() : listPrintWorkOrders()).filter((item) => item.sourceType === 'STOCK').at(-1)!
  const workOrderId = 'dyeOrderId' in created ? created.dyeOrderId : created.printOrderId
  handle(actionTarget(scope, 'open-detail', workOrderId))
  html = render()
  assert.match(html, new RegExp(stock!.itemName), `${scope} 详情必须显示真实库存`)
  assert.match(html, new RegExp(`16 ${stock!.unit}`), `${scope} 详情必须显示真实库存单位`)
  assert.match(html, /2026-08-09 17:20/, `${scope} 详情必须显示计划完成时间`)
  handle(actionTarget(scope, 'close-all'))
}

const mainSource = readFileSync('src/main.ts', 'utf8')
assert.match(mainSource, /dispatchPageEvent\(target, event\)[\s\S]*?target\.closest<HTMLElement>\('\[data-skip-page-rerender="true"\]'\)[\s\S]*?return/, '全局事件分发必须在输入标记存在时跳过页面重渲染')

exerciseDrawer('dye')
exerciseDrawer('print')

console.log('check:stock-process-work-order-creation passed')
