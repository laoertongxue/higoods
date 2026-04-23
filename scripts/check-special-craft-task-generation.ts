#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { getProductionOrderTechPackSnapshot } from '../src/data/fcs/production-order-tech-pack-runtime.ts'
import {
  generateProductionArtifactBundleForOrder,
} from '../src/data/fcs/production-artifact-generation.ts'
import { buildProductionConfirmationSnapshot } from '../src/data/fcs/production-confirmation.ts'
import {
  buildSpecialCraftOperationSlug,
  getSpecialCraftOperationById,
} from '../src/data/fcs/special-craft-operations.ts'
import {
  getSpecialCraftGenerationBatchByOrderId,
  getSpecialCraftTaskOrderById,
  getSpecialCraftTasksByProductionOrder,
} from '../src/data/fcs/special-craft-task-orders.ts'
import {
  buildSpecialCraftTaskDemandLinesFromProductionOrder,
  generateSpecialCraftTaskOrdersFromProductionOrder,
} from '../src/data/fcs/special-craft-task-generation.ts'
import { renderSpecialCraftTaskDetailPage } from '../src/pages/process-factory/special-craft/task-detail.ts'
import { renderSpecialCraftTaskOrdersPage } from '../src/pages/process-factory/special-craft/task-orders.ts'
import { removedLegacyCraftNames } from './utils/special-craft-banlist.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

function buildToken(...parts: string[]): string {
  return parts.join('')
}

