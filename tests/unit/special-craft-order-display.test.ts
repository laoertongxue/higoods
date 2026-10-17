import { readFileSync } from 'node:fs'
import { pcsRecordStore, withPcsDemoData } from '../../src/data/pcs-record-runtime.ts'
import assert from 'node:assert/strict'
import test from 'node:test'
import { getHandoverRecordsByWorkOrderId } from '../../src/data/fcs/process-warehouse-domain.ts'
import { getSpecialCraftTaskOrders } from '../../src/data/fcs/special-craft-task-orders.ts'
import { createSpecialCraftDisplayColumns, renderSpecialCraftQuantities, resetSpecialCraftDisplayContext, resolveSpecialCraftHandedOverQty, latestSpecialCraftRecordedTime } from '../../src/pages/process-factory/special-craft/order-display.ts'

// Page rendering consumes the published PCS view prepared by the real entry.
const publishedPcs = JSON.parse(readFileSync(new URL('../../src/data/generated/pcs-record-baseline.json', import.meta.url), 'utf8'))
withPcsDemoData(() => pcsRecordStore.setItem('higood-pcs-material-archive-store-v2', publishedPcs['higood-pcs-material-archive-store-v2']))

const text = (html: string) => html.replace(/<[^>]*>/g, '')

test('盘扣投入的两张菲票不会变成计划产出两个盘扣', () => {
  const order = getSpecialCraftTaskOrders('AUX-OP-BUTTON-LOOP')[0]
  assert.ok(order)
  const result = text(renderSpecialCraftQuantities(order))
  assert.match(result, /计划投入菲票：2 张/)
  assert.doesNotMatch(result, /计划产出：2 个/)
  assert.match(result, new RegExp(`完成产出：${order.outputQty || 0} 个`))
})

test('布包扣实际投入量与产出量分别使用原单位，不用产出等价值冒充实收物料', () => {
  const orders = getSpecialCraftTaskOrders('AUX-OP-COVERED-BUTTON-MAKING')
  assert.deepEqual(new Set(orders.map(order => order.inputUnit)), new Set(['米', 'Yard', '件']))
  for (const order of orders) {
    const result = text(renderSpecialCraftQuantities(order))
    assert.ok(result.includes(`实收投入：${order.inputReceivedQty!.toLocaleString('zh-CN', {maximumFractionDigits:2})} ${order.inputUnit}`))
    assert.ok(result.includes(`计划产出：${order.planQty.toLocaleString('zh-CN')} 个`))
  }
})

test('橡筋即使旧枚举为 SAME_UNIT 也按实际米→条分开展示', () => {
  const source = getSpecialCraftTaskOrders('SPC-OP-ELASTIC-FIXED-LENGTH-CUTTING')[0]
  assert.ok(source)
  const order = {...source, inputPlannedQty:685.44, inputReceivedQty:651.17, planQty:1600}
  assert.equal(order.quantityMode, 'SAME_UNIT')
  const result = text(renderSpecialCraftQuantities(order))
  assert.match(result, /计划投入：685.44 米/)
  assert.match(result, /实收投入：651.17 米/)
  assert.match(result, /计划产出：1,600 条/)
})

test('普通加工单和毛织片的已交出数量使用现有 returnedQty，不因缺少盘扣字段显示零', () => {
  const orders = ['AUX-OP-EMBROIDERY', 'AUX-OP-DALAN'].flatMap(id => getSpecialCraftTaskOrders(id))
  const order = orders.find(order => !order.handedOverQty && (order.returnedQty || 0) > 0)!
  assert.ok(order)
  assert.ok(text(renderSpecialCraftQuantities(order)).includes(`已交出：${order.returnedQty!.toLocaleString('zh-CN', {maximumFractionDigits:2})} ${order.unit}`))
})

test('混合工艺里的毛织片不伪称菲票，保留毛织路线和片名', () => {
  const orders = ['AUX-OP-EMBROIDERY', 'AUX-OP-SEAM-EMBROIDERY'].flatMap(id => getSpecialCraftTaskOrders(id)).filter(order => order.woolPieceKey)
  assert.equal(orders.length, 22)
  resetSpecialCraftDisplayContext()
  const columns = createSpecialCraftDisplayColumns(order => order.taskOrderNo)
  for (const order of orders) {
    const inputs = text(columns.find(column => column.key === 'inputs')!.render(order, 0))
    const progress = text(columns.find(column => column.key === 'progress')!.render(order, 0))
    assert.ok(inputs.includes('加工对象：毛织片'))
    assert.ok(inputs.includes(order.partName!))
    assert.doesNotMatch(inputs + progress, /菲票/)
    assert.match(progress, /毛织片实际交出批次/)
  }
})


test('成衣投入不把冻结 BOM 中的布料照片当作成衣实物', () => {
  const order = getSpecialCraftTaskOrders('AUX-OP-HEAT-TRANSFER')[0]
  resetSpecialCraftDisplayContext()
  const input = createSpecialCraftDisplayColumns(order => order.taskOrderNo).find(column => column.key === 'inputs')!.render(order, 0)
  assert.doesNotMatch(input, /grey-main-fabric/)
  assert.match(text(input), /加工对象：成衣/)
})

