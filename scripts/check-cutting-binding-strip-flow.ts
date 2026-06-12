#!/usr/bin/env tsx

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import path from 'node:path'

import { appStore } from '../src/state/store.ts'
import {
  buildBindingProcessOrders,
  buildBindingStripRequiredLengthFormula,
  calculateBindingStripRawRequiredLengthM,
  calculateBindingStripRequiredLengthM,
  listBindingStripRequirementLines,
  summarizeBindingStripRequirementsForCutOrders,
} from '../src/pages/process-factory/cutting/binding-strip-orders.ts'
import {
  renderCraftCuttingSpecialProcessDetailPage,
  renderCraftCuttingSpecialProcessesPage,
} from '../src/pages/process-factory/cutting/special-processes.ts'
import { renderCraftCuttingFeiTicketsPage } from '../src/pages/process-factory/cutting/fei-tickets.ts'
import { renderCraftCuttingWarehouseManagementWaitHandoverPage } from '../src/pages/process-factory/cutting/warehouse-hub.ts'
import { renderPrintPreviewPage } from '../src/pages/print/print-preview.ts'
import {
  buildFeiTicketLabelPrintDocument,
  renderLabelPrintTemplate,
} from '../src/pages/print/templates/label-print-template.ts'

const ROOT = process.cwd()
const BUTTON_RESPONSE_BUDGET_MS = 200

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function assertIncludes(source: string, needle: string, message: string): void {
  assert(source.includes(needle), `${message}：缺少 ${needle}`)
}

function assertNotIncludes(source: string, needle: string, message: string): void {
  assert(!source.includes(needle), `${message}：不应包含 ${needle}`)
}

function measureRender(name: string, render: () => string): number {
  const startedAt = performance.now()
  const html = render()
  assert(html.length > 0, `${name} 渲染结果不能为空`)
  return performance.now() - startedAt
}

function assertUnderBudget(name: string, elapsedMs: number): void {
  assert(
    elapsedMs <= BUTTON_RESPONSE_BUDGET_MS,
    `${name} 响应超过 ${BUTTON_RESPONSE_BUDGET_MS}ms：${elapsedMs.toFixed(2)}ms`,
  )
}

function assertCloseTo(actual: number, expected: number, message: string): void {
  assert(Math.abs(actual - expected) <= 0.01, `${message}：实际 ${actual.toFixed(2)}，期望 ${expected.toFixed(2)}`)
}

