#!/usr/bin/env tsx

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  buildBindingProcessOrders,
  buildBindingStripRequiredLengthFormula,
  calculateBindingStripRawRequiredLengthM,
  calculateBindingStripRequiredLengthM,
  listBindingStripRequirementLines,
  summarizeBindingStripRequirementsForCutOrders,
} from '../src/pages/process-factory/cutting/binding-strip-orders.ts'
import {
  buildFeiTicketLabelPrintDocument,
  renderLabelPrintTemplate,
} from '../src/pages/print/templates/label-print-template.ts'

const ROOT = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function assertIncludes(source: string, needle: string, message: string): void {
  assert(source.includes(needle), `${message}：缺少 ${needle}`)
}

function assertNotIncludes(source: string, needle: string, message: string): void {
  assert(!source.includes(needle), `${message}：不应包含 ${needle}`)
}

function main(): void {
  const rawRequiredLength = calculateBindingStripRawRequiredLengthM(500, 4, 100)
  const requiredLength = calculateBindingStripRequiredLengthM(500, 4, 100)
  assert.equal(rawRequiredLength, 0.26, `捆条原始长度公式错误：${rawRequiredLength}`)
  assert.equal(requiredLength, 4, `捆条长度不足 4m 时必须按 4m 计算：${requiredLength}`)
  assertIncludes(
    buildBindingStripRequiredLengthFormula(500, 4, 100),
    '× 1.3',
    '捆条长度公式必须体现固定损耗补偿',
  )
  assertIncludes(
    buildBindingStripRequiredLengthFormula(500, 4, 100),
    '不足 4m',
    '捆条长度公式必须体现 4m 起算规则',
  )

  const requirementLines = listBindingStripRequirementLines()
  assert(requirementLines.length > 0, '缺少从纸样包派生的捆条需求')
  assert(requirementLines.every((line) => line.materialSku && line.patternFileId && line.bindingWidthCm > 0 && line.requiredLengthM > 0), '捆条需求必须按物料+纸样+宽度落数据')
  assert(requirementLines.some((line) => line.rawRequiredLengthM > 0 && line.minRequiredLengthApplied && line.requiredLengthM === 4), '捆条 mock 数据必须展示不足 4m 按 4m 起算')
  assert(requirementLines.some((line) => line.rawRequiredLengthM >= 4 && !line.minRequiredLengthApplied && line.requiredLengthM === line.rawRequiredLengthM), '捆条 mock 数据必须展示超过 4m 按公式结果计算')

  const orders = buildBindingProcessOrders()
  const allowedMainStatuses = new Set(['待加工', '加工中', '已完成', '已取消'])
  const forbiddenMainStatuses = ['裁剪完成', '异常处理中', '已打印菲票', '已入仓暂存', '已装袋待交出', '已交出']
  assert(orders.length > 0, '缺少捆条加工单')
  assert(orders.every((order) => allowedMainStatuses.has(order.status)), '捆条加工单主状态只能是待加工、加工中、已完成、已取消')
  forbiddenMainStatuses.forEach((status) => {
    assert(!orders.some((order) => order.status === status), `捆条加工单主状态不允许出现：${status}`)
  })

  const detailTicketNos = orders.flatMap((order) => order.bindingDetails.map((detail) => detail.feiTicketNo))
  assert(detailTicketNos.length > 0, '捆条明细缺少菲票号')
  assert.equal(new Set(detailTicketNos).size, detailTicketNos.length, '每个捆条宽度规格必须有唯一菲票号')
  assert(orders.some((order) => order.bindingDetails.some((detail) => detail.minRequiredLengthApplied && detail.rawRequiredLength > 0 && detail.requiredLength === 4)), '捆条加工单计划长度必须承接 4m 起算规则')
  assert(orders.some((order) => order.bindingDetails.some((detail) => detail.rawRequiredLength >= 4 && !detail.minRequiredLengthApplied && detail.requiredLength === detail.rawRequiredLength)), '捆条加工单计划长度必须覆盖不触发 4m 起算的场景')
  assert(orders.some((order) => new Set(order.bindingDetails.map((detail) => detail.bindingWidth)).size > 1), '缺少同一加工单多规格捆条明细')
  assert(orders.some((order) => order.status === '加工中' && order.cuttingRecords.length > 0), '缺少加工中分批裁剪记录')
  assert(orders.some((order) => order.status === '已完成' && order.cuttingRecords.length > 1), '缺少多次裁剪后完成的记录')
  assert(orders.some((order) => order.differenceStatus === '有差异' && order.differenceRecords.some((record) => record.differenceType === '手动结束差异')), '缺少只记录差异的手动结束场景')
  assert(orders.every((order) => !order.sourceSpreadingOrderId && !order.sourceSpreadingOrderNo), '捆条加工单不应绑定具体铺布单')
  assert(orders.some((order) => order.printStatus === '已打印' || order.printStatus === '待打印'), '缺少捆条菲票打印派生状态')
  assert(orders.some((order) => order.inboundStatus === '已入仓' || order.inboundStatus === '部分入仓'), '缺少捆条入仓派生状态')
  assert(orders.some((order) => order.handoverStatus === '已装袋待交出' || order.handoverStatus === '已交出'), '缺少捆条装袋交出派生状态')

  const fallbackOrders = buildBindingProcessOrders([])
  assert(fallbackOrders.length > 0, '上游裁片单投影为空时，捆条加工单必须有部署兜底演示数据')
  assert(fallbackOrders.some((order) => order.remark.includes('部署环境兜底演示数据')), '兜底捆条加工单必须标注数据来源')
  assert(fallbackOrders.some((order) => order.bindingDetails.some((detail) => detail.minRequiredLengthApplied && detail.requiredLength === 4)), '兜底捆条加工单必须展示不足 4m 按 4m 起算')
  assert(fallbackOrders.some((order) => order.bindingDetails.some((detail) => detail.rawRequiredLength >= 4 && !detail.minRequiredLengthApplied)), '兜底捆条加工单必须展示超过 4m 按公式结果计算')

  const firstOrder = orders[0]
  const summary = summarizeBindingStripRequirementsForCutOrders([firstOrder.sourceCutOrderId])
  assert(summary.totalRequiredLengthM > 0, '按裁片单汇总捆条需求失败')
  assert(summary.widthSummaries.length > 0, '按物料+宽度汇总捆条需求失败')
  assert(summary.minRequiredLengthApplied, '按裁片单汇总必须保留 4m 起算提示')

  const printableBindingOrder = orders.find((order) => order.bindingDetails.some((detail) => detail.printStatus !== '未生成'))
  assert(printableBindingOrder, '缺少可打印的捆条菲票明细')
  const bindingPrintSourceId = printableBindingOrder.bindingDetails
    .filter((detail) => detail.printStatus !== '未生成')
    .map((detail) => detail.feiTicketId)
    .join(',')
  const bindingPrintDoc = buildFeiTicketLabelPrintDocument({
    documentType: 'FEI_TICKET_LABEL',
    sourceType: 'FEI_TICKET_RECORD',
    sourceId: bindingPrintSourceId,
  })
  const bindingPrintHtml = renderLabelPrintTemplate(bindingPrintDoc)
  assertIncludes(bindingPrintHtml, '捆条菲票标签', '捆条菲票打印预览缺少文档标题')
  assertIncludes(bindingPrintHtml, 'SPU:', '捆条菲票标签头部必须参考裁片部位菲票展示 SPU')
  assertIncludes(bindingPrintHtml, printableBindingOrder.sourceProductionOrderNo, '捆条菲票标签头部必须展示生产单号')
  assertIncludes(bindingPrintHtml, '捆条宽度', '捆条菲票打印预览缺少捆条宽度')
  assertIncludes(bindingPrintHtml, '计划长度', '捆条菲票打印预览缺少计划长度')
  assertIncludes(bindingPrintHtml, '实际长度', '捆条菲票打印预览缺少实际长度')
  assertNotIncludes(bindingPrintHtml, '编号区间', '捆条菲票打印预览不允许回退为部位菲票字段')
  assertNotIncludes(bindingPrintHtml, '部位数量', '捆条菲票打印预览不允许展示普通裁片字段')
  assertNotIncludes(bindingPrintHtml, '适用SKU', '捆条菲票打印预览不允许展示普通裁片字段')
  assertNotIncludes(bindingPrintHtml, '特殊工艺 / 承接工厂', '捆条菲票打印预览不允许展示普通裁片字段')

  const specialProcessModel = read('src/pages/process-factory/cutting/special-processes-model.ts')
  const specialProcessPage = read('src/pages/process-factory/cutting/special-processes.ts')
  const markerSpreadingPage = read('src/pages/process-factory/cutting/marker-spreading.ts')
  const markerPlanPage = read('src/pages/process-factory/cutting/marker-plan.ts')
  const feiTicketsPage = read('src/pages/process-factory/cutting/fei-tickets.ts')
  const cutOrdersPage = read('src/pages/process-factory/cutting/cut-orders.ts')
  const productionProgressPage = read('src/pages/process-factory/cutting/production-progress.ts')

  assert(!/BindingProcessStatus = [^\n]*异常处理中/.test(specialProcessModel), '捆条加工主状态不能包含异常处理中')
  assert(!/BindingProcessStatus = [^\n]*已入仓/.test(specialProcessModel), '捆条加工主状态不能把入仓当加工状态')
  assertNotIncludes(specialProcessPage, 'data-testid="cutting-binding-list-overview"', '捆条加工单页面顶部汇总块已要求删除')
  assertNotIncludes(specialProcessPage, '捆条加工单列表', '捆条加工单页面顶部说明标题已要求删除')
  assertIncludes(specialProcessPage, '不足 4m 按 4m', '捆条加工单页面缺少 4m 起算提示')
  assertIncludes(markerSpreadingPage, 'binding-strip-spreading-confirmation', '创建铺布单第二步缺少捆条二次确认提示')
  assertIncludes(markerSpreadingPage, 'window.confirm', '确认生成铺布单缺少捆条二次确认')
  assertIncludes(markerSpreadingPage, '铺布单不会分摊捆条加工长度', '铺布确认缺少不分摊到具体铺布单说明')
  assertIncludes(markerPlanPage, '捆条加工长度', '唛架方案缺少捆条加工长度')
  assertIncludes(markerPlanPage, '物料总用量', '唛架方案缺少包含捆条的物料总用量')
  assertIncludes(read('src/pages/process-factory/cutting/binding-strip-orders.ts'), '不足 4m 的捆条明细已按 4m 起算', '唛架方案捆条公式缺少 4m 起算说明')
  assertIncludes(feiTicketsPage, 'fei-ticket-print-workbench', '菲票打印页面必须使用统一菲票打印列表')
  assertIncludes(feiTicketsPage, '菲票打印列表', '菲票打印页面缺少统一列表标题')
  assertIncludes(feiTicketsPage, 'SPREADING_ORDER', '菲票打印对象类型缺少铺布单')
  assertIncludes(feiTicketsPage, 'BINDING_STRIP_ORDER', '菲票打印对象类型缺少捆条加工单')
  assertIncludes(feiTicketsPage, '全部打印', '菲票打印列表操作必须包含全部打印')
  assertIncludes(feiTicketsPage, '菲票明细', '菲票打印列表操作必须包含菲票明细')
  assertNotIncludes(feiTicketsPage, 'binding-fei-ticket-workbench', '菲票打印页面不允许保留独立捆条菲票区块')
  assertNotIncludes(feiTicketsPage, 'renderBindingFeiTicketTable', '菲票打印页面不允许继续渲染独立捆条表')
  assertNotIncludes(feiTicketsPage, '查库存', '菲票打印页面不允许出现捆条查库存操作')
  assertNotIncludes(feiTicketsPage, '流转状态', '菲票打印页面不允许把捆条入仓/装袋/交出作为打印列表状态')
  assertNotIncludes(feiTicketsPage, '部位菲票明细', '菲票打印列表操作文案必须统一为菲票明细')
  assertIncludes(read('src/pages/print/templates/label-print-template.ts'), 'BINDING_STRIP', '打印模板缺少捆条菲票字段切换')
  assertIncludes(read('src/pages/print/templates/label-print-template.ts'), '捆条宽度', '捆条菲票打印模板缺少捆条宽度')
  assertIncludes(read('src/pages/print/templates/label-print-template.ts'), '计划长度', '捆条菲票打印模板缺少计划长度')
  assertIncludes(cutOrdersPage, '捆条加工单', '裁片单详情缺少捆条加工单信息')
  assertIncludes(productionProgressPage, 'bindingProcessOrders', '裁床总览缺少捆条加工单链路数据')
  assertIncludes(productionProgressPage, '捆条加工：', '裁床总览裁片单卡片缺少捆条加工展示')

  console.log(
    [
      '捆条加工单流转检查通过',
      `捆条需求明细：${requirementLines.length} 条`,
      `捆条加工单：${orders.length} 单`,
      `唯一捆条菲票：${detailTicketNos.length} 张`,
      `示例汇总长度：${summary.totalRequiredLengthM.toFixed(2)} m`,
    ].join('\n'),
  )
}

main()
