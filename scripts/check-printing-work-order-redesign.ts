import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import {
  PRINTING_HANDOVER_STATUSES,
  PRINTING_PROCESSING_STATUSES,
  PRINTING_RECEIPT_STATUSES,
  changePrintingInput,
  completePrintWorkOrderDocument,
  completePrintingWorkOrder,
  formatPrintingWeightKg,
  getPrintingWorkOrderById,
  handoverPrintingOutput,
  isPrintingWorkOrderBusinessCompleted,
  listPrintingWorkOrders,
  metersFromYards,
  receivePrintingHandover,
  receivePrintingInput,
  resetPrintingWorkOrderBusinessStore,
  updatePrintingRollBarcode,
  weightKgFromMeters,
} from '../src/data/fcs/printing-work-order-business.ts'
import { buildPrintDocument, renderPrintDocument } from '../src/data/fcs/print-template-registry.ts'
import { renderCraftPrintingWorkOrderDetailPage } from '../src/pages/process-factory/printing/work-order-detail.ts'
import { renderCraftPrintingWorkOrdersPage } from '../src/pages/process-factory/printing/work-orders.ts'

resetPrintingWorkOrderBusinessStore()

assert.deepEqual(
  PRINTING_PROCESSING_STATUSES.map((item) => item.label),
  ['待分配', '待接收投入', '加工中', '加工完成', '已取消'],
  '加工状态必须保持现场可执行的五态',
)
assert.deepEqual(
  PRINTING_RECEIPT_STATUSES.map((item) => item.label),
  ['待来源', '待接收', '部分接收', '已收齐', '差异待处理'],
  '接收状态必须独立保持五态',
)
assert.deepEqual(
  PRINTING_HANDOVER_STATUSES.map((item) => item.label),
  ['未到交出', '待交出', '部分交出', '全部交出'],
  '交出状态只由本单完成量和交出量形成四态',
)

const rows = listPrintingWorkOrders()
assert.deepEqual(
  [...new Set(rows.map((row) => row.demandSource.type))].sort(),
  ['PRODUCTION', 'STOCK'],
  '旧6例来源必须忠实底层5生产+1备货；三来源正式生成由check-printing-business-source-identity覆盖，不伪造采购或补料标签',
)
for (const row of rows) {
  assert.equal(row.plannedInput.objectType, row.output.objectType, `${row.printOrderNo} 投入与产出的 BOM 对象类别必须一致`)
  assert.equal(row.plannedInput.qtyUnit, row.output.qtyUnit, `${row.printOrderNo} 计划、完成与交接必须沿用同一 BOM 数量单位`)
  assert.ok(row.plannedInput.objectType, `${row.printOrderNo} 缺 BOM 对象类别`)
  assert.ok(row.plannedInput.qtyUnit, `${row.printOrderNo} 缺 BOM 数量单位`)
  assert.ok(row.plannedInput.sku, `${row.printOrderNo} 缺计划投入 SKU`)
  assert.ok(row.output.sku, `${row.printOrderNo} 缺固定产出 SKU`)
  assert.ok(!renderCraftPrintingWorkOrderDetailPage(row.workOrderId).includes('缺少对应图片'), `${row.printOrderNo} 命名场景不得缺图`)
  assert.equal(row.output.sku, row.barcodes[0]?.sku || row.output.sku, `${row.printOrderNo} 卷条码必须绑定产出 SKU`)
  assert.ok(!('editConfirmation' in row), '业务模型不得保留 Edit confirmation')
  assert.ok(row.product.imageUrl && existsSync(new URL(`../public${row.product.imageUrl}`, import.meta.url)), `${row.printOrderNo} 商品图片资源不存在`)
  assert.ok(row.plannedInput.imageUrl && existsSync(new URL(`../public${row.plannedInput.imageUrl}`, import.meta.url)), `${row.printOrderNo} 投入图片资源不存在`)
  assert.ok(row.output.imageUrl && existsSync(new URL(`../public${row.output.imageUrl}`, import.meta.url)), `${row.printOrderNo} 产出图片资源不存在`)
  assert.ok(row.requirement.frontPattern.imageUrl && existsSync(new URL(`../public${row.requirement.frontPattern.imageUrl}`, import.meta.url)), `${row.printOrderNo} 正面花型图片资源不存在`)
  if (row.requirement.insidePattern) assert.ok(row.requirement.insidePattern.imageUrl && existsSync(new URL(`../public${row.requirement.insidePattern.imageUrl}`, import.meta.url)), `${row.printOrderNo} 里面花型图片资源不存在`)
}
assert.ok(rows.some((row) => row.plannedInput.objectType === '纱线'), '演示数据必须保留 BOM 纱线印花反例，不能把页面对象写死为面料')