function main(): void {
  const rawRequiredLength = calculateBindingStripRawRequiredLengthM(720, 3, 133.7)
  const requiredLength = calculateBindingStripRequiredLengthM(1, 3, 150)
  assert.equal(rawRequiredLength, 21, `捆条需要布料长度公式错误：${rawRequiredLength}`)
  assert.equal(requiredLength, 4, `捆条长度不足 4m 时必须按 4m 计算：${requiredLength}`)
  assertIncludes(
    buildBindingStripRequiredLengthFormula(720, 3, 133.7),
    '× 1.3',
    '捆条长度公式必须体现固定损耗补偿',
  )
  assertIncludes(
    buildBindingStripRequiredLengthFormula(1, 3, 150),
    '不足 4m',
    '捆条长度公式必须体现 4m 起算规则',
  )

  const requirementLines = listBindingStripRequirementLines()
  assert(requirementLines.length > 0, '缺少从纸样包派生的捆条需求')
  assert(requirementLines.every((line) => line.materialSku && line.patternFileId && line.bindingWidthCm > 0 && line.requiredLengthM > 0), '捆条需求必须按物料+纸样+宽度落数据')
  assert(requirementLines.every((line) => line.materialImageUrl), '捆条需求必须带布料图片')
  assert(requirementLines.every((line) => ['斜切', '直切', '横切'].includes(line.cuttingMethod)), '捆条需求必须带切割方式')
  assert(requirementLines.every((line) => line.plannedGarmentQty > 0 && line.unitBindingLengthM > 0 && line.plannedBindingLengthM > 0), '捆条需求必须带计划数量、单件捆条长度和捆条需要长度')
  assert(
    requirementLines.some((line) => line.rawRequiredLengthM > 0 && line.minRequiredLengthApplied && line.requiredLengthM === 4) ||
      buildBindingProcessOrders([]).some((order) => order.bindingDetails.some((detail) => detail.minRequiredLengthApplied && detail.requiredLength === 4)),
    '捆条 mock 数据必须展示不足 4m 按 4m 起算',
  )
  assert(requirementLines.some((line) => line.rawRequiredLengthM >= 4 && !line.minRequiredLengthApplied && line.requiredLengthM === line.rawRequiredLengthM), '捆条 mock 数据必须展示超过 4m 按公式结果计算')

  const orders = buildBindingProcessOrders()
  const allowedMainStatuses = new Set(['待加工', '加工中', '已完成', '已取消'])
  const forbiddenMainStatuses = ['裁剪完成', '异常处理中', '已打印菲票', '已入仓暂存', '已装袋待交出', '已交出']
  assert(orders.length > 0, '缺少捆条加工单')
  assert(orders.every((order) => allowedMainStatuses.has(order.status)), '捆条加工单主状态只能是待加工、加工中、已完成、已取消')
  assert(orders.every((order) => order.materialIdentity.materialImageUrl), '捆条加工单必须展示对应布料图片')
  forbiddenMainStatuses.forEach((status) => {
    assert(!orders.some((order) => order.status === status), `捆条加工单主状态不允许出现：${status}`)
  })

  const detailTicketNos = orders.flatMap((order) => order.bindingDetails.map((detail) => detail.feiTicketNo))
  assert(detailTicketNos.length > 0, '捆条明细缺少菲票号')
  assert.equal(new Set(detailTicketNos).size, detailTicketNos.length, '每个捆条宽度规格必须有唯一菲票号')
  assert(
    orders.some((order) => order.bindingDetails.some((detail) => detail.minRequiredLengthApplied && detail.rawRequiredLength > 0 && detail.requiredLength === 4)) ||
      buildBindingProcessOrders([]).some((order) => order.bindingDetails.some((detail) => detail.minRequiredLengthApplied && detail.rawRequiredLength > 0 && detail.requiredLength === 4)),
    '捆条加工单计划长度必须承接 4m 起算规则',
  )
  assert(orders.some((order) => order.bindingDetails.some((detail) => detail.rawRequiredLength >= 4 && !detail.minRequiredLengthApplied && detail.requiredLength === detail.rawRequiredLength)), '捆条加工单计划长度必须覆盖不触发 4m 起算的场景')
  assert(orders.every((order) => ['未领料', '已领料'].includes(order.materialReceiveStatus) && order.materialShelfLocation), '捆条加工单必须展示领料状态和货架位置')
  assert(orders.some((order) => order.receivedMaterialLength > 0 && order.actualTotalLength > 0 && order.actualRollCount > 0), '捆条加工单必须累计接收布料、实际完成长度和实切卷数')
  assert(orders.some((order) => order.sufficiencyStatus === '捆条不足' && order.shortageLength > 0), '缺少捆条不足和缺口长度判断')
  assert(orders.some((order) => new Set(order.bindingDetails.map((detail) => detail.bindingWidth)).size > 1), '缺少同一加工单多规格捆条明细')
  assert(orders.some((order) => order.status === '加工中' && order.cuttingRecords.length > 0), '缺少加工中分批裁剪记录')
  assert(orders.some((order) => order.status === '已完成' && order.cuttingRecords.length > 1), '缺少多次裁剪后完成的记录')
  const recordedCuttingRows = orders.flatMap((order) => order.cuttingRecords)
  assert(recordedCuttingRows.every((record) => record.rollLength > 0 && record.actualRollCount > 0), '每条捆条裁剪记录必须有每卷长度和实切卷数')
  recordedCuttingRows.forEach((record) => {
    assertCloseTo(record.actualLength, record.rollLength * record.actualRollCount, '捆条切割长度必须等于每卷长度 × 实切卷数')
  })
  assert(orders.some((order) => order.differenceStatus === '有差异' && order.differenceRecords.some((record) => record.differenceType === '手动结束差异')), '缺少只记录差异的手动结束场景')
  assert(orders.every((order) => !order.sourceSpreadingOrderId && !order.sourceSpreadingOrderNo), '捆条加工单不应绑定具体铺布单')
  assert(orders.some((order) => order.printStatus === '已打印' || order.printStatus === '待打印'), '缺少捆条菲票打印派生状态')
  assert(orders.some((order) => order.inboundStatus === '已入仓' || order.inboundStatus === '部分入仓'), '缺少捆条入仓派生状态')
  assert(orders.some((order) => order.handoverStatus === '已装袋待交出' || order.handoverStatus === '已交出'), '缺少捆条装袋交出派生状态')
  assertIncludes(renderCraftCuttingSpecialProcessesPage(), '<img', '捆条加工单列表必须渲染布料图片')
  assertIncludes(renderCraftCuttingSpecialProcessDetailPage(orders[0].bindingOrderId), '<img', '捆条加工单详情必须渲染布料图片')

  const fallbackOrders = buildBindingProcessOrders([])
  assert(fallbackOrders.length > 0, '上游裁片单投影为空时，捆条加工单必须有部署兜底演示数据')
  assert(fallbackOrders.some((order) => order.remark.includes('部署环境兜底演示数据')), '兜底捆条加工单必须标注数据来源')
  const fallbackDetails = fallbackOrders.flatMap((order) => order.bindingDetails)
  assert.deepEqual(new Set(fallbackDetails.map((detail) => detail.cuttingMethod)), new Set(['横切', '斜切', '直切']), '兜底捆条加工单必须覆盖横切、斜切、直切三种裁法')
  assert(fallbackDetails.some((detail) => detail.plannedGarmentQty === 600 && detail.unitBindingLength === 1.2 && detail.plannedBindingLength === 720), '兜底数据必须覆盖 600 × 1.2m = 720m 的捆条需要长度')
  assert(fallbackDetails.some((detail) => detail.plannedBindingLength === 720 && detail.requiredLength === 21), '兜底数据必须覆盖捆条需要长度 720m 和需要布料长度 21m')
  assert(fallbackOrders.some((order) => order.bindingDetails.some((detail) => detail.minRequiredLengthApplied && detail.requiredLength === 4)), '兜底捆条加工单必须展示不足 4m 按 4m 起算')
  assert(fallbackOrders.some((order) => order.bindingDetails.some((detail) => detail.rawRequiredLength >= 4 && !detail.minRequiredLengthApplied)), '兜底捆条加工单必须展示超过 4m 按公式结果计算')

  const firstOrder = orders.find((order) => order.bindingDetails.some((detail) => detail.minRequiredLengthApplied)) || orders[0]
  const summary = summarizeBindingStripRequirementsForCutOrders([firstOrder.sourceCutOrderId])
  assert(summary.totalRequiredLengthM > 0, '按裁片单汇总捆条需求失败')
  assert(summary.widthSummaries.length > 0, '按物料+宽度汇总捆条需求失败')
  assert(
    summary.minRequiredLengthApplied || fallbackOrders.some((order) => order.bindingDetails.some((detail) => detail.minRequiredLengthApplied)),
    '按裁片单汇总或兜底演示必须保留 4m 起算提示',
  )

  const printableBindingOrder = orders.find((order) => order.bindingDetails.some((detail) => detail.printStatus !== '未生成'))
  assert(printableBindingOrder, '缺少可打印的捆条菲票明细')
  const bindingPrintSourceId = printableBindingOrder.bindingDetails
    .filter((detail) => detail.printStatus !== '未生成')
    .map((detail) => detail.feiTicketId)
    .join(',')

  appStore.navigate('/fcs/craft/cutting/special-processes')
  const specialListRenderMs = measureRender('捆条加工单列表', () => renderCraftCuttingSpecialProcessesPage())
  appStore.navigate('/fcs/craft/cutting/binding-fei-tickets')
  const bindingFeiRenderMs = measureRender('捆条菲票打印页', () => renderCraftCuttingFeiTicketsPage())
  appStore.navigate('/fcs/craft/cutting/warehouse-management/wait-handover?inventoryType=binding')
  const bindingInventoryRenderMs = measureRender('捆条库存查询页', () => renderCraftCuttingWarehouseManagementWaitHandoverPage())
  appStore.navigate(`/fcs/print/preview?documentType=FEI_TICKET_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=${encodeURIComponent(bindingPrintSourceId)}`)
  const bindingPrintPreviewRenderMs = measureRender('捆条菲票打印预览', () => renderPrintPreviewPage())
  assertUnderBudget('捆条加工单列表', specialListRenderMs)
  assertUnderBudget('捆条菲票打印页', bindingFeiRenderMs)
  assertUnderBudget('捆条库存查询页', bindingInventoryRenderMs)
  assertUnderBudget('捆条菲票打印预览', bindingPrintPreviewRenderMs)

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
  assertIncludes(bindingPrintHtml, '切割方式', '捆条菲票打印预览缺少切割方式')
  assertIncludes(bindingPrintHtml, '捆条需要长度', '捆条菲票打印预览缺少捆条需要长度')
  assertIncludes(bindingPrintHtml, '需要布料长度', '捆条菲票打印预览缺少需要布料长度')
  assertIncludes(bindingPrintHtml, '接收布料长度', '捆条菲票打印预览缺少接收布料长度')
  assertIncludes(bindingPrintHtml, '实际完成总长度', '捆条菲票打印预览缺少实际完成总长度')
  assertIncludes(bindingPrintHtml, '每卷长度', '捆条菲票打印预览缺少每卷长度')
  assertIncludes(bindingPrintHtml, '切割公式', '捆条菲票打印预览缺少切割公式')
  assertIncludes(bindingPrintHtml, '切割长度', '捆条菲票打印预览缺少唯一切割长度')
  assertIncludes(bindingPrintHtml, '实切卷数', '捆条菲票打印预览缺少实切卷数')
  assertIncludes(bindingPrintHtml, '记录时间', '捆条菲票打印预览缺少记录时间')
  assertNotIncludes(bindingPrintHtml, '直切长度', '捆条菲票打印预览不允许展示三种切割方式长度')
  assertNotIncludes(bindingPrintHtml, '横切长度', '捆条菲票打印预览不允许展示三种切割方式长度')
  assertNotIncludes(bindingPrintHtml, '斜切长度', '捆条菲票打印预览不允许展示三种切割方式长度')
  assertNotIncludes(bindingPrintHtml, '编号区间', '捆条菲票打印预览不允许回退为部位菲票字段')
  assertNotIncludes(bindingPrintHtml, '部位数量', '捆条菲票打印预览不允许展示普通裁片字段')
  assertNotIncludes(bindingPrintHtml, '适用SKU', '捆条菲票打印预览不允许展示普通裁片字段')
  assertNotIncludes(bindingPrintHtml, '特殊工艺 / 承接工厂', '捆条菲票打印预览不允许展示普通裁片字段')

  const specialProcessModel = read('src/pages/process-factory/cutting/special-processes-model.ts')
  const specialProcessPage = read('src/pages/process-factory/cutting/special-processes.ts')
  const markerSpreadingPage = read('src/pages/process-factory/cutting/marker-spreading.ts')
  const markerPlanPage = read('src/pages/process-factory/cutting/marker-plan.ts')
  const feiTicketsPage = read('src/pages/process-factory/cutting/fei-tickets.ts')
  const appShellConfig = read('src/data/app-shell-config.ts')
  const routesFcs = read('src/router/routes-fcs.ts')
  const cutOrdersPage = read('src/pages/process-factory/cutting/cut-orders.ts')
  const productionProgressPage = read('src/pages/process-factory/cutting/production-progress.ts')

  assert(!/BindingProcessStatus = [^\n]*异常处理中/.test(specialProcessModel), '捆条加工主状态不能包含异常处理中')
  assert(!/BindingProcessStatus = [^\n]*已入仓/.test(specialProcessModel), '捆条加工主状态不能把入仓当加工状态')
  assertNotIncludes(specialProcessPage, 'data-testid="cutting-binding-list-overview"', '捆条加工单页面顶部汇总块已要求删除')
  assertNotIncludes(specialProcessPage, '捆条加工单列表', '捆条加工单页面顶部说明标题已要求删除')
  assertIncludes(specialProcessPage, '不足 4m 按 4m', '捆条加工单页面缺少 4m 起算提示')
  assertIncludes(specialProcessPage, '领料状态', '捆条加工单页面缺少是否领料展示')
  assertIncludes(specialProcessPage, '货架位置', '捆条加工单页面缺少货架位置展示')
  assertIncludes(specialProcessPage, '切割方式', '捆条加工单页面缺少切割方式展示')
  assertIncludes(specialProcessPage, '捆条需要长度', '捆条加工单页面缺少捆条需要长度展示')
  assertIncludes(specialProcessPage, '需要布料长度', '捆条加工单页面缺少需要布料长度展示')
  assertIncludes(specialProcessPage, '接收布料长度', '捆条加工单页面缺少接收布料长度展示')
  assertIncludes(specialProcessPage, '实际完成总长度', '捆条加工单页面缺少实际完成总长度展示')
  assertIncludes(specialProcessPage, '每卷长度', '记录裁剪弹窗缺少每卷长度录入')
  assertIncludes(specialProcessPage, 'data-binding-roll-length', '记录裁剪弹窗每卷长度必须可局部录入')
  assertIncludes(specialProcessPage, 'data-binding-roll-count', '记录裁剪弹窗实切卷数必须可局部录入')
  assertIncludes(specialProcessPage, 'data-binding-cutting-length', '记录裁剪弹窗切割长度必须自动计算展示')
  assertIncludes(specialProcessPage, '切割长度 = 每卷长度 × 实切卷数', '记录裁剪弹窗缺少切割长度计算公式')
  assertIncludes(specialProcessPage, 'updateBindingCalculatedCuttingLength', '记录裁剪弹窗缺少每卷长度局部计算逻辑')
  assertIncludes(specialProcessPage, '切割长度', '记录裁剪弹窗缺少唯一切割长度展示')
  assertNotIncludes(specialProcessPage, '<th class="px-3 py-3">直切长度</th>', '记录裁剪弹窗不允许展示直切长度列')
  assertNotIncludes(specialProcessPage, '<th class="px-3 py-3">横切长度</th>', '记录裁剪弹窗不允许展示横切长度列')
  assertNotIncludes(specialProcessPage, '<th class="px-3 py-3">斜切长度</th>', '记录裁剪弹窗不允许展示斜切长度列')
  assertIncludes(specialProcessPage, '实切卷数', '记录裁剪弹窗缺少实切卷数录入')
  assertIncludes(specialProcessPage, '记录时间', '记录裁剪弹窗缺少记录时间录入')
  assertIncludes(specialProcessPage, 'data-skip-page-rerender="true" data-cutting-binding-action="record-cutting"', '记录裁剪按钮必须跳过整页重渲染')
  assertIncludes(specialProcessPage, 'data-skip-page-rerender="true" data-cutting-binding-action="finish"', '结束加工按钮必须跳过整页重渲染')
  assertIncludes(specialProcessPage, 'event.stopPropagation()', '记录裁剪弹窗内部按钮不允许冒泡到全局 click 后重复处理')
  assertIncludes(specialProcessPage, 'cutting-binding-action-modal', '记录裁剪/结束加工必须打开功能弹窗')
  assertIncludes(specialProcessPage, 'submit-record-cutting', '记录裁剪弹窗必须有确认动作')
  assertIncludes(specialProcessPage, 'submit-finish', '结束加工弹窗必须有确认动作')
  assertIncludes(specialProcessPage, 'printObjectType', '打印菲票必须跳转到菲票打印页面并携带对象类型')
  assertIncludes(specialProcessPage, 'BINDING_STRIP_ORDER', '打印菲票必须定位到捆条加工单菲票列表')
  assertIncludes(specialProcessPage, '/fcs/craft/cutting/binding-fei-tickets', '捆条加工单打印菲票必须进入捆条菲票打印菜单')
  assertNotIncludes(specialProcessPage, '/fcs/craft/cutting/fei-tickets?', '捆条加工单打印菲票不允许继续跳到部位菲票打印菜单')
  assertNotIncludes(specialProcessPage, 'data-cutting-binding-action="print-ticket"', '打印菲票不允许只停留在本页 toast')
  assertIncludes(markerSpreadingPage, 'binding-strip-spreading-confirmation', '创建铺布单第二步缺少捆条二次确认提示')
  assertIncludes(markerSpreadingPage, 'window.confirm', '确认生成铺布单缺少捆条二次确认')
  assertIncludes(markerSpreadingPage, '铺布单不会分摊捆条加工长度', '铺布确认缺少不分摊到具体铺布单说明')
  assertIncludes(markerPlanPage, '捆条加工长度', '唛架方案缺少捆条加工长度')
  assertIncludes(markerPlanPage, '物料总用量', '唛架方案缺少包含捆条的物料总用量')
  assertIncludes(read('src/pages/process-factory/cutting/binding-strip-orders.ts'), '不足 4m 的捆条明细已按 4m 起算', '唛架方案捆条公式缺少 4m 起算说明')
  assertIncludes(appShellConfig, '部位菲票打印', '裁后处理菜单必须包含部位菲票打印')
  assertIncludes(appShellConfig, '捆条菲票打印', '裁后处理菜单必须包含捆条菲票打印')
  assertIncludes(appShellConfig, '/fcs/craft/cutting/binding-fei-tickets', '裁后处理菜单缺少捆条菲票打印路由')
  assertIncludes(routesFcs, '/fcs/craft/cutting/binding-fei-tickets', '路由表缺少捆条菲票打印菜单路由')
  assertIncludes(routesFcs, 'renderCraftCuttingBindingFeiTicketsPage', '路由表缺少捆条菲票打印渲染器')
  assertIncludes(feiTicketsPage, 'part-fei-ticket-print-workbench', '部位菲票打印页面必须保留部位菲票列表')
  assertIncludes(feiTicketsPage, 'binding-fei-ticket-print-workbench', '捆条菲票打印页面必须保留捆条菲票列表')
  assertIncludes(feiTicketsPage, '部位菲票打印', '菲票打印页面缺少部位菲票打印标题')
  assertIncludes(feiTicketsPage, '捆条菲票打印', '菲票打印页面缺少捆条菲票打印标题')
  assertIncludes(feiTicketsPage, 'resolveFeiTicketListMode', '菲票打印页面必须按路由决定部位/捆条列表')
  assertIncludes(feiTicketsPage, 'BINDING_STRIP_ORDER', '菲票类型缺少捆条菲票过滤值')
  assertIncludes(feiTicketsPage, '切割方式：', '捆条菲票打印列表缺少切割方式标签')
  assertIncludes(feiTicketsPage, '每卷长度：', '捆条菲票打印列表缺少每卷长度标签')
  assertIncludes(feiTicketsPage, '切割长度 = 每卷长度 × 实切卷数', '捆条菲票打印列表缺少切割长度计算公式')
  assertNotIncludes(feiTicketsPage, '菲票类型', '拆成两个菜单后页面内不应再提供菲票类型筛选')
  assertIncludes(feiTicketsPage, '全部打印', '菲票打印列表操作必须包含全部打印')
  assertIncludes(feiTicketsPage, '菲票明细', '菲票打印列表操作必须包含菲票明细')
  assertNotIncludes(feiTicketsPage, '菲票打印列表', '菲票打印页面不允许回退为合并打印列表')
  assertNotIncludes(feiTicketsPage, '铺布单与捆条加工单合并展示', '菲票打印页面不允许保留合并列表说明')
  assertNotIncludes(feiTicketsPage, 'renderBindingFeiTicketTable', '菲票打印页面不允许继续渲染独立捆条表')
  assertNotIncludes(feiTicketsPage, '查库存', '菲票打印页面不允许出现捆条查库存操作')
  assertNotIncludes(feiTicketsPage, '流转状态', '菲票打印页面不允许把捆条入仓/装袋/交出作为打印列表状态')
  assertNotIncludes(feiTicketsPage, '部位菲票明细', '菲票打印列表操作文案必须统一为菲票明细')
  assertIncludes(read('src/pages/print/templates/label-print-template.ts'), 'BINDING_STRIP', '打印模板缺少捆条菲票字段切换')
  assertIncludes(read('src/pages/print/templates/label-print-template.ts'), '捆条宽度', '捆条菲票打印模板缺少捆条宽度')
  assertIncludes(read('src/pages/print/templates/label-print-template.ts'), '切割方式', '捆条菲票打印模板缺少切割方式')
  assertIncludes(read('src/pages/print/templates/label-print-template.ts'), '实际完成总长度', '捆条菲票打印模板缺少实际完成总长度')
  assertIncludes(read('src/pages/print/templates/label-print-template.ts'), '每卷长度', '捆条菲票打印模板缺少每卷长度')
  assertIncludes(read('src/pages/print/templates/label-print-template.ts'), '切割公式', '捆条菲票打印模板缺少切割公式')
  assertIncludes(read('src/pages/print/templates/label-print-template.ts'), '切割长度', '捆条菲票打印模板缺少唯一切割长度')
  assertIncludes(read('src/pages/print/templates/label-print-template.ts'), '实切卷数', '捆条菲票打印模板缺少实切卷数')
  assertIncludes(read('src/pages/print/templates/label-print-template.ts'), 'findFeiRecordInRecords(bindingRecords', '捆条菲票打印预览必须先走捆条记录快路径')
  assertIncludes(read('src/pages/process-factory/cutting/fei-tickets.ts'), 'buildFeiTicketWorkbenchRows(getDataBundle())', '捆条菲票页不允许无条件构建普通部位菲票数据包')
  assertIncludes(read('src/pages/process-factory/cutting/warehouse-hub.ts'), "getWarehouseSearchParams().get('inventoryType') === 'binding'", '查捆条库存必须先走捆条库存轻量路径')
  assertIncludes(cutOrdersPage, '捆条加工单', '裁片单详情缺少捆条加工单信息')
  assertIncludes(productionProgressPage, 'bindingProcessOrders', '裁床总览缺少捆条加工单链路数据')
  assertIncludes(productionProgressPage, '捆条加工：', '裁床总览裁片单卡片缺少捆条加工展示')
  assertIncludes(productionProgressPage, '不足', '裁床总览捆条加工缺少不足单数')
  assertIncludes(productionProgressPage, '切割方式', '裁床总览捆条加工缺少切割方式汇总')

  console.log(
    [
      '捆条加工单流转检查通过',
      `捆条需求明细：${requirementLines.length} 条`,
      `捆条加工单：${orders.length} 单`,
      `唯一捆条菲票：${detailTicketNos.length} 张`,
      `示例汇总长度：${summary.totalRequiredLengthM.toFixed(2)} m`,
      `按钮目标响应：列表 ${specialListRenderMs.toFixed(2)}ms / 捆条菲票 ${bindingFeiRenderMs.toFixed(2)}ms / 库存 ${bindingInventoryRenderMs.toFixed(2)}ms / 预览 ${bindingPrintPreviewRenderMs.toFixed(2)}ms`,
    ].join('\n'),
  )
}

main()