test('交出接收是下游实收时间，不能冒充本厂接收时间', () => {
  const original = getSpecialCraftTaskOrders('AUX-OP-DALAN')[0]
  const order = {...original, nodeRecords:[
    {...original.nodeRecords[0],actionName:'接收确认',operatedAt:'2026-10-16 09:00:00'},
    {...original.nodeRecords[0],actionName:'交出接收',operatedAt:'2026-10-17 10:00:00'},
  ]}
  resetSpecialCraftDisplayContext()
  const times = text(createSpecialCraftDisplayColumns(order => order.taskOrderNo).find(column => column.key === 'times')!.render(order, 0))
  assert.match(times, /最近接收：2026-10-16 09:00:00/)
  assert.match(times, /最近下游实收：2026-10-17 10:00:00/)
  assert.doesNotMatch(times, /最近交出：2026-10-17 10:00:00/)
})


test('历史交出字段缺失时只读精确同单位单笔，不把缺失当零或多笔相加', () => {
  const original = getSpecialCraftTaskOrders('AUX-OP-DALAN')[0]
  const source = getSpecialCraftTaskOrders('AUX-OP-DALAN').flatMap(order => getHandoverRecordsByWorkOrderId(order.taskOrderId))[0]
  assert.ok(source)
  const records = [{...source, workOrderId:original.taskOrderId, qtyUnit:original.outputUnit || original.unit, handoverObjectQty:1000}]
  assert.equal(records.length, 1)
  const order = {...original, handedOverQty:undefined, returnedQty:undefined}
  assert.equal(resolveSpecialCraftHandedOverQty(order, records), 1000)
  assert.equal(resolveSpecialCraftHandedOverQty({...order, handedOverQty:0}, records), 0)
  assert.equal(resolveSpecialCraftHandedOverQty(order, []), undefined)
  assert.equal(resolveSpecialCraftHandedOverQty(order, [{...records[0],qtyUnit:'米'}]), undefined)
  assert.equal(resolveSpecialCraftHandedOverQty(order, [{...records[0],workOrderId:'other-order'}]), undefined)
  assert.equal(resolveSpecialCraftHandedOverQty(order, [...records,{...records[0],handoverRecordId:'second-batch'}]), undefined)
})

test('多笔无归并身份的交出逐笔展示而不合并为2400，已有交出时间不遗漏', () => {
  const order = getSpecialCraftTaskOrders('AUX-OP-DALAN').find(order => order.taskOrderNo === 'AUX-PO14672-8-07')!
  resetSpecialCraftDisplayContext()
  const records = getHandoverRecordsByWorkOrderId(order.taskOrderId)
  assert.ok(records.length > 1)
  const columns = createSpecialCraftDisplayColumns(order => order.taskOrderNo)
  const quantities = text(renderSpecialCraftQuantities(order))
  assert.match(quantities, /已交出：汇总未记录/)
  assert.doesNotMatch(quantities, /已交出：0 片|已交出：2,400 片/)
  const outputs = text(columns.find(column => column.key === 'outputs')!.render(order, 0))
  for (const record of records) assert.ok(outputs.includes(record.handoverRecordNo))
  const times = text(columns.find(column => column.key === 'times')!.render(order, 0))
  assert.ok(times.includes(`最近交出：${latestSpecialCraftRecordedTime(records.map(record => record.handoverAt))}`))
  assert.ok(times.includes(`最近下游实收：${latestSpecialCraftRecordedTime(records.map(record => record.receiveAt))}`))
})

test('最近真实时间按发生时间比较，不依赖记录顺序且忽略无效项', () => {
  assert.equal(latestSpecialCraftRecordedTime(['2026-10-17 10:00:00','2026-10-16 11:00:00','',undefined,'invalid']), '2026-10-17 10:00:00')
  assert.equal(latestSpecialCraftRecordedTime(['2026-10-17T10:00:00+07:00','2026-10-17T03:30:00Z']), '2026-10-17T03:30:00Z')
  assert.equal(latestSpecialCraftRecordedTime(['invalid','']), undefined)
})


test('毛织片展示业务SKU，不把内部pieceKey当投入SKU', () => {
  const order = getSpecialCraftTaskOrders('AUX-OP-SEAM-EMBROIDERY').find(order => order.taskOrderNo === 'HJ260918-006-Q2-step1')!
  assert.ok(order)
  resetSpecialCraftDisplayContext()
  const input = text(createSpecialCraftDisplayColumns(order => order.taskOrderNo).find(column => column.key === 'inputs')!.render(order, 0))
  assert.match(input, /毛织 SKU：CARDIGAN-CREAM-M/)
  assert.doesNotMatch(input, /WOOL-STAGE-006:Q2/)
})

test('BOM物料展示精确档案业务SKU，不显示内部materialSkuId', () => {
  for (const id of ['AUX-OP-COVERED-BUTTON-MAKING','SPC-OP-ELASTIC-FIXED-LENGTH-CUTTING']) {
    const order = getSpecialCraftTaskOrders(id)[0]
    resetSpecialCraftDisplayContext()
    const rawInput = createSpecialCraftDisplayColumns(order => order.taskOrderNo).find(column => column.key === 'inputs')!.render(order, 0)
    const input = text(rawInput)
    assert.doesNotMatch(rawInput, /material_accessory_elastic_001_sku_001/)
    assert.match(input, /物料 SKU：ACC-ELASTIC-42CM-WHITE/)
    assert.doesNotMatch(input, /material_accessory_elastic_001_sku_001/)
  }
})