const calculated = rows.find((row) => row.usage.calculationMode === 'BY_USAGE')
assert.ok(calculated)
assert.equal(
  calculated.plannedInput.plannedQty,
  Math.round((calculated.usage.demandBaseQty * calculated.usage.orderUnitUsage! + Number.EPSILON) * 100) / 100,
  '按用量计算的计划投入必须等于需求基数乘加工单单位用量',
)
assert.ok(rows.some((row) => row.usage.calculationMode === 'DIRECT' && row.usage.orderUnitUsage === null), '采购/备货直给数量不得伪造 0 单位用量')

assert.equal(metersFromYards(48), 43.89)
assert.equal(weightKgFromMeters(10, 165, 220), 3.63)
assert.equal(formatPrintingWeightKg(12.3456), '12.346', 'KG 必须固定显示 3 位小数')

const changeTarget = rows.find((row) => row.processingStatus === 'WAIT_INPUT_RECEIPT')
assert.ok(changeTarget)
const originalOutputSku = changeTarget.output.sku
assert.throws(() => changePrintingInput(changeTarget.workOrderId, {
  newSku: `${changeTarget.plannedInput.spu}-CROSS-SPEC`,
  newMaterialName: '跨规格测试面料',
  newImageUrl: '',
  newGsm: changeTarget.plannedInput.gsm + 20,
  newWidthCm: changeTarget.plannedInput.widthCm + 5,
  reason: '专项检查：跨规格换料',
  operatorName: '专项检查员',
}), /加工单单位用量/, '跨规格换料缺加工单单位用量时必须阻断')

changePrintingInput(changeTarget.workOrderId, {
  newSku: `${changeTarget.plannedInput.spu}-CROSS-SPEC`,
  newMaterialName: '跨规格测试面料',
  newImageUrl: '',
  newGsm: changeTarget.plannedInput.gsm + 20,
  newWidthCm: changeTarget.plannedInput.widthCm + 5,
  newStandardUnitUsage: 1.4800,
  newOrderUnitUsage: 1.5000,
  reason: '专项检查：跨规格换料',
  operatorName: '专项检查员',
})
const changed = getPrintingWorkOrderById(changeTarget.workOrderId)
assert.ok(changed)
assert.equal(changed.output.sku, originalOutputSku, '换投入不得改产出 SKU')
assert.equal(changed.inputChanges.length, 1)
assert.equal(changed.printingDocumentsNeedReprint, true)
assert.equal(changed.actualInput.actualSku, '', '尚未实际接收时不得把计划换料冒充为实际投入')

receivePrintingInput(changeTarget.workOrderId, {
  actualSku: changed.plannedInput.sku,
  receivedQty: changed.plannedInput.plannedQty,
  receivedRollCount: 3,
  receiverName: '专项检查接收人',
  receiptId: 'CHECK-PRINT-REDESIGN-RECEIPT',
  upstreamRecordId: 'CHECK-PRINT-REDESIGN-SOURCE',
})
assert.equal(getPrintingWorkOrderById(changeTarget.workOrderId)?.processingStatus, 'PROCESSING')
assert.throws(() => completePrintingWorkOrder(changeTarget.workOrderId, {
  usedQty: changed.plannedInput.plannedQty + 1,
  usedRollCount: 3,
  completedQty: changed.plannedInput.plannedQty,
  completedRollCount: 3,
  printerNo: 'PRINT-01',
  operatorName: '专项检查员',
}), /实际接收/, '实际使用不得超过实际接收')