function assertContains(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotContains(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

const packageSource = read('package.json')
const generatorSource = read('src/data/fcs/special-craft-task-generation.ts')
const artifactSource = read('src/data/fcs/production-artifact-generation.ts')
const taskOrdersSource = read('src/pages/process-factory/special-craft/task-orders.ts')
const taskDetailSource = read('src/pages/process-factory/special-craft/task-detail.ts')
const warehouseSource = read('src/pages/process-factory/special-craft/warehouse.ts')
const pdaWarehouseSource = read('src/pages/pda-warehouse.ts')
const handoverSource = read('src/pages/pda-handover.ts')
const confirmationSource = read('src/data/fcs/production-confirmation.ts')
const confirmationPageSource = read('src/pages/production/confirmation-print.ts')
const taskBreakdownSource = read('src/pages/task-breakdown.ts')
const orderDetailSource = read('src/pages/production/detail-domain.ts')
const feiTicketFlowSource = read('src/data/fcs/cutting/special-craft-fei-ticket-flow.ts')

assertContains(packageSource, 'check:special-craft-task-generation', 'package.json 缺少生产单特殊工艺任务生成检查命令')
assertContains(generatorSource, 'buildSpecialCraftTaskDemandLinesFromProductionOrder', '缺少特殊工艺需求明细构建器')
assertContains(generatorSource, 'generateSpecialCraftTaskOrdersFromProductionOrder', '缺少特殊工艺任务生成器')
assertContains(generatorSource, 'getSpecialCraftGenerationKey', '缺少特殊工艺任务幂等键')
assertContains(generatorSource, 'attachSpecialCraftTasksToProductionArtifacts', '缺少特殊工艺任务接入生产单产物 helper')
assertContains(feiTicketFlowSource, 'buildSpecialCraftFeiTicketBindingsFromGeneratedFeiTickets', '缺少 Prompt 7 菲票绑定适配层')
assertNotContains(feiTicketFlowSource, 'generateSpecialCraftTaskOrdersFromProductionOrder', '菲票绑定层不应重新生成特殊工艺任务')
assertNotContains(feiTicketFlowSource, 'buildSpecialCraftTaskDemandLinesFromProductionOrder', '菲票绑定层不应重新生成特殊工艺任务明细')
assertContains(generatorSource, 'patternFiles', '生成器未读取技术包快照纸样文件')
assertContains(generatorSource, 'pieceRows', '生成器未读取裁片明细')
assertContains(generatorSource, 'specialCrafts', '生成器未读取裁片特殊工艺')
assertContains(generatorSource, 'colorAllocations', '生成器未读取适用颜色与片数')
assertContains(generatorSource, 'skuLines', '生成器未读取生产单颜色尺码数量矩阵')
assertContains(generatorSource, 'planPieceQty: pieceCountPerGarment * orderQty', '计划片数计算公式不正确')
assertContains(artifactSource, 'generateProductionArtifactBundleForOrder', '生产单生成链路缺少特殊工艺任务 bundle 接口')
assertContains(artifactSource, 'specialCraftTaskOrders', '生产单生成链路未接入特殊工艺任务')
assertNotContains(taskOrdersSource, buildToken('新', '增任务'), '特殊工艺任务单页面不应提供手工新增入口')
assertNotContains(taskOrdersSource, buildToken('生', '成任务'), '特殊工艺任务单页面不应提供手工生成入口')
assertNotContains(taskOrdersSource, buildToken('从', '裁片仓', '生成'), '特殊工艺任务单页面不应提供裁片仓转任务入口')
assertNotContains(warehouseSource, buildToken('生', '成任务'), '特殊工艺仓库页面不应提供任务生成入口')
assertNotContains(pdaWarehouseSource, 'generateSpecialCraftTaskOrdersFromProductionOrder', '仓管页面不应触发特殊工艺任务生成')
assertNotContains(handoverSource, 'generateSpecialCraftTaskOrdersFromProductionOrder', '交接页面不应触发特殊工艺任务生成')
assertNotContains(
  generatorSource,
  buildToken('裁片', '入仓', '后生成'),
  `${buildToken('裁片', '入仓', '后')}不应${buildToken('产', '出特殊工艺任务')}`,
)

const sampleOrder = productionOrders.find((order) => {
  const snapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
  if (!snapshot) return false
  return generateSpecialCraftTaskOrdersFromProductionOrder({
    productionOrder: order,
    techPackSnapshot: snapshot,
  }).taskOrders.length > 0
})

assert(sampleOrder, '至少应存在一个可自动生成特殊工艺任务的生产单')

const snapshot = getProductionOrderTechPackSnapshot(sampleOrder.productionOrderId)
assert(snapshot, '生产单必须存在技术包快照')
assert(snapshot.patternFiles.some((row) => row.pieceRows.some((piece) => (piece.specialCrafts ?? []).length > 0)), '技术包快照必须在裁片明细中标记特殊工艺')

const demandBuildResult = buildSpecialCraftTaskDemandLinesFromProductionOrder({
  productionOrder: sampleOrder,
  techPackSnapshot: snapshot,
})

assert(demandBuildResult.demandLines.length > 0, '必须能从生产单与技术包快照构建特殊工艺任务明细')
assert(demandBuildResult.demandLines.every((line) => line.partName.trim().length > 0), '任务明细必须包含裁片部位')
assert(demandBuildResult.demandLines.every((line) => line.colorName.trim().length > 0), '任务明细必须包含颜色')
assert(demandBuildResult.demandLines.every((line) => line.sizeCode.trim().length > 0), '任务明细必须包含尺码')
assert(demandBuildResult.demandLines.every((line) => Number(line.pieceCountPerGarment) > 0), '任务明细必须包含每件片数')
assert(demandBuildResult.demandLines.every((line) => Number(line.orderQty) > 0), '任务明细必须包含生产数量')
assert(demandBuildResult.demandLines.every((line) => line.planPieceQty === line.pieceCountPerGarment * line.orderQty), '计划片数必须等于每件片数乘生产数量')
assert(demandBuildResult.demandLines.every((line) => line.patternFileId.trim().length > 0 && line.patternFileName.trim().length > 0), '任务明细必须包含来源纸样')
assert(demandBuildResult.demandLines.every((line) => line.pieceRowId.trim().length > 0), '任务明细必须包含来源裁片明细')
assert(demandBuildResult.demandLines.every((line) => Array.isArray(line.feiTicketNos) && line.feiTicketNos.length === 0), '任务生成时菲票字段必须允许为空')

const firstResult = generateSpecialCraftTaskOrdersFromProductionOrder({
  productionOrder: sampleOrder,
  techPackSnapshot: snapshot,
})
const secondResult = generateSpecialCraftTaskOrdersFromProductionOrder({
  productionOrder: sampleOrder,
  techPackSnapshot: snapshot,
  existingGeneratedTasks: firstResult.taskOrders,
})

assert(firstResult.taskOrders.length > 0, '生产单生成时必须产出特殊工艺任务')
assert(firstResult.errors.filter((item) => item.blocking).length === 0, '示例生产单不应存在阻塞错误')
assert(firstResult.taskOrders.every((task) => task.generationSource === 'PRODUCTION_ORDER'), '任务来源必须标记为生产单生成')
assert(firstResult.taskOrders.every((task) => task.generationSourceLabel === '生产单生成'), '任务来源中文标签必须为生产单生成')
assert(firstResult.taskOrders.every((task) => task.isGenerated === true), '自动产出任务必须标记为已生成')
assert(firstResult.taskOrders.every((task) => task.isManualCreated === false), '自动产出任务不得标记为手工创建')
assert(firstResult.taskOrders.every((task) => Array.isArray(task.demandLines) && task.demandLines.length > 0), '特殊工艺任务必须包含任务明细')
assert(firstResult.taskOrders.every((task) => task.demandLines!.every((line) => line.taskOrderId === task.taskOrderId)), '任务明细必须回写所属任务号')
assert(firstResult.taskOrders.every((task) => task.assignmentStatusLabel === '待分配' || task.assignmentStatusLabel === '已分配'), '任务必须包含分配状态')
assert(firstResult.taskOrders.every((task) => task.executionStatusLabel === '待领料'), '新产出任务执行状态必须初始化为待领料')
assert(firstResult.taskOrders.every((task) => !removedLegacyCraftNames.includes(task.craftName)), '不得生成已删除旧工艺任务')
assert(firstResult.taskOrders.every((task) => {
  const operation = getSpecialCraftOperationById(task.operationId)
  return Boolean(operation?.isEnabled && operation.processCode === 'SPECIAL_CRAFT' && operation.craftCode === task.craftCode)
}), '任务只能来自启用的特殊工艺运营分类')

const forbiddenCraftNames = [buildToken('印', '花'), buildToken('染', '色')]
assert(firstResult.taskOrders.every((task) => !forbiddenCraftNames.includes(task.craftName)), '不得生成独立工艺模块的特殊工艺任务')
assert(firstResult.demandLines.every((line) => !forbiddenCraftNames.includes(line.craftName)), '任务明细不得引用独立工艺模块')

assert.equal(firstResult.generationBatch.status, '已生成', '生成批次状态必须为已生成')
assert.equal(firstResult.generationBatch.generatedTaskOrderIds.length, firstResult.taskOrders.length, '生成批次任务数量必须与结果一致')
assert.equal(firstResult.generationBatch.generatedLineCount, firstResult.demandLines.length, '生成批次明细数量必须与结果一致')

const firstTaskIds = firstResult.taskOrders.map((task) => task.taskOrderId).sort()
const secondTaskIds = secondResult.taskOrders.map((task) => task.taskOrderId).sort()
assert.deepEqual(secondTaskIds, firstTaskIds, '同一生产单重复生成不得重复创建任务')
assert.equal(secondResult.generationBatch.generationBatchId, firstResult.generationBatch.generationBatchId, '同一生产单重复生成必须复用相同生成批次')
assert.deepEqual(
  secondResult.taskOrders.map((task) => task.generationKey).sort(),
  firstResult.taskOrders.map((task) => task.generationKey).sort(),
  '同一生产单重复生成必须保持幂等键稳定',
)

const artifactBundle = generateProductionArtifactBundleForOrder(sampleOrder.productionOrderId)
assert(artifactBundle.specialCraftTaskOrders.length === firstResult.taskOrders.length, '生产单产物 bundle 必须承接特殊工艺任务')

const storeTasks = getSpecialCraftTasksByProductionOrder(sampleOrder.productionOrderId)
assert(storeTasks.length === firstResult.taskOrders.length, '特殊工艺任务单数据源必须读取自动产出任务')
const sampleTask = storeTasks[0]
assert(sampleTask, '必须能在任务单数据源中找到自动产出任务')
assert(getSpecialCraftTaskOrderById(sampleTask.taskOrderId), '必须能根据任务号读取自动产出任务详情')
assert(getSpecialCraftGenerationBatchByOrderId(sampleOrder.productionOrderId), '必须能根据生产单读取生成批次')

const operationSlug = buildSpecialCraftOperationSlug(sampleTask.operationId)
const taskOrdersHtml = renderSpecialCraftTaskOrdersPage(operationSlug)
assert(taskOrdersHtml.includes(sampleTask.taskOrderNo), '特殊工艺任务单页面必须显示自动产出任务')
assert(taskOrdersHtml.includes('生产单生成'), '特殊工艺任务单页面必须显示任务来源')
assert(taskOrdersHtml.includes('明细数'), '特殊工艺任务单页面必须显示明细数字段')
assert(taskOrdersHtml.includes('分配状态'), '特殊工艺任务单页面必须显示分配状态')
assert(taskOrdersHtml.includes('执行状态'), '特殊工艺任务单页面必须显示执行状态')

const taskDetailHtml = renderSpecialCraftTaskDetailPage(operationSlug, sampleTask.taskOrderId)
;['任务明细', '来源纸样', '来源裁片明细', '技术包版本', '生成批次', '分配状态', '执行状态', '待绑定'].forEach((token) => {
  assert(taskDetailHtml.includes(token), `特殊工艺任务详情页缺少：${token}`)
})

;['特殊工艺任务', '查看任务', '查看特殊工艺任务单', '生产单生成', '生成失败', '请检查技术包'].forEach((token) => {
  assertContains(orderDetailSource, token, `生产单详情源码缺少：${token}`)
})
;['特殊工艺任务', '明细数', '生产单生成', 'data-breakdown-field="specialCraftOperation"'].forEach((token) => {
  assertContains(taskBreakdownSource, token, `任务拆解页源码缺少：${token}`)
})

const confirmationSnapshot = buildProductionConfirmationSnapshot(sampleOrder.productionOrderId)
assert(confirmationSnapshot.taskAssignmentSnapshot.some((row) => row.taskNo === sampleTask.taskOrderNo), '生产确认单快照必须包含特殊工艺任务')
;['作用对象', '裁片部位', '颜色', '尺码', '分配状态'].forEach((token) => {
  assertContains(confirmationPageSource, token, `生产确认单页面缺少：${token}`)
})
assertContains(confirmationSource, 'getSpecialCraftTasksByProductionOrder', '生产确认单未接入特殊工艺任务快照')

const forbiddenVisibleTerms = [
  buildToken('P', 'DA'),
  buildToken('来', '料仓'),
  buildToken('半成品', '仓'),
  buildToken('库存', '三态'),
  buildToken('上架', '任务'),
  buildToken('拣货', '波次'),
]
forbiddenVisibleTerms.forEach((token) => {
  assertNotContains(taskOrdersSource + taskDetailSource + orderDetailSource + taskBreakdownSource, token, `页面用户可见文案不应出现：${token}`)
})

;[
  buildToken('bind', 'Fei'),
  buildToken('生成', '菲票'),
  buildToken('绑定', '菲票'),
].forEach((token) => {
  assertNotContains(generatorSource + taskDetailSource + orderDetailSource, token, `本轮不应出现菲票提前处理：${token}`)
})

;['axios', 'fetch(', 'apiClient', '/api/', 'i18n', 'useTranslation', 'locales', 'translations'].forEach((token) => {
  assertNotContains(generatorSource + taskOrdersSource + taskDetailSource + orderDetailSource, token, `本轮不应越界到接口或多语言：${token}`)
})

console.log('check:special-craft-task-generation passed')