completePrintingWorkOrder(changeTarget.workOrderId, {
  usedQty: changed.plannedInput.plannedQty,
  usedRollCount: 3,
  completedQty: changed.plannedInput.plannedQty - 2,
  completedRollCount: 3,
  printerNo: 'PRINT-01',
  operatorName: '专项检查员',
})
const completedAfterChange = getPrintingWorkOrderById(changeTarget.workOrderId)
assert.ok(completedAfterChange)
assert.equal(completedAfterChange.processingStatus, 'PROCESS_COMPLETED')
assert.equal(completedAfterChange.handoverStatus, 'WAIT_HANDOVER')
assert.equal(completedAfterChange.barcodes.length, 3, '完成卷数必须生成等量产出卷条码')
assert.ok(completedAfterChange.barcodes.every((barcode) => barcode.sku === originalOutputSku), '完成后卷条码必须绑定固定产出 SKU')

const firstBarcode = completedAfterChange.barcodes[0]
updatePrintingRollBarcode(changeTarget.workOrderId, firstBarcode.id, {
  meters: firstBarcode.meters,
  gsm: completedAfterChange.output.gsm,
  widthCm: completedAfterChange.output.widthCm,
  vatNo: 'VAT-CHECK-01',
  warehouseName: 'HILON-面料仓',
  remark: '专项检查卷',
})
assert.match(formatPrintingWeightKg(getPrintingWorkOrderById(changeTarget.workOrderId)!.barcodes[0].weightKg), /^\d+\.\d{3}$/, '卷重量必须为 KG 三位小数')

assert.throws(() => handoverPrintingOutput(changeTarget.workOrderId, {
  qty: completedAfterChange.output.completedQty + 1,
  barcodeIds: [firstBarcode.id],
  operatorName: '专项检查交出人',
  receiverName: '专项检查接收人',
}), /剩余可交/, '交出数量不得超过加工完成数量')

const refreshedAfterBarcodeUpdate = getPrintingWorkOrderById(changeTarget.workOrderId)!
const firstHandoverQty = refreshedAfterBarcodeUpdate.barcodes[0].lengthY
handoverPrintingOutput(changeTarget.workOrderId, {
  qty: firstHandoverQty,
  barcodeIds: [firstBarcode.id],
  operatorName: '专项检查交出人',
  receiverName: completedAfterChange.receivingTargetName,
})
assert.equal(getPrintingWorkOrderById(changeTarget.workOrderId)?.handoverStatus, 'PARTIAL_HANDOVER')
assert.throws(() => receivePrintingHandover(changeTarget.workOrderId, {
  receivedQty: firstHandoverQty + 1,
  receiverName: '专项检查接收人',
}), /待接收/, '接收数量不得超过累计交出未接收数量')
receivePrintingHandover(changeTarget.workOrderId, { receivedQty: firstHandoverQty, receiverName: '专项检查接收人' })
assert.equal(getPrintingWorkOrderById(changeTarget.workOrderId)?.handoverStatus, 'PARTIAL_HANDOVER', '下游接收不得改变本单交出状态')

const remainingHandoverQty = refreshedAfterBarcodeUpdate.barcodes.slice(1).reduce((sum, barcode) => sum + barcode.lengthY, 0)
handoverPrintingOutput(changeTarget.workOrderId, {
  qty: remainingHandoverQty,
  barcodeIds: completedAfterChange.barcodes.slice(1).map((barcode) => barcode.id),
  operatorName: '专项检查交出人',
  receiverName: completedAfterChange.receivingTargetName,
})
assert.equal(getPrintingWorkOrderById(changeTarget.workOrderId)?.handoverStatus, 'FULL_HANDOVER')
receivePrintingHandover(changeTarget.workOrderId, { receivedQty: remainingHandoverQty, receiverName: '专项检查接收人' })
const fullyReceived = getPrintingWorkOrderById(changeTarget.workOrderId)
assert.ok(fullyReceived)
assert.equal(fullyReceived.handoverStatus, 'FULL_HANDOVER', '下游全部接收也不得改变本单交出状态')
assert.equal(isPrintingWorkOrderBusinessCompleted(fullyReceived), false, '下游全部接收不得自动冒充加工单人工完成')
completePrintWorkOrderDocument(changeTarget.workOrderId, { operatorName: '专项检查主管' })
const manuallyCompleted = getPrintingWorkOrderById(changeTarget.workOrderId)
assert.ok(manuallyCompleted)
assert.equal(isPrintingWorkOrderBusinessCompleted(manuallyCompleted), true, '必须由明确的人工完成单据动作进入业务已完成')
assert.equal(manuallyCompleted.manuallyCompletedBy, '专项检查主管')

const completed = rows.find((row) => row.output.completedQty > 0)
assert.ok(completed)
assert.throws(() => changePrintingInput(completed.workOrderId, {
  newSku: `${completed.plannedInput.spu}-FORBIDDEN`,
  newMaterialName: '禁止整单换料',
  newImageUrl: '',
  newGsm: completed.plannedInput.gsm,
  newWidthCm: completed.plannedInput.widthCm,
  reason: '专项检查',
  operatorName: '专项检查员',
}), /拆分剩余数量/, '已有完成数量时必须阻断整单换料')

resetPrintingWorkOrderBusinessStore()

const listHtml = renderCraftPrintingWorkOrdersPage()
for (const requiredText of [
  '需求来源', '加工投入', '加工产出', '接收状态', '加工状态', '交出状态',
  '印花信息单', '印花确认单', '产出卷条码',
  '计划投入', '实际使用', '完成', '已交', '下游已收',
  '售卖类型', '加工厂', '工艺', '下游接收方', '物料类型', '是否换料', '创建方式', '差异/异议',
]) assert.ok(listHtml.includes(requiredText), `印花列表遗漏：${requiredText}`)
for (const forbiddenText of ['历史提示：', '固定产出，不随投入换料改变', '历史损耗：', '（兼容）']) {
  assert.ok(!listHtml.includes(forbiddenText), `印花列表不应出现无操作价值文案：${forbiddenText}`)
}
assert.ok(!listHtml.includes('采购单数量'), '列表不得展示或关注线上采购单数量 572')
assert.ok(!listHtml.includes('打印任务流转卡'), '调整后的印花加工单不得暴露第四类打印单据')
assert.ok(!listHtml.includes('待回写'), '上下游交接文案必须统一为交出、接收，不得继续显示待回写')
assert.ok(listHtml.includes('data-printing-summary-row'), '六项汇总必须使用印花加工单单行容器')
assert.equal((listHtml.match(/data-printing-summary-item/g) || []).length, 6, '单行汇总必须完整展示六项指标')
const listHeaderTags = [...listHtml.matchAll(/<th[\s\S]*?<\/th>/g)].map((match) => match[0])
const headerTag = (key: string) => listHeaderTags.find((tag) => tag.includes(`data-column-key="${key}"`)) || ''
assert.match(listHeaderTags[0] || '', /data-column-key="order"/, '选择并入加工单第一列')
assert.equal(listHeaderTags.length, 7, '两端合并为七列')
assert.match(headerTag('order'), /\bsticky\b/, '加工单固定左侧')
assert.match(headerTag('actions'), /\bsticky\b/, '操作列必须固定在右侧')
assert.match(headerTag('actions'), /\bright-0\b/, '操作列必须固定在右侧起点')
for (const key of ['input', 'output']) assert.doesNotMatch(headerTag(key), /\bsticky\b/, `${key} 列必须随中间内容横向滚动`)
assert.match(headerTag('actions'), /width: 110px/, '操作列宽度必须收窄为 110px')
assert.ok(listHtml.includes('data-printing-row-actions'), '操作单元格必须声明双列动作布局')
assert.ok(listHtml.includes('grid-cols-2'), '操作单元格每行最多只能展示两个文字操作')

const detailHtml = renderCraftPrintingWorkOrderDetailPage(rows[0].workOrderId)
for (const requiredText of [
  '1. 基本信息', '2. 加工投入／上游', '3. 加工要求', '4. 加工记录', '5. 加工产出／下游', '6. 日志与单据',
  '用量依据', '接收批次', '投入调整历史', '打印历史', '操作日志',
]) assert.ok(detailHtml.includes(requiredText), `印花详情遗漏：${requiredText}`)
assert.ok(detailHtml.includes('标准单位用量') && detailHtml.includes('加工单单位用量'), '详情必须保留单位用量信息')
assert.ok(detailHtml.includes('data-printing-action="preview-image"'), '详情图片必须支持点击大图')

const dialogsSource = readFileSync(new URL('../src/pages/process-factory/printing/dialogs.ts', import.meta.url), 'utf8')
for (const requiredField of [
  'newSku', 'newMaterialName', 'newImageUrl', 'newGsm', 'newWidthCm', 'newStandardUnitUsage', 'newOrderUnitUsage', 'newPlannedQty', 'reason',
  'actualSku', 'receivedQty', 'receivedRollCount', 'receiverName',
  'usedQty', 'usedRollCount', 'completedQty', 'completedRollCount', 'printerNo',
  'handoverQty', 'handoverOperator', 'handoverReceiver', 'receiveQty', 'outputReceiver', 'objectionQty', 'differenceReason',
  'lengthY', 'meters', 'weightKg', 'gsm', 'widthCm', 'vatNo', 'warehouseName', 'barcodeRemark',
]) assert.ok(dialogsSource.includes(requiredField), `现场动作弹窗遗漏字段：${requiredField}`)
assert.ok(dialogsSource.includes('step: \'0.001\''), '卷重量输入步长必须为 KG 三位小数')

const infoDocument = buildPrintDocument({ documentType: 'PRINTING_INFO_SHEET', sourceType: 'PRINTING_WORK_ORDER', sourceId: rows[0].workOrderId })
const infoHtml = renderPrintDocument(infoDocument)
for (const requiredText of ['印花信息单', '需求来源', '用量依据', '加工投入', '印花要求与加工产出', '加工产出 SKU', '打印版本']) {
  assert.ok(infoHtml.includes(requiredText), `印花信息单遗漏：${requiredText}`)
}

const receivedDemo = rows.find((row) => row.handoverStatus === 'FULL_HANDOVER' && row.handover.receivedQty >= row.handover.handedOverQty)!
const confirmationDocument = buildPrintDocument({ documentType: 'PRINTING_CONFIRMATION', sourceType: 'PRINTING_WORK_ORDER', sourceId: receivedDemo.workOrderId })
const confirmationHtml = renderPrintDocument(confirmationDocument)
for (const requiredText of ['Print confirmation', 'Pattern transfer confirmation', 'Storage / Gudang', 'Remark', '加工投入 SKU', '加工产出 SKU']) {
  assert.ok(confirmationHtml.includes(requiredText), `印花确认单遗漏：${requiredText}`)
}
assert.ok(!confirmationHtml.includes('Edit confirmation'), '印花确认单必须忽略 Edit confirmation')

const batchConfirmationDocument = buildPrintDocument({ documentType: 'PRINTING_CONFIRMATION', sourceType: 'PRINTING_WORK_ORDER', sourceId: rows.slice(0, 2).map((row) => row.workOrderId).join(',') })
assert.equal(batchConfirmationDocument.relatedObjectIds?.length, 2, '批量印花确认单必须保留全部选中加工单')
const rollBarcodeId = getPrintingWorkOrderById(receivedDemo.workOrderId)!.barcodes[0].id
const rollLabelDocument = buildPrintDocument({ documentType: 'PRINTING_ROLL_LABEL', sourceType: 'PRINTING_ROLL_RECORD', sourceId: `${receivedDemo.workOrderId}:${rollBarcodeId}` })
const rollLabelHtml = renderPrintDocument(rollLabelDocument)
assert.equal(rollLabelDocument.documentTitle, '加工产出卷条码')
for (const requiredText of ['印花加工产出卷', '产出 SKU', '数量', receivedDemo.output.qtyUnit, '重量', '克重/幅宽', '缸号', '入库仓库', '备注']) {
  assert.ok(rollLabelHtml.includes(requiredText), `加工产出卷条码遗漏：${requiredText}`)
}
assert.ok(rollLabelHtml.includes('.000 KG') || /\d+\.\d{3} KG/.test(rollLabelHtml), '卷条码重量必须以 KG 三位小数展示')

resetPrintingWorkOrderBusinessStore()
console.log(`印花加工单重构专项检查通过：${rows.length} 张正式域旧例按底层来源可读；接收、加工、交出三维状态，换料、数量、交出与下游实收、列表详情、图片及三类打印契约通过。`)
